"use client";
import { useMemo, useState } from "react";
import { Topic } from "@/data/types";
import { useContent } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import TopicFilter from "@/components/TopicFilter";
import Inline from "@/components/Inline";

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function EntrevistaPage() {
  const { progress, update } = useProgress();
  const { interviewQuestions } = useContent();
  const { t } = useI18n();
  const [topic, setTopic] = useState<Topic | "all">("all");
  const list = useMemo(() => interviewQuestions.filter((q) => topic === "all" || q.topic === topic), [interviewQuestions, topic]);
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

  if (!q) return <h1>{t("interview.title")}</h1>;
  const covered = q.keyPoints.filter((_, i) => checked[i] || hits.has(i)).length;
  const stars = progress.interview[q.id] ?? 0;

  return (
    <>
      <h1>{t("interview.title")}</h1>
      <p className="lead">{t("interview.lead")}</p>
      <TopicFilter topics={topics} value={topic} onChange={(t) => { setTopic(t); go(0); }} />
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="tag">{t(`topic.${q.topic}`)}</span>
          {stars > 0 && <span className="tag accent">{"★".repeat(stars)}</span>}
          <span className="spacer" />
          <span className="muted">{idx + 1} / {list.length}</span>
        </div>
        <h3 style={{ marginTop: 4 }}>{q.question}</h3>
        <textarea className="plain" placeholder={t("interview.placeholder")} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => setRevealed(true)}>{t("interview.compare")}</button>
          <span className="spacer" />
          <button className="btn ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>{t("common.prev")}</button>
          <button className="btn ghost" disabled={idx >= list.length - 1} onClick={() => go(idx + 1)}>{t("common.next")}</button>
        </div>
      </div>
      {revealed && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("interview.keyPoints", { covered, total: q.keyPoints.length })}</h3>
          <div className="progress-bar"><div style={{ width: `${(covered / q.keyPoints.length) * 100}%` }} /></div>
          <p className="muted">{t("interview.autoNote")}</p>
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
            <summary>{t("interview.modelAnswer")}</summary>
            <p style={{ fontSize: 14.5 }}><Inline text={q.modelAnswer} /></p>
          </details>
          <h3>{t("interview.feel")}</h3>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= stars ? "on" : ""} onClick={() => update("interview", q.id, n)}>★</button>)}
          </div>
          <p className="muted">{t("interview.scale")}</p>
        </div>
      )}
    </>
  );
}
