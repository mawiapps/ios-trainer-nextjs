"use client";
import { useRef, useState } from "react";
import { SyncState } from "@/lib/progress";

const LABEL: Record<SyncState, string> = {
  off: "Solo este navegador",
  syncing: "Sincronizando…",
  ok: "Sincronizado en la nube",
  error: "Error al sincronizar (reintenta al próximo cambio)",
  unavailable: "Servidor sin base de datos configurada: solo local",
};

export default function SyncPanel({ syncCode, setSyncCode, sync, exportJSON, importJSON, reset }: {
  syncCode: string; setSyncCode: (c: string) => Promise<void>; sync: SyncState;
  exportJSON: () => string; importJSON: (t: string) => void; reset: () => void;
}) {
  const [draft, setDraft] = useState(syncCode);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const valid = /^[a-z0-9-_]{6,64}$/i.test(draft.trim());

  function download() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ios-trainer-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    try { importJSON(await f.text()); setMsg("Progreso importado y fusionado."); }
    catch { setMsg("Archivo inválido."); }
    e.target.value = "";
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>☁️ Progreso en varios dispositivos</h3>
      <p className="muted">Elegí un código (6+ caracteres, letras/números/guiones) y usalo en cada dispositivo: el progreso se guarda en la nube y se fusiona con lo local. Nadie sin el código puede verlo; no uses una contraseña real.</p>
      <div className="row">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="ej: wilver-ios-2026" spellCheck={false}
          style={{ background: "#0b0d11", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontFamily: "var(--mono)", minWidth: 220 }} />
        <button className="btn primary" disabled={!valid || draft.trim().toLowerCase() === syncCode} onClick={async () => { await setSyncCode(draft); setMsg(""); }}>Conectar</button>
        {syncCode && <button className="btn ghost" onClick={() => { setSyncCode(""); setDraft(""); }}>Desconectar</button>}
        <span className="spacer" />
        <span className="muted">{syncCode ? `${LABEL[sync]} · código: ${syncCode}` : LABEL.off}</span>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn small" onClick={download}>⬇ Exportar progreso (.json)</button>
        <button className="btn small" onClick={() => file.current?.click()}>⬆ Importar</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={onFile} />
        <span className="spacer" />
        <button className="btn small ghost" onClick={() => { if (confirm("¿Borrar todo el progreso (local y nube)?")) reset(); }}>Reiniciar progreso</button>
      </div>
      {msg && <div className="feedback" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
