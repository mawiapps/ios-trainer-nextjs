"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface Progress {
  flash: Record<string, "ok" | "again">;
  quiz: Record<string, boolean>;
  output: Record<string, boolean>;
  code: Record<string, number>; // 0-100 score
  bugs: Record<string, boolean>;
  interview: Record<string, number>; // self score 1-5
  theory: Record<string, boolean>;
  lessons: Record<string, boolean>;
  updatedAt?: number;
}

const EMPTY: Progress = { flash: {}, quiz: {}, output: {}, code: {}, bugs: {}, interview: {}, theory: {}, lessons: {} };
const KEY = "ios-trainer-progress-v1";
const CODE_KEY = "ios-trainer-sync-code";

export type SyncState = "off" | "syncing" | "ok" | "error" | "unavailable";

function merge(a: Progress, b: Progress): Progress {
  // Unión por sección: lo hecho en cualquiera de los dos queda hecho; en números gana el mayor.
  const out: Progress = { ...EMPTY };
  (Object.keys(EMPTY) as (keyof Progress)[]).forEach((k) => {
    if (k === "updatedAt") return;
    const ma = (a[k] ?? {}) as Record<string, unknown>;
    const mb = (b[k] ?? {}) as Record<string, unknown>;
    const m: Record<string, unknown> = { ...ma };
    for (const id of Object.keys(mb)) {
      const va = ma[id], vb = mb[id];
      if (va === undefined) m[id] = vb;
      else if (typeof va === "number" && typeof vb === "number") m[id] = Math.max(va, vb);
      else if (va === true || vb === true) m[id] = true;
      else if (va === "ok" || vb === "ok") m[id] = "ok";
      else m[id] = vb;
    }
    (out as unknown as Record<string, unknown>)[k] = m;
  });
  out.updatedAt = Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0);
  return out;
}

function readLocal(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {}
  return EMPTY;
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [syncCode, setSyncCodeState] = useState<string>("");
  const [sync, setSync] = useState<SyncState>("off");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(async (code: string, p: Progress) => {
    setSync("syncing");
    try {
      const r = await fetch(`/api/progress?code=${encodeURIComponent(code)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      setSync(r.status === 501 ? "unavailable" : r.ok ? "ok" : "error");
    } catch { setSync("error"); }
  }, []);

  const pull = useCallback(async (code: string, local: Progress) => {
    setSync("syncing");
    try {
      const r = await fetch(`/api/progress?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      if (r.status === 501) { setSync("unavailable"); return local; }
      if (!r.ok) { setSync("error"); return local; }
      const { progress: remote } = await r.json();
      const merged = remote ? merge(local, remote) : local;
      try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {}
      setProgress(merged);
      await push(code, merged);
      return merged;
    } catch { setSync("error"); return local; }
  }, [push]);

  useEffect(() => {
    const local = readLocal();
    setProgress(local);
    let code = "";
    try { code = localStorage.getItem(CODE_KEY) ?? ""; } catch {}
    setSyncCodeState(code);
    setLoaded(true);
    if (code) pull(code, local);
  }, [pull]);

  const persist = useCallback((next: Progress) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    if (syncCode) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => push(syncCode, next), 800);
    }
  }, [syncCode, push]);

  const update = useCallback(<K extends keyof Progress>(section: K, id: string, value: Progress[K] extends Record<string, infer V> ? V : never) => {
    setProgress((p) => {
      const next = { ...p, [section]: { ...(p[section] as object), [id]: value }, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }, [persist]);

  const setSyncCode = useCallback(async (code: string) => {
    const c = code.trim().toLowerCase();
    try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY); } catch {}
    setSyncCodeState(c);
    if (!c) { setSync("off"); return; }
    await pull(c, readLocal());
  }, [pull]);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch {}
    setProgress(EMPTY);
    if (syncCode) push(syncCode, { ...EMPTY, updatedAt: Date.now() });
  }, [syncCode, push]);

  const exportJSON = useCallback(() => JSON.stringify(progress, null, 2), [progress]);
  const importJSON = useCallback((text: string) => {
    const parsed = { ...EMPTY, ...JSON.parse(text) } as Progress;
    const merged = merge(readLocal(), parsed);
    setProgress(merged);
    persist(merged);
  }, [persist]);

  return { progress, update, reset, loaded, syncCode, setSyncCode, sync, exportJSON, importJSON };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
