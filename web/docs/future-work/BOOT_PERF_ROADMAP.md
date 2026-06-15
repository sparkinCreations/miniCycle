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
| A1 | **preferencesManager** (+ `preferencesBgImage`, `preferencesPresets` subs) | 1,957 + subs | personalization modal opens | **Biggest single win.** Inline boot script already applies saved `--pref-app-bg` + font-size ([miniCycle.html:319](../../miniCycle.html)), so app-bg won't flash. CAVEAT: audit the full `--pref-*` set the module applies at boot for returning users (background image, element tints); replicate any other first-paint visuals in the inline path or accept a brief flash. |
| A2 | **settingsManager** (+ facade subs) | 597 + subs | settings modal opens | Facade wires several sub-modules in `init()` — deferral moves real work off boot. Provides `exportMiniCycleData`/`downloadBackupFile` (optional in consumers). |

These are facades that dynamically import sub-modules, so deferring the facade defers the
whole sub-tree — high payoff per unit effort.

### Tier B — Init-split refactors (recurring-style; higher effort, real payoff)

Apply the **recurring recipe** (boot stub for first-paint bits + lazy hybrid + `ensureLoaded`):

| # | Module | Lines | Boot-essential bit to keep | Defer |
|---|---|---|---|---|
| B1 | **guidedTourManager** | 1,962 | for NEW users only: schedule the welcome tour | **Returning users (the common case) need NOTHING at boot** — gate the whole module on "hasn't seen tour". Likely the easiest big win in Tier B. |
| B2 | **reminders** | 1,151 | nothing at first paint? (verify no reminder fires on load) | defer to post-`INTERACTIVE` idle, or first reminder-settings open |
| B3 | **dragDropManager** | 1,094 | nothing | load on **first drag** (first `touchstart`/`pointerdown` on a task) |
| B4 | **focusMode** | 1,069 | show `#focus-mode-btn` + a lightweight "restore persisted focus state" check | defer the panel/logic to first activation |
| B5 | **taskOptionsCustomizer** | 973 | nothing | defer to first task-options open |
| B6 | **helpWindowManager** | 772 | minimal boot welcome (if any) | defer the heavy help-window UI + MutationObserver to first help-open |
| B7 | **taskSearch** | 537 | — | **Blocked on a refactor first:** `featureBoot.js` (~line 291) special-cases it to inject `updateSearchVisibility` into the render path. Untangle that before deferring. |

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

## Suggested execution order (ROI-first)

1. **backupReminder → idle** (tiny, pure win).
2. **Tier A: preferencesManager + settingsManager** (biggest payoff/effort, proven facade pattern). Re-measure on device.
3. **Lever 2: precache trim** — cheap, and the deferrals already make more modules non-critical.
4. **Tier B init-splits**, easiest-first: **guidedTourManager** (returning-user gate), then dragDropManager / reminders / focusMode / taskOptionsCustomizer / helpWindowManager.
5. **Lever 1: minification** — the high-ceiling structural play; own plan, careful rollout.
6. **Tier C: statsPanel unblock** — only if measurements still justify it after the above.

Per deferral, the proven gate: device-test the open/trigger paths, and confirm the module
**drops out of the boot Network trace** + its phase time falls in the Boot Timing modal.

## Rough payoff estimate (slow device, additive, before minification)
- Tier A (prefs + settings): ~150–250ms off UI_MANAGERS
- Tier B (tour/drag/reminders/focus/options/help): ~200–350ms across UI_MANAGERS + TASK_MANAGEMENT
- Lever 2 (precache trim): mainly helps cold/update loads (the ~1s pre-boot window)
- Lever 1 (minification): the big multiplier — potentially 30–50% of remaining parse, all phases
- Tier C (statsPanel): ~100–150ms off TASK_MANAGEMENT if unblocked
