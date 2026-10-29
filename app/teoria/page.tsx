"use client";
import { useState } from "react";
import { theory } from "@/data/theory";
import { Topic, TOPIC_LABEL } from "@/data/types";
import { useProgress } from "@/lib/progress";
import TopicFilter from "@/components/TopicFilter";
import Code from "@/components/Code";
import Inline from "@/components/Inline";

export default function Teoria() {
  const { progress, update } = useProgress();
  const [topic, setTopic] = useState<Topic | "all">("all");
  const topics = Array.from(new Set(theory.map((t) => t.topic)));
  const list = theory.filter((t) => topic === "all" || t.topic === topic);
  return (
    <>
      <h1>Referencia rápida</h1>
      <p className="lead">Resumen comprimido de todo el temario para repasar el día antes. Para aprender cada cosa desde cero, andá a <a href="/lecciones" style={{ color: "var(--accent-2)" }}>Lecciones</a>.</p>
      <TopicFilter topics={topics} value={topic} onChange={setTopic} />
      {list.map((t) => {
        const read = !!progress.theory[t.id];
        return (
          <div className="card" key={t.id}>
            <div className="row">
              <span className="tag">{TOPIC_LABEL[t.topic]}</span>
              <span className="spacer" />
              <button className={`btn small ${read ? "ok" : ""}`} onClick={() => update("theory", t.id, !read)}>{read ? "✓ Leída" : "Marcar leída"}</button>
            </div>
            <h3>{t.title}</h3>
            <p>{t.summary}</p>
            <ul className="bullets">{t.bullets.map((b, i) => <li key={i}><Inline text={b} /></li>)}</ul>
            {t.code && <Code>{t.code}</Code>}
            {t.trap && <div className="trap">⚠️ <Inline text={t.trap} /></div>}
          </div>
        );
      })}
    </>
  );
}


