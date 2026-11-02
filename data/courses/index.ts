import type { CourseContent, Locale } from "./types";

// Carga perezosa: cada curso e idioma es un chunk aparte.
export const loaders: Record<string, Record<Locale, () => Promise<{ default: CourseContent }>>> = {
  "c01-swift-basics": { es: () => import("./c01-swift-basics/es"), en: () => import("./c01-swift-basics/en") },
  "c02-swift-intermediate": { es: () => import("./c02-swift-intermediate/es"), en: () => import("./c02-swift-intermediate/en") },
  "c03-protocols-generics-memory": { es: () => import("./c03-protocols-generics-memory/es"), en: () => import("./c03-protocols-generics-memory/en") },
  "c04-swiftui-essentials": { es: () => import("./c04-swiftui-essentials/es"), en: () => import("./c04-swiftui-essentials/en") },
  "c05-uikit-essentials": { es: () => import("./c05-uikit-essentials/es"), en: () => import("./c05-uikit-essentials/en") },
  "c06-concurrency": { es: () => import("./c06-concurrency/es"), en: () => import("./c06-concurrency/en") },
  "c07-networking-persistence": { es: () => import("./c07-networking-persistence/es"), en: () => import("./c07-networking-persistence/en") },
  "c08-testing": { es: () => import("./c08-testing/es"), en: () => import("./c08-testing/en") },
  "c09-mvvm-coordinator": { es: () => import("./c09-mvvm-coordinator/es"), en: () => import("./c09-mvvm-coordinator/en") },
  "c10-viper-clean": { es: () => import("./c10-viper-clean/es"), en: () => import("./c10-viper-clean/en") },
  "c11-tca": { es: () => import("./c11-tca/es"), en: () => import("./c11-tca/en") },
  "c12-modularity-di": { es: () => import("./c12-modularity-di/es"), en: () => import("./c12-modularity-di/en") },
  "c13-legacy-migrations": { es: () => import("./c13-legacy-migrations/es"), en: () => import("./c13-legacy-migrations/en") },
  "c14-environments-cicd": { es: () => import("./c14-environments-cicd/es"), en: () => import("./c14-environments-cicd/en") },
  "c15-app-store": { es: () => import("./c15-app-store/es"), en: () => import("./c15-app-store/en") },
  "c16-iap-subscriptions": { es: () => import("./c16-iap-subscriptions/es"), en: () => import("./c16-iap-subscriptions/en") },
  "c17-security-privacy": { es: () => import("./c17-security-privacy/es"), en: () => import("./c17-security-privacy/en") },
  "c18-performance-production": { es: () => import("./c18-performance-production/es"), en: () => import("./c18-performance-production/en") },
  "c19-system-capabilities": { es: () => import("./c19-system-capabilities/es"), en: () => import("./c19-system-capabilities/en") },
  "c20-architect-interviews": { es: () => import("./c20-architect-interviews/es"), en: () => import("./c20-architect-interviews/en") },
};
