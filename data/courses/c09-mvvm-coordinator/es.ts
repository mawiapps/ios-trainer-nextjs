import type { CourseContent } from "../types";

// Código Swift literal: String.raw conserva `\(...)` y `\n` tal cual.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "mvc-massive-vc",
      title: "MVC y el Massive View Controller",
      goal: "Reconocer por qué un view controller crece sin control y listar qué responsabilidades sacarle.",
      minutes: 14,
      steps: [
        {
          kind: "explain",
          title: "El MVC de Apple en la práctica",
          body: [
            "En el MVC de Apple el **Model** son los datos, la **View** dibuja y el **Controller** coordina. En UIKit el controller es un `UIViewController`, que además es dueño de la vista y recibe todo el ciclo de vida (`viewDidLoad`, `viewWillAppear`…). Resultado: es el lugar más cómodo para meter cualquier cosa.",
            "Así nace el **Massive View Controller**: red, parseo, persistencia, formato de textos, estado de carga y navegación en una sola clase de 800 líneas. Vamos a usar esta pantalla de productos como hilo conductor del curso y desarmarla de a poco.",
            "Fijate que cada comentario del código marca una responsabilidad distinta. Ninguna de ellas es 'mostrar una tabla'.",
          ],
          code: swift`final class ProductListViewController: UITableViewController {
    private var products: [Product] = []
    private var favorites = Set(UserDefaults.standard.array(forKey: "favs") as? [Int] ?? []) // persistencia

    override func viewDidLoad() {
        super.viewDidLoad()
        Task {
            let url = URL(string: "https://api.shop.com/products")!
            let (data, _) = try await URLSession.shared.data(from: url)        // red
            products = try JSONDecoder().decode([Product].self, from: data)  // parseo
            tableView.reloadData()
        }
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        let product = products[indexPath.row]
        let price = String(format: "$%.2f", Double(product.priceCents) / 100) // formato
        cell.textLabel?.text = favorites.contains(product.id) ? "★ \(product.name) \(price)" : "\(product.name) \(price)"
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let detail = ProductDetailViewController(product: products[indexPath.row])  // navegación
        navigationController?.pushViewController(detail, animated: true)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "En el VC de arriba, ¿qué ve el usuario si `URLSession` falla en `viewDidLoad`?",
          code: swift`Task {
    let url = URL(string: "https://api.shop.com/products")!
    let (data, _) = try await URLSession.shared.data(from: url)
    products = try JSONDecoder().decode([Product].self, from: data)
    tableView.reloadData()
}`,
          options: [
            "La app crashea con el error de red",
            "Un `UIAlertController` con el error, que UIKit muestra solo",
            "Nada: el error queda guardado en el `Task`, nadie lo lee y la tabla queda vacía para siempre",
            "No compila: no se puede usar `try` dentro de un `Task` sin `do/catch`",
          ],
          answer: 2,
          explanation: "El closure de `Task` puede lanzar: el error se guarda como resultado del `Task`. Como nadie hace `await task.value`, se pierde en silencio. No hay estado de carga ni de error, así que el usuario ve una tabla vacía. Este es un síntoma típico del VC masivo: el estado de la pantalla no está modelado en ningún lado.",
        },
        {
          kind: "explain",
          title: "Inventario: a dónde va cada cosa",
          body: [
            "Antes de refactorizar, hacé el inventario. Red y parseo → un **servicio** detrás de un protocolo. Favoritos en `UserDefaults` → un **store**. Formato de precios y estado de carga → el **view model**. A qué pantalla ir al tocar una fila → un **coordinator**. Lo que queda en el VC es solo vista: configurar celdas y reenviar eventos.",
            "El primer paso suele ser el más barato: sacar funciones puras. Una función que recibe datos y devuelve un `String` se testea sin simulador.",
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
          prompt: "La red sale del VC detrás de un protocolo. Completá la firma para que la operación sea asíncrona y pueda fallar.",
          code: swift`protocol ProductService: Sendable {
    func fetchProducts() ____ -> [Product]
}`,
          accept: ["^async throws$"],
          explanation: "`async throws` (en ese orden) dice que la llamada se suspende y puede lanzar. El protocolo es `Sendable` porque el servicio se usa desde un view model `@MainActor` y se llama de forma asíncrona.",
          hint: "Dos palabras clave: primero la de concurrencia, después la de errores.",
          placeholder: "async ...",
        },
        {
          kind: "explain",
          title: "Por qué duele: tests y navegación",
          body: [
            "Querés un test que diga 'si la API falla, la pantalla muestra un error'. Con el VC masivo tenés que instanciar UIKit, disparar `viewDidLoad`, pegarle a la red real y leer celdas de la tabla. Lento, frágil y casi nadie lo escribe.",
            "La navegación también está soldada: la lista conoce a `ProductDetailViewController`. Si mañana producto pide la misma lista en otro flujo con otro destino, copiás el VC entero o le agregás un `if`.",
          ],
          code: swift`// Lo que querés testear:
// "si la API falla, la pantalla muestra un error"

// Lo que te obliga a hacer el VC masivo:
let vc = ProductListViewController()
vc.loadViewIfNeeded()   // dispara viewDidLoad → red real
// ...esperar a la red, contar celdas, adivinar el estado`,
        },
        {
          kind: "predict",
          prompt: "Producto quiere reusar la lista en un flujo 'Elegí un regalo': al tocar un producto NO se abre el detalle, se cierra el modal devolviendo el producto elegido. ¿Qué te lo impide en este VC?",
          code: swift`override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let detail = ProductDetailViewController(product: products[indexPath.row])
    navigationController?.pushViewController(detail, animated: true)
}`,
          options: [
            "El VC decide la navegación en `didSelectRowAt`: el destino está acoplado a la pantalla",
            "Un `UITableViewController` no se puede presentar como modal",
            "`products` es `private` y no se puede leer desde afuera",
            "`pushViewController` solo funciona en el flujo principal de la app",
          ],
          answer: 0,
          explanation: "El VC sabe a dónde ir después. Si en cambio emitiera un evento ('se eligió este producto') y otro objeto decidiera el destino, la misma pantalla serviría para los dos flujos. Eso es lo que resuelve el coordinator más adelante.",
        },
        {
          kind: "write",
          prompt: "Primer paso del refactor: declará `ProductService` (con `fetchProducts()` asíncrona que puede fallar) y hacé que el VC lo reciba por inicializador como `init(service:)` en vez de usar `URLSession.shared`.",
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
            { pattern: "protocol\\s+ProductService", label: "Declara el protocolo `ProductService`" },
            { pattern: "func\\s+fetchProducts\\(\\)\\s+async\\s+throws\\s*->\\s*\\[Product\\]", label: "`fetchProducts()` es `async throws` y devuelve `[Product]`" },
            { pattern: "init\\(service:\\s*(any\\s+)?ProductService\\)", label: "El VC recibe el servicio con `init(service:)`" },
            { pattern: "try\\s+await\\s+(self\\.)?service\\.fetchProducts\\(\\)", label: "Carga con `try await service.fetchProducts()`" },
          ],
          warnings: [
            { pattern: "URLSession\\.shared", label: "El VC sigue hablando con la red directamente" },
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
          hint: "Guardá el servicio en una propiedad `private let service: any ProductService` y no te olvides de `required init?(coder:)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "mvvm-swiftui",
      title: "MVVM en SwiftUI",
      goal: "Escribir un view model `@Observable` y `@MainActor` con estado como enum, servicios inyectados y una vista que solo dibuja.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Roles y estado como enum",
          body: [
            "En MVVM, el **Model** son los datos y reglas de negocio; la **View** dibuja un estado y reenvía eventos; el **ViewModel** guarda el estado de la pantalla y la lógica de presentación (qué mostrar, cuándo cargar, qué texto de error). El view model no conoce a la vista.",
            "Modelá el estado de la pantalla como un `enum`. Con tres propiedades sueltas (`isLoading`, `error`, `products`) podés llegar a estados imposibles, como spinner y error a la vez. Con un enum, la pantalla está en exactamente un caso.",
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
          explanation: "`print` de un caso de enum muestra el nombre del caso sin el tipo: `idle`. Con valor asociado muestra el payload, y los strings dentro de un array salen con comillas: `loaded([\"Mate\", \"Yerba\"])`. Como `LoadState` es `Equatable` (síntesis automática porque `[String]` y `String` lo son), la comparación da `true`.",
        },
        {
          kind: "explain",
          title: "El view model",
          body: [
            "`@Observable` (iOS 17) hace que SwiftUI redibuje solo las vistas que leyeron la propiedad que cambió. `@MainActor` garantiza que `state` se escriba en el hilo principal: el `await` a la red se suspende sin bloquear y vuelve a main solo.",
            "El servicio entra por el inicializador como `any ProductService`: en la app le pasás el real y en los tests un fake. `private(set)` hace que solo el view model cambie el estado. Y no hace falta `import SwiftUI`: el view model es Swift puro y se testea sin vistas.",
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
            state = .failed("No pudimos cargar los productos")
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el modificador que dispara la carga cuando aparece la vista y la cancela si desaparece.",
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
          explanation: "`.task { }` corre código `async` cuando la vista aparece y cancela esa tarea cuando desaparece. Es el lugar natural para llamar `await viewModel.load()`; no hace falta crear un `Task` a mano en `onAppear`.",
          placeholder: "modificador",
        },
        {
          kind: "explain",
          title: "Vistas tontas (y iOS 16)",
          body: [
            "La vista hace un `switch` sobre el estado y dibuja. No decide nada: no formatea precios, no atrapa errores, no sabe de dónde vienen los datos. Si necesitás lógica, va al view model, que sí se testea.",
            "Si tu app soporta iOS 16 o anterior, `@Observable` no existe: usás `ObservableObject` con `@Published var state`, y la vista dueña lo guarda con `@StateObject`. Las vistas que lo reciben usan `@ObservedObject`. La idea de MVVM es la misma.",
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

// iOS 16 o anterior:
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
          prompt: "La pantalla es dueña de su view model `@Observable` y lo crea ella misma. ¿Qué wrapper usás para que no se recree en cada render del padre?",
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
          explanation: "Con `@Observable`, el dueño guarda el objeto en `@State`: SwiftUI conserva la instancia entre renders. `@StateObject` y `@ObservedObject` son para `ObservableObject` (iOS 16 y anterior). `@Bindable` sirve para crear bindings (`$viewModel.query`) a un objeto que recibiste, no para ser dueño.",
        },
        {
          kind: "write",
          prompt: "Escribí `ProductDetailViewModel`: `@MainActor` y `@Observable`, recibe `productID: Int` y `service: any ProductDetailService` con `init(productID:service:)`, expone un `state` (enum anidado `State` con `loading`, `loaded(Product)` y `failed(String)`) y una `func load() async` que pasa por `.loading` y termina en `.loaded` o `.failed`.",
          starter: swift`protocol ProductDetailService: Sendable {
    func fetchProduct(id: Int) async throws -> Product
}

// Escribí ProductDetailViewModel acá`,
          checks: [
            { pattern: "@MainActor", label: "Aislado con `@MainActor`" },
            { pattern: "@Observable", label: "Marcado con `@Observable`" },
            { pattern: "enum\\s+\\w*State", label: "Estado modelado como enum" },
            { pattern: "init\\(productID:\\s*Int,\\s*service:", label: "Dependencias por `init(productID:service:)`" },
            { pattern: "func\\s+load\\(\\)\\s+async", label: "`func load() async`" },
            { pattern: "state\\s*=\\s*\\.loading", label: "Pasa por `.loading`" },
            { pattern: "state\\s*=\\s*\\.failed\\(", label: "Maneja el error con `.failed`" },
          ],
          warnings: [
            { pattern: "import\\s+SwiftUI", label: "El view model no necesita `SwiftUI`" },
            { pattern: "URLSession", label: "La red va en el servicio, no en el view model" },
            { pattern: "ObservableObject", label: "Para iOS 17+ usá `@Observable`" },
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
            state = .failed("No pudimos cargar el producto")
        }
    }
}`,
          hint: "Copiá la forma de `ProductListViewModel`: estado `private(set)`, servicio `private let`, `do/catch` en `load()`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "mvvm-uikit",
      title: "MVVM en UIKit: binding",
      goal: "Conectar un view model a un view controller con closures o Combine, con inputs/outputs claros y sin ciclos de retención.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "UIKit no observa por vos",
          body: [
            "SwiftUI redibuja solo cuando cambia el estado. UIKit no: alguien tiene que avisarle al VC. Ese 'cable' es el **binding**. Las opciones más comunes: un closure que el view model llama en cada cambio, un publisher de Combine (`@Published`), o Observation con `withObservationTracking`.",
            "El view model es casi el mismo que en SwiftUI. Lo único que cambia es cómo se entera el VC. La versión con closure es la más simple y no depende de ningún framework: `didSet` llama a `onStateChange`.",
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
            state = .failed("No pudimos cargar los productos")
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
            "Nada: `didSet` no se ejecuta en propiedades `private(set)`",
          ],
          answer: 1,
          explanation: "El primer `increment()` corre `didSet`, pero `onChange` todavía es `nil`: no imprime. Después se conecta el closure y los dos incrementos siguientes imprimen `count: 2` y `count: 3`. Ojo con esto en UIKit: un binding por closure no te manda el valor actual al conectarlo; si el estado ya cambió, llamá a `render(viewModel.state)` vos al hacer el bind.",
        },
        {
          kind: "explain",
          title: "Combine: `@Published` + `sink`",
          body: [
            "Con Combine, el view model publica `@Published var state` y el VC se suscribe a `$state`. A diferencia del closure, el publisher **emite el valor actual** apenas te suscribís, así que el render inicial sale gratis.",
            "Detalle que aparece en entrevistas: `@Published` emite en el `willSet`. Dentro del `sink`, usá el valor que te llega por parámetro; si leés la propiedad, todavía tiene el valor viejo. `receive(on: DispatchQueue.main)` asegura que el render corra en main, y `store(in:)` mantiene viva la suscripción mientras viva el VC.",
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
          explanation: "Al suscribirse, `$title` emite el valor actual: `sink: A | property: A`. Al asignar `\"B\"`, `@Published` emite en el `willSet`, antes de guardar el valor nuevo: el parámetro es `B` pero la propiedad todavía vale `A`. Por eso en el `sink` siempre usás el parámetro.",
        },
        {
          kind: "explain",
          title: "Inputs, outputs y ciclos de retención",
          body: [
            "Ordená el view model en **inputs** (métodos que el VC llama: `viewDidLoad()`, `didSelectRow(at:)`) y **outputs** (lo que el VC o el coordinator escuchan: `onStateChange`, `onSelectProduct`). El VC no toma decisiones: reenvía eventos y renderiza.",
            "El ciclo clásico: el VC retiene al view model, el view model retiene el closure, y el closure retiene al VC si usás `self` sin `[weak self]`. Con Combine es igual: VC → `cancellables` → closure del `sink` → VC. Ninguno llega a `deinit`.",
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

// En el VC:
viewModel.onStateChange = { [weak self] state in
    self?.render(state)
}`,
        },
        {
          kind: "predict",
          prompt: "Hacés pop de esta pantalla y nunca ves el `deinit` en consola. ¿Por qué?",
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
            "Ciclo: el VC retiene al view model, el view model retiene el closure y el closure retiene al VC",
            "`deinit` no se llama nunca en subclases de `UIViewController`",
            "`UINavigationController` guarda los VCs después del pop por si volvés",
            "Falta llamar a `super.deinit` al final",
          ],
          answer: 0,
          explanation: "`self.render` dentro del closure captura `self` de forma fuerte. El VC es dueño del view model, el view model es dueño del closure, y el closure es dueño del VC: un círculo que ARC no rompe. Con `[weak self]` y `self?.render(state)` el closure deja de retener al VC.",
        },
        {
          kind: "fill",
          prompt: "Completá la lista de captura para que la suscripción no retenga al VC.",
          code: swift`viewModel.$state
    .receive(on: DispatchQueue.main)
    .sink { [____ self] state in self?.render(state) }
    .store(in: &cancellables)`,
          accept: ["^weak$"],
          explanation: "`[weak self]` hace que `self` sea opcional dentro del closure y no lo retenga. `unowned` también rompe el ciclo, pero crashea si llega una emisión después de que el VC se liberó (algo posible con el salto asíncrono de `receive(on:)`).",
          placeholder: "palabra clave",
        },
        {
          kind: "write",
          prompt: "Completá `bind()`: suscribite a `viewModel.$state`, recibí los valores en el main thread, llamá a `render(_:)` sin retener al VC y guardá la suscripción en `cancellables`.",
          starter: swift`final class ProductListViewController: UITableViewController {
    private let viewModel: ProductListViewModel
    private var cancellables = Set<AnyCancellable>()

    private func bind() {
        // tu código
    }

    private func render(_ state: LoadState) { /* ... */ }
}`,
          checks: [
            { pattern: "viewModel\\.\\$state", label: "Se suscribe a `viewModel.$state`" },
            { pattern: "\\.receive\\(on:\\s*(DispatchQueue\\.main|RunLoop\\.main)\\)", label: "Recibe en main con `receive(on:)`" },
            { pattern: "\\.sink\\s*\\{\\s*\\[weak self\\]", label: "El `sink` captura `[weak self]`" },
            { pattern: "self\\?\\.render\\(", label: "Llama a `self?.render(...)`" },
            { pattern: "\\.store\\(in:\\s*&cancellables\\)", label: "Guarda la suscripción con `store(in: &cancellables)`" },
          ],
          warnings: [
            { pattern: "\\.sink\\s*\\{(?!\\s*\\[weak self\\])", label: "El closure del `sink` no usa `[weak self]`: ciclo de retención" },
            { pattern: "\\[unowned self\\]", label: "`unowned` puede crashear si llega un valor después de liberar el VC" },
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
          hint: "Cadena: `$state` → `receive(on:)` → `sink` → `store(in:)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "testing-viewmodel",
      title: "Testear el view model",
      goal: "Testear transiciones de estado con servicios falsos y tests async, sin red ni esperas mágicas.",
      minutes: 15,
      steps: [
        {
          kind: "explain",
          title: "Fakes que controlás",
          body: [
            "Como el view model recibe `any ProductService`, en el test le pasás un **fake**: una implementación que devuelve lo que vos digas, al instante. Sin red, sin simulador, determinístico.",
            "Vocabulario que te van a pedir en entrevista: un **fake/stub** devuelve datos preparados; un **spy** además registra cómo lo llamaron (cuántas veces, con qué argumentos) para que el test lo verifique.",
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
          prompt: "El test usa un fake que lanza `TestError.boom`. ¿En qué estado queda `viewModel.state` después de `await viewModel.load()`?",
          code: swift`enum TestError: Error { case boom }

func load() async {
    state = .loading
    do {
        let products = try await service.fetchProducts()
        state = .loaded(products)
    } catch is URLError {
        state = .failed("Sin conexión")
    } catch {
        print("error inesperado")
    }
}`,
          options: [
            "`.idle`",
            "`.failed(\"Sin conexión\")`",
            "`.loading`",
            "El test crashea porque el error no se maneja",
          ],
          answer: 2,
          explanation: "`TestError.boom` no es `URLError`, así que cae en el `catch` genérico, que solo imprime. Nadie cambia el estado y queda en `.loading`: en la app, un spinner eterno. Un test con un error que no es de red encuentra este bug en segundos; por eso conviene probar más de un tipo de error.",
        },
        {
          kind: "explain",
          title: "Afirmá transiciones, no solo el final",
          body: [
            "Con el view model de UIKit (closure `onStateChange`) podés grabar todos los estados que pasaron y compararlos de una. Así verificás que el spinner aparece antes del resultado, no solo el resultado final.",
            "El struct de tests va con `@MainActor` porque el view model también lo es. Con Swift Testing (`import Testing`) las funciones son `@Test` y las afirmaciones `#expect`. El test es `async` y hace `await viewModel.load()`: cuando vuelve, la carga terminó.",
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
          prompt: "Completá la macro de Swift Testing que verifica una condición y sigue con el test si falla.",
          code: swift`await viewModel.load()
#____(viewModel.state == .failed("No pudimos cargar los productos"))`,
          accept: ["^expect$"],
          explanation: "`#expect(...)` registra la falla y deja seguir el test. `#require(...)` en cambio corta el test si falla (y la función tiene que ser `throws`). En XCTest el equivalente es `XCTAssertEqual`.",
          placeholder: "macro",
        },
        {
          kind: "explain",
          title: "Async sin esperas mágicas",
          body: [
            "Nada de `Task.sleep` ni de esperar 'un ratito': si el input es `async`, hacés `await` y listo. Si el view model dispara un `Task { }` por dentro (como `viewDidLoad()`), el test no tiene cómo esperarlo; por eso conviene exponer la versión `async` (`load()`) y que el input síncrono solo la envuelva.",
            "En XCTest funciona igual: el método de test puede ser `async` y la clase `@MainActor`.",
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

        XCTAssertEqual(viewModel.state, .failed("No pudimos cargar los productos"))
    }
}`,
        },
        {
          kind: "predict",
          prompt: "¿Qué pasa con este test?",
          code: swift`@Test @MainActor func viewDidLoadLoadsProducts() {
    let viewModel = ProductListViewModel(service: FakeProductService(result: .success([mate])))
    viewModel.viewDidLoad()   // adentro: Task { await load() }
    #expect(viewModel.state == .loaded([mate]))
}`,
          options: [
            "Pasa: el fake responde al instante",
            "No compila: `viewDidLoad` es un método de UIKit",
            "Se cuelga esperando la red",
            "Falla: el `#expect` corre antes de que arranque el `Task` interno y `state` sigue en `.idle`",
          ],
          answer: 3,
          explanation: "El test es síncrono y corre en el main actor. `Task { }` encola trabajo en ese mismo actor, que recién corre cuando el test termine o se suspenda. Entonces `#expect` ve `.idle`. Solución: testear `await viewModel.load()` directamente, o guardar el `Task` y hacer `await task.value`.",
        },
        {
          kind: "write",
          prompt: "Escribí un test con Swift Testing que verifique que, si el servicio falla, `state` termina en `.failed(\"No pudimos cargar los productos\")`. Usá `FakeProductService` con `.failure(...)`.",
          starter: swift`import Testing
@testable import Shop

// tu test acá`,
          checks: [
            { pattern: "@Test", label: "Marca la función con `@Test`" },
            { pattern: "@MainActor", label: "Corre en `@MainActor` como el view model" },
            { pattern: "func\\s+\\w+\\(\\)\\s+async", label: "La función de test es `async`" },
            { pattern: "FakeProductService\\(", label: "Usa `FakeProductService`" },
            { pattern: "\\.failure\\(", label: "Configura el fake con `.failure(...)`" },
            { pattern: "await\\s+\\w+\\.load\\(\\)", label: "Hace `await` de `load()`" },
            { pattern: "#expect\\(\\s*\\w+\\.state\\s*==\\s*\\.failed", label: "Verifica `state == .failed(...)`" },
          ],
          warnings: [
            { pattern: "Task\\.sleep|\\bsleep\\(", label: "No esperes con `sleep`: hacé `await` de `load()`" },
            { pattern: "URLSession", label: "El test no tiene que tocar la red" },
          ],
          solution: swift`import Testing
@testable import Shop

@MainActor
struct ProductListViewModelTests {
    @Test func loadFailureShowsMessage() async {
        let service = FakeProductService(result: .failure(URLError(.notConnectedToInternet)))
        let viewModel = ProductListViewModel(service: service)

        await viewModel.load()

        #expect(viewModel.state == .failed("No pudimos cargar los productos"))
    }
}`,
          hint: "Arrange (fake + view model), act (`await viewModel.load()`), assert (`#expect`).",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "coordinators",
      title: "Coordinators y navegación",
      goal: "Sacar la navegación de las pantallas con coordinators, manejar child coordinators sin leaks y rutear deep links, en UIKit y en SwiftUI.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Sacar la navegación del VC",
          body: [
            "Un **coordinator** es un objeto que es dueño de la navegación de un flujo: crea los view models y VCs, inyecta dependencias y decide qué pantalla sigue. Las pantallas solo avisan qué pasó (`onSelectProduct`), no a dónde ir.",
            "El protocolo es mínimo: un `start()` que muestra la primera pantalla y una lista de hijos. Es `AnyObject` porque los coordinators tienen identidad y se guardan por referencia, y `@MainActor` porque tocan UIKit. A esta combinación se la llama **MVVM-C**.",
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
          explanation: "`start()` imprime `login: start`; el login sigue vivo porque `children` lo retiene. `finish()` imprime `login: finish` y llama a `onFinish`, que imprime `app: show home` y saca al login de `children`. Ya nadie lo retiene (el closure lo captura `unowned`), así que se libera: `login: deinit`. Sin el `removeAll`, el `deinit` nunca aparecería: un leak por flujo terminado.",
        },
        {
          kind: "explain",
          title: "Child coordinators y su ciclo de vida",
          body: [
            "Flujos como login → home → detalle se arman con un `AppCoordinator` que crea hijos. El padre **retiene** al hijo en `childCoordinators` (si no, el hijo se libera apenas termina `start()`) y el hijo avisa cuando terminó.",
            "Cuando el hijo termina, el padre lo saca de la lista. Si te olvidás, cada vez que el usuario hace login (o checkout) queda un coordinator vivo con todo lo que retiene. Capturá al hijo con `weak` en su propio `onFinish`: el hijo es dueño del closure.",
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
          prompt: "Completá el operador para sacar al hijo comparando por identidad (los coordinators no son `Equatable`).",
          code: swift`private func remove(_ child: any Coordinator) {
    childCoordinators.removeAll { $0 ____ child }
}`,
          accept: ["^===$"],
          explanation: "`===` compara si dos referencias apuntan a la misma instancia. Funciona con cualquier clase, sin que el tipo sea `Equatable`, y es exactamente lo que querés: sacar a *ese* coordinator.",
          placeholder: "operador",
        },
        {
          kind: "write",
          prompt: "En `AppCoordinator`, escribí `showCheckout(cart:)`: creá un `CheckoutCoordinator(navigationController:cart:)` en una constante `checkout`, conectá su `onFinish` sin retener ni al padre ni al hijo, y adentro sacá al hijo de `childCoordinators` y llamá a `showOrderConfirmation()`. Después agregalo a los hijos y arrancalo.",
          starter: swift`@MainActor
final class AppCoordinator: Coordinator {
    var childCoordinators: [any Coordinator] = []
    private let navigationController: UINavigationController

    init(navigationController: UINavigationController) {
        self.navigationController = navigationController
    }

    func start() { showProducts() }

    func showCheckout(cart: Cart) {
        // tu código
    }

    private func showProducts() { /* ... */ }
    private func showOrderConfirmation() { /* ... */ }
}`,
          checks: [
            { pattern: "CheckoutCoordinator\\(navigationController:", label: "Crea el `CheckoutCoordinator`" },
            { pattern: "\\.onFinish\\s*=\\s*\\{\\s*\\[weak self", label: "`onFinish` captura `[weak self, ...]`" },
            { pattern: "(weak|unowned) checkout", label: "No retiene al hijo dentro de su propio closure" },
            { pattern: "childCoordinators\\.removeAll|remove\\(checkout\\)", label: "Saca al hijo de `childCoordinators` al terminar" },
            { pattern: "childCoordinators\\.append\\(checkout\\)", label: "Retiene al hijo en `childCoordinators`" },
            { pattern: "checkout\\.start\\(\\)", label: "Llama a `checkout.start()`" },
          ],
          warnings: [
            { pattern: "\\.onFinish\\s*=\\s*\\{(?!\\s*\\[weak self)", label: "`onFinish` sin `[weak self]`: el hijo retiene al padre" },
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
          hint: "Misma forma que `showLogin()`: crear, conectar `onFinish`, `append`, `start()`.",
        },
        {
          kind: "explain",
          title: "Deep links: de URL a ruta",
          body: [
            "Un deep link (`shop://products/42`) llega a la app y alguien tiene que decidir qué pantallas mostrar. Ese alguien es el coordinator raíz (o el router en SwiftUI), porque es el único que conoce todos los flujos.",
            "Separá el problema en dos: una función pura que convierte `URL` en un enum (`DeepLink`), fácil de testear, y el coordinator que, dado un `DeepLink`, arma la navegación. URLs desconocidas devuelven `nil` y se ignoran.",
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
          prompt: "Con la misma `deepLink(from:)` de arriba, ¿qué imprime?",
          code: swift`for link in ["shop://products/abc", "shop://favorites", "https://products/42"] {
    let parsed = deepLink(from: URL(string: link)!)
    print(link, "→", parsed.map { "\($0)" } ?? "nil")
}`,
          options: [
            "`shop://products/abc → productList` / `shop://favorites → favorites` / `https://products/42 → nil`",
            "`shop://products/abc → nil` / `shop://favorites → favorites` / `https://products/42 → nil`",
            "`shop://products/abc → productList` / `shop://favorites → favorites` / `https://products/42 → productDetail(id: 42)`",
            "Crashea en `Int(\"abc\")`",
          ],
          answer: 0,
          explanation: "`Int(\"abc\")` devuelve `nil` (no crashea), así que no entra al `if` y cae en `return .productList`. `shop://favorites` tiene host `favorites`. `https://products/42` falla el `guard` del esquema: `nil`. Decidir qué hacer con un id inválido (¿lista? ¿ignorar?) es una decisión de producto; lo importante es que quede en una función testeable.",
        },
        {
          kind: "explain",
          title: "SwiftUI: un router con `NavigationPath`",
          body: [
            "En SwiftUI el rol del coordinator lo cumple un **router**: un objeto `@Observable` que es dueño del `path` del `NavigationStack`. Las vistas piden `router.show(...)` en lugar de conocer la pantalla siguiente, y `.navigationDestination(for:)` traduce cada ruta a una vista.",
            "Para un deep link, el router resetea el path y apila las rutas necesarias. Si querés testear el stack, usá `[Route]` en vez de `NavigationPath`: `NavigationPath` borra los tipos y no te deja leer sus elementos.",
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
          prompt: "Completá el argumento para que el `NavigationStack` sepa qué vista mostrar por cada `Route` del path.",
          code: swift`NavigationStack(path: $router.path) {
    HomeView()
        .navigationDestination(for: ____) { route in
            destination(for: route)
        }
}`,
          accept: ["^Route\\.self$"],
          explanation: "`navigationDestination(for:)` recibe el metatipo del valor que vas a apilar: `Route.self`. Cada vez que el path tiene un `Route`, SwiftUI llama al closure con ese valor. El tipo tiene que ser `Hashable`.",
          placeholder: "Tipo.self",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: de Massive VC a MVVM-C",
      goal: "Refactorizar un view controller masivo a MVVM-C con un view model testeable, un coordinator y un test.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Te toca el ticket 'Favoritos tarda y a veces queda en blanco'. Abrís `FavoritesViewController` y encontrás esto: lee `UserDefaults`, pide cada producto a la red, arma el título, navega al detalle y borra favoritos. Cero tests.",
            "El objetivo del PR: un `FavoritesStore` (protocolo) para los ids, el `ProductDetailService` que ya tenés (`fetchProduct(id:)`), un `FavoritesViewModel` `@MainActor` con estado como enum e inputs/outputs, un `FavoritesCoordinator` que decide la navegación, y un test que cubra el borrado.",
            "El estado tiene un caso extra, `empty`, para mostrar 'Sin favoritos' sin mezclarlo con una lista vacía. Vamos paso por paso.",
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
            title = loaded.isEmpty ? "Sin favoritos" : "Favoritos (\(loaded.count))"
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
          prompt: "Paso 1: declará `protocol FavoritesStore` (con `favoriteIDs() -> [Int]` y `remove(id: Int)`) y escribí `FavoritesViewModel`: `@MainActor`, `init(store:service:)` con `any FavoritesStore` y `any ProductDetailService`, enum `State` con `loading`, `empty`, `loaded([Product])` y `failed(String)`, un `onStateChange` que se llame en cada cambio y `func load() async`.",
          starter: swift`protocol ProductDetailService: Sendable {
    func fetchProduct(id: Int) async throws -> Product
}

// FavoritesStore y FavoritesViewModel acá`,
          checks: [
            { pattern: "protocol\\s+FavoritesStore", label: "Declara `FavoritesStore`" },
            { pattern: "func\\s+remove\\(id:\\s*Int\\)", label: "El store tiene `remove(id:)`" },
            { pattern: "@MainActor", label: "El view model es `@MainActor`" },
            { pattern: "final\\s+class\\s+FavoritesViewModel", label: "Declara `FavoritesViewModel`" },
            { pattern: "init\\(store:\\s*(any\\s+)?FavoritesStore,\\s*service:\\s*(any\\s+)?ProductDetailService\\)", label: "Dependencias por `init(store:service:)`" },
            { pattern: "case\\s+empty", label: "El estado tiene un caso `empty`" },
            { pattern: "onStateChange\\?\\(", label: "Notifica cambios con `onStateChange`" },
            { pattern: "func\\s+load\\(\\)\\s+async", label: "`func load() async`" },
          ],
          warnings: [
            { pattern: "UserDefaults", label: "El view model no toca `UserDefaults`: eso va en el store" },
            { pattern: "URLSession", label: "La red va en el servicio" },
            { pattern: "import\\s+UIKit", label: "El view model no necesita UIKit" },
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
            state = .failed("No pudimos cargar tus favoritos")
        }
    }
}`,
          hint: "Es el mismo view model de UIKit de la lección 3, con un store y un caso `empty`.",
        },
        {
          kind: "write",
          prompt: "Paso 2: agregá los inputs y el output de navegación. `var onSelectProduct: ((Product) -> Void)?`, `func didSelectRow(at index: Int)` que lo emite, y `func removeFavorite(at index: Int)` que borra en el store y actualiza el estado (a `.empty` si no queda nada). Validá el índice.",
          starter: swift`@MainActor
final class FavoritesViewModel {
    // State, onStateChange, state, store, service, init y load() como en el paso 1

    // tus inputs y outputs acá
}`,
          checks: [
            { pattern: "var\\s+onSelectProduct\\s*:\\s*\\(\\(Product\\)\\s*->\\s*Void\\)\\?", label: "Output `onSelectProduct: ((Product) -> Void)?`" },
            { pattern: "func\\s+didSelectRow\\(at\\s+index:\\s*Int\\)", label: "Input `didSelectRow(at:)`" },
            { pattern: "onSelectProduct\\?\\(", label: "Emite `onSelectProduct?(...)`" },
            { pattern: "func\\s+removeFavorite\\(at\\s+index:\\s*Int\\)", label: "Input `removeFavorite(at:)`" },
            { pattern: "store\\.remove\\(id:", label: "Borra en el store" },
            { pattern: "indices\\.contains\\(index\\)", label: "Valida el índice con `indices.contains`" },
          ],
          warnings: [
            { pattern: "navigationController|pushViewController", label: "El view model no navega: solo emite el evento" },
            { pattern: "UserDefaults", label: "El borrado va por el store, no por `UserDefaults`" },
          ],
          solution: swift`@MainActor
final class FavoritesViewModel {
    // State, onStateChange, state, store, service, init y load() como en el paso 1

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
          hint: "`guard case .loaded(var products) = state` te da una copia mutable de la lista.",
        },
        {
          kind: "write",
          prompt: "Paso 3: escribí `start()` de `FavoritesCoordinator`. Creá el view model con `store` y `service`, conectá `onSelectProduct` sin retener al coordinator (llamando a `showDetail`), creá `FavoritesViewController(viewModel:)` y hacé push.",
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
        // tu código
    }

    private func showDetail(_ product: Product) {
        navigationController.pushViewController(ProductDetailViewController(product: product), animated: true)
    }
}`,
          checks: [
            { pattern: "FavoritesViewModel\\(store:\\s*store,\\s*service:\\s*service\\)", label: "Crea el view model inyectando `store` y `service`" },
            { pattern: "\\.onSelectProduct\\s*=\\s*\\{\\s*\\[weak self\\]", label: "`onSelectProduct` captura `[weak self]`" },
            { pattern: "self\\?\\.showDetail\\(", label: "Navega con `self?.showDetail(...)`" },
            { pattern: "FavoritesViewController\\(viewModel:", label: "Crea `FavoritesViewController(viewModel:)`" },
            { pattern: "pushViewController\\(\\w+,\\s*animated:", label: "Hace push de la pantalla" },
          ],
          warnings: [
            { pattern: "\\.onSelectProduct\\s*=\\s*\\{(?!\\s*\\[weak self\\])", label: "Sin `[weak self]`, el view model retiene al coordinator" },
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
          hint: "Es igual a `ProductsCoordinator.start()` de la lección 5.",
        },
        {
          kind: "write",
          prompt: "Paso 4: el test. Con un `SpyFavoritesStore` que tiene `[1]` y registra en `removedIDs` lo que se borra, y un `FakeProductDetailService(product: mate)`, verificá que después de `load()` y `removeFavorite(at: 0)` el estado es `.empty` y el store recibió el id `1`.",
          starter: swift`import Testing
@testable import Shop

final class SpyFavoritesStore: FavoritesStore {
    private var ids: [Int]
    private(set) var removedIDs: [Int] = []
    init(ids: [Int]) { self.ids = ids }
    func favoriteIDs() -> [Int] { ids }
    func remove(id: Int) { removedIDs.append(id); ids.removeAll { $0 == id } }
}

// tu test acá`,
          checks: [
            { pattern: "@Test", label: "Función `@Test`" },
            { pattern: "SpyFavoritesStore\\(ids:", label: "Usa el spy del store" },
            { pattern: "await\\s+\\w+\\.load\\(\\)", label: "Hace `await` de `load()`" },
            { pattern: "\\.removeFavorite\\(at:\\s*0\\)", label: "Llama a `removeFavorite(at: 0)`" },
            { pattern: "#expect\\(\\s*\\w+\\.state\\s*==\\s*\\.empty\\s*\\)", label: "Verifica `state == .empty`" },
            { pattern: "#expect\\(\\s*\\w+\\.removedIDs\\s*==", label: "Verifica qué recibió el store" },
          ],
          warnings: [
            { pattern: "UserDefaults\\.standard", label: "El test usa el spy, no `UserDefaults` real" },
            { pattern: "Task\\.sleep|\\bsleep\\(", label: "No hace falta esperar: `await viewModel.load()`" },
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
          hint: "Arrange: spy + fake + view model. Act: `load()` y `removeFavorite(at: 0)`. Assert: dos `#expect`.",
        },
        {
          kind: "predict",
          prompt: "Nuevo pedido: al borrar el último favorito, mostrar un toast 'Eliminado' y volver a la pestaña Productos. ¿Cómo lo repartís en MVVM-C?",
          code: swift`// FavoritesViewModel  → estado y eventos
// FavoritesViewController → dibuja
// FavoritesCoordinator → navegación`,
          options: [
            "Todo en el VC: es UI, así que no hace falta tocar el view model",
            "El view model hace `tabBarController?.selectedIndex = 0` porque sabe cuándo queda vacío",
            "El view model decide (emite el mensaje del toast y un output `onFavoritesEmpty`), el VC muestra el toast y el coordinator cambia de pestaña",
            "El coordinator observa la tabla del VC y cuenta las filas",
          ],
          answer: 2,
          explanation: "La decisión ('quedó vacío, hay que salir') es lógica de presentación: va al view model, que la puede testear. Mostrar el toast es vista: el VC. Cambiar de pestaña es navegación: el coordinator escucha `onFavoritesEmpty`. El view model nunca toca UIKit y el VC nunca decide a dónde ir.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-massive-vc",
      front: "¿Qué es un Massive View Controller y cómo lo detectás?",
      back: "Un VC que además de la vista maneja red, parseo, persistencia, formato, estado y navegación. Señales: cientos de líneas, `URLSession` o `UserDefaults` adentro, `pushViewController` en `didSelectRowAt`, cero tests.",
    },
    {
      id: "fc-mvvm-roles",
      front: "Roles en MVVM",
      back: "Model: datos y reglas. View: dibuja el estado y reenvía eventos. ViewModel: estado de la pantalla y lógica de presentación; no conoce a la vista ni importa UIKit/SwiftUI.",
    },
    {
      id: "fc-state-enum",
      front: "¿Por qué modelar el estado de pantalla como enum?",
      back: "Porque elimina estados imposibles (spinner y error a la vez). La pantalla está en exactamente un caso: `idle`, `loading`, `loaded`, `failed`. La vista hace un `switch` exhaustivo.",
      code: "enum LoadState: Equatable {\n    case idle, loading\n    case loaded([Product])\n    case failed(String)\n}",
    },
    {
      id: "fc-observable-wrappers",
      front: "¿Con qué wrapper guarda la vista dueña su view model?",
      back: "`@Observable` (iOS 17+) → `@State`. `ObservableObject` (iOS 16 y anterior) → `@StateObject`. Si lo recibe de afuera: parámetro común (o `@Bindable` para bindings) / `@ObservedObject`.",
    },
    {
      id: "fc-mainactor-vm",
      front: "¿Por qué el view model es `@MainActor`?",
      back: "Su estado alimenta la UI, que se actualiza en el hilo principal. Con `@MainActor` toda escritura de `state` ocurre en main; el `await` a la red suspende sin bloquear y vuelve a main solo.",
    },
    {
      id: "fc-init-injection",
      front: "¿Cómo recibe el view model sus servicios?",
      back: "Por inicializador y como protocolo (`init(service: any ProductService)`). En la app le pasás la implementación real y en los tests un fake. Nada de singletons adentro.",
    },
    {
      id: "fc-published-willset",
      front: "¿Cuándo emite un `@Published`?",
      back: "En el `willSet`: el suscriptor recibe el valor nuevo por parámetro mientras la propiedad todavía tiene el viejo. Además emite el valor actual al suscribirse.",
    },
    {
      id: "fc-binding-cycle",
      front: "Ciclo de retención típico en binding de UIKit",
      back: "VC → view model → closure `onStateChange` → VC (si captura `self` fuerte). Con Combine: VC → `cancellables` → closure del `sink` → VC. Se rompe con `[weak self]`.",
      code: "viewModel.onStateChange = { [weak self] state in\n    self?.render(state)\n}",
    },
    {
      id: "fc-inputs-outputs",
      front: "Inputs y outputs de un view model",
      back: "Inputs: métodos que llama la vista (`viewDidLoad()`, `didSelectRow(at:)`). Outputs: lo que escuchan la vista o el coordinator (`onStateChange`, `onSelectProduct`, un publisher). La vista no decide, reenvía.",
    },
    {
      id: "fc-fake-spy",
      front: "Fake/stub vs spy",
      back: "Fake/stub: devuelve datos preparados (éxito o error). Spy: además registra cómo lo llamaron (`removedIDs`, contador) para verificarlo en el test.",
    },
    {
      id: "fc-test-task",
      front: "El view model hace `Task { await load() }` y el test falla. ¿Qué hacés?",
      back: "Testeá la versión `async` (`await viewModel.load()`) o guardá el `Task` y hacé `await task.value`. Nunca `Task.sleep` para 'esperar un poco'.",
    },
    {
      id: "fc-coordinator",
      front: "¿Qué hace un coordinator?",
      back: "Es dueño de la navegación de un flujo: crea view models y VCs, inyecta dependencias y decide qué pantalla sigue escuchando los outputs. Protocolo mínimo: `childCoordinators` + `start()`.",
    },
    {
      id: "fc-child-release",
      front: "¿Cómo evitás leaks con child coordinators?",
      back: "El padre retiene al hijo en `childCoordinators` mientras dura el flujo y lo saca cuando el hijo avisa que terminó (`removeAll { $0 === child }`). En el `onFinish` capturá `[weak self, weak child]`.",
    },
    {
      id: "fc-router-path",
      front: "Router en SwiftUI: `NavigationPath` o `[Route]`?",
      back: "Ambos sirven para `NavigationStack(path:)`. `NavigationPath` acepta tipos mezclados pero borra los tipos; `[Route]` te deja leer y testear el stack (por ejemplo, después de un deep link).",
    },
    {
      id: "fc-deeplink",
      front: "¿Cómo estructurás el ruteo de deep links?",
      back: "Una función pura `URL → DeepLink?` (testeable, `nil` para URLs desconocidas) y el coordinator raíz o router que resetea la navegación y apila las pantallas de esa ruta. En SwiftUI entra por `.onOpenURL`.",
    },
  ],

  exam: [
    {
      id: "ex-first-step",
      question: "Revisás un PR que toca un VC de 1200 líneas con red, `UserDefaults` y navegación. Querés empezar a testearlo sin reescribir todo. ¿Cuál es el primer paso más razonable?",
      options: [
        "Reescribir la pantalla en SwiftUI",
        "Sacar la red detrás de un protocolo inyectado por `init` y mover el estado de carga a un view model",
        "Agregar tests de UI que naveguen hasta la pantalla",
        "Partir el VC en tres `extension` en archivos distintos",
      ],
      answer: 1,
      explanation: "Inyectar la dependencia de red te deja usar un fake, y el view model hace testeable el estado. Separar en extensions solo reparte las líneas; reescribir en SwiftUI es otro proyecto; los tests de UI son lentos y no aíslan la lógica.",
    },
    {
      id: "ex-impossible-state",
      question: "QA reporta que a veces se ven a la vez el spinner y el mensaje de error. ¿Qué cambio previene esta clase de bug?",
      code: "@Observable final class ProductListViewModel {\n    var isLoading = false\n    var errorMessage: String?\n    var products: [Product] = []\n}",
      options: [
        "Poner `isLoading = false` al principio del `catch`",
        "Usar `didSet` en `errorMessage` para apagar `isLoading`",
        "Marcar la clase `@MainActor`",
        "Reemplazar las tres propiedades por un `enum` de estado con `loading`, `loaded` y `failed`",
      ],
      answer: 3,
      explanation: "Con tres propiedades independientes hay combinaciones inválidas que algún camino de código termina produciendo. Un enum hace que la pantalla esté en un solo estado a la vez: el compilador te impide el estado imposible. Las otras opciones parchean un caso puntual.",
    },
    {
      id: "ex-owner-wrapper",
      question: "Una vista crea su propio `ProductListViewModel` marcado `@Observable` (iOS 17). ¿Cómo lo declara?",
      options: [
        "`@State private var viewModel = ProductListViewModel(service: service)`",
        "`@StateObject private var viewModel = ProductListViewModel(service: service)`",
        "`@ObservedObject var viewModel = ProductListViewModel(service: service)`",
        "`let viewModel = ProductListViewModel(service: service)`",
      ],
      answer: 0,
      explanation: "Para `@Observable`, el dueño usa `@State`, que conserva la instancia entre renders. `@StateObject`/`@ObservedObject` requieren `ObservableObject`. Con un `let` en la struct, cada vez que el padre recrea la vista se crea un view model nuevo y se pierde el estado.",
    },
    {
      id: "ex-vm-uikit-types",
      question: "En code review ves esto en un view model. ¿Cuál es el problema principal?",
      code: "import UIKit\n\n@MainActor @Observable\nfinal class ProductDetailViewModel {\n    var priceColor: UIColor = .label\n    // ...\n    priceColor = product.isOnSale ? .systemRed : .label\n}",
      options: [
        "`UIColor` no es `Sendable` y no compila con `@MainActor`",
        "`@Observable` no puede observar propiedades de tipos de UIKit",
        "Acopla el view model a UIKit: mejor exponer un dato semántico (`isOnSale`) y que la vista elija el color",
        "Debería usar `Color` de SwiftUI en lugar de `UIColor`",
      ],
      answer: 2,
      explanation: "El view model describe *qué* mostrar, no *cómo*. Exponer `isOnSale: Bool` lo deja independiente del framework, reusable en SwiftUI y UIKit, y fácil de testear. Cambiar a `Color` cambia de framework pero el acoplamiento sigue.",
    },
    {
      id: "ex-published-old-value",
      question: "Dentro de este `sink`, el log siempre muestra el estado anterior. ¿Por qué?",
      code: "viewModel.$state\n    .sink { [weak self] _ in\n        guard let self else { return }\n        log(self.viewModel.state)\n    }\n    .store(in: &cancellables)",
      options: [
        "Porque falta `receive(on: DispatchQueue.main)`",
        "Porque `[weak self]` hace una copia del view model",
        "Porque `@Published` emite en el `willSet`: la propiedad todavía no cambió; hay que usar el valor del parámetro",
        "Porque `store(in:)` retrasa las emisiones un ciclo del run loop",
      ],
      answer: 2,
      explanation: "`@Published` publica antes de guardar el valor nuevo. El valor correcto es el parámetro del closure. Agregar `receive(on:)` puede ocultar el síntoma (al leer más tarde ya cambió), pero no es la causa.",
    },
    {
      id: "ex-vc-leak",
      question: "Memory Graph muestra que `ProductListViewController` sigue vivo después del pop. ¿Qué línea lo causa?",
      code: "override func viewDidLoad() {\n    super.viewDidLoad()\n    viewModel.$state\n        .sink { state in self.render(state) }\n        .store(in: &cancellables)\n}",
      options: [
        "El `sink` captura `self` fuerte: VC → `cancellables` → closure → VC",
        "`store(in:)` retiene al view model para siempre",
        "`$state` crea un publisher global que no se libera",
        "Falta cancelar las suscripciones en `viewWillDisappear`",
      ],
      answer: 0,
      explanation: "El VC es dueño de `cancellables`, que es dueño de la suscripción, que es dueña del closure, que retiene al VC. Con `[weak self]` se rompe el ciclo y al liberarse el VC se cancelan las suscripciones solas.",
    },
    {
      id: "ex-flaky-init-task",
      question: "El view model arranca la carga con `Task { await load() }` dentro de `init`. Los tests que leen `state` justo después de crearlo fallan. ¿Qué cambio es el más sano?",
      options: [
        "Agregar `try await Task.sleep(for: .milliseconds(100))` antes del `#expect`",
        "Correr los tests en un hilo de background",
        "Hacer el fake más rápido",
        "No disparar trabajo en `init`: exponer `func load() async` y que la vista la llame (`.task`) y el test haga `await`",
      ],
      answer: 3,
      explanation: "Trabajo escondido en `init` no se puede esperar ni controlar. Con `load()` async, el test hace `await viewModel.load()` y es determinístico. Los `sleep` hacen tests lentos e intermitentes.",
    },
    {
      id: "ex-child-leak",
      question: "Cada vez que el usuario completa el checkout, la memoria sube unos MB y no baja. El `AppCoordinator` hace esto. ¿Qué falta?",
      code: "func showCheckout(cart: Cart) {\n    let checkout = CheckoutCoordinator(navigationController: nav, cart: cart)\n    checkout.onFinish = { [weak self] in self?.showOrderConfirmation() }\n    childCoordinators.append(checkout)\n    checkout.start()\n}",
      options: [
        "Marcar `CheckoutCoordinator` como `struct`",
        "Sacar al hijo de `childCoordinators` en `onFinish`",
        "Usar `unowned self` en lugar de `weak self`",
        "Llamar a `start()` antes de `append`",
      ],
      answer: 1,
      explanation: "El padre retiene al hijo para que viva durante el flujo, pero nunca lo suelta: cada checkout deja un coordinator (y lo que retiene) vivo. En `onFinish` hay que hacer `childCoordinators.removeAll { $0 === checkout }`, capturando `checkout` con `weak`.",
    },
    {
      id: "ex-who-decides",
      question: "Después de un login exitoso hay que mostrar el home. ¿Dónde vive esa decisión en MVVM-C?",
      options: [
        "En el coordinator padre, que escucha el `onFinish` del flujo de login",
        "En `LoginViewModel`, que crea el `HomeViewController`",
        "En `LoginViewController`, en el callback del botón",
        "En el `SceneDelegate`, que observa `UserDefaults`",
      ],
      answer: 0,
      explanation: "El login solo informa 'terminé'. Qué viene después depende del contexto (onboarding, deep link pendiente, home), y eso lo sabe el coordinator padre. Así el flujo de login se reusa en otros contextos.",
    },
    {
      id: "ex-deeplink-path",
      question: "La app está mostrando Productos → Detalle(7) cuando llega `shop://favorites`. Con este router, ¿cómo queda el stack?",
      code: "func handle(_ url: URL) {\n    guard let link = deepLink(from: url) else { return }\n    path = NavigationPath()\n    switch link {\n    case .productList: break\n    case .productDetail(let id): path.append(Route.productDetail(id: id))\n    case .favorites: path.append(Route.favorites)\n    }\n}",
      options: [
        "Productos → Detalle(7) → Favoritos",
        "Solo Favoritos, sin la raíz",
        "Productos → Favoritos",
        "No cambia: `NavigationPath` ignora rutas repetidas",
      ],
      answer: 2,
      explanation: "El router resetea el path (vuelve a la raíz, Productos) y apila `Route.favorites`. La raíz del `NavigationStack` no es parte del path, así que siempre queda. Resetear antes evita stacks raros cuando el link llega en medio de otro flujo.",
    },
    {
      id: "ex-testable-router",
      question: "Querés un test unitario que verifique que `shop://products/42` deja el stack en `[.productDetail(id: 42)]`. ¿Qué cambio en el router lo hace posible?",
      options: [
        "Hacer `Route` `Codable`",
        "Cambiar `var path = NavigationPath()` por `var path: [Route] = []`",
        "Mover el router dentro de la vista raíz como `@State`",
        "Usar `@ObservationIgnored` en `path`",
      ],
      answer: 1,
      explanation: "`NavigationPath` borra los tipos: podés saber `count` pero no leer sus elementos. Con `[Route]` el test hace `#expect(router.path == [.productDetail(id: 42)])`. `NavigationStack(path:)` acepta un binding a cualquier colección de valores `Hashable`.",
    },
    {
      id: "ex-composition",
      question: "En una entrevista te preguntan: en MVVM-C, ¿quién crea el `ProductListViewModel` y le pasa el `ProductService`?",
      options: [
        "El propio `ProductListViewController` en `viewDidLoad`",
        "Un singleton `ServiceLocator.shared` que consulta el view model",
        "El view model se crea a sí mismo con un `static let shared`",
        "El coordinator: arma view model y VC inyectando dependencias, y conecta los outputs a su navegación",
      ],
      answer: 3,
      explanation: "El coordinator es el punto de composición del flujo: recibe las dependencias, crea view model y VC, y conecta outputs como `onSelectProduct`. El VC recibe el view model ya armado, y el view model recibe protocolos que en tests son fakes.",
    },
  ],
};

export default content;
