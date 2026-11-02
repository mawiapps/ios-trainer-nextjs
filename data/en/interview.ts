import { InterviewQuestion } from "../types";

export const interviewQuestions: InterviewQuestion[] = [
  {
    id: "iv1", topic: "ios",
    question: "How do you structure an iOS app with MVVM + Clean Architecture? Name the layers and what depends on what.",
    keyPoints: ["View (SwiftUI) only renders and sends intents", "ViewModel exposes observable state and calls use cases", "UseCase encapsulates a business rule", "Repository is a protocol defined in the domain", "Remote/local DataSource implements the repository", "Dependencies point toward the domain (Dependency Rule)", "SPM modules per feature or per layer"],
    modelAnswer: "I split it into Presentation (View + ViewModel), Domain (entities, use cases, repository protocols) and Data (repository implementations, DTOs, API client, persistence). The View observes the ViewModel; the ViewModel orchestrates use cases; use cases depend on protocols, never on implementations. Data implements those protocols and maps DTO → entity. A composition root builds the graph with initializer injection. Each layer lives in its own SPM package to enforce the direction of dependencies and speed up builds.",
  },
  {
    id: "iv2", topic: "ios",
    question: "When do you use Combine and when async/await? Give an example of each.",
    keyPoints: ["async/await for one-off operations: a single request, reading from disk", "Combine for continuous streams: search with debounce, reactive state, multiple sources", "Key operators: debounce, removeDuplicates, switchToLatest, combineLatest", "Bridge: `.values` turns a Publisher into an AsyncSequence", "Structured concurrency: Task, TaskGroup, cancellation"],
    modelAnswer: "To load the profile I do `let profile = try await repo.profile()` inside a `Task` in a ViewModel marked @MainActor: simple, linear, with errors handled via try/catch. For a search box I use Combine: the text is a Publisher to which I apply debounce(300ms), removeDuplicates and a map to a request with switchToLatest to cancel the previous one. Where both coexist, I use `.values` to consume a Publisher as an AsyncSequence.",
  },
  {
    id: "iv3", topic: "seguridad",
    question: "Where do you store a JWT and a refresh token on iOS, and why? How do you handle the refresh when several requests fail with 401 at the same time?",
    keyPoints: ["Keychain with kSecAttrAccessibleWhenUnlockedThisDeviceOnly", "Never UserDefaults or files", "Short-lived access token in memory + Keychain; refresh token only in Keychain", "Session interceptor/actor that serializes the refresh", "A single refresh in flight; the others wait and retry", "If the refresh fails → logout and clear the Keychain"],
    modelAnswer: "Both go in the Keychain with WhenUnlockedThisDeviceOnly accessibility so they don't travel in backups. I cache the access token in memory so I don't read the Keychain on every request. I have an `actor TokenProvider` with `func validToken() async throws -> String`: if the token is expired or a 401 comes back, it starts a single refresh and stores the in-flight Task; concurrent calls `await` that same Task and then retry once. If the refresh returns 401, I clear the session and navigate to login.",
  },
  {
    id: "iv4", topic: "seguridad",
    question: "How do you protect the traffic and data of a financial app?",
    keyPoints: ["TLS 1.2+ with ATS enabled", "Certificate/public key pinning with rotation", "Never log PII or tokens", "Keychain for secrets; Data Protection for files", "Jailbreak and debugger detection as a signal", "Hide content in the app switcher", "Session and inactivity timeout", "OWASP Mobile Top 10 as a checklist"],
    modelAnswer: "Network layer: HTTPS with ATS, public key pinning in `urlSession(_:didReceive:)` with a backup pin for rotation, no `NSAllowsArbitraryLoads`. Data: secrets in the Keychain, files with `.completeFileProtection`, nothing sensitive in UserDefaults or logs. App: hide the screen when going to the background, lock on inactivity, biometrics for sensitive operations, jailbreak/hook detection as a risk signal (not a hard block). I review against the OWASP Mobile Top 10 on every release and automate it with MobSF or similar in CI.",
  },
  {
    id: "iv5", topic: "seguridad",
    question: "How do you integrate Face ID / Touch ID, and what do you do if the user hasn't set it up?",
    keyPoints: ["LocalAuthentication: LAContext", "canEvaluatePolicy before evaluatePolicy", ".deviceOwnerAuthenticationWithBiometrics vs .deviceOwnerAuthentication (includes passcode)", "NSFaceIDUsageDescription in Info.plist", "Handle LAError: userCancel, biometryNotEnrolled, lockout", "Biometrics unlock a Keychain secret, they don't replace the backend"],
    modelAnswer: "I use `LAContext`: first `canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)`; if it fails with biometryNotEnrolled I offer `.deviceOwnerAuthentication` (passcode) or the regular login. On success, I read from the Keychain a refresh token stored with a biometric `SecAccessControl` and ask the backend for a new access token: biometrics only unlock the local secret, real authorization still belongs to the server. I handle cancellation and lockout without locking the user out.",
  },
  {
    id: "iv6", topic: "swift",
    question: "What is a retain cycle, how do you detect it and how do you avoid it in closures and in Combine?",
    keyPoints: ["Two mutual strong references → ARC never releases", "Closure that captures self + self retains the closure", "Detection: Instruments Leaks/Allocations, Memory Graph Debugger, deinit with print", "[weak self] + guard let", "unowned only when guaranteed", "delegate as weak var", "In Combine: [weak self] in sink/map, store(in:) with cancellables"],
    modelAnswer: "A retain cycle is when two objects hold strong references to each other and ARC can't reach zero. The typical case is an escaping closure that captures `self` while `self` stores the closure (or the AnyCancellable that holds it). I detect it with the Memory Graph Debugger and with Leaks/Allocations in Instruments, and in tests with a `weak var sut` that must be nil after releasing it. I avoid it with `[weak self]` and `guard let self`, `weak` delegates, and in Combine by capturing weak in sink and storing cancellables in a Set that dies with its owner.",
  },
  {
    id: "iv7", topic: "ios",
    question: "How do you design dependency injection without a framework?",
    keyPoints: ["Protocols for each dependency", "Initializer injection (preferred) or property injection", "Composition root / AppContainer at the entry point", "Factories or closures for lazy dependencies", "In SwiftUI: Environment for cross-cutting services", "Mocks in tests by conforming to the protocol"],
    modelAnswer: "I define protocols (`ProfileRepository`, `HTTPClient`) and each type receives its dependencies through its initializer. An `AppContainer` at the app entry point builds the real implementations once and exposes ViewModel factories. In SwiftUI I pass cross-cutting services through the Environment. In tests I instantiate the ViewModel with fakes that conform to the protocol. No reflection, no service locator: the compiler tells me if something is missing.",
  },
  {
    id: "iv8", topic: "testing",
    question: "What do you test with XCTest and what with XCUITest? How do you mock the network?",
    keyPoints: ["XCTest: ViewModels, use cases, mappers, formatters", "XCUITest: critical flows (login, payment) via accessibilityIdentifier", "Network mock: HTTPClient protocol with a stub, or a custom URLProtocol", "async tests with `await` and expectations", "Optional snapshot tests for UI", "Deterministic tests: inject Clock/Date and UUID"],
    modelAnswer: "Unit tests with XCTest for all the logic: ViewModels, use cases, DTO→model mappers, with fake dependencies. For the network, I inject an `HTTPClient` protocol and in tests use a stub that returns fixed JSON or errors; when I want to test the real client I use a `URLProtocol` that intercepts `URLSession`. XCUITest only for 3–5 critical flows (onboarding, biometric login, transfer) with stable identifiers, because they're slow. Everything runs in CI on every PR.",
  },
  {
    id: "iv9", topic: "testing",
    question: "Explain the release flow: branch, build number, internal/external TestFlight, App Store review, phased release, rollback.",
    keyPoints: ["Frozen release/x.y branch", "Version (marketing) vs incremental build number", "Signed archive + upload (Xcode Cloud/Fastlane)", "Internal TestFlight without review, external with beta review", "App Store review: notes, demo account, compliance", "7-day phased release, pausable", "Rollback = new hotfix build; you can't go back to the previous one", "Feature flags to turn off functionality without a release"],
    modelAnswer: "I cut `release/x.y`, bump the build number automatically in CI and archive with Fastlane. First internal TestFlight (QA and the team), then external to a group of beta users after beta review. I submit for review with notes and a test account. I publish with phased release so the 1% on day one surfaces crashes; if something breaks I pause the rollout, turn the feature off with a remote flag and prepare a hotfix with expedited review. I monitor crash-free users in Crashlytics for the first 48 h.",
  },
  {
    id: "iv10", topic: "testing",
    question: "How do you monitor crashes and metrics in production?",
    keyPoints: ["Crashlytics or Sentry with uploaded dSYMs", "MetricKit: hangs, launch time, memory, CPU", "Xcode Organizer: crashes, energy, disk writes", "Crash-free users/sessions as a KPI", "Regression alerts per version", "Structured logs without PII, OSLog with categories"],
    modelAnswer: "Crashlytics with dSYMs uploaded automatically in CI for symbolicated stack traces, alerts for new crashes and for drops in crash-free users per version. MetricKit gives me aggregated hangs, launch time and memory without PII. I instrument key events (login, payment) with our own analytics to measure error rate and latency. Xcode Organizer as a second source. A dashboard per release and a weekly review of the top 5 crashes.",
  },
  {
    id: "iv11", topic: "ios",
    question: "How do you modularize a large app with SPM, and what do you gain?",
    keyPoints: ["Packages per layer (Core, Networking, Design System) and per feature", "Explicit dependencies in Package.swift", "Faster incremental builds and per-module previews", "Ownership per team", "Small public interfaces; `internal` by default", "Demo apps per feature to iterate"],
    modelAnswer: "I split it into local packages: `Core` (models, utilities), `Networking`, `DesignSystem`, and one package per feature (`Payments`, `Profile`) that depends on interfaces, not on other features. The app is a shell that composes everything. I gain incremental build times, previews that compile quickly, dependency boundaries the compiler enforces and clear ownership per team. Each feature has its own demo app so you can iterate without spinning up the whole banking app.",
  },
  {
    id: "iv12", topic: "ios",
    question: "What's the difference between @StateObject and @ObservedObject, and what changes with @Observable in iOS 17+?",
    keyPoints: ["@StateObject: the view creates and owns it; survives re-renders", "@ObservedObject: injected from outside; can be recreated", "@EnvironmentObject to share across the tree", "@Observable: macro, no @Published, tracking per property read", "With @Observable you use @State to own it and pass the instance", "@Bindable for bindings to an @Observable"],
    modelAnswer: "`@StateObject` is used by the view that creates the object: SwiftUI instantiates it once and keeps it even when the view is redrawn. `@ObservedObject` is for an object that comes in as a parameter; if the parent is recreated, the object can be recreated. With `@Observable`, `@Published` goes away: the view is invalidated only when a property it actually read changes, so fewer renders. The owner declares it with `@State`, children receive it as a regular parameter and use `@Bindable` for bindings.",
  },
  {
    id: "iv13", topic: "rest",
    question: "How do you define contracts with the backend team, and what is a BFF?",
    keyPoints: ["OpenAPI as the source of truth", "Versioning and backward compatibility", "BFF: endpoint tailored to the mobile client that aggregates several services", "Codable with DTOs separate from the domain", "Standard error handling (code + message + traceId)", "Cursor-based pagination", "Mock server to develop in parallel"],
    modelAnswer: "We agree on the contract in OpenAPI before coding; we generate Codable DTOs and a mock server to move forward in parallel. The BFF exposes endpoints designed for the screen: for example `/home` returns the balance, latest transactions and promotions in a single call instead of three services. We define a common error envelope with a code and traceId, cursor-based pagination and header-based versioning so we don't break old apps.",
  },
  {
    id: "iv14", topic: "ios",
    question: "How do you optimize performance with Instruments? Describe a real case.",
    keyPoints: ["Time Profiler for CPU and the main thread", "Allocations/Leaks for memory", "Core Animation / Animation Hitches for scrolling", "Network for latency and payload size", "Measure before and after; signposts (os_signpost)", "Typical causes: work on the main thread, images without downsampling, expensive layouts"],
    modelAnswer: "First I measure: Time Profiler with 'hide system libraries' to see my code on the main thread. Typical case: a list with hitches because it decoded JSON and created formatters in every cell; I moved the decoding to the background, cached the formatters and brought the frame time down from 30 ms to 4 ms. For memory I use Allocations with generation marks to see what grows between navigations. I leave `os_signpost` at the critical points to measure in production with MetricKit.",
  },
];
