import type { CourseContent } from "../types";

// Code uses String.raw so `\(...)` backslashes survive.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "push-notifications",
      title: "Push notifications end to end",
      goal: "Set up APNs with a `.p8` key, ask for permission at the right moment, get the device token, build payloads, and handle taps, actions and rich media.",
      minutes: 30,
      steps: [
        {
          kind: "explain",
          title: "The loop: permission, token and APNs",
          body: [
            "A push travels like this: the app registers with APNs and gets a **device token**; the app sends it to your backend; the backend asks APNs to deliver a payload to that token. Your server authenticates with a **`.p8` key** (token-based auth): you create it once in the developer portal, it works for every app on the team, and it doesn't expire like the old `.p12` certificates. The backend signs a JWT with the Key ID and Team ID.",
            "Showing alerts needs permission (`requestAuthorization`); getting a token does not. Call `registerForRemoteNotifications()` **on every launch**: the token can change (backup restore, reinstall), and if your backend keeps a stale one, pushes vanish silently.",
            "The token is `Data`: convert it to hex with `%02x`. Don't use `description`, which stopped returning hex in iOS 13. Also, debug builds talk to the **sandbox** APNs and TestFlight/App Store builds to **production**: a token from one environment doesn't work in the other (the `aps-environment` entitlement decides).",
          ],
          code: swift`import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = PushRouter.shared
        application.registerForRemoteNotifications() // on every launch
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { try? await PushAPI.shared.register(token: token) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        logger.error("APNs: \(error.localizedDescription)")
    }
}

// SwiftUI: @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

// Ask for permission at the right moment (not on first launch)
@MainActor
func enableOrderUpdates() async -> Bool {
    let center = UNUserNotificationCenter.current()
    let settings = await center.notificationSettings()
    guard settings.authorizationStatus == .notDetermined else {
        return settings.authorizationStatus == .authorized
    }
    return (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
}`,
        },
        {
          kind: "predict",
          prompt: "Marketing wants more users with notifications on. When do you ask for permission?",
          code: swift`// App flow:
// 1. First launch → 3-screen onboarding
// 2. Catalog
// 3. First order confirmed → "Want us to tell you when it ships?"
// The system dialog shows up ONCE per install.`,
          options: [
            "In `application(_:didFinishLaunchingWithOptions:)`, so nobody is missed",
            "Never: `registerForRemoteNotifications()` is enough to show alerts",
            "After the first order, with your own screen explaining the benefit, and only then `requestAuthorization`",
            "During onboarding, and if they decline, call `requestAuthorization` again until they accept",
          ],
          answer: 2,
          explanation:
            "The system dialog appears once: if the user says no, only Settings can undo it, and calling `requestAuthorization` again returns `false` without showing anything. So you ask when the benefit is obvious (tracking the order they just placed), with your own pre-prompt first. Asking on first launch with no context lowers the opt-in rate. Registering with APNs gives you a token but doesn't allow alerts. Another option is `.provisional` authorization: it delivers quietly to Notification Center without asking.",
        },
        {
          kind: "predict",
          prompt: "What does this code print?",
          code: swift`import Foundation

let deviceToken = Data([0x0A, 0xFF, 0x01])
let token = deviceToken.map { String(format: "%02x", $0) }.joined()
print(token)`,
          options: ["0aff01", "0AFF01", "aff1", "{length = 3, bytes = 0x0aff01}"],
          answer: 0,
          explanation:
            "Each byte is formatted with `%02x`: lowercase hex, zero-padded to two digits. `0x0A` → `0a`, `0xFF` → `ff`, `0x01` → `01`. Without the `02` you'd drop the zeros (`aff1`) and the backend would get an invalid token. The last option is what `description` returns since iOS 13, which is why you don't use it.",
        },
        {
          kind: "explain",
          title: "Payload anatomy",
          body: [
            "The payload is JSON (4 KB max) with an `aps` dictionary the system interprets and, **outside `aps`**, your own keys (`orderId`). Inside `aps`: `alert` (`title`, `subtitle`, `body`), `badge` (a number), `sound`, `category` (which actions to show), `thread-id` (grouping), `mutable-content` and `content-available`.",
            "`mutable-content: 1` routes the push through your **Notification Service Extension** before it's shown: a separate target that can download an image, attach it as a `UNNotificationAttachment` or decrypt the text. It gets little time; if it runs out, the system calls `serviceExtensionTimeWillExpire()` and you deliver whatever you have.",
            "`content-available: 1` with no `alert` is a **silent push**: it wakes the app in the background to refresh data. It needs the \"Remote notifications\" Background Mode, the `apns-push-type: background` header and `apns-priority: 5`. The system throttles them and may delay or drop them: never rely on them for anything critical.",
          ],
          code: swift`// HTTP/2 headers to APNs
// apns-topic: com.shop.app
// apns-push-type: alert
// apns-priority: 10
{
  "aps": {
    "alert": {
      "title": "Your order is on its way",
      "body": "Arriving in 25 minutes. Tap to follow the route."
    },
    "badge": 1,
    "sound": "default",
    "category": "ORDER_STATUS",
    "thread-id": "order-A-1029",
    "mutable-content": 1
  },
  "orderId": "A-1029",
  "imageURL": "https://cdn.shop.example.com/maps/A-1029.png"
}`,
        },
        {
          kind: "fill",
          prompt: "You want the Notification Service Extension to download the map image before the push is shown. Fill in the key.",
          code: swift`{
  "aps": {
    "alert": { "title": "Your order is on its way", "body": "Tap to follow the route" },
    "____": 1
  },
  "imageURL": "https://cdn.shop.example.com/maps/A-1029.png"
}`,
          accept: ["^mutable-content$"],
          hint: "The extension can *mutate* the content.",
          explanation: "`mutable-content: 1` (together with an `alert`) makes iOS pass the notification through the Notification Service Extension. `content-available` is something else: a silent push for the app.",
        },
        {
          kind: "predict",
          prompt: "The backend sends this push to refresh the inbox. The user had swiped the app away in the app switcher. What happens?",
          code: swift`// apns-push-type: background
// apns-priority: 5
{
  "aps": { "content-available": 1 },
  "inboxVersion": 42
}`,
          options: [
            "The app launches in the background and refreshes as usual",
            "iOS shows an empty alert",
            "APNs returns an error because `alert` is missing",
            "iOS doesn't wake the app: silent pushes don't launch an app the user force-quit",
          ],
          answer: 3,
          explanation:
            "If the user killed the app from the app switcher, iOS respects that and won't relaunch it for background pushes. Even with the app merely suspended, the system may delay or coalesce silent pushes. There's no alert because there's no `alert`, and APNs accepts the payload just fine. Bottom line: a silent push is an optimization; the data still refreshes when the app opens.",
        },
        {
          kind: "explain",
          title: "Actions, categories and taps",
          body: [
            "A **category** groups actions (`UNNotificationAction`) and is registered at launch with `setNotificationCategories`. The payload picks one with `category`. Useful options: `.foreground` opens the app, `.destructive` paints it red, `.authenticationRequired` requires unlocking.",
            "The delegate (`UNUserNotificationCenterDelegate`) has two key methods. `willPresent` decides what to do when a push arrives **with the app in the foreground** (by default nothing is shown). `didReceive` runs when the user **taps** the notification or an action; `actionIdentifier` is `UNNotificationDefaultActionIdentifier` for a plain tap.",
            "Set the delegate in `didFinishLaunching`: if the app cold-starts from a tap and the delegate isn't there yet, you lose that tap. Your own data arrives in `userInfo`; cast with `as?`, never `as!`.",
            "FCM and OneSignal wrap APNs: you still upload the `.p8` key to their console and the app still needs the push entitlement. FCM also swizzles the AppDelegate by default; if you handle the token yourself, turn that off.",
          ],
          code: swift`let track = UNNotificationAction(identifier: "TRACK", title: "Follow route", options: [.foreground])
let cancel = UNNotificationAction(identifier: "CANCEL", title: "Cancel order",
                                  options: [.destructive, .authenticationRequired])
let category = UNNotificationCategory(identifier: "ORDER_STATUS",
                                      actions: [track, cancel], intentIdentifiers: [])
UNUserNotificationCenter.current().setNotificationCategories([category])

// Notification Service Extension (separate target)
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent
        // download imageURL, save it to a temp file and attach it:
        // bestAttempt?.attachments = [try UNNotificationAttachment(identifier: "map", url: fileURL)]
        // contentHandler(bestAttempt!)
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let bestAttempt { contentHandler(bestAttempt) }
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Write `PushRouter`, the notification delegate. With the app open, the push should show as a banner with sound. On tap (plain tap or the `TRACK` action), read `orderId` from `userInfo` and call `await DeepLinkRouter.shared.open(.order(id: orderID))`. Use the `async` versions of the delegate methods.",
          starter: swift`import UserNotifications

final class PushRouter: NSObject {
    static let shared = PushRouter()
    // your code here
}`,
          checks: [
            { pattern: "UNUserNotificationCenterDelegate", label: "Conforms to `UNUserNotificationCenterDelegate`" },
            { pattern: "willPresent\\s+notification:\\s*UNNotification\\)", label: "Implements `willPresent` for the foreground case" },
            { pattern: "\\[\\s*\\.banner", label: "Returns options that include `.banner`" },
            { pattern: "didReceive\\s+response:\\s*UNNotificationResponse\\)", label: "Implements `didReceive response:`" },
            { pattern: "\\.userInfo\\b", label: "Reads custom data from `userInfo`" },
            { pattern: "UNNotificationDefaultActionIdentifier", label: "Detects the plain tap with `UNNotificationDefaultActionIdentifier`" },
          ],
          warnings: [
            { pattern: "as!", label: "Don't force-cast: if the backend omits the key, you crash" },
            { pattern: "\\.alert\\s*[,\\]]", label: "`.alert` as a presentation option is deprecated: use `.banner` and `.list`" },
          ],
          solution: swift`import UserNotifications

final class PushRouter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushRouter()

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let userInfo = response.notification.request.content.userInfo
        guard let orderID = userInfo["orderId"] as? String else { return }

        switch response.actionIdentifier {
        case UNNotificationDefaultActionIdentifier, "TRACK":
            await DeepLinkRouter.shared.open(.order(id: orderID))
        default:
            break
        }
    }
}`,
          hint: "Both methods are named `userNotificationCenter(_:...)`; one takes `willPresent notification:` and the other `didReceive response:`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "deep-links",
      title: "Deep links and universal links",
      goal: "Choose between a URL scheme and a universal link, publish the `apple-app-site-association`, receive the link in SwiftUI and UIKit, and route it to the right screen while validating parameters and session.",
      minutes: 30,
      steps: [
        {
          kind: "explain",
          title: "URL scheme vs universal link",
          body: [
            "A custom **URL scheme** (`shopapp://orders/A-1029`) is declared in `CFBundleURLTypes` in `Info.plist`. It's easy, but any app can claim the same scheme, there's no fallback when the app isn't installed, and Safari shows a confirmation prompt. Use it for internal links (widget → app, OAuth callbacks).",
            "A **universal link** is a regular `https` URL (`https://shop.example.com/orders/A-1029`). If the app is installed and the domain authorizes it, it opens the app; otherwise, the website. Nobody else can claim your domain. This is what you want in emails, SMS, social and marketing.",
            "It takes two sides: the **Associated Domains** entitlement in the app (`applinks:shop.example.com`) and the `apple-app-site-association` file at `https://shop.example.com/.well-known/apple-app-site-association`: over HTTPS, no redirects, no `.json` extension, served as `Content-Type: application/json`. Apple caches it on its CDN, so changes can take a while to land; during development you can use `applinks:shop.example.com?mode=developer`.",
          ],
          code: swift`{
  "applinks": {
    "details": [
      {
        "appIDs": ["ABCDE12345.com.shop.app"],
        "components": [
          { "/": "/orders/internal/*", "exclude": true, "comment": "internal dashboard: web" },
          { "/": "/orders/*", "comment": "order detail" },
          { "/": "/products/*", "?": { "ref": "?*" } }
        ]
      }
    ]
  }
}`,
        },
        {
          kind: "predict",
          prompt: "The AASA has these components in this order. The user taps `https://shop.example.com/orders/internal/7` in Mail. What happens?",
          code: swift`"components": [
  { "/": "/orders/*" },
  { "/": "/orders/internal/*", "exclude": true }
]`,
          options: [
            "Safari opens: `exclude` always takes precedence",
            "The app opens: the first matching component is `/orders/*` and evaluation stops there",
            "Nothing opens because the rules conflict",
            "The app opens only if it was installed from TestFlight",
          ],
          answer: 1,
          explanation:
            "`components` are evaluated in order and the first match wins. `/orders/internal/7` already matches `/orders/*`, so the exclusion is never checked. Exclusions go **before** the general rules, as in the explanation's example.",
        },
        {
          kind: "fill",
          prompt: "Complete the Associated Domains entitlement so the app can open universal links for your domain.",
          code: swift`<key>com.apple.developer.associated-domains</key>
<array>
    <string>____:shop.example.com</string>
</array>`,
          accept: ["^applinks$"],
          hint: "It's the same key the AASA JSON uses.",
          explanation: "`applinks:` is the universal links service. The same entitlement supports other services, like `webcredentials:` for password autofill.",
        },
        {
          kind: "explain",
          title: "Receiving the link: SwiftUI and UIKit",
          body: [
            "In SwiftUI, `onOpenURL` receives both URL schemes and universal links, whether the app is running or cold-starting. One entry point: `router.handle(url)`.",
            "In UIKit with scenes there are three paths: a universal link with the app alive arrives at `scene(_:continue:)` as an `NSUserActivity` of type `NSUserActivityTypeBrowsingWeb` (the URL is in `webpageURL`); a URL scheme arrives at `scene(_:openURLContexts:)`; and on cold start both come in `connectionOptions` inside `scene(_:willConnectTo:options:)`. Forgetting the cold start is the classic bug: \"the link only works if the app was already open\".",
            "Universal links that **don't** open the app: typing the URL in Safari, tapping a same-domain link while on that site, or when the user picked \"Open in Safari\" via long press. That's not your bug.",
          ],
          code: swift`// SwiftUI
WindowGroup {
    RootView()
        .onOpenURL { url in router.handle(url) }
}

// UIKit
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        // ... create the window
        if let activity = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }),
           let url = activity.webpageURL {
            router.handle(url)
        } else if let url = connectionOptions.urlContexts.first?.url {
            router.handle(url)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
              let url = userActivity.webpageURL else { return }
        router.handle(url)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        router.handle(url)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "A link with your URL scheme reaches `router.handle`. What does this print?",
          code: swift`import Foundation

let url = URL(string: "shopapp://orders/42")!
print(url.host() ?? "nil", url.pathComponents)`,
          options: [
            "nil [\"/\", \"orders\", \"42\"]",
            "shopapp [\"orders\", \"42\"]",
            "orders [\"/\", \"42\"]",
            "orders [\"42\"]",
          ],
          answer: 2,
          explanation:
            "With `//` after the scheme, everything up to the next `/` is the **host**: `orders`. The path is `/42` and `pathComponents` includes the root `\"/\"`. In `https://shop.example.com/orders/42`, by contrast, the host is the domain and `orders` is in the path. Your parser has to handle both shapes.",
        },
        {
          kind: "explain",
          title: "Routing with NavigationPath, validating, and waiting for login",
          body: [
            "Turn the URL into an enum (`DeepLink`) in exactly one place and treat everything else as untrusted input: anyone can craft a link. Validate id format and length, ignore unknown routes, and never run destructive actions (pay, delete) straight from a link: take the user to a screen that asks for confirmation.",
            "With `NavigationStack(path:)` the router resets the `NavigationPath` and pushes routes. If the user isn't logged in, keep the link as `pendingLink` and open it after login; otherwise the user logs in and lands on home, losing the context marketing paid to give them.",
          ],
          code: swift`enum Route: Hashable {
    case order(id: String)
    case product(id: Int)
}

@MainActor
@Observable
final class AppRouter {
    var path = NavigationPath()
    var isLoggedIn = false
    var pendingLink: DeepLink?

    func handle(_ url: URL) {
        guard let link = DeepLink(url: url) else { return } // invalid link: ignored
        guard isLoggedIn else { pendingLink = link; return }
        open(link)
    }

    func open(_ link: DeepLink) {
        path = NavigationPath()
        switch link {
        case .order(let id): path.append(Route.order(id: id))
        case .product(let id): path.append(Route.product(id: id))
        }
    }

    func didLogIn() {
        isLoggedIn = true
        if let link = pendingLink {
            pendingLink = nil
            open(link)
        }
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Write `init?(url: URL)` for `DeepLink`. Accept only `https://shop.example.com/orders/<id>` (non-empty id, up to 20 characters, letters, digits or `-`) and `https://shop.example.com/products/<id>` (positive integer id). Anything else returns `nil`.",
          starter: swift`import Foundation

enum DeepLink: Equatable {
    case order(id: String)
    case product(id: Int)
}

extension DeepLink {
    // init?(url:)
}`,
          checks: [
            { pattern: "init\\?\\(url:\\s*URL\\)", label: "Failable initializer `init?(url: URL)`" },
            { pattern: "url\\.scheme", label: "Checks the scheme" },
            { pattern: "url\\.host", label: "Checks the domain" },
            { pattern: "pathComponents", label: "Parses with `pathComponents`" },
            { pattern: "Int\\(", label: "Converts the product id with `Int(...)`" },
            { pattern: "return\\s+nil", label: "Returns `nil` for an invalid URL" },
          ],
          warnings: [{ pattern: "Int\\([^)]*\\)\\s*!", label: "Don't force `Int(...)`: a malformed link would crash the app" }],
          solution: swift`import Foundation

enum DeepLink: Equatable {
    case order(id: String)
    case product(id: Int)
}

extension DeepLink {
    init?(url: URL) {
        guard url.scheme == "https", url.host() == "shop.example.com" else { return nil }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard parts.count == 2 else { return nil }

        switch parts[0] {
        case "orders":
            let id = parts[1]
            let valid = id.count <= 20 && id.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
            guard valid else { return nil }
            self = .order(id: id)
        case "products":
            guard let id = Int(parts[1]), id > 0 else { return nil }
            self = .product(id: id)
        default:
            return nil
        }
    }
}`,
          hint: "Filter the root `\"/\"` out of `pathComponents` and require exactly two parts.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "background-extensions",
      title: "Background work and extensions",
      goal: "Schedule tasks with `BGTaskScheduler`, download with a background `URLSession`, and share data with extensions through App Groups.",
      minutes: 28,
      steps: [
        {
          kind: "explain",
          title: "BGTaskScheduler: you ask, the system decides",
          body: [
            "`BGAppRefreshTask` is for short refreshes (fetch the latest orders). `BGProcessingTask` is for long, deferrable work (cache cleanup, data migration) and can ask to run with network or while charging (`requiresNetworkConnectivity`, `requiresExternalPower`).",
            "Three pieces: (1) declare identifiers in `BGTaskSchedulerPermittedIdentifiers` in `Info.plist` and enable the matching Background Mode (`fetch` or `processing`); (2) **register** the handler before launch finishes; (3) **schedule** with `submit`. `earliestBeginDate` is a minimum, not a time: the system decides based on battery, network and how much the user uses the app.",
            "In the handler: schedule the next one, set an `expirationHandler` that cancels the work, and always call `setTaskCompleted(success:)`. To test without waiting, pause in the debugger and run `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@\"com.shop.app.refreshOrders\"]`. SwiftUI also offers the `.backgroundTask(.appRefresh(\"...\"))` scene modifier.",
          ],
          code: swift`import BackgroundTasks

enum BGIDs {
    static let refresh = "com.shop.app.refreshOrders"
}

// In didFinishLaunching, before returning true
BGTaskScheduler.shared.register(forTaskWithIdentifier: BGIDs.refresh, using: nil) { task in
    handleRefresh(task as! BGAppRefreshTask)
}

func scheduleRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: BGIDs.refresh)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        logger.error("Could not schedule: \(error)")
    }
}

func handleRefresh(_ task: BGAppRefreshTask) {
    scheduleRefresh() // the next one
    let work = Task {
        do {
            try await OrderSync.shared.refresh()
            task.setTaskCompleted(success: true)
        } catch {
            task.setTaskCompleted(success: false)
        }
    }
    task.expirationHandler = { work.cancel() }
}

// Info.plist
// BGTaskSchedulerPermittedIdentifiers: [com.shop.app.refreshOrders]
// UIBackgroundModes: [fetch]`,
        },
        {
          kind: "predict",
          prompt: "At 10:00 you submit a `BGAppRefreshTaskRequest` with `earliestBeginDate` = 10:15. When does it run?",
          code: swift`let request = BGAppRefreshTaskRequest(identifier: "com.shop.app.refreshOrders")
request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
try BGTaskScheduler.shared.submit(request)`,
          options: [
            "Not before 10:15; after that, whenever the system decides (possibly much later, or almost never if the user rarely opens the app)",
            "At exactly 10:15, even if the phone is low on battery",
            "Every 15 minutes starting at 10:15",
            "Immediately, because `earliestBeginDate` is just a priority hint",
          ],
          answer: 0,
          explanation:
            "`earliestBeginDate` is a lower bound. The system batches tasks and favors apps the user opens often. It doesn't repeat on its own, which is why the handler calls `scheduleRefresh()` again. If product asks for \"refresh every 15 minutes exactly\", the answer is push, not background refresh.",
        },
        {
          kind: "fill",
          prompt: "Complete the call that tells the system the task finished successfully.",
          code: swift`func handleRefresh(_ task: BGAppRefreshTask) {
    Task {
        try? await OrderSync.shared.refresh()
        task.____(success: true)
    }
}`,
          accept: ["^setTaskCompleted$"],
          hint: "Set... Task... Completed.",
          explanation: "`setTaskCompleted(success:)` is mandatory. If you skip it, the system treats the task as hung, kills it on expiration, and gives you less background time in the future.",
        },
        {
          kind: "explain",
          title: "Background downloads and App Groups",
          body: [
            "A `URLSession` with `URLSessionConfiguration.background(withIdentifier:)` hands the download to a system process: it keeps going even when your app is suspended. It uses a **delegate**, not completion handlers or `async/await`. The file in `didFinishDownloadingTo` is deleted when the method returns: move it right there. If iOS relaunches the app to report back, `handleEventsForBackgroundURLSession` arrives with a completion handler you call in `urlSessionDidFinishEvents`.",
            "Extensions (widget, share, notification service) are **separate processes** with their own sandbox: the app's `UserDefaults.standard` and files aren't visible there. To share data you use an **App Group** (`group.com.shop.app`), enabled as a capability on the app and on every extension: `UserDefaults(suiteName:)` for small values and `containerURL(forSecurityApplicationGroupIdentifier:)` for files or the database.",
            "A **share extension** shows up in the share sheet according to `NSExtensionActivationRule` (for example, URLs only). It reads the shared items from `extensionContext.inputItems` and finishes with `completeRequest(returningItems:)`. Extensions have no `UIApplication.shared` and tighter memory: do the minimum and leave the rest to the app.",
          ],
          code: swift`final class DownloadManager: NSObject, URLSessionDownloadDelegate {
    static let shared = DownloadManager()
    var backgroundCompletion: (() -> Void)?

    lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: "com.shop.app.downloads")
        config.sessionSendsLaunchEvents = true
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    func download(_ url: URL) { session.downloadTask(with: url).resume() }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didFinishDownloadingTo location: URL) {
        // move it NOW: location is deleted when this method returns
        let destination = SharedStore.containerURL.appending(path: "catalog.zip")
        try? FileManager.default.removeItem(at: destination)
        try? FileManager.default.moveItem(at: location, to: destination)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            self.backgroundCompletion?()
            self.backgroundCompletion = nil
        }
    }
}

enum SharedStore {
    static let groupID = "group.com.shop.app"
    static let defaults = UserDefaults(suiteName: groupID)!
    static var containerURL: URL {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)!
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The app saves the next order and the widget reads it. Both targets compile. What does the widget print?",
          code: swift`// In the app
UserDefaults.standard.set("A-1029", forKey: "nextOrderId")

// In the widget extension
let id = UserDefaults.standard.string(forKey: "nextOrderId")
print(id ?? "no order")`,
          options: ["A-1029", "Optional(\"A-1029\")", "Crashes on read", "no order"],
          answer: 3,
          explanation:
            "The extension runs in another process with its own container: its `UserDefaults.standard` is a different, empty file. `string(forKey:)` returns `nil` and the fallback prints. With `UserDefaults(suiteName: \"group.com.shop.app\")` in both targets (and the App Group enabled on both) it would read `A-1029`.",
        },
        {
          kind: "write",
          prompt:
            "Write `SharedOrderStore` to share the next order between the app and the widget: `save(_:)` stores an `OrderSummary` as JSON in the `UserDefaults` of the `group.com.shop.app` App Group, and `load()` returns it (or `nil`).",
          starter: swift`import Foundation

struct OrderSummary: Codable {
    let id: String
    let title: String
    let eta: Date
}

enum SharedOrderStore {
    // your code here
}`,
          checks: [
            { pattern: "UserDefaults\\(suiteName:", label: "Uses `UserDefaults(suiteName:)`" },
            { pattern: "\"group\\.", label: "The suite is an App Group (`group.`)" },
            { pattern: "JSONEncoder\\(\\)", label: "Encodes with `JSONEncoder`" },
            { pattern: "JSONDecoder\\(\\)", label: "Decodes with `JSONDecoder`" },
            { pattern: "func\\s+load\\(\\)\\s*->\\s*OrderSummary\\?", label: "`load()` returns `OrderSummary?`" },
          ],
          warnings: [
            { pattern: "UserDefaults\\.standard", label: "`UserDefaults.standard` isn't shared with extensions" },
            { pattern: "try!", label: "Don't use `try!`: corrupted data would take the widget down" },
          ],
          solution: swift`import Foundation

struct OrderSummary: Codable {
    let id: String
    let title: String
    let eta: Date
}

enum SharedOrderStore {
    static let groupID = "group.com.shop.app"
    private static let key = "nextOrder"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: groupID) }

    static func save(_ order: OrderSummary) {
        guard let data = try? JSONEncoder().encode(order) else { return }
        defaults?.set(data, forKey: key)
    }

    static func load() -> OrderSummary? {
        guard let data = defaults?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(OrderSummary.self, from: data)
    }

    static func clear() {
        defaults?.removeObject(forKey: key)
    }
}`,
          hint: "Store `Data` with `set(_:forKey:)` and read it back with `data(forKey:)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "widgets-live-activities",
      title: "Widgets and Live Activities",
      goal: "Build a widget with `TimelineProvider`, reload it from the app, make it interactive with App Intents, and show an order's status with ActivityKit and the Dynamic Island.",
      minutes: 32,
      steps: [
        {
          kind: "explain",
          title: "A widget is a timeline, not a live view",
          body: [
            "A widget doesn't run all the time: WidgetKit asks the `TimelineProvider` for a list of dated **entries**, renders each view and shows it at its time. The provider has three methods: `placeholder` (fast, no real data, for the skeleton), `getSnapshot` (for the gallery; if `context.isPreview`, use sample data) and `getTimeline` (the real entries plus a **reload policy**).",
            "Policies: `.atEnd` asks for a new timeline once the last entry passes; `.after(date)` from that date on; `.never` only when the app asks. In every case the system has a reload budget and picks the exact moment.",
            "The reliable way to update is from the app: when the data changes, write it to the App Group and call `WidgetCenter.shared.reloadTimelines(ofKind:)`. The widget reads from the App Group instead of hitting the network.",
          ],
          code: swift`import WidgetKit
import SwiftUI

struct OrderEntry: TimelineEntry {
    let date: Date
    let order: OrderSummary?
}

struct NextOrderProvider: TimelineProvider {
    func placeholder(in context: Context) -> OrderEntry {
        OrderEntry(date: .now, order: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (OrderEntry) -> Void) {
        let order = context.isPreview ? .sample : SharedOrderStore.load()
        completion(OrderEntry(date: .now, order: order))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OrderEntry>) -> Void) {
        let entry = OrderEntry(date: .now, order: SharedOrderStore.load())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NextOrderWidget: Widget {
    let kind = "NextOrder"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextOrderProvider()) { entry in
            NextOrderView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Next order")
        .description("The status of your next order.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}`,
        },
        {
          kind: "predict",
          prompt: "`getTimeline` returned three entries (10:00, 11:00 and 12:00) with the `.atEnd` policy. What happens?",
          code: swift`let entries = [10, 11, 12].map { hour in
    OrderEntry(date: today(at: hour), order: order)
}
completion(Timeline(entries: entries, policy: .atEnd))`,
          options: [
            "The 10:00 entry shows until the app calls `reloadTimelines`",
            "At 11:30 the 11:00 entry shows; after 12:00 WidgetKit asks for a new timeline whenever the system decides",
            "The 12:00 entry always shows because it's the last one",
            "WidgetKit calls `getTimeline` every hour on the hour",
          ],
          answer: 1,
          explanation:
            "Each entry shows from its `date` until the next one. With `.atEnd`, once the last entry passes the widget becomes eligible for a reload, and the system picks the moment based on its budget. There's never an exact-time guarantee.",
        },
        {
          kind: "fill",
          prompt: "The user cancelled the order inside the app. You've already updated the App Group; complete the call so the widget finds out.",
          code: swift`SharedOrderStore.clear()
WidgetCenter.shared.____(ofKind: "NextOrder")`,
          accept: ["^reloadTimelines$"],
          hint: "It reloads the timelines of one widget `kind`.",
          explanation: "`reloadTimelines(ofKind:)` invalidates that widget's timeline and WidgetKit calls `getTimeline` again. There's also `reloadAllTimelines()`, but reloading only what changed protects the budget.",
        },
        {
          kind: "explain",
          title: "Taps and interactive widgets",
          body: [
            "A widget has no regular buttons or closures: tapping it opens the app. `.widgetURL(url)` sets the URL for the whole widget (the only option in the small size) and `Link(destination:)` gives you separate tap areas in medium and large sizes. The URL arrives at `onOpenURL`, so you reuse the deep link router.",
            "Since iOS 17, `Button(intent:)` and `Toggle(isOn:intent:)` run an **App Intent** without opening the app: `perform()` runs, updates the App Group or the backend, and the system reloads the timeline. Note the view doesn't change until the new entry arrives; state lives in your data, not in `@State`.",
          ],
          code: swift`import AppIntents

struct MarkReceivedIntent: AppIntent {
    static let title: LocalizedStringResource = "Mark as received"

    @Parameter(title: "Order")
    var orderID: String

    init() {}
    init(orderID: String) { self.orderID = orderID }

    func perform() async throws -> some IntentResult {
        try await OrderAPI.shared.markReceived(orderID)
        SharedOrderStore.clear()
        return .result()
    }
}

struct NextOrderView: View {
    let entry: OrderEntry

    var body: some View {
        if let order = entry.order {
            VStack(alignment: .leading) {
                Text(order.title).font(.headline)
                Text(order.eta, style: .relative)
                Button(intent: MarkReceivedIntent(orderID: order.id)) {
                    Label("Received", systemImage: "checkmark")
                }
            }
            .widgetURL(URL(string: "shopapp://orders/\(order.id)"))
        } else {
            Text("No orders in progress")
        }
    }
}`,
        },
        {
          kind: "explain",
          title: "Live Activities and the Dynamic Island",
          body: [
            "A Live Activity shows a process with a start and an end (a delivery, a match) on the Lock Screen and in the Dynamic Island. You define it with `ActivityAttributes`: fixed properties live on the struct and what changes lives in `ContentState` (`Codable` and `Hashable`). The app's `Info.plist` needs `NSSupportsLiveActivities = YES`.",
            "You start it **from the app in the foreground** with `Activity.request(attributes:content:pushType:)`, update it with `update` and close it with `end`. With `pushType: .token`, you observe `pushTokenUpdates` and send that token to your backend, which updates the activity through APNs with `apns-push-type: liveactivity` and topic `<bundle id>.push-type.liveactivity`.",
            "The UI lives in the widget extension with `ActivityConfiguration`: a Lock Screen view and a `DynamicIsland` with expanded regions (`.leading`, `.trailing`, `.center`, `.bottom`) plus the `compactLeading`, `compactTrailing` and `minimal` views.",
          ],
          code: swift`import ActivityKit

struct DeliveryAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var status: String
        var etaMinutes: Int
    }
    var orderID: String
}

// APNs payload (apns-push-type: liveactivity)
// { "aps": { "timestamp": 1767312000, "event": "update",
//            "content-state": { "status": "On the way", "etaMinutes": 10 } } }

struct DeliveryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeliveryAttributes.self) { context in
            DeliveryLockScreenView(state: context.state)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "bicycle") }
                DynamicIslandExpandedRegion(.trailing) { Text("\(context.state.etaMinutes) min") }
                DynamicIslandExpandedRegion(.bottom) { Text(context.state.status) }
            } compactLeading: {
                Image(systemName: "bicycle")
            } compactTrailing: {
                Text("\(context.state.etaMinutes)m")
            } minimal: {
                Image(systemName: "bicycle")
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The backend sends this update for the `DeliveryAttributes` from the explanation. What happens?",
          code: swift`// apns-push-type: liveactivity
{
  "aps": {
    "timestamp": 1767312600,
    "event": "update",
    "content-state": { "status": "On the way", "eta": 10 }
  }
}`,
          options: [
            "It shows \"On the way\" and keeps the previous ETA",
            "ActivityKit maps `eta` to `etaMinutes` because they share a prefix",
            "The `content-state` can't be decoded as `ContentState`, so the update isn't applied",
            "The Live Activity ends",
          ],
          answer: 2,
          explanation:
            "`content-state` is decoded with `Codable` into `ContentState`: `etaMinutes` is missing, so decoding fails and the activity doesn't change. Backend keys must match the properties exactly. That's why you version this contract and add new fields as optionals.",
        },
        {
          kind: "write",
          prompt:
            "Define `DeliveryAttributes` (fixed: `orderID`; changing: `status` and `etaMinutes`) and write `startTracking(orderID:)` that starts the Live Activity with status \"Preparing\" and 25 minutes, requesting a push token. First check that the user has Live Activities enabled.",
          starter: swift`import ActivityKit

enum TrackingError: Error { case disabled }

// DeliveryAttributes and startTracking here`,
          checks: [
            { pattern: ":\\s*ActivityAttributes", label: "Conforms to `ActivityAttributes`" },
            { pattern: "struct\\s+ContentState\\s*:\\s*Codable\\s*,\\s*Hashable", label: "`ContentState: Codable, Hashable`" },
            { pattern: "areActivitiesEnabled", label: "Checks `ActivityAuthorizationInfo().areActivitiesEnabled`" },
            { pattern: "Activity\\.request\\(", label: "Starts with `Activity.request`" },
            { pattern: "ActivityContent\\(", label: "Passes the state in an `ActivityContent`" },
            { pattern: "pushType:\\s*\\.token", label: "Requests a token with `pushType: .token`" },
          ],
          solution: swift`import ActivityKit

enum TrackingError: Error { case disabled }

struct DeliveryAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var status: String
        var etaMinutes: Int
    }
    var orderID: String
}

func startTracking(orderID: String) throws -> Activity<DeliveryAttributes> {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw TrackingError.disabled }

    let state = DeliveryAttributes.ContentState(status: "Preparing", etaMinutes: 25)
    let activity = try Activity.request(
        attributes: DeliveryAttributes(orderID: orderID),
        content: ActivityContent(state: state, staleDate: nil),
        pushType: .token
    )

    Task {
        for await data in activity.pushTokenUpdates {
            let token = data.map { String(format: "%02x", $0) }.joined()
            try? await PushAPI.shared.registerActivity(token: token, orderID: orderID)
        }
    }
    return activity
}`,
          hint: "`Activity.request(attributes:content:pushType:)` throws if the activity can't start.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "app-intents-capabilities",
      title: "App Intents and other common capabilities",
      goal: "Expose actions to Siri, Shortcuts and Spotlight with App Intents, and know what each typical capability needs (Apple Pay, location, photos, camera, HealthKit, CloudKit).",
      minutes: 28,
      steps: [
        {
          kind: "explain",
          title: "AppIntent, AppEntity and AppShortcutsProvider",
          body: [
            "An `AppIntent` is an app action the system can run: Siri, Shortcuts, Spotlight, the Action button, widgets. It has a `title`, parameters via `@Parameter`, and an `async throws` `perform()` that returns a result (optionally with a dialog for Siri).",
            "For parameters that are domain objects (an order), define an `AppEntity` with its `EntityQuery`: the system asks it for entities by id (`entities(for:)`) and for suggestions (`suggestedEntities()`). That's how the user picks \"Order A-1029\" in Shortcuts.",
            "`AppShortcutsProvider` publishes ready-to-use shortcuts with zero user setup. Every phrase must include `\\(.applicationName)` so Siri knows which app it's for. All of this is discovered at build time: there's nothing to register at runtime.",
          ],
          code: swift`import AppIntents

struct OrderEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Order"
    static let defaultQuery = OrderQuery()

    var id: String
    var title: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
}

struct OrderQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [OrderEntity] {
        try await OrderAPI.shared.orders(ids: identifiers).map { OrderEntity(id: $0.id, title: $0.title) }
    }

    func suggestedEntities() async throws -> [OrderEntity] {
        try await OrderAPI.shared.recentOrders().map { OrderEntity(id: $0.id, title: $0.title) }
    }
}

struct TrackOrderIntent: AppIntent {
    static let title: LocalizedStringResource = "Track order"
    static let description = IntentDescription("Shows the status of an order.")

    @Parameter(title: "Order")
    var order: OrderEntity

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let status = try await OrderAPI.shared.status(of: order.id)
        return .result(dialog: "\(order.title): \(status)")
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the property wrapper that turns the property into an intent parameter.",
          code: swift`struct ReorderIntent: AppIntent {
    static let title: LocalizedStringResource = "Reorder"

    @____(title: "Order")
    var order: OrderEntity

    func perform() async throws -> some IntentResult { .result() }
}`,
          accept: ["^Parameter$", "^@Parameter$"],
          hint: "It's literally what it is: a parameter.",
          explanation: "`@Parameter` makes Shortcuts and Siri show the field and ask for it when missing. The type can be basic (`String`, `Int`, `Date`), an `AppEnum` or an `AppEntity`.",
        },
        {
          kind: "predict",
          prompt: "What's wrong with this shortcut?",
          code: swift`struct ShopShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: TrackLatestOrderIntent(),
            phrases: ["Track my order"],
            shortTitle: "Track order",
            systemImageName: "shippingbox"
        )
    }
}`,
          options: [
            "The phrase is invalid: every App Shortcut phrase must include `\\(.applicationName)`",
            "The provider has to be registered in `didFinishLaunching`",
            "`systemImageName` only accepts asset catalog images",
            "Nothing: Siri infers the app from context",
          ],
          answer: 0,
          explanation:
            "Every phrase must name the app with `\\(.applicationName)` (for example, \"Track my order in \\(.applicationName)\"); Xcode flags it as invalid otherwise. The provider is discovered at build time, not registered. `systemImageName` is an SF Symbol.",
        },
        {
          kind: "write",
          prompt:
            "You already have `TrackLatestOrderIntent` (no parameters). Write `ShopShortcuts` to publish it as an App Shortcut with two phrases that include the app name, a `shortTitle`, and the `shippingbox` symbol.",
          starter: swift`import AppIntents

struct TrackLatestOrderIntent: AppIntent {
    static let title: LocalizedStringResource = "Track my latest order"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        await DeepLinkRouter.shared.openLatestOrder()
        return .result()
    }
}

// ShopShortcuts here`,
          checks: [
            { pattern: ":\\s*AppShortcutsProvider", label: "Conforms to `AppShortcutsProvider`" },
            { pattern: "static\\s+var\\s+appShortcuts\\s*:\\s*\\[AppShortcut\\]", label: "`static var appShortcuts: [AppShortcut]`" },
            { pattern: "AppShortcut\\(\\s*intent:\\s*TrackLatestOrderIntent\\(\\)", label: "Creates the `AppShortcut` with the intent" },
            { pattern: "\\\\\\(\\.applicationName\\)", label: "Phrases include `\\(.applicationName)`" },
            { pattern: "shortTitle:", label: "Sets `shortTitle`" },
          ],
          solution: swift`import AppIntents

struct TrackLatestOrderIntent: AppIntent {
    static let title: LocalizedStringResource = "Track my latest order"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        await DeepLinkRouter.shared.openLatestOrder()
        return .result()
    }
}

struct ShopShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: TrackLatestOrderIntent(),
            phrases: [
                "Track my order in \(.applicationName)",
                "Where is my \(.applicationName) order",
            ],
            shortTitle: "Track order",
            systemImageName: "shippingbox"
        )
    }
}`,
          hint: "Phrases use interpolation: `\"... \\(.applicationName)\"`.",
        },
        {
          kind: "explain",
          title: "Other capabilities: what each one needs",
          body: [
            "Nearly every capability needs some mix of: an **entitlement** (capability in Xcode and on the App ID), a **usage string** in `Info.plist` (the permission dialog text; if it's missing, the app crashes when requesting access), and **review notes** (how to test the feature, a demo account).",
            "**Apple Pay** (PassKit): Merchant ID + entitlement, `PKPaymentRequest`. Only for physical goods and services consumed outside the app; digital content goes through In-App Purchase. **Location**: `NSLocationWhenInUseUsageDescription`; ask for \"Always\" only with a clear reason (review pushes back), and background location needs its Background Mode. **Photos**: `PhotosPicker` runs out of process and needs no permission; you only need `NSPhotoLibraryAddUsageDescription` if you save. **Camera**: `NSCameraUsageDescription`.",
            "**HealthKit**: entitlement + `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription`; the app can't tell whether the user denied *read* access (for privacy it looks like \"no data\"). **CloudKit**: iCloud capability with an `iCloud.com.shop.app` container; before shipping, deploy the schema to production from the CloudKit console or the App Store build won't find its record types.",
          ],
          code: swift`import PhotosUI
import SwiftUI

struct AvatarPicker: View {
    @State private var selection: PhotosPickerItem?
    @State private var imageData: Data?

    var body: some View {
        PhotosPicker("Choose photo", selection: $selection, matching: .images)
            .task(id: selection) {
                imageData = try? await selection?.loadTransferable(type: Data.self)
            }
    }
}

// Info.plist (only what you use)
// NSCameraUsageDescription: "To scan your order's QR code."
// NSLocationWhenInUseUsageDescription: "To show stores near you."
// NSHealthShareUsageDescription: "To add your steps to the challenge."
// Entitlements: com.apple.developer.in-app-payments, com.apple.developer.healthkit,
//               com.apple.developer.icloud-container-identifiers`,
        },
        {
          kind: "predict",
          prompt: "You added a QR scanner. `Info.plist` has no `NSCameraUsageDescription`. What happens when this runs?",
          code: swift`import AVFoundation

func startScanner() async {
    let granted = await AVCaptureDevice.requestAccess(for: .video)
    print(granted ? "camera ok" : "no permission")
}`,
          options: [
            "Prints `no permission` without showing a dialog",
            "Shows the dialog with generic system text",
            "Prints `camera ok` because the simulator doesn't require permission",
            "The app crashes: iOS requires the usage string before accessing the camera",
          ],
          answer: 3,
          explanation:
            "Without the matching privacy key, iOS terminates the app when it tries to access the protected resource (the log says why). That's why every new capability in a PR must ship with its usage string, written for the user: review rejects vague text like \"we need the camera\".",
        },
        {
          kind: "predict",
          prompt: "Product wants to sell video courses watched inside the app and charge with Apple Pay \"to avoid the fee\". What happens?",
          code: swift`let request = PKPaymentRequest()
request.merchantIdentifier = "merchant.com.shop.app"
request.paymentSummaryItems = [
    PKPaymentSummaryItem(label: "Cooking course", amount: 19.99)
]`,
          options: [
            "It works: Apple Pay is meant for any payment",
            "App Review rejects it: digital content consumed in the app must be sold with In-App Purchase; Apple Pay is for physical goods and services",
            "It works only if the price is under 20 dollars",
            "It works if the merchant ID is verified",
          ],
          answer: 1,
          explanation:
            "The App Review Guidelines require In-App Purchase to unlock digital content or features inside the app. Apple Pay is for physical goods (the delivery, a T-shirt) or services consumed outside the app. The merchant ID doesn't change the rule.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: next-order widget with deep link",
      goal: "Combine App Groups, WidgetKit, deep links, universal links and push so the order can be seen and opened from any system surface.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "Product asks for: (1) a \"Next order\" widget showing title and ETA, reading from the App Group what the app already saved with `SharedOrderStore`; (2) tapping the widget opens that order's screen via `shopapp://orders/<id>`; (3) tracking emails use `https://shop.example.com/orders/<id>` and must open the app, except `/orders/internal/*`; (4) when the status changes, a visible push with actions and a map opens the same detail screen.",
            "Everything converges on a single router: widget, universal link and push all end up in `router.handle(url)` or `router.open(link)`, and the router takes care of the session.",
            "Assumptions: Team ID `ABCDE12345`, bundle `com.shop.app`, App Group `group.com.shop.app`, `DeepLink(url:)` accepts both URL shapes, and `AppRouter` is the one from lesson 2.",
          ],
          code: swift`// Surfaces → one router
// Widget        → .widgetURL(shopapp://orders/A-1029) → onOpenURL
// Mail/SMS      → https://shop.example.com/orders/A-1029 → onOpenURL
// Push (tap)    → userInfo["orderId"] → router.open(.order(id:))
//
// Shared data: App Group "group.com.shop.app"
// The app writes → SharedOrderStore.save(order) → WidgetCenter.reloadTimelines(ofKind: "NextOrder")`,
        },
        {
          kind: "write",
          prompt:
            "Write the widget's `TimelineProvider` (`placeholder`, `getSnapshot`, `getTimeline`) reading from `SharedOrderStore.load()`, with a reload after 30 minutes. In `NextOrderView`, make the whole widget open `shopapp://orders/<id>`.",
          starter: swift`import WidgetKit
import SwiftUI

struct OrderEntry: TimelineEntry {
    let date: Date
    let order: OrderSummary?
}

// NextOrderProvider here

struct NextOrderView: View {
    let entry: OrderEntry
    var body: some View {
        if let order = entry.order {
            VStack(alignment: .leading) {
                Text(order.title).font(.headline)
                Text(order.eta, style: .relative)
            }
        } else {
            Text("No orders in progress")
        }
    }
}`,
          checks: [
            { pattern: ":\\s*TimelineProvider", label: "Conforms to `TimelineProvider`" },
            { pattern: "func\\s+placeholder\\(", label: "Implements `placeholder`" },
            { pattern: "func\\s+getSnapshot\\(", label: "Implements `getSnapshot`" },
            { pattern: "func\\s+getTimeline\\(", label: "Implements `getTimeline`" },
            { pattern: "SharedOrderStore\\.load\\(\\)", label: "Reads the App Group with `SharedOrderStore.load()`" },
            { pattern: "policy:\\s*\\.after\\(", label: "`.after(...)` policy" },
            { pattern: "\\.widgetURL\\(", label: "Opens the order with `.widgetURL`" },
          ],
          warnings: [{ pattern: "URLSession", label: "The widget reads what the app already saved; no network needed" }],
          solution: swift`import WidgetKit
import SwiftUI

struct OrderEntry: TimelineEntry {
    let date: Date
    let order: OrderSummary?
}

struct NextOrderProvider: TimelineProvider {
    func placeholder(in context: Context) -> OrderEntry {
        OrderEntry(date: .now, order: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (OrderEntry) -> Void) {
        let order = context.isPreview ? .sample : SharedOrderStore.load()
        completion(OrderEntry(date: .now, order: order))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OrderEntry>) -> Void) {
        let entry = OrderEntry(date: .now, order: SharedOrderStore.load())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NextOrderView: View {
    let entry: OrderEntry
    var body: some View {
        if let order = entry.order {
            VStack(alignment: .leading) {
                Text(order.title).font(.headline)
                Text(order.eta, style: .relative)
            }
            .widgetURL(URL(string: "shopapp://orders/\(order.id)"))
        } else {
            Text("No orders in progress")
        }
    }
}`,
        },
        {
          kind: "write",
          prompt:
            "Write the `apple-app-site-association` for `shop.example.com`: the `ABCDE12345.com.shop.app` app opens `/orders/*`, except `/orders/internal/*`, which must stay on the web. Use the modern `components` format.",
          starter: swift`{
  "applinks": {
    "details": [
    ]
  }
}`,
          checks: [
            { pattern: "\"applinks\"", label: "`applinks` section" },
            { pattern: "\"appIDs\"\\s*:\\s*\\[\\s*\"ABCDE12345\\.com\\.shop\\.app\"", label: "`appIDs` with Team ID + bundle ID" },
            { pattern: "\"components\"\\s*:", label: "Uses `components`" },
            { pattern: "\"/\"\\s*:\\s*\"/orders/internal/\\*\"\\s*,\\s*\"exclude\"\\s*:\\s*true[\\s\\S]*\"/\"\\s*:\\s*\"/orders/\\*\"", label: "The `/orders/internal/*` exclusion comes before `/orders/*`" },
          ],
          warnings: [{ pattern: "\"paths\"\\s*:", label: "`paths` is the old format; use `components`" }],
          solution: swift`{
  "applinks": {
    "details": [
      {
        "appIDs": ["ABCDE12345.com.shop.app"],
        "components": [
          { "/": "/orders/internal/*", "exclude": true, "comment": "internal dashboard: stays on the web" },
          { "/": "/orders/*", "comment": "order detail" }
        ]
      }
    ]
  }
}`,
          hint: "First match wins: the exclusion goes first.",
        },
        {
          kind: "write",
          prompt:
            "Write the payload for the \"Your order is on its way\" push: an alert with title and body, sound, the `ORDER_STATUS` category (with the actions from lesson 1), routed through the Notification Service Extension to attach the map, and the `orderId` `A-1029` for the router.",
          starter: swift`{
  "aps": {
  }
}`,
          checks: [
            { pattern: "\"aps\"\\s*:", label: "`aps` dictionary" },
            { pattern: "\"alert\"\\s*:\\s*\\{[^}]*\"title\"", label: "`alert` with `title`" },
            { pattern: "\"category\"\\s*:\\s*\"ORDER_STATUS\"", label: "`ORDER_STATUS` category" },
            { pattern: "\"mutable-content\"\\s*:\\s*1", label: "`mutable-content: 1` for the extension" },
            { pattern: "\"orderId\"\\s*:\\s*\"A-1029\"", label: "`orderId` for the router" },
          ],
          warnings: [
            { pattern: "\"aps\"\\s*:\\s*\\{[^}]*\"orderId\"", label: "Custom keys go outside `aps`" },
            { pattern: "\"content-available\"", label: "It's a visible push: no need for `content-available`" },
          ],
          solution: swift`{
  "aps": {
    "alert": {
      "title": "Your order is on its way",
      "body": "Arriving in 25 minutes. Tap to follow the route."
    },
    "sound": "default",
    "category": "ORDER_STATUS",
    "mutable-content": 1
  },
  "orderId": "A-1029",
  "imageURL": "https://cdn.shop.example.com/maps/A-1029.png"
}`,
        },
        {
          kind: "write",
          prompt:
            "Close the loop in the app: `ShopApp` creates the `AppRouter` as `@State`, builds a `NavigationStack` bound to `router.path` with `navigationDestination(for: Route.self)`, and receives links with `onOpenURL`. Complete `AppRouter.handle(_:)` (assume the router has `path`, `isLoggedIn`, `pendingLink` and `open(_:)` as in lesson 2, but no `handle` yet): parse with `DeepLink(url:)` and, if there's no session, store the link in `pendingLink`.",
          starter: swift`import SwiftUI

@main
struct ShopApp: App {
    var body: some Scene {
        WindowGroup {
            HomeView()
        }
    }
}

extension AppRouter {
    func handle(_ url: URL) {
        // your code here
    }
}`,
          checks: [
            { pattern: "@State\\s+(private\\s+)?var\\s+router\\s*=\\s*AppRouter\\(\\)", label: "The router lives in a `@State`" },
            { pattern: "NavigationStack\\(path:\\s*\\$router\\.path\\)", label: "`NavigationStack(path: $router.path)`" },
            { pattern: "\\.navigationDestination\\(for:\\s*Route\\.self\\)", label: "`navigationDestination(for: Route.self)`" },
            { pattern: "\\.onOpenURL\\s*\\{", label: "Receives links with `onOpenURL`" },
            { pattern: "DeepLink\\(url:", label: "Parses with `DeepLink(url:)`" },
            { pattern: "pendingLink\\s*=", label: "Stores the link when there's no session" },
          ],
          warnings: [{ pattern: "DeepLink\\(url:[^)]*\\)!", label: "Don't force the parse: an invalid link is ignored" }],
          solution: swift`import SwiftUI

@main
struct ShopApp: App {
    @State private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $router.path) {
                HomeView()
                    .navigationDestination(for: Route.self) { route in
                        switch route {
                        case .order(let id): OrderDetailView(orderID: id)
                        case .product(let id): ProductView(productID: id)
                        }
                    }
            }
            .onOpenURL { url in router.handle(url) }
            .environment(router)
        }
    }
}

extension AppRouter {
    func handle(_ url: URL) {
        guard let link = DeepLink(url: url) else { return }
        guard isLoggedIn else {
            pendingLink = link
            return
        }
        open(link)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "QA reports: \"I cancel the order in the app and the widget keeps showing it for a long time\". What's missing?",
          code: swift`func cancel(_ order: OrderSummary) async throws {
    try await OrderAPI.shared.cancel(order.id)
    SharedOrderStore.clear()
}

// Widget provider:
// completion(Timeline(entries: [entry], policy: .after(now + 30 min)))`,
          options: [
            "Switch the policy to `.atEnd` so it reloads on its own",
            "Have the widget call the API on every `getTimeline`",
            "Call `WidgetCenter.shared.reloadTimelines(ofKind: \"NextOrder\")` after writing to the App Group",
            "Send a silent push to wake the widget",
          ],
          answer: 2,
          explanation:
            "The App Group data already changed, but WidgetKit doesn't know: it keeps showing the old entry until the next reload the system decides on. `reloadTimelines(ofKind:)` from the app is the direct way. Changing the policy forces nothing, calling the API doesn't help if nobody asks for the timeline, and a silent push doesn't wake widgets.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-p8-key",
      front: "Why authenticate with APNs using a `.p8` key instead of a `.p12` certificate?",
      back: "The `.p8` (token-based) works for every app on the team and doesn't expire; the backend signs a JWT with the Key ID and Team ID. A `.p12` is per app and expires yearly.",
    },
    {
      id: "fc-when-ask",
      front: "When do you ask for notification permission?",
      back: "When the benefit is obvious (after the first order), with your own screen first. The system dialog shows once; if declined, only Settings can undo it. Alternative: `.provisional`.",
    },
    {
      id: "fc-device-token",
      front: "How do you handle the device token?",
      back: "Call `registerForRemoteNotifications()` on every launch, convert the `Data` to hex with `%02x`, and send it to the backend. It can change, and it depends on the environment (sandbox or production).",
      code: `let token = deviceToken.map { String(format: "%02x", $0) }.joined()`,
    },
    {
      id: "fc-payload",
      front: "Where do custom keys go in a push payload?",
      back: "Outside `aps`. Inside `aps` goes only what the system interprets: `alert`, `badge`, `sound`, `category`, `thread-id`, `mutable-content`, `content-available`. 4 KB max.",
    },
    {
      id: "fc-silent-push",
      front: "What is a silent push and what are its limits?",
      back: "`content-available: 1` with no alert, `apns-push-type: background`, priority 5. It wakes the app to refresh, but the system can delay or drop it and won't launch an app the user force-quit.",
    },
    {
      id: "fc-service-extension",
      front: "What is the Notification Service Extension for?",
      back: "It modifies a visible push before it's shown (attach an image, decrypt). It's triggered by `mutable-content: 1`; if time runs out, deliver what you have in `serviceExtensionTimeWillExpire()`.",
    },
    {
      id: "fc-scheme-vs-universal",
      front: "URL scheme vs universal link",
      back: "Scheme (`shopapp://`): easy, no fallback, any app can claim it; for internal links. Universal link (`https://`): opens the app or the web, only you control the domain; for emails and marketing.",
    },
    {
      id: "fc-aasa",
      front: "`apple-app-site-association` requirements",
      back: "At `/.well-known/apple-app-site-association`, over HTTPS, no redirects, no extension, JSON. `appIDs` = TeamID.bundleID. `components` are evaluated in order: exclusions first. Plus the `applinks:domain` entitlement.",
    },
    {
      id: "fc-receive-links",
      front: "Where do links arrive in SwiftUI and UIKit?",
      back: "SwiftUI: `onOpenURL` (scheme and universal). UIKit: `scene(_:continue:)` for universal links, `scene(_:openURLContexts:)` for schemes, and `connectionOptions` in `willConnectTo` for cold start.",
    },
    {
      id: "fc-bgtask",
      front: "The three pieces of `BGTaskScheduler`",
      back: "Identifiers in `BGTaskSchedulerPermittedIdentifiers` + Background Mode; `register` before launch finishes; `submit` the request. In the handler: reschedule, `expirationHandler`, and `setTaskCompleted(success:)`.",
    },
    {
      id: "fc-app-groups",
      front: "How does the app share data with its extensions?",
      back: "With an App Group enabled on every target: `UserDefaults(suiteName: \"group...\")` for small values and `containerURL(forSecurityApplicationGroupIdentifier:)` for files or the database.",
    },
    {
      id: "fc-timeline",
      front: "`TimelineProvider` methods and reload policies",
      back: "`placeholder` (skeleton), `getSnapshot` (gallery) and `getTimeline` (entries + policy). Policies: `.atEnd`, `.after(date)` and `.never`. The app forces a reload with `WidgetCenter.shared.reloadTimelines(ofKind:)`.",
    },
    {
      id: "fc-live-activity",
      front: "Pieces of a Live Activity",
      back: "`ActivityAttributes` (fixed) + `ContentState` (changing; `Codable, Hashable`), `NSSupportsLiveActivities`, `Activity.request(...)` from the foreground, push updates with `apns-push-type: liveactivity`, and `ActivityConfiguration` with the `DynamicIsland` in the extension.",
    },
    {
      id: "fc-app-intent",
      front: "What does an App Intent need to show up in Siri with zero setup?",
      back: "An `AppIntent` with `title` and `perform()`, and an `AppShortcutsProvider` with phrases that include `\\(.applicationName)`. For domain parameters: `AppEntity` + `EntityQuery`.",
    },
    {
      id: "fc-usage-strings",
      front: "What happens if a usage string like `NSCameraUsageDescription` is missing?",
      back: "The app crashes when requesting access. Every permission-gated capability needs its `Info.plist` key with clear user-facing text. `PhotosPicker` is the exception: picking needs no permission.",
    },
  ],

  exam: [
    {
      id: "ex-token-stale",
      question:
        "After users move to a new iPhone by restoring a backup, they stop getting pushes. The backend stores the token only at account signup. What's the fix?",
      code: swift`// Only at signup:
UIApplication.shared.registerForRemoteNotifications()
// didRegister... → POST /signup/push-token`,
      options: [
        "Call `requestAuthorization` again on every launch",
        "Call `registerForRemoteNotifications()` on every launch and send the token to the backend whenever it arrives (or changes)",
        "Store the token in the Keychain so it survives the restore",
        "Switch to silent pushes, which don't use tokens",
      ],
      answer: 1,
      explanation:
        "The token can change across devices, reinstalls and restores. Registering on every launch is cheap and keeps the backend's token current. Restoring an old one from the Keychain makes it worse, and every push needs a token.",
    },
    {
      id: "ex-sandbox-prod",
      question:
        "Pushes arrive when you install from Xcode but not on the TestFlight build. The backend gets \"BadDeviceToken\". What's most likely?",
      options: [
        "TestFlight doesn't support notifications",
        "`mutable-content` is missing from the payload",
        "The user denied permission",
        "The backend sends to the sandbox APNs; TestFlight/App Store builds use production tokens",
      ],
      answer: 3,
      explanation:
        "Debug builds use the development environment (`aps-environment = development`) and distributed builds use production. A production token sent to `api.sandbox.push.apple.com` returns `BadDeviceToken`. The backend has to know each token's environment.",
    },
    {
      id: "ex-rich-push",
      question:
        "You added a Notification Service Extension that attaches the product photo, but pushes arrive without the image and the extension code never runs. What's missing?",
      code: swift`{ "aps": { "alert": { "title": "Price drop", "body": "Sneakers 50% off" } },
  "imageURL": "https://cdn.shop.example.com/p/123.jpg" }`,
      options: [
        "`\"mutable-content\": 1` inside `aps`",
        "`\"content-available\": 1` inside `aps`",
        "Moving `imageURL` inside `alert`",
        "Asking the user for photo library permission",
      ],
      answer: 0,
      explanation:
        "Without `mutable-content: 1`, iOS shows the notification as is and never invokes the extension. `content-available` is for silent pushes to the app. The custom URL is fine outside `aps`, and attaching an image needs no photo permission.",
    },
    {
      id: "ex-universal-safari",
      question:
        "Universal links open Safari instead of the app. The app has `applinks:shop.example.com`. The server does this. What's the problem?",
      code: swift`GET https://shop.example.com/.well-known/apple-app-site-association
→ 301 Moved Permanently
   Location: https://www.shop.example.com/.well-known/apple-app-site-association`,
      options: [
        "The file is missing its `.json` extension",
        "The AASA must live at the root, not in `.well-known`",
        "The AASA must be served directly over HTTPS from that domain, without redirects",
        "Universal links only work for apps published on the App Store",
      ],
      answer: 2,
      explanation:
        "The system doesn't follow redirects when fetching the AASA. It must return 200 at `https://shop.example.com/.well-known/apple-app-site-association`, with no extension. If you also want `www`, that domain needs its own `applinks:` entry and its own file.",
    },
    {
      id: "ex-aasa-order",
      question: "You want all of `/account/*` to open the app except `/account/delete`, which must stay on the web. Which `components` are correct?",
      options: [
        "`[{\"/\": \"/account/*\"}, {\"/\": \"/account/delete\", \"exclude\": true}]`",
        "`[{\"/\": \"/account/*\", \"exclude\": \"/account/delete\"}]`",
        "`[{\"/\": \"/account/delete\", \"exclude\": true}, {\"/\": \"/account/*\"}]`",
        "`[{\"/\": \"/account/*\"}]` and filter `delete` in `onOpenURL`",
      ],
      answer: 2,
      explanation:
        "The first matching component wins, so the exclusion goes first. In the first option `/account/*` catches everything before reaching the exclusion. `exclude` is a boolean. Filtering in the app doesn't help: the link already opened the app instead of the web.",
    },
    {
      id: "ex-logged-out",
      question: "A logged-out user taps a universal link to an order. Today they end up on home after logging in. What do you do?",
      options: [
        "Keep the `DeepLink` as pending, show login and, once logged in, open the stored link",
        "Open the order detail without a session and let the API fail",
        "Ignore links when there's no session",
        "Save the URL in `UserDefaults.standard` for the next time they open the app",
      ],
      answer: 0,
      explanation:
        "The router holds the already-validated link and runs it in `didLogIn()`, within the same session. Showing a screen that's going to fail is bad UX, ignoring the link loses the conversion, and persisting it for \"next time\" opens it out of context.",
    },
    {
      id: "ex-bg-exact",
      question: "Product asks to sync the catalog \"exactly every 15 minutes even when the app is closed\". What do you answer?",
      options: [
        "A `BGAppRefreshTaskRequest` with a 15-minute `earliestBeginDate` guarantees it",
        "A 15-minute `Timer` in `applicationDidEnterBackground`",
        "A `BGProcessingTask` with `requiresExternalPower = false` runs on time",
        "iOS doesn't guarantee periodic execution: `BGTaskScheduler` runs when the system decides. If something must happen at a given time, the server triggers it (push) or the app syncs on open",
      ],
      answer: 3,
      explanation:
        "`earliestBeginDate` is a minimum and frequency depends on usage, battery and network. A `Timer` doesn't run while the app is suspended. The professional answer is to reframe: refresh on open, background refresh as an optimization, and push when the server knows something changed.",
    },
    {
      id: "ex-widget-data",
      question: "The widget always shows \"No orders\" even though the app has an active order. Both use `UserDefaults.standard`. What's the cause?",
      options: [
        "The widget has no network permission",
        "The extension is a separate process with its own container; you need an App Group on both targets and `UserDefaults(suiteName:)`",
        "`UserDefaults` doesn't work in extensions",
        "You must call `synchronize()` after every write",
      ],
      answer: 1,
      explanation:
        "Each target has its own sandbox. `UserDefaults` does work in extensions, but each one's `standard` is different. With the App Groups capability on the app and the widget, and the same `suiteName`, they share data. `synchronize()` isn't needed nowadays.",
    },
    {
      id: "ex-widget-reload",
      question: "The user marks an order as delivered in the app. What's the right way to have the widget reflect it soon?",
      options: [
        "Update the App Group and call `WidgetCenter.shared.reloadTimelines(ofKind: \"NextOrder\")`",
        "Use a `.after(.now)` policy so it reloads every second",
        "Return 60 entries, one per minute, from every `getTimeline`",
        "Send a silent push to the widget extension",
      ],
      answer: 0,
      explanation:
        "The app knows when the data changed: it writes and asks for a reload of that `kind`. Very frequent reloads burn the widget's budget and the system throttles them. Silent pushes go to the app, not to widget extensions.",
    },
    {
      id: "ex-live-activity-push",
      question:
        "Live Activities update fine with a local `activity.update`, but push updates change nothing. APNs returns 200. The `ContentState` is `{ status: String, etaMinutes: Int }` and the backend sends this. What's going on?",
      code: swift`{ "aps": { "timestamp": 1767312600, "event": "update",
           "content-state": { "status": "On the way", "eta_minutes": 10 } } }`,
      options: [
        "`\"alert\"` is missing: without an alert there's no update",
        "The topic must be the plain bundle ID",
        "The `content-state` keys don't match the `ContentState` properties (`eta_minutes` vs `etaMinutes`), so it isn't decoded",
        "Live Activities only update via push while the app is in the foreground",
      ],
      answer: 2,
      explanation:
        "APNs accepts the payload, but on device `content-state` is decoded into `ContentState` and fails. The `alert` is optional (it's for alerting about the change). The correct topic is `<bundle>.push-type.liveactivity`, but a wrong one would make APNs fail, not return 200. The whole point of push updates is that they work with the app closed.",
    },
    {
      id: "ex-app-shortcuts",
      question: "You want \"Track my order\" to work in Siri right after install, without the user creating anything in Shortcuts. What do you need?",
      options: [
        "Donate an `NSUserActivity` every time the user opens an order",
        "An `AppIntent` and an `AppShortcutsProvider` with phrases that include `\\(.applicationName)`",
        "A SiriKit extension with `INExtension`",
        "Register the intent in `didFinishLaunching` with `AppShortcutsProvider.register()`",
      ],
      answer: 1,
      explanation:
        "App Shortcuts are declared in code and the system discovers them at install; there's no runtime registration. Donating activities helps suggestions but doesn't create fixed phrases, and SiriKit with `INExtension` is the older approach.",
    },
    {
      id: "ex-capabilities-review",
      question:
        "A PR adds: a profile photo picker with `PhotosPicker`, a \"near you\" feature with location, and a premium subscription to in-app content paid with Apple Pay. What do you flag in review?",
      options: [
        "`NSPhotoLibraryUsageDescription` is missing for `PhotosPicker`; everything else is fine",
        "Location must be requested as \"Always\" so \"near you\" always works",
        "All good: Apple Pay lowers the fee",
        "`PhotosPicker` needs no permission; location needs `NSLocationWhenInUseUsageDescription`; and a subscription to digital content must use In-App Purchase, not Apple Pay",
      ],
      answer: 3,
      explanation:
        "`PhotosPicker` runs out of process and only returns what the user picks. \"Near you\" only needs \"When In Use\" with its usage string; asking for \"Always\" without need is a rejection risk and erodes trust. Digital content consumed in the app is sold with IAP.",
    },
  ],
};

export default content;
