"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import es from "@/locales/es.json";
import en from "@/locales/en.json";

// Idioma de la plataforma: textos de UI en locales/*.json, contenido por idioma en data/.
export type Locale = "es" | "en";
export const LOCALES: Locale[] = ["es", "en"];
const DICTS: Record<Locale, Record<string, string>> = { es, en };
const KEY = "ios-trainer-locale";

type Vars = Record<string, string | number>;
type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (key: string, vars?: Vars) => string };

function translate(locale: Locale, key: string, vars?: Vars) {
  const s = DICTS[locale][key] ?? DICTS.es[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

const I18nContext = createContext<Ctx>({ locale: "es", setLocale: () => {}, t: (k, v) => translate("es", k, v) });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    const initial = saved === "en" || saved === "es" ? saved : navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
    setLocaleState(initial);
  }, []);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  }, []);

  const t = useCallback((key: string, vars?: Vars) => translate(locale, key, vars), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
