"use client";
import { useState } from "react";
import Link from "next/link";
import { Topic } from "@/data/types";
import { useContent } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import TopicFilter from "@/components/TopicFilter";
import Code from "@/components/Code";
import Inline from "@/components/Inline";

export default function Teoria() {
  const { progress, update } = useProgress();
  const { theory } = useContent();
  const { t: tr } = useI18n();
  const [topic, setTopic] = useState<Topic | "all">("all");
  const topics = Array.from(new Set(theory.map((t) => t.topic)));
  const list = theory.filter((t) => topic === "all" || t.topic === topic);
  return (
    <>
      <h1>{tr("theory.title")}</h1>
      <p className="lead">{tr("theory.lead")} <Link href="/cursos" style={{ color: "var(--accent-2)" }}>{tr("theory.leadLink")}</Link>.</p>
      <TopicFilter topics={topics} value={topic} onChange={setTopic} />
      {list.map((t) => {
        const read = !!progress.theory[t.id];
        return (
          <div className="card" key={t.id}>
            <div className="row">
              <span className="tag">{tr(`topic.${t.topic}`)}</span>
              <span className="spacer" />
              <button className={`btn small ${read ? "ok" : ""}`} onClick={() => update("theory", t.id, !read)}>{read ? tr("theory.read") : tr("theory.markRead")}</button>
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


