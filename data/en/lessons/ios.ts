import { Lesson } from "../../lessons/types";

export const iosLessons: Lesson[] = [
  {
    id: "l-swiftui",
    topic: "ios",
    title: "SwiftUI: state and property wrappers",
    goal: "Pick the right wrapper (@State, @Binding, @StateObject, @ObservedObject, @Observable) without hesitating.",
    minutes: 14,
    steps: [
      {
        kind: "explain",
        title: "The core idea",
        body: [
          "A SwiftUI view is a function of state: `body` is recomputed whenever something the view observes changes. Property wrappers tell SwiftUI **who owns** that state and **when** to redraw.",
          "The key question when choosing: does the view own the data, or does it receive it from outside?",
        ],
      },
      {
        kind: "explain",
        title: "@State and @Binding (simple values)",
        body: [
          "`@State`: the view's own private state (a Bool, a String, a small struct). SwiftUI stores it outside the struct so it survives re-renders.",
          "`@Binding`: a read/write reference to a `@State` that lives in another view. You pass it with `$`.",
        ],
        code: "struct Parent: View {\n    @State private var isActive = false\n    var body: some View {\n        VStack {\n            Toggle(\"Active\", isOn: $isActive)    // $ → Binding<Bool>\n            Child(isActive: $isActive)\n        }\n    }\n}\nstruct Child: View {\n    @Binding var isActive: Bool\n    var body: some View { Button(\"Turn off\") { isActive = false } }\n}",
      },
      {
        kind: "fill",
        prompt: "Fill in the wrapper so `Child` can modify the parent's state.",
        code: "struct Child: View {\n    ____ var name: String\n    var body: some View { TextField(\"Name\", text: $name) }\n}",
        accept: ["^@Binding$"],
        explanation: "`@Binding` connects to an external `@State`; `$name` hands the Binding to the TextField.",
        placeholder: "@...",
      },
      {
        kind: "explain",
        title: "@StateObject vs @ObservedObject (ObservableObject)",
        body: [
          "For objects (classes) that conform to `ObservableObject` and publish changes with `@Published`.",
          "`@StateObject`: the view **creates and owns** the object; it's instantiated only once even when the view is redrawn. It's what you use for a screen's ViewModel.",
          "`@ObservedObject`: the view **receives** the object as a parameter; it doesn't control its lifetime. If the parent is recreated and passes a new instance, the state is lost. Common mistake: creating the ViewModel with @ObservedObject and losing it on every render.",
          "`@EnvironmentObject`: same as ObservedObject but injected into the tree with `.environmentObject(...)`.",
        ],
        code: "final class ProfileVM: ObservableObject {\n    @Published var name = \"\"\n}\nstruct ProfileScreen: View {\n    @StateObject private var vm = ProfileVM()      // owner\n    var body: some View { ProfileHeader(vm: vm) }\n}\nstruct ProfileHeader: View {\n    @ObservedObject var vm: ProfileVM               // borrowed\n    var body: some View { Text(vm.name) }\n}",
      },
      {
        kind: "predict",
        prompt: "What's wrong with this code?",
        code: "struct Screen: View {\n    @ObservedObject var vm = ScreenVM()\n    var body: some View { Text(vm.title) }\n}",
        options: ["It doesn't compile", "Every time Screen is recreated a new ScreenVM is created and the state is lost", "vm is never released", "@Published is missing"],
        answer: 1,
        explanation: "For an object the view creates, use `@StateObject`. `@ObservedObject` doesn't keep the instance across renders.",
      },
      {
        kind: "explain",
        title: "@Observable (iOS 17+)",
        body: [
          "A macro that replaces `ObservableObject` + `@Published`. You mark the class `@Observable` and all its properties become observable. SwiftUI redraws a view **only if a property that view read has changed** (fine-grained tracking, fewer renders).",
          "Owner: `@State private var vm = VM()`. Children: receive `vm` as a plain parameter. For bindings: `@Bindable var vm`.",
        ],
        code: "@Observable final class CounterVM { var count = 0; var label = \"\" }\n\nstruct Screen: View {\n    @State private var vm = CounterVM()             // owner\n    var body: some View { Child(vm: vm) }\n}\nstruct Child: View {\n    @Bindable var vm: CounterVM\n    var body: some View {\n        TextField(\"Label\", text: $vm.label)      // direct binding\n        Button(\"+\") { vm.count += 1 }\n    }\n}",
      },
      {
        kind: "fill",
        prompt: "Fill in the wrapper to create a Binding to a property of an @Observable object received as a parameter.",
        code: "struct Child: View {\n    ____ var vm: CounterVM\n    var body: some View { TextField(\"x\", text: $vm.label) }\n}",
        accept: ["^@Bindable$"],
        explanation: "`@Bindable` exposes `$vm.property` as a Binding for @Observable objects.",
        placeholder: "@...",
      },
      {
        kind: "explain",
        title: "Mental cheat sheet",
        body: [
          "Simple value you own → `@State`. Simple value you borrow → `@Binding`.",
          "Object you own (ObservableObject) → `@StateObject`. Borrowed object → `@ObservedObject`. Shared across the tree → `@EnvironmentObject`.",
          "Object you own (@Observable) → `@State`. Borrowed → plain parameter; with bindings → `@Bindable`. Shared → `.environment(vm)` + `@Environment(VM.self)`.",
        ],
      },
    ],
  },
  {
    id: "l-concurrency",
    topic: "ios",
    title: "async/await, Task, actor, @MainActor",
    goal: "Write a ViewModel that loads data without threading warnings and understand what an actor protects.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "async/await",
        body: [
          "An `async` function can suspend without blocking the thread. You call it with `await`; if it also throws, `try await`. You can only use `await` inside another async function or a `Task`.",
          "`Task { }` starts concurrent work from synchronous code (a button, `init`). In SwiftUI, the `.task { }` modifier creates a Task tied to the view's lifetime and **cancels** it when the view disappears.",
        ],
        code: "func fetchProfile() async throws -> Profile { ... }\n\nstruct Screen: View {\n    @State private var profile: Profile?\n    var body: some View {\n        Text(profile?.name ?? \"…\")\n            .task { profile = try? await fetchProfile() }\n    }\n}",
      },
      {
        kind: "explain",
        title: "Several things at once",
        body: [
          "`async let` launches two operations in parallel and you await both. `TaskGroup` for N dynamic ones. If one throws, the others are cancelled.",
        ],
        code: "async let user = api.user()\nasync let txs = api.transactions()\nlet (u, t) = try await (user, txs)   // in parallel\n\nlet results = try await withThrowingTaskGroup(of: Image.self) { g in\n    for url in urls { g.addTask { try await load(url) } }\n    var out: [Image] = []\n    for try await img in g { out.append(img) }\n    return out\n}",
      },
      {
        kind: "predict",
        prompt: "Roughly how long does this take?",
        code: "async let a = sleep2s()   // takes 2 s\nasync let b = sleep3s()   // takes 3 s\n_ = await (a, b)",
        options: ["5 s", "3 s", "2 s", "It depends on the order"],
        answer: 1,
        explanation: "`async let` runs them in parallel: the total is the slowest one, 3 s.",
      },
      {
        kind: "explain",
        title: "@MainActor: UI goes on the main thread",
        body: [
          "Everything that touches the UI (`@Published`, `@State`, views) must run on the main thread. If you assign a `@Published` from a background Task you get the purple warning 'Publishing changes from background threads'.",
          "Clean fix: mark the ViewModel `@MainActor`. All its code runs on main; the `await` network calls suspend without blocking.",
        ],
        code: "@MainActor\nfinal class FeedVM: ObservableObject {\n    @Published private(set) var state: State = .idle\n    private let load: LoadFeedUseCase\n    init(load: LoadFeedUseCase) { self.load = load }\n\n    func refresh() {\n        state = .loading\n        Task {\n            do { state = .loaded(try await load()) }   // back on main automatically\n            catch { state = .failed(error.localizedDescription) }\n        }\n    }\n}",
      },
      {
        kind: "fill",
        prompt: "Fill in the attribute that guarantees the ViewModel updates the UI on the main thread.",
        code: "____\nfinal class FeedVM: ObservableObject {\n    @Published var items: [Item] = []\n}",
        accept: ["^@MainActor$"],
        explanation: "`@MainActor` isolates the class to the main actor.",
        placeholder: "@...",
      },
      {
        kind: "explain",
        title: "actor: mutable state without data races",
        body: [
          "An `actor` is a reference type whose state can only be touched from inside, and calls from outside are `await`ed (they're serialized). It replaces locks and DispatchQueues for caches, counters, sessions.",
          "`@MainActor` is a special global actor: the main thread.",
        ],
        code: "actor ImageCache {\n    private var store: [URL: Image] = [:]\n    func image(for url: URL) -> Image? { store[url] }\n    func set(_ img: Image, for url: URL) { store[url] = img }\n}\nlet cache = ImageCache()\nawait cache.set(img, for: url)      // await required from outside",
      },
      {
        kind: "explain",
        title: "Cancellation",
        body: [
          "Tasks are cooperative: cancelling doesn't kill them, it notifies them. In long loops check `Task.isCancelled` or `try Task.checkCancellation()`. `URLSession` and `Task.sleep` already honor cancellation.",
          "SwiftUI's `.task {}` and stored `Task`s cancelled with `.cancel()` in `deinit`/`onDisappear` prevent zombie work.",
        ],
      },
      {
        kind: "predict",
        prompt: "What happens here?",
        code: "final class VM: ObservableObject {\n    @Published var items: [Int] = []\n    func load() {\n        Task.detached {\n            let r = await heavyWork()\n            self.items = r\n        }\n    }\n}",
        options: ["It works fine", "Warning/crash: it assigns a @Published from a background thread", "It doesn't compile because of self", "items stays empty"],
        answer: 1,
        explanation: "`Task.detached` doesn't inherit the actor; the assignment happens off main. Mark the class `@MainActor` or use `await MainActor.run { self.items = r }`.",
      },
    ],
  },
  {
    id: "l-arc",
    topic: "ios",
    title: "ARC and retain cycles",
    goal: "Explain how Swift frees memory, spot a cycle in code and break it with weak/unowned.",
    minutes: 10,
    steps: [
      {
        kind: "explain",
        title: "How ARC works",
        body: [
          "Every class instance has a strong reference count. Assigning it to a variable increments it; when the variable goes away or is reassigned, it decrements. When it hits 0, `deinit` is called and the memory is freed. Structs don't take part: they're copied.",
          "There's no garbage collector: if A retains B and B retains A, neither ever reaches 0. That's a **retain cycle** → memory leak.",
        ],
        code: "final class Person {\n    let name: String\n    init(_ n: String) { name = n; print(\"init\", n) }\n    deinit { print(\"deinit\", name) }\n}\nvar p: Person? = Person(\"Ana\")     // init Ana, count 1\nvar q = p                          // count 2\np = nil                            // count 1\nq = nil                            // count 0 → deinit Ana",
        output: "init Ana\ndeinit Ana",
      },
      {
        kind: "explain",
        title: "The three typical cycles",
        body: [
          "1. Two objects with mutual strong properties (`Parent.child` and `Child.parent`). Fix: make one of them `weak var`.",
          "2. Strong delegate: `var delegate: MyDelegate?` where the delegate is whoever created you. Fix: `weak var delegate`.",
          "3. A stored closure that captures `self`: the object stores the closure (or Combine's `AnyCancellable`) and the closure retains `self`. Fix: `[weak self]`.",
        ],
        code: "final class Timer2 {\n    var onTick: (() -> Void)?\n    var count = 0\n    func start() {\n        onTick = { [weak self] in          // without this: cycle\n            guard let self else { return }\n            self.count += 1\n        }\n    }\n}",
      },
      {
        kind: "predict",
        prompt: "Is there a retain cycle?",
        code: "final class VM {\n    var names: [String] = []\n    func load(api: API) {\n        api.fetch { [weak self] result in\n            self?.names = result\n        }\n    }\n}",
        options: ["Yes, because of the closure", "No: self is weak inside the closure", "Yes, because of api", "It doesn't compile"],
        answer: 1,
        explanation: "`[weak self]` keeps the closure from strongly retaining the VM. Besides, `api.fetch` isn't stored by `self`, so a cycle wasn't even guaranteed; weak is the safe practice.",
      },
      {
        kind: "explain",
        title: "weak vs unowned",
        body: [
          "`weak`: a reference that doesn't add to the count and automatically becomes `nil` when the object dies. It's always optional and `var`.",
          "`unowned`: doesn't add to the count either, but isn't optional: if you use the reference after the object died, **crash**. Only when the other object is guaranteed to outlive it (for example, a closure inside an object that owns it and never exposes it).",
          "When in doubt, `weak`.",
        ],
      },
      {
        kind: "fill",
        prompt: "Fill in the blank to break the delegate cycle.",
        code: "protocol CellDelegate: AnyObject { func tapped() }\nfinal class Cell {\n    ____ var delegate: CellDelegate?\n}",
        accept: ["^weak$"],
        explanation: "`weak var delegate` is the convention: the owner (controller/VM) retains the cell, not the other way around. The protocol must be `AnyObject` so it can be weak.",
        placeholder: "keyword",
      },
      {
        kind: "explain",
        title: "How you detect it",
        body: [
          "Xcode → Debug Memory Graph: shows live objects and who retains them; cycles show up with a purple icon.",
          "Instruments → Leaks (memory with no reachable reference) and Allocations with generations (abandoned memory: it grows and doesn't drop when you navigate back).",
          "In tests: `weak var sut = ViewModel(); XCTAssertNil(sut)` after releasing the strong reference.",
        ],
      },
    ],
  },
  {
    id: "l-security",
    topic: "seguridad",
    title: "Mobile security: Keychain, biometrics, pinning",
    goal: "Answer precisely what gets protected, where and how in a financial app.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "Where each piece of data lives",
        body: [
          "Secrets (tokens, keys, encrypted PIN) → **Keychain**. Non-sensitive preferences → UserDefaults. Files → Documents with `.completeFileProtection` (encrypted while the device is locked). Structured data → Core Data/SwiftData with file protection.",
          "Keychain accessibility: `WhenUnlocked` (default), `WhenUnlockedThisDeviceOnly` (doesn't migrate via backup; the one you use for tokens), `AfterFirstUnlock` (background).",
        ],
      },
      {
        kind: "predict",
        prompt: "What's the security flaw?",
        code: "UserDefaults.standard.set(token, forKey: \"accessToken\")",
        options: ["None, it's standard", "UserDefaults is a plaintext plist, readable from backups and on jailbroken devices", "It only works on the simulator", "The token is deleted when the app closes"],
        answer: 1,
        explanation: "Any secret belongs in the Keychain.",
      },
      {
        kind: "explain",
        title: "Biometrics with LocalAuthentication",
        body: [
          "1. `canEvaluatePolicy` to find out whether Face ID/Touch ID is set up. 2. `evaluatePolicy` shows the prompt. 3. `.deviceOwnerAuthenticationWithBiometrics` is biometrics only; `.deviceOwnerAuthentication` allows the passcode as a fallback.",
          "Biometrics **don't authenticate against the server**: they unlock a local secret (a refresh token stored with a biometric `SecAccessControl`) that you use to request a new token. It requires `NSFaceIDUsageDescription` in Info.plist.",
          "Errors to handle: `userCancel`, `biometryNotEnrolled`, `biometryLockout` (offer the passcode), `authenticationFailed`.",
        ],
        code: "import LocalAuthentication\n\nfunc unlock() async throws -> Bool {\n    let ctx = LAContext()\n    var err: NSError?\n    guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else {\n        return try await ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: \"Enter your passcode\")\n    }\n    return try await ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: \"Confirm your identity\")\n}",
      },
      {
        kind: "fill",
        prompt: "Fill in the policy that accepts the device passcode as an alternative to biometrics.",
        code: "ctx.evaluatePolicy(.____, localizedReason: \"…\")",
        accept: ["^deviceOwnerAuthentication$"],
        explanation: "`.deviceOwnerAuthentication` = biometrics or passcode. `WithBiometrics` is biometrics only.",
        placeholder: ".policy",
      },
      {
        kind: "explain",
        title: "Secure communication",
        body: [
          "**ATS** (App Transport Security) already enforces HTTPS/TLS 1.2+. Don't add `NSAllowsArbitraryLoads`.",
          "**Pinning**: on top of TLS, you verify that the server's certificate (or better, its public key / SPKI hash) is one you embedded. That way a proxy with a CA installed on the phone (Charles, MITM) can't intercept traffic. It's implemented in `urlSession(_:didReceive:completionHandler:)` by comparing the hash; include a backup pin so you can rotate certificates without breaking the app.",
          "Nothing sensitive in logs (`os_log` with `%{private}`), or in URLs (query params end up in server logs).",
        ],
        code: "func urlSession(_ s: URLSession, didReceive ch: URLAuthenticationChallenge) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {\n    guard let trust = ch.protectionSpace.serverTrust,\n          let cert = SecTrustCopyCertificateChain(trust) as? [SecCertificate], let leaf = cert.first,\n          let key = SecCertificateCopyKey(leaf), let data = SecKeyCopyExternalRepresentation(key, nil) as Data?\n    else { return (.cancelAuthenticationChallenge, nil) }\n    let hash = SHA256.hash(data: data).description\n    return pins.contains(hash) ? (.useCredential, URLCredential(trust: trust)) : (.cancelAuthenticationChallenge, nil)\n}",
      },
      {
        kind: "predict",
        prompt: "What does certificate pinning protect against that plain TLS doesn't?",
        code: "",
        options: ["Sniffing on public Wi-Fi", "An attacker who managed to install their own CA on the device and runs a MITM", "SQL injection", "Jailbreaking"],
        answer: 1,
        explanation: "TLS trusts any installed CA. Pinning only trusts your certificate/key.",
      },
      {
        kind: "explain",
        title: "OWASP Mobile Top 10 (2024) checklist",
        body: [
          "M1 Improper Credential Usage · M2 Inadequate Supply Chain Security (dependencies) · M3 Insecure Authentication/Authorization · M4 Insufficient Input/Output Validation · M5 Insecure Communication · M6 Inadequate Privacy Controls · M7 Insufficient Binary Protections (obfuscation, anti-tamper) · M8 Security Misconfiguration · M9 Insecure Data Storage · M10 Insufficient Cryptography.",
          "In the interview it's enough to name 5–6 and say how you cover them: Keychain (M9), pinning + ATS (M5), biometrics + rotating refresh tokens (M3), SPM with pinned versions and auditing (M2), never logging PII (M6), hiding the snapshot in background and jailbreak detection as a signal (M7/M8).",
        ],
      },
    ],
  },
  {
    id: "l-testing",
    topic: "testing",
    title: "Testing, Instruments and release",
    goal: "Write a ViewModel unit test with a mock, know which instrument to open and walk through the release flow.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "Unit tests with XCTest",
        body: [
          "You test logic, not UI: ViewModels, use cases, mappers. The ViewModel receives its dependencies through protocols, and in the test you pass it a fake. `async` tests are written with `await` directly.",
          "AAA pattern: Arrange (set up the sut and fakes), Act (call it), Assert (`XCTAssertEqual`).",
        ],
        code: "protocol UserRepository { func user() async throws -> User }\nstruct StubRepo: UserRepository {\n    var result: Result<User, Error>\n    func user() async throws -> User { try result.get() }\n}\n\nfinal class ProfileVMTests: XCTestCase {\n    func test_load_success_setsName() async {\n        let sut = ProfileVM(repo: StubRepo(result: .success(User(name: \"Ana\"))))\n        await sut.load()\n        XCTAssertEqual(sut.name, \"Ana\")\n    }\n    func test_load_failure_setsError() async {\n        let sut = ProfileVM(repo: StubRepo(result: .failure(APIError.http(500))))\n        await sut.load()\n        XCTAssertNotNil(sut.errorMessage)\n    }\n}",
      },
      {
        kind: "fill",
        prompt: "Fill in the assertion that checks the state ended up as expected.",
        code: "await sut.load()\n____(sut.items.count, 3)",
        accept: ["^XCTAssertEqual$"],
        explanation: "`XCTAssertEqual(actual, expected)`; there are also XCTAssertTrue, XCTAssertNil, XCTAssertThrowsError.",
        placeholder: "XCTAssert...",
      },
      {
        kind: "explain",
        title: "Mocking the network and UI tests",
        body: [
          "Two levels: (1) an `HTTPClient` protocol with a stub to test ViewModels/repositories; (2) a custom `URLProtocol` registered on a `URLSessionConfiguration` to test the real client without internet.",
          "XCUITest: launches the real app and drives it through `accessibilityIdentifier`. Slow and brittle: critical flows only (login, transfer). For determinism, launch the app with `launchArguments` that switch on mock data.",
        ],
        code: "final class MockURLProtocol: URLProtocol {\n    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?\n    override class func canInit(with r: URLRequest) -> Bool { true }\n    override class func canonicalRequest(for r: URLRequest) -> URLRequest { r }\n    override func startLoading() {\n        let (resp, data) = Self.handler!(request)\n        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)\n        client?.urlProtocol(self, didLoad: data)\n        client?.urlProtocolDidFinishLoading(self)\n    }\n    override func stopLoading() {}\n}",
      },
      {
        kind: "predict",
        prompt: "The app's list stutters while scrolling. Which instrument do you open first?",
        code: "",
        options: ["Leaks", "Time Profiler (with 'Hide system libraries')", "Network", "Energy"],
        answer: 1,
        explanation: "Stutters = work on the main thread. Time Profiler shows which of your functions eat CPU on main. Core Animation/Animation Hitches complements it.",
      },
      {
        kind: "explain",
        title: "Instruments: which one for what",
        body: [
          "Time Profiler → CPU, blocked main thread. Allocations → memory growth (abandoned memory with generation marks). Leaks → unreferenced memory. Network → requests, sizes, latency. Core Animation / Animation Hitches → dropped frames. Energy → battery.",
          "Measure before and after; leave `os_signpost` at critical points to see intervals in Instruments and in MetricKit in production.",
        ],
      },
      {
        kind: "explain",
        title: "Release step by step",
        body: [
          "1. Cut a `release/x.y` branch from `main`; freeze features. 2. CI bumps the build number, archives and signs (Fastlane or Xcode Cloud). 3. Internal TestFlight (up to 100 team testers, no review). 4. External TestFlight (Apple beta review, up to 10,000 testers). 5. Submit for App Store review with notes and a demo account. 6. Phased release: 1% → 100% over 7 days, pausable. 7. Watch crash-free users for 48 h.",
          "There's no rollback to the previous version: if something breaks, you pause the phased release, turn the feature off with a remote flag and ship a hotfix requesting expedited review.",
        ],
      },
      {
        kind: "fill",
        prompt: "Fill in the mechanism that lets you turn off a feature in production without shipping a new version.",
        code: "if remoteConfig.isEnabled(\"new_transfer_flow\") { … }\n// This is a ____ flag",
        accept: ["^feature$"],
        explanation: "Feature flags (remote config) decouple deploy from release and are your real rollback on mobile.",
        placeholder: "word",
      },
      {
        kind: "explain",
        title: "Monitoring in production",
        body: [
          "Crashlytics or Sentry with dSYMs uploaded from CI (without dSYMs stack traces don't get symbolicated). Alerts on new crashes and on drops in crash-free users per version.",
          "MetricKit: hangs, launch time, memory, CPU, aggregated with no PII. Xcode Organizer: crashes, energy, disk writes.",
          "KPIs: crash-free users ≥ 99.5%, launch time < 400 ms, network error rate per endpoint.",
        ],
      },
    ],
  },
];
