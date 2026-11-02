import type { CourseContent } from "../types";

// Swift code uses String.raw so the backslashes in `\(...)` and `\.keyPath` survive.
const swift = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "keychain-storage",
      title: "Keychain and secure storage",
      goal: "Store tokens in the Keychain with `SecItemAdd`/`SecItemCopyMatching`/`SecItemUpdate`/`SecItemDelete`, pick the right accessibility attribute, and protect files with Data Protection.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The client is enemy territory",
          body: [
            "The ground rule for this whole course: **the device is not yours**. Anything in the binary or in the app container can be read from an unencrypted backup, a jailbroken device or a debugger. And every important check is repeated on the server.",
            "`UserDefaults` is a plain-text `.plist` in the container's `Library/Preferences/`. Use it for preferences (theme, last selected tab), **never** for tokens, passwords or personal data.",
            "Small secrets (tokens, passwords, keys) belong in the **Keychain**: an encrypted store managed by the OS, protected by the device passcode and, optionally, by biometrics.",
          ],
          code: swift`// BAD: plain text in Library/Preferences/com.acme.bank.plist
UserDefaults.standard.set(refreshToken, forKey: "refreshToken")

// $ plutil -p Library/Preferences/com.acme.bank.plist
// {
//   "refreshToken" => "eyJhbGciOiJIUzI1NiJ9..."
// }

// GOOD: Keychain (we build this in this lesson)
try tokenStore.save(refreshToken, account: "refresh-token")`,
        },
        {
          kind: "predict",
          prompt: "Your app receives a 90-day `refreshToken` on login. In the PR, where do you suggest storing it?",
          code: swift`func didLogin(_ response: LoginResponse) {
    // Where do we store response.refreshToken?
}`,
          options: [
            "In `UserDefaults`, the app is sandboxed anyway",
            "In a JSON file in `Documents/` so it's easy to debug",
            "In the Keychain as `kSecClassGenericPassword` with `...ThisDeviceOnly` accessibility",
            "Hardcoded in the binary with an obfuscation key",
          ],
          answer: 2,
          explanation:
            "The sandbox stops **other apps** from reading your files, but not backups, jailbroken devices or forensic tools. `Documents/` also shows up in the Files app if file sharing is on. The Keychain encrypts the item and, with `ThisDeviceOnly`, it doesn't travel to another device in a backup.",
        },
        {
          kind: "explain",
          title: "Anatomy of a Keychain query",
          body: [
            "You talk to the Keychain through four C functions from the `Security` framework: `SecItemAdd`, `SecItemCopyMatching`, `SecItemUpdate` and `SecItemDelete`. They all take a dictionary (cast to `CFDictionary`) and return an `OSStatus`: `errSecSuccess` when it worked.",
            "A `kSecClassGenericPassword` item is identified by `kSecAttrService` (your app or subsystem, e.g. `com.acme.bank.auth`) plus `kSecAttrAccount` (which secret, e.g. `refresh-token`). That pair is the primary key.",
            "To read, ask for `kSecReturnData: true` and `kSecMatchLimit: kSecMatchLimitOne`, and pass a `CFTypeRef?` by reference. If it doesn't exist the status is `errSecItemNotFound`: not an error, just \"no token yet\".",
          ],
          code: swift`import Foundation
import Security

let base: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.acme.bank.auth",
    kSecAttrAccount as String: "refresh-token",
]

// Save
var add = base
add[kSecValueData as String] = Data("eyJhbGciOi...".utf8)
let addStatus = SecItemAdd(add as CFDictionary, nil)

// Read
var query = base
query[kSecReturnData as String] = true
query[kSecMatchLimit as String] = kSecMatchLimitOne

var item: CFTypeRef?
let status = SecItemCopyMatching(query as CFDictionary, &item)
if status == errSecSuccess, let data = item as? Data {
    let token = String(decoding: data, as: UTF8.self)
    // use token (never print it)
} else if status == errSecItemNotFound {
    // no stored session
}`,
        },
        {
          kind: "fill",
          prompt: "Fill in the function that looks up the item and returns it in `item`.",
          code: swift`var item: CFTypeRef?
let status = ____(query as CFDictionary, &item)
guard status == errSecSuccess, let data = item as? Data else { return nil }`,
          accept: ["^SecItemCopyMatching$"],
          hint: "It's the read function: it \"copies the matching items\".",
          explanation: "`SecItemCopyMatching` runs the query and, since you asked for `kSecReturnData`, puts the secret's `Data` in `item`.",
        },
        {
          kind: "predict",
          prompt: "`NaiveKeychain.add` only calls `SecItemAdd` and `read` uses `SecItemCopyMatching`, both with the same service/account. What does it print?",
          code: swift`let keychain = NaiveKeychain(service: "com.acme.bank.auth")

let first = keychain.add("abc", account: "user")
let second = keychain.add("xyz", account: "user")

print(first == errSecSuccess, second == errSecDuplicateItem)
print(keychain.read(account: "user") ?? "nil")`,
          options: ["`true true` and `abc`", "`true false` and `xyz`", "`true true` and `xyz`", "`false true` and `nil`"],
          answer: 0,
          explanation:
            "`SecItemAdd` doesn't overwrite: if an item with that primary key exists it returns `errSecDuplicateItem` and keeps the old value. That's why `save` should try `SecItemAdd` and, on duplicate, call `SecItemUpdate` (or delete and re-add). This bug leaves stale tokens around and shows up in production as \"it keeps logging me out\".",
        },
        {
          kind: "explain",
          title: "Accessibility and Data Protection",
          body: [
            "`kSecAttrAccessible` defines **when** the item can be read. `kSecAttrAccessibleWhenUnlocked` (the default): only while the device is unlocked. `kSecAttrAccessibleAfterFirstUnlock`: after the first unlock since reboot, which is what you need for background token refresh. `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`: only if a passcode is set.",
            "The `ThisDeviceOnly` suffix means the item **does not migrate** to another device when a backup is restored. For session tokens that's what you want: a new device has to log in again.",
            "For files (a bank statement PDF, a SQLite database with personal data) use **Data Protection**: the OS encrypts them with a key tied to the passcode. `.completeFileProtection` makes them unreadable while the device is locked.",
            "Heads up: Keychain items can survive deleting the app. After a reinstall an old session may come back; we fix that in the final challenge.",
          ],
          code: swift`// Readable by a background refresh, never restored from backups
add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

// File encrypted while the device is locked
let url = URL.documentsDirectory.appending(path: "statement-2026-10.pdf")
try pdfData.write(to: url, options: .completeFileProtection)

// Or for an existing file
try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.complete],
    ofItemAtPath: url.path()
)`,
        },
        {
          kind: "fill",
          prompt: "The app refreshes the token from a background task (it may run while the phone is locked) and the token must not be restored onto another device. Fill in the accessibility.",
          code: swift`attributes[kSecAttrAccessible as String] = ____`,
          accept: ["^kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly$"],
          hint: "You need \"after first unlock\" + \"this device only\".",
          explanation:
            "`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`: readable while locked (as long as the device was unlocked once since reboot) and not migrated through backups. With `WhenUnlocked` the background task would fail with the phone in a pocket.",
        },
        {
          kind: "write",
          prompt:
            "Write a `struct TokenStore` with `save(_ token: String, account: String) throws`, `read(account: String) throws -> String?` and `delete(account: String) throws`. `save` adds the item and, if it already exists, updates it. `read` returns `nil` when there's no item. Use `...ThisDeviceOnly` accessibility and an `enum KeychainError: Error` with `unexpectedStatus(OSStatus)`.",
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
            { pattern: "SecItemAdd\\(", label: "Adds with `SecItemAdd`" },
            { pattern: "errSecDuplicateItem", label: "Detects duplicates with `errSecDuplicateItem`" },
            { pattern: "SecItemUpdate\\(", label: "Updates with `SecItemUpdate`" },
            { pattern: "SecItemCopyMatching\\(", label: "Reads with `SecItemCopyMatching`" },
            { pattern: "errSecItemNotFound", label: "Returns `nil` on `errSecItemNotFound`" },
            { pattern: "SecItemDelete\\(", label: "Deletes with `SecItemDelete`" },
            { pattern: "kSecAttrAccessible\\w*ThisDeviceOnly", label: "`...ThisDeviceOnly` accessibility" },
          ],
          warnings: [
            { pattern: "UserDefaults", label: "Tokens never go in `UserDefaults`" },
            { pattern: "print\\(", label: "Don't print tokens: they end up in logs and crash reports" },
            { pattern: "kSecAttrAccessibleAlways", label: "`kSecAttrAccessibleAlways` is deprecated and insecure" },
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
          hint: "Build a `baseQuery(account:)` with class + service + account and reuse it in all four operations.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "network-security",
      title: "ATS, pinning and secure traffic",
      goal: "Understand App Transport Security and its exceptions, implement public-key pinning with `URLSessionDelegate` and `SecTrust`, plan pin rotation, and keep sensitive data out of logs.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "App Transport Security",
          body: [
            "ATS is on by default: `URLSession` only talks HTTPS with TLS 1.2 or later, valid certificates and forward secrecy. A request to `http://` fails before it leaves the device.",
            "Exceptions live in `Info.plist` under `NSAppTransportSecurity` and should be **as narrow as possible**: per domain with `NSExceptionDomains`, never global with `NSAllowsArbitraryLoads`. App Review may ask you to justify each one.",
            "For local development there's `NSAllowsLocalNetworking`. If staging needs an exception, put it only in the Debug/Staging `Info.plist` (you saw how with `.xcconfig` in the CI/CD course).",
          ],
          code: `<key>NSAppTransportSecurity</key>
<dict>
    <!-- Good: narrow exception for a legacy partner -->
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
    <!-- Development builds only: server on the local network -->
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>`,
        },
        {
          kind: "predict",
          prompt: "A PR adds this to the production `Info.plist` \"so the QA server, which is HTTP, works\". What's your review comment?",
          code: `<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>`,
          options: [
            "Approve: ATS only affects `WKWebView`",
            "Approve: the production backend uses HTTPS anyway",
            "Change `true` to `YES`, that's the correct syntax",
            "Request changes: it disables ATS for every domain; use `NSExceptionDomains` for the QA host and only in the QA configuration",
          ],
          answer: 3,
          explanation:
            "`NSAllowsArbitraryLoads` turns ATS off for **everything**: any URL the app loads (including one from a deep link or an SDK) may go over plain-text HTTP. Exceptions go per domain and in the `Info.plist` of the configuration that needs them, not in Release.",
        },
        {
          kind: "explain",
          title: "Public-key pinning with URLSessionDelegate",
          body: [
            "ATS trusts any CA installed on the device. If someone installs a profile with their own CA (a corporate proxy, or an attacker with Charles/mitmproxy), they can read your traffic. **Pinning** adds: \"on top of being valid, the certificate must carry this public key\".",
            "You implement it in `urlSession(_:didReceive:completionHandler:)`. First let the system validate the chain with `SecTrustEvaluateWithError` (CA, dates, hostname). **Then** compare the hashes of the chain's keys against your pin set. No match: `.cancelAuthenticationChallenge`.",
            "Pin the **public key**, not the certificate: certificates are renewed every year, the key can stay. Note: this hash (SHA-256 of the key's external representation) is not the same as the `SPKI-SHA256-BASE64` used in `Info.plist`, which includes the ASN.1 header. Generate your pins with the same method you compare with.",
          ],
          code: swift`import CryptoKit
import Foundation
import Security

final class PinnedSessionDelegate: NSObject, URLSessionDelegate {
    private let pinnedKeyHashes: Set<String>   // current pin + backup pin

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
        // 1. Standard validation: CA, expiry, hostname
        guard SecTrustEvaluateWithError(trust, nil) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        // 2. Pinning: some key in the chain must be in the set
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
          prompt: "Before comparing pins, let the system validate the full chain. Fill in the function.",
          code: swift`guard ____(trust, nil) else {
    completionHandler(.cancelAuthenticationChallenge, nil)
    return
}`,
          accept: ["^SecTrustEvaluateWithError$"],
          hint: "It returns a `Bool` and replaced the deprecated `SecTrustEvaluate`.",
          explanation:
            "`SecTrustEvaluateWithError` checks CA, dates and hostname. If you skip it and only compare the pin, you'd accept an expired certificate, or one issued for another host that happens to use that key.",
        },
        {
          kind: "predict",
          prompt: "The app pins **a single** hash: the server's leaf certificate. Ops renews the certificate with a new key, like every year. What happens?",
          code: swift`let delegate = PinnedSessionDelegate(
    pinnedKeyHashes: ["LEAF_2025_KEY_HASH="]
)`,
          options: [
            "Nothing: `SecTrustEvaluateWithError` accepts the new certificate and the pin is ignored",
            "Every installed version fails every request until the user updates; if login is pinned too, they can't even see a server-side notice",
            "iOS downloads the new pin from the server automatically",
            "Only the first request fails, then the new key gets cached",
          ],
          answer: 1,
          explanation:
            "The pin is compiled into the binary: with the new key no connection passes the check. That's why a rotation plan is mandatory: always at least one **backup pin** (a key ops already generated and stored, or the intermediate CA's), rotation coordinated with releases and, ideally, a remote kill switch.",
        },
        {
          kind: "explain",
          title: "NSPinnedDomains, rotation and logs",
          body: [
            "Since iOS 14 you can declare pins in `Info.plist` with `NSPinnedDomains`, no code needed: `NSPinnedCAIdentities` (pin the CA) or `NSPinnedLeafIdentities` (pin the leaf), each with `SPKI-SHA256-BASE64`. It applies to `URLSession` without a delegate.",
            "Rotation plan: (1) always two or more pins, the current one and a backup that isn't in use yet; (2) when ops rotates, they switch to the backup key and the next release adds a new backup; (3) monitor TLS failures per app version.",
            "Encrypted traffic is pointless if you log it afterwards. With `Logger` (os) dynamic interpolations are private by default on devices without a debugger attached, but mark emails, ids and amounts explicitly with `privacy: .private`, and **never** log `Authorization` headers or login bodies.",
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

<!-- In Swift:
let logger = Logger(subsystem: "com.acme.bank", category: "auth")
logger.info("Login OK for \(email, privacy: .private)")
-->`,
        },
        {
          kind: "fill",
          prompt: "Fill in the blank so the email doesn't show up in plain text in the device logs.",
          code: swift`let logger = Logger(subsystem: "com.acme.bank", category: "auth")
logger.info("Password reset requested for \(email, privacy: ____)")`,
          accept: ["^\\.private$", "^private$", "^\\.private\\(mask:\\s*\\.hash\\)$"],
          hint: "The opposite of `.public`.",
          explanation:
            "`privacy: .private` shows the value as `<private>` in Console. `.private(mask: .hash)` shows a stable hash, handy to correlate events for the same user without exposing the data.",
        },
        {
          kind: "write",
          prompt:
            "Implement `PinnedSessionDelegate`'s delegate method: only handle `NSURLAuthenticationMethodServerTrust` (everything else gets `.performDefaultHandling`), validate the chain with `SecTrustEvaluateWithError`, get the chain with `SecTrustCopyCertificateChain`, hash each public key with `SHA256` as base64, and accept with `URLCredential(trust:)` only if one is in `pinnedKeyHashes`.",
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
            { pattern: "NSURLAuthenticationMethodServerTrust", label: "Filters on `NSURLAuthenticationMethodServerTrust`" },
            { pattern: "SecTrustEvaluateWithError\\(", label: "Validates the chain with `SecTrustEvaluateWithError`" },
            { pattern: "SecTrustCopyCertificateChain\\(", label: "Gets the chain with `SecTrustCopyCertificateChain`" },
            { pattern: "SHA256\\.hash\\(", label: "Hashes the key with `SHA256.hash`" },
            { pattern: "\\.cancelAuthenticationChallenge", label: "Cancels when nothing matches" },
            { pattern: "URLCredential\\(\\s*trust:", label: "Accepts with `URLCredential(trust:)`" },
          ],
          warnings: [
            { pattern: "SecTrustEvaluate\\(", label: "`SecTrustEvaluate` is deprecated: use `SecTrustEvaluateWithError`" },
            { pattern: "print\\(", label: "Don't log certificates or hashes in production" },
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
          hint: "Each certificate's key: `SecCertificateCopyKey`, then `SecKeyCopyExternalRepresentation`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "cryptokit",
      title: "CryptoKit without rolling your own crypto",
      goal: "Use `SHA256`, `HMAC`, `AES.GCM`, `P256`/`Curve25519` signatures and `SecureEnclave` keys, knowing what each primitive guarantees.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "Hashes: fingerprints, not encryption",
          body: [
            "A hash like `SHA256.hash(data:)` turns any input into 32 bytes. It's deterministic (same input, same hash) and one-way: you can't \"decrypt\" it. Use it for integrity checks, cache keys or App Attest's `clientDataHash`.",
            "It is **not** for storing passwords on the client or \"hiding\" data: two users with the same password get the same hash, and precomputed tables exist. Passwords are hashed on the **server** with a slow, salted algorithm (Argon2, bcrypt, scrypt).",
            "Golden rule: **never roll your own crypto**. No homemade XOR, no MD5/SHA1 (CryptoKit keeps them under `Insecure`), no hardcoded keys. CryptoKit gives you modern primitives with APIs that are hard to misuse.",
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
            "Same input gives the same digest (`true`); changing one capital letter changes the whole hash (`false`). It's 32 bytes, which is 64 hex characters. Being deterministic is exactly why it isn't enough for passwords: you need a salt and a slow algorithm, on the server.",
        },
        {
          kind: "explain",
          title: "HMAC and AES.GCM",
          body: [
            "**HMAC** = keyed hash. It proves whoever produced the code had the key and that the message didn't change. `HMAC<SHA256>.authenticationCode(for:using:)` creates it and `isValidAuthenticationCode` checks it in constant time.",
            "**AES.GCM** encrypts and authenticates in one go (AEAD): `AES.GCM.seal` returns a `SealedBox` with nonce, ciphertext and tag. `combined` packs everything into one `Data` for storage. `AES.GCM.open` checks the tag before returning anything: if a single byte was touched, it throws.",
            "The key (`SymmetricKey(size: .bits256)`) is the real secret: keep it in the Keychain, never in the binary. If the key ships in the code, the encryption is decorative.",
          ],
          code: swift`import CryptoKit
import Foundation

let key = SymmetricKey(size: .bits256)          // keep it in the Keychain
let plaintext = Data("secret note".utf8)

let sealed = try AES.GCM.seal(plaintext, using: key)
let stored = sealed.combined!                    // nonce + ciphertext + tag

let box = try AES.GCM.SealedBox(combined: stored)
let opened = try AES.GCM.open(box, using: key)
print(String(decoding: opened, as: UTF8.self))

let mac = HMAC<SHA256>.authenticationCode(for: plaintext, using: key)
print(HMAC<SHA256>.isValidAuthenticationCode(mac, authenticating: plaintext, using: key))`,
          output: `secret note
true`,
        },
        {
          kind: "fill",
          prompt: "Fill in the blank to encrypt and authenticate the payload with AES-GCM.",
          code: swift`let box = try AES.GCM.____(payload, using: key)
try store.saveData(box.combined!, account: "offline-cache")`,
          accept: ["^seal$"],
          hint: "The opposite of `open`.",
          explanation: "`AES.GCM.seal(_:using:)` generates a random nonce, encrypts and computes the tag. Never reuse a nonce with the same key: let `seal` generate it.",
        },
        {
          kind: "predict",
          prompt: "Someone flips the last byte of the encrypted data stored on disk. What does it print?",
          code: swift`var bytes = sealed.combined!
bytes[bytes.count - 1] ^= 0xFF

do {
    let box = try AES.GCM.SealedBox(combined: bytes)
    let data = try AES.GCM.open(box, using: key)
    print("opened:", String(decoding: data, as: UTF8.self))
} catch {
    print("rejected")
}`,
          options: [
            "`opened: secret note`, because the last byte is padding",
            "`rejected`",
            "`opened:` followed by garbage",
            "It crashes in `SealedBox(combined:)`",
          ],
          answer: 1,
          explanation:
            "The tail of `combined` is the authentication tag. `open` recomputes the tag and, since it doesn't match, throws `CryptoKitError.authenticationFailure`. GCM has no padding and never hands you tampered data: that's the advantage of an AEAD over \"just encrypt it\".",
        },
        {
          kind: "explain",
          title: "Signatures and the Secure Enclave",
          body: [
            "With asymmetric signatures the private key signs and the public key verifies. `P256.Signing` and `Curve25519.Signing` have `PrivateKey()`, `signature(for:)` and `publicKey.isValidSignature(_:for:)`. Use them so the server can verify that **this** device produced a request.",
            "`SecureEnclave.P256.Signing.PrivateKey()` creates the key **inside** the Secure Enclave: the private key never leaves the chip, not even your app sees it. What you store (in the Keychain) is `dataRepresentation`, an encrypted blob only that Secure Enclave can use. Check `SecureEnclave.isAvailable` (the simulator may not have one).",
            "Send the public key to the server once (for example via `derRepresentation`) and from then on every sensitive request is signed.",
          ],
          code: swift`import CryptoKit
import Foundation

let signingKey = Curve25519.Signing.PrivateKey()
let message = Data("amount=500&to=42".utf8)
let signature = try signingKey.signature(for: message)

let publicKey = signingKey.publicKey
print(publicKey.isValidSignature(signature, for: message))
print(publicKey.isValidSignature(signature, for: Data("amount=900&to=42".utf8)))

// On a real device: the private key lives in the Secure Enclave
if SecureEnclave.isAvailable {
    let seKey = try SecureEnclave.P256.Signing.PrivateKey()
    let blob = seKey.dataRepresentation            // store it in the Keychain
    let restored = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob)
    let der = try restored.signature(for: message).derRepresentation
}`,
          output: `true
false`,
        },
        {
          kind: "fill",
          prompt: "Before creating a Secure Enclave key, check that the hardware exists.",
          code: swift`guard SecureEnclave.____ else {
    throw SignerError.secureEnclaveUnavailable
}`,
          accept: ["^isAvailable$"],
          hint: "A static `Bool` property.",
          explanation: "`SecureEnclave.isAvailable` is `false` on devices without a Secure Enclave and may be on the simulator. Without that check, `PrivateKey()` throws.",
        },
        {
          kind: "write",
          prompt:
            "Write `struct RequestSigner` whose `init(store:)` loads a `SecureEnclave.P256.Signing.PrivateKey` from the Keychain (`store.readData(account:)` returns `Data?`) or, if there's none, creates one and stores its `dataRepresentation` with `store.saveData(_:account:)`. Expose `publicKeyDER: Data` and `sign(_ body: Data) throws -> String` returning the DER signature as base64. If there's no Secure Enclave, throw.",
          starter: swift`import CryptoKit
import Foundation

enum SignerError: Error { case secureEnclaveUnavailable }

struct RequestSigner {
    // your implementation
}`,
          checks: [
            { pattern: "SecureEnclave\\.isAvailable", label: "Checks `SecureEnclave.isAvailable`" },
            { pattern: "SecureEnclave\\.P256\\.Signing\\.PrivateKey\\(", label: "Creates or restores a Secure Enclave key" },
            { pattern: "dataRepresentation", label: "Persists the blob via `dataRepresentation`" },
            { pattern: "\\.signature\\(for:", label: "Signs with `signature(for:)`" },
            { pattern: "derRepresentation", label: "Serializes with `derRepresentation`" },
          ],
          warnings: [
            { pattern: "Insecure\\.", label: "No `Insecure.MD5` or `Insecure.SHA1`" },
            { pattern: "rawRepresentation", label: "A Secure Enclave key can't be exported: store `dataRepresentation`" },
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
          hint: "`init(dataRepresentation:)` restores the key; `PrivateKey()` creates a new one.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "local-auth-secrets",
      title: "Face ID, biometric Keychain and secrets",
      goal: "Use `LocalAuthentication` correctly, protect a Keychain item with biometrics via `SecAccessControlCreateWithFlags`, and know which secrets can never ship in the binary.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "LocalAuthentication",
          body: [
            "`LAContext` is the entry point to Face ID, Touch ID and Optic ID. First `canEvaluatePolicy(_:error:)` to know whether biometrics are set up; then `evaluatePolicy(_:localizedReason:)`, which in modern Swift is `async throws` and returns `true` if the user passed.",
            "`.deviceOwnerAuthenticationWithBiometrics` requires biometrics. `.deviceOwnerAuthentication` allows falling back to the passcode. `biometryType` tells you which one is available so you can show the right icon.",
            "If you use Face ID you need `NSFaceIDUsageDescription` in `Info.plist` with a string explaining why. Without that key Face ID authentication doesn't work.",
          ],
          code: swift`import LocalAuthentication

func authenticate() async -> Bool {
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
        return false   // no biometrics: offer password
    }
    do {
        return try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Unlock your account"
        )
    } catch let error as LAError where error.code == .userCancel {
        return false
    } catch {
        return false
    }
}

// Info.plist
// <key>NSFaceIDUsageDescription</key>
// <string>We use Face ID to unlock your account without a password.</string>`,
        },
        {
          kind: "predict",
          prompt: "This is how \"unlock with Face ID\" is implemented. An attacker with the phone on a lab bench uses Frida to make `evaluatePolicy` return `true`. What do they get?",
          code: swift`func unlock() async {
    let ok = (try? await LAContext().evaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        localizedReason: "Unlock your account"
    )) ?? false
    if ok {
        let token = try? tokenStore.read(account: "refresh-token")  // AfterFirstUnlock
        session.start(with: token)
    }
}`,
          options: [
            "Nothing: Face ID runs in the Secure Enclave and can't be bypassed",
            "Only the unlocked UI, with no API access",
            "The full session: the token doesn't depend on biometrics, only an `if` guards it",
            "An error, because `evaluatePolicy` signs its response",
          ],
          answer: 2,
          explanation:
            "The biometric match does happen in the Secure Enclave, but what your app gets back is an in-memory `Bool`, and an `if` can be patched. The token sits in an `AfterFirstUnlock` item readable without biometrics. The fix is to protect **the secret itself** with biometrics in the Keychain: no match, no secret.",
        },
        {
          kind: "explain",
          title: "Biometric-protected Keychain",
          body: [
            "`SecAccessControlCreateWithFlags` creates an access control stored with the item via `kSecAttrAccessControl`. With `.biometryCurrentSet`, the Keychain only hands out the secret after a biometric match **against the fingers/faces enrolled today**.",
            "Alternatives: `.biometryAny` (survives new enrollments), `.userPresence` (biometrics or passcode). `.biometryCurrentSet` is the strictest: if someone who knows your passcode enrolls their face, the item is invalidated.",
            "When reading, pass an `LAContext` in `kSecUseAuthenticationContext`. `SecItemCopyMatching` shows the prompt and **blocks** until the user responds: call it off the main thread. If the user cancels, the status is `errSecUserCanceled`.",
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
          prompt: "The item must be invalidated if the set of enrolled faces/fingerprints changes. Fill in the flag.",
          code: swift`let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
    ____,
    nil
)`,
          accept: ["^\\.biometryCurrentSet$", "^biometryCurrentSet$", "^SecAccessControlCreateFlags\\.biometryCurrentSet$"],
          hint: "There's `.biometryAny` and a stricter one.",
          explanation:
            "`.biometryCurrentSet` ties the item to the current biometric set. With `.biometryAny`, someone who knows the passcode could enroll their face and read the secret.",
        },
        {
          kind: "predict",
          prompt: "The refresh token was stored with `.biometryCurrentSet`. The user adds an alternate appearance in Face ID and reopens the app. What happens when reading the item?",
          code: swift`let token = try vault.readRefreshToken(reason: "Unlock your account")`,
          options: [
            "It reads normally with either face",
            "It reads, but only with the original face",
            "iOS migrates the item to the new set after asking for the passcode",
            "The item becomes inaccessible: the app has to ask for a password login and store a new token",
          ],
          answer: 3,
          explanation:
            "Changing the biometric set invalidates items created with `.biometryCurrentSet`. Your code must treat that as \"no biometric session\": fall back to password, get a new token from the server and store a new item. It's the intended behavior, not a bug.",
        },
        {
          kind: "explain",
          title: "Secrets: out of git, and still extractable",
          body: [
            "In CI/CD you saw how to keep keys out of git with ignored `.xcconfig` files and pipeline secrets. That stops leaks in the repo but does **not** protect them in the binary: everything you compile ends up in the `.ipa`, and `strings` or a disassembler finds it in minutes. Obfuscation only adds minutes.",
            "Classify: **publishable** keys (Stripe publishable key, analytics ids, API keys restricted by bundle id) can ship in the app. **Secret** keys (Stripe secret key, credentials for a provider that bills per request, signing keys) never: they live in your backend, and the app calls your backend.",
            "If a secret key already shipped in a released version, treat it as compromised: rotate it at the provider; removing it from the next build isn't enough.",
          ],
          code: `# Config/Secrets.xcconfig (in .gitignore, generated by CI)
STRIPE_PUBLISHABLE_KEY = pk_live_51Hx...
MAPS_API_KEY = AIzaSy...   # restricted by bundle id in the console

# What anyone can do with your .ipa
$ unzip -q AcmeBank.ipa
$ strings Payload/AcmeBank.app/AcmeBank | grep -E "pk_live|sk_live|AIza"
pk_live_51Hx...
AIzaSy...`,
        },
        {
          kind: "predict",
          prompt: "To \"keep it hidden\", the team put the Stripe **secret** key in a git-ignored `.xcconfig` that CI injects into `Info.plist`, and the app creates charges by calling Stripe directly. What do you say?",
          code: `// Info.plist
<key>StripeSecretKey</key>
<string>$(STRIPE_SECRET_KEY)</string>`,
          options: [
            "Insecure: the key sits in the `.ipa`'s `Info.plist`; charges must be created by the backend and the app only uses the publishable key",
            "Secure: it's not in git, so there's no way to get it",
            "Secure if it's also XOR-obfuscated before compiling",
            "Secure because the App Store encrypts binaries with FairPlay",
          ],
          answer: 0,
          explanation:
            "`Info.plist` is a file inside the bundle, readable by anyone who downloads the `.ipa`. FairPlay encryption is easy to strip on a jailbroken device, and XOR is reversible with the key sitting right next to it. A secret key can create charges and refunds: it lives only on the server.",
        },
        {
          kind: "write",
          prompt:
            "Write `struct BiometricVault` with `saveRefreshToken(_ token: String) throws` (item with `SecAccessControlCreateWithFlags` + `.biometryCurrentSet`, deleting the previous one first) and `readRefreshToken(reason: String) throws -> String`, which uses an `LAContext` with `localizedReason` in `kSecUseAuthenticationContext`. Throw `KeychainError.unexpectedStatus` for any status other than `errSecSuccess`.",
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
            { pattern: "SecAccessControlCreateWithFlags\\(", label: "Creates the control with `SecAccessControlCreateWithFlags`" },
            { pattern: "\\.biometryCurrentSet", label: "Uses `.biometryCurrentSet`" },
            { pattern: "kSecAttrAccessControl", label: "Stores the item with `kSecAttrAccessControl`" },
            { pattern: "LAContext\\(\\)", label: "Creates an `LAContext`" },
            { pattern: "kSecUseAuthenticationContext", label: "Passes the context in `kSecUseAuthenticationContext`" },
            { pattern: "SecItemCopyMatching\\(", label: "Reads with `SecItemCopyMatching`" },
          ],
          warnings: [
            { pattern: "UserDefaults", label: "Tokens never go in `UserDefaults`" },
            { pattern: "evaluatePolicy\\(", label: "A `Bool` from `evaluatePolicy` protects nothing: let the Keychain ask for biometrics" },
            { pattern: "kSecAttrAccessibleAlways", label: "`kSecAttrAccessibleAlways` is deprecated and insecure" },
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

    // Blocks while Face ID is shown: call it off the main thread.
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
          hint: "With `kSecAttrAccessControl` the accessibility goes inside the control (the second argument of `SecAccessControlCreateWithFlags`), not in `kSecAttrAccessible`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "integrity-threats",
      title: "App Attest, deep links and threat modeling",
      goal: "Know what App Attest and DeviceCheck prove, how much jailbreak detection is worth, validate deep link parameters, and use MASVS and STRIDE to review a feature.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "App Attest and DeviceCheck",
          body: [
            "**App Attest** (`DCAppAttestService`) proves to **your server** that a request comes from a legitimate, unmodified instance of your app on a genuine Apple device. The app generates a key in the Secure Enclave, Apple certifies it (attestation), and then every sensitive request carries an assertion signed with that key.",
            "What it does **not** prove: that the user is honest, or that the device isn't jailbroken. And it protects nothing if the server doesn't verify: the attestation is validated in the backend against Apple's CA, and the server stores the public key and a counter to reject replays.",
            "**DeviceCheck** (`DCDevice`) is simpler: a token your server uses to read/write 2 bits per device on Apple's servers. Good for \"this device already used the free trial\", even after a reinstall.",
          ],
          code: swift`import CryptoKit
import DeviceCheck

let service = DCAppAttestService.shared
guard service.isSupported else { return }     // fallback: more friction, not a hard block

// Once per install
let keyId = try await service.generateKey()
let challenge = try await api.fetchAttestChallenge()      // server-issued one-time nonce
let attestation = try await service.attestKey(
    keyId, clientDataHash: Data(SHA256.hash(data: challenge))
)
try await api.registerAttestation(attestation, keyId: keyId)

// On every sensitive request (transfers, coupon redemption)
let assertion = try await service.generateAssertion(
    keyId, clientDataHash: Data(SHA256.hash(data: requestBody))
)

// DeviceCheck
let deviceToken = try await DCDevice.current.generateToken()`,
        },
        {
          kind: "predict",
          prompt: "You implemented App Attest in the app. Who has to verify the attestation for it to be worth anything?",
          code: swift`let attestation = try await DCAppAttestService.shared.attestKey(keyId, clientDataHash: hash)
try await api.registerAttestation(attestation, keyId: keyId)`,
          options: [
            "The app itself, before sending it, with `SecTrustEvaluateWithError`",
            "Your server: it validates the chain against Apple's App Attest CA, the challenge and the app id, and stores the public key",
            "Nobody: calling `attestKey` is enough for iOS to block modified apps",
            "App Store Connect, which rejects invalid requests",
          ],
          answer: 1,
          explanation:
            "If the app verified itself, a modified app would simply skip that check. The value comes from the **server** validating the attestation (and then each assertion and its counter) and deciding: reject, ask for an extra step, or flag the account.",
        },
        {
          kind: "explain",
          title: "Jailbreak and deep links: don't trust input",
          body: [
            "Jailbreak detection (looking for `/Applications/Cydia.app`, trying to write outside the sandbox) is a **signal**, not a defense: Frida or a tweak patches the check in minutes. Use it to raise a risk score and tell the server, never as the only barrier.",
            "A deep link or universal link is **attacker input**: any website, QR code or app can open it. Parse it with `URLComponents`, check scheme and host against an allowlist, convert every parameter to the expected type and reject everything else.",
            "Never perform an action with side effects (transfer, change email, delete account) straight from a link: navigate to a screen that shows the details and asks for confirmation, and have the server authorize again.",
          ],
          code: swift`// A signal, not a defense
func looksJailbroken() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    let paths = ["/Applications/Cydia.app", "/bin/bash", "/usr/sbin/sshd", "/etc/apt"]
    if paths.contains(where: { FileManager.default.fileExists(atPath: $0) }) { return true }
    do {
        try "x".write(toFile: "/private/jb_test.txt", atomically: true, encoding: .utf8)
        return true   // a sandboxed app shouldn't be able to write there
    } catch {
        return false
    }
    #endif
}

// Deep link: parse and validate
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
          prompt: "Fill in the universal link's domain check.",
          code: swift`guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
      components.____ == "acmebank.com" else { return nil }`,
          accept: ["^host$"],
          hint: "The part of the URL between `://` and the first `/`.",
          explanation:
            "Comparing `components.host` with exact equality (or against a `Set`) blocks tricks like `acmebank.com.evil.io`, which would pass a `contains(\"acmebank.com\")` on the string.",
        },
        {
          kind: "predict",
          prompt: "What does it print?",
          code: swift`let url = URL(string: "shop://open?product=42&product=99&ref=%3Cscript%3E")!
let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
let product = items.first { $0.name == "product" }?.value
let ref = items.first { $0.name == "ref" }?.value
print(product ?? "nil", ref ?? "nil")`,
          options: ["99 %3Cscript%3E", "42 %3Cscript%3E", "42 <script>", "nil nil"],
          answer: 2,
          explanation:
            "`first` takes the first `product` (42), even though the link has two: decide explicitly what to do with repeated parameters. And `queryItems` returns values **already decoded**: `ref` is `<script>`. That value comes from the attacker; put it in a `WKWebView` or a log unescaped and you have a problem.",
        },
        {
          kind: "explain",
          title: "MASVS and threat modeling",
          body: [
            "**OWASP MASVS** is the security standard for mobile apps and **MASTG** is the testing guide that goes with it. Its groups work as a PR or release checklist: `MASVS-STORAGE`, `MASVS-CRYPTO`, `MASVS-AUTH`, `MASVS-NETWORK`, `MASVS-PLATFORM`, `MASVS-CODE`, `MASVS-RESILIENCE` and `MASVS-PRIVACY`.",
            "Before building a sensitive feature, do a short threat model with **STRIDE**: Spoofing, Tampering, Repudiation (denying having done something), Information disclosure, Denial of service, Elevation of privilege. For each letter: what can go wrong and what mitigates it?",
            "Privacy ties back to what you saw in the App Store course: the privacy manifest and labels declare what you collect; here you make sure what you collect is protected and that you only ask for what you need.",
          ],
          code: `# threat-model/login.yml
feature: "login + refresh with Face ID"
assets: [password, refresh_token, access_token]
threats:
  - stride: S
    risk: "credential stuffing against /login"
    mitigation: "rate limiting and MFA on the server"
  - stride: T
    risk: "modified app skips the Face ID check"
    mitigation: "refresh token with .biometryCurrentSet; App Attest on /refresh"
  - stride: R
    risk: "'I never made that transfer'"
    mitigation: "server-side audit log with App Attest keyId and timestamp"
  - stride: I
    risk: "token in logs, backups or proxy captures"
    mitigation: "Keychain ThisDeviceOnly, private Logger, pinning"
  - stride: D
    risk: "expired pin locks every user out"
    mitigation: "backup pin and remote kill switch"
  - stride: E
    risk: "'admin' role read from the JWT on the client only"
    mitigation: "authorization always on the server"
masvs: [MASVS-STORAGE, MASVS-NETWORK, MASVS-AUTH, MASVS-RESILIENCE]`,
        },
        {
          kind: "predict",
          prompt: "This risk shows up in the transfers threat model. Which STRIDE letter is it?",
          code: `risk: "A user claims they never made a transfer and
       the server has no record of which device or
       session originated it."`,
          options: ["Spoofing", "Tampering", "Elevation of privilege", "Repudiation"],
          answer: 3,
          explanation:
            "Repudiation is being able to deny an action because there's no evidence. You mitigate it with server-side auditing: session, device (e.g. the App Attest `keyId`), timestamp and, if needed, the signed request.",
        },
        {
          kind: "write",
          prompt:
            "Write `struct DeepLinkRouter` with `func route(_ url: URL) -> Route?`. Accept only `https` and hosts in an `allowedHosts` `Set` (`acmebank.com`, `www.acmebank.com`). `/product?id=N` returns `.product(id:)` only if `N` is a positive `Int`; `/reset?token=T` returns `.resetPassword(token:)` only if `T` is 32 hex characters. Anything else: `nil`.",
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
            { pattern: "URLComponents\\(", label: "Parses with `URLComponents`" },
            { pattern: "\\.scheme\\s*==\\s*\"https\"", label: "Requires `https`" },
            { pattern: "allowedHosts\\.contains\\(", label: "Checks the host against `allowedHosts`" },
            { pattern: "queryItems", label: "Reads parameters via `queryItems`" },
            { pattern: "Int\\(", label: "Converts the id to `Int`" },
            { pattern: "isHexDigit|count\\s*==\\s*32", label: "Validates the token format" },
          ],
          warnings: [
            { pattern: "absoluteString\\.contains\\(", label: "A `contains` check on the string is bypassed by `acmebank.com.evil.io`" },
            { pattern: "loadHTMLString|evaluateJavaScript", label: "Don't feed link parameters into a web view" },
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
          hint: "`switch components.path` with one `case` per route and `default: return nil`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: secure login for a banking app",
      goal: "Combine Keychain storage, biometric unlock, a pinned session and a threat model in a real login feature.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "Acme Bank is launching its app. Login returns an `accessToken` (15 minutes, memory only) and a `refreshToken` (90 days). Product wants: \"after the first login, sign in with Face ID\". Security wants pinning against `api.acmebank.com`, and a reinstall must not bring old sessions back.",
            "You already have the pieces: `TokenStore` (lesson 1), `PinnedSessionDelegate` (lesson 2), `BiometricVault` (lesson 4). Now you wire them up: wiping the Keychain on a fresh install, biometric unlock without blocking the main thread, the pinned `URLSession`, and a threat model review.",
            "Remember the ground rule: everything you do on the client raises the cost of an attack, but the decisions (is this refresh token still valid? is this transfer allowed?) are made by the server.",
          ],
          code: swift`// Feature architecture
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
            "Keychain items can survive deleting the app, but `UserDefaults` doesn't. Write `struct SessionCleaner` with `func clearKeychainOnFreshInstall()`: if `UserDefaults.standard.bool(forKey: \"hasLaunchedBefore\")` is `false`, delete every `kSecClassGenericPassword` item for service `com.acme.bank.auth` and set the flag to `true`.",
          starter: swift`import Foundation
import Security

struct SessionCleaner {
    let service = "com.acme.bank.auth"

    func clearKeychainOnFreshInstall() {
        // TODO
    }
}`,
          checks: [
            { pattern: "UserDefaults\\.standard\\.bool\\(forKey:", label: "Reads the flag with `UserDefaults.standard.bool(forKey:)`" },
            { pattern: "SecItemDelete\\(", label: "Deletes with `SecItemDelete`" },
            { pattern: "kSecAttrService", label: "Filters by `kSecAttrService`" },
            { pattern: "UserDefaults\\.standard\\.set\\(\\s*true", label: "Sets the flag to `true`" },
          ],
          warnings: [
            { pattern: "UserDefaults\\.standard\\.set\\([^)]*[Tt]oken", label: "The flag goes in `UserDefaults`; the token never does" },
            { pattern: "kSecAttrAccount", label: "Without `kSecAttrAccount` you delete every item in the service, which is what you want" },
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
          hint: "A query with only class + service matches every account in that service.",
        },
        {
          kind: "write",
          prompt:
            "Write `UnlockViewModel` (`@MainActor @Observable`; `ObservableObject` would also do on iOS 16) with `state` (`.locked`, `.unlocked`, `.needsPassword`) and `func unlock() async`. Read the refresh token with `vault.readRefreshToken(reason:)` inside a `Task.detached` (it blocks while Face ID is shown), call `api.refresh(using:)` and move to `.unlocked`. If the status is `errSecUserCanceled` stay `.locked`; on any other error, `.needsPassword`.",
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
            { pattern: "@Observable", label: "Marks the class `@Observable`" },
            { pattern: "Task\\.detached", label: "Reads the Keychain off the main thread with `Task.detached`" },
            { pattern: "readRefreshToken\\(reason:", label: "Uses `vault.readRefreshToken(reason:)`" },
            { pattern: "refresh\\(using:", label: "Validates with the server via `api.refresh(using:)`" },
            { pattern: "errSecUserCanceled", label: "Handles cancellation with `errSecUserCanceled`" },
            { pattern: "\\.needsPassword", label: "Falls back to password" },
          ],
          warnings: [
            { pattern: "evaluatePolicy\\(", label: "A `Bool` from `evaluatePolicy` unlocks nothing: the secret comes from the Keychain" },
            { pattern: "UserDefaults", label: "No session data in `UserDefaults`" },
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
                try vault.readRefreshToken(reason: "Unlock your account")
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
          hint: "`catch KeychainError.unexpectedStatus(errSecUserCanceled)` before the generic `catch`.",
        },
        {
          kind: "write",
          prompt:
            "Write `func makeBankSession() -> URLSession`: `.ephemeral` configuration (no disk cache or cookies), minimum TLS 1.2, and a `PinnedSessionDelegate` with **two** pins, `Pins.current` and `Pins.backup`.",
          starter: swift`import Foundation

enum Pins {
    static let current = "CURRENT_KEY_HASH_BASE64="
    static let backup = "BACKUP_KEY_HASH_BASE64="
}

func makeBankSession() -> URLSession {
    URLSession.shared
}`,
          checks: [
            { pattern: "URLSessionConfiguration\\.ephemeral", label: "Uses `URLSessionConfiguration.ephemeral`" },
            { pattern: "tlsMinimumSupportedProtocolVersion", label: "Sets `tlsMinimumSupportedProtocolVersion`" },
            { pattern: "PinnedSessionDelegate\\(\\s*pinnedKeyHashes:\\s*\\[[^\\]]*,[^\\]]*\\]", label: "The delegate gets at least two pins" },
            { pattern: "URLSession\\(\\s*configuration:", label: "Creates the session with `URLSession(configuration:delegate:delegateQueue:)`" },
          ],
          warnings: [
            { pattern: "URLSession\\.shared", label: "`URLSession.shared` doesn't have your delegate: no pinning" },
            { pattern: "print\\(", label: "Don't log network configuration or pins" },
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
          hint: "`URLSession` keeps a strong reference to its delegate until you invalidate it: no need to store it separately.",
        },
        {
          kind: "predict",
          prompt: "While reviewing the threat model, product suggests: \"If `looksJailbroken()` is `false` and Face ID passed, let's skip the daily transfer limit on the server\". What's your answer?",
          code: `threat: "Transfers above the daily limit"
current_mitigation: "limit enforced on the server per account"
proposal: "client sends isTrusted=true and the server skips the limit"`,
          options: [
            "Accept it: Face ID runs in the Secure Enclave, so `isTrusted` can be trusted",
            "Accept it only if the `isTrusted` field is also encrypted with AES-GCM",
            "Reject it: `isTrusted` is client-controlled and can be forged; the limit stays on the server, and if needed it uses signals the server can verify, like App Attest",
            "Accept it, but also move the limit to the client so it responds faster",
          ],
          answer: 2,
          explanation:
            "Any flag the client sends (`isTrusted`, `jailbroken=false`, `faceIdPassed`) can be forged with a proxy or by patching the app; encrypting it with a key that lives in the app changes nothing. The server decides based on what it can verify: App Attest assertions, signatures from a registered Secure Enclave key, account history.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-userdefaults",
      front: "Why never store a token in `UserDefaults`?",
      back: "It's a plain-text `.plist` inside the container: unencrypted backups, jailbroken devices and forensic tools can read it. Secrets go in the Keychain.",
    },
    {
      id: "fc-keychain-primary-key",
      front: "What identifies a `kSecClassGenericPassword` item?",
      back: "The `kSecAttrService` + `kSecAttrAccount` pair. Adding another item with the same pair returns `errSecDuplicateItem`.",
    },
    {
      id: "fc-duplicate",
      front: "Correct \"save\" pattern for the Keychain",
      back: "`SecItemAdd`; if it returns `errSecDuplicateItem`, `SecItemUpdate` with the new `kSecValueData`. `SecItemAdd` never overwrites.",
    },
    {
      id: "fc-this-device-only",
      front: "What does the `ThisDeviceOnly` suffix change in `kSecAttrAccessible`?",
      back: "The item doesn't migrate to another device when a backup is restored. That's what you want for session tokens.",
      code: "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly",
    },
    {
      id: "fc-data-protection",
      front: "How do you protect a file with sensitive data?",
      back: "Data Protection: write it with `.completeFileProtection` (or `FileProtectionType.complete`) and it stays encrypted while the device is locked.",
      code: "try data.write(to: url, options: .completeFileProtection)",
    },
    {
      id: "fc-ats",
      front: "What does ATS require by default, and how do you make a proper exception?",
      back: "HTTPS with TLS 1.2+, a valid certificate and forward secrecy. Narrow per-domain exceptions with `NSExceptionDomains`; never `NSAllowsArbitraryLoads` in Release.",
    },
    {
      id: "fc-pinning-order",
      front: "Order of checks in a pinning delegate",
      back: "1) `SecTrustEvaluateWithError` (chain, dates, host). 2) Compare public-key hashes against the pins. On failure: `.cancelAuthenticationChallenge`.",
    },
    {
      id: "fc-backup-pin",
      front: "Why always ship a backup pin?",
      back: "Pins are compiled into the binary. If the server rotates to an unpinned key, every installed version loses network access until it's updated.",
    },
    {
      id: "fc-logger-privacy",
      front: "How do you log an email without exposing it?",
      back: "With `Logger` and `privacy: .private` (or `.private(mask: .hash)` to correlate). Never `Authorization` headers or login bodies.",
      code: `logger.info("Login for \\(email, privacy: .private)")`,
    },
    {
      id: "fc-hash-vs-encrypt",
      front: "Hash vs HMAC vs AES-GCM",
      back: "Hash: keyless, one-way fingerprint. HMAC: keyed hash, proves authenticity. AES-GCM: encrypts and authenticates; `open` fails if a byte was touched.",
    },
    {
      id: "fc-secure-enclave",
      front: "What do you store from a Secure Enclave key?",
      back: "Its `dataRepresentation`: an encrypted blob only that Secure Enclave can use. The private key never leaves the chip.",
      code: "let key = try SecureEnclave.P256.Signing.PrivateKey()\nstore(key.dataRepresentation)",
    },
    {
      id: "fc-biometric-bool",
      front: "Why isn't a `Bool` from `evaluatePolicy` security?",
      back: "Frida can patch it. The secret must live in a Keychain item created with `SecAccessControlCreateWithFlags(.biometryCurrentSet)`: no match, no secret.",
    },
    {
      id: "fc-current-set",
      front: "`.biometryCurrentSet` vs `.biometryAny`",
      back: "`.biometryCurrentSet` invalidates the item if enrolled faces/fingerprints change; `.biometryAny` doesn't. The former stops someone with your passcode from enrolling their face and reading the secret.",
    },
    {
      id: "fc-binary-secrets",
      front: "An API key is kept out of git and injected by CI. Is it safe?",
      back: "No: it's in the binary and `strings` extracts it. Secret keys live in the backend; the app only ships publishable or restricted keys.",
    },
    {
      id: "fc-app-attest",
      front: "What does App Attest prove, and to whom?",
      back: "To your server: that the request comes from your unmodified app on a genuine Apple device. Only useful if the server validates attestation and assertions. It doesn't prove the user is honest.",
    },
  ],

  exam: [
    {
      id: "ex-01",
      question: "A user reports that after changing their password the app logs them out every time they open it. The `save` code only calls `SecItemAdd` and ignores the status. What's the most likely cause?",
      options: [
        "The Keychain deletes items when the app is closed",
        "`kSecAttrAccessibleWhenUnlocked` expires items after 24 hours",
        "`SecItemAdd` returns `errSecDuplicateItem` and the old (already revoked) token stays stored",
        "`SecItemCopyMatching` always returns the app's first stored value",
      ],
      answer: 2,
      explanation: "`SecItemAdd` doesn't overwrite an existing item. Since the status is ignored, the new token is never stored and the app keeps using the revoked one. Handle `errSecDuplicateItem` with `SecItemUpdate`.",
    },
    {
      id: "ex-02",
      question: "A background task refreshes the token at night with the phone locked and fails to read the Keychain. The item was saved without `kSecAttrAccessible`. What do you change?",
      options: [
        "Use `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`",
        "Move the token to `UserDefaults` just for the background task",
        "Use `.biometryAny` so it doesn't require unlocking",
        "Store the token in a file with `.completeFileProtection`",
      ],
      answer: 0,
      explanation: "The default is `WhenUnlocked`: it can't be read while the device is locked. `AfterFirstUnlock` allows reading after the first unlock since reboot; `ThisDeviceOnly` keeps it out of backups. A `.complete` file wouldn't be readable while locked either.",
    },
    {
      id: "ex-03",
      question: "QA runs Charles Proxy with its root certificate installed on the iPhone and sees all of the banking app's traffic in the clear. What would prevent that?",
      options: [
        "Turning on ATS, which is currently off",
        "Encrypting the body with AES-GCM using a hardcoded key",
        "Using `URLSession.shared` instead of a custom session",
        "Public-key pinning, which rejects certificates even when signed by a CA the system trusts",
      ],
      answer: 3,
      explanation: "ATS trusts any CA the user installed, so the proxy gets through. Pinning additionally requires a specific public key. A hardcoded key can be extracted from the binary.",
    },
    {
      id: "ex-04",
      question: "What do you need to rotate the API certificate without cutting any user off?",
      options: [
        "Disable pinning a week before",
        "Installed versions must already pin the backup key ops is switching to, and the next release adds a new backup",
        "Pin the leaf certificate instead of the public key",
        "Force everyone to update on the day of the rotation",
      ],
      answer: 1,
      explanation: "Rotation works if the new key was already pinned as a backup in the installed binaries. Pinning the leaf certificate makes it worse, because it changes on every renewal.",
    },
    {
      id: "ex-05",
      question: "What does this code print if someone changed one byte of `stored`?",
      code: "do {\n    let box = try AES.GCM.SealedBox(combined: stored)\n    _ = try AES.GCM.open(box, using: key)\n    print(\"ok\")\n} catch {\n    print(\"fail\")\n}",
      options: ["ok", "fail", "Nothing: it crashes", "ok, but with corrupted data"],
      answer: 1,
      explanation: "AES-GCM checks the authentication tag in `open`; if it doesn't match it throws `CryptoKitError.authenticationFailure` and never returns tampered data.",
    },
    {
      id: "ex-06",
      question: "A dev suggests storing users' passwords as `SHA256` in the local database to \"avoid storing them in plain text\". What do you answer?",
      options: [
        "Fine, SHA256 is irreversible so it's secure",
        "Better use `Insecure.MD5`, it's faster",
        "Fine, but with `HMAC` using a key from the binary",
        "Don't store passwords on the client: authenticate against the server, which hashes them with a slow, salted algorithm; the device keeps a token in the Keychain",
      ],
      answer: 3,
      explanation: "Unsalted SHA256 falls to precomputed tables and is fast to brute-force. The client doesn't need the password after login: it stores a revocable token in the Keychain.",
    },
    {
      id: "ex-07",
      question: "You need the server to verify that every transfer was signed by a key that can't be copied to another device. What do you use?",
      options: [
        "`SecureEnclave.P256.Signing.PrivateKey`, registering its public key with the server",
        "`Curve25519.Signing.PrivateKey`, storing its `rawRepresentation` in `UserDefaults`",
        "`HMAC<SHA256>` with a shared key compiled into the app",
        "`SHA256.hash` of the body",
      ],
      answer: 0,
      explanation: "A Secure Enclave key never leaves the chip: signing happens there and the server verifies with the public key. A software key or a shared key in the binary can be extracted; a hash doesn't prove who produced it.",
    },
    {
      id: "ex-08",
      question: "The app shows account data if `evaluatePolicy` returns `true`, and the access token is read from an `AfterFirstUnlock` item. What's the problem?",
      options: [
        "`NSCameraUsageDescription` is missing",
        "`evaluatePolicy` isn't `async`",
        "The protection is an in-memory `Bool`; the token can be read without biometrics. It should be in a `.biometryCurrentSet` item",
        "`AfterFirstUnlock` deletes the token when the device locks",
      ],
      answer: 2,
      explanation: "With `evaluatePolicy` patched (or by reading the Keychain directly on a compromised device) the token is exposed. With biometric access control, the Keychain only releases the secret after a real match.",
    },
    {
      id: "ex-09",
      question: "This universal link arrives: `https://acmebank.com.evil.io/transfer?to=999&amount=5000`. The code checks `url.absoluteString.contains(\"acmebank.com\")` and executes the transfer. What do you fix?",
      options: [
        "Add a `print` of the link for auditing",
        "Check with `hasPrefix(\"https://acmebank\")`",
        "Block the link only if `looksJailbroken()` is `true`",
        "Compare `URLComponents.host` against an exact allowlist and take the user to a confirmation screen; the server authorizes the transfer",
      ],
      answer: 3,
      explanation: "`contains` and `hasPrefix` on the string are bypassed by domains like `acmebank.com.evil.io`. The host is compared exactly, and an action with side effects is never executed straight from a link.",
    },
    {
      id: "ex-10",
      question: "What does App Attest guarantee when the server correctly validates attestation and assertions?",
      options: [
        "That the user isn't a fraudster",
        "That the request comes from a legitimate, unmodified instance of your app on a genuine Apple device",
        "That the device isn't jailbroken",
        "That the traffic didn't go through a proxy",
      ],
      answer: 1,
      explanation: "App Attest vouches for the app and the device, not the user. A malicious user with your original app on a real iPhone passes attestation; that's what rate limiting and server-side business rules are for.",
    },
    {
      id: "ex-11",
      question: "The login threat model lists: \"an attacker with a modified app skips the Face ID check\". Which STRIDE category and mitigation fit?",
      options: [
        "Tampering; secret in the Keychain with `.biometryCurrentSet` and App Attest on the refresh endpoint",
        "Repudiation; add client-side logs",
        "Denial of service; rate limiting",
        "Information disclosure; obfuscate the binary",
      ],
      answer: 0,
      explanation: "Modifying the app to change its behavior is Tampering. The mitigation is making the secret depend on biometrics at the Keychain level and letting the server verify app integrity with App Attest.",
    },
    {
      id: "ex-12",
      question: "A maps SDK needs an API key that's billed per request and can't be restricted by bundle id. What do you do?",
      options: [
        "Put it in a git-ignored `.xcconfig`, that's enough",
        "Obfuscate it by splitting it into three strings",
        "Proxy the calls through your backend, which holds the key and applies authentication and rate limiting",
        "Store it in the Keychain on first launch",
      ],
      answer: 2,
      explanation: "Everything in the binary can be extracted, and to store it in the Keychain it first has to be in the app. If the key costs money and can't be restricted, it lives on the server and the app calls your backend.",
    },
  ],
};

export default content;
