import type { CourseContent } from "../types";

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "structs-classes",
      title: "Structs vs clases: copia o referencia",
      goal: "Predecir qué pasa al asignar, pasar o mutar un struct o una clase, y evitar el bug de compartir una instancia entre pantallas.",
      minutes: 14,
      steps: [
        {
          kind: "explain",
          title: "Value types y reference types",
          body: [
            "`struct` y `enum` son **value types**: al asignar o pasar a una función se copian. Cambiar la copia no toca el original.",
            "`class` es un **reference type**: la variable guarda una referencia al objeto. Dos variables pueden apuntar al mismo objeto y lo que cambies por una se ve por la otra.",
            "En Swift moderno el default es `struct`. Usá `class` cuando necesitás identidad compartida (un objeto que varios observan), herencia o interoperar con UIKit/Objective-C.",
          ],
          code: `struct Point { var x: Int }
var a = Point(x: 1)
var b = a          // copia
b.x = 99
print(a.x, b.x)

final class Counter { var value = 0 }
let c1 = Counter()
let c2 = c1        // misma instancia
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
          options: ["`Bea`", "`Ana`", "Error de compilación: `session` es `let`", "`Optional(\"Ana\")`"],
          answer: 1,
          explanation: "`session.user` es un struct: `var draft = session.user` hace una copia. Cambiar `draft.name` no toca el `user` guardado en la sesión, así que imprime `Ana`.",
        },
        {
          kind: "explain",
          title: "`mutating` y `let`",
          body: [
            "Un método de struct que cambia propiedades tiene que marcarse `mutating`: está reemplazando el valor entero de `self`.",
            "`let` sobre un struct congela **todo** el valor: no podés cambiar propiedades ni llamar métodos `mutating`.",
            "`let` sobre una clase congela solo la **referencia**: no podés apuntarla a otro objeto, pero sí cambiar sus propiedades `var`.",
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
store.items.append("Mate")  // OK: let fija la referencia, no el objeto
print(store.items.count)`,
          output: "[\"Mate\"]\n1",
        },
        {
          kind: "fill",
          prompt: "Completá la palabra clave que permite que este método de struct modifique `count`.",
          code: `struct Stepper {
    var count = 0
    ____ func increment() { count += 1 }
}`,
          accept: ["^mutating$"],
          explanation: "Sin `mutating` el compilador rechaza `count += 1`: dentro de un método normal de struct, `self` es inmutable.",
          placeholder: "palabra clave",
        },
        {
          kind: "explain",
          title: "Copy-on-write y `final class`",
          body: [
            "Copiar un array de 10.000 elementos no cuesta nada... hasta que lo mutás. `Array`, `Dictionary`, `Set` y `String` usan **copy-on-write**: comparten el buffer y copian recién cuando una de las copias cambia.",
            "Ojo: tus propios structs no tienen copy-on-write mágico. Si un struct guarda una clase adentro, al copiarlo se copia la **referencia** y las dos copias comparten ese objeto.",
            "`final class` impide la herencia. Es buena costumbre por defecto: documenta la intención y permite que el compilador use despacho estático.",
          ],
          code: `var original = [1, 2, 3]
var copy = original   // todavía comparten buffer
copy.append(4)        // acá se copia (copy-on-write)
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
          explanation: "`h2` es una copia de `h1`, así que `count` es independiente (`h1.count` sigue en 0). Pero `box` es una clase: la copia del struct copió la referencia y los dos apuntan al mismo `Box`. Por eso `h1.box.value` es 7.",
        },
        {
          kind: "explain",
          title: "El bug real: una instancia compartida entre pantallas",
          body: [
            "Caso típico de guardia: la pantalla de búsqueda y la de favoritos reciben el mismo objeto de filtros. El usuario activa un filtro en favoritos y la búsqueda \"se rompe sola\".",
            "Con una clase, las dos pantallas apuntan al mismo objeto. Con un struct, cada pantalla recibe su copia y los cambios quedan aislados.",
            "Si de verdad querés estado compartido (un carrito global), usá una clase a propósito y que sea observable (`@Observable` en iOS 17, `ObservableObject` antes). Lo malo es compartir **sin querer**.",
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
          prompt: "¿Qué línea **no** compila?",
          code: `struct Profile { var name = "" }
final class Account { var name = "" }

let profile = Profile()
let account = Account()
account.name = "Ana"   // línea A
profile.name = "Bea"   // línea B`,
          options: ["Las dos", "Ninguna", "Solo la línea A", "Solo la línea B"],
          answer: 3,
          explanation: "`profile` es un struct declarado con `let`: todo el valor es inmutable, la línea B falla. `account` es una clase: `let` fija la referencia pero la propiedad `var name` se puede cambiar, la línea A compila.",
        },
        {
          kind: "write",
          prompt: "Convertí `FilterSettings` en un struct para que cada pantalla tenga su propia copia. `toggle()` tiene que seguir funcionando.",
          starter: `final class FilterSettings {
    var onlyAvailable = false
    func toggle() { onlyAvailable.toggle() }
}`,
          checks: [
            { pattern: "\\bstruct\\s+FilterSettings\\b", label: "`FilterSettings` es un struct" },
            { pattern: "\\bmutating\\s+func\\s+toggle\\s*\\(", label: "`toggle()` es `mutating`" },
            { pattern: "\\bvar\\s+onlyAvailable\\b", label: "Mantiene `onlyAvailable` como `var`" },
          ],
          warnings: [{ pattern: "\\bclass\\s+FilterSettings\\b", label: "Sigue siendo una clase: las pantallas comparten la instancia" }],
          solution: `struct FilterSettings {
    var onlyAvailable = false
    mutating func toggle() { onlyAvailable.toggle() }
}`,
          hint: "Cambiá `final class` por `struct` y fijate qué te pide el compilador en el método.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "enums",
      title: "Enums: raw values, associated values y estado de pantalla",
      goal: "Modelar opciones cerradas con enums, extraer datos con `switch` y reemplazar combinaciones de booleanos por estados válidos.",
      minutes: 14,
      steps: [
        {
          kind: "explain",
          title: "Raw values y `CaseIterable`",
          body: [
            "Un enum con raw value (`String`, `Int`) asocia cada caso a un valor fijo. Con `String`, si no ponés nada, el raw value es el nombre del caso. Con `Int`, los siguientes se autoincrementan.",
            "`init?(rawValue:)` es failable: devuelve `nil` si el valor no existe. Muy útil al leer datos de afuera.",
            "`CaseIterable` genera `allCases`, ideal para armar un picker o una lista de filtros.",
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
          explanation: "`mercury = 1`, así que `venus` es 2 y `earth` es 3. `allCases` tiene 3 casos. `Planet(rawValue: 2)!` es `.venus` y `print` de un caso muestra solo su nombre: `venus`.",
        },
        {
          kind: "explain",
          title: "Associated values y pattern matching",
          body: [
            "Cada caso puede cargar datos propios: `case card(last4: String)`. Es la forma de decir \"o es esto con estos datos, o es aquello con estos otros\".",
            "En el `switch` extraés los datos con `let`, ignorás con `_` y filtrás con `where`. El `switch` tiene que ser exhaustivo: si mañana agregás un caso, el compilador te marca cada lugar a actualizar.",
          ],
          code: `enum Payment {
    case cash
    case card(last4: String)
    case transfer(amount: Double, reference: String)
}

func describe(_ payment: Payment) -> String {
    switch payment {
    case .cash:
        return "Efectivo"
    case .card(let last4):
        return "Tarjeta ****\\(last4)"
    case .transfer(let amount, _) where amount > 1000:
        return "Transferencia grande"
    case .transfer:
        return "Transferencia"
    }
}

print(describe(.card(last4: "4242")))
print(describe(.transfer(amount: 5000, reference: "A1")))`,
          output: "Tarjeta ****4242\nTransferencia grande",
        },
        {
          kind: "fill",
          prompt: "Completá la palabra clave que agrega una condición extra al patrón.",
          code: `switch payment {
case .transfer(let amount, _) ____ amount > 1000:
    print("Pedir confirmación")
default:
    break
}`,
          accept: ["^where$"],
          explanation: "`where` agrega una condición al `case`: solo entra si el patrón coincide **y** la condición es verdadera.",
          placeholder: "palabra clave",
        },
        {
          kind: "explain",
          title: "Estado de pantalla: enum en vez de booleanos",
          body: [
            "`isLoading: Bool`, `error: String?` y `items: [String]` dan 8 combinaciones, y varias son imposibles (¿cargando **y** con error?). Cada `if` de la vista tiene que adivinar cuál gana.",
            "Un enum con associated values hace que los estados inválidos no se puedan representar: o está cargando, o tiene datos, o falló con un mensaje.",
            "Evitá `default` en estos `switch`: si agregás `.empty` el día de mañana, querés que el compilador te avise en cada pantalla.",
          ],
          code: `enum ScreenState {
    case loading
    case loaded([String])
    case failed(String)
}

func render(_ state: ScreenState) -> String {
    switch state {
    case .loading: return "Spinner"
    case .loaded(let items) where items.isEmpty: return "Vacío"
    case .loaded(let items): return "\\(items.count) items"
    case .failed(let message): return "Error: \\(message)"
    }
}

print(render(.loaded([])))
print(render(.loaded(["a", "b"])))`,
          output: "Vacío\n2 items",
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
          options: ["`0`", "`2`", "Error de compilación", "`3`"],
          answer: 3,
          explanation: "`for case .loaded(let n) in` recorre solo los elementos que coinciden con el patrón: `.loaded(3)` y `.loaded(0)`. Suma 3 + 0 = 3.",
        },
        {
          kind: "write",
          prompt: "Reemplazá los booleanos por `enum ProfileState` con los casos `loading`, `loaded(name: String)` y `failed(message: String)`. Después escribí `func title(for state: ProfileState) -> String` con un `switch` exhaustivo (sin `default`).",
          starter: `struct ProfileViewState {
    var isLoading = false
    var name: String?
    var errorMessage: String?
}`,
          checks: [
            { pattern: "\\benum\\s+ProfileState\\b", label: "Declara `enum ProfileState`" },
            { pattern: "\\bcase\\s+loading\\b", label: "Caso `loading`" },
            { pattern: "\\bcase\\s+loaded\\(\\s*name\\s*:\\s*String\\s*\\)", label: "Caso `loaded(name: String)`" },
            { pattern: "\\bcase\\s+failed\\(\\s*message\\s*:\\s*String\\s*\\)", label: "Caso `failed(message: String)`" },
            { pattern: "\\bfunc\\s+title\\s*\\(\\s*for\\s+state\\s*:\\s*ProfileState\\s*\\)\\s*->\\s*String", label: "Firma `title(for:) -> String`" },
            { pattern: "\\bswitch\\s+state\\b", label: "Usa `switch state`" },
          ],
          warnings: [
            { pattern: "\\bdefault\\s*:", label: "`default` esconde los casos nuevos que agregues" },
            { pattern: "\\bisLoading\\b", label: "Sigue habiendo booleanos de estado" },
          ],
          solution: `enum ProfileState {
    case loading
    case loaded(name: String)
    case failed(message: String)
}

func title(for state: ProfileState) -> String {
    switch state {
    case .loading:
        return "Cargando…"
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
      title: "Closures: sintaxis, captura y `[weak self]`",
      goal: "Leer y escribir closures en forma corta, entender qué capturan y saber cuándo hace falta `[weak self]` y cuándo no.",
      minutes: 15,
      steps: [
        {
          kind: "explain",
          title: "De la forma larga a la corta",
          body: [
            "Una closure es una función sin nombre que podés pasar como valor. La forma completa declara parámetros y tipo de retorno; Swift te deja recortar casi todo porque lo infiere.",
            "**Trailing closure**: si el último parámetro es una closure, va afuera de los paréntesis. `$0`, `$1` son los argumentos. Con una sola expresión, el `return` es implícito.",
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
          explanation: "`filter` deja los de más de 3 letras (`swift`, `xcode`) y `map` los pasa a mayúsculas. Un array de strings se imprime con comillas: `[\"SWIFT\", \"XCODE\"]`.",
        },
        {
          kind: "explain",
          title: "Las closures capturan",
          body: [
            "Una closure puede usar variables del contexto donde se creó, aunque ese contexto ya haya terminado. Las **captura por referencia**: ve los cambios posteriores.",
            "Con una **capture list** (`[x]`) copiás el valor en el momento de crear la closure.",
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
          prompt: "¿Qué imprimen las dos llamadas, en orden?",
          code: `var x = 1
let byReference = { print(x) }
let byValue = { [x] in print(x) }
x = 2
byReference()
byValue()`,
          options: ["`1` y `1`", "`2` y `2`", "`2` y `1`", "`1` y `2`"],
          answer: 2,
          explanation: "`byReference` captura la variable `x`: al ejecutarse ve el valor actual, 2. `byValue` usa la capture list `[x]`, que copió el 1 al crear la closure.",
        },
        {
          kind: "explain",
          title: "`@escaping` y `[weak self]`",
          body: [
            "Por defecto un parámetro closure es **non-escaping**: se ejecuta antes de que la función retorne (`map`, `filter`, `sorted`). Si la función la guarda o la llama más tarde, el parámetro tiene que ser `@escaping`.",
            "Un retain cycle aparece cuando `self` retiene (directa o indirectamente) una closure que a su vez retiene `self` con fuerza. Ahí va `[weak self]`.",
            "**No** hace falta en closures non-escaping, en una closure de una sola ejecución que nadie guarda (como `DispatchQueue.main.async`, que solo demora la liberación) ni en structs. El detalle de ARC lo ves en el curso 3; en código nuevo muchas de estas callbacks pasan a `async/await` (curso 6).",
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
          prompt: "La función guarda `completion` para llamarla después de la respuesta. Completá el atributo que falta.",
          code: `func fetchName(completion: ____ (String) -> Void) {
    pending.append(completion)
}`,
          accept: ["^@escaping$"],
          explanation: "Si la closure sobrevive a la llamada (se guarda en una propiedad o se ejecuta más tarde) tiene que marcarse `@escaping`. Sin eso, el compilador no te deja guardarla.",
          placeholder: "atributo",
        },
        {
          kind: "predict",
          prompt: "¿Cuál de estas closures crea un retain cycle si no usa `[weak self]`?",
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
          options: ["Solo B", "Solo A", "A y C", "Las tres"],
          answer: 0,
          explanation: "A es non-escaping: `map` la ejecuta y la suelta. C escapa, pero GCD la libera después de correrla; como mucho demora el `deinit`. B se guarda en `onUpdate`, una propiedad de `self`, y captura `self` fuerte: `self` → closure → `self`. Ese es el ciclo.",
        },
        {
          kind: "write",
          prompt: "`FeedViewModel` es dueño de `RefreshController`, que guarda la closure `onRefresh`. Arreglá el retain cycle capturando `self` débil y usando `guard let self`.",
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
            { pattern: "\\[\\s*weak\\s+self\\s*\\]", label: "Captura `[weak self]`" },
            { pattern: "\\bguard\\s+let\\s+self\\b", label: "Desenvuelve con `guard let self`" },
            { pattern: "self\\.items\\s*=\\s*\\[\\s*\\]", label: "Sigue limpiando `items`" },
          ],
          warnings: [{ pattern: "\\[\\s*unowned\\s+self\\s*\\]", label: "`unowned` crashea si la closure corre después de que `self` se liberó" }],
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
          hint: "La capture list va antes de `in`: `{ [weak self] in ... }`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "error-handling",
      title: "Manejo de errores: `throws`, `Result` y typed throws",
      goal: "Lanzar y atrapar errores propios, elegir entre `try`, `try?` y `try!`, usar `Result` y separar errores de red de errores de dominio.",
      minutes: 15,
      steps: [
        {
          kind: "explain",
          title: "`throws`, `do/catch` y errores propios",
          body: [
            "Un error es cualquier tipo que conforma `Error`; lo más común es un enum, con associated values si necesitás contexto.",
            "Una función `throws` puede lanzar con `throw`. Quien la llama la marca con `try` y la envuelve en `do/catch`, o propaga siendo `throws` también.",
            "Los `catch` se evalúan en orden: podés atrapar un caso puntual y dejar un `catch` genérico al final, donde `error` está disponible implícitamente.",
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
    print("Mínimo \\(minimum) caracteres")
} catch {
    print("Otro error: \\(error)")
}`,
          output: "Mínimo 8 caracteres",
        },
        {
          kind: "predict",
          prompt: "¿Qué líneas imprime, en orden?",
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
          options: ["`a: 4` y `error: notANumber`", "Solo `error: notANumber`", "`a: 4`, `b: 0` y `error: notANumber`", "`a: 4` y `error: ParseError.notANumber`"],
          answer: 0,
          explanation: "`parse(\"4\")` funciona e imprime `a: 4`. `parse(\"x\")` lanza: el resto del `do` se saltea y entra al `catch`. Imprimir un caso de enum sin datos muestra solo su nombre: `error: notANumber`.",
        },
        {
          kind: "explain",
          title: "`try?` y `try!`",
          body: [
            "`try?` convierte el resultado en optional: si lanza, da `nil` y el error se pierde. Sirve cuando el motivo no te importa (un cache que puede no estar). Combinado con `??` da un default.",
            "`try!` crashea si lanza. Solo para casos imposibles por construcción (un JSON embebido en el bundle que vos controlás). En un PR, cada `try!` necesita una buena razón.",
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
let c = try! parse("7")   // crashea si lanza
print(c)`,
          output: "Optional(12) nil\n0\n7",
        },
        {
          kind: "fill",
          prompt: "Querés `nil` si el texto no es un número, sin `do/catch`. Completá.",
          code: `let age: Int? = ____ parse(input)`,
          accept: ["^try\\?$"],
          explanation: "`try?` devuelve un optional: el valor si salió bien, `nil` si lanzó.",
          placeholder: "palabra clave",
        },
        {
          kind: "explain",
          title: "`Result` y typed throws (Swift 6)",
          body: [
            "`Result<Success, Failure>` guarda un éxito o un error como **valor**: útil en callbacks y para guardar el resultado de una operación. `.get()` lo vuelve a convertir en `throws`.",
            "Swift 6 agrega **typed throws**: `throws(NetworkError)` declara exactamente qué error sale. Con `do throws(NetworkError)` el `catch` recibe un `NetworkError`, no un `any Error`, y podés hacer un `switch` exhaustivo.",
            "Usalo para errores cerrados de un módulo o del dominio. Para código general, `throws` a secas sigue siendo lo recomendado: no te ata a un tipo si mañana aparecen otros errores.",
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
        return .failure(error)   // error ya es NetworkError
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
          options: ["`2`", "`5`", "`Optional(5)`", "Lanza `outOfStock`"],
          answer: 1,
          explanation: "`$0.get()` devuelve el valor o lanza el error. `try?` lo vuelve optional y `compactMap` descarta los `nil`: queda `[2, 3]`. La suma es `5`, y no es optional porque `reduce` trabaja sobre `[Int]`.",
        },
        {
          kind: "explain",
          title: "Errores de red vs errores de dominio",
          body: [
            "La capa de red habla de códigos HTTP y sin conexión; la pantalla de checkout habla de \"sesión vencida\" o \"pago rechazado\". Si dejás subir `APIError` hasta la vista, la vista termina sabiendo de códigos HTTP.",
            "Mapeá en el borde: el repositorio o caso de uso traduce `APIError` a un error del dominio que la UI sabe mostrar.",
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
          prompt: "Reescribí `validateAge` para que no crashee: declará `enum AgeError: Error` con `notANumber` y `outOfRange`, hacé la función `throws` y lanzá el error correspondiente (rango válido: 0 a 120).",
          starter: `func validateAge(_ text: String) -> Int {
    return Int(text)!
}`,
          checks: [
            { pattern: "\\benum\\s+AgeError\\s*:\\s*Error\\b", label: "Declara `enum AgeError: Error`" },
            { pattern: "\\bcase\\s+notANumber\\b", label: "Caso `notANumber`" },
            { pattern: "\\boutOfRange\\b", label: "Caso `outOfRange`" },
            { pattern: "func\\s+validateAge\\s*\\([^)]*\\)\\s*throws\\b", label: "La función es `throws`" },
            { pattern: "\\bthrow\\s+(AgeError)?\\.notANumber\\b", label: "Lanza `notANumber` si no se puede convertir" },
            { pattern: "\\bthrow\\s+(AgeError)?\\.outOfRange\\b", label: "Lanza `outOfRange` fuera de rango" },
          ],
          warnings: [
            { pattern: "Int\\([^)]*\\)!", label: "`Int(...)!` crashea con texto inválido" },
            { pattern: "\\btry!", label: "`try!` crashea en producción" },
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
          hint: "Dos `guard`: uno con `Int(text)` y otro con `(0...120).contains(age)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "codable",
      title: "Codable: de JSON a modelos",
      goal: "Decodificar JSON real: snake_case, fechas, campos opcionales, objetos anidados y valores de enum que el backend agregó sin avisar.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Decodable en 5 líneas",
          body: [
            "`Codable` es `Decodable & Encodable`. Si todas las propiedades son `Codable` (`String`, `Int`, `Double`, `Date`, `URL`, arrays, otros structs `Codable`), el compilador genera todo el código.",
            "`JSONDecoder().decode(Tipo.self, from: data)` lanza un `DecodingError` si algo no coincide: falta una clave, cambia un tipo, viene `null` donde no se esperaba.",
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
print(user.nickname ?? "sin apodo")`,
          options: ["`nil`", "Lanza `keyNotFound`", "`sin apodo`", "`Optional(\"sin apodo\")`"],
          answer: 2,
          explanation: "Para una propiedad optional, el código generado usa `decodeIfPresent`: si la clave falta (o viene `null`) queda en `nil` sin error. Después `??` da `sin apodo`. Si `nickname` no fuera optional, sí lanzaría `keyNotFound`.",
        },
        {
          kind: "explain",
          title: "snake_case, `CodingKeys` y fechas",
          body: [
            "`keyDecodingStrategy = .convertFromSnakeCase` traduce `order_id` → `orderId` antes de buscar la propiedad. Ojo: `avatar_url` pasa a `avatarUrl`, no a `avatarURL`.",
            "`CodingKeys` sirve para renombrar a mano (`case rating = \"vote_average\"`). **No mezcles** las dos cosas: con `.convertFromSnakeCase`, la clave ya convertida (`voteAverage`) no coincide con `\"vote_average\"`.",
            "`dateDecodingStrategy = .iso8601` lee `\"2025-03-10T14:30:00Z\"`. No acepta fracciones de segundo (`.123Z`): para eso hace falta `.custom` con un `ISO8601DateFormatter` con `.withFractionalSeconds`.",
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
          prompt: "El backend manda `user_name` y tu struct tiene `userName`. Completá la estrategia.",
          code: `let decoder = JSONDecoder()
decoder.keyDecodingStrategy = ____`,
          accept: ["^\\.convertFromSnakeCase$", "^JSONDecoder\\.KeyDecodingStrategy\\.convertFromSnakeCase$"],
          explanation: "`.convertFromSnakeCase` convierte cada clave `snake_case` del JSON a `camelCase` antes de compararla con tus propiedades.",
          placeholder: ".estrategia",
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
    print("falló")
}`,
          options: ["`falló`", "`8.1`", "`0.0`", "`Optional(8.1)`"],
          answer: 0,
          explanation: "Con `.convertFromSnakeCase` el decoder convierte `vote_average` a `voteAverage` **antes** de buscar. Tu `CodingKey` dice `\"vote_average\"`, que ya no existe: `keyNotFound`, cae al `catch`. Usá una sola de las dos herramientas (o `case rating = \"voteAverage\"`).",
        },
        {
          kind: "explain",
          title: "`init(from:)`: anidados y enums tolerantes",
          body: [
            "Cuando la forma del JSON no coincide con tu modelo, escribís `init(from:)` a mano. `nestedContainer` entra a un objeto anidado y `decodeIfPresent` lee un campo que puede faltar.",
            "El caso clásico de producción: el backend agrega `\"returned\"` a `status` y la app vieja, con un enum sintetizado, falla al decodificar **toda la lista**. Un `init(from:)` en el enum que cae en `.unknown` lo hace tolerante.",
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
          options: ["`[[\"x\"], nil]`", "Lanza `valueNotFound`", "`[[\"x\"]]`", "`[[\"x\"], []]`"],
          answer: 3,
          explanation: "`decodeIfPresent` devuelve `nil` tanto si la clave falta como si vale `null`, y `?? []` lo convierte en array vacío. Los dos items se decodifican: `[[\"x\"], []]`.",
        },
        {
          kind: "write",
          prompt: "El JSON es `{\"user_name\": \"ana\", \"signup_date\": \"2025-01-15T09:00:00Z\", \"bio\": null}`. Completá `Account` con `userName`, `signupDate` y `bio` (puede venir `null`), y configurá `makeDecoder()` con snake_case e ISO 8601. Sin `CodingKeys`.",
          starter: `import Foundation

struct Account: Decodable {
}

func makeDecoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    return decoder
}`,
          checks: [
            { pattern: "\\bstruct\\s+Account\\s*:\\s*(Decodable|Codable)\\b", label: "`Account` es `Decodable`" },
            { pattern: "\\blet\\s+userName\\s*:\\s*String\\b(?!\\?)", label: "`userName: String`" },
            { pattern: "\\blet\\s+signupDate\\s*:\\s*Date\\b", label: "`signupDate: Date`" },
            { pattern: "\\blet\\s+bio\\s*:\\s*String\\?", label: "`bio: String?`" },
            { pattern: "\\.keyDecodingStrategy\\s*=\\s*\\.convertFromSnakeCase\\b", label: "Usa `.convertFromSnakeCase`" },
            { pattern: "\\.dateDecodingStrategy\\s*=\\s*\\.iso8601\\b", label: "Usa `.iso8601`" },
          ],
          warnings: [
            { pattern: "\\b(user_name|signup_date)\\b\\s*:", label: "Propiedades en snake_case: dejá que el decoder convierta" },
            { pattern: "\\bCodingKeys\\b", label: "Con `.convertFromSnakeCase` no hacen falta `CodingKeys` (y mezclarlos rompe)" },
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
      title: "Reto final: el JSON de pedidos",
      goal: "Integrar structs, enums, closures, errores y Codable para convertir un JSON desprolijo en un modelo de dominio confiable.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Te toca el ticket: \"La pantalla de pedidos queda en blanco desde ayer\". El backend empezó a mandar `\"status\": \"on_hold\"`, que la app no conoce, y un pedido sin teléfono trae `\"phone\": null`.",
            "Vas a modelar el pedido con structs, un enum tolerante para `status`, y una función que decodifica y devuelve `Result` con un error de dominio en vez de dejar la pantalla vacía.",
            "Claves en snake_case, fechas ISO 8601, un objeto anidado (`customer`) y un array de líneas (`items`).",
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
          prompt: "Escribí `enum OrderStatus: String, Decodable` con `pending`, `paid`, `shipped` y `unknown`. Un valor desconocido no tiene que romper la decodificación: implementá `init(from:)` y caé en `.unknown`.",
          starter: `enum OrderStatus: String, Decodable {
    case pending, paid, shipped
}`,
          checks: [
            { pattern: "\\benum\\s+OrderStatus\\s*:\\s*String\\s*,\\s*Decodable\\b", label: "`enum OrderStatus: String, Decodable`" },
            { pattern: "\\bunknown\\b", label: "Tiene el caso `unknown`" },
            { pattern: "\\binit\\s*\\(\\s*from\\s+decoder\\s*:\\s*(any\\s+)?Decoder\\s*\\)\\s*throws\\b", label: "Implementa `init(from:)`" },
            { pattern: "singleValueContainer\\s*\\(\\s*\\)", label: "Lee el string con `singleValueContainer()`" },
            { pattern: "\\?\\?\\s*\\.unknown\\b", label: "Cae en `.unknown` con `??`" },
          ],
          warnings: [{ pattern: "\\btry!", label: "`try!` crashea con datos inesperados" }],
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
          prompt: "Producto pide mostrar \"En espera\", así que agregás `case onHold` al enum. El decoder usa `.convertFromSnakeCase`. ¿Qué pasa con `\"status\": \"on_hold\"`?",
          code: `enum OrderStatus: String, Decodable {
    case pending, paid, shipped, onHold
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = OrderStatus(rawValue: raw) ?? .unknown
    }
}`,
          options: ["Se decodifica como `.onHold`", "Queda en `.unknown`", "Lanza `keyNotFound`", "No compila"],
          answer: 1,
          explanation: "`.convertFromSnakeCase` convierte **claves**, no valores. El raw value de `onHold` es `\"onHold\"` y llega `\"on_hold\"`: no coincide y cae en `.unknown`. La solución es `case onHold = \"on_hold\"`.",
        },
        {
          kind: "write",
          prompt: "Modelá el pedido: `Customer` (`fullName`, `phone` opcional), `OrderLine` (`sku`, `unitPrice: Double`, `quantity: Int` y una propiedad calculada `subtotal`) y `Order` (`orderId`, `createdAt: Date`, `status: OrderStatus`, `customer`, `items`). Todos `Decodable`, propiedades en camelCase.",
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
            { pattern: "\\bvar\\s+subtotal\\s*:\\s*Double\\s*\\{", label: "Propiedad calculada `subtotal`" },
            { pattern: "\\blet\\s+createdAt\\s*:\\s*Date\\b", label: "`createdAt: Date`" },
            { pattern: "\\blet\\s+status\\s*:\\s*OrderStatus\\b", label: "`status: OrderStatus`" },
            { pattern: "\\blet\\s+items\\s*:\\s*\\[\\s*OrderLine\\s*\\]", label: "`items: [OrderLine]`" },
          ],
          warnings: [
            { pattern: "\\b(let|var)\\s+[a-z]+_[a-z_]+\\s*:", label: "Propiedades en snake_case: usá camelCase y `.convertFromSnakeCase`" },
            { pattern: "\\blet\\s+phone\\s*:\\s*String\\b(?!\\?)", label: "`phone` puede venir `null`: tiene que ser optional" },
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
          hint: "`Double * Int` no compila en Swift: convertí con `Double(quantity)`.",
        },
        {
          kind: "write",
          prompt: "Escribí `enum OrderLoadError: Error` con `invalidData` y `func loadOrder(from data: Data) -> Result<Order, OrderLoadError>`. Configurá el decoder (snake_case + ISO 8601), decodificá en un `do/catch` y devolvé `.success` o `.failure(.invalidData)`. Nada de `try?` ni `try!`: el error se tiene que poder loguear.",
          starter: `import Foundation

func loadOrder(from data: Data) -> Order? {
    try? JSONDecoder().decode(Order.self, from: data)
}`,
          checks: [
            { pattern: "\\benum\\s+OrderLoadError\\s*:\\s*Error\\b", label: "Declara `enum OrderLoadError: Error`" },
            { pattern: "->\\s*Result<\\s*Order\\s*,\\s*OrderLoadError\\s*>", label: "Devuelve `Result<Order, OrderLoadError>`" },
            { pattern: "\\.convertFromSnakeCase\\b", label: "Usa `.convertFromSnakeCase`" },
            { pattern: "\\.iso8601\\b", label: "Usa `.iso8601`" },
            { pattern: "\\bdo\\s*\\{[\\s\\S]*\\bcatch\\b", label: "Decodifica dentro de `do/catch`" },
            { pattern: "\\.success\\(", label: "Devuelve `.success`" },
            { pattern: "\\.failure\\(\\s*\\.invalidData\\s*\\)", label: "Devuelve `.failure(.invalidData)`" },
          ],
          warnings: [
            { pattern: "\\btry\\?", label: "`try?` tira el motivo del error" },
            { pattern: "\\btry!", label: "`try!` crashea con datos inesperados" },
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
          prompt: "Con el JSON del escenario decodificado en `order`, ¿qué imprime?",
          code: `let total = order.items.map(\\.subtotal).reduce(0, +)
print(total, order.status, order.customer.phone ?? "-")`,
          options: ["`44 unknown -`", "`31.0 unknown nil`", "`44.0 unknown -`", "`44.0 onHold -`"],
          answer: 2,
          explanation: "Subtotales: 15.5 × 2 = 31.0 y 3.25 × 4 = 13.0; la suma es un `Double` y se imprime `44.0`. `on_hold` no coincide con ningún raw value (en el enum del ejercicio 1) y queda `unknown`. `phone` es `nil`, así que `??` da `-`.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-value-reference",
      front: "¿Qué pasa al asignar un struct a otra variable? ¿Y una clase?",
      back: "El struct se copia: cambiar una copia no afecta a la otra. La clase comparte la referencia: las dos variables apuntan al mismo objeto.",
    },
    {
      id: "fc-mutating",
      front: "¿Cuándo hace falta `mutating`?",
      back: "En un método de struct o enum que modifica `self` o sus propiedades. No se puede llamar sobre una constante `let`.",
      code: "struct Stepper {\n    var count = 0\n    mutating func increment() { count += 1 }\n}",
    },
    {
      id: "fc-let-class",
      front: "`let` sobre una clase, ¿la hace inmutable?",
      back: "No. Fija la referencia (no podés reasignarla), pero sus propiedades `var` se pueden cambiar. En un struct, `let` congela todo el valor.",
    },
    {
      id: "fc-cow",
      front: "¿Qué es copy-on-write?",
      back: "`Array`, `Dictionary`, `Set` y `String` comparten el buffer al copiarse y duplican recién cuando una copia se muta. Tus structs no lo tienen gratis: una clase adentro se comparte.",
    },
    {
      id: "fc-final",
      front: "¿Para qué `final class`?",
      back: "Impide subclases: deja clara la intención y permite despacho estático. Buen default para clases que no diseñaste para heredar.",
    },
    {
      id: "fc-associated",
      front: "¿Cómo modelás el estado de una pantalla que carga datos?",
      back: "Con un enum con associated values en vez de varios booleanos: los estados imposibles no se pueden representar y el `switch` exhaustivo te avisa al agregar casos.",
      code: "enum ScreenState {\n    case loading\n    case loaded([Item])\n    case failed(String)\n}",
    },
    {
      id: "fc-rawvalue",
      front: "¿Qué devuelve `Enum(rawValue:)` con un valor que no existe?",
      back: "`nil`: el init es failable. Combinalo con `??` para un caso por defecto, por ejemplo `?? .unknown`.",
    },
    {
      id: "fc-trailing",
      front: "¿Qué es una trailing closure?",
      back: "Si el último parámetro es una closure, se escribe después de los paréntesis (y si es el único, se omiten): `numbers.map { $0 * 2 }`.",
    },
    {
      id: "fc-escaping",
      front: "¿Cuándo un parámetro closure es `@escaping`?",
      back: "Cuando la closure sobrevive a la llamada: se guarda en una propiedad o se ejecuta después (callbacks de red, timers). `map`/`filter` son non-escaping.",
    },
    {
      id: "fc-weak-self",
      front: "¿Cuándo **no** hace falta `[weak self]`?",
      back: "En closures non-escaping (`map`, `forEach`), en closures de una sola ejecución que nadie guarda (`DispatchQueue.main.async`) y en structs. Hace falta cuando `self` termina reteniendo la closure.",
    },
    {
      id: "fc-capture-list",
      front: "¿Qué cambia `[x]` en `{ [x] in print(x) }`?",
      back: "Copia el valor de `x` al crear la closure. Sin capture list, la closure ve el valor actual de la variable al ejecutarse.",
    },
    {
      id: "fc-try-variants",
      front: "`try`, `try?`, `try!`: ¿qué hace cada uno?",
      back: "`try` propaga o va a un `catch`. `try?` devuelve `nil` si lanza (perdés el motivo). `try!` crashea si lanza.",
    },
    {
      id: "fc-typed-throws",
      front: "¿Qué aporta `throws(NetworkError)` en Swift 6?",
      back: "Typed throws: el error que sale es exactamente `NetworkError`, así el `catch` puede hacer un `switch` exhaustivo sin casteos. Para código general, `throws` a secas sigue siendo el default.",
      code: "func fetch() throws(NetworkError) -> Data",
    },
    {
      id: "fc-snake-case",
      front: "Con `.convertFromSnakeCase`, ¿a qué propiedad mapea `avatar_url`?",
      back: "A `avatarUrl`, no a `avatarURL`. Y no lo mezcles con `CodingKeys` que usan nombres snake_case: la clave ya convertida no coincide.",
    },
    {
      id: "fc-unknown-enum",
      front: "El backend agrega un valor nuevo a un enum. ¿Cómo evitás que falle toda la lista?",
      back: "Agregás `case unknown` y un `init(from:)` que lee el string y hace `Self(rawValue: raw) ?? .unknown`.",
      code: "init(from decoder: Decoder) throws {\n    let raw = try decoder.singleValueContainer().decode(String.self)\n    self = Status(rawValue: raw) ?? .unknown\n}",
    },
  ],

  exam: [
    {
      id: "ex-shared-instance",
      question: "La pantalla de carrito y la de checkout reciben el mismo `CartState`. Cuando checkout vacía el carrito \"de prueba\", el carrito real también queda vacío. ¿Cuál es la causa más probable?",
      code: "final class CartState {\n    var items: [Item] = []\n}",
      options: [
        "`items` debería ser `let`",
        "Falta `@escaping` en el init de la pantalla",
        "`CartState` es una clase: las dos pantallas comparten la misma instancia",
        "El array no tiene copy-on-write",
      ],
      answer: 2,
      explanation: "Una clase es un reference type: pasarla a dos pantallas les da la misma instancia. Si cada pantalla necesita su copia, `CartState` tiene que ser un struct; si el estado compartido es intencional, tiene que ser explícito y observable.",
    },
    {
      id: "ex-let-struct",
      question: "¿Qué pasa con este código?",
      code: "struct Config { var timeout = 10 }\nlet config = Config()\nconfig.timeout = 30",
      options: [
        "No compila: `config` es un struct `let` y todo su valor es inmutable",
        "Compila y `timeout` pasa a 30",
        "Compila pero crashea en runtime",
        "Compila y `timeout` sigue en 10",
      ],
      answer: 0,
      explanation: "`let` sobre un value type congela el valor entero, incluidas sus propiedades `var`. Con una clase sí compilaría.",
    },
    {
      id: "ex-cow",
      question: "Un struct `Feed` tiene un `[Post]` con 10.000 elementos. Hacés `var copy = feed` y solo leés `copy.posts.count`. ¿Cuántas veces se copian los posts?",
      options: [
        "Una vez, al asignar",
        "Dos veces: al asignar y al leer `count`",
        "Depende de si `Post` es `Codable`",
        "Ninguna: el array usa copy-on-write y solo copia si alguna copia se muta",
      ],
      answer: 3,
      explanation: "Las colecciones de la standard library comparten el buffer hasta que una copia se modifica. Leer no dispara la copia.",
    },
    {
      id: "ex-screen-state",
      question: "Un view model tiene `isLoading: Bool`, `errorMessage: String?` y `items: [Item]`. Aparece un bug: el spinner y el mensaje de error se ven al mismo tiempo. ¿Cuál es el mejor arreglo de fondo?",
      options: [
        "Agregar un `didSet` en `isLoading` que limpie `errorMessage`",
        "Reemplazar las tres propiedades por un enum `loading / loaded([Item]) / failed(String)`",
        "Hacer `errorMessage` no opcional",
        "Usar una clase en vez de un struct",
      ],
      answer: 1,
      explanation: "Con un enum los estados son excluyentes por construcción: no existe \"cargando y con error\". Los parches con `didSet` arreglan un síntoma y dejan abiertos los demás estados imposibles.",
    },
    {
      id: "ex-default-case",
      question: "Agregás `case refunded` a `enum PaymentStatus`. El proyecto compila sin errores, pero la pantalla de detalle muestra \"Desconocido\" para los reembolsos. ¿Por qué el compilador no avisó?",
      code: "switch status {\ncase .paid: label = \"Pagado\"\ncase .pending: label = \"Pendiente\"\ndefault: label = \"Desconocido\"\n}",
      options: [
        "Porque los enums con raw value no son exhaustivos",
        "Porque faltaba `CaseIterable`",
        "Porque `default` cubre cualquier caso nuevo; sin él, el `switch` dejaría de compilar",
        "Porque `switch` solo chequea exhaustividad en enums `@frozen`",
      ],
      answer: 2,
      explanation: "El `default` absorbe los casos nuevos en silencio. Con enums propios conviene listar todos los casos para que el compilador marque cada `switch` a actualizar.",
    },
    {
      id: "ex-retain-cycle",
      question: "Instruments muestra que `ChatViewModel` nunca se libera. ¿Qué cambio lo arregla?",
      code: "final class ChatViewModel {\n    let socket = SocketClient()\n    var messages: [String] = []\n\n    init() {\n        socket.onMessage = { text in\n            self.messages.append(text)\n        }\n    }\n}",
      options: [
        "Capturar `[weak self]` en la closure de `onMessage`",
        "Marcar `onMessage` como non-escaping",
        "Convertir `messages` en `let`",
        "Mover el código a `deinit`",
      ],
      answer: 0,
      explanation: "El view model retiene `socket`, `socket` retiene la closure y la closure retiene `self`: ciclo. Con `[weak self]` la closure deja de retener al view model. Una propiedad que guarda una closure siempre es escaping.",
    },
    {
      id: "ex-weak-not-needed",
      question: "En un code review alguien pide agregar `[weak self]` en esta línea. ¿Qué respondés?",
      code: "let titles = posts.map { self.formatter.title(for: $0) }",
      options: [
        "Tiene razón: cualquier closure que usa `self` necesita `[weak self]`",
        "Tiene razón, pero alcanza con `[unowned self]`",
        "Hay que convertir `map` en un `for` para evitar el ciclo",
        "No hace falta: `map` recibe una closure non-escaping que se ejecuta y se libera antes de retornar",
      ],
      answer: 3,
      explanation: "Las closures non-escaping no se guardan, así que no pueden formar un ciclo. `[weak self]` acá solo agrega ruido y optionals.",
    },
    {
      id: "ex-try-optional",
      question: "Los usuarios reportan una lista vacía y los logs no muestran nada. ¿Cuál es el problema del código?",
      code: "let products = (try? decoder.decode([Product].self, from: data)) ?? []",
      options: [
        "`decode` no se puede usar con arrays",
        "`try?` descarta el `DecodingError`: la falla se convierte en lista vacía sin rastro",
        "`??` no funciona con arrays",
        "Falta `@escaping`",
      ],
      answer: 1,
      explanation: "`try?` convierte cualquier error en `nil`. Con `do/catch` podés loguear el `DecodingError` (que dice qué clave y en qué ruta falló) y mostrar un estado de error en vez de una lista vacía.",
    },
    {
      id: "ex-typed-throws",
      question: "¿Qué ganás al declarar `func fetchUser() throws(NetworkError) -> User` en Swift 6?",
      options: [
        "El `catch` puede recibir un `NetworkError` concreto y hacer un `switch` exhaustivo sin casteos",
        "La función deja de necesitar `try` al llamarla",
        "El error se convierte automáticamente en `Result`",
        "Se pueden lanzar errores de cualquier tipo sin declararlos",
      ],
      answer: 0,
      explanation: "Typed throws fija el tipo del error. Es útil en dominios cerrados; para APIs generales, `throws` a secas sigue siendo más flexible.",
    },
    {
      id: "ex-avatar-url",
      question: "El JSON trae `\"avatar_url\": \"https://...\"`, el decoder usa `.convertFromSnakeCase` y la propiedad es `let avatarURL: URL?`. No hay error, pero el avatar siempre es `nil`. ¿Por qué?",
      options: [
        "`URL` no es `Decodable`",
        "Hace falta `.iso8601`",
        "La clave convertida es `avatarUrl`, que no coincide con `avatarURL`; como es optional, queda `nil` sin error",
        "Las propiedades optional nunca se decodifican",
      ],
      answer: 2,
      explanation: "La conversión produce `avatarUrl`. Como la propiedad es optional, el código generado usa `decodeIfPresent`, no encuentra la clave y deja `nil`. Renombrá a `avatarUrl` o usá `CodingKeys` sin la estrategia.",
    },
    {
      id: "ex-unknown-enum",
      question: "El backend agrega `\"status\": \"refunded\"`. En las versiones viejas de la app la lista de pedidos queda vacía. ¿Cuál es el arreglo para las próximas versiones?",
      code: "enum OrderStatus: String, Decodable {\n    case pending, paid, shipped\n}",
      options: [
        "Hacer `status` un `String` y comparar strings en toda la app",
        "Envolver cada `decode` en `try!`",
        "Pedirle al backend que nunca agregue valores",
        "Agregar `case unknown` y un `init(from:)` que haga `OrderStatus(rawValue: raw) ?? .unknown`",
      ],
      answer: 3,
      explanation: "Un enum sintetizado lanza `dataCorrupted` con un valor desconocido, y ese error hace fallar el array completo. Con un `init(from:)` tolerante el pedido se decodifica como `.unknown` y la UI puede mostrar algo genérico.",
    },
    {
      id: "ex-fractional-dates",
      question: "Las fechas llegan como `\"2025-03-10T14:30:00.123Z\"` y con `dateDecodingStrategy = .iso8601` la decodificación falla. ¿Qué hacés?",
      options: [
        "Cambiar la propiedad a `Date?`",
        "Usar `.custom` con un `ISO8601DateFormatter` configurado con `.withFractionalSeconds`",
        "Usar `.convertFromSnakeCase`",
        "Usar `.secondsSince1970`",
      ],
      answer: 1,
      explanation: "`.iso8601` no acepta fracciones de segundo. Con `.custom` (o `.formatted`) y un formatter que incluya `.withFractionalSeconds` se decodifica bien. Hacerla optional no ayuda: `decodeIfPresent` solo tolera una clave ausente o `null`, no un formato inválido.",
    },
  ],
};

export default content;
