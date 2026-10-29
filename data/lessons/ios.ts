import { Lesson } from "./types";

export const iosLessons: Lesson[] = [
  {
    id: "l-swiftui",
    topic: "ios",
    title: "SwiftUI: estado y property wrappers",
    goal: "Elegir el wrapper correcto (@State, @Binding, @StateObject, @ObservedObject, @Observable) sin dudar.",
    minutes: 14,
    steps: [
      {
        kind: "explain",
        title: "La idea central",
        body: [
          "Una vista SwiftUI es una función del estado: `body` se vuelve a calcular cuando cambia algo que la vista observa. Los property wrappers le dicen a SwiftUI **de quién es** ese estado y **cuándo** redibujar.",
          "Pregunta clave para elegir: ¿la vista es dueña del dato o lo recibe de afuera?",
        ],
      },
      {
        kind: "explain",
        title: "@State y @Binding (valores simples)",
        body: [
          "`@State`: estado propio y privado de la vista (un Bool, un String, un struct chico). SwiftUI lo guarda fuera de la struct para que sobreviva re-renders.",
          "`@Binding`: una referencia de lectura/escritura a un `@State` que vive en otra vista. Se pasa con `$`.",
        ],
        code: "struct Padre: View {\n    @State private var activo = false\n    var body: some View {\n        VStack {\n            Toggle(\"Activo\", isOn: $activo)      // $ → Binding<Bool>\n            Hijo(activo: $activo)\n        }\n    }\n}\nstruct Hijo: View {\n    @Binding var activo: Bool\n    var body: some View { Button(\"Apagar\") { activo = false } }\n}",
      },
      {
        kind: "fill",
        prompt: "Completá el wrapper para que `Hijo` pueda modificar el estado del padre.",
        code: "struct Hijo: View {\n    ____ var nombre: String\n    var body: some View { TextField(\"Nombre\", text: $nombre) }\n}",
        accept: ["^@Binding$"],
        explanation: "`@Binding` conecta con un `@State` externo; `$nombre` da el Binding al TextField.",
        placeholder: "@...",
      },
      {
        kind: "explain",
        title: "@StateObject vs @ObservedObject (ObservableObject)",
        body: [
          "Para objetos (clases) que conforman `ObservableObject` y publican cambios con `@Published`.",
          "`@StateObject`: la vista **crea y es dueña** del objeto; se instancia una sola vez aunque la vista se redibuje. Es lo que usás para el ViewModel de una pantalla.",
          "`@ObservedObject`: la vista **recibe** el objeto por parámetro; no controla su vida. Si el padre se recrea y pasa una instancia nueva, se pierde el estado. Error común: crear el ViewModel con @ObservedObject y perderlo en cada render.",
          "`@EnvironmentObject`: igual que ObservedObject pero inyectado en el árbol con `.environmentObject(...)`.",
        ],
        code: "final class ProfileVM: ObservableObject {\n    @Published var name = \"\"\n}\nstruct ProfileScreen: View {\n    @StateObject private var vm = ProfileVM()      // dueña\n    var body: some View { ProfileHeader(vm: vm) }\n}\nstruct ProfileHeader: View {\n    @ObservedObject var vm: ProfileVM               // prestado\n    var body: some View { Text(vm.name) }\n}",
      },
      {
        kind: "predict",
        prompt: "¿Qué problema tiene este código?",
        code: "struct Screen: View {\n    @ObservedObject var vm = ScreenVM()\n    var body: some View { Text(vm.title) }\n}",
        options: ["No compila", "Cada vez que Screen se recrea, se crea un ScreenVM nuevo y se pierde el estado", "vm nunca se libera", "Falta @Published"],
        answer: 1,
        explanation: "Para un objeto que la vista crea, usá `@StateObject`. `@ObservedObject` no retiene la instancia entre renders.",
      },
      {
        kind: "explain",
        title: "@Observable (iOS 17+)",
        body: [
          "Macro que reemplaza `ObservableObject` + `@Published`. La clase se marca `@Observable` y todas sus propiedades son observables. SwiftUI redibuja la vista **solo si cambió una propiedad que esa vista leyó** (tracking fino, menos renders).",
          "Dueño: `@State private var vm = VM()`. Hijos: reciben `vm` como parámetro común. Para bindings: `@Bindable var vm`.",
        ],
        code: "@Observable final class CounterVM { var count = 0; var label = \"\" }\n\nstruct Screen: View {\n    @State private var vm = CounterVM()             // dueño\n    var body: some View { Child(vm: vm) }\n}\nstruct Child: View {\n    @Bindable var vm: CounterVM\n    var body: some View {\n        TextField(\"Label\", text: $vm.label)      // binding directo\n        Button(\"+\") { vm.count += 1 }\n    }\n}",
      },
      {
        kind: "fill",
        prompt: "Completá el wrapper para crear un Binding a una propiedad de un objeto @Observable recibido por parámetro.",
        code: "struct Child: View {\n    ____ var vm: CounterVM\n    var body: some View { TextField(\"x\", text: $vm.label) }\n}",
        accept: ["^@Bindable$"],
        explanation: "`@Bindable` expone `$vm.propiedad` como Binding para objetos @Observable.",
        placeholder: "@...",
      },
      {
        kind: "explain",
        title: "Tabla mental",
        body: [
          "Valor simple propio → `@State`. Valor simple prestado → `@Binding`.",
          "Objeto propio (ObservableObject) → `@StateObject`. Objeto prestado → `@ObservedObject`. Compartido en el árbol → `@EnvironmentObject`.",
          "Objeto propio (@Observable) → `@State`. Prestado → parámetro normal; con bindings → `@Bindable`. Compartido → `.environment(vm)` + `@Environment(VM.self)`.",
        ],
      },
    ],
  },
  {
    id: "l-concurrency",
    topic: "ios",
    title: "async/await, Task, actor, @MainActor",
    goal: "Escribir un ViewModel que carga datos sin warnings de hilo y entender qué protege un actor.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "async/await",
        body: [
          "Una función `async` puede suspenderse sin bloquear el hilo. Se llama con `await`; si además lanza, `try await`. Solo podés usar `await` dentro de otra función async o de una `Task`.",
          "`Task { }` arranca trabajo concurrente desde código síncrono (un botón, `init`). En SwiftUI, el modificador `.task { }` crea una Task ligada a la vida de la vista y la **cancela** cuando desaparece.",
        ],
        code: "func fetchProfile() async throws -> Profile { ... }\n\nstruct Screen: View {\n    @State private var profile: Profile?\n    var body: some View {\n        Text(profile?.name ?? \"…\")\n            .task { profile = try? await fetchProfile() }\n    }\n}",
      },
      {
        kind: "explain",
        title: "Varias cosas a la vez",
        body: [
          "`async let` lanza dos operaciones en paralelo y esperás ambas. `TaskGroup` para N dinámicas. Si una lanza, las otras se cancelan.",
        ],
        code: "async let user = api.user()\nasync let txs = api.transactions()\nlet (u, t) = try await (user, txs)   // en paralelo\n\nlet results = try await withThrowingTaskGroup(of: Image.self) { g in\n    for url in urls { g.addTask { try await load(url) } }\n    var out: [Image] = []\n    for try await img in g { out.append(img) }\n    return out\n}",
      },
      {
        kind: "predict",
        prompt: "¿Cuánto tarda aproximadamente?",
        code: "async let a = sleep2s()   // tarda 2 s\nasync let b = sleep3s()   // tarda 3 s\n_ = await (a, b)",
        options: ["5 s", "3 s", "2 s", "Depende del orden"],
        answer: 1,
        explanation: "`async let` las ejecuta en paralelo: el total es la más lenta, 3 s.",
      },
      {
        kind: "explain",
        title: "@MainActor: la UI va en el hilo principal",
        body: [
          "Todo lo que toca la UI (`@Published`, `@State`, vistas) debe correr en el main thread. Si asignás una `@Published` desde una Task en background aparece el warning morado 'Publishing changes from background threads'.",
          "Solución limpia: marcar el ViewModel con `@MainActor`. Todo su código corre en main; las llamadas `await` a la red se suspenden sin bloquear.",
        ],
        code: "@MainActor\nfinal class FeedVM: ObservableObject {\n    @Published private(set) var state: State = .idle\n    private let load: LoadFeedUseCase\n    init(load: LoadFeedUseCase) { self.load = load }\n\n    func refresh() {\n        state = .loading\n        Task {\n            do { state = .loaded(try await load()) }   // vuelve a main solo\n            catch { state = .failed(error.localizedDescription) }\n        }\n    }\n}",
      },
      {
        kind: "fill",
        prompt: "Completá el atributo que garantiza que el ViewModel actualice la UI en el hilo principal.",
        code: "____\nfinal class FeedVM: ObservableObject {\n    @Published var items: [Item] = []\n}",
        accept: ["^@MainActor$"],
        explanation: "`@MainActor` aísla la clase al actor principal.",
        placeholder: "@...",
      },
      {
        kind: "explain",
        title: "actor: estado mutable sin data races",
        body: [
          "Un `actor` es un tipo de referencia cuyo estado solo puede tocarse desde adentro, y las llamadas desde afuera son `await` (se serializan). Reemplaza locks y DispatchQueues para cachés, contadores, sesiones.",
          "`@MainActor` es un actor global especial: el hilo principal.",
        ],
        code: "actor ImageCache {\n    private var store: [URL: Image] = [:]\n    func image(for url: URL) -> Image? { store[url] }\n    func set(_ img: Image, for url: URL) { store[url] = img }\n}\nlet cache = ImageCache()\nawait cache.set(img, for: url)      // await obligatorio desde afuera",
      },
      {
        kind: "explain",
        title: "Cancelación",
        body: [
          "Las Tasks son cooperativas: cancelar no las mata, les avisa. En loops largos chequeá `Task.isCancelled` o `try Task.checkCancellation()`. `URLSession` y `Task.sleep` ya respetan la cancelación.",
          "`.task {}` de SwiftUI y `Task` guardadas con `.cancel()` en `deinit`/`onDisappear` evitan trabajo zombie.",
        ],
      },
      {
        kind: "predict",
        prompt: "¿Qué pasa aquí?",
        code: "final class VM: ObservableObject {\n    @Published var items: [Int] = []\n    func load() {\n        Task.detached {\n            let r = await heavyWork()\n            self.items = r\n        }\n    }\n}",
        options: ["Funciona bien", "Warning/crash: asigna @Published desde un hilo de background", "No compila por self", "items queda vacío"],
        answer: 1,
        explanation: "`Task.detached` no hereda el actor; la asignación ocurre fuera de main. Marcá la clase `@MainActor` o usá `await MainActor.run { self.items = r }`.",
      },
    ],
  },
  {
    id: "l-arc",
    topic: "ios",
    title: "ARC y retain cycles",
    goal: "Explicar cómo libera memoria Swift, detectar un ciclo en código y romperlo con weak/unowned.",
    minutes: 10,
    steps: [
      {
        kind: "explain",
        title: "Cómo funciona ARC",
        body: [
          "Cada instancia de clase tiene un contador de referencias fuertes. Al asignarla a una variable sube; cuando la variable muere o se reasigna baja. Al llegar a 0, se llama `deinit` y se libera. Los structs no participan: se copian.",
          "No hay garbage collector: si A retiene a B y B retiene a A, ninguno llega a 0 nunca. Eso es un **retain cycle** → memory leak.",
        ],
        code: "final class Persona {\n    let nombre: String\n    init(_ n: String) { nombre = n; print(\"init\", n) }\n    deinit { print(\"deinit\", nombre) }\n}\nvar p: Persona? = Persona(\"Ana\")   // init Ana, contador 1\nvar q = p                          // contador 2\np = nil                            // contador 1\nq = nil                            // contador 0 → deinit Ana",
        output: "init Ana\ndeinit Ana",
      },
      {
        kind: "explain",
        title: "Los tres ciclos típicos",
        body: [
          "1. Dos objetos con propiedades fuertes mutuas (`Padre.hijo` y `Hijo.padre`). Solución: uno de los dos `weak var`.",
          "2. Delegate fuerte: `var delegate: MiDelegate?` donde el delegate es quien te creó. Solución: `weak var delegate`.",
          "3. Closure guardado que captura `self`: el objeto guarda el closure (o el `AnyCancellable` de Combine) y el closure retiene `self`. Solución: `[weak self]`.",
        ],
        code: "final class Timer2 {\n    var onTick: (() -> Void)?\n    var count = 0\n    func start() {\n        onTick = { [weak self] in          // sin esto: ciclo\n            guard let self else { return }\n            self.count += 1\n        }\n    }\n}",
      },
      {
        kind: "predict",
        prompt: "¿Hay retain cycle?",
        code: "final class VM {\n    var names: [String] = []\n    func load(api: API) {\n        api.fetch { [weak self] result in\n            self?.names = result\n        }\n    }\n}",
        options: ["Sí, por el closure", "No: self es weak dentro del closure", "Sí, por api", "No compila"],
        answer: 1,
        explanation: "`[weak self]` evita que el closure retenga fuerte al VM. Además `api.fetch` no es guardado por `self`, así que ni siquiera había ciclo garantizado; weak es la práctica segura.",
      },
      {
        kind: "explain",
        title: "weak vs unowned",
        body: [
          "`weak`: referencia que no suma al contador y se vuelve `nil` automáticamente cuando el objeto muere. Siempre es optional y `var`.",
          "`unowned`: tampoco suma, pero no es optional: si usás la referencia después de que el objeto murió, **crash**. Solo cuando el otro objeto garantizado vive más (por ejemplo, un closure dentro de un objeto que lo posee y nunca lo expone).",
          "En duda, `weak`.",
        ],
      },
      {
        kind: "fill",
        prompt: "Completá para romper el ciclo delegate.",
        code: "protocol CellDelegate: AnyObject { func tapped() }\nfinal class Cell {\n    ____ var delegate: CellDelegate?\n}",
        accept: ["^weak$"],
        explanation: "`weak var delegate` es la convención: el dueño (controller/VM) retiene la celda, no al revés. El protocolo debe ser `AnyObject` para poder ser weak.",
        placeholder: "palabra clave",
      },
      {
        kind: "explain",
        title: "Cómo lo detectás",
        body: [
          "Xcode → Debug Memory Graph: muestra objetos vivos y quién los retiene; los ciclos salen con un ícono morado.",
          "Instruments → Leaks (memoria sin referencia accesible) y Allocations con generaciones (abandoned memory: crece y no baja al navegar atrás).",
          "En tests: `weak var sut = ViewModel(); XCTAssertNil(sut)` tras liberar la referencia fuerte.",
        ],
      },
    ],
  },
  {
    id: "l-security",
    topic: "seguridad",
    title: "Seguridad mobile: Keychain, biometría, pinning",
    goal: "Responder con precisión qué, dónde y cómo se protege en una app financiera.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "Dónde vive cada dato",
        body: [
          "Secretos (tokens, claves, PIN cifrado) → **Keychain**. Preferencias no sensibles → UserDefaults. Archivos → Documents con `.completeFileProtection` (cifrados mientras el dispositivo está bloqueado). Datos estructurados → Core Data/SwiftData con protección de archivo.",
          "Accesibilidad de Keychain: `WhenUnlocked` (default), `WhenUnlockedThisDeviceOnly` (no migra en backup, el que usás para tokens), `AfterFirstUnlock` (background).",
        ],
      },
      {
        kind: "predict",
        prompt: "¿Qué falla de seguridad tiene?",
        code: "UserDefaults.standard.set(token, forKey: \"accessToken\")",
        options: ["Ninguna, es estándar", "UserDefaults es un plist en claro, legible en backups y con jailbreak", "Solo funciona en simulador", "El token se borra al cerrar la app"],
        answer: 1,
        explanation: "Cualquier secreto va al Keychain.",
      },
      {
        kind: "explain",
        title: "Biometría con LocalAuthentication",
        body: [
          "1. `canEvaluatePolicy` para saber si hay Face ID/Touch ID configurado. 2. `evaluatePolicy` muestra el prompt. 3. `.deviceOwnerAuthenticationWithBiometrics` solo biometría; `.deviceOwnerAuthentication` permite passcode como fallback.",
          "La biometría **no autentica contra el servidor**: desbloquea un secreto local (refresh token guardado con `SecAccessControl` biométrico) con el que pedís un token nuevo. Necesita `NSFaceIDUsageDescription` en Info.plist.",
          "Errores a manejar: `userCancel`, `biometryNotEnrolled`, `biometryLockout` (ofrecé passcode), `authenticationFailed`.",
        ],
        code: "import LocalAuthentication\n\nfunc unlock() async throws -> Bool {\n    let ctx = LAContext()\n    var err: NSError?\n    guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else {\n        return try await ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: \"Ingresá tu código\")\n    }\n    return try await ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: \"Confirmá tu identidad\")\n}",
      },
      {
        kind: "fill",
        prompt: "Completá la política que acepta passcode del dispositivo como alternativa a la biometría.",
        code: "ctx.evaluatePolicy(.____, localizedReason: \"…\")",
        accept: ["^deviceOwnerAuthentication$"],
        explanation: "`.deviceOwnerAuthentication` = biometría o passcode. `WithBiometrics` es solo biometría.",
        placeholder: ".política",
      },
      {
        kind: "explain",
        title: "Comunicación segura",
        body: [
          "**ATS** (App Transport Security) ya obliga HTTPS/TLS 1.2+. No agregues `NSAllowsArbitraryLoads`.",
          "**Pinning**: además de TLS, verificás que el certificado (o mejor, la clave pública / SPKI hash) del servidor sea uno que embebiste. Así un proxy con CA instalada en el teléfono (Charles, MITM) no puede interceptar. Se implementa en `urlSession(_:didReceive:completionHandler:)` comparando el hash; incluí un pin de respaldo para rotar certificados sin romper la app.",
          "Nada sensible en logs (`os_log` con `%{private}`), ni en URLs (query params quedan en logs de servidores).",
        ],
        code: "func urlSession(_ s: URLSession, didReceive ch: URLAuthenticationChallenge) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {\n    guard let trust = ch.protectionSpace.serverTrust,\n          let cert = SecTrustCopyCertificateChain(trust) as? [SecCertificate], let leaf = cert.first,\n          let key = SecCertificateCopyKey(leaf), let data = SecKeyCopyExternalRepresentation(key, nil) as Data?\n    else { return (.cancelAuthenticationChallenge, nil) }\n    let hash = SHA256.hash(data: data).description\n    return pins.contains(hash) ? (.useCredential, URLCredential(trust: trust)) : (.cancelAuthenticationChallenge, nil)\n}",
      },
      {
        kind: "predict",
        prompt: "¿Contra qué protege el certificate pinning que TLS normal no?",
        code: "",
        options: ["Contra sniffing en wifi pública", "Contra un atacante que logró instalar su propia CA en el dispositivo y hace MITM", "Contra inyección SQL", "Contra jailbreak"],
        answer: 1,
        explanation: "TLS confía en cualquier CA instalada. Pinning solo confía en tu certificado/clave.",
      },
      {
        kind: "explain",
        title: "Checklist OWASP Mobile Top 10 (2024)",
        body: [
          "M1 Uso inadecuado de credenciales · M2 Supply chain inseguro (dependencias) · M3 Autenticación/autorización débil · M4 Validación de entrada/salida insuficiente · M5 Comunicación insegura · M6 Privacidad inadecuada · M7 Protección binaria insuficiente (ofuscación, anti-tamper) · M8 Configuración insegura · M9 Almacenamiento inseguro · M10 Criptografía insuficiente.",
          "En la entrevista alcanza con nombrar 5–6 y decir cómo los cubrís: Keychain (M9), pinning + ATS (M5), biometría + refresh rotativo (M3), SPM con versiones fijas y auditoría (M2), no loguear PII (M6), ocultar snapshot en background y detección de jailbreak como señal (M7/M8).",
        ],
      },
    ],
  },
  {
    id: "l-testing",
    topic: "testing",
    title: "Testing, Instruments y release",
    goal: "Escribir un unit test de ViewModel con mock, saber qué instrumento abrir y narrar el flujo de release.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "Unit test con XCTest",
        body: [
          "Testeás lógica, no UI: ViewModels, use cases, mappers. El ViewModel recibe sus dependencias por protocolo, en el test le pasás un fake. Los tests `async` se escriben con `await` directamente.",
          "Patrón AAA: Arrange (armar sut y fakes), Act (llamar), Assert (`XCTAssertEqual`).",
        ],
        code: "protocol UserRepository { func user() async throws -> User }\nstruct StubRepo: UserRepository {\n    var result: Result<User, Error>\n    func user() async throws -> User { try result.get() }\n}\n\nfinal class ProfileVMTests: XCTestCase {\n    func test_load_success_setsName() async {\n        let sut = ProfileVM(repo: StubRepo(result: .success(User(name: \"Ana\"))))\n        await sut.load()\n        XCTAssertEqual(sut.name, \"Ana\")\n    }\n    func test_load_failure_setsError() async {\n        let sut = ProfileVM(repo: StubRepo(result: .failure(APIError.http(500))))\n        await sut.load()\n        XCTAssertNotNil(sut.errorMessage)\n    }\n}",
      },
      {
        kind: "fill",
        prompt: "Completá la aserción que verifica que el estado quedó como esperás.",
        code: "await sut.load()\n____(sut.items.count, 3)",
        accept: ["^XCTAssertEqual$"],
        explanation: "`XCTAssertEqual(actual, esperado)`; también existen XCTAssertTrue, XCTAssertNil, XCTAssertThrowsError.",
        placeholder: "XCTAssert...",
      },
      {
        kind: "explain",
        title: "Mockear la red y UI tests",
        body: [
          "Dos niveles: (1) protocolo `HTTPClient` con stub para testear ViewModels/repos; (2) `URLProtocol` custom registrado en una `URLSessionConfiguration` para testear el cliente real sin internet.",
          "XCUITest: lanza la app real y la maneja por `accessibilityIdentifier`. Lento y frágil: solo flujos críticos (login, transferencia). Para determinismo, lanzá la app con `launchArguments` que activen datos mock.",
        ],
        code: "final class MockURLProtocol: URLProtocol {\n    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?\n    override class func canInit(with r: URLRequest) -> Bool { true }\n    override class func canonicalRequest(for r: URLRequest) -> URLRequest { r }\n    override func startLoading() {\n        let (resp, data) = Self.handler!(request)\n        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)\n        client?.urlProtocol(self, didLoad: data)\n        client?.urlProtocolDidFinishLoading(self)\n    }\n    override func stopLoading() {}\n}",
      },
      {
        kind: "predict",
        prompt: "La app tiene scroll con tirones en una lista. ¿Qué instrumento abrís primero?",
        code: "",
        options: ["Leaks", "Time Profiler (con 'Hide system libraries')", "Network", "Energy"],
        answer: 1,
        explanation: "Tirones = trabajo en el main thread. Time Profiler muestra qué funciones tuyas consumen CPU en main. Core Animation/Animation Hitches complementa.",
      },
      {
        kind: "explain",
        title: "Instruments: cuál para qué",
        body: [
          "Time Profiler → CPU, main thread bloqueado. Allocations → crecimiento de memoria (abandoned memory con marcas generacionales). Leaks → memoria sin referencia. Network → requests, tamaños, latencia. Core Animation / Animation Hitches → frames caídos. Energy → batería.",
          "Medí antes y después; dejá `os_signpost` en puntos críticos para ver intervalos en Instruments y en MetricKit en producción.",
        ],
      },
      {
        kind: "explain",
        title: "Release paso a paso",
        body: [
          "1. Rama `release/x.y` desde `main`; congelás features. 2. CI sube el build number, archiva y firma (Fastlane o Xcode Cloud). 3. TestFlight interno (hasta 100 testers del equipo, sin review). 4. TestFlight externo (beta review de Apple, hasta 10 000 testers). 5. Submit a App Store review con notas y cuenta demo. 6. Phased release: 1 % → 100 % en 7 días, pausable. 7. Monitoreo de crash-free users 48 h.",
          "No existe rollback a la versión anterior: si algo falla, pausás el phased release, apagás la feature por flag remoto y subís un hotfix pidiendo expedited review.",
        ],
      },
      {
        kind: "fill",
        prompt: "Completá el mecanismo que te deja apagar una funcionalidad en producción sin publicar otra versión.",
        code: "if remoteConfig.isEnabled(\"new_transfer_flow\") { … }\n// Esto es un ____ flag",
        accept: ["^feature$"],
        explanation: "Feature flags (remote config) desacoplan deploy de release y son tu rollback real en mobile.",
        placeholder: "palabra",
      },
      {
        kind: "explain",
        title: "Monitoreo en producción",
        body: [
          "Crashlytics o Sentry con dSYMs subidos desde CI (sin dSYMs los stack traces no se simbolizan). Alertas por nuevo crash y por caída de crash-free users por versión.",
          "MetricKit: hangs, launch time, memoria, CPU agregados sin PII. Xcode Organizer: crashes, energía, escrituras a disco.",
          "KPI: crash-free users ≥ 99.5 %, launch time < 400 ms, tasa de error de red por endpoint.",
        ],
      },
    ],
  },
];
