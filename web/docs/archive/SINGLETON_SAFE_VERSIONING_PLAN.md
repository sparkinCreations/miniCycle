# Singleton-Safe Module Versioning Plan

**Date:** December 13, 2025
**Updated:** January 2, 2026
**Status:** Implemented (via Service Worker)
**Priority:** Completed
**Goal:** Centralize module versioning logic to prevent singleton modules from being loaded as separate instances

---

## Executive Summary

### The Problem

ES modules treat different URLs as separate module instances. When using cache-busting version params like `?v=1.492`, a module imported as `appContext.js?v=1.492` is a **completely different instance** from `appContext.js`.

This caused a bug where:
- `coreBoot.js` imported `appContext.js?v=1.492` and set `AppState` on it
- `dataAccess.js` imported `appContext.js` (no version)
- `getAppState()` returned `null` because it was reading from a different module instance

### The Solution (Implemented)

The **service worker now handles automatic versioning** at the network level, eliminating the need for manual `?v=` params in source code.

---

## Current Implementation

### Service Worker Auto-Versioning (service-worker.js, lines 372-426)

The service worker intercepts all `.js` and `.css` fetch requests and automatically adds version parameters:

```javascript
// ✅ AUTO-VERSION: Append version parameter to JS/CSS requests for cache-busting
// This ensures ALL modules show with ?v= in DevTools Sources panel
var fetchUrl = new URL(request.url);
if (!fetchUrl.searchParams.has('v') && fetchUrl.pathname.endsWith('.js')) {
  fetchUrl.searchParams.set('v', APP_VERSION);
}

// Create request with cache: 'no-cache' to force revalidation
var freshRequest = new Request(fetchUrl.href, {
  method: 'GET',
  headers: request.headers,
  mode: request.mode,
  credentials: request.credentials,
  cache: 'no-cache'  // Force revalidation, bypass stale browser cache
});

// Store with normalized URL (no version) for consistent cache keys
var cacheUrl = new URL(request.url);
cacheUrl.searchParams.delete('v');
var cacheRequest = new Request(cacheUrl.href);
```

### How It Works

1. **Static import in source code:**
   ```javascript
   import { getAppState } from '../core/appContext.js';
   ```

2. **Browser requests:** `appContext.js`

3. **Service worker intercepts and fetches:** `appContext.js?v=1.639`
   - Forces fresh content from server (cache: 'no-cache')

4. **Service worker caches with normalized key:** `appContext.js` (no version)
   - Consistent cache lookup regardless of version

5. **Browser module cache keyed by:** `appContext.js`
   - All imports resolve to same module instance

### Why This Solves The Singleton Problem

Since the source code no longer needs explicit `?v=` params:
- All imports of `appContext.js` use the same URL
- Browser module cache has single instance
- State is shared correctly

---

## Remaining Considerations

### Dynamic Imports with Explicit Versions

Some modules still use explicit versioning in dynamic imports:

```javascript
// taskDOM.js - dynamic sub-module loading
const { TaskButtons } = await import(`./taskButtons.js?v=${version}`);
```

This is **safe but redundant** - the service worker would add the version anyway. However, it doesn't cause singleton issues because:
1. These are sub-modules without shared state
2. They're loaded once during initialization
3. The explicit version matches `APP_VERSION`

### When Explicit Versions Can Still Cause Issues

If two different source files import the same module with **different** version strings:

```javascript
// File A
import('./singleton.js?v=1.0')  // Module instance #1

// File B
import('./singleton.js?v=2.0')  // Module instance #2 - DIFFERENT!
```

This would still create separate instances. But with service worker auto-versioning, there's no need for explicit versions in source code.

---

## Best Practices

### DO: Use Plain Imports (Recommended)
```javascript
// Static imports - service worker handles versioning
import { something } from '../core/someModule.js';

// Dynamic imports - service worker handles versioning
const module = await import('../features/someFeature.js');
```

### DON'T: Add Manual Version Params
```javascript
// Unnecessary - service worker does this automatically
import { something } from '../core/someModule.js?v=1.639';
```

### Exception: Sub-module Loading Pattern

For modules that load their own sub-modules (like taskDOM.js loading taskButtons.js), explicit versioning is acceptable but optional:

```javascript
// Both work - explicit version is redundant but harmless
const { TaskButtons } = await import(`./taskButtons.js?v=${version}`);
const { TaskButtons } = await import('./taskButtons.js');  // Service worker adds version
```

---

## Singleton Module Identification

A module is a singleton if it:
1. Has module-level variables that hold state (like `const context = {}`)
2. Exports getters/setters that read/write that state
3. Expects all consumers to share the same state

Current singleton modules:
- `appContext.js` - central dependency registry
- `appGlobalState.js` - global state container

These modules should **never** be imported with explicit version params in source code.

---

## Testing

To verify auto-versioning is working:

1. Open DevTools > Network tab
2. Reload the app
3. Filter by JS files
4. Verify all `.js` requests show `?v=X.XXX` in the URL
5. Check Sources panel - modules should appear with version params

To verify singleton behavior:
1. Check that `getAppState()` returns the same object from different modules
2. Verify state changes propagate across module boundaries

---

## Historical Context

The original plan proposed a `withV()` helper function that would exclude singleton modules from versioning. This approach was superseded by the service worker implementation, which:

1. Automatically handles all JS/CSS files
2. Requires no changes to source code imports
3. Uses normalized cache keys for consistent caching
4. Forces revalidation with `cache: 'no-cache'`

The service worker approach is superior because it's transparent to the application code and handles all edge cases uniformly.
