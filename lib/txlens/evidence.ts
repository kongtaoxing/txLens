import { decodeFunctionResult, encodeFunctionData, type Hex } from "viem";
import { CONTRACTS, exchangeAbi, CHAIN_ID } from "./contracts";
import { maxFee } from "./checks";
import type { Decoded, Quote, ReviewInput, Simulation } from "./types";

export function createEvidence(input: ReviewInput, decoded: Decoded, rpcUrl: string, signal: AbortSignal) {
  let block: string | undefined;
  async function rpc(method: string, params: unknown[]) {
    if (!rpcUrl) throw new Error("Set ROBINHOOD_RPC_URL to query chain 4663.");
    const response = await fetch(rpcUrl, { method: "POST", redirect: "manual", signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}.`);
    const data = await response.json() as { result?: unknown; error?: { message: string } };
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }
  async function getBlock() {
    if (!block) {
      const chain = await rpc("eth_chainId", []);
      if (Number(chain) !== CHAIN_ID) throw new Error("RPC is not Robinhood Chain (4663).");
      block = await rpc("eth_blockNumber", []) as string;
    }
    return block;
  }
  async function quote(): Promise<Quote> {
    const source = input.mode === "demo" ? "fixture" : "rpc";
    if (!decoded.supported) return { source, error: "Decode a supported bundle before requesting a quote." };
    if (input.mode === "demo") {
      const amount = BigInt(decoded.usdgIn!);
      return { source, creditOut: (amount * 5n / 2n).toString(), usdgSpent: amount.toString(), fee: maxFee(amount, 250n).toString(), feeBps: "250", maxFills: "100", block: "Demo fixture · 2.5 CREDIT/USDG · 2.5% fee" };
    }
    try {
      const at = await getBlock();
      const call = (data: Hex) => rpc("eth_call", [{ to: CONTRACTS.exchange, data }, at]);
      const [q, f, m] = await Promise.all([
        call(encodeFunctionData({ abi: exchangeAbi, functionName: "getQuote", args: [BigInt(decoded.usdgIn!), BigInt(decoded.maxFills!)] })),
        call(encodeFunctionData({ abi: exchangeAbi, functionName: "feeBps" })),
        call(encodeFunctionData({ abi: exchangeAbi, functionName: "MAX_FILLS" })),
      ]);
      const values = decodeFunctionResult({ abi: exchangeAbi, functionName: "getQuote", data: q as Hex });
      return { source, creditOut: values.creditOut.toString(), usdgSpent: values.usdgSpent.toString(), fee: values.feeAtoms.toString(), feeBps: decodeFunctionResult({ abi: exchangeAbi, functionName: "feeBps", data: f as Hex }).toString(), maxFills: decodeFunctionResult({ abi: exchangeAbi, functionName: "MAX_FILLS", data: m as Hex }).toString(), block: BigInt(at).toString() };
    } catch (error) {
      if (signal.aborted) throw error;
      return { source, error: error instanceof Error ? error.message : "Quote unavailable." };
    }
  }
  async function simulate(): Promise<Simulation> {
    if (input.mode === "demo") return { source: "fixture", status: "unavailable", detail: "Demo fixtures do not execute onchain. Only intent and calldata checks are verified." };
    try {
      const at = await getBlock();
      // eth_simulateV1 applies calls sequentially, so the approval affects the purchase.
      // Independent eth_call requests cannot establish this and are not a substitute.
      const gasPrice = await rpc("eth_gasPrice", []);
      const results = await rpc("eth_simulateV1", [{ blockStateCalls: [{ calls: input.bundle.transactions.map(tx => ({ ...tx, gas: "0x2dc6c0", gasPrice, from: input.bundle.from, value: `0x${BigInt(tx.value).toString(16)}` })) }], validation: true, traceTransfers: true }, at]) as { calls: { status?: string; error?: { message: string } }[] }[];
      const calls = results?.[0]?.calls;
      if (!calls || calls.length !== input.bundle.transactions.length) throw new Error("RPC did not return both sequential call results.");
      if (calls.some(c => c.status !== "0x1" && c.status !== "0x0")) throw new Error("RPC returned an unrecognized execution status.");
      const failed = calls.find(c => c.status === "0x0");
      return { source: "rpc", status: failed ? "fail" : "pass", block: BigInt(at).toString(), detail: failed ? `Sequential simulation reverted: ${failed.error?.message ?? "execution failed"}` : `Both calls executed in sequence at block ${BigInt(at)}. This does not broadcast a transaction or guarantee later execution.` };
    } catch (error) {
      if (signal.aborted) throw error;
      return { source: "rpc", status: "unavailable", detail: `Sequential simulation unavailable: ${error instanceof Error ? error.message : "RPC error"}. No execution success is claimed.` };
    }
  }
  return { quote, simulate };
}
