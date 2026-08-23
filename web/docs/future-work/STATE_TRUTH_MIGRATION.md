# State-as-Truth Migration — Gen 1 leftovers on the cycle loop

**Status:** Open plan (nothing in this doc has been implemented)  
**Raised:** 2026-08-23 · **Against:** v2.483  
**Source:** Independent code review of boot, AppState, DI, completion/reset, both task renderers, undo wrapper, drag-drop, reminders, daily reset, history, `.mcyc` payload, import, `featureBoot` API allow-lists, and `moduleLoader` `ENFORCE_REQUIRES`  
**Premise:** The repaired modules are Gen 3 (state is truth). The **name of the app** — “all tasks done → reset” — is still Gen 1 (DOM `.checked`). That split is the work.

> **Before acting on any row:** [REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) §0 — findings here are reliably right about *location* and unreliably right about *mechanism*. Re-read the symbol, run the smallest probe, then fix. Line numbers will drift; prefer names.

**Related (do not duplicate):**

- [REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) — fault lines this review kept hitting
- [SCHEMA_2_6_PLAN.md](./SCHEMA_2_6_PLAN.md) — `cycles` vs routine naming; this doc’s #20 is identity (name-key vs UUID), not the rename
- [APPSTATE_MERGE_STATES.md](./APPSTATE_MERGE_STATES.md) — tab conflict merge; this doc’s persistence items are `update()` / `get()` / rollback
- [RECURRING_TASKS_P3_FOLLOWUP.md](./RECURRING_TASKS_P3_FOLLOWUP.md) — leftover recurring polish; #26 (monthly 1st-of-month fallback) lives here because it is a user-visible date bug
- [HOW_MINICYCLE_WORKS.md](../start-here/HOW_MINICYCLE_WORKS.md) — intended architecture (`update()` is the door)
- Archived [RENDER_PATH_UNIFICATION.md](../archive/RENDER_PATH_UNIFICATION.md) — runtime renderer shipped; **boot path did not**

---

## What “done” looks like

One vertical slice, same behaviour after **boot**, **undo**, **daily auto-uncheck**, and **completed-dropdown**:

1. Checking the last task in Auto Cycle completes and resets from `cycle.tasks[].completed`, not from checkbox DOM.
2. Boot and undo/refresh use the **same** task projection (`TaskRenderer.renderTasks` or a shared helper).
3. Add / complete / reset read `AppState` **unguarded** (`required()`), so a wiring miss throws instead of moving the checkbox with no save.
4. One user gesture → one undo snapshot (wrapper + `isResetting` / `{ system: true }` / mode-switch boundary — not a fourth capture at every call site).

Until that slice is true, more features will pass tests and still feel haunted on a phone.

---

## Three generations (how to read the tree)

| Gen | Rule | Still in |
|-----|------|----------|
| **1** | DOM is the database | `checkMiniCycle`, `updateProgressBar`, `extractTaskDataFromDOM`, boot `renderTasksToDOM` |
| **2** | `AppState.update`, but also the checkbox / DOM order | drag `saveDragReorder`, hybrid reminders settings via `loadMiniCycleData` |
| **3** | State first; DOM is a projection | runtime `TaskRenderer` partition, reminders **tasks**, `dailyResetManager`, `historyManager`, `mcycPayload`, `cycleMode.js`, `ModeManager._checkCycleWithSnapshot` |

Work is **finish the migration**, not invent a fourth framework.

---

## Implementation order

Do not start at schema 2.6 or UUID keys. Collapse Gen 1 on the loop first.

| Band | Items | Why first |
|------|-------|-----------|
| **P0** | #1–#5 | Completion + one renderer |
| **P1** | #6–#13, #14–#19 | Undo/mutation + DI on the same loop |
| **P2** | #20–#31, #32–#34 | Schema fossils, recurring dates, XSS sinks, product notes |
| **P3** | #35–#42 | Hygiene when touching those files |

---

## P0 — the name of the app is still on the DOM

### #1 Cycle complete is derived from checkboxes

**Where:** `checkMiniCycle` in `modules/progress/cycleCompletion.js` — `allTasks.every(task => task.querySelector("input")?.checked)` over `#taskList` + `#completedTaskList` children.

**Fix:** `areAllTasksComplete(cycle)` from `cycle.tasks` (state). Use for auto-reset, manual complete-button visibility, and any “is this routine done?” check. Do not treat a filtered/hidden **render** as the routine.

**Tests:** Auto-cycle with completed dropdown on; filtered list; last checkbox after boot vs after undo.

### #2 Progress bar uses the same DOM walk

**Where:** `updateProgressBar` in the same module.

**Fix:** Same helper as #1; `completed / total` from the active cycle’s task array.

### #3 Hardcoded IDs next to real constants

**Where:** `getElementById('completedTaskList')`, `getElementById('task-view')` in `cycleCompletion.js`. Constants exist (`DOM_IDS.COMPLETED_TASK_LIST`, etc.).

**Fix:** Use `DOM_IDS` / `DOM_SELECTORS`. Trivial once #1–#2 stop needing the completed list for counting.

### #4 Boot render ≠ runtime render

**Where:**

- Boot/switch: `renderTasksToDOM` in `modules/routine/routineLoader.js` — `list.innerHTML = ''`, then `addTask(task.text || task.taskText || '', options)` with `isLoading: true`. No completed-list partition.
- Runtime: `TaskRenderer.renderTasks` — DocumentFragment, `replaceChildren`, split on `task.completed === true`, `addTask(task.text)` only.

**Fix:** Boot and routine switch call the same projector as undo/refresh. Keep `isLoading` so add does not mint new ids. Runtime comments on why DOM order is load-bearing (drag-drop, arrows, un-complete) apply to first paint too.

**Overlap:** Archived render-path unification claimed this shipped; only the **runtime** half did.

### #5 Runtime drops `taskText`; boot still accepts it

**Where:** Renderer `addTask(task.text, …)` vs boot `task.text || task.taskText`.

**Fix:** One helper: `task.text ?? task.taskText ?? ''`. Stop writing `taskText` on live tasks (cleared-task entries keep `taskText` by schema).

---

## P1 — mutation / undo can lie

### #6 `AppState.get()` is the live tree

**Where:** `MiniCycleState.get()` in `modules/core/appState.js`.

**Fix:** Law stays: never mutate the return. Optional: freeze in debug builds, or `getCopy()`. Grep for assignment / `.push` on `get()` results after any nearby change (CLAUDE.md #13).

### #7 `update()` rollback does not redraw

**Where:** `update()` `catch` restores the clone, shows `notify.stateUpdateFailed`, rethrows — **no** `notifyListeners`.

**Fix:** After restore, notify subscribers so the screen is not left on a mutation that was undone. (Documented in HOW_MINICYCLE_WORKS; still missing in code.)

### #8 Undo is a slice plus extra captures

**Where:** `wrapAppStateForUndo` is supposed to be the single source (`useUpdateWrapper`). Call sites still snapshot: `taskCompletion`, `taskCRUD` (pre-add), `dragDropManager`, `titleManager`, `taskCycleReset`, `ModeManager._checkCycleWithSnapshot`.

Dedupe (`_sig` + min interval + last-on-stack identical) often makes doubles a no-op until someone mutates `get()` then calls `update`, or `isResetting` is late.

Snapshots are a **cycle slice** (tasks, templates, title, modes, cycleCount, theme, clearedTasks, `taskViewLayout`) — not full AppState.

**Fix:** Wrapper-only for `update()` paths. Keep **one** gesture-boundary snapshot where the executor no longer captures (mode-switch → auto-reset). Do not snapshot celebration flags as their own undo steps (#9).

### #9 Many `update()`s per cycle complete

**Where:** `incrementCycleCount` — count + `cyclesCompleted`, then `firstCycleCelebrated`, then 100/500 flags, then `logHistoryEvent` (another `update`).

**Fix:** One producer: increment + flags + history event. One wrapper snapshot. Keep `actualNewCount` in outer scope (already learned).

### #10 Drag order from DOM; arrows from state

**Where:** Arrow path: `AppState.update` reorders the array. `saveDragReorder`: `querySelectorAll` task ids on `#taskList`, then append `missingTasks` (completed-in-dropdown).

**Fix:** After #4, active-list DOM order should match incomplete tasks; keep the merge. Prefer the drag model if you have ids without scraping. Do not scrape boot-path lists that still dump completed rows into `#taskList`.

### #11 `saveCycleData` replaces the whole cycle object

**Where:** `routineLoader.js` — `state.data.cycles[activeCycle] = currentCycle`.

**Fix:** Mutate fields on the existing cycle inside `update()`. Never assign a stale clone over watcher/recurring writes.

### #12 `setAppStateDependencies` spreads

**Where:** `appState.js` — `_deps = { ..._deps, ...dependencies }`.

**Fix:** `Object.defineProperties` like every other setter. Phase-1 “exception” is historical, not required.

### #13 `isInitializing` blocks undo until first task/title action

**Where:** `taskViewLayoutManager` header: wrapper skips snapshots while `AppGlobalState.isInitializing`; only some modules flip it.

**Fix:** `enableUndoSystemOnFirstInteraction` on first **any** user gesture (layout, mode, checkbox), or clear the flag when UI is interactive.

---

## P1 — DI advertised vs DI on the hot path

### #14 `required()` warns and returns `null`

**Where:** `diBase.js` — missing required deps do **not** throw. Fail-fast is a contributor rule (unguarded read), not `resolve()`.

**Fix:** Throw from `resolve()` when boot is interactive / `strict`, **or** stop calling it required. Keep unguarded reads.

### #15 Hot path declares `AppState: optional(null)` and `?.`

**Where:** `taskCompletion.js`, `taskCRUD.js`, `taskCycleReset.js`, `taskRenderer.js`, `backupManager.js`, `cycleCompletion.js` (and more). Contrast: `cycleImportManager`, `historyManager`, `dailyResetManager` use `required()`.

**Fix:** `AppState: required()` on add / complete / reset / backup. Unguarded `.get()` / `.update()`. `validate:chains` then applies.

### #16 Renderer and drag-drop copy deps at construct

**Where:** `TaskRenderer` / `DragDropManager` assign `this.deps = { AppState: resolvedDeps.AppState, … }` then `injectDependency` as a patch.

**Fix:** `get deps() { return di.resolve(); }` like `ModeManager`.

### #17 `featureBoot` `*ApiObj` is a silent allow-list

**Where:** `registerGroupedApisFromLoader` in `featureBoot.js` — a method the manifest delivers is dropped unless named here.

**Fix:** Same PR as the method: add the key. `validate:api` stays the gate.

### #18 `ENFORCE_REQUIRES` + `deps.foo?.()` = missing feature, no throw

**Where:** `moduleLoader.js` — `ENFORCE_REQUIRES = true`; undeclared deps are absent; optional chaining no-ops. Warn-on-read accessors exist because this shipped (v2.418).

**Fix:** Do not optional-chain required APIs. Treat undeclared-dep warnings after interactive boot as failures.

### #19 Four wiring lists

**Where:** DI schema, manifest `requires` / `lazyRequires`, `depMappings`, `*ApiObj`.

**Fix:** Do not add a fifth. Follow [MAKING_CODE_CHANGES.md](../working-on-code/MAKING_CODE_CHANGES.md). Prefer generating `depMappings` ([AUTO_GENERATED_DEPMAPPINGS_PLAN.md](./AUTO_GENERATED_DEPMAPPINGS_PLAN.md)) over more hand lists.

---

## P2 — schema / identity fossils

### #20 Cycles keyed by display name + later `id`

**Fix:** New writes: stable UUID map key; `title` is the name. One migration. Do **not** confuse with Schema 2.6’s `cycles` → `routine` rename ([SCHEMA_2_6_PLAN.md](./SCHEMA_2_6_PLAN.md)).

### #21 `text` vs `taskText`

**Fix:** Live tasks always `text`. Cleared entries always `taskText`. One import/load normalizer. Ties to #5.

### #22 `schemaVersion` is the string `"2.5"`

**Fix:** Equality only, or integer/`{major,minor}`. Never `>` string versions (`"2.5" > "2.10"`).

### #23 Export invents ids with `Date.now()` + `Math.random()`

**Where:** `buildMcycPayload` in `modules/utils/mcycPayload.js`.

**Fix:** Same `generateId()` as CRUD if `task.id` is missing.

### #24 Recurring templates vs tasks can orphan

**Fix:** Explicit policy on task delete (keep stamp vs delete template). On load: prune or show orphans in the recurring panel.

### #25 `loadMiniCycleData` still in the living graph

**Where:** `statsPanel`, `modeManager`, `reminders` (settings vs tasks already split), `featureBoot` `stateApiObj`.

**Fix:** AppState only. Then delete the dep.

---

## P2 — recurring / dates

### #26 Monthly “pattern doesn’t exist” → 1st of month

**Where:** `calculateNextMonthly` in `recurringCalculators.js` — `new Date(nextYear, nextMonth, 1)` fallback.

**Fix:** Scan forward months until the nth-weekday exists ([REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) §7). Never fire on a day the user did not pick.

### #27 Dual instance of `recurringSettings`

**Where:** Matcher injects normalizer (`?v=` vs static import). Import manager documents a second copy.

**Fix:** Keep the module **pure**. Do not add instance state. Prefer one versioned import graph.

---

## P2 — XSS / sinks

### #28 `getLabel({ vars })` does not escape

**Where:** `interpolate` in `labelResolver.js` — deliberate (callers pass HTML).

**Fix:** Keep interpolate unescaped. Every `innerHTML` + vars must pre-escape (see `taskOptionsCustomizer`). Consider a validate/lint for `innerHTML` near `getLabel`.

### #29 `trusted: true` / `trustedHTML`

**Where:** `notifications.js`.

**Fix:** No new trusted sinks with user text. Enumerate callers when auditing.

### #30 `routineSwitcher` innerHTML + `modeLabel`

**Fix:** If `modeLabel` is always from `getLabel`, OK. If user/theme string: `textContent` or escape.

### #31 `extractTaskDataFromDOM` is still a save-shaped scrape

**Where:** `TaskUtils.extractTaskDataFromDOM` — completion from checkbox, recurring from `data-*` JSON; `priorityColor` patched to AppState. Still on `appContext` / `featureBoot` as `extractFromDOM` for “dataAccess autoSave.”

**Fix:** Do not persist from this. Delete when unused; until then, do not wire to save.

---

## P2 — product (from code, not taste)

### #32 Three reset concepts

Cycle complete (count++, flip `completed`); to-do clear (`clearedTasks`); daily auto-uncheck (`dailyResetManager` — silent, no `cycleCount`, any cycle, notify on view).

**Fix:** Keep the split. Tests: background-routine daily uncheck must not drive `checkMiniCycle` off the **active** DOM. After #1 this is automatic.

### #33 No cloud sync / device loss

Local-only is architecture. Backup nag / IndexedDB backups are the mitigation. Do not document as sync.

### #34 Surface density

Layout editor, games, tours, Quick Actions compete with the loop. Not a code bug. First-run should not expose all of it. Out of scope for this migration except “don’t add another writer of `completed` without #1.”

---

## P3 — hygiene

| # | Finding | Fix |
|---|---------|-----|
| 35 | `focusMode` still has private mode strings; `cycleMode.js` exists because they drifted | Map `getCycleMode()` → CSS classes; delete the private copy |
| 36 | Cycle-complete overlay `innerHTML` + `getIcon` | OK if icons are trusted constants |
| 37 | History event ids: `Date.now()` + `Math.random().substr` | `generateId()`; `.slice` |
| 38 | `ModeManager` `checkMiniCycle: optional(() => {})` | Missing wiring = mode switch never auto-resets. `required()` or no no-op default |
| 39 | `LIMITS` not always on `<input maxlength>` | Match fields to `LIMITS` |
| 40 | `docs/INDEX.md` stale vs `PROJECT_STATS.md` | Don’t duplicate metrics |
| 41 | Plugin hooks with no `unregisterPlugin` | Remove or add unregister |
| 42 | `lite/` is frozen | Do not “improve” it |

---

## Already fixed (scars — do not reopen)

These were real; the tree now carries the lesson. Regression tests, not new work.

| Scar | Where it landed |
|------|-----------------|
| Recurring spawn on the undo stack | `{ system: true }` / `commitSystemUpdate` (watcher + daily reset) |
| `isSystemMutation` flag eating user undo (F-005) | Intent on the call, not a shared flag around `await` |
| `isResetting` never set after taskCore split | `setResettingFlag` writes `AppGlobalState.isResetting` |
| Reminders from DOM `.checked` | AppState: `remindersEnabled && !completed` |
| Three `.mcyc` builders diverged (history strip, `priorityColor`) | `mcycPayload.js` |
| `highPriority: null` on new tasks | Default `false` |
| Inline font-size `16px` beating phone media query | Remove inline at default |
| Undo cache UTF-16 cap; shed undo before redo (C-08 / C-27) | Shed **redo** first; `length * 2` |
| Quota notifications stacking (F-001) | Notify once per episode |
| Multi-tab last-write-wins without tab identity | `lastModifiedBy` / `_tabId` |
| `provides` without re-export (`navigatePanels`) | Three-panel swipe dead until v2.387; `validate:provides` |
| `required()` + `?.` (v2.418 import / theme) | `validate:chains` + ENFORCE_REQUIRES warnings |
| Tests seeding `metadata.version` / cycle `schemaVersion` | Task `schemaVersion` is the real signal |
| Selectors without `CSS.escape` | `DATA_SELECTORS.taskById` etc. |
| Stored XSS via `recurringSettings.frequency` | Normalizer + sink |
| Corrupt JSON salvage | `dataRecovery.js` + corrupted blob prefix |
| Mode-switch snapshot before auto-reset (v2.362) | `ModeManager._checkCycleWithSnapshot` |
| `deleteWhenCompleteSettings` wholesale replace wiping the other mode | `syncTaskDeleteWhenComplete` per key |

---

## Map of “who answers what” (until P0 ships)

| Question | Who answers today | Target |
|----------|-------------------|--------|
| Is this task done? | `cycle.tasks[].completed` **or** checkbox | State only |
| Is the routine done? | DOM `.every(.checked)` | State only |
| Order after arrows | AppState array | Unchanged |
| Order after drag | DOM ids + leftover tasks | Same merge after one renderer |
| Should I remind? | AppState tasks | Unchanged (already Gen 3) |
| Recurring spawn | Templates + watcher + system update | Unchanged |
| Daily uncheck | Per-cycle settings + tick | Unchanged |
| Persist from the list | `extractTaskDataFromDOM` still exists | Delete / unwire |
| First paint | `innerHTML` + `addTask` | Same as undo render |
| After undo | Fragment + state partition | Unchanged |

---

## Out of scope

- Cloud sync, collab, task notes
- Rewriting the DI framework
- Maintaining `lite/`
- Schema 2.6 rename (own plan)
- `mergeStates()` (own plan)
- Generating `depMappings` (own plan) except as it helps #19
