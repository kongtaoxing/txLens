import type { WalletRequest } from "../lib/inspector/model";
export type Settings = {
  serviceUrl: string;
  serviceMode: "default" | "custom";
  paused: Record<string, number>;
};
export type Pending = {
  id: string;
  pageId: string;
  tabId: number;
  frameId: number;
  documentId?: string;
  windowId?: number;
  created: number;
  request: WalletRequest;
};
declare const TXLENS_SERVICE_URL: string | undefined;
export const defaults: Settings = {
  serviceUrl: typeof TXLENS_SERVICE_URL === "string" ? TXLENS_SERVICE_URL : "https://tx-lens.vercel.app",
  serviceMode: "default",
  paused: {},
};
// Older releases saved the local development URL as if it were a user choice.
// New explicit overrides are marked so developers can still use a local server.
export function resolveSettings(stored?: Partial<Settings>): Settings {
  const legacyCustom = stored?.serviceUrl &&
    validServiceUrl(stored.serviceUrl) &&
    !["localhost", "127.0.0.1"].includes(new URL(stored.serviceUrl).hostname);
  const custom = stored?.serviceMode === "custom" ||
    (!stored?.serviceMode && legacyCustom);
  return {
    ...defaults,
    ...stored,
    serviceUrl: custom && stored?.serviceUrl ? stored.serviceUrl : defaults.serviceUrl,
    serviceMode: custom ? "custom" : "default",
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get("settings")).settings as Partial<Settings> | undefined;
  const current = resolveSettings(stored);
  if (stored && (stored.serviceUrl !== current.serviceUrl || stored.serviceMode !== current.serviceMode)) {
    await chrome.storage.local.set({ settings: current });
  }
  return current;
}

export const isPaused = (
  settings: Settings,
  origin: string,
  now = Date.now(),
) => settings.paused[origin] === -1 || settings.paused[origin] > now;
export const validServiceUrl = (value: string) => {
  try {
    const u = new URL(value);
    return (
      (u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(u.hostname))) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
};
