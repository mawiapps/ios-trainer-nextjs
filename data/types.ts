export type Topic =
  | "swift"
  | "algoritmos"
  | "ingenieria"
  | "rest"
  | "ios"
  | "seguridad"
  | "testing";

export const TOPIC_LABEL: Record<Topic, string> = {
  swift: "Swift core",
  algoritmos: "Algoritmos",
  ingenieria: "Ingeniería de software",
  rest: "REST y redes",
  ios: "iOS / SwiftUI / Arquitectura",
  seguridad: "Seguridad mobile",
  testing: "Testing y release",
};

export interface Flashcard {
  id: string;
  topic: Topic;
  front: string;
  back: string;
  code?: string;
}

export interface QuizQuestion {
  id: string;
  topic: Topic;
  question: string;
  code?: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface OutputQuestion {
  id: string;
  code: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface CodeExercise {
  id: string;
  title: string;
  level: "entry" | "intermedio";
  prompt: string;
  signature: string;
  examples: string[];
  hints: string[];
  solution: string;
  /** Regex (as string) that a correct solution should contain, with a label for feedback */
  checks: { pattern: string; label: string }[];
  /** Regex of common mistakes */
  warnings: { pattern: string; label: string }[];
}

export interface BugExercise {
  id: string;
  title: string;
  description: string;
  code: string;
  bugLine: number;
  explanation: string;
  fixedLine: string;
}

export interface InterviewQuestion {
  id: string;
  topic: Topic;
  question: string;
  keyPoints: string[];
  modelAnswer: string;
}

export interface TheorySection {
  id: string;
  title: string;
  topic: Topic;
  summary: string;
  bullets: string[];
  code?: string;
  trap?: string;
}
