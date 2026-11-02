"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import { useContent } from "@/lib/content";
import { prepProgress } from "@/lib/prep";
import { useTab } from "@/lib/useTab";
import LessonsMode from "@/components/prep/LessonsMode";
import FlashcardsMode from "@/components/prep/FlashcardsMode";
import QuizMode from "@/components/prep/QuizMode";
import OutputMode from "@/components/prep/OutputMode";
import CodeMode from "@/components/prep/CodeMode";
import BugsMode from "@/components/prep/BugsMode";
import InterviewMode from "@/components/prep/InterviewMode";
import TheoryMode from "@/components/prep/TheoryMode";

const TABS = ["lessons", "flashcards", "quiz", "output", "code", "bugs", "interview", "theory"] as const;

// Módulo con los modos de práctica originales (preparación del assessment de TestGorilla).
export default function PrepModuleView() {
  const { t } = useI18n();
  const { progress, loaded } = useProgress();
  const content = useContent();
  const [tab, setTab] = useTab(TABS);
  const percent = prepProgress(progress, content);

  return (
    <>
      <Link href="/modulos" className="btn small ghost">{t("modules.back")}</Link>
      <h1 style={{ marginTop: 14 }}>{t("prep.title")}</h1>
      <p className="lead">{t("prep.description")}</p>
      {loaded && (
        <div className="card">
          <b>{t("module.progress", { percent })}</b>
          <div className="progress-bar"><div style={{ width: `${percent}%` }} /></div>
        </div>
      )}
      <div className="tabs" role="tablist" style={{ flexWrap: "wrap" }}>
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t(`prep.tab.${k}`)}</button>
        ))}
      </div>
      {tab === "lessons" && <LessonsMode />}
      {tab === "flashcards" && <FlashcardsMode />}
      {tab === "quiz" && <QuizMode />}
      {tab === "output" && <OutputMode />}
      {tab === "code" && <CodeMode />}
      {tab === "bugs" && <BugsMode />}
      {tab === "interview" && <InterviewMode />}
      {tab === "theory" && <TheoryMode />}
    </>
  );
}
