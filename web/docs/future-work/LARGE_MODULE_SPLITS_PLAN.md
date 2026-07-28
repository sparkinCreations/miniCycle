# Large Module Splits Plan

**Date:** March 15, 2026
**Updated:** July 7, 2026 — god-module audit: added statsPanel (Priority 2), orchestrator assessment, false-positive list; refreshed line counts
**Status:** Not Started
**Related:** [DI_MIGRATION_COMPLETION_PLAN.md](../archive/DI_MIGRATION_COMPLETION_PLAN.md), [ENFORCE_REQUIRES_ROLLOUT_PLAN.md](./ENFORCE_REQUIRES_ROLLOUT_PLAN.md)

---

## Problem

Several modules exceed 1,300 lines and handle multiple distinct responsibilities. Large modules are harder to navigate, test in isolation, and modify without unintended side effects.

Line counts as of July 2026. "DI deps" = `required()`/`optional()` declarations in the module's DI block; "methods" = approximate class-method count.

| Module | Lines | DI Deps | ~Methods | Verdict |
|--------|-------|---------|----------|---------|
| routineSwitcher.js | 2,578 | 33 | 48 | **God module** — Priority 1 |
| onboardingManager.js | 2,369 | 14 | 40 | Borderline (sequential step content) |
| undoRedoManager.js | 2,073 | 17 | — | Split planned (Priority 3) |
| statsPanel.js | 1,975 | 23 | 61 | **God module** — Priority 2 |
| guidedTourManager.js | 1,962 | 10 | — | Borderline (sequential step content) |
| recurringPanel.js | 1,930 | 25 | — | Already split (5 sub-modules) |
| taskDOM.js | 1,825 | 12 | — | Already split (6 sub-modules) |
| moduleLoader.js | 1,750 | — | — | Deferred (boot infrastructure) |
| migrationManager.js | 1,501 | 7 | — | Deferred (working code) |
| orchestrator.js | 1,027 | — | — | Deferred (see below) |

Note: routineSwitcher grew from 2,092 → 2,578 lines between March and July 2026 (inline-edit modal, recently-used rendering, routine selection, data validation/repair). It is growing fastest of the candidates — another reason it stays Priority 1.

---

## July 2026 God-Module Audit — Methodology & Verdicts

Line count alone over-flags. The audit combined three signals: **size** (lines), **fan-out** (DI deps declared), and **responsibility spread** (distinct method clusters). A module qualifies only when all three are high AND the responsibilities span multiple user-facing feature domains.

**Confirmed god modules (2):**
- `routineSwitcher.js` — six distinct jobs: switcher modal lifecycle, routine CRUD (rename/delete/duplicate/download), inline editing, vocab theme picker, preview pane + popout review modal, list infrastructure (search/sort/filter/recently-used/storage bar/validation-repair).
- `statsPanel.js` — highest method count in the codebase (~61). Gesture *detection* was already extracted to `gesturePanelManager`, but statsPanel still hosts ~12 gesture handler-method bodies (touch/mouse/pointer/wheel/keyboard), plus stats rendering, theme-unlock logic, nav dots, and launcher code for four other modals.

**Borderline (not scheduled):** `onboardingManager.js`, `guidedTourManager.js` — big but inherently sequential step content; long ≠ god unless they accrete non-onboarding work. `recurringPanel.js` — already split; see Priority 4.

**Not god modules (false positives a size/dep-count tool will flag):**
- **The four facades** — `settingsManager` (35 deps), `taskCore` (29), `taskDOM`, `preferencesManager`: high dep counts are the point of the facade pattern; they wire sub-modules. Intentional.
- **Data files** — `defaultLabels.js` (2,688 lines), `constants.js` (1,609): pure data; centralizing them is an explicit project rule.
- **Orchestrators with high fan-out but one job** — `taskCycleReset.js` (29 deps, 948 lines), `menuManager.js` (26 deps, 811 lines): cycle reset and the main menu touch everything by nature. High fan-out, single purpose.
- **Boot infrastructure** — `moduleLoader.js`, `moduleManifests.js`: centralization is the design.
- **`migrationManager.js`** — previously ruled acceptable (working write-once code).

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

## Priority 1: routineSwitcher.js (2,578 lines)

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

**Remaining routineSwitcher.js (~1,900 lines)**
- Core modal, CRUD, list management, inline edit, export, storage bar
- Note (July 2026): extraction estimates above are from the March audit; the module has since grown ~486 lines. Re-measure method boundaries before extracting — the theme picker and preview clusters have gained methods (`_selectTheme`, `_openPreviewReviewModal`, `_resetPreview`).

---

## Priority 2: statsPanel.js (1,975 lines) — added July 2026

### Current Responsibilities
- View switching (task view ↔ stats panel), nav dots, view announcements
- Gesture **handler bodies** (~12 methods: touch/mouse/pointer/wheel/keyboard) — detection/registration already lives in `gesturePanelManager`, but the handlers remain here
- Stats rendering + task-stats caching (`updateStatsPanel`, `getCachedTaskStats`, `invalidateTaskStatsCache`)
- Vocab theme unlock logic (`updateThemeUnlockStatus`, `updateThemeMessages`, `unlockThemesIfEligible`, themes panel open/close)
- Launcher code for four other modals (themes, history, cleared tasks, achievements)
- Collapsible-section preferences, quick dark-mode toggle, feature button injection

### Proposed Extractions (2 dynamic sub-modules)

**`statsPanelThemeUnlocks.js` (~200 lines)**
- `updateThemeUnlockStatus()`, `updateThemeMessages()`, `unlockThemesIfEligible()`, `handleThemeToggleClick()`, `openThemesPanel()`, `closeThemesPanel()`
- Self-contained vocab-theme concern; talks to `vocabThemeManager` (already an optionalDep)
- Risk: Low–Medium — unlock flow fires on cycle completion; verify notification timing after extraction

**`statsPanelGestures.js` (~250 lines)**
- The ~12 `handle*` gesture methods + `resetMouseDrag()`, `_syncGestureManager()`
- Handlers mutate view state, so they need a narrow interface back to the parent (current view index, `showTaskView`/`showStatsPanel`)
- Alternative worth evaluating first: move handler bodies INTO `gesturePanelManager` since registration already lives there — one gesture home instead of two
- Risk: Medium — multi-input-mode code is easy to regress; test on touch + trackpad + keyboard

**Remaining statsPanel.js (~1,500 lines)**
- View lifecycle, stats rendering, caching, modal launchers, preferences

---

## Priority 3: undoRedoManager.js (2,073 lines)

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

## Priority 4: recurringPanel.js (1,930 lines)

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

**Assessment:** Low priority. The existing 5 sub-modules already demonstrate good splitting. The remaining ~1,930 lines include the class skeleton, lifecycle methods, and coordination logic that naturally belongs in one place.

---

## Priority 5: taskDOM.js (1,825 lines)

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

## Deferred: migrationManager.js (1,501 lines)

Previously assessed as acceptable ("working code, not a problem"). Migration code is write-once infrastructure that rarely changes.

If revisited:
- **`migrationFallback.js` (~300 lines)** — fallback mode, recovery UI, `showCriticalError()`
- Risk: Medium — fallback paths are hard to test and rarely exercised

---

## Deferred: moduleLoader.js (1,750 lines)

Infrastructure code. The large `buildModuleDependencies()` function is self-contained — a single responsibility (mapping manifest declarations to actual dep values). Note: grew ~418 lines between March and July 2026 (depMappings additions, DI DOM helpers); if growth continues, revisit.

If revisited:
- **`dependencyBuilder.js`** — `buildModuleDependencies()` + helper functions (`findProviderModule`, `buildDependencyGraph`, `findCycles`)
- Risk: Medium — this is boot-critical code; any regression breaks all modules

---

## Deferred: orchestrator.js (1,027 lines) — assessed July 2026

Four concerns in one file:

1. **Sequence control** (its actual job) — `runBootSequence()`, `initApp()`, `startOrchestrator()`, `loadDependencies()`, `withTimeout()`
2. **Boot UI** — `updateLoaderProgress()`, `showUpdatingOverlay()`, `showBootError()`, `getErrorDetails()`, `escapeHtml()`, `ensureBootModalTemplate()`
3. **Version/SW coordination** — `gateOnServerVersion()`, `checkProductionVersionGuard()`, `waitForServiceWorker()`, `isCacheError()`
4. **Boot timing instrumentation** (June 2026 perf work) — `markBoot()`, `measureBoot()`, `clearBootTiming()`, `getBootTiming()`

By responsibility count it qualifies as a god module, but it's graded a tier below routineSwitcher/statsPanel: it's phase-0 code that runs before the DI framework and module loader exist, so it *cannot* delegate the way ordinary modules do — some accretion is inherent. `CLAUDE.md` already documents it as "sequence control + boot UI + early boot coordination" (documented intent, not drift).

If revisited, the split is unusually low-risk precisely because it's pre-DI — no manifests, no DI pipeline, no facade pattern:
- **`boot/bootUI.js`** — loader progress, updating overlay, error screen (concern 2)
- **`boot/bootTiming.js`** — mark/measure instrumentation (concern 4)
- Both are plain static imports from sibling files (follow existing boot-file import conventions re: cache-busting)
- Remaining orchestrator.js: ~500–600 lines of pure sequence + version-gating logic

**Trigger:** not worth a dedicated refactor session; do it opportunistically next time the boot timing code is touched (e.g., continuing the load-perf investigation).

---

## Recommended Execution Order

1. **routineSwitcher theme picker** — smallest extraction (~110 lines), most isolated, lowest risk
2. **routineSwitcher preview** — medium extraction (~250 lines), desktop-only feature
3. **routineSwitcher search/sort/filter** — medium extraction (~240 lines), stateless transforms
4. **statsPanel theme unlocks** — (~200 lines), self-contained vocab-theme concern
5. **statsPanel gestures** — (~250 lines), evaluate merging into `gesturePanelManager` first
6. **undoIndexedDB** — small extraction (~190 lines), needs interface for module-level refs
7. **taskDOMCompat** — large extraction (~450 lines), mostly pure delegation
8. **undoSnapshotManager** — small extraction (~190 lines), needs interface for AppGlobalState fields
9. **recurringPanelAddTask** — if desired (~275 lines), low priority

Opportunistic (no scheduled slot): **orchestrator bootUI/bootTiming split** — next time boot timing code is touched.

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
