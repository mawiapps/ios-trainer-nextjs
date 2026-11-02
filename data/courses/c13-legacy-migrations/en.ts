import type { CourseContent } from "../types";

// Code uses String.raw so backslashes in `\(...)` survive. Works for Swift and Objective-C alike.
const swift = String.raw;
const objc = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "reading-objc",
      title: "Reading Objective-C without fear",
      goal: "Read a `.h` and a `.m`, understand property attributes and nullability, and know how that code looks from Swift (and the other way around).",
      minutes: 24,
      steps: [
        {
          kind: "explain",
          title: "Two files: `.h` and `.m`",
          body: [
            "In Objective-C every class lives in two files. The `.h` (header) is the public interface: what others see when they `#import` it. The `.m` is the implementation. Anything not in the `.h` is effectively private.",
            "`@interface ... @end` declares the class and `@implementation ... @end` implements it. Methods starting with `-` are instance methods; methods starting with `+` are class methods (like `static func`).",
            "Calling a method is **sending a message**: `[receiver message:arg otherLabel:arg]`. The full method name (the selector) joins every part: `initWithName:age:`. `@\"Ana\"` is an `NSString` literal.",
            "One thing that surprises Swift developers: messaging `nil` **does not crash**. It returns `nil`, `0` or `NO` depending on the type. That's why some legacy bugs never blow up: they just silently do nothing.",
          ],
          code: objc`// LegacyUser.h — the public interface
#import <Foundation/Foundation.h>

@interface LegacyUser : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic, assign) NSInteger age;
- (instancetype)initWithName:(NSString *)name age:(NSInteger)age;
- (BOOL)isAdult;
+ (LegacyUser *)guestUser;
@end

// LegacyUser.m — the implementation
#import "LegacyUser.h"

@implementation LegacyUser
- (instancetype)initWithName:(NSString *)name age:(NSInteger)age {
    self = [super init];
    if (self) {
        _name = [name copy];   // _name is the instance variable backing the property
        _age = age;
    }
    return self;
}

- (BOOL)isAdult {
    return self.age >= 18;
}

+ (LegacyUser *)guestUser {
    return [[LegacyUser alloc] initWithName:@"Guest" age:0];
}
@end

// Usage: alloc + init, and messages in square brackets
LegacyUser *user = [[LegacyUser alloc] initWithName:@"Ana" age:30];
BOOL adult = [user isAdult];`,
        },
        {
          kind: "predict",
          prompt: "What happens when this snippet runs?",
          code: objc`LegacyUser *user = nil;
NSInteger age = [user age];
BOOL adult = [user isAdult];`,
          options: [
            "Crash with `EXC_BAD_ACCESS` on the first message",
            "Doesn't compile: `user` may be `nil`",
            "`age` is 0 and `adult` is `NO`, no crash",
            "Throws `NSInvalidArgumentException`",
          ],
          answer: 2,
          explanation: "In Objective-C, messaging `nil` is valid: it does nothing and returns the zero value of the type (`0` for `NSInteger`, `NO` for `BOOL`, `nil` for objects). The compiler doesn't complain because there are no optionals. Convenient, but it hides bugs: the screen ends up empty instead of failing.",
        },
        {
          kind: "explain",
          title: "Property attributes",
          body: [
            "`nonatomic` goes on almost every UI property: the default (`atomic`) is slower and doesn't make the class thread-safe anyway. Then comes memory semantics: `strong` (retains; the default for objects), `weak` (doesn't retain and becomes `nil` on its own: delegates, to avoid cycles), `copy` (stores a copy) and `assign` (primitive types like `NSInteger` or `BOOL`).",
            "`copy` is the rule for `NSString`, `NSArray` and blocks. Since `NSMutableString` is a subclass of `NSString`, someone can hand you a mutable string and change it later: with `strong` your property changes with it; with `copy` it doesn't.",
            "`readonly` only generates the getter. It's common to redeclare the property as `readwrite` in a private class extension inside the `.m`: the equivalent of `private(set) var` in Swift.",
          ],
          code: objc`@interface CheckoutViewController : UIViewController
@property (nonatomic, weak) id<CheckoutDelegate> delegate;  // doesn't retain: avoids cycles
@property (nonatomic, strong) UITableView *tableView;       // retains (default for objects)
@property (nonatomic, copy) NSString *couponCode;            // copies: safe from NSMutableString
@property (nonatomic, copy) void (^onFinish)(BOOL success); // blocks are copied
@property (nonatomic, assign) NSInteger itemCount;           // primitive types
@property (nonatomic, readonly) BOOL canPay;                 // public getter only
@end

// CheckoutViewController.m
@interface CheckoutViewController ()
@property (nonatomic, readwrite) BOOL canPay;                // writable only inside
@end`,
        },
        {
          kind: "predict",
          prompt: "`LegacyUser` declares `@property (nonatomic, strong) NSString *name;`. What is `user.name` at the end?",
          code: objc`NSMutableString *buffer = [NSMutableString stringWithString:@"Ana"];
user.name = buffer;
[buffer appendString:@" Paz"];
// user.name == ?`,
          options: ["\"Ana\"", "\"Ana Paz\"", "`nil`", "Crash when mutating `buffer`"],
          answer: 1,
          explanation: "With `strong`, `user.name` points to the **same** object as `buffer`. Mutating `buffer` changes the user's name behind its back: \"Ana Paz\". With `copy`, the property would store an immutable copy at assignment time and still be \"Ana\". That's why `NSString` gets `copy`.",
        },
        {
          kind: "explain",
          title: "Nullability and blocks: how Swift sees them",
          body: [
            "An unannotated Objective-C pointer arrives in Swift as an implicitly unwrapped optional (`String!`): it compiles without `?` and crashes if it was `nil`. Annotations fix that: `nullable` → `String?`, `nonnull` → `String`.",
            "`NS_ASSUME_NONNULL_BEGIN`/`END` makes the whole region `nonnull` by default, and you only annotate what can be missing with `nullable` (or `_Nullable` inside block types). It's the first thing you add when an old header starts being used from Swift.",
            "Blocks are Objective-C closures: `void (^)(LegacyUser *user, NSError *error)`. As parameters they arrive in Swift as `@escaping`. And if the last parameter is a completion block with an `NSError`, Swift also gives you an `async throws` version of the method.",
            "Just like in Swift, a block that captures `self` and gets stored creates a cycle. The legacy pattern is `__weak typeof(self) weakSelf = self;` before the block.",
          ],
          code: objc`NS_ASSUME_NONNULL_BEGIN

@interface UserService : NSObject
@property (nonatomic, copy, nullable) NSString *lastError;
- (nullable LegacyUser *)cachedUserWithID:(NSString *)userID;
- (void)fetchUserWithID:(NSString *)userID
             completion:(void (^)(LegacyUser * _Nullable user, NSError * _Nullable error))completion;
@end

NS_ASSUME_NONNULL_END

// From Swift it looks like this:
// var lastError: String?
// func cachedUser(withID userID: String) -> LegacyUser?
// func fetchUser(withID userID: String, completion: @escaping (LegacyUser?, Error?) -> Void)
// func fetchUser(withID userID: String) async throws -> LegacyUser`,
        },
        {
          kind: "fill",
          prompt: "Inside `NS_ASSUME_NONNULL_BEGIN`, the header says `- (nullable LegacyUser *)cachedUserWithID:(NSString *)userID;`. Fill in the return type Swift sees.",
          code: swift`func cachedUser(withID userID: String) -> ____`,
          accept: ["^LegacyUser\\?$"],
          explanation: "`nullable` on the return type is imported as an optional: `LegacyUser?`. The `userID` parameter has no annotation, but inside the `NS_ASSUME_NONNULL` region it's `nonnull`, so it arrives as plain `String`.",
          hint: "`nullable` in Objective-C is `?` in Swift.",
          placeholder: "type",
        },
        {
          kind: "explain",
          title: "Bridges: bridging header, `-Swift.h` and `@objc`",
          body: [
            "**Objective-C → Swift**: in an app target, the headers listed in the bridging header (`MyApp-Bridging-Header.h`) are visible to all Swift code, no `import` needed.",
            "**Swift → Objective-C**: Xcode generates `MyApp-Swift.h` with whatever Swift exposes. You import it in `.m` files; in `.h` files use `@class Name;` to avoid circular dependencies.",
            "Swift only exposes what Objective-C can represent (classes inheriting from `NSObject`, `@objc` enums with `Int` raw values; no structs, no generics) and only members marked `@objc`. `@objcMembers` on the class marks them all. Since Swift 4, inheriting from `NSObject` is **not** enough to expose a method.",
            "To give an Objective-C name a clean Swift spelling without touching old call sites, use `NS_SWIFT_NAME`.",
          ],
          code: objc`// MyApp-Bridging-Header.h — Objective-C visible from Swift
#import "LegacyUser.h"
#import "UserService.h"

// UserService.h — clean Swift name, same selector for Objective-C
- (void)fetchUserWithIdentifier:(NSString *)identifier
                     completion:(void (^)(LegacyUser * _Nullable, NSError * _Nullable))completion
    NS_SWIFT_NAME(fetchUser(id:completion:));

// LegacyCartViewController.m — Swift visible from Objective-C
#import "MyApp-Swift.h"

// PriceFormatter.swift
@objcMembers
final class PriceFormatter: NSObject {
    func format(cents: Int) -> String { String(format: "$%.2f", Double(cents) / 100) }
}`,
        },
        {
          kind: "predict",
          prompt: "This `.m` imports `MyApp-Swift.h` and uses a Swift class. What happens at compile time?",
          code: swift`// SessionTracker.swift
final class SessionTracker: NSObject {
    func start() { }
    @objc func stop() { }
}

// LegacyAppDelegate.m
SessionTracker *tracker = [SessionTracker new];
[tracker start];
[tracker stop];`,
          options: [
            "Error on `[tracker start]`: `start` isn't `@objc`, so it's not in `MyApp-Swift.h`",
            "Compiles: methods of an `NSObject` subclass are exposed automatically",
            "Error on both lines because the class is `final`",
            "Compiles, but crashes at runtime with `unrecognized selector`",
          ],
          answer: 0,
          explanation: "The class is visible (it inherits from `NSObject`), but since Swift 4 members aren't inferred as `@objc`: only `stop` is in the generated header. `[tracker start]` doesn't compile. Fix it with `@objc func start()` or `@objcMembers` on the class. `final` has nothing to do with it.",
        },
        {
          kind: "write",
          prompt: "Make `PaymentMethod.h` ready for Swift: everything between `NS_ASSUME_NONNULL_BEGIN`/`NS_ASSUME_NONNULL_END`, `title` as `copy`, `iconName` optional (`nullable`), and `isExpiredAtDate:` renamed for Swift as `isExpired(at:)` with `NS_SWIFT_NAME`.",
          starter: objc`#import <Foundation/Foundation.h>

@interface PaymentMethod : NSObject
@property (nonatomic, strong) NSString *title;
@property (nonatomic, strong) NSString *iconName;
- (BOOL)isExpiredAtDate:(NSDate *)date;
@end`,
          checks: [
            { pattern: "NS_ASSUME_NONNULL_BEGIN", label: "Opens the region with `NS_ASSUME_NONNULL_BEGIN`" },
            { pattern: "NS_ASSUME_NONNULL_END", label: "Closes it with `NS_ASSUME_NONNULL_END`" },
            { pattern: "@property\\s*\\([^)]*\\bcopy\\b[^)]*\\)\\s*NSString\\s*\\*\\s*title\\b", label: "`title` is `copy`" },
            { pattern: "@property\\s*\\([^)]*\\bnullable\\b[^)]*\\)\\s*NSString\\s*\\*\\s*iconName\\b|NSString\\s*\\*\\s*_Nullable\\s+iconName\\b", label: "`iconName` is `nullable`" },
            { pattern: "NS_SWIFT_NAME\\(\\s*isExpired\\(at:\\)\\s*\\)", label: "Renames with `NS_SWIFT_NAME(isExpired(at:))`" },
          ],
          warnings: [
            { pattern: "@property\\s*\\([^)]*\\bstrong\\b[^)]*\\)\\s*NSString", label: "`strong` on an `NSString`: use `copy`" },
          ],
          solution: objc`#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface PaymentMethod : NSObject
@property (nonatomic, copy) NSString *title;
@property (nonatomic, copy, nullable) NSString *iconName;
- (BOOL)isExpiredAtDate:(NSDate *)date NS_SWIFT_NAME(isExpired(at:));
@end

NS_ASSUME_NONNULL_END`,
          hint: "`NS_SWIFT_NAME(...)` goes at the end of the method declaration, before the `;`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "storyboards-xibs",
      title: "Storyboards, XIBs and how to get out of them",
      goal: "Understand outlets, actions and segues, recognize the typical storyboard crashes, and migrate one screen to code without breaking navigation.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "What's inside a storyboard",
          body: [
            "A storyboard (or a XIB, which holds a single view) is XML describing views, constraints and **connections by name**: the outlet `nameLabel`, the segue `showEditProfile`, the class `ProfileViewController`. The compiler checks none of those strings.",
            "`@IBOutlet` marks a property the storyboard fills in when the view loads (via KVC, looking the property up by name). That's why they're `weak` and `UILabel!`: they only exist after `viewDidLoad`, and the view hierarchy already retains them.",
            "`@IBAction` marks a method the storyboard wires to an event, like a button tap. To create the screen from code you use `instantiateViewController(withIdentifier:)` plus a cast.",
          ],
          code: swift`final class ProfileViewController: UIViewController {
    @IBOutlet private weak var nameLabel: UILabel!
    @IBOutlet private weak var avatarView: UIImageView!

    var user: User?   // set by whoever presents the screen

    override func viewDidLoad() {
        super.viewDidLoad()
        nameLabel.text = user?.name
    }

    @IBAction private func didTapEdit(_ sender: UIButton) {
        performSegue(withIdentifier: "showEditProfile", sender: self)
    }
}

// Creating the screen from code
let storyboard = UIStoryboard(name: "Main", bundle: nil)
let profile = storyboard.instantiateViewController(withIdentifier: "ProfileViewController") as! ProfileViewController`,
        },
        {
          kind: "predict",
          prompt: "During a refactor you rename `nameLabel` to `titleLabel` in code, but the storyboard is still wired to `nameLabel`. It compiles. What happens when the screen opens?",
          code: swift`final class ProfileViewController: UIViewController {
    @IBOutlet private weak var titleLabel: UILabel!   // was: nameLabel
}

// Main.storyboard still says:
// <outlet property="nameLabel" destination="aB3-xY-9Qz" id="..."/>`,
          options: [
            "Works: Xcode resolves the outlet by type",
            "`titleLabel` stays `nil` but nothing happens until you use it",
            "Build error in the storyboard",
            "Crash on view load: `NSUnknownKeyException` ... `not key value coding-compliant for the key nameLabel`",
          ],
          answer: 3,
          explanation: "When the view loads, UIKit calls `setValue(_:forKey: \"nameLabel\")` on the controller. That property no longer exists and KVC throws `NSUnknownKeyException`. It's the classic disconnected-outlet crash: compiles fine, explodes at runtime. And even after you fix it, `titleLabel` isn't connected: its first access crashes unwrapping `nil`.",
        },
        {
          kind: "explain",
          title: "Segues and `prepare(for:sender:)`",
          body: [
            "A segue is a transition defined in the storyboard. Before running it, UIKit calls `prepare(for:sender:)` on the source controller: there you tell segues apart by `identifier` (another string) and pass data to the destination by casting `segue.destination`.",
            "Since the storyboard creates the destination, you can't use its `init`: data goes in through `var` properties (often `Item!`). And `prepare` runs **before** the destination's view loads: its outlets are still `nil`.",
            "Since iOS 13 there's a middle ground: `instantiateViewController(identifier:creator:)` (and `@IBSegueAction`) let you call your own `init(coder:item:)` and inject dependencies through init without leaving the storyboard.",
          ],
          code: swift`override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
    if segue.identifier == "showDetail",
       let detail = segue.destination as? DetailViewController,
       let indexPath = tableView.indexPathForSelectedRow {
        detail.item = items[indexPath.row]   // a property, not init
    }
}

// iOS 13+: your own init with a storyboard
let detail = storyboard.instantiateViewController(identifier: "Detail") { coder in
    DetailViewController(coder: coder, item: item)
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the segue property that holds the controller you're navigating to.",
          code: swift`override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
    guard let detail = segue.____ as? DetailViewController else { return }
    detail.item = selectedItem
}`,
          accept: ["^destination$"],
          explanation: "`segue.destination` is the destination `UIViewController` (there's also `segue.source`). It's typed as `UIViewController`, hence the `as?`.",
          placeholder: "property",
        },
        {
          kind: "predict",
          prompt: "`DetailViewController` has `@IBOutlet weak var titleLabel: UILabel!`, correctly connected. What happens when the user taps the cell?",
          code: swift`override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
    guard let detail = segue.destination as? DetailViewController else { return }
    detail.titleLabel.text = selectedItem.name
}`,
          options: [
            "Crash: `titleLabel` is still `nil` because the destination's view hasn't loaded",
            "Works: the segue loads the view before calling `prepare`",
            "The text is set but `viewDidLoad` overwrites it",
            "Doesn't compile: you can't access another controller's outlets",
          ],
          answer: 0,
          explanation: "`prepare` runs before the destination loads its view, and outlets are only connected when it loads. Unwrapping the `UILabel!` while it's `nil` crashes with `Unexpectedly found nil while implicitly unwrapping an Optional value`. The right move: pass the data (`detail.item = ...`) and let the destination render it in `viewDidLoad`.",
        },
        {
          kind: "explain",
          title: "Why teams leave, and how to migrate one screen",
          body: [
            "Concrete reasons: a large storyboard touched by several people produces XML merge conflicts that are nearly impossible to resolve by hand; diffs can't be reviewed in a PR; wiring errors show up at runtime instead of compile time; and there's no `init` injection.",
            "Migration happens one screen at a time. The code version takes its dependencies through `init`, builds its views with Auto Layout, and whoever presents it calls `pushViewController` instead of `performSegue`. In the same PR you delete the scene and segue from the storyboard so no dead code is left behind.",
            "`required init?(coder:)` with `fatalError` is the standard pattern: it makes it explicit that this screen is no longer created from a storyboard.",
          ],
          code: swift`final class DetailViewController: UIViewController {
    private let item: Item
    private let titleLabel = UILabel()

    init(item: Item) {
        self.item = item
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        titleLabel.text = item.name
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }
}

// In the list, instead of performSegue:
navigationController?.pushViewController(DetailViewController(item: item), animated: true)`,
        },
        {
          kind: "predict",
          prompt: "Your team has a `Main.storyboard` with 40 scenes and merge conflicts every week. What's the reasonable plan?",
          code: swift`// Main.storyboard: 40 scenes, 55 segues, 6 people editing it`,
          options: [
            "Rewrite the whole UI in code in one big PR",
            "Ban storyboard changes until there's time to migrate",
            "Migrate one screen at a time (to code or to small per-flow storyboards), deleting the old scene in the same PR",
            "Convert the storyboard into XIBs keeping the same segues",
          ],
          answer: 2,
          explanation: "A giant PR can't be reviewed and breaks things; banning changes blocks the product. Migrating one screen at a time keeps every change small and verifiable, and every scene that leaves reduces conflicts. XIBs don't have segues: that option isn't even possible.",
        },
        {
          kind: "write",
          prompt: "Migrate `ReceiptViewController` to code: `receipt` becomes a `let` injected via `init(receipt:)`, call `super.init(nibName: nil, bundle: nil)`, implement `required init?(coder:)`, build `totalLabel` in code with Auto Layout, and present the screen with `pushViewController` instead of the segue.",
          starter: swift`final class ReceiptViewController: UIViewController {
    @IBOutlet weak var totalLabel: UILabel!
    var receipt: Receipt!

    override func viewDidLoad() {
        super.viewDidLoad()
        totalLabel.text = receipt.totalText
    }
}

// In OrdersViewController:
// performSegue(withIdentifier: "showReceipt", sender: receipt)`,
          checks: [
            { pattern: "init\\(receipt:\\s*Receipt\\)", label: "Takes the receipt via `init(receipt:)`" },
            { pattern: "super\\.init\\(nibName:\\s*nil,\\s*bundle:\\s*nil\\)", label: "Calls `super.init(nibName: nil, bundle: nil)`" },
            { pattern: "required\\s+init\\?\\(coder", label: "Implements `required init?(coder:)`" },
            { pattern: "translatesAutoresizingMaskIntoConstraints\\s*=\\s*false", label: "Uses Auto Layout in code" },
            { pattern: "pushViewController\\(\\s*ReceiptViewController\\(receipt:", label: "Presents the screen with `pushViewController`" },
          ],
          warnings: [
            { pattern: "@IBOutlet", label: "An `@IBOutlet` is left: there's no storyboard to connect it anymore" },
            { pattern: "performSegue", label: "Still using `performSegue`" },
            { pattern: "var\\s+receipt\\s*:\\s*Receipt!", label: "`receipt` is still a mutable `Receipt!`" },
          ],
          solution: swift`final class ReceiptViewController: UIViewController {
    private let receipt: Receipt
    private let totalLabel = UILabel()

    init(receipt: Receipt) {
        self.receipt = receipt
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        totalLabel.text = receipt.totalText
        totalLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(totalLabel)
        NSLayoutConstraint.activate([
            totalLabel.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            totalLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
        ])
    }
}

// In OrdersViewController:
navigationController?.pushViewController(ReceiptViewController(receipt: receipt), animated: true)`,
          hint: "Copy the structure of `DetailViewController` from the previous step.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "uikit-swiftui-interop",
      title: "UIKit + SwiftUI in the same app",
      goal: "Embed SwiftUI in UIKit with `UIHostingController` (with correct sizing), wrap UIKit in SwiftUI with representables and a `Coordinator`, and adopt SwiftUI one screen at a time.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "SwiftUI inside UIKit: `UIHostingController`",
          body: [
            "`UIHostingController(rootView:)` is a `UIViewController` that displays a SwiftUI view. For a full screen, push or present it like any other controller.",
            "To embed SwiftUI in part of a UIKit screen you do **child view controller containment** in three steps: `addChild(host)`, add `host.view` with constraints, and `host.didMove(toParent: self)`. Skip containment and the child won't properly get appearance events or trait and safe area changes.",
            "Sizing: if you pin only the top and sides, the height comes from the content. With `sizingOptions = .intrinsicContentSize` (iOS 16+) the hosting controller updates its intrinsic size when the SwiftUI content changes, and Auto Layout adjusts on its own.",
          ],
          code: swift`struct PromoBanner: View {
    let title: String
    var body: some View {
        Text(title)
            .font(.headline)
            .padding()
            .frame(maxWidth: .infinity)
            .background(.yellow.opacity(0.3))
    }
}

final class HomeViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: PromoBanner(title: "Free shipping today"))
        host.sizingOptions = .intrinsicContentSize
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        host.didMove(toParent: self)
    }
}

// Full screen:
// navigationController?.pushViewController(UIHostingController(rootView: SettingsView()), animated: true)`,
        },
        {
          kind: "fill",
          prompt: "Fill in the last step of child containment.",
          code: swift`addChild(host)
view.addSubview(host.view)
// ... constraints
host.____(toParent: self)`,
          accept: ["^didMove$"],
          explanation: "The sequence is `addChild` → add the view → `didMove(toParent:)`. Removing it is the reverse: `willMove(toParent: nil)` → `view.removeFromSuperview()` → `removeFromParent()`.",
          placeholder: "method",
        },
        {
          kind: "explain",
          title: "`rootView` is a value: how UIKit and SwiftUI talk",
          body: [
            "The SwiftUI view is a struct: `UIHostingController(rootView: Badge(count: unread))` stores a **copy**. If you later change a UIKit variable, SwiftUI never finds out.",
            "Two ways to push data from UIKit to SwiftUI: reassign `host.rootView` with a new view, or (better) share an observable model: `@Observable` on iOS 17+, or `ObservableObject` with `@ObservedObject` if you support older versions. UIKit mutates the model and SwiftUI redraws on its own.",
            "From SwiftUI back to UIKit, use closures: the view reports `onTap` and the controller (or coordinator) decides the navigation. That way navigation stays in UIKit while you migrate.",
          ],
          code: swift`@Observable
final class CartBadgeModel {
    var count = 0
}

struct CartBadge: View {
    let model: CartBadgeModel
    var onTap: () -> Void
    var body: some View {
        Button("Cart (\(model.count))", action: onTap)
    }
}

final class StoreViewController: UIViewController {
    weak var coordinator: StoreCoordinator?
    private let badgeModel = CartBadgeModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: CartBadge(model: badgeModel) { [weak self] in
            self?.coordinator?.showCart()   // navigation stays in UIKit
        })
        // ... containment as before
    }

    func didAddItem() {
        badgeModel.count += 1   // SwiftUI updates on its own
    }
}`,
        },
        {
          kind: "predict",
          prompt: "`InboxBadge` is a struct with `let count: Int` that shows `Text(\"\\(count)\")`. What number does the badge show?",
          code: swift`var unread = 3
let host = UIHostingController(rootView: InboxBadge(count: unread))
// ... containment
unread = 7`,
          options: ["7", "3", "Crash from mutating state outside SwiftUI", "0"],
          answer: 1,
          explanation: "`InboxBadge(count: unread)` copied the value 3 when the view was created. Changing `unread` afterwards doesn't touch that copy. To show 7 you need `host.rootView = InboxBadge(count: 7)` or a shared observable model.",
        },
        {
          kind: "explain",
          title: "UIKit inside SwiftUI: `UIViewRepresentable` and `Coordinator`",
          body: [
            "When a SwiftUI screen needs a UIKit component (a custom `UISearchBar`, an `MKMapView` with a delegate, an old design-system component), you wrap it in a `UIViewRepresentable`.",
            "`makeUIView` runs once and creates the view. `updateUIView` runs every time the SwiftUI state it depends on changes: it must be idempotent and compare before assigning, or you'll overwrite what the user is typing and create loops.",
            "UIKit delegates are class objects held `weak`. The representable struct is recreated all the time, so it can't be the delegate. That's what the `Coordinator` is for: a class SwiftUI creates once via `makeCoordinator()` and keeps alive for as long as the view exists.",
          ],
          code: swift`struct SearchField: UIViewRepresentable {
    @Binding var text: String

    func makeUIView(context: Context) -> UISearchBar {
        let bar = UISearchBar()
        bar.delegate = context.coordinator
        return bar
    }

    func updateUIView(_ uiView: UISearchBar, context: Context) {
        if uiView.text != text { uiView.text = text }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    final class Coordinator: NSObject, UISearchBarDelegate {
        var text: Binding<String>
        init(text: Binding<String>) { self.text = text }

        func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
            text.wrappedValue = searchText
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "A teammate wants to simplify: they write `bar.delegate = self` inside `makeUIView` and delete the `Coordinator`. What happens?",
          code: swift`struct SearchField: UIViewRepresentable, UISearchBarDelegate {
    @Binding var text: String

    func makeUIView(context: Context) -> UISearchBar {
        let bar = UISearchBar()
        bar.delegate = self
        return bar
    }
    // ...
}`,
          options: [
            "Works the same as with the `Coordinator`",
            "Works, but loses events when SwiftUI recreates the struct",
            "Crashes at runtime on the first event",
            "Doesn't compile: a struct can't conform to `UISearchBarDelegate` or be assigned to a class-bound `delegate`",
          ],
          answer: 3,
          explanation: "`UISearchBarDelegate` is an Objective-C protocol, which only classes can adopt, and `delegate` is a `weak` reference to an object. A struct doesn't fit. Even if it could, the struct is recreated on every update: that's why the `Coordinator` exists, a class with a stable lifetime.",
        },
        {
          kind: "explain",
          title: "`UIViewControllerRepresentable` and screen-by-screen adoption",
          body: [
            "`UIViewControllerRepresentable` does the same for whole controllers: `makeUIViewController(context:)`, `updateUIViewController(_:context:)`, and a `Coordinator` if the controller has a delegate. It lets you reuse an old UIKit screen inside a new SwiftUI flow.",
            "The strategy that works in big apps: new screens are built in SwiftUI and presented with `UIHostingController`; navigation (coordinators, `UINavigationController`) stays in UIKit until the end; old screens get rewritten when you have to change them anyway. No \"let's rewrite the app\".",
          ],
          code: swift`struct LegacyReportScreen: UIViewControllerRepresentable {
    let reportID: String

    func makeUIViewController(context: Context) -> ReportViewController {
        ReportViewController(reportID: reportID)   // existing UIKit screen
    }

    func updateUIViewController(_ uiViewController: ReportViewController, context: Context) {}
}

// Typical adoption, outside in:
// 1. New screens in SwiftUI, presented with UIHostingController.
// 2. Navigation stays in UIKit (coordinators).
// 3. Old screens: rewritten when you have to touch them anyway.
// 4. If SwiftUI needs something from UIKit, wrap it in a Representable.`,
        },
        {
          kind: "write",
          prompt: "Wrap `SignatureViewController` (UIKit, with `weak var delegate: SignatureViewControllerDelegate?` and the callback `signatureViewController(_:didFinishWith:)`) so it can be used from SwiftUI. The result comes out through the `onFinish: (UIImage) -> Void` closure.",
          starter: swift`struct SignatureScreen {
    let onFinish: (UIImage) -> Void
}`,
          checks: [
            { pattern: "struct\\s+SignatureScreen\\s*:\\s*UIViewControllerRepresentable", label: "Conforms to `UIViewControllerRepresentable`" },
            { pattern: "func\\s+makeUIViewController\\(context:", label: "Implements `makeUIViewController(context:)`" },
            { pattern: "func\\s+updateUIViewController\\(", label: "Implements `updateUIViewController(_:context:)`" },
            { pattern: "func\\s+makeCoordinator\\(\\)", label: "Implements `makeCoordinator()`" },
            { pattern: "class\\s+Coordinator\\b[^{]*SignatureViewControllerDelegate", label: "The `Coordinator` is the delegate" },
            { pattern: "\\.delegate\\s*=\\s*context\\.coordinator", label: "Assigns `context.coordinator` as delegate" },
          ],
          warnings: [
            { pattern: "\\.delegate\\s*=\\s*self\\b", label: "The struct can't be the delegate: use the `Coordinator`" },
          ],
          solution: swift`struct SignatureScreen: UIViewControllerRepresentable {
    let onFinish: (UIImage) -> Void

    func makeUIViewController(context: Context) -> SignatureViewController {
        let controller = SignatureViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: SignatureViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onFinish: onFinish)
    }

    final class Coordinator: NSObject, SignatureViewControllerDelegate {
        let onFinish: (UIImage) -> Void
        init(onFinish: @escaping (UIImage) -> Void) { self.onFinish = onFinish }

        func signatureViewController(_ controller: SignatureViewController, didFinishWith image: UIImage) {
            onFinish(image)
        }
    }
}`,
          hint: "Same shape as `SearchField`, but with `makeUIViewController` and `updateUIViewController`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "safe-changes",
      title: "Changing legacy code without breaking it",
      goal: "Write characterization tests before touching anything, open seams for testing, break up a Massive View Controller in small PRs, and replace screens with strangler fig and feature flags.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "First, take a snapshot of the behavior",
          body: [
            "Michael Feathers defines legacy code as \"code without tests\". Before refactoring you need a safety net: a **characterization test** doesn't say what the code should do; it records what it **does today**, even if it looks odd.",
            "The technique: write the test with a value you guess, run it, let the failure tell you the real value, and paste it in. Repeat for the edge cases that matter (empty, negatives, nil, rounding). For UI, same idea with snapshot tests.",
            "With those tests green, you refactor. If something turns red, you changed behavior by accident. Bugs you discover get written down and fixed in a **separate** PR.",
          ],
          code: swift`// PriceFormatter is legacy: nobody really knows what it does with negatives.
final class PriceFormatterCharacterizationTests: XCTestCase {
    func test_format_currentBehavior() {
        let formatter = PriceFormatter()
        XCTAssertEqual(formatter.format(cents: 1999), "$19.99")
        XCTAssertEqual(formatter.format(cents: 0), "$0.00")
        XCTAssertEqual(formatter.format(cents: -500), "$-5.00")   // odd, but it's what it does today
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Your characterization test shows that `format(cents: -500)` returns `\"$-5.00\"` and you suspect it's a bug. You're in the middle of a refactor that moves the formatter out of the view controller. What do you do?",
          code: swift`XCTAssertEqual(formatter.format(cents: -500), "$-5.00")   // bug?`,
          options: [
            "Fix it in the same PR, since you're touching that code anyway",
            "Keep the test asserting `\"$-5.00\"`, finish the refactor without behavior changes, and ship the fix in a separate PR (after checking with product)",
            "Delete that case from the test so it stops bothering you",
            "Mark the test as skipped until someone decides",
          ],
          answer: 1,
          explanation: "A refactor doesn't change behavior; if you mix in a fix and something breaks in production, you won't know which of the two changes caused it. Also, the \"odd\" behavior may be something another part of the app depends on. Separate fix, separately reviewed, with its own test.",
        },
        {
          kind: "explain",
          title: "Seams: where to slip a test in",
          body: [
            "A **seam** is a place where you can change behavior without editing the code that uses it. Legacy code has no seams: it calls `UserDefaults.standard`, `Date()` or `APIClient.shared` directly.",
            "The most common seam: extract a protocol for what's used and inject it through `init` **with a default value** matching production. Every existing `SubscriptionBanner()` keeps compiling and behaving the same; the test passes a fake.",
            "Same with the clock: a `now: () -> Date = Date.init` closure lets you test expirations without waiting or changing the simulator's date.",
          ],
          code: swift`// Before: untestable without touching UserDefaults or the real clock
// let expiry = UserDefaults.standard.object(forKey: "expiry") as? Date ?? .distantPast
// return expiry < Date() ? "Renew your plan" : "Plan active"

protocol ExpiryStore {
    var expiry: Date? { get }
}

struct UserDefaultsExpiryStore: ExpiryStore {
    var expiry: Date? { UserDefaults.standard.object(forKey: "expiry") as? Date }
}

final class SubscriptionBanner {
    private let store: ExpiryStore
    private let now: () -> Date

    init(store: ExpiryStore = UserDefaultsExpiryStore(), now: @escaping () -> Date = Date.init) {
        self.store = store
        self.now = now
    }

    func text() -> String {
        let expiry = store.expiry ?? .distantPast
        return expiry < now() ? "Renew your plan" : "Plan active"
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the default value so every existing `ProfileLoader()` keeps compiling and using the real API.",
          code: swift`protocol ProfileAPI {
    func fetchProfile() async throws -> Profile
}

struct LiveProfileAPI: ProfileAPI {
    func fetchProfile() async throws -> Profile { /* URLSession */ }
}

final class ProfileLoader {
    private let api: ProfileAPI
    init(api: ProfileAPI = ____) { self.api = api }
}`,
          accept: ["^LiveProfileAPI\\(\\)$"],
          explanation: "The default is the production implementation: `LiveProfileAPI()`. That way the seam doesn't force any call-site change in this PR, and tests pass `ProfileLoader(api: StubProfileAPI())`.",
          hint: "It's an instance of the real implementation.",
          placeholder: "default value",
        },
        {
          kind: "explain",
          title: "Subclass and override, and how to break up a Massive View Controller",
          body: [
            "When you can't change the `init` (a storyboard or Objective-C code creates it), another seam is **subclass and override**: move the dependency into a `makeAPIClient()` method and, in the test target, a subclass overrides it. Not pretty, but it gets you the first test.",
            "A 2000-line view controller is broken up through a sequence of small PRs, none of which change behavior: (1) characterization tests for what you're about to touch; (2) extract pure functions (formatting, validation) into separate types; (3) open seams for dependencies; (4) move state and logic into a view model or presenter; (5) split out views or child controllers.",
            "Golden rule: a refactor PR doesn't change behavior, and a behavior-change PR doesn't refactor. Each one reviews in minutes and reverts without fear.",
          ],
          code: swift`class OrdersViewController: UIViewController {
    func makeAPIClient() -> APIClient { APIClient.shared }   // seam

    func reload() {
        makeAPIClient().fetchOrders { [weak self] orders in
            self?.render(orders)
        }
    }

    func render(_ orders: [Order]) { /* ... */ }
}

// In the test target (StubAPIClient subclasses APIClient):
final class TestableOrdersViewController: OrdersViewController {
    let stubClient = StubAPIClient()
    override func makeAPIClient() -> APIClient { stubClient }
}`,
        },
        {
          kind: "predict",
          prompt: "You're breaking up `CheckoutViewController` (2300 lines). Which of these PRs mixes two things that should be separate?",
          code: swift`// PR A: move formatDate(_:) into DateFormatting, logic untouched
// PR B: characterization tests for validate(form:)
// PR C: extract CheckoutViewModel and, while at it, fix the total's rounding
// PR D: replace APIClient.shared with a parameter that has a default value`,
          options: [
            "PR A",
            "PR B",
            "PR C",
            "PR D",
          ],
          answer: 2,
          explanation: "PR C mixes a refactor (extracting the view model) with a behavior change (the rounding). If a characterization test turns red you can't tell whether it's the bug you fixed or something you broke. A, B and D are pure steps: they either don't change behavior or only add tests.",
        },
        {
          kind: "explain",
          title: "Strangler fig: the new grows next to the old",
          body: [
            "The name comes from a fig that grows around a tree until it replaces it. In an app: the new version of a screen lives alongside the old one, and a **single routing point** decides which one to show.",
            "The decision comes from a **remote** feature flag: start with the internal team, then 5%, 25%, 100%, watching crashes and metrics. If something goes wrong, you turn the flag off without a release. The legacy screen stays untouched meanwhile.",
            "Flags are debt: once the new version is stable at 100%, the flag and the old code get deleted in a dedicated PR.",
          ],
          code: swift`enum Feature: String {
    case newCheckout = "new_checkout"
}

protocol FeatureFlags {
    func isEnabled(_ feature: Feature) -> Bool
}

final class CheckoutCoordinator {
    private let navigation: UINavigationController
    private let flags: FeatureFlags

    init(navigation: UINavigationController, flags: FeatureFlags) {
        self.navigation = navigation
        self.flags = flags
    }

    func start(cart: Cart) {
        let screen: UIViewController
        if flags.isEnabled(.newCheckout) {
            screen = UIHostingController(rootView: CheckoutView(model: CheckoutModel(cart: cart)))
        } else {
            screen = LegacyCheckoutViewController(cart: cart)   // Objective-C, untouched
        }
        navigation.pushViewController(screen, animated: true)
    }
}`,
        },
        {
          kind: "write",
          prompt: "Write `makeProfileScreen(user:flags:)`: if the `.newProfile` flag is on, return a `UIHostingController` with `ProfileView(user: user)`; otherwise, the usual `LegacyProfileViewController(user: user)`.",
          starter: swift`func makeProfileScreen(user: User, flags: FeatureFlags) -> UIViewController {
    LegacyProfileViewController(user: user)
}`,
          checks: [
            { pattern: "isEnabled\\(\\s*\\.newProfile\\s*\\)", label: "Checks the `.newProfile` flag" },
            { pattern: "UIHostingController\\(\\s*rootView:\\s*ProfileView\\(user:\\s*user\\)", label: "Hosts `ProfileView` in a `UIHostingController`" },
            { pattern: "LegacyProfileViewController\\(user:\\s*user\\)", label: "Keeps the legacy screen as fallback" },
            { pattern: "->\\s*UIViewController", label: "Returns `UIViewController`" },
          ],
          warnings: [
            { pattern: "#if\\s+DEBUG", label: "An `#if` is decided at compile time: the flag must be changeable without a release" },
          ],
          solution: swift`func makeProfileScreen(user: User, flags: FeatureFlags) -> UIViewController {
    if flags.isEnabled(.newProfile) {
        return UIHostingController(rootView: ProfileView(user: user))
    }
    return LegacyProfileViewController(user: user)
}`,
          hint: "An `if` that returns the hosting controller, otherwise the old screen.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "swift6-migration",
      title: "Swift 6 migration plan",
      goal: "Migrate module by module to Swift 6, isolate UI with `@MainActor`, use `Sendable` (and distrust `@unchecked`), live with old SDKs, and handle deprecations and iOS versions.",
      minutes: 28,
      steps: [
        {
          kind: "explain",
          title: "The plan: module by module",
          body: [
            "Building with Xcode 16+ doesn't put you on Swift 6: the **language mode** is chosen per target (`SWIFT_VERSION`). You can run the new compiler with the whole project in Swift 5 mode and migrate one module at a time.",
            "The plan: (1) in Swift 5 mode, turn on `SWIFT_STRICT_CONCURRENCY = complete` and every concurrency problem shows up as a **warning**; (2) fix them in small PRs; (3) switch that target to `SWIFT_VERSION = 6.0` and the same diagnostics become errors, so nobody reintroduces the problem.",
            "Start with leaf modules (models, networking): their types are used everywhere, and making them `Sendable` unblocks the rest. In SwiftPM, `swiftSettings: [.swiftLanguageMode(.v5)]` holds one target back while the others move forward.",
            "Since Swift 6.2 (Xcode 26), an app target can also use `MainActor` as its default isolation, which removes a lot of annotations in UI code.",
          ],
          code: `// Step 1: Swift 5 mode with complete checking (everything is a warning)
SWIFT_VERSION = 5.0
SWIFT_STRICT_CONCURRENCY = complete

// Step 2: fix warnings in small PRs, leaf modules first

// Step 3: Swift 6 mode (the same diagnostics are now errors)
SWIFT_VERSION = 6.0`,
        },
        {
          kind: "predict",
          prompt: "You switched the `Analytics` module to `SWIFT_VERSION = 6.0`. What does the compiler say?",
          code: swift`final class Analytics {
    static var shared = Analytics()
    func track(_ event: String) { }
}`,
          options: [
            "Nothing: `final` is enough to make it safe",
            "Just a warning suggesting `let`",
            "Error: `shared` is nonisolated global mutable state, not concurrency-safe",
            "Error: singletons must be `actor`s in Swift 6",
          ],
          answer: 2,
          explanation: "A `static var` is global mutable state any thread can touch: in Swift 6 it's an error (\"not concurrency-safe because it is nonisolated global shared mutable state\"). Fixes: `static let` (if the type is `Sendable`), isolate it with `@MainActor`, or as a last resort `nonisolated(unsafe)` with a justification.",
        },
        {
          kind: "explain",
          title: "`@MainActor` on UI types",
          body: [
            "`UIViewController`, `UIView` and SwiftUI's `View` are already annotated `@MainActor` in the SDK: your subclasses inherit that isolation. What usually needs annotating is your own code: view models, coordinators, stores that touch UI.",
            "With `@MainActor` on the class, all its state is read and written on the main thread, and the compiler verifies it. Inside an `async` function, after an `await` you're back on the main actor: assigning UI state is safe.",
            "For old code with completion handlers that arrive on any thread, hop to the main actor with `Task { @MainActor in ... }`. If you know the callback already arrives on main, `MainActor.assumeIsolated { }` checks that at runtime without creating a task.",
          ],
          code: swift`protocol ProfileAPI: Sendable {
    func fetchProfile() async throws -> Profile
}

@MainActor
final class ProfileViewModel: ObservableObject {   // or @Observable on iOS 17+
    @Published private(set) var name = ""
    private let api: ProfileAPI

    init(api: ProfileAPI) { self.api = api }

    func load() async {
        do {
            let profile = try await api.fetchProfile()   // leaves the main actor while waiting
            name = profile.name                           // back on main: safe
        } catch {
            name = "—"
        }
    }
}

// Legacy callback arriving on any thread:
legacyClient.fetch { result in
    Task { @MainActor in
        viewModel.apply(result)
    }
}`,
        },
        {
          kind: "fill",
          prompt: "This view model publishes state the UI reads. Fill in the annotation that isolates it to the main thread.",
          code: swift`____
final class CartViewModel: ObservableObject {
    @Published private(set) var total = 0
}`,
          accept: ["^@MainActor$"],
          explanation: "`@MainActor` isolates the whole class to the main actor: every access from another context needs `await`, and the compiler guarantees `@Published` is never mutated from a background thread.",
          placeholder: "annotation",
        },
        {
          kind: "explain",
          title: "`Sendable` and the danger of `@unchecked Sendable`",
          body: [
            "`Sendable` means \"can cross isolation domains without data races\". A struct or enum whose members are `Sendable` is `Sendable` (if it's not `public`, the compiler infers it). A `final` class with only `let` properties of `Sendable` types is too.",
            "A legacy class with mutable state protected by hand (a lock, a serial queue) can't be verified by the compiler. Enter `@unchecked Sendable`: you say \"trust me\" and it **stops checking**. If a single method forgets the lock, you have a data race the compiler will never flag.",
            "Before reaching for `@unchecked`, try: making it a struct, making it an `actor`, or using `Mutex` (iOS 18+). If you still need it, route every access through the lock and justify it in the PR with a comment.",
          ],
          code: swift`struct Money: Sendable {             // struct with Sendable members
    let cents: Int
    let currency: String
}

final class TokenEndpoint: Sendable { // final + only Sendable lets
    let refreshURL: URL
    init(refreshURL: URL) { self.refreshURL = refreshURL }
}

// Legacy with mutable state protected by hand:
final class ImageCache: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [URL: Data] = [:]   // only touched while holding the lock

    func data(for url: URL) -> Data? {
        lock.lock(); defer { lock.unlock() }
        return storage[url]
    }

    func insert(_ data: Data, for url: URL) {
        lock.lock(); defer { lock.unlock() }
        storage[url] = data
    }
}`,
        },
        {
          kind: "predict",
          prompt: "This module is in Swift 6 mode. Several `Task`s call `cache.add(_:)` in parallel. What happens?",
          code: swift`final class SessionCache: @unchecked Sendable {
    var tokens: [String] = []
    func add(_ token: String) { tokens.append(token) }
}`,
          options: [
            "Compile error: `tokens` is mutable",
            "Compiles with no warnings, but there's a real data race that can corrupt the array or crash",
            "Compiles and is safe: `@unchecked Sendable` serializes access",
            "Warning that a lock is missing",
          ],
          answer: 1,
          explanation: "`@unchecked Sendable` switches the check off: the compiler adds no synchronization and warns about nothing. Two simultaneous `append`s on the same array are a data race (Thread Sanitizer catches it). Fix: make it an `actor`, or guard `tokens` with a lock on every access.",
        },
        {
          kind: "explain",
          title: "Old SDKs, delegates and `deinit`",
          body: [
            "`@preconcurrency import LegacyPaymentsSDK` quiets the noise from a module that hasn't adopted concurrency yet (its unannotated types don't produce `Sendable` errors for you). It's temporary: remove it once the vendor updates the SDK.",
            "If a `@MainActor` controller conforms to an unannotated delegate protocol, Swift 6 complains that an isolated method can't satisfy a nonisolated requirement. `extension X: @preconcurrency SomeDelegate` accepts it and adds a runtime check that the call arrives on the main actor.",
            "Watch out for `deinit`: even if the class is `@MainActor`, `deinit` isn't isolated, so you can't call main-actor methods there. Do the cleanup explicitly beforehand (for example from the object's owner). Swift 6.2 adds `isolated deinit` to run it on the actor.",
          ],
          code: swift`@preconcurrency import LegacyPaymentsSDK

extension CheckoutViewController: @preconcurrency PaymentSheetDelegate {
    func paymentSheetDidFinish(_ sheet: PaymentSheet) {
        showReceipt()   // checked at runtime that we're on the main actor
    }
}

@MainActor
final class LocationTracker {
    private var isTracking = false
    func stop() { isTracking = false }

    deinit {
        // stop()   // error: deinit isn't isolated to the main actor
    }
}`,
        },
        {
          kind: "predict",
          prompt: "You integrate an analytics SDK that hasn't adopted concurrency yet; its `AnalyticsEvent` isn't `Sendable`. After moving the module to Swift 6, errors appear where you send events from a `Task`. What's a reasonable first step?",
          code: swift`import AnalyticsSDK

Task {
    await uploader.send(AnalyticsEvent(name: "checkout_started"))
    // error: non-Sendable type 'AnalyticsEvent' ...
}`,
          options: [
            "`@preconcurrency import AnalyticsSDK` plus a ticket to remove it when the SDK is updated",
            "Move the whole project back to Swift 5 mode",
            "Add `extension AnalyticsEvent: @unchecked Sendable {}` without looking at its implementation",
            "Fork the SDK and annotate it by hand",
          ],
          answer: 0,
          explanation: "`@preconcurrency import` exists exactly for this: third-party code that hasn't been audited yet. It's local to the import and easy to remove. Declaring `@unchecked Sendable` on someone else's type promises something you didn't verify; going back to Swift 5 or forking is overkill.",
        },
        {
          kind: "explain",
          title: "Deprecations and older iOS versions",
          body: [
            "Every WWDC deprecates APIs: `UIApplication.shared.keyWindow` (iOS 13), `NavigationView` in favor of `NavigationStack` (iOS 16). Deprecation warnings are backlog: they don't break today, but some day the SDK removes them.",
            "If you support iOS 16 and want `@Observable` (iOS 17), mark the type `@available(iOS 17, *)` and branch at runtime with `if #available(iOS 17, *)`, keeping the `ObservableObject` version as fallback. When you raise the deployment target, delete the old branches.",
            "For your own APIs, `@available(*, deprecated, renamed: \"...\")` flags the old method with a warning and a fix-it: the friendliest way to migrate the whole team's call sites.",
          ],
          code: swift`@available(iOS 17, *)
@Observable
final class FiltersModel {
    var onlyFavorites = false
}

func makeFiltersScreen() -> UIViewController {
    if #available(iOS 17, *) {
        return UIHostingController(rootView: FiltersView(model: FiltersModel()))
    } else {
        return LegacyFiltersViewController()
    }
}

extension SessionStore {
    @available(*, deprecated, renamed: "signOut(reason:)")
    func logout() { signOut(reason: .user) }
}`,
        },
        {
          kind: "fill",
          prompt: "The app supports iOS 16. Fill in the runtime check so the new screen is only used on iOS 17 or later.",
          code: swift`if ____(iOS 17, *) {
    show(UIHostingController(rootView: FiltersView(model: FiltersModel())), sender: self)
} else {
    show(LegacyFiltersViewController(), sender: self)
}`,
          accept: ["^#available$"],
          explanation: "`#available` is a runtime check of the OS version; the `*` covers other platforms. `@available` (with an at sign) annotates declarations, not `if` conditions.",
          placeholder: "check",
        },
        {
          kind: "write",
          prompt: "Get this code ready for Swift 6. `SessionStore` is only used from the UI: isolate it to the main actor and make `shared` a constant. `Credentials` travels between tasks: turn it into a `Sendable` `struct` with `let token: String`. No `@unchecked`.",
          starter: swift`final class SessionStore {
    static var shared = SessionStore()
    var token: String?

    func save(_ credentials: Credentials) {
        token = credentials.token
    }
}

class Credentials {
    var token: String
    init(token: String) { self.token = token }
}`,
          checks: [
            { pattern: "@MainActor\\s+final\\s+class\\s+SessionStore", label: "`SessionStore` is `@MainActor`" },
            { pattern: "static\\s+let\\s+shared", label: "`shared` is `static let`" },
            { pattern: "struct\\s+Credentials\\s*:\\s*Sendable", label: "`Credentials` is a `Sendable` `struct`" },
            { pattern: "let\\s+token\\s*:\\s*String\\b", label: "`token` is `let`" },
          ],
          warnings: [
            { pattern: "@unchecked\\s+Sendable", label: "`@unchecked Sendable` turns checking off: not needed here" },
            { pattern: "static\\s+var\\s+shared", label: "`static var` is still global mutable state" },
            { pattern: "nonisolated\\(unsafe\\)", label: "`nonisolated(unsafe)` hides the problem instead of solving it" },
          ],
          solution: swift`@MainActor
final class SessionStore {
    static let shared = SessionStore()
    private(set) var token: String?

    func save(_ credentials: Credentials) {
        token = credentials.token
    }
}

struct Credentials: Sendable {
    let token: String
}`,
          hint: "A struct with only `let String` properties is `Sendable` for free.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: migrate a legacy screen without breaking it",
      goal: "Move an Objective-C storyboard screen to SwiftUI step by step: characterization test, seam, new model, and hosting behind a feature flag.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "`OrderSummaryViewController` is Objective-C, lives in `Main.storyboard`, is 1800 lines long and calls `[APIClient sharedClient]` directly. Product wants the screen redesigned in SwiftUI, and the order summary is part of checkout: it cannot break.",
            "The plan: (1) pin down with characterization tests how the total is computed and formatted today; (2) open a seam for data loading; (3) write the new model and host the SwiftUI view from the UIKit coordinator behind a feature flag; (4) gradual rollout and, finally, delete the old code.",
            "The test target has its own bridging header importing `OrderSummaryViewController.h` and `OrderItem.h`. `OrderItem` has `initWithPriceCents:quantity:`, which Swift sees as `OrderItem(priceCents:quantity:)`.",
          ],
          code: objc`// OrderSummaryViewController.h
NS_ASSUME_NONNULL_BEGIN
@interface OrderSummaryViewController : UIViewController
@property (nonatomic, copy) NSString *orderID;
- (NSString *)totalTextForItems:(NSArray<OrderItem *> *)items NS_SWIFT_NAME(totalText(for:));
@end
NS_ASSUME_NONNULL_END

// OrderSummaryViewController.m (excerpt)
- (void)viewDidLoad {
    [super viewDidLoad];
    [[APIClient sharedClient] fetchOrderWithID:self.orderID completion:^(Order *order, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            self.totalLabel.text = [self totalTextForItems:order.items];
        });
    }];
}

- (NSString *)totalTextForItems:(NSArray<OrderItem *> *)items {
    NSInteger cents = 0;
    for (OrderItem *item in items) {
        cents += item.priceCents * item.quantity;
    }
    return [NSString stringWithFormat:@"$%.2f", cents / 100.0];
}`,
        },
        {
          kind: "predict",
          prompt: "Where do you start?",
          code: objc`// OrderSummaryViewController.m: 1800 lines, 0 tests`,
          options: [
            "Write the new SwiftUI screen; delete the old one once it's ready",
            "Convert the whole `.m` to Swift first",
            "Move the screen out of the storyboard",
            "Characterization tests for `totalText(for:)` with what it returns today, edge cases included",
          ],
          answer: 3,
          explanation: "Without a safety net there's no way to know whether the new code behaves like the old one. Characterization tests pin down the current contract (`$%.2f` format, empty order, quantities) and later get reused against the new model. Rewriting or moving first means changing code you can't verify.",
        },
        {
          kind: "write",
          prompt: "Write `OrderTotalsCharacterizationTests` (XCTest) pinning down the current behavior of `totalText(for:)`: empty order → `\"$0.00\"`, and 2 × 1000 + 1 × 550 cents → `\"$25.50\"`. Create the controller with `OrderSummaryViewController()` (no need to load the view).",
          starter: swift`import XCTest
@testable import Shop

final class OrderTotalsCharacterizationTests: XCTestCase {
}`,
          checks: [
            { pattern: "func\\s+test\\w*\\(\\)", label: "Has at least one `test...()` method" },
            { pattern: "OrderSummaryViewController\\(\\)", label: "Creates the legacy controller" },
            { pattern: "OrderItem\\(priceCents:\\s*1000,\\s*quantity:\\s*2\\)", label: "Builds the 1000 × 2 item" },
            { pattern: "XCTAssertEqual\\([^\\n]*totalText\\(for:", label: "Compares the output of `totalText(for:)` with `XCTAssertEqual`" },
            { pattern: "\"\\$0\\.00\"", label: "Pins the empty case: `\"$0.00\"`" },
            { pattern: "\"\\$25\\.50\"", label: "Pins the case with items: `\"$25.50\"`" },
          ],
          warnings: [
            { pattern: "XCTAssertNotNil", label: "`XCTAssertNotNil` pins nothing: compare against the exact text" },
            { pattern: "loadViewIfNeeded", label: "No need to load the view to test the calculation" },
          ],
          solution: swift`import XCTest
@testable import Shop

final class OrderTotalsCharacterizationTests: XCTestCase {
    func test_totalText_emptyOrder() {
        let sut = OrderSummaryViewController()
        XCTAssertEqual(sut.totalText(for: []), "$0.00")
    }

    func test_totalText_sumsPriceTimesQuantity() {
        let sut = OrderSummaryViewController()
        let items = [
            OrderItem(priceCents: 1000, quantity: 2),
            OrderItem(priceCents: 550, quantity: 1),
        ]
        XCTAssertEqual(sut.totalText(for: items), "$25.50")
    }
}`,
          hint: "One test per case. `totalText(for:)` is the name defined by `NS_SWIFT_NAME`.",
        },
        {
          kind: "write",
          prompt: "Now the seam and the new model. Define `protocol OrderLoading: Sendable` with `func loadOrder(id: String) async throws -> OrderSnapshot`, and a `@MainActor` `@Observable` class `OrderSummaryModel` with `init(orderID:loader:)`, `private(set) var totalText = \"\"`, and a `func load() async` that uses the loader and formats exactly like the legacy code (`String(format: \"$%.2f\", ...)`).",
          starter: swift`// Already exists:
// struct OrderSnapshot: Sendable { let totalCents: Int }
`,
          checks: [
            { pattern: "protocol\\s+OrderLoading\\s*:\\s*Sendable", label: "Defines `OrderLoading: Sendable`" },
            { pattern: "func\\s+loadOrder\\(id:\\s*String\\)\\s*async\\s+throws\\s*->\\s*OrderSnapshot", label: "`loadOrder(id:) async throws` requirement" },
            { pattern: "@MainActor", label: "The model is `@MainActor`" },
            { pattern: "@Observable", label: "The model is `@Observable`" },
            { pattern: "init\\(orderID:\\s*String,\\s*loader:\\s*(any\\s+)?OrderLoading", label: "Takes the loader via `init(orderID:loader:)`" },
            { pattern: "try\\s+await\\s+loader\\.loadOrder\\(id:", label: "Loads with `try await loader.loadOrder(id:)`" },
            { pattern: "String\\(format:\\s*\"\\$%\\.2f\"", label: "Formats like the legacy code (`$%.2f`)" },
          ],
          warnings: [
            { pattern: "APIClient\\.shared", label: "You coupled to the singleton again: use the injected loader" },
            { pattern: "DispatchQueue\\.main", label: "With `@MainActor` you don't need `DispatchQueue.main`" },
          ],
          solution: swift`protocol OrderLoading: Sendable {
    func loadOrder(id: String) async throws -> OrderSnapshot
}

@MainActor
@Observable
final class OrderSummaryModel {
    private(set) var totalText = ""
    private(set) var failed = false
    private let orderID: String
    private let loader: any OrderLoading

    init(orderID: String, loader: any OrderLoading) {
        self.orderID = orderID
        self.loader = loader
    }

    func load() async {
        do {
            let order = try await loader.loadOrder(id: orderID)
            totalText = String(format: "$%.2f", Double(order.totalCents) / 100)
        } catch {
            failed = true
        }
    }
}`,
          hint: "Same pattern as `ProfileViewModel` from the Swift 6 lesson, with `@Observable` instead of `ObservableObject`.",
        },
        {
          kind: "write",
          prompt: "Last code step: in `OrdersCoordinator.showSummary(orderID:)`, if `flags.isEnabled(.swiftUIOrderSummary)`, push a `UIHostingController` with `OrderSummaryView(model:)` (the model built with `OrderSummaryModel(orderID: orderID, loader: loader)`); otherwise keep instantiating the old storyboard screen as today.",
          starter: swift`@MainActor
final class OrdersCoordinator {
    private let navigation: UINavigationController
    private let flags: FeatureFlags
    private let loader: any OrderLoading

    init(navigation: UINavigationController, flags: FeatureFlags, loader: any OrderLoading) {
        self.navigation = navigation
        self.flags = flags
        self.loader = loader
    }

    func showSummary(orderID: String) {
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let legacy = storyboard.instantiateViewController(withIdentifier: "OrderSummary") as! OrderSummaryViewController
        legacy.orderID = orderID
        navigation.pushViewController(legacy, animated: true)
    }
}`,
          checks: [
            { pattern: "isEnabled\\(\\s*\\.swiftUIOrderSummary\\s*\\)", label: "Checks the `.swiftUIOrderSummary` flag" },
            { pattern: "OrderSummaryModel\\(orderID:\\s*orderID,\\s*loader:\\s*loader\\)", label: "Builds the model with the injected loader" },
            { pattern: "UIHostingController\\(\\s*rootView:\\s*OrderSummaryView\\(model:", label: "Hosts `OrderSummaryView` in a `UIHostingController`" },
            { pattern: "instantiateViewController\\(withIdentifier:\\s*\"OrderSummary\"\\)", label: "Keeps the legacy screen as fallback" },
            { pattern: "pushViewController\\(", label: "Navigates with the existing `UINavigationController`" },
          ],
          warnings: [
            { pattern: "#if\\s+DEBUG", label: "An `#if` is decided at compile time: the flag must be remote" },
          ],
          solution: swift`@MainActor
final class OrdersCoordinator {
    private let navigation: UINavigationController
    private let flags: FeatureFlags
    private let loader: any OrderLoading

    init(navigation: UINavigationController, flags: FeatureFlags, loader: any OrderLoading) {
        self.navigation = navigation
        self.flags = flags
        self.loader = loader
    }

    func showSummary(orderID: String) {
        if flags.isEnabled(.swiftUIOrderSummary) {
            let model = OrderSummaryModel(orderID: orderID, loader: loader)
            let host = UIHostingController(rootView: OrderSummaryView(model: model))
            host.title = "Summary"
            navigation.pushViewController(host, animated: true)
            return
        }
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let legacy = storyboard.instantiateViewController(withIdentifier: "OrderSummary") as! OrderSummaryViewController
        legacy.orderID = orderID
        navigation.pushViewController(legacy, animated: true)
    }
}`,
          hint: "An `if` with a `return` before the legacy code, which stays as is.",
        },
        {
          kind: "predict",
          prompt: "The SwiftUI version has been at 100% for a month with no incidents. What's next?",
          code: swift`// flag swiftUIOrderSummary: 100% for the last 30 days
// crash-free rate equal to or better than the legacy version`,
          options: [
            "Keep the flag forever, just in case",
            "Port the characterization tests to the new model and, in a dedicated PR, delete the flag, the `.h`/`.m`, the storyboard scene and their bridging header entries",
            "Drop the flag to 50% to compare metrics for another month",
            "Rewrite the `.m` in Swift to keep as a backup",
          ],
          answer: 1,
          explanation: "A flag that will never be turned off again is debt: two paths to maintain and test. First port the characterization tests to `OrderSummaryModel` (so you keep the safety net), then delete all the old code together in a PR that's easy to review and revert.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-nil-message",
      front: "What happens in Objective-C when you message `nil`?",
      back: "Nothing: no crash, and it returns the zero value of the type (`nil`, `0`, `NO`). That's why some legacy bugs are silent.",
      code: objc`NSString *name = nil;
NSUInteger length = [name length];   // 0`,
    },
    {
      id: "fc-copy-nsstring",
      front: "Why does an `NSString` property use `copy` instead of `strong`?",
      back: "Because someone can pass you an `NSMutableString` and mutate it later. With `copy` you keep an immutable copy; with `strong` your value changes behind your back.",
    },
    {
      id: "fc-iuo-import",
      front: "How does an unannotated Objective-C pointer arrive in Swift?",
      back: "As an implicitly unwrapped optional (`String!`): it compiles without `?` and crashes if it was `nil`. Fix it with `nullable`/`nonnull` or `NS_ASSUME_NONNULL_BEGIN`.",
    },
    {
      id: "fc-assume-nonnull",
      front: "What does `NS_ASSUME_NONNULL_BEGIN`/`END` do?",
      back: "Makes every pointer in the region `nonnull`; you only annotate what can be missing with `nullable` (or `_Nullable`).",
    },
    {
      id: "fc-bridging",
      front: "How does Swift see the app's Objective-C, and Objective-C see the Swift?",
      back: "Objective-C → Swift: the bridging header (`MyApp-Bridging-Header.h`). Swift → Objective-C: `#import \"MyApp-Swift.h\"` in `.m` files (in `.h` files, `@class`).",
    },
    {
      id: "fc-objc-attr",
      front: "Is inheriting from `NSObject` enough for a Swift method to be visible from Objective-C?",
      back: "No. Since Swift 4 you must mark it `@objc` (or the class with `@objcMembers`). Structs, generics and enums with associated values aren't exposed.",
    },
    {
      id: "fc-swift-name",
      front: "What is `NS_SWIFT_NAME` for?",
      back: "To give an Objective-C declaration an idiomatic Swift name without changing the selector old call sites use.",
      code: objc`- (BOOL)isExpiredAtDate:(NSDate *)date NS_SWIFT_NAME(isExpired(at:));`,
    },
    {
      id: "fc-unknown-key",
      front: "`NSUnknownKeyException ... not key value coding-compliant for the key x`: what do you look for?",
      back: "A storyboard/XIB outlet (or binding) pointing to a property `x` that no longer exists: it was renamed or deleted in code without disconnecting it.",
    },
    {
      id: "fc-prepare-outlets",
      front: "Why can't you use a destination outlet in `prepare(for:sender:)`?",
      back: "Because the destination's view hasn't loaded yet and its outlets are `nil`. Pass data through properties and render it in `viewDidLoad`.",
    },
    {
      id: "fc-containment",
      front: "The three steps to embed a `UIHostingController` as a child",
      back: "`addChild(host)`, add `host.view` with constraints, `host.didMove(toParent: self)`. For dynamic sizing, `sizingOptions = .intrinsicContentSize` (iOS 16+).",
    },
    {
      id: "fc-coordinator",
      front: "What is the `Coordinator` for in a `UIViewRepresentable`?",
      back: "To act as the UIKit delegate/target: it's a class with a stable lifetime, while the representable struct is recreated on every update.",
    },
    {
      id: "fc-characterization",
      front: "What is a characterization test?",
      back: "A test that pins down what the code does today (not what it should do). It's the safety net for refactoring; bugs it reveals get fixed in a separate PR.",
    },
    {
      id: "fc-seam",
      front: "How do you open a seam without breaking call sites?",
      back: "Extract a protocol and inject it through `init` with a default value matching production. If you don't control the `init`: subclass and override a factory method.",
      code: swift`init(api: ProfileAPI = LiveProfileAPI()) { self.api = api }`,
    },
    {
      id: "fc-strangler",
      front: "Strangler fig in an iOS app",
      back: "The new screen lives alongside the old one; a single routing point decides using a remote feature flag. Gradual rollout, and once stable at 100% the flag and the old code are deleted.",
    },
    {
      id: "fc-unchecked-sendable",
      front: "What's the risk of `@unchecked Sendable`?",
      back: "It turns off compiler checking. If any access to the mutable state skips the lock, there's a data race and nobody warns you. Prefer a struct, an `actor` or `Mutex`.",
    },
  ],

  exam: [
    {
      id: "ex-01",
      question: "Crashlytics reports `[MyApp.ProfileViewController setValue:forUndefinedKey:]: this class is not key value coding-compliant for the key avatarImageView` right after a release that included a refactor. What's the most likely cause?",
      options: [
        "A storyboard outlet still points to an `avatarImageView` property that was renamed or deleted in code",
        "The avatar image didn't download in time",
        "`ProfileViewController` is missing `@objc`",
        "`avatarImageView` is declared `weak` and got deallocated",
      ],
      answer: 0,
      explanation: "When the view loads, UIKit sets each outlet through KVC using the name stored in the XML. If the property no longer exists, `setValue:forUndefinedKey:` throws `NSUnknownKeyException`. Fix it by reconnecting or deleting the outlet in Interface Builder.",
    },
    {
      id: "ex-02",
      question: "An Objective-C method `- (NSString *)displayName;` sometimes returns `nil`. From Swift, `let n: String = user.displayName()` compiles and crashes in production. What do you change in the header?",
      options: [
        "Add `@objc` to the method",
        "Change the property to `copy`",
        "Wrap the header in `NS_ASSUME_NONNULL_BEGIN`/`END` and mark the return `nullable`, so Swift sees `String?`",
        "Add `NS_SWIFT_NAME(displayName())`",
      ],
      answer: 2,
      explanation: "Without annotations the return arrives as `String!` and Swift lets you use it as non-optional. With `nullable` it arrives as `String?` and the compiler forces every call site to handle `nil`.",
    },
    {
      id: "ex-03",
      question: "The app is UIKit with `UICollectionView`, the minimum target is iOS 16, and you want new cells written in SwiftUI. What do you use?",
      options: [
        "One `UIHostingController` per cell, added as a child of the view controller in `cellForItemAt`",
        "`cell.contentConfiguration = UIHostingConfiguration { RowView(item: item) }`",
        "Rewrite the whole list in SwiftUI before touching cells",
        "A `UIViewRepresentable` inside the cell",
      ],
      answer: 1,
      explanation: "`UIHostingConfiguration` (iOS 16+) exists precisely for `UICollectionView`/`UITableView` cells: it handles reuse and self-sizing. A hosting controller per cell is expensive and complicates containment; a representable is for the opposite direction (UIKit inside SwiftUI).",
    },
    {
      id: "ex-04",
      question: "You added `func refresh()` to `final class FeedStore: NSObject` in Swift. A legacy `.m` imports `MyApp-Swift.h` but `[store refresh]` doesn't compile. Why?",
      options: [
        "`final` classes aren't exposed to Objective-C",
        "You need to import `FeedStore.swift` in the bridging header",
        "Swift methods can't be called from Objective-C",
        "`refresh()` is missing `@objc` (or the class `@objcMembers`): inheriting from `NSObject` doesn't expose methods",
      ],
      answer: 3,
      explanation: "Since Swift 4 `@objc` inference is minimal: the class is visible because it inherits from `NSObject`, but each member needs an explicit `@objc` (or `@objcMembers` for all of them). The bridging header is for the opposite direction.",
    },
    {
      id: "ex-05",
      question: "You need to change the discount rule inside a 3000-line view controller with no tests. Product wants it this week. What's the first step?",
      options: [
        "Make the change and test by hand in the simulator",
        "Rewrite the view controller in SwiftUI with the new rule",
        "Write characterization tests for the current calculation, extract it into its own type without changing behavior, and only then change the rule with a new test",
        "Add UI tests for the entire checkout flow",
      ],
      answer: 2,
      explanation: "The minimum safety net is characterizing what you'll touch; extracting the calculation (a pure refactor) makes it testable, and the rule change comes after, with its own test. A full rewrite won't fit in a week, and UI tests are slow for pinning business rules.",
    },
    {
      id: "ex-06",
      question: "An app with 12 SwiftPM modules has to migrate to Swift 6 without freezing features. What plan do you propose?",
      options: [
        "Leaf modules first: complete `StrictConcurrency` in Swift 5 mode, fix warnings in small PRs, and switch each module to Swift 6 mode; the rest stay on `.swiftLanguageMode(.v5)` until their turn",
        "Move every module to Swift 6 on a long-lived branch and merge when it compiles",
        "Wait until Apple forces Swift 6",
        "Start with the app target, since that's where most of the code is",
      ],
      answer: 0,
      explanation: "Language mode is per target, so you can advance one at a time. Leaf modules define types everyone uses: making them `Sendable` first reduces errors upstream. A long-lived branch means endless conflicts.",
    },
    {
      id: "ex-07",
      question: "In a PR you see `final class TokenCache: @unchecked Sendable { var tokens: [String: String] = [:] }` with no lock, \"so it compiles in Swift 6\". What do you comment?",
      options: [
        "Approve: `@unchecked Sendable` is the standard way to migrate",
        "Ask to add `nonisolated(unsafe)` to `tokens`",
        "Ask for the class to inherit from `NSObject`",
        "Ask to make it an `actor` (or guard every access with a lock/`Mutex`): as written it's a data race the compiler no longer detects",
      ],
      answer: 3,
      explanation: "`@unchecked` adds no synchronization; it only silences the check. With a mutable dictionary accessed from several tasks, the result is memory corruption or intermittent crashes. `nonisolated(unsafe)` is the same problem under another name.",
    },
    {
      id: "ex-08",
      question: "You wrapped `MKMapView` in a `UIViewRepresentable`. Every time the user types in a `TextField` on the same screen, the map re-centers and loses the user's zoom. What's going on?",
      options: [
        "`makeUIView` is called on every keystroke and creates a new map",
        "`updateUIView` sets the region unconditionally; it runs on every state change and overwrites what the user did. Compare before assigning (or store the last applied region in the `Coordinator`)",
        "`makeCoordinator()` is missing",
        "The map needs to be wrapped in a `UIHostingController`",
      ],
      answer: 1,
      explanation: "`makeUIView` runs only once; `updateUIView` runs every time state the parent depends on changes. A non-idempotent update resets the UIKit view. The fix is to apply only real changes.",
    },
    {
      id: "ex-09",
      question: "You rewrote checkout in SwiftUI. You want to release it to 5% of users and be able to turn it off within minutes if crashes rise. What design?",
      options: [
        "An `#if NEW_CHECKOUT` and a separate TestFlight build",
        "Replace the old screen and, if there are problems, ship a hotfix",
        "A single routing point (coordinator/factory) that picks the legacy screen or a `UIHostingController` based on a remote feature flag",
        "Show both screens and let the user choose",
      ],
      answer: 2,
      explanation: "That's the strangler fig pattern: the old code stays untouched and a remote flag decides at runtime, with no release. An `#if` is decided at compile time, and a hotfix takes days in review.",
    },
    {
      id: "ex-10",
      question: "In Swift 6, `extension CheckoutViewController: PaymentSheetDelegate` fails: \"main actor-isolated instance method cannot be used to satisfy nonisolated protocol requirement\". The SDK always calls on the main thread but doesn't declare it. What do you do?",
      options: [
        "Mark `CheckoutViewController` as `nonisolated`",
        "Declare the conformance as `@preconcurrency PaymentSheetDelegate`, which accepts it and checks at runtime that the call arrives on the main actor",
        "Wrap each method body in `DispatchQueue.main.async`",
        "Move the module back to Swift 5 mode",
      ],
      answer: 1,
      explanation: "A `@preconcurrency` conformance is meant for protocols from code that doesn't express its isolation yet. It keeps the method on the main actor and adds a dynamic check: if the SDK ever calls from another thread, you'll see it right away.",
    },
    {
      id: "ex-11",
      question: "18% of your users are still on iOS 16 and you want `@Observable` on a new screen. How do you do it?",
      options: [
        "Raise the deployment target to iOS 17 and lose those users",
        "Use `@Observable` without annotations: the compiler adapts it",
        "Avoid SwiftUI until everyone is on iOS 17",
        "Mark the model `@available(iOS 17, *)` and branch with `if #available(iOS 17, *)`, keeping the `ObservableObject` version (or the legacy screen) as fallback",
      ],
      answer: 3,
      explanation: "`@available` restricts the declaration and `#available` decides at runtime. When metrics show you can raise the deployment target, delete the fallback. Raising it right now is a business decision, not a technical one.",
    },
    {
      id: "ex-12",
      question: "In an interview you're asked: \"How would you move a 6-year-old UIKit app with Objective-C parts to SwiftUI?\" Which answer shows seniority?",
      options: [
        "Incrementally: new screens in SwiftUI hosted with `UIHostingController`, navigation in UIKit, characterization tests before touching old code, flags for rollout, and migrating existing screens only when they need to change anyway",
        "Rewrite the app in SwiftUI in parallel and launch it when complete",
        "Convert all the Objective-C to Swift first, then move to SwiftUI",
        "Don't migrate: UIKit still works",
      ],
      answer: 0,
      explanation: "A full rewrite freezes the product and often fails; converting all the Objective-C first delivers no value. The senior answer is incremental, measurable and reversible, and prioritizes code you have to touch anyway.",
    },
  ],
};

export default content;
