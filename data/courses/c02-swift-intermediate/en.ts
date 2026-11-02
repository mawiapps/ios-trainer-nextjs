import type { CourseContent } from "../types";

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "structs-classes",
      title: "Structs vs classes: copy or reference",
      goal: "Predict what happens when you assign, pass or mutate a struct or a class, and avoid the bug of sharing one instance across screens.",
      minutes: 14,
      steps: [
        {
          kind: "explain",
          title: "Value types and reference types",
          body: [
            "`struct` and `enum` are **value types**: assigning one or passing it to a function makes a copy. Changing the copy leaves the original alone.",
            "`class` is a **reference type**: the variable holds a reference to the object. Two variables can point at the same object, and a change made through one shows up through the other.",
            "In modern Swift the default is `struct`. Reach for `class` when you need shared identity (an object several parts of the app observe), inheritance, or UIKit/Objective-C interop.",
          ],
          code: `struct Point { var x: Int }
var a = Point(x: 1)
var b = a          // copy
b.x = 99
print(a.x, b.x)

final class Counter { var value = 0 }
let c1 = Counter()
let c2 = c1        // same instance
c2.value = 5
print(c1.value, c2.value)`,
          output: "1 99\n5 5",
        },
        {
          kind: "predict",
          code: `struct User { var name: String }

final class Session {
    var user: User
    init(user: User) { self.user = user }
}

let session = Session(user: User(name: "Ana"))
var draft = session.user
draft.name = "Bea"
print(session.user.name)`,
          options: ["`Bea`", "`Ana`", "Compile error: `session` is a `let`", "`Optional(\"Ana\")`"],
          answer: 1,
          explanation: "`session.user` is a struct, so `var draft = session.user` makes a copy. Changing `draft.name` doesn't touch the `user` stored in the session, so it prints `Ana`.",
        },
        {
          kind: "explain",
          title: "`mutating` and `let`",
          body: [
            "A struct method that changes properties must be marked `mutating`: it's effectively replacing the whole value of `self`.",
            "`let` on a struct freezes the **entire** value: no property changes, no `mutating` calls.",
            "`let` on a class freezes only the **reference**: you can't point it at another object, but you can still change its `var` properties.",
          ],
          code: `struct Cart {
    var items: [String] = []
    mutating func add(_ item: String) { items.append(item) }
}

var cart = Cart()
cart.add("Mate")
print(cart.items)

let fixedCart = Cart()
// fixedCart.add("Yerba")  // error: cannot use mutating member on immutable value

final class Store { var items: [String] = [] }
let store = Store()
store.items.append("Mate")  // OK: let pins the reference, not the object
print(store.items.count)`,
          output: "[\"Mate\"]\n1",
        },
        {
          kind: "fill",
          prompt: "Fill in the keyword that lets this struct method modify `count`.",
          code: `struct Stepper {
    var count = 0
    ____ func increment() { count += 1 }
}`,
          accept: ["^mutating$"],
          explanation: "Without `mutating` the compiler rejects `count += 1`: inside a regular struct method, `self` is immutable.",
          placeholder: "keyword",
        },
        {
          kind: "explain",
          title: "Copy-on-write and `final class`",
          body: [
            "Copying a 10,000-element array costs nothing... until you mutate it. `Array`, `Dictionary`, `Set` and `String` use **copy-on-write**: copies share the buffer and only duplicate it when one of them changes.",
            "Careful: your own structs don't get copy-on-write for free. If a struct stores a class instance, copying the struct copies the **reference**, and both copies share that object.",
            "`final class` forbids subclassing. It's a good default: it documents intent and lets the compiler use static dispatch.",
          ],
          code: `var original = [1, 2, 3]
var copy = original   // still sharing the buffer
copy.append(4)        // the copy happens here (copy-on-write)
print(original)
print(copy)`,
          output: "[1, 2, 3]\n[1, 2, 3, 4]",
        },
        {
          kind: "predict",
          code: `final class Box { var value = 0 }

struct Holder {
    var box = Box()
    var count = 0
}

var h1 = Holder()
var h2 = h1
h2.count = 1
h2.box.value = 7
print(h1.count, h1.box.value)`,
          options: ["`0 0`", "`1 7`", "`0 7`", "`1 0`"],
          answer: 2,
          explanation: "`h2` is a copy of `h1`, so `count` is independent (`h1.count` stays 0). But `box` is a class: copying the struct copied the reference, and both point at the same `Box`. That's why `h1.box.value` is 7.",
        },
        {
          kind: "explain",
          title: "The real bug: one instance shared across screens",
          body: [
            "Classic on-call ticket: the search screen and the favorites screen get the same filter object. The user toggles a filter in favorites and search \"breaks on its own\".",
            "With a class, both screens point at the same object. With a struct, each screen gets its own copy and changes stay isolated.",
            "If you actually want shared state (a global cart), use a class on purpose and make it observable (`@Observable` on iOS 17, `ObservableObject` before that). The problem is sharing **by accident**.",
          ],
          code: `final class FilterSettings {
    var onlyAvailable = false
}

let defaults = FilterSettings()
let searchFilters = defaults
let favoritesFilters = defaults

favoritesFilters.onlyAvailable = true
print(searchFilters.onlyAvailable)`,
          output: "true",
        },
        {
          kind: "predict",
          prompt: "Which line does **not** compile?",
          code: `struct Profile { var name = "" }
final class Account { var name = "" }

let profile = Profile()
let account = Account()
account.name = "Ana"   // line A
profile.name = "Bea"   // line B`,
          options: ["Both", "Neither", "Only line A", "Only line B"],
          answer: 3,
          explanation: "`profile` is a struct declared with `let`: the whole value is immutable, so line B fails. `account` is a class: `let` pins the reference but the `var name` property can change, so line A compiles.",
        },
        {
          kind: "write",
          prompt: "Turn `FilterSettings` into a struct so each screen gets its own copy. `toggle()` must keep working.",
          starter: `final class FilterSettings {
    var onlyAvailable = false
    func toggle() { onlyAvailable.toggle() }
}`,
          checks: [
            { pattern: "\\bstruct\\s+FilterSettings\\b", label: "`FilterSettings` is a struct" },
            { pattern: "\\bmutating\\s+func\\s+toggle\\s*\\(", label: "`toggle()` is `mutating`" },
            { pattern: "\\bvar\\s+onlyAvailable\\b", label: "Keeps `onlyAvailable` as a `var`" },
          ],
          warnings: [{ pattern: "\\bclass\\s+FilterSettings\\b", label: "Still a class: screens share the instance" }],
          solution: `struct FilterSettings {
    var onlyAvailable = false
    mutating func toggle() { onlyAvailable.toggle() }
}`,
          hint: "Swap `final class` for `struct` and see what the compiler asks for on the method.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "enums",
      title: "Enums: raw values, associated values and screen state",
      goal: "Model closed sets of options with enums, pull data out with `switch`, and replace combinations of booleans with valid states.",
      minutes: 14,
      steps: [
        {
          kind: "explain",
          title: "Raw values and `CaseIterable`",
          body: [
            "An enum with a raw value (`String`, `Int`) maps each case to a fixed value. With `String`, if you don't set one, the raw value is the case name. With `Int`, the following cases auto-increment.",
            "`init?(rawValue:)` is failable: it returns `nil` when the value doesn't exist. Very handy when reading external data.",
            "`CaseIterable` synthesizes `allCases`, great for building a picker or a list of filters.",
          ],
          code: `enum Weekday: String, CaseIterable {
    case monday, tuesday, wednesday
}
print(Weekday.monday.rawValue)
print(Weekday(rawValue: "friday") as Any)
print(Weekday.allCases.count)

enum HTTPStatus: Int {
    case ok = 200, notFound = 404
}
print(HTTPStatus.notFound.rawValue)`,
          output: "monday\nnil\n3\n404",
        },
        {
          kind: "predict",
          code: `enum Planet: Int, CaseIterable {
    case mercury = 1, venus, earth
}
print(Planet.earth.rawValue, Planet.allCases.count, Planet(rawValue: 2)!)`,
          options: ["`2 3 venus`", "`3 2 venus`", "`3 3 venus`", "`3 3 Planet.venus`"],
          answer: 2,
          explanation: "`mercury = 1`, so `venus` is 2 and `earth` is 3. `allCases` has 3 cases. `Planet(rawValue: 2)!` is `.venus`, and printing a case shows just its name: `venus`.",
        },
        {
          kind: "explain",
          title: "Associated values and pattern matching",
          body: [
            "Each case can carry its own data: `case card(last4: String)`. It's how you say \"it's either this with this data, or that with that other data\".",
            "In a `switch` you extract data with `let`, ignore it with `_`, and filter with `where`. The `switch` must be exhaustive: add a case tomorrow and the compiler flags every place you need to update.",
          ],
          code: `enum Payment {
    case cash
    case card(last4: String)
    case transfer(amount: Double, reference: String)
}

func describe(_ payment: Payment) -> String {
    switch payment {
    case .cash:
        return "Cash"
    case .card(let last4):
        return "Card ****\\(last4)"
    case .transfer(let amount, _) where amount > 1000:
        return "Large transfer"
    case .transfer:
        return "Transfer"
    }
}

print(describe(.card(last4: "4242")))
print(describe(.transfer(amount: 5000, reference: "A1")))`,
          output: "Card ****4242\nLarge transfer",
        },
        {
          kind: "fill",
          prompt: "Fill in the keyword that adds an extra condition to the pattern.",
          code: `switch payment {
case .transfer(let amount, _) ____ amount > 1000:
    print("Ask for confirmation")
default:
    break
}`,
          accept: ["^where$"],
          explanation: "`where` adds a condition to the `case`: it only matches if the pattern matches **and** the condition is true.",
          placeholder: "keyword",
        },
        {
          kind: "explain",
          title: "Screen state: an enum instead of booleans",
          body: [
            "`isLoading: Bool`, `error: String?` and `items: [String]` give you 8 combinations, several of them impossible (loading **and** failed?). Every `if` in the view has to guess which one wins.",
            "An enum with associated values makes invalid states unrepresentable: it's loading, or it has data, or it failed with a message.",
            "Avoid `default` in these `switch` statements: if you add `.empty` later, you want the compiler to point at every screen.",
          ],
          code: `enum ScreenState {
    case loading
    case loaded([String])
    case failed(String)
}

func render(_ state: ScreenState) -> String {
    switch state {
    case .loading: return "Spinner"
    case .loaded(let items) where items.isEmpty: return "Empty"
    case .loaded(let items): return "\\(items.count) items"
    case .failed(let message): return "Error: \\(message)"
    }
}

print(render(.loaded([])))
print(render(.loaded(["a", "b"])))`,
          output: "Empty\n2 items",
        },
        {
          kind: "predict",
          code: `enum LoadState {
    case idle, loading, loaded(Int), failed
}

let states: [LoadState] = [.idle, .loaded(3), .failed, .loaded(0)]
var total = 0
for case .loaded(let n) in states {
    total += n
}
print(total)`,
          options: ["`0`", "`2`", "Compile error", "`3`"],
          answer: 3,
          explanation: "`for case .loaded(let n) in` only iterates over elements matching the pattern: `.loaded(3)` and `.loaded(0)`. 3 + 0 = 3.",
        },
        {
          kind: "write",
          prompt: "Replace the booleans with `enum ProfileState` with cases `loading`, `loaded(name: String)` and `failed(message: String)`. Then write `func title(for state: ProfileState) -> String` with an exhaustive `switch` (no `default`).",
          starter: `struct ProfileViewState {
    var isLoading = false
    var name: String?
    var errorMessage: String?
}`,
          checks: [
            { pattern: "\\benum\\s+ProfileState\\b", label: "Declares `enum ProfileState`" },
            { pattern: "\\bcase\\s+loading\\b", label: "`loading` case" },
            { pattern: "\\bcase\\s+loaded\\(\\s*name\\s*:\\s*String\\s*\\)", label: "`loaded(name: String)` case" },
            { pattern: "\\bcase\\s+failed\\(\\s*message\\s*:\\s*String\\s*\\)", label: "`failed(message: String)` case" },
            { pattern: "\\bfunc\\s+title\\s*\\(\\s*for\\s+state\\s*:\\s*ProfileState\\s*\\)\\s*->\\s*String", label: "Signature `title(for:) -> String`" },
            { pattern: "\\bswitch\\s+state\\b", label: "Uses `switch state`" },
          ],
          warnings: [
            { pattern: "\\bdefault\\s*:", label: "`default` hides any cases you add later" },
            { pattern: "\\bisLoading\\b", label: "There are still state booleans" },
          ],
          solution: `enum ProfileState {
    case loading
    case loaded(name: String)
    case failed(message: String)
}

func title(for state: ProfileState) -> String {
    switch state {
    case .loading:
        return "Loading…"
    case .loaded(let name):
        return name
    case .failed(let message):
        return "Error: \\(message)"
    }
}`,
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "closures",
      title: "Closures: syntax, capturing and `[weak self]`",
      goal: "Read and write closures in short form, understand what they capture, and know when `[weak self]` is needed and when it isn't.",
      minutes: 15,
      steps: [
        {
          kind: "explain",
          title: "From the long form to the short one",
          body: [
            "A closure is an unnamed function you can pass around as a value. The full form spells out parameters and return type; Swift lets you trim almost all of it because it infers it.",
            "**Trailing closure**: if the last parameter is a closure, it goes outside the parentheses. `$0`, `$1` are the arguments. With a single expression, `return` is implicit.",
          ],
          code: `let numbers = [3, 1, 2]

let ascending = numbers.sorted(by: { (x: Int, y: Int) -> Bool in
    return x < y
})
let descending = numbers.sorted { $0 > $1 }
let tens = numbers.map { $0 * 10 }

print(ascending, descending, tens)`,
          output: "[1, 2, 3] [3, 2, 1] [30, 10, 20]",
        },
        {
          kind: "predict",
          code: `let words = ["swift", "ios", "xcode"]
let result = words
    .filter { $0.count > 3 }
    .map { $0.uppercased() }
print(result)`,
          options: ["`[SWIFT, XCODE]`", "`[\"SWIFT\", \"XCODE\"]`", "`[\"SWIFT\", \"IOS\", \"XCODE\"]`", "`[\"IOS\"]`"],
          answer: 1,
          explanation: "`filter` keeps words longer than 3 letters (`swift`, `xcode`) and `map` uppercases them. An array of strings prints with quotes: `[\"SWIFT\", \"XCODE\"]`.",
        },
        {
          kind: "explain",
          title: "Closures capture",
          body: [
            "A closure can use variables from the context where it was created, even after that context is gone. It **captures them by reference**: it sees later changes.",
            "With a **capture list** (`[x]`) you copy the value at the moment the closure is created.",
          ],
          code: `func makeCounter() -> () -> Int {
    var count = 0
    return {
        count += 1
        return count
    }
}

let next = makeCounter()
print(next())
print(next())
let other = makeCounter()
print(other())`,
          output: "1\n2\n1",
        },
        {
          kind: "predict",
          prompt: "What do the two calls print, in order?",
          code: `var x = 1
let byReference = { print(x) }
let byValue = { [x] in print(x) }
x = 2
byReference()
byValue()`,
          options: ["`1` and `1`", "`2` and `2`", "`2` and `1`", "`1` and `2`"],
          answer: 2,
          explanation: "`byReference` captures the variable `x`: when it runs it sees the current value, 2. `byValue` uses the capture list `[x]`, which copied 1 when the closure was created.",
        },
        {
          kind: "explain",
          title: "`@escaping` and `[weak self]`",
          body: [
            "By default a closure parameter is **non-escaping**: it runs before the function returns (`map`, `filter`, `sorted`). If the function stores it or calls it later, the parameter must be `@escaping`.",
            "A retain cycle happens when `self` holds on (directly or indirectly) to a closure that in turn holds `self` strongly. That's where `[weak self]` goes.",
            "You do **not** need it in non-escaping closures, in a one-shot closure nobody stores (like `DispatchQueue.main.async`, which only delays deallocation), or in structs. ARC details come in course 3; in new code many of these callbacks become `async/await` (course 6).",
          ],
          code: `final class ProfileService {
    func fetchName(completion: @escaping (String) -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            completion("Ana")
        }
    }
}

final class ProfileViewModel {
    private let service = ProfileService()
    var name = ""

    func load() {
        service.fetchName { [weak self] name in
            self?.name = name
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "The function stores `completion` to call it once the response arrives. Fill in the missing attribute.",
          code: `func fetchName(completion: ____ (String) -> Void) {
    pending.append(completion)
}`,
          accept: ["^@escaping$"],
          explanation: "If the closure outlives the call (stored in a property or run later), it must be marked `@escaping`. Without it, the compiler won't let you store it.",
          placeholder: "attribute",
        },
        {
          kind: "predict",
          prompt: "Which of these closures creates a retain cycle without `[weak self]`?",
          code: `final class SearchViewModel {
    var results: [String] = []
    var onUpdate: (() -> Void)?
    let items = ["a", "b"]
    var suffix: String { "!" }

    func setup() {
        // A
        let upper = items.map { $0.uppercased() + self.suffix }
        // B
        onUpdate = { self.results = upper }
        // C
        DispatchQueue.main.async { self.results = [] }
    }
}`,
          options: ["Only B", "Only A", "A and C", "All three"],
          answer: 0,
          explanation: "A is non-escaping: `map` runs it and lets it go. C escapes, but GCD releases it after running; at most it delays `deinit`. B is stored in `onUpdate`, a property of `self`, and captures `self` strongly: `self` → closure → `self`. That's the cycle.",
        },
        {
          kind: "write",
          prompt: "`FeedViewModel` owns a `RefreshController` that stores the `onRefresh` closure. Fix the retain cycle by capturing `self` weakly and using `guard let self`.",
          starter: `final class RefreshController {
    var onRefresh: (() -> Void)?
}

final class FeedViewModel {
    let refresh = RefreshController()
    var items: [String] = []

    init() {
        refresh.onRefresh = {
            self.items = []
        }
    }
}`,
          checks: [
            { pattern: "\\[\\s*weak\\s+self\\s*\\]", label: "Captures `[weak self]`" },
            { pattern: "\\bguard\\s+let\\s+self\\b", label: "Unwraps with `guard let self`" },
            { pattern: "self\\.items\\s*=\\s*\\[\\s*\\]", label: "Still clears `items`" },
          ],
          warnings: [{ pattern: "\\[\\s*unowned\\s+self\\s*\\]", label: "`unowned` crashes if the closure runs after `self` is gone" }],
          solution: `final class RefreshController {
    var onRefresh: (() -> Void)?
}

final class FeedViewModel {
    let refresh = RefreshController()
    var items: [String] = []

    init() {
        refresh.onRefresh = { [weak self] in
            guard let self else { return }
            self.items = []
        }
    }
}`,
          hint: "The capture list goes before `in`: `{ [weak self] in ... }`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "error-handling",
      title: "Error handling: `throws`, `Result` and typed throws",
      goal: "Throw and catch your own errors, choose between `try`, `try?` and `try!`, use `Result`, and keep network errors apart from domain errors.",
      minutes: 15,
      steps: [
        {
          kind: "explain",
          title: "`throws`, `do/catch` and custom errors",
          body: [
            "An error is any type conforming to `Error`; most often an enum, with associated values when you need context.",
            "A `throws` function can `throw`. The caller marks the call with `try` and wraps it in `do/catch`, or propagates by being `throws` itself.",
            "`catch` clauses are evaluated in order: you can catch one specific case and leave a generic `catch` at the end, where `error` is implicitly available.",
          ],
          code: `enum LoginError: Error {
    case emptyEmail
    case shortPassword(minimum: Int)
}

func validate(email: String, password: String) throws {
    guard !email.isEmpty else { throw LoginError.emptyEmail }
    guard password.count >= 8 else { throw LoginError.shortPassword(minimum: 8) }
}

do {
    try validate(email: "ana@mail.com", password: "123")
    print("OK")
} catch LoginError.shortPassword(let minimum) {
    print("At least \\(minimum) characters")
} catch {
    print("Other error: \\(error)")
}`,
          output: "At least 8 characters",
        },
        {
          kind: "predict",
          prompt: "Which lines does it print, in order?",
          code: `enum ParseError: Error { case notANumber }

func parse(_ text: String) throws -> Int {
    guard let n = Int(text) else { throw ParseError.notANumber }
    return n
}

do {
    let a = try parse("4")
    print("a:", a)
    let b = try parse("x")
    print("b:", b)
} catch {
    print("error:", error)
}`,
          options: ["`a: 4` and `error: notANumber`", "Only `error: notANumber`", "`a: 4`, `b: 0` and `error: notANumber`", "`a: 4` and `error: ParseError.notANumber`"],
          answer: 0,
          explanation: "`parse(\"4\")` succeeds and prints `a: 4`. `parse(\"x\")` throws: the rest of the `do` is skipped and control jumps to `catch`. Printing a payload-less enum case shows just its name: `error: notANumber`.",
        },
        {
          kind: "explain",
          title: "`try?` and `try!`",
          body: [
            "`try?` turns the result into an optional: if it throws you get `nil` and the error is gone. Fine when you don't care why (a cache that may not exist). Pair it with `??` for a default.",
            "`try!` crashes if it throws. Only for cases that are impossible by construction (a JSON file bundled with the app that you control). In a PR, every `try!` needs a good reason.",
          ],
          code: `enum ParseError: Error { case notANumber }

func parse(_ text: String) throws -> Int {
    guard let n = Int(text) else { throw ParseError.notANumber }
    return n
}

let a = try? parse("12")
let b = try? parse("abc")
print(a as Any, b as Any)
print((try? parse("abc")) ?? 0)
let c = try! parse("7")   // crashes if it throws
print(c)`,
          output: "Optional(12) nil\n0\n7",
        },
        {
          kind: "fill",
          prompt: "You want `nil` when the text isn't a number, without `do/catch`. Fill it in.",
          code: `let age: Int? = ____ parse(input)`,
          accept: ["^try\\?$"],
          explanation: "`try?` returns an optional: the value on success, `nil` if it threw.",
          placeholder: "keyword",
        },
        {
          kind: "explain",
          title: "`Result` and typed throws (Swift 6)",
          body: [
            "`Result<Success, Failure>` stores a success or an error as a **value**: handy in callbacks and for keeping the outcome of an operation around. `.get()` turns it back into a `throws` call.",
            "Swift 6 adds **typed throws**: `throws(NetworkError)` declares exactly which error comes out. With `do throws(NetworkError)` the `catch` receives a `NetworkError`, not an `any Error`, and you can `switch` over it exhaustively.",
            "Use it for closed error sets inside a module or the domain. For general-purpose code, plain `throws` is still the recommendation: it doesn't lock you into one type if other errors show up later.",
          ],
          code: `enum NetworkError: Error {
    case offline
    case server(status: Int)
}

func fetchUser(id: Int) throws(NetworkError) -> String {
    guard id != 0 else { throw NetworkError.offline }
    guard id > 0 else { throw NetworkError.server(status: 404) }
    return "user-\\(id)"
}

func loadUser(id: Int) -> Result<String, NetworkError> {
    do throws(NetworkError) {
        return .success(try fetchUser(id: id))
    } catch {
        return .failure(error)   // error is already a NetworkError
    }
}

for id in [7, -1] {
    switch loadUser(id: id) {
    case .success(let user): print(user)
    case .failure(let error): print(error)
    }
}`,
          output: "user-7\nserver(status: 404)",
        },
        {
          kind: "predict",
          code: `enum CartError: Error { case outOfStock(String) }

let results: [Result<Int, CartError>] = [
    .success(2),
    .failure(.outOfStock("Mate")),
    .success(3),
]
let total = results.compactMap { try? $0.get() }.reduce(0, +)
print(total)`,
          options: ["`2`", "`5`", "`Optional(5)`", "Throws `outOfStock`"],
          answer: 1,
          explanation: "`$0.get()` returns the value or throws the error. `try?` makes it optional and `compactMap` drops the `nil`s, leaving `[2, 3]`. The sum is `5`, and it isn't optional because `reduce` works on `[Int]`.",
        },
        {
          kind: "explain",
          title: "Network errors vs domain errors",
          body: [
            "The network layer talks about HTTP status codes and being offline; the checkout screen talks about \"session expired\" or \"payment declined\". Let `APIError` bubble up to the view and the view ends up knowing about HTTP codes.",
            "Map at the boundary: the repository or use case translates `APIError` into a domain error the UI knows how to show.",
          ],
          code: `enum APIError: Error {
    case offline
    case status(Int)
    case decoding
}

enum CheckoutError: Error {
    case sessionExpired
    case paymentRejected
    case tryAgainLater
}

func map(_ error: APIError) -> CheckoutError {
    switch error {
    case .status(401): return .sessionExpired
    case .status(402): return .paymentRejected
    case .offline, .status, .decoding: return .tryAgainLater
    }
}

print(map(.status(401)))
print(map(.offline))`,
          output: "sessionExpired\ntryAgainLater",
        },
        {
          kind: "write",
          prompt: "Rewrite `validateAge` so it can't crash: declare `enum AgeError: Error` with `notANumber` and `outOfRange`, make the function `throws`, and throw the matching error (valid range: 0 to 120).",
          starter: `func validateAge(_ text: String) -> Int {
    return Int(text)!
}`,
          checks: [
            { pattern: "\\benum\\s+AgeError\\s*:\\s*Error\\b", label: "Declares `enum AgeError: Error`" },
            { pattern: "\\bcase\\s+notANumber\\b", label: "`notANumber` case" },
            { pattern: "\\boutOfRange\\b", label: "`outOfRange` case" },
            { pattern: "func\\s+validateAge\\s*\\([^)]*\\)\\s*throws\\b", label: "The function is `throws`" },
            { pattern: "\\bthrow\\s+(AgeError)?\\.notANumber\\b", label: "Throws `notANumber` when it can't convert" },
            { pattern: "\\bthrow\\s+(AgeError)?\\.outOfRange\\b", label: "Throws `outOfRange` when out of range" },
          ],
          warnings: [
            { pattern: "Int\\([^)]*\\)!", label: "`Int(...)!` crashes on invalid text" },
            { pattern: "\\btry!", label: "`try!` crashes in production" },
          ],
          solution: `enum AgeError: Error {
    case notANumber
    case outOfRange
}

func validateAge(_ text: String) throws -> Int {
    guard let age = Int(text) else { throw AgeError.notANumber }
    guard (0...120).contains(age) else { throw AgeError.outOfRange }
    return age
}`,
          hint: "Two `guard`s: one with `Int(text)` and one with `(0...120).contains(age)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "codable",
      title: "Codable: from JSON to models",
      goal: "Decode real-world JSON: snake_case, dates, optional fields, nested objects, and enum values the backend added without telling you.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Decodable in 5 lines",
          body: [
            "`Codable` is `Decodable & Encodable`. If every property is `Codable` (`String`, `Int`, `Double`, `Date`, `URL`, arrays, other `Codable` structs), the compiler writes all the code for you.",
            "`JSONDecoder().decode(Type.self, from: data)` throws a `DecodingError` when something doesn't match: a missing key, a different type, `null` where it wasn't expected.",
          ],
          code: `import Foundation

struct Product: Codable {
    let id: Int
    let name: String
    let price: Double
}

let json = Data(#"{"id": 1, "name": "Mate", "price": 12.5}"#.utf8)
let product = try JSONDecoder().decode(Product.self, from: json)
print(product.name, product.price)`,
          output: "Mate 12.5",
        },
        {
          kind: "predict",
          code: `struct User: Decodable {
    let name: String
    let nickname: String?
}

let data = Data(#"{"name": "Ana"}"#.utf8)
let user = try JSONDecoder().decode(User.self, from: data)
print(user.nickname ?? "no nickname")`,
          options: ["`nil`", "Throws `keyNotFound`", "`no nickname`", "`Optional(\"no nickname\")`"],
          answer: 2,
          explanation: "For an optional property the synthesized code uses `decodeIfPresent`: if the key is missing (or `null`) it becomes `nil` without an error. Then `??` gives `no nickname`. If `nickname` weren't optional, it would throw `keyNotFound`.",
        },
        {
          kind: "explain",
          title: "snake_case, `CodingKeys` and dates",
          body: [
            "`keyDecodingStrategy = .convertFromSnakeCase` turns `order_id` into `orderId` before looking up the property. Watch out: `avatar_url` becomes `avatarUrl`, not `avatarURL`.",
            "`CodingKeys` lets you rename by hand (`case rating = \"vote_average\"`). **Don't mix** the two: with `.convertFromSnakeCase`, the already-converted key (`voteAverage`) won't match `\"vote_average\"`.",
            "`dateDecodingStrategy = .iso8601` reads `\"2025-03-10T14:30:00Z\"`. It doesn't accept fractional seconds (`.123Z`): for that you need `.custom` with an `ISO8601DateFormatter` using `.withFractionalSeconds`.",
          ],
          code: `struct Order: Decodable {
    let orderId: Int
    let createdAt: Date
    let totalAmount: Double
}

let json = Data(#"{"order_id": 42, "created_at": "2025-03-10T14:30:00Z", "total_amount": 99.9}"#.utf8)

let decoder = JSONDecoder()
decoder.keyDecodingStrategy = .convertFromSnakeCase
decoder.dateDecodingStrategy = .iso8601

let order = try decoder.decode(Order.self, from: json)
print(order.orderId, order.totalAmount)`,
          output: "42 99.9",
        },
        {
          kind: "fill",
          prompt: "The backend sends `user_name` and your struct has `userName`. Fill in the strategy.",
          code: `let decoder = JSONDecoder()
decoder.keyDecodingStrategy = ____`,
          accept: ["^\\.convertFromSnakeCase$", "^JSONDecoder\\.KeyDecodingStrategy\\.convertFromSnakeCase$"],
          explanation: "`.convertFromSnakeCase` converts every `snake_case` key in the JSON to `camelCase` before comparing it with your properties.",
          placeholder: ".strategy",
        },
        {
          kind: "predict",
          code: `struct Movie: Decodable {
    let title: String
    let rating: Double

    enum CodingKeys: String, CodingKey {
        case title
        case rating = "vote_average"
    }
}

let decoder = JSONDecoder()
decoder.keyDecodingStrategy = .convertFromSnakeCase
let data = Data(#"{"title": "Dune", "vote_average": 8.1}"#.utf8)

do {
    let movie = try decoder.decode(Movie.self, from: data)
    print(movie.rating)
} catch {
    print("failed")
}`,
          options: ["`failed`", "`8.1`", "`0.0`", "`Optional(8.1)`"],
          answer: 0,
          explanation: "With `.convertFromSnakeCase` the decoder turns `vote_average` into `voteAverage` **before** the lookup. Your `CodingKey` says `\"vote_average\"`, which no longer exists: `keyNotFound`, so it lands in `catch`. Use only one of the two tools (or `case rating = \"voteAverage\"`).",
        },
        {
          kind: "explain",
          title: "`init(from:)`: nested objects and tolerant enums",
          body: [
            "When the JSON shape doesn't match your model, you write `init(from:)` by hand. `nestedContainer` steps into a nested object and `decodeIfPresent` reads a field that may be missing.",
            "The classic production incident: the backend adds `\"returned\"` to `status`, and older app versions with a synthesized enum fail to decode **the whole list**. An `init(from:)` on the enum that falls back to `.unknown` makes it tolerant.",
          ],
          code: `enum OrderStatus: String, Decodable {
    case pending, shipped, delivered
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = OrderStatus(rawValue: raw) ?? .unknown
    }
}

struct Shipment: Decodable {
    let status: OrderStatus
    let city: String

    enum CodingKeys: String, CodingKey { case status, address }
    enum AddressKeys: String, CodingKey { case city }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = try container.decode(OrderStatus.self, forKey: .status)
        let address = try container.nestedContainer(keyedBy: AddressKeys.self, forKey: .address)
        city = try address.decode(String.self, forKey: .city)
    }
}

let data = Data(#"{"status": "returned", "address": {"city": "Rosario"}}"#.utf8)
let shipment = try JSONDecoder().decode(Shipment.self, from: data)
print(shipment.status, shipment.city)`,
          output: "unknown Rosario",
        },
        {
          kind: "predict",
          code: `struct Item: Decodable {
    let name: String
    let tags: [String]

    enum CodingKeys: String, CodingKey { case name, tags }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        tags = try c.decodeIfPresent([String].self, forKey: .tags) ?? []
    }
}

let data = Data(#"[{"name": "a", "tags": ["x"]}, {"name": "b", "tags": null}]"#.utf8)
let items = try JSONDecoder().decode([Item].self, from: data)
print(items.map(\\.tags))`,
          options: ["`[[\"x\"], nil]`", "Throws `valueNotFound`", "`[[\"x\"]]`", "`[[\"x\"], []]`"],
          answer: 3,
          explanation: "`decodeIfPresent` returns `nil` whether the key is missing or set to `null`, and `?? []` turns that into an empty array. Both items decode: `[[\"x\"], []]`.",
        },
        {
          kind: "write",
          prompt: "The JSON is `{\"user_name\": \"ana\", \"signup_date\": \"2025-01-15T09:00:00Z\", \"bio\": null}`. Fill in `Account` with `userName`, `signupDate` and `bio` (may be `null`), and configure `makeDecoder()` for snake_case and ISO 8601. No `CodingKeys`.",
          starter: `import Foundation

struct Account: Decodable {
}

func makeDecoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    return decoder
}`,
          checks: [
            { pattern: "\\bstruct\\s+Account\\s*:\\s*(Decodable|Codable)\\b", label: "`Account` is `Decodable`" },
            { pattern: "\\blet\\s+userName\\s*:\\s*String\\b(?!\\?)", label: "`userName: String`" },
            { pattern: "\\blet\\s+signupDate\\s*:\\s*Date\\b", label: "`signupDate: Date`" },
            { pattern: "\\blet\\s+bio\\s*:\\s*String\\?", label: "`bio: String?`" },
            { pattern: "\\.keyDecodingStrategy\\s*=\\s*\\.convertFromSnakeCase\\b", label: "Uses `.convertFromSnakeCase`" },
            { pattern: "\\.dateDecodingStrategy\\s*=\\s*\\.iso8601\\b", label: "Uses `.iso8601`" },
          ],
          warnings: [
            { pattern: "\\b(user_name|signup_date)\\b\\s*:", label: "snake_case properties: let the decoder convert the keys" },
            { pattern: "\\bCodingKeys\\b", label: "With `.convertFromSnakeCase` you don't need `CodingKeys` (and mixing them breaks)" },
          ],
          solution: `import Foundation

struct Account: Decodable {
    let userName: String
    let signupDate: Date
    let bio: String?
}

func makeDecoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .convertFromSnakeCase
    decoder.dateDecodingStrategy = .iso8601
    return decoder
}`,
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: the orders JSON",
      goal: "Combine structs, enums, closures, errors and Codable to turn messy JSON into a reliable domain model.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "You pick up the ticket: \"The orders screen has been blank since yesterday\". The backend started sending `\"status\": \"on_hold\"`, which the app doesn't know, and an order without a phone number comes with `\"phone\": null`.",
            "You'll model the order with structs, a tolerant enum for `status`, and a function that decodes and returns a `Result` with a domain error instead of leaving the screen empty.",
            "snake_case keys, ISO 8601 dates, a nested object (`customer`) and an array of lines (`items`).",
          ],
          code: `{
  "order_id": 1042,
  "created_at": "2025-06-01T18:45:00Z",
  "status": "on_hold",
  "customer": { "full_name": "Ana Pérez", "phone": null },
  "items": [
    { "sku": "MATE-01", "unit_price": 15.5, "quantity": 2 },
    { "sku": "YERBA-1K", "unit_price": 3.25, "quantity": 4 }
  ]
}`,
        },
        {
          kind: "write",
          prompt: "Write `enum OrderStatus: String, Decodable` with `pending`, `paid`, `shipped` and `unknown`. An unknown value must not break decoding: implement `init(from:)` and fall back to `.unknown`.",
          starter: `enum OrderStatus: String, Decodable {
    case pending, paid, shipped
}`,
          checks: [
            { pattern: "\\benum\\s+OrderStatus\\s*:\\s*String\\s*,\\s*Decodable\\b", label: "`enum OrderStatus: String, Decodable`" },
            { pattern: "\\bunknown\\b", label: "Has an `unknown` case" },
            { pattern: "\\binit\\s*\\(\\s*from\\s+decoder\\s*:\\s*(any\\s+)?Decoder\\s*\\)\\s*throws\\b", label: "Implements `init(from:)`" },
            { pattern: "singleValueContainer\\s*\\(\\s*\\)", label: "Reads the string with `singleValueContainer()`" },
            { pattern: "\\?\\?\\s*\\.unknown\\b", label: "Falls back to `.unknown` with `??`" },
          ],
          warnings: [{ pattern: "\\btry!", label: "`try!` crashes on unexpected data" }],
          solution: `enum OrderStatus: String, Decodable {
    case pending, paid, shipped
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = OrderStatus(rawValue: raw) ?? .unknown
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Product wants to show \"On hold\", so you add `case onHold` to the enum. The decoder uses `.convertFromSnakeCase`. What happens with `\"status\": \"on_hold\"`?",
          code: `enum OrderStatus: String, Decodable {
    case pending, paid, shipped, onHold
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = OrderStatus(rawValue: raw) ?? .unknown
    }
}`,
          options: ["It decodes as `.onHold`", "It ends up as `.unknown`", "Throws `keyNotFound`", "It doesn't compile"],
          answer: 1,
          explanation: "`.convertFromSnakeCase` converts **keys**, not values. The raw value of `onHold` is `\"onHold\"` and the payload says `\"on_hold\"`: no match, so it falls back to `.unknown`. The fix is `case onHold = \"on_hold\"`.",
        },
        {
          kind: "write",
          prompt: "Model the order: `Customer` (`fullName`, optional `phone`), `OrderLine` (`sku`, `unitPrice: Double`, `quantity: Int` and a computed `subtotal`) and `Order` (`orderId`, `createdAt: Date`, `status: OrderStatus`, `customer`, `items`). All `Decodable`, camelCase properties.",
          starter: `struct Customer: Decodable {
}

struct OrderLine: Decodable {
}

struct Order: Decodable {
}`,
          checks: [
            { pattern: "\\blet\\s+fullName\\s*:\\s*String\\b", label: "`fullName: String`" },
            { pattern: "\\blet\\s+phone\\s*:\\s*String\\?", label: "`phone: String?`" },
            { pattern: "\\blet\\s+unitPrice\\s*:\\s*Double\\b", label: "`unitPrice: Double`" },
            { pattern: "\\bvar\\s+subtotal\\s*:\\s*Double\\s*\\{", label: "Computed `subtotal` property" },
            { pattern: "\\blet\\s+createdAt\\s*:\\s*Date\\b", label: "`createdAt: Date`" },
            { pattern: "\\blet\\s+status\\s*:\\s*OrderStatus\\b", label: "`status: OrderStatus`" },
            { pattern: "\\blet\\s+items\\s*:\\s*\\[\\s*OrderLine\\s*\\]", label: "`items: [OrderLine]`" },
          ],
          warnings: [
            { pattern: "\\b(let|var)\\s+[a-z]+_[a-z_]+\\s*:", label: "snake_case properties: use camelCase and `.convertFromSnakeCase`" },
            { pattern: "\\blet\\s+phone\\s*:\\s*String\\b(?!\\?)", label: "`phone` can be `null`: it must be optional" },
          ],
          solution: `struct Customer: Decodable {
    let fullName: String
    let phone: String?
}

struct OrderLine: Decodable {
    let sku: String
    let unitPrice: Double
    let quantity: Int

    var subtotal: Double { unitPrice * Double(quantity) }
}

struct Order: Decodable {
    let orderId: Int
    let createdAt: Date
    let status: OrderStatus
    let customer: Customer
    let items: [OrderLine]
}`,
          hint: "`Double * Int` doesn't compile in Swift: convert with `Double(quantity)`.",
        },
        {
          kind: "write",
          prompt: "Write `enum OrderLoadError: Error` with `invalidData` and `func loadOrder(from data: Data) -> Result<Order, OrderLoadError>`. Configure the decoder (snake_case + ISO 8601), decode inside a `do/catch`, and return `.success` or `.failure(.invalidData)`. No `try?` and no `try!`: the error has to be loggable.",
          starter: `import Foundation

func loadOrder(from data: Data) -> Order? {
    try? JSONDecoder().decode(Order.self, from: data)
}`,
          checks: [
            { pattern: "\\benum\\s+OrderLoadError\\s*:\\s*Error\\b", label: "Declares `enum OrderLoadError: Error`" },
            { pattern: "->\\s*Result<\\s*Order\\s*,\\s*OrderLoadError\\s*>", label: "Returns `Result<Order, OrderLoadError>`" },
            { pattern: "\\.convertFromSnakeCase\\b", label: "Uses `.convertFromSnakeCase`" },
            { pattern: "\\.iso8601\\b", label: "Uses `.iso8601`" },
            { pattern: "\\bdo\\s*\\{[\\s\\S]*\\bcatch\\b", label: "Decodes inside `do/catch`" },
            { pattern: "\\.success\\(", label: "Returns `.success`" },
            { pattern: "\\.failure\\(\\s*\\.invalidData\\s*\\)", label: "Returns `.failure(.invalidData)`" },
          ],
          warnings: [
            { pattern: "\\btry\\?", label: "`try?` throws away the reason for the failure" },
            { pattern: "\\btry!", label: "`try!` crashes on unexpected data" },
          ],
          solution: `import Foundation

enum OrderLoadError: Error {
    case invalidData
}

func loadOrder(from data: Data) -> Result<Order, OrderLoadError> {
    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .convertFromSnakeCase
    decoder.dateDecodingStrategy = .iso8601
    do {
        let order = try decoder.decode(Order.self, from: data)
        return .success(order)
    } catch {
        print("Order decoding failed: \\(error)")
        return .failure(.invalidData)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "With the scenario JSON decoded into `order`, what does this print?",
          code: `let total = order.items.map(\\.subtotal).reduce(0, +)
print(total, order.status, order.customer.phone ?? "-")`,
          options: ["`44 unknown -`", "`31.0 unknown nil`", "`44.0 unknown -`", "`44.0 onHold -`"],
          answer: 2,
          explanation: "Subtotals: 15.5 × 2 = 31.0 and 3.25 × 4 = 13.0; the sum is a `Double` and prints as `44.0`. `on_hold` matches no raw value (in the enum from exercise 1) and becomes `unknown`. `phone` is `nil`, so `??` gives `-`.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-value-reference",
      front: "What happens when you assign a struct to another variable? And a class?",
      back: "The struct is copied: changing one copy doesn't affect the other. The class shares the reference: both variables point at the same object.",
    },
    {
      id: "fc-mutating",
      front: "When do you need `mutating`?",
      back: "On a struct or enum method that modifies `self` or its properties. It can't be called on a `let` constant.",
      code: "struct Stepper {\n    var count = 0\n    mutating func increment() { count += 1 }\n}",
    },
    {
      id: "fc-let-class",
      front: "Does `let` make a class instance immutable?",
      back: "No. It pins the reference (you can't reassign it), but its `var` properties can still change. On a struct, `let` freezes the whole value.",
    },
    {
      id: "fc-cow",
      front: "What is copy-on-write?",
      back: "`Array`, `Dictionary`, `Set` and `String` share their buffer when copied and only duplicate it when one copy is mutated. Your own structs don't get it for free: a class stored inside is shared.",
    },
    {
      id: "fc-final",
      front: "Why `final class`?",
      back: "It forbids subclasses: makes intent clear and enables static dispatch. A good default for classes you didn't design for inheritance.",
    },
    {
      id: "fc-associated",
      front: "How do you model the state of a screen that loads data?",
      back: "With an enum with associated values instead of several booleans: impossible states can't be represented, and the exhaustive `switch` warns you when you add cases.",
      code: "enum ScreenState {\n    case loading\n    case loaded([Item])\n    case failed(String)\n}",
    },
    {
      id: "fc-rawvalue",
      front: "What does `Enum(rawValue:)` return for a value that doesn't exist?",
      back: "`nil`: the initializer is failable. Pair it with `??` for a fallback case, e.g. `?? .unknown`.",
    },
    {
      id: "fc-trailing",
      front: "What is a trailing closure?",
      back: "If the last parameter is a closure, you write it after the parentheses (and drop them if it's the only argument): `numbers.map { $0 * 2 }`.",
    },
    {
      id: "fc-escaping",
      front: "When is a closure parameter `@escaping`?",
      back: "When the closure outlives the call: it's stored in a property or run later (network callbacks, timers). `map`/`filter` take non-escaping closures.",
    },
    {
      id: "fc-weak-self",
      front: "When do you **not** need `[weak self]`?",
      back: "In non-escaping closures (`map`, `forEach`), in one-shot closures nobody stores (`DispatchQueue.main.async`), and in structs. You need it when `self` ends up retaining the closure.",
    },
    {
      id: "fc-capture-list",
      front: "What does `[x]` change in `{ [x] in print(x) }`?",
      back: "It copies the value of `x` when the closure is created. Without a capture list, the closure sees the variable's current value when it runs.",
    },
    {
      id: "fc-try-variants",
      front: "`try`, `try?`, `try!`: what does each do?",
      back: "`try` propagates or goes to a `catch`. `try?` returns `nil` if it throws (you lose the reason). `try!` crashes if it throws.",
    },
    {
      id: "fc-typed-throws",
      front: "What does `throws(NetworkError)` give you in Swift 6?",
      back: "Typed throws: the error that comes out is exactly `NetworkError`, so `catch` can `switch` over it exhaustively without casting. For general code, plain `throws` is still the default.",
      code: "func fetch() throws(NetworkError) -> Data",
    },
    {
      id: "fc-snake-case",
      front: "With `.convertFromSnakeCase`, which property does `avatar_url` map to?",
      back: "`avatarUrl`, not `avatarURL`. And don't combine it with `CodingKeys` that use snake_case names: the already-converted key won't match.",
    },
    {
      id: "fc-unknown-enum",
      front: "The backend adds a new value to an enum. How do you keep the whole list from failing?",
      back: "Add `case unknown` and an `init(from:)` that reads the string and does `Self(rawValue: raw) ?? .unknown`.",
      code: "init(from decoder: Decoder) throws {\n    let raw = try decoder.singleValueContainer().decode(String.self)\n    self = Status(rawValue: raw) ?? .unknown\n}",
    },
  ],

  exam: [
    {
      id: "ex-shared-instance",
      question: "The cart screen and the checkout screen get the same `CartState`. When checkout clears a \"test\" cart, the real cart ends up empty too. What's the most likely cause?",
      code: "final class CartState {\n    var items: [Item] = []\n}",
      options: [
        "`items` should be a `let`",
        "The screen's init is missing `@escaping`",
        "`CartState` is a class: both screens share the same instance",
        "The array doesn't have copy-on-write",
      ],
      answer: 2,
      explanation: "A class is a reference type: passing it to two screens gives them the same instance. If each screen needs its own copy, `CartState` should be a struct; if shared state is intended, it should be explicit and observable.",
    },
    {
      id: "ex-let-struct",
      question: "What happens with this code?",
      code: "struct Config { var timeout = 10 }\nlet config = Config()\nconfig.timeout = 30",
      options: [
        "It doesn't compile: `config` is a `let` struct and its whole value is immutable",
        "It compiles and `timeout` becomes 30",
        "It compiles but crashes at runtime",
        "It compiles and `timeout` stays 10",
      ],
      answer: 0,
      explanation: "`let` on a value type freezes the whole value, including its `var` properties. With a class it would compile.",
    },
    {
      id: "ex-cow",
      question: "A `Feed` struct holds a `[Post]` with 10,000 elements. You write `var copy = feed` and only read `copy.posts.count`. How many times are the posts copied?",
      options: [
        "Once, on assignment",
        "Twice: on assignment and when reading `count`",
        "It depends on whether `Post` is `Codable`",
        "Zero: the array uses copy-on-write and only copies when one copy is mutated",
      ],
      answer: 3,
      explanation: "Standard library collections share their buffer until a copy is modified. Reading doesn't trigger a copy.",
    },
    {
      id: "ex-screen-state",
      question: "A view model has `isLoading: Bool`, `errorMessage: String?` and `items: [Item]`. A bug shows the spinner and the error message at the same time. What's the best root-cause fix?",
      options: [
        "Add a `didSet` on `isLoading` that clears `errorMessage`",
        "Replace the three properties with an enum `loading / loaded([Item]) / failed(String)`",
        "Make `errorMessage` non-optional",
        "Use a class instead of a struct",
      ],
      answer: 1,
      explanation: "With an enum the states are mutually exclusive by construction: \"loading and failed\" can't exist. A `didSet` patch fixes one symptom and leaves the other impossible states open.",
    },
    {
      id: "ex-default-case",
      question: "You add `case refunded` to `enum PaymentStatus`. The project builds cleanly, but the detail screen shows \"Unknown\" for refunds. Why didn't the compiler warn you?",
      code: "switch status {\ncase .paid: label = \"Paid\"\ncase .pending: label = \"Pending\"\ndefault: label = \"Unknown\"\n}",
      options: [
        "Because enums with raw values aren't exhaustive",
        "Because `CaseIterable` was missing",
        "Because `default` covers any new case; without it, the `switch` would stop compiling",
        "Because `switch` only checks exhaustiveness on `@frozen` enums",
      ],
      answer: 2,
      explanation: "`default` silently absorbs new cases. For your own enums, list every case so the compiler flags each `switch` that needs updating.",
    },
    {
      id: "ex-retain-cycle",
      question: "Instruments shows `ChatViewModel` is never deallocated. Which change fixes it?",
      code: "final class ChatViewModel {\n    let socket = SocketClient()\n    var messages: [String] = []\n\n    init() {\n        socket.onMessage = { text in\n            self.messages.append(text)\n        }\n    }\n}",
      options: [
        "Capture `[weak self]` in the `onMessage` closure",
        "Mark `onMessage` as non-escaping",
        "Make `messages` a `let`",
        "Move the code into `deinit`",
      ],
      answer: 0,
      explanation: "The view model retains `socket`, `socket` retains the closure, and the closure retains `self`: a cycle. With `[weak self]` the closure stops retaining the view model. A property that stores a closure is always escaping.",
    },
    {
      id: "ex-weak-not-needed",
      question: "In code review someone asks you to add `[weak self]` on this line. What do you reply?",
      code: "let titles = posts.map { self.formatter.title(for: $0) }",
      options: [
        "They're right: any closure that uses `self` needs `[weak self]`",
        "They're right, but `[unowned self]` is enough",
        "The `map` has to become a `for` loop to avoid the cycle",
        "Not needed: `map` takes a non-escaping closure that runs and is released before it returns",
      ],
      answer: 3,
      explanation: "Non-escaping closures aren't stored, so they can't form a cycle. `[weak self]` here only adds noise and optionals.",
    },
    {
      id: "ex-try-optional",
      question: "Users report an empty list and the logs show nothing. What's wrong with this code?",
      code: "let products = (try? decoder.decode([Product].self, from: data)) ?? []",
      options: [
        "`decode` can't be used with arrays",
        "`try?` discards the `DecodingError`: the failure turns into an empty list with no trace",
        "`??` doesn't work with arrays",
        "It's missing `@escaping`",
      ],
      answer: 1,
      explanation: "`try?` turns any error into `nil`. With `do/catch` you can log the `DecodingError` (which tells you the key and coding path that failed) and show an error state instead of an empty list.",
    },
    {
      id: "ex-typed-throws",
      question: "What do you gain by declaring `func fetchUser() throws(NetworkError) -> User` in Swift 6?",
      options: [
        "The `catch` can receive a concrete `NetworkError` and `switch` over it exhaustively without casting",
        "Callers no longer need `try`",
        "The error is automatically wrapped in a `Result`",
        "You can throw errors of any type without declaring them",
      ],
      answer: 0,
      explanation: "Typed throws pins the error type. It's useful for closed domains; for general APIs, plain `throws` stays more flexible.",
    },
    {
      id: "ex-avatar-url",
      question: "The JSON has `\"avatar_url\": \"https://...\"`, the decoder uses `.convertFromSnakeCase`, and the property is `let avatarURL: URL?`. No error is thrown, but the avatar is always `nil`. Why?",
      options: [
        "`URL` isn't `Decodable`",
        "It needs `.iso8601`",
        "The converted key is `avatarUrl`, which doesn't match `avatarURL`; since it's optional, it silently becomes `nil`",
        "Optional properties are never decoded",
      ],
      answer: 2,
      explanation: "The conversion yields `avatarUrl`. Because the property is optional, the synthesized code uses `decodeIfPresent`, doesn't find the key, and leaves `nil`. Rename it to `avatarUrl` or use `CodingKeys` without the strategy.",
    },
    {
      id: "ex-unknown-enum",
      question: "The backend starts sending `\"status\": \"refunded\"`. In older app versions the orders list is empty. What's the fix for upcoming versions?",
      code: "enum OrderStatus: String, Decodable {\n    case pending, paid, shipped\n}",
      options: [
        "Make `status` a `String` and compare strings across the app",
        "Wrap every `decode` in `try!`",
        "Ask the backend to never add values",
        "Add `case unknown` and an `init(from:)` that does `OrderStatus(rawValue: raw) ?? .unknown`",
      ],
      answer: 3,
      explanation: "A synthesized enum throws `dataCorrupted` on an unknown value, and that error fails the whole array. With a tolerant `init(from:)` the order decodes as `.unknown` and the UI can show something generic.",
    },
    {
      id: "ex-fractional-dates",
      question: "Dates arrive as `\"2025-03-10T14:30:00.123Z\"` and decoding fails with `dateDecodingStrategy = .iso8601`. What do you do?",
      options: [
        "Change the property to `Date?`",
        "Use `.custom` with an `ISO8601DateFormatter` configured with `.withFractionalSeconds`",
        "Use `.convertFromSnakeCase`",
        "Use `.secondsSince1970`",
      ],
      answer: 1,
      explanation: "`.iso8601` doesn't accept fractional seconds. With `.custom` (or `.formatted`) and a formatter that includes `.withFractionalSeconds`, it decodes fine. Making it optional doesn't help: `decodeIfPresent` only tolerates a missing key or `null`, not an invalid format.",
    },
  ],
};

export default content;
