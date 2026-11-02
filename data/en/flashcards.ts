import { Flashcard } from "../types";

export const flashcards: Flashcard[] = [
  // Swift core
  { id: "f1", topic: "swift", front: "How do you access the third character of a String in Swift?", back: "A String isn't indexed with Int. Convert it to an array: `Array(str)[2]`, or use `str[str.index(str.startIndex, offsetBy: 2)]`.", code: "let chars = Array(\"hello\")\nprint(chars[2]) // l" },
  { id: "f2", topic: "swift", front: "What does `Int(\"3.0\")` return?", back: "`nil`. `Int(_:)` only parses integers. Use `Double(\"3.0\")` and then `Int(...)`." },
  { id: "f3", topic: "swift", front: "Difference between `sorted()` and `sort()`", back: "`sorted()` returns a sorted copy (works on `let`). `sort()` mutates in place (requires `var`)." },
  { id: "f4", topic: "swift", front: "Count character frequencies in one line", back: "Use the subscript with `default:`.", code: "var counts: [Character: Int] = [:]\nfor c in text { counts[c, default: 0] += 1 }" },
  { id: "f5", topic: "swift", front: "`map` vs `compactMap` vs `flatMap`", back: "`map` transforms 1→1. `compactMap` transforms and drops `nil`. `flatMap` flattens nested collections (or `Optional<Optional>`)." },
  { id: "f6", topic: "swift", front: "How do you detect a duplicate in O(n)?", back: "With a `Set`: `insert` returns a tuple `(inserted, memberAfterInsert)`.", code: "var seen = Set<Int>()\nfor x in nums { if !seen.insert(x).inserted { return x } }\nreturn -1" },
  { id: "f7", topic: "swift", front: "`struct` vs `class`", back: "struct = value type (copied, no inheritance, immutable with `let`). class = reference type (shared, inheritance, ARC, `deinit`). Prefer struct unless you need shared identity." },
  { id: "f8", topic: "swift", front: "What does `guard let` do?", back: "Unwraps an optional and forces you to exit the scope (`return`, `throw`, `continue`) if it's `nil`. The variable stays available after the guard." },
  { id: "f9", topic: "swift", front: "Sort by two criteria (score desc, name asc)", back: "Compare the first one; on a tie, the second.", code: "items.sorted { $0.score != $1.score ? $0.score > $1.score : $0.name < $1.name }" },
  { id: "f10", topic: "swift", front: "How do you reverse the words of a sentence?", back: "`split` → `reversed` → `joined`.", code: "s.split(separator: \" \").reversed().joined(separator: \" \")" },
  { id: "f11", topic: "swift", front: "What happens with `7 / 2` in Swift?", back: "It gives `3`: integer division between `Int`s. For a decimal result: `7.0 / 2` or `Double(7) / 2`." },
  { id: "f12", topic: "swift", front: "What is `inout` for?", back: "It lets a function modify the original argument. It's called with `&`: `swap(&a, &b)`." },
  { id: "f13", topic: "swift", front: "Group elements by a key", back: "`Dictionary(grouping:by:)`.", code: "let byCurrency = Dictionary(grouping: txs, by: { $0.currency })" },
  { id: "f14", topic: "swift", front: "What is a retain cycle and how do you break it?", back: "Two objects retain each other (or a closure retains `self`, which retains the closure). Break it with `[weak self]` or `unowned`, or with `weak var delegate`." },
  { id: "f15", topic: "swift", front: "`weak` vs `unowned`", back: "`weak` is optional and becomes `nil` when the object is released. `unowned` isn't optional and crashes if the object no longer exists; use it only if the other object always outlives it." },
  { id: "f16", topic: "swift", front: "How do you iterate with index and value?", back: "`for (i, x) in nums.enumerated()`." },
  { id: "f17", topic: "swift", front: "Loop from 10 down to 0 in steps of 2", back: "`for i in stride(from: 10, through: 0, by: -2)`." },
  { id: "f18", topic: "swift", front: "Enum with associated values", back: "Each case can carry different data; extract it with `switch` or `if case`.", code: "enum Result { case ok(Int); case fail(String) }\nif case .ok(let v) = r { print(v) }" },

  // Algorithms
  { id: "a1", topic: "algoritmos", front: "Complexity of searching a `Set` vs an `Array`", back: "`Set.contains` O(1) average. `Array.contains` O(n). Sorted `Array` + binary search O(log n)." },
  { id: "a2", topic: "algoritmos", front: "Pattern: maximum sum of a window of size k", back: "Sliding window: compute the first window, then slide by adding the incoming element and subtracting the outgoing one. O(n)." },
  { id: "a3", topic: "algoritmos", front: "Pattern: balanced parentheses", back: "Stack. On an opening bracket, push; on a closing one, pop and compare. At the end the stack must be empty." },
  { id: "a4", topic: "algoritmos", front: "Pattern: two pointers", back: "Two indices moving in from both ends or at different speeds. Useful for palindromes, pairs summing to X in a sorted array, removing duplicates in place." },
  { id: "a5", topic: "algoritmos", front: "When should you use a hash map in a coding challenge?", back: "When you need to look up, count or group in O(1): duplicates, frequencies, two-sum, anagrams." },
  { id: "a6", topic: "algoritmos", front: "Complexity of sorting and of a `Dictionary` lookup", back: "Sorting: O(n log n). Dictionary lookup: O(1) average. Appending to an Array: O(1) amortized; inserting at the start: O(n)." },
  { id: "a7", topic: "algoritmos", front: "Which edge cases do you always test?", back: "Empty, one element, all equal, negatives, k > n, Unicode/uppercase, range bounds (`..<` vs `...`)." },

  // Engineering
  { id: "e1", topic: "ingenieria", front: "SOLID, one line each", back: "S: one reason to change. O: open for extension, closed for modification. L: subtypes are substitutable. I: small interfaces. D: depend on abstractions." },
  { id: "e2", topic: "ingenieria", front: "`git rebase` vs `git merge`", back: "merge creates a merge commit and preserves history. rebase rewrites your commits on top of the base (new hashes, linear history). Don't rebase shared branches." },
  { id: "e3", topic: "ingenieria", front: "Testing pyramid", back: "Many unit tests (fast, isolated), fewer integration tests, few end-to-end/UI tests (slow, brittle)." },
  { id: "e4", topic: "ingenieria", front: "Repository pattern", back: "Abstracts data access behind a protocol (`UserRepository`), so the domain doesn't know whether data comes from the network, cache or disk." },
  { id: "e5", topic: "ingenieria", front: "Strategy vs Factory pattern", back: "Strategy: swap algorithms at runtime via a protocol. Factory: centralize object creation based on some criterion." },

  // REST
  { id: "r1", topic: "rest", front: "401 vs 403", back: "401 Unauthorized: not authenticated, or the token is invalid/expired. 403 Forbidden: authenticated but without permission." },
  { id: "r2", topic: "rest", front: "Idempotent verbs", back: "GET, PUT, DELETE, HEAD, OPTIONS. POST and PATCH are not (in general)." },
  { id: "r3", topic: "rest", front: "Structure of a JWT", back: "`header.payload.signature` in base64url. The signature is verified; the payload isn't encrypted, only encoded. `exp` marks the expiration." },
  { id: "r4", topic: "rest", front: "Where do you store the token on iOS?", back: "Keychain (encrypted by the system). Never in UserDefaults or a plain file." },
  { id: "r5", topic: "rest", front: "What is a BFF?", back: "Backend For Frontend: an API layer specific to the mobile client that aggregates and adapts several services into a single response." },
  { id: "r6", topic: "rest", front: "Status codes 201, 204, 409, 422, 429", back: "201 created. 204 no content. 409 conflict. 422 unprocessable entity (validation). 429 too many requests." },

  // iOS
  { id: "i1", topic: "ios", front: "`@StateObject` vs `@ObservedObject`", back: "`@StateObject`: the view owns it and creates it only once. `@ObservedObject`: the view receives it from outside and doesn't control its lifecycle." },
  { id: "i2", topic: "ios", front: "`@State` vs `@Binding`", back: "`@State` is the view's own private state. `@Binding` is a read/write reference to state that lives in another view." },
  { id: "i3", topic: "ios", front: "Layers of MVVM + Clean", back: "View → ViewModel → UseCase (domain) → Repository (protocol) → DataSource (network/local). Dependencies point toward the domain." },
  { id: "i4", topic: "ios", front: "`async/await` vs Combine", back: "async/await: one-off operations (a single request). Combine: continuous streams of values (search with debounce, reactive state). Today async/await + `@Observable` is preferred, with Combine only where there are streams." },
  { id: "i5", topic: "ios", front: "What does `@MainActor` do?", back: "Guarantees the marked code runs on the main thread. ViewModels that update the UI are usually marked `@MainActor`." },
  { id: "i6", topic: "ios", front: "`actor` in Swift", back: "A reference type that protects its mutable state: only one access at a time, with calls from outside using `await`. Prevents data races." },
  { id: "i7", topic: "ios", front: "Dependency injection without a framework", back: "Protocols + initializers. A composition root (AppContainer) builds the graph. In tests you inject mocks." },
  { id: "i8", topic: "ios", front: "`Task` and cancellation", back: "`Task { }` creates concurrent work; `.task {}` in SwiftUI cancels it when the view disappears. Check `Task.isCancelled` or `try Task.checkCancellation()`." },
  { id: "i9", topic: "ios", front: "UIViewController lifecycle", back: "init → loadView → viewDidLoad → viewWillAppear → viewDidAppear → viewWillDisappear → viewDidDisappear → deinit." },
  { id: "i10", topic: "ios", front: "`@Observable` (iOS 17+)", back: "A macro that replaces `ObservableObject`/`@Published`: the view observes only the properties it reads. Used with `@State` (owner) or by passing the instance." },

  // Security
  { id: "s1", topic: "seguridad", front: "Keychain vs UserDefaults", back: "Keychain: encrypted, survives reinstall depending on configuration, for secrets. UserDefaults: unencrypted plist, for preferences." },
  { id: "s2", topic: "seguridad", front: "Certificate pinning", back: "Verify that the server's certificate (or its public key) matches one embedded in the app. Mitigates MITM. Implemented in the `URLSessionDelegate` `didReceive challenge` method." },
  { id: "s3", topic: "seguridad", front: "Face ID / Touch ID in code", back: "`LAContext().evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, ...)`. Call `canEvaluatePolicy` first to know whether it's available; have a fallback to the passcode." },
  { id: "s4", topic: "seguridad", front: "OWASP Mobile Top 10 (some of them)", back: "Improper credential usage, inadequate supply chain security, insecure authentication/authorization, insufficient input validation, insecure communication, inadequate privacy controls, insufficient binary protections, security misconfiguration, insecure data storage, insufficient cryptography." },
  { id: "s5", topic: "seguridad", front: "ATS (App Transport Security)", back: "Enforces HTTPS/TLS 1.2+. Don't add `NSAllowsArbitraryLoads` in production." },
  { id: "s6", topic: "seguridad", front: "Token refresh with concurrent requests", back: "Serialize the refresh: a single refresh request in flight (actor or lock); the others wait and retry with the new token." },

  // Testing / release
  { id: "t1", topic: "testing", front: "XCTest vs XCUITest", back: "XCTest: unit tests of logic (ViewModel, use cases) with mocks. XCUITest: end-to-end UI tests against the real app through accessibility." },
  { id: "t2", topic: "testing", front: "How do you mock the network?", back: "An injected `HTTPClient` protocol; in tests, an implementation that returns fixed data. Or a custom `URLProtocol` to intercept `URLSession`." },
  { id: "t3", topic: "testing", front: "Key Instruments tools", back: "Time Profiler (CPU), Allocations and Leaks (memory), Network, Core Animation (frames), Energy." },
  { id: "t4", topic: "testing", front: "Release flow", back: "Release branch → bump version/build → archive → internal TestFlight → external (beta review) → App Store review → phased release → crash monitoring." },
  { id: "t5", topic: "testing", front: "Quality metrics in production", back: "Crash-free users/sessions (Crashlytics), hangs and launch time (MetricKit/Organizer), network error rate, ANR equivalents." },
];
