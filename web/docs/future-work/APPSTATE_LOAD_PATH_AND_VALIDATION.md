# AppState — Load Path, Validation and Leftovers

> **Status:** Open — 3 items, none started ·
> **Severity:** Low for all three ·
> **Found:** Nov 2026, review of `modules/core/appState.js` and the undo wrapper in
> `undoRedoManager.js` at v2.675.
>
> Scope: the load, `update()`, `save()` and multi-tab paths were read in full. The migration
> and corruption-recovery helpers were skimmed. The three items are readings of the code;
> none was reproduced as a failure. The timings were measured.

The persistence side is in good shape. Every write goes through `AppState.update()` (202
call sites), which rolls the whole state back if the producer throws. Pending saves flush on
`pagehide` and on the tab going hidden, not only on unload. A save never lands over a newer
build's document, saves are held while a damaged original could not be copied aside, a
pre-migration copy is kept, and a per-tab id separates another tab's write from this tab's
own rapid saves.

---

## 1. Two copies of the load path

`_initializeInternal()` adopts stored data through `_adoptStoredDocument()`. `reload()`
re-implements the same steps inline (parse, recover, block on newer, migrate, validate), and
the two have diverged:

- A document that parses but has the wrong shape is salvaged by `_adoptStoredDocument()`
  (it calls `recoverCorruptedData()`); `reload()` returns `null` for it.
- The `autoClear` backfill for tasks and recurring templates runs only in
  `_initializeInternal()`.

`reload()` is the path a brand-new user's data goes through, after the first-run screen
creates it.

**To do:** have `reload()` call `_adoptStoredDocument()` and share one post-adopt step for
the backfill, so there is a single definition of "adopt what is in storage".

## 2. `validateStateStructure()` is shallow

It checks that the version is current, that `data.routine` is an object and that `appState`
is an object. `typeof null` is `'object'`, so `data.routine: null` passes, as does an array.
Nothing inside a routine is checked. This is the gate for adopting another tab's write in
the `storage` handler, the stored document in `save()`'s conflict check, and salvaged data.

The practical risk is low, since every writer is the app itself.

**To do:** reject `null` and arrays for `data.routine`, and check that each routine has a
`tasks` array, which is what the rest of the app dereferences first.

## 3. Dead and stale code in `appState.js`

- No callers in `modules/`: `getStateManager()`, `assignCycleVariables()`,
  `getActiveCycle()`, `updateActiveTasks()`, `setActiveCycle()`. Check the tests before
  removing them.
- `lastSavedTimestamp` is assigned in two places and never read.
- `STATE_DATA_PROPERTIES` still lists `cycles`, a Schema 2.5 name.
- The JSDoc types say `Schema25Data`, and the `update()` examples still reach a routine
  through the 2.5 `cycles` map instead of `data.routine`.

---

## Measured: cost per update and per save

`update()` clones the whole state with `structuredClone()` for its rollback copy, and
`save()` parses the stored document and serialises the current one. Timed in Node on a
desktop Mac, 50 runs each, on synthetic states:

| State size | Clone per update | Parse + serialise per save |
|---|---|---|
| 6 KB (one sample routine) | 0.09 ms | 0.04 ms |
| 265 KB (10 routines, 200 history events each) | 1.9 ms | 1.5 ms |
| 3.7 MB (50 routines, 500 history events each) | 27 ms | 19 ms |

This is not a problem at realistic sizes. It becomes noticeable only near the browser's
storage ceiling of about 5 MB, which is the real limit of keeping everything in one
document. A phone will be several times slower than these figures.

## Reviewed, design choices rather than issues

- **Undo is installed by replacing `AppState.update` at run time** (`undoRedoManager.js`).
  The `{ system: true }` option exists only in that wrapper; the method on `MiniCycleState`
  takes two arguments. A before-update hook on the state manager would make the option part
  of the real signature.
- **`get()` returns the live object.** Nothing stops a mutation outside `update()`; common
  mistake 13 in `CLAUDE.md` covers it, and only review catches it.
- **`update()` does nothing when there is no data yet.** Documented and deliberate (see the
  boot sequence notes in `CLAUDE.md`), but the caller cannot tell the producer did not run.
- **The state manager shows the saving indicator and notifications itself**, which puts
  presentation in the data layer.

## Related

- [State-as-Truth Migration](STATE_TRUTH_MIGRATION.md)
- [AppState Merge States](APPSTATE_MERGE_STATES.md)
- [Boot Orchestration Hardening](BOOT_ORCHESTRATION_HARDENING.md)
