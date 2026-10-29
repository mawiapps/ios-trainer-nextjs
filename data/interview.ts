import { InterviewQuestion } from "./types";

export const interviewQuestions: InterviewQuestion[] = [
  {
    id: "iv1", topic: "ios",
    question: "¿Cómo estructurás una app iOS con MVVM + Clean Architecture? Nombrá las capas y qué depende de qué.",
    keyPoints: ["View (SwiftUI) solo renderiza y envía intents", "ViewModel expone estado observable y llama use cases", "UseCase encapsula una regla de negocio", "Repository es un protocolo definido en dominio", "DataSource remoto/local implementa el repositorio", "Dependencias apuntan hacia el dominio (Dependency Rule)", "Módulos SPM por feature o por capa"],
    modelAnswer: "Separo en Presentation (View + ViewModel), Domain (entidades, use cases, protocolos de repositorio) y Data (implementaciones de repositorio, DTOs, API client, persistencia). La View observa el ViewModel; el ViewModel orquesta use cases; los use cases dependen de protocolos, nunca de implementaciones. Data implementa esos protocolos y mapea DTO → entidad. Un composition root arma el grafo con inyección por inicializador. Cada capa vive en su paquete SPM para forzar la dirección de dependencias y acelerar builds.",
  },
  {
    id: "iv2", topic: "ios",
    question: "¿Cuándo usás Combine y cuándo async/await? Dá un ejemplo de cada uno.",
    keyPoints: ["async/await para operaciones puntuales: una request, leer disco", "Combine para flujos continuos: búsqueda con debounce, estado reactivo, múltiples fuentes", "Operadores clave: debounce, removeDuplicates, switchToLatest, combineLatest", "Puente: `.values` convierte Publisher en AsyncSequence", "Structured concurrency: Task, TaskGroup, cancelación"],
    modelAnswer: "Para cargar el perfil hago `let profile = try await repo.profile()` dentro de un `Task` en el ViewModel marcado @MainActor: simple, lineal, con errores con try/catch. Para un buscador uso Combine: el texto es un Publisher al que aplico debounce(300ms), removeDuplicates y map a una request con switchToLatest para cancelar la anterior. Donde conviven, uso `.values` para consumir un Publisher como AsyncSequence.",
  },
  {
    id: "iv3", topic: "seguridad",
    question: "¿Dónde guardás un JWT y un refresh token en iOS y por qué? ¿Cómo manejás el refresh cuando varias requests fallan con 401 a la vez?",
    keyPoints: ["Keychain con kSecAttrAccessibleWhenUnlockedThisDeviceOnly", "Nunca UserDefaults ni archivos", "Access token corto en memoria + Keychain; refresh token solo Keychain", "Interceptor/actor de sesión que serializa el refresh", "Un solo refresh en vuelo; las demás esperan y reintentan", "Si el refresh falla → logout y limpiar Keychain"],
    modelAnswer: "Ambos en Keychain con accesibilidad WhenUnlockedThisDeviceOnly para que no viajen en backups. El access token lo cacheo en memoria para no leer Keychain por request. Tengo un `actor TokenProvider` con `func validToken() async throws -> String`: si el token está vencido o llega un 401, lanza un único refresh y guarda la Task en curso; las llamadas concurrentes hacen `await` sobre esa misma Task y luego reintentan una vez. Si el refresh devuelve 401, limpio la sesión y navego a login.",
  },
  {
    id: "iv4", topic: "seguridad",
    question: "¿Cómo protegés el tráfico y los datos de una app financiera?",
    keyPoints: ["TLS 1.2+ con ATS activo", "Certificate/public key pinning con rotación", "No loguear PII ni tokens", "Keychain para secretos; Data Protection para archivos", "Detección de jailbreak y de debugger como señal", "Ocultar contenido en el app switcher", "Timeout de sesión e inactividad", "OWASP Mobile Top 10 como checklist"],
    modelAnswer: "Capa de red: HTTPS con ATS, pinning de clave pública en `urlSession(_:didReceive:)` con un backup pin para rotación, sin `NSAllowsArbitraryLoads`. Datos: secretos en Keychain, archivos con `.completeFileProtection`, nada sensible en UserDefaults ni logs. App: ocultar la pantalla al ir a background, bloqueo por inactividad, biometría para operaciones sensibles, detección de jailbreak/hooks como señal de riesgo (no bloqueo duro). Reviso contra OWASP Mobile Top 10 en cada release y automatizo con MobSF o similar en CI.",
  },
  {
    id: "iv5", topic: "seguridad",
    question: "¿Cómo integrás Face ID / Touch ID y qué hacés si el usuario no lo tiene configurado?",
    keyPoints: ["LocalAuthentication: LAContext", "canEvaluatePolicy antes de evaluatePolicy", ".deviceOwnerAuthenticationWithBiometrics vs .deviceOwnerAuthentication (incluye passcode)", "NSFaceIDUsageDescription en Info.plist", "Manejar LAError: userCancel, biometryNotEnrolled, lockout", "Biometría desbloquea un secreto del Keychain, no reemplaza el backend"],
    modelAnswer: "Uso `LAContext`: primero `canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)`; si falla con biometryNotEnrolled ofrezco `.deviceOwnerAuthentication` (passcode) o el login normal. Al éxito, leo del Keychain un refresh token guardado con `SecAccessControl` biométrico y pido un nuevo access token al backend: la biometría solo abre el secreto local, la autorización real sigue siendo del servidor. Manejo cancelación y lockout sin bloquear al usuario.",
  },
  {
    id: "iv6", topic: "swift",
    question: "¿Qué es un retain cycle, cómo lo detectás y cómo lo evitás en closures y en Combine?",
    keyPoints: ["Dos referencias fuertes mutuas → ARC nunca libera", "Closure que captura self + self retiene el closure", "Detección: Instruments Leaks/Allocations, Memory Graph Debugger, deinit con print", "[weak self] + guard let", "unowned solo si garantizado", "delegate como weak var", "En Combine: [weak self] en sink/map, store(in:) con cancellables"],
    modelAnswer: "Un retain cycle es cuando dos objetos se retienen fuerte entre sí y ARC no puede llegar a cero. El caso típico es un closure escapante que captura `self` mientras `self` guarda el closure (o el AnyCancellable que lo contiene). Lo detecto con el Memory Graph Debugger y con Leaks/Allocations en Instruments, y en tests con un `weak var sut` que debe ser nil tras liberar. Lo evito con `[weak self]` y `guard let self`, delegates `weak`, y en Combine capturando weak en sink y guardando cancellables en un Set que muere con el dueño.",
  },
  {
    id: "iv7", topic: "ios",
    question: "¿Cómo diseñás la inyección de dependencias sin un framework?",
    keyPoints: ["Protocolos para cada dependencia", "Inyección por inicializador (preferida) o por propiedad", "Composition root / AppContainer en el punto de entrada", "Factories o closures para dependencias perezosas", "En SwiftUI: Environment para servicios transversales", "Mocks en tests por conformar el protocolo"],
    modelAnswer: "Defino protocolos (`ProfileRepository`, `HTTPClient`) y cada tipo recibe sus dependencias por inicializador. Un `AppContainer` en el app entry arma las implementaciones reales una sola vez y expone factories de ViewModels. En SwiftUI paso servicios transversales por Environment. En tests instancio el ViewModel con fakes que conforman el protocolo. Sin reflexión ni service locator: el compilador me dice si falta algo.",
  },
  {
    id: "iv8", topic: "testing",
    question: "¿Qué testeás con XCTest y qué con XCUITest? ¿Cómo mockeás la red?",
    keyPoints: ["XCTest: ViewModels, use cases, mappers, formateadores", "XCUITest: flujos críticos (login, pago) por accessibilityIdentifier", "Mock de red: protocolo HTTPClient con stub, o URLProtocol custom", "async tests con `await` y expectations", "Snapshot tests opcionales para UI", "Tests determinísticos: inyectar Clock/Date y UUID"],
    modelAnswer: "Unit tests con XCTest para toda la lógica: ViewModels, use cases, mappers DTO→modelo, con dependencias falsas. Para la red, inyecto un `HTTPClient` protocolo y en tests uso un stub que devuelve JSON fijo o errores; cuando quiero probar el cliente real uso un `URLProtocol` que intercepta `URLSession`. XCUITest solo para 3–5 flujos críticos (onboarding, login biométrico, transferencia) con identifiers estables, porque son lentos. Corro todo en CI por PR.",
  },
  {
    id: "iv9", topic: "testing",
    question: "Explicá el flujo de release: branch, build number, TestFlight interno/externo, App Store review, phased release, rollback.",
    keyPoints: ["release/x.y branch congelado", "Version (marketing) vs build number incremental", "Archive firmado + upload (Xcode Cloud/Fastlane)", "TestFlight interno sin review, externo con beta review", "App Store review: notas, cuenta demo, cumplimiento", "Phased release 7 días, pausable", "Rollback = nueva build hotfix; no se puede volver a la anterior", "Feature flags para apagar funcionalidad sin release"],
    modelAnswer: "Corto `release/x.y`, subo build number automáticamente en CI y archivo con Fastlane. Primero TestFlight interno (QA y equipo), luego externo a un grupo de beta users tras la beta review. Envío a revisión con notas y cuenta de prueba. Publico con phased release para que el 1 % del primer día detecte crashes; si algo falla pauso el rollout, apago la feature por flag remoto y preparo un hotfix con expedited review. Monitoreo crash-free users en Crashlytics las primeras 48 h.",
  },
  {
    id: "iv10", topic: "testing",
    question: "¿Cómo monitoreás crashes y métricas en producción?",
    keyPoints: ["Crashlytics o Sentry con dSYMs subidos", "MetricKit: hangs, launch time, memoria, CPU", "Xcode Organizer: crashes, energy, disk writes", "Crash-free users/sessions como KPI", "Alertas por regresión por versión", "Logs estructurados sin PII, OSLog con categorías"],
    modelAnswer: "Crashlytics con dSYMs automáticos en CI para stack traces simbolizados, alertas de nuevos crashes y de caída de crash-free users por versión. MetricKit me da hangs, tiempo de arranque y memoria agregados sin PII. Instrumento eventos clave (login, pago) con un analytics propio para medir tasa de error y latencia. Organizer de Xcode como segunda fuente. Dashboard por release y una revisión semanal de los top 5 crashes.",
  },
  {
    id: "iv11", topic: "ios",
    question: "¿Cómo modularizás una app grande con SPM y qué ganás?",
    keyPoints: ["Paquetes por capa (Core, Networking, Design System) y por feature", "Dependencias explícitas en Package.swift", "Builds incrementales más rápidos y previews por módulo", "Ownership por equipo", "Interfaces públicas pequeñas; `internal` por defecto", "Demo apps por feature para iterar"],
    modelAnswer: "Separo en paquetes locales: `Core` (modelos, utilidades), `Networking`, `DesignSystem`, y un paquete por feature (`Payments`, `Profile`) que depende de interfaces, no de otras features. La app es un shell que compone todo. Gano tiempos de build incrementales, previews que compilan rápido, límites de dependencia que el compilador refuerza y ownership claro por equipo. Cada feature tiene su app demo para iterar sin levantar toda la banca.",
  },
  {
    id: "iv12", topic: "ios",
    question: "¿Qué diferencia hay entre @StateObject y @ObservedObject, y qué cambia con @Observable en iOS 17+?",
    keyPoints: ["@StateObject: la vista crea y es dueña; sobrevive re-renders", "@ObservedObject: inyectado desde afuera; se puede recrear", "@EnvironmentObject para compartir en el árbol", "@Observable: macro, sin @Published, tracking por propiedad leída", "Con @Observable se usa @State para ser dueño y se pasa la instancia", "@Bindable para bindings a @Observable"],
    modelAnswer: "`@StateObject` lo usa la vista que crea el objeto: SwiftUI lo instancia una vez y lo mantiene aunque la vista se redibuje. `@ObservedObject` es para un objeto que llega por parámetro; si el padre se recrea, el objeto puede recrearse. Con `@Observable` desaparece `@Published`: la vista se invalida solo cuando cambia una propiedad que realmente leyó, menos renders. El dueño lo declara con `@State`, los hijos lo reciben como parámetro normal y usan `@Bindable` para bindings.",
  },
  {
    id: "iv13", topic: "rest",
    question: "¿Cómo definís contratos con el equipo backend y qué es un BFF?",
    keyPoints: ["OpenAPI como fuente de verdad", "Versionado y compatibilidad hacia atrás", "BFF: endpoint adaptado al cliente mobile que agrega varios servicios", "Codable con DTOs separados del dominio", "Manejo de errores estándar (código + mensaje + traceId)", "Paginación por cursor", "Mock server para desarrollar en paralelo"],
    modelAnswer: "Acordamos el contrato en OpenAPI antes de codificar; generamos DTOs Codable y un mock server para avanzar en paralelo. El BFF expone endpoints pensados para la pantalla: por ejemplo `/home` devuelve saldo, últimos movimientos y promociones en una sola llamada, en vez de tres servicios. Definimos un sobre de error común con código y traceId, paginación por cursor y versionado por header para no romper apps viejas.",
  },
  {
    id: "iv14", topic: "ios",
    question: "¿Cómo optimizás performance con Instruments? Contá un caso real.",
    keyPoints: ["Time Profiler para CPU y main thread", "Allocations/Leaks para memoria", "Core Animation / Animation Hitches para scroll", "Network para latencia y tamaño", "Medir antes y después; signposts (os_signpost)", "Causas típicas: trabajo en main thread, imágenes sin downsampling, layouts caros"],
    modelAnswer: "Primero mido: Time Profiler con 'hide system libraries' para ver mi código en el main thread. Caso típico: una lista con hitches porque decodificaba JSON y creaba formatters en cada celda; moví el decode a background, cacheé los formatters y bajé el tiempo por frame de 30 ms a 4 ms. Para memoria uso Allocations con marks generacionales para ver qué crece entre navegaciones. Dejo `os_signpost` en los puntos críticos para medir en producción con MetricKit.",
  },
];
