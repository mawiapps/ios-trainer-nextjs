import type { CourseContent } from "../types";

const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "clean-layers",
      title: "Clean Architecture on iOS: layers and the dependency rule",
      goal: "Split Presentation, Domain and Data, respect the dependency rule and map DTOs to entities.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Three layers and one rule",
          body: [
            "Clean Architecture on iOS boils down to three layers: **Presentation** (views, ViewModels or Presenters), **Domain** (entities, use cases and repository protocols) and **Data** (HTTP client, DTOs, Core Data or SwiftData, repository implementations).",
            "The dependency rule: `import`s and references always point inwards. Presentation knows Domain, Data knows Domain, and Domain knows nobody: no UIKit, no SwiftUI, no `URLSession`, no Alamofire.",
            "In a real project you see it in `Package.swift` or the targets: `Domain` builds with `Foundation` only. If a PR adds `import UIKit` to a use case, that's a violation and it gets flagged in review.",
          ],
          code: swift`// Package.swift (trimmed)
targets: [
    .target(name: "Domain"),                                    // no dependencies
    .target(name: "Data", dependencies: ["Domain"]),            // implements Domain protocols
    .target(name: "Presentation", dependencies: ["Domain"]),    // uses use cases
    .target(name: "App", dependencies: ["Presentation", "Data"]) // composition root: wires it all
]`,
        },
        {
          kind: "predict",
          prompt: "Reviewing a PR, which file breaks the dependency rule?",
          code: swift`// Domain/Order.swift
import Foundation
struct Order { let id: String; let total: Decimal }

// Domain/FetchOrdersUseCase.swift
import Foundation
protocol FetchOrdersUseCase { func execute() async throws -> [Order] }

// Domain/OrderRepository.swift
import Alamofire
protocol OrderRepository { func orders() async throws -> [Order] }

// Data/RemoteOrderRepository.swift
import Alamofire
final class RemoteOrderRepository: OrderRepository { /* ... */ }`,
          options: [
            "`Order.swift`, because it uses `Decimal` from Foundation",
            "`FetchOrdersUseCase.swift`, because a domain protocol can't be `async`",
            "`OrderRepository.swift`, because Domain imports a networking library",
            "`RemoteOrderRepository.swift`, because Data can't import Alamofire",
          ],
          answer: 2,
          explanation: "Foundation is fine in Domain (types like `Decimal`, `Date`, `URL`). An `async` protocol isn't a problem either. What breaks the rule is `import Alamofire` in Domain: the domain would be tied to an infrastructure detail. Data can import Alamofire, since that's precisely the layer for details.",
        },
        {
          kind: "explain",
          title: "Entities vs DTOs",
          body: [
            "A **DTO** mirrors the JSON exactly as the backend sends it: server names, statuses as `String`, amounts in cents. An **entity** is what the business understands: an `enum` of statuses, a `Decimal` total.",
            "DTO → entity mapping lives in Data. If the backend renames a field or changes a format tomorrow, you change the DTO and the mapper; use cases and screens never notice.",
            "Note the `?? .unknown`: a new status from the backend shouldn't crash the app or make the order disappear.",
          ],
          code: swift`// Data: mirrors the JSON as it arrives
struct OrderDTO: Decodable {
    let id: String
    let totalCents: Int
    let status: String
}

// Domain: what the business understands
enum OrderStatus: String { case pending, shipped, cancelled, unknown }

struct Order: Equatable {
    let id: String
    let total: Decimal
    let status: OrderStatus
}

// Data: the mapper
extension OrderDTO {
    func toDomain() -> Order {
        Order(id: id,
              total: Decimal(totalCents) / 100,
              status: OrderStatus(rawValue: status) ?? .unknown)
    }
}

let order = OrderDTO(id: "A-1", totalCents: 1999, status: "shipped").toDomain()
print(order.id, order.total, order.status)`,
          output: "A-1 19.99 shipped",
        },
        {
          kind: "fill",
          prompt: "The backend added a new status (`returned`) the app doesn't know yet. Complete the mapper so the order isn't lost and nothing crashes.",
          code: swift`extension OrderDTO {
    func toDomain() -> Order {
        Order(id: id,
              total: Decimal(totalCents) / 100,
              status: OrderStatus(rawValue: status) ?? ____)
    }
}`,
          accept: ["^\\.unknown$", "^OrderStatus\\.unknown$"],
          explanation: "`OrderStatus(rawValue:)` returns `nil` for `returned`. With `?? .unknown` the order stays in the list with a neutral status, and the UI can show something generic until the app is updated.",
          placeholder: ".case",
        },
        {
          kind: "explain",
          title: "Dependency inversion: the protocol lives in Domain",
          body: [
            "Domain needs orders but can't depend on Data. The way out: Domain **declares** the `OrderRepository` protocol and Data **implements** it. The dependency arrow goes from Data to Domain, even though at runtime Domain calls into Data code.",
            "The composition root (the `App` target, the `SceneDelegate` or a DI container) picks the concrete implementation. It's the only place that knows both layers.",
          ],
          code: swift`// Domain
protocol OrderRepository {
    func orders() async throws -> [Order]
}

// Data
struct RemoteOrderRepository: OrderRepository {
    let session: URLSession
    let baseURL: URL

    func orders() async throws -> [Order] {
        let (data, _) = try await session.data(from: baseURL.appending(path: "orders"))
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode([OrderDTO].self, from: data).map { $0.toDomain() }
    }
}

// App (composition root)
let repository: any OrderRepository = RemoteOrderRepository(session: .shared, baseURL: apiURL)`,
        },
        {
          kind: "write",
          prompt: "Write the domain protocol `ProductRepository` (one `async throws` method returning `[Product]`) and the Data implementation `RemoteProductRepository`, which decodes `[ProductDTO]` and maps them with `toDomain()`. The protocol must not expose DTOs.",
          starter: swift`struct Product { let id: String; let name: String }

struct ProductDTO: Decodable {
    let id: String
    let title: String
    func toDomain() -> Product { Product(id: id, name: title) }
}

// Domain

// Data
`,
          checks: [
            { pattern: "protocol\\s+ProductRepository", label: "`ProductRepository` protocol in Domain" },
            { pattern: "async\\s+throws\\s*->\\s*\\[Product\\]", label: "returns `[Product]` with `async throws`" },
            { pattern: "RemoteProductRepository\\s*:\\s*ProductRepository", label: "`RemoteProductRepository` conforms to the protocol" },
            { pattern: "decode\\(\\[ProductDTO\\]\\.self", label: "decodes `[ProductDTO]`" },
            { pattern: "\\.map\\b", label: "maps DTOs to entities" },
          ],
          warnings: [
            { pattern: "->\\s*\\[ProductDTO\\]", label: "a DTO leaks out of Data (`-> [ProductDTO]`)" },
            { pattern: "import\\s+UIKit", label: "neither Domain nor Data need UIKit" },
          ],
          solution: swift`// Domain
protocol ProductRepository {
    func products() async throws -> [Product]
}

// Data
struct RemoteProductRepository: ProductRepository {
    let session: URLSession
    let url: URL

    func products() async throws -> [Product] {
        let (data, _) = try await session.data(from: url)
        return try JSONDecoder()
            .decode([ProductDTO].self, from: data)
            .map { $0.toDomain() }
    }
}`,
          hint: "The DTO only shows up inside the implementation; the protocol signature speaks in entities.",
        },
        {
          kind: "predict",
          prompt: "Where should `toDomain()` live?",
          code: swift`// Domain/Order.swift
struct Order { let id: String; let total: Decimal; let status: OrderStatus }

// Data/OrderDTO.swift
struct OrderDTO: Decodable { let id: String; let totalCents: Int; let status: String }

// Which layer does this go in?
func toDomain() -> Order`,
          options: [
            "In Data, next to the DTO: Domain shouldn't know a JSON exists",
            "In Domain, as an `init(dto: OrderDTO)` on `Order`",
            "In Presentation, in the Presenter or ViewModel before displaying",
            "In the View, right before configuring the cell",
          ],
          answer: 0,
          explanation: "If `Order` had an `init(dto:)`, Domain would depend on `OrderDTO`, which belongs to Data: the arrow flips. Presentation and the View should never see DTOs. The mapper goes in Data, which knows both types.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "use-cases-repositories",
      title: "Use cases and repositories",
      goal: "Write use cases with business rules, repositories with remote and local data sources, and know where each rule belongs.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "One use case = one business action",
          body: [
            "A use case (sometimes called an interactor in pure Clean) represents **one** action: fetch orders, cancel an order, transfer money. It exposes a single method, typically `execute`, and depends on repository protocols.",
            "That's where non-UI rules live: which orders are shown, in what order, which validations run before hitting the backend. The Presenter or ViewModel only formats what the use case returns.",
            "In Swift 6 we mark the protocols `Sendable`: the Presenter calls them from the main actor and the work runs off it.",
          ],
          code: swift`protocol OrderRepository: Sendable {
    func orders() async throws -> [Order]
}

protocol FetchOrdersUseCase: Sendable {
    func execute() async throws -> [Order]
}

struct DefaultFetchOrdersUseCase: FetchOrdersUseCase {
    let repository: any OrderRepository

    func execute() async throws -> [Order] {
        // Business rule: hide cancelled orders, most expensive first
        try await repository.orders()
            .filter { $0.status != .cancelled }
            .sorted { $0.total > $1.total }
    }
}

struct InMemoryOrderRepository: OrderRepository {
    func orders() async throws -> [Order] {
        [Order(id: "A", total: 10, status: .pending),
         Order(id: "B", total: 50, status: .cancelled),
         Order(id: "C", total: 30, status: .shipped)]
    }
}

let orders = try await DefaultFetchOrdersUseCase(repository: InMemoryOrderRepository()).execute()
print(orders.map(\.id))`,
          output: "[\"C\", \"A\"]",
        },
        {
          kind: "predict",
          prompt: "Someone changed the use case rule. With the same `InMemoryOrderRepository`, what does it print?",
          code: swift`struct DefaultFetchOrdersUseCase: FetchOrdersUseCase {
    let repository: any OrderRepository

    func execute() async throws -> [Order] {
        try await repository.orders()
            .filter { $0.status == .pending || $0.total >= 30 }
    }
}

// A: 10, pending   B: 50, cancelled   C: 30, shipped
let orders = try await DefaultFetchOrdersUseCase(repository: InMemoryOrderRepository()).execute()
print(orders.map(\.id))`,
          options: ["`[\"A\", \"C\"]`", "`[\"A\", \"B\", \"C\"]`", "`[\"B\", \"C\"]`", "`[\"A\"]`"],
          answer: 1,
          explanation: "A passes because it's `pending`. B isn't `pending`, but `50 >= 30` is true, so a cancelled order sneaks in. C passes because `30 >= 30`. With no `sorted`, the repository order is kept: `[\"A\", \"B\", \"C\"]`. That's why rules live in the use case with their own tests: a misplaced `||` gets caught there, not in production.",
        },
        {
          kind: "explain",
          title: "Repository with remote and local data sources",
          body: [
            "The repository decides **where** data comes from: network, cache, local database. The use case neither knows nor cares. Inside, the repository coordinates smaller data sources: a remote one that returns DTOs and a local one that persists entities.",
            "A common policy in banking or e-commerce apps: network first, save what arrived and, if the network fails, return the cache. If there's no cache either, rethrow the original error so the screen shows a real error state.",
          ],
          code: swift`protocol OrdersRemoteDataSource: Sendable {
    func fetch() async throws -> [OrderDTO]
}

protocol OrdersLocalDataSource: Sendable {
    func load() -> [Order]
    func save(_ orders: [Order])
}

struct DefaultOrderRepository: OrderRepository {
    let remote: any OrdersRemoteDataSource
    let local: any OrdersLocalDataSource

    func orders() async throws -> [Order] {
        do {
            let fresh = try await remote.fetch().map { $0.toDomain() }
            local.save(fresh)
            return fresh
        } catch {
            let cached = local.load()
            if cached.isEmpty { throw error }
            return cached
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The network fails with `URLError(.notConnectedToInternet)` and `local.load()` returns `[]`. What happens when you call `orders()`?",
          code: swift`func orders() async throws -> [Order] {
    do {
        let fresh = try await remote.fetch().map { $0.toDomain() }
        local.save(fresh)
        return fresh
    } catch {
        let cached = local.load()
        if cached.isEmpty { throw error }
        return cached
    }
}`,
          options: [
            "It returns `[]` and the screen shows an empty list",
            "It crashes because the error isn't handled",
            "It returns `nil`",
            "It throws the original `URLError`, so the Presenter can show an error",
          ],
          answer: 3,
          explanation: "The `catch` catches the `URLError`, checks the cache, finds it empty and runs `throw error` with the original error. The function is `throws`, so the error bubbles up to the use case and then to the Presenter. Returning `[]` would lie: the user would think they have no orders when there's actually no connection.",
        },
        {
          kind: "explain",
          title: "Where business rules live",
          body: [
            "New rule: an order can be cancelled if it's `pending` and the total is at most 500 (bigger ones go through support). Where does it go? Not in the ViewController or the Presenter: it would be duplicated on every screen that shows the button. Not in the repository either: its job is data access.",
            "If the rule depends only on the entity's own data, it goes **in the entity**. If it orchestrates several things (validate, call the repository, log an event), it goes in the **use case**, which relies on the entity's rule.",
          ],
          code: swift`extension Order {   // rule over its own data: lives in the entity
    var isCancellable: Bool {
        status == .pending && total <= 500
    }
}

protocol OrderRepository: Sendable {
    func orders() async throws -> [Order]
    func cancel(orderID: String) async throws
}

print(Order(id: "A", total: 120, status: .pending).isCancellable)
print(Order(id: "B", total: 900, status: .pending).isCancellable)
print(Order(id: "C", total: 50, status: .shipped).isCancellable)`,
          output: "true\nfalse\nfalse",
        },
        {
          kind: "fill",
          prompt: "Complete the `cancel` signature in the repository protocol: it calls the backend and can fail.",
          code: swift`protocol OrderRepository: Sendable {
    func orders() async throws -> [Order]
    func cancel(orderID: String) ____
}`,
          accept: ["^async throws$"],
          explanation: "Cancelling is a network call that can fail: `async throws`. Order matters: Swift requires `async` before `throws`.",
          placeholder: "async ...",
        },
        {
          kind: "write",
          prompt: "Implement `execute` in `DefaultCancelOrderUseCase`: if the order isn't cancellable (use `isCancellable`), throw `CancelOrderError.notCancellable`; otherwise call `repository.cancel(orderID:)`.",
          starter: swift`enum CancelOrderError: Error { case notCancellable }

protocol CancelOrderUseCase: Sendable {
    func execute(_ order: Order) async throws
}

struct DefaultCancelOrderUseCase: CancelOrderUseCase {
    let repository: any OrderRepository

    func execute(_ order: Order) async throws {
        // your code
    }
}`,
          checks: [
            { pattern: "isCancellable", label: "uses the entity rule (`isCancellable`)" },
            { pattern: "throw\\s+CancelOrderError\\.notCancellable", label: "throws `CancelOrderError.notCancellable`" },
            { pattern: "try\\s+await\\s+repository\\.cancel\\(orderID:", label: "calls `try await repository.cancel(orderID:)`" },
          ],
          warnings: [
            { pattern: "URLSession", label: "the use case doesn't talk to the network: that's the repository's job" },
            { pattern: "import\\s+UIKit", label: "Domain doesn't import UIKit" },
            { pattern: "status\\s*==\\s*\\.pending", label: "you're duplicating the rule instead of using `isCancellable`" },
          ],
          solution: swift`struct DefaultCancelOrderUseCase: CancelOrderUseCase {
    let repository: any OrderRepository

    func execute(_ order: Order) async throws {
        guard order.isCancellable else {
            throw CancelOrderError.notCancellable
        }
        try await repository.cancel(orderID: order.id)
    }
}`,
          hint: "A `guard ... else { throw ... }` followed by the repository call.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "viper-components",
      title: "VIPER components and their contracts",
      goal: "Know what View, Interactor, Presenter, Entity and Router do, how they talk through protocols, and who holds whom.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "V, I, P, E, R",
          body: [
            "**View**: a passive `UIViewController`. It shows what it's told and forwards events (`viewDidLoad`, taps). **Interactor**: the module's business logic; in VIPER + Clean it usually delegates to use cases. **Presenter**: the hub of the module; it receives View events, asks the Interactor for data, turns entities into view models and asks the Router to navigate.",
            "**Entity**: the domain models (`Order`). **Router** (or Wireframe): navigates and builds the next module. Along with the View, it's the only piece that touches UIKit.",
            "The most useful way to read someone else's VIPER module is to follow one action end to end.",
          ],
          code: swift`// Flow for "user opens My orders"
// View        -> presenter.viewDidLoad()
// Presenter   -> interactor.fetchOrders()
// Interactor  -> try await useCase.execute()        // Entity: [Order]
// Interactor  -> output?.didFetch(orders)
// Presenter   -> view?.show(rows)                   // [OrderRowViewModel]
// View        -> tableView.reloadData()
//
// Tap on a row
// View        -> presenter.didSelectRow(at: 2)
// Presenter   -> router.showDetail(orderID: "C")`,
        },
        {
          kind: "predict",
          prompt: "The total must read `$19.99` and the date `5 min ago`. Who builds those strings?",
          code: swift`struct OrderRowViewModel: Equatable {
    let title: String
    let subtitle: String   // "$19.99 · 5 min ago"
}`,
          options: [
            "The View, in `tableView(_:cellForRowAt:)`",
            "The Presenter, when turning `Order` into `OrderRowViewModel`",
            "The Interactor, before calling `didFetch`",
            "The Entity, with a `formattedTotal` property",
          ],
          answer: 1,
          explanation: "Formatting for display is presentation logic: it's the Presenter's job. That way it's tested without UIKit (you compare `OrderRowViewModel` values with `==`). The View just assigns strings to labels; the Interactor and the Entity don't know what the screen looks like.",
        },
        {
          kind: "explain",
          title: "Contracts: one protocol per arrow",
          body: [
            "Every arrow between components is a protocol. That's what lets you swap any piece for a spy in tests. Naming varies by team (`ViewInput`/`ViewOutput`, `PresenterToView`, `ViewToPresenter`); what matters is keeping them together in an `OrdersContracts.swift` file.",
            "Protocols stored as `weak` (the View and the Interactor's output) must be class-constrained with `AnyObject`. And since the whole module drives UI, in Swift 6 they're marked `@MainActor`.",
          ],
          code: swift`@MainActor protocol OrdersViewInput: AnyObject {      // Presenter -> View
    func show(_ rows: [OrderRowViewModel])
    func showError(_ message: String)
}

@MainActor protocol OrdersViewOutput {                // View -> Presenter
    func viewDidLoad()
    func didSelectRow(at index: Int)
}

@MainActor protocol OrdersInteractorInput {           // Presenter -> Interactor
    func fetchOrders()
}

@MainActor protocol OrdersInteractorOutput: AnyObject { // Interactor -> Presenter
    func didFetch(_ orders: [Order])
    func didFail(_ error: Error)
}

@MainActor protocol OrdersRouterInput {               // Presenter -> Router
    func showDetail(orderID: String)
}`,
        },
        {
          kind: "fill",
          prompt: "The Presenter stores the View as `weak var view: OrdersViewInput?`. Complete the protocol so that compiles.",
          code: swift`@MainActor
protocol OrdersViewInput: ____ {
    func show(_ rows: [OrderRowViewModel])
    func showError(_ message: String)
}`,
          accept: ["^AnyObject$"],
          explanation: "`weak` only applies to class references. Without `AnyObject`, the compiler can't rule out a struct conforming to the protocol, so it rejects `weak`. (`class` as a constraint is the old spelling; today you use `AnyObject`.)",
        },
        {
          kind: "explain",
          title: "Who holds whom",
          body: [
            "The module lives as long as its View is on screen. The View holds the Presenter strongly; the Presenter holds the Interactor and the Router strongly. Every back reference is `weak`: Presenter → View, Interactor → Presenter (output) and Router → ViewController.",
            "When the navigation controller pops, it releases the View, the View releases the Presenter and the whole module goes down in a chain. If a single back arrow stays strong, you get a cycle and the entire module stays in memory.",
          ],
          code: swift`// navigationController ──► View ──► Presenter ──► Interactor
//                                     │  ▲            │
//                                     │  └── weak ────┘ (output)
//                                     └──► Router
// Presenter ── weak ──► View
// Router    ── weak ──► View (as UIViewController)

@MainActor
final class OrdersInteractor: OrdersInteractorInput {
    weak var output: OrdersInteractorOutput?
    private let useCase: any FetchOrdersUseCase

    init(useCase: any FetchOrdersUseCase) { self.useCase = useCase }

    func fetchOrders() {
        Task {
            do {
                let orders = try await useCase.execute()
                output?.didFetch(orders)
            } catch {
                output?.didFail(error)
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "What does it print?",
          code: swift`final class Interactor {
    var output: Presenter?
    deinit { print("Interactor deinit") }
}

final class Presenter {
    let interactor: Interactor
    init(interactor: Interactor) { self.interactor = interactor }
    deinit { print("Presenter deinit") }
}

do {
    let interactor = Interactor()
    let presenter = Presenter(interactor: interactor)
    interactor.output = presenter
}
print("done")`,
          options: [
            "`Presenter deinit`, `Interactor deinit` and `done`",
            "`Interactor deinit`, `Presenter deinit` and `done`",
            "Only `done`: the Presenter ↔ Interactor cycle is never released",
            "It doesn't compile: `weak` is missing",
          ],
          answer: 2,
          explanation: "When the `do` block ends, the locals drop their references, but the Presenter holds the Interactor and the Interactor holds the Presenter through a strong `var output`. Neither reaches zero, no `deinit` runs and only `done` prints. It compiles fine: `weak` is your call, the compiler doesn't require it. The fix is `weak var output`.",
        },
        {
          kind: "write",
          prompt: "Write `OrdersPresenter`: it conforms to `OrdersViewOutput` and `OrdersInteractorOutput`, stores the View as `weak`, fetches orders in `viewDidLoad()`, builds `OrderRowViewModel(title:subtitle:)` in `didFetch` and calls `view?.show`, shows an error in `didFail`, and navigates with `router.showDetail(orderID:)` in `didSelectRow(at:)`.",
          starter: swift`@MainActor
final class OrdersPresenter {
    // properties

    init(interactor: OrdersInteractorInput, router: OrdersRouterInput) {
        // ...
    }
}`,
          checks: [
            { pattern: "weak\\s+var\\s+view\\s*:\\s*OrdersViewInput\\?", label: "`weak var view: OrdersViewInput?`" },
            { pattern: "OrdersViewOutput", label: "conforms to `OrdersViewOutput`" },
            { pattern: "OrdersInteractorOutput", label: "conforms to `OrdersInteractorOutput`" },
            { pattern: "interactor\\.fetchOrders\\(\\)", label: "`viewDidLoad` calls `interactor.fetchOrders()`" },
            { pattern: "view\\?\\.show\\(", label: "passes rows to `view?.show`" },
            { pattern: "router\\.showDetail\\(orderID:", label: "navigates with `router.showDetail(orderID:)`" },
          ],
          warnings: [
            { pattern: "^\\s*var\\s+view\\s*:", label: "holding the View strongly creates a cycle" },
            { pattern: "import\\s+UIKit", label: "the Presenter doesn't need UIKit" },
          ],
          solution: swift`@MainActor
final class OrdersPresenter {
    weak var view: OrdersViewInput?
    private let interactor: OrdersInteractorInput
    private let router: OrdersRouterInput
    private var orders: [Order] = []

    init(interactor: OrdersInteractorInput, router: OrdersRouterInput) {
        self.interactor = interactor
        self.router = router
    }
}

extension OrdersPresenter: OrdersViewOutput {
    func viewDidLoad() {
        interactor.fetchOrders()
    }

    func didSelectRow(at index: Int) {
        router.showDetail(orderID: orders[index].id)
    }
}

extension OrdersPresenter: OrdersInteractorOutput {
    func didFetch(_ orders: [Order]) {
        self.orders = orders
        view?.show(orders.map {
            OrderRowViewModel(title: "Order \($0.id)", subtitle: "$\($0.total)")
        })
    }

    func didFail(_ error: Error) {
        view?.showError("We couldn't load your orders")
    }
}`,
          hint: "Keep the orders in a private property: `didSelectRow(at:)` needs the `id` of that row's order.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "viper-wiring",
      title: "Wiring a VIPER module: builder, router and data between modules",
      goal: "Assemble a module with its builder, navigate with the router, pass data both ways and leave no retain cycles.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "The Builder (or Assembly)",
          body: [
            "Someone has to create the five pieces and connect them. That's the Builder: an `enum` with a `static func build(...)` that takes external dependencies (repository, input parameters) and returns a `UIViewController` ready to present.",
            "The order barely matters; what matters is that every reference has the right strength: the View holds the Presenter (strong) and every back arrow is `weak`. Since nothing else holds the module, its real owner is the navigation controller.",
          ],
          code: swift`final class OrdersViewController: UIViewController, OrdersViewInput {
    var presenter: OrdersViewOutput!            // strong: the View keeps the module alive

    override func viewDidLoad() {
        super.viewDidLoad()
        presenter.viewDidLoad()
    }
    func show(_ rows: [OrderRowViewModel]) { /* reloadData */ }
    func showError(_ message: String) { /* alert */ }
}

enum OrdersBuilder {
    @MainActor
    static func build(repository: any OrderRepository) -> UIViewController {
        let view = OrdersViewController()
        let interactor = OrdersInteractor(useCase: DefaultFetchOrdersUseCase(repository: repository))
        let router = OrdersRouter()
        let presenter = OrdersPresenter(interactor: interactor, router: router)

        view.presenter = presenter      // strong
        presenter.view = view           // weak
        interactor.output = presenter   // weak
        router.viewController = view    // weak
        return view
    }
}`,
        },
        {
          kind: "write",
          prompt: "Write `ProfileBuilder.build(userID:repository:)`: create `ProfileInteractor(userID:useCase:)` with a `DefaultFetchUserUseCase(repository:)`, `ProfileRouter()` and `ProfilePresenter(interactor:router:)`, wire every reference and return the View.",
          starter: swift`enum ProfileBuilder {
    @MainActor
    static func build(userID: String, repository: any UserRepository) -> UIViewController {
        let view = ProfileViewController()
        // ...
    }
}`,
          checks: [
            { pattern: "ProfileInteractor\\(", label: "creates the Interactor" },
            { pattern: "ProfileRouter\\(", label: "creates the Router" },
            { pattern: "ProfilePresenter\\(", label: "creates the Presenter" },
            { pattern: "view\\.presenter\\s*=\\s*presenter", label: "`view.presenter = presenter`" },
            { pattern: "presenter\\.view\\s*=\\s*view", label: "`presenter.view = view`" },
            { pattern: "interactor\\.output\\s*=\\s*presenter", label: "`interactor.output = presenter`" },
            { pattern: "router\\.viewController\\s*=\\s*view", label: "`router.viewController = view`" },
            { pattern: "return\\s+view", label: "returns the View" },
          ],
          warnings: [
            { pattern: "presenter\\.view\\s*=\\s*ProfileViewController\\(\\)", label: "the Presenter points to a different View instance" },
          ],
          solution: swift`enum ProfileBuilder {
    @MainActor
    static func build(userID: String, repository: any UserRepository) -> UIViewController {
        let view = ProfileViewController()
        let interactor = ProfileInteractor(userID: userID,
                                           useCase: DefaultFetchUserUseCase(repository: repository))
        let router = ProfileRouter()
        let presenter = ProfilePresenter(interactor: interactor, router: router)

        view.presenter = presenter
        presenter.view = view
        interactor.output = presenter
        router.viewController = view
        return view
    }
}`,
          hint: "Four wiring assignments: one strong (View → Presenter) and three `weak` back references.",
        },
        {
          kind: "explain",
          title: "The Router navigates and builds the next module",
          body: [
            "The Router receives navigation requests from the Presenter in business terms (`showDetail(orderID:)`) and translates them to UIKit: it calls the destination module's Builder and pushes or presents from its `viewController`.",
            "Forward data travels as Builder parameters: pass an ID or an entity, never the previous module's Presenter or Interactor. That way every module can be built and tested in isolation.",
          ],
          code: swift`@MainActor
final class OrdersRouter: OrdersRouterInput {
    weak var viewController: UIViewController?

    func showDetail(orderID: String) {
        let detail = OrderDetailBuilder.build(orderID: orderID)
        viewController?.navigationController?.pushViewController(detail, animated: true)
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the UIKit method that adds the detail to the navigation stack.",
          code: swift`func showDetail(orderID: String) {
    let detail = OrderDetailBuilder.build(orderID: orderID)
    viewController?.navigationController?.____(detail, animated: true)
}`,
          accept: ["^pushViewController$"],
          explanation: "`pushViewController(_:animated:)` adds the controller to the `UINavigationController` stack. From then on, the navigation controller owns the detail module.",
          placeholder: "push...",
        },
        {
          kind: "predict",
          prompt: "With this Router, the user opens My orders and goes back. What gets released?",
          code: swift`@MainActor
final class OrdersRouter: OrdersRouterInput {
    var viewController: UIViewController?      // no weak
    // ...
}

// Builder
view.presenter = presenter       // strong
presenter.view = view            // weak
interactor.output = presenter    // weak
router.viewController = view     // strong (because of the Router)`,
          options: [
            "Everything: the navigation controller was the only owner",
            "Only the View; Presenter and Router stay alive",
            "Only the Router",
            "Nothing: View → Presenter → Router → View is a cycle and the whole module stays in memory",
          ],
          answer: 3,
          explanation: "The View holds the Presenter, the Presenter holds the Router and the Router holds the View: a three-way cycle. When the navigation controller lets go of the View, each object is still held by another, so nothing is released (not even the Interactor, which hangs off the Presenter). Xcode's Memory Graph shows the cycle; the fix is `weak var viewController`.",
        },
        {
          kind: "explain",
          title: "Sending data back: the module output",
          body: [
            "For the way back (the user picks a filter and the list refreshes) you use a module output protocol: `OrderFilterModuleOutput`. The Orders Presenter implements it, and the Filter Presenter stores it as `weak`.",
            "The Orders Router hands it to the Filter Builder. No `NotificationCenter`, no singletons: the contract stays explicit, typed and testable with a spy.",
          ],
          code: swift`@MainActor
protocol OrderFilterModuleOutput: AnyObject {
    func orderFilter(didSelect status: OrderStatus?)
}

// Orders Router
func showFilter(selected: OrderStatus?, output: OrderFilterModuleOutput) {
    let filter = OrderFilterBuilder.build(selected: selected, output: output)
    viewController?.present(filter, animated: true)
}

// Filter Presenter
weak var moduleOutput: OrderFilterModuleOutput?

func didTapApply() {
    moduleOutput?.orderFilter(didSelect: selected)
    router.dismiss()
}

// Orders Presenter
extension OrdersPresenter: OrderFilterModuleOutput {
    func orderFilter(didSelect status: OrderStatus?) {
        interactor.fetchOrders(status: status)   // the contract gains an optional filter
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The Filter module has to tell Orders which status the user picked. What's the best option in VIPER?",
          code: swift`// Orders presents Filter modally.
// In Filter, the user taps "Shipped" and "Apply".
// Orders must reload showing only shipped orders.`,
          options: [
            "An `OrderFilterModuleOutput` protocol implemented by the Orders Presenter and stored `weak` by the Filter Presenter",
            "Post a `Notification` and have the Orders Interactor observe it",
            "Store the filter in a `FilterStore.shared` singleton and re-read it in `viewWillAppear`",
            "Have the Filter Presenter keep a strong reference to the Orders Presenter",
          ],
          answer: 0,
          explanation: "The module output keeps the contract explicit and typed, is testable with a spy and, being `weak`, creates no cycles. The notification is implicit and hard to trace; the singleton adds global state and depends on the view lifecycle; a strong reference between Presenters can keep modules alive longer than needed.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "viper-testing-tradeoffs",
      title: "Testing VIPER and trade-offs",
      goal: "Test Presenter and Interactor with spies, weigh the real cost of VIPER and Clean, and migrate a module to MVVM.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Testing the Presenter with spies",
          body: [
            "A **spy** is a test double that records the calls it receives so you can assert on them later. Since the Presenter only talks to protocols, it's tested without UIKit, without network, in milliseconds.",
            "The shape is always the same: build the Presenter with spies, fire an event (`viewDidLoad()`, `didFetch`, `didSelectRow(at:)`) and check which calls went out to the View, Interactor or Router. Shown here with Swift Testing; with XCTest it's the same with `XCTAssertEqual` instead of `#expect`.",
          ],
          code: swift`@MainActor
final class InteractorSpy: OrdersInteractorInput {
    private(set) var fetchOrdersCallCount = 0
    func fetchOrders() { fetchOrdersCallCount += 1 }
}

@MainActor
final class RouterSpy: OrdersRouterInput {
    private(set) var shownOrderIDs: [String] = []
    func showDetail(orderID: String) { shownOrderIDs.append(orderID) }
}

@MainActor
struct OrdersPresenterTests {
    @Test func viewDidLoadFetchesOrders() {
        let interactor = InteractorSpy()
        let sut = OrdersPresenter(interactor: interactor, router: RouterSpy())

        sut.viewDidLoad()

        #expect(interactor.fetchOrdersCallCount == 1)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Using the `OrdersPresenter` from the previous lesson, what does it print?",
          code: swift`final class CallsViewSpy: OrdersViewInput {
    private(set) var calls: [String] = []
    func show(_ rows: [OrderRowViewModel]) { calls.append("show(\(rows.count))") }
    func showError(_ message: String) { calls.append("error") }
}

let view = CallsViewSpy()
let sut = OrdersPresenter(interactor: InteractorSpy(), router: RouterSpy())
sut.view = view
sut.didFetch([Order(id: "A", total: 10, status: .pending),
              Order(id: "B", total: 5, status: .shipped)])
sut.didFail(URLError(.timedOut))
sut.view = nil
sut.didFetch([])
print(view.calls)`,
          options: [
            "`[\"show(2)\"]`",
            "`[\"show(2)\", \"error\", \"show(0)\"]`",
            "`[\"show(2)\", \"error\"]`",
            "`[\"error\"]`",
          ],
          answer: 2,
          explanation: "`didFetch` with two orders calls `show` with two rows: `show(2)`. `didFail` calls `showError`: `error`. Then `sut.view = nil`, so the last `didFetch` does `view?.show(...)` on `nil` and nothing is recorded. Result: `[\"show(2)\", \"error\"]`.",
        },
        {
          kind: "write",
          prompt: "Write a test that checks that tapping the second row makes the Presenter navigate to that order's detail. Use `RouterSpy` and its `shownOrderIDs`. Careful: the Presenter needs orders loaded before the tap.",
          starter: swift`@MainActor
struct OrdersPresenterNavigationTests {
    @Test func selectingRowShowsDetail() {
        // Arrange

        // Act

        // Assert
    }
}`,
          checks: [
            { pattern: "RouterSpy\\(\\)", label: "uses `RouterSpy`" },
            { pattern: "didFetch\\(", label: "loads orders with `didFetch` before the tap" },
            { pattern: "didSelectRow\\(at:\\s*1\\)", label: "taps the second row (`didSelectRow(at: 1)`)" },
            { pattern: "#expect\\(|XCTAssert", label: "asserts with `#expect` or `XCTAssert`" },
            { pattern: "shownOrderIDs", label: "checks the spy's `shownOrderIDs`" },
          ],
          warnings: [
            { pattern: "OrdersRouter\\(\\)", label: "you're using the real Router: the test depends on UIKit" },
          ],
          solution: swift`@MainActor
struct OrdersPresenterNavigationTests {
    @Test func selectingRowShowsDetail() {
        let router = RouterSpy()
        let sut = OrdersPresenter(interactor: InteractorSpy(), router: router)
        sut.didFetch([Order(id: "A", total: 10, status: .pending),
                      Order(id: "B", total: 20, status: .shipped)])

        sut.didSelectRow(at: 1)

        #expect(router.shownOrderIDs == ["B"])
    }
}`,
          hint: "Without a prior `didFetch`, `orders[1]` is out of range and the test crashes.",
        },
        {
          kind: "explain",
          title: "Testing the Interactor: keep the Task",
          body: [
            "The Interactor fires a `Task` and returns immediately, so the test has nothing to wait on. The clean fix: store the `Task` in `private(set) var task` and `await sut.task?.value` in the test. No `Task.sleep`: it's slow and flaky on CI.",
            "The use case is replaced with a **stub** (returns a canned answer) and the output with a spy. That way you cover both paths: success and failure.",
          ],
          code: swift`@MainActor
final class OrdersInteractor: OrdersInteractorInput {
    weak var output: OrdersInteractorOutput?
    private let useCase: any FetchOrdersUseCase
    private(set) var task: Task<Void, Never>?

    init(useCase: any FetchOrdersUseCase) { self.useCase = useCase }

    func fetchOrders() {
        task?.cancel()
        task = Task {
            do {
                let orders = try await useCase.execute()
                output?.didFetch(orders)
            } catch {
                output?.didFail(error)
            }
        }
    }
}

struct FetchOrdersUseCaseStub: FetchOrdersUseCase {
    let result: Result<[Order], Error>
    func execute() async throws -> [Order] { try result.get() }
}

@MainActor
final class InteractorOutputSpy: OrdersInteractorOutput {
    private(set) var fetched: [Order] = []
    private(set) var errors: [Error] = []
    func didFetch(_ orders: [Order]) { fetched = orders }
    func didFail(_ error: Error) { errors.append(error) }
}

@MainActor
struct OrdersInteractorTests {
    @Test func forwardsFailureToOutput() async {
        let sut = OrdersInteractor(useCase: FetchOrdersUseCaseStub(result: .failure(URLError(.timedOut))))
        let output = InteractorOutputSpy()
        sut.output = output

        sut.fetchOrders()
        await sut.task?.value

        #expect(output.errors.count == 1)
        #expect(output.fetched.isEmpty)
    }
}`,
        },
        {
          kind: "explain",
          title: "The cost: files and ceremony",
          body: [
            "A complete VIPER module is 6 to 9 files and about 5 protocols per screen, plus spies. On a large banking team, with complex rules, many people touching the same feature and a strict coverage policy, that separation pays for itself: every piece has a clear owner and PRs don't step on each other.",
            "On a Settings screen with four toggles it's pure ceremony. VIPER also fits SwiftUI poorly: the View is a struct, you can't hold it `weak`, and SwiftUI's data flow already covers what the Presenter used to do.",
            "Clean has the same trap: a use case that only does `return try await repository.orders()` adds nothing. Add one when there's a rule to protect, not for symmetry.",
          ],
          code: swift`Orders/
├── OrdersContracts.swift       // 5 protocols
├── OrdersViewController.swift
├── OrdersPresenter.swift
├── OrdersInteractor.swift
├── OrdersRouter.swift
├── OrdersBuilder.swift
└── Tests/
    ├── OrdersPresenterTests.swift
    ├── OrdersInteractorTests.swift
    └── OrdersSpies.swift`,
        },
        {
          kind: "predict",
          prompt: "A team of 3, a new SwiftUI app. The screen is Settings: 4 toggles stored in `UserDefaults`, no business rules. Someone proposes VIPER + Clean with one use case per toggle. What do you say in review?",
          code: swift`Settings/
├── SettingsContracts.swift
├── SettingsView.swift
├── SettingsPresenter.swift
├── SettingsInteractor.swift
├── SettingsRouter.swift
├── SettingsBuilder.swift
├── ToggleNotificationsUseCase.swift
├── ToggleDarkModeUseCase.swift
├── ToggleBiometricsUseCase.swift
└── ToggleAnalyticsUseCase.swift`,
          options: [
            "Approve: every screen must have every layer for consistency",
            "A simple MVVM (`@Observable` or `ObservableObject`) with a small settings repository; VIPER here is ceremony with no payoff",
            "Build it in UIKit so VIPER fits better",
            "Put everything in the View with no abstraction, even if it needs tests later",
          ],
          answer: 1,
          explanation: "There are no business rules and no complex navigation, and VIPER fights SwiftUI. A ViewModel with an injected repository is just as testable with half the files. Switching frameworks to fit an architecture is backwards, and putting `UserDefaults` straight into the View makes it hard to test.",
        },
        {
          kind: "explain",
          title: "Migrating VIPER → MVVM without breaking everything",
          body: [
            "One module at a time. The Presenter and Interactor merge into a ViewModel; use cases and repositories stay untouched: that's where Clean pays off. The Router becomes a Coordinator or a navigation closure.",
            "The Builder still returns a `UIViewController` (now a `UIHostingController`), so the rest of the app doesn't notice. Presenter tests become ViewModel tests with a use case stub.",
            "The reverse path exists too: when a ViewModel goes past 600 lines, extracting use cases and a router is a step toward VIPER without rewriting the screen.",
          ],
          code: swift`@Observable @MainActor          // iOS 17; before that: ObservableObject + @Published
final class OrdersViewModel {
    private(set) var rows: [OrderRowViewModel] = []
    private(set) var errorMessage: String?
    var onSelectOrder: (String) -> Void = { _ in }   // what the Router used to do

    private let fetchOrders: any FetchOrdersUseCase  // the use case doesn't change
    private var orders: [Order] = []

    init(fetchOrders: any FetchOrdersUseCase) { self.fetchOrders = fetchOrders }

    func load() async {
        do {
            orders = try await fetchOrders.execute()
            rows = orders.map { OrderRowViewModel(title: "Order \($0.id)", subtitle: "$\($0.total)") }
        } catch {
            errorMessage = "We couldn't load your orders"
        }
    }

    func select(at index: Int) { onSelectOrder(orders[index].id) }
}

enum OrdersBuilder {   // the public signature barely changes
    @MainActor
    static func build(useCase: any FetchOrdersUseCase,
                      onSelect: @escaping (String) -> Void) -> UIViewController {
        let viewModel = OrdersViewModel(fetchOrders: useCase)
        viewModel.onSelectOrder = onSelect
        return UIHostingController(rootView: OrdersScreen(viewModel: viewModel))
    }
}`,
        },
        {
          kind: "fill",
          prompt: "The app now targets iOS 17 as a minimum. Complete the ViewModel's macro so SwiftUI observes `rows` without `@Published`.",
          code: swift`____ @MainActor
final class OrdersViewModel {
    private(set) var rows: [OrderRowViewModel] = []
}`,
          accept: ["^@Observable$"],
          explanation: "`@Observable` (Observation framework, iOS 17+) makes every stored property observable, and SwiftUI only redraws views that read what changed. With a lower deployment target you use `ObservableObject` + `@Published`.",
          placeholder: "@...",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: Transfers VIPER module",
      goal: "Build a complete VIPER module on top of a Clean use case and repository, with Presenter and Interactor tests.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "You work on a banking app that uses VIPER. You're assigned the **Recent transfers** module: a list where tapping a row opens the detail. The backend returns every transfer, failed ones included.",
            "Business rules: hide `failed` transfers, sort by date (newest first) and show at most 20. Each row shows `Transfer <id>` as the title and the amount as the subtitle.",
            "You'll write: the domain (entity, repository, use case), the Interactor and Presenter, the Router and Builder, and the tests. Below is what already exists in the project.",
          ],
          code: swift`// Already in the project
enum TransferStatus: String { case completed, pending, failed }

struct TransferRowViewModel: Equatable {
    let title: String
    let subtitle: String
}

final class TransfersViewController: UIViewController, TransfersViewInput {
    var presenter: TransfersViewOutput!
    // show(_:), showError(_:)
}

// TransferDetailBuilder.build(transferID: String) -> UIViewController
// RemoteTransferRepository: TransferRepository   (Data, with its TransferDTO)`,
        },
        {
          kind: "write",
          prompt: "Domain: write the `Transfer` entity (`id`, `amount: Decimal`, `status`, `date`), the `TransferRepository` protocol, the `FetchRecentTransfersUseCase` protocol and its implementation with the three rules: no `failed`, sorted by date descending, at most 20.",
          starter: swift`import Foundation

// Entity

// Repository

// Use case
`,
          checks: [
            { pattern: "struct\\s+Transfer\\b", label: "`Transfer` entity" },
            { pattern: "protocol\\s+TransferRepository", label: "`TransferRepository` protocol" },
            { pattern: "protocol\\s+FetchRecentTransfersUseCase", label: "`FetchRecentTransfersUseCase` protocol" },
            { pattern: "\\.filter\\s*\\{[^}]*failed", label: "excludes `failed`" },
            { pattern: "\\.sorted\\s*\\{[^}]*date", label: "sorts by date" },
            { pattern: "\\.prefix\\(20\\)", label: "caps at 20 with `prefix(20)`" },
          ],
          warnings: [
            { pattern: "import\\s+UIKit", label: "Domain doesn't import UIKit" },
            { pattern: "URLSession", label: "the domain doesn't talk to the network" },
            { pattern: "TransferDTO", label: "the domain doesn't know about DTOs" },
          ],
          solution: swift`import Foundation

// Entity
struct Transfer: Equatable, Sendable {
    let id: String
    let amount: Decimal
    let status: TransferStatus
    let date: Date
}

// Repository
protocol TransferRepository: Sendable {
    func transfers() async throws -> [Transfer]
}

// Use case
protocol FetchRecentTransfersUseCase: Sendable {
    func execute() async throws -> [Transfer]
}

struct DefaultFetchRecentTransfersUseCase: FetchRecentTransfersUseCase {
    let repository: any TransferRepository

    func execute() async throws -> [Transfer] {
        let all = try await repository.transfers()
        return Array(
            all.filter { $0.status != .failed }
               .sorted { $0.date > $1.date }
               .prefix(20)
        )
    }
}`,
          hint: "`prefix(20)` returns an `ArraySlice`: wrap it in `Array(...)` to match the signature.",
        },
        {
          kind: "write",
          prompt: "Interactor and Presenter: implement `TransfersInteractor` (store the `Task` in `private(set) var task` so it's testable) and `TransfersPresenter`, using the contracts from the starter. Back references are always `weak`.",
          starter: swift`@MainActor protocol TransfersViewInput: AnyObject {
    func show(_ rows: [TransferRowViewModel])
    func showError(_ message: String)
}
@MainActor protocol TransfersViewOutput {
    func viewDidLoad()
    func didSelectRow(at index: Int)
}
@MainActor protocol TransfersInteractorInput { func fetchTransfers() }
@MainActor protocol TransfersInteractorOutput: AnyObject {
    func didFetch(_ transfers: [Transfer])
    func didFail(_ error: Error)
}
@MainActor protocol TransfersRouterInput { func showDetail(transferID: String) }

// Interactor

// Presenter
`,
          checks: [
            { pattern: "final\\s+class\\s+TransfersInteractor", label: "`TransfersInteractor` class" },
            { pattern: "weak\\s+var\\s+output", label: "`weak var output` in the Interactor" },
            { pattern: "var\\s+task\\s*:\\s*Task<", label: "stores the `Task` in `task`" },
            { pattern: "try\\s+await\\s+useCase\\.execute\\(\\)", label: "calls `try await useCase.execute()`" },
            { pattern: "final\\s+class\\s+TransfersPresenter", label: "`TransfersPresenter` class" },
            { pattern: "weak\\s+var\\s+view", label: "`weak var view` in the Presenter" },
            { pattern: "view\\?\\.show\\(", label: "shows rows with `view?.show`" },
            { pattern: "router\\.showDetail\\(transferID:", label: "navigates with `router.showDetail(transferID:)`" },
          ],
          warnings: [
            { pattern: "^\\s*var\\s+(view|output)\\s*:", label: "strong back reference: retain cycle" },
            { pattern: "UIViewController", label: "Interactor and Presenter don't know UIKit" },
            { pattern: "\\.filter\\s*\\{[^}]*failed", label: "the `failed` rule already lives in the use case" },
          ],
          solution: swift`// Interactor
@MainActor
final class TransfersInteractor: TransfersInteractorInput {
    weak var output: TransfersInteractorOutput?
    private let useCase: any FetchRecentTransfersUseCase
    private(set) var task: Task<Void, Never>?

    init(useCase: any FetchRecentTransfersUseCase) { self.useCase = useCase }

    func fetchTransfers() {
        task?.cancel()
        task = Task {
            do {
                let transfers = try await useCase.execute()
                output?.didFetch(transfers)
            } catch {
                output?.didFail(error)
            }
        }
    }
}

// Presenter
@MainActor
final class TransfersPresenter {
    weak var view: TransfersViewInput?
    private let interactor: TransfersInteractorInput
    private let router: TransfersRouterInput
    private var transfers: [Transfer] = []

    init(interactor: TransfersInteractorInput, router: TransfersRouterInput) {
        self.interactor = interactor
        self.router = router
    }
}

extension TransfersPresenter: TransfersViewOutput {
    func viewDidLoad() { interactor.fetchTransfers() }

    func didSelectRow(at index: Int) {
        router.showDetail(transferID: transfers[index].id)
    }
}

extension TransfersPresenter: TransfersInteractorOutput {
    func didFetch(_ transfers: [Transfer]) {
        self.transfers = transfers
        view?.show(transfers.map {
            TransferRowViewModel(title: "Transfer \($0.id)", subtitle: "$\($0.amount)")
        })
    }

    func didFail(_ error: Error) {
        view?.showError("We couldn't load your transfers")
    }
}`,
          hint: "Follow the shape of `OrdersInteractor` and `OrdersPresenter`. The Presenter keeps the transfers to resolve the `id` in `didSelectRow(at:)`.",
        },
        {
          kind: "write",
          prompt: "Router and Builder: `TransfersRouter` pushes the detail built with `TransferDetailBuilder.build(transferID:)`. `TransfersBuilder.build(repository:)` creates the use case and the four pieces, wires them and returns the View.",
          starter: swift`// Router
@MainActor
final class TransfersRouter: TransfersRouterInput {
}

// Builder
enum TransfersBuilder {
}`,
          checks: [
            { pattern: "weak\\s+var\\s+viewController", label: "`weak var viewController` in the Router" },
            { pattern: "TransferDetailBuilder\\.build\\(transferID:", label: "builds the detail with its Builder" },
            { pattern: "pushViewController\\(", label: "pushes the detail" },
            { pattern: "static\\s+func\\s+build", label: "`static func build` in the Builder" },
            { pattern: "DefaultFetchRecentTransfersUseCase\\(", label: "creates the use case" },
            { pattern: "view\\.presenter\\s*=\\s*presenter", label: "`view.presenter = presenter`" },
            { pattern: "presenter\\.view\\s*=\\s*view", label: "`presenter.view = view`" },
            { pattern: "interactor\\.output\\s*=\\s*presenter", label: "`interactor.output = presenter`" },
            { pattern: "router\\.viewController\\s*=\\s*view", label: "`router.viewController = view`" },
          ],
          warnings: [
            { pattern: "^\\s*var\\s+viewController", label: "strong `viewController`: View → Presenter → Router → View cycle" },
          ],
          solution: swift`// Router
@MainActor
final class TransfersRouter: TransfersRouterInput {
    weak var viewController: UIViewController?

    func showDetail(transferID: String) {
        let detail = TransferDetailBuilder.build(transferID: transferID)
        viewController?.navigationController?.pushViewController(detail, animated: true)
    }
}

// Builder
enum TransfersBuilder {
    @MainActor
    static func build(repository: any TransferRepository) -> UIViewController {
        let view = TransfersViewController()
        let useCase = DefaultFetchRecentTransfersUseCase(repository: repository)
        let interactor = TransfersInteractor(useCase: useCase)
        let router = TransfersRouter()
        let presenter = TransfersPresenter(interactor: interactor, router: router)

        view.presenter = presenter
        presenter.view = view
        interactor.output = presenter
        router.viewController = view
        return view
    }
}`,
          hint: "The Builder receives the repository from outside: that way the composition root decides whether it's remote, cached or a fake for UI tests.",
        },
        {
          kind: "write",
          prompt: "Tests: write a Presenter test (`viewDidLoad()` asks the Interactor for transfers, using a spy) and an Interactor test (with a use case stub and an output spy, awaiting the `task`).",
          starter: swift`import Testing
@testable import Transfers

// Spies and stubs

// Presenter tests

// Interactor tests
`,
          checks: [
            { pattern: "final\\s+class\\s+\\w+Spy", label: "at least one spy" },
            { pattern: "@Test", label: "tests with `@Test`" },
            { pattern: "#expect\\(", label: "asserts with `#expect`" },
            { pattern: "TransfersPresenter\\(", label: "tests the Presenter" },
            { pattern: "viewDidLoad\\(\\)", label: "fires `viewDidLoad()`" },
            { pattern: "TransfersInteractor\\(", label: "tests the Interactor" },
            { pattern: "await\\s+sut\\.task\\?\\.value", label: "awaits the Interactor's `Task`" },
          ],
          warnings: [
            { pattern: "Thread\\.sleep|Task\\.sleep", label: "waiting with sleep: slow and flaky test" },
            { pattern: "RemoteTransferRepository", label: "the test uses the real repository (network)" },
          ],
          solution: swift`import Testing
@testable import Transfers

// Spies and stubs
@MainActor
final class TransfersInteractorSpy: TransfersInteractorInput {
    private(set) var fetchCallCount = 0
    func fetchTransfers() { fetchCallCount += 1 }
}

@MainActor
final class TransfersRouterSpy: TransfersRouterInput {
    private(set) var shownIDs: [String] = []
    func showDetail(transferID: String) { shownIDs.append(transferID) }
}

@MainActor
final class TransfersOutputSpy: TransfersInteractorOutput {
    private(set) var fetched: [Transfer] = []
    private(set) var errors: [Error] = []
    func didFetch(_ transfers: [Transfer]) { fetched = transfers }
    func didFail(_ error: Error) { errors.append(error) }
}

struct FetchRecentTransfersUseCaseStub: FetchRecentTransfersUseCase {
    let result: Result<[Transfer], Error>
    func execute() async throws -> [Transfer] { try result.get() }
}

// Presenter tests
@MainActor
struct TransfersPresenterTests {
    @Test func viewDidLoadFetchesTransfers() {
        let interactor = TransfersInteractorSpy()
        let sut = TransfersPresenter(interactor: interactor, router: TransfersRouterSpy())

        sut.viewDidLoad()

        #expect(interactor.fetchCallCount == 1)
    }
}

// Interactor tests
@MainActor
struct TransfersInteractorTests {
    @Test func forwardsTransfersToOutput() async {
        let transfer = Transfer(id: "T1", amount: 100, status: .completed, date: .now)
        let sut = TransfersInteractor(useCase: FetchRecentTransfersUseCaseStub(result: .success([transfer])))
        let output = TransfersOutputSpy()
        sut.output = output

        sut.fetchTransfers()
        await sut.task?.value

        #expect(output.fetched == [transfer])
        #expect(output.errors.isEmpty)
    }
}`,
          hint: "Keep the output spy in a local variable: the Interactor holds it `weak`, and if nothing else retains it, it's released before receiving the call.",
        },
        {
          kind: "predict",
          prompt: "This shows up in the module's Presenter in a PR. What do you ask for in review?",
          code: swift`func didFetch(_ transfers: [Transfer]) {
    // Only premium users can see large amounts
    let visible = transfers.filter { $0.amount < 1_000_000 || isPremiumUser }
    self.transfers = visible
    view?.show(visible.map(makeRow))
}`,
          options: [
            "Nothing: the Presenter decides what gets shown",
            "Move it to the View, since that's what displays it",
            "Move it to the Router, since it depends on the user type",
            "Move it to the use case (or the domain): it's a business rule and the Presenter only formats",
          ],
          answer: 3,
          explanation: "Who can see which transfers is a business rule: it belongs in the use case (which gets the user type from a repository or service) with its own tests. In the Presenter it gets duplicated on every screen that lists transfers, and another client (widget, Apple Watch) would skip it. The View and the Router don't decide data.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-dependency-rule",
      front: "What does Clean Architecture's dependency rule say?",
      back: "Dependencies point inwards: Presentation and Data depend on Domain; Domain depends on nothing (no UIKit, no SwiftUI, no networking libraries). Just `Foundation`.",
    },
    {
      id: "fc-entity-vs-dto",
      front: "Entity vs DTO",
      back: "The DTO mirrors the backend JSON (names, `String`, cents) and lives in Data. The entity models the business (`enum`, `Decimal`) and lives in Domain. The DTO → entity mapper goes in Data.",
      code: swift`extension OrderDTO {
    func toDomain() -> Order { /* ... */ }
}`,
    },
    {
      id: "fc-dependency-inversion",
      front: "If Domain can't depend on Data, how does it get data?",
      back: "Domain declares the protocol (`OrderRepository`) and Data implements it. The composition root picks the concrete implementation and injects it.",
    },
    {
      id: "fc-use-case",
      front: "What is a use case?",
      back: "A type that represents a single business action, with an `execute` method, depending on repository protocols and holding the rules (filter, sort, validate).",
      code: swift`protocol FetchOrdersUseCase: Sendable {
    func execute() async throws -> [Order]
}`,
    },
    {
      id: "fc-repository-sources",
      front: "What does a repository with remote and local data sources do?",
      back: "It decides where data comes from: e.g. network first, save locally and, if the network fails, return the cache. If there's no cache either, it rethrows the original error.",
    },
    {
      id: "fc-business-rule-place",
      front: "Where does a business rule go?",
      back: "If it depends only on the entity's data, in the entity (`isCancellable`). If it orchestrates several things (validate + call the repository), in the use case. Never in the View, the Presenter or the repository.",
    },
    {
      id: "fc-viper-roles",
      front: "VIPER: what does each letter do?",
      back: "View: displays and forwards events. Interactor: the module's business logic (uses use cases). Presenter: turns entities into view models and coordinates. Entity: domain models. Router: navigation and module construction.",
    },
    {
      id: "fc-presenter",
      front: "What does the Presenter do, and what doesn't it do?",
      back: "Does: receive View events, ask the Interactor for data, format (`OrderRowViewModel`), ask the Router to navigate. Doesn't: import UIKit, talk to the network, decide business rules.",
    },
    {
      id: "fc-weak-refs",
      front: "In VIPER, which references are `weak`?",
      back: "The back references: Presenter → View, Interactor → Presenter (output) and Router → ViewController. The strong ones are View → Presenter → Interactor/Router.",
    },
    {
      id: "fc-anyobject",
      front: "Why `protocol OrdersViewInput: AnyObject`?",
      back: "Because the Presenter stores it as `weak var view`, and `weak` only applies to class references. Without `AnyObject` it doesn't compile.",
    },
    {
      id: "fc-builder",
      front: "What does a VIPER module's Builder (Assembly) do?",
      back: "Creates View, Interactor, Presenter and Router, wires the references (one strong, three `weak`), takes external dependencies and returns a `UIViewController`.",
    },
    {
      id: "fc-module-output",
      front: "How does a VIPER module send data back to whoever opened it?",
      back: "Through a module output protocol (`OrderFilterModuleOutput`) implemented by the parent module's Presenter and stored `weak` by the child Presenter. The Router passes it through the Builder.",
    },
    {
      id: "fc-spy-stub",
      front: "Spy vs stub",
      back: "A stub returns canned answers (the use case returning `.success([...])`). A spy records the calls it receives so you can assert on them (`fetchOrdersCallCount`, `shownOrderIDs`).",
    },
    {
      id: "fc-test-interactor-task",
      front: "How do you test an Interactor that fires a `Task`?",
      back: "Store the `Task` in `private(set) var task` and `await sut.task?.value` in the test before asserting. Never `Task.sleep`.",
    },
    {
      id: "fc-viper-overkill",
      front: "When are VIPER or Clean over-engineering?",
      back: "Simple screens with no rules (settings, forms), prototypes, small teams, new SwiftUI apps. Also use cases that just forward to the repository without adding anything.",
    },
  ],

  exam: [
    {
      id: "ex-router-leak",
      question: "In production, the Memory Graph shows that every time the user enters and leaves My orders, an `OrdersViewController` stays alive. What's the fix?",
      code: swift`final class OrdersRouter: OrdersRouterInput {
    var viewController: UIViewController?
}
// Builder: view.presenter = presenter; presenter.view = view (weak);
//          interactor.output = presenter (weak); router.viewController = view`,
      options: [
        "Make `presenter` `weak` in the View",
        "Make `viewController` `weak` in the Router",
        "Set `router.viewController = nil` in `viewWillAppear`",
        "Turn the Router into a `struct`",
      ],
      answer: 1,
      explanation: "The cycle is View → Presenter → Router → View. The Router → View back arrow must be `weak`. Making the Presenter `weak` in the View would release it immediately (nothing else holds it). Clearing by hand is fragile, and a `struct` can't hold `weak` nor fit the class-based `@MainActor` contracts.",
    },
    {
      id: "ex-domain-swiftui",
      question: "Someone added this to the entity to color the status in the list. The `Domain` target stopped building in the package shared with the widget. What do you do?",
      code: swift`import SwiftUI

extension OrderStatus {
    var color: Color { self == .shipped ? .green : .gray }
}`,
      options: [
        "Add SwiftUI as a dependency of `Domain`",
        "Swap `Color` for `UIColor` and import UIKit",
        "Pass the color as a hex `String` from the entity",
        "Move the status → color mapping to Presentation (Presenter or ViewModel); the entity only exposes the status",
      ],
      answer: 3,
      explanation: "How a status is painted is a presentation decision. Domain must not depend on UI frameworks, SwiftUI or UIKit. A hex string in the entity is the same thing in disguise: still a visual detail in Domain.",
    },
    {
      id: "ex-backend-rename",
      question: "The backend renamed `total_cents` to `amount_cents`. In an app with Clean done right, which files change?",
      options: [
        "Only the DTO (or its `CodingKeys`) and the mapper in Data",
        "The DTO, the `Order` entity and every Presenter that shows totals",
        "The use case and the repository",
        "Every Presenter test",
      ],
      answer: 0,
      explanation: "That's the reason to separate DTO and entity: the backend format stays encapsulated in Data. `Order.total` is unchanged, so use cases, Presenters and their tests never notice.",
    },
    {
      id: "ex-2fa-rule",
      question: "New rule: transfers above 10,000 require a second factor before confirming. Where do you implement it?",
      options: [
        "In the ViewController, showing the 2FA dialog based on the amount",
        "In the Presenter, before calling the Interactor",
        "In the transfer use case (or the entity), returning that 2FA is required so Presentation can ask for it",
        "In the repository, before the `POST`",
      ],
      answer: 2,
      explanation: "It's a business rule: it goes in Domain, tested on its own. The use case returns a result (e.g. `.requiresSecondFactor`) and the Presenter decides how to show it. In the View or Presenter another screen can bypass it; in the repository it gets mixed with data access.",
    },
    {
      id: "ex-passthrough-use-case",
      question: "In a review you see a use case whose `execute()` is just `try await repository.profile()`. What's the most reasonable senior response?",
      options: [
        "Block the PR: every data access must have its own use case",
        "Move it into the Presenter to reduce file count",
        "Acceptable if it's a team convention, but it adds nothing: you can inject the repository directly until a rule justifies a use case",
        "Replace it with a `ProfileService.shared` singleton",
      ],
      answer: 2,
      explanation: "A pass-through use case is ceremony: it protects no rule. Many teams accept it for consistency, but it's not mandatory. Moving it into the Presenter changes nothing, and the singleton hurts testability.",
    },
    {
      id: "ex-interactor-output",
      question: "Which line fixes the memory leak?",
      code: swift`@MainActor
final class OrdersInteractor: OrdersInteractorInput {
    var output: OrdersInteractorOutput?          // (1)
    private let useCase: any FetchOrdersUseCase  // (2)
}

@MainActor
final class OrdersPresenter {
    weak var view: OrdersViewInput?               // (3)
    private let interactor: OrdersInteractorInput // (4)
}`,
      options: [
        "(1) → `weak var output: OrdersInteractorOutput?`",
        "(2) → `weak var useCase`",
        "(3) → a strong `var view`",
        "(4) → `weak var interactor`",
      ],
      answer: 0,
      explanation: "Presenter → Interactor is strong (the Presenter owns it) and Interactor → Presenter is strong too: a cycle. The back arrow, the output, must be `weak`. Making the interactor `weak` would release it because nothing else holds it; `useCase` can be a struct and isn't part of the cycle.",
    },
    {
      id: "ex-weak-protocol",
      question: "Why doesn't this compile?",
      code: swift`protocol OrdersViewInput {
    func show(_ rows: [OrderRowViewModel])
}

final class OrdersPresenter {
    weak var view: OrdersViewInput?
}`,
      options: [
        "The protocol is missing `@MainActor`",
        "A Presenter can't have optional properties",
        "`weak` requires `private`",
        "`weak` only applies to class types and the protocol isn't constrained with `AnyObject`",
      ],
      answer: 3,
      explanation: "Error: `weak` must not be applied to non-class-bound `OrdersViewInput`. Fix it with `protocol OrdersViewInput: AnyObject`. `@MainActor` is recommended in Swift 6 but isn't the cause of this error.",
    },
    {
      id: "ex-uikit-imports",
      question: "In a well-separated VIPER module, which components import UIKit?",
      options: [
        "All of them, since it's a UIKit app",
        "The View and the Router (and the Builder that assembles them)",
        "The Presenter and the View",
        "Only the Interactor, to handle the main thread",
      ],
      answer: 1,
      explanation: "The View displays and the Router presents or pushes controllers: both need UIKit. The Builder returns a `UIViewController`. Presenter and Interactor stay pure Swift so they're testable without UIKit.",
    },
    {
      id: "ex-test-double",
      question: "You want to verify that after `didFetch` with two orders, the Presenter passed two rows to the View. Which test double do you use for the View?",
      options: [
        "A spy that records the rows `show(_:)` receives",
        "A stub that returns fixed rows",
        "The real `OrdersViewController` loaded from the storyboard",
        "None: check it by looking at the UI in a snapshot test",
      ],
      answer: 0,
      explanation: "You're checking an outgoing call and its arguments: that's a spy. A stub provides answers, it doesn't record. The real controller drags UIKit into the test, and a snapshot test checks pixels, not the Presenter's contract.",
    },
    {
      id: "ex-flaky-interactor-test",
      question: "This test fails now and then on CI. What's the best fix?",
      code: swift`@Test func forwardsOrders() async throws {
    let sut = OrdersInteractor(useCase: stub)
    sut.output = spy
    sut.fetchOrders()
    try await Task.sleep(for: .milliseconds(100))
    #expect(spy.fetched.count == 2)
}`,
      options: [
        "Bump the sleep to 1 second",
        "Mark the test `.disabled` on CI",
        "Expose the Interactor's `Task` and `await sut.task?.value` instead of sleeping",
        "Run the tests serially",
      ],
      answer: 2,
      explanation: "The sleep bets that the `Task` finishes in time; on a slow runner it loses. Awaiting the actual `Task` is deterministic and fast. A longer sleep just makes the test slower and it's still a bet.",
    },
    {
      id: "ex-migration-survives",
      question: "You're migrating a VIPER module to MVVM with SwiftUI. What stays essentially untouched?",
      options: [
        "The Presenter, renamed to ViewModel with no changes",
        "The use cases and repositories",
        "The Router, which keeps pushing from the View",
        "The `ViewInput`/`ViewOutput` contracts",
      ],
      answer: 1,
      explanation: "Domain and Data don't depend on the presentation layer, so they survive intact: that's Clean's payoff. Presenter and Interactor merge into the ViewModel, the Router becomes a coordinator or closure, and the View ↔ Presenter contracts disappear.",
    },
    {
      id: "ex-data-back",
      question: "The Edit address module must tell Checkout the new address when the user saves. How do you solve it in VIPER?",
      options: [
        "The Edit Interactor writes to `UserDefaults` and Checkout re-reads it in `viewWillAppear`",
        "Checkout passes its Presenter to the Edit Builder as a strong reference",
        "A `NotificationCenter.default.post` with the address in `userInfo`",
        "An `EditAddressModuleOutput` protocol implemented by the Checkout Presenter; the Router hands it to the Edit Builder and its Presenter stores it `weak`",
      ],
      answer: 3,
      explanation: "The module output is explicit, typed, testable with a spy and creates no cycles since it's `weak`. `UserDefaults` and notifications are implicit channels that are hard to trace, and passing the Presenter strongly couples the modules and can keep them alive too long.",
    },
  ],
};

export default content;
