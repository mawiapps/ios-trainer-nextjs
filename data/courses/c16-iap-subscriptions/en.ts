import type { CourseContent } from "../types";

// Code uses String.raw so the backslashes in `\(...)` and `\.keyPath` survive.
const swift = String.raw;
const src = String.raw;

const content: CourseContent = {
  lessons: [
    // ─────────────────────────────────────────────────────────────
    {
      id: "products-setup",
      title: "Products and App Store Connect setup",
      goal: "Pick the right product type, set up subscription groups and levels, and get agreements, metadata and the review screenshot ready so products actually load.",
      minutes: 18,
      steps: [
        {
          kind: "explain",
          title: "The four product types",
          body: [
            "**Consumable**: used up and can be bought again (coins, credits, a pack of 10 exports). Apple doesn't restore it: **your backend** tracks the balance and credits it once it has verified the purchase.",
            "**Non-consumable**: bought once, owned forever (remove ads, a theme pack). It is restorable and shows up in `Transaction.currentEntitlements` unless it gets refunded.",
            "**Auto-renewable subscription**: charged every period until the user cancels. It lives inside a **subscription group**. **Non-renewing subscription**: access for a fixed time (a season pass); it doesn't renew by itself and your backend computes the expiry date.",
          ],
          code: swift`import StoreKit

func describe(_ product: Product) -> String {
    switch product.type {
    case .consumable:    return "Used up: your backend tracks the balance"
    case .nonConsumable: return "Forever: restorable"
    case .autoRenewable: return "Renews itself inside a group"
    case .nonRenewable:  return "Fixed time: you compute the expiry"
    default:             return "Unknown type"
    }
}`,
        },
        {
          kind: "predict",
          prompt: "A drawing app wants to sell a \"Watercolor brush pack\": paid once, used forever, and it must come back when the user moves to a new iPhone. Which product type do you create?",
          code: src`Product:     Watercolor brush pack
Payment:     one-time
Duration:    forever
Requirement: recovered on a new device`,
          options: ["Consumable", "Non-renewing subscription", "Non-consumable", "One-year auto-renewable subscription"],
          answer: 2,
          explanation: "A one-time payment with permanent access is a **non-consumable**. Apple restores it with the user's account and it appears in `Transaction.currentEntitlements`. A consumable is used up and not restored; subscriptions charge per period, which isn't what's being sold here.",
        },
        {
          kind: "explain",
          title: "Subscription groups and levels",
          body: [
            "All auto-renewable subscriptions that are \"the same service in different flavors\" go in **one group**. A user can have **only one active per group**: switching plans never means paying twice.",
            "Inside the group each product has a **level**. Level 1 is the highest-value one. Moving to a higher level (lower number) is an **upgrade**; to a lower one, a **downgrade**; to another product on the same level (monthly ↔ yearly of the same plan), a **crossgrade**.",
            "Rule of thumb: one group per app unless you sell truly independent services (say, a music plan and a podcast plan a user can hold at the same time).",
          ],
          code: src`Group: Premium  (subscription group ID: 21456789)

Level 1   com.acme.notes.pro.yearly     Pro yearly
Level 1   com.acme.notes.pro.monthly    Pro monthly
Level 2   com.acme.notes.plus.monthly   Plus monthly

# Plus -> Pro: upgrade     (level 2 -> level 1)
# Pro -> Plus: downgrade   (level 1 -> level 2)
# Pro monthly <-> Pro yearly: crossgrade (same level)`,
        },
        {
          kind: "predict",
          prompt: "With the group above, a user on **Plus monthly** (level 2) switches to **Pro yearly** (level 1) halfway through the month. What happens?",
          code: src`Today:    Plus monthly (level 2), day 15 of 30
Picks:    Pro yearly (level 1)`,
          options: [
            "Immediate upgrade: Pro starts now and Apple refunds the unused part of Plus",
            "Pro starts only when the Plus month ends",
            "Both subscriptions stay active until she cancels Plus",
            "The App Store rejects the change: she must cancel Plus and wait for it to expire",
          ],
          answer: 0,
          explanation: "Moving to a higher level is an **upgrade**: it's immediate and Apple issues a prorated refund for the unused part of the old plan. Since both are in the same group, two are never active at once. The case that waits for the next renewal is the downgrade.",
        },
        {
          kind: "explain",
          title: "Agreements, banking and tax: the number one cause",
          body: [
            "To sell anything, the account needs the **Paid Apps agreement** signed in App Store Connect (Business) with **banking and tax info complete**. The Account Holder signs it, not just any team member.",
            "If the agreement isn't active, `Product.products(for:)` **doesn't throw**: it returns an empty array. The app shows a blank paywall and the reviewer writes \"we were unable to locate the in-app purchases\". It's the number one cause of that rejection.",
            "That's why your code tells \"nothing loaded\" apart from \"loaded\": an empty array is an error state to show and log, not an empty paywall.",
          ],
          code: swift`let ids = ["com.acme.notes.pro.monthly", "com.acme.notes.pro.yearly"]
let products = try await Product.products(for: ids)

if products.isEmpty {
    // Not a throw: StoreKit returned [] with no error.
    // Check: Paid Apps agreement + banking + tax,
    // exact IDs, products created in App Store Connect.
    logger.error("StoreKit returned 0 products for \(ids)")
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the call that asks the App Store for the products.",
          code: swift`let products = try await Product.____(for: ProductID.all)`,
          accept: ["^products$"],
          explanation: "`Product.products(for:)` is static, `async throws`, and takes the product IDs. It returns only the ones the App Store recognizes: misspelled IDs simply don't show up in the result.",
          hint: "It's the plural of the type.",
          placeholder: "method",
        },
        {
          kind: "explain",
          title: "Per-product metadata and the review screenshot",
          body: [
            "Every product needs: a **Product ID** (unique and permanent: even after deleting it you can't reuse it), a reference name (internal), price, availability per country, **localizations** (the name and description users see) and a **review screenshot**.",
            "The review screenshot is an image of the app screen where the product shows up (your paywall). Without it the product never reaches \"Ready to Submit\", and if it isn't in that state you can't attach it to the version.",
            "Product IDs in code must match App Store Connect **exactly**. Keep them in one place: a typo doesn't error, the product just doesn't come back.",
          ],
          code: src`Product ID:         com.acme.notes.pro.monthly   # can never be reused
Reference name:     Pro Monthly                  # internal, users never see it
Subscription group: Premium (level 1)
Duration:           1 month
Price:              USD 4.99 (Apple derives the other countries)
Availability:       all countries
Localizations:      es-419, en-US (display name + description)
Review screenshot:  paywall screenshot showing this plan
Review notes:       Settings > Go Pro
Status:             Ready to Submit`,
        },
        {
          kind: "write",
          prompt: "Centralize the Product IDs: write `enum ProductID` with `proMonthly` = `com.acme.notes.pro.monthly`, `proYearly` = `com.acme.notes.pro.yearly` and a `static let all` holding both.",
          starter: swift`// Today the IDs are copy-pasted across three screens.
// Centralize them here.
`,
          checks: [
            { pattern: "enum\\s+ProductID\\b", label: "Declares `enum ProductID`" },
            { pattern: "static\\s+let\\s+proMonthly\\s*=\\s*\"com\\.acme\\.notes\\.pro\\.monthly\"", label: "`proMonthly` with the exact ID" },
            { pattern: "static\\s+let\\s+proYearly\\s*=\\s*\"com\\.acme\\.notes\\.pro\\.yearly\"", label: "`proYearly` with the exact ID" },
            { pattern: "static\\s+let\\s+all\\b[^\\n]*\\[\\s*proMonthly\\s*,\\s*proYearly\\s*\\]", label: "`all` lists both IDs" },
          ],
          warnings: [
            { pattern: "\"Pro Monthly\"|\"Pro Yearly\"", label: "That's the reference name, not the Product ID" },
          ],
          solution: swift`enum ProductID {
    static let proMonthly = "com.acme.notes.pro.monthly"
    static let proYearly = "com.acme.notes.pro.yearly"
    static let all = [proMonthly, proYearly]
}`,
          hint: "A caseless `enum` works as a namespace: `static let all = [proMonthly, proYearly]`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "storekit2-basics",
      title: "StoreKit 2 in the app",
      goal: "Load products, purchase, verify and finish transactions, listen to `Transaction.updates`, compute entitlements, restore, and know StoreKit's SwiftUI views.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "An observable store and prices you never hardcode",
          body: [
            "All purchase logic lives in one object, say `StoreManager`. On iOS 17 you mark it `@Observable`; in code that still supports iOS 16 it's an `ObservableObject` with `@Published`. Views only read its state.",
            "Prices are **always** shown with `product.displayPrice`: it's formatted in the currency and country of the user's account. A hardcoded `\"$4.99\"` is wrong in Argentina, in Japan, and the moment you change the price in App Store Connect.",
            "`displayName` and `description` also come from App Store Connect, in the user's language.",
          ],
          code: swift`import StoreKit
import Observation

@MainActor
@Observable
final class StoreManager {
    private(set) var products: [Product] = []
    private(set) var loadFailed = false

    func loadProducts() async {
        do {
            products = try await Product.products(for: ProductID.all)
                .sorted { $0.price < $1.price }
            loadFailed = products.isEmpty
        } catch {
            loadFailed = true
        }
    }
}

// In the view:
// Text("\(product.displayName): \(product.displayPrice)")`,
        },
        {
          kind: "fill",
          prompt: "Show the product's localized price, ready for the UI.",
          code: swift`Text(product.____)`,
          accept: ["^displayPrice$"],
          explanation: "`displayPrice` is a `String` already formatted in the user's storefront currency. `price` is a `Decimal`, handy for sorting or computing \"save 20%\", but for display you use `displayPrice`.",
          hint: "It starts with `display`.",
          placeholder: "property",
        },
        {
          kind: "explain",
          title: "Purchasing: three possible outcomes",
          body: [
            "`try await product.purchase(options:)` shows the system payment sheet and returns a `Product.PurchaseResult`. Pass `.appAccountToken(uuid)` with a stable UUID for your user so your backend knows whose purchase it is.",
            "`.success(verification)`: there's a transaction, still to be verified. `.userCancelled`: the user dismissed the sheet; not an error, no alerts. `.pending`: the purchase waits on something external (**Ask to Buy** for a minor, or the bank's strong customer authentication, SCA). Unlock nothing: the final transaction arrives later through `Transaction.updates`.",
            "If `purchase` throws (network, product unavailable), surface it with a retry option.",
          ],
          code: swift`func purchase(_ product: Product) async throws {
    let result = try await product.purchase(options: [.appAccountToken(userToken)])

    switch result {
    case .success(let verification):
        let transaction = try checkVerified(verification)
        await deliver(transaction)
        await transaction.finish()
    case .userCancelled:
        break
    case .pending:
        isPending = true      // "Waiting for approval"
    @unknown default:
        break
    }
}`,
        },
        {
          kind: "predict",
          prompt: "A 12-year-old with **Ask to Buy** turned on in Family Sharing taps \"Subscribe\". What does `purchase()` return and what should the app do?",
          code: swift`let result = try await product.purchase()
// Ask to Buy enabled for this account`,
          options: [
            "It throws `notAvailable`; show an alert",
            "`.userCancelled`; the app does nothing else",
            "`.success` with an `.unverified` transaction",
            "`.pending`; the app shows \"waiting for approval\" and the transaction arrives later through `Transaction.updates`",
          ],
          answer: 3,
          explanation: "Ask to Buy leaves the purchase **pending** until the adult approves it, maybe hours later with the app closed. `purchase()` returns `.pending`; the app unlocks nothing. When the adult approves, the transaction shows up in `Transaction.updates`, which is why that listener must be running from app launch.",
        },
        {
          kind: "explain",
          title: "Verify, then finish",
          body: [
            "Every transaction comes wrapped in a `VerificationResult`: `.verified(transaction)` if StoreKit validated Apple's JWS signature for your app and this device, `.unverified(transaction, error)` if not. Never deliver content for an `.unverified` one.",
            "`await transaction.finish()` tells the App Store \"delivered\". Call it **after** delivering (saving the entitlement, crediting coins on your backend). If the app dies before that, the unfinished transaction shows up again in `Transaction.updates` and you can retry.",
            "An unfinished consumable stays in the queue and comes back on every launch; one finished before crediting is money charged and nothing delivered.",
          ],
          code: swift`enum StoreError: Error { case failedVerification }

func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
    switch result {
    case .verified(let value):
        return value
    case .unverified(_, let error):
        logger.error("Unverified transaction: \(error)")
        throw StoreError.failedVerification
    }
}`,
        },
        {
          kind: "write",
          prompt: "Write `purchase(_ product: Product) async throws` on `StoreManager`: purchase with `appAccountToken`, verify with `checkVerified`, call `deliver(_:)` and only then `finish()`. Handle `.userCancelled` and `.pending` (set `isPending = true`).",
          starter: swift`func purchase(_ product: Product) async throws {
    // your code
}`,
          checks: [
            { pattern: "\\.purchase\\(options:\\s*\\[\\s*\\.appAccountToken\\(", label: "Purchases with `.appAccountToken(...)`" },
            { pattern: "case\\s+\\.success\\(", label: "Handles `.success`" },
            { pattern: "checkVerified\\(", label: "Verifies the transaction" },
            { pattern: "case\\s+\\.userCancelled", label: "Handles `.userCancelled`" },
            { pattern: "case\\s+\\.pending[\\s\\S]*isPending\\s*=\\s*true", label: "Handles `.pending` by setting `isPending`" },
            { pattern: "deliver\\([\\s\\S]*\\.finish\\(\\)", label: "`finish()` after `deliver`" },
          ],
          warnings: [
            { pattern: "\\.finish\\(\\)[\\s\\S]*deliver\\(", label: "You finish the transaction before delivering the content" },
            { pattern: "try!", label: "`try!` crashes the app on a network error" },
          ],
          solution: swift`func purchase(_ product: Product) async throws {
    let result = try await product.purchase(options: [.appAccountToken(userToken)])
    switch result {
    case .success(let verification):
        let transaction = try checkVerified(verification)
        await deliver(transaction)
        await transaction.finish()
    case .userCancelled:
        break
    case .pending:
        isPending = true
    @unknown default:
        break
    }
}`,
          hint: "`switch result { case .success(let verification): ... case .userCancelled: ... case .pending: ... @unknown default: ... }`",
        },
        {
          kind: "explain",
          title: "`Transaction.updates` and `currentEntitlements`",
          body: [
            "Some transactions don't come from your button: renewals, approved Ask to Buy, purchases on another device, refunds, offers redeemed in the App Store. They arrive through `Transaction.updates`, an async sequence you must listen to **from app launch** (in the store's `init`, created in your `App`). If you don't, Xcode warns in the console and you miss purchases.",
            "To know what the user owns **right now**, iterate `Transaction.currentEntitlements`: it yields the latest transaction for every non-consumable and every active subscription. Recompute your state (`isPro`) from it at launch, after each purchase and after each update.",
            "A refund arrives as a transaction whose `revocationDate` isn't `nil`: remove access. Checking it while walking the entitlements is also a cheap defense.",
          ],
          code: swift`private var updates: Task<Void, Never>?

init() {
    updates = Task { [weak self] in
        for await result in Transaction.updates {
            guard let self, let tx = try? self.checkVerified(result) else { continue }
            await self.deliver(tx)
            await tx.finish()
            await self.refreshEntitlements()
        }
    }
}

func refreshEntitlements() async {
    var active: Set<String> = []
    for await result in Transaction.currentEntitlements {
        guard let tx = try? checkVerified(result), tx.revocationDate == nil else { continue }
        active.insert(tx.productID)
    }
    isPro = !active.isDisjoint(with: ProductID.all)
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the sequence that yields what the user is entitled to use today.",
          code: swift`for await result in Transaction.____ {
    guard case .verified(let tx) = result else { continue }
    active.insert(tx.productID)
}`,
          accept: ["^currentEntitlements$"],
          explanation: "`Transaction.currentEntitlements` yields the latest transaction for each non-consumable and each active subscription. Consumables don't show up: your backend owns their balance. `Transaction.all` would be the full history, which isn't what you need to decide access.",
          hint: "Entitlements = what the user currently has a right to.",
          placeholder: "property",
        },
        {
          kind: "predict",
          prompt: "This code simulates what the updates listener processes. What does it print?",
          code: swift`struct Tx {
    let productID: String
    let revoked: Bool
}

let updates = [
    Tx(productID: "pro.monthly", revoked: false),
    Tx(productID: "theme.dark", revoked: true),
    Tx(productID: "theme.neon", revoked: false),
]
let unlocked = updates.filter { !$0.revoked }.map(\.productID)
print(unlocked.count, unlocked.contains("theme.dark"))`,
          options: ["3 true", "2 false", "2 true", "3 false"],
          answer: 1,
          explanation: "`filter { !$0.revoked }` drops the refunded transaction (`theme.dark`), leaving 2. Then `contains(\"theme.dark\")` is `false`. That's exactly what you do with `revocationDate != nil`: a refund removes access.",
        },
        {
          kind: "explain",
          title: "Restore and StoreKit's SwiftUI views",
          body: [
            "With StoreKit 2 purchases sync on their own, but App Review requires a visible **Restore Purchases** button. It calls `AppStore.sync()`, which may prompt for the Apple Account password: so it's only called when the user taps it, never automatically at launch.",
            "Since iOS 17 you get ready-made views: `SubscriptionStoreView(groupID:)` builds a full paywall for a group (plans, prices, free trial), `ProductView(id:)` shows one product and `StoreView(ids:)` a list. They handle loading, purchasing and states for you.",
            "`.storeButton(.visible, for: .restorePurchases)` adds the restore button. You still listen to `Transaction.updates`: the views purchase, but your store still decides access.",
          ],
          code: swift`SubscriptionStoreView(groupID: "21456789") {
    VStack {
        Image(systemName: "note.text")
        Text("Notes Pro: sync, folders and PDF export")
    }
}
.storeButton(.visible, for: .restorePurchases)
.subscriptionStorePolicyDestination(url: termsURL, for: .termsOfService)
.subscriptionStorePolicyDestination(url: privacyURL, for: .privacyPolicy)

// Manual restore in a custom paywall:
Button("Restore Purchases") {
    Task {
        try? await AppStore.sync()
        await store.refreshEntitlements()
    }
}`,
        },
        {
          kind: "write",
          prompt: "Add a \"Restore Purchases\" button to the custom paywall that syncs with the App Store and then recomputes the `store` entitlements.",
          starter: swift`struct PaywallFooter: View {
    let store: StoreManager

    var body: some View {
        HStack {
            // restore button
        }
    }
}`,
          checks: [
            { pattern: "Button\\(", label: "There's a `Button`" },
            { pattern: "Task\\s*\\{", label: "Starts a `Task` for the async work" },
            { pattern: "AppStore\\.sync\\(\\)", label: "Calls `AppStore.sync()`" },
            { pattern: "refreshEntitlements\\(\\)", label: "Recomputes entitlements" },
          ],
          warnings: [
            { pattern: "\\.(task|onAppear)\\s*\\{[^}]*AppStore\\.sync", label: "Don't sync on appear: `AppStore.sync()` may prompt for sign-in" },
          ],
          solution: swift`struct PaywallFooter: View {
    let store: StoreManager

    var body: some View {
        HStack {
            Button("Restore Purchases") {
                Task {
                    try? await AppStore.sync()
                    await store.refreshEntitlements()
                }
            }
        }
    }
}`,
          hint: "`Button(\"Restore Purchases\") { Task { try? await AppStore.sync(); await store.refreshEntitlements() } }`",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "lifecycle-offers",
      title: "Subscription lifecycle and offers",
      goal: "Map each renewal state to an access decision, understand upgrades, cancellations, billing retries and Family Sharing, and pick the right offer for each moment.",
      minutes: 22,
      steps: [
        {
          kind: "explain",
          title: "Renewal states",
          body: [
            "`Product.SubscriptionInfo.Status` gives you a group's state: `.subscribed` (active), `.expired`, `.inGracePeriod` (billing failed but the **grace period** keeps access), `.inBillingRetryPeriod` (billing failed, Apple keeps retrying and the user does **not** have access) and `.revoked` (refunded or lost Family Sharing).",
            "`RenewalState` isn't a closed Swift `enum`: it's a type with static constants, so the `switch` needs a `default`.",
            "Typical decision: access in `.subscribed` and `.inGracePeriod`; in `.inBillingRetryPeriod` no access but an \"update your payment method\" banner, which wins back a lot of subscriptions.",
          ],
          code: swift`let statuses = try await Product.SubscriptionInfo.status(for: groupID)

for status in statuses {
    switch status.state {
    case .subscribed, .inGracePeriod:
        access = .full
    case .inBillingRetryPeriod:
        access = .paymentIssue     // banner: update your payment method
    case .expired, .revoked:
        access = .none
    default:
        access = .none
    }
}`,
        },
        {
          kind: "predict",
          code: swift`enum State { case subscribed, inGracePeriod, inBillingRetryPeriod, expired, revoked }

func hasAccess(_ s: State) -> Bool {
    switch s {
    case .subscribed, .inGracePeriod: return true
    case .inBillingRetryPeriod, .expired, .revoked: return false
    }
}

let states: [State] = [.inGracePeriod, .inBillingRetryPeriod, .subscribed]
print(states.map(hasAccess))`,
          options: ["[true, true, true]", "[false, false, true]", "[true, false, true]", "[true, true, false]"],
          answer: 2,
          explanation: "`map` applies `hasAccess` to each state in order: `.inGracePeriod` → `true` (grace keeps access), `.inBillingRetryPeriod` → `false` (no grace, Apple retries but the user has no access), `.subscribed` → `true`. An array of `Bool` prints as `[true, false, true]`.",
        },
        {
          kind: "explain",
          title: "Upgrade, downgrade, crossgrade and cancellation",
          body: [
            "**Upgrade** (to a higher level): immediate, with a prorated refund of the unused time. **Downgrade**: takes effect at the **next renewal**; until then the current plan stays. **Crossgrade** (same level): immediate if the duration is the same; if it changes (monthly → yearly) it applies at the next renewal.",
            "**Cancelling** on Apple means \"turn off auto-renew\": the user keeps access until the end of the paid period. In `renewalInfo`, `willAutoRenew` becomes `false`; the subscription stays `.subscribed` until it expires.",
            "A pending downgrade shows up in `renewalInfo.autoRenewPreference`: the product that will be charged at the next renewal. Handy for \"you'll switch to Plus on Dec 3\".",
          ],
          code: swift`if case .verified(let renewal) = status.renewalInfo {
    if !renewal.willAutoRenew {
        banner = "Your plan ends on \(expiration.formatted(date: .abbreviated, time: .omitted))"
    } else if renewal.autoRenewPreference != currentProductID {
        banner = "Your plan changes at the next renewal"
    }
}`,
        },
        {
          kind: "predict",
          prompt: "A user pays for Pro monthly on day 1 and cancels on day 10 from Settings. Today is day 20. What should the app show?",
          code: src`Day 1:   buys Pro monthly
Day 10:  cancels from Settings > Subscriptions
Day 20:  opens the app`,
          options: [
            "No access since day 10: she cancelled",
            "Pro access until day 30, with a notice that it won't renew",
            "Pro access plus an automatic refund for the remaining 20 days",
            "`.inBillingRetryPeriod` until she pays again",
          ],
          answer: 1,
          explanation: "Cancelling turns off auto-renew; it doesn't cut access. The state stays `.subscribed` until the paid period ends (day 30) and `willAutoRenew` is `false`. There's no automatic refund; billing retry is for failed charges, not cancellations.",
        },
        {
          kind: "explain",
          title: "Failed charges, price increases and Family Sharing",
          body: [
            "If a renewal fails, Apple enters **billing retry** and keeps retrying for a while (up to 60 days). If you enabled **Billing Grace Period** in App Store Connect, during the first days the user keeps access (`.inGracePeriod`) while the payment gets sorted out.",
            "A **price increase** for existing subscribers is configured in App Store Connect; Apple notifies them and, when their consent is required and they don't agree, the subscription expires at the end of the period. Your app doesn't charge or compute anything.",
            "**Family Sharing** is enabled per product (non-consumables and subscriptions) and can't be turned off afterwards. A family member gets the transaction with `ownershipType == .familyShared`; if they leave the family group, they lose access as a revocation.",
          ],
          code: swift`for await result in Transaction.currentEntitlements {
    guard case .verified(let tx) = result else { continue }
    if tx.ownershipType == .familyShared {
        // Access via Family Sharing: don't offer "manage subscription"
        isFamilyMember = true
    }
}`,
        },
        {
          kind: "fill",
          prompt: "Detect that the user has access because a family member bought the plan.",
          code: swift`if transaction.ownershipType == .____ {
    showFamilyBadge = true
}`,
          accept: ["^familyShared$", "^\\.familyShared$"],
          explanation: "`ownershipType` is `.purchased` for whoever paid and `.familyShared` for family members. Use it to adjust the UI: a family member can't manage or cancel that subscription.",
          hint: "family + Shared.",
          placeholder: "case",
        },
        {
          kind: "explain",
          title: "Offers: introductory, promotional, codes and win-back",
          body: [
            "**Introductory**: for new subscribers. Three modes: free trial (`.freeTrial`), discounted price per period (`.payAsYouGo`) or a discounted one-time upfront payment (`.payUpFront`). Each user gets **one per group**: check `isEligibleForIntroOffer` before showing \"7 days free\".",
            "**Promotional**: for current or lapsed subscribers (retention, \"come back for 50% off\"). **Your server** signs it with a key from App Store Connect; the app passes it in `purchase(options:)`. **Offer codes**: codes you hand out (marketing, support) redeemed in the App Store or in the app.",
            "**Win-back** (iOS 18): offers for former subscribers configured in App Store Connect; Apple surfaces them in the App Store and StoreKit exposes them in the app. Match the offer to the moment: acquisition (intro), retention (promotional), campaigns (codes), recovery (win-back).",
          ],
          code: swift`let sub = product.subscription
let eligible = await sub?.isEligibleForIntroOffer ?? false

if eligible, let intro = sub?.introductoryOffer, intro.paymentMode == .freeTrial {
    ctaTitle = "Try it free"
} else {
    ctaTitle = "Subscribe for \(product.displayPrice)"
}

// Promotional: your server signs the parameters
let s = try await api.signOffer(productID: product.id, offerID: "comeback50")
let result = try await product.purchase(options: [
    .promotionalOffer(offerID: s.offerID, keyID: s.keyID, nonce: s.nonce,
                      signature: s.signature, timestamp: s.timestamp)
])`,
        },
        {
          kind: "predict",
          prompt: "Last year a user took the free trial of **Pro monthly**, paid two months and cancelled. Today he's looking at **Pro yearly**, in the same group, also with 7 days free. What happens?",
          code: swift`let eligible = await proYearly.subscription?.isEligibleForIntroOffer ?? false
// same group as Pro monthly`,
          options: [
            "He's eligible: the trial is per product",
            "He's eligible because more than a year has passed",
            "He's only eligible if he redeems an offer code",
            "Not eligible: introductory offers are one per group, `eligible` is `false`",
          ],
          answer: 3,
          explanation: "Introductory offer eligibility is **per subscription group**, not per product or per time window. He already used it in that group, so `isEligibleForIntroOffer` is `false` and the UI must show the regular price. To win him back you use a promotional offer, a code or win-back.",
        },
        {
          kind: "explain",
          title: "`AppTransaction`: from paid app to freemium",
          body: [
            "If your app was paid and becomes free with a subscription, people who already bought it must keep what they paid for. `AppTransaction.shared` returns, signed by Apple, when and with which version the user first got the app.",
            "`originalAppVersion` is the **build number** (`CFBundleVersion`) of that first download, not the marketing version. Compare it against the build where you went freemium. In sandbox it's always `\"1.0\"`, keep that in mind when testing.",
          ],
          code: swift`func checkLegacyPurchase() async {
    guard let result = try? await AppTransaction.shared,
          case .verified(let appTx) = result else { return }

    // Build 120 = first freemium version
    if let build = Int(appTx.originalAppVersion), build < 120 {
        hasLegacyPro = true
    }
}`,
        },
        {
          kind: "write",
          prompt: "Write `func access(for state: Product.SubscriptionInfo.RenewalState) -> Access` returning `.full` for subscribed and grace period, `.paymentIssue` for billing retry and `.none` otherwise (include `default`).",
          starter: swift`enum Access { case full, paymentIssue, none }

func access(for state: Product.SubscriptionInfo.RenewalState) -> Access {
    // your code
    return .none
}`,
          checks: [
            { pattern: "switch\\s+state", label: "Switches over the state" },
            { pattern: "case\\s+\\.subscribed\\s*,\\s*\\.inGracePeriod|case\\s+\\.inGracePeriod\\s*,\\s*\\.subscribed", label: "Subscribed and grace period grant access" },
            { pattern: "case\\s+\\.inBillingRetryPeriod\\s*:\\s*\\n?\\s*return\\s+\\.paymentIssue", label: "Billing retry returns `.paymentIssue`" },
            { pattern: "default\\s*:", label: "Includes `default` (`RenewalState` isn't a closed enum)" },
          ],
          warnings: [
            { pattern: "\\.inBillingRetryPeriod[^\\n]*:\\s*\\n?\\s*return\\s+\\.full", label: "In billing retry the user doesn't get full access" },
          ],
          solution: swift`enum Access { case full, paymentIssue, none }

func access(for state: Product.SubscriptionInfo.RenewalState) -> Access {
    switch state {
    case .subscribed, .inGracePeriod:
        return .full
    case .inBillingRetryPeriod:
        return .paymentIssue
    default:
        return .none
    }
}`,
          hint: "Three branches plus `default`: `.subscribed, .inGracePeriod` / `.inBillingRetryPeriod` / `default`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "testing-tiers",
      title: "Testing purchases: `.storekit`, sandbox and TestFlight",
      goal: "Know what to test at each tier (`.storekit` file, `SKTestSession`, sandbox on device, TestFlight) and what each one needs for products to load.",
      minutes: 20,
      steps: [
        {
          kind: "explain",
          title: "Four testing tiers",
          body: [
            "**1. `.storekit` file in Xcode**: local products, no App Store Connect, no agreements. Ideal for building the paywall and simulating renewals, refunds, errors and Ask to Buy. **2. Sandbox on device**: real App Store Connect products, a sandbox account, no charge. **3. TestFlight**: a distribution-signed build, also sandbox, no charge. **4. Production**: after approval.",
            "The key idea of this course: **products work in sandbox before they're approved**. They only need to exist in App Store Connect with the Paid Apps agreement active. Apple's reviewer tests your production build by purchasing **in sandbox**.",
            "Each tier catches different bugs: a `.storekit` file won't catch an unsigned agreement or an ID that doesn't exist in App Store Connect; sandbox will.",
          ],
          code: src`Tier           Products from          Requires                         Charges
.storekit      the local file         nothing (not even an account)    no
Sandbox        App Store Connect      Paid Apps agreement + sandbox    no
                                      account
TestFlight     App Store Connect      same + uploaded build            no
Production     App Store Connect      approved products                yes
               (may take up to an hour to appear after approval)`,
        },
        {
          kind: "predict",
          prompt: "In the simulator with `Products.storekit` the paywall shows both plans. On TestFlight, on a real iPhone, the paywall is empty. What's most likely?",
          code: src`Simulator + Products.storekit   -> 2 products
TestFlight on iPhone            -> 0 products, no error`,
          options: [
            "The products don't exist in App Store Connect with those IDs, or the Paid Apps agreement isn't active",
            "TestFlight doesn't support in-app purchases",
            "The products haven't been approved by App Review yet",
            "The tester has to use a real card",
          ],
          answer: 0,
          explanation: "The `.storekit` file only exists in your Xcode; TestFlight queries App Store Connect in sandbox. An empty array with no error points to mismatched IDs or incomplete agreements/banking/tax. TestFlight does support purchases (sandbox, free) and **no** prior approval is needed.",
        },
        {
          kind: "explain",
          title: "The `.storekit` file and the Transaction Manager",
          body: [
            "You create a **StoreKit Configuration File** in Xcode, with local products and groups (or synced with your app in App Store Connect). You enable it in the scheme: **Edit Scheme > Run > Options > StoreKit Configuration**.",
            "With the app running, **Debug > StoreKit > Manage Transactions** opens the Transaction Manager: you see every transaction and can refund it, approve or decline a pending Ask to Buy, or delete it. In the file's editor you can speed up renewals and simulate StoreKit errors.",
            "Transactions at this tier are signed locally by Xcode, not by Apple: your backend can't verify them. Their `environment` is `.xcode`.",
          ],
          code: src`1. File > New > File... > StoreKit Configuration File   (Products.storekit)
   [x] Sync this file with an app in App Store Connect   (optional)
2. Product > Scheme > Edit Scheme... > Run > Options
   StoreKit Configuration: Products.storekit
3. With the app running: Debug > StoreKit > Manage Transactions...
   - Refund / Approve / Decline Ask to Buy / Delete
4. .storekit editor: Editor > Subscription Renewal Rate, simulated errors`,
        },
        {
          kind: "fill",
          prompt: "Which environment does a transaction made in the simulator with a `.storekit` file report?",
          code: swift`if transaction.environment == .____ {
    // signed locally by Xcode: don't send it to the backend
}`,
          accept: ["^xcode$", "^\\.xcode$"],
          explanation: "`AppStore.Environment` has `.xcode`, `.sandbox` and `.production`. Transactions from the `.storekit` file are `.xcode`; sandbox, TestFlight and the build the reviewer tests are `.sandbox`.",
          hint: "It's the IDE's name.",
          placeholder: "environment",
        },
        {
          kind: "explain",
          title: "Automated tests with `SKTestSession`",
          body: [
            "`StoreKitTest` lets you drive the `.storekit` file from tests: `SKTestSession(configurationFileNamed:)` loads it and controls the environment without touching UI. A CI test can purchase, expire or refund with no humans involved.",
            "Key properties: `disableDialogs = true` (purchase without the confirmation sheet), `askToBuyEnabled` (purchases stay pending), `resetToDefaultState()` and `clearTransactions()` to start clean in every test.",
          ],
          code: swift`import StoreKitTest
import XCTest
@testable import Notes

@MainActor
final class StoreManagerTests: XCTestCase {
    var session: SKTestSession!

    override func setUp() async throws {
        session = try SKTestSession(configurationFileNamed: "Products")
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
    }

    func test_purchase_unlocksPro() async throws {
        let store = StoreManager()
        await store.loadProducts()
        let pro = try XCTUnwrap(store.products.first { $0.id == ProductID.proMonthly })

        try await store.purchase(pro)
        await store.refreshEntitlements()

        XCTAssertTrue(store.isPro)
    }
}`,
        },
        {
          kind: "write",
          prompt: "Write `test_askToBuy_leavesPurchasePending`: with the session loaded from `Products`, dialogs disabled and Ask to Buy enabled, buy Pro monthly and assert that `isPending` is `true` and `isPro` is `false`.",
          starter: swift`func test_askToBuy_leavesPurchasePending() async throws {
    let store = StoreManager()
    await store.loadProducts()
    let pro = try XCTUnwrap(store.products.first { $0.id == ProductID.proMonthly })
    // your code
}`,
          checks: [
            { pattern: "askToBuyEnabled\\s*=\\s*true", label: "Enables Ask to Buy" },
            { pattern: "disableDialogs\\s*=\\s*true", label: "Disables dialogs" },
            { pattern: "try\\s+await\\s+store\\.purchase\\(", label: "Purchases through the store" },
            { pattern: "XCTAssertTrue\\(\\s*store\\.isPending", label: "Asserts it's pending" },
            { pattern: "XCTAssertFalse\\(\\s*store\\.isPro", label: "Asserts Pro wasn't unlocked" },
          ],
          warnings: [
            { pattern: "Thread\\.sleep|sleep\\(", label: "Don't wait with `sleep`: the `.pending` result is immediate" },
          ],
          solution: swift`func test_askToBuy_leavesPurchasePending() async throws {
    session.disableDialogs = true
    session.askToBuyEnabled = true
    let store = StoreManager()
    await store.loadProducts()
    let pro = try XCTUnwrap(store.products.first { $0.id == ProductID.proMonthly })

    try await store.purchase(pro)

    XCTAssertTrue(store.isPending)
    XCTAssertFalse(store.isPro)
}`,
          hint: "Set `session.askToBuyEnabled = true` before purchasing.",
        },
        {
          kind: "explain",
          title: "Sandbox on device and TestFlight",
          body: [
            "For sandbox you need: products created in App Store Connect with their exact IDs, an **active Paid Apps agreement**, and a **sandbox account** created under Users and Access > Sandbox. On the iPhone, the sandbox account is set in Settings, under the App Store section (separate from your real Apple Account).",
            "Renewals are **accelerated**: a month lasts about 5 minutes. You can test renewal, expiry and retries in one afternoon. From the sandbox account management you can clear purchase history to become eligible for the free trial again.",
            "**TestFlight** uses sandbox too: testers buy at no charge and renewals are accelerated as well. It's the closest rehearsal of what the reviewer does.",
          ],
          code: src`Sandbox checklist
[ ] Products in App Store Connect (exact IDs, with price)
[ ] Paid Apps agreement: Active (banking + tax complete)
[ ] Sandbox account created (Users and Access > Sandbox)
[ ] iPhone: Settings > Developer > Sandbox Apple Account (iOS 18+; earlier: Settings > App Store)
[ ] Development or TestFlight build (no .storekit file in the scheme)

Accelerated renewal: 1 month of subscription ≈ 5 minutes`,
        },
        {
          kind: "predict",
          prompt: "QA subscribes to Pro monthly in sandbox at 10:00 and leaves it alone. At 10:20 they check the state. What do they see?",
          code: src`10:00  buys Pro monthly (sandbox)
10:20  checks Transaction.currentEntitlements`,
          options: [
            "Still in the first period: almost a month to go",
            "It renewed several times: in sandbox a month lasts about 5 minutes",
            "Expired: sandbox never renews",
            "Their card was charged four times",
          ],
          answer: 1,
          explanation: "In sandbox a month lasts about 5 minutes, so in 20 minutes there were several renewals, each one a new transaction arriving through `Transaction.updates`. There's no real charge: sandbox never touches the user's card.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "server-side",
      title: "The server side",
      goal: "Verify JWS transactions on your backend, process App Store Server Notifications V2, query the App Store Server API, tie purchases to your user with `appAccountToken`, and handle sandbox vs production.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "What the app sends and why you need a backend",
          body: [
            "If your users have accounts (web, Android, another iPhone), the truth about \"is this user Pro?\" lives on your server. The app sends the signed transaction (`verification.jwsRepresentation`, a JWS from Apple) and your backend verifies it before granting access.",
            "`appAccountToken` is a UUID you generate per user and pass in `purchase(options:)`. Apple stores it on the transaction and returns it in notifications: that's how a renewal arriving at 3 AM knows which user in your database it belongs to.",
            "`verifyReceipt` and the app-wide receipt are **deprecated**. The current path is JWS transactions, App Store Server Notifications V2 and the App Store Server API.",
          ],
          code: swift`let result = try await product.purchase(options: [.appAccountToken(user.storeToken)])

if case .success(let verification) = result {
    // JWS signed by Apple: the backend verifies it, it doesn't trust the app
    try await api.registerPurchase(jws: verification.jwsRepresentation)
    let transaction = try checkVerified(verification)
    await transaction.finish()
}`,
        },
        {
          kind: "predict",
          prompt: "Your backend receives `DID_RENEW` at 3 AM. How does it know which of your users to extend?",
          code: src`notificationType: DID_RENEW
data.signedTransactionInfo -> { productId, originalTransactionId, appAccountToken, ... }`,
          options: [
            "By the Apple Account email included in the notification",
            "It can't: it has to wait until the user opens the app",
            "By the `appAccountToken` the app passed when purchasing (or the `originalTransactionId` stored on the first purchase)",
            "By the ID of the device that made the purchase",
          ],
          answer: 2,
          explanation: "Apple never gives you the buyer's email or personal data. The `appAccountToken` you passed in `purchase(options:)` comes back on every transaction of that subscription; you can also store the `originalTransactionId`, which is the same across all renewals.",
        },
        {
          kind: "explain",
          title: "Verifying the JWS with the App Store Server Library",
          body: [
            "Apple publishes the **App Store Server Library** for Node, Python, Java and Swift. `SignedDataVerifier` validates the certificate chain against Apple's roots, the bundle ID and the environment, and decodes the payload.",
            "There are two environments and the data says which one it came from: the transaction's `environment` field is `\"Sandbox\"` or `\"Production\"`. A **production** build used by the reviewer or by TestFlight produces **sandbox** transactions: your backend must accept them (flagged as test), not reject them.",
          ],
          code: src`import { SignedDataVerifier, Environment } from "@apple/app-store-server-library";

const roots = loadAppleRootCertificates(); // Buffer[] with Apple's root certs
const prod = new SignedDataVerifier(roots, true, Environment.PRODUCTION, BUNDLE_ID, APP_APPLE_ID);
const sandbox = new SignedDataVerifier(roots, true, Environment.SANDBOX, BUNDLE_ID);

export async function verifyTransaction(jws: string) {
  try {
    return await prod.verifyAndDecodeTransaction(jws);
  } catch {
    // Review or TestFlight build: sandbox transaction
    return await sandbox.verifyAndDecodeTransaction(jws);
  }
}`,
        },
        {
          kind: "fill",
          prompt: "On the backend, which field of the decoded transaction tells you it came from sandbox?",
          code: src`const tx = await verifyTransaction(jws);
const isTest = tx.____ === "Sandbox";`,
          accept: ["^environment$"],
          explanation: "`environment` is present on every transaction and notification. Store it with the purchase: it lets you accept reviewer and TestFlight purchases without mixing them into real revenue metrics.",
          hint: "Same word as StoreKit's `transaction.environment`.",
          placeholder: "field",
        },
        {
          kind: "explain",
          title: "App Store Server Notifications V2",
          body: [
            "In App Store Connect (App Information) you set **two URLs**: production and sandbox. Apple POSTs a JWS `signedPayload` that you verify just like a transaction. Reply 200 fast; otherwise Apple retries. Deduplicate by `notificationUUID`.",
            "The types you'll handle most: `SUBSCRIBED` (new or resubscribe), `DID_RENEW`, `DID_FAIL_TO_RENEW` (with a `GRACE_PERIOD` subtype if access continues), `GRACE_PERIOD_EXPIRED`, `EXPIRED`, `DID_CHANGE_RENEWAL_STATUS` (auto-renew turned off or on) and `REFUND`.",
            "Notifications are the server's source of truth: the app may never be opened again and your backend still knows the subscription expired.",
          ],
          code: src`app.post("/apple/notifications/production", (req, res) => handle(prod, req, res));
app.post("/apple/notifications/sandbox", (req, res) => handle(sandbox, req, res));

async function handle(verifier, req, res) {
  const n = await verifier.verifyAndDecodeNotification(req.body.signedPayload);
  if (await alreadyProcessed(n.notificationUUID)) return res.sendStatus(200);
  const tx = await verifier.verifyAndDecodeTransaction(n.data.signedTransactionInfo);

  switch (n.notificationType) {
    case "SUBSCRIBED":
    case "DID_RENEW":
      await grant(tx.appAccountToken, tx.productId, tx.expiresDate); break;
    case "DID_FAIL_TO_RENEW":
      await flagBillingIssue(tx.originalTransactionId, n.subtype); break;
    case "GRACE_PERIOD_EXPIRED":
    case "EXPIRED":
      await expire(tx.originalTransactionId); break;
    case "REFUND":
      await revoke(tx.originalTransactionId, tx.revocationDate); break;
    case "DID_CHANGE_RENEWAL_STATUS":
      await saveAutoRenew(tx.originalTransactionId, n.subtype); break;
  }
  await markProcessed(n.notificationUUID);
  res.sendStatus(200);
}`,
        },
        {
          kind: "predict",
          prompt: "A user asks Apple for a refund on their yearly subscription and Apple approves it. What does your system receive?",
          code: src`User -> reportaproblem.apple.com -> refund approved`,
          options: [
            "A `REFUND` notification on the server and, in the app, a transaction with `revocationDate` through `Transaction.updates`",
            "Nothing: you have to poll Apple every day",
            "An `EXPIRED` notification with the `VOLUNTARY` subtype",
            "An email from Apple to the developer with the user's ID",
          ],
          answer: 0,
          explanation: "The refund triggers `REFUND` in your Server Notifications, and on the device the transaction with `revocationDate` arrives through `Transaction.updates`. Both paths must remove access. `EXPIRED` is a normal expiry, not a refund.",
        },
        {
          kind: "explain",
          title: "App Store Server API",
          body: [
            "Besides listening, your server can **ask**. The App Store Server API uses a JWT signed (ES256) with an In-App Purchase key you generate in App Store Connect. It has production and sandbox base URLs.",
            "Everyday endpoints: status of all of a user's subscriptions (from any of their `transactionId`s), transaction history, notification history (to recover the ones you missed) and **consumption information**: when Apple asks for data on a consumable refund request, you report whether the content was used.",
            "The official library also ships a client for this API, so you don't build the JWT by hand.",
          ],
          code: src`# Production: https://api.storekit.itunes.apple.com
# Sandbox:    https://api.storekit-sandbox.itunes.apple.com
# Authorization: Bearer <ES256 JWT signed with your In-App Purchase key>

GET  /inApps/v1/subscriptions/{transactionId}          # status of all subscriptions
GET  /inApps/v2/history/{transactionId}                # transaction history
POST /inApps/v1/notifications/history                  # notifications sent
PUT  /inApps/v1/transactions/consumption/{transactionId}  # data for a refund request`,
        },
        {
          kind: "predict",
          prompt: "Your notifications endpoint was down for two days because of a broken deploy. How do you bring access back in sync?",
          code: src`Monday 09:00 -> Wednesday 09:00: /apple/notifications returned 500`,
          options: [
            "You can't: notifications are lost forever",
            "Ask users to tap \"Restore Purchases\"",
            "Go back to `verifyReceipt` for those two days",
            "Pull notification history and subscription statuses from the App Store Server API, and reprocess",
          ],
          answer: 3,
          explanation: "Apple retries failed notifications for a while, but don't rely on that alone. The App Store Server API exposes notification history and subscription statuses: with those you rebuild what changed. `verifyReceipt` is deprecated and \"restore\" depends on every user acting.",
        },
        {
          kind: "explain",
          title: "Managed alternatives: RevenueCat, Adapty, Qonversion",
          body: [
            "Everything above (verification, notifications, states, cross-platform with Android and web) is a whole backend. **RevenueCat**, **Adapty** and **Qonversion** offer it as a service: their SDK purchases through StoreKit, their server processes notifications and you ask \"does this user have the `pro` entitlement?\".",
            "The trade-off: a third-party dependency, a revenue-based fee above some volume, and purchase data in another system. You still configure products, agreements and review in App Store Connect: the approval cycle is the same.",
          ],
          code: swift`import RevenueCat

Purchases.configure(withAPIKey: "appl_XXXXXXXX", appUserID: user.id)

let info = try await Purchases.shared.customerInfo()
let isPro = info.entitlements["pro"]?.isActive == true`,
        },
        {
          kind: "write",
          prompt: "Write `deliver(_ verification: VerificationResult<Transaction>) async throws`: send the JWS to the backend with `try await api.registerPurchase(jws:)` and only once it responds, verify the transaction with `checkVerified` and call `finish()`.",
          starter: swift`func deliver(_ verification: VerificationResult<Transaction>) async throws {
    // your code
}`,
          checks: [
            { pattern: "jwsRepresentation", label: "Sends `jwsRepresentation`" },
            { pattern: "try\\s+await\\s+api\\.registerPurchase\\(", label: "Waits for the backend response" },
            { pattern: "checkVerified\\(", label: "Verifies the transaction" },
            { pattern: "registerPurchase[\\s\\S]*\\.finish\\(\\)", label: "`finish()` after the backend" },
          ],
          warnings: [
            { pattern: "\\.finish\\(\\)[\\s\\S]*registerPurchase", label: "You finish before the backend records the purchase" },
            { pattern: "verifyReceipt|appStoreReceiptURL", label: "The receipt and `verifyReceipt` are deprecated" },
          ],
          solution: swift`func deliver(_ verification: VerificationResult<Transaction>) async throws {
    try await api.registerPurchase(jws: verification.jwsRepresentation)
    let transaction = try checkVerified(verification)
    await transaction.finish()
}`,
          hint: "If `registerPurchase` throws, the function exits before `finish()` and the transaction comes back in `Transaction.updates`.",
        },
        {
          kind: "write",
          prompt: "Write the Node handler `handle(verifier, req, res)`: decode `signedPayload` with `verifyAndDecodeNotification`, skip duplicates by `notificationUUID`, and in the `switch` over `notificationType` handle at least `\"DID_RENEW\"` and `\"REFUND\"`. Reply 200.",
          starter: src`async function handle(verifier, req, res) {
  // your code
}`,
          checks: [
            { pattern: "verifyAndDecodeNotification\\(", label: "Verifies and decodes the notification" },
            { pattern: "notificationUUID", label: "Deduplicates by `notificationUUID`" },
            { pattern: "case\\s+\"DID_RENEW\"", label: "Handles `DID_RENEW`" },
            { pattern: "case\\s+\"REFUND\"", label: "Handles `REFUND`" },
            { pattern: "sendStatus\\(200\\)|status\\(200\\)", label: "Replies 200" },
          ],
          warnings: [
            { pattern: "verifyReceipt", label: "`verifyReceipt` is deprecated" },
            { pattern: "JSON\\.parse\\(\\s*atob|split\\(\"\\.\"\\)", label: "Decoding the JWS by hand doesn't verify the signature" },
          ],
          solution: src`async function handle(verifier, req, res) {
  const n = await verifier.verifyAndDecodeNotification(req.body.signedPayload);
  if (await alreadyProcessed(n.notificationUUID)) return res.sendStatus(200);
  const tx = await verifier.verifyAndDecodeTransaction(n.data.signedTransactionInfo);
  switch (n.notificationType) {
    case "DID_RENEW":
      await grant(tx.appAccountToken, tx.productId, tx.expiresDate);
      break;
    case "REFUND":
      await revoke(tx.originalTransactionId, tx.revocationDate);
      break;
  }
  await markProcessed(n.notificationUUID);
  res.sendStatus(200);
}`,
          hint: "First `verifyAndDecodeNotification`, then the duplicate check, then the `switch`.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "review-cycle",
      title: "Breaking the App Review cycle",
      goal: "Understand why the \"cycle\" between review and product approval doesn't exist, get the first-approval checklist done, and build a paywall that meets guideline 3.1.2.",
      minutes: 25,
      steps: [
        {
          kind: "explain",
          title: "The cycle that doesn't exist",
          body: [
            "The classic worry: \"App Review wants to see the plans working, but the plans only work once approved\". False. Products work in **sandbox** as soon as they exist in App Store Connect with the agreement active. The reviewer installs your production build and purchases **in sandbox**, at no charge.",
            "Your first in-app purchase or subscription is submitted **together with an app version**: on the version page, in the **In-App Purchases and Subscriptions** section, you add it before submitting for review. App Review approves app and products together.",
            "What you need to master isn't a trick, it's a checklist: when the reviewer opens the paywall, products must **load**, be purchasable and unlock the content.",
          ],
          code: src`1. Create products in App Store Connect -> they work in sandbox
2. Test on device and TestFlight (sandbox)
3. Complete metadata + review screenshot -> "Ready to Submit"
4. Version 1.0 > In-App Purchases and Subscriptions > add products
5. Submit the version for review
6. Reviewer: production build + sandbox purchase
7. App and products approved together
8. Production: products may take up to an hour to appear`,
        },
        {
          kind: "predict",
          prompt: "Rejected under guideline 2.1: \"We were unable to locate the in-app purchases\". The attached screenshot shows the paywall with an endless spinner. In your Xcode with `.storekit` everything works. App Store Connect > Business shows the Paid Apps agreement as \"Pending\". Cause?",
          code: src`Guideline 2.1 - Performance - App Completeness
"We were unable to locate the in-app purchases within the app."

Business > Agreements: Paid Apps — Pending (bank account)`,
          options: [
            "Products must be approved before submitting the app",
            "Without an active Paid Apps agreement `Product.products(for:)` returns empty; on top of that the app doesn't handle that case",
            "The reviewer has no sandbox account",
            "You need to upload the `.storekit` file to App Store Connect",
          ],
          answer: 1,
          explanation: "With the agreement pending (banking or tax incomplete) StoreKit returns an empty array without an error, and the app keeps spinning. Two problems: complete the agreement, and show an error with retry instead of an infinite spinner. The `.storekit` file only exists in your Xcode and products don't need prior approval.",
        },
        {
          kind: "explain",
          title: "The first-approval checklist",
          body: [
            "Go through it before every submission that includes new products. Every line is a real rejection somebody ate.",
            "Watch the backend: the build the reviewer tests is a **production** build, but their purchases are **sandbox**. If your server only accepts `environment == \"Production\"`, the reviewer pays, gets nothing and rejects you.",
          ],
          code: src`[ ] Paid Apps agreement: Active (Account Holder, banking and tax complete)
[ ] Each product: name, description, price, availability,
    localizations and review screenshot -> "Ready to Submit"
[ ] Products added to the version (In-App Purchases and Subscriptions)
[ ] Product IDs in code == App Store Connect, character by character
[ ] Backend accepts sandbox transactions from a production build
[ ] Paywall meets 3.1.2: plan, duration, price, what happens after
    the trial, Restore, Terms of Use (EULA) and Privacy Policy
[ ] Terms and Privacy also in the app metadata
[ ] If products fail to load: error + Retry, never a blank screen
[ ] Reviewer notes: where the paywall is, demo account,
    where unlocked content shows`,
        },
        {
          kind: "predict",
          prompt: "The reviewer buys Pro and the app keeps showing the paywall. This is your backend. What do you change?",
          code: src`const tx = await prod.verifyAndDecodeTransaction(jws);
if (tx.environment !== "Production") {
  return res.status(400).send("invalid environment");
}
await grant(user, tx.productId, tx.expiresDate);`,
          options: [
            "Nothing: the reviewer has to use a real card",
            "Send the reviewer an offer code",
            "Also accept sandbox transactions (verifying with the sandbox environment) and flag them as test",
            "Disable signature verification in production",
          ],
          answer: 2,
          explanation: "The reviewer's production build purchases in **sandbox**. Your backend must verify with the sandbox verifier when appropriate and grant access, storing `environment` to keep it out of real revenue. You never turn off signature verification.",
        },
        {
          kind: "explain",
          title: "A paywall that passes guideline 3.1.2",
          body: [
            "For auto-renewable subscriptions the paywall must show, **before** purchase: plan name and duration, the full price (the amount charged, clearly visible, not just \"works out to X per month\"), what happens when the free trial ends (\"7 days free, then $X per month\"), a **Restore Purchases** button, and links to the **Terms of Use (EULA)** and **Privacy Policy**.",
            "Those links go **in the app and in the metadata** (the Privacy Policy URL field, and Apple's standard EULA or your own, in the description or the EULA field). The free trial can't be more prominent than the price to be paid.",
          ],
          code: swift`VStack(spacing: 12) {
    Text(product.displayName).font(.title2.bold())
    if let intro = product.subscription?.introductoryOffer, isEligible {
        Text("Free for \(periodText(intro.period)), then \(product.displayPrice) per month")
    } else {
        Text("\(product.displayPrice) per month. Renews automatically.")
    }
    Button("Subscribe") { Task { try await store.purchase(product) } }
    Button("Restore Purchases") { Task { try? await AppStore.sync() } }
    HStack {
        Link("Terms of Use", destination: termsURL)
        Link("Privacy Policy", destination: privacyURL)
    }
    .font(.footnote)
}`,
        },
        {
          kind: "write",
          prompt: "Complete `PlanCard` so it meets 3.1.2: plan name, price via `displayPrice` with \"per year\", a purchase button, a Restore button using `AppStore.sync()`, and a `Link` to `termsURL` and to `privacyURL`.",
          starter: swift`struct PlanCard: View {
    let product: Product
    let store: StoreManager
    let termsURL: URL
    let privacyURL: URL

    var body: some View {
        VStack {
            Text("Go Pro!")
            Button("Subscribe") { Task { try await store.purchase(product) } }
        }
    }
}`,
          checks: [
            { pattern: "product\\.displayName", label: "Shows the plan name" },
            { pattern: "product\\.displayPrice", label: "Shows the price via `displayPrice`" },
            { pattern: "AppStore\\.sync\\(\\)", label: "Restore button with `AppStore.sync()`" },
            { pattern: "Link\\([^\\n]*termsURL", label: "Link to Terms of Use" },
            { pattern: "Link\\([^\\n]*privacyURL", label: "Link to Privacy Policy" },
          ],
          warnings: [
            { pattern: "\"[^\"\\n]*(\\$|USD|ARS)\\s?\\d", label: "Hardcoded price: use `displayPrice`" },
          ],
          solution: swift`struct PlanCard: View {
    let product: Product
    let store: StoreManager
    let termsURL: URL
    let privacyURL: URL

    var body: some View {
        VStack {
            Text(product.displayName)
            Text("\(product.displayPrice) per year. Renews automatically.")
            Button("Subscribe") { Task { try await store.purchase(product) } }
            Button("Restore Purchases") { Task { try? await AppStore.sync() } }
            HStack {
                Link("Terms of Use", destination: termsURL)
                Link("Privacy Policy", destination: privacyURL)
            }
        }
    }
}`,
          hint: "Add `Text(product.displayName)`, the price, the restore button and two `Link(..., destination:)`.",
        },
        {
          kind: "explain",
          title: "When products fail to load: error with retry",
          body: [
            "The reviewer may test on a bad network, at a moment when StoreKit is slow, or with an agreement that just lapsed. If your paywall stays blank or shows a button that does nothing, rejection is guaranteed.",
            "Model the state explicitly: loading, failed, empty (also an error) and loaded. On error, a clear message and a **Retry** button.",
          ],
          code: swift`switch store.state {
case .loading:
    ProgressView()
case .failed:
    RetryView("We couldn't load the plans") { await store.loadProducts() }
case .loaded(let products) where products.isEmpty:
    RetryView("No plans available right now") { await store.loadProducts() }
case .loaded(let products):
    ForEach(products) { PlanCard(product: $0, store: store, termsURL: termsURL, privacyURL: privacyURL) }
}`,
        },
        {
          kind: "fill",
          prompt: "Complete the condition that treats an empty StoreKit result as an error.",
          code: swift`case .loaded(let products) where products.____:
    RetryView("No plans available right now") { await store.loadProducts() }`,
          accept: ["^isEmpty$"],
          explanation: "`Product.products(for:)` returns `[]` without an error when agreements are missing or IDs don't match. `where products.isEmpty` turns that into a visible state with retry instead of an empty list.",
          hint: "The `Array` property that says it has no elements.",
          placeholder: "property",
        },
        {
          kind: "explain",
          title: "Reviewer notes, and life after the first approval",
          body: [
            "In **App Review Information** write concrete notes: where the paywall is, a demo account if there's a login, what gets unlocked and where to see it. When you reply to a rejection in App Review, say what you changed and in which build, with screenshots.",
            "After the first approval, new products can be submitted **on their own**, without a new binary, as long as the app can already display them (for example, if it reads IDs from your server or uses `SubscriptionStoreView(groupID:)`, which shows the whole group).",
          ],
          code: src`App Review Information > Notes

Paywall: Settings > "Go Pro", or tap "Export PDF".
Login: demo@acme.com / Review2026! (account with sample data).
Plans: Pro monthly and Pro yearly, with 7 days free.
Subscribing unlocks Export PDF and Folders (Notes tab).
Restore Purchases: at the bottom of the paywall.
Plans load with StoreKit 2 from App Store Connect (sandbox).`,
        },
        {
          kind: "predict",
          prompt: "The app is already approved and shows plans with `SubscriptionStoreView(groupID:)`. You want to add a **Pro six-month** plan to the same group. What do you do?",
          code: swift`SubscriptionStoreView(groupID: "21456789")
    .storeButton(.visible, for: .restorePurchases)`,
          options: [
            "Create the product, complete it and submit it for review on its own, no new binary",
            "Wait for the next version: a new product always needs a binary",
            "Create a new group so it doesn't affect the current ones",
            "Add the ID to a `.storekit` file and upload it",
          ],
          answer: 0,
          explanation: "After the first approval, products are submitted independently. Since `SubscriptionStoreView(groupID:)` shows every product in the group, the six-month plan appears without code changes. If the IDs were hardcoded in the app, you would need a new version.",
        },
        {
          kind: "predict",
          prompt: "Rejected under guideline 3.1.2: \"missing a functional link to the Terms of Use (EULA)\". The paywall already links Privacy. What do you fix?",
          code: src`Guideline 3.1.2 - Business - Payments - Subscriptions
"...missing a functional link to the Terms of Use (EULA)
 in the app binary and in the app metadata."`,
          options: [
            "Only the App Store description",
            "Only the binary: a `Link` in the paywall is enough",
            "Switch the subscriptions to non-renewing",
            "Both: a `Link` to Terms in the paywall and the EULA in the metadata (description or EULA field)",
          ],
          answer: 3,
          explanation: "The message says \"in the app binary **and** in the app metadata\". The link goes in the paywall (new build) and the EULA in the metadata: Apple's standard one linked in the description, or your own in the EULA field. Replying with both changes clears the rejection.",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────
    {
      id: "final-challenge",
      title: "Final challenge: Notes Pro end to end",
      goal: "Bring the whole course together: a complete `StoreManager`, a paywall that passes 3.1.2, and the diagnosis of two real rejections.",
      minutes: 35,
      steps: [
        {
          kind: "explain",
          title: "The scenario",
          body: [
            "**Notes Pro** has a \"Premium\" group with Pro monthly and Pro yearly, 7 days free and its own backend. The first version with subscriptions was rejected twice and the team believes they need to \"wait for the products to be approved\".",
            "Your job: write the `StoreManager` (load, purchase, listen to updates, entitlements, restore), the paywall with `SubscriptionStoreView`, and diagnose both rejections. Use the names from the lessons: `ProductID.all`, `checkVerified`, `deliver`.",
          ],
          code: src`Premium group (21456789)
  Level 1  com.acme.notes.pro.monthly   7 days free
  Level 1  com.acme.notes.pro.yearly    7 days free

Rejection 1: 2.1  "unable to locate the in-app purchases" / purchase with no effect
Rejection 2: 3.1.2 incomplete paywall`,
        },
        {
          kind: "write",
          prompt: "Write `StoreManager` (`@MainActor @Observable`): `loadProducts()` with `Product.products(for:)`, `purchase(_:)` handling `.success`/`.userCancelled`/`.pending` and finishing after `deliver`, a `Transaction.updates` listener created in `init`, `refreshEntitlements()` over `Transaction.currentEntitlements` that skips revoked ones, and `restore()` with `AppStore.sync()`.",
          starter: swift`import StoreKit
import Observation

@MainActor
@Observable
final class StoreManager {
    private(set) var products: [Product] = []
    private(set) var isPro = false
    private(set) var isPending = false

    // your code
}`,
          checks: [
            { pattern: "Product\\.products\\(for:", label: "Loads products" },
            { pattern: "\\.purchase\\(options:\\s*\\[\\s*\\.appAccountToken\\(", label: "Purchases with `appAccountToken`" },
            { pattern: "case\\s+\\.pending", label: "Handles `.pending`" },
            { pattern: "case\\s+\\.userCancelled", label: "Handles `.userCancelled`" },
            { pattern: "\\binit\\([\\s\\S]*Transaction\\.updates", label: "Listens to `Transaction.updates` from `init`" },
            { pattern: "Transaction\\.currentEntitlements", label: "Computes entitlements" },
            { pattern: "revocationDate\\s*==\\s*nil", label: "Skips revoked transactions" },
            { pattern: "deliver\\([\\s\\S]*\\.finish\\(\\)", label: "`finish()` after delivering" },
            { pattern: "AppStore\\.sync\\(\\)", label: "Restore with `AppStore.sync()`" },
          ],
          warnings: [
            { pattern: "try!", label: "`try!` crashes on a network error" },
            { pattern: "verifyReceipt|appStoreReceiptURL", label: "The receipt is deprecated: use StoreKit 2" },
          ],
          solution: swift`import StoreKit
import Observation

@MainActor
@Observable
final class StoreManager {
    private(set) var products: [Product] = []
    private(set) var isPro = false
    private(set) var isPending = false
    private var updates: Task<Void, Never>?
    private let userToken: UUID

    init(userToken: UUID = UUID()) {
        self.userToken = userToken
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self, let tx = try? self.checkVerified(result) else { continue }
                await self.deliver(tx)
                await tx.finish()
                await self.refreshEntitlements()
            }
        }
    }

    func loadProducts() async {
        products = (try? await Product.products(for: ProductID.all)) ?? []
    }

    func purchase(_ product: Product) async throws {
        let result = try await product.purchase(options: [.appAccountToken(userToken)])
        switch result {
        case .success(let verification):
            let tx = try checkVerified(verification)
            await deliver(tx)
            await tx.finish()
            await refreshEntitlements()
        case .userCancelled:
            break
        case .pending:
            isPending = true
        @unknown default:
            break
        }
    }

    func refreshEntitlements() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            if let tx = try? checkVerified(result), tx.revocationDate == nil,
               ProductID.all.contains(tx.productID) {
                active = true
            }
        }
        isPro = active
        if active { isPending = false }
    }

    func restore() async {
        try? await AppStore.sync()
        await refreshEntitlements()
    }

    func deliver(_ tx: Transaction) async {
        // Notify the backend / persist the entitlement
    }

    nonisolated func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        guard case .verified(let value) = result else { throw StoreError.failedVerification }
        return value
    }
}`,
          hint: "Start from the StoreKit 2 lesson skeleton: `init` with the updates `Task`, then `loadProducts`, `purchase`, `refreshEntitlements` and `restore`.",
        },
        {
          kind: "write",
          prompt: "Write `PaywallView` with `SubscriptionStoreView(groupID: \"21456789\")`, a visible restore button, and policy destinations for Terms (`.termsOfService`) and Privacy (`.privacyPolicy`).",
          starter: swift`struct PaywallView: View {
    let termsURL: URL
    let privacyURL: URL

    var body: some View {
        // your code
        EmptyView()
    }
}`,
          checks: [
            { pattern: "SubscriptionStoreView\\(groupID:\\s*\"21456789\"", label: "Uses `SubscriptionStoreView` with the group" },
            { pattern: "\\.storeButton\\(\\.visible,\\s*for:\\s*\\.restorePurchases\\)", label: "Visible restore button" },
            { pattern: "subscriptionStorePolicyDestination\\(url:\\s*termsURL,\\s*for:\\s*\\.termsOfService\\)", label: "Link to Terms" },
            { pattern: "subscriptionStorePolicyDestination\\(url:\\s*privacyURL,\\s*for:\\s*\\.privacyPolicy\\)", label: "Link to Privacy" },
          ],
          warnings: [
            { pattern: "EmptyView\\(\\)", label: "The starter's `EmptyView()` is still there" },
          ],
          solution: swift`struct PaywallView: View {
    let termsURL: URL
    let privacyURL: URL

    var body: some View {
        SubscriptionStoreView(groupID: "21456789") {
            VStack {
                Image(systemName: "note.text")
                Text("Notes Pro: folders, sync and PDF")
            }
        }
        .storeButton(.visible, for: .restorePurchases)
        .subscriptionStorePolicyDestination(url: termsURL, for: .termsOfService)
        .subscriptionStorePolicyDestination(url: privacyURL, for: .privacyPolicy)
    }
}`,
          hint: "Chain `.storeButton(.visible, for: .restorePurchases)` and two `.subscriptionStorePolicyDestination(url:for:)`.",
        },
        {
          kind: "predict",
          prompt: "Rejection 1. The reviewer could purchase (the payment sheet appeared and confirmed), but export stays locked. The backend logs say this. What do you fix?",
          code: src`POST /iap/transactions  400  "verification failed: INVALID_ENVIRONMENT"
  bundleId=com.acme.notes  environment=Sandbox  build=1.0 (42) App Store`,
          options: [
            "Ask Apple to approve the products before resubmitting",
            "Change the Product IDs because the reviewer can't find them",
            "Make the backend fall back to the sandbox environment when production verification fails, granting access and flagging the purchase as test",
            "Have the app skip sending the transaction to the backend in App Store builds",
          ],
          answer: 2,
          explanation: "Products loaded and the purchase went through: it's not an approval or ID problem. The backend only verifies against production and the reviewer's purchase is sandbox. With the sandbox fallback (and storing `environment`), the reviewer gets what they bought. Skipping the backend breaks your source of truth.",
        },
        {
          kind: "predict",
          prompt: "Rejection 2 (3.1.2). This is the current paywall. Which change makes it approvable?",
          code: src`[  TRY IT FREE  ]                 (huge button)
Unlock all of Notes Pro
                                  (9 pt grey text, at the very bottom:)
                                  "then the current price applies"`,
          options: [
            "Remove the free trial and resubmit",
            "Show plan, duration and full price clearly (\"7 days free, then $X per month\"), Restore, Terms and Privacy",
            "Add a confirmation alert before the payment sheet",
            "Explain in the reviewer notes that the price is in the App Store",
          ],
          answer: 1,
          explanation: "3.1.2 requires users to know what they're buying before paying: plan name and duration, the price charged, what happens when the trial ends, Restore, and links to Terms and Privacy. The trial can't overshadow the price. No need to drop the offer or add extra dialogs.",
        },
      ],
    },
  ],

  // ───────────────────────────────────────────────────────────────
  flashcards: [
    {
      id: "fc-product-types",
      front: "What are the four in-app purchase types?",
      back: "Consumable (used up, your backend credits it), non-consumable (forever, restorable), auto-renewable subscription (in a group, one active per group) and non-renewing subscription (fixed time, your backend computes expiry).",
    },
    {
      id: "fc-group-levels",
      front: "What are levels inside a subscription group for?",
      back: "They define upgrade and downgrade. Level 1 is the highest value. Moving up is immediate with a prorated refund; moving down applies at the next renewal; same level is a crossgrade.",
    },
    {
      id: "fc-empty-products",
      front: "`Product.products(for:)` returns `[]` without an error. What do you check?",
      back: "Paid Apps agreement active with banking and tax complete (number one cause), IDs identical to App Store Connect, products created and, locally, that the scheme has the right `.storekit` file.",
      code: "let products = try await Product.products(for: ProductID.all)\nif products.isEmpty { /* error + Retry */ }",
    },
    {
      id: "fc-purchase-results",
      front: "What three results does `product.purchase()` return?",
      back: "`.success(VerificationResult<Transaction>)` (verify, deliver, `finish()`), `.userCancelled` (not an error) and `.pending` (Ask to Buy or SCA: arrives later via `Transaction.updates`).",
    },
    {
      id: "fc-finish",
      front: "When do you call `transaction.finish()`?",
      back: "After delivering the content (saving the entitlement, crediting on the backend). If you finish first and delivery fails, the user paid and got nothing.",
    },
    {
      id: "fc-updates",
      front: "Why listen to `Transaction.updates` from app launch?",
      back: "Because renewals, approved Ask to Buy, purchases from another device, refunds and unfinished transactions arrive even if nobody taps your buy button.",
    },
    {
      id: "fc-restore",
      front: "What does the Restore Purchases button do with StoreKit 2?",
      back: "Calls `AppStore.sync()` and recomputes entitlements. It's required for review and only called when the user taps it, since it may prompt for sign-in.",
    },
    {
      id: "fc-grace-retry",
      front: "Difference between `.inGracePeriod` and `.inBillingRetryPeriod`?",
      back: "In both, billing failed and Apple retries. In grace (if enabled in App Store Connect) the user keeps access; in billing retry they don't, and you should show \"update your payment method\".",
    },
    {
      id: "fc-intro-eligibility",
      front: "How many introductory offers can a user redeem?",
      back: "One per subscription group. Check `isEligibleForIntroOffer` before showing \"free trial\".",
      code: "let eligible = await product.subscription?.isEligibleForIntroOffer ?? false",
    },
    {
      id: "fc-offers",
      front: "Promotional, offer code and win-back: when to use each?",
      back: "Promotional: retain or recover subscribers, signed by your server. Offer code: campaigns and support, redeemed in the App Store or in the app. Win-back (iOS 18): former subscribers, surfaced by Apple and StoreKit.",
    },
    {
      id: "fc-test-tiers",
      front: "What does each testing tier need?",
      back: "`.storekit`: nothing external. Sandbox: products in App Store Connect, Paid Apps agreement and a sandbox account. TestFlight: the same (also sandbox, no charge). Production: approval; products may take up to an hour.",
    },
    {
      id: "fc-review-sandbox",
      front: "Which environment does the App Review reviewer purchase in?",
      back: "Sandbox, on your production build. Products don't need to be approved to load; your backend must accept sandbox transactions.",
    },
    {
      id: "fc-notifications",
      front: "V2 notifications your backend can't skip",
      back: "`SUBSCRIBED`, `DID_RENEW`, `DID_FAIL_TO_RENEW`, `GRACE_PERIOD_EXPIRED`, `EXPIRED`, `DID_CHANGE_RENEWAL_STATUS` and `REFUND`. Two URLs (production and sandbox), reply 200, deduplicate by `notificationUUID`.",
    },
    {
      id: "fc-app-account-token",
      front: "What is `appAccountToken` for?",
      back: "A UUID of yours per user, passed in `purchase(options:)`. It comes back in transactions and notifications, so your backend knows which account each purchase belongs to.",
      code: "try await product.purchase(options: [.appAccountToken(user.storeToken)])",
    },
    {
      id: "fc-commission",
      front: "How much does Apple keep?",
      back: "30% standard; 15% in the Small Business Program (under USD 1M a year) and on subscriptions after a subscriber's first year. Physical goods and services used outside the app don't use IAP. External link rules vary by region and change often: check the current guidelines.",
    },
  ],

  // ───────────────────────────────────────────────────────────────
  exam: [
    {
      id: "ex-empty-paywall",
      question: "First submission with subscriptions. On TestFlight the paywall loads fine for the team, but a week ago the Account Holder changed the bank and the Paid Apps agreement went to \"Pending\". The reviewer reports they can't find the purchases. What happened?",
      options: [
        "Products must be approved before the reviewer can see them",
        "With the agreement pending `Product.products(for:)` returns empty for everyone, the reviewer included",
        "The reviewer uses production and the products only exist in sandbox",
        "TestFlight uses a different product database than App Review",
      ],
      answer: 1,
      explanation: "An active agreement is required for StoreKit to return products, in sandbox and production alike. Once it went pending, the app stopped getting products with no error. Fix it by completing the agreement, and the app should show an error with retry.",
    },
    {
      id: "ex-hardcoded-price",
      question: "A user in Mexico complains that the paywall says \"USD 4.99\" but the payment sheet charges in pesos. What's the fix?",
      code: "Text(\"Pro monthly: USD 4.99\")",
      options: [
        "Add a per-country switch with the price in each currency",
        "Convert USD with an exchange-rate API",
        "Put the price in the product description in App Store Connect",
        "Show `product.displayPrice`, formatted in the user's storefront currency",
      ],
      answer: 3,
      explanation: "`displayPrice` reflects the storefront's actual price and updates itself when you change prices. Custom tables or conversions drift and can also break 3.1.2 by showing a price different from what's charged.",
    },
    {
      id: "ex-finish-early",
      question: "This code sells coins (consumable). Support gets complaints: \"I paid and never got my coins\", almost always on a bad network. What's the bug?",
      code: "let tx = try checkVerified(verification)\nawait tx.finish()\ntry await api.creditCoins(tx.id)",
      options: [
        "`finish()` runs before crediting: if the backend fails, the transaction is already finished and won't be retried",
        "It's missing `AppStore.sync()` after purchasing",
        "Consumables can't be verified",
        "It should use `Transaction.all` instead of `checkVerified`",
      ],
      answer: 0,
      explanation: "An unfinished transaction comes back in `Transaction.updates` and lets you retry delivery. Finishing it first means that if `creditCoins` fails, the purchase is charged and lost. Credit first, then `finish()`.",
    },
    {
      id: "ex-consumable-restore",
      question: "A user reinstalls the app and taps Restore. They had a \"No ads\" non-consumable and had bought 500 coins. What comes back through StoreKit?",
      options: [
        "Both",
        "Nothing: restore only works for subscriptions",
        "\"No ads\"; your backend must keep the coins",
        "Only the coins, since they were the latest purchase",
      ],
      answer: 2,
      explanation: "Non-consumables appear in `Transaction.currentEntitlements` and are restored. Consumables aren't: once finished, the balance is your backend's job, tied to the user's account.",
    },
    {
      id: "ex-downgrade",
      question: "A subscriber on the Family plan (level 1, monthly) picks Individual (level 2, monthly) on day 5. What should the app show?",
      options: [
        "Individual from now on plus a prorated refund",
        "Family until the next renewal; Individual starts then",
        "Both subscriptions until the end of the month",
        "An error: you can't move down a level",
      ],
      answer: 1,
      explanation: "Moving to a lower level is a downgrade: it applies at the next renewal. Until then Family stays; `renewalInfo.autoRenewPreference` shows the upcoming product, useful to let the user know.",
    },
    {
      id: "ex-billing-retry",
      question: "You enabled Billing Grace Period. A user's card is declined at renewal. What sequence of states do you see if she never updates her payment method?",
      options: [
        "`.inGracePeriod` (with access) → `.inBillingRetryPeriod` (no access) → `.expired`",
        "`.expired` right away",
        "`.revoked` → `.expired`",
        "`.inBillingRetryPeriod` (with access) → `.inGracePeriod` (no access)",
      ],
      answer: 0,
      explanation: "First, grace keeps access while Apple retries. When grace ends (`GRACE_PERIOD_EXPIRED` on the server) it stays in billing retry without access, and if the retries fail it ends up `.expired`. `.revoked` is for refunds or Family Sharing.",
    },
    {
      id: "ex-intro-offer",
      question: "The paywall shows \"7 days free\" to everyone. A user who already used the trial on another plan in the same group taps it and the payment sheet charges full price. How do you prevent the complaint?",
      options: [
        "Create a new group for each plan",
        "Always show the full price and never the trial",
        "Issue an automatic refund",
        "Check `isEligibleForIntroOffer` and show the trial only when it's `true`",
      ],
      answer: 3,
      explanation: "Introductory offers are one per group. `isEligibleForIntroOffer` tells you whether it applies to this user; if not, the CTA shows the price. Promising a trial that won't apply also risks a 3.1.2 rejection.",
    },
    {
      id: "ex-ci-ask-to-buy",
      question: "You want a CI test verifying that with Ask to Buy the app shows \"waiting for approval\" without unlocking Pro. How?",
      options: [
        "With a minor's sandbox account on a CI device",
        "On TestFlight, asking a tester to turn on Ask to Buy",
        "`SKTestSession` with the `.storekit` file, `disableDialogs = true` and `askToBuyEnabled = true`, asserting `isPending` and `!isPro`",
        "With a `Product` mock that returns `.pending`",
      ],
      answer: 2,
      explanation: "`SKTestSession` controls the local StoreKit environment from a test, no UI or accounts. `Product` can't be instantiated by hand, and sandbox or TestFlight need people.",
    },
    {
      id: "ex-backend-sandbox",
      question: "To \"prevent fraud\", the backend rejects every transaction whose `environment` isn't `\"Production\"`. What happens on the next review submission?",
      options: [
        "Nothing: the reviewer purchases in production",
        "The reviewer purchases in sandbox, the backend rejects it and nothing unlocks: rejection",
        "Apple approves anyway because the payment sheet worked",
        "The app doesn't compile in Release",
      ],
      answer: 1,
      explanation: "The reviewer uses your production build with sandbox purchases. The backend must verify the signature in the right environment and accept sandbox (flagged), not reject it. Signature verification is already the fraud defense.",
    },
    {
      id: "ex-verify-receipt",
      question: "You inherited a backend that validates with `verifyReceipt`, sending the app's base64 receipt. What's the recommended migration?",
      options: [
        "The app sends `jwsRepresentation`, the server verifies it with the App Store Server Library and processes Server Notifications V2",
        "Keep `verifyReceipt` and add a second call for sandbox",
        "Base64-decode the JWS without verifying, since it comes from Apple",
        "Move all logic to the client with `currentEntitlements` and shut the backend down",
      ],
      answer: 0,
      explanation: "`verifyReceipt` is deprecated. The current model: JWS transactions verified with the official library, V2 notifications and the App Store Server API. Decoding without verifying the signature means accepting forgeable data.",
    },
    {
      id: "ex-refund-access",
      question: "A user got a refund for their yearly subscription and still uses Pro in the app and on the web. What's missing?",
      options: [
        "Calling `AppStore.sync()` on every launch",
        "Asking Apple to close the user's account",
        "Nothing: after a refund access lasts until the end of the year",
        "Processing the `REFUND` notification on the server and, in the app, removing access for transactions with `revocationDate`",
      ],
      answer: 3,
      explanation: "The refund arrives as `REFUND` on the server and as a transaction with `revocationDate` through `Transaction.updates`. If neither path handles it, access remains. Automatic `AppStore.sync()` prompts for sign-in and doesn't fix the backend.",
    },
    {
      id: "ex-paywall-312",
      question: "Which of these yearly subscription paywalls meets guideline 3.1.2?",
      options: [
        "\"Unlock everything\" with a \"Continue\" button; the price shows up on the payment sheet",
        "\"Only USD 0.83 per month\" in large type; the yearly charge isn't shown",
        "\"Pro yearly: 7 days free, then USD 9.99 per year, renews automatically\", Restore, Terms and Privacy",
        "Clear price and plan, but Terms and Privacy only on the company website",
      ],
      answer: 2,
      explanation: "You need plan and duration, the price charged, what happens after the trial, Restore, and in-app links to Terms (EULA) and Privacy. Showing only the monthly equivalent of a yearly plan hides the actual charge.",
    },
    {
      id: "ex-new-product",
      question: "The app is already approved and reads Product IDs from a backend endpoint. You want to launch a new yearly plan. What do you do?",
      options: [
        "Create the product, complete metadata and screenshot, submit it for review on its own, and add the ID to the endpoint once approved",
        "Ship a new app version with the new ID",
        "Wait for Apple to approve it automatically without submitting",
        "Create the product in a `.storekit` file and publish it",
      ],
      answer: 0,
      explanation: "After the first approval, products are submitted separately if the app can already display them. Since the IDs come from the backend, no binary is needed. To test before approval, use sandbox and TestFlight.",
    },
    {
      id: "ex-physical-goods",
      question: "A food delivery app wants to charge for orders inside the app. What do you use?",
      options: [
        "A StoreKit consumable per order",
        "A non-renewing subscription",
        "Offer codes",
        "An external processor (Stripe, Apple Pay): these are goods and services consumed outside the app",
      ],
      answer: 3,
      explanation: "IAP is for digital content and services used in the app. Physical goods and real-world services (food, rides, tickets) are charged through external processors or Apple Pay, with no Apple commission.",
    },
    {
      id: "ex-paid-to-freemium",
      question: "Your app was paid up to build 120; from 121 it's free with a subscription. How do you recognize people who bought it?",
      code: "let result = try await AppTransaction.shared",
      options: [
        "By the date of the first transaction in `currentEntitlements`",
        "By `originalAppVersion` on a verified `AppTransaction`: if the original build is below 121, they get Pro",
        "By asking for the purchase receipt by email",
        "By the installed version's `CFBundleShortVersionString`",
      ],
      answer: 1,
      explanation: "`AppTransaction` tells you, signed by Apple, which build (`CFBundleVersion`) first got the app. The installed version is useless: everyone updated. In sandbox `originalAppVersion` is always `\"1.0\"`.",
    },
  ],
};

export default content;
