# Review Patterns — Where miniCycle Breaks

Derived from the August 2026 review pass (~40 modules, ~35 findings). These are
the fault lines that produced repeat findings. A reviewer — human or AI — should
check these first rather than reading top-to-bottom.

---

## 0. Before acting on a finding — verify it by running it

The fault lines below tell you *where* to look. This section is about not trusting
your own conclusion once you get there.

**Findings in this codebase are reliably right about the location and unreliably
right about the mechanism** — and the wrong detail is usually load-bearing, i.e. it
changes or invalidates the fix. Every one of these was a real finding whose stated
mechanism did not survive execution (Aug 2026):

| The finding said | Running it showed |
|---|---|
| "guard the colour sink with `isValidHex`" | `isValidHex` accepts 3–8 digits; the sinks slice at fixed 6-digit offsets, so `#f00` passes validation and *still* yields `rgba(240,0,NaN)` — the proposed fix would not have closed the path it targeted |
| "no current route for a bad value" | the preset share-code importer gates on exactly that predicate, so there was one |
| "the counter is permanently dead" | `null++` is `1` — it self-heals on reload, and nothing reads the field |
| "450 lines registered and never consumed" | ~20 call sites across `uiBoot`, `coreBoot`, `undoRedoManager` — deleting it would have broken UI boot |
| "the splash gate is `shouldShowOnboarding()`" | that function has no production callers; the real gates were a pre-paint inline script and `appInit` |
| "callers should bail when core isn't ready" | `AppState.update()` awaits its own `init()`, so writes were already safe; bailing would have skipped listener setup and broken the feature permanently |

**Check:** run the smallest thing that settles the claim before writing the fix.
A node one-liner for semantics (`undefined++`, `parseInt('#f00'.slice(3,5),16)`), a
grep for "nothing uses this", a browser probe for behaviour. Reading the code gets
you a plausible conclusion; running it gets you the right one.

**Corollary — a passing test is not evidence the behaviour is correct.** Several
suites here asserted the bug, so code and test agreed with each other. The usual
cause is a fixture shaped unlike production data:

- `testingModal.tests.js` seeded `metadata.version` and a per-cycle `schemaVersion`
  — the app writes **neither**. So a test named "flags cycles needing migration"
  passed by injecting a field nothing creates, while the real check could never fire
  and the tool always reported "valid".
- `migrationFacade.tests.js` asserted *"all facade methods return undefined and do
  not throw before init"* — pinning the unsafe contract exactly, since a falsy
  `checkNeeded()` reads as "no migration needed".
- `taskValidation.tests.js` pinned `TASK_LIMIT === 100`, a hardcoded value that had
  silently diverged from the importer's limit.

**Check:** build fixtures from the real creation path (`createInitialSchema25Data`,
`createOrUpdateTaskData`) rather than inventing a shape; assert the **source**
(`x === LIMITS.FOO`) rather than the value; and confirm every new test **fails
without the fix** — revert, see red with the expected message, restore. A test
written alongside a fix can easily replicate the fixed expression instead of
exercising production code, and will then pass on revert while proving nothing.

**Corollary — a browser probe measures whatever state the page is actually in,
which is often not the one you named.** Verifying by running only helps if the
run exercises the rule under test. Chasing one Focus View layout bug (Aug 2026)
this cost five separate probes, in three different disguises:

- `main.css` un-fixes `#task-view` under **both** `body.onboarding-active` and
  `body.first-run-welcome-active`. Dropping only the first still measures the
  flow layout, where `position: relative` means `max-height` cannot move
  anything — `#task-view`'s top stayed at 257 across a 684px and an 823px
  height, and every clearance number from it was meaningless.
- An earlier probe stripped `[data-modal].visible` to clear overlays and blanked
  the page; its measurements described a broken render.
- The probe simulated `env(safe-area-inset-top)` by overriding
  `--focus-top-chrome` — **the exact declaration under test**. It faithfully
  reported the simulation back.

Each one produced confident, precise, wrong numbers, and two of them shipped.

**Check:** assert the page is in the state you think it is *before* reading any
value, and make the probe throw rather than report when it is not — e.g.
`if (getComputedStyle(el).position !== 'fixed') throw`. Then check what your
harness overrides: if the probe stubs, patches, or simulates the thing being
measured, it is testing the stub. And prefer measuring a value the app itself
publishes over recomputing it in the probe, so a divergence shows up as a
mismatch instead of agreeing with itself.

---

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

## 8. Post-es2020 built-ins — green tests prove nothing about old browsers

esbuild's `target: ['es2020']` transpiles **syntax, not built-ins**. A newer
built-in (`Object.hasOwn`, `.at()`, `.replaceAll()`) ships verbatim and throws
`TypeError` on browsers the feature gate deliberately admits (floor = es2020
syntax via the `?.`/`??` canary + `globalThis`: Chrome 80 / Firefox 74 /
Safari 13.1 — the syntax floor is the later one; `globalThis` alone admitted
iOS 12, found Sep 2026). Playwright runs modern Chromium, so
every test passes; lint has no target awareness. `.at(-1)` in undoRedoManager's
snapshot capture silently broke Undo on Safari ≤ 15.3 for ~10 months — the
wrapper's try/catch swallowed the throw, 3134/3134 tests green throughout.

**Check:** `npm run validate:builtins` gates this now. The human-review tell:
a change introducing the **first** use of a built-in in ~136 modules — if
nothing else in the codebase uses it, ask why before assuming it's fine.

## 9. Bracket lookups on name-keyed maps inherit from Object.prototype

`if (map[name])` on a plain object is truthy for `constructor`, `toString`,
`valueOf`, `hasOwnProperty` even when the map is **empty** — the lookup walks
the prototype chain. Anywhere user text becomes an object key (cycles by title,
labels by key), a truthiness or `in`-style check misfires on those names. And
`map['__proto__'] = {...}` sets the prototype instead of creating an own
property: it reads back fine in memory, then **serialises to `{}`** and
vanishes on reload. Both hit `getUniqueCycleName` (a routine named
"constructor" was silently renamed on an empty cycles object) — and the same
bug reappeared **the same day** in the validate-builtins script itself, where
`PROTO_METHODS['toString']` resolved the inherited native `toString` and
produced 53 false positives.

**Check:** lookups keyed by user-controlled or method-like names must use
`Object.prototype.hasOwnProperty.call` (not `Object.hasOwn` — see §8), or the
map must be created with `Object.create(null)`. Trust-boundary key filtering
lives in `DataValidator._checkForPrototypePollution()` and
`nameUtils.isNameTaken()` — extend those for new input paths.

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

## 10. Touch targets wider than their spacing overlap, and DOM order wins

Enlarging a hit area to meet a minimum-target-size guideline silently steals
clicks from the neighbour when the targets are closer together than they are
wide. The later sibling paints on top, so it is always the **earlier** control
that goes dead — and only in the region where they overlap, which is usually
dead centre.

Target size and visual spacing are **coupled** whenever the visible mark is
centred in its target: the box width *is* the gap between marks. You cannot have
22px spacing and 44px non-overlapping targets; one of the two has to move.

**Smell:** a negative margin pulling large targets together — `width: 48px;
margin: 0 -13px` is a statement that adjacent targets overlap by 26px.

**Check:** probe the hit-test, not the handler.

```js
const r = el.getBoundingClientRect();
document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); // === el?
```

A programmatic `.click()` **passing proves nothing here** — it bypasses
hit-testing, so the handler tests clean while every real pointer misses. For any
"this control does nothing" report, probe the centre point before reading JS.

**Precedent:** the Home View nav dots. A Feb 2026 accessibility commit added a
48×48 invisible target to dots spaced 22px apart; the Routine dot's centre landed
inside the Stats target and stayed unclickable for ~6 months. Full write-up:
`docs/incidents/BUG_nav-dots-overlapping-touch-targets.md`.

**Corollary — verify a repro before believing it.** The first attempt to
reproduce the old geometry lost a CSS specificity fight, left the pseudo-element
at its real size, and reported everything healthy. An unapplied override fails
*open*. Assert the simulated value took effect (`getComputedStyle(el,
'::after').width`) before trusting the verdict.

## What consistently holds up

Not everything needs re-review. These were checked and found sound: corruption
recovery, AppState persistence and concurrency, the service-worker caching
architecture, undo/redo internals, and the escaping in `historyManager` and
`clearedTasksManager`.

## Deliberate designs that read as bugs

Added Aug 2026 after a live browser review flagged all three of these as defects.
Each is intentional. **Do not re-flag them** — and note the shared failure mode:
each was judged in isolation, without checking what family or lifecycle it
belongs to.

### The charcoal prompt modals are a name-entry family

`.miniCycle-prompt-box` (charcoal) and `.mini-modal-box` (light/glass) are two
modal languages, not an inconsistency:

| Family | Used for |
|--------|----------|
| `.mini-modal-box` | confirmations — e.g. Factory Reset's "Delete Everything" |
| `.miniCycle-prompt-box` | **naming something** — create, duplicate, rename, save-as |

Every caller of the dark family is a name-entry action: Create New Routine
(`routineManager.js:680`), Duplicate Routine (`menuManager.js:547`), mobile
rename (`routineSwitcher.js:765` — its own comment cites the shared pattern),
preset save/export/import (`preferencesPresets.js`), backup naming
(`backupRestoreManager.js:276`). The dark treatment means "you're about to name
something new."

There *is* one real gap inside this otherwise-consistent convention — see
[`PROMPT_MODAL_THEME_TOKEN_GAP.md`](../future-work/PROMPT_MODAL_THEME_TOKEN_GAP.md).

### The task input bar is setup furniture, not daily furniture

A routine is built once and run many times. After setup the input bar is dead
weight on every subsequent run, so it is hidden by default and toggled from
**⋯ → Show/hide input bar**.

The empty state that reads *"Open the ⋯ menu at the top and click Show/hide input
bar to start adding tasks"* is therefore **the discovery mechanism for the
toggle**, not a detour around a hidden primary action. Without it a user would
never learn the bar is toggleable, and would be stuck with it on screen forever.
Once the bar is shown, the empty state rewrites itself to "Type your first task
in the bar above and press Add" — the copy is state-aware by design.

### The unpromoted games are staged content

`games/miniCycle- taskGame.html` and `games/miniCycle-taskScramble.html` are not
dead code. All three games landed in one commit (Nov 2025) as a set; only
`miniCycle-taskOrder.html` has been promoted (JS extracted, CSP-clean, wired to
the 100-cycle milestone). The unlock schema is namespaced per-game
(`unlockedFeatures: ["task-order-game"]`, `rewardType: 'game'`) precisely so
siblings can be added when the reward ladder grows. Unreferenced is the expected
state until a tier ships — reachability does not distinguish "abandoned" from
"not yet scheduled."

## Guarding the DI wrapper instead of its result

`moduleLoader` supplies cross-module hooks as optional-chained wrappers:

```js
onCycleSwitched: (...args) => deps.ui?.onCycleSwitched?.(...args)
```

That wrapper is **always a function**, so a call-site guard of
`typeof this.deps.onCycleSwitched === 'function'` always passes — while the wrapper
**returns `undefined`** whenever the inner hook is unwired. Anything chained onto the
result then throws:

```
TypeError: Cannot read properties of undefined (reading 'catch')
```

Found Aug 2026 across **9 call sites** in 5 modules, all chaining `.catch` onto a
lifecycle hook (`onCycleCreated` / `onCycleRenamed` / `onCycleDeleted` /
`onCycleSwitched`). Worst case is `routineSwitcher.confirmMiniCycle`, which has no
enclosing `try`: the throw lands after the state update has already succeeded and
before `hideSwitchMiniCycleModal()`, so the routine switches and the modal stays open.

Not reachable while the hooks are in `provides` and `validate:provides` passes — this
is rule #19's shape again: a branch written as though the dep might be absent, which
if it ever *is* absent fails as a confusing TypeError deep in a UI flow instead of a
clear wiring error. `validate:chains` does not catch it (the dep is `optional()` at
the call site and the `?.` lives in `moduleLoader`).

**Fix:** `Promise.resolve(hook(...)).catch(...)` — which `quickActionsManager` was
already doing. **When reviewing:** a `typeof === 'function'` guard on a DI-supplied
hook tells you nothing about what the call returns. Check the wrapper.
