"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { courses } from "@/data/courses/catalog";
import { LOCALES, useI18n } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import { useContent } from "@/lib/content";
import { moduleProgress } from "@/lib/modules";
import { PREP_ID, prepProgress } from "@/lib/prep";

export default function Sidebar() {
  const path = usePathname();
  const { t, locale, setLocale } = useI18n();
  const { progress, syncCode, sync } = useProgress();
  const content = useContent();
  const item = (href: string, label: React.ReactNode, pct?: number, icon?: string) => (
    <Link key={href} href={href} className={`${path === href ? "active" : ""}${pct === 100 ? " done" : ""}`}>
      {icon && <span className="icon">{icon}</span>}
      <span>{label}</span>
      {pct !== undefined && <span className="pct">{pct}%</span>}
    </Link>
  );
  return (
    <aside className="sidebar">
      <div className="brand">iOS <span>Trainer</span></div>
      <div className="brand-sub">{t("brand.sub")}</div>
      <div className="lang" role="group" aria-label={t("lang.label")}>
        {LOCALES.map((l) => (
          <button key={l} className={l === locale ? "on" : ""} aria-pressed={l === locale} onClick={() => setLocale(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <nav className="nav">
        {item("/", t("nav.home"), undefined, "🏠")}
        {item("/modulos", t("nav.modules"), undefined, "🧭")}
        <div className="nav-section">{t("nav.path")}</div>
        {courses.map((c) => item(`/modulos/${c.id}`, `${c.order}. ${c.title[locale]}`, moduleProgress(c.id, progress).percent))}
        <div className="nav-section">{t("nav.extra")}</div>
        {item(`/modulos/${PREP_ID}`, t("prep.title"), prepProgress(progress, content))}
      </nav>
      <div className="account">{t("sync.yourCode")} <b>{syncCode}</b><br />{t(`sync.state.${sync}`)}</div>
    </aside>
  );
}
