import stats from "@/data/courses/stats.json";
import type { Progress } from "@/lib/progress";

export const PASS_SCORE = 70;

type Stats = Record<string, { lessons: string[]; flashcards: string[]; exam: number }>;
const STATS = stats as Stats;

export interface ModuleProgress {
  percent: number;
  lessons: { done: number; total: number };
  flashcards: { done: number; total: number };
  quiz: number | undefined; // mejor nota
}

// % del módulo = promedio de lecciones hechas, flashcards dominadas y quiz (aprobado cuenta completo).
export function moduleProgress(id: string, p: Progress): ModuleProgress {
  const s = STATS[id] ?? { lessons: [], flashcards: [], exam: 0 };
  const lessons = s.lessons.filter((l) => p.lessons[`${id}/${l}`]).length;
  const flashcards = s.flashcards.filter((f) => p.flash[`${id}/${f}`] === "ok").length;
  const quiz = p.exams[id];
  const parts = [
    s.lessons.length ? lessons / s.lessons.length : 0,
    s.flashcards.length ? flashcards / s.flashcards.length : 0,
    quiz === undefined ? 0 : quiz >= PASS_SCORE ? 1 : quiz / 100,
  ];
  return {
    percent: Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100),
    lessons: { done: lessons, total: s.lessons.length },
    flashcards: { done: flashcards, total: s.flashcards.length },
    quiz,
  };
}

export type NextStep =
  | { kind: "lesson"; lessonId: string; index: number }
  | { kind: "flashcards" }
  | { kind: "quiz" }
  | { kind: "done" };

// Orden recomendado dentro de un módulo: lecciones en orden → repasar flashcards → quiz.
export function nextStep(id: string, p: Progress): NextStep {
  const s = STATS[id];
  if (!s) return { kind: "done" };
  const index = s.lessons.findIndex((l) => !p.lessons[`${id}/${l}`]);
  if (index >= 0) return { kind: "lesson", lessonId: s.lessons[index], index };
  if (s.flashcards.some((f) => p.flash[`${id}/${f}`] !== "ok")) return { kind: "flashcards" };
  if ((p.exams[id] ?? 0) < PASS_SCORE) return { kind: "quiz" };
  return { kind: "done" };
}
