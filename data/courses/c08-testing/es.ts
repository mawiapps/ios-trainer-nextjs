import type { CourseContent } from "../types";

// El código Swift va con String.raw para no perder las barras de `\(...)` ni de `\.keyPath`.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "xctest-basics",
      title: "XCTest desde cero",
      goal: "Escribir tests con `XCTestCase` siguiendo Arrange–Act–Assert, usar las aserciones correctas (`XCTUnwrap`, `XCTAssertThrowsError`) y testear código `async`.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Anatomía de un test",
          body: [
            "Un test de XCTest es un método de una subclase de `XCTestCase` cuyo nombre empieza con `test`, no recibe parámetros y no devuelve nada (puede ser `throws` y/o `async`). Xcode los descubre solo; no hay que registrarlos.",
            "`setUp()` corre antes de **cada** test y `tearDown()` después de cada uno: cada test arranca con un objeto nuevo y no comparte estado con el anterior. Al objeto bajo prueba se lo suele llamar `sut` (system under test).",
            "Ordená el cuerpo en tres bloques: **Arrange** (preparar), **Act** (una sola acción) y **Assert** (verificar). Para el nombre usá `test_<unidad>_<condición>_<resultado>`: cuando falla en CI, el nombre ya te dice qué se rompió.",
            "`@testable import` te da acceso a lo `internal` del módulo. No lo uses para tocar cosas `private`: si necesitás eso, el diseño te está pidiendo una dependencia inyectable.",
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
          prompt: "¿Cuántos tests ejecuta Xcode en esta clase?",
          code: swift`final class SessionTests: XCTestCase {
    func testLogin() { XCTAssertTrue(true) }
    func checkLogout() { XCTAssertTrue(true) }
    func testFetch(id: Int) { XCTAssertEqual(id, 1) }
    func test_refresh() async throws { XCTAssertTrue(true) }
}`,
          options: ["1 test", "2 tests", "3 tests", "4 tests"],
          answer: 1,
          explanation:
            "Corren `testLogin` y `test_refresh`. `checkLogout` no empieza con `test`, así que es un método común. `testFetch(id:)` recibe un parámetro y XCTest solo descubre métodos sin parámetros. `async throws` está permitido.",
        },
        {
          kind: "explain",
          title: "Las aserciones que usás todos los días",
          body: [
            "`XCTAssertEqual(a, b)` muestra los dos valores cuando falla, por eso es mejor que `XCTAssertTrue(a == b)`. Para booleanos y opcionales: `XCTAssertTrue`, `XCTAssertFalse`, `XCTAssertNil`, `XCTAssertNotNil`. `XCTFail(\"mensaje\")` marca una falla a mano.",
            "`XCTUnwrap` desenvuelve un opcional y, si es `nil`, **tira un error** que corta el test. Por eso el test tiene que ser `throws`. Es la alternativa segura al `!`, que crashearía el proceso de tests entero.",
            "`XCTAssertThrowsError(try expr) { error in ... }` verifica que se tire un error y te deja inspeccionar cuál. Después podés seguir verificando estado: por ejemplo, que el saldo no haya cambiado.",
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
          prompt: "Completá la aserción que desenvuelve el opcional y corta el test si es `nil`.",
          code: swift`func test_firstUser_isAdmin() throws {
    let users = try loadFixtureUsers()
    let first = try ____(users.first)
    XCTAssertTrue(first.isAdmin)
}`,
          accept: ["^XCTUnwrap$"],
          hint: "Empieza con `XCT` y el test es `throws`.",
          explanation: "`try XCTUnwrap(users.first)` devuelve el `User` o tira un error que marca el test como fallido sin crashear.",
        },
        {
          kind: "predict",
          prompt: "La lista está vacía. ¿Qué pasa al correr el test?",
          code: swift`func test_firstAdmin_isAna() throws {
    let users: [User] = []
    let admin = try XCTUnwrap(users.first(where: \.isAdmin))
    XCTAssertEqual(admin.name, "Ana")
    print("llegó al final")
}`,
          options: [
            "Crashea el proceso de tests, como un force unwrap",
            "Pasa: `XCTUnwrap` ignora los `nil`",
            "Falla en `XCTUnwrap` y el resto del test no se ejecuta",
            "Falla dos veces: en `XCTUnwrap` y en `XCTAssertEqual`",
          ],
          answer: 2,
          explanation:
            "`XCTUnwrap` registra la falla y tira un error. Como el método es `throws`, el error sale del test y las líneas siguientes no corren: no hay segunda falla ni `print`. Con `!` sí habrías crasheado y perdido el reporte del resto de los tests.",
        },
        {
          kind: "explain",
          title: "Tests asíncronos",
          body: [
            "Si el código es `async`, el test también: `func test_x() async throws` y usás `await` como en cualquier lado. XCTest espera a que termine.",
            "Para APIs viejas con completion handler usá una expectativa: `expectation(description:)`, la cumplís con `fulfill()` y esperás con `await fulfillment(of:timeout:)` (en un test síncrono, `wait(for:timeout:)`). Si nadie llama a `fulfill()`, el test falla al vencer el timeout.",
            "Nunca uses `sleep` para \"darle tiempo\" al código: hace el test lento y flaky. Esperá algo concreto.",
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
          prompt: "Completá la espera de la expectativa en un test `async`.",
          code: swift`func test_upload_callsCompletion() async {
    let exp = expectation(description: "upload finished")
    Uploader().upload(file) { _ in exp.fulfill() }
    await ____(of: [exp], timeout: 2)
}`,
          accept: ["^fulfillment$"],
          hint: "En un test síncrono sería `wait(for:timeout:)`; en uno `async`, otra función.",
          explanation: "`await fulfillment(of:timeout:)` es la versión `async` de `wait(for:timeout:)`. Usar `wait` dentro de un test `async` bloquea el hilo y Xcode te avisa.",
        },
        {
          kind: "write",
          prompt:
            "Tenés `struct Stack<Element>` con `push(_:)`, `pop() -> Element?` e `isEmpty`. Escribí dos tests con XCTest: `pop()` en una pila vacía devuelve `nil`, y después de `push(1)` y `push(2)`, `pop()` devuelve `2`. Usá Arrange–Act–Assert y nombres `test_<unidad>_<condición>_<resultado>`.",
          starter: swift`import XCTest
@testable import Toolkit

final class StackTests: XCTestCase {
    // tus tests acá
}`,
          checks: [
            { pattern: "final\\s+class\\s+StackTests\\s*:\\s*XCTestCase", label: "La clase hereda de `XCTestCase`" },
            { pattern: "func\\s+test_?\\w+\\(\\)", label: "Métodos que empiezan con `test` y no reciben parámetros" },
            { pattern: "XCTAssertNil\\(", label: "Verifica el caso vacío con `XCTAssertNil`" },
            { pattern: "XCTAssertEqual\\(", label: "Verifica el valor con `XCTAssertEqual`" },
          ],
          warnings: [{ pattern: "print\\(", label: "Un test no imprime: afirma con `XCTAssert...`" }],
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
          hint: "Un test por comportamiento. En el segundo, verificá también que quedó un elemento.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "swift-testing",
      title: "Swift Testing: `@Test` y `#expect`",
      goal: "Escribir tests con el framework nuevo de Apple: `@Test`, `#expect`, `#require`, suites, tests parametrizados, tags y traits, conviviendo con XCTest.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "El framework nuevo",
          body: [
            "Swift Testing viene con Xcode 16 y Swift 6. Importás `Testing`, marcás funciones con `@Test` (sin prefijo `test` obligatorio) y verificás con un solo macro: `#expect(expresión)`. Cuando falla, muestra el valor de cada lado de la expresión.",
            "Los tests pueden vivir en un `struct` (o `class`/`actor`). Se crea una instancia nueva por cada test, así que el `init` reemplaza a `setUp` y las propiedades `let` ya quedan frescas. Si necesitás limpiar algo al final, usá una `class` o `actor` con `deinit`.",
            "`@Test(\"Nombre legible\")` le pone un nombre para humanos en el reporte. Por defecto los tests corren **en paralelo**, incluso dentro de un mismo suite: el estado compartido se nota enseguida.",
          ],
          code: swift`import Testing
@testable import Shop

struct PriceFormatterTests {
    let sut = PriceFormatter(currencyCode: "USD")

    @Test("Los montos enteros no muestran decimales")
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
          prompt: "¿Cuántas fallas (issues) reporta este test?",
          code: swift`@Test func profileName() throws {
    let user: User? = nil
    #expect(user != nil)
    let unwrapped = try #require(user)
    #expect(unwrapped.name == "Ana")
}`,
          options: [
            "1: solo el primer `#expect`; después sigue y termina",
            "1: solo el `#require`",
            "3: una por cada línea con macro",
            "2: el `#expect` y el `#require`; la última línea no se ejecuta",
          ],
          answer: 3,
          explanation:
            "`#expect` registra la falla y **sigue**. `#require` registra la falla y **tira un error**, que corta el test. Por eso la última línea nunca corre. Regla práctica: `#require` para precondiciones (desenvolver, validar setup) y `#expect` para el resto.",
        },
        {
          kind: "explain",
          title: "`#require` y errores",
          body: [
            "`try #require(opcional)` es el `XCTUnwrap` de Swift Testing: devuelve el valor o corta el test. También acepta condiciones: `try #require(items.count == 3)`.",
            "Para verificar errores: `#expect(throws: BankError.self) { ... }` acepta cualquier error de ese tipo y `#expect(throws: ValidationError.empty) { ... }` exige ese valor exacto (el error tiene que ser `Equatable`). Para afirmar que algo **no** tira, `#expect(throws: Never.self) { ... }`.",
            "No mezcles: dentro de un `@Test` usá `#expect`; `XCTAssert...` no se reporta bien ahí.",
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
          prompt: "Completá el macro que desenvuelve el opcional y corta el test si es `nil`.",
          code: swift`@Test func firstOrderIsPending() throws {
    let orders = try OrderFixtures.load()
    let first = try ____(orders.first)
    #expect(first.status == .pending)
}`,
          accept: ["^#require$"],
          hint: "Es un macro, empieza con `#`.",
          explanation: "`try #require(orders.first)` devuelve el `Order` o registra la falla y corta el test, igual que `XCTUnwrap`.",
        },
        {
          kind: "explain",
          title: "Tests parametrizados",
          body: [
            "`@Test(arguments: coleccion)` corre la función una vez por cada elemento, y cada caso aparece por separado en el reporte: si falla `\"ana@\"`, ves exactamente cuál. Reemplaza al `for` dentro de un test, que se corta en la primera falla y no te dice qué caso fue.",
            "Con dos colecciones, `@Test(arguments: a, b)` prueba el **producto cartesiano** (todas las combinaciones). Si querés pares uno a uno (entrada, resultado esperado), usá `zip(a, b)`.",
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
          prompt: "¿Cuántos casos ejecuta este test?",
          code: swift`@Test(arguments: [1, 2, 3], ["a", "b"])
func combo(number: Int, letter: String) {
    #expect(!"\(number)\(letter)".isEmpty)
}`,
          options: [
            "6 casos: todas las combinaciones",
            "3 casos: se emparejan y sobra uno",
            "2 casos: manda la colección más corta",
            "5 casos: uno por cada valor",
          ],
          answer: 0,
          explanation:
            "Con dos colecciones, Swift Testing hace el producto cartesiano: 3 × 2 = 6. Si quisieras emparejar (como `zip`, que corta en la más corta), tenés que pasar `zip([1, 2, 3], [\"a\", \"b\"])` y serían 2 casos.",
        },
        {
          kind: "explain",
          title: "Suites, tags y traits",
          body: [
            "`@Suite` agrupa y le aplica traits a todos los tests de adentro. Los **tags** se declaran en una extensión de `Tag` y sirven para filtrar en Xcode o en el test plan (por ejemplo, correr solo `.checkout`).",
            "Traits útiles: `.disabled(\"motivo\")` (el test se compila pero no corre, y el motivo queda en el reporte), `.enabled(if: condición)`, `.timeLimit(.minutes(1))`, `.bug(\"URL del ticket\")` y `.serialized`, que hace que los tests de un suite no corran en paralelo entre sí.",
            "Swift Testing y XCTest conviven en el mismo target: podés migrar archivo por archivo. Lo que sigue siendo XCTest: UI tests (`XCUIApplication`) y tests de performance (`measure`).",
          ],
          code: swift`extension Tag {
    @Tag static var checkout: Self
}

@Suite("Carrito", .tags(.checkout))
struct CartTests {
    @Test func addsItem() { /* ... */ }

    @Test(.disabled("Esperando el fix del backend"), .bug("https://jira.example.com/SHOP-812"))
    func appliesGiftCard() { /* ... */ }

    @Test(.timeLimit(.minutes(1)))
    func recalculatesBigCart() async { /* ... */ }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el trait que deja el test compilando pero sin ejecutarse, con un motivo visible en el reporte.",
          code: swift`@Test(.____("Flaky en CI, ver SHOP-903"))
func syncsInBackground() async { /* ... */ }`,
          accept: ["^disabled$"],
          hint: "Lo contrario de `.enabled(if:)`.",
          explanation: "`.disabled(\"motivo\")` es mejor que comentar el test: sigue compilando (no se pudre) y el motivo aparece en el reporte.",
        },
        {
          kind: "write",
          prompt:
            "Migrá este archivo a Swift Testing. Los tres palíndromos tienen que ser **un solo** test parametrizado con `arguments:`; el caso negativo puede ser otro `@Test`. Verificá con `#expect`.",
          starter: swift`import XCTest
@testable import TextKit

final class PalindromeTests: XCTestCase {
    func test_palindromes() {
        XCTAssertTrue(isPalindrome("neuquen"))
        XCTAssertTrue(isPalindrome("Anita lava la tina"))
        XCTAssertTrue(isPalindrome(""))
    }

    func test_notPalindrome() {
        XCTAssertFalse(isPalindrome("swift"))
    }
}`,
          checks: [
            { pattern: "^import\\s+Testing", label: "Importa `Testing`" },
            { pattern: "@Test\\s*\\(\\s*arguments:", label: "Test parametrizado con `arguments:`" },
            { pattern: ":\\s*String\\s*\\)", label: "La función recibe el `String` del caso" },
            { pattern: "#expect\\(", label: "Verifica con `#expect`" },
          ],
          warnings: [
            { pattern: "XCTAssert", label: "En Swift Testing no uses `XCTAssert...`" },
            { pattern: "XCTestCase", label: "Ya no hace falta heredar de `XCTestCase`" },
          ],
          solution: swift`import Testing
@testable import TextKit

struct PalindromeTests {
    @Test(arguments: ["neuquen", "Anita lava la tina", ""])
    func recognizesPalindromes(_ text: String) {
        #expect(isPalindrome(text))
    }

    @Test func rejectsNonPalindrome() {
        #expect(!isPalindrome("swift"))
    }
}`,
          hint: "`@Test(arguments: [...]) func nombre(_ text: String)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "test-doubles",
      title: "Dobles de prueba: stub, spy, fake y mock",
      goal: "Elegir el doble correcto para cada dependencia, escribirlo a mano a partir de un protocolo y saber cuándo conviene generarlo.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Sin protocolo no hay doble",
          body: [
            "Para reemplazar una dependencia en un test, el código tiene que recibirla por `init` como un protocolo, no crearla adentro (`URLSession.shared`, `Date()`, `UserDefaults.standard`). Eso es inyección de dependencias, y es lo que hace testeable a un view model.",
            "Los cinco tipos de doble: **dummy** (se pasa para que compile, nunca se usa), **stub** (devuelve respuestas fijas), **fake** (implementación real pero simplificada, como un repositorio en memoria), **spy** (graba las llamadas para verificarlas después) y **mock** (viene programado con las llamadas que espera y se verifica a sí mismo).",
            "En el día a día, \"mock\" se usa para cualquier doble. En una entrevista conviene saber la diferencia: te la preguntan.",
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
          prompt: "¿Qué tipo de doble es este?",
          code: swift`final class InMemoryUserRepository: UserRepository {
    private var storage: [String: User] = [:]

    func save(_ user: User) { storage[user.id] = user }
    func find(id: String) -> User? { storage[id] }
    func delete(id: String) { storage[id] = nil }
}`,
          options: ["Stub", "Spy", "Fake", "Dummy"],
          answer: 2,
          explanation:
            "Tiene comportamiento real (guardar, buscar, borrar) pero con un atajo: un diccionario en vez de una base de datos. Eso es un fake. Un stub devolvería siempre lo mismo y un spy grabaría las llamadas para verificarlas.",
        },
        {
          kind: "explain",
          title: "Stubs y spies a mano",
          body: [
            "Un **stub** controla lo que *entra* al sistema: el test decide si el servicio responde bien o tira error. Con un `Result` cubrís los dos caminos con un solo tipo.",
            "Un **spy** observa lo que *sale*: eventos de analytics, navegación, mensajes enviados. Guarda las llamadas en un array y el test las verifica al final.",
            "Escribirlos a mano lleva 5 líneas y se leen solos. Primero verificá el **estado** (`sut.name`); usá spies solo para efectos que no se ven en el estado.",
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
          prompt: "El stub tira error. ¿Qué imprime?",
          code: swift`// En ProfileViewModel:
func load(id: String) async {
    analytics.track("profile_requested")
    do {
        name = try await service.fetchProfile(id: id).name
        analytics.track("profile_loaded")
    } catch {
        analytics.track("profile_failed")
    }
}

// En el test:
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
            "Primero se trackea `profile_requested`. El `try await` tira, así que `profile_loaded` nunca se ejecuta y se salta al `catch`, que trackea `profile_failed`. El array imprime los strings con comillas.",
        },
        {
          kind: "fill",
          prompt: "Completá el spy para que grabe cada monto cobrado.",
          code: swift`final class PaymentGatewaySpy: PaymentGateway {
    private(set) var chargedAmounts: [Int] = []

    func charge(cents: Int) async throws {
        chargedAmounts.____(cents)
    }
}`,
          accept: ["^append$"],
          explanation: "`append` agrega al final, así el test puede verificar cantidad y orden: `#expect(spy.chargedAmounts == [1_500])`.",
        },
        {
          kind: "explain",
          title: "Mocks y dobles generados",
          body: [
            "Un mock verifica **interacciones**: qué métodos se llamaron, cuántas veces y en qué orden. Es útil cuando la interacción *es* el comportamiento (\"se cobró exactamente una vez\"). Usado para todo, acopla el test a la implementación y cualquier refactor lo rompe.",
            "En proyectos grandes los dobles se generan. **Mockolo** (de Uber) lee protocolos anotados con `/// @mockable` y genera clases `...Mock` con contadores de llamadas y handlers. **Sourcery** hace lo mismo con plantillas como `AutoMockable`. Se corren como build phase o en CI.",
            "Regla de equipo razonable: a mano para lo chico y lo que se lee en el PR; generados cuando hay decenas de protocolos y nadie quiere mantenerlos.",
          ],
          code: swift`/// @mockable
protocol TokenStore {
    func token() -> String?
    func save(_ token: String)
}

// Mockolo genera TokenStoreMock con, entre otras cosas:
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
          prompt: "Después de un refactor que no cambia nada visible para el usuario, este test se rompe. ¿Cuál es el diagnóstico?",
          code: swift`func test_checkout() {
    let mock = PaymentMock()
    mock.expect(calls: ["validateCard", "reserveStock", "charge", "sendReceipt"])
    sut.checkout(cart)
    mock.verify()
}
// Refactor: reserveStock ahora corre antes que validateCard.`,
          options: [
            "El refactor introdujo un bug: hay que revertirlo",
            "Falta un `sleep` antes de `verify()`",
            "Hay que agregar más llamadas esperadas al mock",
            "El test está sobreespecificado: verifica el orden interno en vez del resultado",
          ],
          answer: 3,
          explanation:
            "El comportamiento no cambió, pero el test fijaba detalles internos. Mejor: un stub para el pago y verificar el resultado (pedido confirmado, monto cobrado una vez, recibo enviado) sin exigir un orden que al negocio no le importa.",
        },
        {
          kind: "write",
          prompt:
            "`OrderNotifier` recibe un `NotificationSender`. Escribí `NotificationSenderSpy`, que grabe cada mensaje y su destinatario, y un `@Test` que verifique que `orderShipped(id:userID:)` envía **un** mensaje al usuario correcto.",
          starter: swift`protocol NotificationSender {
    func send(_ message: String, to userID: String) async throws
}

struct OrderNotifier {
    let sender: NotificationSender

    func orderShipped(id: String, userID: String) async throws {
        try await sender.send("Tu pedido \(id) salió", to: userID)
    }
}

// Spy y test acá`,
          checks: [
            { pattern: "class\\s+\\w*Spy\\s*:\\s*NotificationSender", label: "Un spy que conforma `NotificationSender`" },
            { pattern: "var\\s+\\w+\\s*:\\s*\\[", label: "Guarda las llamadas en un array" },
            { pattern: "\\.append\\(", label: "Graba cada llamada con `append`" },
            { pattern: "@Test", label: "Un test con `@Test`" },
            { pattern: "#expect\\(", label: "Verifica con `#expect`" },
          ],
          warnings: [{ pattern: "XCTAssert", label: "En un `@Test` usá `#expect`, no `XCTAssert`" }],
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
    #expect(spy.sent.first?.message == "Tu pedido A-42 salió")
}`,
          hint: "Un array de tuplas `(message: String, userID: String)` alcanza.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "hard-parts",
      title: "Lo difícil de testear: tiempo, disco, red y main actor",
      goal: "Volver determinístico el código que depende del reloj, de `UserDefaults`, de la red o de `@MainActor`, sin tocar producción más de lo necesario.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El reloj es una dependencia",
          body: [
            "`Date()` adentro de la lógica hace que el resultado dependa de cuándo corre el test. Inyectá el \"ahora\": una closure `now: () -> Date` alcanza. En producción pasás `Date.init`; en el test, una fecha fija.",
            "Lo mismo vale para `Calendar` y `TimeZone`: un test sobre \"es de mañana\" que usa `Calendar.current` pasa en Buenos Aires y falla en el runner de CI que está en UTC.",
            "Para esperas y timeouts (`Task.sleep`, debounce), inyectá un `any Clock<Duration>`. En tests podés usar el `TestClock` o `ImmediateClock` de la librería swift-clocks de Point-Free, y avanzar el tiempo a mano en vez de esperarlo.",
          ],
          code: swift`struct TrialPolicy {
    let now: () -> Date

    func isExpired(startedAt start: Date) -> Bool {
        now().timeIntervalSince(start) > 14 * 86_400
    }
}

// Producción
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
          prompt: "Este test se escribió el 2 de noviembre de 2026 y pasó. ¿Qué va a pasar con él?",
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
            "Empieza a fallar a mediados de noviembre: depende del reloj real",
            "Falla siempre: `ISO8601DateFormatter` devuelve `nil` con ese formato",
            "Pasa siempre: la fecha está fija en el test",
            "No compila: `Date()` no se puede usar dentro de un `struct`",
          ],
          answer: 0,
          explanation:
            "La fecha de inicio está fija, pero el \"ahora\" no: `Date()` avanza. A partir del 15 de noviembre pasaron más de 14 días y el test se pone rojo sin que nadie haya tocado código. Es un clásico de CI roto un lunes. Solución: inyectar `now`.",
        },
        {
          kind: "explain",
          title: "`UserDefaults` sin pisar nada",
          body: [
            "`UserDefaults.standard` es estado global: un test que lo escribe contamina al siguiente (y al simulador). Inyectá `UserDefaults` y en el test creá uno propio con `UserDefaults(suiteName:)`.",
            "Usá un nombre único por test (un `UUID` alcanza) y borrá el dominio al terminar con `removePersistentDomain(forName:)`. En Swift Testing, una `class` como suite te da `init` y `deinit` para eso.",
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
          prompt: "Completá el inicializador que crea un `UserDefaults` aislado para el test.",
          code: swift`let defaults = UserDefaults(____: "test.settings.\(UUID().uuidString)")!`,
          accept: ["^suiteName$"],
          explanation: "`UserDefaults(suiteName:)` crea (o abre) un dominio separado. Con un nombre único por test, nada se cruza con `.standard` ni con otros tests en paralelo.",
        },
        {
          kind: "explain",
          title: "Red: stub con `URLProtocol`",
          body: [
            "Para testear tu cliente HTTP de punta a punta (armado de la request, status codes, decoding) sin salir a internet, registrá un `URLProtocol` propio en la configuración de la sesión. Toda request de esa sesión pasa por él y vos decidís qué responde.",
            "El `handler` es estático, o sea compartido: marcá el suite con `.serialized` o los tests en paralelo se pisan entre sí. Para tests de view model no hace falta todo esto: alcanza con stubbear un protocolo `HTTPClient`.",
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
          prompt: "Alguien comentó una línea sin querer. ¿Qué pasa al correr el test?",
          code: swift`let config = URLSessionConfiguration.ephemeral
// config.protocolClasses = [URLProtocolStub.self]
let client = APIClient(session: URLSession(configuration: config))

URLProtocolStub.handler = { _ in (okResponse, productsFixture) }
let products = try await client.fetchProducts()
#expect(products.count == 3)`,
          options: [
            "Funciona igual: `URLProtocolStub` se registra solo al heredar de `URLProtocol`",
            "No compila: falta configurar `protocolClasses`",
            "La request sale a la red real: el test pasa a depender de la conexión y del backend",
            "Crashea porque `handler` queda en `nil`",
          ],
          answer: 2,
          explanation:
            "Sin `protocolClasses`, la sesión usa los protocolos por defecto y `URLProtocolStub` nunca se consulta. El test hace un request de verdad: lento, falla sin conexión y su resultado depende de datos del servidor. Es un test flaky disfrazado de unit test.",
        },
        {
          kind: "explain",
          title: "View models en `@MainActor`",
          body: [
            "Un view model `@MainActor` se testea desde un test `@MainActor`: `@Test @MainActor func ...() async` (en XCTest, marcá el método o la clase con `@MainActor`). Así accedés a sus propiedades sin `await` y sin warnings de concurrencia.",
            "La clave es que el método que hace el trabajo sea `async` y el test lo pueda `await`. Si el view model dispara un `Task { }` suelto (fire-and-forget), el test no tiene a qué esperar. Dejá el `Task` en la vista (`.task { await vm.load() }`) o guardalo en una propiedad para que el test haga `await sut.loadTask?.value`.",
            "Para callbacks o eventos, Swift Testing tiene `confirmation`: el test falla si la confirmación no se cumple la cantidad de veces esperada (una, por defecto).",
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
    await confirmation("guardado") { saved in
        let sut = Editor(onSave: { saved() })
        await sut.save()
    }
}`,
        },
        {
          kind: "predict",
          prompt: "¿Qué pasa con este test?",
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
    let sut = FeedViewModel(service: FeedServiceStub(posts: ["Hola"]))
    sut.onAppear()
    #expect(sut.posts == ["Hola"])
}`,
          options: [
            "Pasa: el `Task` hereda el main actor y corre en el acto",
            "Falla: el `Task` recién puede correr cuando el test suelta el main actor, después del `#expect`",
            "No compila: no se puede crear un `Task` dentro de `@MainActor`",
            "Pasa porque `@Observable` espera a que `posts` cambie",
          ],
          answer: 1,
          explanation:
            "`Task { }` se encola en el main actor, pero el test lo está ocupando y nunca suspende (no hay `await`). El `#expect` corre con `posts` vacío. Arreglo: `func load() async` y en el test `await sut.load()`.",
        },
        {
          kind: "write",
          prompt:
            "Hacé testeable a `Greeter`: inyectá `let now: () -> Date` (y el calendario) en vez de leer `Date()` y `Calendar.current`. Después escribí un `@Test` que fije la hora a las 9:00 UTC y verifique \"Buen día\".",
          starter: swift`struct Greeter {
    func greeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        return hour < 12 ? "Buen día" : "Buenas tardes"
    }
}`,
          checks: [
            { pattern: "let\\s+now\\s*:\\s*(@escaping\\s*)?\\(\\)\\s*->\\s*Date", label: "Inyecta `let now: () -> Date`" },
            { pattern: "now\\(\\)", label: "La lógica usa `now()`" },
            { pattern: "@Test", label: "Un test con `@Test`" },
            { pattern: "#expect\\(", label: "Verifica con `#expect`" },
          ],
          warnings: [{ pattern: "from:\\s*Date\\(\\)", label: "Seguís leyendo el reloj real con `Date()`" }],
          solution: swift`struct Greeter {
    let now: () -> Date
    var calendar = Calendar(identifier: .gregorian)

    func greeting() -> String {
        let hour = calendar.component(.hour, from: now())
        return hour < 12 ? "Buen día" : "Buenas tardes"
    }
}

@Test func morningBeforeNoon() {
    var utc = Calendar(identifier: .gregorian)
    utc.timeZone = TimeZone(identifier: "UTC")!
    let nineAM = Date(timeIntervalSince1970: 9 * 3_600) // 1970-01-01 09:00 UTC
    let sut = Greeter(now: { nineAM }, calendar: utc)

    #expect(sut.greeting() == "Buen día")
}`,
          hint: "Si no fijás la zona horaria del calendario, el test depende de dónde corre.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "beyond-unit",
      title: "Más allá del unit test: snapshots, UI tests y CI",
      goal: "Saber qué testear en cada nivel de la pirámide, escribir snapshot y UI tests estables, y diagnosticar tests flaky y métricas de cobertura engañosas.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "La pirámide en un equipo real",
          body: [
            "**Muchos unit tests** (milisegundos cada uno): reglas de negocio, view models, reducers, parsers. **Algunos de integración**: cliente HTTP con `URLProtocol`, persistencia con un store en memoria. **Pocos UI tests**: solo los flujos que si se rompen cuestan plata (login, compra, onboarding).",
            "Los snapshot tests van en el medio: renderizan una vista y la comparan con una imagen guardada. Atrapan regresiones visuales sin levantar la app entera.",
            "Una suite con la pirámide invertida (muchos UI tests, pocos unit tests) es lenta, frágil y te dice *que* algo se rompió pero no *qué*.",
          ],
          code: swift`// Targets típicos de una app mediana
ShopTests            // unit + integración (Swift Testing / XCTest)
ShopSnapshotTests    // swift-snapshot-testing
ShopUITests          // XCUITest: 5–15 flujos críticos

// CI de cada PR:     ShopTests + ShopSnapshotTests
// CI nocturno:       todo, incluidos UI tests en varios dispositivos`,
        },
        {
          kind: "predict",
          prompt: "Este es el reporte de CI de tu equipo. ¿Qué cambio tiene más impacto?",
          code: swift`ShopUITests     410 tests   48 min   7 flaky por semana
ShopTests        35 tests    9 s     0 flaky`,
          options: [
            "Agregar reintentos automáticos a todos los UI tests",
            "Paralelizar en más simuladores y dejar los tests como están",
            "Borrar los UI tests y depender de QA manual",
            "Bajar las verificaciones de lógica a unit tests y dejar pocos UI tests de flujos críticos",
          ],
          answer: 3,
          explanation:
            "Casi todo lo que verifican 410 UI tests (validaciones, cálculos, estados de error) se puede verificar en unit tests de view models en milisegundos y sin flakiness. Los reintentos y la paralelización esconden el problema; borrar todo pierde la red de seguridad de los flujos críticos.",
        },
        {
          kind: "explain",
          title: "Snapshot tests",
          body: [
            "Con swift-snapshot-testing (Point-Free), `assertSnapshot(of:as:)` renderiza la vista con una estrategia (`.image`, `.recursiveDescription`, `.dump`...) y la compara con el archivo en `__Snapshots__/`. Si no existe referencia, la graba y el test **falla** para que la revises y la commitees.",
            "Para regrabar a propósito usás el modo record (`withSnapshotTesting(record: .all) { ... }` o el parámetro `record:` en la aserción). Revisá el diff de las imágenes en el PR como revisás código.",
            "El problema típico: el render cambia entre versiones de iOS o modelos de simulador. Fijá un único simulador y versión en CI y grabá con esa misma configuración. Testeá variantes que importan: modo oscuro, Dynamic Type grande, idioma largo.",
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
          prompt: "Completá la estrategia que compara la vista como imagen.",
          code: swift`assertSnapshot(of: viewController, as: .____(on: .iPhone13))`,
          accept: ["^image$"],
          explanation: "`.image(on:)` renderiza en el tamaño y los traits de ese dispositivo y compara píxeles con la referencia guardada.",
        },
        {
          kind: "explain",
          title: "XCUITest bien hecho",
          body: [
            "Los UI tests corren en **otro proceso**: no pueden tocar el código de la app. Se comunican por `launchArguments` y `launchEnvironment`, que la app lee al arrancar para usar servicios stub, limpiar estado o saltar el onboarding.",
            "Buscá elementos por `accessibilityIdentifier`, no por el texto visible: el texto cambia con el idioma y con el copy, el identifier no (y VoiceOver no lo lee). Usá un formato tipo `pantalla.elemento`.",
            "Esperá con `waitForExistence(timeout:)`, nunca con `sleep`. Poné `continueAfterFailure = false` para que el test se corte en el primer paso roto.",
          ],
          code: swift`// App
Button("Pagar") { model.pay() }
    .accessibilityIdentifier("checkout.payButton")

// Al arrancar la app
if ProcessInfo.processInfo.arguments.contains("-uiTesting") {
    container.useStubbedServices()
}

// Target ShopUITests
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
          prompt: "Este UI test pasa en tu máquina y falla en el test plan de CI que corre con la configuración \"English\". ¿Por qué?",
          code: swift`// Vista: Button(String(localized: "Pagar")) { ... }
app.buttons["Pagar"].tap()`,
          options: [
            "La etiqueta está localizada (\"Pay\"): hay que buscar por `accessibilityIdentifier`",
            "En CI el botón tarda más: falta un `sleep(2)`",
            "`app.buttons` solo funciona en el idioma del sistema del Mac",
            "Los UI tests no pueden correr en otro idioma",
          ],
          answer: 0,
          explanation:
            "El subscript `app.buttons[\"...\"]` matchea por identifier o por label. Sin identifier usa el label visible, que en inglés es \"Pay\". Con `.accessibilityIdentifier(\"checkout.payButton\")` el test funciona en cualquier idioma.",
        },
        {
          kind: "write",
          prompt:
            "Prepará `LoginView` para UI testing (identifiers en el campo y el botón) y escribí `test_login_showsHome`: lanzá la app con `-uiTesting`, escribí un email, tocá el botón y esperá que aparezca `home.title`.",
          starter: swift`// App
struct LoginView: View {
    @State private var email = ""
    var body: some View {
        VStack {
            TextField("Email", text: $email)
            Button("Entrar") { /* ... */ }
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
            { pattern: "\\.accessibilityIdentifier\\(\"", label: "Identifiers estables en la vista" },
            { pattern: "launchArguments", label: "Configura `launchArguments`" },
            { pattern: "\\.launch\\(\\)", label: "Lanza la app con `launch()`" },
            { pattern: "waitForExistence\\(timeout:", label: "Espera con `waitForExistence(timeout:)`" },
          ],
          warnings: [
            { pattern: "sleep\\(", label: "No uses `sleep`: esperá un elemento concreto" },
            { pattern: "buttons\\[\"(Entrar|Log in)\"\\]", label: "Buscás el botón por su texto localizado" },
          ],
          solution: swift`// App
struct LoginView: View {
    @State private var email = ""
    var body: some View {
        VStack {
            TextField("Email", text: $email)
                .accessibilityIdentifier("login.email")
            Button("Entrar") { /* ... */ }
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
          hint: "Antes de `typeText` el campo tiene que tener foco: tocá el campo primero.",
        },
        {
          kind: "explain",
          title: "Test plans, cobertura y tests flaky",
          body: [
            "Un **test plan** (`.xctestplan`) define qué targets corren y con qué configuraciones: idiomas, variables de entorno, sanitizers (Thread Sanitizer para data races), orden aleatorio y ejecución en paralelo. Podés tener uno para PRs y otro nocturno.",
            "La **cobertura** mide qué líneas se *ejecutaron*, no qué se *verificó*. Un test sin aserciones sube la cobertura igual. Usala para encontrar código sin tests, no como meta: \"80% obligatorio\" produce tests vacíos.",
            "Causas típicas de flakiness: estado compartido (singletons, `UserDefaults.standard`, statics), reloj real, dependencia del orden, `Task` sin esperar, red real, animaciones. Para reproducirlo: correr el test muchas veces hasta que falle. Mientras lo arreglás, ponelo en cuarentena (`.disabled` con ticket), no lo borres.",
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
          prompt: "Xcode marca `PriceCalculator.swift` con 100% de cobertura. ¿Qué garantiza este test?",
          code: swift`func test_applyDiscount() {
    _ = PriceCalculator().apply(code: "SAVE10", to: 1_000)
    _ = PriceCalculator().apply(code: "BOGUS", to: 1_000)
}`,
          options: [
            "Que los descuentos se calculan bien",
            "Que el código bajo prueba no tiene bugs",
            "Solo que ese código corre sin crashear: ningún resultado está verificado",
            "Nada: la cobertura de Xcode está mal configurada",
          ],
          answer: 2,
          explanation:
            "Cobertura = líneas ejecutadas. Sin `XCTAssertEqual` ni `#expect`, cualquier resultado pasa: `apply` podría devolver 0 siempre. Un reviewer tiene que mirar las aserciones, no el porcentaje.",
        },
        {
          kind: "fill",
          prompt: "Completá el flag de `xcodebuild` que repite el test hasta que falle, para cazar un flaky.",
          code: swift`xcodebuild test -scheme Shop -only-testing:ShopTests/SyncTests -test-iterations 200 -____`,
          accept: ["^run-tests-until-failure$", "^-run-tests-until-failure$"],
          explanation: "`-test-iterations N -run-tests-until-failure` corre hasta N veces y frena en la primera falla, dejando el log de esa ejecución. También existe `-retry-tests-on-failure`, pero ese solo esconde el problema.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: carrito de compras con TDD",
      goal: "Construir un carrito con TDD (rojo → verde → refactor), con descuentos, envío y casos borde, usando todo lo del curso.",
      minutes: 30,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Producto te pasa las reglas del carrito: (1) agregar el mismo SKU suma cantidades; (2) cantidad `<= 0` tira `CartError.invalidQuantity`; (3) el subtotal es la suma de `precio × cantidad`, en centavos (`Int`, nunca `Double` para plata); (4) el código `SAVE10` descuenta 10% del subtotal, redondeando hacia abajo; (5) envío de 500 centavos si el monto con descuento es menor a 5000, gratis desde 5000 o si el carrito está vacío.",
            "Lo vas a hacer con TDD: **rojo** (un test que falla, aunque sea porque no compila), **verde** (el código mínimo para que pase) y **refactor** (limpiar con los tests en verde). Un ciclo por regla.",
            "Este es el primer test. No compila porque `Cart` no existe: eso ya cuenta como rojo.",
          ],
          code: swift`import Testing
@testable import Shop

@Suite("Carrito")
struct CartTests {
    @Test func emptyCartHasZeroSubtotal() {
        let cart = Cart()
        #expect(cart.subtotalCents == 0)
    }
}
// ROJO: error de compilación "cannot find 'Cart' in scope"`,
        },
        {
          kind: "predict",
          prompt: "Tenés el test en rojo. Según TDD, ¿cuál es el siguiente paso?",
          code: swift`// Rojo: "cannot find 'Cart' in scope"`,
          options: [
            "Implementar el carrito completo con descuentos y envío, ya que conocés las reglas",
            "Escribir el mínimo para que pase, aunque sea `struct Cart { let subtotalCents = 0 }`",
            "Escribir los tests de todas las reglas antes de tocar producción",
            "Refactorizar el test para que use `XCTestCase`",
          ],
          answer: 1,
          explanation:
            "Verde con el código más simple posible. Parece tonto, pero te obliga a que el **próximo test** sea el que fuerce la lógica real (agregar ítems). Así cada línea de producción existe porque un test la pidió, y el refactor se hace con red de seguridad.",
        },
        {
          kind: "write",
          prompt:
            "Rojo de las reglas 1 y 2. Agregá a `CartTests` dos tests: agregar dos veces el SKU `\"TSHIRT\"` (cantidades 1 y 2, 2000 centavos) deja **un** ítem con cantidad 3; agregar con cantidad 0 tira `CartError.invalidQuantity`. La API es `mutating func add(sku:priceCents:quantity:) throws`.",
          starter: swift`import Testing
@testable import Shop

struct CartTests {
    @Test func emptyCartHasZeroSubtotal() {
        #expect(Cart().subtotalCents == 0)
    }

    // tests nuevos acá
}`,
          checks: [
            { pattern: "@Test\\s+func\\s+\\w+\\(\\)\\s*throws", label: "Un test `throws` para poder llamar a `add`" },
            { pattern: "\\.add\\(", label: "Usa `add(sku:priceCents:quantity:)`" },
            { pattern: "items\\.count\\s*==\\s*1|items\\.first\\?\\.quantity\\s*==\\s*3", label: "Verifica que se fusionó en un ítem" },
            { pattern: "#expect\\(\\s*throws:\\s*CartError\\.invalidQuantity", label: "Verifica el error con `#expect(throws:)`" },
          ],
          warnings: [{ pattern: "XCTAssert", label: "En Swift Testing usá `#expect`" }],
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
          hint: "Para el error: `#expect(throws: CartError.invalidQuantity) { try ... }`.",
        },
        {
          kind: "write",
          prompt:
            "Verde. Implementá `CartError` y `Cart` como `struct` para que pasen los tests: `items`, `subtotalCents` calculado y `add(sku:priceCents:quantity:)` que valida y fusiona por SKU.",
          starter: swift`struct CartItem: Equatable {
    let sku: String
    let priceCents: Int
    var quantity: Int
}

// Implementá CartError y Cart`,
          checks: [
            { pattern: "enum\\s+CartError\\s*:\\s*(Swift\\.)?Error", label: "`CartError` es un `enum` que conforma `Error`" },
            { pattern: "struct\\s+Cart\\b", label: "`Cart` es un `struct`" },
            { pattern: "var\\s+subtotalCents\\s*:\\s*Int", label: "`subtotalCents: Int` calculado" },
            { pattern: "mutating\\s+func\\s+add\\(", label: "`add` es `mutating`" },
            { pattern: "throw\\s+CartError\\.invalidQuantity", label: "Tira `CartError.invalidQuantity`" },
          ],
          warnings: [
            { pattern: "class\\s+Cart\\b", label: "Structs por defecto: `Cart` no necesita identidad" },
            { pattern: "\\b(Double|Float)\\b", label: "Plata en centavos con `Int`, no en punto flotante" },
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
          hint: "`firstIndex(where:)` para encontrar el SKU y `guard` para validar la cantidad.",
        },
        {
          kind: "predict",
          prompt: "Ya implementaste descuento y envío. Con un solo ítem de 5500 centavos, ¿qué imprime?",
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
            "Con `SAVE10`: descuento 550, queda 4950, que es menor a 5000, así que se suma envío: 4950 + 500 = 5450. Sin código: 5500 ≥ 5000, envío gratis: 5500. El caso borde (el descuento te saca del envío gratis) es exactamente el que tiene que estar en un test.",
        },
        {
          kind: "write",
          prompt:
            "Cubrí `totalCents(discountCode:)` con **un** test parametrizado: con `SAVE10` y un ítem de precio 1000, 5500, 6000 y 10000 centavos, los totales esperados son 1400, 5450, 5400 y 9000. Emparejá precios y resultados con `zip`.",
          starter: swift`import Testing
@testable import Shop

// test parametrizado acá`,
          checks: [
            { pattern: "@Test\\s*\\(\\s*arguments:", label: "Test parametrizado con `arguments:`" },
            { pattern: "zip\\(", label: "Empareja entrada y resultado con `zip`" },
            { pattern: "totalCents\\(", label: "Ejercita `totalCents`" },
            { pattern: "#expect\\(", label: "Verifica con `#expect`" },
          ],
          warnings: [
            { pattern: "XCTAssert", label: "En Swift Testing usá `#expect`" },
            { pattern: "for\\s+\\w+\\s+in", label: "Un `for` adentro del test esconde qué caso falló" },
          ],
          solution: swift`import Testing
@testable import Shop

@Test(arguments: zip([1_000, 5_500, 6_000, 10_000], [1_400, 5_450, 5_400, 9_000]))
func totalWithSave10(priceCents: Int, expected: Int) throws {
    var cart = Cart()
    try cart.add(sku: "ITEM", priceCents: priceCents, quantity: 1)

    #expect(cart.totalCents(discountCode: "SAVE10") == expected)
}`,
          hint: "1000 → 900 + 500 de envío; 6000 → 5400, ya sin envío.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-setup-vs-init",
      front: "¿Qué reemplaza a `setUp`/`tearDown` en Swift Testing?",
      back: "El `init` del suite (se crea una instancia nueva por test) y, para limpiar, `deinit` en un suite `class` o `actor`.",
    },
    {
      id: "fc-xctunwrap",
      front: "¿Por qué `XCTUnwrap` y no `!` en un test?",
      back: "`!` con `nil` crashea el proceso de tests y perdés el reporte del resto. `try XCTUnwrap(x)` marca la falla y corta solo ese test.",
      code: "let user = try XCTUnwrap(users.first)",
    },
    {
      id: "fc-expect-require",
      front: "`#expect` vs `#require`",
      back: "`#expect` registra la falla y sigue. `try #require` registra la falla y corta el test; además desenvuelve opcionales. `#require` para precondiciones.",
    },
    {
      id: "fc-arguments",
      front: "`@Test(arguments: a, b)` con dos colecciones: ¿cuántos casos?",
      back: "El producto cartesiano: `a.count × b.count`. Para emparejar uno a uno, `arguments: zip(a, b)`.",
    },
    {
      id: "fc-expect-throws",
      front: "¿Cómo verificás que se tira un error específico en Swift Testing?",
      back: "`#expect(throws: MiError.caso) { try ... }` (el error tiene que ser `Equatable`). Para cualquier error del tipo: `#expect(throws: MiError.self)`.",
    },
    {
      id: "fc-stub-spy",
      front: "Stub vs spy",
      back: "El stub controla lo que **entra** (respuestas fijas). El spy graba lo que **sale** (llamadas, eventos) para verificarlo después.",
    },
    {
      id: "fc-fake-mock",
      front: "Fake vs mock",
      back: "Un fake es una implementación funcional simplificada (repositorio en memoria). Un mock viene programado con las llamadas esperadas y se verifica a sí mismo.",
    },
    {
      id: "fc-overspecified",
      front: "Síntoma de un test sobreespecificado",
      back: "Se rompe con refactors que no cambian el comportamiento, porque verifica orden o cantidad de llamadas internas en vez del resultado.",
    },
    {
      id: "fc-clock",
      front: "¿Cómo testeás lógica que depende de la fecha actual?",
      back: "Inyectando el ahora (`now: () -> Date`) o un `Clock`, y fijando también `Calendar`/`TimeZone`. Nunca `Date()` dentro de la lógica.",
    },
    {
      id: "fc-userdefaults",
      front: "`UserDefaults` en tests",
      back: "Inyectalo y creá uno con `UserDefaults(suiteName:)` con nombre único; al final `removePersistentDomain(forName:)`.",
    },
    {
      id: "fc-urlprotocol",
      front: "¿Cómo stubbeás la red sin cambiar el cliente HTTP?",
      back: "Una subclase de `URLProtocol` registrada en `URLSessionConfiguration.protocolClasses` que responde con datos fijos.",
      code: "let config = URLSessionConfiguration.ephemeral\nconfig.protocolClasses = [URLProtocolStub.self]",
    },
    {
      id: "fc-a11y-id",
      front: "¿Por qué `accessibilityIdentifier` en UI tests?",
      back: "No depende del idioma ni del copy, y VoiceOver no lo lee. Buscar por texto visible rompe el test al traducir o cambiar un label.",
    },
    {
      id: "fc-snapshot-first",
      front: "¿Qué pasa la primera vez que corre un `assertSnapshot`?",
      back: "Graba la imagen de referencia en `__Snapshots__/` y el test falla, para que la revises y la commitees.",
    },
    {
      id: "fc-coverage",
      front: "¿Qué mide la cobertura de código?",
      back: "Líneas ejecutadas por los tests, no comportamiento verificado. Sirve para encontrar código sin tests, no como objetivo.",
    },
    {
      id: "fc-tdd",
      front: "Ciclo de TDD",
      back: "Rojo (un test que falla), verde (el mínimo código para que pase), refactor (limpiar con los tests en verde). Un comportamiento por ciclo.",
    },
  ],

  exam: [
    {
      id: "ex-01",
      question: "Un view model crea adentro `let api = APIClient()` y llama a `URLSession.shared`. En el PR te piden tests. ¿Qué cambio sugerís primero?",
      options: [
        "Escribir UI tests que cubran la pantalla",
        "Usar method swizzling sobre `URLSession` en los tests",
        "Inyectar la dependencia por `init` como protocolo y usar un stub en los tests",
        "Hacer `api` una variable global para poder reemplazarla",
      ],
      answer: 2,
      explanation: "Inyección por `init` con un protocolo es lo que permite pasar un stub sin trucos. Swizzling y globales agregan estado compartido y tests frágiles; los UI tests son lentos para verificar lógica.",
    },
    {
      id: "ex-02",
      question: "¿Qué hace este test si `user` es `nil`?",
      code: "@Test func avatar() throws {\n    let user = try #require(repo.current)\n    #expect(user.avatarURL != nil)\n}",
      options: [
        "Registra una falla en `#require` y termina el test sin evaluar el `#expect`",
        "Crashea el proceso de tests",
        "Pasa, porque `#require` ignora `nil`",
        "Registra dos fallas",
      ],
      answer: 0,
      explanation: "`#require` registra la falla y tira un error; el test sale y el `#expect` no se evalúa.",
    },
    {
      id: "ex-03",
      question: "Tenés 12 tests de validación de email que son un `for` sobre un array de casos dentro de un solo test. Falla en CI. ¿Qué mejora conviene?",
      options: [
        "Agregar `print` de cada caso para saber cuál falló",
        "Separarlos en 12 métodos copiados",
        "Marcar el test como `.serialized`",
        "Convertirlo en `@Test(arguments:)` para que cada caso se reporte por separado",
      ],
      answer: 3,
      explanation: "Con un test parametrizado cada argumento es un caso independiente en el reporte: ves exactamente qué email falló y los demás siguen corriendo.",
    },
    {
      id: "ex-04",
      question: "Necesitás verificar que al cerrar sesión se envía el evento `logout` a analytics. ¿Qué doble usás para `Analytics`?",
      options: ["Un dummy", "Un spy", "Un fake de base de datos", "Un stub que devuelve `nil`"],
      answer: 1,
      explanation: "Es un efecto de salida que no se ve en el estado del view model: el spy graba los eventos y el test verifica `spy.events == [\"logout\"]`.",
    },
    {
      id: "ex-05",
      question: "Un test de \"oferta válida hasta fin de mes\" pasó todo el mes y falló el día 1. ¿Cuál es la causa más probable y el arreglo?",
      options: [
        "El simulador cambió de versión; fijar el simulador",
        "La lógica lee el reloj real; inyectar `now: () -> Date` y fijar la fecha en el test",
        "Falta `.timeLimit`; agregarlo",
        "Los tests corren en paralelo; agregar `.serialized`",
      ],
      answer: 1,
      explanation: "Un test que cambia de resultado según la fecha depende de `Date()`. Inyectando el ahora (y el calendario) el test es determinístico.",
    },
    {
      id: "ex-06",
      question: "Dos tests de un suite escriben `UserDefaults.standard` y fallan de forma intermitente, pero pasan si los corrés solos. ¿Qué hacés?",
      options: [
        "Agregar `sleep(1)` entre las escrituras",
        "Borrar `UserDefaults.standard` al principio de cada test",
        "Correr toda la suite en un solo hilo",
        "Inyectar `UserDefaults` y darle a cada test uno propio con `UserDefaults(suiteName:)` único",
      ],
      answer: 3,
      explanation: "El problema es el estado compartido con ejecución en paralelo. Un dominio propio por test elimina la dependencia; serializar o borrar el estándar solo lo disimula.",
    },
    {
      id: "ex-07",
      question: "Querés testear que tu `APIClient` arma bien la request (headers, path) y decodifica un 404 en tu error de dominio, sin salir a internet. ¿Qué usás?",
      options: [
        "Un `URLProtocol` stub registrado en `protocolClasses` de una `URLSessionConfiguration`",
        "Un stub del protocolo `APIClient`",
        "Un UI test con la app apuntando a producción",
        "Un snapshot test del JSON",
      ],
      answer: 0,
      explanation: "Para probar el cliente en sí necesitás que su código corra de verdad sobre `URLSession`; el `URLProtocol` stub intercepta la request y devuelve la respuesta que elijas. Stubbear `APIClient` saltearía justo lo que querés probar.",
    },
    {
      id: "ex-08",
      question: "¿Qué pasa con este test?",
      code: "@Test @MainActor func refresh() {\n    let sut = InboxViewModel(service: InboxStub(count: 3))\n    sut.refresh() // adentro: Task { unread = await service.unread() }\n    #expect(sut.unread == 3)\n}",
      options: [
        "Pasa siempre",
        "No compila",
        "Falla: el `Task` no corre hasta que el test suelte el main actor",
        "Pasa solo en dispositivos reales",
      ],
      answer: 2,
      explanation: "El test es síncrono en el main actor y nunca suspende, así que el `Task` encolado corre después del `#expect`. Hacé `refresh() async` y en el test `await sut.refresh()`.",
    },
    {
      id: "ex-09",
      question: "Los snapshot tests pasan en tu Mac y fallan en CI con diferencias mínimas de píxeles en todas las vistas. ¿Qué es lo más probable?",
      options: [
        "Un bug en SwiftUI",
        "Falta `continueAfterFailure = false`",
        "Las referencias están en `.gitignore`",
        "CI usa otro simulador o versión de iOS que el que grabó las referencias",
      ],
      answer: 3,
      explanation: "El render varía entre modelos y versiones de iOS. Fijá un simulador y versión en CI y grabá las referencias con esa misma configuración.",
    },
    {
      id: "ex-10",
      question: "Un UI test hace `app.buttons[\"Continuar\"].tap()` y después `sleep(3)` antes de verificar la pantalla siguiente. ¿Qué cambiarías?",
      options: [
        "Subir el `sleep` a 5 segundos para CI",
        "Usar `accessibilityIdentifier` y esperar con `waitForExistence(timeout:)`",
        "Reemplazarlo por un snapshot test",
        "Correrlo en CI con `-retry-tests-on-failure`",
      ],
      answer: 1,
      explanation: "El texto visible cambia con el idioma y el copy; el `sleep` hace el test lento cuando sobra y flaky cuando no alcanza. Identifier + espera explícita es estable.",
    },
    {
      id: "ex-11",
      question: "El equipo pide subir la cobertura mínima de 60% a 90% en CI. ¿Cuál es el riesgo principal?",
      options: [
        "Que se escriban tests que ejecutan código sin verificar nada, solo para llegar al número",
        "Que Xcode deje de compilar",
        "Que los UI tests no cuenten para la cobertura",
        "Ninguno: más cobertura siempre es mejor",
      ],
      answer: 0,
      explanation: "La cobertura mide líneas ejecutadas, no aserciones. Como meta dura incentiva tests vacíos; es más útil revisar en el PR que la lógica nueva tenga tests con aserciones reales.",
    },
    {
      id: "ex-12",
      question: "Con TDD, escribiste un test rojo para \"el código SAVE10 da 10% de descuento\". ¿Qué hacés después de verlo en verde?",
      options: [
        "Pasar al siguiente requisito sin tocar nada",
        "Borrar el test porque ya cumplió su función",
        "Refactorizar el código (y los tests) manteniendo todo en verde, y después escribir el siguiente test rojo",
        "Agregar todos los demás descuentos de una vez",
      ],
      answer: 2,
      explanation: "El ciclo es rojo → verde → refactor. El refactor con red de seguridad es lo que mantiene el código limpio; después viene el próximo test que falla.",
    },
  ],
};

export default content;
