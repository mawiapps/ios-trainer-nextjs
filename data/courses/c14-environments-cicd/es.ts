import type { CourseContent } from "../types";

// El código usa String.raw para conservar `\(...)` de Swift tal cual.
// El YAML de GitHub Actions usa template literals comunes con `\${{` para no interpolar.
const raw = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "configurations-schemes",
      title: "Configuraciones y schemes",
      goal: "Separar Dev, Staging y Prod con configuraciones de build y un scheme por ambiente, usar `#if DEBUG`/`#if STAGING` y saber cuándo sirven (y cuándo no) los launch arguments y las variables de entorno.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Configuración no es lo mismo que scheme",
          body: [
            "Una **configuración de build** (Debug, Release) es un juego de build settings: optimización, símbolos de debug, bundle id, URL del backend. Xcode trae dos; para Staging agregás una tercera en Project › Info › Configurations, duplicando Release (así se compila optimizada, como la que va a la tienda).",
            "Un **scheme** dice *qué* se compila y *con qué configuración* para cada acción: Run, Test, Profile, Analyze y Archive. Lo habitual es un scheme por ambiente: `Acme Dev`, `Acme Staging`, `Acme Prod`.",
            "Los schemes tienen que estar marcados como **Shared** (quedan en `xcshareddata/xcschemes`) para que entren al repo. Si no, el CI corre `xcodebuild -scheme \"Acme Staging\"` y responde que el scheme no existe.",
          ],
          code: raw`# Listar targets, configuraciones y schemes del proyecto
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
          prompt: "QA reporta que el build de Staging que archivaste le pega al backend de producción. Así está el scheme `Acme Staging`. ¿Qué pasó?",
          code: raw`<!-- Acme Staging.xcscheme (resumido) -->
<LaunchAction
   buildConfiguration = "Staging">
</LaunchAction>
<ArchiveAction
   buildConfiguration = "Release"
   revealArchiveInOrganizer = "YES">
</ArchiveAction>`,
          options: [
            "El scheme no está marcado como Shared",
            "El `.xcconfig` de Staging tiene un error de sintaxis",
            "Archive usa la configuración Release, que apunta a prod: cada acción del scheme elige su configuración",
            "Xcode siempre archiva en Release y no se puede cambiar",
          ],
          answer: 2,
          explanation: "Run (`LaunchAction`) usa Staging, pero Archive (`ArchiveAction`) quedó en Release, el valor por defecto al duplicar un scheme. El archive se compiló con los settings de Release, o sea los de prod. Se arregla en Edit Scheme › Archive › Build Configuration: Staging.",
        },
        {
          kind: "explain",
          title: "Condiciones de compilación: `#if DEBUG` y `#if STAGING`",
          body: [
            "`SWIFT_ACTIVE_COMPILATION_CONDITIONS` es la lista de flags que ve el compilador de Swift. Debug trae `DEBUG` de fábrica; en Staging agregás `STAGING`. Con eso escribís `#if STAGING` en el código.",
            "`#if` se resuelve **al compilar**: el código de las otras ramas no existe en el binario. Por eso es ideal para menús de debug o logs verbosos que nunca tienen que llegar a producción.",
            "Ojo con el orden y con de dónde duplicaste la configuración: si Staging viene de Debug, también tiene `DEBUG` activo.",
          ],
          code: raw`// Build Settings › Swift Compiler - Custom Flags
//   Debug:   SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG
//   Staging: SWIFT_ACTIVE_COMPILATION_CONDITIONS = STAGING
//   Release: (vacío)

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

// Compilado con la configuración Staging
print(AppEnvironment.current)`,
          output: "staging",
        },
        {
          kind: "predict",
          prompt: "Alguien creó la configuración Staging duplicando **Debug** y le agregó el flag. ¿Qué imprime un build de Staging con el mismo `AppEnvironment` de arriba?",
          code: raw`// Staging: SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG STAGING

print(AppEnvironment.current)`,
          options: ["dev", "staging", "prod", "Error de compilación: hay dos condiciones activas"],
          answer: 0,
          explanation: "Las dos condiciones están activas y `#if` evalúa las ramas en orden: `#if DEBUG` es verdadera primero, así que gana `.dev`. Tener varias condiciones activas es válido. La solución es que Staging no herede `DEBUG` (duplicala de Release) o chequear `STAGING` antes que `DEBUG`.",
        },
        {
          kind: "fill",
          prompt: "El menú secreto de debug no puede existir en builds de Staging ni de Prod. Completá la condición.",
          code: raw`#if ____
let showDebugMenu = true
#else
let showDebugMenu = false
#endif`,
          accept: ["^DEBUG$"],
          explanation: "`DEBUG` solo está activo en la configuración Debug, así que en Staging y Release el compilador toma la rama `#else` y el código del menú ni siquiera entra al binario.",
          hint: "Es el flag que Xcode ya trae activo en la configuración Debug.",
          placeholder: "condición",
        },
        {
          kind: "explain",
          title: "Launch arguments y variables de entorno",
          body: [
            "En Edit Scheme › Run › Arguments cargás **launch arguments** (`-UITests`) y **variables de entorno** (`API_MOCK = 1`). En código los leés con `ProcessInfo.processInfo.arguments` y `.environment`. Desde XCUITest se pasan con `app.launchArguments` y `app.launchEnvironment`.",
            "Sirven para el día a día: activar mocks, saltear el onboarding en UI tests, prender logs de Core Data con `-com.apple.CoreData.SQLDebug 1`.",
            "Pero solo existen cuando la app la lanza Xcode o el runner de tests. Si el usuario toca el ícono, o abre un build de TestFlight, no hay ni argumentos ni variables. **Nunca** elijas el ambiente con esto: el ambiente lo define la configuración de build.",
          ],
          code: raw`import Foundation

// Scheme › Run › Arguments
//   Arguments Passed On Launch: -UITests
//   Environment Variables:      API_MOCK = 1
let isUITest = ProcessInfo.processInfo.arguments.contains("-UITests")
let useMock = ProcessInfo.processInfo.environment["API_MOCK"] == "1"
print(isUITest, useMock)

// En un UI test:
// let app = XCUIApplication()
// app.launchArguments = ["-UITests"]
// app.launchEnvironment = ["API_MOCK": "1"]
// app.launch()`,
          output: "true true",
        },
        {
          kind: "predict",
          prompt: "En el scheme `Acme Dev` está `API_MOCK = 1`. Archivás con ese scheme, subís a TestFlight y un tester abre la app. ¿Qué imprime?",
          code: raw`import Foundation

let useMock = ProcessInfo.processInfo.environment["API_MOCK"] == "1"
print(useMock ? "mock" : "real")`,
          options: ["mock", "Crash: la variable no existe", "No compila en Release", "real"],
          answer: 3,
          explanation: "Las variables de entorno del scheme las inyecta Xcode solo al lanzar la app desde Run (o Test). No se guardan en el binario. En TestFlight `environment[\"API_MOCK\"]` es `nil`, `nil == \"1\"` es `false` y se imprime `real`. No hay crash: el diccionario devuelve un optional.",
        },
        {
          kind: "write",
          prompt: "Completá `AppEnvironment`: `current` tiene que salir de las condiciones de compilación (`DEBUG`, después `STAGING`, si no prod) y `baseURL` tiene que devolver una URL distinta por caso con un `switch`.",
          starter: raw`import Foundation

enum AppEnvironment {
    case dev, staging, prod

    static var current: AppEnvironment {
        // tu código
    }

    var baseURL: URL {
        // tu código
    }
}`,
          checks: [
            { pattern: "#if\\s+DEBUG", label: "Usa `#if DEBUG`" },
            { pattern: "#elseif\\s+STAGING", label: "Usa `#elseif STAGING`" },
            { pattern: "^\\s*#else\\s*$", label: "Tiene una rama `#else` para prod" },
            { pattern: "#endif", label: "Cierra con `#endif`" },
            { pattern: "switch\\s+self", label: "`baseURL` hace `switch self`" },
          ],
          warnings: [
            { pattern: "ProcessInfo\\.processInfo\\.environment", label: "Las variables de entorno del scheme no existen en TestFlight ni en el App Store" },
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
          hint: "Copiá la estructura `#if DEBUG` / `#elseif STAGING` / `#else` / `#endif` de la explicación y armá el `switch self` con un `case` por ambiente.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "xcconfig-per-environment",
      title: "Un `.xcconfig` por ambiente",
      goal: "Mover los build settings a archivos `.xcconfig` versionados, esquivar la trampa de `//` en las URLs, cambiar bundle id, nombre e ícono por ambiente y leer los valores en runtime desde el `Info.plist`.",
      minutes: 16,
      steps: [
        {
          kind: "explain",
          title: "Build settings en archivos de texto",
          body: [
            "Un `.xcconfig` es un archivo de texto con líneas `CLAVE = valor`. Lo asignás a cada configuración en Project › Info › Configurations. Ventaja enorme: los cambios se revisan en un PR, en vez de esconderse en el `project.pbxproj`.",
            "Con `#include` armás herencia: un `Base.xcconfig` con lo común y uno por ambiente que pisa lo que cambia. `$(inherited)` agrega al valor del nivel de abajo en vez de reemplazarlo, y `$(OTRA_CLAVE)` reutiliza otra variable.",
            "Trampa clásica: si un valor está seteado directamente en el target (aparece en **negrita** en Build Settings), le gana al `.xcconfig`. Si tu cambio \"no hace nada\", borrá el valor del target para que herede.",
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
          prompt: "`Base.xcconfig` ya define condiciones de compilación. Completá para que Staging **agregue** `STAGING` sin borrar las heredadas.",
          code: raw`// Config/Staging.xcconfig
#include "Base.xcconfig"
SWIFT_ACTIVE_COMPILATION_CONDITIONS = ____ STAGING`,
          accept: ["^\\$\\(inherited\\)$"],
          explanation: "`$(inherited)` se expande al valor del nivel de abajo (lo que venía del include o de los defaults). Sin él, la línea **reemplaza** la lista entera y perdés las condiciones heredadas sin ningún aviso.",
          hint: "Es la misma variable que usás en build settings para \"sumar a lo heredado\".",
          placeholder: "variable",
        },
        {
          kind: "explain",
          title: "Bundle id, nombre e ícono por ambiente",
          body: [
            "Para tener Dev, Staging y Prod **instaladas a la vez** en el mismo iPhone, cada una necesita su bundle id: `com.acme.app.dev`, `com.acme.app.staging` y `com.acme.app`. Mismo bundle id = el sistema la trata como la misma app y una pisa a la otra.",
            "Para no confundirlas en el home: nombre visible distinto (`CFBundleDisplayName`, por ejemplo \"Acme β\") e ícono distinto con `ASSETCATALOG_COMPILER_APPICON_NAME` apuntando a otro app icon del asset catalog (con una banda \"STG\", por ejemplo).",
            "Cada bundle id nuevo es un App ID nuevo en el portal de Apple: tiene sus capabilities y sus perfiles, y si va a TestFlight, su propia app en App Store Connect. Lo vemos en la lección de firma.",
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
          prompt: "Por un copy-paste, `Dev.xcconfig` quedó con el mismo bundle id que Prod. Tenés Prod del App Store en tu iPhone y corrés Dev desde Xcode. ¿Qué pasa?",
          code: raw`// Config/Dev.xcconfig
PRODUCT_BUNDLE_IDENTIFIER = com.acme.app

// Config/Prod.xcconfig
PRODUCT_BUNDLE_IDENTIFIER = com.acme.app`,
          options: [
            "Quedan las dos apps instaladas, con el mismo ícono",
            "Xcode se niega a instalar porque ya existe una app de la tienda",
            "Dev reemplaza a la app de Prod y hereda sus datos locales",
            "Se instala Dev, pero al tocar el ícono abre Prod",
          ],
          answer: 2,
          explanation: "Para iOS el bundle id **es** la identidad de la app: mismo id, misma app. Xcode instala Dev encima de Prod y el contenedor de datos (UserDefaults, base local, keychain) se conserva, así que tenés datos de prod hablando con el backend de dev. Por eso cada ambiente lleva su propio sufijo.",
        },
        {
          kind: "explain",
          title: "Del `.xcconfig` al código: el `Info.plist`",
          body: [
            "El código Swift no ve los build settings. El puente es el `Info.plist`: ponés una clave con `$(API_BASE_URL)` y Xcode la reemplaza al compilar. En runtime la leés con `Bundle.main.object(forInfoDictionaryKey:)`.",
            "Las claves propias (`API_BASE_URL`) necesitan un `Info.plist` de verdad: el mecanismo `INFOPLIST_KEY_...` de los proyectos nuevos solo cubre claves conocidas de Apple, como `INFOPLIST_KEY_CFBundleDisplayName`.",
            "Leé la configuración **una vez**, al arrancar, y fallá fuerte si falta: un `fatalError` en el primer launch de QA es mucho mejor que una app que le pega a una URL vacía.",
          ],
          code: raw`<!-- Info.plist -->
<key>CFBundleDisplayName</key>
<string>$(APP_DISPLAY_NAME)</string>
<key>API_BASE_URL</key>
<string>$(API_BASE_URL)</string>

// AppConfig.swift (build de Dev)
let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
print(value ?? "falta")`,
          output: "https://dev-api.acme.com",
        },
        {
          kind: "predict",
          prompt: "Este es el `Staging.xcconfig` y el `Info.plist` tiene `API_BASE_URL` = `$(API_BASE_URL)`. ¿Qué imprime la app?",
          code: raw`// Config/Staging.xcconfig
API_BASE_URL = https://staging-api.acme.com

// AppConfig.swift
let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
print(raw ?? "nil")`,
          options: ["https://staging-api.acme.com", "https:", "nil", "No compila: el `.xcconfig` es inválido"],
          answer: 1,
          explanation: "En un `.xcconfig`, `//` abre un comentario **en cualquier parte de la línea**. Xcode lee `API_BASE_URL = https:` y descarta el resto sin avisar. La clave existe, así que no es `nil`: vale `\"https:\"`. El fix clásico es `https:/$()/staging-api.acme.com`: `$()` es una variable vacía que corta las dos barras.",
        },
        {
          kind: "fill",
          prompt: "`object(forInfoDictionaryKey:)` devuelve `Any?`. Completá el cast seguro para obtener un `String?`.",
          code: raw`let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") ____ String`,
          accept: ["^as\\?$"],
          explanation: "`as?` intenta el cast y devuelve `nil` si la clave falta o no es un `String`. `as!` crashea en ese caso, sin un mensaje útil; mejor `as?` + `guard` con un `fatalError` que diga qué clave falta.",
          hint: "Es el cast condicional, el que devuelve un optional.",
          placeholder: "cast",
        },
        {
          kind: "explain",
          title: "Secretos fuera de git (y qué no es secreto)",
          body: [
            "Las claves que no querés en el repo (la key de analytics de staging, por ejemplo) van en un `Secrets.xcconfig` que está en `.gitignore`. Se incluye con `#include?`: el `?` hace que no falle si el archivo no existe, así cualquiera puede compilar. En CI lo generás a partir de los secrets del pipeline.",
            "Pero todo lo que termina en el `Info.plist` o en el binario viaja dentro del `.ipa`, y cualquiera lo puede descomprimir y leer. Sacarlo de git evita que se filtre por el repo, no lo vuelve secreto.",
            "Regla: en la app solo van claves **públicas por diseño** (publishable keys, IDs de cliente). Lo que da poder real (secret keys de pagos, credenciales de admin) vive en el backend.",
          ],
          code: raw`# .gitignore
Config/Secrets.xcconfig

// Config/Staging.xcconfig
#include "Base.xcconfig"
#include? "Secrets.xcconfig"

# Paso del CI: generar el archivo desde los secrets
echo "ANALYTICS_KEY = $ANALYTICS_KEY" > Config/Secrets.xcconfig`,
        },
        {
          kind: "predict",
          prompt: "Un dev pone la secret key de pagos (`sk_live_...`) en `Secrets.xcconfig`, que está en `.gitignore`, y la expone en el `Info.plist` para llamar al proveedor desde la app. ¿Es seguro?",
          code: raw`// Config/Secrets.xcconfig  (en .gitignore)
PAYMENTS_SECRET_KEY = sk_live_51H...

<!-- Info.plist -->
<key>PAYMENTS_SECRET_KEY</key>
<string>$(PAYMENTS_SECRET_KEY)</string>`,
          options: [
            "Sí: el archivo no está en git",
            "Sí, siempre que el build sea Release",
            "Sí, porque el App Store cifra el binario",
            "No: el `Info.plist` viaja en texto dentro del `.ipa`; esa llamada la tiene que hacer el backend",
          ],
          answer: 3,
          explanation: "El `Info.plist` compilado está dentro del bundle y se lee con cualquier herramienta después de descomprimir el `.ipa` (o desde un dispositivo con jailbreak). El `.gitignore` solo protege el repo. Una secret key de pagos nunca va en el cliente: la app le pide al backend y el backend llama al proveedor.",
        },
        {
          kind: "write",
          prompt: "Escribí `AppConfig` con una propiedad `static let apiBaseURL: URL` que lea `API_BASE_URL` del `Info.plist` de forma segura y haga `fatalError` con un mensaje claro si falta o no es una URL válida.",
          starter: raw`import Foundation

enum AppConfig {
    // static let apiBaseURL: URL = ...
}`,
          checks: [
            { pattern: "static\\s+let\\s+apiBaseURL\\s*:\\s*URL", label: "Declara `static let apiBaseURL: URL`" },
            { pattern: "forInfoDictionaryKey:\\s*\"API_BASE_URL\"", label: "Lee `API_BASE_URL` del `Info.plist`" },
            { pattern: "as\\?\\s*String", label: "Hace cast seguro con `as? String`" },
            { pattern: "URL\\(string:", label: "Construye la URL con `URL(string:)`" },
            { pattern: "fatalError\\(", label: "Falla con un mensaje claro si falta" },
          ],
          warnings: [
            { pattern: "as!\\s*String", label: "`as!` crashea sin decir qué clave falta" },
            { pattern: "\"https?://", label: "URL hardcodeada: el valor tiene que venir del `.xcconfig`" },
          ],
          solution: raw`import Foundation

enum AppConfig {
    static let apiBaseURL: URL = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
              let url = URL(string: raw) else {
            fatalError("API_BASE_URL falta o es inválida en el Info.plist")
        }
        return url
    }()
}`,
          hint: "Usá un closure que se ejecuta una vez: `static let apiBaseURL: URL = { guard let ... else { fatalError(...) }; return url }()`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "code-signing",
      title: "Firma de código sin misterio",
      goal: "Entender qué es cada pieza (certificado, clave privada, App ID, capabilities, perfil, entitlements), elegir el perfil correcto para cada distribución y leer los errores de firma más comunes.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Las piezas: certificado, clave privada e identidad",
          body: [
            "Para firmar necesitás el **Apple Developer Program** (USD 99 por año) y un Team ID. El **certificado** lo emite Apple a partir de un CSR, y solo sirve junto con su **clave privada**, que se generó en el keychain de la Mac que pidió el certificado. Certificado + clave privada = **identidad de firma**.",
            "Hay dos tipos que vas a usar: **Apple Development** (correr en dispositivos propios) y **Apple Distribution** (Ad Hoc, TestFlight y App Store). El `.cer` del portal no tiene la clave privada; el `.p12` exportado del keychain sí.",
            "Por eso funciona \"en mi máquina\": tu keychain tiene la clave privada, la del compañero o la del CI no. El primer diagnóstico siempre es listar las identidades válidas.",
          ],
          code: raw`# Identidades de firma usables en esta Mac (certificado + clave privada)
security find-identity -v -p codesigning`,
          output: raw`  1) 8E3C5F0A9B7D21C4E6F80A1B2C3D4E5F60718293 "Apple Development: Ana Perez (Q7XK29ABCD)"
  2) 1D9B44E7C2A0F3B5D7E9102A3B4C5D6E7F801234 "Apple Distribution: Acme Inc (ABCDE12345)"
     2 valid identities found`,
        },
        {
          kind: "predict",
          prompt: "En el runner de CI alguien importó el certificado de distribución bajado del portal. ¿Qué pasa?",
          code: raw`# Runner de CI
security import distribution.cer -k build.keychain
security find-identity -v -p codesigning`,
          options: [
            "Lista la identidad y la firma funciona",
            "Funciona solo para builds de Debug",
            "Muestra `0 valid identities found`: sin la clave privada no se puede firmar; hay que importar el `.p12` (o usar `match`)",
            "Falla el import: los `.cer` no se pueden importar en un keychain",
          ],
          answer: 2,
          explanation: "El `.cer` solo trae la parte pública. Una identidad de firma necesita la clave privada, que nunca sale de la Mac donde se creó salvo que la exportes como `.p12` (protegida con contraseña). Sin ella `find-identity -v` no la cuenta y `codesign` falla. `match` resuelve esto guardando certificado y clave cifrados en un repo compartido.",
        },
        {
          kind: "explain",
          title: "App IDs y perfiles de aprovisionamiento",
          body: [
            "El **App ID** es el bundle id registrado en el portal, con sus **capabilities** (Push, Sign in with Apple, App Groups, Associated Domains...). El **provisioning profile** ata todo: App ID + certificados + (a veces) dispositivos + entitlements permitidos. Se embebe en la app como `embedded.mobileprovision`.",
            "Tipos: **Development** (dispositivos registrados, certificado de desarrollo), **Ad Hoc** (dispositivos registrados por UDID, hasta 100 por tipo de dispositivo y año de membresía, certificado de distribución), **App Store** (sin lista de dispositivos: TestFlight y App Store) y **Enterprise / In-House** (solo con el Apple Developer Enterprise Program, para empleados propios, nunca para el público).",
            "Los perfiles caducan y se invalidan si revocás el certificado que contienen. Si algo \"dejó de firmar\" de un día para el otro, mirá la fecha de expiración.",
          ],
          code: raw`# Ver qué tiene un perfil (o el embedded.mobileprovision de un .app)
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
          prompt: "Querés instalarle un build a 8 iPhones de clientes cuyos UDIDs ya registraste, sin pasar por TestFlight. Completá el método del `ExportOptions.plist`.",
          code: raw`<!-- ExportOptions.plist -->
<key>method</key>
<string>____</string>`,
          accept: ["^ad-hoc$", "^release-testing$"],
          explanation: "Ad Hoc firma con el certificado de distribución y un perfil que lista los UDIDs: solo esos dispositivos pueden instalar la app. Desde Xcode 15.3 el mismo método también se llama `release-testing` (y `app-store` pasó a `app-store-connect`); los nombres viejos siguen funcionando.",
          hint: "Distribución a dispositivos registrados, fuera de la tienda.",
          placeholder: "método",
        },
        {
          kind: "explain",
          title: "Entitlements y capabilities",
          body: [
            "Los **entitlements** son permisos que la app declara en su `.entitlements` (lo apunta `CODE_SIGN_ENTITLEMENTS`). Cuando activás una capability en Signing & Capabilities, Xcode agrega la clave al archivo.",
            "Para que la firma pase, cada entitlement tiene que estar habilitado en el **App ID** y presente en el **perfil**. Activar Push en Xcode no alcanza: si el perfil se generó antes, no lo tiene y hay que regenerarlo.",
            "Cada extensión (widget, notification service, share) es otro target con su propio bundle id (`com.acme.app.widget`), su propio App ID y su propio perfil. Olvidarse del perfil de la extensión es un clásico de la primera subida.",
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
          prompt: "Activaste Push Notifications en Xcode y en tu Mac anda (firma automática). En CI, con firma manual, el build falla así. ¿Qué hacés?",
          code: raw`error: Provisioning profile "match AppStore com.acme.app" doesn't include
the Push Notifications capability.
error: Provisioning profile "match AppStore com.acme.app" doesn't include
the aps-environment entitlement.`,
          options: [
            "Habilitar Push en el App ID del portal y regenerar el perfil de App Store",
            "Borrar la clave `aps-environment` del `.entitlements`",
            "Cambiar a un certificado Apple Development en CI",
            "Correr `xcodebuild clean` y reintentar",
          ],
          answer: 0,
          explanation: "El perfil de CI se generó antes de que existiera la capability, así que no autoriza ese entitlement. En tu Mac la firma automática regeneró su perfil de desarrollo sola. La solución es habilitar Push en el App ID y regenerar el perfil de distribución (con `match`: correrlo con `force: true` desde una máquina con permisos de escritura). Borrar el entitlement \"arregla\" el build y rompe las notificaciones.",
        },
        {
          kind: "explain",
          title: "Firma automática vs manual, y los errores típicos",
          body: [
            "**Automática**: Xcode crea y renueva certificados y perfiles por vos. Ideal en local. En CI se puede con `xcodebuild -allowProvisioningUpdates` y una API key de App Store Connect, pero cada runner nuevo puede terminar creando certificados.",
            "**Manual**: elegís identidad y perfil exactos en build settings. Es lo más predecible en CI, sobre todo combinado con `match`.",
            "Errores que vas a ver: perfil sin capability o sin entitlement (regenerarlo); `No signing certificate ... found` (falta el certificado o su clave privada en ese keychain); certificado expirado o revocado (renovar y regenerar perfiles); `errSecInternalComponent` en CI (`codesign` no puede usar el keychain: está bloqueado o no es el correcto).",
          ],
          code: raw`// Config/Release.xcconfig (firma manual, típica en CI)
CODE_SIGN_STYLE = Manual
DEVELOPMENT_TEAM = ABCDE12345
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = match AppStore com.acme.app
CODE_SIGN_ENTITLEMENTS = Acme/Acme.entitlements`,
        },
        {
          kind: "write",
          prompt: "Escribí `Staging-Signing.xcconfig` con firma manual para subir Staging a TestFlight: team `ABCDE12345`, identidad de distribución y el perfil de App Store que genera `match` para `com.acme.app.staging`.",
          starter: raw`// Config/Staging-Signing.xcconfig
#include "Staging.xcconfig"

`,
          checks: [
            { pattern: "^CODE_SIGN_STYLE\\s*=\\s*Manual\\s*$", label: "`CODE_SIGN_STYLE = Manual`" },
            { pattern: "^DEVELOPMENT_TEAM\\s*=\\s*ABCDE12345\\s*$", label: "Setea `DEVELOPMENT_TEAM`" },
            { pattern: "^CODE_SIGN_IDENTITY\\s*=\\s*Apple Distribution\\s*$", label: "Firma con `Apple Distribution`" },
            { pattern: "^PROVISIONING_PROFILE_SPECIFIER\\s*=\\s*match AppStore com\\.acme\\.app\\.staging\\s*$", label: "Usa el perfil `match AppStore com.acme.app.staging`" },
          ],
          warnings: [
            { pattern: "^CODE_SIGN_IDENTITY\\s*=\\s*Apple Development", label: "Para TestFlight se firma con el certificado de distribución" },
            { pattern: "^PROVISIONING_PROFILE_SPECIFIER\\s*=.*(Development|AdHoc)", label: "TestFlight necesita un perfil de App Store" },
          ],
          solution: raw`// Config/Staging-Signing.xcconfig
#include "Staging.xcconfig"

CODE_SIGN_STYLE = Manual
DEVELOPMENT_TEAM = ABCDE12345
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = match AppStore com.acme.app.staging`,
          hint: "Son cuatro líneas: estilo, team, identidad y perfil. `match` nombra los perfiles `match <Tipo> <bundle id>`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "versioning-fastlane",
      title: "Versionado y Fastlane",
      goal: "Distinguir versión de marketing y número de build, automatizar el incremento en CI y armar lanes de Fastlane con `match`, `build_app`, `run_tests` y `upload_to_testflight` usando una API key de App Store Connect.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "Versión vs build",
          body: [
            "`CFBundleShortVersionString` (build setting `MARKETING_VERSION`) es la versión que ve el usuario en el App Store: `2.3.0`. `CFBundleVersion` (`CURRENT_PROJECT_VERSION`) es el **número de build**: identifica cada binario que subís.",
            "App Store Connect rechaza un build cuyo número ya usaste para esa versión: el número de build tiene que crecer. La práctica más segura es que crezca **siempre**, sin reiniciarlo con cada versión nueva; así nunca chocás y el número te dice qué build es.",
            "La versión de marketing la decide el equipo (semver, release train); el build lo incrementa la máquina. Nadie debería editarlo a mano.",
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
          prompt: "Subiste `2.3.0 (412)` a TestFlight. Encontrás un bug, lo arreglás, archivás de nuevo sin tocar nada más y subís. ¿Qué pasa?",
          code: raw`MARKETING_VERSION = 2.3.0
CURRENT_PROJECT_VERSION = 412`,
          options: [
            "Reemplaza al build anterior en TestFlight",
            "Se sube como `2.3.0 (413)` automáticamente",
            "Se sube bien pero los testers no reciben la actualización",
            "La subida se rechaza: ya existe un build 412 para la versión 2.3.0",
          ],
          answer: 3,
          explanation: "App Store Connect identifica cada binario por versión + número de build y no acepta duplicados. No incrementa nada solo ni reemplaza builds. Hay que subir `412` → `413`; por eso el incremento se automatiza en CI.",
        },
        {
          kind: "explain",
          title: "Incrementar el build en CI",
          body: [
            "Opciones comunes: usar el número de corrida del CI (`GITHUB_RUN_NUMBER`), o preguntarle a App Store Connect el último build y sumarle uno. La segunda no depende del CI y sobrevive a migraciones de pipeline.",
            "`agvtool` (necesita `VERSIONING_SYSTEM = apple-generic`) cambia los números en el proyecto. También podés pasarlos por línea de comandos a `xcodebuild`, que le gana a cualquier otro nivel, sin modificar el repo.",
            "En Fastlane: `latest_testflight_build_number` consulta App Store Connect e `increment_build_number` escribe el valor nuevo.",
          ],
          code: raw`# Con agvtool
agvtool new-version -all 413
agvtool new-marketing-version 2.3.1

# O directo en xcodebuild, sin tocar el repo
xcodebuild archive -scheme "Acme Prod" -configuration Release \
  -archivePath build/Acme.xcarchive \
  CURRENT_PROJECT_VERSION=$GITHUB_RUN_NUMBER

# Fastfile
increment_build_number(build_number: latest_testflight_build_number + 1)`,
        },
        {
          kind: "fill",
          prompt: "Completá la acción de Fastlane que consulta en App Store Connect el último número de build subido.",
          code: raw`increment_build_number(build_number: ____ + 1)`,
          accept: ["^latest_testflight_build_number$", "^latest_testflight_build_number\\(.*\\)$"],
          explanation: "`latest_testflight_build_number` devuelve el número de build más alto que hay en TestFlight para la app (podés pasarle `app_identifier:` y `version:`). Sumarle 1 garantiza que el próximo build no choque, sin importar qué CI lo genere.",
          hint: "Su nombre dice exactamente lo que devuelve: el último build de TestFlight.",
          placeholder: "acción",
        },
        {
          kind: "explain",
          title: "Fastlane `match`: firma compartida por todo el equipo",
          body: [
            "`match` guarda certificados y perfiles **cifrados** en un repo git privado (o en S3 / Google Cloud Storage). Todos los devs y el CI usan **la misma** identidad: se terminan los \"pasame tu `.p12`\" y los certificados duplicados.",
            "La contraseña de descifrado es `MATCH_PASSWORD`. Los tipos son `development`, `adhoc`, `appstore` y `enterprise`, y los perfiles quedan nombrados `match AppStore com.acme.app`.",
            "Una persona con permisos crea o renueva (`fastlane match appstore`); el resto y el CI solo **leen** con `readonly: true`. Así un runner nunca crea un certificado nuevo por accidente (hay un límite de certificados de distribución por cuenta).",
          ],
          code: raw`# fastlane/Matchfile
git_url("git@github.com:acme/ios-certificates.git")
storage_mode("git")
type("development")
team_id("ABCDE12345")
app_identifier(["com.acme.app", "com.acme.app.staging", "com.acme.app.dev"])

# Un dev nuevo, en su Mac:
#   bundle exec fastlane match development --readonly`,
        },
        {
          kind: "predict",
          prompt: "Entra una dev nueva y no puede correr la app en su iPhone. El equipo usa `match`. ¿Qué hace?",
          code: raw`error: No signing certificate "iOS Development" found:
No "iOS Development" signing certificate matching team ID "ABCDE12345"
with a private key was found.`,
          options: [
            "Crea su propio certificado de desarrollo desde el portal",
            "Registra su iPhone, alguien con permisos regenera los perfiles de desarrollo, y ella corre `fastlane match development --readonly`",
            "Le pide el `.p12` por Slack a otro dev",
            "Cambia a firma automática y commitea el `project.pbxproj`",
          ],
          answer: 1,
          explanation: "Con `match` el certificado ya existe cifrado en el repo: solo hay que bajarlo. Su iPhone tiene que estar en los perfiles de desarrollo, así que primero se registra el UDID y se regeneran (por ejemplo con `force_for_new_devices: true`). Crear otro certificado o mandar `.p12` por chat rompe justamente lo que `match` ordena.",
        },
        {
          kind: "explain",
          title: "Lanes: `build_app`, `run_tests`, `upload_to_testflight`",
          body: [
            "Las acciones tienen alias viejos que vas a ver en blogs: `build_app` = `gym`, `run_tests` = `scan`, `upload_to_testflight` = `pilot`, `upload_to_app_store` = `deliver`, `sync_code_signing` = `match`.",
            "Para hablar con App Store Connect usá una **API key** (`.p8`, con key id e issuer id), no tu Apple ID: no tiene 2FA que se trabe en CI y se revoca sola si se filtra. `app_store_connect_api_key` la carga y las acciones siguientes la usan automáticamente.",
            "`setup_ci` crea un keychain temporal en el runner y pone `match` en modo solo lectura. Va en `before_all` y no hace nada cuando corrés en tu Mac.",
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
          prompt: "Agregá al Fastfile una lane `beta` que: cargue la API key desde variables de entorno, baje la firma de App Store con `match` en solo lectura, incremente el build a partir de TestFlight, compile el scheme `Acme Staging` y suba a TestFlight sin esperar el procesamiento.",
          starter: raw`default_platform(:ios)

platform :ios do
  before_all do
    setup_ci
  end

  # lane :beta
end`,
          checks: [
            { pattern: "lane\\s+:beta\\s+do", label: "Define `lane :beta`" },
            { pattern: "app_store_connect_api_key\\(", label: "Carga la API key con `app_store_connect_api_key`" },
            { pattern: "match\\([^)]*type:\\s*\"appstore\"", label: "`match` de tipo `appstore`" },
            { pattern: "match\\([^)]*readonly:\\s*true", label: "`match` con `readonly: true`" },
            { pattern: "increment_build_number\\(", label: "Incrementa el build" },
            { pattern: "build_app\\([^)]*scheme:\\s*\"Acme Staging\"", label: "Compila el scheme `Acme Staging`" },
            { pattern: "upload_to_testflight\\(", label: "Sube con `upload_to_testflight`" },
          ],
          warnings: [
            { pattern: "match\\([^)]*readonly:\\s*false", label: "En CI `match` tiene que ser `readonly`" },
            { pattern: "key_content:\\s*\"", label: "API key hardcodeada en el Fastfile: va en un secret" },
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
          hint: "Orden: `app_store_connect_api_key` → `match` → `increment_build_number` → `build_app` → `upload_to_testflight`. Los valores de la key salen de `ENV[...]`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "ci-pipelines-release",
      title: "Pipelines de CI y proceso de release",
      goal: "Diseñar los pipelines de PR, develop y release en GitHub Actions, sumar lint y Danger, elegir estrategia de ramas y hotfixes, y desacoplar deploy de release con feature flags y remote config.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Tres pipelines, tres objetivos",
          body: [
            "**PR**: rápido y sin firma. Lint, build y tests unitarios en simulador. Tiene que dar feedback en minutos y bloquear el merge si falla.",
            "**develop** (o `main` en trunk-based): build interno firmado (Staging a TestFlight interno) en cada merge, para que QA siempre tenga lo último. **release**: disparado por un tag `v*` o una rama `release/*`, compila Prod y lo sube a TestFlight y después al App Store.",
            "En GitHub Actions necesitás runners **macOS** (Xcode no corre en Linux). Alternativas: **Xcode Cloud** (de Apple, integrado en Xcode y App Store Connect, firma gestionada, scripts en `ci_scripts/ci_post_clone.sh`) y **Bitrise** (SaaS móvil, steps preconfigurados en `bitrise.yml`). Fastlane hace que el pipeline sea portable entre todos.",
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
          prompt: "Abrís un PR de `feature/login` hacia `develop`. ¿Corre este workflow?",
          code: `on:
  pull_request:
    branches: [main]`,
          options: [
            "Sí: corre en todos los PRs",
            "Sí, porque `feature/login` no está excluida",
            "No: en `pull_request`, `branches` filtra la rama **destino**, y es `develop`",
            "Solo cuando el PR se mergea",
          ],
          answer: 2,
          explanation: "Para el evento `pull_request`, el filtro `branches` se aplica a la rama base (hacia dónde va el PR), no a la rama de origen. Como el destino es `develop` y el filtro solo tiene `main`, el workflow no corre y el PR queda sin checks. Por eso el ejemplo lista `[develop, main]`.",
        },
        {
          kind: "fill",
          prompt: "Completá el runner: el job compila con Xcode.",
          code: `jobs:
  test:
    runs-on: ____
    steps:
      - uses: actions/checkout@v4`,
          accept: ["^macos-15$", "^macos-(latest|\\d+)(-large|-xlarge)?$"],
          explanation: "Xcode solo corre en macOS, así que el job necesita una imagen `macos-*`. Fijar la versión (`macos-15`) en vez de `macos-latest` evita que el pipeline cambie de Xcode un lunes cualquiera; la versión exacta de Xcode se elige con `xcode-select` o una acción como `maxim-lobanov/setup-xcode`.",
          hint: "Una imagen de macOS de GitHub, con su número de versión.",
          placeholder: "runner",
        },
        {
          kind: "explain",
          title: "Lint, formato y Danger",
          body: [
            "**SwiftLint** marca problemas de estilo y patrones peligrosos (`force_cast`, `force_try`); **SwiftFormat** reformatea el código. Configurados en el repo, terminan las discusiones de estilo en el code review.",
            "**Danger** corre en el PR y comenta automáticamente: PR demasiado grande, falta descripción, se tocó el `.pbxproj` sin tests, se modificó el `Podfile.lock`. Automatiza lo que un reviewer repite siempre.",
            "Todo eso va en el pipeline de PR y falla rápido: no tiene sentido gastar 15 minutos de runner macOS en tests si el lint ya falló.",
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
warn("PR grande: partilo si podés") if git.lines_of_code > 500
fail("Agregá una descripción al PR") if github.pr_body.length < 10`,
        },
        {
          kind: "explain",
          title: "Ramas, release trains y hotfixes",
          body: [
            "**Git flow**: `develop` para integrar, `release/x.y` para estabilizar, `main` refleja lo publicado. Ordenado pero con mucho merge. **Trunk-based**: todos integran a `main` varias veces por día, lo incompleto se esconde detrás de feature flags, y la release es un tag o una rama corta.",
            "Un **release train** sale con fecha fija (por ejemplo, cada dos semanas): lo que está listo se sube al tren, lo que no, espera el próximo. Saca presión y hace predecible la revisión de Apple.",
            "**Hotfix**: rama desde el **tag** de lo publicado, fix mínimo, subir el patch (`2.3.1`) y llevar el fix de vuelta a la rama principal. Nunca saques un hotfix desde una rama con features a medio terminar.",
          ],
          code: raw`# Hotfix sobre lo que está en producción
git switch -c hotfix/2.3.1 v2.3.0
# ...fix + test...
git commit -am "fix: crash al abrir pedidos sin dirección"
git tag v2.3.1
git push origin hotfix/2.3.1 --tags   # dispara el pipeline de release

# Llevar el fix a la rama principal
git switch main
git cherry-pick hotfix/2.3.1`,
        },
        {
          kind: "predict",
          prompt: "La `2.3.0` en producción crashea al abrir pedidos. `main` ya tiene media `2.4.0` sin terminar. ¿Cuál es el camino correcto?",
          code: raw`v2.3.0 ──●── (producción)
          \
main       ●──●──●──●  (features de 2.4.0 a medio hacer)`,
          options: [
            "Rama `hotfix/2.3.1` desde el tag `v2.3.0`, fix, release `2.3.1` y cherry-pick a `main`",
            "Arreglar en `main` y publicar `main` como `2.3.1`",
            "Revertir todos los commits de `main` desde `v2.3.0` y publicar",
            "Esperar a la `2.4.0` y avisar a los usuarios",
          ],
          answer: 0,
          explanation: "El hotfix tiene que contener exactamente lo publicado más el arreglo, así que parte del tag `v2.3.0`. Publicar `main` mandaría features sin terminar a producción; revertir todo destruye trabajo. Después el fix vuelve a `main` (cherry-pick o merge) para que la `2.4.0` no reintroduzca el bug.",
        },
        {
          kind: "explain",
          title: "Feature flags y remote config",
          body: [
            "Una vez publicada, no podés \"bajar\" una versión de los iPhones de la gente, y la revisión de Apple tarda. Por eso la app consulta una **configuración remota** (Firebase Remote Config, LaunchDarkly o un endpoint propio) al arrancar.",
            "Usos: **kill switch** (apagar una feature rota sin release), **rollout por porcentaje** (el 10% de los usuarios ve el checkout nuevo; el bucket tiene que ser estable por usuario) y **update forzado** (`min_supported_version`: si la app es más vieja, pantalla que bloquea y manda al App Store).",
            "Ojo al comparar versiones: como strings, `\"2.10.0\" < \"2.9.0\"` da `true`. Usá `compare(_:options: .numeric)`.",
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
          prompt: "Así se decide si un usuario entra en el rollout del 20% del checkout nuevo. ¿Qué problema tiene?",
          code: raw`func isInRollout(userID: String, percent: Int) -> Bool {
    abs(userID.hashValue) % 100 < percent
}`,
          options: [
            "Ninguno: es estable y uniforme",
            "`hashValue` cambia entre ejecuciones de la app: el mismo usuario entra y sale del experimento",
            "No compila: `hashValue` es `UInt`",
            "Siempre devuelve `false` para `percent` menor a 50",
          ],
          answer: 1,
          explanation: "`Hasher` de Swift usa una semilla aleatoria por proceso, así que `hashValue` de un mismo `String` cambia en cada launch. El usuario ve el checkout nuevo hoy y el viejo mañana, y las métricas del experimento no sirven. El bucket tiene que salir de un hash estable (calculado en el backend o con un algoritmo fijo como FNV o SHA-256). Además `abs(Int.min)` crashea.",
        },
        {
          kind: "write",
          prompt: "Escribí `needsForcedUpdate(current:minimum:)`: devuelve `true` si la versión instalada es **menor** que la mínima soportada que llega por remote config. Compará como versiones, no como texto.",
          starter: raw`import Foundation

func needsForcedUpdate(current: String, minimum: String) -> Bool {
    // tu código
}`,
          checks: [
            { pattern: "\\.compare\\(", label: "Usa `compare(_:options:)`" },
            { pattern: "options:\\s*\\.numeric", label: "Compara con `.numeric`" },
            { pattern: "\\.orderedAscending", label: "Chequea `.orderedAscending` (current < minimum)" },
          ],
          warnings: [
            { pattern: "current\\s*<\\s*minimum", label: "Comparar versiones como strings: `\"2.10.0\" < \"2.9.0\"` da `true`" },
          ],
          solution: raw`import Foundation

func needsForcedUpdate(current: String, minimum: String) -> Bool {
    current.compare(minimum, options: .numeric) == .orderedAscending
}`,
          hint: "`current.compare(minimum, options: .numeric)` devuelve un `ComparisonResult`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Reto final: el pipeline de Acme",
      goal: "Integrar todo el curso: configurar Staging, escribir las lanes `beta` y `release` y el workflow de GitHub Actions que las dispara.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "El escenario",
          body: [
            "Acme tiene 6 devs iOS y hoy publica a mano desde la Mac de una sola persona. Cuando esa persona está de vacaciones, no hay release. Te piden que nadie vuelva a tocar Xcode para distribuir.",
            "Requisitos: Dev, Staging y Prod instalables a la vez (`com.acme.app.dev`, `com.acme.app.staging`, `com.acme.app`); Staging le pega a `https://staging-api.acme.com`; cada merge a `develop` sube Staging a TestFlight; cada tag `v*` sube Prod y la manda a revisión.",
            "Firma con `match` (repo `acme/ios-certificates`), API key de App Store Connect en secrets, y ningún secreto en el repo.",
          ],
          code: raw`Acme.xcodeproj
Config/
  Base.xcconfig
  Dev.xcconfig
  Staging.xcconfig      <- lo escribís vos
  Prod.xcconfig
  Secrets.xcconfig      (en .gitignore)
fastlane/
  Matchfile
  Fastfile              <- lo escribís vos
.github/workflows/
  pr.yml
  deploy.yml            <- lo escribís vos`,
        },
        {
          kind: "write",
          prompt: "Escribí `Config/Staging.xcconfig`: hereda de `Base.xcconfig`, incluye opcionalmente `Secrets.xcconfig`, bundle id de staging, URL del backend (cuidado con `//`), condición `STAGING` sin perder lo heredado, ícono `AppIcon-Staging` y el perfil de `match` de App Store.",
          starter: raw`// Config/Staging.xcconfig
`,
          checks: [
            { pattern: "^#include\\s+\"Base\\.xcconfig\"", label: "Incluye `Base.xcconfig`" },
            { pattern: "^#include\\?\\s+\"Secrets\\.xcconfig\"", label: "Incluye `Secrets.xcconfig` con `#include?`" },
            { pattern: "^PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*com\\.acme\\.app\\.staging\\s*$", label: "Bundle id `com.acme.app.staging`" },
            { pattern: "^API_BASE_URL\\s*=\\s*https:/\\$\\(\\)/staging-api\\.acme\\.com", label: "URL con el truco `https:/$()/`" },
            { pattern: "^SWIFT_ACTIVE_COMPILATION_CONDITIONS\\s*=\\s*\\$\\(inherited\\)\\s+STAGING", label: "`$(inherited) STAGING`" },
            { pattern: "^ASSETCATALOG_COMPILER_APPICON_NAME\\s*=\\s*AppIcon-Staging\\s*$", label: "Ícono `AppIcon-Staging`" },
            { pattern: "^PROVISIONING_PROFILE_SPECIFIER\\s*=\\s*match AppStore com\\.acme\\.app\\.staging\\s*$", label: "Perfil `match AppStore com.acme.app.staging`" },
          ],
          warnings: [
            { pattern: "^API_BASE_URL\\s*=\\s*https://", label: "`//` abre un comentario: la URL queda en `https:`" },
            { pattern: "^\\s*\\w*(PASSWORD|SECRET)\\w*\\s*=", label: "Un secreto en un `.xcconfig` versionado" },
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
          hint: "Juntá lo de las lecciones 2 y 3: `#include`, `#include?`, bundle id, `https:/$()/...`, `$(inherited) STAGING`, ícono y las líneas de firma manual.",
        },
        {
          kind: "write",
          prompt: "Escribí el `Fastfile`: en `before_all`, `setup_ci` y la API key desde `ENV`. Lane `beta`: `match` de App Store en solo lectura para staging, build incrementado, scheme `Acme Staging`, subida a TestFlight. Lane `release`: lo mismo para `com.acme.app` con el scheme `Acme Prod`, y `upload_to_app_store` mandando a revisión.",
          starter: raw`default_platform(:ios)

platform :ios do
  before_all do
    # ...
  end

  # lane :beta

  # lane :release
end`,
          checks: [
            { pattern: "setup_ci", label: "Llama a `setup_ci`" },
            { pattern: "app_store_connect_api_key\\(", label: "Carga la API key" },
            { pattern: "lane\\s+:beta\\s+do", label: "Define `lane :beta`" },
            { pattern: "lane\\s+:release\\s+do", label: "Define `lane :release`" },
            { pattern: "match\\([^)]*readonly:\\s*true", label: "`match` en solo lectura" },
            { pattern: "build_app\\([^)]*scheme:\\s*\"Acme Staging\"", label: "`beta` compila `Acme Staging`" },
            { pattern: "build_app\\([^)]*scheme:\\s*\"Acme Prod\"", label: "`release` compila `Acme Prod`" },
            { pattern: "upload_to_testflight\\(", label: "`beta` sube a TestFlight" },
            { pattern: "upload_to_app_store\\([^)]*submit_for_review:\\s*true", label: "`release` manda a revisión" },
          ],
          warnings: [
            { pattern: "match\\([^)]*readonly:\\s*false", label: "En CI `match` tiene que ser `readonly`" },
            { pattern: "key_content:\\s*\"", label: "API key hardcodeada en el Fastfile" },
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
          hint: "La lane `release` es casi igual a `beta`: cambian el bundle id, el scheme, la configuración y la acción final (`upload_to_app_store(submit_for_review: true, ...)`).",
        },
        {
          kind: "write",
          prompt: "Escribí `.github/workflows/deploy.yml`: se dispara con push a `develop` y con tags `v*`, corre en macOS, hace checkout, instala Ruby con cache de bundler, pasa `MATCH_PASSWORD` y las variables de la API key desde `secrets`, y corre `fastlane beta` en `develop` y `fastlane release` en los tags.",
          starter: `name: Deploy

on:
  # ...

jobs:
  # ...`,
          checks: [
            { pattern: "^\\s+branches:\\s*\\[\\s*develop\\s*\\]", label: "Push a `develop`" },
            { pattern: "^\\s+tags:\\s*\\[\\s*[\"']v\\*[\"']\\s*\\]", label: "Tags `v*`" },
            { pattern: "runs-on:\\s*macos-", label: "Runner macOS" },
            { pattern: "uses:\\s*actions/checkout@v\\d", label: "Hace checkout" },
            { pattern: "uses:\\s*ruby/setup-ruby@v1", label: "Instala Ruby" },
            { pattern: "MATCH_PASSWORD:\\s*\\$\\{\\{\\s*secrets\\.MATCH_PASSWORD\\s*\\}\\}", label: "`MATCH_PASSWORD` desde `secrets`" },
            { pattern: "fastlane\\s+beta", label: "Corre `fastlane beta`" },
            { pattern: "fastlane\\s+release", label: "Corre `fastlane release`" },
          ],
          warnings: [
            { pattern: "runs-on:\\s*ubuntu", label: "Xcode solo corre en macOS" },
            { pattern: "MATCH_PASSWORD:\\s*(?!\\$\\{\\{)\\S", label: "Secreto en texto plano en el workflow" },
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
      - name: Staging a TestFlight
        if: github.ref == 'refs/heads/develop'
        run: bundle exec fastlane beta
      - name: Prod al App Store
        if: startsWith(github.ref, 'refs/tags/v')
        run: bundle exec fastlane release`,
          hint: "Un solo job con `env:` tomando todo de `${{ secrets.X }}` y dos steps con `if:` según `github.ref`.",
        },
        {
          kind: "predict",
          prompt: "El primer deploy en GitHub Actions falla en la firma, aunque `match` bajó todo bien. En tu Mac la misma lane funciona. ¿Cuál es la causa más probable?",
          code: raw`/usr/bin/codesign --force --sign 1D9B44E7C2A0F3B5D7E9102A3B4C5D6E7F801234 ... Acme.app
Acme.app: errSecInternalComponent
Command CodeSign failed with a nonzero exit code`,
          options: [
            "El certificado de distribución expiró",
            "Falta la capability de Push en el perfil",
            "El runner no tiene Xcode instalado",
            "`codesign` no puede usar la clave privada: el keychain del runner está bloqueado o no es el que usó `match`; falta `setup_ci`",
          ],
          answer: 3,
          explanation: "`errSecInternalComponent` es el keychain negándole la clave privada a `codesign` en una sesión sin interfaz gráfica. En tu Mac el login keychain está desbloqueado. `setup_ci` crea un keychain temporal desbloqueado, lo pone como default y hace que `match` importe ahí. Un certificado expirado o una capability faltante dan otros errores, y sin Xcode ni siquiera llegaría a firmar.",
        },
      ],
    },
  ],

  flashcards: [
    {
      id: "fc-config-vs-scheme",
      front: "¿Qué diferencia hay entre una configuración de build y un scheme?",
      back: "La configuración (Debug, Staging, Release) es un juego de build settings. El scheme elige qué targets compilar y qué configuración usa cada acción: Run, Test, Profile, Analyze, Archive.",
    },
    {
      id: "fc-compilation-conditions",
      front: "¿Cómo hacés que `#if STAGING` funcione?",
      back: "Agregando `STAGING` a `SWIFT_ACTIVE_COMPILATION_CONDITIONS` en la configuración Staging. Se resuelve al compilar: las otras ramas no entran al binario.",
      code: "SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) STAGING",
    },
    {
      id: "fc-launch-args",
      front: "¿Sirven las variables de entorno del scheme para elegir el ambiente de un build de TestFlight?",
      back: "No. Launch arguments y variables de entorno solo existen cuando la app la lanza Xcode o XCUITest. Sirven para mocks y UI tests; el ambiente lo define la configuración de build.",
    },
    {
      id: "fc-xcconfig-slashes",
      front: "¿Por qué `API_BASE_URL = https://api.acme.com` en un `.xcconfig` queda como `https:`?",
      back: "Porque `//` abre un comentario en cualquier parte de la línea. Se esquiva con una variable vacía en el medio.",
      code: "API_BASE_URL = https:/$()/api.acme.com",
    },
    {
      id: "fc-info-plist-read",
      front: "¿Cómo lee el código Swift un valor definido en un `.xcconfig`?",
      back: "Exponiéndolo en el `Info.plist` como `$(CLAVE)` y leyéndolo en runtime con `Bundle.main.object(forInfoDictionaryKey:)` y `as? String`.",
      code: "Bundle.main.object(forInfoDictionaryKey: \"API_BASE_URL\") as? String",
    },
    {
      id: "fc-side-by-side",
      front: "¿Qué hace falta para tener Dev, Staging y Prod instaladas a la vez?",
      back: "Un `PRODUCT_BUNDLE_IDENTIFIER` distinto por ambiente (`.dev`, `.staging`, prod) y, para distinguirlas, nombre visible e ícono distintos (`ASSETCATALOG_COMPILER_APPICON_NAME`).",
    },
    {
      id: "fc-secrets",
      front: "Si una clave está en un `Secrets.xcconfig` fuera de git pero llega al `Info.plist`, ¿es secreta?",
      back: "No. El `Info.plist` viaja dentro del `.ipa` y se lee al descomprimirlo. Fuera de git solo evita filtraciones por el repo; lo secreto de verdad vive en el backend.",
    },
    {
      id: "fc-identity",
      front: "¿Qué es una identidad de firma?",
      back: "Certificado + su clave privada en el keychain. El `.cer` del portal no alcanza; el `.p12` exportado (o `match`) trae las dos partes.",
      code: "security find-identity -v -p codesigning",
    },
    {
      id: "fc-profile-types",
      front: "¿Qué tipos de provisioning profile hay y para qué es cada uno?",
      back: "Development (dispositivos registrados, debug), Ad Hoc (UDIDs registrados, fuera de la tienda), App Store (TestFlight y App Store, sin lista de dispositivos), Enterprise (solo con el Enterprise Program, distribución interna).",
    },
    {
      id: "fc-entitlements",
      front: "Agregaste una capability y CI falla con \"profile doesn't include the ... entitlement\". ¿Qué falta?",
      back: "Habilitar la capability en el App ID y regenerar el perfil. El perfil viejo no autoriza el entitlement nuevo.",
    },
    {
      id: "fc-versions",
      front: "`CFBundleShortVersionString` vs `CFBundleVersion`",
      back: "El primero es la versión de marketing (`MARKETING_VERSION`, \"2.3.0\"). El segundo es el número de build (`CURRENT_PROJECT_VERSION`): tiene que crecer en cada subida, y lo más seguro es que crezca siempre.",
    },
    {
      id: "fc-match",
      front: "¿Qué resuelve Fastlane `match`?",
      back: "Guarda certificados y perfiles cifrados en un repo (o bucket) compartido: todo el equipo y el CI usan la misma identidad. En CI se usa con `readonly: true`.",
      code: "match(type: \"appstore\", readonly: true)",
    },
    {
      id: "fc-fastlane-aliases",
      front: "Alias de las acciones de Fastlane: `gym`, `scan`, `pilot`, `deliver`",
      back: "`gym` = `build_app`, `scan` = `run_tests`, `pilot` = `upload_to_testflight`, `deliver` = `upload_to_app_store`.",
    },
    {
      id: "fc-asc-api-key",
      front: "¿Por qué usar una API key de App Store Connect en CI en vez de un Apple ID?",
      back: "No depende de 2FA ni de sesiones que vencen, tiene permisos acotados y se revoca sin tocar ninguna cuenta personal. Se carga con `app_store_connect_api_key`.",
    },
    {
      id: "fc-feature-flags",
      front: "Tres usos de la remote config en una app iOS",
      back: "Kill switch (apagar una feature rota sin release), rollout por porcentaje con un bucket estable por usuario, y update forzado comparando con `min_supported_version` usando `.numeric`.",
    },
  ],

  exam: [
    {
      id: "ex-xcconfig-url",
      question: "La app de Staging falla en todas las requests y el log muestra que la base URL es `https:`. ¿Cuál es la causa?",
      code: raw`// Config/Staging.xcconfig
API_BASE_URL = https://staging-api.acme.com`,
      options: [
        "El `Info.plist` no tiene la clave `API_BASE_URL`",
        "`//` abre un comentario en el `.xcconfig`; hay que escribir `https:/$()/staging-api.acme.com`",
        "Falta `NSAppTransportSecurity` para el dominio de staging",
        "El scheme está usando la configuración Release",
      ],
      answer: 1,
      explanation: "Si la clave faltara en el `Info.plist` el valor sería `nil`, no `https:`. Ese valor truncado es la firma del comentario `//` en el `.xcconfig`. La variable vacía `$()` separa las barras y Xcode lee la URL completa.",
    },
    {
      id: "ex-scheme-archive",
      question: "Archivás con el scheme `Acme Staging` y el build resultante tiene el bundle id `com.acme.app` (el de prod). ¿Qué revisás primero?",
      options: [
        "Que el scheme esté marcado como Shared",
        "Que el certificado de distribución no haya expirado",
        "La configuración de build de la acción Archive del scheme",
        "Que `MARKETING_VERSION` sea distinta en cada ambiente",
      ],
      answer: 2,
      explanation: "Cada acción del scheme elige su configuración. Si Archive quedó en Release, toma los settings de prod (bundle id incluido) aunque el scheme se llame Staging. Shared afecta si el scheme está en el repo, no qué configuración usa.",
    },
    {
      id: "ex-build-number",
      question: "El pipeline sube a TestFlight y App Store Connect rechaza el build porque esa versión ya tiene ese número de build. ¿Cuál es el arreglo duradero?",
      options: [
        "Incrementar `CFBundleVersion` automáticamente en CI (por ejemplo, `latest_testflight_build_number + 1`)",
        "Subir `MARKETING_VERSION` en cada build",
        "Borrar el build anterior de TestFlight antes de subir",
        "Pedirle a quien hizo el último build que lo incremente a mano",
      ],
      answer: 0,
      explanation: "El número de build tiene que crecer en cada subida y es trabajo de la máquina. Subir la versión de marketing en cada build confunde a los usuarios, borrar builds no libera el número y depender de una persona es justo lo que el CI evita.",
    },
    {
      id: "ex-private-key",
      question: "Te cambiaron la Mac. Bajaste el certificado Apple Distribution del portal, lo instalaste, y Xcode sigue diciendo que no encuentra una identidad con clave privada. ¿Qué pasa?",
      options: [
        "Hay que reiniciar Xcode para que lea el keychain",
        "Los certificados de distribución solo funcionan en la Mac que los descargó por primera vez",
        "Tenés que revocar el certificado y crear otro sí o sí",
        "La clave privada quedó en la Mac vieja: exportá el `.p12` desde ahí o bajalo de `match`",
      ],
      answer: 3,
      explanation: "El `.cer` solo trae la parte pública. La clave privada se generó en la Mac que hizo el CSR. Si ya no existe, entonces sí toca revocar y crear otro, pero lo primero es recuperarla del `.p12` o de `match`, que justamente la guarda cifrada.",
    },
    {
      id: "ex-capability",
      question: "Agregaste Associated Domains para universal links. Local (firma automática) funciona; CI (match, firma manual) falla diciendo que el perfil no incluye `com.apple.developer.associated-domains`. ¿Qué hacés?",
      options: [
        "Sacar el entitlement del build de CI con una configuración aparte",
        "Pasar CI a firma automática sin API key",
        "Habilitar Associated Domains en el App ID y regenerar los perfiles de `match`",
        "Agregar el dominio al `Info.plist`",
      ],
      answer: 2,
      explanation: "Los perfiles de `match` se generaron antes de la capability. Hay que habilitarla en el App ID y regenerarlos (por ejemplo `match` con `force: true` desde una máquina con escritura). Sacar el entitlement en CI rompería los universal links en producción.",
    },
    {
      id: "ex-adhoc-vs-testflight",
      question: "Producto quiere que 300 usuarios externos prueben la beta antes del lanzamiento. ¿Qué usás?",
      options: [
        "Perfil Ad Hoc con los 300 UDIDs",
        "TestFlight con testing externo (build firmado con perfil de App Store)",
        "Un certificado Enterprise",
        "Builds de desarrollo instalados por cable",
      ],
      answer: 1,
      explanation: "TestFlight externo admite hasta 10.000 testers por email o link público, sin recolectar UDIDs. Ad Hoc tiene un límite de dispositivos por año y exige registrarlos uno por uno. Enterprise está prohibido para usuarios fuera de la empresa.",
    },
    {
      id: "ex-enterprise",
      question: "Un cliente propone distribuir su app de consumo con un certificado Enterprise \"para no depender de la revisión de Apple\". ¿Qué le decís?",
      options: [
        "Es una buena idea si la app es gratuita",
        "Funciona mientras tengan menos de 100 usuarios",
        "Es lo mismo que Ad Hoc pero sin límite",
        "Viola los términos del Enterprise Program: es solo para empleados propios, y Apple puede revocar el certificado y con eso todas las instalaciones",
      ],
      answer: 3,
      explanation: "El Apple Developer Enterprise Program es para distribución interna a empleados. Usarlo con el público es motivo de revocación, y al revocar el certificado todas las apps firmadas con él dejan de abrir en todos los dispositivos.",
    },
    {
      id: "ex-readonly",
      question: "¿Por qué el CI corre `match` con `readonly: true`?",
      options: [
        "Para que el runner nunca cree ni revoque certificados o perfiles: solo baja lo que ya existe",
        "Porque `readonly` hace que la descarga sea más rápida",
        "Porque sin `readonly` no se puede usar la API key",
        "Para que el certificado no se instale en el keychain",
      ],
      answer: 0,
      explanation: "Sin `readonly`, si algo no coincide `match` intenta crear certificados o perfiles nuevos. En CI eso puede agotar el cupo de certificados de distribución o invalidar los del equipo. Las altas y renovaciones las hace una persona con permisos; el CI solo lee.",
    },
    {
      id: "ex-pr-pipeline",
      question: "¿Qué debería correr en el pipeline de cada PR?",
      options: [
        "Build firmado de Prod y subida a TestFlight",
        "Lint, build y tests unitarios en simulador, sin firma ni subida",
        "Solo el lint, los tests corren de noche",
        "Nada: los checks se hacen después del merge",
      ],
      answer: 1,
      explanation: "El pipeline de PR tiene que ser rápido y no necesita secretos de firma (los PRs de forks ni siquiera los tienen). Firmar y subir es trabajo de los pipelines de develop y release. Sin tests en el PR, los bugs llegan a la rama principal.",
    },
    {
      id: "ex-hotfix",
      question: "La versión `3.1.0` crashea en producción y `main` ya tiene features de `3.2.0` sin terminar. ¿Desde dónde sale el hotfix?",
      options: [
        "Desde `main`, con las features apagadas por flag",
        "Desde `develop`",
        "Desde el tag `v3.1.0`, como `3.1.1`, y después el fix vuelve a `main`",
        "Desde un branch nuevo vacío",
      ],
      answer: 2,
      explanation: "El hotfix tiene que ser lo publicado más el arreglo, nada más. Partir de `main` mete código no probado aunque esté apagado. Después de publicar `3.1.1`, el fix se lleva a `main` para que `3.2.0` no reintroduzca el bug.",
    },
    {
      id: "ex-kill-switch",
      question: "El checkout nuevo crashea para el 3% de los usuarios. Un fix tarda un día más la revisión de Apple. La feature tiene un flag en remote config. ¿Qué hacés primero?",
      options: [
        "Apagar el flag (kill switch) para volver al checkout viejo y después sacar el fix",
        "Pedir revisión expedita y esperar",
        "Pedir a los usuarios que no usen el checkout",
        "Sacar la app de venta del App Store",
      ],
      answer: 0,
      explanation: "Para eso existe el kill switch: corta el daño en minutos, sin release. Después el fix sigue su camino normal (y si es urgente, se pide revisión expedita). Sacar la app de venta no afecta a quienes ya la tienen.",
    },
    {
      id: "ex-forced-update",
      question: "La remote config manda `min_supported_version = \"2.9.0\"`. Usuarios con la `2.10.0` ven la pantalla de \"actualizá la app\". ¿Por qué?",
      code: raw`if currentVersion < minSupportedVersion {
    showForceUpdate()
}`,
      options: [
        "El cache de la remote config está viejo",
        "`CFBundleShortVersionString` devuelve el número de build",
        "Falta `await` en la lectura de la config",
        "Compara strings carácter por carácter: `\"2.10.0\" < \"2.9.0\"` es `true`; hay que usar `compare(_:options: .numeric)`",
      ],
      answer: 3,
      explanation: "La comparación de `String` es lexicográfica: en la tercera posición `\"1\" < \"9\"`, así que `2.10.0` queda \"antes\" que `2.9.0`. Con `.numeric` cada número se compara por su valor y `2.10.0` es mayor.",
    },
  ],
};

export default content;
