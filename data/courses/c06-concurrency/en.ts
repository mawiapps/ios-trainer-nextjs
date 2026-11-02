import type { CourseContent } from "../types";

const content: CourseContent = {
  lessons: [
    {
      id: "main-thread-gcd",
      title: "Main thread and legacy GCD",
      goal: "Know what runs on main, how to hop to main from a callback, and read code with queues, `DispatchGroup` and `OperationQueue` without introducing deadlocks.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "The UI lives on the main thread",
          body: [
            "UIKit and SwiftUI may only be touched from the main thread. Updating a label, reloading a table or changing view state from another thread is undefined behavior: glitches, weird crashes, or nothing at all.",
            "In Debug, the **Main Thread Checker** (on by default in the scheme) logs `Main Thread Checker: UI API called on a background thread`. If you see it in a PR, it's a bug, not a cosmetic warning.",
            "`URLSession` completion handlers arrive on a background queue. In callback-based code the classic pattern is to do the work there and hop to main with `DispatchQueue.main.async` only to touch the UI.",
          ],
          code: `URLSession.shared.dataTask(with: url) { data, _, _ in
    // We're on a URLSession background queue here
    let name = parseName(data)            // heavy work: fine off main
    DispatchQueue.main.async {
        self.nameLabel.text = name        // UI, always on main
    }
}.resume()`,
        },
        {
          kind: "fill",
          prompt: "The callback arrives on a background queue. Fill in the call that reloads the table on the main thread without blocking anyone.",
          code: `api.fetchItems { items in
    self.items = items
    ____ {
        self.tableView.reloadData()
    }
}`,
          accept: ["^DispatchQueue\\.main\\.async$"],
          explanation: "`DispatchQueue.main.async` enqueues the block on the main thread and returns immediately. `sync` would block the current queue waiting for main.",
          placeholder: "DispatchQueue...",
        },
        {
          kind: "explain",
          title: "Serial vs concurrent queues, sync vs async",
          body: [
            "A **serial** queue runs one block at a time, in FIFO order. A **concurrent** queue (`attributes: .concurrent`, or the `DispatchQueue.global(qos:)` queues) can run several at once, so there's no guaranteed order between them.",
            "`async` enqueues and returns right away. `sync` enqueues and **blocks** the caller until the block finishes. On a serial queue, a `sync` waits for everything enqueued before it.",
            "That's why this example has a deterministic order: A and B are enqueued, `sync` enqueues C behind them and waits; only then does the D line run.",
          ],
          code: `let queue = DispatchQueue(label: "com.app.serial")
queue.async { print("A") }
queue.async { print("B") }
queue.sync { print("C") }
print("D")`,
          output: "A\nB\nC\nD",
        },
        {
          kind: "predict",
          prompt: "The app keeps running (the process doesn't exit). What can you say about the output?",
          code: `let queue = DispatchQueue(label: "com.app.work", attributes: .concurrent)
queue.async { print("1") }
queue.async { print("2") }
print("3")`,
          options: [
            "Always `1`, `2`, `3`",
            "Always `3`, `1`, `2`",
            "All three are printed, in any order: `async` doesn't wait and the concurrent queue may run 1 and 2 at the same time",
            "Nothing is printed: you need to call `resume()`",
          ],
          answer: 2,
          explanation: "`async` returns immediately, so `print(\"3\")` races with the blocks. And the queue is concurrent: 1 and 2 can run in parallel and finish in any order. All three show up; the order isn't guaranteed. `resume()` belongs to `URLSessionTask`, not to queues.",
        },
        {
          kind: "explain",
          title: "DispatchGroup: waiting for several tasks",
          body: [
            "When you fire several callback-based requests and need to know when all of them are done, use a `DispatchGroup`: `enter()` before each one, `leave()` when it finishes, and `notify(queue:)` runs once the counter is back to zero.",
            "Golden rule: every `enter()` has exactly one `leave()`, on **every** path (success and failure). An extra `leave()` crashes; a missing one leaves `notify` waiting forever.",
            "Avoid `group.wait()` on main: it blocks the thread and freezes the UI. `notify` blocks no one.",
          ],
          code: `let group = DispatchGroup()
var results: [String] = []   // only touched from main

for id in ["a", "b"] {
    group.enter()
    api.fetch(id) { value in
        DispatchQueue.main.async {
            results.append(value)
            group.leave()
        }
    }
}

group.notify(queue: .main) {
    print("done:", results.count)
}`,
          output: "done: 2",
        },
        {
          kind: "predict",
          prompt: "A teammate wrote this. What happens when one of the requests fails?",
          code: `group.enter()
api.fetch(id) { result in
    guard case .success(let value) = result else { return }
    values.append(value)
    group.leave()
}

group.notify(queue: .main) {
    self.hideSpinner()
}`,
          options: [
            "Immediate crash due to unbalanced `enter`/`leave`",
            "`notify` never runs: the spinner keeps spinning forever",
            "`notify` runs anyway when the request times out",
            "The compiler flags the `return` without `leave()` as an error",
          ],
          answer: 1,
          explanation: "The failure path returns without calling `leave()`. The group counter never reaches zero, so `notify` never runs. There's no crash (that's what an extra `leave()` does) and no compiler check. The usual fix is `defer { group.leave() }` at the top of the callback.",
        },
        {
          kind: "explain",
          title: "OperationQueue: dependencies, limits and cancellation",
          body: [
            "`OperationQueue` is the higher-level layer on top of GCD you'll still find in legacy code (image downloads, sync jobs). What it gives you: `addDependency` for chaining, `maxConcurrentOperationCount` to cap how many run at once, and cancellation.",
            "`cancel()` doesn't force-stop anything: it sets `isCancelled`. If the operation hasn't started, it won't run; if it's already running, it has to check `isCancelled` itself. `cancelAllOperations()` does that for the whole queue (typically in `deinit` or when leaving the screen).",
            "With the dependency chain in this example the order is deterministic even though the operations are added in reverse.",
          ],
          code: `let queue = OperationQueue()
queue.maxConcurrentOperationCount = 2

let download = BlockOperation { print("download") }
let resize = BlockOperation { print("resize") }
let save = BlockOperation { print("save") }

resize.addDependency(download)
save.addDependency(resize)

queue.addOperations([save, resize, download], waitUntilFinished: true)`,
          output: "download\nresize\nsave",
        },
        {
          kind: "predict",
          prompt: "This code runs in `viewDidLoad`, i.e. on the main thread. What happens?",
          code: `DispatchQueue.main.sync {
    print("A")
}
print("B")`,
          options: [
            "Prints `A`, then `B`",
            "Prints `B`, then `A`",
            "Prints only `B`",
            "Neither: it's a deadlock (in practice, libdispatch crashes)",
          ],
          answer: 3,
          explanation: "`sync` blocks the current thread (main) until the block finishes, but the block is enqueued on main, which is blocked waiting for it. Nothing moves. GCD detects `sync` onto the queue you're already on and usually crashes with `EXC_BREAKPOINT`. Same thing with `queue.sync` inside a block already running on that serial queue.",
        },
        {
          kind: "write",
          prompt: "Finish `loadDashboard`: run `api.fetchUser` and `api.fetchOrders` in parallel with a `DispatchGroup`, store the results and call `completion` on the main thread once both are done.",
          starter: `func loadDashboard(completion: @escaping (User?, [Order]) -> Void) {
    var user: User?
    var orders: [Order] = []
    // api.fetchUser { (User?) in ... }
    // api.fetchOrders { ([Order]) in ... }
}`,
          checks: [
            { pattern: "DispatchGroup\\(\\)", label: "Creates a `DispatchGroup`" },
            { pattern: "\\.enter\\(\\)", label: "Calls `enter()` before each request" },
            { pattern: "\\.leave\\(\\)", label: "Calls `leave()` when each one finishes" },
            { pattern: "notify\\(queue:\\s*\\.main", label: "Uses `notify(queue: .main)` for the completion" },
          ],
          warnings: [
            { pattern: "\\.wait\\(", label: "`group.wait()` blocks the thread (on main, it freezes the UI)" },
            { pattern: "DispatchQueue\\.main\\.sync", label: "`DispatchQueue.main.sync` can deadlock" },
          ],
          solution: `func loadDashboard(completion: @escaping (User?, [Order]) -> Void) {
    var user: User?
    var orders: [Order] = []
    let group = DispatchGroup()

    group.enter()
    api.fetchUser { result in
        DispatchQueue.main.async {
            user = result
            group.leave()
        }
    }

    group.enter()
    api.fetchOrders { result in
        DispatchQueue.main.async {
            orders = result
            group.leave()
        }
    }

    group.notify(queue: .main) {
        completion(user, orders)
    }
}`,
          hint: "Only write the variables from main (via `DispatchQueue.main.async`) so the two callbacks don't race each other.",
        },
      ],
    },
    {
      id: "async-await",
      title: "async/await and tasks",
      goal: "Write `async` functions, start work with `Task` and `.task`, parallelize with `async let` and `TaskGroup`, and cancel cooperatively.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "async functions and await",
          body: [
            "An `async` function can **suspend** without blocking the thread: while it waits on the network, the thread is free for other work. Every `await` marks a point where that may happen.",
            "Back-to-back `await`s run sequentially: the second starts when the first has finished. That makes the order of the `print`s deterministic.",
            "`async throws` combines both: you call it with `try await`. Almost every Apple API has an async version now (`URLSession.shared.data(from:)`).",
          ],
          code: `func fetchUser() async throws -> User {
    let (data, _) = try await URLSession.shared.data(from: userURL)
    return try JSONDecoder().decode(User.self, from: data)
}

func step(_ name: String) async {
    try? await Task.sleep(for: .milliseconds(100))
    print(name)
}

await step("one")
await step("two")
print("done")`,
          output: "one\ntwo\ndone",
        },
        {
          kind: "predict",
          code: `func work() async -> Int {
    try? await Task.sleep(for: .seconds(1))
    return 42
}

print("before")
let value = await work()
print("after", value)`,
          options: [
            "`before` and, one second later, `after 42`",
            "`after 42`, then `before`",
            "`before` and immediately `after 0`: it doesn't wait for the sleep",
            "Only `before`: the `await` never returns",
          ],
          answer: 0,
          explanation: "`before` is printed, `await work()` suspends the code during the sleep (without blocking the thread), and when `work` returns 42 execution continues on the next line. `try?` just discards a possible error from the sleep.",
        },
        {
          kind: "explain",
          title: "Task {} and .task {}",
          body: [
            "From synchronous code (a button action, a UIKit delegate) you can't `await` directly: you create a `Task { }`. That `Task` **inherits the actor** of its context: created from `@MainActor` code, its body runs on the main actor. `Task.detached` inherits nothing and you almost never need it.",
            "A standalone `Task` isn't cancelled when you drop the reference: if it matters, keep it and call `cancel()`.",
            "In SwiftUI prefer `.task { }`: it starts when the view appears and is **cancelled automatically** when it disappears. `.task(id: value)` also restarts it whenever `value` changes.",
          ],
          code: `struct ProfileView: View {
    @State private var model = ProfileModel()

    var body: some View {
        List(model.posts) { PostRow(post: $0) }
            .task { await model.load() }        // cancelled when the view goes away
            .refreshable { await model.load() }
            .toolbar {
                Button("Retry") {
                    Task { await model.load() }  // sync → async bridge
                }
            }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the modifier that loads data when the view appears and cancels the load if the user leaves.",
          code: `List(model.items) { ItemRow(item: $0) }
    .____ { await model.load() }`,
          accept: ["^task$"],
          explanation: "`.task { }` ties the task's lifetime to the view's: it's cancelled automatically when the view disappears. With `onAppear { Task { } }` you'd have to cancel by hand.",
          placeholder: "modifier",
        },
        {
          kind: "explain",
          title: "async let: parallel work",
          body: [
            "Two `await`s in a row take the **sum** of their durations. If the operations are independent, `async let` starts both right away and the later `await` collects the results: the total is roughly the **max**.",
            "Results are combined only when you `await`, so the array order is the one you wrote, not the order in which they finished.",
            "If one fails, the other is cancelled when the scope exits. An `async let` can't escape the function: this is **structured** concurrency.",
          ],
          code: `func slow(_ n: Int) async -> Int {
    try? await Task.sleep(for: .seconds(n))
    return n * 10
}

async let a = slow(2)
async let b = slow(1)
let result = await [a, b]   // ~2 s total, not 3
print(result)`,
          output: "[20, 10]",
        },
        {
          kind: "predict",
          prompt: "What does it print, and roughly how long does it take?",
          code: `func slow(_ n: Int) async -> Int {
    try? await Task.sleep(for: .seconds(n))
    return n
}

let x = await slow(2)
let y = await slow(3)
print(x + y)`,
          options: [
            "`5`, in ~3 seconds",
            "`5`, in ~5 seconds",
            "`23`, in ~5 seconds",
            "`5`, in ~2 seconds",
          ],
          answer: 1,
          explanation: "These are two sequential `await`s: `slow(3)` only starts once `slow(2)` is done, so it takes 2 + 3 = ~5 s. The sum is 5. With `async let x` and `async let y` it would take ~3 s.",
        },
        {
          kind: "explain",
          title: "TaskGroup: a dynamic number of tasks",
          body: [
            "`async let` works when you know how many tasks there are at write time. For N items (thumbnails in a list, pages) use `withTaskGroup` or `withThrowingTaskGroup`: `addTask` for each one, then iterate the group with `for await`.",
            "Results arrive in **completion order**. If you need the original order, return the index or key along with the value.",
            "In the throwing version, if a task throws and you propagate the error, the rest of the group is cancelled. Like `async let`, child tasks don't outlive the block.",
          ],
          code: `func thumbnails(for ids: [String]) async throws -> [String: UIImage] {
    try await withThrowingTaskGroup(of: (String, UIImage).self) { group in
        for id in ids {
            group.addTask { (id, try await api.thumbnail(id)) }
        }
        var result: [String: UIImage] = [:]
        for try await (id, image) in group {
            result[id] = image
        }
        return result
    }
}`,
        },
        {
          kind: "predict",
          prompt: "What can you say about what this prints?",
          code: `let order = await withTaskGroup(of: Int.self) { group in
    for n in [3, 1, 2] {
        group.addTask {
            try? await Task.sleep(for: .seconds(n))
            return n
        }
    }
    var collected: [Int] = []
    for await n in group { collected.append(n) }
    return collected
}
print(order)`,
          options: [
            "Always `[3, 1, 2]`: results follow the `addTask` order",
            "Always `[6]`: the group sums the values",
            "It doesn't compile: `withTaskGroup` requires `try`",
            "Values arrive in completion order: `[1, 2, 3]` is what you'd expect, but that order isn't part of the contract",
          ],
          answer: 3,
          explanation: "`for await` over the group yields each result as its task finishes. Given the sleeps, `[1, 2, 3]` is typical, but it depends on scheduling: if order matters, sort or carry the index. `withTaskGroup` (non-throwing) doesn't need `try`, and the inner `try?` swallows the sleep's error.",
        },
        {
          kind: "write",
          prompt: "This code runs two independent requests one after the other. Rewrite it so they run in parallel with `async let`.",
          starter: `func loadProfile() async throws -> Profile {
    let user = try await api.fetchUser()
    let posts = try await api.fetchPosts()
    return Profile(user: user, posts: posts)
}`,
          checks: [
            { pattern: "async\\s+let\\s+\\w+\\s*=\\s*(try\\s+)?api\\.fetchUser\\(\\)", label: "`async let` for `fetchUser()`" },
            { pattern: "async\\s+let\\s+\\w+\\s*=\\s*(try\\s+)?api\\.fetchPosts\\(\\)", label: "`async let` for `fetchPosts()`" },
            { pattern: "try\\s+await", label: "Awaits the results with `try await`" },
          ],
          warnings: [
            { pattern: "let\\s+\\w+\\s*=\\s*try\\s+await\\s+api\\.fetch", label: "A direct `try await` in the declaration makes it sequential again" },
            { pattern: "Task\\.detached", label: "No need for `Task.detached`: `async let` is already concurrent and structured" },
          ],
          solution: `func loadProfile() async throws -> Profile {
    async let user = api.fetchUser()
    async let posts = api.fetchPosts()
    return try await Profile(user: user, posts: posts)
}`,
          hint: "The `async let` declaration has no `await`; the `try await` goes where you use the values.",
        },
        {
          kind: "explain",
          title: "Cooperative cancellation",
          body: [
            "`task.cancel()` doesn't kill the task: it just sets a flag. The running code has to **cooperate**: `try Task.checkCancellation()` throws `CancellationError` if the task is cancelled, and `Task.isCancelled` lets you stop early and return a partial result.",
            "Apple's APIs already cooperate: `Task.sleep` and `URLSession.data(from:)` throw when cancelled. A pure CPU loop, on the other hand, runs to the end unless it checks.",
            "Cancellation propagates to child tasks (`async let`, `TaskGroup`), not to a standalone `Task { }` created inside.",
          ],
          code: `func processAll(_ photos: [Photo]) async throws {
    for photo in photos {
        try Task.checkCancellation()    // bails out with CancellationError
        await filter(photo)
    }
}

let task = Task { try await processAll(photos) }
// the user closes the screen:
task.cancel()`,
        },
        {
          kind: "fill",
          prompt: "Fill in the line that stops the loop with `CancellationError` if someone cancelled the task.",
          code: `for page in 1...totalPages {
    ____
    let items = await parse(page)
    all.append(contentsOf: items)
}`,
          accept: ["^try Task\\.checkCancellation\\(\\)$"],
          explanation: "`try Task.checkCancellation()` throws `CancellationError` when the current task is cancelled. Without it, the loop keeps working even though nobody is waiting for the result.",
          hint: "It's a static method on `Task` and it throws, so it needs `try`.",
        },
        {
          kind: "predict",
          code: `let task = Task {
    try await Task.sleep(for: .seconds(10))
    print("finished")
}
task.cancel()

do {
    try await task.value
} catch {
    print(error is CancellationError)
}`,
          options: [
            "`finished`",
            "`false`",
            "`true`",
            "Nothing: `cancel()` kills the task on the spot without throwing",
          ],
          answer: 2,
          explanation: "`Task.sleep` cooperates with cancellation: whether the task was already sleeping or hadn't started yet, it throws `CancellationError`. `print(\"finished\")` never runs, `task.value` rethrows the error and the `catch` prints `true`.",
        },
      ],
    },
    {
      id: "bridging",
      title: "Bridging: continuations and AsyncStream",
      goal: "Wrap completion handlers and delegates in `async` functions that resume exactly once, and expose event streams as `AsyncStream`.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "From completion handler to async",
          body: [
            "Real codebases mix callbacks (SDKs, old code) with async/await. So new code can call `try await` without rewriting the old code, wrap the callback with `withCheckedThrowingContinuation` (or `withCheckedContinuation` if it can't fail).",
            "The rule: the continuation is resumed **exactly once** on every path. Twice → the checked version crashes with `SWIFT TASK CONTINUATION MISUSE`. Never → the task stays suspended forever (and the console reports a leaked continuation).",
            "If the callback already hands you a `Result`, `resume(with:)` covers success and failure in one line. The `Unsafe` variant has the same rules without the checks.",
          ],
          code: `// Old API
func fetchUser(id: String, completion: @escaping (Result<User, Error>) -> Void)

// Async wrapper
func fetchUser(id: String) async throws -> User {
    try await withCheckedThrowingContinuation { continuation in
        fetchUser(id: id) { result in
            continuation.resume(with: result)
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the method that hands the value to whoever is waiting with `await`.",
          code: `func currentUser() async -> User {
    await withCheckedContinuation { continuation in
        session.loadUser { user in
            continuation.____(returning: user)
        }
    }
}`,
          accept: ["^resume$"],
          explanation: "`resume(returning:)` resumes the suspended task with the value. For errors it's `resume(throwing:)` (throwing variant only) and for a `Result`, `resume(with:)`.",
          placeholder: "method",
        },
        {
          kind: "predict",
          prompt: "What happens when `legacy.load` finishes with an error?",
          code: `func load() async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        legacy.load { data, error in
            if let error {
                continuation.resume(throwing: error)
            }
            continuation.resume(returning: data ?? Data())
        }
    }
}`,
          options: [
            "It throws the error and that's it: the second `resume` is ignored",
            "It returns an empty `Data()`",
            "Crash: the continuation is resumed twice and the checked version catches it",
            "Compile error: a `return` is missing",
          ],
          answer: 2,
          explanation: "There's no `return` (or `else`) after `resume(throwing:)`, so on the error path both `resume` calls run. Resuming twice is a programmer error: `CheckedContinuation` detects it and terminates the app. The compiler can't see it because the closure returns `Void`.",
        },
        {
          kind: "explain",
          title: "Wrapping a delegate",
          body: [
            "With delegates the continuation isn't resumed inside the closure but later, in another method. Store it in a property, resume it in the callback and set it to `nil` right away: that way a second callback (`didUpdateLocations` can fire several times) won't resume it again.",
            "This pattern is for **single-value** events (one location, a permission, a payment). For a series of values, the tool is `AsyncStream`.",
          ],
          code: `final class LocationProvider: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation, Error>?

    func currentLocation() async throws -> CLLocation {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.delegate = self
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        continuation?.resume(returning: location)
        continuation = nil                     // never twice
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}`,
        },
        {
          kind: "write",
          prompt: "Wrap `download(url:completion:)` (which calls `completion(data, error)`) in `func download(url: URL) async throws -> Data`. Resume exactly once on each path; if there's neither data nor an error, throw `DownloadError.empty`.",
          starter: `// Exists: func download(url: URL, completion: @escaping (Data?, Error?) -> Void)

func download(url: URL) async throws -> Data {

}`,
          checks: [
            { pattern: "withChecked(Throwing)?Continuation", label: "Uses `withCheckedThrowingContinuation`" },
            { pattern: "resume\\(throwing:", label: "Resumes with an error on the failure path" },
            { pattern: "resume\\(returning:", label: "Resumes with the data on the happy path" },
            { pattern: "\\belse\\b|\\breturn\\b", label: "Exclusive paths (`else` or `return`) so it never resumes twice" },
          ],
          warnings: [
            { pattern: "data!", label: "Force-unwrapping `data` crashes when it's `nil`" },
            { pattern: "withUnsafe", label: "Prefer the checked version: it catches resume mistakes" },
          ],
          solution: `func download(url: URL) async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        download(url: url) { data, error in
            if let error {
                continuation.resume(throwing: error)
            } else if let data {
                continuation.resume(returning: data)
            } else {
                continuation.resume(throwing: DownloadError.empty)
            }
        }
    }
}`,
          hint: "An `if let error` / `else if let data` / `else` chain guarantees a single `resume` per call.",
        },
        {
          kind: "explain",
          title: "AsyncStream: many values over time",
          body: [
            "For repeated events (websocket messages, download progress, notifications) create an `AsyncStream`: `yield` emits a value and `finish()` ends the sequence. On the other side you consume it with `for await`.",
            "Without `finish()`, the `for await` loop keeps waiting for more values. Use `continuation.onTermination` to clean up (disconnect, remove an observer) when the stream ends or the consumer's task is cancelled.",
            "`AsyncThrowingStream` adds `finish(throwing:)` and is consumed with `for try await`. `AsyncStream.makeStream(of:)` gives you the stream and the continuation separately, handy when the producer is a class.",
          ],
          code: `let stream = AsyncStream<Int> { continuation in
    for i in 1...3 {
        continuation.yield(i)
    }
    continuation.finish()
}

for await value in stream {
    print(value)
}
print("done")`,
          output: "1\n2\n3\ndone",
        },
        {
          kind: "predict",
          code: `let stream = AsyncThrowingStream<Int, Error> { continuation in
    continuation.yield(1)
    continuation.yield(2)
    continuation.finish(throwing: URLError(.timedOut))
}

do {
    for try await n in stream { print(n) }
    print("completed")
} catch {
    print("error")
}`,
          options: [
            "`error`, with no values",
            "`1`, `2`, `completed`",
            "`1`, `2`, `completed`, `error`",
            "`1`, `2`, `error`",
          ],
          answer: 3,
          explanation: "Values yielded before the stream ends are delivered in order: 1 and 2. Then `finish(throwing:)` makes the `for try await` throw, so `print(\"completed\")` is skipped and the `catch` runs.",
        },
        {
          kind: "write",
          prompt: "`client` is a callback-based websocket: `client.onMessage: ((String) -> Void)?`, `client.connect()` and `client.disconnect()`. Write `func messages() -> AsyncStream<String>` that emits every message and disconnects when the consumer stops listening.",
          starter: `func messages() -> AsyncStream<String> {

}`,
          checks: [
            { pattern: "AsyncStream\\s*(<\\s*String\\s*>)?\\s*\\{", label: "Builds an `AsyncStream`" },
            { pattern: "\\.yield\\(", label: "Emits each message with `yield`" },
            { pattern: "onTermination", label: "Disconnects in `onTermination`" },
            { pattern: "connect\\(\\)", label: "Connects the client" },
          ],
          warnings: [
            { pattern: "withChecked", label: "A single-use continuation can't deliver many values" },
          ],
          solution: `func messages() -> AsyncStream<String> {
    AsyncStream { continuation in
        client.onMessage = { message in
            continuation.yield(message)
        }
        continuation.onTermination = { _ in
            client.disconnect()
        }
        client.connect()
    }
}`,
          hint: "Set up `onMessage` and `onTermination` before `connect()` so you don't miss the first message.",
        },
      ],
    },
    {
      id: "actors",
      title: "Actors and @MainActor",
      goal: "Protect shared state with `actor`, isolate view models with `@MainActor`, reason about reentrancy and deduplicate concurrent work.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "actor: shared mutable state without data races",
          body: [
            "A **data race** is two threads accessing the same memory at the same time with at least one of them writing. The outcome is undefined: lost updates or `Dictionary` crashes you can't reproduce.",
            "An `actor` is a reference type that serializes access to its state: inside, you access it synchronously; from outside, with `await`. Think of a class with its own serial queue, except the compiler checks it.",
            "In the example, 1000 concurrent tasks increment and the result is always 1000.",
          ],
          code: `actor Counter {
    private(set) var value = 0
    func increment() { value += 1 }
}

let counter = Counter()
await withTaskGroup(of: Void.self) { group in
    for _ in 1...1000 {
        group.addTask { await counter.increment() }
    }
}
print(await counter.value)`,
          output: "1000",
        },
        {
          kind: "predict",
          prompt: "Swift 5 language mode, no strict concurrency checking. What does it print?",
          code: `final class UnsafeCounter { var value = 0 }

let c = UnsafeCounter()
DispatchQueue.concurrentPerform(iterations: 1000) { _ in
    c.value += 1
}
print(c.value)`,
          options: [
            "A number that may be below `1000` and vary between runs (or even a crash): it's a data race",
            "Always `1000`: `+= 1` is atomic",
            "Always `0`: the changes stay on other threads",
            "It doesn't compile",
          ],
          answer: 0,
          explanation: "`concurrentPerform` runs the iterations in parallel. `c.value += 1` is read, add, write: two threads can read the same value and one overwrites the other. It isn't atomic. In Swift 5 mode it compiles; Thread Sanitizer flags it. With an `actor` or a lock the result would always be 1000.",
        },
        {
          kind: "fill",
          prompt: "Several tasks read and write this cache at the same time. Fill in the keyword so the compiler guarantees serialized access.",
          code: `____ ImageCache {
    private var images: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? { images[url] }
    func store(_ image: UIImage, for url: URL) { images[url] = image }
}`,
          accept: ["^actor$"],
          explanation: "With `actor`, every call from outside (`await cache.image(for:)`) goes through the state one at a time. With `class` you'd have to protect the dictionary by hand with a queue or a lock.",
          placeholder: "keyword",
        },
        {
          kind: "explain",
          title: "@MainActor on the view model",
          body: [
            "The main actor is the global actor for the main thread. Marking the view model `@MainActor` guarantees all its state is read and written on main, so the view can observe it safely. Same for `@Observable` (iOS 17) and for `ObservableObject` with `@Published`.",
            "An `await` inside a `@MainActor` method doesn't block main: it suspends the method and frees the thread while the request runs. When it resumes, it's back on main and assigns the result.",
            "From another context you hop to main with `await MainActor.run { }` or a `Task { @MainActor in }`.",
          ],
          code: `@MainActor
@Observable
final class FeedViewModel {
    var posts: [Post] = []
    var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            posts = try await api.fetchPosts()  // main stays free while waiting
        } catch {
            posts = []
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Where does the assignment `title = newTitle` run?",
          code: `@MainActor
final class SettingsModel {
    var title = ""

    func refresh() {
        Task {
            let newTitle = try await api.fetchTitle()
            title = newTitle
        }
    }
}`,
          options: [
            "On some background thread: `Task { }` always runs on the global pool",
            "On the main actor: `Task { }` inherits the isolation of the context it's created in",
            "It doesn't compile: you need `Task.detached` here",
            "It depends on which thread `api` responds on",
          ],
          answer: 1,
          explanation: "`refresh()` is `@MainActor`, and a `Task { }` created there inherits that isolation. The request is awaited without blocking main, and when it comes back the assignment runs on the main actor. `Task.detached` would do the opposite: drop the isolation.",
        },
        {
          kind: "explain",
          title: "Reentrancy: state can change at every await",
          body: [
            "Actors are **reentrant**: while a method is suspended at an `await`, the actor serves other calls. Whatever you checked before the `await` may no longer hold after it.",
            "In the buggy version, two `withdraw(80)` calls pass the `guard` with a balance of 100, suspend in `audit`, and both deduct: the balance ends at -60. No data race (access is serialized), but a logic bug.",
            "Rule of thumb: do the mutations that depend on a check synchronously, before suspending, or re-check after the `await`.",
          ],
          code: `actor BankAccount {
    private var balance = 100

    // ❌ checks, suspends, then mutates
    func withdrawBuggy(_ amount: Int) async -> Bool {
        guard balance >= amount else { return false }
        await audit.record(amount)
        balance -= amount
        return true
    }

    // ✅ checks and mutates with no suspension in between
    func withdraw(_ amount: Int) async -> Bool {
        guard balance >= amount else { return false }
        balance -= amount
        await audit.record(amount)
        return true
    }
}`,
        },
        {
          kind: "predict",
          prompt: "With `withdrawBuggy` and a starting balance of 100, which statement is correct?",
          code: `let account = BankAccount()
async let a = account.withdrawBuggy(80)
async let b = account.withdrawBuggy(80)
print(await a, await b)`,
          options: [
            "Only `true false` or `false true` are possible: the actor never lets two `withdrawBuggy` calls in",
            "Always `false false`",
            "`true true` is possible, and the balance ends at `-60`",
            "Deadlock: the actor is blocked during the `await`",
          ],
          answer: 2,
          explanation: "The first call passes the `guard` and suspends in `audit.record`. The actor is free, the second call enters, also sees 100 and suspends. When they resume, both deduct. `true false` is also possible if the first finishes before the second enters, which is why the bug is intermittent. An actor is never blocked by an `await`.",
        },
        {
          kind: "explain",
          title: "Deduplicating concurrent work: one token refresh",
          body: [
            "Classic on-call incident: the token expires, five requests get a 401 at the same time and each fires its own refresh. The backend rotates the refresh token, four fail and the user gets logged out.",
            "The fix uses reentrancy to your advantage: the actor stores the in-flight refresh `Task`. The first call creates it and stores it **before** its first `await`; calls that come in meanwhile find the task and await its `value`.",
            "The `defer` clears the task when it finishes (success or failure), so a failure isn't cached forever.",
          ],
          code: `actor TokenProvider {
    private var token: Token?
    private var refreshTask: Task<Token, Error>?

    func validToken() async throws -> Token {
        if let token, !token.isExpired { return token }
        if let refreshTask { return try await refreshTask.value }  // one already in flight

        let task = Task { try await authAPI.refresh() }
        refreshTask = task
        defer { refreshTask = nil }

        let newToken = try await task.value
        token = newToken
        return newToken
    }
}`,
        },
        {
          kind: "write",
          prompt: "Turn `FavoritesStore` (protected by a serial queue) into an `actor`. Keep `toggle(_:)` and `contains(_:)` and remove the manual synchronization.",
          starter: `final class FavoritesStore {
    private var ids: Set<String> = []
    private let queue = DispatchQueue(label: "favorites")

    func toggle(_ id: String) {
        queue.sync {
            if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
        }
    }

    func contains(_ id: String) -> Bool {
        queue.sync { ids.contains(id) }
    }
}`,
          checks: [
            { pattern: "^\\s*actor\\s+FavoritesStore", label: "Declares `actor FavoritesStore`" },
            { pattern: "func\\s+toggle\\(", label: "Keeps `toggle(_:)`" },
            { pattern: "func\\s+contains\\(", label: "Keeps `contains(_:)`" },
          ],
          warnings: [
            { pattern: "DispatchQueue", label: "With an actor the queue is redundant: the actor already serializes access" },
            { pattern: "NSLock|\\.lock\\(\\)", label: "Don't mix locks with actor isolation" },
          ],
          solution: `actor FavoritesStore {
    private var ids: Set<String> = []

    func toggle(_ id: String) {
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
    }

    func contains(_ id: String) -> Bool {
        ids.contains(id)
    }
}`,
          hint: "Inside the actor access is synchronous; callers outside will use `await store.toggle(id)`.",
        },
      ],
    },
    {
      id: "strict-concurrency",
      title: "Swift 6: Sendable, isolation and Combine",
      goal: "Understand Swift 6 strict concurrency errors, the migration tools, what changes in Swift 6.2, and the Combine code you'll keep running into.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Sendable: what can cross isolation boundaries",
          body: [
            "In the Swift 6 language mode, potential data races are **compile errors**. In Swift 5 mode you can set `SWIFT_STRICT_CONCURRENCY = complete` to see them as warnings and migrate incrementally.",
            "`Sendable` marks types that can be safely passed from one actor or task to another. Structs and enums whose members are `Sendable` are (implicitly, if not `public`); actors always are; a `final class` only if all its properties are `let`s of `Sendable` types.",
            "`@unchecked Sendable` tells the compiler \"trust me\": use it when you do the synchronization yourself (a lock), and treat it as debt that needs a justification in the PR.",
          ],
          code: `struct User: Sendable {          // implicit if internal; explicit if public
    let id: UUID
    var name: String
}

final class Config: Sendable {   // final + only lets of Sendable types
    let baseURL: URL
    init(baseURL: URL) { self.baseURL = baseURL }
}

final class DataCache: @unchecked Sendable {   // synchronization is on you
    private let lock = NSLock()
    private var storage: [String: Data] = [:]
    func get(_ key: String) -> Data? { lock.withLock { storage[key] } }
}`,
        },
        {
          kind: "predict",
          prompt: "In Swift 6 mode, what happens with this code?",
          code: `final class Counter: Sendable {
    var count = 0
}`,
          options: [
            "It compiles: `final` is enough to be `Sendable`",
            "It compiles with a warning",
            "It compiles, but crashes when used from two tasks",
            "Error: a `Sendable` class can't have mutable stored properties (`var`)",
          ],
          answer: 3,
          explanation: "For a class to be `Sendable` the compiler requires `final` and all stored state to be immutable and `Sendable`. A `var` would allow concurrent writes, so it's an error. Options: make it an `actor`, a `struct`, or `@unchecked Sendable` with a lock.",
        },
        {
          kind: "explain",
          title: "@Sendable closures and nonisolated",
          body: [
            "Closures handed to another task (`Task { }`, `group.addTask`, `Task.detached`) are `@Sendable` or `sending`: they can't capture a local `var` and mutate it from several tasks. Return values and accumulate in the parent task.",
            "`nonisolated` marks members of an actor or a `@MainActor` type that don't touch isolated state: they can be called without `await` from anywhere. Typical for a derived `let` or to satisfy a synchronous protocol like `CustomStringConvertible`.",
          ],
          code: `var total = 0
let numbers = [1, 2, 3]
await withTaskGroup(of: Int.self) { group in
    for n in numbers {
        group.addTask { n * 2 }              // ✅ captures a let
        // group.addTask { total += n }      // ❌ mutates a captured var: error in Swift 6
    }
    for await value in group { total += value }   // ✅ the parent task accumulates
}
print(total)

actor Session {
    let id = UUID()
    private var requests = 0
    nonisolated var debugName: String { "session-\\(id)" }   // no await needed from outside
}`,
          output: "12",
        },
        {
          kind: "fill",
          prompt: "`description` is a synchronous, non-isolated requirement of `CustomStringConvertible`. Fill in the modifier so the implementation can be called from any context.",
          code: `@MainActor
final class PlayerModel: CustomStringConvertible {
    let id: Int
    var isPlaying = false
    init(id: Int) { self.id = id }

    ____ var description: String { "Player \\(id)" }
}`,
          accept: ["^nonisolated$"],
          explanation: "`nonisolated` takes `description` off the main actor. It compiles because it only reads `id`, a `let` of a `Sendable` type; reading `isPlaying` (an isolated `var`) would be an error.",
          placeholder: "modifier",
        },
        {
          kind: "explain",
          title: "Migrating: @preconcurrency, sending and Swift 6.2",
          body: [
            "`@preconcurrency import` quiets a module that doesn't have `Sendable` annotations yet (an Objective-C SDK): its diagnostics stop blocking you while you migrate your own code. `sending` on a parameter or result says the value is **transferred** to another isolation domain and the caller won't use it again, which lets you pass non-`Sendable` types safely.",
            "Swift 6.2 (Xcode 26) brings **approachable concurrency**: you can set the module's default isolation to `MainActor` (new app projects ship that way), and non-isolated `async` functions run on the caller's actor. To push heavy work off, you mark it explicitly with `@concurrent`.",
            "For races the compiler can't see (GCD code, `@unchecked Sendable`), enable **Thread Sanitizer** in the scheme (Run › Diagnostics) and run your tests with it in CI.",
          ],
          code: `@preconcurrency import LegacyAnalyticsSDK

// Package.swift (tools 6.2): default isolation for the target
.target(
    name: "Feature",
    swiftSettings: [.defaultIsolation(MainActor.self)]
)

// With approachable concurrency:
struct ImageProcessor {
    @concurrent
    func resize(_ data: Data) async -> Data {
        // runs off the main actor even when called from the UI
        downscale(data)
    }
}

func makeRequest() -> sending URLRequest { URLRequest(url: endpoint) }`,
        },
        {
          kind: "predict",
          prompt: "You switched the target to Swift 6 and the analytics SDK (Objective-C, no concurrency annotations) produces dozens of `Sendable` errors at your call sites. What's the most reasonable first step?",
          code: `import LegacyAnalyticsSDK

func track(_ event: AnalyticsEvent) {
    Task.detached {
        Analytics.shared.log(event)   // error: AnalyticsEvent isn't Sendable
    }
}`,
          options: [
            "Add `@unchecked Sendable` to all your types",
            "Import the SDK with `@preconcurrency import` and keep migrating your own code",
            "Move the whole target back to GCD",
            "Mark everything `nonisolated(unsafe)`",
          ],
          answer: 1,
          explanation: "`@preconcurrency import` exists precisely for dependencies that haven't adopted concurrency yet: it relaxes their diagnostics without hiding the ones in your code. `@unchecked Sendable` and `nonisolated(unsafe)` switch checks off without fixing anything, and going back to GCD doesn't remove the races.",
        },
        {
          kind: "explain",
          title: "Combine in existing codebases",
          body: [
            "Combine (iOS 13+) is still in plenty of apps: publishers emit values over time and subscribers receive them. With `ObservableObject`, each `@Published` exposes a publisher via `$property`. `@Observable` doesn't generate publishers.",
            "`sink` returns an `AnyCancellable`. If you don't keep it, the subscription is cancelled when it's released. That's why everything ends in `.store(in: &cancellables)`, and the closure uses `[weak self]` because `self` owns `cancellables`.",
            "`debounce` waits for a pause before emitting (search-as-you-type) and `removeDuplicates` avoids repeating the same query. In new code, `.task(id:)` plus `Task.sleep` covers the same case.",
          ],
          code: `import Combine

final class SearchViewModel: ObservableObject {
    @Published var query = ""
    @Published private(set) var results: [String] = []
    private var cancellables = Set<AnyCancellable>()

    init() {
        $query
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] text in
                self?.search(text)
            }
            .store(in: &cancellables)
    }

    private func search(_ text: String) { /* ... */ }
}`,
        },
        {
          kind: "predict",
          prompt: "After `init`, the user types in the search field. What gets printed for those changes?",
          code: `final class SearchViewModel: ObservableObject {
    @Published var query = ""

    init() {
        _ = $query.sink { print("query:", $0) }
    }
}`,
          options: [
            "Nothing: the `AnyCancellable` returned by `sink` is discarded and the subscription is cancelled right away",
            "One line for each change to `query`",
            "Crash: `sink` requires calling `store(in:)`",
            "Only the last value, when the screen closes",
          ],
          answer: 0,
          explanation: "`@Published` emits the current value on subscription, so `query: ` shows up once during `init`. But `_ =` discards the `AnyCancellable`, which cancels the subscription when released: later changes never arrive. Keep it with `.store(in: &cancellables)`.",
        },
        {
          kind: "fill",
          prompt: "Fill in the operator that waits for 300 ms without changes before emitting the search.",
          code: `$query
    .____(for: .milliseconds(300), scheduler: RunLoop.main)
    .removeDuplicates()
    .sink { [weak self] in self?.search($0) }
    .store(in: &cancellables)`,
          accept: ["^debounce$"],
          explanation: "`debounce` restarts its timer with every value and emits only after 300 ms of silence. `throttle`, by contrast, emits at most one value per interval even while the user keeps typing.",
          placeholder: "operator",
        },
        {
          kind: "write",
          prompt: "Move the search to modern SwiftUI without Combine: in `SearchView`, use `.task(id: query)` with a 300 ms `Task.sleep` as the debounce, then `await model.search(query)`.",
          starter: `struct SearchView: View {
    @State private var query = ""
    @State private var model = SearchModel()

    var body: some View {
        List(model.results, id: \\.self) { Text($0) }
            .searchable(text: $query)
    }
}`,
          checks: [
            { pattern: "\\.task\\(id:\\s*query\\)", label: "Uses `.task(id: query)`" },
            { pattern: "Task\\.sleep\\(", label: "Waits with `Task.sleep` as the debounce" },
            { pattern: "await\\s+model\\.search\\(query\\)", label: "Calls `await model.search(query)`" },
          ],
          warnings: [
            { pattern: "asyncAfter", label: "`asyncAfter` isn't cancelled when the text changes" },
            { pattern: "Task\\.detached", label: "`Task.detached` loses the automatic cancellation of `.task`" },
          ],
          solution: `struct SearchView: View {
    @State private var query = ""
    @State private var model = SearchModel()

    var body: some View {
        List(model.results, id: \\.self) { Text($0) }
            .searchable(text: $query)
            .task(id: query) {
                do {
                    try await Task.sleep(for: .milliseconds(300))
                } catch {
                    return    // cancelled: the user kept typing
                }
                await model.search(query)
            }
    }
}`,
          hint: "Every change to `query` cancels the previous task; if the sleep throws, return without searching.",
        },
      ],
    },
    {
      id: "final-challenge",
      title: "Final challenge: cache and token refresh",
      goal: "Diagnose a production data race and design an actor-based token refresh that coalesces concurrent calls.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "You're on call for a delivery app. Crashlytics shows an intermittent `EXC_BAD_ACCESS` inside `Dictionary` in `ImageCache`, which lots of cells use while downloading images in parallel. With Thread Sanitizer, QA reproduces it: \"Data race in ImageCache.insert\".",
            "At the same time, support reports users getting logged out: when the token expires, the home screen fires 6 requests at once, each sees the expired token and calls `authAPI.refresh()`. The backend rotates the refresh token and 5 of the 6 fail.",
            "Your job: explain the cause, move the cache to a safe model, and write an `AuthClient` that refreshes only once no matter how many of the 6 tasks call it at the same time.",
          ],
          code: `final class ImageCache {
    static let shared = ImageCache()
    private var images: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? { images[url] }
    func insert(_ image: UIImage, for url: URL) { images[url] = image }
}

final class AuthClient {
    private var token: Token?

    func validToken() async throws -> Token {
        if let token, !token.isExpired { return token }
        let newToken = try await authAPI.refresh()   // 6 calls = 6 refreshes
        token = newToken
        return newToken
    }
}`,
        },
        {
          kind: "predict",
          prompt: "What's the root cause of the `ImageCache` crash?",
          code: `// From many tasks at once:
ImageCache.shared.insert(image, for: url)
let cached = ImageCache.shared.image(for: otherURL)`,
          options: [
            "`static let shared` creates a new instance on every access",
            "`UIImage` can't be stored in a dictionary",
            "`Dictionary` isn't thread-safe: unsynchronized concurrent reads and writes are a data race",
            "The methods are missing `@objc`",
          ],
          answer: 2,
          explanation: "`static let` is initialized exactly once, safely; the problem is what happens afterwards. Several tasks mutate and read the same `Dictionary` with no synchronization: an `insert` can reallocate the buffer while another thread reads. That's a data race, undefined behavior, which is why the crash is intermittent.",
        },
        {
          kind: "write",
          prompt: "Rewrite `ImageCache` as an `actor` (keeping `shared`, `image(for:)` and `insert(_:for:)`) and add `func cachedImage(url: URL) async -> UIImage?` that queries it from outside.",
          starter: `final class ImageCache {
    static let shared = ImageCache()
    private var images: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? { images[url] }
    func insert(_ image: UIImage, for url: URL) { images[url] = image }
}`,
          checks: [
            { pattern: "^\\s*actor\\s+ImageCache", label: "`ImageCache` is an `actor`" },
            { pattern: "func\\s+image\\(for", label: "Keeps `image(for:)`" },
            { pattern: "func\\s+insert\\(", label: "Keeps `insert(_:for:)`" },
            { pattern: "await\\s+ImageCache\\.shared\\.image\\(for:", label: "Called with `await` from outside" },
          ],
          warnings: [
            { pattern: "static\\s+var\\s+shared", label: "`static var` is mutable global state: an error in Swift 6" },
            { pattern: "DispatchQueue|NSLock", label: "The actor already serializes: no manual synchronization needed" },
          ],
          solution: `actor ImageCache {
    static let shared = ImageCache()
    private var images: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? { images[url] }
    func insert(_ image: UIImage, for url: URL) { images[url] = image }
}

func cachedImage(url: URL) async -> UIImage? {
    await ImageCache.shared.image(for: url)
}`,
          hint: "Only the type's keyword changes; callers switch to `await`.",
        },
        {
          kind: "write",
          prompt: "Rewrite `AuthClient` as an `actor` that coalesces refreshes: if one is already in flight, other calls await that same `Task` instead of calling `authAPI.refresh()` again. Clear the task when it finishes.",
          starter: `final class AuthClient {
    private var token: Token?

    func validToken() async throws -> Token {
        if let token, !token.isExpired { return token }
        let newToken = try await authAPI.refresh()
        token = newToken
        return newToken
    }
}`,
          checks: [
            { pattern: "^\\s*actor\\s+AuthClient", label: "`AuthClient` is an `actor`" },
            { pattern: "Task<Token,\\s*(any\\s+)?Error>", label: "Stores the in-flight refresh task (`Task<Token, Error>?`)" },
            { pattern: "\\.value", label: "Later calls await `task.value`" },
            { pattern: "authAPI\\.refresh\\(\\)", label: "Calls `authAPI.refresh()` inside the task" },
            { pattern: "=\\s*nil", label: "Clears the task when it finishes" },
          ],
          warnings: [
            { pattern: "^\\s*(final\\s+)?class\\s+AuthClient", label: "A class with no isolation brings the data race back" },
            { pattern: "DispatchSemaphore", label: "A semaphore blocks threads in the cooperative pool" },
          ],
          solution: `actor AuthClient {
    private var token: Token?
    private var refreshTask: Task<Token, Error>?

    func validToken() async throws -> Token {
        if let token, !token.isExpired { return token }
        if let refreshTask { return try await refreshTask.value }

        let task = Task { try await authAPI.refresh() }
        refreshTask = task
        defer { refreshTask = nil }

        let newToken = try await task.value
        token = newToken
        return newToken
    }
}`,
          hint: "Assign `refreshTask` before the first `await`: that's what calls entering through reentrancy will see.",
        },
        {
          kind: "predict",
          prompt: "With your `AuthClient` actor and an expired token, the home screen calls `validToken()` from 6 tasks at once while the refresh takes 1 second. How many times is `authAPI.refresh()` called?",
          code: `await withTaskGroup(of: Void.self) { group in
    for _ in 1...6 {
        group.addTask { _ = try? await auth.validToken() }
    }
}`,
          options: [
            "6: every task sees the expired token",
            "1: the first call creates and stores the task before suspending, and the other 5 await its `value`",
            "0: the actor returns the expired token",
            "Anywhere from 1 to 6, depending on reentrancy",
          ],
          answer: 1,
          explanation: "There's no `await` between the `if let refreshTask` check and the `refreshTask = task` assignment, so nobody can sneak in between. The first call stores the task and suspends; the other five enter through reentrancy, find it and await `refreshTask.value`. When it completes, `token` is set before the `defer` clears the task.",
        },
      ],
    },
  ],
  flashcards: [
    {
      id: "fc-main-thread",
      front: "Which thread updates the UI, and how do you get back to it from a callback?",
      back: "Always the main thread. With callbacks: `DispatchQueue.main.async { }`. With async/await: `@MainActor` code or `await MainActor.run { }`. In Debug, the Main Thread Checker tells you when you get it wrong.",
      code: "DispatchQueue.main.async {\n    self.tableView.reloadData()\n}",
    },
    {
      id: "fc-sync-deadlock",
      front: "What happens with `DispatchQueue.main.sync { }` called from the main thread?",
      back: "Deadlock: main blocks waiting for a block that can only run on main. GCD usually detects it and crashes. Same with `queue.sync` inside a block already running on that serial queue.",
    },
    {
      id: "fc-serial-concurrent",
      front: "Serial vs concurrent queue",
      back: "Serial: one block at a time, FIFO. Concurrent (`attributes: .concurrent`, `global()`): several at once, no guaranteed order between them. `async` returns immediately; `sync` blocks until the block finishes.",
    },
    {
      id: "fc-dispatch-group",
      front: "`DispatchGroup` rules",
      back: "One `enter()` per task and exactly one `leave()` on every path (success and failure). `notify(queue:)` runs when the counter hits zero. An extra `leave()` crashes; a missing one leaves `notify` waiting forever.",
      code: "group.enter()\napi.fetch { _ in\n    defer { group.leave() }\n    // ...\n}\ngroup.notify(queue: .main) { done() }",
    },
    {
      id: "fc-operation-queue",
      front: "When do you see `OperationQueue` instead of plain GCD?",
      back: "When you need dependencies (`addDependency`), a concurrency cap (`maxConcurrentOperationCount`) or bulk cancellation (`cancelAllOperations()`). `cancel()` only sets `isCancelled`: the operation has to check it.",
    },
    {
      id: "fc-async-let-group",
      front: "`async let` vs `TaskGroup`",
      back: "`async let`: a fixed number of tasks known at write time, possibly of different types. `withTaskGroup`: a dynamic number (N items), results in completion order. Both are structured concurrency: children are cancelled if the scope exits with an error.",
    },
    {
      id: "fc-task-detached",
      front: "`Task { }` vs `Task.detached { }` vs `.task { }`",
      back: "`Task { }` inherits the actor and priority of its context (from `@MainActor` it runs on main). `Task.detached` inherits nothing; you rarely need it. `.task { }` in SwiftUI is cancelled automatically when the view disappears.",
    },
    {
      id: "fc-cancellation",
      front: "How does task cancellation work in Swift?",
      back: "It's cooperative: `cancel()` only sets a flag. Code checks it with `try Task.checkCancellation()` (throws `CancellationError`) or `Task.isCancelled`. `Task.sleep` and `URLSession` already cooperate; a CPU loop doesn't.",
    },
    {
      id: "fc-continuation",
      front: "Golden rule of `withCheckedThrowingContinuation`",
      back: "Resume exactly once on every path. Twice: crash (`SWIFT TASK CONTINUATION MISUSE`). Never: the task stays suspended forever. With delegates, store the continuation and set it to `nil` after resuming.",
      code: "try await withCheckedThrowingContinuation { continuation in\n    legacy.fetch { result in\n        continuation.resume(with: result)\n    }\n}",
    },
    {
      id: "fc-async-stream",
      front: "What is `AsyncStream` for, and what must you not forget?",
      back: "Exposing a series of values (websocket, progress, a repeating delegate) as a sequence consumed with `for await`. Call `finish()` to end it and use `onTermination` to release resources when the consumer cancels.",
    },
    {
      id: "fc-actor",
      front: "What does an `actor` guarantee?",
      back: "That its mutable state is accessed by one task at a time: no data races on that state. From outside you call it with `await`. It doesn't rule out logic bugs: it's reentrant.",
    },
    {
      id: "fc-reentrancy",
      front: "What is actor reentrancy?",
      back: "While a method is suspended at an `await`, the actor serves other calls. Whatever you checked before the `await` may have changed. Mutate before suspending or re-check afterwards.",
    },
    {
      id: "fc-sendable",
      front: "Which types are `Sendable`?",
      back: "Structs and enums whose members are `Sendable` (implicitly, if not `public`), actors, and `final class`es with only `let`s of `Sendable` types. `@unchecked Sendable` = you synchronize (a lock) and the compiler trusts you.",
    },
    {
      id: "fc-swift62",
      front: "What does approachable concurrency change in Swift 6.2?",
      back: "You can set the module's default isolation to `MainActor` (new Xcode 26 projects), non-isolated `async` functions run on the caller's actor, and `@concurrent` explicitly marks what should go to the global pool.",
    },
    {
      id: "fc-combine-cancellable",
      front: "Why does a Combine subscription stop receiving values right away?",
      back: "Because you didn't keep the `AnyCancellable` returned by `sink`: when it's released, it cancels the subscription. Store it with `.store(in: &cancellables)` and use `[weak self]` in the closure.",
      code: "$query\n    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)\n    .sink { [weak self] in self?.search($0) }\n    .store(in: &cancellables)",
    },
  ],
  exam: [
    {
      id: "ex-main-checker",
      question: "QA hits `Main Thread Checker: UI API called on a background thread` pointing at `tableView.reloadData()`, called inside a `URLSession.dataTask` completion. What's the right fix?",
      options: [
        "Wrap the call in `DispatchQueue.global().async`",
        "Wrap the call in `DispatchQueue.main.async`",
        "Wrap the call in `DispatchQueue.main.sync` from the completion and from `viewDidLoad` too",
        "Turn off the Main Thread Checker in the scheme",
      ],
      answer: 1,
      explanation: "The `URLSession` completion arrives on a background queue and the UI is main-only. `DispatchQueue.main.async` enqueues the reload on main without blocking. `main.sync` from main is a deadlock, and disabling the checker just hides the bug.",
    },
    {
      id: "ex-parallel-requests",
      question: "A new screen (iOS 17) needs three independent endpoints and shows up when all three arrive. Today it takes the sum of the three durations. What change do you make?",
      code: "let profile = try await api.profile()\nlet stats = try await api.stats()\nlet badges = try await api.badges()",
      options: [
        "A `DispatchSemaphore` to wait for all three on main",
        "One `Task.detached` per request and global variables for the results",
        "Add `@MainActor` to `api`",
        "Declare all three with `async let` and await them together with `try await`",
      ],
      answer: 3,
      explanation: "`async let` starts the three requests in parallel and the later `try await` collects the results: total time becomes that of the slowest one. It's also structured: if one fails, the others are cancelled. A semaphore on main freezes the UI.",
    },
    {
      id: "ex-reentrancy",
      question: "In an `Inventory` actor, `reserve(_:)` checks `stock > 0`, does `await api.lock(item)` and only then decrements `stock`. QA sees negative stock after two quick taps. What's the cause?",
      options: [
        "Reentrancy: during the `await` another call came in and passed the same check",
        "Actors don't protect their state against concurrent access",
        "The actor isn't marked `@MainActor`",
        "A compiler bug with `async` inside actors",
      ],
      answer: 0,
      explanation: "The actor serializes access, but gives up its turn at every `await`. Both calls see `stock > 0` before either decrements. Fix: decrement before the `await` (and roll back on failure) or re-check afterwards.",
    },
    {
      id: "ex-continuation-leak",
      question: "You wrapped an SDK with `withCheckedThrowingContinuation`, but in one error case the SDK never calls the callback. What symptom will you see?",
      options: [
        "An immediate crash when the closure returns",
        "The task throws `CancellationError` after 60 seconds",
        "The task stays suspended forever (endless spinner) and the runtime logs that the continuation leaked",
        "The function returns `nil`",
      ],
      answer: 2,
      explanation: "A continuation that's never resumed leaves the task suspended indefinitely. The checked version notices it was released without resuming and logs it. Crashing is what happens when you resume twice. The fix is to cover every path with a `resume`, including a timeout if the SDK may never answer.",
    },
    {
      id: "ex-task-modifier",
      question: "A view loads data with `onAppear { Task { await model.load() } }`. If the user goes in and out quickly a few times, requests pile up and whichever arrives last overwrites the state. What's the best change?",
      options: [
        "Use `Task.detached` instead of `Task`",
        "Add a one-second `DispatchQueue.main.asyncAfter`",
        "Switch to `.task { await model.load() }`, which is cancelled when the view disappears",
        "Call `model.load()` from the view's `init`",
      ],
      answer: 2,
      explanation: "`.task` ties the task to the view's lifecycle and cancels it on disappear; with async `URLSession`, cancellation stops the request. `Task.detached` makes things worse (no inheritance, no cancellation), and a SwiftUI view's `init` runs many times.",
    },
    {
      id: "ex-sendable-fix",
      question: "In Swift 6, passing `AppSettings` (a `final class` with several `var` properties that in practice never change after creation) into `Task.detached` produces a `Sendable` error. What's the best fix?",
      options: [
        "Turn it into a `struct` (or use only `let`s), which makes it `Sendable`",
        "Mark it `@unchecked Sendable` and change nothing else",
        "Declare the variable `nonisolated(unsafe)`",
        "Switch the target back to Swift 5 mode",
      ],
      answer: 0,
      explanation: "If the data is read-only, modeling it as an immutable value makes it genuinely `Sendable`, and the compiler verifies it. `@unchecked` and `nonisolated(unsafe)` turn the check off without guaranteeing anything, and going back to Swift 5 only hides the problem.",
    },
    {
      id: "ex-token-refresh",
      question: "When the token expires, 6 parallel requests get a 401 and each triggers its own refresh; the backend rotates the refresh token and 5 of them fail. Which design fixes it?",
      options: [
        "Wrap the refresh in `DispatchQueue.main.sync`",
        "Retry each request 6 times with a random delay",
        "A `DispatchSemaphore(value: 1)` on the main thread",
        "An `actor` that stores the in-flight refresh `Task`; other calls await its `value`",
      ],
      answer: 3,
      explanation: "The actor serializes the check and, since the task is stored before the first `await`, calls entering through reentrancy find it and await the same result: a single refresh. Retries only multiply the problem and semaphores block threads.",
    },
    {
      id: "ex-operation-queue",
      question: "In a legacy module without async/await you download 200 images. You want at most 4 at a time and the ability to cancel all of them when the user leaves the screen. What's the most direct option?",
      options: [
        "`DispatchQueue.main.async` for each image",
        "An `OperationQueue` with `maxConcurrentOperationCount = 4` and `cancelAllOperations()` on exit",
        "One `Thread` per image",
        "A `DispatchGroup` with `wait()` on main",
      ],
      answer: 1,
      explanation: "`OperationQueue` handles both: a concurrency cap and bulk cancellation (each running operation checks `isCancelled`). Main isn't for downloads, 200 threads is wasteful, and `wait()` on main freezes the UI.",
    },
    {
      id: "ex-combine-store",
      question: "An `ObservableObject` sets up `$query.debounce(...).sink { ... }` in its `init`, but the closure never receives what the user types. What's the most likely cause?",
      options: [
        "`debounce` needs `DispatchQueue.main`, not `RunLoop.main`",
        "`@Published` doesn't work inside classes",
        "The `AnyCancellable` from `sink` isn't stored, so the subscription is cancelled right away",
        "You have to call `objectWillChange.send()` manually",
      ],
      answer: 2,
      explanation: "`sink` returns an `AnyCancellable` that cancels the subscription when released. If it isn't stored with `.store(in: &cancellables)`, it dies at the end of `init`. `RunLoop.main` is a valid scheduler for `debounce`.",
    },
    {
      id: "ex-default-isolation",
      question: "New Xcode 26 project with default isolation `MainActor` and approachable concurrency. An `async` function that decodes a 20 MB JSON freezes the UI. What do you do?",
      options: [
        "Mark the function `@concurrent` so it runs off the main actor",
        "Wrap the call in a `Task { }` inside the view",
        "Add an explicit `@MainActor` to it",
        "Wrap the decode in `DispatchQueue.main.async`",
      ],
      answer: 0,
      explanation: "With default `MainActor` isolation, code runs on main unless you say otherwise. `@concurrent` states that the async function runs on the global pool. A `Task { }` created from the view inherits the main actor, so the work would stay on main.",
    },
    {
      id: "ex-serial-deadlock",
      question: "In a legacy service, a method already running inside `queue.async { }` (a private serial queue) calls a helper that does `queue.sync { }`. What happens?",
      options: [
        "Nothing unusual: `sync` runs the block inline on the same thread",
        "The block runs at the end of the queue without issues",
        "It's automatically turned into `async`",
        "Deadlock: the queue waits for a block that can only run once the queue itself finishes",
      ],
      answer: 3,
      explanation: "A serial queue runs one block at a time. The current block is stuck in `sync` waiting for the new one, which can't start until the current one finishes. GCD usually detects this and crashes. Fix: don't re-enter your own queue with `sync` (or move that state into an actor).",
    },
    {
      id: "ex-cancel-loop",
      question: "A `Task` processes 10,000 photos with a CPU-bound filter. When leaving the screen you call `task.cancel()`, but CPU usage stays high for a long while. Why, and how do you fix it?",
      options: [
        "Because `cancel()` needs `await`: write `await task.cancel()`",
        "Because cancellation is cooperative: add `try Task.checkCancellation()` (or `Task.isCancelled`) in each iteration",
        "Because a `Task` can't be cancelled: use `Task.detached`",
        "Because the loop is missing `@MainActor`",
      ],
      answer: 1,
      explanation: "`cancel()` only flags the task. A CPU loop that never checks the flag runs to the end. With `try Task.checkCancellation()` on every iteration it stops right away with `CancellationError`.",
    },
  ],
};

export default content;
