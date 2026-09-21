"use client";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import {
  ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CheckCircle2,
  ChevronDown, ChevronRight, CirclePause, FileText, Globe2, Infinity as InfinityIcon,
  LockKeyhole, MousePointer2, Pause, Play, ScanLine, Sparkles, Wallet, X,
} from "lucide-react";
import { ReviewPanel, type Explanation } from "@/components/inspector/review";
import { examples } from "@/lib/inspector/examples";
import { tr, type Locale } from "@/lib/inspector/model";
import {
  browserLocale, subscribeLocale, languagePreference, WEBSITE_LANGUAGE_COOKIE,
  type LanguagePreference,
} from "@/lib/inspector/locale";

function Brand() {
  return <span className="brand"><span className="brand-icon"><FileText size={26} strokeWidth={1.7} /></span>TxLens<span className="brand-dot">.</span></span>;
}

function TransactionReceipt({ locale, paused }: { locale: Locale; paused: boolean }) {
  const t = (zh: string, en: string) => tr(locale, zh, en);
  return (
    <div className="lp-receipt-scene" data-paused={paused} role="img" aria-label={t(
      "示例交易摘要：向 0x1111…1111 转出 25 USDC，仅本次转账，不授予后续使用权限。",
      "Sample transaction summary: send 25 USDC to 0x1111…1111. A one-time transfer, with no ongoing spending permission.",
    )}>
      <div className="lp-scene-rule" aria-hidden="true" />
      <div className="lp-request-slip" aria-hidden="true">
        <span className="lp-slip-index">01 / {t("网站请求", "THE REQUEST")}</span>
        <div className="lp-slip-window"><i /><i /><i /></div>
        <code>eth_sendTransaction</code>
        <span className="lp-slip-data">0xa9059cbb00000000<br />0000000000000000<br />1111111111111111…</span>
        <span className="lp-slip-arrow"><ArrowRight size={24} /></span>
      </div>
      <div className="lp-receipt" aria-hidden="true">
        <div className="lp-receipt-head"><span><FileText size={18} />TxLens</span><span>{t("示例凭条", "SAMPLE RECEIPT")}</span></div>
        <div className="lp-receipt-title"><span>{t("本次操作", "YOU ARE ABOUT TO")}</span><strong>{t("转出", "Send")} <b>25</b> USDC<sup>↗</sup></strong></div>
        <div className="lp-receipt-row"><span>01</span><div><small>{t("接收地址", "RECIPIENT")}</small><strong>0x1111…1111</strong></div><ArrowUpRight size={20} /></div>
        <div className="lp-receipt-row"><span>02</span><div><small>{t("资产数量", "AMOUNT")}</small><strong>25.00 USDC</strong></div><Check size={20} /></div>
        <div className="lp-receipt-row"><span>03</span><div><small>{t("授权范围", "PERMISSIONS")}</small><strong>{t("仅本次转账", "This transfer only")}</strong></div><Check size={20} /></div>
        <div className="lp-receipt-end"><span>{t("了解操作，再去钱包确认。", "Understand it. Then confirm in your wallet.")}</span><div className="lp-barcode" /></div>
        <div className="lp-scan-highlight" />
      </div>
      <div className="lp-margin-note" aria-hidden="true">
        <span className="lp-note-asterisk">✳</span><span className="lp-note-label">{t("确认前，问自己", "BEFORE YOU CONFIRM")}</span>
        <strong>{t("这就是我", "Is this what")}<br />{t("想做的吗？", "I intended?")}</strong>
        <p>{t("地址、数量、权限。三个重点，逐一看清。", "The address. The amount. The permissions. All in view.")}</p>
        <svg className="lp-note-arrow" viewBox="0 0 140 55" fill="none"><path d="M132 8C104 46 70 42 12 31M12 31L29 21M12 31L25 44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </div>
      <div className="lp-scene-foot" aria-hidden="true"><span>{t("示例演示 · 不会发起交易", "ILLUSTRATION · NO TRANSACTION IS SENT")}</span><span>TX / 025</span></div>
    </div>
  );
}

export default function Home({ initialLocale, initialPreference = "auto" }: {
  initialLocale: Locale;
  initialPreference?: LanguagePreference;
}) {
  const automaticLocale = useSyncExternalStore(subscribeLocale, browserLocale, () => initialLocale);
  const [preference, setPreference] = useState<LanguagePreference>(initialPreference);
  const locale = preference === "auto" ? automaticLocale : preference;
  const [selected, setSelected] = useState(0);
  const [decision, setDecision] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const demoTabs = useRef<HTMLDivElement>(null);
  const t = (zh: string, en: string) => tr(locale, zh, en);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = locale === "zh" ? "TxLens — 看清操作，再确认" : "TxLens — Clarity before you confirm";
  }, [locale]);
  useEffect(() => {
    const root = page.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("lp-in-view");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08 });
    root.querySelectorAll("[data-reveal]").forEach((element) => {
      // Only animate content that is below the fold; never conceal the initial view.
      if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add("lp-will-reveal");
      observer.observe(element);
    });
    const optics = root.querySelector(".lp-receipt-scene");
    const motionObserver = new IntersectionObserver(([entry]) => {
      if (optics) optics.setAttribute("data-offscreen", String(!entry.isIntersecting));
    });
    if (optics) motionObserver.observe(optics);
    return () => { observer.disconnect(); motionObserver.disconnect(); };
  }, []);

  function changeLanguage(value: string) {
    const next = languagePreference(value);
    setPreference(next);
    document.cookie = `${WEBSITE_LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=${next === "auto" ? 0 : 31536000}; SameSite=Lax`;
  }
  function selectScenario(index: number) { setSelected(index); setDecision(null); }
  async function explain(): Promise<Explanation> {
    const res = await fetch("/api/explain", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, request: examples[selected] }),
    });
    return res.json();
  }
  const scenarios = [
    { icon: InfinityIcon, name: t("无限授权", "Unlimited approval"), description: t("这次授权，允许对方使用多少资产？", "How much access does this approval give?") },
    { icon: ArrowUpRight, name: t("代币转账", "Token transfer"), description: t("把多少资产，发送到哪个地址？", "How much are you sending, and to whom?") },
    { icon: ScanLine, name: t("比例扣费", "Percentage payment"), description: t("请求中是否包含额外的扣费指令？", "Does this request include a payment instruction?") },
  ];
  return (
    <div className="landing" data-locale={locale} ref={page} id="top">
      <a className="lp-skip" href="#main">{t("跳转到内容", "Skip to content")}</a>
      <header className="lp-header">
        <nav className="lp-nav lp-container" aria-label={t("主导航", "Main navigation")}>
          <a className="lp-home-link" href="#top" aria-label={t("TxLens 首页", "TxLens home")}><Brand /></a>
          <div className="lp-nav-links"><a href="#how">{t("如何使用", "How it works")}</a><a href="#preview">{t("体验演示", "Try it out")}</a></div>
          <div className="lp-nav-actions">
            <label className="lp-language">
              <Globe2 size={15} aria-hidden="true" />
              <select
                aria-label={t("网站语言", "Website language")}
                value={preference}
                onChange={(event) => changeLanguage(event.target.value)}
              >
                <option value="auto">{t("跟随浏览器", "Auto (browser)")}</option>
                <option value="zh">简体中文</option>
                <option value="en">English</option>
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
            <a className="lp-nav-install" href="#install">{t("获取插件", "Get TxLens")}<ArrowUpRight size={16} /></a>
          </div>
        </nav>
      </header>
      <main id="main">
        <section className="lp-hero lp-container" aria-labelledby="hero-title">
          <div className="lp-hero-copy">
            <div className="lp-kicker"><span className="lp-signal" />{t("每一笔，都值得看清楚", "KNOW WHAT YOU’RE SIGNING")}</div>
            <h1 id="hero-title">{t("签名之前，", "Before you sign,")}<br /><span>{t("先看清楚。", "see the whole story.")}</span></h1>
            <p className="lp-hero-description">{t("转给谁、转多少、授权多大。TxLens 在钱包确认前，帮你看清每次操作。", "Who gets your funds. How much. What access you grant. See what a request means before confirming in your wallet.")}</p>
            <div className="lp-hero-actions"><a className="lp-button lp-button-accent" href="#install"><ArrowDownToLine size={18} />{t("免费获取 TxLens", "Get TxLens free")}<ArrowUpRight size={18} /></a><a className="lp-demo-link" href="#preview">{t("亲自试一下", "Explore the demo")}<ArrowRight size={18} /></a></div>
            <div className="lp-trust"><span><Check size={14} />{t("不收交易抽成", "No commission")}</span><span><LockKeyhole size={13} />{t("无需私钥", "No private keys")}</span></div>
          </div>
          <div className="lp-hero-visual"><TransactionReceipt locale={locale} paused={paused} />
            <button className="lp-motion-control" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {paused ? <Play size={13} /> : <Pause size={13} />}<span>{paused ? t("播放动画", "Play motion") : t("暂停动画", "Pause motion")}</span>
            </button>
            <span className="lp-static-label">{t("已跟随系统关闭动画", "Reduced motion enabled")}</span>
          </div>
          <div className="lp-hero-bottom"><span>{t("浏览器插件 · Chrome / Edge", "BROWSER EXTENSION · CHROME / EDGE")}</span><a href="#how" aria-label={t("了解使用流程", "Explore how it works")}><ArrowDown size={17} /></a><span className="lp-orbio-credit"><Sparkles size={13} />{t("AI 操作说明由 Orbio 提供", "AI EXPLANATIONS VIA ORBIO")}</span></div>
        </section>

        <section className="lp-how lp-container" id="how" aria-labelledby="how-title">
          <div className="lp-section-heading" data-reveal><div><span className="lp-eyebrow">01 / {t("融入你的习惯", "FITS YOUR FLOW")}</span><h2 id="how-title">{t("多一份清晰。", "One more moment of clarity.")}<br /><span>{t("决定，依然在你。", "The decision stays yours.")}</span></h2></div><p>{t("无需复制交易数据。照常使用网站，TxLens 会在支持的钱包请求进入确认前出现。", "No copying transaction data. Use your dApp as usual. TxLens appears before supported requests reach your wallet.")}</p></div>
          <div className="lp-flow" data-reveal>
            {[
              { icon: MousePointer2, label: t("照常操作", "Make your move"), context: t("你常用的网站", "YOUR DAPP"), text: t("兑换、转账或授权。从你熟悉的网站发起操作。", "Swap, transfer or approve. Start from the site you already use.") },
              { icon: FileText, label: t("先看明白", "See the request"), context: "TXLENS", text: t("立即查看可识别的金额与权限，需要时再让 AI 解释。", "See recognized amounts and permissions immediately. Ask AI when you want more detail.") },
              { icon: Wallet, label: t("由你确认", "You decide"), context: t("你的钱包", "YOUR WALLET"), text: t("取消就停下。继续才进入钱包，最终签名由你确认。", "Cancel to stop. Continue to your wallet, where you decide whether to sign.") },
            ].map(({ icon: Icon, label, context, text }, i) => <article className={`lp-flow-step ${i === 1 ? "lp-flow-focus" : ""}`} key={context}>
              <div className="lp-flow-line"><span className="lp-flow-icon"><Icon size={25} strokeWidth={1.5} /></span><span className="lp-flow-context">{context}</span><span className="lp-step-index">0{i + 1}</span></div><h3>{label}</h3><p>{text}</p>{i < 2 && <ChevronRight className="lp-flow-arrow" size={18} />}
            </article>)}
          </div>
          <div className="lp-control-note" data-reveal><CirclePause size={19} /><p>{t("需要快速操作？可以为指定网站暂停审阅，随时恢复。", "Need to move quickly? Pause reviews for a specific site, and resume whenever you like.")}</p><span>{t("按你的节奏", "YOUR PACE")}</span></div>
        </section>

        <section className="lp-demo-section" id="preview" aria-labelledby="demo-title">
          <div className="lp-demo-grid lp-container">
            <div className="lp-demo-copy" data-reveal>
              <span className="lp-eyebrow">02 / {t("亲自体验", "TAKE A CLOSER LOOK")}</span>
              <h2 id="demo-title">{t("别凭感觉，", "Less guessing.")}<span>{t("亲自看一遍。", " More understanding.")}</span></h2>
              <p>{t("选一笔示例请求，体验 TxLens 如何展示关键信息。无需连接钱包，不会发起交易。", "Choose a sample request and see what TxLens reveals. No wallet connection. No transactions.")}</p>
              <div className="lp-scenarios" role="tablist" aria-label={t("演示场景", "Demo scenarios")} aria-orientation="horizontal" ref={demoTabs}>
                {scenarios.map(({ icon: Icon, name, description }, i) => <button type="button" role="tab" id={`scenario-${i}`} aria-controls="demo-panel" aria-selected={selected === i} tabIndex={selected === i ? 0 : -1} key={name} onClick={() => selectScenario(i)} onKeyDown={(event) => {
                  let next: number;
                  if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (i + 1) % scenarios.length;
                  else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (i + scenarios.length - 1) % scenarios.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = scenarios.length - 1;
                  else return;
                  event.preventDefault(); selectScenario(next);
                  demoTabs.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
                }}><span className="lp-scenario-icon"><Icon size={21} /></span><span><strong>{name}</strong><small>{description}</small></span><ArrowUpRight className="lp-scenario-arrow" size={19} /></button>)}
              </div>
              <div className="lp-demo-aside"><Sparkles size={18} /><p>{t("想了解更多？点击演示中的“分析这次操作”，由 Orbio 提供进一步说明。", "Want more context? Select “Explain this request” in the demo for an explanation powered by Orbio.")}</p></div>
            </div>
            <div className="lp-demo-frame" data-reveal>
              <div className="lp-demo-chrome"><span className="lp-window-dots"><i /><i /><i /></span><span>TxLens / {t("交互演示", "INTERACTIVE DEMO")}</span><span className="lp-demo-badge">{t("示例数据", "SAMPLE DATA")}</span></div>
              <div className="lp-demo-panel" id="demo-panel" role="tabpanel" aria-labelledby={`scenario-${selected}`} tabIndex={0}>
                {decision === null ? <ReviewPanel key={`${selected}:${locale}`} request={examples[selected]} locale={locale} preview onExplain={explain} onDecide={(approved) => setDecision(approved)} /> : <div className="lp-demo-result" role="status">
                  <span className="lp-result-icon">{decision ? <CheckCircle2 size={38} /> : <X size={38} />}</span>
                  <h3>{decision ? t("下一步：钱包确认", "Next: your wallet") : t("请求已取消", "Request cancelled")}</h3>
                  <p>{decision ? t("真实使用时，这一步会打开钱包的最终确认，你仍然可以拒绝。", "In the extension, this opens your wallet’s final confirmation. You can still reject it there.") : t("真实使用时，请求会在这里结束，不会提交给钱包。", "In the extension, the request ends here without being sent to your wallet.")}</p>
                  <small>{t("这是演示，没有产生任何交易。", "This is a preview. No transaction was made.")}</small><button className="lp-button lp-button-accent" onClick={() => setDecision(null)}>{t("再试一次", "Try again")}<ArrowRight size={17} /></button>
                </div>}
              </div>
            </div>
          </div>
        </section>

        <section className="lp-install-section lp-container" id="install" aria-labelledby="install-title">
          <div className="lp-install-intro" data-reveal><span className="lp-eyebrow">03 / {t("从下一笔开始", "FOR YOUR NEXT TRANSACTION")}</span><h2 id="install-title">{t("下一笔交易，", "Your next transaction.")}<br /><span>{t("带上 TxLens。", "A little more clarity.")}</span></h2><div className="lp-install-download"><a className="lp-button lp-button-accent" href="/downloads/txlens-extension.zip" download><ArrowDownToLine size={19} />{t("下载免费插件", "Download TxLens free")}<ArrowUpRight size={19} /></a><span>v0.2.6 · Chrome / Edge {t("桌面版", "desktop")}</span></div></div>
          <div className="lp-install-guide" data-reveal><div className="lp-guide-label"><span>{t("安装指南", "INSTALLATION GUIDE")}</span><span>{t("当前通过安装包加载", "LOAD FROM A ZIP FILE")}</span></div><ol>
            {[
              [t("下载并解压", "Download & unzip"), t("下载上方安装包，把解压后的 txlens-extension 文件夹留在电脑上。", "Download the package above. Keep the extracted txlens-extension folder on your computer.")],
              [t("加载到浏览器", "Add to your browser"), t("打开 Chrome / Edge 的扩展程序管理页，启用“开发者模式”，点击“加载已解压的扩展程序”，选择该文件夹。", "Open Extensions in Chrome or Edge. Enable Developer mode, choose “Load unpacked”, then select the folder.")],
              [t("固定插件，刷新网站", "Pin it. Reload your dApp."), t("安装到你发起交易的浏览器，刷新交易网站。打开 TxLens，确认钱包入口已接入；如果已暂停，请先恢复审阅。", "Use the browser where you make transactions, then reload your dApp. Open TxLens to check wallet attachment and resume any paused reviews.")],
            ].map(([title, description], i) => <li key={title}><span className="lp-install-number">0{i + 1}</span><h3>{title}</h3><p>{description}</p></li>)}
          </ol><p className="lp-service-note"><Sparkles size={15} />{t("基础审阅可离线使用。AI 说明需要运行本机服务，或连接已部署的 TxLens 服务。", "Local review works offline. AI explanations need the local service or a deployed TxLens service.")}</p></div>
          <details className="lp-scope"><summary>{t("目前支持哪些请求？", "Which requests are supported?")}<span>+</span></summary><p>{t("目前支持部分 EVM 钱包请求、常见转账和授权、Permit / Permit2 可读字段，以及已识别路由中的部分扣费指令。未接入或仅部分接入的钱包入口可能漏过请求。暂不支持 Solana 或硬件钱包独立应用，也无法覆盖所有复杂合约。TxLens 不模拟执行；未识别的内容会明确提示。", "Currently supports selected EVM wallet requests, common transfers and approvals, readable Permit / Permit2 fields, and selected payment instructions in recognized routers. Missing or partial wallet attachment can miss requests. Solana, standalone hardware-wallet apps and all complex contracts are not covered. TxLens does not simulate execution; unrecognized details are clearly marked.")}</p></details>
        </section>
      </main>
      <footer className="lp-footer lp-container"><a href="#top" aria-label={t("返回顶部", "Back to top")}><Brand /></a><p>{t("看清操作，再确认。", "Clarity before you confirm.")}</p><div><span><Globe2 size={14} />{preference === "auto" ? t("语言跟随浏览器", "Language follows your browser") : t("语言：简体中文", "Language: English")}</span><span>Built for Orbio<ArrowUpRight size={13} /></span></div></footer>
    </div>
  );
}
