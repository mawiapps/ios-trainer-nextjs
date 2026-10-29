"use client";
import McqGame from "@/components/McqGame";
import { outputQuestions } from "@/data/output";
import { useProgress } from "@/lib/progress";

export default function SalidaPage() {
  const { progress, update } = useProgress();
  return (
    <McqGame
      title="Predice la salida"
      lead="Leé el Swift y decidí qué imprime (o si no compila). Es el entrenamiento más directo para las trampas del lenguaje."
      defaultQuestion="¿Qué imprime este código?"
      items={outputQuestions}
      done={progress.output}
      onAnswer={(id, ok) => { if (ok) update("output", id, true); }}
    />
  );
}
