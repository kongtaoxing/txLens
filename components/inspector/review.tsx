"use client";
import { useState, useMemo } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Fingerprint,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import {
  inspect,
  shortAddress,
  tr,
  type Locale,
  type WalletRequest,
} from "@/lib/inspector/model";
import { AddressLink, LinkedAddresses } from "./address";
import { requestNetwork } from "@/lib/inspector/explorer";
export type Explanation = {
  text?: string;
  details?: { action: string; effect: string; check: string };
  provider?: string;
  orbio?: boolean;
  error?: string;
  sources?: { address: string; chainId: string; name?: string; status: "verified" | "unavailable" }[];
};
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Fingerprint size={23} />
      </span>
      TxLens<span className="brand-dot">.</span>
    </span>
  );
}
export function ReviewPanel({
  request,
  locale,
  onExplain,
  onDecide,
  preview = false,
  busy = false,
}: {
  request: WalletRequest;
  locale: Locale;
  onExplain: () => Promise<Explanation>;
  onDecide: (approved: boolean, pause: boolean) => void;
  preview?: boolean;
  busy?: boolean;
}) {
  const t = (zh: string, en: string) => tr(locale, zh, en);
  const report = useMemo(() => inspect(request, locale), [request, locale]);
  const explorerChainId = requestNetwork(request);
  const [pause, setPause] = useState(false),
    [loading, setLoading] = useState(false),
    [answer, setAnswer] = useState<Explanation | null>(null);
  const danger = report.findings.some((f) => f.level === "danger");
  async function explain() {
    setLoading(true);
    setAnswer(null);
    try {
      setAnswer(await onExplain());
    } catch (error) {
      setAnswer({ error: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "offline" });
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="review-card"
      aria-label={t("请求审阅", "Request review")}
    >
      <div className="review-top">
        <span className="eyebrow">
          <span className="live-dot" />
          {preview
            ? t("交互预览", "INTERACTIVE PREVIEW")
            : t("等待你的决定", "WAITING FOR YOU")}
        </span>
        <span className="network">{report.network}</span>
      </div>
      <div className="review-heading">
        <div className={`action-icon ${danger ? "danger" : ""}`}>
          {danger ? <ShieldAlert size={26} /> : <ArrowUpRight size={26} />}
        </div>
        <div>
          <p className="overline">
            {report.kind === "signature"
              ? t("待签名请求", "BEFORE YOU SIGN")
              : t("钱包确认前", "BEFORE YOUR WALLET")}
          </p>
          <h2>{report.title}</h2>
        </div>
      </div>
      <p className="site-label">
        <span>{t("请求网站", "Requested by")}</span>
        <strong>{request.origin}</strong>
      </p>
      <div className="fact-list">
        {report.facts.map((fact, i) => (
          <div className="fact-row" key={i}>
            <span>{fact.label}</span>
            <strong className={fact.address ? "mono" : ""} title={fact.value}>
              {fact.address && fact.value === fact.address
                ? <AddressLink address={fact.address} chainId={explorerChainId}>{shortAddress(fact.value)}</AddressLink>
                : <LinkedAddresses text={fact.value} chainId={explorerChainId} />}
              {fact.address && fact.value === fact.address ? (
                <details className="address-detail">
                  <summary aria-label={t("查看完整地址", "Show full address")}>
                    <ChevronDown size={14} />
                  </summary>
                  <code><AddressLink address={fact.address} chainId={explorerChainId} /></code>
                </details>
              ) : null}
            </strong>
          </div>
        ))}
        <div className="fact-row fee-row">
          <span>{t("TxLens 服务费", "TxLens service fee")}</span>
          <strong>
            {t("免费 · 0 抽成", "Free · No commission")}
            <Check size={14} />
          </strong>
        </div>
      </div>
      <div className="findings">
        {report.findings.map((finding, i) => (
          <div key={i} className={`finding ${finding.level}`}>
            <CircleHelp size={17} />
            <div>
              <h3>{finding.title}</h3>
              <p><LinkedAddresses text={finding.detail} chainId={explorerChainId} /></p>
            </div>
          </div>
        ))}
      </div>
      <p className="coverage-note">
        {t(
          "以上为请求内容，未模拟执行。实际到账和网络手续费请核对钱包预览。",
          "These are request details, not a simulation. Check your wallet preview for expected receipts and network fees.",
        )}
      </p>
      <div className="ai-section">
        <div className="ai-heading">
          <span>
            <Sparkles size={17} />
            {t("操作说明", "Transaction explanation")}
          </span>
          <span className="optional">{t("可选", "OPTIONAL")}</span>
        </div>
        {answer?.text ? (
          <div className="ai-answer" role="status">
            {answer.details ? <dl className="explanation-points">
              {([
                ["action", t("本次操作", "Action")],
                ["effect", t("资产与权限", "Assets & permissions")],
                ["check", t("请确认", "Check before continuing")],
              ] as const).map(([key, label]) => <div key={key}>
                <dt>{label}</dt>
                <dd><LinkedAddresses text={answer.details![key]} chainId={explorerChainId} /></dd>
              </div>)}
            </dl> : answer.text.split(/\n+/).map((p, i) => (
              <p key={i}><LinkedAddresses text={p} chainId={explorerChainId} /></p>
            ))}
            {answer.sources?.length ? <details className="ai-sources">
              <summary>{t("合约资料", "Contract sources")}</summary>
              <ul>{answer.sources.map((source) => <li key={`${source.chainId}:${source.address}`}>
                <AddressLink address={source.address} chainId={source.chainId}>{source.name ? `${source.name} · ${shortAddress(source.address)}` : shortAddress(source.address)}</AddressLink>
                {" — "}{source.status === "verified" ? t("已获取已验证源码", "Verified source retrieved") : t("未能获取已验证源码", "Verified source unavailable")}
              </li>)}</ul>
            </details> : null}
            <small>
              {answer.orbio ? "Orbio" : t("开发测试模型", "Development model")}{" "}
              ·{" "}
              {t(
                "AI 分析供参考，确认前请核对钱包信息",
                "AI analysis; check the details in your wallet before confirming",
              )}
            </small>
          </div>
        ) : null}
        {answer?.error ? (
          <p className="error" role="alert">
            {answer.error === "unconfigured"
              ? t(
                  "AI 服务尚未配置。基础检查仍可使用。",
                  "AI is not configured. Local checks remain available.",
                )
              : answer.error === "origin"
                ? t("AI 服务拒绝了插件的访问，请检查本地服务的扩展许可设置。基础检查仍可使用。", "The AI service denied extension access. Check its allowed extension settings. Local checks remain available.")
                : answer.error === "offline"
                  ? t("连接不到 AI 服务，请确认设置中的服务地址可访问。基础检查仍可使用。", "Cannot reach the AI service. Check that the service address in settings is reachable. Local checks remain available.")
                  : answer.error === "timeout"
                    ? t("AI 回复超时，可以重试。无需等待 AI，也能取消或继续到钱包。", "The AI response timed out. You can retry, cancel or continue to your wallet without waiting.")
                    : t("AI 服务暂时无法完成解释，可以重试。基础检查仍可使用。", "The AI service could not finish this explanation. You can retry; local checks remain available.")}
          </p>
        ) : null}
        <button
          className="ai-button"
          onClick={explain}
          disabled={loading || busy}
        >
          {loading ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Sparkles size={17} />
          )}{" "}
          {loading
            ? t("正在分析操作…", "Analyzing request…")
            : answer?.text
              ? t("重新解释", "Explain again")
              : t("分析这次操作", "Explain this request")}
        </button>
        <p className="privacy-note">
          {t(
            "点击后，将请求内容发送给 AI 服务，并查询相关公开合约资料。分析期间仍可取消或继续。",
            "Sends request details to the AI service and checks relevant public contract sources. You can cancel or continue while it runs.",
          )}
        </p>
      </div>
      <details className="raw-details">
        <summary>
          {t("查看原始请求", "View original request")}
          <ChevronDown size={15} />
        </summary>
        <pre><LinkedAddresses text={JSON.stringify(request, null, 2)} chainId={explorerChainId} /></pre>
      </details>
      {!preview ? (
        <label className="pause-option">
          <input
            type="checkbox"
            checked={pause}
            onChange={(e) => setPause(e.target.checked)}
          />
          <span>
            {t(
              "继续后，暂停此网站 15 分钟",
              "After continuing, pause this site for 15 minutes",
            )}
            <small>
              {t(
                "暂停期间，该网站的请求直接进入钱包。",
                "Requests from this site will go straight to your wallet.",
              )}
            </small>
          </span>
        </label>
      ) : null}
      <div className="decision-area">
        <div className="review-actions">
          <button
            className="cancel-button"
            disabled={busy}
            onClick={() => onDecide(false, false)}
          >
            <X size={16} />
            {t("取消", "Cancel")}
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => onDecide(true, pause)}
          >
            {t("继续到钱包", "Continue in wallet")}
            <ArrowUpRight size={17} />
          </button>
        </div>
        <p className="footer-note">
          {preview
            ? t(
                "演示请求，不会连接钱包或发送交易。",
                "Demo request. No wallet connection or transaction.",
              )
            : t(
                "继续仅打开钱包确认；TxLens 不签名、不转账。",
                "Continuing opens wallet confirmation. TxLens never signs or transfers.",
              )}
        </p>
      </div>
    </section>
  );
}
