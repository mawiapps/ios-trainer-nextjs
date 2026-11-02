"use client";
import Link from "next/link";
import { courses } from "@/data/courses/catalog";
import { PASS_SCORE } from "@/components/CourseExam";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import Inline from "@/components/Inline";

export default function CursosPage() {
  const { t, locale } = useI18n();
  const { progress, loaded } = useProgress();
  const doneIn = (id: string) => Object.keys(progress.lessons).filter((k) => k.startsWith(`${id}/`) && progress.lessons[k]).length;

  return (
    <>
      <h1>{t("courses.title")}</h1>
      <p className="lead">{t("courses.lead")}</p>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>{t("courses.levelsHelp")}</p>
      <div className="grid">
        {courses.map((c) => {
          const done = doneIn(c.id);
          const best = progress.exams[c.id];
          return (
            <Link key={c.id} href={`/cursos/${c.id}`} className="card" style={{ border: best !== undefined && best >= PASS_SCORE ? "1px solid var(--ok)" : undefined }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className="tag">{c.order}</span>
                {c.levels.map((l) => <span key={l} className="tag accent">{l}</span>)}
              </div>
              <h3 style={{ margin: "4px 0 6px" }}>{c.title[locale]}</h3>
              <p className="muted" style={{ minHeight: 40 }}><Inline text={c.description[locale]} /></p>
              {loaded && (
                <div className="muted">
                  {done || best !== undefined
                    ? [done ? t("courses.lessonsDone", { n: done }) : null, best !== undefined ? t("courses.examBest", { score: best }) : null].filter(Boolean).join(" · ")
                    : t("courses.notStarted")}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
