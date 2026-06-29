# Error Recovery & Degraded Mode

> How miniCycle survives two classes of startup failure: an **optional feature failing to load**
> and **corrupted `miniCycleData` in localStorage**. Both are handled by small boot-path utilities
> that intentionally sit *outside* the DI framework.
>
> Implemented Jun 2026 (ERROR_HANDLING plan Phases 1–2). Full historical plan:
> [`../archive/ERROR_HANDLING_IMPROVEMENTS_PLAN.md`](../archive/ERROR_HANDLING_IMPROVEMENTS_PLAN.md).

---

## Why these two modules don't use `createDIModule()`

Both run **before DI is wired**, so they can't depend on injected deps:

- `featureAvailability.markFailed()` is called *inside* `moduleLoader.js`'s catch blocks — that code
  **is** the wiring step, so it can't assume wiring has finished.
- `dataRecovery` is called from `appState._initializeInternal()`, a Phase-1 module that loads before
  `featureBoot` wires anything.

This is the same DI exemption already documented for `appState.js` / `globalUtils.js`. **Neither module
uses `window.*` or any global** — they're plain ES modules consumed via static `import`.

---

## 1. Feature Availability Tracking — `modules/utils/featureAvailability.js`

A **boot-level singleton** (`export const featureAvailability`). When an *optional* module fails to
load or initialize, `moduleLoader.js` calls `featureAvailability.markFailed(name, error)`, which:

- records the failure (deduped),
- sets the **`<html data-degraded-mode="true">`** hook (so CSS / a future indicator can react),
- `console.warn`s.

After boot, `uiBoot.finalizeUI()` calls `featureAvailability.showDegradedModeWarning(showNotification)`
**once**, surfacing `notify.featuresUnavailable` (friendly names via the module's `FRIENDLY_NAMES` map).

| API | Purpose |
|-----|---------|
| `markFailed(name, error)` | Record a failed optional feature (called in `moduleLoader` catch blocks) |
| `isAvailable(name)` | Has this feature loaded OK? |
| `getFailedFeatures()` | `[{ name, error, stack }]` |
| `showDegradedModeWarning(fn)` | One-time degraded notice (no-op if nothing failed) |
| `exportReport()` | Plain-text failure list for diagnostics |
| `degradedMode` (getter) | `true` if any feature failed |

`required`-tier modules still hard-fail the boot phase — this is only for **optional** features.

---

## 2. Data Corruption Recovery — `modules/utils/dataRecovery.js`

**Pure, synchronous, no DI** — usable standalone and from the boot-critical load path. Before AppState
falls back to a fresh/minimal state, it tries to salvage the data and *always* snapshots the raw bytes
first so nothing is lost.

`recoverCorruptedData(corruptedString, { storage })` does, in order:

1. **Backup** the raw string under `miniCycleData_corrupted_<timestamp>`, pruned to the newest
   `LIMITS.MAX_CORRUPT_BACKUPS` (so corruption backups can't themselves fill storage).
2. **Salvage** via escalating strategies: `direct-parse` → `remove-control-chars` → `close-brackets`
   (repair truncation by closing unbalanced brackets/braces).
3. Return `{ recovered, data, strategy, backupKey }`.

### Integration (`appState.js`)

Wired into all **three** previously-silent data-loss paths: `reload()` parse-error,
`_initializeInternal()` parse-error, and `_initializeInternal()` validate-false.

**Salvaged data is adopted only if it then passes the strict `validateSchema25Structure()` validator.**
Otherwise the existing minimal-fallback runs — but the corrupted bytes are already backed up. On a
successful repair the user sees `notify.dataRepaired` ("…some recent changes may be missing").

> The plan's `extract-cycles` regex strategy was dropped: its partial output never survives the strict
> Schema 2.5 re-validation, so it could never be adopted.

### Recovering a backup manually

A corrupted snapshot lives at `localStorage['miniCycleData_corrupted_<ts>']`. Inspect / re-import it via
the testing or import surfaces; it's the verbatim pre-reset string.

---

## Tests

- `tests/featureAvailability.tests.js` (10)
- `tests/dataRecovery.tests.js` (11)

## See also

- [`../archive/ERROR_HANDLING_IMPROVEMENTS_PLAN.md`](../archive/ERROR_HANDLING_IMPROVEMENTS_PLAN.md) — full 5-phase plan (Phases 3–5 still open)
- [`../security/ERROR_HANDLING_AND_TESTING_SUMMARY.md`](../security/ERROR_HANDLING_AND_TESTING_SUMMARY.md) — broader error-handling foundation
