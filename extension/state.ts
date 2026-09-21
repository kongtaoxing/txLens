import type { WalletRequest } from "../lib/inspector/model";
export type Settings = {
  serviceUrl: string;
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
export const defaults: Settings = {
  serviceUrl: "http://localhost:5173",
  paused: {},
};
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
