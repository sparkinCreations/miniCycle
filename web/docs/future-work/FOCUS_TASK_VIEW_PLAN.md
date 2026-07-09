# Focus Task View ("one task at a time") — Implementation Plan

**Date:** July 9, 2026
**Status:** Planned — awaiting design-decision sign-off
**Idea:** In focus view, add a third swipeable panel BEFORE Routine that shows a single task at a time — the routine's "current step." Swipe order becomes: **[One-task] ↔ [Routine] ↔ [Stats]**, with the one-task panel available ONLY in focus mode.

**Why it fits:** miniCycle routines are often sequential work processes (e.g. the inspection checklist: job number → part number → serial → CMM…). The list is the *management* view; one-at-a-time is the *execution* view. Completing the final card and watching the cycle complete is a stronger gamification payoff than checking a list box.

---

## Current architecture (verified July 9, 2026)

- **Two-panel carousel, one system for both normal and focus view.** `#task-view` (miniCycle.html:1821) and `#stats-panel` (:1931) toggle `.show`/`.hide` classes + `inert`. Focus mode does NOT have its own switcher — `focusMode.activate()` reparents `#nav-dots` to `<body>` (focusMode.js:~817) and focus-mode.css restyles the dots into the "Routine | Stats" text pills.
- **Hide direction is hard-coded per panel:** `#task-view.hide` slides off LEFT (`translate(-200%,-50%)`, app-container.css:82); `#stats-panel.hide` slides off RIGHT (`translateX(200%)`, stats-panel.css:71). Works only because there are exactly 2 panels.
- **gesturePanelManager (508 lines)** detects touch/mouse/wheel/pointer/keyboard and reduces ALL of them to a directional intent applied to a binary `state.isStatsVisible`, firing `onShowStatsPanel`/`onShowTaskView` callbacks. `syncStatsVisibility(bool)` is the external-sync API.
- **statsPanel owns the view switch:** `showTaskView()`/`showStatsPanel()` (statsPanel.js:774/811) do class toggles + `inert` + slide-arrow indicators + `_syncGestureManager` + `announceViewChange` + `updateNavDots`. `updateNavDots`/`handleDotClick` are hard-coded to indexes 0/1. `handleNavPillClick` toggles. Both `show*` functions are **DI-provided public APIs with external consumers — their signatures must not change.**
- **Nav dots markup** (miniCycle.html:2007): 2 `<button class="dot" role="tab" aria-controls="task-view|stats-panel">`. Focus-mode.css injects the text labels via `::before { content: "Routine"/"Stats" }` keyed off `aria-controls`, with a "|" separator as Routine's `::after`. (Note: these CSS content strings are hardcoded — a pre-existing vocab-theme gap; the new tab inherits the same limitation for now.)
- **focusMode.activate()/deactivate()** does NOT force a view — entering focus while on Stats stays on Stats. Exit must handle "was on the one-task panel."

---

## Design decisions (need sign-off)

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | **Tab name** | ✅ DECIDED (July 9, 2026): **"Task"** — pill reads "Task \| Routine \| Stats" (zoom-out progression: one step → whole routine → numbers). "Focus" rejected: recursive inside Focus View. "Task" maps to lens-sensitive `noun.task` if tab labels are ever themed. NOTE: internal names stay `focusTaskPanel` / `#focus-task-panel` — the routine-list panel is already `#task-view` in the DOM, so a second `task-*` element would be a code-naming minefield (display label ≠ internal name, same as `#task-view` being labeled "Routine"). |
| D2 | **Which task shows** | First incomplete task in list order. Prev/next controls override temporarily; override resets on routine switch / cycle reset / panel leave. |
| D3 | **Skip affordance** | ✅ DECIDED (July 9, 2026): explicit ‹ › prev/next buttons on the card (horizontal swipe is taken by panel nav; vertical swipe deferred to a later phase). Skipping never completes. |
| D4 | **Completed tasks** | Prev/next can browse ALL tasks (completed ones render checked/dimmed) so out-of-order workflows (e.g. "Ran CMM or N/A") can review; auto-advance only targets incomplete ones. |
| D5 | **All-done state** | Card shows "all done" state + the cycle action (mirrors mode: Complete Cycle / Clear Completed). In auto-cycle the reset happens on last completion anyway — celebration plays, panel re-renders to task 1. |
| D6 | **Default panel entering focus mode** | Keep current behavior (whatever panel was active); do NOT auto-jump to the one-task panel. Revisit after usage. |
| D7 | **Exiting focus mode while on one-task panel** | Carousel switches to Routine (panel doesn't exist outside focus mode). |

---

## Phases

### Phase 0 — Generalize the carousel (no visible change)

Goal: binary → indexed, with zero behavior change. Ship-safe on its own.

1. **New module `modules/ui/panelCarousel.js`** (diBase; manifest entry, api `ui`). Owns an ordered panel registry:
   ```js
   registerPanel({ id, element, dotSelector, show(), hide(direction), enabled: true })
   navigate(direction)   // ±1, clamps at ends, skips disabled panels
   goTo(indexOrId)
   setPanelEnabled(id, bool)   // for focus-only panels
   getActiveId() / getActiveIndex()
   destroy()
   ```
   Centralizes: class toggles, `inert`, nav-dot active state (`aria-selected` too), `announceViewChange`, gesture-manager sync.
2. **statsPanel delegates**: `showTaskView()` → `carousel.goTo('task-view')`, `showStatsPanel()` → `carousel.goTo('stats-panel')`. Public API unchanged; internal switching logic (~80 lines incl. slide arrows/inert/dots) moves out. This SHRINKS statsPanel — aligned with LARGE_MODULE_SPLITS_PLAN Priority 2. Slide-arrow indicator logic moves into the two panels' show/hide callbacks.
3. **gesturePanelManager**: internal binary state replaced by `onNavigate(direction)` callback (all 5 modalities already compute a direction). Keep `syncStatsVisibility`/`isStatsVisible` as thin shims over `syncActiveIndex(i)` (consumers exist). Shift+Tab quick-toggle becomes cycle-to-next (wraps).
4. **CSS**: introduce `.hide-left` / `.hide-right` per panel (carousel sets one based on relative index). Keep existing `.hide` rules as-is (task-view=left, stats=right) so nothing regresses if a stale class remains; carousel always sets the directional class.
5. **DI pipeline (all 4 layers + consumer whitelist!):** manifest entry, `depMappings`, featureBoot wiring, consumer deps declarations. `panelCarousel` in statsPanel/gesturePanelManager optionalDeps.
6. **Tests**: `panelCarousel.tests.js` (register in ALL_MODULES + module-test-suite.html — drift guard) — order, clamping, disabled-skip, inert, dot sync. Existing statsPanel/gesturePanelManager suites must stay green.

**Verify Phase 0:** normal + focus mode swipe/click/keyboard behave identically to today, on a NEVER-LOADED origin (SW/memory-cache trap).

### Phase 1 — The one-task panel module

1. **Static HTML**: `#focus-task-panel` section next to `#task-view` (in miniCycle.html — a main-screen panel, NOT modalTemplates). New `DOM_IDS`/`DOM_SELECTORS` entries.
2. **New module `modules/ui/focusTaskPanel.js`** (diBase; deps: AppState required, task-completion fn, safeAddEventListener, getLabel via import, vocabThemeManager optional). Renders the current task card:
   - Task text (textContent — user data), priority color chain (`task.priorityColor ?? COLORS.PRIORITY_DEFAULT`), recurring/due-date indicators, position "3 of 10" (label key with vars).
   - Big complete control → **the same completion path the list checkbox uses** (via DI — never direct state mutation), then auto-advance to next incomplete after a short transition.
   - ‹ › prev/next buttons (D3/D4), all-done state (D5).
   - Subscribes to AppState (task add/delete/complete/reorder, routine switch) → re-render. Unsubscribes + removes listeners in `destroy()` (boot-retry).
3. **Labels**: new `focusTask.*` keys in defaultLabels.js (+ LENS_SENSITIVE_KEYS where nouny); no hardcoded strings.
4. **Cycle-completion moment**: on last-task completion in auto-cycle, let the existing cycleCompletion flow run untouched; panel re-renders from state (all unchecked → shows task 1). Manual mode: all-done card exposes the cycle action.
5. **Tests**: `focusTaskPanel.tests.js` — selection logic (first incomplete), advance-on-complete, prev/next override + reset, all-done, destroy cleanup.

### Phase 2 — Wire into focus view

1. **Third dot** in `#nav-dots` (aria-controls="focus-task-panel", visually-hidden text). Hidden outside focus mode: `body:not(.focus-mode) .dot[aria-controls="focus-task-panel"] { display:none }`.
2. **focus-mode.css**: `content: "Task"` ::before; rework the "|" separator (two separators for three tabs — move separators to dedicated rules instead of Routine-only ::after; the padding-balancing hacks noted at :599 need re-doing for 3 tabs).
3. **Gating**: `focusMode.activate()` → `carousel.setPanelEnabled('focus-task-panel', true)`; `deactivate()` → disable + `goTo('task-view')` if it was active (D7). Panel registered at index 0 always, enabled only in focus mode.
4. **updateNavDots generalization** already handled by carousel (Phase 0); verify aria-selected/tab semantics with 3 tabs.
5. **A11y pass**: keyboard nav across 3 panels, announceViewChange strings, inert correctness, reduced-motion (transitions already tokenized).

### Phase 3 — Polish (separate, optional)

- Vertical-swipe skip gesture on the card (needs gesturePanelManager vertical detection — new territory, keep out of v1).
- Vocab-theme icons/labels on the card per theme; consider data-label-key sweep for its static bits.
- Stats: track one-task-mode completions (actionUsage) to see if the feature earns its place.
- Consider CSS `content` label theming for all three tabs (pre-existing gap).

---

## Risks / gotchas (from hard-won lessons)

- **statsPanel/gesturePanelManager refactor risk**: Phase 0 touches every input modality. Mitigate: ship Phase 0 alone, verify on fresh origin, keep binary shims.
- **DI silent no-ops**: every new dep through all 4 pipeline layers + consumer `deps` whitelist; boot with the DI-gap validator watching (it now covers optional modules).
- **Boot retry**: both new modules need `destroy()`; listeners via safeAddEventListener/stored keys.
- **Drift guard**: new test files must be registered in ALL_MODULES AND module-test-suite.html, and emit the `Results: X/Y` summary format.
- **Verification caching**: always verify on a never-loaded port (three-layer cache trap).
- **CSP**: no inline scripts touched (static HTML additions only) — no hash recompute needed; confirm no inline handlers in new markup.

## Estimated sizes

- Phase 0: ~350 new lines (carousel + tests) − ~80 from statsPanel; gesturePanelManager ±60.
- Phase 1: ~400 lines (panel + card CSS + tests + labels).
- Phase 2: ~120 lines (CSS pills/separators, gating, dot).
