/// <reference types="chrome" />
import React, { useState, useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  Settings2,
  ShieldCheck,
  Pause,
  Play,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import {
  Brand,
  ReviewPanel,
  type Explanation,
} from "../components/inspector/review";
import { tr } from "../lib/inspector/model";
import { localeFromLanguage, subscribeLocale } from "../lib/inspector/locale";
const extensionLocale = () => localeFromLanguage(chrome.i18n.getUILanguage());
import {
  defaults,
  loadSettings,
  isPaused,
  validServiceUrl,
  type Settings,
  type Pending,
} from "./state";
import "../app/product.css";
import { Coverage, type Connection } from "./coverage";
function App() {
  const locale = useSyncExternalStore(subscribeLocale, extensionLocale);
  const [settings, setSettings] = useState<Settings>(defaults),
    [item, setItem] = useState<Pending>(),
    [ready, setReady] = useState(false),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [origin, setOrigin] = useState(""),
    [connection, setConnection] = useState<Connection | null>(null),
    [checking, setChecking] = useState(false),
    [advanced, setAdvanced] = useState(false),
    [url, setUrl] = useState(""),
    [saved, setSaved] = useState(false),
    [urlError, setUrlError] = useState(false);
  const id = new URLSearchParams(location.search).get("review");
  const t = (zh: string, en: string) => tr(locale, zh, en);
  useEffect(() => {
    void (async () => {
      const initial = await loadSettings();
      setSettings(initial);
      setUrl(initial.serviceUrl);
      if (id) {
        const result = await chrome.runtime.sendMessage({ type: "get", id });
        if (result.item) setItem(result.item);
        else setError(true);
      } else {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.url?.startsWith("http")) setOrigin(new URL(tab.url).origin);
        if (tab?.id !== undefined) {
          try {
            setConnection(
              await chrome.tabs.sendMessage(
                tab.id,
                { type: "probe" },
                { frameId: 0 },
              ),
            );
          } catch {
            setConnection({ connected: false, providers: [] });
          }
        }
      }
      setReady(true);
    })().catch(() => {
      setError(true);
      setReady(true);
    });
  }, [id]);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(
      () => {
        setError(true);
        setItem(undefined);
      },
      Math.max(0, item.created + 295000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [item]);
  async function checkConnection() {
    setChecking(true);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) throw Error("no tab");
      setConnection(
        await chrome.tabs.sendMessage(
          tab.id,
          { type: "probe" },
          { frameId: 0 },
        ),
      );
    } catch {
      setConnection({ connected: false, providers: [] });
    } finally {
      setChecking(false);
    }
  }
  const coverageGap = !!connection && (!connection.connected || !connection.providers.length || connection.providers.some((provider) => !provider.active));
  async function save(next: Settings) {
    setSettings(next);
    await chrome.storage.local.set({ settings: next });
  }
  async function decide(approved: boolean, pause: boolean) {
    setBusy(true);
    await chrome.runtime.sendMessage({ type: "decide", id, approved, pause });
    setError(true);
    setBusy(false);
  }
  async function explain() {
    if (!item || !validServiceUrl(settings.serviceUrl))
      return { error: "service" };
    const res = await fetch(
      `${settings.serviceUrl.replace(/\/$/, "")}/api/explain`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: item.request,
          locale: locale,
        }),
        signal: AbortSignal.timeout(120000),
      },
    );
    if (!res.ok)
      return { error: res.status === 503 ? "unconfigured" : res.status === 403 ? "origin" : "service" };
    return (await res.json()) as Explanation;
  }
  async function service() {
    setSaved(false);
    setUrlError(false);
    if (!validServiceUrl(url)) {
      setUrlError(true);
      return;
    }
    const parsed = new URL(url);
    const clean = parsed.href.replace(/\/$/, "");
    if (
      parsed.protocol === "https:" &&
      !(await chrome.permissions.request({ origins: [`${parsed.origin}/*`] }))
    ) {
      setUrlError(true);
      return;
    }
    await save({ ...settings, serviceUrl: clean, serviceMode: clean === defaults.serviceUrl ? "default" : "custom" });
    setSaved(true);
  }
  return (
    <main
      className={`extension-shell ${id ? "review-window" : "popup-window"}`}
    >
      <header className="extension-header">
        <Brand />
      </header>
      {!ready ? (
        <p className="empty-state">{t("正在读取请求…", "Loading request…")}</p>
      ) : id ? (
        item && !error ? (
          <ReviewPanel
            key={locale}
            request={item.request}
            locale={locale}
            busy={busy}
            onExplain={explain}
            onDecide={decide}
          />
        ) : (
          <div className="empty-state">
            <ShieldCheck size={36} />
            <h2>{t("本次审阅已结束", "This review has ended")}</h2>
            <p>
              {t(
                "请求已处理、取消或超时。需要时请在原网站重新发起。",
                "The request was handled, cancelled or expired. Start a new request on the original site if needed.",
              )}
            </p>
            <button className="secondary" onClick={() => window.close()}>
              {t("关闭窗口", "Close window")}
            </button>
          </div>
        )
      ) : (
        <>
          <div className="popup-status">
            <div
              className={`status-icon ${isPaused(settings, origin) || coverageGap ? "paused" : ""}`}
            >
              {isPaused(settings, origin) ? (
                <Pause size={26} />
              ) : coverageGap ? (
                <TriangleAlert size={28} />
              ) : (
                <ShieldCheck size={28} />
              )}
            </div>
            <span className="eyebrow">
              {t("钱包请求助手", "YOUR WALLET COMPANION")}
            </span>
            <h1>
              {isPaused(settings, origin)
                ? t("此网站已暂停", "Paused on this site")
                : t("确认前，核对操作。", "Review before confirming.")}
            </h1>
            <p>
              {origin ||
                t("请打开一个 DApp 网站", "Open a dApp to get started")}
            </p>
          </div>
          {origin ? (
            <>
              <Coverage connection={connection} checking={checking} locale={locale} onCheck={checkConnection} />
              <div className="site-controls">
                {isPaused(settings, origin) ? (
                  <button
                    className="primary"
                    onClick={() =>
                      save({
                        ...settings,
                        paused: { ...settings.paused, [origin]: 0 },
                      })
                    }
                  >
                    <Play size={16} />
                    {t("恢复此网站审阅", "Resume reviews on this site")}
                  </button>
                ) : (
                  <>
                    <button
                      className="secondary"
                      onClick={() =>
                        save({
                          ...settings,
                          paused: {
                            ...settings.paused,
                            [origin]: Date.now() + 900000,
                          },
                        })
                      }
                    >
                      <Pause size={15} />
                      {t("暂停 15 分钟", "Pause for 15 minutes")}
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        save({
                          ...settings,
                          paused: { ...settings.paused, [origin]: -1 },
                        })
                      }
                    >
                      {t("始终跳过此网站", "Always skip this site")}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : null}
          <div className="popup-info">
            <strong>
              {t("本地检查，即刻可看", "Local checks, ready immediately")}
            </strong>
            <p>
              {t(
                "先核对金额和授权范围，再按需查看操作说明。",
                "Check amounts and spending permissions, then ask for an explanation if needed.",
              )}
            </p>
          </div>
          <button
            className="settings-toggle"
            onClick={() => setAdvanced(!advanced)}
          >
            <Settings2 size={17} />
            {t("AI 服务与设置", "AI service & settings")}
          </button>
          {advanced ? (
            <section className="settings-panel">
              <label htmlFor="service">
                {t("AI 服务地址", "AI service URL")}
              </label>
              <input
                id="service"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setSaved(false);
                }}
              />
              <p>
                {t(
                  "默认连接 TxLens 线上服务，无需配置。仅在使用自建服务时修改地址；这里不填写 API Key。",
                  "TxLens connects to the online service automatically. Change this only for a self-hosted backend. Do not enter an API key here.",
                )}
              </p>
              <button className="secondary" onClick={service}>
                {saved
                  ? t("已保存", "Saved")
                  : t("保存连接", "Save connection")}
              </button>
              {urlError ? (
                <p className="error">
                  {t(
                    "请填写 HTTPS 地址或本机地址，并允许连接。",
                    "Use an HTTPS or localhost URL and allow the connection.",
                  )}
                </p>
              ) : null}
              <p>
                {t(
                  "AI 请求仅在点击解释后发送；不保存审阅历史。",
                  "AI receives details only when you ask. Review history is not retained.",
                )}
              </p>
            </section>
          ) : null}
          <footer className="popup-footer">
            <span>
              {t("免费 · 无抽成", "Free · No commission")} · v
              {chrome.runtime.getManifest().version}
            </span>
            <a
              href={`${settings.serviceUrl}/#install`}
              target="_blank"
              rel="noreferrer"
            >
              {t("使用指南", "Guide")}
              <ExternalLink size={13} />
            </a>
          </footer>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
