import type { CourseContent } from "../types";

const content: CourseContent = {
  lessons: [
    {
      id: "main-thread-gcd",
      title: "Hilo principal y GCD legacy",
      goal: "Saber qué corre en main, cómo saltar a main desde un callback y leer código con colas, `DispatchGroup` y `OperationQueue` sin meter deadlocks.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "La UI vive en el main thread",
          body: [
            "UIKit y SwiftUI solo se tocan desde el hilo principal. Si actualizás un label, recargás una tabla o cambiás estado de una vista desde otro hilo, el resultado es indefinido: glitches, crashes raros o nada.",
            "En Debug, el **Main Thread Checker** (activo por defecto en el scheme) te avisa en consola con `Main Thread Checker: UI API called on a background thread`. Si lo ves en un PR, es un bug, no un warning cosmético.",
            "Los completion handlers de `URLSession` llegan en una cola de fondo. En código con callbacks, el patrón clásico es procesar ahí y saltar a main con `DispatchQueue.main.async` solo para tocar la UI.",
          ],
          code: `URLSession.shared.dataTask(with: url) { data, _, _ in
    // Acá estamos en una cola de fondo de URLSession
    let name = parseName(data)            // trabajo pesado: OK fuera de main
    DispatchQueue.main.async {
        self.nameLabel.text = name        // la UI, siempre en main
    }
}.resume()`,
        },
        {
          kind: "fill",
          prompt: "El callback llega en una cola de fondo. Completá para recargar la tabla en el hilo principal sin bloquear a nadie.",
          code: `api.fetchItems { items in
    self.items = items
    ____ {
        self.tableView.reloadData()
    }
}`,
          accept: ["^DispatchQueue\\.main\\.async$"],
          explanation: "`DispatchQueue.main.async` encola el bloque en el main thread y vuelve enseguida. `sync` bloquearía la cola actual esperando a main.",
          placeholder: "DispatchQueue...",
        },
        {
          kind: "explain",
          title: "Colas seriales y concurrentes, sync y async",
          body: [
            "Una cola **serial** ejecuta un bloque por vez, en orden FIFO. Una cola **concurrente** (`attributes: .concurrent` o las `DispatchQueue.global(qos:)`) puede correr varios a la vez, así que no hay orden garantizado entre ellos.",
            "`async` encola y vuelve enseguida. `sync` encola y **bloquea** a quien llama hasta que el bloque termine. En una cola serial, un `sync` espera a todo lo que estaba encolado antes.",
            "Por eso este ejemplo tiene un orden determinista: A y B se encolan, `sync` encola C detrás y espera; recién después sigue la línea de D.",
          ],
          code: `let queue = DispatchQueue(label: "com.app.serial")
queue.async { print("A") }
queue.async { print("B") }
queue.sync { print("C") }
print("D")`,
          output: "A\nB\nC\nD",
        },
        {
          kind: "predict",
          prompt: "La app está corriendo (no termina el proceso). ¿Qué podés afirmar sobre la salida?",
          code: `let queue = DispatchQueue(label: "com.app.work", attributes: .concurrent)
queue.async { print("1") }
queue.async { print("2") }
print("3")`,
          options: [
            "Siempre `1`, `2`, `3`",
            "Siempre `3`, `1`, `2`",
            "Se imprimen los tres, pero en cualquier orden: `async` no espera y la cola concurrente puede correr 1 y 2 a la vez",
            "No imprime nada: falta llamar a `resume()`",
          ],
          answer: 2,
          explanation: "`async` vuelve enseguida, así que `print(\"3\")` compite con los bloques. Además la cola es concurrente: 1 y 2 pueden ejecutarse en paralelo y terminar en cualquier orden. Los tres aparecen, el orden no está garantizado. `resume()` es de `URLSessionTask`, no de las colas.",
        },
        {
          kind: "explain",
          title: "DispatchGroup: esperar varias tareas",
          body: [
            "Cuando lanzás varias requests con callbacks y necesitás saber cuándo terminaron todas, usás un `DispatchGroup`: `enter()` antes de cada una, `leave()` cuando termina, y `notify(queue:)` corre cuando el contador vuelve a cero.",
            "La regla de oro: cada `enter()` tiene exactamente un `leave()`, en **todos** los caminos (éxito y error). Un `leave()` de más crashea; uno de menos deja el `notify` esperando para siempre.",
            "Evitá `group.wait()` en main: bloquea el hilo y congela la UI. `notify` no bloquea a nadie.",
          ],
          code: `let group = DispatchGroup()
var results: [String] = []   // solo se toca desde main

for id in ["a", "b"] {
    group.enter()
    api.fetch(id) { value in
        DispatchQueue.main.async {
            results.append(value)
            group.leave()
        }
    }
}

group.notify(queue: .main) {
    print("listo:", results.count)
}`,
          output: "listo: 2",
        },
        {
          kind: "predict",
          prompt: "Un compañero escribió esto. ¿Qué pasa cuando alguna request falla?",
          code: `group.enter()
api.fetch(id) { result in
    guard case .success(let value) = result else { return }
    values.append(value)
    group.leave()
}

group.notify(queue: .main) {
    self.hideSpinner()
}`,
          options: [
            "Crash inmediato por `enter`/`leave` desbalanceados",
            "El `notify` nunca se ejecuta: el spinner queda girando para siempre",
            "El `notify` se ejecuta igual cuando vence el timeout de la request",
            "El compilador marca el `return` sin `leave()` como error",
          ],
          answer: 1,
          explanation: "En el camino de error se hace `return` sin `leave()`. El contador del grupo nunca llega a cero, así que `notify` nunca corre. No hay crash (eso pasa con un `leave()` de más) ni chequeo del compilador. El fix típico es `defer { group.leave() }` al principio del callback.",
        },
        {
          kind: "explain",
          title: "OperationQueue: dependencias, límite y cancelación",
          body: [
            "`OperationQueue` es la capa de alto nivel sobre GCD que todavía vas a ver en código legacy (descargas de imágenes, sincronizaciones). Sus ventajas: `addDependency` para encadenar, `maxConcurrentOperationCount` para limitar cuántas corren a la vez, y cancelación.",
            "`cancel()` no frena nada por la fuerza: marca `isCancelled`. Si la operación no empezó, no se ejecuta; si ya está corriendo, tiene que chequear `isCancelled` ella misma. `cancelAllOperations()` lo hace para toda la cola (típico en `deinit` o al salir de la pantalla).",
            "Con la cadena de dependencias del ejemplo el orden es determinista aunque se agreguen al revés.",
          ],
          code: `let queue = OperationQueue()
queue.maxConcurrentOperationCount = 2

let download = BlockOperation { print("descarga") }
let resize = BlockOperation { print("redimensiona") }
let save = BlockOperation { print("guarda") }

resize.addDependency(download)
save.addDependency(resize)

queue.addOperations([save, resize, download], waitUntilFinished: true)`,
          output: "descarga\nredimensiona\nguarda",
        },
        {
          kind: "predict",
          prompt: "Este código corre en `viewDidLoad`, o sea, en el main thread. ¿Qué pasa?",
          code: `DispatchQueue.main.sync {
    print("A")
}
print("B")`,
          options: [
            "Imprime `A` y después `B`",
            "Imprime `B` y después `A`",
            "Imprime solo `B`",
            "Ninguna de las dos: es un deadlock (en la práctica, libdispatch crashea)",
          ],
          answer: 3,
          explanation: "`sync` bloquea el hilo actual (main) hasta que el bloque termine, pero el bloque está encolado en main, que está bloqueado esperándolo. Nadie avanza. GCD detecta el caso de `sync` sobre la cola en la que ya estás y suele crashear con `EXC_BREAKPOINT`. Lo mismo pasa con `queue.sync` dentro de un bloque que ya corre en esa misma cola serial.",
        },
        {
          kind: "write",
          prompt: "Completá `loadDashboard`: lanzá `api.fetchUser` y `api.fetchOrders` en paralelo con un `DispatchGroup`, guardá los resultados y llamá a `completion` en el main thread cuando terminen las dos.",
          starter: `func loadDashboard(completion: @escaping (User?, [Order]) -> Void) {
    var user: User?
    var orders: [Order] = []
    // api.fetchUser { (User?) in ... }
    // api.fetchOrders { ([Order]) in ... }
}`,
          checks: [
            { pattern: "DispatchGroup\\(\\)", label: "Crea un `DispatchGroup`" },
            { pattern: "\\.enter\\(\\)", label: "Llama a `enter()` antes de cada request" },
            { pattern: "\\.leave\\(\\)", label: "Llama a `leave()` cuando termina cada una" },
            { pattern: "notify\\(queue:\\s*\\.main", label: "Usa `notify(queue: .main)` para el completion" },
          ],
          warnings: [
            { pattern: "\\.wait\\(", label: "`group.wait()` bloquea el hilo (en main, congela la UI)" },
            { pattern: "DispatchQueue\\.main\\.sync", label: "`DispatchQueue.main.sync` puede causar deadlock" },
          ],
          solution: `func loadDashboard(completion: @escaping (User?, [Order]) -> Void) {
    var user: User?
    var orders: [Order] = []
    let group = DispatchGroup()

    group.enter()
    api.fetchUser { result in
        DispatchQueue.main.async {
            user = result
            group.leave()
        }
    }

    group.enter()
    api.fetchOrders { result in
        DispatchQueue.main.async {
            orders = result
            group.leave()
        }
    }

    group.notify(queue: .main) {
        completion(user, orders)
    }
}`,
          hint: "Escribí las variables solo desde main (con `DispatchQueue.main.async`) para no tener un data race entre los dos callbacks.",
        },
      ],
    },
    {
      id: "async-await",
      title: "async/await y tareas",
      goal: "Escribir funciones `async`, lanzar trabajo con `Task` y `.task`, paralelizar con `async let` y `TaskGroup`, y cancelar de forma cooperativa.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Funciones async y await",
          body: [
            "Una función `async` puede **suspenderse** sin bloquear el hilo: mientras espera la red, el hilo queda libre para otra cosa. Cada `await` marca un punto donde eso puede pasar.",
            "Los `await` uno detrás del otro corren en secuencia: el segundo empieza cuando el primero terminó. Eso hace que el orden de los `print` sea determinista.",
            "`async throws` combina las dos cosas: llamás con `try await`. Casi todas las APIs de Apple ya tienen versión async (`URLSession.shared.data(from:)`).",
          ],
          code: `func fetchUser() async throws -> User {
    let (data, _) = try await URLSession.shared.data(from: userURL)
    return try JSONDecoder().decode(User.self, from: data)
}

func step(_ name: String) async {
    try? await Task.sleep(for: .milliseconds(100))
    print(name)
}

await step("uno")
await step("dos")
print("fin")`,
          output: "uno\ndos\nfin",
        },
        {
          kind: "predict",
          code: `func work() async -> Int {
    try? await Task.sleep(for: .seconds(1))
    return 42
}

print("antes")
let value = await work()
print("después", value)`,
          options: [
            "`antes` y, un segundo más tarde, `después 42`",
            "`después 42` y después `antes`",
            "`antes` y enseguida `después 0`: no espera el sleep",
            "Solo `antes`: el `await` nunca vuelve",
          ],
          answer: 0,
          explanation: "Se imprime `antes`, `await work()` suspende el código durante el sleep (sin bloquear el hilo) y cuando `work` devuelve 42 sigue la línea siguiente. `try?` solo descarta un posible error del sleep.",
        },
        {
          kind: "explain",
          title: "Task {} y .task {}",
          body: [
            "Desde código sincrónico (la acción de un botón, un delegate de UIKit) no podés usar `await` directo: creás un `Task { }`. Ese `Task` **hereda el actor** del contexto: creado desde un `@MainActor`, su cuerpo corre en el main actor. `Task.detached` no hereda nada y casi nunca lo necesitás.",
            "Un `Task` suelto no se cancela solo si perdés la referencia: si importa, guardalo y llamá a `cancel()`.",
            "En SwiftUI preferí `.task { }`: arranca cuando aparece la vista y se **cancela automáticamente** cuando desaparece. `.task(id: valor)` además la reinicia cada vez que cambia `valor`.",
          ],
          code: `struct ProfileView: View {
    @State private var model = ProfileModel()

    var body: some View {
        List(model.posts) { PostRow(post: $0) }
            .task { await model.load() }        // se cancela al desaparecer
            .refreshable { await model.load() }
            .toolbar {
                Button("Reintentar") {
                    Task { await model.load() }  // puente sync → async
                }
            }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el modificador para cargar los datos cuando aparece la vista y cancelar la carga si el usuario se va.",
          code: `List(model.items) { ItemRow(item: $0) }
    .____ { await model.load() }`,
          accept: ["^task$"],
          explanation: "`.task { }` ata la vida de la tarea a la de la vista: se cancela sola al desaparecer. Con `onAppear { Task { } }` tendrías que cancelar a mano.",
          placeholder: "modificador",
        },
        {
          kind: "explain",
          title: "async let: trabajo en paralelo",
          body: [
            "Dos `await` seguidos tardan la **suma** de los tiempos. Si las dos operaciones son independientes, `async let` las arranca a las dos ya, y el `await` posterior espera los resultados: el total es aproximadamente el **máximo**.",
            "El resultado se combina recién cuando hacés `await`, así que el orden del array es el que escribiste, no el orden en que terminaron.",
            "Si una falla, la otra se cancela al salir del scope. Un `async let` no puede escapar de la función: es concurrencia **estructurada**.",
          ],
          code: `func slow(_ n: Int) async -> Int {
    try? await Task.sleep(for: .seconds(n))
    return n * 10
}

async let a = slow(2)
async let b = slow(1)
let result = await [a, b]   // ~2 s en total, no 3
print(result)`,
          output: "[20, 10]",
        },
        {
          kind: "predict",
          prompt: "¿Qué imprime y cuánto tarda aproximadamente?",
          code: `func slow(_ n: Int) async -> Int {
    try? await Task.sleep(for: .seconds(n))
    return n
}

let x = await slow(2)
let y = await slow(3)
print(x + y)`,
          options: [
            "`5`, en ~3 segundos",
            "`5`, en ~5 segundos",
            "`23`, en ~5 segundos",
            "`5`, en ~2 segundos",
          ],
          answer: 1,
          explanation: "Son dos `await` secuenciales: `slow(3)` recién empieza cuando terminó `slow(2)`, así que tarda 2 + 3 = ~5 s. La suma es 5. Con `async let x` y `async let y` tardaría ~3 s.",
        },
        {
          kind: "explain",
          title: "TaskGroup: cantidad dinámica de tareas",
          body: [
            "`async let` sirve cuando sabés cuántas tareas hay al escribir el código. Para N elementos (miniaturas de una lista, páginas) usás `withTaskGroup` o `withThrowingTaskGroup`: `addTask` por cada uno y después iterás el grupo con `for await`.",
            "Los resultados llegan en **orden de finalización**. Si necesitás el orden original, devolvé el índice o la clave junto con el valor.",
            "En la versión throwing, si una tarea lanza y vos propagás el error, el resto del grupo se cancela. Igual que `async let`, las tareas hijas no sobreviven al bloque.",
          ],
          code: `func thumbnails(for ids: [String]) async throws -> [String: UIImage] {
    try await withThrowingTaskGroup(of: (String, UIImage).self) { group in
        for id in ids {
            group.addTask { (id, try await api.thumbnail(id)) }
        }
        var result: [String: UIImage] = [:]
        for try await (id, image) in group {
            result[id] = image
        }
        return result
    }
}`,
        },
        {
          kind: "predict",
          prompt: "¿Qué podés afirmar sobre lo que imprime?",
          code: `let order = await withTaskGroup(of: Int.self) { group in
    for n in [3, 1, 2] {
        group.addTask {
            try? await Task.sleep(for: .seconds(n))
            return n
        }
    }
    var collected: [Int] = []
    for await n in group { collected.append(n) }
    return collected
}
print(order)`,
          options: [
            "Siempre `[3, 1, 2]`: los resultados respetan el orden de `addTask`",
            "Siempre `[6]`: el grupo suma los valores",
            "No compila: `withTaskGroup` exige `try`",
            "Los valores llegan en orden de finalización: lo esperable es `[1, 2, 3]`, pero ese orden no es parte del contrato",
          ],
          answer: 3,
          explanation: "`for await` sobre el grupo entrega cada resultado cuando la tarea termina. Por los sleeps lo normal es `[1, 2, 3]`, pero depende del scheduling: si el orden importa, ordená o llevá el índice. `withTaskGroup` (sin throwing) no necesita `try` y el `try?` interno absorbe el error del sleep.",
        },
        {
          kind: "write",
          prompt: "Este código hace dos requests independientes en secuencia. Reescribilo para que corran en paralelo con `async let`.",
          starter: `func loadProfile() async throws -> Profile {
    let user = try await api.fetchUser()
    let posts = try await api.fetchPosts()
    return Profile(user: user, posts: posts)
}`,
          checks: [
            { pattern: "async\\s+let\\s+\\w+\\s*=\\s*(try\\s+)?api\\.fetchUser\\(\\)", label: "`async let` para `fetchUser()`" },
            { pattern: "async\\s+let\\s+\\w+\\s*=\\s*(try\\s+)?api\\.fetchPosts\\(\\)", label: "`async let` para `fetchPosts()`" },
            { pattern: "try\\s+await", label: "Espera los resultados con `try await`" },
          ],
          warnings: [
            { pattern: "let\\s+\\w+\\s*=\\s*try\\s+await\\s+api\\.fetch", label: "Un `try await` directo en la declaración vuelve a ser secuencial" },
            { pattern: "Task\\.detached", label: "No hace falta `Task.detached`: `async let` ya es concurrente y estructurado" },
          ],
          solution: `func loadProfile() async throws -> Profile {
    async let user = api.fetchUser()
    async let posts = api.fetchPosts()
    return try await Profile(user: user, posts: posts)
}`,
          hint: "En la declaración `async let` no va `await`; el `try await` va donde usás los valores.",
        },
        {
          kind: "explain",
          title: "Cancelación cooperativa",
          body: [
            "`task.cancel()` no mata la tarea: solo prende una marca. El código que corre tiene que **cooperar**: `try Task.checkCancellation()` lanza `CancellationError` si está cancelada, y `Task.isCancelled` te deja cortar devolviendo un resultado parcial.",
            "Las APIs de Apple ya cooperan: `Task.sleep` y `URLSession.data(from:)` lanzan al cancelarse. Un loop de CPU puro, en cambio, sigue hasta el final si no chequea.",
            "La cancelación se propaga a las tareas hijas (`async let`, `TaskGroup`), no a un `Task { }` suelto creado adentro.",
          ],
          code: `func processAll(_ photos: [Photo]) async throws {
    for photo in photos {
        try Task.checkCancellation()    // corta con CancellationError
        await filter(photo)
    }
}

let task = Task { try await processAll(photos) }
// el usuario cierra la pantalla:
task.cancel()`,
        },
        {
          kind: "fill",
          prompt: "Completá la línea que corta el loop con `CancellationError` si alguien canceló la tarea.",
          code: `for page in 1...totalPages {
    ____
    let items = await parse(page)
    all.append(contentsOf: items)
}`,
          accept: ["^try Task\\.checkCancellation\\(\\)$"],
          explanation: "`try Task.checkCancellation()` lanza `CancellationError` cuando la tarea actual está cancelada. Sin eso, el loop seguiría trabajando aunque nadie espere el resultado.",
          hint: "Es un método estático de `Task` y lanza, así que lleva `try`.",
        },
        {
          kind: "predict",
          code: `let task = Task {
    try await Task.sleep(for: .seconds(10))
    print("terminó")
}
task.cancel()

do {
    try await task.value
} catch {
    print(error is CancellationError)
}`,
          options: [
            "`terminó`",
            "`false`",
            "`true`",
            "Nada: `cancel()` mata la tarea en el acto sin lanzar error",
          ],
          answer: 2,
          explanation: "`Task.sleep` coopera con la cancelación: tanto si la tarea ya dormía como si todavía no había empezado, lanza `CancellationError`. El `print(\"terminó\")` nunca corre, `task.value` relanza el error y el `catch` imprime `true`.",
        },
      ],
    },
    {
      id: "bridging",
      title: "Puentes: continuations y AsyncStream",
      goal: "Envolver completion handlers y delegates en funciones `async` reanudando exactamente una vez, y exponer flujos de eventos como `AsyncStream`.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "De completion handler a async",
          body: [
            "Los codebases reales mezclan callbacks (SDKs, código viejo) con async/await. Para que el código nuevo llame `try await` sin reescribir el viejo, envolvés el callback con `withCheckedThrowingContinuation` (o `withCheckedContinuation` si no lanza).",
            "La regla: la continuation se reanuda **exactamente una vez** en todos los caminos. Dos veces → la versión checked crashea con `SWIFT TASK CONTINUATION MISUSE`. Nunca → la tarea queda suspendida para siempre (y en consola aparece que la continuation se perdió).",
            "Si el callback ya te da un `Result`, `resume(with:)` cubre éxito y error en una línea. La variante `Unsafe` tiene las mismas reglas sin los chequeos.",
          ],
          code: `// API vieja
func fetchUser(id: String, completion: @escaping (Result<User, Error>) -> Void)

// Wrapper async
func fetchUser(id: String) async throws -> User {
    try await withCheckedThrowingContinuation { continuation in
        fetchUser(id: id) { result in
            continuation.resume(with: result)
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el método que entrega el valor a quien está esperando con `await`.",
          code: `func currentUser() async -> User {
    await withCheckedContinuation { continuation in
        session.loadUser { user in
            continuation.____(returning: user)
        }
    }
}`,
          accept: ["^resume$"],
          explanation: "`resume(returning:)` reanuda la tarea suspendida con el valor. Para errores es `resume(throwing:)` (solo en la variante throwing) y para un `Result`, `resume(with:)`.",
          placeholder: "método",
        },
        {
          kind: "predict",
          prompt: "¿Qué pasa cuando `legacy.load` termina con error?",
          code: `func load() async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        legacy.load { data, error in
            if let error {
                continuation.resume(throwing: error)
            }
            continuation.resume(returning: data ?? Data())
        }
    }
}`,
          options: [
            "Lanza el error y listo: el segundo `resume` se ignora",
            "Devuelve `Data()` vacío",
            "Crash: la continuation se reanuda dos veces y la versión checked lo detecta",
            "Error de compilación: falta un `return`",
          ],
          answer: 2,
          explanation: "Falta un `return` (o un `else`) después de `resume(throwing:)`, así que en el camino de error se ejecutan los dos `resume`. Reanudar dos veces es un error de programación: `CheckedContinuation` lo detecta y termina la app. El compilador no lo ve porque el closure devuelve `Void`.",
        },
        {
          kind: "explain",
          title: "Envolver un delegate",
          body: [
            "Con delegates la continuation no se reanuda dentro del closure, sino más tarde, en otro método. Guardala en una propiedad, reanudala en el callback y ponela en `nil` enseguida: así un segundo callback (`didUpdateLocations` puede llamarse varias veces) no la reanuda de nuevo.",
            "Este patrón sirve para eventos de **un solo valor** (una ubicación, un permiso, un pago). Para una serie de valores, la herramienta es `AsyncStream`.",
          ],
          code: `final class LocationProvider: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation, Error>?

    func currentLocation() async throws -> CLLocation {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.delegate = self
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        continuation?.resume(returning: location)
        continuation = nil                     // nunca dos veces
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}`,
        },
        {
          kind: "write",
          prompt: "Envolvé `download(url:completion:)` (que llama `completion(data, error)`) en `func download(url: URL) async throws -> Data`. Reanudá exactamente una vez en cada camino; si no hay ni datos ni error, lanzá `DownloadError.empty`.",
          starter: `// Existe: func download(url: URL, completion: @escaping (Data?, Error?) -> Void)

func download(url: URL) async throws -> Data {

}`,
          checks: [
            { pattern: "withChecked(Throwing)?Continuation", label: "Usa `withCheckedThrowingContinuation`" },
            { pattern: "resume\\(throwing:", label: "Reanuda con error en el camino de falla" },
            { pattern: "resume\\(returning:", label: "Reanuda con los datos en el camino feliz" },
            { pattern: "\\belse\\b|\\breturn\\b", label: "Caminos exclusivos (`else` o `return`) para no reanudar dos veces" },
          ],
          warnings: [
            { pattern: "data!", label: "Force unwrap de `data`: crashea si viene `nil`" },
            { pattern: "withUnsafe", label: "Preferí la versión checked: detecta los errores de reanudación" },
          ],
          solution: `func download(url: URL) async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        download(url: url) { data, error in
            if let error {
                continuation.resume(throwing: error)
            } else if let data {
                continuation.resume(returning: data)
            } else {
                continuation.resume(throwing: DownloadError.empty)
            }
        }
    }
}`,
          hint: "Una cadena `if let error` / `else if let data` / `else` garantiza un solo `resume` por llamada.",
        },
        {
          kind: "explain",
          title: "AsyncStream: muchos valores en el tiempo",
          body: [
            "Para eventos repetidos (mensajes de un websocket, progreso de una descarga, notificaciones) creás un `AsyncStream`: `yield` emite un valor y `finish()` termina la secuencia. Del otro lado consumís con `for await`.",
            "Sin `finish()` el `for await` se queda esperando más valores. Con `continuation.onTermination` limpiás recursos (desconectar, sacar un observer) cuando el stream termina o el consumidor cancela su tarea.",
            "`AsyncThrowingStream` agrega `finish(throwing:)` y se consume con `for try await`. `AsyncStream.makeStream(of:)` te da el stream y la continuation por separado, útil cuando el productor es una clase.",
          ],
          code: `let stream = AsyncStream<Int> { continuation in
    for i in 1...3 {
        continuation.yield(i)
    }
    continuation.finish()
}

for await value in stream {
    print(value)
}
print("fin")`,
          output: "1\n2\n3\nfin",
        },
        {
          kind: "predict",
          code: `let stream = AsyncThrowingStream<Int, Error> { continuation in
    continuation.yield(1)
    continuation.yield(2)
    continuation.finish(throwing: URLError(.timedOut))
}

do {
    for try await n in stream { print(n) }
    print("completo")
} catch {
    print("error")
}`,
          options: [
            "`error`, sin valores",
            "`1`, `2`, `completo`",
            "`1`, `2`, `completo`, `error`",
            "`1`, `2`, `error`",
          ],
          answer: 3,
          explanation: "Los valores emitidos antes de terminar se entregan en orden: 1 y 2. Después `finish(throwing:)` hace que el `for try await` lance, así que se salta `print(\"completo\")` y se ejecuta el `catch`.",
        },
        {
          kind: "write",
          prompt: "`client` es un websocket con callback: `client.onMessage: ((String) -> Void)?`, `client.connect()` y `client.disconnect()`. Escribí `func messages() -> AsyncStream<String>` que emita cada mensaje y desconecte cuando el consumidor deja de escuchar.",
          starter: `func messages() -> AsyncStream<String> {

}`,
          checks: [
            { pattern: "AsyncStream\\s*(<\\s*String\\s*>)?\\s*\\{", label: "Construye un `AsyncStream`" },
            { pattern: "\\.yield\\(", label: "Emite cada mensaje con `yield`" },
            { pattern: "onTermination", label: "Desconecta en `onTermination`" },
            { pattern: "connect\\(\\)", label: "Conecta el cliente" },
          ],
          warnings: [
            { pattern: "withChecked", label: "Una continuation de un solo uso no sirve para muchos valores" },
          ],
          solution: `func messages() -> AsyncStream<String> {
    AsyncStream { continuation in
        client.onMessage = { message in
            continuation.yield(message)
        }
        continuation.onTermination = { _ in
            client.disconnect()
        }
        client.connect()
    }
}`,
          hint: "Configurá `onMessage` y `onTermination` antes de `connect()` para no perder el primer mensaje.",
        },
      ],
    },
    {
      id: "actors",
      title: "Actors y @MainActor",
      goal: "Proteger estado compartido con `actor`, aislar view models en `@MainActor`, razonar sobre reentrancy y deduplicar trabajo concurrente.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "actor: estado mutable compartido sin data races",
          body: [
            "Un **data race** es cuando dos hilos acceden a la misma memoria a la vez y al menos uno escribe. El resultado es indefinido: valores perdidos o crashes en `Dictionary` que no se reproducen.",
            "Un `actor` es un tipo por referencia que serializa el acceso a su estado: adentro accedés sincrónicamente; desde afuera, con `await`. Es como una clase con su propia cola serial, pero el compilador lo verifica.",
            "En el ejemplo 1000 tareas concurrentes incrementan y el resultado siempre es 1000.",
          ],
          code: `actor Counter {
    private(set) var value = 0
    func increment() { value += 1 }
}

let counter = Counter()
await withTaskGroup(of: Void.self) { group in
    for _ in 1...1000 {
        group.addTask { await counter.increment() }
    }
}
print(await counter.value)`,
          output: "1000",
        },
        {
          kind: "predict",
          prompt: "Proyecto en modo Swift 5 sin chequeos estrictos de concurrencia. ¿Qué imprime?",
          code: `final class UnsafeCounter { var value = 0 }

let c = UnsafeCounter()
DispatchQueue.concurrentPerform(iterations: 1000) { _ in
    c.value += 1
}
print(c.value)`,
          options: [
            "Un número que puede ser menor a `1000` y variar entre ejecuciones (o incluso crashear): es un data race",
            "Siempre `1000`: `+= 1` es atómico",
            "Siempre `0`: los cambios quedan en otros hilos",
            "No compila",
          ],
          answer: 0,
          explanation: "`concurrentPerform` ejecuta las iteraciones en paralelo. `c.value += 1` es leer, sumar y escribir: dos hilos pueden leer el mismo valor y uno pisa al otro. No es atómico. En Swift 5 compila; Thread Sanitizer lo reporta. Con un `actor` o un lock el resultado sería siempre 1000.",
        },
        {
          kind: "fill",
          prompt: "Varias tareas leen y escriben esta caché a la vez. Completá la palabra clave para que el compilador garantice el acceso serializado.",
          code: `____ ImageCache {
    private var images: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? { images[url] }
    func store(_ image: UIImage, for url: URL) { images[url] = image }
}`,
          accept: ["^actor$"],
          explanation: "Con `actor`, cada llamada desde afuera (`await cache.image(for:)`) pasa de a una por el estado. Con `class` tendrías que proteger el diccionario a mano con una cola o un lock.",
          placeholder: "palabra clave",
        },
        {
          kind: "explain",
          title: "@MainActor en el view model",
          body: [
            "El main actor es el actor global del hilo principal. Marcar el view model `@MainActor` garantiza que todo su estado se lee y escribe en main: la vista lo puede observar sin riesgo. Vale igual para `@Observable` (iOS 17) y para `ObservableObject` con `@Published`.",
            "El `await` dentro de un método `@MainActor` no bloquea main: suspende el método y libera el hilo mientras la request corre. Cuando vuelve, sigue en main y asigna el resultado.",
            "Desde otro contexto saltás a main con `await MainActor.run { }` o con un `Task { @MainActor in }`.",
          ],
          code: `@MainActor
@Observable
final class FeedViewModel {
    var posts: [Post] = []
    var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            posts = try await api.fetchPosts()  // main queda libre mientras espera
        } catch {
            posts = []
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "¿En qué contexto corre la asignación `title = newTitle`?",
          code: `@MainActor
final class SettingsModel {
    var title = ""

    func refresh() {
        Task {
            let newTitle = try await api.fetchTitle()
            title = newTitle
        }
    }
}`,
          options: [
            "En cualquier hilo de fondo: `Task { }` siempre corre en el pool global",
            "En el main actor: `Task { }` hereda el aislamiento del contexto donde se crea",
            "No compila: desde un `Task` hay que usar `Task.detached`",
            "Depende del hilo en el que responde `api`",
          ],
          answer: 1,
          explanation: "`refresh()` es `@MainActor`, y un `Task { }` creado ahí hereda ese aislamiento. La request se espera sin bloquear main y al volver la asignación corre en el main actor. `Task.detached` haría lo contrario: perder el aislamiento.",
        },
        {
          kind: "explain",
          title: "Reentrancy: el estado puede cambiar en cada await",
          body: [
            "Los actors son **reentrantes**: mientras un método está suspendido en un `await`, el actor atiende otras llamadas. Lo que chequeaste antes del `await` puede no valer después.",
            "En la versión con bug, dos `withdraw(80)` pasan el `guard` con saldo 100, se suspenden en `audit`, y los dos descuentan: el saldo queda en -60. No hay data race (el acceso está serializado), pero sí un bug de lógica.",
            "Regla práctica: hacé las mutaciones que dependen de un chequeo de forma sincrónica, antes de suspender, o volvé a chequear después del `await`.",
          ],
          code: `actor BankAccount {
    private var balance = 100

    // ❌ chequea, suspende, después muta
    func withdrawBuggy(_ amount: Int) async -> Bool {
        guard balance >= amount else { return false }
        await audit.record(amount)
        balance -= amount
        return true
    }

    // ✅ chequea y muta sin suspender en el medio
    func withdraw(_ amount: Int) async -> Bool {
        guard balance >= amount else { return false }
        balance -= amount
        await audit.record(amount)
        return true
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Con `withdrawBuggy` y saldo inicial 100, ¿cuál de estas afirmaciones es correcta?",
          code: `let account = BankAccount()
async let a = account.withdrawBuggy(80)
async let b = account.withdrawBuggy(80)
print(await a, await b)`,
          options: [
            "Solo puede salir `true false` o `false true`: el actor nunca deja entrar dos `withdrawBuggy`",
            "Siempre `false false`",
            "Puede salir `true true`, y el saldo termina en `-60`",
            "Deadlock: el actor queda bloqueado durante el `await`",
          ],
          answer: 2,
          explanation: "La primera llamada pasa el `guard` y se suspende en `audit.record`. El actor queda libre, entra la segunda, también ve 100 y se suspende. Al volver, las dos descuentan. `true false` también es posible si la primera termina antes de que entre la segunda: por eso el bug es intermitente. Un actor nunca se bloquea por un `await`.",
        },
        {
          kind: "explain",
          title: "Deduplicar trabajo concurrente: un solo refresh de token",
          body: [
            "Caso clásico de guardia: vence el token, cinco requests reciben 401 a la vez y cada una dispara su refresh. El backend rota el refresh token, cuatro fallan y el usuario termina deslogueado.",
            "La solución usa la reentrancy a favor: el actor guarda la `Task` del refresh en curso. La primera llamada la crea y la guarda **antes** de su primer `await`; las que entran mientras tanto encuentran la tarea y esperan su `value`.",
            "El `defer` limpia la tarea al terminar (con éxito o error), así un fallo no queda cacheado para siempre.",
          ],
          code: `actor TokenProvider {
    private var token: Token?
    private var refreshTask: Task<Token, Error>?

    func validToken() async throws -> Token {
        if let token, !token.isExpired { return token }
        if let refreshTask { return try await refreshTask.value }  // ya hay uno en curso

        let task = Task { try await authAPI.refresh() }
        refreshTask = task
        defer { refreshTask = nil }

        let newToken = try await task.value
        token = newToken
        return newToken
    }
}`,
        },
        {
          kind: "write",
          prompt: "Convertí `FavoritesStore` (protegido con una cola serial) en un `actor`. Mantené `toggle(_:)` y `contains(_:)` y eliminá la sincronización manual.",
          starter: `final class FavoritesStore {
    private var ids: Set<String> = []
    private let queue = DispatchQueue(label: "favorites")

    func toggle(_ id: String) {
        queue.sync {
            if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
        }
    }

    func contains(_ id: String) -> Bool {
        queue.sync { ids.contains(id) }
    }
}`,
          checks: [
            { pattern: "^\\s*actor\\s+FavoritesStore", label: "Declara `actor FavoritesStore`" },
            { pattern: "func\\s+toggle\\(", label: "Mantiene `toggle(_:)`" },
            { pattern: "func\\s+contains\\(", label: "Mantiene `contains(_:)`" },
          ],
          warnings: [
            { pattern: "DispatchQueue", label: "Con un actor la cola sobra: el actor ya serializa el acceso" },
            { pattern: "NSLock|\\.lock\\(\\)", label: "No mezcles locks con el aislamiento del actor" },
          ],
          solution: `actor FavoritesStore {
    private var ids: Set<String> = []

    func toggle(_ id: String) {
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
    }

    func contains(_ id: String) -> Bool {
        ids.contains(id)
    }
}`,
          hint: "Adentro del actor el acceso es sincrónico; los que llamen desde afuera van a usar `await store.toggle(id)`.",
        },
      ],
    },
    {
      id: "strict-concurrency",
      title: "Swift 6: Sendable, aislamiento y Combine",
      goal: "Entender los errores de concurrencia estricta de Swift 6, las herramientas de migración, lo que cambia en Swift 6.2 y el Combine que vas a seguir encontrando.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Sendable: qué puede cruzar entre aislamientos",
          body: [
            "En el modo de lenguaje Swift 6 los data races posibles son **errores de compilación**. En modo Swift 5 podés activar `SWIFT_STRICT_CONCURRENCY = complete` para verlos como warnings y migrar de a poco.",
            "`Sendable` marca los tipos que se pueden pasar con seguridad de un actor o tarea a otro. Los structs y enums con miembros `Sendable` lo son (implícito si no son `public`); los actors siempre; una `final class` solo si todas sus propiedades son `let` de tipos `Sendable`.",
            "`@unchecked Sendable` le dice al compilador \"confiá en mí\": lo usás cuando vos sincronizás (un lock), y es una deuda que tiene que estar justificada en el PR.",
          ],
          code: `struct User: Sendable {          // implícito si es interno; explícito si es public
    let id: UUID
    var name: String
}

final class Config: Sendable {   // final + solo let de tipos Sendable
    let baseURL: URL
    init(baseURL: URL) { self.baseURL = baseURL }
}

final class DataCache: @unchecked Sendable {   // la sincronización corre por tu cuenta
    private let lock = NSLock()
    private var storage: [String: Data] = [:]
    func get(_ key: String) -> Data? { lock.withLock { storage[key] } }
}`,
        },
        {
          kind: "predict",
          prompt: "En modo Swift 6, ¿qué pasa con este código?",
          code: `final class Counter: Sendable {
    var count = 0
}`,
          options: [
            "Compila: `final` alcanza para ser `Sendable`",
            "Compila con un warning",
            "Compila, pero crashea al usarlo desde dos tareas",
            "Error: una clase `Sendable` no puede tener propiedades almacenadas mutables (`var`)",
          ],
          answer: 3,
          explanation: "Para que una clase sea `Sendable` el compilador exige `final` y que todo el estado almacenado sea inmutable y `Sendable`. Un `var` permitiría escrituras concurrentes, así que es error. Opciones: pasarla a `actor`, hacerla `struct`, o `@unchecked Sendable` con un lock.",
        },
        {
          kind: "explain",
          title: "Closures @Sendable y nonisolated",
          body: [
            "Los closures que pasan a otra tarea (`Task { }`, `group.addTask`, `Task.detached`) son `@Sendable` o `sending`: no pueden capturar un `var` local y mutarlo desde varias tareas. Devolvé valores y acumulá en la tarea padre.",
            "`nonisolated` marca miembros de un actor o de un tipo `@MainActor` que no tocan estado aislado: se llaman sin `await` desde cualquier lado. Típico para un `let` derivado o para cumplir un protocolo sincrónico como `CustomStringConvertible`.",
          ],
          code: `var total = 0
let numbers = [1, 2, 3]
await withTaskGroup(of: Int.self) { group in
    for n in numbers {
        group.addTask { n * 2 }              // ✅ captura un let
        // group.addTask { total += n }      // ❌ muta un var capturado: error en Swift 6
    }
    for await value in group { total += value }   // ✅ acumula la tarea padre
}
print(total)

actor Session {
    let id = UUID()
    private var requests = 0
    nonisolated var debugName: String { "session-\\(id)" }   // sin await desde afuera
}`,
          output: "12",
        },
        {
          kind: "fill",
          prompt: "`description` es un requisito sincrónico y no aislado de `CustomStringConvertible`. Completá para que la implementación se pueda llamar desde cualquier contexto.",
          code: `@MainActor
final class PlayerModel: CustomStringConvertible {
    let id: Int
    var isPlaying = false
    init(id: Int) { self.id = id }

    ____ var description: String { "Player \\(id)" }
}`,
          accept: ["^nonisolated$"],
          explanation: "`nonisolated` saca a `description` del main actor. Compila porque solo lee `id`, un `let` de tipo `Sendable`; si leyera `isPlaying` (un `var` aislado) sería error.",
          placeholder: "modificador",
        },
        {
          kind: "explain",
          title: "Migrar: @preconcurrency, sending y Swift 6.2",
          body: [
            "`@preconcurrency import` baja el ruido de un módulo que todavía no tiene anotaciones de `Sendable` (un SDK en Objective-C): sus diagnósticos dejan de bloquear mientras migrás tu código. `sending` en un parámetro o resultado indica que el valor se **transfiere** a otro aislamiento y el llamador no lo vuelve a usar, lo que permite pasar tipos no `Sendable` de forma segura.",
            "Swift 6.2 (Xcode 26) trae **approachable concurrency**: podés poner el aislamiento por defecto del módulo en `MainActor` (los proyectos de app nuevos vienen así), y las funciones `async` no aisladas corren en el actor de quien las llama. Para mandar trabajo pesado afuera, lo marcás explícitamente con `@concurrent`.",
            "Para los races que el compilador no ve (código GCD, `@unchecked Sendable`), activá **Thread Sanitizer** en el scheme (Run › Diagnostics) y corré los tests con él en CI.",
          ],
          code: `@preconcurrency import LegacyAnalyticsSDK

// Package.swift (tools 6.2): aislamiento por defecto del target
.target(
    name: "Feature",
    swiftSettings: [.defaultIsolation(MainActor.self)]
)

// Con approachable concurrency:
struct ImageProcessor {
    @concurrent
    func resize(_ data: Data) async -> Data {
        // corre fuera del main actor aunque lo llames desde la UI
        downscale(data)
    }
}

func makeRequest() -> sending URLRequest { URLRequest(url: endpoint) }`,
        },
        {
          kind: "predict",
          prompt: "Pasaste el target a Swift 6 y el SDK de analytics (Objective-C, sin anotaciones de concurrencia) genera decenas de errores de `Sendable` en tus llamadas. ¿Cuál es el primer paso más razonable?",
          code: `import LegacyAnalyticsSDK

func track(_ event: AnalyticsEvent) {
    Task.detached {
        Analytics.shared.log(event)   // error: AnalyticsEvent no es Sendable
    }
}`,
          options: [
            "Agregar `@unchecked Sendable` a todos tus tipos",
            "Importar el SDK con `@preconcurrency import` y seguir migrando tu propio código",
            "Volver todo el target a GCD",
            "Marcar todo como `nonisolated(unsafe)`",
          ],
          answer: 1,
          explanation: "`@preconcurrency import` existe justamente para dependencias que todavía no adoptaron concurrencia: relaja sus diagnósticos sin esconder los de tu código. `@unchecked Sendable` y `nonisolated(unsafe)` apagan chequeos sin arreglar nada, y volver a GCD no saca los races.",
        },
        {
          kind: "explain",
          title: "Combine en codebases existentes",
          body: [
            "Combine (iOS 13+) sigue en muchas apps: publishers que emiten valores en el tiempo y suscriptores que los reciben. Con `ObservableObject`, cada `@Published` expone un publisher con `$propiedad`. `@Observable` no genera publishers.",
            "`sink` devuelve un `AnyCancellable`. Si no lo guardás, la suscripción se cancela al liberarse. Por eso todo termina en `.store(in: &cancellables)`, y el closure usa `[weak self]` porque `self` es dueño de `cancellables`.",
            "`debounce` espera una pausa antes de emitir (búsqueda mientras se escribe) y `removeDuplicates` evita repetir la misma consulta. En código nuevo, `.task(id:)` con `Task.sleep` cubre el mismo caso.",
          ],
          code: `import Combine

final class SearchViewModel: ObservableObject {
    @Published var query = ""
    @Published private(set) var results: [String] = []
    private var cancellables = Set<AnyCancellable>()

    init() {
        $query
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] text in
                self?.search(text)
            }
            .store(in: &cancellables)
    }

    private func search(_ text: String) { /* ... */ }
}`,
        },
        {
          kind: "predict",
          prompt: "Después de `init`, el usuario escribe en el buscador. ¿Qué se imprime por esos cambios?",
          code: `final class SearchViewModel: ObservableObject {
    @Published var query = ""

    init() {
        _ = $query.sink { print("query:", $0) }
    }
}`,
          options: [
            "Nada: el `AnyCancellable` que devuelve `sink` se descarta y la suscripción se cancela enseguida",
            "Una línea por cada cambio de `query`",
            "Crash: `sink` exige llamar a `store(in:)`",
            "Solo el último valor, al cerrar la pantalla",
          ],
          answer: 0,
          explanation: "`@Published` emite el valor actual al suscribirse, así que durante `init` aparece `query: ` una vez. Pero `_ =` descarta el `AnyCancellable`, que cancela la suscripción al liberarse: los cambios posteriores no llegan. Guardalo con `.store(in: &cancellables)`.",
        },
        {
          kind: "fill",
          prompt: "Completá el operador que espera 300 ms sin cambios antes de emitir la búsqueda.",
          code: `$query
    .____(for: .milliseconds(300), scheduler: RunLoop.main)
    .removeDuplicates()
    .sink { [weak self] in self?.search($0) }
    .store(in: &cancellables)`,
          accept: ["^debounce$"],
          explanation: "`debounce` reinicia el temporizador con cada valor y emite solo cuando pasaron 300 ms sin cambios. `throttle`, en cambio, emite como mucho un valor por intervalo aunque el usuario siga escribiendo.",
          placeholder: "operador",
        },
        {
          kind: "write",
          prompt: "Pasá la búsqueda a SwiftUI moderno sin Combine: en `SearchView`, usá `.task(id: query)` con un `Task.sleep` de 300 ms como debounce y después `await model.search(query)`.",
          starter: `struct SearchView: View {
    @State private var query = ""
    @State private var model = SearchModel()

    var body: some View {
        List(model.results, id: \\.self) { Text($0) }
            .searchable(text: $query)
    }
}`,
          checks: [
            { pattern: "\\.task\\(id:\\s*query\\)", label: "Usa `.task(id: query)`" },
            { pattern: "Task\\.sleep\\(", label: "Espera con `Task.sleep` como debounce" },
            { pattern: "await\\s+model\\.search\\(query\\)", label: "Llama a `await model.search(query)`" },
          ],
          warnings: [
            { pattern: "asyncAfter", label: "`asyncAfter` no se cancela cuando cambia el texto" },
            { pattern: "Task\\.detached", label: "`Task.detached` pierde la cancelación automática de `.task`" },
          ],
          solution: `struct SearchView: View {
    @State private var query = ""
    @State private var model = SearchModel()

    var body: some View {
        List(model.results, id: \\.self) { Text($0) }
            .searchable(text: $query)
            .task(id: query) {
                do {
                    try await Task.sleep(for: .milliseconds(300))
                } catch {
                    return    // cancelada: el usuario siguió escribiendo
                }
                await model.search(query)
            }
    }
}`,
          hint: "Cada cambio de `query` cancela la tarea anterior; si el sleep lanza, salí sin buscar.",
        },
      ],
    },
    {
      id: "final-challenge",
      title: "Reto final: caché y refresh de token",
      goal: "Diagnosticar un data race en producción y diseñar un refresh de token con un actor que agrupe las llamadas concurrentes.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Estás de guardia en una app de delivery. Crashlytics muestra `EXC_BAD_ACCESS` intermitente dentro de `Dictionary` en `ImageCache`, que usan muchas celdas descargando imágenes en paralelo. Con Thread Sanitizer, QA lo reproduce: \"Data race in ImageCache.insert\".",
            "Al mismo tiempo, soporte reporta usuarios deslogueados: cuando vence el token, la home dispara 6 requests a la vez, cada una ve el token vencido y llama a `authAPI.refresh()`. El backend rota el refresh token y 5 de las 6 fallan.",
            "Tu tarea: explicar la causa, migrar la caché a un modelo seguro y escribir un `AuthClient` que haga un solo refresh por más que lo llamen 6 tareas a la vez.",
          ],
          code: `final class ImageCache {
    static let shared = ImageCache()
    private var images: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? { images[url] }
    func insert(_ image: UIImage, for url: URL) { images[url] = image }
}

final class AuthClient {
    private var token: Token?

    func validToken() async throws -> Token {
        if let token, !token.isExpired { return token }
        let newToken = try await authAPI.refresh()   // 6 llamadas = 6 refresh
        token = newToken
        return newToken
    }
}`,
        },
        {
          kind: "predict",
          prompt: "¿Cuál es la causa raíz del crash en `ImageCache`?",
          code: `// Desde muchas tareas a la vez:
ImageCache.shared.insert(image, for: url)
let cached = ImageCache.shared.image(for: otherURL)`,
          options: [
            "`static let shared` crea una instancia nueva en cada acceso",
            "`UIImage` no se puede guardar en un diccionario",
            "`Dictionary` no es thread-safe: lecturas y escrituras concurrentes sin sincronización son un data race",
            "Falta `@objc` en los métodos",
          ],
          answer: 2,
          explanation: "`static let` se inicializa una sola vez de forma segura; el problema es lo que pasa después. Varias tareas mutan y leen el mismo `Dictionary` sin sincronización: un `insert` puede reasignar el buffer mientras otro hilo lee. Es un data race, comportamiento indefinido, y por eso el crash es intermitente.",
        },
        {
          kind: "write",
          prompt: "Reescribí `ImageCache` como `actor` (manteniendo `shared`, `image(for:)` e `insert(_:for:)`) y agregá `func cachedImage(url: URL) async -> UIImage?` que la consulte desde afuera.",
          starter: `final class ImageCache {
    static let shared = ImageCache()
    private var images: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? { images[url] }
    func insert(_ image: UIImage, for url: URL) { images[url] = image }
}`,
          checks: [
            { pattern: "^\\s*actor\\s+ImageCache", label: "`ImageCache` es un `actor`" },
            { pattern: "func\\s+image\\(for", label: "Mantiene `image(for:)`" },
            { pattern: "func\\s+insert\\(", label: "Mantiene `insert(_:for:)`" },
            { pattern: "await\\s+ImageCache\\.shared\\.image\\(for:", label: "Desde afuera se llama con `await`" },
          ],
          warnings: [
            { pattern: "static\\s+var\\s+shared", label: "`static var` es estado global mutable: error en Swift 6" },
            { pattern: "DispatchQueue|NSLock", label: "El actor ya serializa: no hace falta sincronización manual" },
          ],
          solution: `actor ImageCache {
    static let shared = ImageCache()
    private var images: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? { images[url] }
    func insert(_ image: UIImage, for url: URL) { images[url] = image }
}

func cachedImage(url: URL) async -> UIImage? {
    await ImageCache.shared.image(for: url)
}`,
          hint: "Solo cambia la palabra clave del tipo; los llamadores pasan a usar `await`.",
        },
        {
          kind: "write",
          prompt: "Reescribí `AuthClient` como `actor` que agrupe los refresh: si ya hay uno en curso, las demás llamadas esperan esa misma `Task` en vez de llamar otra vez a `authAPI.refresh()`. Limpiá la tarea al terminar.",
          starter: `final class AuthClient {
    private var token: Token?

    func validToken() async throws -> Token {
        if let token, !token.isExpired { return token }
        let newToken = try await authAPI.refresh()
        token = newToken
        return newToken
    }
}`,
          checks: [
            { pattern: "^\\s*actor\\s+AuthClient", label: "`AuthClient` es un `actor`" },
            { pattern: "Task<Token,\\s*(any\\s+)?Error>", label: "Guarda la tarea de refresh en curso (`Task<Token, Error>?`)" },
            { pattern: "\\.value", label: "Las llamadas que llegan después esperan `task.value`" },
            { pattern: "authAPI\\.refresh\\(\\)", label: "Llama a `authAPI.refresh()` dentro de la tarea" },
            { pattern: "=\\s*nil", label: "Limpia la tarea al terminar" },
          ],
          warnings: [
            { pattern: "^\\s*(final\\s+)?class\\s+AuthClient", label: "Con una clase sin aislamiento vuelve el data race" },
            { pattern: "DispatchSemaphore", label: "Un semáforo bloquea hilos del pool cooperativo" },
          ],
          solution: `actor AuthClient {
    private var token: Token?
    private var refreshTask: Task<Token, Error>?

    func validToken() async throws -> Token {
        if let token, !token.isExpired { return token }
        if let refreshTask { return try await refreshTask.value }

        let task = Task { try await authAPI.refresh() }
        refreshTask = task
        defer { refreshTask = nil }

        let newToken = try await task.value
        token = newToken
        return newToken
    }
}`,
          hint: "Asigná `refreshTask` antes del primer `await`: es lo que ven las llamadas que entran por reentrancy.",
        },
        {
          kind: "predict",
          prompt: "Con tu `AuthClient` actor y el token vencido, la home llama `validToken()` desde 6 tareas a la vez mientras el refresh tarda 1 segundo. ¿Cuántas veces se llama a `authAPI.refresh()`?",
          code: `await withTaskGroup(of: Void.self) { group in
    for _ in 1...6 {
        group.addTask { _ = try? await auth.validToken() }
    }
}`,
          options: [
            "6: cada tarea ve el token vencido",
            "1: la primera crea y guarda la tarea antes de suspenderse, y las otras 5 esperan su `value`",
            "0: el actor devuelve el token vencido",
            "Entre 1 y 6, depende de la reentrancy",
          ],
          answer: 1,
          explanation: "Entre el chequeo `if let refreshTask` y la asignación `refreshTask = task` no hay ningún `await`, así que nadie puede entrar en el medio. La primera llamada deja la tarea guardada y se suspende; las otras cinco entran por reentrancy, la encuentran y esperan `refreshTask.value`. Cuando termina, `token` ya está seteado antes de que el `defer` limpie la tarea.",
        },
      ],
    },
  ],
  flashcards: [
    {
      id: "fc-main-thread",
      front: "¿Desde qué hilo se actualiza la UI y cómo volvés a él desde un callback?",
      back: "Siempre desde el main thread. Con callbacks: `DispatchQueue.main.async { }`. Con async/await: código `@MainActor` o `await MainActor.run { }`. En Debug, el Main Thread Checker avisa si te equivocás.",
      code: "DispatchQueue.main.async {\n    self.tableView.reloadData()\n}",
    },
    {
      id: "fc-sync-deadlock",
      front: "¿Qué pasa con `DispatchQueue.main.sync { }` llamado desde el main thread?",
      back: "Deadlock: main se bloquea esperando un bloque que solo puede correr en main. GCD suele detectarlo y crashear. Lo mismo con `queue.sync` dentro de un bloque que ya corre en esa cola serial.",
    },
    {
      id: "fc-serial-concurrent",
      front: "Cola serial vs concurrente",
      back: "Serial: un bloque por vez, en orden FIFO. Concurrente (`attributes: .concurrent`, `global()`): varios a la vez, sin orden garantizado entre ellos. `async` vuelve enseguida; `sync` bloquea hasta que el bloque termina.",
    },
    {
      id: "fc-dispatch-group",
      front: "Reglas de `DispatchGroup`",
      back: "Un `enter()` por tarea y exactamente un `leave()` en todos los caminos (éxito y error). `notify(queue:)` corre cuando el contador llega a cero. Un `leave()` de más crashea; uno de menos deja `notify` esperando para siempre.",
      code: "group.enter()\napi.fetch { _ in\n    defer { group.leave() }\n    // ...\n}\ngroup.notify(queue: .main) { done() }",
    },
    {
      id: "fc-operation-queue",
      front: "¿Cuándo aparece `OperationQueue` en vez de GCD puro?",
      back: "Cuando hacen falta dependencias (`addDependency`), un límite de concurrencia (`maxConcurrentOperationCount`) o cancelar en bloque (`cancelAllOperations()`). `cancel()` solo marca `isCancelled`: la operación tiene que chequearlo.",
    },
    {
      id: "fc-async-let-group",
      front: "`async let` vs `TaskGroup`",
      back: "`async let`: cantidad fija de tareas conocida al escribir el código, con tipos distintos. `withTaskGroup`: cantidad dinámica (N elementos), resultados en orden de finalización. Las dos son concurrencia estructurada: las hijas se cancelan si el scope sale con error.",
    },
    {
      id: "fc-task-detached",
      front: "`Task { }` vs `Task.detached { }` vs `.task { }`",
      back: "`Task { }` hereda el actor y la prioridad del contexto (desde `@MainActor` corre en main). `Task.detached` no hereda nada; casi nunca hace falta. `.task { }` en SwiftUI se cancela sola cuando la vista desaparece.",
    },
    {
      id: "fc-cancellation",
      front: "¿Cómo funciona la cancelación de tareas en Swift?",
      back: "Es cooperativa: `cancel()` solo prende una marca. El código chequea con `try Task.checkCancellation()` (lanza `CancellationError`) o `Task.isCancelled`. `Task.sleep` y `URLSession` ya cooperan; un loop de CPU no.",
    },
    {
      id: "fc-continuation",
      front: "Regla de oro de `withCheckedThrowingContinuation`",
      back: "Reanudar exactamente una vez en todos los caminos. Dos veces: crash (`SWIFT TASK CONTINUATION MISUSE`). Nunca: la tarea queda suspendida para siempre. En delegates, guardá la continuation y ponela en `nil` después de reanudar.",
      code: "try await withCheckedThrowingContinuation { continuation in\n    legacy.fetch { result in\n        continuation.resume(with: result)\n    }\n}",
    },
    {
      id: "fc-async-stream",
      front: "¿Para qué sirve `AsyncStream` y qué no te podés olvidar?",
      back: "Para exponer una serie de valores (websocket, progreso, delegate repetido) como secuencia que se consume con `for await`. Llamá a `finish()` para terminarla y usá `onTermination` para liberar recursos cuando el consumidor cancela.",
    },
    {
      id: "fc-actor",
      front: "¿Qué garantiza un `actor`?",
      back: "Que su estado mutable se accede de a una tarea por vez: no hay data races sobre ese estado. Desde afuera se llama con `await`. No garantiza ausencia de bugs lógicos: es reentrante.",
    },
    {
      id: "fc-reentrancy",
      front: "¿Qué es la reentrancy de un actor?",
      back: "Mientras un método está suspendido en un `await`, el actor atiende otras llamadas. Lo que chequeaste antes del `await` puede haber cambiado. Mutá antes de suspender o volvé a chequear después.",
    },
    {
      id: "fc-sendable",
      front: "¿Qué tipos son `Sendable`?",
      back: "Structs y enums cuyos miembros son `Sendable` (implícito si no son `public`), actors, y `final class` con solo `let` de tipos `Sendable`. `@unchecked Sendable` = sincronizás vos (lock) y el compilador confía.",
    },
    {
      id: "fc-swift62",
      front: "¿Qué cambia con approachable concurrency en Swift 6.2?",
      back: "Podés poner el aislamiento por defecto del módulo en `MainActor` (proyectos nuevos de Xcode 26), las funciones `async` no aisladas corren en el actor de quien llama, y `@concurrent` marca explícitamente lo que tiene que ir al pool global.",
    },
    {
      id: "fc-combine-cancellable",
      front: "¿Por qué una suscripción de Combine deja de recibir valores enseguida?",
      back: "Porque no guardaste el `AnyCancellable` que devuelve `sink`: al liberarse, cancela la suscripción. Guardalo con `.store(in: &cancellables)` y usá `[weak self]` en el closure.",
      code: "$query\n    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)\n    .sink { [weak self] in self?.search($0) }\n    .store(in: &cancellables)",
    },
  ],
  exam: [
    {
      id: "ex-main-checker",
      question: "En QA aparece `Main Thread Checker: UI API called on a background thread` apuntando a `tableView.reloadData()`, que se llama dentro del completion de un `URLSession.dataTask`. ¿Cuál es el fix correcto?",
      options: [
        "Envolver la llamada en `DispatchQueue.global().async`",
        "Envolver la llamada en `DispatchQueue.main.async`",
        "Envolver la llamada en `DispatchQueue.main.sync` desde el completion y también desde `viewDidLoad`",
        "Desactivar el Main Thread Checker en el scheme",
      ],
      answer: 1,
      explanation: "El completion de `URLSession` llega en una cola de fondo y la UI solo se toca en main. `DispatchQueue.main.async` encola la recarga en main sin bloquear. `main.sync` desde main es deadlock, y apagar el checker esconde el bug.",
    },
    {
      id: "ex-parallel-requests",
      question: "Una pantalla nueva (iOS 17) necesita tres endpoints independientes y se muestra cuando llegan los tres. Hoy tarda la suma de los tres tiempos. ¿Qué cambio aplicás?",
      code: "let profile = try await api.profile()\nlet stats = try await api.stats()\nlet badges = try await api.badges()",
      options: [
        "Un `DispatchSemaphore` para esperar los tres en main",
        "Un `Task.detached` por request y variables globales para los resultados",
        "Agregar `@MainActor` a `api`",
        "Declarar los tres con `async let` y esperarlos juntos con `try await`",
      ],
      answer: 3,
      explanation: "`async let` arranca las tres requests en paralelo y el `try await` posterior espera los resultados: el tiempo total pasa a ser el de la más lenta. Además es estructurado: si una falla, las otras se cancelan. Un semáforo en main congela la UI.",
    },
    {
      id: "ex-reentrancy",
      question: "En un actor `Inventory`, `reserve(_:)` chequea `stock > 0`, hace `await api.lock(item)` y recién después decrementa `stock`. QA ve stock negativo con dos taps rápidos. ¿Cuál es la causa?",
      options: [
        "Reentrancy: durante el `await` entró otra llamada que pasó el mismo chequeo",
        "Los actors no protegen su estado contra accesos concurrentes",
        "Falta marcar el actor con `@MainActor`",
        "Un bug del compilador con `async` dentro de actors",
      ],
      answer: 0,
      explanation: "El actor serializa el acceso, pero libera el turno en cada `await`. Las dos llamadas ven `stock > 0` antes de que alguna descuente. Fix: decrementar antes del `await` (y revertir si falla) o volver a chequear después.",
    },
    {
      id: "ex-continuation-leak",
      question: "Envolviste un SDK con `withCheckedThrowingContinuation`, pero en un caso de error el SDK nunca llama al callback. ¿Qué síntoma vas a ver?",
      options: [
        "Un crash inmediato al salir del closure",
        "La tarea lanza `CancellationError` a los 60 segundos",
        "La tarea queda suspendida para siempre (spinner infinito) y el runtime avisa en consola que la continuation se perdió",
        "La función devuelve `nil`",
      ],
      answer: 2,
      explanation: "Una continuation que nunca se reanuda deja la tarea suspendida indefinidamente. La versión checked detecta que se liberó sin reanudarse y lo loguea. Crashear es lo que pasa al reanudar dos veces. La solución es cubrir con un `resume` todos los caminos, incluido un timeout si el SDK puede no responder.",
    },
    {
      id: "ex-task-modifier",
      question: "Una vista carga datos con `onAppear { Task { await model.load() } }`. Si el usuario entra y sale rápido varias veces, las requests se acumulan y la última en llegar pisa el estado. ¿Cuál es el mejor cambio?",
      options: [
        "Usar `Task.detached` en vez de `Task`",
        "Agregar un `DispatchQueue.main.asyncAfter` de un segundo",
        "Cambiar a `.task { await model.load() }`, que se cancela cuando la vista desaparece",
        "Llamar a `model.load()` desde el `init` de la vista",
      ],
      answer: 2,
      explanation: "`.task` ata la tarea al ciclo de vida de la vista y la cancela al desaparecer; con `URLSession` async la cancelación corta la request. `Task.detached` empeora todo (sin herencia ni cancelación), y el `init` de una vista SwiftUI corre muchas veces.",
    },
    {
      id: "ex-sendable-fix",
      question: "En Swift 6, pasar `AppSettings` (una `final class` con varias propiedades `var`, que en la práctica nunca cambian después de crearse) a `Task.detached` da error de `Sendable`. ¿Cuál es el mejor arreglo?",
      options: [
        "Convertirla en `struct` (o dejar solo `let`), con lo que pasa a ser `Sendable`",
        "Marcarla `@unchecked Sendable` sin más cambios",
        "Declarar la variable como `nonisolated(unsafe)`",
        "Volver el target a modo Swift 5",
      ],
      answer: 0,
      explanation: "Si los datos son de solo lectura, modelarlos como valor inmutable los hace `Sendable` de verdad y el compilador lo verifica. `@unchecked` y `nonisolated(unsafe)` apagan el chequeo sin garantizar nada, y volver a Swift 5 solo esconde el problema.",
    },
    {
      id: "ex-token-refresh",
      question: "Cuando vence el token, 6 requests en paralelo reciben 401 y cada una dispara su propio refresh; el backend rota el refresh token y 5 fallan. ¿Qué diseño lo resuelve?",
      options: [
        "Envolver el refresh en `DispatchQueue.main.sync`",
        "Reintentar cada request 6 veces con un delay aleatorio",
        "Un `DispatchSemaphore(value: 1)` en el main thread",
        "Un `actor` que guarda la `Task` del refresh en curso; las demás llamadas esperan su `value`",
      ],
      answer: 3,
      explanation: "El actor serializa el chequeo y, como la tarea se guarda antes del primer `await`, las llamadas que entran por reentrancy la encuentran y esperan el mismo resultado: un solo refresh. Los reintentos solo multiplican el problema y los semáforos bloquean hilos.",
    },
    {
      id: "ex-operation-queue",
      question: "En un módulo legacy sin async/await descargás 200 imágenes. Querés como máximo 4 a la vez y poder cancelar todas cuando el usuario sale de la pantalla. ¿Qué es lo más directo?",
      options: [
        "`DispatchQueue.main.async` por cada imagen",
        "Una `OperationQueue` con `maxConcurrentOperationCount = 4` y `cancelAllOperations()` al salir",
        "Crear un `Thread` por imagen",
        "Un `DispatchGroup` con `wait()` en main",
      ],
      answer: 1,
      explanation: "`OperationQueue` resuelve las dos cosas: límite de concurrencia y cancelación en bloque (cada operación en curso chequea `isCancelled`). Main no es para descargas, 200 threads es un desperdicio, y `wait()` en main congela la UI.",
    },
    {
      id: "ex-combine-store",
      question: "Un `ObservableObject` configura `$query.debounce(...).sink { ... }` en su `init`, pero el closure nunca recibe lo que el usuario escribe. ¿Qué es lo más probable?",
      options: [
        "`debounce` necesita `DispatchQueue.main` y no `RunLoop.main`",
        "`@Published` no funciona dentro de clases",
        "El `AnyCancellable` de `sink` no se guarda y la suscripción se cancela enseguida",
        "Hay que llamar a `objectWillChange.send()` a mano",
      ],
      answer: 2,
      explanation: "`sink` devuelve un `AnyCancellable` que cancela la suscripción cuando se libera. Si no se guarda con `.store(in: &cancellables)`, muere al terminar `init`. `RunLoop.main` es un scheduler válido para `debounce`.",
    },
    {
      id: "ex-default-isolation",
      question: "Proyecto nuevo en Xcode 26 con aislamiento por defecto `MainActor` y approachable concurrency. Una función `async` que decodifica un JSON de 20 MB congela la UI. ¿Qué hacés?",
      options: [
        "Marcar la función con `@concurrent` para que corra fuera del main actor",
        "Envolver la llamada en `Task { }` dentro de la vista",
        "Agregarle `@MainActor` explícito",
        "Envolver el decode en `DispatchQueue.main.async`",
      ],
      answer: 0,
      explanation: "Con aislamiento por defecto `MainActor`, el código corre en main salvo que digas lo contrario. `@concurrent` indica que la función async se ejecuta en el pool global. Un `Task { }` creado desde la vista hereda el main actor, así que el trabajo sigue en main.",
    },
    {
      id: "ex-serial-deadlock",
      question: "En un servicio legacy, un método que ya corre dentro de `queue.async { }` (una cola serial propia) llama a un helper que hace `queue.sync { }`. ¿Qué pasa?",
      options: [
        "Nada raro: `sync` corre el bloque inline en el mismo hilo",
        "El bloque se ejecuta al final de la cola sin problemas",
        "Se convierte automáticamente en `async`",
        "Deadlock: la cola espera un bloque que solo puede correr cuando ella misma termine",
      ],
      answer: 3,
      explanation: "Una cola serial ejecuta un bloque por vez. El bloque actual queda bloqueado en `sync` esperando al nuevo, que no puede empezar hasta que termine el actual. GCD suele detectarlo y crashear. Fix: no reentrar con `sync` en tu propia cola (o migrar ese estado a un actor).",
    },
    {
      id: "ex-cancel-loop",
      question: "Un `Task` procesa 10.000 fotos con un filtro de CPU. Al salir de la pantalla llamás a `task.cancel()`, pero el uso de CPU sigue alto un buen rato. ¿Por qué y cómo lo arreglás?",
      options: [
        "Porque `cancel()` necesita `await`: hay que escribir `await task.cancel()`",
        "Porque la cancelación es cooperativa: agregá `try Task.checkCancellation()` (o `Task.isCancelled`) en cada iteración",
        "Porque un `Task` no se puede cancelar: hay que usar `Task.detached`",
        "Porque falta `@MainActor` en el loop",
      ],
      answer: 1,
      explanation: "`cancel()` solo marca la tarea. Un loop de CPU que nunca chequea la marca corre hasta el final. Con `try Task.checkCancellation()` por iteración corta enseguida con `CancellationError`.",
    },
  ],
};

export default content;
