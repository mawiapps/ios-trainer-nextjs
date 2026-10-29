import { Lesson } from "./types";

export const engLessons: Lesson[] = [
  {
    id: "l-http",
    topic: "rest",
    title: "HTTP y REST desde cero",
    goal: "Elegir el verbo y el código de estado correcto en cualquier pregunta, y leer una respuesta HTTP en Swift.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "Verbos y qué significan",
        body: [
          "GET lee (sin cuerpo, sin efectos). POST crea o dispara una acción. PUT reemplaza el recurso completo. PATCH modifica parte. DELETE borra.",
          "**Idempotente** = repetir la llamada deja el mismo estado. GET, PUT, DELETE lo son; POST no (crea algo nuevo cada vez). Por eso un reintento automático de POST necesita un `Idempotency-Key`.",
        ],
      },
      {
        kind: "explain",
        title: "Códigos de estado que preguntan",
        body: [
          "2xx éxito: 200 OK, 201 Created (tras POST), 204 No Content (DELETE exitoso sin cuerpo).",
          "4xx culpa del cliente: 400 request malformada, 401 no autenticado (token faltante/expirado), 403 autenticado pero sin permiso, 404 no existe, 409 conflicto (ya existe), 422 validación de campos, 429 rate limit.",
          "5xx culpa del servidor: 500 error genérico, 502/503 gateway/servicio caído, 504 timeout.",
          "Regla: 401 → pedí login o refrescá token; 403 → no insistas; 429 → esperá (`Retry-After`); 5xx → reintento con backoff.",
        ],
      },
      {
        kind: "predict",
        prompt: "El usuario intenta borrar una cuenta que no es suya, con sesión válida. ¿Qué código devuelve una API bien diseñada?",
        code: "DELETE /accounts/42\nAuthorization: Bearer <token válido de otro usuario>",
        options: ["401", "403", "404", "422"],
        answer: 1,
        explanation: "Está autenticado (el token es válido) pero no autorizado para ese recurso: 403.",
      },
      {
        kind: "fill",
        prompt: "Completá el código de estado típico tras crear un recurso con POST.",
        code: "POST /users  →  HTTP ____ Created",
        accept: ["^201$"],
        explanation: "201 Created, normalmente con header Location del nuevo recurso.",
        placeholder: "código",
      },
      {
        kind: "explain",
        title: "Headers que importan en mobile",
        body: [
          "`Authorization: Bearer <jwt>` para autenticar. `Content-Type: application/json` en el cuerpo que enviás, `Accept` para el que querés.",
          "`ETag` + `If-None-Match` para cache (304 Not Modified). `Idempotency-Key` para reintentar POST sin duplicar. `Retry-After` con 429/503.",
          "Paginación: por página (`?page=2&limit=20`) o por cursor (`?cursor=abc`), más robusta cuando los datos cambian.",
        ],
      },
      {
        kind: "explain",
        title: "Consumir REST en Swift",
        body: ["Lo mínimo que tenés que poder escribir de memoria: request con header, chequeo del status y decode."],
        code: "struct UserDTO: Decodable { let id: Int; let name: String }\n\nfunc fetchUser(id: Int, token: String) async throws -> UserDTO {\n    var req = URLRequest(url: URL(string: \"https://api.x.com/users/\\(id)\")!)\n    req.httpMethod = \"GET\"\n    req.setValue(\"Bearer \\(token)\", forHTTPHeaderField: \"Authorization\")\n    let (data, resp) = try await URLSession.shared.data(for: req)\n    guard let http = resp as? HTTPURLResponse else { throw APIError.invalid }\n    switch http.statusCode {\n    case 200..<300: return try JSONDecoder().decode(UserDTO.self, from: data)\n    case 401: throw APIError.unauthorized\n    default: throw APIError.http(http.statusCode)\n    }\n}",
      },
      {
        kind: "predict",
        prompt: "¿Qué hace este guard?",
        code: "guard (200..<300).contains(http.statusCode) else { throw APIError.http(http.statusCode) }",
        options: ["Acepta solo 200", "Acepta 200 a 299 inclusive", "Acepta 200 a 300 inclusive", "Rechaza 204"],
        answer: 1,
        explanation: "`200..<300` es medio abierto: incluye 200..299, excluye 300. 204 queda incluido.",
      },
    ],
  },
  {
    id: "l-jwt",
    topic: "rest",
    title: "JWT, sesión y refresh token",
    goal: "Explicar qué hay dentro de un JWT, dónde guardarlo en iOS y cómo refrescarlo sin condiciones de carrera.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "Anatomía de un JWT",
        body: [
          "Tres partes separadas por punto: `header.payload.signature`, cada una en base64url. El header dice el algoritmo (`HS256`, `RS256`). El payload trae claims: `sub` (usuario), `exp` (expiración, epoch), `iat`, roles.",
          "El payload **no está cifrado**: cualquiera puede leerlo decodificando base64. Lo que garantiza que nadie lo modificó es la firma, que solo el servidor puede verificar/crear.",
          "Por eso: nunca pongas datos sensibles en el payload, y nunca confíes en un JWT solo porque 'parece válido' en el cliente.",
        ],
        code: "eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiI0MiIsImV4cCI6MTc5MDAwMDAwMH0 . 3f9a…\n// header            payload {\"sub\":\"42\",\"exp\":1790000000}   firma",
      },
      {
        kind: "predict",
        prompt: "¿Qué puede hacer un atacante que roba un JWT y le cambia `\"sub\":\"42\"` por `\"sub\":\"1\"`?",
        code: "",
        options: ["Impersonar al usuario 1", "Nada: la firma deja de coincidir y el servidor lo rechaza", "Solo leer datos del usuario 1", "Depende del algoritmo"],
        answer: 1,
        explanation: "La firma cubre header+payload. Cambiar un byte invalida la firma. (El token robado sin modificar sí sirve hasta que expire: por eso los access tokens son cortos.)",
      },
      {
        kind: "explain",
        title: "Access + refresh",
        body: [
          "Access token: corto (5–15 min), viaja en cada request. Refresh token: largo (días), solo se usa para pedir un access nuevo, idealmente rotando (cada refresh devuelve un refresh nuevo e invalida el anterior).",
          "Si roban el access, dura minutos. Si roban el refresh y rota, el uso doble delata el robo y el servidor invalida la familia completa.",
        ],
      },
      {
        kind: "explain",
        title: "Dónde guardarlo en iOS",
        body: [
          "**Keychain**, con `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`: cifrado por hardware, no viaja en backups a otro dispositivo.",
          "Nunca en `UserDefaults` (plist en claro), ni en archivos, ni en logs, ni hardcodeado. El access token se puede cachear en memoria para no leer Keychain en cada request.",
        ],
        code: "func save(_ value: Data, account: String) throws {\n    let q: [String: Any] = [\n        kSecClass as String: kSecClassGenericPassword,\n        kSecAttrAccount as String: account,\n        kSecValueData as String: value,\n        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly\n    ]\n    SecItemDelete(q as CFDictionary)\n    let status = SecItemAdd(q as CFDictionary, nil)\n    guard status == errSecSuccess else { throw KeychainError.status(status) }\n}",
      },
      {
        kind: "fill",
        prompt: "Completá dónde se guarda el refresh token en una app bancaria.",
        code: "// El refresh token se guarda en el ____ (nunca en UserDefaults)",
        accept: ["^keychain$"],
        explanation: "Keychain es el almacenamiento cifrado del sistema para secretos.",
        placeholder: "lugar",
      },
      {
        kind: "explain",
        title: "Refresh concurrente: el problema y la solución",
        body: [
          "Si 5 requests reciben 401 a la vez y cada una dispara su propio refresh, el servidor con rotación invalida los demás y el usuario queda deslogueado.",
          "Solución: un `actor` que guarda la `Task` de refresh en vuelo. Quien llega mientras hay una, hace `await` sobre esa misma Task. Cuando termina, todos reintentan con el token nuevo. Si el refresh falla con 401, logout.",
        ],
        code: "actor TokenProvider {\n    private var access: String?\n    private var refreshing: Task<String, Error>?\n\n    func validToken() async throws -> String {\n        if let t = access, !isExpired(t) { return t }\n        if let task = refreshing { return try await task.value }\n        let task = Task { try await self.doRefresh() }\n        refreshing = task\n        defer { refreshing = nil }\n        let t = try await task.value\n        access = t\n        return t\n    }\n}",
      },
      {
        kind: "predict",
        prompt: "¿Por qué `TokenProvider` es un `actor` y no una `class`?",
        code: "",
        options: ["Para que sea más rápido", "Para que su estado mutable se acceda de a uno por vez sin data races", "Porque las clases no pueden tener Task", "Para poder usar @Published"],
        answer: 1,
        explanation: "Un actor serializa el acceso a sus propiedades; varias requests concurrentes no pueden leer/escribir `refreshing` a la vez.",
      },
    ],
  },
  {
    id: "l-solid",
    topic: "ingenieria",
    title: "SOLID y patrones con ejemplos iOS",
    goal: "Reconocer cada principio en código real y nombrar el patrón correcto en una pregunta de opción múltiple.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "S y O",
        body: [
          "**Single Responsibility**: una clase, una razón para cambiar. Un ViewModel que también hace networking y persistencia viola S; separá en UseCase + Repository.",
          "**Open/Closed**: abierto a extensión, cerrado a modificación. En vez de un `switch` gigante que crece con cada tipo de pago, un protocolo `PaymentMethod` con una implementación por tipo.",
        ],
        code: "// Viola O: cada método nuevo obliga a tocar este switch\nfunc fee(for m: Method) -> Double {\n    switch m { case .card: return 0.03; case .transfer: return 0.0 }\n}\n// Cumple O\nprotocol PaymentMethod { var fee: Double { get } }\nstruct Card: PaymentMethod { let fee = 0.03 }\nstruct Transfer: PaymentMethod { let fee = 0.0 }",
      },
      {
        kind: "explain",
        title: "L, I y D",
        body: [
          "**Liskov**: un subtipo debe poder reemplazar al padre sin romper nada. Si `Square: Rectangle` rompe `setWidth`, violás L.",
          "**Interface Segregation**: protocolos chicos. Mejor `Readable` y `Writable` que un `Storage` con 12 métodos que nadie implementa completo.",
          "**Dependency Inversion**: depender de abstracciones. El ViewModel recibe `UserRepository` (protocolo), no `APIUserRepository` (concreto). Es lo que permite testear con mocks.",
        ],
        code: "// D en acción\nprotocol UserRepository { func user(id: Int) async throws -> User }\nfinal class ProfileViewModel {\n    private let repo: UserRepository\n    init(repo: UserRepository) { self.repo = repo }   // inyección por init\n}\n// En tests: ProfileViewModel(repo: FakeUserRepository())",
      },
      {
        kind: "predict",
        prompt: "¿Qué principio viola?",
        code: "protocol Vehicle { func drive(); func fly(); func sail() }\nstruct Car: Vehicle {\n    func drive() {}\n    func fly() { fatalError() }\n    func sail() { fatalError() }\n}",
        options: ["Single Responsibility", "Open/Closed", "Interface Segregation", "Dependency Inversion"],
        answer: 2,
        explanation: "El protocolo obliga a implementar métodos que no aplican. Separá en `Drivable`, `Flyable`, `Sailable`.",
      },
      {
        kind: "explain",
        title: "Patrones que preguntan",
        body: [
          "**Singleton**: una instancia global (`URLSession.shared`). Cómodo, difícil de testear; usalo poco.",
          "**Factory**: una función/objeto que decide qué instancia crear (`ViewModelFactory.make(for: screen)`).",
          "**Strategy**: intercambiar un algoritmo vía protocolo (`SortStrategy`).",
          "**Observer**: notificar cambios a suscriptores (Combine, NotificationCenter, `@Published`).",
          "**Repository**: abstraer la fuente de datos. **Adapter**: envolver una API ajena en tu interfaz. **Decorator**: agregar comportamiento envolviendo (un `LoggingHTTPClient` que envuelve a otro `HTTPClient`).",
        ],
      },
      {
        kind: "fill",
        prompt: "¿Qué patrón es un `CachingHTTPClient` que recibe otro `HTTPClient`, conforma el mismo protocolo y agrega caché antes de delegar?",
        code: "final class CachingHTTPClient: HTTPClient {\n    private let inner: HTTPClient\n    init(wrapping inner: HTTPClient) { self.inner = inner }\n}\n// Patrón: ____",
        accept: ["^decorator$", "^decorador$"],
        explanation: "Decorator: misma interfaz, envuelve y agrega comportamiento.",
        placeholder: "nombre del patrón",
      },
      {
        kind: "explain",
        title: "Testing y Git en una pantalla",
        body: [
          "Pirámide: muchos unit tests (rápidos), menos de integración, pocos UI/e2e. TDD: red → green → refactor. Mock = verifica interacciones; stub = devuelve valores fijos; fake = implementación simplificada que funciona.",
          "Git: `merge` crea un commit de unión y preserva historia; `rebase` reescribe tus commits encima de la base (hashes nuevos, historia lineal) y **no se usa en ramas compartidas**. `squash` junta commits. `cherry-pick` copia un commit a otra rama. Conflicto = dos cambios en las mismas líneas; se resuelve a mano y se hace commit.",
          "CI por PR: lint + build + tests. CD: build firmado a TestFlight automáticamente desde `main`/`release`.",
        ],
      },
      {
        kind: "predict",
        prompt: "Estás en `feature/x`, hacés `git rebase main` y luego `git push`. El push falla con 'rejected (non-fast-forward)'. ¿Por qué?",
        code: "",
        options: ["main tiene conflictos", "Tus commits ahora tienen otros hashes y el remoto tiene los viejos", "Falta hacer merge primero", "Git no permite rebase en features"],
        answer: 1,
        explanation: "rebase reescribió la historia local. Si la rama ya estaba publicada, necesitás `push --force-with-lease` (y solo si nadie más trabaja en ella).",
      },
    ],
  },
];
