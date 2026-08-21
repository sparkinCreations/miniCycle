# Quick Actions & Usage Tracking Architecture

**Modules:** `modules/ui/quickActionsManager.js` (~1,500 lines), `modules/ui/actionUsage.js`
**Version:** See [PROJECT_STATS.md](../PROJECT_STATS.md)
**Test Coverage:** `quickActionsManager` + `actionUsage` suites (100%)
**Status:** Production-ready

---

## Overview

Quick Actions is a customizable panel (desktop window + mobile menu row) that surfaces
the app's features in three views:

- **Pinned** — fixed user-chosen slots (default `['stats', null, null, null, null]`).
- **Recently used** — most-recently-used actions (MRU order).
- **Frequently used** — actions sorted by how often they're used.

All three are driven by per-user data in `state.settings.quickActions` and a single
**usage-tracking** mechanism so that using a feature *from anywhere* in the app counts —
not just from the panel.

### State shape

```js
state.settings.quickActions = {
  pinned: ['stats', null, null, null, null], // SLOT_COUNT (5) fixed slots
  counts: { stats: 12, history: 3, ... },    // frequency tally per action id (drives Frequent)
  recent: ['history', 'stats', ...],         // MRU list, capped at MAX_RECENT (10)
  activeView: 'recent'                        // 'pinned' | 'recent' | 'frequent'
}
```

- **Recent view:** the `recent` MRU list, top `SLOT_COUNT` (5) shown.
- **Frequent view:** `counts` entries with `count >= FREQUENT_MIN_USES`, sorted high→low,
  top `SLOT_COUNT` (5). Empty-state shown if none qualify.

## The action registry

`ACTION_REGISTRY` (in `quickActionsManager.js`) defines the **22 actions**, each with a
`labelKey`, `icon`, `section`, and a `handler` name:

```js
const ACTION_REGISTRY = {
  'history': {
    labelKey: 'quickAction.history',
    icon: 'history',
    section: 'Navigation',
    handler: 'openHistory',      // ← maps to an executeAction switch case
  },
  // ...21 more
};
```

`executeAction(id)` switches on the handler. **Most actions (~19) dispatch by finding the
feature's real DOM button and calling `btn.click()`** — only `stats`, `recurring`, and
`reminders` call functions/modals directly:

```js
executeAction(actionId) {
  const action = ACTION_REGISTRY[actionId];
  if (!action) return;
  switch (action.handler) {
    case 'openHistory': {                 // button-dispatched (the common pattern)
      this.deps.hideMainMenu?.();
      setTimeout(() => {
        const btn = document.getElementById(DOM_IDS.HISTORY_BTN);
        if (btn) btn.click();             // ← real feature button; its click bubbles to the usage listener
        else this._warnMissingDep(DOM_IDS.HISTORY_BTN, actionId);
      }, 0);
      break;
    }
    case 'showStatsPanel':                // function-dispatched (no button) → record explicitly
      recordActionUsage(this.deps.AppState, actionId);
      this.deps.showStatsPanel();
      this.deps.hideMainMenu?.();
      break;
    // ...
  }
}
```

> This `btn.click()` dispatch is *why* usage tracking is a delegated listener (below) rather
> than instrumenting per-feature functions — the button click is the natural convergence point.

## Usage tracking — single source of truth

`modules/ui/actionUsage.js` is the **only** writer of `counts`/`recent`. It exposes:

| Export | Purpose |
|---|---|
| `recordActionUsage(AppState, actionId)` | Increment `counts[id]` + push to front of `recent` (dedup, cap `MAX_RECENT`). No-ops on unknown ids / null AppState. |
| `ACTION_BUTTON_MAP` | `DOM button id → action id` for every action-opening button. |
| `setupActionUsageTracking(AppState)` | Attach the delegated listener (idempotent). |
| `actionIdForClick(e)` | Resolve a click to its action id (if it hit a mapped button). |

```js
// modules/ui/actionUsage.js — the ONLY writer of counts/recent
export function recordActionUsage(AppState, actionId) {
  if (!AppState?.update || !VALID_ACTION_IDS.has(actionId)) return; // junk / no AppState → no-op
  AppState.update(s => {
    if (!s.settings) s.settings = {};
    if (!s.settings.quickActions) {
      s.settings.quickActions = { pinned: ['stats', null, null, null, null], counts: {}, recent: [], activeView: 'recent' };
    }
    const qa = s.settings.quickActions;
    qa.counts[actionId] = (qa.counts[actionId] || 0) + 1;            // frequency
    qa.recent = [actionId, ...qa.recent.filter(id => id !== actionId)].slice(0, MAX_RECENT); // MRU + dedup + cap
  });
}

// ACTION_BUTTON_MAP — DOM button id → action id (built from DOM_IDS constants)
export const ACTION_BUTTON_MAP = Object.freeze({
  [DOM_IDS.HISTORY_BTN]: 'history',
  [DOM_IDS.OPEN_SETTINGS]: 'settings',
  [DOM_IDS.OPEN_MINI_CYCLE]: 'open-routine',   // a feature can have multiple trigger buttons
  // ...one per action-opening button
});

// The single delegated listener — setupActionUsageTracking(AppState), attached once
document.addEventListener('click', (e) => {
  const actionId = actionIdForClick(e);   // walks up for a MAPPED id — see below
  if (actionId) recordActionUsage(AppState, actionId);
}, true);  // ← CAPTURE phase: fires before the button's own handler, so stopPropagation() can't suppress it

// actionIdForClick walks ancestors looking for a MAPPED id, not the NEAREST id.
// Resolving `closest('[id]')` and looking THAT up meant a mapped button carrying
// id-bearing children shadowed itself: clicking #toggle-task-input-text (the
// button's own label, and the larger tap target) recorded nothing, while clicking
// the button around it recorded normally. It also uses hasOwnProperty — `el.id` is
// DOM-controlled, so an id of "constructor" or "toString" would otherwise resolve
// to a function off Object.prototype (CLAUDE.md #18).
```

### How a use is recorded (all entry points, exactly once)

1. **Button-dispatched actions (~19):** one **capture-phase** delegated `click` listener on
   `document` maps the clicked button → action id → `recordActionUsage`. This catches BOTH a
   user's direct click on the feature button AND the panel's synthetic `btn.click()` — one
   listener, both paths, recorded once. Capture phase is deliberate so a button handler's
   `stopPropagation()` (e.g. the settings open handler) can't suppress tracking.
2. **Function-dispatched panel cases (`stats`/`recurring`/`reminders`):** `executeAction`
   calls `recordActionUsage` explicitly (no button click for the listener to catch).
3. **Stats — every entry point:** recorded in `statsPanelGestures._onStatsPanelShown`, the
   carousel's `onShow`. It used to sit in `handleSlideRightClick`, so the slide arrow counted and
   the nav pill did not — and by the panel architecture all five gesture modalities (swipe, wheel,
   pointer drag, keyboard, arrow) reach the panel through the carousel, so four of them were
   missing too. `onShow` is where they converge. Safe against inflation at boot: `initTo()` sets
   the opening panel WITHOUT firing callbacks, and the focus-mode restore path only ever `goTo()`s
   `focus-task-panel`.

> **A long press is not a use.** Holding a slot shows its tooltip and the click that the browser
> fires on touchend is SWALLOWED — by a capture-phase guard on `document` in
> `utils/longPressHint.js`, which runs before this listener. So a hold records nothing and runs
> nothing: asking what an icon does must not do it. A normal tap is unaffected; suppression is
> scoped to the held element and expires after `UI_TIMEOUTS.LONG_PRESS_CLICK_GUARD`.

The listener is set up once in `quickActionsManager.init()` and lives for the app lifetime
(idempotent + boot-retry-safe — it refreshes its AppState reference on re-init).

> **History:** earlier, only 5 of 22 actions tracked usage outside the panel (each feature's
> open path had to remember to call `trackAction`). The delegated listener made it uniform and
> removed those 5 scattered calls + the panel's hand-rolled `trackAction`. See
> [ACTION_DISPATCH_PLAN.md](../archive/ACTION_DISPATCH_PLAN.md).

## Adding a new quick action

Worked example — adding a `notes` action that opens via the `#open-notes` button:

```js
// 1. quickActionsManager.js — ACTION_REGISTRY
'notes': { labelKey: 'quickAction.notes', icon: 'pencil', section: 'Navigation', handler: 'openNotes' },

// 2. quickActionsManager.js — executeAction switch (button-dispatched: nothing else needed for tracking)
case 'openNotes': {
  this.deps.hideMainMenu?.();
  setTimeout(() => {
    const btn = document.getElementById(DOM_IDS.OPEN_NOTES);
    if (btn) btn.click();
    else this._warnMissingDep(DOM_IDS.OPEN_NOTES, actionId);
  }, 0);
  break;
}

// 3. actionUsage.js — VALID_ACTION_IDS
export const VALID_ACTION_IDS = Object.freeze(new Set([ /* ... */ 'notes' ]));

// 4. actionUsage.js — ACTION_BUTTON_MAP (THIS is what makes it track from anywhere)
export const ACTION_BUTTON_MAP = Object.freeze({ /* ... */ [DOM_IDS.OPEN_NOTES]: 'notes' });

// 5. defaultLabels.js — the label
quickAction: { /* ... */ notes: 'Notes' }
```

If instead it dispatched via a **function** (like `stats`/`recurring`/`reminders`), skip the
`ACTION_BUTTON_MAP` entry and call `recordActionUsage(this.deps.AppState, actionId)` inside its
`executeAction` case.

> Forgetting step 4 means the action opens but never appears in Recent/Frequent — the
> `actionUsage` test `'ACTION_BUTTON_MAP has no undefined keys'` guards against a typo'd
> `DOM_ID`, but not an entirely missing entry.

## Files

| File | Role |
|---|---|
| `modules/ui/quickActionsManager.js` | Panel UI, `ACTION_REGISTRY`, `executeAction`, views |
| `modules/ui/actionUsage.js` | `recordActionUsage`, `ACTION_BUTTON_MAP`, the delegated listener |
| `tests/actionUsage.tests.js` | Unit + listener tests |
| `tests/quickActionsManager.tests.js` | Panel/manager tests |
