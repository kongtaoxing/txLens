import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import { examples } from "../../lib/inspector/examples";
const bundle = await build({
  entryPoints: ["extension/background.ts"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
});
function setup() {
  const local: Record<string, unknown> = {},
    session: Record<string, unknown> = {},
    alarms = new Set<string>();
  const sent: unknown[] = [];
  const closed: number[] = [];
  const events: Record<string, (...args: unknown[]) => unknown> = {};
  let count = 0;
  const store = (data: Record<string, unknown>) => ({
    get: async (key: string | null) =>
      key ? { [key]: data[key] } : { ...data },
    set: async (value: Record<string, unknown>) => Object.assign(data, value),
    remove: async (key: string) => {
      delete data[key];
    },
  });
  const on = (name: string) => ({
    addListener: (callback: (...args: unknown[]) => unknown) => {
      events[name] = callback;
    },
  });
  const root = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/";
  const chrome = {
    storage: { local: store(local), session: store(session) },
    runtime: {
      id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      getURL: (path: string) => root + path,
      onMessage: on("message"),
      onInstalled: on("install"),
    },
    tabs: {
      sendMessage: async (...args: unknown[]) => {
        sent.push(args);
      },
      onRemoved: on("tabRemoved"),
      onUpdated: on("tabUpdated"),
    },
    windows: {
      create: async () => ({ id: ++count }),
      get: async (id: number) => ({ id }),
      remove: async (id: number) => {
        closed.push(id);
      },
      onRemoved: on("windowRemoved"),
    },
    alarms: {
      create: async (id: string) => {
        alarms.add(id);
      },
      clear: async (id: string) => {
        alarms.delete(id);
      },
      onAlarm: on("alarm"),
    },
    i18n: { getUILanguage: () => "en" },
  };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    chrome,
    URL,
    Date,
    crypto: { randomUUID: () => `id-${count}` },
    fetch: () => {
      throw Error("no network in test");
    },
  });
  const dispatch = (message: object, sender: object) =>
    new Promise<Record<string, unknown>>((resolve) => {
      events.message(message, sender, resolve);
    });
  const page = {
    tab: { id: 7 },
    frameId: 0,
    documentId: "doc1",
    url: "https://real-site.example/swap",
  };
  const ui = { id: chrome.runtime.id, url: root + "index.html?review=id-0" };
  return { local, session, alarms, sent, closed, events, dispatch, page, ui };
}
async function queue(h: ReturnType<typeof setup>) {
  const result = await h.dispatch(
    { type: "review", id: "page-id", request: examples[0] },
    h.page,
  );
  assert.equal(result.queued, true);
  return "id-0";
}
test("request origin comes from browser sender, never page payload", async () => {
  const h = setup();
  const id = await queue(h);
  const result = await h.dispatch({ type: "get", id }, h.ui);
  assert.equal(
    (result.item as { request: { origin: string } }).request.origin,
    "https://real-site.example",
  );
});
test("web page cannot approve a pending review; extension UI can approve once", async () => {
  const h = setup();
  const id = await queue(h);
  assert.equal(
    (await h.dispatch({ type: "decide", id, approved: true }, h.page)).error,
    "untrusted sender",
  );
  assert.equal(h.sent.length, 0);
  assert.equal(
    (await h.dispatch({ type: "decide", id, approved: true }, h.ui)).ok,
    true,
  );
  assert.equal(h.sent.length, 1);
  assert.equal(
    (await h.dispatch({ type: "decide", id, approved: true }, h.ui)).ok,
    false,
  );
  assert.equal(h.sent.length, 1);
  assert.equal(h.session["pending:" + id], undefined);
});
test("closing the review window cancels and removes transient data", async () => {
  const h = setup();
  await queue(h);
  await h.events.windowRemoved(1);
  assert.equal(h.session["pending:id-0"], undefined);
  assert.equal(
    (h.sent[0] as unknown[])[1] &&
      ((h.sent[0] as unknown[])[1] as { approved: boolean }).approved,
    false,
  );
  assert.equal(h.alarms.size, 0);
});
test("navigation cancels the old document request", async () => {
  const h = setup();
  await queue(h);
  await h.events.tabUpdated(7, { status: "loading" });
  assert.equal(h.session["pending:id-0"], undefined);
  assert.equal(h.sent.length, 1);
});
test("pause bypasses review for exact origin only", async () => {
  const h = setup();
  h.local.settings = { paused: { "https://real-site.example": -1 } };
  const result = await h.dispatch(
    { type: "review", id: "p", request: examples[0] },
    h.page,
  );
  assert.equal(result.approved, true);
  assert.equal(Object.keys(h.session).length, 0);
});
test("approving with pause persists 15 minute pause; cancelling does not", async () => {
  const h = setup();
  const id = await queue(h);
  await h.dispatch({ type: "decide", id, approved: true, pause: true }, h.ui);
  const settings = h.local.settings as { paused: Record<string, number> };
  assert(settings.paused["https://real-site.example"] > Date.now());
  const other = setup();
  const otherId = await queue(other);
  await other.dispatch(
    { type: "decide", id: otherId, approved: false, pause: true },
    other.ui,
  );
  assert.equal(other.local.settings, undefined);
});

test("fresh installs use the public AI backend", async () => {
  const h = setup();
  await h.events.install();
  assert.equal((h.local.settings as { serviceUrl: string }).serviceUrl, "https://tx-lens.vercel.app");
});

test("upgrades replace the legacy localhost backend and keep site pauses", async () => {
  const h = setup();
  const paused = { "https://paused.example": -1 };
  h.local.settings = { serviceUrl: "http://localhost:5173", paused };
  await h.events.install();
  assert.equal((h.local.settings as { serviceUrl: string }).serviceUrl, "https://tx-lens.vercel.app");
  assert.deepEqual((h.local.settings as { paused: object }).paused, paused);
});

test("an existing install uses the public backend even without an update event", async () => {
  const h = setup();
  h.local.settings = { serviceUrl: "http://127.0.0.1:5173", paused: {} };
  const id = await queue(h);
  const result = await h.dispatch({ type: "get", id }, h.ui);
  assert.equal((result.settings as { serviceUrl: string }).serviceUrl, "https://tx-lens.vercel.app");
  assert.equal((h.local.settings as { serviceUrl: string }).serviceUrl, "https://tx-lens.vercel.app");
});

test("upgrades retain a custom HTTPS backend", async () => {
  const h = setup();
  h.local.settings = { serviceUrl: "https://my-txlens.example", paused: {} };
  await h.events.install();
  assert.equal((h.local.settings as { serviceUrl: string }).serviceUrl, "https://my-txlens.example");
});

test("explicit development overrides are not migrated", async () => {
  const h = setup();
  h.local.settings = { serviceUrl: "http://localhost:5173", serviceMode: "custom", paused: {} };
  await h.events.install();
  assert.equal((h.local.settings as { serviceUrl: string }).serviceUrl, "http://localhost:5173");
});
