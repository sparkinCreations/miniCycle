# Mobile Applications

Native mobile builds of miniCycle.

## Editions

| Folder | Status | What it is |
| --- | --- | --- |
| [`android/`](./android) | ✅ Working | [Capacitor](https://capacitorjs.com/) app — a WebView shell wrapping the byte-identical web app (`web/`), bundled for offline. Opens like any native app. |
| `ios/` | ⬜ Not started | Reserved for a future iOS build (Capacitor would share the same `www/` payload). |

## Android

The Android app loads the **byte-identical** miniCycle web code (`web/modules`, `web/styles`,
…) inside a Capacitor WebView, bundled into the APK so it runs fully offline. The web payload
(`mobile/android/www/`) is **generated** from `web/` by `web/scripts/build-android-www.cjs` —
the same "generate the platform shell from `web/`" pattern as the Chrome `full/` extension — so
it never drifts from the actively-developed app.

```bash
cd mobile/android
npm install        # first time only
npm run sync       # generate www/ from web/ + cap sync
npm run open       # open in Android Studio to build & run
```

- **Quick start:** [`android/README.md`](./android/README.md)
- **Full reference** (web-vs-Android differences, build pipeline, releases):
  [`android/docs/ANDROID_BUILD_AND_DIFFERENCES.md`](./android/docs/ANDROID_BUILD_AND_DIFFERENCES.md)

## Why Capacitor (not React Native / native)

miniCycle is a mature web app. Capacitor reuses that codebase verbatim and adds native APIs
(notifications, filesystem, share) via plugins — no rewrite, no second source of truth. This
matches the existing multi-platform strategy: one web app, thin generated shells per platform
(`chrome/`, `mobile/android/`).

## `shared/`

The repo-root [`shared/`](../shared) folder is reserved for platform-agnostic logic extracted
once real duplication appears across platforms. The Android app doesn't need it yet — it runs
the web modules directly.
