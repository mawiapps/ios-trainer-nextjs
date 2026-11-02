"use client";
import { useState } from "react";
import type { ExamQuestion } from "@/data/courses/types";
import { useI18n } from "@/lib/i18n";
import Code from "@/components/Code";
import Inline from "@/components/Inline";

export const PASS_SCORE = 70;

// Examen final de un curso: preguntas en orden, explicación después de cada respuesta, nota al final.
export default function CourseExam({ questions, best, onFinish }: {
  questions: ExamQuestion[];
  best?: number;
  onFinish: (score: number) => void;
}) {
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const q = questions[i];

  function start() { setStarted(true); setI(0); setPicked(null); setRight(0); setScore(null); }
  function pick(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === q.answer) setRight((r) => r + 1);
  }
  function next() {
    if (i < questions.length - 1) { setI(i + 1); setPicked(null); return; }
    const s = Math.round((right / questions.length) * 100);
    setScore(s);
    onFinish(s);
  }

  if (!started || score !== null) {
    return (
      <div className="card">
        {score !== null ? (
          <>
            <h3 style={{ marginTop: 0 }}>{t("exam.result", { score })}</h3>
            <div className="progress-bar"><div style={{ width: `${score}%` }} /></div>
            <div className={`feedback ${score >= PASS_SCORE ? "ok" : "bad"}`}>{score >= PASS_SCORE ? t("exam.passed") : t("exam.failed")}</div>
          </>
        ) : (
          <p>{t("exam.intro", { n: questions.length })}</p>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={start}>{score !== null ? t("exam.retry") : t("exam.start")}</button>
          <span className="spacer" />
          {best !== undefined && <span className="muted">{t("exam.best", { score: best })}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="muted">{t("exam.question", { n: i + 1, total: questions.length })}</span>
      </div>
      <div className="progress-bar"><div style={{ width: `${((i + (picked !== null ? 1 : 0)) / questions.length) * 100}%` }} /></div>
      <h3><Inline text={q.question} /></h3>
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
          <b>{picked === q.answer ? t("common.correct") : t("common.wrong")}</b> <Inline text={q.explanation} />
        </div>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <span className="spacer" />
        <button className="btn primary" disabled={picked === null} onClick={next}>{i < questions.length - 1 ? t("common.next") : t("exam.seeResult")}</button>
      </div>
    </div>
  );
}
