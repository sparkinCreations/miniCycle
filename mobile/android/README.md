# miniCycle — Android (Capacitor)

The Android app: a [Capacitor](https://capacitorjs.com/) shell whose WebView loads the
**byte-identical** miniCycle web app (`web/`), bundled into the APK so it works fully offline.

> **Full reference:** packaging rationale, every web-vs-Android difference, the build pipeline,
> and the release workflow live in
> [`../ANDROID_BUILD_AND_DIFFERENCES.md`](../ANDROID_BUILD_AND_DIFFERENCES.md).

## Layout

| Path | What it is | Committed? |
| --- | --- | --- |
| `capacitor.config.json` | App id / name / `webDir` | ✅ |
| `package.json` | Capacitor deps + build scripts | ✅ |
| `www/` | **Generated** web payload (from `web/` via `web/scripts/build-android-www.cjs`) | ❌ gitignored |
| `android/` | Native Gradle/Android Studio project (identity, icons, permissions, signing) | ✅ |
| `android/app/src/main/assets/public/` | Where `cap sync` copies `www/` | ❌ gitignored |

**Never hand-edit `www/`** — it's regenerated from `web/` on every build. Change the web app or
the build script. Native customizations (icons, splash, manifest, signing) go in `android/`.

## Quick start

```bash
cd mobile/android
npm install            # first time only — installs Capacitor
npm run sync           # build the web payload from web/ + cap sync into android/
npm run open           # open in Android Studio → build & run on a device/emulator
```

`npm run sync` is the loop you'll run most: it regenerates `www/` from the current `web/` and
copies it into the native project.

### Command-line builds

These need the **Android SDK** (`ANDROID_HOME` set, e.g. via Android Studio). The web payload
build and `cap sync` work without it — only the Gradle compile needs it.

```bash
npm run assemble:debug     # → debug APK (sideload testing)
npm run assemble:release   # → release AAB (then sign for Play)
```

## App identity

- **Application id:** `com.sparkincreations.minicycle`
- **App name:** miniCycle
- **Permissions:** `INTERNET` only (feedback form → `api.web3forms.com`)
- **Version:** `versionName` in `android/app/build.gradle` tracks `APP_VERSION` (`web/version.js`);
  bump `versionCode` for every Play upload.

## What's NOT here yet

Native bridges (local notifications for reminders, filesystem/share for `.mcyc`, status bar,
splash, hardware back button) are the next phase — see the Roadmap in
[`../ANDROID_BUILD_AND_DIFFERENCES.md`](../ANDROID_BUILD_AND_DIFFERENCES.md#9-roadmap--native-feature-bridges-next-phase).

## Don't

- Don't hand-edit `www/` — it's regenerated.
- Don't commit `www/`, `node_modules/`, the copied `assets/public/`, or any keystore.
- Don't reintroduce the PWA service worker into the payload — assets are bundled; a stale SW
  cache would pin old code. (The build script drops SW registration for this reason.)
