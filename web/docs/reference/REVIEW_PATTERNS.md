# Review Patterns — Where miniCycle Breaks

Derived from the August 2026 review pass (~40 modules, ~35 findings). These are
the fault lines that produced repeat findings. A reviewer — human or AI — should
check these first rather than reading top-to-bottom.

## 1. Live-state mutation before the producer

`AppState.get()` returns a live reference. Code that mutates it and *then* calls
`update()` appears to work — the subsequent update persists the already-mutated
object — but two guarantees are silently lost: the undo snapshot captured by the
wrapper already contains the change, and listener diffs never see it.

**Grep:** `AppState.get()` followed by assignment or `.push()` on the result.
**Correct shape:** `taskButtons.js` — build pure, commit inside one producer.

## 2. State derived from the DOM

Reading task counts or completion from the DOM instead of state. Fails silently
when the list is filtered, collapsed, mid-render, or belongs to another routine.

**Grep:** `querySelectorAll` near `.length`, `TASK_INPUT_CHECKED`, `.checked`.

## 3. Sinks trusting upstream validation

A render sink assumes its input was sanitised earlier. Holds until a new field is
added upstream that nobody validates.

**Check:** every `innerHTML` template — is *every* interpolated value escaped, or
only the ones the author was thinking about? `getLabel(..., { vars })` does not
escape; see CLAUDE.md rule 7. `{ trusted: true }` and `trustedHTML` bypass all
escaping — enumerate every caller when auditing.
**Check:** "the UI can't produce this value" retracts nothing — the panel and the
`.mcyc` importer are two producers for the same schema, and only one is
constrained by a `<select>`. When judging whether a bad value is reachable,
check every producer, and prefer allowlisting at the normalizer over trusting
any of them.
**Precedent:** stored XSS via `recurringSettings.frequency` (v2.373); wrong
recurrence dates via imported `weekOfMonth.ordinal: '5'` — a finding first
retracted on UI-can't-produce-it grounds, then un-retracted via the import path.

## 4. Duplicated logic drifting apart

The same operation implemented twice, hardened once. Distinct from deliberate
duplication (the `.mcyc` vs `.mcyc.json` extension split is intentional and
documented at the call site).

**Grep:** after any fix, search the fixed pattern repo-wide.

## 5. Branch shadowing

A specific `else if` placed below a general one that already catches its
condition. Unreachable, and silently so.

## 6. Undo/gesture atomicity

One user gesture must produce exactly one snapshot. Executors never capture;
gesture entry points do. Extra snapshots strand the user on intermediate states
they never chose; zero snapshots make Undo skip past the gesture into an earlier
unrelated action.

**Check:** any new multi-update flow. Tests must model the update wrapper —
a bare mock cannot see wrapper-triggered captures (`taskCycleReset.tests.js`).

## 7. Date arithmetic on sparse periods

"Next occurrence" logic where the target may not exist in the next period
(day 31 in February, Feb 29 in a non-leap year). Falling back to "the 1st"
fires on a date the user never selected.

**Check:** every fallback in `recurringCalculators.js` scans forward for a
period that actually contains the target.

## What consistently holds up

Not everything needs re-review. These were checked and found sound: corruption
recovery, AppState persistence and concurrency, the service-worker caching
architecture, undo/redo internals, and the escaping in `historyManager` and
`clearedTasksManager`.
