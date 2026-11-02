import type { CourseContent } from "../types";

// El código Swift va con String.raw para no perder las barras de `\(...)` ni de `\.keyPath`.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "keychain-storage",
      title: "Keychain y almacenamiento seguro",
      goal: "Guardar tokens en el Keychain con `SecItemAdd`/`SecItemCopyMatching`/`SecItemUpdate`/`SecItemDelete`, elegir el atributo de accesibilidad correcto y proteger archivos con Data Protection.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El cliente es territorio enemigo",
          body: [
            "La regla base de todo el curso: **el dispositivo no es tuyo**. Cualquier cosa que esté en el binario o en el contenedor de la app puede leerse con un backup sin cifrar, un dispositivo con jailbreak o un debugger. Y toda validación importante se repite en el servidor.",
            "`UserDefaults` es un `.plist` en `Library/Preferences/` del contenedor de la app, en texto plano. Sirve para preferencias (tema, último tab abierto), **nunca** para tokens, contraseñas ni datos personales.",
            "El lugar para secretos chicos (tokens, contraseñas, claves) es el **Keychain**: una base cifrada que maneja el sistema, con protección atada al passcode del dispositivo y, si querés, a la biometría.",
          ],
          code: swift`// MAL: queda en texto plano en Library/Preferences/com.acme.bank.plist
UserDefaults.standard.set(refreshToken, forKey: "refreshToken")

// $ plutil -p Library/Preferences/com.acme.bank.plist
// {
//   "refreshToken" => "eyJhbGciOiJIUzI1NiJ9..."
// }

// BIEN: Keychain (lo armamos en esta lección)
try tokenStore.save(refreshToken, account: "refresh-token")`,
        },
        {
          kind: "predict",
          prompt: "Tu app recibe un `refreshToken` de 90 días al loguearse. En el PR, ¿dónde proponés guardarlo?",
          code: swift`func didLogin(_ response: LoginResponse) {
    // ¿Dónde guardamos response.refreshToken?
}`,
          options: [
            "En `UserDefaults`, total la app está en sandbox",
            "En un archivo JSON en `Documents/` para poder debuggearlo",
            "En el Keychain como `kSecClassGenericPassword` con accesibilidad `...ThisDeviceOnly`",
            "Hardcodeado en el binario con una clave de ofuscación",
          ],
          answer: 2,
          explanation:
            "El sandbox evita que **otras apps** lean tus archivos, pero no protege contra backups, dispositivos con jailbreak ni análisis forense. `Documents/` además se ve en la app Archivos si activaste file sharing. El Keychain cifra el ítem y, con `ThisDeviceOnly`, no viaja a otro dispositivo en un backup.",
        },
        {
          kind: "explain",
          title: "Anatomía de una query del Keychain",
          body: [
            "El Keychain se usa con cuatro funciones de C del framework `Security`: `SecItemAdd`, `SecItemCopyMatching`, `SecItemUpdate` y `SecItemDelete`. Todas reciben un diccionario (casteado a `CFDictionary`) y devuelven un `OSStatus`: `errSecSuccess` si salió bien.",
            "Un ítem de tipo `kSecClassGenericPassword` se identifica por `kSecAttrService` (tu app o subsistema, ej. `com.acme.bank.auth`) más `kSecAttrAccount` (qué secreto es, ej. `refresh-token`). Esa dupla es la clave primaria.",
            "Para leer pedís `kSecReturnData: true` y `kSecMatchLimit: kSecMatchLimitOne`, y pasás un `CFTypeRef?` por referencia. Si no existe, el status es `errSecItemNotFound`: no es un error, es \"todavía no hay token\".",
          ],
          code: swift`import Foundation
import Security

let base: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.acme.bank.auth",
    kSecAttrAccount as String: "refresh-token",
]

// Guardar
var add = base
add[kSecValueData as String] = Data("eyJhbGciOi...".utf8)
let addStatus = SecItemAdd(add as CFDictionary, nil)

// Leer
var query = base
query[kSecReturnData as String] = true
query[kSecMatchLimit as String] = kSecMatchLimitOne

var item: CFTypeRef?
let status = SecItemCopyMatching(query as CFDictionary, &item)
if status == errSecSuccess, let data = item as? Data {
    let token = String(decoding: data, as: UTF8.self)
    // usar token (nunca imprimirlo)
} else if status == errSecItemNotFound {
    // no hay sesión guardada
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la función que busca el ítem y lo devuelve en `item`.",
          code: swift`var item: CFTypeRef?
let status = ____(query as CFDictionary, &item)
guard status == errSecSuccess, let data = item as? Data else { return nil }`,
          accept: ["^SecItemCopyMatching$"],
          hint: "Es la función de lectura: \"copia los ítems que coinciden\".",
          explanation: "`SecItemCopyMatching` busca con la query y, como pediste `kSecReturnData`, deja el `Data` del secreto en `item`.",
        },
        {
          kind: "predict",
          prompt: "`NaiveKeychain.add` solo llama a `SecItemAdd` y `read` usa `SecItemCopyMatching`, ambos con el mismo service/account. ¿Qué imprime?",
          code: swift`let keychain = NaiveKeychain(service: "com.acme.bank.auth")

let first = keychain.add("abc", account: "user")
let second = keychain.add("xyz", account: "user")

print(first == errSecSuccess, second == errSecDuplicateItem)
print(keychain.read(account: "user") ?? "nil")`,
          options: ["`true true` y `abc`", "`true false` y `xyz`", "`true true` y `xyz`", "`false true` y `nil`"],
          answer: 0,
          explanation:
            "`SecItemAdd` no pisa: si ya existe un ítem con esa clave primaria devuelve `errSecDuplicateItem` y deja el valor viejo. Por eso el patrón de un `save` es: intentar `SecItemAdd` y, si da duplicado, hacer `SecItemUpdate` (o borrar y volver a agregar). Este bug deja tokens viejos y produce \"me desloguea solo\" en producción.",
        },
        {
          kind: "explain",
          title: "Accesibilidad y Data Protection",
          body: [
            "`kSecAttrAccessible` define **cuándo** se puede leer el ítem. `kSecAttrAccessibleWhenUnlocked` (el default): solo con el dispositivo desbloqueado. `kSecAttrAccessibleAfterFirstUnlock`: después del primer desbloqueo tras reiniciar, ideal si refrescás tokens en background. `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`: solo si hay passcode configurado.",
            "El sufijo `ThisDeviceOnly` hace que el ítem **no migre** a otro dispositivo al restaurar un backup. Para tokens de sesión es lo que querés: un dispositivo nuevo tiene que loguearse de nuevo.",
            "Para archivos (un PDF de resumen bancario, una base SQLite con datos personales) usá **Data Protection**: el sistema los cifra con una clave atada al passcode. `.completeFileProtection` los hace ilegibles mientras el dispositivo está bloqueado.",
            "Ojo: los ítems del Keychain pueden sobrevivir a la desinstalación de la app. Si reinstalan, puede aparecer una sesión vieja; lo resolvemos en el reto final.",
          ],
          code: swift`// Ítem que un refresh en background puede leer, y que no viaja en backups
add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

// Archivo cifrado mientras el dispositivo esté bloqueado
let url = URL.documentsDirectory.appending(path: "statement-2026-10.pdf")
try pdfData.write(to: url, options: .completeFileProtection)

// O para un archivo ya creado
try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.complete],
    ofItemAtPath: url.path()
)`,
        },
        {
          kind: "fill",
          prompt: "La app refresca el token con una background task (puede correr con el teléfono bloqueado) y el token no tiene que restaurarse en otro dispositivo. Completá la accesibilidad.",
          code: swift`attributes[kSecAttrAccessible as String] = ____`,
          accept: ["^kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly$"],
          hint: "Necesitás \"después del primer desbloqueo\" + \"solo este dispositivo\".",
          explanation:
            "`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`: se puede leer con el teléfono bloqueado (siempre que se haya desbloqueado una vez desde el reinicio) y no migra en backups. Con `WhenUnlocked` la background task fallaría con el teléfono en el bolsillo.",
        },
        {
          kind: "write",
          prompt:
            "Escribí un `struct TokenStore` con `save(_ token: String, account: String) throws`, `read(account: String) throws -> String?` y `delete(account: String) throws`. `save` agrega y, si el ítem ya existe, lo actualiza. `read` devuelve `nil` si no hay ítem. Usá accesibilidad `...ThisDeviceOnly` y un `enum KeychainError: Error` con `unexpectedStatus(OSStatus)`.",
          starter: swift`import Foundation
import Security

struct TokenStore {
    let service = "com.acme.bank.auth"

    func save(_ token: String, account: String) throws {
    }

    func read(account: String) throws -> String? {
        nil
    }

    func delete(account: String) throws {
    }
}`,
          checks: [
            { pattern: "SecItemAdd\\(", label: "Agrega con `SecItemAdd`" },
            { pattern: "errSecDuplicateItem", label: "Detecta el duplicado con `errSecDuplicateItem`" },
            { pattern: "SecItemUpdate\\(", label: "Actualiza con `SecItemUpdate`" },
            { pattern: "SecItemCopyMatching\\(", label: "Lee con `SecItemCopyMatching`" },
            { pattern: "errSecItemNotFound", label: "Devuelve `nil` con `errSecItemNotFound`" },
            { pattern: "SecItemDelete\\(", label: "Borra con `SecItemDelete`" },
            { pattern: "kSecAttrAccessible\\w*ThisDeviceOnly", label: "Accesibilidad `...ThisDeviceOnly`" },
          ],
          warnings: [
            { pattern: "UserDefaults", label: "Los tokens nunca van a `UserDefaults`" },
            { pattern: "print\\(", label: "No imprimas tokens: terminan en logs y reportes de crash" },
            { pattern: "kSecAttrAccessibleAlways", label: "`kSecAttrAccessibleAlways` está deprecado e inseguro" },
          ],
          solution: swift`import Foundation
import Security

enum KeychainError: Error {
    case unexpectedStatus(OSStatus)
}

struct TokenStore {
    let service = "com.acme.bank.auth"

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    func save(_ token: String, account: String) throws {
        let data = Data(token.utf8)
        var attributes = baseQuery(account: account)
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(attributes as CFDictionary, nil)
        if status == errSecDuplicateItem {
            let changes: [String: Any] = [kSecValueData as String: data]
            let updateStatus = SecItemUpdate(baseQuery(account: account) as CFDictionary, changes as CFDictionary)
            guard updateStatus == errSecSuccess else { throw KeychainError.unexpectedStatus(updateStatus) }
        } else if status != errSecSuccess {
            throw KeychainError.unexpectedStatus(status)
        }
    }

    func read(account: String) throws -> String? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw KeychainError.unexpectedStatus(status)
        }
        return String(decoding: data, as: UTF8.self)
    }

    func delete(account: String) throws {
        let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }
}`,
          hint: "Armá una `baseQuery(account:)` con class + service + account y reusala en las cuatro operaciones.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "network-security",
      title: "ATS, pinning y tráfico seguro",
      goal: "Entender App Transport Security y sus excepciones, implementar pinning de clave pública con `URLSessionDelegate` y `SecTrust`, planear la rotación de pins y no loguear datos sensibles.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "App Transport Security",
          body: [
            "ATS viene activado por defecto: `URLSession` solo habla HTTPS con TLS 1.2 o superior, certificados válidos y forward secrecy. Una request a `http://` falla antes de salir del dispositivo.",
            "Las excepciones van en `Info.plist`, bajo `NSAppTransportSecurity`, y tienen que ser **lo más angostas posible**: por dominio con `NSExceptionDomains`, nunca global con `NSAllowsArbitraryLoads`. App Review te puede pedir justificación de cada una.",
            "Para desarrollo local existe `NSAllowsLocalNetworking`. Si staging necesita una excepción, ponela solo en el `Info.plist` de la configuración Debug/Staging (lo viste en el curso de CI/CD con `.xcconfig`).",
          ],
          code: `<key>NSAppTransportSecurity</key>
<dict>
    <!-- Bien: excepción angosta para un partner legacy -->
    <key>NSExceptionDomains</key>
    <dict>
        <key>legacy-partner.example.com</key>
        <dict>
            <key>NSIncludesSubdomains</key>
            <false/>
            <key>NSExceptionRequiresForwardSecrecy</key>
            <false/>
        </dict>
    </dict>
    <!-- Solo para builds de desarrollo: servidor en la red local -->
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>`,
        },
        {
          kind: "predict",
          prompt: "Un PR agrega esto al `Info.plist` de producción \"para que funcione el server de QA que tiene HTTP\". ¿Qué comentás en la review?",
          code: `<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>`,
          options: [
            "Aprobado: ATS solo afecta a `WKWebView`",
            "Aprobado: igual el backend de producción usa HTTPS",
            "Cambiar `true` por `YES`, que es la sintaxis correcta",
            "Rechazar: desactiva ATS para todos los dominios; usar `NSExceptionDomains` para el host de QA y solo en la configuración de QA",
          ],
          answer: 3,
          explanation:
            "`NSAllowsArbitraryLoads` apaga ATS para **todo**: cualquier URL que la app cargue (incluido un link que viene de un deep link o de un SDK) puede ir por HTTP en texto plano. La excepción va por dominio y en el `Info.plist` de la configuración que la necesita, no en el de Release.",
        },
        {
          kind: "explain",
          title: "Pinning de clave pública con URLSessionDelegate",
          body: [
            "ATS confía en cualquier CA instalada en el dispositivo. Si alguien instala un perfil con su propia CA (un proxy corporativo, o un atacante con Charles/mitmproxy), puede leer tu tráfico. **Pinning** agrega: \"además de ser válido, el certificado tiene que tener esta clave pública\".",
            "Se implementa en `urlSession(_:didReceive:completionHandler:)`. Primero dejás que el sistema valide la cadena con `SecTrustEvaluateWithError` (CA, fecha, hostname). **Después** comparás el hash de las claves de la cadena contra tu set de pins. Si no coincide: `.cancelAuthenticationChallenge`.",
            "Pineá la **clave pública**, no el certificado: el certificado se renueva cada año, la clave puede mantenerse. Ojo: este hash (SHA-256 de la representación externa de la clave) no es el mismo que el `SPKI-SHA256-BASE64` de `Info.plist`, que incluye el header ASN.1. Generá los pins con el mismo método con el que comparás.",
          ],
          code: swift`import CryptoKit
import Foundation
import Security

final class PinnedSessionDelegate: NSObject, URLSessionDelegate {
    private let pinnedKeyHashes: Set<String>   // pin actual + pin de respaldo

    init(pinnedKeyHashes: Set<String>) {
        self.pinnedKeyHashes = pinnedKeyHashes
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        // 1. Validación normal: CA, vencimiento, hostname
        guard SecTrustEvaluateWithError(trust, nil) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        // 2. Pinning: alguna clave de la cadena tiene que estar en el set
        let chain = (SecTrustCopyCertificateChain(trust) as? [SecCertificate]) ?? []
        let pinned = chain.contains { certificate in
            guard let key = SecCertificateCopyKey(certificate),
                  let keyData = SecKeyCopyExternalRepresentation(key, nil) as Data? else { return false }
            let hash = Data(SHA256.hash(data: keyData)).base64EncodedString()
            return pinnedKeyHashes.contains(hash)
        }
        if pinned {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Antes de comparar pins, dejá que el sistema valide la cadena completa. Completá la función.",
          code: swift`guard ____(trust, nil) else {
    completionHandler(.cancelAuthenticationChallenge, nil)
    return
}`,
          accept: ["^SecTrustEvaluateWithError$"],
          hint: "Devuelve `Bool` y reemplazó a `SecTrustEvaluate`, que está deprecada.",
          explanation:
            "`SecTrustEvaluateWithError` valida CA, fechas y hostname. Si te la salteás y solo comparás el pin, aceptarías un certificado vencido o emitido para otro host que casualmente use esa clave.",
        },
        {
          kind: "predict",
          prompt: "La app pinea **un solo** hash: el del certificado hoja del servidor. Ops renueva el certificado con una clave nueva, como todos los años. ¿Qué pasa?",
          code: swift`let delegate = PinnedSessionDelegate(
    pinnedKeyHashes: ["LEAF_2025_KEY_HASH="]
)`,
          options: [
            "Nada: `SecTrustEvaluateWithError` acepta el certificado nuevo y el pin se ignora",
            "Todas las versiones instaladas fallan en cada request hasta que el usuario actualice; si el login también está pineado, ni siquiera puede ver un aviso del server",
            "iOS descarga el pin nuevo automáticamente desde el servidor",
            "Solo falla la primera request y después se cachea la clave nueva",
          ],
          answer: 1,
          explanation:
            "El pin está compilado en el binario: con la clave nueva ninguna conexión pasa el chequeo. Por eso el plan de rotación es obligatorio: siempre al menos un **pin de respaldo** (una clave que ops ya generó y guardó, o la de la CA intermedia), la rotación coordinada con releases y, idealmente, un kill switch remoto.",
        },
        {
          kind: "explain",
          title: "NSPinnedDomains, rotación y logs",
          body: [
            "Desde iOS 14 podés declarar pins en `Info.plist` con `NSPinnedDomains`, sin código: `NSPinnedCAIdentities` (pinear la CA) o `NSPinnedLeafIdentities` (pinear la hoja), cada uno con `SPKI-SHA256-BASE64`. Aplica a `URLSession` y no necesita delegate.",
            "Plan de rotación: (1) siempre dos o más pins, el actual y uno de respaldo que todavía no está en uso; (2) cuando ops rota, pasa a la clave de respaldo y en la siguiente release agregás un nuevo respaldo; (3) monitoreá errores de TLS por versión de app.",
            "El tráfico cifrado no sirve si después lo logueás. Con `Logger` (os) las interpolaciones dinámicas son privadas por defecto en dispositivos sin debugger, pero marcá explícito `privacy: .private` en emails, ids y montos, y **nunca** loguees headers `Authorization` ni bodies de login.",
          ],
          code: `<key>NSAppTransportSecurity</key>
<dict>
    <key>NSPinnedDomains</key>
    <dict>
        <key>api.acmebank.com</key>
        <dict>
            <key>NSIncludesSubdomains</key>
            <true/>
            <key>NSPinnedCAIdentities</key>
            <array>
                <dict>
                    <key>SPKI-SHA256-BASE64</key>
                    <string>CURRENT_CA_SPKI_HASH_BASE64=</string>
                </dict>
                <dict>
                    <key>SPKI-SHA256-BASE64</key>
                    <string>BACKUP_CA_SPKI_HASH_BASE64=</string>
                </dict>
            </array>
        </dict>
    </dict>
</dict>

<!-- En Swift:
let logger = Logger(subsystem: "com.acme.bank", category: "auth")
logger.info("Login OK para \(email, privacy: .private)")
-->`,
        },
        {
          kind: "fill",
          prompt: "Completá para que el email no aparezca en texto plano en los logs del dispositivo.",
          code: swift`let logger = Logger(subsystem: "com.acme.bank", category: "auth")
logger.info("Reset de contraseña pedido para \(email, privacy: ____)")`,
          accept: ["^\\.private$", "^private$", "^\\.private\\(mask:\\s*\\.hash\\)$"],
          hint: "Lo opuesto a `.public`.",
          explanation:
            "`privacy: .private` hace que el valor se vea como `<private>` en Console. `.private(mask: .hash)` muestra un hash estable, útil para correlacionar eventos del mismo usuario sin exponer el dato.",
        },
        {
          kind: "write",
          prompt:
            "Implementá el método del delegate de `PinnedSessionDelegate`: solo maneja `NSURLAuthenticationMethodServerTrust` (lo demás con `.performDefaultHandling`), valida la cadena con `SecTrustEvaluateWithError`, obtiene la cadena con `SecTrustCopyCertificateChain`, hashea cada clave pública con `SHA256` en base64 y acepta con `URLCredential(trust:)` solo si alguna está en `pinnedKeyHashes`.",
          starter: swift`final class PinnedSessionDelegate: NSObject, URLSessionDelegate {
    private let pinnedKeyHashes: Set<String>

    init(pinnedKeyHashes: Set<String>) {
        self.pinnedKeyHashes = pinnedKeyHashes
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        // TODO
    }
}`,
          checks: [
            { pattern: "NSURLAuthenticationMethodServerTrust", label: "Filtra por `NSURLAuthenticationMethodServerTrust`" },
            { pattern: "SecTrustEvaluateWithError\\(", label: "Valida la cadena con `SecTrustEvaluateWithError`" },
            { pattern: "SecTrustCopyCertificateChain\\(", label: "Obtiene la cadena con `SecTrustCopyCertificateChain`" },
            { pattern: "SHA256\\.hash\\(", label: "Hashea la clave con `SHA256.hash`" },
            { pattern: "\\.cancelAuthenticationChallenge", label: "Cancela si no coincide" },
            { pattern: "URLCredential\\(\\s*trust:", label: "Acepta con `URLCredential(trust:)`" },
          ],
          warnings: [
            { pattern: "SecTrustEvaluate\\(", label: "`SecTrustEvaluate` está deprecada: usá `SecTrustEvaluateWithError`" },
            { pattern: "print\\(", label: "No loguees certificados ni hashes en producción" },
          ],
          solution: swift`final class PinnedSessionDelegate: NSObject, URLSessionDelegate {
    private let pinnedKeyHashes: Set<String>

    init(pinnedKeyHashes: Set<String>) {
        self.pinnedKeyHashes = pinnedKeyHashes
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        guard SecTrustEvaluateWithError(trust, nil) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        let chain = (SecTrustCopyCertificateChain(trust) as? [SecCertificate]) ?? []
        let pinned = chain.contains { certificate in
            guard let key = SecCertificateCopyKey(certificate),
                  let keyData = SecKeyCopyExternalRepresentation(key, nil) as Data? else { return false }
            let hash = Data(SHA256.hash(data: keyData)).base64EncodedString()
            return pinnedKeyHashes.contains(hash)
        }
        if pinned {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}`,
          hint: "Clave de cada certificado: `SecCertificateCopyKey` y después `SecKeyCopyExternalRepresentation`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "cryptokit",
      title: "CryptoKit sin inventar criptografía",
      goal: "Usar `SHA256`, `HMAC`, `AES.GCM`, firmas con `P256`/`Curve25519` y claves del `SecureEnclave` sabiendo qué garantiza cada primitiva.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "Hashes: huellas, no cifrado",
          body: [
            "Un hash como `SHA256.hash(data:)` convierte cualquier entrada en 32 bytes. Es determinístico (misma entrada, mismo hash) y de una sola vía: no se \"descifra\". Sirve para verificar integridad, armar claves de caché o el `clientDataHash` de App Attest.",
            "**No** sirve para guardar contraseñas en el cliente ni para \"esconder\" un dato: dos usuarios con la misma contraseña tienen el mismo hash y existen tablas precalculadas. Las contraseñas se hashean en el **servidor** con un algoritmo lento y con sal (Argon2, bcrypt, scrypt).",
            "Regla de oro: **nunca inventes criptografía**. Nada de XOR \"casero\", ni MD5/SHA1 (en CryptoKit viven en `Insecure`), ni claves hardcodeadas. CryptoKit te da primitivas modernas con APIs difíciles de usar mal.",
          ],
          code: swift`import CryptoKit
import Foundation

let digest = SHA256.hash(data: Data("abc".utf8))
let hex = digest.map { String(format: "%02x", $0) }.joined()
print(hex)
print(hex.count)`,
          output: `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
64`,
        },
        {
          kind: "predict",
          code: swift`import CryptoKit
import Foundation

let a = SHA256.hash(data: Data("password1".utf8))
let b = SHA256.hash(data: Data("password1".utf8))
let c = SHA256.hash(data: Data("Password1".utf8))
let hex = a.map { String(format: "%02x", $0) }.joined()
print(a == b, a == c, hex.count)`,
          options: ["true false 64", "true false 32", "false false 64", "true true 64"],
          answer: 0,
          explanation:
            "Mismo input da el mismo digest (`true`); cambiar una mayúscula cambia todo el hash (`false`). Son 32 bytes, que en hex son 64 caracteres. Que sea determinístico es justo por qué no alcanza para contraseñas: hace falta sal y un algoritmo lento, del lado del servidor.",
        },
        {
          kind: "explain",
          title: "HMAC y AES.GCM",
          body: [
            "**HMAC** = hash con clave. Prueba que quien generó el código tenía la clave y que el mensaje no cambió. `HMAC<SHA256>.authenticationCode(for:using:)` lo genera e `isValidAuthenticationCode` lo verifica en tiempo constante.",
            "**AES.GCM** cifra y autentica a la vez (AEAD): `AES.GCM.seal` devuelve una `SealedBox` con nonce, ciphertext y tag. `combined` junta todo en un `Data` para guardarlo. `AES.GCM.open` verifica el tag antes de devolver nada: si alguien tocó un byte, tira error.",
            "La clave (`SymmetricKey(size: .bits256)`) es el secreto real: guardala en el Keychain, nunca en el binario. Si la clave está en el código, el cifrado es decorativo.",
          ],
          code: swift`import CryptoKit
import Foundation

let key = SymmetricKey(size: .bits256)          // guardala en el Keychain
let plaintext = Data("nota secreta".utf8)

let sealed = try AES.GCM.seal(plaintext, using: key)
let stored = sealed.combined!                    // nonce + ciphertext + tag

let box = try AES.GCM.SealedBox(combined: stored)
let opened = try AES.GCM.open(box, using: key)
print(String(decoding: opened, as: UTF8.self))

let mac = HMAC<SHA256>.authenticationCode(for: plaintext, using: key)
print(HMAC<SHA256>.isValidAuthenticationCode(mac, authenticating: plaintext, using: key))`,
          output: `nota secreta
true`,
        },
        {
          kind: "fill",
          prompt: "Completá para cifrar y autenticar el payload con AES-GCM.",
          code: swift`let box = try AES.GCM.____(payload, using: key)
try store.saveData(box.combined!, account: "offline-cache")`,
          accept: ["^seal$"],
          hint: "Lo opuesto de `open`.",
          explanation: "`AES.GCM.seal(_:using:)` genera un nonce aleatorio, cifra y calcula el tag. Nunca reutilices un nonce con la misma clave: dejá que `seal` lo genere.",
        },
        {
          kind: "predict",
          prompt: "Alguien modifica el último byte del dato cifrado guardado en disco. ¿Qué imprime?",
          code: swift`var bytes = sealed.combined!
bytes[bytes.count - 1] ^= 0xFF

do {
    let box = try AES.GCM.SealedBox(combined: bytes)
    let data = try AES.GCM.open(box, using: key)
    print("abierto:", String(decoding: data, as: UTF8.self))
} catch {
    print("rechazado")
}`,
          options: [
            "`abierto: nota secreta`, porque el último byte es padding",
            "`rechazado`",
            "`abierto:` seguido de texto ilegible",
            "Crashea en `SealedBox(combined:)`",
          ],
          answer: 1,
          explanation:
            "El último tramo de `combined` es el tag de autenticación. `open` recalcula el tag y, al no coincidir, tira `CryptoKitError.authenticationFailure`. GCM no tiene padding y nunca te devuelve datos manipulados: esa es la ventaja de un AEAD sobre \"cifrar y listo\".",
        },
        {
          kind: "explain",
          title: "Firmas y Secure Enclave",
          body: [
            "Con firma asimétrica la clave privada firma y la pública verifica. `P256.Signing` y `Curve25519.Signing` tienen `PrivateKey()`, `signature(for:)` y `publicKey.isValidSignature(_:for:)`. Sirve para que el servidor verifique que un request lo generó **este** dispositivo.",
            "`SecureEnclave.P256.Signing.PrivateKey()` crea la clave **dentro** del Secure Enclave: la clave privada nunca sale del chip, ni siquiera tu app la ve. Lo que guardás (en el Keychain) es `dataRepresentation`, un blob cifrado que solo ese Secure Enclave puede usar. Chequeá `SecureEnclave.isAvailable` (el simulador puede no tenerlo).",
            "A la pública la mandás al servidor una vez (por ejemplo con `derRepresentation`) y desde ahí cada request sensible va firmado.",
          ],
          code: swift`import CryptoKit
import Foundation

let signingKey = Curve25519.Signing.PrivateKey()
let message = Data("amount=500&to=42".utf8)
let signature = try signingKey.signature(for: message)

let publicKey = signingKey.publicKey
print(publicKey.isValidSignature(signature, for: message))
print(publicKey.isValidSignature(signature, for: Data("amount=900&to=42".utf8)))

// En un dispositivo real: la privada vive en el Secure Enclave
if SecureEnclave.isAvailable {
    let seKey = try SecureEnclave.P256.Signing.PrivateKey()
    let blob = seKey.dataRepresentation            // guardalo en el Keychain
    let restored = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob)
    let der = try restored.signature(for: message).derRepresentation
}`,
          output: `true
false`,
        },
        {
          kind: "fill",
          prompt: "Antes de crear una clave en el Secure Enclave, chequeá que el hardware exista.",
          code: swift`guard SecureEnclave.____ else {
    throw SignerError.secureEnclaveUnavailable
}`,
          accept: ["^isAvailable$"],
          hint: "Una propiedad estática `Bool`.",
          explanation: "`SecureEnclave.isAvailable` es `false` en dispositivos sin Secure Enclave y puede serlo en el simulador. Sin ese chequeo, `PrivateKey()` tira error.",
        },
        {
          kind: "write",
          prompt:
            "Escribí `struct RequestSigner` que en su `init(store:)` cargue una clave `SecureEnclave.P256.Signing.PrivateKey` desde el Keychain (`store.readData(account:)` devuelve `Data?`) o, si no hay, la cree y guarde su `dataRepresentation` con `store.saveData(_:account:)`. Exponé `publicKeyDER: Data` y `sign(_ body: Data) throws -> String` que devuelva la firma DER en base64. Si no hay Secure Enclave, tirá un error.",
          starter: swift`import CryptoKit
import Foundation

enum SignerError: Error { case secureEnclaveUnavailable }

struct RequestSigner {
    // tu implementación
}`,
          checks: [
            { pattern: "SecureEnclave\\.isAvailable", label: "Chequea `SecureEnclave.isAvailable`" },
            { pattern: "SecureEnclave\\.P256\\.Signing\\.PrivateKey\\(", label: "Crea o restaura una clave del Secure Enclave" },
            { pattern: "dataRepresentation", label: "Persiste el blob con `dataRepresentation`" },
            { pattern: "\\.signature\\(for:", label: "Firma con `signature(for:)`" },
            { pattern: "derRepresentation", label: "Serializa con `derRepresentation`" },
          ],
          warnings: [
            { pattern: "Insecure\\.", label: "Nada de `Insecure.MD5` ni `Insecure.SHA1`" },
            { pattern: "rawRepresentation", label: "Una clave del Secure Enclave no se exporta: guardá `dataRepresentation`" },
          ],
          solution: swift`import CryptoKit
import Foundation

enum SignerError: Error { case secureEnclaveUnavailable }

struct RequestSigner {
    private let key: SecureEnclave.P256.Signing.PrivateKey

    init(store: TokenStore) throws {
        guard SecureEnclave.isAvailable else { throw SignerError.secureEnclaveUnavailable }
        if let saved = try store.readData(account: "signing-key") {
            key = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: saved)
        } else {
            let newKey = try SecureEnclave.P256.Signing.PrivateKey()
            try store.saveData(newKey.dataRepresentation, account: "signing-key")
            key = newKey
        }
    }

    var publicKeyDER: Data { key.publicKey.derRepresentation }

    func sign(_ body: Data) throws -> String {
        try key.signature(for: body).derRepresentation.base64EncodedString()
    }
}`,
          hint: "`init(dataRepresentation:)` restaura la clave; `PrivateKey()` crea una nueva.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "local-auth-secrets",
      title: "Face ID, Keychain biométrico y secretos",
      goal: "Usar `LocalAuthentication` bien, proteger un ítem del Keychain con biometría vía `SecAccessControlCreateWithFlags` y saber qué secretos nunca pueden ir en el binario.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "LocalAuthentication",
          body: [
            "`LAContext` es la puerta a Face ID, Touch ID y Optic ID. Primero `canEvaluatePolicy(_:error:)` para saber si hay biometría configurada; después `evaluatePolicy(_:localizedReason:)`, que en Swift moderno es `async throws` y devuelve `true` si el usuario pasó.",
            "`.deviceOwnerAuthenticationWithBiometrics` exige biometría. `.deviceOwnerAuthentication` permite caer al passcode. `biometryType` te dice cuál hay para mostrar el ícono correcto.",
            "Si usás Face ID necesitás `NSFaceIDUsageDescription` en `Info.plist` con un texto que explique para qué. Sin esa clave la autenticación con Face ID no funciona.",
          ],
          code: swift`import LocalAuthentication

func authenticate() async -> Bool {
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
        return false   // sin biometría: ofrecé contraseña
    }
    do {
        return try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Desbloqueá tu cuenta"
        )
    } catch let error as LAError where error.code == .userCancel {
        return false
    } catch {
        return false
    }
}

// Info.plist
// <key>NSFaceIDUsageDescription</key>
// <string>Usamos Face ID para desbloquear tu cuenta sin contraseña.</string>`,
        },
        {
          kind: "predict",
          prompt: "Así está implementado el \"desbloqueo con Face ID\". Un atacante con el teléfono en una mesa de laboratorio usa Frida para que `evaluatePolicy` devuelva `true`. ¿Qué obtiene?",
          code: swift`func unlock() async {
    let ok = (try? await LAContext().evaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        localizedReason: "Desbloqueá tu cuenta"
    )) ?? false
    if ok {
        let token = try? tokenStore.read(account: "refresh-token")  // AfterFirstUnlock
        session.start(with: token)
    }
}`,
          options: [
            "Nada: Face ID corre en el Secure Enclave y no se puede saltear",
            "Solo la UI desbloqueada, sin acceso a la API",
            "La sesión completa: el token no depende de la biometría, solo un `if` lo protege",
            "Un error, porque `evaluatePolicy` firma la respuesta",
          ],
          answer: 2,
          explanation:
            "El match biométrico sí ocurre en el Secure Enclave, pero el resultado que recibe tu app es un `Bool` en memoria, y un `if` se parchea. El token está en un ítem con `AfterFirstUnlock` que se lee sin biometría. La solución es que el **secreto mismo** esté protegido por biometría en el Keychain: sin match, el sistema no lo entrega.",
        },
        {
          kind: "explain",
          title: "Keychain protegido por biometría",
          body: [
            "`SecAccessControlCreateWithFlags` crea un control de acceso que se guarda junto al ítem con `kSecAttrAccessControl`. Con `.biometryCurrentSet`, el Keychain solo entrega el secreto después de un match biométrico **con los dedos/caras enrolados hoy**.",
            "Alternativas: `.biometryAny` (sobrevive a nuevos enrolamientos), `.userPresence` (biometría o passcode). `.biometryCurrentSet` es la más estricta: si alguien que conoce tu passcode agrega su cara, el ítem queda invalidado.",
            "Al leer pasás un `LAContext` en `kSecUseAuthenticationContext`. `SecItemCopyMatching` muestra el prompt y **bloquea** hasta que el usuario responde: llamalo fuera del main thread. Si el usuario cancela, el status es `errSecUserCanceled`.",
          ],
          code: swift`import LocalAuthentication
import Security

func saveBiometricProtected(_ token: String) throws {
    guard let access = SecAccessControlCreateWithFlags(
        nil,
        kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        .biometryCurrentSet,
        nil
    ) else { throw KeychainError.unexpectedStatus(errSecParam) }

    let attributes: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.acme.bank.biometric",
        kSecAttrAccount as String: "refresh-token",
        kSecAttrAccessControl as String: access,
        kSecValueData as String: Data(token.utf8),
    ]
    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else { throw KeychainError.unexpectedStatus(status) }
}`,
        },
        {
          kind: "fill",
          prompt: "El ítem tiene que invalidarse si cambia el conjunto de caras/huellas enroladas. Completá el flag.",
          code: swift`let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
    ____,
    nil
)`,
          accept: ["^\\.biometryCurrentSet$", "^biometryCurrentSet$", "^SecAccessControlCreateFlags\\.biometryCurrentSet$"],
          hint: "Hay `.biometryAny` y otro más estricto.",
          explanation:
            "`.biometryCurrentSet` ata el ítem al set de biometría actual. Con `.biometryAny`, alguien que sabe el passcode podría enrolar su cara y leer el secreto.",
        },
        {
          kind: "predict",
          prompt: "El refresh token se guardó con `.biometryCurrentSet`. La usuaria agrega una segunda apariencia en Face ID y vuelve a abrir la app. ¿Qué pasa al leer el ítem?",
          code: swift`let token = try vault.readRefreshToken(reason: "Desbloqueá tu cuenta")`,
          options: [
            "Lo lee normalmente con cualquiera de las dos caras",
            "Lo lee pero solo con la cara original",
            "iOS migra el ítem al nuevo set después de pedir el passcode",
            "El ítem queda inaccesible: la app tiene que pedir login con contraseña y guardar un token nuevo",
          ],
          answer: 3,
          explanation:
            "Cambiar el set de biometría invalida los ítems creados con `.biometryCurrentSet`. Tu código tiene que tratar ese caso como \"no hay sesión biométrica\": fallback a contraseña, nuevo token del servidor y nuevo ítem. Es el comportamiento buscado, no un bug.",
        },
        {
          kind: "explain",
          title: "Secretos: fuera de git, y aun así extraíbles",
          body: [
            "En CI/CD viste cómo sacar claves de git con `.xcconfig` ignorados y secrets del pipeline. Eso evita que se filtren en el repo, pero **no** las protege en el binario: todo lo que compilás termina en el `.ipa` y `strings` o un desensamblador lo encuentra en minutos. Ofuscar solo suma minutos.",
            "Clasificá: claves **publicables** (Stripe publishable key, ids de analytics, API keys restringidas por bundle id) pueden ir en la app. Claves **secretas** (Stripe secret key, credenciales de un proveedor que cobra por request, claves de firma) nunca: van en tu backend, y la app llama a tu backend.",
            "Si una clave secreta ya salió en una versión publicada, asumila comprometida: rotala en el proveedor, no alcanza con sacarla del próximo build.",
          ],
          code: `# Config/Secrets.xcconfig (en .gitignore, generado por CI)
STRIPE_PUBLISHABLE_KEY = pk_live_51Hx...
MAPS_API_KEY = AIzaSy...   # restringida por bundle id en la consola

# Lo que cualquiera puede hacer con tu .ipa
$ unzip -q AcmeBank.ipa
$ strings Payload/AcmeBank.app/AcmeBank | grep -E "pk_live|sk_live|AIza"
pk_live_51Hx...
AIzaSy...`,
        },
        {
          kind: "predict",
          prompt: "Para \"no exponerla\", el equipo puso la Stripe **secret** key en un `.xcconfig` ignorado por git que CI inyecta en `Info.plist`, y la app crea los cobros llamando a Stripe directo. ¿Qué decís?",
          code: `// Info.plist
<key>StripeSecretKey</key>
<string>$(STRIPE_SECRET_KEY)</string>`,
          options: [
            "Inseguro: la key queda en el `Info.plist` del `.ipa`; los cobros tienen que crearse en el backend y la app solo usa la publishable key",
            "Seguro: como no está en git, no hay forma de obtenerla",
            "Seguro si además se ofusca con XOR antes de compilar",
            "Seguro porque App Store cifra los binarios con FairPlay",
          ],
          answer: 0,
          explanation:
            "`Info.plist` es un archivo dentro del bundle, legible por cualquiera que descargue el `.ipa`. El cifrado de FairPlay se quita fácil en un dispositivo con jailbreak y el XOR es reversible con la misma clave que está al lado. Una secret key permite crear cobros y reembolsos: vive solo en el servidor.",
        },
        {
          kind: "write",
          prompt:
            "Escribí `struct BiometricVault` con `saveRefreshToken(_ token: String) throws` (ítem con `SecAccessControlCreateWithFlags` + `.biometryCurrentSet`, borrando antes el anterior) y `readRefreshToken(reason: String) throws -> String` que use un `LAContext` con `localizedReason` en `kSecUseAuthenticationContext`. Tirá `KeychainError.unexpectedStatus` ante cualquier status que no sea `errSecSuccess`.",
          starter: swift`import LocalAuthentication
import Security

struct BiometricVault {
    let service = "com.acme.bank.biometric"
    let account = "refresh-token"

    func saveRefreshToken(_ token: String) throws {
    }

    func readRefreshToken(reason: String) throws -> String {
        ""
    }
}`,
          checks: [
            { pattern: "SecAccessControlCreateWithFlags\\(", label: "Crea el control con `SecAccessControlCreateWithFlags`" },
            { pattern: "\\.biometryCurrentSet", label: "Usa `.biometryCurrentSet`" },
            { pattern: "kSecAttrAccessControl", label: "Guarda el ítem con `kSecAttrAccessControl`" },
            { pattern: "LAContext\\(\\)", label: "Crea un `LAContext`" },
            { pattern: "kSecUseAuthenticationContext", label: "Pasa el contexto en `kSecUseAuthenticationContext`" },
            { pattern: "SecItemCopyMatching\\(", label: "Lee con `SecItemCopyMatching`" },
          ],
          warnings: [
            { pattern: "UserDefaults", label: "Los tokens nunca van a `UserDefaults`" },
            { pattern: "evaluatePolicy\\(", label: "Un `Bool` de `evaluatePolicy` no protege nada: dejá que el Keychain pida la biometría" },
            { pattern: "kSecAttrAccessibleAlways", label: "`kSecAttrAccessibleAlways` está deprecado e inseguro" },
          ],
          solution: swift`import LocalAuthentication
import Security

struct BiometricVault {
    let service = "com.acme.bank.biometric"
    let account = "refresh-token"

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    func saveRefreshToken(_ token: String) throws {
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            nil
        ) else { throw KeychainError.unexpectedStatus(errSecParam) }

        SecItemDelete(baseQuery as CFDictionary)

        var attributes = baseQuery
        attributes[kSecAttrAccessControl as String] = access
        attributes[kSecValueData as String] = Data(token.utf8)
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.unexpectedStatus(status) }
    }

    // Bloquea mientras se muestra Face ID: llamalo fuera del main thread.
    func readRefreshToken(reason: String) throws -> String {
        let context = LAContext()
        context.localizedReason = reason

        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecUseAuthenticationContext as String] = context

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            throw KeychainError.unexpectedStatus(status)
        }
        return String(decoding: data, as: UTF8.self)
    }
}`,
          hint: "Con `kSecAttrAccessControl` la accesibilidad va dentro del control (segundo argumento de `SecAccessControlCreateWithFlags`), no en `kSecAttrAccessible`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "integrity-threats",
      title: "App Attest, deep links y modelado de amenazas",
      goal: "Saber qué prueban App Attest y DeviceCheck, cuánto vale detectar jailbreak, validar parámetros de deep links y usar MASVS y STRIDE para revisar un feature.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "App Attest y DeviceCheck",
          body: [
            "**App Attest** (`DCAppAttestService`) le prueba a **tu servidor** que un request viene de una instancia legítima de tu app, sin modificar, en un dispositivo Apple real. La app genera una clave en el Secure Enclave, Apple la certifica (attestation) y después cada request sensible lleva una assertion firmada con esa clave.",
            "Lo que **no** prueba: que el usuario sea honesto ni que el dispositivo no tenga jailbreak. Y no protege nada si el servidor no verifica: la attestation se valida en el backend contra la CA de Apple, y el server guarda la clave pública y un contador para rechazar replays.",
            "**DeviceCheck** (`DCDevice`) es más simple: un token que tu servidor usa para leer/escribir 2 bits por dispositivo en los servidores de Apple. Sirve para \"este dispositivo ya usó la prueba gratis\" aunque reinstalen la app.",
          ],
          code: swift`import CryptoKit
import DeviceCheck

let service = DCAppAttestService.shared
guard service.isSupported else { return }     // fallback: más fricción, no bloqueo total

// Una vez por instalación
let keyId = try await service.generateKey()
let challenge = try await api.fetchAttestChallenge()      // nonce único del server
let attestation = try await service.attestKey(
    keyId, clientDataHash: Data(SHA256.hash(data: challenge))
)
try await api.registerAttestation(attestation, keyId: keyId)

// En cada request sensible (transferencias, canje de cupones)
let assertion = try await service.generateAssertion(
    keyId, clientDataHash: Data(SHA256.hash(data: requestBody))
)

// DeviceCheck
let deviceToken = try await DCDevice.current.generateToken()`,
        },
        {
          kind: "predict",
          prompt: "Implementaste App Attest en la app. ¿Quién tiene que verificar la attestation para que sirva de algo?",
          code: swift`let attestation = try await DCAppAttestService.shared.attestKey(keyId, clientDataHash: hash)
try await api.registerAttestation(attestation, keyId: keyId)`,
          options: [
            "La propia app, antes de mandarla, con `SecTrustEvaluateWithError`",
            "Tu servidor: valida la cadena contra la CA de App Attest de Apple, el challenge y el app id, y guarda la clave pública",
            "Nadie: con llamar a `attestKey` iOS ya bloquea apps modificadas",
            "App Store Connect, que rechaza los requests inválidos",
          ],
          answer: 1,
          explanation:
            "Si la app se verificara a sí misma, una app modificada simplemente saltearía ese chequeo. El valor está en que el **servidor** valida la attestation (y después cada assertion y su contador) y decide: rechazar, pedir un paso extra o marcar la cuenta.",
        },
        {
          kind: "explain",
          title: "Jailbreak y deep links: no confíes en la entrada",
          body: [
            "Detectar jailbreak (buscar `/Applications/Cydia.app`, probar escribir fuera del sandbox) es una **señal**, no una defensa: con Frida o un tweak se parchea el chequeo en minutos. Usalo para sumar riesgo y avisarle al server, nunca como única barrera.",
            "Un deep link o universal link es **entrada de un atacante**: cualquier web, QR o app puede abrirlo. Parsealo con `URLComponents`, validá scheme y host contra una allowlist, convertí cada parámetro al tipo esperado y rechazá todo lo demás.",
            "Nunca ejecutes una acción con efecto (transferir, cambiar email, borrar cuenta) directo desde un link: navegá a una pantalla que muestre los datos y pida confirmación, y que el servidor vuelva a autorizar.",
          ],
          code: swift`// Señal, no defensa
func looksJailbroken() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    let paths = ["/Applications/Cydia.app", "/bin/bash", "/usr/sbin/sshd", "/etc/apt"]
    if paths.contains(where: { FileManager.default.fileExists(atPath: $0) }) { return true }
    do {
        try "x".write(toFile: "/private/jb_test.txt", atomically: true, encoding: .utf8)
        return true   // una app en sandbox no debería poder escribir ahí
    } catch {
        return false
    }
    #endif
}

// Deep link: parsear y validar
func handle(_ url: URL) {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
          components.scheme == "https",
          components.host == "acmebank.com",
          components.path == "/product",
          let raw = components.queryItems?.first(where: { $0.name == "id" })?.value,
          let id = Int(raw) else { return }
    router.show(.product(id: id))
}`,
        },
        {
          kind: "fill",
          prompt: "Completá la validación del dominio del universal link.",
          code: swift`guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
      components.____ == "acmebank.com" else { return nil }`,
          accept: ["^host$"],
          hint: "La parte de la URL entre `://` y la primera `/`.",
          explanation:
            "Comparar `components.host` con igualdad exacta (o contra un `Set`) evita trucos como `acmebank.com.evil.io` que pasarían un `contains(\"acmebank.com\")` sobre el string.",
        },
        {
          kind: "predict",
          prompt: "¿Qué imprime?",
          code: swift`let url = URL(string: "shop://open?product=42&product=99&ref=%3Cscript%3E")!
let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
let product = items.first { $0.name == "product" }?.value
let ref = items.first { $0.name == "ref" }?.value
print(product ?? "nil", ref ?? "nil")`,
          options: ["99 %3Cscript%3E", "42 %3Cscript%3E", "42 <script>", "nil nil"],
          answer: 2,
          explanation:
            "`first` agarra la primera aparición de `product` (42), aunque el link traiga dos: decidí explícitamente qué hacer con parámetros repetidos. Y `queryItems` devuelve los valores **ya decodificados**: `ref` es `<script>`. Ese valor viene del atacante; si lo metés en un `WKWebView` o en un log sin escapar, tenés un problema.",
        },
        {
          kind: "explain",
          title: "MASVS y modelado de amenazas",
          body: [
            "**OWASP MASVS** es el estándar de seguridad para apps móviles y **MASTG** la guía de testing que lo acompaña. Sus grupos sirven como checklist de PR o de release: `MASVS-STORAGE`, `MASVS-CRYPTO`, `MASVS-AUTH`, `MASVS-NETWORK`, `MASVS-PLATFORM`, `MASVS-CODE`, `MASVS-RESILIENCE` y `MASVS-PRIVACY`.",
            "Antes de construir un feature sensible hacé un threat model corto con **STRIDE**: Spoofing (suplantar), Tampering (manipular), Repudiation (negar haber hecho algo), Information disclosure (filtrar), Denial of service, Elevation of privilege. Por cada letra: ¿qué puede salir mal y qué lo mitiga?",
            "La privacidad se conecta con lo que viste en App Store: el privacy manifest y las etiquetas declaran qué recolectás; acá te asegurás de que lo que recolectás esté protegido y de pedir solo lo necesario.",
          ],
          code: `# threat-model/login.yml
feature: "login + refresh con Face ID"
assets: [password, refresh_token, access_token]
threats:
  - stride: S
    risk: "credential stuffing contra /login"
    mitigation: "rate limit y MFA en el server"
  - stride: T
    risk: "app modificada saltea el check de Face ID"
    mitigation: "refresh token con .biometryCurrentSet; App Attest en /refresh"
  - stride: R
    risk: "'yo no hice esa transferencia'"
    mitigation: "auditoría en el server con keyId de App Attest y timestamp"
  - stride: I
    risk: "token en logs, backups o capturas de proxy"
    mitigation: "Keychain ThisDeviceOnly, Logger privado, pinning"
  - stride: D
    risk: "pin vencido bloquea a todos los usuarios"
    mitigation: "pin de respaldo y kill switch remoto"
  - stride: E
    risk: "rol 'admin' leído del JWT solo en el cliente"
    mitigation: "autorización siempre en el server"
masvs: [MASVS-STORAGE, MASVS-NETWORK, MASVS-AUTH, MASVS-RESILIENCE]`,
        },
        {
          kind: "predict",
          prompt: "En el threat model de transferencias aparece este riesgo. ¿Qué letra de STRIDE es?",
          code: `risk: "Un usuario reclama que nunca hizo una transferencia y
       el servidor no tiene registro de qué dispositivo ni
       qué sesión la originó."`,
          options: ["Spoofing", "Tampering", "Elevation of privilege", "Repudiation"],
          answer: 3,
          explanation:
            "Repudiation es poder negar una acción porque no hay evidencia. Se mitiga con auditoría del lado del servidor: sesión, dispositivo (por ejemplo el `keyId` de App Attest), timestamp y, si hace falta, el request firmado.",
        },
        {
          kind: "write",
          prompt:
            "Escribí `struct DeepLinkRouter` con `func route(_ url: URL) -> Route?`. Aceptá solo `https` y hosts de un `Set` `allowedHosts` (`acmebank.com`, `www.acmebank.com`). `/product?id=N` devuelve `.product(id:)` solo si `N` es un `Int` positivo; `/reset?token=T` devuelve `.resetPassword(token:)` solo si `T` tiene 32 caracteres hexadecimales. Cualquier otra cosa: `nil`.",
          starter: swift`import Foundation

enum Route: Equatable {
    case product(id: Int)
    case resetPassword(token: String)
}

struct DeepLinkRouter {
    func route(_ url: URL) -> Route? {
        return nil
    }
}`,
          checks: [
            { pattern: "URLComponents\\(", label: "Parsea con `URLComponents`" },
            { pattern: "\\.scheme\\s*==\\s*\"https\"", label: "Exige `https`" },
            { pattern: "allowedHosts\\.contains\\(", label: "Valida el host contra `allowedHosts`" },
            { pattern: "queryItems", label: "Lee parámetros con `queryItems`" },
            { pattern: "Int\\(", label: "Convierte el id a `Int`" },
            { pattern: "isHexDigit|count\\s*==\\s*32", label: "Valida el formato del token" },
          ],
          warnings: [
            { pattern: "absoluteString\\.contains\\(", label: "Validar con `contains` sobre el string se saltea con `acmebank.com.evil.io`" },
            { pattern: "loadHTMLString|evaluateJavaScript", label: "No metas parámetros de un link en un web view" },
          ],
          solution: swift`import Foundation

enum Route: Equatable {
    case product(id: Int)
    case resetPassword(token: String)
}

struct DeepLinkRouter {
    private let allowedHosts: Set<String> = ["acmebank.com", "www.acmebank.com"]

    func route(_ url: URL) -> Route? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme == "https",
              let host = components.host, allowedHosts.contains(host) else { return nil }
        let items = components.queryItems ?? []

        switch components.path {
        case "/product":
            guard let raw = items.first(where: { $0.name == "id" })?.value,
                  let id = Int(raw), id > 0 else { return nil }
            return .product(id: id)
        case "/reset":
            guard let token = items.first(where: { $0.name == "token" })?.value,
                  token.count == 32, token.allSatisfy(\.isHexDigit) else { return nil }
            return .resetPassword(token: token)
        default:
            return nil
        }
    }
}`,
          hint: "`switch components.path` con un `case` por ruta y `default: return nil`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: login seguro de una app bancaria",
      goal: "Integrar Keychain, desbloqueo biométrico, sesión con pinning y un threat model en un feature de login real.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Acme Bank lanza su app. El login devuelve un `accessToken` (15 minutos, solo en memoria) y un `refreshToken` (90 días). Producto quiere: \"después del primer login, entrar con Face ID\". Seguridad pide pinning contra `api.acmebank.com` y que reinstalar la app no reviva sesiones viejas.",
            "Ya tenés las piezas: `TokenStore` (lección 1), `PinnedSessionDelegate` (lección 2), `BiometricVault` (lección 4). Ahora las conectás: limpieza del Keychain en una instalación nueva, desbloqueo biométrico sin bloquear el main thread, la `URLSession` pineada y la revisión del threat model.",
            "Recordá la regla base: todo lo que hacés en el cliente sube el costo del ataque, pero las decisiones (¿este refresh token sigue vivo? ¿esta transferencia está permitida?) las toma el servidor.",
          ],
          code: swift`// Arquitectura del feature
// LoginView ── UnlockViewModel ── BiometricVault (Keychain + .biometryCurrentSet)
//                     │
//                     └── AuthAPI ── URLSession(delegate: PinnedSessionDelegate)
//
// AppDelegate.didFinishLaunching ── SessionCleaner.clearKeychainOnFreshInstall()

protocol AuthAPI: Sendable {
    func refresh(using refreshToken: String) async throws
}`,
        },
        {
          kind: "write",
          prompt:
            "Los ítems del Keychain pueden sobrevivir a la desinstalación, pero `UserDefaults` no. Escribí `struct SessionCleaner` con `func clearKeychainOnFreshInstall()`: si `UserDefaults.standard.bool(forKey: \"hasLaunchedBefore\")` es `false`, borrá todos los ítems `kSecClassGenericPassword` del service `com.acme.bank.auth` y marcá la flag en `true`.",
          starter: swift`import Foundation
import Security

struct SessionCleaner {
    let service = "com.acme.bank.auth"

    func clearKeychainOnFreshInstall() {
        // TODO
    }
}`,
          checks: [
            { pattern: "UserDefaults\\.standard\\.bool\\(forKey:", label: "Lee la flag con `UserDefaults.standard.bool(forKey:)`" },
            { pattern: "SecItemDelete\\(", label: "Borra con `SecItemDelete`" },
            { pattern: "kSecAttrService", label: "Filtra por `kSecAttrService`" },
            { pattern: "UserDefaults\\.standard\\.set\\(\\s*true", label: "Marca la flag en `true`" },
          ],
          warnings: [
            { pattern: "UserDefaults\\.standard\\.set\\([^)]*[Tt]oken", label: "La flag va en `UserDefaults`; el token, nunca" },
            { pattern: "kSecAttrAccount", label: "Sin `kSecAttrAccount` borrás todos los ítems del service, que es lo que buscás" },
          ],
          solution: swift`import Foundation
import Security

struct SessionCleaner {
    let service = "com.acme.bank.auth"

    func clearKeychainOnFreshInstall() {
        guard !UserDefaults.standard.bool(forKey: "hasLaunchedBefore") else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        SecItemDelete(query as CFDictionary)

        UserDefaults.standard.set(true, forKey: "hasLaunchedBefore")
    }
}`,
          hint: "Una query con solo class + service matchea todos los accounts de ese service.",
        },
        {
          kind: "write",
          prompt:
            "Escribí `UnlockViewModel` (`@MainActor @Observable`, con `ObservableObject` también serviría en iOS 16) con `state` (`.locked`, `.unlocked`, `.needsPassword`) y `func unlock() async`. Leé el refresh token con `vault.readRefreshToken(reason:)` dentro de un `Task.detached` (bloquea mientras muestra Face ID), llamá a `api.refresh(using:)` y pasá a `.unlocked`. Si el status es `errSecUserCanceled` quedate en `.locked`; ante cualquier otro error, `.needsPassword`.",
          starter: swift`import Observation
import Security

@MainActor
final class UnlockViewModel {
    enum State: Equatable { case locked, unlocked, needsPassword }

    private(set) var state: State = .locked
    private let vault: BiometricVault
    private let api: AuthAPI

    init(vault: BiometricVault, api: AuthAPI) {
        self.vault = vault
        self.api = api
    }

    func unlock() async {
    }
}`,
          checks: [
            { pattern: "@Observable", label: "Marca la clase con `@Observable`" },
            { pattern: "Task\\.detached", label: "Lee el Keychain fuera del main thread con `Task.detached`" },
            { pattern: "readRefreshToken\\(reason:", label: "Usa `vault.readRefreshToken(reason:)`" },
            { pattern: "refresh\\(using:", label: "Valida con el servidor vía `api.refresh(using:)`" },
            { pattern: "errSecUserCanceled", label: "Distingue la cancelación con `errSecUserCanceled`" },
            { pattern: "\\.needsPassword", label: "Fallback a contraseña" },
          ],
          warnings: [
            { pattern: "evaluatePolicy\\(", label: "Un `Bool` de `evaluatePolicy` no desbloquea nada: el secreto sale del Keychain" },
            { pattern: "UserDefaults", label: "Nada de sesión en `UserDefaults`" },
          ],
          solution: swift`import Observation
import Security

@MainActor
@Observable
final class UnlockViewModel {
    enum State: Equatable { case locked, unlocked, needsPassword }

    private(set) var state: State = .locked
    private let vault: BiometricVault
    private let api: AuthAPI

    init(vault: BiometricVault, api: AuthAPI) {
        self.vault = vault
        self.api = api
    }

    func unlock() async {
        let vault = self.vault
        do {
            let refreshToken = try await Task.detached {
                try vault.readRefreshToken(reason: "Desbloqueá tu cuenta")
            }.value
            try await api.refresh(using: refreshToken)
            state = .unlocked
        } catch KeychainError.unexpectedStatus(errSecUserCanceled) {
            state = .locked
        } catch {
            state = .needsPassword
        }
    }
}`,
          hint: "`catch KeychainError.unexpectedStatus(errSecUserCanceled)` antes del `catch` genérico.",
        },
        {
          kind: "write",
          prompt:
            "Escribí `func makeBankSession() -> URLSession`: configuración `.ephemeral` (sin caché ni cookies en disco), TLS mínimo 1.2 y un `PinnedSessionDelegate` con **dos** pins, `Pins.current` y `Pins.backup`.",
          starter: swift`import Foundation

enum Pins {
    static let current = "CURRENT_KEY_HASH_BASE64="
    static let backup = "BACKUP_KEY_HASH_BASE64="
}

func makeBankSession() -> URLSession {
    URLSession.shared
}`,
          checks: [
            { pattern: "URLSessionConfiguration\\.ephemeral", label: "Usa `URLSessionConfiguration.ephemeral`" },
            { pattern: "tlsMinimumSupportedProtocolVersion", label: "Fija `tlsMinimumSupportedProtocolVersion`" },
            { pattern: "PinnedSessionDelegate\\(\\s*pinnedKeyHashes:\\s*\\[[^\\]]*,[^\\]]*\\]", label: "El delegate recibe al menos dos pins" },
            { pattern: "URLSession\\(\\s*configuration:", label: "Crea la sesión con `URLSession(configuration:delegate:delegateQueue:)`" },
          ],
          warnings: [
            { pattern: "URLSession\\.shared", label: "`URLSession.shared` no tiene tu delegate: no hay pinning" },
            { pattern: "print\\(", label: "No loguees configuración de red ni pins" },
          ],
          solution: swift`import Foundation

enum Pins {
    static let current = "CURRENT_KEY_HASH_BASE64="
    static let backup = "BACKUP_KEY_HASH_BASE64="
}

func makeBankSession() -> URLSession {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.tlsMinimumSupportedProtocolVersion = .TLSv12
    let delegate = PinnedSessionDelegate(pinnedKeyHashes: [Pins.current, Pins.backup])
    return URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
}`,
          hint: "`URLSession` retiene a su delegate (fuertemente) hasta que la invalidás: no hace falta guardarlo aparte.",
        },
        {
          kind: "predict",
          prompt: "Revisando el threat model, producto propone: \"Si `looksJailbroken()` da `false` y Face ID pasó, salteemos el límite diario de transferencias en el server\". ¿Qué respondés?",
          code: `threat: "Transferencias por encima del límite diario"
current_mitigation: "límite validado en el servidor por cuenta"
proposal: "el cliente manda isTrusted=true y el server saltea el límite"`,
          options: [
            "Aceptarlo: Face ID ocurre en el Secure Enclave, así que `isTrusted` es confiable",
            "Aceptarlo solo si además el campo `isTrusted` se cifra con AES-GCM",
            "Rechazarlo: `isTrusted` lo controla el cliente y se falsifica; el límite se sigue validando en el server, y si hace falta, con señales verificables por el server como App Attest",
            "Aceptarlo pero mover también el límite al cliente para que responda más rápido",
          ],
          answer: 2,
          explanation:
            "Cualquier flag que el cliente manda (`isTrusted`, `jailbroken=false`, `faceIdPassed`) se falsifica con un proxy o parcheando la app; cifrarlo con una clave que vive en la app no cambia nada. El server decide con lo que puede verificar: assertions de App Attest, firma con clave del Secure Enclave registrada, historial de la cuenta.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-userdefaults",
      front: "¿Por qué nunca guardar un token en `UserDefaults`?",
      back: "Es un `.plist` en texto plano dentro del contenedor: lo leen backups sin cifrar, dispositivos con jailbreak y herramientas forenses. Los secretos van al Keychain.",
    },
    {
      id: "fc-keychain-primary-key",
      front: "¿Qué identifica un ítem `kSecClassGenericPassword`?",
      back: "La dupla `kSecAttrService` + `kSecAttrAccount`. Agregar otro con la misma dupla da `errSecDuplicateItem`.",
    },
    {
      id: "fc-duplicate",
      front: "Patrón correcto para \"guardar\" en el Keychain",
      back: "`SecItemAdd`; si devuelve `errSecDuplicateItem`, `SecItemUpdate` con el nuevo `kSecValueData`. `SecItemAdd` nunca pisa.",
    },
    {
      id: "fc-this-device-only",
      front: "¿Qué cambia el sufijo `ThisDeviceOnly` en `kSecAttrAccessible`?",
      back: "El ítem no migra a otro dispositivo al restaurar un backup. Para tokens de sesión es lo correcto.",
      code: "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly",
    },
    {
      id: "fc-data-protection",
      front: "¿Cómo protegés un archivo con datos sensibles?",
      back: "Data Protection: escribilo con `.completeFileProtection` (o `FileProtectionType.complete`) y queda cifrado mientras el dispositivo está bloqueado.",
      code: "try data.write(to: url, options: .completeFileProtection)",
    },
    {
      id: "fc-ats",
      front: "¿Qué exige ATS por defecto y cómo se exceptúa bien?",
      back: "HTTPS con TLS 1.2+, certificado válido y forward secrecy. Excepciones angostas por dominio con `NSExceptionDomains`; nunca `NSAllowsArbitraryLoads` en Release.",
    },
    {
      id: "fc-pinning-order",
      front: "Orden de chequeos en un delegate de pinning",
      back: "1) `SecTrustEvaluateWithError` (cadena, fecha, host). 2) Comparar hash de las claves públicas contra los pins. Si falla: `.cancelAuthenticationChallenge`.",
    },
    {
      id: "fc-backup-pin",
      front: "¿Por qué siempre un pin de respaldo?",
      back: "Los pins están compilados en el binario. Si el server rota a una clave no pineada, todas las versiones instaladas quedan sin red hasta actualizar.",
    },
    {
      id: "fc-logger-privacy",
      front: "¿Cómo loguear un email sin exponerlo?",
      back: "Con `Logger` y `privacy: .private` (o `.private(mask: .hash)` para correlacionar). Nunca headers `Authorization` ni bodies de login.",
      code: `logger.info("Login de \\(email, privacy: .private)")`,
    },
    {
      id: "fc-hash-vs-encrypt",
      front: "Hash vs HMAC vs AES-GCM",
      back: "Hash: huella sin clave, una vía. HMAC: hash con clave, prueba autenticidad. AES-GCM: cifra y autentica; `open` falla si tocaron un byte.",
    },
    {
      id: "fc-secure-enclave",
      front: "¿Qué guardás de una clave del Secure Enclave?",
      back: "Su `dataRepresentation`: un blob cifrado que solo ese Secure Enclave puede usar. La clave privada nunca sale del chip.",
      code: "let key = try SecureEnclave.P256.Signing.PrivateKey()\nstore(key.dataRepresentation)",
    },
    {
      id: "fc-biometric-bool",
      front: "¿Por qué un `Bool` de `evaluatePolicy` no es seguridad?",
      back: "Se parchea con Frida. El secreto tiene que estar en un ítem del Keychain con `SecAccessControlCreateWithFlags(.biometryCurrentSet)`: sin match, el sistema no lo entrega.",
    },
    {
      id: "fc-current-set",
      front: "`.biometryCurrentSet` vs `.biometryAny`",
      back: "`.biometryCurrentSet` invalida el ítem si cambian las caras/huellas enroladas; `.biometryAny` no. El primero evita que alguien con tu passcode enrole su cara y lea el secreto.",
    },
    {
      id: "fc-binary-secrets",
      front: "Una API key está fuera de git e inyectada por CI. ¿Está segura?",
      back: "No: está en el binario y se extrae con `strings`. Las claves secretas van en el backend; la app solo lleva claves publicables o restringidas.",
    },
    {
      id: "fc-app-attest",
      front: "¿Qué prueba App Attest y a quién?",
      back: "A tu servidor: que el request viene de tu app sin modificar en un dispositivo Apple real. Solo sirve si el server valida attestation y assertions. No prueba que el usuario sea honesto.",
    },
  ],

  exam: [
    {
      id: "ex-01",
      question: "Un usuario reporta que después de cambiar de contraseña la app lo desloguea cada vez que la abre. El código de `save` hace solo `SecItemAdd` e ignora el status. ¿Cuál es la causa más probable?",
      options: [
        "El Keychain borra los ítems al cerrar la app",
        "`kSecAttrAccessibleWhenUnlocked` expira los ítems a las 24 horas",
        "`SecItemAdd` devuelve `errSecDuplicateItem` y el token viejo (ya revocado) sigue guardado",
        "`SecItemCopyMatching` siempre devuelve el primer valor guardado de la app",
      ],
      answer: 2,
      explanation: "`SecItemAdd` no pisa un ítem existente. Al ignorar el status, el token nuevo nunca se guarda y la app sigue usando el revocado. Hay que manejar `errSecDuplicateItem` con `SecItemUpdate`.",
    },
    {
      id: "ex-02",
      question: "Una background task refresca el token de madrugada con el teléfono bloqueado y falla leyendo el Keychain. El ítem se guardó sin `kSecAttrAccessible`. ¿Qué cambiás?",
      options: [
        "Usar `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`",
        "Mover el token a `UserDefaults` solo para la background task",
        "Usar `.biometryAny` para que no pida desbloqueo",
        "Guardar el token en un archivo con `.completeFileProtection`",
      ],
      answer: 0,
      explanation: "El default es `WhenUnlocked`: con el dispositivo bloqueado no se puede leer. `AfterFirstUnlock` permite leerlo después del primer desbloqueo desde el reinicio; `ThisDeviceOnly` evita que viaje en backups. Un archivo con `.complete` tampoco sería legible bloqueado.",
    },
    {
      id: "ex-03",
      question: "QA usa Charles Proxy con su certificado raíz instalado en el iPhone y ve en claro todo el tráfico de la app bancaria. ¿Qué mecanismo lo impediría?",
      options: [
        "Activar ATS, que hoy está apagado",
        "Cifrar el body con AES-GCM usando una clave hardcodeada",
        "Usar `URLSession.shared` en vez de una sesión propia",
        "Pinning de clave pública, que rechaza certificados aunque estén firmados por una CA confiable para el sistema",
      ],
      answer: 3,
      explanation: "ATS confía en cualquier CA que el usuario instaló, así que el proxy pasa. El pinning exige además una clave pública específica. La clave hardcodeada se extrae del binario.",
    },
    {
      id: "ex-04",
      question: "¿Qué hace falta para rotar el certificado del API sin dejar a ningún usuario sin red?",
      options: [
        "Desactivar el pinning una semana antes",
        "Que las versiones instaladas ya tengan pineada la clave de respaldo que ops va a usar, y agregar un nuevo respaldo en la siguiente release",
        "Pinear el certificado hoja en vez de la clave pública",
        "Forzar a todos a actualizar el mismo día de la rotación",
      ],
      answer: 1,
      explanation: "La rotación funciona si la clave nueva ya estaba pineada como respaldo en los binarios instalados. Pinear el certificado hoja empeora la situación porque cambia en cada renovación.",
    },
    {
      id: "ex-05",
      question: "¿Qué imprime este código si alguien cambió un byte de `stored`?",
      code: "do {\n    let box = try AES.GCM.SealedBox(combined: stored)\n    _ = try AES.GCM.open(box, using: key)\n    print(\"ok\")\n} catch {\n    print(\"fail\")\n}",
      options: ["ok", "fail", "Nada: crashea", "ok, pero con datos corruptos"],
      answer: 1,
      explanation: "AES-GCM verifica el tag de autenticación en `open`; si no coincide tira `CryptoKitError.authenticationFailure` y nunca devuelve datos manipulados.",
    },
    {
      id: "ex-06",
      question: "Un dev propone guardar las contraseñas de los usuarios como `SHA256` en la base local para \"no guardarlas en claro\". ¿Qué respondés?",
      options: [
        "Bien, SHA256 es irreversible así que es seguro",
        "Mejor `Insecure.MD5`, que es más rápido",
        "Bien, pero con `HMAC` usando una clave del binario",
        "No guardar contraseñas en el cliente: se autentica contra el server, que las hashea con un algoritmo lento y con sal; en el dispositivo se guarda un token en el Keychain",
      ],
      answer: 3,
      explanation: "Un SHA256 sin sal se rompe con tablas precalculadas y es rápido de atacar por fuerza bruta. El cliente no necesita la contraseña después del login: guarda un token revocable en el Keychain.",
    },
    {
      id: "ex-07",
      question: "Necesitás que el servidor verifique que cada transferencia la firmó una clave que no puede copiarse a otro dispositivo. ¿Qué usás?",
      options: [
        "`SecureEnclave.P256.Signing.PrivateKey`, registrando su clave pública en el server",
        "`Curve25519.Signing.PrivateKey` guardando su `rawRepresentation` en `UserDefaults`",
        "`HMAC<SHA256>` con una clave compartida compilada en la app",
        "`SHA256.hash` del body",
      ],
      answer: 0,
      explanation: "La clave del Secure Enclave nunca sale del chip: se firma ahí y el server verifica con la pública. Una clave en software o compartida en el binario se puede extraer; un hash no prueba quién lo generó.",
    },
    {
      id: "ex-08",
      question: "La app muestra datos de la cuenta si `evaluatePolicy` devuelve `true`, y el access token se lee de un ítem `AfterFirstUnlock`. ¿Cuál es el problema?",
      options: [
        "Falta `NSCameraUsageDescription`",
        "`evaluatePolicy` no es `async`",
        "La protección es un `Bool` en memoria; el token se puede leer sin biometría. Debería estar en un ítem con `.biometryCurrentSet`",
        "`AfterFirstUnlock` hace que el token se borre al bloquear",
      ],
      answer: 2,
      explanation: "Con el resultado de `evaluatePolicy` parcheado (o leyendo el Keychain directo en un dispositivo comprometido) el token queda expuesto. Con control de acceso biométrico, el Keychain solo libera el secreto tras un match real.",
    },
    {
      id: "ex-09",
      question: "Llega este universal link: `https://acmebank.com.evil.io/transfer?to=999&amount=5000`. El código valida con `url.absoluteString.contains(\"acmebank.com\")` y ejecuta la transferencia. ¿Qué arreglás?",
      options: [
        "Agregar un `print` del link para auditarlo",
        "Validar con `hasPrefix(\"https://acmebank\")`",
        "Bloquear el link solo si `looksJailbroken()` es `true`",
        "Comparar `URLComponents.host` contra una allowlist exacta y llevar al usuario a una pantalla de confirmación; el server autoriza la transferencia",
      ],
      answer: 3,
      explanation: "`contains` y `hasPrefix` sobre el string se saltean con dominios como `acmebank.com.evil.io`. El host se compara exacto, y una acción con efecto nunca se ejecuta directo desde un link.",
    },
    {
      id: "ex-10",
      question: "¿Qué garantiza App Attest cuando el servidor valida correctamente attestation y assertions?",
      options: [
        "Que el usuario no es un estafador",
        "Que el request viene de una instancia legítima de tu app sin modificar, en un dispositivo Apple real",
        "Que el dispositivo no tiene jailbreak",
        "Que el tráfico no pasó por un proxy",
      ],
      answer: 1,
      explanation: "App Attest certifica la app y el dispositivo, no al usuario. Un usuario malicioso con tu app original y un iPhone real pasa la attestation; para eso están el rate limiting y las reglas de negocio en el server.",
    },
    {
      id: "ex-11",
      question: "En el threat model del login aparece: \"un atacante con una app modificada saltea el chequeo de Face ID\". ¿Qué categoría STRIDE y qué mitigación corresponden?",
      options: [
        "Tampering; secreto en Keychain con `.biometryCurrentSet` y App Attest en el endpoint de refresh",
        "Repudiation; agregar logs en el cliente",
        "Denial of service; rate limiting",
        "Information disclosure; ofuscar el binario",
      ],
      answer: 0,
      explanation: "Modificar la app para cambiar su comportamiento es Tampering. La mitigación es que el secreto dependa de la biometría a nivel Keychain y que el server pueda verificar la integridad de la app con App Attest.",
    },
    {
      id: "ex-12",
      question: "Un SDK de mapas necesita una API key que se cobra por request y no admite restricción por bundle id. ¿Qué hacés?",
      options: [
        "Ponerla en un `.xcconfig` fuera de git, alcanza",
        "Ofuscarla partiéndola en tres strings",
        "Proxyar las llamadas por tu backend, que tiene la key y aplica autenticación y rate limiting",
        "Guardarla en el Keychain en el primer arranque",
      ],
      answer: 2,
      explanation: "Todo lo que va en el binario se extrae, y para guardarla en el Keychain primero tiene que estar en la app. Si la key cuesta plata y no se puede restringir, vive en el servidor y la app llama a tu backend.",
    },
  ],
};

export default content;
