import { encodeFunctionData, maxUint256, pad, parseUnits, type Address } from "viem";
import { CONTRACTS, exchangeAbi, tokenAbi } from "./contracts";
import type { Bundle, Policy } from "./types";

export const DEMO_WALLET = "0x1111111111111111111111111111111111111111";
export const defaultPolicy: Policy = { maxSpend: "5", minCredit: "10", beneficiary: DEMO_WALLET };
export const defaultIntent = "Spend at most 5 USDG, including the protocol fee, to buy and activate at least 10 CREDIT for my agent wallet. Give the exchange only the allowance this purchase needs.";
export function makeBundle(approval = parseUnits("4.1", 6), beneficiary = DEMO_WALLET): Bundle {
  return { chainId: 4663, from: DEMO_WALLET, transactions: [
    { to: CONTRACTS.usdg, value: "0x0", data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [CONTRACTS.exchange, approval] }) },
    { to: CONTRACTS.exchange, value: "0x0", data: encodeFunctionData({ abi: exchangeAbi, functionName: "buyAndActivate", args: [parseUnits("4", 6), parseUnits("10", 6), pad(beneficiary as Address), 10n] }) },
  ] };
}
export const scenarios = [
  { id: "excess-approval", name: "Excess approval", description: "The purchase looks right. The permission does not.", bundle: makeBundle(maxUint256) },
  { id: "wrong-wallet", name: "Wrong recipient", description: "The credits would go to a different wallet.", bundle: makeBundle(parseUnits("4.1", 6), "0x2222222222222222222222222222222222222222") },
  { id: "matching", name: "Matching intent", description: "A bounded approval and the intended recipient.", bundle: makeBundle() },
] as const;
