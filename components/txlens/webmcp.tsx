"use client";
import { useEffect, useRef } from "react";
import { reviewSchema, type ReviewInput, type ReviewReport } from "@/lib/txlens/types";
type Context = { registerTool: (tool: { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };
export function ReviewTools({ report, stage }: { report: ReviewReport | null; stage: (input: ReviewInput) => void }) {
  const current = useRef({ report, stage });
  useEffect(() => { current.current = { report, stage }; }, [report, stage]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      { name: "txlens_get_report", description: "Read the current visible review. No model call or transaction is made.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => current.current.report ?? { status: "No review yet" } },
      { name: "txlens_stage_review", description: "Fill the visible form. Does not start paid analysis or send a transaction. The user can review then click Analyze.", inputSchema: { type: "object", properties: { intent: { type: "string" }, policy: { type: "object", properties: { maxSpend: { type: "string" }, minCredit: { type: "string" }, beneficiary: { type: "string" } }, required: ["maxSpend", "minCredit", "beneficiary"] }, bundle: { type: "object", properties: { chainId: { type: "number", const: 4663 }, from: { type: "string" }, transactions: { type: "array", items: { type: "object" } } }, required: ["chainId", "from", "transactions"] }, mode: { type: "string", enum: ["demo", "live"] } }, required: ["intent", "policy", "bundle", "mode"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: (data: unknown) => { const input = reviewSchema.parse(data); current.current.stage(input); return { status: "staged", mode: input.mode, transactions: input.bundle.transactions.length }; } },
    ];
    for (const tool of tools) { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability. */ } }
    return () => lifecycle.abort();
  }, []);
  return null;
}
