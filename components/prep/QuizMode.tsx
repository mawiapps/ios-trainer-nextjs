"use client";
import McqGame from "@/components/McqGame";
import { useContent } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";

export default function QuizMode() {
  const { progress, update } = useProgress();
  const { quiz } = useContent();
  const { t } = useI18n();
  return (
    <McqGame
      lead={t("quiz.lead")}
      items={quiz}
      done={progress.quiz}
      onAnswer={(id, ok) => { if (ok) update("quiz", id, true); }}
    />
  );
}
