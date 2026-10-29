"use client";
import { useState } from "react";
import { codeExercises } from "@/data/code";
import { useProgress } from "@/lib/progress";
import Code from "@/components/Code";
import Inline from "@/components/Inline";

interface Result { checks: { label: string; ok: boolean }[]; warnings: string[]; score: number; }

function evaluate(code: string, ex: (typeof codeExercises)[number]): Result {
  const checks = ex.checks.map((c) => ({ label: c.label, ok: new RegExp(c.pattern, "m").test(code) }));
  const warnings = ex.warnings.filter((w) => new RegExp(w.pattern, "m").test(code)).map((w) => w.label);
  const passed = checks.filter((c) => c.ok).length;
  const base = checks.length ? Math.round((passed / checks.length) * 100) : 0;
  const hasFunc = /func\s+\w+\s*\(/.test(code) || /class\s+\w+/.test(code);
  const hasReturn = /return\b/.test(code);
  let score = base;
  if (!hasFunc) score = Math.min(score, 30);
  if (!hasReturn && !/class\s+\w+/.test(code)) score = Math.min(score, 50);
  score = Math.max(0, score - warnings.length * 15);
  return { checks, warnings, score };
}

export default function CodigoPage() {
  const { progress, update } = useProgress();
  const [idx, setIdx] = useState(0);
  const ex = codeExercises[idx];
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [hint, setHint] = useState(0);
  const [showSol, setShowSol] = useState(false);

  function go(n: number) { setIdx(n); setCode(""); setResult(null); setHint(0); setShowSol(false); }

  function submit() {
    const r = evaluate(code, ex);
    setResult(r);
    const prev = progress.code[ex.id] ?? 0;
    if (r.score > prev) update("code", ex.id, r.score);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const t = e.currentTarget; const s = t.selectionStart; const en = t.selectionEnd;
      const v = code.slice(0, s) + "    " + code.slice(en);
      setCode(v);
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 4; });
    }
  }

  return (
    <>
      <h1>Escribe el código</h1>
      <p className="lead">Sin autocompletado, como en el editor de TestGorilla. Escribí la función completa de memoria y enviá: recibís un checklist de lo que una buena solución necesita, advertencias de errores típicos y la solución de referencia para comparar.</p>
      <div className="filters">
        {codeExercises.map((e, n) => {
          const sc = progress.code[e.id];
          return <button key={e.id} className={n === idx ? "on" : ""} onClick={() => go(n)}>{sc !== undefined ? (sc >= 70 ? "✓ " : `${sc}% `) : ""}{e.title}</button>;
        })}
      </div>
      <div className="card">
        <div className="row"><span className="tag accent">{ex.level === "entry" ? "Entry-level · 15 min" : "Intermedio · 35 min"}</span></div>
        <h3>{ex.title}</h3>
        <p>{ex.prompt}</p>
        <Code>{ex.signature}</Code>
        <h3>Ejemplos</h3>
        <ul className="bullets">{ex.examples.map((e, i) => <li key={i}><code className="inline">{e}</code></li>)}</ul>
        <div className="row">
          <button className="btn small" disabled={hint >= ex.hints.length} onClick={() => setHint((h) => h + 1)}>💡 Pista ({hint}/{ex.hints.length})</button>
          {ex.hints.slice(0, hint).map((h, i) => <span key={i} className="feedback" style={{ marginTop: 0, padding: "6px 10px" }}><Inline text={h} /></span>)}
        </div>
      </div>
      <textarea className="code" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} placeholder={ex.signature.split("\n")[0] + " {\n    \n}"} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={submit} disabled={code.trim().length < 10}>Enviar y revisar</button>
        <button className="btn ghost" onClick={() => setShowSol((s) => !s)}>{showSol ? "Ocultar solución" : "Ver solución"}</button>
        <span className="spacer" />
        <button className="btn ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>← Anterior</button>
        <button className="btn ghost" disabled={idx === codeExercises.length - 1} onClick={() => go(idx + 1)}>Siguiente →</button>
      </div>
      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Revisión · {result.score}%</h3>
          <div className="progress-bar"><div style={{ width: `${result.score}%` }} /></div>
          {result.checks.map((c, i) => <div key={i} className={`check ${c.ok ? "ok" : "miss"}`}><span className="dot">{c.ok ? "✓" : "✗"}</span><span><Inline text={c.label} /></span></div>)}
          {result.warnings.map((w, i) => <div key={i} className="check warn"><span className="dot">⚠</span><span><Inline text={w} /></span></div>)}
          <p className="muted" style={{ marginTop: 10 }}>Este chequeo busca las construcciones clave; no ejecuta Swift. Compará con la solución y probá tus edge cases mentalmente: vacío, un elemento, duplicados, k &gt; n.</p>
        </div>
      )}
      {showSol && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Solución de referencia</h3>
          <Code>{ex.solution}</Code>
        </div>
      )}
    </>
  );
}
