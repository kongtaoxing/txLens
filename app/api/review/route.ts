export const runtime = "nodejs";
export const maxDuration = 200;
import { getConfig } from "@/lib/txlens/ai";
import { review } from "@/lib/txlens/review";
import { reviewSchema, type ReviewEvent } from "@/lib/txlens/types";

export async function POST(request: Request) {
  let input;
  try {
    const body = await request.text();
    if (body.length > 64000) return Response.json({ error: "Transaction bundle is too large." }, { status: 413 });
    input = reviewSchema.parse(JSON.parse(body));
  } catch { return Response.json({ error: "Check the intent, amount fields, wallet addresses and bundle JSON. Only chain 4663 is supported." }, { status: 400 }); }
  const values = process.env;
  const config = { ...getConfig(values), rpcUrl: String(values.ROBINHOOD_RPC_URL || "") };
  const encoder = new TextEncoder();
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(180000)]);
  const stream = new ReadableStream({
    async start(streamController) {
      const send = (event: ReviewEvent) => { if (!controller.signal.aborted) streamController.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
      try { send({ type: "result", report: await review(input, config, signal, step => send({ type: "step", step })) }); }
      catch (error) { if (!controller.signal.aborted) send({ type: "error", message: signal.aborted ? "Analysis stopped or timed out." : error instanceof Error ? error.message : "Analysis failed." }); }
      finally { if (!controller.signal.aborted) streamController.close(); }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
