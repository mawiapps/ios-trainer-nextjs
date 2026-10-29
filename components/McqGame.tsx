"use client";
import { useEffect, useMemo, useState } from "react";
import { Topic, TOPIC_LABEL } from "@/data/types";
import { shuffle } from "@/lib/progress";
import TopicFilter from "@/components/TopicFilter";
import Code from "@/components/Code";
import Inline from "@/components/Inline";

export interface McqItem {
  id: string;
  topic?: Topic;
  question?: string;
  code?: string;
  options: string[];
  answer: number;
  explanation: string;
}

export default function McqGame({ items, done, onAnswer, title, lead, defaultQuestion }: {
  items: McqItem[];
  done: Record<string, boolean>;
  onAnswer: (id: string, correct: boolean) => void;
  title: string;
  lead: string;
  defaultQuestion?: string;
}) {
  const topics = Array.from(new Set(items.map((q) => q.topic).filter(Boolean))) as Topic[];
  const [topic, setTopic] = useState<Topic | "all">("all");
  const [order, setOrder] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [session, setSession] = useState({ right: 0, total: 0 });

  const pool = useMemo(() => items.filter((q) => topic === "all" || q.topic === topic), [items, topic]);
  useEffect(() => { setOrder(shuffle(pool.map((q) => q.id))); setI(0); setPicked(null); setSession({ right: 0, total: 0 }); }, [pool]);

  const q = items.find((x) => x.id === order[i]);
  const correctCount = Object.values(done).filter(Boolean).length;

  function pick(idx: number) {
    if (!q || picked !== null) return;
    setPicked(idx);
    const ok = idx === q.answer;
    onAnswer(q.id, ok);
    setSession((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  }

  return (
    <>
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      {topics.length > 0 && <TopicFilter topics={topics} value={topic} onChange={setTopic} />}
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="muted">Sesión: {session.right} / {session.total} correctas</span>
        <span className="spacer" />
        <span className="muted">Acertadas alguna vez: {correctCount} / {items.length}</span>
      </div>
      {!q ? (
        <div className="card">
          <h3>Terminaste la ronda: {session.right} / {session.total}</h3>
          <button className="btn primary" onClick={() => { setOrder(shuffle(pool.map((x) => x.id))); setI(0); setPicked(null); setSession({ right: 0, total: 0 }); }}>Otra ronda</button>
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            {q.topic && <span className="tag">{TOPIC_LABEL[q.topic]}</span>}
            {done[q.id] && <span className="tag accent">ya acertada</span>}
            <span className="spacer" />
            <span className="muted">{i + 1} / {order.length}</span>
          </div>
          <h3 style={{ marginTop: 4 }}><Inline text={q.question ?? defaultQuestion ?? ""} /></h3>
          {q.code && <div style={{ margin: "10px 0 16px" }}><Code>{q.code}</Code></div>}
          {q.options.map((opt, idx) => {
            let cls = "option";
            if (picked !== null) {
              if (idx === q.answer) cls += " correct";
              else if (idx === picked) cls += " wrong";
              else cls += " dim";
            }
            return <button key={idx} className={cls} onClick={() => pick(idx)}><Inline text={opt} /></button>;
          })}
          {picked !== null && (
            <div className={`feedback ${picked === q.answer ? "ok" : "bad"}`}>
              <b>{picked === q.answer ? "Correcto." : "No es esa."}</b> <Inline text={q.explanation} />
            </div>
          )}
          <div className="row" style={{ marginTop: 16 }}>
            <span className="spacer" />
            <button className="btn primary" disabled={picked === null} onClick={() => { setI((x) => x + 1); setPicked(null); }}>Siguiente →</button>
          </div>
        </div>
      )}
    </>
  );
}
