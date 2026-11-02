import type { CourseContent } from "../types";

// Code uses String.raw so Swift's `\(...)` keeps its backslashes.
// GitHub Actions YAML uses regular template literals with `\${{` to avoid interpolation.
const raw = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "configurations-schemes",
      title: "Configurations and schemes",
      goal: "Split Dev, Staging and Prod with build configurations and one scheme per environment, use `#if DEBUG`/`#if STAGING`, and know when launch arguments and environment variables help (and when they don't).",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "A configuration is not a scheme",
          body: [
            "A **build configuration** (Debug, Release) is a set of build settings: optimization, debug symbols, bundle id, backend URL. Xcode ships two; for Staging you add a third under Project › Info › Configurations by duplicating Release (so it's optimized, like the build that ships to the store).",
            "A **scheme** says *what* gets built and *with which configuration* for each action: Run, Test, Profile, Analyze and Archive. The usual setup is one scheme per environment: `Acme Dev`, `Acme Staging`, `Acme Prod`.",
            "Schemes must be marked **Shared** (they live in `xcshareddata/xcschemes`) to make it into the repo. Otherwise CI runs `xcodebuild -scheme \"Acme Staging\"` and gets told the scheme doesn't exist.",
          ],
          code: raw`# List the project's targets, configurations and schemes
xcodebuild -list -project Acme.xcodeproj`,
          output: raw`Information about project "Acme":
    Targets:
        Acme
        AcmeTests

    Build Configurations:
        Debug
        Staging
        Release

    If no build configuration is specified and -scheme is not passed then "Release" is used.

    Schemes:
        Acme Dev
        Acme Prod
        Acme Staging`,
        },
        {
          kind: "predict",
          prompt: "QA reports that the Staging build you archived is hitting the production backend. This is the `Acme Staging` scheme. What happened?",
          code: raw`<!-- Acme Staging.xcscheme (trimmed) -->
<LaunchAction
   buildConfiguration = "Staging">
</LaunchAction>
<ArchiveAction
   buildConfiguration = "Release"
   revealArchiveInOrganizer = "YES">
</ArchiveAction>`,
          options: [
            "The scheme isn't marked as Shared",
            "The Staging `.xcconfig` has a syntax error",
            "Archive uses the Release configuration, which points to prod: each scheme action picks its own configuration",
            "Xcode always archives in Release and you can't change it",
          ],
          answer: 2,
          explanation: "Run (`LaunchAction`) uses Staging, but Archive (`ArchiveAction`) was left on Release, the default when you duplicate a scheme. The archive was built with Release settings, which are prod's. Fix it in Edit Scheme › Archive › Build Configuration: Staging.",
        },
        {
          kind: "explain",
          title: "Compilation conditions: `#if DEBUG` and `#if STAGING`",
          body: [
            "`SWIFT_ACTIVE_COMPILATION_CONDITIONS` is the list of flags the Swift compiler sees. Debug comes with `DEBUG` out of the box; in Staging you add `STAGING`. Then you can write `#if STAGING` in code.",
            "`#if` is resolved **at compile time**: the code in the other branches doesn't exist in the binary. That makes it perfect for debug menus or verbose logging that must never reach production.",
            "Watch the order, and watch which configuration you duplicated: if Staging was copied from Debug, it also has `DEBUG` active.",
          ],
          code: raw`// Build Settings › Swift Compiler - Custom Flags
//   Debug:   SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG
//   Staging: SWIFT_ACTIVE_COMPILATION_CONDITIONS = STAGING
//   Release: (empty)

enum AppEnvironment {
    case dev, staging, prod

    static var current: AppEnvironment {
        #if DEBUG
        return .dev
        #elseif STAGING
        return .staging
        #else
        return .prod
        #endif
    }
}

// Built with the Staging configuration
print(AppEnvironment.current)`,
          output: "staging",
        },
        {
          kind: "predict",
          prompt: "Someone created the Staging configuration by duplicating **Debug** and then added the flag. What does a Staging build print, using the same `AppEnvironment` as above?",
          code: raw`// Staging: SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG STAGING

print(AppEnvironment.current)`,
          options: ["dev", "staging", "prod", "Compile error: two conditions are active"],
          answer: 0,
          explanation: "Both conditions are active and `#if` checks branches in order: `#if DEBUG` is true first, so `.dev` wins. Having several active conditions is perfectly valid. The fix is to keep `DEBUG` out of Staging (duplicate it from Release) or check `STAGING` before `DEBUG`.",
        },
        {
          kind: "fill",
          prompt: "The secret debug menu must not exist in Staging or Prod builds. Fill in the condition.",
          code: raw`#if ____
let showDebugMenu = true
#else
let showDebugMenu = false
#endif`,
          accept: ["^DEBUG$"],
          explanation: "`DEBUG` is only active in the Debug configuration, so in Staging and Release the compiler takes the `#else` branch and the menu code never even makes it into the binary.",
          hint: "It's the flag Xcode already turns on in the Debug configuration.",
          placeholder: "condition",
        },
        {
          kind: "explain",
          title: "Launch arguments and environment variables",
          body: [
            "In Edit Scheme › Run › Arguments you add **launch arguments** (`-UITests`) and **environment variables** (`API_MOCK = 1`). In code you read them with `ProcessInfo.processInfo.arguments` and `.environment`. From XCUITest you pass them with `app.launchArguments` and `app.launchEnvironment`.",
            "They're great for day-to-day work: turning on mocks, skipping onboarding in UI tests, enabling Core Data SQL logs with `-com.apple.CoreData.SQLDebug 1`.",
            "But they only exist when Xcode or the test runner launches the app. When the user taps the icon, or opens a TestFlight build, there are no arguments and no variables. **Never** pick the environment this way: the build configuration defines the environment.",
          ],
          code: raw`import Foundation

// Scheme › Run › Arguments
//   Arguments Passed On Launch: -UITests
//   Environment Variables:      API_MOCK = 1
let isUITest = ProcessInfo.processInfo.arguments.contains("-UITests")
let useMock = ProcessInfo.processInfo.environment["API_MOCK"] == "1"
print(isUITest, useMock)

// In a UI test:
// let app = XCUIApplication()
// app.launchArguments = ["-UITests"]
// app.launchEnvironment = ["API_MOCK": "1"]
// app.launch()`,
          output: "true true",
        },
        {
          kind: "predict",
          prompt: "The `Acme Dev` scheme sets `API_MOCK = 1`. You archive with that scheme, upload to TestFlight, and a tester opens the app. What does it print?",
          code: raw`import Foundation

let useMock = ProcessInfo.processInfo.environment["API_MOCK"] == "1"
print(useMock ? "mock" : "real")`,
          options: ["mock", "Crash: the variable doesn't exist", "Doesn't compile in Release", "real"],
          answer: 3,
          explanation: "Scheme environment variables are injected by Xcode only when it launches the app from Run (or Test). They aren't stored in the binary. On TestFlight `environment[\"API_MOCK\"]` is `nil`, `nil == \"1\"` is `false`, and it prints `real`. No crash: the dictionary lookup returns an optional.",
        },
        {
          kind: "write",
          prompt: "Finish `AppEnvironment`: `current` must come from the compilation conditions (`DEBUG`, then `STAGING`, otherwise prod) and `baseURL` must return a different URL per case using a `switch`.",
          starter: raw`import Foundation

enum AppEnvironment {
    case dev, staging, prod

    static var current: AppEnvironment {
        // your code
    }

    var baseURL: URL {
        // your code
    }
}`,
          checks: [
            { pattern: "#if\\s+DEBUG", label: "Uses `#if DEBUG`" },
            { pattern: "#elseif\\s+STAGING", label: "Uses `#elseif STAGING`" },
            { pattern: "^\\s*#else\\s*$", label: "Has an `#else` branch for prod" },
            { pattern: "#endif", label: "Closes with `#endif`" },
            { pattern: "switch\\s+self", label: "`baseURL` does `switch self`" },
          ],
          warnings: [
            { pattern: "ProcessInfo\\.processInfo\\.environment", label: "Scheme environment variables don't exist on TestFlight or the App Store" },
          ],
          solution: raw`import Foundation

enum AppEnvironment {
    case dev, staging, prod

    static var current: AppEnvironment {
        #if DEBUG
        return .dev
        #elseif STAGING
        return .staging
        #else
        return .prod
        #endif
    }

    var baseURL: URL {
        switch self {
        case .dev: URL(string: "https://dev-api.acme.com")!
        case .staging: URL(string: "https://staging-api.acme.com")!
        case .prod: URL(string: "https://api.acme.com")!
        }
    }
}`,
          hint: "Reuse the `#if DEBUG` / `#elseif STAGING` / `#else` / `#endif` structure from the explanation and build `switch self` with one `case` per environment.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "xcconfig-per-environment",
      title: "One `.xcconfig` per environment",
      goal: "Move build settings into versioned `.xcconfig` files, dodge the `//` trap in URLs, change bundle id, name and icon per environment, and read values at runtime from `Info.plist`.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Build settings in text files",
          body: [
            "An `.xcconfig` is a text file of `KEY = value` lines. You assign one to each configuration under Project › Info › Configurations. Huge win: changes get reviewed in a PR instead of hiding inside `project.pbxproj`.",
            "`#include` gives you inheritance: a `Base.xcconfig` with the shared values and one file per environment that overrides what changes. `$(inherited)` appends to the lower level's value instead of replacing it, and `$(OTHER_KEY)` reuses another variable.",
            "Classic trap: a value set directly on the target (shown in **bold** in Build Settings) beats the `.xcconfig`. If your change \"does nothing\", delete the target-level value so it inherits.",
          ],
          code: raw`// Config/Base.xcconfig
APP_NAME = Acme
MARKETING_VERSION = 2.3.0

// Config/Staging.xcconfig
#include "Base.xcconfig"

PRODUCT_BUNDLE_IDENTIFIER = com.acme.app.staging
APP_DISPLAY_NAME = $(APP_NAME) β
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon-Staging
SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) STAGING`,
        },
        {
          kind: "fill",
          prompt: "`Base.xcconfig` already defines compilation conditions. Fill it in so Staging **adds** `STAGING` without wiping the inherited ones.",
          code: raw`// Config/Staging.xcconfig
#include "Base.xcconfig"
SWIFT_ACTIVE_COMPILATION_CONDITIONS = ____ STAGING`,
          accept: ["^\\$\\(inherited\\)$"],
          explanation: "`$(inherited)` expands to the lower level's value (whatever came from the include or the defaults). Without it, the line **replaces** the whole list and you silently lose the inherited conditions.",
          hint: "It's the same variable you use in build settings to \"add to what's inherited\".",
          placeholder: "variable",
        },
        {
          kind: "explain",
          title: "Bundle id, name and icon per environment",
          body: [
            "To have Dev, Staging and Prod **installed side by side** on the same iPhone, each one needs its own bundle id: `com.acme.app.dev`, `com.acme.app.staging` and `com.acme.app`. Same bundle id = the system treats them as the same app and one overwrites the other.",
            "So nobody mixes them up on the home screen: a different display name (`CFBundleDisplayName`, e.g. \"Acme β\") and a different icon, with `ASSETCATALOG_COMPILER_APPICON_NAME` pointing to another app icon in the asset catalog (with an \"STG\" ribbon, say).",
            "Every new bundle id is a new App ID in Apple's portal: it has its own capabilities and profiles and, if it goes to TestFlight, its own app record in App Store Connect. More on that in the signing lesson.",
          ],
          code: raw`// Config/Dev.xcconfig
#include "Base.xcconfig"
PRODUCT_BUNDLE_IDENTIFIER = com.acme.app.dev
APP_DISPLAY_NAME = $(APP_NAME) Dev
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon-Dev

// Config/Prod.xcconfig
#include "Base.xcconfig"
PRODUCT_BUNDLE_IDENTIFIER = com.acme.app
APP_DISPLAY_NAME = $(APP_NAME)
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`,
        },
        {
          kind: "predict",
          prompt: "After a copy-paste, `Dev.xcconfig` ended up with Prod's bundle id. You have Prod from the App Store on your iPhone and you run Dev from Xcode. What happens?",
          code: raw`// Config/Dev.xcconfig
PRODUCT_BUNDLE_IDENTIFIER = com.acme.app

// Config/Prod.xcconfig
PRODUCT_BUNDLE_IDENTIFIER = com.acme.app`,
          options: [
            "Both apps stay installed, with the same icon",
            "Xcode refuses to install because a store app already exists",
            "Dev replaces the Prod app and inherits its local data",
            "Dev gets installed, but tapping the icon opens Prod",
          ],
          answer: 2,
          explanation: "To iOS, the bundle id **is** the app's identity: same id, same app. Xcode installs Dev over Prod and the data container (UserDefaults, local database, keychain) is kept, so now you have prod data talking to the dev backend. That's why every environment gets its own suffix.",
        },
        {
          kind: "explain",
          title: "From `.xcconfig` to code: `Info.plist`",
          body: [
            "Swift code can't see build settings. The bridge is `Info.plist`: you add a key whose value is `$(API_BASE_URL)` and Xcode substitutes it at build time. At runtime you read it with `Bundle.main.object(forInfoDictionaryKey:)`.",
            "Custom keys (`API_BASE_URL`) need a real `Info.plist` file: the `INFOPLIST_KEY_...` mechanism in newer projects only covers Apple's known keys, like `INFOPLIST_KEY_CFBundleDisplayName`.",
            "Read the configuration **once**, at launch, and fail loudly if it's missing: a `fatalError` on QA's first launch beats an app quietly calling an empty URL.",
          ],
          code: raw`<!-- Info.plist -->
<key>CFBundleDisplayName</key>
<string>$(APP_DISPLAY_NAME)</string>
<key>API_BASE_URL</key>
<string>$(API_BASE_URL)</string>

// AppConfig.swift (Dev build)
let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
print(value ?? "missing")`,
          output: "https://dev-api.acme.com",
        },
        {
          kind: "predict",
          prompt: "This is `Staging.xcconfig`, and `Info.plist` has `API_BASE_URL` = `$(API_BASE_URL)`. What does the app print?",
          code: raw`// Config/Staging.xcconfig
API_BASE_URL = https://staging-api.acme.com

// AppConfig.swift
let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
print(raw ?? "nil")`,
          options: ["https://staging-api.acme.com", "https:", "nil", "Doesn't compile: the `.xcconfig` is invalid"],
          answer: 1,
          explanation: "In an `.xcconfig`, `//` starts a comment **anywhere on the line**. Xcode reads `API_BASE_URL = https:` and silently drops the rest. The key exists, so it isn't `nil`: it's `\"https:\"`. The classic fix is `https:/$()/staging-api.acme.com`: `$()` is an empty variable that breaks up the two slashes.",
        },
        {
          kind: "fill",
          prompt: "`object(forInfoDictionaryKey:)` returns `Any?`. Fill in the safe cast to get a `String?`.",
          code: raw`let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") ____ String`,
          accept: ["^as\\?$"],
          explanation: "`as?` attempts the cast and returns `nil` if the key is missing or isn't a `String`. `as!` crashes in that case with no useful message; prefer `as?` plus a `guard` whose `fatalError` names the missing key.",
          hint: "It's the conditional cast, the one that returns an optional.",
          placeholder: "cast",
        },
        {
          kind: "explain",
          title: "Secrets out of git (and what isn't secret)",
          body: [
            "Keys you don't want in the repo (the staging analytics key, for example) go into a `Secrets.xcconfig` listed in `.gitignore`. Include it with `#include?`: the `?` means it won't fail if the file is missing, so anyone can still build. In CI you generate it from the pipeline's secrets.",
            "But anything that ends up in `Info.plist` or in the binary ships inside the `.ipa`, and anyone can unzip it and read it. Keeping it out of git stops leaks through the repo; it doesn't make it secret.",
            "Rule: the app only carries keys that are **public by design** (publishable keys, client IDs). Anything with real power (payment secret keys, admin credentials) lives on the backend.",
          ],
          code: raw`# .gitignore
Config/Secrets.xcconfig

// Config/Staging.xcconfig
#include "Base.xcconfig"
#include? "Secrets.xcconfig"

# CI step: generate the file from secrets
echo "ANALYTICS_KEY = $ANALYTICS_KEY" > Config/Secrets.xcconfig`,
        },
        {
          kind: "predict",
          prompt: "A dev puts the payments secret key (`sk_live_...`) in `Secrets.xcconfig`, which is in `.gitignore`, and exposes it through `Info.plist` to call the provider from the app. Is that safe?",
          code: raw`// Config/Secrets.xcconfig  (in .gitignore)
PAYMENTS_SECRET_KEY = sk_live_51H...

<!-- Info.plist -->
<key>PAYMENTS_SECRET_KEY</key>
<string>$(PAYMENTS_SECRET_KEY)</string>`,
          options: [
            "Yes: the file isn't in git",
            "Yes, as long as it's a Release build",
            "Yes, because the App Store encrypts the binary",
            "No: `Info.plist` ships as plain data inside the `.ipa`; that call belongs on the backend",
          ],
          answer: 3,
          explanation: "The compiled `Info.plist` sits inside the bundle and any tool can read it once the `.ipa` is unzipped (or from a jailbroken device). `.gitignore` only protects the repo. A payments secret key never belongs in the client: the app asks the backend, and the backend calls the provider.",
        },
        {
          kind: "write",
          prompt: "Write `AppConfig` with a `static let apiBaseURL: URL` property that safely reads `API_BASE_URL` from `Info.plist` and calls `fatalError` with a clear message if it's missing or not a valid URL.",
          starter: raw`import Foundation

enum AppConfig {
    // static let apiBaseURL: URL = ...
}`,
          checks: [
            { pattern: "static\\s+let\\s+apiBaseURL\\s*:\\s*URL", label: "Declares `static let apiBaseURL: URL`" },
            { pattern: "forInfoDictionaryKey:\\s*\"API_BASE_URL\"", label: "Reads `API_BASE_URL` from `Info.plist`" },
            { pattern: "as\\?\\s*String", label: "Casts safely with `as? String`" },
            { pattern: "URL\\(string:", label: "Builds the URL with `URL(string:)`" },
            { pattern: "fatalError\\(", label: "Fails with a clear message if missing" },
          ],
          warnings: [
            { pattern: "as!\\s*String", label: "`as!` crashes without saying which key is missing" },
            { pattern: "\"https?://", label: "Hardcoded URL: the value must come from the `.xcconfig`" },
          ],
          solution: raw`import Foundation

enum AppConfig {
    static let apiBaseURL: URL = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
              let url = URL(string: raw) else {
            fatalError("API_BASE_URL is missing or invalid in Info.plist")
        }
        return url
    }()
}`,
          hint: "Use a closure that runs once: `static let apiBaseURL: URL = { guard let ... else { fatalError(...) }; return url }()`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "code-signing",
      title: "Code signing, demystified",
      goal: "Understand each piece (certificate, private key, App ID, capabilities, profile, entitlements), pick the right profile for each kind of distribution, and read the most common signing errors.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "The pieces: certificate, private key and identity",
          body: [
            "To sign you need the **Apple Developer Program** (USD 99 a year) and a Team ID. Apple issues the **certificate** from a CSR, and it's only useful together with its **private key**, which was generated in the keychain of the Mac that requested it. Certificate + private key = **signing identity**.",
            "There are two kinds you'll use: **Apple Development** (running on your own devices) and **Apple Distribution** (Ad Hoc, TestFlight and the App Store). The `.cer` from the portal doesn't contain the private key; a `.p12` exported from the keychain does.",
            "That's why it works \"on my machine\": your keychain has the private key, your teammate's or the CI's doesn't. The first diagnostic step is always to list the valid identities.",
          ],
          code: raw`# Signing identities usable on this Mac (certificate + private key)
security find-identity -v -p codesigning`,
          output: raw`  1) 8E3C5F0A9B7D21C4E6F80A1B2C3D4E5F60718293 "Apple Development: Ana Perez (Q7XK29ABCD)"
  2) 1D9B44E7C2A0F3B5D7E9102A3B4C5D6E7F801234 "Apple Distribution: Acme Inc (ABCDE12345)"
     2 valid identities found`,
        },
        {
          kind: "predict",
          prompt: "On the CI runner someone imported the distribution certificate downloaded from the portal. What happens?",
          code: raw`# CI runner
security import distribution.cer -k build.keychain
security find-identity -v -p codesigning`,
          options: [
            "It lists the identity and signing works",
            "It only works for Debug builds",
            "It shows `0 valid identities found`: without the private key you can't sign; import the `.p12` (or use `match`)",
            "The import fails: `.cer` files can't go into a keychain",
          ],
          answer: 2,
          explanation: "The `.cer` only carries the public half. A signing identity needs the private key, which never leaves the Mac where it was created unless you export it as a password-protected `.p12`. Without it `find-identity -v` doesn't count it and `codesign` fails. `match` solves this by storing the certificate and key encrypted in a shared repo.",
        },
        {
          kind: "explain",
          title: "App IDs and provisioning profiles",
          body: [
            "The **App ID** is the bundle id registered in the portal, together with its **capabilities** (Push, Sign in with Apple, App Groups, Associated Domains...). The **provisioning profile** ties it all together: App ID + certificates + (sometimes) devices + allowed entitlements. It gets embedded in the app as `embedded.mobileprovision`.",
            "Kinds: **Development** (registered devices, development certificate), **Ad Hoc** (devices registered by UDID, up to 100 per device type per membership year, distribution certificate), **App Store** (no device list: TestFlight and the App Store) and **Enterprise / In-House** (only with the Apple Developer Enterprise Program, for your own employees, never for the public).",
            "Profiles expire, and they're invalidated if you revoke a certificate they contain. If something \"stopped signing\" overnight, check the expiration date.",
          ],
          code: raw`# Inspect a profile (or the embedded.mobileprovision inside a .app)
security cms -D -i embedded.mobileprovision > profile.plist
/usr/libexec/PlistBuddy -c "Print :Name" profile.plist
/usr/libexec/PlistBuddy -c "Print :ExpirationDate" profile.plist
/usr/libexec/PlistBuddy -c "Print :Entitlements" profile.plist`,
          output: raw`match AppStore com.acme.app.staging
Tue Mar 02 10:15:00 GMT 2027
Dict {
    application-identifier = ABCDE12345.com.acme.app.staging
    aps-environment = production
    com.apple.developer.team-identifier = ABCDE12345
    get-task-allow = false
}`,
        },
        {
          kind: "fill",
          prompt: "You need to install a build on 8 client iPhones whose UDIDs you've already registered, without going through TestFlight. Fill in the method in `ExportOptions.plist`.",
          code: raw`<!-- ExportOptions.plist -->
<key>method</key>
<string>____</string>`,
          accept: ["^ad-hoc$", "^release-testing$"],
          explanation: "Ad Hoc signs with the distribution certificate and a profile that lists the UDIDs: only those devices can install the app. Since Xcode 15.3 the same method is also called `release-testing` (and `app-store` became `app-store-connect`); the old names still work.",
          hint: "Distribution to registered devices, outside the store.",
          placeholder: "method",
        },
        {
          kind: "explain",
          title: "Entitlements and capabilities",
          body: [
            "**Entitlements** are permissions the app declares in its `.entitlements` file (pointed to by `CODE_SIGN_ENTITLEMENTS`). When you enable a capability under Signing & Capabilities, Xcode adds the key to that file.",
            "For signing to succeed, every entitlement has to be enabled on the **App ID** and present in the **profile**. Turning on Push in Xcode isn't enough: if the profile was generated earlier, it doesn't have it and must be regenerated.",
            "Every extension (widget, notification service, share) is another target with its own bundle id (`com.acme.app.widget`), its own App ID and its own profile. Forgetting the extension's profile is a first-upload classic.",
          ],
          code: raw`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>development</string>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:acme.com</string>
    </array>
</dict>
</plist>`,
        },
        {
          kind: "predict",
          prompt: "You enabled Push Notifications in Xcode and it works on your Mac (automatic signing). On CI, with manual signing, the build fails like this. What do you do?",
          code: raw`error: Provisioning profile "match AppStore com.acme.app" doesn't include
the Push Notifications capability.
error: Provisioning profile "match AppStore com.acme.app" doesn't include
the aps-environment entitlement.`,
          options: [
            "Enable Push on the App ID in the portal and regenerate the App Store profile",
            "Remove the `aps-environment` key from the `.entitlements` file",
            "Switch CI to an Apple Development certificate",
            "Run `xcodebuild clean` and retry",
          ],
          answer: 0,
          explanation: "The CI profile was generated before the capability existed, so it doesn't authorize that entitlement. On your Mac, automatic signing quietly regenerated your development profile. The fix is to enable Push on the App ID and regenerate the distribution profile (with `match`: run it with `force: true` from a machine with write access). Removing the entitlement \"fixes\" the build and breaks notifications.",
        },
        {
          kind: "explain",
          title: "Automatic vs manual signing, and the usual errors",
          body: [
            "**Automatic**: Xcode creates and renews certificates and profiles for you. Ideal locally. On CI it works with `xcodebuild -allowProvisioningUpdates` plus an App Store Connect API key, but every fresh runner may end up creating certificates.",
            "**Manual**: you pin the exact identity and profile in build settings. It's the most predictable option on CI, especially combined with `match`.",
            "Errors you'll see: profile missing a capability or entitlement (regenerate it); `No signing certificate ... found` (the certificate or its private key is missing from that keychain); expired or revoked certificate (renew it and regenerate the profiles); `errSecInternalComponent` on CI (`codesign` can't use the keychain: it's locked or it's the wrong one).",
          ],
          code: raw`// Config/Release.xcconfig (manual signing, typical on CI)
CODE_SIGN_STYLE = Manual
DEVELOPMENT_TEAM = ABCDE12345
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = match AppStore com.acme.app
CODE_SIGN_ENTITLEMENTS = Acme/Acme.entitlements`,
        },
        {
          kind: "write",
          prompt: "Write `Staging-Signing.xcconfig` with manual signing to ship Staging to TestFlight: team `ABCDE12345`, the distribution identity, and the App Store profile `match` generates for `com.acme.app.staging`.",
          starter: raw`// Config/Staging-Signing.xcconfig
#include "Staging.xcconfig"

`,
          checks: [
            { pattern: "^CODE_SIGN_STYLE\\s*=\\s*Manual\\s*$", label: "`CODE_SIGN_STYLE = Manual`" },
            { pattern: "^DEVELOPMENT_TEAM\\s*=\\s*ABCDE12345\\s*$", label: "Sets `DEVELOPMENT_TEAM`" },
            { pattern: "^CODE_SIGN_IDENTITY\\s*=\\s*Apple Distribution\\s*$", label: "Signs with `Apple Distribution`" },
            { pattern: "^PROVISIONING_PROFILE_SPECIFIER\\s*=\\s*match AppStore com\\.acme\\.app\\.staging\\s*$", label: "Uses the `match AppStore com.acme.app.staging` profile" },
          ],
          warnings: [
            { pattern: "^CODE_SIGN_IDENTITY\\s*=\\s*Apple Development", label: "TestFlight builds are signed with the distribution certificate" },
            { pattern: "^PROVISIONING_PROFILE_SPECIFIER\\s*=.*(Development|AdHoc)", label: "TestFlight needs an App Store profile" },
          ],
          solution: raw`// Config/Staging-Signing.xcconfig
#include "Staging.xcconfig"

CODE_SIGN_STYLE = Manual
DEVELOPMENT_TEAM = ABCDE12345
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = match AppStore com.acme.app.staging`,
          hint: "Four lines: style, team, identity and profile. `match` names profiles `match <Type> <bundle id>`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "versioning-fastlane",
      title: "Versioning and Fastlane",
      goal: "Tell the marketing version from the build number, automate the bump on CI, and build Fastlane lanes with `match`, `build_app`, `run_tests` and `upload_to_testflight` using an App Store Connect API key.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Version vs build",
          body: [
            "`CFBundleShortVersionString` (build setting `MARKETING_VERSION`) is the version users see on the App Store: `2.3.0`. `CFBundleVersion` (`CURRENT_PROJECT_VERSION`) is the **build number**: it identifies each binary you upload.",
            "App Store Connect rejects a build whose number you've already used for that version: the build number has to go up. The safest practice is to make it go up **always**, never resetting it per version; you never collide and the number alone tells you which build it is.",
            "The team decides the marketing version (semver, release train); the machine bumps the build. Nobody should edit it by hand.",
          ],
          code: raw`// Build Settings
//   MARKETING_VERSION       = 2.3.0  -> CFBundleShortVersionString
//   CURRENT_PROJECT_VERSION = 412    -> CFBundleVersion

let info = Bundle.main.infoDictionary
let version = info?["CFBundleShortVersionString"] as? String ?? "?"
let build = info?["CFBundleVersion"] as? String ?? "?"
print("v\(version) (\(build))")`,
          output: "v2.3.0 (412)",
        },
        {
          kind: "predict",
          prompt: "You uploaded `2.3.0 (412)` to TestFlight. You find a bug, fix it, archive again without touching anything else, and upload. What happens?",
          code: raw`MARKETING_VERSION = 2.3.0
CURRENT_PROJECT_VERSION = 412`,
          options: [
            "It replaces the previous build in TestFlight",
            "It's uploaded as `2.3.0 (413)` automatically",
            "It uploads fine but testers don't get the update",
            "The upload is rejected: build 412 already exists for version 2.3.0",
          ],
          answer: 3,
          explanation: "App Store Connect identifies each binary by version + build number and doesn't accept duplicates. It doesn't bump anything for you or replace builds. You need `412` → `413`, which is why the bump is automated on CI.",
        },
        {
          kind: "explain",
          title: "Bumping the build on CI",
          body: [
            "Common options: use the CI run number (`GITHUB_RUN_NUMBER`), or ask App Store Connect for the latest build and add one. The second doesn't depend on the CI and survives pipeline migrations.",
            "`agvtool` (needs `VERSIONING_SYSTEM = apple-generic`) changes the numbers in the project. You can also pass them on the `xcodebuild` command line, which beats every other level, without touching the repo.",
            "In Fastlane: `latest_testflight_build_number` queries App Store Connect and `increment_build_number` writes the new value.",
          ],
          code: raw`# With agvtool
agvtool new-version -all 413
agvtool new-marketing-version 2.3.1

# Or straight into xcodebuild, without touching the repo
xcodebuild archive -scheme "Acme Prod" -configuration Release \
  -archivePath build/Acme.xcarchive \
  CURRENT_PROJECT_VERSION=$GITHUB_RUN_NUMBER

# Fastfile
increment_build_number(build_number: latest_testflight_build_number + 1)`,
        },
        {
          kind: "fill",
          prompt: "Fill in the Fastlane action that asks App Store Connect for the latest uploaded build number.",
          code: raw`increment_build_number(build_number: ____ + 1)`,
          accept: ["^latest_testflight_build_number$", "^latest_testflight_build_number\\(.*\\)$"],
          explanation: "`latest_testflight_build_number` returns the highest build number in TestFlight for the app (you can pass `app_identifier:` and `version:`). Adding 1 guarantees the next build won't collide, no matter which CI produces it.",
          hint: "Its name says exactly what it returns: the latest TestFlight build.",
          placeholder: "action",
        },
        {
          kind: "explain",
          title: "Fastlane `match`: signing shared by the whole team",
          body: [
            "`match` stores certificates and profiles **encrypted** in a private git repo (or S3 / Google Cloud Storage). Every dev and the CI use **the same** identity: no more \"send me your `.p12`\" and no more duplicate certificates.",
            "The decryption password is `MATCH_PASSWORD`. The types are `development`, `adhoc`, `appstore` and `enterprise`, and profiles get named like `match AppStore com.acme.app`.",
            "One person with permissions creates or renews (`fastlane match appstore`); everyone else and the CI only **read**, with `readonly: true`. That way a runner never creates a new certificate by accident (accounts have a cap on distribution certificates).",
          ],
          code: raw`# fastlane/Matchfile
git_url("git@github.com:acme/ios-certificates.git")
storage_mode("git")
type("development")
team_id("ABCDE12345")
app_identifier(["com.acme.app", "com.acme.app.staging", "com.acme.app.dev"])

# A new dev, on their Mac:
#   bundle exec fastlane match development --readonly`,
        },
        {
          kind: "predict",
          prompt: "A new dev joins and can't run the app on her iPhone. The team uses `match`. What should she do?",
          code: raw`error: No signing certificate "iOS Development" found:
No "iOS Development" signing certificate matching team ID "ABCDE12345"
with a private key was found.`,
          options: [
            "Create her own development certificate in the portal",
            "Register her iPhone, have someone with permissions regenerate the development profiles, then run `fastlane match development --readonly`",
            "Ask another dev to send the `.p12` over Slack",
            "Switch to automatic signing and commit `project.pbxproj`",
          ],
          answer: 1,
          explanation: "With `match` the certificate already exists, encrypted in the repo: she just needs to download it. Her iPhone must be in the development profiles, so first the UDID gets registered and the profiles regenerated (e.g. with `force_for_new_devices: true`). Creating another certificate or sending `.p12` files over chat breaks exactly what `match` keeps in order.",
        },
        {
          kind: "explain",
          title: "Lanes: `build_app`, `run_tests`, `upload_to_testflight`",
          body: [
            "Actions have older aliases you'll see in blog posts: `build_app` = `gym`, `run_tests` = `scan`, `upload_to_testflight` = `pilot`, `upload_to_app_store` = `deliver`, `sync_code_signing` = `match`.",
            "To talk to App Store Connect use an **API key** (`.p8`, with key id and issuer id), not your Apple ID: there's no 2FA to get stuck on CI and it can be revoked on its own if it leaks. `app_store_connect_api_key` loads it and the following actions pick it up automatically.",
            "`setup_ci` creates a temporary keychain on the runner and puts `match` in read-only mode. It goes in `before_all` and does nothing when you run on your Mac.",
          ],
          code: raw`# fastlane/Fastfile
default_platform(:ios)

platform :ios do
  before_all do
    setup_ci
  end

  lane :tests do
    swiftlint(strict: true)
    run_tests(scheme: "Acme Dev", devices: ["iPhone 16"])
  end
end`,
        },
        {
          kind: "write",
          prompt: "Add a `beta` lane to the Fastfile that: loads the API key from environment variables, fetches App Store signing with `match` in read-only mode, bumps the build based on TestFlight, builds the `Acme Staging` scheme, and uploads to TestFlight without waiting for processing.",
          starter: raw`default_platform(:ios)

platform :ios do
  before_all do
    setup_ci
  end

  # lane :beta
end`,
          checks: [
            { pattern: "lane\\s+:beta\\s+do", label: "Defines `lane :beta`" },
            { pattern: "app_store_connect_api_key\\(", label: "Loads the API key with `app_store_connect_api_key`" },
            { pattern: "match\\([^)]*type:\\s*\"appstore\"", label: "`match` of type `appstore`" },
            { pattern: "match\\([^)]*readonly:\\s*true", label: "`match` with `readonly: true`" },
            { pattern: "increment_build_number\\(", label: "Bumps the build" },
            { pattern: "build_app\\([^)]*scheme:\\s*\"Acme Staging\"", label: "Builds the `Acme Staging` scheme" },
            { pattern: "upload_to_testflight\\(", label: "Uploads with `upload_to_testflight`" },
          ],
          warnings: [
            { pattern: "match\\([^)]*readonly:\\s*false", label: "On CI `match` must be `readonly`" },
            { pattern: "key_content:\\s*\"", label: "API key hardcoded in the Fastfile: it belongs in a secret" },
          ],
          solution: raw`default_platform(:ios)

platform :ios do
  before_all do
    setup_ci
  end

  lane :beta do
    app_store_connect_api_key(
      key_id: ENV["ASC_KEY_ID"],
      issuer_id: ENV["ASC_ISSUER_ID"],
      key_content: ENV["ASC_KEY_P8_BASE64"],
      is_key_content_base64: true
    )
    match(type: "appstore", app_identifier: "com.acme.app.staging", readonly: true)
    increment_build_number(
      build_number: latest_testflight_build_number(app_identifier: "com.acme.app.staging") + 1
    )
    build_app(scheme: "Acme Staging", configuration: "Staging", export_method: "app-store")
    upload_to_testflight(skip_waiting_for_build_processing: true)
  end
end`,
          hint: "Order: `app_store_connect_api_key` → `match` → `increment_build_number` → `build_app` → `upload_to_testflight`. The key values come from `ENV[...]`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "ci-pipelines-release",
      title: "CI pipelines and the release process",
      goal: "Design PR, develop and release pipelines on GitHub Actions, add lint and Danger, pick a branching strategy and a hotfix flow, and decouple deploy from release with feature flags and remote config.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Three pipelines, three goals",
          body: [
            "**PR**: fast and unsigned. Lint, build and unit tests on the simulator. It should give feedback in minutes and block the merge when it fails.",
            "**develop** (or `main` in trunk-based): a signed internal build (Staging to internal TestFlight) on every merge, so QA always has the latest. **release**: triggered by a `v*` tag or a `release/*` branch, builds Prod and uploads it to TestFlight and then the App Store.",
            "On GitHub Actions you need **macOS** runners (Xcode doesn't run on Linux). Alternatives: **Xcode Cloud** (Apple's, built into Xcode and App Store Connect, managed signing, scripts in `ci_scripts/ci_post_clone.sh`) and **Bitrise** (mobile-focused SaaS, prebuilt steps in `bitrise.yml`). Fastlane keeps the pipeline portable across all of them.",
          ],
          code: `# .github/workflows/pr.yml
name: PR

on:
  pull_request:
    branches: [develop, main]

concurrency:
  group: pr-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: macos-15
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          bundler-cache: true
      - run: bundle exec fastlane tests`,
        },
        {
          kind: "predict",
          prompt: "You open a PR from `feature/login` into `develop`. Does this workflow run?",
          code: `on:
  pull_request:
    branches: [main]`,
          options: [
            "Yes: it runs on every PR",
            "Yes, because `feature/login` isn't excluded",
            "No: for `pull_request`, `branches` filters the **target** branch, and that's `develop`",
            "Only once the PR is merged",
          ],
          answer: 2,
          explanation: "For the `pull_request` event, the `branches` filter applies to the base branch (where the PR is going), not the source branch. The target is `develop` and the filter only lists `main`, so the workflow doesn't run and the PR has no checks. That's why the example lists `[develop, main]`.",
        },
        {
          kind: "fill",
          prompt: "Fill in the runner: this job builds with Xcode.",
          code: `jobs:
  test:
    runs-on: ____
    steps:
      - uses: actions/checkout@v4`,
          accept: ["^macos-15$", "^macos-(latest|\\d+)(-large|-xlarge)?$"],
          explanation: "Xcode only runs on macOS, so the job needs a `macos-*` image. Pinning the version (`macos-15`) instead of `macos-latest` keeps the pipeline from switching Xcode on some random Monday; the exact Xcode version is chosen with `xcode-select` or an action like `maxim-lobanov/setup-xcode`.",
          hint: "A GitHub macOS image, with its version number.",
          placeholder: "runner",
        },
        {
          kind: "explain",
          title: "Lint, formatting and Danger",
          body: [
            "**SwiftLint** flags style issues and dangerous patterns (`force_cast`, `force_try`); **SwiftFormat** rewrites the formatting. Configured in the repo, they end style debates in code review.",
            "**Danger** runs on the PR and comments automatically: PR too big, missing description, `.pbxproj` changed with no tests, `Podfile.lock` modified. It automates what reviewers keep repeating.",
            "All of that goes in the PR pipeline and fails fast: no point burning 15 minutes of macOS runner on tests if lint already failed.",
          ],
          code: raw`# .swiftlint.yml
excluded:
  - Pods
  - .build
opt_in_rules:
  - force_unwrapping
  - empty_count
line_length: 140

# Dangerfile
warn("Big PR: split it if you can") if git.lines_of_code > 500
fail("Please add a PR description") if github.pr_body.length < 10`,
        },
        {
          kind: "explain",
          title: "Branches, release trains and hotfixes",
          body: [
            "**Git flow**: `develop` to integrate, `release/x.y` to stabilize, `main` mirrors what's shipped. Orderly but merge-heavy. **Trunk-based**: everyone integrates into `main` several times a day, unfinished work hides behind feature flags, and a release is a tag or a short-lived branch.",
            "A **release train** leaves on a fixed date (say, every two weeks): whatever's ready gets on, whatever isn't waits for the next one. It takes the pressure off and makes Apple's review predictable.",
            "**Hotfix**: branch from the **tag** of what's shipped, minimal fix, ship the patch (`2.3.1`), and bring the fix back to the main branch. Never cut a hotfix from a branch full of half-done features.",
          ],
          code: raw`# Hotfix on top of what's in production
git switch -c hotfix/2.3.1 v2.3.0
# ...fix + test...
git commit -am "fix: crash when opening orders without an address"
git tag v2.3.1
git push origin hotfix/2.3.1 --tags   # triggers the release pipeline

# Bring the fix back to the main branch
git switch main
git cherry-pick hotfix/2.3.1`,
        },
        {
          kind: "predict",
          prompt: "`2.3.0` in production crashes when opening orders. `main` already has half of `2.4.0`, unfinished. What's the right path?",
          code: raw`v2.3.0 ──●── (production)
          \
main       ●──●──●──●  (2.4.0 features, half done)`,
          options: [
            "Branch `hotfix/2.3.1` from tag `v2.3.0`, fix, release `2.3.1`, cherry-pick into `main`",
            "Fix it on `main` and ship `main` as `2.3.1`",
            "Revert every commit on `main` since `v2.3.0` and ship",
            "Wait for `2.4.0` and tell users",
          ],
          answer: 0,
          explanation: "The hotfix must contain exactly what shipped plus the fix, so it starts from the `v2.3.0` tag. Shipping `main` would push unfinished features to production; reverting everything destroys work. Afterwards the fix goes back to `main` (cherry-pick or merge) so `2.4.0` doesn't reintroduce the bug.",
        },
        {
          kind: "explain",
          title: "Feature flags and remote config",
          body: [
            "Once it's out, you can't \"pull back\" a version from people's iPhones, and Apple's review takes time. That's why the app fetches a **remote configuration** (Firebase Remote Config, LaunchDarkly or your own endpoint) at launch.",
            "Uses: **kill switch** (turn off a broken feature without a release), **percentage rollout** (10% of users see the new checkout; the bucket must be stable per user) and **forced update** (`min_supported_version`: if the app is older, show a blocking screen that sends the user to the App Store).",
            "Careful when comparing versions: as strings, `\"2.10.0\" < \"2.9.0\"` is `true`. Use `compare(_:options: .numeric)`.",
          ],
          code: raw`import Foundation

// GET /config -> { "min_supported_version": "2.9.0", "new_checkout_rollout": 20 }
let current = "2.10.0"
let minimum = "2.9.0"

print(current < minimum)
print(current.compare(minimum, options: .numeric) == .orderedAscending)`,
          output: "true\nfalse",
        },
        {
          kind: "predict",
          prompt: "This decides whether a user is in the 20% rollout of the new checkout. What's wrong with it?",
          code: raw`func isInRollout(userID: String, percent: Int) -> Bool {
    abs(userID.hashValue) % 100 < percent
}`,
          options: [
            "Nothing: it's stable and uniform",
            "`hashValue` changes between app launches: the same user drifts in and out of the experiment",
            "Doesn't compile: `hashValue` is a `UInt`",
            "It always returns `false` when `percent` is under 50",
          ],
          answer: 1,
          explanation: "Swift's `Hasher` uses a random per-process seed, so the `hashValue` of the same `String` changes on every launch. The user sees the new checkout today and the old one tomorrow, and the experiment's metrics are worthless. The bucket must come from a stable hash (computed on the backend or with a fixed algorithm like FNV or SHA-256). Also, `abs(Int.min)` traps.",
        },
        {
          kind: "write",
          prompt: "Write `needsForcedUpdate(current:minimum:)`: return `true` if the installed version is **lower** than the minimum supported version coming from remote config. Compare them as versions, not as text.",
          starter: raw`import Foundation

func needsForcedUpdate(current: String, minimum: String) -> Bool {
    // your code
}`,
          checks: [
            { pattern: "\\.compare\\(", label: "Uses `compare(_:options:)`" },
            { pattern: "options:\\s*\\.numeric", label: "Compares with `.numeric`" },
            { pattern: "\\.orderedAscending", label: "Checks `.orderedAscending` (current < minimum)" },
          ],
          warnings: [
            { pattern: "current\\s*<\\s*minimum", label: "Comparing versions as strings: `\"2.10.0\" < \"2.9.0\"` is `true`" },
          ],
          solution: raw`import Foundation

func needsForcedUpdate(current: String, minimum: String) -> Bool {
    current.compare(minimum, options: .numeric) == .orderedAscending
}`,
          hint: "`current.compare(minimum, options: .numeric)` returns a `ComparisonResult`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: Acme's pipeline",
      goal: "Pull the whole course together: configure Staging, write the `beta` and `release` lanes, and the GitHub Actions workflow that triggers them.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "Acme has 6 iOS devs and today ships by hand from one person's Mac. When that person is on vacation, there's no release. You've been asked to make sure nobody touches Xcode to distribute ever again.",
            "Requirements: Dev, Staging and Prod installable side by side (`com.acme.app.dev`, `com.acme.app.staging`, `com.acme.app`); Staging hits `https://staging-api.acme.com`; every merge to `develop` uploads Staging to TestFlight; every `v*` tag uploads Prod and submits it for review.",
            "Signing via `match` (repo `acme/ios-certificates`), App Store Connect API key in secrets, and no secrets in the repo.",
          ],
          code: raw`Acme.xcodeproj
Config/
  Base.xcconfig
  Dev.xcconfig
  Staging.xcconfig      <- you write this
  Prod.xcconfig
  Secrets.xcconfig      (in .gitignore)
fastlane/
  Matchfile
  Fastfile              <- you write this
.github/workflows/
  pr.yml
  deploy.yml            <- you write this`,
        },
        {
          kind: "write",
          prompt: "Write `Config/Staging.xcconfig`: inherits from `Base.xcconfig`, optionally includes `Secrets.xcconfig`, staging bundle id, backend URL (mind the `//`), `STAGING` condition without losing inherited ones, `AppIcon-Staging` icon, and the `match` App Store profile.",
          starter: raw`// Config/Staging.xcconfig
`,
          checks: [
            { pattern: "^#include\\s+\"Base\\.xcconfig\"", label: "Includes `Base.xcconfig`" },
            { pattern: "^#include\\?\\s+\"Secrets\\.xcconfig\"", label: "Includes `Secrets.xcconfig` with `#include?`" },
            { pattern: "^PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*com\\.acme\\.app\\.staging\\s*$", label: "Bundle id `com.acme.app.staging`" },
            { pattern: "^API_BASE_URL\\s*=\\s*https:/\\$\\(\\)/staging-api\\.acme\\.com", label: "URL with the `https:/$()/` trick" },
            { pattern: "^SWIFT_ACTIVE_COMPILATION_CONDITIONS\\s*=\\s*\\$\\(inherited\\)\\s+STAGING", label: "`$(inherited) STAGING`" },
            { pattern: "^ASSETCATALOG_COMPILER_APPICON_NAME\\s*=\\s*AppIcon-Staging\\s*$", label: "`AppIcon-Staging` icon" },
            { pattern: "^PROVISIONING_PROFILE_SPECIFIER\\s*=\\s*match AppStore com\\.acme\\.app\\.staging\\s*$", label: "Profile `match AppStore com.acme.app.staging`" },
          ],
          warnings: [
            { pattern: "^API_BASE_URL\\s*=\\s*https://", label: "`//` starts a comment: the URL ends up as `https:`" },
            { pattern: "^\\s*\\w*(PASSWORD|SECRET)\\w*\\s*=", label: "A secret in a versioned `.xcconfig`" },
          ],
          solution: raw`// Config/Staging.xcconfig
#include "Base.xcconfig"
#include? "Secrets.xcconfig"

PRODUCT_BUNDLE_IDENTIFIER = com.acme.app.staging
APP_DISPLAY_NAME = $(APP_NAME) β
API_BASE_URL = https:/$()/staging-api.acme.com
SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) STAGING
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon-Staging

CODE_SIGN_STYLE = Manual
DEVELOPMENT_TEAM = ABCDE12345
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = match AppStore com.acme.app.staging`,
          hint: "Combine lessons 2 and 3: `#include`, `#include?`, bundle id, `https:/$()/...`, `$(inherited) STAGING`, icon, and the manual signing lines.",
        },
        {
          kind: "write",
          prompt: "Write the `Fastfile`: in `before_all`, `setup_ci` and the API key from `ENV`. Lane `beta`: read-only App Store `match` for staging, bumped build, `Acme Staging` scheme, upload to TestFlight. Lane `release`: the same for `com.acme.app` with the `Acme Prod` scheme, and `upload_to_app_store` submitting for review.",
          starter: raw`default_platform(:ios)

platform :ios do
  before_all do
    # ...
  end

  # lane :beta

  # lane :release
end`,
          checks: [
            { pattern: "setup_ci", label: "Calls `setup_ci`" },
            { pattern: "app_store_connect_api_key\\(", label: "Loads the API key" },
            { pattern: "lane\\s+:beta\\s+do", label: "Defines `lane :beta`" },
            { pattern: "lane\\s+:release\\s+do", label: "Defines `lane :release`" },
            { pattern: "match\\([^)]*readonly:\\s*true", label: "Read-only `match`" },
            { pattern: "build_app\\([^)]*scheme:\\s*\"Acme Staging\"", label: "`beta` builds `Acme Staging`" },
            { pattern: "build_app\\([^)]*scheme:\\s*\"Acme Prod\"", label: "`release` builds `Acme Prod`" },
            { pattern: "upload_to_testflight\\(", label: "`beta` uploads to TestFlight" },
            { pattern: "upload_to_app_store\\([^)]*submit_for_review:\\s*true", label: "`release` submits for review" },
          ],
          warnings: [
            { pattern: "match\\([^)]*readonly:\\s*false", label: "On CI `match` must be `readonly`" },
            { pattern: "key_content:\\s*\"", label: "API key hardcoded in the Fastfile" },
          ],
          solution: raw`default_platform(:ios)

platform :ios do
  before_all do
    setup_ci
    app_store_connect_api_key(
      key_id: ENV["ASC_KEY_ID"],
      issuer_id: ENV["ASC_ISSUER_ID"],
      key_content: ENV["ASC_KEY_P8_BASE64"],
      is_key_content_base64: true
    )
  end

  lane :beta do
    match(type: "appstore", app_identifier: "com.acme.app.staging", readonly: true)
    increment_build_number(
      build_number: latest_testflight_build_number(app_identifier: "com.acme.app.staging") + 1
    )
    build_app(scheme: "Acme Staging", configuration: "Staging", export_method: "app-store")
    upload_to_testflight(skip_waiting_for_build_processing: true)
  end

  lane :release do
    match(type: "appstore", app_identifier: "com.acme.app", readonly: true)
    increment_build_number(
      build_number: latest_testflight_build_number(app_identifier: "com.acme.app") + 1
    )
    build_app(scheme: "Acme Prod", configuration: "Release", export_method: "app-store")
    upload_to_app_store(
      submit_for_review: true,
      automatic_release: false,
      force: true,
      skip_metadata: true,
      skip_screenshots: true
    )
  end
end`,
          hint: "The `release` lane is almost the same as `beta`: the bundle id, scheme, configuration and final action change (`upload_to_app_store(submit_for_review: true, ...)`).",
        },
        {
          kind: "write",
          prompt: "Write `.github/workflows/deploy.yml`: triggered by pushes to `develop` and by `v*` tags, runs on macOS, checks out, installs Ruby with bundler caching, passes `MATCH_PASSWORD` and the API key variables from `secrets`, and runs `fastlane beta` on `develop` and `fastlane release` on tags.",
          starter: `name: Deploy

on:
  # ...

jobs:
  # ...`,
          checks: [
            { pattern: "^\\s+branches:\\s*\\[\\s*develop\\s*\\]", label: "Push to `develop`" },
            { pattern: "^\\s+tags:\\s*\\[\\s*[\"']v\\*[\"']\\s*\\]", label: "`v*` tags" },
            { pattern: "runs-on:\\s*macos-", label: "macOS runner" },
            { pattern: "uses:\\s*actions/checkout@v\\d", label: "Checks out the code" },
            { pattern: "uses:\\s*ruby/setup-ruby@v1", label: "Installs Ruby" },
            { pattern: "MATCH_PASSWORD:\\s*\\$\\{\\{\\s*secrets\\.MATCH_PASSWORD\\s*\\}\\}", label: "`MATCH_PASSWORD` from `secrets`" },
            { pattern: "fastlane\\s+beta", label: "Runs `fastlane beta`" },
            { pattern: "fastlane\\s+release", label: "Runs `fastlane release`" },
          ],
          warnings: [
            { pattern: "runs-on:\\s*ubuntu", label: "Xcode only runs on macOS" },
            { pattern: "MATCH_PASSWORD:\\s*(?!\\$\\{\\{)\\S", label: "Plain-text secret in the workflow" },
          ],
          solution: `name: Deploy

on:
  push:
    branches: [develop]
    tags: ["v*"]

concurrency:
  group: deploy-\${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: macos-15
    timeout-minutes: 60
    env:
      MATCH_PASSWORD: \${{ secrets.MATCH_PASSWORD }}
      MATCH_GIT_BASIC_AUTHORIZATION: \${{ secrets.MATCH_GIT_BASIC_AUTHORIZATION }}
      ASC_KEY_ID: \${{ secrets.ASC_KEY_ID }}
      ASC_ISSUER_ID: \${{ secrets.ASC_ISSUER_ID }}
      ASC_KEY_P8_BASE64: \${{ secrets.ASC_KEY_P8_BASE64 }}
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          bundler-cache: true
      - name: Staging to TestFlight
        if: github.ref == 'refs/heads/develop'
        run: bundle exec fastlane beta
      - name: Prod to the App Store
        if: startsWith(github.ref, 'refs/tags/v')
        run: bundle exec fastlane release`,
          hint: "A single job whose `env:` pulls everything from `${{ secrets.X }}`, and two steps with `if:` based on `github.ref`.",
        },
        {
          kind: "predict",
          prompt: "The first deploy on GitHub Actions fails at signing, even though `match` downloaded everything fine. The same lane works on your Mac. What's the most likely cause?",
          code: raw`/usr/bin/codesign --force --sign 1D9B44E7C2A0F3B5D7E9102A3B4C5D6E7F801234 ... Acme.app
Acme.app: errSecInternalComponent
Command CodeSign failed with a nonzero exit code`,
          options: [
            "The distribution certificate expired",
            "The profile is missing the Push capability",
            "The runner doesn't have Xcode installed",
            "`codesign` can't use the private key: the runner's keychain is locked or isn't the one `match` used; `setup_ci` is missing",
          ],
          answer: 3,
          explanation: "`errSecInternalComponent` is the keychain refusing to hand the private key to `codesign` in a session with no UI. On your Mac the login keychain is unlocked. `setup_ci` creates an unlocked temporary keychain, makes it the default, and has `match` import into it. An expired certificate or a missing capability produce different errors, and without Xcode it would never get as far as signing.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-config-vs-scheme",
      front: "What's the difference between a build configuration and a scheme?",
      back: "A configuration (Debug, Staging, Release) is a set of build settings. A scheme picks which targets to build and which configuration each action uses: Run, Test, Profile, Analyze, Archive.",
    },
    {
      id: "fc-compilation-conditions",
      front: "How do you make `#if STAGING` work?",
      back: "Add `STAGING` to `SWIFT_ACTIVE_COMPILATION_CONDITIONS` in the Staging configuration. It's resolved at compile time: the other branches never reach the binary.",
      code: "SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) STAGING",
    },
    {
      id: "fc-launch-args",
      front: "Can scheme environment variables pick the environment of a TestFlight build?",
      back: "No. Launch arguments and environment variables only exist when Xcode or XCUITest launches the app. Use them for mocks and UI tests; the build configuration defines the environment.",
    },
    {
      id: "fc-xcconfig-slashes",
      front: "Why does `API_BASE_URL = https://api.acme.com` in an `.xcconfig` end up as `https:`?",
      back: "Because `//` starts a comment anywhere on the line. Work around it with an empty variable in the middle.",
      code: "API_BASE_URL = https:/$()/api.acme.com",
    },
    {
      id: "fc-info-plist-read",
      front: "How does Swift code read a value defined in an `.xcconfig`?",
      back: "Expose it in `Info.plist` as `$(KEY)` and read it at runtime with `Bundle.main.object(forInfoDictionaryKey:)` and `as? String`.",
      code: "Bundle.main.object(forInfoDictionaryKey: \"API_BASE_URL\") as? String",
    },
    {
      id: "fc-side-by-side",
      front: "What do you need to have Dev, Staging and Prod installed side by side?",
      back: "A different `PRODUCT_BUNDLE_IDENTIFIER` per environment (`.dev`, `.staging`, prod) and, to tell them apart, a different display name and icon (`ASSETCATALOG_COMPILER_APPICON_NAME`).",
    },
    {
      id: "fc-secrets",
      front: "If a key lives in a `Secrets.xcconfig` outside git but ends up in `Info.plist`, is it secret?",
      back: "No. `Info.plist` ships inside the `.ipa` and can be read by unzipping it. Keeping it out of git only prevents leaks through the repo; real secrets live on the backend.",
    },
    {
      id: "fc-identity",
      front: "What is a signing identity?",
      back: "A certificate plus its private key in the keychain. The portal's `.cer` isn't enough; an exported `.p12` (or `match`) carries both halves.",
      code: "security find-identity -v -p codesigning",
    },
    {
      id: "fc-profile-types",
      front: "What provisioning profile types exist and what is each one for?",
      back: "Development (registered devices, debugging), Ad Hoc (registered UDIDs, outside the store), App Store (TestFlight and the App Store, no device list), Enterprise (Enterprise Program only, internal distribution).",
    },
    {
      id: "fc-entitlements",
      front: "You added a capability and CI fails with \"profile doesn't include the ... entitlement\". What's missing?",
      back: "Enable the capability on the App ID and regenerate the profile. The old profile doesn't authorize the new entitlement.",
    },
    {
      id: "fc-versions",
      front: "`CFBundleShortVersionString` vs `CFBundleVersion`",
      back: "The first is the marketing version (`MARKETING_VERSION`, \"2.3.0\"). The second is the build number (`CURRENT_PROJECT_VERSION`): it must go up on every upload, and the safest bet is to make it always go up.",
    },
    {
      id: "fc-match",
      front: "What problem does Fastlane `match` solve?",
      back: "It stores certificates and profiles encrypted in a shared repo (or bucket): the whole team and the CI use the same identity. On CI you run it with `readonly: true`.",
      code: "match(type: \"appstore\", readonly: true)",
    },
    {
      id: "fc-fastlane-aliases",
      front: "Fastlane action aliases: `gym`, `scan`, `pilot`, `deliver`",
      back: "`gym` = `build_app`, `scan` = `run_tests`, `pilot` = `upload_to_testflight`, `deliver` = `upload_to_app_store`.",
    },
    {
      id: "fc-asc-api-key",
      front: "Why use an App Store Connect API key on CI instead of an Apple ID?",
      back: "No 2FA or expiring sessions, scoped permissions, and it can be revoked without touching anyone's personal account. Load it with `app_store_connect_api_key`.",
    },
    {
      id: "fc-feature-flags",
      front: "Three uses of remote config in an iOS app",
      back: "Kill switch (turn off a broken feature without a release), percentage rollout with a stable per-user bucket, and forced update comparing against `min_supported_version` with `.numeric`.",
    },
  ],

  exam: [
    {
      id: "ex-xcconfig-url",
      question: "The Staging app fails every request and the log shows the base URL is `https:`. What's the cause?",
      code: raw`// Config/Staging.xcconfig
API_BASE_URL = https://staging-api.acme.com`,
      options: [
        "`Info.plist` is missing the `API_BASE_URL` key",
        "`//` starts a comment in the `.xcconfig`; write `https:/$()/staging-api.acme.com`",
        "`NSAppTransportSecurity` is missing for the staging domain",
        "The scheme is using the Release configuration",
      ],
      answer: 1,
      explanation: "If the key were missing from `Info.plist` the value would be `nil`, not `https:`. That truncated value is the signature of the `//` comment in the `.xcconfig`. The empty variable `$()` splits the slashes and Xcode reads the full URL.",
    },
    {
      id: "ex-scheme-archive",
      question: "You archive with the `Acme Staging` scheme and the resulting build has bundle id `com.acme.app` (prod's). What do you check first?",
      options: [
        "That the scheme is marked as Shared",
        "That the distribution certificate hasn't expired",
        "The build configuration of the scheme's Archive action",
        "That `MARKETING_VERSION` differs per environment",
      ],
      answer: 2,
      explanation: "Each scheme action picks its own configuration. If Archive was left on Release, it takes prod's settings (bundle id included) even though the scheme is called Staging. Shared affects whether the scheme is in the repo, not which configuration it uses.",
    },
    {
      id: "ex-build-number",
      question: "The pipeline uploads to TestFlight and App Store Connect rejects the build because that version already has that build number. What's the lasting fix?",
      options: [
        "Bump `CFBundleVersion` automatically on CI (e.g. `latest_testflight_build_number + 1`)",
        "Bump `MARKETING_VERSION` on every build",
        "Delete the previous build from TestFlight before uploading",
        "Ask whoever made the last build to bump it by hand",
      ],
      answer: 0,
      explanation: "The build number must go up on every upload, and that's the machine's job. Bumping the marketing version on every build confuses users, deleting builds doesn't free the number, and relying on a person is exactly what CI is there to avoid.",
    },
    {
      id: "ex-private-key",
      question: "You got a new Mac. You downloaded the Apple Distribution certificate from the portal, installed it, and Xcode still says it can't find an identity with a private key. What's going on?",
      options: [
        "You need to restart Xcode so it rereads the keychain",
        "Distribution certificates only work on the Mac that first downloaded them",
        "You must revoke the certificate and create a new one, no way around it",
        "The private key stayed on the old Mac: export the `.p12` from there or fetch it from `match`",
      ],
      answer: 3,
      explanation: "The `.cer` only carries the public half. The private key was generated on the Mac that made the CSR. If it's gone for good, then yes, you revoke and create another, but first try to recover it from a `.p12` or from `match`, which stores it encrypted for exactly this reason.",
    },
    {
      id: "ex-capability",
      question: "You added Associated Domains for universal links. Locally (automatic signing) it works; on CI (match, manual signing) it fails saying the profile doesn't include `com.apple.developer.associated-domains`. What do you do?",
      options: [
        "Strip the entitlement from the CI build with a separate configuration",
        "Move CI to automatic signing without an API key",
        "Enable Associated Domains on the App ID and regenerate the `match` profiles",
        "Add the domain to `Info.plist`",
      ],
      answer: 2,
      explanation: "The `match` profiles were generated before the capability existed. Enable it on the App ID and regenerate them (e.g. `match` with `force: true` from a machine with write access). Stripping the entitlement on CI would break universal links in production.",
    },
    {
      id: "ex-adhoc-vs-testflight",
      question: "Product wants 300 external users to try the beta before launch. What do you use?",
      options: [
        "An Ad Hoc profile with the 300 UDIDs",
        "TestFlight external testing (build signed with an App Store profile)",
        "An Enterprise certificate",
        "Development builds installed over a cable",
      ],
      answer: 1,
      explanation: "TestFlight external testing supports up to 10,000 testers via email or a public link, with no UDID collection. Ad Hoc has a yearly device cap and requires registering each device. Enterprise is forbidden for users outside the company.",
    },
    {
      id: "ex-enterprise",
      question: "A client proposes distributing their consumer app with an Enterprise certificate \"to avoid depending on Apple's review\". What do you tell them?",
      options: [
        "Good idea if the app is free",
        "It works as long as they have fewer than 100 users",
        "It's the same as Ad Hoc but without limits",
        "It violates the Enterprise Program terms: it's for your own employees only, and Apple can revoke the certificate and with it every install",
      ],
      answer: 3,
      explanation: "The Apple Developer Enterprise Program is for internal distribution to employees. Using it for the public is grounds for revocation, and once the certificate is revoked every app signed with it stops launching on every device.",
    },
    {
      id: "ex-readonly",
      question: "Why does CI run `match` with `readonly: true`?",
      options: [
        "So the runner never creates or revokes certificates or profiles: it only downloads what already exists",
        "Because `readonly` makes the download faster",
        "Because without `readonly` you can't use the API key",
        "So the certificate isn't installed in the keychain",
      ],
      answer: 0,
      explanation: "Without `readonly`, if something doesn't match, `match` tries to create new certificates or profiles. On CI that can exhaust the distribution certificate cap or invalidate the team's. Creation and renewal are done by a person with permissions; CI only reads.",
    },
    {
      id: "ex-pr-pipeline",
      question: "What should run in the pipeline for every PR?",
      options: [
        "A signed Prod build and a TestFlight upload",
        "Lint, build and unit tests on the simulator, with no signing or upload",
        "Only lint; tests run nightly",
        "Nothing: checks happen after the merge",
      ],
      answer: 1,
      explanation: "The PR pipeline must be fast and doesn't need signing secrets (PRs from forks don't even get them). Signing and uploading belong to the develop and release pipelines. Without tests on the PR, bugs land on the main branch.",
    },
    {
      id: "ex-hotfix",
      question: "Version `3.1.0` crashes in production and `main` already has unfinished `3.2.0` features. Where does the hotfix come from?",
      options: [
        "From `main`, with the features turned off by flag",
        "From `develop`",
        "From the `v3.1.0` tag, as `3.1.1`, and then the fix goes back to `main`",
        "From a fresh empty branch",
      ],
      answer: 2,
      explanation: "The hotfix must be what shipped plus the fix, nothing more. Starting from `main` drags in untested code even if it's switched off. After shipping `3.1.1`, the fix goes back to `main` so `3.2.0` doesn't reintroduce the bug.",
    },
    {
      id: "ex-kill-switch",
      question: "The new checkout crashes for 3% of users. A fix takes a day plus Apple's review. The feature has a remote config flag. What do you do first?",
      options: [
        "Turn off the flag (kill switch) to fall back to the old checkout, then ship the fix",
        "Request an expedited review and wait",
        "Ask users not to use checkout",
        "Remove the app from sale on the App Store",
      ],
      answer: 0,
      explanation: "That's what a kill switch is for: it stops the damage in minutes, no release needed. The fix then goes through the normal path (and if it's urgent, you request an expedited review). Removing the app from sale doesn't help people who already have it.",
    },
    {
      id: "ex-forced-update",
      question: "Remote config sends `min_supported_version = \"2.9.0\"`. Users on `2.10.0` see the \"please update\" screen. Why?",
      code: raw`if currentVersion < minSupportedVersion {
    showForceUpdate()
}`,
      options: [
        "The remote config cache is stale",
        "`CFBundleShortVersionString` returns the build number",
        "The config read is missing an `await`",
        "It compares strings character by character: `\"2.10.0\" < \"2.9.0\"` is `true`; use `compare(_:options: .numeric)`",
      ],
      answer: 3,
      explanation: "`String` comparison is lexicographic: at the third character `\"1\" < \"9\"`, so `2.10.0` sorts \"before\" `2.9.0`. With `.numeric` each number is compared by value and `2.10.0` is greater.",
    },
  ],
};

export default content;
