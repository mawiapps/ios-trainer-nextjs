import type { CourseContent } from "../types";

// String.raw keeps Swift backslashes (`\(x)`, `\.id`) as they are.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    {
      id: "urlsession-async",
      title: "URLSession with async/await",
      goal: "Build a complete `URLRequest`, read the `HTTPURLResponse`, build URLs with `URLComponents`, and handle timeouts and transport errors.",
      minutes: 15,
      steps: [
        {
          kind: "explain",
          title: "Anatomy of a URLRequest",
          body: [
            "`URLRequest` describes what you are asking for: URL, method (`httpMethod`), headers and body (`httpBody`). It is a struct: create it with `var`, configure it, and hand it to the session.",
            "To send JSON, encode an `Encodable` with `JSONEncoder` and set `Content-Type: application/json`. To ask for JSON, set `Accept: application/json`. Header names are case-insensitive: `value(forHTTPHeaderField:)` finds `content-type` just the same.",
            "`timeoutInterval` is per request and defaults to 60 seconds. Careful: it is an **idle** timeout (time without receiving data), not the total duration.",
          ],
          code: swift`struct NewPost: Encodable {
    let title: String
}

var request = URLRequest(url: URL(string: "https://api.example.com/posts")!)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.httpBody = try JSONEncoder().encode(NewPost(title: "Hello"))
request.timeoutInterval = 15

print(request.httpMethod ?? "-")
print(request.value(forHTTPHeaderField: "content-type") ?? "-")
print(request.timeoutInterval)`,
          output: "POST\napplication/json\n15.0",
        },
        {
          kind: "predict",
          prompt: "What does a freshly created `URLRequest` print, without touching anything?",
          code: swift`let request = URLRequest(url: URL(string: "https://api.example.com/posts")!)
print(request.httpMethod ?? "nil", request.timeoutInterval)`,
          options: ["`nil 60.0`", "`GET 60.0`", "`GET 0.0`", "`POST 60.0`"],
          answer: 1,
          explanation: "The default method of `URLRequest` is `GET`, so `httpMethod` is not `nil`. The default `timeoutInterval` is 60 seconds, and printing a `Double` shows `60.0`. `print` separates the two values with a space.",
        },
        {
          kind: "explain",
          title: "data(for:) and the status code",
          body: [
            "`try await URLSession.shared.data(for: request)` returns `(Data, URLResponse)`. For HTTP the response is actually an `HTTPURLResponse`, so you cast it with `as?` to read `statusCode` and headers.",
            "Interview classic: `data(for:)` **only throws transport errors** (no network, timeout, cancellation, TLS). A 404 or a 500 is a valid HTTP response: it comes back without a `throw` and validating the `200..<300` range is your job.",
            "There is `data(from: url)` for a plain GET, but in a real networking layer you almost always use `data(for:)` because you need headers.",
          ],
          code: swift`func fetchData(_ request: URLRequest) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse else {
        throw URLError(.badServerResponse)
    }
    guard (200..<300).contains(http.statusCode) else {
        throw URLError(.badServerResponse) // next lesson: our own errors
    }
    return data
}`,
        },
        {
          kind: "predict",
          prompt: "The server answers `404` with an error JSON. What gets printed?",
          code: swift`do {
    let (_, response) = try await URLSession.shared.data(for: request)
    print("no throw:", (response as! HTTPURLResponse).statusCode)
} catch {
    print("throw:", error)
}`,
          options: [
            "`throw: ` followed by a `badServerResponse` `URLError`",
            "`no throw: 200`",
            "`no throw: 404`",
            "Nothing: the `await` hangs forever",
          ],
          answer: 2,
          explanation: "The request reached the server and a complete HTTP response came back, so there is no transport error: `data(for:)` does not throw. The `statusCode` is the real one, `404`. That is why you always validate the status yourself.",
        },
        {
          kind: "explain",
          title: "URLComponents for query items",
          body: [
            "Never build the query by concatenating strings (`\"?q=\" + text`): a space, an `ñ` or an `&` in what the user typed breaks the URL. `URLComponents` with `queryItems` encodes every value for you.",
            "Known gotcha: `URLComponents` does not encode `+`, and many servers read it as a space. If your values can contain `+`, replace it with `%2B` in `percentEncodedQuery`.",
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
          prompt: "Fill in the property that adds the already-encoded query parameters.",
          code: swift`var components = URLComponents(string: "https://api.example.com/posts")!
components.____ = [URLQueryItem(name: "page", value: "2")]`,
          accept: ["^queryItems$"],
          explanation: "`queryItems` takes an array of `URLQueryItem` and `URLComponents` builds `?page=2`, encoding each value.",
          placeholder: "property",
        },
        {
          kind: "explain",
          title: "Timeouts and transport errors",
          body: [
            "On `URLSessionConfiguration`: `timeoutIntervalForRequest` is the maximum time **without receiving data** (60 s by default) and `timeoutIntervalForResource` is the maximum **total** transfer time (7 days by default). For an app API, lower both.",
            "`waitsForConnectivity = true` makes the session wait for the network to come back instead of failing right away; the wait is bounded by the resource timeout.",
            "Transport errors arrive as `URLError`. The ones the UI cares about: `.notConnectedToInternet` and `.networkConnectionLost` (offline), `.timedOut` (offer a retry) and `.cancelled` (show nothing: your own code cancelled it).",
          ],
          code: swift`let config = URLSessionConfiguration.default
config.timeoutIntervalForRequest = 15   // max time without data
config.timeoutIntervalForResource = 60  // max total time
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
          prompt: "Write `fetchPosts(page:)`: GET `https://api.example.com/posts` with the `page` query item and an `Accept: application/json` header, check that the response is an `HTTPURLResponse` with a 2xx status, and decode `[Post]`.",
          starter: swift`struct Post: Decodable {
    let id: Int
    let title: String
}

func fetchPosts(page: Int) async throws -> [Post] {
    // GET https://api.example.com/posts with the "page" query item
    fatalError("TODO")
}`,
          checks: [
            { pattern: "URLComponents\\(", label: "builds the URL with `URLComponents`" },
            { pattern: "queryItems", label: "uses `queryItems` for `page`" },
            { pattern: "\\.data\\(for:", label: "sends with `data(for:)`" },
            { pattern: "as\\?\\s*HTTPURLResponse", label: "casts to `HTTPURLResponse`" },
            { pattern: "200\\.\\.<300|200\\.\\.\\.299", label: "validates the 2xx range" },
            { pattern: "JSONDecoder\\(\\)", label: "decodes with `JSONDecoder`" },
          ],
          warnings: [
            { pattern: "try!", label: "`try!` crashes on any network error" },
            { pattern: "\\?page=", label: "hand-built query: use `URLQueryItem`" },
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
          hint: "Order: `URLComponents` → `URLRequest` → `data(for:)` → status `guard` → `decode`.",
        },
      ],
    },
    {
      id: "api-client",
      title: "A testable API client",
      goal: "Design an `APIClient` with a typed `Endpoint`, a generic `send`, custom errors, retries with backoff, cancellation and token refresh.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Typed Endpoint + injectable HTTPClient",
          body: [
            "An `Endpoint<Response>` describes a call (path, method, query, body) and **carries the response type in its generic parameter**. So `send(.posts(page: 1))` already knows it returns `[Post]`, no casting.",
            "The client does not use `URLSession.shared` directly: it depends on an `HTTPClient` protocol. In production `URLSession` conforms; in tests, a stub returns whatever status and JSON you want without touching the network.",
            "This is the pattern reviewers expect in a networking-layer PR: one generic function that builds the request, sends it, validates and decodes.",
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

// In tests: no network, controlled response
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
          prompt: "Fill in the generic constraint so `send` can decode any response.",
          code: swift`func send<T: ____>(_ endpoint: Endpoint<T>) async throws -> T`,
          accept: ["^Decodable$", "^Codable$"],
          explanation: "`T: Decodable` is enough for `JSONDecoder().decode(T.self, from:)`. `Codable` compiles too, but needlessly requires `Encodable`.",
          placeholder: "protocol",
        },
        {
          kind: "explain",
          title: "Custom errors: map everything to a few cases",
          body: [
            "The UI should not know about `URLError`, HTTP codes or `DecodingError`. The client translates them into a small `APIError`, and each case has a useful message for the user.",
            "Typical buckets: **offline** (no network or timeout), **unauthorized** (401: refresh the token or ask for login), **server** (5xx: retryable), **client** (other 4xx: don't insist) and **decoding** (the contract changed: tell backend, not the user).",
            "`URLError.cancelled` is not mapped: it passes through and the UI ignores it.",
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
        case .offline: "You're offline. Showing the last saved content."
        case .unauthorized: "Your session expired. Please sign in again."
        case .server: "The service is having trouble. Try again in a bit."
        case .client, .decoding: "Something went wrong. We're looking into it."
        }
    }
}

for code in [204, 401] {
    if let error = mapStatus(code) { print(error.userMessage) } else { print("ok") }
}`,
          output: "ok\nYour session expired. Please sign in again.",
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
          explanation: "200 falls in `200..<300` → `nil` → prints `ok`. 401 has its own case before `default`. 404 is neither 401 nor 5xx → `client(404)`. 502 is in `500..<600` → `server(502)`. Printing an enum with an associated value shows `case(value)`.",
        },
        {
          kind: "explain",
          title: "Retries with exponential backoff",
          body: [
            "Retry only what is **transient**: offline/timeout, 5xx, 429. Never a 400, 401 or 422: it will fail the same way. And careful with POST: without an `Idempotency-Key` a retry can duplicate the operation.",
            "Exponential backoff: wait 0.5 s, 1 s, 2 s… so you don't hammer a server that is down. In production you add *jitter* (a random component) so thousands of apps don't retry at the same instant.",
            "`Task.sleep(for:)` throws `CancellationError` if the task is cancelled, so the retry loop stops by itself when the user leaves the screen.",
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
    return try await operation() // last attempt: the error propagates
}`,
        },
        {
          kind: "predict",
          prompt: "We simulate the waits of `withRetry` with `maxAttempts: 4` and every call failing with `.server(503)`. What does it print?",
          code: swift`var delay = 0.5
var waits: [Double] = []
for _ in 1..<4 {
    waits.append(delay)
    delay *= 2
}
print(waits)`,
          options: ["`[0.5, 1.0, 2.0, 4.0]`", "`[0.5, 0.5, 0.5]`", "`[1.0, 2.0, 4.0]`", "`[0.5, 1.0, 2.0]`"],
          answer: 3,
          explanation: "`1..<4` iterates 3 times (1, 2, 3): there are 3 waits between 4 attempts. It starts at 0.5 and doubles: 0.5, 1.0, 2.0. The fourth attempt has no wait after it: if it fails, the error propagates.",
        },
        {
          kind: "explain",
          title: "Cancellation and the access token",
          body: [
            "If the `Task` calling `data(for:)` is cancelled (for example, SwiftUI's `.task` when the view goes away), URLSession stops the request and throws a `URLError` with code `.cancelled`. That is not an error for the user: catch it and show nothing.",
            "The token goes in `Authorization: Bearer <token>`. On a 401 you refresh **once** and retry **once**; if it fails again, sign out.",
            "If five requests get a 401 at the same time, they must share a single refresh. An `actor` that stores the in-flight refresh `Task` solves it (the full version lives in the concurrency and security courses).",
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
        if let refreshTask { return try await refreshTask.value } // one is already running
        let task = Task { try await refresher() }
        refreshTask = task
        defer { refreshTask = nil }
        accessToken = try await task.value
        return accessToken
    }
}

// In APIClient
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
          prompt: "Fill in the `URLError` code you get when your own `Task` is cancelled, so you don't show an error to the user.",
          code: swift`do {
    posts = try await api.send(.posts(page: 1))
} catch let error as URLError where error.code == .____ {
    return // the user left the screen
} catch {
    errorMessage = (error as? APIError)?.userMessage ?? "Something went wrong."
}`,
          accept: ["^cancelled$"],
          explanation: "URLSession turns `Task` cancellation into `URLError(.cancelled)`. Ignore it silently; in code that doesn't use URLSession, cancellation usually arrives as `CancellationError`.",
          placeholder: "code",
        },
        {
          kind: "write",
          prompt: "Complete `APIClient.send`: send through the injected `http`, map 401 → `.unauthorized`, 5xx → `.server`, other non-2xx → `.client`, and a `DecodingError` → `.decoding`.",
          starter: swift`struct APIClient: Sendable {
    let baseURL: URL
    let http: any HTTPClient

    func send<T: Decodable>(_ endpoint: Endpoint<T>) async throws -> T {
        let request = makeRequest(endpoint)
        // TODO: send, validate the status and decode
        fatalError("TODO")
    }
}`,
          checks: [
            { pattern: "http\\.send\\(", label: "uses the injected `HTTPClient`" },
            { pattern: "as\\?\\s*HTTPURLResponse", label: "casts to `HTTPURLResponse`" },
            { pattern: "\\b401\\b", label: "handles 401 separately" },
            { pattern: "500\\.\\.<600|500\\.\\.\\.599", label: "groups 5xx" },
            { pattern: "DecodingError", label: "catches `DecodingError`" },
            { pattern: "\\.decoding\\b", label: "maps it to `.decoding`" },
          ],
          warnings: [
            { pattern: "URLSession\\.shared", label: "`URLSession.shared` directly: the client is no longer testable" },
            { pattern: "try!", label: "`try!` turns an odd JSON into a crash" },
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
          hint: "A `switch status` with `case 200..<300: break`, then the `decode` inside a `do/catch is DecodingError`.",
        },
      ],
    },
    {
      id: "pagination-search",
      title: "Pagination and search",
      goal: "Choose between page and cursor pagination, build infinite scroll without duplicates or double requests, and a debounced search that cancels the previous one.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Page vs cursor",
          body: [
            "**Page/offset** (`?page=3&limit=20`): simple, lets you jump to page N. Problem: if new items land at the top while you scroll, everything shifts and you see duplicates (or skip some).",
            "**Cursor** (`?cursor=abc&limit=20`): the server returns an opaque `nextCursor` that points to \"after the last one you saw\". It stays stable when data changes; it is what feeds use. `nextCursor == nil` means there is nothing more.",
          ],
          code: swift`// Page:   GET /posts?page=3&limit=20
// Cursor: GET /feed?cursor=eyJpZCI6MTIwfQ&limit=20

struct Post: Decodable, Identifiable, Sendable {
    let id: Int
    let title: String
}

struct FeedPage: Decodable, Sendable {
    let items: [Post]
    let nextCursor: String? // nil = nothing more
}

protocol PostsAPI: Sendable {
    func feed(cursor: String?) async throws -> FeedPage
    func search(_ query: String) async throws -> [Post]
}`,
        },
        {
          kind: "predict",
          prompt: "Offset pagination, 10 items per page. You loaded page 1 (posts 1 to 10). Before you request page 2, 2 new posts are published at the very top. What does page 2 return?",
          code: swift`GET /posts?page=1&limit=10  → posts 1...10
// 2 new posts are published at the top
GET /posts?page=2&limit=10  → ?`,
          options: [
            "Posts 11 to 20, as if nothing happened",
            "Posts 9 to 18: 9 and 10 show up twice",
            "The 2 new posts, then 11 to 18",
            "A 409 error because the list changed",
          ],
          answer: 1,
          explanation: "Page 2's offset is 10. With 2 new items on top, everything shifted 2 places: positions 11 to 20 are now the old posts 9 to 18. Posts 9 and 10 were already on screen → duplicates. With a cursor this doesn't happen.",
        },
        {
          kind: "explain",
          title: "Infinite scroll without duplicates",
          body: [
            "Three guards: `isLoading` (two quick `onAppear` calls must not fire two requests for the same page), `hasMore` (don't ask past the end) and a `Set` of seen ids (in case the server repeats something anyway).",
            "`seen.insert(id).inserted` returns `true` only the first time: a one-line filter.",
            "You trigger the load when the last row appears. With `@Observable` (iOS 17) the view updates by itself; in older code this would be an `ObservableObject` with `@Published`.",
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
            // see lesson 2: map to APIError.userMessage
        }
    }
}

// In the view
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
          explanation: "2 was already there → `inserted == false`, dropped. The first 3 gets inserted (`true`). The second 3 is already there → dropped. 4 gets inserted. Result: `[3, 4]`. The filter removes duplicates against old data and within the same page.",
        },
        {
          kind: "fill",
          prompt: "Fill in the second guard so you don't request pages past the end of the feed.",
          code: swift`func loadNextPage() async {
    guard !isLoading, ____ else { return }
    isLoading = true
    defer { isLoading = false }
    // ...
}`,
          accept: ["^hasMore$", "^self\\.hasMore$", "^hasMore\\s*==\\s*true$"],
          explanation: "`hasMore` becomes `false` when the server returns `nextCursor == nil`. Without that guard, every time the last row appears you request an empty page again.",
          placeholder: "condition",
        },
        {
          kind: "explain",
          title: "Debounced search that cancels the previous one",
          body: [
            "If you search on every keystroke, \"swift\" is 5 requests, and the response for \"sw\" can arrive **after** the one for \"swift\" and overwrite it. Fix: wait ~300 ms of quiet (debounce) and cancel the previous search.",
            "Each change cancels the previous `Task` and creates a new one that sleeps 300 ms. If another keystroke arrives, the old one is cancelled during its `sleep` and never makes the request. Before assigning results, check `Task.isCancelled` so a stale response is never rendered.",
            "In pure SwiftUI, `.task(id: query)` does the same: it cancels the previous task every time `query` changes, and you put the `Task.sleep` inside.",
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
          prompt: "With the `SearchViewModel` above, the user types `s`, `sw` and `swi` 100 ms apart and then stops. How many search requests go out?",
          code: swift`t = 0 ms    queryChanged("s")
t = 100 ms  queryChanged("sw")
t = 200 ms  queryChanged("swi")
// nothing else`,
          options: ["3", "0", "1", "2"],
          answer: 2,
          explanation: "The `s` task is cancelled at 100 ms, during its 300 ms `sleep`; `Task.isCancelled` is `true` and it returns without a request. Same for `sw` at 200 ms. Only the `swi` task finishes its `sleep` (at 500 ms) and makes 1 request.",
        },
        {
          kind: "write",
          prompt: "Implement `queryChanged` with a 300 ms debounce: cancel the previous search, store the new `Task` in `searchTask`, and don't assign results if the task was cancelled.",
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
            { pattern: "searchTask\\?\\.cancel\\(\\)", label: "cancels the previous search" },
            { pattern: "searchTask\\s*=\\s*Task", label: "stores the new `Task`" },
            { pattern: "Task\\.sleep\\(", label: "waits with `Task.sleep`" },
            { pattern: "Task\\.isCancelled|Task\\.checkCancellation", label: "checks cancellation before assigning" },
          ],
          warnings: [
            { pattern: "DispatchQueue", label: "`DispatchQueue.asyncAfter` is not cancelled along with the `Task`" },
            { pattern: "Timer\\.", label: "`Timer` is the old way; use `Task.sleep`" },
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
                // cancelled or offline: keep the previous results
            }
        }
    }
}`,
          hint: "First line: `searchTask?.cancel()`. Inside the `Task`: `sleep`, `guard !Task.isCancelled`, search, another `guard`, assign.",
        },
      ],
    },
    {
      id: "images-caching",
      title: "Images and caching",
      goal: "Know when `AsyncImage` is enough, use `NSCache` and `URLCache`, write an image loader without duplicate downloads, and cut memory with downsampling.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "AsyncImage and its limits",
          body: [
            "`AsyncImage` handles an avatar or a detail screen in three lines: it downloads, shows a placeholder and handles failure through `phase`.",
            "Limits in a feed: it uses the shared session, so caching depends on `URLCache` and the server's headers; in lists it can download again when a cell reappears; you can't add headers (auth, for example); and it decodes the image at full size even if you show it at 80 pt.",
            "For long lists with many images you use your own loader (or a library like Kingfisher/Nuke) with an in-memory cache and downsampling.",
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
          prompt: "A 4000 × 3000 pixel camera photo is 3 MB as a JPEG. Roughly how much memory does it take once decoded for display (RGBA, 4 bytes per pixel)?",
          code: swift`let width = 4000, height = 3000
let jpegBytes = 3_000_000
// decoded memory ≈ ?`,
          options: ["≈ 3 MB, same as the JPEG", "≈ 12 MB", "≈ 192 MB", "≈ 48 MB"],
          answer: 3,
          explanation: "Decoded memory depends on pixels, not on file size: 4000 × 3000 × 4 = 48,000,000 bytes ≈ 48 MB. Ten of those in a feed and the app gets killed for memory. That's why you downsample.",
        },
        {
          kind: "explain",
          title: "NSCache and URLCache",
          body: [
            "`NSCache` is an **in-memory**, thread-safe cache that the system purges on its own under memory pressure. Keys and values must be classes: `NSCache<NSURL, UIImage>`. You give it a `countLimit` and `totalCostLimit` and, when storing, an approximate `cost`.",
            "`URLCache` is `URLSession`'s **HTTP** cache, in memory and on disk. It stores responses according to the server's headers (`Cache-Control`, `ETag`). Making `URLCache.shared` bigger at launch helps `AsyncImage` and any cacheable GET.",
            "They aren't exclusive: `URLCache` avoids the network; `NSCache` avoids decoding again.",
          ],
          code: swift`let imageCache = NSCache<NSURL, UIImage>()
imageCache.countLimit = 200
imageCache.totalCostLimit = 100 * 1024 * 1024 // ~100 MB

// At app launch
URLCache.shared = URLCache(
    memoryCapacity: 20 * 1024 * 1024,
    diskCapacity: 200 * 1024 * 1024,
    directory: nil
)`,
        },
        {
          kind: "fill",
          prompt: "Fill in the key type: `NSCache` requires classes, so a `URL` (a struct) can't be used directly.",
          code: swift`let cache = NSCache<____, UIImage>()
cache.setObject(image, forKey: url as NSURL)`,
          accept: ["^NSURL$", "^NSString$"],
          explanation: "`NSURL` is the class counterpart of `URL`; you bridge with `url as NSURL`. `NSString` also works if you use `url.absoluteString as NSString`.",
          placeholder: "type",
        },
        {
          kind: "explain",
          title: "A small image loader",
          body: [
            "An `actor` protects the state: the cache and a dictionary of **in-flight** downloads. If two cells ask for the same URL at once, the second one awaits the same `Task` instead of downloading again.",
            "Notice there is no `await` between reading `inFlight[url]` and storing the new `Task`: that's why actor reentrancy can't sneak in a second download.",
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
          prompt: "Two cells call `loader.image(for: url)` with the same URL almost simultaneously, and the image isn't cached. How many downloads does the `ImageLoader` above perform?",
          code: swift`async let a = loader.image(for: url)
async let b = loader.image(for: url)
let (first, second) = try await (a, b)`,
          options: [
            "1: the second call finds the `Task` in `inFlight` and awaits it",
            "2: each call downloads on its own",
            "0: the second call cancels the first",
            "It depends on ordering: sometimes 1, sometimes 2, because of reentrancy",
          ],
          answer: 0,
          explanation: "The actor runs one call at a time until the first `await`. The first call checks the cache and `inFlight`, creates the `Task` and stores it **without suspending** in between. When the second call gets in, it already finds it in `inFlight` and awaits the same one. With an `await` between the check and the store, you could get 2.",
        },
        {
          kind: "explain",
          title: "Downsampling: decode at the size you display",
          body: [
            "If the thumbnail is shown at 100 × 100 pt on an @3x iPhone, you need 300 × 300 pixels, not 4000 × 3000. With ImageIO you create a thumbnail straight from the bytes, without decoding the full image.",
            "`kCGImageSourceShouldCache: false` keeps the original from being decoded; `kCGImageSourceThumbnailMaxPixelSize` sets the longest side in pixels. Since iOS 15 there is also `UIImage.preparingThumbnail(of:)` for simple cases.",
            "Do it off the main thread (inside the `ImageLoader`, for example) and cache the already-reduced result.",
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
          prompt: "Same photo, now downsampled for a 100 × 100 pt thumbnail on an @3x screen. What does it print?",
          code: swift`let side = 100.0 * 3.0
let bytes = Int(side * side * 4)
print(bytes)`,
          options: ["`40000`", "`120000`", "`360000`", "`1440000`"],
          answer: 2,
          explanation: "100 pt × 3 = 300 pixels per side. 300 × 300 × 4 bytes = 360000 bytes ≈ 0.36 MB, versus ≈ 48 MB for the original: over 100 times less. `Int(...)` turns the `Double` 360000.0 into `360000`.",
        },
        {
          kind: "write",
          prompt: "Complete `image(for:)`: return the cached image if present; otherwise download it asynchronously, turn it into a `UIImage(data:)` (throw if that fails) and store it in the cache before returning it.",
          starter: swift`actor ImageLoader {
    private let cache = NSCache<NSURL, UIImage>()

    func image(for url: URL) async throws -> UIImage {
        // TODO
        fatalError("TODO")
    }
}`,
          checks: [
            { pattern: "cache\\.object\\(forKey:", label: "looks in the cache first" },
            { pattern: "\\.data\\((from|for):", label: "downloads with async `URLSession`" },
            { pattern: "UIImage\\(data:", label: "decodes with `UIImage(data:)`" },
            { pattern: "cache\\.setObject\\(", label: "stores the result in the cache" },
          ],
          warnings: [
            { pattern: "Data\\(contentsOf:", label: "`Data(contentsOf:)` with a remote URL blocks the thread" },
            { pattern: "try!", label: "`try!` crashes if the download fails" },
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
          hint: "`if let cached = cache.object(forKey: url as NSURL) { return cached }`, then the download.",
        },
      ],
    },
    {
      id: "persistence",
      title: "Local persistence and offline-first",
      goal: "Choose where each piece of data lives (`UserDefaults`, files, Keychain, SwiftData/Core Data) and build a repository with the local store as the source of truth.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Where everything goes",
          body: [
            "**`UserDefaults`**: small preferences (theme, last tab, onboarding flags). Not for big lists or secrets: it is an unencrypted plist loaded in full. In SwiftUI, `@AppStorage` wraps it.",
            "**Files**: `Documents` for user content (backed up to iCloud), `Application Support` for the app's internal data, `Caches` for anything you can download again (the system may delete it when space runs low).",
            "**Keychain**: tokens, passwords, keys. Encrypted and outside the file sandbox (details in the security course). **SwiftData/Core Data**: structured data with queries, relationships and incremental changes.",
          ],
          code: swift`let defaults = UserDefaults.standard
defaults.set(true, forKey: "prefersCompactFeed")

print(defaults.bool(forKey: "prefersCompactFeed"))
print(defaults.integer(forKey: "missingKey"))

// In SwiftUI
struct SettingsView: View {
    @AppStorage("prefersCompactFeed") private var compact = false
    var body: some View { Toggle("Compact feed", isOn: $compact) }
}`,
          output: "true\n0",
        },
        {
          kind: "predict",
          prompt: "You want to save the JSON of the feed's first page (about 2 MB) to show it on launch without a network. If it's lost, it gets downloaded again. Where does it go?",
          code: swift`let data = try JSONEncoder().encode(firstPage)
// where do I write it?`,
          options: [
            "`UserDefaults`, under the `feedCache` key",
            "Keychain, so other apps can't read it",
            "A file in `Caches`",
            "A file in `Documents`",
          ],
          answer: 2,
          explanation: "It's rebuildable data: it goes in `Caches`, which isn't backed up and can be purged by the system. `UserDefaults` is loaded fully into memory and isn't meant for 2 MB. Keychain is for small secrets. `Documents` is for user content and gets backed up to iCloud.",
        },
        {
          kind: "explain",
          title: "Files with FileManager",
          body: [
            "Since iOS 16 you have shortcuts: `URL.cachesDirectory`, `URL.documentsDirectory`, `URL.applicationSupportDirectory`, and `appending(path:)` to build the path.",
            "Write with `.atomic`: the data goes to a temporary file first and is then renamed, so a crash halfway through doesn't leave a truncated JSON. Before reading, check that the file exists (on first launch there's nothing).",
          ],
          code: swift`let file = URL.cachesDirectory.appending(path: "feed.json")

// Save
let data = try JSONEncoder().encode(posts)
try data.write(to: file, options: .atomic)

// Read
if FileManager.default.fileExists(atPath: file.path()) {
    let saved = try JSONDecoder().decode([Post].self, from: Data(contentsOf: file))
    print(saved.count)
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the right directory for a cache that can be downloaded again.",
          code: swift`let file = URL.____.appending(path: "feed.json")`,
          accept: ["^cachesDirectory$"],
          explanation: "`URL.cachesDirectory` (iOS 16+) points to `Library/Caches`: it isn't backed up and the system can empty it, which is exactly what you want for a cache.",
          placeholder: "directory",
        },
        {
          kind: "write",
          prompt: "Write `FilePostStore` with `save(_:)` and `load()`: store `[Post]` as JSON in `Caches` with an atomic write, and make `load()` return `[]` if the file doesn't exist yet.",
          starter: swift`struct Post: Codable, Identifiable {
    let id: Int
    let title: String
}

struct FilePostStore {
    func save(_ posts: [Post]) throws {
        // TODO
    }

    func load() throws -> [Post] {
        // TODO: no file yet → return []
        []
    }
}`,
          checks: [
            { pattern: "cachesDirectory", label: "uses the `Caches` directory" },
            { pattern: "JSONEncoder\\(\\)\\.encode", label: "encodes with `JSONEncoder`" },
            { pattern: "\\.atomic", label: "writes with `.atomic`" },
            { pattern: "JSONDecoder\\(\\)\\.decode", label: "decodes with `JSONDecoder`" },
            { pattern: "fileExists|try\\?|catch", label: "handles a missing file" },
          ],
          warnings: [
            { pattern: "UserDefaults", label: "`UserDefaults` isn't for big lists" },
            { pattern: "documentsDirectory|documentDirectory", label: "`Documents` is for user content and gets backed up; a cache belongs in `Caches`" },
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
          hint: "Keep the URL in a property: `URL.cachesDirectory.appending(path: \"feed.json\")`.",
        },
        {
          kind: "explain",
          title: "SwiftData and Core Data",
          body: [
            "**SwiftData** (iOS 17): mark a class with `@Model`, register the container with `.modelContainer(for:)`, and the view reads with `@Query`, which updates by itself when you insert or delete through the `modelContext`. `@Attribute(.unique)` makes inserting a repeated id update the existing row instead of duplicating it (upsert).",
            "**Core Data** is still in most apps with a few years on them: `NSPersistentContainer`, `viewContext` for the main thread and background contexts for imports. In an existing app you don't rewrite everything: you isolate it behind a repository and migrate piece by piece if it pays off.",
            "Either way, the view shouldn't know whether data came from the network or from disk: the repository decides.",
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

// Core Data in an existing app
let container = NSPersistentContainer(name: "Model")
container.loadPersistentStores { _, error in
    if let error { fatalError("Core Data: \(error)") }
}
let viewContext = container.viewContext // main thread only`,
        },
        {
          kind: "predict",
          prompt: "After a refresh, the repository calls `context.insert(CachedPost(...))` with a new post. What happens to `FeedView`?",
          code: swift`@Query(sort: \CachedPost.publishedAt, order: .reverse)
private var posts: [CachedPost]

// elsewhere, same ModelContainer:
context.insert(CachedPost(remoteID: 99, title: "New", publishedAt: .now))`,
          options: [
            "Nothing until you call `context.save()` and reload the view by hand",
            "`@Query` picks up the change and the list updates by itself, sorted",
            "It crashes: you can't insert while a `@Query` is active",
            "It updates only if `CachedPost` is an `ObservableObject`",
          ],
          answer: 1,
          explanation: "`@Query` observes the `ModelContext` and re-runs the fetch when models of that type change, honoring the `sort`. No manual reload needed; `@Model` already makes the class observable (it isn't an `ObservableObject`).",
        },
        {
          kind: "explain",
          title: "Offline-first: the local store rules",
          body: [
            "Offline-first = the UI always reads from local data. The repository: 1) emits what's saved right away, 2) hits the network, 3) saves, 4) emits the fresh data. With no network the user still sees something, plus a notice.",
            "`NWPathMonitor` (the `Network` framework) tells you when connectivity changes. Use it to show a banner and to resync when the network comes back, **not** to block requests: the monitor can be wrong, so you still attempt the call.",
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
                    try store.save(fresh)                 // 3. save
                    continuation.yield(fresh)             // 4. fresh data
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
          prompt: "With `FeedRepository.posts()` above: there's no network and 20 posts are saved on disk. What does the view iterating the stream get?",
          code: swift`do {
    for try await posts in repository.posts() {
        self.posts = posts
    }
} catch {
    banner = "You're offline"
}`,
          options: [
            "Only the error: the stream fails before emitting anything",
            "An empty list, then the error",
            "The 20 posts, and the stream stays open waiting for the network",
            "The 20 posts, then the stream ends with an error, so the banner shows",
          ],
          answer: 3,
          explanation: "Local data is emitted first (`yield(cached)`), so `self.posts` gets the 20. Then the network fails and `finish(throwing:)` makes the `for try await` throw: the `catch` runs and the banner appears over the saved data. That's the offline-first experience.",
        },
        {
          kind: "fill",
          prompt: "Fill in the `NWPath` status that means there is a usable network route.",
          code: swift`monitor.pathUpdateHandler = { path in
    let isOnline = path.status == .____
}`,
          accept: ["^satisfied$"],
          explanation: "`NWPath.Status` has `.satisfied`, `.unsatisfied` and `.requiresConnection`. Only `.satisfied` means a usable network.",
          placeholder: "status",
        },
      ],
    },
    {
      id: "final-challenge",
      title: "Final challenge: paginated feed with an offline cache",
      goal: "Combine a typed endpoint, an offline-first repository, cursor pagination without duplicates and useful error messages.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "Product wants a \"What's new\" screen: a cursor-paginated feed (`GET /feed?limit=20&cursor=...`) that opens instantly with the last saved content, works offline and shows clear messages.",
            "You already have `APIClient.send` (lesson 2) with `APIError` and `userMessage`, and `FilePostStore` (lesson 5). Missing: the endpoint, the repository that picks network or cache, and the view model with infinite scroll.",
            "PR acceptance criteria: no `try!`, no duplicates, no double requests, cancellation shows no errors, and offline with a cache shows the data flagged as stale.",
          ],
          code: swift`struct FeedPage: Decodable, Sendable {
    let items: [Post]
    let nextCursor: String?
}

// Layers
// FeedView → FeedViewModel (@Observable, @MainActor)
//          → FeedRepository (network + FilePostStore)
//          → APIClient.send(Endpoint<FeedPage>)`,
        },
        {
          kind: "write",
          prompt: "Write the `feed(cursor:limit:)` endpoint: path `/feed`, the `limit` query item always, and `cursor` only when it isn't `nil`.",
          starter: swift`extension Endpoint where Response == FeedPage {
    static func feed(cursor: String?, limit: Int = 20) -> Self {
        // TODO
        fatalError("TODO")
    }
}`,
          checks: [
            { pattern: "path:\\s*\"/feed\"", label: "path `/feed`" },
            { pattern: "URLQueryItem\\(name:\\s*\"limit\"", label: "adds `limit`" },
            { pattern: "URLQueryItem\\(name:\\s*\"cursor\"", label: "adds `cursor`" },
            { pattern: "if\\s+let\\s+cursor|cursor\\.map|cursor\\s*!=\\s*nil", label: "`cursor` only when present" },
          ],
          warnings: [
            { pattern: "\"/feed\\?", label: "query built by hand in the path" },
            { pattern: "cursor!(?!=)", label: "force-unwrapping the cursor" },
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
          hint: "Build a `var items` with `limit` and append `cursor` inside an `if let cursor`.",
        },
        {
          kind: "write",
          prompt: "Implement `firstPage()`: fetch the first page from the network and save it; if it fails with `APIError.offline`, return whatever is in the store flagged `isStale: true`, and if the store is empty, rethrow.",
          starter: swift`struct FeedRepository: Sendable {
    let api: APIClient
    let store: FilePostStore

    func firstPage() async throws -> (page: FeedPage, isStale: Bool) {
        // TODO: network first; save; offline → cache
        fatalError("TODO")
    }

    func page(after cursor: String?) async throws -> FeedPage {
        try await api.send(.feed(cursor: cursor))
    }
}`,
          checks: [
            { pattern: "store\\.save\\(", label: "saves what came from the network" },
            { pattern: "catch", label: "catches the network error" },
            { pattern: "APIError\\.offline", label: "handles the offline case specifically" },
            { pattern: "store\\.load\\(\\)", label: "falls back to the local store" },
            { pattern: "isEmpty", label: "handles an empty store" },
            { pattern: "isStale:\\s*true|,\\s*true\\)", label: "flags the result as stale" },
          ],
          warnings: [
            { pattern: "try!", label: "`try!` in the repository" },
            { pattern: "UserDefaults", label: "the feed doesn't belong in `UserDefaults`" },
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
          hint: "`do { ... } catch APIError.offline { ... }`. The `let page: FeedPage` annotation tells the generic which endpoint to look up.",
        },
        {
          kind: "predict",
          prompt: "First app launch, in airplane mode. What does `firstPage()` do, and what should the user see?",
          code: swift`// empty store: load() returns []
let result = try await repository.firstPage()`,
          options: [
            "It returns an empty page with `isStale: true` and the user sees an empty list with no message",
            "It throws `APIError.offline`; the screen shows an empty state with \"You're offline\" and a retry button",
            "It throws `URLError.notConnectedToInternet` and the UI shows the error code",
            "It waits until the network comes back, with no feedback",
          ],
          answer: 1,
          explanation: "The `catch APIError.offline` loads the store, which is empty, so the `guard` rethrows `APIError.offline`. The view model turns it into a useful empty state with retry via `userMessage`. An empty list with no message looks like a bug.",
        },
        {
          kind: "write",
          prompt: "Implement `loadNextPage()`: `isLoading` and `hasMore` guards, a `defer` to reset `isLoading`, request `repository.page(after: nextCursor)`, append only unseen posts, update the cursor and `hasMore`, and map `APIError` to `errorMessage` (cancellation shows nothing).",
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
            { pattern: "guard\\s+!isLoading", label: "avoids double requests with `isLoading`" },
            { pattern: "hasMore\\s+else|,\\s*hasMore", label: "doesn't request past the end" },
            { pattern: "defer\\s*\\{\\s*isLoading\\s*=\\s*false", label: "resets `isLoading` with `defer`" },
            { pattern: "nextCursor\\s*=\\s*page\\.nextCursor", label: "updates the cursor" },
            { pattern: "\\.inserted", label: "filters duplicates with the `Set`" },
            { pattern: "userMessage", label: "shows the `APIError`'s `userMessage`" },
          ],
          warnings: [
            { pattern: "DispatchQueue", label: "no need for `DispatchQueue`: the class is already `@MainActor`" },
            { pattern: "try!", label: "`try!` in the view model" },
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
            // cancellation or another unmapped error: show nothing
        }
    }
}`,
          hint: "Reuse the structure from lesson 3 and add `catch let error as APIError`.",
        },
        {
          kind: "predict",
          prompt: "The user scrolls fast and leaves the screen while `loadNextPage()` is waiting on the network. The request is cancelled. With your `loadNextPage()`, what happens?",
          code: swift`} catch let error as APIError {
    errorMessage = error.userMessage
} catch {
    // cancellation or another unmapped error
}`,
          options: [
            "`URLError(.cancelled)` isn't an `APIError`: it lands in the last `catch`, nothing is shown, and `defer` resets `isLoading`",
            "\"You're offline\" is shown because the request didn't finish",
            "`isLoading` stays `true` forever and no more pages load",
            "The app crashes because the `Task` was cancelled inside an actor",
          ],
          answer: 0,
          explanation: "`APIClient` lets `URLError(.cancelled)` through unmapped, so it doesn't match `as APIError` and goes to the generic `catch`, which shows nothing. `defer` runs on every exit, so `isLoading` goes back to `false` and the next load works.",
        },
      ],
    },
  ],
  flashcards: [
    {
      id: "fc-status-no-throw",
      front: "Does `URLSession.data(for:)` throw on a 404 or a 500?",
      back: "No. It only throws transport errors (no network, timeout, cancellation, TLS). A 404/500 returns normally: cast to `HTTPURLResponse` and validate `200..<300` yourself.",
      code: swift`guard let http = response as? HTTPURLResponse,
      (200..<300).contains(http.statusCode) else { throw ... }`,
    },
    {
      id: "fc-urlcomponents",
      front: "Why `URLComponents` instead of string concatenation for the query?",
      back: "It encodes each value (spaces, accents, `&`). Gotcha: it doesn't encode `+`, which some servers read as a space.",
      code: swift`var c = URLComponents(string: "https://api.example.com/search")!
c.queryItems = [URLQueryItem(name: "q", value: text)]`,
    },
    {
      id: "fc-timeouts",
      front: "`timeoutIntervalForRequest` vs `timeoutIntervalForResource`",
      back: "Request: max time **without receiving data** (60 s by default, same as `URLRequest.timeoutInterval`). Resource: max **total** transfer time (7 days by default).",
    },
    {
      id: "fc-endpoint",
      front: "What does a generic `Endpoint<Response>` buy you?",
      back: "The response type travels with the endpoint: `send(.posts(page: 1))` returns `[Post]` with no casting. A single `send<T: Decodable>` builds, sends, validates and decodes.",
    },
    {
      id: "fc-http-client-protocol",
      front: "How do you make a networking client testable?",
      back: "Make it depend on a protocol (`HTTPClient`) instead of `URLSession.shared`. In tests you inject a stub that returns a controlled status and JSON, no network.",
    },
    {
      id: "fc-error-buckets",
      front: "Typical error buckets in a networking layer",
      back: "offline (no network/timeout), unauthorized (401), client (other 4xx), server (5xx), decoding. Each with a `userMessage`. Cancellation isn't mapped: it's ignored.",
    },
    {
      id: "fc-retry",
      front: "What do you retry, and how?",
      back: "Only transient failures: offline/timeout, 5xx, 429 (honoring `Retry-After`). Exponential backoff with jitter. Never 400/401/422. POST only with an `Idempotency-Key`.",
    },
    {
      id: "fc-token-refresh",
      front: "Five requests get a 401 at the same time. How many token refreshes?",
      back: "One. An `actor` stores the in-flight refresh `Task` and the rest await it. Each request retries only once; if the refresh fails, sign out.",
    },
    {
      id: "fc-cursor",
      front: "Page vs cursor pagination",
      back: "Page/offset: simple, but new items cause duplicates or skips. Cursor: opaque `nextCursor`, stable when data changes; `nil` = nothing more.",
    },
    {
      id: "fc-infinite-scroll",
      front: "The three guards of infinite scroll",
      back: "`isLoading` (no double requests), `hasMore` (don't ask past the end) and a `Set` of seen ids (no duplicates).",
      code: swift`posts += page.items.filter { seen.insert($0.id).inserted }`,
    },
    {
      id: "fc-debounce",
      front: "Debounced search with async/await",
      back: "Cancel the previous `Task`, create a new one that does `Task.sleep(for: .milliseconds(300))`, and check `Task.isCancelled` before requesting and before assigning. In SwiftUI: `.task(id: query)`.",
    },
    {
      id: "fc-nscache-urlcache",
      front: "`NSCache` vs `URLCache`",
      back: "`NSCache`: in memory, thread-safe, purged under pressure, class keys/values (`NSCache<NSURL, UIImage>`); avoids decoding again. `URLCache`: HTTP cache in memory and on disk driven by `Cache-Control`/`ETag`; avoids the network.",
    },
    {
      id: "fc-downsample",
      front: "How much memory does a decoded image use?",
      back: "Width × height × 4 bytes. A 4000 × 3000 photo ≈ 48 MB even if the JPEG is 3 MB. Fix: downsample with ImageIO to the pixel size you display.",
    },
    {
      id: "fc-where-to-store",
      front: "Where do you store: a preference, a token, the feed cache, a user's photo?",
      back: "Preference → `UserDefaults`/`@AppStorage`. Token → Keychain. Feed cache → a file in `Caches` (or SwiftData). User-created photo → `Documents`.",
    },
    {
      id: "fc-offline-first",
      front: "Offline-first in one sentence (and the role of `NWPathMonitor`)",
      back: "The UI always reads local data; the repository emits the cache, hits the network, saves and emits fresh data. `NWPathMonitor` drives the banner and resyncs when the network returns; it doesn't block requests.",
    },
  ],
  exam: [
    {
      id: "ex-post-retry",
      question: "A POST `/orders` times out and the client retries it automatically. Support reports duplicate orders. What's the right fix?",
      options: [
        "Raise `timeoutInterval` to 5 minutes so it never times out",
        "Stop using POST and create the order with GET",
        "Send a unique `Idempotency-Key` per logical attempt so the server discards the duplicate",
        "Retry only if the user taps the button twice",
      ],
      answer: 2,
      explanation: "A timeout doesn't tell you whether the server processed the request. POST isn't idempotent, so a retry can duplicate. With a stable `Idempotency-Key` the server recognizes the retry. Raising the timeout just hides the problem.",
    },
    {
      id: "ex-500-no-throw",
      question: "A junior dev says: \"if the server returns 500, `try await session.data(for:)` will throw and we land in the `catch`\". What do you say in code review?",
      code: swift`do {
    let (data, _) = try await session.data(for: request)
    return try JSONDecoder().decode(User.self, from: data)
} catch {
    throw APIError.server(500)
}`,
      options: [
        "No: a 500 comes back without a `throw`; cast to `HTTPURLResponse` and validate the status before decoding",
        "They're right, URLSession throws for any status outside 2xx",
        "URLSession throws only for 5xx, not for 4xx",
        "The `decode` will work because a 500 body is always the `User`",
      ],
      answer: 0,
      explanation: "`data(for:)` only throws transport errors. On a 500, this code tries to decode the error body as `User`, fails with `DecodingError`, and the user gets the wrong message. Validating the status is on you.",
    },
    {
      id: "ex-refresh-token-storage",
      question: "Where do you store the session's refresh token?",
      options: [
        "`UserDefaults`, it's the simplest to read at launch",
        "A JSON file in `Documents`",
        "In memory only, and ask for login on every launch",
        "Keychain",
      ],
      answer: 3,
      explanation: "It's a long-lived secret: it belongs in the Keychain, encrypted and outside the file sandbox. `UserDefaults` and `Documents` are plain text (and `Documents` is even backed up). Memory only forces a login every time.",
    },
    {
      id: "ex-stale-search",
      question: "In search, the results for \"sw\" sometimes stay on screen even though the user typed \"swift\". What's missing?",
      options: [
        "A `DispatchQueue.main.async` when assigning the results",
        "Cancelling the previous search on every change and not assigning if the `Task` was cancelled",
        "Lowering the debounce to 0 ms",
        "Using `URLCache` so \"swift\" answers faster",
      ],
      answer: 1,
      explanation: "Responses can arrive out of order: the \"sw\" one came later and overwrote \"swift\". Cancelling the previous one and checking `Task.isCancelled` before assigning guarantees only the latest query is rendered.",
    },
    {
      id: "ex-feed-duplicates",
      question: "In a very active feed using `?page=N`, users see repeated posts while scrolling. What do you propose?",
      options: [
        "Reload the whole feed every time the end is reached",
        "Cursor pagination, plus filtering by id with a `Set` on the client",
        "Request bigger pages, 200 items each",
        "Sort the list by title on the client",
      ],
      answer: 1,
      explanation: "With offsets, new items shift everything and the next page repeats. A cursor is stable under inserts, and the `Set` of seen ids protects you if the server repeats something anyway.",
    },
    {
      id: "ex-image-memory",
      question: "A gallery of camera photos crashes on memory while scrolling, even though each image is only 2–3 MB. What's the most likely cause and fix?",
      options: [
        "The photos are JPEGs; convert them to PNG",
        "`NSCache` has no limit; use a `Dictionary` instead",
        "`URLCache` is missing; with a disk cache no memory is used",
        "They're decoded at full resolution (~48 MB each); downsample to the displayed size",
      ],
      answer: 3,
      explanation: "Memory depends on decoded pixels, not on file size: 4000 × 3000 × 4 ≈ 48 MB. With ImageIO you produce a thumbnail at the pixel size you display. A `Dictionary` makes it worse because it never frees anything.",
    },
    {
      id: "ex-nscache",
      question: "Why `NSCache` rather than a `[URL: UIImage]` for the in-memory image cache?",
      options: [
        "`NSCache` evicts entries on its own under memory pressure, supports count and cost limits, and is thread-safe",
        "`NSCache` stores on disk and survives restarts",
        "`NSCache` honors the server's `Cache-Control` headers",
        "A `Dictionary` can't hold `UIImage`",
      ],
      answer: 0,
      explanation: "The dictionary grows until the system kills the app. `NSCache` reacts to memory pressure and has `countLimit`/`totalCostLimit`. Disk and `Cache-Control` are `URLCache` territory.",
    },
    {
      id: "ex-concurrent-401",
      question: "The access token expires and 5 parallel requests get a 401. What's the correct behavior?",
      options: [
        "Each request does its own refresh",
        "Show the login screen as soon as the first 401 arrives",
        "One shared refresh (an `actor` stores the in-flight `Task`); each request retries once and, if the refresh fails, sign out",
        "Retry all 5 requests with the same expired token until it works",
      ],
      answer: 2,
      explanation: "Five parallel refreshes tend to invalidate each other (many backends rotate the refresh token). Sharing a single refresh `Task` avoids that, and retrying only once avoids infinite loops.",
    },
    {
      id: "ex-nwpathmonitor",
      question: "A PR adds `guard monitor.currentPath.status == .satisfied else { throw APIError.offline }` before every request. What's your comment?",
      options: [
        "Great: it saves requests",
        "Do it, but with `Reachability` instead of `NWPathMonitor`",
        "It should check `.requiresConnection` instead of `.satisfied`",
        "Don't block requests on the monitor: try anyway (or use `waitsForConnectivity`) and use the monitor for the banner and to resync",
      ],
      answer: 3,
      explanation: "The path status can be stale or wrong (VPNs, captive portals). The real request is the source of truth. The monitor is for UX and for triggering a sync when the network returns.",
    },
    {
      id: "ex-cancel-error",
      question: "Which of these errors should **never** be shown to the user as an alert?",
      options: [
        "`APIError.unauthorized` after a failed refresh",
        "`URLError(.cancelled)` because the view requesting the data went away",
        "`URLError(.notConnectedToInternet)` on first launch with no cache",
        "`APIError.server(503)` after the retries ran out",
      ],
      answer: 1,
      explanation: "Your own code caused the cancellation (the view left or another search started). There is nothing the user can do. The other three need a message: sign in, you're offline, the service is having trouble.",
    },
    {
      id: "ex-core-data-legacy",
      question: "You join an app with 5 years of Core Data that works fine. A teammate proposes moving everything to SwiftData this sprint. What do you recommend?",
      options: [
        "Keep Core Data isolated behind a repository and consider migrating piece by piece when it pays off",
        "Migrate everything at once: SwiftData replaces Core Data, which will stop working",
        "Move everything to `UserDefaults`, it's simpler",
        "Delete the local database and rely on the network only",
      ],
      answer: 0,
      explanation: "A full persistence rewrite is risky (migrating real users' data) and Core Data is still supported. Isolating it behind a repository lets you swap the implementation piece by piece without touching the UI.",
    },
    {
      id: "ex-what-to-retry",
      question: "Your `withRetry` retries with backoff. Which of these responses is worth retrying automatically?",
      options: [
        "400 Bad Request",
        "422 with form validation errors",
        "503 Service Unavailable on a GET",
        "401 Unauthorized with the same token",
      ],
      answer: 2,
      explanation: "503 is transient and a GET is idempotent: retrying with backoff (and honoring `Retry-After` if present) makes sense. 400 and 422 will fail the same way; 401 needs a refresh, not a repeat with the same token.",
    },
  ],
};

export default content;
