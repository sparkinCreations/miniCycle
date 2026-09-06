# Lite ↔ Full: `.mcyc` Import in Lite + "Adopt Lite Data" in the Full App

> **Status:** 📋 PLANNED — not started ·
> **Severity:** Medium — a stranded-user gap, not a bug ·
> **Found:** Sep 2026, while reviewing the feature-gate → Lite path (v2.543).
>
> Lite and the full app keep **separate data on purpose** (`miniCycleLite` vs
> `miniCycleData`), and the redirect notice discloses it. This plan does not
> change that. It closes the two places where the separation actually strands
> someone, using the bridge that already exists — the `.mcyc` routine file —
> and it deliberately does **not** make Lite a *producer* of that format.

---

## Decision summary

| | Do it? | Why |
|---|---|---|
| **A. Lite reads `.mcyc`** (import, one-way, lossy) | ✅ Yes — narrow | A Lite user (device *can't* run full) cannot open a routine shared with them, or bring in their own. Mapping is trivial: Lite's task is `{ id, text, completed, highPriority }`, a strict subset of the `.mcyc` task. |
| **B. Full app offers to adopt the Lite list** | ✅ Yes — first | "Used Lite for a while, now on a phone that runs full" is the main migration need, and it's the same origin — the full app can read `miniCycleLite` directly. Zero file handling, zero frozen-code changes, fully testable. |
| **Lite writes `.mcyc`** (export) | ❌ No | Makes a frozen ES5 file a producer of a living format. Concrete hazard: `cycleImportManager.js:650` defaults `deleteWhenComplete: task.deleteWhenComplete !== false` — a minimal producer that omits the field imports as `true`. Plus `<a download>` of a Blob is unreliable on iOS 12 Safari, the exact device class Lite serves. Same-device migration is covered by B. |

**Build order: B, then A.** B is maintained code with journeys; A is the one
un-freeze of Lite and should be a single bounded release.

---

## Ground truth (verified Sep 2026)

- `.mcyc` payload shape: `modules/utils/mcycPayload.js` `buildMcycPayload()` —
  `{ name, title, tasks[], autoReset, cycleCount, deleteCheckedTasks, taskOptionButtons,
  recurringTemplates, reminders, autoUncheckDaily, createdAt, theme, history?, clearedTasks? }`.
  Task: `{ id, text, completed, dueDate, highPriority, priorityColor, remindersEnabled,
  recurring, recurringSettings, deleteWhenComplete, deleteWhenCompleteSettings, schemaVersion }`.
- Full-app importer: `modules/ui/cycleImportManager.js` `processImportedData(fileContent: string)`
  (line ~518). Requires `importedData.name` **and** `Array.isArray(tasks)`; truncates to
  `LIMITS.TASKS_PER_CYCLE` (150); quota check; `DataValidator`; then the
  template-vs-progress choice modal. **Requires `AppState.isReady()`** — false on a
  brand-new user (see the first-run state contract in root `CLAUDE.md`).
- Lite storage: `miniCycleLite` = `{ title, tasks: [{ id, text, completed, highPriority }],
  autoReset: true, cycleCount, lastSaved }` written by `autoSave()`
  (`lite/miniCycle-lite-scripts.js` ~1208); mode in `miniCycleLiteMode`
  (`auto-cycle | manual-cycle | todo-mode`); count in `miniCycleLiteCount`.
  Lite renders task text via `textContent` (`addTask()` ~757) and already has
  `sanitizeInput()` (~2136: strips `<>"`, trims, caps at `TASK_LIMIT` = 100).
- The full app already knows Lite: `STORAGE_KEYS.LITE_*` (`constants.js` ~580),
  `LITE_STORAGE_KEYS` snapshot in backups (`backupRestoreManager.js:70`,
  `collectLiteStorageSnapshot()` ~296), and `sanitizeLiteStructuredValue()`
  (`dataSanitizer.js:144`, 500-char text cap) on restore.
- First-run routing: `appInit.js` `_routeFirstRunChoice(choice)` (~366) switches on
  `'create' | 'sample' | 'learn'`; the choice screen is `#first-run-choice` in
  `miniCycle.html` (~722) with a secondary row holding "Restore from a backup file".
- Journeys: `tests/automated/run-journey-tests.cjs`; registry near line ~2318
  (`{ name, fn }`); precedent for seeded-storage first-run tests is
  `journeyFirstRunRestore` and the *first-run state contract* journey.

---

## Part B — Full app: "Adopt Lite data" (do first)

### B1. Payload builder (pure, no DI)

New `modules/utils/liteAdoptPayload.js`, modelled on `mcycPayload.js`:

```js
// buildLiteAdoptPayload(liteStorage) → .mcyc-shaped object, or null if nothing usable
{
  name:  `lite_${Date.now()}`,                       // processImportedData requires .name
  title: lite.title || getLabel('lite.defaultTitle'),// Lite's own default is "My Tasks"
  tasks: lite.tasks.map(t => ({ id, text, completed: t.completed === true,
                                highPriority: t.highPriority === true })),
  autoReset:         mode !== 'todo-mode',
  deleteCheckedTasks: mode === 'todo-mode',
  cycleCount: parseInt(liteStorage.miniCycleLiteCount, 10) || 0,
}
```

- Run `sanitizeLiteStructuredValue()` over the parsed `miniCycleLite` first (already
  exported from `dataSanitizer.js` for the restore path — reuse, don't copy).
- Return `null` when `tasks` is not a non-empty array — the prompt is only ever shown
  when this returns a payload, so "Lite data exists but is empty" never prompts.
- Everything Lite doesn't have is simply absent; `processImportedData` fills defaults.
  **Verify** the `deleteWhenComplete` default at `cycleImportManager.js:650` produces
  the intended behaviour for a non-recurring task that omits the field (see
  "Residual" below) — set it explicitly in the builder if not.
- Unit test: `tests/liteAdoptPayload.tests.js` (pure function → trivial to pin).

### B2. Entry point 1 — first-run choice screen

- Detection: the first-run controller reads `localStorage.miniCycleLite`, parses it,
  and reveals a secondary action **beside "Restore from a backup file"** — *not* a
  fourth primary button. Copy (label key, e.g. `firstRun.adoptLite`):
  "Continue with my Lite list (N tasks)".
- Add `DOM_IDS.FIRST_RUN_ADOPT_LITE`, `DOM_CLASSES` as needed. The controller is an
  inline script **below** the ES5 gate, so modern syntax is fine — but it is inline, so
  the edit changes a CSP hash → ship via `update-version.sh`.
- Routing: new `case 'adopt'` in `_routeFirstRunChoice`. The importer needs a ready
  AppState and a first-run user has none, so **do not** call `processImportedData`
  here. Use the same machinery `'sample'` uses to create the first routine from a
  `.mcyc`-shaped payload: `routineManager.js` `loadSampleRoutine(filename, options)`
  (~584) — but it takes a **filename** and `fetch`es `examples/<folder>/<filename>`,
  then builds the routine from the parsed JSON. So: split it — extract the
  "parsed sample → first routine in AppState" tail into a method that accepts an
  in-memory payload (e.g. `createRoutineFromPayload(payload, options)`), have
  `loadSampleRoutine` call it after the fetch, and have `'adopt'` call it with the
  Lite-derived payload. Then `markOnboardingComplete()` and
  `landInFocusViewWhenRoutineReady({ showInputBar: false, choice: 'adopt' })`, exactly
  as `'sample'` does.
- Rearm path: `backupRestoreManager.js` `rearmFirstRunChoiceScreen()` re-binds the
  screen after a factory reset. Factory reset's key filter
  (`keyLower.includes('minicycle')`, ~996) **does** wipe `miniCycleLite*` — verified —
  so the adopt control is simply absent after a reset. Hide it in the rearm path
  (re-run the detection; don't assume the page-load state) and say so in the
  factory-reset copy ("also clears the Lite list on this device") so the wipe is
  disclosed, not discovered.

### B3. Entry point 2 — returning users

- Settings → Data section: "Import my Lite list" button, rendered only when
  `buildLiteAdoptPayload()` is non-null. Calls
  `processImportedData(JSON.stringify(payload))` — AppState is ready here, so the
  full path (validation, truncation, quota, template-vs-progress modal) is reused
  unchanged.
- Hidden automatically in the Chrome extension and Capacitor builds: Lite isn't
  bundled there, so `miniCycleLite` never exists on that origin.

### B4. After adopting

- **Do not delete Lite storage.** The device may still be gated to Lite on a later
  load (or the user may open Lite deliberately); deleting would destroy their only
  working list there.
- Record `settings.liteAdoptedAt` (ISO string) via `AppState.update()` — in
  `state.settings`, not a standalone localStorage key — so the first-run control and
  any future "you have unimported Lite data" nudge can stay quiet. The Settings button
  stays available regardless (re-import is harmless; it creates a new routine).
- Notification: `notify.liteAdopted` — "Imported N tasks from Lite as '{title}'."

### B5. Wiring checklist (the usual four layers + tests)

- Labels in `defaultLabels.js` first (`validate:labels`); emoji separate from text.
- Constants: `DOM_IDS.FIRST_RUN_ADOPT_LITE`, `STORAGE_KEYS.LITE_COUNT`
  (`'miniCycleLiteCount'` — **currently missing** from `STORAGE_KEYS.LITE_*` and from
  `LITE_STORAGE_KEYS` in `backupRestoreManager.js`, so Settings backups omit Lite's
  cycle count today — fix as a prerequisite; `dataSanitizer.js` already has
  `sanitizeNonNegativeIntegerString()` for it).
- If the first-run controller reaches module code through `appContext`, name the
  method in the relevant `*ApiObj` allow-list in `featureBoot.js` (`validate:api`).
- New utils module: statically imported only by facade sub-modules / non-boot code →
  should not be boot-critical, but **run `npm run test:sw`** to let the precache drift
  guard decide.
- Journeys to add in `run-journey-tests.cjs`:
  1. *first-run adopts Lite list* — seed `miniCycleLite` (+ mode + count) before load;
     assert the control shows the right count; click; assert one routine with that
     title and N tasks, `onboardingCompleted === true`, Lite keys still present.
  2. *first-run has no adopt control without Lite data.*
  3. *settings import from Lite creates a routine* (returning user; goes through the
     template/progress modal — pick "progress" and assert completed flags survive).

---

## Part A — Lite: import a `.mcyc` file (the one un-freeze)

### A1. Scope, stated up front

Import only. Replace-the-list semantics (Lite has exactly one list). Import **as
template** (all tasks unchecked, `cycleCount` untouched) — Lite has no
template-vs-progress modal and sharing semantics are the common case. Lossy by
design; the loss is disclosed in the notice, the same way the separate-data notice
is disclosed today.

### A2. UI (`lite/miniCycle-lite.html`)

- New `<li>` in the main-menu list (before "Try Full Version"):
  `<button id="import-routine-file">` with the same icon/fallback structure as its
  siblings, label "Import Routine File".
- Hidden `<input type="file" id="import-routine-input" accept=".mcyc,.json,application/json" hidden>`
  — mirrors `#first-run-restore-file` in the full app. iOS ignores unknown
  extensions in `accept`, hence the JSON MIME as well; contents are validated anyway.
- No drag-and-drop (old devices; keep it to the picker).

### A3. Logic (`lite/miniCycle-lite-scripts.js`, ES5 only)

Wire next to `try-full-version` in the DOMContentLoaded block (~2782). Sketch:

```js
function parseRoutineFileForLite(text) {            // → { title, tasks, dropped } | null
  var data; try { data = JSON.parse(text); } catch (e) { return null; }
  if (!data || typeof data !== 'object' || !isArray(data.tasks)) return null;
  var title = sanitizeInput(typeof data.title === 'string' ? data.title
                           : (typeof data.name === 'string' ? data.name : '')) || 'My Tasks';
  var tasks = [], dropped = 0;
  for (var i = 0; i < data.tasks.length; i++) {
    var t = data.tasks[i];
    if (!t || typeof t.text !== 'string') { dropped++; continue; }
    var clean = sanitizeInput(t.text);             // strips <>" , trims, caps length
    if (!clean) { dropped++; continue; }
    if (tasks.length >= TASK_LIMIT) { dropped++; continue; }  // Lite cap is 100, full is 150
    tasks.push({ text: clean, highPriority: t.highPriority === true });
  }
  return tasks.length ? { title: title, tasks: tasks, dropped: dropped } : null;
}

function importRoutineFile(file) {
  if (!file || file.size > 1024 * 1024) { showNotification('⚠️ That file is too large to be a routine', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function () {
    var parsed = parseRoutineFileForLite(String(reader.result));
    if (!parsed) { showNotification('⚠️ That is not a miniCycle routine file', 'error'); return; }
    var current = taskList ? taskList.children.length : 0;
    if (!confirm('Replace your current list (' + current + ' tasks) with "' + parsed.title + '" (' + parsed.tasks.length + ' tasks)?')) return;
    saveUndoState('import');                        // 4-item stack → one-step way back (verify signature)
    taskList.innerHTML = '';
    document.getElementById('mini-cycle-title').textContent = parsed.title;
    for (var i = 0; i < parsed.tasks.length; i++) {
      addTask(parsed.tasks[i].text, false, false, null, parsed.tasks[i].highPriority, true);
    }
    autoSave();
    showNotification('✅ Imported ' + parsed.tasks.length + ' tasks from "' + parsed.title + '". '
      + 'Recurring, due dates, reminders and colors aren\'t available in Lite.'
      + (parsed.dropped ? ' (' + parsed.dropped + ' skipped)' : ''), 'info', 8000);
  };
  reader.onerror = function () { showNotification('⚠️ Could not read that file', 'error'); };
  reader.readAsText(file);
}
```

Rules that must hold:
- **ES5 only** — `var`, `function`, no `Array.isArray` polyfill needed (ES5) but no
  `Object.entries`, arrows, template literals, `?.`, `??`. Verify with acorn at
  `ecmaVersion: 5` (same check the head gate uses).
- Task text reaches the DOM only through `addTask()` → `textContent`. Never
  `innerHTML` with imported text.
- Ignore everything else in the file: dueDate, recurring*, reminders, priorityColor,
  deleteWhenComplete*, history, clearedTasks, theme, taskOptionButtons, cycleCount.
- Don't change Lite's mode from the file. (`deleteCheckedTasks`/`autoReset` → mode is
  possible, but silently switching modes on import is a surprise; leave it.)

### A4. Freeze bookkeeping (part of the same change, not optional)

- Banner at the top of `miniCycle-lite-scripts.js`: move "Import" out of *WHAT'S NOT
  INCLUDED* (leave "Export"), and change "Last meaningful update: v2.092" to the new
  version with a one-line reason.
- `docs/architecture/LITE_VERSION.md`: document the import, its limits, and that
  export is deliberately absent.
- Root `CLAUDE.md` Lite rule and `docs/working-on-code/CLAUDE.md` Lite note: "frozen
  except the vX.Y `.mcyc` import addition".
- `npm run validate:html` already covers `lite/miniCycle-lite.html`; there is no CSP
  hash impact (Lite serves under its own path and isn't in `validate:inline`'s scope).
- QA on a real gated device via `test.minicycle.app` (iOS 12 Safari file picker),
  not just Playwright — the point of Lite is the browsers Playwright can't run.

---

## Residual to verify independently (not blocked on this plan)

`cycleImportManager.js:650` — `deleteWhenComplete: task.deleteWhenComplete !== false`
reads as "missing → `true`", while `deleteWhenCompleteSettings` defaults to
`{ cycle: false, todo: true }` for non-recurring tasks. Which field governs at
completion time decides whether a `.mcyc` that omits `deleteWhenComplete` (any
third-party or hand-edited file, not just Lite) imports tasks that vanish on
completion in cycle mode. Run it before trusting either default.

---

## Out of scope

- Lite export (see decision table).
- Cross-device migration *off* Lite without a file — no mechanism exists and none is
  planned; B covers same-device, A covers files arriving *into* Lite.
- Two-way sync between the stores. The separation is the design.
