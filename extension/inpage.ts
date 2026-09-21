import { requestMethods } from "../lib/inspector/model";
type Args = { method: string; params?: unknown[] };
type Provider = { request: (args: Args) => Promise<unknown>; providers?: Provider[]; isOkxWallet?: boolean; isOKExWallet?: boolean };
type Entry = { raw: Provider; guarded: Provider; name: string; observed: boolean };
type Route = { entry: Entry; active: boolean };
const entries = new WeakMap<Provider, Entry>();
const routes = new Map<string, Route>();
const announcements = new WeakSet<Event>();
const globalGetters = new Map<string, () => unknown>();
const waiting = new Map<string, { resolve: (value: boolean) => void; timer: ReturnType<typeof setTimeout> }>();
let bridgeReady = false;
const denied = (message = "Request cancelled in TxLens.") => Object.assign(new Error(message), { code: 4001 });

function entryFor(raw: Provider, name = "EVM wallet"): Entry {
  const existing = entries.get(raw);
  if (existing) {
    if (name !== "EVM wallet") existing.name = name;
    return existing;
  }
  if (raw.isOkxWallet || raw.isOKExWallet) name = "OKX Wallet";
  const entry: Entry = { raw, guarded: raw, name, observed: false };
  const request = async (args: Args) => {
    const original = (value: Args) => Reflect.apply(raw.request, raw, [value]) as Promise<unknown>;
    if (!requestMethods.includes(args.method)) return original(args);
    entry.observed = true;
    // Keep exactly the parameters the user reviewed, even if the dApp mutates its input.
    const snapshot: Args = JSON.parse(JSON.stringify(args));
    if (!bridgeReady) {
      window.postMessage({ channel: "txlens:page", type: "hello" }, "*");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!bridgeReady) throw denied("TxLens is not ready. Reload the page and try again.");
    const chainId = String(await original({ method: "eth_chainId" }));
    const id = crypto.randomUUID();
    const approved = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => { waiting.delete(id); resolve(false); }, 300000);
      waiting.set(id, { resolve, timer });
      window.postMessage({ channel: "txlens:page", type: "review", id,
        request: { ...snapshot, params: snapshot.params || [], chainId } }, "*");
    });
    if (!approved) throw denied();
    const currentChain = String(await original({ method: "eth_chainId" }));
    if (BigInt(currentChain) !== BigInt(chainId)) throw denied("The network changed during review. Please try again.");
    return original(snapshot);
  };
  const methods = new Map<PropertyKey, { original: unknown; bound: unknown }>();
  // A separate facade also supports frozen/getter-only wallets. Never overwrite the
  // wallet's own methods, and bind all other methods to their original receiver.
  entry.guarded = new Proxy({} as Provider, {
    get(_target, key) {
      if (key === "request") return request;
      const value = Reflect.get(raw, key, raw);
      if (key === "providers" && Array.isArray(value))
        return value.map((child: Provider) => child === raw ? entry.guarded : entryFor(child).guarded);
      if (typeof value !== "function") return value;
      const cached = methods.get(key);
      if (cached && cached.original === value) return cached.bound;
      const bound = value.bind(raw);
      methods.set(key, { original: value, bound });
      return bound;
    },
    set: (_target, key, value) => Reflect.set(raw, key, value, raw),
    has: (_target, key) => key in raw,
    ownKeys: () => Reflect.ownKeys(raw),
    getOwnPropertyDescriptor(_target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(raw, key);
      return descriptor ? { configurable: true, enumerable: descriptor.enumerable, writable: true,
        value: Reflect.get(entry.guarded, key) } : undefined;
    },
  });
  entries.set(raw, entry);
  entries.set(entry.guarded, entry);
  return entry;
}
function isProvider(value: unknown): value is Provider {
  return !!value && typeof (value as Provider).request === "function";
}
function rememberGlobal(key: string, value: Provider, active: boolean, seen = new Set<Provider>()) {
  if (seen.has(value)) return;
  seen.add(value);
  const entry = entryFor(value, key === "global:okxwallet" ? "OKX Wallet" : "EVM wallet");
  routes.set(key, { entry, active });
  // The facade exposes guarded children without mutating the wallet's provider list.
  entry.raw.providers?.forEach((child, index) => {
    if (isProvider(child)) rememberGlobal(`${key}.providers.${index}`, child, active, seen);
  });
}
function discover() {
  for (const key of [...routes.keys()]) if (key.startsWith("global:")) routes.delete(key);
  for (const key of ["ethereum", "okxwallet"] as const) {
    // Do not reserve an absent global: wallets may use property existence to decide
    // whether they should inject. Preserve the wallet's existing setter/flags.
    const descriptor = Object.getOwnPropertyDescriptor(window, key);
    if (!descriptor) continue;
    let value = Reflect.get(window, key);
    if (!isProvider(value)) continue;
    const name = key === "okxwallet" ? "OKX Wallet" : "EVM wallet";
    const entry = entryFor(value, name);
    try {
      if (descriptor.get && descriptor.configurable && descriptor.get !== globalGetters.get(key)) {
        const originalGet = descriptor.get;
        const get = () => {
          const current = originalGet.call(window);
          return isProvider(current) ? entryFor(current, name).guarded : current;
        };
        Object.defineProperty(window, key, { ...descriptor, get });
        globalGetters.set(key, get);
      } else if ("value" in descriptor && (descriptor.configurable || descriptor.writable)) {
        if (value !== entry.guarded) Object.defineProperty(window, key, { ...descriptor, value: entry.guarded });
      }
    } catch { /* A locked global stays available to the wallet; report the uncovered entry. */ }
    value = Reflect.get(window, key);
    if (isProvider(value)) rememberGlobal(`global:${key}`, value, value === entryFor(value).guarded);
  }
}
function coverage() {
  const groups = new Map<string | Entry, { name: string; active: boolean; partial: boolean; observed: boolean; paths: { name: string; active: boolean }[] }>();
  for (const [path, { entry, active }] of routes) {
    const key = entry.name === "EVM wallet" ? entry : entry.name.toLowerCase();
    const group = groups.get(key) || { name: entry.name, active: true, partial: false, observed: false, paths: [] };
    group.paths.push({ name: path, active });
    group.active &&= active;
    group.observed ||= entry.observed;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, partial: !group.active && group.paths.some((path) => path.active) }));
}
window.addEventListener("eip6963:announceProvider", (event) => {
  if (announcements.has(event)) return;
  const detail = (event as CustomEvent<{ provider: Provider; info?: { name?: string; uuid?: string; rdns?: string } }>).detail;
  if (!isProvider(detail?.provider)) return;
  const entry = entryFor(detail.provider, detail.info?.name?.slice(0, 80) || "EVM wallet");
  routes.set(`eip6963:${detail.info?.uuid || detail.info?.rdns || entry.name}`, { entry, active: true });
  // Keep every wallet's identity and announcement; only substitute that wallet's
  // request facade. Capture before dApp listeners, including for frozen details.
  event.stopImmediatePropagation();
  const forwarded = new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ ...detail, provider: entry.guarded }) });
  announcements.add(forwarded);
  window.dispatchEvent(forwarded);
}, true);
window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.channel !== "txlens:bridge") return;
  if (event.data.type === "ready") { bridgeReady = true; discover(); }
  if (event.data.type === "probe") {
    discover();
    window.postMessage({ channel: "txlens:page", type: "probe-result", id: event.data.id, providers: coverage() }, "*");
  }
  if (event.data.type === "decision") {
    const item = waiting.get(event.data.id);
    if (!item) return;
    clearTimeout(item.timer);
    waiting.delete(event.data.id);
    item.resolve(event.data.approved === true);
  }
});
window.addEventListener("ethereum#initialized", discover);
discover();
window.dispatchEvent(new Event("eip6963:requestProvider"));
setInterval(discover, 500);
window.addEventListener("pagehide", () => {
  waiting.forEach((item) => { clearTimeout(item.timer); item.resolve(false); });
  waiting.clear();
});
