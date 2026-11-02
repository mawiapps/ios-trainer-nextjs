"use client";
import Link from "next/link";
import { courses } from "@/data/courses/catalog";
import { useProgress } from "@/lib/progress";
import { useI18n } from "@/lib/i18n";
import { moduleProgress, nextStep } from "@/lib/modules";
import SyncPanel from "@/components/SyncPanel";
import Rich from "@/components/Rich";

export default function Home() {
  const { progress, loaded } = useProgress();
  const { t, locale } = useI18n();
  const percents = courses.map((c) => moduleProgress(c.id, progress).percent);
  const overall = Math.round(percents.reduce((a, b) => a + b, 0) / courses.length);
  const completed = percents.filter((p) => p === 100).length;
  const current = courses.find((c) => nextStep(c.id, progress).kind !== "done");
  const step = current ? nextStep(current.id, progress) : undefined;
  const href = current ? `/modulos/${current.id}${step?.kind === "flashcards" ? "?tab=flashcards" : step?.kind === "quiz" ? "?tab=quiz" : ""}` : "/modulos";

  return (
    <>
      <h1>{t("home.title")}</h1>
      <p className="lead">{t("home.lead")}</p>
      {loaded && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <div className="row">
            <b>{t("home.overall", { percent: overall })}</b>
            <span className="spacer" />
            <span className="muted">{t("home.completed", { done: completed, total: courses.length })}</span>
          </div>
          <div className="progress-bar"><div style={{ width: `${overall}%` }} /></div>
          <div className="row" style={{ marginTop: 12 }}>
            <span>
              {current
                ? <>{t("home.continueIn", { n: current.order, title: current.title[locale] })} <span className="muted">· {t(`home.step.${step!.kind}`)}</span></>
                : t("home.allDone")}
            </span>
            <span className="spacer" />
            <Link href={href} className="btn primary">{t("module.continue")}</Link>
          </div>
        </div>
      )}
      <h2>{t("home.how")}</h2>
      <ol>
        {[1, 2, 3, 4, 5].map((n) => <li key={n} style={{ marginBottom: 6 }}><Rich text={t(`home.how.${n}`)} /></li>)}
      </ol>
      <h2>{t("home.account")}</h2>
      {loaded && <SyncPanel />}
    </>
  );
}
