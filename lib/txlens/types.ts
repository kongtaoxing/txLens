import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Use a 20-byte EVM address.");
const amount = z.string().regex(/^\d{1,18}(\.\d{1,6})?$/, "Use a non-negative amount with at most 6 decimals.");
export const bundleSchema = z.object({
  chainId: z.literal(4663),
  from: address,
  transactions: z.array(z.object({
    to: address,
    data: z.string().regex(/^0x([0-9a-fA-F]{2})+$/, "Use hex calldata."),
    value: z.string().regex(/^(0x[0-9a-fA-F]+|\d+)$/).default("0x0"),
  })).min(1).max(3),
});
export const policySchema = z.object({ maxSpend: amount, minCredit: amount, beneficiary: address });
export const reviewSchema = z.object({
  intent: z.string().min(10).max(2000),
  policy: policySchema,
  bundle: bundleSchema,
  mode: z.enum(["demo", "live"]),
});
export type Bundle = z.infer<typeof bundleSchema>;
export type Policy = z.infer<typeof policySchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type Check = { id: string; label: string; status: "pass" | "fail" | "unknown"; detail: string; expected?: string; actual?: string };
export type Decoded = { supported: boolean; error?: string; spender?: string; approval?: string; usdgIn?: string; minCreditOut?: string; beneficiary?: string; maxFills?: string };
export type Quote = { source: "fixture" | "rpc"; creditOut: string; usdgSpent: string; fee: string; feeBps: string; maxFills: string; block: string } | { source: "fixture" | "rpc"; error: string };
export type Simulation = { status: "pass" | "fail" | "unavailable"; source: "fixture" | "rpc"; detail: string; block?: string };
export type Trace = { tool: string; label: string; detail: string; source: string; durationMs: number };
export type ReviewReport = {
  id: string; createdAt: string; mode: ReviewInput["mode"]; verdict: "matches" | "mismatch" | "incomplete";
  checks: Check[]; decoded: Decoded; quote: Quote; simulation: Simulation; trace: Trace[];
  explanation: string; provider: string; model: string; modelCalls: number; tokens: number;
  repair?: { bundle: Bundle; changes: string[] }; aiError?: string;
};
export type ReviewEvent = { type: "step"; step: Trace } | { type: "result"; report: ReviewReport } | { type: "error"; message: string };
