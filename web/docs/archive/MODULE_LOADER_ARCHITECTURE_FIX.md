# Module Loader Architecture Fix Plan

## Overview

This document outlines architectural issues in the module loading system discovered during boot failure debugging in January 2026. **All issues have been addressed** - the system now has proper dependency detection, automatic load ordering from `requires`, cross-phase validation, and audit/enforce modes.

**Status:** ✅ **COMPLETE** - All phases implemented
**Last Updated:** 2026-01-26

---

## Current Architecture (Post-Fix)

### Key Components

```
moduleManifests.js (single source of truth)
├── MODULE_MANIFESTS          - All module definitions
├── PHASES                    - Phase constants
├── CORE_DEPS                 - Core deps from coreBoot (excluded from graph)
├── ALIAS_MAP                 - Maps alias names to canonical provides names
├── resolveAlias()            - Resolves aliases
├── computeEffectiveAfterConstraints() - Derives after from requires
├── getModulesByPhase()       - Returns modules sorted by computed constraints
├── getLoadOrder()            - Full load order using computed constraints
└── validateCrossPhaseDeeps() - Warns about undeclared cross-phase deps

moduleLoader.js (imports from versioned moduleManifests.js)
├── loadManifests(withV)      - Loads manifests + constants via versioned import
├── detectCircularDeps()      - Uses requires + provides + aliases
├── createValidatedWrapper()  - Wraps lazy deps with null-check warnings
├── buildModuleDependencies() - Provides deps based on requires + lazyRequires
└── AUDIT_UNDECLARED_DEPS     - When true, logs undeclared dep access
```

### Configuration Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `AUDIT_UNDECLARED_DEPS` | `true` | Logs when modules access deps not in `requires` |
| `ENFORCE_REQUIRES` | `false` | When true, modules ONLY get declared deps (breaking) |
| `STRICT_LAZY_VALIDATION` | `false` | When true, throws instead of warns on null lazy deps |

### How Load Order Works

1. `getModulesByPhase(phase)` is called for each phase
2. `computeEffectiveAfterConstraints()` analyzes all `requires` → `provides` relationships
3. For same-phase deps, creates implicit `after` constraints
4. `topologicalSortWithinPhase()` sorts modules respecting computed constraints
5. Modules load in correct order without manual `after` declarations

---

## Original Issues (Historical Reference)

> **Note:** All issues below have been fixed. This section is preserved for historical context.

### High Priority (All Fixed ✅)

#### 1. Circular Dependency Detection is a No-Op ✅ FIXED

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

**Fix:** Update `buildDependencyGraph()` to use `requires` field. Since `requires` contains API names (not module names), need to map APIs to modules via `provides` or `provideInstance`.

**Limitation:** Cycle detection still won't "see" API aliases that only exist in `depMappings` (e.g., `renderTaskList` → `refreshTaskListUI`). These aliases are invisible to the graph unless an alias registry is added (see Phase 5.2).

---

#### 2. Load Order Ignores `requires` ✅ FIXED

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

#### 3. Cross-Phase and Same-Phase Dependency Mismatches ✅ FIXED

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

### Medium Priority (All Fixed ✅)

#### 4. `requires` Field is Not Enforced ✅ FIXED

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

### Low Priority (All Fixed ✅)

#### 5. Orchestrator Architectural Drift ✅ FIXED

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
           // Also check provideInstance (e.g., 'taskDOMManager', 'themeManager')
           if (manifest.provideInstance === apiName) {
               return name;
           }
       }
       return null;
   }
   ```

   **Note:** This still won't find `depMappings` aliases (e.g., `renderTaskList`). See Phase 5.2 for alias registry solution.

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

## Phase 5: Complete Architecture Refactor (Future Work)

This phase addresses the fundamental architectural limitations that remain after Phases 1-4. It makes `requires` the source of truth for load ordering, eliminating the need for manual `after` constraints.

### Overview

**Goal:** Make module loading fully declarative - developers only need to specify `requires` and `provides`, and the system automatically determines correct load order.

**Key Changes:**
1. Auto-derive `after` constraints from `requires` + `provides` mapping
2. Add alias registry for `depMappings` aliases
3. Implement runtime validation that catches lazy null resolutions
4. Enforce `requires` by only providing declared dependencies

---

### 5.1 Auto-Derive `after` from `requires` ✅ IMPLEMENTED

**Problem:** Currently, `requires` has no effect on load order. Developers must manually add `after` constraints, which is error-prone and redundant.

**Solution:** At boot time, compute `after` constraints automatically from `requires` declarations.

```javascript
// moduleManifests.js - Add new function

/**
 * Compute effective 'after' constraints by analyzing requires → provides relationships
 * @param {Object} manifests - MODULE_MANIFESTS object
 * @returns {Map<string, Set<string>>} - Map of module name → Set of modules it must load after
 */
export function computeEffectiveAfterConstraints(manifests) {
    const effectiveAfter = new Map();

    // Build provides → module lookup
    const providerMap = new Map(); // API name → module name
    for (const [moduleName, manifest] of Object.entries(manifests)) {
        for (const api of manifest.provides || []) {
            providerMap.set(api, moduleName);
        }
        if (manifest.provideInstance) {
            providerMap.set(manifest.provideInstance, moduleName);
        }
    }

    // For each module, find which modules provide its requirements
    for (const [moduleName, manifest] of Object.entries(manifests)) {
        const afterSet = new Set(manifest.after || []); // Start with explicit after

        for (const req of manifest.requires || []) {
            // Skip core deps (from coreBoot)
            if (CORE_DEPS.has(req)) continue;

            // Skip aliases (handled separately)
            if (ALIAS_MAP.has(req)) {
                const canonical = ALIAS_MAP.get(req);
                const provider = providerMap.get(canonical);
                if (provider && provider !== moduleName) {
                    afterSet.add(provider);
                }
                continue;
            }

            const provider = providerMap.get(req);
            if (provider && provider !== moduleName) {
                // Only add same-phase constraints (cross-phase handled by phase ordering)
                const providerPhase = manifests[provider]?.phase;
                const myPhase = manifest.phase;
                if (providerPhase === myPhase) {
                    afterSet.add(provider);
                }
            }
        }

        effectiveAfter.set(moduleName, afterSet);
    }

    return effectiveAfter;
}
```

**Update `getModulesByPhase()` to use computed constraints:**

```javascript
// moduleManifests.js - Replace getModulesByPhase

let _effectiveAfter = null;

export function getModulesByPhase(phase) {
    // Compute effective after constraints once (lazy initialization)
    if (!_effectiveAfter) {
        _effectiveAfter = computeEffectiveAfterConstraints(MODULE_MANIFESTS);
    }

    const modules = Object.entries(MODULE_MANIFESTS)
        .filter(([_, manifest]) => manifest.phase === phase);

    // Topological sort within phase using effective after constraints
    return topologicalSort(modules, _effectiveAfter);
}

function topologicalSort(modules, effectiveAfter) {
    const moduleMap = new Map(modules);
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(name) {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            console.error(`🔄 Circular dependency in phase: ${name}`);
            return;
        }

        visiting.add(name);

        // Visit dependencies first
        const deps = effectiveAfter.get(name) || new Set();
        for (const dep of deps) {
            if (moduleMap.has(dep)) {
                visit(dep);
            }
        }

        visiting.delete(name);
        visited.add(name);
        sorted.push([name, moduleMap.get(name)]);
    }

    for (const [name] of modules) {
        visit(name);
    }

    return sorted;
}
```

**Note:** Both `getModulesByPhase()` and `getLoadOrder()` now use computed constraints. The load order log in featureBoot is derived from these computed constraints, so it accurately reflects the actual order including implicit dependencies from `requires`.

---

### 5.2 Add Alias Registry for `depMappings` ✅ IMPLEMENTED

**Problem:** Some `requires` entries (like `renderTaskList`) are aliases in `depMappings` that map to different `provides` names (like `refreshTaskListUI`). These are invisible to the dependency graph.

**Solution:** Create an explicit alias registry that maps alias names to their canonical `provides` names.

```javascript
// moduleManifests.js - Single source of truth for constants
// (moduleLoader.js imports these via versioned dynamic import to avoid cache mismatch)

/**
 * Alias map for depMappings entries that don't match provides names.
 * Key: alias name used in requires
 * Value: canonical name from provides
 *
 * IMPORTANT: Only add TRUE aliases - same functionality, different name.
 * Do NOT add distinct APIs that happen to share a module.
 */
export const ALIAS_MAP = new Map([
    // Cycle/mode aliases (true alias)
    ['initializeModeSelector', 'setupModeSelector'],   // modeManager provides setupModeSelector

    // Task aliases (true alias - wrapper calls the canonical function)
    ['renderTaskList', 'refreshTaskListUI'],           // taskUI provides refreshTaskListUI

    // NOTE: renderTasks is NOT an alias - it's a distinct API
]);

/**
 * Resolve an API name to its canonical provides name
 */
export function resolveAlias(apiName) {
    return ALIAS_MAP.get(apiName) || apiName;
}
```

**Update `findProviderModule()` to use aliases:**

```javascript
function findProviderModule(apiName, manifests) {
    // First resolve any alias
    const canonical = resolveAlias(apiName);

    for (const [name, manifest] of Object.entries(manifests)) {
        if (manifest.provides?.includes(canonical)) {
            return name;
        }
        if (manifest.provideInstance === canonical) {
            return name;
        }
    }
    return null;
}
```

**Validation:** Add boot-time check for unmapped aliases:

```javascript
// In loadAllModules(), after loading manifests
function validateAliases(manifests) {
    const allProvides = new Set();
    for (const manifest of Object.values(manifests)) {
        (manifest.provides || []).forEach(p => allProvides.add(p));
        if (manifest.provideInstance) allProvides.add(manifest.provideInstance);
    }

    for (const [moduleName, manifest] of Object.entries(manifests)) {
        for (const req of manifest.requires || []) {
            if (CORE_DEPS.has(req)) continue;

            const canonical = resolveAlias(req);
            if (!allProvides.has(canonical)) {
                console.warn(`⚠️ ${moduleName}: requires '${req}' (canonical: '${canonical}') not provided by any module`);
            }
        }
    }
}
```

---

### 5.3 Runtime Validation for Lazy Null ✅ IMPLEMENTED

**Problem:** Lazy wrappers like `(...args) => deps.x?.y?.(...args)` mask missing providers. The function exists but silently returns `undefined` when called.

**Solution:** Create validated wrapper functions that log warnings on first null access.

```javascript
// moduleLoader.js - Replace lazy wrappers with validated versions

/**
 * Create a validated lazy wrapper that warns on null provider access
 * @param {string} apiName - Name of the API for logging
 * @param {Function} getter - Function that returns the actual implementation
 * @returns {Function} - Wrapper that validates before calling
 */
function createValidatedWrapper(apiName, getter) {
    let hasWarned = false;

    return (...args) => {
        const impl = getter();

        if (impl === undefined || impl === null) {
            if (!hasWarned) {
                console.warn(`⚠️ Lazy dep '${apiName}' resolved to null at call time`);
                hasWarned = true;
            }
            return undefined;
        }

        return impl(...args);
    };
}

// Usage in depMappings:
const depMappings = {
    // Before (silent failure):
    // updateProgressBar: (...args) => deps.progress?.updateProgressBar?.(...args),

    // After (warns on null):
    updateProgressBar: createValidatedWrapper('updateProgressBar',
        () => deps.progress?.updateProgressBar),

    // ... apply to all lazy wrappers
};
```

**Optional: Strict mode that throws instead of warns:**

```javascript
const STRICT_LAZY_VALIDATION = false; // Enable in development

function createValidatedWrapper(apiName, getter) {
    let hasWarned = false;

    return (...args) => {
        const impl = getter();

        if (impl === undefined || impl === null) {
            if (!hasWarned) {
                const msg = `Lazy dep '${apiName}' resolved to null at call time`;
                if (STRICT_LAZY_VALIDATION) {
                    throw new Error(msg);
                }
                console.warn(`⚠️ ${msg}`);
                hasWarned = true;
            }
            return undefined;
        }

        return impl(...args);
    };
}
```

---

### 5.4 Enforce `requires` (Optional, Breaking) ✅ IMPLEMENTED

**Problem:** `Object.assign(result, depMappings)` provides ALL deps to every module, making `requires` meaningless.

**Solution:** Remove `Object.assign` and only provide declared dependencies.

```javascript
// moduleLoader.js - buildModuleDependencies()

function buildModuleDependencies(manifest, deps, coreResult) {
    const result = {};

    // Always provide core deps
    result.appInit = coreResult.appInit;
    result.GlobalUtils = coreResult.GlobalUtils;
    result.AppState = /* ... Proxy setup ... */;
    // ... other core deps

    // ONLY provide what's in requires
    for (const req of manifest.requires || []) {
        if (req in depMappings) {
            result[req] = depMappings[req];
        } else if (req in coreResult) {
            result[req] = coreResult[req];
        } else {
            console.warn(`⚠️ ${manifest.path}: Unknown required dep '${req}'`);
        }
    }

    // NO Object.assign - modules only get what they declare
    // Object.assign(result, depMappings); // REMOVED

    return result;
}
```

**Migration path:**
1. Audit all modules to ensure `requires` is complete
2. Run in "audit mode" that logs undeclared dep access:
   ```javascript
   // Wrap result in Proxy to detect undeclared access
   return new Proxy(result, {
       get(target, prop) {
           if (!(prop in target) && prop in depMappings) {
               console.warn(`⚠️ ${manifest.path}: Accessing undeclared dep '${prop}'`);
           }
           return target[prop];
       }
   });
   ```
3. Fix all warnings by adding to `requires`
4. Remove `Object.assign`

---

### 5.5 Cross-Phase Dependency Handling ✅ IMPLEMENTED

**Problem:** Some modules intentionally require APIs from later phases (e.g., `recurringIntegration` Phase 4 requires `updateProgressBar` from Phase 6).

**Solution:** Formalize "lazy-only" dependencies with explicit annotation.

```javascript
// moduleManifests.js - Add new field

recurringIntegration: {
    path: '../recurring/recurringIntegration.js',
    phase: PHASES.RECURRING,
    requires: ['appInit', 'AppState', /* ... */],

    // NEW: Explicitly mark cross-phase deps as lazy-only
    lazyRequires: ['updateProgressBar'],  // Phase 6, only called after user interaction

    provides: ['panel', 'core'],
    api: 'recurring',
},
```

**Validation:**

```javascript
function validateCrossPhaseDeeps(manifests) {
    const phaseOf = (api) => {
        const provider = findProviderModule(api, manifests);
        return provider ? manifests[provider]?.phase : null;
    };

    for (const [moduleName, manifest] of Object.entries(manifests)) {
        const myPhase = manifest.phase;

        for (const req of manifest.requires || []) {
            if (CORE_DEPS.has(req)) continue;

            const reqPhase = phaseOf(req);
            if (reqPhase && reqPhase > myPhase) {
                // Cross-phase forward reference
                if (!manifest.lazyRequires?.includes(req)) {
                    console.error(`❌ ${moduleName} (Phase ${myPhase}) requires '${req}' from Phase ${reqPhase} but it's not in lazyRequires`);
                }
            }
        }
    }
}
```

---

### Implementation Order

1. ✅ **5.2 Alias Registry** - Low risk, improves graph accuracy - **DONE**
2. ✅ **5.3 Runtime Validation** - Low risk, improves debugging - **DONE**
3. ✅ **5.1 Auto-Derive After** - Medium risk, major improvement - **DONE**
4. ✅ **5.5 Cross-Phase Handling** - Low risk, documentation improvement - **DONE**
5. ✅ **5.4 Enforce Requires** - High risk, breaking change - **DONE** (audit mode on, enforce mode off)

### Estimated Effort

| Task | Files | Risk | Status |
|------|-------|------|--------|
| 5.2 Alias Registry | moduleLoader.js | Low | ✅ Done |
| 5.3 Runtime Validation | moduleLoader.js | Low | ✅ Done |
| 5.1 Auto-Derive After | moduleManifests.js | Medium | ✅ Done |
| 5.5 Cross-Phase Handling | moduleManifests.js | Low | ✅ Done |
| 5.4 Enforce Requires | moduleLoader.js | High | ✅ Done (audit mode) |

### Enabling Strict Enforcement

To fully enforce `requires` (breaking change):

1. Run app with `AUDIT_UNDECLARED_DEPS = true` (current default)
2. Check console for `📋 AUDIT:` warnings
3. Add missing deps to each module's `requires` array
4. Once no audit warnings appear, set `ENFORCE_REQUIRES = true`
5. Test thoroughly - modules will only receive declared deps

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
| `modules/boot/moduleManifests.js` | Module definitions, CORE_DEPS, ALIAS_MAP, computed ordering |
| `modules/boot/moduleLoader.js` | Main loader logic, dependency building, validation |
| `modules/boot/orchestrator.js` | Boot sequence coordination |
| `modules/core/diBase.js` | DI utilities used by modules |
| `docs/developer-guides/DI_PATTERNS.md` | DI documentation |
| `docs/developer-guides/MODULE_SYSTEM_GUIDE.md` | Module system documentation |

**Note:** `CORE_DEPS`, `ALIAS_MAP`, and `resolveAlias` live in `moduleManifests.js` as the single source of truth. `moduleLoader.js` imports them via versioned dynamic import to avoid cache mismatches.

---

## Open Questions

1. **Should `requires` drive load order?**
   - Current: No, only `after` affects order
   - Proposal: Yes, derive `after` from `requires` + `provides` mapping
   - Decision: **Yes** - Full solution documented in Phase 5.1

2. **Should `requires` be enforced (error on null)?**
   - Current: Warns on undefined, but lazy wrappers mask null providers
   - Proposal: Runtime validation at call time
   - Decision: **Yes** - Full solution documented in Phase 5.3 (validation) and 5.4 (enforcement)

3. **Is cross-phase `updateProgressBar` in `recurringIntegration` a bug?**
   - Analysis: It's wrapped in lazy closure, only called after user interaction
   - Conclusion: **Not a bug** - intentionally lazy. ✅ Documented in manifest.
   - Future: Formalize with `lazyRequires` field (Phase 5.5)

---

## Implementation Status

### ✅ Fixed (2026-01-26)

1. **Circular detection now uses `requires` + `provides`** - `buildDependencyGraph()` maps API names to provider modules
2. **Added missing `after` constraints** - `taskOptionsCustomizer`, `titleManager`, `testingModal`, `testingModalIntegration`
3. **Added `requires` validation** - Warns when required deps are undefined (not provided by any module)
4. **Documented `Object.assign` fallback** - Explains why all deps are provided regardless of `requires`
5. **Updated orchestrator header** - Now accurately describes boot UI responsibilities
6. **Documented cross-phase lazy dep** - `recurringIntegration` → `updateProgressBar` is intentionally lazy
7. **Added alias registry (Phase 5.2)** - `ALIAS_MAP` maps depMappings aliases to canonical `provides` names
8. **Runtime validation for lazy null (Phase 5.3)** - `createValidatedWrapper()` warns when lazy deps resolve to null at call time
9. **Auto-derive `after` from `requires` (Phase 5.1)** - `computeEffectiveAfterConstraints()` + `topologicalSortWithinPhase()` in moduleManifests.js
10. **Cross-phase validation (Phase 5.5)** - `validateCrossPhaseDeeps()` warns about cross-phase deps not in `lazyRequires`
11. **Enforce requires with audit mode (Phase 5.4)** - `AUDIT_UNDECLARED_DEPS` flag logs undeclared access, `ENFORCE_REQUIRES` flag for strict mode

### Previously Known Limitations - All Fixed ✅

1. ~~**Load order ignores `requires`**~~ ✅ **FIXED**
   - `computeEffectiveAfterConstraints()` auto-derives `after` from `requires`
   - `topologicalSortWithinPhase()` orders modules correctly
   - Both `getModulesByPhase()` and `getLoadOrder()` use computed constraints

2. ~~**Alias deps invisible to graph**~~ ✅ **FIXED**
   - `ALIAS_MAP` in moduleManifests.js maps aliases to canonical names
   - `findProviderModule()` resolves aliases before lookup
   - Example: `renderTaskList` → `refreshTaskListUI` (now detected)

3. ~~**Validation doesn't catch lazy null**~~ ✅ **FIXED**
   - `createValidatedWrapper()` warns at call time
   - Applied to critical lazy wrappers (`updateProgressBar`, undo functions, etc.)
   - Set `STRICT_LAZY_VALIDATION = true` to throw instead of warn

4. ~~**`requires` not enforced**~~ ✅ **FIXED**
   - `AUDIT_UNDECLARED_DEPS = true` (default) logs undeclared dep access
   - `ENFORCE_REQUIRES = true` enables strict mode (breaking change)

5. ~~**Cross-phase deps undocumented**~~ ✅ **FIXED**
   - `lazyRequires` field for intentional cross-phase deps
   - `recurringIntegration` uses `lazyRequires: ['updateProgressBar']`
   - `validateCrossPhaseDeeps()` runs at boot, warns about violations

---

## History

- **2026-01-26:** Initial documentation created after boot failure debugging
- **2026-01-26:** Verified all findings against actual code, added specific line numbers
- **2026-01-26:** Implemented Phases 1-4, documented remaining limitations
- **2026-01-26:** Added Phase 5 complete refactor plan addressing all architectural limitations
- **2026-01-26:** Implemented Phase 5.2 (Alias Registry) - cycle detection now sees aliases
- **2026-01-26:** Implemented Phase 5.1, 5.3, 5.4, 5.5 - Complete architecture refactor done
- **2026-01-26:** Fixed review issues: getLoadOrder() now uses computed constraints, validateCrossPhaseDeeps() called at boot, removed incorrect renderTasks alias
- **2026-01-26:** Fixed versioned import issue: moved constants to moduleManifests.js (single source of truth via versioned import), removed moduleConstants.js to avoid cache mismatch
