# Audit Residuals — August 2026 Future-Work Cleanup

**Status:** Open backlog
**Source:** Full audit of `docs/future-work/` on 2026-08-13 (verified against the tree at v2.412). Thirteen plans whose work had shipped were archived; the live leftovers they still carried are collected here so they don't die in `archive/`. Line numbers below are as of v2.412 — prefer the symbol names if they've drifted.

---

## 1. taskViewLayoutManager has zero test coverage 🔴 (highest value)

*From archived `TASK_VIEW_CUSTOMIZATION_PLAN.md`.*

`modules/ui/taskViewLayoutManager.js` is ~1,300 lines of pointer-capture drag logic with iOS interrupted-drag teardown (`_abortActiveDrag()` on `visibilitychange`/`pagehide`), persistence, a dock/snap-target system, and a settings reset flow — and `web/tests/` has no test file for it. The plan's Phase 5 test list is a ready-made starting point (see the archived doc).

Also never built from that plan: **Phase 4 undo coalescing** — rapid drags each push a full undo snapshot; no `LAYOUT_COALESCE_WINDOW` / `LAYOUT_RESIZE_DEBOUNCE` constants exist.

## 2. Modal registry — two stray direct lookups

*From archived `MODAL_ACCESS_CENTRALIZATION_PLAN.md` (otherwise fully shipped).*

- `modules/ui/uxRatings.js:165` — `getElementById(DOM_IDS.FEEDBACK_MODAL)` directly instead of `getModal('feedback')`.
- `modules/ui/quickActionsManager.js:663` — keeps a `getModal?.('reminders') || getElementById(...)` fallback.

## 3. Recurring panel — 4 setup methods never extracted

*From archived `RECURRING_PANEL_REFACTOR_PLAN.md` (extraction otherwise shipped as `recurringPanelSetup.js`).*

Still inline in `modules/recurring/recurringPanel.js`: `setupSpecificDatesPanel()` (~:438, the big one), `setupBiweeklyDayToggle()` (~:648), `setupDurationRadioButtons()` (~:675), `attachRecurringSummaryListeners()` (~:1709). Follow the shipped deps-as-parameters pattern in `recurringPanelSetup.js`, not the old plan's callback-injection sketch.

## 4. Caching defaults + deploy check

*From archived `PRETTY_URL_CACHE_CONTROL_FIX.md` (titular fix shipped).*

- `web/netlify.toml` `/*` catch-all still serves `public, max-age=31536000` — every **new** extensionless route is stale-by-default until someone remembers a header block. The doc argued for inverting the default (opt-in immutability). Second time this class has bitten.
- No deploy-time smoke check asserts that no HTML response carries `max-age > 0`.

## 5. Games pages + robots.txt stragglers

*Also from `PRETTY_URL_CACHE_CONTROL_FIX.md` ("Related" findings, unrelated to caching).*

- `web/games/miniCycle- taskGame.html` (note the space in the filename) and `web/games/miniCycle-taskScramble.html` each still have 1 inline `<script>`; `miniCycle-taskOrder.html` already extracted to a `.js` file.
- `web/robots.txt:7` still reads `Disallow: /miniCycleGames/` — the pre-rename path. `/games/` is crawlable; decide whether that's intended.

## 6. Architecture-review remainder (shared-helper genre)

*From archived `ARCHITECTURE_REVIEW_FINDINGS.md` (both P1 bugs and most P2 items shipped).*

- **§2.2 (2 of 4 done):** the recurring instance-shape literal is still hand-written in `modules/recurring/recurringActivation.js` (~:97–108) and `modules/recurring/recurringSettingsApplicator.js` (~:146–151) instead of using `buildRecurringInstance()` from `recurringWatcher.js`.
- **§2.4 (not done, prediction came true):** no `deriveDeleteWhenComplete()` helper; there are now **five** writers — `routine/modeManager.js:1167`, `routine/routineLoader.js:325`, `task/taskButtons.js:429` and `:514`, `recurring/recurringWatcher.js:283`. All currently correct, still fragile.
- **§2.5 doc note:** the `buildSnapshotSignature` rule ("new state surface ⇒ add to signature or undo dedup-skips it") is only in code comments — not in `docs/reference/SCHEMA_2_5.md`.
- **§3.3 doc note:** `achievements.unlocked` vs `settings.unlockedThemes` intentional separation is documented nowhere.

## 7. Dead production code: `shouldShowOnboarding()`

*From archived `ONBOARDING_COMPLETED_LOCKOUT.md`.*

`modules/ui/onboardingManager.js` `shouldShowOnboarding()` (~:1790) has **zero production callers** — only its own tests keep it alive. It is exactly the function the Aug 2026 lockout incident shows people "fix" by mistake (the real gates live in the `miniCycle.html` pre-paint reader and `appInit.js`). Delete it (and its test scaffolding), or mark it loudly as non-production.

## 8. Render-path rationale worth salvaging into code

*From archived `RENDER_PATH_UNIFICATION.md`.*

The "Why DOM order matters" section (drag-drop relies on `closest('#completedTaskList')`, boundary markers, `dataset.originalIndex`) exists only in the archived doc. Candidate: copy it into a JSDoc block on `renderTasks` in `modules/task/taskRenderer.js` next time that file is touched in an app-code release.

## 9. Task-button icon consolidation (re-homed from CODE_CONSISTENCY_AUDIT)

*Tracking home was the archived `CODE_CONSISTENCY_AUDIT.md`; the work itself is still open.*

`modules/task/taskButtons.js` still carries `TASK_ICONS` (:26) with the weaker `<template>` insertion path (:190–198), duplicating 6 icons already in the central `ICONS` registry. End-state per `docs/features/SVG_ICON_SYSTEM.md` §Tech debt: route through `icons.js` (`createIcon()` / `iconHTML()`), delete `TASK_ICONS` — after verifying the 6 task-option buttons look identical on-device (sizing/fill differences). Focused, separately-tested change; renders on every task.

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
