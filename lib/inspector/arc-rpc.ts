import { formatUnits } from "viem";
import { z } from "zod";
import { ARC } from "./arc";
import type { WalletRequest } from "./model";

const quantity = z.string().regex(/^0x[0-9a-f]+$/i);
export const transactionHash = z.string().regex(/^0x[0-9a-f]{64}$/i);
const address = z.string().regex(/^0x[0-9a-f]{40}$/i);
const transaction = z.object({
  hash: transactionHash, from: address, to: address.nullable(),
  value: quantity, input: z.string().regex(/^0x(?:[0-9a-f]{2})*$/i),
  blockNumber: quantity.nullable(), blockHash: transactionHash.nullable(),
});
const receipt = z.object({
  transactionHash, blockHash: transactionHash, status: z.enum(["0x0", "0x1"]),
  gasUsed: quantity, effectiveGasPrice: quantity,
});
export type ArcTransaction = {
  hash: string; block: string; status: "success" | "reverted";
  gasFee: string; observedAt: string; request: WalletRequest;
};
export class ArcReadError extends Error {
  constructor(public code: "network" | "not-found" | "pending" | "empty") { super(code); }
}

// Only read methods on a server-configured Arc endpoint. No signing or broadcasting.
export async function readArcTransaction(hash?: string): Promise<ArcTransaction> {
  if (hash) transactionHash.parse(hash);
  const signal = AbortSignal.timeout(15000);
  async function rpc(method: string, params: unknown[]) {
    const response = await fetch(process.env.ARC_RPC_URL || ARC.rpc, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal, cache: "no-store",
    });
    if (!response.ok) throw Error("RPC unavailable");
    const body = await response.json();
    if (body.error || !("result" in body)) throw Error("RPC unavailable");
    return body.result;
  }
  const chainId = quantity.parse(await rpc("eth_chainId", []));
  if (BigInt(chainId) !== BigInt(ARC.chainId)) throw new ArcReadError("network");
  let tx: z.infer<typeof transaction> | undefined;
  if (hash) {
    const result = await rpc("eth_getTransactionByHash", [hash]);
    if (!result) throw new ArcReadError("not-found");
    tx = transaction.parse(result);
    if (tx.hash.toLowerCase() !== hash.toLowerCase()) throw Error("Transaction mismatch");
  } else {
    const head = BigInt(quantity.parse(await rpc("eth_blockNumber", [])));
    // Arc has short block times. Read up to 12 blocks in groups of four.
    for (let offset = 0n; offset < 12n && head >= offset; offset += 4n) {
      const numbers = [0n, 1n, 2n, 3n].map(i => head - offset - i).filter(n => n >= 0n);
      const blocks = await Promise.all(numbers.map(async number =>
        z.object({ transactions: z.array(transaction) }).parse(
          await rpc("eth_getBlockByNumber", [`0x${number.toString(16)}`, true]),
        ),
      ));
      tx = blocks.flatMap(block => block.transactions).find(item => item.to !== null && (
        item.to.toLowerCase() === ARC.usdc || (item.input === "0x" && BigInt(item.value) > 0n)
      ));
      if (tx) break;
    }
    if (!tx) throw new ArcReadError("empty");
  }
  if (!tx.blockNumber || !tx.blockHash) throw new ArcReadError("pending");
  const result = receipt.parse(await rpc("eth_getTransactionReceipt", [tx.hash]));
  if (result.transactionHash.toLowerCase() !== tx.hash.toLowerCase() || result.blockHash !== tx.blockHash)
    throw Error("Receipt mismatch");
  return {
    hash: tx.hash, block: BigInt(tx.blockNumber).toString(),
    status: result.status === "0x1" ? "success" : "reverted",
    gasFee: formatUnits(BigInt(result.gasUsed) * BigInt(result.effectiveGasPrice), 18),
    observedAt: new Date().toISOString(),
    request: { method: "eth_sendTransaction", chainId: ARC.chainHex, origin: ARC.explorer,
      params: [{ from: tx.from, to: tx.to, value: tx.value, data: tx.input }] },
  };
}
