"use client";
import McqGame from "@/components/McqGame";
import { quiz } from "@/data/quiz";
import { useProgress } from "@/lib/progress";

export default function QuizPage() {
  const { progress, update } = useProgress();
  return (
    <McqGame
      title="Quiz con feedback"
      lead="Preguntas de opción múltiple como las de los tests de 10 minutos de TestGorilla. Cada respuesta explica por qué, acertés o no."
      items={quiz}
      done={progress.quiz}
      onAnswer={(id, ok) => { if (ok) update("quiz", id, true); }}
    />
  );
}
