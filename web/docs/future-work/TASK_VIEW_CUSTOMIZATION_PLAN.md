# Task View Customization — Implementation Plan

> Status: Proposed (not yet started)
> Author: planning session 2026-05-05
> Reference implementation: `modules/utils/notifications.js` drag system (lines 925–1119)

## Goal

Desktop-only ability to drag-customize the position of 5 elements within a bounded "Task View" rectangle on the home view. Defaults = current CSS positions. Undo-able. Reset in settings. Hover-revealed drag handle in upper-left of each draggable. Focus View not affected.

## Draggables

| Key | Element | Compound? |
|---|---|---|
| `task-card-group` | task list card + progress bar + focus-view expand button | ✅ moves as one |
| `add-task-input` | Add task input bar | — |
| `quick-actions-panel` | Recently Used panel | — |
| `status-bubble` | tasks/cycles/storage pill | — |
| `complete-cycle-btn` | Complete Cycle button | — |

## Architecture

**New module:** `modules/ui/taskViewLayoutManager.js` — uses `createDIModule()`, follows resilient constructor pattern, exports `setTaskViewLayoutManagerDependencies` and `TaskViewLayoutManager` class.

**Registry pattern** (one drag system, many participants):

```js
this.register(element, {
    key: 'add-task-input',
    handleAriaLabel: getLabel('a11y.dragHandleAddTask')
});
```

**New DOM wrapper:** `<section id="task-view-layout">` in `miniCycle.html` containing all five draggables. Compound group gets its own inner wrapper `<div class="task-card-group">`.

**Position model:** Element stays in normal flow until first move. On first drag-end, it flips to `position: absolute` with coords relative to the wrapper, seeded from its current bounding rect (no visual jump). On reset, removed from `positions` map → reverts to flow.

## Schema 2.5 addition

```js
state.settings.taskViewLayout = {
    positions: {
        // only customized keys present; absence = use flow position
        'add-task-input': { x: 120, y: 40 },
        'status-bubble': { x: 800, y: 200 }
    }
}
```

Read-side defaults to `{ positions: {} }` if missing. Migration is purely additive — no schema bump needed.

## Phases

### Phase 1 — Wrapper + module skeleton

- Add `<section id="task-view-layout">` and `<div class="task-card-group">` in `miniCycle.html`
- Create `modules/ui/taskViewLayoutManager.js` with `createDIModule`, registry, `init()` / `destroy()`
- Add to `core/constants.js`:
  - `DOM_IDS.TASK_VIEW_LAYOUT`, `DOM_IDS.TASK_CARD_GROUP`
  - Draggable element IDs (5)
  - `DOM_CLASSES.TVL_DRAGGING`, `DOM_CLASSES.TVL_HANDLE_VISIBLE`
  - `Z_INDEX.TASK_VIEW_DRAGGING` (above siblings, below modals)
  - `UI_TIMEOUTS.LAYOUT_RESIZE_DEBOUNCE` (~150ms)
  - `INTERVALS.LAYOUT_COALESCE_WINDOW` (3000ms)
  - `LIMITS.LAYOUT_DRAG_THRESHOLD` (5px)
- Manifest entry in `boot/moduleManifests.js` (Phase 2 - features)
- **Verify**: stats-panel slide animation still works with the new wrapper (the wrapper is what slides, not its children)

### Phase 2 — Drag system

- Hover handle: small grip icon, absolute-positioned at upper-left of each draggable
- Revealed via CSS `:hover` *plus* media query `@media (hover: hover) and (pointer: fine) and (min-width: 1024px)` — naturally desktop-only
- Pointer-events drag from the handle (not the body) using `setPointerCapture` (lessons from `notifications.js:1012-1100`)
- Drag threshold (`LIMITS.LAYOUT_DRAG_THRESHOLD`) before commit, even on the handle, to forgive hover jitter
- Bounds clamping against wrapper `getBoundingClientRect()`
- `interactiveSelectors` exemption inherited from notification pattern (defense-in-depth — handle should be the only entry point but belt-and-suspenders)
- Swallow synthesized post-drag click (same pattern as notifications)
- New CSS file `styles/components/task-view-layout.css` — handle styles, `.tvl-dragging` state, transitions guarded by `prefers-reduced-motion`

#### Fix (v2.249) — interrupted-drag teardown

The feature is *not* exclusively desktop-mouse: `_isDesktop()` returns `true` on touch devices that report a fine pointer (e.g., iPad + Magic Keyboard/trackpad in landscape ≥1024px, since `isTouchDevice()` returns false when `(pointer: fine)` matches). Drag-customize is therefore live on those devices.

**Bug:** when a drag was interrupted by an iOS window event — Stage Manager / Split View resize, switching windows, or backgrounding — iOS drops pointer capture *without* firing `pointerup` or `pointercancel`. Teardown only ran on those events, so `.tvl-dragging` (the handle) and `.tvl-snap-target--visible` (the "Drop to dock" snap indicator) got orphaned and stuck visible across all orientations — these CSS classes have no breakpoint/orientation gate. Symptom: a gray "Drop to dock" rectangle plus stray drag handles stuck on screen even after rotating.

**Fix:**

- `onPointerDown` bails early if `!_shouldApplyLayout()` — don't start a drag when the feature isn't active (guards against starting one mid-resize as the viewport crosses the desktop boundary).
- Instance-level active-drag tracking: `this._activeDrag` holds the `abortDrag` closure (set on pointerdown, cleared on pointerup/abort).
- New `_abortActiveDrag()` force-ends the active drag and sweeps orphaned chrome: removes `.tvl-dragging` / `.tvl-snap-hover` / `.tvl-hovered` from all registered elements, hides all snap-target indicators, and resets `body.style.userSelect`.
- `_abortActiveDrag()` is wired to `visibilitychange` + `pagehide` (window switch / background) and to the resize handler (Stage Manager resize); these listeners are removed in `destroy()`.
- `_clearAllCustomPositions()` now also hides snap-target indicators (it previously cleared element classes but left the "Drop to dock" overlay visible).

### Phase 3 — Persistence

- On drag-end: single `AppState.update(state => { state.settings.taskViewLayout.positions[key] = {x, y}; }, true)`
- On init: read `state.settings.taskViewLayout.positions`, apply absolute coords to any keyed elements, leave others in flow
- Re-clamp on viewport resize (debounced via `UI_TIMEOUTS.LAYOUT_RESIZE_DEBOUNCE`) so a small window doesn't leave elements off-screen — clamp visually, do NOT mutate saved values (preserves user intent for wider windows)

### Phase 4 — Undo integration

- Drag-end's `AppState.update()` is already wrapped by the undo system → automatic snapshot
- **Coalesce same-element repositioning**: track `lastDragKey` + `lastDragTs`; if same element dragged again within `INTERVALS.LAYOUT_COALESCE_WINDOW` (3s), set the undo wrapper's coalesce hint so it replaces the last snapshot instead of stacking
- (Need to verify the undo wrapper supports this; if not, add a small `coalesceWith` option in `undoRedoManager` — same shape as the existing dedup logic for rapid edits)

### Phase 5 — Settings reset

- New function `setupResetTaskViewLayout()` in `settingsUIManager.js` with idempotency guard
- Add to `_initialized` and `initAllToggles()` in `settingsUIManager`
- **Register in `_subModules` AND call from `init()` in `settingsManager.js`** (per the New Settings Toggle Checklist)
- Confirmation modal before reset (uses existing `showConfirmationModal` pattern)
- New labels in `defaultLabels.js`:
  - `settings.resetTaskViewLayout` — "Reset Task View Layout"
  - `settings.resetTaskViewLayoutDescription` — "Move all elements back to their default positions."
  - `confirm.resetTaskViewLayout.title` — "Reset layout?"
  - `confirm.resetTaskViewLayout.body` — "All your customized positions will be cleared."
  - `notify.taskViewLayoutReset` — "Layout reset"
  - `a11y.dragHandleTaskCard` — "Drag handle, task card group"
  - `a11y.dragHandleAddTask` — "Drag handle, add task input"
  - `a11y.dragHandleQuickActions` — "Drag handle, quick actions panel"
  - `a11y.dragHandleStatusBubble` — "Drag handle, status bubble"
  - `a11y.dragHandleCompleteCycle` — "Drag handle, complete cycle button"
- Reset = `AppState.update(state => { state.settings.taskViewLayout.positions = {}; })`, then layout manager re-applies (everything goes back to flow)

### Phase 6 — Compound group polish

- `task-card-group` drag handle lives on the task card's upper-left
- Sub-container translates as one unit; sub-element CSS untouched (focus-button stays glued to progress bar via existing rules)
- Verify nothing in the codebase queries the task card's parent assuming it's the layout wrapper directly (search for `#taskList.parentElement`, etc.)

## Files touched

- `web/miniCycle.html` — wrapper + sub-container *(no inline script changes → no CSP hash recompute needed)*
- `web/modules/ui/taskViewLayoutManager.js` — **new**
- `web/modules/core/constants.js` — DOM_IDS, DOM_CLASSES, Z_INDEX, UI_TIMEOUTS, INTERVALS, LIMITS additions
- `web/modules/boot/moduleManifests.js` — manifest entry
- `web/modules/boot/moduleLoader.js` — `depMappings` entries if exposing functions cross-module (e.g., `resetTaskViewLayout`)
- `web/modules/boot/featureBoot.js` — wire DI
- `web/modules/ui/settingsManager.js` — `_subModules` + `init()`
- `web/modules/ui/settingsUIManager.js` — `setupResetTaskViewLayout`, `_initialized`, `initAllToggles`
- `web/modules/labels/defaultLabels.js` — ~10 new keys
- `web/styles/components/task-view-layout.css` — **new** (handle, dragging state)
- `web/styles/main.css` — **add `@import` line** for the new CSS file (see Cache Busting below)
- `web/tests/taskViewLayoutManager.tests.js` — **new** (Playwright)

## Cache Busting (`scripts/update-version.sh`)

The script handles three asset families differently. Make sure new files in this plan plug into the right one:

| Asset | Cache-bust mechanism | Action required for new files |
|---|---|---|
| **JS modules** | Dynamic import with `?v=${APP_VERSION}` via moduleLoader; `APP_VERSION` set in `version.js` at runtime | **None.** `taskViewLayoutManager.js` is auto-busted because the loader appends `?v=${APP_VERSION}` to every dynamic import. |
| **CSS files** | `@import url('./path.css?v=X.YYY')` lines in `styles/main.css`; `update-version.sh` rewrites the `?v=` on every bump (`CSS_FILES=("styles/main.css")` at line 285) | **Add an `@import` line to `styles/main.css`** for `task-view-layout.css` with `?v=2.224` (current version). The next `npm run version` bump will rewrite it. |
| **HTML files** | `miniCycle.html` and `pages/product.html` are in `CORE_HTML_FILES`; `?v=` params, currentVersion, meta tags rewritten | **None.** Wrapper changes are pure HTML structure, no `?v=` references added. |

**CSS import line to add to `styles/main.css`** (in the `components/` section, alphabetical position):

```css
@import url('./components/task-view-layout.css?v=2.224');
```

After adding, run `./scripts/update-version.sh` (or wait for the next version bump) to verify the `?v=` value gets rewritten. Confirm by `grep task-view-layout styles/main.css` — should show the new version string.

**Service worker cache:** `version.js` exports `CACHE_VERSION` separately. `update-version.sh` auto-bumps it (line 473 comment: "Auto-bump cache version (increment by 1)"). New CSS/JS files will be picked up by the service worker on the next version bump because the SW caches everything in the precache list and bumps the cache key.

## Standards compliance checklist

- ✅ `createDIModule()` from `diBase.js` — not plain `_deps`
- ✅ `Object.defineProperties` for setters via `di.setDependencies`
- ✅ All strings via `getLabel()`, keys added to `defaultLabels.js` first
- ✅ All selectors via `DOM_IDS` / `DOM_SELECTORS` / `DOM_CLASSES`
- ✅ All numeric values in `constants.js` (threshold, coalesce window, resize debounce, z-index)
- ✅ `destroy()` method clears all listeners + observers + pending timers
- ✅ Persistence via `AppState.update()` — no standalone localStorage
- ✅ DI DOM helpers (`getElementById`, `querySelector`, `getBody`)
- ✅ DI 4-step pipeline: manifest → `depMappings` → integration → consumer `this.deps`
- ✅ `prefers-reduced-motion` honored in drag transitions
- ✅ Desktop gate via `(hover: hover) and (pointer: fine) and (min-width: 1024px)` *plus* `deviceDetection` runtime check
- ✅ Focus View not affected (manager checks current view on each drag-start)
- ✅ Cache busting wired (CSS via `main.css` `@import`, JS auto-busted by loader)
- ✅ New Settings Toggle Checklist: registered in `_subModules` AND called in `init()`

## Open questions resolved

1. ✅ **Confirmation modal on reset** — keep modal (safer than silent toast)
2. ✅ **Coalesce window** — 3s
3. ✅ **Z-index of dragged element** — `Z_INDEX.TASK_VIEW_DRAGGING` (above siblings, below modals/notifications)
4. ✅ **Resize off-screen** — clamp visually, preserve saved values

## Risk register

| Risk | Mitigation |
|---|---|
| Stats-panel slide animation breaks with new wrapper | Phase 1 verifies before Phase 2; the wrapper IS what slides, children unchanged |
| Code references `#taskList.parentElement` assuming a specific structure | Phase 6 grep audit before merging compound group |
| Undo system doesn't support coalesce hint | Add small `coalesceWith` option to `undoRedoManager` if needed; coordinate with existing dedup logic |
| Saved positions break on viewport resize | Re-clamp on resize (Phase 3); preserve saved values, only clamp visual position |
| Hover handle interferes with task interactions | Handle is upper-left only, small footprint; `pointer-events: none` on the rest of the overlay; `interactiveSelectors` exemption as backup |
| User drags Complete Cycle button somewhere unreachable | Reset button surfaced in settings; bounds clamping prevents off-screen |

## Sequencing recommendation

Phase 1 first as a structural-only change — verify nothing breaks with the new wrapper + sub-container before adding any drag logic. Then Phase 2 (drag) and Phase 3 (persistence) can land together. Phase 4 (undo) and Phase 5 (reset) are independent and can ship in either order. Phase 6 is polish and grep audit.
