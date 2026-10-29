"use client";
import Link from "next/link";
import { useProgress } from "@/lib/progress";
import { flashcards } from "@/data/flashcards";
import { quiz } from "@/data/quiz";
import { outputQuestions } from "@/data/output";
import { codeExercises } from "@/data/code";
import { bugExercises } from "@/data/bugs";
import { interviewQuestions } from "@/data/interview";
import { theory } from "@/data/theory";
import { lessons } from "@/data/lessons";
import SyncPanel from "@/components/SyncPanel";

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
  const p = progress;
  const modes = [
    { href: "/lecciones", title: "🎓 Lecciones interactivas", desc: "Empezá acá. Cada concepto explicado con ejemplos y practicado en el momento: predecir salida, completar, escribir.", done: Object.values(p.lessons ?? {}).filter(Boolean).length, total: lessons.length },
    { href: "/teoria", title: "📖 Referencia rápida", desc: "Resumen de todo el temario para repasar el día antes: snippets, trampas, checklist.", done: Object.values(p.theory).filter(Boolean).length, total: theory.length },
    { href: "/flashcards", title: "🃏 Flashcards", desc: "Dale vuelta a la tarjeta, decidí si lo sabías. Las que fallás vuelven.", done: Object.values(p.flash).filter((v) => v === "ok").length, total: flashcards.length },
    { href: "/quiz", title: "✅ Quiz con feedback", desc: "Opción múltiple estilo TestGorilla; cada respuesta explica por qué.", done: Object.values(p.quiz).filter(Boolean).length, total: quiz.length },
    { href: "/salida", title: "🔮 Predice la salida", desc: "Leé Swift y adiviná qué imprime. Entrena las trampas del lenguaje.", done: Object.values(p.output).filter(Boolean).length, total: outputQuestions.length },
    { href: "/codigo", title: "⌨️ Escribe el código", desc: "Resolvé el reto de memoria sin autocompletado; recibís checklist y solución.", done: Object.values(p.code).filter((v) => v >= 70).length, total: codeExercises.length },
    { href: "/bugs", title: "🐛 Caza el bug", desc: "Hacé clic en la línea con el error y aprendé el patrón.", done: Object.values(p.bugs).filter(Boolean).length, total: bugExercises.length },
    { href: "/entrevista", title: "🎤 Entrevista", desc: "Respondé en voz alta o por escrito, comparás con puntos clave y te autoevaluás.", done: Object.values(p.interview).filter((v) => v >= 4).length, total: interviewQuestions.length },
  ];
  return (
    <>
      <h1>Entrenador iOS Sr · GlobalTask</h1>
      <p className="lead">Fundamentos de Swift, algoritmos, REST, SwiftUI, seguridad y release — en juegos cortos con feedback inmediato. Sin timers: el objetivo es que te quede en la cabeza.</p>
      <div className="grid">
        {modes.map((m) => (
          <Link key={m.href} href={m.href} className="card">
            <h3 style={{ marginTop: 0 }}>{m.title}</h3>
            <p className="muted" style={{ minHeight: 40 }}>{m.desc}</p>
            {loaded && <Bar value={m.done} total={m.total} />}
          </Link>
        ))}
      </div>
      <h2>Ruta sugerida</h2>
      <ol>
        <li>Hacé las <b>Lecciones</b> de Swift core en orden (una o dos por sesión), después las de Algoritmos.</li>
        <li>Pasá las <b>Flashcards</b> de Swift hasta tener todas en verde.</li>
        <li>Jugá <b>Predice la salida</b> y <b>Caza el bug</b>: ahí están las trampas que fallan bajo presión.</li>
        <li><b>Escribe el código</b> de memoria, uno por día, sin mirar la solución hasta enviar.</li>
        <li>Lecciones de REST, ingeniería e iOS; después <b>Quiz</b> y <b>Entrevista</b> para preparar las preguntas custom y la entrevista técnica.</li>
        <li>El día antes: <b>Referencia rápida</b> + flashcards pendientes.</li>
      </ol>
      <h2>Sincronización</h2>
      {loaded && <SyncPanel syncCode={syncCode} setSyncCode={setSyncCode} sync={sync} exportJSON={exportJSON} importJSON={importJSON} reset={reset} />}
    </>
  );
}
