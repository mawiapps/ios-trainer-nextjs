import { Topic } from "../types";

export type Step =
  | { kind: "explain"; title: string; body: string[]; code?: string; output?: string }
  | { kind: "predict"; prompt?: string; code: string; options: string[]; answer: number; explanation: string }
  | { kind: "fill"; prompt: string; code: string; accept: string[]; explanation: string; hint?: string; placeholder?: string }
  | { kind: "write"; prompt: string; starter?: string; checks: { pattern: string; label: string }[]; warnings?: { pattern: string; label: string }[]; solution: string; hint?: string };

export interface Lesson {
  id: string;
  topic: Topic;
  title: string;
  goal: string;
  minutes: number;
  steps: Step[];
}
