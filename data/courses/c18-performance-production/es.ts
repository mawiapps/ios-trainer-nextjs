import type { CourseContent } from "../types";

// El código Swift va con String.raw para no perder las barras de `\(...)` ni de `\.keyPath`.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "debugging-toolkit",
      title: "Caja de herramientas de debugging",
      goal: "Usar breakpoints condicionales, simbólicos y de excepción, breakpoints que loguean sin parar, LLDB (`v`, `p`, `po`, `expr`) y los diagnósticos de Xcode para encontrar un bug sin llenar el código de `print`.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Breakpoints que trabajan por vos",
          body: [
            "Un breakpoint común para siempre. En una lista de 500 ítems donde solo falla el 437, eso es inútil. Un **breakpoint condicional** solo para cuando la condición es verdadera (`order.id == \"A-1029\"`), y el campo **Ignore** saltea las primeras N pasadas.",
            "Un **breakpoint simbólico** para en un símbolo, no en una línea: sirve para código que no es tuyo. El clásico es `UIViewAlertForUnsatisfiableConstraints`, que para justo cuando Auto Layout rompe una constraint. El **exception breakpoint** (All Objective-C Exceptions) para donde se lanza la excepción, no en `main` cuando ya es tarde; para errores de Swift está el **Swift Error Breakpoint**.",
            "Un breakpoint con **acción** puede loguear (`Log Message` con `@total@` para interpolar) o correr un comando de LLDB, y con **Automatically continue after evaluating actions** no detiene la app. Es un `print` que no ensucia el código, no se commitea y se apaga con un clic.",
          ],
          code: `# Condicional: solo para el pedido que falla
(lldb) breakpoint set --file CartViewModel.swift --line 42 --condition 'order.id == "A-1029"'

# Simbólico: para cuando Auto Layout rompe una constraint
(lldb) breakpoint set --name UIViewAlertForUnsatisfiableConstraints

# Loguea y sigue: un print sin tocar el código
(lldb) breakpoint set --file CartViewModel.swift --line 58 --auto-continue true
(lldb) breakpoint command add --one-liner "po total" 3`,
        },
        {
          kind: "predict",
          prompt: "La celda de un solo producto (`sku == \"TSHIRT-XL\"`) muestra el precio mal, en un catálogo de 800 productos. Querés inspeccionar `configure(with:)` solo para ese caso. ¿Qué usás?",
          code: swift`func configure(with product: Product) {
    titleLabel.text = product.name
    priceLabel.text = priceFormatter.string(for: product.price)   // línea 31
}`,
          options: [
            "Un breakpoint simbólico en `configure(with:)`",
            "Un `print(product)` en la línea 31 y buscar en la consola",
            "Un breakpoint en la línea 31 con la condición `product.sku == \"TSHIRT-XL\"`",
            "Un exception breakpoint, porque el precio mal es una excepción",
          ],
          answer: 2,
          explanation:
            "El condicional para solo en el caso que te interesa: no tocás 800 veces Continue ni agregás código. El simbólico pararía en todas las celdas. El `print` funciona pero ensucia el código y hay que acordarse de sacarlo. No hay ninguna excepción: el precio sale mal sin que nada se lance.",
        },
        {
          kind: "explain",
          title: "LLDB: `v`, `p`, `po` y `expr`",
          body: [
            "`v` (alias de `frame variable`) lee variables del frame **sin compilar ni ejecutar código**: es rápido y no tiene efectos secundarios. Úsalo primero. `p` evalúa una expresión y muestra el valor con su tipo. `po` evalúa y muestra la **descripción** del objeto: si el tipo conforma `CustomDebugStringConvertible`, usa `debugDescription`.",
            "`expr` ejecuta código en el proceso pausado y por lo tanto puede **cambiar estado**: forzar `isPremium = true` para probar una pantalla sin comprar, o cambiar un color. Como la UI no se redibuja mientras estás pausado, `CATransaction.flush()` aplica el cambio sin seguir.",
            "`bt` muestra el backtrace del hilo actual y `thread list` todos los hilos. Cuando un `po` falla con errores de compilación raros, probá `v`: no depende de compilar la expresión.",
          ],
          code: `(lldb) v order                      # lee sin ejecutar código
(lldb) p order.totalCents            # evalúa y muestra el valor con su tipo
(lldb) po order                      # usa debugDescription / description
(lldb) expr viewModel.isPremium = true
(lldb) expr -l objc -- (void)[CATransaction flush]
(lldb) bt                            # backtrace del hilo actual`,
        },
        {
          kind: "fill",
          prompt: "Estás pausado en un breakpoint y querés ver la pantalla premium sin comprar. Completá el comando de LLDB que cambia el estado.",
          code: `(lldb) ____ viewModel.isPremium = true`,
          accept: ["^expr$", "^expression$", "^e$"],
          hint: "Es el comando que **ejecuta** código, no el que solo lee variables.",
          explanation: "`expr` (o `expression`, o `e`) compila y ejecuta la expresión en el proceso, así que puede asignar. `v` solo lee variables del frame.",
        },
        {
          kind: "predict",
          prompt: "Estás pausado justo después de la última línea. ¿Qué muestran `print(price)` en la consola de la app y `po price` en LLDB?",
          code: swift`struct Money: CustomStringConvertible, CustomDebugStringConvertible {
    let cents: Int
    var description: String { "$\(cents / 100)" }
    var debugDescription: String { "Money(cents: \(cents))" }
}

let price = Money(cents: 1500)
print(price)
// (lldb) po price`,
          options: [
            "`$15` y `Money(cents: 1500)`",
            "`$15` y `$15`",
            "`Money(cents: 1500)` y `Money(cents: 1500)`",
            "`Money(cents: 1500)` y `$15`",
          ],
          answer: 0,
          explanation:
            "`print` usa `description`, así que imprime `$15`. `po` prefiere `debugDescription` cuando el tipo conforma `CustomDebugStringConvertible`, así que muestra `Money(cents: 1500)`. Por eso vale la pena darle un `debugDescription` útil a los modelos que inspeccionás seguido.",
        },
        {
          kind: "explain",
          title: "Ver lo que no ves: jerarquía de vistas, Main Thread Checker y Environment Overrides",
          body: [
            "El **View Hierarchy Debugger** (botón Debug View Hierarchy) pausa la app y muestra las vistas en 3D: encontrás la vista que tapa un botón, una con `alpha` 0 o con frame cero, y las constraints ambiguas marcadas en violeta.",
            "El **Main Thread Checker** (activo por defecto al correr desde Xcode, en Scheme → Diagnostics) detecta UIKit usado desde un hilo de fondo y te para en la línea. Esos bugs en producción son flicker, UI que no se actualiza o crashes intermitentes. **Thread Sanitizer** detecta data races, pero no se puede activar junto con Address Sanitizer.",
            "**Environment Overrides** (en la barra de debug) cambia en vivo Dark Mode, Dynamic Type y opciones de accesibilidad. Es la forma más rápida de reproducir un \"el texto se corta\" de un usuario con letra grande.",
          ],
          code: swift`final class ReceiptViewController: UIViewController {
    @IBOutlet private var statusLabel: UILabel!

    func refresh() {
        URLSession.shared.dataTask(with: receiptURL) { data, _, _ in
            // Este closure corre en un hilo de fondo
            self.statusLabel.text = "Listo"
            // Main Thread Checker: UI API called on a background thread: -[UILabel setText:]
        }.resume()
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Reescribí `refresh()` con `async/await` para que la actualización del label ocurra siempre en el main thread y el Main Thread Checker no se queje. Si falla la descarga, poné \"Error\" en el label.",
          starter: swift`final class ReceiptViewController: UIViewController {
    @IBOutlet private var statusLabel: UILabel!

    func refresh() {
        URLSession.shared.dataTask(with: receiptURL) { data, _, _ in
            self.statusLabel.text = "Listo"
        }.resume()
    }
}`,
          checks: [
            { pattern: "@MainActor", label: "La clase o el método están aislados al `@MainActor`" },
            { pattern: "func\\s+refresh\\(\\)\\s+async", label: "`refresh()` es `async`" },
            { pattern: "try\\s+await\\s+URLSession\\.shared\\.data\\(", label: "Usa `try await URLSession.shared.data(from:)`" },
            { pattern: "catch", label: "Maneja el error con `catch`" },
          ],
          warnings: [
            { pattern: "dataTask\\(", label: "Sigue usando el `dataTask` con completion handler" },
            { pattern: "DispatchQueue\\.global", label: "No hace falta mandar trabajo a mano a una cola global" },
          ],
          solution: swift`@MainActor
final class ReceiptViewController: UIViewController {
    @IBOutlet private var statusLabel: UILabel!

    func refresh() async {
        do {
            _ = try await URLSession.shared.data(from: receiptURL)
            statusLabel.text = "Listo"
        } catch {
            statusLabel.text = "Error"
        }
    }
}`,
          hint: "Con la clase en `@MainActor`, después del `await` volvés al main actor solo.",
        },
        {
          kind: "predict",
          prompt: "Un usuario manda una captura: el botón \"Pagar\" muestra \"Pa...\" cortado. Vos no lo ves en tu iPhone. ¿Qué es lo más rápido para reproducirlo?",
          code: swift`Button("Pagar") { checkout() }
    .frame(width: 80, height: 44)`,
          options: [
            "Pedirle al usuario un sysdiagnose",
            "Agregar un breakpoint simbólico en `UIViewAlertForUnsatisfiableConstraints`",
            "Abrir el View Hierarchy Debugger y buscar constraints ambiguas",
            "Correr la app y subir el tamaño de texto con Environment Overrides (Dynamic Type)",
          ],
          answer: 3,
          explanation:
            "El ancho fijo de 80 pt más un texto que crece con Dynamic Type es la causa típica de \"Pa...\". Environment Overrides cambia el tamaño de letra en vivo sin tocar Ajustes. El View Hierarchy no muestra nada raro con tu tamaño de letra, y acá no hay constraints rotas.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "memory-in-practice",
      title: "Memoria en la práctica",
      goal: "Encontrar una pantalla que nunca se libera con el Memory Graph Debugger e Instruments, escribir un test que lo detecte y calcular y reducir la memoria de las imágenes con downsampling.",
      minutes: 24,
      steps: [
        {
          kind: "explain",
          title: "El view controller que nunca se va",
          body: [
            "En el curso de memoria viste los retain cycles en teoría. En la práctica el síntoma es otro: la memoria sube cada vez que entrás y salís de una pantalla, o un observer se ejecuta dos, tres, cuatro veces porque las instancias viejas siguen vivas.",
            "La prueba más barata es un `deinit` que loguee: si cerrás la pantalla y no aparece, hay algo que la retiene. Para saber **qué**, pausá con **Debug Memory Graph**: a la izquierda ves cuántas instancias de cada clase hay vivas y los leaks marcados con un `!` violeta; al seleccionar una, el grafo muestra quién la retiene.",
            "Activá **Malloc Stack Logging** (Scheme → Diagnostics) y el inspector te muestra el backtrace donde se creó cada objeto. El ciclo más común: `self` retiene al view model, el view model retiene un closure y el closure captura `self` fuerte.",
          ],
          code: swift`final class ProfileViewController: UIViewController {
    private let viewModel = ProfileViewModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        viewModel.onUpdate = { profile in
            self.render(profile)   // self → viewModel → onUpdate → self
        }
    }

    deinit { print("ProfileViewController deinit") }   // nunca se imprime
}`,
        },
        {
          kind: "predict",
          code: swift`final class Screen {
    let name: String
    var onTap: (() -> Void)?

    init(name: String) {
        self.name = name
        onTap = { print("tap en", self.name) }
    }

    deinit { print("deinit", name) }
}

var screen: Screen? = Screen(name: "A")
screen = nil
print("fin")`,
          options: [
            "`deinit A` y después `fin`",
            "Solo `fin`",
            "`fin` y después `deinit A`",
            "`tap en A` y después `fin`",
          ],
          answer: 1,
          explanation:
            "El closure guardado en `onTap` captura `self` fuerte, y `self` retiene el closure: es un ciclo. Al hacer `screen = nil` el contador no llega a cero, `deinit` no corre y solo se imprime `fin`. El closure nunca se llamó, así que tampoco aparece `tap en A`.",
        },
        {
          kind: "fill",
          prompt: "Completá la lista de captura para romper el ciclo.",
          code: swift`viewModel.onUpdate = { [____ self] profile in
    guard let self else { return }
    self.render(profile)
}`,
          accept: ["^weak$"],
          hint: "La captura que se vuelve `nil` cuando el objeto se libera.",
          explanation: "`[weak self]` captura una referencia débil: no suma al contador y se vuelve `nil` si la pantalla se liberó. `unowned` también rompe el ciclo, pero crashea si el closure corre después de que la pantalla se fue.",
        },
        {
          kind: "explain",
          title: "Instruments: Leaks, Allocations y un test que lo atrapa",
          body: [
            "**Leaks** encuentra memoria a la que ya nadie apunta desde la app. Un ciclo entre objetos que siguen alcanzables (por ejemplo, desde un singleton) no es un leak para esa herramienta, pero igual es memoria perdida.",
            "Para eso está **Allocations** con **Mark Generation**: marcá una generación, entrá y salí de la pantalla, marcá otra, y repetí. Si cada generación deja objetos vivos que deberían haberse ido, ahí está el crecimiento. Filtrá por el nombre de tu módulo para no perderte en objetos del sistema.",
            "Una vez que lo arreglaste, que no vuelva: un test que crea la pantalla, la suelta y verifica con una referencia `weak` que se liberó. Corre en cada PR.",
          ],
          code: swift`func test_profileScreen_whenReleased_isDeallocated() {
    var sut: ProfileViewController? = ProfileViewController()
    sut?.loadViewIfNeeded()
    weak var weakSUT = sut

    sut = nil

    XCTAssertNil(weakSUT, "ProfileViewController tiene un retain cycle")
}`,
        },
        {
          kind: "predict",
          prompt: "Ya pusiste `[weak self]`. El usuario cierra la pantalla. ¿Qué pasa?",
          code: swift`final class LiveScoreViewController: UIViewController {
    private var timer: Timer?

    override func viewDidLoad() {
        super.viewDidLoad()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.reloadScore()
        }
    }
}`,
          options: [
            "El view controller sigue vivo porque el timer lo retiene",
            "El timer se invalida solo cuando el view controller se libera",
            "Crashea al siguiente disparo porque `self` ya no existe",
            "El view controller se libera, pero el timer sigue disparando cada segundo sin hacer nada",
          ],
          answer: 3,
          explanation:
            "Con `[weak self]` el closure no retiene la pantalla, así que se libera. Pero el run loop retiene al timer repetitivo, que sigue disparando con `self` en `nil`: gasta CPU y batería sin hacer nada. Hay que llamar a `timer?.invalidate()` al salir (por ejemplo en `viewWillDisappear`). No crashea porque `self?` es opcional.",
        },
        {
          kind: "explain",
          title: "Imágenes: lo que pesa en disco no importa",
          body: [
            "Un JPEG de 2 MB en disco se **decodifica** a un bitmap para mostrarlo, y el bitmap ocupa `ancho × alto × 4` bytes (RGBA, un byte por canal). Una foto de 4032 × 3024 son casi 49 MB, aunque la muestres en un thumbnail de 100 pt.",
            "Diez fotos así en un feed y el sistema termina tu app por memoria (jetsam), sin crash report de tu código. La solución es **downsampling**: decodificar directo al tamaño en píxeles en que se va a mostrar (puntos × escala de pantalla).",
            "ImageIO lo hace sin cargar la imagen completa: `CGImageSourceCreateThumbnailAtIndex` con `kCGImageSourceThumbnailMaxPixelSize`. En iOS 15+ también tenés `UIImage.preparingThumbnail(of:)`. Hacelo fuera del main thread: decodificar es trabajo de CPU.",
          ],
          code: swift`let width = 4032, height = 3024
print(width * height * 4)

func downsample(imageAt url: URL, to pointSize: CGSize, scale: CGFloat) -> UIImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else { return nil }

    let maxPixels = max(pointSize.width, pointSize.height) * scale
    let options = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceShouldCacheImmediately: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixels,
    ] as CFDictionary

    guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
    return UIImage(cgImage: cgImage)
}`,
          output: "48771072",
        },
        {
          kind: "predict",
          prompt: "Una foto cuadrada de 3000 × 3000 se muestra en un avatar de 120 × 120 pt en un iPhone @3x, con downsampling al tamaño exacto. ¿Cuántos bytes ocupa decodificada?",
          code: swift`let pointSize = CGSize(width: 120, height: 120)
let scale: CGFloat = 3
let image = downsample(imageAt: photoURL, to: pointSize, scale: scale)`,
          options: ["518400", "57600", "172800", "36000000"],
          answer: 0,
          explanation:
            "120 pt × 3 = 360 píxeles por lado. 360 × 360 × 4 = 518.400 bytes, unos 0,5 MB. Sin downsampling serían 3000 × 3000 × 4 = 36.000.000 bytes: casi 70 veces más para el mismo avatar en pantalla.",
        },
        {
          kind: "write",
          prompt:
            "Implementá `thumbnail(at:maxPixelSize:)` con ImageIO: creá el image source sin cachear la imagen completa y pedí un thumbnail de como máximo `maxPixelSize` píxeles, respetando la orientación EXIF.",
          starter: swift`import ImageIO
import UIKit

func thumbnail(at url: URL, maxPixelSize: CGFloat) -> UIImage? {
    // Hoy: decodifica la imagen completa
    UIImage(contentsOfFile: url.path)
}`,
          checks: [
            { pattern: "CGImageSourceCreateWithURL\\(", label: "Crea el source con `CGImageSourceCreateWithURL`" },
            { pattern: "CGImageSourceCreateThumbnailAtIndex\\(", label: "Pide el thumbnail con `CGImageSourceCreateThumbnailAtIndex`" },
            { pattern: "kCGImageSourceThumbnailMaxPixelSize", label: "Limita el tamaño con `kCGImageSourceThumbnailMaxPixelSize`" },
            { pattern: "kCGImageSourceCreateThumbnailFromImageAlways", label: "Genera el thumbnail desde la imagen (`kCGImageSourceCreateThumbnailFromImageAlways`)" },
            { pattern: "kCGImageSourceCreateThumbnailWithTransform", label: "Respeta la orientación (`kCGImageSourceCreateThumbnailWithTransform`)" },
          ],
          warnings: [{ pattern: "UIImage\\(contentsOfFile:", label: "`UIImage(contentsOfFile:)` decodifica la imagen a tamaño completo" }],
          solution: swift`import ImageIO
import UIKit

func thumbnail(at url: URL, maxPixelSize: CGFloat) -> UIImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else { return nil }

    let options = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceShouldCacheImmediately: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
    ] as CFDictionary

    guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
    return UIImage(cgImage: cgImage)
}`,
          hint: "Las opciones van en un diccionario `as CFDictionary`; el índice de la imagen es `0`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "crashes",
      title: "Crashes: leer el reporte y arreglar la causa",
      goal: "Leer un crash report simbolicado, reconocer los tipos de crash más comunes, asegurar los dSYM para simbolicar y entender la métrica de crash-free users.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "Anatomía de un crash report",
          body: [
            "En producción no hay debugger: el crash report es todo lo que tenés. Leelo en este orden: **Exception Type** (qué clase de crash), **Triggered by Thread** (qué hilo murió; el 0 es el main thread) y el **backtrace de ese hilo**, de arriba hacia abajo.",
            "El frame 0 es donde murió. Si es del sistema (`libswiftCore`, `UIKitCore`), bajá hasta el **primer frame de tu app**: esa es la línea de tu código que disparó todo. Con el reporte simbolicado ves función, offset y archivo:línea.",
            "Mirá también **Version** y **OS Version**: si el crash empezó con un release, tenés un diff concreto que revisar. Si aparece solo en una versión de iOS, sospechá de un cambio del sistema.",
          ],
          code: `Hardware Model:      iPhone15,2
Version:             3.4.1 (812)
OS Version:          iPhone OS 17.5 (21F79)

Exception Type:  EXC_BREAKPOINT (SIGTRAP)
Termination Reason: SIGNAL 5 Trace/BPT trap: 5
Triggered by Thread:  0

Thread 0 name:   Dispatch queue: com.apple.main-thread
Thread 0 Crashed:
0   Shop        0x0000000102b1c4a8 CartViewModel.removeItem(at:) + 212 (CartViewModel.swift:58)
1   Shop        0x0000000102b1b9f0 CartViewController.tableView(_:commit:forRowAt:) + 96 (CartViewController.swift:131)
2   UIKitCore   0x00000001a3c2e6d4 ...
...         (frames del sistema)`,
        },
        {
          kind: "predict",
          prompt: "El reporte de arriba apunta a `CartViewModel.swift:58` con `EXC_BREAKPOINT`. Este es el código de esa versión. ¿Cuál es la causa más probable?",
          code: swift`55  func removeItem(at index: Int) {
56      let item = items[index]
57      analytics.track("cart_item_removed")
58      let price = priceCache[item.sku]!
59      totalCents -= price
60  }`,
          options: [
            "`items[index]` con un índice fuera de rango",
            "Un `EXC_BAD_ACCESS` porque `priceCache` ya se liberó",
            "El force unwrap de `priceCache[item.sku]`, que devolvió `nil`",
            "El watchdog mató la app porque `analytics.track` bloqueó el main thread",
          ],
          answer: 2,
          explanation:
            "La línea 58 es el `!` sobre un diccionario: si el SKU no está en la cache, el subscript devuelve `nil` y el force unwrap dispara un trap, que en arm64 se ve como `EXC_BREAKPOINT (SIGTRAP)`. Un índice fuera de rango también da `EXC_BREAKPOINT`, pero estaría en la línea 56. Un watchdog no es `EXC_BREAKPOINT` ni apunta a una línea concreta.",
        },
        {
          kind: "explain",
          title: "Los crashes que vas a ver siempre",
          body: [
            "`EXC_BREAKPOINT (SIGTRAP)`: un trap del runtime de Swift. Force unwrap de `nil`, índice fuera de rango, overflow aritmético, `fatalError`, `try!` que falla, o leer una referencia `unowned` a un objeto ya liberado. Es determinístico: el frame apunta a la línea.",
            "`EXC_BAD_ACCESS (SIGSEGV o SIGBUS)` con `KERN_INVALID_ADDRESS`: acceso a memoria inválida. En Swift seguro casi siempre es un **data race** (dos hilos mutando el mismo array o diccionario), punteros `Unsafe`, `unowned(unsafe)` o código C/Objective-C. Es intermitente y el frame suele estar lejos de la causa: Thread Sanitizer te ayuda a reproducirlo.",
            "`EXC_CRASH (SIGABRT)`: una excepción de Objective-C no capturada, como `NSInternalInconsistencyException` cuando un `UITableView` recibe un batch update que no coincide con su data source. `EXC_CRASH (SIGKILL)` con el código `0x8badf00d` es el **watchdog**: el main thread no respondió a tiempo, típicamente por trabajo sincrónico al lanzar. Y si el sistema te mata por memoria (jetsam) no hay crash report de tu app: lo ves como un JetsamEvent o en las métricas de memoria.",
          ],
          code: swift`let user: User? = nil
_ = user!.name
// EXC_BREAKPOINT — Fatal error: Unexpectedly found nil while unwrapping an Optional value

let list = [1, 2, 3]
_ = list[3]
// EXC_BREAKPOINT — Fatal error: Index out of range

var cache: [String: Data] = [:]
DispatchQueue.concurrentPerform(iterations: 100) { i in
    cache["key\(i)"] = Data()   // data race
}
// EXC_BAD_ACCESS (SIGSEGV) intermitente, en cualquier lugar del diccionario`,
        },
        {
          kind: "predict",
          prompt: "Llega este reporte de usuarios con iPhones viejos, todos al abrir la app. ¿Qué pasó?",
          code: `Exception Type:  EXC_CRASH (SIGKILL)
Termination Reason: FRONTBOARD 2343432205
<RBSTerminateContext| domain:10 code:0x8BADF00D explanation:scene-create watchdog transgression ...>
Triggered by Thread:  0

Thread 0 Crashed:
0   libsystem_kernel.dylib  read + 8
1   Foundation              -[NSData initWithContentsOfFile:options:error:] + 212
2   Shop                    CatalogStore.loadFromDisk() + 140 (CatalogStore.swift:22)
3   Shop                    AppDelegate.application(_:didFinishLaunchingWithOptions:) + 312 (AppDelegate.swift:18)`,
          options: [
            "Un force unwrap en `CatalogStore.loadFromDisk()`",
            "El watchdog mató la app porque el main thread estaba ocupado leyendo disco durante el lanzamiento",
            "El sistema terminó la app por usar demasiada memoria",
            "Una excepción de Objective-C dentro de `NSData`",
          ],
          answer: 1,
          explanation:
            "`SIGKILL` con `0x8badf00d` (\"ate bad food\") es el watchdog: el sistema mata la app cuando el main thread no responde a tiempo en una transición como el lanzamiento. El backtrace muestra el main thread leyendo un archivo desde `didFinishLaunchingWithOptions`. En iPhones viejos el disco es más lento y se pasa del límite. No es un trap (`EXC_BREAKPOINT`) ni una excepción (`SIGABRT`), y por memoria no habría crash report.",
        },
        {
          kind: "explain",
          title: "dSYM y simbolicación",
          body: [
            "El binario que va a la App Store no tiene nombres de funciones legibles: un frame sin simbolicar es solo `Shop 0x0000000102b1c4a8 0x102b00000 + 115880`. El **dSYM** es el archivo con la información de debug que traduce direcciones a función, archivo y línea. Cada build tiene un UUID y el dSYM tiene que coincidir con ese UUID exacto.",
            "En Release, `DEBUG_INFORMATION_FORMAT` tiene que ser `dwarf-with-dsym`. Si usás Crashlytics o Sentry, el dSYM se sube en el build o en CI (Crashlytics con su script `upload-symbols`, Sentry con `sentry-cli debug-files upload`). Si un release no subió sus dSYMs, sus crashes quedan sin simbolicar hasta que los subas.",
            "Los crashes de la App Store (Xcode Organizer) los simbolica Xcode si tenés el archive. Para simbolicar una dirección a mano está `atos`.",
          ],
          code: `# Build Settings (Release)
DEBUG_INFORMATION_FORMAT = dwarf-with-dsym

# ¿Este dSYM es de este build? Compará el UUID con el del crash report
dwarfdump --uuid Shop.app.dSYM

# Simbolicar una dirección: -l = dirección de carga del binario
atos -arch arm64 -o Shop.app.dSYM/Contents/Resources/DWARF/Shop -l 0x102b00000 0x0000000102b1c4a8
# CartViewModel.removeItem(at:) (in Shop) (CartViewModel.swift:58)

# Subir los dSYM a Sentry desde CI
sentry-cli debug-files upload build/Shop.xcarchive/dSYMs`,
        },
        {
          kind: "fill",
          prompt: "Completá el valor de la build setting para que el build de Release genere el dSYM.",
          code: `DEBUG_INFORMATION_FORMAT = ____`,
          accept: ["^dwarf-with-dsym$"],
          hint: "En la UI de Xcode se llama \"DWARF with dSYM File\".",
          explanation: "`dwarf-with-dsym` genera el `.dSYM` aparte del binario. Con solo `dwarf` (lo normal en Debug) la información queda en los objetos intermedios y no tenés qué subir para simbolicar los crashes de producción.",
        },
        {
          kind: "write",
          prompt:
            "Reescribí `removeItem(at:)` para que no crashee: si el índice no es válido o el precio no está en la cache, no toques el total. Usá `assertionFailure` para que el bug salte en Debug sin matar la app en producción.",
          starter: swift`func removeItem(at index: Int) {
    let item = items[index]
    let price = priceCache[item.sku]!
    totalCents -= price
    items.remove(at: index)
}`,
          checks: [
            { pattern: "guard\\s+items\\.indices\\.contains\\(index\\)", label: "Valida el índice con `items.indices.contains(index)`" },
            { pattern: "(guard|if)\\s+let\\s+price\\s*=\\s*priceCache\\[", label: "Desenvuelve el precio con `guard let` o `if let`" },
            { pattern: "assertionFailure\\(", label: "Avisa en Debug con `assertionFailure`" },
            { pattern: "items\\.remove\\(at:\\s*index\\)", label: "Sigue quitando el ítem" },
          ],
          warnings: [
            { pattern: "\\]!", label: "Sigue habiendo un force unwrap" },
            { pattern: "try!", label: "`try!` crashea igual que `!`" },
          ],
          solution: swift`func removeItem(at index: Int) {
    guard items.indices.contains(index) else {
        assertionFailure("Índice inválido: \(index) de \(items.count)")
        return
    }
    let item = items[index]
    guard let price = priceCache[item.sku] else {
        assertionFailure("Sin precio en cache para \(item.sku)")
        return
    }
    totalCents -= price
    items.remove(at: index)
}`,
          hint: "`assertionFailure` corta en Debug y no hace nada en Release.",
        },
        {
          kind: "predict",
          prompt: "En una semana: 200.000 usuarios, 1.000.000 de sesiones. Hubo 2.000 sesiones con crash, repartidas entre 1.000 usuarios. ¿Cuál es el crash-free users?",
          code: `Usuarios:              200.000
Sesiones:            1.000.000
Sesiones con crash:      2.000
Usuarios con crash:      1.000`,
          options: ["99,8%", "99,0%", "99,9%", "99,5%"],
          answer: 3,
          explanation:
            "Crash-free users = usuarios sin ningún crash / usuarios totales = 199.000 / 200.000 = 99,5%. El 99,8% es crash-free **sessions** (998.000 / 1.000.000). Un usuario que crashea varias veces cuenta una sola vez para users y varias para sessions; por eso los dos números cuentan historias distintas y conviene mirar ambos.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "logging-observability",
      title: "Logs, métricas y analytics",
      goal: "Loguear con `Logger` (niveles, categorías y privacidad), medir intervalos con signposts, recibir métricas y diagnósticos con MetricKit y diseñar eventos de analytics que respondan preguntas de producto.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "`Logger`: logs estructurados y baratos",
          body: [
            "`print` va a stdout y en producción no lo ve nadie. `Logger` (framework `OSLog`) escribe en el sistema de logging unificado: cada mensaje tiene **subsystem** (en general tu bundle id) y **category** (área de la app), y en Console.app filtrás por los dos.",
            "Los niveles importan: `debug` para detalle de desarrollo, `info` para contexto útil, `notice` (el default) para eventos importantes, `error` para errores y `fault` para estados que no deberían pasar nunca. `debug` e `info` son muy baratos y el sistema no los guarda en disco por defecto; `notice`, `error` y `fault` sí se guardan.",
            "El mensaje es una interpolación especial: no arma el string si nadie lo va a leer, así que loguear en caminos calientes es barato. Centralizá los loggers en una extensión para no repetir el subsystem.",
          ],
          code: swift`import OSLog

extension Logger {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "com.acme.shop"
    static let checkout = Logger(subsystem: subsystem, category: "checkout")
    static let network = Logger(subsystem: subsystem, category: "network")
}

func applyCoupon(_ code: String, to cart: Cart) {
    Logger.checkout.debug("Recalculando carrito con \(cart.items.count) ítems")
    Logger.checkout.notice("Cupón aplicado")
    if cart.totalCents < 0 {
        Logger.checkout.fault("Total negativo después del cupón")
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el inicializador del logger de la pantalla de pagos.",
          code: swift`static let payments = Logger(subsystem: "com.acme.shop", ____: "payments")`,
          accept: ["^category$"],
          hint: "Es lo que agrupa los logs de un área de la app.",
          explanation: "`Logger(subsystem:category:)`: el subsystem identifica tu app o módulo y la category el área. En Console.app filtrás por `category:payments`.",
        },
        {
          kind: "explain",
          title: "Privacidad: los logs también son datos del usuario",
          body: [
            "Los logs terminan en sysdiagnoses que los usuarios mandan a soporte. Por eso `Logger` **oculta por defecto** los strings y objetos interpolados: en Console.app, sin el debugger conectado, ves `<private>`. Los números y booleanos son públicos por defecto.",
            "Marcá como `.public` solo lo que no identifica a nadie y necesitás para diagnosticar: códigos de error, estados, nombres de pantalla. Para poder correlacionar sin exponer el valor está `.private(mask: .hash)`, que muestra un hash en vez del dato.",
            "Ojo: conectado al debugger de Xcode todo se ve, así que el problema no aparece en desarrollo. Revisalo en Console.app con la app lanzada a mano.",
          ],
          code: swift`func didLogin(email: String, userID: Int, plan: String) {
    Logger.auth.info("Login \(email) id=\(userID) plan=\(plan, privacy: .public)")
    Logger.auth.info("Login hash=\(email, privacy: .private(mask: .hash))")
}
// Console.app, sin debugger:
// Login <private> id=48213 plan=premium`,
        },
        {
          kind: "predict",
          prompt: "La app corre sin el debugger conectado. ¿Qué ves en Console.app?",
          code: swift`let email = "ana@mail.com"
let amountCents = 4599
let reason = "card_declined"
Logger.payments.error("Pago falló para \(email) monto=\(amountCents) motivo=\(reason, privacy: .public)")`,
          options: [
            "`Pago falló para ana@mail.com monto=4599 motivo=card_declined`",
            "`Pago falló para <private> monto=<private> motivo=card_declined`",
            "`Pago falló para <private> monto=4599 motivo=card_declined`",
            "`Pago falló para <private> monto=<private> motivo=<private>`",
          ],
          answer: 2,
          explanation:
            "El email es un `String` sin anotación: privado por defecto, se ve `<private>`. `amountCents` es un `Int`: los escalares son públicos por defecto. `reason` está marcado `.public`. Resultado: solo el email queda oculto, que es justo lo que querés.",
        },
        {
          kind: "explain",
          title: "Signposts y Console.app",
          body: [
            "Un log te dice **qué** pasó; un **signpost** te dice **cuánto tardó**. `OSSignposter` marca el comienzo y el fin de un intervalo, y en Instruments (Points of Interest, o el instrumento os_signpost) ves cada intervalo en la línea de tiempo, alineado con la CPU y el main thread.",
            "Con `beginInterval` obtenés un estado que pasás a `endInterval` con el mismo nombre. Un `defer` asegura que el intervalo se cierre aunque la función tire un error.",
            "Para leer los logs: Console.app (activá Include Info/Debug Messages en el menú Action) con el dispositivo conectado, o `log stream` en la terminal. En el simulador, con `xcrun simctl spawn booted log stream`.",
          ],
          code: swift`let signposter = OSSignposter(logger: .feed)

func loadFeed() async throws -> [Post] {
    let state = signposter.beginInterval("loadFeed")
    defer { signposter.endInterval("loadFeed", state) }
    return try await api.fetchFeed()
}

// Terminal (simulador):
// xcrun simctl spawn booted log stream --level debug --predicate 'subsystem == "com.acme.shop"'`,
        },
        {
          kind: "fill",
          prompt: "Completá la línea que cierra el intervalo del signpost.",
          code: swift`let state = signposter.beginInterval("decodeCatalog")
defer { signposter.____("decodeCatalog", state) }
return try decoder.decode(Catalog.self, from: data)`,
          accept: ["^endInterval$"],
          hint: "El par de `beginInterval`.",
          explanation: "`endInterval(_:_:)` recibe el mismo nombre y el estado que devolvió `beginInterval`. En el `defer` corre siempre, incluso si `decode` tira.",
        },
        {
          kind: "explain",
          title: "MetricKit y Xcode Organizer: lo que pasa en los iPhones de verdad",
          body: [
            "Instruments mide tu iPhone; **MetricKit** te trae lo que pasa en los de tus usuarios. Te suscribís con `MXMetricManager.shared.add(_:)` y el sistema te entrega `MXMetricPayload` (agregados de, en general, las últimas 24 horas: tiempo de lanzamiento, hangs, memoria, CPU, batería) y `MXDiagnosticPayload` (crashes, hangs, excepciones de CPU y escrituras a disco, con call stacks).",
            "Las métricas llegan como mucho una vez por día; desde iOS 15 los diagnósticos llegan en el siguiente lanzamiento. Cada payload tiene `jsonRepresentation()` para mandarlo tal cual a tu backend.",
            "**Xcode Organizer** muestra las mismas fuentes agregadas por versión para los usuarios que comparten datos con desarrolladores: Crashes, Hangs, Launch Time, Memory, Disk Writes, Energy y Scrolling. Es la primera parada después de cada release.",
          ],
          code: swift`import MetricKit

final class MetricsSubscriber: NSObject, MXMetricManagerSubscriber {
    func start() {
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            uploader.send(payload.jsonRepresentation(), kind: "metrics")
        }
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            uploader.send(payload.jsonRepresentation(), kind: "diagnostics")
        }
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Escribí `HangReporter`: se suscribe a MetricKit y, por cada diagnóstico de hang, loguea con `Logger.performance.error` la duración (`hangDuration`) y manda el call stack (`callStackTree.jsonRepresentation()`) con `uploader.send(_:)`.",
          starter: swift`import MetricKit
import OSLog

final class HangReporter {
    // suscribite a MetricKit y procesá los hangs
}`,
          checks: [
            { pattern: "class\\s+HangReporter\\s*:\\s*NSObject\\s*,\\s*MXMetricManagerSubscriber", label: "Hereda de `NSObject` y conforma `MXMetricManagerSubscriber`" },
            { pattern: "MXMetricManager\\.shared\\.add\\(self\\)", label: "Se suscribe con `MXMetricManager.shared.add(self)`" },
            { pattern: "func\\s+didReceive\\(_\\s+payloads:\\s*\\[MXDiagnosticPayload\\]\\)", label: "Implementa `didReceive(_:)` para `[MXDiagnosticPayload]`" },
            { pattern: "\\.hangDiagnostics", label: "Lee `hangDiagnostics`" },
            { pattern: "callStackTree\\.jsonRepresentation\\(\\)", label: "Manda el call stack con `callStackTree.jsonRepresentation()`" },
            { pattern: "Logger\\.performance\\.error\\(", label: "Loguea con `Logger.performance.error`" },
          ],
          warnings: [{ pattern: "print\\(", label: "En producción usá `Logger`, no `print`" }],
          solution: swift`import MetricKit
import OSLog

final class HangReporter: NSObject, MXMetricManagerSubscriber {
    func start() {
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            for hang in payload.hangDiagnostics ?? [] {
                Logger.performance.error("Hang de \(hang.hangDuration, privacy: .public)")
                uploader.send(hang.callStackTree.jsonRepresentation())
            }
        }
    }
}`,
          hint: "`hangDiagnostics` es opcional: `?? []`.",
        },
        {
          kind: "explain",
          title: "Analytics: eventos que responden preguntas",
          body: [
            "Un evento sirve si responde una pregunta de producto. Usá nombres consistentes `objeto_acción` en pasado (`paywall_viewed`, `purchase_completed`), propiedades tipadas y nunca datos personales. Modelalos como un `enum` para que el compilador evite typos.",
            "Un **funnel** es una secuencia de eventos: `onboarding_completed` → `paywall_viewed` → `purchase_started` → `purchase_completed`. Si las compras caen, el funnel te dice en qué paso se va la gente.",
            "En un **A/B test** la variante viene de un feature flag remoto. Logueá la **exposición** cuando el usuario realmente ve la variante (con la variante como propiedad), no cuando se asigna: si no, comparás grupos llenos de gente que nunca vio el cambio.",
          ],
          code: swift`enum AnalyticsEvent {
    case onboardingCompleted(steps: Int)
    case paywallViewed(source: String, variant: String)
    case purchaseCompleted(productID: String, priceCents: Int)

    var name: String {
        switch self {
        case .onboardingCompleted: "onboarding_completed"
        case .paywallViewed: "paywall_viewed"
        case .purchaseCompleted: "purchase_completed"
        }
    }
}

let variant = flags.string("paywall_layout", default: "control")
analytics.track(.paywallViewed(source: "onboarding", variant: variant))`,
        },
        {
          kind: "predict",
          prompt: "El flag `paywall_layout` se asigna al abrir la app, pero solo el 40% de los usuarios llega al paywall. ¿Dónde logueás el evento de exposición del A/B test?",
          code: swift`// AppDelegate
let variant = flags.string("paywall_layout", default: "control")

// PaywallView
.onAppear { /* ... */ }`,
          options: [
            "En `PaywallView.onAppear`, con la variante como propiedad",
            "En el `AppDelegate`, cuando se asigna el flag",
            "En `purchase_completed`, porque es lo que importa",
            "En los dos lugares, para tener más datos",
          ],
          answer: 0,
          explanation:
            "La exposición es el momento en que el usuario ve la variante. Si la logueás al asignar, el 60% que nunca llegó al paywall diluye ambos grupos y el efecto real queda escondido. Loguear solo la compra no te da el denominador. Loguear en los dos lugares duplica y confunde la métrica.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "instruments-performance",
      title: "Performance con Instruments",
      goal: "Medir antes de optimizar con Time Profiler, Hangs y Animation Hitches, reducir el tiempo de lanzamiento, arreglar el scroll de una lista y entender cuándo se recalcula una vista de SwiftUI.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "Medí antes de optimizar",
          body: [
            "La intuición sobre performance falla seguido. Medí con **Product → Profile** (⌘I): compila en **Release** y corre en un **dispositivo real**, porque el simulador usa la CPU de tu Mac y Debug no optimiza.",
            "**Time Profiler** muestrea qué está ejecutando cada hilo cada pocos milisegundos. En el call tree activá **Hide System Libraries** e **Invert Call Tree** para ver arriba tus funciones más caras, y seleccioná el rango del problema en la línea de tiempo.",
            "El presupuesto por frame es `1000 / Hz` milisegundos: 16,67 ms a 60 Hz y 8,33 ms a 120 Hz (ProMotion). Todo lo que hacés en el main thread mientras se scrollea compite por ese presupuesto.",
          ],
          code: swift`// Time Profiler marca esta función como la más cara del scroll
func configure(with post: Post) {
    let formatter = DateFormatter()          // crear un DateFormatter es caro
    formatter.dateStyle = .medium
    dateLabel.text = formatter.string(from: post.date)

    let data = try? Data(contentsOf: post.avatarURL)   // I/O sincrónico en el main thread
    avatarView.image = data.flatMap(UIImage.init(data:))
}`,
        },
        {
          kind: "predict",
          prompt: "Tu app corre en un iPhone con pantalla de 120 Hz. ¿Cuánto tiempo tenés como máximo para producir cada frame sin que se note un salto?",
          code: swift`let refreshRate = 120.0
let budget = 1000 / refreshRate`,
          options: ["16,67 ms", "8,33 ms", "33,33 ms", "4,17 ms"],
          answer: 1,
          explanation:
            "1000 ms / 120 = 8,33 ms por frame. 16,67 ms es el presupuesto a 60 Hz. Si el commit de un frame se pasa del presupuesto, se entrega tarde: eso es un hitch y el usuario lo ve como un tirón.",
        },
        {
          kind: "explain",
          title: "Hangs y hitches",
          body: [
            "Un **hang** es cuando el main thread no responde a eventos durante un tiempo que el usuario percibe: tocás y no pasa nada. Las causas típicas son I/O de disco o red sincrónicos, parseo de JSON grande, locks y `DispatchQueue.main.sync`. El instrumento **Hangs** los marca en la línea de tiempo y Xcode Organizer los agrupa por backtrace en producción.",
            "Un **hitch** es un frame que llega tarde durante una animación o un scroll. El instrumento **Animation Hitches** muestra cuáles y si el problema fue tu código en el main thread (commit) o el render.",
            "El arreglo casi siempre es el mismo: el trabajo pesado sale del main thread (a un `actor` o un `Task.detached`) y el main thread solo aplica el resultado.",
          ],
          code: swift`@MainActor
func showReport() {
    let data = try? Data(contentsOf: reportURL)                     // disco en main
    let rows = (try? JSONDecoder().decode([Row].self, from: data ?? Data())) ?? []
    render(rows)                                                    // lo único que debe estar en main
}`,
        },
        {
          kind: "write",
          prompt:
            "Arreglá `configure(with:)`: no crees un `DateFormatter` por celda (usá `formatted(date:time:)` o un formatter `static`) y cargá el avatar de forma asíncrona con `await` en vez de leerlo sincrónicamente. Asumí que existe `ImageLoader.shared.image(for:) async -> UIImage?`.",
          starter: swift`func configure(with post: Post) {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    dateLabel.text = formatter.string(from: post.date)

    let data = try? Data(contentsOf: post.avatarURL)
    avatarView.image = data.flatMap(UIImage.init(data:))
}`,
          checks: [
            { pattern: "\\.formatted\\(|static\\s+let\\s+\\w+\\s*(:\\s*DateFormatter)?\\s*=", label: "Formatea con `formatted(...)` o un formatter `static` reutilizado" },
            { pattern: "await\\s+ImageLoader\\.shared\\.image\\(for:", label: "Carga el avatar con `await ImageLoader.shared.image(for:)`" },
            { pattern: "Task\\s*\\{", label: "Lanza la carga en un `Task`" },
          ],
          warnings: [
            { pattern: "Data\\(contentsOf:", label: "`Data(contentsOf:)` bloquea el main thread" },
            { pattern: "let\\s+formatter\\s*=\\s*DateFormatter\\(\\)", label: "Sigue creando un `DateFormatter` en cada celda" },
          ],
          solution: swift`private var avatarTask: Task<Void, Never>?

func configure(with post: Post) {
    dateLabel.text = post.date.formatted(date: .abbreviated, time: .omitted)

    avatarView.image = nil
    avatarTask?.cancel()
    avatarTask = Task { [weak self] in
        let image = await ImageLoader.shared.image(for: post.avatarURL)
        guard !Task.isCancelled else { return }
        self?.avatarView.image = image
    }
}`,
          hint: "Las celdas se reciclan: cancelá la tarea anterior antes de lanzar otra.",
        },
        {
          kind: "explain",
          title: "Tiempo de lanzamiento",
          body: [
            "Un **cold launch** es cuando el proceso no está en memoria (después de reiniciar o de que el sistema lo descargó): es el peor caso y el que tenés que medir. Un **warm launch** reutiliza parte de lo que ya estaba cargado. Volver desde background no es un lanzamiento.",
            "El lanzamiento incluye lo que pasa antes de `main` (cargar el binario y frameworks dinámicos, inicializadores estáticos) y lo que pasa de `main` hasta el **primer frame**: `didFinishLaunchingWithOptions`, la escena y el `body` de la primera pantalla. Todo eso corre en el main thread, y si tarda demasiado entra el watchdog.",
            "Regla práctica: antes del primer frame solo lo imprescindible (el crash reporter, que tiene que estar listo antes que cualquier crash). Lo demás (analytics, limpieza de cache, prefetch) se difiere. Medilo con `XCTApplicationLaunchMetric` y seguilo en el Organizer.",
          ],
          code: swift`func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    CrashReporter.start()                 // sí: antes que cualquier otra cosa
    Task(priority: .utility) {
        await AnalyticsSDK.configure()    // diferido: no hace falta para el primer frame
        await ImageCache.shared.trimDisk()
    }
    return true
}

// UI test de performance
func testLaunchPerformance() {
    measure(metrics: [XCTApplicationLaunchMetric()]) {
        XCUIApplication().launch()
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Estás recortando `didFinishLaunchingWithOptions`. ¿Cuál de estas tareas conviene dejar sincrónica, antes del primer frame?",
          code: swift`// Hoy, todo sincrónico en didFinishLaunchingWithOptions:
// 1. Limpiar imágenes viejas de la cache de disco
// 2. Configurar el SDK de analytics
// 3. Iniciar el crash reporter
// 4. Precargar el catálogo completo desde la red`,
          options: [
            "Limpiar la cache de disco",
            "Configurar analytics",
            "Iniciar el crash reporter",
            "Precargar el catálogo",
          ],
          answer: 2,
          explanation:
            "El crash reporter tiene que estar instalado antes de que algo pueda crashear, incluido el resto del lanzamiento; si lo diferís, perdés justo los crashes de arranque. Limpiar la cache y configurar analytics pueden esperar a después del primer frame. Precargar el catálogo desde la red jamás debería bloquear el lanzamiento.",
        },
        {
          kind: "explain",
          title: "SwiftUI: ¿por qué se recalculó esta vista?",
          body: [
            "En SwiftUI el costo está en cuántas veces se evalúa `body` y cuánto trabajo hace. `Self._printChanges()` dentro de `body` imprime en la consola qué cambió y provocó la evaluación (`@self`, `@identity` o el nombre de una propiedad). Es una API con guion bajo: solo para debugging, nunca la dejes en producción.",
            "Con `ObservableObject`, cualquier `@Published` que cambie invalida **todas** las vistas que observan el objeto. Con `@Observable` (iOS 17) SwiftUI registra qué propiedades leyó cada `body` y solo recalcula las vistas que leyeron la propiedad que cambió.",
            "En listas, usá ids estables (`Identifiable` con un id del modelo, no el índice) y no hagas trabajo pesado en `body`: formateo, filtrado y ordenamiento van precalculados. El instrumento de SwiftUI en Instruments te muestra cuántas veces se evaluó cada `body` y cuánto tardó.",
          ],
          code: swift`struct CounterView: View {
    @State private var count = 0

    var body: some View {
        let _ = Self._printChanges()
        Button("Sumar: \(count)") { count += 1 }
    }
}
// Consola al tocar el botón: CounterView: _count changed.`,
        },
        {
          kind: "fill",
          prompt: "Completá la línea de debugging que imprime qué provocó la evaluación de `body`.",
          code: swift`var body: some View {
    let _ = Self.____()
    List(viewModel.items) { ItemRow(item: $0) }
}`,
          accept: ["^_printChanges$"],
          hint: "Empieza con guion bajo.",
          explanation: "`Self._printChanges()` imprime qué cambió en la vista. El `let _ =` es porque `body` es un view builder y no acepta una llamada suelta que devuelve `Void`.",
        },
        {
          kind: "predict",
          prompt: "`NameLabel` solo lee `model.name`. Se ejecuta `model.cartCount += 1`. ¿Se vuelve a evaluar el `body` de `NameLabel` en cada versión?",
          code: swift`// Versión A
final class ProfileModel: ObservableObject {
    @Published var name = "Ana"
    @Published var cartCount = 0
}

// Versión B
@Observable final class ProfileModel {
    var name = "Ana"
    var cartCount = 0
}

struct NameLabel: View {
    // A: @ObservedObject var model: ProfileModel
    // B: let model: ProfileModel
    var body: some View { Text(model.name) }
}`,
          options: [
            "No en ninguna: `name` no cambió",
            "Sí en las dos: el modelo cambió",
            "Solo en la B: `@Observable` invalida todo el modelo",
            "Solo en la A: `ObservableObject` avisa a todos los observadores por cualquier `@Published`",
          ],
          answer: 3,
          explanation:
            "`ObservableObject` publica un `objectWillChange` por cualquier `@Published`, así que toda vista que lo observa se reevalúa aunque no lea `cartCount`. `@Observable` registra que `NameLabel` solo leyó `name`, así que cambiar `cartCount` no la toca. En pantallas grandes esa diferencia se nota en el scroll.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: un hang y un crash en producción",
      goal: "Diagnosticar un hang y un crash a partir de datos de producción, arreglar los dos con código y dejar la pantalla instrumentada para la próxima.",
      minutes: 30,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Salió la versión 3.5 de Shop. En el Organizer, el top de Hangs apunta a la pantalla Pedidos, y Crashlytics muestra un crash nuevo en el top 1, también en Pedidos. Soporte dice: \"tarda en abrir y a veces se cierra al tocar un pedido justo después de refrescar\".",
            "El cache de pedidos es un JSON de varios MB en disco y se parsea en `load()`. El pull-to-refresh reemplaza `orders` por la lista nueva, que puede tener menos elementos, mientras la celda que tocaste todavía tiene el índice viejo.",
            "Abajo está el código y el crash report. Vas a: leer el crash, sacar el parseo del main thread, arreglar la selección y agregar logs y signposts para que la próxima vez no tengas que adivinar.",
          ],
          code: swift`@MainActor
final class OrdersViewModel: ObservableObject {
    @Published var orders: [Order] = []
    @Published var selected: Order?

    func load() {
        let data = try! Data(contentsOf: Self.cacheURL)                    // OrdersViewModel.swift:21
        orders = try! JSONDecoder().decode([Order].self, from: data)
    }

    func select(at index: Int) {
        selected = orders[index]                                           // OrdersViewModel.swift:27
    }
}

/*
Exception Type:  EXC_BREAKPOINT (SIGTRAP)
Triggered by Thread:  0

Thread 0 Crashed:
0   libswiftCore.dylib  _assertionFailure(_:_:file:line:flags:) + 264
1   Shop                OrdersViewModel.select(at:) + 88 (OrdersViewModel.swift:27)
2   Shop                OrdersView.body.getter closure #2 + 64 (OrdersView.swift:40)
3   SwiftUI             ...
*/`,
        },
        {
          kind: "predict",
          prompt: "Leyendo el crash report y el código, ¿cuál es la causa del crash?",
          code: `Exception Type:  EXC_BREAKPOINT (SIGTRAP)
0   libswiftCore.dylib  _assertionFailure(_:_:file:line:flags:) + 264
1   Shop                OrdersViewModel.select(at:) + 88 (OrdersViewModel.swift:27)`,
          options: [
            "`orders[index]` con un índice viejo que quedó fuera de rango después del refresh",
            "Un bug en `libswiftCore`, porque es el frame 0",
            "El `try!` de `JSONDecoder` en `load()`",
            "El watchdog, porque `load()` bloquea el main thread",
          ],
          answer: 0,
          explanation:
            "El frame 0 es la función del runtime que dispara el trap; el primer frame de tu app es `select(at:)` en la línea 27, que es `orders[index]`. Encaja con el relato: el refresh achica la lista y la celda conserva un índice que ya no existe. El `try!` de `load()` está en otra función y el watchdog sería `SIGKILL` con `0x8badf00d`, no `EXC_BREAKPOINT`.",
        },
        {
          kind: "write",
          prompt:
            "Sacá el parseo del main thread: `load()` pasa a ser `async`, lee y decodifica en un `Task.detached` (o en un `actor`) y solo asigna `orders` en el main actor. Nada de `try!`: si falla, logueá el error con `Logger.orders.error` y dejá la lista como estaba.",
          starter: swift`func load() {
    let data = try! Data(contentsOf: Self.cacheURL)
    orders = try! JSONDecoder().decode([Order].self, from: data)
}`,
          checks: [
            { pattern: "func\\s+load\\(\\)\\s+async", label: "`load()` es `async`" },
            { pattern: "Task\\.detached|actor\\s+\\w+", label: "El trabajo pesado corre fuera del main thread (`Task.detached` o un `actor`)" },
            { pattern: "try\\s+await", label: "Espera el resultado con `try await`" },
            { pattern: "catch", label: "Maneja el error con `catch`" },
            { pattern: "Logger\\.orders\\.error\\(", label: "Loguea el error con `Logger.orders.error`" },
          ],
          warnings: [
            { pattern: "try!", label: "`try!` crashea si el archivo no existe o el JSON cambió" },
            { pattern: "DispatchQueue\\.main\\.sync", label: "`DispatchQueue.main.sync` bloquea y puede causar deadlocks" },
          ],
          solution: swift`func load() async {
    let url = Self.cacheURL
    do {
        let loaded = try await Task.detached(priority: .userInitiated) {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode([Order].self, from: data)
        }.value
        orders = loaded
    } catch {
        Logger.orders.error("No se pudo leer el cache: \(error.localizedDescription, privacy: .public)")
    }
}`,
          hint: "Copiá `Self.cacheURL` a una constante antes del `Task.detached` y devolvé `[Order]` desde el closure (tiene que ser `Sendable`).",
        },
        {
          kind: "write",
          prompt:
            "Arreglá la selección: en vez de un índice, `select(id:)` recibe el id del pedido y lo busca en la lista actual. Si ya no existe, no crashea: loguea un `notice` con `Logger.orders` y no cambia `selected`.",
          starter: swift`func select(at index: Int) {
    selected = orders[index]
}`,
          checks: [
            { pattern: "func\\s+select\\(id:", label: "La función recibe un id: `select(id:)`" },
            { pattern: "first\\(where:", label: "Busca el pedido con `first(where:)`" },
            { pattern: "guard\\s+let|if\\s+let", label: "Desenvuelve el resultado de forma segura" },
            { pattern: "Logger\\.orders\\.notice\\(", label: "Loguea el caso con `Logger.orders.notice`" },
          ],
          warnings: [
            { pattern: "orders\\[index\\]", label: "Sigue accediendo por índice" },
            { pattern: "\\)!", label: "Hay un force unwrap" },
          ],
          solution: swift`func select(id: Order.ID) {
    guard let order = orders.first(where: { $0.id == id }) else {
        Logger.orders.notice("Pedido \(id, privacy: .public) ya no está en la lista")
        return
    }
    selected = order
}`,
          hint: "Un id sobrevive a un refresh; un índice no.",
        },
        {
          kind: "write",
          prompt:
            "Instrumentá `load()` para la próxima: definí `Logger.orders` con `Logger(subsystem:category:)`, creá un `OSSignposter` y envolvé la carga en un intervalo `\"loadOrders\"`. Al terminar, logueá con `info` la cantidad de pedidos marcada como `.public`.",
          starter: swift`extension Logger {
    // static let orders = ...
}

func load() async {
    // ... carga de la consigna anterior
}`,
          checks: [
            { pattern: "static\\s+let\\s+orders\\s*=\\s*Logger\\(subsystem:", label: "Define `Logger.orders` con `Logger(subsystem:category:)`" },
            { pattern: "OSSignposter\\(", label: "Crea un `OSSignposter`" },
            { pattern: "beginInterval\\(\"loadOrders\"", label: "Abre el intervalo `loadOrders`" },
            { pattern: "endInterval\\(\"loadOrders\"", label: "Cierra el intervalo `loadOrders`" },
            { pattern: "privacy:\\s*\\.public", label: "Marca la cantidad como `.public`" },
          ],
          warnings: [{ pattern: "print\\(", label: "En producción usá `Logger`, no `print`" }],
          solution: swift`extension Logger {
    static let orders = Logger(subsystem: "com.acme.shop", category: "orders")
}

private let signposter = OSSignposter(logger: .orders)

func load() async {
    let state = signposter.beginInterval("loadOrders")
    defer { signposter.endInterval("loadOrders", state) }

    let url = Self.cacheURL
    do {
        let loaded = try await Task.detached(priority: .userInitiated) {
            try JSONDecoder().decode([Order].self, from: Data(contentsOf: url))
        }.value
        orders = loaded
        Logger.orders.info("Pedidos cargados: \(loaded.count, privacy: .public)")
    } catch {
        Logger.orders.error("No se pudo leer el cache: \(error.localizedDescription, privacy: .public)")
    }
}`,
          hint: "El `defer` cierra el intervalo aunque la carga falle.",
        },
        {
          kind: "predict",
          prompt: "Sale la 3.5.1 con los dos arreglos. ¿Cómo confirmás que funcionaron en producción?",
          code: `3.5   → Hangs en Pedidos: top 1   | Crash select(at:): top 1
3.5.1 → ?`,
          options: [
            "Probando en tu iPhone: si no se cuelga, está arreglado",
            "Esperando a que soporte deje de recibir quejas",
            "Comparando por versión en el Organizer (Hangs) y en Crashlytics (crash-free users y ese issue), más los diagnósticos de hang de MetricKit",
            "Agregando un `print` en `load()` y revisando la consola",
          ],
          answer: 2,
          explanation:
            "Tu iPhone es un solo dispositivo, rápido y con datos de prueba: el problema aparecía en otros. Lo que confirma el arreglo son los datos agregados por versión: el issue no aparece en la 3.5.1, el crash-free users sube y los hangs de Pedidos dejan el top. Soporte es una señal lenta y un `print` no lo ve nadie en producción.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "lldb-v-p-po",
      front: "¿Qué diferencia hay entre `v`, `p` y `po` en LLDB?",
      back: "`v` lee variables del frame sin ejecutar código (rápido, sin efectos). `p` evalúa una expresión y muestra el valor con su tipo. `po` evalúa y muestra la descripción del objeto (`debugDescription` si existe). Para cambiar estado: `expr`.",
    },
    {
      id: "log-breakpoint",
      front: "¿Cómo logueás un valor sin agregar `print` ni detener la app?",
      back: "Un breakpoint con acción Log Message (o un comando de LLDB como `po total`) y la opción Automatically continue after evaluating actions.",
    },
    {
      id: "symbolic-breakpoint",
      front: "¿Para qué sirve un breakpoint simbólico en `UIViewAlertForUnsatisfiableConstraints`?",
      back: "Para detenerte justo cuando Auto Layout rompe una constraint, con el backtrace que muestra qué vista la causó. Los simbólicos paran en un símbolo, aunque el código no sea tuyo.",
    },
    {
      id: "main-thread-checker",
      front: "¿Qué detecta el Main Thread Checker?",
      back: "Uso de APIs de UIKit/AppKit desde un hilo que no es el main. Te para en la línea con un mensaje como `UI API called on a background thread`. Para data races en general está Thread Sanitizer.",
    },
    {
      id: "image-memory",
      front: "¿Cuánta memoria ocupa una imagen decodificada?",
      back: "`ancho × alto × 4` bytes (RGBA), sin importar cuánto pese el archivo. Una foto de 4032 × 3024 son unos 49 MB.",
      code: "4032 * 3024 * 4 = 48_771_072 bytes",
    },
    {
      id: "downsampling",
      front: "¿Qué es downsampling y con qué API se hace?",
      back: "Decodificar la imagen directo al tamaño en píxeles en que se muestra. Con ImageIO: `CGImageSourceCreateThumbnailAtIndex` y `kCGImageSourceThumbnailMaxPixelSize` (o `preparingThumbnail(of:)` en iOS 15+).",
    },
    {
      id: "leaks-vs-allocations",
      front: "Leaks no muestra nada pero la memoria crece al abrir y cerrar una pantalla. ¿Qué hacés?",
      back: "Allocations con Mark Generation: marcás, abrís y cerrás la pantalla, volvés a marcar. Si cada generación deja objetos vivos, hay memoria abandonada (por ejemplo, un ciclo alcanzable desde un singleton), que Leaks no reporta.",
    },
    {
      id: "exc-breakpoint",
      front: "¿Qué suele significar `EXC_BREAKPOINT (SIGTRAP)` en una app Swift?",
      back: "Un trap del runtime: force unwrap de `nil`, índice fuera de rango, overflow, `try!` o `fatalError`. Es determinístico; buscá el primer frame de tu app.",
    },
    {
      id: "exc-bad-access",
      front: "¿Qué suele significar `EXC_BAD_ACCESS` con `KERN_INVALID_ADDRESS`?",
      back: "Acceso a memoria inválida. En Swift, casi siempre un data race, código `Unsafe` o C/Objective-C. Es intermitente; reproducilo con Thread Sanitizer o Address Sanitizer.",
    },
    {
      id: "watchdog",
      front: "¿Qué indica `0x8badf00d` en un crash report?",
      back: "El watchdog mató la app (`SIGKILL`) porque el main thread no respondió a tiempo, típicamente por trabajo sincrónico (disco, red, parseo) durante el lanzamiento.",
    },
    {
      id: "dsym",
      front: "¿Qué es un dSYM y qué pasa si falta?",
      back: "El archivo de debug que traduce direcciones a función, archivo y línea. Se empareja por UUID con el build. Si no se subió, los crashes de esa versión quedan como direcciones hexadecimales.",
    },
    {
      id: "crash-free",
      front: "¿Qué diferencia hay entre crash-free users y crash-free sessions?",
      back: "Users: porcentaje de usuarios sin ningún crash en el período. Sessions: porcentaje de sesiones sin crash. Un usuario que crashea muchas veces pesa una vez en users y muchas en sessions.",
    },
    {
      id: "logger-privacy",
      front: "¿Qué se ve por defecto de un `String` interpolado en un `Logger`, sin debugger?",
      back: "`<private>`. Strings y objetos son privados por defecto; números y booleanos, públicos. Marcá con `privacy: .public` solo lo que no identifica a nadie.",
      code: "Logger.payments.error(\"Falló \\(code, privacy: .public) para \\(email)\")",
    },
    {
      id: "metrickit",
      front: "¿Qué te da MetricKit?",
      back: "Con `MXMetricManager.shared.add(_:)` recibís `MXMetricPayload` (métricas agregadas, en general una vez por día) y `MXDiagnosticPayload` (crashes, hangs, excepciones de CPU y de escritura a disco, con call stacks) de los dispositivos de tus usuarios.",
    },
    {
      id: "print-changes",
      front: "¿Cómo averiguás por qué se volvió a evaluar el `body` de una vista SwiftUI?",
      back: "Con `let _ = Self._printChanges()` dentro de `body`: imprime qué cambió (`@self`, `@identity` o el nombre de la propiedad). Solo para debugging.",
    },
  ],

  exam: [
    {
      id: "exam-conditional-log",
      question: "Un bug solo aparece cuando el carrito tiene más de 100 ítems, dentro de un loop que corre miles de veces. Querés ver el valor de `subtotal` en cada iteración problemática sin detener la app ni tocar el código. ¿Qué usás?",
      code: swift`for item in cart.items {
    subtotal += item.priceCents * item.quantity   // línea 77
}`,
      options: [
        "Un `print` dentro del loop protegido con `#if DEBUG`",
        "Un breakpoint en la línea 77 con condición `cart.items.count > 100`, acción `po subtotal` y Automatically continue",
        "Un breakpoint simbólico en `+=`",
        "Un exception breakpoint",
      ],
      answer: 1,
      explanation:
        "La condición filtra los casos que importan, la acción loguea el valor y el auto-continue evita que la app se detenga miles de veces. No hay que tocar ni commitear código. Un simbólico en `+=` pararía en todo el proceso y no hay ninguna excepción en juego.",
    },
    {
      id: "exam-memory-graph",
      question: "Entrás y salís cinco veces de la pantalla de producto. El Memory Graph muestra cinco instancias vivas de `ProductViewController` y el grafo muestra que cada una la retiene un closure guardado en su `ProductViewModel`. ¿Cuál es el arreglo?",
      code: swift`viewModel.onPriceChange = { price in
    self.priceLabel.text = price
}`,
      options: [
        "Llamar a `viewModel = nil` en `viewDidLoad`",
        "Marcar `viewModel` como `weak`",
        "Mover el closure a `viewWillAppear`",
        "Capturar `[weak self]` en el closure",
      ],
      answer: 3,
      explanation:
        "El ciclo es `self` → `viewModel` → closure → `self`. `[weak self]` hace que el closure no retenga la pantalla. Un `viewModel` `weak` se liberaría enseguida porque nadie más lo retiene. Moverlo a `viewWillAppear` crea el mismo ciclo, solo que en otro momento.",
    },
    {
      id: "exam-image-memory",
      question: "Un feed muestra fotos de 4000 × 3000 en thumbnails de 80 × 80 pt. Después de scrollear un rato, la app se cierra sin crash report. ¿Qué es lo más probable y cómo se arregla?",
      options: [
        "El sistema la terminó por memoria: cada imagen decodificada ocupa unos 48 MB; hay que hacer downsampling al tamaño mostrado con ImageIO",
        "Un data race en la cache de imágenes; hay que usar un `actor`",
        "El watchdog, porque las imágenes se descargan en el main thread",
        "Un force unwrap en la celda; hay que usar `guard let`",
      ],
      answer: 0,
      explanation:
        "4000 × 3000 × 4 = 48.000.000 bytes por imagen decodificada, para mostrar 240 × 240 píxeles en @3x. Unas cuantas en memoria y el sistema mata la app (jetsam), que no genera crash report de tu código. Un force unwrap o un data race sí dejarían un crash report.",
    },
    {
      id: "exam-unsymbolicated",
      question: "Los crashes de la versión 4.2 en Crashlytics se ven así, mientras que los de la 4.1 muestran funciones y líneas. ¿Qué pasó?",
      code: `0   Shop    0x0000000104a1c4a8 0x104a00000 + 115880
1   Shop    0x0000000104a1b9f0 0x104a00000 + 113136`,
      options: [
        "La 4.2 se compiló en Debug",
        "Crashlytics no soporta la versión de iOS de esos usuarios",
        "No se subieron los dSYM de ese build (o no coinciden por UUID)",
        "El crash ocurrió en un framework del sistema",
      ],
      answer: 2,
      explanation:
        "Sin el dSYM que corresponde a ese build exacto no hay forma de traducir direcciones a símbolos. Los frames son de `Shop`, así que es tu binario, no del sistema. El arreglo es subir los dSYM de la 4.2 (desde el archive o App Store Connect) y automatizar la subida en CI.",
    },
    {
      id: "exam-watchdog",
      question: "Un crash report dice `EXC_CRASH (SIGKILL)` y en la razón de terminación aparece `0x8badf00d`. El main thread está en `JSONDecoder.decode` llamado desde `scene(_:willConnectTo:options:)`. ¿Qué pasó?",
      options: [
        "El JSON estaba mal formado y `decode` crasheó",
        "El sistema mató la app por usar demasiada memoria",
        "El watchdog mató la app porque el main thread estuvo bloqueado parseando durante el lanzamiento",
        "Un force unwrap del resultado de `decode`",
      ],
      answer: 2,
      explanation:
        "`0x8badf00d` es la marca del watchdog: el sistema espera que la app termine de lanzar y responda en un tiempo razonable. Parsear sincrónicamente en el main thread al conectar la escena lo impide. Un JSON inválido tira un error (o `EXC_BREAKPOINT` con `try!`), no `SIGKILL`.",
    },
    {
      id: "exam-bad-access",
      question: "Aparece un `EXC_BAD_ACCESS (SIGSEGV)` intermitente, siempre en un hilo de fondo, dentro de `Dictionary`. Varias tareas escriben en `ImageCache.storage`, una clase normal con un `[URL: UIImage]`. ¿Qué hacés?",
      options: [
        "Reproducir con Thread Sanitizer y proteger el estado, por ejemplo convirtiendo `ImageCache` en un `actor`",
        "Agregar `[weak self]` en todos los closures",
        "Envolver el acceso en `do/catch`",
        "Cambiar el diccionario por un array",
      ],
      answer: 0,
      explanation:
        "Escrituras concurrentes sobre un `Dictionary` sin sincronización son un data race: corrompen memoria y crashean en cualquier lado. Thread Sanitizer lo detecta y un `actor` serializa el acceso (Swift 6 además lo marca en compilación). `do/catch` no atrapa accesos inválidos y `weak` no tiene que ver.",
    },
    {
      id: "exam-logger-privacy",
      question: "Soporte necesita ver el código de error de los pagos fallidos en los sysdiagnose, pero el email del usuario nunca debe aparecer. ¿Cuál es el log correcto?",
      options: [
        "`logger.error(\"Pago falló \\(code) \\(email, privacy: .public)\")`",
        "`print(\"Pago falló \\(code) \\(email)\")`",
        "`logger.error(\"Pago falló \\(code, privacy: .private) \\(email, privacy: .private)\")`",
        "`logger.error(\"Pago falló \\(code, privacy: .public) \\(email)\")`",
      ],
      answer: 3,
      explanation:
        "El código (un `String` como `card_declined`) es privado por defecto, así que hay que marcarlo `.public`. El email sin anotación queda como `<private>`. `print` no llega a los logs del sistema de la misma forma ni tiene privacidad, y las otras opciones exponen el email u ocultan el código.",
    },
    {
      id: "exam-metrickit",
      question: "Querés el call stack de los hangs que sufren tus usuarios para mandarlo a tu backend. ¿De dónde sale?",
      options: [
        "De `MXMetricPayload.applicationResponsivenessMetrics`",
        "De `MXDiagnosticPayload.hangDiagnostics`, con `callStackTree`",
        "De `Logger`, leyendo los logs con `OSLogStore`",
        "Del instrumento Hangs, conectando el iPhone del usuario",
      ],
      answer: 1,
      explanation:
        "Los diagnósticos (`MXDiagnosticPayload`) traen eventos concretos con call stack: `hangDiagnostics`, `crashDiagnostics`, etc. Las métricas (`MXMetricPayload`) son agregados, como histogramas de duración de hangs, sin stack. Instruments solo sirve con un dispositivo conectado a tu Mac.",
    },
    {
      id: "exam-funnel",
      question: "Después de un release, las compras bajaron un 30%. Tenés los eventos `onboarding_completed`, `paywall_viewed`, `purchase_started` y `purchase_completed`. ¿Qué mirás primero?",
      options: [
        "La conversión entre cada par de pasos del funnel, versión vieja contra nueva, para ver en qué paso se cae",
        "La cantidad total de eventos por día",
        "El crash-free users de la versión nueva",
        "Los logs de un usuario elegido al azar",
      ],
      answer: 0,
      explanation:
        "El funnel te dice dónde se va la gente: si `paywall_viewed` → `purchase_started` está igual pero `purchase_started` → `purchase_completed` cayó, el problema está en el flujo de compra, no en el paywall. El total diario no localiza nada y el crash-free solo cubre una de muchas causas posibles.",
    },
    {
      id: "exam-measure-first",
      question: "QA reporta que el scroll del feed \"se siente trabado\" en un iPhone viejo. Un compañero propone pasar las celdas a SwiftUI. ¿Cuál es el primer paso?",
      options: [
        "Pasar las celdas a SwiftUI, que es más rápido",
        "Bajar la calidad de las imágenes",
        "Perfilar en Release en ese dispositivo con Time Profiler y Animation Hitches para ver qué trabajo se pasa del presupuesto",
        "Probar en el simulador con Debug para iterar más rápido",
      ],
      answer: 2,
      explanation:
        "Sin medir, estás adivinando: el problema puede ser un `DateFormatter` por celda, I/O en el main thread o imágenes sin downsampling, y reescribir no lo arreglaría. Hay que perfilar en Release y en dispositivo real; el simulador usa la CPU de la Mac y Debug no optimiza.",
    },
    {
      id: "exam-launch",
      question: "Tu `didFinishLaunchingWithOptions` hace todo esto de forma sincrónica. Para bajar el tiempo de lanzamiento sin perder información, ¿qué combinación es la correcta?",
      code: swift`CrashReporter.start()
AnalyticsSDK.configure()
try? FileManager.default.removeItem(at: oldCacheURL)
RemoteConfig.fetchAndWait()   // espera a la red`,
      options: [
        "Diferir todo a un `Task`, incluido el crash reporter",
        "Dejar `CrashReporter.start()` sincrónico y diferir el resto; no esperar la red antes del primer frame (usar valores por defecto o los cacheados)",
        "Dejar todo igual pero en un iPhone más nuevo",
        "Mover todo a `viewDidLoad` de la primera pantalla",
      ],
      answer: 1,
      explanation:
        "El crash reporter tiene que estar listo antes de cualquier crash. Analytics y limpieza pueden esperar. Esperar la red en el lanzamiento es lo peor: depende de la conexión y puede disparar el watchdog. Pasarlo a `viewDidLoad` sigue estando antes del primer frame.",
    },
    {
      id: "exam-list-identity",
      question: "Cada vez que llega un mensaje nuevo arriba de la lista, todas las filas se recrean y pierden su estado local. `Self._printChanges()` en `MessageRow` muestra `@identity` en todas. ¿Cuál es la causa?",
      code: swift`ForEach(Array(messages.enumerated()), id: \.offset) { _, message in
    MessageRow(message: message)
}`,
      options: [
        "`MessageRow` debería ser una clase",
        "Falta `Self._printChanges()` en la vista padre",
        "`ForEach` no soporta `enumerated()`",
        "La identidad es el índice: al insertar arriba cambia la de todas las filas; hay que usar un id estable del modelo (`Identifiable`)",
      ],
      answer: 3,
      explanation:
        "Con `id: \\.offset`, el mensaje que estaba en la posición 0 pasa a la 1 y SwiftUI cree que cada fila es otra: las destruye y crea de nuevo, con su estado. Con `ForEach(messages)` y `Message: Identifiable` (un id del servidor), solo se inserta la fila nueva.",
    },
  ],
};

export default content;
