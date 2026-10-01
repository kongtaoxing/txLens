"use client";
import { useState } from "react";
import { ArrowUpRight, LoaderCircle, Search } from "lucide-react";
import { inspect, tr, type Locale } from "@/lib/inspector/model";
import { ARC } from "@/lib/inspector/arc";
import type { ArcTransaction } from "@/lib/inspector/arc-rpc";
import { AddressLink, LinkedAddresses } from "./address";

export function ArcActivity({ locale }: { locale: Locale }) {
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<ArcTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = (zh: string, en: string) => tr(locale, zh, en);
  const report = result ? inspect(result.request, locale) : null;
  async function read(latest: boolean) {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch(`/api/arc${latest ? "" : `?hash=${encodeURIComponent(hash.trim())}`}`, { signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) setError(data.error || "unavailable");
      else setResult(data);
    } catch { setError("unavailable"); }
    finally { setBusy(false); }
  }
  const messages: Record<string, [string, string]> = {
    "invalid-hash": ["请填写完整的交易哈希：0x 开头，共 66 个字符。", "Enter a complete transaction hash: 0x followed by 64 hexadecimal characters."],
    "not-found": ["Arc 主网上没有找到这笔交易，请核对网络与哈希。", "Transaction not found on Arc mainnet. Check its network and hash."],
    pending: ["这笔交易尚未确认，请稍后再查。", "This transaction is still pending. Try again after confirmation."],
    empty: ["近期区块没有找到 USDC 转账或调用。可以粘贴一笔 Arc 交易哈希查询。", "No USDC transfer or call found in recent blocks. Look up a specific Arc transaction below."],
    network: ["服务连接的网络不是 Arc 主网，已停止查询。", "The service is connected to the wrong network. The lookup was stopped."],
    unavailable: ["暂时连接不到 Arc 主网，请稍后重试，或在区块浏览器中查看。", "Arc mainnet is temporarily unavailable. Retry or check the block explorer."],
  };
  return <section className="lp-arc lp-container" id="arc" aria-labelledby="arc-title">
    <div className="lp-section-heading"><div><span className="lp-eyebrow">ARC / {t("真实链上数据", "REAL ONCHAIN DATA")}</span><h2 id="arc-title">{t("从一笔真实交易开始。", "Start with a real transaction.")}</h2></div><p>{t("一键读取 Arc 主网近期的 USDC 交易，核对金额、接收方和实际网络手续费。无需钱包，不会发起新交易。", "Read a recent USDC transaction on Arc mainnet. Check the amount, recipient and actual network fee. No wallet needed. No new transaction is sent.")}</p></div>
    <div className="lp-arc-workspace">
      <div className="lp-arc-controls">
        <span className="lp-eyebrow">Arc {t("主网", "MAINNET")} · {ARC.chainId}</span>
        <p>{t("USDC 既用于转账，也用于支付 Arc 网络手续费。", "USDC is used for both payments and network fees on Arc.")}</p>
        <button className="lp-button lp-button-accent" disabled={busy} onClick={() => void read(true)}>{busy ? <LoaderCircle size={18} className="spin" /> : <Search size={18} />}{busy ? t("正在读取主网…", "Reading mainnet…") : t("读取近期 USDC 交易", "Read a recent USDC transaction")}</button>
        <form onSubmit={event => { event.preventDefault(); void read(false); }}>
          <label htmlFor="arc-hash">{t("或查询指定交易", "Or look up a transaction")}</label>
          <input id="arc-hash" value={hash} onChange={event => setHash(event.target.value)} placeholder="0x…" required pattern="0x[0-9a-fA-F]{64}" autoComplete="off" spellCheck={false} aria-describedby="arc-hash-help" />
          <small id="arc-hash-help">{t("从钱包的交易记录中复制交易哈希。", "Copy the transaction hash from your wallet history.")}</small>
          <button className="lp-button" type="submit" disabled={busy || !hash.trim()}>{t("查看交易", "Look up transaction")}<ArrowUpRight size={16} /></button>
        </form>
        <a href={ARC.explorer} target="_blank" rel="noreferrer">{t("打开 Arc 区块浏览器", "Open Arc Explorer")} ↗</a>
        {error && <p className="lp-arc-error" role="alert">{t(...(messages[error] || messages.unavailable))}</p>}
      </div>
      <div className="lp-arc-result" aria-live="polite" aria-busy={busy}>
        {result && report ? <>
          <span className="lp-eyebrow">{t("已上链交易 · 只读查询", "MINED TRANSACTION · READ ONLY")}</span>
          <h3>{report.title}</h3>
          <dl>
            <div><dt>{t("链上执行结果", "Execution result")}</dt><dd>{result.status === "success" ? t("成功", "Succeeded") : t("失败，操作未生效", "Reverted; operation did not take effect")}</dd></div>
            <div><dt>{t("区块", "Block")}</dt><dd><a href={`${ARC.explorer}/block/${result.block}`} target="_blank" rel="noreferrer">{result.block} ↗</a></dd></div>
            {report.facts.map((fact, index) => <div key={index}><dt>{fact.label}</dt><dd>{fact.address && fact.value === fact.address ? <AddressLink address={fact.address} chainId={ARC.chainHex} /> : <LinkedAddresses text={fact.value} chainId={ARC.chainHex} />}</dd></div>)}
            <div><dt>{t("实际网络手续费", "Actual network fee")}</dt><dd>{result.gasFee} USDC</dd></div>
          </dl>
          <a href={`${ARC.explorer}/tx/${result.hash}`} target="_blank" rel="noreferrer">{t("在浏览器核对完整交易", "Verify the full transaction on Arc Explorer")} ↗</a>
          <p className="lp-arc-note">{t("金额与授权来自交易输入；交易成功不代表安全，也不代表已确认所有资产变化。发起网站无法从链上记录确定。", "Amounts and permissions are decoded from transaction input. Success is not a safety verdict or a complete account of asset changes. The originating website cannot be determined from the chain.")}</p>
          {report.coverage === "partial" && <p className="lp-arc-note">{t("部分调用尚未解析，请查看区块浏览器中的完整记录。", "Some calls are not decoded. Check the full record on Arc Explorer.")}</p>}
        </> : <div className="lp-arc-empty"><Search size={32} /><h3>{t("查看真实的 USDC 操作", "See a real USDC operation")}</h3><p>{t("点击“读取近期 USDC 交易”获取主网数据，也可以查询自己的交易。", "Select “Read a recent USDC transaction”, or look up a transaction from your wallet history.")}</p></div>}
      </div>
    </div>
  </section>;
}
