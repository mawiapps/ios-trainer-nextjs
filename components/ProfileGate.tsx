"use client";
import { useState } from "react";
import { useI18n, LOCALES } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";

export const CODE_RE = /^[a-z0-9-_]{6,64}$/i;

function suggestion() {
  const words = ["swift", "ios", "xcode", "swiftui", "uikit", "combine"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.random().toString(36).slice(2, 8)}`;
}

// Pide el código personal antes de usar la app: con él todo el progreso se guarda en la nube.
export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const { loaded, syncCode, setSyncCode } = useProgress();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = CODE_RE.test(draft.trim());

  if (!loaded) return null;
  if (syncCode) return <>{children}</>;

  async function connect() {
    setBusy(true);
    await setSyncCode(draft);
    setBusy(false);
  }

  return (
    <div className="gate">
      <div className="card">
        <div className="row">
          <div className="brand">iOS <span>Trainer</span></div>
          <span className="spacer" />
          <div className="lang" role="group" aria-label={t("lang.label")} style={{ margin: 0 }}>
            {LOCALES.map((l) => <button key={l} className={l === locale ? "on" : ""} onClick={() => setLocale(l)}>{l.toUpperCase()}</button>)}
          </div>
        </div>
        <h2 style={{ marginTop: 18 }}>{t("gate.title")}</h2>
        <p className="muted">{t("gate.desc")}</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) connect(); }}>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("sync.placeholder")} spellCheck={false} autoFocus autoCapitalize="none" />
          <button className="btn primary" type="submit" disabled={!valid || busy}>{busy ? t("sync.state.syncing") : t("gate.enter")}</button>
        </form>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn small ghost" type="button" onClick={() => setDraft(suggestion())}>{t("gate.suggest")}</button>
          <span className="muted">{draft && !valid ? t("gate.invalid") : t("gate.rules")}</span>
        </div>
        <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>{t("gate.note")}</p>
      </div>
    </div>
  );
}
