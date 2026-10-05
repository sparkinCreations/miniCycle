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
- `migrationFacade.tests.js` (removed Sep 2026 with the pre-2.5 migration) asserted *"all facade methods return undefined and do
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

---

## 11. `provideInstance` is not a delivery route

A manifest's `provideInstance: 'foo'` registers the instance on
`deps.<category>.foo`. It does **not** make `foo` injectable into another module.
Reaching it from elsewhere needs an explicit `depMappings` entry in
`moduleLoader.js` — the house shape being a lazy opener alongside its neighbours:

```js
openTipArchive: (...args) => deps.features?.tipArchive?.openModal?.(...args),
```

Without that entry the dep resolves to `undefined`, the caller's `?.` swallows it,
and at runtime the feature is simply absent — nothing throws, nothing warns.

**There IS a gate, and it is not the one you would reach for.** `validate:di`
skips `lazyRequires` by design (intentionally cross-phase), so it stays green.
The battery that catches it is **`diWiring.tests.js` TEST 4** — "All lazyRequires
deps have depMappings or CORE_DEPS entries" — which runs in the browser suite.
Note its own history: that battery used to self-skip in the CLI runner, leaving
this bug class with zero automated coverage, and was fixed to run in CI.

Found Sep 2026: the Welcome Screen's rotating tip closed the overlay and opened
nothing, because `tipArchive` had been injected by name with no route behind it.
It was caught by a browser probe *before* the suite ran — the suite would have
caught it too, which is the argument for running the suite rather than trusting
`validate:*` alone.

**Check:** for every cross-module instance you inject, grep `moduleLoader.js` for
the name. If it is not in `depMappings`, it is not being delivered — and run the
browser suite, not just the validators.

---

## 12. A shared class may be conditionally hidden

Reusing a class for visual parity is the obvious move and can make a whole surface
invisible. `critical.css` carries:

```css
html:not(.mc-first-run) .first-run-choice { display: none; }
```

`.first-run-choice` looks like the container class to reuse for any screen that
should match the first-run screen — and a returning user never carries
`mc-first-run`, so the reused surface renders nothing, silently.

Found Sep 2026 while building the Welcome Screen; caught by reading the stylesheet
before reusing, not by a test — no test would have failed, because the module
mounts correctly and only the CSS hides it.

**Check:** before reusing a class from another surface, grep the stylesheet for
that class name and look for ancestor-state selectors (`html:not(...)`,
`body.x`, `[aria-expanded]`) gating it. Self-contained inner classes
(`.first-run-wordmark`, `.first-run-btn`) are safe; container classes usually are not.

---

## 13. Contrast over a photograph cannot be judged by eye or by model

White text over `Routine_Lists.webp` measured **1.47:1** on two shipped surfaces
— under a third of WCAG AA's 4.5:1 — and neither the developer nor a reviewer
spotted it as a *failure*, only as "a bit faint". At full opacity it still only
reached 1.69:1, so the instinct to "bump the opacity" cannot work.

Two ways to measure it wrongly, both hit during the fix:

- **Modelling the gradient.** A radius was read as a diameter, halving the
  computed coverage.
- **Sampling beside the text** instead of behind it. Where a scrim is narrower
  than the surrounding area this reports failures that do not exist.

**Do this instead:** record each element's rect/colour/opacity, hide the text,
screenshot, feed the PNG back into the page as a data URL, and sample the canvas
at the recorded rects. Full method and the scrim geometry rules are in
[ACCESSIBILITY.md](../project-info/ACCESSIBILITY.md#color-contrast-).

---

## 14. A 200 from a content-hashed build proves nothing

Production serves three layers for one module: a stable-path **shim** (~220 B,
testing-modal only), a hashed **re-export stub** (~220 B), and the shared **chunk**
that holds the code. The first two return `200 application/javascript`, so a
`curl` + `grep` check reports success on the fetch and failure on the content —
and reads as "my change did not ship".

Two compounding traps:

- esbuild **code-splits**, so a module's own hashed file can be pure re-exports.
  Its hash then does **not** change even when its source did.
- Superseded hashes are **purged** — the previous build's URLs 404 straight after
  a deploy, so an old hash you noted earlier is not a valid probe.

Sep 2026: this produced a false "the icon did not ship" investigation; the icon was
in the shared chunk throughout.

**Check:** verify by artifact shape and by content that lives in the HTML
(inlined `critical.css`, markup, labels), or just open the page and assert the
behaviour. Only follow the chunk chain when you actually need to.
Full method: [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md).

## 15. A browser API that only *exists* in automation can gate the code under test

In headless Chromium `window.showSaveFilePicker` is a **function** — it just
rejects with `AbortError` ("The user aborted a request"), because there is no UI
to show a dialog. So a `typeof window.showSaveFilePicker === 'function'` feature
check passes, the call is made, and the rejection is indistinguishable from a
user closing the dialog.

That is exactly how the factory reset reads it, and correctly: `AbortError` means
"the user declined", so [`backupRestoreManager.js`](../../modules/ui/backupRestoreManager.js)
`saveBackupFileAs()` returns `'cancelled'` and the reset **declines to delete
anything** (it fails closed on purpose — after the wipe there is nowhere in the
browser a backup could survive).

The product behaviour was right. The test consequence was not:

- v2.583 added that gate. CI's Automated Tests went green → red on the same
  commit (`c338015a` green, `da82744f` red).
- All four factory-reset journeys began stopping **at the gate**, so for nine
  days the operation that clears localStorage, caches and every IndexedDB
  database had **zero** automated coverage.
- The red read as "the reset tests are flaky again", which is the worst possible
  disguise for "the reset is no longer verifiable".

Measured Oct 2026, same app, same click, only the picker differing:

| Picker | Routines before → after | Backup written |
|---|---|---|
| Native (headless) | 1 → 1 (survived) | 0 bytes |
| Stubbed (user saves) | 1 → 0 (wiped) | 3,544 bytes |

**Check:** when a journey drives a destructive or file-touching flow, assert that
the gate in front of it was actually *reached and satisfied*, not just that the
end state looks plausible — a skipped destructive action and a correctly-refused
one are the same DOM. Journeys that trigger a reset must pass
`openFresh(..., { saveDialog: 'save' | 'cancel' })`; the stub and the full
reasoning live at `SAVE_DIALOG_STUB` in
[`run-journey-tests.cjs`](../../tests/automated/run-journey-tests.cjs).

The stub is **opt-in per journey, never harness-wide**: replacing a real browser
API for all 32 journeys to fix 4 trades a visible failure for an invisible one.

Generalise beyond this one API — the same shape applies to anything automation
provides as a stub that rejects or no-ops: `showSaveFilePicker`,
`showOpenFilePicker`, `navigator.share`, Notification permission, clipboard
reads. If a feature check cannot tell "present and working" from "present and
inert", the test must stub it deliberately or assert it was satisfied.

## 16. A test that asserts `getLabel()` wording depends on what ran before it

[`themes.js`](../../modules/labels/themes.js) calls `setLabelResolverDependencies()`
**at module load time**, and it imports `labelResolver.js` **unversioned**. So the
first test anywhere in a run that imports `themes.js` wires the ONE shared
resolver to live `AppState` — permanently, for every test after it. Nothing
unwires it, and nothing announces it.

The same assertion then gives two different answers depending on the runner:

- `npm test` — per-module isolation, `themes.js` never loaded, so `getLabel()`
  returns raw `DEFAULT_LABELS`;
- the in-app suite's **Run All** — one page, one shared module registry, so
  `getLabel()` returns the *active routine's themed* label.

Oct 2026: two `focusMode` assertions required `data-label` to contain the literal
word `"cycle"`, inside a test named "…and themed data-label". `focusMode.cycleActionLabel`
is vocab-themable and **no theme's value contains "cycle"**:

| theme | `cycleActionLabel` | literal-word assertion |
|---|---|---|
| classic | `Cycle` | ✅ |
| habit-tracker | `Complete\nCheck-in` | ❌ |
| fitness | `Complete\nWorkout` | ❌ |
| scholar | `Complete\nSession` | ❌ |
| cleaning | `Complete\nSweep` | ❌ |

(habit-tracker's value was `Complete\nStreak` when this was written and is
`Complete\nCheck-in` now — a themable label's *text* changes, which is exactly
why an assertion must name its key rather than its wording.)

Two accidents kept it hidden. `getActiveTheme()` falls back to
`THEME_DEFINITIONS.classic` rather than null, and `classic` happens to leave the
label as `"Cycle"` — so the default path passes. And the sibling todo-mode
assertion passes under *every* theme only because all four clear labels happen to
begin with "Clear". Neither is a contract; both are coincidence.

This mattered beyond CI: the Testing modal ships in production, so every user on
a non-classic theme saw two failures that were not failures.

**Check:** never assert the *wording* of a themable label. Resolve the same key
the module resolves and compare, then cross-check that the opposite key was not
used — the contract worth testing is the **mode → key mapping**, not the English:

```js
const cycleLabel = () => getLabel('focusMode.cycleActionLabel');
const clearLabel = () => getLabel('focusMode.clearActionLabel');
if (dataLabel !== cycleLabel()) throw new Error(`expected ${cycleLabel()}, got ${dataLabel}`);
if (dataLabel === clearLabel()) throw new Error('used the CLEAR label — mapping is wrong');
```

Verify across the lens, not just the default: wire each theme in turn and assert
the module still passes. A suite that is green under `classic` alone proves only
that one vocabulary works. Scope at the time of writing: 6 test files import
`themes.js`, 9 assert `getLabel()` output, and 4 modules import `themes.js` at
top level — any of which is enough to flip the resolver for everything downstream.

Same family as [#15](#15-a-browser-api-that-only-exists-in-automation-can-gate-the-code-under-test):
a signal that cannot distinguish "working" from "inert". There, an inert API read
as user intent; here, an unwired resolver reads as the default vocabulary.

## 17. ARIA state maintained at the call sites instead of by the owner

`aria-expanded` on the task-options trigger was set in
`taskEvents.revealTaskButtons` — a *caller* of
`TaskOptionsVisibilityController.setVisibility()`, the function that actually
owns whether the menu is on screen. The click path was therefore correct and
every other path was wrong, in both directions:

| route | before |
|---|---|
| three-dots click | correct (the one call site that set it) |
| `focusout` | menu hidden, trigger still `expanded="true"` |
| `arrow-move` | `expanded="true"` set although `canHandle()` **rejected** the caller and the menu never opened |
| Escape (`taskButtons.js`) | hides directly, never touched aria |
| `_restoreActiveTaskOptions` (`taskRenderer.js`) | shows directly, never touched aria |

Reported Oct 2026 as "the controls can disappear while their trigger still
reports itself as expanded". Measured pre-fix: `{"expanded":"true","visible":false}`.

The `arrow-move` row is the instructive one. Setting the attribute beside the
call cannot know whether the call *did* anything — `setVisibility()` returns
early for a caller its mode does not permit. Moving the sync inside, after that
gate, makes the attribute follow the visibility that actually happened.

**Check:** a state attribute belongs in the function that owns the state, below
whatever guard can abort it. If two call sites must still do it by hand (here:
`taskButtons.js` and `taskRenderer.js` have no controller injected, so routing
them would mean a 4-step DI change plus a new `canHandle` permission), make the
**test** the anti-drift mechanism rather than the code structure — assert the
end state, so a route that does not exist yet is covered too.

### …and the test for it is trivially vacuous

`aria-expanded` and visibility are *consistent when both are false*. So a test
step that silently did nothing is indistinguishable from one that worked, and the
first version of this section passed against the unfixed code: a mis-sequenced
Escape left the menu open, and the later `focusout` then had nothing to hide.

Every case now asserts the menu reached the expected state **before** comparing
the attribute, and says so when it did not:

> `expected the menu to be CLOSED but it was not, so this case did not exercise
> the aria sync at all — fix the step, do not trust the pass`

Same requirement the `announceCase` helper in the same file already states for
live-region announcements. Pinned by `npm run test:a11y` § E.

### Hover mode having no `aria-expanded` is correct — do not "fix" it

Filed as a gap, then withdrawn on measurement (Oct 2026). In hover mode
`settings.showThreeDots` is off, `createThreeDotsButton()` never builds a
trigger, and nothing in the task row carries `aria-expanded`. That reads like a
hole and is not one: **there is no disclosure control to describe.** `focusin`
reveals the options and `setVisibility()` makes every visible one tabbable, so
the reveal is a consequence of focus moving, not of operating a widget.

Real Tab traversal, same fixture, both modes:

```
hover mode:       customize → priority → edit → delete     (every visible option)
three-dots mode:  three-dots-btn                           (the trigger only)
focused-but-INVISIBLE: 0                                   (both modes)
```

Putting `aria-expanded` on the `<li>` would declare the task row a disclosure
widget, which it is not, and WCAG 4.1.2 governs actual UI components. The
correct answer is no attribute.

One near-miss worth recording, because the shape recurs: enumerating
`element.tabIndex >= 0` inside the row reported four *hidden* buttons as
keyboard-reachable. They are not — `.hidden { display: none !important }` takes
an element out of the focus order whatever its tabindex says. **`tabIndex >= 0`
is not focusability.** Walk the focus order with real `Tab` presses and read
`document.activeElement`; anything less invents violations.

## 18. An idempotency latch set before the work succeeds

```javascript
if (_initialized.x) return;
_initialized.x = true;        // ← latched on ENTRY
if (!settings) return;        // ← transient failure, now permanent
```

Setting the guard before the checks that can abort turns a temporary failure into
a permanent one: the function can never be retried, so the feature is dead for the
session. And because `core-ready does not mean state-ready` is a deliberate
contract in this app, "state missing during UI init" is the normal first-run
case, not a rare race.

Measured Oct 2026 on `setupThreeDotsToggle`: the Settings checkbox flips to
`checked: true`, `settings.showThreeDots` stays `false`, no three-dots button is
ever built, and the only signal is one console line. The cookbook template taught
the shape. Fixed v2.587.

**Two corrections worth carrying, both from getting this wrong first:**

**A latch fix alone may do nothing.** Removing the latch only helps if something
*retries*. Here `initAllToggles()` ran exactly once, so unlatching changed
nothing until `openSettings()` was made to re-run it. Measured all four
combinations — each fix alone still FAILED, only both together passed. When you
find a latched-too-early guard, find the retry too, or you have fixed half a bug
and the test for the first half will pass.

**The scan over-reported 13×.** The first survey said 13 of 15 functions; the
answer was 1. Successive refinements removed false positives: `if (!element)
return` (permanent, harmless), `if (!state.settings)` *inside handler bodies*
(runs on interaction, cannot abort wiring), and guards misattributed across
`export async function` boundaries. A shape-matching scan yields **candidates,
not findings** — treat the count as an upper bound until each one is executed.
Full write-up: [SETTINGS_TOGGLE_LATCH_GAP.md](../future-work/SETTINGS_TOGGLE_LATCH_GAP.md).

**Check:** order the latch below every guard that can fire. A missing *element*
is usually permanent, so latching past it is harmless; a missing *state* is always
transient. When in doubt, latch later — a redundant re-wire is cheap, a dead
control is not.

**Testing it needs the transient state, not the happy path.** A test that boots
with state already ready cannot see this class at all. The failing sequence is
*setup runs → state not ready → setup runs again → state ready*, and the
assertion must read the **stored value**, never the checkbox: `checked` is set by
the browser on click whether or not a handler exists, which is precisely why it
hid.
