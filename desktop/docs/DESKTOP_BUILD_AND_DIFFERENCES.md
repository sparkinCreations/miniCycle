# Desktop App: Build & Differences from the Web App

> Companion to [`../../mobile/android/docs/ANDROID_BUILD_AND_DIFFERENCES.md`](../../mobile/android/docs/ANDROID_BUILD_AND_DIFFERENCES.md)
> and [`../../mobile/ios/docs/IOS_BUILD_AND_DIFFERENCES.md`](../../mobile/ios/docs/IOS_BUILD_AND_DIFFERENCES.md).
> The three shells share one payload engine; this file covers only what is desktop-specific.

The desktop app is the miniCycle web app, unchanged, running inside an Electron window.
Electron ships its own Chromium, so the app runs on the same engine the Playwright suite
tests against — there is no WebView-vendor drift to track, unlike iOS (WKWebView).

## 1. One transform, three platforms

`web/scripts/build-capacitor-www.cjs` is the shared engine; `build-desktop-www.cjs` is a
one-line shim that calls `run('desktop')`. The desktop entry in `PLATFORMS` differs from
Android/iOS only in its output directory (`desktop/www/`), its overrides stylesheet
(`desktop-overrides.css`) and its "next step" hint. Everything the engine does — drop the PWA
manifest link and the PWA-only inline blocks, drop the external `boot-sw.js` tag, neutralize
the lite/ redirects, rewrite `pages/` + `tests/` links to the live site, prune assets, bundle
the sample routines, legal pages and the Task Order game — applies verbatim. If the transform
needs to change for desktop, change the engine, and Android/iOS get it too.

The shell is not Capacitor. It reuses the Capacitor payload because the requirements are the
same: a bundled, offline app on a private origin with no service worker.

## 2. The app:// origin

`src/main.js` registers `app` as a privileged standard scheme and serves `www/` on
`app://minicycle` (a `protocol.handle` that maps the URL path to a file under `www/`, refuses
anything outside it, and sets a content type from a fixed table). It is not `loadFile()`
because:

- Chromium refuses `<script type="module">` and `fetch()` from a `file://` origin, and the app
  is ~140 native ES modules plus runtime `fetch()`es of `/examples/...`.
- `file://` storage is keyed to the install path. `app://minicycle` is a stable origin, so
  localStorage and IndexedDB (routines, backups, settings) survive reinstalls, updates and a
  moved `.app`.

Consequences the web app can rely on:

| Concern | Web (PWA) | Desktop |
| --- | --- | --- |
| Service worker | registers `service-worker.js` | none; `boot-sw.js` tag dropped, `waitForServiceWorker()` skipped via `isDesktopApp()` |
| `version.js?v=` | query-busted | query ignored by the handler; payload is always current |
| CSP | `netlify.toml` hashes | response header on HTML: `script-src 'self' 'unsafe-inline'` (inline blocks stay inline, as on Capacitor), `connect-src` limited to minicycle.app + web3forms |
| Cross-origin `version.js` | n/a | works — netlify sends `Access-Control-Allow-Origin: *` on it (same reason as the extension) |

## 3. What the web app knows about desktop

`web/modules/platform/desktopBridge.js` is the desktop twin of `capacitorBridge.js`: a pure
leaf module that reads `globalThis.miniCycleDesktop`, which only `src/preload.js` publishes
(via `contextBridge`, so it is a frozen object of facts, not functions). Four call sites use
it, each mirroring an existing `isNativeApp()` check:

| Where | Why |
| --- | --- |
| `utils/updateCheck.js` | `detectUpdateChannel()` returns `'desktop'`; a newer live `version.js` says "Get it from minicycleapp.com" (`noun.desktopDownloadSite`) instead of naming a store |
| `utils/liteVersion.js` | lite/ is not bundled; `goToLiteVersion()` is suppressed |
| `boot/uiBoot.js` | the "Try Lite Version" menu and settings entries are hidden |
| `utils/deviceDetection.js` | the slow-device auto-redirect to lite is suppressed |
| `boot/orchestrator.js` | `waitForServiceWorker()` returns immediately (otherwise `navigator.serviceWorker.ready` hangs for the full 8s timeout on every launch) |

`desktopBridge.js` is statically imported by boot-critical modules, so it is listed in
`BOOT_CRITICAL` in `service-worker.js` (the `test:sw` precache drift guard enforces this).

## 4. Native behaviour with no bridge code

Everything below is a plain web API that Electron's Chromium already provides; `main.js` only
routes the result natively. Nothing is proxied through the preload.

| Feature | How it works on desktop |
| --- | --- |
| Export `.mcyc` | `cycleExportManager` tries `showSaveFilePicker()` first — the File System Access API opens the native Save dialog. The `<a download>` fallback also gets a Save dialog (no `will-download` handler claims it). |
| Import / restore | `<input type="file">` opens the native Open dialog. |
| Share | `navigator.share` does not exist in Electron, so `shareManager` falls through to its "download instead" confirmation, as on any desktop browser. |
| Reminders | `Notification` API → Notification Center (macOS) / Action Center (Windows; needs the `appUserModelId` set in `main.js`). The `setPermissionRequestHandler` grants `notifications` and denies everything else. |
| External links | `target="_blank"` / `window.open` / navigations off `app://` open in the default browser. Legal pages and the game stay in the window. |
| Keyboard | Standard Edit menu roles give Cmd/Ctrl+C/V/Z; View has zoom and full screen; DevTools only in unpackaged runs. |
| Single instance | second launch focuses the existing window. |

## 5. The build pipeline

```
web/                       (source of truth)
  └─ npm run build:desktop ──► desktop/www/        (generated, gitignored)
                                   │
desktop/src/main.js  serves www/ on app://minicycle
desktop/src/preload.js  publishes globalThis.miniCycleDesktop
                                   │
  npm run installers  (electron-builder --mac --win --linux) ──► desktop/dist/
        miniCycle-<ver>-mac-arm64.dmg / .zip
        miniCycle-<ver>-mac-x64.dmg   / .zip
        miniCycle-<ver>-win-x64.exe   (NSIS, per-user, choose directory)
        miniCycle-<ver>-linux-x86_64.AppImage / -arm64.AppImage
        miniCycle-<ver>-linux-amd64.deb       / -arm64.deb
```

- **Version.** electron-builder rejects a two-part version, so `desktop/package.json` carries
  `APP_VERSION.0` (e.g. `2.576.0`). `update-version.sh --desktop` writes it after a
  successful payload build, never before — the same gate the Android/iOS native bumps use.
  The preload passes the shell version to the app as `miniCycleDesktop.shellVersion`; the
  payload's `APP_VERSION` is what "Check for Updates" compares.
- **Smoke boot.** `MINICYCLE_SMOKE=<png> electron .` loads the app, waits, asserts the preload
  global and `APP_VERSION` are present, writes a screenshot and exits 0; a load failure or a
  renderer crash exits 1. With `MINICYCLE_SMOKE_OFFLINE=1` (`npm run smoke:offline`) every http(s)
  request is cancelled at the session level and the run also requires a fetch of the live
  `version.js` to fail — proof the packaged app starts with no network at all. (Chromium's
  `enableNetworkEmulation({ offline: true })` was tried first and did not block renderer
  fetches, so the gate cancels requests instead.) Smoke runs use
  a throwaway profile (`<temp>/minicycle-smoke`), so they never touch real data or collide
  with an open copy on the single-instance lock. `--desktop-dist` runs the offline variant
  before building installers and refuses to package a payload that cannot boot.
- **Windows and Linux from macOS.** electron-builder builds the NSIS installer, the AppImages
  and the .debs on macOS without Wine or a Linux host (it downloads its own toolchains on
  first run). No Windows or Linux machine is needed to build; one is needed to *test*. As of
  Sep 2026 the Linux artifacts have never been run on a real distro — expect the usual
  unknowns there: libnotify for reminders, FUSE for AppImage (or
  `--appimage-extract-and-run`), Wayland vs X11 scaling, GTK portal file dialogs.
- **Icons.** `build/icon.png` is the 512px PWA icon; electron-builder derives `.icns`/`.ico`.
  Replace with a 1024px master when one exists.
- **ELECTRON_RUN_AS_NODE.** VS Code's extension host exports it. The release script and the
  README strip it with `env -u`; do the same in any new launcher.

### Signing and notarization (not set up)

`identity: null` in `electron-builder.yml` keeps the build unsigned on purpose and
`CSC_IDENTITY_AUTO_DISCOVERY=false` stops electron-builder searching the keychain. Until this
is done, macOS users must right-click → Open once (Gatekeeper) and Windows users click through
SmartScreen. To turn it on later:

1. **macOS:** an Apple Developer Program membership (the same one iOS is waiting on), a
   "Developer ID Application" certificate in the keychain, then remove `identity: null`, set
   `hardenedRuntime: true`, add an `entitlements` plist, and set `APPLE_ID` /
   `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` so electron-builder notarizes.
2. **Windows:** a code-signing certificate (an EV or Azure Trusted Signing setup avoids the
   SmartScreen reputation wait); configure `win.signtoolOptions` or `azureSignOptions`.

## 6. Maintenance rules

- **Never hand-edit `www/`.** It is regenerated on every `npm start`, `npm run smoke` and
  `npm run dist`, and by `update-version.sh --desktop`.
- **Keep the preload surface to facts.** A function exposed on `miniCycleDesktop` is a function
  the web app must guard on web, extension, iOS and Android. Reach for it only when a web API
  genuinely cannot do the job (tray, global shortcuts, auto-start — all deferred from v1).
- **Add desktop cases beside native ones.** When a new `isNativeApp()` guard goes into the web
  app, ask whether desktop needs the same (`isDesktopApp()`), and say so in the comment.
- **`npm run smoke` after touching `main.js` or the engine.** It is the only automated check
  that the payload boots inside the shell; the Playwright suite runs the web app in a browser.

## See also

- [`../README.md`](../README.md) — quick start and release commands
- [`../../web/scripts/build-capacitor-www.cjs`](../../web/scripts/build-capacitor-www.cjs) — the shared payload engine
- [`../../web/docs/deployment/BUILD_PROCESS.md`](../../web/docs/deployment/BUILD_PROCESS.md) — the web release pipeline the desktop snapshot is cut from
