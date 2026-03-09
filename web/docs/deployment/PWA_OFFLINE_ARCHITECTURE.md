# PWA Offline Architecture

**Version:** 2.056 (March 2026)
**Status:** Fully implemented and tested on iOS Safari
**Related docs:** [SERVICE_WORKER_UPDATE_STRATEGY.md](./SERVICE_WORKER_UPDATE_STRATEGY.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [UPDATE-VERSION-GUIDE.md](./UPDATE-VERSION-GUIDE.md)

---

## Why This Document Exists

miniCycle is a PWA that must work fully offline. Users add the app to their Home Screen on iOS and expect it to open instantly, even in airplane mode, even days after last use.

Getting offline boot working on iOS required solving **five interconnected problems** — each one masked the next. This document explains the full architecture so future changes don't accidentally regress offline support.

---

## Table of Contents

1. [How the Service Worker Caches Files](#1-how-the-service-worker-caches-files)
2. [The Boot Sequence and Why It Matters](#2-the-boot-sequence-and-why-it-matters)
3. [What Must Be Precached](#3-what-must-be-precached)
4. [The Five Offline Problems (And Their Fixes)](#4-the-five-offline-problems-and-their-fixes)
5. [Netlify-Specific Configuration](#5-netlify-specific-configuration)
6. [CSP (Content Security Policy) Gotchas](#6-csp-content-security-policy-gotchas)
7. [App-Specific Pitfalls](#7-app-specific-pitfalls)
8. [Testing Offline on iOS](#8-testing-offline-on-ios)
9. [FAQ](#9-faq)

---

## 1. How the Service Worker Caches Files

### Two Caches

The SW maintains two caches:

| Cache | Example Name | Purpose |
|-------|-------------|---------|
| **Static** | `miniCycle-static-v895` | Precached during SW install. Contains all boot-critical files. |
| **Dynamic** | `miniCycle-dynamic-v895` | Populated at runtime as files are requested. Lazy cache. |

Both are versioned. When a new SW activates, it creates fresh caches and **keeps the most recent old pair** as a fallback (all older pairs are deleted).

### Cache Key Normalization

All `?v=` query parameters are **stripped** before cache operations:

```
Request:  /modules/core/appInit.js?v=2.056
Cache key: /modules/core/appInit.js
```

This means the same file always occupies one cache slot regardless of what `?v=` parameter was used to request it.

### Three Fetch Strategies

When the SW intercepts a request, it picks one of three strategies:

```
┌─────────────────┐     version mismatch?     ┌──────────────────┐
│   Incoming       │──── YES (+ online) ──────▶│  Network-First   │
│   Request        │                           │  (3s timeout)    │
│                  │──── YES (+ offline) ──────▶│  Offline Fast-   │
│                  │                           │  Path (cache)    │
│                  │──── NO ──────────────────▶│  Stale-While-    │
│                  │                           │  Revalidate      │
└─────────────────┘                           └──────────────────┘
```

- **Network-first** (3s timeout): Only for actual version mismatches (`?v=2.054` when SW has `2.056`). On timeout or failure, falls back to cache.
- **Offline fast-path**: When `needsNetworkFirst` is true but `navigator.onLine` is false, skip the network entirely and serve from cache.
- **Stale-while-revalidate**: For all other requests. Return cached copy immediately, then fetch fresh copy in the background (online only — background fetch is skipped when offline).

### Why Only Version Mismatches Trigger Network-First

In an earlier version, static imports (files loaded by the browser's ES module resolver without `?v=`) also triggered network-first. The problem: iOS loads 40+ modules sequentially during boot. If `navigator.onLine` lies (common on iOS), each file hits a 3-second network timeout. 40 files × 3s = 120 seconds, far exceeding the 20-second boot timeout.

**Fix:** Only actual `?v=` mismatches use network-first. Everything else uses stale-while-revalidate (instant from cache).

---

## 2. The Boot Sequence and Why It Matters

miniCycle loads 114+ ES modules via a 3-phase boot sequence:

```
miniCycle.html
  └─▶ version.js              (sync <script>, sets globalThis.APP_VERSION)
  └─▶ miniCycle-main.js       (async, dynamic import with ?v=)
      └─▶ orchestrator.js     (sequence controller)
          ├─▶ Phase 1: coreBoot.js    — AppState, GlobalUtils, migration
          ├─▶ Phase 2: featureBoot.js — 100+ modules loaded via moduleLoader
          └─▶ Phase 3: uiBoot.js      — event listeners, UI finalization
```

Every dynamic `import()` in this chain uses a version parameter:
```javascript
import(`./coreBoot.js?v=${APP_VERSION}`)
```

The `?v=` is stripped by the SW before cache lookup, so it serves the precached copy.

### The Retry Mechanism

If boot fails, orchestrator retries once:

| Scenario | `?v=` parameter | Why |
|----------|----------------|-----|
| Normal (first attempt) | `?v=2.056` | Matches SW cache version |
| Online retry | `?v=2.056.r2` | Cache-busts to get fresh DI state |
| Offline retry | *(none)* | Drops `?v=` entirely so browser HTTP cache can serve files |

The offline retry strategy exists because iOS may kill the SW between app sessions. Without the SW, the browser's own HTTP cache is the only fallback. Import URLs without `?v=` match what the browser originally cached during online sessions.

---

## 3. What Must Be Precached

The `BOOT_CRITICAL` array in `service-worker.js` lists every file needed for the app to boot. Currently **122 files**:

| Category | Count | Examples |
|----------|-------|---------|
| HTML + manifest | 3 | `miniCycle.html`, `manifest.json` |
| Boot chain | 8 | `orchestrator.js`, `coreBoot.js`, `featureBoot.js`, `moduleLoader.js` |
| Core foundation | 9 | `appState.js`, `appInit.js`, `constants.js`, `diBase.js`, `appContext.js` |
| Utilities | 12 | `globalUtils.js`, `notifications.js`, `errorHandler.js` |
| Task modules | 12 | `taskCore.js`, `taskDOM.js`, `taskEvents.js`, etc. |
| UI modules | 28 | All modals, menus, settings managers |
| Features | 7 | `themeManager.js`, `statsPanel.js`, `achievementsManager.js` |
| Recurring | 15 | All recurring scheduling modules |
| Routine | 5 | `routineLoader.js`, `routineManager.js`, `modeManager.js` |
| Labels + themes | 3 | `labelResolver.js`, `defaultLabels.js`, `themes.js` |
| CSS | 36 | All stylesheets (separate `CSS_FILES` array) |
| Assets | 8 | Fonts, logos, pattern SVG |

### How Precaching Works

During the SW `install` event:

1. Open `miniCycle-static-{version}` cache
2. Call `cache.addAll(CORE)` for non-critical assets (manifests, images, fonts)
3. Call `addAllSafe(cache, BOOT_CRITICAL)` — this fetches files **individually** so one failure doesn't block the rest (unlike `cache.addAll` which is all-or-nothing)
4. Call `addAllSafe(cache, CSS_FILES)` for stylesheets (with `?v=` stripped from keys)

### The Warm Cache Safety Net

iOS can partially fail `cache.addAll()` — some files silently don't cache. After every successful online boot, orchestrator sends `WARM_CACHE` to the SW:

```javascript
navigator.serviceWorker.controller.postMessage({ type: 'WARM_CACHE' });
```

The SW then verifies every boot-critical file exists in cache and fetches any missing ones. Files are stored in **both** static and dynamic caches for redundancy.

### Adding New Modules

When you add a new module that's imported during boot:

1. Add it to `BOOT_CRITICAL` in `service-worker.js`
2. Bump `CACHE_VERSION` in `version.js` (triggers new SW install → fresh precache)
3. If it has a new CSS file, add to `CSS_FILES` too

If you forget step 1, the module will only be available in the dynamic cache after first online use — it won't be precached, and the first offline boot will fail.

---

## 4. The Five Offline Problems (And Their Fixes)

These problems were discovered one at a time over ~10 deployment cycles. Each fix revealed the next problem underneath.

### Problem 1: Cache Destruction When Offline

**Symptom:** App fails offline, then clears all caches, making recovery impossible.

**Root cause:** Three independent systems all deleted caches on boot failure without checking if the user was offline:

1. **Orchestrator retry** → called `attemptCacheRecovery()` → `clearAllCaches()`
2. **HTML failsafe** → after 2 consecutive failures → deleted all caches + unregistered SWs
3. **coreBoot stale detection** → `handleStaleCacheRecovery()` → `clearAllCaches()`

**Fix:** Added `navigator.onLine` guards to all three paths:

```javascript
// orchestrator.js — only attempt cache recovery when online
if (isCacheError(error) && !isRecoveryExhausted() && navigator.onLine) { ... }

// miniCycle.html — skip failsafe nuke when offline
if (fails >= MAX_FAILS && !navigator.onLine) { return; }

// coreBoot.js — attemptCacheRecovery refuses to run offline
if (!navigator.onLine) { return false; }
```

**Principle:** Offline mode is forgiveness mode. A slightly stale app that boots is infinitely better than one that wipes its own caches.

### Problem 2: Sequential Timeout Cascade

**Symptom:** Boot takes 120+ seconds offline, then times out.

**Root cause:** Static imports (no `?v=`) triggered network-first strategy. iOS `navigator.onLine` returns `true` even when offline. Each of 40+ files hit a 3-second network timeout before falling back to cache.

**Fix:** Changed `needsNetworkFirst` to only check for actual version mismatches:

```javascript
// Before (caused timeout cascade):
var needsNetworkFirst = versionMismatch || staticImportWithoutVersion;

// After (instant from cache):
var needsNetworkFirst = versionMismatch;
```

Added offline fast-path for version-mismatch files too:
```javascript
if (needsNetworkFirst && !self.navigator.onLine) {
    // Serve from cache immediately, skip network entirely
}
```

### Problem 3: Incomplete Precache on iOS

**Symptom:** `appInit.js` missing from cache even though it's in `BOOT_CRITICAL`.

**Root cause:** iOS's aggressive process management can partially fail `cache.addAll()`. Some files silently don't cache during SW install.

**Fix:** Added the warm cache mechanism (described above) — after every successful online boot, the SW verifies and fills gaps in the precache. Files are stored in both static and dynamic caches for redundancy.

### Problem 4: iOS Kills the Service Worker

**Symptom:** First offline boot works. Second offline boot fails (same error). Safari's Develop menu shows "Service Workers" section completely absent.

**Root cause:** iOS terminates the SW process when the PWA is backgrounded or closed. On next open, iOS may not restart it. `navigator.serviceWorker.controller` returns a stale reference to the dead process. Without the SW intercepting requests, the browser's own HTTP cache is the only fallback.

**Fix (two parts):**

**a) Netlify headers:** Changed JS/CSS caching from `no-cache` to `max-age=86400`:
```toml
# Before — browser can't serve files offline without revalidation:
Cache-Control = "no-cache, max-age=0"

# After — browser HTTP cache serves files for 24 hours without server:
Cache-Control = "public, max-age=86400"
```

**b) Orchestrator offline retry:** Drop `?v=` parameter entirely so import URLs match what the browser originally cached:
```javascript
// Offline retry: import('appInit.js')       — matches HTTP cache
// Normal:        import('appInit.js?v=2.056') — matches SW cache
```

This required changes in both `orchestrator.js` (builds the `vParam`) and `coreBoot.js` (the `dropVersionParam` / `vSuffix` / `withV` chain that propagates through featureBoot and moduleLoader to all 114+ module imports).

### Problem 5: Legacy Cleanup Deleting Current Files

**Symptom:** First offline boot works. Second offline boot fails. Cache inventory shows `appInit:true` on first boot, `appInit:false` on second. Static cache entry count drops by exactly 1.

**Root cause:** `cleanLegacyAppInitCache()` in `coreBoot.js` was designed to remove an old unversioned `appInit.js` from cache. But precache stores `appInit.js` at the same URL (no `?v=`), so the function deleted the **current, valid** copy on every boot:

```
Boot 1 (online):   precache stores appInit.js ✅
Boot 2 (offline):  loads appInit.js from cache ✅ → cleanLegacy deletes it 💀
Boot 3 (offline):  appInit.js gone → crash 💥
```

**Fix:** Removed the call to `cleanLegacyAppInitCache()`. The stale-cache detection (`typeof setAppInitDependencies !== 'function'`) is the proper mechanism for detecting outdated appInit.js.

---

## 5. Netlify-Specific Configuration

### Cache-Control Headers

The `netlify.toml` header rules use **last-match-wins** ordering. This is critical because `*.js` rules must come before the specific `version.js` and `service-worker.js` overrides.

| File Pattern | Cache-Control | Why |
|-------------|---------------|-----|
| `*.html` | `no-cache, no-store` | HTML must always be fresh. `no-store` required for Safari (ignores `must-revalidate`). |
| `*.css` | `public, max-age=86400` | 24h browser cache. `?v=` in HTML handles cache busting. Needed for offline when SW is dead. |
| `*.js` | `public, max-age=86400` | Same as CSS. **Critical for iOS offline** — without this, the browser refuses to serve cached JS when it can't revalidate. |
| `version.js` | `no-cache, no-store` | Must come AFTER `*.js` rule. Source of truth — must never be stale. |
| `service-worker.js` | `no-cache, no-store` | Must come AFTER `*.js` rule. SW spec recommends no caching. |

### The Safari Memory Cache Problem

Safari has a memory cache that sits **above** the service worker. It ignores `must-revalidate` and `max-age=0`. Only `no-store` reliably prevents Safari from serving stale HTML. This is why HTML files use `no-cache, no-store, must-revalidate` (belt and suspenders).

Reference: https://github.com/w3c/ServiceWorker/issues/1510

### Domain Redirects

All traffic from `minicycleapp.com` (old domain) redirects to `minicycle.app/product.html` with 301 status.

---

## 6. CSP (Content Security Policy) Gotchas

### How It Works

The CSP in `netlify.toml` uses SHA-256 hashes for inline scripts instead of `'unsafe-inline'`. Every `<script>` block in `miniCycle.html` must have its content hashed and the hash listed in the `script-src` directive.

### The Hash Update Rule

**If you change ANY inline `<script>` content in `miniCycle.html`, you MUST recompute its SHA-256 hash and update `netlify.toml`.**

To compute a hash:
```bash
# Extract the script content (everything between <script> and </script>)
# Then:
echo -n "SCRIPT_CONTENT_HERE" | openssl dgst -sha256 -binary | openssl base64 -A
```

The result goes into the CSP as `'sha256-HASH_HERE='`.

### Why This Is Dangerous

- The CSP is only served by Netlify in production — your local Python dev server doesn't send CSP headers
- Tests run against localhost — they never test CSP
- If a hash is wrong, the browser **silently blocks** the inline script
- The boot failsafe script (which recovers from crashes) would be the exact script that's blocked
- You'd deploy, see the app fail, and have no crash recovery because the recovery script itself is blocked

### Which Scripts Have Hashes

As of v2.056, `miniCycle.html` has 12 inline scripts plus 1 generated by `document.write()`. All 13 must have valid hashes in the CSP. The `document.write` script is generated by the version-change auto-clear handler — its content is static (no interpolated values), so the hash is stable.

### Safe Practice

After modifying any inline script in `miniCycle.html`:
1. Compute the new hash
2. Replace the old hash in `netlify.toml`
3. Verify by deploying to a Netlify preview branch and checking the browser console for CSP violations

---

## 7. App-Specific Pitfalls

### The `cleanLegacyAppInitCache()` Trap

A function designed to clean up old cached files was deleting **current** files because precache stores files without `?v=` — the same URL pattern the cleanup function targeted. If you ever write cache-cleanup code, make sure it can distinguish "old unwanted entries" from "current precached entries."

### The `withV()` Propagation Chain

Version parameters flow through a multi-level chain:

```
orchestrator.js     → versionSuffix → vParam
    ↓
coreBoot.js         → dropVersionParam → vSuffix → withV()
    ↓                                      ↓
featureBoot.js      ← withV from coreResult
    ↓
moduleLoader.js     ← withV from coreResult → used for all 114+ module imports
```

If you change how `versionSuffix` works in orchestrator, the change propagates to every module import in the app. The offline retry strategy (`versionSuffix = ''`) depends on this chain working correctly — `coreBoot.js` checks for empty string explicitly because `''` is falsy in JavaScript.

### Static Imports Don't Have `?v=`

When module A does `import { foo } from './B.js'`, the browser loads `B.js` without any query parameters. The SW sees these as requests for `/modules/path/B.js` (no `?v=`). This is fine because:
1. The SW strips `?v=` before cache lookup anyway
2. The stale-while-revalidate strategy serves them from cache instantly

But it means static imports bypass the version-mismatch detection. If you need guaranteed fresh copies of a module, use dynamic imports with `withV()`.

### `navigator.onLine` Is Unreliable on iOS

iOS `navigator.onLine` frequently returns `true` when the device is actually offline (especially on captive portals, flaky WiFi, or shortly after going into airplane mode). Never use it as the sole determinant for "can I access the network?" — use it as a hint, and always have timeout-based fallbacks.

This is why the orchestrator waits 8 seconds for the SW regardless of `navigator.onLine`, and why the SW's stale-while-revalidate has a 3-second fetch timeout with cache fallback.

### The `document.write()` Version-Change Handler

The version-change script in `miniCycle.html` uses `document.write()` — this **stops HTML parsing** before `<link rel="modulepreload">` hints are processed. This prevents the browser from preloading stale modules from the old cache during a version transition.

If you're tempted to replace `document.write()` with something "cleaner," understand that stopping the parser is the entire point.

---

## 8. Testing Offline on iOS

### Setup

1. Deploy to Netlify (or use a Netlify preview branch)
2. Open the app on iPhone in Safari
3. Add to Home Screen (important — PWA behavior differs from Safari tabs)
4. Open the app from Home Screen, use it briefly (triggers SW install + precache)
5. Close the app completely (swipe up from app switcher)

### Testing Procedure

1. Enable airplane mode on the iPhone
2. Open the app from Home Screen — should load fully (**first offline boot**)
3. Close the app completely (swipe up)
4. Open again — should still load (**second offline boot** — this is the critical test)
5. Repeat 2-3 more times to verify stability

### Debugging with Safari

1. Connect iPhone to Mac via USB
2. Open Safari on Mac → Develop menu → [Your iPhone] → [Your App]
3. Check the Console tab for SW logs (cache inventory, fetch strategy logs)
4. Check Application → Service Workers (if this section is absent, iOS killed the SW)
5. Check Application → Cache Storage for entry counts

### What to Look For

**Healthy first offline boot:**
```
📋 Cache [miniCycle-static-v895]: 157 entries | appInit:true constants:true orch:true
📋 Cache [miniCycle-dynamic-v895]: 160 entries | appInit:true constants:true orch:true
📴 Offline fast-path: /styles/main.css
📦 Static import (no version): /modules/core/constants.js
```

**Healthy second offline boot (cache counts stable):**
```
📋 Cache [miniCycle-static-v895]: 157 entries | appInit:true constants:true orch:true
📋 Cache [miniCycle-dynamic-v895]: 160 entries | appInit:true constants:true orch:true
```

**Unhealthy (cache entry removed between boots):**
```
📋 Cache [miniCycle-static-v895]: 156 entries | appInit:false    ← count dropped!
```

If cache counts drop between boots, something is deleting cache entries. Search the codebase for `cache.delete` and `caches.delete`.

---

## 9. FAQ

### Q: I added a new module and offline boot broke. What did I miss?

Add the module to `BOOT_CRITICAL` in `service-worker.js`. If it's a CSS file, add it to `CSS_FILES`. Then bump `CACHE_VERSION` in `version.js` to trigger a fresh precache.

### Q: I changed an inline script in miniCycle.html and production broke. Why?

The CSP uses SHA-256 hashes for inline scripts. You need to recompute the hash and update `netlify.toml`. Local dev won't catch this because the Python server doesn't send CSP headers.

### Q: Why does the app work on first offline boot but not the second?

Something is deleting cache entries during the first boot. Check for:
- Cache cleanup functions running without an offline guard
- The SW's activate handler deleting too many old caches
- `cache.delete()` calls that match current precached URLs

### Q: Why is `version.js` served via `ignoreSearch` fallback?

The HTML loads `version.js` with a cache-buster (`?v=` or `?_cb=`), but the precache stores it without query params. The `ignoreSearch: true` option on `caches.match()` ignores query params and finds the cached copy. This is expected behavior.

### Q: Can I use `no-cache` for JS files in netlify.toml?

**No.** iOS kills the PWA's service worker when the app is backgrounded. When reopened offline, the SW may not restart. Without browser-level caching (`no-cache` requires server revalidation — impossible offline), all module imports fail. The `max-age=86400` setting lets the browser serve cached files for 24 hours without revalidation.

### Q: Why does the orchestrator drop `?v=` on offline retry?

When the SW is dead and the browser falls back to its HTTP cache, import URLs must match what was originally cached. During online sessions, the browser sees requests like `/modules/core/appInit.js?v=2.056` — but the HTTP cache keys include the full URL with query params. On retry, dropping `?v=` produces `/modules/core/appInit.js`, which the browser may have cached at the HTTP level during precache or previous loads (the SW fetches files without `?v=` for `addAllSafe`).

### Q: What's the warm cache and when does it run?

After every successful **online** boot, orchestrator sends a `WARM_CACHE` message to the SW. The SW iterates through all boot-critical files, checks if each exists in the static cache, and fetches any missing ones. This fills gaps from iOS's partially-failing `cache.addAll()`. Files are stored in both static and dynamic caches for redundancy. It only runs when online — offline, it would just produce failed fetches.

### Q: Why doesn't the retry mechanism retry when offline?

Retry exists to re-fetch fresh files from the network. Offline, there's nothing to re-fetch. The retry suffix (`.r2`) would create a cache key mismatch in the SW, potentially causing more harm. Instead, the offline retry drops `?v=` to try the browser's HTTP cache, and if that fails too, shows the error screen immediately rather than wasting time on a doomed retry.

### Q: How do I know if the SW is alive on iOS?

Connect to Safari Develop menu. If the "Service Workers" submenu exists under your device, the SW is running. If the entire submenu is absent, iOS killed the SW process. The diagnostic panel on the error screen also shows `SW:active` vs `SW:none` based on `navigator.serviceWorker.controller` (though this can be a stale reference on iOS).

### Q: Why are there version mismatch warnings on every offline boot?

```
⚠️ Version mismatch detected: "2.055" → "2.056" /styles/main.css
```

This happens when the HTML was cached at version 2.055 but the SW was updated to 2.056. The CSS `<link>` tags in the cached HTML still reference `?v=2.055`, which mismatches the SW's current `APP_VERSION` (2.056). The offline fast-path catches these and serves them from cache anyway. It's cosmetic noise, not an error.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    iPhone / iOS Safari                    │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐   ┌────────────┐ │
│  │  Browser HTTP │    │  Service      │   │  Cache API │ │
│  │  Cache        │    │  Worker       │   │  (static + │ │
│  │  (max-age:    │    │  (may be      │   │   dynamic) │ │
│  │   86400)      │    │   killed by   │   │            │ │
│  │               │    │   iOS)        │   │            │ │
│  └──────┬───────┘    └──────┬───────┘   └─────┬──────┘ │
│         │                   │                  │         │
│         │    ┌──────────────┴──────────────┐   │         │
│         │    │       Fetch Handler          │   │         │
│         │    │                              │   │         │
│         │    │  1. Version mismatch?        │   │         │
│         │    │     → Network-first (3s)     │   │         │
│         │    │     → Offline: fast-path ────┼───┘         │
│         │    │                              │             │
│         │    │  2. Normal request?           │             │
│         │    │     → Stale-while-revalidate─┼───┘         │
│         │    │     → Offline: cache only     │             │
│         │    └──────────────────────────────┘             │
│         │                                                │
│         │    SW dead? Browser falls back to HTTP cache    │
│         └────────────────────────────────────────────────│
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              miniCycle App                         │   │
│  │                                                    │   │
│  │  orchestrator.js                                   │   │
│  │    ├── Online:  import('module.js?v=2.056')       │   │
│  │    ├── Retry:   import('module.js?v=2.056.r2')    │   │
│  │    └── Offline: import('module.js')  ← no ?v=     │   │
│  │                                                    │   │
│  │  After successful boot:                            │   │
│  │    → postMessage({ type: 'WARM_CACHE' })          │   │
│  │    → SW verifies all 122 files are cached          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

                          │
                          ▼

┌─────────────────────────────────────────────────────────┐
│                    Netlify CDN                            │
│                                                          │
│  Cache-Control headers:                                  │
│    *.html           → no-cache, no-store                │
│    *.js, *.css      → public, max-age=86400             │
│    version.js       → no-cache, no-store                │
│    service-worker.js → no-cache, no-store               │
│                                                          │
│  CSP: script-src 'self' 'sha256-...' (13 hashes)       │
└─────────────────────────────────────────────────────────┘
```

---

## Summary of Files Involved

| File | Role in Offline Support |
|------|------------------------|
| `service-worker.js` | Caching strategies, precache, warm cache, offline fast-path, cache inventory diagnostic |
| `modules/boot/orchestrator.js` | Retry logic, `vParam` for offline retry, warm cache trigger, offline error UI, diagnostic panel |
| `modules/boot/coreBoot.js` | `dropVersionParam` / `vSuffix` / `withV()` chain, offline guard on `attemptCacheRecovery()` |
| `modules/boot/featureBoot.js` | Inherits `withV` from coreBoot for all feature module imports |
| `modules/boot/moduleLoader.js` | Uses `withV` for all 114+ module `import()` calls |
| `miniCycle.html` | Boot failsafe (offline guard), version-change auto-clear (`document.write`) |
| `netlify.toml` | Cache-Control headers (critical for iOS), CSP hashes, Safari memory cache workaround |
| `version.js` | Single source of truth for version numbers (APP_VERSION + CACHE_VERSION) |
