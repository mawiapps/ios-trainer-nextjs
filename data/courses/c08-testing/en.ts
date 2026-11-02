import type { CourseContent } from "../types";

// Swift code uses String.raw so `\(...)` and `\.keyPath` keep their backslashes.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "xctest-basics",
      title: "XCTest from scratch",
      goal: "Write tests with `XCTestCase` using Arrange–Act–Assert, pick the right assertion (`XCTUnwrap`, `XCTAssertThrowsError`) and test `async` code.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Anatomy of a test",
          body: [
            "An XCTest test is a method on an `XCTestCase` subclass whose name starts with `test`, takes no parameters and returns nothing (it can be `throws` and/or `async`). Xcode discovers them automatically; there's nothing to register.",
            "`setUp()` runs before **every** test and `tearDown()` after every one: each test starts with a fresh object and shares no state with the previous one. The object under test is usually called `sut` (system under test).",
            "Structure the body in three blocks: **Arrange** (set up), **Act** (one action) and **Assert** (verify). Name it `test_<unit>_<condition>_<expectedResult>`: when it fails in CI, the name already tells you what broke.",
            "`@testable import` gives you access to the module's `internal` symbols. Don't use it as a way to reach `private` stuff: if you need that, the design is asking for an injectable dependency.",
          ],
          code: swift`import XCTest
@testable import Shop

final class PriceFormatterTests: XCTestCase {
    private var sut: PriceFormatter!

    override func setUp() {
        super.setUp()
        sut = PriceFormatter(currencyCode: "USD")
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    func test_format_wholeAmount_hasNoDecimals() {
        // Arrange
        let cents = 1_500
        // Act
        let text = sut.format(cents: cents)
        // Assert
        XCTAssertEqual(text, "$15")
    }
}`,
        },
        {
          kind: "predict",
          prompt: "How many tests does Xcode run in this class?",
          code: swift`final class SessionTests: XCTestCase {
    func testLogin() { XCTAssertTrue(true) }
    func checkLogout() { XCTAssertTrue(true) }
    func testFetch(id: Int) { XCTAssertEqual(id, 1) }
    func test_refresh() async throws { XCTAssertTrue(true) }
}`,
          options: ["1 test", "2 tests", "3 tests", "4 tests"],
          answer: 1,
          explanation:
            "`testLogin` and `test_refresh` run. `checkLogout` doesn't start with `test`, so it's a regular method. `testFetch(id:)` takes a parameter, and XCTest only discovers parameterless methods. `async throws` is allowed.",
        },
        {
          kind: "explain",
          title: "The assertions you use every day",
          body: [
            "`XCTAssertEqual(a, b)` prints both values when it fails, which makes it better than `XCTAssertTrue(a == b)`. For booleans and optionals: `XCTAssertTrue`, `XCTAssertFalse`, `XCTAssertNil`, `XCTAssertNotNil`. `XCTFail(\"message\")` records a failure by hand.",
            "`XCTUnwrap` unwraps an optional and, if it's `nil`, **throws an error** that stops the test. That's why the test has to be `throws`. It's the safe alternative to `!`, which would crash the whole test process.",
            "`XCTAssertThrowsError(try expr) { error in ... }` checks that an error is thrown and lets you inspect which one. You can keep verifying state afterwards, e.g. that the balance didn't change.",
          ],
          code: swift`func test_decode_validJSON_returnsUser() throws {
    let data = #"{"id": 7, "name": "Ana"}"#.data(using: .utf8)
    let json = try XCTUnwrap(data)

    let user = try JSONDecoder().decode(User.self, from: json)

    XCTAssertEqual(user.name, "Ana")
}

func test_withdraw_moreThanBalance_throwsInsufficientFunds() {
    var account = Account(balance: 100)

    XCTAssertThrowsError(try account.withdraw(500)) { error in
        XCTAssertEqual(error as? BankError, .insufficientFunds)
    }
    XCTAssertEqual(account.balance, 100)
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the assertion that unwraps the optional and stops the test if it's `nil`.",
          code: swift`func test_firstUser_isAdmin() throws {
    let users = try loadFixtureUsers()
    let first = try ____(users.first)
    XCTAssertTrue(first.isAdmin)
}`,
          accept: ["^XCTUnwrap$"],
          hint: "It starts with `XCT` and the test is `throws`.",
          explanation: "`try XCTUnwrap(users.first)` returns the `User` or throws an error that fails the test without crashing.",
        },
        {
          kind: "predict",
          prompt: "The list is empty. What happens when the test runs?",
          code: swift`func test_firstAdmin_isAna() throws {
    let users: [User] = []
    let admin = try XCTUnwrap(users.first(where: \.isAdmin))
    XCTAssertEqual(admin.name, "Ana")
    print("reached the end")
}`,
          options: [
            "It crashes the test process, like a force unwrap",
            "It passes: `XCTUnwrap` ignores `nil`",
            "It fails at `XCTUnwrap` and the rest of the test doesn't run",
            "It fails twice: at `XCTUnwrap` and at `XCTAssertEqual`",
          ],
          answer: 2,
          explanation:
            "`XCTUnwrap` records the failure and throws. Since the method is `throws`, the error exits the test and the following lines never run: no second failure, no `print`. With `!` you would have crashed and lost the report for every other test.",
        },
        {
          kind: "explain",
          title: "Async tests",
          body: [
            "If the code is `async`, so is the test: `func test_x() async throws`, and you `await` like anywhere else. XCTest waits for it to finish.",
            "For older completion-handler APIs, use an expectation: `expectation(description:)`, fulfill it with `fulfill()` and wait with `await fulfillment(of:timeout:)` (in a synchronous test, `wait(for:timeout:)`). If nobody calls `fulfill()`, the test fails when the timeout expires.",
            "Never use `sleep` to \"give the code time\": it makes the test slow and flaky. Wait for something concrete.",
          ],
          code: swift`func test_load_success_returnsItems() async throws {
    let sut = CatalogLoader(client: StubClient(items: [.sample]))

    let items = try await sut.load()

    XCTAssertEqual(items.count, 1)
}

func test_legacyLoad_callsCompletion() async {
    let exp = expectation(description: "completion")

    LegacyLoader().load { _ in exp.fulfill() }

    await fulfillment(of: [exp], timeout: 1)
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in how an `async` test waits for the expectation.",
          code: swift`func test_upload_callsCompletion() async {
    let exp = expectation(description: "upload finished")
    Uploader().upload(file) { _ in exp.fulfill() }
    await ____(of: [exp], timeout: 2)
}`,
          accept: ["^fulfillment$"],
          hint: "In a synchronous test it would be `wait(for:timeout:)`; in an `async` one, a different function.",
          explanation: "`await fulfillment(of:timeout:)` is the `async` version of `wait(for:timeout:)`. Calling `wait` inside an `async` test blocks the thread and Xcode warns you about it.",
        },
        {
          kind: "write",
          prompt:
            "You have `struct Stack<Element>` with `push(_:)`, `pop() -> Element?` and `isEmpty`. Write two XCTest tests: `pop()` on an empty stack returns `nil`, and after `push(1)` and `push(2)`, `pop()` returns `2`. Use Arrange–Act–Assert and `test_<unit>_<condition>_<result>` names.",
          starter: swift`import XCTest
@testable import Toolkit

final class StackTests: XCTestCase {
    // your tests here
}`,
          checks: [
            { pattern: "final\\s+class\\s+StackTests\\s*:\\s*XCTestCase", label: "The class inherits from `XCTestCase`" },
            { pattern: "func\\s+test_?\\w+\\(\\)", label: "Methods start with `test` and take no parameters" },
            { pattern: "XCTAssertNil\\(", label: "Checks the empty case with `XCTAssertNil`" },
            { pattern: "XCTAssertEqual\\(", label: "Checks the value with `XCTAssertEqual`" },
          ],
          warnings: [{ pattern: "print\\(", label: "Tests don't print: assert with `XCTAssert...`" }],
          solution: swift`import XCTest
@testable import Toolkit

final class StackTests: XCTestCase {
    func test_pop_onEmptyStack_returnsNil() {
        var sut = Stack<Int>()

        let value = sut.pop()

        XCTAssertNil(value)
    }

    func test_pop_afterTwoPushes_returnsLastPushed() {
        var sut = Stack<Int>()
        sut.push(1)
        sut.push(2)

        let value = sut.pop()

        XCTAssertEqual(value, 2)
        XCTAssertFalse(sut.isEmpty)
    }
}`,
          hint: "One test per behavior. In the second one, also check that one element is left.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "swift-testing",
      title: "Swift Testing: `@Test` and `#expect`",
      goal: "Write tests with Apple's new framework: `@Test`, `#expect`, `#require`, suites, parameterized tests, tags and traits, side by side with XCTest.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "The new framework",
          body: [
            "Swift Testing ships with Xcode 16 and Swift 6. You import `Testing`, mark functions with `@Test` (no mandatory `test` prefix) and assert with a single macro: `#expect(expression)`. On failure it shows the value of each side of the expression.",
            "Tests can live in a `struct` (or a `class`/`actor`). A new instance is created for every test, so `init` replaces `setUp` and `let` properties are always fresh. If you need cleanup at the end, use a `class` or `actor` with `deinit`.",
            "`@Test(\"Readable name\")` gives the test a human-friendly name in the report. Tests run **in parallel** by default, even within the same suite: shared state shows up fast.",
          ],
          code: swift`import Testing
@testable import Shop

struct PriceFormatterTests {
    let sut = PriceFormatter(currencyCode: "USD")

    @Test("Whole amounts show no decimals")
    func wholeAmount() {
        #expect(sut.format(cents: 1_500) == "$15")
    }

    @Test func negativeAmount() {
        #expect(sut.format(cents: -250) == "-$2.50")
    }
}`,
        },
        {
          kind: "predict",
          prompt: "How many issues does this test report?",
          code: swift`@Test func profileName() throws {
    let user: User? = nil
    #expect(user != nil)
    let unwrapped = try #require(user)
    #expect(unwrapped.name == "Ana")
}`,
          options: [
            "1: only the first `#expect`; then it keeps going and finishes",
            "1: only the `#require`",
            "3: one per line with a macro",
            "2: the `#expect` and the `#require`; the last line doesn't run",
          ],
          answer: 3,
          explanation:
            "`#expect` records the issue and **keeps going**. `#require` records the issue and **throws**, which ends the test. That's why the last line never runs. Rule of thumb: `#require` for preconditions (unwrapping, validating setup), `#expect` for everything else.",
        },
        {
          kind: "explain",
          title: "`#require` and errors",
          body: [
            "`try #require(optional)` is Swift Testing's `XCTUnwrap`: it returns the value or ends the test. It also takes conditions: `try #require(items.count == 3)`.",
            "To check errors: `#expect(throws: BankError.self) { ... }` accepts any error of that type, and `#expect(throws: ValidationError.empty) { ... }` requires that exact value (the error must be `Equatable`). To assert that something does **not** throw, `#expect(throws: Never.self) { ... }`.",
            "Don't mix them: inside an `@Test` use `#expect`; `XCTAssert...` isn't reported properly there.",
          ],
          code: swift`@Test func emptyEmailIsRejected() {
    let validator = SignUpValidator()
    #expect(throws: ValidationError.empty) {
        try validator.validate(email: "")
    }
}

@Test func firstItemIsTheCheapest() throws {
    let cart = Cart.sample
    let first = try #require(cart.sortedByPrice().first)
    #expect(first.priceCents == 300)
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the macro that unwraps the optional and ends the test if it's `nil`.",
          code: swift`@Test func firstOrderIsPending() throws {
    let orders = try OrderFixtures.load()
    let first = try ____(orders.first)
    #expect(first.status == .pending)
}`,
          accept: ["^#require$"],
          hint: "It's a macro, it starts with `#`.",
          explanation: "`try #require(orders.first)` returns the `Order` or records the issue and ends the test, just like `XCTUnwrap`.",
        },
        {
          kind: "explain",
          title: "Parameterized tests",
          body: [
            "`@Test(arguments: collection)` runs the function once per element, and each case shows up separately in the report: if `\"ana@\"` fails, you see exactly which one. It replaces a `for` loop inside a test, which stops at the first failure and doesn't tell you which case it was.",
            "With two collections, `@Test(arguments: a, b)` tests the **Cartesian product** (every combination). If you want one-to-one pairs (input, expected result), use `zip(a, b)`.",
          ],
          code: swift`@Test(arguments: ["", " ", "ana@", "@mail.com"])
func rejectsInvalidEmails(_ email: String) {
    #expect(EmailValidator.isValid(email) == false)
}

@Test(arguments: zip([0, 99, 100, 250], [0, 0, 5, 25]))
func discount(total: Int, expected: Int) {
    #expect(Discount.amount(forTotal: total) == expected)
}`,
        },
        {
          kind: "predict",
          prompt: "How many cases does this test run?",
          code: swift`@Test(arguments: [1, 2, 3], ["a", "b"])
func combo(number: Int, letter: String) {
    #expect(!"\(number)\(letter)".isEmpty)
}`,
          options: [
            "6 cases: every combination",
            "3 cases: they're paired and one is left over",
            "2 cases: the shorter collection wins",
            "5 cases: one per value",
          ],
          answer: 0,
          explanation:
            "With two collections, Swift Testing takes the Cartesian product: 3 × 2 = 6. To pair them (like `zip`, which stops at the shorter one), pass `zip([1, 2, 3], [\"a\", \"b\"])` and you'd get 2 cases.",
        },
        {
          kind: "explain",
          title: "Suites, tags and traits",
          body: [
            "`@Suite` groups tests and applies traits to everything inside. **Tags** are declared in a `Tag` extension and let you filter in Xcode or in the test plan (e.g. run only `.checkout`).",
            "Useful traits: `.disabled(\"reason\")` (the test compiles but doesn't run, and the reason appears in the report), `.enabled(if: condition)`, `.timeLimit(.minutes(1))`, `.bug(\"ticket URL\")` and `.serialized`, which stops the tests in a suite from running in parallel with each other.",
            "Swift Testing and XCTest live side by side in the same target, so you can migrate file by file. What stays on XCTest: UI tests (`XCUIApplication`) and performance tests (`measure`).",
          ],
          code: swift`extension Tag {
    @Tag static var checkout: Self
}

@Suite("Cart", .tags(.checkout))
struct CartTests {
    @Test func addsItem() { /* ... */ }

    @Test(.disabled("Waiting on the backend fix"), .bug("https://jira.example.com/SHOP-812"))
    func appliesGiftCard() { /* ... */ }

    @Test(.timeLimit(.minutes(1)))
    func recalculatesBigCart() async { /* ... */ }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the trait that keeps the test compiling but not running, with a reason shown in the report.",
          code: swift`@Test(.____("Flaky on CI, see SHOP-903"))
func syncsInBackground() async { /* ... */ }`,
          accept: ["^disabled$"],
          hint: "The opposite of `.enabled(if:)`.",
          explanation: "`.disabled(\"reason\")` beats commenting the test out: it keeps compiling (so it doesn't rot) and the reason shows up in the report.",
        },
        {
          kind: "write",
          prompt:
            "Migrate this file to Swift Testing. The three palindromes must become **one** parameterized test with `arguments:`; the negative case can be a separate `@Test`. Assert with `#expect`.",
          starter: swift`import XCTest
@testable import TextKit

final class PalindromeTests: XCTestCase {
    func test_palindromes() {
        XCTAssertTrue(isPalindrome("racecar"))
        XCTAssertTrue(isPalindrome("A man a plan a canal Panama"))
        XCTAssertTrue(isPalindrome(""))
    }

    func test_notPalindrome() {
        XCTAssertFalse(isPalindrome("swift"))
    }
}`,
          checks: [
            { pattern: "^import\\s+Testing", label: "Imports `Testing`" },
            { pattern: "@Test\\s*\\(\\s*arguments:", label: "Parameterized test with `arguments:`" },
            { pattern: ":\\s*String\\s*\\)", label: "The function takes the case's `String`" },
            { pattern: "#expect\\(", label: "Asserts with `#expect`" },
          ],
          warnings: [
            { pattern: "XCTAssert", label: "Don't use `XCTAssert...` in Swift Testing" },
            { pattern: "XCTestCase", label: "No need to inherit from `XCTestCase` anymore" },
          ],
          solution: swift`import Testing
@testable import TextKit

struct PalindromeTests {
    @Test(arguments: ["racecar", "A man a plan a canal Panama", ""])
    func recognizesPalindromes(_ text: String) {
        #expect(isPalindrome(text))
    }

    @Test func rejectsNonPalindrome() {
        #expect(!isPalindrome("swift"))
    }
}`,
          hint: "`@Test(arguments: [...]) func name(_ text: String)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "test-doubles",
      title: "Test doubles: stub, spy, fake and mock",
      goal: "Pick the right double for each dependency, hand-write it from a protocol, and know when generating it pays off.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "No protocol, no double",
          body: [
            "To replace a dependency in a test, the code has to receive it through `init` as a protocol instead of creating it inside (`URLSession.shared`, `Date()`, `UserDefaults.standard`). That's dependency injection, and it's what makes a view model testable.",
            "The five kinds of double: **dummy** (passed so it compiles, never used), **stub** (returns canned answers), **fake** (a real but simplified implementation, like an in-memory repository), **spy** (records calls so you can check them later) and **mock** (pre-programmed with the calls it expects and verifies itself).",
            "Day to day, people say \"mock\" for any double. In an interview it pays to know the difference: they do ask.",
          ],
          code: swift`protocol ProfileService {
    func fetchProfile(id: String) async throws -> Profile
}

protocol Analytics {
    func track(_ event: String)
}

@MainActor
@Observable
final class ProfileViewModel {
    private let service: ProfileService
    private let analytics: Analytics
    private(set) var name = ""

    init(service: ProfileService, analytics: Analytics) {
        self.service = service
        self.analytics = analytics
    }
}`,
        },
        {
          kind: "predict",
          prompt: "What kind of double is this?",
          code: swift`final class InMemoryUserRepository: UserRepository {
    private var storage: [String: User] = [:]

    func save(_ user: User) { storage[user.id] = user }
    func find(id: String) -> User? { storage[id] }
    func delete(id: String) { storage[id] = nil }
}`,
          options: ["Stub", "Spy", "Fake", "Dummy"],
          answer: 2,
          explanation:
            "It has real behavior (save, find, delete) with a shortcut: a dictionary instead of a database. That's a fake. A stub would always return the same thing, and a spy would record calls for later verification.",
        },
        {
          kind: "explain",
          title: "Hand-written stubs and spies",
          body: [
            "A **stub** controls what goes *into* the system: the test decides whether the service succeeds or throws. With a `Result` you cover both paths with one type.",
            "A **spy** observes what comes *out*: analytics events, navigation, messages sent. It stores calls in an array and the test checks them at the end.",
            "Hand-writing them takes 5 lines and they read on their own. Check **state** first (`sut.name`); reach for spies only for effects that don't show up in state.",
          ],
          code: swift`struct ProfileServiceStub: ProfileService {
    let result: Result<Profile, Error>
    func fetchProfile(id: String) async throws -> Profile { try result.get() }
}

final class AnalyticsSpy: Analytics {
    private(set) var events: [String] = []
    func track(_ event: String) { events.append(event) }
}

@Test @MainActor func loadShowsNameAndTracks() async {
    let spy = AnalyticsSpy()
    let stub = ProfileServiceStub(result: .success(Profile(name: "Ana")))
    let sut = ProfileViewModel(service: stub, analytics: spy)

    await sut.load(id: "1")

    #expect(sut.name == "Ana")
    #expect(spy.events == ["profile_requested", "profile_loaded"])
}`,
        },
        {
          kind: "predict",
          prompt: "The stub throws. What does this print?",
          code: swift`// In ProfileViewModel:
func load(id: String) async {
    analytics.track("profile_requested")
    do {
        name = try await service.fetchProfile(id: id).name
        analytics.track("profile_loaded")
    } catch {
        analytics.track("profile_failed")
    }
}

// In the test:
let spy = AnalyticsSpy()
let stub = ProfileServiceStub(result: .failure(URLError(.notConnectedToInternet)))
let sut = ProfileViewModel(service: stub, analytics: spy)
await sut.load(id: "1")
print(spy.events)`,
          options: [
            "[\"profile_failed\"]",
            "[\"profile_requested\", \"profile_failed\"]",
            "[\"profile_requested\", \"profile_loaded\"]",
            "[]",
          ],
          answer: 1,
          explanation:
            "`profile_requested` is tracked first. The `try await` throws, so `profile_loaded` never runs and control jumps to `catch`, which tracks `profile_failed`. The array prints its strings with quotes.",
        },
        {
          kind: "fill",
          prompt: "Complete the spy so it records every amount charged.",
          code: swift`final class PaymentGatewaySpy: PaymentGateway {
    private(set) var chargedAmounts: [Int] = []

    func charge(cents: Int) async throws {
        chargedAmounts.____(cents)
    }
}`,
          accept: ["^append$"],
          explanation: "`append` adds to the end, so the test can check both count and order: `#expect(spy.chargedAmounts == [1_500])`.",
        },
        {
          kind: "explain",
          title: "Mocks and generated doubles",
          body: [
            "A mock verifies **interactions**: which methods were called, how many times and in what order. It's useful when the interaction *is* the behavior (\"charged exactly once\"). Used for everything, it couples the test to the implementation and every refactor breaks it.",
            "Large codebases generate their doubles. **Mockolo** (from Uber) reads protocols annotated with `/// @mockable` and generates `...Mock` classes with call counters and handlers. **Sourcery** does the same with templates such as `AutoMockable`. They run as a build phase or in CI.",
            "A sensible team rule: hand-write the small ones that get read in the PR; generate them when there are dozens of protocols nobody wants to maintain.",
          ],
          code: swift`/// @mockable
protocol TokenStore {
    func token() -> String?
    func save(_ token: String)
}

// Mockolo generates TokenStoreMock with, among other things:
//   var tokenHandler: (() -> String?)?
//   var saveCallCount = 0
//   var saveHandler: ((String) -> ())?

@Test func logoutClearsToken() {
    let store = TokenStoreMock()
    let sut = SessionManager(store: store)
    sut.logout()
    #expect(store.saveCallCount == 1)
}`,
        },
        {
          kind: "predict",
          prompt: "After a refactor that changes nothing the user can see, this test breaks. What's the diagnosis?",
          code: swift`func test_checkout() {
    let mock = PaymentMock()
    mock.expect(calls: ["validateCard", "reserveStock", "charge", "sendReceipt"])
    sut.checkout(cart)
    mock.verify()
}
// Refactor: reserveStock now runs before validateCard.`,
          options: [
            "The refactor introduced a bug: revert it",
            "It needs a `sleep` before `verify()`",
            "Add more expected calls to the mock",
            "The test is overspecified: it checks internal order instead of the outcome",
          ],
          answer: 3,
          explanation:
            "Behavior didn't change, but the test pinned internal details. Better: a stub for payments and assertions on the outcome (order confirmed, amount charged once, receipt sent) without demanding an order the business doesn't care about.",
        },
        {
          kind: "write",
          prompt:
            "`OrderNotifier` takes a `NotificationSender`. Write `NotificationSenderSpy`, which records every message and its recipient, and an `@Test` that checks `orderShipped(id:userID:)` sends **one** message to the right user.",
          starter: swift`protocol NotificationSender {
    func send(_ message: String, to userID: String) async throws
}

struct OrderNotifier {
    let sender: NotificationSender

    func orderShipped(id: String, userID: String) async throws {
        try await sender.send("Your order \(id) has shipped", to: userID)
    }
}

// Spy and test here`,
          checks: [
            { pattern: "class\\s+\\w*Spy\\s*:\\s*NotificationSender", label: "A spy conforming to `NotificationSender`" },
            { pattern: "var\\s+\\w+\\s*:\\s*\\[", label: "Stores calls in an array" },
            { pattern: "\\.append\\(", label: "Records each call with `append`" },
            { pattern: "@Test", label: "A test with `@Test`" },
            { pattern: "#expect\\(", label: "Asserts with `#expect`" },
          ],
          warnings: [{ pattern: "XCTAssert", label: "Inside an `@Test` use `#expect`, not `XCTAssert`" }],
          solution: swift`final class NotificationSenderSpy: NotificationSender {
    private(set) var sent: [(message: String, userID: String)] = []

    func send(_ message: String, to userID: String) async throws {
        sent.append((message, userID))
    }
}

@Test func orderShippedNotifiesTheBuyer() async throws {
    let spy = NotificationSenderSpy()
    let sut = OrderNotifier(sender: spy)

    try await sut.orderShipped(id: "A-42", userID: "u1")

    #expect(spy.sent.count == 1)
    #expect(spy.sent.first?.userID == "u1")
    #expect(spy.sent.first?.message == "Your order A-42 has shipped")
}`,
          hint: "An array of `(message: String, userID: String)` tuples is enough.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "hard-parts",
      title: "The hard parts: time, disk, network and the main actor",
      goal: "Make code that depends on the clock, `UserDefaults`, the network or `@MainActor` deterministic, without touching production more than necessary.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The clock is a dependency",
          body: [
            "`Date()` inside your logic makes the result depend on when the test runs. Inject \"now\": a `now: () -> Date` closure is enough. In production you pass `Date.init`; in the test, a fixed date.",
            "The same goes for `Calendar` and `TimeZone`: a \"is it morning\" test using `Calendar.current` passes in New York and fails on a CI runner set to UTC.",
            "For waits and timeouts (`Task.sleep`, debounce), inject an `any Clock<Duration>`. In tests you can use `TestClock` or `ImmediateClock` from Point-Free's swift-clocks library and advance time manually instead of waiting for it.",
          ],
          code: swift`struct TrialPolicy {
    let now: () -> Date

    func isExpired(startedAt start: Date) -> Bool {
        now().timeIntervalSince(start) > 14 * 86_400
    }
}

// Production
let policy = TrialPolicy(now: Date.init)

// Test
@Test func trialExpiresAfter14Days() {
    let start = Date(timeIntervalSince1970: 0)
    let sut = TrialPolicy(now: { start.addingTimeInterval(15 * 86_400) })
    #expect(sut.isExpired(startedAt: start))
}`,
        },
        {
          kind: "predict",
          prompt: "This test was written on November 2, 2026 and passed. What will happen to it?",
          code: swift`struct TrialPolicy {
    func isExpired(startedAt start: Date) -> Bool {
        Date().timeIntervalSince(start) > 14 * 86_400
    }
}

@Test func notExpiredYet() {
    let start = ISO8601DateFormatter().date(from: "2026-11-01T00:00:00Z")!
    #expect(!TrialPolicy().isExpired(startedAt: start))
}`,
          options: [
            "It starts failing in mid-November: it depends on the real clock",
            "It always fails: `ISO8601DateFormatter` returns `nil` for that format",
            "It always passes: the date is fixed in the test",
            "It doesn't compile: `Date()` can't be used inside a `struct`",
          ],
          answer: 0,
          explanation:
            "The start date is fixed, but \"now\" isn't: `Date()` keeps moving. From November 15 on, more than 14 days have passed and the test goes red without anyone touching code. A classic broken-CI-on-Monday story. Fix: inject `now`.",
        },
        {
          kind: "explain",
          title: "`UserDefaults` without stepping on anything",
          body: [
            "`UserDefaults.standard` is global state: a test that writes to it pollutes the next one (and the simulator). Inject `UserDefaults` and have the test create its own with `UserDefaults(suiteName:)`.",
            "Use a unique name per test (a `UUID` will do) and wipe the domain at the end with `removePersistentDomain(forName:)`. In Swift Testing, a `class` suite gives you `init` and `deinit` for that.",
          ],
          code: swift`final class OnboardingStoreTests {
    private let suiteName = "test.onboarding.\(UUID().uuidString)"
    private let defaults: UserDefaults

    init() {
        defaults = UserDefaults(suiteName: suiteName)!
    }

    deinit {
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func marksOnboardingAsSeen() {
        let sut = OnboardingStore(defaults: defaults)
        sut.markSeen()
        #expect(sut.hasSeenOnboarding)
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the initializer that creates an isolated `UserDefaults` for the test.",
          code: swift`let defaults = UserDefaults(____: "test.settings.\(UUID().uuidString)")!`,
          accept: ["^suiteName$"],
          explanation: "`UserDefaults(suiteName:)` creates (or opens) a separate domain. With a unique name per test, nothing leaks into `.standard` or into other tests running in parallel.",
        },
        {
          kind: "explain",
          title: "Network: stubbing with `URLProtocol`",
          body: [
            "To test your HTTP client end to end (request building, status codes, decoding) without hitting the internet, register your own `URLProtocol` in the session configuration. Every request on that session goes through it and you decide what comes back.",
            "The `handler` is static, i.e. shared: mark the suite `.serialized` or parallel tests will step on each other. View model tests don't need any of this: stubbing an `HTTPClient` protocol is enough.",
          ],
          code: swift`final class URLProtocolStub: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else { return }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

func makeStubbedSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [URLProtocolStub.self]
    return URLSession(configuration: config)
}`,
        },
        {
          kind: "predict",
          prompt: "Someone accidentally commented out a line. What happens when the test runs?",
          code: swift`let config = URLSessionConfiguration.ephemeral
// config.protocolClasses = [URLProtocolStub.self]
let client = APIClient(session: URLSession(configuration: config))

URLProtocolStub.handler = { _ in (okResponse, productsFixture) }
let products = try await client.fetchProducts()
#expect(products.count == 3)`,
          options: [
            "Works the same: `URLProtocolStub` registers itself by subclassing `URLProtocol`",
            "It doesn't compile: `protocolClasses` must be set",
            "The request goes to the real network: the test now depends on connectivity and the backend",
            "It crashes because `handler` is `nil`",
          ],
          answer: 2,
          explanation:
            "Without `protocolClasses`, the session uses the default protocols and `URLProtocolStub` is never consulted. The test makes a real request: slow, fails offline, and its result depends on server data. A flaky test disguised as a unit test.",
        },
        {
          kind: "explain",
          title: "`@MainActor` view models",
          body: [
            "Test a `@MainActor` view model from a `@MainActor` test: `@Test @MainActor func ...() async` (in XCTest, mark the method or the class `@MainActor`). That way you read its properties without `await` and without concurrency warnings.",
            "The key is that the method doing the work is `async` so the test can `await` it. If the view model fires a loose `Task { }` (fire-and-forget), the test has nothing to wait on. Keep the `Task` in the view (`.task { await vm.load() }`) or store it in a property so the test can `await sut.loadTask?.value`.",
            "For callbacks or events, Swift Testing has `confirmation`: the test fails if the confirmation isn't confirmed the expected number of times (once, by default).",
          ],
          code: swift`@MainActor
@Observable
final class SearchViewModel {
    private let service: SearchService
    private(set) var results: [String] = []
    private(set) var isLoading = false

    init(service: SearchService) { self.service = service }

    func search(_ query: String) async {
        isLoading = true
        defer { isLoading = false }
        results = (try? await service.search(query)) ?? []
    }
}

@Test @MainActor func searchPublishesResults() async {
    let sut = SearchViewModel(service: SearchServiceStub(results: ["Swift"]))
    await sut.search("sw")
    #expect(sut.results == ["Swift"])
    #expect(sut.isLoading == false)
}

@Test func editorNotifiesOnSave() async {
    await confirmation("saved") { saved in
        let sut = Editor(onSave: { saved() })
        await sut.save()
    }
}`,
        },
        {
          kind: "predict",
          prompt: "What happens with this test?",
          code: swift`@MainActor
@Observable
final class FeedViewModel {
    private let service: FeedService
    private(set) var posts: [String] = []
    init(service: FeedService) { self.service = service }

    func onAppear() {
        Task { posts = (try? await service.fetch()) ?? [] }
    }
}

@Test @MainActor func onAppearLoadsPosts() {
    let sut = FeedViewModel(service: FeedServiceStub(posts: ["Hello"]))
    sut.onAppear()
    #expect(sut.posts == ["Hello"])
}`,
          options: [
            "It passes: the `Task` inherits the main actor and runs immediately",
            "It fails: the `Task` can only run once the test releases the main actor, after the `#expect`",
            "It doesn't compile: you can't create a `Task` inside `@MainActor`",
            "It passes because `@Observable` waits for `posts` to change",
          ],
          answer: 1,
          explanation:
            "`Task { }` is enqueued on the main actor, but the test is occupying it and never suspends (there's no `await`). The `#expect` runs with `posts` empty. Fix: `func load() async` and `await sut.load()` in the test.",
        },
        {
          kind: "write",
          prompt:
            "Make `Greeter` testable: inject `let now: () -> Date` (and the calendar) instead of reading `Date()` and `Calendar.current`. Then write an `@Test` that pins the time to 9:00 UTC and checks for \"Good morning\".",
          starter: swift`struct Greeter {
    func greeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        return hour < 12 ? "Good morning" : "Good afternoon"
    }
}`,
          checks: [
            { pattern: "let\\s+now\\s*:\\s*(@escaping\\s*)?\\(\\)\\s*->\\s*Date", label: "Injects `let now: () -> Date`" },
            { pattern: "now\\(\\)", label: "The logic calls `now()`" },
            { pattern: "@Test", label: "A test with `@Test`" },
            { pattern: "#expect\\(", label: "Asserts with `#expect`" },
          ],
          warnings: [{ pattern: "from:\\s*Date\\(\\)", label: "Still reading the real clock with `Date()`" }],
          solution: swift`struct Greeter {
    let now: () -> Date
    var calendar = Calendar(identifier: .gregorian)

    func greeting() -> String {
        let hour = calendar.component(.hour, from: now())
        return hour < 12 ? "Good morning" : "Good afternoon"
    }
}

@Test func morningBeforeNoon() {
    var utc = Calendar(identifier: .gregorian)
    utc.timeZone = TimeZone(identifier: "UTC")!
    let nineAM = Date(timeIntervalSince1970: 9 * 3_600) // 1970-01-01 09:00 UTC
    let sut = Greeter(now: { nineAM }, calendar: utc)

    #expect(sut.greeting() == "Good morning")
}`,
          hint: "If you don't pin the calendar's time zone, the test depends on where it runs.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "beyond-unit",
      title: "Beyond unit tests: snapshots, UI tests and CI",
      goal: "Know what to test at each level of the pyramid, write stable snapshot and UI tests, and diagnose flaky tests and misleading coverage numbers.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The pyramid on a real team",
          body: [
            "**Lots of unit tests** (milliseconds each): business rules, view models, reducers, parsers. **Some integration tests**: the HTTP client with `URLProtocol`, persistence with an in-memory store. **Few UI tests**: only the flows that cost money when they break (login, purchase, onboarding).",
            "Snapshot tests sit in the middle: they render a view and compare it with a stored image. They catch visual regressions without launching the whole app.",
            "A suite with an inverted pyramid (lots of UI tests, few unit tests) is slow, brittle, and tells you *that* something broke but not *what*.",
          ],
          code: swift`// Typical targets for a mid-sized app
ShopTests            // unit + integration (Swift Testing / XCTest)
ShopSnapshotTests    // swift-snapshot-testing
ShopUITests          // XCUITest: 5–15 critical flows

// CI on every PR:   ShopTests + ShopSnapshotTests
// Nightly CI:       everything, including UI tests on several devices`,
        },
        {
          kind: "predict",
          prompt: "This is your team's CI report. Which change has the most impact?",
          code: swift`ShopUITests     410 tests   48 min   7 flaky per week
ShopTests        35 tests    9 s     0 flaky`,
          options: [
            "Add automatic retries to every UI test",
            "Parallelize across more simulators and leave the tests as they are",
            "Delete the UI tests and rely on manual QA",
            "Push logic checks down to unit tests and keep a few UI tests for critical flows",
          ],
          answer: 3,
          explanation:
            "Nearly everything those 410 UI tests check (validations, calculations, error states) can be checked in view model unit tests in milliseconds, with no flakiness. Retries and parallelization hide the problem; deleting everything loses the safety net for critical flows.",
        },
        {
          kind: "explain",
          title: "Snapshot tests",
          body: [
            "With swift-snapshot-testing (Point-Free), `assertSnapshot(of:as:)` renders the view with a strategy (`.image`, `.recursiveDescription`, `.dump`...) and compares it with the file in `__Snapshots__/`. If there's no reference yet, it records one and the test **fails** so you review and commit it.",
            "To re-record on purpose, use record mode (`withSnapshotTesting(record: .all) { ... }` or the `record:` parameter on the assertion). Review image diffs in the PR the same way you review code.",
            "The classic problem: rendering differs across iOS versions and simulator models. Pin a single simulator and OS version in CI and record with that same setup. Test the variants that matter: dark mode, large Dynamic Type, long localizations.",
          ],
          code: swift`import SnapshotTesting
import SwiftUI
import XCTest

final class ProfileCardSnapshotTests: XCTestCase {
    func test_profileCard_light() {
        let vc = UIHostingController(rootView: ProfileCard(name: "Ana", plan: .pro))
        assertSnapshot(of: vc, as: .image(on: .iPhone13))
    }

    func test_profileCard_dark() {
        let vc = UIHostingController(rootView: ProfileCard(name: "Ana", plan: .pro))
        assertSnapshot(
            of: vc,
            as: .image(on: .iPhone13, traits: UITraitCollection(userInterfaceStyle: .dark))
        )
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the strategy that compares the view as an image.",
          code: swift`assertSnapshot(of: viewController, as: .____(on: .iPhone13))`,
          accept: ["^image$"],
          explanation: "`.image(on:)` renders at that device's size and traits and compares pixels against the stored reference.",
        },
        {
          kind: "explain",
          title: "XCUITest done right",
          body: [
            "UI tests run in **another process**: they can't touch the app's code. They communicate through `launchArguments` and `launchEnvironment`, which the app reads at launch to use stubbed services, reset state or skip onboarding.",
            "Find elements by `accessibilityIdentifier`, not by visible text: text changes with language and copy, the identifier doesn't (and VoiceOver doesn't read it). Use a `screen.element` style format.",
            "Wait with `waitForExistence(timeout:)`, never with `sleep`. Set `continueAfterFailure = false` so the test stops at the first broken step.",
          ],
          code: swift`// App
Button("Pay") { model.pay() }
    .accessibilityIdentifier("checkout.payButton")

// At app launch
if ProcessInfo.processInfo.arguments.contains("-uiTesting") {
    container.useStubbedServices()
}

// ShopUITests target
final class CheckoutUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func test_pay_showsConfirmation() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        app.buttons["checkout.payButton"].tap()

        XCTAssertTrue(app.staticTexts["checkout.confirmation"].waitForExistence(timeout: 5))
    }
}`,
        },
        {
          kind: "predict",
          prompt: "This UI test passes on your machine and fails in the CI test plan that runs the \"Spanish\" configuration. Why?",
          code: swift`// View: Button(String(localized: "Pay")) { ... }
app.buttons["Pay"].tap()`,
          options: [
            "The label is localized (\"Pagar\"): find it by `accessibilityIdentifier` instead",
            "The button is slower on CI: it needs a `sleep(2)`",
            "`app.buttons` only works in the Mac's system language",
            "UI tests can't run in another language",
          ],
          answer: 0,
          explanation:
            "The `app.buttons[\"...\"]` subscript matches by identifier or label. With no identifier it uses the visible label, which in Spanish is \"Pagar\". With `.accessibilityIdentifier(\"checkout.payButton\")` the test works in any language.",
        },
        {
          kind: "write",
          prompt:
            "Get `LoginView` ready for UI testing (identifiers on the field and the button) and write `test_login_showsHome`: launch the app with `-uiTesting`, type an email, tap the button and wait for `home.title` to appear.",
          starter: swift`// App
struct LoginView: View {
    @State private var email = ""
    var body: some View {
        VStack {
            TextField("Email", text: $email)
            Button("Log in") { /* ... */ }
        }
    }
}

// ShopUITests
final class LoginUITests: XCTestCase {
    func test_login_showsHome() {
        // ...
    }
}`,
          checks: [
            { pattern: "\\.accessibilityIdentifier\\(\"", label: "Stable identifiers in the view" },
            { pattern: "launchArguments", label: "Sets `launchArguments`" },
            { pattern: "\\.launch\\(\\)", label: "Launches the app with `launch()`" },
            { pattern: "waitForExistence\\(timeout:", label: "Waits with `waitForExistence(timeout:)`" },
          ],
          warnings: [
            { pattern: "sleep\\(", label: "Don't use `sleep`: wait for a specific element" },
            { pattern: "buttons\\[\"(Entrar|Log in)\"\\]", label: "You're finding the button by its localized text" },
          ],
          solution: swift`// App
struct LoginView: View {
    @State private var email = ""
    var body: some View {
        VStack {
            TextField("Email", text: $email)
                .accessibilityIdentifier("login.email")
            Button("Log in") { /* ... */ }
                .accessibilityIdentifier("login.submit")
        }
    }
}

// ShopUITests
final class LoginUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func test_login_showsHome() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        let email = app.textFields["login.email"]
        email.tap()
        email.typeText("ana@example.com")
        app.buttons["login.submit"].tap()

        XCTAssertTrue(app.staticTexts["home.title"].waitForExistence(timeout: 5))
    }
}`,
          hint: "The field needs focus before `typeText`: tap it first.",
        },
        {
          kind: "explain",
          title: "Test plans, coverage and flaky tests",
          body: [
            "A **test plan** (`.xctestplan`) defines which targets run and with which configurations: languages, environment variables, sanitizers (Thread Sanitizer for data races), random ordering and parallel execution. You can have one for PRs and another for nightly runs.",
            "**Coverage** measures which lines were *executed*, not what was *verified*. A test with no assertions still raises coverage. Use it to find untested code, not as a target: \"80% mandatory\" produces empty tests.",
            "Typical causes of flakiness: shared state (singletons, `UserDefaults.standard`, statics), the real clock, order dependence, an un-awaited `Task`, the real network, animations. To reproduce: run the test many times until it fails. While you fix it, quarantine it (`.disabled` with a ticket); don't delete it.",
          ],
          code: swift`xcodebuild test \
  -scheme Shop \
  -testPlan CI \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:ShopTests/CartTests \
  -test-iterations 100 \
  -run-tests-until-failure \
  -enableCodeCoverage YES`,
        },
        {
          kind: "predict",
          prompt: "Xcode shows `PriceCalculator.swift` at 100% coverage. What does this test guarantee?",
          code: swift`func test_applyDiscount() {
    _ = PriceCalculator().apply(code: "SAVE10", to: 1_000)
    _ = PriceCalculator().apply(code: "BOGUS", to: 1_000)
}`,
          options: [
            "That discounts are calculated correctly",
            "That the code under test has no bugs",
            "Only that the code runs without crashing: no result is verified",
            "Nothing: Xcode's coverage is misconfigured",
          ],
          answer: 2,
          explanation:
            "Coverage = lines executed. With no `XCTAssertEqual` or `#expect`, any result passes: `apply` could always return 0. A reviewer has to look at the assertions, not the percentage.",
        },
        {
          kind: "fill",
          prompt: "Fill in the `xcodebuild` flag that repeats the test until it fails, to hunt down a flaky one.",
          code: swift`xcodebuild test -scheme Shop -only-testing:ShopTests/SyncTests -test-iterations 200 -____`,
          accept: ["^run-tests-until-failure$", "^-run-tests-until-failure$"],
          explanation: "`-test-iterations N -run-tests-until-failure` runs up to N times and stops at the first failure, keeping that run's log. There's also `-retry-tests-on-failure`, but that one just hides the problem.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: a shopping cart with TDD",
      goal: "Build a cart with TDD (red → green → refactor), including discounts, shipping and edge cases, using everything from the course.",
      minutes: 30,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "Product hands you the cart rules: (1) adding the same SKU adds up quantities; (2) a quantity `<= 0` throws `CartError.invalidQuantity`; (3) the subtotal is the sum of `price × quantity`, in cents (`Int`, never `Double` for money); (4) the `SAVE10` code takes 10% off the subtotal, rounding down; (5) shipping is 500 cents if the discounted amount is under 5000, free from 5000 up or if the cart is empty.",
            "You'll do it with TDD: **red** (a failing test, even if it fails because it doesn't compile), **green** (the minimum code to make it pass) and **refactor** (clean up with the tests green). One cycle per rule.",
            "Here's the first test. It doesn't compile because `Cart` doesn't exist yet: that already counts as red.",
          ],
          code: swift`import Testing
@testable import Shop

@Suite("Cart")
struct CartTests {
    @Test func emptyCartHasZeroSubtotal() {
        let cart = Cart()
        #expect(cart.subtotalCents == 0)
    }
}
// RED: compile error "cannot find 'Cart' in scope"`,
        },
        {
          kind: "predict",
          prompt: "The test is red. In TDD, what's the next step?",
          code: swift`// Red: "cannot find 'Cart' in scope"`,
          options: [
            "Implement the full cart with discounts and shipping, since you know the rules",
            "Write the minimum to make it pass, even just `struct Cart { let subtotalCents = 0 }`",
            "Write tests for every rule before touching production code",
            "Refactor the test to use `XCTestCase`",
          ],
          answer: 1,
          explanation:
            "Green with the simplest possible code. It feels silly, but it forces the **next test** to be the one that drives the real logic (adding items). That way every production line exists because a test asked for it, and refactoring happens with a safety net.",
        },
        {
          kind: "write",
          prompt:
            "Red for rules 1 and 2. Add two tests to `CartTests`: adding SKU `\"TSHIRT\"` twice (quantities 1 and 2, 2000 cents) leaves **one** item with quantity 3; adding with quantity 0 throws `CartError.invalidQuantity`. The API is `mutating func add(sku:priceCents:quantity:) throws`.",
          starter: swift`import Testing
@testable import Shop

struct CartTests {
    @Test func emptyCartHasZeroSubtotal() {
        #expect(Cart().subtotalCents == 0)
    }

    // new tests here
}`,
          checks: [
            { pattern: "@Test\\s+func\\s+\\w+\\(\\)\\s*throws", label: "A `throws` test so it can call `add`" },
            { pattern: "\\.add\\(", label: "Uses `add(sku:priceCents:quantity:)`" },
            { pattern: "items\\.count\\s*==\\s*1|items\\.first\\?\\.quantity\\s*==\\s*3", label: "Checks it merged into one item" },
            { pattern: "#expect\\(\\s*throws:\\s*CartError\\.invalidQuantity", label: "Checks the error with `#expect(throws:)`" },
          ],
          warnings: [{ pattern: "XCTAssert", label: "In Swift Testing use `#expect`" }],
          solution: swift`import Testing
@testable import Shop

struct CartTests {
    @Test func emptyCartHasZeroSubtotal() {
        #expect(Cart().subtotalCents == 0)
    }

    @Test func addingSameSkuMergesQuantity() throws {
        var cart = Cart()

        try cart.add(sku: "TSHIRT", priceCents: 2_000, quantity: 1)
        try cart.add(sku: "TSHIRT", priceCents: 2_000, quantity: 2)

        #expect(cart.items.count == 1)
        #expect(cart.items.first?.quantity == 3)
        #expect(cart.subtotalCents == 6_000)
    }

    @Test func zeroQuantityThrows() {
        var cart = Cart()
        #expect(throws: CartError.invalidQuantity) {
            try cart.add(sku: "MUG", priceCents: 1_200, quantity: 0)
        }
    }
}`,
          hint: "For the error: `#expect(throws: CartError.invalidQuantity) { try ... }`.",
        },
        {
          kind: "write",
          prompt:
            "Green. Implement `CartError` and `Cart` as a `struct` so the tests pass: `items`, a computed `subtotalCents`, and `add(sku:priceCents:quantity:)` that validates and merges by SKU.",
          starter: swift`struct CartItem: Equatable {
    let sku: String
    let priceCents: Int
    var quantity: Int
}

// Implement CartError and Cart`,
          checks: [
            { pattern: "enum\\s+CartError\\s*:\\s*(Swift\\.)?Error", label: "`CartError` is an `enum` conforming to `Error`" },
            { pattern: "struct\\s+Cart\\b", label: "`Cart` is a `struct`" },
            { pattern: "var\\s+subtotalCents\\s*:\\s*Int", label: "Computed `subtotalCents: Int`" },
            { pattern: "mutating\\s+func\\s+add\\(", label: "`add` is `mutating`" },
            { pattern: "throw\\s+CartError\\.invalidQuantity", label: "Throws `CartError.invalidQuantity`" },
          ],
          warnings: [
            { pattern: "class\\s+Cart\\b", label: "Structs by default: `Cart` doesn't need identity" },
            { pattern: "\\b(Double|Float)\\b", label: "Money in cents with `Int`, not floating point" },
          ],
          solution: swift`struct CartItem: Equatable {
    let sku: String
    let priceCents: Int
    var quantity: Int
}

enum CartError: Error {
    case invalidQuantity
}

struct Cart {
    private(set) var items: [CartItem] = []

    var subtotalCents: Int {
        items.reduce(0) { $0 + $1.priceCents * $1.quantity }
    }

    mutating func add(sku: String, priceCents: Int, quantity: Int) throws {
        guard quantity > 0 else { throw CartError.invalidQuantity }
        if let index = items.firstIndex(where: { $0.sku == sku }) {
            items[index].quantity += quantity
        } else {
            items.append(CartItem(sku: sku, priceCents: priceCents, quantity: quantity))
        }
    }
}`,
          hint: "`firstIndex(where:)` to find the SKU and `guard` to validate the quantity.",
        },
        {
          kind: "predict",
          prompt: "You've implemented discount and shipping. With a single item at 5500 cents, what does this print?",
          code: swift`extension Cart {
    func totalCents(discountCode: String? = nil) -> Int {
        let discount = discountCode == "SAVE10" ? subtotalCents * 10 / 100 : 0
        let afterDiscount = max(subtotalCents - discount, 0)
        let shipping = afterDiscount >= 5_000 || afterDiscount == 0 ? 0 : 500
        return afterDiscount + shipping
    }
}

var cart = Cart()
try cart.add(sku: "JACKET", priceCents: 5_500, quantity: 1)
print(cart.totalCents(discountCode: "SAVE10"), cart.totalCents())`,
          options: ["5450 5500", "4950 5500", "4950 6000", "5450 6000"],
          answer: 0,
          explanation:
            "With `SAVE10`: discount is 550, leaving 4950, which is under 5000, so shipping is added: 4950 + 500 = 5450. Without a code: 5500 ≥ 5000, free shipping: 5500. That edge case (the discount knocks you out of free shipping) is exactly the one that belongs in a test.",
        },
        {
          kind: "write",
          prompt:
            "Cover `totalCents(discountCode:)` with **one** parameterized test: with `SAVE10` and a single item priced 1000, 5500, 6000 and 10000 cents, the expected totals are 1400, 5450, 5400 and 9000. Pair prices and results with `zip`.",
          starter: swift`import Testing
@testable import Shop

// parameterized test here`,
          checks: [
            { pattern: "@Test\\s*\\(\\s*arguments:", label: "Parameterized test with `arguments:`" },
            { pattern: "zip\\(", label: "Pairs input and result with `zip`" },
            { pattern: "totalCents\\(", label: "Exercises `totalCents`" },
            { pattern: "#expect\\(", label: "Asserts with `#expect`" },
          ],
          warnings: [
            { pattern: "XCTAssert", label: "In Swift Testing use `#expect`" },
            { pattern: "for\\s+\\w+\\s+in", label: "A `for` loop inside the test hides which case failed" },
          ],
          solution: swift`import Testing
@testable import Shop

@Test(arguments: zip([1_000, 5_500, 6_000, 10_000], [1_400, 5_450, 5_400, 9_000]))
func totalWithSave10(priceCents: Int, expected: Int) throws {
    var cart = Cart()
    try cart.add(sku: "ITEM", priceCents: priceCents, quantity: 1)

    #expect(cart.totalCents(discountCode: "SAVE10") == expected)
}`,
          hint: "1000 → 900 + 500 shipping; 6000 → 5400, already free shipping.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-setup-vs-init",
      front: "What replaces `setUp`/`tearDown` in Swift Testing?",
      back: "The suite's `init` (a new instance is created per test) and, for cleanup, `deinit` on a `class` or `actor` suite.",
    },
    {
      id: "fc-xctunwrap",
      front: "Why `XCTUnwrap` instead of `!` in a test?",
      back: "`!` on `nil` crashes the test process and you lose the report for everything else. `try XCTUnwrap(x)` records the failure and stops only that test.",
      code: "let user = try XCTUnwrap(users.first)",
    },
    {
      id: "fc-expect-require",
      front: "`#expect` vs `#require`",
      back: "`#expect` records the issue and keeps going. `try #require` records the issue and ends the test; it also unwraps optionals. Use `#require` for preconditions.",
    },
    {
      id: "fc-arguments",
      front: "`@Test(arguments: a, b)` with two collections: how many cases?",
      back: "The Cartesian product: `a.count × b.count`. To pair them one-to-one, use `arguments: zip(a, b)`.",
    },
    {
      id: "fc-expect-throws",
      front: "How do you check that a specific error is thrown in Swift Testing?",
      back: "`#expect(throws: MyError.someCase) { try ... }` (the error must be `Equatable`). For any error of that type: `#expect(throws: MyError.self)`.",
    },
    {
      id: "fc-stub-spy",
      front: "Stub vs spy",
      back: "A stub controls what goes **in** (canned answers). A spy records what comes **out** (calls, events) so you can verify it later.",
    },
    {
      id: "fc-fake-mock",
      front: "Fake vs mock",
      back: "A fake is a working, simplified implementation (an in-memory repository). A mock is pre-programmed with the calls it expects and verifies itself.",
    },
    {
      id: "fc-overspecified",
      front: "Symptom of an overspecified test",
      back: "It breaks on refactors that don't change behavior, because it checks the order or number of internal calls instead of the outcome.",
    },
    {
      id: "fc-clock",
      front: "How do you test logic that depends on the current date?",
      back: "Inject \"now\" (`now: () -> Date`) or a `Clock`, and pin `Calendar`/`TimeZone` too. Never `Date()` inside the logic.",
    },
    {
      id: "fc-userdefaults",
      front: "`UserDefaults` in tests",
      back: "Inject it and create one with `UserDefaults(suiteName:)` using a unique name; at the end, `removePersistentDomain(forName:)`.",
    },
    {
      id: "fc-urlprotocol",
      front: "How do you stub the network without changing the HTTP client?",
      back: "A `URLProtocol` subclass registered in `URLSessionConfiguration.protocolClasses` that answers with fixed data.",
      code: "let config = URLSessionConfiguration.ephemeral\nconfig.protocolClasses = [URLProtocolStub.self]",
    },
    {
      id: "fc-a11y-id",
      front: "Why `accessibilityIdentifier` in UI tests?",
      back: "It doesn't depend on language or copy, and VoiceOver doesn't read it. Finding elements by visible text breaks the test when you translate or reword a label.",
    },
    {
      id: "fc-snapshot-first",
      front: "What happens the first time an `assertSnapshot` runs?",
      back: "It records the reference image in `__Snapshots__/` and the test fails, so you review and commit it.",
    },
    {
      id: "fc-coverage",
      front: "What does code coverage measure?",
      back: "Lines executed by tests, not behavior verified. It's for finding untested code, not a goal in itself.",
    },
    {
      id: "fc-tdd",
      front: "The TDD cycle",
      back: "Red (a failing test), green (the minimum code to pass), refactor (clean up with the tests green). One behavior per cycle.",
    },
  ],

  exam: [
    {
      id: "ex-01",
      question: "A view model creates `let api = APIClient()` internally and calls `URLSession.shared`. The PR reviewer asks for tests. What do you suggest first?",
      options: [
        "Write UI tests covering the screen",
        "Use method swizzling on `URLSession` in the tests",
        "Inject the dependency through `init` as a protocol and use a stub in tests",
        "Make `api` a global variable so it can be replaced",
      ],
      answer: 2,
      explanation: "Injecting a protocol through `init` is what lets you pass a stub without tricks. Swizzling and globals add shared state and brittle tests; UI tests are slow for checking logic.",
    },
    {
      id: "ex-02",
      question: "What does this test do if `user` is `nil`?",
      code: "@Test func avatar() throws {\n    let user = try #require(repo.current)\n    #expect(user.avatarURL != nil)\n}",
      options: [
        "Records an issue at `#require` and ends the test without evaluating the `#expect`",
        "Crashes the test process",
        "Passes, because `#require` ignores `nil`",
        "Records two issues",
      ],
      answer: 0,
      explanation: "`#require` records the issue and throws; the test exits and the `#expect` is never evaluated.",
    },
    {
      id: "ex-03",
      question: "You have 12 email validation checks written as a `for` loop over an array of cases inside a single test. It fails on CI. What's the better approach?",
      options: [
        "Add a `print` for each case to see which one failed",
        "Split them into 12 copy-pasted methods",
        "Mark the test `.serialized`",
        "Turn it into `@Test(arguments:)` so each case is reported separately",
      ],
      answer: 3,
      explanation: "With a parameterized test each argument is an independent case in the report: you see exactly which email failed and the rest keep running.",
    },
    {
      id: "ex-04",
      question: "You need to verify that logging out sends a `logout` analytics event. Which double do you use for `Analytics`?",
      options: ["A dummy", "A spy", "A database fake", "A stub that returns `nil`"],
      answer: 1,
      explanation: "It's an outgoing effect that doesn't show up in the view model's state: the spy records events and the test checks `spy.events == [\"logout\"]`.",
    },
    {
      id: "ex-05",
      question: "A \"deal valid until the end of the month\" test passed all month and failed on the 1st. What's the most likely cause and fix?",
      options: [
        "The simulator version changed; pin the simulator",
        "The logic reads the real clock; inject `now: () -> Date` and fix the date in the test",
        "It's missing `.timeLimit`; add it",
        "Tests run in parallel; add `.serialized`",
      ],
      answer: 1,
      explanation: "A test whose result changes with the date depends on `Date()`. Injecting \"now\" (and the calendar) makes it deterministic.",
    },
    {
      id: "ex-06",
      question: "Two tests in a suite write to `UserDefaults.standard` and fail intermittently, but pass when run alone. What do you do?",
      options: [
        "Add `sleep(1)` between the writes",
        "Clear `UserDefaults.standard` at the start of each test",
        "Run the whole suite on a single thread",
        "Inject `UserDefaults` and give each test its own via a unique `UserDefaults(suiteName:)`",
      ],
      answer: 3,
      explanation: "The problem is shared state plus parallel execution. A dedicated domain per test removes the dependency; serializing or clearing the standard one only masks it.",
    },
    {
      id: "ex-07",
      question: "You want to test that your `APIClient` builds the request correctly (headers, path) and maps a 404 to your domain error, without hitting the internet. What do you use?",
      options: [
        "A `URLProtocol` stub registered in the `protocolClasses` of a `URLSessionConfiguration`",
        "A stub of the `APIClient` protocol",
        "A UI test with the app pointed at production",
        "A snapshot test of the JSON",
      ],
      answer: 0,
      explanation: "To test the client itself its code has to actually run on top of `URLSession`; the `URLProtocol` stub intercepts the request and returns whatever response you choose. Stubbing `APIClient` would skip exactly what you want to test.",
    },
    {
      id: "ex-08",
      question: "What happens with this test?",
      code: "@Test @MainActor func refresh() {\n    let sut = InboxViewModel(service: InboxStub(count: 3))\n    sut.refresh() // inside: Task { unread = await service.unread() }\n    #expect(sut.unread == 3)\n}",
      options: [
        "It always passes",
        "It doesn't compile",
        "It fails: the `Task` doesn't run until the test releases the main actor",
        "It only passes on real devices",
      ],
      answer: 2,
      explanation: "The test is synchronous on the main actor and never suspends, so the enqueued `Task` runs after the `#expect`. Make it `refresh() async` and `await sut.refresh()` in the test.",
    },
    {
      id: "ex-09",
      question: "Snapshot tests pass on your Mac and fail on CI with tiny pixel differences across every view. What's most likely?",
      options: [
        "A SwiftUI bug",
        "Missing `continueAfterFailure = false`",
        "The references are in `.gitignore`",
        "CI uses a different simulator or iOS version than the one that recorded the references",
      ],
      answer: 3,
      explanation: "Rendering varies across device models and iOS versions. Pin one simulator and OS version in CI and record references with that same setup.",
    },
    {
      id: "ex-10",
      question: "A UI test does `app.buttons[\"Continue\"].tap()` followed by `sleep(3)` before checking the next screen. What would you change?",
      options: [
        "Bump the `sleep` to 5 seconds for CI",
        "Use an `accessibilityIdentifier` and wait with `waitForExistence(timeout:)`",
        "Replace it with a snapshot test",
        "Run it on CI with `-retry-tests-on-failure`",
      ],
      answer: 1,
      explanation: "Visible text changes with language and copy; `sleep` makes the test slow when it's too long and flaky when it's too short. Identifier plus an explicit wait is stable.",
    },
    {
      id: "ex-11",
      question: "The team wants to raise the CI coverage gate from 60% to 90%. What's the main risk?",
      options: [
        "People write tests that execute code without verifying anything, just to hit the number",
        "Xcode stops compiling",
        "UI tests don't count toward coverage",
        "None: more coverage is always better",
      ],
      answer: 0,
      explanation: "Coverage measures executed lines, not assertions. As a hard target it rewards empty tests; it's more useful to check in the PR that new logic has tests with real assertions.",
    },
    {
      id: "ex-12",
      question: "Doing TDD, you wrote a red test for \"the SAVE10 code gives 10% off\". What do you do after you see it go green?",
      options: [
        "Move on to the next requirement without touching anything",
        "Delete the test since it has served its purpose",
        "Refactor the code (and tests) while keeping everything green, then write the next red test",
        "Add every other discount at once",
      ],
      answer: 2,
      explanation: "The cycle is red → green → refactor. Refactoring under a safety net is what keeps the code clean; then comes the next failing test.",
    },
  ],
};

export default content;
