"use client";
import { useRef, useState } from "react";
import { SyncState } from "@/lib/progress";
import { useI18n } from "@/lib/i18n";

export default function SyncPanel({ syncCode, setSyncCode, sync, exportJSON, importJSON, reset }: {
  syncCode: string; setSyncCode: (c: string) => Promise<void>; sync: SyncState;
  exportJSON: () => string; importJSON: (t: string) => void; reset: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(syncCode);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const valid = /^[a-z0-9-_]{6,64}$/i.test(draft.trim());

  function download() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${t("sync.fileName")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    try { importJSON(await f.text()); setMsg(t("sync.imported")); }
    catch { setMsg(t("sync.invalid")); }
    e.target.value = "";
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t("sync.title")}</h3>
      <p className="muted">{t("sync.desc")}</p>
      <div className="row">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("sync.placeholder")} spellCheck={false}
          style={{ background: "#0b0d11", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontFamily: "var(--mono)", minWidth: 220 }} />
        <button className="btn primary" disabled={!valid || draft.trim().toLowerCase() === syncCode} onClick={async () => { await setSyncCode(draft); setMsg(""); }}>{t("sync.connect")}</button>
        {syncCode && <button className="btn ghost" onClick={() => { setSyncCode(""); setDraft(""); }}>{t("sync.disconnect")}</button>}
        <span className="spacer" />
        <span className="muted">{syncCode ? t("sync.status", { state: t(`sync.state.${sync}`), code: syncCode }) : t("sync.state.off")}</span>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn small" onClick={download}>{t("sync.export")}</button>
        <button className="btn small" onClick={() => file.current?.click()}>{t("sync.import")}</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={onFile} />
        <span className="spacer" />
        <button className="btn small ghost" onClick={() => { if (confirm(t("sync.resetConfirm"))) reset(); }}>{t("sync.reset")}</button>
      </div>
      {msg && <div className="feedback" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
