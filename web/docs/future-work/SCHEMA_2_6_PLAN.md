# Schema 2.6 Plan

**Status:** Planned — **rewritten Aug 2026 against v2.517 by measurement.** The previous
version of this document described a data shape this codebase has never had (see
[What was wrong before](#what-was-wrong-before)); every structure, path and count below was
verified against the running code, and the claims that could not be verified are marked.
**Priority:** Medium — but see [Two renames, not one](#two-renames-not-one): the two halves
have very different value, and the cheaper half is the more useful one.
**Breaking changes:** Yes (stored data + the published `.mcyc` schema).
**Last Updated:** August 2026 (full rewrite: corrected schema shape, migration seam,
`.mcyc` obligations, surface inventory, harness-correct tests, plan ordering)

---

## What 2.5 actually looks like

Measured from `createInitialSchema25Data()` in `modules/routine/migrationManager.js:100`.
The stored document is **flat**. There is no `miniCycle` wrapper key:

```javascript
{
  schemaVersion: "2.5",
  metadata:     { createdAt, lastModified, migratedFrom, migrationDate,
                  totalCyclesCreated, totalCyclesCompleted, schemaVersion,
                  lastModifiedBy, storageQuota },
  settings:     { theme, darkMode, alwaysShowRecurring, autoSave, showThreeDots,
                  onboardingCompleted, /* …tour steps, priorityColor, quickActions… */ },
  data:         { cycles: { [cycleId]: Cycle } },
  appState:     { activeCycleId },
  userProgress: { … },
  customReminders: { … }
}
```

`docs/reference/SCHEMA_2_5.md` is accurate and is the reference for field-level detail —
prefer it over anything restated here.

**Two different `schemaVersion` fields exist.** The document-level one is the string
`"2.5"`. Tasks carry their own **integer** `task.schemaVersion` (default `2`), repaired in
`routineLoader.js:305`. They version different things and move independently. Nothing in
this plan changes the per-task integer.

---

## Two renames, not one

The original doc treated 2.6 as a single terminology fix. Measurement says it is two
independent changes with very different payoffs, and they should be judged separately.

|                          | **A · `deleteWhenComplete*` → `autoClear`** | **B · `cycles` → `routine`** |
|--------------------------|---------------------------------------------|------------------------------|
| Scope (filtered)         | **473 hits / 54 files**                     | **643 hits / 117 files** (`activeCycleId` alone) |
| What it fixes            | a live collision with a different feature   | terminology drift            |
| Aligns with              | the existing `clearedTasks` schema noun     | nothing already in the schema |
| UI vocabulary today      | already says "clear"                        | already says "routine"       |
| `.mcyc` format impact    | **yes** — published schema changes          | **none** — 0 references      |
| Recommendation           | **do this one**                             | optional; lower value per unit of risk |

### Rename A — `deleteWhenComplete*` → `autoClear`

**Why the current name is wrong, not merely inelegant.** `delete` already means something
else to users: `action.deleteTask` is *"Delete Task"* / *"Are you sure you want to delete
'{name}'?"* — explicit, user-initiated destruction. The field named `deleteWhenComplete`
describes something the product deliberately calls **clearing**, and the UI never once
calls it deletion (`taskButtons.js:285`):

```javascript
labelKey = isToDoMode ? 'taskOption.markedForClearing' : 'taskOption.clearOnReset';
```

| mode   | label shown          | description shown                                  |
|--------|----------------------|----------------------------------------------------|
| cycle  | "Clear on Reset"     | *removes task when cycle resets*                   |
| to-do  | "Marked for Clearing"| *removes task when completed tasks are cleared*     |

And the schema already owns the noun: `clearedTasks { entries, totalCleared,
autoPruneEnabled }`, documented as *"To-Do mode clears + cycle reset auto-removes"*, with
its own `clearedTasksManager`. **`taskCycleReset.js:385` records `deleteWhenComplete` tasks
into `clearedTasks`** — the field feeding `clearedTasks` is the one named "delete."

**Why `autoClear` and not `clearOnReset` / `clearOnComplete`.** The *trigger* differs by
mode — reset in cycle mode, clearing in to-do mode — which is exactly why the stored value
is a per-mode map. Naming the trigger reintroduces the mismatch in a new word.
`autoClear.cycle` and `autoClear.todo` read correctly in both.

**Shape.** Collapse the pair into one field while renaming — see
[the reconciler](#the-reconciler-you-must-not-break) for why the second field exists and why
removing it is the point:

```javascript
// 2.5                                        // 2.6
task.deleteWhenCompleteSettings = {…}   →     task.autoClear = { cycle: false, todo: true }
task.deleteWhenComplete = false         →     (removed — derived at read time)
```

### Rename B — `cycles` → `routine`

```javascript
data.cycles[cycleId]          →  data.routine[routineId]
appState.activeCycleId        →  appState.activeRoutineId
metadata.totalCyclesCreated   →  metadata.totalRoutinesCreated
```

**Keep** `cycleCount`, `userProgress.cyclesCompleted`, and the user-facing "Complete Cycle"
wording — those refer to completions, which really are cycles.

This is cosmetic. It is the larger of the two changes and fixes no defect. Sequence it after
A, or skip it.

---

## Migration seam

**Migration lives in `modules/routine/migrationManager.js`**, not in `routineLoader.js`.
The previous doc named the wrong file; `routineLoader.js`'s only `schemaVersion` code is the
per-task integer repair described above.

Existing entry points, all named for 2.5 — a 2.6 step means generalising these or adding a
parallel chain beside them:

| Function | Role |
|---|---|
| `checkMigrationNeeded()` | decides whether a migration runs |
| `simulateMigrationToSchema25(dryRun)` | dry-run path |
| `performSchema25Migration()` | the actual transform |
| `initAppWithAutoMigration(options)` | boot-time entry |
| `forceAppMigration()` | manual trigger |
| `createInitialSchema25Data()` | fresh-install shape |

A migration function is deliberately **not** sketched here. The previous doc's example was
written against the wrong shape and would have thrown on real data; write it against
`SCHEMA_2_5.md` and the functions above.

---

## The gate you must not miss

**`appState.validateSchema25Structure()` (`modules/core/appState.js:572`) decides whether
stored data is adopted at all.** It has **9 call sites** — first load, corruption recovery,
cross-tab foreign writes, and restore.

If it is not taught about 2.6, every 2.6 payload is rejected as invalid and the app behaves
as though the user has no data. This is the single highest-consequence omission in the
previous plan, which never mentioned it.

---

## The reconciler you must not break

Rename A removes a field. Before removing it, understand what currently holds the design
together, because a mechanical sweep can silently delete it.

`deleteWhenCompleteSettings {cycle, todo}` is the durable truth; `deleteWhenComplete` is a
flat mirror. **They arrive disagreeing on every import.** A shared `.mcyc` that omits both —
which the published schema instructs authors to do, marking the flat field *"DERIVED, so do
not author this"* — imports with mirror `true` and `settings.cycle` `false` (measured).

The two consumers read different fields:

- `taskDOM.js:665` and `focusTaskPanel.js:387` **render** through `resolveDeleteWhenComplete()`
- `taskCycleReset.js:340` and `:741` **delete** on the raw mirror

What makes that safe is **`syncTaskDeleteWhenComplete()` in `modules/utils/cycleMode.js`**,
called on load from `routineLoader.js:320`. It re-derives the mirror from the map and writes
the corrected value back to storage before the user can act. Measured across a reload:
stored mirror `true` → `false`.

**It is the entire safety margin.** Mutation-testing it (v2.517-era, tests only) disabled the
helper and the outcome was a **deleted task** — `remaining task ids: []` — for a task whose
stored setting said keep. It is now covered by:

- `tests/cycleImportManager.tests.js` — three tests on the per-mode map the importer emits
- `tests/automated/run-journey-tests.cjs` — journey *"imported delete-settings reconcile and
  KEEP is honoured"*, which asserts the reconciliation **in storage** and then the survival
  that depends on it

Collapsing to a single `autoClear` field **removes the need for this reconciler entirely** —
with one field there is nothing to reconcile. That is the strongest argument for doing
Rename A. Until it is collapsed, do not touch `routineLoader.js:320`.

---

## `.mcyc` and the published JSON Schemas

The previous doc had this backwards. Corrected by measurement:

**Rename B does not touch the file format.** A `.mcyc` is a **single flattened routine** —
`name`, `title`, `tasks`, `autoReset`, `cycleCount`, `recurringTemplates` — with no cycles
map and no `activeCycleId` (0 references in `mcyc.schema.json`). **Do not** write schema
detection, auto-migration, or a *"file format updated"* notification for it; that would tell
users something untrue about a format that did not change.

**Rename A does touch it.** `deleteWhenCompleteSettings` and `deleteWhenComplete` are part of
the published format (`mcyc.schema.json`, `schema/mcyc-2.5.schema.json`, and 8 mentions in
`pages/mcyc-format.html`). Obligations:

1. **`schema/mcyc-2.5.schema.json` must not change.** `pages/mcyc-format.html` publishes it
   as *"Pinned to format 2.5. Never changes. Reference this from CI."* That is an external
   promise to anyone validating shared files.
2. Publish a new **`schema/mcyc-2.6.schema.json`** and add its row to the format page's
   version table.
3. Update the rolling **`mcyc.schema.json`** to describe `autoClear`, keeping
   `deleteWhenCompleteSettings` as an **accepted alias** — files already in the wild carry it.
4. `cycleImportManager` accepts both keys; `mcycPayload` / `cycleExportManager` write only
   `autoClear`.

**The `.mcyc` format version and the app schema version are independent lines** that both
read "2.5" today. Do not bump one because the other moved.

---

## Surface inventory

Files pinning the schema string or the renamed fields, excluding `archive/`, `dist/`,
`lite/` and `backup/`. The previous doc listed six files; these are the ones that exist.

**Core / state**
`core/appState.js` · `core/appGlobalState.js` · `core/constants.js` · `core/types.js` (JSDoc typedefs)

**Routine / migration**
`routine/migrationManager.js` · `routine/routineLoader.js` · `routine/routineManager.js` · `routine/modeManager.js`

**Data integrity — none of these were in the previous plan**
`utils/dataValidator.js` · `utils/dataRecovery.js` · `utils/dataSanitizer.js` ·
`storage/backupManager.js` (IndexedDB blobs) · `ui/backupRestoreManager.js` ·
the first-run rescue screen in `miniCycle.html`, which accepts **two** backup formats

**Import / export / share**
`ui/cycleImportManager.js` · `ui/cycleExportManager.js` · `ui/shareManager.js` ·
`utils/mcycPayload.js` · `mcyc.schema.json` · `schema/mcyc-2.5.schema.json` · `pages/mcyc-format.html`

**Task / recurring (Rename A concentrates here)**
`task/taskCycleReset.js` · `task/taskButtons.js` · `task/taskDOM.js` · `task/taskCRUD.js` ·
`task/taskUtils.js` · `task/taskDOMPatch.js` · `utils/cycleMode.js` · `utils/globalUtils.js` ·
`recurring/recurringActivation.js` · `recurring/recurringTemplate.js` ·
`recurring/recurringSettingsApplicator.js` · `ui/focusTaskPanel.js` ·
`ui/undoTransactionDiff.js` · `ui/undoSnapshotUtils.js` · `features/clearedTasksManager.js`

**Easily missed**
`games/miniCycle-taskGame.js` · `games/miniCycle-taskOrder.js` · `games/miniCycle-taskScramble.js` ·
`modules/testing/testing-modal-{analysis,backup,debug,diagnostics}.js` ·
`scripts/collect-stats.cjs` · `scripts/capture-store-screenshots.cjs` · `pages/product.html` ·
**~30 `tests/*.tests.js` files**

**Labels.** Rename A should also retire `taskOption.markedForClearing` /
`taskOption.clearOnReset` as *separate* keys only if the UI genuinely stops distinguishing
the modes — it currently does, deliberately, so **keep both labels**. The rename is to the
stored field, not to what users read.

---

## Testing

This repo does **not** use Jest. The previous doc's `describe`/`expect` examples were not
runnable here. Two harnesses:

**Module tests** — `tests/<module>.tests.js`, a custom browser harness. Throw to fail:

```javascript
await test('2.5 → 2.6 renames the delete pair to autoClear', () => {
    const migrated = mod.migrateSchema_2_5_to_2_6(fixture25());
    const task = migrated.data.cycles.morning.tasks[0];   // Rename B not yet applied
    if (!task.autoClear || typeof task.autoClear.cycle !== 'boolean') {
        throw new Error(`autoClear missing: ${JSON.stringify(task)}`);
    }
    if ('deleteWhenComplete' in task || 'deleteWhenCompleteSettings' in task) {
        throw new Error('legacy delete fields should not survive migration');
    }
});
```

**Journey tests** — `tests/automated/run-journey-tests.cjs`, real boot in Playwright,
asserting persisted state. This is the layer that catches schema regressions module tests
miss. Add a journey that boots a 2.5 payload, confirms migration, and confirms a task whose
`autoClear.cycle` is `false` still survives a cycle reset.

**Mutation-test every new assertion.** Prove it fails without the change. The existing
delete-reconciliation journey exists because a first mutation attempt passed — the test was
fine, the guessed mechanism was wrong.

**Gates that must stay green** (`npm run` targets): `lint`, `test`, `test:sw`, `test:meta`,
`test:layout`, `test:journey`, `test:a11y`, `test:changelog`, `test:restore`, and
`validate:{csp,html,docs,di,comments,builtins,labels,chains,api,cache,provides,inline,legacy}`.
`test:sw` matters if any new module file enters the boot graph.

---

## Ordering relative to other plans

1. **`STATE_TRUTH_MIGRATION.md` comes first.** It says so explicitly: *"Do not start at
   schema 2.6 or UUID keys. Collapse Gen 1 on the loop first."* It also proposes **stable
   UUID map keys with `title` as the display name**. Today cycles are keyed by name, which is
   both what that plan wants to change and a CLAUDE.md #18 prototype-pollution hazard. Doing
   Rename B first means renaming a map whose keying is about to change anyway.
2. **This plan.** Rename A first; Rename B optional and after it.
3. **`TASK_ORDERING_SYSTEM_PLAN.md` is downstream** — its task object is declared
   "Schema 2.6+", so it waits on whichever renames land.

`APPSTATE_MERGE_STATES.md` notes a schema change is a natural moment to revisit merge
semantics; it does not block and is not scheduled.

---

## Effort

The previous "2–3 days" estimate was built on a six-file surface and is not survivable.

- **Rename A** — 473 hits / 54 files, plus the published-schema work and the field collapse.
  The collapse is the careful part: the two deletion sites in `taskCycleReset.js` must move to
  the resolver in the same change that removes the mirror.
- **Rename B** — 643 hits / 117 files for `activeCycleId` alone, mechanical but wide, and the
  review pass dominates.

Neither is a "day." Treat the migration function as the small part and the audit of the
surfaces above as the real work.

---

## Risks

| Risk | Mitigation |
|---|---|
| `validateSchema25Structure` not updated → all 2.6 data rejected as invalid | Update it and all 9 call sites in the same change; add a journey booting a migrated payload |
| Reconciler removed during the sweep before the field collapse lands | Do not touch `routineLoader.js:320` until `autoClear` is single-field; journey *"imported delete-settings reconcile and KEEP is honoured"* fails loudly if it goes |
| Frozen `schema/mcyc-2.5.schema.json` edited | It is a published external contract — add 2.6 beside it, never edit it |
| Backups in IndexedDB and the two rescue-screen formats still hold 2.5 | Restore must migrate on read, not assume the current version |
| Data loss during migration | Automatic backup first; validate after; `test:restore` covers the rollback generator |
| Half-migrated stored data if a sweep is partial | One migration function, one version bump, no field-by-field rollout |

---

## Success criteria

- [ ] 2.5 data migrates with zero loss, verified on a real backup
- [ ] `validateSchema25Structure` (or its successor) accepts 2.6 at all 9 call sites
- [ ] `autoClear` is a single field; no mirror remains; `taskCycleReset` reads via the resolver
- [ ] `schema/mcyc-2.5.schema.json` byte-identical; `schema/mcyc-2.6.schema.json` published;
      format page lists both
- [ ] Importer accepts `deleteWhenCompleteSettings` **and** `autoClear`
- [ ] Full suite and every gate green (see [Testing](#testing))
- [ ] New migration tests, each mutation-verified
- [ ] `SCHEMA_2_5.md`, `DATA_SCHEMA_GUIDE.md`, `MCYC_FILE_FORMAT.md`, `CLAUDE.md` updated;
      a `SCHEMA_2_6.md` written

---

## Future considerations

**Dev-build `validateTask()` enforcement** *(carried from the archived
HIGH_PRIORITY_NULL_DEFAULT_FIX postmortem)* — route task creation through `validateTask()` in
dev builds so field-default drift is caught where objects are born. Precedent: the
`highPriority: null` bug (fixed v2.398) shipped because a creation path defaulted a field
differently from the schema.

This is also the right answer for **`highPriority` / `priorityColor`, which this plan
deliberately leaves alone.** They are a flag plus an optional per-task override of the global
`settings.priorityColor` default — not a mirrored pair, no dual-write, no drift. Restructuring
them would cost ~165 sites and buy no correctness. The one real wart (`highPriority: null`) is
a validation problem, and a validator is the fix.

---

## What was wrong before

Recorded so the same errors are not reintroduced. The pre-Aug-2026 version of this document:

- **Described a `miniCycle` wrapper** (`data.miniCycle.data.cycles`,
  `data.miniCycle.appState.activeCycleId`) that this codebase has never used — 18
  occurrences, and the only doc in the repo with that shape. Its migration function would
  have thrown on the first property access.
- **Put the migration in `routine/routineLoader.js`.** It lives in `migrationManager.js`.
- **Conflated the document `schemaVersion` string with the per-task integer.**
- **Specified `.mcyc` auto-migration and a user notification for Rename B**, which does not
  affect the file format — and said nothing about Rename A, which does.
- **Never mentioned `validateSchema25Structure`**, the gate that decides whether data loads.
- **Listed six files to update**; the real surface is in the inventory above.
- **Used Jest examples** that cannot run in this repo.
- **Estimated 2–3 days** on that six-file premise.

The status line said "premise re-verified Aug 2026." That check confirmed only that the
rename had not happened yet; it did not check the document's own shape against the code.
