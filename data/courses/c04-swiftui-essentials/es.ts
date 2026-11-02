import type { CourseContent } from "../types";

// String.raw: el código Swift y las regex se escriben tal cual, sin doble escape.
const r = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "views-modifiers",
      title: "Vistas y modificadores",
      goal: "Armar una pantalla con stacks, `Spacer`, `Image` y modificadores, entendiendo por qué el orden de los modificadores cambia el resultado.",
      minutes: 14,
      steps: [
        {
          kind: "explain",
          title: "Una vista es un struct con `body`",
          body: [
            "En SwiftUI una pantalla es un `struct` que conforma `View` y tiene una sola propiedad obligatoria: `var body: some View`. `body` describe **qué** se ve para el estado actual; SwiftUI decide cuándo volver a calcularlo y cómo actualizar la pantalla.",
            "`some View` es un tipo opaco: le decís al compilador \"devuelvo una vista concreta, no hace falta que escribas cuál\". Por eso podés combinar `VStack`, `Text` y modificadores sin escribir tipos gigantes.",
            "Los tres stacks básicos: `VStack` (vertical), `HStack` (horizontal) y `ZStack` (uno encima de otro). `Spacer()` ocupa todo el espacio libre del eje del stack y empuja a los vecinos hacia los bordes.",
          ],
          code: r`import SwiftUI

struct WelcomeView: View {
    var body: some View {
        VStack(spacing: 8) {
            Text("Hola")
                .font(.largeTitle)
            Text("Bienvenido a la app")
                .foregroundStyle(.secondary)
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "La vista ocupa toda la pantalla del iPhone. ¿Dónde aparecen `A` y `B`?",
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
            "Los dos juntos en el centro de la pantalla",
            "`A` en el centro y `B` abajo",
            "Los dos arriba, uno debajo del otro",
            "`A` arriba de todo y `B` abajo de todo",
          ],
          answer: 3,
          explanation: "Un `VStack` con un `Spacer()` se estira para ocupar toda la altura disponible. El `Spacer` se queda con todo el espacio vertical libre entre los dos textos, así que `A` queda pegado arriba y `B` pegado abajo. Sin el `Spacer`, el stack mediría lo justo y quedaría centrado.",
        },
        {
          kind: "explain",
          title: "El orden de los modificadores importa",
          body: [
            "Cada modificador **envuelve** la vista anterior y devuelve una vista nueva. `.padding()` crea una vista más grande con espacio alrededor; `.background(...)` pinta detrás de la vista que recibe, con el tamaño de esa vista.",
            "Entonces `.padding().background(.yellow)` pinta el fondo sobre la vista ya agrandada (el amarillo incluye el padding), mientras que `.background(.yellow).padding()` pinta justo detrás del texto y después agrega espacio transparente alrededor.",
            "Regla práctica: leé los modificadores de arriba hacia abajo como capas que se van agregando por fuera. Lo mismo pasa con `.frame`, `.border` y `.clipShape`.",
          ],
          code: r`Text("Hola")
    .padding()              // 1. agranda la vista
    .background(.yellow)    // 2. pinta detrás de la vista agrandada
    .clipShape(.rect(cornerRadius: 8))  // 3. recorta todo lo anterior`,
        },
        {
          kind: "predict",
          prompt: "¿En cuál de las dos el fondo amarillo cubre también el espacio del padding?",
          code: r`// Versión 1
Text("Hola")
    .padding()
    .background(.yellow)

// Versión 2
Text("Hola")
    .background(.yellow)
    .padding()`,
          options: [
            "Solo en la versión 1",
            "Solo en la versión 2",
            "En las dos: el orden de los modificadores no cambia nada",
            "En ninguna: `.background` siempre ignora el padding",
          ],
          answer: 0,
          explanation: "En la versión 1, `.padding()` primero agranda la vista y `.background` pinta detrás de esa vista agrandada: el amarillo cubre texto + padding. En la versión 2, `.background` pinta detrás del texto solo (tamaño justo) y el padding se agrega después, por fuera, transparente.",
        },
        {
          kind: "explain",
          title: "Imágenes, SF Symbols y `#Preview`",
          body: [
            "`Image(\"logo\")` carga una imagen del Asset Catalog. `Image(systemName: \"star.fill\")` usa un SF Symbol: íconos vectoriales de Apple que escalan con la fuente, así que se estilan con `.font` y `.foregroundStyle` como si fueran texto.",
            "Para fotos del catálogo usá `.resizable()` + `.scaledToFit()` (o `.scaledToFill()`); sin `.resizable()` la imagen se muestra a su tamaño original e ignora el `frame`.",
            "La macro `#Preview` (Xcode 15+) muestra la vista en el canvas sin correr la app. Podés tener varias previews por archivo, con datos distintos.",
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
          prompt: "Completá el parámetro para mostrar el SF Symbol `heart.fill`.",
          code: r`Image(____: "heart.fill")
    .font(.title)
    .foregroundStyle(.red)`,
          accept: ["^systemName$"],
          explanation: "`Image(systemName:)` busca el ícono en SF Symbols. `Image(\"heart.fill\")` sin etiqueta buscaría una imagen con ese nombre en el Asset Catalog y no la encontraría.",
          hint: "Es el inicializador de `Image` para íconos del sistema.",
          placeholder: "nombre del parámetro",
        },
        {
          kind: "write",
          prompt: "Escribí `ContactCard`: una fila con un SF Symbol a la izquierda y, a su derecha, el nombre arriba y el rol abajo alineados a la izquierda. Toda la tarjeta lleva padding y un fondo gris claro que cubra el padding. Agregá un `#Preview`.",
          starter: r`import SwiftUI

struct ContactCard: View {
    let name: String
    let role: String

    var body: some View {
        // ícono + nombre/rol
        Text(name)
    }
}`,
          checks: [
            { pattern: r`HStack`, label: "Usa un `HStack` para ícono + textos" },
            { pattern: r`Image\(systemName:\s*"[\w.]+"\)`, label: "Muestra un SF Symbol con `Image(systemName:)`" },
            { pattern: r`VStack\(alignment:\s*\.leading`, label: "Textos en `VStack(alignment: .leading)`" },
            { pattern: r`\.padding\(`, label: "Agrega `.padding()`" },
            { pattern: r`\.background\(`, label: "Agrega `.background(...)`" },
            { pattern: r`#Preview`, label: "Incluye `#Preview`" },
          ],
          warnings: [
            { pattern: r`\.background\([^\n]*\)\s*\n\s*\.padding\(\)`, label: "Si ponés `.background` antes de `.padding()`, el fondo no cubre el padding" },
            { pattern: r`UIImage|UIView`, label: "No hace falta UIKit para esto" },
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
          hint: "Orden: `HStack { Image; VStack(alignment: .leading) { ... }; Spacer() }` y después `.padding()` y `.background(...)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "state",
      title: "Estado: `@State`, `@Binding` y el entorno",
      goal: "Decidir quién es dueño de cada dato y elegir entre `@State`, `@Binding`, `@Environment`, `@AppStorage` y `@FocusState`.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "`@State`: la vista es dueña del dato",
          body: [
            "Los structs de vista se crean y se descartan todo el tiempo, así que una `var` común no sirve para guardar estado (además, dentro de `body` no se puede mutar). `@State` le pide a SwiftUI que guarde el valor **fuera** del struct, atado a la identidad de la vista en pantalla.",
            "Cuando un `@State` cambia, SwiftUI vuelve a calcular `body` de esa vista y actualiza solo lo que cambió. Declaralo siempre `private`: es estado local y nadie de afuera debería inicializarlo.",
            "Usalo para valores simples que le pertenecen a la vista: un contador, el texto de un campo, si un sheet está abierto.",
          ],
          code: r`struct CounterView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Contador: \(count)")
            Button("Sumar") { count += 1 }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "El usuario toca \"Sumar\" dos veces. ¿Qué texto muestra la pantalla?",
          code: r`struct ScoreView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Total: \(count * 10)")
            Button("Sumar") { count += 1 }
        }
    }
}`,
          options: ["Total: 0", "Total: 10", "Total: 20", "Total: 2"],
          answer: 2,
          explanation: "Cada toque suma 1 a `count`: después de dos toques vale 2. Cada cambio de `@State` vuelve a calcular `body`, y el texto muestra `count * 10`, o sea `Total: 20`.",
        },
        {
          kind: "explain",
          title: "`@Binding`: estado prestado",
          body: [
            "Si una vista hija necesita **modificar** un dato del padre, no le pasás el valor: le pasás un `Binding`, una referencia de lectura y escritura al `@State` del padre. Se obtiene con el prefijo `$`.",
            "Así hay una **única fuente de verdad**: el dato vive en un solo lugar (el padre) y todos lo leen y escriben a través del binding. Si el hijo declara su propio `@State` con una copia del valor, ahora hay dos fuentes y se desincronizan.",
            "Los controles de SwiftUI (`Toggle`, `TextField`, `Slider`, `Picker`) reciben bindings por el mismo motivo.",
          ],
          code: r`struct Parent: View {
    @State private var isOn = false

    var body: some View {
        VStack {
            Text(isOn ? "Prendido" : "Apagado")
            LightSwitch(isOn: $isOn)   // $ → Binding<Bool>
        }
    }
}

struct LightSwitch: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle("Luz", isOn: $isOn)
    }
}`,
        },
        {
          kind: "predict",
          prompt: "El usuario prende el `Toggle`. ¿Qué muestra la pantalla?",
          code: r`struct Parent: View {
    @State private var isOn = false

    var body: some View {
        VStack {
            Text(isOn ? "Prendido" : "Apagado")
            LightSwitch(isOn: isOn)
        }
    }
}

struct LightSwitch: View {
    @State var isOn: Bool

    var body: some View {
        Toggle("Luz", isOn: $isOn)
    }
}`,
          options: [
            "El toggle prendido y el texto \"Prendido\"",
            "El toggle prendido y el texto sigue en \"Apagado\"",
            "No compila: no se puede pasar un `Bool` a un `@State`",
            "El toggle vuelve solo a apagado",
          ],
          answer: 1,
          explanation: "`LightSwitch` recibe una **copia** del valor y la guarda en su propio `@State`. El toggle modifica esa copia, no el estado del padre, así que el `Text` del padre sigue en \"Apagado\". Hay dos fuentes de verdad. La solución es `@Binding var isOn: Bool` y pasar `$isOn`.",
        },
        {
          kind: "fill",
          prompt: "Completá el argumento para que el `Toggle` lea y escriba `wifiOn`.",
          code: r`struct WifiSettings: View {
    @State private var wifiOn = true

    var body: some View {
        Toggle("Wi-Fi", isOn: ____)
    }
}`,
          accept: [r`^\$wifiOn$`],
          explanation: "`isOn:` pide un `Binding<Bool>`. `wifiOn` es el valor (`Bool`); `$wifiOn` es el binding que proyecta el `@State`.",
          hint: "El prefijo que convierte un `@State` en `Binding`.",
        },
        {
          kind: "explain",
          title: "`@Environment`, `@AppStorage` y `@FocusState`",
          body: [
            "`@Environment` lee valores que SwiftUI propaga por el árbol: `\\.dismiss` (cerrar el sheet o volver atrás), `\\.colorScheme`, `\\.locale`, `\\.horizontalSizeClass`. La vista no es dueña de esos datos; los consume.",
            "`@AppStorage(\"clave\")` es como un `@State` respaldado por `UserDefaults`: sobrevive a cerrar la app. Sirve para preferencias chicas (tema, último filtro); nunca para tokens o datos sensibles, que van al Keychain.",
            "`@FocusState` controla qué campo tiene el teclado. Con un enum podés mover el foco entre campos y quitarlo asignando `nil`.",
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
            SecureField("Contraseña", text: $password)
                .focused($focused, equals: .password)
            Button("Cancelar") { dismiss() }
        }
        .onAppear { focused = .email }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Querés que la app recuerde si el usuario eligió ordenar \"por fecha\" aunque cierre y vuelva a abrir la app. ¿Qué wrapper usás?",
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
          explanation: "`@State` vive mientras la vista esté en pantalla y se pierde al cerrar la app. `@AppStorage` guarda el valor en `UserDefaults` y además redibuja la vista cuando cambia. `@Environment` lee valores que alguien inyectó en el árbol, no persiste nada, y `@FocusState` es solo para el foco del teclado.",
        },
        {
          kind: "write",
          prompt: "Escribí `SettingsView`: un `Form` con un `Toggle` \"Modo oscuro\" que persista en `UserDefaults` bajo la clave `darkMode`, y un botón \"Listo\" que cierre la pantalla usando el entorno.",
          starter: r`import SwiftUI

struct SettingsView: View {
    // 1. preferencia persistida
    // 2. acción para cerrar la pantalla

    var body: some View {
        Form {
            // Toggle + botón "Listo"
        }
    }
}`,
          checks: [
            { pattern: r`@AppStorage\("darkMode"\)`, label: "Persiste con `@AppStorage(\"darkMode\")`" },
            { pattern: r`Toggle\(.*isOn:\s*\$darkMode`, label: "El `Toggle` usa `$darkMode`" },
            { pattern: r`@Environment\(\\\.dismiss\)`, label: "Lee `@Environment(\\.dismiss)`" },
            { pattern: r`dismiss\(\)`, label: "Llama a `dismiss()` en el botón" },
          ],
          warnings: [
            { pattern: r`@State\s+(private\s+)?var\s+darkMode`, label: "Con `@State` la preferencia se pierde al cerrar la app" },
            { pattern: r`presentationMode`, label: "`presentationMode` está deprecado: usá `\\.dismiss`" },
          ],
          solution: r`import SwiftUI

struct SettingsView: View {
    @AppStorage("darkMode") private var darkMode = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Toggle("Modo oscuro", isOn: $darkMode)
            Button("Listo") { dismiss() }
        }
    }
}`,
          hint: "`@AppStorage(\"darkMode\") private var darkMode = false` y `@Environment(\\.dismiss) private var dismiss`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "observation",
      title: "Modelos observables: `@Observable` y `ObservableObject`",
      goal: "Conectar un modelo de clase a las vistas con `@Observable` (iOS 17) y reconocer el equivalente `ObservableObject` (iOS 13–16) y sus bugs típicos.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "`@Observable` (iOS 17+)",
          body: [
            "Cuando el estado crece (una lista, flags de carga, lógica), lo movés a una clase modelo o ViewModel. La macro `@Observable` hace que todas sus propiedades almacenadas sean observables, sin `@Published`.",
            "SwiftUI registra **qué propiedades leyó cada `body`** y solo redibuja las vistas que leyeron la propiedad que cambió. Es más fino que `ObservableObject`, que avisaba ante cualquier cambio.",
            "Quién lo crea es dueño: `@State private var model = Model()`. Las vistas hijas lo reciben como parámetro común (`let model: Model`); no necesitan wrapper para leerlo ni para llamar métodos.",
          ],
          code: r`import Observation

@Observable
final class CartStore {
    var items: [String] = []
    var isLoading = false

    func add(_ item: String) { items.append(item) }
}

struct CartScreen: View {
    @State private var store = CartStore()   // dueño

    var body: some View {
        VStack {
            Text("Items: \(store.items.count)")
            AddButton(store: store)          // prestado
        }
    }
}

struct AddButton: View {
    let store: CartStore

    var body: some View {
        Button("Agregar") { store.add("Café") }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Con el código de arriba, el usuario toca \"Agregar\" tres veces. ¿Qué muestra `CartScreen`?",
          code: r`// CartScreen:   @State private var store = CartStore()
// AddButton:    let store: CartStore
//               Button("Agregar") { store.add("Café") }
Text("Items: \(store.items.count)")`,
          options: [
            "Items: 3",
            "Items: 0, porque `AddButton` necesita `@Bindable` para modificar el store",
            "No compila: no se puede mutar algo declarado con `let`",
            "Items: 0, porque `AddButton` necesita `@ObservedObject`",
          ],
          answer: 0,
          explanation: "`CartStore` es una clase: `let store` fija la referencia, no impide mutar sus propiedades. `AddButton` y `CartScreen` comparten la misma instancia. Como `CartScreen` leyó `store.items` en su `body`, Observation lo redibuja cuando `items` cambia. `@Bindable` solo hace falta para crear bindings (`$store.algo`).",
        },
        {
          kind: "explain",
          title: "`@Bindable` y compartir por el entorno",
          body: [
            "Si una vista hija necesita un `Binding` a una propiedad del modelo (por ejemplo para un `TextField`), declarala `@Bindable var model: Model` y usá `$model.propiedad`.",
            "Para no pasar el modelo por diez niveles de vistas, inyectalo en el entorno con `.environment(store)` y leelo donde lo necesites con `@Environment(CartStore.self) private var store`. Si no hay ninguno inyectado, la app se cae en runtime, así que inyectalo cerca de la raíz.",
            "Un modelo leído con `@Environment` no da bindings directamente: dentro de `body` hacé `@Bindable var store = store` y después `$store.propiedad`.",
          ],
          code: r`struct ProfileForm: View {
    @Bindable var profile: Profile          // @Observable

    var body: some View {
        TextField("Nombre", text: $profile.name)
    }
}

// Raíz
ContentView()
    .environment(store)

// Cualquier descendiente
struct CartBadge: View {
    @Environment(CartStore.self) private var store
    var body: some View { Text("\(store.items.count)") }
}`,
        },
        {
          kind: "fill",
          prompt: "`EditTitle` recibe un modelo `@Observable` y necesita un binding a `title`. Completá el wrapper.",
          code: r`struct EditTitle: View {
    ____ var note: Note

    var body: some View {
        TextField("Título", text: $note.title)
    }
}`,
          accept: ["^@Bindable$"],
          explanation: "Con `@Observable`, `@Bindable` es lo que habilita la sintaxis `$note.title` para crear un `Binding<String>`. Sin wrapper, la vista igual se actualiza al leer `note.title`, pero no podés usar `$`.",
          placeholder: "@...",
        },
        {
          kind: "explain",
          title: "Antes de iOS 17: `ObservableObject`",
          body: [
            "Muchísimo código en producción (y apps que soportan iOS 16) usa `ObservableObject`: la clase conforma el protocolo y marca con `@Published` cada propiedad que debe redibujar la vista.",
            "El dueño usa `@StateObject` (SwiftUI crea el objeto una sola vez y lo conserva). Quien lo recibe usa `@ObservedObject` (no controla su vida). Para inyectarlo en el árbol: `.environmentObject(vm)` + `@EnvironmentObject`.",
            "El bug clásico: `@ObservedObject var vm = VM()` dentro de la vista. Cada vez que el padre recalcula su `body`, el struct se vuelve a crear, se crea un `VM` nuevo y el estado se pierde. Si la vista crea el objeto, va `@StateObject`.",
          ],
          code: r`final class ProfileViewModel: ObservableObject {
    @Published var name = ""
}

struct ProfileScreen: View {
    @StateObject private var vm = ProfileViewModel()   // dueño
    var body: some View { ProfileHeader(vm: vm) }
}

struct ProfileHeader: View {
    @ObservedObject var vm: ProfileViewModel           // prestado
    var body: some View { Text(vm.name) }
}`,
        },
        {
          kind: "predict",
          prompt: "El usuario toca el botón tres veces (muestra \"Valor: 3\") y después cambia el `Toggle`. ¿Qué muestra el botón?",
          code: r`final class CounterVM: ObservableObject {
    @Published var value = 0
}

struct Parent: View {
    @State private var dark = false

    var body: some View {
        VStack {
            Toggle("Oscuro", isOn: $dark)
            Text(dark ? "Modo oscuro" : "Modo claro")
            CounterView()
        }
    }
}

struct CounterView: View {
    @ObservedObject var vm = CounterVM()

    var body: some View {
        Button("Valor: \(vm.value)") { vm.value += 1 }
    }
}`,
          options: [
            "Valor: 3",
            "Valor: 4",
            "La app se cae por acceder a un objeto liberado",
            "Valor: 0",
          ],
          answer: 3,
          explanation: "Al cambiar `dark`, `Parent` recalcula su `body` y ejecuta `CounterView()` de nuevo, que crea otro `CounterVM()`. `@ObservedObject` no conserva la instancia anterior, así que SwiftUI pasa a observar el objeto nuevo con `value = 0`. Con `@StateObject` (o `@Observable` + `@State`) el contador seguiría en 3.",
        },
        {
          kind: "write",
          prompt: "Migrá este código de `ObservableObject` a `@Observable` (iOS 17): el modelo sin `@Published`, el dueño con `@State` y el formulario con `@Bindable` para seguir usando `$vm.name`.",
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
        TextField("Nombre", text: $vm.name)
    }
}`,
          checks: [
            { pattern: r`@Observable\s+final\s+class\s+ProfileViewModel`, label: "`@Observable final class ProfileViewModel`" },
            { pattern: r`@State\s+private\s+var\s+vm\s*=\s*ProfileViewModel\(\)`, label: "El dueño usa `@State private var vm`" },
            { pattern: r`@Bindable\s+var\s+vm:\s*ProfileViewModel`, label: "El formulario usa `@Bindable var vm`" },
            { pattern: r`\$vm\.name`, label: "Sigue usando `$vm.name`" },
          ],
          warnings: [
            { pattern: r`ObservableObject`, label: "Con `@Observable` no se conforma `ObservableObject`" },
            { pattern: r`@Published`, label: "`@Published` sobra con `@Observable`" },
            { pattern: r`@StateObject|@ObservedObject`, label: "`@StateObject`/`@ObservedObject` son para `ObservableObject`" },
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
        TextField("Nombre", text: $vm.name)
    }
}`,
          hint: "`@StateObject` → `@State`, `@ObservedObject` → `@Bindable` (porque necesitás `$vm.name`).",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "lists-forms",
      title: "Listas y formularios",
      goal: "Mostrar colecciones con identidad estable y armar formularios con búsqueda, pull-to-refresh y swipe actions.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "`List`, `ForEach` e identidad",
          body: [
            "`List` muestra filas con scroll y estilo de sistema. `ForEach` genera vistas a partir de una colección y se usa dentro de `List`, `VStack`, `Form`, etc.",
            "SwiftUI necesita saber **qué fila es cuál** entre un render y el siguiente para animar, conservar el `@State` de cada fila y no confundirlas. Por eso los elementos conforman `Identifiable` (tienen un `id` estable) o pasás `id:` explícito.",
            "Evitá identidades que cambian: `id: \\.offset` (la posición) o `id: \\.self` sobre valores que se repiten. Un `id` de tu modelo (de la API, o `UUID()` creado una sola vez) es lo correcto.",
          ],
          code: r`struct Todo: Identifiable {
    let id = UUID()
    var title: String
    var done = false
}

struct TodoListView: View {
    @State private var todos = [Todo(title: "Comprar pan"), Todo(title: "Pagar luz")]

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
          prompt: "Cada `TodoRow` tiene `@State private var expanded = false`. El usuario expande la primera fila (\"Comprar pan\") y después la borra. ¿Qué pasa?",
          code: r`List {
    ForEach(Array(todos.enumerated()), id: \.offset) { index, todo in
        TodoRow(todo: todo)
    }
    .onDelete { todos.remove(atOffsets: $0) }
}`,
          options: [
            "Se borra la fila y todo queda contraído",
            "No se puede borrar: `onDelete` no funciona con `enumerated()`",
            "\"Pagar luz\" pasa a ser la primera fila y aparece expandida",
            "SwiftUI crashea por ids duplicados",
          ],
          answer: 2,
          explanation: "La identidad es la posición. Al borrar, \"Pagar luz\" pasa a la posición 0, que es la misma identidad que tenía \"Comprar pan\". SwiftUI cree que es la misma fila con datos nuevos y le deja el `@State` (`expanded = true`). Con `ForEach(todos)` y un `id` estable, el estado se iría con la fila borrada.",
        },
        {
          kind: "fill",
          prompt: "Completá el protocolo para poder escribir `ForEach(todos)` sin `id:`.",
          code: r`struct Todo: ____ {
    let id = UUID()
    var title: String
}`,
          accept: ["^Identifiable$", r`^Identifiable\s*,\s*Hashable$`, r`^Hashable\s*,\s*Identifiable$`],
          explanation: "`Identifiable` exige una propiedad `id` de tipo `Hashable`. `ForEach` y `List` la usan como identidad de cada fila.",
          placeholder: "Protocolo",
        },
        {
          kind: "explain",
          title: "Formularios: `Form`, `TextField`, `Picker`, `Toggle`",
          body: [
            "`Form` agrupa controles con el estilo de Configuración de iOS. Cada control recibe un `Binding` a tu estado: `TextField(\"Nombre\", text: $name)`, `Toggle(\"Notificaciones\", isOn: $notify)`, `Stepper(value: $count)`.",
            "`Picker` necesita que el `tag` de cada opción tenga **exactamente el mismo tipo** que la selección. Con un enum `CaseIterable` + `ForEach`, la vista usa el `id` del elemento; si ponés `.tag` a mano, asegurate de que coincida el tipo.",
            "`Section` separa bloques y acepta header y footer.",
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
            Section("Cuenta") {
                TextField("Nombre", text: $name)
                Picker("Plan", selection: $plan) {
                    ForEach(Plan.allCases) { plan in
                        Text(plan.rawValue.capitalized).tag(plan)
                    }
                }
            }
            Section {
                Toggle("Recibir novedades", isOn: $newsletter)
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "El usuario elige \"Chocolate\" en el picker. ¿Qué pasa?",
          code: r`enum Flavor { case vanilla, chocolate }

struct FlavorPicker: View {
    @State private var flavor = "vanilla"

    var body: some View {
        Picker("Sabor", selection: $flavor) {
            Text("Vainilla").tag(Flavor.vanilla)
            Text("Chocolate").tag(Flavor.chocolate)
        }
    }
}`,
          options: [
            "La selección no cambia: los `tag` son `Flavor` y la selección es `String`",
            "`flavor` pasa a valer `\"chocolate\"`",
            "No compila porque `Flavor` no es `String`",
            "`flavor` pasa a valer `\"Chocolate\"` (el texto de la opción)",
          ],
          answer: 0,
          explanation: "Compila, pero SwiftUI compara cada `tag` con el tipo de la selección (`String`). Ningún `tag` es `String`, así que ninguna opción coincide y elegir no actualiza `flavor` (en consola aparece un aviso de selección inválida). Los `tag` tienen que ser del mismo tipo que el binding: usá `@State private var flavor: Flavor = .vanilla`.",
        },
        {
          kind: "explain",
          title: "Búsqueda, refresh y swipe actions",
          body: [
            "`.searchable(text: $query)` agrega la barra de búsqueda (dentro de un `NavigationStack` aparece en la barra de navegación). Vos filtrás con una propiedad calculada; SwiftUI solo te da el texto.",
            "`.refreshable { await store.reload() }` habilita el pull-to-refresh: el spinner queda visible hasta que termina la función `async`.",
            "`.swipeActions` agrega botones al deslizar una fila (por defecto en el borde final; `edge: .leading` para el otro lado). `role: .destructive` pinta el botón de rojo. Con un swipe completo se ejecuta el primer botón (`allowsFullSwipe` es `true` por defecto).",
          ],
          code: r`List {
    ForEach(filtered) { mail in
        Text(mail.subject)
            .swipeActions {
                Button("Borrar", role: .destructive) { store.delete(mail) }
            }
            .swipeActions(edge: .leading) {
                Button("Leído") { store.markRead(mail) }
                    .tint(.blue)
            }
    }
}
.searchable(text: $query)
.refreshable { await store.reload() }`,
        },
        {
          kind: "fill",
          prompt: "Completá el rol para que el sistema trate el botón como una acción que borra (y lo pinte de rojo).",
          code: r`.swipeActions {
    Button("Borrar", role: ____) {
        store.delete(mail)
    }
}`,
          accept: [r`^\.destructive$`],
          explanation: "`ButtonRole.destructive` le indica al sistema que la acción borra algo: en las swipe actions el botón se pinta de rojo. Como es el primer botón, también se ejecuta con un swipe completo.",
          placeholder: ".rol",
        },
        {
          kind: "write",
          prompt: "Completá `ContactsView`: la lista muestra `filtered` (todos los contactos si `query` está vacío; si no, los que contienen el texto sin importar mayúsculas), con barra de búsqueda y un swipe para borrar el contacto.",
          starter: r`struct Contact: Identifiable {
    let id = UUID()
    var name: String
}

struct ContactsView: View {
    @State private var contacts = [Contact(name: "Ana"), Contact(name: "Bruno"), Contact(name: "Carla")]
    @State private var query = ""

    var filtered: [Contact] {
        contacts // TODO: filtrar
    }

    var body: some View {
        NavigationStack {
            List {
                // filas
            }
            .navigationTitle("Contactos")
        }
    }
}`,
          checks: [
            { pattern: r`\.filter\s*\{`, label: "Filtra con `.filter`" },
            { pattern: r`localizedCaseInsensitiveContains|lowercased\(\)`, label: "Ignora mayúsculas" },
            { pattern: r`(ForEach|List)\(filtered\)`, label: "Itera `filtered` con identidad de `Contact`" },
            { pattern: r`\.searchable\(text:\s*\$query\)`, label: "`.searchable(text: $query)`" },
            { pattern: r`\.swipeActions`, label: "Agrega `.swipeActions`" },
            { pattern: r`role:\s*\.destructive`, label: "Botón con `role: .destructive`" },
          ],
          warnings: [
            { pattern: r`id:\s*\\\.(self|offset)`, label: "`Contact` ya es `Identifiable`: no hace falta `id:` y `\\.self`/`\\.offset` no son estables" },
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
                            Button("Borrar", role: .destructive) {
                                contacts.removeAll { $0.id == contact.id }
                            }
                        }
                }
            }
            .navigationTitle("Contactos")
            .searchable(text: $query)
        }
    }
}`,
          hint: "Borrá por `id` del array original (`contacts.removeAll { $0.id == contact.id }`), no por índice de `filtered`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "navigation-lifecycle",
      title: "Navegación y ciclo de vida",
      goal: "Navegar con `NavigationStack` y `path`, presentar sheets y alerts, y cargar datos con `.task` / `.task(id:)` sin trabajo zombie.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "`NavigationStack` con `path`",
          body: [
            "`NavigationStack` (iOS 16+) reemplaza a `NavigationView`. La navegación se basa en **valores**: `NavigationLink(value: x)` apila un valor y `.navigationDestination(for: Tipo.self)` decide qué vista mostrar para ese tipo.",
            "Si le pasás `path: $path`, el stack refleja ese array: `append` empuja, `removeLast()` vuelve uno atrás y `removeAll()` vuelve a la raíz. Esto permite navegar desde código (deep links, después de guardar, etc.).",
            "Para tipos mezclados en el mismo stack usá `NavigationPath` en lugar de un array tipado.",
          ],
          code: r`struct OrdersView: View {
    @State private var path: [Order.ID] = []
    let orders: [Order]

    var body: some View {
        NavigationStack(path: $path) {
            List(orders) { order in
                NavigationLink(order.title, value: order.id)
            }
            .navigationTitle("Pedidos")
            .navigationDestination(for: Order.ID.self) { id in
                OrderDetailView(orderID: id, onDone: { path.removeAll() })
            }
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "La app abre con este `path`. El usuario toca \"atrás\" una vez. ¿Qué ve?",
          code: r`struct DeepLinkDemo: View {
    @State private var path: [Int] = [1, 2, 3]

    var body: some View {
        NavigationStack(path: $path) {
            Text("Inicio")
                .navigationDestination(for: Int.self) { n in
                    Text("Detalle \(n)")
                }
        }
    }
}`,
          options: ["Inicio", "Detalle 1", "Detalle 2", "Detalle 3"],
          answer: 2,
          explanation: "El stack arranca con tres pantallas apiladas sobre la raíz: Detalle 1, 2 y 3 (arriba). Volver atrás hace `removeLast()` sobre `path`, que queda `[1, 2]`, así que se ve \"Detalle 2\".",
        },
        {
          kind: "fill",
          prompt: "Completá el tipo para registrar el destino de los `NavigationLink(value:)` que apilan un `Int`.",
          code: r`.navigationDestination(for: ____) { n in
    Text("Detalle \(n)")
}`,
          accept: [r`^Int\.self$`],
          explanation: "`navigationDestination(for:)` recibe el metatipo (`Int.self`). Cada vez que se apila un valor de ese tipo, SwiftUI llama al closure con el valor.",
          placeholder: "Tipo.self",
        },
        {
          kind: "explain",
          title: "Sheets y alerts",
          body: [
            "`.sheet(isPresented: $showing)` presenta una vista modal mientras el `Bool` sea `true`. `.sheet(item: $selected)` la presenta cuando el opcional tiene valor y te pasa ese valor (el tipo tiene que ser `Identifiable`).",
            "Cuando el usuario cierra el sheet con el gesto, SwiftUI vuelve el binding a `false` o a `nil` solo. Desde adentro del sheet cerrás con `@Environment(\\.dismiss)`.",
            "`.alert` sigue el mismo patrón: título, `isPresented`, botones y un `message` opcional.",
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
        .alert("¿Borrar todo?", isPresented: $showDeleteAlert) {
            Button("Borrar", role: .destructive) { /* ... */ }
            Button("Cancelar", role: .cancel) { }
        } message: {
            Text("No se puede deshacer.")
        }
    }
}`,
        },
        {
          kind: "predict",
          prompt: "El usuario abre el sheet de un producto y lo cierra deslizando hacia abajo. ¿Cuánto vale `selected`?",
          code: r`@State private var selected: Product?

List(products) { product in
    Button(product.name) { selected = product }
}
.sheet(item: $selected) { product in
    ProductDetail(product: product)
}`,
          options: [
            "Sigue siendo el producto elegido hasta que lo pongas en `nil` a mano",
            "`nil`: SwiftUI lo limpia al cerrar el sheet",
            "Queda apuntando al primer producto de la lista",
            "No se puede cerrar con el gesto un sheet con `item:`",
          ],
          answer: 1,
          explanation: "El sheet está atado al binding: se muestra mientras `selected` no sea `nil`. Al cerrarlo con el gesto, SwiftUI escribe `nil` en `selected` para que el estado refleje lo que se ve. Si no lo hiciera, el sheet volvería a abrirse.",
        },
        {
          kind: "explain",
          title: "`.task` vs `onAppear`, y `.task(id:)`",
          body: [
            "`.onAppear` es síncrono: para llamar código `async` tendrías que crear un `Task { }` a mano, y esa tarea sigue corriendo aunque el usuario se vaya de la pantalla.",
            "`.task { }` arranca una tarea `async` cuando la vista aparece y **la cancela sola** cuando desaparece. Es el lugar natural para cargar datos de una pantalla.",
            "`.task(id: valor)` además cancela la tarea en curso y arranca una nueva cada vez que `valor` cambia. Combinado con `Task.sleep` da un debounce de búsqueda en tres líneas. Ojo: `Task.sleep` lanza al cancelarse; si usás `try?`, chequeá `Task.isCancelled` después.",
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
          prompt: "El usuario escribe \"s\", \"sw\" y \"swi\" en menos de 300 ms. ¿Cuántas veces se llama a `api.search`?",
          code: r`.searchable(text: $query)
.task(id: query) {
    try? await Task.sleep(for: .milliseconds(300))
    guard !Task.isCancelled else { return }
    results = await api.search(query)
}`,
          options: [
            "Tres veces, una por cada letra",
            "Ninguna: `.task` solo corre al aparecer la vista",
            "Dos veces: la primera y la última",
            "Una vez, con \"swi\"",
          ],
          answer: 3,
          explanation: "Cada cambio de `query` cancela la tarea anterior y arranca otra. Las tareas de \"s\" y \"sw\" se cancelan durante el `sleep`: `Task.sleep` lanza, `try?` se lo traga y el `guard !Task.isCancelled` corta antes de llamar a la API. Solo la de \"swi\" llega a buscar.",
        },
        {
          kind: "write",
          prompt: "Agregá a `SearchView` la carga de resultados: cada vez que cambie `query`, esperá 300 ms (debounce), cortá si la tarea fue cancelada y asigná `results` con `await api.search(query)`. Nada de `Task { }` manual.",
          starter: r`struct SearchView: View {
    let api: ProductAPI          // func search(_ q: String) async -> [Product]
    @State private var query = ""
    @State private var results: [Product] = []

    var body: some View {
        NavigationStack {
            List(results) { Text($0.name) }
                .searchable(text: $query)
                // cargar resultados acá
        }
    }
}`,
          checks: [
            { pattern: r`\.task\(id:\s*query\)`, label: "Usa `.task(id: query)`" },
            { pattern: r`Task\.sleep\(`, label: "Debounce con `Task.sleep`" },
            { pattern: r`Task\.isCancelled|catch`, label: "Corta si la tarea fue cancelada" },
            { pattern: r`results\s*=\s*await\s+api\.search\(query\)`, label: "Asigna `results = await api.search(query)`" },
          ],
          warnings: [
            { pattern: r`\.onAppear`, label: "`.onAppear` no se vuelve a ejecutar cuando cambia `query`" },
            { pattern: r`Task\s*\{`, label: "Un `Task { }` manual no se cancela solo" },
            { pattern: r`\.onChange`, label: "`.onChange` + `Task` no cancela la búsqueda anterior: `.task(id:)` sí" },
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
      title: "Reto final: recetas con favoritos",
      goal: "Integrar vistas, estado, listas, navegación y un modelo `@Observable` compartido en una mini app real.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Te toca el primer ticket de una app de recetas. Producto pide: una lista de recetas, un detalle con botón de favorito (corazón) y que el corazón aparezca también en la fila de la lista. Más adelante habrá una pestaña de favoritos.",
            "Decisión de diseño: un único `RecipeStore` `@Observable` es la fuente de verdad. Guarda las recetas y un `Set` con los ids favoritos; la lista de favoritos se **deriva**, no se duplica.",
            "La vista raíz crea el store con `@State` y lo inyecta en el entorno; el detalle lo lee con `@Environment`. La navegación es por valor con `navigationDestination(for: Recipe.self)`.",
          ],
          code: r`struct Recipe: Identifiable, Hashable {
    let id: UUID
    var title: String
    var minutes: Int
}

// Árbol de vistas
// RecipeListView        @State store + .environment(store)
//   └─ NavigationStack
//        ├─ List → NavigationLink(value: recipe)
//        └─ RecipeDetailView   @Environment(RecipeStore.self)`,
        },
        {
          kind: "write",
          prompt: "Escribí `RecipeStore`: `@Observable`, con `recipes`, un `Set` de ids favoritos, `isFavorite(_:)`, `toggleFavorite(_:)` (agrega o quita) y una propiedad calculada `favorites: [Recipe]` derivada del set.",
          starter: r`final class RecipeStore {
    var recipes: [Recipe] = []
}`,
          checks: [
            { pattern: r`@Observable\s+final\s+class\s+RecipeStore`, label: "`@Observable final class RecipeStore`" },
            { pattern: r`Set<(Recipe\.ID|UUID)>`, label: "Guarda los favoritos en un `Set` de ids" },
            { pattern: r`func\s+isFavorite\(`, label: "Tiene `isFavorite(_:)`" },
            { pattern: r`func\s+toggleFavorite\(`, label: "Tiene `toggleFavorite(_:)`" },
            { pattern: r`\.insert\(`, label: "Agrega con `insert`" },
            { pattern: r`\.remove\(`, label: "Quita con `remove`" },
            { pattern: r`var\s+favorites:\s*\[Recipe\]\s*\{`, label: "`favorites` es una propiedad calculada" },
          ],
          warnings: [
            { pattern: r`ObservableObject|@Published`, label: "Usá `@Observable`, no `ObservableObject`/`@Published`" },
            { pattern: r`var\s+favorites:\s*\[Recipe\]\s*=`, label: "Guardar `favorites` aparte duplica datos: derivalo del set" },
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
          hint: "`var favoriteIDs: Set<Recipe.ID> = []` y `var favorites: [Recipe] { recipes.filter { ... } }`.",
        },
        {
          kind: "write",
          prompt: "Escribí `RecipeListView`: crea y es dueña del store, muestra las recetas en un `NavigationStack` con `NavigationLink(value:)`, un corazón lleno en la fila si es favorita, el destino para `Recipe` hacia `RecipeDetailView(recipe:)` e inyecta el store en el entorno.",
          starter: r`struct RecipeListView: View {
    var body: some View {
        Text("Recetas")
    }
}`,
          checks: [
            { pattern: r`@State\s+private\s+var\s+store\s*=\s*RecipeStore\(\)`, label: "`@State private var store = RecipeStore()`" },
            { pattern: r`NavigationStack`, label: "Usa `NavigationStack`" },
            { pattern: r`NavigationLink\(value:`, label: "Navega por valor con `NavigationLink(value:)`" },
            { pattern: r`isFavorite\(recipe\)`, label: "Consulta `store.isFavorite(recipe)` en la fila" },
            { pattern: r`\.navigationDestination\(for:\s*Recipe\.self\)`, label: "`.navigationDestination(for: Recipe.self)`" },
            { pattern: r`\.environment\(store\)`, label: "Inyecta con `.environment(store)`" },
          ],
          warnings: [
            { pattern: r`@StateObject|@ObservedObject|@EnvironmentObject`, label: "Son wrappers de `ObservableObject`" },
            { pattern: r`NavigationView`, label: "`NavigationView` está deprecado: usá `NavigationStack`" },
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
            .navigationTitle("Recetas")
            .navigationDestination(for: Recipe.self) { recipe in
                RecipeDetailView(recipe: recipe)
            }
        }
        .environment(store)
    }
}`,
          hint: "`.environment(store)` va sobre el `NavigationStack` para que también lo vean las pantallas apiladas.",
        },
        {
          kind: "write",
          prompt: "Escribí `RecipeDetailView(recipe:)`: lee el store del entorno, muestra título y minutos, y un botón que alterna el favorito con un ícono `heart` / `heart.fill` según el estado.",
          starter: r`struct RecipeDetailView: View {
    let recipe: Recipe

    var body: some View {
        Text(recipe.title)
    }
}`,
          checks: [
            { pattern: r`@Environment\(RecipeStore\.self\)`, label: "`@Environment(RecipeStore.self)`" },
            { pattern: r`store\.toggleFavorite\(recipe\)`, label: "El botón llama a `store.toggleFavorite(recipe)`" },
            { pattern: r`store\.isFavorite\(recipe\)`, label: "Lee `store.isFavorite(recipe)`" },
            { pattern: r`"heart\.fill"`, label: "Usa el SF Symbol `heart.fill`" },
            { pattern: r`"heart"`, label: "Y `heart` cuando no es favorita" },
          ],
          warnings: [
            { pattern: r`RecipeStore\(\)`, label: "No crees otro store: usá el del entorno" },
            { pattern: r`@EnvironmentObject`, label: "Con `@Observable` se usa `@Environment(Tipo.self)`" },
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
          prompt: "Un compañero agrega la pestaña de favoritos así. El usuario marca dos recetas como favoritas en el detalle y abre esta pestaña. ¿Qué ve?",
          code: r`struct FavoritesView: View {
    @State private var store = RecipeStore()

    var body: some View {
        List(store.favorites) { recipe in
            Text(recipe.title)
        }
    }
}`,
          options: [
            "Las dos recetas favoritas",
            "Una lista vacía",
            "La app se cae porque falta `.environment(store)`",
            "Todas las recetas",
          ],
          answer: 1,
          explanation: "`@State private var store = RecipeStore()` crea **otro** store, vacío y separado del que usa `RecipeListView`. Hay dos fuentes de verdad y esta no tiene ni recetas ni favoritos. La corrección: `@Environment(RecipeStore.self) private var store`, inyectado desde la raíz.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-view-body",
      front: "¿Qué necesita un tipo para ser una vista de SwiftUI?",
      back: "Conformar `View` y tener `var body: some View`. Suele ser un `struct`; `body` describe la UI para el estado actual y SwiftUI lo recalcula cuando el estado cambia.",
    },
    {
      id: "fc-some-view",
      front: "¿Qué significa `some View`?",
      back: "Un tipo opaco: `body` devuelve un tipo de vista concreto y fijo que el compilador conoce, sin que tengas que escribirlo.",
    },
    {
      id: "fc-modifier-order",
      front: "¿Por qué `.padding().background(.red)` no es igual a `.background(.red).padding()`?",
      back: "Cada modificador envuelve a la vista anterior. En el primero el fondo pinta la vista ya agrandada (cubre el padding); en el segundo pinta solo detrás del contenido y el padding queda transparente afuera.",
      code: r`Text("Hola").padding().background(.red)   // rojo incluye padding
Text("Hola").background(.red).padding()   // rojo solo detrás del texto`,
    },
    {
      id: "fc-spacer",
      front: "¿Qué hace `Spacer()` dentro de un `HStack`?",
      back: "Ocupa todo el espacio horizontal libre y empuja a sus vecinos hacia los bordes.",
    },
    {
      id: "fc-sf-symbols",
      front: "¿Cómo mostrás un SF Symbol y cómo le cambiás tamaño y color?",
      back: "`Image(systemName: \"star.fill\")`. Se comporta como texto: `.font(.title)` para el tamaño y `.foregroundStyle(.yellow)` para el color.",
    },
    {
      id: "fc-state",
      front: "¿Cuándo usás `@State`?",
      back: "Para estado simple que le pertenece a la vista (contador, texto de un campo, sheet abierto). Siempre `private`. SwiftUI lo guarda fuera del struct y redibuja cuando cambia.",
    },
    {
      id: "fc-binding",
      front: "¿Qué es un `@Binding` y cómo se obtiene?",
      back: "Una referencia de lectura/escritura a un estado que vive en otra vista. Se obtiene con `$` sobre el `@State` del dueño: `Child(isOn: $isOn)`.",
    },
    {
      id: "fc-single-source",
      front: "¿Qué pasa si una vista hija guarda en su propio `@State` un valor que le pasó el padre?",
      back: "Se crea una segunda fuente de verdad: el hijo modifica su copia y el padre no se entera. Usá `@Binding`.",
    },
    {
      id: "fc-env-storage-focus",
      front: "`@Environment`, `@AppStorage`, `@FocusState`: ¿para qué es cada uno?",
      back: "`@Environment`: leer valores del entorno (`\\.dismiss`, `\\.colorScheme`, un modelo inyectado). `@AppStorage`: preferencia persistida en `UserDefaults`. `@FocusState`: qué campo tiene el teclado.",
    },
    {
      id: "fc-observable",
      front: "Con `@Observable` (iOS 17): ¿qué wrapper usa el dueño, el que solo lee y el que necesita bindings?",
      back: "Dueño: `@State private var model = Model()`. Solo lee: `let model: Model`. Necesita `$model.prop`: `@Bindable var model: Model`. Compartido: `.environment(model)` + `@Environment(Model.self)`.",
    },
    {
      id: "fc-stateobject",
      front: "`@StateObject` vs `@ObservedObject`",
      back: "Ambos son para `ObservableObject` (iOS 13–16). `@StateObject`: la vista crea el objeto y SwiftUI lo conserva entre renders. `@ObservedObject`: lo recibe de afuera; si lo creás inline, se recrea y se pierde el estado.",
    },
    {
      id: "fc-identity",
      front: "¿Por qué evitar `id: \\.offset` o `id: \\.self` con valores repetidos en `ForEach`?",
      back: "La identidad tiene que ser estable. Con la posición o con duplicados, al insertar/borrar SwiftUI confunde filas: anima mal y deja `@State` en la fila equivocada. Usá un modelo `Identifiable` con `id` propio.",
    },
    {
      id: "fc-nav-path",
      front: "¿Cómo volvés a la raíz de un `NavigationStack(path: $path)` desde código?",
      back: "`path.removeAll()` (con `NavigationPath`: `path = NavigationPath()`). `removeLast()` vuelve una pantalla.",
    },
    {
      id: "fc-task",
      front: "`.task` vs `.onAppear`",
      back: "`.task` corre código `async` al aparecer la vista y lo cancela solo al desaparecer. `.onAppear` es síncrono; un `Task { }` creado ahí sigue vivo aunque te vayas.",
    },
    {
      id: "fc-task-id",
      front: "¿Qué hace `.task(id: query)`?",
      back: "Arranca la tarea al aparecer y, cada vez que `query` cambia, cancela la anterior y arranca una nueva. Con `Task.sleep` adentro sirve de debounce.",
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
      question: "Un diseñador pide un rectángulo azul de 200×100 con el texto centrado. Este código muestra solo un rectángulo azul chico alrededor del texto. ¿Por qué?",
      code: r`Text("Pagar")
    .background(.blue)
    .frame(width: 200, height: 100)`,
      options: [
        "`.frame` no funciona con `Text`",
        "El fondo se aplicó antes del `frame`: pinta solo el tamaño del texto; el frame agrega espacio transparente alrededor",
        "Falta `.resizable()`",
        "`.background` necesita `Color.blue`, no `.blue`",
      ],
      answer: 1,
      explanation: "Los modificadores se aplican en orden. `.background` pinta detrás del `Text` (tamaño justo) y después `.frame` crea un contenedor de 200×100 transparente que lo centra. Invirtiendo el orden (`.frame(...)` y luego `.background(.blue)`) el azul ocupa los 200×100.",
    },
    {
      id: "ex-state-owner",
      question: "En una pantalla de login, ¿cómo declarás el texto del campo email, que solo usa esa vista?",
      options: [
        "`@Binding var email: String`",
        "`@ObservedObject var email = \"\"`",
        "`@State private var email = \"\"`",
        "`var email = \"\"` (una propiedad común alcanza)",
      ],
      answer: 2,
      explanation: "Es un valor simple que pertenece a la vista: `@State private`. `@Binding` sería si el dueño fuera otra vista. Una `var` común no se puede mutar desde `body` ni sobrevive a los re-renders, y `@ObservedObject` es solo para clases `ObservableObject`.",
    },
    {
      id: "ex-binding",
      question: "Una vista `FilterChip` tiene que prender y apagar un filtro cuyo estado vive en la pantalla padre. ¿Qué recibe `FilterChip`?",
      options: [
        "`@Binding var isOn: Bool`, y el padre le pasa `$isOn`",
        "`@State var isOn: Bool`, y el padre le pasa `isOn`",
        "`let isOn: Bool`, y el padre le pasa `isOn`",
        "`@AppStorage(\"isOn\") var isOn = false`",
      ],
      answer: 0,
      explanation: "El dato tiene un solo dueño (el padre) y el hijo necesita escribirlo: `@Binding`. Con `@State` el hijo tendría su propia copia y el padre no se enteraría; con `let` no podría modificarlo; `@AppStorage` lo persistiría globalmente, que no es lo pedido.",
    },
    {
      id: "ex-observable-owner",
      question: "Tu app apunta a iOS 17+. `FeedScreen` crea su `FeedViewModel`, marcado con `@Observable`. ¿Cómo lo declara?",
      options: [
        "`@StateObject private var vm = FeedViewModel()`",
        "`@ObservedObject var vm = FeedViewModel()`",
        "`let vm = FeedViewModel()`",
        "`@State private var vm = FeedViewModel()`",
      ],
      answer: 3,
      explanation: "Con `@Observable` el dueño usa `@State`, que conserva la instancia entre renders. `@StateObject`/`@ObservedObject` son para `ObservableObject`. Con `let`, se crearía un `FeedViewModel` nuevo cada vez que el struct se reconstruye.",
    },
    {
      id: "ex-legacy-owner",
      question: "La app todavía soporta iOS 16. `SettingsScreen` crea su `SettingsViewModel: ObservableObject`. ¿Qué wrapper usa?",
      options: [
        "`@ObservedObject`",
        "`@EnvironmentObject`",
        "`@StateObject`",
        "`@Bindable`",
      ],
      answer: 2,
      explanation: "Antes de Observation, el dueño de un `ObservableObject` usa `@StateObject` para que SwiftUI lo cree una vez y lo conserve. `@ObservedObject` es para objetos recibidos; `@EnvironmentObject` para leer uno inyectado; `@Bindable` es de iOS 17 y funciona con `@Observable`.",
    },
    {
      id: "ex-reset-bug",
      question: "QA reporta: \"el contador del carrito vuelve a 0 cada vez que cambio el tema\". ¿Cuál es la causa más probable?",
      code: r`struct CartBadge: View {
    @ObservedObject var vm = CartBadgeViewModel()
    var body: some View { Text("\(vm.count)") }
}`,
      options: [
        "`CartBadgeViewModel` no es `Sendable`",
        "`@ObservedObject` con el objeto creado inline: cuando el padre se redibuja se crea un ViewModel nuevo",
        "Falta `@MainActor` en `count`",
        "`Text` no se actualiza con interpolación",
      ],
      answer: 1,
      explanation: "Cambiar el tema hace que el padre recalcule su `body` y reconstruya `CartBadge`, lo que ejecuta `CartBadgeViewModel()` de nuevo. `@ObservedObject` no retiene la instancia previa. Solución: `@StateObject` (o `@Observable` + `@State`), o recibir el ViewModel desde un dueño estable.",
    },
    {
      id: "ex-task-load",
      question: "La pantalla de perfil carga datos con `async/await` al aparecer. Si el usuario vuelve atrás antes de que termine, la carga tiene que cancelarse. ¿Qué usás?",
      options: [
        "`.task { await vm.load() }`",
        "`.onAppear { Task { await vm.load() } }`",
        "`init() { Task { await vm.load() } }`",
        "`.onAppear { DispatchQueue.main.async { vm.load() } }`",
      ],
      answer: 0,
      explanation: "`.task` ata la tarea al ciclo de vida de la vista y la cancela cuando desaparece. Un `Task { }` creado en `onAppear` o en `init` no se cancela solo (y el `init` de una vista puede correr muchas veces). `DispatchQueue` ni siquiera es `async/await`.",
    },
    {
      id: "ex-task-id",
      question: "Una pantalla de detalle recibe `productID` y el iPad muestra lista + detalle a la vez: al elegir otro producto, la vista de detalle no desaparece. ¿Cómo hacés que recargue?",
      options: [
        "`.onAppear { Task { await load() } }`",
        "`.task(id: productID) { await load() }`",
        "`.task { await load() }`",
        "`.refreshable { await load() }`",
      ],
      answer: 1,
      explanation: "Si la vista no desaparece, ni `.task` ni `.onAppear` vuelven a ejecutarse. `.task(id: productID)` cancela la carga anterior y arranca una nueva cada vez que cambia el id. `.refreshable` es solo para pull-to-refresh.",
    },
    {
      id: "ex-foreach-id",
      question: "Una lista de nombres usa `ForEach(names, id: \\.self)`. Cuando hay dos personas llamadas \"Ana\", las filas se animan raro y una muestra datos de la otra. ¿Cuál es el arreglo correcto?",
      options: [
        "Usar `id: \\.offset` con `enumerated()`",
        "Ordenar `names` antes de mostrarlos",
        "Envolver el `ForEach` en un `LazyVStack`",
        "Pasar a un modelo `Identifiable` con un `id` propio y estable (por ejemplo el id del backend)",
      ],
      answer: 3,
      explanation: "`id: \\.self` usa el valor como identidad: dos \"Ana\" tienen el mismo id y SwiftUI no puede distinguirlas. La posición (`\\.offset`) tampoco es estable al insertar o borrar. La identidad tiene que salir del dato: un `Identifiable` con id único.",
    },
    {
      id: "ex-pop-root",
      question: "Al terminar un checkout de tres pantallas querés volver a la lista de productos. El stack es `NavigationStack(path: $path)` con `path: [Route]`. ¿Qué hacés?",
      options: [
        "`path.removeLast()`",
        "`dismiss()` tres veces",
        "`path.removeAll()`",
        "Crear un `NavigationStack` nuevo",
      ],
      answer: 2,
      explanation: "El stack refleja `path`: vaciarlo con `removeAll()` deja solo la raíz. `removeLast()` vuelve una sola pantalla y llamar `dismiss()` varias veces seguidas no es confiable.",
    },
    {
      id: "ex-appstorage",
      question: "¿Qué dato **no** deberías guardar con `@AppStorage`?",
      options: [
        "El token de acceso del usuario",
        "Si el usuario prefiere la vista en grilla o en lista",
        "El último filtro elegido en la pantalla de búsqueda",
        "Si ya se mostró el onboarding",
      ],
      answer: 0,
      explanation: "`@AppStorage` escribe en `UserDefaults`, que es un plist sin cifrar. Sirve para preferencias chicas y no sensibles. Tokens, contraseñas y secretos van al Keychain.",
    },
    {
      id: "ex-environment-store",
      question: "Varias pantallas profundas necesitan el mismo `SessionStore` (`@Observable`) que crea la raíz. ¿Cuál es la forma idiomática en iOS 17?",
      options: [
        "Cada pantalla crea su `@State private var session = SessionStore()`",
        "`.environmentObject(session)` en la raíz y `@EnvironmentObject` en las pantallas",
        "Un singleton global `SessionStore.shared` leído con `let`",
        "`.environment(session)` en la raíz y `@Environment(SessionStore.self) private var session` donde se use",
      ],
      answer: 3,
      explanation: "Con Observation el modelo se inyecta con `.environment(_:)` y se lee con `@Environment(Tipo.self)`. Crear uno por pantalla rompe la fuente única de verdad. `.environmentObject` es la versión para `ObservableObject`, y un singleton complica los tests y las previews.",
    },
  ],
};

export default content;
