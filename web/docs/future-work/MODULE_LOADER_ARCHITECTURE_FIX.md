# Module Loader Architecture Fix Plan

## Overview

This document outlines architectural issues in the module loading system discovered during boot failure debugging in January 2026. The system currently works due to defensive lazy resolution patterns, not because the underlying architecture is correct.

**Last Updated:** 2026-01-26 (verified against actual code)

---

## Current Issues

### High Priority

#### 1. Circular Dependency Detection is a No-Op

**Location:** `modules/boot/moduleLoader.js:104-119`

**Problem:** `buildDependencyGraph()` builds its graph from `manifest.deps`, but no manifests define `deps` - they all use `requires`. The function always returns an empty dependency set for every module.

```javascript
// moduleLoader.js:110-113 - BROKEN: looks for manifest.deps
if (manifest.deps && Array.isArray(manifest.deps)) {
    manifest.deps.forEach(dep => deps.add(dep));
}
```

**Evidence:** Search for `deps:` in moduleManifests.js returns 0 results. All 50+ modules use `requires:` instead.

**Impact:** `detectCircularDeps()` always reports "no cycles found" regardless of actual circular dependencies.

**Fix:** Update `buildDependencyGraph()` to use `requires` field. Since `requires` contains API names (not module names), need to map APIs to modules via `provides`.

---

#### 2. Load Order Ignores `requires`

**Location:** `modules/boot/moduleManifests.js:571-580`

**Problem:** `getModulesByPhase()` determines load order using ONLY:
1. Phase number (primary sort)
2. `after` constraints (secondary sort within phase)

```javascript
// moduleManifests.js:571-580 - The ONLY ordering logic
export function getModulesByPhase(phase) {
    return Object.entries(MODULE_MANIFESTS)
        .filter(([_, manifest]) => manifest.phase === phase)
        .sort((a, b) => {
            // Within a phase, respect 'after' constraints
            if (a[1].after?.includes(b[0])) return 1;
            if (b[1].after?.includes(a[0])) return -1;
            return 0;
        });
}
```

**Impact:**
- `requires` has ZERO effect on load order
- Without explicit `after` constraints, modules load in JavaScript object insertion order
- Reordering manifest entries can silently break boot

**Fix:** Either wire `requires` to drive load order, or accept that `after` is the sole ordering mechanism and document this clearly.

---

#### 3. Cross-Phase and Same-Phase Dependency Mismatches

**Verified concrete examples:**

| Module | Line | Phase | Requires | Provider | Provider Phase | Issue |
|--------|------|-------|----------|----------|----------------|-------|
| `recurringIntegration` | 232 | 4 (RECURRING) | `updateProgressBar` | `cycleCompletion` | 6 (UI_MANAGERS) | Cross-phase: API unavailable at init |
| `taskOptionsCustomizer` | 209 | 3 (TASK_MANAGEMENT) | `updateMoveArrowsVisibility` | `dragDropManager` | 3 | Same-phase, no `after` constraint |
| `titleManager` | 332 | 6 (UI_MANAGERS) | `updateUndoRedoButtons`, `captureStateSnapshot`, `onCycleRenamed` | `undoRedoManager` | 6 | Same-phase, no `after` constraint |
| `testingModal` | 491 | 8 (TESTING) | `backupManager` | `backupManager` | 8 | Same-phase, comment says "must load first" but no `after` |
| `testingModalIntegration` | 500 | 8 (TESTING) | `backupManager` | `backupManager` | 8 | Same-phase, no `after` |

**Evidence for testingModal (line 480 comment):**
```javascript
// PHASE 8: TESTING & BACKUP
// backupManager must load FIRST so testingModal and testingModalIntegration can use it
backupManager: {
    // ... NO after constraint despite the comment
```

**Why it doesn't crash:** Dependencies are wrapped in lazy closures:
```javascript
// moduleLoader.js:593 - lazy resolution masks the ordering bug
updateProgressBar: (...args) => deps.progress?.updateProgressBar?.(...args),
```

**Fix:** Add explicit `after` constraints:
```javascript
taskOptionsCustomizer: {
    after: ['taskDOM', 'reminders', 'modeManager', 'dragDropManager'],  // ADD dragDropManager
},
titleManager: {
    after: ['undoRedoManager'],  // ADD
},
testingModal: {
    after: ['backupManager'],  // ADD
},
testingModalIntegration: {
    after: ['backupManager'],  // ADD
},
```

---

### Medium Priority

#### 4. `requires` Field is Not Enforced

**Location:** `modules/boot/moduleLoader.js:864-874`

**Problem:** `buildModuleDependencies()` processes `requires` but then immediately adds ALL deps anyway:

```javascript
// moduleLoader.js:864-874 - requires is useless
// Add required dependencies
for (const req of manifest.requires || []) {
    if (req in depMappings) {
        result[req] = depMappings[req];
    } else if (req in coreResult) {
        result[req] = coreResult[req];
    }
}

// Add all mappings as fallbacks
Object.assign(result, depMappings);  // ← This makes the above loop pointless!
```

**Impact:**
- Every module receives ALL 100+ dependencies regardless of what it `requires`
- No validation that required deps exist or are non-null
- `requires` is purely documentation with no runtime effect

**Fix options:**
- A) Remove `Object.assign(result, depMappings)` and ONLY provide what's in `requires` (breaking change)
- B) Add validation that warns if required deps resolve to null
- C) Accept `requires` as documentation-only and rename to `uses` or `dependencies`

---

### Low Priority

#### 5. Orchestrator Architectural Drift

**Location:** `modules/boot/orchestrator.js`

**Problem:** Line 5 states:
```javascript
// This file ONLY coordinates - no DI writes, no UI logic, no DOM queries.
```

**Actual code contradicts this:**

| Line | Code | Issue |
|------|------|-------|
| 121-127 | `document.querySelector('.loader-text')` | Direct DOM queries |
| 164-166 | `document.createElement('div')` | DOM element creation |
| 227-292 | `loader.innerHTML = ...` | Extensive error UI rendering |
| 554-555 | `document.addEventListener('DOMContentLoaded', ...)` | DOM event binding |

**Fix options:**
- A) Extract boot UI to `modules/boot/bootUI.js` and import it
- B) Update the documentation to reflect actual responsibilities

---

## Phase Constants Reference

From `moduleManifests.js:37-48`:
```javascript
export const PHASES = {
    THEME_VISUAL: 2,    // Theme, visual basics
    TASK_MANAGEMENT: 3, // Task creation, editing, drag/drop
    RECURRING: 4,       // Recurring tasks, due dates
    CYCLE: 5,           // Cycle management, routine switching
    UI_MANAGERS: 6,     // Menu, settings, modals, undo/redo
    INTEGRATION: 7,     // Cross-module integrations
    TESTING: 8          // Test utilities, backup
};
```

---

## Implementation Plan

### Phase 1: Fix Critical Ordering Issues (Blocking)

**Priority: Immediate - these can cause boot failures**

1. **Add missing `after` constraints to moduleManifests.js:**
   ```javascript
   // Line 209 - taskOptionsCustomizer
   after: ['taskDOM', 'reminders', 'modeManager', 'dragDropManager'],

   // Line 332 - titleManager
   after: ['undoRedoManager'],

   // Line 491 - testingModal
   after: ['backupManager'],

   // Line 500 - testingModalIntegration
   after: ['backupManager'],
   ```

2. **Verify lazy resolution is intentional for cross-phase deps:**
   - `recurringIntegration` → `updateProgressBar`: Document that this is lazy-only
   - Add JSDoc comments marking these as "called after all phases load"

### Phase 2: Fix Detection System (Important)

3. **Define core dependencies that come from coreBoot (not manifests):**
   ```javascript
   // moduleLoader.js - Add near top of file
   // These APIs are provided by coreBoot directly, not by manifest modules.
   // They should be excluded from circular dependency detection since they're
   // always available before any manifest modules load.
   const CORE_DEPS = new Set([
       'AppState',
       'appInit',
       'GlobalUtils',
       'FeatureFlags',
       'AppMeta',
       'StorageManager',
       'notificationQueue',
       // Add any other coreBoot-provided APIs here
   ]);
   ```

4. **Update circular detection to use `requires`:**
   ```javascript
   // moduleLoader.js:110-113 - Change to:
   if (manifest.requires && Array.isArray(manifest.requires)) {
       // Map API names to module names via provides
       manifest.requires.forEach(apiName => {
           // Skip core deps - they're always available from coreBoot
           if (CORE_DEPS.has(apiName)) return;

           const provider = findProviderModule(apiName, manifests);
           if (provider) deps.add(provider);
       });
   }
   ```

5. **Add helper function to map APIs to modules:**
   ```javascript
   function findProviderModule(apiName, manifests) {
       for (const [name, manifest] of Object.entries(manifests)) {
           if (manifest.provides?.includes(apiName)) {
               return name;
           }
       }
       return null;
   }
   ```

**Why core deps are excluded:**
- `AppState`, `appInit`, `GlobalUtils`, etc. are loaded in coreBoot (Phase 1)
- They're available globally before any manifest modules load (Phases 2-8)
- Including them in dependency graph would create false edges since they don't represent module-to-module dependencies
- The `findProviderModule()` function would return `null` for these anyway, but explicitly skipping them is clearer

### Phase 3: Strengthen Contracts (Hardening)

6. **Add `requires` validation (warning-only initially):**
   ```javascript
   // After line 871 in moduleLoader.js
   for (const req of manifest.requires || []) {
       if (result[req] === undefined || result[req] === null) {
           console.warn(`⚠️ ${manifest.path}: Required dep '${req}' is null/undefined`);
       }
   }
   ```

7. **Remove the redundant `Object.assign` or document why it exists:**
   ```javascript
   // Line 874 - Either remove or add comment explaining why all deps are needed
   // Object.assign(result, depMappings); // TODO: Remove after verifying all requires are complete
   ```

### Phase 4: Clean Up Documentation (Polish)

8. **Update orchestrator header to match reality:**
   ```javascript
   /**
    * miniCycle Boot Orchestrator
    *
    * Coordinates the 3-phase boot process and provides boot UI feedback.
    * Responsibilities:
    * - Sequence control for coreBoot → featureBoot → uiBoot
    * - Loader UI updates during boot
    * - Error display for boot failures
    * - Automatic retry and cache recovery
    */
   ```

9. **Or extract boot UI to separate module (cleaner but more work)**

---

## Testing Strategy

### Unit Tests
- Add test manifests with intentional circular dependencies
- Verify `detectCircularDeps` catches them after fix
- Test that missing `after` constraints cause expected warnings

### Integration Tests
- Fresh boot (cleared cache) should work without errors
- Console should have no "missing dep" warnings
- All modules should initialize in correct order

### Manual Verification
```javascript
// Add to console for debugging
getModulesByPhase(3).forEach(([name]) => console.log(name));
// Should show: dragDropManager before taskOptionsCustomizer
```

---

## Related Files

| File | Purpose |
|------|---------|
| `modules/boot/moduleLoader.js` | Main loader logic, dependency building |
| `modules/boot/moduleManifests.js` | Module definitions, phase assignments, ordering |
| `modules/boot/orchestrator.js` | Boot sequence coordination |
| `modules/core/diBase.js` | DI utilities used by modules |
| `docs/developer-guides/DI_PATTERNS.md` | DI documentation |
| `docs/developer-guides/MODULE_SYSTEM_GUIDE.md` | Module system documentation |

---

## Open Questions

1. **Should `requires` drive load order?**
   - Current: No, only `after` affects order
   - Proposal: Yes, derive `after` from `requires` + `provides` mapping
   - Decision: TBD

2. **Should `requires` be enforced (error on null)?**
   - Current: No validation, all deps provided regardless
   - Proposal: Warn initially, error later
   - Decision: TBD

3. **Is cross-phase `updateProgressBar` in `recurringIntegration` a bug?**
   - Analysis: It's wrapped in lazy closure, only called after user interaction
   - Conclusion: **Not a bug** - intentionally lazy, but should be documented

---

## History

- **2026-01-26:** Initial documentation created after boot failure debugging
- **2026-01-26:** Verified all findings against actual code, added specific line numbers
