"use client";
import { useEffect, useMemo, useState } from "react";
import type { CourseFlashcard } from "@/data/courses/types";
import { shuffle } from "@/lib/progress";
import { useI18n } from "@/lib/i18n";
import Code from "@/components/Code";
import Inline from "@/components/Inline";

// Repaso de un curso: tarjetas guardadas en progress.flash como "<curso>/<tarjeta>".
export default function CourseDeck({ courseId, cards, flash, onGrade }: {
  courseId: string;
  cards: CourseFlashcard[];
  flash: Record<string, "ok" | "again">;
  onGrade: (key: string, v: "ok" | "again") => void;
}) {
  const { t } = useI18n();
  const key = (c: CourseFlashcard) => `${courseId}/${c.id}`;
  const [onlyPending, setOnlyPending] = useState(true);
  const [deck, setDeck] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const pool = useMemo(() => cards.filter((c) => !onlyPending || flash[key(c)] !== "ok"), [cards, onlyPending]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDeck(shuffle(pool.map((c) => c.id))); setI(0); setFlipped(false); }, [pool]);

  const card = cards.find((c) => c.id === deck[i]);
  const okCount = cards.filter((c) => flash[key(c)] === "ok").length;

  function grade(v: "ok" | "again") {
    if (!card) return;
    onGrade(key(card), v);
    setFlipped(false);
    if (v === "again") setDeck((d) => [...d, card.id]);
    setI((x) => x + 1);
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <label className="muted"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> {t("flash.onlyPending")}</label>
        <span className="spacer" />
        <span className="muted">{t("flash.mastered", { n: okCount, total: cards.length })}</span>
      </div>
      {!card ? (
        <div className="card">
          <h3>{t("flash.deckDone")}</h3>
          <p className="muted">{t("flash.deckDoneText")}</p>
          <button className="btn" onClick={() => { setDeck(shuffle(pool.map((c) => c.id))); setI(0); }}>{t("flash.reshuffle")}</button>
        </div>
      ) : (
        <>
          <div className="card flash" onClick={() => setFlipped((f) => !f)}>
            <div className="row" style={{ marginBottom: 10 }}>
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
            <div className="muted" style={{ marginTop: 16 }}>{flipped ? "" : t("flash.clickToReveal")}</div>
          </div>
          <div className="row">
            {!flipped ? (
              <button className="btn primary" onClick={() => setFlipped(true)}>{t("flash.show")}</button>
            ) : (
              <>
                <button className="btn ok" onClick={() => grade("ok")}>{t("flash.knew")}</button>
                <button className="btn bad" onClick={() => grade("again")}>{t("flash.again")}</button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
