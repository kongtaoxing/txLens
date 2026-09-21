import assert from "node:assert/strict";
import test from "node:test";
import { encodeFunctionData, parseUnits } from "viem";
import { decodeBundle, evaluate, repairBundle } from "../../lib/txlens/checks";
import { CONTRACTS, tokenAbi } from "../../lib/txlens/contracts";
import { defaultPolicy, makeBundle, scenarios } from "../../lib/txlens/fixtures";
import { reviewSchema, type Quote, type Simulation } from "../../lib/txlens/types";

const quote: Quote = { source: "fixture", creditOut: "10000000", usdgSpent: "4000000", fee: "100000", feeBps: "250", maxFills: "100", block: "fixture" };
const simulation: Simulation = { source: "fixture", status: "unavailable", detail: "No simulation." };
function inspect(bundle = makeBundle(), policy = defaultPolicy, q = quote) { return evaluate(bundle, policy, decodeBundle(bundle), q, simulation); }
test("canonical matching purchase has no mismatch, but missing execution stays unknown", () => {
  const checks = inspect(); assert.equal(checks.filter(c => c.status === "fail").length, 0); assert.equal(checks.find(c => c.id === "simulation")?.status, "unknown");
});
test("unlimited approval fails even when purchase is within budget; repair is exact", () => {
  const bundle = scenarios[0].bundle; assert.equal(inspect(bundle).find(c => c.id === "allowance")?.status, "fail");
  const repair = repairBundle(bundle, defaultPolicy, decodeBundle(bundle), quote)!;
  assert.equal(decodeBundle(repair.bundle).approval, "4100000"); assert.equal(inspect(repair.bundle).filter(c => c.status === "fail").length, 0);
});
test("wrong beneficiary fails and repaired calldata addresses the user's wallet", () => {
  const bundle = scenarios[1].bundle; assert.equal(inspect(bundle).find(c => c.id === "beneficiary")?.status, "fail");
  assert.equal(decodeBundle(repairBundle(bundle, defaultPolicy, decodeBundle(bundle), quote)!.bundle).beneficiary, defaultPolicy.beneficiary);
});
test("budget includes fees and uses maximum encoded spend, not only filled amount", () => {
  const policy = { ...defaultPolicy, maxSpend: "4" };
  const partialQuote: Quote = { ...quote, usdgSpent: "1000000", fee: "25000" };
  assert.equal(inspect(makeBundle(), policy, partialQuote).find(c => c.id === "budget")?.status, "fail");
  assert.equal(repairBundle(makeBundle(), policy, decodeBundle(makeBundle()), quote), undefined);
});
test("one micro-USDG matters without floating point rounding", () => {
  assert.equal(inspect(makeBundle(), { ...defaultPolicy, maxSpend: "4.099999" }).find(c => c.id === "budget")?.status, "fail");
  assert.equal(inspect(makeBundle(), { ...defaultPolicy, maxSpend: "4.100000" }).find(c => c.id === "budget")?.status, "pass");
});
test("wrong spender is detected independently of allowance amount", () => {
  const bundle = makeBundle(); bundle.transactions[0].data = encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [defaultPolicy.beneficiary as `0x${string}`, parseUnits("4.1", 6)] });
  assert.equal(inspect(bundle).find(c => c.id === "spender")?.status, "fail");
});
test("unknown target, reordered calls, appended calldata and native value are not certified", () => {
  const target = makeBundle(); target.transactions[1].to = CONTRACTS.credit; assert.equal(decodeBundle(target).supported, false);
  const reversed = makeBundle(); reversed.transactions.reverse(); assert.equal(decodeBundle(reversed).supported, false);
  const extra = makeBundle(); extra.transactions[0].data += "00"; assert.equal(decodeBundle(extra).supported, false);
  const value = makeBundle(); value.transactions[0].value = "1"; assert.equal(inspect(value).find(c => c.id === "native-value")?.status, "fail");
});
test("unavailable quote cannot produce a positive pricing or execution check", () => {
  const checks = inspect(makeBundle(), defaultPolicy, { source: "rpc", error: "Unavailable" });
  assert.equal(checks.find(c => c.id === "quote")?.status, "unknown");
  assert.equal(checks.some(c => c.id === "budget" && c.status === "pass"), false);
});
test("invalid JSON shape, chain, and excessive fractional precision rejected at input boundary", () => {
  const base = { intent: "Buy CREDIT for my agent", mode: "demo", policy: defaultPolicy, bundle: makeBundle() };
  assert.equal(reviewSchema.safeParse(base).success, true);
  assert.equal(reviewSchema.safeParse({ ...base, bundle: { ...base.bundle, chainId: 1 } }).success, false);
  assert.equal(reviewSchema.safeParse({ ...base, policy: { ...defaultPolicy, maxSpend: "4.1000001" } }).success, false);
});

test("corrections never lower an already stronger minimum output", () => {
  const bundle = makeBundle(); const d = { ...decodeBundle(bundle), minCreditOut: "12000000" };
  const generous: Quote = { ...quote, creditOut: "15000000" };
  const changed = { ...d, approval: "999999999" };
  assert.equal(decodeBundle(repairBundle(bundle, defaultPolicy, changed, generous)!.bundle).minCreditOut, "12000000");
  assert.equal(repairBundle(bundle, defaultPolicy, changed, quote), undefined);
});
