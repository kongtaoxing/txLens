"use client";
import { Check, CircleHelp, Download, ExternalLink, ScanLine, ShieldAlert, ShieldCheck, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allowanceLabel, display } from "@/lib/txlens/checks";
import type { ReviewInput, ReviewReport, Trace } from "@/lib/txlens/types";

export function TraceList({ trace, running = false }: { trace: Trace[]; running?: boolean }) {
  return <ol className="trace-list">{trace.map((step, index) => <li key={`${index}-${step.tool}`}>
    <span className="trace-number">{String(index + 1).padStart(2, "0")}</span>
    <div><strong>{step.label}</strong><p>{step.detail}</p><span className="trace-meta">{step.source} · {step.durationMs < 1000 ? `${step.durationMs} ms` : `${(step.durationMs / 1000).toFixed(1)} s`}</span></div>
  </li>)}{running && <li><span className="trace-number working">•</span><div><strong>Agent is investigating</strong><p>Choosing the next check or composing its explanation.</p></div></li>}</ol>;
}

export function EmptyReport({ trace, running }: { trace: Trace[]; running: boolean }) {
  if (running) return <section className="panel result-panel"><div className="panel-heading"><h2><ScanLine size={19} aria-hidden="true"/> Investigation in progress</h2><span className="live-label">LIVE</span></div><TraceList trace={trace} running/></section>;
  return <section className="panel result-empty"><div className="lens-mark"><ScanLine size={42} aria-hidden="true"/></div><span className="eyebrow">EVIDENCE BEFORE CONFIDENCE</span><h2>Every check, in the open.</h2><p>Compare the proposed transaction with your limits. Follow the agent’s tools, inspect the evidence, and recheck a correction.</p><div className="empty-steps"><span>01 Decode</span><span>02 Investigate</span><span>03 Verify</span></div></section>;
}

export function Report({ report, input, onRepair }: { report: ReviewReport; input: ReviewInput; onRepair: () => void }) {
  const failed = report.checks.filter(c => c.status === "fail").length;
  const unresolved = report.checks.filter(c => c.status === "unknown").length;
  const Icon = failed ? ShieldAlert : unresolved ? CircleHelp : ShieldCheck;
  const title = failed ? "This transaction misses your intent." : unresolved ? "More evidence is needed." : "The checked transaction matches.";
  function download() {
    const blob = new Blob([JSON.stringify({ input, report }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `txlens-${report.id.slice(0, 8)}.json`; link.click();
    URL.revokeObjectURL(link.href);
  }
  return <section className={`panel result-panel verdict-${report.verdict}`} aria-label="Analysis results">
    <div className="panel-heading"><h2>Verification report</h2><Button variant="ghost" size="sm" onClick={download}><Download size={15} aria-hidden="true"/> Export</Button></div>
    <div className="verdict"><Icon size={30} aria-hidden="true"/><div><span className="eyebrow">{failed ? `${failed} MISMATCH${failed > 1 ? "ES" : ""} FOUND` : "REVIEW COMPLETE"}</span><h2>{title}</h2><p>{report.checks.filter(c => c.status === "pass").length} passed · {failed} failed · {unresolved} unresolved</p></div></div>
    <div className="source-row"><span>{report.mode === "demo" ? "DEMO CHAIN DATA" : "LIVE CHAIN QUERY"}</span><span>{report.modelCalls ? `${report.modelCalls} REAL MODEL CALLS` : "NO MODEL RESPONSE"}</span></div>
    <div className="agent-summary"><span className="eyebrow">AGENT FINDINGS</span><p>{report.explanation}</p>{report.aiError && <p className="error-text">{report.aiError}</p>}<div className="model-meta">{report.provider} · {report.model || "Model not configured"} · {report.tokens.toLocaleString()} tokens</div></div>
    {report.repair && <div className="repair"><div><WandSparkles size={19} aria-hidden="true"/><h3>A correction is available</h3></div><ul>{report.repair.changes.map(change => <li key={change}>{change}</li>)}</ul><Button onClick={onRepair} className="repair-button">Apply correction & recheck</Button><p>Updates the unsigned bundle in this workspace. Nothing is sent onchain.</p></div>}
    <Tabs defaultValue="checks" className="report-tabs"><TabsList variant="line"><TabsTrigger value="checks">Evidence</TabsTrigger><TabsTrigger value="trace">Agent activity</TabsTrigger><TabsTrigger value="transaction">Decoded calls</TabsTrigger></TabsList>
      <TabsContent value="checks"><div className="checks">{[...report.checks].sort((a,b) => ({fail:0,unknown:1,pass:2}[a.status] - {fail:0,unknown:1,pass:2}[b.status])).map(check => <div className={`check-row check-${check.status}`} key={check.id}>
        <div className="check-icon">{check.status === "pass" ? <Check size={17} aria-hidden="true"/> : check.status === "fail" ? <X size={17} aria-hidden="true"/> : <CircleHelp size={17} aria-hidden="true"/>}</div>
        <div className="check-content"><div className="check-title"><h3>{check.label}</h3><span>{check.status === "unknown" ? "UNVERIFIED" : check.status.toUpperCase()}</span></div><p>{check.detail}</p>{check.expected && <dl className="comparison"><div><dt>Expected</dt><dd>{check.expected}</dd></div><div><dt>Proposed</dt><dd>{check.actual}</dd></div></dl>}</div>
      </div>)}</div></TabsContent>
      <TabsContent value="trace"><TraceList trace={report.trace}/></TabsContent>
      <TabsContent value="transaction"><div className="decoded">
        <span className="eyebrow">01 · USDG TOKEN</span><h3>approve(spender, amount)</h3><dl><dt>Spender</dt><dd>{report.decoded.spender ?? "Not decoded"}</dd><dt>Allowance</dt><dd>{report.decoded.approval ? allowanceLabel(report.decoded.approval) : "Not decoded"}</dd></dl>
        <span className="eyebrow">02 · ORBIO EXCHANGE</span><h3>buyAndActivate(…)</h3><dl><dt>Input (before fee)</dt><dd>{report.decoded.usdgIn ? `${display(report.decoded.usdgIn)} USDG` : "Not decoded"}</dd><dt>Minimum output</dt><dd>{report.decoded.minCreditOut ? `${display(report.decoded.minCreditOut)} CREDIT` : "Not decoded"}</dd><dt>Beneficiary</dt><dd>{report.decoded.beneficiary ?? "Not decoded"}</dd></dl>
        <a href="https://www.orbio.so/protocol/agents" target="_blank" rel="noreferrer">Published Orbio contracts <ExternalLink size={14} aria-hidden="true"/></a>
      </div></TabsContent>
    </Tabs>

    <p className="report-note">This verifies the listed constraints for the supplied data. It is not a general contract audit or a guarantee of future execution.</p>
  </section>;
}
