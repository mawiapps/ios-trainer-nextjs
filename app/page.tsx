"use client";
import Link from "next/link";
import { useProgress } from "@/lib/progress";
import { useContent } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { courses } from "@/data/courses/catalog";
import { PASS_SCORE } from "@/components/CourseExam";
import SyncPanel from "@/components/SyncPanel";
import Rich from "@/components/Rich";

function Bar({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <>
      <div className="progress-bar"><div style={{ width: `${pct}%` }} /></div>
      <div className="muted">{value} / {total} · {pct}%</div>
    </>
  );
}

export default function Home() {
  const { progress, reset, loaded, syncCode, setSyncCode, sync, exportJSON, importJSON } = useProgress();
  const { t } = useI18n();
  const c = useContent();
  const p = progress;
  const courseLessons = Object.keys(p.lessons).filter((k) => k.includes("/") && p.lessons[k]).length;
  const passed = courses.filter((x) => (p.exams[x.id] ?? 0) >= PASS_SCORE).length;
  const modes = [
    { href: "/lecciones", title: `🎓 ${t("nav.lessons")}`, desc: t("home.mode.lessons"), done: c.lessons.filter((l) => p.lessons[l.id]).length, total: c.lessons.length },
    { href: "/teoria", title: `📖 ${t("nav.theory")}`, desc: t("home.mode.theory"), done: Object.values(p.theory).filter(Boolean).length, total: c.theory.length },
    { href: "/flashcards", title: `🃏 ${t("nav.flashcards")}`, desc: t("home.mode.flashcards"), done: c.flashcards.filter((f) => p.flash[f.id] === "ok").length, total: c.flashcards.length },
    { href: "/quiz", title: `✅ ${t("nav.quiz")}`, desc: t("home.mode.quiz"), done: Object.values(p.quiz).filter(Boolean).length, total: c.quiz.length },
    { href: "/salida", title: `🔮 ${t("nav.output")}`, desc: t("home.mode.output"), done: Object.values(p.output).filter(Boolean).length, total: c.outputQuestions.length },
    { href: "/codigo", title: `⌨️ ${t("nav.code")}`, desc: t("home.mode.code"), done: Object.values(p.code).filter((v) => v >= 70).length, total: c.codeExercises.length },
    { href: "/bugs", title: `🐛 ${t("nav.bugs")}`, desc: t("home.mode.bugs"), done: Object.values(p.bugs).filter(Boolean).length, total: c.bugExercises.length },
    { href: "/entrevista", title: `🎤 ${t("nav.interview")}`, desc: t("home.mode.interview"), done: Object.values(p.interview).filter((v) => v >= 4).length, total: c.interviewQuestions.length },
  ];
  return (
    <>
      <h1>{t("home.title")}</h1>
      <p className="lead">{t("home.lead")}</p>
      <Link href="/cursos" className="card" style={{ display: "block", borderColor: "var(--accent)" }}>
        <h3 style={{ marginTop: 0 }}>{t("home.coursesTitle")}</h3>
        <p className="muted">{t("home.coursesDesc")}</p>
        {loaded && (
          <>
            <Bar value={passed} total={courses.length} />
            <div className="muted">{t("home.coursesProgress", { done: courseLessons, exams: passed })}</div>
          </>
        )}
      </Link>
      <h2>{t("home.practice")}</h2>
      <p className="muted" style={{ marginTop: -4 }}>{t("home.practiceLead")}</p>
      <div className="grid">
        {modes.map((m) => (
          <Link key={m.href} href={m.href} className="card">
            <h3 style={{ marginTop: 0 }}>{m.title}</h3>
            <p className="muted" style={{ minHeight: 40 }}>{m.desc}</p>
            {loaded && <Bar value={m.done} total={m.total} />}
          </Link>
        ))}
      </div>
      <h2>{t("home.route")}</h2>
      <ol>
        {[1, 2, 3, 4].map((n) => <li key={n}><Rich text={t(`home.route.${n}`)} /></li>)}
      </ol>
      <h2>{t("home.sync")}</h2>
      {loaded && <SyncPanel syncCode={syncCode} setSyncCode={setSyncCode} sync={sync} exportJSON={exportJSON} importJSON={importJSON} reset={reset} />}
    </>
  );
}
