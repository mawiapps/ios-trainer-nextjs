import type { CourseContent } from "../types";

// Swift code uses String.raw so the backslashes in `\(...)` and `\.keyPath` survive.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "debugging-toolkit",
      title: "The debugging toolkit",
      goal: "Use conditional, symbolic and exception breakpoints, breakpoints that log without stopping, LLDB (`v`, `p`, `po`, `expr`) and Xcode's diagnostics to find a bug without sprinkling `print` everywhere.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Breakpoints that do the work for you",
          body: [
            "A plain breakpoint always stops. In a list of 500 items where only number 437 is broken, that's useless. A **conditional breakpoint** only stops when its condition is true (`order.id == \"A-1029\"`), and the **Ignore** field skips the first N hits.",
            "A **symbolic breakpoint** stops on a symbol, not a line, so it works on code you don't own. The classic is `UIViewAlertForUnsatisfiableConstraints`, which stops right when Auto Layout breaks a constraint. The **exception breakpoint** (All Objective-C Exceptions) stops where the exception is thrown, not in `main` when it's too late; for Swift errors there's the **Swift Error Breakpoint**.",
            "A breakpoint with an **action** can log (`Log Message`, with `@total@` to interpolate) or run an LLDB command, and with **Automatically continue after evaluating actions** it never pauses the app. It's a `print` that doesn't touch your code, never gets committed and turns off with one click.",
          ],
          code: `# Conditional: only for the failing order
(lldb) breakpoint set --file CartViewModel.swift --line 42 --condition 'order.id == "A-1029"'

# Symbolic: stop when Auto Layout breaks a constraint
(lldb) breakpoint set --name UIViewAlertForUnsatisfiableConstraints

# Log and continue: a print without touching the code
(lldb) breakpoint set --file CartViewModel.swift --line 58 --auto-continue true
(lldb) breakpoint command add --one-liner "po total" 3`,
        },
        {
          kind: "predict",
          prompt: "A single product's cell (`sku == \"TSHIRT-XL\"`) shows the wrong price, in a catalog of 800 products. You want to inspect `configure(with:)` only for that case. What do you use?",
          code: swift`func configure(with product: Product) {
    titleLabel.text = product.name
    priceLabel.text = priceFormatter.string(for: product.price)   // line 31
}`,
          options: [
            "A symbolic breakpoint on `configure(with:)`",
            "A `print(product)` on line 31, then search the console",
            "A breakpoint on line 31 with the condition `product.sku == \"TSHIRT-XL\"`",
            "An exception breakpoint, since the wrong price is an exception",
          ],
          answer: 2,
          explanation:
            "The conditional breakpoint stops only on the case you care about: no hitting Continue 800 times, no code changes. The symbolic one would stop on every cell. The `print` works but dirties the code and you have to remember to remove it. Nothing is thrown here: the price is just wrong.",
        },
        {
          kind: "explain",
          title: "LLDB: `v`, `p`, `po` and `expr`",
          body: [
            "`v` (alias for `frame variable`) reads variables in the frame **without compiling or running code**: fast and side-effect free. Reach for it first. `p` evaluates an expression and shows the value with its type. `po` evaluates and shows the object's **description**: if the type conforms to `CustomDebugStringConvertible`, it uses `debugDescription`.",
            "`expr` runs code inside the paused process, so it can **change state**: force `isPremium = true` to test a screen without buying, or change a color. The UI doesn't redraw while you're paused, so `CATransaction.flush()` applies the change without continuing.",
            "`bt` prints the current thread's backtrace and `thread list` lists every thread. When `po` fails with weird compile errors, try `v`: it doesn't need to compile the expression.",
          ],
          code: `(lldb) v order                      # read without running code
(lldb) p order.totalCents            # evaluate and show the value with its type
(lldb) po order                      # uses debugDescription / description
(lldb) expr viewModel.isPremium = true
(lldb) expr -l objc -- (void)[CATransaction flush]
(lldb) bt                            # current thread's backtrace`,
        },
        {
          kind: "fill",
          prompt: "You're paused on a breakpoint and want to see the premium screen without buying. Complete the LLDB command that changes the state.",
          code: `(lldb) ____ viewModel.isPremium = true`,
          accept: ["^expr$", "^expression$", "^e$"],
          hint: "It's the command that **runs** code, not the one that only reads variables.",
          explanation: "`expr` (or `expression`, or `e`) compiles and runs the expression in the process, so it can assign. `v` only reads frame variables.",
        },
        {
          kind: "predict",
          prompt: "You're paused right after the last line. What do `print(price)` in the app console and `po price` in LLDB show?",
          code: swift`struct Money: CustomStringConvertible, CustomDebugStringConvertible {
    let cents: Int
    var description: String { "$\(cents / 100)" }
    var debugDescription: String { "Money(cents: \(cents))" }
}

let price = Money(cents: 1500)
print(price)
// (lldb) po price`,
          options: [
            "`$15` and `Money(cents: 1500)`",
            "`$15` and `$15`",
            "`Money(cents: 1500)` and `Money(cents: 1500)`",
            "`Money(cents: 1500)` and `$15`",
          ],
          answer: 0,
          explanation:
            "`print` uses `description`, so it prints `$15`. `po` prefers `debugDescription` when the type conforms to `CustomDebugStringConvertible`, so it shows `Money(cents: 1500)`. That's why it pays to give the models you inspect often a useful `debugDescription`.",
        },
        {
          kind: "explain",
          title: "Seeing what you can't see: view hierarchy, Main Thread Checker and Environment Overrides",
          body: [
            "The **View Hierarchy Debugger** (Debug View Hierarchy button) pauses the app and shows your views in 3D: you find the view covering a button, one with `alpha` 0 or a zero frame, and ambiguous constraints flagged in purple.",
            "The **Main Thread Checker** (on by default when running from Xcode, under Scheme → Diagnostics) catches UIKit being used from a background thread and stops on the line. In production those bugs show up as flicker, UI that doesn't update or intermittent crashes. **Thread Sanitizer** catches data races, but it can't be enabled together with Address Sanitizer.",
            "**Environment Overrides** (in the debug bar) switches Dark Mode, Dynamic Type and accessibility options live. It's the fastest way to reproduce a \"the text is cut off\" report from a user with large text.",
          ],
          code: swift`final class ReceiptViewController: UIViewController {
    @IBOutlet private var statusLabel: UILabel!

    func refresh() {
        URLSession.shared.dataTask(with: receiptURL) { data, _, _ in
            // This closure runs on a background thread
            self.statusLabel.text = "Done"
            // Main Thread Checker: UI API called on a background thread: -[UILabel setText:]
        }.resume()
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Rewrite `refresh()` with `async/await` so the label is always updated on the main thread and the Main Thread Checker stays quiet. If the download fails, set the label to \"Error\".",
          starter: swift`final class ReceiptViewController: UIViewController {
    @IBOutlet private var statusLabel: UILabel!

    func refresh() {
        URLSession.shared.dataTask(with: receiptURL) { data, _, _ in
            self.statusLabel.text = "Done"
        }.resume()
    }
}`,
          checks: [
            { pattern: "@MainActor", label: "The class or method is isolated to `@MainActor`" },
            { pattern: "func\\s+refresh\\(\\)\\s+async", label: "`refresh()` is `async`" },
            { pattern: "try\\s+await\\s+URLSession\\.shared\\.data\\(", label: "Uses `try await URLSession.shared.data(from:)`" },
            { pattern: "catch", label: "Handles the error with `catch`" },
          ],
          warnings: [
            { pattern: "dataTask\\(", label: "Still uses `dataTask` with a completion handler" },
            { pattern: "DispatchQueue\\.global", label: "No need to hop to a global queue by hand" },
          ],
          solution: swift`@MainActor
final class ReceiptViewController: UIViewController {
    @IBOutlet private var statusLabel: UILabel!

    func refresh() async {
        do {
            _ = try await URLSession.shared.data(from: receiptURL)
            statusLabel.text = "Done"
        } catch {
            statusLabel.text = "Error"
        }
    }
}`,
          hint: "With the class on `@MainActor`, you're back on the main actor after the `await`.",
        },
        {
          kind: "predict",
          prompt: "A user sends a screenshot: the \"Checkout\" button reads \"Che...\". You can't see it on your iPhone. What's the fastest way to reproduce it?",
          code: swift`Button("Checkout") { checkout() }
    .frame(width: 80, height: 44)`,
          options: [
            "Ask the user for a sysdiagnose",
            "Add a symbolic breakpoint on `UIViewAlertForUnsatisfiableConstraints`",
            "Open the View Hierarchy Debugger and look for ambiguous constraints",
            "Run the app and bump the text size with Environment Overrides (Dynamic Type)",
          ],
          answer: 3,
          explanation:
            "A fixed 80 pt width plus text that grows with Dynamic Type is the classic cause of \"Che...\". Environment Overrides changes the text size live without going to Settings. The View Hierarchy won't show anything odd at your text size, and no constraints are breaking here.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "memory-in-practice",
      title: "Memory in practice",
      goal: "Find a screen that never deallocates with the Memory Graph Debugger and Instruments, write a test that catches it, and compute and reduce image memory with downsampling.",
      minutes: 24,
      steps: [
        {
          kind: "explain",
          title: "The view controller that never leaves",
          body: [
            "In the memory course you saw retain cycles in theory. In practice the symptom looks different: memory climbs every time you enter and leave a screen, or an observer fires two, three, four times because old instances are still alive.",
            "The cheapest check is a `deinit` that logs: if you close the screen and it doesn't show up, something is holding it. To find **what**, pause with **Debug Memory Graph**: the left pane lists how many instances of each class are alive and flags leaks with a purple `!`; select one and the graph shows who retains it.",
            "Turn on **Malloc Stack Logging** (Scheme → Diagnostics) and the inspector shows the backtrace where each object was allocated. The most common cycle: `self` holds the view model, the view model holds a closure and the closure captures `self` strongly.",
          ],
          code: swift`final class ProfileViewController: UIViewController {
    private let viewModel = ProfileViewModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        viewModel.onUpdate = { profile in
            self.render(profile)   // self → viewModel → onUpdate → self
        }
    }

    deinit { print("ProfileViewController deinit") }   // never printed
}`,
        },
        {
          kind: "predict",
          code: swift`final class Screen {
    let name: String
    var onTap: (() -> Void)?

    init(name: String) {
        self.name = name
        onTap = { print("tap on", self.name) }
    }

    deinit { print("deinit", name) }
}

var screen: Screen? = Screen(name: "A")
screen = nil
print("end")`,
          options: [
            "`deinit A`, then `end`",
            "Only `end`",
            "`end`, then `deinit A`",
            "`tap on A`, then `end`",
          ],
          answer: 1,
          explanation:
            "The closure stored in `onTap` captures `self` strongly, and `self` holds the closure: a cycle. Setting `screen = nil` doesn't bring the count to zero, `deinit` never runs and only `end` is printed. The closure was never called, so `tap on A` doesn't show up either.",
        },
        {
          kind: "fill",
          prompt: "Complete the capture list to break the cycle.",
          code: swift`viewModel.onUpdate = { [____ self] profile in
    guard let self else { return }
    self.render(profile)
}`,
          accept: ["^weak$"],
          hint: "The capture that becomes `nil` when the object is freed.",
          explanation: "`[weak self]` captures a weak reference: it doesn't add to the count and turns `nil` once the screen is gone. `unowned` also breaks the cycle, but crashes if the closure runs after the screen has been deallocated.",
        },
        {
          kind: "explain",
          title: "Instruments: Leaks, Allocations and a test that catches it",
          body: [
            "**Leaks** finds memory nothing in the app points to anymore. A cycle between objects that are still reachable (say, from a singleton) isn't a leak to that tool, but it's still wasted memory.",
            "That's what **Allocations** with **Mark Generation** is for: mark a generation, enter and leave the screen, mark another, repeat. If each generation leaves behind objects that should be gone, that's your growth. Filter by your module name so you don't drown in system objects.",
            "Once it's fixed, keep it fixed: a test that creates the screen, releases it and checks through a `weak` reference that it was deallocated. It runs on every PR.",
          ],
          code: swift`func test_profileScreen_whenReleased_isDeallocated() {
    var sut: ProfileViewController? = ProfileViewController()
    sut?.loadViewIfNeeded()
    weak var weakSUT = sut

    sut = nil

    XCTAssertNil(weakSUT, "ProfileViewController has a retain cycle")
}`,
        },
        {
          kind: "predict",
          prompt: "You already added `[weak self]`. The user closes the screen. What happens?",
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
            "The view controller stays alive because the timer retains it",
            "The timer invalidates itself when the view controller is deallocated",
            "It crashes on the next fire because `self` no longer exists",
            "The view controller is deallocated, but the timer keeps firing every second doing nothing",
          ],
          answer: 3,
          explanation:
            "With `[weak self]` the closure doesn't retain the screen, so it's freed. But the run loop retains the repeating timer, which keeps firing with `self` as `nil`: burning CPU and battery for nothing. You need `timer?.invalidate()` on the way out (e.g. in `viewWillDisappear`). No crash, because `self?` is optional.",
        },
        {
          kind: "explain",
          title: "Images: file size doesn't matter",
          body: [
            "A 2 MB JPEG on disk gets **decoded** into a bitmap to be displayed, and that bitmap takes `width × height × 4` bytes (RGBA, one byte per channel). A 4032 × 3024 photo is almost 49 MB, even if you show it in a 100 pt thumbnail.",
            "Ten of those in a feed and the system kills your app for memory (jetsam), with no crash report from your code. The fix is **downsampling**: decode straight to the pixel size it will be displayed at (points × screen scale).",
            "ImageIO does it without loading the full image: `CGImageSourceCreateThumbnailAtIndex` with `kCGImageSourceThumbnailMaxPixelSize`. On iOS 15+ there's also `UIImage.preparingThumbnail(of:)`. Do it off the main thread: decoding is CPU work.",
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
          prompt: "A square 3000 × 3000 photo is shown in a 120 × 120 pt avatar on a @3x iPhone, downsampled to the exact size. How many bytes does it take once decoded?",
          code: swift`let pointSize = CGSize(width: 120, height: 120)
let scale: CGFloat = 3
let image = downsample(imageAt: photoURL, to: pointSize, scale: scale)`,
          options: ["518400", "57600", "172800", "36000000"],
          answer: 0,
          explanation:
            "120 pt × 3 = 360 pixels per side. 360 × 360 × 4 = 518,400 bytes, about 0.5 MB. Without downsampling it would be 3000 × 3000 × 4 = 36,000,000 bytes: almost 70 times more for the same avatar on screen.",
        },
        {
          kind: "write",
          prompt:
            "Implement `thumbnail(at:maxPixelSize:)` with ImageIO: create the image source without caching the full image and request a thumbnail of at most `maxPixelSize` pixels, honoring the EXIF orientation.",
          starter: swift`import ImageIO
import UIKit

func thumbnail(at url: URL, maxPixelSize: CGFloat) -> UIImage? {
    // Today: decodes the full image
    UIImage(contentsOfFile: url.path)
}`,
          checks: [
            { pattern: "CGImageSourceCreateWithURL\\(", label: "Creates the source with `CGImageSourceCreateWithURL`" },
            { pattern: "CGImageSourceCreateThumbnailAtIndex\\(", label: "Requests the thumbnail with `CGImageSourceCreateThumbnailAtIndex`" },
            { pattern: "kCGImageSourceThumbnailMaxPixelSize", label: "Caps the size with `kCGImageSourceThumbnailMaxPixelSize`" },
            { pattern: "kCGImageSourceCreateThumbnailFromImageAlways", label: "Builds the thumbnail from the image (`kCGImageSourceCreateThumbnailFromImageAlways`)" },
            { pattern: "kCGImageSourceCreateThumbnailWithTransform", label: "Honors orientation (`kCGImageSourceCreateThumbnailWithTransform`)" },
          ],
          warnings: [{ pattern: "UIImage\\(contentsOfFile:", label: "`UIImage(contentsOfFile:)` decodes the image at full size" }],
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
          hint: "The options go in a dictionary `as CFDictionary`; the image index is `0`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "crashes",
      title: "Crashes: read the report, fix the cause",
      goal: "Read a symbolicated crash report, recognize the most common crash types, make sure dSYMs are in place for symbolication and understand the crash-free users metric.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "Anatomy of a crash report",
          body: [
            "In production there's no debugger: the crash report is all you get. Read it in this order: **Exception Type** (what kind of crash), **Triggered by Thread** (which thread died; 0 is the main thread) and **that thread's backtrace**, top to bottom.",
            "Frame 0 is where it died. If it's a system frame (`libswiftCore`, `UIKitCore`), go down to the **first frame from your app**: that's the line of your code that set it off. A symbolicated report gives you function, offset and file:line.",
            "Also check **Version** and **OS Version**: if the crash started with a release, you have a concrete diff to review. If it only shows up on one iOS version, suspect a system change.",
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
...         (system frames)`,
        },
        {
          kind: "predict",
          prompt: "The report above points at `CartViewModel.swift:58` with `EXC_BREAKPOINT`. Here's the code from that version. What's the most likely cause?",
          code: swift`55  func removeItem(at index: Int) {
56      let item = items[index]
57      analytics.track("cart_item_removed")
58      let price = priceCache[item.sku]!
59      totalCents -= price
60  }`,
          options: [
            "`items[index]` with an out-of-range index",
            "An `EXC_BAD_ACCESS` because `priceCache` was already freed",
            "The force unwrap of `priceCache[item.sku]`, which returned `nil`",
            "The watchdog killed the app because `analytics.track` blocked the main thread",
          ],
          answer: 2,
          explanation:
            "Line 58 is the `!` on a dictionary lookup: if the SKU isn't in the cache, the subscript returns `nil` and the force unwrap traps, which on arm64 shows up as `EXC_BREAKPOINT (SIGTRAP)`. An out-of-range index also gives `EXC_BREAKPOINT`, but it would be on line 56. A watchdog kill isn't `EXC_BREAKPOINT` and doesn't point at a specific line.",
        },
        {
          kind: "explain",
          title: "The crashes you'll see over and over",
          body: [
            "`EXC_BREAKPOINT (SIGTRAP)`: a Swift runtime trap. Force unwrapping `nil`, index out of range, arithmetic overflow, `fatalError`, a failing `try!`, or reading an `unowned` reference to an already freed object. It's deterministic: the frame points at the line.",
            "`EXC_BAD_ACCESS (SIGSEGV or SIGBUS)` with `KERN_INVALID_ADDRESS`: invalid memory access. In safe Swift it's almost always a **data race** (two threads mutating the same array or dictionary), `Unsafe` pointers, `unowned(unsafe)` or C/Objective-C code. It's intermittent and the frame is usually far from the cause: Thread Sanitizer helps you reproduce it.",
            "`EXC_CRASH (SIGABRT)`: an uncaught Objective-C exception, like `NSInternalInconsistencyException` when a `UITableView` gets a batch update that doesn't match its data source. `EXC_CRASH (SIGKILL)` with code `0x8badf00d` is the **watchdog**: the main thread didn't respond in time, typically because of synchronous work at launch. And if the system kills you for memory (jetsam) there's no crash report from your app: you see it as a JetsamEvent or in the memory metrics.",
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
// EXC_BAD_ACCESS (SIGSEGV), intermittent, anywhere inside the dictionary`,
        },
        {
          kind: "predict",
          prompt: "This report comes in from users on older iPhones, all at app launch. What happened?",
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
            "A force unwrap in `CatalogStore.loadFromDisk()`",
            "The watchdog killed the app because the main thread was busy reading from disk during launch",
            "The system terminated the app for using too much memory",
            "An Objective-C exception inside `NSData`",
          ],
          answer: 1,
          explanation:
            "`SIGKILL` with `0x8badf00d` (\"ate bad food\") is the watchdog: the system kills the app when the main thread doesn't respond in time during a transition like launch. The backtrace shows the main thread reading a file from `didFinishLaunchingWithOptions`. Older iPhones have slower storage and go over the limit. It's not a trap (`EXC_BREAKPOINT`) or an exception (`SIGABRT`), and a memory kill wouldn't produce a crash report.",
        },
        {
          kind: "explain",
          title: "dSYMs and symbolication",
          body: [
            "The binary that ships to the App Store has no readable function names: an unsymbolicated frame is just `Shop 0x0000000102b1c4a8 0x102b00000 + 115880`. The **dSYM** is the debug info file that maps addresses to function, file and line. Every build has a UUID and the dSYM has to match that exact UUID.",
            "In Release, `DEBUG_INFORMATION_FORMAT` must be `dwarf-with-dsym`. With Crashlytics or Sentry, the dSYM gets uploaded during the build or in CI (Crashlytics with its `upload-symbols` script, Sentry with `sentry-cli debug-files upload`). If a release didn't upload its dSYMs, its crashes stay unsymbolicated until you do.",
            "App Store crashes (Xcode Organizer) are symbolicated by Xcode as long as you have the archive. To symbolicate an address by hand there's `atos`.",
          ],
          code: `# Build Settings (Release)
DEBUG_INFORMATION_FORMAT = dwarf-with-dsym

# Is this dSYM from this build? Compare the UUID with the crash report's
dwarfdump --uuid Shop.app.dSYM

# Symbolicate one address: -l = the binary's load address
atos -arch arm64 -o Shop.app.dSYM/Contents/Resources/DWARF/Shop -l 0x102b00000 0x0000000102b1c4a8
# CartViewModel.removeItem(at:) (in Shop) (CartViewModel.swift:58)

# Upload dSYMs to Sentry from CI
sentry-cli debug-files upload build/Shop.xcarchive/dSYMs`,
        },
        {
          kind: "fill",
          prompt: "Complete the build setting value so the Release build produces a dSYM.",
          code: `DEBUG_INFORMATION_FORMAT = ____`,
          accept: ["^dwarf-with-dsym$"],
          hint: "In Xcode's UI it's called \"DWARF with dSYM File\".",
          explanation: "`dwarf-with-dsym` produces the `.dSYM` alongside the binary. With plain `dwarf` (the usual Debug setting) the info stays in the intermediate object files and you have nothing to upload to symbolicate production crashes.",
        },
        {
          kind: "write",
          prompt:
            "Rewrite `removeItem(at:)` so it can't crash: if the index is invalid or the price isn't in the cache, leave the total alone. Use `assertionFailure` so the bug shows up in Debug without killing the app in production.",
          starter: swift`func removeItem(at index: Int) {
    let item = items[index]
    let price = priceCache[item.sku]!
    totalCents -= price
    items.remove(at: index)
}`,
          checks: [
            { pattern: "guard\\s+items\\.indices\\.contains\\(index\\)", label: "Validates the index with `items.indices.contains(index)`" },
            { pattern: "(guard|if)\\s+let\\s+price\\s*=\\s*priceCache\\[", label: "Unwraps the price with `guard let` or `if let`" },
            { pattern: "assertionFailure\\(", label: "Flags it in Debug with `assertionFailure`" },
            { pattern: "items\\.remove\\(at:\\s*index\\)", label: "Still removes the item" },
          ],
          warnings: [
            { pattern: "\\]!", label: "There's still a force unwrap" },
            { pattern: "try!", label: "`try!` crashes just like `!`" },
          ],
          solution: swift`func removeItem(at index: Int) {
    guard items.indices.contains(index) else {
        assertionFailure("Invalid index: \(index) of \(items.count)")
        return
    }
    let item = items[index]
    guard let price = priceCache[item.sku] else {
        assertionFailure("No cached price for \(item.sku)")
        return
    }
    totalCents -= price
    items.remove(at: index)
}`,
          hint: "`assertionFailure` stops in Debug and does nothing in Release.",
        },
        {
          kind: "predict",
          prompt: "In one week: 200,000 users, 1,000,000 sessions. 2,000 sessions crashed, spread across 1,000 users. What's crash-free users?",
          code: `Users:                 200,000
Sessions:            1,000,000
Crashed sessions:        2,000
Users with a crash:      1,000`,
          options: ["99.8%", "99.0%", "99.9%", "99.5%"],
          answer: 3,
          explanation:
            "Crash-free users = users with no crash / total users = 199,000 / 200,000 = 99.5%. 99.8% is crash-free **sessions** (998,000 / 1,000,000). A user who crashes several times counts once for users and several times for sessions, so the two numbers tell different stories and you should watch both.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "logging-observability",
      title: "Logging, metrics and analytics",
      goal: "Log with `Logger` (levels, categories and privacy), measure intervals with signposts, receive metrics and diagnostics with MetricKit, and design analytics events that answer product questions.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "`Logger`: structured, cheap logs",
          body: [
            "`print` goes to stdout and nobody sees it in production. `Logger` (the `OSLog` framework) writes to the unified logging system: every message has a **subsystem** (usually your bundle id) and a **category** (an area of the app), and Console.app filters by both.",
            "Levels matter: `debug` for development detail, `info` for helpful context, `notice` (the default) for important events, `error` for errors and `fault` for states that should never happen. `debug` and `info` are very cheap and not persisted to disk by default; `notice`, `error` and `fault` are.",
            "The message is a special interpolation: it doesn't build the string unless someone reads it, so logging on hot paths is cheap. Keep your loggers in an extension so you don't repeat the subsystem.",
          ],
          code: swift`import OSLog

extension Logger {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "com.acme.shop"
    static let checkout = Logger(subsystem: subsystem, category: "checkout")
    static let network = Logger(subsystem: subsystem, category: "network")
}

func applyCoupon(_ code: String, to cart: Cart) {
    Logger.checkout.debug("Recalculating cart with \(cart.items.count) items")
    Logger.checkout.notice("Coupon applied")
    if cart.totalCents < 0 {
        Logger.checkout.fault("Negative total after coupon")
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the initializer for the payments screen's logger.",
          code: swift`static let payments = Logger(subsystem: "com.acme.shop", ____: "payments")`,
          accept: ["^category$"],
          hint: "It's what groups the logs of one area of the app.",
          explanation: "`Logger(subsystem:category:)`: the subsystem identifies your app or module and the category the area. In Console.app you filter with `category:payments`.",
        },
        {
          kind: "explain",
          title: "Privacy: logs are user data too",
          body: [
            "Logs end up in sysdiagnoses that users send to support. That's why `Logger` **redacts interpolated strings and objects by default**: in Console.app, without the debugger attached, you see `<private>`. Numbers and booleans are public by default.",
            "Mark as `.public` only what doesn't identify anyone and you need to diagnose: error codes, states, screen names. To correlate without exposing the value there's `.private(mask: .hash)`, which shows a hash instead of the data.",
            "Watch out: with Xcode's debugger attached everything is visible, so the problem never shows up during development. Check it in Console.app with the app launched by hand.",
          ],
          code: swift`func didLogin(email: String, userID: Int, plan: String) {
    Logger.auth.info("Login \(email) id=\(userID) plan=\(plan, privacy: .public)")
    Logger.auth.info("Login hash=\(email, privacy: .private(mask: .hash))")
}
// Console.app, no debugger:
// Login <private> id=48213 plan=premium`,
        },
        {
          kind: "predict",
          prompt: "The app runs without the debugger attached. What do you see in Console.app?",
          code: swift`let email = "ana@mail.com"
let amountCents = 4599
let reason = "card_declined"
Logger.payments.error("Payment failed for \(email) amount=\(amountCents) reason=\(reason, privacy: .public)")`,
          options: [
            "`Payment failed for ana@mail.com amount=4599 reason=card_declined`",
            "`Payment failed for <private> amount=<private> reason=card_declined`",
            "`Payment failed for <private> amount=4599 reason=card_declined`",
            "`Payment failed for <private> amount=<private> reason=<private>`",
          ],
          answer: 2,
          explanation:
            "The email is an unannotated `String`: private by default, shown as `<private>`. `amountCents` is an `Int`: scalars are public by default. `reason` is marked `.public`. Net result: only the email is hidden, which is exactly what you want.",
        },
        {
          kind: "explain",
          title: "Signposts and Console.app",
          body: [
            "A log tells you **what** happened; a **signpost** tells you **how long it took**. `OSSignposter` marks the start and end of an interval, and in Instruments (Points of Interest, or the os_signpost instrument) you see each interval on the timeline, lined up with CPU and main-thread activity.",
            "`beginInterval` returns a state you pass to `endInterval` with the same name. A `defer` makes sure the interval closes even if the function throws.",
            "To read logs: Console.app (enable Include Info/Debug Messages in the Action menu) with the device connected, or `log stream` in the terminal. On the simulator, `xcrun simctl spawn booted log stream`.",
          ],
          code: swift`let signposter = OSSignposter(logger: .feed)

func loadFeed() async throws -> [Post] {
    let state = signposter.beginInterval("loadFeed")
    defer { signposter.endInterval("loadFeed", state) }
    return try await api.fetchFeed()
}

// Terminal (simulator):
// xcrun simctl spawn booted log stream --level debug --predicate 'subsystem == "com.acme.shop"'`,
        },
        {
          kind: "fill",
          prompt: "Complete the line that closes the signpost interval.",
          code: swift`let state = signposter.beginInterval("decodeCatalog")
defer { signposter.____("decodeCatalog", state) }
return try decoder.decode(Catalog.self, from: data)`,
          accept: ["^endInterval$"],
          hint: "The counterpart of `beginInterval`.",
          explanation: "`endInterval(_:_:)` takes the same name and the state `beginInterval` returned. Inside `defer` it always runs, even if `decode` throws.",
        },
        {
          kind: "explain",
          title: "MetricKit and Xcode Organizer: what happens on real users' iPhones",
          body: [
            "Instruments measures your iPhone; **MetricKit** brings you what happens on your users'. You subscribe with `MXMetricManager.shared.add(_:)` and the system hands you `MXMetricPayload` (aggregates, usually covering the last 24 hours: launch time, hangs, memory, CPU, battery) and `MXDiagnosticPayload` (crashes, hangs, CPU and disk-write exceptions, with call stacks).",
            "Metrics arrive at most once a day; since iOS 15 diagnostics arrive on the next launch. Every payload has `jsonRepresentation()` so you can ship it as-is to your backend.",
            "**Xcode Organizer** shows the same sources aggregated per version for users who share data with developers: Crashes, Hangs, Launch Time, Memory, Disk Writes, Energy and Scrolling. It's the first stop after every release.",
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
            "Write `HangReporter`: it subscribes to MetricKit and, for each hang diagnostic, logs the duration (`hangDuration`) with `Logger.performance.error` and sends the call stack (`callStackTree.jsonRepresentation()`) with `uploader.send(_:)`.",
          starter: swift`import MetricKit
import OSLog

final class HangReporter {
    // subscribe to MetricKit and process hangs
}`,
          checks: [
            { pattern: "class\\s+HangReporter\\s*:\\s*NSObject\\s*,\\s*MXMetricManagerSubscriber", label: "Inherits from `NSObject` and conforms to `MXMetricManagerSubscriber`" },
            { pattern: "MXMetricManager\\.shared\\.add\\(self\\)", label: "Subscribes with `MXMetricManager.shared.add(self)`" },
            { pattern: "func\\s+didReceive\\(_\\s+payloads:\\s*\\[MXDiagnosticPayload\\]\\)", label: "Implements `didReceive(_:)` for `[MXDiagnosticPayload]`" },
            { pattern: "\\.hangDiagnostics", label: "Reads `hangDiagnostics`" },
            { pattern: "callStackTree\\.jsonRepresentation\\(\\)", label: "Sends the call stack with `callStackTree.jsonRepresentation()`" },
            { pattern: "Logger\\.performance\\.error\\(", label: "Logs with `Logger.performance.error`" },
          ],
          warnings: [{ pattern: "print\\(", label: "In production use `Logger`, not `print`" }],
          solution: swift`import MetricKit
import OSLog

final class HangReporter: NSObject, MXMetricManagerSubscriber {
    func start() {
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            for hang in payload.hangDiagnostics ?? [] {
                Logger.performance.error("Hang of \(hang.hangDuration, privacy: .public)")
                uploader.send(hang.callStackTree.jsonRepresentation())
            }
        }
    }
}`,
          hint: "`hangDiagnostics` is optional: `?? []`.",
        },
        {
          kind: "explain",
          title: "Analytics: events that answer questions",
          body: [
            "An event is only useful if it answers a product question. Use consistent `object_action` names in past tense (`paywall_viewed`, `purchase_completed`), typed properties and never personal data. Model them as an `enum` so the compiler catches typos.",
            "A **funnel** is a sequence of events: `onboarding_completed` → `paywall_viewed` → `purchase_started` → `purchase_completed`. If purchases drop, the funnel tells you at which step people leave.",
            "In an **A/B test** the variant comes from a remote feature flag. Log the **exposure** when the user actually sees the variant (with the variant as a property), not when it's assigned; otherwise you compare groups full of people who never saw the change.",
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
          prompt: "The `paywall_layout` flag is assigned at app launch, but only 40% of users ever reach the paywall. Where do you log the A/B test exposure event?",
          code: swift`// AppDelegate
let variant = flags.string("paywall_layout", default: "control")

// PaywallView
.onAppear { /* ... */ }`,
          options: [
            "In `PaywallView.onAppear`, with the variant as a property",
            "In the `AppDelegate`, when the flag is assigned",
            "On `purchase_completed`, since that's what matters",
            "In both places, to get more data",
          ],
          answer: 0,
          explanation:
            "Exposure is the moment the user sees the variant. Log it at assignment and the 60% who never reached the paywall dilute both groups, hiding the real effect. Logging only the purchase gives you no denominator. Logging in both places double-counts and muddies the metric.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "instruments-performance",
      title: "Performance with Instruments",
      goal: "Measure before optimizing with Time Profiler, Hangs and Animation Hitches, cut launch time, fix a list's scrolling and understand when a SwiftUI view gets re-evaluated.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "Measure before you optimize",
          body: [
            "Performance intuition is wrong a lot. Measure with **Product → Profile** (⌘I): it builds for **Release** and runs on a **real device**, because the simulator uses your Mac's CPU and Debug doesn't optimize.",
            "**Time Profiler** samples what each thread is running every few milliseconds. In the call tree, enable **Hide System Libraries** and **Invert Call Tree** to put your most expensive functions on top, and select the problem's time range on the timeline.",
            "The per-frame budget is `1000 / Hz` milliseconds: 16.67 ms at 60 Hz and 8.33 ms at 120 Hz (ProMotion). Everything you do on the main thread while scrolling competes for that budget.",
          ],
          code: swift`// Time Profiler flags this as the most expensive function while scrolling
func configure(with post: Post) {
    let formatter = DateFormatter()          // creating a DateFormatter is expensive
    formatter.dateStyle = .medium
    dateLabel.text = formatter.string(from: post.date)

    let data = try? Data(contentsOf: post.avatarURL)   // synchronous I/O on the main thread
    avatarView.image = data.flatMap(UIImage.init(data:))
}`,
        },
        {
          kind: "predict",
          prompt: "Your app runs on an iPhone with a 120 Hz display. What's the most time you have to produce each frame without a visible stutter?",
          code: swift`let refreshRate = 120.0
let budget = 1000 / refreshRate`,
          options: ["16.67 ms", "8.33 ms", "33.33 ms", "4.17 ms"],
          answer: 1,
          explanation:
            "1000 ms / 120 = 8.33 ms per frame. 16.67 ms is the 60 Hz budget. If committing a frame goes over budget, the frame is delivered late: that's a hitch, and the user sees it as a stutter.",
        },
        {
          kind: "explain",
          title: "Hangs and hitches",
          body: [
            "A **hang** is when the main thread doesn't respond to events for a time the user notices: you tap and nothing happens. Typical causes are synchronous disk or network I/O, parsing large JSON, locks and `DispatchQueue.main.sync`. The **Hangs** instrument marks them on the timeline and Xcode Organizer groups them by backtrace in production.",
            "A **hitch** is a frame that arrives late during an animation or a scroll. The **Animation Hitches** instrument shows which ones and whether the problem was your code on the main thread (commit) or rendering.",
            "The fix is almost always the same: heavy work moves off the main thread (to an `actor` or a `Task.detached`) and the main thread only applies the result.",
          ],
          code: swift`@MainActor
func showReport() {
    let data = try? Data(contentsOf: reportURL)                     // disk on main
    let rows = (try? JSONDecoder().decode([Row].self, from: data ?? Data())) ?? []
    render(rows)                                                    // the only thing that belongs on main
}`,
        },
        {
          kind: "write",
          prompt:
            "Fix `configure(with:)`: don't create a `DateFormatter` per cell (use `formatted(date:time:)` or a `static` formatter) and load the avatar asynchronously with `await` instead of reading it synchronously. Assume `ImageLoader.shared.image(for:) async -> UIImage?` exists.",
          starter: swift`func configure(with post: Post) {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    dateLabel.text = formatter.string(from: post.date)

    let data = try? Data(contentsOf: post.avatarURL)
    avatarView.image = data.flatMap(UIImage.init(data:))
}`,
          checks: [
            { pattern: "\\.formatted\\(|static\\s+let\\s+\\w+\\s*(:\\s*DateFormatter)?\\s*=", label: "Formats with `formatted(...)` or a reused `static` formatter" },
            { pattern: "await\\s+ImageLoader\\.shared\\.image\\(for:", label: "Loads the avatar with `await ImageLoader.shared.image(for:)`" },
            { pattern: "Task\\s*\\{", label: "Starts the load in a `Task`" },
          ],
          warnings: [
            { pattern: "Data\\(contentsOf:", label: "`Data(contentsOf:)` blocks the main thread" },
            { pattern: "let\\s+formatter\\s*=\\s*DateFormatter\\(\\)", label: "Still creates a `DateFormatter` per cell" },
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
          hint: "Cells get reused: cancel the previous task before starting a new one.",
        },
        {
          kind: "explain",
          title: "Launch time",
          body: [
            "A **cold launch** is when the process isn't in memory (after a reboot or after the system evicted it): it's the worst case and the one to measure. A **warm launch** reuses some of what was already loaded. Coming back from the background isn't a launch.",
            "Launch covers what happens before `main` (loading the binary and dynamic frameworks, static initializers) and from `main` to the **first frame**: `didFinishLaunchingWithOptions`, the scene and the first screen's `body`. All of it runs on the main thread, and if it takes too long the watchdog steps in.",
            "Rule of thumb: before the first frame, only what's essential (the crash reporter, which has to be ready before any crash). Everything else (analytics, cache cleanup, prefetching) gets deferred. Measure it with `XCTApplicationLaunchMetric` and track it in the Organizer.",
          ],
          code: swift`func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    CrashReporter.start()                 // yes: before anything else
    Task(priority: .utility) {
        await AnalyticsSDK.configure()    // deferred: not needed for the first frame
        await ImageCache.shared.trimDisk()
    }
    return true
}

// Performance UI test
func testLaunchPerformance() {
    measure(metrics: [XCTApplicationLaunchMetric()]) {
        XCUIApplication().launch()
    }
}`,
        },
        {
          kind: "predict",
          prompt: "You're trimming `didFinishLaunchingWithOptions`. Which of these tasks should stay synchronous, before the first frame?",
          code: swift`// Today, all synchronous in didFinishLaunchingWithOptions:
// 1. Clean old images from the disk cache
// 2. Configure the analytics SDK
// 3. Start the crash reporter
// 4. Prefetch the whole catalog from the network`,
          options: [
            "Cleaning the disk cache",
            "Configuring analytics",
            "Starting the crash reporter",
            "Prefetching the catalog",
          ],
          answer: 2,
          explanation:
            "The crash reporter has to be installed before anything can crash, including the rest of launch; defer it and you lose exactly the startup crashes. Cache cleanup and analytics can wait until after the first frame. Prefetching the catalog from the network should never block launch.",
        },
        {
          kind: "explain",
          title: "SwiftUI: why was this view re-evaluated?",
          body: [
            "In SwiftUI the cost lies in how often `body` is evaluated and how much work it does. `Self._printChanges()` inside `body` prints to the console what changed and triggered the evaluation (`@self`, `@identity` or a property name). It's an underscored API: debugging only, never leave it in production.",
            "With `ObservableObject`, any `@Published` change invalidates **every** view observing the object. With `@Observable` (iOS 17) SwiftUI tracks which properties each `body` read and only re-evaluates views that read the property that changed.",
            "In lists, use stable ids (`Identifiable` with an id from the model, not the index) and keep heavy work out of `body`: formatting, filtering and sorting are precomputed. The SwiftUI instrument in Instruments shows how many times each `body` was evaluated and how long it took.",
          ],
          code: swift`struct CounterView: View {
    @State private var count = 0

    var body: some View {
        let _ = Self._printChanges()
        Button("Add: \(count)") { count += 1 }
    }
}
// Console after tapping the button: CounterView: _count changed.`,
        },
        {
          kind: "fill",
          prompt: "Complete the debugging line that prints what triggered the `body` evaluation.",
          code: swift`var body: some View {
    let _ = Self.____()
    List(viewModel.items) { ItemRow(item: $0) }
}`,
          accept: ["^_printChanges$"],
          hint: "It starts with an underscore.",
          explanation: "`Self._printChanges()` prints what changed in the view. The `let _ =` is needed because `body` is a view builder and won't take a bare call returning `Void`.",
        },
        {
          kind: "predict",
          prompt: "`NameLabel` only reads `model.name`. `model.cartCount += 1` runs. Is `NameLabel`'s `body` re-evaluated in each version?",
          code: swift`// Version A
final class ProfileModel: ObservableObject {
    @Published var name = "Ana"
    @Published var cartCount = 0
}

// Version B
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
            "In neither: `name` didn't change",
            "In both: the model changed",
            "Only in B: `@Observable` invalidates the whole model",
            "Only in A: `ObservableObject` notifies every observer for any `@Published`",
          ],
          answer: 3,
          explanation:
            "`ObservableObject` fires `objectWillChange` for any `@Published`, so every view observing it is re-evaluated even if it never reads `cartCount`. `@Observable` records that `NameLabel` only read `name`, so changing `cartCount` doesn't touch it. On big screens that difference shows up in scrolling.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: a hang and a crash in production",
      goal: "Diagnose a hang and a crash from production data, fix both in code and leave the screen instrumented for next time.",
      minutes: 30,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "Shop 3.5 is out. In the Organizer, the top Hang points at the Orders screen, and Crashlytics has a new top-1 crash, also in Orders. Support says: \"it's slow to open and sometimes closes when I tap an order right after refreshing\".",
            "The orders cache is a multi-MB JSON file on disk, parsed in `load()`. Pull-to-refresh replaces `orders` with the new list, which may have fewer items, while the cell you tapped still holds the old index.",
            "Below are the code and the crash report. You'll read the crash, move parsing off the main thread, fix selection and add logs and signposts so next time you don't have to guess.",
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
          prompt: "Reading the crash report and the code, what's causing the crash?",
          code: `Exception Type:  EXC_BREAKPOINT (SIGTRAP)
0   libswiftCore.dylib  _assertionFailure(_:_:file:line:flags:) + 264
1   Shop                OrdersViewModel.select(at:) + 88 (OrdersViewModel.swift:27)`,
          options: [
            "`orders[index]` with a stale index that went out of range after the refresh",
            "A bug in `libswiftCore`, since it's frame 0",
            "The `try!` on `JSONDecoder` in `load()`",
            "The watchdog, because `load()` blocks the main thread",
          ],
          answer: 0,
          explanation:
            "Frame 0 is the runtime function that fires the trap; your app's first frame is `select(at:)` on line 27, which is `orders[index]`. It matches the story: the refresh shrinks the list and the cell keeps an index that no longer exists. The `try!` in `load()` is in a different function, and a watchdog kill would be `SIGKILL` with `0x8badf00d`, not `EXC_BREAKPOINT`.",
        },
        {
          kind: "write",
          prompt:
            "Move parsing off the main thread: `load()` becomes `async`, reads and decodes inside a `Task.detached` (or an `actor`) and only assigns `orders` on the main actor. No `try!`: if it fails, log the error with `Logger.orders.error` and leave the list as it was.",
          starter: swift`func load() {
    let data = try! Data(contentsOf: Self.cacheURL)
    orders = try! JSONDecoder().decode([Order].self, from: data)
}`,
          checks: [
            { pattern: "func\\s+load\\(\\)\\s+async", label: "`load()` is `async`" },
            { pattern: "Task\\.detached|actor\\s+\\w+", label: "Heavy work runs off the main thread (`Task.detached` or an `actor`)" },
            { pattern: "try\\s+await", label: "Awaits the result with `try await`" },
            { pattern: "catch", label: "Handles the error with `catch`" },
            { pattern: "Logger\\.orders\\.error\\(", label: "Logs the error with `Logger.orders.error`" },
          ],
          warnings: [
            { pattern: "try!", label: "`try!` crashes if the file is missing or the JSON changed" },
            { pattern: "DispatchQueue\\.main\\.sync", label: "`DispatchQueue.main.sync` blocks and can deadlock" },
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
        Logger.orders.error("Couldn't read the cache: \(error.localizedDescription, privacy: .public)")
    }
}`,
          hint: "Copy `Self.cacheURL` into a constant before the `Task.detached` and return `[Order]` from the closure (it must be `Sendable`).",
        },
        {
          kind: "write",
          prompt:
            "Fix selection: instead of an index, `select(id:)` takes the order's id and looks it up in the current list. If it's gone, don't crash: log a `notice` with `Logger.orders` and leave `selected` unchanged.",
          starter: swift`func select(at index: Int) {
    selected = orders[index]
}`,
          checks: [
            { pattern: "func\\s+select\\(id:", label: "The function takes an id: `select(id:)`" },
            { pattern: "first\\(where:", label: "Finds the order with `first(where:)`" },
            { pattern: "guard\\s+let|if\\s+let", label: "Unwraps the result safely" },
            { pattern: "Logger\\.orders\\.notice\\(", label: "Logs the case with `Logger.orders.notice`" },
          ],
          warnings: [
            { pattern: "orders\\[index\\]", label: "Still indexing into the array" },
            { pattern: "\\)!", label: "There's a force unwrap" },
          ],
          solution: swift`func select(id: Order.ID) {
    guard let order = orders.first(where: { $0.id == id }) else {
        Logger.orders.notice("Order \(id, privacy: .public) is no longer in the list")
        return
    }
    selected = order
}`,
          hint: "An id survives a refresh; an index doesn't.",
        },
        {
          kind: "write",
          prompt:
            "Instrument `load()` for next time: define `Logger.orders` with `Logger(subsystem:category:)`, create an `OSSignposter` and wrap the load in a `\"loadOrders\"` interval. When done, log the order count at `info` level, marked `.public`.",
          starter: swift`extension Logger {
    // static let orders = ...
}

func load() async {
    // ... load from the previous step
}`,
          checks: [
            { pattern: "static\\s+let\\s+orders\\s*=\\s*Logger\\(subsystem:", label: "Defines `Logger.orders` with `Logger(subsystem:category:)`" },
            { pattern: "OSSignposter\\(", label: "Creates an `OSSignposter`" },
            { pattern: "beginInterval\\(\"loadOrders\"", label: "Opens the `loadOrders` interval" },
            { pattern: "endInterval\\(\"loadOrders\"", label: "Closes the `loadOrders` interval" },
            { pattern: "privacy:\\s*\\.public", label: "Marks the count as `.public`" },
          ],
          warnings: [{ pattern: "print\\(", label: "In production use `Logger`, not `print`" }],
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
        Logger.orders.info("Orders loaded: \(loaded.count, privacy: .public)")
    } catch {
        Logger.orders.error("Couldn't read the cache: \(error.localizedDescription, privacy: .public)")
    }
}`,
          hint: "The `defer` closes the interval even if the load fails.",
        },
        {
          kind: "predict",
          prompt: "3.5.1 ships with both fixes. How do you confirm they worked in production?",
          code: `3.5   → Orders hangs: top 1   | select(at:) crash: top 1
3.5.1 → ?`,
          options: [
            "Try it on your iPhone: if it doesn't hang, it's fixed",
            "Wait until support stops getting complaints",
            "Compare per version in the Organizer (Hangs) and Crashlytics (crash-free users and that issue), plus MetricKit hang diagnostics",
            "Add a `print` in `load()` and check the console",
          ],
          answer: 2,
          explanation:
            "Your iPhone is one fast device with test data: the problem showed up on others. What confirms the fix is aggregated per-version data: the issue doesn't appear in 3.5.1, crash-free users goes up and the Orders hangs drop out of the top. Support is a slow signal, and nobody sees a `print` in production.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "lldb-v-p-po",
      front: "What's the difference between `v`, `p` and `po` in LLDB?",
      back: "`v` reads frame variables without running code (fast, no side effects). `p` evaluates an expression and shows the value with its type. `po` evaluates and shows the object's description (`debugDescription` if present). To change state: `expr`.",
    },
    {
      id: "log-breakpoint",
      front: "How do you log a value without adding `print` or stopping the app?",
      back: "A breakpoint with a Log Message action (or an LLDB command like `po total`) and Automatically continue after evaluating actions enabled.",
    },
    {
      id: "symbolic-breakpoint",
      front: "What's a symbolic breakpoint on `UIViewAlertForUnsatisfiableConstraints` for?",
      back: "It stops right when Auto Layout breaks a constraint, with a backtrace showing which view caused it. Symbolic breakpoints stop on a symbol, even in code you don't own.",
    },
    {
      id: "main-thread-checker",
      front: "What does the Main Thread Checker catch?",
      back: "UIKit/AppKit APIs used from a thread other than main. It stops on the line with a message like `UI API called on a background thread`. For data races in general there's Thread Sanitizer.",
    },
    {
      id: "image-memory",
      front: "How much memory does a decoded image take?",
      back: "`width × height × 4` bytes (RGBA), no matter how big the file is. A 4032 × 3024 photo is about 49 MB.",
      code: "4032 * 3024 * 4 = 48_771_072 bytes",
    },
    {
      id: "downsampling",
      front: "What is downsampling and which API does it?",
      back: "Decoding the image straight to the pixel size it's displayed at. With ImageIO: `CGImageSourceCreateThumbnailAtIndex` and `kCGImageSourceThumbnailMaxPixelSize` (or `preparingThumbnail(of:)` on iOS 15+).",
    },
    {
      id: "leaks-vs-allocations",
      front: "Leaks shows nothing, but memory grows every time you open and close a screen. What now?",
      back: "Allocations with Mark Generation: mark, open and close the screen, mark again. If each generation leaves live objects behind, that's abandoned memory (e.g. a cycle reachable from a singleton), which Leaks doesn't report.",
    },
    {
      id: "exc-breakpoint",
      front: "What does `EXC_BREAKPOINT (SIGTRAP)` usually mean in a Swift app?",
      back: "A runtime trap: force unwrapping `nil`, index out of range, overflow, `try!` or `fatalError`. It's deterministic; look for your app's first frame.",
    },
    {
      id: "exc-bad-access",
      front: "What does `EXC_BAD_ACCESS` with `KERN_INVALID_ADDRESS` usually mean?",
      back: "Invalid memory access. In Swift, almost always a data race, `Unsafe` code or C/Objective-C. It's intermittent; reproduce it with Thread Sanitizer or Address Sanitizer.",
    },
    {
      id: "watchdog",
      front: "What does `0x8badf00d` mean in a crash report?",
      back: "The watchdog killed the app (`SIGKILL`) because the main thread didn't respond in time, typically due to synchronous work (disk, network, parsing) during launch.",
    },
    {
      id: "dsym",
      front: "What is a dSYM and what happens if it's missing?",
      back: "The debug info file that maps addresses to function, file and line. It's matched to the build by UUID. If it wasn't uploaded, that version's crashes stay as hex addresses.",
    },
    {
      id: "crash-free",
      front: "What's the difference between crash-free users and crash-free sessions?",
      back: "Users: share of users with no crash in the period. Sessions: share of sessions without a crash. A user who crashes many times counts once for users and many times for sessions.",
    },
    {
      id: "logger-privacy",
      front: "What does an interpolated `String` in a `Logger` message show by default, without a debugger?",
      back: "`<private>`. Strings and objects are private by default; numbers and booleans are public. Mark with `privacy: .public` only what doesn't identify anyone.",
      code: "Logger.payments.error(\"Failed \\(code, privacy: .public) for \\(email)\")",
    },
    {
      id: "metrickit",
      front: "What does MetricKit give you?",
      back: "With `MXMetricManager.shared.add(_:)` you receive `MXMetricPayload` (aggregated metrics, usually once a day) and `MXDiagnosticPayload` (crashes, hangs, CPU and disk-write exceptions, with call stacks) from your users' devices.",
    },
    {
      id: "print-changes",
      front: "How do you find out why a SwiftUI view's `body` was re-evaluated?",
      back: "With `let _ = Self._printChanges()` inside `body`: it prints what changed (`@self`, `@identity` or the property name). Debugging only.",
    },
  ],

  exam: [
    {
      id: "exam-conditional-log",
      question: "A bug only shows up when the cart has more than 100 items, inside a loop that runs thousands of times. You want to see `subtotal` on each problematic iteration without stopping the app or touching the code. What do you use?",
      code: swift`for item in cart.items {
    subtotal += item.priceCents * item.quantity   // line 77
}`,
      options: [
        "A `print` in the loop guarded by `#if DEBUG`",
        "A breakpoint on line 77 with condition `cart.items.count > 100`, action `po subtotal` and Automatically continue",
        "A symbolic breakpoint on `+=`",
        "An exception breakpoint",
      ],
      answer: 1,
      explanation:
        "The condition filters to the cases that matter, the action logs the value and auto-continue keeps the app from stopping thousands of times. No code to change or commit. A symbolic breakpoint on `+=` would stop all over the process, and no exception is involved.",
    },
    {
      id: "exam-memory-graph",
      question: "You enter and leave the product screen five times. The Memory Graph shows five live `ProductViewController` instances, each retained by a closure stored in its `ProductViewModel`. What's the fix?",
      code: swift`viewModel.onPriceChange = { price in
    self.priceLabel.text = price
}`,
      options: [
        "Set `viewModel = nil` in `viewDidLoad`",
        "Make `viewModel` `weak`",
        "Move the closure to `viewWillAppear`",
        "Capture `[weak self]` in the closure",
      ],
      answer: 3,
      explanation:
        "The cycle is `self` → `viewModel` → closure → `self`. `[weak self]` keeps the closure from retaining the screen. A `weak` `viewModel` would be freed immediately since nobody else holds it. Moving it to `viewWillAppear` creates the same cycle, just at a different time.",
    },
    {
      id: "exam-image-memory",
      question: "A feed shows 4000 × 3000 photos in 80 × 80 pt thumbnails. After scrolling for a while, the app closes with no crash report. What's most likely going on, and how do you fix it?",
      options: [
        "The system killed it for memory: each decoded image takes about 48 MB; downsample to the displayed size with ImageIO",
        "A data race in the image cache; use an `actor`",
        "The watchdog, because images are downloaded on the main thread",
        "A force unwrap in the cell; use `guard let`",
      ],
      answer: 0,
      explanation:
        "4000 × 3000 × 4 = 48,000,000 bytes per decoded image, to display 240 × 240 pixels at @3x. A handful in memory and the system kills the app (jetsam), which leaves no crash report from your code. A force unwrap or a data race would leave a crash report.",
    },
    {
      id: "exam-unsymbolicated",
      question: "Version 4.2's crashes in Crashlytics look like this, while 4.1's show functions and lines. What happened?",
      code: `0   Shop    0x0000000104a1c4a8 0x104a00000 + 115880
1   Shop    0x0000000104a1b9f0 0x104a00000 + 113136`,
      options: [
        "4.2 was built in Debug",
        "Crashlytics doesn't support those users' iOS version",
        "The dSYMs for that build weren't uploaded (or don't match by UUID)",
        "The crash happened in a system framework",
      ],
      answer: 2,
      explanation:
        "Without the dSYM for that exact build there's no way to map addresses to symbols. The frames belong to `Shop`, so it's your binary, not the system. The fix is uploading 4.2's dSYMs (from the archive or App Store Connect) and automating the upload in CI.",
    },
    {
      id: "exam-watchdog",
      question: "A crash report says `EXC_CRASH (SIGKILL)` and the termination reason includes `0x8badf00d`. The main thread is in `JSONDecoder.decode`, called from `scene(_:willConnectTo:options:)`. What happened?",
      options: [
        "The JSON was malformed and `decode` crashed",
        "The system killed the app for using too much memory",
        "The watchdog killed the app because the main thread was blocked parsing during launch",
        "A force unwrap on the result of `decode`",
      ],
      answer: 2,
      explanation:
        "`0x8badf00d` is the watchdog's signature: the system expects the app to finish launching and respond within a reasonable time. Parsing synchronously on the main thread while connecting the scene prevents that. Invalid JSON throws an error (or `EXC_BREAKPOINT` with `try!`), not `SIGKILL`.",
    },
    {
      id: "exam-bad-access",
      question: "An intermittent `EXC_BAD_ACCESS (SIGSEGV)` shows up, always on a background thread, inside `Dictionary`. Several tasks write to `ImageCache.storage`, a plain class holding a `[URL: UIImage]`. What do you do?",
      options: [
        "Reproduce it with Thread Sanitizer and protect the state, e.g. by turning `ImageCache` into an `actor`",
        "Add `[weak self]` to every closure",
        "Wrap the access in `do/catch`",
        "Swap the dictionary for an array",
      ],
      answer: 0,
      explanation:
        "Concurrent unsynchronized writes to a `Dictionary` are a data race: they corrupt memory and crash anywhere. Thread Sanitizer catches it and an `actor` serializes access (Swift 6 also flags it at compile time). `do/catch` can't catch invalid memory access, and `weak` is unrelated.",
    },
    {
      id: "exam-logger-privacy",
      question: "Support needs to see the error code for failed payments in sysdiagnoses, but the user's email must never show up. Which log is right?",
      options: [
        "`logger.error(\"Payment failed \\(code) \\(email, privacy: .public)\")`",
        "`print(\"Payment failed \\(code) \\(email)\")`",
        "`logger.error(\"Payment failed \\(code, privacy: .private) \\(email, privacy: .private)\")`",
        "`logger.error(\"Payment failed \\(code, privacy: .public) \\(email)\")`",
      ],
      answer: 3,
      explanation:
        "The code (a `String` like `card_declined`) is private by default, so it has to be marked `.public`. The unannotated email stays `<private>`. `print` doesn't reach the system logs the same way and has no privacy, and the other options either expose the email or hide the code.",
    },
    {
      id: "exam-metrickit",
      question: "You want the call stacks of the hangs your users hit, to send to your backend. Where do they come from?",
      options: [
        "From `MXMetricPayload.applicationResponsivenessMetrics`",
        "From `MXDiagnosticPayload.hangDiagnostics`, via `callStackTree`",
        "From `Logger`, reading logs with `OSLogStore`",
        "From the Hangs instrument, by connecting the user's iPhone",
      ],
      answer: 1,
      explanation:
        "Diagnostics (`MXDiagnosticPayload`) carry concrete events with call stacks: `hangDiagnostics`, `crashDiagnostics`, etc. Metrics (`MXMetricPayload`) are aggregates, like hang duration histograms, with no stacks. Instruments only works with a device connected to your Mac.",
    },
    {
      id: "exam-funnel",
      question: "After a release, purchases dropped 30%. You have `onboarding_completed`, `paywall_viewed`, `purchase_started` and `purchase_completed` events. What do you look at first?",
      options: [
        "Conversion between each pair of funnel steps, old version vs new, to see which step drops",
        "Total event count per day",
        "Crash-free users for the new version",
        "Logs from a randomly picked user",
      ],
      answer: 0,
      explanation:
        "The funnel tells you where people leave: if `paywall_viewed` → `purchase_started` is flat but `purchase_started` → `purchase_completed` dropped, the problem is in the purchase flow, not the paywall. Daily totals don't localize anything, and crash-free only covers one of many possible causes.",
    },
    {
      id: "exam-measure-first",
      question: "QA reports the feed's scrolling \"feels janky\" on an older iPhone. A teammate suggests rewriting the cells in SwiftUI. What's the first step?",
      options: [
        "Rewrite the cells in SwiftUI, it's faster",
        "Lower the image quality",
        "Profile a Release build on that device with Time Profiler and Animation Hitches to see what work goes over budget",
        "Test on the simulator in Debug to iterate faster",
      ],
      answer: 2,
      explanation:
        "Without measuring you're guessing: it could be a `DateFormatter` per cell, I/O on the main thread or images without downsampling, and a rewrite wouldn't fix any of those. Profile in Release on a real device; the simulator uses the Mac's CPU and Debug doesn't optimize.",
    },
    {
      id: "exam-launch",
      question: "Your `didFinishLaunchingWithOptions` does all of this synchronously. To cut launch time without losing information, which combination is right?",
      code: swift`CrashReporter.start()
AnalyticsSDK.configure()
try? FileManager.default.removeItem(at: oldCacheURL)
RemoteConfig.fetchAndWait()   // waits on the network`,
      options: [
        "Defer everything to a `Task`, crash reporter included",
        "Keep `CrashReporter.start()` synchronous and defer the rest; don't wait on the network before the first frame (use defaults or cached values)",
        "Leave it as is but test on a newer iPhone",
        "Move everything to the first screen's `viewDidLoad`",
      ],
      answer: 1,
      explanation:
        "The crash reporter has to be ready before any crash. Analytics and cleanup can wait. Waiting on the network at launch is the worst: it depends on connectivity and can trigger the watchdog. Moving it to `viewDidLoad` still runs before the first frame.",
    },
    {
      id: "exam-list-identity",
      question: "Every time a new message arrives at the top of the list, all rows are recreated and lose their local state. `Self._printChanges()` in `MessageRow` shows `@identity` on all of them. What's the cause?",
      code: swift`ForEach(Array(messages.enumerated()), id: \.offset) { _, message in
    MessageRow(message: message)
}`,
      options: [
        "`MessageRow` should be a class",
        "`Self._printChanges()` is missing from the parent view",
        "`ForEach` doesn't support `enumerated()`",
        "Identity is the index: inserting at the top changes every row's identity; use a stable model id (`Identifiable`)",
      ],
      answer: 3,
      explanation:
        "With `id: \\.offset`, the message at position 0 moves to 1 and SwiftUI thinks every row is a different one: it tears them down and recreates them, state included. With `ForEach(messages)` and `Message: Identifiable` (a server id), only the new row is inserted.",
    },
  ],
};

export default content;
