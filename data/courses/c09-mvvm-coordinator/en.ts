import type { CourseContent } from "../types";

// Literal Swift code: String.raw keeps `\(...)` and `\n` as written.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "mvc-massive-vc",
      title: "MVC and the Massive View Controller",
      goal: "Spot why a view controller grows out of control and list which responsibilities to pull out of it.",
      minutes: 14,
      steps: [
        {
          kind: "explain",
          title: "Apple's MVC in practice",
          body: [
            "In Apple's MVC the **Model** is the data, the **View** draws, and the **Controller** coordinates. In UIKit the controller is a `UIViewController`, which also owns the view and receives the whole lifecycle (`viewDidLoad`, `viewWillAppear`…). The result: it's the most convenient place to put anything.",
            "That's how the **Massive View Controller** is born: networking, parsing, persistence, text formatting, loading state and navigation in one 800-line class. We'll use this product screen as the thread running through the course and take it apart step by step.",
            "Notice that each comment in the code marks a different responsibility. None of them is 'show a table'.",
          ],
          code: swift`final class ProductListViewController: UITableViewController {
    private var products: [Product] = []
    private var favorites = Set(UserDefaults.standard.array(forKey: "favs") as? [Int] ?? []) // persistence

    override func viewDidLoad() {
        super.viewDidLoad()
        Task {
            let url = URL(string: "https://api.shop.com/products")!
            let (data, _) = try await URLSession.shared.data(from: url)        // networking
            products = try JSONDecoder().decode([Product].self, from: data)  // parsing
            tableView.reloadData()
        }
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        let product = products[indexPath.row]
        let price = String(format: "$%.2f", Double(product.priceCents) / 100) // formatting
        cell.textLabel?.text = favorites.contains(product.id) ? "★ \(product.name) \(price)" : "\(product.name) \(price)"
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let detail = ProductDetailViewController(product: products[indexPath.row])  // navigation
        navigationController?.pushViewController(detail, animated: true)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "In the VC above, what does the user see if `URLSession` fails in `viewDidLoad`?",
          code: swift`Task {
    let url = URL(string: "https://api.shop.com/products")!
    let (data, _) = try await URLSession.shared.data(from: url)
    products = try JSONDecoder().decode([Product].self, from: data)
    tableView.reloadData()
}`,
          options: [
            "The app crashes with the network error",
            "A `UIAlertController` with the error, which UIKit shows on its own",
            "Nothing: the error is stored in the `Task`, nobody reads it, and the table stays empty forever",
            "It doesn't compile: you can't use `try` inside a `Task` without `do/catch`",
          ],
          answer: 2,
          explanation: "A `Task` closure is allowed to throw: the error becomes the task's result. Since nobody does `await task.value`, it's silently lost. There's no loading or error state, so the user sees an empty table. That's a classic Massive VC symptom: the screen's state isn't modeled anywhere.",
        },
        {
          kind: "explain",
          title: "Inventory: where each thing goes",
          body: [
            "Before refactoring, take inventory. Networking and parsing → a **service** behind a protocol. Favorites in `UserDefaults` → a **store**. Price formatting and loading state → the **view model**. Which screen to open when a row is tapped → a **coordinator**. What stays in the VC is pure view work: configure cells and forward events.",
            "The first step is usually the cheapest: extract pure functions. A function that takes data and returns a `String` can be tested without a simulator.",
          ],
          code: swift`import Foundation

func priceText(cents: Int) -> String {
    String(format: "$%.2f", Double(cents) / 100)
}

print(priceText(cents: 1999))
print(priceText(cents: 500))`,
          output: "$19.99\n$5.00",
        },
        {
          kind: "fill",
          prompt: "Networking moves out of the VC behind a protocol. Complete the signature so the call is asynchronous and can fail.",
          code: swift`protocol ProductService: Sendable {
    func fetchProducts() ____ -> [Product]
}`,
          accept: ["^async throws$"],
          explanation: "`async throws` (in that order) says the call suspends and can throw. The protocol is `Sendable` because the service is used from a `@MainActor` view model and called asynchronously.",
          hint: "Two keywords: the concurrency one first, then the error one.",
          placeholder: "async ...",
        },
        {
          kind: "explain",
          title: "Why it hurts: tests and navigation",
          body: [
            "You want a test that says 'if the API fails, the screen shows an error'. With the Massive VC you have to spin up UIKit, trigger `viewDidLoad`, hit the real network and read table cells. Slow, flaky, and almost nobody writes it.",
            "Navigation is welded in too: the list knows about `ProductDetailViewController`. If product asks for the same list in another flow with a different destination tomorrow, you either copy the whole VC or add an `if`.",
          ],
          code: swift`// What you want to test:
// "if the API fails, the screen shows an error"

// What the Massive VC forces you to do:
let vc = ProductListViewController()
vc.loadViewIfNeeded()   // triggers viewDidLoad → real network
// ...wait for the network, count cells, guess the state`,
        },
        {
          kind: "predict",
          prompt: "Product wants to reuse the list in a 'Pick a gift' flow: tapping a product does NOT open the detail, it dismisses the modal and returns the chosen product. What gets in the way in this VC?",
          code: swift`override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let detail = ProductDetailViewController(product: products[indexPath.row])
    navigationController?.pushViewController(detail, animated: true)
}`,
          options: [
            "The VC decides navigation in `didSelectRowAt`: the destination is coupled to the screen",
            "A `UITableViewController` can't be presented modally",
            "`products` is `private` and can't be read from outside",
            "`pushViewController` only works in the app's main flow",
          ],
          answer: 0,
          explanation: "The VC knows where to go next. If it emitted an event instead ('this product was picked') and another object chose the destination, the same screen would work for both flows. That's what the coordinator solves later on.",
        },
        {
          kind: "write",
          prompt: "First refactor step: declare `ProductService` (with an asynchronous, throwing `fetchProducts()`) and have the VC receive it through `init(service:)` instead of using `URLSession.shared`.",
          starter: swift`final class ProductListViewController: UITableViewController {
    private var products: [Product] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        Task {
            let url = URL(string: "https://api.shop.com/products")!
            let (data, _) = try await URLSession.shared.data(from: url)
            products = try JSONDecoder().decode([Product].self, from: data)
            tableView.reloadData()
        }
    }
}`,
          checks: [
            { pattern: "protocol\\s+ProductService", label: "Declares the `ProductService` protocol" },
            { pattern: "func\\s+fetchProducts\\(\\)\\s+async\\s+throws\\s*->\\s*\\[Product\\]", label: "`fetchProducts()` is `async throws` and returns `[Product]`" },
            { pattern: "init\\(service:\\s*(any\\s+)?ProductService\\)", label: "The VC receives the service via `init(service:)`" },
            { pattern: "try\\s+await\\s+(self\\.)?service\\.fetchProducts\\(\\)", label: "Loads with `try await service.fetchProducts()`" },
          ],
          warnings: [
            { pattern: "URLSession\\.shared", label: "The VC still talks to the network directly" },
          ],
          solution: swift`protocol ProductService: Sendable {
    func fetchProducts() async throws -> [Product]
}

final class ProductListViewController: UITableViewController {
    private let service: any ProductService
    private var products: [Product] = []

    init(service: any ProductService) {
        self.service = service
        super.init(style: .plain)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        Task {
            products = try await service.fetchProducts()
            tableView.reloadData()
        }
    }
}`,
          hint: "Store the service in `private let service: any ProductService` and don't forget `required init?(coder:)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "mvvm-swiftui",
      title: "MVVM in SwiftUI",
      goal: "Write an `@Observable`, `@MainActor` view model with enum state, injected services, and a view that only draws.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Roles and state as an enum",
          body: [
            "In MVVM, the **Model** is data and business rules; the **View** draws a state and forwards events; the **ViewModel** holds the screen state and presentation logic (what to show, when to load, which error text). The view model doesn't know the view.",
            "Model the screen state as an `enum`. With three loose properties (`isLoading`, `error`, `products`) you can reach impossible states, like a spinner and an error at the same time. With an enum, the screen is in exactly one case.",
          ],
          code: swift`struct Product: Identifiable, Equatable, Decodable, Sendable {
    let id: Int
    let name: String
    let priceCents: Int
}

enum LoadState: Equatable {
    case idle
    case loading
    case loaded([Product])
    case failed(String)
}`,
        },
        {
          kind: "predict",
          code: swift`enum LoadState: Equatable {
    case idle, loading, loaded([String]), failed(String)
}

var state = LoadState.idle
print(state)
state = .loaded(["Mate", "Yerba"])
print(state)
print(state == .loaded(["Mate", "Yerba"]))`,
          options: [
            "`LoadState.idle` / `LoadState.loaded([\"Mate\", \"Yerba\"])` / `true`",
            "`idle` / `loaded([\"Mate\", \"Yerba\"])` / `true`",
            "`idle` / `loaded([Mate, Yerba])` / `true`",
            "`idle` / `loaded([\"Mate\", \"Yerba\"])` / `false`",
          ],
          answer: 1,
          explanation: "Printing an enum case shows the case name without the type: `idle`. With an associated value it shows the payload, and strings inside an array keep their quotes: `loaded([\"Mate\", \"Yerba\"])`. Since `LoadState` is `Equatable` (synthesized because `[String]` and `String` are), the comparison is `true`.",
        },
        {
          kind: "explain",
          title: "The view model",
          body: [
            "`@Observable` (iOS 17) makes SwiftUI redraw only the views that read the property that changed. `@MainActor` guarantees `state` is written on the main thread: the `await` on the network suspends without blocking and hops back to main by itself.",
            "The service comes in through the initializer as `any ProductService`: the app passes the real one, tests pass a fake. `private(set)` means only the view model changes the state. And there's no `import SwiftUI`: the view model is plain Swift and is tested without views.",
          ],
          code: swift`import Observation

@MainActor
@Observable
final class ProductListViewModel {
    private(set) var state: LoadState = .idle
    private let service: any ProductService

    init(service: any ProductService) {
        self.service = service
    }

    func load() async {
        state = .loading
        do {
            let products = try await service.fetchProducts()
            state = .loaded(products)
        } catch {
            state = .failed("Couldn't load products")
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the modifier that starts loading when the view appears and cancels it when the view goes away.",
          code: swift`struct ProductListView: View {
    @State private var viewModel: ProductListViewModel

    init(viewModel: ProductListViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        content
            .____ { await viewModel.load() }
    }
}`,
          accept: ["^task$", "^\\.task$"],
          explanation: "`.task { }` runs `async` code when the view appears and cancels that task when it disappears. It's the natural place to call `await viewModel.load()`; no need to create a `Task` by hand in `onAppear`.",
          placeholder: "modifier",
        },
        {
          kind: "explain",
          title: "Dumb views (and iOS 16)",
          body: [
            "The view `switch`es over the state and draws. It decides nothing: it doesn't format prices, catch errors, or know where data comes from. If you need logic, it goes to the view model, which is testable.",
            "If your app supports iOS 16 or earlier, `@Observable` isn't available: you use `ObservableObject` with `@Published var state`, and the owning view keeps it with `@StateObject`. Views that receive it use `@ObservedObject`. The MVVM idea is the same.",
          ],
          code: swift`var body: some View {
    switch viewModel.state {
    case .idle, .loading:
        ProgressView()
    case .loaded(let products):
        List(products) { product in
            Text(product.name)
        }
        .refreshable { await viewModel.load() }
    case .failed(let message):
        ContentUnavailableView(message, systemImage: "wifi.slash")
    }
}

// iOS 16 or earlier:
@MainActor
final class LegacyProductListViewModel: ObservableObject {
    @Published private(set) var state: LoadState = .idle
}
struct LegacyProductListView: View {
    @StateObject private var viewModel = LegacyProductListViewModel()
    var body: some View { Text("\(viewModel.state)") }
}`,
        },
        {
          kind: "predict",
          prompt: "The screen owns its `@Observable` view model and creates it itself. Which wrapper keeps it from being recreated on every parent render?",
          code: swift`@MainActor
@Observable
final class ProductListViewModel { /* ... */ }

struct ProductListView: View {
    ??? private var viewModel = ProductListViewModel(service: LiveProductService())
    var body: some View { /* ... */ }
}`,
          options: [
            "`@StateObject`",
            "`@ObservedObject`",
            "`@State`",
            "`@Bindable`",
          ],
          answer: 2,
          explanation: "With `@Observable`, the owner keeps the object in `@State`: SwiftUI preserves the instance across renders. `@StateObject` and `@ObservedObject` are for `ObservableObject` (iOS 16 and earlier). `@Bindable` creates bindings (`$viewModel.query`) to an object you received; it doesn't own it.",
        },
        {
          kind: "write",
          prompt: "Write `ProductDetailViewModel`: `@MainActor` and `@Observable`, takes `productID: Int` and `service: any ProductDetailService` via `init(productID:service:)`, exposes a `state` (nested `State` enum with `loading`, `loaded(Product)` and `failed(String)`) and a `func load() async` that goes through `.loading` and ends in `.loaded` or `.failed`.",
          starter: swift`protocol ProductDetailService: Sendable {
    func fetchProduct(id: Int) async throws -> Product
}

// Write ProductDetailViewModel here`,
          checks: [
            { pattern: "@MainActor", label: "Isolated with `@MainActor`" },
            { pattern: "@Observable", label: "Marked `@Observable`" },
            { pattern: "enum\\s+\\w*State", label: "State modeled as an enum" },
            { pattern: "init\\(productID:\\s*Int,\\s*service:", label: "Dependencies via `init(productID:service:)`" },
            { pattern: "func\\s+load\\(\\)\\s+async", label: "`func load() async`" },
            { pattern: "state\\s*=\\s*\\.loading", label: "Goes through `.loading`" },
            { pattern: "state\\s*=\\s*\\.failed\\(", label: "Handles the error with `.failed`" },
          ],
          warnings: [
            { pattern: "import\\s+SwiftUI", label: "The view model doesn't need `SwiftUI`" },
            { pattern: "URLSession", label: "Networking belongs in the service, not the view model" },
            { pattern: "ObservableObject", label: "For iOS 17+ use `@Observable`" },
          ],
          solution: swift`protocol ProductDetailService: Sendable {
    func fetchProduct(id: Int) async throws -> Product
}

@MainActor
@Observable
final class ProductDetailViewModel {
    enum State: Equatable {
        case loading
        case loaded(Product)
        case failed(String)
    }

    private(set) var state: State = .loading
    private let productID: Int
    private let service: any ProductDetailService

    init(productID: Int, service: any ProductDetailService) {
        self.productID = productID
        self.service = service
    }

    func load() async {
        state = .loading
        do {
            state = .loaded(try await service.fetchProduct(id: productID))
        } catch {
            state = .failed("Couldn't load the product")
        }
    }
}`,
          hint: "Copy the shape of `ProductListViewModel`: `private(set)` state, `private let` service, `do/catch` in `load()`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "mvvm-uikit",
      title: "MVVM in UIKit: binding",
      goal: "Wire a view model to a view controller with closures or Combine, with clear inputs/outputs and no retain cycles.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "UIKit doesn't observe for you",
          body: [
            "SwiftUI redraws on its own when state changes. UIKit doesn't: someone has to tell the VC. That wire is the **binding**. The usual options: a closure the view model calls on every change, a Combine publisher (`@Published`), or Observation with `withObservationTracking`.",
            "The view model is almost the same as in SwiftUI. Only how the VC finds out changes. The closure version is the simplest and depends on no framework: `didSet` calls `onStateChange`.",
          ],
          code: swift`@MainActor
final class ProductListViewModel {
    var onStateChange: ((LoadState) -> Void)?

    private(set) var state: LoadState = .idle {
        didSet { onStateChange?(state) }
    }
    private let service: any ProductService

    init(service: any ProductService) {
        self.service = service
    }

    func load() async {
        state = .loading
        do {
            state = .loaded(try await service.fetchProducts())
        } catch {
            state = .failed("Couldn't load products")
        }
    }
}`,
        },
        {
          kind: "predict",
          code: swift`final class CounterViewModel {
    var onChange: ((Int) -> Void)?
    private(set) var count = 0 {
        didSet { onChange?(count) }
    }
    func increment() { count += 1 }
}

let viewModel = CounterViewModel()
viewModel.increment()
viewModel.onChange = { print("count:", $0) }
viewModel.increment()
viewModel.increment()`,
          options: [
            "`count: 1` / `count: 2` / `count: 3`",
            "`count: 2` / `count: 3`",
            "`count: 3`",
            "Nothing: `didSet` doesn't run on `private(set)` properties",
          ],
          answer: 1,
          explanation: "The first `increment()` runs `didSet`, but `onChange` is still `nil`: nothing prints. Then the closure is attached and the next two increments print `count: 2` and `count: 3`. Watch for this in UIKit: a closure binding doesn't send you the current value when you connect it; if state already changed, call `render(viewModel.state)` yourself when binding.",
        },
        {
          kind: "explain",
          title: "Combine: `@Published` + `sink`",
          body: [
            "With Combine, the view model publishes `@Published var state` and the VC subscribes to `$state`. Unlike the closure, the publisher **emits the current value** as soon as you subscribe, so the initial render comes for free.",
            "A detail that shows up in interviews: `@Published` emits in `willSet`. Inside the `sink`, use the value you receive as a parameter; if you read the property, it still holds the old value. `receive(on: DispatchQueue.main)` makes sure rendering runs on main, and `store(in:)` keeps the subscription alive as long as the VC lives.",
          ],
          code: swift`import Combine

@MainActor
final class ProductListViewModel: ObservableObject {
    @Published private(set) var state: LoadState = .idle
    // ...
}

final class ProductListViewController: UITableViewController {
    private let viewModel: ProductListViewModel
    private var cancellables = Set<AnyCancellable>()

    override func viewDidLoad() {
        super.viewDidLoad()
        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.render(state) }
            .store(in: &cancellables)
        Task { await viewModel.load() }
    }
}`,
        },
        {
          kind: "predict",
          code: swift`import Combine

final class ViewModel {
    @Published var title = "A"
}

let viewModel = ViewModel()
var bag = Set<AnyCancellable>()
viewModel.$title
    .sink { print("sink:", $0, "| property:", viewModel.title) }
    .store(in: &bag)
viewModel.title = "B"`,
          options: [
            "`sink: B | property: B`",
            "`sink: A | property: A` / `sink: B | property: B`",
            "`sink: B | property: A`",
            "`sink: A | property: A` / `sink: B | property: A`",
          ],
          answer: 3,
          explanation: "On subscribe, `$title` emits the current value: `sink: A | property: A`. When you assign `\"B\"`, `@Published` emits in `willSet`, before storing the new value: the parameter is `B` but the property is still `A`. That's why you always use the parameter inside `sink`.",
        },
        {
          kind: "explain",
          title: "Inputs, outputs and retain cycles",
          body: [
            "Organize the view model into **inputs** (methods the VC calls: `viewDidLoad()`, `didSelectRow(at:)`) and **outputs** (what the VC or coordinator listens to: `onStateChange`, `onSelectProduct`). The VC makes no decisions: it forwards events and renders.",
            "The classic cycle: the VC retains the view model, the view model retains the closure, and the closure retains the VC if you use `self` without `[weak self]`. Same with Combine: VC → `cancellables` → `sink` closure → VC. None of them ever hits `deinit`.",
          ],
          code: swift`@MainActor
final class ProductListViewModel {
    // Outputs
    var onStateChange: ((LoadState) -> Void)?
    var onSelectProduct: ((Product) -> Void)?

    // Inputs
    func viewDidLoad() { Task { await load() } }

    func didSelectRow(at index: Int) {
        guard case .loaded(let products) = state, products.indices.contains(index) else { return }
        onSelectProduct?(products[index])
    }
    // ...
}

// In the VC:
viewModel.onStateChange = { [weak self] state in
    self?.render(state)
}`,
        },
        {
          kind: "predict",
          prompt: "You pop this screen and never see `deinit` in the console. Why?",
          code: swift`final class ProductListViewController: UIViewController {
    private let viewModel: ProductListViewModel
    // init...

    override func viewDidLoad() {
        super.viewDidLoad()
        viewModel.onStateChange = { state in
            self.render(state)
        }
    }

    deinit { print("ProductListViewController deinit") }
}`,
          options: [
            "Cycle: the VC retains the view model, the view model retains the closure, and the closure retains the VC",
            "`deinit` is never called on `UIViewController` subclasses",
            "`UINavigationController` keeps VCs around after a pop in case you come back",
            "It's missing a `super.deinit` call at the end",
          ],
          answer: 0,
          explanation: "`self.render` inside the closure captures `self` strongly. The VC owns the view model, the view model owns the closure, and the closure owns the VC: a loop ARC won't break. With `[weak self]` and `self?.render(state)` the closure stops retaining the VC.",
        },
        {
          kind: "fill",
          prompt: "Complete the capture list so the subscription doesn't retain the VC.",
          code: swift`viewModel.$state
    .receive(on: DispatchQueue.main)
    .sink { [____ self] state in self?.render(state) }
    .store(in: &cancellables)`,
          accept: ["^weak$"],
          explanation: "`[weak self]` makes `self` optional inside the closure and doesn't retain it. `unowned` also breaks the cycle, but crashes if an emission arrives after the VC is gone (possible with the async hop of `receive(on:)`).",
          placeholder: "keyword",
        },
        {
          kind: "write",
          prompt: "Complete `bind()`: subscribe to `viewModel.$state`, receive values on the main thread, call `render(_:)` without retaining the VC, and store the subscription in `cancellables`.",
          starter: swift`final class ProductListViewController: UITableViewController {
    private let viewModel: ProductListViewModel
    private var cancellables = Set<AnyCancellable>()

    private func bind() {
        // your code
    }

    private func render(_ state: LoadState) { /* ... */ }
}`,
          checks: [
            { pattern: "viewModel\\.\\$state", label: "Subscribes to `viewModel.$state`" },
            { pattern: "\\.receive\\(on:\\s*(DispatchQueue\\.main|RunLoop\\.main)\\)", label: "Receives on main with `receive(on:)`" },
            { pattern: "\\.sink\\s*\\{\\s*\\[weak self\\]", label: "The `sink` captures `[weak self]`" },
            { pattern: "self\\?\\.render\\(", label: "Calls `self?.render(...)`" },
            { pattern: "\\.store\\(in:\\s*&cancellables\\)", label: "Stores the subscription with `store(in: &cancellables)`" },
          ],
          warnings: [
            { pattern: "\\.sink\\s*\\{(?!\\s*\\[weak self\\])", label: "The `sink` closure doesn't use `[weak self]`: retain cycle" },
            { pattern: "\\[unowned self\\]", label: "`unowned` can crash if a value arrives after the VC is freed" },
          ],
          solution: swift`final class ProductListViewController: UITableViewController {
    private let viewModel: ProductListViewModel
    private var cancellables = Set<AnyCancellable>()

    private func bind() {
        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.render(state)
            }
            .store(in: &cancellables)
    }

    private func render(_ state: LoadState) { /* ... */ }
}`,
          hint: "Chain: `$state` → `receive(on:)` → `sink` → `store(in:)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "testing-viewmodel",
      title: "Testing the view model",
      goal: "Test state transitions with fake services and async tests, with no network and no magic waits.",
      minutes: 15,
      steps: [
        {
          kind: "explain",
          title: "Fakes you control",
          body: [
            "Since the view model takes `any ProductService`, the test passes a **fake**: an implementation that returns whatever you say, instantly. No network, no simulator, deterministic.",
            "Vocabulary interviewers ask for: a **fake/stub** returns canned data; a **spy** also records how it was called (how many times, with which arguments) so the test can verify it.",
          ],
          code: swift`struct FakeProductService: ProductService {
    var result: Result<[Product], any Error>

    func fetchProducts() async throws -> [Product] {
        try result.get()
    }
}

let mate = Product(id: 1, name: "Mate", priceCents: 1999)
let success = FakeProductService(result: .success([mate]))
let offline = FakeProductService(result: .failure(URLError(.notConnectedToInternet)))`,
        },
        {
          kind: "predict",
          prompt: "The test uses a fake that throws `TestError.boom`. What is `viewModel.state` after `await viewModel.load()`?",
          code: swift`enum TestError: Error { case boom }

func load() async {
    state = .loading
    do {
        let products = try await service.fetchProducts()
        state = .loaded(products)
    } catch is URLError {
        state = .failed("Offline")
    } catch {
        print("unexpected error")
    }
}`,
          options: [
            "`.idle`",
            "`.failed(\"Offline\")`",
            "`.loading`",
            "The test crashes because the error isn't handled",
          ],
          answer: 2,
          explanation: "`TestError.boom` isn't a `URLError`, so it falls into the generic `catch`, which only prints. Nobody changes the state and it stays `.loading`: in the app, an endless spinner. A test with a non-network error finds this bug in seconds; that's why it pays to try more than one kind of error.",
        },
        {
          kind: "explain",
          title: "Assert transitions, not just the end",
          body: [
            "With the UIKit view model (`onStateChange` closure) you can record every state it went through and compare them in one go. That way you check the spinner shows up before the result, not just the final result.",
            "The test struct is `@MainActor` because the view model is. With Swift Testing (`import Testing`) functions are `@Test` and assertions are `#expect`. The test is `async` and does `await viewModel.load()`: when it returns, loading is done.",
          ],
          code: swift`import Testing
@testable import Shop

@MainActor
struct ProductListViewModelTests {
    let mate = Product(id: 1, name: "Mate", priceCents: 1999)

    @Test func loadSuccessGoesThroughLoading() async {
        let viewModel = ProductListViewModel(service: FakeProductService(result: .success([mate])))
        var states: [LoadState] = []
        viewModel.onStateChange = { states.append($0) }

        await viewModel.load()

        #expect(states == [.loading, .loaded([mate])])
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the Swift Testing macro that checks a condition and keeps the test running if it fails.",
          code: swift`await viewModel.load()
#____(viewModel.state == .failed("Couldn't load products"))`,
          accept: ["^expect$"],
          explanation: "`#expect(...)` records the failure and lets the test continue. `#require(...)` instead stops the test if it fails (and the function must be `throws`). The XCTest equivalent is `XCTAssertEqual`.",
          placeholder: "macro",
        },
        {
          kind: "explain",
          title: "Async without magic waits",
          body: [
            "No `Task.sleep`, no waiting 'a little bit': if the input is `async`, you `await` it and you're done. If the view model fires a `Task { }` internally (like `viewDidLoad()`), the test has no way to wait for it; that's why you expose the `async` version (`load()`) and let the synchronous input just wrap it.",
            "XCTest works the same way: the test method can be `async` and the class `@MainActor`.",
          ],
          code: swift`import XCTest
@testable import Shop

@MainActor
final class ProductListViewModelXCTests: XCTestCase {
    func testLoadFailureShowsMessage() async {
        let viewModel = ProductListViewModel(
            service: FakeProductService(result: .failure(URLError(.timedOut)))
        )

        await viewModel.load()

        XCTAssertEqual(viewModel.state, .failed("Couldn't load products"))
    }
}`,
        },
        {
          kind: "predict",
          prompt: "What happens with this test?",
          code: swift`@Test @MainActor func viewDidLoadLoadsProducts() {
    let viewModel = ProductListViewModel(service: FakeProductService(result: .success([mate])))
    viewModel.viewDidLoad()   // inside: Task { await load() }
    #expect(viewModel.state == .loaded([mate]))
}`,
          options: [
            "It passes: the fake responds instantly",
            "It doesn't compile: `viewDidLoad` is a UIKit method",
            "It hangs waiting for the network",
            "It fails: `#expect` runs before the inner `Task` starts, so `state` is still `.idle`",
          ],
          answer: 3,
          explanation: "The test is synchronous and runs on the main actor. `Task { }` enqueues work on that same actor, which only runs once the test finishes or suspends. So `#expect` sees `.idle`. Fix: test `await viewModel.load()` directly, or keep the `Task` and `await task.value`.",
        },
        {
          kind: "write",
          prompt: "Write a Swift Testing test that checks that, when the service fails, `state` ends up as `.failed(\"Couldn't load products\")`. Use `FakeProductService` with `.failure(...)`.",
          starter: swift`import Testing
@testable import Shop

// your test here`,
          checks: [
            { pattern: "@Test", label: "Marks the function with `@Test`" },
            { pattern: "@MainActor", label: "Runs on `@MainActor` like the view model" },
            { pattern: "func\\s+\\w+\\(\\)\\s+async", label: "The test function is `async`" },
            { pattern: "FakeProductService\\(", label: "Uses `FakeProductService`" },
            { pattern: "\\.failure\\(", label: "Configures the fake with `.failure(...)`" },
            { pattern: "await\\s+\\w+\\.load\\(\\)", label: "Awaits `load()`" },
            { pattern: "#expect\\(\\s*\\w+\\.state\\s*==\\s*\\.failed", label: "Checks `state == .failed(...)`" },
          ],
          warnings: [
            { pattern: "Task\\.sleep|\\bsleep\\(", label: "Don't wait with `sleep`: `await` `load()` instead" },
            { pattern: "URLSession", label: "The test must not touch the network" },
          ],
          solution: swift`import Testing
@testable import Shop

@MainActor
struct ProductListViewModelTests {
    @Test func loadFailureShowsMessage() async {
        let service = FakeProductService(result: .failure(URLError(.notConnectedToInternet)))
        let viewModel = ProductListViewModel(service: service)

        await viewModel.load()

        #expect(viewModel.state == .failed("Couldn't load products"))
    }
}`,
          hint: "Arrange (fake + view model), act (`await viewModel.load()`), assert (`#expect`).",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "coordinators",
      title: "Coordinators and navigation",
      goal: "Pull navigation out of screens with coordinators, manage child coordinators without leaks and route deep links, in UIKit and SwiftUI.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Taking navigation out of the VC",
          body: [
            "A **coordinator** is an object that owns a flow's navigation: it creates view models and VCs, injects dependencies and decides which screen comes next. Screens only report what happened (`onSelectProduct`), not where to go.",
            "The protocol is minimal: a `start()` that shows the first screen and a list of children. It's `AnyObject` because coordinators have identity and are kept by reference, and `@MainActor` because they touch UIKit. This combination is called **MVVM-C**.",
          ],
          code: swift`@MainActor
protocol Coordinator: AnyObject {
    var childCoordinators: [any Coordinator] { get set }
    func start()
}

@MainActor
final class ProductsCoordinator: Coordinator {
    var childCoordinators: [any Coordinator] = []
    private let navigationController: UINavigationController
    private let service: any ProductService

    init(navigationController: UINavigationController, service: any ProductService) {
        self.navigationController = navigationController
        self.service = service
    }

    func start() {
        let viewModel = ProductListViewModel(service: service)
        viewModel.onSelectProduct = { [weak self] product in
            self?.showDetail(product)
        }
        let viewController = ProductListViewController(viewModel: viewModel)
        navigationController.pushViewController(viewController, animated: false)
    }

    private func showDetail(_ product: Product) {
        let viewController = ProductDetailViewController(product: product)
        navigationController.pushViewController(viewController, animated: true)
    }
}`,
        },
        {
          kind: "predict",
          code: swift`final class LoginCoordinator {
    var onFinish: (() -> Void)?
    func start() { print("login: start") }
    func finish() { print("login: finish"); onFinish?() }
    deinit { print("login: deinit") }
}

final class AppCoordinator {
    var children: [AnyObject] = []

    func start() {
        let login = LoginCoordinator()
        login.onFinish = { [weak self, unowned login] in
            print("app: show home")
            self?.children.removeAll { $0 === login }
        }
        children.append(login)
        login.start()
    }
}

let app = AppCoordinator()
app.start()
(app.children.first as? LoginCoordinator)?.finish()`,
          options: [
            "`login: start` / `login: finish` / `app: show home`",
            "`login: start` / `login: deinit` / `login: finish` / `app: show home`",
            "`login: start` / `login: finish` / `app: show home` / `login: deinit`",
            "`login: start` / `app: show home` / `login: finish` / `login: deinit`",
          ],
          answer: 2,
          explanation: "`start()` prints `login: start`; the login stays alive because `children` retains it. `finish()` prints `login: finish` and calls `onFinish`, which prints `app: show home` and removes the login from `children`. Nothing retains it anymore (the closure captures it `unowned`), so it's freed: `login: deinit`. Without the `removeAll`, `deinit` would never show up: one leak per finished flow.",
        },
        {
          kind: "explain",
          title: "Child coordinators and their lifecycle",
          body: [
            "Flows like login → home → detail are built with an `AppCoordinator` that creates children. The parent **retains** the child in `childCoordinators` (otherwise the child is freed as soon as `start()` returns) and the child reports when it's done.",
            "When the child finishes, the parent removes it from the list. Forget that and every login (or checkout) leaves a live coordinator behind, along with everything it retains. Capture the child `weak` in its own `onFinish`: the child owns that closure.",
          ],
          code: swift`@MainActor
final class AppCoordinator: Coordinator {
    var childCoordinators: [any Coordinator] = []
    private let navigationController: UINavigationController
    private let session: SessionStore

    init(navigationController: UINavigationController, session: SessionStore) {
        self.navigationController = navigationController
        self.session = session
    }

    func start() {
        if session.isLoggedIn { showProducts() } else { showLogin() }
    }

    private func showLogin() {
        let login = LoginCoordinator(navigationController: navigationController)
        login.onFinish = { [weak self, weak login] in
            guard let self, let login else { return }
            self.remove(login)
            self.showProducts()
        }
        childCoordinators.append(login)
        login.start()
    }

    private func remove(_ child: any Coordinator) {
        childCoordinators.removeAll { $0 === child }
    }

    private func showProducts() { /* ... */ }
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the operator to remove the child by identity (coordinators aren't `Equatable`).",
          code: swift`private func remove(_ child: any Coordinator) {
    childCoordinators.removeAll { $0 ____ child }
}`,
          accept: ["^===$"],
          explanation: "`===` checks whether two references point to the same instance. It works with any class without the type being `Equatable`, and it's exactly what you want: remove *that* coordinator.",
          placeholder: "operator",
        },
        {
          kind: "write",
          prompt: "In `AppCoordinator`, write `showCheckout(cart:)`: create a `CheckoutCoordinator(navigationController:cart:)` in a constant named `checkout`, hook up its `onFinish` without retaining either the parent or the child, and inside it remove the child from `childCoordinators` and call `showOrderConfirmation()`. Then add it to the children and start it.",
          starter: swift`@MainActor
final class AppCoordinator: Coordinator {
    var childCoordinators: [any Coordinator] = []
    private let navigationController: UINavigationController

    init(navigationController: UINavigationController) {
        self.navigationController = navigationController
    }

    func start() { showProducts() }

    func showCheckout(cart: Cart) {
        // your code
    }

    private func showProducts() { /* ... */ }
    private func showOrderConfirmation() { /* ... */ }
}`,
          checks: [
            { pattern: "CheckoutCoordinator\\(navigationController:", label: "Creates the `CheckoutCoordinator`" },
            { pattern: "\\.onFinish\\s*=\\s*\\{\\s*\\[weak self", label: "`onFinish` captures `[weak self, ...]`" },
            { pattern: "(weak|unowned) checkout", label: "Doesn't retain the child inside its own closure" },
            { pattern: "childCoordinators\\.removeAll|remove\\(checkout\\)", label: "Removes the child from `childCoordinators` when done" },
            { pattern: "childCoordinators\\.append\\(checkout\\)", label: "Retains the child in `childCoordinators`" },
            { pattern: "checkout\\.start\\(\\)", label: "Calls `checkout.start()`" },
          ],
          warnings: [
            { pattern: "\\.onFinish\\s*=\\s*\\{(?!\\s*\\[weak self)", label: "`onFinish` without `[weak self]`: the child retains the parent" },
          ],
          solution: swift`@MainActor
final class AppCoordinator: Coordinator {
    var childCoordinators: [any Coordinator] = []
    private let navigationController: UINavigationController

    init(navigationController: UINavigationController) {
        self.navigationController = navigationController
    }

    func start() { showProducts() }

    func showCheckout(cart: Cart) {
        let checkout = CheckoutCoordinator(navigationController: navigationController, cart: cart)
        checkout.onFinish = { [weak self, weak checkout] in
            guard let self, let checkout else { return }
            self.childCoordinators.removeAll { $0 === checkout }
            self.showOrderConfirmation()
        }
        childCoordinators.append(checkout)
        checkout.start()
    }

    private func showProducts() { /* ... */ }
    private func showOrderConfirmation() { /* ... */ }
}`,
          hint: "Same shape as `showLogin()`: create, wire `onFinish`, `append`, `start()`.",
        },
        {
          kind: "explain",
          title: "Deep links: from URL to route",
          body: [
            "A deep link (`shop://products/42`) reaches the app and someone has to decide which screens to show. That someone is the root coordinator (or the router in SwiftUI), because it's the only one that knows every flow.",
            "Split the problem in two: a pure function that turns a `URL` into an enum (`DeepLink`), easy to test, and the coordinator that, given a `DeepLink`, builds the navigation. Unknown URLs return `nil` and are ignored.",
          ],
          code: swift`import Foundation

enum DeepLink: Equatable {
    case productList
    case productDetail(id: Int)
    case favorites
}

func deepLink(from url: URL) -> DeepLink? {
    guard url.scheme == "shop" else { return nil }
    switch url.host {
    case "products":
        if let idText = url.pathComponents.dropFirst().first, let id = Int(idText) {
            return .productDetail(id: id)
        }
        return .productList
    case "favorites":
        return .favorites
    default:
        return nil
    }
}

for link in ["shop://products/42", "shop://products", "shop://cart"] {
    let parsed = deepLink(from: URL(string: link)!)
    print(link, "→", parsed.map { "\($0)" } ?? "nil")
}`,
          output: "shop://products/42 → productDetail(id: 42)\nshop://products → productList\nshop://cart → nil",
        },
        {
          kind: "predict",
          prompt: "With the same `deepLink(from:)` as above, what does this print?",
          code: swift`for link in ["shop://products/abc", "shop://favorites", "https://products/42"] {
    let parsed = deepLink(from: URL(string: link)!)
    print(link, "→", parsed.map { "\($0)" } ?? "nil")
}`,
          options: [
            "`shop://products/abc → productList` / `shop://favorites → favorites` / `https://products/42 → nil`",
            "`shop://products/abc → nil` / `shop://favorites → favorites` / `https://products/42 → nil`",
            "`shop://products/abc → productList` / `shop://favorites → favorites` / `https://products/42 → productDetail(id: 42)`",
            "It crashes on `Int(\"abc\")`",
          ],
          answer: 0,
          explanation: "`Int(\"abc\")` returns `nil` (no crash), so the `if` is skipped and it falls through to `return .productList`. `shop://favorites` has host `favorites`. `https://products/42` fails the scheme `guard`: `nil`. What to do with an invalid id (list? ignore?) is a product decision; what matters is that it lives in a testable function.",
        },
        {
          kind: "explain",
          title: "SwiftUI: a router with `NavigationPath`",
          body: [
            "In SwiftUI the coordinator role is played by a **router**: an `@Observable` object that owns the `NavigationStack` `path`. Views call `router.show(...)` instead of knowing the next screen, and `.navigationDestination(for:)` maps each route to a view.",
            "For a deep link, the router resets the path and pushes the routes it needs. If you want to test the stack, use `[Route]` instead of `NavigationPath`: `NavigationPath` erases types and won't let you read its elements.",
          ],
          code: swift`enum Route: Hashable {
    case productDetail(id: Int)
    case favorites
}

@MainActor
@Observable
final class Router {
    var path = NavigationPath()

    func show(_ route: Route) { path.append(route) }

    func handle(_ url: URL) {
        guard let link = deepLink(from: url) else { return }
        path = NavigationPath()
        switch link {
        case .productList: break
        case .productDetail(let id): path.append(Route.productDetail(id: id))
        case .favorites: path.append(Route.favorites)
        }
    }
}

struct RootView: View {
    @State private var router = Router()

    var body: some View {
        NavigationStack(path: $router.path) {
            ProductListView(onSelect: { router.show(.productDetail(id: $0.id)) })
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .productDetail(let id): ProductDetailView(productID: id)
                    case .favorites: FavoritesView()
                    }
                }
        }
        .onOpenURL { router.handle($0) }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the argument so the `NavigationStack` knows which view to show for each `Route` in the path.",
          code: swift`NavigationStack(path: $router.path) {
    HomeView()
        .navigationDestination(for: ____) { route in
            destination(for: route)
        }
}`,
          accept: ["^Route\\.self$"],
          explanation: "`navigationDestination(for:)` takes the metatype of the value you'll push: `Route.self`. Whenever the path contains a `Route`, SwiftUI calls the closure with that value. The type must be `Hashable`.",
          placeholder: "Type.self",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: from Massive VC to MVVM-C",
      goal: "Refactor a massive view controller into MVVM-C with a testable view model, a coordinator and a test.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "You pick up the ticket 'Favorites is slow and sometimes stays blank'. You open `FavoritesViewController` and find this: it reads `UserDefaults`, fetches each product from the network, builds the title, navigates to the detail and deletes favorites. Zero tests.",
            "The PR's goal: a `FavoritesStore` (protocol) for the ids, the `ProductDetailService` you already have (`fetchProduct(id:)`), a `@MainActor` `FavoritesViewModel` with enum state and inputs/outputs, a `FavoritesCoordinator` that owns navigation, and a test covering deletion.",
            "The state gets an extra case, `empty`, to show 'No favorites' without mixing it up with an empty list. Let's go step by step.",
          ],
          code: swift`final class FavoritesViewController: UITableViewController {
    private var products: [Product] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        Task {
            let ids = UserDefaults.standard.array(forKey: "favs") as? [Int] ?? []
            var loaded: [Product] = []
            for id in ids {
                let url = URL(string: "https://api.shop.com/products/\(id)")!
                let (data, _) = try await URLSession.shared.data(from: url)
                loaded.append(try JSONDecoder().decode(Product.self, from: data))
            }
            products = loaded
            title = loaded.isEmpty ? "No favorites" : "Favorites (\(loaded.count))"
            tableView.reloadData()
        }
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let detail = ProductDetailViewController(product: products[indexPath.row])
        navigationController?.pushViewController(detail, animated: true)
    }

    func removeFavorite(at index: Int) {
        let id = products[index].id
        var ids = UserDefaults.standard.array(forKey: "favs") as? [Int] ?? []
        ids.removeAll { $0 == id }
        UserDefaults.standard.set(ids, forKey: "favs")
        products.remove(at: index)
        tableView.reloadData()
    }
}`,
        },
        {
          kind: "write",
          prompt: "Step 1: declare `protocol FavoritesStore` (with `favoriteIDs() -> [Int]` and `remove(id: Int)`) and write `FavoritesViewModel`: `@MainActor`, `init(store:service:)` taking `any FavoritesStore` and `any ProductDetailService`, a `State` enum with `loading`, `empty`, `loaded([Product])` and `failed(String)`, an `onStateChange` called on every change, and `func load() async`.",
          starter: swift`protocol ProductDetailService: Sendable {
    func fetchProduct(id: Int) async throws -> Product
}

// FavoritesStore and FavoritesViewModel here`,
          checks: [
            { pattern: "protocol\\s+FavoritesStore", label: "Declares `FavoritesStore`" },
            { pattern: "func\\s+remove\\(id:\\s*Int\\)", label: "The store has `remove(id:)`" },
            { pattern: "@MainActor", label: "The view model is `@MainActor`" },
            { pattern: "final\\s+class\\s+FavoritesViewModel", label: "Declares `FavoritesViewModel`" },
            { pattern: "init\\(store:\\s*(any\\s+)?FavoritesStore,\\s*service:\\s*(any\\s+)?ProductDetailService\\)", label: "Dependencies via `init(store:service:)`" },
            { pattern: "case\\s+empty", label: "The state has an `empty` case" },
            { pattern: "onStateChange\\?\\(", label: "Notifies changes with `onStateChange`" },
            { pattern: "func\\s+load\\(\\)\\s+async", label: "`func load() async`" },
          ],
          warnings: [
            { pattern: "UserDefaults", label: "The view model doesn't touch `UserDefaults`: that's the store's job" },
            { pattern: "URLSession", label: "Networking belongs in the service" },
            { pattern: "import\\s+UIKit", label: "The view model doesn't need UIKit" },
          ],
          solution: swift`protocol ProductDetailService: Sendable {
    func fetchProduct(id: Int) async throws -> Product
}

protocol FavoritesStore {
    func favoriteIDs() -> [Int]
    func remove(id: Int)
}

@MainActor
final class FavoritesViewModel {
    enum State: Equatable {
        case loading
        case empty
        case loaded([Product])
        case failed(String)
    }

    var onStateChange: ((State) -> Void)?

    private(set) var state: State = .loading {
        didSet { onStateChange?(state) }
    }
    private let store: any FavoritesStore
    private let service: any ProductDetailService

    init(store: any FavoritesStore, service: any ProductDetailService) {
        self.store = store
        self.service = service
    }

    func load() async {
        state = .loading
        do {
            var products: [Product] = []
            for id in store.favoriteIDs() {
                products.append(try await service.fetchProduct(id: id))
            }
            state = products.isEmpty ? .empty : .loaded(products)
        } catch {
            state = .failed("Couldn't load your favorites")
        }
    }
}`,
          hint: "It's the UIKit view model from lesson 3, plus a store and an `empty` case.",
        },
        {
          kind: "write",
          prompt: "Step 2: add the inputs and the navigation output. `var onSelectProduct: ((Product) -> Void)?`, `func didSelectRow(at index: Int)` that emits it, and `func removeFavorite(at index: Int)` that deletes from the store and updates the state (to `.empty` if nothing is left). Validate the index.",
          starter: swift`@MainActor
final class FavoritesViewModel {
    // State, onStateChange, state, store, service, init and load() as in step 1

    // your inputs and outputs here
}`,
          checks: [
            { pattern: "var\\s+onSelectProduct\\s*:\\s*\\(\\(Product\\)\\s*->\\s*Void\\)\\?", label: "Output `onSelectProduct: ((Product) -> Void)?`" },
            { pattern: "func\\s+didSelectRow\\(at\\s+index:\\s*Int\\)", label: "Input `didSelectRow(at:)`" },
            { pattern: "onSelectProduct\\?\\(", label: "Emits `onSelectProduct?(...)`" },
            { pattern: "func\\s+removeFavorite\\(at\\s+index:\\s*Int\\)", label: "Input `removeFavorite(at:)`" },
            { pattern: "store\\.remove\\(id:", label: "Deletes through the store" },
            { pattern: "indices\\.contains\\(index\\)", label: "Validates the index with `indices.contains`" },
          ],
          warnings: [
            { pattern: "navigationController|pushViewController", label: "The view model doesn't navigate: it only emits the event" },
            { pattern: "UserDefaults", label: "Deletion goes through the store, not `UserDefaults`" },
          ],
          solution: swift`@MainActor
final class FavoritesViewModel {
    // State, onStateChange, state, store, service, init and load() as in step 1

    var onSelectProduct: ((Product) -> Void)?

    func didSelectRow(at index: Int) {
        guard case .loaded(let products) = state, products.indices.contains(index) else { return }
        onSelectProduct?(products[index])
    }

    func removeFavorite(at index: Int) {
        guard case .loaded(var products) = state, products.indices.contains(index) else { return }
        store.remove(id: products[index].id)
        products.remove(at: index)
        state = products.isEmpty ? .empty : .loaded(products)
    }
}`,
          hint: "`guard case .loaded(var products) = state` gives you a mutable copy of the list.",
        },
        {
          kind: "write",
          prompt: "Step 3: write `FavoritesCoordinator.start()`. Create the view model with `store` and `service`, wire `onSelectProduct` without retaining the coordinator (calling `showDetail`), create `FavoritesViewController(viewModel:)` and push it.",
          starter: swift`@MainActor
final class FavoritesCoordinator: Coordinator {
    var childCoordinators: [any Coordinator] = []
    private let navigationController: UINavigationController
    private let store: any FavoritesStore
    private let service: any ProductDetailService

    init(navigationController: UINavigationController, store: any FavoritesStore, service: any ProductDetailService) {
        self.navigationController = navigationController
        self.store = store
        self.service = service
    }

    func start() {
        // your code
    }

    private func showDetail(_ product: Product) {
        navigationController.pushViewController(ProductDetailViewController(product: product), animated: true)
    }
}`,
          checks: [
            { pattern: "FavoritesViewModel\\(store:\\s*store,\\s*service:\\s*service\\)", label: "Creates the view model injecting `store` and `service`" },
            { pattern: "\\.onSelectProduct\\s*=\\s*\\{\\s*\\[weak self\\]", label: "`onSelectProduct` captures `[weak self]`" },
            { pattern: "self\\?\\.showDetail\\(", label: "Navigates with `self?.showDetail(...)`" },
            { pattern: "FavoritesViewController\\(viewModel:", label: "Creates `FavoritesViewController(viewModel:)`" },
            { pattern: "pushViewController\\(\\w+,\\s*animated:", label: "Pushes the screen" },
          ],
          warnings: [
            { pattern: "\\.onSelectProduct\\s*=\\s*\\{(?!\\s*\\[weak self\\])", label: "Without `[weak self]`, the view model retains the coordinator" },
          ],
          solution: swift`@MainActor
final class FavoritesCoordinator: Coordinator {
    var childCoordinators: [any Coordinator] = []
    private let navigationController: UINavigationController
    private let store: any FavoritesStore
    private let service: any ProductDetailService

    init(navigationController: UINavigationController, store: any FavoritesStore, service: any ProductDetailService) {
        self.navigationController = navigationController
        self.store = store
        self.service = service
    }

    func start() {
        let viewModel = FavoritesViewModel(store: store, service: service)
        viewModel.onSelectProduct = { [weak self] product in
            self?.showDetail(product)
        }
        let viewController = FavoritesViewController(viewModel: viewModel)
        navigationController.pushViewController(viewController, animated: true)
    }

    private func showDetail(_ product: Product) {
        navigationController.pushViewController(ProductDetailViewController(product: product), animated: true)
    }
}`,
          hint: "It's the same as `ProductsCoordinator.start()` from lesson 5.",
        },
        {
          kind: "write",
          prompt: "Step 4: the test. With a `SpyFavoritesStore` holding `[1]` that records deletions in `removedIDs`, and a `FakeProductDetailService(product: mate)`, check that after `load()` and `removeFavorite(at: 0)` the state is `.empty` and the store received id `1`.",
          starter: swift`import Testing
@testable import Shop

final class SpyFavoritesStore: FavoritesStore {
    private var ids: [Int]
    private(set) var removedIDs: [Int] = []
    init(ids: [Int]) { self.ids = ids }
    func favoriteIDs() -> [Int] { ids }
    func remove(id: Int) { removedIDs.append(id); ids.removeAll { $0 == id } }
}

// your test here`,
          checks: [
            { pattern: "@Test", label: "`@Test` function" },
            { pattern: "SpyFavoritesStore\\(ids:", label: "Uses the store spy" },
            { pattern: "await\\s+\\w+\\.load\\(\\)", label: "Awaits `load()`" },
            { pattern: "\\.removeFavorite\\(at:\\s*0\\)", label: "Calls `removeFavorite(at: 0)`" },
            { pattern: "#expect\\(\\s*\\w+\\.state\\s*==\\s*\\.empty\\s*\\)", label: "Checks `state == .empty`" },
            { pattern: "#expect\\(\\s*\\w+\\.removedIDs\\s*==", label: "Checks what the store received" },
          ],
          warnings: [
            { pattern: "UserDefaults\\.standard", label: "The test uses the spy, not real `UserDefaults`" },
            { pattern: "Task\\.sleep|\\bsleep\\(", label: "No need to wait: `await viewModel.load()`" },
          ],
          solution: swift`import Testing
@testable import Shop

final class SpyFavoritesStore: FavoritesStore {
    private var ids: [Int]
    private(set) var removedIDs: [Int] = []
    init(ids: [Int]) { self.ids = ids }
    func favoriteIDs() -> [Int] { ids }
    func remove(id: Int) { removedIDs.append(id); ids.removeAll { $0 == id } }
}

@MainActor
struct FavoritesViewModelTests {
    let mate = Product(id: 1, name: "Mate", priceCents: 1999)

    @Test func removingLastFavoriteShowsEmpty() async {
        let store = SpyFavoritesStore(ids: [1])
        let viewModel = FavoritesViewModel(store: store, service: FakeProductDetailService(product: mate))

        await viewModel.load()
        viewModel.removeFavorite(at: 0)

        #expect(viewModel.state == .empty)
        #expect(store.removedIDs == [1])
    }
}`,
          hint: "Arrange: spy + fake + view model. Act: `load()` and `removeFavorite(at: 0)`. Assert: two `#expect`s.",
        },
        {
          kind: "predict",
          prompt: "New request: when the last favorite is deleted, show a 'Removed' toast and switch back to the Products tab. How do you split it in MVVM-C?",
          code: swift`// FavoritesViewModel  → state and events
// FavoritesViewController → draws
// FavoritesCoordinator → navigation`,
          options: [
            "All in the VC: it's UI, so there's no need to touch the view model",
            "The view model does `tabBarController?.selectedIndex = 0` because it knows when the list is empty",
            "The view model decides (emits the toast message and an `onFavoritesEmpty` output), the VC shows the toast and the coordinator switches tabs",
            "The coordinator observes the VC's table and counts rows",
          ],
          answer: 2,
          explanation: "The decision ('it's empty, we need to leave') is presentation logic: it goes in the view model, where it can be tested. Showing the toast is view work: the VC. Switching tabs is navigation: the coordinator listens to `onFavoritesEmpty`. The view model never touches UIKit and the VC never decides where to go.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-massive-vc",
      front: "What is a Massive View Controller and how do you spot one?",
      back: "A VC that, besides the view, handles networking, parsing, persistence, formatting, state and navigation. Signs: hundreds of lines, `URLSession` or `UserDefaults` inside, `pushViewController` in `didSelectRowAt`, zero tests.",
    },
    {
      id: "fc-mvvm-roles",
      front: "Roles in MVVM",
      back: "Model: data and rules. View: draws the state and forwards events. ViewModel: screen state and presentation logic; doesn't know the view or import UIKit/SwiftUI.",
    },
    {
      id: "fc-state-enum",
      front: "Why model screen state as an enum?",
      back: "It removes impossible states (spinner and error at once). The screen is in exactly one case: `idle`, `loading`, `loaded`, `failed`. The view does an exhaustive `switch`.",
      code: "enum LoadState: Equatable {\n    case idle, loading\n    case loaded([Product])\n    case failed(String)\n}",
    },
    {
      id: "fc-observable-wrappers",
      front: "Which wrapper does the owning view use for its view model?",
      back: "`@Observable` (iOS 17+) → `@State`. `ObservableObject` (iOS 16 and earlier) → `@StateObject`. If it receives it from outside: a plain parameter (or `@Bindable` for bindings) / `@ObservedObject`.",
    },
    {
      id: "fc-mainactor-vm",
      front: "Why is the view model `@MainActor`?",
      back: "Its state feeds the UI, which updates on the main thread. With `@MainActor` every write to `state` happens on main; the `await` on the network suspends without blocking and hops back to main by itself.",
    },
    {
      id: "fc-init-injection",
      front: "How does the view model get its services?",
      back: "Through the initializer, as a protocol (`init(service: any ProductService)`). The app passes the real implementation and tests pass a fake. No singletons inside.",
    },
    {
      id: "fc-published-willset",
      front: "When does `@Published` emit?",
      back: "In `willSet`: the subscriber gets the new value as a parameter while the property still holds the old one. It also emits the current value on subscribe.",
    },
    {
      id: "fc-binding-cycle",
      front: "Typical retain cycle in UIKit binding",
      back: "VC → view model → `onStateChange` closure → VC (if it captures `self` strongly). With Combine: VC → `cancellables` → `sink` closure → VC. Break it with `[weak self]`.",
      code: "viewModel.onStateChange = { [weak self] state in\n    self?.render(state)\n}",
    },
    {
      id: "fc-inputs-outputs",
      front: "Inputs and outputs of a view model",
      back: "Inputs: methods the view calls (`viewDidLoad()`, `didSelectRow(at:)`). Outputs: what the view or coordinator listens to (`onStateChange`, `onSelectProduct`, a publisher). The view doesn't decide, it forwards.",
    },
    {
      id: "fc-fake-spy",
      front: "Fake/stub vs spy",
      back: "Fake/stub: returns canned data (success or error). Spy: also records how it was called (`removedIDs`, a counter) so the test can verify it.",
    },
    {
      id: "fc-test-task",
      front: "The view model does `Task { await load() }` and the test fails. What do you do?",
      back: "Test the `async` version (`await viewModel.load()`) or keep the `Task` and `await task.value`. Never `Task.sleep` to 'wait a bit'.",
    },
    {
      id: "fc-coordinator",
      front: "What does a coordinator do?",
      back: "It owns a flow's navigation: creates view models and VCs, injects dependencies and decides the next screen by listening to outputs. Minimal protocol: `childCoordinators` + `start()`.",
    },
    {
      id: "fc-child-release",
      front: "How do you avoid leaks with child coordinators?",
      back: "The parent retains the child in `childCoordinators` while the flow runs and removes it when the child reports it's done (`removeAll { $0 === child }`). In `onFinish` capture `[weak self, weak child]`.",
    },
    {
      id: "fc-router-path",
      front: "SwiftUI router: `NavigationPath` or `[Route]`?",
      back: "Both work with `NavigationStack(path:)`. `NavigationPath` accepts mixed types but erases them; `[Route]` lets you read and test the stack (for example, after a deep link).",
    },
    {
      id: "fc-deeplink",
      front: "How do you structure deep link routing?",
      back: "A pure `URL → DeepLink?` function (testable, `nil` for unknown URLs) plus the root coordinator or router that resets navigation and pushes that route's screens. In SwiftUI it comes in through `.onOpenURL`.",
    },
  ],

  exam: [
    {
      id: "ex-first-step",
      question: "You're reviewing a PR that touches a 1200-line VC with networking, `UserDefaults` and navigation. You want to start testing it without rewriting everything. What's the most reasonable first step?",
      options: [
        "Rewrite the screen in SwiftUI",
        "Move networking behind a protocol injected via `init` and move the loading state into a view model",
        "Add UI tests that navigate to the screen",
        "Split the VC into three `extension`s in separate files",
      ],
      answer: 1,
      explanation: "Injecting the network dependency lets you use a fake, and the view model makes the state testable. Splitting into extensions just spreads the lines around; rewriting in SwiftUI is a different project; UI tests are slow and don't isolate the logic.",
    },
    {
      id: "ex-impossible-state",
      question: "QA reports that sometimes the spinner and the error message show up at the same time. Which change prevents this class of bug?",
      code: "@Observable final class ProductListViewModel {\n    var isLoading = false\n    var errorMessage: String?\n    var products: [Product] = []\n}",
      options: [
        "Set `isLoading = false` at the start of the `catch`",
        "Use `didSet` on `errorMessage` to turn `isLoading` off",
        "Mark the class `@MainActor`",
        "Replace the three properties with a state `enum` with `loading`, `loaded` and `failed`",
      ],
      answer: 3,
      explanation: "With three independent properties there are invalid combinations that some code path eventually produces. An enum keeps the screen in one state at a time: the compiler rules out the impossible state. The other options patch one specific case.",
    },
    {
      id: "ex-owner-wrapper",
      question: "A view creates its own `ProductListViewModel` marked `@Observable` (iOS 17). How does it declare it?",
      options: [
        "`@State private var viewModel = ProductListViewModel(service: service)`",
        "`@StateObject private var viewModel = ProductListViewModel(service: service)`",
        "`@ObservedObject var viewModel = ProductListViewModel(service: service)`",
        "`let viewModel = ProductListViewModel(service: service)`",
      ],
      answer: 0,
      explanation: "For `@Observable`, the owner uses `@State`, which preserves the instance across renders. `@StateObject`/`@ObservedObject` require `ObservableObject`. With a `let` in the struct, every time the parent recreates the view a new view model is created and the state is lost.",
    },
    {
      id: "ex-vm-uikit-types",
      question: "You see this in a view model during code review. What's the main problem?",
      code: "import UIKit\n\n@MainActor @Observable\nfinal class ProductDetailViewModel {\n    var priceColor: UIColor = .label\n    // ...\n    priceColor = product.isOnSale ? .systemRed : .label\n}",
      options: [
        "`UIColor` isn't `Sendable` and doesn't compile with `@MainActor`",
        "`@Observable` can't observe properties of UIKit types",
        "It couples the view model to UIKit: better to expose a semantic value (`isOnSale`) and let the view pick the color",
        "It should use SwiftUI's `Color` instead of `UIColor`",
      ],
      answer: 2,
      explanation: "The view model describes *what* to show, not *how*. Exposing `isOnSale: Bool` keeps it framework-independent, reusable in SwiftUI and UIKit, and easy to test. Switching to `Color` changes the framework but keeps the coupling.",
    },
    {
      id: "ex-published-old-value",
      question: "Inside this `sink`, the log always shows the previous state. Why?",
      code: "viewModel.$state\n    .sink { [weak self] _ in\n        guard let self else { return }\n        log(self.viewModel.state)\n    }\n    .store(in: &cancellables)",
      options: [
        "Because `receive(on: DispatchQueue.main)` is missing",
        "Because `[weak self]` makes a copy of the view model",
        "Because `@Published` emits in `willSet`: the property hasn't changed yet; use the parameter value",
        "Because `store(in:)` delays emissions by one run loop cycle",
      ],
      answer: 2,
      explanation: "`@Published` publishes before storing the new value. The correct value is the closure's parameter. Adding `receive(on:)` can hide the symptom (by the time you read it later, it changed), but it isn't the cause.",
    },
    {
      id: "ex-vc-leak",
      question: "Memory Graph shows `ProductListViewController` still alive after the pop. Which line causes it?",
      code: "override func viewDidLoad() {\n    super.viewDidLoad()\n    viewModel.$state\n        .sink { state in self.render(state) }\n        .store(in: &cancellables)\n}",
      options: [
        "The `sink` captures `self` strongly: VC → `cancellables` → closure → VC",
        "`store(in:)` retains the view model forever",
        "`$state` creates a global publisher that's never released",
        "The subscriptions aren't cancelled in `viewWillDisappear`",
      ],
      answer: 0,
      explanation: "The VC owns `cancellables`, which owns the subscription, which owns the closure, which retains the VC. With `[weak self]` the cycle breaks, and when the VC is freed its subscriptions cancel themselves.",
    },
    {
      id: "ex-flaky-init-task",
      question: "The view model starts loading with `Task { await load() }` inside `init`. Tests that read `state` right after creating it fail. What's the healthiest change?",
      options: [
        "Add `try await Task.sleep(for: .milliseconds(100))` before the `#expect`",
        "Run the tests on a background thread",
        "Make the fake faster",
        "Don't start work in `init`: expose `func load() async`, have the view call it (`.task`) and the test `await` it",
      ],
      answer: 3,
      explanation: "Work hidden in `init` can't be awaited or controlled. With an async `load()`, the test does `await viewModel.load()` and is deterministic. `sleep`s make tests slow and flaky.",
    },
    {
      id: "ex-child-leak",
      question: "Every time the user completes checkout, memory goes up a few MB and never comes down. The `AppCoordinator` does this. What's missing?",
      code: "func showCheckout(cart: Cart) {\n    let checkout = CheckoutCoordinator(navigationController: nav, cart: cart)\n    checkout.onFinish = { [weak self] in self?.showOrderConfirmation() }\n    childCoordinators.append(checkout)\n    checkout.start()\n}",
      options: [
        "Make `CheckoutCoordinator` a `struct`",
        "Remove the child from `childCoordinators` in `onFinish`",
        "Use `unowned self` instead of `weak self`",
        "Call `start()` before `append`",
      ],
      answer: 1,
      explanation: "The parent retains the child so it lives for the flow, but never lets go: every checkout leaves a coordinator (and everything it retains) alive. In `onFinish` you need `childCoordinators.removeAll { $0 === checkout }`, capturing `checkout` `weak`.",
    },
    {
      id: "ex-who-decides",
      question: "After a successful login the home screen must be shown. Where does that decision live in MVVM-C?",
      options: [
        "In the parent coordinator, which listens to the login flow's `onFinish`",
        "In `LoginViewModel`, which creates the `HomeViewController`",
        "In `LoginViewController`, in the button callback",
        "In the `SceneDelegate`, which observes `UserDefaults`",
      ],
      answer: 0,
      explanation: "The login only reports 'I'm done'. What comes next depends on context (onboarding, pending deep link, home), and the parent coordinator knows that. This way the login flow can be reused elsewhere.",
    },
    {
      id: "ex-deeplink-path",
      question: "The app is showing Products → Detail(7) when `shop://favorites` arrives. With this router, what does the stack look like?",
      code: "func handle(_ url: URL) {\n    guard let link = deepLink(from: url) else { return }\n    path = NavigationPath()\n    switch link {\n    case .productList: break\n    case .productDetail(let id): path.append(Route.productDetail(id: id))\n    case .favorites: path.append(Route.favorites)\n    }\n}",
      options: [
        "Products → Detail(7) → Favorites",
        "Only Favorites, without the root",
        "Products → Favorites",
        "Unchanged: `NavigationPath` ignores repeated routes",
      ],
      answer: 2,
      explanation: "The router resets the path (back to the root, Products) and pushes `Route.favorites`. The `NavigationStack` root isn't part of the path, so it always stays. Resetting first avoids weird stacks when the link arrives in the middle of another flow.",
    },
    {
      id: "ex-testable-router",
      question: "You want a unit test that checks `shop://products/42` leaves the stack as `[.productDetail(id: 42)]`. Which router change makes that possible?",
      options: [
        "Make `Route` `Codable`",
        "Change `var path = NavigationPath()` to `var path: [Route] = []`",
        "Move the router into the root view as `@State`",
        "Use `@ObservationIgnored` on `path`",
      ],
      answer: 1,
      explanation: "`NavigationPath` erases types: you can get its `count` but not read its elements. With `[Route]` the test does `#expect(router.path == [.productDetail(id: 42)])`. `NavigationStack(path:)` accepts a binding to any collection of `Hashable` values.",
    },
    {
      id: "ex-composition",
      question: "In an interview you're asked: in MVVM-C, who creates the `ProductListViewModel` and hands it the `ProductService`?",
      options: [
        "The `ProductListViewController` itself, in `viewDidLoad`",
        "A `ServiceLocator.shared` singleton the view model queries",
        "The view model creates itself through a `static let shared`",
        "The coordinator: it builds the view model and VC injecting dependencies, and wires the outputs to its navigation",
      ],
      answer: 3,
      explanation: "The coordinator is the flow's composition point: it receives the dependencies, creates the view model and VC, and wires outputs like `onSelectProduct`. The VC gets the view model already built, and the view model gets protocols that are fakes in tests.",
    },
  ],
};

export default content;
