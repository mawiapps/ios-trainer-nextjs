"use client";
import * as es from "@/data/es";
import * as en from "@/data/en";
import { useI18n } from "@/lib/i18n";

// Contenido de los modos de práctica según el idioma activo.
export function useContent() {
  const { locale } = useI18n();
  return locale === "en" ? en : es;
}
