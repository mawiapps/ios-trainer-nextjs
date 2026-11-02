import type { Progress } from "@/lib/progress";
import type * as Content from "@/data/es";

export const PREP_ID = "prep-testgorilla";

// % del módulo de preparación = promedio de cada modo de práctica.
export function prepProgress(p: Progress, c: typeof Content) {
  const ratio = (done: number, total: number) => (total ? done / total : 0);
  const parts = [
    ratio(c.lessons.filter((l) => p.lessons[l.id]).length, c.lessons.length),
    ratio(c.flashcards.filter((f) => p.flash[f.id] === "ok").length, c.flashcards.length),
    ratio(c.quiz.filter((q) => p.quiz[q.id]).length, c.quiz.length),
    ratio(c.outputQuestions.filter((q) => p.output[q.id]).length, c.outputQuestions.length),
    ratio(c.codeExercises.filter((e) => (p.code[e.id] ?? 0) >= 70).length, c.codeExercises.length),
    ratio(c.bugExercises.filter((b) => p.bugs[b.id]).length, c.bugExercises.length),
    ratio(c.interviewQuestions.filter((q) => (p.interview[q.id] ?? 0) >= 4).length, c.interviewQuestions.length),
  ];
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}
