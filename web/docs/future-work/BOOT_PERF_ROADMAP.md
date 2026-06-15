# Boot Performance Roadmap — Next Targets & Structural Levers

**Status:** PLAN (June 14 2026). Builds on the shipped wins: parallel phase imports (v2.238),
pre-boot version gate (v2.238), recurring panel deferral (v2.239), and the earlier
`MODULE_DEFERRAL_AUDIT.md` (testing/games/plugin deferrals).

## Baseline — v2.239 on old Android (clean warm run)

```
Interactive 3642ms | pre-boot ~1059ms | bootSequence 2583ms
  Core (AppState)        506ms   (cold; ~234 warm — migration/data)
  Features (all modules) 1782ms  (69% of boot)
    UI_MANAGERS       510ms  (#1, 17 modules)
    TASK_MANAGEMENT   339ms  (#2, 6 modules)
    RECURRING         251ms  (#3 — was #2; deferral shipped ✓)
    THEME_VISUAL      224ms
    CYCLE             133ms
    CORE_UTILS        123ms
    FEATURES           72ms
    TESTING            30ms
  UI finalize           286ms
```
High run-to-run variance on this device — treat numbers as directional, re-measure 2–3 warm runs.

## Two classes of work

1. **Module deferral** — cut what's *parsed* at boot. Proven recipe (recurring, games, testing):
   boot stub + `ensureModuleLoaded()` / lazy hybrid object + open-trigger; consumers already
   optional-chain through DI so a not-yet-loaded provider no-ops until first use.
2. **Structural levers** — cut parse *size* and the cold-install storm. Help every phase at once.

---

## Deferral targets — prioritized by ROI

Weights = source line counts. Keep-eager set documented at the end.

### Tier A — Facade defers (medium effort, big payoff, lowest risk — facade pattern already exists)

| # | Module | Lines | Trigger | Notes / caveat |
|---|---|---|---|---|
| A1 | **preferencesManager** (+ `preferencesBgImage`, `preferencesPresets` subs) | 1,957 + subs | personalization modal opens | **⚠️ NOT clean — see corrections.** `themeManager.js:188` calls `applyCustomColors()` at boot, so this is an **init-split** (extract a lightweight boot color-apply), not a pure facade defer. Biggest module, but more work than first thought. |
| A2 | **settingsManager** (+ facade subs) | 597 + subs | settings modal opens | Facade wires several sub-modules in `init()` — deferral moves real work off boot. Provides `exportMiniCycleData`/`downloadBackupFile` (optional in consumers, not hard-required ✓). **Verify** its boot job is minimal first. |

These are facades that dynamically import sub-modules, so deferring the facade defers the
whole sub-tree — high payoff per unit effort.

### ⚠️ Verification pass corrections (June 15 2026 — checked against actual call sites)

Re-checking the candidates before building (the recurring-Proxy lesson) re-tiered several:

- **guidedTourManager — NOT a clean gate (2nd-pass correction).** `init()` early-returns on
  `settings.onboardingCompleted`, BUT the module also provides 14 `show*TourNotification` tips
  that feature modules (stats/settings/history/achievements/…) call on first use — and these
  **serve RETURNING users**, gated per-feature on their own `stateKey`
  ([guidedTourManager.js:1052-1057](../../modules/ui/guidedTourManager.js): *"Returning users see
  it on first stats open"*). So an `onboardingCompleted` gate is **too coarse** — it would
  suppress feature-discovery tips for returning users (a subtle regression that only surfaces when
  a returning user first opens a feature). Real defer needs an **"all tours seen" gate** (cheap
  boot check of every tour `stateKey`) OR lazy-routing of the 14 entry points + the boot
  `uiBoot.js:279` `showMenuTourNotification` call. Medium effort — NOT the easy win.
  None of the 14 provides are hard-required (verified), so no manifest blocker.

- **settingsManager — cleanest remaining module win.** `init()` only runs `initAllToggles()`
  (wires settings-modal toggles); the modal opens on demand. Defer to settings-open. Provides
  (`syncCurrentSettingsToStorage`/`exportMiniCycleData`/`downloadBackupFile`) are optional in
  consumers, not hard-required (verified). VERIFY each toggle's setup has no boot side-effect
  (settings like dark-mode/theme are applied elsewhere — inline script + themeManager — so likely
  clean).
- **preferencesManager — NOT a clean facade defer (re-tiered to init-split).** `themeManager.js:188`
  calls `applyCustomColors?.()` at boot (the vocab-theme / custom-color apply). The inline script
  only handles `--pref-app-bg`; the rest of the custom-color set is applied via this module. Defer
  requires extracting a **lightweight boot color-apply** (like the recurring button-visibility
  extraction) so returning users with custom colors / vocab themes don't flash defaults.
- **dragDropManager — NOT deferrable to "first drag".** Its `enableDragAndDropOnTask` /
  `updateArrowsInDOM` run during task render ([taskRenderer.js:236](../../modules/task/taskRenderer.js),
  optional-chained). The move-arrows + drag are first-paint UI; you can't "drag to load drag".
  Best it can do is a **post-`INTERACTIVE` idle load** (off the critical path, ready shortly after) —
  or keep eager. Move out of clean-defer.
- **reminders — has a scheduler boot job + a hard consumer.** Its init starts the reminder
  scheduler, and `taskOptionsCustomizer` HARD-requires `startReminders`/`stopReminders`. Init-split
  (keep scheduler eager, defer the settings UI), not a clean defer.
- **taskOptionsCustomizer** provides nothing (deferrable on its own), but HARD-requires
  `updateMoveArrowsVisibility` (dragDrop) + `startReminders`/`stopReminders` (reminders) — when it
  loads, those must already be loaded (prerequisite cascade via `ensureModuleLoaded`).

### Tier B — corrected

| # | Module | Lines | Mechanism | Notes |
|---|---|---|---|---|
| **B1** | **guidedTourManager** | 1,962 | **conditional pre-load gate** on `settings.onboardingCompleted` | Cleanest big win — returning users skip the parse entirely. Do this FIRST. |
| B2 | **focusMode** | 1,069 | init-split (keep `#focus-mode-btn` + restore-state; defer panel) | recurring-style |
| B3 | **helpWindowManager** | 772 | init-split (minimal boot welcome; defer help UI + MutationObserver) | recurring-style |
| B4 | **taskOptionsCustomizer** | 973 | defer to first open | but cascades dragDrop+reminders prereqs |
| B5 | **reminders** | 1,151 | init-split (keep scheduler; defer settings UI) | not a clean defer |
| B6 | **dragDropManager** | 1,094 | **post-INTERACTIVE idle load** (or keep eager) | arrows/drag are first-paint; NOT "first drag" |
| B7 | **taskSearch** | 537 | blocked: `featureBoot.js` (~291) special-cases render-path injection — untangle first | |

### Tier C — Unblock-then-defer (break a hard `requires` first)

| # | Module | Lines | Blocker | Work |
|---|---|---|---|---|
| C1 | **statsPanel** | 1,973 | `uiOrchestrator` hard-`requires: ['updateStatsPanel']` (+ `after: statsPanel`) | move `updateStatsPanel` to `optionalDeps`, verify uiOrchestrator no-ops when absent, then defer to first stats-panel open. Big win but real coupling work. |

### Quick win (no deferral mechanism)
- **backupReminder** — has a boot job (`checkBackupReminderOnBoot`). Move it to a
  post-`INTERACTIVE` idle callback instead of inline boot.

### Keep EAGER (do not defer)
- **undoRedoManager** (2,134) — hot path: `captureStateSnapshot` on every edit; `titleManager`
  hard-requires `updateUndoRedoButtons`/`captureStateSnapshot`/`onCycleRenamed`.
- **taskDOM** (1,825), **taskCore** (692), task render chain — needed at first paint.
- **AppState / coreBoot** — foundational (see Core lever below).

---

## Structural levers

### Lever 1 — Minification (terser release step) — highest ceiling, own sub-project
- **Why:** ~3.4 MB of unminified ES modules are parsed across ALL phases. Minifying cuts
  parse cost everywhere at once (potentially 30–50%), not one phase. Bonus: obfuscation aligns
  with the proprietary-license intent.
- **Constraints (hard):** must preserve the per-file ES-module structure + the `?v=` versioned
  dynamic-import graph (SW precache + `ensureModuleLoaded` rely on stable per-file paths). So:
  **minify per-file, NOT bundle.** Keep source pristine for dev — minify to a release output
  (or as a Netlify build step), never in place.
- **Where:** a terser pass invoked from `update-version.sh` (or a sibling of
  `build-chrome-full.cjs`). No minifier exists today (`npm` has no terser/esbuild).
- **Risk:** module-graph breakage, source maps for prod debugging, the `?v=` rewrite. Needs a
  dedicated plan + staged rollout + full test pass. Do NOT bolt on casually.

### Lever 2 — SW precache trim — cold/first/update-load lever
- **Why:** `BOOT_CRITICAL` precaches **106 `./modules/*.js`** + ~37 CSS + fonts on install,
  competing with the live boot fetches on first/update load (the ~1059 ms pre-boot window +
  the cold storm). Heavy theme/stock images are **already NOT precached** (verified) — they
  lazy-load — so this lever is about the JS/CSS module set, which deferral is already shrinking.
- **Approach:** trim `BOOT_CRITICAL` to the TRUE first-paint shell (boot chain + core + task
  render + main CSS + fonts). Deferred modules (recurring panel, and the Tier A/B targets once
  deferred) don't need eager precache — let them lazy-cache on first use
  (stale-while-revalidate already handles this).
- **Risk:** offline-first — anything dropped from precache must lazy-cache before the user needs
  it offline. Same first-session-offline edge we reasoned through for the recurring deferral.

### Lever 3 (smaller) — Core/AppState cold 506ms
- The cold `Core` phase (506 cold vs ~234 warm) is migration/data work in `coreBoot`. Not
  deferrable (foundational), but worth profiling: is a migration/validation pass running on
  every cold boot that could be gated on a schema-version check or memoized?

---

## Suggested execution order (ROI-first — revised after TWO verification passes)

**Reality after deep verification:** the easy module deferrals are already done (recurring, games,
testing). Every *remaining* big module has boot coupling — there is **no trivial next deferral**.
They're all medium-effort facade-defers or init-splits, each worth ~100–250ms with real
per-feature regression risk. That shifts the ROI calculus toward the **structural levers**, which
help every phase at once with no per-feature regression surface.

1. **backupReminder → idle** (tiny, pure, zero-risk win). Warm-up.
2. **settingsManager facade defer** (A2) — cleanest remaining module win; verify toggle side-effects.
3. **Lever 2: precache trim** — cheap, complements the deferrals already shipped. Re-measure.
4. **Lever 1: minification** (terser release step) — **promote this.** Biggest ceiling (~30–50% of
   ALL parse), no per-feature regression risk, helps every phase. Own plan + staged rollout. This
   is likely better ROI than chasing more individual module deferrals.
5. **Init-splits, if still justified by measurement:** guidedTourManager (all-tours-seen gate),
   preferencesManager (boot color-apply extraction), focusMode, helpWindowManager, reminders.
6. **dragDropManager → post-INTERACTIVE idle**; **statsPanel unblock**; **taskSearch untangle** —
   tail-end, measurement-gated.

Per deferral, the proven gate: device-test the open/trigger paths, and confirm the module
**drops out of the boot Network trace** + its phase time falls in the Boot Timing modal.

## Rough payoff estimate (slow device, additive, before minification)
- Tier A (prefs + settings): ~150–250ms off UI_MANAGERS
- Tier B (tour/drag/reminders/focus/options/help): ~200–350ms across UI_MANAGERS + TASK_MANAGEMENT
- Lever 2 (precache trim): mainly helps cold/update loads (the ~1s pre-boot window)
- Lever 1 (minification): the big multiplier — potentially 30–50% of remaining parse, all phases
- Tier C (statsPanel): ~100–150ms off TASK_MANAGEMENT if unblocked
