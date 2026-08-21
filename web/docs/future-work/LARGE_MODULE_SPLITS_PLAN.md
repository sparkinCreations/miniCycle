# Large Module Splits Plan

**Date:** March 15, 2026
**Updated:** August 21 2026 — four previously-unassessed modules given verdicts; scripts brought into scope (`update-version.sh`); the last inline line counts removed, since the doc had retired them in principle but kept four in practice and all four had drifted. August 2026 — Priority 2 (statsPanel) SHIPPED (commit `806f8082`); line-count table retired (numbers rot — see [PROJECT_STATS.md](../PROJECT_STATS.md)). July 7, 2026 — god-module audit: added statsPanel (Priority 2), orchestrator assessment, false-positive list
**Status:** In progress — Priorities 2 and 6 complete; Priorities 1, 3, 4, 5 open, plus 7 (`update-version.sh`) added Aug 21 2026
**Related:** [DI_MIGRATION_COMPLETION_PLAN.md](../archive/DI_MIGRATION_COMPLETION_PLAN.md), [ENFORCE_REQUIRES_ROLLOUT_PLAN.md](../archive/ENFORCE_REQUIRES_ROLLOUT_PLAN.md)

---

## Problem

Several modules exceed 1,300 lines and handle multiple distinct responsibilities. Large modules are harder to navigate, test in isolation, and modify without unintended side effects.

This doc no longer pins line/dep/method counts — every measured number in the previous revision of this table had drifted by August 2026. For current volatile metrics see [PROJECT_STATS.md](../PROJECT_STATS.md); for a specific module, measure it fresh (`wc -l`) before extracting. Candidates by verdict:

| Module | Verdict |
|--------|---------|
| routineSwitcher.js (`modules/routine/`) | **God module** — Priority 1 (largest non-data module, and still the fastest-growing) |
| onboardingManager.js | Borderline (sequential step content) |
| undoRedoManager.js | Split planned (Priority 3) |
| statsPanel.js (`modules/features/`) | **God module** — Priority 2 — ✅ **SHIPPED** (commit `806f8082`, see below) |
| guidedTourManager.js | Borderline (sequential step content) |
| recurringPanel.js | Already split (5 sub-modules) |
| taskDOM.js | Already split (6 sub-modules) |
| moduleLoader.js | Deferred (boot infrastructure) |
| migrationManager.js (`modules/routine/`) | Deferred (working code) |
| orchestrator.js | Deferred (see below) |
| notifications.js (`modules/utils/`) | **Priority 6** — ✅ **SHIPPED** (v2.463; `EducationalTipManager` → `utils/educationalTips.js`) |
| taskViewLayoutManager.js | Not a god module — one feature, low fan-out (assessed Aug 21 2026) |
| quickActionsManager.js | Not a god module — one feature (assessed Aug 21 2026) |
| settingsUIManager.js | Not a god module — **repetition, not spread** (assessed Aug 21 2026) |
| `scripts/update-version.sh` | **Candidate — Priority 7**, and the highest blast radius on this page (see Scripts, below) |

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
- **Data files** — `defaultLabels.js`, `constants.js`: pure data; centralizing them is an explicit project rule. Both are larger than most modules on this page and always will be — that is the design, not drift.
- **Orchestrators with high fan-out but one job** — `taskCycleReset.js`, `menuManager.js`: cycle reset and the main menu touch everything by nature. High fan-out, single purpose.
- **Boot infrastructure** — `moduleLoader.js`, `moduleManifests.js`: centralization is the design.
- **`migrationManager.js`** — previously ruled acceptable (working write-once code).

---

## August 21 2026 — Four Modules the Audit Had Never Assessed

Three of these post-date the July 2026 audit; one predates it and was simply missed. All four are
now among the ten largest files under `modules/`, so their absence made the candidate table read as
complete when it was not. Verdicts use the same three signals — size, fan-out, responsibility spread
— and the same rule: a module qualifies only when **all three** are high AND the responsibilities
span multiple user-facing domains.

### `notifications.js` — Priority 6 — ✅ SHIPPED (v2.463)

The only one of the four that qualifies, and it comes with its seam already drawn: the file holds
**two classes**, `EducationalTipManager` and `MiniCycleNotifications`. The tip manager is a distinct
feature — teaching moments tied to app state — that happens to live in the notifications file
because tips are delivered as notifications. Delivery mechanism and pedagogy are different jobs.

**Outcome (v2.463).** `EducationalTipManager` (210 lines) moved to
`modules/utils/educationalTips.js`; `notifications.js` went 1,928 → 1,741 and keeps a
**re-export** so the test harness and every existing importer reach the class unchanged.
The extraction was as clean as predicted — one coupling point, `new EducationalTipManager(() => this.deps)` —
but three things surfaced that a size-and-class-boundary read did not predict, and they are
the reusable lesson for the remaining splits:

1. **A module-scoped helper came along invisibly.** The class called `_safeAddEventListener`,
   defined in `notifications.js` and closing over its `_deps` proxy. Scanning for "what does
   this class reference" with a guessed list of names missed it; **ESLint's `no-undef` caught
   it**. The fix takes deps explicitly rather than importing the twin back — a circular ESM
   edge between two BOOT_CRITICAL modules is not worth saving four lines.
2. **The re-export is a silent seam.** Dropping `export { EducationalTipManager }` throws
   nothing at the source: importers get `undefined`, and the harness's
   `window.EducationalTipManager = mod.EducationalTipManager` quietly assigns it. Guarded now.
3. **The deps getter is load-bearing and easy to "simplify" away.** Capturing deps by value at
   construction passes 46 of 47 tests — everything except the one written for it. Late-injected
   deps would simply never arrive.

Fan-out is moderate rather than alarming, which is why this was Priority 6 and not higher: the size
comes from one large class, not from wiring breadth. Extract `EducationalTipManager` first — it is
already class-boundaried, so the extraction is a move rather than a carve.

### `taskViewLayoutManager.js` — NOT a god module

High on size, **low on fan-out**, and it does exactly one thing: the drag-to-reorder layout for the
task view. Long because dragging is fiddly — pointer maths, snap targets, coalesced writes — not
because it accreted unrelated work. This is the case the methodology exists to protect: a size-only
tool flags it, all three signals together do not.

### `quickActionsManager.js` — NOT a god module

One feature domain (the Quick Actions panel: slots, picker, views, tooltip), moderate fan-out. Its
usage-tracking concern was **already extracted** to `actionUsage.js`, which is the split this module
needed and has had. Re-examine only if it grows a second user-facing domain.

### `settingsUIManager.js` — NOT a god module, but a real problem of a different kind

This one scores highest of the four on every raw signal — most deps, most methods, most exports —
and is nonetheless **not** a god module, which makes it the most instructive entry here.

It is **23 near-identical `setupXToggle()` functions** plus `initAllToggles()`. Every signal is
inflated by repetition of one job, not by spread across jobs: the dep count is high because each
toggle needs its own bits, and the export count is one per toggle. Splitting it would produce two
files of the same repetition.

The fix it actually wants is a **declarative toggle table** — id, settings key, default, optional
side-effect — with one generic wiring function, so adding a setting is a row rather than a
function. That is a different refactor from anything else on this page, and it is worth recording
here precisely so nobody "solves" this file by cutting it in half.

Note also what it is: a **sub-module of the `settingsManager` facade** that has itself grown to near
the size of the modules the facade pattern was meant to tame. Extracting into sub-modules moves work
rather than shrinking it; sub-modules need re-measuring too.

---

## Scripts — In Scope As Of August 21 2026

This plan covered `modules/` only. That excluded the **second-largest file in the repository**.

### `scripts/update-version.sh` — CANDIDATE (Priority 7)

Larger than every module except `defaultLabels.js`, and structurally unlike anything else here:
roughly **30 labelled stages and only four functions**. It is a linear procedure, so almost none of
it is callable — and therefore almost none of it is testable — in isolation.

**Why it belongs on this page despite not being a module:** blast radius. It is the release gate.
Every app-code change ships through it, and a bug in it does not fail loudly — it produces a
half-dark deploy. That is not hypothetical: an August 2026 review found a `$SCRIPT_DIR` reference
that belonged to a generated `restore.sh` heredoc being read as if it were the script's own
variable. Under `set -euo pipefail` that would have aborted **every release** until someone
diagnosed it.

**The pattern already exists here, and it worked.** The changelog-range logic was extracted to
`scripts/changelog-range.sh` and immediately gained `scripts/test-changelog-range.sh` — five tests,
including the boundary case that had shipped three wrong changelogs. That is the model: a stage
becomes a script, and a script can have tests.

Best candidates, by the same "most isolated first" ordering used above:

1. **CSP hash regeneration** — already shells out to a Python validator; the stage is glue.
2. **The `?v=` cache-buster sweep** across HTML/CSS/manifests — a pure text transform over a file
   list, which is exactly the shape that tests well.
3. **`restore.sh` generation** — self-contained, and the heredoc quoting is precisely where the
   `$SCRIPT_DIR` bug lived.

Not urgent. But the next time a release-script bug costs an afternoon, this is the reason, and
these are the seams.

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

## Priority 1: routineSwitcher.js — untouched, all target methods still inline

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
8. ~~**EducationalTipManager** out of `notifications.js`~~ — ✅ **SHIPPED v2.463** (Priority 6)
9. **`update-version.sh` stages** — CSP regeneration first, then the `?v=` sweep; each becomes a script that can have tests, following `changelog-range.sh` (Priority 7)

✅ Done (removed from the order): **statsPanel gestures + rewards** — shipped as `statsPanelGestures.js` + `statsPanelRewards.js` (commit `806f8082`; see Priority 2).

Opportunistic (no scheduled slot): **orchestrator bootUI/bootTiming split** — next time boot timing code is touched.

Not an extraction, but recorded so it is not mistaken for one: **`settingsUIManager`'s 23 repeated
`setupXToggle()` functions want a declarative toggle table**, not a split. See the August 21 2026
assessment above.

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
