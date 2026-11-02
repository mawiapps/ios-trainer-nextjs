"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { courses } from "@/data/courses/catalog";
import { loaders } from "@/data/courses";
import type { CourseContent } from "@/data/courses/types";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import { moduleProgress, nextStep } from "@/lib/modules";
import { useTab } from "@/lib/useTab";
import Inline from "@/components/Inline";
import LessonPlayer from "@/components/LessonPlayer";
import CourseDeck from "@/components/CourseDeck";
import CourseExam from "@/components/CourseExam";
import ModulePractice from "@/components/ModulePractice";

const TABS = ["lessons", "flashcards", "practice", "quiz"] as const;

export default function ModuleView({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { progress, update, loaded } = useProgress();
  const meta = courses.find((c) => c.id === id)!;
  const [content, setContent] = useState<CourseContent | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useTab(TABS);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    loaders[id][locale]()
      .then((m) => { if (alive) setContent(m.default); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [id, locale]);

  const lessonKey = (lessonId: string) => `${id}/${lessonId}`;
  const lesson = content?.lessons.find((l) => l.id === active);
  if (lesson) {
    return (
      <LessonPlayer
        key={`${locale}-${lesson.id}`}
        lesson={lesson}
        done={!!progress.lessons[lessonKey(lesson.id)]}
        onComplete={() => update("lessons", lessonKey(lesson.id), true)}
        onExit={() => setActive(null)}
        backLabel={t("module.back")}
      />
    );
  }

  const mp = moduleProgress(id, progress);
  const next = nextStep(id, progress);
  const lessons = content?.lessons ?? [];
  const nextLesson = next.kind === "lesson" ? lessons.find((l) => l.id === next.lessonId) : undefined;

  function goNext() {
    if (next.kind === "lesson") { setTab("lessons"); setActive(next.lessonId); }
    else if (next.kind === "flashcards") setTab("flashcards");
    else if (next.kind === "quiz") setTab("quiz");
  }

  return (
    <>
      <Link href="/modulos" className="btn small ghost">{t("modules.back")}</Link>
      <div className="row" style={{ marginTop: 14 }}>
        <span className="tag">{meta.order}</span>
        {meta.levels.map((l) => <span key={l} className="tag accent">{l}</span>)}
      </div>
      <h1 style={{ marginTop: 8 }}>{meta.title[locale]}</h1>
      <p className="lead"><Inline text={meta.description[locale]} /></p>

      {failed && <div className="feedback bad">{t("modules.loadError")}</div>}
      {!content && !failed && <p className="muted">{t("modules.loading")}</p>}

      {content && loaded && (
        <>
          <div className="card">
            <div className="row">
              <b>{t("module.progress", { percent: mp.percent })}</b>
              <span className="spacer" />
              <span className="muted">
                {t("module.breakdown", { lessons: mp.lessons.done, lessonsTotal: mp.lessons.total, cards: mp.flashcards.done, cardsTotal: mp.flashcards.total })}
                {" · "}{mp.quiz === undefined ? t("module.quizPending") : t("exam.best", { score: mp.quiz })}
              </span>
            </div>
            <div className="progress-bar"><div style={{ width: `${mp.percent}%` }} /></div>
            <div className="row" style={{ marginTop: 10 }}>
              <span>
                {next.kind === "lesson" && <Inline text={t("module.next.lesson", { n: next.index + 1, title: nextLesson?.title ?? "" })} />}
                {next.kind === "flashcards" && t("module.next.flashcards")}
                {next.kind === "quiz" && t("module.next.quiz")}
                {next.kind === "done" && t("module.next.done")}
              </span>
              <span className="spacer" />
              {next.kind !== "done" && <button className="btn primary" onClick={goNext}>{t("module.continue")}</button>}
            </div>
          </div>

          <div className="tabs" role="tablist">
            {TABS.map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t(`module.tab.${k}`)}</button>
            ))}
          </div>

          {tab === "lessons" && (
            <div className="grid">
              {lessons.map((l, n) => {
                const done = !!progress.lessons[lessonKey(l.id)];
                const ex = l.steps.filter((s) => s.kind !== "explain").length;
                const final = l.id === "final-challenge";
                return (
                  <button key={l.id} className="card" style={{ textAlign: "left", cursor: "pointer", border: done ? "1px solid var(--ok)" : undefined }} onClick={() => setActive(l.id)}>
                    <div className="row" style={{ marginBottom: 6 }}>
                      <span className={`tag${final ? " accent" : ""}`}>{final ? t("module.finalChallenge") : n + 1}</span>
                      {done && <span className="tag" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>{t("lessons.done")}</span>}
                      <span className="spacer" />
                      <span className="muted">{t("lessons.meta", { min: l.minutes, ex })}</span>
                    </div>
                    <h3 style={{ margin: "4px 0 6px" }}><Inline text={l.title} /></h3>
                    <p className="muted" style={{ margin: 0 }}><Inline text={l.goal} /></p>
                  </button>
                );
              })}
            </div>
          )}
          {tab === "flashcards" && (
            <CourseDeck key={locale} courseId={id} cards={content.flashcards} flash={progress.flash} onGrade={(k, v) => update("flash", k, v)} />
          )}
          {tab === "practice" && <ModulePractice key={locale} lessons={content.lessons} />}
          {tab === "quiz" && (
            <CourseExam key={locale} questions={content.exam} best={mp.quiz} onFinish={(s) => { if (s > (mp.quiz ?? -1)) update("exams", id, s); }} />
          )}
        </>
      )}
    </>
  );
}
