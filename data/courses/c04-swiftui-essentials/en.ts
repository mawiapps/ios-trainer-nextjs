import type { CourseContent } from "../types";

// String.raw: Swift code and regexes are written as-is, no double escaping.
const r = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "views-modifiers",
      title: "Views and modifiers",
      goal: "Build a screen with stacks, `Spacer`, `Image` and modifiers, and understand why modifier order changes the result.",
      minutes: 14,
      steps: [
        {
          kind: "explain",
          title: "A view is a struct with a `body`",
          body: [
            "In SwiftUI a screen is a `struct` that conforms to `View` and has exactly one required property: `var body: some View`. `body` describes **what** is on screen for the current state; SwiftUI decides when to recompute it and how to update the pixels.",
            "`some View` is an opaque type: you tell the compiler \"I return one concrete view type, you don't need me to spell it out\". That's why you can combine `VStack`, `Text` and modifiers without writing huge generic types.",
            "The three basic stacks: `VStack` (vertical), `HStack` (horizontal) and `ZStack` (layered). `Spacer()` takes all the free space along the stack's axis and pushes its neighbors toward the edges.",
          ],
          code: r`import SwiftUI

struct WelcomeView: View {
    var body: some View {
        VStack(spacing: 8) {
            Text("Hello")
                .font(.largeTitle)
            Text("Welcome to the app")
                .foregroundStyle(.secondary)
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The view fills the whole iPhone screen. Where do `A` and `B` show up?",
          code: r`struct SpacerDemo: View {
    var body: some View {
        VStack {
            Text("A")
            Spacer()
            Text("B")
        }
    }
}`,
          options: [
            "Both together in the center of the screen",
            "`A` in the center and `B` at the bottom",
            "Both at the top, one below the other",
            "`A` at the very top and `B` at the very bottom",
          ],
          answer: 3,
          explanation: "A `VStack` containing a `Spacer()` stretches to fill all the available height. The `Spacer` takes all the free vertical space between the two texts, so `A` sticks to the top and `B` to the bottom. Without the `Spacer`, the stack would be just tall enough for its content and end up centered.",
        },
        {
          kind: "explain",
          title: "Modifier order matters",
          body: [
            "Each modifier **wraps** the previous view and returns a new one. `.padding()` creates a bigger view with space around it; `.background(...)` paints behind the view it receives, at that view's size.",
            "So `.padding().background(.yellow)` paints behind the already-enlarged view (the yellow includes the padding), while `.background(.yellow).padding()` paints tightly behind the text and then adds transparent space around it.",
            "Rule of thumb: read modifiers top to bottom as layers added on the outside. Same goes for `.frame`, `.border` and `.clipShape`.",
          ],
          code: r`Text("Hello")
    .padding()              // 1. makes the view bigger
    .background(.yellow)    // 2. paints behind the bigger view
    .clipShape(.rect(cornerRadius: 8))  // 3. clips everything above`,
        },
        {
          kind: "predict",
          prompt: "In which version does the yellow background also cover the padding area?",
          code: r`// Version 1
Text("Hello")
    .padding()
    .background(.yellow)

// Version 2
Text("Hello")
    .background(.yellow)
    .padding()`,
          options: [
            "Only in version 1",
            "Only in version 2",
            "Both: modifier order makes no difference",
            "Neither: `.background` always ignores padding",
          ],
          answer: 0,
          explanation: "In version 1, `.padding()` first enlarges the view and `.background` paints behind that enlarged view: yellow covers text + padding. In version 2, `.background` paints behind the bare text (tight fit) and the padding is added afterwards, outside, transparent.",
        },
        {
          kind: "explain",
          title: "Images, SF Symbols and `#Preview`",
          body: [
            "`Image(\"logo\")` loads an image from the Asset Catalog. `Image(systemName: \"star.fill\")` uses an SF Symbol: Apple's vector icons that scale with the font, so you style them with `.font` and `.foregroundStyle` just like text.",
            "For catalog photos use `.resizable()` + `.scaledToFit()` (or `.scaledToFill()`); without `.resizable()` the image renders at its original size and ignores the `frame`.",
            "The `#Preview` macro (Xcode 15+) renders the view in the canvas without running the app. You can have several previews per file with different data.",
          ],
          code: r`struct RatingBadge: View {
    let score: Double

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "star.fill")
                .foregroundStyle(.yellow)
            Text(score, format: .number.precision(.fractionLength(1)))
                .font(.headline)
        }
    }
}

#Preview {
    RatingBadge(score: 4.5)
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the parameter label to show the `heart.fill` SF Symbol.",
          code: r`Image(____: "heart.fill")
    .font(.title)
    .foregroundStyle(.red)`,
          accept: ["^systemName$"],
          explanation: "`Image(systemName:)` looks the icon up in SF Symbols. `Image(\"heart.fill\")` without a label would look for an asset with that name in the Asset Catalog and wouldn't find it.",
          hint: "It's the `Image` initializer for system icons.",
          placeholder: "parameter label",
        },
        {
          kind: "write",
          prompt: "Write `ContactCard`: a row with an SF Symbol on the left and, to its right, the name on top and the role below, both leading-aligned. The whole card has padding and a light gray background that covers the padding. Add a `#Preview`.",
          starter: r`import SwiftUI

struct ContactCard: View {
    let name: String
    let role: String

    var body: some View {
        // icon + name/role
        Text(name)
    }
}`,
          checks: [
            { pattern: r`HStack`, label: "Uses an `HStack` for icon + texts" },
            { pattern: r`Image\(systemName:\s*"[\w.]+"\)`, label: "Shows an SF Symbol with `Image(systemName:)`" },
            { pattern: r`VStack\(alignment:\s*\.leading`, label: "Texts in a `VStack(alignment: .leading)`" },
            { pattern: r`\.padding\(`, label: "Adds `.padding()`" },
            { pattern: r`\.background\(`, label: "Adds `.background(...)`" },
            { pattern: r`#Preview`, label: "Includes `#Preview`" },
          ],
          warnings: [
            { pattern: r`\.background\([^\n]*\)\s*\n\s*\.padding\(\)`, label: "With `.background` before `.padding()`, the background won't cover the padding" },
            { pattern: r`UIImage|UIView`, label: "You don't need UIKit for this" },
          ],
          solution: r`import SwiftUI

struct ContactCard: View {
    let name: String
    let role: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.crop.circle.fill")
                .font(.largeTitle)
                .foregroundStyle(.blue)
            VStack(alignment: .leading) {
                Text(name)
                    .font(.headline)
                Text(role)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color.gray.opacity(0.15))
    }
}

#Preview {
    ContactCard(name: "Ana", role: "iOS Engineer")
}`,
          hint: "Order: `HStack { Image; VStack(alignment: .leading) { ... }; Spacer() }`, then `.padding()` and `.background(...)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "state",
      title: "State: `@State`, `@Binding` and the environment",
      goal: "Decide who owns each piece of data and pick between `@State`, `@Binding`, `@Environment`, `@AppStorage` and `@FocusState`.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "`@State`: the view owns the data",
          body: [
            "View structs are created and thrown away constantly, so a plain `var` can't hold state (and you can't mutate it from `body` anyway). `@State` asks SwiftUI to store the value **outside** the struct, tied to the view's identity on screen.",
            "When a `@State` changes, SwiftUI recomputes that view's `body` and updates only what changed. Always make it `private`: it's local state and nobody outside should initialize it.",
            "Use it for simple values the view owns: a counter, a text field's text, whether a sheet is open.",
          ],
          code: r`struct CounterView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Count: \(count)")
            Button("Add") { count += 1 }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The user taps \"Add\" twice. What text is on screen?",
          code: r`struct ScoreView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Total: \(count * 10)")
            Button("Add") { count += 1 }
        }
    }
}`,
          options: ["Total: 0", "Total: 10", "Total: 20", "Total: 2"],
          answer: 2,
          explanation: "Each tap adds 1 to `count`: after two taps it's 2. Every `@State` change recomputes `body`, and the text shows `count * 10`, i.e. `Total: 20`.",
        },
        {
          kind: "explain",
          title: "`@Binding`: borrowed state",
          body: [
            "When a child view needs to **change** the parent's data, you don't pass the value: you pass a `Binding`, a read/write reference to the parent's `@State`. You get it with the `$` prefix.",
            "That gives you a **single source of truth**: the data lives in one place (the parent) and everyone reads and writes it through the binding. If the child declares its own `@State` holding a copy of the value, you now have two sources that drift apart.",
            "SwiftUI controls (`Toggle`, `TextField`, `Slider`, `Picker`) take bindings for exactly this reason.",
          ],
          code: r`struct Parent: View {
    @State private var isOn = false

    var body: some View {
        VStack {
            Text(isOn ? "On" : "Off")
            LightSwitch(isOn: $isOn)   // $ → Binding<Bool>
        }
    }
}

struct LightSwitch: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle("Light", isOn: $isOn)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The user turns the `Toggle` on. What's on screen?",
          code: r`struct Parent: View {
    @State private var isOn = false

    var body: some View {
        VStack {
            Text(isOn ? "On" : "Off")
            LightSwitch(isOn: isOn)
        }
    }
}

struct LightSwitch: View {
    @State var isOn: Bool

    var body: some View {
        Toggle("Light", isOn: $isOn)
    }
}`,
          options: [
            "The toggle is on and the text says \"On\"",
            "The toggle is on and the text still says \"Off\"",
            "It doesn't compile: you can't pass a `Bool` into a `@State`",
            "The toggle flips back off by itself",
          ],
          answer: 1,
          explanation: "`LightSwitch` gets a **copy** of the value and stores it in its own `@State`. The toggle mutates that copy, not the parent's state, so the parent's `Text` stays \"Off\". There are two sources of truth. The fix is `@Binding var isOn: Bool` and passing `$isOn`.",
        },
        {
          kind: "fill",
          prompt: "Fill in the argument so the `Toggle` reads and writes `wifiOn`.",
          code: r`struct WifiSettings: View {
    @State private var wifiOn = true

    var body: some View {
        Toggle("Wi-Fi", isOn: ____)
    }
}`,
          accept: [r`^\$wifiOn$`],
          explanation: "`isOn:` expects a `Binding<Bool>`. `wifiOn` is the value (`Bool`); `$wifiOn` is the binding projected by the `@State`.",
          hint: "The prefix that turns a `@State` into a `Binding`.",
        },
        {
          kind: "explain",
          title: "`@Environment`, `@AppStorage` and `@FocusState`",
          body: [
            "`@Environment` reads values SwiftUI propagates down the tree: `\\.dismiss` (close the sheet or go back), `\\.colorScheme`, `\\.locale`, `\\.horizontalSizeClass`. The view doesn't own that data; it consumes it.",
            "`@AppStorage(\"key\")` is like a `@State` backed by `UserDefaults`: it survives app relaunches. Good for small preferences (theme, last filter); never for tokens or sensitive data, which belong in the Keychain.",
            "`@FocusState` controls which field has the keyboard. With an enum you can move focus between fields and dismiss it by assigning `nil`.",
          ],
          code: r`struct LoginView: View {
    enum Field { case email, password }

    @Environment(\.dismiss) private var dismiss
    @AppStorage("lastEmail") private var email = ""
    @State private var password = ""
    @FocusState private var focused: Field?

    var body: some View {
        Form {
            TextField("Email", text: $email)
                .focused($focused, equals: .email)
                .onSubmit { focused = .password }
            SecureField("Password", text: $password)
                .focused($focused, equals: .password)
            Button("Cancel") { dismiss() }
        }
        .onAppear { focused = .email }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "You want the app to remember that the user chose \"sort by date\", even after they quit and relaunch. Which wrapper do you use?",
          code: r`struct InboxView: View {
    ____ private var sortByDate = false
    // ...
}`,
          options: [
            "`@State`",
            "`@AppStorage(\"sortByDate\")`",
            "`@Environment(\\.sortByDate)`",
            "`@FocusState`",
          ],
          answer: 1,
          explanation: "`@State` lives as long as the view is on screen and is gone after a relaunch. `@AppStorage` stores the value in `UserDefaults` and also re-renders the view when it changes. `@Environment` reads values someone injected into the tree and persists nothing, and `@FocusState` is only for keyboard focus.",
        },
        {
          kind: "write",
          prompt: "Write `SettingsView`: a `Form` with a \"Dark mode\" `Toggle` persisted in `UserDefaults` under the key `darkMode`, and a \"Done\" button that closes the screen using the environment.",
          starter: r`import SwiftUI

struct SettingsView: View {
    // 1. persisted preference
    // 2. action to close the screen

    var body: some View {
        Form {
            // Toggle + "Done" button
        }
    }
}`,
          checks: [
            { pattern: r`@AppStorage\("darkMode"\)`, label: "Persists with `@AppStorage(\"darkMode\")`" },
            { pattern: r`Toggle\(.*isOn:\s*\$darkMode`, label: "The `Toggle` uses `$darkMode`" },
            { pattern: r`@Environment\(\\\.dismiss\)`, label: "Reads `@Environment(\\.dismiss)`" },
            { pattern: r`dismiss\(\)`, label: "Calls `dismiss()` from the button" },
          ],
          warnings: [
            { pattern: r`@State\s+(private\s+)?var\s+darkMode`, label: "With `@State` the preference is lost when the app quits" },
            { pattern: r`presentationMode`, label: "`presentationMode` is deprecated: use `\\.dismiss`" },
          ],
          solution: r`import SwiftUI

struct SettingsView: View {
    @AppStorage("darkMode") private var darkMode = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Toggle("Dark mode", isOn: $darkMode)
            Button("Done") { dismiss() }
        }
    }
}`,
          hint: "`@AppStorage(\"darkMode\") private var darkMode = false` and `@Environment(\\.dismiss) private var dismiss`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "observation",
      title: "Observable models: `@Observable` and `ObservableObject`",
      goal: "Wire a class model into your views with `@Observable` (iOS 17), and recognize the `ObservableObject` equivalent (iOS 13–16) and its classic bugs.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "`@Observable` (iOS 17+)",
          body: [
            "As state grows (a list, loading flags, logic), you move it into a model or ViewModel class. The `@Observable` macro makes every stored property observable, no `@Published` needed.",
            "SwiftUI records **which properties each `body` read** and only re-renders the views that read the property that changed. That's finer-grained than `ObservableObject`, which notified on any change.",
            "Whoever creates it owns it: `@State private var model = Model()`. Child views receive it as a plain parameter (`let model: Model`); they need no wrapper to read it or call its methods.",
          ],
          code: r`import Observation

@Observable
final class CartStore {
    var items: [String] = []
    var isLoading = false

    func add(_ item: String) { items.append(item) }
}

struct CartScreen: View {
    @State private var store = CartStore()   // owner

    var body: some View {
        VStack {
            Text("Items: \(store.items.count)")
            AddButton(store: store)          // borrowed
        }
    }
}

struct AddButton: View {
    let store: CartStore

    var body: some View {
        Button("Add") { store.add("Coffee") }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "With the code above, the user taps \"Add\" three times. What does `CartScreen` show?",
          code: r`// CartScreen:   @State private var store = CartStore()
// AddButton:    let store: CartStore
//               Button("Add") { store.add("Coffee") }
Text("Items: \(store.items.count)")`,
          options: [
            "Items: 3",
            "Items: 0, because `AddButton` needs `@Bindable` to modify the store",
            "It doesn't compile: you can't mutate something declared with `let`",
            "Items: 0, because `AddButton` needs `@ObservedObject`",
          ],
          answer: 0,
          explanation: "`CartStore` is a class: `let store` pins the reference, it doesn't prevent mutating its properties. `AddButton` and `CartScreen` share the same instance. Since `CartScreen` read `store.items` in its `body`, Observation re-renders it when `items` changes. `@Bindable` is only needed to create bindings (`$store.something`).",
        },
        {
          kind: "explain",
          title: "`@Bindable` and sharing through the environment",
          body: [
            "When a child view needs a `Binding` to a model property (say, for a `TextField`), declare it `@Bindable var model: Model` and use `$model.property`.",
            "To avoid threading the model through ten levels of views, inject it with `.environment(store)` and read it wherever you need it with `@Environment(CartStore.self) private var store`. If nothing was injected the app crashes at runtime, so inject it near the root.",
            "A model read via `@Environment` doesn't hand out bindings directly: inside `body` write `@Bindable var store = store` and then use `$store.property`.",
          ],
          code: r`struct ProfileForm: View {
    @Bindable var profile: Profile          // @Observable

    var body: some View {
        TextField("Name", text: $profile.name)
    }
}

// Root
ContentView()
    .environment(store)

// Any descendant
struct CartBadge: View {
    @Environment(CartStore.self) private var store
    var body: some View { Text("\(store.items.count)") }
}`,
        },
        {
          kind: "fill",
          prompt: "`EditTitle` receives an `@Observable` model and needs a binding to `title`. Fill in the wrapper.",
          code: r`struct EditTitle: View {
    ____ var note: Note

    var body: some View {
        TextField("Title", text: $note.title)
    }
}`,
          accept: ["^@Bindable$"],
          explanation: "With `@Observable`, `@Bindable` is what enables `$note.title` syntax to create a `Binding<String>`. Without a wrapper the view still updates when it reads `note.title`, but you can't use `$`.",
          placeholder: "@...",
        },
        {
          kind: "explain",
          title: "Before iOS 17: `ObservableObject`",
          body: [
            "A lot of production code (and any app supporting iOS 16) uses `ObservableObject`: the class conforms to the protocol and marks with `@Published` every property that should re-render the view.",
            "The owner uses `@StateObject` (SwiftUI creates the object once and keeps it). Whoever receives it uses `@ObservedObject` (doesn't control its lifetime). To inject it into the tree: `.environmentObject(vm)` + `@EnvironmentObject`.",
            "The classic bug: `@ObservedObject var vm = VM()` inside the view. Every time the parent recomputes its `body`, the struct is recreated, a brand-new `VM` is created and the state is lost. If the view creates the object, it's `@StateObject`.",
          ],
          code: r`final class ProfileViewModel: ObservableObject {
    @Published var name = ""
}

struct ProfileScreen: View {
    @StateObject private var vm = ProfileViewModel()   // owner
    var body: some View { ProfileHeader(vm: vm) }
}

struct ProfileHeader: View {
    @ObservedObject var vm: ProfileViewModel           // borrowed
    var body: some View { Text(vm.name) }
}`,
        },
        {
          kind: "predict",
          prompt: "The user taps the button three times (it shows \"Value: 3\") and then flips the `Toggle`. What does the button show?",
          code: r`final class CounterVM: ObservableObject {
    @Published var value = 0
}

struct Parent: View {
    @State private var dark = false

    var body: some View {
        VStack {
            Toggle("Dark", isOn: $dark)
            Text(dark ? "Dark mode" : "Light mode")
            CounterView()
        }
    }
}

struct CounterView: View {
    @ObservedObject var vm = CounterVM()

    var body: some View {
        Button("Value: \(vm.value)") { vm.value += 1 }
    }
}`,
          options: [
            "Value: 3",
            "Value: 4",
            "The app crashes accessing a deallocated object",
            "Value: 0",
          ],
          answer: 3,
          explanation: "Flipping `dark` makes `Parent` recompute its `body` and run `CounterView()` again, which creates another `CounterVM()`. `@ObservedObject` doesn't keep the previous instance, so SwiftUI starts observing the new object with `value = 0`. With `@StateObject` (or `@Observable` + `@State`) the counter would stay at 3.",
        },
        {
          kind: "write",
          prompt: "Migrate this code from `ObservableObject` to `@Observable` (iOS 17): the model without `@Published`, the owner with `@State`, and the form with `@Bindable` so it can keep using `$vm.name`.",
          starter: r`final class ProfileViewModel: ObservableObject {
    @Published var name = ""
    @Published var isSaving = false
}

struct ProfileScreen: View {
    @StateObject private var vm = ProfileViewModel()
    var body: some View {
        ProfileForm(vm: vm)
    }
}

struct ProfileForm: View {
    @ObservedObject var vm: ProfileViewModel
    var body: some View {
        TextField("Name", text: $vm.name)
    }
}`,
          checks: [
            { pattern: r`@Observable\s+final\s+class\s+ProfileViewModel`, label: "`@Observable final class ProfileViewModel`" },
            { pattern: r`@State\s+private\s+var\s+vm\s*=\s*ProfileViewModel\(\)`, label: "The owner uses `@State private var vm`" },
            { pattern: r`@Bindable\s+var\s+vm:\s*ProfileViewModel`, label: "The form uses `@Bindable var vm`" },
            { pattern: r`\$vm\.name`, label: "Still uses `$vm.name`" },
          ],
          warnings: [
            { pattern: r`ObservableObject`, label: "With `@Observable` you don't conform to `ObservableObject`" },
            { pattern: r`@Published`, label: "`@Published` is redundant with `@Observable`" },
            { pattern: r`@StateObject|@ObservedObject`, label: "`@StateObject`/`@ObservedObject` are for `ObservableObject`" },
          ],
          solution: r`import Observation

@Observable
final class ProfileViewModel {
    var name = ""
    var isSaving = false
}

struct ProfileScreen: View {
    @State private var vm = ProfileViewModel()
    var body: some View {
        ProfileForm(vm: vm)
    }
}

struct ProfileForm: View {
    @Bindable var vm: ProfileViewModel
    var body: some View {
        TextField("Name", text: $vm.name)
    }
}`,
          hint: "`@StateObject` → `@State`, `@ObservedObject` → `@Bindable` (because you need `$vm.name`).",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "lists-forms",
      title: "Lists and forms",
      goal: "Render collections with stable identity and build forms with search, pull-to-refresh and swipe actions.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "`List`, `ForEach` and identity",
          body: [
            "`List` shows scrolling rows with system styling. `ForEach` builds views from a collection and is used inside `List`, `VStack`, `Form`, etc.",
            "SwiftUI needs to know **which row is which** from one render to the next, so it can animate, keep each row's `@State`, and not mix them up. That's why elements conform to `Identifiable` (they have a stable `id`) or you pass an explicit `id:`.",
            "Avoid identities that shift: `id: \\.offset` (the position) or `id: \\.self` on values that repeat. An `id` from your model (from the API, or a `UUID()` created once) is the right call.",
          ],
          code: r`struct Todo: Identifiable {
    let id = UUID()
    var title: String
    var done = false
}

struct TodoListView: View {
    @State private var todos = [Todo(title: "Buy bread"), Todo(title: "Pay electricity")]

    var body: some View {
        List {
            ForEach($todos) { $todo in
                Toggle(todo.title, isOn: $todo.done)
            }
            .onDelete { offsets in todos.remove(atOffsets: offsets) }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Each `TodoRow` has `@State private var expanded = false`. The user expands the first row (\"Buy bread\") and then deletes it. What happens?",
          code: r`List {
    ForEach(Array(todos.enumerated()), id: \.offset) { index, todo in
        TodoRow(todo: todo)
    }
    .onDelete { todos.remove(atOffsets: $0) }
}`,
          options: [
            "The row is deleted and everything ends up collapsed",
            "You can't delete: `onDelete` doesn't work with `enumerated()`",
            "\"Pay electricity\" becomes the first row and shows up expanded",
            "SwiftUI crashes on duplicate ids",
          ],
          answer: 2,
          explanation: "Identity is the position. After the delete, \"Pay electricity\" moves to position 0, which is the same identity \"Buy bread\" had. SwiftUI thinks it's the same row with new data and keeps its `@State` (`expanded = true`). With `ForEach(todos)` and a stable `id`, the state would go away with the deleted row.",
        },
        {
          kind: "fill",
          prompt: "Fill in the protocol so you can write `ForEach(todos)` without `id:`.",
          code: r`struct Todo: ____ {
    let id = UUID()
    var title: String
}`,
          accept: ["^Identifiable$", r`^Identifiable\s*,\s*Hashable$`, r`^Hashable\s*,\s*Identifiable$`],
          explanation: "`Identifiable` requires an `id` property whose type is `Hashable`. `ForEach` and `List` use it as each row's identity.",
          placeholder: "Protocol",
        },
        {
          kind: "explain",
          title: "Forms: `Form`, `TextField`, `Picker`, `Toggle`",
          body: [
            "`Form` groups controls with the iOS Settings look. Each control takes a `Binding` to your state: `TextField(\"Name\", text: $name)`, `Toggle(\"Notifications\", isOn: $notify)`, `Stepper(value: $count)`.",
            "`Picker` needs each option's `tag` to have **exactly the same type** as the selection. With a `CaseIterable` enum + `ForEach`, the view uses the element's `id`; if you add `.tag` by hand, make sure the type matches.",
            "`Section` splits the form into blocks and takes a header and footer.",
          ],
          code: r`enum Plan: String, CaseIterable, Identifiable {
    case free, pro
    var id: Self { self }
}

struct SignupForm: View {
    @State private var name = ""
    @State private var plan: Plan = .free
    @State private var newsletter = true

    var body: some View {
        Form {
            Section("Account") {
                TextField("Name", text: $name)
                Picker("Plan", selection: $plan) {
                    ForEach(Plan.allCases) { plan in
                        Text(plan.rawValue.capitalized).tag(plan)
                    }
                }
            }
            Section {
                Toggle("Get product news", isOn: $newsletter)
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The user picks \"Chocolate\". What happens?",
          code: r`enum Flavor { case vanilla, chocolate }

struct FlavorPicker: View {
    @State private var flavor = "vanilla"

    var body: some View {
        Picker("Flavor", selection: $flavor) {
            Text("Vanilla").tag(Flavor.vanilla)
            Text("Chocolate").tag(Flavor.chocolate)
        }
    }
}`,
          options: [
            "The selection doesn't change: the `tag`s are `Flavor` and the selection is a `String`",
            "`flavor` becomes `\"chocolate\"`",
            "It doesn't compile because `Flavor` isn't a `String`",
            "`flavor` becomes `\"Chocolate\"` (the option's label)",
          ],
          answer: 0,
          explanation: "It compiles, but SwiftUI matches each `tag` against the selection's type (`String`). No `tag` is a `String`, so no option matches and picking doesn't update `flavor` (the console logs an invalid-selection warning). Tags must be the same type as the binding: use `@State private var flavor: Flavor = .vanilla`.",
        },
        {
          kind: "explain",
          title: "Search, refresh and swipe actions",
          body: [
            "`.searchable(text: $query)` adds the search bar (inside a `NavigationStack` it lives in the navigation bar). You do the filtering with a computed property; SwiftUI only hands you the text.",
            "`.refreshable { await store.reload() }` enables pull-to-refresh: the spinner stays visible until the `async` function returns.",
            "`.swipeActions` adds buttons when the user swipes a row (trailing edge by default; `edge: .leading` for the other side). `role: .destructive` paints the button red. A full swipe triggers the first button (`allowsFullSwipe` defaults to `true`).",
          ],
          code: r`List {
    ForEach(filtered) { mail in
        Text(mail.subject)
            .swipeActions {
                Button("Delete", role: .destructive) { store.delete(mail) }
            }
            .swipeActions(edge: .leading) {
                Button("Read") { store.markRead(mail) }
                    .tint(.blue)
            }
    }
}
.searchable(text: $query)
.refreshable { await store.reload() }`,
        },
        {
          kind: "fill",
          prompt: "Fill in the role so the system treats the button as a deleting action (and paints it red).",
          code: r`.swipeActions {
    Button("Delete", role: ____) {
        store.delete(mail)
    }
}`,
          accept: [r`^\.destructive$`],
          explanation: "`ButtonRole.destructive` tells the system the action deletes something: in swipe actions the button turns red. Since it's the first button, a full swipe also triggers it.",
          placeholder: ".role",
        },
        {
          kind: "write",
          prompt: "Finish `ContactsView`: the list shows `filtered` (all contacts when `query` is empty; otherwise the ones containing the text, case-insensitive), with a search bar and a swipe to delete the contact.",
          starter: r`struct Contact: Identifiable {
    let id = UUID()
    var name: String
}

struct ContactsView: View {
    @State private var contacts = [Contact(name: "Ana"), Contact(name: "Bruno"), Contact(name: "Carla")]
    @State private var query = ""

    var filtered: [Contact] {
        contacts // TODO: filter
    }

    var body: some View {
        NavigationStack {
            List {
                // rows
            }
            .navigationTitle("Contacts")
        }
    }
}`,
          checks: [
            { pattern: r`\.filter\s*\{`, label: "Filters with `.filter`" },
            { pattern: r`localizedCaseInsensitiveContains|lowercased\(\)`, label: "Case-insensitive" },
            { pattern: r`(ForEach|List)\(filtered\)`, label: "Iterates `filtered` using `Contact`'s identity" },
            { pattern: r`\.searchable\(text:\s*\$query\)`, label: "`.searchable(text: $query)`" },
            { pattern: r`\.swipeActions`, label: "Adds `.swipeActions`" },
            { pattern: r`role:\s*\.destructive`, label: "Button with `role: .destructive`" },
          ],
          warnings: [
            { pattern: r`id:\s*\\\.(self|offset)`, label: "`Contact` is already `Identifiable`: no `id:` needed, and `\\.self`/`\\.offset` aren't stable" },
          ],
          solution: r`struct ContactsView: View {
    @State private var contacts = [Contact(name: "Ana"), Contact(name: "Bruno"), Contact(name: "Carla")]
    @State private var query = ""

    var filtered: [Contact] {
        guard !query.isEmpty else { return contacts }
        return contacts.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(filtered) { contact in
                    Text(contact.name)
                        .swipeActions {
                            Button("Delete", role: .destructive) {
                                contacts.removeAll { $0.id == contact.id }
                            }
                        }
                }
            }
            .navigationTitle("Contacts")
            .searchable(text: $query)
        }
    }
}`,
          hint: "Delete by `id` from the source array (`contacts.removeAll { $0.id == contact.id }`), not by an index into `filtered`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "navigation-lifecycle",
      title: "Navigation and lifecycle",
      goal: "Navigate with `NavigationStack` and a `path`, present sheets and alerts, and load data with `.task` / `.task(id:)` without zombie work.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "`NavigationStack` with a `path`",
          body: [
            "`NavigationStack` (iOS 16+) replaces `NavigationView`. Navigation is **value-based**: `NavigationLink(value: x)` pushes a value and `.navigationDestination(for: Type.self)` decides which view to show for that type.",
            "Pass `path: $path` and the stack mirrors that array: `append` pushes, `removeLast()` goes back one screen and `removeAll()` pops to root. That's how you navigate from code (deep links, after saving, etc.).",
            "For mixed types in the same stack, use `NavigationPath` instead of a typed array.",
          ],
          code: r`struct OrdersView: View {
    @State private var path: [Order.ID] = []
    let orders: [Order]

    var body: some View {
        NavigationStack(path: $path) {
            List(orders) { order in
                NavigationLink(order.title, value: order.id)
            }
            .navigationTitle("Orders")
            .navigationDestination(for: Order.ID.self) { id in
                OrderDetailView(orderID: id, onDone: { path.removeAll() })
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The app launches with this `path`. The user taps \"back\" once. What do they see?",
          code: r`struct DeepLinkDemo: View {
    @State private var path: [Int] = [1, 2, 3]

    var body: some View {
        NavigationStack(path: $path) {
            Text("Home")
                .navigationDestination(for: Int.self) { n in
                    Text("Detail \(n)")
                }
        }
    }
}`,
          options: ["Home", "Detail 1", "Detail 2", "Detail 3"],
          answer: 2,
          explanation: "The stack starts with three screens pushed on top of the root: Detail 1, 2 and 3 (on top). Going back does `removeLast()` on `path`, which becomes `[1, 2]`, so the user sees \"Detail 2\".",
        },
        {
          kind: "fill",
          prompt: "Fill in the type to register the destination for `NavigationLink(value:)` links that push an `Int`.",
          code: r`.navigationDestination(for: ____) { n in
    Text("Detail \(n)")
}`,
          accept: [r`^Int\.self$`],
          explanation: "`navigationDestination(for:)` takes the metatype (`Int.self`). Every time a value of that type is pushed, SwiftUI calls the closure with it.",
          placeholder: "Type.self",
        },
        {
          kind: "explain",
          title: "Sheets and alerts",
          body: [
            "`.sheet(isPresented: $showing)` presents a modal view while the `Bool` is `true`. `.sheet(item: $selected)` presents it while the optional has a value and hands you that value (the type must be `Identifiable`).",
            "When the user dismisses the sheet with a swipe, SwiftUI sets the binding back to `false` or `nil` for you. From inside the sheet you close it with `@Environment(\\.dismiss)`.",
            "`.alert` follows the same pattern: title, `isPresented`, buttons and an optional `message`.",
          ],
          code: r`struct ProductsView: View {
    @State private var selected: Product?
    @State private var showDeleteAlert = false
    let products: [Product]

    var body: some View {
        List(products) { product in
            Button(product.name) { selected = product }
        }
        .sheet(item: $selected) { product in
            ProductDetail(product: product)
        }
        .alert("Delete everything?", isPresented: $showDeleteAlert) {
            Button("Delete", role: .destructive) { /* ... */ }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This can't be undone.")
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The user opens a product's sheet and swipes it down to close it. What's the value of `selected`?",
          code: r`@State private var selected: Product?

List(products) { product in
    Button(product.name) { selected = product }
}
.sheet(item: $selected) { product in
    ProductDetail(product: product)
}`,
          options: [
            "Still the chosen product until you set it to `nil` yourself",
            "`nil`: SwiftUI clears it when the sheet closes",
            "It points to the first product in the list",
            "A sheet using `item:` can't be swiped closed",
          ],
          answer: 1,
          explanation: "The sheet is tied to the binding: it's shown while `selected` isn't `nil`. When it's swiped away, SwiftUI writes `nil` into `selected` so the state matches what's on screen. Otherwise the sheet would pop right back up.",
        },
        {
          kind: "explain",
          title: "`.task` vs `onAppear`, and `.task(id:)`",
          body: [
            "`.onAppear` is synchronous: to call `async` code you'd have to spin up a `Task { }` by hand, and that task keeps running even after the user leaves the screen.",
            "`.task { }` starts an `async` task when the view appears and **cancels it automatically** when it disappears. It's the natural place to load a screen's data.",
            "`.task(id: value)` also cancels the in-flight task and starts a new one every time `value` changes. Add a `Task.sleep` and you've got a three-line search debounce. Heads-up: `Task.sleep` throws on cancellation; if you use `try?`, check `Task.isCancelled` afterwards.",
          ],
          code: r`struct UserView: View {
    let api: UserAPI
    let userID: User.ID
    @State private var user: User?

    var body: some View {
        Group {
            if let user {
                Text(user.name)
            } else {
                ProgressView()
            }
        }
        .task(id: userID) {
            user = try? await api.user(id: userID)
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "The user types \"s\", \"sw\" and \"swi\" within 300 ms. How many times is `api.search` called?",
          code: r`.searchable(text: $query)
.task(id: query) {
    try? await Task.sleep(for: .milliseconds(300))
    guard !Task.isCancelled else { return }
    results = await api.search(query)
}`,
          options: [
            "Three times, once per letter",
            "Never: `.task` only runs when the view appears",
            "Twice: the first and the last",
            "Once, with \"swi\"",
          ],
          answer: 3,
          explanation: "Each change to `query` cancels the previous task and starts a new one. The \"s\" and \"sw\" tasks are cancelled during the `sleep`: `Task.sleep` throws, `try?` swallows it, and `guard !Task.isCancelled` bails out before hitting the API. Only the \"swi\" task gets to search.",
        },
        {
          kind: "write",
          prompt: "Add result loading to `SearchView`: every time `query` changes, wait 300 ms (debounce), bail out if the task was cancelled, and assign `results` from `await api.search(query)`. No manual `Task { }`.",
          starter: r`struct SearchView: View {
    let api: ProductAPI          // func search(_ q: String) async -> [Product]
    @State private var query = ""
    @State private var results: [Product] = []

    var body: some View {
        NavigationStack {
            List(results) { Text($0.name) }
                .searchable(text: $query)
                // load results here
        }
    }
}`,
          checks: [
            { pattern: r`\.task\(id:\s*query\)`, label: "Uses `.task(id: query)`" },
            { pattern: r`Task\.sleep\(`, label: "Debounces with `Task.sleep`" },
            { pattern: r`Task\.isCancelled|catch`, label: "Bails out if the task was cancelled" },
            { pattern: r`results\s*=\s*await\s+api\.search\(query\)`, label: "Assigns `results = await api.search(query)`" },
          ],
          warnings: [
            { pattern: r`\.onAppear`, label: "`.onAppear` doesn't run again when `query` changes" },
            { pattern: r`Task\s*\{`, label: "A manual `Task { }` doesn't cancel itself" },
            { pattern: r`\.onChange`, label: "`.onChange` + `Task` doesn't cancel the previous search: `.task(id:)` does" },
          ],
          solution: r`struct SearchView: View {
    let api: ProductAPI
    @State private var query = ""
    @State private var results: [Product] = []

    var body: some View {
        NavigationStack {
            List(results) { Text($0.name) }
                .searchable(text: $query)
                .task(id: query) {
                    try? await Task.sleep(for: .milliseconds(300))
                    guard !Task.isCancelled else { return }
                    results = await api.search(query)
                }
        }
    }
}`,
          hint: "`.task(id: query) { try? await Task.sleep(for: .milliseconds(300)); guard !Task.isCancelled else { return }; ... }`",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: recipes with favorites",
      goal: "Combine views, state, lists, navigation and a shared `@Observable` model in a small real-world app.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "You've picked up the first ticket for a recipes app. Product wants: a list of recipes, a detail screen with a favorite (heart) button, and the heart also showing on the list row. A favorites tab comes later.",
            "Design decision: a single `@Observable` `RecipeStore` is the source of truth. It holds the recipes and a `Set` of favorite ids; the favorites list is **derived**, not duplicated.",
            "The root view creates the store with `@State` and injects it into the environment; the detail reads it with `@Environment`. Navigation is value-based with `navigationDestination(for: Recipe.self)`.",
          ],
          code: r`struct Recipe: Identifiable, Hashable {
    let id: UUID
    var title: String
    var minutes: Int
}

// View tree
// RecipeListView        @State store + .environment(store)
//   └─ NavigationStack
//        ├─ List → NavigationLink(value: recipe)
//        └─ RecipeDetailView   @Environment(RecipeStore.self)`,
        },
        {
          kind: "write",
          prompt: "Write `RecipeStore`: `@Observable`, with `recipes`, a `Set` of favorite ids, `isFavorite(_:)`, `toggleFavorite(_:)` (adds or removes) and a computed `favorites: [Recipe]` derived from the set.",
          starter: r`final class RecipeStore {
    var recipes: [Recipe] = []
}`,
          checks: [
            { pattern: r`@Observable\s+final\s+class\s+RecipeStore`, label: "`@Observable final class RecipeStore`" },
            { pattern: r`Set<(Recipe\.ID|UUID)>`, label: "Stores favorites in a `Set` of ids" },
            { pattern: r`func\s+isFavorite\(`, label: "Has `isFavorite(_:)`" },
            { pattern: r`func\s+toggleFavorite\(`, label: "Has `toggleFavorite(_:)`" },
            { pattern: r`\.insert\(`, label: "Adds with `insert`" },
            { pattern: r`\.remove\(`, label: "Removes with `remove`" },
            { pattern: r`var\s+favorites:\s*\[Recipe\]\s*\{`, label: "`favorites` is a computed property" },
          ],
          warnings: [
            { pattern: r`ObservableObject|@Published`, label: "Use `@Observable`, not `ObservableObject`/`@Published`" },
            { pattern: r`var\s+favorites:\s*\[Recipe\]\s*=`, label: "Storing `favorites` separately duplicates data: derive it from the set" },
          ],
          solution: r`import Observation

@Observable
final class RecipeStore {
    var recipes: [Recipe] = []
    var favoriteIDs: Set<Recipe.ID> = []

    func isFavorite(_ recipe: Recipe) -> Bool {
        favoriteIDs.contains(recipe.id)
    }

    func toggleFavorite(_ recipe: Recipe) {
        if favoriteIDs.contains(recipe.id) {
            favoriteIDs.remove(recipe.id)
        } else {
            favoriteIDs.insert(recipe.id)
        }
    }

    var favorites: [Recipe] {
        recipes.filter { favoriteIDs.contains($0.id) }
    }
}`,
          hint: "`var favoriteIDs: Set<Recipe.ID> = []` and `var favorites: [Recipe] { recipes.filter { ... } }`.",
        },
        {
          kind: "write",
          prompt: "Write `RecipeListView`: it creates and owns the store, shows the recipes in a `NavigationStack` with `NavigationLink(value:)`, a filled heart on the row when it's a favorite, the `Recipe` destination pointing to `RecipeDetailView(recipe:)`, and injects the store into the environment.",
          starter: r`struct RecipeListView: View {
    var body: some View {
        Text("Recipes")
    }
}`,
          checks: [
            { pattern: r`@State\s+private\s+var\s+store\s*=\s*RecipeStore\(\)`, label: "`@State private var store = RecipeStore()`" },
            { pattern: r`NavigationStack`, label: "Uses `NavigationStack`" },
            { pattern: r`NavigationLink\(value:`, label: "Value-based `NavigationLink(value:)`" },
            { pattern: r`isFavorite\(recipe\)`, label: "Checks `store.isFavorite(recipe)` on the row" },
            { pattern: r`\.navigationDestination\(for:\s*Recipe\.self\)`, label: "`.navigationDestination(for: Recipe.self)`" },
            { pattern: r`\.environment\(store\)`, label: "Injects with `.environment(store)`" },
          ],
          warnings: [
            { pattern: r`@StateObject|@ObservedObject|@EnvironmentObject`, label: "Those are `ObservableObject` wrappers" },
            { pattern: r`NavigationView`, label: "`NavigationView` is deprecated: use `NavigationStack`" },
          ],
          solution: r`struct RecipeListView: View {
    @State private var store = RecipeStore()

    var body: some View {
        NavigationStack {
            List(store.recipes) { recipe in
                NavigationLink(value: recipe) {
                    HStack {
                        Text(recipe.title)
                        Spacer()
                        if store.isFavorite(recipe) {
                            Image(systemName: "heart.fill")
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
            .navigationTitle("Recipes")
            .navigationDestination(for: Recipe.self) { recipe in
                RecipeDetailView(recipe: recipe)
            }
        }
        .environment(store)
    }
}`,
          hint: "Put `.environment(store)` on the `NavigationStack` so pushed screens can see it too.",
        },
        {
          kind: "write",
          prompt: "Write `RecipeDetailView(recipe:)`: it reads the store from the environment, shows the title and minutes, and a button that toggles the favorite with a `heart` / `heart.fill` icon depending on the state.",
          starter: r`struct RecipeDetailView: View {
    let recipe: Recipe

    var body: some View {
        Text(recipe.title)
    }
}`,
          checks: [
            { pattern: r`@Environment\(RecipeStore\.self\)`, label: "`@Environment(RecipeStore.self)`" },
            { pattern: r`store\.toggleFavorite\(recipe\)`, label: "The button calls `store.toggleFavorite(recipe)`" },
            { pattern: r`store\.isFavorite\(recipe\)`, label: "Reads `store.isFavorite(recipe)`" },
            { pattern: r`"heart\.fill"`, label: "Uses the `heart.fill` SF Symbol" },
            { pattern: r`"heart"`, label: "And `heart` when it's not a favorite" },
          ],
          warnings: [
            { pattern: r`RecipeStore\(\)`, label: "Don't create another store: use the one from the environment" },
            { pattern: r`@EnvironmentObject`, label: "With `@Observable` you use `@Environment(Type.self)`" },
          ],
          solution: r`struct RecipeDetailView: View {
    @Environment(RecipeStore.self) private var store
    let recipe: Recipe

    var body: some View {
        VStack(spacing: 16) {
            Text(recipe.title)
                .font(.title)
            Text("\(recipe.minutes) min")
                .foregroundStyle(.secondary)
            Button {
                store.toggleFavorite(recipe)
            } label: {
                Image(systemName: store.isFavorite(recipe) ? "heart.fill" : "heart")
                    .font(.largeTitle)
                    .foregroundStyle(.red)
            }
        }
        .padding()
    }
}`,
          hint: "`Image(systemName: store.isFavorite(recipe) ? \"heart.fill\" : \"heart\")`.",
        },
        {
          kind: "predict",
          prompt: "A teammate adds the favorites tab like this. The user favorites two recipes from the detail screen and opens this tab. What do they see?",
          code: r`struct FavoritesView: View {
    @State private var store = RecipeStore()

    var body: some View {
        List(store.favorites) { recipe in
            Text(recipe.title)
        }
    }
}`,
          options: [
            "The two favorite recipes",
            "An empty list",
            "The app crashes because `.environment(store)` is missing",
            "All the recipes",
          ],
          answer: 1,
          explanation: "`@State private var store = RecipeStore()` creates **another** store, empty and separate from the one `RecipeListView` uses. There are two sources of truth and this one has no recipes or favorites. The fix: `@Environment(RecipeStore.self) private var store`, injected from the root.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-view-body",
      front: "What does a type need to be a SwiftUI view?",
      back: "Conform to `View` and have `var body: some View`. It's usually a `struct`; `body` describes the UI for the current state and SwiftUI recomputes it when state changes.",
    },
    {
      id: "fc-some-view",
      front: "What does `some View` mean?",
      back: "An opaque type: `body` returns one concrete, fixed view type the compiler knows, without you having to spell it out.",
    },
    {
      id: "fc-modifier-order",
      front: "Why isn't `.padding().background(.red)` the same as `.background(.red).padding()`?",
      back: "Each modifier wraps the previous view. In the first, the background paints the already-enlarged view (covers the padding); in the second, it paints only behind the content and the padding stays transparent outside.",
      code: r`Text("Hello").padding().background(.red)   // red includes padding
Text("Hello").background(.red).padding()   // red only behind the text`,
    },
    {
      id: "fc-spacer",
      front: "What does `Spacer()` do inside an `HStack`?",
      back: "Takes all the free horizontal space and pushes its neighbors toward the edges.",
    },
    {
      id: "fc-sf-symbols",
      front: "How do you show an SF Symbol and change its size and color?",
      back: "`Image(systemName: \"star.fill\")`. It behaves like text: `.font(.title)` for size and `.foregroundStyle(.yellow)` for color.",
    },
    {
      id: "fc-state",
      front: "When do you use `@State`?",
      back: "For simple state the view owns (a counter, a field's text, whether a sheet is open). Always `private`. SwiftUI stores it outside the struct and re-renders when it changes.",
    },
    {
      id: "fc-binding",
      front: "What's a `@Binding` and how do you get one?",
      back: "A read/write reference to state that lives in another view. You get it with `$` on the owner's `@State`: `Child(isOn: $isOn)`.",
    },
    {
      id: "fc-single-source",
      front: "What happens if a child view stores a value from its parent in its own `@State`?",
      back: "You get a second source of truth: the child changes its copy and the parent never finds out. Use `@Binding`.",
    },
    {
      id: "fc-env-storage-focus",
      front: "`@Environment`, `@AppStorage`, `@FocusState`: what is each one for?",
      back: "`@Environment`: read values from the environment (`\\.dismiss`, `\\.colorScheme`, an injected model). `@AppStorage`: a preference persisted in `UserDefaults`. `@FocusState`: which field has the keyboard.",
    },
    {
      id: "fc-observable",
      front: "With `@Observable` (iOS 17): which wrapper does the owner use, a read-only child, and a child that needs bindings?",
      back: "Owner: `@State private var model = Model()`. Read-only: `let model: Model`. Needs `$model.prop`: `@Bindable var model: Model`. Shared: `.environment(model)` + `@Environment(Model.self)`.",
    },
    {
      id: "fc-stateobject",
      front: "`@StateObject` vs `@ObservedObject`",
      back: "Both are for `ObservableObject` (iOS 13–16). `@StateObject`: the view creates the object and SwiftUI keeps it across renders. `@ObservedObject`: it's passed in; if you create it inline it gets recreated and state is lost.",
    },
    {
      id: "fc-identity",
      front: "Why avoid `id: \\.offset`, or `id: \\.self` with repeated values, in `ForEach`?",
      back: "Identity has to be stable. With positions or duplicates, inserts/deletes make SwiftUI mix up rows: wrong animations and `@State` landing on the wrong row. Use an `Identifiable` model with its own `id`.",
    },
    {
      id: "fc-nav-path",
      front: "How do you pop to the root of a `NavigationStack(path: $path)` from code?",
      back: "`path.removeAll()` (with `NavigationPath`: `path = NavigationPath()`). `removeLast()` goes back one screen.",
    },
    {
      id: "fc-task",
      front: "`.task` vs `.onAppear`",
      back: "`.task` runs `async` code when the view appears and cancels it automatically when it disappears. `.onAppear` is synchronous; a `Task { }` started there keeps running after you leave.",
    },
    {
      id: "fc-task-id",
      front: "What does `.task(id: query)` do?",
      back: "Starts the task on appear and, every time `query` changes, cancels the previous one and starts a new one. With a `Task.sleep` inside, it works as a debounce.",
      code: r`.task(id: query) {
    try? await Task.sleep(for: .milliseconds(300))
    guard !Task.isCancelled else { return }
    results = await api.search(query)
}`,
    },
  ],

  exam: [
    {
      id: "ex-frame-background",
      question: "A designer asks for a 200×100 blue rectangle with the text centered. This code only shows a small blue box around the text. Why?",
      code: r`Text("Pay")
    .background(.blue)
    .frame(width: 200, height: 100)`,
      options: [
        "`.frame` doesn't work on `Text`",
        "The background was applied before the `frame`: it paints only the text's size; the frame adds transparent space around it",
        "`.resizable()` is missing",
        "`.background` needs `Color.blue`, not `.blue`",
      ],
      answer: 1,
      explanation: "Modifiers apply in order. `.background` paints behind the `Text` (tight fit), then `.frame` creates a transparent 200×100 container that centers it. Swap them (`.frame(...)` then `.background(.blue)`) and the blue fills the 200×100.",
    },
    {
      id: "ex-state-owner",
      question: "On a login screen, how do you declare the email field's text, used only by that view?",
      options: [
        "`@Binding var email: String`",
        "`@ObservedObject var email = \"\"`",
        "`@State private var email = \"\"`",
        "`var email = \"\"` (a plain property is enough)",
      ],
      answer: 2,
      explanation: "It's a simple value owned by the view: `@State private`. `@Binding` would be for when another view owns it. A plain `var` can't be mutated from `body` and doesn't survive re-renders, and `@ObservedObject` is only for `ObservableObject` classes.",
    },
    {
      id: "ex-binding",
      question: "A `FilterChip` view has to toggle a filter whose state lives in the parent screen. What does `FilterChip` take?",
      options: [
        "`@Binding var isOn: Bool`, and the parent passes `$isOn`",
        "`@State var isOn: Bool`, and the parent passes `isOn`",
        "`let isOn: Bool`, and the parent passes `isOn`",
        "`@AppStorage(\"isOn\") var isOn = false`",
      ],
      answer: 0,
      explanation: "The data has a single owner (the parent) and the child needs to write it: `@Binding`. With `@State` the child would get its own copy and the parent would never know; with `let` it couldn't change it; `@AppStorage` would persist it globally, which isn't what was asked.",
    },
    {
      id: "ex-observable-owner",
      question: "Your app targets iOS 17+. `FeedScreen` creates its `FeedViewModel`, marked `@Observable`. How does it declare it?",
      options: [
        "`@StateObject private var vm = FeedViewModel()`",
        "`@ObservedObject var vm = FeedViewModel()`",
        "`let vm = FeedViewModel()`",
        "`@State private var vm = FeedViewModel()`",
      ],
      answer: 3,
      explanation: "With `@Observable` the owner uses `@State`, which keeps the instance across renders. `@StateObject`/`@ObservedObject` are for `ObservableObject`. With `let`, a new `FeedViewModel` would be created every time the struct is rebuilt.",
    },
    {
      id: "ex-legacy-owner",
      question: "The app still supports iOS 16. `SettingsScreen` creates its `SettingsViewModel: ObservableObject`. Which wrapper does it use?",
      options: [
        "`@ObservedObject`",
        "`@EnvironmentObject`",
        "`@StateObject`",
        "`@Bindable`",
      ],
      answer: 2,
      explanation: "Before Observation, the owner of an `ObservableObject` uses `@StateObject` so SwiftUI creates it once and keeps it. `@ObservedObject` is for objects passed in; `@EnvironmentObject` reads an injected one; `@Bindable` is iOS 17 and works with `@Observable`.",
    },
    {
      id: "ex-reset-bug",
      question: "QA reports: \"the cart badge resets to 0 every time I switch the theme\". What's the most likely cause?",
      code: r`struct CartBadge: View {
    @ObservedObject var vm = CartBadgeViewModel()
    var body: some View { Text("\(vm.count)") }
}`,
      options: [
        "`CartBadgeViewModel` isn't `Sendable`",
        "`@ObservedObject` with the object created inline: when the parent re-renders, a new ViewModel is created",
        "`count` is missing `@MainActor`",
        "`Text` doesn't update with string interpolation",
      ],
      answer: 1,
      explanation: "Switching the theme makes the parent recompute its `body` and rebuild `CartBadge`, which runs `CartBadgeViewModel()` again. `@ObservedObject` doesn't hold on to the previous instance. Fix: `@StateObject` (or `@Observable` + `@State`), or receive the ViewModel from a stable owner.",
    },
    {
      id: "ex-task-load",
      question: "The profile screen loads data with `async/await` when it appears. If the user goes back before it finishes, the load must be cancelled. What do you use?",
      options: [
        "`.task { await vm.load() }`",
        "`.onAppear { Task { await vm.load() } }`",
        "`init() { Task { await vm.load() } }`",
        "`.onAppear { DispatchQueue.main.async { vm.load() } }`",
      ],
      answer: 0,
      explanation: "`.task` ties the work to the view's lifecycle and cancels it when the view disappears. A `Task { }` created in `onAppear` or `init` isn't cancelled automatically (and a view's `init` can run many times). `DispatchQueue` isn't even `async/await`.",
    },
    {
      id: "ex-task-id",
      question: "A detail view receives `productID`, and on iPad the list and detail are on screen together: picking another product doesn't make the detail view disappear. How do you make it reload?",
      options: [
        "`.onAppear { Task { await load() } }`",
        "`.task(id: productID) { await load() }`",
        "`.task { await load() }`",
        "`.refreshable { await load() }`",
      ],
      answer: 1,
      explanation: "If the view never disappears, neither `.task` nor `.onAppear` runs again. `.task(id: productID)` cancels the previous load and starts a new one every time the id changes. `.refreshable` is only for pull-to-refresh.",
    },
    {
      id: "ex-foreach-id",
      question: "A list of names uses `ForEach(names, id: \\.self)`. When two people are named \"Ana\", rows animate weirdly and one shows the other's data. What's the right fix?",
      options: [
        "Use `id: \\.offset` with `enumerated()`",
        "Sort `names` before displaying them",
        "Wrap the `ForEach` in a `LazyVStack`",
        "Move to an `Identifiable` model with its own stable `id` (e.g. the backend id)",
      ],
      answer: 3,
      explanation: "`id: \\.self` uses the value as identity: two \"Ana\"s share the same id and SwiftUI can't tell them apart. The position (`\\.offset`) isn't stable across inserts and deletes either. Identity has to come from the data: an `Identifiable` with a unique id.",
    },
    {
      id: "ex-pop-root",
      question: "After a three-screen checkout you want to go back to the product list. The stack is `NavigationStack(path: $path)` with `path: [Route]`. What do you do?",
      options: [
        "`path.removeLast()`",
        "Call `dismiss()` three times",
        "`path.removeAll()`",
        "Create a new `NavigationStack`",
      ],
      answer: 2,
      explanation: "The stack mirrors `path`: emptying it with `removeAll()` leaves only the root. `removeLast()` goes back a single screen, and calling `dismiss()` several times in a row isn't reliable.",
    },
    {
      id: "ex-appstorage",
      question: "Which piece of data should you **not** store with `@AppStorage`?",
      options: [
        "The user's access token",
        "Whether the user prefers grid or list layout",
        "The last filter chosen on the search screen",
        "Whether onboarding has already been shown",
      ],
      answer: 0,
      explanation: "`@AppStorage` writes to `UserDefaults`, an unencrypted plist. It's for small, non-sensitive preferences. Tokens, passwords and secrets go in the Keychain.",
    },
    {
      id: "ex-environment-store",
      question: "Several deeply nested screens need the same `SessionStore` (`@Observable`) created at the root. What's the idiomatic way in iOS 17?",
      options: [
        "Each screen creates its own `@State private var session = SessionStore()`",
        "`.environmentObject(session)` at the root and `@EnvironmentObject` in the screens",
        "A global `SessionStore.shared` singleton read with `let`",
        "`.environment(session)` at the root and `@Environment(SessionStore.self) private var session` where it's used",
      ],
      answer: 3,
      explanation: "With Observation, the model is injected with `.environment(_:)` and read with `@Environment(Type.self)`. Creating one per screen breaks the single source of truth. `.environmentObject` is the `ObservableObject` version, and a singleton makes tests and previews harder.",
    },
  ],
};

export default content;
