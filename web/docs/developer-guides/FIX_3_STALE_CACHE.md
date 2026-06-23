# Fix 3 — The Stale-Cache (Service Worker) Fix

> Why the app could fail to boot on already-installed machines after a deploy,
> and how the service worker + page were changed to prevent and self-heal it.

## TL;DR

- The app code is correct. Affected machines were being served **old, cached
  copies** of two module files (`themeManager.js`, `recurringPanel.js`) that no
  longer matched the rest of the app — the "Frankenstein cache."
- Earlier fixes (1, 2, 4) made a bad boot *survivable* and gave slow machines more
  time. They never touched caching, which is the actual cause here.
- The service worker already had a freshness guard, but it **only applied to
  unversioned requests** — it skipped exactly the `?v=`-tagged dynamic imports that
  were failing. That was the bug.
- The fix is small: one condition in the service worker, a page-side "is the
  controlling worker stale?" self-heal, and one manual cache-clear for machines
  already wedged.
- **v2.249 follow-up:** a *new class* of stale-cache bug where the page reported
  "up to date" while actually rendering an **old cached HTML/CSS build**. Root
  cause: health checks trusted `APP_VERSION` (from `version.js`, which the SW
  serves *network-first* on a `?v=` mismatch — so it reads the latest deployed
  version even on a stale build). The fix reads the **build version** (the loaded
  HTML's `<meta app-version>`) instead, and self-heals when it lags the server.

## The symptoms

```
SyntaxError: ...themeManager.js does not provide an export named 'updateThemeColor'
TypeError:   loadPanelSubModules is not a function   (from recurringPanel.js)
```

Both are version splits: a *fresh* consumer (`preferencesManager.js`,
`recurringIntegration.js`) loaded a *stale cached* dependency that predated the
export/function it needed. The repo is correct — `themeManager.js` exports
`updateThemeColor` and `recurringPanel.js` exports `loadPanelSubModules` — so the
browser must have run old cached copies. It did, from the service worker cache.

## Root cause

Three facts in `service-worker.js` combine into the bug:

1. **The cache key strips `?v=`** (`~line 730`: `cacheUrl.searchParams.delete('v')`).
   So `recurringPanel.js?v=2.231`, `?v=2.235`, `?v=2.235.r2`, etc. all share one
   cache slot. Bumping the version number can never dislodge a stored file, and the
   boot-retry `.r2` cache-buster doesn't either.
2. **Old caches are kept** as an offline fallback, and a broad `caches.match()`
   returns the first match across *all* caches — which can be the stale one.
3. **The freshness guard skipped versioned requests.** The guard (`preferCurrentCaches`)
   said "look in the current cache first," but was gated on `!requestVersion`, so a
   versioned dynamic import like `recurringPanel.js?v=2.235` fell through to the
   unsafe broad search and got the stale copy.

Caches are versioned per release (`miniCycle-static-vNNNN` / `miniCycle-dynamic-vNNNN`),
which is what makes "prefer the current cache" a safe, fresh choice.

## The fix

### Change 1 — close the cache hole (`service-worker.js`)

Drop the `!requestVersion &&` gate so the freshness guard covers versioned module/CSS
requests too:

```javascript
// before
var preferCurrentCaches = !requestVersion && (isModuleFile || url.pathname.endsWith('.css'));
// after
var preferCurrentCaches = (isModuleFile || url.pathname.endsWith('.css'));
```

The guard looks in the current `STATIC_CACHE` / `DYNAMIC_CACHE` first; on a
current-cache miss while **online**, module files return `null` so the file is
fetched fresh from the network instead of an old-version copy. Offline, a stale
copy still beats a dead boot, so the broad match is allowed.

### Change 2 — page-side self-heal (`miniCycle.html`)

A machine can be controlled by an old worker whose own current cache is outdated.
`verifyVersionFresh()` only checks `version.js` (which always loads fresh), so it
never notices a stale *worker*. `ensureControllingWorkerFresh()` asks the
controlling worker its version via the existing `GET_VERSION` message; if it
doesn't match the page, it clears caches and reloads **once per version**
(`sessionStorage` guard prevents loops). It is called after registration.

**Refinement vs. the original draft:** the helper bails when `!navigator.onLine`
*before* clearing caches — clearing caches offline would brick the app (caches are
the only file source). This mirrors `coreBoot.attemptCacheRecovery()`'s existing
offline guard. It only clears caches, never localStorage/IndexedDB, so saved
routines are safe.

### Change 3 — manual, one-time (already-stuck machines)

A code change can't retroactively scrub a machine that's already wedged under an old
worker — the buggy worker is the one in control, so it can't be replaced until it's
cleared once. On the affected browser: **DevTools → Application → Service Workers →
Unregister → Storage → Clear site data → hard reload.** This wipes that machine's
saved routines, so export first if any matter. After this one clear, Change 2 keeps
it healthy automatically.

## Why all three

Change 1 prevents *future* stale-serves — but only takes effect once the **fixed**
worker is activated and controlling the page, which a stale worker is exactly what
blocks. Change 2 forces that transition from the page side for most users. Change 3
is the unavoidable bootstrap for machines already broken when the fix ships.

## v2.249 — the stale *build* (not just stale `version.js`)

After the original fix shipped, a different failure mode surfaced: a device booted
fine but ran an **old cached HTML/CSS build**, yet "Check for Updates" and About
reported it was current. Observed: loaded HTML `<meta app-version>`=`2.247` plus
duplicate `variables.css`/`reset.css` (the preload at `?v=2.247` vs `main.css`'s
`@import` at a different `?v=`), while About claimed a newer version.

### Why the old check was blind

`globalThis.APP_VERSION` is loaded from `version.js`, and the service worker serves
`version.js` **network-first on any `?v=` version mismatch** (`versionMismatch` at
`~line 741` of `service-worker.js`). So `APP_VERSION` reads the *latest deployed*
version even when the rendered HTML/CSS are an old cached build. Any health check
that trusted `APP_VERSION` therefore reported "up to date" while the device was
actually stuck on stale HTML.

### The "build version" signal

The honest "what am I actually running" value is the loaded HTML's
`<meta name="app-version">` content — the true running build, baked into *that*
document. `window.getBuildVersion()` (`miniCycle.html` ~line 66) reads it, falling
back to `globalThis.APP_VERSION` only if the meta tag is missing.

### Change 4 — `verifyVersionFresh()` compares BUILD vs server (`miniCycle.html`)

`verifyVersionFresh()` now fetches `version.js` fresh (`cache: 'no-store'`) and
computes a `buildStale` flag (`~line 477`): `buildVersion` (from
`getBuildVersion()`) vs the freshly-fetched `serverVersion`. If they differ it
self-heals — clear **all** caches, **unregister** the service worker, then reload
to `?_cb=<ts>` (the SW must go too: a cache-first navigation handler could
otherwise re-serve the same stale HTML even after caches are cleared).

A loop guard keyed on the server version, `sessionStorage['__miniCycle_buildHeal']`
(`~line 495`), prevents repeated reloads: if a heal already ran this session and
the build is *still* stale (e.g. flaky network), it stops. `sessionStorage` clears
on a full app close, so a fresh launch retries; a newer deploy re-keys the guard
and heals again.

> **Note:** this is distinct from Change 2's `ensureControllingWorkerFresh()`,
> which compares the *controlling worker's* version against the page via the
> `GET_VERSION` message. Change 4 compares the *loaded HTML build* against the
> *server* — it catches the case where `version.js` loads fresh (so the worker
> looks current) but the HTML/CSS are stale.

### Change 5 — "Check for Updates" / About read the build (`miniCycle.html`)

`window.checkForUpdates()` now compares the **running build**
(`getBuildVersion()`, `~line 818`) against the deployed version from
`fetchServerVersion()` — not active-SW vs waiting-SW. The old SW-vs-SW check
reported "up to date" whenever the worker was current, even when the rendered
HTML/CSS were a stale build. On a mismatch it calls `applyUpdateAndReload()`,
which evicts caches + the SW and reloads cache-busted. `forceServiceWorkerUpdate()`
(settings + main-menu button) delegates to `checkForUpdates()`.

> Cross-reference: [SERVICE_WORKER_UPDATE_STRATEGY.md](../deployment/SERVICE_WORKER_UPDATE_STRATEGY.md).

### Caveat — only heals 2.249+ devices

The build-vs-server self-heal only runs on devices already on **2.249 or later**
(the version that ships the fixed `verifyVersionFresh`). A device stuck on an
*older* build still needs the one-time manual cache clear / reinstall from
Change 3 before it can pick up the fix.

## Shipping notes

- `./scripts/update-version.sh` is **required** — it bumps the version so a fresh
  worker + cache are built, and (v5.5+) auto-recomputes the CSP hashes for the
  edited inline `<script>` in `miniCycle.html`.
- Stage **only** `service-worker.js`, `miniCycle.html`, and the version-bump files —
  do **not** `git add -A` or run `update-version.sh -p` on a dirty tree (that swept
  the `chrome/` build into the 2.234 release commit).
