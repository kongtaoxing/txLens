import assert from "node:assert/strict";
import test from "node:test";
import { review } from "../../lib/txlens/review";
import { defaultIntent, defaultPolicy, scenarios } from "../../lib/txlens/fixtures";

test("agent executes selected tools, then grounds final answer in deterministic evidence", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++; const body = JSON.parse(options!.body as string);
    if (calls === 1) { assert.equal(body.model, "test-model"); return Response.json({ data: { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "tool-1", type: "function", function: { name: "verify_intent", arguments: "{}" } }] } }], usage: { total_tokens: 30 } } }); }
    assert.match(body.messages[1].content, /"allowance"/);
    return Response.json({ choices: [{ message: { role: "assistant", content: "The approval is excessive. Demo execution is unverified." } }], usage: { total_tokens: 20 } });
  };
  try {
    const result = await review({ intent: defaultIntent, policy: defaultPolicy, bundle: scenarios[0].bundle, mode: "demo" }, { baseUrl: "https://test.invalid/v1", apiKey: "test-only", model: "test-model", provider: "Test", rpcUrl: "" }, new AbortController().signal, () => {});
    assert.equal(result.verdict, "mismatch"); assert.equal(result.modelCalls, 2); assert.equal(result.tokens, 50); assert.equal(result.trace.length, 4); assert.ok(result.repair);
  } finally { globalThis.fetch = original; }
});
test("model failure is visible while deterministic checks still run", async () => {
  const result = await review({ intent: defaultIntent, policy: defaultPolicy, bundle: scenarios[0].bundle, mode: "demo" }, { baseUrl: "https://test.invalid/v1", apiKey: "", model: "", provider: "Test", rpcUrl: "" }, new AbortController().signal, () => {});
  assert.ok(result.aiError); assert.equal(result.modelCalls, 0); assert.equal(result.verdict, "mismatch");
});
