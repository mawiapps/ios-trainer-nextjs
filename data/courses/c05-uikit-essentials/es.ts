import type { CourseContent } from "../types";

// Código Swift literal: String.raw conserva `\(` de la interpolación sin escapar.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "vc-lifecycle",
      title: "Ciclo de vida de la app y del view controller",
      goal: "Saber qué método llama UIKit, en qué orden y qué código va en cada uno.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "AppDelegate y SceneDelegate",
          body: [
            "`AppDelegate` maneja eventos de **proceso**: arranque (`application(_:didFinishLaunchingWithOptions:)`), push notifications, configuración global. Desde iOS 13, la UI vive en **escenas**: cada ventana (en iPad puede haber varias) tiene su `SceneDelegate`.",
            "En una app sin storyboard, el `SceneDelegate` crea la `UIWindow`, le asigna el `rootViewController` y la muestra con `makeKeyAndVisible()`. Si te olvidás de ese último paso, la app arranca con la pantalla negra.",
            "Para sacar el storyboard: borrá `Main.storyboard`, quitá `UISceneStoryboardFile` del `Info.plist` y armá la ventana a mano como en el ejemplo.",
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
          prompt: "La app arranca con la pantalla negra. Completá la línea que falta para mostrar la ventana.",
          code: swift`let window = UIWindow(windowScene: windowScene)
window.rootViewController = HomeViewController()
window.____()
self.window = window`,
          accept: ["^makeKeyAndVisible$", "^makeKeyAndVisible\\(\\)$"],
          explanation: "`makeKeyAndVisible()` convierte la ventana en la principal y la muestra. Sin esa llamada la ventana existe pero no se ve.",
          placeholder: "make...",
        },
        {
          kind: "explain",
          title: "El orden de aparición",
          body: [
            "La primera vez que un view controller se muestra, UIKit llama: `loadView` → `viewDidLoad` → `viewWillAppear` → `viewWillLayoutSubviews` → `viewDidLayoutSubviews` → `viewDidAppear`.",
            "`viewDidLoad` corre **una sola vez** por instancia. `viewWillAppear`/`viewDidAppear` corren **cada vez** que la pantalla vuelve a verse (por ejemplo, al volver de un push). Los métodos de layout pueden correr muchas veces (rotación, teclado, cambios de tamaño), por eso no los imprimimos en el ejemplo.",
            "Siempre llamá a `super` en cada override. Y la vista se carga **de forma perezosa**: la primera vez que alguien accede a `vc.view`, UIKit ejecuta `loadView` y `viewDidLoad` en ese momento.",
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
          prompt: "Con el `ProfileViewController` de arriba, ¿qué se imprime al correr esto (sin presentarlo)?",
          code: swift`let vc = ProfileViewController()
print("creado")
vc.view.backgroundColor = .systemBackground
print("configurado")`,
          options: [
            "viewDidLoad → creado → configurado",
            "creado → configurado (viewDidLoad espera a que se presente)",
            "creado → viewDidLoad → configurado",
            "creado → viewDidLoad → viewWillAppear → configurado",
          ],
          answer: 2,
          explanation: "El `init` no carga la vista. Al acceder a `vc.view` por primera vez, UIKit llama a `loadView` y después a `viewDidLoad`, en ese mismo momento. `viewWillAppear` recién corre cuando el controller va a mostrarse en pantalla, cosa que acá nunca pasa.",
        },
        {
          kind: "explain",
          title: "Qué va en cada método",
          body: [
            "`viewDidLoad`: setup de una sola vez: crear subviews, constraints, configurar la tabla, arrancar la primera carga de datos.",
            "`viewWillAppear`: refrescar lo que pudo cambiar mientras no estabas (un favorito marcado en otra pantalla). `viewDidLayoutSubviews`: lo que depende del tamaño final, como un `cornerRadius` igual a la mitad del alto. `viewDidAppear`: animaciones, analytics de \"pantalla vista\", reproducir video.",
            "`viewWillDisappear`/`viewDidDisappear`: frenar lo que no tiene sentido fuera de pantalla (timers, video, observers). Desde iOS 17 también existe `viewIsAppearing`, que corre entre `viewWillAppear` y `viewDidAppear` con el tamaño de la vista ya resuelto.",
          ],
          code: swift`override func viewDidLoad() {
    super.viewDidLoad()
    setupViews()          // una vez
    viewModel.load()
}

override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    refreshFavorites()    // cada vez que vuelve a verse
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
          prompt: "El usuario está en A, entra a B con push y después toca \"Atrás\". Al volver, ¿qué métodos de A se ejecutan?",
          code: swift`// A
navigationController?.pushViewController(B(), animated: true)
// ... el usuario toca "Atrás" en B`,
          options: [
            "`init`, `viewDidLoad`, `viewWillAppear` y `viewDidAppear`",
            "`viewDidLoad` y `viewWillAppear`",
            "Ninguno: A nunca dejó de existir",
            "`viewWillAppear` y `viewDidAppear`",
          ],
          answer: 3,
          explanation: "A sigue en la pila del navigation controller con su vista cargada, así que `viewDidLoad` no vuelve a correr. Como A vuelve a verse, UIKit llama a `viewWillAppear` y `viewDidAppear`. Por eso el refresco de datos va en `viewWillAppear`.",
        },
        {
          kind: "explain",
          title: "`deinit` y los ciclos de retención",
          body: [
            "Cuando hacés pop de un controller, la pila lo suelta y, si nadie más lo retiene, se libera y corre `deinit`. Poner un `print` en `deinit` es la forma más rápida de detectar una fuga en un PR.",
            "El caso clásico: el controller retiene a su view model, el view model retiene un closure, y el closure captura `self` fuerte. Es un ciclo y ninguno se libera. La solución es `[weak self]` en el closure.",
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
        print("ProfileViewController liberado")
    }
}`,
          output: "ProfileViewController liberado",
        },
        {
          kind: "predict",
          prompt: "Alguien sacó el `[weak self]`. El usuario abre el perfil y vuelve atrás. ¿Qué pasa con el `print` de `deinit`?",
          code: swift`viewModel.onNameChange = { name in
    self.title = name
}`,
          options: [
            "Se imprime al hacer pop, como antes",
            "Nunca se imprime: controller → viewModel → closure → controller forman un ciclo",
            "La app crashea al hacer pop",
            "Se imprime recién cuando el sistema manda una advertencia de memoria",
          ],
          answer: 1,
          explanation: "El controller retiene `viewModel`, que retiene el closure, que captura `self` fuerte. Al hacer pop el navigation controller suelta su referencia, pero el ciclo se sostiene solo: el controller queda vivo para siempre y `deinit` no corre.",
        },
        {
          kind: "write",
          prompt: "Escribí `SettingsViewController`: en `viewDidLoad` poné fondo `.systemBackground` y título \"Ajustes\"; en `viewWillAppear` llamá a `refreshData()` para que los datos se actualicen cada vez que la pantalla vuelve a verse. Llamá a `super` en ambos.",
          starter: swift`final class SettingsViewController: UIViewController {
    // overrides acá

    private func refreshData() { }
}`,
          checks: [
            { pattern: "override\\s+func\\s+viewDidLoad\\(\\)", label: "override de `viewDidLoad()`" },
            { pattern: "super\\.viewDidLoad\\(\\)", label: "llama a `super.viewDidLoad()`" },
            { pattern: "override\\s+func\\s+viewWillAppear\\(_\\s+animated:\\s*Bool\\)", label: "override de `viewWillAppear(_:)`" },
            { pattern: "super\\.viewWillAppear\\(animated\\)", label: "llama a `super.viewWillAppear(animated)`" },
            { pattern: "^\\s*refreshData\\(\\)", label: "llama a `refreshData()`" },
            { pattern: "view\\.backgroundColor\\s*=\\s*\\.systemBackground", label: "fondo `.systemBackground`" },
          ],
          warnings: [
            { pattern: "super\\.viewWillAppear\\((true|false)\\)", label: "Pasale a `super` el `animated` que recibiste, no una constante" },
            { pattern: "override\\s+func\\s+loadView", label: "No hace falta `loadView` para esto" },
          ],
          solution: swift`final class SettingsViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = "Ajustes"
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refreshData()
    }

    private func refreshData() { }
}`,
          hint: "La firma es `override func viewWillAppear(_ animated: Bool)`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "auto-layout",
      title: "Auto Layout en código",
      goal: "Armar pantallas con anchors y stack views, y entender prioridades y logs de conflictos.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Anchors y `NSLayoutConstraint.activate`",
          body: [
            "Cada vista que posicionás con constraints necesita `translatesAutoresizingMaskIntoConstraints = false`. Si no, UIKit genera constraints automáticas a partir de su `frame` que chocan con las tuyas.",
            "El orden importa: primero `addSubview`, después activar. Las constraints se activan juntas con `NSLayoutConstraint.activate([...])`, que es más eficiente y legible que poner `isActive = true` una por una.",
            "Usá `leading`/`trailing` en vez de `left`/`right`: se invierten solos en idiomas de derecha a izquierda. Y anclá arriba al `safeAreaLayoutGuide` para no quedar debajo del notch o de la barra de navegación.",
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
          prompt: "Completá la propiedad para que `avatarView` no genere constraints automáticas a partir de su frame.",
          code: swift`let avatarView = UIImageView()
avatarView.____ = false
view.addSubview(avatarView)`,
          accept: ["^translatesAutoresizingMaskIntoConstraints$"],
          explanation: "`translatesAutoresizingMaskIntoConstraints = false` desactiva la traducción del autoresizing mask a constraints. Las vistas que crea Interface Builder ya vienen así; las que creás en código, no.",
          placeholder: "translates...",
        },
        {
          kind: "predict",
          prompt: "¿Qué pasa al ejecutar esto?",
          code: swift`let badge = UILabel()
badge.translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    badge.centerXAnchor.constraint(equalTo: view.centerXAnchor)
])
view.addSubview(badge)`,
          options: [
            "Funciona igual: el orden no importa",
            "El badge queda en (0, 0) sin error",
            "Crash: la constraint relaciona dos vistas sin ancestro en común",
            "Solo un warning en consola y la constraint se ignora",
          ],
          answer: 2,
          explanation: "Al activar, `badge` todavía no está en la jerarquía, así que no comparte ancestro con `view`. UIKit lanza una excepción (\"because they have no common ancestor\"). Siempre `addSubview` antes de activar.",
        },
        {
          kind: "explain",
          title: "`UIStackView`",
          body: [
            "Una stack view acomoda sus `arrangedSubviews` en fila o columna y genera las constraints por vos. Configurás `axis`, `spacing`, `alignment` y `distribution`, y solo le ponés constraints a la stack.",
            "Las vistas se agregan con `addArrangedSubview`, no con `addSubview`. Un detalle muy útil: si ponés `isHidden = true` en una arranged subview, la stack la saca del layout y cierra el hueco.",
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

subtitleLabel.isHidden = true   // el botón sube; no queda hueco`,
        },
        {
          kind: "predict",
          prompt: "Un compañero agregó el precio así. ¿Qué ve el usuario?",
          code: swift`let stack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
stack.axis = .vertical
stack.addSubview(priceLabel)`,
          options: [
            "El precio aparece debajo del subtítulo",
            "El precio no forma parte del layout de la stack: queda arriba a la izquierda, sin constraints",
            "No compila: `UIStackView` no tiene `addSubview`",
            "Crash por constraints insatisfacibles",
          ],
          answer: 1,
          explanation: "`addSubview` lo agrega a la jerarquía pero no a `arrangedSubviews`, así que la stack no lo posiciona. Sin constraints propias queda en su frame inicial (`.zero`). Para que la stack lo acomode hay que usar `addArrangedSubview`.",
        },
        {
          kind: "explain",
          title: "Prioridades, hugging y compression resistance",
          body: [
            "Cada constraint tiene prioridad de 1 a 1000. `.required` (1000) se cumple sí o sí; con menos (por ejemplo `.defaultHigh`, 750) es opcional: Auto Layout intenta cumplirla pero la rompe si choca con otra más fuerte.",
            "Las vistas con tamaño intrínseco (labels, botones) tienen dos prioridades más por eje. **Content hugging**: cuánto se resiste a crecer más que su contenido (por defecto 250 en código). **Compression resistance**: cuánto se resiste a achicarse y truncarse (por defecto 750).",
            "Caso típico: nombre y precio en la misma fila. El precio nunca se tiene que truncar, así que le subís la compression resistance; y para que no se estire, le subís el hugging.",
          ],
          code: swift`// [ nombre larguísimo del producto…    $ 1.299 ]
priceLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
priceLabel.setContentHuggingPriority(.defaultHigh, for: .horizontal)

// Constraint opcional: en pantallas angostas cede
let preferredWidth = card.widthAnchor.constraint(equalToConstant: 400)
preferredWidth.priority = .defaultHigh
preferredWidth.isActive = true`,
        },
        {
          kind: "predict",
          prompt: "`nameLabel` y `priceLabel` están uno al lado del otro, con prioridades por defecto, y el nombre es larguísimo. ¿Cuál se trunca?",
          code: swift`NSLayoutConstraint.activate([
    nameLabel.leadingAnchor.constraint(equalTo: row.leadingAnchor),
    priceLabel.leadingAnchor.constraint(equalTo: nameLabel.trailingAnchor, constant: 8),
    priceLabel.trailingAnchor.constraint(equalTo: row.trailingAnchor)
])`,
          options: [
            "Siempre el nombre, porque está primero",
            "Siempre el precio, porque está último",
            "Ninguno: la fila se agranda",
            "No está definido: los dos tienen 750 de compression resistance; hay que desempatar a mano",
          ],
          answer: 3,
          explanation: "Con prioridades iguales el layout es ambiguo y Auto Layout elige uno sin garantías (puede cambiar entre versiones de iOS). La solución es explícita: subirle la compression resistance horizontal a `priceLabel`.",
        },
        {
          kind: "explain",
          title: "Leer \"Unable to simultaneously satisfy constraints\"",
          body: [
            "Cuando dos constraints `required` se contradicen, UIKit imprime este log, rompe una y sigue. No crashea, pero el layout queda en un estado que no elegiste.",
            "Leelo así: buscá en la lista las constraints que no esperabas. `NSAutoresizingMaskLayoutConstraint` casi siempre significa que te olvidaste `translatesAutoresizingMaskIntoConstraints = false`. Para que el log sea legible, poné `accessibilityIdentifier` a las vistas o `identifier` a las constraints.",
            "Para pararte en el momento exacto, agregá un breakpoint simbólico en `UIViewAlertForUnsatisfiableConstraints`.",
          ],
          code: swift`[LayoutConstraints] Unable to simultaneously satisfy constraints.
    Probably at least one of the constraints in the following list is one you don't want.
(
    "<NSAutoresizingMaskLayoutConstraint:0x6000... h=--& v=--& UILabel:0x7f9...'Hola'.minX == 0   (active)>",
    "<NSLayoutConstraint:0x6000... UILabel:0x7f9...'Hola'.leading == UIView:0x7f9....leading + 16   (active)>"
)

Will attempt to recover by breaking constraint
<NSLayoutConstraint:0x6000... UILabel:0x7f9...'Hola'.leading == UIView:0x7f9....leading + 16   (active)>

Make a symbolic breakpoint at UIViewAlertForUnsatisfiableConstraints to catch this in the debugger.`,
        },
        {
          kind: "predict",
          prompt: "Te llega este log en un bug report. ¿Cuál es la causa más probable?",
          code: swift`"<NSAutoresizingMaskLayoutConstraint:0x6000... h=--& v=--& UIImageView:0x7f9....height == 0   (active)>",
"<NSLayoutConstraint:0x6000... UIImageView:0x7f9....height == 48   (active)>"`,
          options: [
            "Falta `translatesAutoresizingMaskIntoConstraints = false` en la image view",
            "La imagen no terminó de descargarse",
            "Falta llamar a `layoutIfNeeded()`",
            "La constraint de alto tiene prioridad baja",
          ],
          answer: 0,
          explanation: "`NSAutoresizingMaskLayoutConstraint` es la constraint que UIKit genera desde el frame (acá alto 0) cuando la vista tiene `translatesAutoresizingMaskIntoConstraints = true`. Choca con tu `height == 48`. Ponelo en `false`.",
        },
        {
          kind: "write",
          prompt: "Agregá `cardView` a `view` y posicionala: arriba a 16 pt del safe area, 16 pt de margen a cada lado (leading/trailing) y alto fijo de 120. Usá `NSLayoutConstraint.activate`.",
          starter: swift`let cardView = UIView()
cardView.backgroundColor = .secondarySystemBackground
// tu código`,
          checks: [
            { pattern: "cardView\\.translatesAutoresizingMaskIntoConstraints\\s*=\\s*false", label: "desactiva `translatesAutoresizingMaskIntoConstraints`" },
            { pattern: "view\\.addSubview\\(cardView\\)", label: "agrega la card con `addSubview`" },
            { pattern: "NSLayoutConstraint\\.activate\\(", label: "usa `NSLayoutConstraint.activate`" },
            { pattern: "topAnchor\\.constraint\\(equalTo:\\s*view\\.safeAreaLayoutGuide\\.topAnchor", label: "ancla arriba al safe area" },
            { pattern: "leadingAnchor\\.constraint\\(", label: "constraint de leading" },
            { pattern: "trailingAnchor\\.constraint\\(", label: "constraint de trailing" },
            { pattern: "heightAnchor\\.constraint\\(equalToConstant:\\s*120\\)", label: "alto de 120" },
          ],
          warnings: [
            { pattern: "\\b(leftAnchor|rightAnchor)\\b", label: "Usá `leading`/`trailing` para soportar idiomas RTL" },
            { pattern: "trailingAnchor,\\s*constant:\\s*16\\)", label: "El trailing hacia el borde del padre va con constante negativa (`-16`)" },
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
          hint: "`cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16)`: el trailing va en negativo.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "table-views",
      title: "Table views",
      goal: "Mostrar listas con `UITableView`, entender el reuso de celdas y evitar sus bugs clásicos.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Data source y delegate",
          body: [
            "`UITableView` le pregunta los datos a su `dataSource` (cuántas filas, qué celda en cada fila) y le avisa eventos a su `delegate` (selección, alto, swipe actions). Ambos suelen ser el view controller. Si en el ejemplo tocás la segunda fila, se imprime lo de abajo.",
            "Las celdas se **registran** una vez con un identificador y se piden con `dequeueReusableCell(withIdentifier:for:)`. Para celdas simples, `defaultContentConfiguration()` (iOS 14) te da texto, subtítulo e imagen sin crear una subclase.",
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
        print("Tocaste \(contacts[indexPath.row])")
    }
}`,
          output: "Tocaste Beto",
        },
        {
          kind: "fill",
          prompt: "Completá el método que pide una celda reusable ya registrada.",
          code: swift`let cell = tableView.____(withIdentifier: "ContactCell", for: indexPath)`,
          accept: ["^dequeueReusableCell$"],
          explanation: "`dequeueReusableCell(withIdentifier:for:)` devuelve una celda del pool de reuso (o crea una nueva) y nunca devuelve `nil` si el identificador está registrado.",
          placeholder: "dequeue...",
        },
        {
          kind: "predict",
          prompt: "Alguien borró la línea de `register` en `viewDidLoad`. ¿Qué pasa al mostrar la tabla?",
          code: swift`// tableView.register(UITableViewCell.self, forCellReuseIdentifier: "ContactCell")

let cell = tableView.dequeueReusableCell(withIdentifier: "ContactCell", for: indexPath)`,
          options: [
            "La tabla se ve vacía, sin error",
            "UIKit crea una `UITableViewCell` estándar automáticamente",
            "No compila",
            "Crash: no se puede hacer dequeue de un identificador que no está registrado",
          ],
          answer: 3,
          explanation: "La versión `withIdentifier:for:` exige que el identificador esté registrado (clase o nib, o prototipo en storyboard). Si no, lanza una excepción: \"unable to dequeue a cell with identifier ContactCell\".",
        },
        {
          kind: "explain",
          title: "Reuso de celdas y `prepareForReuse`",
          body: [
            "Con 1000 filas la tabla no crea 1000 celdas: crea las que entran en pantalla y unas pocas más. Cuando una celda sale por arriba, vuelve al pool y se reusa para la fila que entra por abajo **con todo el estado que tenía**.",
            "El bug clásico: la celda de la fila 3 empieza a descargar una imagen; el usuario scrollea, esa celda se reusa para la fila 40 y la descarga vieja termina después y pone la imagen de la fila 3. Resultado: imágenes equivocadas que parpadean.",
            "La solución: en `prepareForReuse` cancelá el trabajo pendiente y limpiá el estado visual; y en `configure` asigná **todas** las propiedades en todos los casos.",
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
          prompt: "Esta celda no tiene `prepareForReuse`. En la lista, solo el producto 2 es favorito. ¿Qué ve el usuario después de scrollear un rato?",
          code: swift`func configure(with product: Product) {
    nameLabel.text = product.name
    if product.isFavorite {
        starView.isHidden = false
    }
}`,
          options: [
            "Solo el producto 2 tiene estrella",
            "Ningún producto tiene estrella",
            "Aparecen estrellas en productos que no son favoritos",
            "Crash al reusar la celda",
          ],
          answer: 2,
          explanation: "La celda que mostró el producto 2 quedó con `isHidden = false`. Cuando se reusa para otro producto, el `if` no entra y nadie la vuelve a ocultar. Solución: `starView.isHidden = !product.isFavorite` (asignar siempre) o resetear en `prepareForReuse`.",
        },
        {
          kind: "explain",
          title: "Celdas con alto automático",
          body: [
            "Para que cada celda tenga el alto de su contenido: subviews dentro de `contentView` (no de la celda), constraints de arriba a abajo sin huecos, labels con `numberOfLines = 0` y `rowHeight = UITableView.automaticDimension`.",
            "Si falta la constraint de abajo, Auto Layout no puede calcular el alto y la celda queda con el alto estimado o se pisa con la siguiente.",
          ],
          code: swift`tableView.rowHeight = UITableView.automaticDimension
tableView.estimatedRowHeight = 72

// En la celda
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
          prompt: "Completá para que las filas calculen su alto a partir de las constraints de la celda.",
          code: swift`tableView.rowHeight = UITableView.____`,
          accept: ["^automaticDimension$"],
          explanation: "`UITableView.automaticDimension` le dice a la tabla que use Auto Layout para calcular el alto de cada fila.",
          placeholder: "automatic...",
        },
        {
          kind: "explain",
          title: "Actualizar filas sin romper nada",
          body: [
            "`reloadData()` recarga todo sin animación: sirve, pero pierde la animación y el estado de selección. Para cambios puntuales usá `insertRows`, `deleteRows` o `reloadRows`.",
            "Regla de oro: **primero cambiás el modelo, después le avisás a la tabla**. La tabla verifica que el número de filas nuevo coincida con el viejo más/menos los cambios que le informaste.",
          ],
          code: swift`contacts.append("Diego")
let newRow = IndexPath(row: contacts.count - 1, section: 0)
tableView.insertRows(at: [newRow], with: .automatic)`,
        },
        {
          kind: "predict",
          prompt: "`contacts` tiene 3 elementos. ¿Qué pasa al ejecutar esto?",
          code: swift`tableView.insertRows(at: [IndexPath(row: 3, section: 0)], with: .automatic)
contacts.append("Diego")`,
          options: [
            "Crash: \"Invalid update: invalid number of rows in section 0\"",
            "Se inserta \"Diego\" con animación",
            "Se inserta una fila vacía y después aparece \"Diego\"",
            "No pasa nada hasta el próximo `reloadData()`",
          ],
          answer: 0,
          explanation: "Al llamar `insertRows`, la tabla pregunta `numberOfRowsInSection`: espera 4 (3 + 1 insertada) pero el modelo todavía tiene 3. Lanza `NSInternalInconsistencyException`. Primero el `append`, después el `insertRows`.",
        },
        {
          kind: "write",
          prompt: "Implementá `prepareForReuse` en `AvatarCell`: llamá a `super`, cancelá `loadTask`, poné `avatarView.image` en `nil` y ocultá `badgeLabel`.",
          starter: swift`final class AvatarCell: UITableViewCell {
    let avatarView = UIImageView()
    let badgeLabel = UILabel()
    var loadTask: Task<Void, Never>?

    // prepareForReuse acá
}`,
          checks: [
            { pattern: "override\\s+func\\s+prepareForReuse\\(\\)", label: "override de `prepareForReuse()`" },
            { pattern: "super\\.prepareForReuse\\(\\)", label: "llama a `super.prepareForReuse()`" },
            { pattern: "loadTask\\?\\.cancel\\(\\)", label: "cancela `loadTask`" },
            { pattern: "avatarView\\.image\\s*=\\s*nil", label: "limpia la imagen" },
            { pattern: "badgeLabel\\.isHidden\\s*=\\s*true", label: "oculta el badge" },
          ],
          warnings: [
            { pattern: "removeFromSuperview", label: "No destruyas subviews en `prepareForReuse`: solo reseteá su estado" },
            { pattern: "reloadData", label: "La celda no debería recargar la tabla" },
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
      title: "Colecciones modernas",
      goal: "Usar diffable data source, compositional layout y cell registrations como en una app actual.",
      minutes: 24,
      steps: [
        {
          kind: "explain",
          title: "Diffable data source y snapshots",
          body: [
            "En vez de implementar `numberOfItems`/`cellForItemAt` y sincronizar a mano, describís **cómo debería verse** la lista con un snapshot (secciones + identificadores) y lo aplicás. UIKit calcula la diferencia y anima inserts, deletes y moves.",
            "Los identificadores tienen que ser `Hashable` y **únicos**. Apple recomienda usar el `id` del modelo (no el struct entero): así un cambio de nombre no se interpreta como \"borrar uno e insertar otro\".",
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
          prompt: "Completá el método que le pasa el snapshot al data source para que actualice la colección.",
          code: swift`dataSource.____(snapshot, animatingDifferences: true)`,
          accept: ["^apply$"],
          explanation: "`apply(_:animatingDifferences:)` compara el snapshot nuevo con el actual y aplica solo las diferencias.",
          placeholder: "a...",
        },
        {
          kind: "predict",
          prompt: "La API devolvió una receta repetida. ¿Qué pasa?",
          code: swift`let ids = [pasta.id, soup.id, pasta.id]

var snapshot = NSDiffableDataSourceSnapshot<Section, Recipe.ID>()
snapshot.appendSections([.main])
snapshot.appendItems(ids)
dataSource.apply(snapshot)`,
          options: [
            "Muestra la pasta dos veces",
            "Ignora el duplicado y muestra dos celdas",
            "Crash en tiempo de ejecución: los identificadores del snapshot tienen que ser únicos",
            "No compila",
          ],
          answer: 2,
          explanation: "Diffable identifica cada celda por su identificador; si hay dos iguales no puede calcular la diferencia y lanza una excepción por identificadores no únicos. Deduplicá los datos antes de armar el snapshot.",
        },
        {
          kind: "explain",
          title: "Compositional layout: item, group, section",
          body: [
            "El layout se arma de adentro hacia afuera: un **item** (una celda) dentro de un **group** (una fila o columna de items) dentro de una **section**. Los tamaños se expresan como `.fractionalWidth`, `.absolute` o `.estimated`.",
            "`.fractionalWidth` del item es relativo al group que lo contiene. Para listas tipo tabla no armás nada a mano: `UICollectionViewCompositionalLayout.list(using:)` con una `UICollectionLayoutListConfiguration`.",
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

// Lista estilo Ajustes
let config = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
let listLayout = UICollectionViewCompositionalLayout.list(using: config)`,
        },
        {
          kind: "predict",
          prompt: "Cambiás el ancho del item del grid de arriba por este. ¿Cuántas columnas ves?",
          code: swift`let itemSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(0.25),
                                      heightDimension: .fractionalHeight(1.0))`,
          options: [
            "4 columnas: cada item ocupa un cuarto del group, que mide todo el ancho",
            "2 columnas, más angostas",
            "1 columna al 25% del ancho",
            "Depende del tamaño de la pantalla",
          ],
          answer: 0,
          explanation: "`.fractionalWidth(0.25)` es relativo al group, que tiene `.fractionalWidth(1.0)`. En un group horizontal entran 4 items de un cuarto cada uno.",
        },
        {
          kind: "explain",
          title: "Cell registration y content configuration",
          body: [
            "`UICollectionView.CellRegistration` reemplaza los identificadores en string: declarás el tipo de celda y el tipo de item, y un closure que la configura. En la celda usás `defaultContentConfiguration()` y le asignás texto, texto secundario e imagen.",
            "La registration se crea **fuera** del cell provider (por ejemplo en `viewDidLoad`). Crearla adentro genera una registración nueva por celda: desde iOS 15 UIKit lo detecta y lanza una excepción.",
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
          prompt: "Completá el método que pide una celda ya configurada a partir de una registration.",
          code: swift`return collectionView.____(using: registration, for: indexPath, item: recipe)`,
          accept: ["^dequeueConfiguredReusableCell$"],
          explanation: "`dequeueConfiguredReusableCell(using:for:item:)` hace el dequeue y ejecuta el closure de la registration con el item.",
          placeholder: "dequeue...",
        },
        {
          kind: "explain",
          title: "Actualizar un item: `reconfigureItems`",
          body: [
            "Si los identificadores son ids estables, cuando cambia el **contenido** de una receta el snapshot no cambia: hay que avisarle a diffable qué items volver a configurar.",
            "`reconfigureItems` (iOS 15) vuelve a correr la configuración sobre la celda existente: barato y sin parpadeo. `reloadItems` descarta la celda y pide una nueva; usalo solo si cambia el tipo de celda.",
          ],
          code: swift`recipesByID[id]?.name = "Pasta al pesto"

var snapshot = dataSource.snapshot()
snapshot.reconfigureItems([id])
dataSource.apply(snapshot, animatingDifferences: true)`,
        },
        {
          kind: "predict",
          prompt: "En otro proyecto, el identificador es el struct `Recipe` entero (Hashable por todos sus campos). Cambiás el nombre de una receta y aplicás un snapshot nuevo con el struct actualizado. ¿Qué interpreta diffable?",
          code: swift`var snapshot = NSDiffableDataSourceSnapshot<Section, Recipe>()
snapshot.appendSections([.main])
snapshot.appendItems(updatedRecipes)   // una tiene name distinto
dataSource.apply(snapshot, animatingDifferences: true)`,
          options: [
            "Que la receta cambió, y reconfigura su celda",
            "Nada: el orden es el mismo",
            "Un crash por identificador duplicado",
            "Que se borró un item y se insertó otro distinto: anima delete + insert",
          ],
          answer: 3,
          explanation: "Con el struct entero como identificador, cambiar `name` cambia el hash: para diffable es otro item. Anima una eliminación y una inserción (y pierde selección). Por eso conviene usar `Recipe.ID` como identificador.",
        },
        {
          kind: "write",
          prompt: "Escribí `applySnapshot(recipes:animated:)`: creá un snapshot con identificadores `Recipe.ID`, agregá la sección `.main`, los ids de las recetas y aplicalo respetando `animated`.",
          starter: swift`func applySnapshot(recipes: [Recipe], animated: Bool) {
    // tu código
}`,
          checks: [
            { pattern: "NSDiffableDataSourceSnapshot<Section,\\s*Recipe\\.ID>\\(\\)", label: "crea un `NSDiffableDataSourceSnapshot<Section, Recipe.ID>`" },
            { pattern: "appendSections\\(\\[\\.main\\]\\)", label: "agrega la sección `.main`" },
            { pattern: "appendItems\\(", label: "agrega los items" },
            { pattern: "\\.map\\s*(\\(\\\\\\.id\\)|\\{\\s*\\$0\\.id\\s*\\})", label: "usa los ids de las recetas" },
            { pattern: "apply\\(snapshot,\\s*animatingDifferences:\\s*animated\\)", label: "aplica con `animatingDifferences: animated`" },
          ],
          warnings: [
            { pattern: "reloadData\\(\\)", label: "Con diffable no llames `reloadData()`: aplicá un snapshot" },
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
      title: "Navegación y comunicación entre pantallas",
      goal: "Navegar con push, modales y tabs, y devolver datos con delegates y closures sin fugas.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Push y pop con `UINavigationController`",
          body: [
            "`UINavigationController` maneja una pila: `pushViewController` agrega una pantalla con animación lateral y botón \"Atrás\"; `popViewController` la saca.",
            "Pasá los datos por el `init` del controller de destino: queda explícito qué necesita y no puede quedar a medio configurar. Al definir tu propio `init`, UIKit te obliga a declarar `init?(coder:)`, que en apps sin storyboard se deja con `fatalError`.",
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

// En la lista
func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let detail = ProductDetailViewController(product: products[indexPath.row])
    navigationController?.pushViewController(detail, animated: true)
}`,
        },
        {
          kind: "predict",
          prompt: "En `SceneDelegate` pusieron `window.rootViewController = ProductListViewController()` (sin navigation controller). ¿Qué pasa al tocar una fila?",
          code: swift`let detail = ProductDetailViewController(product: product)
navigationController?.pushViewController(detail, animated: true)`,
          options: [
            "Crash por unwrap de `nil`",
            "Nada: `navigationController` es `nil` y el optional chaining no ejecuta el push",
            "Se presenta como modal",
            "UIKit crea un navigation controller automáticamente",
          ],
          answer: 1,
          explanation: "`navigationController` es opcional y es `nil` si el controller no está dentro de uno. Con `?.` la llamada simplemente no se ejecuta: no hay error ni log. Es un bug silencioso típico; la solución es envolver la raíz en `UINavigationController`.",
        },
        {
          kind: "explain",
          title: "Modales y sheets",
          body: [
            "`present(_:animated:)` muestra un controller encima; el presentado se cierra con `dismiss(animated:)`. Desde iOS 13 el estilo por defecto es una sheet (`.pageSheet`) que se cierra deslizando; con `.fullScreen` tapa todo.",
            "Si el modal necesita barra con \"Cancelar\"/\"Guardar\", presentá un `UINavigationController` que lo contenga. Con `sheetPresentationController` (iOS 15) elegís alturas: `.medium()` y `.large()`.",
            "Ojo: con una sheet, el controller de abajo sigue visible, así que **no** recibe `viewWillDisappear`/`viewWillAppear` al abrir y cerrar el modal.",
          ],
          code: swift`let editor = EditProfileViewController()
let nav = UINavigationController(rootViewController: editor)
if let sheet = nav.sheetPresentationController {
    sheet.detents = [.medium(), .large()]
}
present(nav, animated: true)

// Dentro de EditProfileViewController
dismiss(animated: true)`,
        },
        {
          kind: "predict",
          prompt: "`ProfileViewController` refresca los datos en `viewWillAppear`. Presenta el editor con el estilo por defecto, el usuario guarda y el editor hace `dismiss`. ¿Se refresca el perfil?",
          code: swift`let editor = EditProfileViewController()
present(editor, animated: true)   // .pageSheet por defecto`,
          options: [
            "Sí, `viewWillAppear` corre al cerrar cualquier modal",
            "Sí, pero solo si `animated` es `true`",
            "No: con la sheet el perfil nunca desapareció, así que `viewWillAppear` no corre",
            "No, porque `viewWillAppear` solo corre una vez por instancia",
          ],
          answer: 2,
          explanation: "Con `.pageSheet` el presentador sigue en pantalla detrás, así que UIKit no le manda los eventos de aparición. Para enterarte de que se guardó, usá un delegate o un closure (lo que sigue), no el ciclo de vida.",
        },
        {
          kind: "explain",
          title: "`UITabBarController`",
          body: [
            "Un tab bar tiene un array de `viewControllers`, uno por pestaña. Lo habitual es que **cada pestaña tenga su propio** `UINavigationController`: así cada una conserva su pila al cambiar de tab.",
            "El ícono y el título de cada pestaña salen del `tabBarItem` del controller raíz de esa pestaña (en este caso, el navigation controller).",
          ],
          code: swift`let products = UINavigationController(rootViewController: ProductListViewController())
products.tabBarItem = UITabBarItem(title: "Productos", image: UIImage(systemName: "list.bullet"), tag: 0)

let favorites = UINavigationController(rootViewController: FavoritesViewController())
favorites.tabBarItem = UITabBarItem(title: "Favoritos", image: UIImage(systemName: "star"), tag: 1)

let tabs = UITabBarController()
tabs.viewControllers = [products, favorites]
window.rootViewController = tabs`,
        },
        {
          kind: "explain",
          title: "Devolver datos: delegate, closure y target-action",
          body: [
            "**Delegate**: un protocolo `AnyObject` y una propiedad `weak var delegate`. El `weak` evita el ciclo: el padre retiene al hijo y el hijo apunta al padre sin retenerlo. Como los view controllers son `@MainActor`, marcá el protocolo `@MainActor` para que Swift 6 acepte la conformidad.",
            "**Closure**: `var onSave: ((String) -> Void)?`. Más corto para un solo evento; el que lo asigna captura `[weak self]`.",
            "**Target-action**: así los controles avisan eventos: `addTarget(_:action:for:)` con un método `@objc`. Desde iOS 14 también podés usar `addAction(UIAction { ... }, for:)` con un closure.",
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
          prompt: "Completá la declaración para que el delegate no genere un ciclo de retención.",
          code: swift`____ var delegate: EditProfileViewControllerDelegate?`,
          accept: ["^weak$"],
          explanation: "`weak` no retiene al delegate y se pone en `nil` solo cuando este se libera. Por eso el protocolo tiene que ser `AnyObject`: `weak` solo aplica a clases.",
          placeholder: "w...",
        },
        {
          kind: "predict",
          prompt: "`ProfileViewController` guarda al editor en una propiedad y el editor declara `var delegate` **sin** `weak`. El usuario sale del perfil. ¿Qué pasa?",
          code: swift`final class ProfileViewController: UIViewController, EditProfileViewControllerDelegate {
    private let editor = EditProfileViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        editor.delegate = self
    }
    deinit { print("perfil liberado") }
}`,
          options: [
            "Se imprime \"perfil liberado\"",
            "Crash al acceder al delegate",
            "No compila sin `weak`",
            "Ninguno de los dos se libera: perfil → editor → delegate (perfil) es un ciclo",
          ],
          answer: 3,
          explanation: "El perfil retiene al editor (`let editor`) y el editor retiene al perfil (`delegate` fuerte). Ninguno llega a cero referencias y `deinit` nunca corre. Compila igual: Swift no exige `weak`, por eso es un bug que hay que buscar en code review.",
        },
        {
          kind: "fill",
          prompt: "Completá para conectar el botón con el método `@objc saveTapped`.",
          code: swift`saveButton.addTarget(self, action: ____(saveTapped), for: .touchUpInside)`,
          accept: ["^#selector$"],
          explanation: "`#selector(saveTapped)` crea el selector de Objective-C que el botón llama en el evento indicado. El método tiene que estar marcado `@objc`.",
          placeholder: "#...",
        },
        {
          kind: "write",
          prompt: "En `ColorPickerViewController` declará `var onPick: ((UIColor) -> Void)?` y, en `didSelect(_:)`, llamalo y hacé pop. En `ThemeViewController.openPicker()` creá el picker, asigná `onPick` con `[weak self]` para cambiar `view.backgroundColor` y hacé push.",
          starter: swift`final class ColorPickerViewController: UIViewController {
    func didSelect(_ color: UIColor) {
    }
}

final class ThemeViewController: UIViewController {
    func openPicker() {
    }
}`,
          checks: [
            { pattern: "var\\s+onPick:\\s*\\(\\(UIColor\\)\\s*->\\s*Void\\)\\?", label: "declara `var onPick: ((UIColor) -> Void)?`" },
            { pattern: "onPick\\?\\(color\\)", label: "llama a `onPick?(color)`" },
            { pattern: "popViewController\\(animated:\\s*true\\)", label: "hace pop" },
            { pattern: "onPick\\s*=\\s*\\{\\s*\\[weak self\\]", label: "captura `[weak self]` al asignar `onPick`" },
            { pattern: "pushViewController\\(picker,\\s*animated:\\s*true\\)", label: "hace push del picker" },
          ],
          warnings: [
            { pattern: "onPick\\s*=\\s*\\{\\s*color\\s+in", label: "Sin `[weak self]` el closure retiene al controller" },
            { pattern: "unowned", label: "`unowned` crashea si el controller ya se liberó; preferí `weak`" },
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
      title: "Reto final: catálogo con favoritos en UIKit",
      goal: "Integrar ciclo de vida, Auto Layout, colecciones y navegación en una app de lista + detalle + favoritos.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Vas a armar en UIKit la misma app que hiciste en SwiftUI: un tab bar con dos pestañas, **Productos** y **Favoritos**, cada una con su navigation controller. La lista usa una collection view con layout de lista y diffable data source.",
            "Al tocar un producto se hace push del detalle, que tiene un botón de estrella para marcarlo como favorito. El detalle avisa a la lista con un delegate y la lista reconfigura solo esa celda. La pestaña Favoritos tiene que mostrar siempre el estado actual.",
            "El estado compartido vive en `FavoritesStore`, una clase que se inyecta por `init` en las pantallas que la necesitan.",
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
          prompt: "Armá el `SceneDelegate`: creá un `FavoritesStore`, dos `UINavigationController` (lista y favoritos, ambos reciben el store), cada uno con su `tabBarItem`, ponelos en un `UITabBarController` como root de la ventana y mostrala.",
          starter: swift`func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
           options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: windowScene)
    // tu código
    self.window = window
}`,
          checks: [
            { pattern: "FavoritesStore\\(\\)", label: "crea un `FavoritesStore`" },
            { pattern: "UINavigationController\\(rootViewController:\\s*ProductListViewController\\(", label: "navigation controller para la lista" },
            { pattern: "UINavigationController\\(rootViewController:\\s*FavoritesViewController\\(", label: "navigation controller para favoritos" },
            { pattern: "\\.tabBarItem\\s*=\\s*UITabBarItem\\(", label: "configura los `tabBarItem`" },
            { pattern: "\\.viewControllers\\s*=\\s*\\[", label: "asigna `viewControllers` al tab bar" },
            { pattern: "rootViewController\\s*=\\s*tabs", label: "el tab bar es la raíz de la ventana" },
            { pattern: "makeKeyAndVisible\\(\\)", label: "muestra la ventana" },
          ],
          warnings: [
            { pattern: "UINavigationController\\(rootViewController:\\s*tabs\\)", label: "El tab bar va afuera: cada pestaña tiene su propio navigation controller" },
          ],
          solution: swift`func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
           options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: windowScene)
    let store = FavoritesStore()

    let products = UINavigationController(rootViewController: ProductListViewController(store: store))
    products.tabBarItem = UITabBarItem(title: "Productos", image: UIImage(systemName: "list.bullet"), tag: 0)

    let favorites = UINavigationController(rootViewController: FavoritesViewController(store: store))
    favorites.tabBarItem = UITabBarItem(title: "Favoritos", image: UIImage(systemName: "star"), tag: 1)

    let tabs = UITabBarController()
    tabs.viewControllers = [products, favorites]
    window.rootViewController = tabs
    window.makeKeyAndVisible()
    self.window = window
}`,
        },
        {
          kind: "write",
          prompt: "En `ProductListViewController.viewDidLoad`, creá la collection view con layout de lista `.insetGrouped`, posicionala con constraints a los bordes de `view`, creá una `CellRegistration<UICollectionViewListCell, Product>` que muestre nombre y una estrella si es favorito, y el `UICollectionViewDiffableDataSource<Section, Product.ID>`.",
          starter: swift`final class ProductListViewController: UIViewController {
    private let store: FavoritesStore
    private var productsByID: [Product.ID: Product] = [:]
    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, Product.ID>!

    // init(store:) ya implementado

    override func viewDidLoad() {
        super.viewDidLoad()
        // tu código
    }
}`,
          checks: [
            { pattern: "UICollectionLayoutListConfiguration\\(appearance:\\s*\\.insetGrouped\\)", label: "configuración de lista `.insetGrouped`" },
            { pattern: "UICollectionViewCompositionalLayout\\.list\\(using:", label: "layout `.list(using:)`" },
            { pattern: "translatesAutoresizingMaskIntoConstraints\\s*=\\s*false", label: "desactiva el autoresizing mask" },
            { pattern: "UICollectionView\\.CellRegistration<UICollectionViewListCell,\\s*Product>", label: "cell registration tipada" },
            { pattern: "defaultContentConfiguration\\(\\)", label: "usa `defaultContentConfiguration()`" },
            { pattern: "UICollectionViewDiffableDataSource<Section,\\s*Product\\.ID>\\(collectionView:", label: "crea el diffable data source" },
            { pattern: "dequeueConfiguredReusableCell\\(using:\\s*registration", label: "hace dequeue con la registration" },
          ],
          warnings: [
            { pattern: "register\\(UICollectionViewCell\\.self", label: "Con `CellRegistration` no hace falta `register` con string" },
            { pattern: "\\{\\s*collectionView,\\s*indexPath,\\s*id\\s+in[\\s\\S]*CellRegistration", label: "Creá la registration fuera del cell provider" },
          ],
          solution: swift`override func viewDidLoad() {
    super.viewDidLoad()
    title = "Productos"

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
          hint: "Primero la registration, después el data source que la usa en su closure.",
        },
        {
          kind: "write",
          prompt: "Implementá el detalle: protocolo `ProductDetailViewControllerDelegate` (`@MainActor`, `AnyObject`) con `didToggleFavorite`, `weak var delegate`, un botón conectado con target-action a `starTapped` que hace `store.toggle` y avisa al delegate. Después, en la lista, implementá el método del delegate reconfigurando solo ese item.",
          starter: swift`final class ProductDetailViewController: UIViewController {
    private let product: Product
    private let store: FavoritesStore
    private let starButton = UIButton(configuration: .plain())

    // init(product:store:) ya implementado
}

extension ProductListViewController {
}`,
          checks: [
            { pattern: "protocol\\s+ProductDetailViewControllerDelegate:\\s*AnyObject", label: "protocolo `AnyObject`" },
            { pattern: "weak\\s+var\\s+delegate:\\s*ProductDetailViewControllerDelegate\\?", label: "`weak var delegate`" },
            { pattern: "addTarget\\(self,\\s*action:\\s*#selector\\(starTapped\\)", label: "target-action con `#selector(starTapped)`" },
            { pattern: "@objc\\s+(private\\s+)?func\\s+starTapped", label: "método `@objc starTapped`" },
            { pattern: "store\\.toggle\\(product\\.id\\)", label: "cambia el favorito en el store" },
            { pattern: "delegate\\?\\.", label: "avisa al delegate" },
            { pattern: "reconfigureItems\\(\\[", label: "reconfigura solo el item afectado" },
            { pattern: "dataSource\\.apply\\(snapshot", label: "aplica el snapshot" },
          ],
          warnings: [
            { pattern: "^\\s*var\\s+delegate", label: "El delegate sin `weak` genera un ciclo" },
            { pattern: "reloadData\\(\\)", label: "No recargues toda la colección por un item" },
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
          prompt: "`FavoritesViewController` carga la lista en `viewDidLoad`. El usuario abre Favoritos, vuelve a Productos, marca dos favoritos y vuelve a Favoritos. ¿Qué ve y cuál es el arreglo más simple?",
          code: swift`override func viewDidLoad() {
    super.viewDidLoad()
    setupCollectionView()
    applySnapshot(ids: Array(store.ids))
}`,
          options: [
            "Ve los favoritos nuevos: el tab bar recrea la pantalla",
            "Crash: el snapshot quedó desactualizado",
            "La lista vieja; hay que llamar a `applySnapshot` en `viewWillAppear`",
            "La lista vieja; hay que mover todo `viewDidLoad` a `init`",
          ],
          answer: 2,
          explanation: "Cambiar de pestaña no destruye el controller: `viewDidLoad` no vuelve a correr, pero `viewWillAppear` sí corre cada vez que la pestaña se muestra. Aplicar el snapshot ahí mantiene la lista al día (otra opción es observar el store).",
        },
      ],
    },
  ],

  flashcards: [
    { id: "fc-lifecycle-order", front: "¿En qué orden se llaman los métodos al mostrar un view controller por primera vez?", back: "`loadView` → `viewDidLoad` → `viewWillAppear` → `viewWillLayoutSubviews` → `viewDidLayoutSubviews` → `viewDidAppear`." },
    { id: "fc-viewdidload-once", front: "¿Cuántas veces corre `viewDidLoad`?", back: "Una vez por instancia, cuando se accede a `view` por primera vez. `viewWillAppear` corre cada vez que la pantalla vuelve a verse." },
    { id: "fc-scene-delegate", front: "¿Qué hace el `SceneDelegate` en una app sin storyboard?", back: "Crea la `UIWindow` con la `UIWindowScene`, le asigna `rootViewController` y llama a `makeKeyAndVisible()`." },
    { id: "fc-tamic", front: "¿Qué pasa si te olvidás `translatesAutoresizingMaskIntoConstraints = false`?", back: "UIKit genera `NSAutoresizingMaskLayoutConstraint` a partir del frame, que chocan con tus constraints: \"Unable to simultaneously satisfy constraints\".", code: "label.translatesAutoresizingMaskIntoConstraints = false" },
    { id: "fc-hugging-compression", front: "Content hugging vs compression resistance", back: "Hugging: resistencia a crecer más que el contenido (250 por defecto en código). Compression resistance: resistencia a achicarse y truncarse (750 por defecto)." },
    { id: "fc-priority", front: "¿Qué significa una constraint con prioridad 750?", back: "Es opcional: Auto Layout intenta cumplirla pero la rompe si choca con una de prioridad mayor. Solo 1000 (`.required`) es obligatoria." },
    { id: "fc-unsatisfiable", front: "¿Cómo te parás en el debugger cuando hay constraints en conflicto?", back: "Breakpoint simbólico en `UIViewAlertForUnsatisfiableConstraints`." },
    { id: "fc-stack-hidden", front: "¿Qué pasa al ocultar una arranged subview de un `UIStackView`?", back: "La stack la saca del layout y cierra el hueco; no hace falta tocar constraints." },
    { id: "fc-prepare-reuse", front: "¿Para qué sirve `prepareForReuse`?", back: "Para resetear la celda antes de reusarla: cancelar descargas pendientes y limpiar imagen y estados. Además, `configure` tiene que asignar todas las propiedades siempre.", code: "override func prepareForReuse() {\n    super.prepareForReuse()\n    imageTask?.cancel()\n    imageView.image = nil\n}" },
    { id: "fc-insert-rows", front: "¿En qué orden actualizás modelo y tabla al insertar una fila?", back: "Primero el modelo, después `insertRows`. Al revés: \"Invalid update: invalid number of rows\"." },
    { id: "fc-diffable-ids", front: "¿Qué conviene usar como identificador en un diffable data source?", back: "El `id` estable del modelo (`Recipe.ID`), no el struct entero. Los cambios de contenido se avisan con `reconfigureItems`." },
    { id: "fc-compositional", front: "¿Cuáles son las piezas de un compositional layout?", back: "Item dentro de group dentro de section. Tamaños con `.fractionalWidth`, `.absolute` o `.estimated`; el item es relativo a su group." },
    { id: "fc-cell-registration", front: "¿Dónde se crea un `UICollectionView.CellRegistration`?", back: "Fuera del cell provider (por ejemplo en `viewDidLoad`). Adentro crea una registración por celda y desde iOS 15 lanza una excepción." },
    { id: "fc-weak-delegate", front: "¿Por qué el delegate es `weak` y el protocolo `AnyObject`?", back: "Porque el padre suele retener al hijo; si el hijo retiene al delegate (el padre) hay ciclo. `weak` solo aplica a clases, por eso `AnyObject`.", code: "weak var delegate: EditorDelegate?" },
    { id: "fc-sheet-lifecycle", front: "¿El presentador recibe `viewWillAppear` al cerrarse una sheet `.pageSheet`?", back: "No: nunca dejó de verse. Con `.fullScreen` sí. Para enterarte de un resultado usá delegate o closure." },
  ],

  exam: [
    {
      id: "ex-refresh-where",
      question: "La pantalla de carrito tiene que mostrar el total actualizado cada vez que el usuario vuelve a ella desde el detalle de un producto (push/pop). ¿Dónde recalculás el total?",
      options: ["`viewDidLoad`", "`init`", "`viewWillAppear`", "`deinit`"],
      answer: 2,
      explanation: "`viewDidLoad` corre una sola vez; al volver con pop, UIKit llama a `viewWillAppear` y `viewDidAppear` del carrito. `viewWillAppear` es el lugar para refrescar antes de que se vea.",
    },
    {
      id: "ex-corner-radius",
      question: "Querés un avatar circular cuyo tamaño depende de constraints. ¿Dónde ponés `layer.cornerRadius = bounds.height / 2`?",
      options: ["En `viewDidLoad`, justo después de crear la vista", "En `viewDidLayoutSubviews`", "En `init`", "En `viewWillAppear`"],
      answer: 1,
      explanation: "En `viewDidLoad` y `viewWillAppear` el layout todavía no se resolvió y `bounds` puede ser cero o el tamaño equivocado. En `viewDidLayoutSubviews` los frames ya son los finales (y se recalcula si cambian).",
    },
    {
      id: "ex-leak-review",
      question: "En un PR ves esto en un view controller. ¿Qué comentás?",
      code: "viewModel.onUpdate = { items in\n    self.items = items\n    self.tableView.reloadData()\n}",
      options: [
        "Nada, está bien",
        "Falta `DispatchQueue.main.async`",
        "Hay que usar `unowned self` siempre en closures",
        "Ciclo de retención: el controller retiene al view model, que retiene el closure que captura `self`; usar `[weak self]`",
      ],
      answer: 3,
      explanation: "controller → viewModel → closure → controller. Con `[weak self]` y `self?.` el controller se libera al salir de la pantalla. `unowned` crashea si el closure corre después de liberarse.",
    },
    {
      id: "ex-unsatisfiable",
      question: "El log muestra \"Unable to simultaneously satisfy constraints\" con una `NSAutoresizingMaskLayoutConstraint` de tu `headerView`. ¿Qué hacés primero?",
      options: [
        "Verificar que `headerView` tenga `translatesAutoresizingMaskIntoConstraints = false`",
        "Bajar la prioridad de todas las constraints a 999",
        "Llamar a `layoutIfNeeded()` en `viewDidLoad`",
        "Ignorarlo: UIKit lo resuelve solo",
      ],
      answer: 0,
      explanation: "Esa constraint la genera UIKit desde el frame cuando la propiedad está en `true`. Ponerla en `false` elimina el conflicto. Bajar prioridades a ciegas esconde el problema y el layout queda impredecible.",
    },
    {
      id: "ex-price-truncate",
      question: "En una fila con nombre y precio, el precio a veces aparece truncado (\"$ 1.2…\"). ¿Cuál es el arreglo correcto?",
      options: [
        "Darle ancho fijo al nombre",
        "Subir la compression resistance horizontal del precio a `.required`",
        "Bajar el content hugging del precio a 1",
        "Poner `numberOfLines = 0` en el precio",
      ],
      answer: 1,
      explanation: "Con compression resistance igual (750) en ambos labels, cuál se trunca es ambiguo. Subírsela al precio garantiza que el que cede es el nombre. Un ancho fijo rompe con Dynamic Type y otros idiomas.",
    },
    {
      id: "ex-wrong-image",
      question: "En una lista de usuarios, al scrollear rápido algunas filas muestran por un instante la foto de otro usuario. ¿Cuál es la causa y el arreglo?",
      options: [
        "La cache de imágenes está llena; hay que vaciarla",
        "Las celdas se reusan y descargas viejas terminan tarde; cancelar la tarea y limpiar la imagen en `prepareForReuse`",
        "Falta llamar a `reloadData()` después de cada descarga",
        "El `estimatedRowHeight` es incorrecto",
      ],
      answer: 1,
      explanation: "Una celda reusada todavía tiene en vuelo la descarga de su fila anterior. Cancelarla en `prepareForReuse` (o verificar que el id siga siendo el mismo antes de asignar) elimina la imagen equivocada.",
    },
    {
      id: "ex-insert-crash",
      question: "Crashlytics reporta `NSInternalInconsistencyException: Invalid update: invalid number of rows in section 0` justo después de agregar un comentario. ¿Qué buscás en el código?",
      options: [
        "Un `insertRows` llamado sin haber agregado antes el elemento al array del data source",
        "Una celda sin registrar",
        "Un `rowHeight` en cero",
        "Un delegate sin `weak`",
      ],
      answer: 0,
      explanation: "La tabla verifica que filas nuevas = filas viejas + inserciones − borrados. Si el modelo no se actualizó antes de `insertRows`, la cuenta no cierra y lanza la excepción.",
    },
    {
      id: "ex-diffable-rename",
      question: "Con `UICollectionViewDiffableDataSource<Section, Note>` (el struct entero como identificador), cada vez que el usuario edita el título de una nota la celda desaparece y vuelve a aparecer con animación. ¿Qué cambiás?",
      options: [
        "Aplicar el snapshot con `animatingDifferences: false` y listo",
        "Llamar a `reloadData()` en vez de aplicar el snapshot",
        "Usar `Note.ID` como identificador y avisar el cambio con `reconfigureItems`",
        "Hacer que `Note` sea una clase",
      ],
      answer: 2,
      explanation: "Al cambiar el título cambia el hash, así que diffable ve un delete + insert. Con un id estable el item es \"el mismo\" y `reconfigureItems` actualiza la celda existente sin parpadeo.",
    },
    {
      id: "ex-grid-columns",
      question: "En un compositional layout, el group es horizontal con `.fractionalWidth(1.0)` y el item tiene `.fractionalWidth(1.0 / 3.0)`. ¿Qué obtenés?",
      options: ["Una columna al 33%", "Tres columnas", "Una fila con scroll horizontal", "Depende del dispositivo"],
      answer: 1,
      explanation: "El ancho fraccional del item es relativo a su group. Un tercio de un group de ancho completo da tres items por fila, es decir, tres columnas.",
    },
    {
      id: "ex-push-nothing",
      question: "Al tocar una celda no pasa nada y no hay logs. El código hace `navigationController?.pushViewController(detail, animated: true)`. ¿Causa más probable?",
      options: [
        "El controller de la lista no está dentro de un `UINavigationController`",
        "Falta `animated: false`",
        "El detalle no implementa `viewDidLoad`",
        "Falta `present` antes del push",
      ],
      answer: 0,
      explanation: "Si no hay navigation controller, `navigationController` es `nil` y el optional chaining no ejecuta nada. Envolver la raíz (o la pestaña) en `UINavigationController` lo resuelve.",
    },
    {
      id: "ex-modal-refresh",
      question: "El perfil presenta un editor con el estilo por defecto. Después de guardar, el perfil no muestra el nombre nuevo aunque recarga en `viewWillAppear`. ¿Qué hacés?",
      options: [
        "Cambiar a `viewDidAppear`",
        "Llamar a `viewWillAppear` a mano desde el editor",
        "Recrear el perfil con push",
        "Avisar el guardado con un delegate `weak` o un closure y actualizar ahí",
      ],
      answer: 3,
      explanation: "Con `.pageSheet` el perfil nunca desaparece, así que no recibe eventos de aparición. Comunicar el resultado explícitamente (delegate o closure) es lo correcto; llamar métodos del ciclo de vida a mano no.",
    },
    {
      id: "ex-tab-nav",
      question: "Tenés tres pestañas y cada una navega a pantallas de detalle. ¿Qué jerarquía usás?",
      options: [
        "Un `UINavigationController` con un `UITabBarController` adentro",
        "Un `UITabBarController` sin navigation controllers; los detalles con `present`",
        "Un `UITabBarController` cuyas pestañas son cada una un `UINavigationController`",
        "Tres ventanas, una por pestaña",
      ],
      answer: 2,
      explanation: "Tab bar afuera, un navigation controller por pestaña: cada pestaña conserva su propia pila y el tab bar se mantiene visible mientras navegás.",
    },
  ],
};

export default content;
