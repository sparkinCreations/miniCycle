# Large Module Splits Plan

**Date:** March 15, 2026
**Updated:** August 2026 — Priority 2 (statsPanel) SHIPPED (commit `806f8082`); line-count table retired (numbers rot — see [PROJECT_STATS.md](../PROJECT_STATS.md)). July 7, 2026 — god-module audit: added statsPanel (Priority 2), orchestrator assessment, false-positive list
**Status:** In progress — Priority 2 complete; Priorities 1, 3, 4, 5 open
**Related:** [DI_MIGRATION_COMPLETION_PLAN.md](../archive/DI_MIGRATION_COMPLETION_PLAN.md), [ENFORCE_REQUIRES_ROLLOUT_PLAN.md](../archive/ENFORCE_REQUIRES_ROLLOUT_PLAN.md)

---

## Problem

Several modules exceed 1,300 lines and handle multiple distinct responsibilities. Large modules are harder to navigate, test in isolation, and modify without unintended side effects.

This doc no longer pins line/dep/method counts — every measured number in the previous revision of this table had drifted by August 2026. For current volatile metrics see [PROJECT_STATS.md](../PROJECT_STATS.md); for a specific module, measure it fresh (`wc -l`) before extracting. Candidates by verdict:

| Module | Verdict |
|--------|---------|
| routineSwitcher.js (`modules/routine/`) | **God module** — Priority 1 (largest module, ~2,574 lines as of v2.412, and fastest-growing) |
| onboardingManager.js | Borderline (sequential step content) |
| undoRedoManager.js | Split planned (Priority 3) |
| statsPanel.js (`modules/features/`) | **God module** — Priority 2 — ✅ **SHIPPED** (commit `806f8082`, see below) |
| guidedTourManager.js | Borderline (sequential step content) |
| recurringPanel.js | Already split (5 sub-modules) |
| taskDOM.js | Already split (6 sub-modules) |
| moduleLoader.js | Deferred (boot infrastructure) |
| migrationManager.js (`modules/routine/`) | Deferred (working code) |
| orchestrator.js | Deferred (see below) |

Note: routineSwitcher grew ~500 lines between March and July 2026 (inline-edit modal, recently-used rendering, routine selection, data validation/repair). It is growing fastest of the candidates — another reason it stays Priority 1.

---

## July 2026 God-Module Audit — Methodology & Verdicts

Line count alone over-flags. The audit combined three signals: **size** (lines), **fan-out** (DI deps declared), and **responsibility spread** (distinct method clusters). A module qualifies only when all three are high AND the responsibilities span multiple user-facing feature domains.

**Confirmed god modules (2):**
- `routineSwitcher.js` — six distinct jobs: switcher modal lifecycle, routine CRUD (rename/delete/duplicate/download), inline editing, vocab theme picker, preview pane + popout review modal, list infrastructure (search/sort/filter/recently-used/storage bar/validation-repair).
- `statsPanel.js` — at audit time, highest method count in the codebase (~61). Gesture *detection* was already extracted to `gesturePanelManager`, but statsPanel still hosted ~12 gesture handler-method bodies (touch/mouse/pointer/wheel/keyboard), plus stats rendering, theme-unlock logic, nav dots, and launcher code for four other modals. **✅ Since split — see Priority 2 below (shipped).**

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

Used by: `taskDOM.js` (6 sub-modules), `recurringPanel.js` (5 sub-modules), `settingsManager.js` (5+ sub-managers), `statsPanel.js` (2 sub-modules — the shipped Priority 2 split)

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

## Priority 1: routineSwitcher.js (~2,574 lines as of v2.412 — untouched, all target methods still inline)

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

## Priority 2: statsPanel.js — ✅ SHIPPED (commit `806f8082`)

Shipped in full via Pattern 1 (dynamic versioned sub-module imports). `modules/features/statsPanel.js` (note: `features/`, not `ui/`) is now a ~1,353-line facade (as of v2.412) with two sub-modules in the same directory:

- **`statsPanelGestures.js`** (~384 lines as of v2.412) — the gesture handler bodies, as planned
- **`statsPanelRewards.js`** (~259 lines as of v2.412) — the vocab-theme-unlock/rewards concern. **Shipped name differs from the plan's proposed `statsPanelThemeUnlocks.js`.**

Two proposal-vs-shipped deltas worth remembering:

1. The alternative floated for gestures — merging handler bodies INTO `gesturePanelManager` so there'd be one gesture home — was evaluated and **NOT taken**; handlers stayed statsPanel-side in their own sub-module.
2. Unlike the other facades' `wireSubModuleDependencies()` pattern, statsPanel's sub-modules hold a back-reference to the manager (`this.m`) and reach deps via `this.m.dependencies` / `this.m.rawDeps` — `validate:di` scans them via `FACADE_SUB_FILES`. See [HIDDEN_CODEBASE_INSIGHTS.md](../working-on-code/HIDDEN_CODEBASE_INSIGHTS.md).

Remaining statsPanel.js keeps view lifecycle, stats rendering, caching, modal launchers, and preferences — as the plan intended.

---

## Priority 3: undoRedoManager.js

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

## Priority 4: recurringPanel.js

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

**Assessment:** Low priority. The existing 5 sub-modules already demonstrate good splitting. The remaining bulk is the class skeleton, lifecycle methods, and coordination logic that naturally belongs in one place.

---

## Priority 5: taskDOM.js

### Current State

Already has 6 dynamic sub-modules:
- `taskValidation.js` (TaskValidator)
- `taskUtils.js` (TaskUtils)
- `taskRenderer.js` (TaskRenderer)
- `taskEvents.js` (TaskEvents)
- `taskButtons.js` (TaskButtons)
- `taskDOMPatch.js` (TaskDOMPatch)

### Potential Extraction

**`taskDOMCompat.js` (~450 lines — the wrapper-compatibility region at the bottom of taskDOM.js; find `initTaskDOMManager` and the delegation wrappers around it)**
- Wrapper compatibility layer: module-level functions that delegate to the `taskDOMManager` singleton
- Grouped as: validation wrappers, utility wrappers, focus restoration helpers, DOM creation wrappers
- Mostly pure delegation, but includes `initTaskDOMManager()` (~30 lines) which has initialization logic and side effects (creates the singleton instance)
- Risk: Low — wrappers are thin delegation; `initTaskDOMManager()` is the only non-trivial function and could stay in the parent

**Assessment:** Medium priority. The wrapper layer is the biggest single chunk, but it's also the simplest code in the file (just delegation). Extracting it reduces line count but doesn't reduce complexity.

---

## Deferred: migrationManager.js (`modules/routine/`)

Previously assessed as acceptable ("working code, not a problem"). Migration code is write-once infrastructure that rarely changes.

If revisited:
- **`migrationFallback.js` (~300 lines)** — fallback mode, recovery UI, `showCriticalError()`
- Risk: Medium — fallback paths are hard to test and rarely exercised

---

## Deferred: moduleLoader.js

Infrastructure code. The large `buildModuleDependencies()` function is self-contained — a single responsibility (mapping manifest declarations to actual dep values). Note: grew ~418 lines between March and July 2026 (depMappings additions, DI DOM helpers); if growth continues, revisit.

If revisited:
- **`dependencyBuilder.js`** — `buildModuleDependencies()` + helper functions (`findProviderModule`, `buildDependencyGraph`, `findCycles`)
- Risk: Medium — this is boot-critical code; any regression breaks all modules

---

## Deferred: orchestrator.js — assessed July 2026, updated Aug 2026

Five concerns in one file (see [PROJECT_STATS.md](../PROJECT_STATS.md) for its current line count):

1. **Sequence control** (its actual job) — `runBootSequence()`, `initApp()`, `startOrchestrator()`, `loadDependencies()`, `withTimeout()`
2. **Boot UI** — `updateLoaderProgress()`, `showUpdatingOverlay()`, `showBootError()`, `getErrorDetails()`, `escapeHtml()`, `ensureBootModalTemplate()`
3. **Version/SW coordination** — `gateOnServerVersion()`, `checkProductionVersionGuard()`, `waitForServiceWorker()`, `isCacheError()`
4. **Boot timing instrumentation** (June 2026 perf work) — `markBoot()`, `measureBoot()`, `clearBootTiming()`, `getBootTiming()`
5. **Data-backup cluster** (arrived after this plan was written) — `collectBackupEntries()`, `hasBackupableData()`, `downloadDataBackup()` — boot-failure recovery backup UI; a natural companion to concern 2 if the bootUI split ever happens

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
4. **undoIndexedDB** — small extraction (~190 lines), needs interface for module-level refs
5. **taskDOMCompat** — large extraction (~450 lines), mostly pure delegation
6. **undoSnapshotManager** — small extraction (~190 lines), needs interface for AppGlobalState fields
7. **recurringPanelAddTask** — if desired (~275 lines), low priority

✅ Done (removed from the order): **statsPanel gestures + rewards** — shipped as `statsPanelGestures.js` + `statsPanelRewards.js` (commit `806f8082`; see Priority 2).

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
