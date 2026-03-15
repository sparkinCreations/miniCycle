# Large Module Splits Plan

**Date:** March 15, 2026
**Status:** Not Started
**Related:** [DI_MIGRATION_COMPLETION_PLAN.md](./DI_MIGRATION_COMPLETION_PLAN.md), [ENFORCE_REQUIRES_ROLLOUT_PLAN.md](./ENFORCE_REQUIRES_ROLLOUT_PLAN.md)

---

## Problem

Six modules exceed 1,300 lines and handle multiple distinct responsibilities. Large modules are harder to navigate, test in isolation, and modify without unintended side effects.

| Module | Lines | Largest Function |
|--------|-------|-----------------|
| routineSwitcher.js | 2,092 | `loadMiniCycleListActual()` ~184L |
| undoRedoManager.js | 2,070 | `performStateBasedUndo()` ~162L |
| recurringPanel.js | 2,006 | `updateRecurringPanel()` ~113L |
| taskDOM.js | 1,816 | `init()` ~176L |
| migrationManager.js | 1,476 | `performAutoMigration()` ~270L |
| moduleLoader.js | 1,332 | `buildModuleDependencies()` ~492L |

---

## Established Sub-Module Patterns

The codebase already has two proven patterns for splitting modules. Any new splits must follow one of these.

### Pattern 1: Dynamic Sub-Module Loading

Used by: `taskDOM.js` (6 sub-modules), `recurringPanel.js` (5 sub-modules), `settingsManager.js` (5+ sub-managers)

```javascript
// In parent module's init() or constructor:
const version = this.deps.AppMeta?.version || '1.0';

const [fooMod, barMod] = await Promise.all([
    import(`./parentFoo.js?v=${version}`),
    import(`./parentBar.js?v=${version}`),
]);

this._foo = fooMod;
this._bar = barMod;
```

Rules:
- Sub-modules do **NOT** get their own manifest entry — they're internal to the parent
- Parent's `provides` list stays the same — the public API doesn't change
- Sub-modules may have their own `createDIModule()` DI setup (e.g., taskRenderer.js, taskButtons.js) — the parent calls their `setDependencies()` after import
- Must use `?v=${version}` on all dynamic imports (see constraint below)

### Pattern 2: Pure Utility Extraction

Used by: helper modules with no module-level side effects (no DI, no state, no `addEventListener`).

```javascript
import { helperFunction } from './parentHelpers.js';
```

Rules:
- Safe for static import ONLY if the file has zero side effects
- No `setDependencies()`, no module-level state, no event listeners

### Critical Constraint: Versioned Import Split Bug

`import('./foo.js?v=1.0')` and `import './foo.js'` create **separate module instances** in the browser. If a module has side effects (DI setup, module-level state), the static import creates an unversioned instance that diverges from the versioned one loaded by moduleLoader.

**Rule:** Anything with side effects must use dynamic versioned imports. Pure utility functions are the only safe static imports.

---

## Priority 1: routineSwitcher.js (2,092 lines)

### Current Responsibilities
- Modal presentation and lifecycle
- Cycle CRUD (create, rename, delete, duplicate)
- Export/download (.mcyc files)
- Inline editing UX
- Theme picker UI
- Desktop preview subsystem
- Cycle list rendering
- Search, sort, and filter controls
- Storage bar display
- Wrapper compatibility layer

### Proposed Extractions (3 dynamic sub-modules)

All three have internal state or DOM side effects → dynamic versioned imports.

**`routineSwitcherThemePicker.js` (~110 lines)**
- `toggleThemePicker()`, `openThemePicker()`, `_selectTheme()`, `closeThemePicker()`
- Self-contained feature with its own DOM state
- Risk: Low — isolated UI with clear boundaries

**`routineSwitcherPreview.js` (~250 lines)**
- `updatePreview()`, `_updateDesktopPreview()`, `_resetDesktopPreview()`, `setupPreviewPopout()`, `_openPreviewReviewModal()`
- Desktop-only feature, mobile users never load it
- Risk: Low — preview is read-only, no state mutations

**`routineSwitcherSearch.js` (~240 lines)**
- `setupSearchInput()`, `filterRoutineList()`, `setupSortControls()`, `_updateSortButtonStates()`, `_sortCycles()`, `setupFilterControls()`, `_getCycleMode()`, `_filterCycles()`
- Pure UI filtering, operates on already-rendered list
- Risk: Low — search/sort/filter are stateless transforms

**Remaining routineSwitcher.js (~1,490 lines)**
- Core modal, CRUD, list management, inline edit, export, storage bar

---

## Priority 2: undoRedoManager.js (2,070 lines)

### Current Responsibilities
- localStorage cache (instant boot)
- Snapshot capture, validation, sanitization
- Snapshot signature/deduplication
- State wrapping (AppState mutation interception)
- Change description (diff analysis for undo messages)
- Undo/redo execution (state restoration + UI sync)
- Keyboard shortcuts
- UI button management
- Cycle lifecycle hooks (switch, create, delete, rename)
- IndexedDB persistence (durable storage)
- Idle save scheduling
- System initialization

### Proposed Extractions (2 dynamic sub-modules)

Dynamic versioned imports — both reference module-level state and DI deps.

**`undoIndexedDB.js` (~190 lines)**
- `saveUndoStackToIndexedDB()`, `loadUndoStackFromIndexedDB()`, `deleteUndoStackFromIndexedDB()`, `renameUndoStackInIndexedDB()`, `clearAllUndoHistoryFromIndexedDB()`
- Note: NOT fully self-contained — references module-level `undoDB` (database handle), `dbWriteTimeout` (debounce timer), and calls `saveToUndoCache()` and `_deps.showNotification()`. These would need to be passed as parameters or the extracted module would need its own DI.
- Risk: Medium — cross-references to module-level variables require interface design

**`undoSnapshotManager.js` (~190 lines)**
- `validateSnapshot()`, `sanitizeSnapshot()`, `filterValidSnapshots()`, `captureStateSnapshot()`, `buildSnapshotSignature()`, `snapshotsEqual()`, `captureInitialSnapshot()`
- Snapshot operations are logically distinct from undo/redo execution
- Risk: Medium — `captureStateSnapshot` reads/writes heavily from `_deps.AppGlobalState` fields (`isInitializing`, `isSwitchingCycles`, `isResetting`, `activeCycleIdForUndo`, `lastSnapshotSignature`, `lastSnapshotTs`, `activeUndoStack`, `activeRedoStack`, `undoRedoCompletedAt`). The parent must pass these or the extracted module needs its own DI wiring.

**Remaining undoRedoManager.js (~1,690 lines)**
- Core undo/redo execution, UI updates, state wrapping, lifecycle hooks, cache, keyboard shortcuts, initialization

---

## Priority 3: recurringPanel.js (2,006 lines)

### Current State

Already has 5 dynamic sub-modules:
- `recurringPanelSummary.js` — summary text building
- `recurringPanelGrids.js` — week/month/year grid generation
- `recurringPanelForm.js` — form data binding
- `recurringPanelEvents.js` — event handlers
- `recurringPanelSetup.js` — initialization helpers

### Potential Additional Extraction

**`recurringPanelAddTask.js` (~275 lines)**
- `setupAddTaskSection()`, `populateAvailableTasks()`, `handleConfirmAddRecurring()`, `attachRecurringSummaryListeners()`
- The "add recurring task" flow is a self-contained sub-feature
- Risk: Medium — interacts with panel state and form values

**Assessment:** Low priority. The existing 5 sub-modules already demonstrate good splitting. The remaining 2,006 lines include the class skeleton, lifecycle methods, and coordination logic that naturally belongs in one place.

---

## Priority 4: taskDOM.js (1,816 lines)

### Current State

Already has 6 dynamic sub-modules:
- `taskValidation.js` (TaskValidator)
- `taskUtils.js` (TaskUtils)
- `taskRenderer.js` (TaskRenderer)
- `taskEvents.js` (TaskEvents)
- `taskButtons.js` (TaskButtons)
- `taskDOMPatch.js` (TaskDOMPatch)

### Potential Extraction

**`taskDOMCompat.js` (~450 lines, lines 1287–1741)**
- Wrapper compatibility layer: module-level functions that delegate to the `taskDOMManager` singleton
- Grouped as: validation wrappers, utility wrappers, focus restoration helpers, DOM creation wrappers
- Mostly pure delegation, but includes `initTaskDOMManager()` (~30 lines) which has initialization logic and side effects (creates the singleton instance)
- Risk: Low — wrappers are thin delegation; `initTaskDOMManager()` is the only non-trivial function and could stay in the parent

**Assessment:** Medium priority. The wrapper layer is the biggest single chunk, but it's also the simplest code in the file (just delegation). Extracting it reduces line count but doesn't reduce complexity.

---

## Deferred: migrationManager.js (1,476 lines)

Previously assessed as acceptable ("working code, not a problem"). Migration code is write-once infrastructure that rarely changes.

If revisited:
- **`migrationFallback.js` (~300 lines)** — fallback mode, recovery UI, `showCriticalError()`
- Risk: Medium — fallback paths are hard to test and rarely exercised

---

## Deferred: moduleLoader.js (1,332 lines)

Infrastructure code that rarely changes. The ~492-line `buildModuleDependencies()` function is large but self-contained — it's a single responsibility (mapping manifest declarations to actual dep values).

If revisited:
- **`dependencyBuilder.js` (~600 lines)** — `buildModuleDependencies()` (~492 lines) + helper functions (`findProviderModule`, `buildDependencyGraph`, `findCycles`)
- Remaining `moduleLoader.js` (~730 lines)
- Risk: Medium — this is boot-critical code; any regression breaks all modules

---

## Recommended Execution Order

1. **routineSwitcher theme picker** — smallest extraction (~110 lines), most isolated, lowest risk
2. **routineSwitcher preview** — medium extraction (~250 lines), desktop-only feature
3. **routineSwitcher search/sort/filter** — medium extraction (~240 lines), stateless transforms
4. **undoIndexedDB** — small extraction (~190 lines), needs interface for module-level refs
5. **taskDOMCompat** — large extraction (~450 lines), mostly pure delegation
6. **undoSnapshotManager** — small extraction (~190 lines), needs interface for AppGlobalState fields
7. **recurringPanelAddTask** — if desired (~275 lines), low priority

Each extraction should be done as a separate commit with full test verification before proceeding to the next.

---

## Execution Checklist (Per Extraction)

1. Create the new sub-module file in the same directory as the parent
2. Move functions/methods to the new file, exporting them
3. Add dynamic versioned import in the parent's `init()` or constructor
4. Store references and update delegation calls in the parent
5. Do NOT add a manifest entry — sub-modules are internal
6. Run `npm run lint` — verify no errors
7. Run `npm test` — verify no regressions
8. Manual smoke test of the affected feature
9. Commit with descriptive message

---

## What This Does NOT Change

- No manifest entries added or removed
- No public API changes (parent's `provides` list stays the same)
- No DI wiring changes
- No boot sequence changes
- No new dependencies introduced
