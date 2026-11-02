import type { CourseContent } from "../types";

const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "clean-layers",
      title: "Clean Architecture en iOS: capas y regla de dependencias",
      goal: "Separar Presentation, Domain y Data, respetar la regla de dependencias y mapear DTOs a entidades.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Tres capas y una regla",
          body: [
            "Clean Architecture en iOS se reduce a tres capas: **Presentation** (vistas, ViewModels o Presenters), **Domain** (entidades, casos de uso y protocolos de repositorio) y **Data** (cliente HTTP, DTOs, Core Data o SwiftData, implementaciones de repositorio).",
            "La regla de dependencias: los `import` y las referencias apuntan siempre hacia adentro. Presentation conoce Domain, Data conoce Domain, y Domain no conoce a nadie: ni UIKit, ni SwiftUI, ni `URLSession`, ni Alamofire.",
            "En un proyecto real se nota en el `Package.swift` o en los targets: `Domain` compila solo con `Foundation`. Si en un PR aparece `import UIKit` en un caso de uso, es una violación y se marca en el review.",
          ],
          code: swift`// Package.swift (recortado)
targets: [
    .target(name: "Domain"),                                    // sin dependencias
    .target(name: "Data", dependencies: ["Domain"]),            // implementa protocolos de Domain
    .target(name: "Presentation", dependencies: ["Domain"]),    // usa casos de uso
    .target(name: "App", dependencies: ["Presentation", "Data"]) // composition root: une todo
]`,
        },
        {
          kind: "predict",
          prompt: "Revisando un PR, ¿qué archivo rompe la regla de dependencias?",
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
            "`Order.swift`, porque usa `Decimal` de Foundation",
            "`FetchOrdersUseCase.swift`, porque un protocolo de dominio no puede ser `async`",
            "`OrderRepository.swift`, porque Domain importa una librería de red",
            "`RemoteOrderRepository.swift`, porque Data no puede importar Alamofire",
          ],
          answer: 2,
          explanation: "Foundation es aceptable en Domain (tipos como `Decimal`, `Date`, `URL`). Que el protocolo sea `async` tampoco es problema. Lo que rompe la regla es `import Alamofire` en Domain: el dominio quedaría atado a un detalle de infraestructura. Data sí puede importar Alamofire, porque es justamente la capa de los detalles.",
        },
        {
          kind: "explain",
          title: "Entidades vs DTOs",
          body: [
            "Un **DTO** refleja el JSON tal cual lo manda el backend: nombres del servidor, estados como `String`, montos en centavos. Una **entidad** es lo que entiende el negocio: un `enum` de estados, un `Decimal` para el total.",
            "El mapeo DTO → entidad vive en Data. Si mañana el backend renombra un campo o cambia el formato, cambiás el DTO y el mapper; ni los casos de uso ni las pantallas se enteran.",
            "Fijate el `?? .unknown`: un estado nuevo del backend no tiene que tirar abajo la app ni hacer desaparecer el pedido.",
          ],
          code: swift`// Data: refleja el JSON tal cual viene
struct OrderDTO: Decodable {
    let id: String
    let totalCents: Int
    let status: String
}

// Domain: lo que entiende el negocio
enum OrderStatus: String { case pending, shipped, cancelled, unknown }

struct Order: Equatable {
    let id: String
    let total: Decimal
    let status: OrderStatus
}

// Data: el mapper
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
          prompt: "El backend agregó un estado nuevo (`returned`) que la app todavía no conoce. Completá el mapper para que el pedido no se pierda ni crashee nada.",
          code: swift`extension OrderDTO {
    func toDomain() -> Order {
        Order(id: id,
              total: Decimal(totalCents) / 100,
              status: OrderStatus(rawValue: status) ?? ____)
    }
}`,
          accept: ["^\\.unknown$", "^OrderStatus\\.unknown$"],
          explanation: "`OrderStatus(rawValue:)` devuelve `nil` para `returned`. Con `?? .unknown` el pedido sigue en la lista con un estado neutro, y la UI puede mostrar algo genérico hasta que se actualice la app.",
          placeholder: ".caso",
        },
        {
          kind: "explain",
          title: "Inversión de dependencias: el protocolo vive en Domain",
          body: [
            "Domain necesita pedidos, pero no puede depender de Data. La salida: Domain **declara** el protocolo `OrderRepository` y Data lo **implementa**. La flecha de dependencia queda de Data hacia Domain, aunque en runtime Domain llame a código de Data.",
            "Quién elige la implementación concreta es la composition root (el target `App`, el `SceneDelegate` o un contenedor de dependencias). Es el único lugar que conoce las dos capas.",
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
          prompt: "Escribí el protocolo de dominio `ProductRepository` (un método `async throws` que devuelve `[Product]`) y la implementación de Data `RemoteProductRepository`, que decodifica `[ProductDTO]` y los mapea con `toDomain()`. El protocolo no puede exponer DTOs.",
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
            { pattern: "protocol\\s+ProductRepository", label: "protocolo `ProductRepository` en Domain" },
            { pattern: "async\\s+throws\\s*->\\s*\\[Product\\]", label: "devuelve `[Product]` con `async throws`" },
            { pattern: "RemoteProductRepository\\s*:\\s*ProductRepository", label: "`RemoteProductRepository` conforma el protocolo" },
            { pattern: "decode\\(\\[ProductDTO\\]\\.self", label: "decodifica `[ProductDTO]`" },
            { pattern: "\\.map\\b", label: "mapea DTOs a entidades" },
          ],
          warnings: [
            { pattern: "->\\s*\\[ProductDTO\\]", label: "un DTO se filtra fuera de Data (`-> [ProductDTO]`)" },
            { pattern: "import\\s+UIKit", label: "ni Domain ni Data necesitan UIKit" },
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
          hint: "El DTO solo aparece dentro de la implementación; la firma del protocolo habla en entidades.",
        },
        {
          kind: "predict",
          prompt: "¿Dónde debería vivir `toDomain()`?",
          code: swift`// Domain/Order.swift
struct Order { let id: String; let total: Decimal; let status: OrderStatus }

// Data/OrderDTO.swift
struct OrderDTO: Decodable { let id: String; let totalCents: Int; let status: String }

// ¿En qué capa va esto?
func toDomain() -> Order`,
          options: [
            "En Data, junto al DTO: Domain no tiene que saber que existe un JSON",
            "En Domain, como `init(dto: OrderDTO)` de `Order`",
            "En Presentation, en el Presenter o ViewModel antes de mostrar",
            "En la View, justo antes de configurar la celda",
          ],
          answer: 0,
          explanation: "Si `Order` tuviera un `init(dto:)`, Domain dependería de `OrderDTO`, que es de Data: se invierte la flecha. Presentation y View no deberían ver DTOs nunca. El mapper va en Data, que conoce ambos tipos.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "use-cases-repositories",
      title: "Casos de uso y repositorios",
      goal: "Escribir casos de uso con reglas de negocio, repositorios con data sources remoto y local, y saber dónde va cada regla.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Un caso de uso = una acción del negocio",
          body: [
            "Un caso de uso (use case, a veces llamado interactor en Clean puro) representa **una** acción: traer pedidos, cancelar un pedido, transferir dinero. Expone un solo método, típicamente `execute`, y depende de protocolos de repositorio.",
            "Ahí viven las reglas que no son de UI: qué pedidos se muestran, en qué orden, qué validaciones hay antes de llamar al backend. El Presenter o ViewModel solo formatea lo que el caso de uso devuelve.",
            "En Swift 6 marcamos los protocolos `Sendable`: el Presenter los llama desde el main actor y el trabajo corre fuera de él.",
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
        // Regla de negocio: no se muestran las canceladas y van primero las más caras
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
          prompt: "Alguien cambió la regla del caso de uso. Con el mismo `InMemoryOrderRepository`, ¿qué imprime?",
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
          explanation: "A pasa por `pending`. B no es `pending`, pero `50 >= 30` es verdadero, así que se cuela una cancelada. C pasa porque `30 >= 30`. Sin `sorted`, se mantiene el orden del repositorio: `[\"A\", \"B\", \"C\"]`. Por eso las reglas van en el caso de uso con tests propios: un `||` mal puesto se detecta ahí y no en producción.",
        },
        {
          kind: "explain",
          title: "Repositorio con data sources remoto y local",
          body: [
            "El repositorio decide **de dónde** salen los datos: red, caché, base local. El caso de uso no sabe ni le importa. Adentro, el repositorio coordina data sources más chicos: uno remoto que devuelve DTOs y uno local que persiste entidades.",
            "Una política común en apps de banco o e-commerce: red primero, guardar lo que llegó y, si la red falla, devolver lo cacheado. Si tampoco hay caché, se relanza el error original para que la pantalla muestre un estado de error real.",
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
          prompt: "La red falla con `URLError(.notConnectedToInternet)` y `local.load()` devuelve `[]`. ¿Qué pasa al llamar `orders()`?",
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
            "Devuelve `[]` y la pantalla muestra la lista vacía",
            "Crashea porque el error no se maneja",
            "Devuelve `nil`",
            "Lanza el `URLError` original y el Presenter puede mostrar un error",
          ],
          answer: 3,
          explanation: "El `catch` atrapa el `URLError`, consulta la caché y la encuentra vacía, así que ejecuta `throw error` con el error original. La función es `throws`, así que el error sube al caso de uso y de ahí al Presenter. Devolver `[]` mentiría: el usuario vería que no tiene pedidos cuando en realidad no hay conexión.",
        },
        {
          kind: "explain",
          title: "Dónde viven las reglas de negocio",
          body: [
            "Regla nueva: un pedido se puede cancelar si está `pending` y el total no supera 500 (los grandes pasan por soporte). ¿Dónde va? No en el ViewController ni en el Presenter: se duplicaría en cada pantalla que muestre el botón. Tampoco en el repositorio: su trabajo es acceder a datos.",
            "Si la regla depende solo de los datos de la entidad, va **en la entidad**. Si orquesta varias cosas (validar, llamar al repositorio, registrar un evento), va en el **caso de uso**, que usa la regla de la entidad.",
          ],
          code: swift`extension Order {   // regla sobre sus propios datos: vive en la entidad
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
          prompt: "Completá la firma de `cancel` en el protocolo del repositorio: llama al backend y puede fallar.",
          code: swift`protocol OrderRepository: Sendable {
    func orders() async throws -> [Order]
    func cancel(orderID: String) ____
}`,
          accept: ["^async throws$"],
          explanation: "Cancelar es una llamada de red que puede fallar: `async throws`. El orden importa: Swift exige `async` antes de `throws`.",
          placeholder: "async ...",
        },
        {
          kind: "write",
          prompt: "Implementá `execute` de `DefaultCancelOrderUseCase`: si el pedido no es cancelable (usá `isCancellable`), lanzá `CancelOrderError.notCancellable`; si lo es, llamá a `repository.cancel(orderID:)`.",
          starter: swift`enum CancelOrderError: Error { case notCancellable }

protocol CancelOrderUseCase: Sendable {
    func execute(_ order: Order) async throws
}

struct DefaultCancelOrderUseCase: CancelOrderUseCase {
    let repository: any OrderRepository

    func execute(_ order: Order) async throws {
        // tu código
    }
}`,
          checks: [
            { pattern: "isCancellable", label: "usa la regla de la entidad (`isCancellable`)" },
            { pattern: "throw\\s+CancelOrderError\\.notCancellable", label: "lanza `CancelOrderError.notCancellable`" },
            { pattern: "try\\s+await\\s+repository\\.cancel\\(orderID:", label: "llama a `try await repository.cancel(orderID:)`" },
          ],
          warnings: [
            { pattern: "URLSession", label: "el caso de uso no habla con la red: eso es del repositorio" },
            { pattern: "import\\s+UIKit", label: "Domain no importa UIKit" },
            { pattern: "status\\s*==\\s*\\.pending", label: "duplicás la regla en vez de usar `isCancellable`" },
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
          hint: "Un `guard ... else { throw ... }` y después la llamada al repositorio.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "viper-components",
      title: "Los componentes de VIPER y sus contratos",
      goal: "Saber qué hace View, Interactor, Presenter, Entity y Router, cómo se hablan por protocolos y quién retiene a quién.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "V, I, P, E, R",
          body: [
            "**View**: un `UIViewController` pasivo. Muestra lo que le dicen y reenvía eventos (`viewDidLoad`, taps). **Interactor**: la lógica de negocio del módulo; en VIPER + Clean suele delegar en casos de uso. **Presenter**: el centro del módulo; recibe eventos de la View, le pide datos al Interactor, convierte entidades en view models y le pide navegación al Router.",
            "**Entity**: los modelos de dominio (`Order`). **Router** (o Wireframe): navega y construye el módulo siguiente. Es el único, junto con la View, que toca UIKit.",
            "Lo más útil para leer un módulo VIPER ajeno es seguir el flujo de una acción de punta a punta.",
          ],
          code: swift`// Flujo de "el usuario abre Mis pedidos"
// View        -> presenter.viewDidLoad()
// Presenter   -> interactor.fetchOrders()
// Interactor  -> try await useCase.execute()        // Entity: [Order]
// Interactor  -> output?.didFetch(orders)
// Presenter   -> view?.show(rows)                   // [OrderRowViewModel]
// View        -> tableView.reloadData()
//
// Tap en una fila
// View        -> presenter.didSelectRow(at: 2)
// Presenter   -> router.showDetail(orderID: "C")`,
        },
        {
          kind: "predict",
          prompt: "Hay que mostrar el total como `$19,99` y la fecha como `hace 5 min`. ¿Quién arma esos strings?",
          code: swift`struct OrderRowViewModel: Equatable {
    let title: String
    let subtitle: String   // "$19,99 · hace 5 min"
}`,
          options: [
            "La View, en `tableView(_:cellForRowAt:)`",
            "El Presenter, al convertir `Order` en `OrderRowViewModel`",
            "El Interactor, antes de llamar a `didFetch`",
            "La Entity, con una propiedad `formattedTotal`",
          ],
          answer: 1,
          explanation: "Formatear para mostrar es lógica de presentación: le toca al Presenter. Así se testea sin UIKit (comparás `OrderRowViewModel` con `==`). La View solo asigna strings a labels; el Interactor y la Entity no saben cómo se ve la pantalla.",
        },
        {
          kind: "explain",
          title: "Los contratos: un protocolo por flecha",
          body: [
            "Cada flecha entre componentes es un protocolo. Eso permite reemplazar cualquier pieza por un spy en los tests. Los nombres varían según el equipo (`ViewInput`/`ViewOutput`, `PresenterToView`, `ViewToPresenter`); lo importante es que estén todos juntos en un archivo `OrdersContracts.swift`.",
            "Los protocolos que se guardan como `weak` (la View y el output del Interactor) tienen que estar restringidos a clases con `AnyObject`. Y como todo el módulo trabaja con UI, en Swift 6 se marcan `@MainActor`.",
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
          prompt: "El Presenter guarda la View como `weak var view: OrdersViewInput?`. Completá el protocolo para que eso compile.",
          code: swift`@MainActor
protocol OrdersViewInput: ____ {
    func show(_ rows: [OrderRowViewModel])
    func showError(_ message: String)
}`,
          accept: ["^AnyObject$"],
          explanation: "`weak` solo se aplica a referencias de clase. Sin `AnyObject`, el compilador no sabe si un struct podría conformar el protocolo y rechaza el `weak`. (`class` como restricción es la forma vieja, hoy se usa `AnyObject`).",
        },
        {
          kind: "explain",
          title: "Quién retiene a quién",
          body: [
            "El módulo vive mientras su View esté en pantalla. La View retiene fuerte al Presenter; el Presenter retiene fuerte al Interactor y al Router. Todas las referencias de vuelta son `weak`: Presenter → View, Interactor → Presenter (output) y Router → ViewController.",
            "Cuando el navigation controller hace pop, suelta la View, la View suelta al Presenter y cae todo el módulo en cadena. Si una sola flecha de vuelta queda fuerte, se arma un ciclo y el módulo entero queda en memoria.",
          ],
          code: swift`// navigationController ──► View ──► Presenter ──► Interactor
//                                     │  ▲            │
//                                     │  └── weak ────┘ (output)
//                                     └──► Router
// Presenter ── weak ──► View
// Router    ── weak ──► View (como UIViewController)

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
          prompt: "¿Qué imprime?",
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
print("fin")`,
          options: [
            "`Presenter deinit`, `Interactor deinit` y `fin`",
            "`Interactor deinit`, `Presenter deinit` y `fin`",
            "Solo `fin`: el ciclo Presenter ↔ Interactor nunca se libera",
            "No compila: falta `weak`",
          ],
          answer: 2,
          explanation: "Al salir del `do`, las variables locales sueltan sus referencias, pero el Presenter retiene al Interactor y el Interactor retiene al Presenter con `var output` fuerte. Ninguno llega a cero, no corre ningún `deinit` y solo se imprime `fin`. Compila sin problemas: `weak` es una decisión tuya, el compilador no la exige. La solución es `weak var output`.",
        },
        {
          kind: "write",
          prompt: "Escribí `OrdersPresenter`: conforma `OrdersViewOutput` y `OrdersInteractorOutput`, guarda la View como `weak`, pide los pedidos en `viewDidLoad()`, en `didFetch` arma `OrderRowViewModel(title:subtitle:)` y llama a `view?.show`, en `didFail` muestra un error, y en `didSelectRow(at:)` navega con `router.showDetail(orderID:)`.",
          starter: swift`@MainActor
final class OrdersPresenter {
    // propiedades

    init(interactor: OrdersInteractorInput, router: OrdersRouterInput) {
        // ...
    }
}`,
          checks: [
            { pattern: "weak\\s+var\\s+view\\s*:\\s*OrdersViewInput\\?", label: "`weak var view: OrdersViewInput?`" },
            { pattern: "OrdersViewOutput", label: "conforma `OrdersViewOutput`" },
            { pattern: "OrdersInteractorOutput", label: "conforma `OrdersInteractorOutput`" },
            { pattern: "interactor\\.fetchOrders\\(\\)", label: "`viewDidLoad` llama a `interactor.fetchOrders()`" },
            { pattern: "view\\?\\.show\\(", label: "le pasa las filas a `view?.show`" },
            { pattern: "router\\.showDetail\\(orderID:", label: "navega con `router.showDetail(orderID:)`" },
          ],
          warnings: [
            { pattern: "^\\s*var\\s+view\\s*:", label: "la View retenida fuerte arma un ciclo" },
            { pattern: "import\\s+UIKit", label: "el Presenter no necesita UIKit" },
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
            OrderRowViewModel(title: "Pedido \($0.id)", subtitle: "$\($0.total)")
        })
    }

    func didFail(_ error: Error) {
        view?.showError("No pudimos cargar tus pedidos")
    }
}`,
          hint: "Guardá los pedidos en una propiedad privada: `didSelectRow(at:)` necesita el `id` del pedido de esa fila.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "viper-wiring",
      title: "Armar un módulo VIPER: builder, router y datos entre módulos",
      goal: "Ensamblar un módulo con su builder, navegar con el router, pasar datos de ida y vuelta y no dejar ciclos de retención.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "El Builder (o Assembly)",
          body: [
            "Alguien tiene que crear las cinco piezas y conectarlas. Ese es el Builder: un `enum` con un `static func build(...)` que recibe las dependencias externas (repositorio, parámetros de entrada) y devuelve un `UIViewController` listo para presentar.",
            "El orden importa poco; lo que importa es que cada referencia quede del tipo correcto: la View retiene al Presenter (fuerte) y todas las flechas de vuelta son `weak`. Como nadie más retiene el módulo, su dueño real es el navigation controller.",
          ],
          code: swift`final class OrdersViewController: UIViewController, OrdersViewInput {
    var presenter: OrdersViewOutput!            // fuerte: la View sostiene el módulo

    override func viewDidLoad() {
        super.viewDidLoad()
        presenter.viewDidLoad()
    }
    func show(_ rows: [OrderRowViewModel]) { /* reloadData */ }
    func showError(_ message: String) { /* alerta */ }
}

enum OrdersBuilder {
    @MainActor
    static func build(repository: any OrderRepository) -> UIViewController {
        let view = OrdersViewController()
        let interactor = OrdersInteractor(useCase: DefaultFetchOrdersUseCase(repository: repository))
        let router = OrdersRouter()
        let presenter = OrdersPresenter(interactor: interactor, router: router)

        view.presenter = presenter      // fuerte
        presenter.view = view           // weak
        interactor.output = presenter   // weak
        router.viewController = view    // weak
        return view
    }
}`,
        },
        {
          kind: "write",
          prompt: "Escribí `ProfileBuilder.build(userID:repository:)`: creá `ProfileInteractor(userID:useCase:)` con un `DefaultFetchUserUseCase(repository:)`, `ProfileRouter()` y `ProfilePresenter(interactor:router:)`, conectá todas las referencias y devolvé la View.",
          starter: swift`enum ProfileBuilder {
    @MainActor
    static func build(userID: String, repository: any UserRepository) -> UIViewController {
        let view = ProfileViewController()
        // ...
    }
}`,
          checks: [
            { pattern: "ProfileInteractor\\(", label: "crea el Interactor" },
            { pattern: "ProfileRouter\\(", label: "crea el Router" },
            { pattern: "ProfilePresenter\\(", label: "crea el Presenter" },
            { pattern: "view\\.presenter\\s*=\\s*presenter", label: "`view.presenter = presenter`" },
            { pattern: "presenter\\.view\\s*=\\s*view", label: "`presenter.view = view`" },
            { pattern: "interactor\\.output\\s*=\\s*presenter", label: "`interactor.output = presenter`" },
            { pattern: "router\\.viewController\\s*=\\s*view", label: "`router.viewController = view`" },
            { pattern: "return\\s+view", label: "devuelve la View" },
          ],
          warnings: [
            { pattern: "presenter\\.view\\s*=\\s*ProfileViewController\\(\\)", label: "el Presenter apunta a otra instancia de la View" },
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
          hint: "Son cuatro asignaciones de cableado: una fuerte (View → Presenter) y tres `weak` de vuelta.",
        },
        {
          kind: "explain",
          title: "El Router navega y arma el módulo siguiente",
          body: [
            "El Router recibe pedidos de navegación del Presenter en términos de negocio (`showDetail(orderID:)`) y los traduce a UIKit: llama al Builder del módulo destino y hace push o present desde su `viewController`.",
            "Los datos de ida viajan como parámetros del Builder: pasá un ID o una entidad, nunca el Presenter ni el Interactor del módulo anterior. Así cada módulo se puede construir y testear solo.",
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
          prompt: "Completá el método de UIKit que agrega el detalle a la pila de navegación.",
          code: swift`func showDetail(orderID: String) {
    let detail = OrderDetailBuilder.build(orderID: orderID)
    viewController?.navigationController?.____(detail, animated: true)
}`,
          accept: ["^pushViewController$"],
          explanation: "`pushViewController(_:animated:)` agrega el controller a la pila del `UINavigationController`. Desde ese momento, el navigation controller es el dueño del módulo de detalle.",
          placeholder: "push...",
        },
        {
          kind: "predict",
          prompt: "Con este Router, el usuario entra a Mis pedidos y vuelve atrás. ¿Qué se libera?",
          code: swift`@MainActor
final class OrdersRouter: OrdersRouterInput {
    var viewController: UIViewController?      // sin weak
    // ...
}

// Builder
view.presenter = presenter       // fuerte
presenter.view = view            // weak
interactor.output = presenter    // weak
router.viewController = view     // fuerte (por el Router)`,
          options: [
            "Todo: el navigation controller era el único dueño",
            "Solo la View; Presenter y Router quedan vivos",
            "Solo el Router",
            "Nada: View → Presenter → Router → View es un ciclo y el módulo entero queda en memoria",
          ],
          answer: 3,
          explanation: "La View retiene al Presenter, el Presenter al Router y el Router a la View: un ciclo de tres. Cuando el navigation controller suelta la View, a cada objeto todavía lo retiene otro, así que no se libera nada (ni el Interactor, que cuelga del Presenter). En el Memory Graph de Xcode se ve el ciclo; la solución es `weak var viewController`.",
        },
        {
          kind: "explain",
          title: "Devolver datos: el module output",
          body: [
            "Para la vuelta (el usuario elige un filtro y la lista se actualiza) se usa un protocolo de salida del módulo: `OrderFilterModuleOutput`. Lo implementa el Presenter de Pedidos, y el Presenter de Filtro lo guarda como `weak`.",
            "El Router de Pedidos se lo pasa al Builder de Filtro. Nada de `NotificationCenter` ni singletons: el contrato queda explícito, tipado y testeable con un spy.",
          ],
          code: swift`@MainActor
protocol OrderFilterModuleOutput: AnyObject {
    func orderFilter(didSelect status: OrderStatus?)
}

// Router de Pedidos
func showFilter(selected: OrderStatus?, output: OrderFilterModuleOutput) {
    let filter = OrderFilterBuilder.build(selected: selected, output: output)
    viewController?.present(filter, animated: true)
}

// Presenter de Filtro
weak var moduleOutput: OrderFilterModuleOutput?

func didTapApply() {
    moduleOutput?.orderFilter(didSelect: selected)
    router.dismiss()
}

// Presenter de Pedidos
extension OrdersPresenter: OrderFilterModuleOutput {
    func orderFilter(didSelect status: OrderStatus?) {
        interactor.fetchOrders(status: status)   // el contrato suma un filtro opcional
    }
}`,
        },
        {
          kind: "predict",
          prompt: "El módulo Filtro tiene que avisarle a Pedidos qué estado eligió el usuario. ¿Cuál es la mejor opción en VIPER?",
          code: swift`// Pedidos presenta Filtro en forma modal.
// En Filtro, el usuario toca "Enviados" y "Aplicar".
// Pedidos tiene que recargar solo los enviados.`,
          options: [
            "Un protocolo `OrderFilterModuleOutput` que implementa el Presenter de Pedidos y el Presenter de Filtro guarda como `weak`",
            "Postear una `Notification` y que el Interactor de Pedidos la escuche",
            "Guardar el filtro en un singleton `FilterStore.shared` y releerlo en `viewWillAppear`",
            "Que el Presenter de Filtro tenga una referencia fuerte al Presenter de Pedidos",
          ],
          answer: 0,
          explanation: "El module output deja el contrato explícito y tipado, se testea con un spy y, al ser `weak`, no arma ciclos. La notificación es implícita y difícil de rastrear; el singleton agrega estado global y depende del ciclo de vida de la vista; la referencia fuerte entre Presenters puede retener módulos de más.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "viper-testing-tradeoffs",
      title: "Tests de VIPER y trade-offs",
      goal: "Testear Presenter e Interactor con spies, medir el costo real de VIPER y Clean, y migrar un módulo a MVVM.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Testear el Presenter con spies",
          body: [
            "Un **spy** es un doble de test que registra las llamadas que recibe para verificarlas después. Como el Presenter solo habla con protocolos, se testea sin UIKit, sin red y en milisegundos.",
            "La estructura es siempre la misma: armar el Presenter con spies, disparar un evento (`viewDidLoad()`, `didFetch`, `didSelectRow(at:)`) y verificar qué llamadas salieron hacia la View, el Interactor o el Router. Acá con Swift Testing; con XCTest es igual cambiando `#expect` por `XCTAssertEqual`.",
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
          prompt: "Con el `OrdersPresenter` de la lección anterior, ¿qué imprime?",
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
          explanation: "`didFetch` con dos pedidos llama a `show` con dos filas: `show(2)`. `didFail` llama a `showError`: `error`. Después `sut.view = nil`, así que el último `didFetch` hace `view?.show(...)` sobre `nil` y no registra nada. Resultado: `[\"show(2)\", \"error\"]`.",
        },
        {
          kind: "write",
          prompt: "Escribí un test que verifique que al tocar la segunda fila el Presenter navega al detalle de ese pedido. Usá `RouterSpy` y su `shownOrderIDs`. Ojo: el Presenter necesita pedidos cargados antes del tap.",
          starter: swift`@MainActor
struct OrdersPresenterNavigationTests {
    @Test func selectingRowShowsDetail() {
        // Arrange

        // Act

        // Assert
    }
}`,
          checks: [
            { pattern: "RouterSpy\\(\\)", label: "usa `RouterSpy`" },
            { pattern: "didFetch\\(", label: "carga pedidos con `didFetch` antes del tap" },
            { pattern: "didSelectRow\\(at:\\s*1\\)", label: "toca la segunda fila (`didSelectRow(at: 1)`)" },
            { pattern: "#expect\\(|XCTAssert", label: "verifica con `#expect` o `XCTAssert`" },
            { pattern: "shownOrderIDs", label: "revisa `shownOrderIDs` del spy" },
          ],
          warnings: [
            { pattern: "OrdersRouter\\(\\)", label: "usás el Router real: el test depende de UIKit" },
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
          hint: "Sin `didFetch` previo, `orders[1]` se sale de rango y el test crashea.",
        },
        {
          kind: "explain",
          title: "Testear el Interactor: guardá el Task",
          body: [
            "El Interactor dispara un `Task` y vuelve enseguida, así que el test no tiene qué esperar. La salida prolija: guardar el `Task` en `private(set) var task` y en el test hacer `await sut.task?.value`. Nada de `Task.sleep`: es lento y flaky en CI.",
            "El caso de uso se reemplaza por un **stub** (devuelve una respuesta fija) y el output por un spy. Así probás los dos caminos: éxito y error.",
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
          title: "El costo: archivos y ceremonia",
          body: [
            "Un módulo VIPER completo son 6 a 9 archivos y unos 5 protocolos por pantalla, más los spies. En un equipo grande de banco, con reglas complejas, muchas personas tocando la misma feature y política de cobertura estricta, esa separación se paga sola: cada pieza tiene un dueño claro y los PRs no se pisan.",
            "En una pantalla de Ajustes con cuatro toggles es pura ceremonia. VIPER además encaja mal con SwiftUI: la View es un struct, no se puede guardar `weak`, y el flujo de datos de SwiftUI ya cubre lo que hacía el Presenter.",
            "Con Clean pasa algo parecido: un caso de uso que solo hace `return try await repository.orders()` no aporta nada. Agregalo cuando haya una regla que proteger, no por simetría.",
          ],
          code: swift`Orders/
├── OrdersContracts.swift       // 5 protocolos
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
          prompt: "Equipo de 3 personas, app nueva en SwiftUI. La pantalla es Ajustes: 4 toggles guardados en `UserDefaults`, sin reglas de negocio. Alguien propone VIPER + Clean con un caso de uso por toggle. ¿Qué respondés en el review?",
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
            "Aprobado: toda pantalla tiene que tener todas las capas para ser consistente",
            "Un MVVM simple (`@Observable` o `ObservableObject`) con un repositorio chico de ajustes; acá VIPER es ceremonia sin beneficio",
            "Hacerla en UIKit para que VIPER encaje mejor",
            "Ponerlo todo en la View sin ninguna abstracción, aunque después haya que testearlo",
          ],
          answer: 1,
          explanation: "No hay reglas de negocio ni navegación compleja, y VIPER pelea con SwiftUI. Un ViewModel con un repositorio inyectado se testea igual de bien con la mitad de archivos. Cambiar de framework para encajar en una arquitectura es al revés de lo que corresponde, y meter `UserDefaults` directo en la View lo vuelve difícil de testear.",
        },
        {
          kind: "explain",
          title: "Migrar VIPER → MVVM sin romper todo",
          body: [
            "Un módulo por vez. El Presenter y el Interactor se funden en un ViewModel; los casos de uso y repositorios no se tocan: ahí se nota que Clean valió la pena. El Router pasa a ser un Coordinator o un closure de navegación.",
            "El Builder sigue devolviendo `UIViewController` (ahora un `UIHostingController`), así que el resto de la app ni se entera. Los tests del Presenter pasan a ser tests del ViewModel con un stub del caso de uso.",
            "El camino inverso también existe: cuando un ViewModel pasa las 600 líneas, extraer casos de uso y un router es un paso hacia VIPER sin reescribir la pantalla.",
          ],
          code: swift`@Observable @MainActor          // iOS 17; antes: ObservableObject + @Published
final class OrdersViewModel {
    private(set) var rows: [OrderRowViewModel] = []
    private(set) var errorMessage: String?
    var onSelectOrder: (String) -> Void = { _ in }   // lo que antes hacía el Router

    private let fetchOrders: any FetchOrdersUseCase  // el caso de uso no cambia
    private var orders: [Order] = []

    init(fetchOrders: any FetchOrdersUseCase) { self.fetchOrders = fetchOrders }

    func load() async {
        do {
            orders = try await fetchOrders.execute()
            rows = orders.map { OrderRowViewModel(title: "Pedido \($0.id)", subtitle: "$\($0.total)") }
        } catch {
            errorMessage = "No pudimos cargar tus pedidos"
        }
    }

    func select(at index: Int) { onSelectOrder(orders[index].id) }
}

enum OrdersBuilder {   // la firma pública casi no cambia
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
          prompt: "La app pasó a iOS 17 como mínimo. Completá la macro del ViewModel para que SwiftUI observe `rows` sin `@Published`.",
          code: swift`____ @MainActor
final class OrdersViewModel {
    private(set) var rows: [OrderRowViewModel] = []
}`,
          accept: ["^@Observable$"],
          explanation: "`@Observable` (framework Observation, iOS 17+) hace observables todas las propiedades almacenadas y SwiftUI redibuja solo las vistas que leyeron lo que cambió. Con target menor se usa `ObservableObject` + `@Published`.",
          placeholder: "@...",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: módulo VIPER de Transferencias",
      goal: "Construir un módulo VIPER completo sobre un caso de uso y un repositorio Clean, con tests de Presenter e Interactor.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Trabajás en la app de un banco que usa VIPER. Te toca el módulo **Transferencias recientes**: una lista que al tocar una fila abre el detalle. El backend devuelve todas las transferencias, incluidas las fallidas.",
            "Reglas de negocio: no se muestran las `failed`, se ordenan por fecha (más nueva primero) y se muestran como máximo 20. La fila muestra `Transferencia <id>` como título y el monto como subtítulo.",
            "Vas a escribir: el dominio (entidad, repositorio, caso de uso), el Interactor y el Presenter, el Router y el Builder, y los tests. Abajo tenés lo que ya existe en el proyecto.",
          ],
          code: swift`// Ya existe en el proyecto
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
// RemoteTransferRepository: TransferRepository   (Data, con su TransferDTO)`,
        },
        {
          kind: "write",
          prompt: "Dominio: escribí la entidad `Transfer` (`id`, `amount: Decimal`, `status`, `date`), el protocolo `TransferRepository`, el protocolo `FetchRecentTransfersUseCase` y su implementación con las tres reglas: sin `failed`, ordenadas por fecha descendente, máximo 20.",
          starter: swift`import Foundation

// Entidad

// Repositorio

// Caso de uso
`,
          checks: [
            { pattern: "struct\\s+Transfer\\b", label: "entidad `Transfer`" },
            { pattern: "protocol\\s+TransferRepository", label: "protocolo `TransferRepository`" },
            { pattern: "protocol\\s+FetchRecentTransfersUseCase", label: "protocolo `FetchRecentTransfersUseCase`" },
            { pattern: "\\.filter\\s*\\{[^}]*failed", label: "excluye las `failed`" },
            { pattern: "\\.sorted\\s*\\{[^}]*date", label: "ordena por fecha" },
            { pattern: "\\.prefix\\(20\\)", label: "limita a 20 con `prefix(20)`" },
          ],
          warnings: [
            { pattern: "import\\s+UIKit", label: "Domain no importa UIKit" },
            { pattern: "URLSession", label: "el dominio no habla con la red" },
            { pattern: "TransferDTO", label: "el dominio no conoce DTOs" },
          ],
          solution: swift`import Foundation

// Entidad
struct Transfer: Equatable, Sendable {
    let id: String
    let amount: Decimal
    let status: TransferStatus
    let date: Date
}

// Repositorio
protocol TransferRepository: Sendable {
    func transfers() async throws -> [Transfer]
}

// Caso de uso
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
          hint: "`prefix(20)` devuelve un `ArraySlice`: envolvelo en `Array(...)` para cumplir la firma.",
        },
        {
          kind: "write",
          prompt: "Interactor y Presenter: implementá `TransfersInteractor` (guarda el `Task` en `private(set) var task` para poder testearlo) y `TransfersPresenter`, usando los contratos del starter. Referencias de vuelta siempre `weak`.",
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
            { pattern: "final\\s+class\\s+TransfersInteractor", label: "clase `TransfersInteractor`" },
            { pattern: "weak\\s+var\\s+output", label: "`weak var output` en el Interactor" },
            { pattern: "var\\s+task\\s*:\\s*Task<", label: "guarda el `Task` en `task`" },
            { pattern: "try\\s+await\\s+useCase\\.execute\\(\\)", label: "llama a `try await useCase.execute()`" },
            { pattern: "final\\s+class\\s+TransfersPresenter", label: "clase `TransfersPresenter`" },
            { pattern: "weak\\s+var\\s+view", label: "`weak var view` en el Presenter" },
            { pattern: "view\\?\\.show\\(", label: "muestra las filas con `view?.show`" },
            { pattern: "router\\.showDetail\\(transferID:", label: "navega con `router.showDetail(transferID:)`" },
          ],
          warnings: [
            { pattern: "^\\s*var\\s+(view|output)\\s*:", label: "referencia de vuelta fuerte: ciclo de retención" },
            { pattern: "UIViewController", label: "Interactor y Presenter no conocen UIKit" },
            { pattern: "\\.filter\\s*\\{[^}]*failed", label: "la regla de `failed` ya está en el caso de uso" },
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
            TransferRowViewModel(title: "Transferencia \($0.id)", subtitle: "$\($0.amount)")
        })
    }

    func didFail(_ error: Error) {
        view?.showError("No pudimos cargar tus transferencias")
    }
}`,
          hint: "Copiá la forma de `OrdersInteractor` y `OrdersPresenter`. El Presenter guarda las transferencias para resolver el `id` en `didSelectRow(at:)`.",
        },
        {
          kind: "write",
          prompt: "Router y Builder: `TransfersRouter` hace push del detalle con `TransferDetailBuilder.build(transferID:)`. `TransfersBuilder.build(repository:)` crea el caso de uso y las cuatro piezas, las conecta y devuelve la View.",
          starter: swift`// Router
@MainActor
final class TransfersRouter: TransfersRouterInput {
}

// Builder
enum TransfersBuilder {
}`,
          checks: [
            { pattern: "weak\\s+var\\s+viewController", label: "`weak var viewController` en el Router" },
            { pattern: "TransferDetailBuilder\\.build\\(transferID:", label: "construye el detalle con su Builder" },
            { pattern: "pushViewController\\(", label: "hace push del detalle" },
            { pattern: "static\\s+func\\s+build", label: "`static func build` en el Builder" },
            { pattern: "DefaultFetchRecentTransfersUseCase\\(", label: "crea el caso de uso" },
            { pattern: "view\\.presenter\\s*=\\s*presenter", label: "`view.presenter = presenter`" },
            { pattern: "presenter\\.view\\s*=\\s*view", label: "`presenter.view = view`" },
            { pattern: "interactor\\.output\\s*=\\s*presenter", label: "`interactor.output = presenter`" },
            { pattern: "router\\.viewController\\s*=\\s*view", label: "`router.viewController = view`" },
          ],
          warnings: [
            { pattern: "^\\s*var\\s+viewController", label: "`viewController` fuerte: ciclo View → Presenter → Router → View" },
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
          hint: "El Builder recibe el repositorio desde afuera: así la composition root decide si es remoto, con caché o un fake para UI tests.",
        },
        {
          kind: "write",
          prompt: "Tests: escribí un test del Presenter (`viewDidLoad()` le pide las transferencias al Interactor, usando un spy) y uno del Interactor (con un stub del caso de uso y un spy del output, esperando el `task`).",
          starter: swift`import Testing
@testable import Transfers

// Spies y stubs

// Tests del Presenter

// Tests del Interactor
`,
          checks: [
            { pattern: "final\\s+class\\s+\\w+Spy", label: "al menos un spy" },
            { pattern: "@Test", label: "tests con `@Test`" },
            { pattern: "#expect\\(", label: "verifica con `#expect`" },
            { pattern: "TransfersPresenter\\(", label: "testea el Presenter" },
            { pattern: "viewDidLoad\\(\\)", label: "dispara `viewDidLoad()`" },
            { pattern: "TransfersInteractor\\(", label: "testea el Interactor" },
            { pattern: "await\\s+sut\\.task\\?\\.value", label: "espera el `Task` del Interactor" },
          ],
          warnings: [
            { pattern: "Thread\\.sleep|Task\\.sleep", label: "esperás con sleep: test lento y flaky" },
            { pattern: "RemoteTransferRepository", label: "el test usa el repositorio real (red)" },
          ],
          solution: swift`import Testing
@testable import Transfers

// Spies y stubs
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

// Tests del Presenter
@MainActor
struct TransfersPresenterTests {
    @Test func viewDidLoadFetchesTransfers() {
        let interactor = TransfersInteractorSpy()
        let sut = TransfersPresenter(interactor: interactor, router: TransfersRouterSpy())

        sut.viewDidLoad()

        #expect(interactor.fetchCallCount == 1)
    }
}

// Tests del Interactor
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
          hint: "Guardá el spy del output en una variable local: el Interactor lo tiene `weak`, y si nadie más lo retiene se libera antes de recibir la llamada.",
        },
        {
          kind: "predict",
          prompt: "En el PR del módulo aparece esto en el Presenter. ¿Qué pedís en el review?",
          code: swift`func didFetch(_ transfers: [Transfer]) {
    // Los montos grandes solo los ven usuarios premium
    let visible = transfers.filter { $0.amount < 1_000_000 || isPremiumUser }
    self.transfers = visible
    view?.show(visible.map(makeRow))
}`,
          options: [
            "Nada: el Presenter decide qué se muestra",
            "Moverlo a la View, que es la que muestra",
            "Moverlo al Router, porque depende del tipo de usuario",
            "Moverlo al caso de uso (o al dominio): es una regla de negocio y el Presenter solo formatea",
          ],
          answer: 3,
          explanation: "Quién puede ver qué transferencias es una regla de negocio: tiene que estar en el caso de uso (que recibe el tipo de usuario de un repositorio o servicio) y tener sus propios tests. En el Presenter se duplicaría en cada pantalla que liste transferencias, y otro cliente (widget, Apple Watch) la saltearía. La View y el Router no deciden datos.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-dependency-rule",
      front: "¿Qué dice la regla de dependencias de Clean Architecture?",
      back: "Las dependencias apuntan hacia adentro: Presentation y Data dependen de Domain; Domain no depende de nadie (ni UIKit, ni SwiftUI, ni librerías de red). Solo `Foundation`.",
    },
    {
      id: "fc-entity-vs-dto",
      front: "Entidad vs DTO",
      back: "El DTO refleja el JSON del backend (nombres, `String`, centavos) y vive en Data. La entidad modela el negocio (`enum`, `Decimal`) y vive en Domain. El mapper DTO → entidad va en Data.",
      code: swift`extension OrderDTO {
    func toDomain() -> Order { /* ... */ }
}`,
    },
    {
      id: "fc-dependency-inversion",
      front: "Si Domain no puede depender de Data, ¿cómo obtiene datos?",
      back: "Domain declara el protocolo (`OrderRepository`) y Data lo implementa. La composition root elige la implementación concreta e inyecta.",
    },
    {
      id: "fc-use-case",
      front: "¿Qué es un caso de uso?",
      back: "Un tipo que representa una sola acción del negocio, con un método `execute`, que depende de protocolos de repositorio y concentra las reglas (filtrar, ordenar, validar).",
      code: swift`protocol FetchOrdersUseCase: Sendable {
    func execute() async throws -> [Order]
}`,
    },
    {
      id: "fc-repository-sources",
      front: "¿Qué hace un repositorio con data sources remoto y local?",
      back: "Decide de dónde salen los datos: por ejemplo, red primero, guardar en local y, si la red falla, devolver la caché. Si tampoco hay caché, relanza el error original.",
    },
    {
      id: "fc-business-rule-place",
      front: "¿Dónde va una regla de negocio?",
      back: "Si depende solo de los datos de la entidad, en la entidad (`isCancellable`). Si orquesta varias cosas (validar + llamar al repositorio), en el caso de uso. Nunca en la View, el Presenter ni el repositorio.",
    },
    {
      id: "fc-viper-roles",
      front: "VIPER: ¿qué hace cada letra?",
      back: "View: muestra y reenvía eventos. Interactor: lógica de negocio del módulo (usa casos de uso). Presenter: traduce entidades a view models y coordina. Entity: modelos de dominio. Router: navegación y construcción de módulos.",
    },
    {
      id: "fc-presenter",
      front: "¿Qué hace el Presenter y qué no?",
      back: "Sí: recibe eventos de la View, le pide datos al Interactor, formatea (`OrderRowViewModel`), le pide navegación al Router. No: importar UIKit, hablar con la red, decidir reglas de negocio.",
    },
    {
      id: "fc-weak-refs",
      front: "En VIPER, ¿qué referencias son `weak`?",
      back: "Las de vuelta: Presenter → View, Interactor → Presenter (output) y Router → ViewController. Las fuertes son View → Presenter → Interactor/Router.",
    },
    {
      id: "fc-anyobject",
      front: "¿Por qué `protocol OrdersViewInput: AnyObject`?",
      back: "Porque el Presenter la guarda como `weak var view`, y `weak` solo se aplica a referencias de clase. Sin `AnyObject` no compila.",
    },
    {
      id: "fc-builder",
      front: "¿Qué hace el Builder (Assembly) de un módulo VIPER?",
      back: "Crea View, Interactor, Presenter y Router, conecta las referencias (una fuerte y tres `weak`), recibe dependencias externas y devuelve un `UIViewController`.",
    },
    {
      id: "fc-module-output",
      front: "¿Cómo devuelve datos un módulo VIPER al que lo abrió?",
      back: "Con un protocolo de salida (`OrderFilterModuleOutput`) que implementa el Presenter del módulo padre y el Presenter hijo guarda como `weak`. Lo pasa el Router a través del Builder.",
    },
    {
      id: "fc-spy-stub",
      front: "Spy vs stub",
      back: "Un stub devuelve respuestas fijas (el caso de uso que devuelve `.success([...])`). Un spy registra las llamadas que recibe para verificarlas (`fetchOrdersCallCount`, `shownOrderIDs`).",
    },
    {
      id: "fc-test-interactor-task",
      front: "¿Cómo testeás un Interactor que dispara un `Task`?",
      back: "Guardás el `Task` en `private(set) var task` y en el test hacés `await sut.task?.value` antes de verificar. Nunca `Task.sleep`.",
    },
    {
      id: "fc-viper-overkill",
      front: "¿Cuándo VIPER o Clean son over-engineering?",
      back: "Pantallas simples sin reglas (ajustes, formularios), prototipos, equipos chicos, apps SwiftUI nuevas. También los casos de uso que solo reenvían al repositorio sin agregar nada.",
    },
  ],

  exam: [
    {
      id: "ex-router-leak",
      question: "En producción, el Memory Graph muestra que cada vez que el usuario entra y sale de Mis pedidos queda un `OrdersViewController` vivo. ¿Cuál es la corrección?",
      code: swift`final class OrdersRouter: OrdersRouterInput {
    var viewController: UIViewController?
}
// Builder: view.presenter = presenter; presenter.view = view (weak);
//          interactor.output = presenter (weak); router.viewController = view`,
      options: [
        "Hacer `weak var presenter` en la View",
        "Hacer `weak var viewController` en el Router",
        "Llamar a `router.viewController = nil` en `viewWillAppear`",
        "Hacer el Router un `struct`",
      ],
      answer: 1,
      explanation: "El ciclo es View → Presenter → Router → View. La flecha de vuelta Router → View tiene que ser `weak`. Hacer `weak` al Presenter en la View lo liberaría enseguida (nadie más lo retiene). Limpiar a mano es frágil, y un `struct` no puede guardar `weak` ni encaja con los contratos `@MainActor` de clase.",
    },
    {
      id: "ex-domain-swiftui",
      question: "Alguien agregó esto a la entidad para pintar el estado en la lista. El target `Domain` dejó de compilar en el paquete compartido con el widget. ¿Qué hacés?",
      code: swift`import SwiftUI

extension OrderStatus {
    var color: Color { self == .shipped ? .green : .gray }
}`,
      options: [
        "Agregar SwiftUI como dependencia de `Domain`",
        "Cambiar `Color` por `UIColor` e importar UIKit",
        "Pasar el color como `String` hexadecimal desde la entidad",
        "Mover el mapeo estado → color a Presentation (Presenter o ViewModel); la entidad solo expone el estado",
      ],
      answer: 3,
      explanation: "Cómo se pinta un estado es decisión de presentación. Domain no tiene que depender de frameworks de UI, sean SwiftUI o UIKit. Un hex en la entidad es lo mismo con otro disfraz: sigue siendo un detalle visual en Domain.",
    },
    {
      id: "ex-backend-rename",
      question: "El backend renombró `total_cents` a `amount_cents`. En una app con Clean bien hecho, ¿qué archivos cambian?",
      options: [
        "Solo el DTO (o sus `CodingKeys`) y el mapper en Data",
        "El DTO, la entidad `Order` y todos los Presenters que muestran totales",
        "El caso de uso y el repositorio",
        "Todos los tests de Presenter",
      ],
      answer: 0,
      explanation: "Esa es la razón de separar DTO y entidad: el formato del backend queda encapsulado en Data. `Order.total` sigue igual, así que casos de uso, Presenters y sus tests no se enteran.",
    },
    {
      id: "ex-2fa-rule",
      question: "Nueva regla: las transferencias de más de 10.000 requieren un segundo factor antes de confirmarse. ¿Dónde la implementás?",
      options: [
        "En el ViewController, mostrando el diálogo de 2FA según el monto",
        "En el Presenter, antes de llamar al Interactor",
        "En el caso de uso de transferir (o en la entidad), devolviendo que hace falta 2FA para que Presentation lo pida",
        "En el repositorio, antes del `POST`",
      ],
      answer: 2,
      explanation: "Es una regla de negocio: va en Domain, testeada aparte. El caso de uso devuelve un resultado (por ejemplo `.requiresSecondFactor`) y el Presenter decide cómo mostrarlo. En la View o el Presenter se puede saltear desde otra pantalla; en el repositorio queda mezclada con el acceso a datos.",
    },
    {
      id: "ex-passthrough-use-case",
      question: "En un review ves un caso de uso cuyo `execute()` es solo `try await repository.profile()`. ¿Cuál es la respuesta más razonable de un senior?",
      options: [
        "Bloquear el PR: todo acceso a datos tiene que tener su caso de uso",
        "Moverlo al Presenter para que haya menos archivos",
        "Aceptable si el equipo lo usa por convención, pero no aporta: se puede inyectar el repositorio directo hasta que aparezca una regla que lo justifique",
        "Reemplazarlo por un singleton `ProfileService.shared`",
      ],
      answer: 2,
      explanation: "Un caso de uso pass-through es ceremonia: no protege ninguna regla. Muchos equipos lo aceptan por consistencia, pero no es obligatorio. Moverlo al Presenter no cambia nada y el singleton empeora la testeabilidad.",
    },
    {
      id: "ex-interactor-output",
      question: "¿Qué línea arregla la fuga de memoria?",
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
        "(3) → `var view` fuerte",
        "(4) → `weak var interactor`",
      ],
      answer: 0,
      explanation: "Presenter → Interactor es fuerte (el Presenter es dueño) e Interactor → Presenter también: ciclo. La flecha de vuelta, el output, tiene que ser `weak`. Hacer `weak` al interactor lo liberaría porque nadie más lo retiene; `useCase` puede ser un struct y no participa del ciclo.",
    },
    {
      id: "ex-weak-protocol",
      question: "¿Por qué no compila?",
      code: swift`protocol OrdersViewInput {
    func show(_ rows: [OrderRowViewModel])
}

final class OrdersPresenter {
    weak var view: OrdersViewInput?
}`,
      options: [
        "Falta `@MainActor` en el protocolo",
        "Un Presenter no puede tener propiedades opcionales",
        "`weak` requiere `private`",
        "`weak` solo aplica a tipos de clase y el protocolo no está restringido con `AnyObject`",
      ],
      answer: 3,
      explanation: "Error: `weak` must not be applied to non-class-bound `OrdersViewInput`. Se arregla con `protocol OrdersViewInput: AnyObject`. `@MainActor` es recomendable en Swift 6, pero no es la causa de este error.",
    },
    {
      id: "ex-uikit-imports",
      question: "En un módulo VIPER bien separado, ¿qué componentes importan UIKit?",
      options: [
        "Todos, porque es una app UIKit",
        "La View y el Router (y el Builder que los arma)",
        "El Presenter y la View",
        "Solo el Interactor, para manejar el hilo principal",
      ],
      answer: 1,
      explanation: "La View muestra y el Router presenta o hace push de controllers: los dos necesitan UIKit. El Builder devuelve un `UIViewController`. Presenter e Interactor se quedan en Swift puro para testearlos sin UIKit.",
    },
    {
      id: "ex-test-double",
      question: "Querés verificar que, después de `didFetch` con dos pedidos, el Presenter le pasó dos filas a la View. ¿Qué doble de test usás para la View?",
      options: [
        "Un spy que registre las filas que recibe `show(_:)`",
        "Un stub que devuelva filas fijas",
        "La `OrdersViewController` real cargada desde el storyboard",
        "Ninguno: se verifica mirando la UI en un snapshot test",
      ],
      answer: 0,
      explanation: "Lo que querés comprobar es una llamada saliente y sus argumentos: eso es un spy. Un stub da respuestas, no registra. Usar el controller real trae UIKit al test, y un snapshot test verifica píxeles, no el contrato del Presenter.",
    },
    {
      id: "ex-flaky-interactor-test",
      question: "Este test falla de vez en cuando en CI. ¿Cuál es el mejor arreglo?",
      code: swift`@Test func forwardsOrders() async throws {
    let sut = OrdersInteractor(useCase: stub)
    sut.output = spy
    sut.fetchOrders()
    try await Task.sleep(for: .milliseconds(100))
    #expect(spy.fetched.count == 2)
}`,
      options: [
        "Subir el sleep a 1 segundo",
        "Marcar el test como `.disabled` en CI",
        "Exponer el `Task` del Interactor y hacer `await sut.task?.value` en lugar del sleep",
        "Correr los tests en serie",
      ],
      answer: 2,
      explanation: "El sleep apuesta a que el `Task` termine a tiempo; en un runner lento pierde. Esperar el `Task` real es determinista y rápido. Subir el sleep solo hace el test más lento y sigue siendo una apuesta.",
    },
    {
      id: "ex-migration-survives",
      question: "Migrás un módulo VIPER a MVVM con SwiftUI. ¿Qué queda prácticamente sin tocar?",
      options: [
        "El Presenter, que pasa a llamarse ViewModel sin cambios",
        "Los casos de uso y los repositorios",
        "El Router, que sigue haciendo push desde la View",
        "Los contratos `ViewInput`/`ViewOutput`",
      ],
      answer: 1,
      explanation: "Domain y Data no dependen de la capa de presentación, así que sobreviven intactos: esa es la ganancia de Clean. Presenter e Interactor se funden en el ViewModel, el Router pasa a ser coordinator o closure, y los contratos View ↔ Presenter desaparecen.",
    },
    {
      id: "ex-data-back",
      question: "El módulo Editar dirección tiene que avisarle a Checkout la dirección nueva cuando el usuario guarda. ¿Cómo lo resolvés en VIPER?",
      options: [
        "El Interactor de Editar escribe en `UserDefaults` y Checkout lo relee en `viewWillAppear`",
        "Checkout le pasa su Presenter al Builder de Editar como referencia fuerte",
        "Un `NotificationCenter.default.post` con la dirección en `userInfo`",
        "Un protocolo `EditAddressModuleOutput` que implementa el Presenter de Checkout; el Router lo pasa al Builder de Editar y su Presenter lo guarda `weak`",
      ],
      answer: 3,
      explanation: "El module output es explícito, tipado, testeable con un spy y no crea ciclos por ser `weak`. `UserDefaults` y notificaciones son canales implícitos difíciles de rastrear, y pasar el Presenter fuerte acopla los módulos y puede retenerlos de más.",
    },
  ],
};

export default content;
