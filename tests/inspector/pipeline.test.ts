import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { examples } from "../../lib/inspector/examples";
const bundles = await Promise.all(["inpage", "bridge", "background"].map(async (name) => {
  const result = await build({ entryPoints: [`extension/${name}.ts`], bundle: true, write: false, format: "iife" });
  return result.outputFiles[0].text;
}));
function setup() {
  const local: Record<string, unknown> = {}, session: Record<string, unknown> = {};
  const events: Record<string, (...args: unknown[]) => unknown> = {};
  const windows: { id: number; url: string }[] = [];
  const calls: { method: string; params?: unknown[] }[] = [];
  let count = 0;
  let failWindow = false;
  const store = (data: Record<string, unknown>) => ({ get: async (key: string | null) => key ? { [key]: data[key] } : { ...data }, set: async (value: object) => Object.assign(data, value), remove: async (key: string) => { delete data[key]; } });
  const on = (name: string) => ({ addListener: (callback: (...args: unknown[]) => unknown) => { events[name] = callback; } });
  const root = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/";
  const page = { tab: { id: 7 }, frameId: 0, documentId: "doc1", url: "https://basescan.org/token/test" };
  const dispatch = (message: object, sender: object) => new Promise<Record<string, unknown>>((resolve) => { events.background(message, sender, resolve); });
  const chrome = {
    storage: { local: store(local), session: store(session) },
    runtime: { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", getURL: (path: string) => root + path, onMessage: on("background"), onInstalled: on("installed") },
    tabs: { sendMessage: async (_id: number, message: unknown) => events.bridge(message, {}, () => {}), onRemoved: on("tabRemoved"), onUpdated: on("tabUpdated") },
    windows: {
      create: async ({ url }: { url: string }) => { if (failWindow) throw Error("window unavailable"); const win = { id: ++count, url }; windows.push(win); return win; },
      get: async (id: number) => ({ id }), remove: async (id: number) => { const index = windows.findIndex((w) => w.id === id); if (index >= 0) windows.splice(index, 1); }, onRemoved: on("windowRemoved"),
    },
    alarms: { create: async () => {}, clear: async () => {}, onAlarm: on("alarm") },
    i18n: { getUILanguage: () => "zh" },
  };
  class TestWindow extends EventTarget {
    okxwallet = Object.freeze({ request: async (args: { method: string; params?: unknown[] }) => { calls.push(args); return args.method === "eth_chainId" ? "0x2105" : "wallet-result"; } });
    postMessage(data: unknown) { queueMicrotask(() => { const event = new Event("message"); Object.assign(event, { data, source: this }); this.dispatchEvent(event); }); }
  }
  const win = new TestWindow();
  const common = { URL, Date, Event, CustomEvent, crypto: { randomUUID }, setTimeout, clearTimeout, console };
  vm.runInNewContext(bundles[2], { ...common, chrome });
  vm.runInNewContext(bundles[0], { ...common, window: win, setInterval: () => {} });
  vm.runInNewContext(bundles[1], { ...common, window: win, chrome: { runtime: { onMessage: on("bridge"), sendMessage: (message: object) => dispatch(message, page) } } });
  const decide = (approved: boolean) => {
    assert.equal(windows.length, 1);
    const url = windows[0].url;
    return dispatch({ type: "decide", id: new URL(url).searchParams.get("review"), approved }, { id: chrome.runtime.id, url });
  };
  const request = () => win.okxwallet.request({ method: examples[0].method, params: examples[0].params });
  const probe = () => new Promise<{ connected: boolean; providers: { name: string; observed: boolean }[] }>((resolve) => { events.bridge({ type: "probe" }, {}, resolve); });
  return { local, session, windows, calls, events, decide, request, probe, failWindow: () => { failWindow = true; } };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
test("full inpage → bridge → background → review → cancel pipeline", async () => {
  const h = setup(); await tick();
  const before = await h.probe(); assert.equal(before.connected, true); assert.equal(before.providers[0].observed, false); assert.equal(h.calls.length, 0);
  const pending = h.request(); await tick();
  assert.equal(h.windows.length, 1); assert.equal(h.calls.filter((c) => c.method === "eth_sendTransaction").length, 0);
  const item = Object.values(h.session).find((value) => (value as { request?: unknown }).request) as { request: { origin: string; chainId: string } };
  assert.equal(item.request.origin, "https://basescan.org"); assert.equal(item.request.chainId, "0x2105");
  await h.decide(false); await assert.rejects(pending, { code: 4001 });
  assert.equal(h.windows.length, 0); assert.equal(Object.keys(h.session).length, 0); assert.equal((await h.probe()).providers[0].observed, true);
  assert.equal(h.calls.filter((c) => c.method === "eth_sendTransaction").length, 0);
});
test("full pipeline continues once with unchanged reviewed parameters", async () => {
  const h = setup(); await tick(); const pending = h.request(); await tick(); await h.decide(true);
  assert.equal(await pending, "wallet-result");
  const sent = h.calls.filter((c) => c.method === "eth_sendTransaction"); assert.equal(sent.length, 1); assert.equal(JSON.stringify(sent[0].params), JSON.stringify(examples[0].params));
});
test("full pipeline closes review as cancellation", async () => {
  const h = setup(); await tick(); const pending = h.request(); await tick();
  await h.events.windowRemoved(h.windows[0].id); await assert.rejects(pending, { code: 4001 });
  assert.equal(h.calls.filter((c) => c.method === "eth_sendTransaction").length, 0);
});
test("full pipeline pause bypasses review and resume restores interception", async () => {
  const h = setup(); await tick();
  h.local.settings = { paused: { "https://basescan.org": -1 } };
  assert.equal(await h.request(), "wallet-result"); assert.equal(h.windows.length, 0);
  h.local.settings = { paused: {} };
  const pending = h.request(); await tick(); await h.decide(false); await assert.rejects(pending, { code: 4001 });
  assert.equal(h.calls.filter((c) => c.method === "eth_sendTransaction").length, 1);
});
test("popup creation failure cancels rather than silently forwarding", async () => {
  const h = setup(); await tick(); h.failWindow();
  await assert.rejects(h.request(), { code: 4001 }); assert.equal(Object.keys(h.session).length, 0);
  assert.equal(h.calls.filter((c) => c.method === "eth_sendTransaction").length, 0);
});
