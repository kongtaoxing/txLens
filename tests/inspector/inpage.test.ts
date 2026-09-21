import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
type Args = { method: string; params?: unknown[] };
type Provider = { request: (args: Args) => Promise<unknown>; providers?: Provider[]; isOkxWallet?: boolean };
const bundle = await build({ entryPoints: ["extension/inpage.ts"], bundle: true, write: false, format: "iife", platform: "browser" });
function harness(options: { okxOnly?: boolean; late?: boolean; frozen?: boolean; locked?: boolean; getter?: boolean } = {}) {
  const calls: Args[] = [];
  const messages: Record<string, unknown>[] = [];
  let chain = "0x1";
  let interval: () => void = () => {};
  const original = async (args: Args) => { calls.push(args); return args.method === "eth_chainId" ? chain : "wallet-result"; };
  const raw: Provider = { request: original };
  if (options.getter) Object.defineProperty(raw, "request", { get: () => original.bind(raw) });
  if (options.frozen) Object.freeze(raw);
  class TestWindow extends EventTarget {
    declare ethereum?: Provider;
    declare okxwallet?: Provider;
    postMessage(message: Record<string, unknown>) { messages.push(message); }
  }
  const win = new TestWindow();
  const key = options.okxOnly ? "okxwallet" : "ethereum";
  if (!options.late) Object.defineProperty(win, key, { value: raw, configurable: !options.locked, writable: !options.locked, enumerable: true });
  vm.runInNewContext(bundle.outputFiles[0].text, {
    window: win, crypto: { randomUUID: () => `request-${messages.length}` }, Event, CustomEvent,
    setInterval: (fn: () => void) => { interval = fn; }, setTimeout, clearTimeout, console,
  });
  const event = (data: Record<string, unknown>) => {
    const e = new Event("message");
    Object.assign(e, { source: win, data });
    win.dispatchEvent(e);
  };
  event({ channel: "txlens:bridge", type: "ready" });
  const detected: { provider: Provider; info?: { name: string; uuid: string } }[] = [];
  win.addEventListener("eip6963:announceProvider", (e) => detected.push((e as CustomEvent).detail));
  const probe = () => {
    event({ channel: "txlens:bridge", type: "probe", id: "probe" });
    return messages.filter((m) => m.type === "probe-result").at(-1)!.providers as { name: string; active: boolean; partial: boolean; observed: boolean; paths: unknown[] }[];
  };
  return {
    raw, original, win, calls, messages, event, interval, probe, detected,
    get provider() { return win[key]!; },
    chain: (v: string) => { chain = v; },
    inject: () => { win[key] = raw; },
    announce: (provider: Provider, name = "Test wallet", uuid = name) => {
      const detail = Object.freeze({ provider, info: Object.freeze({ name, uuid }) });
      win.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
      return detected.at(-1)!.provider;
    },
    decide: (approved: boolean) => {
      const review = messages.filter((m) => m.type === "review").at(-1)!;
      assert(review, "a review must arrive before the wallet request is forwarded");
      event({ channel: "txlens:bridge", type: "decision", id: review.id, approved });
    },
    reviews: () => messages.filter((m) => m.type === "review"),
    dispose: () => win.dispatchEvent(new Event("pagehide")),
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
test("read-only and connection calls pass through without review", async () => {
  const h = harness();
  for (const method of ["eth_accounts", "eth_requestAccounts", "eth_chainId"])
    await h.provider.request({ method });
  assert.equal(h.calls.length, 3);
  assert.equal(h.reviews().length, 0);
});
test("review snapshots parameters, waits and forwards exactly once", async () => {
  const h = harness();
  const args = { method: "eth_sendTransaction", params: [{ to: "original" }] };
  const pending = h.provider.request(args);
  await tick();
  assert(!h.calls.some((c) => c.method === args.method));
  args.params[0].to = "mutated";
  h.decide(true);
  assert.equal(await pending, "wallet-result");
  assert.equal(h.calls.filter((c) => c.method === args.method).length, 1);
  assert.equal((h.calls.at(-1)!.params![0] as { to: string }).to, "original");
});
test("cancel rejects with 4001 and never reaches the wallet", async () => {
  const h = harness();
  const pending = h.provider.request({ method: "personal_sign", params: ["hello"] });
  await tick(); h.decide(false);
  await assert.rejects(pending, { code: 4001 });
  assert(!h.calls.some((c) => c.method === "personal_sign"));
});
test("network change cancels before forwarding", async () => {
  const h = harness();
  const pending = h.provider.request({ method: "eth_sendTransaction", params: [] });
  await tick(); h.chain("0x2105"); h.decide(true);
  await assert.rejects(pending, { code: 4001 });
  assert(!h.calls.some((c) => c.method === "eth_sendTransaction"));
});
test("EIP-6963 keeps wallet identity and frozen announcements, without duplicates", async () => {
  const h = harness({ late: true, frozen: true });
  const first = h.announce(h.raw, "OKX Wallet");
  const second = h.announce(h.raw, "OKX Wallet");
  assert.equal(first, second);
  assert.equal(h.detected.length, 2);
  assert.equal(h.detected[0].info!.name, "OKX Wallet");
  assert.equal(Object.isFrozen(h.detected[0]), true);
  const pending = first.request({ method: "personal_sign" });
  await tick(); h.decide(true);
  assert.equal(await pending, "wallet-result");
  assert.equal(h.reviews().length, 1);
  assert.equal(h.calls.length, 3);
});
test("readonly OKX-only Base approval is reviewed before the original wallet", async () => {
  const h = harness({ okxOnly: true, frozen: true });
  h.chain("0x2105");
  const pending = h.provider.request({ method: "eth_sendTransaction", params: [{ to: "0x1111111111111111111111111111111111111111", data: "0x095ea7b3" }] });
  await tick();
  assert.equal((h.reviews()[0].request as { chainId: string }).chainId, "0x2105");
  h.decide(false);
  await assert.rejects(pending, { code: 4001 });
  assert.equal(h.calls.filter((c) => c.method === "eth_sendTransaction").length, 0);
});
test("late ordinary injection is found without preoccupying wallet globals", async () => {
  const h = harness({ late: true, okxOnly: true });
  assert.equal("ethereum" in h.win, false);
  assert.equal("okxwallet" in h.win, false);
  h.inject(); h.interval();
  const pending = h.provider.request({ method: "personal_sign" });
  await tick(); h.decide(true); await pending;
  assert.equal(h.reviews().length, 1);
});
test("defineProperty injection is found on the initialized event", async () => {
  const h = harness({ late: true, okxOnly: true });
  Object.defineProperty(h.win, "okxwallet", { configurable: true, value: h.raw });
  h.win.dispatchEvent(new Event("ethereum#initialized"));
  const pending = h.provider.request({ method: "personal_sign" });
  await tick(); h.decide(false);
  await assert.rejects(pending, { code: 4001 });
});
test("probe has zero wallet RPCs and does not claim actual request validation", () => {
  const h = harness({ okxOnly: true });
  const rows = h.probe();
  assert.equal(rows[0].name, "OKX Wallet");
  assert.equal(rows[0].active, true);
  assert.equal(rows[0].observed, false);
  assert.equal(h.calls.length, 0);
});
test("frozen original stays unchanged while configurable entry is guarded", () => {
  const h = harness({ okxOnly: true, frozen: true });
  assert.notEqual(h.provider, h.raw);
  assert.equal(h.raw.request, h.original);
  assert.equal(Object.isFrozen(h.raw), true);
  assert.equal(h.probe()[0].active, true);
});
test("locked global remains untouched and reports no attachment", () => {
  const h = harness({ okxOnly: true, frozen: true, locked: true });
  assert.equal(h.provider, h.raw);
  assert.equal(h.probe()[0].active, false);
  assert.equal(h.calls.length, 0);
});
test("fresh bound request getter does not cause false negatives or repeated wrapping", async () => {
  const h = harness({ okxOnly: true, getter: true });
  const provider = h.provider;
  for (let i = 0; i < 5; i++) { h.interval(); assert.equal(h.probe()[0].active, true); }
  assert.equal(h.provider, provider);
  const pending = h.provider.request({ method: "personal_sign" });
  await tick(); h.decide(true); await pending;
  assert.equal(h.reviews().length, 1);
  assert.equal(h.calls.length, 3);
});
test("multiple wallets keep their identity and only the selected OKX receives the request", async () => {
  const h = harness({ late: true, frozen: true });
  let otherCalls = 0;
  const other = { request: async () => { otherCalls++; return "other"; } };
  const a = h.announce(other, "Phantom");
  const b = h.announce(h.raw, "OKX Wallet");
  assert.notEqual(a, b);
  assert.deepEqual(h.detected.map((d) => d.info!.name), ["Phantom", "OKX Wallet"]);
  const pending = b.request({ method: "personal_sign" });
  await tick(); h.decide(true); await pending;
  assert.equal(otherCalls, 0);
  assert.equal(h.calls.filter((c) => c.method === "personal_sign").length, 1);
});
test("same wallet aliases share one facade and one row; partial coverage stays visible", () => {
  const h = harness({ okxOnly: true, frozen: true, locked: true });
  h.win.ethereum = h.raw;
  h.announce(h.raw, "OKX Wallet");
  const rows = h.probe();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].active, false);
  assert.equal(rows[0].partial, true);
  assert.equal(rows[0].paths.length, 3);
  assert.equal(h.win.okxwallet, h.raw);
});
test("global getter/setter continue to select the intended wallet; wallet methods keep this", async () => {
  const h = harness({ late: true });
  class Wallet {
    #chain = "0x2105";
    request = async () => this.#chain;
    on() { return this.#chain; }
  }
  const raw = new Wallet();
  let selected: Provider = raw;
  Object.defineProperty(h.win, "ethereum", { configurable: true, get: () => selected, set: (next) => { selected = next; } });
  h.interval();
  assert.equal(await h.provider.request({ method: "eth_chainId" }), "0x2105");
  assert.equal((h.provider as unknown as Wallet).on(), "0x2105");
  h.win.ethereum = h.raw;
  assert.equal(selected, h.raw);
  assert.equal(await h.provider.request({ method: "eth_accounts" }), "wallet-result");
});
test("mutable wallet originals are not monkey-patched and stale globals disappear", () => {
  const h = harness({ okxOnly: true });
  assert.equal(h.raw.request, h.original);
  delete h.win.okxwallet;
  assert.equal(h.probe().length, 0);
});
test("pagehide cancels a pending request and never calls the wallet", async () => {
  const h = harness();
  const pending = h.provider.request({ method: "personal_sign" });
  await tick(); h.dispose();
  await assert.rejects(pending, { code: 4001 });
  assert.equal(h.calls.filter((c) => c.method === "personal_sign").length, 0);
});

test("wallet provider lists preserve default identity and guard the selected child", async () => {
  const h = harness();
  let childCalls = 0;
  const child = Object.freeze({ isOkxWallet: true, request: async (args: Args) => { if (args.method === "eth_chainId") return "0x2105"; childCalls++; return "okx-result"; } });
  h.raw.providers = [h.raw, child];
  h.interval();
  assert.equal(h.raw.providers[1], child);
  const selected = h.provider.providers![1];
  const pending = selected.request({ method: "personal_sign" });
  await tick(); h.decide(true);
  assert.equal(await pending, "okx-result");
  assert.equal(childCalls, 1);
  assert.equal(h.calls.length, 0);
});
