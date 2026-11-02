"use client";
import { useMemo, useState } from "react";
import type { Step } from "@/data/lessons";
import type { CourseLesson } from "@/data/courses/types";
import { shuffle } from "@/lib/progress";
import { useI18n } from "@/lib/i18n";
import Inline from "@/components/Inline";
import { Fill, Predict, WriteStep } from "@/components/LessonPlayer";

type Exercise = { key: string; lesson: string; step: Exclude<Step, { kind: "explain" }> };

// Práctica mezclada: todos los ejercicios de las lecciones del módulo, en orden aleatorio y sin la explicación previa.
export default function ModulePractice({ lessons }: { lessons: CourseLesson[] }) {
  const { t } = useI18n();
  const all = useMemo<Exercise[]>(
    () => lessons.flatMap((l) => l.steps.flatMap((s, n) => (s.kind === "explain" ? [] : [{ key: `${l.id}#${n}`, lesson: l.title, step: s }]))),
    [lessons],
  );
  const [order, setOrder] = useState(() => shuffle(all.map((e) => e.key)));
  const [i, setI] = useState(0);
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const ex = all.find((e) => e.key === order[i]);
  const right = Object.values(solved).filter(Boolean).length;

  function restart() { setOrder(shuffle(all.map((e) => e.key))); setI(0); setSolved({}); }

  if (!ex) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("practice.done", { right, total: order.length })}</h3>
        <button className="btn primary" onClick={restart}>{t("mcq.again")}</button>
      </div>
    );
  }

  const onSolved = () => setSolved((s) => ({ ...s, [ex.key]: true }));
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>{t("practice.lead")}</p>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="muted">{t("practice.count", { n: i + 1, total: order.length, right })}</span>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="tag"><Inline text={ex.lesson} /></span>
        </div>
        {ex.step.kind === "predict" && <Predict key={ex.key} step={ex.step} onSolved={onSolved} />}
        {ex.step.kind === "fill" && <Fill key={ex.key} step={ex.step} onSolved={onSolved} />}
        {ex.step.kind === "write" && <WriteStep key={ex.key} step={ex.step} onSolved={onSolved} />}
      </div>
      <div className="row">
        <span className="spacer" />
        <button className={`btn ${solved[ex.key] ? "primary" : "ghost"}`} onClick={() => setI(i + 1)}>{solved[ex.key] ? t("common.next") : t("practice.skip")}</button>
      </div>
    </>
  );
}
