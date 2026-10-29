"use client";
import { useEffect, useMemo, useState } from "react";
import { flashcards } from "@/data/flashcards";
import { Topic, TOPIC_LABEL } from "@/data/types";
import { useProgress, shuffle } from "@/lib/progress";
import TopicFilter from "@/components/TopicFilter";
import Code from "@/components/Code";
import Inline from "@/components/Inline";

export default function Flashcards() {
  const { progress, update, loaded } = useProgress();
  const [topic, setTopic] = useState<Topic | "all">("all");
  const [onlyPending, setOnlyPending] = useState(true);
  const [deck, setDeck] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const topics = Array.from(new Set(flashcards.map((f) => f.topic)));

  const pool = useMemo(() => flashcards.filter((f) => (topic === "all" || f.topic === topic) && (!onlyPending || progress.flash[f.id] !== "ok")), [topic, onlyPending, progress.flash]);

  useEffect(() => {
    if (!loaded) return;
    setDeck(shuffle(pool.map((f) => f.id)));
    setI(0);
    setFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, onlyPending, loaded]);

  const card = flashcards.find((f) => f.id === deck[i]);
  const okCount = flashcards.filter((f) => progress.flash[f.id] === "ok").length;

  function grade(v: "ok" | "again") {
    if (!card) return;
    update("flash", card.id, v);
    setFlipped(false);
    if (v === "again") setDeck((d) => [...d, card.id]);
    setI((x) => x + 1);
  }

  return (
    <>
      <h1>Flashcards</h1>
      <p className="lead">Leé la pregunta, respondé en tu cabeza, dale vuelta y sé honesto: "Lo sabía" la saca del mazo, "Repetir" la manda al final.</p>
      <TopicFilter topics={topics} value={topic} onChange={setTopic} />
      <div className="row" style={{ marginBottom: 14 }}>
        <label className="muted"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Solo pendientes</label>
        <span className="spacer" />
        <span className="muted">Dominadas: {okCount} / {flashcards.length}</span>
      </div>
      {!card ? (
        <div className="card">
          <h3>🎉 Mazo terminado</h3>
          <p className="muted">No quedan tarjetas con este filtro. Cambiá de tema o desactivá "Solo pendientes" para repasar todo.</p>
          <button className="btn" onClick={() => { setDeck(shuffle(pool.map((f) => f.id))); setI(0); }}>Volver a barajar</button>
        </div>
      ) : (
        <>
          <div className="card flash" onClick={() => setFlipped((f) => !f)}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="tag">{TOPIC_LABEL[card.topic]}</span>
              <span className="spacer" />
              <span className="muted">{i + 1} / {deck.length}</span>
            </div>
            {!flipped ? (
              <div style={{ fontSize: 20, fontWeight: 600 }}><Inline text={card.front} /></div>
            ) : (
              <div>
                <div style={{ fontSize: 16, marginBottom: 12 }}><Inline text={card.back} /></div>
                {card.code && <Code>{card.code}</Code>}
              </div>
            )}
            <div className="muted" style={{ marginTop: 16 }}>{flipped ? "" : "Clic para ver la respuesta"}</div>
          </div>
          <div className="row">
            {!flipped ? (
              <button className="btn primary" onClick={() => setFlipped(true)}>Mostrar respuesta</button>
            ) : (
              <>
                <button className="btn ok" onClick={() => grade("ok")}>✓ Lo sabía</button>
                <button className="btn bad" onClick={() => grade("again")}>↻ Repetir</button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
