import { Flashcard } from "./types";

export const flashcards: Flashcard[] = [
  // Swift core
  { id: "f1", topic: "swift", front: "¿Cómo accedés al tercer carácter de un String en Swift?", back: "Un String no se indexa con Int. Convertí a array: `Array(str)[2]`, o usá `str[str.index(str.startIndex, offsetBy: 2)]`.", code: "let chars = Array(\"hola\")\nprint(chars[2]) // l" },
  { id: "f2", topic: "swift", front: "¿Qué devuelve `Int(\"3.0\")`?", back: "`nil`. `Int(_:)` solo parsea enteros. Usá `Double(\"3.0\")` y luego `Int(...)`." },
  { id: "f3", topic: "swift", front: "Diferencia entre `sorted()` y `sort()`", back: "`sorted()` devuelve una copia ordenada (funciona en `let`). `sort()` muta en el lugar (requiere `var`)." },
  { id: "f4", topic: "swift", front: "Contar frecuencias de caracteres en una línea", back: "Usá el subíndice con `default:`.", code: "var counts: [Character: Int] = [:]\nfor c in text { counts[c, default: 0] += 1 }" },
  { id: "f5", topic: "swift", front: "`map` vs `compactMap` vs `flatMap`", back: "`map` transforma 1→1. `compactMap` transforma y descarta `nil`. `flatMap` aplana colecciones anidadas (o `Optional<Optional>`)." },
  { id: "f6", topic: "swift", front: "¿Cómo detectás un duplicado en O(n)?", back: "Con un `Set`: `insert` devuelve una tupla `(inserted, memberAfterInsert)`.", code: "var seen = Set<Int>()\nfor x in nums { if !seen.insert(x).inserted { return x } }\nreturn -1" },
  { id: "f7", topic: "swift", front: "`struct` vs `class`", back: "struct = value type (se copia, sin herencia, inmutable con `let`). class = reference type (se comparte, herencia, ARC, `deinit`). Preferí struct salvo que necesites identidad compartida." },
  { id: "f8", topic: "swift", front: "¿Qué hace `guard let`?", back: "Desenvuelve un optional y obliga a salir del scope (`return`, `throw`, `continue`) si es `nil`. La variable queda disponible después del guard." },
  { id: "f9", topic: "swift", front: "Ordenar por dos criterios (score desc, nombre asc)", back: "Comparar el primero; si empata, el segundo.", code: "items.sorted { $0.score != $1.score ? $0.score > $1.score : $0.name < $1.name }" },
  { id: "f10", topic: "swift", front: "¿Cómo invertís las palabras de una frase?", back: "`split` → `reversed` → `joined`.", code: "s.split(separator: \" \").reversed().joined(separator: \" \")" },
  { id: "f11", topic: "swift", front: "¿Qué pasa con `7 / 2` en Swift?", back: "Da `3`: división entera entre `Int`. Para decimal: `7.0 / 2` o `Double(7) / 2`." },
  { id: "f12", topic: "swift", front: "¿Para qué sirve `inout`?", back: "Permite que una función modifique el argumento original. Se llama con `&`: `swap(&a, &b)`." },
  { id: "f13", topic: "swift", front: "Agrupar elementos por una clave", back: "`Dictionary(grouping:by:)`.", code: "let byCurrency = Dictionary(grouping: txs, by: { $0.currency })" },
  { id: "f14", topic: "swift", front: "¿Qué es un retain cycle y cómo se rompe?", back: "Dos objetos se retienen mutuamente (o un closure retiene a `self` que retiene al closure). Se rompe con `[weak self]` o `unowned`, o con `weak var delegate`." },
  { id: "f15", topic: "swift", front: "`weak` vs `unowned`", back: "`weak` es optional y se pone en `nil` al liberarse. `unowned` no es optional y crashea si el objeto ya no existe; usalo solo si el otro objeto siempre vive más." },
  { id: "f16", topic: "swift", front: "¿Cómo iterás con índice y valor?", back: "`for (i, x) in nums.enumerated()`." },
  { id: "f17", topic: "swift", front: "Recorrer de 10 a 0 de a 2", back: "`for i in stride(from: 10, through: 0, by: -2)`." },
  { id: "f18", topic: "swift", front: "Enum con valores asociados", back: "Cada caso puede llevar datos distintos; se extraen con `switch` o `if case`.", code: "enum Result { case ok(Int); case fail(String) }\nif case .ok(let v) = r { print(v) }" },

  // Algoritmos
  { id: "a1", topic: "algoritmos", front: "Complejidad de buscar en `Set` vs `Array`", back: "`Set.contains` O(1) promedio. `Array.contains` O(n). `Array` ordenado + búsqueda binaria O(log n)." },
  { id: "a2", topic: "algoritmos", front: "Patrón: suma máxima de una ventana de tamaño k", back: "Sliding window: calculá la primera ventana y desplazá sumando el nuevo y restando el que sale. O(n)." },
  { id: "a3", topic: "algoritmos", front: "Patrón: paréntesis balanceados", back: "Stack. Al ver apertura, push; al ver cierre, pop y comparar. Al final el stack debe estar vacío." },
  { id: "a4", topic: "algoritmos", front: "Patrón: dos punteros", back: "Dos índices que avanzan desde los extremos o a distinta velocidad. Sirve para palíndromos, pares que suman X en array ordenado, quitar duplicados in-place." },
  { id: "a5", topic: "algoritmos", front: "¿Cuándo usar un hash map en un reto?", back: "Cuando necesitás buscar, contar o agrupar en O(1): duplicados, frecuencias, two-sum, anagramas." },
  { id: "a6", topic: "algoritmos", front: "Complejidad de ordenar y de `Dictionary` lookup", back: "Ordenar: O(n log n). Lookup en Dictionary: O(1) promedio. Insertar al final de Array: O(1) amortizado; al inicio: O(n)." },
  { id: "a7", topic: "algoritmos", front: "¿Qué edge cases probás siempre?", back: "Vacío, un elemento, todos iguales, negativos, k > n, Unicode/mayúsculas, límites de rango (`..<` vs `...`)." },

  // Ingeniería
  { id: "e1", topic: "ingenieria", front: "SOLID en una línea cada uno", back: "S: una razón para cambiar. O: abierto a extensión, cerrado a modificación. L: subtipos sustituibles. I: interfaces pequeñas. D: depender de abstracciones." },
  { id: "e2", topic: "ingenieria", front: "`git rebase` vs `git merge`", back: "merge crea un commit de unión y preserva historia. rebase reescribe tus commits encima de la base (hashes nuevos, historia lineal). No rebasees ramas compartidas." },
  { id: "e3", topic: "ingenieria", front: "Pirámide de testing", back: "Muchos unit tests (rápidos, aislados), menos de integración, pocos end-to-end/UI (lentos, frágiles)." },
  { id: "e4", topic: "ingenieria", front: "Patrón Repository", back: "Abstrae el acceso a datos detrás de un protocolo (`UserRepository`), así el dominio no sabe si viene de red, caché o disco." },
  { id: "e5", topic: "ingenieria", front: "Patrón Strategy vs Factory", back: "Strategy: intercambiar algoritmos en runtime vía protocolo. Factory: centralizar la creación de objetos según un criterio." },

  // REST
  { id: "r1", topic: "rest", front: "401 vs 403", back: "401 Unauthorized: no autenticado o token inválido/expirado. 403 Forbidden: autenticado pero sin permiso." },
  { id: "r2", topic: "rest", front: "Verbos idempotentes", back: "GET, PUT, DELETE, HEAD, OPTIONS. POST y PATCH no (en general)." },
  { id: "r3", topic: "rest", front: "Estructura de un JWT", back: "`header.payload.signature` en base64url. Se verifica la firma; el payload no está cifrado, solo codificado. `exp` marca expiración." },
  { id: "r4", topic: "rest", front: "¿Dónde guardás el token en iOS?", back: "Keychain (cifrado por el sistema). Nunca en UserDefaults ni en un archivo plano." },
  { id: "r5", topic: "rest", front: "¿Qué es un BFF?", back: "Backend For Frontend: una capa de API específica para el cliente mobile que agrega y adapta varios servicios en una sola respuesta." },
  { id: "r6", topic: "rest", front: "Códigos 201, 204, 409, 422, 429", back: "201 creado. 204 sin contenido. 409 conflicto. 422 entidad no procesable (validación). 429 demasiadas requests." },

  // iOS
  { id: "i1", topic: "ios", front: "`@StateObject` vs `@ObservedObject`", back: "`@StateObject`: la vista es dueña y lo crea una sola vez. `@ObservedObject`: la vista lo recibe de afuera y no controla su ciclo de vida." },
  { id: "i2", topic: "ios", front: "`@State` vs `@Binding`", back: "`@State` es estado propio y privado de la vista. `@Binding` es una referencia de lectura/escritura a un estado que vive en otra vista." },
  { id: "i3", topic: "ios", front: "Capas de MVVM + Clean", back: "View → ViewModel → UseCase (dominio) → Repository (protocolo) → DataSource (red/local). Las dependencias apuntan hacia el dominio." },
  { id: "i4", topic: "ios", front: "`async/await` vs Combine", back: "async/await: operaciones puntuales (una request). Combine: flujos continuos de valores (búsqueda con debounce, estado reactivo). Hoy se prefiere async/await + `@Observable` y Combine solo donde hay streams." },
  { id: "i5", topic: "ios", front: "¿Qué hace `@MainActor`?", back: "Garantiza que el código marcado corre en el hilo principal. Los ViewModels que actualizan UI suelen marcarse con `@MainActor`." },
  { id: "i6", topic: "ios", front: "`actor` en Swift", back: "Tipo de referencia que protege su estado mutable: solo un acceso a la vez, llamadas con `await` desde afuera. Evita data races." },
  { id: "i7", topic: "ios", front: "Inyección de dependencias sin framework", back: "Protocolos + inicializadores. Un composition root (AppContainer) arma el grafo. En tests inyectás mocks." },
  { id: "i8", topic: "ios", front: "`Task` y cancelación", back: "`Task { }` crea trabajo concurrente; `.task {}` en SwiftUI lo cancela al desaparecer la vista. Revisá `Task.isCancelled` o `try Task.checkCancellation()`." },
  { id: "i9", topic: "ios", front: "Lifecycle de UIViewController", back: "init → loadView → viewDidLoad → viewWillAppear → viewDidAppear → viewWillDisappear → viewDidDisappear → deinit." },
  { id: "i10", topic: "ios", front: "`@Observable` (iOS 17+)", back: "Macro que reemplaza `ObservableObject`/`@Published`: la vista observa solo las propiedades que lee. Se usa con `@State` (dueño) o pasando la instancia." },

  // Seguridad
  { id: "s1", topic: "seguridad", front: "Keychain vs UserDefaults", back: "Keychain: cifrado, sobrevive reinstalación según configuración, para secretos. UserDefaults: plist sin cifrar, para preferencias." },
  { id: "s2", topic: "seguridad", front: "Certificate pinning", back: "Verificar que el certificado del servidor (o su clave pública) coincida con uno embebido en la app. Mitiga MITM. Se implementa en `URLSessionDelegate` `didReceive challenge`." },
  { id: "s3", topic: "seguridad", front: "Face ID / Touch ID en código", back: "`LAContext().evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, ...)`. Antes `canEvaluatePolicy` para saber si está disponible; tener fallback a passcode." },
  { id: "s4", topic: "seguridad", front: "OWASP Mobile Top 10 (algunos)", back: "Credenciales mal usadas, cadena de suministro insegura, autenticación/autorización débil, validación insuficiente, comunicación insegura, privacidad, protección binaria, configuración, almacenamiento inseguro, criptografía insuficiente." },
  { id: "s5", topic: "seguridad", front: "ATS (App Transport Security)", back: "Fuerza HTTPS/TLS 1.2+. No agregues `NSAllowsArbitraryLoads` en producción." },
  { id: "s6", topic: "seguridad", front: "Refresh de token con requests concurrentes", back: "Serializar el refresh: una sola request de refresh en vuelo (actor o lock), las demás esperan y reintentan con el nuevo token." },

  // Testing / release
  { id: "t1", topic: "testing", front: "XCTest vs XCUITest", back: "XCTest: unit tests de lógica (ViewModel, use cases) con mocks. XCUITest: UI end-to-end sobre la app real por accesibilidad." },
  { id: "t2", topic: "testing", front: "¿Cómo mockeás la red?", back: "Protocolo `HTTPClient` inyectado; en tests una implementación que devuelve datos fijos. O `URLProtocol` custom para interceptar `URLSession`." },
  { id: "t3", topic: "testing", front: "Instrumentos clave de Instruments", back: "Time Profiler (CPU), Allocations y Leaks (memoria), Network, Core Animation (frames), Energy." },
  { id: "t4", topic: "testing", front: "Flujo de release", back: "Branch release → bump version/build → archive → TestFlight interno → externo (beta review) → App Store review → phased release → monitoreo de crashes." },
  { id: "t5", topic: "testing", front: "Métricas de calidad en producción", back: "Crash-free users/sessions (Crashlytics), hangs y launch time (MetricKit/Organizer), tasa de error de red, ANR equivalentes." },
];
