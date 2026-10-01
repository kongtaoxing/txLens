import { ArcReadError, readArcTransaction, transactionHash } from "@/lib/inspector/arc-rpc";

export const runtime = "nodejs";
export const maxDuration = 20;
export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get("hash") || undefined;
  const headers = { "Cache-Control": "no-store" };
  if (hash && !transactionHash.safeParse(hash).success)
    return Response.json({ error: "invalid-hash" }, { status: 400, headers });
  try {
    return Response.json(await readArcTransaction(hash), { headers });
  } catch (error) {
    const code = error instanceof ArcReadError ? error.code : "unavailable";
    return Response.json({ error: code }, { status: code === "not-found" ? 404 : 503, headers });
  }
}
