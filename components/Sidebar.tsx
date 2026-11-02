"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, useI18n } from "@/lib/i18n";

const main = [
  { href: "/", icon: "🏠", key: "nav.home" },
  { href: "/cursos", icon: "🧭", key: "nav.courses" },
];
const practice = [
  { href: "/lecciones", icon: "🎓", key: "nav.lessons" },
  { href: "/teoria", icon: "📖", key: "nav.theory" },
  { href: "/flashcards", icon: "🃏", key: "nav.flashcards" },
  { href: "/quiz", icon: "✅", key: "nav.quiz" },
  { href: "/salida", icon: "🔮", key: "nav.output" },
  { href: "/codigo", icon: "⌨️", key: "nav.code" },
  { href: "/bugs", icon: "🐛", key: "nav.bugs" },
  { href: "/entrevista", icon: "🎤", key: "nav.interview" },
];

export default function Sidebar() {
  const path = usePathname();
  const { t, locale, setLocale } = useI18n();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const link = (it: (typeof main)[number]) => (
    <Link key={it.href} href={it.href} className={isActive(it.href) ? "active" : ""}>
      <span className="icon">{it.icon}</span>
      {t(it.key)}
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
        {main.map(link)}
        <div className="nav-section">{t("nav.practice")}</div>
        {practice.map(link)}
      </nav>
    </aside>
  );
}
