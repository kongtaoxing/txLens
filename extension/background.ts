/// <reference types="chrome" />
import { requestMethods, type WalletRequest } from "../lib/inspector/model";
import { loadSettings as settings, isPaused, type Pending } from "./state";
const pendingKey = (id: string) => `pending:${id}`;
const get = async (id: string) =>
  (await chrome.storage.session.get(pendingKey(id)))[pendingKey(id)] as
    | Pending
    | undefined;
const ui = (sender: chrome.runtime.MessageSender) =>
  sender.id === chrome.runtime.id &&
  sender.url?.startsWith(chrome.runtime.getURL("index.html"));
async function finish(id: string, approved: boolean) {
  const item = await get(id);
  if (!item) return false;
  await chrome.storage.session.remove(pendingKey(id));
  await chrome.alarms.clear(id);
  await chrome.tabs
    .sendMessage(
      item.tabId,
      { type: "decision", id: item.pageId, approved },
      item.documentId
        ? { documentId: item.documentId }
        : { frameId: item.frameId },
    )
    .catch(() => {});
  if (item.windowId) await chrome.windows.remove(item.windowId).catch(() => {});
  return true;
}
const deciding = new Set<string>();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  (async () => {
    if (message.type === "hooked" && sender.tab?.id !== undefined) {
      await chrome.storage.session.set({
        [`hooked:${sender.tab.id}`]: Date.now(),
      });
      return { ok: true };
    }
    if (
      message.type === "review" &&
      sender.tab?.id !== undefined &&
      sender.url
    ) {
      const request = message.request as WalletRequest;
      if (
        typeof message.id !== "string" ||
        message.id.length > 100 ||
        !requestMethods.includes(request?.method) ||
        !Array.isArray(request.params) ||
        typeof request.chainId !== "string" ||
        JSON.stringify(request).length > 64000
      )
        return { approved: false };
      const origin = new URL(sender.url).origin;
      if (isPaused(await settings(), origin)) return { approved: true };
      const all = Object.values(
        await chrome.storage.session.get(null),
      ) as Pending[];
      if (
        all.filter((p) => p?.tabId === sender.tab!.id && p?.request).length >= 4
      )
        return { approved: false };
      const id = crypto.randomUUID();
      const item: Pending = {
        id,
        pageId: message.id,
        tabId: sender.tab.id,
        frameId: sender.frameId || 0,
        documentId: sender.documentId,
        created: Date.now(),
        request: {
          method: request.method,
          params: request.params,
          chainId: request.chainId,
          origin,
        },
      };
      await chrome.storage.session.set({ [pendingKey(id)]: item });
      try {
        const win = await chrome.windows.create({
          url: chrome.runtime.getURL(`index.html?review=${id}`),
          type: "popup",
          width: 500,
          height: 800,
        });
        if (!win?.id) throw Error("window not created");
        item.windowId = win.id;
        // The review window can close while windows.create is resolving.
        if (win.id) await chrome.windows.get(win.id);
        await chrome.storage.session.set({ [pendingKey(id)]: item });
        await chrome.alarms.create(id, { when: item.created + 295000 });
      } catch {
        await finish(id, false);
        return { approved: false };
      }
      return { queued: true };
    }
    if (!ui(sender)) return { error: "untrusted sender" };
    if (message.type === "get") {
      const item = await get(String(message.id));
      if (item && Date.now() - item.created < 295000)
        return { item, settings: await settings() };
      return { error: "expired" };
    }
    if (message.type === "decide") {
      const id = String(message.id);
      if (deciding.has(id)) return { ok: false };
      deciding.add(id);
      try {
        const item = await get(id);
        if (!item) return { ok: false };
        const approved =
          message.approved === true && Date.now() - item.created < 295000;
        if (approved && message.pause === true) {
          const s = await settings();
          s.paused[item.request.origin] = Date.now() + 900000;
          await chrome.storage.local.set({ settings: s });
        }
        return { ok: await finish(id, approved) };
      } finally {
        deciding.delete(id);
      }
    }
    return { error: "unknown" };
  })()
    .then(respond)
    .catch(() => respond({ error: "failed", approved: false }));
  return true;
});
chrome.windows.onRemoved.addListener(async (windowId) => {
  const all = await chrome.storage.session.get(null);
  for (const [key, item] of Object.entries(all))
    if (key.startsWith("pending:") && (item as Pending).windowId === windowId)
      await finish((item as Pending).id, false);
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const all = await chrome.storage.session.get(null);
  for (const [key, item] of Object.entries(all))
    if (key.startsWith("pending:") && (item as Pending).tabId === tabId)
      await finish((item as Pending).id, false);
  await chrome.storage.session.remove(`hooked:${tabId}`);
});
chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (change.status !== "loading") return;
  await chrome.storage.session.remove(`hooked:${tabId}`);
  const all = await chrome.storage.session.get(null);
  for (const [key, item] of Object.entries(all))
    if (key.startsWith("pending:") && (item as Pending).tabId === tabId)
      await finish((item as Pending).id, false);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  void finish(alarm.name, false);
});
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ settings: await settings() });
});
