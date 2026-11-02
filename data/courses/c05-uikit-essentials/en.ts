import type { CourseContent } from "../types";

// Literal Swift code: String.raw keeps the `\(` of string interpolation unescaped.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "vc-lifecycle",
      title: "App and view controller lifecycle",
      goal: "Know which method UIKit calls, in what order, and what code belongs in each one.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "AppDelegate and SceneDelegate",
          body: [
            "`AppDelegate` handles **process** events: launch (`application(_:didFinishLaunchingWithOptions:)`), push notifications, global setup. Since iOS 13 the UI lives in **scenes**: each window (an iPad can have several) gets its own `SceneDelegate`.",
            "In an app without a storyboard, the `SceneDelegate` creates the `UIWindow`, sets its `rootViewController` and shows it with `makeKeyAndVisible()`. Forget that last call and the app launches to a black screen.",
            "To drop the storyboard: delete `Main.storyboard`, remove `UISceneStoryboardFile` from `Info.plist` and build the window by hand as in the example.",
          ],
          code: swift`final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UINavigationController(rootViewController: ProductListViewController())
        window.makeKeyAndVisible()
        self.window = window
    }
}`,
        },
        {
          kind: "fill",
          prompt: "The app launches to a black screen. Fill in the missing call that shows the window.",
          code: swift`let window = UIWindow(windowScene: windowScene)
window.rootViewController = HomeViewController()
window.____()
self.window = window`,
          accept: ["^makeKeyAndVisible$", "^makeKeyAndVisible\\(\\)$"],
          explanation: "`makeKeyAndVisible()` makes the window the key window and shows it. Without it the window exists but is never on screen.",
          placeholder: "make...",
        },
        {
          kind: "explain",
          title: "Appearance order",
          body: [
            "The first time a view controller is shown, UIKit calls: `loadView` → `viewDidLoad` → `viewWillAppear` → `viewWillLayoutSubviews` → `viewDidLayoutSubviews` → `viewDidAppear`.",
            "`viewDidLoad` runs **once** per instance. `viewWillAppear`/`viewDidAppear` run **every time** the screen becomes visible again (for example, coming back from a push). The layout methods can run many times (rotation, keyboard, size changes), which is why the example doesn't print them.",
            "Always call `super` in every override. And the view is loaded **lazily**: the first time anyone touches `vc.view`, UIKit runs `loadView` and `viewDidLoad` right then.",
          ],
          code: swift`final class ProfileViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        print("viewDidLoad")
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        print("viewWillAppear")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        print("viewDidAppear")
    }
}`,
          output: "viewDidLoad\nviewWillAppear\nviewDidAppear",
        },
        {
          kind: "predict",
          prompt: "Using the `ProfileViewController` above, what does this print (it's never presented)?",
          code: swift`let vc = ProfileViewController()
print("created")
vc.view.backgroundColor = .systemBackground
print("configured")`,
          options: [
            "viewDidLoad → created → configured",
            "created → configured (viewDidLoad waits until it's presented)",
            "created → viewDidLoad → configured",
            "created → viewDidLoad → viewWillAppear → configured",
          ],
          answer: 2,
          explanation: "`init` doesn't load the view. The first access to `vc.view` makes UIKit call `loadView` and then `viewDidLoad`, right at that moment. `viewWillAppear` only runs when the controller is about to go on screen, which never happens here.",
        },
        {
          kind: "explain",
          title: "What goes where",
          body: [
            "`viewDidLoad`: one-time setup: create subviews, constraints, configure the table, kick off the first data load.",
            "`viewWillAppear`: refresh whatever may have changed while you were away (a favorite toggled on another screen). `viewDidLayoutSubviews`: anything that depends on the final size, like a `cornerRadius` equal to half the height. `viewDidAppear`: animations, \"screen viewed\" analytics, starting video.",
            "`viewWillDisappear`/`viewDidDisappear`: stop anything that makes no sense off screen (timers, video, observers). Since iOS 17 there's also `viewIsAppearing`, which runs between `viewWillAppear` and `viewDidAppear` with the view's size already resolved.",
          ],
          code: swift`override func viewDidLoad() {
    super.viewDidLoad()
    setupViews()          // once
    viewModel.load()
}

override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    refreshFavorites()    // every time it becomes visible
}

override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    avatarView.layer.cornerRadius = avatarView.bounds.height / 2
}

override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    analytics.track("profile_viewed")
}`,
        },
        {
          kind: "predict",
          prompt: "The user is on A, pushes B, then taps \"Back\". When they return, which of A's methods run?",
          code: swift`// A
navigationController?.pushViewController(B(), animated: true)
// ... the user taps "Back" on B`,
          options: [
            "`init`, `viewDidLoad`, `viewWillAppear` and `viewDidAppear`",
            "`viewDidLoad` and `viewWillAppear`",
            "None: A never stopped existing",
            "`viewWillAppear` and `viewDidAppear`",
          ],
          answer: 3,
          explanation: "A is still on the navigation stack with its view loaded, so `viewDidLoad` doesn't run again. Because A becomes visible again, UIKit calls `viewWillAppear` and `viewDidAppear`. That's why data refreshes belong in `viewWillAppear`.",
        },
        {
          kind: "explain",
          title: "`deinit` and retain cycles",
          body: [
            "When you pop a controller, the stack releases it and, if nothing else holds it, it's deallocated and `deinit` runs. A `print` in `deinit` is the fastest way to spot a leak while reviewing a PR.",
            "The classic case: the controller holds its view model, the view model holds a closure, and the closure captures `self` strongly. That's a cycle and nothing gets freed. The fix is `[weak self]` in the closure.",
          ],
          code: swift`final class ProfileViewController: UIViewController {
    private let viewModel = ProfileViewModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        viewModel.onNameChange = { [weak self] name in
            self?.title = name
        }
    }

    deinit {
        print("ProfileViewController deallocated")
    }
}`,
          output: "ProfileViewController deallocated",
        },
        {
          kind: "predict",
          prompt: "Someone removed the `[weak self]`. The user opens the profile and goes back. What happens to the `print` in `deinit`?",
          code: swift`viewModel.onNameChange = { name in
    self.title = name
}`,
          options: [
            "It prints on pop, same as before",
            "It never prints: controller → viewModel → closure → controller is a cycle",
            "The app crashes on pop",
            "It prints only once the system sends a memory warning",
          ],
          answer: 1,
          explanation: "The controller holds `viewModel`, which holds the closure, which captures `self` strongly. On pop the navigation controller drops its reference, but the cycle keeps itself alive: the controller lives forever and `deinit` never runs.",
        },
        {
          kind: "write",
          prompt: "Write `SettingsViewController`: in `viewDidLoad` set a `.systemBackground` background and the title \"Settings\"; in `viewWillAppear` call `refreshData()` so the data updates every time the screen comes back. Call `super` in both.",
          starter: swift`final class SettingsViewController: UIViewController {
    // overrides here

    private func refreshData() { }
}`,
          checks: [
            { pattern: "override\\s+func\\s+viewDidLoad\\(\\)", label: "overrides `viewDidLoad()`" },
            { pattern: "super\\.viewDidLoad\\(\\)", label: "calls `super.viewDidLoad()`" },
            { pattern: "override\\s+func\\s+viewWillAppear\\(_\\s+animated:\\s*Bool\\)", label: "overrides `viewWillAppear(_:)`" },
            { pattern: "super\\.viewWillAppear\\(animated\\)", label: "calls `super.viewWillAppear(animated)`" },
            { pattern: "^\\s*refreshData\\(\\)", label: "calls `refreshData()`" },
            { pattern: "view\\.backgroundColor\\s*=\\s*\\.systemBackground", label: "`.systemBackground` background" },
          ],
          warnings: [
            { pattern: "super\\.viewWillAppear\\((true|false)\\)", label: "Pass the `animated` you received to `super`, not a constant" },
            { pattern: "override\\s+func\\s+loadView", label: "You don't need `loadView` for this" },
          ],
          solution: swift`final class SettingsViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = "Settings"
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refreshData()
    }

    private func refreshData() { }
}`,
          hint: "The signature is `override func viewWillAppear(_ animated: Bool)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "auto-layout",
      title: "Auto Layout in code",
      goal: "Build screens with anchors and stack views, and understand priorities and conflict logs.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Anchors and `NSLayoutConstraint.activate`",
          body: [
            "Every view you position with constraints needs `translatesAutoresizingMaskIntoConstraints = false`. Otherwise UIKit generates constraints from its `frame` that fight with yours.",
            "Order matters: `addSubview` first, then activate. Activate constraints together with `NSLayoutConstraint.activate([...])`: it's more efficient and easier to read than setting `isActive = true` one by one.",
            "Use `leading`/`trailing` instead of `left`/`right`: they flip automatically for right-to-left languages. And pin the top to `safeAreaLayoutGuide` so you don't end up under the notch or the navigation bar.",
          ],
          code: swift`let titleLabel = UILabel()
titleLabel.translatesAutoresizingMaskIntoConstraints = false
view.addSubview(titleLabel)

NSLayoutConstraint.activate([
    titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
    titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
    titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16)
])`,
        },
        {
          kind: "fill",
          prompt: "Fill in the property so `avatarView` doesn't generate automatic constraints from its frame.",
          code: swift`let avatarView = UIImageView()
avatarView.____ = false
view.addSubview(avatarView)`,
          accept: ["^translatesAutoresizingMaskIntoConstraints$"],
          explanation: "`translatesAutoresizingMaskIntoConstraints = false` turns off translating the autoresizing mask into constraints. Views created in Interface Builder already come that way; views you create in code don't.",
          placeholder: "translates...",
        },
        {
          kind: "predict",
          prompt: "What happens when this runs?",
          code: swift`let badge = UILabel()
badge.translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    badge.centerXAnchor.constraint(equalTo: view.centerXAnchor)
])
view.addSubview(badge)`,
          options: [
            "Works fine: the order doesn't matter",
            "The badge sits at (0, 0) with no error",
            "Crash: the constraint relates two views with no common ancestor",
            "Just a console warning and the constraint is ignored",
          ],
          answer: 2,
          explanation: "At activation time `badge` isn't in the hierarchy yet, so it shares no ancestor with `view`. UIKit throws an exception (\"because they have no common ancestor\"). Always `addSubview` before activating.",
        },
        {
          kind: "explain",
          title: "`UIStackView`",
          body: [
            "A stack view lays out its `arrangedSubviews` in a row or column and generates the constraints for you. You set `axis`, `spacing`, `alignment` and `distribution`, and only constrain the stack itself.",
            "Views are added with `addArrangedSubview`, not `addSubview`. A very handy detail: setting `isHidden = true` on an arranged subview takes it out of the layout and closes the gap.",
          ],
          code: swift`let stack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
stack.axis = .vertical
stack.spacing = 8
stack.alignment = .fill
stack.addArrangedSubview(buyButton)
stack.translatesAutoresizingMaskIntoConstraints = false
view.addSubview(stack)

NSLayoutConstraint.activate([
    stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
    stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
    stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor)
])

subtitleLabel.isHidden = true   // the button moves up; no gap left`,
        },
        {
          kind: "predict",
          prompt: "A teammate added the price like this. What does the user see?",
          code: swift`let stack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
stack.axis = .vertical
stack.addSubview(priceLabel)`,
          options: [
            "The price shows up below the subtitle",
            "The price isn't part of the stack's layout: it sits at the top left with no constraints",
            "Doesn't compile: `UIStackView` has no `addSubview`",
            "Crash from unsatisfiable constraints",
          ],
          answer: 1,
          explanation: "`addSubview` adds it to the hierarchy but not to `arrangedSubviews`, so the stack never positions it. With no constraints of its own it keeps its initial frame (`.zero`). To have the stack lay it out, use `addArrangedSubview`.",
        },
        {
          kind: "explain",
          title: "Priorities, hugging and compression resistance",
          body: [
            "Every constraint has a priority from 1 to 1000. `.required` (1000) must be satisfied; anything lower (e.g. `.defaultHigh`, 750) is optional: Auto Layout tries to satisfy it but breaks it if it conflicts with a stronger one.",
            "Views with an intrinsic size (labels, buttons) have two more priorities per axis. **Content hugging**: how hard it resists growing beyond its content (250 by default in code). **Compression resistance**: how hard it resists shrinking and truncating (750 by default).",
            "Typical case: name and price on the same row. The price must never truncate, so you raise its compression resistance; and so it doesn't stretch, you raise its hugging.",
          ],
          code: swift`// [ very long product name…      $1,299 ]
priceLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
priceLabel.setContentHuggingPriority(.defaultHigh, for: .horizontal)

// Optional constraint: gives way on narrow screens
let preferredWidth = card.widthAnchor.constraint(equalToConstant: 400)
preferredWidth.priority = .defaultHigh
preferredWidth.isActive = true`,
        },
        {
          kind: "predict",
          prompt: "`nameLabel` and `priceLabel` sit side by side with default priorities, and the name is very long. Which one truncates?",
          code: swift`NSLayoutConstraint.activate([
    nameLabel.leadingAnchor.constraint(equalTo: row.leadingAnchor),
    priceLabel.leadingAnchor.constraint(equalTo: nameLabel.trailingAnchor, constant: 8),
    priceLabel.trailingAnchor.constraint(equalTo: row.trailingAnchor)
])`,
          options: [
            "Always the name, because it comes first",
            "Always the price, because it comes last",
            "Neither: the row grows",
            "Undefined: both have 750 compression resistance; you have to break the tie yourself",
          ],
          answer: 3,
          explanation: "With equal priorities the layout is ambiguous and Auto Layout picks one with no guarantees (it can change between iOS versions). The fix is explicit: raise `priceLabel`'s horizontal compression resistance.",
        },
        {
          kind: "explain",
          title: "Reading \"Unable to simultaneously satisfy constraints\"",
          body: [
            "When two `required` constraints contradict each other, UIKit prints this log, breaks one and moves on. It doesn't crash, but the layout ends up in a state you didn't choose.",
            "Read it like this: look in the list for the constraints you didn't expect. `NSAutoresizingMaskLayoutConstraint` almost always means you forgot `translatesAutoresizingMaskIntoConstraints = false`. To make the log readable, set `accessibilityIdentifier` on views or `identifier` on constraints.",
            "To stop at the exact moment, add a symbolic breakpoint on `UIViewAlertForUnsatisfiableConstraints`.",
          ],
          code: swift`[LayoutConstraints] Unable to simultaneously satisfy constraints.
    Probably at least one of the constraints in the following list is one you don't want.
(
    "<NSAutoresizingMaskLayoutConstraint:0x6000... h=--& v=--& UILabel:0x7f9...'Hello'.minX == 0   (active)>",
    "<NSLayoutConstraint:0x6000... UILabel:0x7f9...'Hello'.leading == UIView:0x7f9....leading + 16   (active)>"
)

Will attempt to recover by breaking constraint
<NSLayoutConstraint:0x6000... UILabel:0x7f9...'Hello'.leading == UIView:0x7f9....leading + 16   (active)>

Make a symbolic breakpoint at UIViewAlertForUnsatisfiableConstraints to catch this in the debugger.`,
        },
        {
          kind: "predict",
          prompt: "A bug report comes in with this log. What's the most likely cause?",
          code: swift`"<NSAutoresizingMaskLayoutConstraint:0x6000... h=--& v=--& UIImageView:0x7f9....height == 0   (active)>",
"<NSLayoutConstraint:0x6000... UIImageView:0x7f9....height == 48   (active)>"`,
          options: [
            "The image view is missing `translatesAutoresizingMaskIntoConstraints = false`",
            "The image hadn't finished downloading",
            "A missing call to `layoutIfNeeded()`",
            "The height constraint has a low priority",
          ],
          answer: 0,
          explanation: "`NSAutoresizingMaskLayoutConstraint` is the constraint UIKit generates from the frame (height 0 here) when the view has `translatesAutoresizingMaskIntoConstraints = true`. It clashes with your `height == 48`. Set it to `false`.",
        },
        {
          kind: "write",
          prompt: "Add `cardView` to `view` and position it: 16 pt below the top of the safe area, 16 pt margin on each side (leading/trailing) and a fixed height of 120. Use `NSLayoutConstraint.activate`.",
          starter: swift`let cardView = UIView()
cardView.backgroundColor = .secondarySystemBackground
// your code`,
          checks: [
            { pattern: "cardView\\.translatesAutoresizingMaskIntoConstraints\\s*=\\s*false", label: "turns off `translatesAutoresizingMaskIntoConstraints`" },
            { pattern: "view\\.addSubview\\(cardView\\)", label: "adds the card with `addSubview`" },
            { pattern: "NSLayoutConstraint\\.activate\\(", label: "uses `NSLayoutConstraint.activate`" },
            { pattern: "topAnchor\\.constraint\\(equalTo:\\s*view\\.safeAreaLayoutGuide\\.topAnchor", label: "pins the top to the safe area" },
            { pattern: "leadingAnchor\\.constraint\\(", label: "leading constraint" },
            { pattern: "trailingAnchor\\.constraint\\(", label: "trailing constraint" },
            { pattern: "heightAnchor\\.constraint\\(equalToConstant:\\s*120\\)", label: "height of 120" },
          ],
          warnings: [
            { pattern: "\\b(leftAnchor|rightAnchor)\\b", label: "Use `leading`/`trailing` to support RTL languages" },
            { pattern: "trailingAnchor,\\s*constant:\\s*16\\)", label: "Trailing to the parent's edge takes a negative constant (`-16`)" },
          ],
          solution: swift`let cardView = UIView()
cardView.backgroundColor = .secondarySystemBackground
cardView.translatesAutoresizingMaskIntoConstraints = false
view.addSubview(cardView)

NSLayoutConstraint.activate([
    cardView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
    cardView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
    cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
    cardView.heightAnchor.constraint(equalToConstant: 120)
])`,
          hint: "`cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16)`: trailing goes negative.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "table-views",
      title: "Table views",
      goal: "Show lists with `UITableView`, understand cell reuse and avoid its classic bugs.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Data source and delegate",
          body: [
            "`UITableView` asks its `dataSource` for data (how many rows, which cell for each row) and tells its `delegate` about events (selection, height, swipe actions). Both are usually the view controller. Tap the second row in the example and it prints what's shown below.",
            "Cells are **registered** once with an identifier and requested with `dequeueReusableCell(withIdentifier:for:)`. For simple cells, `defaultContentConfiguration()` (iOS 14) gives you text, secondary text and an image without writing a subclass.",
          ],
          code: swift`final class ContactsViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private var contacts = ["Ana", "Beto", "Carla"]

    override func viewDidLoad() {
        super.viewDidLoad()
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "ContactCell")
        tableView.dataSource = self
        tableView.delegate = self
        // ... addSubview + constraints
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        contacts.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "ContactCell", for: indexPath)
        var content = cell.defaultContentConfiguration()
        content.text = contacts[indexPath.row]
        cell.contentConfiguration = content
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        print("Tapped \(contacts[indexPath.row])")
    }
}`,
          output: "Tapped Beto",
        },
        {
          kind: "fill",
          prompt: "Fill in the method that asks for an already-registered reusable cell.",
          code: swift`let cell = tableView.____(withIdentifier: "ContactCell", for: indexPath)`,
          accept: ["^dequeueReusableCell$"],
          explanation: "`dequeueReusableCell(withIdentifier:for:)` returns a cell from the reuse pool (or creates a new one) and never returns `nil` as long as the identifier is registered.",
          placeholder: "dequeue...",
        },
        {
          kind: "predict",
          prompt: "Someone deleted the `register` line in `viewDidLoad`. What happens when the table shows up?",
          code: swift`// tableView.register(UITableViewCell.self, forCellReuseIdentifier: "ContactCell")

let cell = tableView.dequeueReusableCell(withIdentifier: "ContactCell", for: indexPath)`,
          options: [
            "The table shows up empty, no error",
            "UIKit creates a standard `UITableViewCell` automatically",
            "Doesn't compile",
            "Crash: you can't dequeue an identifier that isn't registered",
          ],
          answer: 3,
          explanation: "The `withIdentifier:for:` variant requires the identifier to be registered (class or nib, or a storyboard prototype). Otherwise it throws: \"unable to dequeue a cell with identifier ContactCell\".",
        },
        {
          kind: "explain",
          title: "Cell reuse and `prepareForReuse`",
          body: [
            "With 1000 rows the table doesn't create 1000 cells: it creates enough to fill the screen plus a few. When a cell scrolls off the top it goes back to the pool and is reused for the row coming in at the bottom **with all the state it had**.",
            "The classic bug: row 3's cell starts downloading an image; the user scrolls, that cell is reused for row 40, and the old download finishes later and sets row 3's image. Result: wrong images that flicker.",
            "The fix: in `prepareForReuse`, cancel pending work and clear visual state; and in `configure`, set **every** property in every case.",
          ],
          code: swift`final class ProductCell: UITableViewCell {
    static let reuseID = "ProductCell"
    private let thumbnail = UIImageView()
    private let nameLabel = UILabel()
    private var imageTask: Task<Void, Never>?

    override func prepareForReuse() {
        super.prepareForReuse()
        imageTask?.cancel()
        thumbnail.image = nil
    }

    func configure(with product: Product, loader: ImageLoader) {
        nameLabel.text = product.name
        imageTask = Task {
            let image = await loader.image(for: product.imageURL)
            guard !Task.isCancelled else { return }
            thumbnail.image = image
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "This cell has no `prepareForReuse`. In the list, only product 2 is a favorite. What does the user see after scrolling for a while?",
          code: swift`func configure(with product: Product) {
    nameLabel.text = product.name
    if product.isFavorite {
        starView.isHidden = false
    }
}`,
          options: [
            "Only product 2 has a star",
            "No product has a star",
            "Stars show up on products that aren't favorites",
            "Crash when the cell is reused",
          ],
          answer: 2,
          explanation: "The cell that showed product 2 kept `isHidden = false`. When it's reused for another product, the `if` doesn't run and nobody hides it again. Fix: `starView.isHidden = !product.isFavorite` (always assign) or reset it in `prepareForReuse`.",
        },
        {
          kind: "explain",
          title: "Self-sizing cells",
          body: [
            "For each cell to be as tall as its content: subviews go in `contentView` (not the cell), constraints run top to bottom with no gaps, labels use `numberOfLines = 0`, and `rowHeight = UITableView.automaticDimension`.",
            "If the bottom constraint is missing, Auto Layout can't compute the height and the cell keeps the estimated height or overlaps the next one.",
          ],
          code: swift`tableView.rowHeight = UITableView.automaticDimension
tableView.estimatedRowHeight = 72

// In the cell
bodyLabel.numberOfLines = 0
contentView.addSubview(bodyLabel)
bodyLabel.translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    bodyLabel.topAnchor.constraint(equalTo: contentView.layoutMarginsGuide.topAnchor),
    bodyLabel.leadingAnchor.constraint(equalTo: contentView.layoutMarginsGuide.leadingAnchor),
    bodyLabel.trailingAnchor.constraint(equalTo: contentView.layoutMarginsGuide.trailingAnchor),
    bodyLabel.bottomAnchor.constraint(equalTo: contentView.layoutMarginsGuide.bottomAnchor)
])`,
        },
        {
          kind: "fill",
          prompt: "Fill in so rows compute their height from the cell's constraints.",
          code: swift`tableView.rowHeight = UITableView.____`,
          accept: ["^automaticDimension$"],
          explanation: "`UITableView.automaticDimension` tells the table to use Auto Layout to compute each row's height.",
          placeholder: "automatic...",
        },
        {
          kind: "explain",
          title: "Updating rows without breaking things",
          body: [
            "`reloadData()` reloads everything with no animation: it works, but you lose animations and selection state. For targeted changes use `insertRows`, `deleteRows` or `reloadRows`.",
            "Golden rule: **update the model first, then tell the table**. The table checks that the new row count equals the old one plus/minus the changes you reported.",
          ],
          code: swift`contacts.append("Diego")
let newRow = IndexPath(row: contacts.count - 1, section: 0)
tableView.insertRows(at: [newRow], with: .automatic)`,
        },
        {
          kind: "predict",
          prompt: "`contacts` has 3 elements. What happens when this runs?",
          code: swift`tableView.insertRows(at: [IndexPath(row: 3, section: 0)], with: .automatic)
contacts.append("Diego")`,
          options: [
            "Crash: \"Invalid update: invalid number of rows in section 0\"",
            "\"Diego\" is inserted with an animation",
            "An empty row is inserted and \"Diego\" shows up later",
            "Nothing happens until the next `reloadData()`",
          ],
          answer: 0,
          explanation: "When you call `insertRows`, the table asks `numberOfRowsInSection`: it expects 4 (3 + 1 inserted) but the model still has 3. It throws `NSInternalInconsistencyException`. `append` first, then `insertRows`.",
        },
        {
          kind: "write",
          prompt: "Implement `prepareForReuse` in `AvatarCell`: call `super`, cancel `loadTask`, set `avatarView.image` to `nil` and hide `badgeLabel`.",
          starter: swift`final class AvatarCell: UITableViewCell {
    let avatarView = UIImageView()
    let badgeLabel = UILabel()
    var loadTask: Task<Void, Never>?

    // prepareForReuse here
}`,
          checks: [
            { pattern: "override\\s+func\\s+prepareForReuse\\(\\)", label: "overrides `prepareForReuse()`" },
            { pattern: "super\\.prepareForReuse\\(\\)", label: "calls `super.prepareForReuse()`" },
            { pattern: "loadTask\\?\\.cancel\\(\\)", label: "cancels `loadTask`" },
            { pattern: "avatarView\\.image\\s*=\\s*nil", label: "clears the image" },
            { pattern: "badgeLabel\\.isHidden\\s*=\\s*true", label: "hides the badge" },
          ],
          warnings: [
            { pattern: "removeFromSuperview", label: "Don't tear down subviews in `prepareForReuse`: just reset their state" },
            { pattern: "reloadData", label: "A cell shouldn't reload the table" },
          ],
          solution: swift`final class AvatarCell: UITableViewCell {
    let avatarView = UIImageView()
    let badgeLabel = UILabel()
    var loadTask: Task<Void, Never>?

    override func prepareForReuse() {
        super.prepareForReuse()
        loadTask?.cancel()
        loadTask = nil
        avatarView.image = nil
        badgeLabel.isHidden = true
    }
}`,
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "modern-collections",
      title: "Modern collections",
      goal: "Use diffable data sources, compositional layout and cell registrations the way a current app does.",
      minutes: 24,
      steps: [
        {
          kind: "explain",
          title: "Diffable data source and snapshots",
          body: [
            "Instead of implementing `numberOfItems`/`cellForItemAt` and keeping things in sync by hand, you describe **what the list should look like** with a snapshot (sections + identifiers) and apply it. UIKit computes the diff and animates inserts, deletes and moves.",
            "Identifiers must be `Hashable` and **unique**. Apple recommends using the model's `id` (not the whole struct): that way a name change isn't read as \"delete one item, insert another\".",
          ],
          code: swift`enum Section { case main }

struct Recipe: Hashable, Identifiable {
    let id: UUID
    var name: String
    var minutes: Int
}

var snapshot = NSDiffableDataSourceSnapshot<Section, Recipe.ID>()
snapshot.appendSections([.main])
snapshot.appendItems(recipes.map(\.id))
dataSource.apply(snapshot, animatingDifferences: true)`,
        },
        {
          kind: "fill",
          prompt: "Fill in the method that hands the snapshot to the data source so it updates the collection.",
          code: swift`dataSource.____(snapshot, animatingDifferences: true)`,
          accept: ["^apply$"],
          explanation: "`apply(_:animatingDifferences:)` compares the new snapshot to the current one and applies only the differences.",
          placeholder: "a...",
        },
        {
          kind: "predict",
          prompt: "The API returned a duplicate recipe. What happens?",
          code: swift`let ids = [pasta.id, soup.id, pasta.id]

var snapshot = NSDiffableDataSourceSnapshot<Section, Recipe.ID>()
snapshot.appendSections([.main])
snapshot.appendItems(ids)
dataSource.apply(snapshot)`,
          options: [
            "Pasta shows up twice",
            "It ignores the duplicate and shows two cells",
            "Runtime crash: snapshot identifiers must be unique",
            "Doesn't compile",
          ],
          answer: 2,
          explanation: "Diffable identifies each cell by its identifier; with two identical ones it can't compute the diff and throws an exception about non-unique identifiers. Deduplicate the data before building the snapshot.",
        },
        {
          kind: "explain",
          title: "Compositional layout: item, group, section",
          body: [
            "The layout is built inside out: an **item** (one cell) inside a **group** (a row or column of items) inside a **section**. Sizes are expressed as `.fractionalWidth`, `.absolute` or `.estimated`.",
            "An item's `.fractionalWidth` is relative to its containing group. For table-style lists you don't build anything by hand: `UICollectionViewCompositionalLayout.list(using:)` with a `UICollectionLayoutListConfiguration`.",
          ],
          code: swift`func makeGridLayout() -> UICollectionViewLayout {
    let itemSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(0.5),
                                          heightDimension: .fractionalHeight(1.0))
    let item = NSCollectionLayoutItem(layoutSize: itemSize)
    item.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4)

    let groupSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(1.0),
                                           heightDimension: .absolute(180))
    let group = NSCollectionLayoutGroup.horizontal(layoutSize: groupSize, subitems: [item])

    let section = NSCollectionLayoutSection(group: group)
    return UICollectionViewCompositionalLayout(section: section)
}

// Settings-style list
let config = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
let listLayout = UICollectionViewCompositionalLayout.list(using: config)`,
        },
        {
          kind: "predict",
          prompt: "You change the item width in the grid above to this. How many columns do you get?",
          code: swift`let itemSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(0.25),
                                      heightDimension: .fractionalHeight(1.0))`,
          options: [
            "4 columns: each item takes a quarter of the full-width group",
            "2 narrower columns",
            "1 column at 25% width",
            "It depends on the screen size",
          ],
          answer: 0,
          explanation: "`.fractionalWidth(0.25)` is relative to the group, which is `.fractionalWidth(1.0)`. A horizontal group fits 4 items of a quarter each.",
        },
        {
          kind: "explain",
          title: "Cell registration and content configuration",
          body: [
            "`UICollectionView.CellRegistration` replaces string identifiers: you declare the cell type and the item type, plus a closure that configures the cell. Inside, use `defaultContentConfiguration()` and set text, secondary text and image.",
            "Create the registration **outside** the cell provider (e.g. in `viewDidLoad`). Creating it inside makes a new registration per cell: since iOS 15 UIKit detects this and throws an exception.",
          ],
          code: swift`let registration = UICollectionView.CellRegistration<UICollectionViewListCell, Recipe> { cell, indexPath, recipe in
    var content = cell.defaultContentConfiguration()
    content.text = recipe.name
    content.secondaryText = "\(recipe.minutes) min"
    content.image = UIImage(systemName: "fork.knife")
    cell.contentConfiguration = content
    cell.accessories = [.disclosureIndicator()]
}

dataSource = UICollectionViewDiffableDataSource<Section, Recipe.ID>(collectionView: collectionView) {
    [weak self] collectionView, indexPath, id in
    guard let recipe = self?.recipesByID[id] else { return nil }
    return collectionView.dequeueConfiguredReusableCell(using: registration, for: indexPath, item: recipe)
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the method that returns a cell already configured from a registration.",
          code: swift`return collectionView.____(using: registration, for: indexPath, item: recipe)`,
          accept: ["^dequeueConfiguredReusableCell$"],
          explanation: "`dequeueConfiguredReusableCell(using:for:item:)` dequeues the cell and runs the registration's closure with the item.",
          placeholder: "dequeue...",
        },
        {
          kind: "explain",
          title: "Updating an item: `reconfigureItems`",
          body: [
            "If identifiers are stable ids, when a recipe's **content** changes the snapshot doesn't change: you have to tell diffable which items to configure again.",
            "`reconfigureItems` (iOS 15) re-runs the configuration on the existing cell: cheap and flicker-free. `reloadItems` throws the cell away and asks for a new one; use it only when the cell type changes.",
          ],
          code: swift`recipesByID[id]?.name = "Pesto pasta"

var snapshot = dataSource.snapshot()
snapshot.reconfigureItems([id])
dataSource.apply(snapshot, animatingDifferences: true)`,
        },
        {
          kind: "predict",
          prompt: "In another project the identifier is the whole `Recipe` struct (Hashable over all its fields). You rename a recipe and apply a new snapshot with the updated struct. What does diffable conclude?",
          code: swift`var snapshot = NSDiffableDataSourceSnapshot<Section, Recipe>()
snapshot.appendSections([.main])
snapshot.appendItems(updatedRecipes)   // one has a different name
dataSource.apply(snapshot, animatingDifferences: true)`,
          options: [
            "That the recipe changed, and it reconfigures its cell",
            "Nothing: the order is the same",
            "A crash for a duplicate identifier",
            "That one item was deleted and a different one inserted: it animates delete + insert",
          ],
          answer: 3,
          explanation: "With the whole struct as identifier, changing `name` changes the hash: to diffable it's a different item. It animates a deletion and an insertion (and loses selection). That's why `Recipe.ID` is the better identifier.",
        },
        {
          kind: "write",
          prompt: "Write `applySnapshot(recipes:animated:)`: build a snapshot with `Recipe.ID` identifiers, add the `.main` section and the recipes' ids, and apply it honoring `animated`.",
          starter: swift`func applySnapshot(recipes: [Recipe], animated: Bool) {
    // your code
}`,
          checks: [
            { pattern: "NSDiffableDataSourceSnapshot<Section,\\s*Recipe\\.ID>\\(\\)", label: "creates an `NSDiffableDataSourceSnapshot<Section, Recipe.ID>`" },
            { pattern: "appendSections\\(\\[\\.main\\]\\)", label: "adds the `.main` section" },
            { pattern: "appendItems\\(", label: "adds the items" },
            { pattern: "\\.map\\s*(\\(\\\\\\.id\\)|\\{\\s*\\$0\\.id\\s*\\})", label: "uses the recipes' ids" },
            { pattern: "apply\\(snapshot,\\s*animatingDifferences:\\s*animated\\)", label: "applies with `animatingDifferences: animated`" },
          ],
          warnings: [
            { pattern: "reloadData\\(\\)", label: "With diffable, don't call `reloadData()`: apply a snapshot" },
          ],
          solution: swift`func applySnapshot(recipes: [Recipe], animated: Bool) {
    var snapshot = NSDiffableDataSourceSnapshot<Section, Recipe.ID>()
    snapshot.appendSections([.main])
    snapshot.appendItems(recipes.map(\.id))
    dataSource.apply(snapshot, animatingDifferences: animated)
}`,
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "navigation",
      title: "Navigation and communication between screens",
      goal: "Navigate with push, modals and tabs, and pass data back with delegates and closures without leaks.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Push and pop with `UINavigationController`",
          body: [
            "`UINavigationController` manages a stack: `pushViewController` adds a screen with a slide animation and a \"Back\" button; `popViewController` removes it.",
            "Pass data through the destination controller's `init`: it makes dependencies explicit and the screen can't end up half-configured. Once you define your own `init`, UIKit forces you to declare `init?(coder:)`, which in storyboard-free apps is left as `fatalError`.",
          ],
          code: swift`final class ProductDetailViewController: UIViewController {
    private let product: Product

    init(product: Product) {
        self.product = product
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

// In the list
func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let detail = ProductDetailViewController(product: products[indexPath.row])
    navigationController?.pushViewController(detail, animated: true)
}`,
        },
        {
          kind: "predict",
          prompt: "In `SceneDelegate` someone wrote `window.rootViewController = ProductListViewController()` (no navigation controller). What happens when a row is tapped?",
          code: swift`let detail = ProductDetailViewController(product: product)
navigationController?.pushViewController(detail, animated: true)`,
          options: [
            "Crash from unwrapping `nil`",
            "Nothing: `navigationController` is `nil` and optional chaining skips the push",
            "It's presented modally",
            "UIKit creates a navigation controller automatically",
          ],
          answer: 1,
          explanation: "`navigationController` is optional and is `nil` when the controller isn't inside one. With `?.` the call simply doesn't run: no error, no log. A classic silent bug; the fix is wrapping the root in a `UINavigationController`.",
        },
        {
          kind: "explain",
          title: "Modals and sheets",
          body: [
            "`present(_:animated:)` shows a controller on top; the presented one closes with `dismiss(animated:)`. Since iOS 13 the default style is a sheet (`.pageSheet`) that can be swiped down; `.fullScreen` covers everything.",
            "If the modal needs a bar with \"Cancel\"/\"Save\", present a `UINavigationController` that wraps it. With `sheetPresentationController` (iOS 15) you pick heights: `.medium()` and `.large()`.",
            "Watch out: with a sheet the controller underneath stays visible, so it does **not** get `viewWillDisappear`/`viewWillAppear` when the modal opens and closes.",
          ],
          code: swift`let editor = EditProfileViewController()
let nav = UINavigationController(rootViewController: editor)
if let sheet = nav.sheetPresentationController {
    sheet.detents = [.medium(), .large()]
}
present(nav, animated: true)

// Inside EditProfileViewController
dismiss(animated: true)`,
        },
        {
          kind: "predict",
          prompt: "`ProfileViewController` refreshes its data in `viewWillAppear`. It presents the editor with the default style, the user saves and the editor calls `dismiss`. Does the profile refresh?",
          code: swift`let editor = EditProfileViewController()
present(editor, animated: true)   // .pageSheet by default`,
          options: [
            "Yes, `viewWillAppear` runs whenever any modal closes",
            "Yes, but only if `animated` is `true`",
            "No: with a sheet the profile never disappeared, so `viewWillAppear` doesn't run",
            "No, because `viewWillAppear` only runs once per instance",
          ],
          answer: 2,
          explanation: "With `.pageSheet` the presenter stays on screen behind it, so UIKit doesn't send it appearance events. To learn that something was saved, use a delegate or a closure (coming next), not the lifecycle.",
        },
        {
          kind: "explain",
          title: "`UITabBarController`",
          body: [
            "A tab bar holds an array of `viewControllers`, one per tab. The usual setup is **each tab with its own** `UINavigationController`: that way each tab keeps its stack when you switch tabs.",
            "Each tab's icon and title come from the `tabBarItem` of that tab's root controller (here, the navigation controller).",
          ],
          code: swift`let products = UINavigationController(rootViewController: ProductListViewController())
products.tabBarItem = UITabBarItem(title: "Products", image: UIImage(systemName: "list.bullet"), tag: 0)

let favorites = UINavigationController(rootViewController: FavoritesViewController())
favorites.tabBarItem = UITabBarItem(title: "Favorites", image: UIImage(systemName: "star"), tag: 1)

let tabs = UITabBarController()
tabs.viewControllers = [products, favorites]
window.rootViewController = tabs`,
        },
        {
          kind: "explain",
          title: "Passing data back: delegate, closure and target-action",
          body: [
            "**Delegate**: an `AnyObject` protocol and a `weak var delegate` property. The `weak` avoids the cycle: the parent holds the child and the child points to the parent without retaining it. Since view controllers are `@MainActor`, mark the protocol `@MainActor` so Swift 6 accepts the conformance.",
            "**Closure**: `var onSave: ((String) -> Void)?`. Shorter for a single event; whoever assigns it captures `[weak self]`.",
            "**Target-action**: how controls report events: `addTarget(_:action:for:)` with an `@objc` method. Since iOS 14 you can also use `addAction(UIAction { ... }, for:)` with a closure.",
          ],
          code: swift`@MainActor
protocol EditProfileViewControllerDelegate: AnyObject {
    func editProfile(_ controller: EditProfileViewController, didSave name: String)
}

final class EditProfileViewController: UIViewController {
    weak var delegate: EditProfileViewControllerDelegate?
    var onCancel: (() -> Void)?
    private let nameField = UITextField()
    private let saveButton = UIButton(configuration: .filled())

    override func viewDidLoad() {
        super.viewDidLoad()
        saveButton.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)
    }

    @objc private func saveTapped() {
        delegate?.editProfile(self, didSave: nameField.text ?? "")
        dismiss(animated: true)
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the declaration so the delegate doesn't create a retain cycle.",
          code: swift`____ var delegate: EditProfileViewControllerDelegate?`,
          accept: ["^weak$"],
          explanation: "`weak` doesn't retain the delegate and becomes `nil` automatically when it's deallocated. That's why the protocol has to be `AnyObject`: `weak` only applies to classes.",
          placeholder: "w...",
        },
        {
          kind: "predict",
          prompt: "`ProfileViewController` keeps the editor in a property and the editor declares `var delegate` **without** `weak`. The user leaves the profile. What happens?",
          code: swift`final class ProfileViewController: UIViewController, EditProfileViewControllerDelegate {
    private let editor = EditProfileViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        editor.delegate = self
    }
    deinit { print("profile deallocated") }
}`,
          options: [
            "It prints \"profile deallocated\"",
            "Crash when accessing the delegate",
            "Doesn't compile without `weak`",
            "Neither is freed: profile → editor → delegate (profile) is a cycle",
          ],
          answer: 3,
          explanation: "The profile holds the editor (`let editor`) and the editor holds the profile (strong `delegate`). Neither reaches zero references and `deinit` never runs. It still compiles: Swift doesn't require `weak`, which is why this is something to catch in code review.",
        },
        {
          kind: "fill",
          prompt: "Fill in to connect the button to the `@objc saveTapped` method.",
          code: swift`saveButton.addTarget(self, action: ____(saveTapped), for: .touchUpInside)`,
          accept: ["^#selector$"],
          explanation: "`#selector(saveTapped)` creates the Objective-C selector the button calls for the given event. The method must be marked `@objc`.",
          placeholder: "#...",
        },
        {
          kind: "write",
          prompt: "In `ColorPickerViewController` declare `var onPick: ((UIColor) -> Void)?` and, in `didSelect(_:)`, call it and pop. In `ThemeViewController.openPicker()` create the picker, assign `onPick` with `[weak self]` to change `view.backgroundColor`, and push it.",
          starter: swift`final class ColorPickerViewController: UIViewController {
    func didSelect(_ color: UIColor) {
    }
}

final class ThemeViewController: UIViewController {
    func openPicker() {
    }
}`,
          checks: [
            { pattern: "var\\s+onPick:\\s*\\(\\(UIColor\\)\\s*->\\s*Void\\)\\?", label: "declares `var onPick: ((UIColor) -> Void)?`" },
            { pattern: "onPick\\?\\(color\\)", label: "calls `onPick?(color)`" },
            { pattern: "popViewController\\(animated:\\s*true\\)", label: "pops" },
            { pattern: "onPick\\s*=\\s*\\{\\s*\\[weak self\\]", label: "captures `[weak self]` when assigning `onPick`" },
            { pattern: "pushViewController\\(picker,\\s*animated:\\s*true\\)", label: "pushes the picker" },
          ],
          warnings: [
            { pattern: "onPick\\s*=\\s*\\{\\s*color\\s+in", label: "Without `[weak self]` the closure retains the controller" },
            { pattern: "unowned", label: "`unowned` crashes if the controller is already gone; prefer `weak`" },
          ],
          solution: swift`final class ColorPickerViewController: UIViewController {
    var onPick: ((UIColor) -> Void)?

    func didSelect(_ color: UIColor) {
        onPick?(color)
        navigationController?.popViewController(animated: true)
    }
}

final class ThemeViewController: UIViewController {
    func openPicker() {
        let picker = ColorPickerViewController()
        picker.onPick = { [weak self] color in
            self?.view.backgroundColor = color
        }
        navigationController?.pushViewController(picker, animated: true)
    }
}`,
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: catalog with favorites in UIKit",
      goal: "Combine lifecycle, Auto Layout, collections and navigation in a list + detail + favorites app.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "You'll build in UIKit the same app you built in SwiftUI: a tab bar with two tabs, **Products** and **Favorites**, each with its own navigation controller. The list uses a collection view with a list layout and a diffable data source.",
            "Tapping a product pushes the detail screen, which has a star button to mark it as a favorite. The detail notifies the list through a delegate and the list reconfigures only that cell. The Favorites tab must always show the current state.",
            "Shared state lives in `FavoritesStore`, a class injected through `init` into the screens that need it.",
          ],
          code: swift`struct Product: Hashable, Identifiable, Sendable {
    let id: Int
    let name: String
    let price: Decimal
}

enum Section { case main }

@MainActor
final class FavoritesStore {
    private(set) var ids: Set<Product.ID> = []

    func toggle(_ id: Product.ID) {
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
    }

    func isFavorite(_ id: Product.ID) -> Bool { ids.contains(id) }
}`,
        },
        {
          kind: "write",
          prompt: "Build the `SceneDelegate`: create a `FavoritesStore`, two `UINavigationController`s (list and favorites, both receive the store), each with its `tabBarItem`, put them in a `UITabBarController` as the window's root and show the window.",
          starter: swift`func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
           options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: windowScene)
    // your code
    self.window = window
}`,
          checks: [
            { pattern: "FavoritesStore\\(\\)", label: "creates a `FavoritesStore`" },
            { pattern: "UINavigationController\\(rootViewController:\\s*ProductListViewController\\(", label: "navigation controller for the list" },
            { pattern: "UINavigationController\\(rootViewController:\\s*FavoritesViewController\\(", label: "navigation controller for favorites" },
            { pattern: "\\.tabBarItem\\s*=\\s*UITabBarItem\\(", label: "sets up the `tabBarItem`s" },
            { pattern: "\\.viewControllers\\s*=\\s*\\[", label: "assigns the tab bar's `viewControllers`" },
            { pattern: "rootViewController\\s*=\\s*tabs", label: "the tab bar is the window's root" },
            { pattern: "makeKeyAndVisible\\(\\)", label: "shows the window" },
          ],
          warnings: [
            { pattern: "UINavigationController\\(rootViewController:\\s*tabs\\)", label: "The tab bar goes on the outside: each tab gets its own navigation controller" },
          ],
          solution: swift`func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
           options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: windowScene)
    let store = FavoritesStore()

    let products = UINavigationController(rootViewController: ProductListViewController(store: store))
    products.tabBarItem = UITabBarItem(title: "Products", image: UIImage(systemName: "list.bullet"), tag: 0)

    let favorites = UINavigationController(rootViewController: FavoritesViewController(store: store))
    favorites.tabBarItem = UITabBarItem(title: "Favorites", image: UIImage(systemName: "star"), tag: 1)

    let tabs = UITabBarController()
    tabs.viewControllers = [products, favorites]
    window.rootViewController = tabs
    window.makeKeyAndVisible()
    self.window = window
}`,
        },
        {
          kind: "write",
          prompt: "In `ProductListViewController.viewDidLoad`, create the collection view with an `.insetGrouped` list layout, pin it to `view`'s edges with constraints, create a `CellRegistration<UICollectionViewListCell, Product>` that shows the name and a star when it's a favorite, and the `UICollectionViewDiffableDataSource<Section, Product.ID>`.",
          starter: swift`final class ProductListViewController: UIViewController {
    private let store: FavoritesStore
    private var productsByID: [Product.ID: Product] = [:]
    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, Product.ID>!

    // init(store:) already implemented

    override func viewDidLoad() {
        super.viewDidLoad()
        // your code
    }
}`,
          checks: [
            { pattern: "UICollectionLayoutListConfiguration\\(appearance:\\s*\\.insetGrouped\\)", label: "`.insetGrouped` list configuration" },
            { pattern: "UICollectionViewCompositionalLayout\\.list\\(using:", label: "`.list(using:)` layout" },
            { pattern: "translatesAutoresizingMaskIntoConstraints\\s*=\\s*false", label: "turns off the autoresizing mask" },
            { pattern: "UICollectionView\\.CellRegistration<UICollectionViewListCell,\\s*Product>", label: "typed cell registration" },
            { pattern: "defaultContentConfiguration\\(\\)", label: "uses `defaultContentConfiguration()`" },
            { pattern: "UICollectionViewDiffableDataSource<Section,\\s*Product\\.ID>\\(collectionView:", label: "creates the diffable data source" },
            { pattern: "dequeueConfiguredReusableCell\\(using:\\s*registration", label: "dequeues with the registration" },
          ],
          warnings: [
            { pattern: "register\\(UICollectionViewCell\\.self", label: "With `CellRegistration` you don't need string-based `register`" },
            { pattern: "\\{\\s*collectionView,\\s*indexPath,\\s*id\\s+in[\\s\\S]*CellRegistration", label: "Create the registration outside the cell provider" },
          ],
          solution: swift`override func viewDidLoad() {
    super.viewDidLoad()
    title = "Products"

    let config = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
    let layout = UICollectionViewCompositionalLayout.list(using: config)
    collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
    collectionView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(collectionView)
    NSLayoutConstraint.activate([
        collectionView.topAnchor.constraint(equalTo: view.topAnchor),
        collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
        collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])

    let registration = UICollectionView.CellRegistration<UICollectionViewListCell, Product> { [store] cell, _, product in
        var content = cell.defaultContentConfiguration()
        content.text = product.name
        content.image = store.isFavorite(product.id) ? UIImage(systemName: "star.fill") : nil
        cell.contentConfiguration = content
        cell.accessories = [.disclosureIndicator()]
    }

    dataSource = UICollectionViewDiffableDataSource<Section, Product.ID>(collectionView: collectionView) {
        [weak self] collectionView, indexPath, id in
        guard let product = self?.productsByID[id] else { return nil }
        return collectionView.dequeueConfiguredReusableCell(using: registration, for: indexPath, item: product)
    }
}`,
          hint: "Registration first, then the data source that uses it in its closure.",
        },
        {
          kind: "write",
          prompt: "Implement the detail screen: a `ProductDetailViewControllerDelegate` protocol (`@MainActor`, `AnyObject`) with `didToggleFavorite`, a `weak var delegate`, and a button wired with target-action to `starTapped`, which calls `store.toggle` and notifies the delegate. Then, in the list, implement the delegate method by reconfiguring only that item.",
          starter: swift`final class ProductDetailViewController: UIViewController {
    private let product: Product
    private let store: FavoritesStore
    private let starButton = UIButton(configuration: .plain())

    // init(product:store:) already implemented
}

extension ProductListViewController {
}`,
          checks: [
            { pattern: "protocol\\s+ProductDetailViewControllerDelegate:\\s*AnyObject", label: "`AnyObject` protocol" },
            { pattern: "weak\\s+var\\s+delegate:\\s*ProductDetailViewControllerDelegate\\?", label: "`weak var delegate`" },
            { pattern: "addTarget\\(self,\\s*action:\\s*#selector\\(starTapped\\)", label: "target-action with `#selector(starTapped)`" },
            { pattern: "@objc\\s+(private\\s+)?func\\s+starTapped", label: "`@objc starTapped` method" },
            { pattern: "store\\.toggle\\(product\\.id\\)", label: "toggles the favorite in the store" },
            { pattern: "delegate\\?\\.", label: "notifies the delegate" },
            { pattern: "reconfigureItems\\(\\[", label: "reconfigures only the affected item" },
            { pattern: "dataSource\\.apply\\(snapshot", label: "applies the snapshot" },
          ],
          warnings: [
            { pattern: "^\\s*var\\s+delegate", label: "A delegate without `weak` creates a cycle" },
            { pattern: "reloadData\\(\\)", label: "Don't reload the whole collection for one item" },
          ],
          solution: swift`@MainActor
protocol ProductDetailViewControllerDelegate: AnyObject {
    func productDetail(_ controller: ProductDetailViewController, didToggleFavorite id: Product.ID)
}

final class ProductDetailViewController: UIViewController {
    weak var delegate: ProductDetailViewControllerDelegate?
    private let product: Product
    private let store: FavoritesStore
    private let starButton = UIButton(configuration: .plain())

    override func viewDidLoad() {
        super.viewDidLoad()
        starButton.addTarget(self, action: #selector(starTapped), for: .touchUpInside)
        updateStar()
    }

    @objc private func starTapped() {
        store.toggle(product.id)
        updateStar()
        delegate?.productDetail(self, didToggleFavorite: product.id)
    }

    private func updateStar() {
        let name = store.isFavorite(product.id) ? "star.fill" : "star"
        starButton.setImage(UIImage(systemName: name), for: .normal)
    }
}

extension ProductListViewController: ProductDetailViewControllerDelegate {
    func productDetail(_ controller: ProductDetailViewController, didToggleFavorite id: Product.ID) {
        var snapshot = dataSource.snapshot()
        snapshot.reconfigureItems([id])
        dataSource.apply(snapshot, animatingDifferences: true)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "`FavoritesViewController` loads its list in `viewDidLoad`. The user opens Favorites, goes back to Products, marks two favorites and returns to Favorites. What do they see, and what's the simplest fix?",
          code: swift`override func viewDidLoad() {
    super.viewDidLoad()
    setupCollectionView()
    applySnapshot(ids: Array(store.ids))
}`,
          options: [
            "The new favorites: the tab bar recreates the screen",
            "A crash: the snapshot is stale",
            "The old list; call `applySnapshot` in `viewWillAppear`",
            "The old list; move all of `viewDidLoad` into `init`",
          ],
          answer: 2,
          explanation: "Switching tabs doesn't destroy the controller: `viewDidLoad` doesn't run again, but `viewWillAppear` runs every time the tab is shown. Applying the snapshot there keeps the list current (observing the store is another option).",
        },
      ],
    },
  ],

  flashcards: [
    { id: "fc-lifecycle-order", front: "In what order are the methods called the first time a view controller is shown?", back: "`loadView` → `viewDidLoad` → `viewWillAppear` → `viewWillLayoutSubviews` → `viewDidLayoutSubviews` → `viewDidAppear`." },
    { id: "fc-viewdidload-once", front: "How many times does `viewDidLoad` run?", back: "Once per instance, the first time `view` is accessed. `viewWillAppear` runs every time the screen becomes visible again." },
    { id: "fc-scene-delegate", front: "What does the `SceneDelegate` do in a storyboard-free app?", back: "Creates the `UIWindow` from the `UIWindowScene`, sets `rootViewController` and calls `makeKeyAndVisible()`." },
    { id: "fc-tamic", front: "What happens if you forget `translatesAutoresizingMaskIntoConstraints = false`?", back: "UIKit generates `NSAutoresizingMaskLayoutConstraint`s from the frame that clash with your constraints: \"Unable to simultaneously satisfy constraints\".", code: "label.translatesAutoresizingMaskIntoConstraints = false" },
    { id: "fc-hugging-compression", front: "Content hugging vs compression resistance", back: "Hugging: resistance to growing beyond the content (250 by default in code). Compression resistance: resistance to shrinking and truncating (750 by default)." },
    { id: "fc-priority", front: "What does a constraint with priority 750 mean?", back: "It's optional: Auto Layout tries to satisfy it but breaks it if it conflicts with a higher priority. Only 1000 (`.required`) is mandatory." },
    { id: "fc-unsatisfiable", front: "How do you stop in the debugger when constraints conflict?", back: "Symbolic breakpoint on `UIViewAlertForUnsatisfiableConstraints`." },
    { id: "fc-stack-hidden", front: "What happens when you hide an arranged subview of a `UIStackView`?", back: "The stack removes it from the layout and closes the gap; no constraint changes needed." },
    { id: "fc-prepare-reuse", front: "What is `prepareForReuse` for?", back: "Resetting the cell before reuse: cancel pending downloads and clear image and state. On top of that, `configure` must always set every property.", code: "override func prepareForReuse() {\n    super.prepareForReuse()\n    imageTask?.cancel()\n    imageView.image = nil\n}" },
    { id: "fc-insert-rows", front: "In what order do you update the model and the table when inserting a row?", back: "Model first, then `insertRows`. The other way around: \"Invalid update: invalid number of rows\"." },
    { id: "fc-diffable-ids", front: "What should you use as the identifier in a diffable data source?", back: "The model's stable `id` (`Recipe.ID`), not the whole struct. Report content changes with `reconfigureItems`." },
    { id: "fc-compositional", front: "What are the building blocks of a compositional layout?", back: "Item inside group inside section. Sizes via `.fractionalWidth`, `.absolute` or `.estimated`; an item is relative to its group." },
    { id: "fc-cell-registration", front: "Where do you create a `UICollectionView.CellRegistration`?", back: "Outside the cell provider (e.g. in `viewDidLoad`). Inside, it creates one registration per cell, and since iOS 15 that throws an exception." },
    { id: "fc-weak-delegate", front: "Why is the delegate `weak` and the protocol `AnyObject`?", back: "Because the parent usually holds the child; if the child holds the delegate (the parent) you get a cycle. `weak` only works with classes, hence `AnyObject`.", code: "weak var delegate: EditorDelegate?" },
    { id: "fc-sheet-lifecycle", front: "Does the presenter get `viewWillAppear` when a `.pageSheet` sheet is dismissed?", back: "No: it never went off screen. With `.fullScreen` it does. To get a result back, use a delegate or a closure." },
  ],

  exam: [
    {
      id: "ex-refresh-where",
      question: "The cart screen must show an up-to-date total every time the user comes back to it from a product detail (push/pop). Where do you recompute the total?",
      options: ["`viewDidLoad`", "`init`", "`viewWillAppear`", "`deinit`"],
      answer: 2,
      explanation: "`viewDidLoad` runs only once; on pop, UIKit calls the cart's `viewWillAppear` and `viewDidAppear`. `viewWillAppear` is the place to refresh before it's visible.",
    },
    {
      id: "ex-corner-radius",
      question: "You want a circular avatar whose size depends on constraints. Where do you set `layer.cornerRadius = bounds.height / 2`?",
      options: ["In `viewDidLoad`, right after creating the view", "In `viewDidLayoutSubviews`", "In `init`", "In `viewWillAppear`"],
      answer: 1,
      explanation: "In `viewDidLoad` and `viewWillAppear` layout hasn't been resolved yet and `bounds` may be zero or the wrong size. In `viewDidLayoutSubviews` frames are final (and it runs again if they change).",
    },
    {
      id: "ex-leak-review",
      question: "You see this in a view controller during PR review. What do you comment?",
      code: "viewModel.onUpdate = { items in\n    self.items = items\n    self.tableView.reloadData()\n}",
      options: [
        "Nothing, it's fine",
        "It's missing `DispatchQueue.main.async`",
        "Closures should always use `unowned self`",
        "Retain cycle: the controller holds the view model, which holds the closure capturing `self`; use `[weak self]`",
      ],
      answer: 3,
      explanation: "controller → viewModel → closure → controller. With `[weak self]` and `self?.` the controller is freed when you leave the screen. `unowned` crashes if the closure runs after deallocation.",
    },
    {
      id: "ex-unsatisfiable",
      question: "The log shows \"Unable to simultaneously satisfy constraints\" with an `NSAutoresizingMaskLayoutConstraint` on your `headerView`. What do you do first?",
      options: [
        "Check that `headerView` has `translatesAutoresizingMaskIntoConstraints = false`",
        "Lower every constraint's priority to 999",
        "Call `layoutIfNeeded()` in `viewDidLoad`",
        "Ignore it: UIKit sorts it out",
      ],
      answer: 0,
      explanation: "UIKit generates that constraint from the frame when the property is `true`. Setting it to `false` removes the conflict. Blindly lowering priorities hides the problem and leaves the layout unpredictable.",
    },
    {
      id: "ex-price-truncate",
      question: "In a row with a name and a price, the price sometimes shows truncated (\"$1,2…\"). What's the right fix?",
      options: [
        "Give the name a fixed width",
        "Raise the price's horizontal compression resistance to `.required`",
        "Lower the price's content hugging to 1",
        "Set `numberOfLines = 0` on the price",
      ],
      answer: 1,
      explanation: "With equal compression resistance (750) on both labels, which one truncates is ambiguous. Raising it on the price guarantees the name is the one that gives way. A fixed width breaks with Dynamic Type and other languages.",
    },
    {
      id: "ex-wrong-image",
      question: "In a list of users, when scrolling fast some rows briefly show another user's photo. What's the cause and the fix?",
      options: [
        "The image cache is full; clear it",
        "Cells are reused and old downloads finish late; cancel the task and clear the image in `prepareForReuse`",
        "You need to call `reloadData()` after every download",
        "`estimatedRowHeight` is wrong",
      ],
      answer: 1,
      explanation: "A reused cell still has its previous row's download in flight. Cancelling it in `prepareForReuse` (or checking the id still matches before assigning) removes the wrong image.",
    },
    {
      id: "ex-insert-crash",
      question: "Crashlytics reports `NSInternalInconsistencyException: Invalid update: invalid number of rows in section 0` right after adding a comment. What do you look for in the code?",
      options: [
        "An `insertRows` call made before appending the element to the data source's array",
        "An unregistered cell",
        "A `rowHeight` of zero",
        "A delegate without `weak`",
      ],
      answer: 0,
      explanation: "The table checks that new rows = old rows + insertions − deletions. If the model wasn't updated before `insertRows`, the math doesn't add up and it throws.",
    },
    {
      id: "ex-diffable-rename",
      question: "With `UICollectionViewDiffableDataSource<Section, Note>` (the whole struct as identifier), every time the user edits a note's title the cell animates out and back in. What do you change?",
      options: [
        "Apply the snapshot with `animatingDifferences: false` and call it done",
        "Call `reloadData()` instead of applying the snapshot",
        "Use `Note.ID` as the identifier and report the change with `reconfigureItems`",
        "Make `Note` a class",
      ],
      answer: 2,
      explanation: "Changing the title changes the hash, so diffable sees a delete + insert. With a stable id the item is \"the same\" and `reconfigureItems` updates the existing cell without flicker.",
    },
    {
      id: "ex-grid-columns",
      question: "In a compositional layout the group is horizontal with `.fractionalWidth(1.0)` and the item has `.fractionalWidth(1.0 / 3.0)`. What do you get?",
      options: ["One column at 33%", "Three columns", "One horizontally scrolling row", "It depends on the device"],
      answer: 1,
      explanation: "An item's fractional width is relative to its group. A third of a full-width group gives three items per row, i.e. three columns.",
    },
    {
      id: "ex-push-nothing",
      question: "Tapping a cell does nothing and there are no logs. The code calls `navigationController?.pushViewController(detail, animated: true)`. Most likely cause?",
      options: [
        "The list controller isn't inside a `UINavigationController`",
        "It needs `animated: false`",
        "The detail doesn't implement `viewDidLoad`",
        "A `present` is missing before the push",
      ],
      answer: 0,
      explanation: "Without a navigation controller, `navigationController` is `nil` and optional chaining does nothing. Wrapping the root (or the tab) in a `UINavigationController` fixes it.",
    },
    {
      id: "ex-modal-refresh",
      question: "The profile presents an editor with the default style. After saving, the profile doesn't show the new name even though it reloads in `viewWillAppear`. What do you do?",
      options: [
        "Switch to `viewDidAppear`",
        "Call `viewWillAppear` manually from the editor",
        "Recreate the profile with a push",
        "Report the save through a `weak` delegate or a closure and update there",
      ],
      answer: 3,
      explanation: "With `.pageSheet` the profile never disappears, so it gets no appearance events. Communicating the result explicitly (delegate or closure) is the right call; invoking lifecycle methods by hand is not.",
    },
    {
      id: "ex-tab-nav",
      question: "You have three tabs and each one navigates to detail screens. Which hierarchy do you use?",
      options: [
        "One `UINavigationController` with a `UITabBarController` inside",
        "A `UITabBarController` with no navigation controllers; details via `present`",
        "A `UITabBarController` whose tabs are each a `UINavigationController`",
        "Three windows, one per tab",
      ],
      answer: 2,
      explanation: "Tab bar on the outside, one navigation controller per tab: each tab keeps its own stack and the tab bar stays visible while you navigate.",
    },
  ],
};

export default content;
