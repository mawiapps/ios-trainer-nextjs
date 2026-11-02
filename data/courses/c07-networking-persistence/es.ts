import type { CourseContent } from "../types";

// String.raw conserva las barras de Swift (`\(x)`, `\.id`) tal cual.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    {
      id: "urlsession-async",
      title: "URLSession con async/await",
      goal: "Armar un `URLRequest` completo, leer el `HTTPURLResponse`, construir URLs con `URLComponents` y manejar timeouts y errores de transporte.",
      minutes: 15,
      steps: [
        {
          kind: "explain",
          title: "Anatomía de un URLRequest",
          body: [
            "`URLRequest` es la descripción de lo que vas a pedir: URL, método (`httpMethod`), headers y cuerpo (`httpBody`). Es un struct: lo armás con `var`, lo configurás y se lo pasás a la sesión.",
            "Para enviar JSON codificás un `Encodable` con `JSONEncoder` y declarás `Content-Type: application/json`. Para pedir JSON, `Accept: application/json`. Los nombres de header no distinguen mayúsculas: `value(forHTTPHeaderField:)` encuentra `content-type` igual.",
            "`timeoutInterval` es por request y por defecto vale 60 segundos. Ojo: es un timeout de **inactividad** (tiempo sin recibir datos), no la duración total.",
          ],
          code: swift`struct NewPost: Encodable {
    let title: String
}

var request = URLRequest(url: URL(string: "https://api.example.com/posts")!)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.httpBody = try JSONEncoder().encode(NewPost(title: "Hola"))
request.timeoutInterval = 15

print(request.httpMethod ?? "-")
print(request.value(forHTTPHeaderField: "content-type") ?? "-")
print(request.timeoutInterval)`,
          output: "POST\napplication/json\n15.0",
        },
        {
          kind: "predict",
          prompt: "¿Qué imprime un `URLRequest` recién creado, sin tocar nada?",
          code: swift`let request = URLRequest(url: URL(string: "https://api.example.com/posts")!)
print(request.httpMethod ?? "nil", request.timeoutInterval)`,
          options: ["`nil 60.0`", "`GET 60.0`", "`GET 0.0`", "`POST 60.0`"],
          answer: 1,
          explanation: "El método por defecto de `URLRequest` es `GET`, así que `httpMethod` no es `nil`. El `timeoutInterval` por defecto es 60 segundos y `print` de un `Double` muestra `60.0`. `print` separa los dos valores con un espacio.",
        },
        {
          kind: "explain",
          title: "data(for:) y el status code",
          body: [
            "`try await URLSession.shared.data(for: request)` devuelve `(Data, URLResponse)`. Para HTTP, la respuesta es en realidad un `HTTPURLResponse`, así que la casteás con `as?` para leer `statusCode` y headers.",
            "Clave de entrevista: `data(for:)` **solo lanza errores de transporte** (sin red, timeout, cancelación, TLS). Un 404 o un 500 es una respuesta HTTP válida: vuelve sin `throw` y sos vos quien tiene que validar el rango `200..<300`.",
            "Para un GET simple existe `data(from: url)`, pero en una capa de red real casi siempre usás `data(for:)` porque necesitás headers.",
          ],
          code: swift`func fetchData(_ request: URLRequest) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse else {
        throw URLError(.badServerResponse)
    }
    guard (200..<300).contains(http.statusCode) else {
        throw URLError(.badServerResponse) // en la próxima lección: errores propios
    }
    return data
}`,
        },
        {
          kind: "predict",
          prompt: "El servidor responde `404` con un JSON de error. ¿Qué se imprime?",
          code: swift`do {
    let (_, response) = try await URLSession.shared.data(for: request)
    print("sin throw:", (response as! HTTPURLResponse).statusCode)
} catch {
    print("throw:", error)
}`,
          options: [
            "`throw: ` seguido de un `URLError` de tipo `badServerResponse`",
            "`sin throw: 200`",
            "`sin throw: 404`",
            "Nada: el `await` queda esperando para siempre",
          ],
          answer: 2,
          explanation: "La request llegó al servidor y volvió una respuesta HTTP completa, así que no hay error de transporte: `data(for:)` no lanza. El `statusCode` es el real, `404`. Por eso siempre validás el status vos.",
        },
        {
          kind: "explain",
          title: "URLComponents para query items",
          body: [
            "Nunca armes la query concatenando strings (`\"?q=\" + text`): un espacio, una `ñ` o un `&` en lo que escribe el usuario te rompen la URL. `URLComponents` con `queryItems` codifica cada valor por vos.",
            "Detalle conocido: `URLComponents` no codifica el `+`, y muchos servidores lo leen como espacio. Si tus valores pueden traer `+`, reemplazalo por `%2B` en `percentEncodedQuery`.",
          ],
          code: swift`var components = URLComponents(string: "https://api.example.com/search")!
components.queryItems = [
    URLQueryItem(name: "q", value: "café con leche"),
    URLQueryItem(name: "page", value: "2"),
]
print(components.url!.absoluteString)`,
          output: "https://api.example.com/search?q=caf%C3%A9%20con%20leche&page=2",
        },
        {
          kind: "fill",
          prompt: "Completá la propiedad que agrega los parámetros de query ya codificados.",
          code: swift`var components = URLComponents(string: "https://api.example.com/posts")!
components.____ = [URLQueryItem(name: "page", value: "2")]`,
          accept: ["^queryItems$"],
          explanation: "`queryItems` recibe un array de `URLQueryItem` y `URLComponents` arma `?page=2` codificando cada valor.",
          placeholder: "propiedad",
        },
        {
          kind: "explain",
          title: "Timeouts y errores de transporte",
          body: [
            "En `URLSessionConfiguration`: `timeoutIntervalForRequest` es el máximo **sin recibir datos** (60 s por defecto) y `timeoutIntervalForResource` el máximo **total** de la transferencia (7 días por defecto). Para una API de app, bajá ambos.",
            "`waitsForConnectivity = true` hace que la sesión espere a que vuelva la red en vez de fallar al instante; la espera queda limitada por el timeout de recurso.",
            "Los errores de transporte llegan como `URLError`. Los que importan en la UI: `.notConnectedToInternet` y `.networkConnectionLost` (offline), `.timedOut` (ofrecé reintentar) y `.cancelled` (no mostrar nada: lo canceló tu propio código).",
          ],
          code: swift`let config = URLSessionConfiguration.default
config.timeoutIntervalForRequest = 15   // máx. sin recibir datos
config.timeoutIntervalForResource = 60  // máx. total
config.waitsForConnectivity = true
let session = URLSession(configuration: config)

do {
    _ = try await session.data(for: request)
} catch let error as URLError {
    switch error.code {
    case .notConnectedToInternet, .networkConnectionLost: showOfflineBanner()
    case .timedOut: showRetryButton()
    case .cancelled: break
    default: showGenericError()
    }
}`,
        },
        {
          kind: "write",
          prompt: "Escribí `fetchPosts(page:)`: GET a `https://api.example.com/posts` con el query item `page`, header `Accept: application/json`, validá que la respuesta sea `HTTPURLResponse` con status 2xx y decodificá `[Post]`.",
          starter: swift`struct Post: Decodable {
    let id: Int
    let title: String
}

func fetchPosts(page: Int) async throws -> [Post] {
    // GET https://api.example.com/posts con el query item "page"
    fatalError("TODO")
}`,
          checks: [
            { pattern: "URLComponents\\(", label: "arma la URL con `URLComponents`" },
            { pattern: "queryItems", label: "usa `queryItems` para `page`" },
            { pattern: "\\.data\\(for:", label: "envía con `data(for:)`" },
            { pattern: "as\\?\\s*HTTPURLResponse", label: "castea a `HTTPURLResponse`" },
            { pattern: "200\\.\\.<300|200\\.\\.\\.299", label: "valida el rango 2xx" },
            { pattern: "JSONDecoder\\(\\)", label: "decodifica con `JSONDecoder`" },
          ],
          warnings: [
            { pattern: "try!", label: "`try!` crashea ante cualquier error de red" },
            { pattern: "\\?page=", label: "query armada a mano: usá `URLQueryItem`" },
          ],
          solution: swift`struct Post: Decodable {
    let id: Int
    let title: String
}

func fetchPosts(page: Int) async throws -> [Post] {
    var components = URLComponents(string: "https://api.example.com/posts")!
    components.queryItems = [URLQueryItem(name: "page", value: String(page))]

    var request = URLRequest(url: components.url!)
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.timeoutInterval = 15

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse,
          (200..<300).contains(http.statusCode) else {
        throw URLError(.badServerResponse)
    }
    return try JSONDecoder().decode([Post].self, from: data)
}`,
          hint: "Orden: `URLComponents` → `URLRequest` → `data(for:)` → `guard` del status → `decode`.",
        },
      ],
    },
    {
      id: "api-client",
      title: "Un cliente de API testeable",
      goal: "Diseñar un `APIClient` con `Endpoint` tipado, `send` genérico, errores propios, reintentos con backoff, cancelación y refresh de token.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Endpoint tipado + HTTPClient inyectable",
          body: [
            "Un `Endpoint<Response>` describe una llamada (path, método, query, body) y **lleva el tipo de respuesta en el generic**. Así `send(.posts(page: 1))` ya sabe que devuelve `[Post]` sin castear nada.",
            "El cliente no usa `URLSession.shared` directamente: depende de un protocolo `HTTPClient`. En producción lo cumple `URLSession`; en los tests, un stub que devuelve el status y el JSON que quieras sin tocar la red.",
            "Este es el patrón que esperan ver en un PR de capa de red: una sola función genérica que arma la request, envía, valida y decodifica.",
          ],
          code: swift`struct Endpoint<Response: Decodable> {
    var path: String
    var method = "GET"
    var queryItems: [URLQueryItem] = []
    var body: Data? = nil
}

extension Endpoint where Response == [Post] {
    static func posts(page: Int) -> Self {
        Endpoint(path: "/posts", queryItems: [URLQueryItem(name: "page", value: String(page))])
    }
}

protocol HTTPClient: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPClient {
    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        try await data(for: request)
    }
}

// En tests: sin red, respuesta controlada
struct StubHTTPClient: HTTPClient {
    let statusCode: Int
    let body: Data

    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        let response = HTTPURLResponse(url: request.url!, statusCode: statusCode,
                                       httpVersion: nil, headerFields: nil)!
        return (body, response)
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la restricción del generic para que `send` pueda decodificar cualquier respuesta.",
          code: swift`func send<T: ____>(_ endpoint: Endpoint<T>) async throws -> T`,
          accept: ["^Decodable$", "^Codable$"],
          explanation: "`T: Decodable` alcanza para `JSONDecoder().decode(T.self, from:)`. `Codable` también compila, pero exige `Encodable` sin necesidad.",
          placeholder: "protocolo",
        },
        {
          kind: "explain",
          title: "Errores propios: mapear todo a pocos casos",
          body: [
            "La UI no debería conocer `URLError`, códigos HTTP ni `DecodingError`. El cliente los traduce a un `APIError` chico, y cada caso tiene un mensaje útil para el usuario.",
            "Buckets típicos: **offline** (sin red o timeout), **unauthorized** (401: refrescar token o pedir login), **server** (5xx: reintentable), **client** (otros 4xx: no insistas) y **decoding** (el contrato cambió: avisá a backend, no al usuario).",
            "`URLError.cancelled` no se mapea: se deja pasar y la UI lo ignora.",
          ],
          code: swift`enum APIError: Error, Equatable {
    case offline
    case unauthorized
    case client(Int)
    case server(Int)
    case decoding
}

func mapStatus(_ code: Int) -> APIError? {
    switch code {
    case 200..<300: return nil
    case 401: return .unauthorized
    case 500..<600: return .server(code)
    default: return .client(code)
    }
}

extension APIError {
    var userMessage: String {
        switch self {
        case .offline: "Sin conexión. Te mostramos lo último guardado."
        case .unauthorized: "Tu sesión expiró. Volvé a iniciar sesión."
        case .server: "El servicio tiene problemas. Probá en un rato."
        case .client, .decoding: "Algo salió mal. Ya lo estamos revisando."
        }
    }
}

for code in [204, 401] {
    if let error = mapStatus(code) { print(error.userMessage) } else { print("ok") }
}`,
          output: "ok\nTu sesión expiró. Volvé a iniciar sesión.",
        },
        {
          kind: "predict",
          code: swift`for code in [200, 401, 404, 502] {
    if let error = mapStatus(code) {
        print(error)
    } else {
        print("ok")
    }
}`,
          options: [
            "`ok`, `unauthorized`, `client(404)`, `server(502)`",
            "`ok`, `unauthorized`, `client(404)`, `client(502)`",
            "`ok`, `client(401)`, `client(404)`, `server(502)`",
            "`nil`, `unauthorized`, `client(404)`, `server(502)`",
          ],
          answer: 0,
          explanation: "200 cae en `200..<300` → `nil` → imprime `ok`. 401 tiene su caso propio antes del `default`. 404 no es 401 ni 5xx → `client(404)`. 502 está en `500..<600` → `server(502)`. `print` de un enum con valor asociado muestra `caso(valor)`.",
        },
        {
          kind: "explain",
          title: "Reintentos con backoff exponencial",
          body: [
            "Reintentá solo lo **transitorio**: offline/timeout, 5xx, 429. Nunca un 400, 401 o 422: va a fallar igual. Y cuidado con POST: sin `Idempotency-Key` un reintento puede duplicar la operación.",
            "Backoff exponencial: esperás 0,5 s, 1 s, 2 s… para no martillar a un servidor caído. En producción se suma *jitter* (un random) para que miles de apps no reintenten al mismo tiempo.",
            "`Task.sleep(for:)` lanza `CancellationError` si cancelan la tarea, así que el reintento se corta solo cuando el usuario sale de la pantalla.",
          ],
          code: swift`extension APIError {
    var isRetryable: Bool {
        switch self {
        case .offline, .server: return true
        case .unauthorized, .client, .decoding: return false
        }
    }
}

func withRetry<T>(
    maxAttempts: Int = 3,
    initialDelay: Duration = .milliseconds(500),
    _ operation: () async throws -> T
) async throws -> T {
    var delay = initialDelay
    for _ in 1..<maxAttempts {
        do {
            return try await operation()
        } catch let error as APIError where error.isRetryable {
            try await Task.sleep(for: delay)
            delay *= 2
        }
    }
    return try await operation() // último intento: el error sube
}`,
        },
        {
          kind: "predict",
          prompt: "Simulamos las esperas de `withRetry` con `maxAttempts: 4` y todas las llamadas fallando con `.server(503)`. ¿Qué imprime?",
          code: swift`var delay = 0.5
var waits: [Double] = []
for _ in 1..<4 {
    waits.append(delay)
    delay *= 2
}
print(waits)`,
          options: ["`[0.5, 1.0, 2.0, 4.0]`", "`[0.5, 0.5, 0.5]`", "`[1.0, 2.0, 4.0]`", "`[0.5, 1.0, 2.0]`"],
          answer: 3,
          explanation: "`1..<4` itera 3 veces (1, 2, 3): hay 3 esperas entre 4 intentos. Arranca en 0.5 y se duplica: 0.5, 1.0, 2.0. El cuarto intento no espera después: si falla, el error sube.",
        },
        {
          kind: "explain",
          title: "Cancelación y token de acceso",
          body: [
            "Si la `Task` que llama a `data(for:)` se cancela (por ejemplo, `.task` de SwiftUI cuando la vista desaparece), URLSession corta la request y lanza `URLError` con código `.cancelled`. No es un error para el usuario: atrapalo y no muestres nada.",
            "El token va en `Authorization: Bearer <token>`. Ante un 401, refrescás **una vez** y reintentás **una vez**; si vuelve a fallar, cerrás sesión.",
            "Si cinco requests reciben 401 a la vez, tienen que compartir un único refresh. Un `actor` que guarda la `Task` del refresh en curso lo resuelve (el detalle completo está en los cursos de concurrencia y seguridad).",
          ],
          code: swift`actor TokenStore {
    private var accessToken: String
    private var refreshTask: Task<String, Error>?
    private let refresher: @Sendable () async throws -> String

    init(accessToken: String, refresher: @escaping @Sendable () async throws -> String) {
        self.accessToken = accessToken
        self.refresher = refresher
    }

    func current() -> String { accessToken }

    func refresh() async throws -> String {
        if let refreshTask { return try await refreshTask.value } // ya hay uno en curso
        let task = Task { try await refresher() }
        refreshTask = task
        defer { refreshTask = nil }
        accessToken = try await task.value
        return accessToken
    }
}

// En APIClient
func sendAuthorized<T: Decodable>(_ endpoint: Endpoint<T>) async throws -> T {
    do {
        return try await send(endpoint, token: await tokens.current())
    } catch APIError.unauthorized {
        return try await send(endpoint, token: try await tokens.refresh())
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el código de `URLError` que aparece cuando tu propia `Task` se cancela, para no mostrar un error al usuario.",
          code: swift`do {
    posts = try await api.send(.posts(page: 1))
} catch let error as URLError where error.code == .____ {
    return // el usuario salió de la pantalla
} catch {
    errorMessage = (error as? APIError)?.userMessage ?? "Algo salió mal."
}`,
          accept: ["^cancelled$"],
          explanation: "URLSession traduce la cancelación de la `Task` a `URLError(.cancelled)`. Se ignora en silencio; en código que no usa URLSession, la cancelación suele llegar como `CancellationError`.",
          placeholder: "código",
        },
        {
          kind: "write",
          prompt: "Completá `send` del `APIClient`: enviá con el `http` inyectado, mapeá 401 → `.unauthorized`, 5xx → `.server`, otros no-2xx → `.client`, y un `DecodingError` → `.decoding`.",
          starter: swift`struct APIClient: Sendable {
    let baseURL: URL
    let http: any HTTPClient

    func send<T: Decodable>(_ endpoint: Endpoint<T>) async throws -> T {
        let request = makeRequest(endpoint)
        // TODO: enviar, validar el status y decodificar
        fatalError("TODO")
    }
}`,
          checks: [
            { pattern: "http\\.send\\(", label: "usa el `HTTPClient` inyectado" },
            { pattern: "as\\?\\s*HTTPURLResponse", label: "castea a `HTTPURLResponse`" },
            { pattern: "\\b401\\b", label: "trata el 401 aparte" },
            { pattern: "500\\.\\.<600|500\\.\\.\\.599", label: "agrupa los 5xx" },
            { pattern: "DecodingError", label: "atrapa `DecodingError`" },
            { pattern: "\\.decoding\\b", label: "lo mapea a `.decoding`" },
          ],
          warnings: [
            { pattern: "URLSession\\.shared", label: "`URLSession.shared` directo: el cliente deja de ser testeable" },
            { pattern: "try!", label: "`try!` convierte un JSON raro en un crash" },
          ],
          solution: swift`struct APIClient: Sendable {
    let baseURL: URL
    let http: any HTTPClient

    func send<T: Decodable>(_ endpoint: Endpoint<T>) async throws -> T {
        let request = makeRequest(endpoint)
        let (data, response) = try await http.send(request)
        guard let status = (response as? HTTPURLResponse)?.statusCode else {
            throw APIError.server(0)
        }
        switch status {
        case 200..<300: break
        case 401: throw APIError.unauthorized
        case 500..<600: throw APIError.server(status)
        default: throw APIError.client(status)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch is DecodingError {
            throw APIError.decoding
        }
    }
}`,
          hint: "Un `switch status` con `case 200..<300: break` y después el `decode` dentro de un `do/catch is DecodingError`.",
        },
      ],
    },
    {
      id: "pagination-search",
      title: "Paginación y búsqueda",
      goal: "Elegir entre página y cursor, hacer scroll infinito sin duplicados ni requests dobles y una búsqueda con debounce que cancela la anterior.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Página vs cursor",
          body: [
            "**Por página/offset** (`?page=3&limit=20`): simple, permite saltar a la página N. Problema: si entran ítems nuevos arriba mientras scrolleás, todo se corre y ves repetidos (o te salteás algunos).",
            "**Por cursor** (`?cursor=abc&limit=20`): el servidor te devuelve un `nextCursor` opaco que apunta a \"después del último que viste\". Es estable aunque cambien los datos; es lo que usan los feeds. `nextCursor == nil` significa que no hay más.",
          ],
          code: swift`// Página: GET /posts?page=3&limit=20
// Cursor: GET /feed?cursor=eyJpZCI6MTIwfQ&limit=20

struct Post: Decodable, Identifiable, Sendable {
    let id: Int
    let title: String
}

struct FeedPage: Decodable, Sendable {
    let items: [Post]
    let nextCursor: String? // nil = no hay más
}

protocol PostsAPI: Sendable {
    func feed(cursor: String?) async throws -> FeedPage
    func search(_ query: String) async throws -> [Post]
}`,
        },
        {
          kind: "predict",
          prompt: "Paginación por offset, 10 ítems por página. Cargaste la página 1 (posts 1 a 10). Antes de pedir la página 2 se publican 2 posts nuevos arriba de todo. ¿Qué trae la página 2?",
          code: swift`GET /posts?page=1&limit=10  → posts 1...10
// se publican 2 posts nuevos al principio
GET /posts?page=2&limit=10  → ?`,
          options: [
            "Los posts 11 a 20, como si nada",
            "Los posts 9 a 18: el 9 y el 10 aparecen repetidos",
            "Los 2 posts nuevos y después del 11 al 18",
            "Un error 409 porque cambió la lista",
          ],
          answer: 1,
          explanation: "El offset de la página 2 es 10. Con 2 ítems nuevos arriba, todo se corrió 2 lugares: las posiciones 11 a 20 ahora son los viejos posts 9 a 18. El 9 y el 10 ya estaban en pantalla → duplicados. Con cursor no pasa.",
        },
        {
          kind: "explain",
          title: "Scroll infinito sin duplicados",
          body: [
            "Tres guardas: `isLoading` (que dos `onAppear` seguidos no disparen dos requests de la misma página), `hasMore` (no pedir después del final) y un `Set` de ids vistos (por si el servidor repite algo igual).",
            "`seen.insert(id).inserted` devuelve `true` solo la primera vez: sirve como filtro de una línea.",
            "Disparás la carga cuando aparece la última fila. Con `@Observable` (iOS 17) la vista se actualiza sola; en código previo sería un `ObservableObject` con `@Published`.",
          ],
          code: swift`@Observable @MainActor
final class FeedViewModel {
    private(set) var posts: [Post] = []
    private(set) var isLoading = false
    private var nextCursor: String?
    private var hasMore = true
    private var seen = Set<Int>()
    private let api: any PostsAPI

    init(api: any PostsAPI) { self.api = api }

    func loadNextPage() async {
        guard !isLoading, hasMore else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await api.feed(cursor: nextCursor)
            posts += page.items.filter { seen.insert($0.id).inserted }
            nextCursor = page.nextCursor
            hasMore = page.nextCursor != nil
        } catch {
            // ver lección 2: mapear a APIError.userMessage
        }
    }
}

// En la vista
List(viewModel.posts) { post in
    Text(post.title)
        .onAppear {
            if post.id == viewModel.posts.last?.id {
                Task { await viewModel.loadNextPage() }
            }
        }
}`,
        },
        {
          kind: "predict",
          code: swift`var seen: Set<Int> = [1, 2]
let page = [2, 3, 3, 4]
let fresh = page.filter { seen.insert($0).inserted }
print(fresh)`,
          options: ["`[3, 4]`", "`[2, 3, 3, 4]`", "`[3, 3, 4]`", "`[1, 2, 3, 4]`"],
          answer: 0,
          explanation: "El 2 ya estaba → `inserted == false`, se descarta. El primer 3 se inserta (`true`). El segundo 3 ya está → se descarta. El 4 se inserta. Quedan `[3, 4]`: el filtro elimina duplicados contra lo viejo y dentro de la misma página.",
        },
        {
          kind: "fill",
          prompt: "Completá la segunda guarda para no pedir páginas después del final del feed.",
          code: swift`func loadNextPage() async {
    guard !isLoading, ____ else { return }
    isLoading = true
    defer { isLoading = false }
    // ...
}`,
          accept: ["^hasMore$", "^self\\.hasMore$", "^hasMore\\s*==\\s*true$"],
          explanation: "`hasMore` pasa a `false` cuando el servidor devuelve `nextCursor == nil`. Sin esa guarda, cada vez que aparece la última fila volvés a pedir una página vacía.",
          placeholder: "condición",
        },
        {
          kind: "explain",
          title: "Búsqueda con debounce que cancela la anterior",
          body: [
            "Si buscás en cada tecla, \"swift\" son 5 requests, y la respuesta de \"sw\" puede llegar **después** que la de \"swift\" y pisarla. Solución: esperar unos 300 ms de quietud (debounce) y cancelar la búsqueda anterior.",
            "Cada cambio cancela la `Task` previa y crea una nueva que duerme 300 ms. Si llega otra tecla, la anterior se cancela durante el `sleep` y nunca hace la request. Antes de asignar resultados, chequeás `Task.isCancelled` para no pintar una respuesta vieja.",
            "En SwiftUI puro, `.task(id: query)` hace lo mismo: cancela la tarea anterior cada vez que cambia `query`, y adentro ponés el `Task.sleep`.",
          ],
          code: swift`@Observable @MainActor
final class SearchViewModel {
    private(set) var results: [Post] = []
    private var searchTask: Task<Void, Never>?
    private let api: any PostsAPI

    init(api: any PostsAPI) { self.api = api }

    func queryChanged(_ query: String) {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            let found = (try? await api.search(query)) ?? []
            guard !Task.isCancelled else { return }
            results = found
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Con el `SearchViewModel` de arriba, el usuario escribe `s`, `sw` y `swi` con 100 ms entre teclas y después se queda quieto. ¿Cuántas requests de búsqueda salen?",
          code: swift`t = 0 ms    queryChanged("s")
t = 100 ms  queryChanged("sw")
t = 200 ms  queryChanged("swi")
// nada más`,
          options: ["3", "0", "1", "2"],
          answer: 2,
          explanation: "La tarea de `s` se cancela a los 100 ms, durante su `sleep` de 300 ms; `Task.isCancelled` es `true` y sale sin pedir. Lo mismo con `sw` a los 200 ms. Solo la de `swi` completa el `sleep` (a los 500 ms) y hace 1 request.",
        },
        {
          kind: "write",
          prompt: "Implementá `queryChanged` con debounce de 300 ms: cancelá la búsqueda anterior, guardá la nueva `Task` en `searchTask` y no asignes resultados si la tarea fue cancelada.",
          starter: swift`@Observable @MainActor
final class SearchViewModel {
    private(set) var results: [Post] = []
    private var searchTask: Task<Void, Never>?
    private let api: any PostsAPI

    init(api: any PostsAPI) { self.api = api }

    func queryChanged(_ query: String) {
        // TODO
    }
}`,
          checks: [
            { pattern: "searchTask\\?\\.cancel\\(\\)", label: "cancela la búsqueda anterior" },
            { pattern: "searchTask\\s*=\\s*Task", label: "guarda la nueva `Task`" },
            { pattern: "Task\\.sleep\\(", label: "espera con `Task.sleep`" },
            { pattern: "Task\\.isCancelled|Task\\.checkCancellation", label: "chequea cancelación antes de asignar" },
          ],
          warnings: [
            { pattern: "DispatchQueue", label: "`DispatchQueue.asyncAfter` no se cancela junto con la `Task`" },
            { pattern: "Timer\\.", label: "`Timer` es la forma vieja; usá `Task.sleep`" },
          ],
          solution: swift`@Observable @MainActor
final class SearchViewModel {
    private(set) var results: [Post] = []
    private var searchTask: Task<Void, Never>?
    private let api: any PostsAPI

    init(api: any PostsAPI) { self.api = api }

    func queryChanged(_ query: String) {
        searchTask?.cancel()
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            results = []
            return
        }
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            do {
                let found = try await api.search(trimmed)
                guard !Task.isCancelled else { return }
                results = found
            } catch {
                // cancelada o sin red: se mantienen los resultados anteriores
            }
        }
    }
}`,
          hint: "Primera línea: `searchTask?.cancel()`. Adentro de la `Task`: `sleep`, `guard !Task.isCancelled`, buscar, otro `guard`, asignar.",
        },
      ],
    },
    {
      id: "images-caching",
      title: "Imágenes y caché",
      goal: "Saber cuándo alcanza `AsyncImage`, usar `NSCache` y `URLCache`, escribir un loader de imágenes sin descargas duplicadas y reducir memoria con downsampling.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "AsyncImage y sus límites",
          body: [
            "`AsyncImage` resuelve un avatar o una pantalla de detalle en tres líneas: descarga, muestra un placeholder y maneja el error con `phase`.",
            "Límites en un feed: usa la sesión compartida, así que la caché depende de `URLCache` y de los headers del servidor; en listas puede volver a descargar al reaparecer una celda; no podés agregar headers (por ejemplo, auth) y decodifica la imagen a tamaño completo aunque la muestres a 80 pt.",
            "Para listas largas con muchas imágenes se usa un loader propio (o una librería como Kingfisher/Nuke), con caché en memoria y downsampling.",
          ],
          code: swift`AsyncImage(url: post.imageURL) { phase in
    switch phase {
    case .empty:
        ProgressView()
    case .success(let image):
        image.resizable().scaledToFill()
    case .failure:
        Image(systemName: "photo")
    @unknown default:
        EmptyView()
    }
}
.frame(width: 80, height: 80)
.clipped()`,
        },
        {
          kind: "predict",
          prompt: "Una foto de cámara de 4000 × 3000 píxeles pesa 3 MB en JPEG. ¿Cuánta memoria ocupa aproximadamente al decodificarla para mostrarla (RGBA, 4 bytes por píxel)?",
          code: swift`let width = 4000, height = 3000
let jpegBytes = 3_000_000
// memoria decodificada ≈ ?`,
          options: ["≈ 3 MB, lo mismo que el JPEG", "≈ 12 MB", "≈ 192 MB", "≈ 48 MB"],
          answer: 3,
          explanation: "La memoria de una imagen decodificada depende de los píxeles, no del archivo: 4000 × 3000 × 4 = 48.000.000 bytes ≈ 48 MB. Diez de esas en un feed y la app muere por memoria. Por eso se hace downsampling.",
        },
        {
          kind: "explain",
          title: "NSCache y URLCache",
          body: [
            "`NSCache` es una caché **en memoria**, thread-safe, que el sistema vacía solo bajo presión de memoria. Claves y valores tienen que ser clases: `NSCache<NSURL, UIImage>`. Le ponés `countLimit` y `totalCostLimit` y, al guardar, un `cost` aproximado.",
            "`URLCache` es la caché **HTTP** de `URLSession`, en memoria y en disco. Guarda respuestas según los headers del servidor (`Cache-Control`, `ETag`). Agrandar `URLCache.shared` al arrancar ayuda a `AsyncImage` y a cualquier GET cacheable.",
            "No son excluyentes: `URLCache` evita la red; `NSCache` evita decodificar de nuevo.",
          ],
          code: swift`let imageCache = NSCache<NSURL, UIImage>()
imageCache.countLimit = 200
imageCache.totalCostLimit = 100 * 1024 * 1024 // ~100 MB

// Al arrancar la app
URLCache.shared = URLCache(
    memoryCapacity: 20 * 1024 * 1024,
    diskCapacity: 200 * 1024 * 1024,
    directory: nil
)`,
        },
        {
          kind: "fill",
          prompt: "Completá el tipo de clave: `NSCache` exige clases, así que un `URL` (struct) no sirve directo.",
          code: swift`let cache = NSCache<____, UIImage>()
cache.setObject(image, forKey: url as NSURL)`,
          accept: ["^NSURL$", "^NSString$"],
          explanation: "`NSURL` es la versión clase de `URL`; se convierte con `url as NSURL`. `NSString` también funciona si usás `url.absoluteString as NSString`.",
          placeholder: "tipo",
        },
        {
          kind: "explain",
          title: "Un loader de imágenes chico",
          body: [
            "Un `actor` protege el estado: la caché y un diccionario de descargas **en curso**. Si dos celdas piden la misma URL a la vez, la segunda espera la misma `Task` en lugar de descargar de nuevo.",
            "Fijate que entre leer `inFlight[url]` y guardar la nueva `Task` no hay ningún `await`: por eso la reentrancia del actor no puede colar una segunda descarga.",
          ],
          code: swift`actor ImageLoader {
    private let cache = NSCache<NSURL, UIImage>()
    private var inFlight: [URL: Task<UIImage, Error>] = [:]

    func image(for url: URL) async throws -> UIImage {
        if let cached = cache.object(forKey: url as NSURL) { return cached }
        if let task = inFlight[url] { return try await task.value }

        let task = Task {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let image = UIImage(data: data) else {
                throw URLError(.cannotDecodeContentData)
            }
            return image
        }
        inFlight[url] = task
        defer { inFlight[url] = nil }

        let image = try await task.value
        cache.setObject(image, forKey: url as NSURL)
        return image
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Dos celdas llaman a `loader.image(for: url)` con la misma URL casi al mismo tiempo, y la imagen no está en caché. ¿Cuántas descargas hace el `ImageLoader` de arriba?",
          code: swift`async let a = loader.image(for: url)
async let b = loader.image(for: url)
let (first, second) = try await (a, b)`,
          options: [
            "1: la segunda llamada encuentra la `Task` en `inFlight` y la espera",
            "2: cada llamada descarga por su cuenta",
            "0: la segunda llamada cancela a la primera",
            "Depende del orden: a veces 1, a veces 2, por reentrancia",
          ],
          answer: 0,
          explanation: "El actor ejecuta una llamada a la vez hasta el primer `await`. La primera revisa caché e `inFlight`, crea la `Task` y la guarda **sin suspender** en el medio. Cuando la segunda entra, ya la encuentra en `inFlight` y espera la misma. Si hubiera un `await` entre el chequeo y el guardado, sí podrían salir 2.",
        },
        {
          kind: "explain",
          title: "Downsampling: decodificar al tamaño que mostrás",
          body: [
            "Si la miniatura se ve a 100 × 100 pt en un iPhone @3x, necesitás 300 × 300 píxeles, no 4000 × 3000. Con ImageIO creás una miniatura directo desde los bytes, sin decodificar la imagen grande.",
            "`kCGImageSourceShouldCache: false` evita que se decodifique el original; `kCGImageSourceThumbnailMaxPixelSize` fija el lado mayor en píxeles. Desde iOS 15 también existe `UIImage.preparingThumbnail(of:)` para casos simples.",
            "Hacelo fuera del main thread (por ejemplo, dentro del `ImageLoader`) y cacheá el resultado ya reducido.",
          ],
          code: swift`import ImageIO
import UIKit

func downsample(_ data: Data, to pointSize: CGSize, scale: CGFloat) -> UIImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions) else {
        return nil
    }
    let maxPixels = max(pointSize.width, pointSize.height) * scale
    let options = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceShouldCacheImmediately: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixels,
    ] as CFDictionary
    guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else {
        return nil
    }
    return UIImage(cgImage: cgImage)
}`,
        },
        {
          kind: "predict",
          prompt: "Misma foto, ahora reducida para una miniatura de 100 × 100 pt en pantalla @3x. ¿Qué imprime?",
          code: swift`let side = 100.0 * 3.0
let bytes = Int(side * side * 4)
print(bytes)`,
          options: ["`40000`", "`120000`", "`360000`", "`1440000`"],
          answer: 2,
          explanation: "100 pt × 3 = 300 píxeles de lado. 300 × 300 × 4 bytes = 360000 bytes ≈ 0,36 MB, contra ≈ 48 MB del original: más de 100 veces menos. `Int(...)` convierte el `Double` 360000.0 a `360000`.",
        },
        {
          kind: "write",
          prompt: "Completá `image(for:)`: devolvé la imagen de la caché si está; si no, descargala de forma asíncrona, convertila con `UIImage(data:)` (lanzá un error si falla) y guardala en la caché antes de devolverla.",
          starter: swift`actor ImageLoader {
    private let cache = NSCache<NSURL, UIImage>()

    func image(for url: URL) async throws -> UIImage {
        // TODO
        fatalError("TODO")
    }
}`,
          checks: [
            { pattern: "cache\\.object\\(forKey:", label: "busca primero en la caché" },
            { pattern: "\\.data\\((from|for):", label: "descarga con `URLSession` async" },
            { pattern: "UIImage\\(data:", label: "decodifica con `UIImage(data:)`" },
            { pattern: "cache\\.setObject\\(", label: "guarda el resultado en la caché" },
          ],
          warnings: [
            { pattern: "Data\\(contentsOf:", label: "`Data(contentsOf:)` con una URL remota bloquea el hilo" },
            { pattern: "try!", label: "`try!` crashea si falla la descarga" },
          ],
          solution: swift`actor ImageLoader {
    private let cache = NSCache<NSURL, UIImage>()

    func image(for url: URL) async throws -> UIImage {
        if let cached = cache.object(forKey: url as NSURL) {
            return cached
        }
        let (data, _) = try await URLSession.shared.data(from: url)
        guard let image = UIImage(data: data) else {
            throw URLError(.cannotDecodeContentData)
        }
        cache.setObject(image, forKey: url as NSURL, cost: data.count)
        return image
    }
}`,
          hint: "`if let cached = cache.object(forKey: url as NSURL) { return cached }` y después la descarga.",
        },
      ],
    },
    {
      id: "persistence",
      title: "Persistencia local y offline-first",
      goal: "Elegir dónde guardar cada dato (`UserDefaults`, archivos, Keychain, SwiftData/Core Data) y armar un repositorio con la base local como fuente de verdad.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Dónde va cada cosa",
          body: [
            "**`UserDefaults`**: preferencias chicas (tema, último tab, flags de onboarding). No es para listas grandes ni para secretos: se guarda en un plist sin cifrar y se carga entero. En SwiftUI, `@AppStorage` lo envuelve.",
            "**Archivos**: `Documents` para contenido del usuario (se respalda en iCloud), `Application Support` para datos internos de la app, `Caches` para lo que se puede volver a bajar (el sistema puede borrarlo si falta espacio).",
            "**Keychain**: tokens, contraseñas, claves. Cifrado y fuera del sandbox de archivos (el detalle está en el curso de seguridad). **SwiftData/Core Data**: datos estructurados con consultas, relaciones y cambios incrementales.",
          ],
          code: swift`let defaults = UserDefaults.standard
defaults.set(true, forKey: "prefersCompactFeed")

print(defaults.bool(forKey: "prefersCompactFeed"))
print(defaults.integer(forKey: "missingKey"))

// En SwiftUI
struct SettingsView: View {
    @AppStorage("prefersCompactFeed") private var compact = false
    var body: some View { Toggle("Feed compacto", isOn: $compact) }
}`,
          output: "true\n0",
        },
        {
          kind: "predict",
          prompt: "Querés guardar el JSON de la primera página del feed (unos 2 MB) para mostrarlo al abrir la app sin red. Si se pierde, se vuelve a bajar. ¿Dónde va?",
          code: swift`let data = try JSONEncoder().encode(firstPage)
// ¿dónde lo escribo?`,
          options: [
            "`UserDefaults`, bajo la clave `feedCache`",
            "Keychain, para que no lo lean otras apps",
            "Un archivo en `Caches`",
            "Un archivo en `Documents`",
          ],
          answer: 2,
          explanation: "Es un dato reconstruible: va en `Caches`, que no se respalda y el sistema puede limpiar. `UserDefaults` se carga entero en memoria y no es para 2 MB. Keychain es para secretos chicos. `Documents` es para contenido del usuario y se respalda en iCloud.",
        },
        {
          kind: "explain",
          title: "Archivos con FileManager",
          body: [
            "Desde iOS 16 tenés atajos: `URL.cachesDirectory`, `URL.documentsDirectory`, `URL.applicationSupportDirectory`, y `appending(path:)` para armar la ruta.",
            "Escribí con `.atomic`: primero va a un archivo temporal y después se renombra, así un crash a mitad de camino no te deja un JSON cortado. Antes de leer, chequeá que el archivo exista (en el primer arranque no hay nada).",
          ],
          code: swift`let file = URL.cachesDirectory.appending(path: "feed.json")

// Guardar
let data = try JSONEncoder().encode(posts)
try data.write(to: file, options: .atomic)

// Leer
if FileManager.default.fileExists(atPath: file.path()) {
    let saved = try JSONDecoder().decode([Post].self, from: Data(contentsOf: file))
    print(saved.count)
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el directorio adecuado para un caché que se puede volver a descargar.",
          code: swift`let file = URL.____.appending(path: "feed.json")`,
          accept: ["^cachesDirectory$"],
          explanation: "`URL.cachesDirectory` (iOS 16+) apunta a `Library/Caches`: no se respalda y el sistema puede vaciarlo, que es justo lo que querés para un caché.",
          placeholder: "directorio",
        },
        {
          kind: "write",
          prompt: "Escribí `FilePostStore` con `save(_:)` y `load()`: guardá `[Post]` como JSON en `Caches` con escritura atómica, y en `load()` devolvé `[]` si el archivo todavía no existe.",
          starter: swift`struct Post: Codable, Identifiable {
    let id: Int
    let title: String
}

struct FilePostStore {
    func save(_ posts: [Post]) throws {
        // TODO
    }

    func load() throws -> [Post] {
        // TODO: si no hay archivo, devolver []
        []
    }
}`,
          checks: [
            { pattern: "cachesDirectory", label: "usa el directorio `Caches`" },
            { pattern: "JSONEncoder\\(\\)\\.encode", label: "codifica con `JSONEncoder`" },
            { pattern: "\\.atomic", label: "escribe con `.atomic`" },
            { pattern: "JSONDecoder\\(\\)\\.decode", label: "decodifica con `JSONDecoder`" },
            { pattern: "fileExists|try\\?|catch", label: "contempla que el archivo no exista" },
          ],
          warnings: [
            { pattern: "UserDefaults", label: "`UserDefaults` no es para listas grandes" },
            { pattern: "documentsDirectory|documentDirectory", label: "`Documents` es para contenido del usuario y se respalda; un caché va en `Caches`" },
          ],
          solution: swift`struct Post: Codable, Identifiable {
    let id: Int
    let title: String
}

struct FilePostStore {
    private let fileURL = URL.cachesDirectory.appending(path: "feed.json")

    func save(_ posts: [Post]) throws {
        let data = try JSONEncoder().encode(posts)
        try data.write(to: fileURL, options: .atomic)
    }

    func load() throws -> [Post] {
        guard FileManager.default.fileExists(atPath: fileURL.path()) else { return [] }
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode([Post].self, from: data)
    }
}`,
          hint: "Guardá la URL en una propiedad: `URL.cachesDirectory.appending(path: \"feed.json\")`.",
        },
        {
          kind: "explain",
          title: "SwiftData y Core Data",
          body: [
            "**SwiftData** (iOS 17): marcás una clase con `@Model`, registrás el contenedor con `.modelContainer(for:)` y la vista lee con `@Query`, que se actualiza sola cuando insertás o borrás en el `modelContext`. `@Attribute(.unique)` hace que insertar un id repetido actualice en lugar de duplicar (upsert).",
            "**Core Data** sigue en la mayoría de las apps con años encima: `NSPersistentContainer`, `viewContext` para el main thread y contextos de background para importar. En una app existente no se reescribe todo: se aísla detrás de un repositorio y se migra por partes si aporta valor.",
            "En los dos casos, la vista no debería saber si los datos vinieron de red o de disco: eso lo decide el repositorio.",
          ],
          code: swift`import SwiftData

@Model
final class CachedPost {
    @Attribute(.unique) var remoteID: Int
    var title: String
    var publishedAt: Date

    init(remoteID: Int, title: String, publishedAt: Date) {
        self.remoteID = remoteID
        self.title = title
        self.publishedAt = publishedAt
    }
}

@main
struct FeedApp: App {
    var body: some Scene {
        WindowGroup { FeedView() }
            .modelContainer(for: CachedPost.self)
    }
}

struct FeedView: View {
    @Query(sort: \CachedPost.publishedAt, order: .reverse) private var posts: [CachedPost]
    @Environment(\.modelContext) private var context

    var body: some View {
        List(posts) { post in Text(post.title) }
    }
}

// Core Data en una app existente
let container = NSPersistentContainer(name: "Model")
container.loadPersistentStores { _, error in
    if let error { fatalError("Core Data: \(error)") }
}
let viewContext = container.viewContext // solo main thread`,
        },
        {
          kind: "predict",
          prompt: "Al terminar un refresh, el repositorio hace `context.insert(CachedPost(...))` con un post nuevo. ¿Qué pasa con `FeedView`?",
          code: swift`@Query(sort: \CachedPost.publishedAt, order: .reverse)
private var posts: [CachedPost]

// en otro lado, mismo ModelContainer:
context.insert(CachedPost(remoteID: 99, title: "Nuevo", publishedAt: .now))`,
          options: [
            "Nada hasta que llames a `context.save()` y recargues la vista a mano",
            "`@Query` detecta el cambio y la lista se actualiza sola, ordenada",
            "Crashea: no se puede insertar mientras hay un `@Query` activo",
            "Se actualiza solo si `CachedPost` es `ObservableObject`",
          ],
          answer: 1,
          explanation: "`@Query` observa el `ModelContext` y vuelve a evaluar el fetch cuando cambian los modelos de ese tipo, respetando el `sort`. No hace falta recargar a mano; `@Model` ya hace a la clase observable (no es `ObservableObject`).",
        },
        {
          kind: "explain",
          title: "Offline-first: la base local manda",
          body: [
            "Offline-first = la UI siempre lee de lo local. El repositorio: 1) emite lo guardado al instante, 2) pide a la red, 3) guarda, 4) emite lo nuevo. Si no hay red, el usuario igual ve algo y un aviso.",
            "`NWPathMonitor` (framework `Network`) te avisa cuando cambia la conectividad. Usalo para mostrar un banner y para resincronizar al volver la red, **no** para bloquear requests: el monitor puede equivocarse, así que igual intentás la llamada.",
          ],
          code: swift`struct FeedRepository: Sendable {
    let api: any PostsAPI
    let store: FilePostStore

    func posts() -> AsyncThrowingStream<[Post], Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                if let cached = try? store.load(), !cached.isEmpty {
                    continuation.yield(cached)            // 1. local
                }
                do {
                    let fresh = try await api.feed(cursor: nil).items
                    try store.save(fresh)                 // 3. guardar
                    continuation.yield(fresh)             // 4. lo nuevo
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

import Network

let monitor = NWPathMonitor()
monitor.pathUpdateHandler = { path in
    print(path.status == .satisfied ? "online" : "offline")
}
monitor.start(queue: DispatchQueue(label: "network.monitor"))`,
        },
        {
          kind: "predict",
          prompt: "Con el `FeedRepository.posts()` de arriba: no hay red y en disco hay 20 posts guardados. ¿Qué recibe la vista que itera el stream?",
          code: swift`do {
    for try await posts in repository.posts() {
        self.posts = posts
    }
} catch {
    banner = "Sin conexión"
}`,
          options: [
            "Solo el error: el stream falla antes de emitir nada",
            "Una lista vacía y después el error",
            "Los 20 posts y el stream queda abierto esperando la red",
            "Los 20 posts y después el stream termina con error, así que se muestra el banner",
          ],
          answer: 3,
          explanation: "Primero se emite lo local (`yield(cached)`), así que `self.posts` recibe los 20. Después falla la red y `finish(throwing:)` hace que el `for try await` lance: se ejecuta el `catch` y aparece el banner sobre los datos guardados. Esa es la experiencia offline-first.",
        },
        {
          kind: "fill",
          prompt: "Completá el estado del `NWPath` que significa que hay una ruta de red utilizable.",
          code: swift`monitor.pathUpdateHandler = { path in
    let isOnline = path.status == .____
}`,
          accept: ["^satisfied$"],
          explanation: "`NWPath.Status` tiene `.satisfied`, `.unsatisfied` y `.requiresConnection`. Solo `.satisfied` indica red utilizable.",
          placeholder: "estado",
        },
      ],
    },
    {
      id: "final-challenge",
      title: "Reto final: feed paginado con caché offline",
      goal: "Integrar endpoint tipado, repositorio offline-first, paginación por cursor sin duplicados y mensajes de error útiles.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Producto pide la pantalla \"Novedades\": un feed paginado por cursor (`GET /feed?limit=20&cursor=...`) que abra instantáneo con lo último guardado, funcione sin red y muestre mensajes claros.",
            "Ya tenés: `APIClient.send` (lección 2) con `APIError` y `userMessage`, y `FilePostStore` (lección 5). Te falta: el endpoint, el repositorio que decide red o caché, y el view model con scroll infinito.",
            "Criterios del PR: nada de `try!`, sin duplicados, sin requests dobles, la cancelación no muestra errores, y offline con caché muestra los datos marcados como desactualizados.",
          ],
          code: swift`struct FeedPage: Decodable, Sendable {
    let items: [Post]
    let nextCursor: String?
}

// Capas
// FeedView → FeedViewModel (@Observable, @MainActor)
//          → FeedRepository (red + FilePostStore)
//          → APIClient.send(Endpoint<FeedPage>)`,
        },
        {
          kind: "write",
          prompt: "Escribí el endpoint `feed(cursor:limit:)`: path `/feed`, query item `limit` siempre y `cursor` solo si no es `nil`.",
          starter: swift`extension Endpoint where Response == FeedPage {
    static func feed(cursor: String?, limit: Int = 20) -> Self {
        // TODO
        fatalError("TODO")
    }
}`,
          checks: [
            { pattern: "path:\\s*\"/feed\"", label: "path `/feed`" },
            { pattern: "URLQueryItem\\(name:\\s*\"limit\"", label: "agrega `limit`" },
            { pattern: "URLQueryItem\\(name:\\s*\"cursor\"", label: "agrega `cursor`" },
            { pattern: "if\\s+let\\s+cursor|cursor\\.map|cursor\\s*!=\\s*nil", label: "`cursor` solo si existe" },
          ],
          warnings: [
            { pattern: "\"/feed\\?", label: "query armada a mano en el path" },
            { pattern: "cursor!(?!=)", label: "force unwrap del cursor" },
          ],
          solution: swift`extension Endpoint where Response == FeedPage {
    static func feed(cursor: String?, limit: Int = 20) -> Self {
        var items = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor {
            items.append(URLQueryItem(name: "cursor", value: cursor))
        }
        return Endpoint(path: "/feed", queryItems: items)
    }
}`,
          hint: "Armá un `var items` con `limit` y agregá `cursor` dentro de un `if let cursor`.",
        },
        {
          kind: "write",
          prompt: "Implementá `firstPage()`: pedí la primera página a la red y guardala; si falla con `APIError.offline`, devolvé lo que haya en el store marcado como `isStale: true`, y si el store está vacío, relanzá el error.",
          starter: swift`struct FeedRepository: Sendable {
    let api: APIClient
    let store: FilePostStore

    func firstPage() async throws -> (page: FeedPage, isStale: Bool) {
        // TODO: red primero; guardar; offline → caché
        fatalError("TODO")
    }

    func page(after cursor: String?) async throws -> FeedPage {
        try await api.send(.feed(cursor: cursor))
    }
}`,
          checks: [
            { pattern: "store\\.save\\(", label: "guarda lo que vino de la red" },
            { pattern: "catch", label: "atrapa el error de red" },
            { pattern: "APIError\\.offline", label: "distingue el caso offline" },
            { pattern: "store\\.load\\(\\)", label: "cae al store local" },
            { pattern: "isEmpty", label: "contempla el store vacío" },
            { pattern: "isStale:\\s*true|,\\s*true\\)", label: "marca el resultado como desactualizado" },
          ],
          warnings: [
            { pattern: "try!", label: "`try!` en el repositorio" },
            { pattern: "UserDefaults", label: "el feed no va en `UserDefaults`" },
          ],
          solution: swift`struct FeedRepository: Sendable {
    let api: APIClient
    let store: FilePostStore

    func firstPage() async throws -> (page: FeedPage, isStale: Bool) {
        do {
            let page: FeedPage = try await api.send(.feed(cursor: nil))
            try store.save(page.items)
            return (page, false)
        } catch APIError.offline {
            let cached = try store.load()
            guard !cached.isEmpty else { throw APIError.offline }
            return (FeedPage(items: cached, nextCursor: nil), true)
        }
    }

    func page(after cursor: String?) async throws -> FeedPage {
        try await api.send(.feed(cursor: cursor))
    }
}`,
          hint: "`do { ... } catch APIError.offline { ... }`. La anotación `let page: FeedPage` le dice al generic qué endpoint buscar.",
        },
        {
          kind: "predict",
          prompt: "Primer arranque de la app, en modo avión. ¿Qué hace `firstPage()` y qué debería ver el usuario?",
          code: swift`// store vacío: load() devuelve []
let result = try await repository.firstPage()`,
          options: [
            "Devuelve una página vacía con `isStale: true` y se ve una lista vacía sin mensaje",
            "Lanza `APIError.offline`; la pantalla muestra un estado vacío con \"Sin conexión\" y un botón de reintentar",
            "Lanza `URLError.notConnectedToInternet` y la UI muestra el código de error",
            "Queda esperando hasta que vuelva la red, sin feedback",
          ],
          answer: 1,
          explanation: "El `catch APIError.offline` carga el store, que está vacío, así que el `guard` relanza `APIError.offline`. El view model lo traduce con `userMessage` a un estado vacío útil con reintento. Una lista vacía sin mensaje parece un bug.",
        },
        {
          kind: "write",
          prompt: "Implementá `loadNextPage()`: guardas `isLoading` y `hasMore`, `defer` para bajar `isLoading`, pedí `repository.page(after: nextCursor)`, agregá solo posts no vistos, actualizá cursor y `hasMore`, y mapeá `APIError` a `errorMessage` (la cancelación no muestra nada).",
          starter: swift`@Observable @MainActor
final class FeedViewModel {
    private(set) var posts: [Post] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private var nextCursor: String?
    private var hasMore = true
    private var seen = Set<Int>()
    private let repository: FeedRepository

    init(repository: FeedRepository) { self.repository = repository }

    func loadNextPage() async {
        // TODO
    }
}`,
          checks: [
            { pattern: "guard\\s+!isLoading", label: "evita requests dobles con `isLoading`" },
            { pattern: "hasMore\\s+else|,\\s*hasMore", label: "no pide después del final" },
            { pattern: "defer\\s*\\{\\s*isLoading\\s*=\\s*false", label: "baja `isLoading` con `defer`" },
            { pattern: "nextCursor\\s*=\\s*page\\.nextCursor", label: "actualiza el cursor" },
            { pattern: "\\.inserted", label: "filtra duplicados con el `Set`" },
            { pattern: "userMessage", label: "muestra `userMessage` del `APIError`" },
          ],
          warnings: [
            { pattern: "DispatchQueue", label: "no hace falta `DispatchQueue`: la clase ya es `@MainActor`" },
            { pattern: "try!", label: "`try!` en el view model" },
          ],
          solution: swift`@Observable @MainActor
final class FeedViewModel {
    private(set) var posts: [Post] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private var nextCursor: String?
    private var hasMore = true
    private var seen = Set<Int>()
    private let repository: FeedRepository

    init(repository: FeedRepository) { self.repository = repository }

    func loadNextPage() async {
        guard !isLoading, hasMore else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await repository.page(after: nextCursor)
            posts += page.items.filter { seen.insert($0.id).inserted }
            nextCursor = page.nextCursor
            hasMore = page.nextCursor != nil
            errorMessage = nil
        } catch let error as APIError {
            errorMessage = error.userMessage
        } catch {
            // cancelación u otro error sin mapear: no se muestra nada
        }
    }
}`,
          hint: "Copiá la estructura de la lección 3 y sumá `catch let error as APIError`.",
        },
        {
          kind: "predict",
          prompt: "El usuario scrollea rápido y sale de la pantalla mientras `loadNextPage()` espera la red. La request se cancela. Con tu `loadNextPage()`, ¿qué pasa?",
          code: swift`} catch let error as APIError {
    errorMessage = error.userMessage
} catch {
    // cancelación u otro error sin mapear
}`,
          options: [
            "El `URLError(.cancelled)` no es `APIError`: cae en el último `catch`, no se muestra nada y el `defer` baja `isLoading`",
            "Se muestra \"Sin conexión\" porque la request no terminó",
            "`isLoading` queda en `true` para siempre y no se cargan más páginas",
            "La app crashea porque la `Task` se canceló dentro de un actor",
          ],
          answer: 0,
          explanation: "`APIClient` deja pasar `URLError(.cancelled)` sin mapearlo, así que no matchea `as APIError` y va al `catch` genérico, que no muestra nada. `defer` corre en cualquier salida, así que `isLoading` vuelve a `false` y la próxima carga funciona.",
        },
      ],
    },
  ],
  flashcards: [
    {
      id: "fc-status-no-throw",
      front: "¿`URLSession.data(for:)` lanza un error con un 404 o un 500?",
      back: "No. Solo lanza errores de transporte (sin red, timeout, cancelación, TLS). Un 404/500 vuelve normal: castea a `HTTPURLResponse` y validá `200..<300` vos.",
      code: swift`guard let http = response as? HTTPURLResponse,
      (200..<300).contains(http.statusCode) else { throw ... }`,
    },
    {
      id: "fc-urlcomponents",
      front: "¿Por qué `URLComponents` y no concatenar strings para la query?",
      back: "Codifica cada valor (espacios, acentos, `&`). Ojo: no codifica `+`, que algunos servidores leen como espacio.",
      code: swift`var c = URLComponents(string: "https://api.example.com/search")!
c.queryItems = [URLQueryItem(name: "q", value: text)]`,
    },
    {
      id: "fc-timeouts",
      front: "`timeoutIntervalForRequest` vs `timeoutIntervalForResource`",
      back: "Request: máximo **sin recibir datos** (60 s por defecto, igual que `URLRequest.timeoutInterval`). Resource: máximo **total** de la transferencia (7 días por defecto).",
    },
    {
      id: "fc-endpoint",
      front: "¿Qué gana un `Endpoint<Response>` genérico?",
      back: "El tipo de respuesta viaja con el endpoint: `send(.posts(page: 1))` devuelve `[Post]` sin castear. Una sola función `send<T: Decodable>` arma, envía, valida y decodifica.",
    },
    {
      id: "fc-http-client-protocol",
      front: "¿Cómo hacés testeable un cliente de red?",
      back: "Que dependa de un protocolo (`HTTPClient`) en vez de `URLSession.shared`. En tests inyectás un stub que devuelve status y JSON controlados, sin red.",
    },
    {
      id: "fc-error-buckets",
      front: "Buckets de error típicos de una capa de red",
      back: "offline (sin red/timeout), unauthorized (401), client (otros 4xx), server (5xx), decoding. Cada uno con un `userMessage`. La cancelación no se mapea: se ignora.",
    },
    {
      id: "fc-retry",
      front: "¿Qué se reintenta y cómo?",
      back: "Solo lo transitorio: offline/timeout, 5xx, 429 (respetando `Retry-After`). Backoff exponencial con jitter. Nunca 400/401/422. POST solo con `Idempotency-Key`.",
    },
    {
      id: "fc-token-refresh",
      front: "Cinco requests reciben 401 a la vez. ¿Cuántos refresh de token?",
      back: "Uno. Un `actor` guarda la `Task` del refresh en curso y los demás la esperan. Cada request reintenta una sola vez; si el refresh falla, logout.",
    },
    {
      id: "fc-cursor",
      front: "Paginación por página vs por cursor",
      back: "Página/offset: simple, pero si entran ítems nuevos ves duplicados o te salteás. Cursor: `nextCursor` opaco, estable ante cambios; `nil` = no hay más.",
    },
    {
      id: "fc-infinite-scroll",
      front: "Tres guardas del scroll infinito",
      back: "`isLoading` (sin requests dobles), `hasMore` (no pedir después del final) y un `Set` de ids vistos (sin duplicados).",
      code: swift`posts += page.items.filter { seen.insert($0.id).inserted }`,
    },
    {
      id: "fc-debounce",
      front: "Búsqueda con debounce en async/await",
      back: "Cancelá la `Task` anterior, creá una nueva que haga `Task.sleep(for: .milliseconds(300))`, chequeá `Task.isCancelled` antes de pedir y antes de asignar. En SwiftUI: `.task(id: query)`.",
    },
    {
      id: "fc-nscache-urlcache",
      front: "`NSCache` vs `URLCache`",
      back: "`NSCache`: memoria, thread-safe, se vacía bajo presión, claves/valores clase (`NSCache<NSURL, UIImage>`); evita decodificar de nuevo. `URLCache`: caché HTTP en memoria y disco según `Cache-Control`/`ETag`; evita la red.",
    },
    {
      id: "fc-downsample",
      front: "¿Cuánta memoria ocupa una imagen decodificada?",
      back: "Ancho × alto × 4 bytes. Una foto de 4000 × 3000 ≈ 48 MB aunque el JPEG pese 3 MB. Solución: downsampling con ImageIO al tamaño en píxeles que mostrás.",
    },
    {
      id: "fc-where-to-store",
      front: "¿Dónde guardás: preferencia, token, caché del feed, foto del usuario?",
      back: "Preferencia → `UserDefaults`/`@AppStorage`. Token → Keychain. Caché del feed → archivo en `Caches` (o SwiftData). Foto creada por el usuario → `Documents`.",
    },
    {
      id: "fc-offline-first",
      front: "Offline-first en una frase (y el rol de `NWPathMonitor`)",
      back: "La UI lee siempre de lo local; el repositorio emite el caché, pide a la red, guarda y emite lo nuevo. `NWPathMonitor` sirve para el banner y para resincronizar al volver la red, no para bloquear requests.",
    },
  ],
  exam: [
    {
      id: "ex-post-retry",
      question: "Un POST `/orders` da timeout y el cliente lo reintenta automáticamente. Soporte reporta pedidos duplicados. ¿Cuál es el arreglo correcto?",
      options: [
        "Subir el `timeoutInterval` a 5 minutos para que nunca dé timeout",
        "Dejar de usar POST y crear el pedido con GET",
        "Mandar un `Idempotency-Key` único por intento lógico para que el servidor descarte el duplicado",
        "Reintentar solo si el usuario toca el botón dos veces",
      ],
      answer: 2,
      explanation: "Un timeout no dice si el servidor procesó la request. POST no es idempotente, así que reintentar puede duplicar. Con un `Idempotency-Key` estable el servidor reconoce el reintento. Subir el timeout solo esconde el problema.",
    },
    {
      id: "ex-500-no-throw",
      question: "Un dev junior dice: \"si el servidor responde 500, `try await session.data(for:)` va a lanzar y caemos en el `catch`\". ¿Qué le respondés en el code review?",
      code: swift`do {
    let (data, _) = try await session.data(for: request)
    return try JSONDecoder().decode(User.self, from: data)
} catch {
    throw APIError.server(500)
}`,
      options: [
        "Que no: un 500 vuelve sin `throw`; hay que castear a `HTTPURLResponse` y validar el status antes de decodificar",
        "Que tiene razón, URLSession lanza para cualquier status fuera de 2xx",
        "Que URLSession lanza solo con 5xx, no con 4xx",
        "Que el `decode` va a funcionar porque el cuerpo de un 500 siempre es el `User`",
      ],
      answer: 0,
      explanation: "`data(for:)` solo lanza errores de transporte. Con un 500, el código intenta decodificar el cuerpo de error como `User`, falla con `DecodingError` y el usuario recibe el mensaje equivocado. Validar el status es responsabilidad tuya.",
    },
    {
      id: "ex-refresh-token-storage",
      question: "¿Dónde guardás el refresh token de la sesión?",
      options: [
        "`UserDefaults`, es lo más simple de leer al arrancar",
        "Un archivo JSON en `Documents`",
        "En memoria nada más, y pedir login en cada arranque",
        "Keychain",
      ],
      answer: 3,
      explanation: "Es un secreto de larga vida: va en Keychain, cifrado y fuera del sandbox de archivos. `UserDefaults` y `Documents` son texto plano (y `Documents` hasta se respalda). Solo memoria obliga a loguearse siempre.",
    },
    {
      id: "ex-stale-search",
      question: "En la búsqueda, a veces quedan en pantalla los resultados de \"sw\" aunque el usuario escribió \"swift\". ¿Qué falta?",
      options: [
        "Un `DispatchQueue.main.async` al asignar los resultados",
        "Cancelar la búsqueda anterior en cada cambio y no asignar si la `Task` fue cancelada",
        "Bajar el debounce a 0 ms",
        "Usar `URLCache` para que \"swift\" responda más rápido",
      ],
      answer: 1,
      explanation: "Las respuestas pueden llegar desordenadas: la de \"sw\" llegó después y pisó la de \"swift\". Cancelar la anterior y chequear `Task.isCancelled` antes de asignar garantiza que solo se pinte la última consulta.",
    },
    {
      id: "ex-feed-duplicates",
      question: "En un feed muy activo con `?page=N`, los usuarios ven posts repetidos al scrollear. ¿Qué proponés?",
      options: [
        "Recargar todo el feed cada vez que se llega al final",
        "Paginación por cursor y, además, filtrar por id con un `Set` en el cliente",
        "Pedir páginas más grandes, de 200 ítems",
        "Ordenar la lista por título en el cliente",
      ],
      answer: 1,
      explanation: "Con offset, los ítems nuevos corren todo y la página siguiente repite. El cursor es estable ante inserciones, y el `Set` de ids vistos protege si el servidor igual repite algo.",
    },
    {
      id: "ex-image-memory",
      question: "Una galería con fotos de cámara crashea por memoria al scrollear, aunque las imágenes pesan 2–3 MB cada una. ¿Cuál es la causa más probable y el arreglo?",
      options: [
        "Las fotos son JPEG; hay que convertirlas a PNG",
        "`NSCache` sin límite; hay que usar un `Dictionary`",
        "Falta `URLCache`; con caché en disco no se usa memoria",
        "Se decodifican a resolución completa (~48 MB cada una); hay que hacer downsampling al tamaño mostrado",
      ],
      answer: 3,
      explanation: "La memoria depende de los píxeles decodificados, no del archivo: 4000 × 3000 × 4 ≈ 48 MB. Con ImageIO generás una miniatura del tamaño en píxeles que mostrás. Un `Dictionary` empeora las cosas porque nunca libera.",
    },
    {
      id: "ex-nscache",
      question: "¿Por qué `NSCache` y no un `[URL: UIImage]` para la caché de imágenes en memoria?",
      options: [
        "`NSCache` libera entradas sola bajo presión de memoria, admite límites de cantidad y costo, y es thread-safe",
        "`NSCache` guarda en disco y sobrevive reinicios",
        "`NSCache` respeta los headers `Cache-Control` del servidor",
        "`Dictionary` no puede guardar `UIImage`",
      ],
      answer: 0,
      explanation: "El diccionario crece hasta que el sistema mata la app. `NSCache` reacciona a la presión de memoria y tiene `countLimit`/`totalCostLimit`. Disco y `Cache-Control` son cosa de `URLCache`.",
    },
    {
      id: "ex-concurrent-401",
      question: "El access token expira y 5 requests en paralelo reciben 401. ¿Cuál es el comportamiento correcto?",
      options: [
        "Cada request hace su propio refresh",
        "Mostrar el login apenas llega el primer 401",
        "Un solo refresh compartido (un `actor` guarda la `Task` en curso); cada request reintenta una vez y, si el refresh falla, logout",
        "Reintentar las 5 requests con el mismo token vencido hasta que funcione",
      ],
      answer: 2,
      explanation: "Cinco refresh en paralelo suelen invalidarse entre sí (muchos backends rotan el refresh token). Compartir una única `Task` de refresh lo evita, y reintentar una sola vez evita loops infinitos.",
    },
    {
      id: "ex-nwpathmonitor",
      question: "Un PR agrega `guard monitor.currentPath.status == .satisfied else { throw APIError.offline }` antes de cada request. ¿Qué comentás?",
      options: [
        "Perfecto: así se ahorran requests",
        "Hay que hacerlo, pero con `Reachability` en vez de `NWPathMonitor`",
        "Debería chequear `.requiresConnection` en vez de `.satisfied`",
        "No bloquees requests con el monitor: intentá igual (o usá `waitsForConnectivity`) y usá el monitor para el banner y para resincronizar",
      ],
      answer: 3,
      explanation: "El estado del path puede estar desactualizado o equivocarse (VPN, portales cautivos). La request real es la fuente de verdad. El monitor sirve para UX y para disparar la sincronización cuando vuelve la red.",
    },
    {
      id: "ex-cancel-error",
      question: "¿Cuál de estos errores **no** debería mostrarse nunca al usuario como alerta?",
      options: [
        "`APIError.unauthorized` después de un refresh fallido",
        "`URLError(.cancelled)` porque la vista que pedía los datos desapareció",
        "`URLError(.notConnectedToInternet)` en el primer arranque sin caché",
        "`APIError.server(503)` después de agotar los reintentos",
      ],
      answer: 1,
      explanation: "La cancelación la provocó tu propio código (la vista se fue o llegó otra búsqueda). No hay nada que el usuario pueda hacer. Los otros tres necesitan un mensaje: login, sin conexión, servicio con problemas.",
    },
    {
      id: "ex-core-data-legacy",
      question: "Entrás a una app con 5 años de Core Data que funciona bien. Un compañero propone pasar todo a SwiftData este sprint. ¿Qué recomendás?",
      options: [
        "Mantener Core Data aislado detrás de un repositorio y evaluar migrar por partes cuando aporte valor",
        "Migrar todo de una vez: SwiftData reemplaza a Core Data y este va a dejar de funcionar",
        "Pasar todo a `UserDefaults`, que es más simple",
        "Borrar la base local y depender solo de la red",
      ],
      answer: 0,
      explanation: "Una reescritura completa de la persistencia es riesgosa (migraciones de datos de usuarios reales) y Core Data sigue soportado. Aislarlo detrás de un repositorio permite cambiar la implementación por partes sin tocar la UI.",
    },
    {
      id: "ex-what-to-retry",
      question: "Tu `withRetry` reintenta con backoff. ¿Cuál de estas respuestas sí conviene reintentar automáticamente?",
      options: [
        "400 Bad Request",
        "422 con errores de validación del formulario",
        "503 Service Unavailable en un GET",
        "401 Unauthorized con el mismo token",
      ],
      answer: 2,
      explanation: "503 es transitorio y un GET es idempotente: reintentar con backoff (y respetando `Retry-After` si viene) tiene sentido. 400 y 422 van a fallar igual; 401 necesita refresh, no repetir con el mismo token.",
    },
  ],
};

export default content;
