import type { CourseContent } from "../types";

const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "xcode-anatomy",
      title: "Anatomía de un proyecto Xcode",
      goal: "Entender targets, schemes, build settings, build phases, `Info.plist` y entitlements, y por qué `project.pbxproj` es la fuente de conflictos de merge número uno.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Targets, productos y schemes",
          body: [
            "Un **target** es una receta para producir un binario: la app, una extensión (widget, notificaciones), un framework o un bundle de tests. Cada target tiene sus archivos fuente (target membership), sus build settings, su `Info.plist` y sus entitlements.",
            "Un **scheme** no compila nada por sí mismo: dice *qué* targets se buildean, con qué configuración (`Debug`/`Release`) se corre, qué test plan se usa y con qué variables de entorno y launch arguments arranca la app.",
            "Antes de modularizar conviene saber qué hay. `xcodebuild -list` te muestra targets, configuraciones y schemes del proyecto; es lo primero que corrés al llegar a un repo nuevo o al armar un pipeline de CI.",
          ],
          code: swift`$ xcodebuild -list -project Shop.xcodeproj
Information about project "Shop":
    Targets:
        Shop
        ShopWidget
        ShopTests

    Build Configurations:
        Debug
        Release

    Schemes:
        Shop
        ShopWidget`,
        },
        {
          kind: "predict",
          prompt: "La app guarda el último pedido en un App Group. El widget lo lee con el mismo `suiteName`, pero siempre muestra \"Sin pedidos\". Mirá los entitlements de cada target. ¿Qué está pasando?",
          code: swift`// Shop.entitlements  (target Shop)
com.apple.security.application-groups = [ "group.com.acme.shop" ]

// ShopWidget.entitlements  (target ShopWidget)
// (vacío)

// En el widget:
let defaults = UserDefaults(suiteName: "group.com.acme.shop")
let last = defaults?.string(forKey: "lastOrder") ?? "Sin pedidos"`,
          options: [
            "El widget no puede usar `UserDefaults`: tiene que usar Core Data",
            "`suiteName` solo funciona en el target principal",
            "El target del widget no tiene la capability App Groups: lee su propio contenedor y no encuentra nada",
            "Falta llamar a `synchronize()` después de escribir en la app",
          ],
          answer: 2,
          explanation: "Las capabilities son **por target**. La app escribe en el contenedor compartido del grupo, pero el widget, sin el entitlement `com.apple.security.application-groups`, no tiene acceso a ese contenedor y termina leyendo uno propio vacío. Se arregla agregando la capability App Groups al target `ShopWidget` con el mismo identificador. `synchronize()` está deprecado y no tiene nada que ver.",
        },
        {
          kind: "explain",
          title: "Build settings y `.xcconfig`",
          body: [
            "Cada build setting se resuelve por niveles, del más fuerte al más débil: target, `.xcconfig` del target, proyecto, `.xcconfig` del proyecto y defaults de la plataforma. Por eso un valor puesto \"a mano\" en el target pisa al del `.xcconfig` y nadie entiende por qué.",
            "`$(inherited)` significa \"lo que venga del nivel de abajo, más esto\". Si escribís `SWIFT_ACTIVE_COMPILATION_CONDITIONS = STAGING` sin `$(inherited)`, borrás el `DEBUG` que venía heredado y los `#if DEBUG` dejan de compilar como esperás.",
            "Los equipos serios mueven los settings a archivos `.xcconfig`: son texto plano, se revisan en un PR y no viven enterrados en el `project.pbxproj`. Ojo: en `.xcconfig`, `//` empieza un comentario, así que una URL se corta en `https:`. El truco clásico es `https:/$()/`.",
          ],
          code: swift`// Shared.xcconfig
SWIFT_VERSION = 6.0
IPHONEOS_DEPLOYMENT_TARGET = 17.0

// Debug.xcconfig
#include "Shared.xcconfig"
SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) DEBUG
API_BASE_URL = https:/$()/api.dev.acme.com
OTHER_SWIFT_FLAGS = $(inherited) -Xfrontend -warn-long-function-bodies=200`,
        },
        {
          kind: "fill",
          prompt: "Completá para agregar `STAGING` sin perder las condiciones que vienen de niveles inferiores (como `DEBUG`).",
          code: swift`SWIFT_ACTIVE_COMPILATION_CONDITIONS = ____ STAGING`,
          accept: ["^\\$\\(inherited\\)$", "^\\$\\{inherited\\}$"],
          explanation: "`$(inherited)` expande el valor del nivel anterior. Sin él, la línea reemplaza todo y `DEBUG` desaparece: los `#if DEBUG` dejan de entrar y el menú de debug de QA se esfuma en el build de staging.",
          hint: "Es una variable especial de build settings, con `$` y paréntesis.",
          placeholder: "variable",
        },
        {
          kind: "explain",
          title: "Build phases, `Info.plist` y entitlements",
          body: [
            "Las **build phases** son los pasos del target en orden: dependencias, Compile Sources, Link Binary With Libraries, Copy Bundle Resources, Embed Frameworks y los Run Script que agregue el equipo (SwiftLint, generación de código). En proyectos creados con Xcode 15 o posterior, `ENABLE_USER_SCRIPT_SANDBOXING` está en `YES`: un script que lee archivos tiene que declararlos como input files.",
            "El `Info.plist` puede ser un archivo o generarse con `GENERATE_INFOPLIST_FILE = YES` y settings `INFOPLIST_KEY_*`. Ahí van los textos de permisos (`NSCameraUsageDescription`): si falta, el sistema **mata la app** al pedir el permiso.",
            "Los **entitlements** (`.entitlements`, apuntado por `CODE_SIGN_ENTITLEMENTS`) declaran capabilities firmadas: push, App Groups, Keychain Sharing, Sign in with Apple. Tienen que coincidir con el provisioning profile, si no, falla la firma.",
          ],
          code: swift`// Build settings del target Shop
GENERATE_INFOPLIST_FILE = YES
INFOPLIST_KEY_NSCameraUsageDescription = Usamos la cámara para escanear códigos de barras.
CODE_SIGN_ENTITLEMENTS = Shop/Shop.entitlements

<!-- Shop/Shop.entitlements -->
<dict>
    <key>aps-environment</key>
    <string>development</string>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.acme.shop</string>
    </array>
</dict>`,
        },
        {
          kind: "predict",
          prompt: "Un dev agrega un escáner de códigos de barras. En el simulador nunca lo probó (no hay cámara). En un iPhone, ¿qué pasa al tocar \"Escanear\"?",
          code: swift`// Info.plist: no tiene NSCameraUsageDescription

Button("Escanear") {
    Task {
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        print(granted)
    }
}`,
          options: [
            "La app crashea: acceder a un recurso protegido sin texto de uso está prohibido",
            "Se muestra el diálogo de permiso con un texto genérico del sistema",
            "Imprime `false` sin mostrar nada",
            "No compila: falta la key en el `Info.plist`",
          ],
          answer: 0,
          explanation: "El chequeo es en runtime, no en compilación. Cuando la app pide acceso a la cámara sin `NSCameraUsageDescription`, el sistema la termina con un mensaje en consola que pide agregar la key. Por eso los textos de permisos se revisan en el PR junto con el feature, y App Store Connect también rechaza builds a los que les falta.",
        },
        {
          kind: "explain",
          title: "Por qué `project.pbxproj` explota en cada merge",
          body: [
            "`project.pbxproj` es un archivo de texto con objetos identificados por IDs de 24 caracteres. Agregar **un** archivo Swift toca varias secciones: `PBXFileReference`, `PBXBuildFile`, los `children` del grupo y la lista `files` de `PBXSourcesBuildPhase`. Dos devs que agregan archivos en el mismo grupo chocan casi seguro.",
            "Resolver mal el conflicto (quedarte con una mitad) deja un archivo que se ve en el navegador pero no está en Compile Sources, o una referencia rota que Xcode no abre.",
            "Salidas reales: carpetas sincronizadas de Xcode 16 (el target incluye todo lo que hay en la carpeta, sin listar archivos), generar el proyecto con Tuist o XcodeGen y no commitear el `.xcodeproj`, y mover código a paquetes SPM, donde la estructura la define el sistema de archivos y el `Package.swift`.",
          ],
          code: swift`/* Begin PBXBuildFile section */
		8A1F2C3D4E5F60718293A4B5 /* CartView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0F1E2D3C4B5A69788796A5B4 /* CartView.swift */; };
/* End PBXBuildFile section */

/* Begin PBXSourcesBuildPhase section */
		files = (
<<<<<<< HEAD
			8A1F2C3D4E5F60718293A4B5 /* CartView.swift in Sources */,
=======
			1B2C3D4E5F60718293A4B5C6 /* CouponView.swift in Sources */,
>>>>>>> feature/coupons
		);`,
        },
        {
          kind: "predict",
          prompt: "Después de resolver el conflicto de arriba quedándose solo con la línea de `HEAD`, `CouponView.swift` aparece en el navegador de Xcode. ¿Qué pasa al compilar el código que la usa?",
          code: swift`// En CartView.swift
CouponView(code: cart.coupon)`,
          options: [
            "Compila: Xcode detecta archivos nuevos solo",
            "Warning de archivo duplicado",
            "Crashea en runtime al mostrar el cupón",
            "Error `cannot find 'CouponView' in scope`: el archivo existe pero no está en Compile Sources del target",
          ],
          answer: 3,
          explanation: "La referencia al archivo (`PBXFileReference`, grupo) sobrevivió, por eso se ve en el navegador, pero se perdió su entrada en `PBXSourcesBuildPhase`: no tiene target membership y el compilador nunca lo ve. Es el síntoma típico de un merge mal resuelto en `project.pbxproj`.",
        },
        {
          kind: "write",
          prompt: "Escribí `Staging.xcconfig`: incluí `Shared.xcconfig`, agregá `STAGING` a las condiciones de compilación heredadas, poné el bundle id `com.acme.shop.staging` y definí `API_BASE_URL` apuntando a `https://api.staging.acme.com` sin que el `//` la corte.",
          starter: swift`// Staging.xcconfig
`,
          checks: [
            { pattern: "^#include\\s+\"Shared\\.xcconfig\"", label: "Incluye `Shared.xcconfig`" },
            { pattern: "SWIFT_ACTIVE_COMPILATION_CONDITIONS\\s*=\\s*\\$\\(inherited\\)\\s+.*\\bSTAGING\\b", label: "Agrega `STAGING` con `$(inherited)`" },
            { pattern: "PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*com\\.acme\\.shop\\.staging\\s*$", label: "Bundle id de staging" },
            { pattern: "API_BASE_URL\\s*=\\s*https:/\\$\\(\\)/api\\.staging\\.acme\\.com", label: "URL escapada con `/$()/`" },
          ],
          warnings: [
            { pattern: "API_BASE_URL\\s*=\\s*https?://", label: "En `.xcconfig` `//` empieza un comentario: la URL queda en `https:`" },
            { pattern: "SWIFT_ACTIVE_COMPILATION_CONDITIONS\\s*=\\s*STAGING", label: "Sin `$(inherited)` perdés `DEBUG` y lo que venga de abajo" },
          ],
          solution: swift`// Staging.xcconfig
#include "Shared.xcconfig"

SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) STAGING
PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop.staging
API_BASE_URL = https:/$()/api.staging.acme.com`,
          hint: "`$()` es una variable vacía: rompe el `//` sin cambiar el valor final.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "spm-packages",
      title: "Swift Package Manager a fondo",
      goal: "Escribir un `Package.swift` con productos, targets y dependencias locales y remotas, entender `Package.resolved`, manejar recursos con `Bundle.module` y controlar qué se ve entre módulos.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Anatomía de `Package.swift`",
          body: [
            "La primera línea, `// swift-tools-version: 6.0`, no es un comentario decorativo: define qué API de `PackageDescription` podés usar y, desde 6.0, que los targets compilan en modo Swift 6 por defecto.",
            "**Targets** son módulos: cada uno es una carpeta en `Sources/<Nombre>` y un `import` distinto. **Products** son lo que exponés a quien consume el paquete (la app u otro paquete). Un target que no está en ningún producto es interno al paquete.",
            "En apps grandes es común un único paquete local (`Modules/Package.swift`) con muchos targets, agregado al proyecto de Xcode. Cada feature es un target, y la app solo enlaza productos.",
          ],
          code: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShopModules",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "Networking", targets: ["Networking"]),
        .library(name: "Cart", targets: ["Cart"]),
    ],
    targets: [
        .target(name: "Networking"),
        .target(name: "Cart", dependencies: ["Networking"]),
        .testTarget(name: "CartTests", dependencies: ["Cart"]),
    ]
)`,
        },
        {
          kind: "predict",
          prompt: "En el paquete de arriba, un dev crea el target `Orders` y escribe `import Networking` en uno de sus archivos, pero declara el target así. ¿Qué pasa en un build limpio de CI?",
          code: swift`.target(name: "Orders"),

// Sources/Orders/OrdersRepository.swift
import Networking`,
          options: [
            "Compila: SPM infiere las dependencias leyendo los `import`",
            "Falla con `no such module 'Networking'`: los imports no crean dependencias, hay que declararlas",
            "Compila, pero crashea al primer request",
            "Compila con un warning de dependencia implícita",
          ],
          answer: 1,
          explanation: "SPM construye el grafo solo con lo declarado en `dependencies`. En Xcode a veces compila \"de casualidad\" porque `Networking` ya estaba buildeado por otro target, y por eso el bug aparece recién en CI con un build limpio. La corrección es `.target(name: \"Orders\", dependencies: [\"Networking\"])`.",
        },
        {
          kind: "explain",
          title: "Dependencias remotas, versiones y `Package.resolved`",
          body: [
            "`from: \"2.3.0\"` es la forma normal: acepta desde 2.3.0 hasta antes de 3.0.0 (semver: dentro de la misma major no debería romper). `.upToNextMinor(from:)` es más conservador, `exact:` congela, y `branch:`/`revision:` sirven para probar un fix, no para producción.",
            "`Package.resolved` guarda la versión **exacta** y el commit resuelto de cada dependencia. En una app se commitea siempre: es lo que garantiza que tu Mac, la de tu compañero y CI compilan lo mismo. Actualizar es un acto explícito (`swift package update` o File > Packages > Update) que aparece como diff en el PR.",
            "Las dependencias locales (`.package(path:)`) se usan para paquetes del mismo repo o en desarrollo. Las features de la app suelen ser targets del mismo paquete, sin `.package` para nada.",
          ],
          code: swift`dependencies: [
    .package(url: "https://github.com/pointfreeco/swift-dependencies", from: "1.4.0"),
    .package(url: "https://github.com/onevcat/Kingfisher", .upToNextMinor(from: "8.1.0")),
    .package(url: "https://github.com/hmlongco/Factory", exact: "2.4.3"),
    .package(path: "../DesignSystem"),
],
targets: [
    .target(
        name: "Catalog",
        dependencies: [
            "Networking",
            .product(name: "Dependencies", package: "swift-dependencies"),
            .product(name: "DesignSystem", package: "DesignSystem"),
        ]
    ),
]`,
        },
        {
          kind: "predict",
          prompt: "Con `.package(url: \"https://github.com/acme/charts\", .upToNextMinor(from: \"5.8.0\"))`, ¿qué versiones puede resolver SPM?",
          code: swift`.package(url: "https://github.com/acme/charts", .upToNextMinor(from: "5.8.0"))`,
          options: [
            "De 5.8.0 hasta antes de 6.0.0",
            "Solo 5.8.0",
            "De 5.8.0 hasta antes de 5.9.0",
            "Cualquier versión mayor o igual a 5.8.0",
          ],
          answer: 2,
          explanation: "`upToNextMinor` fija major y minor: acepta parches 5.8.x (5.8.1, 5.8.7…) pero no 5.9.0. `from:` sería hasta antes de 6.0.0, y `exact:` solo 5.8.0. Se usa con librerías que rompen cosas en minors.",
        },
        {
          kind: "explain",
          title: "Recursos y `Bundle.module`",
          body: [
            "Un target de paquete no vive en `Bundle.main`: sus recursos van a un bundle propio. Cuando un target declara recursos, SPM genera `Bundle.module` para accederlos desde ese módulo.",
            "Asset catalogs, storyboards y modelos de Core Data se procesan automáticamente; otros archivos (JSON, fuentes, sonidos) se declaran con `.process(...)` (optimiza según el tipo) o `.copy(...)` (copia tal cual, mantiene la estructura de carpetas).",
            "El bug clásico al mover una pantalla a un módulo: `Image(\"empty-cart\")` sigue buscando en `Bundle.main` y la imagen aparece vacía, sin error ni crash.",
          ],
          code: swift`// Package.swift
.target(
    name: "Cart",
    dependencies: ["Networking"],
    resources: [.process("Resources")]
)

// Sources/Cart/EmptyCartView.swift
import SwiftUI

struct EmptyCartView: View {
    var body: some View {
        VStack {
            Image("empty-cart", bundle: .module)
            Text("cart.empty", bundle: .module)
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá para cargar el JSON de ejemplo que está en los recursos del target `Cart`.",
          code: swift`let url = Bundle.____.url(forResource: "sample-cart", withExtension: "json")`,
          accept: ["^module$"],
          explanation: "`Bundle.module` es el bundle de recursos que SPM genera para el target actual. `Bundle.main` es el de la app y no contiene los recursos del paquete, así que devolvería `nil`.",
          hint: "Es una propiedad estática que genera SPM cuando el target tiene recursos.",
          placeholder: "bundle",
        },
        {
          kind: "explain",
          title: "Access control entre módulos",
          body: [
            "Por defecto todo es `internal`: visible en el módulo y en ningún otro lado. Al modularizar, lo que otro módulo usa tiene que ser `public` (o `open` si se puede subclasear desde afuera). `package` (Swift 5.9) es visible para todos los módulos del **mismo paquete** pero no para la app que lo consume: ideal para helpers compartidos entre `Networking` y las features.",
            "Trampa clásica: el memberwise init de un `struct public` sigue siendo `internal`. Si otro módulo tiene que crear el valor, escribís un `public init` a mano.",
            "`@testable import Cart` en un test le da acceso a lo `internal` del módulo, siempre que se haya compilado con testability (por defecto en `Debug`). No abre lo `private` ni lo `fileprivate`.",
          ],
          code: swift`// Módulo Networking
public struct Endpoint: Sendable {
    public let path: String
    public let method: String

    public init(path: String, method: String = "GET") {
        self.path = path
        self.method = method
    }
}

package func makeDecoder() -> JSONDecoder {  // visible en el paquete, no en la app
    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .convertFromSnakeCase
    return decoder
}

func logRequest(_ endpoint: Endpoint) {}  // internal: solo Networking`,
        },
        {
          kind: "predict",
          prompt: "El módulo `Core` expone este tipo. En el target de la app, ¿qué pasa con la última línea?",
          code: swift`// Módulo Core
public struct Money: Equatable {
    public let cents: Int
    public let currency: String
}

// App
import Core
let price = Money(cents: 1_999, currency: "ARS")`,
          options: [
            "Compila: el struct es `public`, así que su init también",
            "Error: el memberwise init es `internal` y no se ve desde otro módulo",
            "Compila solo con `@testable import Core`",
            "Error: `Equatable` no se puede conformar en un tipo `public`",
          ],
          answer: 1,
          explanation: "El memberwise init sintetizado es `internal` aunque el tipo y sus propiedades sean `public`. Desde la app no existe. Se agrega `public init(cents: Int, currency: String)` en `Core`. `@testable` sí lo destrabaría, pero solo sirve en tests, nunca en código de producción.",
        },
        {
          kind: "fill",
          prompt: "`makeDecoder()` la usan `Networking` y `Cart`, que están en el mismo paquete, pero no queremos que la app la vea. Completá el nivel de acceso.",
          code: swift`____ func makeDecoder() -> JSONDecoder`,
          accept: ["^package$"],
          explanation: "`package` es exactamente ese alcance: todos los módulos del mismo paquete SPM. Con `public` la verías desde la app; con `internal` solo desde `Networking`. Requiere `swift-tools-version` 5.9 o mayor.",
          hint: "Llegó en Swift 5.9 y se llama igual que lo que define `Package.swift`.",
          placeholder: "nivel",
        },
        {
          kind: "write",
          prompt: "Escribí el `Package.swift` de `ShopModules`: iOS 17, productos `Networking` y `Cart`, dependencia remota `https://github.com/pointfreeco/swift-dependencies` desde 1.4.0, target `Cart` que depende de `Networking` y del producto `Dependencies` y procesa la carpeta `Resources`, y el test target `CartTests`.",
          starter: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShopModules",
    targets: []
)`,
          checks: [
            { pattern: "platforms:\\s*\\[\\s*\\.iOS\\(\\.v17\\)", label: "Plataforma iOS 17" },
            { pattern: "\\.library\\(\\s*name:\\s*\"Cart\"", label: "Producto `Cart`" },
            { pattern: "\\.package\\(\\s*url:\\s*\"https://github\\.com/pointfreeco/swift-dependencies\"\\s*,\\s*from:\\s*\"1\\.4\\.0\"\\s*\\)", label: "Dependencia remota con `from:`" },
            { pattern: "\\.product\\(\\s*name:\\s*\"Dependencies\"\\s*,\\s*package:\\s*\"swift-dependencies\"\\s*\\)", label: "Usa el producto `Dependencies` en `Cart`" },
            { pattern: "\\.process\\(\\s*\"Resources\"\\s*\\)", label: "Declara los recursos" },
            { pattern: "\\.testTarget\\(\\s*name:\\s*\"CartTests\"", label: "Test target `CartTests`" },
          ],
          warnings: [
            { pattern: "branch:\\s*\"", label: "Depender de una rama hace los builds no reproducibles" },
          ],
          solution: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShopModules",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "Networking", targets: ["Networking"]),
        .library(name: "Cart", targets: ["Cart"]),
    ],
    dependencies: [
        .package(url: "https://github.com/pointfreeco/swift-dependencies", from: "1.4.0"),
    ],
    targets: [
        .target(name: "Networking"),
        .target(
            name: "Cart",
            dependencies: [
                "Networking",
                .product(name: "Dependencies", package: "swift-dependencies"),
            ],
            resources: [.process("Resources")]
        ),
        .testTarget(name: "CartTests", dependencies: ["Cart"]),
    ]
)`,
          hint: "Los productos de paquetes remotos se referencian con `.product(name:package:)`; el `package` es el último componente de la URL.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "manual-di",
      title: "Inyección de dependencias sin frameworks",
      goal: "Inyectar por inicializador, usar protocolos chicos como contrato, esconder `UserDefaults`, `URLSession` y `Date()` detrás de abstracciones y armar todo en una composition root.",
      minutes: 17,
      steps: [
        {
          kind: "explain",
          title: "Dependencias escondidas",
          body: [
            "Una dependencia escondida es cualquier cosa que un tipo agarra solo: `URLSession.shared`, `UserDefaults.standard`, `Date()`, `Analytics.shared`. Compila y funciona, pero el test no la puede reemplazar: pega a la red real, depende del día y deja estado entre tests.",
            "Inyección de dependencias es un nombre caro para algo simple: **el tipo recibe lo que necesita en el `init`**. No crea sus colaboradores ni los busca en globales.",
            "El beneficio se mide en tests: con dependencias inyectadas el test es rápido, determinístico y no necesita red ni simulador limpio.",
          ],
          code: swift`// Antes: imposible de testear sin red ni reloj real
final class PromoBanner {
    func isVisible() async -> Bool {
        let (data, _) = try! await URLSession.shared.data(from: URL(string: "https://api.acme.com/promo")!)
        let promo = try! JSONDecoder().decode(Promo.self, from: data)
        return Date() < promo.endsAt
    }
}

// Después: todo entra por el init
final class PromoBannerModel {
    private let http: any HTTPClient
    private let now: () -> Date

    init(http: any HTTPClient, now: @escaping () -> Date) {
        self.http = http
        self.now = now
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Dos tests corren en el mismo proceso, en este orden. ¿Qué imprime el segundo?",
          code: swift`final class Session {
    static let shared = Session()
    var token: String?
}

func testLogin() {
    Session.shared.token = "abc"
}

func testGuestCheckout() {
    print(Session.shared.token ?? "sin token")
}

testLogin()
testGuestCheckout()`,
          options: [
            "sin token",
            "nil",
            "abc",
            "Optional(\"abc\")",
          ],
          answer: 2,
          explanation: "`Session.shared` es estado global: vive todo el proceso. El primer test deja `token = \"abc\"` y el segundo lo ve, así que imprime `abc` (el `??` desenvuelve). Si cambia el orden de ejecución, el resultado cambia: es el origen de los tests \"flaky\". Con la sesión inyectada, cada test crea la suya.",
        },
        {
          kind: "explain",
          title: "Protocolos chicos como contrato",
          body: [
            "No hace falta envolver toda la API de `UserDefaults`: el protocolo declara **solo lo que tu código usa**. Cuanto más chico, más fácil escribir el fake.",
            "La implementación real es un adaptador finito; la de test es un diccionario en memoria. El tipo que consume (`OnboardingFlag`) no sabe cuál recibe.",
            "Usá `any Protocolo` para el existencial: es la forma explícita de Swift moderno y deja claro que hay dispatch dinámico.",
          ],
          code: swift`protocol KeyValueStore {
    func string(forKey key: String) -> String?
    func set(_ value: String, forKey key: String)
}

struct UserDefaultsStore: KeyValueStore {
    let defaults: UserDefaults
    func string(forKey key: String) -> String? { defaults.string(forKey: key) }
    func set(_ value: String, forKey key: String) { defaults.set(value, forKey: key) }
}

final class InMemoryStore: KeyValueStore {
    private var values: [String: String] = [:]
    func string(forKey key: String) -> String? { values[key] }
    func set(_ value: String, forKey key: String) { values[key] = value }
}

struct OnboardingFlag {
    let store: any KeyValueStore
    var isDone: Bool { store.string(forKey: "onboarding") == "done" }
    func markDone() { store.set("done", forKey: "onboarding") }
}

let flag = OnboardingFlag(store: InMemoryStore())
print(flag.isDone)
flag.markDone()
print(flag.isDone)`,
          output: "false\ntrue",
        },
        {
          kind: "predict",
          code: swift`protocol HourProvider {
    var currentHour: Int { get }
}

struct FixedHour: HourProvider {
    let currentHour: Int
}

struct Greeter {
    let clock: any HourProvider
    func greeting() -> String {
        clock.currentHour < 12 ? "Buen día" : "Buenas tardes"
    }
}

print(Greeter(clock: FixedHour(currentHour: 9)).greeting())
print(Greeter(clock: FixedHour(currentHour: 12)).greeting())`,
          options: [
            "Buen día\nBuenas tardes",
            "Buen día\nBuen día",
            "Buenas tardes\nBuenas tardes",
            "Depende de la hora en que corra el test",
          ],
          answer: 0,
          explanation: "El reloj es un fake fijo, así que el resultado no depende de la hora real. 9 < 12 da \"Buen día\". 12 < 12 es `false`, así que da \"Buenas tardes\". Justamente el borde de las 12 es el caso que querés testear y que con `Date()` no podrías.",
        },
        {
          kind: "explain",
          title: "Red y fecha detrás de abstracciones",
          body: [
            "Para la fecha, una closure alcanza: `now: () -> Date`. En producción pasás `Date.init`; en el test, `{ fixed }`. Para la red, un protocolo con un método y una extensión de `URLSession` que lo cumple.",
            "Nombrá el método del protocolo distinto de los de `URLSession` (`send` en vez de `data(for:)`): evita ambigüedades con sus parámetros por defecto y deja claro qué es tuyo.",
            "Valores por defecto en el `init` (`= URLSession.shared`) son aceptables en código chico, pero esconden otra vez la decisión. En módulos, preferí que la composition root pase siempre el concreto.",
          ],
          code: swift`protocol HTTPClient: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPClient {
    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        try await data(for: request)
    }
}

struct TokenValidator {
    let now: () -> Date
    func isExpired(_ expiry: Date) -> Bool { now() >= expiry }
}

let fixed = Date(timeIntervalSince1970: 1_000)
let validator = TokenValidator(now: { fixed })
print(validator.isExpired(Date(timeIntervalSince1970: 999)))
print(validator.isExpired(Date(timeIntervalSince1970: 2_000)))`,
          output: "true\nfalse",
        },
        {
          kind: "fill",
          prompt: "En la composition root, completá el valor que se pasa como reloj real.",
          code: swift`let validator = TokenValidator(now: ____)`,
          accept: ["^Date\\.init$", "^\\{\\s*Date\\(\\)\\s*\\}$", "^\\{\\s*Date\\.now\\s*\\}$"],
          explanation: "`Date.init` es una referencia a función de tipo `() -> Date`: cada llamada a `now()` crea la fecha actual. `{ Date() }` o `{ Date.now }` son equivalentes. Pasar `Date.now` sin llaves no compila: es un `Date`, no una función, y además congelaría la fecha en el momento de armar el objeto.",
          hint: "Una referencia al inicializador de `Date`, sin paréntesis.",
          placeholder: "reloj",
        },
        {
          kind: "explain",
          title: "La composition root",
          body: [
            "Si nadie crea sus dependencias, alguien tiene que hacerlo: la **composition root**. Es un solo lugar, cerca del arranque (`@main`, `SceneDelegate`, un `AppDependencies`), donde se instancian los concretos y se cablean.",
            "Es el único sitio que conoce todas las implementaciones. Las features reciben protocolos; la root decide `URLSession` vs stub, `UserDefaults` vs memoria, live vs mock para UI tests (por ejemplo, según un launch argument).",
            "Antipatrón a evitar: pasar el contenedor entero (`deps`) a cada ViewModel y que este saque lo que quiera. Eso es un *service locator*: las dependencias vuelven a estar escondidas, solo que en otro lugar.",
          ],
          code: swift`@MainActor
final class AppDependencies {
    let http: any HTTPClient = URLSession.shared
    let store: any KeyValueStore = UserDefaultsStore(defaults: .standard)
    lazy var cartRepository: any CartRepository = RemoteCartRepository(http: http)

    func makeCartViewModel() -> CartViewModel {
        CartViewModel(repository: cartRepository, now: Date.init)
    }
}

@main
struct ShopApp: App {
    @State private var dependencies = AppDependencies()

    var body: some Scene {
        WindowGroup {
            CartScreen(model: dependencies.makeCartViewModel())
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "En un PR, un ViewModel profundo en la navegación necesita trackear eventos y el autor escribe esto. ¿Cuál es el problema principal?",
          code: swift`@MainActor @Observable
final class ProductDetailModel {
    func addToCart() {
        // ...
        AnalyticsService.shared.track("add_to_cart")
    }
}`,
          options: [
            "Ninguno: los singletons son la forma recomendada para analytics",
            "`track` debería ser `async`",
            "Hay que marcar `AnalyticsService` como `final`",
            "Es una dependencia escondida: los tests mandan eventos reales y no se puede verificar qué se trackeó",
          ],
          answer: 3,
          explanation: "El ViewModel decide solo de dónde sacar analytics. En tests dispara eventos reales (o crashea si el SDK no está configurado) y no hay forma de assertear que se trackeó `add_to_cart`. Se inyecta `any AnalyticsTracking` por el init y en el test se pasa un spy.",
        },
        {
          kind: "write",
          prompt: "Refactorizá `ProfileModel` para que reciba por `init` un `any HTTPClient`, un `any KeyValueStore` y un reloj `() -> Date`. Guardalos en `let http`, `let store` y `let now`, y usá `now()` en lugar de `Date()`.",
          starter: swift`@MainActor @Observable
final class ProfileModel {
    var lastSync: Date?

    func refresh() async throws {
        let request = URLRequest(url: URL(string: "https://api.acme.com/me")!)
        _ = try await URLSession.shared.data(for: request)
        UserDefaults.standard.set("synced", forKey: "profile.status")
        lastSync = Date()
    }
}`,
          checks: [
            { pattern: "let\\s+http\\s*:\\s*any\\s+HTTPClient", label: "Guarda `http: any HTTPClient`" },
            { pattern: "let\\s+store\\s*:\\s*any\\s+KeyValueStore", label: "Guarda `store: any KeyValueStore`" },
            { pattern: "let\\s+now\\s*:\\s*\\(\\)\\s*->\\s*Date", label: "Guarda el reloj `now: () -> Date`" },
            { pattern: "init\\s*\\(", label: "Tiene un `init` que recibe las dependencias" },
            { pattern: "@escaping\\s*\\(\\)\\s*->\\s*Date", label: "El reloj del `init` es `@escaping`" },
            { pattern: "lastSync\\s*=\\s*now\\(\\)", label: "Usa `now()` para la fecha" },
          ],
          warnings: [
            { pattern: "URLSession\\.shared", label: "La red sigue escondida dentro del modelo" },
            { pattern: "UserDefaults\\.standard", label: "El storage sigue escondido dentro del modelo" },
            { pattern: "\\bDate\\(\\)", label: "`Date()` hace el test dependiente del reloj real" },
          ],
          solution: swift`@MainActor @Observable
final class ProfileModel {
    var lastSync: Date?

    @ObservationIgnored private let http: any HTTPClient
    @ObservationIgnored private let store: any KeyValueStore
    @ObservationIgnored private let now: () -> Date

    init(http: any HTTPClient, store: any KeyValueStore, now: @escaping () -> Date) {
        self.http = http
        self.store = store
        self.now = now
    }

    func refresh() async throws {
        let request = URLRequest(url: URL(string: "https://api.acme.com/me")!)
        _ = try await http.send(request)
        store.set("synced", forKey: "profile.status")
        lastSync = now()
    }
}`,
          hint: "Tres propiedades `let`, un `init` que las asigna y reemplazar cada uso directo por la propiedad.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "di-containers",
      title: "Contenedores y herramientas de DI",
      goal: "Conocer Factory, Swinject, `swift-dependencies` y `@Environment` con `@Entry`, y elegir entre ellos y la DI manual según el equipo y el proyecto.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Cuándo aparece un contenedor (y Swinject)",
          body: [
            "La DI manual escala bien hasta que la composition root tiene cientos de líneas y pasar dependencias por cinco niveles de navegación se vuelve tedioso. Ahí aparecen los contenedores: registrás cómo se construye cada cosa y la resolvés donde la necesitás.",
            "**Swinject** es el veterano: `register` con una closure y `resolve` que devuelve un optional. Tiene scopes (`.transient`, `.container`, `.graph`, `.weak`). El costo: si te olvidás de registrar algo, compila igual y falla en runtime.",
            "Todo contenedor es, en el fondo, un mapa tipo → fábrica. Lo que cambia entre herramientas es cuánto chequea el compilador y qué tan fácil es overridear en tests.",
          ],
          code: swift`import Swinject

let container = Container()

container.register((any HTTPClient).self) { _ in
    URLSession.shared
}
.inObjectScope(.container)

container.register((any CartRepository).self) { resolver in
    RemoteCartRepository(http: resolver.resolve((any HTTPClient).self)!)
}

let repository = container.resolve((any CartRepository).self)!`,
        },
        {
          kind: "predict",
          prompt: "Un dev agrega `CouponRepository` a `CheckoutModel` y lo resuelve con Swinject, pero se olvida de registrarlo. ¿Qué pasa?",
          code: swift`let model = CheckoutModel(
    coupons: container.resolve((any CouponRepository).self)!
)`,
          options: [
            "No compila: falta el registro",
            "Compila; crashea en runtime al construir esa pantalla porque `resolve` devuelve `nil`",
            "Compila y Swinject crea una instancia por defecto",
            "Compila y `coupons` queda en `nil` sin crash",
          ],
          answer: 1,
          explanation: "`resolve` devuelve `Optional`. Sin registro devuelve `nil`, y el `!` crashea recién cuando alguien abre el checkout. El compilador no tiene forma de saberlo. Es la principal crítica a los contenedores basados en registro dinámico, y la razón de tener un test que resuelva todo el grafo al arrancar.",
        },
        {
          kind: "explain",
          title: "Factory: registros chequeados por el compilador",
          body: [
            "**Factory** define cada dependencia como una propiedad computada en una extensión de `Container`. Como es código Swift normal, siempre devuelve un valor: no existe el \"me olvidé de registrar\".",
            "Se inyecta con `@Injected(\\.cartRepository)` o llamando `Container.shared.cartRepository()`. El scope por defecto es `unique` (instancia nueva cada vez); `.singleton` y `.cached` reutilizan.",
            "En tests: `Container.shared.cartRepository.register { InMemoryCartRepository() }` antes de crear el modelo. Con `@Observable`, marcá el property wrapper con `@ObservationIgnored`.",
          ],
          code: swift`import Factory

extension Container {
    var httpClient: Factory<any HTTPClient> {
        self { URLSession.shared }.singleton
    }
    var cartRepository: Factory<any CartRepository> {
        self { RemoteCartRepository(http: self.httpClient()) }
    }
}

@MainActor @Observable
final class CartModel {
    @ObservationIgnored @Injected(\.cartRepository) private var repository
    var items: [CartItem] = []
}

// En un test
Container.shared.cartRepository.register { InMemoryCartRepository() }
let model = CartModel()`,
        },
        {
          kind: "predict",
          code: swift`import Factory

final class Counter { var value = 0 }

extension Container {
    var counter: Factory<Counter> { self { Counter() } }
    var sharedCounter: Factory<Counter> { self { Counter() }.singleton }
}

let a = Container.shared.counter()
a.value += 1
print(Container.shared.counter().value)

let b = Container.shared.sharedCounter()
b.value += 1
print(Container.shared.sharedCounter().value)`,
          options: [
            "1\n1",
            "0\n0",
            "1\n0",
            "0\n1",
          ],
          answer: 3,
          explanation: "`counter` usa el scope por defecto (`unique`): cada llamada crea un `Counter` nuevo, así que la segunda resolución arranca en 0. `sharedCounter` es `.singleton`: la segunda llamada devuelve la misma instancia que ya se incrementó, 1.",
        },
        {
          kind: "explain",
          title: "`swift-dependencies` (con o sin TCA)",
          body: [
            "`swift-dependencies` de Point-Free es la DI de TCA, pero es un paquete aparte y funciona en cualquier arquitectura. Definís una `DependencyKey` con su `liveValue`, la exponés en `DependencyValues` y la leés con `@Dependency(\\.priceClient)`.",
            "Trae dependencias listas: `\\.date.now`, `\\.uuid`, `\\.continuousClock`, `\\.mainQueue`. En tests se overridea con `withDependencies`, y si un test usa una dependencia `live` sin overridearla, la librería lo marca como fallido.",
            "El modelo de \"structs con closures\" (en vez de protocolos) hace que overridear un solo endpoint sea una línea.",
          ],
          code: swift`import Dependencies

struct PriceClient: Sendable {
    var fetchPrice: @Sendable (_ productID: String) async throws -> Int
}

extension PriceClient: DependencyKey {
    static let liveValue = PriceClient(fetchPrice: { id in
        try await APIClient.live.price(for: id)
    })
}

extension DependencyValues {
    var priceClient: PriceClient {
        get { self[PriceClient.self] }
        set { self[PriceClient.self] = newValue }
    }
}

@MainActor @Observable
final class ProductModel {
    @ObservationIgnored @Dependency(\.priceClient) var priceClient
    @ObservationIgnored @Dependency(\.date.now) var now
}

// En un test
let model = withDependencies {
    $0.priceClient.fetchPrice = { _ in 1_999 }
} operation: {
    ProductModel()
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el protocolo que hace que `AnalyticsClient` se pueda usar como dependencia de `swift-dependencies` con un valor de producción.",
          code: swift`extension AnalyticsClient: ____ {
    static let liveValue = AnalyticsClient(track: { event in Firebase.log(event) })
}`,
          accept: ["^DependencyKey$"],
          explanation: "`DependencyKey` exige `liveValue` (y opcionalmente `testValue` y `previewValue`). Después se agrega la propiedad en `extension DependencyValues` para leerla con `@Dependency(\\.analyticsClient)`.",
          hint: "Es el protocolo de la \"llave\" de la dependencia.",
          placeholder: "protocolo",
        },
        {
          kind: "explain",
          title: "`@Environment` con `@Entry` en SwiftUI",
          body: [
            "Para dependencias de la UI (analytics de botones, image loader, theme), SwiftUI ya trae un contenedor: el environment. Con el macro `@Entry` (Xcode 16) declarás la key y su default en una línea.",
            "El valor fluye **hacia abajo** desde donde hacés `.environment(...)`. Una vista que lo lea fuera de ese subárbol recibe el default, sin crash.",
            "Límite importante: `@Environment` solo se lee dentro de una `View`. Un ViewModel no puede leerlo; si lo necesita, la vista se lo pasa o se inyecta por init desde la composition root.",
          ],
          code: swift`import SwiftUI

struct AnalyticsClient: Sendable {
    var track: @Sendable (String) -> Void
    static let noop = AnalyticsClient(track: { _ in })
}

extension EnvironmentValues {
    @Entry var analytics: AnalyticsClient = .noop
}

struct PayButton: View {
    @Environment(\.analytics) private var analytics

    var body: some View {
        Button("Pagar") { analytics.track("pay_tapped") }
    }
}

// Raíz de la app
RootView()
    .environment(\.analytics, liveAnalytics)`,
        },
        {
          kind: "predict",
          prompt: "Analytics se inyecta así. Los eventos de la pestaña Perfil nunca llegan al dashboard. ¿Por qué?",
          code: swift`TabView {
    HomeView()
        .environment(\.analytics, liveAnalytics)
        .tabItem { Label("Inicio", systemImage: "house") }

    ProfileView()
        .tabItem { Label("Perfil", systemImage: "person") }
}`,
          options: [
            "`TabView` no propaga el environment a ninguna pestaña",
            "Las pestañas se renderizan perezosamente y el environment llega tarde",
            "`ProfileView` está fuera del subárbol donde se inyectó: recibe el default `.noop`",
            "`@Entry` solo funciona en iOS 18",
          ],
          answer: 2,
          explanation: "El environment se propaga hacia abajo desde el modificador. Se aplicó a `HomeView`, no al `TabView`, así que `ProfileView` lee el valor por defecto, que no hace nada. Sin crash ni warning: por eso conviene inyectar en la raíz y que el default de producción sea visible en tests de UI.",
        },
        {
          kind: "write",
          prompt: "Agregá `imageLoader` al environment con `@Entry` y default `.placeholder`, leelo en `AvatarView` y inyectá `.live` en la raíz.",
          starter: swift`struct ImageLoader: Sendable {
    var load: @Sendable (URL) async throws -> UIImage
    static let placeholder = ImageLoader(load: { _ in UIImage() })
    static let live = ImageLoader(load: { url in try await download(url) })
}

struct AvatarView: View {
    let url: URL
    var body: some View { Color.gray }
}

// raíz
RootView()`,
          checks: [
            { pattern: "extension\\s+EnvironmentValues\\s*\\{", label: "Extiende `EnvironmentValues`" },
            { pattern: "@Entry\\s+var\\s+imageLoader\\s*:\\s*ImageLoader\\s*=\\s*\\.placeholder", label: "`@Entry var imageLoader` con default `.placeholder`" },
            { pattern: "@Environment\\(\\\\\\.imageLoader\\)\\s+(private\\s+)?var\\s+\\w+", label: "Lo lee con `@Environment(\\.imageLoader)`" },
            { pattern: "\\.environment\\(\\\\\\.imageLoader\\s*,\\s*\\.live\\s*\\)", label: "Inyecta `.live` en la raíz" },
          ],
          warnings: [
            { pattern: "ImageLoader\\.shared", label: "Un singleton esconde la dependencia" },
          ],
          solution: swift`struct ImageLoader: Sendable {
    var load: @Sendable (URL) async throws -> UIImage
    static let placeholder = ImageLoader(load: { _ in UIImage() })
    static let live = ImageLoader(load: { url in try await download(url) })
}

extension EnvironmentValues {
    @Entry var imageLoader: ImageLoader = .placeholder
}

struct AvatarView: View {
    let url: URL
    @Environment(\.imageLoader) private var imageLoader
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable() } else { Color.gray }
        }
        .task { image = try? await imageLoader.load(url) }
    }
}

// raíz
RootView()
    .environment(\.imageLoader, .live)`,
          hint: "`@Entry` va dentro de `extension EnvironmentValues`; el key path es `\\.imageLoader`.",
        },
        {
          kind: "predict",
          prompt: "Equipo de 3 devs, app de 15 pantallas, 4 módulos, tests unitarios en los ViewModels. Hoy usan DI manual con una composition root de 120 líneas. Alguien propone sumar Swinject. ¿Qué responderías en el review?",
          code: swift`// AppDependencies.swift — 120 líneas
func makeCartModel() -> CartModel {
    CartModel(repository: cartRepository, analytics: analytics, now: Date.init)
}`,
          options: [
            "Sumarlo: los contenedores son obligatorios en apps modulares",
            "Seguir con DI manual: escala bien a este tamaño, los errores son de compilación y no agrega una dependencia ni magia",
            "Reemplazar todo por singletons, que es lo más simple",
            "Pasar todo por `@Environment`, incluidos repositorios y ViewModels",
          ],
          answer: 1,
          explanation: "Un contenedor se paga con una dependencia externa, curva de aprendizaje y, en el caso de Swinject, errores en runtime. A este tamaño, la DI manual da todo eso gratis y con chequeo del compilador. Se reevalúa cuando la root se vuelve inmanejable o cuando muchas features necesitan overrides parciales (ahí Factory o `swift-dependencies` brillan).",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "feature-modules",
      title: "Feature modules a escala",
      goal: "Separar módulos de capa y de feature, cortar dependencias entre features con módulos de interfaz, elegir linkeo estático o dinámico, generar el proyecto con Tuist y medir si la modularización rinde.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Módulos de capa vs módulos de feature",
          body: [
            "Hay dos ejes. Los **módulos de capa** son infraestructura compartida: `Core` (modelos y utilidades), `Networking`, `DesignSystem`, `Analytics`. Los **módulos de feature** son pantallas y flujos: `Feed`, `Profile`, `Checkout`.",
            "Reglas del grafo: las features dependen de módulos de capa; las capas nunca dependen de features; una feature **no** depende de otra feature; la app depende de todo y es la composition root.",
            "Modularizar se justifica por tres cosas medibles: builds incrementales más rápidos, equipos que no se pisan (cada uno es dueño de sus módulos) y features que se testean y corren aisladas. Si ninguna de las tres mejora, es ceremonia.",
          ],
          code: swift`targets: [
    // Capas
    .target(name: "Core"),
    .target(name: "Networking", dependencies: ["Core"]),
    .target(name: "DesignSystem"),

    // Features
    .target(name: "Feed", dependencies: ["Core", "Networking", "DesignSystem"]),
    .target(name: "Profile", dependencies: ["Core", "Networking", "DesignSystem"]),
]
// La app (target de Xcode) enlaza Feed y Profile y los conecta.`,
        },
        {
          kind: "predict",
          prompt: "`Feed` ya depende de `Profile` para abrir el perfil de un autor. Ahora `Profile` necesita mostrar los posts del usuario y el dev agrega `\"Feed\"` a sus dependencias. ¿Qué pasa?",
          code: swift`.target(name: "Feed", dependencies: ["Core", "Profile"]),
.target(name: "Profile", dependencies: ["Core", "Feed"]),`,
          options: [
            "SPM rechaza el paquete: dependencia cíclica entre `Feed` y `Profile`",
            "Compila, pero los builds son más lentos",
            "Compila si ambos tipos son `public`",
            "Crashea en runtime al navegar de uno a otro",
          ],
          answer: 0,
          explanation: "Un módulo no puede depender, directa ni indirectamente, de sí mismo: SPM detecta el ciclo y no resuelve el paquete. Aun sin ciclo, que una feature dependa de otra hace que cualquier cambio en `Feed` recompile `Profile`. La salida es un módulo de interfaz.",
        },
        {
          kind: "explain",
          title: "Módulos de interfaz",
          body: [
            "Un **módulo de interfaz** (`FeedInterface`) contiene solo el contrato: un protocolo para construir la pantalla y los modelos mínimos que cruzan el borde. Es chico, cambia poco y no depende de nada pesado.",
            "`Profile` depende de `FeedInterface`, no de `Feed`. La implementación (`Feed`) también depende de la interfaz y la cumple. La app, que conoce ambos, inyecta el concreto en `Profile`.",
            "Ganancia de build: tocar el código interno de `Feed` ya no recompila `Profile`, porque la interfaz no cambió. Ganancia de equipo: el squad de Profile puede usar un fake de `FeedBuilding` sin esperar al de Feed.",
          ],
          code: swift`// Módulo FeedInterface
import SwiftUI

@MainActor
public protocol FeedBuilding {
    func makeAuthorFeed(authorID: String) -> AnyView
}

// Módulo Profile (depende de FeedInterface)
import FeedInterface

public struct ProfileScreen: View {
    let userID: String
    let feedBuilder: any FeedBuilding

    public init(userID: String, feedBuilder: any FeedBuilding) {
        self.userID = userID
        self.feedBuilder = feedBuilder
    }

    public var body: some View {
        NavigationLink("Ver posts") { feedBuilder.makeAuthorFeed(authorID: userID) }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la dependencia de `Profile` para que pueda abrir el feed sin acoplarse a la implementación.",
          code: swift`.target(name: "Profile", dependencies: ["Core", "DesignSystem", "____"]),`,
          accept: ["^FeedInterface$"],
          explanation: "`Profile` solo necesita el contrato `FeedBuilding`, que vive en `FeedInterface`. Si dependiera de `Feed`, volvería el acoplamiento entre features y cada cambio en `Feed` lo recompilaría.",
          hint: "Es el módulo que contiene solo el protocolo.",
          placeholder: "módulo",
        },
        {
          kind: "explain",
          title: "Demo apps y Tuist",
          body: [
            "Una **demo app por feature** es un target de app que enlaza solo esa feature y fakes de sus dependencias. Compila en segundos, arranca directo en la pantalla que estás tocando y el equipo puede trabajar aunque el backend esté caído.",
            "SPM no crea targets de app de iOS, así que los proyectos grandes generan el `.xcodeproj` con **Tuist** (`Project.swift`, en Swift) o **XcodeGen** (`project.yml`). El proyecto se regenera con `tuist generate` y deja de ser fuente de conflictos.",
            "Tuist también permite cambiar el tipo de producto de cada módulo (`.staticFramework`, `.framework`) en un solo lugar y tiene caché de binarios para no recompilar módulos que no cambiaron.",
          ],
          code: swift`// Project.swift (Tuist)
import ProjectDescription

let project = Project(
    name: "Shop",
    targets: [
        .target(
            name: "Feed",
            destinations: .iOS,
            product: .staticFramework,
            bundleId: "com.acme.shop.feed",
            sources: ["Features/Feed/Sources/**"],
            dependencies: [.target(name: "FeedInterface"), .target(name: "DesignSystem")]
        ),
        .target(
            name: "FeedDemo",
            destinations: .iOS,
            product: .app,
            bundleId: "com.acme.shop.feed-demo",
            sources: ["Features/Feed/Demo/**"],
            dependencies: [.target(name: "Feed")]
        ),
    ]
)`,
        },
        {
          kind: "predict",
          prompt: "`Utils` es una librería **estática** con `static let shared = Cache()`. La enlaza `Core.framework` (**dinámico**) y también la app directamente. En runtime, el log muestra `Class _TtC5Utils5Cache is implemented in both...`. ¿Qué implica?",
          code: swift`App ──▶ Core.framework (dynamic) ──▶ Utils (static)
 └──────────────────────────────────▶ Utils (static)`,
          options: [
            "Nada: el linker deduplica los símbolos",
            "Solo aumenta un poco el tamaño de la app",
            "No compila por símbolos duplicados",
            "Hay dos copias de `Utils`: código duplicado y dos `Cache.shared` distintos, uno por binario",
          ],
          answer: 3,
          explanation: "Una librería estática se copia dentro de cada binario que la enlaza. `Core.framework` tiene su copia y el ejecutable de la app la suya: dos clases `Cache`, dos `shared`. Lo que la app guarda, `Core` no lo ve. La regla: una librería estática se enlaza en un solo binario; si la necesitan varios, que sea dinámica o que solo la exponga el framework.",
        },
        {
          kind: "explain",
          title: "Estático vs dinámico, y medir",
          body: [
            "**Estático**: el código se copia en el binario que lo enlaza; arranque rápido, pero se duplica si lo enlazan varios binarios (app + extensiones). **Dinámico**: un `.framework` que se embebe una vez y se carga en el arranque; se comparte, pero cada framework dinámico suma tiempo de lanzamiento. Los productos de SPM son `.automatic` por defecto y Xcode suele linkearlos estáticos.",
            "Antes de modularizar y después, medí: build limpio, build incremental tocando un archivo de una feature hoja, tiempo de CI y tiempo de tests. `-showBuildTimingSummary` y el Build Timeline de Xcode muestran qué módulos compilan en serie.",
            "Si el incremental no baja, revisá el grafo: un módulo \"Core\" gigante del que depende todo hace que cualquier cambio recompile la app entera.",
          ],
          code: swift`# Build limpio con resumen de tiempos
xcodebuild -scheme Shop \
  -destination 'generic/platform=iOS Simulator' \
  -showBuildTimingSummary clean build | tail -n 25

# Incremental: tocá un archivo de una feature hoja y repetí sin clean
touch Modules/Sources/Feed/FeedView.swift
xcodebuild -scheme Shop \
  -destination 'generic/platform=iOS Simulator' \
  -showBuildTimingSummary build | tail -n 25`,
        },
        {
          kind: "predict",
          prompt: "Equipo de 2 devs, app de 12 pantallas, build limpio de 40 s e incremental de 6 s. El nuevo tech lead propone partirla en 25 módulos SPM \"para escalar\". ¿Qué es lo más razonable?",
          code: swift`Clean build:       40 s
Incremental build:  6 s
Devs:               2
Pantallas:         12`,
          options: [
            "Hacerlo ya: más módulos siempre compilan más rápido",
            "No modularizar nunca: SPM es lento",
            "Por ahora no: ninguna de las tres ganancias (build, equipos, aislamiento) es un problema; a lo sumo separar `DesignSystem` y `Networking` si hay una razón concreta",
            "Pasar todo a frameworks dinámicos",
          ],
          answer: 2,
          explanation: "Con 6 s de incremental y dos personas no hay dolor que resolver: 25 módulos agregan `public` en todos lados, más configuración y más tiempo de planificación del build. Se modulariza cuando hay una métrica que empeora o un límite de equipo, y se mide antes y después.",
        },
        {
          kind: "write",
          prompt: "Escribí los targets del paquete: `FeedInterface` sin dependencias; `Feed` que depende de `FeedInterface`, `Networking` y `DesignSystem`; `Profile` que depende de `FeedInterface` y `DesignSystem`. Las capas `Networking` y `DesignSystem` ya existen y no dependen de features.",
          starter: swift`targets: [
    .target(name: "Networking"),
    .target(name: "DesignSystem"),
]`,
          checks: [
            { pattern: "\\.target\\(\\s*name:\\s*\"FeedInterface\"\\s*\\)", label: "`FeedInterface` sin dependencias" },
            { pattern: "name:\\s*\"Feed\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"FeedInterface\"", label: "`Feed` implementa la interfaz" },
            { pattern: "name:\\s*\"Profile\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"FeedInterface\"", label: "`Profile` depende de la interfaz" },
            { pattern: "name:\\s*\"Feed\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"Networking\"", label: "`Feed` usa `Networking`" },
          ],
          warnings: [
            { pattern: "name:\\s*\"Profile\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"Feed\"", label: "`Profile` depende de `Feed`: acoplamiento entre features" },
            { pattern: "name:\\s*\"(Networking|DesignSystem)\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"(Feed|Profile)", label: "Una capa base no puede depender de una feature" },
          ],
          solution: swift`targets: [
    .target(name: "Networking"),
    .target(name: "DesignSystem"),
    .target(name: "FeedInterface"),
    .target(name: "Feed", dependencies: ["FeedInterface", "Networking", "DesignSystem"]),
    .target(name: "Profile", dependencies: ["FeedInterface", "DesignSystem"]),
]`,
          hint: "La interfaz es la única pieza que ambas features comparten.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: partir el monolito de Mercadito",
      goal: "Separar una app monolítica en cinco módulos con un `Package.swift`, un módulo de interfaz y una composition root que lo conecte todo.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "**Mercadito** es una app de compras con un solo target: 180 archivos, build incremental de 70 s y cuatro squads que se pisan en cada PR. Carrito y Checkout están acoplados: el carrito instancia `CheckoutViewController` directamente.",
            "El plan: un paquete local `MercaditoModules` con cinco módulos. Capas: `Networking` y `DesignSystem`. Features: `Cart` y `Checkout`. Contrato: `CheckoutInterface`, para que `Cart` pueda iniciar el checkout sin conocer su implementación.",
            "Vas a escribir el `Package.swift`, el módulo de interfaz y la composition root de la app. Abajo está lo que ya existe.",
          ],
          code: swift`// Ya existe
// Networking:   public protocol HTTPClient, public final class URLSessionHTTPClient: HTTPClient
// Cart:         public final class CartViewModel  (hoy crea CheckoutViewController adentro)
//               public protocol CartRepository, public struct RemoteCartRepository
// Checkout:     final class CheckoutViewController: UIViewController

// Grafo objetivo
// App ──▶ Cart, Checkout, Networking, DesignSystem
// Cart ──▶ CheckoutInterface, Networking, DesignSystem
// Checkout ──▶ CheckoutInterface, Networking, DesignSystem`,
        },
        {
          kind: "write",
          prompt: "Escribí el `Package.swift` de `MercaditoModules`: iOS 17, un producto por módulo de feature y capa, los cinco targets con el grafo objetivo y los test targets `CartTests` y `CheckoutTests`.",
          starter: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MercaditoModules",
    targets: [
        .target(name: "Networking"),
    ]
)`,
          checks: [
            { pattern: "platforms:\\s*\\[\\s*\\.iOS\\(\\.v17\\)", label: "Plataforma iOS 17" },
            { pattern: "\\.target\\(\\s*name:\\s*\"CheckoutInterface\"", label: "Target `CheckoutInterface`" },
            { pattern: "name:\\s*\"Cart\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"CheckoutInterface\"", label: "`Cart` depende de la interfaz" },
            { pattern: "name:\\s*\"Checkout\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"CheckoutInterface\"", label: "`Checkout` implementa la interfaz" },
            { pattern: "\\.library\\(\\s*name:\\s*\"Checkout\"", label: "Producto `Checkout` para la app" },
            { pattern: "\\.testTarget\\(\\s*name:\\s*\"CartTests\"", label: "Test target `CartTests`" },
            { pattern: "\\.testTarget\\(\\s*name:\\s*\"CheckoutTests\"", label: "Test target `CheckoutTests`" },
          ],
          warnings: [
            { pattern: "name:\\s*\"Cart\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"Checkout\"", label: "`Cart` depende de `Checkout`: acoplamiento entre features" },
            { pattern: "name:\\s*\"(Networking|DesignSystem)\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"(Cart|Checkout)", label: "Una capa base no puede depender de una feature" },
          ],
          solution: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MercaditoModules",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "Networking", targets: ["Networking"]),
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
        .library(name: "Cart", targets: ["Cart"]),
        .library(name: "Checkout", targets: ["Checkout"]),
    ],
    targets: [
        .target(name: "Networking"),
        .target(name: "DesignSystem", resources: [.process("Resources")]),
        .target(name: "CheckoutInterface"),
        .target(name: "Cart", dependencies: ["CheckoutInterface", "Networking", "DesignSystem"]),
        .target(name: "Checkout", dependencies: ["CheckoutInterface", "Networking", "DesignSystem"]),
        .testTarget(name: "CartTests", dependencies: ["Cart"]),
        .testTarget(name: "CheckoutTests", dependencies: ["Checkout"]),
    ]
)`,
          hint: "`CheckoutInterface` no necesita producto propio: lo consumen targets del mismo paquete.",
        },
        {
          kind: "write",
          prompt: "Escribí el módulo `CheckoutInterface`: un `public struct CheckoutRequest` (`cartID: String`, `totalInCents: Int`, `Sendable` y `Equatable`) con su `public init`, y un protocolo `public` `CheckoutStarting`, aislado a `@MainActor`, con `func startCheckout(_ request: CheckoutRequest) -> UIViewController`.",
          starter: swift`// Sources/CheckoutInterface/CheckoutStarting.swift
import UIKit
`,
          checks: [
            { pattern: "public\\s+struct\\s+CheckoutRequest\\s*:\\s*[^{]*Sendable", label: "`CheckoutRequest` público y `Sendable`" },
            { pattern: "public\\s+let\\s+totalInCents\\s*:\\s*Int", label: "`totalInCents` público" },
            { pattern: "public\\s+init\\s*\\(", label: "`public init` explícito" },
            { pattern: "@MainActor\\s+public\\s+protocol\\s+CheckoutStarting", label: "Protocolo `public` en `@MainActor`" },
            { pattern: "func\\s+startCheckout\\s*\\(\\s*_\\s+request\\s*:\\s*CheckoutRequest\\s*\\)\\s*->\\s*UIViewController", label: "`startCheckout(_:)` devuelve el view controller" },
          ],
          warnings: [
            { pattern: "^import\\s+(Checkout|Networking)\\s*$", label: "La interfaz no debería importar la implementación ni capas pesadas" },
          ],
          solution: swift`// Sources/CheckoutInterface/CheckoutStarting.swift
import UIKit

public struct CheckoutRequest: Sendable, Equatable {
    public let cartID: String
    public let totalInCents: Int

    public init(cartID: String, totalInCents: Int) {
        self.cartID = cartID
        self.totalInCents = totalInCents
    }
}

@MainActor
public protocol CheckoutStarting {
    func startCheckout(_ request: CheckoutRequest) -> UIViewController
}`,
          hint: "Recordá que el memberwise init de un struct público es `internal`.",
        },
        {
          kind: "predict",
          prompt: "Con el grafo nuevo, un dev cambia la implementación privada de `CheckoutViewController` (no toca `CheckoutInterface`). En el build incremental, ¿qué se recompila?",
          code: swift`App ──▶ Cart, Checkout
Cart ──▶ CheckoutInterface
Checkout ──▶ CheckoutInterface`,
          options: [
            "Todo el paquete, porque cambió un archivo",
            "`Checkout`, `Cart` y la app",
            "`Checkout` y el enlazado de la app; `Cart` no, porque solo depende de la interfaz que no cambió",
            "Solo `CheckoutInterface`",
          ],
          answer: 2,
          explanation: "Se recompila el módulo tocado y lo que depende de él: la app vuelve a enlazar. `Cart` depende únicamente de `CheckoutInterface`, que no cambió, así que no se toca. Antes del split, el mismo cambio recompilaba el target entero: ahí está la ganancia medible.",
        },
        {
          kind: "write",
          prompt: "En la app, escribí `AppDependencies` (`@MainActor final class`): crea un `URLSessionHTTPClient`, un `RemoteCartRepository(http:)` y `checkout: any CheckoutStarting = CheckoutFlow(http: http)` (tipo concreto de `Checkout`; como usa `http`, va como `lazy var`). Agregá `func makeCartViewModel() -> CartViewModel` que pase `repository` y `checkout`.",
          starter: swift`import Networking
import Cart
import CheckoutInterface

@MainActor
final class AppDependencies {
}`,
          checks: [
            { pattern: "^import\\s+Checkout\\s*$", label: "La app importa la implementación `Checkout`" },
            { pattern: "let\\s+http\\s*(:\\s*any\\s+HTTPClient\\s*)?=\\s*URLSessionHTTPClient\\(", label: "Crea el cliente HTTP concreto" },
            { pattern: "(let|lazy\\s+var)\\s+checkout\\s*:\\s*any\\s+CheckoutStarting\\s*=\\s*CheckoutFlow\\(\\s*http:\\s*http\\s*\\)", label: "Crea `CheckoutFlow` y lo expone como protocolo" },
            { pattern: "func\\s+makeCartViewModel\\s*\\(\\s*\\)\\s*->\\s*CartViewModel", label: "Fábrica `makeCartViewModel()`" },
            { pattern: "CartViewModel\\(\\s*repository:\\s*\\w+\\s*,\\s*checkout:\\s*checkout\\s*\\)", label: "Inyecta repositorio y checkout" },
          ],
          warnings: [
            { pattern: "(?<!make)CartViewModel\\(\\s*\\)", label: "Un ViewModel sin dependencias las crea adentro" },
            { pattern: "\\.shared\\b", label: "Un singleton dentro de la composition root esconde decisiones" },
          ],
          solution: swift`import Networking
import Cart
import CheckoutInterface
import Checkout

@MainActor
final class AppDependencies {
    let http: any HTTPClient = URLSessionHTTPClient()
    lazy var cartRepository: any CartRepository = RemoteCartRepository(http: http)
    lazy var checkout: any CheckoutStarting = CheckoutFlow(http: http)

    func makeCartViewModel() -> CartViewModel {
        CartViewModel(repository: cartRepository, checkout: checkout)
    }
}`,
          hint: "Si una propiedad usa otra en su valor inicial, hacela `lazy var`.",
        },
        {
          kind: "predict",
          prompt: "Escribís un test de `CartViewModel` que verifica que \"Pagar\" inicia el checkout con el total correcto, usando un `SpyCheckoutStarting`. ¿De qué módulos tiene que depender `CartTests`?",
          code: swift`final class SpyCheckoutStarting: CheckoutStarting {
    var requests: [CheckoutRequest] = []
    func startCheckout(_ request: CheckoutRequest) -> UIViewController {
        requests.append(request)
        return UIViewController()
    }
}`,
          options: [
            "De `Cart` y `CheckoutInterface`; nunca necesita `Checkout`",
            "De `Cart`, `Checkout` y `Networking`",
            "De la app completa",
            "Solo de `Checkout`",
          ],
          answer: 0,
          explanation: "El spy cumple el protocolo de `CheckoutInterface`, así que el test no necesita compilar ni enlazar la implementación real de `Checkout`. Por eso los tests de `Cart` corren rápido y aislados: ese es el tercer beneficio de modularizar bien.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-target-vs-scheme",
      front: "Target vs scheme",
      back: "El target es la receta de un binario (fuentes, settings, `Info.plist`, entitlements). El scheme decide qué targets se buildean y con qué configuración, test plan, variables de entorno y argumentos se corre.",
    },
    {
      id: "fc-inherited",
      front: "¿Para qué sirve `$(inherited)` en un build setting?",
      back: "Agrega al valor que viene del nivel inferior en vez de reemplazarlo. Sin él, `SWIFT_ACTIVE_COMPILATION_CONDITIONS = STAGING` borra el `DEBUG` heredado.",
      code: swift`SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) STAGING`,
    },
    {
      id: "fc-xcconfig-url",
      front: "¿Por qué una URL en `.xcconfig` queda en `https:`?",
      back: "En `.xcconfig`, `//` empieza un comentario. Se escapa con una variable vacía: `https:/$()/`.",
      code: swift`API_BASE_URL = https:/$()/api.acme.com`,
    },
    {
      id: "fc-pbxproj",
      front: "¿Por qué `project.pbxproj` genera tantos conflictos y cómo se evita?",
      back: "Agregar un archivo toca varias secciones con IDs (`PBXFileReference`, `PBXBuildFile`, grupo, build phase). Se evita con carpetas sincronizadas (Xcode 16), generando el proyecto con Tuist/XcodeGen o moviendo código a paquetes SPM.",
    },
    {
      id: "fc-package-resolved",
      front: "¿Se commitea `Package.resolved` en una app?",
      back: "Sí. Fija la versión y el commit exactos de cada dependencia para que todas las máquinas y CI compilen lo mismo. Actualizar es un cambio explícito que se ve en el PR.",
    },
    {
      id: "fc-version-rules",
      front: "`from:` vs `.upToNextMinor(from:)` vs `exact:`",
      back: "`from: \"2.3.0\"` → 2.3.0 ..< 3.0.0. `.upToNextMinor(from: \"2.3.0\")` → 2.3.0 ..< 2.4.0. `exact:` → solo esa versión.",
    },
    {
      id: "fc-bundle-module",
      front: "¿Por qué una imagen de un paquete SPM aparece vacía?",
      back: "Se busca en `Bundle.main`, pero los recursos del paquete viven en su propio bundle. Usá `bundle: .module` y declarala en `resources` si no es un asset catalog.",
      code: swift`Image("empty-cart", bundle: .module)`,
    },
    {
      id: "fc-access-levels",
      front: "`open`, `public`, `package`, `internal`",
      back: "`open`: visible y subclaseable fuera del módulo. `public`: visible, no subclaseable afuera. `package`: visible en todos los módulos del mismo paquete. `internal` (default): solo el módulo.",
    },
    {
      id: "fc-public-init",
      front: "¿Por qué no puedo crear un `public struct` desde otro módulo?",
      back: "El memberwise init sintetizado es `internal`. Hay que escribir un `public init` explícito.",
    },
    {
      id: "fc-composition-root",
      front: "¿Qué es la composition root?",
      back: "El único lugar, cerca del arranque (`@main`, `SceneDelegate`, `AppDependencies`), donde se crean los tipos concretos y se inyectan. El resto del código recibe abstracciones.",
    },
    {
      id: "fc-hidden-deps",
      front: "Tres dependencias escondidas típicas y cómo inyectarlas",
      back: "`URLSession.shared` → protocolo `HTTPClient`. `UserDefaults.standard` → protocolo `KeyValueStore`. `Date()` → closure `now: () -> Date`.",
    },
    {
      id: "fc-factory-vs-swinject",
      front: "Factory vs Swinject",
      back: "Swinject registra en runtime y `resolve` devuelve optional: olvidarte un registro crashea. Factory define cada dependencia como propiedad computada: siempre devuelve un valor y el compilador lo chequea.",
    },
    {
      id: "fc-entry",
      front: "¿Cómo se declara un valor de environment custom en SwiftUI moderno?",
      back: "Con `@Entry` en una extensión de `EnvironmentValues` (Xcode 16). Se lee con `@Environment(\\.key)` y solo dentro de vistas.",
      code: swift`extension EnvironmentValues {
    @Entry var analytics: AnalyticsClient = .noop
}`,
    },
    {
      id: "fc-interface-module",
      front: "¿Para qué sirve un módulo `FeatureXInterface`?",
      back: "Contiene solo el contrato (protocolo + modelos mínimos). Otras features dependen de él en vez de la implementación: se cortan ciclos y los cambios internos de X no recompilan a sus consumidores.",
    },
    {
      id: "fc-static-dynamic",
      front: "Estático vs dinámico",
      back: "Estático: se copia en cada binario que lo enlaza (rápido al arrancar, se duplica). Dinámico: se embebe una vez y se carga al lanzar (compartido, suma tiempo de arranque). Una librería estática enlazada en dos binarios da dos copias y dos singletons.",
    },
  ],

  exam: [
    {
      id: "ex-pbxproj-conflicts",
      question: "Cuatro squads trabajan en un monolito y cada sprint pierden horas resolviendo conflictos en `project.pbxproj`. ¿Cuál es la solución de fondo?",
      options: [
        "Que un solo dev agregue todos los archivos nuevos",
        "Resolver siempre con \"accept theirs\"",
        "Agregar `project.pbxproj` al `.gitattributes` como binario",
        "Generar el proyecto (Tuist/XcodeGen) o usar carpetas sincronizadas y mover código a paquetes SPM",
      ],
      answer: 3,
      explanation: "El problema es que el proyecto lista archivo por archivo con IDs. Generar el proyecto desde una descripción, usar carpetas sincronizadas o mover código a SPM elimina esa lista. Marcarlo como binario solo impide mergear; \"accept theirs\" pierde archivos.",
    },
    {
      id: "ex-testable-release",
      question: "CI corre los tests en la configuración `Release` y falla con `module 'Cart' was not compiled for testing`. ¿Qué pasa?",
      code: swift`@testable import Cart`,
      options: [
        "`@testable` requiere que el módulo se compile con testability, activada por defecto solo en `Debug`",
        "`@testable` no funciona con paquetes SPM",
        "Falta `public` en todos los tipos de `Cart`",
        "Los tests tienen que estar en el mismo target que `Cart`",
      ],
      answer: 0,
      explanation: "`ENABLE_TESTABILITY` está en `YES` en `Debug` y en `NO` en `Release`. Se corren los tests en `Debug` (lo normal) o se habilita testability en la configuración que use CI.",
    },
    {
      id: "ex-package-resolved",
      question: "El lunes CI empezó a fallar sin que nadie tocara dependencias. Localmente compila. El `Package.resolved` está en `.gitignore`. ¿Cuál es la causa más probable?",
      options: [
        "Caché corrupta de Xcode en las máquinas locales",
        "CI resolvió una versión nueva dentro del rango `from:` con un cambio incompatible",
        "SPM no soporta CI",
        "Una dependencia local con `path:` mal escrito",
      ],
      answer: 1,
      explanation: "Sin `Package.resolved`, cada resolución elige la última versión que cumple el rango. Una librería que publicó un minor con un cambio roto llega primero a CI. Commitear el archivo hace que todos usen exactamente lo mismo.",
    },
    {
      id: "ex-bundle-module",
      question: "Moviste `OnboardingView` a un target SPM con sus imágenes en un asset catalog. Ahora las imágenes aparecen vacías, sin errores. ¿Qué corregís?",
      code: swift`Image("welcome")`,
      options: [
        "Mover el asset catalog de vuelta a la app",
        "Agregar `.copy(\"Assets.xcassets\")` en `resources`",
        "Usar `Image(\"welcome\", bundle: .module)`",
        "Usar `UIImage(named:)` en lugar de `Image`",
      ],
      answer: 2,
      explanation: "`Image(\"welcome\")` busca en `Bundle.main`. Los recursos del target viven en el bundle del módulo, accesible con `Bundle.module`. Los asset catalogs se procesan solos; con `.copy` no se compilarían.",
    },
    {
      id: "ex-flaky-date",
      question: "Un test de \"oferta vencida\" falla solo cuando CI corre después de las 21 h. ¿Qué cambio lo arregla de raíz?",
      code: swift`func isExpired() -> Bool { Date() > offer.endsAt }`,
      options: [
        "Inyectar un reloj (`now: () -> Date`) y pasar una fecha fija en el test",
        "Correr CI de día",
        "Usar `Date.now` en lugar de `Date()`",
        "Agregar un `sleep` antes del assert",
      ],
      answer: 0,
      explanation: "El test depende del reloj real. Inyectando `now`, producción usa `Date.init` y el test una fecha fija: el resultado es determinístico. `Date.now` es exactamente lo mismo que `Date()`.",
    },
    {
      id: "ex-container-runtime",
      question: "Después de una refactorización, la app crashea al abrir Favoritos con `Unexpectedly found nil` en `container.resolve(...)!`. ¿Qué enfoque hubiera detectado el error al compilar?",
      options: [
        "Swinject con `.inObjectScope(.container)`",
        "DI manual o Factory, donde cada dependencia es código que siempre devuelve un valor",
        "Usar `resolve(...)?` en lugar de `!`",
        "Registrar todo como singleton",
      ],
      answer: 1,
      explanation: "En Swinject el registro es dinámico: el compilador no sabe si existe. Con DI manual el `init` exige el parámetro, y en Factory cada dependencia es una propiedad computada que el compilador verifica. Con `?` el crash se convierte en un bug silencioso.",
    },
    {
      id: "ex-feature-coupling",
      question: "`Search` necesita abrir el detalle de producto, que vive en `ProductDetail`, y `ProductDetail` ya usa `Search` para \"productos similares\". ¿Cómo lo resolvés?",
      options: [
        "Juntar ambas features en un solo módulo",
        "Usar `@testable import` para romper el ciclo",
        "Hacer que la app pase closures globales",
        "Crear `ProductDetailInterface` con un protocolo de construcción; `Search` depende de la interfaz y la app inyecta la implementación",
      ],
      answer: 3,
      explanation: "El módulo de interfaz rompe el ciclo: `Search` → `ProductDetailInterface` ← `ProductDetail`. La app, como composition root, conoce las implementaciones y las conecta. Juntar módulos destruye las ganancias de la modularización.",
    },
    {
      id: "ex-static-duplicate",
      question: "Después de pasar `Core` a framework dinámico, el token de sesión que guarda la app no aparece cuando lo lee código dentro de `Core`. Ambos usan `SessionStore.shared` de la librería estática `Storage`, que enlazan los dos. ¿Por qué?",
      options: [
        "Los frameworks dinámicos no pueden usar singletons",
        "Falta `@MainActor` en `SessionStore`",
        "`Storage` quedó copiada en dos binarios: hay dos `SessionStore.shared` distintos",
        "El token se guarda en otro hilo",
      ],
      answer: 2,
      explanation: "Una librería estática se copia en cada binario que la enlaza. La app y `Core.framework` tienen cada uno su `SessionStore`. La solución es que `Storage` se enlace en un solo binario (solo vía `Core`) o que sea dinámica.",
    },
    {
      id: "ex-when-modularize",
      question: "¿Cuál de estas situaciones justifica más claramente invertir en modularizar?",
      options: [
        "Una app de 8 pantallas mantenida por una persona",
        "Que el tech lead leyó que las apps grandes lo hacen",
        "Un build incremental de 90 s por cualquier cambio y tres squads que se bloquean en los mismos archivos",
        "Querer usar más `public` en el código",
      ],
      answer: 2,
      explanation: "La modularización rinde cuando mejora métricas concretas: builds incrementales, autonomía de equipos y aislamiento de features. 90 s por cambio y squads bloqueados son exactamente esos problemas.",
    },
    {
      id: "ex-package-access",
      question: "`makeDecoder()` se usa en `Networking` y en `Catalog` (mismo paquete SPM). No querés que la app la vea. ¿Qué nivel de acceso usás?",
      options: [
        "`package`",
        "`public`",
        "`internal`",
        "`fileprivate`",
      ],
      answer: 0,
      explanation: "`package` (Swift 5.9) la hace visible para todos los módulos del paquete y oculta para los clientes. `public` la expone a la app; `internal` la limita a `Networking`.",
    },
    {
      id: "ex-environment-viewmodel",
      question: "Un dev intenta usar `@Environment(\\.analytics)` dentro de un `@Observable final class CheckoutModel` y el valor siempre es el default. ¿Qué le recomendás?",
      options: [
        "Usar `@EnvironmentObject` en el modelo",
        "Inyectar analytics por el `init` del modelo desde la composition root (o que la vista se lo pase)",
        "Llamar a `.environment(\\.analytics, ...)` dentro del modelo",
        "Marcar el modelo con `@MainActor`",
      ],
      answer: 1,
      explanation: "El environment solo lo resuelven las vistas de SwiftUI. Un modelo no está en la jerarquía de vistas, así que recibe sus dependencias por `init` como cualquier otro tipo.",
    },
    {
      id: "ex-service-locator",
      question: "En un review ves esto. ¿Cuál es el problema?",
      code: swift`final class OrdersModel {
    private let deps: AppDependencies
    init(deps: AppDependencies) { self.deps = deps }
    func load() async { await deps.ordersRepository.fetch() }
}`,
      options: [
        "Ninguno: es inyección por inicializador",
        "`AppDependencies` debería ser un `struct`",
        "Falta `@MainActor`",
        "Es un service locator: el modelo depende de todo el contenedor y sus dependencias reales quedan escondidas",
      ],
      answer: 3,
      explanation: "Recibir el contenedor no es inyectar dependencias: el `init` no dice qué usa el modelo, el test tiene que construir el contenedor entero y el módulo de Orders queda acoplado a la app. Se inyecta `any OrdersRepository` directamente.",
    },
  ],
};

export default content;
