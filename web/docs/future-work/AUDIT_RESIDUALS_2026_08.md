# Audit Residuals — August 2026 Future-Work Cleanup

**Status:** Open backlog
**Source:** Full audit of `docs/future-work/` on 2026-08-13 (verified against the tree at v2.412). Thirteen plans whose work had shipped were archived; the live leftovers they still carried are collected here so they don't die in `archive/`. Line numbers below are as of v2.412 — prefer the symbol names if they've drifted.

---

## 1. taskViewLayoutManager — ✅ CLOSED (coverage, coalescing, and an audit pass)

*From archived `TASK_VIEW_CUSTOMIZATION_PLAN.md`.*

**Test coverage** — resolved in `9aec3ca5`; now 59 tests.

**Phase 4 undo coalescing** — shipped Aug 2026. Position writes queue through
`_queuePositionWrite` and land in a single `AppState.update` via
`_flushPositionWrites`, so one gesture — and one burst of gestures inside
`UI_TIMEOUTS.LAYOUT_COALESCE_WINDOW` — is one undo entry. Two distinct problems were
folded into it: dragging an anchor wrote once per follower (undoing one drag took as
many presses as it had followers), and repeated nudges each pushed their own snapshot.
The delete path had batched "so a cascade is one undo entry, not one per key" since it
was written; the save path never did. Flushed on teardown and page-hide so nothing is
lost; discarded on reset and on undo-restore so a stale write cannot land after the
state it described.

**Audit findings, fixed in the same pass:**

- 🔴 *Saved positions were applied unclamped.* Positions are global and stored in
  pixels, so a layout arranged on a wide display could put an element — and its drag
  handle — fully off-screen on a smaller one, recoverable only via settings Reset.
  Measured: a saved `{left: 9000, top: 4000}` put `#task-card-group` at (9350, 4446) in
  a 1400x900 viewport. Now clamped into the play area on apply; the same seed lands at
  (980, 316).
- 🟠 *Corrupt entries were applied on the boot path only.* `refreshTaskViewLayout()`
  checked `Number.isFinite` before applying; `_loadAndApplyPositions()` passed anything
  object-shaped straight through, so `{left: null, top: 'oops'}` set `position:absolute`
  with `right/bottom:auto` and no coordinates, pulling the element out of flex flow with
  nothing to anchor it. Validation moved into `_applySavedPosition` so both callers get
  it. (The two-callers-disagree shape is CLAUDE.md #15.)
- 🟠 *`destroy()` did not end an in-flight drag.* `_beginDrag` sets
  `body.style.userSelect = 'none'` and only `_endDrag` clears it, so tearing down
  mid-drag — which `destroyAllModules()` does on boot retry — left the whole page
  unselectable until reload.
- 🟡 *Reset was not undoable as a first interaction.* `resetTaskViewLayout()` was the
  only one of the three write paths that never called
  `enableUndoSystemOnFirstInteraction()`, so the most destructive action in the feature
  could be silently dropped from the undo stack.
- 🟡 *Magic number.* The 50ms click-swallow window moved to
  `UI_TIMEOUTS.LAYOUT_CLICK_SWALLOW`.

The module's header banner also claimed two draggables and in-memory-only positions
long after five were wired and persisting, and pointed at the pre-cleanup
`docs/future-work/` path for a plan now in `docs/archive/` — both corrected.

## 2. Modal registry — two stray direct lookups

*From archived `MODAL_ACCESS_CENTRALIZATION_PLAN.md` (otherwise fully shipped).*

- `modules/ui/uxRatings.js:165` — `getElementById(DOM_IDS.FEEDBACK_MODAL)` directly instead of `getModal('feedback')`.
- `modules/ui/quickActionsManager.js:663` — keeps a `getModal?.('reminders') || getElementById(...)` fallback.

## 3. Recurring panel — 4 setup methods — ✅ CLOSED Aug 2026

*From archived `RECURRING_PANEL_REFACTOR_PLAN.md`.*

`setupSpecificDatesPanel()` (144 lines, the big one), `setupBiweeklyDayToggle()`,
`setupDurationRadioButtons()` and `attachRecurringSummaryListeners()` now live in
`recurringPanelSetup.js` alongside the seven helpers extracted earlier.
`recurringPanel.js` 1949 → 1748 lines; the setup module 360 → 626.

Followed the **shipped** deps-as-parameters pattern (`fn(deps, callbacks)`), not
the archived plan's callback-injection sketch, exactly as the entry instructed.
The panel keeps thin wrappers that pass its resolved DI and bind its instance
methods — the same shape `setupMonthlyMutualExclusion` and
`setupAdditionalListeners` already used.

Extraction was done programmatically rather than by retyping: bodies were lifted
verbatim and transformed (`this.deps.` → `deps.`, instance calls → `callbacks.`),
then asserted to contain zero residual `this.` references. Three imports
(`handleHorizontalArrowNav`, `formatLocalDate`, `LIMITS`) became dead in the panel
and were removed; `UI_TIMEOUTS` had to be added to the setup module, which the
lint error caught.

Verified in the browser, not just by the suites — those predate the extraction and
would pass either way:

- **duration radios** — limited container hidden by default, revealed on
  unchecking "indefinitely";
- **specific dates** — ticking swaps the frequency UI out, seeds one date input
  defaulted to tomorrow *in local time* (`2026-08-19`, which also exercises the
  `formatLocalDate(getTomorrow())` callback), and the add button appends a second
  row carrying a trash button;
- **biweekly** — a day box toggles and updates `aria-checked`;
- **summary listeners** — the live form summary re-renders on change
  ("Repeats daily for 1 time" → "Repeats weekly for 1 time on Tue").

One probe mistake worth recording: the first summary check targeted
`[id*="summary"]` and caught the SAVED-task preview rather than the live form
summary (`#recurring-summary`), reporting no change. The listener was fine; the
selector was wrong.

## 4. Caching defaults + deploy check — ✅ CLOSED Aug 2026

*From archived `PRETTY_URL_CACHE_CONTROL_FIX.md`.*

The entry framed this as hardening. It was live: **11 HTML routes were being
served `public, max-age=31536000`** in production, confirmed by probing the real
deployment.

The mechanism: Netlify serves every deployed `.html` at an EXTENSIONLESS
canonical URL, and that form does not match the `*.html` header rule — so unless
another rule names it, it inherits the `/*` catch-all's one year. The config
already hand-covered six HTML scopes (`*.html`, `/`, `/pages/*`, `/minicycle`,
`/legal/*`, `/blog`); the seventh route was silent. Among the casualties:

- `/blog/posts/*` — a published post could not be corrected;
- `/lite/minicycle-lite` — the old-device fallback;
- all three `/games/*` — where this was first observed, when a deployed fix could
  not reach a browser that had already cached the route.

**Fixed by naming the routes, not by inverting the catch-all** (user's call —
narrow and reviewable beats changing caching for every asset at once). Six new
`[[headers]]` blocks mirror the existing `/pages/*` pattern. Asset caching is
unchanged: the new directory rules sit BEFORE `*.js` / `*.css` in the file, and
the live probe confirms `/games/miniCycle-taskOrder.js` still gets `max-age=86400`
and `/build/*` stays immutable.

**The check** is `npm run validate:cache` (`scripts/validate-cache-headers.py`),
wired into CI. It enumerates every deployed `.html`, derives the extensionless URL
Netlify will serve it at, models the header rules, and fails if any resolves to a
long cache. The model was calibrated against five known live values before being
trusted.

`--live <base-url>` probes a real deployment instead — the deploy-time smoke check
the entry asked for. It reports UNREACHABLE separately from LONG-CACHED: an early
version reported every unreachable URL as long-cached, and a probe that turns "I
could not ask" into "it is broken" is worse than no probe.

One exemption, documented in the script: `modules/testing/testing-modal-tab-html.html`
is not a page — it is a copy-paste snippet whose own content reads "Add this new
tab to your existing testing modal HTML", referenced by nothing. **It probably
should not be deployed at all**; a cache rule is not the fix for that.

## 5. Games pages + robots.txt stragglers

*Also from `PRETTY_URL_CACHE_CONTROL_FIX.md` ("Related" findings, unrelated to caching).*

- `web/games/miniCycle- taskGame.html` (note the space in the filename) and `web/games/miniCycle-taskScramble.html` each still have 1 inline `<script>`; `miniCycle-taskOrder.html` already extracted to a `.js` file.
- `web/robots.txt:7` still reads `Disallow: /miniCycleGames/` — the pre-rename path. `/games/` is crawlable; decide whether that's intended.

## 6. Architecture-review remainder — ✅ CLOSED Aug 2026

*From archived `ARCHITECTURE_REVIEW_FINDINGS.md`.*

Both bullets are done, but neither matched its description — worth reading before
trusting a similar entry elsewhere in this file.

**§2.2 — the premise was wrong, and hid a live bug.** The entry said
`recurringActivation.js` and `recurringSettingsApplicator.js` hand-write copies of
`buildRecurringInstance()`. They do not: that builds a TASK INSTANCE (`completed`,
no scheduling fields) to push into `cycle.tasks`, while both of those build a
`recurringTemplates` entry (`occurrenceCount`, `nextScheduledOccurrence`,
`schemaVersion`, no `completed`). Routing either through the other would have been
a bug.

The real duplication was **five** template writers, already drifted into five
field sets:

|                            | activation | applicator | import | migration | taskUtils |
|---|---|---|---|---|---|
| deleteWhenComplete         | ✓ | ✓ | · | · | ✓ |
| deleteWhenCompleteSettings | ✓ | ✓ | · | · | ✓ |
| occurrenceCount            | ✓ | ✓ | · | · | · |
| lastTriggeredTimestamp     | ✓ | ✓ | · | · | ✓ |
| nextScheduledOccurrence    | ✓ | ✓ | ✓ | ✓ | **·** |

That last gap shipped as a user-visible bug: `recurringWatcher` gates on
`template.nextScheduledOccurrence == null`, and `==` matches **undefined**, so a
template without the field reads as exhausted and never fires. `taskUtils` is
reached by the Cleared Tasks **"Recreate"** flow, so restored recurring tasks came
back permanently inert. Fixed in v2.431 (confirmed by a failing test against the
real `createOrUpdateTaskData` first).

All five now build through `modules/recurring/recurringTemplate.js`
(`buildRecurringTemplate`), which names every field once and **warns** when
`nextScheduledOccurrence` is missing — a null is as dead as an absent field to the
watcher, so defaulting it silently would have been the same bug wearing a field
name. New module, so it is registered in `BOOT_CRITICAL` (the `test:sw` precache
guard caught the omission, as documented in CLAUDE.md).

**§2.4 — already done before this pass.** The entry predicted five
`deriveDeleteWhenComplete` writers needing a helper. Commit `9503e94c` had already
centralised it as `syncTaskDeleteWhenComplete()` in `utils/cycleMode.js`: all
three genuine derivation sites (`modeManager:380`, `routineLoader:319`,
`taskButtons:513`) call it. The other two the entry listed are deliberately NOT
derivations — the user-toggle write in `taskButtons` and the recurring
always-true safety override in `recurringWatcher` — as that commit's own message
records.

**§2.5 / §3.3 doc notes** — both written into `docs/reference/SCHEMA_2_5.md`
(the `buildSnapshotSignature` rule, and why `achievements.unlocked` and
`settings.unlockedThemes` stay separate).

## 7. Dead production code: `shouldShowOnboarding()`

*From archived `ONBOARDING_COMPLETED_LOCKOUT.md`.*

`modules/ui/onboardingManager.js` `shouldShowOnboarding()` (~:1790) has **zero production callers** — only its own tests keep it alive. It is exactly the function the Aug 2026 lockout incident shows people "fix" by mistake (the real gates live in the `miniCycle.html` pre-paint reader and `appInit.js`). Delete it (and its test scaffolding), or mark it loudly as non-production.

## 8. Render-path rationale worth salvaging into code

*From archived `RENDER_PATH_UNIFICATION.md`.*

The "Why DOM order matters" section (drag-drop relies on `closest('#completedTaskList')`, boundary markers, `dataset.originalIndex`) exists only in the archived doc. Candidate: copy it into a JSDoc block on `renderTasks` in `modules/task/taskRenderer.js` next time that file is touched in an app-code release.

## 9. Task-button icon consolidation — ✅ CLOSED Aug 2026

*Tracking home was the archived `CODE_CONSISTENCY_AUDIT.md`.*

`taskButtons.js` carried a local `TASK_ICONS` map duplicating six icons already in
`utils/icons.js`, inserted through a `<template>.innerHTML` parse. Both are gone:
the six buttons now call `createIconElement()`, which parses via `DOMParser`
(correct SVG namespacing) and warns on an unknown name instead of silently
rendering nothing.

The entry asked for on-device verification of sizing/fill before removal. Done
programmatically, which is stronger than eyeballing:

- **Path data byte-identical** for all six (`flag`, `edit`, `trash`, `repeat`,
  `calendar-alt`, `bell`) — same `viewBox`, same single `d` attribute. The swap
  cannot change what is drawn.
- **Sizing was already CSS-governed.** `.task-btn .icon svg` in `icons.css` pins
  `14px`, so the `width="14" height="14"` the local copies carried was redundant.
  Measured before and after on the same seeded routine: 20 buttons, 12 icon SVGs,
  rendered `14x14` in both — identical despite the inline attributes now being
  absent, which is the proof that removing them was safe.
- **Right icon on the right button**, checked by comparing each rendered path
  against the central registry: priority→flag, edit→edit, recurring→repeat,
  due-date→calendar-alt, reminders→bell, delete→trash.

The emoji fallback branch is retained — it now covers "icon name not in the
central registry" rather than "not in the local map".

## 10. Stale doc paths inside code comments

Two shipped files cite `docs/future-work/` paths that moved to `docs/archive/` in this cleanup: `modules/task/taskRenderer.js` (~:214, cites RENDER_PATH_UNIFICATION.md) and `modules/recurring/recurringWatcher.js` (~:78–86, cites "ARCHITECTURE REVIEW FINDINGS.md"). Harmless (validate:comments checks identifiers, not paths) — fix the paths next time those files ship in an app-code release; not worth a version bump alone.

## 11. Four undeclared dep reads found by the new runtime DI audit — ✅ RESOLVED Aug 2026

*Not from the future-work cleanup — output of `WARN_ON_UNDECLARED_DEP_ACCESS`, added Aug 2026 (see `ENFORCE_REQUIRES_ROLLOUT_PLAN.md` §Step 2 "Closed August 2026").*

These are live under `ENFORCE_REQUIRES`: each name has a real `depMappings` route, the
module reads it, and the manifest never declared it — so it arrives as `undefined` and
every call through it silently no-ops. All four were invisible to `validate:di` (green)
and to all 5 journeys (passing); the audit named them on its first clean run.

| Module | Undeclared dep | Shape |
|---|---|---|
| `routine/routineSwitcher.js` | `updateProgressBar` | in the module's **DI schema** as `optional(() => {})`, absent from the manifest → the no-op default is permanent |
| `routine/routineSwitcher.js` | `updateUndoRedoButtons` | same |
| `ui/settingsManager.js` | `showChoiceModal` | **facade forward-through** — passed to `cycleImportManager` and `shareManager` |
| `ui/settingsManager.js` | `vocabThemeManager` | facade forward-through — passed to `cycleImportManager` |

**All four fixed, one at a time, each verified before moving on.** The two classes turned
out to be opposites:

- **routineSwitcher** — the deps were **dead**, not missing. `updateProgressBar` and
  `updateUndoRedoButtons` appeared only in the DI schema and were never called anywhere
  in the 2,574-line file; the post-switch refresh already runs in
  `routineLoader.updateDependentComponents()`, reached via `loadMiniCycle()`. Fixed by
  DELETING the schema entries, not by declaring them — plus `updateStatsPanel`,
  `checkCompleteAllButton` and `initialSetup`, dead in the identical way, and the two
  now-orphaned manifest declarations.
- **settingsManager** — both were live features that the v2.418 flip silently switched
  off, one day before the audit found them. `showChoiceModal` (Feb 2026) and
  `vocabThemeManager` both predate `ENFORCE_REQUIRES`, so the old broad assign delivered
  them; strict mode did not, and every consumer guards and falls back silently.
  Restored by declaring them.

What was actually broken between v2.418 and the fix:

| Flow | Broken behaviour | Restored |
|---|---|---|
| Import a `.mcyc` | Template-vs-With-Progress modal never appeared; always took `template` | modal appears |
| Share a routine | Routine-only-vs-With-history modal never appeared; always excluded history | modal appears |
| Import a locked theme | silently forced `classic`, no explanation | applies the user's own `defaultTheme` + names the locked theme |

Verified end-to-end in the browser, with a negative control for the import modal:
declaration removed → no modal, import silently completed; declaration restored → modal
appears. Two further defects surfaced while auditing the newly-live code, both fixed:

- `_deps.vocabThemeManager?.getThemeDefinition(x)` — the depMappings route is a **Proxy**,
  which is always truthy, so `?.` guards the dep being absent but NOT the method being
  absent; a missing underlying manager would throw mid-import, after the user had already
  chosen an import mode. Now goes through `getThemeDefinitionSafe()`, which checks the
  method and calls it as a method (preserving `this` for a directly-injected manager).
- `notify.themeLockedOnImport` said "Using Classic for now" unconditionally while the code
  resolved to `settings.defaultTheme`. Observed live: it claimed Classic while applying
  Habit Tracker. Now interpolates `{fallback}` with the theme actually applied.

Original triage note follows.

Deliberately NOT fixed in the same change as the audit. Declaring a dep that has been
absent makes previously-dead code paths live in one step, which is its own behaviour
change needing its own audit (precedent: the "wiring a previously-unused dep makes its
latent bugs live" rule). Each should land as a separate change that declares the dep
**and** checks what the newly-reachable call actually does — e.g. whether
`routineSwitcher` calling a real `updateProgressBar` on every switch double-renders, and
whether `cycleImportManager`'s `showChoiceModal` path has ever executed.

Note the class the two `settingsManager` entries belong to: facade forward-through is
exactly what cost v2.418 four failing journeys. `validate:di` gates that class at 0 and
still reports 0 here, which is the blind spot the runtime audit exists to cover.
