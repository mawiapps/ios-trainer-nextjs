"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Pestaña activa guardada en ?tab= para poder compartir o volver a una sección del módulo.
export function useTab<T extends string>(tabs: readonly T[]): [T, (t: T) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const raw = params.get("tab") as T | null;
  const tab = raw && tabs.includes(raw) ? raw : tabs[0];
  const setTab = useCallback((t: T) => {
    const q = new URLSearchParams(params.toString());
    if (t === tabs[0]) q.delete("tab"); else q.set("tab", t);
    const s = q.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  }, [params, router, path, tabs]);
  return [tab, setTab];
}
