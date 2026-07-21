# miniCycle Magic Number Audit
**Repo state:** main @ v2.310 · Scope: `web/games/`, `web/modules/` (132 files) · `constants.js` excluded (it's the destination, not an offender)

**Verdict:** Main app is in good shape — `constants.js` already centralizes timeouts, delays, boot timing, and milestones. Findings are (1) the games, which predate the refactor as you said in the thread, (2) ~12 raw `setTimeout` literals that drifted past existing constants, (3) breakpoints `768`/`1024` inlined in 6 files with **no BREAKPOINTS section in constants.js**, and (4) a handful of unexplained layout numbers.

`labels/themes.js` was a false positive — hex colors in theme data definitions are data, not magic numbers. Leave them.

---

## Priority 1 — games/miniCycle-taskOrder.js (the public commitment)

Add a constants block at the top of the file (self-contained page, so local constants are fine — no need to import core/constants.js):

```js
// ── Game constants ──────────────────────────────────────────
const BTN_CLEARANCE_X   = 140;  // spawn margin ≈ widest task button, keeps buttons fully inside the window
const BTN_CLEARANCE_Y   = 50;   // spawn margin ≈ button height
const TASK_LABEL_MAX    = 22;   // chars before truncation

const PARTICLE_COUNT    = 12;
const PARTICLE_MIN_DIST = 50;   // px — burst radius = MIN + random * SPREAD
const PARTICLE_SPREAD   = 50;
const PARTICLE_LIFE_MS  = 700;

const SPEED_JITTER_BASE  = 0.8; // speed = multiplier * (BASE + random * RANGE)
const SPEED_JITTER_RANGE = 0.4;
const BOUNCE_DAMP_BASE   = 0.9; // wall bounce: dx *= -(BASE + random * RANGE)
const BOUNCE_DAMP_RANGE  = 0.2;

const NEXT_ROUND_DELAY_MS = 1500;
const NEW_BEST_DELAY_MS   = 800;
const TIMER_TICK_MS       = 250;
```

| Line | Current | Replace with |
|---|---|---|
| 62 | `truncateText(text.trim(), 22)` | `TASK_LABEL_MAX` |
| 189 | `}, 250)` | `TIMER_TICK_MS` |
| 217 | `var particleCount = 12` | `PARTICLE_COUNT` |
| 226 | `50 + Math.random() * 50` | `PARTICLE_MIN_DIST + Math.random() * PARTICLE_SPREAD` |
| 231 | `, 700)` | `PARTICLE_LIFE_MS` |
| 293 | `0.8 + Math.random() * 0.4` | `SPEED_JITTER_BASE + Math.random() * SPEED_JITTER_RANGE` |
| 336 | `setTimeout(startRound, 1500)` | `NEXT_ROUND_DELAY_MS` |
| 346 | `setTimeout(..., 800)` | `NEW_BEST_DELAY_MS` |
| 370 | `rect.width - 140` ← **the thread one** | `rect.width - BTN_CLEARANCE_X` |
| 371 | `rect.height - 50` | `rect.height - BTN_CLEARANCE_Y` |
| 412–415 | `0.9 + Math.random() * 0.2` ×4 | `BOUNCE_DAMP_BASE + Math.random() * BOUNCE_DAMP_RANGE` |

Fine as-is: `DIFFICULTY_SETTINGS` (lines 67–69 — already named config), time math (`/1000`, `/60`, `%60`), Fisher-Yates in `shuffleArray`. Other game files (`taskGame.html`, `taskScramble.html`, `taskOrder-init.js`) are clean — only shuffle math.

---

## Priority 2 — add BREAKPOINTS to constants.js (missing category)

`768` and `1024` are inlined in 6 files; a breakpoint change today means touching all of them.

```js
// RESPONSIVE BREAKPOINTS (match styles/base media queries)
export const BREAKPOINTS = Object.freeze({
    MOBILE_MAX: 768,    // ≤ 768px → mobile layout
    DESKTOP_MIN: 1024   // ≥ 1024px → desktop layout
});
```

| File | Line | Current |
|---|---|---|
| ui/helpWindowManager.js | 92 | `window.innerWidth >= 1024` |
| ui/onboardingManager.js | 790 | `window.innerWidth <= 768 ? 8 : 16` (also name the 8/16 gap px) |
| ui/taskOptionsCustomizer.js | 406 | `window.innerWidth <= 768` |
| ui/taskViewLayoutManager.js | 334 | `window.innerWidth < 1024` |
| utils/notifications.js | 806 | `viewportWidth <= 768` |

Note the mixed comparators (`<= 768` vs `< 1024` vs `>= 1024`) — unify the convention while you're in there.

---

## Priority 3 — raw setTimeout literals (drift past existing constants)

Most already have a matching entry in `TIMEOUTS`/`DELAYS` — swap in the constant, or add one where noted.

| File | Line | Literal | Suggested |
|---|---|---|---|
| ui/undoRedoManager.js | 1520 | `setTimeout(resolve, 300)` | `DELAYS.NOTIFICATION_FADE` or `ANIMATION_EMPTY` (300 exists twice — pick by intent) |
| ui/quickActionsManager.js | 1237, 1307 | `setTimeout(onEnd, 300)` | same 300ms animation constant |
| ui/cycleExportManager.js | 134 | `setTimeout(showSuccess, 3000)` | new: `EXPORT_FALLBACK_SUCCESS_MS` |
| platform/capacitorBridge.js | 224 | `hint.remove(), 200` | `DELAYS.ANIMATION_SHORT` |
| task/taskCRUD.js | 442 | `removeOverlays, 500` | `DELAYS.POST_RESET_CLEANUP` |
| routine/routineSwitcher.js | 872 | `removeOverlay, 500` | same |
| boot/orchestrator.js | 672 | `revokeObjectURL, 5000` | new: `BLOB_URL_REVOKE_MS` |
| boot/orchestrator.js | 1172 | `setTimeout(resolve, 2000)` | `BOOT_TIMEOUTS.RETRY_DELAY` (2000 — exact match, likely the intent) |
| utils/notifications.js | 1676, 1781 | `focus(...), 20` | new: `FOCUS_NEXT_TICK_MS` (or use `WHEEL_RESET_DELAY: 15`-style entry) |
| utils/storageUtils.js | 389 | `detectAndRepaint, 100` | `DELAYS.STATS_UPDATE_DELAY` or new repaint constant |

---

## Priority 4 — unexplained layout + duplicated thresholds

| File | Line | Current | Issue |
|---|---|---|---|
| ui/helpWindowManager.js | 119 | `window.innerHeight - 385` | **Most-deserving name in the codebase.** What is 385 — header + footer + margins? Name it (`HELP_WINDOW_CHROME_PX`) and comment the derivation. |
| ui/quickActionsManager.js | 1416 | `` `${rect.top - 10}px` `` | `TOOLTIP_OFFSET_PX` |
| progress/cycleCompletion.js | 384, 394 | `>= 100`, `>= 500` | Milestone thresholds inlined — `MILESTONES` exists in constants.js; add `CYCLES_100: 100, CYCLES_500: 500, TASKS_500: 500` style entries and reference them |
| task/taskCycleReset.js | 767 | `newTotalTasks >= 500` | same |
| features/statsPanel.js | 1476 | `>= 100 && !milestoneUnlocks.taskOrderGame` | same — this one gates the game unlock, so it's user-facing behavior defined in 3 places |
| features/achievementsManager.js | 780, 809 | `>= 180` | Haptic-per-half-rotation — arguably fine (degrees), but `HAPTIC_ROTATION_STEP_DEG = 180` costs nothing |

---

## Explicitly fine — do not "fix"

- `labels/themes.js` — hex colors/gradients are theme data
- `DIFFICULTY_SETTINGS` in taskOrder.js — named config
- Time-unit math: `/1000`, `/60`, `%60`, `*24` etc.
- Array/index arithmetic, `i + 1`, `length - 1`, Fisher-Yates
- `constants.js` itself
- Schema version strings ("2.5")

---

# Catch-Block Audit (the other thread complaint)

Brace-matched scan of all catch blocks in `modules/` (excl. testing), `service-worker.js`, `miniCycle-main.js`, and games. **77 swallowing catches total — but only 11 need work.**

## Fix: truly empty (no code, no comment) — 11 blocks

The fix is a one-line intent comment each, not logging. You know why each swallow exists — write it down.

| File | Line | Context | Suggested comment |
|---|---|---|---|
| recurring/recurringIntegration.js | 391 | diagnostic probe: AppState ready | `/* probe failed — flag stays falsy */` |
| recurring/recurringIntegration.js | 397 | probe: core loaded | same |
| recurring/recurringIntegration.js | 403 | probe: panel loaded | same |
| recurring/recurringIntegration.js | 417 | probe | same |
| recurring/recurringIntegration.js | 433 | probe | same |
| utils/notifications.js | 837 | wraps settings-listener setup | ⚠️ broader than the others — consider narrowing the try or adding `console.debug` |
| utils/notifications.js | 1069 | `setPointerCapture` | `/* capture unsupported — drag still works */` |
| utils/notifications.js | 1119 | pointer release | `/* ignore — capture may already be gone */` |
| utils/notifications.js | 1134 | pointer release | same |
| service-worker.js | 1155 | `.catch(function(){})` best-effort cache write | `/* cache write is best-effort */` |
| games/miniCycle-taskOrder-init.js | 8 | pre-paint dark-mode read | `/* corrupt/missing storage must not block first paint */` |

## Leave alone: comment-only intentional swallows — 46 blocks

Already the correct pattern (`/* perf API unavailable */`, `// API not ready yet - ok during early boot`, `/* cache clear is best-effort */`, etc.). Concentrated in orchestrator.js (11), moduleLoader.js (8), uiBoot.js (8), taskViewLayoutManager.js (7). **No action.**

## Mostly leave alone: code-but-no-log — 20 blocks

Legitimate fallback returns (`return null` / `return false` / default-object) in undoRedoManager, taskCompletion, taskCycleReset, dataSanitizer, capacitorBridge, popoverUtils, taskOrder.js:129, etc. Two are already correct error-collection patterns (featureBoot.js:605 pushes to `warnings`, migrationManager.js:404 pushes to `results.errors`). Optional: add `console.debug` to the 3–4 where a silent failure would be confusing to future-you (taskCompletion.js:92, taskCycleReset.js:160, dataSanitizer.js:172).

## Enforcement — add to eslint.config.js rules

```js
'no-empty': ['error', { allowEmptyCatch: false }],
```

ESLint treats a block containing a comment as non-empty, so this errors on exactly the 11 bare blocks, passes all 46 documented ones, and prevents regression. Same philosophy as the Lighthouse CI gate.

---

## Suggested order of work
1. taskOrder.js constants block (the commitment) — ~30 min
2. BREAKPOINTS + 6 call sites — ~20 min
3. setTimeout sweep — ~30 min
4. Priority 4 items (incl. `innerHeight - 385`) — ~20 min
5. Catch blocks: 11 comments + `no-empty` lint rule — ~20 min
6. Run `npm test` + `npm run lint`, then Lighthouse to confirm nothing moved

---

# ✅ EXECUTED July 20 2026 (v2.311) — as-built notes

All five streams shipped. Deviations from the plan above:
- **taskOrder.js block uses `var`, not `const`** — the file is deliberately ES5 throughout.
- **orchestrator:1172 got its OWN constant** (`BOOT_TIMEOUTS.SW_SPINUP_GRACE: 2000`, + the
  orchestrator fallback copy), NOT `RETRY_DELAY` — same value, different knob (iOS SW spin-up
  grace vs boot retry delay); coupling them recreates the bug centralizing prevents.
- **capacitorBridge kept a LOCAL const** (`HINT_REMOVE_MS`) — its header declares it a pure
  leaf module that imports nothing; honored over centralizing.
- **No `DELAYS` family exists** — mappings went to real `UI_TIMEOUTS` entries; six new ones
  added (FOCUS_NEXT_TICK, IDLE_CALLBACK_FALLBACK, TRANSITION_FALLBACK, EDIT_OVERLAY_REMOVE,
  EXPORT_FALLBACK_SUCCESS, BLOB_URL_REVOKE). undoRedo's 300ms = `CYCLE_SWITCH_TRANSITION`
  (it's a cycle-switch settle, not a notification fade).
- **The 385 mystery solved**: mirrors task-list.css `max-height: calc(100vh - 385px)`
  (header + 200px bottom padding) — named `VIEWPORT_CHROME_PX` with that derivation.
- **Milestones**: `MILESTONES.CELEBRATE_CYCLES_100/500 + CELEBRATE_TASKS_500` added;
  statsPanel's game gate now uses the pre-existing `MILESTONES.TASK_ORDER_GAME`.
- **The catch-block count was off**: the 11 empty catches got intent comments as planned,
  but enabling `no-empty` surfaced **31 additional empty if/else SHELLS** (dead branches
  left behind by an old console.log-stripping pass) across 25 files — all deleted, not
  commented (conditions verified side-effect-free).
- **Lint scope widened**: `npm run lint` now covers `service-worker.js` + `miniCycle-main.js`
  (was modules/ only — the SW's empty catch was invisible); `self` + `HTMLDialogElement`
  added to ESLint globals (killed 17+2 pre-existing no-undef errors). Lint: **0 errors**.

Verified: 2899/2899 tests, lint 0 errors, dist build + boot clean.
