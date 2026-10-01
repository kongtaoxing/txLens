import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, parseUnits } from "viem";
import { inspect, tokenAbi, type WalletRequest } from "../../lib/inspector/model";
import { ARC } from "../../lib/inspector/arc";
import { readArcTransaction } from "../../lib/inspector/arc-rpc";
import { addressExplorer } from "../../lib/inspector/explorer";
import { GET } from "../../app/api/arc/route";
const from = "0x1111111111111111111111111111111111111111";
const to = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`;
const blockHash = `0x${"b".repeat(64)}`;
const base: WalletRequest = { origin: "https://example.com", chainId: ARC.chainHex, method: "eth_sendTransaction", params: [] };

test("Arc native USDC and ERC-20 USDC render the same amount with different precision", () => {
  for (const chainId of ["5042", "0x13b2", "5042002"]) {
    const native = { ...base, chainId, params: [{ from, to, value: `0x${parseUnits("25.123456", 18).toString(16)}` }] };
    const erc20 = { ...base, chainId, params: [{ from, to: ARC.usdc, data: encodeFunctionData({ abi: tokenAbi, functionName: "transfer", args: [to, 25123456n] }) }] };
    for (const locale of ["zh", "en"] as const) for (const request of [native, erc20]) {
      const report = inspect(request, locale);
      assert.match(report.network, /Arc/);
      assert(report.facts.some(f => f.value === "25.123456 USDC"));
      assert.doesNotMatch(JSON.stringify(report), /ETH|unverified decimals/);
    }
  }
});
test("Arc approval is a spending limit and links to the right explorer", () => {
  const report = inspect({ ...base, params: [{ from, to: ARC.usdc, data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [to, 5000000n] }) }] }, "en");
  assert(report.facts.some(f => f.label === "Spending limit" && f.value === "5 USDC"));
  assert.equal(addressExplorer(ARC.chainHex, to), `${ARC.explorer}/address/${to}`);
  assert.equal(addressExplorer("5042002", to), `https://explorer.testnet.arc.io/address/${to}`);
  assert.doesNotMatch(JSON.stringify(inspect({ ...base, chainId: "1", params: [{ to: ARC.usdc, data: encodeFunctionData({ abi: tokenAbi, functionName: "transfer", args: [to, 5000000n] }) }] }, "en")), /5 USDC/);
});

test("mainnet lookup reads real fields, receipt status and USDC gas without write RPCs", async () => {
  const original = global.fetch;
  const calls: string[] = [];
  const tx = { hash, from, to, blockNumber: "0x64", blockHash, value: "0xde0b6b3a7640000", input: "0x" };
  const results: Record<string, unknown> = {
    eth_chainId: ARC.chainHex, eth_blockNumber: "0x64", eth_getBlockByNumber: { transactions: [tx] },
    eth_getTransactionByHash: tx,
    eth_getTransactionReceipt: { transactionHash: hash, blockHash, status: "0x0", gasUsed: "0x5208", effectiveGasPrice: "0x3b9aca00" },
  };
  global.fetch = async (_input, options) => {
    const { method } = JSON.parse(String(options?.body)); calls.push(method);
    assert(method in results, `unexpected RPC method ${method}`);
    return Response.json({ jsonrpc: "2.0", id: 1, result: results[method] });
  };
  try {
    const result = await readArcTransaction();
    assert.equal(result.hash, hash); assert.equal(result.block, "100");
    assert.equal(result.gasFee, "0.000021"); assert.equal(result.status, "reverted");
    assert.equal(result.request.chainId, ARC.chainHex);
    const response = await GET(new Request(`https://txlens.example/api/arc?hash=${hash}`));
    assert.equal(response.status, 200);
    results.eth_chainId = "0x1";
    await assert.rejects(readArcTransaction(hash), /network/);
    assert(!calls.some(method => /send|sign|approve/i.test(method)));
  } finally { global.fetch = original; }
});
test("invalid hashes never call the RPC and missing transactions remain missing", async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async (_input, options) => {
    calls++;
    const { method } = JSON.parse(String(options?.body));
    return Response.json({ result: method === "eth_chainId" ? ARC.chainHex : null });
  };
  try {
    assert.equal((await GET(new Request("https://txlens.example/api/arc?hash=invalid"))).status, 400);
    assert.equal(calls, 0);
    const response = await GET(new Request(`https://txlens.example/api/arc?hash=${hash}`));
    assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: "not-found" });
  } finally { global.fetch = original; }
});
