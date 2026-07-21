# miniCycle — iOS (Capacitor)

The iOS app: a [Capacitor](https://capacitorjs.com/) shell whose WKWebView loads the
**byte-identical** miniCycle web app (`web/`), bundled into the app so it works fully offline.

> **Docs:**
> - [`docs/IOS_APP_ARCHITECTURE.md`](./docs/IOS_APP_ARCHITECTURE.md) — how the code works (layers, boot flow, bridge, versioning)
> - [`docs/BUILD_AND_RUN.md`](./docs/BUILD_AND_RUN.md) — dev loop, CLI builds, release stamping, troubleshooting
> - [`docs/IOS_BUILD_AND_DIFFERENCES.md`](./docs/IOS_BUILD_AND_DIFFERENCES.md) — every web-vs-iOS difference + the payload transform
> - [`docs/APP_STORE_RELEASE.md`](./docs/APP_STORE_RELEASE.md) — what's remaining to ship to the App Store
> - [`CHANGELOG.md`](./CHANGELOG.md) — iOS shell history

## Layout

| Path | What it is | Committed? |
| --- | --- | --- |
| `capacitor.config.json` | App id / name / `webDir` | ✅ |
| `package.json` | Capacitor deps + build scripts | ✅ |
| `www/` | **Generated** web payload (from `web/` via `web/scripts/build-ios-www.cjs`) | ❌ gitignored |
| `ios/` | Native Xcode project (identity, icons, splash, signing) — **SPM-based, no CocoaPods** | ✅ |
| `ios/App/App/public/` | Where `cap sync` copies `www/` | ❌ gitignored |

**Never hand-edit `www/`** — it's regenerated from `web/` on every build. Change the web app or
the build script. Native customizations (icons, splash, Info.plist, signing) go in `ios/`.

## Quick start

```bash
cd mobile/ios
npm install            # first time only — installs Capacitor
npm run sync           # build the web payload from web/ + cap sync into ios/
npm run open           # open in Xcode → build & run on a simulator/device
```

`npm run sync` is the loop you'll run most: it regenerates `www/` from the current `web/` and
copies it into the native project.

### Prerequisites

- **Full Xcode** (App Store), not just the Command Line Tools — required to compile and run.
  After installing: `sudo xcode-select -s /Applications/Xcode.app`.
- **No CocoaPods needed** — the project uses Swift Package Manager (`ios/App/CapApp-SPM`);
  Xcode resolves the packages on first open.
- An **Apple Developer account** (free for simulator/personal-device runs; paid for
  TestFlight/App Store).

## App identity

- **Bundle id:** `com.sparkincreations.minicycle`
- **App name:** miniCycle
- **Version:** `MARKETING_VERSION` in the Xcode project tracks `APP_VERSION` (`web/version.js`);
  bump `CURRENT_PROJECT_VERSION` (the build number) for every App Store Connect upload.
  `update-version.sh --ios` does both automatically.

## Native features

Native behavior is bridged through `web/modules/platform/capacitorBridge.js` (feature-gated, so
the web app is unaffected) — the same bridge as Android. Already wired: **reminder
notifications** (local-notifications), **routine export/share** of `.mcyc` (filesystem + share
sheet), **status-bar theming**, and **splash hide**. The Android hardware-back-button handler
never fires on iOS (no back button) and is inert. See
[`docs/IOS_BUILD_AND_DIFFERENCES.md`](./docs/IOS_BUILD_AND_DIFFERENCES.md) for iOS-specific
bridge notes and what's still open (app icon/splash branding, `.mcyc` import).

## Don't

- Don't hand-edit `www/` — it's regenerated.
- Don't commit `www/`, `node_modules/`, the copied `App/public/`, or signing certificates.
- Don't add CocoaPods to this project — it's SPM-based on purpose (one less toolchain).
- Don't reintroduce the PWA service worker into the payload — assets are bundled; a stale SW
  cache would pin old code. (The build script drops SW registration for this reason.)
