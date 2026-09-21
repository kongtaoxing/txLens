export const runtime = "nodejs";
export const maxDuration = 120;
import { z } from "zod";
import { getConfig } from "@/lib/txlens/ai";
import { requestMethods } from "@/lib/inspector/model";
import { explainRequest } from "@/lib/inspector/explain";
const schema = z.object({
  locale: z.enum(["zh", "en"]),
  request: z.object({
    method: z.string().refine((m) => requestMethods.includes(m)),
    params: z.array(z.unknown()),
    chainId: z.string().max(80),
    origin: z.string().url().max(2048),
  }),
});
function allowed(req: Request) {
  const origin = req.headers.get("origin");
  return (
    !origin ||
    origin === new URL(req.url).origin ||
    /^chrome-extension:\/\/[a-p]{32}$/.test(origin)
  );
}
function headers(req: Request) {
  return {
    "Cache-Control": "no-store",
    Vary: "Origin",
    ...(req.headers.get("origin")
      ? { "Access-Control-Allow-Origin": req.headers.get("origin")! }
      : {}),
  };
}
export function GET(req: Request) {
  if (!allowed(req)) return Response.json({ error: "origin" }, { status: 403 });
  const config = getConfig(process.env);
  return Response.json({
    service: "TxLens",
    status: "online",
    aiConfigured: Boolean(config.apiKey && config.model),
    message: "服务在线。请在插件的审阅窗口点击 AI 解释；直接打开本页不会发起分析。",
    messageEn: "The service is online. Use the AI explanation button in the extension review window; opening this page does not run an analysis.",
    serviceUrl: new URL(req.url).origin,
    analysisMethod: "POST",
    aiConnection: "not_checked_by_this_status_request",
  }, { headers: headers(req) });
}
export function OPTIONS(req: Request) {
  if (!allowed(req)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      ...headers(req),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
export async function POST(req: Request) {
  if (!allowed(req)) return Response.json({ error: "origin" }, { status: 403 });
  let input;
  try {
    const body = await req.text();
    if (body.length > 64000)
      return Response.json(
        { error: "size" },
        { status: 413, headers: headers(req) },
      );
    input = schema.parse(JSON.parse(body));
  } catch {
    return Response.json(
      { error: "input" },
      { status: 400, headers: headers(req) },
    );
  }
  const config = getConfig(process.env);
  if (!config.apiKey || !config.model)
    return Response.json(
      { error: "unconfigured" },
      { status: 503, headers: headers(req) },
    );
  try {
    const result = await explainRequest(input.request, input.locale, config,
      AbortSignal.any([req.signal, AbortSignal.timeout(110000)]));
    const host = new URL(config.baseUrl).hostname;
    return Response.json(
      {
        ...result,
        provider: config.provider,
        orbio: host === "orbio.so" || host.endsWith(".orbio.so"),
      },
      { headers: headers(req) },
    );
  } catch (error) {
    console.warn("AI explanation unavailable:", error instanceof Error ? error.message : "Unknown provider error");
    return Response.json(
      { error: "service" },
      { status: 502, headers: headers(req) },
    );
  }
}
