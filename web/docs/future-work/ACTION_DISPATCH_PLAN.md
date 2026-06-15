# Central Action Dispatch — Uniform Usage Tracking Plan

**Status:** ✅ IMPLEMENTED (June 15 2026). Fixes the confirmed inconsistency where Quick
Actions' "Recently/Frequently used" only reflected panel usage + 5 special-cased features.

**What shipped (the implementation discovery refined the approach again):** while building, we
found `executeAction` dispatches ~19/22 actions by `btn.click()`-ing the feature's real DOM
button (only stats/recurring/reminders are function calls). So the implementation is a **single
capture-phase delegated click listener** over a `button-id → action-id` map
(`modules/ui/actionUsage.js`) — it catches BOTH direct user clicks and the panel's synthetic
clicks, uniformly. The 3 function-dispatch cases record explicitly in `executeAction`; the stats
slide-gesture records directly. The blanket `trackAction` + all 5 scattered calls were removed
(no double-count). `actionUsage.js` is the single writer of `counts`/`recent`. Verified: lint
clean, 13/13 new `actionUsage` tests, + quickActionsManager/menuManager/statsPanel/reminders/
recurring suites all green (no regressions). Capture phase chosen so a button handler's
`stopPropagation()` (e.g. settings) can't suppress tracking.

## Confirmed problem

`ACTION_REGISTRY` has **22 actions**. Only **5** call `trackAction()` from their natural
(outside-the-panel) entry points — `stats`, `settings`, `recurring`, `reminders`,
`open-routine`. The other **17** (`history, achievements, complete-all, dark-mode,
personalization, themes, help, games, feedback, search, user-manual, toggle-input,
task-options, new-routine, share-routine, export, task-order-game`) are only counted when
clicked **inside** the quick-actions panel.

**Consequence:** Recent is blind to most real usage; Frequent is biased toward the 5 wired
actions; the 17 are effectively invisible to the feature (chicken-and-egg — they can't enter
Recent/Frequent without being used from a panel that never surfaces them).

## Root cause (architecture)

The canonical dispatcher **already exists**: `quickActionsManager.executeAction(id)`
([quickActionsManager.js:591](../../modules/ui/quickActionsManager.js)) does
`trackAction(id)` → a 22-case `switch` that calls the real handler (`showStatsPanel()`, etc.).
**But:**
1. It's **owned by quickActionsManager** and only the panel calls it.
2. It's **menu-context-coupled** — each case bakes in `hideMainMenu?.()` + a `setTimeout`
   defer (correct when fired from the menu/panel, wrong for a standalone task button).
3. Every other entry point (menu items, feature buttons) **hand-rolls** the action and
   manually calls `trackAction` for only 5 of them ([menuManager.js:200](../../modules/ui/menuManager.js)).

So tracking is entangled with menu orchestration, and nothing forces a new entry point to track.

## Target architecture — a shared dispatcher

Extract a standalone **`modules/ui/actionDispatcher.js`** (a service, owned by no UI module):

```
dispatchAction(actionId, opts = {})
  1. const action = ACTION_REGISTRY[actionId];  if (!action) return
  2. recordActionUsage(actionId)        // the trackAction logic — ALWAYS, uniformly
  3. resolve handler (action.handler → injected fn) and run it
  4. if (opts.fromMenu) hideMainMenu()  // menu-context orchestration is OPT-IN, not baked in
```

- `ACTION_REGISTRY` + the handler-resolution move here (out of quickActionsManager).
- The `hideMainMenu` / `setTimeout` defer become **opt-in via `opts`** (menu + panel pass
  `{ fromMenu: true }`; a standalone button passes nothing → runs the handler directly, no
  menu side-effects).
- `recordActionUsage(id)` is the *only* place that writes `counts`/`recent` — so EVERY
  trigger that calls `dispatchAction` tracks automatically. Impossible to forget.

Then: **every** action trigger routes through `dispatchAction(id, ctx)`:
- Quick-actions panel slot click → `dispatchAction(id, { fromMenu: true })` (replaces internal `executeAction`)
- Main-menu items → `dispatchAction(id, { fromMenu: true })` (replaces hand-rolled `trackAction + handler`)
- Standalone feature buttons (recurring/reminders/settings/etc.) → `dispatchAction(id)`

## Why a shared module (not just "expose executeAction")

- Avoids `menuManager` (Phase CYCLE) hard-depending on `quickActionsManager` (Phase
  UI_MANAGERS) — the dispatcher is a leaf service both can use.
- Decouples the registry + dispatch from the panel **UI**, which also helps the separate
  `quickActionsManager` deferral candidate (the panel can defer; the dispatcher stays light).

## ⚠️ Verification refinement (June 15) — triggers are scattered → prefer track-at-source

Checking the plan against the code before building (the recurring/roadmap lesson) found:

- **The 22-case switch is cleanly extractable** — all cases are `this.deps.X()` calls; the only
  internal coupling is `this._warnMissingDep(...)` (a log+notify helper), which moves into the
  dispatcher with it. No internal state/render coupling. ✓
- **The real triggers are scattered DOM buttons, NOT menu items, and the registry handler name
  ≠ the trigger path.** Example: `history` is opened by `#history-btn` — a button rendered
  *inside the stats panel* ([statsPanel.js:228](../../modules/ui/statsPanel.js)) whose handler
  calls `openHistoryModal` directly. The registry's `handler: 'openHistory'` is a **dep-alias**
  wired (via depMappings) to the real provider `openHistoryModal`. So the entry-point inventory
  **cannot** be greped by handler name, and the triggers live deep in many feature modules.

**Implication:** Architecture A (route *every* scattered button through `dispatchAction`) means
finding and editing every such button across the feature modules + wiring the dispatcher dep
into each — a large, error-prone surface where a missed button stays untracked.

### Recommended: Architecture B — track at the canonical function (the convergence point)

Every trigger (panel, button, menu, anywhere) ultimately calls the **canonical open function**
(`openHistoryModal`, `showStatsPanel`, …). That function is the natural choke point. So:

- Add `recordActionUsage(id)` at the **top of each canonical function** (`openHistoryModal()`
  → `recordActionUsage('history')`). ~22 localized edits, each at a single choke point.
- Every caller then tracks **automatically** — no need to find every scattered button.
- The `ACTION_REGISTRY` provides the function→id mapping to drive this (and a tiny shared
  `recordActionUsage` module owns the `counts`/`recent` writes — one source of truth).

Trade vs A: B is **fewer, more-localized edits at the right seam**, lower risk of a missed
trigger. Its residual fragility (a brand-new *feature* must call `recordActionUsage` once in its
open fn) is far smaller than A's (every *trigger* must route through the dispatcher). Keep the
existing `executeAction` for the panel; it just calls the same canonical functions (which now
self-record), so its hand-rolled `trackAction` is **removed** to avoid double-counting.

**Recommendation: implement B.** It directly fixes the tracking gap with minimal blast radius;
the full central-dispatch (A) is the "purest" end-state but isn't justified by the payoff given
how scattered the triggers are.

## Implementation phases

1. **Discovery — entry-point inventory.** For each of the 22 actions, find every trigger
   (main-menu item, feature button, panel). This is the bulk of the risk surface — must be
   exhaustive or some path stays untracked. Grep each `handler` name + each feature's open path.
2. **Extract `actionDispatcher.js`** — move `ACTION_REGISTRY` + the `executeAction` switch +
   `trackAction` logic; parameterize the menu-context side-effects via `opts`. Wire its 22
   handler deps + `trackAction` target (AppState) through DI (`createDIModule`).
3. **Re-point quickActionsManager** at the shared dispatcher (panel slot → `dispatchAction`),
   keep its panel UI.
4. **Migrate entry points** — route every inventory trigger through `dispatchAction(id, ctx)`;
   delete the 5 hand-rolled `trackAction` calls (now redundant).
5. **Verify behavior parity per action** — each case's `hideMainMenu`/`setTimeout` behavior
   must match its old per-entry-point behavior (the side-effects were tuned for the panel).

## Risks

| Risk | Mitigation |
|---|---|
| Behavior drift — a menu item or button behaves differently after routing through the switch's side-effects | Phase 5: per-action parity check; `opts.fromMenu` keeps menu/panel behavior, omit for direct buttons |
| Missing an entry point in discovery → still-untracked action | Exhaustive grep per handler name; the dispatcher makes future triggers track-by-default, so the fix is durable once complete |
| DI churn — 22 handler deps + AppState move to the new module | Reuse the existing wiring; `createDIModule` + manifest entry; lazyRequires for cross-phase handlers |
| Touches a core UX path (every action) | Stage behind the full Playwright suite (quickActionsManager + menuManager tests) + device smoke test |

## Lighter alternative (if the full extraction is too much)

Expose `recordActionUsage(id)` (the `trackAction` logic) as a broadly-injected dep and add a
single call to **every** action trigger. Smaller change, no dispatcher extraction — but it
keeps the fragility that caused this (a new trigger can still forget to call it). The shared
dispatcher is preferred precisely because it makes tracking structural, not a convention.

## Tests (concrete)

### New `recordActionUsage.tests.js` — the single tracking unit
1. **counts increment** — `recordActionUsage('stats')` sets `counts.stats` undefined→1; again→2.
2. **recent is MRU** — record `history` then `stats` → `recent === ['stats','history']` (front = newest).
3. **recent dedups** — record `a, b, a` → `recent === ['a','b']` (a moved to front, no dupe).
4. **recent caps at MAX_RECENT (10)** — record 12 distinct ids → `recent.length === 10`, oldest two dropped.
5. **unknown id is a no-op** — `recordActionUsage('not-an-action')` writes nothing (mirrors the
   `if (!ACTION_REGISTRY[id]) return` guard) — no `counts`/`recent` mutation.
6. **bootstraps state** — with no `settings.quickActions`, the first call creates it
   (`pinned`/`counts`/`recent`/`activeView`) without throwing.
7. **persists once, atomically** — exactly one `AppState.update` per call.

### Source self-tracking — the core regression the whole change fixes
8. **calling a canonical fn directly records its action** — for a representative set
   (`showStatsPanel`→stats, `openHistoryModal`→history, `openThemes`→themes,
   `exportData`→export): invoke the function **directly** (simulating a menu/button/anywhere
   trigger, NOT the panel) and assert `counts[id]` incremented + `recent[0] === id`. This is
   the exact behavior that was broken (17/22 didn't count outside the panel). Ideally one case
   per action so a future un-instrumented function is caught.

### No double-count (the panel path)
9. **panel click counts once** — triggering an action via the quick-actions panel increments
   `counts[id]` by **exactly 1** (the panel's old hand-rolled `trackAction` is removed; the
   canonical fn self-records). Guards against the panel + source both counting.

### View integration (`quickActionsManager.tests.js`, updated)
10. **Frequent ordering** — after recording, the Frequent view lists ids by `counts` desc,
    excludes ids below `FREQUENT_MIN_USES`, caps at `SLOT_COUNT` (5).
11. **Recent ordering** — Recent view shows the MRU list, top `SLOT_COUNT`.
12. Existing `quickActionsManager` (27) + `menuManager` suites stay green (no behavior drift).

## Effort / payoff
- **Effort:** MEDIUM–HIGH — the dispatcher extraction is contained, but the entry-point
  inventory + per-action parity check is the real work, and it touches core UX.
- **Payoff:** Recently/Frequently used finally reflect **actual** feature usage from anywhere;
  and it's **durable** — every future action trigger tracks automatically.
