"use client";
import { useEffect, useState } from "react";
import { Step } from "@/data/lessons";
import Code from "@/components/Code";
import Inline from "@/components/Inline";
import { useI18n } from "@/lib/i18n";

type Props = { lesson: { title: string; goal: string; steps: Step[] }; done: boolean; onComplete: () => void; onExit: () => void; backLabel?: string };

export default function LessonPlayer({ lesson, done, onComplete, onExit, backLabel }: Props) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [solved, setSolved] = useState<Record<number, boolean>>({});
  const step = lesson.steps[i];
  const total = lesson.steps.length;
  const isLast = i === total - 1;
  const canNext = step.kind === "explain" || !!solved[i];

  useEffect(() => { window.scrollTo({ top: 0 }); }, [i]);

  function next() {
    if (isLast) { onComplete(); onExit(); return; }
    setI(i + 1);
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn small ghost" onClick={onExit}>{backLabel ?? t("lessons.back")}</button>
        <span className="spacer" />
        <span className="muted">{t("player.step", { n: i + 1, total })}</span>
      </div>
      <div className="progress-bar"><div style={{ width: `${((i + (canNext ? 1 : 0)) / total) * 100}%` }} /></div>
      <h1 style={{ fontSize: 22, marginTop: 14 }}>{lesson.title}</h1>
      <p className="lead" style={{ marginBottom: 16 }}>{lesson.goal}</p>

      <div className="card">
        {step.kind === "explain" && <Explain step={step} />}
        {step.kind === "predict" && <Predict key={i} step={step} onSolved={() => setSolved((s) => ({ ...s, [i]: true }))} />}
        {step.kind === "fill" && <Fill key={i} step={step} onSolved={() => setSolved((s) => ({ ...s, [i]: true }))} />}
        {step.kind === "write" && <WriteStep key={i} step={step} onSolved={() => setSolved((s) => ({ ...s, [i]: true }))} />}
      </div>

      <div className="row">
        <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>{t("common.prev")}</button>
        <span className="spacer" />
        <button className="btn primary" disabled={!canNext} onClick={next}>{isLast ? (done ? t("player.finish") : t("player.complete")) : t("common.next")}</button>
      </div>
    </>
  );
}

function Explain({ step }: { step: Extract<Step, { kind: "explain" }> }) {
  const { t } = useI18n();
  return (
    <>
      <span className="tag">{t("player.explanation")}</span>
      <h3>{step.title}</h3>
      {step.body.map((p, k) => <p key={k} style={{ fontSize: 15 }}><Inline text={p} /></p>)}
      {step.code && <Code>{step.code}</Code>}
      {step.output && (
        <div style={{ marginTop: 8 }}>
          <div className="muted" style={{ marginBottom: 4 }}>{t("player.output")}</div>
          <pre style={{ background: "#0b0d11", color: "var(--ok)" }}>{step.output}</pre>
        </div>
      )}
    </>
  );
}

function Predict({ step, onSolved }: { step: Extract<Step, { kind: "predict" }>; onSolved: () => void }) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const correct = picked === step.answer;
  function pick(idx: number) {
    if (correct) return;
    setPicked(idx);
    setTries((t) => t + 1);
    if (idx === step.answer) onSolved();
  }
  return (
    <>
      <span className="tag accent">{step.prompt ? t("player.tagQuestion") : t("player.tagPredict")}</span>
      <h3><Inline text={step.prompt ?? t("player.predictDefault")} /></h3>
      {step.code && <div style={{ margin: "8px 0 14px" }}><Code>{step.code}</Code></div>}
      {step.options.map((o, idx) => {
        let cls = "option";
        if (picked !== null) {
          if (idx === step.answer && correct) cls += " correct";
          else if (idx === picked) cls += " wrong";
        }
        return <button key={idx} className={cls} onClick={() => pick(idx)}><Inline text={o} /></button>;
      })}
      {picked !== null && (
        <div className={`feedback ${correct ? "ok" : "bad"}`}>
          <b>{correct ? t("common.correct") : t("player.tryAgain")}</b> {correct ? <Inline text={step.explanation} /> : tries >= 2 ? <span>{t("player.hintPrefix")} <Inline text={step.explanation} /></span> : null}
        </div>
      )}
    </>
  );
}

function norm(s: string) { return s.trim().replace(/\s+/g, " "); }

function Fill({ step, onSolved }: { step: Extract<Step, { kind: "fill" }>; onSolved: () => void }) {
  const { t } = useI18n();
  const [val, setVal] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");
  const [tries, setTries] = useState(0);
  const [before, after] = step.code.split("____");
  function check() {
    const ok = step.accept.some((re) => new RegExp(re, "i").test(norm(val)));
    setState(ok ? "ok" : "bad");
    setTries((t) => t + 1);
    if (ok) onSolved();
  }
  return (
    <>
      <span className="tag accent">{t("player.tagFill")}</span>
      <h3><Inline text={step.prompt} /></h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {before}
        <input
          value={val}
          disabled={state === "ok"}
          onChange={(e) => { setVal(e.target.value); setState("idle"); }}
          onKeyDown={(e) => { if (e.key === "Enter") check(); }}
          placeholder={step.placeholder ?? "…"}
          spellCheck={false}
          style={{ background: state === "ok" ? "rgba(61,220,132,.15)" : state === "bad" ? "rgba(255,92,92,.15)" : "#0b0d11", border: `1px solid ${state === "ok" ? "var(--ok)" : state === "bad" ? "var(--bad)" : "var(--accent)"}`, color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13.5, padding: "2px 8px", borderRadius: 6, minWidth: 120, width: `${Math.max(12, val.length + 2)}ch` }}
        />
        {after}
      </pre>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={check} disabled={!val.trim() || state === "ok"}>{t("player.check")}</button>
        {step.hint && tries >= 1 && state !== "ok" && <span className="muted">💡 <Inline text={step.hint} /></span>}
      </div>
      {state === "ok" && <div className="feedback ok"><b>{t("common.correct")}</b> <Inline text={step.explanation} /></div>}
      {state === "bad" && <div className="feedback bad"><b>{t("player.notThat")}</b> {tries >= 3 ? <span>{t("player.expected")} <code className="inline">{step.accept[0].replace(/^\^|\$$/g, "").replace(/\\/g, "").replace(/\(\\\)/g, "()")}</code>. <Inline text={step.explanation} /></span> : t("player.reviewPrev")}</div>}
    </>
  );
}

function WriteStep({ step, onSolved }: { step: Extract<Step, { kind: "write" }>; onSolved: () => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState(step.starter ?? "");
  const [result, setResult] = useState<{ checks: { label: string; ok: boolean }[]; warnings: string[] } | null>(null);
  const [showSol, setShowSol] = useState(false);
  const [showHint, setShowHint] = useState(false);

  function check() {
    const checks = step.checks.map((c) => ({ label: c.label, ok: new RegExp(c.pattern, "m").test(code) }));
    const warnings = (step.warnings ?? []).filter((w) => new RegExp(w.pattern, "m").test(code)).map((w) => w.label);
    setResult({ checks, warnings });
    if (checks.every((c) => c.ok) && warnings.length === 0) onSolved();
  }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const t = e.currentTarget; const s = t.selectionStart; const en = t.selectionEnd;
      setCode(code.slice(0, s) + "    " + code.slice(en));
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 4; });
    }
  }
  const allOk = result && result.checks.every((c) => c.ok) && result.warnings.length === 0;
  return (
    <>
      <span className="tag accent">{t("player.tagWrite")}</span>
      <h3><Inline text={step.prompt} /></h3>
      <textarea className="code" style={{ minHeight: 180 }} spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={check} disabled={code.trim().length < 10}>{t("player.review")}</button>
        {step.hint && <button className="btn ghost small" onClick={() => setShowHint(true)}>{t("common.hint")}</button>}
        <button className="btn ghost small" onClick={() => setShowSol((s) => !s)}>{showSol ? t("common.hideSolution") : t("common.showSolution")}</button>
      </div>
      {showHint && step.hint && <div className="feedback"><Inline text={step.hint} /></div>}
      {result && (
        <div className={`feedback ${allOk ? "ok" : ""}`} style={{ marginTop: 12 }}>
          <b>{allOk ? t("player.allGood") : t("player.missing")}</b>
          {result.checks.map((c, k) => <div key={k} className={`check ${c.ok ? "ok" : "miss"}`}><span className="dot">{c.ok ? "✓" : "✗"}</span><span><Inline text={c.label} /></span></div>)}
          {result.warnings.map((w, k) => <div key={k} className="check warn"><span className="dot">⚠</span><span><Inline text={w} /></span></div>)}
          <div className="muted" style={{ marginTop: 6 }}>{t("player.patternNote")}</div>
        </div>
      )}
      {showSol && <div style={{ marginTop: 12 }}><div className="muted" style={{ marginBottom: 4 }}>{t("common.solutionRef")}</div><Code>{step.solution}</Code></div>}
    </>
  );
}
