# iOS App: Build & Differences from the Web App

This document explains how the **iOS** app (`mobile/ios/`) relates to the web app (`web/`):
how it's packaged, how it differs, how it's built, and how releases flow.

It is the iOS counterpart to
[`../../android/docs/ANDROID_BUILD_AND_DIFFERENCES.md`](../../android/docs/ANDROID_BUILD_AND_DIFFERENCES.md).
**Read that one first** — the iOS app is deliberately the same shape, and this doc only spells
out what is *different from Android* rather than repeating the shared story.

> **The web payload (`mobile/ios/www/`) is generated, not hand-written.** It is produced from
> `web/` by `web/scripts/build-ios-www.cjs` and is **gitignored** — never edit it by hand; the
> next build wipes it and regenerates it.
>
> **The native project (`mobile/ios/ios/`) IS committed and hand-maintained.** It holds the app
> identity, icons, splash, Info.plist, and signing config. Capacitor created it once
> (`npx cap add ios --packagemanager SPM`); after that it's yours to customize. `npx cap sync`
> only copies `www/` into it.

---

## 1. One transform, two platforms

The payload transform is **identical** to Android's: both `build-android-www.cjs` and
`build-ios-www.cjs` are thin shims over the shared engine
**`web/scripts/build-capacitor-www.cjs`** (drop the PWA/SW inline blocks, neutralize the lite
fallback, rewrite `pages/`+`tests/` links to the live site, bundle `legal/` + examples, prune
assets). The only per-platform differences are the output directory and the injected overrides
stylesheet (`ios-overrides.css` vs `android-overrides.css` — both currently just hide the
automated-test tab).

If you change the transform (e.g. after restructuring `miniCycle.html` inline scripts), you are
changing it for **both** platforms at once — re-verify the `RULES` table in
`build-capacitor-www.cjs` and rebuild both payloads.

The complete web-vs-app differences table in the Android doc (§3) applies verbatim to iOS,
with these substitutions:

| Area | Android | iOS |
|---|---|---|
| **Local origin** | `http://localhost` | `capacitor://localhost` (WKWebView custom scheme) |
| **Native project** | Gradle (`android/`) | Xcode (`ios/App/`), **SPM** — no CocoaPods |
| **`cap sync` copies `www/` to** | `android/app/src/main/assets/public/` | `ios/App/App/public/` |
| **Distribution** | signed AAB → Google Play | signed archive → TestFlight / App Store |
| **Version fields** | `versionName` / `versionCode` (build.gradle) | `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` (pbxproj) |
| **Hardware back button** | Bridged (closes top layer, double-press exit) | n/a — iOS has no back button; the bridge listener simply never fires |
| **Status-bar background color** | `StatusBar.setBackgroundColor` | Not supported on iOS — the call is optional-chained + `.catch`ed in the bridge, so it's a safe no-op; `setStyle` (light/dark text) works |
| **Permissions** | Manifest-merged (`POST_NOTIFICATIONS` etc.) | Runtime prompts only; local notifications need no Info.plist usage string |

**Safe areas (notch / Dynamic Island / home indicator):** already handled. The web app ships
`viewport-fit=cover` and a dedicated `styles/layout/safe-areas.css` (plus `env(safe-area-inset-*)`
usage across layout/components) from its iOS-PWA support, so the WebView content clears the
notch and home indicator without any iOS-specific override.

---

## 2. The build pipeline

Same two layers as Android:

**Layer 1 — generate the web payload.**

```bash
cd web && npm run build:ios          # web/ → mobile/ios/www/
```

**Layer 2 — sync into the native project & build.**

```bash
cd mobile/ios
npm install                          # first time only
npm run sync                         # build:www + npx cap sync ios   (the common loop)
npm run open                         # open ios/App in Xcode → build & run
```

### Prerequisites

- **Full Xcode** (Mac App Store; 15+). The Command Line Tools alone are NOT enough.
  After installing, point the toolchain at it once:

  ```bash
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  sudo xcodebuild -license accept
  ```

- **No CocoaPods.** The project was created with `--packagemanager SPM`; plugin packages live
  in `ios/App/CapApp-SPM/Package.swift` and Xcode resolves them on first open. If you add a
  Capacitor plugin later: `npm install @capacitor/<plugin>` here, then `npx cap sync ios`
  regenerates `Package.swift` — no `pod install` ever.
- **Signing:** in Xcode → App target → Signing & Capabilities, pick your team. A free Apple ID
  can run on the simulator and a personal device; TestFlight/App Store needs the paid
  Developer Program.

### Web payload without Xcode

`npm run build:ios` and `npx cap sync ios` both work **without** Xcode installed — only the
compile needs it. So the release script can keep the payload + version stamps fresh on any
machine.

---

## 3. The native project (`mobile/ios/ios/App/`)

Generated once by `npx cap add ios --packagemanager SPM`; committed and customized thereafter.

- **App identity:** bundle id `com.sparkincreations.minicycle`, display name "miniCycle"
  (Xcode target / Info.plist).
- **Version:** `MARKETING_VERSION` tracks `APP_VERSION` (`web/version.js`).
  `CURRENT_PROJECT_VERSION` is the build number — App Store Connect requires it to increase
  for every upload of the same marketing version. Both appear twice in `project.pbxproj`
  (Debug + Release) and must stay in lockstep; `update-version.sh --ios` patches both.
- **Icons & splash:** `ios/App/App/Assets.xcassets` — currently the **Capacitor template
  placeholders**; brand them before any release (see §5 Open items).
- **Config:** `mobile/ios/capacitor.config.json` (`appId`, `appName`, `webDir: "www"`,
  iOS background color). `cap sync` copies a derived config into the app bundle.

---

## 4. How updates & releases work

- **Single version source.** `web/version.js` (`APP_VERSION`) drives everything. On release:

  ```bash
  cd web && ./scripts/update-version.sh --auto --ios              # bump + rebuild iOS payload
  cd web && ./scripts/update-version.sh --auto --ios --android --chrome --tag   # all platforms
  ```

  The `--ios` stage regenerates `www/`, sets `MARKETING_VERSION` to the new version, bumps
  `CURRENT_PROJECT_VERSION` by 1, and runs `cap sync ios` — gated on a successful payload build
  so the project can never be stamped with a version while running stale code (same contract
  as `--android`).

- **Release build:** `npm run sync`, then in Xcode: Product → Archive → Distribute
  (TestFlight first, then App Store review). There is no command-line assemble script yet —
  archiving requires Xcode's signing UI anyway on first setup.
- **Keys stay out of the repo:** signing certificates and provisioning profiles live in your
  Apple Developer account / Keychain, not in the project.

---

## 5. Native feature bridges — iOS notes

All bridges live in `web/modules/platform/capacitorBridge.js` (see the Android doc §9 for the
architecture — runtime proxy, no imports, feature-gated no-ops on web). The same six plugins
are installed here, and the bridge ships byte-identical. iOS-specific behavior:

| Bridge | iOS behavior |
|---|---|
| **Status bar** | `setStyle` (light/dark text) works; `setBackgroundColor` is Android-only and safely no-ops (optional-chained + caught). The bar sits over the app's own safe-area-padded header. |
| **Splash** | `hide()` works as on Android. |
| **Back button** | The `backButton` listener never fires on iOS (no hardware back; users swipe/tap). The double-press-exit path is dead code on iOS — harmless. |
| **Local notifications** | Works; iOS prompts the user on first `requestPermissions()`. No Info.plist entry required for *local* notifications. |
| **Export/share (`.mcyc`)** | Writes to the app cache then opens the iOS share sheet (includes "Save to Files"). Same flow as Android. |

Still open (iOS-specific):

- **App icon + splash branding** — replace the Capacitor template assets in `Assets.xcassets`.
  Easiest path: [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets)
  (`npx @capacitor/assets generate --ios`) from a 1024×1024 source icon.
- **`.mcyc` import** — same gap as Android (file-open / document-type registration not wired);
  import uses the web file picker.
- **"Check for Updates"** — no-op in the app (updates ship via the App Store), same as Android.
- **Device pass** — first run on a real iPhone should sanity-check: safe areas (notch + home
  indicator), status-bar style in dark mode, keyboard behavior over the task input, and the
  share sheet.

---

## 6. Maintenance rules

- **Never hand-edit `mobile/ios/www/`** — it's regenerated. Edit `web/` or the build engine.
- **Don't commit `www/`, `node_modules/`, or `ios/App/App/public/`** — all gitignored.
- **Keep `MARKETING_VERSION` in sync with `APP_VERSION`** and **bump
  `CURRENT_PROJECT_VERSION`** every upload — `update-version.sh --ios` does both.
- **After restructuring `miniCycle.html` inline scripts,** re-verify the `RULES` table in
  `build-capacitor-www.cjs` — it now serves Android AND iOS (and shares the substring
  contract with the Chrome build).
- **Re-run `npx cap sync ios`** after every payload rebuild and after adding any plugin.
- **Stay on SPM** — don't introduce a Podfile; mixed dependency managers in one Xcode project
  is a debugging tarpit.

---

## See also

- [`IOS_APP_ARCHITECTURE.md`](./IOS_APP_ARCHITECTURE.md) — how the code works, tap-to-interactive
- [`BUILD_AND_RUN.md`](./BUILD_AND_RUN.md) — every way to build & run, troubleshooting
- [`APP_STORE_RELEASE.md`](./APP_STORE_RELEASE.md) — what's remaining for the App Store
- [`../CHANGELOG.md`](../CHANGELOG.md) — iOS shell history
- [`../README.md`](../README.md) — quick-start for the iOS project
- [`../../README.md`](../../README.md) — the `mobile/` folder overview
- [`../../android/docs/ANDROID_BUILD_AND_DIFFERENCES.md`](../../android/docs/ANDROID_BUILD_AND_DIFFERENCES.md)
  — the shared packaging story, complete differences table, bridge architecture, plugin wiring
- `web/scripts/build-capacitor-www.cjs` — the shared web-payload build engine (authoritative)
