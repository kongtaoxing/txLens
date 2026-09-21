import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST, OPTIONS } from "../../app/api/explain/route";
import { GET as status } from "../../app/api/status/route";
import { examples } from "../../lib/inspector/examples";

const origin = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const request = (body: unknown, from = origin) => new Request("https://txlens.example/api/explain", {
  method: "POST", headers: { origin: from, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("Node API reads runtime environment, keeps the key private, and handles missing configuration", async (t) => {
  const names = ["AI_API_KEY", "AI_MODEL", "AI_BASE_URL", "AI_PROVIDER_LABEL"] as const;
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => { for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; } });
  t.mock.method(globalThis, "fetch", async () => { throw Error("No network expected in status/input tests"); });
  delete process.env.AI_API_KEY;
  process.env.AI_MODEL = "test-model";
  process.env.AI_BASE_URL = "https://api.orbio.so/api/v1";
  assert.equal((await GET(new Request("https://txlens.example/api/explain")).json()).aiConfigured, false);
  assert.equal((await POST(request({ locale: "en", request: examples[0] }))).status, 503);
  process.env.AI_API_KEY = "test-only-key-do-not-use";
  const result = await GET(new Request("https://txlens.example/api/explain", { headers: { origin } }));
  assert.equal(result.headers.get("Access-Control-Allow-Origin"), origin);
  const data = await result.json();
  assert.equal(data.aiConfigured, true);
  assert.equal(data.serviceUrl, "https://txlens.example");
  assert.equal(JSON.stringify(data).includes(process.env.AI_API_KEY), false);
  assert.equal((await status().json()).orbio, true);
  assert.equal((await POST(request({ locale: "fr", request: examples[0] }))).status, 400);
});

test("Node API accepts extension preflight and rejects unrelated website origins", async () => {
  const preflight = OPTIONS(new Request("https://txlens.example/api/explain", { method: "OPTIONS", headers: { origin } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(OPTIONS(new Request("https://txlens.example/api/explain", { headers: { origin: "https://unrelated.example" } })).status, 403);
  assert.equal((await POST(request({}, "https://unrelated.example"))).status, 403);
});

test("Node API sends server configuration to the model and returns the structured explanation", async (t) => {
  const previous = { ...process.env };
  t.after(() => { for (const name of ["AI_API_KEY", "AI_MODEL", "AI_BASE_URL", "AI_PROVIDER_LABEL"]) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } });
  process.env.AI_API_KEY = "test-only-key-do-not-use";
  process.env.AI_MODEL = "test-model";
  process.env.AI_BASE_URL = "https://api.orbio.so/api/v1";
  process.env.AI_PROVIDER_LABEL = "Orbio";
  const details = { action: "Review this transfer.", effect: "Tokens go to the recipient.", check: "Confirm the recipient." };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(url, "https://api.orbio.so/api/v1/chat/completions");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-only-key-do-not-use");
    assert.equal(JSON.parse(String(init.body)).model, "test-model");
    return Response.json({ choices: [{ message: { role: "assistant", content: JSON.stringify(details) } }] });
  });
  const result = await POST(request({ locale: "en", request: examples[1] }));
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body.details, details);
  assert.equal(body.orbio, true);
  assert.equal(calls, 1);
});
