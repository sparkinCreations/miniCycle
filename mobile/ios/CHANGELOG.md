# miniCycle iOS — Changelog

Changes to the iOS shell (`mobile/ios/`). The **app content** is the web app — its changes
live in `web/CHANGELOG.md`; a payload rebuild (`npm run sync`) picks them up wholesale.
Entries are tagged with the web `APP_VERSION` current at the time.

## [2.312] - 2026-07-21

### First run on real hardware
- App runs on a physical iPhone ("MJ iPhone") via Xcode — verified working.
- Applied Xcode 26.6 recommended project settings (user-script sandboxing, string catalog
  symbols, parallel `-target` builds, warning flags).
- Moved `DEVELOPMENT_TEAM` to the project level so targets inherit it — this was the fix for
  the "Signing for 'App' requires a development team" build failure.

### Branding
- App icon: generated 1024×1024 **opaque** icon from `web/assets/images/logo/pwa-icons/icon-512.png`
  (the same blue checkbox icon the PWA and Android use; alpha stripped — the App Store rejects
  icons with an alpha channel). Replaces the Capacitor placeholder in `AppIcon.appiconset`.
- Splash screen: the icon art centered on a full canvas of its own background blue (`#34b4fc`),
  rendered as 2732×2732 at 1x/2x/3x in `Splash.imageset`. Backgrounds merge seamlessly, so it
  reads as the mark floating on brand blue. Verified live on the simulator.

### Toolchain bring-up (one-time machine setup, recorded for posterity)
- `xcodebuild -runFirstLaunch` — repaired stale Xcode support frameworks
  (`/Library/Developer/PrivateFrameworks` predated Xcode 26.6; the simulator plugin couldn't load).
- `xcodebuild -downloadPlatform iOS` — installed the iOS 26.5 platform (8.5 GB); Xcode had
  never downloaded it, so no iOS destination existed.
- Neither is needed again unless Xcode is upgraded across major versions.

## [2.310] - 2026-07-20

### Initial scaffold
- Created `mobile/ios/` mirroring `mobile/android/`: `capacitor.config.json`
  (`com.sparkincreations.minicycle`), `package.json` (Capacitor 8 + the same 6 plugins:
  app, filesystem, local-notifications, share, splash-screen, status-bar), `.gitignore`.
- Native Xcode project generated with `npx cap add ios --packagemanager SPM` —
  **Swift Package Manager, no CocoaPods**. Plugins resolve via `ios/App/CapApp-SPM/Package.swift`.
- First simulator build succeeded with zero code changes; app installed and booted to the
  first-run welcome screen on the iPhone 17 simulator (safe areas correct — the web app's
  `viewport-fit=cover` + `safe-areas.css` from PWA work handle the notch).

### Shared build engine
- Refactored `web/scripts/build-android-www.cjs` (350 lines) into the shared engine
  `web/scripts/build-capacitor-www.cjs`, parameterized by platform. `build-android-www.cjs`
  and the new `build-ios-www.cjs` are thin shims. Android output verified **byte-identical**
  before/after the refactor. The web→native transform can no longer drift between platforms.
- Added `npm run build:ios` to `web/package.json`.

### Release pipeline
- `update-version.sh --ios` (`-I`): rebuilds the payload, sets `MARKETING_VERSION` to the new
  version (both Debug + Release configs), bumps `CURRENT_PROJECT_VERSION` by 1, runs
  `cap sync ios`. Gated on a successful payload build — same stale-payload protection as
  `--android`.

### Docs
- `README.md`, `docs/IOS_BUILD_AND_DIFFERENCES.md`; `mobile/README.md` updated
  (iOS: Not started → Scaffolded); Android doc references updated for the shared engine.

### Notable non-events (things that needed NO changes)
- `web/modules/platform/capacitorBridge.js` ships verbatim: the Android back-button listener
  never fires on iOS, `StatusBar.setBackgroundColor` safely no-ops, notifications/share/
  filesystem plugins are cross-platform.
- No iOS-specific CSS beyond hiding the automated-test tab (`ios-overrides.css`, same rule
  as Android's).
