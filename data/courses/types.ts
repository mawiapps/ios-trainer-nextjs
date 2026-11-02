import type { Step } from "../lessons/types";

export type Locale = "es" | "en";
export type Level = "N0" | "N1" | "N2" | "N3" | "N4";

export interface CourseLesson {
  id: string;
  title: string;
  goal: string;
  minutes: number;
  steps: Step[];
}

export interface CourseFlashcard {
  id: string;
  front: string;
  back: string;
  code?: string;
}

export interface ExamQuestion {
  id: string;
  question: string;
  code?: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** Contenido de un curso en un idioma. es.ts y en.ts de cada curso tienen los mismos ids, pasos, respuestas y regex. */
export interface CourseContent {
  lessons: CourseLesson[];
  flashcards: CourseFlashcard[];
  exam: ExamQuestion[];
}

export interface CourseMeta {
  id: string;
  order: number;
  levels: Level[];
  title: Record<Locale, string>;
  description: Record<Locale, string>;
}
