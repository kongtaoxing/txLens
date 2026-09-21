import React from "react";
import { Check, TriangleAlert } from "lucide-react";
import { tr, type Locale } from "../lib/inspector/model";
export type Connection = {
  connected: boolean;
  providers: { name: string; active: boolean; partial: boolean; observed: boolean }[];
};
export function Coverage({ connection, checking, locale, onCheck }: {
  connection: Connection | null; checking: boolean; locale: Locale; onCheck: () => void;
}) {
  const t = (zh: string, en: string) => tr(locale, zh, en);
  const hasGap = connection?.providers.some((p) => !p.active);
  return <section className="coverage-status" aria-label={t("钱包审阅状态", "Wallet review status")}>
    <div className="coverage-heading">
      <strong>{t("当前网页的钱包入口", "Wallets on this page")}</strong>
      <button className="text-button" onClick={onCheck} disabled={checking}>
        {checking ? t("检查中…", "Checking…") : t("重新检查", "Check again")}
      </button>
    </div>
    <div aria-live="polite" aria-atomic="true">
      {!connection || checking ? <p>{t("正在检查当前网页…", "Checking this page…")}</p>
      : !connection.connected ? <p>{t("插件尚未接入当前网页。请允许访问此网站，然后刷新网页。", "TxLens is not attached to this page. Allow site access, then reload.")}</p>
      : !connection.providers.length ? <p>{t("尚未发现钱包。请启用钱包扩展并刷新网页。", "No wallet found. Enable your wallet extension and reload.")}</p>
      : <>
        <ul className="coverage-wallets">
          {connection.providers.map((provider, index) => <li key={`${provider.name}-${index}`}>
            <div className="coverage-wallet-name">{provider.active ? <Check size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
              <span>{provider.name}</span></div>
            <span className={provider.active ? "coverage-ready" : "coverage-warning"}>
              {provider.partial ? t("部分入口未接入", "Some entries unavailable") : provider.active ? t("入口已接入", "Entry attached") : t("未接入", "Not attached")}
            </span>
            <small>{provider.observed ? t("已捕获过审阅请求", "Review request captured") : t("尚未捕获审阅请求", "No review request captured yet")}</small>
          </li>)}
        </ul>
        <p className="coverage-note">{hasGap
          ? t("部分入口无法自动审阅。钱包连接正常，也可能不会触发 TxLens。", "Some entries cannot be reviewed automatically, even when the wallet connects normally.")
          : t("这里只检查入口是否接入，不代表已通过实际交易验证。", "This checks entry attachment, not a completed transaction test.")}</p>
      </>}
    </div>
  </section>;
}
