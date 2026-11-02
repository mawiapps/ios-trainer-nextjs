import type { CourseContent } from "../types";

// El código va con String.raw para no perder las barras de `\(...)`.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "push-notifications",
      title: "Push notifications de punta a punta",
      goal: "Configurar APNs con una clave `.p8`, pedir permiso en el momento correcto, obtener el device token, armar payloads y manejar taps, acciones y rich media.",
      minutes: 30,
      steps: [
        {
          kind: "explain",
          title: "El circuito: permiso, token y APNs",
          body: [
            "Una push recorre este camino: la app se registra en APNs y recibe un **device token**; la app se lo manda a tu backend; el backend le pide a APNs que entregue un payload a ese token. Tu servidor se autentica con una **clave `.p8`** (token-based auth): se crea una vez en el portal de developer, sirve para todas las apps del equipo y no vence como los viejos certificados `.p12`. El backend firma un JWT con el Key ID y el Team ID.",
            "Mostrar alertas requiere permiso (`requestAuthorization`); obtener el token, no. `registerForRemoteNotifications()` se llama **en cada lanzamiento**: el token puede cambiar (restaurar un backup, reinstalar) y si tu backend guarda uno viejo, las pushes se pierden en silencio.",
            "El token es `Data`: convertilo a hex con `%02x`. No uses `description`, que desde iOS 13 no devuelve el hex. Además, los builds de debug usan el APNs de **sandbox** y los de TestFlight/App Store el de **producción**: un token de un ambiente no sirve en el otro (lo define el entitlement `aps-environment`).",
          ],
          code: swift`import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = PushRouter.shared
        application.registerForRemoteNotifications() // en cada lanzamiento
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { try? await PushAPI.shared.register(token: token) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        logger.error("APNs: \(error.localizedDescription)")
    }
}

// SwiftUI: @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

// Pedir permiso, en el momento oportuno (no en el primer arranque)
@MainActor
func enableOrderUpdates() async -> Bool {
    let center = UNUserNotificationCenter.current()
    let settings = await center.notificationSettings()
    guard settings.authorizationStatus == .notDetermined else {
        return settings.authorizationStatus == .authorized
    }
    return (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
}`,
        },
        {
          kind: "predict",
          prompt: "Marketing quiere más usuarios con notificaciones activas. ¿Cuándo pedís el permiso?",
          code: swift`// Flujo de la app:
// 1. Primer arranque → onboarding de 3 pantallas
// 2. Catálogo
// 3. Primer pedido confirmado → "¿Querés que te avisemos cuando salga?"
// El diálogo del sistema aparece UNA sola vez por instalación.`,
          options: [
            "En `application(_:didFinishLaunchingWithOptions:)`, así no se pierde a nadie",
            "Nunca: `registerForRemoteNotifications()` ya alcanza para mostrar alertas",
            "Después del primer pedido, con una pantalla propia que explica el beneficio y recién ahí `requestAuthorization`",
            "En el onboarding, y si lo rechaza, volvés a llamar a `requestAuthorization` hasta que acepte",
          ],
          answer: 2,
          explanation:
            "El diálogo del sistema sale una sola vez: si el usuario dice que no, solo lo puede revertir desde Ajustes, y volver a llamar a `requestAuthorization` devuelve `false` sin mostrar nada. Por eso se pide cuando el beneficio es obvio (seguir el pedido que acaba de hacer), con un pre-permiso propio antes. Pedirlo en el primer arranque, sin contexto, baja la tasa de aceptación. Registrarse en APNs da el token pero no permite mostrar alertas. Otra opción es la autorización `.provisional`: entrega en silencio al Centro de notificaciones sin preguntar.",
        },
        {
          kind: "predict",
          prompt: "¿Qué imprime este código?",
          code: swift`import Foundation

let deviceToken = Data([0x0A, 0xFF, 0x01])
let token = deviceToken.map { String(format: "%02x", $0) }.joined()
print(token)`,
          options: ["0aff01", "0AFF01", "aff1", "{length = 3, bytes = 0x0aff01}"],
          answer: 0,
          explanation:
            "Cada byte se formatea con `%02x`: hexadecimal en minúsculas, rellenado a dos dígitos. `0x0A` → `0a`, `0xFF` → `ff`, `0x01` → `01`. Sin el `02` perderías los ceros (`aff1`) y el backend recibiría un token inválido. La última opción es lo que devuelve `description` desde iOS 13: por eso no se usa.",
        },
        {
          kind: "explain",
          title: "Anatomía del payload",
          body: [
            "El payload es JSON (máximo 4 KB) con un diccionario `aps` que interpreta el sistema y, **fuera de `aps`**, tus claves propias (`orderId`). Dentro de `aps`: `alert` (`title`, `subtitle`, `body`), `badge` (número), `sound`, `category` (qué acciones mostrar), `thread-id` (agrupar), `mutable-content` y `content-available`.",
            "`mutable-content: 1` hace que, antes de mostrarse, la push pase por tu **Notification Service Extension**: un target aparte que puede bajar una imagen, adjuntarla como `UNNotificationAttachment` o desencriptar el texto. Tiene poco tiempo; si se le acaba, el sistema llama a `serviceExtensionTimeWillExpire()` y tenés que entregar lo que tengas.",
            "`content-available: 1` sin `alert` es una **silent push**: despierta la app en segundo plano para refrescar datos. Requiere el Background Mode \"Remote notifications\", header `apns-push-type: background` y `apns-priority: 5`. El sistema las limita y las puede demorar o descartar: nunca dependas de ellas para algo crítico.",
          ],
          code: swift`// Headers HTTP/2 hacia APNs
// apns-topic: com.shop.app
// apns-push-type: alert
// apns-priority: 10
{
  "aps": {
    "alert": {
      "title": "Tu pedido salió",
      "body": "Llega en 25 minutos. Tocá para ver el recorrido."
    },
    "badge": 1,
    "sound": "default",
    "category": "ORDER_STATUS",
    "thread-id": "order-A-1029",
    "mutable-content": 1
  },
  "orderId": "A-1029",
  "imageURL": "https://cdn.shop.example.com/maps/A-1029.png"
}`,
        },
        {
          kind: "fill",
          prompt: "Querés que la Notification Service Extension descargue la imagen del mapa antes de mostrar la push. Completá la clave.",
          code: swift`{
  "aps": {
    "alert": { "title": "Tu pedido salió", "body": "Tocá para ver el recorrido" },
    "____": 1
  },
  "imageURL": "https://cdn.shop.example.com/maps/A-1029.png"
}`,
          accept: ["^mutable-content$"],
          hint: "La extensión puede *mutar* el contenido.",
          explanation: "`mutable-content: 1` (junto con un `alert`) hace que iOS pase la notificación por la Notification Service Extension. `content-available` es otra cosa: silent push para la app.",
        },
        {
          kind: "predict",
          prompt: "El backend manda esta push para refrescar el inbox. El usuario había cerrado la app deslizándola en el app switcher. ¿Qué pasa?",
          code: swift`// apns-push-type: background
// apns-priority: 5
{
  "aps": { "content-available": 1 },
  "inboxVersion": 42
}`,
          options: [
            "La app se lanza en segundo plano y refresca, como siempre",
            "iOS muestra una alerta vacía",
            "APNs devuelve error porque falta `alert`",
            "iOS no despierta la app: las silent pushes no lanzan una app que el usuario cerró a la fuerza",
          ],
          answer: 3,
          explanation:
            "Si el usuario mató la app desde el app switcher, iOS respeta esa decisión y no la relanza por pushes en segundo plano. Aun con la app suspendida, el sistema puede demorar o agrupar silent pushes. No hay alerta porque no hay `alert`, y APNs acepta el payload sin problema. Conclusión: la silent push es una optimización; el dato se refresca igual al abrir la app.",
        },
        {
          kind: "explain",
          title: "Acciones, categorías y taps",
          body: [
            "Una **categoría** agrupa acciones (`UNNotificationAction`) y se registra al arrancar con `setNotificationCategories`. El payload elige la categoría con `category`. Opciones útiles: `.foreground` abre la app, `.destructive` la pinta en rojo, `.authenticationRequired` pide desbloquear.",
            "El delegate (`UNUserNotificationCenterDelegate`) tiene dos métodos clave. `willPresent` decide qué hacer si llega una push **con la app en primer plano** (por defecto no se muestra nada). `didReceive` se llama cuando el usuario **toca** la notificación o una acción; `actionIdentifier` es `UNNotificationDefaultActionIdentifier` para el tap normal.",
            "Asigná el delegate en `didFinishLaunching`: si la app arranca en frío por un tap y el delegate todavía no está, perdés ese tap. Los datos propios llegan en `userInfo`; casteá con `as?`, nunca `as!`.",
            "FCM u OneSignal envuelven APNs: igual subís la clave `.p8` a su consola y la app igual necesita el entitlement de push. FCM además hace method swizzling del AppDelegate por defecto; si ya manejás el token a mano, desactivalo.",
          ],
          code: swift`let track = UNNotificationAction(identifier: "TRACK", title: "Ver recorrido", options: [.foreground])
let cancel = UNNotificationAction(identifier: "CANCEL", title: "Cancelar pedido",
                                  options: [.destructive, .authenticationRequired])
let category = UNNotificationCategory(identifier: "ORDER_STATUS",
                                      actions: [track, cancel], intentIdentifiers: [])
UNUserNotificationCenter.current().setNotificationCategories([category])

// Notification Service Extension (target aparte)
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent
        // bajar imageURL, guardarla en un archivo temporal y adjuntarla:
        // bestAttempt?.attachments = [try UNNotificationAttachment(identifier: "map", url: fileURL)]
        // contentHandler(bestAttempt!)
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let bestAttempt { contentHandler(bestAttempt) }
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Escribí `PushRouter`, el delegate de notificaciones. Con la app abierta, la push se tiene que mostrar como banner con sonido. Al tocarla (tap normal o acción `TRACK`), leé `orderId` de `userInfo` y llamá a `await DeepLinkRouter.shared.open(.order(id: orderID))`. Usá las versiones `async` de los métodos del delegate.",
          starter: swift`import UserNotifications

final class PushRouter: NSObject {
    static let shared = PushRouter()
    // tu código acá
}`,
          checks: [
            { pattern: "UNUserNotificationCenterDelegate", label: "Conforma `UNUserNotificationCenterDelegate`" },
            { pattern: "willPresent\\s+notification:\\s*UNNotification\\)", label: "Implementa `willPresent` para la app en primer plano" },
            { pattern: "\\[\\s*\\.banner", label: "Devuelve opciones que incluyen `.banner`" },
            { pattern: "didReceive\\s+response:\\s*UNNotificationResponse\\)", label: "Implementa `didReceive response:`" },
            { pattern: "\\.userInfo\\b", label: "Lee los datos propios de `userInfo`" },
            { pattern: "UNNotificationDefaultActionIdentifier", label: "Distingue el tap normal con `UNNotificationDefaultActionIdentifier`" },
          ],
          warnings: [
            { pattern: "as!", label: "No fuerces el cast: si el backend no manda la clave, crashea" },
            { pattern: "\\.alert\\s*[,\\]]", label: "`.alert` como opción de presentación está deprecado: usá `.banner` y `.list`" },
          ],
          solution: swift`import UserNotifications

final class PushRouter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushRouter()

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let userInfo = response.notification.request.content.userInfo
        guard let orderID = userInfo["orderId"] as? String else { return }

        switch response.actionIdentifier {
        case UNNotificationDefaultActionIdentifier, "TRACK":
            await DeepLinkRouter.shared.open(.order(id: orderID))
        default:
            break
        }
    }
}`,
          hint: "Los dos métodos se llaman `userNotificationCenter(_:...)`; uno recibe `willPresent notification:` y el otro `didReceive response:`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "deep-links",
      title: "Deep links y universal links",
      goal: "Elegir entre URL scheme y universal link, publicar el `apple-app-site-association`, recibir el link en SwiftUI y UIKit y rutearlo a la pantalla correcta validando parámetros y sesión.",
      minutes: 30,
      steps: [
        {
          kind: "explain",
          title: "URL scheme vs universal link",
          body: [
            "Un **URL scheme** propio (`shopapp://orders/A-1029`) se declara en `CFBundleURLTypes` del `Info.plist`. Es fácil, pero cualquier app puede declarar el mismo esquema, no tiene fallback si la app no está instalada y Safari muestra un diálogo de confirmación. Sirve para links internos (widget → app, callbacks de OAuth).",
            "Un **universal link** es una URL `https` normal (`https://shop.example.com/orders/A-1029`). Si la app está instalada y el dominio la autoriza, abre la app; si no, abre la web. Nadie más puede reclamar tu dominio. Es lo que querés en mails, SMS, redes y marketing.",
            "Para que funcione hacen falta dos lados: el entitlement **Associated Domains** en la app (`applinks:shop.example.com`) y el archivo `apple-app-site-association` en `https://shop.example.com/.well-known/apple-app-site-association`: por HTTPS, sin redirecciones, sin extensión `.json` y con `Content-Type: application/json`. Apple lo cachea en su CDN, así que un cambio puede tardar en llegar; en desarrollo podés usar `applinks:shop.example.com?mode=developer`.",
          ],
          code: swift`{
  "applinks": {
    "details": [
      {
        "appIDs": ["ABCDE12345.com.shop.app"],
        "components": [
          { "/": "/orders/internal/*", "exclude": true, "comment": "panel interno: web" },
          { "/": "/orders/*", "comment": "detalle de pedido" },
          { "/": "/products/*", "?": { "ref": "?*" } }
        ]
      }
    ]
  }
}`,
        },
        {
          kind: "predict",
          prompt: "El AASA tiene estos componentes en este orden. El usuario toca `https://shop.example.com/orders/internal/7` en Mail. ¿Qué pasa?",
          code: swift`"components": [
  { "/": "/orders/*" },
  { "/": "/orders/internal/*", "exclude": true }
]`,
          options: [
            "Abre Safari: `exclude` siempre tiene prioridad",
            "Abre la app: el primer componente que coincide es `/orders/*` y la evaluación termina ahí",
            "No abre nada porque hay reglas en conflicto",
            "Abre la app solo si fue instalada desde TestFlight",
          ],
          answer: 1,
          explanation:
            "Los `components` se evalúan en orden y gana el primero que coincide. `/orders/internal/7` ya coincide con `/orders/*`, así que la exclusión nunca se mira. Las exclusiones van **antes** de las reglas generales, como en el ejemplo de la explicación.",
        },
        {
          kind: "fill",
          prompt: "Completá el entitlement de Associated Domains para que la app pueda abrir universal links de tu dominio.",
          code: swift`<key>com.apple.developer.associated-domains</key>
<array>
    <string>____:shop.example.com</string>
</array>`,
          accept: ["^applinks$"],
          hint: "Es la misma clave que usa el JSON del AASA.",
          explanation: "`applinks:` es el servicio de universal links. El mismo entitlement admite otros servicios, como `webcredentials:` para autocompletar contraseñas.",
        },
        {
          kind: "explain",
          title: "Recibir el link: SwiftUI y UIKit",
          body: [
            "En SwiftUI, `onOpenURL` recibe tanto URL schemes como universal links, con la app abierta o arrancando en frío. Un solo punto de entrada: `router.handle(url)`.",
            "En UIKit con escenas hay tres caminos: universal link con la app viva llega a `scene(_:continue:)` como `NSUserActivity` de tipo `NSUserActivityTypeBrowsingWeb` (la URL está en `webpageURL`); URL scheme a `scene(_:openURLContexts:)`; y en arranque en frío, los dos vienen en `connectionOptions` dentro de `scene(_:willConnectTo:options:)`. Olvidarse del arranque en frío es el bug clásico: \"el link funciona solo si la app ya estaba abierta\".",
            "Universal links que **no** abren la app: escribir la URL en Safari, tocar un link del mismo dominio estando en esa web, o si el usuario eligió \"Abrir en Safari\" con long press. No es un bug tuyo.",
          ],
          code: swift`// SwiftUI
WindowGroup {
    RootView()
        .onOpenURL { url in router.handle(url) }
}

// UIKit
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        // ... crear la ventana
        if let activity = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }),
           let url = activity.webpageURL {
            router.handle(url)
        } else if let url = connectionOptions.urlContexts.first?.url {
            router.handle(url)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
              let url = userActivity.webpageURL else { return }
        router.handle(url)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        router.handle(url)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Un link de tu URL scheme llega a `router.handle`. ¿Qué imprime?",
          code: swift`import Foundation

let url = URL(string: "shopapp://orders/42")!
print(url.host() ?? "nil", url.pathComponents)`,
          options: [
            "nil [\"/\", \"orders\", \"42\"]",
            "shopapp [\"orders\", \"42\"]",
            "orders [\"/\", \"42\"]",
            "orders [\"42\"]",
          ],
          answer: 2,
          explanation:
            "Con `//` después del esquema, lo que sigue hasta la próxima `/` es el **host**: `orders`. El path queda `/42` y `pathComponents` incluye la raíz `\"/\"`. En cambio, en `https://shop.example.com/orders/42` el host es el dominio y `orders` está en el path. Tu parser tiene que contemplar las dos formas.",
        },
        {
          kind: "explain",
          title: "Rutear con NavigationPath, validar y esperar el login",
          body: [
            "Convertí la URL en un enum (`DeepLink`) en un solo lugar y tratá todo lo demás como entrada no confiable: cualquiera puede armar un link. Validá formato y largo de los ids, ignorá rutas desconocidas y nunca ejecutes acciones destructivas (pagar, borrar) directo desde un link: llevá a una pantalla que pida confirmación.",
            "Con `NavigationStack(path:)` el router reemplaza el `NavigationPath` y apila las rutas. Si el usuario no inició sesión, guardá el link como `pendingLink` y abrilo después del login; si no, el usuario se loguea y termina en la home, perdiendo el contexto que marketing pagó por darle.",
          ],
          code: swift`enum Route: Hashable {
    case order(id: String)
    case product(id: Int)
}

@MainActor
@Observable
final class AppRouter {
    var path = NavigationPath()
    var isLoggedIn = false
    var pendingLink: DeepLink?

    func handle(_ url: URL) {
        guard let link = DeepLink(url: url) else { return } // link inválido: se ignora
        guard isLoggedIn else { pendingLink = link; return }
        open(link)
    }

    func open(_ link: DeepLink) {
        path = NavigationPath()
        switch link {
        case .order(let id): path.append(Route.order(id: id))
        case .product(let id): path.append(Route.product(id: id))
        }
    }

    func didLogIn() {
        isLoggedIn = true
        if let link = pendingLink {
            pendingLink = nil
            open(link)
        }
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Escribí `init?(url: URL)` para `DeepLink`. Aceptá solo `https://shop.example.com/orders/<id>` (id no vacío, hasta 20 caracteres, letras, números o `-`) y `https://shop.example.com/products/<id>` (id entero positivo). Cualquier otra cosa devuelve `nil`.",
          starter: swift`import Foundation

enum DeepLink: Equatable {
    case order(id: String)
    case product(id: Int)
}

extension DeepLink {
    // init?(url:)
}`,
          checks: [
            { pattern: "init\\?\\(url:\\s*URL\\)", label: "Inicializador fallible `init?(url: URL)`" },
            { pattern: "url\\.scheme", label: "Verifica el esquema" },
            { pattern: "url\\.host", label: "Verifica el dominio" },
            { pattern: "pathComponents", label: "Parsea con `pathComponents`" },
            { pattern: "Int\\(", label: "Convierte el id de producto con `Int(...)`" },
            { pattern: "return\\s+nil", label: "Devuelve `nil` ante una URL inválida" },
          ],
          warnings: [{ pattern: "Int\\([^)]*\\)\\s*!", label: "No fuerces el `Int(...)`: un link mal armado crashearía la app" }],
          solution: swift`import Foundation

enum DeepLink: Equatable {
    case order(id: String)
    case product(id: Int)
}

extension DeepLink {
    init?(url: URL) {
        guard url.scheme == "https", url.host() == "shop.example.com" else { return nil }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard parts.count == 2 else { return nil }

        switch parts[0] {
        case "orders":
            let id = parts[1]
            let valid = id.count <= 20 && id.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
            guard valid else { return nil }
            self = .order(id: id)
        case "products":
            guard let id = Int(parts[1]), id > 0 else { return nil }
            self = .product(id: id)
        default:
            return nil
        }
    }
}`,
          hint: "Filtrá la raíz `\"/\"` de `pathComponents` y exigí exactamente dos partes.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "background-extensions",
      title: "Trabajo en segundo plano y extensiones",
      goal: "Agendar tareas con `BGTaskScheduler`, descargar con una `URLSession` de background y compartir datos con extensiones mediante App Groups.",
      minutes: 28,
      steps: [
        {
          kind: "explain",
          title: "BGTaskScheduler: vos pedís, el sistema decide",
          body: [
            "`BGAppRefreshTask` es para refrescos cortos (bajar los últimos pedidos). `BGProcessingTask` es para trabajo largo y diferible (limpiar caché, migrar datos) y podés pedir que corra con red o cargando (`requiresNetworkConnectivity`, `requiresExternalPower`).",
            "Tres piezas: (1) declarar los identificadores en `BGTaskSchedulerPermittedIdentifiers` del `Info.plist` y activar el Background Mode correspondiente (`fetch` o `processing`); (2) **registrar** el handler antes de que termine el lanzamiento; (3) **agendar** con `submit`. `earliestBeginDate` es un mínimo, no una hora: el sistema decide según batería, red y cuánto usa la app el usuario.",
            "En el handler: agendá la próxima, poné un `expirationHandler` que cancele el trabajo y llamá siempre a `setTaskCompleted(success:)`. Para probar sin esperar, pausá en el debugger y ejecutá `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@\"com.shop.app.refreshOrders\"]`. En SwiftUI existe además el modificador de escena `.backgroundTask(.appRefresh(\"...\"))`.",
          ],
          code: swift`import BackgroundTasks

enum BGIDs {
    static let refresh = "com.shop.app.refreshOrders"
}

// En didFinishLaunching, antes de devolver true
BGTaskScheduler.shared.register(forTaskWithIdentifier: BGIDs.refresh, using: nil) { task in
    handleRefresh(task as! BGAppRefreshTask)
}

func scheduleRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: BGIDs.refresh)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        logger.error("No se pudo agendar: \(error)")
    }
}

func handleRefresh(_ task: BGAppRefreshTask) {
    scheduleRefresh() // la próxima
    let work = Task {
        do {
            try await OrderSync.shared.refresh()
            task.setTaskCompleted(success: true)
        } catch {
            task.setTaskCompleted(success: false)
        }
    }
    task.expirationHandler = { work.cancel() }
}

// Info.plist
// BGTaskSchedulerPermittedIdentifiers: [com.shop.app.refreshOrders]
// UIBackgroundModes: [fetch]`,
        },
        {
          kind: "predict",
          prompt: "A las 10:00 agendás un `BGAppRefreshTaskRequest` con `earliestBeginDate` = 10:15. ¿Cuándo corre?",
          code: swift`let request = BGAppRefreshTaskRequest(identifier: "com.shop.app.refreshOrders")
request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
try BGTaskScheduler.shared.submit(request)`,
          options: [
            "No antes de las 10:15; después, cuando el sistema decida (puede ser mucho más tarde, o casi nunca si el usuario no usa la app)",
            "A las 10:15 en punto, aunque el teléfono esté sin batería",
            "Cada 15 minutos a partir de las 10:15",
            "Inmediatamente, porque `earliestBeginDate` es solo una sugerencia de prioridad",
          ],
          answer: 0,
          explanation:
            "`earliestBeginDate` es una cota inferior. El sistema agrupa tareas y prioriza las apps que el usuario abre seguido. No se repite sola: por eso el handler vuelve a llamar a `scheduleRefresh()`. Si producto pide \"actualizar cada 15 minutos exactos\", la respuesta es push, no background refresh.",
        },
        {
          kind: "fill",
          prompt: "Completá la llamada que le avisa al sistema que la tarea terminó bien.",
          code: swift`func handleRefresh(_ task: BGAppRefreshTask) {
    Task {
        try? await OrderSync.shared.refresh()
        task.____(success: true)
    }
}`,
          accept: ["^setTaskCompleted$"],
          hint: "Set... Task... Completed.",
          explanation: "`setTaskCompleted(success:)` es obligatorio. Si no lo llamás, el sistema da la tarea por colgada, la mata al expirar y te asigna menos tiempo de background en el futuro.",
        },
        {
          kind: "explain",
          title: "Descargas en background y App Groups",
          body: [
            "Una `URLSession` con `URLSessionConfiguration.background(withIdentifier:)` delega la descarga a un proceso del sistema: sigue aunque tu app quede suspendida. Usa **delegate**, no completion handlers ni `async/await`. El archivo de `didFinishDownloadingTo` se borra al volver del método: movelo ahí mismo. Si iOS relanza la app para avisar, llega `handleEventsForBackgroundURLSession` con un completion que llamás en `urlSessionDidFinishEvents`.",
            "Las extensiones (widget, share, notification service) son **procesos aparte** con su propio sandbox: `UserDefaults.standard` y los archivos de la app no se ven desde ahí. Para compartir datos se usa un **App Group** (`group.com.shop.app`), activado como capability en la app y en cada extensión: `UserDefaults(suiteName:)` para datos chicos y `containerURL(forSecurityApplicationGroupIdentifier:)` para archivos o la base de datos.",
            "Una **share extension** aparece en la hoja de compartir según `NSExtensionActivationRule` (por ejemplo, solo URLs). Lee lo compartido en `extensionContext.inputItems` y termina con `completeRequest(returningItems:)`. En extensiones no existe `UIApplication.shared` y la memoria es más limitada: hacé lo mínimo y dejá el resto a la app.",
          ],
          code: swift`final class DownloadManager: NSObject, URLSessionDownloadDelegate {
    static let shared = DownloadManager()
    var backgroundCompletion: (() -> Void)?

    lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: "com.shop.app.downloads")
        config.sessionSendsLaunchEvents = true
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    func download(_ url: URL) { session.downloadTask(with: url).resume() }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didFinishDownloadingTo location: URL) {
        // mover YA: location se borra al salir de este método
        let destination = SharedStore.containerURL.appending(path: "catalog.zip")
        try? FileManager.default.removeItem(at: destination)
        try? FileManager.default.moveItem(at: location, to: destination)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            self.backgroundCompletion?()
            self.backgroundCompletion = nil
        }
    }
}

enum SharedStore {
    static let groupID = "group.com.shop.app"
    static let defaults = UserDefaults(suiteName: groupID)!
    static var containerURL: URL {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)!
    }
}`,
        },
        {
          kind: "predict",
          prompt: "La app guarda el próximo pedido y el widget lo lee. Ambos targets compilan. ¿Qué imprime el widget?",
          code: swift`// En la app
UserDefaults.standard.set("A-1029", forKey: "nextOrderId")

// En la extensión del widget
let id = UserDefaults.standard.string(forKey: "nextOrderId")
print(id ?? "sin pedido")`,
          options: ["A-1029", "Optional(\"A-1029\")", "Crashea al leer", "sin pedido"],
          answer: 3,
          explanation:
            "La extensión corre en otro proceso con su propio contenedor: su `UserDefaults.standard` es otro archivo, vacío. `string(forKey:)` devuelve `nil` y se imprime el fallback. Con `UserDefaults(suiteName: \"group.com.shop.app\")` en los dos targets (y el App Group activado en ambos) sí leería `A-1029`.",
        },
        {
          kind: "write",
          prompt:
            "Escribí `SharedOrderStore` para compartir el próximo pedido entre la app y el widget: `save(_:)` guarda un `OrderSummary` como JSON en el `UserDefaults` del App Group `group.com.shop.app`, y `load()` lo devuelve (o `nil`).",
          starter: swift`import Foundation

struct OrderSummary: Codable {
    let id: String
    let title: String
    let eta: Date
}

enum SharedOrderStore {
    // tu código acá
}`,
          checks: [
            { pattern: "UserDefaults\\(suiteName:", label: "Usa `UserDefaults(suiteName:)`" },
            { pattern: "\"group\\.", label: "El suite es un App Group (`group.`)" },
            { pattern: "JSONEncoder\\(\\)", label: "Codifica con `JSONEncoder`" },
            { pattern: "JSONDecoder\\(\\)", label: "Decodifica con `JSONDecoder`" },
            { pattern: "func\\s+load\\(\\)\\s*->\\s*OrderSummary\\?", label: "`load()` devuelve `OrderSummary?`" },
          ],
          warnings: [
            { pattern: "UserDefaults\\.standard", label: "`UserDefaults.standard` no se comparte con las extensiones" },
            { pattern: "try!", label: "No uses `try!`: un dato corrupto tiraría abajo el widget" },
          ],
          solution: swift`import Foundation

struct OrderSummary: Codable {
    let id: String
    let title: String
    let eta: Date
}

enum SharedOrderStore {
    static let groupID = "group.com.shop.app"
    private static let key = "nextOrder"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: groupID) }

    static func save(_ order: OrderSummary) {
        guard let data = try? JSONEncoder().encode(order) else { return }
        defaults?.set(data, forKey: key)
    }

    static func load() -> OrderSummary? {
        guard let data = defaults?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(OrderSummary.self, from: data)
    }

    static func clear() {
        defaults?.removeObject(forKey: key)
    }
}`,
          hint: "Guardá `Data` con `set(_:forKey:)` y leelo con `data(forKey:)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "widgets-live-activities",
      title: "Widgets y Live Activities",
      goal: "Construir un widget con `TimelineProvider`, recargarlo desde la app, hacerlo interactivo con App Intents y mostrar el estado de un pedido con ActivityKit y la Dynamic Island.",
      minutes: 32,
      steps: [
        {
          kind: "explain",
          title: "Un widget es una timeline, no una vista viva",
          body: [
            "Un widget no corre todo el tiempo: WidgetKit le pide al `TimelineProvider` una lista de **entradas** con fecha, renderiza cada vista y las muestra en su momento. El provider tiene tres métodos: `placeholder` (rápido y sin datos reales, para el esqueleto), `getSnapshot` (para la galería; si `context.isPreview`, usá datos de ejemplo) y `getTimeline` (las entradas reales más una **política de recarga**).",
            "Políticas: `.atEnd` pide una timeline nueva cuando pasa la última entrada; `.after(fecha)` a partir de esa fecha; `.never` solo cuando la app lo pida. En todos los casos el sistema tiene un presupuesto de recargas y decide el momento exacto.",
            "La forma confiable de actualizar es desde la app: cuando cambia el dato, lo escribís en el App Group y llamás a `WidgetCenter.shared.reloadTimelines(ofKind:)`. El widget lee del App Group en lugar de pegarle a la red.",
          ],
          code: swift`import WidgetKit
import SwiftUI

struct OrderEntry: TimelineEntry {
    let date: Date
    let order: OrderSummary?
}

struct NextOrderProvider: TimelineProvider {
    func placeholder(in context: Context) -> OrderEntry {
        OrderEntry(date: .now, order: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (OrderEntry) -> Void) {
        let order = context.isPreview ? .sample : SharedOrderStore.load()
        completion(OrderEntry(date: .now, order: order))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OrderEntry>) -> Void) {
        let entry = OrderEntry(date: .now, order: SharedOrderStore.load())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NextOrderWidget: Widget {
    let kind = "NextOrder"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextOrderProvider()) { entry in
            NextOrderView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Próximo pedido")
        .description("El estado de tu próximo pedido.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}`,
        },
        {
          kind: "predict",
          prompt: "`getTimeline` devolvió tres entradas (10:00, 11:00 y 12:00) con política `.atEnd`. ¿Qué pasa?",
          code: swift`let entries = [10, 11, 12].map { hour in
    OrderEntry(date: today(at: hour), order: order)
}
completion(Timeline(entries: entries, policy: .atEnd))`,
          options: [
            "Se ve la entrada de 10:00 hasta que la app llame a `reloadTimelines`",
            "A las 11:30 se ve la entrada de 11:00; después de las 12:00 WidgetKit pide una timeline nueva, cuando el sistema lo decida",
            "Se ve siempre la de 12:00 porque es la última",
            "WidgetKit llama a `getTimeline` cada hora en punto",
          ],
          answer: 1,
          explanation:
            "Cada entrada se muestra desde su `date` hasta la siguiente. Con `.atEnd`, pasada la última entrada el widget queda elegible para recargar, y el sistema elige el momento según su presupuesto. Nunca hay garantía de hora exacta.",
        },
        {
          kind: "fill",
          prompt: "El usuario canceló el pedido dentro de la app. Ya actualizaste el App Group; completá la llamada para que el widget se entere.",
          code: swift`SharedOrderStore.clear()
WidgetCenter.shared.____(ofKind: "NextOrder")`,
          accept: ["^reloadTimelines$"],
          hint: "Recarga las timelines de un tipo (`kind`) de widget.",
          explanation: "`reloadTimelines(ofKind:)` invalida la timeline de ese widget y WidgetKit vuelve a llamar a `getTimeline`. Existe también `reloadAllTimelines()`, pero recargar solo lo que cambió cuida el presupuesto.",
        },
        {
          kind: "explain",
          title: "Taps y widgets interactivos",
          body: [
            "Un widget no tiene botones comunes ni closures: tocarlo abre la app. `.widgetURL(url)` define la URL de todo el widget (en el tamaño chico es la única opción) y `Link(destination:)` permite zonas distintas en los tamaños medianos y grandes. La URL llega a `onOpenURL`, así que reusás el router de deep links.",
            "Desde iOS 17, `Button(intent:)` y `Toggle(isOn:intent:)` ejecutan un **App Intent** sin abrir la app: el `perform()` corre, actualiza el App Group o el backend, y el sistema recarga la timeline. Ojo: la vista no cambia hasta que llega la nueva entrada; el estado vive en tus datos, no en un `@State`.",
          ],
          code: swift`import AppIntents

struct MarkReceivedIntent: AppIntent {
    static let title: LocalizedStringResource = "Marcar como recibido"

    @Parameter(title: "Pedido")
    var orderID: String

    init() {}
    init(orderID: String) { self.orderID = orderID }

    func perform() async throws -> some IntentResult {
        try await OrderAPI.shared.markReceived(orderID)
        SharedOrderStore.clear()
        return .result()
    }
}

struct NextOrderView: View {
    let entry: OrderEntry

    var body: some View {
        if let order = entry.order {
            VStack(alignment: .leading) {
                Text(order.title).font(.headline)
                Text(order.eta, style: .relative)
                Button(intent: MarkReceivedIntent(orderID: order.id)) {
                    Label("Recibido", systemImage: "checkmark")
                }
            }
            .widgetURL(URL(string: "shopapp://orders/\(order.id)"))
        } else {
            Text("Sin pedidos en curso")
        }
    }
}`,
        },
        {
          kind: "explain",
          title: "Live Activities y Dynamic Island",
          body: [
            "Una Live Activity muestra un proceso con principio y fin (un delivery, un partido) en la pantalla bloqueada y la Dynamic Island. Se define con `ActivityAttributes`: las propiedades fijas van en el struct y lo que cambia en `ContentState` (`Codable` y `Hashable`). Hace falta `NSSupportsLiveActivities = YES` en el `Info.plist` de la app.",
            "Se inicia **desde la app en primer plano** con `Activity.request(attributes:content:pushType:)`, se actualiza con `update` y se cierra con `end`. Con `pushType: .token`, observás `pushTokenUpdates` y mandás ese token a tu backend, que actualiza la actividad por APNs con `apns-push-type: liveactivity` y topic `<bundle id>.push-type.liveactivity`.",
            "La UI vive en la extensión de widgets con `ActivityConfiguration`: una vista para la pantalla bloqueada y una `DynamicIsland` con regiones expandidas (`.leading`, `.trailing`, `.center`, `.bottom`) más las vistas `compactLeading`, `compactTrailing` y `minimal`.",
          ],
          code: swift`import ActivityKit

struct DeliveryAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var status: String
        var etaMinutes: Int
    }
    var orderID: String
}

// Payload por APNs (apns-push-type: liveactivity)
// { "aps": { "timestamp": 1767312000, "event": "update",
//            "content-state": { "status": "En camino", "etaMinutes": 10 } } }

struct DeliveryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeliveryAttributes.self) { context in
            DeliveryLockScreenView(state: context.state)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "bicycle") }
                DynamicIslandExpandedRegion(.trailing) { Text("\(context.state.etaMinutes) min") }
                DynamicIslandExpandedRegion(.bottom) { Text(context.state.status) }
            } compactLeading: {
                Image(systemName: "bicycle")
            } compactTrailing: {
                Text("\(context.state.etaMinutes)m")
            } minimal: {
                Image(systemName: "bicycle")
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "El backend manda esta actualización para la `DeliveryAttributes` de la explicación. ¿Qué pasa?",
          code: swift`// apns-push-type: liveactivity
{
  "aps": {
    "timestamp": 1767312600,
    "event": "update",
    "content-state": { "status": "En camino", "eta": 10 }
  }
}`,
          options: [
            "Se ve \"En camino\" y queda el ETA anterior",
            "ActivityKit mapea `eta` a `etaMinutes` porque empiezan igual",
            "El `content-state` no se puede decodificar como `ContentState` y la actualización no se aplica",
            "La Live Activity se termina",
          ],
          answer: 2,
          explanation:
            "`content-state` se decodifica con `Codable` contra `ContentState`: falta `etaMinutes`, así que la decodificación falla y la actividad no cambia. Las claves del backend tienen que coincidir exactamente con las propiedades. Por eso conviene versionar ese contrato y agregar campos nuevos como opcionales.",
        },
        {
          kind: "write",
          prompt:
            "Definí `DeliveryAttributes` (fijo: `orderID`; cambia: `status` y `etaMinutes`) y escribí `startTracking(orderID:)` que inicie la Live Activity con estado \"Preparando\" y 25 minutos, pidiendo token de push. Antes, verificá que el usuario tenga las Live Activities habilitadas.",
          starter: swift`import ActivityKit

enum TrackingError: Error { case disabled }

// DeliveryAttributes y startTracking acá`,
          checks: [
            { pattern: ":\\s*ActivityAttributes", label: "Conforma `ActivityAttributes`" },
            { pattern: "struct\\s+ContentState\\s*:\\s*Codable\\s*,\\s*Hashable", label: "`ContentState: Codable, Hashable`" },
            { pattern: "areActivitiesEnabled", label: "Verifica `ActivityAuthorizationInfo().areActivitiesEnabled`" },
            { pattern: "Activity\\.request\\(", label: "Inicia con `Activity.request`" },
            { pattern: "ActivityContent\\(", label: "Pasa el estado en un `ActivityContent`" },
            { pattern: "pushType:\\s*\\.token", label: "Pide token con `pushType: .token`" },
          ],
          solution: swift`import ActivityKit

enum TrackingError: Error { case disabled }

struct DeliveryAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var status: String
        var etaMinutes: Int
    }
    var orderID: String
}

func startTracking(orderID: String) throws -> Activity<DeliveryAttributes> {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw TrackingError.disabled }

    let state = DeliveryAttributes.ContentState(status: "Preparando", etaMinutes: 25)
    let activity = try Activity.request(
        attributes: DeliveryAttributes(orderID: orderID),
        content: ActivityContent(state: state, staleDate: nil),
        pushType: .token
    )

    Task {
        for await data in activity.pushTokenUpdates {
            let token = data.map { String(format: "%02x", $0) }.joined()
            try? await PushAPI.shared.registerActivity(token: token, orderID: orderID)
        }
    }
    return activity
}`,
          hint: "`Activity.request(attributes:content:pushType:)` tira error si no se puede iniciar.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "app-intents-capabilities",
      title: "App Intents y otras capacidades frecuentes",
      goal: "Exponer acciones a Siri, Atajos y Spotlight con App Intents, y saber qué pide cada capacidad típica (Apple Pay, ubicación, fotos, cámara, HealthKit, CloudKit).",
      minutes: 28,
      steps: [
        {
          kind: "explain",
          title: "AppIntent, AppEntity y AppShortcutsProvider",
          body: [
            "Un `AppIntent` es una acción de la app que el sistema puede ejecutar: Siri, Atajos, Spotlight, el botón de acción, widgets. Tiene un `title`, parámetros con `@Parameter` y un `perform()` `async throws` que devuelve un resultado (opcionalmente con un diálogo para Siri).",
            "Para parámetros que son objetos de tu dominio (un pedido), definí un `AppEntity` con su `EntityQuery`: el sistema le pide entidades por id (`entities(for:)`) y sugerencias (`suggestedEntities()`). Así el usuario elige \"Pedido A-1029\" en Atajos.",
            "`AppShortcutsProvider` publica atajos listos para usar, sin que el usuario configure nada. Cada frase tiene que incluir `\\(.applicationName)` para que Siri sepa a qué app va. Todo esto se descubre en tiempo de compilación: no hay que registrar nada en runtime.",
          ],
          code: swift`import AppIntents

struct OrderEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Pedido"
    static let defaultQuery = OrderQuery()

    var id: String
    var title: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
}

struct OrderQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [OrderEntity] {
        try await OrderAPI.shared.orders(ids: identifiers).map { OrderEntity(id: $0.id, title: $0.title) }
    }

    func suggestedEntities() async throws -> [OrderEntity] {
        try await OrderAPI.shared.recentOrders().map { OrderEntity(id: $0.id, title: $0.title) }
    }
}

struct TrackOrderIntent: AppIntent {
    static let title: LocalizedStringResource = "Seguir pedido"
    static let description = IntentDescription("Muestra el estado de un pedido.")

    @Parameter(title: "Pedido")
    var order: OrderEntity

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let status = try await OrderAPI.shared.status(of: order.id)
        return .result(dialog: "\(order.title): \(status)")
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el property wrapper que convierte la propiedad en un parámetro del intent.",
          code: swift`struct ReorderIntent: AppIntent {
    static let title: LocalizedStringResource = "Repetir pedido"

    @____(title: "Pedido")
    var order: OrderEntity

    func perform() async throws -> some IntentResult { .result() }
}`,
          accept: ["^Parameter$", "^@Parameter$"],
          hint: "En español sería \"parámetro\".",
          explanation: "`@Parameter` hace que Atajos y Siri muestren el campo y lo pidan si falta. El tipo puede ser básico (`String`, `Int`, `Date`), un `AppEnum` o un `AppEntity`.",
        },
        {
          kind: "predict",
          prompt: "¿Qué problema tiene este atajo?",
          code: swift`struct ShopShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: TrackLatestOrderIntent(),
            phrases: ["Seguir mi pedido"],
            shortTitle: "Seguir pedido",
            systemImageName: "shippingbox"
        )
    }
}`,
          options: [
            "La frase es inválida: cada frase de un App Shortcut tiene que incluir `\\(.applicationName)`",
            "Falta registrar el provider en `didFinishLaunching`",
            "`systemImageName` solo acepta imágenes del asset catalog",
            "No tiene problemas: Siri adivina la app por contexto",
          ],
          answer: 0,
          explanation:
            "Cada frase tiene que nombrar la app con `\\(.applicationName)` (por ejemplo, \"Seguir mi pedido en \\(.applicationName)\"); Xcode la marca como inválida si no. El provider se descubre al compilar, no se registra. `systemImageName` es un SF Symbol.",
        },
        {
          kind: "write",
          prompt:
            "Ya tenés `TrackLatestOrderIntent` (sin parámetros). Escribí `ShopShortcuts` que lo publique como App Shortcut con dos frases que incluyan el nombre de la app, un `shortTitle` y el símbolo `shippingbox`.",
          starter: swift`import AppIntents

struct TrackLatestOrderIntent: AppIntent {
    static let title: LocalizedStringResource = "Seguir mi último pedido"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        await DeepLinkRouter.shared.openLatestOrder()
        return .result()
    }
}

// ShopShortcuts acá`,
          checks: [
            { pattern: ":\\s*AppShortcutsProvider", label: "Conforma `AppShortcutsProvider`" },
            { pattern: "static\\s+var\\s+appShortcuts\\s*:\\s*\\[AppShortcut\\]", label: "`static var appShortcuts: [AppShortcut]`" },
            { pattern: "AppShortcut\\(\\s*intent:\\s*TrackLatestOrderIntent\\(\\)", label: "Crea el `AppShortcut` con el intent" },
            { pattern: "\\\\\\(\\.applicationName\\)", label: "Las frases incluyen `\\(.applicationName)`" },
            { pattern: "shortTitle:", label: "Define `shortTitle`" },
          ],
          solution: swift`import AppIntents

struct TrackLatestOrderIntent: AppIntent {
    static let title: LocalizedStringResource = "Seguir mi último pedido"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        await DeepLinkRouter.shared.openLatestOrder()
        return .result()
    }
}

struct ShopShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: TrackLatestOrderIntent(),
            phrases: [
                "Seguir mi pedido en \(.applicationName)",
                "Dónde está mi pedido de \(.applicationName)",
            ],
            shortTitle: "Seguir pedido",
            systemImageName: "shippingbox"
        )
    }
}`,
          hint: "Las frases se escriben con interpolación: `\"... \\(.applicationName)\"`.",
        },
        {
          kind: "explain",
          title: "Otras capacidades: qué pide cada una",
          body: [
            "Casi todas las capacidades necesitan alguna combinación de: **entitlement** (capability en Xcode y en el App ID), **usage string** en el `Info.plist` (el texto del diálogo de permiso; si falta, la app crashea al pedir acceso) y **notas para review** (cómo probar la feature, cuenta demo).",
            "**Apple Pay** (PassKit): Merchant ID + entitlement, `PKPaymentRequest`. Solo para bienes físicos y servicios fuera de la app; el contenido digital va por In-App Purchase. **Ubicación**: `NSLocationWhenInUseUsageDescription`, pedí \"Always\" solo si hay una razón clara (review la cuestiona) y la ubicación en background requiere su Background Mode. **Fotos**: `PhotosPicker` corre fuera de tu proceso y no pide permiso; solo hace falta `NSPhotoLibraryAddUsageDescription` si guardás. **Cámara**: `NSCameraUsageDescription`.",
            "**HealthKit**: entitlement + `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription`; la app no puede saber si el usuario le negó la *lectura* (por privacidad, se ve como \"sin datos\"). **CloudKit**: capability iCloud con un contenedor `iCloud.com.shop.app`; antes de publicar, desplegá el esquema a producción desde la consola de CloudKit o la app en la App Store no encontrará los tipos de registro.",
          ],
          code: swift`import PhotosUI
import SwiftUI

struct AvatarPicker: View {
    @State private var selection: PhotosPickerItem?
    @State private var imageData: Data?

    var body: some View {
        PhotosPicker("Elegir foto", selection: $selection, matching: .images)
            .task(id: selection) {
                imageData = try? await selection?.loadTransferable(type: Data.self)
            }
    }
}

// Info.plist (solo lo que usás)
// NSCameraUsageDescription: "Para escanear el código del pedido."
// NSLocationWhenInUseUsageDescription: "Para mostrarte las sucursales cercanas."
// NSHealthShareUsageDescription: "Para sumar tus pasos al desafío."
// Entitlements: com.apple.developer.in-app-payments, com.apple.developer.healthkit,
//               com.apple.developer.icloud-container-identifiers`,
        },
        {
          kind: "predict",
          prompt: "Agregaste un escáner de QR. El `Info.plist` no tiene `NSCameraUsageDescription`. ¿Qué pasa al ejecutar esto?",
          code: swift`import AVFoundation

func startScanner() async {
    let granted = await AVCaptureDevice.requestAccess(for: .video)
    print(granted ? "cámara ok" : "sin permiso")
}`,
          options: [
            "Imprime `sin permiso` sin mostrar diálogo",
            "Muestra el diálogo con un texto genérico del sistema",
            "Imprime `cámara ok` porque el simulador no exige permiso",
            "La app crashea: iOS exige el usage string antes de acceder a la cámara",
          ],
          answer: 3,
          explanation:
            "Sin la clave de privacidad correspondiente, iOS termina la app al intentar acceder al recurso protegido (el log lo explica). Por eso cada capacidad nueva en un PR tiene que venir con su usage string, redactado para el usuario: review rechaza textos vagos como \"necesitamos la cámara\".",
        },
        {
          kind: "predict",
          prompt: "Producto quiere vender cursos en video que se ven dentro de la app y cobrarlos con Apple Pay \"para no pagar comisión\". ¿Qué pasa?",
          code: swift`let request = PKPaymentRequest()
request.merchantIdentifier = "merchant.com.shop.app"
request.paymentSummaryItems = [
    PKPaymentSummaryItem(label: "Curso de cocina", amount: 19.99)
]`,
          options: [
            "Funciona: Apple Pay está pensado para cualquier pago",
            "App Review lo rechaza: el contenido digital que se consume en la app se vende con In-App Purchase; Apple Pay es para bienes físicos y servicios",
            "Funciona solo si el precio es menor a 20 dólares",
            "Funciona si el merchant ID está verificado",
          ],
          answer: 1,
          explanation:
            "Las guías de App Review piden In-App Purchase para desbloquear contenido o funcionalidades digitales dentro de la app. Apple Pay es para bienes físicos (el delivery, una remera) o servicios consumidos fuera de la app. El merchant ID no cambia la regla.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: widget del próximo pedido con deep link",
      goal: "Integrar App Groups, WidgetKit, deep links, universal links y push para que el pedido se vea y se abra desde cualquier superficie del sistema.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Producto pide: (1) un widget \"Próximo pedido\" que muestre título y ETA, leyendo del App Group lo que la app ya guardó con `SharedOrderStore`; (2) tocar el widget abre la pantalla de ese pedido vía `shopapp://orders/<id>`; (3) los mails de seguimiento usan `https://shop.example.com/orders/<id>` y tienen que abrir la app, salvo `/orders/internal/*`; (4) cuando cambia el estado, una push visible con acciones y mapa abre el mismo detalle.",
            "Todo converge en un único router: widget, universal link y push terminan en `router.handle(url)` o `router.open(link)`, y el router se encarga de la sesión.",
            "Supuestos: Team ID `ABCDE12345`, bundle `com.shop.app`, App Group `group.com.shop.app`, `DeepLink(url:)` acepta los dos formatos de URL y `AppRouter` es el de la lección 2.",
          ],
          code: swift`// Superficies → un solo router
// Widget        → .widgetURL(shopapp://orders/A-1029) → onOpenURL
// Mail/SMS      → https://shop.example.com/orders/A-1029 → onOpenURL
// Push (tap)    → userInfo["orderId"] → router.open(.order(id:))
//
// Datos compartidos: App Group "group.com.shop.app"
// La app escribe → SharedOrderStore.save(order) → WidgetCenter.reloadTimelines(ofKind: "NextOrder")`,
        },
        {
          kind: "write",
          prompt:
            "Escribí el `TimelineProvider` del widget (`placeholder`, `getSnapshot`, `getTimeline`) leyendo de `SharedOrderStore.load()`, con una recarga a los 30 minutos. En `NextOrderView`, hacé que todo el widget abra `shopapp://orders/<id>`.",
          starter: swift`import WidgetKit
import SwiftUI

struct OrderEntry: TimelineEntry {
    let date: Date
    let order: OrderSummary?
}

// NextOrderProvider acá

struct NextOrderView: View {
    let entry: OrderEntry
    var body: some View {
        if let order = entry.order {
            VStack(alignment: .leading) {
                Text(order.title).font(.headline)
                Text(order.eta, style: .relative)
            }
        } else {
            Text("Sin pedidos en curso")
        }
    }
}`,
          checks: [
            { pattern: ":\\s*TimelineProvider", label: "Conforma `TimelineProvider`" },
            { pattern: "func\\s+placeholder\\(", label: "Implementa `placeholder`" },
            { pattern: "func\\s+getSnapshot\\(", label: "Implementa `getSnapshot`" },
            { pattern: "func\\s+getTimeline\\(", label: "Implementa `getTimeline`" },
            { pattern: "SharedOrderStore\\.load\\(\\)", label: "Lee del App Group con `SharedOrderStore.load()`" },
            { pattern: "policy:\\s*\\.after\\(", label: "Política `.after(...)`" },
            { pattern: "\\.widgetURL\\(", label: "Abre el pedido con `.widgetURL`" },
          ],
          warnings: [{ pattern: "URLSession", label: "El widget lee lo que la app ya guardó; no hace falta red" }],
          solution: swift`import WidgetKit
import SwiftUI

struct OrderEntry: TimelineEntry {
    let date: Date
    let order: OrderSummary?
}

struct NextOrderProvider: TimelineProvider {
    func placeholder(in context: Context) -> OrderEntry {
        OrderEntry(date: .now, order: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (OrderEntry) -> Void) {
        let order = context.isPreview ? .sample : SharedOrderStore.load()
        completion(OrderEntry(date: .now, order: order))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OrderEntry>) -> Void) {
        let entry = OrderEntry(date: .now, order: SharedOrderStore.load())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NextOrderView: View {
    let entry: OrderEntry
    var body: some View {
        if let order = entry.order {
            VStack(alignment: .leading) {
                Text(order.title).font(.headline)
                Text(order.eta, style: .relative)
            }
            .widgetURL(URL(string: "shopapp://orders/\(order.id)"))
        } else {
            Text("Sin pedidos en curso")
        }
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Escribí el `apple-app-site-association` para `shop.example.com`: la app `ABCDE12345.com.shop.app` abre `/orders/*`, salvo `/orders/internal/*`, que tiene que seguir en la web. Usá el formato moderno con `components`.",
          starter: swift`{
  "applinks": {
    "details": [
    ]
  }
}`,
          checks: [
            { pattern: "\"applinks\"", label: "Sección `applinks`" },
            { pattern: "\"appIDs\"\\s*:\\s*\\[\\s*\"ABCDE12345\\.com\\.shop\\.app\"", label: "`appIDs` con Team ID + bundle ID" },
            { pattern: "\"components\"\\s*:", label: "Usa `components`" },
            { pattern: "\"/\"\\s*:\\s*\"/orders/internal/\\*\"\\s*,\\s*\"exclude\"\\s*:\\s*true[\\s\\S]*\"/\"\\s*:\\s*\"/orders/\\*\"", label: "La exclusión de `/orders/internal/*` va antes que `/orders/*`" },
          ],
          warnings: [{ pattern: "\"paths\"\\s*:", label: "`paths` es el formato viejo; usá `components`" }],
          solution: swift`{
  "applinks": {
    "details": [
      {
        "appIDs": ["ABCDE12345.com.shop.app"],
        "components": [
          { "/": "/orders/internal/*", "exclude": true, "comment": "panel interno: queda en la web" },
          { "/": "/orders/*", "comment": "detalle de pedido" }
        ]
      }
    ]
  }
}`,
          hint: "Primera coincidencia gana: la exclusión va primero.",
        },
        {
          kind: "write",
          prompt:
            "Escribí el payload de la push \"Tu pedido salió\": alerta con título y cuerpo, sonido, categoría `ORDER_STATUS` (con las acciones de la lección 1), que pase por la Notification Service Extension para adjuntar el mapa, y el `orderId` `A-1029` para el router.",
          starter: swift`{
  "aps": {
  }
}`,
          checks: [
            { pattern: "\"aps\"\\s*:", label: "Diccionario `aps`" },
            { pattern: "\"alert\"\\s*:\\s*\\{[^}]*\"title\"", label: "`alert` con `title`" },
            { pattern: "\"category\"\\s*:\\s*\"ORDER_STATUS\"", label: "Categoría `ORDER_STATUS`" },
            { pattern: "\"mutable-content\"\\s*:\\s*1", label: "`mutable-content: 1` para la extensión" },
            { pattern: "\"orderId\"\\s*:\\s*\"A-1029\"", label: "`orderId` para el router" },
          ],
          warnings: [
            { pattern: "\"aps\"\\s*:\\s*\\{[^}]*\"orderId\"", label: "Las claves propias van fuera de `aps`" },
            { pattern: "\"content-available\"", label: "Es una push visible: no hace falta `content-available`" },
          ],
          solution: swift`{
  "aps": {
    "alert": {
      "title": "Tu pedido salió",
      "body": "Llega en 25 minutos. Tocá para ver el recorrido."
    },
    "sound": "default",
    "category": "ORDER_STATUS",
    "mutable-content": 1
  },
  "orderId": "A-1029",
  "imageURL": "https://cdn.shop.example.com/maps/A-1029.png"
}`,
        },
        {
          kind: "write",
          prompt:
            "Cerrá el circuito en la app: `ShopApp` crea el `AppRouter` como `@State`, arma un `NavigationStack` atado a `router.path` con `navigationDestination(for: Route.self)` y recibe los links con `onOpenURL`. Completá `AppRouter.handle(_:)` (suponé que el router tiene `path`, `isLoggedIn`, `pendingLink` y `open(_:)` como en la lección 2, pero todavía no tiene `handle`): parsea con `DeepLink(url:)` y, si no hay sesión, guarda el link en `pendingLink`.",
          starter: swift`import SwiftUI

@main
struct ShopApp: App {
    var body: some Scene {
        WindowGroup {
            HomeView()
        }
    }
}

extension AppRouter {
    func handle(_ url: URL) {
        // tu código acá
    }
}`,
          checks: [
            { pattern: "@State\\s+(private\\s+)?var\\s+router\\s*=\\s*AppRouter\\(\\)", label: "El router vive en un `@State`" },
            { pattern: "NavigationStack\\(path:\\s*\\$router\\.path\\)", label: "`NavigationStack(path: $router.path)`" },
            { pattern: "\\.navigationDestination\\(for:\\s*Route\\.self\\)", label: "`navigationDestination(for: Route.self)`" },
            { pattern: "\\.onOpenURL\\s*\\{", label: "Recibe los links con `onOpenURL`" },
            { pattern: "DeepLink\\(url:", label: "Parsea con `DeepLink(url:)`" },
            { pattern: "pendingLink\\s*=", label: "Guarda el link si no hay sesión" },
          ],
          warnings: [{ pattern: "DeepLink\\(url:[^)]*\\)!", label: "No fuerces el parseo: un link inválido se ignora" }],
          solution: swift`import SwiftUI

@main
struct ShopApp: App {
    @State private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $router.path) {
                HomeView()
                    .navigationDestination(for: Route.self) { route in
                        switch route {
                        case .order(let id): OrderDetailView(orderID: id)
                        case .product(let id): ProductView(productID: id)
                        }
                    }
            }
            .onOpenURL { url in router.handle(url) }
            .environment(router)
        }
    }
}

extension AppRouter {
    func handle(_ url: URL) {
        guard let link = DeepLink(url: url) else { return }
        guard isLoggedIn else {
            pendingLink = link
            return
        }
        open(link)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "QA reporta: \"cancelo el pedido en la app y el widget lo sigue mostrando un rato largo\". ¿Qué falta?",
          code: swift`func cancel(_ order: OrderSummary) async throws {
    try await OrderAPI.shared.cancel(order.id)
    SharedOrderStore.clear()
}

// Provider del widget:
// completion(Timeline(entries: [entry], policy: .after(now + 30 min)))`,
          options: [
            "Cambiar la política a `.atEnd` para que recargue sola",
            "Hacer que el widget consulte la API en cada `getTimeline`",
            "Llamar a `WidgetCenter.shared.reloadTimelines(ofKind: \"NextOrder\")` después de escribir en el App Group",
            "Mandar una silent push para despertar al widget",
          ],
          answer: 2,
          explanation:
            "El dato del App Group ya cambió, pero WidgetKit no lo sabe: va a mostrar la entrada vieja hasta la próxima recarga que decida el sistema. `reloadTimelines(ofKind:)` desde la app es la forma directa. Cambiar la política no fuerza nada, consultar la API no ayuda si nadie pide la timeline, y una silent push no despierta widgets.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-p8-key",
      front: "¿Por qué autenticar APNs con una clave `.p8` y no con certificado `.p12`?",
      back: "La `.p8` (token-based) sirve para todas las apps del equipo y no vence; el backend firma un JWT con Key ID y Team ID. El `.p12` es por app y vence cada año.",
    },
    {
      id: "fc-when-ask",
      front: "¿Cuándo pedir permiso de notificaciones?",
      back: "Cuando el beneficio es obvio (después del primer pedido), con una pantalla propia antes. El diálogo del sistema sale una sola vez; si dice que no, solo se revierte desde Ajustes. Alternativa: `.provisional`.",
    },
    {
      id: "fc-device-token",
      front: "¿Cómo manejás el device token?",
      back: "Llamás a `registerForRemoteNotifications()` en cada lanzamiento, convertís el `Data` a hex con `%02x` y lo mandás al backend. Puede cambiar, y depende del ambiente (sandbox o producción).",
      code: `let token = deviceToken.map { String(format: "%02x", $0) }.joined()`,
    },
    {
      id: "fc-payload",
      front: "¿Dónde van las claves propias de un payload de push?",
      back: "Fuera de `aps`. Dentro de `aps` va solo lo que interpreta el sistema: `alert`, `badge`, `sound`, `category`, `thread-id`, `mutable-content`, `content-available`. Máximo 4 KB.",
    },
    {
      id: "fc-silent-push",
      front: "¿Qué es una silent push y qué límites tiene?",
      back: "`content-available: 1` sin alerta, `apns-push-type: background`, prioridad 5. Despierta la app para refrescar, pero el sistema la puede demorar o descartar y no lanza apps que el usuario cerró a la fuerza.",
    },
    {
      id: "fc-service-extension",
      front: "¿Para qué sirve la Notification Service Extension?",
      back: "Modifica una push visible antes de mostrarla (adjuntar una imagen, desencriptar). Se activa con `mutable-content: 1`; si se le acaba el tiempo, entregá lo que tengas en `serviceExtensionTimeWillExpire()`.",
    },
    {
      id: "fc-scheme-vs-universal",
      front: "URL scheme vs universal link",
      back: "Scheme (`shopapp://`): fácil, sin fallback y cualquier app puede declararlo; para links internos. Universal link (`https://`): abre la app o la web, solo vos controlás el dominio; para mails y marketing.",
    },
    {
      id: "fc-aasa",
      front: "Requisitos del `apple-app-site-association`",
      back: "En `/.well-known/apple-app-site-association`, por HTTPS, sin redirecciones ni extensión, JSON. `appIDs` = TeamID.bundleID. Los `components` se evalúan en orden: las exclusiones van primero. Más el entitlement `applinks:dominio`.",
    },
    {
      id: "fc-receive-links",
      front: "¿Dónde llegan los links en SwiftUI y en UIKit?",
      back: "SwiftUI: `onOpenURL` (scheme y universal). UIKit: `scene(_:continue:)` para universal links, `scene(_:openURLContexts:)` para schemes y `connectionOptions` en `willConnectTo` para el arranque en frío.",
    },
    {
      id: "fc-bgtask",
      front: "Las tres piezas de `BGTaskScheduler`",
      back: "Identificadores en `BGTaskSchedulerPermittedIdentifiers` + Background Mode; `register` antes de terminar el lanzamiento; `submit` del request. En el handler: reagendar, `expirationHandler` y `setTaskCompleted(success:)`.",
    },
    {
      id: "fc-app-groups",
      front: "¿Cómo comparte datos la app con sus extensiones?",
      back: "Con un App Group activado en todos los targets: `UserDefaults(suiteName: \"group...\")` para datos chicos y `containerURL(forSecurityApplicationGroupIdentifier:)` para archivos o la base.",
    },
    {
      id: "fc-timeline",
      front: "Métodos de `TimelineProvider` y políticas de recarga",
      back: "`placeholder` (esqueleto), `getSnapshot` (galería) y `getTimeline` (entradas + política). Políticas: `.atEnd`, `.after(fecha)` y `.never`. La app fuerza con `WidgetCenter.shared.reloadTimelines(ofKind:)`.",
    },
    {
      id: "fc-live-activity",
      front: "Piezas de una Live Activity",
      back: "`ActivityAttributes` (fijo) + `ContentState` (cambia; `Codable, Hashable`), `NSSupportsLiveActivities`, `Activity.request(...)` desde primer plano, updates por push con `apns-push-type: liveactivity` y `ActivityConfiguration` con la `DynamicIsland` en la extensión.",
    },
    {
      id: "fc-app-intent",
      front: "¿Qué necesita un App Intent para aparecer en Siri sin configuración?",
      back: "Un `AppIntent` con `title` y `perform()`, y un `AppShortcutsProvider` con frases que incluyan `\\(.applicationName)`. Para parámetros del dominio: `AppEntity` + `EntityQuery`.",
    },
    {
      id: "fc-usage-strings",
      front: "¿Qué pasa si falta un usage string como `NSCameraUsageDescription`?",
      back: "La app crashea al pedir acceso. Cada capacidad con permiso necesita su clave en el `Info.plist` con un texto claro para el usuario. `PhotosPicker` es la excepción: no pide permiso para elegir.",
    },
  ],

  exam: [
    {
      id: "ex-token-stale",
      question:
        "Después de que usuarios migran a un iPhone nuevo restaurando un backup, dejan de recibir pushes. El backend guarda el token solo en el registro de la cuenta. ¿Cuál es la corrección?",
      code: swift`// Solo en el signup:
UIApplication.shared.registerForRemoteNotifications()
// didRegister... → POST /signup/push-token`,
      options: [
        "Pedir de nuevo `requestAuthorization` en cada arranque",
        "Llamar a `registerForRemoteNotifications()` en cada lanzamiento y mandar el token al backend cada vez que llega (o cambia)",
        "Guardar el token en el Keychain para que sobreviva la restauración",
        "Pasar a silent pushes, que no usan token",
      ],
      answer: 1,
      explanation:
        "El token puede cambiar entre dispositivos, reinstalaciones y restauraciones. Registrarse en cada lanzamiento es barato y el backend siempre queda con el token vigente. Restaurar uno viejo del Keychain empeora el problema, y toda push necesita token.",
    },
    {
      id: "ex-sandbox-prod",
      question:
        "Las pushes llegan cuando instalás desde Xcode pero no en el build de TestFlight. El backend responde \"BadDeviceToken\". ¿Qué es lo más probable?",
      options: [
        "TestFlight no soporta notificaciones",
        "Falta `mutable-content` en el payload",
        "El usuario negó el permiso",
        "El backend manda al APNs de sandbox; los builds de TestFlight/App Store usan tokens de producción",
      ],
      answer: 3,
      explanation:
        "Los builds de debug usan el entorno de desarrollo (`aps-environment = development`) y los distribuidos el de producción. Un token de producción enviado a `api.sandbox.push.apple.com` da `BadDeviceToken`. El backend tiene que saber el ambiente de cada token.",
    },
    {
      id: "ex-rich-push",
      question:
        "Agregaste una Notification Service Extension que adjunta la foto del producto, pero las pushes llegan sin imagen y el código de la extensión nunca corre. ¿Qué falta?",
      code: swift`{ "aps": { "alert": { "title": "Bajó de precio", "body": "Zapatillas a 50% off" } },
  "imageURL": "https://cdn.shop.example.com/p/123.jpg" }`,
      options: [
        "`\"mutable-content\": 1` dentro de `aps`",
        "`\"content-available\": 1` dentro de `aps`",
        "Mover `imageURL` dentro de `alert`",
        "Pedir permiso de fotos al usuario",
      ],
      answer: 0,
      explanation:
        "Sin `mutable-content: 1`, iOS muestra la notificación tal cual y no invoca la extensión. `content-available` es para silent pushes hacia la app. La URL propia está bien fuera de `aps`, y adjuntar una imagen no requiere permiso de fotos.",
    },
    {
      id: "ex-universal-safari",
      question:
        "Los universal links abren Safari en lugar de la app. La app tiene `applinks:shop.example.com`. El servidor hace esto. ¿Cuál es el problema?",
      code: swift`GET https://shop.example.com/.well-known/apple-app-site-association
→ 301 Moved Permanently
   Location: https://www.shop.example.com/.well-known/apple-app-site-association`,
      options: [
        "Falta la extensión `.json` en el archivo",
        "El AASA tiene que estar en la raíz, no en `.well-known`",
        "El AASA se tiene que servir directo por HTTPS desde ese dominio, sin redirecciones",
        "Los universal links solo funcionan con apps publicadas en la App Store",
      ],
      answer: 2,
      explanation:
        "El sistema no sigue redirecciones al buscar el AASA. Tiene que responder 200 en `https://shop.example.com/.well-known/apple-app-site-association`, sin extensión. Si además querés `www`, ese dominio necesita su propia entrada `applinks:` y su propio archivo.",
    },
    {
      id: "ex-aasa-order",
      question: "Querés que todo `/account/*` abra la app excepto `/account/delete`, que tiene que quedar en la web. ¿Qué `components` son correctos?",
      options: [
        "`[{\"/\": \"/account/*\"}, {\"/\": \"/account/delete\", \"exclude\": true}]`",
        "`[{\"/\": \"/account/*\", \"exclude\": \"/account/delete\"}]`",
        "`[{\"/\": \"/account/delete\", \"exclude\": true}, {\"/\": \"/account/*\"}]`",
        "`[{\"/\": \"/account/*\"}]` y filtrar `delete` en `onOpenURL`",
      ],
      answer: 2,
      explanation:
        "Gana el primer componente que coincide, así que la exclusión va primero. En la primera opción `/account/*` captura todo antes de llegar a la exclusión. `exclude` es booleano. Filtrar en la app no sirve: el link ya abrió la app en lugar de la web.",
    },
    {
      id: "ex-logged-out",
      question: "Un usuario sin sesión toca un universal link a un pedido. Hoy termina en la home después del login. ¿Qué hacés?",
      options: [
        "Guardar el `DeepLink` como pendiente, mostrar el login y, al loguearse, abrir el link guardado",
        "Abrir el detalle del pedido sin sesión y dejar que la API falle",
        "Ignorar los links si no hay sesión",
        "Guardar la URL en `UserDefaults.standard` para la próxima vez que abra la app",
      ],
      answer: 0,
      explanation:
        "El router retiene el link ya validado y lo ejecuta en `didLogIn()`, en la misma sesión de uso. Mostrar una pantalla que va a fallar es mala UX, ignorar el link pierde la conversión, y persistirlo para \"la próxima vez\" lo abre fuera de contexto.",
    },
    {
      id: "ex-bg-exact",
      question: "Producto pide sincronizar el catálogo \"exactamente cada 15 minutos aunque la app esté cerrada\". ¿Qué respondés?",
      options: [
        "Un `BGAppRefreshTaskRequest` con `earliestBeginDate` de 15 minutos lo garantiza",
        "Un `Timer` de 15 minutos en `applicationDidEnterBackground`",
        "Un `BGProcessingTask` con `requiresExternalPower = false` corre puntual",
        "iOS no garantiza ejecución periódica: `BGTaskScheduler` corre cuando el sistema decide. Si algo tiene que pasar en un momento dado, lo dispara el servidor (push) o se sincroniza al abrir la app",
      ],
      answer: 3,
      explanation:
        "`earliestBeginDate` es un mínimo y la frecuencia depende del uso, la batería y la red. Un `Timer` no corre con la app suspendida. La respuesta profesional es reencuadrar: refrescar al abrir, background refresh como optimización y push cuando el servidor sabe que algo cambió.",
    },
    {
      id: "ex-widget-data",
      question: "El widget muestra siempre \"Sin pedidos\" aunque la app tiene un pedido activo. Las dos usan `UserDefaults.standard`. ¿Cuál es la causa?",
      options: [
        "El widget no tiene permiso de red",
        "La extensión es otro proceso con su propio contenedor; hace falta un App Group en ambos targets y `UserDefaults(suiteName:)`",
        "`UserDefaults` no funciona en extensiones",
        "Hay que llamar a `synchronize()` después de cada escritura",
      ],
      answer: 1,
      explanation:
        "Cada target tiene su sandbox. `UserDefaults` sí funciona en extensiones, pero el `standard` de cada una es distinto. Con la capability App Groups en la app y en el widget, y el mismo `suiteName`, comparten datos. `synchronize()` no hace falta hoy.",
    },
    {
      id: "ex-widget-reload",
      question: "El usuario marca un pedido como entregado en la app. ¿Cuál es la forma correcta de que el widget lo refleje pronto?",
      options: [
        "Actualizar el App Group y llamar a `WidgetCenter.shared.reloadTimelines(ofKind: \"NextOrder\")`",
        "Usar política `.after(.now)` para que recargue en cada segundo",
        "Devolver 60 entradas, una por minuto, en cada `getTimeline`",
        "Mandar una silent push a la extensión del widget",
      ],
      answer: 0,
      explanation:
        "La app sabe cuándo cambió el dato: escribe y pide la recarga de ese `kind`. Recargas muy frecuentes consumen el presupuesto del widget y el sistema las limita. Las silent pushes van a la app, no a las extensiones de widget.",
    },
    {
      id: "ex-live-activity-push",
      question:
        "Las Live Activities se actualizan bien con `activity.update` local, pero las actualizaciones por push no cambian nada. APNs responde 200. El `ContentState` es `{ status: String, etaMinutes: Int }` y el backend manda esto. ¿Qué pasa?",
      code: swift`{ "aps": { "timestamp": 1767312600, "event": "update",
           "content-state": { "status": "En camino", "eta_minutes": 10 } } }`,
      options: [
        "Falta `\"alert\"`: sin alerta no se actualiza",
        "El topic tiene que ser el bundle ID a secas",
        "Las claves de `content-state` no coinciden con las propiedades de `ContentState` (`eta_minutes` vs `etaMinutes`), así que no se decodifica",
        "Las Live Activities solo se actualizan por push si la app está en primer plano",
      ],
      answer: 2,
      explanation:
        "APNs acepta el payload, pero en el dispositivo `content-state` se decodifica contra `ContentState` y falla. El `alert` es opcional (sirve para alertar el cambio). El topic correcto es `<bundle>.push-type.liveactivity`, pero eso daría error en APNs, no 200. La gracia de las updates por push es justamente que funcionan con la app cerrada.",
    },
    {
      id: "ex-app-shortcuts",
      question: "Querés que \"Seguir mi pedido\" funcione en Siri apenas se instala la app, sin que el usuario cree nada en Atajos. ¿Qué necesitás?",
      options: [
        "Donar un `NSUserActivity` cada vez que el usuario abre un pedido",
        "Un `AppIntent` y un `AppShortcutsProvider` con frases que incluyan `\\(.applicationName)`",
        "Una extensión de SiriKit con `INExtension`",
        "Registrar el intent en `didFinishLaunching` con `AppShortcutsProvider.register()`",
      ],
      answer: 1,
      explanation:
        "Los App Shortcuts se declaran en código y el sistema los descubre al instalar; no hay registro en runtime. Donar actividades ayuda a las sugerencias pero no crea frases fijas, y SiriKit con `INExtension` es el enfoque anterior.",
    },
    {
      id: "ex-capabilities-review",
      question:
        "En un PR se agregan: un selector de foto de perfil con `PhotosPicker`, \"cerca tuyo\" con ubicación y pago de suscripción premium a contenido de la app con Apple Pay. ¿Qué observación hacés en la review?",
      options: [
        "Falta `NSPhotoLibraryUsageDescription` para el `PhotosPicker`; lo demás está bien",
        "Hay que pedir ubicación \"Always\" para que \"cerca tuyo\" funcione siempre",
        "Todo bien: Apple Pay reduce la comisión",
        "`PhotosPicker` no necesita permiso; ubicación necesita `NSLocationWhenInUseUsageDescription`; y la suscripción a contenido digital tiene que ser In-App Purchase, no Apple Pay",
      ],
      answer: 3,
      explanation:
        "`PhotosPicker` corre fuera de proceso y solo devuelve lo que el usuario elige. Para \"cerca tuyo\" alcanza \"When In Use\" con su usage string; pedir \"Always\" sin necesidad es motivo de rechazo y baja la confianza. Contenido digital consumido en la app se vende con IAP.",
    },
  ],
};

export default content;
