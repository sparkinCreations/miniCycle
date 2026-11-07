# Browser Compatibility Matrix

> **Comprehensive browser support for miniCycle**

**Last verified:** Nov 6 2026

> **Status:** Reference. The browser floor is defined by code, not by this page:
> the feature gate at the bottom of `<head>` in `web/miniCycle.html`. If this page
> and the gate disagree, the gate wins.

---

## Browser Support Overview

The release build is compiled by esbuild with `target: es2020`
(`web/scripts/build-web.cjs`). esbuild leaves optional chaining (`?.`) and nullish
coalescing (`??`) as written at that target, so the shipped module graph needs an
engine that parses them. The feature gate checks exactly that, plus `globalThis`,
`Promise` and `fetch`, and sends any browser that fails to the frozen Lite version.

| Engine | Lowest version the gate admits | Why |
|--------|-------------------------------|-----|
| **Chromium** (Chrome, Edge, Chrome Mobile, and Chromium-based browsers by their Chromium version) | 80 | `?.` / `??` syntax |
| **Firefox** (desktop and Android) | 74 | `?.` / `??` syntax |
| **Safari** (macOS) / **iOS Safari** | 13.1 (iOS 13.4) | `?.` / `??` syntax |

Those are the gate's **floors**, from the comments beside it in `miniCycle.html`.
They are not a tested range: CI runs the browser suite on current Playwright
Chromium, and on WebKit non-blocking (`npm run test:webkit`). Newer platform
features the app uses — the Popover API on the notification container, CSS
`:has()` — degrade on the older engines inside the admitted band rather than being
gated.

**Built-ins:** esbuild transpiles syntax, not built-ins, so a post-ES2020 built-in
(`Object.hasOwn`, `.at()`, `.replaceAll()`, `.findLast()`) would ship verbatim and
throw on browsers the gate admits. `npm run validate:builtins` gates shipped code
at zero of them.

**Legacy browsers → miniCycle Lite:**
- Anything without `?.`/`??` syntax, `globalThis`, `Promise` or `fetch` (this
  includes IE 11 and iOS 12) is redirected to `lite/miniCycle-lite.html` by the
  gate (`src=feature-gate`).
- Two later safety nets also redirect to Lite: a 60-second load timeout
  (`src=load-timeout`) and a late "the app never started booting" check
  (`src=no-boot` / `src=fallback`).
- `?mode=full` in the URL, or the `miniCycleForceFullVersion` localStorage flag,
  overrides the redirect.

> **Note:** miniCycle Lite is a **static, frozen version** (see [PROJECT_STATS.md](../PROJECT_STATS.md) for version) that provides the core routine-tracking concept without advanced features. It is intentionally NOT maintained or kept in sync with the full app - it exists as a permanent fallback for older devices and slow connections.

### The Lite offer (after boot)

A browser that passes the feature gate is never moved to Lite automatically.
Instead, `modules/utils/deviceDetection.js` (`assessBootPerformance`, called at the
end of UI boot) times each boot and, on a device where the full app is
measurably slow, **asks** whether to switch:

- A boot counts as slow at `BOOT_TIMEOUTS.SLOW_BOOT_LITE_OFFER` after navigation.
  The first boot after an update (it downloads the new build) and a boot in a
  hidden tab are not counted.
- The offer appears after `LIMITS.SLOW_BOOTS_BEFORE_LITE_OFFER` slow boots in a
  row, or after one on a device reporting 2 or fewer cores.
- It says plainly that Lite keeps its own separate list (Lite uses its own
  storage keys; nothing moves over).
- The answer is kept in `settings.deviceCompatibility.liteOffer` and never asked
  again. Choosing *Try Full Version* in Lite (the force-full flag) counts as no.

Until Nov 2026 this was an automatic redirect on every new version, triggered by
user-agent regexes, 2 or fewer cores, or a `3g`-or-slower `effectiveType`. The
user-agent checks were redundant with the feature gate, and the connection check
measured the network at that moment rather than the device.

The packaged apps (iOS/Android shell, desktop) never show the offer and always
run the full app.

---

## Feature Compatibility

### Core Features

All core features run on any browser the gate admits; none has a per-browser
fallback path.

| Feature | Storage / API |
|---------|---------------|
| **Task Management, routines, cycles** | `localStorage` (app data) |
| **Automatic backups** | IndexedDB (`modules/storage/backupManager.js`) |
| **Drag & Drop** | Pointer/touch events; Alt+↑/↓ and the optional move arrows as alternatives |
| **Undo/Redo** | In-memory + persisted undo history |

### PWA Features

| Feature | Notes |
|---------|-------|
| **Service Worker / Offline Mode** | Registered from `boot-sw.js` when `'serviceWorker' in navigator`; works after first visit |
| **Web App Manifest / Add to Home Screen** | Per-browser install UI |
| **Background Sync** | Not used |
| **Push Notifications** | Not used — no push handler in `service-worker.js` |

### Advanced Features

| Feature | Notes |
|---------|-------|
| **Recurring Tasks** | Checked while the app is open (no background execution) |
| **Due Dates / Reminders** | Use the Notifications API (`new Notification`) while the app is open; permission required |
| **Dark Mode, Themes, Export/Import** | No browser-specific code |

---

## Mobile Browser Support

### iOS (Safari)

**Lowest admitted:** iOS 13.4 (Safari 13.1). iOS 12 and older go to Lite.

| Feature | Support | Notes |
|---------|---------|-------|
| **PWA Install** | ✅ | Add to Home Screen |
| **Offline Mode** | ✅ | Works after first visit |
| **Touch Gestures** | ✅ | Long-press, swipe |
| **Notifications** | ⚠️ | Requires user permission |
| **Background Refresh** | ❌ | iOS limitation |

**Known Issues:**
- `navigator.connection` API not available (handled gracefully)
- Background task limitations (recurring tasks are checked only while the app is open)

### Android

**Chrome Mobile:** Chromium 80+ · **Firefox for Android:** 74+ · other
Chromium-based browsers by their Chromium version.

On Android, the post-boot device detection above can route a 2-core device or a
`3g`-or-slower connection to Lite.

---

## JavaScript Features Used

### Syntax

The shipped bundle is ES2020 output. The gate tests the two features at the top
of that range, so every older feature (modules, async/await, classes, arrow
functions) is implied by passing it.

| Feature | Minimum Browser | If missing |
|---------|----------------|------------|
| **Optional chaining / nullish coalescing** | Chrome 80, Firefox 74, Safari 13.1 | Lite (feature gate) |
| **`globalThis`** | Chrome 71, Firefox 65, Safari 12.1 | Lite (feature gate) |
| **`Promise`, `fetch`** | — | Lite (feature gate) |

### Web APIs Used

| API | If missing |
|-----|------------|
| **localStorage** | Required. The gate records `localStorage-blocked` but does not redirect |
| **IndexedDB** | Backups unavailable; app data (localStorage) unaffected |
| **Service Worker** | Online-only |
| **Notifications API** | Reminder/due-date system notifications unavailable |
| **Popover API** | Notifications fall back to normal z-index stacking (`modules/utils/popoverUtils.js`) |

---

## Tested Environments

| What | Engine | Where |
|------|--------|-------|
| Browser suite (`npm test`) | Playwright Chromium | CI, blocking |
| Browser suite (`npm run test:webkit`) | Playwright WebKit | CI, non-blocking |
| Journeys (`npm run test:journey`) | Playwright Chromium | CI, blocking |
| Journeys (`npm run test:journey:webkit`) | Playwright WebKit | Local only, before an iOS release |

Manual testing is on Mac, iPad and iPhone (see `PROJECT_STATS.md`). Firefox and
the older engines inside the admitted band are not tested automatically.

---

## Performance by Browser

Not measured per browser. `npm run perf` (`tests/automated/run-performance-benchmarks.cjs`)
measures boot and module micro-benchmarks on Chromium only; see the
[performance docs](../performance/PERFORMANCE_SUMMARY.md).

---

## Known Browser Issues

### Safari/iOS

**Issue:** `navigator.hardwareConcurrency` may be undefined
- **Impact:** The Lite offer then needs the full slow-boot streak
- **Workaround:** Boolean() checks
- **Status:** Fixed in v1.341

**Issue:** Background task limitations
- **Impact:** Recurring tasks are only checked while the app is open
- **Workaround:** None (iOS limitation)
- **Status:** Documented

**Issue:** iOS 12 (iPhone 5s / 6 / 6 Plus) has `globalThis` but not `?.`
- **Impact:** Until Sep 2026 these devices passed the gate, hit a SyntaxError and
  reached Lite only through the no-boot safety net
- **Status:** Fixed Sep 2026 — the ES2020 syntax canary above the gate

---

## Feature Detection

The checks the app actually makes (all in `miniCycle.html` / `boot-sw.js` /
the modules named):

```javascript
// Feature gate (miniCycle.html, ES3-safe, its own <script> block)
if (!window.Promise || !window.fetch)        → Lite
if (!window.__ES2020SyntaxOk)                → Lite   // set by the syntax canary block
if (typeof globalThis === 'undefined')       → Lite

// Service Worker (boot-sw.js)
if ('serviceWorker' in navigator) { /* register */ }
```

---

## Testing Your Browser

### Quick Compatibility Check

1. Visit miniCycle in your browser
2. Open browser console (F12)
3. Look for any error messages
4. If you landed on Lite, the URL's `reasons=` parameter names the failed check
5. Try core features:
   - Add a task
   - Complete a task
   - Create a routine
   - Export data

### Automated Testing

```bash
npm test             # Chromium
npm run test:webkit  # WebKit
```

---

## Reporting Compatibility Issues

### How to Report

If miniCycle doesn't work in your browser:

1. **GitHub Issue** with "browser compatibility" label
2. Include:
   - Browser name and exact version
   - Operating system and version
   - What doesn't work
   - Browser console errors (F12 → Console)
   - Screenshots if applicable

### Information to Gather

```javascript
// Paste this in browser console:
console.log({
  userAgent: navigator.userAgent,
  browser: navigator.appName,
  version: navigator.appVersion,
  platform: navigator.platform,
  localStorage: 'localStorage' in window,
  indexedDB: 'indexedDB' in window,
  serviceWorker: 'serviceWorker' in navigator
});
```

---

## Recommendations

### For Best Experience

1. **Use latest browser version**
   - Auto-update enabled
   - Security patches current

2. **Desktop:** a current Chromium browser or Safari
   - What CI tests against

3. **Mobile:** Safari (iOS) or Chrome (Android)
   - Native PWA support

4. **Legacy systems:** miniCycle Lite
   - ES5-compatible (static/frozen version)
   - Works on older browsers and slow connections
   - Core features only (no recurring tasks, multiple routines, etc.)
   - **Note:** Lite is intentionally NOT updated - it's a permanent fallback

---

*Report issues on GitHub!*
