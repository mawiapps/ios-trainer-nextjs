"use client";
import { useRef, useState } from "react";
import { useProgress } from "@/lib/progress";
import { useI18n } from "@/lib/i18n";

// Cuenta: código personal, estado de la nube, salir, exportar/importar y reiniciar.
export default function SyncPanel() {
  const { t } = useI18n();
  const { syncCode, sync, signOut, exportJSON, importJSON, reset } = useProgress();
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);

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
  async function onSignOut() {
    if (!confirm(t("sync.signOutConfirm"))) return;
    if (!(await signOut())) setMsg(t("sync.signOutFailed"));
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t("sync.title")}</h3>
      <div className="row">
        <span>{t("sync.yourCode")} <code className="inline">{syncCode}</code></span>
        <span className="muted">· {t(`sync.state.${sync}`)}</span>
        <span className="spacer" />
        <button className="btn small ghost" onClick={onSignOut}>{t("sync.signOut")}</button>
      </div>
      <p className="muted">{t("sync.desc")}</p>
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
