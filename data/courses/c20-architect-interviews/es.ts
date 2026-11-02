import type { CourseContent } from "../types";

// Código literal: String.raw conserva `\(...)` y `\n` tal cual.
const swift = String.raw;
const md = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "mobile-system-design",
      title: "System design mobile: un framework repetible",
      goal: "Responder cualquier pregunta de diseño mobile con el mismo recorrido: requisitos, contrato, datos, capas, cache, sync, errores y trade-offs.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "El mismo recorrido para cualquier app",
          body: [
            "En una entrevista de system design mobile no te evalúan por llegar al diagrama 'correcto': te evalúan por **cómo ordenás el problema**. Tené un recorrido fijo y usalo siempre, en voz alta. Así no te olvidás de nada aunque estés nervioso.",
            "Los primeros 5 minutos son requisitos: qué hace la feature (funcionales), cuánta gente la usa, si tiene que andar offline, qué latencia se espera (no funcionales). Después contrato de API, modelo de datos, capas de la app, cache y offline, sync, paginación, errores, seguridad y observabilidad.",
            "Cerrá siempre con **trade-offs**: qué elegiste, qué descartaste y por qué. Un senior dice 'elijo cursor en vez de offset porque el feed cambia mientras scrolleás; el costo es que no puedo saltar a la página 7'.",
          ],
          code: md`System design mobile: checklist (45 min)
 1. Requisitos       funcionales, no funcionales, escala, offline   ~5 min
 2. Contrato de API  endpoints, paginación, formato de errores
 3. Modelo de datos  entidades, ids, qué se persiste en disco
 4. Capas            View → ViewModel → Repository → API / DB
 5. Cache y offline  fuente de verdad, invalidación, TTL
 6. Sync             outbox, reintentos, conflictos, orden
 7. Errores          red, 401, 5xx, timeouts, estados de pantalla
 8. Seguridad        tokens en Keychain, TLS, datos sensibles
 9. Observabilidad   logs, métricas, crash-free, trazas de red
10. Trade-offs       qué elegiste, qué descartaste y por qué`,
        },
        {
          kind: "predict",
          prompt: "El entrevistador dice: 'Diseñá un feed tipo Instagram'. ¿Cuál es tu primer movimiento?",
          code: md`Entrevistador: "Diseñá un feed tipo Instagram para iOS."
Vos: ...`,
          options: [
            "Dibujar el diagrama de clases de `FeedViewController` con todas sus dependencias",
            "Elegir la arquitectura (MVVM, TCA o VIPER) y justificarla",
            "Preguntar requisitos: ¿solo lectura o también publicar?, ¿offline?, ¿video?, ¿cuántos usuarios y posts por página?",
            "Escribir el `Codable` de `Post` para mostrar que sabés Swift",
          ],
          answer: 2,
          explanation: "Sin requisitos cualquier diseño es una apuesta. Preguntar si hay offline, video o publicación cambia el cache, la paginación y la sync. Elegir arquitectura o escribir código antes de saber qué se construye es la señal más clara de alguien que todavía no diseña sistemas.",
        },
        {
          kind: "explain",
          title: "Feed: contrato, datos y capas",
          body: [
            "Para un feed, la paginación por **cursor** es la opción por defecto: el servidor devuelve un token opaco que apunta 'después de este post'. Con offset (`page=2`), si entran posts nuevos arriba mientras scrolleás, la página 2 se corre y ves duplicados.",
            "La app tiene capas claras: la vista observa un view model, el view model habla con un **repository**, y el repository decide si responde desde disco o desde red. Para arranque rápido usá *stale-while-revalidate*: mostrás lo cacheado al instante y refrescás en segundo plano.",
            "Las imágenes van aparte: cache en memoria (`NSCache`) más cache en disco, descarga con prioridad para las celdas visibles y cancelación cuando la celda sale de pantalla.",
          ],
          code: swift`// GET /v1/feed?cursor=abc123&limit=20
struct FeedPage: Decodable {
    let items: [Post]
    let nextCursor: String?   // nil = no hay más páginas
}

struct Post: Decodable, Identifiable {
    let id: String
    let author: Author
    let imageURL: URL
    let likeCount: Int
    let createdAt: Date
}

protocol FeedRepository: Sendable {
    func cachedFeed() async -> [Post]                               // disco, instantáneo
    func fetchPage(after cursor: String?) async throws -> FeedPage   // red
}`,
        },
        {
          kind: "predict",
          prompt: "La app pide páginas por offset de 10 posts. El usuario ya vio la página 1 (posts 50 a 41). Antes de pedir la página 2, se publican 3 posts nuevos. ¿Qué ve?",
          code: md`GET /feed?offset=0&limit=10   → posts 50..41
   (se publican los posts 51, 52 y 53)
GET /feed?offset=10&limit=10  → ?`,
          options: [
            "Los posts 40 a 31, sin problemas",
            "Los posts 43 a 34: repite 43, 42 y 41, que ya había visto",
            "Los posts 53 a 44, porque el offset se recalcula solo",
            "Un error 409 porque el feed cambió",
          ],
          answer: 1,
          explanation: "Con los 3 nuevos, el feed ordenado es 53..1. El offset 10 empieza en el 11º elemento: 53, 52, 51, 50, 49, 48, 47, 46, 45, 44 son los primeros 10, así que la página 2 arranca en 43. Se repiten 43, 42 y 41. Un cursor ('después del post 41') no tiene este problema.",
        },
        {
          kind: "fill",
          prompt: "Completá el tipo de `nextCursor` para que la última página pueda decir 'no hay más'.",
          code: swift`struct FeedPage: Decodable {
    let items: [Post]
    let nextCursor: ____
}`,
          accept: ["^String\\?$", "^Optional<String>$"],
          explanation: "Un `String?` modela las dos situaciones: hay un cursor para la siguiente página, o `nil` porque llegaste al final. Con un `String` no opcional terminás inventando valores mágicos como `\"\"`.",
          hint: "Un string que puede no estar.",
          placeholder: "String…",
        },
        {
          kind: "explain",
          title: "Chat con soporte offline: outbox e idempotencia",
          body: [
            "En un chat offline la **base local es la fuente de verdad**: la UI siempre lee de disco, y la red solo actualiza disco. Cuando el usuario manda un mensaje, lo guardás en una tabla *outbox* con estado `pending` y lo mostrás enseguida con un reloj.",
            "Un proceso de sync vacía el outbox cuando hay conexión. Cada mensaje lleva un **id generado en el cliente** (`UUID`): si la respuesta del servidor se pierde y reintentás, el servidor reconoce el id y no crea un duplicado. Eso es una clave de idempotencia.",
            "El orden lo define el servidor (un número de secuencia por conversación), no el reloj del teléfono, que puede estar mal. Para recibir en tiempo real, WebSocket mientras la app está abierta y push cuando está cerrada; al reconectar pedís 'todo después de la secuencia N'.",
          ],
          code: swift`enum DeliveryStatus: String, Codable {
    case pending, sent, failed
}

struct OutgoingMessage: Codable, Identifiable {
    let id: UUID              // generado en el cliente = clave de idempotencia
    let conversationID: String
    let text: String
    var status: DeliveryStatus
    var attempts: Int
}

// POST /v1/conversations/{id}/messages
// { "clientMessageId": "6F1C…", "text": "Hola" }
// → 201 { "serverSeq": 1042 }  (o 200 con el mismo serverSeq si ya existía)`,
        },
        {
          kind: "predict",
          prompt: "El cliente manda un mensaje, el servidor lo guarda, pero la respuesta se pierde por un corte de red. El outbox reintenta. ¿Qué evita que el chat muestre el mensaje dos veces?",
          code: swift`// Reintento del outbox
try await api.send(
    conversationID: message.conversationID,
    clientMessageID: message.id,   // mismo UUID que el primer intento
    text: message.text
)`,
          options: [
            "Que `URLSession` no reintenta requests `POST`",
            "Que el servidor ordena por fecha y descarta mensajes con el mismo texto",
            "Que el outbox espera 30 segundos antes de reintentar",
            "Que el `clientMessageID` es el mismo: el servidor ve que ya existe y devuelve el registro original en vez de crear otro",
          ],
          answer: 3,
          explanation: "La idempotencia la da el id generado en el cliente, que no cambia entre reintentos. Descartar por texto rompe el caso legítimo de mandar 'ok' dos veces, y esperar más no evita el duplicado: solo lo demora.",
        },
        {
          kind: "write",
          prompt: "Modelá el mensaje saliente del outbox: un `enum DeliveryStatus` con `pending`, `sent` y `failed`, y un `struct OutgoingMessage` con `id: UUID`, `text`, `status` y `attempts`. Agregá un método `mutating func markFailed()` que sume un intento y pase a `failed`.",
          starter: swift`struct OutgoingMessage {
    let text: String
}`,
          checks: [
            { pattern: "enum\\s+DeliveryStatus", label: "Declara `enum DeliveryStatus`" },
            { pattern: "case\\s+[^\\n]*pending", label: "Tiene el caso `pending`" },
            { pattern: "case\\s+[^\\n]*failed", label: "Tiene el caso `failed`" },
            { pattern: "let\\s+id\\s*:\\s*UUID", label: "El id es un `UUID` inmutable generado en el cliente" },
            { pattern: "mutating\\s+func\\s+markFailed\\(\\)", label: "Declara `mutating func markFailed()`" },
            { pattern: "attempts\\s*\\+=\\s*1", label: "Suma un intento" },
          ],
          warnings: [
            { pattern: "var\\s+id\\s*:", label: "El id no debería cambiar entre reintentos: usá `let`" },
            { pattern: "class\\s+OutgoingMessage", label: "Es un valor: preferí `struct`" },
          ],
          solution: swift`enum DeliveryStatus: String, Codable {
    case pending, sent, failed
}

struct OutgoingMessage: Codable, Identifiable {
    let id: UUID
    let text: String
    var status: DeliveryStatus = .pending
    var attempts = 0

    mutating func markFailed() {
        attempts += 1
        status = .failed
    }
}`,
          hint: "`status` y `attempts` son `var` porque cambian; `id` y `text` no.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "decisions-in-writing",
      title: "Decisiones por escrito: ADRs, RFCs y deuda técnica",
      goal: "Documentar una decisión con un ADR, proponer un cambio grande con rollout y rollback, y priorizar deuda técnica con datos.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "ADR: la decisión y su porqué",
          body: [
            "Un **ADR** (Architecture Decision Record) es un archivo corto en el repo, numerado, que registra una decisión: **contexto** (qué problema y qué restricciones), **decisión** (qué elegimos) y **consecuencias** (qué ganamos y qué pagamos). Vive en `docs/adr/` y se revisa en un PR como cualquier código.",
            "Las consecuencias tienen que incluir los costos. 'Los tests son más fáciles' solo es marketing; 'cada pantalla nueva necesita un coordinator, más boilerplate' es honesto y le sirve a quien lo lea en dos años.",
            "Un ADR no se edita para cambiar de opinión: se escribe uno nuevo que lo **reemplaza** (`Superseded by ADR-019`). Así queda la historia de por qué el código es como es.",
          ],
          code: md`# ADR-007: Navegación con Coordinators en la app UIKit

## Estado
Aceptado (2026-03-14)

## Contexto
Los view controllers hacen push de otros VCs directamente. El flujo de
checkout se reusa desde el carrito y desde el deep link de promociones,
y hoy está duplicado. No podemos testear la navegación.

## Decisión
Cada flujo tiene un Coordinator dueño del UINavigationController.
Los VCs emiten eventos por closures; el coordinator decide a dónde ir.

## Consecuencias
+ Checkout se arma una sola vez y se lanza desde cualquier origen.
+ La navegación se testea sin UIKit con un router fake.
- Más tipos por flujo (coordinator + factory).
- Hay que migrar 14 pantallas; lo hacemos flujo por flujo.`,
        },
        {
          kind: "predict",
          prompt: "Hace dos años el ADR-007 eligió Coordinators. Hoy la app es 90% SwiftUI y el equipo quiere `NavigationStack` con un router. ¿Qué hacés con el ADR-007?",
          code: md`docs/adr/
  ADR-007-coordinators.md     Estado: Aceptado
  ...
  ADR-018-swift-data.md       Estado: Aceptado`,
          options: [
            "Editás el ADR-007 para que diga `NavigationStack`, así queda al día",
            "Lo borrás del repo: ya no aplica",
            "No hacés nada: los ADRs son históricos y no se tocan nunca",
            "Escribís el ADR-019 con el nuevo contexto y decisión, y marcás el ADR-007 como `Superseded by ADR-019`",
          ],
          answer: 3,
          explanation: "Un ADR nuevo explica qué cambió (SwiftUI, `NavigationStack`) y por qué. El viejo queda con su estado actualizado apuntando al nuevo. Editar o borrar destruye la historia; no hacer nada deja a la gente leyendo una decisión vigente que ya no lo es.",
        },
        {
          kind: "explain",
          title: "RFC / tech spec: opciones, rollout y rollback",
          body: [
            "Para un cambio grande (reescribir la capa de red, migrar a SwiftData) escribís un **RFC** o tech spec antes del código. Estructura: problema y por qué ahora, objetivos y no-objetivos, **opciones** con sus trade-offs, propuesta, plan de **rollout** y plan de **rollback**.",
            "En mobile el rollback es especial: no podés 'deshacer' un binario que ya está en los teléfonos. Por eso el cambio va detrás de un **feature flag** remoto y se prende por porcentajes mirando métricas. El rollback es apagar el flag, no sacar una versión nueva.",
            "Definí de antemano qué métrica dispara el rollback (crash-free, tasa de error, conversión). Si no lo escribís antes, en el incidente se discute en vez de actuar.",
          ],
          code: md`# RFC: Nueva capa de red con async/await

## Problema
3 clientes HTTP distintos, reintentos inconsistentes, 0 tests.

## Opciones
A. Seguir con Alamofire + wrappers   (bajo costo, no unifica)
B. Cliente propio sobre URLSession   (elegida: control total, testeable)
C. Cliente generado por OpenAPI      (bueno, pero el backend no tiene spec)

## Rollout
Flag remoto new_networking: 1% → 10% → 50% → 100%, una semana por paso.
Avanzar si crash-free >= 99.8% y errores de red <= baseline + 0.5%.

## Rollback
Apagar new_networking desde la consola. El cliente viejo sigue en el
binario hasta 2 releases después del 100%.`,
        },
        {
          kind: "fill",
          prompt: "Completá el título de la sección que explica cómo volver atrás si el cambio sale mal.",
          code: md`## Rollout
Flag remoto: 1% → 10% → 50% → 100%

## ____
Apagar el flag desde la consola.`,
          accept: ["^rollback$", "^plan de rollback$", "^rollback plan$"],
          explanation: "La sección de **rollback** dice cómo se vuelve atrás y quién lo decide. En mobile casi siempre es apagar un flag remoto, porque no podés retirar un binario instalado.",
          hint: "Lo opuesto a rollout.",
        },
        {
          kind: "explain",
          title: "Elegir arquitectura, inventariar deuda y medir con DORA",
          body: [
            "No hay arquitectura ganadora: hay contexto. Un equipo de 3 con una app chica rinde con MVVM y buenos protocolos; 40 devs en 6 equipos necesitan módulos con límites claros; un dominio con muchos estados y efectos puede justificar TCA. Decí qué **problema** resuelve cada pieza que agregás.",
            "La deuda técnica se gestiona como un backlog: cada ítem con su **impacto** (crashes, horas perdidas, bugs) y su **costo**. Atacá primero lo de alto impacto y bajo costo. Las migraciones grandes van por etapas (patrón *strangler*): lo nuevo convive con lo viejo y se mueve una pantalla o un módulo por vez.",
            "Las métricas **DORA** miden la salud de entrega: frecuencia de deploy, lead time de cambios (commit → producción), tasa de fallos por cambio y tiempo de recuperación. Sirven para mostrar con números que pagar deuda acelera al equipo.",
          ],
          code: md`| Deuda                              | Impacto                    | Costo  | Prioridad |
|------------------------------------|----------------------------|--------|-----------|
| Singleton de red sin protocolo     | 0 tests en 12 pantallas    | 3 días | Alta      |
| Core Data en el main thread        | 0.4% de hangs en el feed   | 1 sem  | Alta      |
| Storyboard gigante de settings     | conflictos de merge        | 2 días | Media     |
| Pods viejos sin mantenimiento      | bloquea Xcode nuevo        | 1 día  | Alta      |

DORA (trimestre)
  Deploy frequency       1 release cada 2 semanas
  Lead time for changes  6 días (commit → App Store)
  Change failure rate    18% de releases con hotfix
  Time to restore        2 días (flag) / 5 días (binario)`,
        },
        {
          kind: "predict",
          prompt: "Startup con 3 devs iOS, app de reservas de 15 pantallas, quieren salir en 3 meses y testear la lógica de negocio. ¿Qué arquitectura defendés?",
          code: md`Equipo: 3 iOS (1 senior, 2 semi-senior)
App: 15 pantallas, SwiftUI, iOS 17+
Plazo: 3 meses
Pedido: lógica testeable, poco boilerplate`,
          options: [
            "MVVM con `@Observable`, servicios detrás de protocolos inyectados y un router simple para la navegación",
            "VIPER completo en cada pantalla para que escale a 50 devs",
            "TCA en toda la app porque es lo más testeable",
            "Todo en las vistas de SwiftUI; la arquitectura se agrega después",
          ],
          answer: 0,
          explanation: "MVVM con dependencias inyectadas da tests de lógica con muy poco boilerplate, que es lo que piden 3 devs con plazo corto. VIPER multiplica archivos sin un problema que lo justifique; TCA puede andar pero suma curva de aprendizaje para 2 semi-seniors en 3 meses; 'después' nunca llega.",
        },
        {
          kind: "predict",
          prompt: "Tu manager pregunta: '¿cuánto tarda un cambio en llegar a los usuarios desde que se mergea?'. ¿Qué métrica DORA es?",
          code: md`PR mergeado: lunes 10:00
Release en App Store: jueves de la semana siguiente`,
          options: [
            "Deployment frequency",
            "Change failure rate",
            "Lead time for changes",
            "Time to restore service",
          ],
          answer: 2,
          explanation: "Lead time for changes mide el tiempo desde el commit hasta que corre en producción. En iOS incluye la revisión de App Store y el rollout por fases, por eso suele ser más largo que en backend. Frecuencia mide cada cuánto sale, tasa de fallos cuántos releases rompen algo y time to restore cuánto tarda en recuperarse.",
        },
        {
          kind: "write",
          prompt: "Escribí un ADR en Markdown para 'Mover la persistencia de Core Data a SwiftData en módulos nuevos'. Tiene que tener las secciones `## Estado`, `## Contexto`, `## Decisión` y `## Consecuencias`, con al menos una consecuencia negativa.",
          starter: md`# ADR-021: SwiftData en módulos nuevos

## Estado
Propuesto
`,
          checks: [
            { pattern: "^#+\\s*(Estado|Status)", label: "Sección de estado" },
            { pattern: "^#+\\s*(Contexto|Context)", label: "Sección de contexto" },
            { pattern: "^#+\\s*(Decisi[oó]n|Decision)", label: "Sección de decisión" },
            { pattern: "^#+\\s*(Consecuencias|Consequences)", label: "Sección de consecuencias" },
            { pattern: "^\\s*-\\s+\\S", label: "Al menos una consecuencia negativa (línea que empieza con `-`)" },
          ],
          warnings: [
            { pattern: "TODO|TBD", label: "Un ADR propuesto no debería tener huecos" },
          ],
          solution: md`# ADR-021: SwiftData en módulos nuevos

## Estado
Propuesto

## Contexto
La app usa Core Data desde 2019. Los módulos nuevos (favoritos, historial)
son iOS 17+ y el equipo pierde tiempo con NSManagedObject y contextos.

## Decisión
Los módulos nuevos persisten con SwiftData detrás de un protocolo de
repository. Los módulos existentes siguen en Core Data.

## Consecuencias
+ Modelos más simples con @Model y menos código de contexto.
+ El protocolo de repository permite cambiar la implementación.
- Conviven dos stacks de persistencia hasta migrar todo.
- SwiftData exige iOS 17: no se puede bajar el deployment target.`,
          hint: "Las consecuencias negativas pueden ir como lista con `-` y las positivas con `+`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "code-review",
      title: "Code review que encuentra bugs y enseña",
      goal: "Revisar un diff de Swift en el orden correcto, separar lo bloqueante de lo opcional y escribir comentarios útiles.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Qué mirar primero",
          body: [
            "Revisá en orden de gravedad: **corrección** (¿hace lo que dice?, ¿casos borde?), **concurrencia** (¿qué hilo toca la UI?, ¿datos compartidos?), **memoria** (ciclos de retención), **errores** (¿se tragan?, ¿crashea?), **tests**. Nombres y formato al final; para eso está SwiftLint.",
            "Leé primero la descripción del PR y los tests: te dicen qué intentó hacer el autor. Después el diff. Si el PR tiene 2.000 líneas, el comentario más útil es pedir que lo parta.",
            "Este diff parece inocente. Antes de seguir, buscá al menos tres problemas.",
          ],
          code: md`+final class ProfileViewModel: ObservableObject {
+    @Published var user: User?
+    let api: ProfileAPI
+
+    init(api: ProfileAPI) { self.api = api }
+
+    func load() {
+        api.fetchUser { result in              // callback en un hilo de URLSession
+            self.user = try! result.get()
+        }
+    }
+}`,
        },
        {
          kind: "predict",
          prompt: "De los problemas del diff, ¿cuál marcás como bloqueante sin dudar?",
          code: swift`api.fetchUser { result in
    self.user = try! result.get()
}`,
          options: [
            "`try!` crashea la app ante cualquier error de red o de parseo",
            "El nombre `load()` es poco descriptivo; mejor `loadUser()`",
            "Falta un comentario de documentación en la clase",
            "Debería usar `@Observable` en vez de `ObservableObject`",
          ],
          answer: 0,
          explanation: "Un error de red es normal (modo avión, timeout) y `try!` lo convierte en crash: bloqueante. También es bloqueante asignar `@Published` desde un hilo de fondo. El nombre y la doc son sugerencias; migrar a `@Observable` es una mejora válida pero no es el objetivo de este PR.",
        },
        {
          kind: "explain",
          title: "Memoria y concurrencia en un diff",
          body: [
            "Un ciclo de retención aparece cuando un objeto guarda un closure que captura al mismo objeto con referencia fuerte. Patrones a buscar: `onX = { self... }` guardado en una propiedad, timers, observers de `NotificationCenter` con closure, `sink` de Combine guardado en `cancellables` del mismo objeto.",
            "En concurrencia buscá estado mutable compartido entre tareas (un `var` en una clase usada desde `Task.detached`), actualizaciones de UI fuera de `@MainActor` y continuaciones que se pueden reanudar dos veces o nunca. Con Swift 6 y chequeo estricto muchos de estos ni compilan, pero en código legacy siguen ahí.",
          ],
          code: swift`final class SessionManager {
    var onExpire: (() -> Void)?

    func start() {
        onExpire = {
            self.logout()      // self guarda el closure, el closure guarda a self
        }
    }

    func logout() { print("logout") }

    deinit { print("deinit SessionManager") }
}

var manager: SessionManager? = SessionManager()
manager?.start()
manager = nil
print("fin")`,
          output: "fin",
        },
        {
          kind: "predict",
          prompt: "¿Qué cambio hace que en el ejemplo anterior se imprima `deinit SessionManager` antes de `fin`?",
          code: swift`func start() {
    onExpire = {
        self.logout()
    }
}`,
          options: [
            "Marcar `onExpire` como `private`",
            "Capturar `[weak self]` y llamar `self?.logout()`",
            "Mover `start()` a `init`",
            "Hacer `SessionManager` un `struct`",
          ],
          answer: 1,
          explanation: "Con `[weak self]` el closure ya no retiene al manager. Al hacer `manager = nil` el contador llega a cero, corre `deinit` y recién después se imprime `fin`. La visibilidad o el lugar de la llamada no cambian el ciclo; un `struct` no tiene `deinit`.",
        },
        {
          kind: "explain",
          title: "Bloqueante vs sugerencia, y comentarios que enseñan",
          body: [
            "Etiquetá cada comentario para que el autor sepa qué es obligatorio. Una convención común: `blocking:` (no se mergea así), `suggestion:` (mejor, pero opcional), `question:` (quiero entender), `nit:` (detalle menor de estilo).",
            "Un comentario que enseña dice **qué** pasa, **por qué** importa y **cómo** se arregla, con un ejemplo si hace falta. 'Esto está mal' no enseña nada; 'esto puede crashear con modo avión porque…, probá con `do/catch` y un estado de error' sí.",
            "Hablá del código, no de la persona: 'este closure retiene a self' en lugar de 'te olvidaste del weak self'. Y aprobá cuando lo bloqueante está resuelto: los nits no frenan un merge.",
          ],
          code: md`blocking: try! crashea con cualquier error de red (modo avión, timeout).
  Propuesta: do/catch y pasar a un estado .failed que la vista muestre.

blocking: @Published se asigna desde el hilo de URLSession.
  Marcá el view model @MainActor o usá la versión async del API.

question: ¿fetchUser puede llamar el completion dos veces? Si sí,
  conviene un test que lo cubra.

nit: load() → loadUser(); hay otro load() en el padre.`,
        },
        {
          kind: "fill",
          prompt: "Completá la etiqueta del comentario: es un detalle de estilo que no debe frenar el merge.",
          code: md`____: preferimos guard al principio en vez de if anidados, por consistencia
  con el resto del módulo.`,
          accept: ["^nit$", "^nit:$"],
          explanation: "`nit` marca detalles menores. El autor puede tomarlo o no, y el PR se aprueba igual. Si fuera un bug sería `blocking`.",
          hint: "Tres letras, 'detalle chiquito' en inglés.",
        },
        {
          kind: "write",
          prompt: "En el PR, `ThumbnailCache` se usa desde varias tareas a la vez y tiene una data race. Proponé el arreglo: convertilo en `actor` y actualizá el call site para que use `await cache.insert(...)`.",
          starter: swift`final class ThumbnailCache {
    private var storage: [URL: Data] = [:]

    func data(for url: URL) -> Data? {
        storage[url]
    }

    func insert(_ data: Data, for url: URL) {
        storage[url] = data
    }
}

// Call site, desde varias tareas a la vez:
Task.detached {
    cache.insert(data, for: url)
}`,
          checks: [
            { pattern: "actor\\s+ThumbnailCache", label: "`ThumbnailCache` es un `actor`" },
            { pattern: "storage\\[url\\]", label: "Sigue usando el diccionario `storage`" },
            { pattern: "await\\s+cache\\.insert\\(", label: "El call site usa `await cache.insert(...)`" },
          ],
          warnings: [
            { pattern: "class\\s+ThumbnailCache", label: "Sigue siendo una clase sin aislamiento" },
            { pattern: "nonisolated\\s*\\(unsafe\\)|@unchecked\\s+Sendable", label: "Eso silencia al compilador, no arregla la race" },
          ],
          solution: swift`actor ThumbnailCache {
    private var storage: [URL: Data] = [:]

    func data(for url: URL) -> Data? {
        storage[url]
    }

    func insert(_ data: Data, for url: URL) {
        storage[url] = data
    }
}

// Call site: entrar al actor requiere await
Task.detached {
    await cache.insert(data, for: url)
}`,
          hint: "Un `actor` serializa el acceso a su estado; desde afuera cada llamada lleva `await`.",
        },
        {
          kind: "predict",
          prompt: "¿Cuál de estos comentarios de review es el más útil?",
          code: swift`// En el diff:
let items = try await api.fetch()
self.items = items.filter { $0.isVisible }.sorted { $0.date > $1.date }`,
          options: [
            "`Esto no me gusta, rehacelo.`",
            "`¿Por qué no usaste TCA?`",
            "`nit: falta un espacio.`",
            "`suggestion: filtrar y ordenar acá corre en el main actor con cada refresh; con 5.000 items se nota. Si el endpoint acepta sort=date, movamos el orden al servidor.`",
          ],
          answer: 3,
          explanation: "El buen comentario dice qué pasa (trabajo en el main actor), cuándo duele (5.000 items), propone un arreglo concreto y aclara que es sugerencia. Los otros no dan información, cambian el alcance del PR o se enfocan en algo que resuelve un linter.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "live-coding-classics",
      title: "Live coding: los clásicos en Swift",
      goal: "Resolver en voz alta un LRU cache O(1), un debounce, un image loader con deduplicación y un loader paginado.",
      minutes: 28,
      steps: [
        {
          kind: "explain",
          title: "Cómo pensar en voz alta + LRU cache",
          body: [
            "Recorrido para cualquier ejercicio: 1) repetí el problema y preguntá casos borde, 2) escribí la firma, 3) un ejemplo a mano, 4) solución simple y su complejidad, 5) optimizá, 6) probá con el ejemplo. Hablá todo el tiempo: el silencio largo es lo que más penaliza.",
            "LRU cache con `get` y `put` en **O(1)**: un diccionario `clave → nodo` para encontrar en O(1), y una **lista doblemente enlazada** para mover y sacar nodos en O(1). La cabeza es el más reciente, la cola el menos usado. Con un array, sacar del medio es O(n).",
            "Detalle Swift: `prev` es `weak` para no tener ciclos entre nodos vecinos; el diccionario mantiene vivos a todos.",
          ],
          code: swift`final class LRUCache<Key: Hashable, Value> {
    private final class Node {
        let key: Key
        var value: Value
        weak var prev: Node?
        var next: Node?
        init(key: Key, value: Value) { self.key = key; self.value = value }
    }

    private let capacity: Int
    private var nodes: [Key: Node] = [:]
    private var head: Node?   // más reciente
    private var tail: Node?   // menos reciente

    init(capacity: Int) {
        precondition(capacity > 0)
        self.capacity = capacity
    }

    func get(_ key: Key) -> Value? {
        guard let node = nodes[key] else { return nil }
        moveToFront(node)
        return node.value
    }

    func put(_ key: Key, _ value: Value) {
        if let node = nodes[key] {
            node.value = value
            moveToFront(node)
            return
        }
        if nodes.count == capacity, let lru = tail {
            remove(lru)
            nodes[lru.key] = nil
        }
        let node = Node(key: key, value: value)
        insertAtFront(node)
        nodes[key] = node
    }

    private func remove(_ node: Node) {
        node.prev?.next = node.next
        node.next?.prev = node.prev
        if head === node { head = node.next }
        if tail === node { tail = node.prev }
        node.prev = nil
        node.next = nil
    }

    private func insertAtFront(_ node: Node) {
        node.next = head
        head?.prev = node
        head = node
        if tail == nil { tail = node }
    }

    private func moveToFront(_ node: Node) {
        guard head !== node else { return }
        remove(node)
        insertAtFront(node)
    }
}

let cache = LRUCache<String, Int>(capacity: 2)
cache.put("a", 1)
cache.put("b", 2)
print(cache.get("a") ?? -1)
cache.put("c", 3)
print(cache.get("b") ?? -1)
print(cache.get("c") ?? -1)`,
          output: "1\n-1\n3",
        },
        {
          kind: "predict",
          code: swift`let cache = LRUCache<String, Int>(capacity: 2)
cache.put("a", 1)
cache.put("b", 2)
cache.put("a", 10)
cache.put("c", 3)
print(cache.get("a") ?? -1, cache.get("b") ?? -1)`,
          options: [
            "`1 2`",
            "`10 -1`",
            "`-1 2`",
            "`10 2`",
          ],
          answer: 1,
          explanation: "Después de `put(\"b\")` el orden es b, a. `put(\"a\", 10)` actualiza el valor y mueve a `a` al frente: a, b. Al insertar `c` el cache está lleno y se va la cola, `b`. Queda `a` con 10 y `b` ya no está: `10 -1`.",
        },
        {
          kind: "fill",
          prompt: "Completá cuál es el nodo que se desaloja cuando el cache está lleno.",
          code: swift`if nodes.count == capacity, let lru = ____ {
    remove(lru)
    nodes[lru.key] = nil
}`,
          accept: ["^tail$", "^self\\.tail$"],
          explanation: "La cola es el menos usado recientemente: cada `get` o `put` mueve el nodo a la cabeza, así que lo que queda al fondo es lo que hace más tiempo nadie toca. También hay que sacarlo del diccionario, si no queda vivo.",
          hint: "El opuesto de `head`.",
        },
        {
          kind: "explain",
          title: "Debounce con Task y cancelación",
          body: [
            "Buscador: no querés pegarle al servidor en cada tecla. **Debounce** = esperar a que el usuario deje de escribir N milisegundos y recién ahí buscar. Con concurrencia estructurada se hace cancelando la tarea anterior en cada cambio.",
            "`Task.sleep` lanza `CancellationError` si la tarea se cancela durante la espera. Con `try?` ignorás el error, así que igual hace falta chequear `Task.isCancelled` antes de buscar.",
            "En SwiftUI tenés un atajo: `.task(id: query)` cancela y reinicia la tarea cada vez que cambia `query`; con un `sleep` adentro es un debounce.",
          ],
          code: swift`@MainActor
@Observable
final class SearchViewModel {
    private(set) var results: [Product] = []
    @ObservationIgnored private var searchTask: Task<Void, Never>?
    private let service: SearchService

    init(service: SearchService) { self.service = service }

    func queryChanged(_ text: String) {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            results = (try? await service.search(text)) ?? []
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "El usuario escribe `s`, `sw` y `swi` con 100 ms entre teclas y después para. ¿Cuántas veces se llama a `service.search` y con qué texto?",
          code: swift`viewModel.queryChanged("s")     // t = 0 ms
viewModel.queryChanged("sw")    // t = 100 ms
viewModel.queryChanged("swi")   // t = 200 ms
// nada más`,
          options: [
            "3 veces: `s`, `sw` y `swi`",
            "1 vez con `s`, porque es la primera",
            "1 vez con `swi`, cerca de t = 500 ms",
            "Ninguna: la última tarea también se cancela",
          ],
          answer: 2,
          explanation: "Cada llamada cancela la tarea anterior antes de que terminen sus 300 ms. Solo la tarea de `swi` (creada a los 200 ms) llega a despertar sin cancelar, a los 500 ms, y hace una sola búsqueda.",
        },
        {
          kind: "fill",
          prompt: "Completá el chequeo que evita buscar si la tarea fue cancelada durante la espera.",
          code: swift`try? await Task.sleep(for: .milliseconds(300))
guard !Task.____ else { return }`,
          accept: ["^isCancelled$"],
          explanation: "`Task.isCancelled` es una propiedad estática que mira la tarea actual. Como `try?` se tragó el `CancellationError`, este guard es lo que corta la búsqueda.",
          placeholder: "isC…",
        },
        {
          kind: "explain",
          title: "Image loader con cache y deduplicación en vuelo",
          body: [
            "Clásico de entrevista: varias celdas piden la misma URL a la vez. Querés **una sola descarga**. Un `actor` guarda dos diccionarios: imágenes terminadas y tareas en vuelo. Si ya hay una tarea para esa URL, todos esperan su `value`.",
            "Ojo con la **reentrancia**: dentro de un actor, cada `await` es un punto donde otra llamada puede entrar. Por eso registrás la tarea en `inFlight` **antes** del primer `await`. Si lo hacés después, dos llamadas pasan el chequeo y descargan dos veces.",
            "En la celda, cancelá la carga en `prepareForReuse` y verificá que la URL sigue siendo la misma antes de asignar la imagen: si no, ves la foto de otro post.",
          ],
          code: swift`actor ImageLoader {
    private var cache: [URL: UIImage] = [:]
    private var inFlight: [URL: Task<UIImage, Error>] = [:]

    func image(for url: URL) async throws -> UIImage {
        if let cached = cache[url] { return cached }
        if let running = inFlight[url] { return try await running.value }

        let task = Task<UIImage, Error> {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let image = UIImage(data: data) else { throw URLError(.cannotDecodeContentData) }
            return image
        }
        inFlight[url] = task          // antes del primer await
        defer { inFlight[url] = nil }

        let image = try await task.value
        cache[url] = image
        return image
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Tres celdas llaman a `loader.image(for: url)` con la misma URL casi al mismo tiempo, y no está en cache. ¿Cuántas descargas hace `URLSession`?",
          code: swift`async let a = loader.image(for: url)
async let b = loader.image(for: url)
async let c = loader.image(for: url)
let images = try await [a, b, c]`,
          options: [
            "1: la primera llamada registra la tarea en `inFlight` y las otras dos esperan su `value`",
            "3: el actor no impide llamadas concurrentes",
            "0: `async let` no ejecuta hasta el `await`",
            "2: la primera y la última, por reentrancia",
          ],
          answer: 0,
          explanation: "El actor ejecuta las llamadas de a una. La primera no encuentra nada, crea la tarea y la guarda en `inFlight` sin haber suspendido todavía. Cuando entran las otras dos, encuentran la tarea y esperan su resultado. Una sola descarga, tres imágenes iguales.",
        },
        {
          kind: "explain",
          title: "Loader paginado",
          body: [
            "El último clásico: una lista infinita. El estado mínimo es la lista, el cursor siguiente, si está cargando y si se llegó al final. La regla de oro: **nunca dos cargas en paralelo** y nunca pedir después del final.",
            "La vista dispara la carga cuando aparece una de las últimas celdas. En SwiftUI, `.task` o `.onAppear` sobre la fila; en UIKit, `prefetchRows` o `willDisplay`.",
          ],
          code: swift`@MainActor
@Observable
final class FeedViewModel {
    private(set) var posts: [Post] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private var nextCursor: String?
    private var reachedEnd = false
    private let repository: FeedRepository

    init(repository: FeedRepository) { self.repository = repository }

    func rowAppeared(_ post: Post) async {
        guard post.id == posts.last?.id else { return }
        await loadNextPage()
    }
}

// Vista
List(viewModel.posts) { post in
    PostRow(post: post)
        .task { await viewModel.rowAppeared(post) }
}`,
        },
        {
          kind: "write",
          prompt: "Implementá `loadNextPage()` en `FeedViewModel`: no cargues si ya está cargando o si llegaste al final, marcá `isLoading` y apagalo con `defer`, agregá la página a `posts` (no la reemplaces) y actualizá `nextCursor` y `reachedEnd`. Si falla, guardá un `errorMessage`.",
          starter: swift`func loadNextPage() async {
    // TODO
}`,
          checks: [
            { pattern: "guard\\s+!isLoading", label: "Corta si ya está cargando" },
            { pattern: "!reachedEnd|reachedEnd\\s*==\\s*false", label: "Corta si llegó al final" },
            { pattern: "isLoading\\s*=\\s*true", label: "Marca `isLoading = true`" },
            { pattern: "defer\\s*\\{\\s*isLoading\\s*=\\s*false", label: "Apaga `isLoading` con `defer`" },
            { pattern: "append\\(contentsOf:", label: "Agrega la página con `append(contentsOf:)`" },
            { pattern: "nextCursor\\s*=\\s*page\\.nextCursor", label: "Actualiza el cursor" },
            { pattern: "catch", label: "Maneja el error" },
          ],
          warnings: [
            { pattern: "posts\\s*=\\s*page\\.items", label: "Reemplaza la lista en vez de agregar la página" },
            { pattern: "[\\w\\)\\]]!(?!=)", label: "Evitá force unwraps y `try!`" },
          ],
          solution: swift`func loadNextPage() async {
    guard !isLoading, !reachedEnd else { return }
    isLoading = true
    defer { isLoading = false }
    do {
        let page = try await repository.fetchPage(after: nextCursor)
        posts.append(contentsOf: page.items)
        nextCursor = page.nextCursor
        reachedEnd = page.nextCursor == nil
        errorMessage = nil
    } catch {
        errorMessage = "No pudimos cargar más posts"
    }
}`,
          hint: "Un solo `guard` con dos condiciones separadas por coma.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "algorithms-and-behavioral",
      title: "Algoritmos que siempre aparecen y entrevista conductual",
      goal: "Resolver en Swift idiomático los cinco clásicos diciendo la complejidad en voz alta, y contar historias STAR con números.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "Two sum y la complejidad en voz alta",
          body: [
            "La solución obvia de two sum son dos `for` anidados: O(n²). La que esperan es un **diccionario** de valores vistos: para cada número preguntás si ya viste su complemento. Una pasada, O(n) en tiempo y O(n) en memoria.",
            "Decí la complejidad sin que te la pregunten: 'esto es O(n) en tiempo porque recorro una vez y el lookup en diccionario es O(1) promedio; O(n) en espacio por el diccionario'. Es una de las cosas que más puntúa.",
          ],
          code: swift`func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
    var seen: [Int: Int] = [:]          // valor → índice
    for (i, n) in nums.enumerated() {
        if let j = seen[target - n] {
            return [j, i]
        }
        seen[n] = i
    }
    return []
}

print(twoSum([2, 7, 11, 15], 9))
print(twoSum([3, 2, 4], 6))
print(twoSum([1, 2], 7))`,
          output: "[0, 1]\n[1, 2]\n[]",
        },
        {
          kind: "predict",
          code: swift`func isValid(_ s: String) -> Bool {
    let pairs: [Character: Character] = [")": "(", "]": "[", "}": "{"]
    var stack: [Character] = []
    for ch in s {
        if let open = pairs[ch] {
            guard stack.popLast() == open else { return false }
        } else {
            stack.append(ch)
        }
    }
    return stack.isEmpty
}

print(isValid("([])"), isValid("(]"), isValid("(("))`,
          options: [
            "`true true false`",
            "`true false true`",
            "`false false false`",
            "`true false false`",
          ],
          answer: 3,
          explanation: "`([])`: se apilan `(` y `[`, el `]` saca `[` y el `)` saca `(`; la pila queda vacía → `true`. `(]`: el `]` saca `(`, que no es `[` → `false`. `((`: nunca se cierra, la pila termina con dos elementos → `false`. O(n) tiempo, O(n) espacio.",
        },
        {
          kind: "explain",
          title: "Ordenar primero: merge intervals y top-k",
          body: [
            "Cuando el orden importa, ordenar primero cuesta O(n log n) y después alcanza una pasada. **Merge intervals**: ordenás por inicio con `sorted(by:)` y vas extendiendo el último intervalo del resultado mientras se solapen.",
            "**Top-k frequent**: contás con un diccionario usando `default:` y ordenás por frecuencia. Es O(n log n); si te piden mejor, mencioná *bucket sort* por frecuencia (O(n)) o un heap de tamaño k (O(n log k)). Con nombrarlo y explicar cuándo conviene alcanza.",
          ],
          code: swift`func merge(_ intervals: [[Int]]) -> [[Int]] {
    let sorted = intervals.sorted(by: { $0[0] < $1[0] })
    var result: [[Int]] = []
    for interval in sorted {
        if let last = result.last, interval[0] <= last[1] {
            result[result.count - 1][1] = max(last[1], interval[1])
        } else {
            result.append(interval)
        }
    }
    return result
}

func topKFrequent(_ nums: [Int], _ k: Int) -> [Int] {
    var counts: [Int: Int] = [:]
    for n in nums { counts[n, default: 0] += 1 }
    return counts.sorted(by: { $0.value > $1.value }).prefix(k).map(\.key)
}

print(merge([[1, 3], [8, 10], [2, 6], [15, 18]]))
print(topKFrequent([1, 1, 1, 2, 2, 3], 2))`,
          output: "[[1, 6], [8, 10], [15, 18]]\n[1, 2]",
        },
        {
          kind: "predict",
          prompt: "Con la función `merge` de arriba, ¿qué imprime esto?",
          code: swift`print(merge([[5, 7], [1, 4], [4, 5]]))`,
          options: [
            "`[[1, 4], [4, 5], [5, 7]]`",
            "`[[1, 7]]`",
            "`[[1, 5], [5, 7]]`",
            "`[[5, 7], [1, 5]]`",
          ],
          answer: 1,
          explanation: "Ordenado por inicio: [1,4], [4,5], [5,7]. [4,5] empieza en 4 ≤ 4 → se fusiona en [1,5]. [5,7] empieza en 5 ≤ 5 → se fusiona en [1,7]. Como la condición es `<=`, los intervalos que se tocan se unen.",
        },
        {
          kind: "fill",
          prompt: "Completá el subíndice para contar sin chequear si la clave existe.",
          code: swift`for n in nums { counts[n, ____] += 1 }`,
          accept: ["^default: 0$", "^default:0$"],
          explanation: "`counts[n, default: 0]` devuelve 0 si la clave no está y permite mutar en el lugar. Evita el `if let` o el `?? 0` y es la forma idiomática de contar en Swift.",
          placeholder: "default: …",
        },
        {
          kind: "write",
          prompt: "Escribí `func groupAnagrams(_ words: [String]) -> [[String]]` en O(n · k log k): agrupá por la palabra con sus letras ordenadas como clave de un diccionario. Nada de comparar cada palabra con todas las demás.",
          starter: swift`func groupAnagrams(_ words: [String]) -> [[String]] {
    var result: [[String]] = []
    // TODO
    return result
}`,
          checks: [
            { pattern: "String\\(\\s*\\w+\\.sorted\\(\\)\\s*\\)", label: "La clave es `String(word.sorted())`" },
            { pattern: "\\[String\\s*:\\s*\\[String\\]\\]|Dictionary\\(grouping:", label: "Agrupa con un diccionario `[String: [String]]`" },
            { pattern: "\\.values", label: "Devuelve los grupos con `.values`" },
          ],
          warnings: [
            { pattern: "for\\s+\\w+\\s+in[^{]*\\{[^}]*for\\s+\\w+\\s+in", label: "Loops anidados: O(n²) comparando palabras" },
            { pattern: "[\\w\\)\\]]!(?!=)", label: "Evitá force unwraps" },
          ],
          solution: swift`func groupAnagrams(_ words: [String]) -> [[String]] {
    var groups: [String: [String]] = [:]
    for word in words {
        let key = String(word.sorted())
        groups[key, default: []].append(word)
    }
    return Array(groups.values)
}`,
          hint: "`\"eat\".sorted()` devuelve `[\"a\", \"e\", \"t\"]`; con `String(...)` es una clave.",
        },
        {
          kind: "explain",
          title: "Entrevista conductual con STAR",
          body: [
            "Las preguntas conductuales ('contame de un conflicto', 'una decisión de arquitectura', 'un incidente en producción', 'un error tuyo') se responden con **STAR**: Situación (contexto en 1-2 frases), Tarea (qué te tocaba a vos), Acción (qué hiciste vos, en primera persona), Resultado (con números) y qué aprendiste.",
            "La A es lo más largo y lo más importante. 'Nosotros' esconde tu aporte: decí 'yo propuse', 'yo escribí el RFC'. El resultado con números es lo que convierte una anécdota en evidencia: crash-free de 99.1% a 99.8%, tiempo de build de 14 a 6 minutos.",
            "Prepará 5 o 6 historias antes de la entrevista y adaptalas: una misma historia de migración sirve para 'decisión de arquitectura', 'conflicto técnico' y 'liderazgo sin autoridad'. En la del error propio, mostrá qué cambiaste después para que no se repita.",
          ],
          code: md`Pregunta: "Contame de un incidente en producción."

S  Viernes 18 h, release 5.2 al 100%. El crash-free cae de 99.7% a 96%.
T  Era el on-call de iOS: tenía que frenar el daño y encontrar la causa.
A  Apagué el flag del nuevo checkout (sospechoso por el stack trace),
   el crash bajó en 20 minutos. Reproduje con un usuario sin dirección
   guardada: un force unwrap en el parser. Hice el fix con un test y
   pedí expedited review.
R  5.2.1 aprobada en 9 h; crash-free volvió a 99.7%. En la postmortem
   propuse una regla de SwiftLint contra force_unwrapping en Networking,
   y desde entonces 0 crashes de ese tipo.`,
        },
        {
          kind: "predict",
          prompt: "Te preguntan: 'Contame de una decisión de arquitectura que hayas tomado'. ¿Qué respuesta es más fuerte?",
          code: md`A. "Usamos MVVM porque es el estándar y todos lo conocen."
B. "Siempre elijo TCA, es lo mejor para testear."
C. "Yo propuse modularizar con SPM: el build tardaba 14 min. Escribí un
   RFC con 3 opciones, migramos 4 módulos en 2 sprints y el build
   incremental bajó a 3 min. El costo fue más configuración de CI."
D. "El equipo decidió modularizar y salió muy bien."`,
          options: [
            "A",
            "B",
            "C",
            "D",
          ],
          answer: 2,
          explanation: "C tiene STAR completo: situación con número (14 min), acción propia ('yo propuse', 'escribí un RFC'), opciones evaluadas, resultado medido (3 min) y un trade-off honesto. A y B son opiniones sin contexto; D esconde tu rol detrás de 'el equipo' y no tiene números.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: entrevista simulada completa",
      goal: "Atravesar las cuatro partes de un loop de entrevistas senior: system design, live coding, code review y conductual.",
      minutes: 45,
      steps: [
        {
          kind: "explain",
          title: "El loop de entrevistas",
          body: [
            "Simulá la entrevista con reloj. Son cuatro bloques, como en un loop real de iOS Engineer Sr: **system design** (10 min acá), **live coding** de un LRU cache (20 min), **code review** de un diff (5 min) y **conductual** con STAR (10 min).",
            "Hablá en voz alta aunque estés solo: es lo que se entrena. Si te trabás en el LRU, decí la versión simple con su complejidad y después optimizá.",
          ],
          code: md`ENTREVISTA SIMULADA: iOS Engineer Sr (45 min)

1. System design (10 min)
   "Diseñá la app de un repartidor: lista de entregas del día, marcar
    entregada con foto y firma. Muchas zonas sin señal."

2. Live coding (20 min)
   "Implementá un LRUCache genérico con get y put en O(1)."

3. Code review (5 min)
   Un diff de CheckoutViewModel. ¿Qué bloqueás?

4. Conductual (10 min)
   "Contame de una vez que te equivocaste en producción."`,
        },
        {
          kind: "predict",
          prompt: "System design: el repartidor marca entregas en zonas sin señal y la empresa no puede perder ni una. ¿Qué flujo de datos proponés?",
          code: md`Requisitos:
- Marcar entregada con foto y firma, con o sin señal
- No perder ninguna entrega ni duplicarla
- El back office ve el estado cuando el teléfono reconecta`,
          options: [
            "Base local como fuente de verdad + outbox de operaciones con un UUID de cliente como clave de idempotencia; un sync con reintentos y backoff sube fotos y estados al reconectar",
            "Deshabilitar el botón 'Entregada' cuando no hay conexión",
            "Guardar las entregas pendientes en un array en memoria y reintentar cada 5 segundos",
            "Mandar cada entrega por push notification al servidor",
          ],
          answer: 0,
          explanation: "Disco como fuente de verdad sobrevive a que el sistema mate la app; el outbox ordena lo pendiente; el UUID de cliente evita duplicados si se reintenta después de que el servidor ya guardó. Deshabilitar el botón rompe el requisito, la memoria se pierde al cerrar la app y las push van del servidor al teléfono, no al revés.",
        },
        {
          kind: "write",
          prompt: "Live coding: implementá `LRUCache<Key: Hashable, Value>` con `get` y `put` en O(1). Usá un diccionario `[Key: Node]` y una lista doblemente enlazada (`prev`/`next`) con `head` y `tail`; al superar la capacidad desalojá la cola.",
          starter: swift`final class LRUCache<Key: Hashable, Value> {
    private let capacity: Int

    init(capacity: Int) { self.capacity = capacity }

    func get(_ key: Key) -> Value? {
        // TODO
        return nil
    }

    func put(_ key: Key, _ value: Value) {
        // TODO
    }
}`,
          checks: [
            { pattern: "class\\s+Node\\b", label: "Declara una clase `Node`" },
            { pattern: "var\\s+prev\\b", label: "El nodo tiene `prev`" },
            { pattern: "var\\s+next\\b", label: "El nodo tiene `next`" },
            { pattern: "\\[Key\\s*:\\s*Node\\]", label: "Diccionario `[Key: Node]` para lookup O(1)" },
            { pattern: "\\w+\\[key\\]", label: "Busca el nodo por clave en el diccionario" },
            { pattern: "\\btail\\b", label: "Mantiene una `tail` para desalojar" },
            { pattern: "capacity", label: "Compara contra la capacidad" },
          ],
          warnings: [
            { pattern: "\\.(firstIndex|removeFirst|lastIndex)\\(|\\.remove\\(at:", label: "Operaciones O(n) sobre un array: el LRU deja de ser O(1)" },
            { pattern: "[\\w\\)\\]]!(?!=)", label: "Evitá force unwraps" },
          ],
          solution: swift`final class LRUCache<Key: Hashable, Value> {
    private final class Node {
        let key: Key
        var value: Value
        weak var prev: Node?
        var next: Node?
        init(key: Key, value: Value) { self.key = key; self.value = value }
    }

    private let capacity: Int
    private var nodes: [Key: Node] = [:]
    private var head: Node?
    private var tail: Node?

    init(capacity: Int) {
        precondition(capacity > 0)
        self.capacity = capacity
    }

    func get(_ key: Key) -> Value? {
        guard let node = nodes[key] else { return nil }
        moveToFront(node)
        return node.value
    }

    func put(_ key: Key, _ value: Value) {
        if let node = nodes[key] {
            node.value = value
            moveToFront(node)
            return
        }
        if nodes.count == capacity, let lru = tail {
            remove(lru)
            nodes[lru.key] = nil
        }
        let node = Node(key: key, value: value)
        insertAtFront(node)
        nodes[key] = node
    }

    private func remove(_ node: Node) {
        node.prev?.next = node.next
        node.next?.prev = node.prev
        if head === node { head = node.next }
        if tail === node { tail = node.prev }
        node.prev = nil
        node.next = nil
    }

    private func insertAtFront(_ node: Node) {
        node.next = head
        head?.prev = node
        head = node
        if tail == nil { tail = node }
    }

    private func moveToFront(_ node: Node) {
        guard head !== node else { return }
        remove(node)
        insertAtFront(node)
    }
}`,
          hint: "Tres helpers privados: `remove(_:)`, `insertAtFront(_:)` y `moveToFront(_:)`. `get` y `put` quedan de pocas líneas.",
        },
        {
          kind: "predict",
          prompt: "Code review: ¿qué comentario marcás como `blocking`?",
          code: md` final class CheckoutViewModel: ObservableObject {
+    @Published var total: Decimal = 0
+
+    func applyCoupon(_ code: String) {
+        Task.detached {
+            let discount = try await self.api.validate(code)
+            self.total -= discount
+        }
+    }
 }`,
          options: [
            "`nit: applyCoupon → apply(coupon:)` para seguir las API Design Guidelines",
            "`suggestion: total debería ser Double para simplificar`",
            "`question: ¿agregamos analytics cuando se aplica un cupón?`",
            "`blocking: total se muta desde un Task.detached fuera del main actor (data race y @Published desde otro hilo), y si validate falla el error se pierde sin feedback`",
          ],
          answer: 3,
          explanation: "El `Task.detached` corre fuera del main actor y muta estado publicado: data race y UI actualizada desde otro hilo (con Swift 6 estricto ni compila). Además el error del `try` queda dentro de la tarea y nadie lo ve. El arreglo: view model `@MainActor`, `Task { }` normal y `do/catch` con un estado de error. Usar `Double` para dinero sería un error, no una mejora.",
        },
        {
          kind: "write",
          prompt: "Conductual: escribí el esqueleto STAR para 'Contame de una vez que te equivocaste en producción'. Usá las secciones Situación, Tarea, Acción y Resultado, contá en primera persona y poné al menos un número con `%` en el resultado.",
          starter: md`Situación:
Tarea:
`,
          checks: [
            { pattern: "^\\s*(S\\b|Situaci[oó]n|Situation)", label: "Situación" },
            { pattern: "^\\s*(T\\b|Tarea|Task)", label: "Tarea" },
            { pattern: "^\\s*(A\\b|Acci[oó]n|Action)", label: "Acción" },
            { pattern: "^\\s*(R\\b|Resultado|Result)", label: "Resultado" },
            { pattern: "\\d+(\\.\\d+)?\\s*%", label: "Un resultado medido con `%`" },
            { pattern: "\\b(yo|Yo|I)\\b|\\b(propuse|escrib[ií]|hice|agregu[eé]|revert[ií])\\b|\\b(I'm|I've)\\b", label: "Primera persona: tu acción, no la del equipo" },
          ],
          warnings: [
            { pattern: "\\b(nosotros|Nosotros|We|we)\\b", label: "Mucho 'nosotros' esconde tu aporte" },
          ],
          solution: md`Situación: Subí un cambio al cache de imágenes que no limitaba el tamaño
en disco. Una semana después, el 3% de los usuarios con poco espacio
reportaba que la app no abría.
Tarea: Era mi cambio y mi responsabilidad arreglarlo y evitar que vuelva.
Acción: Yo lo detecté cruzando reviews con Crashlytics, revertí el cambio
detrás del flag en 1 hora, escribí un límite de 200 MB con limpieza LRU y
agregué un test que llena el cache y verifica el límite. Presenté la
postmortem sin culpas y propuse un checklist de recursos en los PRs.
Resultado: Los reportes bajaron a 0 en 2 días, el uso de disco de la app
cayó un 60% y el checklist se adoptó en los otros 3 equipos.`,
          hint: "Lo más largo es la Acción. Cerrá con qué cambió en el proceso, no solo en el código.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-sd-framework",
      front: "Recorrido de system design mobile",
      back: "Requisitos y escala → contrato de API → modelo de datos → capas → cache y offline → sync → paginación → errores → seguridad → observabilidad → trade-offs. Siempre en voz alta y empezando por preguntar.",
    },
    {
      id: "fc-cursor-offset",
      front: "¿Por qué cursor y no offset para un feed?",
      back: "Con offset, si entran ítems nuevos arriba la página siguiente se corre y repite ítems. El cursor apunta 'después de este ítem' y es estable. Costo: no podés saltar a una página arbitraria.",
    },
    {
      id: "fc-swr",
      front: "Stale-while-revalidate en mobile",
      back: "Mostrás al instante lo cacheado en disco y en paralelo pedís datos frescos; cuando llegan, actualizás disco y la UI se refresca. Arranque rápido sin pantallas en blanco.",
    },
    {
      id: "fc-outbox",
      front: "Patrón outbox",
      back: "Las operaciones del usuario se guardan primero en una tabla local (`pending`) y la UI las muestra enseguida. Un proceso de sync las envía al reconectar, con reintentos y backoff, y las marca `sent` o `failed`.",
    },
    {
      id: "fc-idempotency",
      front: "¿Para qué sirve un id generado en el cliente al enviar?",
      back: "Es una clave de idempotencia: si la respuesta se pierde y reintentás, el servidor reconoce el id y devuelve el registro existente en vez de crear un duplicado.",
      code: "struct OutgoingMessage {\n    let id: UUID   // mismo en cada reintento\n    let text: String\n}",
    },
    {
      id: "fc-adr",
      front: "Partes de un ADR",
      back: "Estado, contexto (problema y restricciones), decisión y consecuencias (positivas y negativas). Si cambia la decisión, se escribe un ADR nuevo y el viejo queda `Superseded`.",
    },
    {
      id: "fc-rfc",
      front: "Secciones clave de un RFC / tech spec",
      back: "Problema, objetivos y no-objetivos, opciones con trade-offs, propuesta, rollout (flag por porcentajes con métricas) y rollback (apagar el flag; el código viejo sigue en el binario un tiempo).",
    },
    {
      id: "fc-dora",
      front: "Las cuatro métricas DORA",
      back: "Deployment frequency, lead time for changes (commit → producción), change failure rate (% de releases que necesitan arreglo) y time to restore service (cuánto tarda en recuperarse).",
    },
    {
      id: "fc-review-order",
      front: "Orden para revisar un PR",
      back: "Descripción y tests → corrección y casos borde → concurrencia → memoria → manejo de errores → tests faltantes → nombres y estilo (lo que el linter no atrapa).",
    },
    {
      id: "fc-review-labels",
      front: "`blocking`, `suggestion`, `question`, `nit`",
      back: "`blocking`: no se mergea así. `suggestion`: mejora opcional. `question`: quiero entender. `nit`: detalle menor de estilo. Un buen comentario dice qué pasa, por qué importa y cómo arreglarlo.",
    },
    {
      id: "fc-lru",
      front: "LRU cache en O(1): ¿qué estructuras?",
      back: "Diccionario `clave → nodo` para encontrar en O(1) y lista doblemente enlazada para mover y desalojar en O(1). Cabeza = más reciente, cola = se desaloja. En Swift, `prev` como `weak`.",
    },
    {
      id: "fc-debounce",
      front: "Debounce con concurrencia estructurada",
      back: "En cada cambio cancelás la tarea anterior y creás una nueva que duerme N ms, chequea `Task.isCancelled` y recién ahí busca. En SwiftUI, `.task(id: query)` con un `sleep` adentro.",
      code: "searchTask?.cancel()\nsearchTask = Task {\n    try? await Task.sleep(for: .milliseconds(300))\n    guard !Task.isCancelled else { return }\n    await search(text)\n}",
    },
    {
      id: "fc-inflight",
      front: "Deduplicación en vuelo en un image loader",
      back: "Un actor guarda `[URL: Task<UIImage, Error>]`. Si ya hay una tarea para la URL, se espera su `value`. La tarea se registra antes del primer `await` por la reentrancia del actor.",
    },
    {
      id: "fc-complexity",
      front: "Complejidad de los clásicos",
      back: "Two sum con diccionario: O(n). Paréntesis con pila: O(n). Merge intervals: O(n log n) por ordenar. Group anagrams: O(n · k log k). Top-k ordenando: O(n log n); con heap O(n log k).",
    },
    {
      id: "fc-star",
      front: "STAR",
      back: "Situación (breve), Tarea (lo tuyo), Acción (en primera persona, lo más largo), Resultado (con números) y qué aprendiste o cambiaste en el proceso.",
    },
  ],

  exam: [
    {
      id: "ex-cold-start",
      question: "En el diseño del feed, producto pide que al abrir la app se vea contenido al instante aunque la red sea lenta. ¿Qué proponés?",
      options: [
        "Mostrar un spinner hasta que llegue la primera página de red",
        "Stale-while-revalidate: mostrar el feed cacheado en disco y refrescar en segundo plano",
        "Precargar todo el feed del usuario la noche anterior con background fetch y no pedir nada al abrir",
        "Bajar el `timeoutInterval` a 2 segundos",
      ],
      answer: 1,
      explanation: "El cache en disco da contenido inmediato y la revalidación lo actualiza. El spinner es justo lo que se quiere evitar; el background fetch no está garantizado y deja datos viejos; bajar el timeout solo hace fallar más rápido.",
    },
    {
      id: "ex-chat-order",
      question: "En el chat, dos mensajes del mismo usuario aparecen en orden invertido en otro dispositivo. El orden se calculaba con la fecha del teléfono que envió. ¿Qué cambiás?",
      options: [
        "Sincronizar el reloj del teléfono con NTP antes de enviar",
        "Ordenar por el texto del mensaje cuando las fechas coinciden",
        "Ordenar por el UUID del cliente",
        "Ordenar por un número de secuencia que asigna el servidor por conversación",
      ],
      answer: 3,
      explanation: "El reloj del dispositivo no es confiable (zona, ajustes manuales, desfase). Una secuencia asignada por el servidor da un orden total por conversación y además permite pedir 'todo después de N' al reconectar. Un UUID no tiene orden.",
    },
    {
      id: "ex-conflict",
      question: "App de notas offline: el usuario edita la misma nota en el iPad y en el iPhone sin señal. Producto exige no perder texto nunca. ¿Qué estrategia de conflicto elegís?",
      options: [
        "Detectar el conflicto con una versión por nota y conservar ambas versiones (copia de conflicto o merge) para que el usuario decida",
        "Last-write-wins con la fecha del servidor",
        "Bloquear la edición en un dispositivo mientras el otro está abierto",
        "Quedarse siempre con la versión más larga",
      ],
      answer: 0,
      explanation: "Last-write-wins es simple pero pisa una de las ediciones, y 'no perder texto' lo descarta. Bloquear no funciona sin señal. Con una versión por nota detectás el conflicto y conservás las dos; es el trade-off correcto para este requisito.",
    },
    {
      id: "ex-adr-consequences",
      question: "Revisás un ADR que en Consecuencias solo dice 'código más limpio y testeable'. ¿Qué pedís?",
      options: [
        "Nada, las consecuencias positivas son suficientes",
        "Que agregue el diagrama de clases completo",
        "Que agregue los costos: migración, curva de aprendizaje, más tipos, qué se vuelve más difícil",
        "Que lo convierta en un RFC",
      ],
      answer: 2,
      explanation: "Un ADR sin costos es una venta, no un registro. Quien lo lea en dos años necesita saber qué se aceptó pagar para entender si la decisión sigue vigente.",
    },
    {
      id: "ex-rollout",
      question: "Vas a reemplazar la capa de red de una app con 2 millones de usuarios. ¿Qué plan de rollout es el más seguro?",
      options: [
        "Mergear a main y salir en la próxima release al 100%",
        "Salir con TestFlight un mes y después al 100%",
        "Feature flag remoto: 1% → 10% → 50% → 100%, avanzando solo si crash-free y tasa de error están dentro de umbrales definidos, y rollback apagando el flag",
        "Usar el phased release de App Store y, si hay problemas, sacar la app de la venta",
      ],
      answer: 2,
      explanation: "El flag permite volver atrás en minutos sin binario nuevo, y los umbrales escritos de antemano evitan discutir durante el incidente. TestFlight no representa la variedad de producción; el phased release ayuda pero no permite revertir lo ya instalado.",
    },
    {
      id: "ex-dora",
      question: "El equipo sale cada dos semanas, pero 1 de cada 3 releases necesita un hotfix. ¿Qué métrica DORA muestra el problema y qué atacás?",
      options: [
        "Change failure rate: más tests en las áreas que fallan, flags para cambios riesgosos y revisión de las postmortems",
        "Deployment frequency: salir todos los días",
        "Lead time for changes: saltear la code review",
        "Time to restore: tener más gente de guardia",
      ],
      answer: 0,
      explanation: "Un 33% de releases con hotfix es una tasa de fallos alta. Salir más seguido o revisar menos con esa tasa empeora las cosas. Hay que bajar la tasa de fallos atacando las causas.",
    },
    {
      id: "ex-big-pr",
      question: "Te asignan un PR de 2.300 líneas que migra la red, cambia la navegación y renombra modelos. ¿Qué hacés primero?",
      options: [
        "Aprobarlo si los tests pasan",
        "Revisar solo los archivos que conocés",
        "Dejar 80 comentarios de estilo",
        "Pedir que lo parta en PRs más chicos (renombres, red, navegación), idealmente encadenados, para poder revisar cada cambio en serio",
      ],
      answer: 3,
      explanation: "Nadie revisa bien 2.300 líneas con tres cambios mezclados: los bugs se esconden en el ruido de los renombres. Partirlo es el comentario de más valor. Aprobar o revisar a medias es poner tu nombre en algo que no leíste.",
    },
    {
      id: "ex-teaching-comment",
      question: "Encontrás `[unowned self]` en un closure de red que puede completar después de cerrar la pantalla. ¿Cuál es el mejor comentario?",
      options: [
        "`Nunca uses unowned.`",
        "`blocking: si el usuario cierra la pantalla antes de que responda la red, self ya no existe y unowned crashea. Usá [weak self] con guard let self.`",
        "`nit: preferimos weak.`",
        "`¿Seguro?`",
      ],
      answer: 1,
      explanation: "Es un crash posible, así que es bloqueante, y el comentario explica cuándo ocurre y cómo se arregla. 'Nunca' no enseña el porqué; marcarlo `nit` subestima un crash; '¿Seguro?' obliga al autor a adivinar.",
    },
    {
      id: "ex-lru-list",
      question: "En el live coding implementás el LRU con un array de claves ordenadas por uso. El entrevistador pregunta la complejidad de `get`. ¿Qué respondés y qué proponés?",
      options: [
        "O(n), porque mover la clave al final requiere buscarla y sacarla del medio; con un diccionario a nodos de una lista doblemente enlazada queda O(1)",
        "O(1), porque los arrays de Swift tienen acceso aleatorio",
        "O(log n), porque el array está ordenado",
        "O(1) amortizado, por copy-on-write",
      ],
      answer: 0,
      explanation: "Acceder por índice es O(1), pero encontrar la clave (`firstIndex`) y sacarla del medio (`remove(at:)`) son O(n). La lista doblemente enlazada permite desenganchar un nodo conocido en O(1), y el diccionario te da ese nodo.",
    },
    {
      id: "ex-cell-reuse",
      question: "En el feed, al scrollear rápido algunas celdas muestran por un instante la foto de otro post. ¿Cuál es la causa y el arreglo?",
      options: [
        "El `NSCache` devuelve imágenes equivocadas; hay que usar un diccionario",
        "Falta `@MainActor` en el image loader",
        "La celda se reusó y llegó la imagen de la carga anterior: cancelar la tarea en `prepareForReuse` y verificar que la URL siga siendo la de la celda antes de asignar",
        "Hay que desactivar la reutilización de celdas",
      ],
      answer: 2,
      explanation: "La descarga vieja termina después de que la celda ya muestra otro post. Cancelar al reusar y comparar la URL evita asignar una imagen que ya no corresponde. Desactivar el reuso destruye la performance.",
    },
    {
      id: "ex-stuck",
      question: "Live coding de group anagrams: llevás 8 minutos sin dar con la solución óptima. ¿Qué hacés?",
      options: [
        "Quedarte en silencio pensando hasta tenerla",
        "Pedir pasar a otro ejercicio",
        "Escribir directamente la solución óptima aunque no la puedas explicar",
        "Decir en voz alta la solución de fuerza bruta y su complejidad, escribirla si hace falta, y buscar qué trabajo repetido se puede evitar (por ejemplo, una clave canónica en un diccionario)",
      ],
      answer: 3,
      explanation: "Una solución que funciona con su complejidad bien dicha vale más que el silencio, y muestra cómo razonás. Desde la fuerza bruta, preguntarte qué comparás de más suele llevar a la versión con diccionario.",
    },
    {
      id: "ex-behavioral-incident",
      question: "'Contame de un incidente en producción.' ¿Qué estructura da la mejor respuesta?",
      options: [
        "Explicar en detalle la arquitectura de la app antes de llegar al incidente",
        "STAR: contexto breve, tu rol, lo que hiciste vos para mitigar y encontrar la causa, el resultado con números y qué cambiaste en el proceso después",
        "Contar el incidente más grave de la empresa aunque no hayas participado",
        "Explicar de quién fue la culpa",
      ],
      answer: 1,
      explanation: "El entrevistador evalúa tu comportamiento: cómo mitigaste, cómo investigaste y qué aprendiste. Una historia ajena no dice nada de vos, y buscar culpables es una señal roja en una cultura de postmortems sin culpa.",
    },
  ],
};

export default content;
