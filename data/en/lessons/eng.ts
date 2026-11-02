import { Lesson } from "../../lessons/types";

export const engLessons: Lesson[] = [
  {
    id: "l-http",
    topic: "rest",
    title: "HTTP and REST from scratch",
    goal: "Pick the right verb and status code in any question, and read an HTTP response in Swift.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "Verbs and what they mean",
        body: [
          "GET reads (no body, no side effects). POST creates something or triggers an action. PUT replaces the whole resource. PATCH modifies part of it. DELETE removes it.",
          "**Idempotent** = repeating the call leaves the same state. GET, PUT and DELETE are; POST isn't (it creates something new each time). That's why automatically retrying a POST needs an `Idempotency-Key`.",
        ],
      },
      {
        kind: "explain",
        title: "Status codes they ask about",
        body: [
          "2xx success: 200 OK, 201 Created (after a POST), 204 No Content (successful DELETE with no body).",
          "4xx client's fault: 400 malformed request, 401 not authenticated (missing/expired token), 403 authenticated but not allowed, 404 doesn't exist, 409 conflict (already exists), 422 field validation, 429 rate limited.",
          "5xx server's fault: 500 generic error, 502/503 gateway/service down, 504 timeout.",
          "Rule of thumb: 401 → ask for login or refresh the token; 403 → don't keep trying; 429 → wait (`Retry-After`); 5xx → retry with backoff.",
        ],
      },
      {
        kind: "predict",
        prompt: "A user with a valid session tries to delete an account that isn't theirs. What code does a well-designed API return?",
        code: "DELETE /accounts/42\nAuthorization: Bearer <valid token belonging to another user>",
        options: ["401", "403", "404", "422"],
        answer: 1,
        explanation: "They're authenticated (the token is valid) but not authorized for that resource: 403.",
      },
      {
        kind: "fill",
        prompt: "Fill in the typical status code after creating a resource with POST.",
        code: "POST /users  →  HTTP ____ Created",
        accept: ["^201$"],
        explanation: "201 Created, usually with a Location header pointing to the new resource.",
        placeholder: "code",
      },
      {
        kind: "explain",
        title: "Headers that matter on mobile",
        body: [
          "`Authorization: Bearer <jwt>` to authenticate. `Content-Type: application/json` for the body you send, `Accept` for the one you want back.",
          "`ETag` + `If-None-Match` for caching (304 Not Modified). `Idempotency-Key` to retry a POST without duplicating it. `Retry-After` with 429/503.",
          "Pagination: by page (`?page=2&limit=20`) or by cursor (`?cursor=abc`), which is more robust when the data changes.",
        ],
      },
      {
        kind: "explain",
        title: "Consuming REST in Swift",
        body: ["The bare minimum you should be able to write from memory: a request with a header, a status check and decoding."],
        code: "struct UserDTO: Decodable { let id: Int; let name: String }\n\nfunc fetchUser(id: Int, token: String) async throws -> UserDTO {\n    var req = URLRequest(url: URL(string: \"https://api.x.com/users/\\(id)\")!)\n    req.httpMethod = \"GET\"\n    req.setValue(\"Bearer \\(token)\", forHTTPHeaderField: \"Authorization\")\n    let (data, resp) = try await URLSession.shared.data(for: req)\n    guard let http = resp as? HTTPURLResponse else { throw APIError.invalid }\n    switch http.statusCode {\n    case 200..<300: return try JSONDecoder().decode(UserDTO.self, from: data)\n    case 401: throw APIError.unauthorized\n    default: throw APIError.http(http.statusCode)\n    }\n}",
      },
      {
        kind: "predict",
        prompt: "What does this guard do?",
        code: "guard (200..<300).contains(http.statusCode) else { throw APIError.http(http.statusCode) }",
        options: ["Accepts only 200", "Accepts 200 through 299 inclusive", "Accepts 200 through 300 inclusive", "Rejects 204"],
        answer: 1,
        explanation: "`200..<300` is half-open: it includes 200..299 and excludes 300. 204 is included.",
      },
    ],
  },
  {
    id: "l-jwt",
    topic: "rest",
    title: "JWT, sessions and refresh tokens",
    goal: "Explain what's inside a JWT, where to store it on iOS and how to refresh it without race conditions.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "Anatomy of a JWT",
        body: [
          "Three parts separated by dots: `header.payload.signature`, each base64url-encoded. The header states the algorithm (`HS256`, `RS256`). The payload carries claims: `sub` (user), `exp` (expiration, epoch), `iat`, roles.",
          "The payload is **not encrypted**: anyone can read it by base64-decoding it. What guarantees nobody tampered with it is the signature, which only the server can create/verify.",
          "So: never put sensitive data in the payload, and never trust a JWT just because it 'looks valid' on the client.",
        ],
        code: "eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiI0MiIsImV4cCI6MTc5MDAwMDAwMH0 . 3f9a…\n// header            payload {\"sub\":\"42\",\"exp\":1790000000}   signature",
      },
      {
        kind: "predict",
        prompt: "What can an attacker do after stealing a JWT and changing `\"sub\":\"42\"` to `\"sub\":\"1\"`?",
        code: "",
        options: ["Impersonate user 1", "Nothing: the signature no longer matches and the server rejects it", "Only read user 1's data", "It depends on the algorithm"],
        answer: 1,
        explanation: "The signature covers header+payload. Changing a single byte invalidates it. (The stolen token, unmodified, does work until it expires: that's why access tokens are short-lived.)",
      },
      {
        kind: "explain",
        title: "Access + refresh",
        body: [
          "Access token: short-lived (5–15 min), sent with every request. Refresh token: long-lived (days), used only to get a new access token, ideally with rotation (each refresh returns a new refresh token and invalidates the previous one).",
          "If the access token is stolen, it lasts minutes. If the refresh token is stolen and rotates, the double use gives the theft away and the server invalidates the whole token family.",
        ],
      },
      {
        kind: "explain",
        title: "Where to store it on iOS",
        body: [
          "**Keychain**, with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`: hardware-backed encryption, and it doesn't travel in backups to another device.",
          "Never in `UserDefaults` (a plaintext plist), files, logs, or hardcoded. The access token can be cached in memory so you don't hit the Keychain on every request.",
        ],
        code: "func save(_ value: Data, account: String) throws {\n    let q: [String: Any] = [\n        kSecClass as String: kSecClassGenericPassword,\n        kSecAttrAccount as String: account,\n        kSecValueData as String: value,\n        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly\n    ]\n    SecItemDelete(q as CFDictionary)\n    let status = SecItemAdd(q as CFDictionary, nil)\n    guard status == errSecSuccess else { throw KeychainError.status(status) }\n}",
      },
      {
        kind: "fill",
        prompt: "Fill in where a banking app stores the refresh token.",
        code: "// The refresh token is stored in the ____ (never in UserDefaults)",
        accept: ["^keychain$"],
        explanation: "The Keychain is the system's encrypted storage for secrets.",
        placeholder: "place",
      },
      {
        kind: "explain",
        title: "Concurrent refresh: the problem and the fix",
        body: [
          "If 5 requests get a 401 at the same time and each fires its own refresh, a server with rotation invalidates the others and the user gets logged out.",
          "Fix: an `actor` that holds the in-flight refresh `Task`. Anyone arriving while one is running just `await`s that same Task. When it finishes, everyone retries with the new token. If the refresh itself fails with 401, log out.",
        ],
        code: "actor TokenProvider {\n    private var access: String?\n    private var refreshing: Task<String, Error>?\n\n    func validToken() async throws -> String {\n        if let t = access, !isExpired(t) { return t }\n        if let task = refreshing { return try await task.value }\n        let task = Task { try await self.doRefresh() }\n        refreshing = task\n        defer { refreshing = nil }\n        let t = try await task.value\n        access = t\n        return t\n    }\n}",
      },
      {
        kind: "predict",
        prompt: "Why is `TokenProvider` an `actor` and not a `class`?",
        code: "",
        options: ["To make it faster", "So its mutable state is accessed one caller at a time, without data races", "Because classes can't hold a Task", "So it can use @Published"],
        answer: 1,
        explanation: "An actor serializes access to its properties; several concurrent requests can't read/write `refreshing` at the same time.",
      },
    ],
  },
  {
    id: "l-solid",
    topic: "ingenieria",
    title: "SOLID and patterns with iOS examples",
    goal: "Recognize each principle in real code and name the right pattern in a multiple-choice question.",
    minutes: 12,
    steps: [
      {
        kind: "explain",
        title: "S and O",
        body: [
          "**Single Responsibility**: one class, one reason to change. A ViewModel that also does networking and persistence violates S; split it into a UseCase + Repository.",
          "**Open/Closed**: open for extension, closed for modification. Instead of a giant `switch` that grows with every payment type, a `PaymentMethod` protocol with one implementation per type.",
        ],
        code: "// Violates O: every new method forces you to touch this switch\nfunc fee(for m: Method) -> Double {\n    switch m { case .card: return 0.03; case .transfer: return 0.0 }\n}\n// Follows O\nprotocol PaymentMethod { var fee: Double { get } }\nstruct Card: PaymentMethod { let fee = 0.03 }\nstruct Transfer: PaymentMethod { let fee = 0.0 }",
      },
      {
        kind: "explain",
        title: "L, I and D",
        body: [
          "**Liskov**: a subtype must be able to replace its parent without breaking anything. If `Square: Rectangle` breaks `setWidth`, you're violating L.",
          "**Interface Segregation**: small protocols. Better `Readable` and `Writable` than a `Storage` with 12 methods nobody fully implements.",
          "**Dependency Inversion**: depend on abstractions. The ViewModel receives `UserRepository` (a protocol), not `APIUserRepository` (a concrete type). That's what lets you test with mocks.",
        ],
        code: "// D in action\nprotocol UserRepository { func user(id: Int) async throws -> User }\nfinal class ProfileViewModel {\n    private let repo: UserRepository\n    init(repo: UserRepository) { self.repo = repo }   // init injection\n}\n// In tests: ProfileViewModel(repo: FakeUserRepository())",
      },
      {
        kind: "predict",
        prompt: "Which principle does this violate?",
        code: "protocol Vehicle { func drive(); func fly(); func sail() }\nstruct Car: Vehicle {\n    func drive() {}\n    func fly() { fatalError() }\n    func sail() { fatalError() }\n}",
        options: ["Single Responsibility", "Open/Closed", "Interface Segregation", "Dependency Inversion"],
        answer: 2,
        explanation: "The protocol forces you to implement methods that don't apply. Split it into `Drivable`, `Flyable`, `Sailable`.",
      },
      {
        kind: "explain",
        title: "Patterns they ask about",
        body: [
          "**Singleton**: one global instance (`URLSession.shared`). Convenient, hard to test; use it sparingly.",
          "**Factory**: a function/object that decides which instance to create (`ViewModelFactory.make(for: screen)`).",
          "**Strategy**: swap an algorithm through a protocol (`SortStrategy`).",
          "**Observer**: notify subscribers about changes (Combine, NotificationCenter, `@Published`).",
          "**Repository**: abstract the data source. **Adapter**: wrap someone else's API behind your interface. **Decorator**: add behavior by wrapping (a `LoggingHTTPClient` that wraps another `HTTPClient`).",
        ],
      },
      {
        kind: "fill",
        prompt: "What pattern is a `CachingHTTPClient` that takes another `HTTPClient`, conforms to the same protocol and adds caching before delegating?",
        code: "final class CachingHTTPClient: HTTPClient {\n    private let inner: HTTPClient\n    init(wrapping inner: HTTPClient) { self.inner = inner }\n}\n// Pattern: ____",
        accept: ["^decorator$", "^decorador$"],
        explanation: "Decorator: same interface, wraps and adds behavior.",
        placeholder: "pattern name",
      },
      {
        kind: "explain",
        title: "Testing and Git on one screen",
        body: [
          "Pyramid: lots of unit tests (fast), fewer integration tests, few UI/e2e tests. TDD: red → green → refactor. Mock = verifies interactions; stub = returns fixed values; fake = a simplified implementation that actually works.",
          "Git: `merge` creates a merge commit and preserves history; `rebase` rewrites your commits on top of the base (new hashes, linear history) and **isn't used on shared branches**. `squash` combines commits. `cherry-pick` copies a commit to another branch. Conflict = two changes on the same lines; you resolve it by hand and commit.",
          "CI per PR: lint + build + tests. CD: a signed build to TestFlight automatically from `main`/`release`.",
        ],
      },
      {
        kind: "predict",
        prompt: "You're on `feature/x`, you run `git rebase main` and then `git push`. The push fails with 'rejected (non-fast-forward)'. Why?",
        code: "",
        options: ["main has conflicts", "Your commits now have different hashes and the remote has the old ones", "You need to merge first", "Git doesn't allow rebasing feature branches"],
        answer: 1,
        explanation: "rebase rewrote your local history. If the branch was already published, you need `push --force-with-lease` (and only if nobody else is working on it).",
      },
    ],
  },
];
