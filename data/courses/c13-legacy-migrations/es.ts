import type { CourseContent } from "../types";

// El código va con String.raw para no perder las barras de `\(...)`. Vale para Swift y para Objective-C.
const swift = String.raw;
const objc = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "reading-objc",
      title: "Leer Objective-C sin miedo",
      goal: "Leer un `.h` y un `.m`, entender los atributos de las properties y la nullability, y saber cómo se ve ese código desde Swift (y al revés).",
      minutes: 24,
      steps: [
        {
          kind: "explain",
          title: "Dos archivos: `.h` y `.m`",
          body: [
            "En Objective-C cada clase vive en dos archivos. El `.h` (header) es la interfaz pública: lo que ven los demás cuando hacen `#import`. El `.m` es la implementación. Lo que no está en el `.h` es privado de hecho.",
            "`@interface ... @end` declara la clase y `@implementation ... @end` la implementa. Los métodos que empiezan con `-` son de instancia y los que empiezan con `+` son de clase (como `static func`).",
            "Llamar a un método es **enviar un mensaje**: `[receptor mensaje:arg otroLabel:arg]`. El nombre completo del método (el selector) junta todas las partes: `initWithName:age:`. `@\"Ana\"` es un literal de `NSString`.",
            "Un detalle que sorprende viniendo de Swift: enviarle un mensaje a `nil` **no crashea**. Devuelve `nil`, `0` o `NO` según el tipo. Por eso hay bugs legacy que no explotan: simplemente no hacen nada.",
          ],
          code: objc`// LegacyUser.h — la interfaz pública
#import <Foundation/Foundation.h>

@interface LegacyUser : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic, assign) NSInteger age;
- (instancetype)initWithName:(NSString *)name age:(NSInteger)age;
- (BOOL)isAdult;
+ (LegacyUser *)guestUser;
@end

// LegacyUser.m — la implementación
#import "LegacyUser.h"

@implementation LegacyUser
- (instancetype)initWithName:(NSString *)name age:(NSInteger)age {
    self = [super init];
    if (self) {
        _name = [name copy];   // _name es la variable de instancia detrás de la property
        _age = age;
    }
    return self;
}

- (BOOL)isAdult {
    return self.age >= 18;
}

+ (LegacyUser *)guestUser {
    return [[LegacyUser alloc] initWithName:@"Invitado" age:0];
}
@end

// Uso: alloc + init, y mensajes entre corchetes
LegacyUser *user = [[LegacyUser alloc] initWithName:@"Ana" age:30];
BOOL adult = [user isAdult];`,
        },
        {
          kind: "predict",
          prompt: "¿Qué pasa al ejecutar este fragmento?",
          code: objc`LegacyUser *user = nil;
NSInteger age = [user age];
BOOL adult = [user isAdult];`,
          options: [
            "Crash con `EXC_BAD_ACCESS` al enviar el primer mensaje",
            "No compila: `user` puede ser `nil`",
            "`age` vale 0 y `adult` vale `NO`, sin crash",
            "Lanza `NSInvalidArgumentException`",
          ],
          answer: 2,
          explanation: "En Objective-C un mensaje a `nil` es válido: no hace nada y devuelve el valor cero del tipo (`0` para `NSInteger`, `NO` para `BOOL`, `nil` para objetos). El compilador no se queja porque no hay optionals. Es cómodo, pero esconde bugs: la pantalla queda vacía en vez de fallar.",
        },
        {
          kind: "explain",
          title: "Atributos de las properties",
          body: [
            "`nonatomic` va en casi todas las properties de UI: el default (`atomic`) es más lento y no hace a la clase thread-safe. Después viene la semántica de memoria: `strong` (retiene, es el default para objetos), `weak` (no retiene y pasa a `nil` sola: delegates, para evitar ciclos), `copy` (guarda una copia) y `assign` (tipos primitivos como `NSInteger` o `BOOL`).",
            "`copy` es la regla para `NSString`, `NSArray` y blocks. Como `NSMutableString` es subclase de `NSString`, alguien te puede pasar un string mutable y cambiarlo después: con `strong` tu property cambia con él; con `copy` no.",
            "`readonly` genera solo el getter. Es común redeclarar la property como `readwrite` en una extensión privada dentro del `.m`: el equivalente a `private(set) var` en Swift.",
          ],
          code: objc`@interface CheckoutViewController : UIViewController
@property (nonatomic, weak) id<CheckoutDelegate> delegate;  // no retiene: evita ciclos
@property (nonatomic, strong) UITableView *tableView;       // retiene (default para objetos)
@property (nonatomic, copy) NSString *couponCode;            // copia: protege de NSMutableString
@property (nonatomic, copy) void (^onFinish)(BOOL success); // los blocks se copian
@property (nonatomic, assign) NSInteger itemCount;           // tipos primitivos
@property (nonatomic, readonly) BOOL canPay;                 // solo getter público
@end

// CheckoutViewController.m
@interface CheckoutViewController ()
@property (nonatomic, readwrite) BOOL canPay;                // escribible solo adentro
@end`,
        },
        {
          kind: "predict",
          prompt: "`LegacyUser` declara `@property (nonatomic, strong) NSString *name;`. ¿Qué vale `user.name` al final?",
          code: objc`NSMutableString *buffer = [NSMutableString stringWithString:@"Ana"];
user.name = buffer;
[buffer appendString:@" Paz"];
// user.name == ?`,
          options: ["\"Ana\"", "\"Ana Paz\"", "`nil`", "Crash al mutar `buffer`"],
          answer: 1,
          explanation: "Con `strong`, `user.name` apunta al **mismo** objeto que `buffer`. Al mutar `buffer`, el nombre del usuario cambia a sus espaldas: \"Ana Paz\". Con `copy`, la property guarda una copia inmutable en el momento de asignar y seguiría valiendo \"Ana\". Por eso `NSString` va con `copy`.",
        },
        {
          kind: "explain",
          title: "Nullability y blocks: cómo los ve Swift",
          body: [
            "Un puntero de Objective-C sin anotar llega a Swift como optional implícitamente desempaquetado (`String!`): compila sin `?` y crashea si vino `nil`. Las anotaciones lo arreglan: `nullable` → `String?`, `nonnull` → `String`.",
            "`NS_ASSUME_NONNULL_BEGIN`/`END` marca todo el bloque como `nonnull` por defecto, y solo anotás lo que puede faltar con `nullable` (o `_Nullable` dentro de tipos de blocks). Es lo primero que se agrega cuando un header viejo empieza a usarse desde Swift.",
            "Los blocks son los closures de Objective-C: `void (^)(LegacyUser *user, NSError *error)`. Como parámetro llegan a Swift como `@escaping`. Y si el último parámetro es un block de completion con `NSError`, Swift además te ofrece una versión `async throws` del método.",
            "Igual que en Swift, un block que captura `self` y queda guardado arma un ciclo. El patrón legacy es `__weak typeof(self) weakSelf = self;` antes del block.",
          ],
          code: objc`NS_ASSUME_NONNULL_BEGIN

@interface UserService : NSObject
@property (nonatomic, copy, nullable) NSString *lastError;
- (nullable LegacyUser *)cachedUserWithID:(NSString *)userID;
- (void)fetchUserWithID:(NSString *)userID
             completion:(void (^)(LegacyUser * _Nullable user, NSError * _Nullable error))completion;
@end

NS_ASSUME_NONNULL_END

// Desde Swift se ve así:
// var lastError: String?
// func cachedUser(withID userID: String) -> LegacyUser?
// func fetchUser(withID userID: String, completion: @escaping (LegacyUser?, Error?) -> Void)
// func fetchUser(withID userID: String) async throws -> LegacyUser`,
        },
        {
          kind: "fill",
          prompt: "Dentro de `NS_ASSUME_NONNULL_BEGIN`, el header dice `- (nullable LegacyUser *)cachedUserWithID:(NSString *)userID;`. Completá el tipo de retorno que ve Swift.",
          code: swift`func cachedUser(withID userID: String) -> ____`,
          accept: ["^LegacyUser\\?$"],
          explanation: "`nullable` en el retorno se importa como optional: `LegacyUser?`. El parámetro `userID` no tiene anotación, pero adentro del bloque `NS_ASSUME_NONNULL` es `nonnull`, así que llega como `String` sin `?`.",
          hint: "`nullable` en Objective-C es `?` en Swift.",
          placeholder: "tipo",
        },
        {
          kind: "explain",
          title: "Puentes: bridging header, `-Swift.h` y `@objc`",
          body: [
            "**Objective-C → Swift**: en un target de app, los headers que listás en el bridging header (`MyApp-Bridging-Header.h`) quedan visibles en todo el código Swift, sin `import`.",
            "**Swift → Objective-C**: Xcode genera `MyApp-Swift.h` con lo que Swift expone. Lo importás en los `.m`; en los `.h` usá `@class Nombre;` para no generar dependencias circulares.",
            "Swift expone solo lo que puede representarse en Objective-C (clases que heredan de `NSObject`, enums `@objc` con raw value `Int`, nada de structs ni genéricos) y solo los miembros marcados con `@objc`. `@objcMembers` en la clase los marca a todos. Desde Swift 4 heredar de `NSObject` **no** alcanza para exponer un método.",
            "Para que un nombre de Objective-C se lea bien en Swift sin cambiar los call sites viejos, usá `NS_SWIFT_NAME`.",
          ],
          code: objc`// MyApp-Bridging-Header.h — Objective-C visible desde Swift
#import "LegacyUser.h"
#import "UserService.h"

// UserService.h — nombre prolijo para Swift, mismo selector para Objective-C
- (void)fetchUserWithIdentifier:(NSString *)identifier
                     completion:(void (^)(LegacyUser * _Nullable, NSError * _Nullable))completion
    NS_SWIFT_NAME(fetchUser(id:completion:));

// LegacyCartViewController.m — Swift visible desde Objective-C
#import "MyApp-Swift.h"

// PriceFormatter.swift
@objcMembers
final class PriceFormatter: NSObject {
    func format(cents: Int) -> String { String(format: "$%.2f", Double(cents) / 100) }
}`,
        },
        {
          kind: "predict",
          prompt: "Este `.m` importa `MyApp-Swift.h` y usa una clase Swift. ¿Qué pasa al compilar?",
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
            "Error en `[tracker start]`: `start` no tiene `@objc`, así que no aparece en `MyApp-Swift.h`",
            "Compila: los métodos de una subclase de `NSObject` se exponen solos",
            "Error en las dos líneas porque la clase es `final`",
            "Compila, pero crashea en runtime con `unrecognized selector`",
          ],
          answer: 0,
          explanation: "La clase sí se ve (hereda de `NSObject`), pero desde Swift 4 los miembros no se infieren `@objc`: solo `stop` está en el header generado. `[tracker start]` no compila. Se arregla con `@objc func start()` o con `@objcMembers` en la clase. `final` no tiene nada que ver.",
        },
        {
          kind: "write",
          prompt: "Dejá `PaymentMethod.h` listo para usarse desde Swift: todo entre `NS_ASSUME_NONNULL_BEGIN`/`NS_ASSUME_NONNULL_END`, `title` con `copy`, `iconName` opcional (`nullable`) y `isExpiredAtDate:` renombrado para Swift como `isExpired(at:)` con `NS_SWIFT_NAME`.",
          starter: objc`#import <Foundation/Foundation.h>

@interface PaymentMethod : NSObject
@property (nonatomic, strong) NSString *title;
@property (nonatomic, strong) NSString *iconName;
- (BOOL)isExpiredAtDate:(NSDate *)date;
@end`,
          checks: [
            { pattern: "NS_ASSUME_NONNULL_BEGIN", label: "Abre el bloque con `NS_ASSUME_NONNULL_BEGIN`" },
            { pattern: "NS_ASSUME_NONNULL_END", label: "Lo cierra con `NS_ASSUME_NONNULL_END`" },
            { pattern: "@property\\s*\\([^)]*\\bcopy\\b[^)]*\\)\\s*NSString\\s*\\*\\s*title\\b", label: "`title` es `copy`" },
            { pattern: "@property\\s*\\([^)]*\\bnullable\\b[^)]*\\)\\s*NSString\\s*\\*\\s*iconName\\b|NSString\\s*\\*\\s*_Nullable\\s+iconName\\b", label: "`iconName` es `nullable`" },
            { pattern: "NS_SWIFT_NAME\\(\\s*isExpired\\(at:\\)\\s*\\)", label: "Renombra con `NS_SWIFT_NAME(isExpired(at:))`" },
          ],
          warnings: [
            { pattern: "@property\\s*\\([^)]*\\bstrong\\b[^)]*\\)\\s*NSString", label: "`strong` en un `NSString`: usá `copy`" },
          ],
          solution: objc`#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface PaymentMethod : NSObject
@property (nonatomic, copy) NSString *title;
@property (nonatomic, copy, nullable) NSString *iconName;
- (BOOL)isExpiredAtDate:(NSDate *)date NS_SWIFT_NAME(isExpired(at:));
@end

NS_ASSUME_NONNULL_END`,
          hint: "`NS_SWIFT_NAME(...)` va al final de la declaración del método, antes del `;`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "storyboards-xibs",
      title: "Storyboards, XIBs y cómo salir de ellos",
      goal: "Entender outlets, actions y segues, reconocer los crashes típicos de un storyboard y migrar una pantalla a código sin romper la navegación.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Qué hay adentro de un storyboard",
          body: [
            "Un storyboard (o un XIB, que tiene una sola vista) es un XML que describe vistas, constraints y **conexiones por nombre**: el outlet `nameLabel`, el segue `showEditProfile`, la clase `ProfileViewController`. El compilador no verifica ninguno de esos strings.",
            "`@IBOutlet` marca una property que el storyboard llena al cargar la vista (por KVC, buscando la property por su nombre). Por eso son `weak` y `UILabel!`: existen recién después de `viewDidLoad` y la vista ya las retiene.",
            "`@IBAction` marca un método que el storyboard conecta a un evento, como el tap de un botón. Para crear la pantalla desde código usás `instantiateViewController(withIdentifier:)` con un cast.",
          ],
          code: swift`final class ProfileViewController: UIViewController {
    @IBOutlet private weak var nameLabel: UILabel!
    @IBOutlet private weak var avatarView: UIImageView!

    var user: User?   // lo setea quien presenta la pantalla

    override func viewDidLoad() {
        super.viewDidLoad()
        nameLabel.text = user?.name
    }

    @IBAction private func didTapEdit(_ sender: UIButton) {
        performSegue(withIdentifier: "showEditProfile", sender: self)
    }
}

// Crear la pantalla desde código
let storyboard = UIStoryboard(name: "Main", bundle: nil)
let profile = storyboard.instantiateViewController(withIdentifier: "ProfileViewController") as! ProfileViewController`,
        },
        {
          kind: "predict",
          prompt: "En un refactor renombrás `nameLabel` a `titleLabel` en el código, pero el storyboard sigue conectado a `nameLabel`. Compila. ¿Qué pasa al abrir la pantalla?",
          code: swift`final class ProfileViewController: UIViewController {
    @IBOutlet private weak var titleLabel: UILabel!   // antes: nameLabel
}

// Main.storyboard todavía dice:
// <outlet property="nameLabel" destination="aB3-xY-9Qz" id="..."/>`,
          options: [
            "Funciona: Xcode resuelve el outlet por tipo",
            "`titleLabel` queda en `nil` pero no pasa nada hasta que lo uses",
            "Error de compilación en el storyboard",
            "Crash al cargar la vista: `NSUnknownKeyException` ... `not key value coding-compliant for the key nameLabel`",
          ],
          answer: 3,
          explanation: "Al cargar la vista, UIKit hace `setValue(_:forKey: \"nameLabel\")` sobre el controller. Esa property ya no existe y KVC tira `NSUnknownKeyException`. Es el crash clásico de outlet desconectado: compila perfecto y explota en runtime. Y aunque lo arregles, `titleLabel` no está conectado: el primer acceso crashea por desempaquetar `nil`.",
        },
        {
          kind: "explain",
          title: "Segues y `prepare(for:sender:)`",
          body: [
            "Un segue es una transición definida en el storyboard. Antes de ejecutarla, UIKit llama a `prepare(for:sender:)` en el controller de origen: ahí distinguís el segue por su `identifier` (otro string) y le pasás datos al destino casteando `segue.destination`.",
            "Como el destino lo crea el storyboard, no podés usar su `init`: los datos entran por properties `var` (muchas veces `Item!`). Y `prepare` corre **antes** de que se cargue la vista del destino: sus outlets todavía son `nil`.",
            "Desde iOS 13 hay salida intermedia: `instantiateViewController(identifier:creator:)` (y `@IBSegueAction`) te dejan llamar a un `init(coder:item:)` propio y recibir dependencias por init sin abandonar el storyboard.",
          ],
          code: swift`override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
    if segue.identifier == "showDetail",
       let detail = segue.destination as? DetailViewController,
       let indexPath = tableView.indexPathForSelectedRow {
        detail.item = items[indexPath.row]   // property, no init
    }
}

// iOS 13+: init propio con el storyboard
let detail = storyboard.instantiateViewController(identifier: "Detail") { coder in
    DetailViewController(coder: coder, item: item)
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la property del segue que tiene el controller al que vas a navegar.",
          code: swift`override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
    guard let detail = segue.____ as? DetailViewController else { return }
    detail.item = selectedItem
}`,
          accept: ["^destination$"],
          explanation: "`segue.destination` es el `UIViewController` de destino (también existe `segue.source`). Viene tipado como `UIViewController`, por eso el `as?`.",
          placeholder: "property",
        },
        {
          kind: "predict",
          prompt: "`DetailViewController` tiene `@IBOutlet weak var titleLabel: UILabel!` conectado correctamente. ¿Qué pasa al tocar la celda?",
          code: swift`override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
    guard let detail = segue.destination as? DetailViewController else { return }
    detail.titleLabel.text = selectedItem.name
}`,
          options: [
            "Crash: `titleLabel` todavía es `nil` porque la vista del destino no se cargó",
            "Funciona: el segue carga la vista antes de llamar a `prepare`",
            "El texto se asigna pero `viewDidLoad` lo pisa",
            "No compila: no se puede acceder a outlets de otro controller",
          ],
          answer: 0,
          explanation: "`prepare` corre antes de que el destino cargue su vista, y los outlets se conectan recién al cargarla. Desempaquetar el `UILabel!` en `nil` crashea con `Unexpectedly found nil while implicitly unwrapping an Optional value`. Lo correcto: pasar el dato (`detail.item = ...`) y que el destino lo pinte en `viewDidLoad`.",
        },
        {
          kind: "explain",
          title: "Por qué los equipos se van y cómo migrar una pantalla",
          body: [
            "Razones concretas: un storyboard grande que tocan varias personas genera conflictos de merge en XML casi imposibles de resolver a mano; los diffs no se pueden revisar en un PR; los errores de conexión aparecen en runtime y no al compilar; y no hay inyección por `init`.",
            "La migración se hace de a una pantalla. La versión en código recibe sus dependencias por `init`, crea sus vistas con Auto Layout y quien la presenta hace `pushViewController` en vez de `performSegue`. En el mismo PR borrás la escena y el segue del storyboard, para que no quede código muerto.",
            "`required init?(coder:)` con `fatalError` es el patrón estándar: deja explícito que esta pantalla ya no se crea desde un storyboard.",
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

// En la lista, en vez de performSegue:
navigationController?.pushViewController(DetailViewController(item: item), animated: true)`,
        },
        {
          kind: "predict",
          prompt: "Tu equipo tiene un `Main.storyboard` con 40 escenas y conflictos de merge todas las semanas. ¿Cuál es el plan razonable?",
          code: swift`// Main.storyboard: 40 escenas, 55 segues, 6 personas tocándolo`,
          options: [
            "Reescribir toda la UI en código en un único PR grande",
            "Prohibir tocar el storyboard hasta que haya tiempo de migrar",
            "Migrar de a una pantalla (a código o a storyboards chicos por flujo), borrando la escena vieja en el mismo PR",
            "Convertir el storyboard en XIBs manteniendo los mismos segues",
          ],
          answer: 2,
          explanation: "Un PR gigante es imposible de revisar y rompe cosas; prohibir tocarlo frena al producto. Migrar de a una pantalla mantiene cada cambio chico y verificable, y cada escena que sale reduce conflictos. Los XIBs no tienen segues: esa opción ni siquiera es posible.",
        },
        {
          kind: "write",
          prompt: "Migrá `ReceiptViewController` a código: `receipt` pasa a ser `let` y entra por `init(receipt:)`, llamás a `super.init(nibName: nil, bundle: nil)`, implementás `required init?(coder:)`, creás `totalLabel` en código con Auto Layout y la pantalla se presenta con `pushViewController` en vez del segue.",
          starter: swift`final class ReceiptViewController: UIViewController {
    @IBOutlet weak var totalLabel: UILabel!
    var receipt: Receipt!

    override func viewDidLoad() {
        super.viewDidLoad()
        totalLabel.text = receipt.totalText
    }
}

// En OrdersViewController:
// performSegue(withIdentifier: "showReceipt", sender: receipt)`,
          checks: [
            { pattern: "init\\(receipt:\\s*Receipt\\)", label: "Recibe el recibo por `init(receipt:)`" },
            { pattern: "super\\.init\\(nibName:\\s*nil,\\s*bundle:\\s*nil\\)", label: "Llama a `super.init(nibName: nil, bundle: nil)`" },
            { pattern: "required\\s+init\\?\\(coder", label: "Implementa `required init?(coder:)`" },
            { pattern: "translatesAutoresizingMaskIntoConstraints\\s*=\\s*false", label: "Usa Auto Layout en código" },
            { pattern: "pushViewController\\(\\s*ReceiptViewController\\(receipt:", label: "Presenta la pantalla con `pushViewController`" },
          ],
          warnings: [
            { pattern: "@IBOutlet", label: "Quedó un `@IBOutlet`: ya no hay storyboard que lo conecte" },
            { pattern: "performSegue", label: "Todavía usás `performSegue`" },
            { pattern: "var\\s+receipt\\s*:\\s*Receipt!", label: "`receipt` sigue siendo un `Receipt!` mutable" },
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

// En OrdersViewController:
navigationController?.pushViewController(ReceiptViewController(receipt: receipt), animated: true)`,
          hint: "Copiá la estructura de `DetailViewController` del paso anterior.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "uikit-swiftui-interop",
      title: "UIKit + SwiftUI en la misma app",
      goal: "Meter SwiftUI dentro de UIKit con `UIHostingController` (y que tome bien el tamaño), envolver UIKit en SwiftUI con representables y un `Coordinator`, y adoptar SwiftUI pantalla por pantalla.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "SwiftUI adentro de UIKit: `UIHostingController`",
          body: [
            "`UIHostingController(rootView:)` es un `UIViewController` que muestra una vista SwiftUI. Para una pantalla completa lo pusheás o presentás como cualquier otro controller.",
            "Para embeber SwiftUI en un pedazo de una pantalla UIKit hacés **contención de child view controller** en tres pasos: `addChild(host)`, agregar `host.view` con constraints y `host.didMove(toParent: self)`. Si te salteás la contención, el child no recibe bien los eventos de aparición ni los cambios de traits y safe area.",
            "Tamaño: si fijás solo arriba y a los costados, la altura sale del contenido. Con `sizingOptions = .intrinsicContentSize` (iOS 16+) el hosting controller actualiza su tamaño intrínseco cuando el contenido SwiftUI cambia, y Auto Layout se reacomoda solo.",
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
        let host = UIHostingController(rootView: PromoBanner(title: "Envío gratis hoy"))
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

// Pantalla completa:
// navigationController?.pushViewController(UIHostingController(rootView: SettingsView()), animated: true)`,
        },
        {
          kind: "fill",
          prompt: "Completá el último paso de la contención del child.",
          code: swift`addChild(host)
view.addSubview(host.view)
// ... constraints
host.____(toParent: self)`,
          accept: ["^didMove$"],
          explanation: "La secuencia es `addChild` → agregar la vista → `didMove(toParent:)`. Para sacarlo es al revés: `willMove(toParent: nil)` → `view.removeFromSuperview()` → `removeFromParent()`.",
          placeholder: "método",
        },
        {
          kind: "explain",
          title: "El `rootView` es un valor: cómo se hablan UIKit y SwiftUI",
          body: [
            "La vista SwiftUI es un struct: `UIHostingController(rootView: Badge(count: unread))` guarda una **copia**. Si después cambiás una variable de UIKit, SwiftUI no se entera.",
            "Dos formas de mandar datos de UIKit a SwiftUI: reasignar `host.rootView` con una vista nueva, o (mejor) compartir un modelo observable: `@Observable` en iOS 17+, o `ObservableObject` con `@ObservedObject` si soportás versiones anteriores. UIKit cambia el modelo y SwiftUI se redibuja solo.",
            "De SwiftUI hacia UIKit, closures: la vista avisa `onTap` y el controller (o el coordinator) decide la navegación. Así la navegación sigue en UIKit mientras migrás.",
          ],
          code: swift`@Observable
final class CartBadgeModel {
    var count = 0
}

struct CartBadge: View {
    let model: CartBadgeModel
    var onTap: () -> Void
    var body: some View {
        Button("Carrito (\(model.count))", action: onTap)
    }
}

final class StoreViewController: UIViewController {
    weak var coordinator: StoreCoordinator?
    private let badgeModel = CartBadgeModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: CartBadge(model: badgeModel) { [weak self] in
            self?.coordinator?.showCart()   // la navegación sigue en UIKit
        })
        // ... contención como antes
    }

    func didAddItem() {
        badgeModel.count += 1   // SwiftUI se actualiza solo
    }
}`,
        },
        {
          kind: "predict",
          prompt: "`InboxBadge` es un struct con `let count: Int` que muestra `Text(\"\\(count)\")`. ¿Qué número muestra el badge?",
          code: swift`var unread = 3
let host = UIHostingController(rootView: InboxBadge(count: unread))
// ... contención
unread = 7`,
          options: ["7", "3", "Crash por modificar estado fuera de SwiftUI", "0"],
          answer: 1,
          explanation: "`InboxBadge(count: unread)` copió el valor 3 en el momento de crear la vista. Cambiar `unread` después no toca esa copia. Para que muestre 7 hay que hacer `host.rootView = InboxBadge(count: 7)` o pasar un modelo observable compartido.",
        },
        {
          kind: "explain",
          title: "UIKit adentro de SwiftUI: `UIViewRepresentable` y `Coordinator`",
          body: [
            "Cuando una pantalla SwiftUI necesita un componente UIKit (un `UISearchBar` custom, un `MKMapView` con delegate, un componente de diseño viejo), lo envolvés en un `UIViewRepresentable`.",
            "`makeUIView` corre una vez y crea la vista. `updateUIView` corre cada vez que cambia el estado SwiftUI que la afecta: tiene que ser idempotente y comparar antes de asignar, o vas a pisar lo que el usuario está escribiendo y armar loops.",
            "Los delegates de UIKit son objetos de clase y se guardan `weak`. El struct del representable se recrea todo el tiempo, así que no puede ser delegate. Para eso está el `Coordinator`: una clase que SwiftUI crea una vez con `makeCoordinator()` y mantiene viva mientras exista la vista.",
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
          prompt: "Un compañero propone simplificar y escribe `bar.delegate = self` dentro de `makeUIView`, borrando el `Coordinator`. ¿Qué pasa?",
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
            "Funciona igual que con el `Coordinator`",
            "Funciona, pero pierde eventos cuando SwiftUI recrea el struct",
            "Crash en runtime con el primer evento",
            "No compila: un struct no puede conformar `UISearchBarDelegate` ni ser asignado a un `delegate` de clase",
          ],
          answer: 3,
          explanation: "`UISearchBarDelegate` es un protocolo de Objective-C, que solo pueden adoptar clases, y `delegate` es una referencia `weak` a un objeto. Un struct no entra. Aunque se pudiera, el struct se recrea en cada actualización: por eso existe el `Coordinator`, una clase con vida estable.",
        },
        {
          kind: "explain",
          title: "`UIViewControllerRepresentable` y la adopción pantalla por pantalla",
          body: [
            "`UIViewControllerRepresentable` hace lo mismo con controllers enteros: `makeUIViewController(context:)`, `updateUIViewController(_:context:)` y un `Coordinator` si el controller tiene delegate. Sirve para reusar una pantalla UIKit vieja dentro de un flujo SwiftUI nuevo.",
            "La estrategia que funciona en apps grandes: las pantallas nuevas se hacen en SwiftUI y se presentan con `UIHostingController`; la navegación (coordinators, `UINavigationController`) queda en UIKit hasta el final; las pantallas viejas se reescriben cuando igual hay que cambiarlas. Nada de \"reescribimos la app\".",
          ],
          code: swift`struct LegacyReportScreen: UIViewControllerRepresentable {
    let reportID: String

    func makeUIViewController(context: Context) -> ReportViewController {
        ReportViewController(reportID: reportID)   // pantalla UIKit existente
    }

    func updateUIViewController(_ uiViewController: ReportViewController, context: Context) {}
}

// Adopción típica, de afuera hacia adentro:
// 1. Pantallas nuevas en SwiftUI, presentadas con UIHostingController.
// 2. La navegación sigue en UIKit (coordinators).
// 3. Pantallas viejas: se reescriben cuando hay que tocarlas igual.
// 4. Si SwiftUI necesita algo de UIKit, se envuelve con un Representable.`,
        },
        {
          kind: "write",
          prompt: "Envolvé `SignatureViewController` (UIKit, con `weak var delegate: SignatureViewControllerDelegate?` y el callback `signatureViewController(_:didFinishWith:)`) para usarlo desde SwiftUI. El resultado sale por el closure `onFinish: (UIImage) -> Void`.",
          starter: swift`struct SignatureScreen {
    let onFinish: (UIImage) -> Void
}`,
          checks: [
            { pattern: "struct\\s+SignatureScreen\\s*:\\s*UIViewControllerRepresentable", label: "Conforma `UIViewControllerRepresentable`" },
            { pattern: "func\\s+makeUIViewController\\(context:", label: "Implementa `makeUIViewController(context:)`" },
            { pattern: "func\\s+updateUIViewController\\(", label: "Implementa `updateUIViewController(_:context:)`" },
            { pattern: "func\\s+makeCoordinator\\(\\)", label: "Implementa `makeCoordinator()`" },
            { pattern: "class\\s+Coordinator\\b[^{]*SignatureViewControllerDelegate", label: "El `Coordinator` es el delegate" },
            { pattern: "\\.delegate\\s*=\\s*context\\.coordinator", label: "Asigna `context.coordinator` como delegate" },
          ],
          warnings: [
            { pattern: "\\.delegate\\s*=\\s*self\\b", label: "El struct no puede ser delegate: usá el `Coordinator`" },
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
          hint: "Mismo esquema que `SearchField`, pero con `makeUIViewController` y `updateUIViewController`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "safe-changes",
      title: "Cambiar código legacy sin romperlo",
      goal: "Escribir tests de caracterización antes de tocar nada, abrir costuras para testear, partir un Massive View Controller en PRs chicos y reemplazar pantallas con strangler fig y feature flags.",
      minutes: 26,
      steps: [
        {
          kind: "explain",
          title: "Primero, fotografiá el comportamiento",
          body: [
            "Michael Feathers define código legacy como \"código sin tests\". Antes de refactorizar necesitás una red: un **test de caracterización** no dice qué debería hacer el código, registra lo que **hace hoy**, incluso si parece raro.",
            "La técnica: escribís el test con un valor que suponés, lo corrés, el fallo te dice el valor real y lo pegás. Repetís con los casos borde que importan (vacío, negativos, nil, redondeos). Para UI, lo mismo con snapshot tests.",
            "Con esos tests en verde refactorizás. Si algo se pone rojo, cambiaste comportamiento sin querer. Los bugs que encuentres se anotan y se arreglan en **otro** PR.",
          ],
          code: swift`// PriceFormatter es legacy: nadie sabe bien qué hace con negativos.
final class PriceFormatterCharacterizationTests: XCTestCase {
    func test_format_currentBehavior() {
        let formatter = PriceFormatter()
        XCTAssertEqual(formatter.format(cents: 1999), "$19.99")
        XCTAssertEqual(formatter.format(cents: 0), "$0.00")
        XCTAssertEqual(formatter.format(cents: -500), "$-5.00")   // raro, pero es lo que hace hoy
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Tu test de caracterización muestra que `format(cents: -500)` devuelve `\"$-5.00\"` y sospechás que es un bug. Estás en medio de un refactor para sacar el formatter del view controller. ¿Qué hacés?",
          code: swift`XCTAssertEqual(formatter.format(cents: -500), "$-5.00")   // ¿bug?`,
          options: [
            "Lo corregís en el mismo PR, total ya estás tocando ese código",
            "Dejás el test afirmando `\"$-5.00\"`, terminás el refactor sin cambiar comportamiento y el fix va en otro PR (después de confirmar con producto)",
            "Borrás ese caso del test para que no moleste",
            "Marcás el test como skip hasta que se decida",
          ],
          answer: 1,
          explanation: "Un refactor no cambia comportamiento; si mezclás un fix, cuando algo falle en producción no vas a saber cuál de los dos cambios fue. Además, lo \"raro\" puede ser algo de lo que otra parte de la app depende. Fix separado, revisado y con su propio test.",
        },
        {
          kind: "explain",
          title: "Costuras: por dónde meter un test",
          body: [
            "Una **costura** (seam) es un lugar donde podés cambiar el comportamiento sin editar el código que lo usa. El código legacy no tiene costuras: llama a `UserDefaults.standard`, `Date()` o `APIClient.shared` directamente.",
            "La costura más común: extraer un protocolo con lo que se usa e inyectarlo por `init` **con valor por defecto** igual al de producción. Los `SubscriptionBanner()` que ya existen siguen compilando y funcionando igual; el test pasa un fake.",
            "Con el reloj pasa lo mismo: una closure `now: () -> Date = Date.init` te deja testear vencimientos sin esperar ni tocar la fecha del simulador.",
          ],
          code: swift`// Antes: imposible de testear sin tocar UserDefaults ni el reloj real
// let expiry = UserDefaults.standard.object(forKey: "expiry") as? Date ?? .distantPast
// return expiry < Date() ? "Renová tu plan" : "Plan activo"

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
        return expiry < now() ? "Renová tu plan" : "Plan activo"
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Completá el valor por defecto para que todos los `ProfileLoader()` que ya existen sigan compilando y usando la API real.",
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
          explanation: "El default es la implementación de producción: `LiveProfileAPI()`. Así la costura no obliga a cambiar ningún call site en este PR, y los tests pasan `ProfileLoader(api: StubProfileAPI())`.",
          hint: "Es una instancia de la implementación real.",
          placeholder: "valor por defecto",
        },
        {
          kind: "explain",
          title: "Subclase y override, y cómo partir un Massive View Controller",
          body: [
            "Cuando no podés cambiar el `init` (lo crea un storyboard o código Objective-C), otra costura es **subclase y override**: sacás la dependencia a un método `makeAPIClient()` y en el target de tests una subclase lo sobreescribe. No es lindo, pero te da el primer test.",
            "Un view controller de 2000 líneas se parte con una secuencia de PRs chicos, cada uno sin cambio de comportamiento: (1) tests de caracterización de lo que vas a tocar; (2) extraer funciones puras (formateo, validación) a tipos aparte; (3) abrir costuras para las dependencias; (4) mover estado y lógica a un view model o presenter; (5) separar vistas o child controllers.",
            "Regla de oro: un PR de refactor no cambia comportamiento, y un PR que cambia comportamiento no refactoriza. Cada uno se revisa en minutos y se revierte sin miedo.",
          ],
          code: swift`class OrdersViewController: UIViewController {
    func makeAPIClient() -> APIClient { APIClient.shared }   // costura

    func reload() {
        makeAPIClient().fetchOrders { [weak self] orders in
            self?.render(orders)
        }
    }

    func render(_ orders: [Order]) { /* ... */ }
}

// En el target de tests (StubAPIClient hereda de APIClient):
final class TestableOrdersViewController: OrdersViewController {
    let stubClient = StubAPIClient()
    override func makeAPIClient() -> APIClient { stubClient }
}`,
        },
        {
          kind: "predict",
          prompt: "Estás partiendo `CheckoutViewController` (2300 líneas). ¿Cuál de estos PRs mezcla dos cosas que deberían ir separadas?",
          code: swift`// PR A: mover formatDate(_:) a DateFormatting, sin tocar la lógica
// PR B: tests de caracterización para validate(form:)
// PR C: extraer CheckoutViewModel y de paso arreglar el redondeo del total
// PR D: reemplazar APIClient.shared por un parámetro con valor por defecto`,
          options: [
            "PR A",
            "PR B",
            "PR C",
            "PR D",
          ],
          answer: 2,
          explanation: "El PR C mezcla un refactor (extraer el view model) con un cambio de comportamiento (el redondeo). Si un test de caracterización se pone rojo no sabés si es el bug que arreglaste o algo que rompiste. A, B y D son pasos puros: o no cambian comportamiento o solo agregan tests.",
        },
        {
          kind: "explain",
          title: "Strangler fig: lo nuevo crece al lado de lo viejo",
          body: [
            "El nombre viene de una higuera que crece alrededor de un árbol hasta reemplazarlo. En una app: la versión nueva de una pantalla convive con la vieja y un **único punto de ruteo** decide cuál mostrar.",
            "El que decide es un feature flag **remoto**: arrancás con el equipo interno, después 5%, 25%, 100%, mirando crashes y métricas. Si algo sale mal, apagás el flag sin release. La pantalla legacy queda intacta mientras tanto.",
            "Los flags son deuda: cuando la versión nueva está estable al 100%, se borra el flag y el código viejo en un PR dedicado.",
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
            screen = LegacyCheckoutViewController(cart: cart)   // Objective-C, intacto
        }
        navigation.pushViewController(screen, animated: true)
    }
}`,
        },
        {
          kind: "write",
          prompt: "Escribí `makeProfileScreen(user:flags:)`: si el flag `.newProfile` está activo, devolvé un `UIHostingController` con `ProfileView(user: user)`; si no, el `LegacyProfileViewController(user: user)` de siempre.",
          starter: swift`func makeProfileScreen(user: User, flags: FeatureFlags) -> UIViewController {
    LegacyProfileViewController(user: user)
}`,
          checks: [
            { pattern: "isEnabled\\(\\s*\\.newProfile\\s*\\)", label: "Consulta el flag `.newProfile`" },
            { pattern: "UIHostingController\\(\\s*rootView:\\s*ProfileView\\(user:\\s*user\\)", label: "Hostea `ProfileView` en un `UIHostingController`" },
            { pattern: "LegacyProfileViewController\\(user:\\s*user\\)", label: "Mantiene la pantalla legacy como fallback" },
            { pattern: "->\\s*UIViewController", label: "Devuelve `UIViewController`" },
          ],
          warnings: [
            { pattern: "#if\\s+DEBUG", label: "Un `#if` se decide al compilar: el flag tiene que poder cambiarse sin release" },
          ],
          solution: swift`func makeProfileScreen(user: User, flags: FeatureFlags) -> UIViewController {
    if flags.isEnabled(.newProfile) {
        return UIHostingController(rootView: ProfileView(user: user))
    }
    return LegacyProfileViewController(user: user)
}`,
          hint: "Un `if` con `return` del hosting controller y, si no, la pantalla vieja.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "swift6-migration",
      title: "Plan de migración a Swift 6",
      goal: "Migrar módulo por módulo a Swift 6, aislar la UI con `@MainActor`, usar `Sendable` (y desconfiar de `@unchecked`), convivir con SDKs viejos y manejar deprecaciones y versiones de iOS.",
      minutes: 28,
      steps: [
        {
          kind: "explain",
          title: "El plan: módulo por módulo",
          body: [
            "Compilar con Xcode 16+ no te pone en Swift 6: el **modo de lenguaje** se elige por target (`SWIFT_VERSION`). Podés tener el compilador nuevo con todo el proyecto en modo Swift 5, y migrar de a un módulo.",
            "El plan: (1) en modo Swift 5 activás `SWIFT_STRICT_CONCURRENCY = complete` y todos los problemas de concurrencia aparecen como **warnings**; (2) los arreglás en PRs chicos; (3) pasás ese target a `SWIFT_VERSION = 6.0` y los mismos diagnósticos pasan a ser errores, así nadie reintroduce el problema.",
            "Empezá por los módulos hoja (modelos, networking): sus tipos se usan en todos lados, y hacerlos `Sendable` destraba al resto. En SwiftPM, `swiftSettings: [.swiftLanguageMode(.v5)]` deja un target atrás mientras los demás avanzan.",
            "Desde Swift 6.2 (Xcode 26), un target de app puede además usar `MainActor` como aislamiento por defecto, lo que reduce mucho las anotaciones en código de UI.",
          ],
          code: `// Paso 1: modo Swift 5 con chequeo completo (todo es warning)
SWIFT_VERSION = 5.0
SWIFT_STRICT_CONCURRENCY = complete

// Paso 2: arreglar warnings en PRs chicos, módulos hoja primero

// Paso 3: modo Swift 6 (los mismos diagnósticos son errores)
SWIFT_VERSION = 6.0`,
        },
        {
          kind: "predict",
          prompt: "Pasaste el módulo `Analytics` a `SWIFT_VERSION = 6.0`. ¿Qué dice el compilador?",
          code: swift`final class Analytics {
    static var shared = Analytics()
    func track(_ event: String) { }
}`,
          options: [
            "Nada: `final` alcanza para que sea seguro",
            "Solo un warning sugiriendo `let`",
            "Error: `shared` es estado global mutable no aislado, no es concurrency-safe",
            "Error: en Swift 6 los singletons tienen que ser `actor`",
          ],
          answer: 2,
          explanation: "Una `static var` es estado global mutable al que cualquier hilo puede acceder: en Swift 6 es un error (\"not concurrency-safe because it is nonisolated global shared mutable state\"). Arreglos: `static let` (si el tipo es `Sendable`), aislarla con `@MainActor`, o como último recurso `nonisolated(unsafe)` con una justificación.",
        },
        {
          kind: "explain",
          title: "`@MainActor` en los tipos de UI",
          body: [
            "`UIViewController`, `UIView` y `View` de SwiftUI ya están anotados `@MainActor` en el SDK: tus subclases heredan ese aislamiento. Lo que falta anotar suele ser lo tuyo: view models, coordinators, stores que tocan UI.",
            "Con `@MainActor` en la clase, todo su estado se lee y escribe en el main thread, y el compilador lo verifica. Dentro de una función `async`, después de un `await` volvés al main actor: es seguro asignar estado de UI.",
            "Para código viejo con completion handlers que llegan en cualquier hilo, saltás al main actor con `Task { @MainActor in ... }`. Si sabés que el callback ya llega en main, `MainActor.assumeIsolated { }` lo verifica en runtime sin crear una tarea.",
          ],
          code: swift`protocol ProfileAPI: Sendable {
    func fetchProfile() async throws -> Profile
}

@MainActor
final class ProfileViewModel: ObservableObject {   // o @Observable en iOS 17+
    @Published private(set) var name = ""
    private let api: ProfileAPI

    init(api: ProfileAPI) { self.api = api }

    func load() async {
        do {
            let profile = try await api.fetchProfile()   // sale del main actor mientras espera
            name = profile.name                           // de vuelta en main: seguro
        } catch {
            name = "—"
        }
    }
}

// Callback legacy que llega en un hilo cualquiera:
legacyClient.fetch { result in
    Task { @MainActor in
        viewModel.apply(result)
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Este view model publica estado que lee la UI. Completá la anotación para aislarlo al main thread.",
          code: swift`____
final class CartViewModel: ObservableObject {
    @Published private(set) var total = 0
}`,
          accept: ["^@MainActor$"],
          explanation: "`@MainActor` aísla toda la clase al main actor: cada acceso desde otro contexto necesita `await`, y el compilador garantiza que `@Published` nunca se modifique desde un hilo de fondo.",
          placeholder: "anotación",
        },
        {
          kind: "explain",
          title: "`Sendable` y el peligro de `@unchecked Sendable`",
          body: [
            "`Sendable` significa \"se puede pasar entre dominios de aislamiento sin data races\". Un struct o enum cuyos miembros son `Sendable` lo es (si no es `public`, el compilador lo infiere solo). Una clase `final` con solo `let` de tipos `Sendable` también.",
            "Una clase legacy con estado mutable protegido a mano (un lock, una cola serial) no la puede verificar el compilador. Ahí aparece `@unchecked Sendable`: le decís \"confiá en mí\" y **deja de chequear**. Si un solo método se olvida del lock, tenés una data race que el compilador ya no va a marcar.",
            "Antes de `@unchecked`, probá: convertir en struct, convertir en `actor`, o usar `Mutex` (iOS 18+). Si igual hace falta, que cada acceso pase por el lock y que el PR lo justifique con un comentario.",
          ],
          code: swift`struct Money: Sendable {             // struct con miembros Sendable
    let cents: Int
    let currency: String
}

final class TokenEndpoint: Sendable { // final + solo let Sendable
    let refreshURL: URL
    init(refreshURL: URL) { self.refreshURL = refreshURL }
}

// Legacy con estado mutable protegido a mano:
final class ImageCache: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [URL: Data] = [:]   // solo se toca con el lock tomado

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
          prompt: "Este módulo está en modo Swift 6. Varias `Task` llaman a `cache.add(_:)` en paralelo. ¿Qué pasa?",
          code: swift`final class SessionCache: @unchecked Sendable {
    var tokens: [String] = []
    func add(_ token: String) { tokens.append(token) }
}`,
          options: [
            "Error de compilación: `tokens` es mutable",
            "Compila sin warnings, pero hay una data race real que puede corromper el array o crashear",
            "Compila y es seguro: `@unchecked Sendable` serializa los accesos",
            "Warning de que falta un lock",
          ],
          answer: 1,
          explanation: "`@unchecked Sendable` apaga el chequeo: el compilador no agrega ninguna sincronización ni avisa nada. Dos `append` simultáneos sobre el mismo array son una data race (el Thread Sanitizer la detecta). Arreglo: convertirlo en `actor`, o proteger `tokens` con un lock en cada acceso.",
        },
        {
          kind: "explain",
          title: "SDKs viejos, delegates y `deinit`",
          body: [
            "`@preconcurrency import LegacyPaymentsSDK` baja el ruido de los tipos de un módulo que todavía no adoptó concurrencia (sus tipos no anotados no te generan errores de `Sendable`). Es temporal: se saca cuando el proveedor actualiza el SDK.",
            "Si un controller `@MainActor` conforma un protocolo de delegate sin anotar, Swift 6 se queja de que un método aislado no puede cumplir un requisito no aislado. `extension X: @preconcurrency SomeDelegate` lo acepta y agrega un chequeo en runtime de que la llamada llegue en el main actor.",
            "Ojo con `deinit`: aunque la clase sea `@MainActor`, el `deinit` no está aislado, así que no podés llamar métodos del main actor ahí. Hacé la limpieza explícita antes (por ejemplo desde quien es dueño del objeto). Swift 6.2 agrega `isolated deinit` para correrlo en el actor.",
          ],
          code: swift`@preconcurrency import LegacyPaymentsSDK

extension CheckoutViewController: @preconcurrency PaymentSheetDelegate {
    func paymentSheetDidFinish(_ sheet: PaymentSheet) {
        showReceipt()   // se verifica en runtime que estamos en el main actor
    }
}

@MainActor
final class LocationTracker {
    private var isTracking = false
    func stop() { isTracking = false }

    deinit {
        // stop()   // error: deinit no está aislado al main actor
    }
}`,
        },
        {
          kind: "predict",
          prompt: "Integrás un SDK de analytics que todavía no adoptó concurrencia; su `AnalyticsEvent` no es `Sendable`. Al pasar el módulo a Swift 6 aparecen errores donde mandás eventos desde una `Task`. ¿Primera medida razonable?",
          code: swift`import AnalyticsSDK

Task {
    await uploader.send(AnalyticsEvent(name: "checkout_started"))
    // error: non-Sendable type 'AnalyticsEvent' ...
}`,
          options: [
            "`@preconcurrency import AnalyticsSDK` y un ticket para sacarlo cuando el SDK se actualice",
            "Volver todo el proyecto a modo Swift 5",
            "Agregar `extension AnalyticsEvent: @unchecked Sendable {}` sin mirar su implementación",
            "Hacer un fork del SDK y anotarlo a mano",
          ],
          answer: 0,
          explanation: "`@preconcurrency import` es exactamente para esto: código de terceros que todavía no está auditado. Es local al import y fácil de quitar. Declarar `@unchecked Sendable` sobre un tipo ajeno es prometer algo que no verificaste; volver a Swift 5 o forkear es desproporcionado.",
        },
        {
          kind: "explain",
          title: "Deprecaciones y versiones viejas de iOS",
          body: [
            "Cada WWDC deprecia APIs: `UIApplication.shared.keyWindow` (iOS 13), `NavigationView` a favor de `NavigationStack` (iOS 16). Los warnings de deprecación son backlog: no rompen hoy, pero algún día el SDK los saca.",
            "Si soportás iOS 16 y querés `@Observable` (iOS 17), marcás el tipo con `@available(iOS 17, *)` y bifurcás en runtime con `if #available(iOS 17, *)`, dejando la versión `ObservableObject` como fallback. Cuando subís el deployment target, borrás las ramas viejas.",
            "Para tus propias APIs, `@available(*, deprecated, renamed: \"...\")` marca el método viejo con un warning y un fix-it: la forma más amable de migrar call sites de todo el equipo.",
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
          prompt: "La app soporta iOS 16. Completá el chequeo en runtime para usar la pantalla nueva solo en iOS 17 o superior.",
          code: swift`if ____(iOS 17, *) {
    show(UIHostingController(rootView: FiltersView(model: FiltersModel())), sender: self)
} else {
    show(LegacyFiltersViewController(), sender: self)
}`,
          accept: ["^#available$"],
          explanation: "`#available` es un chequeo en runtime de la versión del sistema; el `*` cubre las demás plataformas. `@available` (con arroba) se usa para anotar declaraciones, no en un `if`.",
          placeholder: "chequeo",
        },
        {
          kind: "write",
          prompt: "Prepará este código para Swift 6. `SessionStore` se usa solo desde la UI: aislalo al main actor y convertí `shared` en constante. `Credentials` viaja entre tareas: convertila en un `struct` `Sendable` con `let token: String`. Sin `@unchecked`.",
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
            { pattern: "@MainActor\\s+final\\s+class\\s+SessionStore", label: "`SessionStore` es `@MainActor`" },
            { pattern: "static\\s+let\\s+shared", label: "`shared` es `static let`" },
            { pattern: "struct\\s+Credentials\\s*:\\s*Sendable", label: "`Credentials` es un `struct` `Sendable`" },
            { pattern: "let\\s+token\\s*:\\s*String\\b", label: "`token` es `let`" },
          ],
          warnings: [
            { pattern: "@unchecked\\s+Sendable", label: "`@unchecked Sendable` apaga el chequeo: no hace falta acá" },
            { pattern: "static\\s+var\\s+shared", label: "`static var` sigue siendo estado global mutable" },
            { pattern: "nonisolated\\(unsafe\\)", label: "`nonisolated(unsafe)` esconde el problema en vez de resolverlo" },
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
          hint: "Un struct con solo `let String` es `Sendable` sin esfuerzo.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: migrar una pantalla legacy sin romperla",
      goal: "Llevar una pantalla Objective-C de storyboard a SwiftUI paso a paso: test de caracterización, costura, modelo nuevo y hosting detrás de un feature flag.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "`OrderSummaryViewController` es Objective-C, vive en `Main.storyboard`, tiene 1800 líneas y llama directo a `[APIClient sharedClient]`. Producto quiere rediseñar la pantalla en SwiftUI, y el resumen de la orden es parte del checkout: no se puede romper.",
            "El plan: (1) fijar con tests de caracterización cómo se calcula y formatea el total hoy; (2) abrir una costura para la carga de datos; (3) escribir el modelo nuevo y hostear la vista SwiftUI desde el coordinator UIKit detrás de un feature flag; (4) rollout gradual y, al final, borrar lo viejo.",
            "El target de tests tiene su propio bridging header que importa `OrderSummaryViewController.h` y `OrderItem.h`. `OrderItem` tiene `initWithPriceCents:quantity:`, que Swift ve como `OrderItem(priceCents:quantity:)`.",
          ],
          code: objc`// OrderSummaryViewController.h
NS_ASSUME_NONNULL_BEGIN
@interface OrderSummaryViewController : UIViewController
@property (nonatomic, copy) NSString *orderID;
- (NSString *)totalTextForItems:(NSArray<OrderItem *> *)items NS_SWIFT_NAME(totalText(for:));
@end
NS_ASSUME_NONNULL_END

// OrderSummaryViewController.m (fragmento)
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
          prompt: "¿Por dónde empezás?",
          code: objc`// OrderSummaryViewController.m: 1800 líneas, 0 tests`,
          options: [
            "Escribir la pantalla SwiftUI nueva; la vieja se borra cuando esté lista",
            "Convertir el `.m` entero a Swift primero",
            "Sacar la pantalla del storyboard",
            "Tests de caracterización de `totalText(for:)` con lo que devuelve hoy, incluidos los casos borde",
          ],
          answer: 3,
          explanation: "Sin red no hay forma de saber si lo nuevo se comporta como lo viejo. Los tests de caracterización fijan el contrato actual (formato `$%.2f`, carrito vacío, cantidades) y después se reusan contra el modelo nuevo. Reescribir o mover primero es cambiar código sin poder verificarlo.",
        },
        {
          kind: "write",
          prompt: "Escribí `OrderTotalsCharacterizationTests` (XCTest) que fije el comportamiento actual de `totalText(for:)`: orden vacía → `\"$0.00\"`, y 2 × 1000 + 1 × 550 centavos → `\"$25.50\"`. Creá el controller con `OrderSummaryViewController()` (no hace falta cargar la vista).",
          starter: swift`import XCTest
@testable import Shop

final class OrderTotalsCharacterizationTests: XCTestCase {
}`,
          checks: [
            { pattern: "func\\s+test\\w*\\(\\)", label: "Tiene al menos un método `test...()`" },
            { pattern: "OrderSummaryViewController\\(\\)", label: "Crea el controller legacy" },
            { pattern: "OrderItem\\(priceCents:\\s*1000,\\s*quantity:\\s*2\\)", label: "Arma el ítem de 1000 × 2" },
            { pattern: "XCTAssertEqual\\([^\\n]*totalText\\(for:", label: "Compara la salida de `totalText(for:)` con `XCTAssertEqual`" },
            { pattern: "\"\\$0\\.00\"", label: "Fija el caso vacío: `\"$0.00\"`" },
            { pattern: "\"\\$25\\.50\"", label: "Fija el caso con ítems: `\"$25.50\"`" },
          ],
          warnings: [
            { pattern: "XCTAssertNotNil", label: "`XCTAssertNotNil` no fija nada: compará contra el texto exacto" },
            { pattern: "loadViewIfNeeded", label: "No hace falta cargar la vista para testear el cálculo" },
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
          hint: "Un test por caso. `totalText(for:)` es el nombre que define `NS_SWIFT_NAME`.",
        },
        {
          kind: "write",
          prompt: "Ahora la costura y el modelo nuevo. Definí `protocol OrderLoading: Sendable` con `func loadOrder(id: String) async throws -> OrderSnapshot`, y una clase `@MainActor` `@Observable` `OrderSummaryModel` con `init(orderID:loader:)`, `private(set) var totalText = \"\"` y `func load() async` que use el loader y formatee igual que el legacy (`String(format: \"$%.2f\", ...)`).",
          starter: swift`// Ya existe:
// struct OrderSnapshot: Sendable { let totalCents: Int }
`,
          checks: [
            { pattern: "protocol\\s+OrderLoading\\s*:\\s*Sendable", label: "Define `OrderLoading: Sendable`" },
            { pattern: "func\\s+loadOrder\\(id:\\s*String\\)\\s*async\\s+throws\\s*->\\s*OrderSnapshot", label: "Requisito `loadOrder(id:) async throws`" },
            { pattern: "@MainActor", label: "El modelo es `@MainActor`" },
            { pattern: "@Observable", label: "El modelo es `@Observable`" },
            { pattern: "init\\(orderID:\\s*String,\\s*loader:\\s*(any\\s+)?OrderLoading", label: "Recibe el loader por `init(orderID:loader:)`" },
            { pattern: "try\\s+await\\s+loader\\.loadOrder\\(id:", label: "Carga con `try await loader.loadOrder(id:)`" },
            { pattern: "String\\(format:\\s*\"\\$%\\.2f\"", label: "Formatea igual que el legacy (`$%.2f`)" },
          ],
          warnings: [
            { pattern: "APIClient\\.shared", label: "Volviste a acoplarte al singleton: usá el loader inyectado" },
            { pattern: "DispatchQueue\\.main", label: "Con `@MainActor` no hace falta `DispatchQueue.main`" },
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
          hint: "Mismo patrón que `ProfileViewModel` de la lección de Swift 6, con `@Observable` en vez de `ObservableObject`.",
        },
        {
          kind: "write",
          prompt: "Último paso de código: en `OrdersCoordinator.showSummary(orderID:)`, si `flags.isEnabled(.swiftUIOrderSummary)`, pusheá un `UIHostingController` con `OrderSummaryView(model:)` (el modelo creado con `OrderSummaryModel(orderID: orderID, loader: loader)`); si no, seguí instanciando la pantalla vieja del storyboard como hoy.",
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
            { pattern: "isEnabled\\(\\s*\\.swiftUIOrderSummary\\s*\\)", label: "Consulta el flag `.swiftUIOrderSummary`" },
            { pattern: "OrderSummaryModel\\(orderID:\\s*orderID,\\s*loader:\\s*loader\\)", label: "Crea el modelo con el loader inyectado" },
            { pattern: "UIHostingController\\(\\s*rootView:\\s*OrderSummaryView\\(model:", label: "Hostea `OrderSummaryView` en un `UIHostingController`" },
            { pattern: "instantiateViewController\\(withIdentifier:\\s*\"OrderSummary\"\\)", label: "Mantiene la pantalla legacy como fallback" },
            { pattern: "pushViewController\\(", label: "Navega con el `UINavigationController` existente" },
          ],
          warnings: [
            { pattern: "#if\\s+DEBUG", label: "Un `#if` se decide al compilar: el flag tiene que ser remoto" },
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
            host.title = "Resumen"
            navigation.pushViewController(host, animated: true)
            return
        }
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let legacy = storyboard.instantiateViewController(withIdentifier: "OrderSummary") as! OrderSummaryViewController
        legacy.orderID = orderID
        navigation.pushViewController(legacy, animated: true)
    }
}`,
          hint: "Un `if` con `return` antes del código legacy, que queda tal cual.",
        },
        {
          kind: "predict",
          prompt: "La versión SwiftUI lleva un mes al 100% sin incidentes. ¿Qué sigue?",
          code: swift`// flag swiftUIOrderSummary: 100% desde hace 30 días
// crash-free igual o mejor que la versión legacy`,
          options: [
            "Dejar el flag para siempre, por las dudas",
            "Portar los tests de caracterización al modelo nuevo y, en un PR dedicado, borrar el flag, el `.h`/`.m`, la escena del storyboard y sus entradas en los bridging headers",
            "Bajar el flag al 50% para comparar métricas un mes más",
            "Reescribir el `.m` en Swift para tenerlo de backup",
          ],
          answer: 1,
          explanation: "Un flag que ya no se va a apagar es deuda: dos caminos para mantener y testear. Primero se portan los tests de caracterización a `OrderSummaryModel` (para no perder la red) y después se borra todo lo viejo junto, en un PR fácil de revisar y de revertir.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-nil-message",
      front: "¿Qué pasa en Objective-C si le enviás un mensaje a `nil`?",
      back: "Nada: no crashea y devuelve el valor cero del tipo (`nil`, `0`, `NO`). Por eso hay bugs legacy silenciosos.",
      code: objc`NSString *name = nil;
NSUInteger length = [name length];   // 0`,
    },
    {
      id: "fc-copy-nsstring",
      front: "¿Por qué una property `NSString` va con `copy` y no con `strong`?",
      back: "Porque te pueden pasar un `NSMutableString` y mutarlo después. Con `copy` guardás una copia inmutable; con `strong` tu valor cambia a tus espaldas.",
    },
    {
      id: "fc-iuo-import",
      front: "¿Cómo llega a Swift un puntero de Objective-C sin anotar?",
      back: "Como optional implícitamente desempaquetado (`String!`): compila sin `?` y crashea si vino `nil`. Se arregla con `nullable`/`nonnull` o `NS_ASSUME_NONNULL_BEGIN`.",
    },
    {
      id: "fc-assume-nonnull",
      front: "¿Qué hace `NS_ASSUME_NONNULL_BEGIN`/`END`?",
      back: "Marca como `nonnull` todos los punteros del bloque; solo anotás con `nullable` (o `_Nullable`) lo que puede faltar.",
    },
    {
      id: "fc-bridging",
      front: "¿Cómo ve Swift el Objective-C de la app, y Objective-C el Swift?",
      back: "Objective-C → Swift: bridging header (`MyApp-Bridging-Header.h`). Swift → Objective-C: `#import \"MyApp-Swift.h\"` en los `.m` (en los `.h`, `@class`).",
    },
    {
      id: "fc-objc-attr",
      front: "Heredar de `NSObject`, ¿alcanza para que un método Swift se vea desde Objective-C?",
      back: "No. Desde Swift 4 hay que marcarlo `@objc` (o la clase con `@objcMembers`). Structs, genéricos y enums con associated values no se exponen.",
    },
    {
      id: "fc-swift-name",
      front: "¿Para qué sirve `NS_SWIFT_NAME`?",
      back: "Para darle a una declaración de Objective-C un nombre idiomático en Swift sin cambiar el selector que usan los call sites viejos.",
      code: objc`- (BOOL)isExpiredAtDate:(NSDate *)date NS_SWIFT_NAME(isExpired(at:));`,
    },
    {
      id: "fc-unknown-key",
      front: "`NSUnknownKeyException ... not key value coding-compliant for the key x`: ¿qué buscás?",
      back: "Un outlet (o binding) del storyboard/XIB que apunta a una property `x` que ya no existe: se renombró o borró en el código sin desconectarla.",
    },
    {
      id: "fc-prepare-outlets",
      front: "¿Por qué no se puede usar un outlet del destino en `prepare(for:sender:)`?",
      back: "Porque la vista del destino todavía no se cargó y sus outlets son `nil`. Pasá datos por properties y pintalos en `viewDidLoad`.",
    },
    {
      id: "fc-containment",
      front: "Los tres pasos para embeber un `UIHostingController` como child",
      back: "`addChild(host)`, agregar `host.view` con constraints, `host.didMove(toParent: self)`. Para tamaño dinámico, `sizingOptions = .intrinsicContentSize` (iOS 16+).",
    },
    {
      id: "fc-coordinator",
      front: "¿Para qué está el `Coordinator` en un `UIViewRepresentable`?",
      back: "Para ser el delegate/target de UIKit: es una clase con vida estable, mientras que el struct del representable se recrea en cada actualización.",
    },
    {
      id: "fc-characterization",
      front: "¿Qué es un test de caracterización?",
      back: "Un test que fija lo que el código hace hoy (no lo que debería). Es la red para refactorizar; los bugs que revela se arreglan en otro PR.",
    },
    {
      id: "fc-seam",
      front: "¿Cómo abrís una costura sin romper los call sites?",
      back: "Extraés un protocolo y lo inyectás por `init` con valor por defecto igual al de producción. Si no controlás el `init`: subclase y override de un método fábrica.",
      code: swift`init(api: ProfileAPI = LiveProfileAPI()) { self.api = api }`,
    },
    {
      id: "fc-strangler",
      front: "Strangler fig en una app iOS",
      back: "La pantalla nueva convive con la vieja; un único punto de ruteo decide con un feature flag remoto. Rollout gradual, y al llegar al 100% estable se borran el flag y lo viejo.",
    },
    {
      id: "fc-unchecked-sendable",
      front: "¿Cuál es el riesgo de `@unchecked Sendable`?",
      back: "Apaga el chequeo del compilador. Si un acceso al estado mutable no pasa por el lock, hay data race y nadie te avisa. Preferí struct, `actor` o `Mutex`.",
    },
  ],

  exam: [
    {
      id: "ex-01",
      question: "Crashlytics reporta `[MyApp.ProfileViewController setValue:forUndefinedKey:]: this class is not key value coding-compliant for the key avatarImageView` justo después de un release con un refactor. ¿Cuál es la causa más probable?",
      options: [
        "Un outlet del storyboard sigue apuntando a una property `avatarImageView` que se renombró o borró en el código",
        "La imagen del avatar no se descargó a tiempo",
        "Falta `@objc` en la clase `ProfileViewController`",
        "`avatarImageView` está declarado `weak` y se liberó",
      ],
      answer: 0,
      explanation: "Al cargar la vista, UIKit setea cada outlet por KVC usando el nombre guardado en el XML. Si la property ya no existe, `setValue:forUndefinedKey:` tira `NSUnknownKeyException`. Se arregla reconectando o borrando el outlet en Interface Builder.",
    },
    {
      id: "ex-02",
      question: "Un método Objective-C `- (NSString *)displayName;` a veces devuelve `nil`. Desde Swift, `let n: String = user.displayName()` compila y crashea en producción. ¿Qué cambio hacés en el header?",
      options: [
        "Agregar `@objc` al método",
        "Cambiar la property a `copy`",
        "Envolver el header en `NS_ASSUME_NONNULL_BEGIN`/`END` y marcar el retorno `nullable`, para que Swift vea `String?`",
        "Agregar `NS_SWIFT_NAME(displayName())`",
      ],
      answer: 2,
      explanation: "Sin anotaciones el retorno llega como `String!` y Swift te deja usarlo como no opcional. Con `nullable` llega como `String?` y el compilador obliga a manejar el caso `nil` en cada call site.",
    },
    {
      id: "ex-03",
      question: "La app es UIKit con `UICollectionView`, el target mínimo es iOS 16 y querés que las celdas nuevas se escriban en SwiftUI. ¿Qué usás?",
      options: [
        "Un `UIHostingController` por celda, agregado como child del view controller en `cellForItemAt`",
        "`cell.contentConfiguration = UIHostingConfiguration { RowView(item: item) }`",
        "Reescribir la lista entera en SwiftUI antes de tocar celdas",
        "Un `UIViewRepresentable` dentro de la celda",
      ],
      answer: 1,
      explanation: "`UIHostingConfiguration` (iOS 16+) existe justamente para celdas de `UICollectionView`/`UITableView`: maneja reuso y self-sizing. Un hosting controller por celda es caro y complica la contención; un representable es para lo inverso (UIKit dentro de SwiftUI).",
    },
    {
      id: "ex-04",
      question: "Agregaste `func refresh()` a `final class FeedStore: NSObject` en Swift. Un `.m` legacy importa `MyApp-Swift.h` pero `[store refresh]` no compila. ¿Por qué?",
      options: [
        "Las clases `final` no se exponen a Objective-C",
        "Hay que importar `FeedStore.swift` en el bridging header",
        "Los métodos Swift no pueden llamarse desde Objective-C",
        "Falta `@objc` en `refresh()` (o `@objcMembers` en la clase): heredar de `NSObject` no expone los métodos",
      ],
      answer: 3,
      explanation: "Desde Swift 4 la inferencia de `@objc` es mínima: la clase se ve por heredar de `NSObject`, pero cada miembro necesita `@objc` explícito (o `@objcMembers` para todos). El bridging header es para la dirección opuesta.",
    },
    {
      id: "ex-05",
      question: "Tenés que cambiar la regla de descuentos dentro de un view controller de 3000 líneas sin tests. Producto lo quiere esta semana. ¿Cuál es el primer paso?",
      options: [
        "Hacer el cambio y probar a mano en el simulador",
        "Reescribir el view controller en SwiftUI con la regla nueva",
        "Escribir tests de caracterización del cálculo actual, extraer el cálculo a un tipo aparte sin cambiar comportamiento y recién ahí cambiar la regla con un test nuevo",
        "Agregar UI tests de todo el flujo de checkout",
      ],
      answer: 2,
      explanation: "La red mínima es caracterizar lo que vas a tocar; extraer el cálculo (refactor puro) lo vuelve testeable, y el cambio de regla va después, con su test. Reescribir todo no entra en una semana y los UI tests son lentos para fijar reglas de negocio.",
    },
    {
      id: "ex-06",
      question: "Una app de 12 módulos SwiftPM tiene que migrar a Swift 6 sin congelar features. ¿Qué plan proponés?",
      options: [
        "Módulos hoja primero: `StrictConcurrency` completo en modo Swift 5, arreglar warnings en PRs chicos y pasar cada módulo a modo Swift 6; los demás quedan en `.swiftLanguageMode(.v5)` hasta su turno",
        "Pasar todos los módulos a Swift 6 en una rama larga y mergear cuando compile",
        "Esperar a que Apple obligue a usar Swift 6",
        "Empezar por el target de la app, que es donde más código hay",
      ],
      answer: 0,
      explanation: "El modo de lenguaje es por target, así que se puede avanzar de a uno. Los módulos hoja definen tipos que usan todos: hacerlos `Sendable` primero reduce los errores de los de arriba. Una rama larga genera conflictos eternos.",
    },
    {
      id: "ex-07",
      question: "En un PR ves `final class TokenCache: @unchecked Sendable { var tokens: [String: String] = [:] }` sin ningún lock, \"para que compile en Swift 6\". ¿Qué comentás?",
      options: [
        "Aprobar: `@unchecked Sendable` es la forma estándar de migrar",
        "Pedir que se agregue `nonisolated(unsafe)` a `tokens`",
        "Pedir que la clase herede de `NSObject`",
        "Pedir convertirlo en `actor` (o proteger cada acceso con un lock/`Mutex`): así como está es una data race que el compilador ya no detecta",
      ],
      answer: 3,
      explanation: "`@unchecked` no agrega sincronización; solo silencia el chequeo. Con un diccionario mutable accedido desde varias tareas, el resultado es corrupción de memoria o crashes intermitentes. `nonisolated(unsafe)` es el mismo problema con otro nombre.",
    },
    {
      id: "ex-08",
      question: "Envolviste `MKMapView` en un `UIViewRepresentable`. Cada vez que el usuario escribe en un `TextField` de la misma pantalla, el mapa vuelve a centrarse y pierde el zoom del usuario. ¿Qué pasa?",
      options: [
        "`makeUIView` se llama en cada tecla y crea un mapa nuevo",
        "`updateUIView` asigna la región incondicionalmente; se ejecuta con cada cambio de estado y pisa lo que hizo el usuario. Hay que comparar antes de asignar (o guardar en el `Coordinator` la última región aplicada)",
        "Falta `makeCoordinator()`",
        "Hay que envolver el mapa en un `UIHostingController`",
      ],
      answer: 1,
      explanation: "`makeUIView` corre una sola vez; `updateUIView` corre cada vez que cambia estado del que depende la vista padre. Un update no idempotente resetea la vista UIKit. La solución es aplicar solo cambios reales.",
    },
    {
      id: "ex-09",
      question: "Reescribiste el checkout en SwiftUI. Querés liberarlo al 5% de usuarios y poder apagarlo en minutos si suben los crashes. ¿Qué diseño?",
      options: [
        "Un `#if NEW_CHECKOUT` y un build separado para TestFlight",
        "Reemplazar la pantalla vieja y, si hay problemas, hacer un hotfix",
        "Un único punto de ruteo (coordinator/factory) que elige entre la pantalla legacy y un `UIHostingController` según un feature flag remoto",
        "Mostrar las dos pantallas y que el usuario elija",
      ],
      answer: 2,
      explanation: "Es el patrón strangler fig: lo viejo queda intacto y un flag remoto decide en runtime, sin release. Un `#if` se decide al compilar, y un hotfix tarda días en revisión.",
    },
    {
      id: "ex-10",
      question: "En Swift 6, `extension CheckoutViewController: PaymentSheetDelegate` falla: \"main actor-isolated instance method cannot be used to satisfy nonisolated protocol requirement\". El SDK siempre llama en el main thread pero no lo declara. ¿Qué hacés?",
      options: [
        "Marcar `CheckoutViewController` como `nonisolated`",
        "Declarar la conformidad como `@preconcurrency PaymentSheetDelegate`, que acepta la conformidad y verifica en runtime que la llamada llegue en el main actor",
        "Envolver el cuerpo de cada método en `DispatchQueue.main.async`",
        "Volver el módulo a modo Swift 5",
      ],
      answer: 1,
      explanation: "La conformidad `@preconcurrency` es para protocolos de código que todavía no expresa su aislamiento. Mantiene el método en el main actor y agrega un chequeo dinámico: si el SDK alguna vez llama desde otro hilo, lo vas a ver enseguida.",
    },
    {
      id: "ex-11",
      question: "El 18% de tus usuarios sigue en iOS 16 y querés usar `@Observable` en una pantalla nueva. ¿Cómo lo hacés?",
      options: [
        "Subir el deployment target a iOS 17 y perder esos usuarios",
        "Usar `@Observable` sin anotaciones: el compilador lo adapta",
        "No usar SwiftUI hasta que todos estén en iOS 17",
        "Marcar el modelo con `@available(iOS 17, *)` y bifurcar con `if #available(iOS 17, *)`, manteniendo la versión con `ObservableObject` (o la pantalla legacy) como fallback",
      ],
      answer: 3,
      explanation: "`@available` limita la declaración y `#available` decide en runtime. Cuando las métricas muestren que podés subir el deployment target, se borra el fallback. Subirlo ya es una decisión de negocio, no técnica.",
    },
    {
      id: "ex-12",
      question: "En una entrevista te preguntan: \"¿Cómo llevarías a SwiftUI una app UIKit de 6 años con partes en Objective-C?\". ¿Qué respuesta muestra seniority?",
      options: [
        "Incremental: pantallas nuevas en SwiftUI hosteadas con `UIHostingController`, navegación en UIKit, tests de caracterización antes de tocar lo viejo, flags para el rollout y migrar lo existente solo cuando hay que cambiarlo",
        "Reescribir la app en SwiftUI en paralelo y lanzarla cuando esté completa",
        "Convertir primero todo el Objective-C a Swift y después pasar a SwiftUI",
        "No migrar: UIKit sigue funcionando",
      ],
      answer: 0,
      explanation: "La reescritura completa congela el producto y suele fallar; convertir todo el Objective-C antes no entrega valor. La respuesta senior es incremental, medible y reversible, y prioriza el código que de todas formas hay que tocar.",
    },
  ],
};

export default content;
