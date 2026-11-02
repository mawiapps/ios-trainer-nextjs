"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { courses } from "@/data/courses/catalog";
import { loaders } from "@/data/courses";
import type { CourseContent } from "@/data/courses/types";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import Inline from "@/components/Inline";
import LessonPlayer from "@/components/LessonPlayer";
import CourseDeck from "@/components/CourseDeck";
import CourseExam from "@/components/CourseExam";

type Tab = "lessons" | "review" | "exam";

export default function CourseView({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { progress, update, loaded } = useProgress();
  const meta = courses.find((c) => c.id === id)!;
  const [content, setContent] = useState<CourseContent | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("lessons");
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
        backLabel={t("course.back")}
      />
    );
  }

  const lessons = content?.lessons ?? [];
  const doneCount = lessons.filter((l) => progress.lessons[lessonKey(l.id)]).length;
  const best = progress.exams[id];

  return (
    <>
      <Link href="/cursos" className="btn small ghost">{t("courses.back")}</Link>
      <div className="row" style={{ marginTop: 14 }}>
        <span className="tag">{meta.order}</span>
        {meta.levels.map((l) => <span key={l} className="tag accent">{l}</span>)}
      </div>
      <h1 style={{ marginTop: 8 }}>{meta.title[locale]}</h1>
      <p className="lead"><Inline text={meta.description[locale]} /></p>

      {failed && <div className="feedback bad">{t("courses.loadError")}</div>}
      {!content && !failed && <p className="muted">{t("courses.loading")}</p>}
      {content && !lessons.length && <div className="card"><p className="muted" style={{ margin: 0 }}>{t("courses.empty")}</p></div>}

      {content && lessons.length > 0 && (
        <>
          {loaded && (
            <div style={{ marginBottom: 18 }}>
              <div className="progress-bar"><div style={{ width: `${(doneCount / lessons.length) * 100}%` }} /></div>
              <div className="muted">{t("course.progress", { done: doneCount, total: lessons.length })}{best !== undefined ? ` · ${t("exam.best", { score: best })}` : ""}</div>
            </div>
          )}
          <div className="tabs" role="tablist">
            {(["lessons", "review", "exam"] as Tab[]).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t(`course.tab.${k}`)}</button>
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
                      <span className={`tag${final ? " accent" : ""}`}>{final ? t("course.finalChallenge") : n + 1}</span>
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
          {tab === "review" && (
            <CourseDeck key={locale} courseId={id} cards={content.flashcards} flash={progress.flash} onGrade={(k, v) => update("flash", k, v)} />
          )}
          {tab === "exam" && (
            <CourseExam key={locale} questions={content.exam} best={best} onFinish={(s) => { if (s > (best ?? -1)) update("exams", id, s); }} />
          )}
        </>
      )}
    </>
  );
}
