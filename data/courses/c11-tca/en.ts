import type { CourseContent } from "../types";

// Swift code uses String.raw so the backslashes in `\(...)` and `\.keyPath` survive.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    {
      id: "unidirectional-flow",
      title: "Unidirectional data flow from scratch",
      goal: "Build a `Store` by hand with state, actions and a reducer to understand what TCA solves, why it is so testable and what it costs.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "State, action and reducer",
          body: [
            "The core idea behind TCA (The Composable Architecture) is old and simple: all of a screen's state lives in **a single value** (`State`), the only things that can happen are **actions** (`Action`, an `enum`), and one function, the **reducer**, decides how the state changes for each action.",
            "The reducer takes the state as `inout` plus the action. It doesn't hit the network, read the clock or touch the UI: it only mutates state. So with the same state and the same action, the result is always the same.",
            "Before importing any library, build it in plain Swift. This is all TCA does at its heart.",
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
          explanation: "They apply in order: 3 → 4 → 5, then `.reset` sets it to 0 and `.decrement` to -1. The final state depends only on the initial state and the sequence of actions: that's why you can reproduce a bug from the exact list of actions that caused it.",
        },
        {
          kind: "explain",
          title: "A 20-line `Store`",
          body: [
            "The `Store` owns the state. The view can do exactly two things: **read** `store.state` and **send** actions with `store.send(_:)`. Nobody else mutates the state, which is why it's `private(set)`.",
            "With `@Observable` (iOS 17; previously `ObservableObject` + `@Published`) SwiftUI re-renders when something the view read changes. And since everything goes through `send`, you get a single place to log every action: debugging becomes reading the log.",
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
          prompt: "Fill in the modifier so the view can read `state` but only the `Store` can mutate it.",
          code: swift`final class Store<State, Action> {
    ____ var state: State
    // ...
}`,
          accept: ["^private\\(set\\)$", "^fileprivate\\(set\\)$"],
          explanation: "`private(set)` keeps the getter at the type's access level and makes the setter private. It's the core guarantee of unidirectional flow: the only way to change state is `send(_:)` → reducer.",
          hint: "It's the access modifier that applies only to the setter.",
          placeholder: "modifier",
        },
        {
          kind: "explain",
          title: "What you gain and what you pay",
          body: [
            "**You gain**: predictable state (a single source of truth), reducers you test by calling a pure function, a log of everything that happened, and features that compose like building blocks, because a big reducer is the sum of small ones.",
            "**You pay**: more ceremony (every interaction is a `case`), a learning curve for the team, a significant third-party dependency (TCA is by Point-Free) and overhead if you send actions at high frequency, like on every scroll frame.",
            "One piece is missing: effects (network, timers, disk). If the reducer is pure, where do they go? TCA's answer is `Effect`: the reducer **returns a description** of the async work and the `Store` runs it. That's what the next lessons cover.",
          ],
          code: swift`// Testing a pure reducer: no mocks, no waiting
var state = CounterState(count: 5)
reduce(&state, .reset)
assert(state == CounterState(count: 0))
print("ok")`,
          output: "ok",
        },
        {
          kind: "predict",
          prompt: "A teammate wants to load data from the homemade reducer. What's wrong with this design?",
          code: swift`func reduce(_ state: inout FeedState, _ action: FeedAction) {
    switch action {
    case .onAppear:
        Task {
            let posts = try await api.fetchPosts()
            // and now how do I update state?
        }
    }
}`,
          options: [
            "Nothing: `Task` is the right way to do async work inside a reducer",
            "Only that the function is missing `@MainActor`",
            "The reducer stops being pure and the `Task` can't mutate `state` (it's `inout`): the result has to come back as another action",
            "`api.fetchPosts()` should be synchronous",
          ],
          answer: 2,
          explanation: "An `inout` parameter can't be captured by an escaping closure like the `Task`'s, so you can't even write the result. On top of that the reducer now fires uncontrolled, untestable work. The fix is for the reducer to return an effect and for the result to come back in as an action, e.g. `.postsLoaded(posts)`.",
        },
        {
          kind: "write",
          prompt: "Write `func reduce(_ state: inout TodoState, _ action: TodoAction)`. `draftChanged` stores the text in `draft`; `addTapped` appends `draft` to `items` only if it's not empty and then clears it; `clearTapped` empties `items`.",
          starter: swift`struct TodoState: Equatable {
    var items: [String] = []
    var draft = ""
}

enum TodoAction {
    case draftChanged(String)
    case addTapped
    case clearTapped
}

// Write reduce(_:_:)
`,
          checks: [
            { pattern: "func\\s+reduce\\s*\\(\\s*_\\s+state\\s*:\\s*inout\\s+TodoState", label: "Takes the state as `inout`" },
            { pattern: "switch\\s+action", label: "Switches over the action" },
            { pattern: "case\\s+(let\\s+)?\\.draftChanged", label: "Handles `.draftChanged`" },
            { pattern: "isEmpty", label: "Doesn't append empty drafts" },
            { pattern: "append\\(\\s*state\\.draft\\s*\\)", label: "Appends `state.draft` to `items`" },
            { pattern: "state\\.draft\\s*=\\s*\"\"", label: "Clears the draft after appending" },
          ],
          warnings: [
            { pattern: "URLSession|DispatchQueue|Task\\s*\\{", label: "Side effects inside the reducer: it must stay pure" },
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
          hint: "A `guard !state.draft.isEmpty else { return }` in `.addTapped` handles the empty case.",
        },
      ],
    },
    {
      id: "first-feature",
      title: "First feature with `@Reducer`",
      goal: "Write a TCA 1.x feature with `@Reducer`, `@ObservableState`, `Reduce` and `Store`, hook it up to SwiftUI and handle bindings with `BindableAction`.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Anatomy of a feature",
          body: [
            "In TCA a feature is a `struct` annotated with `@Reducer`. Inside it has `State` (with `@ObservableState` so SwiftUI can observe it), `Action` (an `enum`) and `body`, where you declare the logic with `Reduce { state, action in ... }`.",
            "The difference from the homemade reducer: the closure **returns an `Effect<Action>`**. When there's no async work you return `.none`. That keeps the reducer pure: it describes the effect, it doesn't run it.",
            "A Point-Free convention worth following: name actions after **what happened** in the UI (`incrementButtonTapped`), not what you want done (`incrementCount`). The logic stays in the reducer, not the view.",
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
          prompt: "This action doesn't trigger any async work. Fill in what it returns.",
          code: swift`case .resetButtonTapped:
    state.count = 0
    return ____`,
          accept: ["^\\.none$"],
          explanation: "`Reduce` returns an `Effect<Action>`. `.none` is the empty effect: the store applies the mutation and runs nothing else.",
          hint: "It's the effect that does nothing.",
          placeholder: "effect",
        },
        {
          kind: "predict",
          prompt: "In code review you see these four options for the \"+\" button's action. Which one follows TCA conventions?",
          code: swift`Button("+") { store.send(/* ??? */) }`,
          options: [
            "`.setCount(store.count + 1)`",
            "`.incrementCount`",
            "`.updateState`",
            "`.incrementButtonTapped`",
          ],
          answer: 3,
          explanation: "Naming by event (`...ButtonTapped`, `onAppear`, `...Response`) keeps the logic in the reducer. `.setCount(store.count + 1)` computes in the view, `.incrementCount` is a command and `.updateState` says nothing. An action log of real events is far more useful when chasing a bug.",
        },
        {
          kind: "explain",
          title: "`Store` and the view",
          body: [
            "The view takes a `StoreOf<CounterFeature>` (alias for `Store<CounterFeature.State, CounterFeature.Action>`). Thanks to `@ObservableState` it reads state directly, `store.count`, and SwiftUI only re-renders when something the view read changes. If you're coming from pre-1.7 TCA code, this replaces `WithViewStore` and `viewStore`.",
            "To change anything, `store.send(.something)`. The store's state is read-only from the outside: there's no way to write `store.count = 5`.",
            "The root store is created once, outside `body`: in the `App`, as a `static let` or injected. If you create it inside `body` it gets recreated on every render and you lose the state.",
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
          prompt: "What happens with this button?",
          code: swift`Button("Reset") {
    store.count = 0
}`,
          options: [
            "It compiles and sets the counter to 0",
            "It doesn't compile: the store's state is read-only; you have to send an action",
            "It compiles but crashes at runtime",
            "It compiles, but the view doesn't re-render",
          ],
          answer: 1,
          explanation: "The store exposes state through read-only access. The only way to mutate it is `store.send(.resetButtonTapped)` and let the reducer make the change. It's the same guarantee as the homemade store's `private(set)`.",
        },
        {
          kind: "explain",
          title: "Bindings: `BindableAction` and `BindingReducer`",
          body: [
            "A `TextField` or `Toggle` needs a `Binding`. To avoid one action per field, make `Action` conform to `BindableAction` with `case binding(BindingAction<State>)`, add `BindingReducer()` to `body` and mark the view's store with `@Bindable`. Then `$store.username` just works.",
            "`BindingReducer()` goes **before** `Reduce`: it applies the new value first and then your logic can react. To react to a specific field you match `case .binding(\\.username):`.",
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
            TextField("Username", text: $store.username)
            Toggle("Notifications", isOn: $store.notificationsOn)
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the reducer that applies binding changes to the state.",
          code: swift`var body: some ReducerOf<Self> {
    ____()
    Reduce { state, action in
        // ...
    }
}`,
          accept: ["^BindingReducer$"],
          explanation: "`BindingReducer()` takes each `.binding(...)` and writes the value into the state. Without it the `TextField` sends the action but the state doesn't change and the field \"snaps back\".",
          hint: "It's a reducer that ships with TCA and is named after the action.",
          placeholder: "reducer",
        },
        {
          kind: "write",
          prompt: "Write the full `ProfileFeature`: an observable, `Equatable` `State` with `name` (`String`) and `isPublic` (`Bool`), a bindable `Action`, and a `body` with `BindingReducer()` and a `Reduce` that returns `.none`.",
          starter: swift`import ComposableArchitecture

@Reducer
struct ProfileFeature {
    // State with name and isPublic
    // Bindable Action
    // body
}
`,
          checks: [
            { pattern: "@ObservableState", label: "`State` with `@ObservableState`" },
            { pattern: "struct\\s+State\\s*:\\s*Equatable", label: "`State` conforms to `Equatable`" },
            { pattern: "enum\\s+Action\\s*:\\s*BindableAction", label: "`Action` conforms to `BindableAction`" },
            { pattern: "case\\s+binding\\s*\\(\\s*BindingAction<State>\\s*\\)", label: "Has `case binding(BindingAction<State>)`" },
            { pattern: "BindingReducer\\s*\\(\\s*\\)", label: "Uses `BindingReducer()`" },
            { pattern: "return\\s+\\.none", label: "`Reduce` returns `.none`" },
          ],
          warnings: [
            { pattern: "@State\\s+(private\\s+)?var|@Published", label: "State outside the store: everything goes in `State`" },
            { pattern: "Reduce\\s*\\{[\\s\\S]*BindingReducer", label: "`BindingReducer()` goes before `Reduce`" },
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
          hint: "Copy the shape of `SettingsFeature` and keep only `case binding`.",
        },
      ],
    },
    {
      id: "effects-dependencies",
      title: "Effects and dependencies",
      goal: "Kick off async work with `.run`, feed results back as actions, cancel, debounce with the clock and define dependencies with live and test values.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "`.run`: effects that send actions back",
          body: [
            "For async work the reducer returns `.run { send in ... }`. Inside you can use `async/await` freely; once you have the result, send it back with `await send(.somethingResponse(...))` and the reducer handles it like any other action.",
            "The closure escapes, so you **can't capture `state`** (it's `inout`). Capture the values you need in the capture list: `[count = state.count]`.",
            "If the effect can throw, use the `catch:` variant or a `do/catch` inside and send an error action. An unhandled error in `.run` is reported as a runtime warning in debug builds.",
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
          prompt: "What happens with this effect?",
          code: swift`case .factButtonTapped:
    return .run { send in
        let fact = try await fetchFact(state.count)
        await send(.factResponse(fact))
    }`,
          options: [
            "It doesn't compile: the closure escapes and can't capture the `inout` parameter `state`",
            "It compiles and uses `count` as of when the effect runs",
            "It compiles but crashes if `count` changed in the meantime",
            "It compiles; TCA copies `state` automatically",
          ],
          answer: 0,
          explanation: "Swift doesn't allow capturing an `inout` in an escaping closure. The fix is to capture the value: `.run { [count = state.count] send in ... }`. As a bonus it makes explicit which data the effect uses.",
        },
        {
          kind: "explain",
          title: "Dependencies: `@Dependency` and a client",
          body: [
            "`URLSession.shared` inside the effect makes the feature impossible to test without a network. TCA uses the swift-dependencies library: you declare `@Dependency(\\.numberFact) var numberFact` in the reducer and override it in tests.",
            "A client is a `struct` of closures. With `@DependencyClient` the macro generates an `init()` where every endpoint is **unimplemented**: if a test calls it without overriding it, the test fails. You conform to `DependencyKey` with a `liveValue` (the real one) and a `testValue`, and register it in `DependencyValues`.",
            "Some come built in: `\\.continuousClock`, `\\.uuid`, `\\.date`, `\\.mainQueue`, `\\.dismiss`.",
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

// In FactFeature:
@Dependency(\.numberFact) var numberFact

// ...
return .run { [count = state.count] send in
    let fact = try await numberFact.fetch(count)
    await send(.factResponse(fact))
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the built-in clock dependency TCA gives you for waiting, debouncing or timers.",
          code: swift`@Dependency(\.____) var clock`,
          accept: ["^continuousClock$", "^suspendingClock$"],
          explanation: "`\\.continuousClock` gives you an `any Clock<Duration>`. In the app it's the real clock; in tests you replace it with a `TestClock` (you advance time manually) or an `ImmediateClock` (no waiting at all).",
          hint: "It's the Swift `Clock` that keeps counting while the device sleeps.",
          placeholder: "key path",
        },
        {
          kind: "explain",
          title: "Cancellation and debounce",
          body: [
            "Any effect can be marked `.cancellable(id:)`. With `cancelInFlight: true`, starting a new one with the same id cancels the previous one. `.cancel(id:)` stops it from another action.",
            "Debounce without special operators: the effect first **sleeps** on the clock and then searches. If the user types again before the wait is over, `cancelInFlight` kills the old effect and it never gets to make a request.",
            "Use an `enum CancelID` as the id: it's hashable and won't collide with other ids.",
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
    @Dependency(\.searchClient) var searchClient  // defined like NumberFactClient

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
          prompt: "The user types \"s\", \"sw\" and \"swi\" 100 ms apart and then waits. How many times is `searchClient.search` called?",
          code: swift`// t = 0 ms    queryChanged("s")
// t = 100 ms  queryChanged("sw")
// t = 200 ms  queryChanged("swi")
// ...waits
return .run { send in
    try await clock.sleep(for: .milliseconds(300))
    let results = try await searchClient.search(query)
    await send(.searchResponse(results))
}
.cancellable(id: CancelID.search, cancelInFlight: true)`,
          options: [
            "3 times, once per keystroke",
            "Once, with \"s\"",
            "Once, with \"swi\"",
            "Never: cancellation stops everything",
          ],
          answer: 2,
          explanation: "Each `queryChanged` starts an effect with the same id and `cancelInFlight: true` cancels the previous one while it's still in `clock.sleep`. Only the last one (\"swi\") completes the 300 ms and gets to search. That's a debounce.",
        },
        {
          kind: "write",
          prompt: "Finish `TimerFeature`: when the button is tapped, if the timer is now running start an effect that sends `.timerTick` every second using the clock dependency and make it cancellable with `CancelID.timer`; if it's now stopped, cancel it.",
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
                // start or cancel the timer
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
            { pattern: "@Dependency\\(\\\\\\.continuousClock\\)\\s+var\\s+clock", label: "Declares `@Dependency(\\.continuousClock) var clock`" },
            { pattern: "clock\\.sleep\\(for:", label: "Waits with `clock.sleep(for:)`" },
            { pattern: "await\\s+send\\(\\s*\\.timerTick\\s*\\)", label: "Sends `.timerTick` from the effect" },
            { pattern: "\\.cancellable\\(\\s*id:\\s*CancelID\\.timer", label: "Marks the effect `.cancellable(id: CancelID.timer)`" },
            { pattern: "\\.cancel\\(\\s*id:\\s*CancelID\\.timer\\s*\\)", label: "Stops it with `.cancel(id: CancelID.timer)`" },
          ],
          warnings: [
            { pattern: "Task\\.sleep|Timer\\.scheduledTimer|DispatchQueue", label: "Uncontrolled time: use the clock dependency" },
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
          hint: "A `while true` loop with `try await clock.sleep(for: .seconds(1))` and `await send(.timerTick)` inside `.run`.",
        },
      ],
    },
    {
      id: "composition-navigation",
      title: "Composition and navigation",
      goal: "Compose child features with `Scope`, collections with `IdentifiedArray` and `.forEach`, sheets with `@Presents` + `.ifLet` and stack navigation with `StackState`.",
      minutes: 24,
      steps: [
        {
          kind: "explain",
          title: "`Scope`: one feature inside another",
          body: [
            "The \"C\" in TCA is composition. The parent holds the child's state in its `State`, wraps the child's actions in a `case`, and in `body` uses `Scope(state:action:)` to run the child reducer on that slice.",
            "`@Reducer` makes `Action` `@CasePathable`, which is why you can write `action: \\.tab1` as if it were a key path. In the view, `store.scope(state: \\.tab1, action: \\.tab1)` gives you a `StoreOf<CounterFeature>` for the child view.",
            "Order matters: the reducers in `body` run top to bottom. If the `Scope` comes before the parent's `Reduce`, the parent sees the child's state **already updated**.",
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
            // the parent can react to child actions
            return .none
        }
    }
}

// In the view
CounterView(store: store.scope(state: \.tab1, action: \.tab1))`,
        },
        {
          kind: "predict",
          prompt: "You start with `tab1.count = 0` and `tab2.count = 5` and send `.tab1(.incrementButtonTapped)`. What's the resulting state?",
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
          explanation: "The `Scope` runs first: the child increments and `tab1.count` becomes 1. Then the parent's `Reduce` runs, sees the action and adds `tab1.count` (already 1) to `tab2.count`: 5 + 1 = 6. If the `Reduce` were above the `Scope`, it would add 0.",
        },
        {
          kind: "explain",
          title: "Collections: `IdentifiedArray` and `.forEach`",
          body: [
            "For a list of child features you use `IdentifiedArrayOf<Child.State>` (the elements are `Identifiable`) and an action `case todos(IdentifiedActionOf<TodoFeature>)`. In `body`, `.forEach(\\.todos, action: \\.todos) { TodoFeature() }` runs the child reducer on the right element.",
            "Why not an `Array`? Because actions are addressed **by id, not by index**. If you delete a row while another row's effect is in flight, an index would point to the wrong row; an id won't. Plus `state.todos[id: id]` is O(1).",
            "Generate ids with `@Dependency(\\.uuid)`: it's deterministic in tests.",
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

// In the view
ForEach(store.scope(state: \.todos, action: \.todos)) { todoStore in
    TodoRow(store: todoStore)
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the collection type TCA recommends for lists of child features.",
          code: swift`var todos: ____<TodoFeature.State> = []`,
          accept: ["^IdentifiedArrayOf$"],
          explanation: "`IdentifiedArrayOf<Element>` is an `IdentifiedArray` keyed by `Element.ID`. It behaves like an array (order, `[]` literals) but is accessed by id, which is what `.forEach` needs.",
          hint: "It comes from swift-identified-collections and ends in `Of`.",
          placeholder: "type",
        },
        {
          kind: "explain",
          title: "Sheets and alerts: `@Presents` + `.ifLet`",
          body: [
            "Navigation is modeled as state: a sheet is open when its optional state isn't `nil`. You mark the property with `@Presents`, the action is `case addContact(PresentationAction<AddContactFeature.Action>)`, and in `body` you add `.ifLet(\\.$addContact, action: \\.addContact) { AddContactFeature() }`.",
            "`.ifLet` runs the child reducer only while there's state and, when it becomes `nil`, **cancels the child's effects**. The child can dismiss itself with `@Dependency(\\.dismiss)`. The parent hears what happens inside via `case .addContact(.presented(.saveButtonTapped))`.",
            "If a screen has several destinations (a sheet, an alert, a confirmation dialog), group them in a `@Reducer enum Destination` with `@Presents var destination: Destination.State?` and `.ifLet(\\.$destination, action: \\.destination)`: that makes it impossible to have two open at once.",
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

// In the view (with @Bindable var store)
.sheet(item: $store.scope(state: \.addContact, action: \.addContact)) { addStore in
    NavigationStack {
        AddContactView(store: addStore)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The `AddContactFeature` sheet has a `.run` effect validating the contact against the backend. The user swipes the sheet down. What happens to that effect?",
          code: swift`.ifLet(\.$addContact, action: \.addContact) {
    AddContactFeature()
}`,
          options: [
            "`.ifLet` cancels it automatically because the child state became `nil`",
            "It keeps running and its response crashes because the state no longer exists",
            "It runs to completion and its action is still applied to the child",
            "You have to cancel it manually with `.cancel(id:)` in the parent",
          ],
          answer: 0,
          explanation: "On swipe, the sheet's binding sets `addContact` to `nil` (by sending `.dismiss`). `.ifLet` sees the child is gone and cancels its in-flight effects. That's one of the perks of modeling navigation as state: effect lifetimes are tied to the screen's.",
        },
        {
          kind: "explain",
          title: "Stack navigation: `StackState`",
          body: [
            "For `NavigationStack` you define a `@Reducer enum Path` with one `case` per possible screen. The parent holds `var path = StackState<Path.State>()`, the action `case path(StackActionOf<Path>)`, and in `body` `.forEach(\\.path, action: \\.path)`.",
            "Navigating is mutating state: `state.path.append(.detail(...))` pushes, `state.path.removeLast()` pops. That makes any deep link testable and restorable.",
            "In the view, `NavigationStack(path: $store.scope(state: \\.path, action: \\.path))`, and in `destination:` you `switch store.case` to pick the view.",
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

// In the view (with @Bindable var store)
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
          prompt: "Finish `ParentFeature`: run `ProfileFeature` on `state.profile` with `Scope`, add an optional `edit` sheet of type `EditFeature.State` with `@Presents`, its action with `PresentationAction`, open it on `.editButtonTapped` with `EditFeature.State(name: state.profile.name)` and integrate it with `.ifLet`.",
          starter: swift`@Reducer
struct ParentFeature {
    @ObservableState
    struct State: Equatable {
        var profile = ProfileFeature.State()
        // edit sheet
    }

    enum Action {
        case profile(ProfileFeature.Action)
        case editButtonTapped
        // sheet action
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
            { pattern: "state\\.edit\\s*=\\s*EditFeature\\.State\\(", label: "Opens the sheet by assigning its state" },
            { pattern: "\\.ifLet\\(\\s*\\\\\\.\\$edit\\s*,\\s*action:\\s*\\\\\\.edit\\s*\\)", label: "`.ifLet(\\.$edit, action: \\.edit)`" },
          ],
          warnings: [
            { pattern: "\\.ifLet\\(\\s*\\\\\\.edit\\b", label: "`.ifLet` is missing the `$`: it's `\\.$edit`" },
            { pattern: "isEditPresented|showEdit", label: "A separate `Bool` duplicates state: use the optional" },
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
          hint: "The `Scope` goes above the `Reduce`; `.ifLet` is chained onto the `Reduce`.",
        },
      ],
    },
    {
      id: "teststore",
      title: "Testing with `TestStore`",
      goal: "Write exhaustive tests with `TestStore`, receive actions from effects, control dependencies and time, use non-exhaustive mode and decide when TCA is worth it.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "`TestStore`: exhaustive by default",
          body: [
            "You create a `TestStore` just like a `Store`. Each `await store.send(.action) { ... }` hands the closure the **previous** state as `inout`: you mutate it into what you expect and the test compares it against the real state. If they differ, it fails with a diff.",
            "It's **exhaustive**: you must assert every state change, receive every action effects send back, and when the test ends no effect may still be running. Miss anything and the test fails. It's demanding, but a refactor that changes behavior can't slip through.",
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
          prompt: "`.factButtonTapped` sets `isLoading = true` and starts an effect. The test does this and ends. What happens?",
          code: swift`let store = TestStore(initialState: FactFeature.State()) {
    FactFeature()
} withDependencies: {
    $0.numberFact.fetch = { "\($0) is a good number." }
}

await store.send(.factButtonTapped)`,
          options: [
            "It passes: there was nothing to assert",
            "It passes with a warning about the effect",
            "It fails only because the effect is still running",
            "It fails: the `isLoading` change wasn't asserted and `.factResponse` was never received",
          ],
          answer: 3,
          explanation: "With no closure, `TestStore` expects the state not to change, but `isLoading` did: it fails with a diff. The effect also sends `.factResponse` and the test ends without `receive`: second failure. Exhaustive mode forces you to describe everything that happens.",
        },
        {
          kind: "explain",
          title: "`receive` and `withDependencies`",
          body: [
            "Actions sent by effects are asserted with `await store.receive(\\.factResponse) { ... }`: the case key path identifies the action and the closure asserts the state change it produces.",
            "In the `withDependencies:` trailing closure you override dependencies for this test. Since `testValue` is unimplemented, any endpoint the feature uses that you didn't override fails the test: no hidden real calls.",
          ],
          code: swift`@Test
func fetchFact() async {
    let store = TestStore(initialState: FactFeature.State()) {
        FactFeature()
    } withDependencies: {
        $0.numberFact.fetch = { "\($0) is a good number." }
    }

    await store.send(.factButtonTapped) {
        $0.isLoading = true
    }
    await store.receive(\.factResponse) {
        $0.isLoading = false
        $0.fact = "0 is a good number."
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the method that asserts an action coming back from an effect.",
          code: swift`await store.____(\.factResponse) {
    $0.isLoading = false
    $0.fact = "0 is a good number."
}`,
          accept: ["^receive$"],
          explanation: "`send` is for actions the test sends (like the user would); `receive` is for actions effects send. `receive` waits for the action to arrive, so it works with async effects.",
          hint: "The opposite of `send`.",
          placeholder: "method",
        },
        {
          kind: "explain",
          title: "Controlling time: `TestClock`",
          body: [
            "A 300 ms debounce shouldn't make the test wait 300 ms. With `TestClock` time **only moves when you say so**: `await clock.advance(by: .milliseconds(300))`. The test runs instantly and deterministically.",
            "If timing doesn't matter (say, an animation delay), `ImmediateClock()` makes every wait finish instantly.",
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
          prompt: "Same search test, but the clock only advances 200 ms and the test ends. What happens?",
          code: swift`await store.send(.queryChanged("Sw")) {
    $0.query = "Sw"
}
await clock.advance(by: .milliseconds(200))
// end of test`,
          options: [
            "It passes: the search never got to run",
            "It fails: the effect is still in flight (sleeping on the clock) when the test ends",
            "It fails because `receive` is mandatory after `advance`",
            "It hangs waiting for the remaining 100 ms",
          ],
          answer: 1,
          explanation: "The effect is still suspended in `clock.sleep`, waiting for 100 more ms that never come. An exhaustive `TestStore` requires no effects to be running at the end, so it fails. To fix it, advance the full 300 ms and receive the response, or explicitly test the cancellation.",
        },
        {
          kind: "explain",
          title: "Non-exhaustive mode and when to pick TCA",
          body: [
            "In integration tests (a flow spanning several features) asserting every detail is noise. With `store.exhaustivity = .off` you assert only what you care about; `skipReceivedActions()` discards received actions and `store.assert { ... }` checks the final state. Use it for big flows, not as a shortcut in unit tests.",
            "When is TCA worth it? Screens with lots of shared state, many effects that cancel each other, complex navigation, and a team that wants strong conventions and exhaustive tests. When isn't it? Small or CRUD apps, teams without time for the learning curve, or when macro compile times and depending on an external library outweigh the benefits. MVVM with `@Observable` and `init` injection covers those cases very well.",
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
          prompt: "Team of 3 devs, an internal CRUD forms app with four screens, shipping in six weeks. Nobody has used TCA. What do you recommend?",
          code: swift`// Screens: Login, List, Detail, Edit
// No complex shared state, no real-time`,
          options: [
            "MVVM with `@Observable` and `init` injection: less ceremony and testable without learning a new library",
            "TCA on every screen so it scales from day one",
            "MVC with all logic in the view controllers",
            "VIPER to separate responsibilities as much as possible",
          ],
          answer: 0,
          explanation: "TCA shines with complex state and interacting effects; here the learning cost and ceremony won't pay off in six weeks. MVVM with `@Observable` and injected dependencies is testable and simple. VIPER adds even more files and massive MVC makes testing harder. Choosing an architecture is choosing costs.",
        },
        {
          kind: "write",
          prompt: "Write an exhaustive test for `TimerFeature` (previous lesson): use a `TestClock`, start the timer, advance 1 second, receive `.timerTick` with `count = 1` and stop the timer so no effect is left running.",
          starter: swift`import ComposableArchitecture
import Testing

@MainActor
struct TimerFeatureTests {
    @Test
    func timerTicks() async {
        // TestStore with a controlled clock
    }
}
`,
          checks: [
            { pattern: "let\\s+clock\\s*=\\s*TestClock\\(\\)", label: "Creates a `TestClock()`" },
            { pattern: "TestStore\\(initialState:\\s*TimerFeature\\.State\\(\\)\\)", label: "Creates the `TestStore`" },
            { pattern: "\\$0\\.continuousClock\\s*=\\s*clock", label: "Injects the clock via `withDependencies`" },
            { pattern: "await\\s+clock\\.advance\\(by:", label: "Advances the clock" },
            { pattern: "await\\s+store\\.receive\\(\\s*\\\\\\.timerTick\\s*\\)", label: "Receives `\\.timerTick`" },
            { pattern: "isTimerRunning\\s*=\\s*false", label: "Stops the timer at the end" },
          ],
          warnings: [
            { pattern: "Task\\.sleep", label: "Real sleeping makes the test slow and flaky" },
            { pattern: "exhaustivity\\s*=\\s*\\.off", label: "This test should be exhaustive" },
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
          hint: "The second `.toggleTimerButtonTapped` cancels the effect and sets `isTimerRunning` back to `false`.",
        },
      ],
    },
    {
      id: "final-challenge",
      title: "Final challenge: movie search",
      goal: "Bring the whole course together: state and actions, a cancellable debounce, an injectable dependency, a detail sheet with `@Presents` and exhaustive `TestStore` tests.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "Product wants a movie search: (1) with fewer than 2 characters, results are cleared and any search is cancelled; (2) with 2 or more, wait 300 ms without typing (debounce) and call the API; (3) a new search cancels the previous one; (4) if the API fails, show `errorMessage`; (5) tapping a movie opens a sheet with its detail.",
            "You already have the model, the client and the detail feature. What's missing is `MovieSearchFeature` and its tests. Everything exhaustive, no network and no real waiting.",
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
        // URLSession + JSONDecoder against the real API
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
          prompt: "Step 1: write `State` and `Action` for `MovieSearchFeature`. `State` (observable, `Equatable`): `query`, `movies` as an identified collection, `isLoading`, an optional `errorMessage` and the `detail` sheet with `@Presents`. `Action`: `queryChanged(String)`, `searchResponse([Movie])`, `searchFailed(String)`, `movieTapped(Movie.ID)` and the sheet's action.",
          starter: swift`@Reducer
struct MovieSearchFeature {
    // State and Action
}
`,
          checks: [
            { pattern: "@ObservableState", label: "`State` with `@ObservableState`" },
            { pattern: "IdentifiedArrayOf<Movie>", label: "`movies` is an `IdentifiedArrayOf<Movie>`" },
            { pattern: "@Presents\\s+var\\s+detail\\s*:\\s*MovieDetailFeature\\.State\\?", label: "`@Presents var detail: MovieDetailFeature.State?`" },
            { pattern: "case\\s+searchResponse\\(\\s*\\[Movie\\]\\s*\\)", label: "`case searchResponse([Movie])`" },
            { pattern: "case\\s+movieTapped\\(", label: "`case movieTapped(...)`" },
            { pattern: "case\\s+detail\\(\\s*PresentationAction<MovieDetailFeature\\.Action>\\s*\\)", label: "`case detail(PresentationAction<MovieDetailFeature.Action>)`" },
          ],
          warnings: [
            { pattern: "var\\s+movies\\s*:\\s*\\[Movie\\]", label: "Use `IdentifiedArrayOf<Movie>` instead of `[Movie]`" },
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
          hint: "Look at `ContactsFeature` for the `@Presents` and `PresentationAction` part.",
        },
        {
          kind: "write",
          prompt: "Step 2: write the `body`. Declare the clock and `movieClient` dependencies; in `queryChanged` apply rules 1 to 4 (300 ms debounce with `clock.sleep`, `.cancellable(id: CancelID.search, cancelInFlight: true)`, `.cancel(id:)` for short queries); in `movieTapped` open the detail; integrate the sheet with `.ifLet`.",
          starter: swift`@Reducer
struct MovieSearchFeature {
    // State and Action from the previous step

    enum CancelID { case search }

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            // your logic
            return .none
        }
    }
}
`,
          checks: [
            { pattern: "@Dependency\\(\\\\\\.continuousClock\\)", label: "Depends on `\\.continuousClock`" },
            { pattern: "@Dependency\\(\\\\\\.movieClient\\)", label: "Depends on `\\.movieClient`" },
            { pattern: "clock\\.sleep\\(for:\\s*\\.milliseconds\\(300\\)\\)", label: "300 ms debounce with the clock" },
            { pattern: "\\.cancellable\\(\\s*id:\\s*CancelID\\.search\\s*,\\s*cancelInFlight:\\s*true\\s*\\)", label: "Cancels the previous search with `cancelInFlight: true`" },
            { pattern: "\\.cancel\\(\\s*id:\\s*CancelID\\.search\\s*\\)", label: "Cancels on short queries" },
            { pattern: "\\.ifLet\\(\\s*\\\\\\.\\$detail\\s*,\\s*action:\\s*\\\\\\.detail\\s*\\)", label: "Integrates the sheet with `.ifLet(\\.$detail, action: \\.detail)`" },
          ],
          warnings: [
            { pattern: "Task\\.sleep", label: "`Task.sleep` can't be controlled in tests: use the clock" },
            { pattern: "URLSession", label: "Networking belongs in the client, not the reducer" },
          ],
          solution: swift`@Reducer
struct MovieSearchFeature {
    // State and Action from the previous step

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
          hint: "Copy the structure of `SearchFeature` (lesson 3) and add the `case .movieTapped` and the `.ifLet` from `ContactsFeature`.",
        },
        {
          kind: "predict",
          prompt: "In the PR someone removed `cancelInFlight: true` \"because the debounce is enough\". The user searches \"bat\", the API takes 2 s to respond, and at 500 ms they type \"batman\". What risk shows up?",
          code: swift`return .run { send in
    try await clock.sleep(for: .milliseconds(300))
    let movies = try await movieClient.search(query)
    await send(.searchResponse(movies))
}
.cancellable(id: CancelID.search)`,
          options: [
            "None: the debounce prevents any race",
            "It doesn't compile without `cancelInFlight`",
            "Both searches are in flight and, if \"bat\" responds after \"batman\", it overwrites the new results with stale ones",
            "The \"batman\" search never runs",
          ],
          answer: 2,
          explanation: "The debounce only drops effects that are still sleeping. When \"batman\" arrives, the \"bat\" search is already waiting on the network and, without `cancelInFlight`, nobody cancels it. Responses can arrive in any order: the stale one can overwrite the fresh one. `cancelInFlight: true` cuts off the previous one at any point.",
        },
        {
          kind: "write",
          prompt: "Step 3: write an exhaustive test. Use a `TestClock` and override `movieClient.search` to return `Movie(id: 1, title: \"Batman\", year: 1989)`. Send `.queryChanged(\"bat\")`, advance 300 ms, receive `\\.searchResponse` and then tap the movie to open the detail.",
          starter: swift`import ComposableArchitecture
import Testing

@MainActor
struct MovieSearchFeatureTests {
    @Test
    func searchDebouncesAndOpensDetail() async {
        let movie = Movie(id: 1, title: "Batman", year: 1989)
        // your test
    }
}
`,
          checks: [
            { pattern: "TestStore\\(initialState:\\s*MovieSearchFeature\\.State\\(\\)\\)", label: "Creates the `TestStore`" },
            { pattern: "TestClock\\(\\)", label: "Uses `TestClock()`" },
            { pattern: "\\$0\\.movieClient\\.search\\s*=", label: "Overrides `movieClient.search`" },
            { pattern: "await\\s+clock\\.advance\\(by:\\s*\\.milliseconds\\(300\\)\\)", label: "Advances 300 ms" },
            { pattern: "await\\s+store\\.receive\\(\\s*\\\\\\.searchResponse\\s*\\)", label: "Receives `\\.searchResponse`" },
            { pattern: "\\$0\\.detail\\s*=", label: "Asserts the detail opens" },
          ],
          warnings: [
            { pattern: "exhaustivity\\s*=\\s*\\.off", label: "The challenge asks for an exhaustive test" },
            { pattern: "Task\\.sleep", label: "Don't wait real time in tests" },
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
          hint: "Remember to assert `isLoading` in both the `send` and the `receive`.",
        },
        {
          kind: "predict",
          prompt: "Another test sends a one-character query starting from the empty initial state. What must it assert to pass?",
          code: swift`await store.send(.queryChanged("b")) {
    // ???
}`,
          options: [
            "`$0.query = \"b\"` and then `receive(\\.searchResponse)` with empty results",
            "`$0.query = \"b\"` and `$0.isLoading = true`",
            "Nothing: with fewer than 2 characters the reducer ignores the action",
            "Only `$0.query = \"b\"`; no action is received because the effect is `.cancel`",
          ],
          answer: 3,
          explanation: "With fewer than 2 characters the reducer stores the query, leaves `movies` empty and `isLoading` at `false` (which they already were) and returns `.cancel(id:)`, which sends no actions. The only real change is `query`. There's no `receive` and no effect left in flight.",
        },
      ],
    },
  ],
  flashcards: [
    {
      id: "fc-three-parts",
      front: "What are the pieces of a TCA feature?",
      back: "`State` (the data), `Action` (everything that can happen), the reducer in `body` (how state changes and which effects it returns) and the `Store` that runs it.",
    },
    {
      id: "fc-reducer-macro",
      front: "What does `@Reducer` do?",
      back: "It generates the `Reducer` conformance and makes `Action` `@CasePathable`, which enables case key paths like `\\.child` in `Scope`, `.ifLet` and `receive`.",
    },
    {
      id: "fc-observable-state",
      front: "What is `@ObservableState` for?",
      back: "It makes `State` observable (like `@Observable`): the view reads `store.count` directly and only re-renders for what it read. It replaces `WithViewStore`.",
      code: "Text(\"\\(store.count)\")",
    },
    {
      id: "fc-effect-none",
      front: "What does `Reduce` return and what does `.none` mean?",
      back: "An `Effect<Action>`. `.none` = no async work; only the mutation is applied.",
    },
    {
      id: "fc-run",
      front: "How does a `.run` result get back into state?",
      back: "By sending an action with `await send(.somethingResponse(value))`; the reducer handles it and mutates state.",
      code: "return .run { [id = state.id] send in\n    let user = try await api.user(id)\n    await send(.userResponse(user))\n}",
    },
    {
      id: "fc-capture-state",
      front: "Why can't you use `state` inside `.run`?",
      back: "It's `inout` and the closure escapes. Capture the values instead: `[query = state.query]`.",
    },
    {
      id: "fc-cancel-in-flight",
      front: "What does `cancelInFlight: true` do?",
      back: "When an effect with that id starts, it cancels any running effect with the same id. It's the basis of debouncing and of keeping stale responses from overwriting fresh ones.",
    },
    {
      id: "fc-dependency-client",
      front: "What does `@DependencyClient` generate?",
      back: "An `init()` where every endpoint is unimplemented: if a test calls one without overriding it, the test fails. Perfect as a `testValue`.",
    },
    {
      id: "fc-binding",
      front: "Three things to use `$store.field` in a `TextField`",
      back: "`Action: BindableAction` with `case binding(BindingAction<State>)`, `BindingReducer()` in `body` and `@Bindable var store` in the view.",
    },
    {
      id: "fc-scope",
      front: "What is `Scope(state:action:)` for?",
      back: "It runs a child reducer on a slice of the parent's state and actions. In the view, `store.scope(state:action:)` gives you the child store.",
    },
    {
      id: "fc-identified-array",
      front: "Why `IdentifiedArrayOf` instead of `Array` for child features?",
      back: "Actions are routed by id, not index: if a row is deleted while an effect is in flight, an index would point to another row. Plus lookup by id is O(1).",
    },
    {
      id: "fc-presents",
      front: "How do you model a sheet in TCA?",
      back: "Optional state with `@Presents`, a `PresentationAction<Child.Action>` action and `.ifLet(\\.$child, action: \\.child)`. `nil` means closed; on close the child's effects are cancelled.",
    },
    {
      id: "fc-stack",
      front: "What pieces does stack navigation use?",
      back: "`@Reducer enum Path`, `StackState<Path.State>`, `StackActionOf<Path>` and `.forEach(\\.path, action: \\.path)`. Navigating = `state.path.append(...)`.",
    },
    {
      id: "fc-teststore",
      front: "What does an exhaustive `TestStore` require?",
      back: "Asserting every state change, receiving every action from effects with `receive`, and no effect left running when the test ends.",
    },
    {
      id: "fc-testclock",
      front: "`TestClock` vs `ImmediateClock`",
      back: "`TestClock` only moves with `advance(by:)`: for testing debounces and timers. `ImmediateClock` finishes every wait instantly: when timing doesn't matter.",
    },
  ],
  exam: [
    {
      id: "ex-01",
      question: "You need to load the profile when the screen appears. Where does the API call go in a TCA feature?",
      options: [
        "In the view's `.onAppear`, then `store.send(.profileLoaded(profile))`",
        "In a `Task` inside the reducer that mutates `state` when done",
        "In a `.run` effect returned by the reducer on `.onAppear`, using a `@Dependency` client and sending `.profileResponse`",
        "In the `State` initializer",
      ],
      answer: 2,
      explanation: "The reducer returns the effect and the result comes back as an action. That keeps logic in the reducer, lets tests swap the dependency, and lets `TestStore` assert the whole flow. Doing it in the view pulls logic out of the reducer; a `Task` inside can't mutate the `inout`.",
    },
    {
      id: "ex-02",
      question: "You're migrating a TCA 1.0 view that used `WithViewStore(store, observe: { $0 })`. With `@ObservableState`, what does it become?",
      options: [
        "Read `store.count` directly and call `store.send(.x)`; `WithViewStore` is no longer needed",
        "Keep `WithViewStore` but drop `observe:`",
        "Replace it with `@ObservedObject var viewStore`",
        "Copy the state into `@State` in `onAppear`",
      ],
      answer: 0,
      explanation: "With `@ObservableState` the store exposes state directly and observation is per property read, like `@Observable`. `WithViewStore` is deprecated; copying into `@State` duplicates the source of truth.",
    },
    {
      id: "ex-03",
      question: "A `TextField(\"Email\", text: $store.email)` doesn't compile. The feature has `case emailChanged(String)`. What's missing to use direct bindings?",
      options: [
        "Mark `email` with `@Published`",
        "Change the store to `@ObservedObject`",
        "Always use `Binding(get:set:)`; TCA doesn't support `$store`",
        "`Action: BindableAction` with `case binding(BindingAction<State>)`, `BindingReducer()` in `body` and `@Bindable var store` in the view",
      ],
      answer: 3,
      explanation: "Those three pieces enable `$store.email`. `BindingReducer` writes the value and your `Reduce` can react with `case .binding(\\.email)`. `@Published` and `@ObservedObject` belong to the `ObservableObject` world, not TCA 1.x.",
    },
    {
      id: "ex-04",
      question: "Search hits the API on every keystroke and results sometimes \"jump\" back to an old query. Which change fixes it?",
      options: [
        "Add `Task.sleep` in the view before `send`",
        "Have the effect wait with `clock.sleep` and be `.cancellable(id: CancelID.search, cancelInFlight: true)`",
        "Keep a `Bool isSearching` and drop actions while it's `true`",
        "Compare `query` in `.searchResponse` and drop mismatches, without cancelling anything",
      ],
      answer: 1,
      explanation: "Sleeping on the clock gives you the debounce and `cancelInFlight` cancels both pending waits and in-flight requests, so a stale response never lands. Comparing the query half-works but leaves useless requests running; `Task.sleep` in the view can't be tested.",
    },
    {
      id: "ex-05",
      question: "A new test fails with an unimplemented-endpoint error for `MovieClient.search`. The client uses `@DependencyClient` and `testValue = MovieClient()`. What does it mean?",
      options: [
        "The feature called `search` and the test didn't override it in `withDependencies`",
        "It's a TCA bug; you should use `liveValue` in tests",
        "The test is missing `@MainActor`",
        "The `TestClock` didn't advance far enough",
      ],
      answer: 0,
      explanation: "That's the intended behavior: every `testValue` endpoint is unimplemented and fails if used without being declared. It forces you to be explicit about which dependencies a flow touches. Fix it with `$0.movieClient.search = { _ in [...] }`.",
    },
    {
      id: "ex-06",
      question: "A list of 200 `TodoFeature`s uses `[TodoFeature.State]` and index-based actions. Deleting while a save effect is in flight applies the result to a different row. What do you propose?",
      options: [
        "Block deletion while effects are running",
        "`IdentifiedArrayOf<TodoFeature.State>` with `IdentifiedActionOf<TodoFeature>` and `.forEach(\\.todos, action: \\.todos)`",
        "Use a `Dictionary` and sort in the view",
        "Recompute the index on every action with `firstIndex(where:)` in the view",
      ],
      answer: 1,
      explanation: "With `IdentifiedArray` actions carry the element's id: even if positions change, the action reaches the right row (or is dropped if it no longer exists). It's exactly the problem it was built for.",
    },
    {
      id: "ex-07",
      question: "A screen has an edit sheet, a confirmation alert and a share dialog, each with its own optional `@Presents`. QA reports two of them open at once. What refactor do you suggest?",
      options: [
        "Add a `guard` in each action that checks the other two optionals",
        "Move everything to `Bool`s in the view",
        "A `@Reducer enum Destination` with one `case` per destination, `@Presents var destination: Destination.State?` and `.ifLet(\\.$destination, action: \\.destination)`",
        "Use `StackState` for everything",
      ],
      answer: 2,
      explanation: "An optional enum makes two active destinations impossible by construction: only one `case` exists at a time. It's the recommended pattern for multiple destinations on one screen.",
    },
    {
      id: "ex-08",
      question: "You need to support the deep link `app://contacts/42/edit`, which opens the list, contact 42's detail and the editor on top. With TCA stack navigation, how do you do it?",
      options: [
        "With `NavigationLink(isActive:)` in each view",
        "By sending three tap actions with delays to simulate the user",
        "By saving the URL in `UserDefaults` and reading it on each screen",
        "By building the state: `state.path = StackState([.detail(...), .edit(...)])`, since the stack is just state",
      ],
      answer: 3,
      explanation: "With `StackState` navigation is data: building the state is navigating. It's also testable with a `TestStore` without touching the UI. Simulating taps with delays is fragile and `NavigationLink(isActive:)` is deprecated.",
    },
    {
      id: "ex-09",
      question: "A timer test fails at the end with \"an effect returned for this action is still running\". What's the right fix?",
      options: [
        "Set `store.exhaustivity = .off`",
        "Send the action that stops the timer (or advance the clock until the effect finishes) before the test ends",
        "Add `try await Task.sleep(for: .seconds(1))` at the end",
        "Remove `.cancellable(id:)` from the effect",
      ],
      answer: 1,
      explanation: "`TestStore` requires the test to cover the effects' whole lifecycle. Stopping the timer the way the user would is correct and also tests cancellation. Turning off exhaustivity hides the problem and real sleeping makes the test slow.",
    },
    {
      id: "ex-10",
      question: "You want a test for the login → home flow spanning four features. Asserting every intermediate `isLoading` makes the test brittle. What do you do?",
      options: [
        "Use `store.exhaustivity = .off`, send the key actions and assert only the final state that matters",
        "Write a UI test instead",
        "Only test each feature separately, never the flow",
        "Mock the whole `Store`",
      ],
      answer: 0,
      explanation: "Non-exhaustive mode exists for integration tests: you verify the business outcome without coupling to internal details. Each feature's unit tests stay exhaustive.",
    },
    {
      id: "ex-11",
      question: "In the parent's `body` the `Reduce` sits above the child's `Scope`. On `.child(.saveTapped)` the parent reads `state.child.draft` to save it, but saves the previous value. Why?",
      options: [
        "Because `Scope` copies the state and child changes never reach the parent",
        "Because child actions never reach the parent's `Reduce`",
        "It's a TCA bug: you need `.ifLet`",
        "Because reducers run in order: the parent runs before the child and doesn't see its update yet",
      ],
      answer: 3,
      explanation: "Reducers in `body` run top to bottom on the same state. Moving the `Scope` above the `Reduce` lets the parent see the child's already-updated state.",
    },
    {
      id: "ex-12",
      question: "In an interview you're asked when you would **not** use TCA. Which answer shows senior judgment?",
      options: [
        "Never: TCA always scales better than any alternative",
        "Only when the app has no tests",
        "In small or CRUD apps, or with a team without time for the learning curve: there MVVM with `@Observable` and `init` injection gives testability with less ceremony and no lock-in to an external library",
        "When the app uses UIKit, because TCA is SwiftUI-only",
      ],
      answer: 2,
      explanation: "A senior answer talks about costs: learning curve, ceremony, compile times and an external dependency versus predictability, composition and exhaustive tests. TCA also works with UIKit, so that isn't the reason.",
    },
  ],
};

export default content;
