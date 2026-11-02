"use client";
import Link from "next/link";
import { courses } from "@/data/courses/catalog";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import { useContent } from "@/lib/content";
import { moduleProgress } from "@/lib/modules";
import { prepProgress } from "@/lib/prep";
import Inline from "@/components/Inline";

export default function ModulosPage() {
  const { t, locale } = useI18n();
  const { progress, loaded } = useProgress();
  const content = useContent();

  return (
    <>
      <h1>{t("modules.title")}</h1>
      <p className="lead">{t("modules.lead")}</p>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>{t("modules.levelsHelp")}</p>
      <div className="grid">
        {courses.map((c) => {
          const mp = moduleProgress(c.id, progress);
          return (
            <Link key={c.id} href={`/modulos/${c.id}`} className="card" style={{ border: mp.percent === 100 ? "1px solid var(--ok)" : undefined }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className="tag">{c.order}</span>
                {c.levels.map((l) => <span key={l} className="tag accent">{l}</span>)}
                <span className="spacer" />
                {loaded && <b className="muted">{mp.percent}%</b>}
              </div>
              <h3 style={{ margin: "4px 0 6px" }}>{c.title[locale]}</h3>
              <p className="muted" style={{ minHeight: 40 }}><Inline text={c.description[locale]} /></p>
              {loaded && <div className="progress-bar"><div style={{ width: `${mp.percent}%` }} /></div>}
            </Link>
          );
        })}
      </div>
      <h2>{t("modules.extra")}</h2>
      <div className="grid">
        <Link href="/modulos/prep-testgorilla" className="card">
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="tag accent">TestGorilla</span>
            <span className="spacer" />
            {loaded && <b className="muted">{prepProgress(progress, content)}%</b>}
          </div>
          <h3 style={{ margin: "4px 0 6px" }}>{t("prep.title")}</h3>
          <p className="muted">{t("prep.description")}</p>
          {loaded && <div className="progress-bar"><div style={{ width: `${prepProgress(progress, content)}%` }} /></div>}
        </Link>
      </div>
    </>
  );
}
