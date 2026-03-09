# Service Worker Optimization Plan

## Status: Partially Implemented

## Background

iOS PWA users experienced slow initial load times (~15 seconds) due to:
1. Large precache list (~100+ files) downloaded during install
2. Network-first strategy waiting for network on every JS/CSS request

## What Was Implemented (January 2025)

### 1. Reduced Precache Scope (DONE)
Reduced precache from ~100+ files to ~25 boot-critical files:

```javascript
var BOOT_CRITICAL = [
  './miniCycle.html',
  './miniCycle-styles.css',
  './miniCycle-main.js',
  './modules/boot/orchestrator.js',
  './modules/boot/coreBoot.js',
  './modules/boot/featureBoot.js',
  './modules/boot/uiBoot.js',
  './modules/boot/moduleLoader.js',
  './modules/boot/moduleManifests.js',
  './modules/core/appState.js',
  './modules/core/appInit.js',
  './modules/core/diBase.js',
  './modules/core/constants.js',
  './modules/core/appContext.js',
  './modules/core/appGlobalState.js',
  './modules/core/migrationFacade.js',
  './modules/utils/globalUtils.js',
  './modules/utils/errorHandler.js',
  './modules/utils/notifications.js'
];
```

**Result:** Faster PWA install, non-critical modules lazy-cached on first use.

### 2. Fixed Manifest URL Mismatches (DONE)
Updated `manifest.json` shortcuts to match actual file paths:
- `./miniCycle-lite.html` → `./lite/miniCycle-lite.html`
- `./user-manual.html` → `./legal/user-manual.html`

### 3. Kept Network-First for JS/CSS (DONE)
Maintained network-first strategy for reliability. Users always get fresh code with offline fallback.

## What Was Attempted But Reverted

### Stale-While-Revalidate for JS/CSS

**Concept:** Serve cached JS/CSS immediately (instant load), fetch fresh copy in background for next visit.

**Implementation:**
```javascript
// Attempted pattern (REVERTED)
event.respondWith(
  caches.match(cacheRequest).then(function (cached) {
    // Start background fetch
    var networkFetch = fetch(freshRequest).then(function (res) {
      // Update cache in background
      caches.open(DYNAMIC_CACHE).then(function (cache) {
        cache.put(cacheRequest, res.clone());
      });
      return res;
    });

    // Return cached immediately if available
    if (cached) return cached;

    // No cache - wait for network
    return networkFetch;
  })
);
```

**Why It Failed:**
1. PWA users had old/corrupted files in cache from previous versions
2. Stale-while-revalidate served these broken files immediately
3. iOS PWA showed "Unable to Load" error
4. Safari with cache showed CSS issues, broken swipe gestures
5. Only Safari Private mode (no cache) worked correctly

**Lessons Learned:**
- Cache version bump alone wasn't enough - old service worker was still cached
- iOS aggressively caches service workers, making recovery difficult
- Users had to delete PWA and clear website data to recover

## Future Implementation: Safe Stale-While-Revalidate

If revisiting SWR in the future, consider these safeguards:

### Option 1: Cache Validation
Only serve from cache if file has been successfully fetched at least once with current CACHE_VERSION:

```javascript
// Store metadata with cached files
cache.put(cacheRequest, response, {
  headers: { 'X-Cache-Version': CACHE_VERSION }
});

// Only serve if cache version matches
if (cached && cached.headers.get('X-Cache-Version') === CACHE_VERSION) {
  return cached;
}
```

### Option 2: Hash-Based Validation
Include content hash in requests, only serve cache if hash matches:

```javascript
// Build step generates manifest with hashes
// { "app.js": "abc123", "styles.css": "def456" }

// Service worker validates hash before serving
```

### Option 3: Hybrid Strategy
Use network-first for boot-critical files, SWR only for non-critical:

```javascript
if (isBootCritical(url)) {
  // Network-first for critical files
} else {
  // Stale-while-revalidate for non-critical
}
```

### Option 4: Gradual Rollout
Implement SWR behind a feature flag, test with subset of users first.

## Testing Checklist (Before Implementing SWR)

- [ ] Test on iOS Safari (private and normal mode)
- [ ] Test on iOS PWA (installed to home screen)
- [ ] Test cache version upgrade path
- [ ] Test with corrupted/outdated cache
- [ ] Test offline behavior
- [ ] Test "delete PWA and reinstall" scenario
- [ ] Verify all critical modules load correctly
- [ ] Verify gesture handling works (swipe for stats panel)
- [ ] Verify CSS loads completely

## Current Performance

With reduced precache + network-first:
- **Install:** Much faster (25 files vs 100+)
- **Subsequent loads:** Slightly slower than SWR would be, but reliable
- **Offline:** Works (serves from cache when network unavailable)

This is an acceptable trade-off until a safer SWR implementation is developed.
