import type { CourseContent } from "../types";

// El código Swift va con String.raw para no perder las barras de `\(...)` ni de `\.keyPath`.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    {
      id: "unidirectional-flow",
      title: "Flujo unidireccional desde cero",
      goal: "Armar a mano un `Store` con estado, acciones y reducer para entender qué resuelve TCA, por qué es tan testeable y cuánto cuesta.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Estado, acción y reducer",
          body: [
            "La idea de fondo de TCA (The Composable Architecture) es vieja y simple: todo el estado de una pantalla vive en **un solo valor** (`State`), lo único que puede pasar son **acciones** (`Action`, un `enum`) y una sola función, el **reducer**, decide cómo cambia el estado ante cada acción.",
            "El reducer recibe el estado como `inout` y la acción. No lee la red, no lee el reloj, no toca la UI: solo muta el estado. Por eso, con el mismo estado y la misma acción, el resultado es siempre el mismo.",
            "Antes de importar ninguna librería, armalo con Swift puro. Es todo lo que TCA hace en el corazón.",
          ],
          code: swift`struct CounterState: Equatable {
    var count = 0
}

enum CounterAction {
    case increment
    case decrement
    case reset
}

func reduce(_ state: inout CounterState, _ action: CounterAction) {
    switch action {
    case .increment: state.count += 1
    case .decrement: state.count -= 1
    case .reset: state.count = 0
    }
}

var state = CounterState()
reduce(&state, .increment)
reduce(&state, .increment)
reduce(&state, .decrement)
print(state.count)
print(state)`,
          output: "1\nCounterState(count: 1)",
        },
        {
          kind: "predict",
          code: swift`var state = CounterState(count: 3)
let actions: [CounterAction] = [.increment, .increment, .reset, .decrement]
for action in actions {
    reduce(&state, action)
}
print(state.count)`,
          options: ["0", "-1", "1", "4"],
          answer: 1,
          explanation: "Se aplican en orden: 3 → 4 → 5, después `.reset` lo deja en 0 y `.decrement` en -1. El estado final depende solo del estado inicial y de la secuencia de acciones: por eso podés reproducir un bug con la lista exacta de acciones que lo causó.",
        },
        {
          kind: "explain",
          title: "Un `Store` de 20 líneas",
          body: [
            "El `Store` es el dueño del estado. La vista solo puede hacer dos cosas: **leer** `store.state` y **mandar** acciones con `store.send(_:)`. Nadie más muta el estado: por eso es `private(set)`.",
            "Con `@Observable` (iOS 17; antes era `ObservableObject` + `@Published`) SwiftUI se redibuja cuando cambia lo que la vista leyó. Y como todo pasa por `send`, tenés un único punto para loguear cada acción: debuggear es leer el log.",
          ],
          code: swift`import Observation

@MainActor
@Observable
final class Store<State, Action> {
    private(set) var state: State
    private let reducer: (inout State, Action) -> Void

    init(initialState: State, reducer: @escaping (inout State, Action) -> Void) {
        self.state = initialState
        self.reducer = reducer
    }

    func send(_ action: Action) {
        print("action:", action)
        reducer(&state, action)
    }
}

let store = Store(initialState: CounterState(), reducer: reduce)
store.send(.increment)
store.send(.increment)
print(store.state.count)`,
          output: "action: increment\naction: increment\n2",
        },
        {
          kind: "fill",
          prompt: "Completá el modificador para que la vista pueda leer `state` pero solo el `Store` lo pueda mutar.",
          code: swift`final class Store<State, Action> {
    ____ var state: State
    // ...
}`,
          accept: ["^private\\(set\\)$", "^fileprivate\\(set\\)$"],
          explanation: "`private(set)` deja el getter con el acceso del tipo y el setter privado. Es la garantía central del flujo unidireccional: la única forma de cambiar el estado es `send(_:)` → reducer.",
          hint: "Es el modificador de acceso que aplica solo al setter.",
          placeholder: "modificador",
        },
        {
          kind: "explain",
          title: "Qué ganás y qué pagás",
          body: [
            "**Ganás**: estado predecible (una sola fuente de verdad), reducers que se testean llamando una función pura, un log de todo lo que pasó y features que se componen como piezas, porque un reducer grande es la suma de reducers chicos.",
            "**Pagás**: más ceremonia (cada interacción es un `case`), curva de aprendizaje para el equipo, una dependencia externa importante (TCA es de Point-Free) y overhead si mandás acciones a alta frecuencia, como en cada frame de un scroll.",
            "Falta una pieza: los efectos (red, timers, disco). Si el reducer es puro, ¿dónde van? TCA responde con `Effect`: el reducer **devuelve una descripción** del trabajo asíncrono y el `Store` lo ejecuta. Es lo que vas a ver en las próximas lecciones.",
          ],
          code: swift`// Probar un reducer puro: sin mocks, sin esperas
var state = CounterState(count: 5)
reduce(&state, .reset)
assert(state == CounterState(count: 0))
print("ok")`,
          output: "ok",
        },
        {
          kind: "predict",
          prompt: "Un compañero quiere cargar datos desde el reducer casero. ¿Cuál es el problema de este diseño?",
          code: swift`func reduce(_ state: inout FeedState, _ action: FeedAction) {
    switch action {
    case .onAppear:
        Task {
            let posts = try await api.fetchPosts()
            // ¿y ahora cómo actualizo state?
        }
    }
}`,
          options: [
            "Ninguno: `Task` es la forma correcta de hacer async dentro de un reducer",
            "Solo que falta `@MainActor` en la función",
            "El reducer deja de ser puro y el `Task` no puede mutar `state` (es `inout`): el resultado tendría que volver como otra acción",
            "Que `api.fetchPosts()` debería ser síncrono",
          ],
          answer: 2,
          explanation: "Un parámetro `inout` no puede capturarse en una closure que escapa como la del `Task`, así que ni siquiera podés escribir el resultado. Además el reducer ahora dispara trabajo no controlado e imposible de testear. La salida es que el reducer devuelva un efecto y que el resultado entre de nuevo como acción, por ejemplo `.postsLoaded(posts)`.",
        },
        {
          kind: "write",
          prompt: "Escribí `func reduce(_ state: inout TodoState, _ action: TodoAction)`. `draftChanged` guarda el texto en `draft`; `addTapped` agrega `draft` a `items` solo si no está vacío y después lo limpia; `clearTapped` vacía `items`.",
          starter: swift`struct TodoState: Equatable {
    var items: [String] = []
    var draft = ""
}

enum TodoAction {
    case draftChanged(String)
    case addTapped
    case clearTapped
}

// Escribí reduce(_:_:)
`,
          checks: [
            { pattern: "func\\s+reduce\\s*\\(\\s*_\\s+state\\s*:\\s*inout\\s+TodoState", label: "Recibe el estado como `inout`" },
            { pattern: "switch\\s+action", label: "Hace `switch` sobre la acción" },
            { pattern: "case\\s+(let\\s+)?\\.draftChanged", label: "Maneja `.draftChanged`" },
            { pattern: "isEmpty", label: "No agrega borradores vacíos" },
            { pattern: "append\\(\\s*state\\.draft\\s*\\)", label: "Agrega `state.draft` a `items`" },
            { pattern: "state\\.draft\\s*=\\s*\"\"", label: "Limpia el borrador después de agregar" },
          ],
          warnings: [
            { pattern: "URLSession|DispatchQueue|Task\\s*\\{", label: "Efectos dentro del reducer: tiene que ser puro" },
          ],
          solution: swift`func reduce(_ state: inout TodoState, _ action: TodoAction) {
    switch action {
    case let .draftChanged(text):
        state.draft = text
    case .addTapped:
        guard !state.draft.isEmpty else { return }
        state.items.append(state.draft)
        state.draft = ""
    case .clearTapped:
        state.items = []
    }
}`,
          hint: "Un `guard !state.draft.isEmpty else { return }` en `.addTapped` resuelve el caso vacío.",
        },
      ],
    },
    {
      id: "first-feature",
      title: "Primera feature con `@Reducer`",
      goal: "Escribir una feature de TCA 1.x con `@Reducer`, `@ObservableState`, `Reduce` y `Store`, conectarla a SwiftUI y manejar bindings con `BindableAction`.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Anatomía de una feature",
          body: [
            "En TCA una feature es un `struct` marcado con `@Reducer`. Adentro tiene `State` (con `@ObservableState` para que SwiftUI lo observe), `Action` (un `enum`) y `body`, donde declarás la lógica con `Reduce { state, action in ... }`.",
            "La diferencia con el reducer casero: la closure **devuelve un `Effect<Action>`**. Cuando no hay trabajo asíncrono devolvés `.none`. Con eso el reducer sigue siendo puro: describe el efecto, no lo ejecuta.",
            "Convención del equipo de Point-Free que conviene seguir: las acciones se nombran por **lo que pasó** en la UI (`incrementButtonTapped`), no por lo que querés que haga (`incrementCount`). La lógica queda en el reducer, no en la vista.",
          ],
          code: swift`import ComposableArchitecture

@Reducer
struct CounterFeature {
    @ObservableState
    struct State: Equatable {
        var count = 0
    }

    enum Action {
        case incrementButtonTapped
        case decrementButtonTapped
    }

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .incrementButtonTapped:
                state.count += 1
                return .none
            case .decrementButtonTapped:
                state.count -= 1
                return .none
            }
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Esta acción no dispara ningún trabajo asíncrono. Completá lo que devuelve.",
          code: swift`case .resetButtonTapped:
    state.count = 0
    return ____`,
          accept: ["^\\.none$"],
          explanation: "`Reduce` devuelve un `Effect<Action>`. `.none` es el efecto vacío: el store aplica la mutación y no ejecuta nada más.",
          hint: "Es el efecto que no hace nada.",
          placeholder: "efecto",
        },
        {
          kind: "predict",
          prompt: "En code review ves estas cuatro opciones para la acción del botón \"+\". ¿Cuál sigue la convención de TCA?",
          code: swift`Button("+") { store.send(/* ??? */) }`,
          options: [
            "`.setCount(store.count + 1)`",
            "`.incrementCount`",
            "`.updateState`",
            "`.incrementButtonTapped`",
          ],
          answer: 3,
          explanation: "Nombrar por el evento (`...ButtonTapped`, `onAppear`, `...Response`) deja la lógica en el reducer. `.setCount(store.count + 1)` calcula en la vista, `.incrementCount` es una orden y `.updateState` no dice nada. Leer el log de acciones con eventos reales es mucho más útil en un bug.",
        },
        {
          kind: "explain",
          title: "`Store` y la vista",
          body: [
            "La vista recibe un `StoreOf<CounterFeature>` (alias de `Store<CounterFeature.State, CounterFeature.Action>`). Gracias a `@ObservableState` lee el estado directo, `store.count`, y SwiftUI solo se redibuja si cambia algo que la vista leyó. Si venís de código anterior a TCA 1.7, esto reemplaza a `WithViewStore` y `viewStore`.",
            "Para cambiar algo, `store.send(.algo)`. El estado del store es de solo lectura desde afuera: no hay forma de escribir `store.count = 5`.",
            "El store raíz se crea una vez, fuera de `body`: en el `App`, como `static let` o inyectado. Si lo creás dentro de `body` se recrea en cada render y perdés el estado.",
          ],
          code: swift`import SwiftUI
import ComposableArchitecture

struct CounterView: View {
    let store: StoreOf<CounterFeature>

    var body: some View {
        VStack {
            Text("\(store.count)")
            Button("+") { store.send(.incrementButtonTapped) }
            Button("-") { store.send(.decrementButtonTapped) }
        }
    }
}

@main
struct CounterApp: App {
    static let store = Store(initialState: CounterFeature.State()) {
        CounterFeature()
    }

    var body: some Scene {
        WindowGroup {
            CounterView(store: CounterApp.store)
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "¿Qué pasa con este botón?",
          code: swift`Button("Reset") {
    store.count = 0
}`,
          options: [
            "Compila y pone el contador en 0",
            "No compila: el estado del store es de solo lectura; hay que mandar una acción",
            "Compila pero crashea en runtime",
            "Compila, pero la vista no se redibuja",
          ],
          answer: 1,
          explanation: "El store expone el estado con un acceso de solo lectura. La única forma de mutarlo es `store.send(.resetButtonTapped)` y dejar que el reducer haga el cambio. Es la misma garantía que el `private(set)` del store casero.",
        },
        {
          kind: "explain",
          title: "Bindings: `BindableAction` y `BindingReducer`",
          body: [
            "Un `TextField` o un `Toggle` necesitan un `Binding`. Para no escribir una acción por campo, hacé que `Action` conforme `BindableAction` con `case binding(BindingAction<State>)`, agregá `BindingReducer()` al `body` y marcá el store de la vista con `@Bindable`. Ahí `$store.username` funciona.",
            "`BindingReducer()` va **antes** del `Reduce`: primero aplica el nuevo valor y después tu lógica puede reaccionar. Para reaccionar a un campo puntual usás `case .binding(\\.username):`.",
          ],
          code: swift`@Reducer
struct SettingsFeature {
    @ObservableState
    struct State: Equatable {
        var username = ""
        var notificationsOn = false
    }

    enum Action: BindableAction {
        case binding(BindingAction<State>)
        case saveButtonTapped
    }

    var body: some ReducerOf<Self> {
        BindingReducer()
        Reduce { state, action in
            switch action {
            case .binding(\.username):
                state.username = String(state.username.prefix(20))
                return .none
            case .binding, .saveButtonTapped:
                return .none
            }
        }
    }
}

struct SettingsView: View {
    @Bindable var store: StoreOf<SettingsFeature>

    var body: some View {
        Form {
            TextField("Usuario", text: $store.username)
            Toggle("Notificaciones", isOn: $store.notificationsOn)
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el reducer que aplica los cambios de los bindings al estado.",
          code: swift`var body: some ReducerOf<Self> {
    ____()
    Reduce { state, action in
        // ...
    }
}`,
          accept: ["^BindingReducer$"],
          explanation: "`BindingReducer()` toma cada `.binding(...)` y escribe el valor en el estado. Sin él, el `TextField` manda la acción pero el estado no cambia y el campo \"rebota\".",
          hint: "Es un reducer que viene con TCA y se llama como la acción.",
          placeholder: "reducer",
        },
        {
          kind: "write",
          prompt: "Escribí `ProfileFeature` completa: `State` observable y `Equatable` con `name` (`String`) e `isPublic` (`Bool`), `Action` bindable y un `body` con `BindingReducer()` y un `Reduce` que devuelva `.none`.",
          starter: swift`import ComposableArchitecture

@Reducer
struct ProfileFeature {
    // State con name e isPublic
    // Action bindable
    // body
}
`,
          checks: [
            { pattern: "@ObservableState", label: "`State` con `@ObservableState`" },
            { pattern: "struct\\s+State\\s*:\\s*Equatable", label: "`State` conforma `Equatable`" },
            { pattern: "enum\\s+Action\\s*:\\s*BindableAction", label: "`Action` conforma `BindableAction`" },
            { pattern: "case\\s+binding\\s*\\(\\s*BindingAction<State>\\s*\\)", label: "Tiene `case binding(BindingAction<State>)`" },
            { pattern: "BindingReducer\\s*\\(\\s*\\)", label: "Usa `BindingReducer()`" },
            { pattern: "return\\s+\\.none", label: "El `Reduce` devuelve `.none`" },
          ],
          warnings: [
            { pattern: "@State\\s+(private\\s+)?var|@Published", label: "Estado fuera del store: todo va en `State`" },
            { pattern: "Reduce\\s*\\{[\\s\\S]*BindingReducer", label: "`BindingReducer()` va antes del `Reduce`" },
          ],
          solution: swift`import ComposableArchitecture

@Reducer
struct ProfileFeature {
    @ObservableState
    struct State: Equatable {
        var name = ""
        var isPublic = false
    }

    enum Action: BindableAction {
        case binding(BindingAction<State>)
    }

    var body: some ReducerOf<Self> {
        BindingReducer()
        Reduce { state, action in
            switch action {
            case .binding:
                return .none
            }
        }
    }
}`,
          hint: "Copiá la forma de `SettingsFeature` y dejá solo el `case binding`.",
        },
      ],
    },
    {
      id: "effects-dependencies",
      title: "Efectos y dependencias",
      goal: "Disparar trabajo asíncrono con `.run`, devolver resultados como acciones, cancelar, hacer debounce con el reloj y definir dependencias con valores live y de test.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "`.run`: efectos que devuelven acciones",
          body: [
            "Para trabajo asíncrono el reducer devuelve `.run { send in ... }`. Adentro podés usar `async/await` libremente; cuando tenés el resultado, lo mandás de vuelta con `await send(.algoResponse(...))` y el reducer lo procesa como cualquier otra acción.",
            "La closure escapa, así que **no podés capturar `state`** (es `inout`). Capturá los valores que necesitás en la lista de captura: `[count = state.count]`.",
            "Si el efecto puede tirar errores, usá la variante con `catch:` o un `do/catch` adentro y mandá una acción de error. Un error sin manejar en `.run` se reporta como advertencia en runtime en debug.",
          ],
          code: swift`@Reducer
struct FactFeature {
    @ObservableState
    struct State: Equatable {
        var count = 0
        var fact: String?
        var isLoading = false
    }

    enum Action {
        case factButtonTapped
        case factResponse(String)
    }

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .factButtonTapped:
                state.isLoading = true
                state.fact = nil
                return .run { [count = state.count] send in
                    let url = URL(string: "http://numbersapi.com/\(count)")!
                    let (data, _) = try await URLSession.shared.data(from: url)
                    await send(.factResponse(String(decoding: data, as: UTF8.self)))
                }
            case let .factResponse(fact):
                state.isLoading = false
                state.fact = fact
                return .none
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "¿Qué pasa con este efecto?",
          code: swift`case .factButtonTapped:
    return .run { send in
        let fact = try await fetchFact(state.count)
        await send(.factResponse(fact))
    }`,
          options: [
            "No compila: la closure escapa y no puede capturar el parámetro `inout` `state`",
            "Compila y usa el `count` del momento en que se ejecuta el efecto",
            "Compila pero crashea si `count` cambió mientras tanto",
            "Compila; TCA copia `state` automáticamente",
          ],
          answer: 0,
          explanation: "Swift no permite capturar un `inout` en una closure que escapa. La solución es capturar el valor: `.run { [count = state.count] send in ... }`. Además deja explícito qué datos usa el efecto.",
        },
        {
          kind: "explain",
          title: "Dependencias: `@Dependency` y un client",
          body: [
            "`URLSession.shared` adentro del efecto hace que la feature sea imposible de testear sin red. TCA usa la librería swift-dependencies: declarás `@Dependency(\\.numberFact) var numberFact` en el reducer y en tests lo reemplazás.",
            "Un client es un `struct` de closures. Con `@DependencyClient` el macro genera un `init()` donde cada endpoint está **sin implementar**: si un test lo llama sin haberlo pisado, el test falla. Conformás `DependencyKey` con `liveValue` (la real) y `testValue`, y lo registrás en `DependencyValues`.",
            "Ya vienen dependencias listas: `\\.continuousClock`, `\\.uuid`, `\\.date`, `\\.mainQueue`, `\\.dismiss`.",
          ],
          code: swift`import ComposableArchitecture

@DependencyClient
struct NumberFactClient {
    var fetch: @Sendable (_ number: Int) async throws -> String
}

extension NumberFactClient: DependencyKey {
    static let liveValue = NumberFactClient(
        fetch: { number in
            let url = URL(string: "http://numbersapi.com/\(number)")!
            let (data, _) = try await URLSession.shared.data(from: url)
            return String(decoding: data, as: UTF8.self)
        }
    )
    static let testValue = NumberFactClient()
}

extension DependencyValues {
    var numberFact: NumberFactClient {
        get { self[NumberFactClient.self] }
        set { self[NumberFactClient.self] = newValue }
    }
}

// En FactFeature:
@Dependency(\.numberFact) var numberFact

// ...
return .run { [count = state.count] send in
    let fact = try await numberFact.fetch(count)
    await send(.factResponse(fact))
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la dependencia de reloj que TCA trae lista para esperar, hacer debounce o timers.",
          code: swift`@Dependency(\.____) var clock`,
          accept: ["^continuousClock$", "^suspendingClock$"],
          explanation: "`\\.continuousClock` te da un `any Clock<Duration>`. En la app es el reloj real; en tests lo reemplazás por un `TestClock` (avanzás el tiempo a mano) o un `ImmediateClock` (no espera nada).",
          hint: "Es el `Clock` de Swift que sigue contando aunque el dispositivo duerma.",
          placeholder: "key path",
        },
        {
          kind: "explain",
          title: "Cancelación y debounce",
          body: [
            "Todo efecto se puede marcar con `.cancellable(id:)`. Con `cancelInFlight: true`, al arrancar uno nuevo con el mismo id se cancela el anterior. `.cancel(id:)` lo corta desde otra acción.",
            "Debounce sin operadores especiales: el efecto primero **duerme** con el reloj y después busca. Si el usuario vuelve a tipear antes de que termine la espera, `cancelInFlight` mata el efecto viejo y nunca llega a pedir nada.",
            "Usá un `enum CancelID` como id: es hashable y no choca con otros ids.",
          ],
          code: swift`@Reducer
struct SearchFeature {
    @ObservableState
    struct State: Equatable {
        var query = ""
        var results: [String] = []
    }

    enum Action {
        case queryChanged(String)
        case searchResponse([String])
    }

    enum CancelID { case search }

    @Dependency(\.continuousClock) var clock
    @Dependency(\.searchClient) var searchClient  // definido igual que NumberFactClient

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case let .queryChanged(query):
                state.query = query
                guard !query.isEmpty else {
                    state.results = []
                    return .cancel(id: CancelID.search)
                }
                return .run { send in
                    try await clock.sleep(for: .milliseconds(300))
                    let results = try await searchClient.search(query)
                    await send(.searchResponse(results))
                }
                .cancellable(id: CancelID.search, cancelInFlight: true)

            case let .searchResponse(results):
                state.results = results
                return .none
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "El usuario tipea \"s\", \"sw\" y \"swi\" con 100 ms entre cada tecla y después espera. ¿Cuántas veces se llama a `searchClient.search`?",
          code: swift`// t = 0 ms    queryChanged("s")
// t = 100 ms  queryChanged("sw")
// t = 200 ms  queryChanged("swi")
// ...espera
return .run { send in
    try await clock.sleep(for: .milliseconds(300))
    let results = try await searchClient.search(query)
    await send(.searchResponse(results))
}
.cancellable(id: CancelID.search, cancelInFlight: true)`,
          options: [
            "3 veces, una por tecla",
            "1 vez, con \"s\"",
            "1 vez, con \"swi\"",
            "Ninguna: la cancelación corta todo",
          ],
          answer: 2,
          explanation: "Cada `queryChanged` arranca un efecto con el mismo id y `cancelInFlight: true` cancela el anterior mientras todavía está en `clock.sleep`. Solo el último (\"swi\") completa los 300 ms y llega a buscar. Eso es un debounce.",
        },
        {
          kind: "write",
          prompt: "Completá `TimerFeature`: al tocar el botón, si el timer quedó corriendo arrancá un efecto que cada 1 segundo mande `.timerTick` usando el reloj de dependencias y marcalo cancelable con `CancelID.timer`; si quedó detenido, cancelalo.",
          starter: swift`@Reducer
struct TimerFeature {
    @ObservableState
    struct State: Equatable {
        var count = 0
        var isTimerRunning = false
    }

    enum Action {
        case toggleTimerButtonTapped
        case timerTick
    }

    enum CancelID { case timer }

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .toggleTimerButtonTapped:
                state.isTimerRunning.toggle()
                // arrancá o cancelá el timer
                return .none
            case .timerTick:
                state.count += 1
                return .none
            }
        }
    }
}
`,
          checks: [
            { pattern: "@Dependency\\(\\\\\\.continuousClock\\)\\s+var\\s+clock", label: "Declara `@Dependency(\\.continuousClock) var clock`" },
            { pattern: "clock\\.sleep\\(for:", label: "Espera con `clock.sleep(for:)`" },
            { pattern: "await\\s+send\\(\\s*\\.timerTick\\s*\\)", label: "Manda `.timerTick` desde el efecto" },
            { pattern: "\\.cancellable\\(\\s*id:\\s*CancelID\\.timer", label: "Marca el efecto con `.cancellable(id: CancelID.timer)`" },
            { pattern: "\\.cancel\\(\\s*id:\\s*CancelID\\.timer\\s*\\)", label: "Lo detiene con `.cancel(id: CancelID.timer)`" },
          ],
          warnings: [
            { pattern: "Task\\.sleep|Timer\\.scheduledTimer|DispatchQueue", label: "Tiempo no controlado: usá el reloj de dependencias" },
          ],
          solution: swift`@Reducer
struct TimerFeature {
    @ObservableState
    struct State: Equatable {
        var count = 0
        var isTimerRunning = false
    }

    enum Action {
        case toggleTimerButtonTapped
        case timerTick
    }

    enum CancelID { case timer }

    @Dependency(\.continuousClock) var clock

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .toggleTimerButtonTapped:
                state.isTimerRunning.toggle()
                if state.isTimerRunning {
                    return .run { send in
                        while true {
                            try await clock.sleep(for: .seconds(1))
                            await send(.timerTick)
                        }
                    }
                    .cancellable(id: CancelID.timer)
                } else {
                    return .cancel(id: CancelID.timer)
                }
            case .timerTick:
                state.count += 1
                return .none
            }
        }
    }
}`,
          hint: "Un `while true` con `try await clock.sleep(for: .seconds(1))` y `await send(.timerTick)` adentro del `.run`.",
        },
      ],
    },
    {
      id: "composition-navigation",
      title: "Composición y navegación",
      goal: "Componer features hijas con `Scope`, colecciones con `IdentifiedArray` y `.forEach`, sheets con `@Presents` + `.ifLet` y navegación en pila con `StackState`.",
      minutes: 24,
      steps: [
        {
          kind: "explain",
          title: "`Scope`: una feature dentro de otra",
          body: [
            "La \"C\" de TCA es composición. El padre guarda el estado del hijo en su `State`, envuelve sus acciones en un `case` y en el `body` usa `Scope(state:action:)` para correr el reducer hijo sobre ese pedazo.",
            "`@Reducer` hace que `Action` sea `@CasePathable`, por eso podés escribir `action: \\.tab1` como si fuera un key path. En la vista, `store.scope(state: \\.tab1, action: \\.tab1)` te da un `StoreOf<CounterFeature>` para la vista hija.",
            "El orden importa: los reducers del `body` corren de arriba hacia abajo. Si el `Scope` está antes del `Reduce` del padre, el padre ve el estado del hijo **ya actualizado**.",
          ],
          code: swift`@Reducer
struct AppFeature {
    @ObservableState
    struct State: Equatable {
        var tab1 = CounterFeature.State()
        var tab2 = CounterFeature.State()
    }

    enum Action {
        case tab1(CounterFeature.Action)
        case tab2(CounterFeature.Action)
    }

    var body: some ReducerOf<Self> {
        Scope(state: \.tab1, action: \.tab1) {
            CounterFeature()
        }
        Scope(state: \.tab2, action: \.tab2) {
            CounterFeature()
        }
        Reduce { state, action in
            // el padre puede reaccionar a acciones del hijo
            return .none
        }
    }
}

// En la vista
CounterView(store: store.scope(state: \.tab1, action: \.tab1))`,
        },
        {
          kind: "predict",
          prompt: "Arrancás con `tab1.count = 0` y `tab2.count = 5` y mandás `.tab1(.incrementButtonTapped)`. ¿Cómo queda el estado?",
          code: swift`var body: some ReducerOf<Self> {
    Scope(state: \.tab1, action: \.tab1) {
        CounterFeature()
    }
    Reduce { state, action in
        switch action {
        case .tab1(.incrementButtonTapped):
            state.tab2.count += state.tab1.count
            return .none
        default:
            return .none
        }
    }
}`,
          options: [
            "`tab1 = 1`, `tab2 = 5`",
            "`tab1 = 0`, `tab2 = 5`",
            "`tab1 = 1`, `tab2 = 6`",
            "`tab1 = 1`, `tab2 = 1`",
          ],
          answer: 2,
          explanation: "Primero corre el `Scope`: el hijo incrementa y `tab1.count` pasa a 1. Después corre el `Reduce` del padre, que ve la acción y suma `tab1.count` (ya 1) a `tab2.count`: 5 + 1 = 6. Si el `Reduce` estuviera antes del `Scope`, sumaría 0.",
        },
        {
          kind: "explain",
          title: "Colecciones: `IdentifiedArray` y `.forEach`",
          body: [
            "Para una lista de features hijas usás `IdentifiedArrayOf<Hijo.State>` (los elementos son `Identifiable`) y una acción `case todos(IdentifiedActionOf<TodoFeature>)`. En el `body`, `.forEach(\\.todos, action: \\.todos) { TodoFeature() }` corre el reducer hijo sobre el elemento correcto.",
            "¿Por qué no un `Array`? Porque las acciones se direccionan **por id, no por índice**. Si borrás una fila mientras un efecto de otra sigue en vuelo, un índice apuntaría a la fila equivocada; un id no. Además `state.todos[id: id]` es O(1).",
            "Para generar ids usá `@Dependency(\\.uuid)`: en tests es determinístico.",
          ],
          code: swift`@Reducer
struct TodosFeature {
    @ObservableState
    struct State: Equatable {
        var todos: IdentifiedArrayOf<TodoFeature.State> = []
    }

    enum Action {
        case addButtonTapped
        case todos(IdentifiedActionOf<TodoFeature>)
    }

    @Dependency(\.uuid) var uuid

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .addButtonTapped:
                state.todos.append(TodoFeature.State(id: uuid(), title: ""))
                return .none
            case .todos:
                return .none
            }
        }
        .forEach(\.todos, action: \.todos) {
            TodoFeature()
        }
    }
}

// En la vista
ForEach(store.scope(state: \.todos, action: \.todos)) { todoStore in
    TodoRow(store: todoStore)
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el tipo de colección que TCA recomienda para listas de features hijas.",
          code: swift`var todos: ____<TodoFeature.State> = []`,
          accept: ["^IdentifiedArrayOf$"],
          explanation: "`IdentifiedArrayOf<Element>` es un `IdentifiedArray` con `Element.ID` como clave. Se comporta como array (orden, literales `[]`) pero se accede por id, que es lo que necesita `.forEach`.",
          hint: "Viene de swift-identified-collections y termina en `Of`.",
          placeholder: "tipo",
        },
        {
          kind: "explain",
          title: "Sheets y alerts: `@Presents` + `.ifLet`",
          body: [
            "La navegación se modela con estado: una sheet está abierta si su estado opcional no es `nil`. Marcás la propiedad con `@Presents`, la acción es `case addContact(PresentationAction<AddContactFeature.Action>)` y en el `body` agregás `.ifLet(\\.$addContact, action: \\.addContact) { AddContactFeature() }`.",
            "`.ifLet` corre el reducer hijo solo mientras hay estado y, cuando pasa a `nil`, **cancela los efectos del hijo**. El hijo se puede cerrar solo con `@Dependency(\\.dismiss)`. El padre se entera de lo que pasa adentro con `case .addContact(.presented(.saveButtonTapped))`.",
            "Si una pantalla tiene varios destinos (una sheet, una alert, un confirmation dialog) se agrupan en un `@Reducer enum Destination` con `@Presents var destination: Destination.State?` y `.ifLet(\\.$destination, action: \\.destination)`: así es imposible tener dos abiertos a la vez.",
          ],
          code: swift`@Reducer
struct ContactsFeature {
    @ObservableState
    struct State: Equatable {
        var contacts: IdentifiedArrayOf<Contact> = []
        @Presents var addContact: AddContactFeature.State?
    }

    enum Action {
        case addButtonTapped
        case addContact(PresentationAction<AddContactFeature.Action>)
    }

    @Dependency(\.uuid) var uuid

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .addButtonTapped:
                state.addContact = AddContactFeature.State(
                    contact: Contact(id: uuid(), name: "")
                )
                return .none
            case .addContact(.presented(.saveButtonTapped)):
                guard let contact = state.addContact?.contact else { return .none }
                state.contacts.append(contact)
                state.addContact = nil
                return .none
            case .addContact:
                return .none
            }
        }
        .ifLet(\.$addContact, action: \.addContact) {
            AddContactFeature()
        }
    }
}

// En la vista (con @Bindable var store)
.sheet(item: $store.scope(state: \.addContact, action: \.addContact)) { addStore in
    NavigationStack {
        AddContactView(store: addStore)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "La sheet de `AddContactFeature` tiene un efecto `.run` validando el contacto contra el backend. El usuario la cierra deslizando hacia abajo. ¿Qué pasa con ese efecto?",
          code: swift`.ifLet(\.$addContact, action: \.addContact) {
    AddContactFeature()
}`,
          options: [
            "`.ifLet` lo cancela automáticamente porque el estado del hijo pasó a `nil`",
            "Sigue corriendo y su respuesta crashea porque el estado ya no existe",
            "Sigue corriendo hasta terminar y su acción se aplica igual al hijo",
            "Hay que cancelarlo a mano con `.cancel(id:)` en el padre",
          ],
          answer: 0,
          explanation: "Al deslizar, el binding de la sheet pone `addContact` en `nil` (mandando `.dismiss`). `.ifLet` detecta que el hijo desapareció y cancela sus efectos en vuelo. Es una de las ventajas de modelar la navegación como estado: el ciclo de vida de los efectos queda atado al de la pantalla.",
        },
        {
          kind: "explain",
          title: "Navegación en pila: `StackState`",
          body: [
            "Para `NavigationStack` se define un `@Reducer enum Path` con un `case` por pantalla posible. El padre guarda `var path = StackState<Path.State>()`, la acción `case path(StackActionOf<Path>)` y en el `body` `.forEach(\\.path, action: \\.path)`.",
            "Navegar es mutar el estado: `state.path.append(.detail(...))` empuja, `state.path.removeLast()` vuelve. Eso hace testeable y restaurable cualquier deep link.",
            "En la vista, `NavigationStack(path: $store.scope(state: \\.path, action: \\.path))` y en `destination:` hacés `switch store.case` para elegir la vista.",
          ],
          code: swift`@Reducer
struct RootFeature {
    @Reducer
    enum Path {
        case detail(ContactDetailFeature)
        case settings(SettingsFeature)
    }

    @ObservableState
    struct State: Equatable {
        var path = StackState<Path.State>()
        var contacts = ContactsFeature.State()
    }

    enum Action {
        case path(StackActionOf<Path>)
        case contacts(ContactsFeature.Action)
    }

    var body: some ReducerOf<Self> {
        Scope(state: \.contacts, action: \.contacts) {
            ContactsFeature()
        }
        Reduce { state, action in
            switch action {
            case let .contacts(.contactTapped(contact)):
                state.path.append(.detail(ContactDetailFeature.State(contact: contact)))
                return .none
            case .contacts, .path:
                return .none
            }
        }
        .forEach(\.path, action: \.path)
    }
}

extension RootFeature.Path.State: Equatable {}

// En la vista (con @Bindable var store)
NavigationStack(path: $store.scope(state: \.path, action: \.path)) {
    ContactsView(store: store.scope(state: \.contacts, action: \.contacts))
} destination: { store in
    switch store.case {
    case let .detail(store): ContactDetailView(store: store)
    case let .settings(store): SettingsView(store: store)
    }
}`,
        },
        {
          kind: "write",
          prompt: "Completá `ParentFeature`: corré `ProfileFeature` sobre `state.profile` con `Scope`, agregá una sheet opcional `edit` de tipo `EditFeature.State` con `@Presents`, su acción con `PresentationAction`, abrila en `.editButtonTapped` con `EditFeature.State(name: state.profile.name)` e integrala con `.ifLet`.",
          starter: swift`@Reducer
struct ParentFeature {
    @ObservableState
    struct State: Equatable {
        var profile = ProfileFeature.State()
        // sheet de edición
    }

    enum Action {
        case profile(ProfileFeature.Action)
        case editButtonTapped
        // acción de la sheet
    }

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .editButtonTapped:
                return .none
            case .profile:
                return .none
            }
        }
    }
}
`,
          checks: [
            { pattern: "Scope\\(\\s*state:\\s*\\\\\\.profile\\s*,\\s*action:\\s*\\\\\\.profile\\s*\\)", label: "`Scope(state: \\.profile, action: \\.profile)`" },
            { pattern: "@Presents\\s+var\\s+edit\\s*:\\s*EditFeature\\.State\\?", label: "`@Presents var edit: EditFeature.State?`" },
            { pattern: "case\\s+edit\\s*\\(\\s*PresentationAction<EditFeature\\.Action>\\s*\\)", label: "`case edit(PresentationAction<EditFeature.Action>)`" },
            { pattern: "state\\.edit\\s*=\\s*EditFeature\\.State\\(", label: "Abre la sheet asignando el estado" },
            { pattern: "\\.ifLet\\(\\s*\\\\\\.\\$edit\\s*,\\s*action:\\s*\\\\\\.edit\\s*\\)", label: "`.ifLet(\\.$edit, action: \\.edit)`" },
          ],
          warnings: [
            { pattern: "\\.ifLet\\(\\s*\\\\\\.edit\\b", label: "Al `.ifLet` le falta el `$`: es `\\.$edit`" },
            { pattern: "isEditPresented|showEdit", label: "Un `Bool` aparte duplica el estado: usá el opcional" },
          ],
          solution: swift`@Reducer
struct ParentFeature {
    @ObservableState
    struct State: Equatable {
        var profile = ProfileFeature.State()
        @Presents var edit: EditFeature.State?
    }

    enum Action {
        case profile(ProfileFeature.Action)
        case editButtonTapped
        case edit(PresentationAction<EditFeature.Action>)
    }

    var body: some ReducerOf<Self> {
        Scope(state: \.profile, action: \.profile) {
            ProfileFeature()
        }
        Reduce { state, action in
            switch action {
            case .editButtonTapped:
                state.edit = EditFeature.State(name: state.profile.name)
                return .none
            case .profile, .edit:
                return .none
            }
        }
        .ifLet(\.$edit, action: \.edit) {
            EditFeature()
        }
    }
}`,
          hint: "El `Scope` va arriba del `Reduce`; el `.ifLet` va encadenado al `Reduce`.",
        },
      ],
    },
    {
      id: "teststore",
      title: "Testing con `TestStore`",
      goal: "Escribir tests exhaustivos con `TestStore`, recibir acciones de efectos, controlar dependencias y tiempo, usar el modo no exhaustivo y decidir cuándo conviene TCA.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "`TestStore`: exhaustivo por defecto",
          body: [
            "`TestStore` se crea igual que un `Store`. Cada `await store.send(.accion) { ... }` recibe en la closure el estado **anterior** como `inout`: lo mutás hasta dejarlo como esperás y el test lo compara con el estado real. Si difieren, falla con un diff.",
            "Es **exhaustivo**: tenés que afirmar cada cambio de estado, recibir cada acción que manden los efectos y al terminar el test no puede quedar ningún efecto corriendo. Si algo se te escapa, el test falla. Es exigente, pero un refactor que cambie el comportamiento no pasa desapercibido.",
          ],
          code: swift`import ComposableArchitecture
import Testing

@MainActor
struct CounterFeatureTests {
    @Test
    func incrementAndDecrement() async {
        let store = TestStore(initialState: CounterFeature.State()) {
            CounterFeature()
        }

        await store.send(.incrementButtonTapped) {
            $0.count = 1
        }
        await store.send(.decrementButtonTapped) {
            $0.count = 0
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "`.factButtonTapped` pone `isLoading = true` y dispara un efecto. El test hace esto y termina. ¿Qué pasa?",
          code: swift`let store = TestStore(initialState: FactFeature.State()) {
    FactFeature()
} withDependencies: {
    $0.numberFact.fetch = { "\($0) es un buen número." }
}

await store.send(.factButtonTapped)`,
          options: [
            "Pasa: no había nada que afirmar",
            "Pasa con una advertencia por el efecto",
            "Falla solo porque el efecto quedó corriendo",
            "Falla: no se afirmó el cambio de `isLoading` y tampoco se recibió `.factResponse`",
          ],
          answer: 3,
          explanation: "Sin closure, el `TestStore` espera que el estado no cambie, pero cambió `isLoading`: falla con un diff. Además el efecto manda `.factResponse` y el test termina sin `receive`: segunda falla. El modo exhaustivo te obliga a describir todo lo que pasa.",
        },
        {
          kind: "explain",
          title: "`receive` y `withDependencies`",
          body: [
            "Las acciones que mandan los efectos se afirman con `await store.receive(\\.factResponse) { ... }`: el key path de case identifica la acción y la closure afirma el cambio de estado que produce.",
            "En el trailing closure `withDependencies:` pisás las dependencias para este test. Como `testValue` está sin implementar, cualquier endpoint que la feature use y no pises hace fallar el test: no hay llamadas reales escondidas.",
          ],
          code: swift`@Test
func fetchFact() async {
    let store = TestStore(initialState: FactFeature.State()) {
        FactFeature()
    } withDependencies: {
        $0.numberFact.fetch = { "\($0) es un buen número." }
    }

    await store.send(.factButtonTapped) {
        $0.isLoading = true
    }
    await store.receive(\.factResponse) {
        $0.isLoading = false
        $0.fact = "0 es un buen número."
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el método que afirma una acción que llegó desde un efecto.",
          code: swift`await store.____(\.factResponse) {
    $0.isLoading = false
    $0.fact = "0 es un buen número."
}`,
          accept: ["^receive$"],
          explanation: "`send` es para acciones que manda el test (como el usuario); `receive` para las que mandan los efectos. `receive` espera a que llegue la acción, así que funciona con efectos asíncronos.",
          hint: "Lo opuesto de `send`.",
          placeholder: "método",
        },
        {
          kind: "explain",
          title: "Controlar el tiempo: `TestClock`",
          body: [
            "Un debounce de 300 ms no debería hacer esperar 300 ms al test. Con `TestClock` el tiempo **solo avanza cuando vos lo decís**: `await clock.advance(by: .milliseconds(300))`. El test corre instantáneo y es determinístico.",
            "Si el tiempo no te importa (por ejemplo un delay de animación), `ImmediateClock()` hace que toda espera termine al instante.",
          ],
          code: swift`@Test
func searchDebounces() async {
    let clock = TestClock()
    let store = TestStore(initialState: SearchFeature.State()) {
        SearchFeature()
    } withDependencies: {
        $0.continuousClock = clock
        $0.searchClient.search = { _ in ["SwiftUI"] }
    }

    await store.send(.queryChanged("Sw")) {
        $0.query = "Sw"
    }
    await clock.advance(by: .milliseconds(300))
    await store.receive(\.searchResponse) {
        $0.results = ["SwiftUI"]
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Mismo test de búsqueda, pero el reloj avanza solo 200 ms y el test termina. ¿Qué pasa?",
          code: swift`await store.send(.queryChanged("Sw")) {
    $0.query = "Sw"
}
await clock.advance(by: .milliseconds(200))
// fin del test`,
          options: [
            "Pasa: la búsqueda no llegó a ejecutarse",
            "Falla: el efecto sigue en vuelo (durmiendo en el reloj) cuando termina el test",
            "Falla porque `receive` es obligatorio después de `advance`",
            "Se queda colgado esperando los 100 ms que faltan",
          ],
          answer: 1,
          explanation: "El efecto sigue suspendido en `clock.sleep`, esperando 100 ms más que nunca llegan. El `TestStore` exhaustivo exige que no queden efectos corriendo al final, así que falla. Para arreglarlo, avanzá los 300 ms y recibí la respuesta, o probá explícitamente la cancelación.",
        },
        {
          kind: "explain",
          title: "Modo no exhaustivo y cuándo elegir TCA",
          body: [
            "En tests de integración (un flujo que cruza varias features) afirmar cada detalle es ruido. Con `store.exhaustivity = .off` solo afirmás lo que te importa; `skipReceivedActions()` descarta las acciones recibidas y `store.assert { ... }` verifica el estado final. Usalo para flujos grandes, no como atajo en tests unitarios.",
            "¿Cuándo conviene TCA? Pantallas con mucho estado compartido, muchos efectos que se cancelan entre sí, navegación compleja y un equipo que quiere convenciones fuertes y tests exhaustivos. ¿Cuándo no? Apps chicas o CRUD, equipos sin tiempo para la curva de aprendizaje, o si el costo de compilación de los macros y la dependencia de una librería externa pesan más. Un MVVM con `@Observable` e inyección por `init` cubre muy bien esos casos.",
          ],
          code: swift`@Test
func loginFlow() async {
    let store = TestStore(initialState: AppFeature.State()) {
        AppFeature()
    } withDependencies: {
        $0.authClient.login = { _, _ in User.mock }
    }
    store.exhaustivity = .off

    await store.send(.login(.loginButtonTapped))
    await store.skipReceivedActions()
    store.assert {
        $0.isLoggedIn = true
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Equipo de 3 devs, app interna de formularios CRUD con cuatro pantallas y entrega en seis semanas. Nadie usó TCA. ¿Qué recomendás?",
          code: swift`// Pantallas: Login, Lista, Detalle, Editar
// Sin estado compartido complejo, sin tiempo real`,
          options: [
            "MVVM con `@Observable` e inyección por `init`: menos ceremonia y testeable sin aprender una librería nueva",
            "TCA en todas las pantallas para que sea escalable desde el día uno",
            "MVC con toda la lógica en los view controllers",
            "VIPER para separar responsabilidades al máximo",
          ],
          answer: 0,
          explanation: "TCA brilla con estado complejo y efectos que interactúan; acá el costo de aprendizaje y la ceremonia no se recuperan en seis semanas. MVVM con `@Observable` y dependencias inyectadas es testeable y simple. VIPER agrega todavía más archivos y MVC masivo complica los tests. Elegir arquitectura es elegir costos.",
        },
        {
          kind: "write",
          prompt: "Escribí un test exhaustivo para `TimerFeature` (lección anterior): usá un `TestClock`, arrancá el timer, avanzá 1 segundo, recibí `.timerTick` con `count = 1` y detené el timer para que no quede el efecto corriendo.",
          starter: swift`import ComposableArchitecture
import Testing

@MainActor
struct TimerFeatureTests {
    @Test
    func timerTicks() async {
        // TestStore con reloj controlado
    }
}
`,
          checks: [
            { pattern: "let\\s+clock\\s*=\\s*TestClock\\(\\)", label: "Crea un `TestClock()`" },
            { pattern: "TestStore\\(initialState:\\s*TimerFeature\\.State\\(\\)\\)", label: "Crea el `TestStore`" },
            { pattern: "\\$0\\.continuousClock\\s*=\\s*clock", label: "Inyecta el reloj con `withDependencies`" },
            { pattern: "await\\s+clock\\.advance\\(by:", label: "Avanza el reloj" },
            { pattern: "await\\s+store\\.receive\\(\\s*\\\\\\.timerTick\\s*\\)", label: "Recibe `\\.timerTick`" },
            { pattern: "isTimerRunning\\s*=\\s*false", label: "Detiene el timer al final" },
          ],
          warnings: [
            { pattern: "Task\\.sleep", label: "Dormir de verdad hace el test lento y frágil" },
            { pattern: "exhaustivity\\s*=\\s*\\.off", label: "Acá el test tiene que ser exhaustivo" },
          ],
          solution: swift`import ComposableArchitecture
import Testing

@MainActor
struct TimerFeatureTests {
    @Test
    func timerTicks() async {
        let clock = TestClock()
        let store = TestStore(initialState: TimerFeature.State()) {
            TimerFeature()
        } withDependencies: {
            $0.continuousClock = clock
        }

        await store.send(.toggleTimerButtonTapped) {
            $0.isTimerRunning = true
        }
        await clock.advance(by: .seconds(1))
        await store.receive(\.timerTick) {
            $0.count = 1
        }
        await store.send(.toggleTimerButtonTapped) {
            $0.isTimerRunning = false
        }
    }
}`,
          hint: "El segundo `.toggleTimerButtonTapped` cancela el efecto y deja `isTimerRunning` en `false`.",
        },
      ],
    },
    {
      id: "final-challenge",
      title: "Reto final: buscador de películas",
      goal: "Integrar todo el curso: estado y acciones, debounce cancelable, dependencia inyectable, sheet de detalle con `@Presents` y tests exhaustivos con `TestStore`.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Producto quiere un buscador de películas: (1) con menos de 2 caracteres se vacían los resultados y se cancela cualquier búsqueda; (2) con 2 o más, se espera 300 ms sin tipear (debounce) y se llama a la API; (3) una búsqueda nueva cancela la anterior; (4) si la API falla se muestra `errorMessage`; (5) tocar una película abre una sheet con su detalle.",
            "Ya tenés el modelo, el client y la feature de detalle. Te falta `MovieSearchFeature` y sus tests. Todo exhaustivo, sin red ni esperas reales.",
          ],
          code: swift`import ComposableArchitecture

struct Movie: Equatable, Identifiable, Sendable {
    let id: Int
    let title: String
    let year: Int
}

@DependencyClient
struct MovieClient {
    var search: @Sendable (_ query: String) async throws -> [Movie]
}

extension MovieClient: DependencyKey {
    static let liveValue = MovieClient(search: { query in
        // URLSession + JSONDecoder contra la API real
        []
    })
    static let testValue = MovieClient()
}

extension DependencyValues {
    var movieClient: MovieClient {
        get { self[MovieClient.self] }
        set { self[MovieClient.self] = newValue }
    }
}

@Reducer
struct MovieDetailFeature {
    @ObservableState
    struct State: Equatable {
        let movie: Movie
    }

    enum Action {
        case closeButtonTapped
    }

    @Dependency(\.dismiss) var dismiss

    var body: some ReducerOf<Self> {
        Reduce { _, action in
            switch action {
            case .closeButtonTapped:
                return .run { _ in await dismiss() }
            }
        }
    }
}`,
        },
        {
          kind: "write",
          prompt: "Paso 1: escribí `State` y `Action` de `MovieSearchFeature`. `State` (observable, `Equatable`): `query`, `movies` como colección identificada, `isLoading`, `errorMessage` opcional y la sheet `detail` con `@Presents`. `Action`: `queryChanged(String)`, `searchResponse([Movie])`, `searchFailed(String)`, `movieTapped(Movie.ID)` y la acción de la sheet.",
          starter: swift`@Reducer
struct MovieSearchFeature {
    // State y Action
}
`,
          checks: [
            { pattern: "@ObservableState", label: "`State` con `@ObservableState`" },
            { pattern: "IdentifiedArrayOf<Movie>", label: "`movies` es `IdentifiedArrayOf<Movie>`" },
            { pattern: "@Presents\\s+var\\s+detail\\s*:\\s*MovieDetailFeature\\.State\\?", label: "`@Presents var detail: MovieDetailFeature.State?`" },
            { pattern: "case\\s+searchResponse\\(\\s*\\[Movie\\]\\s*\\)", label: "`case searchResponse([Movie])`" },
            { pattern: "case\\s+movieTapped\\(", label: "`case movieTapped(...)`" },
            { pattern: "case\\s+detail\\(\\s*PresentationAction<MovieDetailFeature\\.Action>\\s*\\)", label: "`case detail(PresentationAction<MovieDetailFeature.Action>)`" },
          ],
          warnings: [
            { pattern: "var\\s+movies\\s*:\\s*\\[Movie\\]", label: "Usá `IdentifiedArrayOf<Movie>` en lugar de `[Movie]`" },
          ],
          solution: swift`@Reducer
struct MovieSearchFeature {
    @ObservableState
    struct State: Equatable {
        var query = ""
        var movies: IdentifiedArrayOf<Movie> = []
        var isLoading = false
        var errorMessage: String?
        @Presents var detail: MovieDetailFeature.State?
    }

    enum Action {
        case queryChanged(String)
        case searchResponse([Movie])
        case searchFailed(String)
        case movieTapped(Movie.ID)
        case detail(PresentationAction<MovieDetailFeature.Action>)
    }
}`,
          hint: "Mirá `ContactsFeature` para la parte de `@Presents` y `PresentationAction`.",
        },
        {
          kind: "write",
          prompt: "Paso 2: escribí el `body`. Declará las dependencias de reloj y de `movieClient`; en `queryChanged` aplicá las reglas 1 a 4 (debounce de 300 ms con `clock.sleep`, `.cancellable(id: CancelID.search, cancelInFlight: true)`, `.cancel(id:)` para consultas cortas); en `movieTapped` abrí el detalle; integrá la sheet con `.ifLet`.",
          starter: swift`@Reducer
struct MovieSearchFeature {
    // State y Action del paso anterior

    enum CancelID { case search }

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            // tu lógica
            return .none
        }
    }
}
`,
          checks: [
            { pattern: "@Dependency\\(\\\\\\.continuousClock\\)", label: "Depende de `\\.continuousClock`" },
            { pattern: "@Dependency\\(\\\\\\.movieClient\\)", label: "Depende de `\\.movieClient`" },
            { pattern: "clock\\.sleep\\(for:\\s*\\.milliseconds\\(300\\)\\)", label: "Debounce de 300 ms con el reloj" },
            { pattern: "\\.cancellable\\(\\s*id:\\s*CancelID\\.search\\s*,\\s*cancelInFlight:\\s*true\\s*\\)", label: "Cancela la búsqueda anterior con `cancelInFlight: true`" },
            { pattern: "\\.cancel\\(\\s*id:\\s*CancelID\\.search\\s*\\)", label: "Cancela con consultas cortas" },
            { pattern: "\\.ifLet\\(\\s*\\\\\\.\\$detail\\s*,\\s*action:\\s*\\\\\\.detail\\s*\\)", label: "Integra la sheet con `.ifLet(\\.$detail, action: \\.detail)`" },
          ],
          warnings: [
            { pattern: "Task\\.sleep", label: "`Task.sleep` no se puede controlar en tests: usá el reloj" },
            { pattern: "URLSession", label: "La red va en el client, no en el reducer" },
          ],
          solution: swift`@Reducer
struct MovieSearchFeature {
    // State y Action del paso anterior

    enum CancelID { case search }

    @Dependency(\.continuousClock) var clock
    @Dependency(\.movieClient) var movieClient

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case let .queryChanged(query):
                state.query = query
                state.errorMessage = nil
                guard query.count >= 2 else {
                    state.movies = []
                    state.isLoading = false
                    return .cancel(id: CancelID.search)
                }
                state.isLoading = true
                return .run { send in
                    try await clock.sleep(for: .milliseconds(300))
                    do {
                        let movies = try await movieClient.search(query)
                        await send(.searchResponse(movies))
                    } catch {
                        await send(.searchFailed(error.localizedDescription))
                    }
                }
                .cancellable(id: CancelID.search, cancelInFlight: true)

            case let .searchResponse(movies):
                state.isLoading = false
                state.movies = IdentifiedArray(uniqueElements: movies)
                return .none

            case let .searchFailed(message):
                state.isLoading = false
                state.errorMessage = message
                return .none

            case let .movieTapped(id):
                guard let movie = state.movies[id: id] else { return .none }
                state.detail = MovieDetailFeature.State(movie: movie)
                return .none

            case .detail:
                return .none
            }
        }
        .ifLet(\.$detail, action: \.detail) {
            MovieDetailFeature()
        }
    }
}`,
          hint: "Copiá la estructura de `SearchFeature` (lección 3) y sumale el `case .movieTapped` y el `.ifLet` de `ContactsFeature`.",
        },
        {
          kind: "predict",
          prompt: "En el PR alguien sacó `cancelInFlight: true` \"porque el debounce ya alcanza\". El usuario busca \"bat\", la API tarda 2 s en responder y a los 500 ms tipea \"batman\". ¿Qué riesgo aparece?",
          code: swift`return .run { send in
    try await clock.sleep(for: .milliseconds(300))
    let movies = try await movieClient.search(query)
    await send(.searchResponse(movies))
}
.cancellable(id: CancelID.search)`,
          options: [
            "Ninguno: el debounce evita cualquier carrera",
            "No compila sin `cancelInFlight`",
            "Las dos búsquedas quedan en vuelo y, si \"bat\" responde después que \"batman\", pisa los resultados nuevos con los viejos",
            "La búsqueda de \"batman\" nunca se ejecuta",
          ],
          answer: 2,
          explanation: "El debounce solo descarta efectos que todavía están durmiendo. Cuando llega \"batman\", la búsqueda de \"bat\" ya está esperando la red y, sin `cancelInFlight`, nadie la cancela. Las respuestas pueden llegar en cualquier orden: la vieja puede pisar a la nueva. `cancelInFlight: true` corta la anterior en cualquier punto.",
        },
        {
          kind: "write",
          prompt: "Paso 3: escribí un test exhaustivo. Usá `TestClock` y pisá `movieClient.search` para que devuelva `Movie(id: 1, title: \"Batman\", year: 1989)`. Mandá `.queryChanged(\"bat\")`, avanzá 300 ms, recibí `\\.searchResponse` y después tocá la película para abrir el detalle.",
          starter: swift`import ComposableArchitecture
import Testing

@MainActor
struct MovieSearchFeatureTests {
    @Test
    func searchDebouncesAndOpensDetail() async {
        let movie = Movie(id: 1, title: "Batman", year: 1989)
        // tu test
    }
}
`,
          checks: [
            { pattern: "TestStore\\(initialState:\\s*MovieSearchFeature\\.State\\(\\)\\)", label: "Crea el `TestStore`" },
            { pattern: "TestClock\\(\\)", label: "Usa `TestClock()`" },
            { pattern: "\\$0\\.movieClient\\.search\\s*=", label: "Pisa `movieClient.search`" },
            { pattern: "await\\s+clock\\.advance\\(by:\\s*\\.milliseconds\\(300\\)\\)", label: "Avanza 300 ms" },
            { pattern: "await\\s+store\\.receive\\(\\s*\\\\\\.searchResponse\\s*\\)", label: "Recibe `\\.searchResponse`" },
            { pattern: "\\$0\\.detail\\s*=", label: "Afirma que se abre el detalle" },
          ],
          warnings: [
            { pattern: "exhaustivity\\s*=\\s*\\.off", label: "El reto pide un test exhaustivo" },
            { pattern: "Task\\.sleep", label: "No esperes tiempo real en tests" },
          ],
          solution: swift`import ComposableArchitecture
import Testing

@MainActor
struct MovieSearchFeatureTests {
    @Test
    func searchDebouncesAndOpensDetail() async {
        let movie = Movie(id: 1, title: "Batman", year: 1989)
        let clock = TestClock()
        let store = TestStore(initialState: MovieSearchFeature.State()) {
            MovieSearchFeature()
        } withDependencies: {
            $0.continuousClock = clock
            $0.movieClient.search = { _ in [movie] }
        }

        await store.send(.queryChanged("bat")) {
            $0.query = "bat"
            $0.isLoading = true
        }
        await clock.advance(by: .milliseconds(300))
        await store.receive(\.searchResponse) {
            $0.isLoading = false
            $0.movies = [movie]
        }
        await store.send(.movieTapped(1)) {
            $0.detail = MovieDetailFeature.State(movie: movie)
        }
    }
}`,
          hint: "Acordate de afirmar `isLoading` en el `send` y en el `receive`.",
        },
        {
          kind: "predict",
          prompt: "Otro test manda una consulta de un solo carácter con el estado inicial vacío. ¿Qué tiene que afirmar para pasar?",
          code: swift`await store.send(.queryChanged("b")) {
    // ???
}`,
          options: [
            "`$0.query = \"b\"` y después `receive(\\.searchResponse)` con resultados vacíos",
            "`$0.query = \"b\"` y `$0.isLoading = true`",
            "Nada: con menos de 2 caracteres el reducer ignora la acción",
            "Solo `$0.query = \"b\"`; no se recibe ninguna acción porque el efecto es `.cancel`",
          ],
          answer: 3,
          explanation: "Con menos de 2 caracteres el reducer guarda la query, deja `movies` vacío e `isLoading` en `false` (que ya lo estaban) y devuelve `.cancel(id:)`, que no manda acciones. El único cambio real es `query`. No hay `receive` y no queda ningún efecto en vuelo.",
        },
      ],
    },
  ],
  flashcards: [
    {
      id: "fc-three-parts",
      front: "¿Cuáles son las piezas de una feature de TCA?",
      back: "`State` (los datos), `Action` (todo lo que puede pasar), el reducer en `body` (cómo cambia el estado y qué efectos devuelve) y el `Store` que lo ejecuta.",
    },
    {
      id: "fc-reducer-macro",
      front: "¿Qué hace `@Reducer`?",
      back: "Genera la conformancia a `Reducer` y hace que `Action` sea `@CasePathable`, lo que habilita los key paths de case como `\\.child` en `Scope`, `.ifLet` y `receive`.",
    },
    {
      id: "fc-observable-state",
      front: "¿Para qué sirve `@ObservableState`?",
      back: "Hace observable el `State` (como `@Observable`): la vista lee `store.count` directo y solo se redibuja con lo que leyó. Reemplaza a `WithViewStore`.",
      code: "Text(\"\\(store.count)\")",
    },
    {
      id: "fc-effect-none",
      front: "¿Qué devuelve `Reduce` y qué significa `.none`?",
      back: "Un `Effect<Action>`. `.none` = no hay trabajo asíncrono; solo se aplica la mutación.",
    },
    {
      id: "fc-run",
      front: "¿Cómo vuelve el resultado de un `.run` al estado?",
      back: "Mandando una acción con `await send(.algoResponse(valor))`; el reducer la procesa y muta el estado.",
      code: "return .run { [id = state.id] send in\n    let user = try await api.user(id)\n    await send(.userResponse(user))\n}",
    },
    {
      id: "fc-capture-state",
      front: "¿Por qué no podés usar `state` dentro de `.run`?",
      back: "Es `inout` y la closure escapa. Capturá los valores: `[query = state.query]`.",
    },
    {
      id: "fc-cancel-in-flight",
      front: "¿Qué hace `cancelInFlight: true`?",
      back: "Al arrancar un efecto con ese id, cancela el que estaba corriendo con el mismo id. Base del debounce y de evitar respuestas viejas que pisen a las nuevas.",
    },
    {
      id: "fc-dependency-client",
      front: "¿Qué genera `@DependencyClient`?",
      back: "Un `init()` donde cada endpoint está sin implementar: si un test lo llama sin pisarlo, falla. Ideal como `testValue`.",
    },
    {
      id: "fc-binding",
      front: "Tres cosas para usar `$store.campo` en un `TextField`",
      back: "`Action: BindableAction` con `case binding(BindingAction<State>)`, `BindingReducer()` en el `body` y `@Bindable var store` en la vista.",
    },
    {
      id: "fc-scope",
      front: "¿Para qué sirve `Scope(state:action:)`?",
      back: "Corre el reducer de un hijo sobre una parte del estado y de las acciones del padre. En la vista, `store.scope(state:action:)` da el store hijo.",
    },
    {
      id: "fc-identified-array",
      front: "¿Por qué `IdentifiedArrayOf` y no `Array` para features hijas?",
      back: "Las acciones van por id, no por índice: si se borra una fila con un efecto en vuelo, el índice apuntaría a otra. Además el acceso por id es O(1).",
    },
    {
      id: "fc-presents",
      front: "¿Cómo se modela una sheet en TCA?",
      back: "Estado opcional con `@Presents`, acción `PresentationAction<Hijo.Action>` y `.ifLet(\\.$hijo, action: \\.hijo)`. Si es `nil`, está cerrada; al cerrarse se cancelan los efectos del hijo.",
    },
    {
      id: "fc-stack",
      front: "¿Qué piezas usa la navegación en pila?",
      back: "`@Reducer enum Path`, `StackState<Path.State>`, `StackActionOf<Path>` y `.forEach(\\.path, action: \\.path)`. Navegar = `state.path.append(...)`.",
    },
    {
      id: "fc-teststore",
      front: "¿Qué exige un `TestStore` exhaustivo?",
      back: "Afirmar cada cambio de estado, recibir cada acción de efectos con `receive` y que no quede ningún efecto corriendo al terminar.",
    },
    {
      id: "fc-testclock",
      front: "`TestClock` vs `ImmediateClock`",
      back: "`TestClock` avanza solo con `advance(by:)`: para probar debounce y timers. `ImmediateClock` termina toda espera al instante: cuando el tiempo no importa.",
    },
  ],
  exam: [
    {
      id: "ex-01",
      question: "Necesitás cargar el perfil al aparecer la pantalla. ¿Dónde va la llamada a la API en una feature de TCA?",
      options: [
        "En `.onAppear` de la vista, y después `store.send(.profileLoaded(profile))`",
        "En un `Task` dentro del reducer que muta `state` al terminar",
        "En un efecto `.run` devuelto por el reducer ante `.onAppear`, usando un client de `@Dependency` y mandando `.profileResponse`",
        "En el `init` del `State`",
      ],
      answer: 2,
      explanation: "El reducer devuelve el efecto y el resultado vuelve como acción. Así la lógica queda en el reducer, la dependencia se reemplaza en tests y el `TestStore` puede afirmar todo el flujo. Hacerlo en la vista saca lógica del reducer; un `Task` adentro no puede mutar el `inout`.",
    },
    {
      id: "ex-02",
      question: "Migrás una vista de TCA 1.0 que usaba `WithViewStore(store, observe: { $0 })`. Con `@ObservableState`, ¿cómo queda?",
      options: [
        "Se lee `store.count` directo y se manda `store.send(.x)`; ya no hace falta `WithViewStore`",
        "Hay que mantener `WithViewStore` pero sin `observe:`",
        "Se reemplaza por `@ObservedObject var viewStore`",
        "Se copia el estado a `@State` en `onAppear`",
      ],
      answer: 0,
      explanation: "Con `@ObservableState` el store expone el estado directo y la observación es por propiedad leída, como con `@Observable`. `WithViewStore` queda deprecado; copiar a `@State` duplica la fuente de verdad.",
    },
    {
      id: "ex-03",
      question: "Un `TextField(\"Email\", text: $store.email)` no compila. La feature tiene `case emailChanged(String)`. ¿Qué falta para usar bindings directos?",
      options: [
        "Marcar `email` con `@Published`",
        "Cambiar el store a `@ObservedObject`",
        "Usar `Binding(get:set:)` siempre; TCA no soporta `$store`",
        "`Action: BindableAction` con `case binding(BindingAction<State>)`, `BindingReducer()` en el `body` y `@Bindable var store` en la vista",
      ],
      answer: 3,
      explanation: "Esas tres piezas habilitan `$store.email`. `BindingReducer` escribe el valor y tu `Reduce` puede reaccionar con `case .binding(\\.email)`. `@Published` y `@ObservedObject` son del mundo `ObservableObject`, no de TCA 1.x.",
    },
    {
      id: "ex-04",
      question: "La búsqueda llama a la API en cada tecla y los resultados a veces \"saltan\" a una consulta vieja. ¿Qué cambio lo arregla?",
      options: [
        "Agregar `Task.sleep` en la vista antes de `send`",
        "Que el efecto espere con `clock.sleep` y sea `.cancellable(id: CancelID.search, cancelInFlight: true)`",
        "Guardar un `Bool isSearching` y descartar acciones mientras sea `true`",
        "Comparar `query` en `.searchResponse` y descartar si no coincide, sin cancelar nada",
      ],
      answer: 1,
      explanation: "Dormir con el reloj da el debounce y `cancelInFlight` cancela tanto las esperas como las requests en vuelo, así nunca llega una respuesta vieja. Comparar la query funciona a medias pero deja requests inútiles corriendo; `Task.sleep` en la vista no se puede testear.",
    },
    {
      id: "ex-05",
      question: "Un test nuevo falla con un error de endpoint sin implementar de `MovieClient.search`. El cliente usa `@DependencyClient` y `testValue = MovieClient()`. ¿Qué significa?",
      options: [
        "La feature llamó a `search` y el test no lo pisó en `withDependencies`",
        "Hay un bug en TCA y conviene usar `liveValue` en tests",
        "Falta `@MainActor` en el test",
        "El `TestClock` no avanzó lo suficiente",
      ],
      answer: 0,
      explanation: "Es el comportamiento buscado: cada endpoint del `testValue` está sin implementar y falla si se usa sin declararlo. Te obliga a explicitar qué dependencias toca el flujo. Se arregla con `$0.movieClient.search = { _ in [...] }`.",
    },
    {
      id: "ex-06",
      question: "Una lista de 200 `TodoFeature` usa `[TodoFeature.State]` y acciones por índice. Al borrar mientras un efecto de guardado está en vuelo, el resultado se aplica a otra fila. ¿Qué proponés?",
      options: [
        "Bloquear el borrado mientras haya efectos",
        "`IdentifiedArrayOf<TodoFeature.State>` con `IdentifiedActionOf<TodoFeature>` y `.forEach(\\.todos, action: \\.todos)`",
        "Usar un `Dictionary` y ordenar en la vista",
        "Recalcular el índice en cada acción con `firstIndex(where:)` en la vista",
      ],
      answer: 1,
      explanation: "Con `IdentifiedArray` las acciones llevan el id del elemento: aunque cambien las posiciones, la acción llega a la fila correcta (o se descarta si ya no existe). Es exactamente el problema para el que existe.",
    },
    {
      id: "ex-07",
      question: "Una pantalla tiene una sheet de edición, una alert de confirmación y un diálogo de compartir, cada uno con su `@Presents` opcional. QA reporta que se abrieron dos a la vez. ¿Qué refactor sugerís?",
      options: [
        "Agregar `guard` en cada acción para chequear los otros dos opcionales",
        "Pasar todo a `Bool`s en la vista",
        "Un `@Reducer enum Destination` con un `case` por destino, `@Presents var destination: Destination.State?` y `.ifLet(\\.$destination, action: \\.destination)`",
        "Usar `StackState` para todo",
      ],
      answer: 2,
      explanation: "Un enum opcional hace imposible por tipo tener dos destinos activos: solo hay un `case` a la vez. Es el patrón recomendado para múltiples destinos en una pantalla.",
    },
    {
      id: "ex-08",
      question: "Hay que soportar el deep link `app://contacts/42/edit` que abre la lista, el detalle del contacto 42 y la edición encima. Con navegación en pila de TCA, ¿cómo se resuelve?",
      options: [
        "Con `NavigationLink(isActive:)` en cada vista",
        "Mandando tres acciones de tap simulando al usuario con delays",
        "Guardando la URL en `UserDefaults` y leyéndola en cada pantalla",
        "Construyendo el estado: `state.path = StackState([.detail(...), .edit(...)])`, ya que la pila es solo estado",
      ],
      answer: 3,
      explanation: "Con `StackState` la navegación es datos: armar el estado equivale a navegar. Además es testeable con un `TestStore` sin tocar la UI. Simular taps con delays es frágil y `NavigationLink(isActive:)` está deprecado.",
    },
    {
      id: "ex-09",
      question: "Un test de un timer falla con \"an effect returned for this action is still running\" al final. ¿Cuál es el arreglo correcto?",
      options: [
        "Poner `store.exhaustivity = .off`",
        "Mandar la acción que detiene el timer (o avanzar el reloj hasta que el efecto termine) antes de que termine el test",
        "Agregar `try await Task.sleep(for: .seconds(1))` al final",
        "Borrar el `.cancellable(id:)` del efecto",
      ],
      answer: 1,
      explanation: "El `TestStore` exige que el test cubra todo el ciclo de vida de los efectos. Detener el timer como lo haría el usuario es lo correcto y además prueba la cancelación. Apagar la exhaustividad esconde el problema y dormir de verdad hace el test lento.",
    },
    {
      id: "ex-10",
      question: "Querés un test del flujo login → home que cruza cuatro features. Afirmar cada `isLoading` intermedio vuelve el test frágil. ¿Qué hacés?",
      options: [
        "Usar `store.exhaustivity = .off`, mandar las acciones clave y afirmar solo el estado final que importa",
        "Escribir un UI test en su lugar",
        "Testear solo cada feature por separado y no el flujo",
        "Mockear el `Store` completo",
      ],
      answer: 0,
      explanation: "El modo no exhaustivo existe para tests de integración: verificás el resultado de negocio sin acoplarte a detalles internos. Los tests unitarios de cada feature siguen siendo exhaustivos.",
    },
    {
      id: "ex-11",
      question: "En el `body` del padre el `Reduce` está antes del `Scope` del hijo. El padre, ante `.child(.saveTapped)`, lee `state.child.draft` para guardarlo, pero guarda el valor anterior. ¿Por qué?",
      options: [
        "Porque `Scope` copia el estado y los cambios del hijo nunca llegan al padre",
        "Porque las acciones del hijo no llegan al `Reduce` del padre",
        "Es un bug de TCA: hay que usar `.ifLet`",
        "Porque los reducers corren en orden: el padre corre antes que el hijo y todavía no ve su actualización",
      ],
      answer: 3,
      explanation: "Los reducers del `body` se ejecutan de arriba hacia abajo sobre el mismo estado. Moviendo el `Scope` arriba del `Reduce`, el padre ve el estado del hijo ya actualizado.",
    },
    {
      id: "ex-12",
      question: "En una entrevista te preguntan cuándo **no** usarías TCA. ¿Qué respuesta muestra criterio senior?",
      options: [
        "Nunca: TCA escala siempre mejor que cualquier alternativa",
        "Solo cuando la app no tiene tests",
        "En apps chicas o CRUD, o con un equipo sin tiempo para la curva de aprendizaje: ahí MVVM con `@Observable` e inyección por `init` da testabilidad con menos ceremonia y sin atarte a una librería externa",
        "Cuando la app usa UIKit, porque TCA es solo para SwiftUI",
      ],
      answer: 2,
      explanation: "Una respuesta senior habla de costos: curva de aprendizaje, ceremonia, tiempos de compilación y dependencia externa frente a predictibilidad, composición y tests exhaustivos. TCA también funciona con UIKit, así que esa no es la razón.",
    },
  ],
};

export default content;
