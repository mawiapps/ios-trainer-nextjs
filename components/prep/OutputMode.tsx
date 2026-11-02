"use client";
import McqGame from "@/components/McqGame";
import { useContent } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";

export default function OutputMode() {
  const { progress, update } = useProgress();
  const { outputQuestions } = useContent();
  const { t } = useI18n();
  return (
    <McqGame
      lead={t("output.lead")}
      defaultQuestion={t("output.question")}
      items={outputQuestions}
      done={progress.output}
      onAnswer={(id, ok) => { if (ok) update("output", id, true); }}
    />
  );
}
