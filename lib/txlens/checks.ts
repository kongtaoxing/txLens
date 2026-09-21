import { decodeFunctionData, encodeFunctionData, formatUnits, maxUint256, pad, parseUnits, type Address, type Hex } from "viem";
import { CONTRACTS, exchangeAbi, sameAddress, tokenAbi } from "./contracts";
import type { Bundle, Check, Decoded, Policy, Quote, Simulation } from "./types";

export const units = (value: string) => parseUnits(value, 6);
export const display = (value: string | bigint) => formatUnits(BigInt(value), 6);
export const allowanceLabel = (value: string) => BigInt(value) === maxUint256 ? "Unlimited (uint256 max)" : `${display(value)} USDG`;
export const maxFee = (amount: bigint, bps: bigint) => (amount * bps + 9999n) / 10000n;

export function decodeBundle(bundle: Bundle): Decoded {
  const [approval, purchase] = bundle.transactions;
  if (bundle.transactions.length !== 2 || !sameAddress(approval.to, CONTRACTS.usdg) || !sameAddress(purchase.to, CONTRACTS.exchange)) {
    return { supported: false, error: "This version checks exactly two calls: USDG.approve followed by the published Orbio Exchange.buyAndActivate." };
  }
  try {
    const a = decodeFunctionData({ abi: tokenAbi, data: approval.data as Hex });
    const b = decodeFunctionData({ abi: exchangeAbi, data: purchase.data as Hex });
    if (a.functionName !== "approve" || b.functionName !== "buyAndActivate") throw new Error("Unexpected method.");
    const [spender, amount] = a.args;
    const [usdgIn, minCreditOut, beneficiary, maxFills] = b.args;
    if (!/^0x0{24}[0-9a-fA-F]{40}$/.test(beneficiary)) throw new Error("Beneficiary is not an address encoded as bytes32.");
    // Reject appended/ambiguous calldata instead of certifying an approximate decoding.
    if (encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: a.args }).toLowerCase() !== approval.data.toLowerCase() || encodeFunctionData({ abi: exchangeAbi, functionName: "buyAndActivate", args: b.args }).toLowerCase() !== purchase.data.toLowerCase()) throw new Error("Non-canonical calldata.");
    return { supported: true, spender, approval: amount.toString(), usdgIn: usdgIn.toString(), minCreditOut: minCreditOut.toString(), beneficiary: `0x${beneficiary.slice(-40)}`, maxFills: maxFills.toString() };
  } catch (e) { return { supported: false, error: e instanceof Error ? e.message : "Cannot decode this bundle." }; }
}

export function evaluate(bundle: Bundle, policy: Policy, decoded: Decoded, quote: Quote, simulation: Simulation): Check[] {
  const checks: Check[] = [];
  const add = (id: string, label: string, ok: boolean, detail: string, expected?: string, actual?: string) => checks.push({ id, label, status: ok ? "pass" : "fail", detail, expected, actual });
  add("scope", "Contract & call sequence", decoded.supported, decoded.supported ? "USDG approval followed by Orbio CREDIT purchase and activation." : decoded.error!);
  add("native-value", "No unintended native transfer", bundle.transactions.every(tx => BigInt(tx.value) === 0n), "These two nonpayable calls should not send native currency.");
  if (!decoded.supported) return checks;
  const d = decoded as Required<Decoded>;
  add("spender", "Approval recipient", sameAddress(d.spender, CONTRACTS.exchange), "Only the published Orbio exchange should receive spending permission.", CONTRACTS.exchange, d.spender);
  add("beneficiary", "Activation beneficiary", sameAddress(d.beneficiary, policy.beneficiary), "Activated inference belongs to the beneficiary encoded in the purchase.", policy.beneficiary, d.beneficiary);
  add("minimum", "Minimum CREDIT received", BigInt(d.minCreditOut) >= units(policy.minCredit) && BigInt(d.minCreditOut) > 0n, "The minimum is enforced by the transaction, not just a displayed quote.", `At least ${policy.minCredit} CREDIT`, `${display(d.minCreditOut)} CREDIT`);
  if ("error" in quote) {
    checks.push({ id: "quote", label: "Price & fee evidence", status: "unknown", detail: quote.error });
    add("allowance-budget", "Approval within spending cap", BigInt(d.approval) <= units(policy.maxSpend), "The permission must not exceed the user's maximum spend.", `At most ${policy.maxSpend} USDG`, allowanceLabel(d.approval));
  } else {
    const ceiling = BigInt(d.usdgIn) + maxFee(BigInt(d.usdgIn), BigInt(quote.feeBps));
    add("budget", "Spend cap, including fees", ceiling <= units(policy.maxSpend) && BigInt(d.usdgIn) > 0n, "Check the encoded maximum input plus fees, even if the current quote fills only part of it.", `At most ${policy.maxSpend} USDG`, `${display(ceiling)} USDG`);
    add("allowance", "Bounded spending permission", BigInt(d.approval) === ceiling, "For this single purchase, approve only its maximum input and protocol fee.", `${display(ceiling)} USDG`, allowanceLabel(d.approval));
    add("liquidity", "Quote covers minimum output", BigInt(quote.creditOut) >= BigInt(d.minCreditOut), "A quote is a snapshot; it does not reserve liquidity.", `${display(d.minCreditOut)} CREDIT`, `${display(quote.creditOut)} CREDIT`);
    add("fills", "Order-book fill limit", BigInt(d.maxFills) > 0n && BigInt(d.maxFills) <= BigInt(quote.maxFills), "The requested maker count must be within the exchange limit.", `1–${quote.maxFills}`, d.maxFills);
  }
  checks.push({ id: "simulation", label: "Sequential execution", status: simulation.status === "unavailable" ? "unknown" : simulation.status, detail: simulation.detail });
  return checks;
}

export function repairBundle(bundle: Bundle, policy: Policy, d: Decoded, quote: Quote) {
  if (!d.supported || "error" in quote || units(policy.minCredit) === 0n) return undefined;
  const input = BigInt(d.usdgIn!);
  const allowance = input + maxFee(input, BigInt(quote.feeBps));
  const minimum = BigInt(d.minCreditOut!) > units(policy.minCredit) ? BigInt(d.minCreditOut!) : units(policy.minCredit);
  // Never invent a different trade size/price to manufacture a passing result.
  if (allowance > units(policy.maxSpend) || BigInt(quote.creditOut) < minimum || input === 0n || BigInt(d.maxFills!) === 0n || BigInt(d.maxFills!) > BigInt(quote.maxFills)) return undefined;
  const fixed: Bundle = { ...bundle, transactions: [
    { to: CONTRACTS.usdg, value: "0x0", data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [CONTRACTS.exchange, allowance] }) },
    { to: CONTRACTS.exchange, value: "0x0", data: encodeFunctionData({ abi: exchangeAbi, functionName: "buyAndActivate", args: [input, minimum, pad(policy.beneficiary as Address), BigInt(d.maxFills!)] }) },
  ] };
  const changes: string[] = [];
  if (d.approval !== allowance.toString()) changes.push(`Set the allowance to ${display(allowance)} USDG.`);
  if (!sameAddress(d.spender!, CONTRACTS.exchange)) changes.push("Use the published Orbio exchange as spender.");
  if (!sameAddress(d.beneficiary!, policy.beneficiary)) changes.push("Activate CREDIT for the intended beneficiary.");
  if (BigInt(d.minCreditOut!) < units(policy.minCredit)) changes.push(`Require at least ${policy.minCredit} CREDIT.`);
  if (bundle.transactions.some(tx => BigInt(tx.value) !== 0n)) changes.push("Remove unintended native value.");
  return changes.length ? { bundle: fixed, changes } : undefined;
}
