# State-as-Truth Migration — Gen 1 leftovers on the cycle loop

**Status:** Open plan — #26 measured Sep 2026: closed by the normalizer; #14 measured Sep 2026: covered, not changed; #11 FIXED Sep 2026 (repair runs inside update()); undo no longer offered with nothing to undo; #16 measured Sep 2026: no live gap, not changed (see it); #15 hot path DONE Sep 2026 (add/complete/reset/render/cycle-complete/backup) (AppState required + unguarded; `validate:chains` now sees local aliases); #13 FIXED Sep 2026 (first real input switches undo on); #8, #9 and #11 measured and found milder than written (see each); #4 and #10 FIXED (v2.541 / v2.540), #24 shipped, #30 verified closed; #1 probed and NOT reproduced, then #1 (auto-reset + due-date paths) and #2 moved to state in v2.562; #1's Complete-button half REPRODUCED and fixed with #3 and #5 (Sep 2026, unreleased at time of writing) — **P0 band closed**  
**Raised:** 2026-08-23 · **Against:** v2.483 · **Amended:** 2026-09-05 against v2.541  
**Source:** Independent code review of boot, AppState, DI, completion/reset, both task renderers, undo wrapper, drag-drop, reminders, daily reset, history, `.mcyc` payload, import, `featureBoot` API allow-lists, and `moduleLoader` `ENFORCE_REQUIRES`  
**Premise:** The repaired modules are Gen 3 (state is truth). The **name of the app** — “all tasks done → reset” — is still Gen 1 (DOM `.checked`). That split is the work.

> **Before acting on any row:** [REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) §0 — findings here are reliably right about *location* and unreliably right about *mechanism*. Re-read the symbol, run the smallest probe, then fix. Line numbers will drift; prefer names.
>
> That warning has now been paid out once: **#10 described the mechanism backwards** and was
> corrected in Sep 2026 only because someone probed it. It was right about the location and
> wrong about which of the two paths corrupts. Probe before you fix.

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
| **1** | DOM is the database | `extractTaskDataFromDOM`, boot `renderTasksToDOM`, the renderer's `tasks-empty` body class (see #1) — `checkMiniCycle`, `updateProgressBar` (v2.562) and `checkCompleteAllButton` (Sep 2026) moved to Gen 3 |
| **2** | `AppState.update`, but also the checkbox / DOM order | drag `saveDragReorder`, hybrid reminders settings via `loadMiniCycleData` |
| **3** | State first; DOM is a projection | runtime `TaskRenderer` partition, reminders **tasks**, `dailyResetManager`, `historyManager`, `mcycPayload`, `cycleMode.js`, `ModeManager._checkCycleWithSnapshot` |

Work is **finish the migration**, not invent a fourth framework.

---

## Implementation order

Do not start at schema 2.6 or UUID keys. Collapse Gen 1 on the loop first.

| Band | Items | Why first |
|------|-------|-----------|
| **P0** | #1–#5 — ✅ all closed Sep 2026 (#4 v2.541, #1–#2 v2.562, #1 button half + #3 + #5 after v2.563) | Completion + one renderer |
| **P1** | #6–#13, #14–#19 | Undo/mutation + DI on the same loop |
| **P2** | #20–#31, #32–#34 | Schema fossils, recurring dates, XSS sinks, product notes |
| **P3** | #35–#42 | Hygiene when touching those files |

---

## P0 — the name of the app is still on the DOM

> **Probed Sep 2026 against v2.540-v2.541 — neither #1 nor #4 reproduced; #4 was then fixed
> anyway (v2.541) because the fork was small to close once measured.** The premise (DOM as
> truth on the cycle loop) is accurate and the debt is real, but the two rows that name a
> concrete failure did not produce one on the triggers this doc itself proposes. That does
> not close them; it re-prices them. See the measured notes on each row below, and treat
> "verified fragile" as a weaker mandate than "verified broken" when sequencing this band
> against work that has a reproduction (as #10 did).
>
> Not probed: #2 (progress bar), #3 (hardcoded ids), #5 (`taskText`). #3 and #5 are tidiness
> and need no reproduction to justify; #2 shares #1's mechanism and would need its own probe.

### #1 Cycle complete is derived from checkboxes — ✅ FIXED (v2.562 + Sep 2026)

**Where:** `checkMiniCycle` in `modules/progress/cycleCompletion.js` — `allTasks.every(task => task.querySelector("input")?.checked)` over `#taskList` + `#completedTaskList` children.

**Fix:** `areAllTasksComplete(cycle)` from `cycle.tasks` (state). Use for auto-reset, manual complete-button visibility, and any “is this routine done?” check. Do not treat a filtered/hidden **render** as the routine.

**Tests:** Auto-cycle with completed dropdown on; filtered list; last checkbox after boot vs after undo.

**Measured Sep 2026 (v2.540) — did NOT reproduce.** Ran this row's own "filtered list" case:
three tasks, search filtered to one, completed the only visible task under Auto Cycle.

```
filtered to 1 of 3 -> {"children":3,"visible":1}
after completing the only VISIBLE task -> {"cycleCount":0,"completed":1,"total":3}
```

The cycle did **not** fire with two tasks undone. Two reasons the obvious triggers are
already covered: `checkMiniCycle` unions `#taskList` **and** `#completedTaskList`, so the
completed-dropdown case is counted; and search hides rows with `display:none`, which leaves
them as `children`, so a filtered row is still counted.

That leaves the genuine exposure narrower than the row implies: a render window in which
`#taskList` holds a *partial* projection (`innerHTML = ''` then repopulate) and a
`checkMiniCycle` fires inside it. Hard to trigger deliberately, and not demonstrated. The
fix is still correct — read `cycle.tasks` — but it is debt paydown on the highest-risk
function in the app, not a bug fix, and should be sequenced accordingly.

**Fixed Sep 2026 (v2.562) — the auto-reset and due-date paths.**

- `checkMiniCycle` reads the active routine's tasks from AppState (`getActiveRoutineTasks()`,
  built on `getActiveRoutine()` in `utils/cycleMode.js`): completion is
  `tasks.every(task => task.completed)`, and the due-date warning is
  `tasks.some(task => task.dueDate)`. The `assignCycleVariables` lookup and the checkbox walk
  over `#taskList` + `#completedTaskList` are gone.
- The Complete All due-date check in `handleCompleteAllTasksImpl` reads `cycleData.tasks` too.
  That also closed a real blind spot: the old DOM scan only looked at `#taskList`, so a due date
  on a task in the completed dropdown never raised the warning.
- The read works on the checkbox path only because the state write lands first: the change
  handler does not await `handleTaskCompletionChange`, and `AppState.update` runs its producer
  synchronously once initialised. "ORDER MATTERS" comments now guard that at `taskDOM`,
  `taskCore`, `taskCompletion`, `AppState.update` and `markAllTasksCompleteImpl`.
- Tests: `cycleCompletion.tests.js` fixtures are state, including cases where the rendered
  checkboxes deliberately disagree with state; `taskCycleReset.tests.js` covers a Complete All
  due date held only in state. Run against the pre-change code, 10 `cycleCompletion` tests and
  the Complete All test fail. `test:journey` (21/21) passed on the change.

**Complete-button half — REPRODUCED and fixed, Sep 2026.** Probed against v2.563 with a
Playwright script driving the real app: manual cycle mode, completed dropdown on, three tasks.

```
BEFORE completing:            taskList 5, dropdown 0, button block
AFTER completing all (live):  taskList 0, dropdown 5, button block   ← right by accident: nothing re-ran the check
AFTER reload (boot render):   taskList 0, dropdown 5, button NONE    ← the bug
```

The boot render partitions every finished row into `#completedTaskList`, then runs
`checkCompleteAllButton`, which counted `#taskList.children` — so a manual-cycle routine whose
tasks were all done lost its Complete Cycle button on reload, the one button that finishes the
cycle. **Verified broken**, not merely fragile (contrast the auto-reset half above).

Fix: `checkCompleteAllButton` reads the active routine from `AppState` (`required()`, unguarded)
— tasks present via `routineHasTasks(routine)`, mode via `getCycleMode(routine)`, no routine → no
button. Body classes and `#taskList` are no longer consulted. The row's shared helper now exists:
`areAllTasksComplete(routine)` in `utils/cycleMode.js`, used by `checkMiniCycle` as well. Pinned
by state-fixture tests in `taskUI.tests.js` (3 of them fail on the old code) and the journey
*"the Complete Cycle button survives every task moving to the dropdown"*, which seeds the exact
scenario, reloads, then completes live and presses the button.

**Still open on this row:**

- **The renderer's `tasks-empty` body class** (`taskRenderer.js`) is toggled from
  `taskList.children.length === 0` — the same DOM count. With every task in the dropdown it
  presumably shows the "no tasks" empty state over a full routine. **Not probed.** Same fix
  shape: `!routineHasTasks(routine)`.
- **Not yet tested:** this row's "last checkbox after boot vs after undo" case.

### #2 Progress bar uses the same DOM walk — ✅ FIXED v2.562

**Where:** `updateProgressBar` in the same module.

**Fix:** Same helper as #1; `completed / total` from the active cycle’s task array.

**Fixed Sep 2026 (v2.562).** `updateProgressBar` computes `completed / total` from
`getActiveRoutineTasks()`, and shows an empty bar when there is no data (first run, and after a
factory reset, where `neutralizeAppState` nulls it). The call inside
`removeRecurringTasksFromCycle` was removed: it ran before the reset producer applied the removal,
so a state-based count there would be stale, and `resetTasksImpl` empties the bar itself.

### #3 Hardcoded IDs next to real constants — ✅ FIXED Sep 2026

**Where:** `getElementById('completedTaskList')`, `getElementById('task-view')` in `cycleCompletion.js`. Constants exist (`DOM_IDS.COMPLETED_TASK_LIST`, etc.).

**Fix:** Use `DOM_IDS` / `DOM_SELECTORS`. Trivial once #1–#2 stop needing the completed list for counting.

**Fixed.** The `getElementById('completedTaskList')` lookups went away with #1–#2 (v2.562);
`getElementById('task-view')` in `showCompletionAnimation` now uses `DOM_IDS.TASK_VIEW` (Sep 2026).

### #4 Boot render ≠ runtime render — ✅ FIXED v2.541

**Where:**

- Boot/switch: `renderTasksToDOM` in `modules/routine/routineLoader.js` — `list.innerHTML = ''`, then `addTask(task.text || task.taskText || '', options)` with `isLoading: true`. No completed-list partition.
- Runtime: `TaskRenderer.renderTasks` — DocumentFragment, `replaceChildren`, split on `task.completed === true`, `addTask(task.text)` only.

**Fix:** Boot and routine switch call the same projector as undo/refresh. Keep `isLoading` so add does not mint new ids. Runtime comments on why DOM order is load-bearing (drag-drop, arrows, un-complete) apply to first paint too.

**Overlap:** Archived render-path unification claimed this shipped; only the **runtime** half did.

**Done in v2.541.** `renderTasksToDOM` no longer renders; it delegates to
`TaskRenderer.renderTasks()` and `loadMiniCycle` awaits it, so everything after step 2 runs
against a finished DOM. The archived unification's remaining half is now shipped.

Cleared before switching, each checked rather than assumed:

| Risk | Finding |
|---|---|
| `renderTasks` unreachable from boot | `taskDOM` is Phase 3, `routineLoader` Phase 6 — and `uiOrchestrator`, also Phase 6, already declares `renderTasks` in `requires` |
| `renderTasks` skips tasks with no `id` | `repairAndCleanTasks()` backfills ids at step 1, before the render |
| Boot's `task.taskText` fallback lost | Dead code — the same repair migrates `taskText` → `text` and deletes it (this is #5's concern at this call site, already handled) |
| `updateSearchVisibility` lost | `renderTasks` calls it too |

Boot also *gains* what its copy lacked: the completed/active partition, the try/catch that
preserves the existing list when a task element throws mid-build, drag handlers,
active-task-option restore, and `reapplyActiveFilter()`.

`organize()` in `loadMiniCycle` step 6 is now redundant on the success path — **measured**,
identical DOM with and without. Kept deliberately (free, and still covers the path where
`renderTasks` bails and preserves the existing DOM) with a comment saying so, so nobody
reads its presence as evidence the render needs it.

**The guard is a MECHANISM test, on purpose.** The obvious black-box guard — compare the
boot DOM to the runtime DOM — was written first and is **vacuous**: with the forked renderer
restored it still passed, because `organize()` re-partitions afterwards and the per-task
decoration was already identical. It was deleted rather than shipped. `routineLoader.tests.js`
now pins the call itself (`renderTasks` invoked, `addTask` NOT called directly) and the
no-renderer path (an unavailable renderer must leave the list intact, never blank it —
an empty routine reads as data loss). Both mutation-checked.

**What this did NOT do:** there is no user-visible behavioural change. That is the whole
point of the measurements above, and the reason the black-box test could not discriminate.
This closed a fork that could drift, not a bug.

**Measured Sep 2026 (v2.540) — the user-visible symptom did NOT reproduce, but the
duplication is still real.** Seeded a completed task in state with the completed-dropdown enabled, so boot
had to place it with no runtime completion event involved, then forced a runtime re-render
over the same unchanged state:

```
AFTER BOOT     {"taskList":["Open one","Open two"],"completedList":["Done already"]}
AFTER RUNTIME  {"taskList":["Open one","Open two"],"completedList":["Done already"]}
```

Identical — but **not** because `renderTasksToDOM` learned to partition. It still doesn't.
The parity comes from a *third* mechanism: `completedTasksManager.organize()` (injected as
`organizeCompletedTasks`) sweeps `#taskList` after a render and moves completed rows down
into the dropdown, and undo/redo calls it explicitly for the same reason.

A second probe closed the obvious follow-up worry — that the renderers might differ on
something `organize()` does **not** reconcile, which would be an unmasked live bug. Rendered
a fully-decorated task both ways (high priority + custom colour, due date, recurring with a
live template, reminders, delete-when-complete, move arrows on, dropdown on) and compared
every property a renderer decides — classes, `data-*`, ARIA/role/draggable/tabindex,
checkbox state and label, every button's classes and `aria-label`/`aria-pressed`, inputs,
inline style vars, text:

```
t0: identical
t1: identical
```

Nothing differs beyond list placement. So the duplication is **measured-clean debt**, not a
latent bug: three probes against this band (#1, #4's symptom, #4's decoration parity) all
came back clean.

So this row is half right in a way that matters for how you fix it. The two renderers **do**
still differ — the row's description of the code is accurate — but a reconciler downstream
masks the difference, which is why no symptom is reachable. That changes the risk profile:
unifying the renderers is safe cleanup rather than a bug fix, and anyone who unifies them
must check whether `organize()` is still needed afterwards or becomes a redundant second
pass over the same DOM.

### #5 Runtime drops `taskText`; boot still accepts it — ✅ FIXED Sep 2026

**Where:** Renderer `addTask(task.text, …)` vs boot `task.text || task.taskText`.

**Fix:** One helper: `task.text ?? task.taskText ?? ''`. Stop writing `taskText` on live tasks (cleared-task entries keep `taskText` by schema).

**Fixed.** Measured first: nothing wrote `taskText` onto a live task any more, and
`routineLoader`'s load-time repair already renames `taskText` → `text` and deletes the old
key — that is the write-side normaliser. What remained were two inline read-side fallbacks:
`focusTaskPanel` (`task.text ?? task.taskText ?? ''`) and the detail messages in
the pre-2.5 task-repair pass (since retired with that migration).
Both now go through `getTaskText(task)` in `task/taskUtils.js`, the one read-side fallback,
cross-referenced from the loader repair. Pinned by `taskUtils.tests.js` and a `focusTaskPanel`
test that renders a pre-repair task carrying only `taskText`.

---

## P1 — mutation / undo can lie

### #6 `AppState.get()` is the live tree

**Where:** `MiniCycleState.get()` in `modules/core/appState.js`.

**Fix:** Law stays: never mutate the return. Optional: freeze in debug builds, or `getCopy()`. Grep for assignment / `.push` on `get()` results after any nearby change (CLAUDE.md #13).

### #7 `update()` rollback does not redraw — ✅ FIXED Sep 2026

*(After restoring the clone, `update()` now calls `notifyListeners(abandoned, restored)`, so
subscribers redraw against the state that actually exists. Pinned in `appState.tests.js`.)*

**Where:** `update()` `catch` restores the clone, shows `notify.stateUpdateFailed`, rethrows — **no** `notifyListeners`.

**Fix:** After restore, notify subscribers so the screen is not left on a mutation that was undone. (Documented in HOW_MINICYCLE_WORKS; still missing in code.)

### #8 Undo is a slice plus extra captures — measured Sep 2026: no user-visible fault found

*(The gesture probe above found Undo correct for add, check, priority, delete, completing a
cycle by checking the last task, Complete Cycle and a To-Do switch once undo is on. Each add
costs exactly one undo step — the explicit pre-add capture and the wrapper's capture dedupe.
A tab refocus between a gesture and Undo does not steal the Undo. The duplicate capture sites
below still exist and are still worth collapsing, but as cleanup, not a bug fix.)*

*One real fault found at the bottom of the stack (Sep 2026): after undoing everything, the Undo
button stayed shown and enabled because the stack still held an entry identical to the screen,
and the next press silently discarded it. Undo/Redo and both buttons now count only entries that
would change what is on screen (`countStepsThatChangeState` in `undoRedoManager.js`), and a no-op
press leaves the stack alone. Pinned by the *Undo is only offered when it changes something*
journey and `undoRedoManager.tests.js`.*

**Where:** `wrapAppStateForUndo` is supposed to be the single source (`useUpdateWrapper`). Call sites still snapshot: `taskCompletion`, `taskCRUD` (pre-add), `dragDropManager`, `titleManager`, `taskCycleReset`, `ModeManager._checkCycleWithSnapshot`.

Dedupe (`_sig` + min interval + last-on-stack identical) often makes doubles a no-op until someone mutates `get()` then calls `update`, or `isResetting` is late.

Snapshots are a **cycle slice** (tasks, templates, title, modes, cycleCount, theme, clearedTasks, `taskViewLayout`) — not full AppState.

**Fix:** Wrapper-only for `update()` paths. Keep **one** gesture-boundary snapshot where the executor no longer captures (mode-switch → auto-reset). Do not snapshot celebration flags as their own undo steps (#9).

### #9 Many `update()`s per cycle complete — measured Sep 2026: no undo impact

*(`incrementCycleCount` runs inside `resetTasks` while `isResetting` is raised, so the undo
wrapper skips all of these updates. What remains is cost: up to four immediate saves plus the
history event, and a listener notification each, per completed cycle.)*

**Where:** `incrementCycleCount` — count + `cyclesCompleted`, then `firstCycleCelebrated`, then 100/500 flags, then `logHistoryEvent` (another `update`).

**Fix:** One producer: increment + flags + history event. One wrapper snapshot. Keep `actualNewCount` in outer scope (already learned).

### #10 Arrows index by DOM and splice state; drag resolves by id — ✅ FIXED v2.540

> **This row was written backwards.** It read *"Drag order from DOM; arrows from state"*,
> which is true of the arrow path's **write** and false of its **read**. Measured against
> v2.538, the drag path is the safe one and the arrow path is the one that corrupts. A
> fixer following the original text would have hardened the wrong half. §0 of
> [REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) exists for exactly this.
>
> **Fixed in v2.540.** `handleArrowClick` now resolves the neighbour from the DOM (what the
> user pointed at) and reorders `cycle.tasks` by **task id**, the way `saveDragReorder`
> already did. Pinned by the journey *"reorder arrows move the task the user pointed at"*,
> which covers both triggers and asserts its preconditions; mutation-checked by restoring
> the original index arithmetic. Kept here rather than deleted because the reasoning below
> is the record of how the row came to be written backwards.

**Where:** `handleArrowClick` in `modules/task/dragDropManager.js` takes its index from the
DOM and applies it to the state array:

```js
const allTasks = Array.from(taskList.children);
const currentIndex = allTasks.indexOf(taskItem);
...
const [movedTask] = tasks.splice(currentIndex, 1);   // state array, DOM index
```

That holds only while `#taskList.children` and `cycle.tasks` are index-for-index identical.
`saveDragReorder` in the same file already does it correctly — it maps task **ids** through
a `Map` and explicitly appends `missingTasks` for rows not in the DOM. Same operation, two
doors, one hardened ([REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) §4).

**Two triggers, both measured on v2.538:**

1. **Completed-tasks dropdown.** `moveToCompleted` moves completed rows out of `#taskList`,
   so the lists desynchronise:

   ```
   BEFORE            state:["A","B","C","D"]  taskList:["A","B","C","D"]
   complete A        state:["A","B","C","D"]  taskList:["B","C","D"]  completed:["A"]
   move-down on B    state:["B","A","C","D"]  taskList:["B","C","D"]
                     expected ["A","C","B","D"]
   ```

   The arrow moved **A**, because B sat at DOM index 0. Note the DOM column does not change:
   the user presses an arrow, sees nothing move, and the stored routine order changes anyway.

2. **Any non-default sort** (one tap in search). Lengths match, order does not:

   ```
   state order : ["Zebra","Apple","Mango"]
   DOM order   : ["Apple","Mango","Zebra"]
   ```

**Fix:** Resolve the task's position in `cycle.tasks` by `taskId` and compute the neighbour
in state, the way `saveDragReorder` already does. Do not wait on #4 — see below.

**Why this is not just a wrong number:** in a routine manager the task sequence *is* the
routine, so this is silent corruption of the artifact the user built once to run many times,
and it persists across every later cycle.

**Scope correction:** the original fix note deferred this to #4 (*"after #4, active-list DOM
order should match incomplete tasks"*). That closes trigger 1 only. Sorting reorders the DOM
**within** the active list, so trigger 2 survives the entire P0 band. `sort` is not mentioned
anywhere else in this document.

**Superseded by:** [TASK_ORDERING_SYSTEM_PLAN.md](./TASK_ORDERING_SYSTEM_PLAN.md) — a
persistent `order` field removes index arithmetic entirely and makes both triggers
impossible. That is ~20 hours and a Schema 2.6 migration; this row is the small fix that
should not wait for it.

### #11 `saveCycleData` replaces the whole cycle object — measured Sep 2026: not the stale-overwrite described

*(`loadMiniCycleData()` returns the live `AppState` tree, not a copy, so the routine
`saveCycleData` assigns is the same object already in state — it cannot overwrite a recurring
or watcher write. The real fault is one step earlier: `repairAndCleanTasks` mutates that live
routine before any `update()` runs (CLAUDE.md #13). The fix below still applies; its reason is
different.)*

*✅ FIXED Sep 2026: `loadMiniCycle` now calls `repairRoutineBeforeRender()`, which detects on a
copy (quietly) and, only when something needs repairing, runs `repairAndCleanTasks` inside
`update()` against state itself. `saveCycleData` — the whole-object assignment — is gone. While
state is not ready the loader holds a storage copy, not live state, and repairs that directly.
No user-visible symptom was expected (undo is off during boot); pinned in `routineLoader.tests.js`
by asserting `update()` still sees the unrepaired routine when it starts.*

**Where:** `routineLoader.js` — `state.data.cycles[activeCycle] = currentCycle`.

**Fix:** Mutate fields on the existing cycle inside `update()`. Never assign a stale clone over watcher/recurring writes.

### #12 `setAppStateDependencies` spreads — ✅ FIXED Sep 2026

*(Now `Object.defineProperties` over the descriptors, like every other setter; a getter dep
set before its value exists binds late. Pinned in `appState.tests.js`. The constructor still
merges `_deps` per instance by spread — that is a per-instance snapshot by design, not the
setter bug.)*

**Where:** `appState.js` — `_deps = { ..._deps, ...dependencies }`.

**Fix:** `Object.defineProperties` like every other setter. Phase-1 “exception” is historical, not required.

### #13 `isInitializing` blocks undo until first task/title action — ✅ FIXED Sep 2026

*(Measured first with a probe that did each gesture once, as the first action after load and
after a warm-up, then pressed Undo. Every gesture undid correctly except two cold ones:
**Complete Cycle** and **switching to To-Do mode** — Undo did nothing, because neither path
calls `enableUndoSystemOnFirstInteraction`, and neither do due dates, reminders, the recurring
panel or completed tasks. Fixed once instead of per gesture: `armUndoOnFirstInput()` in
`uiBoot.js` is a capture-phase document listener for the first **trusted** `pointerdown` /
`keydown`, so undo switches on before any gesture's own handler runs; scripted events are
ignored, so boot dispatches cannot enable it early. Also measured before choosing this over
"enable at load": background writes (overdue check, recurring watcher) add no undo steps — they
are `{ system: true }`. Pinned by the *the first gesture after load can be undone* journey (fails
on the previous build on both Undo checks) and `uiBoot.tests.js`.)*

**Where:** `taskViewLayoutManager` header: wrapper skips snapshots while `AppGlobalState.isInitializing`; only some modules flip it.

**Fix:** `enableUndoSystemOnFirstInteraction` on first **any** user gesture (layout, mode, checkbox), or clear the flag when UI is interactive.

---

## P1 — DI advertised vs DI on the hot path

### #14 `required()` warns and returns `null` — measured Sep 2026: covered, `diBase` left as is

*(A missing required dep logs `⚠️ <Module> missing required deps: <names>` from `resolve()`, so
the console names the culprit. The journey harness fails any journey whose page logs
`missing (required )?dep`, so a boot-time wiring gap cannot pass CI. And since #15 the hot path
reads `AppState` unguarded, so a gap throws where it is used. Throwing from `resolve()` for every
module would change what roughly 3,700 unit tests may wire partially, for no safety the above
does not already give. Reopen if a gap is found that neither the warning nor the journeys caught.)*

**Where:** `diBase.js` — missing required deps do **not** throw. Fail-fast is a contributor rule (unguarded read), not `resolve()`.

**Fix:** Throw from `resolve()` when boot is interactive / `strict`, **or** stop calling it required. Keep unguarded reads.

### #15 Hot path declares `AppState: optional(null)` and `?.` — ✅ add / complete / reset DONE Sep 2026

*(`taskCRUD`, `taskCompletion` and `taskCycleReset` now declare `AppState: required()` and read
it unguarded. The `isReady()` checks stay, so a first-run "not ready" still takes its early
branch; only a missing `AppState` throws, and every one of those functions' catches turns that
into a failure notification instead of a checkbox that moves with nothing saved. Four tests pin
it and fail on the previous modules.*

*`validate:chains` could not see any of this: these modules read through a local alias
(`const AppState = deps.AppState || _deps.AppState`) and the gate only matched `deps.X?.`. It now
also flags `alias?.` and `(deps.X || _deps.X)?.`. That surfaced 15 older violations of the same
kind in `guidedTourManager`, `uiOrchestrator`, `deviceDetection`, `cycleExportManager` and
`shareManager`; all converted, their suites pass.*

*Second batch, same day: `taskRenderer`, `cycleCompletion` and `backupManager` — the render,
cycle-complete and backup paths — are now `required()` and unguarded too. `backupManager`'s
private `_getAppState()` accessor became a plain `_deps.AppState` alias so the gate covers it.
Four more tests pin it and fail on the previous modules; one of them had to be `createManualBackup`
rather than the existing auto-backup test, because a backup from the last day makes
`createAutoBackup` return before AppState is read, on either build.*

*Still open under this item: the non-hot-path modules that still declare
`AppState: optional(null)` (34 of the original 40), and the same accessor pattern in
`gamesManager` and `dragDropManager`, which the gate cannot see.)*

**Where:** `taskCompletion.js`, `taskCRUD.js`, `taskCycleReset.js`, `taskRenderer.js`, `backupManager.js`, `cycleCompletion.js` (and more). Contrast: `cycleImportManager`, `historyManager`, `dailyResetManager` use `required()`.

**Fix:** `AppState: required()` on add / complete / reset / backup. Unguarded `.get()` / `.update()`. `validate:chains` then applies.

### #16 Renderer and drag-drop copy deps at construct — measured Sep 2026: no live gap, left as is

*(Two checks before touching it. **Static:** every `this.deps.X` either class reads is either
copied in the constructor or injected later (`moduleLoader` / `featureBoot` / `taskDOM`
`injectDependency`) — nothing is read that neither provides. **Runtime:** the real app booted
(returning-user path) with both constructors instrumented at serve time; after boot settled,
`DragDropManager` had 13 slots with none empty and `TaskRenderer` 22 slots with only
`revealTaskButtons` empty — which the renderer never reads. So the copy-then-inject pattern
delivers everything these classes use today. Switching to `get deps()` would reroute the
injected keys through DI and drop the overrides `taskDOM` passes to the constructor, for no
measured benefit. Re-open with a concrete missing dependency, not the pattern alone. The
unread `revealTaskButtons` copy is dead code — P3 hygiene.)*

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

**Decided Sep 2026: this re-key ships inside the single Schema 2.6 migration** — one migration and
one version bump together with Rename A, Rename B and priority storage (see the *Ordering* section
of [SCHEMA_2_6_PLAN.md](./SCHEMA_2_6_PLAN.md)). They stay distinct changes — identity here,
naming there — but users' data is migrated once. Still sequenced after this plan's P0 and P1.

### #21 `text` vs `taskText`

**Fix:** Live tasks always `text`. Cleared entries always `taskText`. One import/load normalizer. Ties to #5.

### #22 `schemaVersion` is the string `"2.5"` — ✅ PARTLY FIXED Sep 2026

*(`utils/schemaVersion.js` compares parsed numbers, and `AppState` classifies stored data
through it at init, reload, save and cross-tab — the forward-compatibility release in
`SCHEMA_2_6_PLAN.md`. The restore/import paths still use `=== '2.5'`; they reject rather than
overwrite, and move onto the classifier with the 2.6 migration.)*

**Fix:** Equality only, or integer/`{major,minor}`. Never `>` string versions (`"2.5" > "2.10"`).

### #23 Export invents ids with `Date.now()` + `Math.random()`

**Where:** `buildMcycPayload` in `modules/utils/mcycPayload.js`.

**Fix:** Same `generateId()` as CRUD if `task.id` is missing.

### #24 Recurring templates vs tasks can orphan — POLICY DECIDED Sep 2026 (v2.537–v2.538)

> **Do not implement the original note.** It read *"On load: prune or show orphans"*, and
> pruning is now the wrong answer — it would undo the v2.537 fix.

**Policy:** a template with no live task instance is **normal**, not an error. It is the
resting state of every routine between occurrences: `taskCycleReset` removes the spawned
instance from `cycle.tasks` and leaves the template for `recurringWatcher` to respawn.
`routineSwitcherActions.js` already said this at the duplicate-routine call site.

**Shipped against this row:**

- **v2.537** — `.mcyc` import carries orphan templates over instead of discarding them.
  Import had rebuilt `recurringTemplates` from the task list alone since the first commit, so
  a routine exported between occurrences lost its recurring tasks entirely, silently. No task
  is spawned at import; the watcher owns spawning.
- **v2.538** — import never attaches a template to a task that is present and non-recurring.
  The task's own `recurring` flag is the authority.

Both are pinned by journeys in `run-journey-tests.cjs` (*import keeps recurring templates with
no live task*, *import never attaches a template to a non-recurring task*), mutation-checked.

**Still open from this row:** the delete-side policy (keep stamp vs delete template) is
*implemented* — `taskCRUD` deletes the template alongside the task, which is correct, or the
watcher would resurrect it — but the notification says only "Task deleted: {name}" and never
mentions that a recurrence was cancelled, which is the more consequential half.

### #25 `loadMiniCycleData` still in the living graph

**Where:** `statsPanel`, `modeManager`, `reminders` (settings vs tasks already split), `featureBoot` `stateApiObj`.

**Fix:** AppState only. Then delete the dep.

---

## P2 — recurring / dates

### #26 Monthly “pattern doesn’t exist” → 1st of month — measured Sep 2026: closed by the normalizer

*(The fallback in `calculateNextMonthly`'s week-of-month branch is unreachable for real input.
`calculateNthWeekdayOfMonth` returns null only for an ordinal outside 1–4/`last` or an unknown
weekday, and a 1st–4th or last weekday exists in every month. `normalizeRecurringSettings`
allowlists exactly those ordinals and weekdays (`VALID_ORDINALS`, `VALID_WEEK_DAYS`, Aug 2026
sweep), and `calculateNextOccurrence` normalizes on EVERY call — so a template stored before the
allowlist with ordinal `5` is coerced at spawn time too. Pinned end to end in
`recurringCalculators.tests.js` ("imported ordinal-5 weekOfMonth normalizes away"). The
specific-days branch had the same shape and was fixed separately with a forward scan. No change
made; reopen only for a caller that reaches `calculateNextMonthly` without the normalizer.)*

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

**Status Sep 2026:** the *class* is closed — re-enumerated all 15 template-literal `innerHTML`
sinks, all safe (see #30). The **gate** is still missing, and that is what keeps this row open:
nothing stops a new `getLabel`-vars → `innerHTML` sink from being added with user text.

### #29 `trusted: true` / `trustedHTML`

**Where:** `notifications.js`.

**Fix:** No new trusted sinks with user text. Enumerate callers when auditing.

### #30 `routineSwitcher` innerHTML + `modeLabel` — ✅ RESOLVED Sep 2026 (verified, no code change)

`modeLabel` is always a `getLabel` result (an app constant naming the mode), never user or
theme text, so the sink is safe as written.

Verified by re-enumerating **every** template-literal `innerHTML` sink in `modules/` (15 of
them): each interpolates `ICONS` / `getIcon()` or a var-free label, and
`helpWindowManager.js` — the one that composes four fragments — escapes all four. This is the
same conclusion the audit note in `labelResolver.js` records; it now has a second
independent check.

### #31 `extractTaskDataFromDOM` is still a save-shaped scrape

**Where:** `TaskUtils.extractTaskDataFromDOM` — completion from checkbox, recurring from `data-*` JSON; `priorityColor` patched to AppState. Still on `appContext` / `featureBoot` as `extractFromDOM` for “dataAccess autoSave.”

**Fix:** Do not persist from this. Delete when unused; until then, do not wire to save.

---

## P2 — product (from code, not taste)

### #32 Three reset concepts

Cycle complete (count++, flip `completed`); to-do clear (`clearedTasks`); daily auto-uncheck (`dailyResetManager` — silent, no `cycleCount`, any cycle, notify on view).

**Fix:** Keep the split. Tests: background-routine daily uncheck must not drive `checkMiniCycle` off the **active** DOM. After #1 this is automatic. *(Sep 2026: `checkMiniCycle` reads state as of v2.562, so the mechanism is in place; the test is still to write.)*

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
- Schema 2.6 (own plan) — #20's UUID re-key is carried by its single migration
- `mergeStates()` (own plan)
- Generating `depMappings` (own plan) except as it helps #19
