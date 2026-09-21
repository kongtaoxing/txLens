import { env } from "cloudflare:workers";
import { getConfig } from "@/lib/txlens/ai";
export function GET() {
  const config = getConfig(env as Record<string, unknown>);
  const host = new URL(config.baseUrl).hostname;
  return Response.json({ configured: Boolean(config.apiKey && config.model), provider: config.provider, model: config.model, orbio: host === "orbio.so" || host.endsWith(".orbio.so") }, { headers: { "Cache-Control": "no-store" } });
}
