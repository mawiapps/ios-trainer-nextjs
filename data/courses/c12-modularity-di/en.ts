import type { CourseContent } from "../types";

const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "xcode-anatomy",
      title: "Anatomy of an Xcode project",
      goal: "Understand targets, schemes, build settings, build phases, `Info.plist` and entitlements, and why `project.pbxproj` is the number one source of merge conflicts.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Targets, products and schemes",
          body: [
            "A **target** is a recipe for producing one binary: the app, an extension (widget, notifications), a framework or a test bundle. Each target has its own source files (target membership), build settings, `Info.plist` and entitlements.",
            "A **scheme** doesn't build anything on its own: it says *which* targets get built, which configuration (`Debug`/`Release`) runs, which test plan is used and which environment variables and launch arguments the app starts with.",
            "Before modularizing, know what you have. `xcodebuild -list` shows the project's targets, configurations and schemes; it's the first thing you run when you join a new repo or set up a CI pipeline.",
          ],
          code: swift`$ xcodebuild -list -project Shop.xcodeproj
Information about project "Shop":
    Targets:
        Shop
        ShopWidget
        ShopTests

    Build Configurations:
        Debug
        Release

    Schemes:
        Shop
        ShopWidget`,
        },
        {
          kind: "predict",
          prompt: "The app saves the latest order to an App Group. The widget reads it with the same `suiteName`, but always shows \"No orders\". Look at each target's entitlements. What's going on?",
          code: swift`// Shop.entitlements  (Shop target)
com.apple.security.application-groups = [ "group.com.acme.shop" ]

// ShopWidget.entitlements  (ShopWidget target)
// (empty)

// In the widget:
let defaults = UserDefaults(suiteName: "group.com.acme.shop")
let last = defaults?.string(forKey: "lastOrder") ?? "No orders"`,
          options: [
            "Widgets can't use `UserDefaults`: they have to use Core Data",
            "`suiteName` only works in the main target",
            "The widget target lacks the App Groups capability: it reads its own container and finds nothing",
            "You need to call `synchronize()` after writing in the app",
          ],
          answer: 2,
          explanation: "Capabilities are **per target**. The app writes to the group's shared container, but the widget, without the `com.apple.security.application-groups` entitlement, has no access to it and ends up reading an empty container of its own. The fix is adding the App Groups capability to the `ShopWidget` target with the same identifier. `synchronize()` is deprecated and unrelated.",
        },
        {
          kind: "explain",
          title: "Build settings and `.xcconfig`",
          body: [
            "Every build setting is resolved in levels, strongest to weakest: target, target `.xcconfig`, project, project `.xcconfig` and platform defaults. That's why a value set \"by hand\" on the target silently overrides the `.xcconfig` one and nobody knows why.",
            "`$(inherited)` means \"whatever comes from the level below, plus this\". If you write `SWIFT_ACTIVE_COMPILATION_CONDITIONS = STAGING` without `$(inherited)`, you wipe the inherited `DEBUG` and your `#if DEBUG` blocks stop compiling the way you expect.",
            "Serious teams move settings into `.xcconfig` files: plain text, reviewable in a PR, not buried in `project.pbxproj`. Watch out: in `.xcconfig`, `//` starts a comment, so a URL gets cut to `https:`. The classic trick is `https:/$()/`.",
          ],
          code: swift`// Shared.xcconfig
SWIFT_VERSION = 6.0
IPHONEOS_DEPLOYMENT_TARGET = 17.0

// Debug.xcconfig
#include "Shared.xcconfig"
SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) DEBUG
API_BASE_URL = https:/$()/api.dev.acme.com
OTHER_SWIFT_FLAGS = $(inherited) -Xfrontend -warn-long-function-bodies=200`,
        },
        {
          kind: "fill",
          prompt: "Fill in the blank to add `STAGING` without losing the conditions coming from lower levels (like `DEBUG`).",
          code: swift`SWIFT_ACTIVE_COMPILATION_CONDITIONS = ____ STAGING`,
          accept: ["^\\$\\(inherited\\)$", "^\\$\\{inherited\\}$"],
          explanation: "`$(inherited)` expands the value from the previous level. Without it, the line replaces everything and `DEBUG` disappears: `#if DEBUG` blocks are skipped and QA's debug menu vanishes from the staging build.",
          hint: "It's a special build settings variable, with `$` and parentheses.",
          placeholder: "variable",
        },
        {
          kind: "explain",
          title: "Build phases, `Info.plist` and entitlements",
          body: [
            "**Build phases** are the target's steps, in order: dependencies, Compile Sources, Link Binary With Libraries, Copy Bundle Resources, Embed Frameworks and whatever Run Scripts the team adds (SwiftLint, code generation). In projects created with Xcode 15 or later, `ENABLE_USER_SCRIPT_SANDBOXING` is `YES`: a script that reads files has to declare them as input files.",
            "`Info.plist` can be a file or be generated with `GENERATE_INFOPLIST_FILE = YES` plus `INFOPLIST_KEY_*` settings. Permission strings (`NSCameraUsageDescription`) live there: if one is missing, the system **kills the app** when it asks for that permission.",
            "**Entitlements** (an `.entitlements` file referenced by `CODE_SIGN_ENTITLEMENTS`) declare signed capabilities: push, App Groups, Keychain Sharing, Sign in with Apple. They must match the provisioning profile or code signing fails.",
          ],
          code: swift`// Shop target build settings
GENERATE_INFOPLIST_FILE = YES
INFOPLIST_KEY_NSCameraUsageDescription = We use the camera to scan barcodes.
CODE_SIGN_ENTITLEMENTS = Shop/Shop.entitlements

<!-- Shop/Shop.entitlements -->
<dict>
    <key>aps-environment</key>
    <string>development</string>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.acme.shop</string>
    </array>
</dict>`,
        },
        {
          kind: "predict",
          prompt: "A dev adds a barcode scanner. They never tried it on the simulator (no camera). On an iPhone, what happens when the user taps \"Scan\"?",
          code: swift`// Info.plist: no NSCameraUsageDescription

Button("Scan") {
    Task {
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        print(granted)
    }
}`,
          options: [
            "The app crashes: accessing a protected resource without a usage description is not allowed",
            "The permission prompt shows a generic system message",
            "It prints `false` without showing anything",
            "It doesn't compile: the `Info.plist` key is missing",
          ],
          answer: 0,
          explanation: "The check happens at runtime, not at compile time. When the app requests camera access without `NSCameraUsageDescription`, the system terminates it with a console message telling you to add the key. That's why permission strings get reviewed in the same PR as the feature, and App Store Connect also rejects builds that are missing them.",
        },
        {
          kind: "explain",
          title: "Why `project.pbxproj` blows up on every merge",
          body: [
            "`project.pbxproj` is a text file of objects identified by 24-character IDs. Adding **one** Swift file touches several sections: `PBXFileReference`, `PBXBuildFile`, the group's `children` and the `files` list of `PBXSourcesBuildPhase`. Two devs adding files to the same group are almost guaranteed to collide.",
            "Resolving the conflict badly (keeping only one half) leaves a file that shows up in the navigator but isn't in Compile Sources, or a broken reference Xcode refuses to open.",
            "Real ways out: Xcode 16 synchronized folders (the target includes whatever is in the folder, no per-file list), generating the project with Tuist or XcodeGen and not committing the `.xcodeproj`, and moving code into SPM packages, where the structure is defined by the file system and `Package.swift`.",
          ],
          code: swift`/* Begin PBXBuildFile section */
		8A1F2C3D4E5F60718293A4B5 /* CartView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0F1E2D3C4B5A69788796A5B4 /* CartView.swift */; };
/* End PBXBuildFile section */

/* Begin PBXSourcesBuildPhase section */
		files = (
<<<<<<< HEAD
			8A1F2C3D4E5F60718293A4B5 /* CartView.swift in Sources */,
=======
			1B2C3D4E5F60718293A4B5C6 /* CouponView.swift in Sources */,
>>>>>>> feature/coupons
		);`,
        },
        {
          kind: "predict",
          prompt: "After resolving the conflict above by keeping only the `HEAD` line, `CouponView.swift` still shows up in Xcode's navigator. What happens when you build the code that uses it?",
          code: swift`// In CartView.swift
CouponView(code: cart.coupon)`,
          options: [
            "It builds: Xcode picks up new files automatically",
            "A duplicate file warning",
            "It crashes at runtime when the coupon is shown",
            "Error `cannot find 'CouponView' in scope`: the file exists but isn't in the target's Compile Sources",
          ],
          answer: 3,
          explanation: "The file reference (`PBXFileReference`, group) survived, so you see it in the navigator, but its `PBXSourcesBuildPhase` entry was lost: it has no target membership and the compiler never sees it. Classic symptom of a badly resolved merge in `project.pbxproj`.",
        },
        {
          kind: "write",
          prompt: "Write `Staging.xcconfig`: include `Shared.xcconfig`, add `STAGING` to the inherited compilation conditions, set the bundle id `com.acme.shop.staging` and define `API_BASE_URL` pointing to `https://api.staging.acme.com` without the `//` cutting it off.",
          starter: swift`// Staging.xcconfig
`,
          checks: [
            { pattern: "^#include\\s+\"Shared\\.xcconfig\"", label: "Includes `Shared.xcconfig`" },
            { pattern: "SWIFT_ACTIVE_COMPILATION_CONDITIONS\\s*=\\s*\\$\\(inherited\\)\\s+.*\\bSTAGING\\b", label: "Adds `STAGING` with `$(inherited)`" },
            { pattern: "PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*com\\.acme\\.shop\\.staging\\s*$", label: "Staging bundle id" },
            { pattern: "API_BASE_URL\\s*=\\s*https:/\\$\\(\\)/api\\.staging\\.acme\\.com", label: "URL escaped with `/$()/`" },
          ],
          warnings: [
            { pattern: "API_BASE_URL\\s*=\\s*https?://", label: "In `.xcconfig`, `//` starts a comment: the URL becomes `https:`" },
            { pattern: "SWIFT_ACTIVE_COMPILATION_CONDITIONS\\s*=\\s*STAGING", label: "Without `$(inherited)` you lose `DEBUG` and everything from below" },
          ],
          solution: swift`// Staging.xcconfig
#include "Shared.xcconfig"

SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) STAGING
PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop.staging
API_BASE_URL = https:/$()/api.staging.acme.com`,
          hint: "`$()` is an empty variable: it breaks the `//` without changing the final value.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "spm-packages",
      title: "Swift Package Manager in depth",
      goal: "Write a `Package.swift` with products, targets and local and remote dependencies, understand `Package.resolved`, handle resources with `Bundle.module` and control what's visible across modules.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Anatomy of `Package.swift`",
          body: [
            "The first line, `// swift-tools-version: 6.0`, isn't a decorative comment: it defines which `PackageDescription` API you can use and, since 6.0, that targets compile in Swift 6 language mode by default.",
            "**Targets** are modules: each one is a folder under `Sources/<Name>` and a separate `import`. **Products** are what you expose to whoever consumes the package (the app or another package). A target that isn't in any product is internal to the package.",
            "Large apps commonly have a single local package (`Modules/Package.swift`) with many targets, added to the Xcode project. Each feature is a target, and the app only links products.",
          ],
          code: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShopModules",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "Networking", targets: ["Networking"]),
        .library(name: "Cart", targets: ["Cart"]),
    ],
    targets: [
        .target(name: "Networking"),
        .target(name: "Cart", dependencies: ["Networking"]),
        .testTarget(name: "CartTests", dependencies: ["Cart"]),
    ]
)`,
        },
        {
          kind: "predict",
          prompt: "In the package above, a dev creates the `Orders` target and writes `import Networking` in one of its files, but declares the target like this. What happens on a clean CI build?",
          code: swift`.target(name: "Orders"),

// Sources/Orders/OrdersRepository.swift
import Networking`,
          options: [
            "It builds: SPM infers dependencies by reading the `import`s",
            "It fails with `no such module 'Networking'`: imports don't create dependencies, you have to declare them",
            "It builds, but crashes on the first request",
            "It builds with an implicit dependency warning",
          ],
          answer: 1,
          explanation: "SPM builds the graph only from what's declared in `dependencies`. In Xcode it sometimes builds \"by luck\" because `Networking` was already built for another target, which is why the bug only shows up on a clean CI build. The fix is `.target(name: \"Orders\", dependencies: [\"Networking\"])`.",
        },
        {
          kind: "explain",
          title: "Remote dependencies, versions and `Package.resolved`",
          body: [
            "`from: \"2.3.0\"` is the normal form: it accepts 2.3.0 up to (not including) 3.0.0 (semver: nothing should break within a major). `.upToNextMinor(from:)` is more conservative, `exact:` pins it, and `branch:`/`revision:` are for trying out a fix, not for production.",
            "`Package.resolved` stores the **exact** version and commit each dependency resolved to. In an app you always commit it: it guarantees that your Mac, your teammate's and CI all build the same thing. Updating is an explicit act (`swift package update` or File > Packages > Update) that shows up as a diff in the PR.",
            "Local dependencies (`.package(path:)`) are for packages in the same repo or under development. App features are usually targets of the same package, with no `.package` at all.",
          ],
          code: swift`dependencies: [
    .package(url: "https://github.com/pointfreeco/swift-dependencies", from: "1.4.0"),
    .package(url: "https://github.com/onevcat/Kingfisher", .upToNextMinor(from: "8.1.0")),
    .package(url: "https://github.com/hmlongco/Factory", exact: "2.4.3"),
    .package(path: "../DesignSystem"),
],
targets: [
    .target(
        name: "Catalog",
        dependencies: [
            "Networking",
            .product(name: "Dependencies", package: "swift-dependencies"),
            .product(name: "DesignSystem", package: "DesignSystem"),
        ]
    ),
]`,
        },
        {
          kind: "predict",
          prompt: "With `.package(url: \"https://github.com/acme/charts\", .upToNextMinor(from: \"5.8.0\"))`, which versions can SPM resolve?",
          code: swift`.package(url: "https://github.com/acme/charts", .upToNextMinor(from: "5.8.0"))`,
          options: [
            "From 5.8.0 up to (not including) 6.0.0",
            "Only 5.8.0",
            "From 5.8.0 up to (not including) 5.9.0",
            "Any version greater than or equal to 5.8.0",
          ],
          answer: 2,
          explanation: "`upToNextMinor` pins major and minor: it accepts 5.8.x patches (5.8.1, 5.8.7…) but not 5.9.0. `from:` would go up to (not including) 6.0.0, and `exact:` only 5.8.0. You use it with libraries that break things in minors.",
        },
        {
          kind: "explain",
          title: "Resources and `Bundle.module`",
          body: [
            "A package target doesn't live in `Bundle.main`: its resources go into a bundle of their own. When a target declares resources, SPM generates `Bundle.module` so that module can reach them.",
            "Asset catalogs, storyboards and Core Data models are processed automatically; other files (JSON, fonts, sounds) are declared with `.process(...)` (optimized by file type) or `.copy(...)` (copied as is, keeping the folder structure).",
            "The classic bug when moving a screen into a module: `Image(\"empty-cart\")` keeps looking in `Bundle.main` and the image renders empty, with no error and no crash.",
          ],
          code: swift`// Package.swift
.target(
    name: "Cart",
    dependencies: ["Networking"],
    resources: [.process("Resources")]
)

// Sources/Cart/EmptyCartView.swift
import SwiftUI

struct EmptyCartView: View {
    var body: some View {
        VStack {
            Image("empty-cart", bundle: .module)
            Text("cart.empty", bundle: .module)
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the blank to load the sample JSON stored in the `Cart` target's resources.",
          code: swift`let url = Bundle.____.url(forResource: "sample-cart", withExtension: "json")`,
          accept: ["^module$"],
          explanation: "`Bundle.module` is the resource bundle SPM generates for the current target. `Bundle.main` is the app's and doesn't contain the package's resources, so it would return `nil`.",
          hint: "It's a static property SPM generates when the target has resources.",
          placeholder: "bundle",
        },
        {
          kind: "explain",
          title: "Access control across modules",
          body: [
            "Everything is `internal` by default: visible inside the module and nowhere else. Once you modularize, whatever another module uses has to be `public` (or `open` if it can be subclassed from outside). `package` (Swift 5.9) is visible to every module in the **same package** but not to the app consuming it: perfect for helpers shared between `Networking` and the features.",
            "Classic trap: the memberwise init of a `public struct` is still `internal`. If another module needs to create the value, you write a `public init` by hand.",
            "`@testable import Cart` in a test gives access to the module's `internal` declarations, as long as it was compiled with testability (on by default in `Debug`). It doesn't open up `private` or `fileprivate`.",
          ],
          code: swift`// Networking module
public struct Endpoint: Sendable {
    public let path: String
    public let method: String

    public init(path: String, method: String = "GET") {
        self.path = path
        self.method = method
    }
}

package func makeDecoder() -> JSONDecoder {  // visible in the package, not in the app
    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .convertFromSnakeCase
    return decoder
}

func logRequest(_ endpoint: Endpoint) {}  // internal: Networking only`,
        },
        {
          kind: "predict",
          prompt: "The `Core` module exposes this type. In the app target, what happens with the last line?",
          code: swift`// Core module
public struct Money: Equatable {
    public let cents: Int
    public let currency: String
}

// App
import Core
let price = Money(cents: 1_999, currency: "USD")`,
          options: [
            "It builds: the struct is `public`, so its init is too",
            "Error: the memberwise init is `internal` and isn't visible from another module",
            "It only builds with `@testable import Core`",
            "Error: a `public` type can't conform to `Equatable`",
          ],
          answer: 1,
          explanation: "The synthesized memberwise init is `internal` even when the type and its properties are `public`. From the app it doesn't exist. You add `public init(cents: Int, currency: String)` in `Core`. `@testable` would unlock it, but that only works in tests, never in production code.",
        },
        {
          kind: "fill",
          prompt: "`makeDecoder()` is used by `Networking` and `Cart`, both in the same package, but we don't want the app to see it. Fill in the access level.",
          code: swift`____ func makeDecoder() -> JSONDecoder`,
          accept: ["^package$"],
          explanation: "`package` is exactly that scope: every module in the same SPM package. With `public` the app would see it; with `internal` only `Networking` would. It requires `swift-tools-version` 5.9 or later.",
          hint: "It arrived in Swift 5.9 and shares its name with what `Package.swift` defines.",
          placeholder: "level",
        },
        {
          kind: "write",
          prompt: "Write `ShopModules`' `Package.swift`: iOS 17, products `Networking` and `Cart`, a remote dependency on `https://github.com/pointfreeco/swift-dependencies` from 1.4.0, a `Cart` target depending on `Networking` and the `Dependencies` product that processes the `Resources` folder, and the `CartTests` test target.",
          starter: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShopModules",
    targets: []
)`,
          checks: [
            { pattern: "platforms:\\s*\\[\\s*\\.iOS\\(\\.v17\\)", label: "iOS 17 platform" },
            { pattern: "\\.library\\(\\s*name:\\s*\"Cart\"", label: "`Cart` product" },
            { pattern: "\\.package\\(\\s*url:\\s*\"https://github\\.com/pointfreeco/swift-dependencies\"\\s*,\\s*from:\\s*\"1\\.4\\.0\"\\s*\\)", label: "Remote dependency with `from:`" },
            { pattern: "\\.product\\(\\s*name:\\s*\"Dependencies\"\\s*,\\s*package:\\s*\"swift-dependencies\"\\s*\\)", label: "Uses the `Dependencies` product in `Cart`" },
            { pattern: "\\.process\\(\\s*\"Resources\"\\s*\\)", label: "Declares the resources" },
            { pattern: "\\.testTarget\\(\\s*name:\\s*\"CartTests\"", label: "`CartTests` test target" },
          ],
          warnings: [
            { pattern: "branch:\\s*\"", label: "Depending on a branch makes builds non-reproducible" },
          ],
          solution: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShopModules",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "Networking", targets: ["Networking"]),
        .library(name: "Cart", targets: ["Cart"]),
    ],
    dependencies: [
        .package(url: "https://github.com/pointfreeco/swift-dependencies", from: "1.4.0"),
    ],
    targets: [
        .target(name: "Networking"),
        .target(
            name: "Cart",
            dependencies: [
                "Networking",
                .product(name: "Dependencies", package: "swift-dependencies"),
            ],
            resources: [.process("Resources")]
        ),
        .testTarget(name: "CartTests", dependencies: ["Cart"]),
    ]
)`,
          hint: "Products from remote packages are referenced with `.product(name:package:)`; the `package` is the last component of the URL.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "manual-di",
      title: "Dependency injection without frameworks",
      goal: "Inject through initializers, use small protocols as contracts, hide `UserDefaults`, `URLSession` and `Date()` behind abstractions and wire everything up in a composition root.",
      minutes: 17,
      steps: [
        {
          kind: "explain",
          title: "Hidden dependencies",
          body: [
            "A hidden dependency is anything a type grabs on its own: `URLSession.shared`, `UserDefaults.standard`, `Date()`, `Analytics.shared`. It compiles and it works, but a test can't replace it: it hits the real network, depends on the time of day and leaks state between tests.",
            "Dependency injection is a fancy name for something simple: **the type receives what it needs in its `init`**. It doesn't create its collaborators or fetch them from globals.",
            "The payoff shows up in tests: with injected dependencies a test is fast, deterministic and doesn't need the network or a clean simulator.",
          ],
          code: swift`// Before: impossible to test without a real network and clock
final class PromoBanner {
    func isVisible() async -> Bool {
        let (data, _) = try! await URLSession.shared.data(from: URL(string: "https://api.acme.com/promo")!)
        let promo = try! JSONDecoder().decode(Promo.self, from: data)
        return Date() < promo.endsAt
    }
}

// After: everything comes in through init
final class PromoBannerModel {
    private let http: any HTTPClient
    private let now: () -> Date

    init(http: any HTTPClient, now: @escaping () -> Date) {
        self.http = http
        self.now = now
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Two tests run in the same process, in this order. What does the second one print?",
          code: swift`final class Session {
    static let shared = Session()
    var token: String?
}

func testLogin() {
    Session.shared.token = "abc"
}

func testGuestCheckout() {
    print(Session.shared.token ?? "no token")
}

testLogin()
testGuestCheckout()`,
          options: [
            "no token",
            "nil",
            "abc",
            "Optional(\"abc\")",
          ],
          answer: 2,
          explanation: "`Session.shared` is global state: it lives for the whole process. The first test leaves `token = \"abc\"` and the second sees it, so it prints `abc` (the `??` unwraps). If the execution order changes, so does the result: that's where flaky tests come from. With the session injected, each test creates its own.",
        },
        {
          kind: "explain",
          title: "Small protocols as contracts",
          body: [
            "You don't need to wrap the whole `UserDefaults` API: the protocol declares **only what your code uses**. The smaller it is, the easier the fake is to write.",
            "The real implementation is a thin adapter; the test one is an in-memory dictionary. The consuming type (`OnboardingFlag`) doesn't know which one it gets.",
            "Use `any Protocol` for the existential: it's the explicit modern Swift spelling and makes the dynamic dispatch obvious.",
          ],
          code: swift`protocol KeyValueStore {
    func string(forKey key: String) -> String?
    func set(_ value: String, forKey key: String)
}

struct UserDefaultsStore: KeyValueStore {
    let defaults: UserDefaults
    func string(forKey key: String) -> String? { defaults.string(forKey: key) }
    func set(_ value: String, forKey key: String) { defaults.set(value, forKey: key) }
}

final class InMemoryStore: KeyValueStore {
    private var values: [String: String] = [:]
    func string(forKey key: String) -> String? { values[key] }
    func set(_ value: String, forKey key: String) { values[key] = value }
}

struct OnboardingFlag {
    let store: any KeyValueStore
    var isDone: Bool { store.string(forKey: "onboarding") == "done" }
    func markDone() { store.set("done", forKey: "onboarding") }
}

let flag = OnboardingFlag(store: InMemoryStore())
print(flag.isDone)
flag.markDone()
print(flag.isDone)`,
          output: "false\ntrue",
        },
        {
          kind: "predict",
          code: swift`protocol HourProvider {
    var currentHour: Int { get }
}

struct FixedHour: HourProvider {
    let currentHour: Int
}

struct Greeter {
    let clock: any HourProvider
    func greeting() -> String {
        clock.currentHour < 12 ? "Good morning" : "Good afternoon"
    }
}

print(Greeter(clock: FixedHour(currentHour: 9)).greeting())
print(Greeter(clock: FixedHour(currentHour: 12)).greeting())`,
          options: [
            "Good morning\nGood afternoon",
            "Good morning\nGood morning",
            "Good afternoon\nGood afternoon",
            "It depends on when the test runs",
          ],
          answer: 0,
          explanation: "The clock is a fixed fake, so the result doesn't depend on the real time. 9 < 12 gives \"Good morning\". 12 < 12 is `false`, so it gives \"Good afternoon\". That noon boundary is exactly the case you want to test and couldn't with `Date()`.",
        },
        {
          kind: "explain",
          title: "Network and dates behind abstractions",
          body: [
            "For dates, a closure is enough: `now: () -> Date`. In production you pass `Date.init`; in the test, `{ fixed }`. For the network, a one-method protocol and a `URLSession` extension that conforms to it.",
            "Name the protocol method differently from `URLSession`'s (`send` instead of `data(for:)`): it avoids ambiguity with their default parameters and makes clear what's yours.",
            "Default values in the `init` (`= URLSession.shared`) are fine in small code, but they hide the decision again. In modules, prefer having the composition root always pass the concrete type.",
          ],
          code: swift`protocol HTTPClient: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPClient {
    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        try await data(for: request)
    }
}

struct TokenValidator {
    let now: () -> Date
    func isExpired(_ expiry: Date) -> Bool { now() >= expiry }
}

let fixed = Date(timeIntervalSince1970: 1_000)
let validator = TokenValidator(now: { fixed })
print(validator.isExpired(Date(timeIntervalSince1970: 999)))
print(validator.isExpired(Date(timeIntervalSince1970: 2_000)))`,
          output: "true\nfalse",
        },
        {
          kind: "fill",
          prompt: "In the composition root, fill in the value passed as the real clock.",
          code: swift`let validator = TokenValidator(now: ____)`,
          accept: ["^Date\\.init$", "^\\{\\s*Date\\(\\)\\s*\\}$", "^\\{\\s*Date\\.now\\s*\\}$"],
          explanation: "`Date.init` is a function reference of type `() -> Date`: every call to `now()` creates the current date. `{ Date() }` or `{ Date.now }` are equivalent. Passing `Date.now` without braces doesn't compile: it's a `Date`, not a function, and it would also freeze the date at the moment the object is built.",
          hint: "A reference to `Date`'s initializer, without parentheses.",
          placeholder: "clock",
        },
        {
          kind: "explain",
          title: "The composition root",
          body: [
            "If nobody creates their own dependencies, someone has to: the **composition root**. It's a single place, close to launch (`@main`, `SceneDelegate`, an `AppDependencies`), where concrete types are instantiated and wired together.",
            "It's the only place that knows every implementation. Features receive protocols; the root decides `URLSession` vs stub, `UserDefaults` vs in-memory, live vs mock for UI tests (for example, based on a launch argument).",
            "Anti-pattern to avoid: passing the whole container (`deps`) to every ViewModel and letting it pull whatever it wants. That's a *service locator*: the dependencies are hidden again, just somewhere else.",
          ],
          code: swift`@MainActor
final class AppDependencies {
    let http: any HTTPClient = URLSession.shared
    let store: any KeyValueStore = UserDefaultsStore(defaults: .standard)
    lazy var cartRepository: any CartRepository = RemoteCartRepository(http: http)

    func makeCartViewModel() -> CartViewModel {
        CartViewModel(repository: cartRepository, now: Date.init)
    }
}

@main
struct ShopApp: App {
    @State private var dependencies = AppDependencies()

    var body: some Scene {
        WindowGroup {
            CartScreen(model: dependencies.makeCartViewModel())
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "In a PR, a ViewModel deep in the navigation needs to track events and the author writes this. What's the main problem?",
          code: swift`@MainActor @Observable
final class ProductDetailModel {
    func addToCart() {
        // ...
        AnalyticsService.shared.track("add_to_cart")
    }
}`,
          options: [
            "None: singletons are the recommended approach for analytics",
            "`track` should be `async`",
            "`AnalyticsService` should be marked `final`",
            "It's a hidden dependency: tests send real events and there's no way to verify what was tracked",
          ],
          answer: 3,
          explanation: "The ViewModel decides on its own where analytics comes from. In tests it fires real events (or crashes if the SDK isn't configured) and there's no way to assert that `add_to_cart` was tracked. Inject `any AnalyticsTracking` through the init and pass a spy in the test.",
        },
        {
          kind: "write",
          prompt: "Refactor `ProfileModel` so its `init` receives an `any HTTPClient`, an `any KeyValueStore` and a `() -> Date` clock. Store them in `let http`, `let store` and `let now`, and use `now()` instead of `Date()`.",
          starter: swift`@MainActor @Observable
final class ProfileModel {
    var lastSync: Date?

    func refresh() async throws {
        let request = URLRequest(url: URL(string: "https://api.acme.com/me")!)
        _ = try await URLSession.shared.data(for: request)
        UserDefaults.standard.set("synced", forKey: "profile.status")
        lastSync = Date()
    }
}`,
          checks: [
            { pattern: "let\\s+http\\s*:\\s*any\\s+HTTPClient", label: "Stores `http: any HTTPClient`" },
            { pattern: "let\\s+store\\s*:\\s*any\\s+KeyValueStore", label: "Stores `store: any KeyValueStore`" },
            { pattern: "let\\s+now\\s*:\\s*\\(\\)\\s*->\\s*Date", label: "Stores the `now: () -> Date` clock" },
            { pattern: "init\\s*\\(", label: "Has an `init` that receives the dependencies" },
            { pattern: "@escaping\\s*\\(\\)\\s*->\\s*Date", label: "The `init` clock is `@escaping`" },
            { pattern: "lastSync\\s*=\\s*now\\(\\)", label: "Uses `now()` for the date" },
          ],
          warnings: [
            { pattern: "URLSession\\.shared", label: "The network is still hidden inside the model" },
            { pattern: "UserDefaults\\.standard", label: "Storage is still hidden inside the model" },
            { pattern: "\\bDate\\(\\)", label: "`Date()` makes the test depend on the real clock" },
          ],
          solution: swift`@MainActor @Observable
final class ProfileModel {
    var lastSync: Date?

    @ObservationIgnored private let http: any HTTPClient
    @ObservationIgnored private let store: any KeyValueStore
    @ObservationIgnored private let now: () -> Date

    init(http: any HTTPClient, store: any KeyValueStore, now: @escaping () -> Date) {
        self.http = http
        self.store = store
        self.now = now
    }

    func refresh() async throws {
        let request = URLRequest(url: URL(string: "https://api.acme.com/me")!)
        _ = try await http.send(request)
        store.set("synced", forKey: "profile.status")
        lastSync = now()
    }
}`,
          hint: "Three `let` properties, an `init` that assigns them, and replace every direct use with the property.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "di-containers",
      title: "DI containers and tools",
      goal: "Get to know Factory, Swinject, `swift-dependencies` and `@Environment` with `@Entry`, and choose between them and manual DI based on the team and the project.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "When a container shows up (and Swinject)",
          body: [
            "Manual DI scales well until the composition root is hundreds of lines long and threading dependencies through five levels of navigation gets tedious. That's when containers come in: you register how each thing is built and resolve it where you need it.",
            "**Swinject** is the veteran: `register` with a closure and `resolve` that returns an optional. It has scopes (`.transient`, `.container`, `.graph`, `.weak`). The cost: forget to register something and it still compiles, then fails at runtime.",
            "Every container is, deep down, a map from type to factory. What changes between tools is how much the compiler checks and how easy it is to override in tests.",
          ],
          code: swift`import Swinject

let container = Container()

container.register((any HTTPClient).self) { _ in
    URLSession.shared
}
.inObjectScope(.container)

container.register((any CartRepository).self) { resolver in
    RemoteCartRepository(http: resolver.resolve((any HTTPClient).self)!)
}

let repository = container.resolve((any CartRepository).self)!`,
        },
        {
          kind: "predict",
          prompt: "A dev adds `CouponRepository` to `CheckoutModel` and resolves it with Swinject, but forgets to register it. What happens?",
          code: swift`let model = CheckoutModel(
    coupons: container.resolve((any CouponRepository).self)!
)`,
          options: [
            "It doesn't compile: the registration is missing",
            "It compiles; it crashes at runtime when that screen is built because `resolve` returns `nil`",
            "It compiles and Swinject creates a default instance",
            "It compiles and `coupons` ends up `nil` without crashing",
          ],
          answer: 1,
          explanation: "`resolve` returns an `Optional`. With no registration it returns `nil`, and the `!` only crashes when someone opens checkout. The compiler has no way of knowing. That's the main criticism of dynamic-registration containers, and the reason to have a test that resolves the whole graph at startup.",
        },
        {
          kind: "explain",
          title: "Factory: registrations checked by the compiler",
          body: [
            "**Factory** defines each dependency as a computed property in a `Container` extension. Since it's plain Swift code, it always returns a value: \"I forgot to register it\" can't happen.",
            "You inject with `@Injected(\\.cartRepository)` or by calling `Container.shared.cartRepository()`. The default scope is `unique` (a new instance each time); `.singleton` and `.cached` reuse instances.",
            "In tests: `Container.shared.cartRepository.register { InMemoryCartRepository() }` before creating the model. With `@Observable`, mark the property wrapper with `@ObservationIgnored`.",
          ],
          code: swift`import Factory

extension Container {
    var httpClient: Factory<any HTTPClient> {
        self { URLSession.shared }.singleton
    }
    var cartRepository: Factory<any CartRepository> {
        self { RemoteCartRepository(http: self.httpClient()) }
    }
}

@MainActor @Observable
final class CartModel {
    @ObservationIgnored @Injected(\.cartRepository) private var repository
    var items: [CartItem] = []
}

// In a test
Container.shared.cartRepository.register { InMemoryCartRepository() }
let model = CartModel()`,
        },
        {
          kind: "predict",
          code: swift`import Factory

final class Counter { var value = 0 }

extension Container {
    var counter: Factory<Counter> { self { Counter() } }
    var sharedCounter: Factory<Counter> { self { Counter() }.singleton }
}

let a = Container.shared.counter()
a.value += 1
print(Container.shared.counter().value)

let b = Container.shared.sharedCounter()
b.value += 1
print(Container.shared.sharedCounter().value)`,
          options: [
            "1\n1",
            "0\n0",
            "1\n0",
            "0\n1",
          ],
          answer: 3,
          explanation: "`counter` uses the default scope (`unique`): every call creates a new `Counter`, so the second resolution starts at 0. `sharedCounter` is `.singleton`: the second call returns the same instance that was already incremented, 1.",
        },
        {
          kind: "explain",
          title: "`swift-dependencies` (with or without TCA)",
          body: [
            "Point-Free's `swift-dependencies` is TCA's DI, but it's a separate package and works with any architecture. You define a `DependencyKey` with its `liveValue`, expose it on `DependencyValues` and read it with `@Dependency(\\.priceClient)`.",
            "It ships ready-made dependencies: `\\.date.now`, `\\.uuid`, `\\.continuousClock`, `\\.mainQueue`. In tests you override with `withDependencies`, and if a test uses a `live` dependency without overriding it, the library fails the test.",
            "The \"structs of closures\" style (instead of protocols) makes overriding a single endpoint a one-liner.",
          ],
          code: swift`import Dependencies

struct PriceClient: Sendable {
    var fetchPrice: @Sendable (_ productID: String) async throws -> Int
}

extension PriceClient: DependencyKey {
    static let liveValue = PriceClient(fetchPrice: { id in
        try await APIClient.live.price(for: id)
    })
}

extension DependencyValues {
    var priceClient: PriceClient {
        get { self[PriceClient.self] }
        set { self[PriceClient.self] = newValue }
    }
}

@MainActor @Observable
final class ProductModel {
    @ObservationIgnored @Dependency(\.priceClient) var priceClient
    @ObservationIgnored @Dependency(\.date.now) var now
}

// In a test
let model = withDependencies {
    $0.priceClient.fetchPrice = { _ in 1_999 }
} operation: {
    ProductModel()
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the protocol that lets `AnalyticsClient` be used as a `swift-dependencies` dependency with a production value.",
          code: swift`extension AnalyticsClient: ____ {
    static let liveValue = AnalyticsClient(track: { event in Firebase.log(event) })
}`,
          accept: ["^DependencyKey$"],
          explanation: "`DependencyKey` requires `liveValue` (and optionally `testValue` and `previewValue`). Then you add the property in `extension DependencyValues` to read it with `@Dependency(\\.analyticsClient)`.",
          hint: "It's the protocol for the dependency's \"key\".",
          placeholder: "protocol",
        },
        {
          kind: "explain",
          title: "`@Environment` with `@Entry` in SwiftUI",
          body: [
            "For UI-level dependencies (button analytics, image loader, theme), SwiftUI already ships a container: the environment. With the `@Entry` macro (Xcode 16) you declare the key and its default in one line.",
            "The value flows **downwards** from wherever you call `.environment(...)`. A view reading it outside that subtree gets the default, with no crash.",
            "Important limit: `@Environment` can only be read inside a `View`. A ViewModel can't read it; if it needs the value, the view passes it along or it gets injected through the init from the composition root.",
          ],
          code: swift`import SwiftUI

struct AnalyticsClient: Sendable {
    var track: @Sendable (String) -> Void
    static let noop = AnalyticsClient(track: { _ in })
}

extension EnvironmentValues {
    @Entry var analytics: AnalyticsClient = .noop
}

struct PayButton: View {
    @Environment(\.analytics) private var analytics

    var body: some View {
        Button("Pay") { analytics.track("pay_tapped") }
    }
}

// App root
RootView()
    .environment(\.analytics, liveAnalytics)`,
        },
        {
          kind: "predict",
          prompt: "Analytics is injected like this. Events from the Profile tab never reach the dashboard. Why?",
          code: swift`TabView {
    HomeView()
        .environment(\.analytics, liveAnalytics)
        .tabItem { Label("Home", systemImage: "house") }

    ProfileView()
        .tabItem { Label("Profile", systemImage: "person") }
}`,
          options: [
            "`TabView` doesn't propagate the environment to any tab",
            "Tabs render lazily and the environment arrives too late",
            "`ProfileView` is outside the subtree where it was injected: it gets the `.noop` default",
            "`@Entry` only works on iOS 18",
          ],
          answer: 2,
          explanation: "The environment propagates downwards from the modifier. It was applied to `HomeView`, not to the `TabView`, so `ProfileView` reads the default value, which does nothing. No crash, no warning: that's why you inject at the root and make the production default visible in UI tests.",
        },
        {
          kind: "write",
          prompt: "Add `imageLoader` to the environment with `@Entry` and a `.placeholder` default, read it in `AvatarView` and inject `.live` at the root.",
          starter: swift`struct ImageLoader: Sendable {
    var load: @Sendable (URL) async throws -> UIImage
    static let placeholder = ImageLoader(load: { _ in UIImage() })
    static let live = ImageLoader(load: { url in try await download(url) })
}

struct AvatarView: View {
    let url: URL
    var body: some View { Color.gray }
}

// root
RootView()`,
          checks: [
            { pattern: "extension\\s+EnvironmentValues\\s*\\{", label: "Extends `EnvironmentValues`" },
            { pattern: "@Entry\\s+var\\s+imageLoader\\s*:\\s*ImageLoader\\s*=\\s*\\.placeholder", label: "`@Entry var imageLoader` with a `.placeholder` default" },
            { pattern: "@Environment\\(\\\\\\.imageLoader\\)\\s+(private\\s+)?var\\s+\\w+", label: "Reads it with `@Environment(\\.imageLoader)`" },
            { pattern: "\\.environment\\(\\\\\\.imageLoader\\s*,\\s*\\.live\\s*\\)", label: "Injects `.live` at the root" },
          ],
          warnings: [
            { pattern: "ImageLoader\\.shared", label: "A singleton hides the dependency" },
          ],
          solution: swift`struct ImageLoader: Sendable {
    var load: @Sendable (URL) async throws -> UIImage
    static let placeholder = ImageLoader(load: { _ in UIImage() })
    static let live = ImageLoader(load: { url in try await download(url) })
}

extension EnvironmentValues {
    @Entry var imageLoader: ImageLoader = .placeholder
}

struct AvatarView: View {
    let url: URL
    @Environment(\.imageLoader) private var imageLoader
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable() } else { Color.gray }
        }
        .task { image = try? await imageLoader.load(url) }
    }
}

// root
RootView()
    .environment(\.imageLoader, .live)`,
          hint: "`@Entry` goes inside `extension EnvironmentValues`; the key path is `\\.imageLoader`.",
        },
        {
          kind: "predict",
          prompt: "Team of 3 devs, 15-screen app, 4 modules, unit tests on the ViewModels. Today they use manual DI with a 120-line composition root. Someone proposes adding Swinject. What would you say in the review?",
          code: swift`// AppDependencies.swift — 120 lines
func makeCartModel() -> CartModel {
    CartModel(repository: cartRepository, analytics: analytics, now: Date.init)
}`,
          options: [
            "Add it: containers are mandatory in modular apps",
            "Stick with manual DI: it scales fine at this size, errors are compile-time and it adds no dependency or magic",
            "Replace everything with singletons, it's the simplest option",
            "Route everything through `@Environment`, including repositories and ViewModels",
          ],
          answer: 1,
          explanation: "A container costs an external dependency, a learning curve and, with Swinject, runtime errors. At this size, manual DI gives you all of that for free and with compiler checks. Revisit when the root becomes unmanageable or many features need partial overrides (that's where Factory or `swift-dependencies` shine).",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "feature-modules",
      title: "Feature modules at scale",
      goal: "Split layer modules from feature modules, cut feature-to-feature dependencies with interface modules, choose static or dynamic linking, generate the project with Tuist and measure whether modularization pays off.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Layer modules vs feature modules",
          body: [
            "There are two axes. **Layer modules** are shared infrastructure: `Core` (models and utilities), `Networking`, `DesignSystem`, `Analytics`. **Feature modules** are screens and flows: `Feed`, `Profile`, `Checkout`.",
            "Graph rules: features depend on layer modules; layers never depend on features; a feature does **not** depend on another feature; the app depends on everything and is the composition root.",
            "Modularization is justified by three measurable things: faster incremental builds, teams that don't step on each other (each owns its modules) and features that can be tested and run in isolation. If none of the three improves, it's ceremony.",
          ],
          code: swift`targets: [
    // Layers
    .target(name: "Core"),
    .target(name: "Networking", dependencies: ["Core"]),
    .target(name: "DesignSystem"),

    // Features
    .target(name: "Feed", dependencies: ["Core", "Networking", "DesignSystem"]),
    .target(name: "Profile", dependencies: ["Core", "Networking", "DesignSystem"]),
]
// The app (an Xcode target) links Feed and Profile and wires them together.`,
        },
        {
          kind: "predict",
          prompt: "`Feed` already depends on `Profile` to open an author's profile. Now `Profile` needs to show the user's posts and the dev adds `\"Feed\"` to its dependencies. What happens?",
          code: swift`.target(name: "Feed", dependencies: ["Core", "Profile"]),
.target(name: "Profile", dependencies: ["Core", "Feed"]),`,
          options: [
            "SPM rejects the package: cyclic dependency between `Feed` and `Profile`",
            "It builds, but builds get slower",
            "It builds if both types are `public`",
            "It crashes at runtime when navigating from one to the other",
          ],
          answer: 0,
          explanation: "A module can't depend on itself, directly or indirectly: SPM detects the cycle and won't resolve the package. Even without a cycle, a feature depending on another means any change in `Feed` recompiles `Profile`. The way out is an interface module.",
        },
        {
          kind: "explain",
          title: "Interface modules",
          body: [
            "An **interface module** (`FeedInterface`) contains only the contract: a protocol to build the screen and the minimal models that cross the boundary. It's small, rarely changes and depends on nothing heavy.",
            "`Profile` depends on `FeedInterface`, not on `Feed`. The implementation (`Feed`) also depends on the interface and conforms to it. The app, which knows both, injects the concrete type into `Profile`.",
            "Build win: touching `Feed`'s internals no longer recompiles `Profile`, because the interface didn't change. Team win: the Profile squad can use a fake `FeedBuilding` without waiting for the Feed squad.",
          ],
          code: swift`// FeedInterface module
import SwiftUI

@MainActor
public protocol FeedBuilding {
    func makeAuthorFeed(authorID: String) -> AnyView
}

// Profile module (depends on FeedInterface)
import FeedInterface

public struct ProfileScreen: View {
    let userID: String
    let feedBuilder: any FeedBuilding

    public init(userID: String, feedBuilder: any FeedBuilding) {
        self.userID = userID
        self.feedBuilder = feedBuilder
    }

    public var body: some View {
        NavigationLink("See posts") { feedBuilder.makeAuthorFeed(authorID: userID) }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in `Profile`'s dependency so it can open the feed without coupling to the implementation.",
          code: swift`.target(name: "Profile", dependencies: ["Core", "DesignSystem", "____"]),`,
          accept: ["^FeedInterface$"],
          explanation: "`Profile` only needs the `FeedBuilding` contract, which lives in `FeedInterface`. Depending on `Feed` would bring back feature-to-feature coupling and every change in `Feed` would recompile it.",
          hint: "It's the module that contains only the protocol.",
          placeholder: "module",
        },
        {
          kind: "explain",
          title: "Demo apps and Tuist",
          body: [
            "A **per-feature demo app** is an app target that links only that feature plus fakes of its dependencies. It builds in seconds, launches straight into the screen you're working on and lets the team keep going even when the backend is down.",
            "SPM doesn't create iOS app targets, so large projects generate the `.xcodeproj` with **Tuist** (`Project.swift`, written in Swift) or **XcodeGen** (`project.yml`). The project is regenerated with `tuist generate` and stops being a conflict magnet.",
            "Tuist also lets you change each module's product type (`.staticFramework`, `.framework`) in one place and has a binary cache so modules that didn't change aren't rebuilt.",
          ],
          code: swift`// Project.swift (Tuist)
import ProjectDescription

let project = Project(
    name: "Shop",
    targets: [
        .target(
            name: "Feed",
            destinations: .iOS,
            product: .staticFramework,
            bundleId: "com.acme.shop.feed",
            sources: ["Features/Feed/Sources/**"],
            dependencies: [.target(name: "FeedInterface"), .target(name: "DesignSystem")]
        ),
        .target(
            name: "FeedDemo",
            destinations: .iOS,
            product: .app,
            bundleId: "com.acme.shop.feed-demo",
            sources: ["Features/Feed/Demo/**"],
            dependencies: [.target(name: "Feed")]
        ),
    ]
)`,
        },
        {
          kind: "predict",
          prompt: "`Utils` is a **static** library with `static let shared = Cache()`. It's linked by `Core.framework` (**dynamic**) and also directly by the app. At runtime the log shows `Class _TtC5Utils5Cache is implemented in both...`. What does that imply?",
          code: swift`App ──▶ Core.framework (dynamic) ──▶ Utils (static)
 └──────────────────────────────────▶ Utils (static)`,
          options: [
            "Nothing: the linker deduplicates the symbols",
            "It only makes the app slightly bigger",
            "It doesn't build because of duplicate symbols",
            "There are two copies of `Utils`: duplicated code and two different `Cache.shared`, one per binary",
          ],
          answer: 3,
          explanation: "A static library is copied into every binary that links it. `Core.framework` has its copy and the app executable has its own: two `Cache` classes, two `shared`. What the app stores, `Core` doesn't see. The rule: a static library gets linked into a single binary; if several need it, make it dynamic or expose it only through the framework.",
        },
        {
          kind: "explain",
          title: "Static vs dynamic, and measuring",
          body: [
            "**Static**: the code is copied into the binary that links it; fast launch, but it's duplicated if several binaries link it (app + extensions). **Dynamic**: a `.framework` embedded once and loaded at launch; shared, but each dynamic framework adds launch time. SPM products are `.automatic` by default and Xcode usually links them statically.",
            "Measure before and after modularizing: clean build, incremental build after touching a file in a leaf feature, CI time and test time. `-showBuildTimingSummary` and Xcode's Build Timeline show which modules compile serially.",
            "If the incremental build doesn't go down, check the graph: a giant \"Core\" module everything depends on means any change recompiles the whole app.",
          ],
          code: swift`# Clean build with a timing summary
xcodebuild -scheme Shop \
  -destination 'generic/platform=iOS Simulator' \
  -showBuildTimingSummary clean build | tail -n 25

# Incremental: touch a file in a leaf feature and repeat without clean
touch Modules/Sources/Feed/FeedView.swift
xcodebuild -scheme Shop \
  -destination 'generic/platform=iOS Simulator' \
  -showBuildTimingSummary build | tail -n 25`,
        },
        {
          kind: "predict",
          prompt: "Team of 2 devs, 12-screen app, 40 s clean build and 6 s incremental. The new tech lead proposes splitting it into 25 SPM modules \"to scale\". What's the most reasonable call?",
          code: swift`Clean build:       40 s
Incremental build:  6 s
Devs:               2
Screens:           12`,
          options: [
            "Do it now: more modules always build faster",
            "Never modularize: SPM is slow",
            "Not for now: none of the three wins (builds, teams, isolation) is a problem; at most split out `DesignSystem` and `Networking` if there's a concrete reason",
            "Move everything to dynamic frameworks",
          ],
          answer: 2,
          explanation: "With a 6 s incremental build and two people there's no pain to solve: 25 modules add `public` everywhere, more configuration and more build planning time. You modularize when a metric gets worse or a team boundary demands it, and you measure before and after.",
        },
        {
          kind: "write",
          prompt: "Write the package targets: `FeedInterface` with no dependencies; `Feed` depending on `FeedInterface`, `Networking` and `DesignSystem`; `Profile` depending on `FeedInterface` and `DesignSystem`. The `Networking` and `DesignSystem` layers already exist and don't depend on features.",
          starter: swift`targets: [
    .target(name: "Networking"),
    .target(name: "DesignSystem"),
]`,
          checks: [
            { pattern: "\\.target\\(\\s*name:\\s*\"FeedInterface\"\\s*\\)", label: "`FeedInterface` with no dependencies" },
            { pattern: "name:\\s*\"Feed\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"FeedInterface\"", label: "`Feed` implements the interface" },
            { pattern: "name:\\s*\"Profile\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"FeedInterface\"", label: "`Profile` depends on the interface" },
            { pattern: "name:\\s*\"Feed\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"Networking\"", label: "`Feed` uses `Networking`" },
          ],
          warnings: [
            { pattern: "name:\\s*\"Profile\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"Feed\"", label: "`Profile` depends on `Feed`: feature-to-feature coupling" },
            { pattern: "name:\\s*\"(Networking|DesignSystem)\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"(Feed|Profile)", label: "A base layer can't depend on a feature" },
          ],
          solution: swift`targets: [
    .target(name: "Networking"),
    .target(name: "DesignSystem"),
    .target(name: "FeedInterface"),
    .target(name: "Feed", dependencies: ["FeedInterface", "Networking", "DesignSystem"]),
    .target(name: "Profile", dependencies: ["FeedInterface", "DesignSystem"]),
]`,
          hint: "The interface is the only piece both features share.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: break up the Mercadito monolith",
      goal: "Split a monolithic app into five modules with a `Package.swift`, an interface module and a composition root that wires everything together.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "**Mercadito** is a shopping app with a single target: 180 files, a 70 s incremental build and four squads stepping on each other in every PR. Cart and Checkout are coupled: the cart instantiates `CheckoutViewController` directly.",
            "The plan: a local `MercaditoModules` package with five modules. Layers: `Networking` and `DesignSystem`. Features: `Cart` and `Checkout`. Contract: `CheckoutInterface`, so `Cart` can start checkout without knowing its implementation.",
            "You'll write the `Package.swift`, the interface module and the app's composition root. Below is what already exists.",
          ],
          code: swift`// Already exists
// Networking:   public protocol HTTPClient, public final class URLSessionHTTPClient: HTTPClient
// Cart:         public final class CartViewModel  (today it creates CheckoutViewController inside)
//               public protocol CartRepository, public struct RemoteCartRepository
// Checkout:     final class CheckoutViewController: UIViewController

// Target graph
// App ──▶ Cart, Checkout, Networking, DesignSystem
// Cart ──▶ CheckoutInterface, Networking, DesignSystem
// Checkout ──▶ CheckoutInterface, Networking, DesignSystem`,
        },
        {
          kind: "write",
          prompt: "Write `MercaditoModules`' `Package.swift`: iOS 17, one product per feature and layer module, the five targets following the target graph, and the `CartTests` and `CheckoutTests` test targets.",
          starter: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MercaditoModules",
    targets: [
        .target(name: "Networking"),
    ]
)`,
          checks: [
            { pattern: "platforms:\\s*\\[\\s*\\.iOS\\(\\.v17\\)", label: "iOS 17 platform" },
            { pattern: "\\.target\\(\\s*name:\\s*\"CheckoutInterface\"", label: "`CheckoutInterface` target" },
            { pattern: "name:\\s*\"Cart\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"CheckoutInterface\"", label: "`Cart` depends on the interface" },
            { pattern: "name:\\s*\"Checkout\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"CheckoutInterface\"", label: "`Checkout` implements the interface" },
            { pattern: "\\.library\\(\\s*name:\\s*\"Checkout\"", label: "`Checkout` product for the app" },
            { pattern: "\\.testTarget\\(\\s*name:\\s*\"CartTests\"", label: "`CartTests` test target" },
            { pattern: "\\.testTarget\\(\\s*name:\\s*\"CheckoutTests\"", label: "`CheckoutTests` test target" },
          ],
          warnings: [
            { pattern: "name:\\s*\"Cart\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"Checkout\"", label: "`Cart` depends on `Checkout`: feature-to-feature coupling" },
            { pattern: "name:\\s*\"(Networking|DesignSystem)\"\\s*,\\s*dependencies:\\s*\\[[^\\]]*\"(Cart|Checkout)", label: "A base layer can't depend on a feature" },
          ],
          solution: swift`// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MercaditoModules",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "Networking", targets: ["Networking"]),
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
        .library(name: "Cart", targets: ["Cart"]),
        .library(name: "Checkout", targets: ["Checkout"]),
    ],
    targets: [
        .target(name: "Networking"),
        .target(name: "DesignSystem", resources: [.process("Resources")]),
        .target(name: "CheckoutInterface"),
        .target(name: "Cart", dependencies: ["CheckoutInterface", "Networking", "DesignSystem"]),
        .target(name: "Checkout", dependencies: ["CheckoutInterface", "Networking", "DesignSystem"]),
        .testTarget(name: "CartTests", dependencies: ["Cart"]),
        .testTarget(name: "CheckoutTests", dependencies: ["Checkout"]),
    ]
)`,
          hint: "`CheckoutInterface` doesn't need its own product: only targets in the same package consume it.",
        },
        {
          kind: "write",
          prompt: "Write the `CheckoutInterface` module: a `public struct CheckoutRequest` (`cartID: String`, `totalInCents: Int`, `Sendable` and `Equatable`) with its `public init`, and a `public` protocol `CheckoutStarting`, isolated to `@MainActor`, with `func startCheckout(_ request: CheckoutRequest) -> UIViewController`.",
          starter: swift`// Sources/CheckoutInterface/CheckoutStarting.swift
import UIKit
`,
          checks: [
            { pattern: "public\\s+struct\\s+CheckoutRequest\\s*:\\s*[^{]*Sendable", label: "`CheckoutRequest` is public and `Sendable`" },
            { pattern: "public\\s+let\\s+totalInCents\\s*:\\s*Int", label: "Public `totalInCents`" },
            { pattern: "public\\s+init\\s*\\(", label: "Explicit `public init`" },
            { pattern: "@MainActor\\s+public\\s+protocol\\s+CheckoutStarting", label: "`public` protocol on `@MainActor`" },
            { pattern: "func\\s+startCheckout\\s*\\(\\s*_\\s+request\\s*:\\s*CheckoutRequest\\s*\\)\\s*->\\s*UIViewController", label: "`startCheckout(_:)` returns the view controller" },
          ],
          warnings: [
            { pattern: "^import\\s+(Checkout|Networking)\\s*$", label: "The interface shouldn't import the implementation or heavy layers" },
          ],
          solution: swift`// Sources/CheckoutInterface/CheckoutStarting.swift
import UIKit

public struct CheckoutRequest: Sendable, Equatable {
    public let cartID: String
    public let totalInCents: Int

    public init(cartID: String, totalInCents: Int) {
        self.cartID = cartID
        self.totalInCents = totalInCents
    }
}

@MainActor
public protocol CheckoutStarting {
    func startCheckout(_ request: CheckoutRequest) -> UIViewController
}`,
          hint: "Remember that a public struct's memberwise init is `internal`.",
        },
        {
          kind: "predict",
          prompt: "With the new graph, a dev changes `CheckoutViewController`'s private implementation (without touching `CheckoutInterface`). On the incremental build, what gets recompiled?",
          code: swift`App ──▶ Cart, Checkout
Cart ──▶ CheckoutInterface
Checkout ──▶ CheckoutInterface`,
          options: [
            "The whole package, because a file changed",
            "`Checkout`, `Cart` and the app",
            "`Checkout` and the app's link step; not `Cart`, since it only depends on the unchanged interface",
            "Only `CheckoutInterface`",
          ],
          answer: 2,
          explanation: "The touched module and whatever depends on it get rebuilt: the app relinks. `Cart` depends only on `CheckoutInterface`, which didn't change, so it's left alone. Before the split, the same change recompiled the whole target: that's the measurable win.",
        },
        {
          kind: "write",
          prompt: "In the app, write `AppDependencies` (`@MainActor final class`): it creates a `URLSessionHTTPClient`, a `RemoteCartRepository(http:)` and `checkout: any CheckoutStarting = CheckoutFlow(http: http)` (a concrete type from `Checkout`; since it uses `http`, make it a `lazy var`). Add `func makeCartViewModel() -> CartViewModel` passing `repository` and `checkout`.",
          starter: swift`import Networking
import Cart
import CheckoutInterface

@MainActor
final class AppDependencies {
}`,
          checks: [
            { pattern: "^import\\s+Checkout\\s*$", label: "The app imports the `Checkout` implementation" },
            { pattern: "let\\s+http\\s*(:\\s*any\\s+HTTPClient\\s*)?=\\s*URLSessionHTTPClient\\(", label: "Creates the concrete HTTP client" },
            { pattern: "(let|lazy\\s+var)\\s+checkout\\s*:\\s*any\\s+CheckoutStarting\\s*=\\s*CheckoutFlow\\(\\s*http:\\s*http\\s*\\)", label: "Creates `CheckoutFlow` and exposes it as the protocol" },
            { pattern: "func\\s+makeCartViewModel\\s*\\(\\s*\\)\\s*->\\s*CartViewModel", label: "`makeCartViewModel()` factory" },
            { pattern: "CartViewModel\\(\\s*repository:\\s*\\w+\\s*,\\s*checkout:\\s*checkout\\s*\\)", label: "Injects repository and checkout" },
          ],
          warnings: [
            { pattern: "(?<!make)CartViewModel\\(\\s*\\)", label: "A ViewModel without dependencies creates them inside" },
            { pattern: "\\.shared\\b", label: "A singleton inside the composition root hides decisions" },
          ],
          solution: swift`import Networking
import Cart
import CheckoutInterface
import Checkout

@MainActor
final class AppDependencies {
    let http: any HTTPClient = URLSessionHTTPClient()
    lazy var cartRepository: any CartRepository = RemoteCartRepository(http: http)
    lazy var checkout: any CheckoutStarting = CheckoutFlow(http: http)

    func makeCartViewModel() -> CartViewModel {
        CartViewModel(repository: cartRepository, checkout: checkout)
    }
}`,
          hint: "If a property uses another one in its initial value, make it a `lazy var`.",
        },
        {
          kind: "predict",
          prompt: "You write a `CartViewModel` test checking that \"Pay\" starts checkout with the right total, using a `SpyCheckoutStarting`. Which modules does `CartTests` need to depend on?",
          code: swift`final class SpyCheckoutStarting: CheckoutStarting {
    var requests: [CheckoutRequest] = []
    func startCheckout(_ request: CheckoutRequest) -> UIViewController {
        requests.append(request)
        return UIViewController()
    }
}`,
          options: [
            "`Cart` and `CheckoutInterface`; it never needs `Checkout`",
            "`Cart`, `Checkout` and `Networking`",
            "The whole app",
            "Only `Checkout`",
          ],
          answer: 0,
          explanation: "The spy conforms to the `CheckoutInterface` protocol, so the test doesn't need to compile or link the real `Checkout` implementation. That's why `Cart`'s tests run fast and in isolation: the third payoff of modularizing well.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-target-vs-scheme",
      front: "Target vs scheme",
      back: "A target is the recipe for one binary (sources, settings, `Info.plist`, entitlements). A scheme decides which targets get built and with which configuration, test plan, environment variables and arguments they run.",
    },
    {
      id: "fc-inherited",
      front: "What is `$(inherited)` for in a build setting?",
      back: "It appends to the value coming from the level below instead of replacing it. Without it, `SWIFT_ACTIVE_COMPILATION_CONDITIONS = STAGING` wipes the inherited `DEBUG`.",
      code: swift`SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) STAGING`,
    },
    {
      id: "fc-xcconfig-url",
      front: "Why does a URL in `.xcconfig` end up as `https:`?",
      back: "In `.xcconfig`, `//` starts a comment. Escape it with an empty variable: `https:/$()/`.",
      code: swift`API_BASE_URL = https:/$()/api.acme.com`,
    },
    {
      id: "fc-pbxproj",
      front: "Why does `project.pbxproj` cause so many conflicts, and how do you avoid them?",
      back: "Adding one file touches several ID-based sections (`PBXFileReference`, `PBXBuildFile`, group, build phase). Avoid it with synchronized folders (Xcode 16), by generating the project with Tuist/XcodeGen or by moving code into SPM packages.",
    },
    {
      id: "fc-package-resolved",
      front: "Do you commit `Package.resolved` in an app?",
      back: "Yes. It pins each dependency's exact version and commit so every machine and CI build the same thing. Updating is an explicit change visible in the PR.",
    },
    {
      id: "fc-version-rules",
      front: "`from:` vs `.upToNextMinor(from:)` vs `exact:`",
      back: "`from: \"2.3.0\"` → 2.3.0 ..< 3.0.0. `.upToNextMinor(from: \"2.3.0\")` → 2.3.0 ..< 2.4.0. `exact:` → that version only.",
    },
    {
      id: "fc-bundle-module",
      front: "Why does an image from an SPM package render empty?",
      back: "It's looked up in `Bundle.main`, but the package's resources live in their own bundle. Use `bundle: .module` and declare it under `resources` if it isn't an asset catalog.",
      code: swift`Image("empty-cart", bundle: .module)`,
    },
    {
      id: "fc-access-levels",
      front: "`open`, `public`, `package`, `internal`",
      back: "`open`: visible and subclassable outside the module. `public`: visible, not subclassable outside. `package`: visible to every module in the same package. `internal` (default): the module only.",
    },
    {
      id: "fc-public-init",
      front: "Why can't I create a `public struct` from another module?",
      back: "The synthesized memberwise init is `internal`. You need an explicit `public init`.",
    },
    {
      id: "fc-composition-root",
      front: "What is the composition root?",
      back: "The single place, close to launch (`@main`, `SceneDelegate`, `AppDependencies`), where concrete types are created and injected. The rest of the code receives abstractions.",
    },
    {
      id: "fc-hidden-deps",
      front: "Three typical hidden dependencies and how to inject them",
      back: "`URLSession.shared` → an `HTTPClient` protocol. `UserDefaults.standard` → a `KeyValueStore` protocol. `Date()` → a `now: () -> Date` closure.",
    },
    {
      id: "fc-factory-vs-swinject",
      front: "Factory vs Swinject",
      back: "Swinject registers at runtime and `resolve` returns an optional: forgetting a registration crashes. Factory defines each dependency as a computed property: it always returns a value and the compiler checks it.",
    },
    {
      id: "fc-entry",
      front: "How do you declare a custom environment value in modern SwiftUI?",
      back: "With `@Entry` in an `EnvironmentValues` extension (Xcode 16). Read it with `@Environment(\\.key)`, and only inside views.",
      code: swift`extension EnvironmentValues {
    @Entry var analytics: AnalyticsClient = .noop
}`,
    },
    {
      id: "fc-interface-module",
      front: "What's a `FeatureXInterface` module for?",
      back: "It contains only the contract (protocol + minimal models). Other features depend on it instead of the implementation: cycles disappear and X's internal changes don't recompile its consumers.",
    },
    {
      id: "fc-static-dynamic",
      front: "Static vs dynamic",
      back: "Static: copied into every binary that links it (fast launch, gets duplicated). Dynamic: embedded once and loaded at launch (shared, adds launch time). A static library linked into two binaries means two copies and two singletons.",
    },
  ],

  exam: [
    {
      id: "ex-pbxproj-conflicts",
      question: "Four squads work on a monolith and lose hours every sprint resolving `project.pbxproj` conflicts. What's the real fix?",
      options: [
        "Have a single dev add every new file",
        "Always resolve with \"accept theirs\"",
        "Mark `project.pbxproj` as binary in `.gitattributes`",
        "Generate the project (Tuist/XcodeGen) or use synchronized folders, and move code into SPM packages",
      ],
      answer: 3,
      explanation: "The problem is that the project lists files one by one with IDs. Generating the project from a description, using synchronized folders or moving code into SPM removes that list. Marking it binary just prevents merging; \"accept theirs\" loses files.",
    },
    {
      id: "ex-testable-release",
      question: "CI runs the tests in the `Release` configuration and fails with `module 'Cart' was not compiled for testing`. What's going on?",
      code: swift`@testable import Cart`,
      options: [
        "`@testable` requires the module to be compiled with testability, which is only on by default in `Debug`",
        "`@testable` doesn't work with SPM packages",
        "Every type in `Cart` is missing `public`",
        "Tests have to live in the same target as `Cart`",
      ],
      answer: 0,
      explanation: "`ENABLE_TESTABILITY` is `YES` in `Debug` and `NO` in `Release`. Run tests in `Debug` (the norm) or enable testability in the configuration CI uses.",
    },
    {
      id: "ex-package-resolved",
      question: "On Monday CI started failing without anyone touching dependencies. It builds locally. `Package.resolved` is in `.gitignore`. What's the most likely cause?",
      options: [
        "A corrupted Xcode cache on local machines",
        "CI resolved a newer version within the `from:` range that has a breaking change",
        "SPM doesn't support CI",
        "A local `path:` dependency with a typo",
      ],
      answer: 1,
      explanation: "Without `Package.resolved`, each resolution picks the latest version that satisfies the range. A library that shipped a minor with a breaking change reaches CI first. Committing the file makes everyone use exactly the same thing.",
    },
    {
      id: "ex-bundle-module",
      question: "You moved `OnboardingView` into an SPM target with its images in an asset catalog. Now the images render empty, with no errors. What do you fix?",
      code: swift`Image("welcome")`,
      options: [
        "Move the asset catalog back into the app",
        "Add `.copy(\"Assets.xcassets\")` to `resources`",
        "Use `Image(\"welcome\", bundle: .module)`",
        "Use `UIImage(named:)` instead of `Image`",
      ],
      answer: 2,
      explanation: "`Image(\"welcome\")` looks in `Bundle.main`. The target's resources live in the module's bundle, reachable via `Bundle.module`. Asset catalogs are processed automatically; with `.copy` they wouldn't be compiled.",
    },
    {
      id: "ex-flaky-date",
      question: "An \"expired offer\" test fails only when CI runs after 9 p.m. Which change fixes it at the root?",
      code: swift`func isExpired() -> Bool { Date() > offer.endsAt }`,
      options: [
        "Inject a clock (`now: () -> Date`) and pass a fixed date in the test",
        "Run CI during the day",
        "Use `Date.now` instead of `Date()`",
        "Add a `sleep` before the assert",
      ],
      answer: 0,
      explanation: "The test depends on the real clock. By injecting `now`, production uses `Date.init` and the test uses a fixed date: the result is deterministic. `Date.now` is exactly the same as `Date()`.",
    },
    {
      id: "ex-container-runtime",
      question: "After a refactor, the app crashes when opening Favorites with `Unexpectedly found nil` in `container.resolve(...)!`. Which approach would have caught the error at compile time?",
      options: [
        "Swinject with `.inObjectScope(.container)`",
        "Manual DI or Factory, where each dependency is code that always returns a value",
        "Using `resolve(...)?` instead of `!`",
        "Registering everything as a singleton",
      ],
      answer: 1,
      explanation: "In Swinject registration is dynamic: the compiler doesn't know whether it exists. With manual DI the `init` requires the parameter, and in Factory each dependency is a computed property the compiler verifies. With `?` the crash just becomes a silent bug.",
    },
    {
      id: "ex-feature-coupling",
      question: "`Search` needs to open product detail, which lives in `ProductDetail`, and `ProductDetail` already uses `Search` for \"similar products\". How do you solve it?",
      options: [
        "Merge both features into a single module",
        "Use `@testable import` to break the cycle",
        "Have the app pass global closures",
        "Create `ProductDetailInterface` with a builder protocol; `Search` depends on the interface and the app injects the implementation",
      ],
      answer: 3,
      explanation: "The interface module breaks the cycle: `Search` → `ProductDetailInterface` ← `ProductDetail`. The app, as composition root, knows the implementations and connects them. Merging modules throws away the benefits of modularization.",
    },
    {
      id: "ex-static-duplicate",
      question: "After turning `Core` into a dynamic framework, the session token the app stores isn't there when code inside `Core` reads it. Both use `SessionStore.shared` from the static library `Storage`, which both link. Why?",
      options: [
        "Dynamic frameworks can't use singletons",
        "`SessionStore` is missing `@MainActor`",
        "`Storage` got copied into two binaries: there are two different `SessionStore.shared`",
        "The token is saved on another thread",
      ],
      answer: 2,
      explanation: "A static library is copied into every binary that links it. The app and `Core.framework` each have their own `SessionStore`. The fix is linking `Storage` into a single binary (only via `Core`) or making it dynamic.",
    },
    {
      id: "ex-when-modularize",
      question: "Which of these situations most clearly justifies investing in modularization?",
      options: [
        "An 8-screen app maintained by one person",
        "The tech lead read that big apps do it",
        "A 90 s incremental build for any change and three squads blocking each other on the same files",
        "Wanting to use more `public` in the code",
      ],
      answer: 2,
      explanation: "Modularization pays off when it improves concrete metrics: incremental builds, team autonomy and feature isolation. 90 s per change and blocked squads are exactly those problems.",
    },
    {
      id: "ex-package-access",
      question: "`makeDecoder()` is used in `Networking` and in `Catalog` (same SPM package). You don't want the app to see it. Which access level do you use?",
      options: [
        "`package`",
        "`public`",
        "`internal`",
        "`fileprivate`",
      ],
      answer: 0,
      explanation: "`package` (Swift 5.9) makes it visible to every module in the package and hidden from clients. `public` exposes it to the app; `internal` limits it to `Networking`.",
    },
    {
      id: "ex-environment-viewmodel",
      question: "A dev tries to use `@Environment(\\.analytics)` inside an `@Observable final class CheckoutModel` and always gets the default value. What do you recommend?",
      options: [
        "Use `@EnvironmentObject` in the model",
        "Inject analytics through the model's `init` from the composition root (or have the view pass it in)",
        "Call `.environment(\\.analytics, ...)` inside the model",
        "Mark the model `@MainActor`",
      ],
      answer: 1,
      explanation: "Only SwiftUI views resolve the environment. A model isn't part of the view hierarchy, so it gets its dependencies through `init` like any other type.",
    },
    {
      id: "ex-service-locator",
      question: "You see this in a review. What's the problem?",
      code: swift`final class OrdersModel {
    private let deps: AppDependencies
    init(deps: AppDependencies) { self.deps = deps }
    func load() async { await deps.ordersRepository.fetch() }
}`,
      options: [
        "None: it's initializer injection",
        "`AppDependencies` should be a `struct`",
        "It's missing `@MainActor`",
        "It's a service locator: the model depends on the whole container and its real dependencies stay hidden",
      ],
      answer: 3,
      explanation: "Receiving the container isn't injecting dependencies: the `init` doesn't say what the model uses, the test has to build the entire container and the Orders module gets coupled to the app. Inject `any OrdersRepository` directly.",
    },
  ],
};

export default content;
