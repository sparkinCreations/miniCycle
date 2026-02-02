# Code Consistency Audit — DI Patterns, Boot Process & Cross-Cutting Concerns

**Date:** February 2, 2026
**Status:** In Progress
**Overall Score:** 7.5/10
**Scope:** All 117 modules under `modules/`

---

## Executive Summary

Four parallel audits were conducted covering: DI pattern consistency, boot process correctness, `this` vs `_deps` patterns, and cross-cutting concerns. The codebase is well-architected with 62/62 DI-enabled modules following the standard `createDIModule` + `_deps` Proxy pattern. Key gaps exist in direct DOM/storage bypass, bare event listeners, and inconsistent error handling.

---

## 1. DI Pattern Consistency — 9/10

**62 of 62 DI-enabled modules** use the standard pattern:
```javascript
const di = createDIModule('ModuleName', { dep: optional(null) });
const _deps = new Proxy({}, { get(_, prop) { return di.resolve()[prop]; } });
export const setModuleNameDependencies = (deps) => di.setDependencies(deps);
```

The remaining 45 modules (constants, types, pure utilities, boot files) are legitimately exempt.

**One naming inconsistency:** `modules/recurring/recurringCore.js` uses `Deps` (uppercase) instead of `_deps`.

---

## 2. `this` vs `_deps` Patterns — 8.5/10

Two patterns coexist correctly:
- **Pattern A** (51 files): Module-level `_deps` Proxy for standalone functions
- **Pattern B** (23 files): `this.deps` in class constructors for stateful classes
- **Pattern C** (3 files): Direct `di.resolve()` in simple utilities

No anti-patterns found — standalone functions never use `this`, class methods don't improperly reach for module-level `_deps`.

---

## 3. Boot Process — 7/10

The 8-phase boot sequence is sound with proper `await` chains and no race conditions detected.

### Issues Found

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 3.1 | HIGH | `menuManager` is Phase 5 (CYCLE) but has `api: 'ui'` — phase/api mismatch | `moduleManifests.js:318` | Open |
| 3.2 | MEDIUM | `loadRemindersSettings` in manifest `provides` but missing from `depMappings` | `moduleLoader.js` ~line 841 | Open |
| 3.3 | MEDIUM | `checkCompleteAllButton` placed in `taskApi` but is a UI concern | `featureBoot.js:322` | Open |
| 3.4 | MEDIUM | `finalizeUI` calls `getInitializeModeSelector?.()?.()` — silent failure if undefined | `uiBoot.js:654` | Open |
| 3.5 | LOW | `withV` initialized at module level before `effectiveVersion` defined | `coreBoot.js:362` | Open |
| 3.6 | LOW | `validateCrossPhaseDeeps` — typo (should be `Deps`) | `moduleManifests.js:812` | Fixed ✅ |

---

## 4. Direct DOM/Storage Bypass — 6/10

### 4.1 `document.getElementById` in Feature Modules

| File | Approx Count | Issue |
|------|-------------|-------|
| `themeManager.js` | 22+ calls | Uses `DOM_IDS` constants but calls `document.getElementById()` directly instead of `_deps.getElementById()` |
| `preferencesManager.js` | 4 calls | Bare `document.querySelector()` with hardcoded selectors (lines 605, 617, 697, 729) |
| `globalUtils.js:643` | 1 call | Hardcoded `'taskList'` string instead of `DOM_IDS.TASK_LIST` |

### 4.2 `window.*` in Core Module

| File | Lines | Issue |
|------|-------|-------|
| `appState.js` | 416, 428 | Bare `window.addEventListener('beforeunload')` and `window.addEventListener('storage')` — should be DI-injected |

### 4.3 Justified Exceptions

- **Boot modules** (`coreBoot.js`, `uiBoot.js`, `orchestrator.js`): Direct DOM access during bootstrap is necessary
- **Testing modules**: Direct access acceptable for test infrastructure
- **`modeManager.js`**: `document.body.classList` manipulation for mode switching is system-wide and appropriate

---

## 5. Event Listeners — 6.5/10

52 modules correctly use `safeAddEventListener`. Modules bypassing it:

| File | Lines | Count |
|------|-------|-------|
| `taskSearch.js` | 68, 73, 78, 87 | 4 bare `addEventListener` |
| `testing-modal-ui.js` | 639, 643, 649, 660, 671, 680, 689, 714 | 8+ bare `addEventListener` |
| `preferencesPresets.js` | various | bare `addEventListener` |

---

## 6. Error Handling — 6/10

Three strategies with no documented policy:

| Strategy | Modules | Example |
|----------|---------|---------|
| **Throw** (strict fail-fast) | taskDOM, recurringMatcher, dataValidator | `throw new Error(...)` |
| **Warn + continue** (degraded) | themeManager, statsPanel | `console.warn('⚠️...')` |
| **Log + swallow** (silent) | recurringIntegration | `console.log(...)` in catch block |

**Recommended Policy** (documented Feb 2026):

| Context | Strategy | Example |
|---------|----------|---------|
| **Missing required dep at init** | **Throw** — fail fast, caught by boot | `throw new Error('Missing required: AppState')` |
| **Optional dep missing at runtime** | **Warn + degrade** — continue without feature | `console.warn('⚠️ Feature X unavailable'); return;` |
| **Data operation failure** | **Warn + return null** — caller handles | `console.warn('⚠️ Load failed:', err.message); return null;` |
| **Never** | **Silent swallow** — `catch(e) {}` or `console.log` in catch | Remove all instances |

Modules with `console.log` in catch blocks (`recurringIntegration.js:383-432`) should be updated to use `console.warn` with the `⚠️` prefix for consistency.

See `ERROR_HANDLING_IMPROVEMENTS_PLAN.md` for the full 5-phase improvement roadmap.

---

## 7. Manifest/depMappings — 7.5/10

| Issue | Location | Notes |
|-------|----------|-------|
| `statsPanel.provides` lists method names but module provides instance | `moduleManifests.js:196` | Misleading but functional |
| `completedTasksManager.provides` is `[]` but wrapper exists in depMappings | `moduleManifests.js:361` | Undocumented |
| Inconsistent lazy-loading (mix of getters, arrows, direct refs) | `moduleLoader.js:657-704` | Style inconsistency |

---

## Fix Priority List

### LOW Priority (Style/Naming)
- [x] `recurringCore.js` — rename `Deps` to `_deps`
- [x] `moduleManifests.js:812` — fix `validateCrossPhaseDeeps` typo to `validateCrossPhaseDeps`
- [x] `uiBoot.js:654` — add validation to `finalizeUI` getter calls

### MEDIUM Priority (Functional Gaps)
- [x] `taskSearch.js` — 4 bare `addEventListener` → `safeAddEventListener`
- [x] `appState.js:416, 428` — `window.addEventListener` → DI-injected (`addWindowListener`)
- [x] `globalUtils.js:643` — hardcoded `'taskList'` → `DOM_IDS.TASK_LIST`
- [x] `preferencesManager.js` — 4 hardcoded `document.querySelector` → use `DOM_IDS` constants
- [x] `loadRemindersSettings` — add missing depMapping wrapper in moduleLoader
- [x] Document error handling strategy (policy table added above, references existing plan)

### Bonus: Boot bugs found via LOW priority validation
- [x] `featureBoot.js:337` — `cycleApiObj.initializeModeSelector` referenced wrong key (`initializeModeSelector` vs `setupModeSelector`)
- [x] `featureBoot.js:343-360` — `uiApiObj` missing `initCompletedTasksSection`

### HIGH Priority (Architectural)
- [x] `themeManager.js` — 16 direct `document.getElementById/querySelector/querySelectorAll` → `_deps.*` (added to DI schema with defaults, manifest updated)
- [x] `menuManager` — Phase 5 / `api: 'ui'` is correct (api = deps category, not phase). Added clarifying comments to manifest.

---

## Verification

After fixes complete:
1. Run full test suite: `node tests/automated/run-browser-tests.cjs` — expect 1611/1611
2. Grep audit: `grep -r "document\.getElementById" modules/` — should only appear in boot/ and DI defaults
3. Grep audit: `grep -r "\.addEventListener(" modules/` — should only appear in boot/ and testing/
4. Manual smoke test: open/close all modals, switch routines, toggle themes
