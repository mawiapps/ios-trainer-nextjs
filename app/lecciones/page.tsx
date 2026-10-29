"use client";
import { useState } from "react";
import { lessons } from "@/data/lessons";
import { Topic, TOPIC_LABEL } from "@/data/types";
import { useProgress } from "@/lib/progress";
import LessonPlayer from "@/components/LessonPlayer";

const ORDER: Topic[] = ["swift", "algoritmos", "rest", "ingenieria", "ios", "seguridad", "testing"];

export default function LeccionesPage() {
  const { progress, update, loaded } = useProgress();
  const [active, setActive] = useState<string | null>(null);
  const lesson = lessons.find((l) => l.id === active);
  const doneCount = lessons.filter((l) => progress.lessons?.[l.id]).length;

  if (lesson) {
    return <LessonPlayer lesson={lesson} done={!!progress.lessons?.[lesson.id]} onComplete={() => update("lessons", lesson.id, true)} onExit={() => setActive(null)} />;
  }

  return (
    <>
      <h1>Lecciones interactivas</h1>
      <p className="lead">Cada lección explica un concepto con ejemplos y su salida, y te hace practicarlo en el momento: predecir qué imprime, completar el hueco o escribir la función. No podés avanzar hasta resolver el ejercicio. Seguí el orden: cada una usa lo de la anterior.</p>
      {loaded && <div style={{ marginBottom: 20 }}><div className="progress-bar"><div style={{ width: `${(doneCount / lessons.length) * 100}%` }} /></div><div className="muted">{doneCount} / {lessons.length} lecciones completadas</div></div>}
      {ORDER.map((t) => {
        const group = lessons.filter((l) => l.topic === t);
        if (!group.length) return null;
        return (
          <section key={t}>
            <h2>{TOPIC_LABEL[t]}</h2>
            <div className="grid">
              {group.map((l, n) => {
                const done = !!progress.lessons?.[l.id];
                const ex = l.steps.filter((s) => s.kind !== "explain").length;
                return (
                  <button key={l.id} className="card" style={{ textAlign: "left", cursor: "pointer", border: done ? "1px solid var(--ok)" : undefined }} onClick={() => setActive(l.id)}>
                    <div className="row" style={{ marginBottom: 6 }}>
                      <span className="tag">{n + 1}</span>
                      {done && <span className="tag" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>✓ hecha</span>}
                      <span className="spacer" />
                      <span className="muted">{l.minutes} min · {ex} ejercicios</span>
                    </div>
                    <h3 style={{ margin: "4px 0 6px" }}>{l.title}</h3>
                    <p className="muted" style={{ margin: 0 }}>{l.goal}</p>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
