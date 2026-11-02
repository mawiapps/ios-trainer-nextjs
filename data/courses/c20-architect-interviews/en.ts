import type { CourseContent } from "../types";

// Literal code: String.raw keeps `\(...)` and `\n` as written.
const swift = String.raw;
const md = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "mobile-system-design",
      title: "Mobile system design: a repeatable framework",
      goal: "Answer any mobile design question with the same path: requirements, contract, data, layers, caching, sync, errors and trade-offs.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "The same path for any app",
          body: [
            "In a mobile system design interview you're not graded on reaching the 'right' diagram: you're graded on **how you structure the problem**. Have a fixed path and use it every time, out loud. That way you don't skip anything even when you're nervous.",
            "The first 5 minutes are requirements: what the feature does (functional), how many people use it, whether it must work offline, what latency is expected (non-functional). Then API contract, data model, app layers, caching and offline, sync, pagination, errors, security and observability.",
            "Always close with **trade-offs**: what you picked, what you ruled out and why. A senior says 'I'm going with cursors over offsets because the feed changes while you scroll; the cost is I can't jump to page 7'.",
          ],
          code: md`Mobile system design: checklist (45 min)
 1. Requirements     functional, non-functional, scale, offline   ~5 min
 2. API contract     endpoints, pagination, error format
 3. Data model       entities, ids, what is persisted on disk
 4. Layers           View → ViewModel → Repository → API / DB
 5. Cache & offline  source of truth, invalidation, TTL
 6. Sync             outbox, retries, conflicts, ordering
 7. Errors           network, 401, 5xx, timeouts, screen states
 8. Security         tokens in Keychain, TLS, sensitive data
 9. Observability    logs, metrics, crash-free, network traces
10. Trade-offs       what you picked, what you ruled out, why`,
        },
        {
          kind: "predict",
          prompt: "The interviewer says: 'Design an Instagram-like feed'. What's your first move?",
          code: md`Interviewer: "Design an Instagram-like feed for iOS."
You: ...`,
          options: [
            "Draw the class diagram of `FeedViewController` with all its dependencies",
            "Pick the architecture (MVVM, TCA or VIPER) and justify it",
            "Ask about requirements: read-only or posting too?, offline?, video?, how many users and posts per page?",
            "Write the `Codable` for `Post` to show you know Swift",
          ],
          answer: 2,
          explanation: "Without requirements any design is a guess. Whether there's offline, video or posting changes caching, pagination and sync. Picking an architecture or writing code before knowing what you're building is the clearest sign of someone who doesn't design systems yet.",
        },
        {
          kind: "explain",
          title: "Feed: contract, data and layers",
          body: [
            "For a feed, **cursor** pagination is the default: the server returns an opaque token that points 'after this post'. With offsets (`page=2`), if new posts land on top while you scroll, page 2 shifts and you see duplicates.",
            "The app has clear layers: the view observes a view model, the view model talks to a **repository**, and the repository decides whether to answer from disk or network. For a fast launch use *stale-while-revalidate*: show the cached feed instantly and refresh in the background.",
            "Images are their own thing: in-memory cache (`NSCache`) plus disk cache, downloads prioritized for visible cells and cancelled when a cell scrolls off screen.",
          ],
          code: swift`// GET /v1/feed?cursor=abc123&limit=20
struct FeedPage: Decodable {
    let items: [Post]
    let nextCursor: String?   // nil = no more pages
}

struct Post: Decodable, Identifiable {
    let id: String
    let author: Author
    let imageURL: URL
    let likeCount: Int
    let createdAt: Date
}

protocol FeedRepository: Sendable {
    func cachedFeed() async -> [Post]                               // disk, instant
    func fetchPage(after cursor: String?) async throws -> FeedPage   // network
}`,
        },
        {
          kind: "predict",
          prompt: "The app requests pages of 10 posts by offset. The user has seen page 1 (posts 50 to 41). Before requesting page 2, 3 new posts are published. What do they see?",
          code: md`GET /feed?offset=0&limit=10   → posts 50..41
   (posts 51, 52 and 53 are published)
GET /feed?offset=10&limit=10  → ?`,
          options: [
            "Posts 40 to 31, no problem",
            "Posts 43 to 34: it repeats 43, 42 and 41, which they already saw",
            "Posts 53 to 44, because the offset recalculates itself",
            "A 409 error because the feed changed",
          ],
          answer: 1,
          explanation: "With the 3 new ones, the sorted feed is 53..1. Offset 10 starts at the 11th element: 53, 52, 51, 50, 49, 48, 47, 46, 45, 44 are the first 10, so page 2 starts at 43. 43, 42 and 41 are repeated. A cursor ('after post 41') doesn't have this problem.",
        },
        {
          kind: "fill",
          prompt: "Fill in the type of `nextCursor` so the last page can say 'there's nothing more'.",
          code: swift`struct FeedPage: Decodable {
    let items: [Post]
    let nextCursor: ____
}`,
          accept: ["^String\\?$", "^Optional<String>$"],
          explanation: "A `String?` models both cases: there's a cursor for the next page, or `nil` because you reached the end. With a non-optional `String` you end up inventing magic values like `\"\"`.",
          hint: "A string that might not be there.",
          placeholder: "String…",
        },
        {
          kind: "explain",
          title: "Chat with offline support: outbox and idempotency",
          body: [
            "In an offline chat the **local database is the source of truth**: the UI always reads from disk, and the network only updates disk. When the user sends a message, you store it in an *outbox* table with status `pending` and show it right away with a clock icon.",
            "A sync process drains the outbox when there's connectivity. Every message carries a **client-generated id** (`UUID`): if the server response is lost and you retry, the server recognizes the id and doesn't create a duplicate. That's an idempotency key.",
            "Ordering comes from the server (a sequence number per conversation), not the phone's clock, which can be wrong. For real-time delivery use a WebSocket while the app is open and push when it's closed; on reconnect you ask for 'everything after sequence N'.",
          ],
          code: swift`enum DeliveryStatus: String, Codable {
    case pending, sent, failed
}

struct OutgoingMessage: Codable, Identifiable {
    let id: UUID              // client-generated = idempotency key
    let conversationID: String
    let text: String
    var status: DeliveryStatus
    var attempts: Int
}

// POST /v1/conversations/{id}/messages
// { "clientMessageId": "6F1C…", "text": "Hi" }
// → 201 { "serverSeq": 1042 }  (or 200 with the same serverSeq if it already existed)`,
        },
        {
          kind: "predict",
          prompt: "The client sends a message, the server stores it, but the response is lost to a network drop. The outbox retries. What keeps the chat from showing the message twice?",
          code: swift`// Outbox retry
try await api.send(
    conversationID: message.conversationID,
    clientMessageID: message.id,   // same UUID as the first attempt
    text: message.text
)`,
          options: [
            "`URLSession` never retries `POST` requests",
            "The server sorts by date and drops messages with the same text",
            "The outbox waits 30 seconds before retrying",
            "The `clientMessageID` is the same: the server sees it already exists and returns the original record instead of creating another",
          ],
          answer: 3,
          explanation: "Idempotency comes from the client-generated id, which doesn't change across retries. Dropping by text breaks the legit case of sending 'ok' twice, and waiting longer doesn't prevent the duplicate: it just delays it.",
        },
        {
          kind: "write",
          prompt: "Model the outgoing outbox message: an `enum DeliveryStatus` with `pending`, `sent` and `failed`, and a `struct OutgoingMessage` with `id: UUID`, `text`, `status` and `attempts`. Add a `mutating func markFailed()` that bumps the attempt count and moves to `failed`.",
          starter: swift`struct OutgoingMessage {
    let text: String
}`,
          checks: [
            { pattern: "enum\\s+DeliveryStatus", label: "Declares `enum DeliveryStatus`" },
            { pattern: "case\\s+[^\\n]*pending", label: "Has the `pending` case" },
            { pattern: "case\\s+[^\\n]*failed", label: "Has the `failed` case" },
            { pattern: "let\\s+id\\s*:\\s*UUID", label: "The id is an immutable client-generated `UUID`" },
            { pattern: "mutating\\s+func\\s+markFailed\\(\\)", label: "Declares `mutating func markFailed()`" },
            { pattern: "attempts\\s*\\+=\\s*1", label: "Bumps the attempt count" },
          ],
          warnings: [
            { pattern: "var\\s+id\\s*:", label: "The id must not change across retries: use `let`" },
            { pattern: "class\\s+OutgoingMessage", label: "It's a value: prefer `struct`" },
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
          hint: "`status` and `attempts` are `var` because they change; `id` and `text` don't.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "decisions-in-writing",
      title: "Decisions in writing: ADRs, RFCs and tech debt",
      goal: "Record a decision in an ADR, propose a big change with rollout and rollback, and prioritize tech debt with data.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "ADR: the decision and its why",
          body: [
            "An **ADR** (Architecture Decision Record) is a short, numbered file in the repo that records a decision: **context** (what problem and which constraints), **decision** (what we picked) and **consequences** (what we gain and what we pay). It lives in `docs/adr/` and gets reviewed in a PR like any code.",
            "Consequences must include the costs. 'Tests are easier' alone is marketing; 'every new screen needs a coordinator, more boilerplate' is honest and useful to whoever reads it two years from now.",
            "You don't edit an ADR to change your mind: you write a new one that **supersedes** it (`Superseded by ADR-019`). That keeps the history of why the code is the way it is.",
          ],
          code: md`# ADR-007: Navigation with Coordinators in the UIKit app

## Status
Accepted (2026-03-14)

## Context
View controllers push other VCs directly. The checkout flow is reused
from the cart and from the promotions deep link, and today it's
duplicated. We can't test navigation.

## Decision
Each flow has a Coordinator that owns the UINavigationController.
VCs emit events through closures; the coordinator decides where to go.

## Consequences
+ Checkout is built once and launched from any entry point.
+ Navigation is tested without UIKit using a fake router.
- More types per flow (coordinator + factory).
- 14 screens to migrate; we do it flow by flow.`,
        },
        {
          kind: "predict",
          prompt: "Two years ago ADR-007 picked Coordinators. Today the app is 90% SwiftUI and the team wants `NavigationStack` with a router. What do you do with ADR-007?",
          code: md`docs/adr/
  ADR-007-coordinators.md     Status: Accepted
  ...
  ADR-018-swift-data.md       Status: Accepted`,
          options: [
            "Edit ADR-007 to say `NavigationStack`, so it's up to date",
            "Delete it from the repo: it no longer applies",
            "Nothing: ADRs are historical and never touched",
            "Write ADR-019 with the new context and decision, and mark ADR-007 as `Superseded by ADR-019`",
          ],
          answer: 3,
          explanation: "A new ADR explains what changed (SwiftUI, `NavigationStack`) and why. The old one keeps its updated status pointing to the new one. Editing or deleting destroys the history; doing nothing leaves people reading a decision as current when it isn't.",
        },
        {
          kind: "explain",
          title: "RFC / tech spec: options, rollout and rollback",
          body: [
            "For a big change (rewriting the networking layer, moving to SwiftData) you write an **RFC** or tech spec before the code. Structure: the problem and why now, goals and non-goals, **options** with their trade-offs, the proposal, a **rollout** plan and a **rollback** plan.",
            "On mobile, rollback is special: you can't 'undo' a binary that's already on people's phones. So the change ships behind a remote **feature flag** and is ramped by percentage while watching metrics. Rollback means turning the flag off, not shipping a new version.",
            "Define up front which metric triggers a rollback (crash-free, error rate, conversion). If it isn't written down beforehand, people argue during the incident instead of acting.",
          ],
          code: md`# RFC: New networking layer with async/await

## Problem
3 different HTTP clients, inconsistent retries, 0 tests.

## Options
A. Keep Alamofire + wrappers        (cheap, doesn't unify)
B. Own client on top of URLSession  (chosen: full control, testable)
C. OpenAPI-generated client         (good, but backend has no spec)

## Rollout
Remote flag new_networking: 1% → 10% → 50% → 100%, one week per step.
Advance if crash-free >= 99.8% and network errors <= baseline + 0.5%.

## Rollback
Turn off new_networking from the console. The old client stays in the
binary until 2 releases after reaching 100%.`,
        },
        {
          kind: "fill",
          prompt: "Fill in the title of the section that explains how to go back if the change goes wrong.",
          code: md`## Rollout
Remote flag: 1% → 10% → 50% → 100%

## ____
Turn off the flag from the console.`,
          accept: ["^rollback$", "^plan de rollback$", "^rollback plan$"],
          explanation: "The **rollback** section says how you go back and who decides. On mobile it's almost always turning off a remote flag, because you can't pull back an installed binary.",
          hint: "The opposite of rollout.",
        },
        {
          kind: "explain",
          title: "Choosing an architecture, tracking debt and measuring with DORA",
          body: [
            "There's no winning architecture: there's context. A team of 3 with a small app does fine with MVVM and good protocols; 40 devs across 6 teams need modules with clear boundaries; a domain with lots of state and effects can justify TCA. Say which **problem** each piece you add solves.",
            "Tech debt is managed like a backlog: every item with its **impact** (crashes, lost hours, bugs) and its **cost**. Go after high impact, low cost first. Large migrations happen in stages (the *strangler* pattern): the new lives next to the old and you move one screen or module at a time.",
            "**DORA** metrics measure delivery health: deployment frequency, lead time for changes (commit → production), change failure rate and time to restore. They let you show with numbers that paying down debt makes the team faster.",
          ],
          code: md`| Debt                               | Impact                      | Cost   | Priority |
|------------------------------------|-----------------------------|--------|----------|
| Networking singleton, no protocol  | 0 tests across 12 screens   | 3 days | High     |
| Core Data on the main thread       | 0.4% hangs in the feed      | 1 week | High     |
| Giant settings storyboard          | merge conflicts             | 2 days | Medium   |
| Old unmaintained pods              | blocks new Xcode            | 1 day  | High     |

DORA (quarter)
  Deploy frequency       1 release every 2 weeks
  Lead time for changes  6 days (commit → App Store)
  Change failure rate    18% of releases need a hotfix
  Time to restore        2 days (flag) / 5 days (binary)`,
        },
        {
          kind: "predict",
          prompt: "Startup with 3 iOS devs, a 15-screen booking app, they want to ship in 3 months and test the business logic. Which architecture do you argue for?",
          code: md`Team: 3 iOS (1 senior, 2 mid-level)
App: 15 screens, SwiftUI, iOS 17+
Timeline: 3 months
Ask: testable logic, little boilerplate`,
          options: [
            "MVVM with `@Observable`, services behind injected protocols and a simple router for navigation",
            "Full VIPER on every screen so it scales to 50 devs",
            "TCA across the whole app because it's the most testable",
            "Everything in SwiftUI views; architecture gets added later",
          ],
          answer: 0,
          explanation: "MVVM with injected dependencies gives you logic tests with very little boilerplate, which is what 3 devs on a short timeline need. VIPER multiplies files with no problem to justify it; TCA can work but adds a learning curve for 2 mid-levels in 3 months; 'later' never comes.",
        },
        {
          kind: "predict",
          prompt: "Your manager asks: 'how long does a change take to reach users after it's merged?'. Which DORA metric is that?",
          code: md`PR merged: Monday 10:00
Release on the App Store: Thursday of the following week`,
          options: [
            "Deployment frequency",
            "Change failure rate",
            "Lead time for changes",
            "Time to restore service",
          ],
          answer: 2,
          explanation: "Lead time for changes measures the time from commit to running in production. On iOS it includes App Store review and the phased rollout, which is why it's usually longer than on backend. Frequency is how often you ship, failure rate is how many releases break something, and time to restore is how long recovery takes.",
        },
        {
          kind: "write",
          prompt: "Write an ADR in Markdown for 'Move persistence from Core Data to SwiftData in new modules'. It must have the sections `## Status`, `## Context`, `## Decision` and `## Consequences`, with at least one negative consequence.",
          starter: md`# ADR-021: SwiftData in new modules

## Status
Proposed
`,
          checks: [
            { pattern: "^#+\\s*(Estado|Status)", label: "Status section" },
            { pattern: "^#+\\s*(Contexto|Context)", label: "Context section" },
            { pattern: "^#+\\s*(Decisi[oó]n|Decision)", label: "Decision section" },
            { pattern: "^#+\\s*(Consecuencias|Consequences)", label: "Consequences section" },
            { pattern: "^\\s*-\\s+\\S", label: "At least one negative consequence (a line starting with `-`)" },
          ],
          warnings: [
            { pattern: "TODO|TBD", label: "A proposed ADR shouldn't have gaps" },
          ],
          solution: md`# ADR-021: SwiftData in new modules

## Status
Proposed

## Context
The app has used Core Data since 2019. New modules (favorites, history)
are iOS 17+ and the team loses time on NSManagedObject and contexts.

## Decision
New modules persist with SwiftData behind a repository protocol.
Existing modules stay on Core Data.

## Consequences
+ Simpler models with @Model and less context code.
+ The repository protocol lets us swap the implementation.
- Two persistence stacks coexist until everything is migrated.
- SwiftData requires iOS 17: the deployment target can't go lower.`,
          hint: "Negative consequences can be a list with `-` and positive ones with `+`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "code-review",
      title: "Code review that finds bugs and teaches",
      goal: "Review a Swift diff in the right order, separate blocking from optional, and write useful comments.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "What to look at first",
          body: [
            "Review in order of severity: **correctness** (does it do what it says?, edge cases?), **concurrency** (which thread touches the UI?, shared data?), **memory** (retain cycles), **errors** (swallowed?, crashes?), **tests**. Naming and formatting last; that's what SwiftLint is for.",
            "Read the PR description and the tests first: they tell you what the author tried to do. Then the diff. If the PR is 2,000 lines, the most useful comment is asking them to split it.",
            "This diff looks harmless. Before moving on, find at least three problems.",
          ],
          code: md`+final class ProfileViewModel: ObservableObject {
+    @Published var user: User?
+    let api: ProfileAPI
+
+    init(api: ProfileAPI) { self.api = api }
+
+    func load() {
+        api.fetchUser { result in              // callback on a URLSession thread
+            self.user = try! result.get()
+        }
+    }
+}`,
        },
        {
          kind: "predict",
          prompt: "Of the problems in the diff, which one do you mark as blocking without hesitation?",
          code: swift`api.fetchUser { result in
    self.user = try! result.get()
}`,
          options: [
            "`try!` crashes the app on any network or parsing error",
            "The name `load()` isn't descriptive; `loadUser()` is better",
            "The class is missing a doc comment",
            "It should use `@Observable` instead of `ObservableObject`",
          ],
          answer: 0,
          explanation: "A network error is normal (airplane mode, timeout) and `try!` turns it into a crash: blocking. Assigning `@Published` from a background thread is blocking too. Naming and docs are suggestions; moving to `@Observable` is a valid improvement but not this PR's goal.",
        },
        {
          kind: "explain",
          title: "Memory and concurrency in a diff",
          body: [
            "A retain cycle shows up when an object stores a closure that strongly captures that same object. Patterns to look for: `onX = { self... }` stored in a property, timers, closure-based `NotificationCenter` observers, a Combine `sink` stored in the same object's `cancellables`.",
            "For concurrency, look for mutable state shared between tasks (a `var` in a class used from `Task.detached`), UI updates outside `@MainActor`, and continuations that can resume twice or never. With Swift 6 strict checking many of these don't even compile, but legacy code still has them.",
          ],
          code: swift`final class SessionManager {
    var onExpire: (() -> Void)?

    func start() {
        onExpire = {
            self.logout()      // self holds the closure, the closure holds self
        }
    }

    func logout() { print("logout") }

    deinit { print("deinit SessionManager") }
}

var manager: SessionManager? = SessionManager()
manager?.start()
manager = nil
print("done")`,
          output: "done",
        },
        {
          kind: "predict",
          prompt: "Which change makes the previous example print `deinit SessionManager` before `done`?",
          code: swift`func start() {
    onExpire = {
        self.logout()
    }
}`,
          options: [
            "Make `onExpire` `private`",
            "Capture `[weak self]` and call `self?.logout()`",
            "Move `start()` into `init`",
            "Make `SessionManager` a `struct`",
          ],
          answer: 1,
          explanation: "With `[weak self]` the closure no longer retains the manager. On `manager = nil` the count drops to zero, `deinit` runs and only then `done` is printed. Visibility or where you call it doesn't change the cycle; a `struct` has no `deinit`.",
        },
        {
          kind: "explain",
          title: "Blocking vs suggestion, and comments that teach",
          body: [
            "Label every comment so the author knows what's required. A common convention: `blocking:` (can't merge like this), `suggestion:` (better, but optional), `question:` (I want to understand), `nit:` (minor style detail).",
            "A comment that teaches says **what** happens, **why** it matters and **how** to fix it, with an example if needed. 'This is wrong' teaches nothing; 'this can crash in airplane mode because…, try `do/catch` and an error state' does.",
            "Talk about the code, not the person: 'this closure retains self' instead of 'you forgot weak self'. And approve once the blocking items are fixed: nits don't hold up a merge.",
          ],
          code: md`blocking: try! crashes on any network error (airplane mode, timeout).
  Proposal: do/catch and move to a .failed state the view can show.

blocking: @Published is assigned from the URLSession thread.
  Mark the view model @MainActor or use the async version of the API.

question: can fetchUser call the completion twice? If so,
  a test covering it would help.

nit: load() → loadUser(); the parent already has a load().`,
        },
        {
          kind: "fill",
          prompt: "Fill in the comment label: it's a style detail that shouldn't block the merge.",
          code: md`____: we prefer an early guard over nested ifs, for consistency
  with the rest of the module.`,
          accept: ["^nit$", "^nit:$"],
          explanation: "`nit` marks minor details. The author can take it or leave it, and the PR gets approved either way. If it were a bug it'd be `blocking`.",
          hint: "Three letters, 'tiny detail'.",
        },
        {
          kind: "write",
          prompt: "In the PR, `ThumbnailCache` is used from several tasks at once and has a data race. Propose the fix: make it an `actor` and update the call site to use `await cache.insert(...)`.",
          starter: swift`final class ThumbnailCache {
    private var storage: [URL: Data] = [:]

    func data(for url: URL) -> Data? {
        storage[url]
    }

    func insert(_ data: Data, for url: URL) {
        storage[url] = data
    }
}

// Call site, from several tasks at once:
Task.detached {
    cache.insert(data, for: url)
}`,
          checks: [
            { pattern: "actor\\s+ThumbnailCache", label: "`ThumbnailCache` is an `actor`" },
            { pattern: "storage\\[url\\]", label: "Still uses the `storage` dictionary" },
            { pattern: "await\\s+cache\\.insert\\(", label: "The call site uses `await cache.insert(...)`" },
          ],
          warnings: [
            { pattern: "class\\s+ThumbnailCache", label: "Still a class with no isolation" },
            { pattern: "nonisolated\\s*\\(unsafe\\)|@unchecked\\s+Sendable", label: "That silences the compiler, it doesn't fix the race" },
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

// Call site: entering the actor requires await
Task.detached {
    await cache.insert(data, for: url)
}`,
          hint: "An `actor` serializes access to its state; from outside every call needs `await`.",
        },
        {
          kind: "predict",
          prompt: "Which of these review comments is the most useful?",
          code: swift`// In the diff:
let items = try await api.fetch()
self.items = items.filter { $0.isVisible }.sorted { $0.date > $1.date }`,
          options: [
            "`I don't like this, redo it.`",
            "`Why didn't you use TCA?`",
            "`nit: missing a space.`",
            "`suggestion: filtering and sorting here runs on the main actor on every refresh; with 5,000 items it shows. If the endpoint accepts sort=date, let's move the sorting to the server.`",
          ],
          answer: 3,
          explanation: "The good comment says what happens (work on the main actor), when it hurts (5,000 items), proposes a concrete fix and makes clear it's a suggestion. The others carry no information, change the PR's scope, or focus on something a linter handles.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "live-coding-classics",
      title: "Live coding: the classics in Swift",
      goal: "Solve out loud an O(1) LRU cache, a debounce, an image loader with dedup and a paginated loader.",
      minutes: 28,
      steps: [
        {
          kind: "explain",
          title: "Thinking out loud + LRU cache",
          body: [
            "Path for any exercise: 1) restate the problem and ask about edge cases, 2) write the signature, 3) walk an example by hand, 4) simple solution and its complexity, 5) optimize, 6) test with the example. Talk the whole time: long silence is what costs you the most.",
            "LRU cache with `get` and `put` in **O(1)**: a `key → node` dictionary to find in O(1), and a **doubly linked list** to move and remove nodes in O(1). The head is the most recent, the tail the least used. With an array, removing from the middle is O(n).",
            "Swift detail: `prev` is `weak` so neighboring nodes don't form cycles; the dictionary keeps all of them alive.",
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
    private var head: Node?   // most recent
    private var tail: Node?   // least recent

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
          explanation: "After `put(\"b\")` the order is b, a. `put(\"a\", 10)` updates the value and moves `a` to the front: a, b. Inserting `c` with a full cache evicts the tail, `b`. `a` remains with 10 and `b` is gone: `10 -1`.",
        },
        {
          kind: "fill",
          prompt: "Fill in which node gets evicted when the cache is full.",
          code: swift`if nodes.count == capacity, let lru = ____ {
    remove(lru)
    nodes[lru.key] = nil
}`,
          accept: ["^tail$", "^self\\.tail$"],
          explanation: "The tail is the least recently used: every `get` or `put` moves its node to the head, so whatever sits at the end is what nobody has touched for the longest. You also have to remove it from the dictionary, or it stays alive.",
          hint: "The opposite of `head`.",
        },
        {
          kind: "explain",
          title: "Debounce with Task and cancellation",
          body: [
            "Search box: you don't want to hit the server on every keystroke. **Debounce** = wait until the user stops typing for N milliseconds and only then search. With structured concurrency you do it by cancelling the previous task on every change.",
            "`Task.sleep` throws `CancellationError` if the task is cancelled while waiting. With `try?` you ignore the error, so you still need to check `Task.isCancelled` before searching.",
            "SwiftUI has a shortcut: `.task(id: query)` cancels and restarts the task every time `query` changes; with a `sleep` inside it's a debounce.",
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
          prompt: "The user types `s`, `sw` and `swi` 100 ms apart and then stops. How many times is `service.search` called, and with what text?",
          code: swift`viewModel.queryChanged("s")     // t = 0 ms
viewModel.queryChanged("sw")    // t = 100 ms
viewModel.queryChanged("swi")   // t = 200 ms
// nothing else`,
          options: [
            "3 times: `s`, `sw` and `swi`",
            "Once with `s`, because it's the first",
            "Once with `swi`, around t = 500 ms",
            "Never: the last task gets cancelled too",
          ],
          answer: 2,
          explanation: "Each call cancels the previous task before its 300 ms are up. Only the `swi` task (created at 200 ms) wakes up uncancelled, at 500 ms, and runs a single search.",
        },
        {
          kind: "fill",
          prompt: "Fill in the check that skips the search if the task was cancelled during the wait.",
          code: swift`try? await Task.sleep(for: .milliseconds(300))
guard !Task.____ else { return }`,
          accept: ["^isCancelled$"],
          explanation: "`Task.isCancelled` is a static property that looks at the current task. Since `try?` swallowed the `CancellationError`, this guard is what stops the search.",
          placeholder: "isC…",
        },
        {
          kind: "explain",
          title: "Image loader with caching and in-flight dedup",
          body: [
            "Interview classic: several cells request the same URL at once. You want **a single download**. An `actor` keeps two dictionaries: finished images and in-flight tasks. If there's already a task for that URL, everyone awaits its `value`.",
            "Watch out for **reentrancy**: inside an actor, every `await` is a point where another call can get in. That's why you register the task in `inFlight` **before** the first `await`. If you do it after, two calls pass the check and download twice.",
            "In the cell, cancel the load in `prepareForReuse` and check the URL is still the same before assigning the image: otherwise you see another post's photo.",
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
        inFlight[url] = task          // before the first await
        defer { inFlight[url] = nil }

        let image = try await task.value
        cache[url] = image
        return image
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Three cells call `loader.image(for: url)` with the same URL at almost the same time, and it isn't cached. How many downloads does `URLSession` make?",
          code: swift`async let a = loader.image(for: url)
async let b = loader.image(for: url)
async let c = loader.image(for: url)
let images = try await [a, b, c]`,
          options: [
            "1: the first call registers the task in `inFlight` and the other two await its `value`",
            "3: the actor doesn't prevent concurrent calls",
            "0: `async let` doesn't run until the `await`",
            "2: the first and the last, because of reentrancy",
          ],
          answer: 0,
          explanation: "The actor runs the calls one at a time. The first finds nothing, creates the task and stores it in `inFlight` without having suspended yet. When the other two get in, they find the task and await its result. One download, three identical images.",
        },
        {
          kind: "explain",
          title: "Paginated loader",
          body: [
            "The last classic: an infinite list. The minimum state is the list, the next cursor, whether it's loading and whether you hit the end. The golden rule: **never two loads in parallel** and never request past the end.",
            "The view triggers the load when one of the last cells appears. In SwiftUI, `.task` or `.onAppear` on the row; in UIKit, `prefetchRows` or `willDisplay`.",
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

// View
List(viewModel.posts) { post in
    PostRow(post: post)
        .task { await viewModel.rowAppeared(post) }
}`,
        },
        {
          kind: "write",
          prompt: "Implement `loadNextPage()` in `FeedViewModel`: don't load if it's already loading or you hit the end, set `isLoading` and turn it off with `defer`, append the page to `posts` (don't replace it) and update `nextCursor` and `reachedEnd`. On failure, store an `errorMessage`.",
          starter: swift`func loadNextPage() async {
    // TODO
}`,
          checks: [
            { pattern: "guard\\s+!isLoading", label: "Bails out if already loading" },
            { pattern: "!reachedEnd|reachedEnd\\s*==\\s*false", label: "Bails out at the end" },
            { pattern: "isLoading\\s*=\\s*true", label: "Sets `isLoading = true`" },
            { pattern: "defer\\s*\\{\\s*isLoading\\s*=\\s*false", label: "Turns `isLoading` off with `defer`" },
            { pattern: "append\\(contentsOf:", label: "Appends the page with `append(contentsOf:)`" },
            { pattern: "nextCursor\\s*=\\s*page\\.nextCursor", label: "Updates the cursor" },
            { pattern: "catch", label: "Handles the error" },
          ],
          warnings: [
            { pattern: "posts\\s*=\\s*page\\.items", label: "Replaces the list instead of appending the page" },
            { pattern: "[\\w\\)\\]]!(?!=)", label: "Avoid force unwraps and `try!`" },
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
        errorMessage = "Couldn't load more posts"
    }
}`,
          hint: "A single `guard` with two conditions separated by a comma.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "algorithms-and-behavioral",
      title: "Algorithms that keep showing up and behavioral interviews",
      goal: "Solve the five classics in idiomatic Swift while stating complexity out loud, and tell STAR stories with numbers.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "Two sum and complexity out loud",
          body: [
            "The obvious two sum solution is two nested `for` loops: O(n²). The expected one is a **dictionary** of seen values: for each number you ask whether you've already seen its complement. One pass, O(n) time and O(n) memory.",
            "State the complexity before you're asked: 'this is O(n) time because I loop once and a dictionary lookup is O(1) on average; O(n) space for the dictionary'. It's one of the things that scores the most.",
          ],
          code: swift`func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
    var seen: [Int: Int] = [:]          // value → index
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
          explanation: "`([])`: `(` and `[` are pushed, `]` pops `[` and `)` pops `(`; the stack ends empty → `true`. `(]`: `]` pops `(`, which isn't `[` → `false`. `((`: never closed, the stack ends with two elements → `false`. O(n) time, O(n) space.",
        },
        {
          kind: "explain",
          title: "Sort first: merge intervals and top-k",
          body: [
            "When order matters, sorting first costs O(n log n) and then one pass is enough. **Merge intervals**: sort by start with `sorted(by:)` and keep extending the last interval in the result while they overlap.",
            "**Top-k frequent**: count with a dictionary using `default:` and sort by frequency. That's O(n log n); if asked for better, mention *bucket sort* by frequency (O(n)) or a size-k heap (O(n log k)). Naming it and explaining when it pays off is enough.",
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
          prompt: "With the `merge` function above, what does this print?",
          code: swift`print(merge([[5, 7], [1, 4], [4, 5]]))`,
          options: [
            "`[[1, 4], [4, 5], [5, 7]]`",
            "`[[1, 7]]`",
            "`[[1, 5], [5, 7]]`",
            "`[[5, 7], [1, 5]]`",
          ],
          answer: 1,
          explanation: "Sorted by start: [1,4], [4,5], [5,7]. [4,5] starts at 4 ≤ 4 → merges into [1,5]. [5,7] starts at 5 ≤ 5 → merges into [1,7]. Since the condition is `<=`, touching intervals get merged.",
        },
        {
          kind: "fill",
          prompt: "Fill in the subscript to count without checking whether the key exists.",
          code: swift`for n in nums { counts[n, ____] += 1 }`,
          accept: ["^default: 0$", "^default:0$"],
          explanation: "`counts[n, default: 0]` returns 0 when the key is missing and lets you mutate in place. It avoids the `if let` or `?? 0` and is the idiomatic way to count in Swift.",
          placeholder: "default: …",
        },
        {
          kind: "write",
          prompt: "Write `func groupAnagrams(_ words: [String]) -> [[String]]` in O(n · k log k): group by the word with its letters sorted as a dictionary key. No comparing every word against every other word.",
          starter: swift`func groupAnagrams(_ words: [String]) -> [[String]] {
    var result: [[String]] = []
    // TODO
    return result
}`,
          checks: [
            { pattern: "String\\(\\s*\\w+\\.sorted\\(\\)\\s*\\)", label: "The key is `String(word.sorted())`" },
            { pattern: "\\[String\\s*:\\s*\\[String\\]\\]|Dictionary\\(grouping:", label: "Groups with a `[String: [String]]` dictionary" },
            { pattern: "\\.values", label: "Returns the groups with `.values`" },
          ],
          warnings: [
            { pattern: "for\\s+\\w+\\s+in[^{]*\\{[^}]*for\\s+\\w+\\s+in", label: "Nested loops: O(n²) comparing words" },
            { pattern: "[\\w\\)\\]]!(?!=)", label: "Avoid force unwraps" },
          ],
          solution: swift`func groupAnagrams(_ words: [String]) -> [[String]] {
    var groups: [String: [String]] = [:]
    for word in words {
        let key = String(word.sorted())
        groups[key, default: []].append(word)
    }
    return Array(groups.values)
}`,
          hint: "`\"eat\".sorted()` returns `[\"a\", \"e\", \"t\"]`; wrapped in `String(...)` it's a key.",
        },
        {
          kind: "explain",
          title: "Behavioral interviews with STAR",
          body: [
            "Behavioral questions ('tell me about a conflict', 'an architecture decision', 'a production incident', 'a mistake you made') are answered with **STAR**: Situation (context in 1-2 sentences), Task (what was on you), Action (what you did, in first person), Result (with numbers) and what you learned.",
            "The A is the longest and most important part. 'We' hides your contribution: say 'I proposed', 'I wrote the RFC'. A result with numbers turns an anecdote into evidence: crash-free from 99.1% to 99.8%, build time from 14 to 6 minutes.",
            "Prepare 5 or 6 stories before the interview and adapt them: the same migration story works for 'architecture decision', 'technical conflict' and 'leading without authority'. In the mistake story, show what you changed afterwards so it doesn't happen again.",
          ],
          code: md`Question: "Tell me about a production incident."

S  Friday 6 pm, release 5.2 at 100%. Crash-free drops from 99.7% to 96%.
T  I was the iOS on-call: I had to stop the damage and find the cause.
A  I turned off the new checkout flag (suspect from the stack trace);
   crashes dropped within 20 minutes. I reproduced it with a user with no
   saved address: a force unwrap in the parser. I shipped the fix with a
   test and requested an expedited review.
R  5.2.1 approved in 9 h; crash-free back to 99.7%. In the postmortem I
   proposed a SwiftLint rule against force_unwrapping in Networking,
   and there have been 0 crashes of that kind since.`,
        },
        {
          kind: "predict",
          prompt: "You're asked: 'Tell me about an architecture decision you made'. Which answer is strongest?",
          code: md`A. "We used MVVM because it's the standard and everyone knows it."
B. "I always pick TCA, it's the best for testing."
C. "I proposed modularizing with SPM: builds took 14 min. I wrote an RFC
   with 3 options, we migrated 4 modules in 2 sprints and incremental
   builds dropped to 3 min. The cost was more CI configuration."
D. "The team decided to modularize and it went really well."`,
          options: [
            "A",
            "B",
            "C",
            "D",
          ],
          answer: 2,
          explanation: "C has full STAR: a situation with a number (14 min), your own action ('I proposed', 'I wrote an RFC'), options considered, a measured result (3 min) and an honest trade-off. A and B are opinions without context; D hides your role behind 'the team' and has no numbers.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: a full mock interview",
      goal: "Go through the four parts of a senior interview loop: system design, live coding, code review and behavioral.",
      minutes: 45,
      steps: [
        {
          kind: "explain",
          title: "The interview loop",
          body: [
            "Run this interview against a clock. Four blocks, as in a real Sr iOS Engineer loop: **system design** (10 min here), **live coding** an LRU cache (20 min), **code review** of a diff (5 min) and **behavioral** with STAR (10 min).",
            "Talk out loud even if you're alone: that's what you're training. If you get stuck on the LRU, state the simple version with its complexity and then optimize.",
          ],
          code: md`MOCK INTERVIEW: Sr iOS Engineer (45 min)

1. System design (10 min)
   "Design a delivery driver app: today's deliveries, mark one delivered
    with photo and signature. Many areas have no signal."

2. Live coding (20 min)
   "Implement a generic LRUCache with O(1) get and put."

3. Code review (5 min)
   A CheckoutViewModel diff. What do you block?

4. Behavioral (10 min)
   "Tell me about a time you made a mistake in production."`,
        },
        {
          kind: "predict",
          prompt: "System design: the driver marks deliveries in areas with no signal and the company can't lose a single one. What data flow do you propose?",
          code: md`Requirements:
- Mark delivered with photo and signature, with or without signal
- Never lose or duplicate a delivery
- Back office sees the status when the phone reconnects`,
          options: [
            "Local database as the source of truth + an outbox of operations with a client UUID as idempotency key; a sync with retries and backoff uploads photos and statuses on reconnect",
            "Disable the 'Delivered' button when there's no connection",
            "Keep pending deliveries in an in-memory array and retry every 5 seconds",
            "Send each delivery to the server via push notification",
          ],
          answer: 0,
          explanation: "Disk as the source of truth survives the system killing the app; the outbox queues what's pending; the client UUID prevents duplicates when retrying after the server already stored it. Disabling the button breaks the requirement, memory is lost when the app closes, and push goes from server to phone, not the other way around.",
        },
        {
          kind: "write",
          prompt: "Live coding: implement `LRUCache<Key: Hashable, Value>` with O(1) `get` and `put`. Use a `[Key: Node]` dictionary and a doubly linked list (`prev`/`next`) with `head` and `tail`; when over capacity, evict the tail.",
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
            { pattern: "class\\s+Node\\b", label: "Declares a `Node` class" },
            { pattern: "var\\s+prev\\b", label: "The node has `prev`" },
            { pattern: "var\\s+next\\b", label: "The node has `next`" },
            { pattern: "\\[Key\\s*:\\s*Node\\]", label: "`[Key: Node]` dictionary for O(1) lookup" },
            { pattern: "\\w+\\[key\\]", label: "Looks the node up by key in the dictionary" },
            { pattern: "\\btail\\b", label: "Keeps a `tail` for eviction" },
            { pattern: "capacity", label: "Compares against capacity" },
          ],
          warnings: [
            { pattern: "\\.(firstIndex|removeFirst|lastIndex)\\(|\\.remove\\(at:", label: "O(n) array operations: the LRU is no longer O(1)" },
            { pattern: "[\\w\\)\\]]!(?!=)", label: "Avoid force unwraps" },
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
          hint: "Three private helpers: `remove(_:)`, `insertAtFront(_:)` and `moveToFront(_:)`. `get` and `put` end up a few lines each.",
        },
        {
          kind: "predict",
          prompt: "Code review: which comment do you mark as `blocking`?",
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
            "`nit: applyCoupon → apply(coupon:)` to follow the API Design Guidelines",
            "`suggestion: total should be a Double to keep it simple`",
            "`question: should we add analytics when a coupon is applied?`",
            "`blocking: total is mutated from a Task.detached off the main actor (data race and @Published from another thread), and if validate fails the error is lost with no feedback`",
          ],
          answer: 3,
          explanation: "`Task.detached` runs off the main actor and mutates published state: a data race and the UI updated from another thread (under Swift 6 strict checking it doesn't even compile). Also, the `try` error stays inside the task and nobody sees it. The fix: a `@MainActor` view model, a regular `Task { }` and `do/catch` with an error state. Using `Double` for money would be a bug, not an improvement.",
        },
        {
          kind: "write",
          prompt: "Behavioral: write the STAR outline for 'Tell me about a time you made a mistake in production'. Use the sections Situation, Task, Action and Result, tell it in first person, and include at least one number with `%` in the result.",
          starter: md`Situation:
Task:
`,
          checks: [
            { pattern: "^\\s*(S\\b|Situaci[oó]n|Situation)", label: "Situation" },
            { pattern: "^\\s*(T\\b|Tarea|Task)", label: "Task" },
            { pattern: "^\\s*(A\\b|Acci[oó]n|Action)", label: "Action" },
            { pattern: "^\\s*(R\\b|Resultado|Result)", label: "Result" },
            { pattern: "\\d+(\\.\\d+)?\\s*%", label: "A measured result with `%`" },
            { pattern: "\\b(yo|Yo|I)\\b|\\b(propuse|escrib[ií]|hice|agregu[eé]|revert[ií])\\b|\\b(I'm|I've)\\b", label: "First person: your action, not the team's" },
          ],
          warnings: [
            { pattern: "\\b(nosotros|Nosotros|We|we)\\b", label: "Too much 'we' hides your contribution" },
          ],
          solution: md`Situation: I shipped an image cache change that didn't cap disk usage.
A week later, 3% of users with little free space reported the app
wouldn't open.
Task: It was my change and my job to fix it and keep it from happening again.
Action: I spotted it by cross-checking reviews with Crashlytics, rolled the
change back behind its flag within 1 hour, wrote a 200 MB cap with LRU
cleanup and added a test that fills the cache and checks the limit. I ran
a blameless postmortem and proposed a resource checklist for PRs.
Result: Reports dropped to 0 within 2 days, the app's disk usage fell by
60% and the checklist was adopted by the other 3 teams.`,
          hint: "The Action is the longest part. Close with what changed in the process, not just in the code.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-sd-framework",
      front: "Mobile system design path",
      back: "Requirements and scale → API contract → data model → layers → caching and offline → sync → pagination → errors → security → observability → trade-offs. Always out loud, starting with questions.",
    },
    {
      id: "fc-cursor-offset",
      front: "Why cursors and not offsets for a feed?",
      back: "With offsets, if new items land on top the next page shifts and repeats items. A cursor points 'after this item' and stays stable. Cost: you can't jump to an arbitrary page.",
    },
    {
      id: "fc-swr",
      front: "Stale-while-revalidate on mobile",
      back: "Show what's cached on disk instantly and fetch fresh data in parallel; when it arrives, update disk and the UI refreshes. Fast launch with no blank screens.",
    },
    {
      id: "fc-outbox",
      front: "Outbox pattern",
      back: "User operations are first stored in a local table (`pending`) and the UI shows them right away. A sync process sends them on reconnect, with retries and backoff, and marks them `sent` or `failed`.",
    },
    {
      id: "fc-idempotency",
      front: "What's a client-generated id for when sending?",
      back: "It's an idempotency key: if the response is lost and you retry, the server recognizes the id and returns the existing record instead of creating a duplicate.",
      code: "struct OutgoingMessage {\n    let id: UUID   // same on every retry\n    let text: String\n}",
    },
    {
      id: "fc-adr",
      front: "Parts of an ADR",
      back: "Status, context (problem and constraints), decision and consequences (positive and negative). If the decision changes, write a new ADR and mark the old one `Superseded`.",
    },
    {
      id: "fc-rfc",
      front: "Key sections of an RFC / tech spec",
      back: "Problem, goals and non-goals, options with trade-offs, proposal, rollout (flag ramped by percentage with metrics) and rollback (turn off the flag; the old code stays in the binary for a while).",
    },
    {
      id: "fc-dora",
      front: "The four DORA metrics",
      back: "Deployment frequency, lead time for changes (commit → production), change failure rate (% of releases that need a fix) and time to restore service (how long recovery takes).",
    },
    {
      id: "fc-review-order",
      front: "Order for reviewing a PR",
      back: "Description and tests → correctness and edge cases → concurrency → memory → error handling → missing tests → naming and style (whatever the linter doesn't catch).",
    },
    {
      id: "fc-review-labels",
      front: "`blocking`, `suggestion`, `question`, `nit`",
      back: "`blocking`: can't merge as is. `suggestion`: optional improvement. `question`: I want to understand. `nit`: minor style detail. A good comment says what happens, why it matters and how to fix it.",
    },
    {
      id: "fc-lru",
      front: "O(1) LRU cache: which structures?",
      back: "A `key → node` dictionary to find in O(1) and a doubly linked list to move and evict in O(1). Head = most recent, tail = gets evicted. In Swift, `prev` is `weak`.",
    },
    {
      id: "fc-debounce",
      front: "Debounce with structured concurrency",
      back: "On every change cancel the previous task and create a new one that sleeps N ms, checks `Task.isCancelled` and only then searches. In SwiftUI, `.task(id: query)` with a `sleep` inside.",
      code: "searchTask?.cancel()\nsearchTask = Task {\n    try? await Task.sleep(for: .milliseconds(300))\n    guard !Task.isCancelled else { return }\n    await search(text)\n}",
    },
    {
      id: "fc-inflight",
      front: "In-flight dedup in an image loader",
      back: "An actor keeps `[URL: Task<UIImage, Error>]`. If there's already a task for the URL, await its `value`. The task is registered before the first `await` because of actor reentrancy.",
    },
    {
      id: "fc-complexity",
      front: "Complexity of the classics",
      back: "Two sum with a dictionary: O(n). Parentheses with a stack: O(n). Merge intervals: O(n log n) for the sort. Group anagrams: O(n · k log k). Top-k by sorting: O(n log n); with a heap O(n log k).",
    },
    {
      id: "fc-star",
      front: "STAR",
      back: "Situation (brief), Task (your part), Action (first person, the longest part), Result (with numbers) and what you learned or changed in the process.",
    },
  ],

  exam: [
    {
      id: "ex-cold-start",
      question: "In the feed design, product wants content visible instantly on launch even on a slow network. What do you propose?",
      options: [
        "Show a spinner until the first network page arrives",
        "Stale-while-revalidate: show the feed cached on disk and refresh in the background",
        "Prefetch the user's whole feed the night before with background fetch and request nothing on launch",
        "Lower `timeoutInterval` to 2 seconds",
      ],
      answer: 1,
      explanation: "The disk cache gives immediate content and revalidation updates it. A spinner is exactly what you're trying to avoid; background fetch isn't guaranteed and leaves stale data; a lower timeout just fails faster.",
    },
    {
      id: "ex-chat-order",
      question: "In the chat, two messages from the same user show up in reverse order on another device. Ordering was computed from the sending phone's date. What do you change?",
      options: [
        "Sync the phone's clock with NTP before sending",
        "Sort by message text when dates match",
        "Sort by the client UUID",
        "Sort by a sequence number the server assigns per conversation",
      ],
      answer: 3,
      explanation: "The device clock isn't reliable (time zone, manual changes, drift). A server-assigned sequence gives a total order per conversation and also lets you ask for 'everything after N' on reconnect. A UUID has no order.",
    },
    {
      id: "ex-conflict",
      question: "Offline notes app: the user edits the same note on iPad and iPhone with no signal. Product requires never losing text. Which conflict strategy do you pick?",
      options: [
        "Detect the conflict with a per-note version and keep both versions (conflict copy or merge) so the user decides",
        "Last-write-wins using the server timestamp",
        "Lock editing on one device while the other has it open",
        "Always keep the longer version",
      ],
      answer: 0,
      explanation: "Last-write-wins is simple but overwrites one of the edits, and 'never lose text' rules it out. Locking doesn't work without signal. A per-note version lets you detect the conflict and keep both; it's the right trade-off for this requirement.",
    },
    {
      id: "ex-adr-consequences",
      question: "You're reviewing an ADR whose Consequences section only says 'cleaner, more testable code'. What do you ask for?",
      options: [
        "Nothing, the positive consequences are enough",
        "Adding the full class diagram",
        "Adding the costs: migration, learning curve, more types, what becomes harder",
        "Turning it into an RFC",
      ],
      answer: 2,
      explanation: "An ADR without costs is a sales pitch, not a record. Whoever reads it in two years needs to know what was accepted as a cost to judge whether the decision still holds.",
    },
    {
      id: "ex-rollout",
      question: "You're replacing the networking layer of an app with 2 million users. Which rollout plan is safest?",
      options: [
        "Merge to main and ship in the next release at 100%",
        "Ship on TestFlight for a month and then at 100%",
        "Remote feature flag: 1% → 10% → 50% → 100%, advancing only if crash-free and error rate stay within predefined thresholds, and rollback by turning the flag off",
        "Use App Store phased release and, if there are problems, remove the app from sale",
      ],
      answer: 2,
      explanation: "The flag lets you go back in minutes with no new binary, and thresholds written up front avoid arguing during the incident. TestFlight doesn't represent production variety; phased release helps but can't revert what's already installed.",
    },
    {
      id: "ex-dora",
      question: "The team ships every two weeks, but 1 in 3 releases needs a hotfix. Which DORA metric shows the problem, and what do you go after?",
      options: [
        "Change failure rate: more tests in the areas that fail, flags for risky changes, and acting on postmortems",
        "Deployment frequency: ship every day",
        "Lead time for changes: skip code review",
        "Time to restore: put more people on call",
      ],
      answer: 0,
      explanation: "33% of releases needing a hotfix is a high failure rate. Shipping more often or reviewing less with that rate makes things worse. You need to lower the failure rate by going after the causes.",
    },
    {
      id: "ex-big-pr",
      question: "You're assigned a 2,300-line PR that migrates networking, changes navigation and renames models. What do you do first?",
      options: [
        "Approve it if the tests pass",
        "Review only the files you know",
        "Leave 80 style comments",
        "Ask to split it into smaller PRs (renames, networking, navigation), ideally stacked, so each change gets a real review",
      ],
      answer: 3,
      explanation: "Nobody reviews 2,300 lines with three changes mixed together well: bugs hide in the rename noise. Splitting it is the most valuable comment. Approving or half-reviewing puts your name on something you didn't read.",
    },
    {
      id: "ex-teaching-comment",
      question: "You find `[unowned self]` in a network closure that can complete after the screen is closed. What's the best comment?",
      options: [
        "`Never use unowned.`",
        "`blocking: if the user closes the screen before the network responds, self no longer exists and unowned crashes. Use [weak self] with guard let self.`",
        "`nit: we prefer weak.`",
        "`Sure?`",
      ],
      answer: 1,
      explanation: "It's a possible crash, so it's blocking, and the comment explains when it happens and how to fix it. 'Never' doesn't teach the why; marking it `nit` underplays a crash; 'Sure?' makes the author guess.",
    },
    {
      id: "ex-lru-list",
      question: "In live coding you implement the LRU with an array of keys ordered by use. The interviewer asks for the complexity of `get`. What do you answer and propose?",
      options: [
        "O(n), because moving the key to the end means finding it and removing it from the middle; with a dictionary to nodes of a doubly linked list it becomes O(1)",
        "O(1), because Swift arrays have random access",
        "O(log n), because the array is sorted",
        "Amortized O(1), thanks to copy-on-write",
      ],
      answer: 0,
      explanation: "Index access is O(1), but finding the key (`firstIndex`) and removing it from the middle (`remove(at:)`) are O(n). A doubly linked list lets you unlink a known node in O(1), and the dictionary gives you that node.",
    },
    {
      id: "ex-cell-reuse",
      question: "In the feed, when scrolling fast some cells briefly show another post's photo. What's the cause and the fix?",
      options: [
        "`NSCache` returns the wrong images; use a dictionary instead",
        "The image loader is missing `@MainActor`",
        "The cell was reused and the image from the previous load arrived: cancel the task in `prepareForReuse` and check the URL still matches the cell before assigning",
        "Turn off cell reuse",
      ],
      answer: 2,
      explanation: "The old download finishes after the cell is already showing another post. Cancelling on reuse and comparing the URL avoids assigning an image that no longer belongs there. Turning off reuse destroys performance.",
    },
    {
      id: "ex-stuck",
      question: "Live coding group anagrams: you've spent 8 minutes without finding the optimal solution. What do you do?",
      options: [
        "Stay silent thinking until you have it",
        "Ask to move on to another exercise",
        "Write the optimal solution straight away even if you can't explain it",
        "Say the brute-force solution and its complexity out loud, write it if needed, and look for repeated work you can avoid (for example, a canonical key in a dictionary)",
      ],
      answer: 3,
      explanation: "A working solution with its complexity clearly stated is worth more than silence, and it shows how you reason. From the brute force, asking what you're comparing too much usually leads to the dictionary version.",
    },
    {
      id: "ex-behavioral-incident",
      question: "'Tell me about a production incident.' What structure gives the best answer?",
      options: [
        "Explain the app's architecture in detail before getting to the incident",
        "STAR: brief context, your role, what you did to mitigate and find the cause, the result with numbers, and what you changed in the process afterwards",
        "Tell the company's worst incident even if you weren't involved",
        "Explain whose fault it was",
      ],
      answer: 1,
      explanation: "The interviewer is assessing your behavior: how you mitigated, how you investigated and what you learned. Someone else's story says nothing about you, and looking for someone to blame is a red flag in a blameless postmortem culture.",
    },
  ],
};

export default content;
