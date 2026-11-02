"use client";
import { useState } from "react";
import { useContent } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import Inline from "@/components/Inline";

export default function BugsPage() {
  const { progress, update } = useProgress();
  const { bugExercises } = useContent();
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const ex = bugExercises[idx];
  const lines = ex.code.split("\n");

  function go(n: number) { setIdx(n); setSel(null); setRevealed(false); }
  function check() {
    if (sel === null) return;
    setRevealed(true);
    if (sel === ex.bugLine) update("bugs", ex.id, true);
  }
  const correct = revealed && sel === ex.bugLine;

  return (
    <>
      <h1>{t("bugs.title")}</h1>
      <p className="lead">{t("bugs.lead")}</p>
      <div className="filters">
        {bugExercises.map((b, n) => <button key={b.id} className={n === idx ? "on" : ""} onClick={() => go(n)}>{progress.bugs[b.id] ? "✓ " : ""}{b.title}</button>)}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{ex.title}</h3>
        <p>{ex.description}</p>
        <div className="codelines">
          {lines.map((l, i) => {
            const n = i + 1;
            let cls = "line";
            if (!revealed && sel === n) cls += " sel";
            if (revealed && n === ex.bugLine) cls += " bug";
            return <div key={i} className={cls} onClick={() => !revealed && setSel(n)}><span className="n">{n}</span><span>{l || " "}</span></div>;
          })}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={sel === null || revealed} onClick={check}>{t("bugs.thisLine")}</button>
          <span className="spacer" />
          <button className="btn ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>{t("common.prev")}</button>
          <button className="btn ghost" disabled={idx === bugExercises.length - 1} onClick={() => go(idx + 1)}>{t("common.next")}</button>
        </div>
        {revealed && (
          <div className={`feedback ${correct ? "ok" : "bad"}`}>
            <b>{correct ? t("bugs.exact") : t("bugs.wrongLine", { n: ex.bugLine })}</b> <Inline text={ex.explanation} />
            <div style={{ marginTop: 8 }}>{t("bugs.fixed")} <code className="inline">{ex.fixedLine.trim()}</code></div>
          </div>
        )}
      </div>
    </>
  );
}
