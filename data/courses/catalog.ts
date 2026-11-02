import type { CourseMeta } from "./types";

// Orden pedagógico: cada curso usa lo de los anteriores.
export const courses: CourseMeta[] = [
  {
    id: "c01-swift-basics", order: 1, levels: ["N0"],
    title: { es: "Swift desde cero", en: "Swift from scratch" },
    description: { es: "Tipos, optionals, colecciones, control de flujo y funciones.", en: "Types, optionals, collections, control flow and functions." },
  },
  {
    id: "c02-swift-intermediate", order: 2, levels: ["N1"],
    title: { es: "Swift intermedio", en: "Intermediate Swift" },
    description: { es: "Structs vs clases, enums, closures, errores y Codable.", en: "Structs vs classes, enums, closures, errors and Codable." },
  },
  {
    id: "c03-protocols-generics-memory", order: 3, levels: ["N2"],
    title: { es: "Protocolos, generics y memoria", en: "Protocols, generics and memory" },
    description: { es: "Programación orientada a protocolos, `some`/`any`, generics, ARC y ciclos de retención.", en: "Protocol-oriented programming, `some`/`any`, generics, ARC and retain cycles." },
  },
  {
    id: "c04-swiftui-essentials", order: 4, levels: ["N0", "N1"],
    title: { es: "SwiftUI esencial", en: "SwiftUI essentials" },
    description: { es: "Vistas, estado, listas, formularios y navegación.", en: "Views, state, lists, forms and navigation." },
  },
  {
    id: "c05-uikit-essentials", order: 5, levels: ["N1"],
    title: { es: "UIKit esencial", en: "UIKit essentials" },
    description: { es: "Ciclo de vida, Auto Layout, tablas, colecciones y navegación.", en: "Lifecycle, Auto Layout, tables, collections and navigation." },
  },
  {
    id: "c06-concurrency", order: 6, levels: ["N2"],
    title: { es: "Concurrencia moderna", en: "Modern concurrency" },
    description: { es: "GCD legacy, async/await, actors, streams, continuations y Swift 6.", en: "Legacy GCD, async/await, actors, streams, continuations and Swift 6." },
  },
  {
    id: "c07-networking-persistence", order: 7, levels: ["N2"],
    title: { es: "Networking y persistencia", en: "Networking and persistence" },
    description: { es: "URLSession, capa de red, paginación, caché, Keychain y bases locales.", en: "URLSession, networking layer, pagination, caching, Keychain and local databases." },
  },
  {
    id: "c08-testing", order: 8, levels: ["N1", "N2", "N3"],
    title: { es: "Testing de verdad", en: "Real-world testing" },
    description: { es: "XCTest, Swift Testing, dobles de prueba, async, snapshots, UI tests y TDD.", en: "XCTest, Swift Testing, test doubles, async, snapshots, UI tests and TDD." },
  },
  {
    id: "c09-mvvm-coordinator", order: 9, levels: ["N2"],
    title: { es: "MVVM y Coordinator", en: "MVVM and Coordinator" },
    description: { es: "De MVC a MVVM, binding, coordinators y deep links.", en: "From MVC to MVVM, binding, coordinators and deep links." },
  },
  {
    id: "c10-viper-clean", order: 10, levels: ["N2", "N3"],
    title: { es: "VIPER y Clean Architecture", en: "VIPER and Clean Architecture" },
    description: { es: "Capas, use cases, repositorios y VIPER completo.", en: "Layers, use cases, repositories and full VIPER." },
  },
  {
    id: "c11-tca", order: 11, levels: ["N3"],
    title: { es: "The Composable Architecture (TCA)", en: "The Composable Architecture (TCA)" },
    description: { es: "Reducers, efectos, dependencias, navegación y `TestStore`.", en: "Reducers, effects, dependencies, navigation and `TestStore`." },
  },
  {
    id: "c12-modularity-di", order: 12, levels: ["N3"],
    title: { es: "Modularidad e inyección de dependencias", en: "Modularity and dependency injection" },
    description: { es: "SPM, feature modules, interfaces, contenedores de DI y Tuist.", en: "SPM, feature modules, interfaces, DI containers and Tuist." },
  },
  {
    id: "c13-legacy-migrations", order: 13, levels: ["N3"],
    title: { es: "Código legacy y migraciones", en: "Legacy code and migrations" },
    description: { es: "Objective-C, storyboards, UIKit + SwiftUI, tests de caracterización y Swift 6.", en: "Objective-C, storyboards, UIKit + SwiftUI, characterization tests and Swift 6." },
  },
  {
    id: "c14-environments-cicd", order: 14, levels: ["N2", "N3"],
    title: { es: "Ambientes, firma y CI/CD", en: "Environments, signing and CI/CD" },
    description: { es: "xcconfig, schemes, certificados, perfiles, Fastlane y pipelines.", en: "xcconfig, schemes, certificates, profiles, Fastlane and pipelines." },
  },
  {
    id: "c15-app-store", order: 15, levels: ["N2"],
    title: { es: "Publicar en App Store", en: "Shipping to the App Store" },
    description: { es: "App Store Connect, TestFlight, privacidad, App Review y rechazos.", en: "App Store Connect, TestFlight, privacy, App Review and rejections." },
  },
  {
    id: "c16-iap-subscriptions", order: 16, levels: ["N2", "N3"],
    title: { es: "Compras in-app y suscripciones", en: "In-app purchases and subscriptions" },
    description: { es: "StoreKit 2, backend, notificaciones, ofertas, sandbox y la primera aprobación.", en: "StoreKit 2, backend, notifications, offers, sandbox and the first approval." },
  },
  {
    id: "c17-security-privacy", order: 17, levels: ["N3"],
    title: { es: "Seguridad y privacidad", en: "Security and privacy" },
    description: { es: "Keychain, pinning, CryptoKit, App Attest, privacidad y MASVS.", en: "Keychain, pinning, CryptoKit, App Attest, privacy and MASVS." },
  },
  {
    id: "c18-performance-production", order: 18, levels: ["N3"],
    title: { es: "Performance y producción", en: "Performance and production" },
    description: { es: "Instruments, memory leaks, crashes, logs, MetricKit y analytics.", en: "Instruments, memory leaks, crashes, logging, MetricKit and analytics." },
  },
  {
    id: "c19-system-capabilities", order: 19, levels: ["N2", "N3"],
    title: { es: "Capacidades del sistema", en: "System capabilities" },
    description: { es: "Push, universal links, widgets, Live Activities, background y App Intents.", en: "Push, universal links, widgets, Live Activities, background tasks and App Intents." },
  },
  {
    id: "c20-architect-interviews", order: 20, levels: ["N3", "N4"],
    title: { es: "Arquitecto iOS y entrevistas", en: "iOS architect and interviews" },
    description: { es: "System design mobile, ADRs, code review, live coding y entrevistas.", en: "Mobile system design, ADRs, code review, live coding and interviews." },
  },
];
