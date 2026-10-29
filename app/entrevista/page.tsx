"use client";
import { useMemo, useState } from "react";
import { interviewQuestions } from "@/data/interview";
import { Topic, TOPIC_LABEL } from "@/data/types";
import { useProgress } from "@/lib/progress";
import TopicFilter from "@/components/TopicFilter";
import Inline from "@/components/Inline";

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function EntrevistaPage() {
  const { progress, update } = useProgress();
  const [topic, setTopic] = useState<Topic | "all">("all");
  const list = useMemo(() => interviewQuestions.filter((q) => topic === "all" || q.topic === topic), [topic]);
  const [idx, setIdx] = useState(0);
  const q = list[Math.min(idx, list.length - 1)];
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const topics = Array.from(new Set(interviewQuestions.map((x) => x.topic)));

  function go(n: number) { setIdx(n); setAnswer(""); setRevealed(false); setChecked({}); }

  // keywords auto-detected in the written answer
  const hits = useMemo(() => {
    if (!q) return new Set<number>();
    const a = normalize(answer);
    const s = new Set<number>();
    q.keyPoints.forEach((kp, i) => {
      const words = normalize(kp).replace(/[^a-z0-9@. ]/g, " ").split(/\s+/).filter((w) => w.length > 4);
      const found = words.filter((w) => a.includes(w)).length;
      if (words.length && found / words.length >= 0.4) s.add(i);
    });
    return s;
  }, [answer, q]);

  if (!q) return <h1>Entrevista</h1>;
  const covered = q.keyPoints.filter((_, i) => checked[i] || hits.has(i)).length;
  const stars = progress.interview[q.id] ?? 0;

  return (
    <>
      <h1>Entrevista técnica</h1>
      <p className="lead">Preguntas que GlobalTask puede poner como custom (ensayo o video) y que seguro aparecen en la entrevista técnica. Respondé en voz alta o escribí tu respuesta, luego compará con los puntos clave y autoevaluate.</p>
      <TopicFilter topics={topics} value={topic} onChange={(t) => { setTopic(t); go(0); }} />
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="tag">{TOPIC_LABEL[q.topic]}</span>
          {stars > 0 && <span className="tag accent">{"★".repeat(stars)}</span>}
          <span className="spacer" />
          <span className="muted">{idx + 1} / {list.length}</span>
        </div>
        <h3 style={{ marginTop: 4 }}>{q.question}</h3>
        <textarea className="plain" placeholder="Escribí tu respuesta (o decila en voz alta y anotá los puntos que mencionaste)…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => setRevealed(true)}>Comparar con puntos clave</button>
          <span className="spacer" />
          <button className="btn ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>← Anterior</button>
          <button className="btn ghost" disabled={idx >= list.length - 1} onClick={() => go(idx + 1)}>Siguiente →</button>
        </div>
      </div>
      {revealed && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Puntos clave · cubriste {covered} / {q.keyPoints.length}</h3>
          <div className="progress-bar"><div style={{ width: `${(covered / q.keyPoints.length) * 100}%` }} /></div>
          <p className="muted">Los detectados automáticamente en tu texto aparecen marcados; tildá los que dijiste en voz alta.</p>
          {q.keyPoints.map((kp, i) => {
            const on = checked[i] || hits.has(i);
            return (
              <label key={i} className={`check ${on ? "ok" : "miss"}`} style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={!!on} onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} style={{ marginRight: 8 }} />
                <span><Inline text={kp} /></span>
              </label>
            );
          })}
          <details>
            <summary>Respuesta modelo (90 segundos)</summary>
            <p style={{ fontSize: 14.5 }}><Inline text={q.modelAnswer} /></p>
          </details>
          <h3>¿Cómo te sentiste respondiendo?</h3>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= stars ? "on" : ""} onClick={() => update("interview", q.id, n)}>★</button>)}
          </div>
          <p className="muted">1 = no sabía por dónde empezar · 3 = la idea pero desordenada · 5 = lista para decirla en una entrevista.</p>
        </div>
      )}
    </>
  );
}
