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

### Date-only strings parse as UTC

`new Date("2026-08-06")` is UTC midnight per spec, which is the *previous local
day* in every negative UTC offset. Any such value compared or displayed with
`new Date()` is a one-day bug across the Americas. Use `parseDateAsLocal()` from
`recurringDateUtils.js` — it already existed and the recurring subsystem already
used it; the due-date paths just never adopted it, which is why the bug survived.

**Grep from the PRODUCERS, not the call sites** — that is what makes this
tractable: `<input type="date">` (its `.value` is always `YYYY-MM-DD`) and
`.toISOString().split('T')[0]`. Timestamps and full ISO datetimes carry time
information and are safe; `toISOString()` output is unambiguous.

**Precedent:** tasks marked overdue a day early, due-date reminders firing a day
early, and wrong dates on the task, in history, and in cleared tasks — six sites,
Aug 2026.

### …and the write side has the same bug, mirrored

The round trip has two halves and the first fix only closed one. **Writing** a
`YYYY-MM-DD` from a `Date` renders the *UTC* calendar day via both
`.toISOString().split('T')[0]` and `input.valueAsDate = d` — the latter is easy
to miss because it looks like a typed convenience API, not a string conversion.
In a negative offset an evening local time is already tomorrow in UTC, so the
written day is one too far. Use `formatLocalDate()` from `recurringDateUtils.js`
— it is the counterpart to `parseDateAsLocal()` and they close the loop.

**Grep:** `valueAsDate`, `toISOString`, and any hand-rolled
`getFullYear()/getMonth()/getDate()` triple — the last is how this hid: two
files had already written that helper privately, one with a comment naming the
hazard, and neither was shared.

**Also check what feeds the formatter.** A "tomorrow" that carries the current
clock time is fine until it meets a date-only context; normalize to local
midnight at the source.

**Precedent:** the recurring specific-date input defaulted TWO days out from
20:00 EDT / 17:00 PDT onward — silent, and it scheduled the recurrence a day
late if accepted (Aug 2026). Invisible in CI, which runs in UTC.

### Long timers silently fire immediately

`setTimeout` stores its delay as a signed 32-bit int, so anything above
2,147,483,647 ms (~24.8 days) overflows and runs **now**. If the handler
reschedules itself, that is a loop rather than one misfire.

**Check:** any `setTimeout` whose delay is user-configurable or derived from a
stored timestamp. Clamp to `LIMITS.MAX_TIMEOUT_MS` and re-arm.
**Precedent:** a "every 30 days" reminder became an unbounded notification loop
(the frequency input offered Days with no `max`).

## What consistently holds up

Not everything needs re-review. These were checked and found sound: corruption
recovery, AppState persistence and concurrency, the service-worker caching
architecture, undo/redo internals, and the escaping in `historyManager` and
`clearedTasksManager`.
