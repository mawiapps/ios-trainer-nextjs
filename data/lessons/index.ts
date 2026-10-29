import { Lesson } from "./types";
import { swiftLessons1 } from "./swift1";
import { swiftLessons2 } from "./swift2";
import { algoLessons } from "./algo";
import { engLessons } from "./eng";
import { iosLessons } from "./ios";

export const lessons: Lesson[] = [...swiftLessons1, ...swiftLessons2, ...algoLessons, ...engLessons, ...iosLessons];
export type { Lesson, Step } from "./types";
