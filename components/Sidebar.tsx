"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: "🏠", label: "Inicio" },
  { href: "/lecciones", icon: "🎓", label: "Lecciones" },
  { href: "/teoria", icon: "📖", label: "Referencia rápida" },
  { href: "/flashcards", icon: "🃏", label: "Flashcards" },
  { href: "/quiz", icon: "✅", label: "Quiz con feedback" },
  { href: "/salida", icon: "🔮", label: "Predice la salida" },
  { href: "/codigo", icon: "⌨️", label: "Escribe el código" },
  { href: "/bugs", icon: "🐛", label: "Caza el bug" },
  { href: "/entrevista", icon: "🎤", label: "Entrevista" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">iOS <span>Trainer</span></div>
      <div className="brand-sub">Prep para el assessment de GlobalTask</div>
      <nav className="nav">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={path === it.href ? "active" : ""}>
            <span className="icon">{it.icon}</span>
            {it.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
