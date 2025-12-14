# Singleton-Safe Module Versioning Plan

**Date:** December 13, 2025
**Status:** Planned
**Priority:** Low (preventive improvement)
**Goal:** Centralize module versioning logic to prevent singleton modules from being loaded as separate instances

---

## Executive Summary

### The Problem

ES modules treat different URLs as separate module instances. When using cache-busting version params like `?v=1.492`, a module imported as `appContext.js?v=1.492` is a **completely different instance** from `appContext.js`.

This caused a bug where:
- `coreBoot.js` imported `appContext.js?v=1.492` and set `AppState` on it
- `dataAccess.js` imported `appContext.js` (no version)
- `getAppState()` returned `null` because it was reading from a different module instance

### The Solution

Extend the existing `withV()` helper to exclude singleton/state-holding modules from version params.

---

## Current State

The `withV()` function in `coreBoot.js` adds version params to all paths:

```javascript
const withV = (path) => `${path}?v=${window.APP_VERSION || '1.0'}`;
```

This is used inconsistently - some imports use it, others don't.

---

## Proposed Implementation

### 1. Update withV() in coreBoot.js

```javascript
// Modules that hold shared state - NEVER add version params
// Adding ?v=xxx creates a separate module instance with separate state
const SINGLETON_MODULES = [
  'appContext.js'
  // Add others as needed (e.g., any module using module-level state)
];

/**
 * Add version param for cache-busting, except for singleton modules
 * @param {string} path - Module path
 * @returns {string} Path with or without version param
 */
const withV = (path) => {
  if (SINGLETON_MODULES.some(m => path.endsWith(m))) {
    return path; // No versioning - must be same module instance everywhere
  }
  return `${path}?v=${window.APP_VERSION || '1.0'}`;
};
```

### 2. Audit All Dynamic Imports

Search for dynamic imports and ensure they use `withV()`:

```bash
grep -rn "await import(" modules/
```

Replace ad-hoc versioning like:
```javascript
await import(`../core/foo.js?v=${window.APP_VERSION}`)
```

With:
```javascript
await import(withV('../core/foo.js'))
```

### 3. Add Documentation Comment to Singleton Modules

At the top of `appContext.js` and any other singleton modules:

```javascript
/**
 * @file appContext.js
 *
 * !! SINGLETON MODULE - DO NOT USE VERSION PARAMS !!
 *
 * This module holds shared state. Importing with ?v=xxx creates
 * a separate instance with separate state, breaking the app.
 * Always import as: import { x } from './appContext.js'
 * Never as: import('./appContext.js?v=...')
 */
```

---

## Files to Modify

| File | Change |
|------|--------|
| `modules/boot/coreBoot.js` | Update `withV()` with singleton exclusion list |
| `modules/core/appContext.js` | Add warning comment at top |
| Any file with ad-hoc `?v=` on imports | Use `withV()` instead |

---

## Identifying Singleton Modules

A module is a singleton if it:
1. Has module-level variables that hold state (like `const context = {}`)
2. Exports getters/setters that read/write that state
3. Expects all consumers to share the same state

Current singleton modules:
- `appContext.js` - central dependency registry

Potential candidates to audit:
- `appState.js` - but this exports a factory, so it's safe
- Any module with `let` or `const` at module level that gets mutated

---

## Testing

After implementation:
1. Hard refresh the app (Cmd+Shift+R)
2. Toggle three dots setting on/off
3. Verify it updates immediately without page refresh
4. Check console for any "AppState not ready" warnings

---

## Why This Matters

This is a **class of bug** that's hard to debug:
- No errors thrown
- Code looks correct
- Works after refresh (localStorage has correct value)
- Fails on live updates (in-memory state not shared)

Centralizing the versioning logic prevents this entire category of issues.
