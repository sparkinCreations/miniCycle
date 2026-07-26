# miniCycle — Architecture Review Findings

**Date:** June 26, 2026
**Scope:** Source-of-truth model (AppState), persistence & boot, render layer, both
migration paths, schema 2.5, cleared tasks, the three cycle modes + auto-uncheck,
completion/clear-completed flows, achievements & themes, undo/redo, and the recurring
engine (calculators, matcher, watcher, activation).

**Not deeply read:** most panel/UI surface (recurring panel UI, onboarding/tours,
notifications), `taskDOM.js` internals, `modeManager.js` UI beyond mode derivation.
Findings below are from reading code, not running it — confirm anything marked
"latent/unverified" with a test before treating it as live.

---

## The one recurring theme

Almost every issue below is the same shape: **a single truth represented or read in
more than one place, kept aligned by hand instead of derived from one source.** The
architecture is otherwise sound — single in-memory source of truth (`AppState`),
transactional `update()` with rollback, DOM as projection, careful time logic. The
risk is concentrated wherever something escapes that single-source discipline.

---

## Priority 1 — Fix (real latent bugs, data-affecting)

### 1.1 To-Do "Clear Completed" reads completion from the DOM, not state
- **Where:** `task/taskCycleReset.js`, `deleteCompletedTasksImpl` (~line 638):
  `const isCompleted = checkbox?.checked || false`.
- **Problem:** The cycle-reset path reads completion from **state**
  (`task.completed` via fresh `AppState.get()`), but the To-Do clear path reads it
  from the **DOM checkbox**. Two sources of truth for "is this done?" in the two
  paths that *delete user data*.
- **Risk:** Dormant only while checkbox and `task.completed` stay synced. Any future
  path that sets `completed` in state without updating the checkbox (bulk action,
  async re-render, undo restore) makes Clear Completed act on the wrong set —
  deleting or skipping the wrong tasks.
- **Fix:** Read `task.completed` from state, matching the reset path.

### 1.2 Wake-time recurring recreations can enter undo history
- **Where:** `recurring/recurringWatcher.js` — `watchRecurringTasks` (~line 499) and
  `catchUpMissedRecurringTasks` (~line 344) commit via
  `Deps.updateAppState` → wrapped `AppState.update`. No undo-suppression flag exists
  anywhere in the file.
- **Problem:** Undo wraps `AppState.update` globally. Boot-time catch-up is safe only
  because the undo side skips capture while `isInitializing` is true. That flag is
  **false** during normal operation, so the 30s interval and the `visibilitychange`
  catch-up (~line 624) get snapshotted into undo history.
- **Risk:** User presses undo after a recurring task appears → it removes the
  *system-created* task (not their own last action) → the task silently reappears on
  the next watcher tick. Confusing, not data-loss.
- **Status:** Strongly evidenced from wiring; **not empirically confirmed.** Verify
  with a test (let a recurring task come due while the app is open, press undo, see
  if it's removed).
- **Fix:** Set a "system mutation" flag around the watcher's `updateAppState` calls
  that the undo wrapper already knows to skip — same pattern as boot/undo-redo
  suppression.

---

## Priority 2 — Refactor (no current bug; duplicated truth that will drift)

### 2.1 The two recurring recreation functions are ~90% duplicated
- **Where:** `recurring/recurringWatcher.js` — `catchUpMissedRecurringTasks` and
  `watchRecurringTasks`.
- **Problem:** Near-identical template loop, existence check, safety-policy override,
  limit check, and batched update. The most safety-critical logic in the subsystem
  (task creation + forced `deleteWhenComplete`) is maintained as two copies.
- **Fix:** Extract one shared `recreateDueTasks(templates, taskList, now)` and have
  both functions be thin wrappers. Roughly halves the file.

### 2.2 The "recreated recurring instance" shape is defined in ~4 places
- **Where:** the 11-field instance object literal appears in both watcher functions
  *and* in `recurringActivation.js` / `recurringSettingsApplicator.js`.
- **Problem:** Change the instance shape (add a field, change a default) and you must
  find all four; missing one yields a malformed recurring task with no error.
- **Fix:** One `buildRecurringInstance(template)` factory, used everywhere.

### 2.3 Cleared-task record shape is hand-duplicated across delete paths
- **Where:** `task/taskCycleReset.js` — the ~9-field cleared-record literal at
  ~line 360 (reset path) and ~line 675 (To-Do path); related shape in
  `features/clearedTasksManager.js`.
- **Problem:** Same record shape authored in multiple spots; add a field to one and
  the others silently omit it.
- **Fix:** One `buildClearedRecord(task)` helper.

### 2.4 `deleteWhenComplete` has four writers and no shared setter
- **Where:** mode-switch derivation (`routine/modeManager.js:1131`), load-time heal
  (`routine/routineLoader.js:317`), user toggle (`task/taskButtons.js:426`), and the
  recurring safety override (`recurringWatcher.js` — hardcoded `true`).
- **Status:** **Correct today.** The top-level bool is a derived cache of
  `deleteWhenCompleteSettings[currentMode]`, re-derived at every currently-known
  input change. Not a bug.
- **Risk:** It's the most-written, deletion-controlling field in the app. A future
  fifth path that sets `deleteWhenCompleteSettings` without re-deriving the bool would
  go stale silently and the delete paths would act on the stale value.
- **Fix (hardening, optional):** One `deriveDeleteWhenComplete(task, mode)` helper all
  paths call, so derivation has a single home.

### 2.5 Undo snapshot signature is a hand-maintained list of "what counts"
- **Where:** `ui/undoRedoManager.js`, `buildSnapshotSignature`.
- **Problem:** The set of fields that count as an undoable change is maintained
  separately from the schema. The code already shows scar tissue here (task-view
  layout had to be explicitly added or drag-reorders were silently non-undoable).
  Forgetting to add a future meaningful field makes changes to it silently
  non-undoable — no error.
- **Fix:** Document the rule next to the function and in the schema doc ("if you add a
  meaningful task field, add it to `buildSnapshotSignature`"); consider deriving the
  signature from a single field manifest.

---

## Priority 3 — Documentation (accuracy only; mostly done)

### 3.1 Schema doc `clearedTasks` field names — FIXED
- `SCHEMA_2_5.md` said `items`/`taskText`; code uses `entries` with rich records.
  Already corrected (entries, full 10-field record, `autoPruneEnabled`, date).

### 3.2 Two version stamps — documented, deferred by choice
- Document version is the string `"2.5"`; per-task version is the number `2`. These
  are **intentionally two separate counters** (document shape vs task shape) — proven
  by code: every writer writes `2`, the only task-version read repairs missing values
  *toward* `2`, nothing treats `2` as outdated. The "Two Version Stamps" section was
  added to `SCHEMA_2_5.md`.
- **Open decision (no rush):** the two stamps differ in *type* (string vs number).
  Harmless today because versions are compared by exact match and task versions are
  never compared with `<`/`>`. If unified later, do it deliberately (string for both
  is the more honest choice, but then never compare with `<`/`>`; compare by parts).
  `routineLoader` currently asserts the task version is numeric — changing the type
  requires updating that guard.

### 3.3 Record the achievement vs theme-unlock separation
- `achievements.unlocked` (milestone events) and `settings.unlockedThemes`
  (entitlements) are **intentionally separate stores**, not duplicated truth. A
  milestone can reward a game (not a theme), and a theme can unlock via the task
  path. Worth a one-line note so a future reader (or reviewer) doesn't "fix" it into
  one blob.

---

## Priority 4 — Minor / watch

### 4.1 Recreated task `dateCreated` is recreation time, not due time
- `recurringWatcher.js` catch-up stamps `dateCreated: now` even when the occurrence
  was due earlier. Possibly intentional; only matters if anything computes overdue or
  sorts by creation vs due. Worth knowing.

### 4.2 No try/catch around the 30s watcher tick
- An unhandled throw from `updateAppState` inside the interval callback could (depending
  on the injected `setInterval` wrapper) silently kill the interval. Low-risk given
  `update()`'s own rollback, but a defensive try/catch around the tick body is cheap.

### 4.3 Undo wrapper monkey-patches `AppState.update`
- Powerful and currently correct, but delicate: any code that captured a reference to
  `update` before wrapping would bypass undo, and a future signature change to
  `update` could desync it silently. Worth a test that asserts the wrapper stays
  intact.

---

## What is genuinely strong (leave alone)

- **AppState core** — transactional `update()` with snapshot + rollback, debounced vs
  immediate save, multi-tab concurrent-modification detection (now notifies + warns on
  the discard path — ADR-011), unload flush on beforeunload + pagehide + visibilitychange
  (v2.331; pagehide/visibilitychange added for iOS reliability — drift-review v2 §1.2).
- **Boot & persistence** — validate-before-adopt, minimal valid fallback on
  corruption, clean first-run signal, deferred self-heal of missing fields. localStorage
  is the primary store.
  > **Resolved (2026-07-26 / drift-review v2 §1.3):** the former test-data IndexedDB
  > safety-vault + test-mode save-gate machinery this bullet described has been **removed**.
  > The in-app test runner now runs on a **separate origin** (`test.minicycle.app`), so its
  > storage is isolated by construction rather than by runtime cleanup — see `appState.js:32-36`.
  > The old "someday, deliberately" root-cause item is closed.
- **Recurring engine** — pure testable calculators, correct calendar math (day-31/Feb
  guarded via `isValidDate`, week-of-month handled, last-day explicit), deliberate
  **DST-safe** day-counting for biweekly parity, identity-based dedup, adaptive
  watcher interval, count-exhaustion handling. Best-engineered subsystem in the app.
- **Time-elapsed-while-closed logic** — recurring catch-up adds one task per template
  regardless of missed count; auto-uncheck keys on local `YYYY-MM-DD` (dodges UTC
  midnight bugs) and uses `visibilitychange` to cover the closed-app case.
- **Routine switching** — state-first, transactional, "never mutate outside the
  transaction" enforced and commented.
- **Cycle reset animation** — the staggered down-uncheck is an intentional completion
  *reward*, deliberately distinct from the silent daily uncheck. The DOM manipulation
  there is justified by the animation; not a unification target.

---

## Suggested order of work

1. **1.2** — verify the undo seam with a test; if live, add watcher suppression flag.
2. **1.1** — make Clear Completed read `task.completed` from state.
3. **2.1 / 2.2** — extract shared recurring recreation + instance builder.
4. **2.3 / 2.4** — extract cleared-record and delete-flag helpers.
5. **Render unification** (separate existing plan, `RENDER_PATH_UNIFICATION.md`) —
   make `renderTasks` project both task lists from state so the completed-dropdown
   one-node-per-task invariant holds by construction, demoting the healers to guards.
6. **3.3 / 2.5** — small doc notes.
7. Leave Priority 4 as awareness items.
