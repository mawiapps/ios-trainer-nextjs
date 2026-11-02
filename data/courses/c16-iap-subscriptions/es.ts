import type { CourseContent } from "../types";

// El código va con String.raw para no perder las barras de `\(...)` ni de `\.keyPath`.
const swift = String.raw;
const src = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "products-setup",
      title: "Productos y configuración en App Store Connect",
      goal: "Elegir el tipo de producto correcto, armar grupos y niveles de suscripción, y dejar acuerdos, metadata y captura de review listos para que los productos carguen.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Los cuatro tipos de producto",
          body: [
            "**Consumible**: se gasta y se puede volver a comprar (monedas, créditos, un pack de 10 exportaciones). Apple no lo restaura: el saldo lo lleva **tu backend**, que lo acredita cuando verifica la compra.",
            "**No consumible**: se compra una vez y es para siempre (quitar publicidad, un pack de temas). Se restaura y aparece en `Transaction.currentEntitlements` mientras no haya reembolso.",
            "**Suscripción autorrenovable**: se cobra cada período hasta que el usuario cancela. Vive dentro de un **grupo de suscripción**. **Suscripción no renovable**: acceso por un tiempo fijo (un pase de temporada); no se renueva sola y la fecha de vencimiento la calcula tu backend.",
          ],
          code: swift`import StoreKit

func describe(_ product: Product) -> String {
    switch product.type {
    case .consumable:    return "Se gasta: el saldo lo lleva tu backend"
    case .nonConsumable: return "Para siempre: se restaura"
    case .autoRenewable: return "Se renueva sola dentro de un grupo"
    case .nonRenewable:  return "Tiempo fijo: el vencimiento lo calculás vos"
    default:             return "Tipo desconocido"
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Una app de dibujo quiere vender \"Pack de pinceles Acuarela\": se paga una vez, el usuario lo usa para siempre y tiene que recuperarlo si cambia de iPhone. ¿Qué tipo de producto creás?",
          code: src`Producto:  Pack de pinceles Acuarela
Pago:      único
Duración:  para siempre
Requisito: se recupera en un dispositivo nuevo`,
          options: ["Consumible", "Suscripción no renovable", "No consumible", "Suscripción autorrenovable de un año"],
          answer: 2,
          explanation: "Un pago único con acceso permanente es un **no consumible**. Apple lo restaura con la cuenta del usuario y aparece en `Transaction.currentEntitlements`. Un consumible se gasta y no se restaura; las suscripciones cobran por período, que no es lo que se vende acá.",
        },
        {
          kind: "explain",
          title: "Grupos de suscripción y niveles",
          body: [
            "Todas las suscripciones autorrenovables que son \"el mismo servicio en distintas versiones\" van en **un grupo**. El usuario puede tener **una sola activa por grupo**: si cambia de plan, no paga dos.",
            "Dentro del grupo, cada producto tiene un **nivel**. El nivel 1 es el de más valor. Ir a un nivel más alto (número menor) es un **upgrade**; a uno más bajo, un **downgrade**; a otro producto del mismo nivel (mensual ↔ anual del mismo plan), un **crossgrade**.",
            "Regla práctica: un solo grupo por app salvo que vendas servicios realmente independientes (por ejemplo, una app con un plan de música y otro de podcasts que se pueden tener a la vez).",
          ],
          code: src`Grupo: Premium  (subscription group ID: 21456789)

Nivel 1   com.acme.notes.pro.yearly     Pro anual
Nivel 1   com.acme.notes.pro.monthly    Pro mensual
Nivel 2   com.acme.notes.plus.monthly   Plus mensual

# Plus -> Pro: upgrade     (nivel 2 -> nivel 1)
# Pro -> Plus: downgrade   (nivel 1 -> nivel 2)
# Pro mensual <-> Pro anual: crossgrade (mismo nivel)`,
        },
        {
          kind: "predict",
          prompt: "Con el grupo de arriba, una usuaria con **Plus mensual** (nivel 2) a mitad de mes se pasa a **Pro anual** (nivel 1). ¿Qué pasa?",
          code: src`Hoy:     Plus mensual (nivel 2), día 15 de 30
Elige:   Pro anual (nivel 1)`,
          options: [
            "Upgrade inmediato: empieza Pro ahora y Apple le devuelve la parte no usada de Plus",
            "Pro empieza recién cuando termine el mes de Plus",
            "Queda con las dos suscripciones activas hasta que cancele Plus",
            "App Store rechaza el cambio: hay que cancelar Plus y esperar que venza",
          ],
          answer: 0,
          explanation: "Pasar a un nivel más alto es un **upgrade**: es inmediato y Apple reembolsa en forma prorrateada lo que no usó del plan anterior. Como están en el mismo grupo, nunca hay dos activas a la vez. El caso que espera a la próxima renovación es el downgrade.",
        },
        {
          kind: "explain",
          title: "Acuerdos, banco e impuestos: la causa número 1",
          body: [
            "Para vender cualquier cosa, la cuenta tiene que tener el **Paid Apps agreement** firmado en App Store Connect (Business) con **datos bancarios e impuestos completos**. Lo firma el Account Holder, no cualquier miembro del equipo.",
            "Si el acuerdo no está activo, `Product.products(for:)` **no tira error**: devuelve un array vacío. La app muestra un paywall en blanco y el reviewer escribe \"no pudimos encontrar las compras in-app\". Es la causa número 1 de ese rechazo.",
            "Por eso el código distingue \"no cargó nada\" de \"cargó\": un array vacío es un estado de error que hay que mostrar y loguear, no un paywall vacío.",
          ],
          code: swift`let ids = ["com.acme.notes.pro.monthly", "com.acme.notes.pro.yearly"]
let products = try await Product.products(for: ids)

if products.isEmpty {
    // No es un throw: StoreKit devolvió [] sin error.
    // Revisar: Paid Apps agreement + banco + impuestos,
    // IDs exactos, productos creados en App Store Connect.
    logger.error("StoreKit devolvió 0 productos para \(ids)")
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la llamada que pide los productos al App Store.",
          code: swift`let products = try await Product.____(for: ProductID.all)`,
          accept: ["^products$"],
          explanation: "`Product.products(for:)` es estática, `async throws` y recibe los product IDs. Devuelve solo los que App Store reconoce: los IDs mal escritos simplemente no aparecen en el resultado.",
          hint: "Es el plural del tipo.",
          placeholder: "método",
        },
        {
          kind: "explain",
          title: "Metadata de cada producto y la captura de review",
          body: [
            "Cada producto necesita: **Product ID** (único y para siempre: aunque lo borres no se puede reusar), nombre de referencia (interno), precio, disponibilidad por país, **localizaciones** (nombre y descripción que ve el usuario) y una **captura de review**.",
            "La captura de review es una imagen de la pantalla de la app donde se ve el producto (tu paywall). Sin ella el producto no pasa a \"Ready to Submit\", y si no está en ese estado no lo podés adjuntar a la versión.",
            "Los Product IDs en el código tienen que coincidir **exactamente** con los de App Store Connect. Centralizalos en un solo lugar: un typo no da error, el producto simplemente no vuelve.",
          ],
          code: src`Product ID:         com.acme.notes.pro.monthly   # no se puede reusar nunca
Reference name:     Pro Monthly                  # interno, no lo ve el usuario
Subscription group: Premium (nivel 1)
Duration:           1 month
Price:              USD 4.99 (Apple calcula el resto de los países)
Availability:       todos los países
Localizations:      es-419, en-US (display name + description)
Review screenshot:  captura del paywall mostrando este plan
Review notes:       Ajustes > Hacete Pro
Status:             Ready to Submit`,
        },
        {
          kind: "write",
          prompt: "Centralizá los Product IDs: escribí `enum ProductID` con `proMonthly` = `com.acme.notes.pro.monthly`, `proYearly` = `com.acme.notes.pro.yearly` y `static let all` con los dos.",
          starter: swift`// Hoy los IDs están repetidos en tres pantallas.
// Centralizalos acá.
`,
          checks: [
            { pattern: "enum\\s+ProductID\\b", label: "Declara `enum ProductID`" },
            { pattern: "static\\s+let\\s+proMonthly\\s*=\\s*\"com\\.acme\\.notes\\.pro\\.monthly\"", label: "`proMonthly` con el ID exacto" },
            { pattern: "static\\s+let\\s+proYearly\\s*=\\s*\"com\\.acme\\.notes\\.pro\\.yearly\"", label: "`proYearly` con el ID exacto" },
            { pattern: "static\\s+let\\s+all\\b[^\\n]*\\[\\s*proMonthly\\s*,\\s*proYearly\\s*\\]", label: "`all` lista los dos IDs" },
          ],
          warnings: [
            { pattern: "\"Pro Monthly\"|\"Pro Yearly\"", label: "Eso es el reference name, no el Product ID" },
          ],
          solution: swift`enum ProductID {
    static let proMonthly = "com.acme.notes.pro.monthly"
    static let proYearly = "com.acme.notes.pro.yearly"
    static let all = [proMonthly, proYearly]
}`,
          hint: "Un `enum` sin cases sirve de namespace: `static let all = [proMonthly, proYearly]`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "storekit2-basics",
      title: "StoreKit 2 en la app",
      goal: "Cargar productos, comprar, verificar y terminar transacciones, escuchar `Transaction.updates`, calcular entitlements, restaurar y conocer las vistas de StoreKit para SwiftUI.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "Un store observable y precios que no se hardcodean",
          body: [
            "Toda la lógica de compras va en un solo objeto, por ejemplo `StoreManager`. Con iOS 17 lo marcás `@Observable`; en código que todavía soporta iOS 16 es un `ObservableObject` con `@Published`. Las vistas solo leen su estado.",
            "El precio se muestra **siempre** con `product.displayPrice`: viene formateado en la moneda y el país de la cuenta del usuario. Un `\"$4.99\"` hardcodeado está mal en Argentina, en Japón y en cuanto cambies el precio en App Store Connect.",
            "`displayName` y `description` también vienen de App Store Connect, en el idioma del usuario.",
          ],
          code: swift`import StoreKit
import Observation

@MainActor
@Observable
final class StoreManager {
    private(set) var products: [Product] = []
    private(set) var loadFailed = false

    func loadProducts() async {
        do {
            products = try await Product.products(for: ProductID.all)
                .sorted { $0.price < $1.price }
            loadFailed = products.isEmpty
        } catch {
            loadFailed = true
        }
    }
}

// En la vista:
// Text("\(product.displayName): \(product.displayPrice)")`,
        },
        {
          kind: "fill",
          prompt: "Mostrá el precio localizado del producto, listo para la UI.",
          code: swift`Text(product.____)`,
          accept: ["^displayPrice$"],
          explanation: "`displayPrice` es un `String` ya formateado con la moneda del storefront del usuario. `price` es un `Decimal` útil para ordenar o calcular \"ahorrás 20%\", pero para mostrar se usa `displayPrice`.",
          hint: "Empieza con `display`.",
          placeholder: "propiedad",
        },
        {
          kind: "explain",
          title: "Comprar: tres resultados posibles",
          body: [
            "`try await product.purchase(options:)` muestra la hoja de pago del sistema y devuelve un `Product.PurchaseResult`. Pasale `.appAccountToken(uuid)` con un UUID estable de tu usuario: así tu backend sabe de quién es cada compra.",
            "`.success(verification)`: hubo transacción, falta verificarla. `.userCancelled`: el usuario cerró la hoja; no es un error, no muestres alertas. `.pending`: la compra espera algo externo (**Ask to Buy** de un menor, o autenticación fuerte del banco, SCA). No desbloquees nada: la transacción final llega más tarde por `Transaction.updates`.",
            "Si `purchase` tira error (red, producto no disponible), mostralo con opción de reintentar.",
          ],
          code: swift`func purchase(_ product: Product) async throws {
    let result = try await product.purchase(options: [.appAccountToken(userToken)])

    switch result {
    case .success(let verification):
        let transaction = try checkVerified(verification)
        await deliver(transaction)
        await transaction.finish()
    case .userCancelled:
        break
    case .pending:
        isPending = true      // "Esperando aprobación"
    @unknown default:
        break
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Un chico de 12 años con **Ask to Buy** activado en Family Sharing toca \"Suscribirme\". ¿Qué devuelve `purchase()` y qué tiene que hacer la app?",
          code: swift`let result = try await product.purchase()
// Ask to Buy activado para esta cuenta`,
          options: [
            "Tira un error `notAvailable`; hay que mostrar una alerta",
            "`.userCancelled`; la app no hace nada más",
            "`.success` con una transacción `.unverified`",
            "`.pending`; la app muestra \"esperando aprobación\" y la transacción llega después por `Transaction.updates`",
          ],
          answer: 3,
          explanation: "Ask to Buy deja la compra **pendiente** hasta que el adulto la apruebe, quizás horas después y con la app cerrada. `purchase()` devuelve `.pending`; la app no desbloquea nada. Cuando el adulto aprueba, la transacción aparece en `Transaction.updates`, por eso ese listener tiene que estar corriendo desde que arranca la app.",
        },
        {
          kind: "explain",
          title: "Verificar y después terminar",
          body: [
            "Cada transacción llega envuelta en un `VerificationResult`: `.verified(transaction)` si StoreKit validó la firma JWS de Apple para tu app y este dispositivo, `.unverified(transaction, error)` si no. Nunca entregues contenido por una `.unverified`.",
            "`await transaction.finish()` le dice al App Store \"ya entregué\". Llamalo **después** de entregar (guardar el entitlement, acreditar las monedas en tu backend). Si la app se cierra antes, la transacción sin terminar vuelve a aparecer en `Transaction.updates` y podés reintentar.",
            "Un consumible que no se termina se queda en la cola y vuelve en cada arranque; uno que se termina antes de acreditar es plata cobrada sin entregar.",
          ],
          code: swift`enum StoreError: Error { case failedVerification }

func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
    switch result {
    case .verified(let value):
        return value
    case .unverified(_, let error):
        logger.error("Transacción no verificada: \(error)")
        throw StoreError.failedVerification
    }
}`,
        },
        {
          kind: "write",
          prompt: "Escribí `purchase(_ product: Product) async throws` en `StoreManager`: comprá con `appAccountToken`, verificá con `checkVerified`, llamá a `deliver(_:)` y recién después a `finish()`. Manejá `.userCancelled` y `.pending` (marcá `isPending = true`).",
          starter: swift`func purchase(_ product: Product) async throws {
    // tu código
}`,
          checks: [
            { pattern: "\\.purchase\\(options:\\s*\\[\\s*\\.appAccountToken\\(", label: "Compra con `.appAccountToken(...)`" },
            { pattern: "case\\s+\\.success\\(", label: "Maneja `.success`" },
            { pattern: "checkVerified\\(", label: "Verifica la transacción" },
            { pattern: "case\\s+\\.userCancelled", label: "Maneja `.userCancelled`" },
            { pattern: "case\\s+\\.pending[\\s\\S]*isPending\\s*=\\s*true", label: "Maneja `.pending` marcando `isPending`" },
            { pattern: "deliver\\([\\s\\S]*\\.finish\\(\\)", label: "`finish()` después de `deliver`" },
          ],
          warnings: [
            { pattern: "\\.finish\\(\\)[\\s\\S]*deliver\\(", label: "Terminás la transacción antes de entregar el contenido" },
            { pattern: "try!", label: "`try!` crashea la app ante un error de red" },
          ],
          solution: swift`func purchase(_ product: Product) async throws {
    let result = try await product.purchase(options: [.appAccountToken(userToken)])
    switch result {
    case .success(let verification):
        let transaction = try checkVerified(verification)
        await deliver(transaction)
        await transaction.finish()
    case .userCancelled:
        break
    case .pending:
        isPending = true
    @unknown default:
        break
    }
}`,
          hint: "`switch result { case .success(let verification): ... case .userCancelled: ... case .pending: ... @unknown default: ... }`",
        },
        {
          kind: "explain",
          title: "`Transaction.updates` y `currentEntitlements`",
          body: [
            "Hay transacciones que no nacen de tu botón: renovaciones, Ask to Buy aprobado, compras en otro dispositivo, reembolsos, ofertas canjeadas en el App Store. Llegan por `Transaction.updates`, una secuencia asíncrona que tenés que escuchar **desde el arranque** de la app (en el `init` del store, creado en el `App`). Si no la escuchás, Xcode lo avisa en consola y te perdés compras.",
            "Para saber qué tiene el usuario **ahora**, recorré `Transaction.currentEntitlements`: devuelve la última transacción de cada no consumible y de cada suscripción activa. Recalculá tu estado (`isPro`) desde ahí al arrancar, después de cada compra y después de cada update.",
            "Un reembolso llega como transacción con `revocationDate` distinto de `nil`: sacá el acceso. Chequearlo también al recorrer los entitlements es una defensa barata.",
          ],
          code: swift`private var updates: Task<Void, Never>?

init() {
    updates = Task { [weak self] in
        for await result in Transaction.updates {
            guard let self, let tx = try? self.checkVerified(result) else { continue }
            await self.deliver(tx)
            await tx.finish()
            await self.refreshEntitlements()
        }
    }
}

func refreshEntitlements() async {
    var active: Set<String> = []
    for await result in Transaction.currentEntitlements {
        guard let tx = try? checkVerified(result), tx.revocationDate == nil else { continue }
        active.insert(tx.productID)
    }
    isPro = !active.isDisjoint(with: ProductID.all)
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la secuencia que da lo que el usuario tiene derecho a usar hoy.",
          code: swift`for await result in Transaction.____ {
    guard case .verified(let tx) = result else { continue }
    active.insert(tx.productID)
}`,
          accept: ["^currentEntitlements$"],
          explanation: "`Transaction.currentEntitlements` emite la última transacción de cada no consumible y cada suscripción vigente. Los consumibles no aparecen: su saldo lo lleva tu backend. `Transaction.all` sería todo el historial, que no es lo que necesitás para decidir el acceso.",
          hint: "Entitlements = derechos vigentes.",
          placeholder: "propiedad",
        },
        {
          kind: "predict",
          prompt: "Este código simula lo que procesa el listener de updates. ¿Qué imprime?",
          code: swift`struct Tx {
    let productID: String
    let revoked: Bool
}

let updates = [
    Tx(productID: "pro.monthly", revoked: false),
    Tx(productID: "theme.dark", revoked: true),
    Tx(productID: "theme.neon", revoked: false),
]
let unlocked = updates.filter { !$0.revoked }.map(\.productID)
print(unlocked.count, unlocked.contains("theme.dark"))`,
          options: ["3 true", "2 false", "2 true", "3 false"],
          answer: 1,
          explanation: "`filter { !$0.revoked }` descarta la transacción reembolsada (`theme.dark`), quedan 2. Después `contains(\"theme.dark\")` es `false`. Es exactamente lo que hacés con `revocationDate != nil`: un reembolso saca el acceso.",
        },
        {
          kind: "explain",
          title: "Restaurar y las vistas de StoreKit para SwiftUI",
          body: [
            "Con StoreKit 2 las compras se sincronizan solas, pero App Review exige un botón **Restaurar compras** visible. Ese botón llama a `AppStore.sync()`, que puede pedir login del Apple Account: por eso se llama solo cuando el usuario lo toca, nunca automáticamente al arrancar.",
            "Desde iOS 17 tenés vistas listas: `SubscriptionStoreView(groupID:)` arma un paywall completo de un grupo (planes, precios, prueba gratis), `ProductView(id:)` muestra un producto y `StoreView(ids:)` una lista. Manejan carga, compra y estados por vos.",
            "Con `.storeButton(.visible, for: .restorePurchases)` le agregás el botón de restaurar. Igual escuchás `Transaction.updates`: las vistas compran, pero tu store sigue decidiendo el acceso.",
          ],
          code: swift`SubscriptionStoreView(groupID: "21456789") {
    VStack {
        Image(systemName: "note.text")
        Text("Notas Pro: sync, carpetas y exportar a PDF")
    }
}
.storeButton(.visible, for: .restorePurchases)
.subscriptionStorePolicyDestination(url: termsURL, for: .termsOfService)
.subscriptionStorePolicyDestination(url: privacyURL, for: .privacyPolicy)

// Restaurar a mano en un paywall propio:
Button("Restaurar compras") {
    Task {
        try? await AppStore.sync()
        await store.refreshEntitlements()
    }
}`,
        },
        {
          kind: "write",
          prompt: "Agregá al paywall propio un botón \"Restaurar compras\" que sincronice con el App Store y después recalcule los entitlements del `store`.",
          starter: swift`struct PaywallFooter: View {
    let store: StoreManager

    var body: some View {
        HStack {
            // botón de restaurar
        }
    }
}`,
          checks: [
            { pattern: "Button\\(", label: "Hay un `Button`" },
            { pattern: "Task\\s*\\{", label: "Lanza un `Task` para el trabajo asíncrono" },
            { pattern: "AppStore\\.sync\\(\\)", label: "Llama a `AppStore.sync()`" },
            { pattern: "refreshEntitlements\\(\\)", label: "Recalcula los entitlements" },
          ],
          warnings: [
            { pattern: "\\.(task|onAppear)\\s*\\{[^}]*AppStore\\.sync", label: "No sincronices al aparecer: `AppStore.sync()` puede pedir login" },
          ],
          solution: swift`struct PaywallFooter: View {
    let store: StoreManager

    var body: some View {
        HStack {
            Button("Restaurar compras") {
                Task {
                    try? await AppStore.sync()
                    await store.refreshEntitlements()
                }
            }
        }
    }
}`,
          hint: "`Button(\"Restaurar compras\") { Task { try? await AppStore.sync(); await store.refreshEntitlements() } }`",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "lifecycle-offers",
      title: "Ciclo de vida de la suscripción y ofertas",
      goal: "Mapear cada estado de renovación a una decisión de acceso, entender upgrades, cancelaciones, reintentos de cobro y Family Sharing, y elegir la oferta correcta para cada momento.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Estados de renovación",
          body: [
            "`Product.SubscriptionInfo.Status` te da el estado de un grupo: `.subscribed` (activa), `.expired` (venció), `.inGracePeriod` (el cobro falló pero el **período de gracia** mantiene el acceso), `.inBillingRetryPeriod` (el cobro falló, Apple sigue reintentando y el usuario **no** tiene acceso) y `.revoked` (reembolso o perdió Family Sharing).",
            "`RenewalState` no es un `enum` cerrado de Swift: es un tipo con constantes estáticas, así que el `switch` necesita `default`.",
            "Decisión típica: acceso en `.subscribed` y `.inGracePeriod`; en `.inBillingRetryPeriod` sin acceso pero con un aviso \"actualizá tu medio de pago\", que recupera muchas suscripciones.",
          ],
          code: swift`let statuses = try await Product.SubscriptionInfo.status(for: groupID)

for status in statuses {
    switch status.state {
    case .subscribed, .inGracePeriod:
        access = .full
    case .inBillingRetryPeriod:
        access = .paymentIssue     // banner: actualizá tu medio de pago
    case .expired, .revoked:
        access = .none
    default:
        access = .none
    }
}`,
        },
        {
          kind: "predict",
          code: swift`enum State { case subscribed, inGracePeriod, inBillingRetryPeriod, expired, revoked }

func hasAccess(_ s: State) -> Bool {
    switch s {
    case .subscribed, .inGracePeriod: return true
    case .inBillingRetryPeriod, .expired, .revoked: return false
    }
}

let states: [State] = [.inGracePeriod, .inBillingRetryPeriod, .subscribed]
print(states.map(hasAccess))`,
          options: ["[true, true, true]", "[false, false, true]", "[true, false, true]", "[true, true, false]"],
          answer: 2,
          explanation: "`map` aplica `hasAccess` a cada estado en orden: `.inGracePeriod` → `true` (la gracia mantiene el acceso), `.inBillingRetryPeriod` → `false` (sin gracia, Apple reintenta pero el usuario no tiene acceso), `.subscribed` → `true`. Un array de `Bool` se imprime como `[true, false, true]`.",
        },
        {
          kind: "explain",
          title: "Upgrade, downgrade, crossgrade y cancelación",
          body: [
            "**Upgrade** (a un nivel más alto): inmediato, con reembolso prorrateado de lo no usado. **Downgrade**: se aplica en la **próxima renovación**; hasta entonces sigue el plan actual. **Crossgrade** (mismo nivel): si la duración es la misma es inmediato; si cambia (mensual → anual) se aplica en la próxima renovación.",
            "**Cancelar** en Apple significa \"apagar la renovación automática\": el usuario mantiene el acceso hasta el fin del período pagado. En `renewalInfo`, `willAutoRenew` pasa a `false`; la suscripción sigue `.subscribed` hasta vencer.",
            "Un downgrade pendiente se ve en `renewalInfo.autoRenewPreference`: el producto que se va a cobrar en la próxima renovación. Útil para mostrar \"desde el 3/12 pasás a Plus\".",
          ],
          code: swift`if case .verified(let renewal) = status.renewalInfo {
    if !renewal.willAutoRenew {
        banner = "Tu plan termina el \(expiration.formatted(date: .abbreviated, time: .omitted))"
    } else if renewal.autoRenewPreference != currentProductID {
        banner = "En la próxima renovación cambiás de plan"
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Una usuaria paga Pro mensual el día 1, cancela el día 10 desde Ajustes. Hoy es el día 20. ¿Qué tiene que mostrar la app?",
          code: src`Día 1:   compra Pro mensual
Día 10:  cancela desde Ajustes > Suscripciones
Día 20:  abre la app`,
          options: [
            "Sin acceso desde el día 10: canceló",
            "Acceso Pro hasta el día 30, con aviso de que no se renueva",
            "Acceso Pro y un reembolso automático de los 20 días restantes",
            "Estado `.inBillingRetryPeriod` hasta que vuelva a pagar",
          ],
          answer: 1,
          explanation: "Cancelar apaga la renovación automática, no corta el acceso. El estado sigue `.subscribed` hasta el fin del período pagado (día 30) y `willAutoRenew` es `false`. No hay reembolso automático; billing retry es para cobros fallidos, no cancelaciones.",
        },
        {
          kind: "explain",
          title: "Cobros fallidos, aumentos de precio y Family Sharing",
          body: [
            "Si la renovación falla, Apple entra en **billing retry** y reintenta el cobro durante un tiempo (hasta 60 días). Si activaste el **Billing Grace Period** en App Store Connect, durante los primeros días el usuario conserva el acceso (`.inGracePeriod`) mientras se resuelve el pago.",
            "Un **aumento de precio** a suscriptores existentes se configura en App Store Connect; Apple les avisa y, cuando hace falta su consentimiento, si no aceptan la suscripción vence al final del período. No es algo que tu app tenga que cobrar ni calcular.",
            "**Family Sharing** se activa por producto (no consumibles y suscripciones) y no se puede desactivar después. Un familiar recibe la transacción con `ownershipType == .familyShared`; si deja el grupo familiar, pierde el acceso como revocación.",
          ],
          code: swift`for await result in Transaction.currentEntitlements {
    guard case .verified(let tx) = result else { continue }
    if tx.ownershipType == .familyShared {
        // Acceso por Family Sharing: no ofrecer "gestionar suscripción"
        isFamilyMember = true
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Detectá que el usuario accede porque un familiar compró el plan.",
          code: swift`if transaction.ownershipType == .____ {
    showFamilyBadge = true
}`,
          accept: ["^familyShared$", "^\\.familyShared$"],
          explanation: "`ownershipType` es `.purchased` para quien pagó y `.familyShared` para los miembros de la familia. Sirve para ajustar la UI: el familiar no puede gestionar ni cancelar esa suscripción.",
          hint: "family + Shared.",
          placeholder: "caso",
        },
        {
          kind: "explain",
          title: "Ofertas: introductorias, promocionales, códigos y win-back",
          body: [
            "**Introductoria**: para nuevos suscriptores. Tres modos: prueba gratis (`.freeTrial`), pago reducido por período (`.payAsYouGo`) o pago único reducido por adelantado (`.payUpFront`). Cada usuario puede usar **una por grupo**: chequeá `isEligibleForIntroOffer` antes de mostrar \"7 días gratis\".",
            "**Promocional**: para suscriptores actuales o que ya se fueron (retención, \"volvé con 50%\"). La firma **tu servidor** con una clave de App Store Connect; la app la pasa en `purchase(options:)`. **Códigos de oferta**: códigos que distribuís (marketing, soporte) y se canjean en el App Store o en la app.",
            "**Win-back** (iOS 18): ofertas para ex suscriptores que se configuran en App Store Connect; Apple las muestra en el App Store y StoreKit las expone en la app. Elegí la oferta según el momento: adquisición (intro), retención (promocional), campañas (códigos), recuperación (win-back).",
          ],
          code: swift`let sub = product.subscription
let eligible = await sub?.isEligibleForIntroOffer ?? false

if eligible, let intro = sub?.introductoryOffer, intro.paymentMode == .freeTrial {
    ctaTitle = "Probá gratis"
} else {
    ctaTitle = "Suscribirme por \(product.displayPrice)"
}

// Promocional: los parámetros los firma tu servidor
let s = try await api.signOffer(productID: product.id, offerID: "comeback50")
let result = try await product.purchase(options: [
    .promotionalOffer(offerID: s.offerID, keyID: s.keyID, nonce: s.nonce,
                      signature: s.signature, timestamp: s.timestamp)
])`,
        },
        {
          kind: "predict",
          prompt: "El año pasado un usuario usó la prueba gratis de **Pro mensual**, pagó dos meses y canceló. Hoy mira **Pro anual**, que está en el mismo grupo y también tiene 7 días gratis. ¿Qué pasa?",
          code: swift`let eligible = await proYearly.subscription?.isEligibleForIntroOffer ?? false
// mismo grupo que Pro mensual`,
          options: [
            "Es elegible: la prueba es por producto",
            "Es elegible porque pasó más de un año",
            "Solo es elegible si canjea un código de oferta",
            "No es elegible: la oferta introductoria es una por grupo, `eligible` es `false`",
          ],
          answer: 3,
          explanation: "La elegibilidad de la oferta introductoria es **por grupo de suscripción**, no por producto ni por tiempo. Ya la usó en ese grupo, así que `isEligibleForIntroOffer` es `false` y la UI tiene que mostrar el precio normal. Para recuperarlo se usa una oferta promocional, un código o win-back.",
        },
        {
          kind: "explain",
          title: "`AppTransaction`: de app paga a freemium",
          body: [
            "Si tu app era paga y pasa a gratis con suscripción, los que ya la compraron tienen que conservar lo que pagaron. `AppTransaction.shared` devuelve, firmado por Apple, cuándo y con qué versión el usuario obtuvo la app por primera vez.",
            "`originalAppVersion` es el **número de build** (`CFBundleVersion`) de esa primera descarga, no la versión de marketing. Compará contra el build en el que pasaste a freemium. En sandbox vale siempre `\"1.0\"`, tenelo en cuenta al probar.",
          ],
          code: swift`func checkLegacyPurchase() async {
    guard let result = try? await AppTransaction.shared,
          case .verified(let appTx) = result else { return }

    // Build 120 = primera versión freemium
    if let build = Int(appTx.originalAppVersion), build < 120 {
        hasLegacyPro = true
    }
}`,
        },
        {
          kind: "write",
          prompt: "Escribí `func access(for state: Product.SubscriptionInfo.RenewalState) -> Access` que devuelva `.full` para suscripta y en gracia, `.paymentIssue` en billing retry y `.none` en el resto (incluí `default`).",
          starter: swift`enum Access { case full, paymentIssue, none }

func access(for state: Product.SubscriptionInfo.RenewalState) -> Access {
    // tu código
    return .none
}`,
          checks: [
            { pattern: "switch\\s+state", label: "Hace `switch` sobre el estado" },
            { pattern: "case\\s+\\.subscribed\\s*,\\s*\\.inGracePeriod|case\\s+\\.inGracePeriod\\s*,\\s*\\.subscribed", label: "Suscripta y gracia dan acceso" },
            { pattern: "case\\s+\\.inBillingRetryPeriod\\s*:\\s*\\n?\\s*return\\s+\\.paymentIssue", label: "Billing retry devuelve `.paymentIssue`" },
            { pattern: "default\\s*:", label: "Incluye `default` (`RenewalState` no es un enum cerrado)" },
          ],
          warnings: [
            { pattern: "\\.inBillingRetryPeriod[^\\n]*:\\s*\\n?\\s*return\\s+\\.full", label: "En billing retry el usuario no tiene acceso completo" },
          ],
          solution: swift`enum Access { case full, paymentIssue, none }

func access(for state: Product.SubscriptionInfo.RenewalState) -> Access {
    switch state {
    case .subscribed, .inGracePeriod:
        return .full
    case .inBillingRetryPeriod:
        return .paymentIssue
    default:
        return .none
    }
}`,
          hint: "Tres ramas y `default`: `.subscribed, .inGracePeriod` / `.inBillingRetryPeriod` / `default`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "testing-tiers",
      title: "Probar compras: `.storekit`, sandbox y TestFlight",
      goal: "Saber qué probar en cada nivel (archivo `.storekit`, `SKTestSession`, sandbox en dispositivo, TestFlight) y qué necesita cada uno para que los productos carguen.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Cuatro niveles de prueba",
          body: [
            "**1. Archivo `.storekit` en Xcode**: productos locales, sin App Store Connect ni acuerdos. Ideal para desarrollar el paywall y simular renovaciones, reembolsos, errores y Ask to Buy. **2. Sandbox en dispositivo**: productos reales de App Store Connect, cuenta de sandbox, sin cobro. **3. TestFlight**: build firmada para distribución, también en sandbox y sin cobro. **4. Producción**: después de la aprobación.",
            "La clave del curso: **los productos funcionan en sandbox antes de ser aprobados**. Alcanza con que existan en App Store Connect y el Paid Apps agreement esté activo. El reviewer de Apple prueba tu build de producción comprando **en sandbox**.",
            "Cada nivel atrapa errores distintos: el `.storekit` no detecta un acuerdo sin firmar ni un ID que no existe en App Store Connect; sandbox sí.",
          ],
          code: src`Nivel          Productos de           Requiere                         Cobra
.storekit      el archivo local       nada (ni cuenta)                 no
Sandbox        App Store Connect      Paid Apps agreement + cuenta     no
                                      de sandbox
TestFlight     App Store Connect      lo mismo + build subida          no
Producción     App Store Connect      productos aprobados              sí
               (pueden tardar hasta una hora en aparecer tras aprobarse)`,
        },
        {
          kind: "predict",
          prompt: "En el simulador con `Products.storekit` el paywall muestra los dos planes. En TestFlight, en un iPhone real, el paywall queda vacío. ¿Qué es lo más probable?",
          code: src`Simulador + Products.storekit   -> 2 productos
TestFlight en iPhone            -> 0 productos, sin error`,
          options: [
            "Los productos no existen en App Store Connect con esos IDs o el Paid Apps agreement no está activo",
            "TestFlight no soporta compras in-app",
            "Los productos todavía no fueron aprobados por App Review",
            "El tester tiene que usar una tarjeta real",
          ],
          answer: 0,
          explanation: "El `.storekit` solo existe en tu Xcode; TestFlight consulta App Store Connect en sandbox. Un array vacío sin error apunta a IDs que no coinciden o a acuerdos/banco/impuestos incompletos. TestFlight sí soporta compras (en sandbox, gratis) y **no** hace falta aprobación previa.",
        },
        {
          kind: "explain",
          title: "El archivo `.storekit` y el Transaction Manager",
          body: [
            "Creás un **StoreKit Configuration File** en Xcode, con productos y grupos locales (o sincronizado con tu app de App Store Connect). Lo activás en el esquema: **Edit Scheme > Run > Options > StoreKit Configuration**.",
            "Con la app corriendo, **Debug > StoreKit > Manage Transactions** abre el Transaction Manager: ves cada transacción y podés reembolsarla, aprobar o rechazar un Ask to Buy pendiente o borrarla. En el editor del archivo podés acelerar renovaciones y simular errores de StoreKit.",
            "Las transacciones de este nivel las firma Xcode localmente, no Apple: tu backend no las puede verificar. Su `environment` es `.xcode`.",
          ],
          code: src`1. File > New > File... > StoreKit Configuration File   (Products.storekit)
   [x] Sync this file with an app in App Store Connect   (opcional)
2. Product > Scheme > Edit Scheme... > Run > Options
   StoreKit Configuration: Products.storekit
3. Con la app corriendo: Debug > StoreKit > Manage Transactions...
   - Refund / Approve / Decline Ask to Buy / Delete
4. Editor del .storekit: Editor > Subscription Renewal Rate, errores simulados`,
        },
        {
          kind: "fill",
          prompt: "¿Qué entorno reporta una transacción hecha en el simulador con un archivo `.storekit`?",
          code: swift`if transaction.environment == .____ {
    // firmada localmente por Xcode: no mandarla al backend
}`,
          accept: ["^xcode$", "^\\.xcode$"],
          explanation: "`AppStore.Environment` tiene `.xcode`, `.sandbox` y `.production`. Las transacciones del archivo `.storekit` son `.xcode`; las de sandbox, TestFlight y la build que prueba el reviewer son `.sandbox`.",
          hint: "Es el nombre del IDE.",
          placeholder: "entorno",
        },
        {
          kind: "explain",
          title: "Tests automáticos con `SKTestSession`",
          body: [
            "`StoreKitTest` te deja usar el `.storekit` desde tests: `SKTestSession(configurationFileNamed:)` carga el archivo y controla el entorno sin tocar la UI. Así un test de CI compra, expira o reembolsa sin humanos.",
            "Propiedades clave: `disableDialogs = true` (compra sin hoja de confirmación), `askToBuyEnabled` (las compras quedan pendientes), `resetToDefaultState()` y `clearTransactions()` para arrancar limpio en cada test.",
          ],
          code: swift`import StoreKitTest
import XCTest
@testable import Notes

@MainActor
final class StoreManagerTests: XCTestCase {
    var session: SKTestSession!

    override func setUp() async throws {
        session = try SKTestSession(configurationFileNamed: "Products")
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
    }

    func test_purchase_unlocksPro() async throws {
        let store = StoreManager()
        await store.loadProducts()
        let pro = try XCTUnwrap(store.products.first { $0.id == ProductID.proMonthly })

        try await store.purchase(pro)
        await store.refreshEntitlements()

        XCTAssertTrue(store.isPro)
    }
}`,
        },
        {
          kind: "write",
          prompt: "Escribí `test_askToBuy_leavesPurchasePending`: con la sesión cargada desde `Products`, sin diálogos y con Ask to Buy activado, comprá Pro mensual y verificá que `isPending` es `true` y `isPro` es `false`.",
          starter: swift`func test_askToBuy_leavesPurchasePending() async throws {
    let store = StoreManager()
    await store.loadProducts()
    let pro = try XCTUnwrap(store.products.first { $0.id == ProductID.proMonthly })
    // tu código
}`,
          checks: [
            { pattern: "askToBuyEnabled\\s*=\\s*true", label: "Activa Ask to Buy" },
            { pattern: "disableDialogs\\s*=\\s*true", label: "Desactiva los diálogos" },
            { pattern: "try\\s+await\\s+store\\.purchase\\(", label: "Compra con el store" },
            { pattern: "XCTAssertTrue\\(\\s*store\\.isPending", label: "Verifica que quedó pendiente" },
            { pattern: "XCTAssertFalse\\(\\s*store\\.isPro", label: "Verifica que no desbloqueó Pro" },
          ],
          warnings: [
            { pattern: "Thread\\.sleep|sleep\\(", label: "No esperes con `sleep`: el resultado `.pending` es inmediato" },
          ],
          solution: swift`func test_askToBuy_leavesPurchasePending() async throws {
    session.disableDialogs = true
    session.askToBuyEnabled = true
    let store = StoreManager()
    await store.loadProducts()
    let pro = try XCTUnwrap(store.products.first { $0.id == ProductID.proMonthly })

    try await store.purchase(pro)

    XCTAssertTrue(store.isPending)
    XCTAssertFalse(store.isPro)
}`,
          hint: "Configurá `session.askToBuyEnabled = true` antes de comprar.",
        },
        {
          kind: "explain",
          title: "Sandbox en dispositivo y TestFlight",
          body: [
            "Para sandbox necesitás: productos creados en App Store Connect con sus IDs exactos, **Paid Apps agreement activo**, y una **cuenta de sandbox** creada en Users and Access > Sandbox. En el iPhone, la cuenta de sandbox se configura en Ajustes, en la sección de App Store (separada de tu Apple Account real).",
            "Las renovaciones están **aceleradas**: un mes dura unos 5 minutos. Así probás renovación, vencimiento y reintentos en una tarde. Desde la gestión de la cuenta de sandbox podés limpiar el historial de compras para volver a ser elegible a la prueba gratis.",
            "**TestFlight** también usa sandbox: los testers compran sin cargo y las renovaciones también se aceleran. Es el ensayo más cercano a lo que hace el reviewer.",
          ],
          code: src`Checklist de sandbox
[ ] Productos en App Store Connect (IDs exactos, con precio)
[ ] Paid Apps agreement: Active (banco + impuestos completos)
[ ] Cuenta de sandbox creada (Users and Access > Sandbox)
[ ] iPhone: Ajustes > Desarrollador > Sandbox Apple Account (iOS 18+; antes: Ajustes > App Store)
[ ] Build de desarrollo o TestFlight (sin archivo .storekit en el esquema)

Renovación acelerada: 1 mes de suscripción ≈ 5 minutos`,
        },
        {
          kind: "predict",
          prompt: "QA se suscribe a Pro mensual en sandbox a las 10:00 y no toca nada. A las 10:20 revisa el estado. ¿Qué ve?",
          code: src`10:00  compra Pro mensual (sandbox)
10:20  revisa Transaction.currentEntitlements`,
          options: [
            "Sigue en el primer período: falta casi un mes",
            "Renovó varias veces: en sandbox un mes dura unos 5 minutos",
            "Expiró: sandbox nunca renueva",
            "Le cobraron cuatro veces en su tarjeta",
          ],
          answer: 1,
          explanation: "En sandbox un mes dura unos 5 minutos, así que en 20 minutos hubo varias renovaciones, cada una con una transacción nueva que llega por `Transaction.updates`. No hay cobro real: sandbox nunca usa la tarjeta del usuario.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "server-side",
      title: "El lado del servidor",
      goal: "Verificar transacciones JWS en tu backend, procesar App Store Server Notifications V2, consultar la App Store Server API, atar compras a tu usuario con `appAccountToken` y manejar sandbox y producción.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "Qué manda la app y por qué hace falta un backend",
          body: [
            "Si tu usuario tiene cuenta (web, Android, otro iPhone), la verdad sobre \"¿es Pro?\" vive en tu servidor. La app manda la transacción firmada (`verification.jwsRepresentation`, un JWS de Apple) y tu backend la verifica antes de dar acceso.",
            "`appAccountToken` es un UUID que vos generás por usuario y pasás en `purchase(options:)`. Apple lo guarda en la transacción y lo devuelve en las notificaciones: así una renovación que llega a las 3 AM sabe a qué usuario de tu base pertenece.",
            "`verifyReceipt` y el recibo único de la app están **deprecados**. El camino actual son transacciones JWS, App Store Server Notifications V2 y App Store Server API.",
          ],
          code: swift`let result = try await product.purchase(options: [.appAccountToken(user.storeToken)])

if case .success(let verification) = result {
    // JWS firmado por Apple: el backend lo verifica, no confía en la app
    try await api.registerPurchase(jws: verification.jwsRepresentation)
    let transaction = try checkVerified(verification)
    await transaction.finish()
}`,
        },
        {
          kind: "predict",
          prompt: "Tu backend recibe `DID_RENEW` a las 3 AM. ¿Cómo sabe a cuál de tus usuarios renovarle el acceso?",
          code: src`notificationType: DID_RENEW
data.signedTransactionInfo -> { productId, originalTransactionId, appAccountToken, ... }`,
          options: [
            "Por el email del Apple Account, que viene en la notificación",
            "No puede: tiene que esperar a que el usuario abra la app",
            "Por el `appAccountToken` que la app pasó al comprar (o el `originalTransactionId` guardado en la primera compra)",
            "Por el ID del dispositivo que hizo la compra",
          ],
          answer: 2,
          explanation: "Apple nunca te da el email ni datos personales del comprador. El `appAccountToken` que pasaste en `purchase(options:)` vuelve en cada transacción de esa suscripción; también podés guardar el `originalTransactionId`, que es igual en todas las renovaciones.",
        },
        {
          kind: "explain",
          title: "Verificar el JWS con App Store Server Library",
          body: [
            "Apple publica la **App Store Server Library** para Node, Python, Java y Swift. `SignedDataVerifier` valida la cadena de certificados contra las raíces de Apple, el bundle ID y el entorno, y decodifica el payload.",
            "Hay dos entornos y los datos dicen de cuál vienen: el campo `environment` de la transacción es `\"Sandbox\"` o `\"Production\"`. Una build de **producción** usada por el reviewer o por TestFlight genera transacciones **sandbox**: tu backend tiene que aceptarlas (marcadas como de prueba), no rechazarlas.",
          ],
          code: src`import { SignedDataVerifier, Environment } from "@apple/app-store-server-library";

const roots = loadAppleRootCertificates(); // Buffer[] con las raíces de Apple
const prod = new SignedDataVerifier(roots, true, Environment.PRODUCTION, BUNDLE_ID, APP_APPLE_ID);
const sandbox = new SignedDataVerifier(roots, true, Environment.SANDBOX, BUNDLE_ID);

export async function verifyTransaction(jws: string) {
  try {
    return await prod.verifyAndDecodeTransaction(jws);
  } catch {
    // Build de review o TestFlight: transacción sandbox
    return await sandbox.verifyAndDecodeTransaction(jws);
  }
}`,
        },
        {
          kind: "fill",
          prompt: "En el backend, ¿qué campo de la transacción decodificada te dice si vino de sandbox?",
          code: src`const tx = await verifyTransaction(jws);
const isTest = tx.____ === "Sandbox";`,
          accept: ["^environment$"],
          explanation: "`environment` viene en cada transacción y notificación. Guardalo junto a la compra: te deja aceptar las compras del reviewer y de TestFlight sin mezclarlas con métricas de ingresos reales.",
          hint: "Es la misma palabra que en `transaction.environment` de StoreKit.",
          placeholder: "campo",
        },
        {
          kind: "explain",
          title: "App Store Server Notifications V2",
          body: [
            "En App Store Connect (App Information) configurás **dos URLs**: producción y sandbox. Apple hace POST con un `signedPayload` JWS que verificás igual que una transacción. Respondé 200 rápido; si no, Apple reintenta. Deduplicá por `notificationUUID`.",
            "Tipos que más vas a manejar: `SUBSCRIBED` (alta o reactivación), `DID_RENEW`, `DID_FAIL_TO_RENEW` (con subtipo `GRACE_PERIOD` si sigue con acceso), `GRACE_PERIOD_EXPIRED`, `EXPIRED`, `DID_CHANGE_RENEWAL_STATUS` (apagó o prendió la renovación) y `REFUND`.",
            "Las notificaciones son la fuente de verdad del servidor: la app puede no abrirse nunca más y aun así tu backend sabe que la suscripción venció.",
          ],
          code: src`app.post("/apple/notifications/production", (req, res) => handle(prod, req, res));
app.post("/apple/notifications/sandbox", (req, res) => handle(sandbox, req, res));

async function handle(verifier, req, res) {
  const n = await verifier.verifyAndDecodeNotification(req.body.signedPayload);
  if (await alreadyProcessed(n.notificationUUID)) return res.sendStatus(200);
  const tx = await verifier.verifyAndDecodeTransaction(n.data.signedTransactionInfo);

  switch (n.notificationType) {
    case "SUBSCRIBED":
    case "DID_RENEW":
      await grant(tx.appAccountToken, tx.productId, tx.expiresDate); break;
    case "DID_FAIL_TO_RENEW":
      await flagBillingIssue(tx.originalTransactionId, n.subtype); break;
    case "GRACE_PERIOD_EXPIRED":
    case "EXPIRED":
      await expire(tx.originalTransactionId); break;
    case "REFUND":
      await revoke(tx.originalTransactionId, tx.revocationDate); break;
    case "DID_CHANGE_RENEWAL_STATUS":
      await saveAutoRenew(tx.originalTransactionId, n.subtype); break;
  }
  await markProcessed(n.notificationUUID);
  res.sendStatus(200);
}`,
        },
        {
          kind: "predict",
          prompt: "Un usuario pide reembolso a Apple de su suscripción anual y Apple lo aprueba. ¿Qué recibe tu sistema?",
          code: src`Usuario -> reportaproblem.apple.com -> reembolso aprobado`,
          options: [
            "Una notificación `REFUND` en el servidor y, en la app, una transacción con `revocationDate` por `Transaction.updates`",
            "Nada: hay que consultar a Apple todos los días",
            "Una notificación `EXPIRED` con subtipo `VOLUNTARY`",
            "Un email de Apple al desarrollador con el ID del usuario",
          ],
          answer: 0,
          explanation: "El reembolso dispara `REFUND` en tus Server Notifications y en el dispositivo llega por `Transaction.updates` la transacción con `revocationDate`. Las dos rutas tienen que sacar el acceso. `EXPIRED` es vencimiento normal, no reembolso.",
        },
        {
          kind: "explain",
          title: "App Store Server API",
          body: [
            "Además de escuchar, tu servidor puede **preguntar**. La App Store Server API usa un JWT firmado (ES256) con una clave de In-App Purchase que generás en App Store Connect. Tiene base URL de producción y de sandbox.",
            "Endpoints del día a día: estado de todas las suscripciones de un usuario (a partir de cualquier `transactionId` suyo), historial de transacciones, historial de notificaciones (para recuperar las que te perdiste) y **consumption information**: cuando Apple te pide datos ante un pedido de reembolso de un consumible, le contás si el contenido se usó.",
            "La librería oficial también trae un cliente de esta API, así no armás el JWT a mano.",
          ],
          code: src`# Producción: https://api.storekit.itunes.apple.com
# Sandbox:    https://api.storekit-sandbox.itunes.apple.com
# Authorization: Bearer <JWT ES256 firmado con tu clave In-App Purchase>

GET  /inApps/v1/subscriptions/{transactionId}          # estado de todas las suscripciones
GET  /inApps/v2/history/{transactionId}                # historial de transacciones
POST /inApps/v1/notifications/history                  # notificaciones enviadas
PUT  /inApps/v1/transactions/consumption/{transactionId}  # datos para un pedido de reembolso`,
        },
        {
          kind: "predict",
          prompt: "Tu endpoint de notificaciones estuvo caído dos días por un deploy roto. ¿Cómo dejás los accesos al día?",
          code: src`Lunes 09:00 -> Miércoles 09:00: /apple/notifications respondía 500`,
          options: [
            "No se puede: las notificaciones se pierden para siempre",
            "Pedirles a los usuarios que toquen \"Restaurar compras\"",
            "Volver a `verifyReceipt` para esos dos días",
            "Pedir el historial de notificaciones y el estado de las suscripciones a la App Store Server API, y reprocesar",
          ],
          answer: 3,
          explanation: "Apple reintenta las notificaciones fallidas durante un tiempo, pero no confíes solo en eso. La App Store Server API tiene historial de notificaciones y estado de suscripciones: con eso reconstruís lo que cambió. `verifyReceipt` está deprecado y \"restaurar\" depende de que cada usuario actúe.",
        },
        {
          kind: "explain",
          title: "Alternativas gestionadas: RevenueCat, Adapty, Qonversion",
          body: [
            "Todo lo anterior (verificar, notificaciones, estados, cruzar con Android y web) es un backend entero. **RevenueCat**, **Adapty** y **Qonversion** lo dan como servicio: su SDK compra con StoreKit, su servidor procesa las notificaciones y vos preguntás \"¿tiene el entitlement `pro`?\".",
            "A cambio: dependencia de un tercero, costo por ingresos a partir de cierto volumen y datos de compra en otro sistema. Igual tenés que configurar productos, acuerdos y review en App Store Connect: el ciclo de aprobación es el mismo.",
          ],
          code: swift`import RevenueCat

Purchases.configure(withAPIKey: "appl_XXXXXXXX", appUserID: user.id)

let info = try await Purchases.shared.customerInfo()
let isPro = info.entitlements["pro"]?.isActive == true`,
        },
        {
          kind: "write",
          prompt: "Escribí `deliver(_ verification: VerificationResult<Transaction>) async throws`: mandá el JWS al backend con `try await api.registerPurchase(jws:)` y recién cuando responda, verificá la transacción con `checkVerified` y llamá a `finish()`.",
          starter: swift`func deliver(_ verification: VerificationResult<Transaction>) async throws {
    // tu código
}`,
          checks: [
            { pattern: "jwsRepresentation", label: "Manda `jwsRepresentation`" },
            { pattern: "try\\s+await\\s+api\\.registerPurchase\\(", label: "Espera la respuesta del backend" },
            { pattern: "checkVerified\\(", label: "Verifica la transacción" },
            { pattern: "registerPurchase[\\s\\S]*\\.finish\\(\\)", label: "`finish()` después del backend" },
          ],
          warnings: [
            { pattern: "\\.finish\\(\\)[\\s\\S]*registerPurchase", label: "Terminás antes de que el backend registre la compra" },
            { pattern: "verifyReceipt|appStoreReceiptURL", label: "El recibo y `verifyReceipt` están deprecados" },
          ],
          solution: swift`func deliver(_ verification: VerificationResult<Transaction>) async throws {
    try await api.registerPurchase(jws: verification.jwsRepresentation)
    let transaction = try checkVerified(verification)
    await transaction.finish()
}`,
          hint: "Si `registerPurchase` tira error, la función sale antes de `finish()` y la transacción vuelve en `Transaction.updates`.",
        },
        {
          kind: "write",
          prompt: "Escribí el handler de Node `handle(verifier, req, res)`: decodificá `signedPayload` con `verifyAndDecodeNotification`, ignorá duplicados por `notificationUUID`, y en el `switch` de `notificationType` manejá al menos `\"DID_RENEW\"` y `\"REFUND\"`. Respondé 200.",
          starter: src`async function handle(verifier, req, res) {
  // tu código
}`,
          checks: [
            { pattern: "verifyAndDecodeNotification\\(", label: "Verifica y decodifica la notificación" },
            { pattern: "notificationUUID", label: "Deduplica por `notificationUUID`" },
            { pattern: "case\\s+\"DID_RENEW\"", label: "Maneja `DID_RENEW`" },
            { pattern: "case\\s+\"REFUND\"", label: "Maneja `REFUND`" },
            { pattern: "sendStatus\\(200\\)|status\\(200\\)", label: "Responde 200" },
          ],
          warnings: [
            { pattern: "verifyReceipt", label: "`verifyReceipt` está deprecado" },
            { pattern: "JSON\\.parse\\(\\s*atob|split\\(\"\\.\"\\)", label: "Decodificar el JWS a mano no verifica la firma" },
          ],
          solution: src`async function handle(verifier, req, res) {
  const n = await verifier.verifyAndDecodeNotification(req.body.signedPayload);
  if (await alreadyProcessed(n.notificationUUID)) return res.sendStatus(200);
  const tx = await verifier.verifyAndDecodeTransaction(n.data.signedTransactionInfo);
  switch (n.notificationType) {
    case "DID_RENEW":
      await grant(tx.appAccountToken, tx.productId, tx.expiresDate);
      break;
    case "REFUND":
      await revoke(tx.originalTransactionId, tx.revocationDate);
      break;
  }
  await markProcessed(n.notificationUUID);
  res.sendStatus(200);
}`,
          hint: "Primero `verifyAndDecodeNotification`, después el chequeo de duplicados, después el `switch`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "review-cycle",
      title: "Romper el ciclo de App Review",
      goal: "Entender por qué el \"ciclo\" entre review y aprobación de productos no existe, dejar lista la checklist de la primera aprobación y un paywall que cumpla la guideline 3.1.2.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El ciclo que no existe",
          body: [
            "La duda clásica: \"App Review quiere ver los planes funcionando, pero los planes solo funcionan cuando están aprobados\". Falso. Los productos funcionan en **sandbox** desde que existen en App Store Connect con el acuerdo activo. El reviewer instala tu build de producción y compra **en sandbox**, sin cargo.",
            "La primera compra in-app o suscripción se envía **junto con una versión de la app**: en la página de la versión, sección **In-App Purchases and Subscriptions**, la agregás antes de mandar a review. App Review aprueba app y productos juntos.",
            "Lo que hay que dominar no es un truco, es una checklist: que cuando el reviewer abra el paywall, los productos **carguen**, se puedan comprar y el contenido se desbloquee.",
          ],
          code: src`1. Crear productos en App Store Connect -> funcionan en sandbox
2. Probar en dispositivo y TestFlight (sandbox)
3. Completar metadata + captura de review -> "Ready to Submit"
4. Versión 1.0 > In-App Purchases and Subscriptions > agregar productos
5. Enviar la versión a review
6. Reviewer: build de producción + compra en sandbox
7. Aprobación de app y productos juntos
8. Producción: los productos pueden tardar hasta una hora en aparecer`,
        },
        {
          kind: "predict",
          prompt: "Rechazo con guideline 2.1: \"We were unable to locate the in-app purchases\". La captura que mandan muestra el paywall con un spinner eterno. En tu Xcode con `.storekit` todo anda. App Store Connect > Business muestra el Paid Apps agreement en estado \"Pending\". ¿Causa?",
          code: src`Guideline 2.1 - Performance - App Completeness
"We were unable to locate the in-app purchases within the app."

Business > Agreements: Paid Apps — Pending (bank account)`,
          options: [
            "Los productos tienen que estar aprobados antes de enviar la app",
            "Sin Paid Apps agreement activo `Product.products(for:)` devuelve vacío; además la app no maneja ese caso",
            "El reviewer no tiene cuenta de sandbox",
            "Falta subir el archivo `.storekit` a App Store Connect",
          ],
          answer: 1,
          explanation: "Con el acuerdo pendiente (banco o impuestos incompletos) StoreKit devuelve un array vacío sin error, y la app se queda cargando. Son dos problemas: completar el acuerdo y mostrar un error con reintento en vez de un spinner infinito. El `.storekit` solo existe en tu Xcode y los productos no necesitan aprobación previa.",
        },
        {
          kind: "explain",
          title: "Checklist de la primera aprobación",
          body: [
            "Repasala antes de cada envío que incluya productos nuevos. Cada línea es un rechazo real que alguien se comió.",
            "Ojo con el backend: la build que prueba el reviewer es de **producción**, pero sus compras son **sandbox**. Si tu servidor solo acepta `environment == \"Production\"`, el reviewer paga, no recibe nada y te rechaza.",
          ],
          code: src`[ ] Paid Apps agreement: Active (Account Holder, banco e impuestos completos)
[ ] Cada producto: nombre, descripción, precio, disponibilidad,
    localizaciones y captura de review -> "Ready to Submit"
[ ] Productos agregados a la versión (In-App Purchases and Subscriptions)
[ ] Product IDs del código == App Store Connect, carácter por carácter
[ ] Backend acepta transacciones sandbox desde una build de producción
[ ] Paywall cumple 3.1.2: plan, duración, precio, qué pasa después
    de la prueba, Restaurar, Términos (EULA) y Privacidad
[ ] Términos y Privacidad también en la metadata de la app
[ ] Si los productos no cargan: error + Reintentar, nunca pantalla vacía
[ ] Notas para el reviewer: dónde está el paywall, cuenta demo,
    dónde se ve lo desbloqueado`,
        },
        {
          kind: "predict",
          prompt: "El reviewer compra Pro y la app sigue mostrando el paywall. Este es tu backend. ¿Qué cambiás?",
          code: src`const tx = await prod.verifyAndDecodeTransaction(jws);
if (tx.environment !== "Production") {
  return res.status(400).send("invalid environment");
}
await grant(user, tx.productId, tx.expiresDate);`,
          options: [
            "Nada: el reviewer tiene que usar una tarjeta real",
            "Mandarle al reviewer un código de oferta",
            "Aceptar también transacciones sandbox (verificando con el entorno sandbox) y marcarlas como de prueba",
            "Desactivar la verificación de firma en producción",
          ],
          answer: 2,
          explanation: "La build de producción del reviewer compra en **sandbox**. Tu backend tiene que verificar con el verificador sandbox cuando corresponda y dar acceso, guardando `environment` para separarlo de ingresos reales. Nunca se desactiva la verificación de firma.",
        },
        {
          kind: "explain",
          title: "El paywall que pasa la guideline 3.1.2",
          body: [
            "Para suscripciones autorrenovables el paywall tiene que mostrar, **antes** de comprar: nombre del plan y duración, precio completo (el que se cobra, bien visible, no solo \"equivale a X por mes\"), qué pasa al terminar la prueba gratis (\"7 días gratis, después $X por mes\"), un botón **Restaurar compras** y links a **Términos de uso (EULA)** y **Política de privacidad**.",
            "Esos links van **en la app y en la metadata** (campo de Privacy Policy URL, y el EULA estándar de Apple o uno propio en la descripción o en el campo de EULA). La prueba gratis no puede ser más prominente que el precio a pagar.",
          ],
          code: swift`VStack(spacing: 12) {
    Text(product.displayName).font(.title2.bold())
    if let intro = product.subscription?.introductoryOffer, isEligible {
        Text("Prueba gratis de \(periodText(intro.period)), después \(product.displayPrice) por mes")
    } else {
        Text("\(product.displayPrice) por mes. Se renueva automáticamente.")
    }
    Button("Suscribirme") { Task { try await store.purchase(product) } }
    Button("Restaurar compras") { Task { try? await AppStore.sync() } }
    HStack {
        Link("Términos de uso", destination: termsURL)
        Link("Privacidad", destination: privacyURL)
    }
    .font(.footnote)
}`,
        },
        {
          kind: "write",
          prompt: "Completá `PlanCard` para que cumpla 3.1.2: nombre del plan, precio con `displayPrice` y la frase \"por año\", botón de compra, botón Restaurar con `AppStore.sync()` y `Link` a `termsURL` y `privacyURL`.",
          starter: swift`struct PlanCard: View {
    let product: Product
    let store: StoreManager
    let termsURL: URL
    let privacyURL: URL

    var body: some View {
        VStack {
            Text("¡Hacete Pro!")
            Button("Suscribirme") { Task { try await store.purchase(product) } }
        }
    }
}`,
          checks: [
            { pattern: "product\\.displayName", label: "Muestra el nombre del plan" },
            { pattern: "product\\.displayPrice", label: "Muestra el precio con `displayPrice`" },
            { pattern: "AppStore\\.sync\\(\\)", label: "Botón Restaurar con `AppStore.sync()`" },
            { pattern: "Link\\([^\\n]*termsURL", label: "Link a Términos de uso" },
            { pattern: "Link\\([^\\n]*privacyURL", label: "Link a Privacidad" },
          ],
          warnings: [
            { pattern: "\"[^\"\\n]*(\\$|USD|ARS)\\s?\\d", label: "Precio hardcodeado: usá `displayPrice`" },
          ],
          solution: swift`struct PlanCard: View {
    let product: Product
    let store: StoreManager
    let termsURL: URL
    let privacyURL: URL

    var body: some View {
        VStack {
            Text(product.displayName)
            Text("\(product.displayPrice) por año. Se renueva automáticamente.")
            Button("Suscribirme") { Task { try await store.purchase(product) } }
            Button("Restaurar compras") { Task { try? await AppStore.sync() } }
            HStack {
                Link("Términos de uso", destination: termsURL)
                Link("Privacidad", destination: privacyURL)
            }
        }
    }
}`,
          hint: "Sumá `Text(product.displayName)`, el precio, el botón de restaurar y dos `Link(..., destination:)`.",
        },
        {
          kind: "explain",
          title: "Si los productos no cargan: error con reintento",
          body: [
            "El reviewer puede probar con mala red, en un momento en que StoreKit tarda, o con un acuerdo que se venció. Si tu paywall queda en blanco o con un botón que no hace nada, el rechazo es seguro.",
            "Modelá el estado explícitamente: cargando, error, vacío (que también es error) y cargado. En error, mensaje claro y botón **Reintentar**.",
          ],
          code: swift`switch store.state {
case .loading:
    ProgressView()
case .failed:
    RetryView("No pudimos cargar los planes") { await store.loadProducts() }
case .loaded(let products) where products.isEmpty:
    RetryView("No hay planes disponibles ahora") { await store.loadProducts() }
case .loaded(let products):
    ForEach(products) { PlanCard(product: $0, store: store, termsURL: termsURL, privacyURL: privacyURL) }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la condición que trata un resultado vacío de StoreKit como error.",
          code: swift`case .loaded(let products) where products.____:
    RetryView("No hay planes disponibles ahora") { await store.loadProducts() }`,
          accept: ["^isEmpty$"],
          explanation: "`Product.products(for:)` devuelve `[]` sin error cuando faltan acuerdos o los IDs no coinciden. `where products.isEmpty` lo convierte en un estado visible con reintento en vez de una lista vacía.",
          hint: "La propiedad de `Array` que dice si no tiene elementos.",
          placeholder: "propiedad",
        },
        {
          kind: "explain",
          title: "Notas para el reviewer y después de la primera aprobación",
          body: [
            "En **App Review Information** escribí notas concretas: dónde está el paywall, cuenta demo si hay login, qué se desbloquea y dónde se ve. Si respondés un rechazo en App Review, explicá qué cambiaste y en qué build, con capturas.",
            "Después de la primera aprobación, los productos nuevos se pueden enviar **solos**, sin un binario nuevo, siempre que la app ya los pueda mostrar (por ejemplo, si lee los IDs de tu servidor o usa `SubscriptionStoreView(groupID:)`, que muestra todo el grupo).",
          ],
          code: src`App Review Information > Notes

Paywall: Ajustes > "Hacete Pro", o al tocar "Exportar PDF".
Login: demo@acme.com / Review2026! (cuenta con datos de ejemplo).
Planes: Pro mensual y Pro anual, con 7 días gratis.
Al suscribirse se desbloquean Exportar PDF y Carpetas (pestaña Notas).
Restaurar compras: abajo del paywall.
Los planes se cargan con StoreKit 2 desde App Store Connect (sandbox).`,
        },
        {
          kind: "predict",
          prompt: "La app ya está aprobada y muestra los planes con `SubscriptionStoreView(groupID:)`. Querés agregar un plan **Pro semestral** al mismo grupo. ¿Qué hacés?",
          code: swift`SubscriptionStoreView(groupID: "21456789")
    .storeButton(.visible, for: .restorePurchases)`,
          options: [
            "Crear el producto, completarlo y enviarlo a review solo, sin nuevo binario",
            "Esperar a la próxima versión: un producto nuevo siempre requiere binario",
            "Crear un grupo nuevo para que no afecte a los actuales",
            "Agregar el ID a un `.storekit` y subir el archivo",
          ],
          answer: 0,
          explanation: "Después de la primera aprobación los productos se envían de forma independiente. Como `SubscriptionStoreView(groupID:)` muestra todos los productos del grupo, el semestral aparece sin tocar código. Si los IDs estuvieran hardcodeados en la app, sí haría falta una versión nueva.",
        },
        {
          kind: "predict",
          prompt: "Rechazo por guideline 3.1.2: \"missing a functional link to the Terms of Use (EULA)\". El paywall ya tiene el link de Privacidad. ¿Qué arreglás?",
          code: src`Guideline 3.1.2 - Business - Payments - Subscriptions
"...missing a functional link to the Terms of Use (EULA)
 in the app binary and in the app metadata."`,
          options: [
            "Solo la descripción del App Store",
            "Solo el binario: un `Link` en el paywall alcanza",
            "Cambiar las suscripciones a no renovables",
            "Las dos cosas: `Link` a Términos en el paywall y el EULA en la metadata (descripción o campo de EULA)",
          ],
          answer: 3,
          explanation: "El mensaje dice \"in the app binary **and** in the app metadata\". Va el link en el paywall (nuevo build) y el EULA en la metadata: el estándar de Apple linkeado en la descripción o uno propio en el campo de EULA. Responder con ambos cambios resuelve el rechazo.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: Notas Pro de punta a punta",
      goal: "Integrar todo el curso: un `StoreManager` completo, un paywall que pasa 3.1.2 y el diagnóstico de dos rechazos reales.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "**Notas Pro** tiene un grupo \"Premium\" con Pro mensual y Pro anual, 7 días gratis y un backend propio. La primera versión con suscripciones fue rechazada dos veces y el equipo cree que hay que \"esperar que aprueben los productos\".",
            "Tu trabajo: escribir el `StoreManager` (cargar, comprar, escuchar updates, entitlements, restaurar), el paywall con `SubscriptionStoreView` y diagnosticar los dos rechazos. Usá los nombres de las lecciones: `ProductID.all`, `checkVerified`, `deliver`.",
          ],
          code: src`Grupo Premium (21456789)
  Nivel 1  com.acme.notes.pro.monthly   7 días gratis
  Nivel 1  com.acme.notes.pro.yearly    7 días gratis

Rechazo 1: 2.1  "unable to locate the in-app purchases" / compra sin efecto
Rechazo 2: 3.1.2 paywall incompleto`,
        },
        {
          kind: "write",
          prompt: "Escribí `StoreManager` (`@MainActor @Observable`): `loadProducts()` con `Product.products(for:)`, `purchase(_:)` que maneje `.success`/`.userCancelled`/`.pending` y termine después de `deliver`, un listener de `Transaction.updates` creado en `init`, `refreshEntitlements()` sobre `Transaction.currentEntitlements` que ignore revocadas, y `restore()` con `AppStore.sync()`.",
          starter: swift`import StoreKit
import Observation

@MainActor
@Observable
final class StoreManager {
    private(set) var products: [Product] = []
    private(set) var isPro = false
    private(set) var isPending = false

    // tu código
}`,
          checks: [
            { pattern: "Product\\.products\\(for:", label: "Carga productos" },
            { pattern: "\\.purchase\\(options:\\s*\\[\\s*\\.appAccountToken\\(", label: "Compra con `appAccountToken`" },
            { pattern: "case\\s+\\.pending", label: "Maneja `.pending`" },
            { pattern: "case\\s+\\.userCancelled", label: "Maneja `.userCancelled`" },
            { pattern: "\\binit\\([\\s\\S]*Transaction\\.updates", label: "Escucha `Transaction.updates` desde `init`" },
            { pattern: "Transaction\\.currentEntitlements", label: "Calcula entitlements" },
            { pattern: "revocationDate\\s*==\\s*nil", label: "Ignora transacciones revocadas" },
            { pattern: "deliver\\([\\s\\S]*\\.finish\\(\\)", label: "`finish()` después de entregar" },
            { pattern: "AppStore\\.sync\\(\\)", label: "Restaurar con `AppStore.sync()`" },
          ],
          warnings: [
            { pattern: "try!", label: "`try!` crashea ante un error de red" },
            { pattern: "verifyReceipt|appStoreReceiptURL", label: "El recibo está deprecado: usá StoreKit 2" },
          ],
          solution: swift`import StoreKit
import Observation

@MainActor
@Observable
final class StoreManager {
    private(set) var products: [Product] = []
    private(set) var isPro = false
    private(set) var isPending = false
    private var updates: Task<Void, Never>?
    private let userToken: UUID

    init(userToken: UUID = UUID()) {
        self.userToken = userToken
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self, let tx = try? self.checkVerified(result) else { continue }
                await self.deliver(tx)
                await tx.finish()
                await self.refreshEntitlements()
            }
        }
    }

    func loadProducts() async {
        products = (try? await Product.products(for: ProductID.all)) ?? []
    }

    func purchase(_ product: Product) async throws {
        let result = try await product.purchase(options: [.appAccountToken(userToken)])
        switch result {
        case .success(let verification):
            let tx = try checkVerified(verification)
            await deliver(tx)
            await tx.finish()
            await refreshEntitlements()
        case .userCancelled:
            break
        case .pending:
            isPending = true
        @unknown default:
            break
        }
    }

    func refreshEntitlements() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            if let tx = try? checkVerified(result), tx.revocationDate == nil,
               ProductID.all.contains(tx.productID) {
                active = true
            }
        }
        isPro = active
        if active { isPending = false }
    }

    func restore() async {
        try? await AppStore.sync()
        await refreshEntitlements()
    }

    func deliver(_ tx: Transaction) async {
        // Avisar al backend / guardar el entitlement
    }

    nonisolated func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        guard case .verified(let value) = result else { throw StoreError.failedVerification }
        return value
    }
}`,
          hint: "Partí del esqueleto de la lección de StoreKit 2: `init` con el `Task` de updates, después `loadProducts`, `purchase`, `refreshEntitlements` y `restore`.",
        },
        {
          kind: "write",
          prompt: "Escribí `PaywallView` con `SubscriptionStoreView(groupID: \"21456789\")`, botón visible de restaurar y destinos de política para Términos (`.termsOfService`) y Privacidad (`.privacyPolicy`).",
          starter: swift`struct PaywallView: View {
    let termsURL: URL
    let privacyURL: URL

    var body: some View {
        // tu código
        EmptyView()
    }
}`,
          checks: [
            { pattern: "SubscriptionStoreView\\(groupID:\\s*\"21456789\"", label: "Usa `SubscriptionStoreView` con el grupo" },
            { pattern: "\\.storeButton\\(\\.visible,\\s*for:\\s*\\.restorePurchases\\)", label: "Botón de restaurar visible" },
            { pattern: "subscriptionStorePolicyDestination\\(url:\\s*termsURL,\\s*for:\\s*\\.termsOfService\\)", label: "Link a Términos" },
            { pattern: "subscriptionStorePolicyDestination\\(url:\\s*privacyURL,\\s*for:\\s*\\.privacyPolicy\\)", label: "Link a Privacidad" },
          ],
          warnings: [
            { pattern: "EmptyView\\(\\)", label: "Quedó el `EmptyView()` del starter" },
          ],
          solution: swift`struct PaywallView: View {
    let termsURL: URL
    let privacyURL: URL

    var body: some View {
        SubscriptionStoreView(groupID: "21456789") {
            VStack {
                Image(systemName: "note.text")
                Text("Notas Pro: carpetas, sync y PDF")
            }
        }
        .storeButton(.visible, for: .restorePurchases)
        .subscriptionStorePolicyDestination(url: termsURL, for: .termsOfService)
        .subscriptionStorePolicyDestination(url: privacyURL, for: .privacyPolicy)
    }
}`,
          hint: "Encadená `.storeButton(.visible, for: .restorePurchases)` y dos `.subscriptionStorePolicyDestination(url:for:)`.",
        },
        {
          kind: "predict",
          prompt: "Rechazo 1. El reviewer pudo comprar (la hoja de pago apareció y confirmó), pero lo exportado sigue bloqueado. Los logs del backend dicen esto. ¿Qué arreglás?",
          code: src`POST /iap/transactions  400  "verification failed: INVALID_ENVIRONMENT"
  bundleId=com.acme.notes  environment=Sandbox  build=1.0 (42) App Store`,
          options: [
            "Pedir que aprueben los productos antes de volver a enviar",
            "Cambiar los Product IDs porque el reviewer no los encuentra",
            "Que el backend, si falla con producción, verifique con el entorno sandbox y dé acceso marcando la compra como de prueba",
            "Hacer que la app no mande la transacción al backend en builds de App Store",
          ],
          answer: 2,
          explanation: "Los productos cargaron y la compra se hizo: no es un problema de aprobación ni de IDs. El backend solo verifica con producción y la compra del reviewer es sandbox. Con el fallback a sandbox (y guardando `environment`), el reviewer recibe lo que compró. Saltear el backend rompe tu fuente de verdad.",
        },
        {
          kind: "predict",
          prompt: "Rechazo 2 (3.1.2). Este es el paywall actual. ¿Qué cambio lo hace aprobable?",
          code: src`[  PROBÁ GRATIS  ]                (botón enorme)
Desbloqueá todo Notas Pro
                                  (texto gris de 9 pt, abajo de todo:)
                                  "luego se aplica el precio vigente"`,
          options: [
            "Sacar la prueba gratis y volver a enviar",
            "Mostrar plan, duración y precio completo bien visibles (\"7 días gratis, después $X por mes\"), Restaurar, Términos y Privacidad",
            "Agregar una alerta de confirmación antes de la hoja de pago",
            "Explicar en las notas del reviewer que el precio está en el App Store",
          ],
          answer: 1,
          explanation: "3.1.2 pide que el usuario sepa qué compra antes de pagar: nombre y duración del plan, precio que se cobra, qué pasa al terminar la prueba, Restaurar y links a Términos y Privacidad. La prueba no puede opacar el precio. No hace falta sacar la oferta ni agregar diálogos extra.",
        },
      ],
    },
  ],

  // ───────────────────────────────────────────────────────────────
  flashcards: [
    {
      id: "fc-product-types",
      front: "¿Cuáles son los cuatro tipos de compra in-app?",
      back: "Consumible (se gasta, lo acredita tu backend), no consumible (para siempre, se restaura), suscripción autorrenovable (en un grupo, una activa por grupo) y suscripción no renovable (tiempo fijo, el vencimiento lo calcula tu backend).",
    },
    {
      id: "fc-group-levels",
      front: "¿Para qué sirven los niveles dentro de un grupo de suscripción?",
      back: "Definen upgrade y downgrade. El nivel 1 es el de más valor. Subir de nivel es inmediato con reembolso prorrateado; bajar se aplica en la próxima renovación; mismo nivel es crossgrade.",
    },
    {
      id: "fc-empty-products",
      front: "`Product.products(for:)` devuelve `[]` sin error. ¿Qué revisás?",
      back: "Paid Apps agreement activo con banco e impuestos completos (causa número 1), IDs idénticos a App Store Connect, productos creados y, en local, que el esquema tenga el `.storekit` correcto.",
      code: "let products = try await Product.products(for: ProductID.all)\nif products.isEmpty { /* error + Reintentar */ }",
    },
    {
      id: "fc-purchase-results",
      front: "¿Qué tres resultados devuelve `product.purchase()`?",
      back: "`.success(VerificationResult<Transaction>)` (verificar, entregar, `finish()`), `.userCancelled` (no es error) y `.pending` (Ask to Buy o SCA: llega después por `Transaction.updates`).",
    },
    {
      id: "fc-finish",
      front: "¿Cuándo se llama a `transaction.finish()`?",
      back: "Después de entregar el contenido (guardar el entitlement, acreditar en el backend). Si terminás antes y la entrega falla, el usuario pagó y no recibió nada.",
    },
    {
      id: "fc-updates",
      front: "¿Por qué escuchar `Transaction.updates` desde el arranque?",
      back: "Porque llegan renovaciones, Ask to Buy aprobados, compras de otro dispositivo, reembolsos y transacciones sin terminar aunque nadie toque tu botón de compra.",
    },
    {
      id: "fc-restore",
      front: "¿Qué hace el botón Restaurar compras con StoreKit 2?",
      back: "Llama a `AppStore.sync()` y recalcula los entitlements. Es obligatorio para review y solo se llama cuando el usuario lo toca, porque puede pedir login.",
    },
    {
      id: "fc-grace-retry",
      front: "¿Diferencia entre `.inGracePeriod` y `.inBillingRetryPeriod`?",
      back: "En los dos el cobro falló y Apple reintenta. En gracia (si la activaste en App Store Connect) el usuario conserva el acceso; en billing retry no, y conviene mostrar \"actualizá tu medio de pago\".",
    },
    {
      id: "fc-intro-eligibility",
      front: "¿Cuántas ofertas introductorias puede usar un usuario?",
      back: "Una por grupo de suscripción. Chequeá `isEligibleForIntroOffer` antes de mostrar \"prueba gratis\".",
      code: "let eligible = await product.subscription?.isEligibleForIntroOffer ?? false",
    },
    {
      id: "fc-offers",
      front: "Promocional, código de oferta y win-back: ¿cuándo cada una?",
      back: "Promocional: retener o recuperar suscriptores, firmada por tu servidor. Código de oferta: campañas y soporte, se canjea en App Store o en la app. Win-back (iOS 18): ex suscriptores, la muestra Apple y StoreKit.",
    },
    {
      id: "fc-test-tiers",
      front: "¿Qué necesita cada nivel de prueba?",
      back: "`.storekit`: nada externo. Sandbox: productos en App Store Connect, Paid Apps agreement y cuenta de sandbox. TestFlight: lo mismo (también sandbox, sin cargo). Producción: aprobación; los productos pueden tardar hasta una hora.",
    },
    {
      id: "fc-review-sandbox",
      front: "¿Con qué entorno compra el reviewer de App Review?",
      back: "Sandbox, sobre tu build de producción. Los productos no necesitan estar aprobados para cargar; tu backend tiene que aceptar transacciones sandbox.",
    },
    {
      id: "fc-notifications",
      front: "Notificaciones V2 que no pueden faltar en tu backend",
      back: "`SUBSCRIBED`, `DID_RENEW`, `DID_FAIL_TO_RENEW`, `GRACE_PERIOD_EXPIRED`, `EXPIRED`, `DID_CHANGE_RENEWAL_STATUS` y `REFUND`. Dos URLs (producción y sandbox), responder 200 y deduplicar por `notificationUUID`.",
    },
    {
      id: "fc-app-account-token",
      front: "¿Para qué sirve `appAccountToken`?",
      back: "Es un UUID tuyo por usuario que pasás en `purchase(options:)`. Vuelve en transacciones y notificaciones, así tu backend sabe a qué cuenta corresponde cada compra.",
      code: "try await product.purchase(options: [.appAccountToken(user.storeToken)])",
    },
    {
      id: "fc-commission",
      front: "¿Cuánto se queda Apple?",
      back: "30% estándar; 15% en el Small Business Program (menos de USD 1M al año) y en suscripciones después del primer año del suscriptor. Bienes físicos y servicios fuera de la app no usan IAP. Las reglas de links externos cambian por región: verificá las guidelines vigentes.",
    },
  ],

  // ───────────────────────────────────────────────────────────────
  exam: [
    {
      id: "ex-empty-paywall",
      question: "Primer envío con suscripciones. En TestFlight el paywall carga bien para el equipo, pero hace una semana el Account Holder cambió el banco y el Paid Apps agreement quedó en \"Pending\". El reviewer reporta que no encuentra las compras. ¿Qué pasó?",
      options: [
        "Los productos tienen que estar aprobados antes de que el reviewer los vea",
        "Con el acuerdo pendiente `Product.products(for:)` devuelve vacío para todos, también para el reviewer",
        "El reviewer usa producción y los productos solo existen en sandbox",
        "TestFlight usa otra base de productos que App Review",
      ],
      answer: 1,
      explanation: "El acuerdo activo es requisito para que StoreKit devuelva productos, en sandbox y en producción. Al quedar pendiente, la app deja de recibir productos sin error. Se arregla completando el acuerdo, y la app debería mostrar error con reintento.",
    },
    {
      id: "ex-hardcoded-price",
      question: "Un usuario de México se queja de que el paywall dice \"USD 4.99\" pero la hoja de pago le cobra en pesos. ¿Cuál es el arreglo?",
      code: "Text(\"Pro mensual: USD 4.99\")",
      options: [
        "Agregar un switch por país con el precio en cada moneda",
        "Convertir USD con una API de tipo de cambio",
        "Poner el precio en la descripción del producto en App Store Connect",
        "Mostrar `product.displayPrice`, que viene formateado en la moneda del storefront del usuario",
      ],
      answer: 3,
      explanation: "`displayPrice` refleja el precio real del storefront y se actualiza solo si cambiás precios. Las tablas propias o conversiones se desincronizan y además pueden violar 3.1.2 por mostrar un precio distinto del cobrado.",
    },
    {
      id: "ex-finish-early",
      question: "Este código vende monedas (consumible). Soporte recibe quejas: \"pagué y no me llegaron las monedas\", casi siempre con mala red. ¿Cuál es el bug?",
      code: "let tx = try checkVerified(verification)\nawait tx.finish()\ntry await api.creditCoins(tx.id)",
      options: [
        "`finish()` va antes de acreditar: si el backend falla, la transacción ya terminó y no se reintenta",
        "Falta `AppStore.sync()` después de comprar",
        "Los consumibles no se pueden verificar",
        "Hay que usar `Transaction.all` en vez de `checkVerified`",
      ],
      answer: 0,
      explanation: "Una transacción sin terminar vuelve en `Transaction.updates` y te deja reintentar la entrega. Al terminarla antes, si `creditCoins` falla, la compra queda cobrada y perdida. Primero acreditar, después `finish()`.",
    },
    {
      id: "ex-consumable-restore",
      question: "Un usuario reinstala la app y toca Restaurar. Tenía un no consumible \"Sin anuncios\" y había comprado 500 monedas. ¿Qué recupera por StoreKit?",
      options: [
        "Las dos cosas",
        "Nada: restaurar solo funciona con suscripciones",
        "\"Sin anuncios\"; las monedas las tiene que conservar tu backend",
        "Solo las monedas, porque son la última compra",
      ],
      answer: 2,
      explanation: "Los no consumibles aparecen en `Transaction.currentEntitlements` y se restauran. Los consumibles no: una vez terminados, el saldo es responsabilidad de tu backend atado a la cuenta del usuario.",
    },
    {
      id: "ex-downgrade",
      question: "Un suscriptor del plan Familia (nivel 1, mensual) elige Individual (nivel 2, mensual) el día 5. ¿Qué tiene que mostrar la app?",
      options: [
        "Individual desde ahora y un reembolso prorrateado",
        "Familia hasta la próxima renovación; ahí empieza Individual",
        "Las dos suscripciones hasta fin de mes",
        "Un error: no se puede bajar de nivel",
      ],
      answer: 1,
      explanation: "Ir a un nivel más bajo es un downgrade: se aplica en la próxima renovación. Hasta entonces sigue Familia; `renewalInfo.autoRenewPreference` muestra el producto que viene, útil para avisarle.",
    },
    {
      id: "ex-billing-retry",
      question: "Activaste Billing Grace Period. A una usuaria le rechazan la tarjeta en la renovación. ¿Qué secuencia de estados ves si no actualiza el pago?",
      options: [
        "`.inGracePeriod` (con acceso) → `.inBillingRetryPeriod` (sin acceso) → `.expired`",
        "`.expired` inmediatamente",
        "`.revoked` → `.expired`",
        "`.inBillingRetryPeriod` (con acceso) → `.inGracePeriod` (sin acceso)",
      ],
      answer: 0,
      explanation: "Primero la gracia mantiene el acceso mientras Apple reintenta. Si vence la gracia (`GRACE_PERIOD_EXPIRED` en el servidor) sigue en billing retry sin acceso, y si los reintentos fallan termina `.expired`. `.revoked` es reembolso o Family Sharing.",
    },
    {
      id: "ex-intro-offer",
      question: "El paywall muestra \"7 días gratis\" a todos. Un usuario que ya usó la prueba en otro plan del mismo grupo toca el botón y la hoja de pago le cobra el precio completo. ¿Cómo evitás la queja?",
      options: [
        "Crear un grupo nuevo para cada plan",
        "Mostrar siempre el precio completo y nunca la prueba",
        "Darle un reembolso automático",
        "Chequear `isEligibleForIntroOffer` y mostrar la prueba solo si es `true`",
      ],
      answer: 3,
      explanation: "La oferta introductoria es una por grupo. `isEligibleForIntroOffer` dice si aplica a este usuario; si no, el CTA muestra el precio. Prometer una prueba que no se aplica además arriesga un rechazo por 3.1.2.",
    },
    {
      id: "ex-ci-ask-to-buy",
      question: "Querés un test de CI que verifique que con Ask to Buy la app muestra \"esperando aprobación\" sin desbloquear Pro. ¿Cómo?",
      options: [
        "Con una cuenta de sandbox de un menor en un dispositivo del CI",
        "En TestFlight, pidiendo a un tester que active Ask to Buy",
        "`SKTestSession` con el `.storekit`, `disableDialogs = true` y `askToBuyEnabled = true`, y verificar `isPending` y `!isPro`",
        "Con un mock de `Product` que devuelva `.pending`",
      ],
      answer: 2,
      explanation: "`SKTestSession` controla el entorno local de StoreKit desde un test, sin UI ni cuentas. `Product` no se puede instanciar a mano, y sandbox o TestFlight requieren personas.",
    },
    {
      id: "ex-backend-sandbox",
      question: "Para \"evitar fraude\", el backend rechaza toda transacción con `environment` distinto de `\"Production\"`. ¿Qué va a pasar en el próximo envío a review?",
      options: [
        "Nada: el reviewer compra en producción",
        "El reviewer compra en sandbox, el backend rechaza y la compra no desbloquea nada: rechazo",
        "Apple aprueba igual porque la hoja de pago funcionó",
        "La app no compila en modo Release",
      ],
      answer: 1,
      explanation: "El reviewer usa tu build de producción con compras sandbox. El backend tiene que verificar la firma en el entorno correcto y aceptar sandbox (marcándolo), no rechazarlo. La verificación de firma ya es la defensa contra fraude.",
    },
    {
      id: "ex-verify-receipt",
      question: "Heredaste un backend que valida con `verifyReceipt` mandando el recibo base64 de la app. ¿Cuál es la migración recomendada?",
      options: [
        "La app manda `jwsRepresentation`, el servidor lo verifica con App Store Server Library y procesa Server Notifications V2",
        "Mantener `verifyReceipt` y sumar una segunda llamada para sandbox",
        "Decodificar el JWS con base64 sin verificar, porque viene de Apple",
        "Mover toda la lógica al cliente con `currentEntitlements` y apagar el backend",
      ],
      answer: 0,
      explanation: "`verifyReceipt` está deprecado. El modelo actual: transacciones JWS verificadas con la librería oficial, notificaciones V2 y la App Store Server API. Decodificar sin verificar la firma es aceptar datos falsificables.",
    },
    {
      id: "ex-refund-access",
      question: "Un usuario pidió reembolso de su suscripción anual y sigue usando Pro en la app y en la web. ¿Qué falta?",
      options: [
        "Llamar a `AppStore.sync()` en cada arranque",
        "Pedir a Apple que cancele la cuenta del usuario",
        "Nada: después de un reembolso el acceso se mantiene hasta fin de año",
        "Procesar la notificación `REFUND` en el servidor y, en la app, quitar acceso a transacciones con `revocationDate`",
      ],
      answer: 3,
      explanation: "El reembolso llega como `REFUND` al servidor y como transacción con `revocationDate` por `Transaction.updates`. Si ninguno de los dos caminos lo procesa, el acceso queda. `AppStore.sync()` automático pide login y no resuelve el backend.",
    },
    {
      id: "ex-paywall-312",
      question: "¿Cuál de estos paywalls de suscripción anual cumple la guideline 3.1.2?",
      options: [
        "\"Desbloqueá todo\" con un botón \"Continuar\"; el precio aparece en la hoja de pago",
        "\"Solo USD 0.83 por mes\" grande; el cobro anual no aparece",
        "\"Pro anual: 7 días gratis, después USD 9.99 por año, se renueva automáticamente\", Restaurar, Términos y Privacidad",
        "Precio y plan claros, pero Términos y Privacidad solo en la web de la empresa",
      ],
      answer: 2,
      explanation: "Tiene que verse el plan y duración, el precio que se cobra, qué pasa después de la prueba, Restaurar y links a Términos (EULA) y Privacidad en la app. Mostrar solo el equivalente mensual de un plan anual oculta el cobro real.",
    },
    {
      id: "ex-new-product",
      question: "La app ya está aprobada y lee los Product IDs de un endpoint de tu backend. Querés lanzar un plan anual nuevo. ¿Qué hacés?",
      options: [
        "Crear el producto, completar metadata y captura, enviarlo a review solo y agregar el ID al endpoint cuando se apruebe",
        "Subir una versión nueva de la app con el ID nuevo",
        "Esperar a que Apple lo apruebe automáticamente sin enviarlo",
        "Crear el producto en un `.storekit` y publicarlo",
      ],
      answer: 0,
      explanation: "Después de la primera aprobación, los productos se envían por separado si la app ya los puede mostrar. Como los IDs vienen del backend, no hace falta binario. Para probar antes de aprobar, sandbox y TestFlight.",
    },
    {
      id: "ex-physical-goods",
      question: "Una app de delivery quiere cobrar los pedidos de comida dentro de la app. ¿Qué usás?",
      options: [
        "Un consumible de StoreKit por pedido",
        "Una suscripción no renovable",
        "Códigos de oferta",
        "Un procesador externo (Stripe, Apple Pay): son bienes y servicios consumidos fuera de la app",
      ],
      answer: 3,
      explanation: "IAP es para contenido y servicios digitales usados en la app. Bienes físicos y servicios del mundo real (comida, viajes, entradas) se cobran con medios externos o Apple Pay, sin comisión de Apple.",
    },
    {
      id: "ex-paid-to-freemium",
      question: "Tu app era paga hasta el build 120; desde el 121 es gratis con suscripción. ¿Cómo reconocés a los que la compraron?",
      code: "let result = try await AppTransaction.shared",
      options: [
        "Con la fecha de la primera transacción en `currentEntitlements`",
        "Con `originalAppVersion` de `AppTransaction` verificado: si el build original es menor a 121, tiene Pro",
        "Pidiendo el recibo de compra por email",
        "Con `CFBundleShortVersionString` de la versión instalada",
      ],
      answer: 1,
      explanation: "`AppTransaction` dice con qué build (`CFBundleVersion`) obtuvo la app por primera vez, firmado por Apple. La versión instalada no sirve: todos actualizaron. En sandbox `originalAppVersion` es siempre `\"1.0\"`.",
    },
  ],
};

export default content;
