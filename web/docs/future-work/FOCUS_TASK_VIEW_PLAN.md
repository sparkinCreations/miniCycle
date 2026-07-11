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
- **Nav dots markup** (miniCycle.html:2007): 2 `<button class="dot" role="tab" aria-controls="task-view|stats-panel">`. Focus-mode.css injects the text labels via `::before { content: "Routine"/"Stats" }` keyed off `aria-controls`, with a "|" separator as Routine's `::after`. **These CSS content strings are hardcoded — a label-system (rule #3) violation, as are the dots' `aria-label`s and visually-hidden span texts in the HTML.** Phase 2 fixes all of it via the `content: attr(data-tab-label)` bridge (decided July 9, 2026 — see Phase 2 step 2).
- **focusMode.activate()/deactivate()** does NOT force a view — entering focus while on Stats stays on Stats. Exit must handle "was on the one-task panel."

---

## Design decisions (need sign-off)

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | **Tab name** | ✅ DECIDED (July 9, 2026): **"Task"** — pill reads "Task \| Routine \| Stats" (zoom-out progression: one step → whole routine → numbers). "Focus" rejected: recursive inside Focus View. "Task" maps to lens-sensitive `noun.task` if tab labels are ever themed. NOTE: internal names stay `focusTaskPanel` / `#focus-task-panel` — the routine-list panel is already `#task-view` in the DOM, so a second `task-*` element would be a code-naming minefield (display label ≠ internal name, same as `#task-view` being labeled "Routine"). |
| D2 | **Which task shows** | First incomplete task in list order. Prev/next controls override temporarily; override resets on routine switch / cycle reset / panel leave. |
| D3 | **Skip affordance** | ✅ DECIDED (July 9, 2026): explicit ‹ › prev/next buttons on the card (horizontal swipe is taken by panel nav; vertical swipe deferred to a later phase). Skipping never completes. |
| D4 | **Completed tasks** | Prev/next can browse ALL tasks (completed ones render checked/dimmed) so out-of-order workflows (e.g. "Ran CMM or N/A") can review; auto-advance only targets incomplete ones. |
| D5 | **Mode behavior** | ✅ DECIDED (July 9, 2026) — the panel honors the routine's mode: |
| D6 | **Default panel entering focus mode** | Keep current behavior (whatever panel was active); do NOT auto-jump to the one-task panel. Revisit after usage. |
| D7 | **Exiting focus mode while on one-task panel** | Carousel switches to Routine (panel doesn't exist outside focus mode). |
| D8 | **Initial onboarding** | ✅ DECIDED (July 9, 2026): Task panel hidden AND unreachable during initial onboarding, until skipped or completed — same gate as the focus-mode exit X (`body.first-run-welcome-active`, cleared by onboardingManager on ×/skip/completion). The tab hides for free (nav-dots are hidden wholesale during the banner, first-run-welcome.css:151), but that alone leaves a gap: **swipes still work while dots are hidden**, so the carousel must also treat the panel as disabled while the body class is present. Check the class lazily at navigate/goTo time (self-healing, no event wiring; use `DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE`). |

### D5 — Mode behavior detail

The always-visible cycle/clear action is NOT a new button on the card — focus view's existing floating action button (bottom-right, `focusMode.refreshActionButton()`) is fixed-position, persists across all three panels, already swaps Cycle/Clear per mode, and is vocab-theme-aware (`focusMode.cycleActionLabel`/`clearActionLabel`). One source of truth; the card adds no duplicate. The panel *reacts* per mode:

- **Manual cycle:** user taps the floating Cycle button at any time → cycle resets via the existing path → panel re-renders to task 1 (falls out of the AppState subscription; no special code beyond the celebration check below).
- **To-do mode:** floating button reads Clear → completed tasks are removed → panel shows the next remaining task; the "N of M" position indicator recounts. Completed-but-uncleared tasks remain browsable via ‹ › (dimmed, per D4).
- **Auto cycle:** completing the LAST task triggers the existing cycleCompletion flow untouched (notifications, achievements, theme unlocks). The panel detects the reset and, instead of snapping to task 1, shows a **card-level cycle-complete celebration state for ~2 seconds, then automatically renders task 1**. Duration = new `UI_TIMEOUTS.FOCUS_TASK_CELEBRATION` constant (not a magic number). The celebration must not duplicate/fight the existing cycle-complete notification — it's a card visual only.
- **Reset detection:** the panel distinguishes "cycle reset" (all tasks flipped incomplete + cycleCount bump) from ordinary edits in its AppState subscriber, so manual resets and auto-cycle resets both land on task 1 — with the celebration reserved for the auto-cycle last-task moment (and optionally the manual Complete Cycle tap while the panel is visible).

---

## Phases

### Phase 0 — Generalize the carousel (no visible change) — ✅ DONE July 10, 2026

Goal: binary → indexed, with zero behavior change. Ship-safe on its own.

**As built (deviations from the sketch below, with rationale):**
- `panelCarousel.js` is a **Pattern-2 pure-utility class** (no DI framework, no manifest entry, zero module-level state) constructed and OWNED by statsPanel — not a manifest module. Rationale: eliminates the entire silent-undefined DI failure class for the carousel itself, and a `?v=`-split second instance of a stateless class is harmless. External consumers reach it through statsPanel's DI surface (`navigatePanels` in provides; Phase 2 adds gating wrappers as needed).
- gesturePanelManager routes ALL five input modalities through `_navigate(direction)` → optional `onNavigate` dep (depMappings → `statsPanelManager.navigatePanels`). Contract: `{id,index}` on move, `null` on clamp, **`undefined` = wiring dead → legacy binary fallback** (defense against the truthy-closure trap). Gestures are only consumed when a move happened, so clamped swipes keep tracking (matches old guarded behavior).
- Keyboard toasts keyed by landed panel id (`ARROW_TOAST_BY_PANEL` / `QUICK_TOGGLE_TOAST_BY_PANEL`); unknown panels don't toast. Shift+Tab = `navigate(+1) || navigate(-1)` (exact old toggle with 2 panels; switch to carousel `cycleNext()` in Phase 2 if a true wrap is wanted).
- `initTo()` writes ONLY inert + dot state at boot (no SHOW/HIDE classes — boot markup owns first paint; verified by the "no premature classes" live check).
- Dots now also sync `aria-selected` (small a11y improvement; previously static).
- `.hide-left`/`.hide-right` CSS **deferred to Phase 2** — with two panels the directions coincide with the existing `.hide` rules, so adding them now would be dead code. The carousel's `isEnabled` dynamic-gate hook (D8 groundwork) IS in.
- statsPanel shrank: switch logic → carousel; panel-specific side effects live in `_onTaskViewShown()`/`_onStatsPanelShown()` callbacks.

**Verified:** 12/12 new panelCarousel tests + statsPanel 24, gesturePanelManager 33, focusMode 40, quickActionsManager 9, diWiring 6, moduleLoader 17, moduleManifests 27, integration 11, uiBoot 13 — all green. Live parity: 22/22 checks in a fresh Playwright context (initial state, keyboard both directions + clamps, dot clicks, 500px mouse drags both directions, Shift+Tab toggle, navigatePanels contract). Two pre-existing gates confirmed unchanged: mouse/touch (not keyboard-arrow) paths are blocked while `isOverlayActive()` (onboarding modal etc.), and `MOUSE_DRAG_THRESHOLD` is 400px.

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

### Phase 1 — The one-task panel module — ✅ DONE July 11, 2026

**As built:**
- `modules/ui/focusTaskPanel.js` (diBase; singleton via `initFocusTaskPanel`, idempotent re-init after `destroy()`). Manifest entry is **`deferred: true` + `optional: true`** — loaded on demand via `ensureModuleLoaded('focusTaskPanel')` (the exact call Phase 2's `focusMode.activate()` will make), keeping it off the boot path per the load-perf work.
- **Completion = list parity**: `enableUndoSystemOnFirstInteraction?.()` → flip the REAL list checkbox → `dispatchEvent('change')` → `checkMiniCycle({lastToggledElement})` — the byte-identical trio from taskEvents.js's task-tap handler, so undo/progress/achievements/auto-cycle all ride the existing path. Browsing a completed task (D4) renders dimmed + the button unchecks.
- D2 override (`_overrideTaskId`) clears on: complete, routine switch, cycle reset, task-gone; `clearOverride()` is public for Phase 2's onHide hook. ‹ › clamp with disabled states.
- D5: `_onStateChange` detects cycleCount bump → card celebration (`UI_TIMEOUTS.FOCUS_TASK_CELEBRATION`, 2000ms) only while the panel has `.show`, then renders task 1; hidden panel re-renders silently. Mode-aware all-done hints (`deleteCheckedTasks`→todo / `autoReset`→auto / else manual, same resolution as routineSwitcher).
- Static markup in miniCycle.html beside `#task-view`; `focus-task-panel.css` (token-based, base hidden off-LEFT mirroring stats-panel's off-right, `--focus-task-priority` accent var). 10 `focusTask.*` label keys (5 lens-sensitive, noun-bearing). 14 new DOM_IDS.

**Verified:** 12/12 unit tests (selection, list-parity completion incl. checkMiniCycle/undo hooks, browse+clamp, override reset, celebration visible/hidden paths, priority var, destroy/re-init) + labelResolver/defaultLabels/moduleManifests/constants suites green. Live end-to-end (fresh Playwright context): 15/15 — deferred at boot, hidden/inert, `ensureModuleLoaded` initializes into the shared registry with zero DI-gap warnings, renders the real routine's task 1 ("1 of 3"), card completion flips the real list checkbox and auto-advances to "2 of 3", carousel correctly can't reach it yet. Also fixed a pre-existing `security/detect-unsafe-regex` lint error in constants.js (LAN-IP regex unnested, same semantics).

1. **Static HTML**: `#focus-task-panel` section next to `#task-view` (in miniCycle.html — a main-screen panel, NOT modalTemplates). New `DOM_IDS`/`DOM_SELECTORS` entries.
2. **New module `modules/ui/focusTaskPanel.js`** (diBase; deps: AppState required, task-completion fn, safeAddEventListener, getLabel via import, vocabThemeManager optional). Renders the current task card:
   - Task text (textContent — user data), priority color chain (`task.priorityColor ?? COLORS.PRIORITY_DEFAULT`), recurring/due-date indicators, position "3 of 10" (label key with vars).
   - Big complete control → **the same completion path the list checkbox uses** (via DI — never direct state mutation), then auto-advance to next incomplete after a short transition.
   - ‹ › prev/next buttons (D3/D4), all-done state (D5).
   - Subscribes to AppState (task add/delete/complete/reorder, routine switch) → re-render. Unsubscribes + removes listeners in `destroy()` (boot-retry).
3. **Labels**: new `focusTask.*` keys in defaultLabels.js (+ LENS_SENSITIVE_KEYS where nouny); no hardcoded strings.
4. **Cycle-completion moment**: per D5 detail — existing cycleCompletion flow runs untouched; the panel's AppState subscriber detects the reset (all tasks flipped incomplete + cycleCount bump) and plays the ~2s card celebration (`UI_TIMEOUTS.FOCUS_TASK_CELEBRATION`) before rendering task 1. No new button on the card — the floating focus action button is the always-visible cycle/clear control in every mode.
5. **Tests**: `focusTaskPanel.tests.js` — selection logic (first incomplete), advance-on-complete, prev/next override + reset, all-done, destroy cleanup.

### Phase 2 — Wire into focus view — ✅ DONE July 11, 2026

**As built:**
- Third dot (index 0, `aria-controls="focus-task-panel"`) in `#nav-dots`; hidden outside focus mode via `body:not(.focus-mode)` rule in focus-task-panel.css. statsPanel matches dots to panels **by aria-controls, not array position** (test fixtures may omit dots).
- **attr() bridge shipped for all three tabs**: `content: attr(data-tab-label)` in focus-mode.css; HTML seeds the attributes; `themeManager._refreshLiveLensLabels()` re-resolves `nav.tabTask/tabRoutine/tabStats` through getLabel() (+ aria-label + title on each dot) on every theme/routine change. `nav.tabTask` is lens-sensitive.
- Separators: `::after "|"` on the Task and Routine tabs; paddings rebalanced (Task 12/0, Routine 0/0, Stats 0/12) with matching active-dot indicator offsets (+6px/center/−6px).
- **D8 gate**: carousel `isEnabled` = `body.focus-mode && !body.first-run-welcome-active`, checked lazily per navigation. Verified under the REAL new-user condition — the app boots new users INTO focus mode with the welcome banner, and the onboarding gate alone blocked the panel.
- **focusMode.activate()** fire-and-forget `ensureModuleLoaded('focusTaskPanel')` (deferred module); **deactivate()** implements D7 (if the panel is `.show`, `showTaskView()` before chrome restore). New optional deps `ensureModuleLoaded` + `showTaskView` wired through all 4 DI layers (new generic `ensureModuleLoaded` depMappings entry → `deps.core`).
- statsPanel: `_onFocusTaskShown` (hide both slide arrows, gesture sync, announce via new `accessibility.focusTaskPanelOpened`) / `_onFocusTaskHidden` (clears the ‹ › override via the `focusTaskPanel` instance dep — new depMappings accessor + statsPanel optionalDeps).
- Directional CSS: `#task-view.hide.hide-right` (exits right when the Task panel is active); carousel sets `hide-left`/`hide-right` (DOM_CLASSES) relative to the active index. gpm keyboard toasts extended (`notify.keyboardFocusTaskOpened` / `quickToggleFocusTask`).

**Verified:** suites — panelCarousel 13 (new directional-class test), statsPanel 24 (fixture updated to carry aria-controls like real markup), gesturePanelManager 33, focusMode 40, focusTaskPanel 12, themeManager 21, defaultLabels 18, moduleManifests 27, diWiring 6 — all green. Live end-to-end (fresh Playwright context): **17/17** — onboarding gate blocks in-focus-mode navigation until dismissed; activate() deferred-loads the module; swipe reaches the panel; task-view exits off-right; pills render "Task | Routine | Stats" via attr(); card completes + advances against real state; keyboard traverses all 3 panels; D7 exit returns to Routine and re-hides the dot; zero DI-gap warnings/console errors. Screenshot sanity-check of the pill bar + card passed.

1. **Third dot** in `#nav-dots` (aria-controls="focus-task-panel", visually-hidden text). Hidden outside focus mode: `body:not(.focus-mode) .dot[aria-controls="focus-task-panel"] { display:none }`.
2. **focus-mode.css + label system**: convert ALL THREE tab labels to the label system via the CSS `attr()` bridge — `content: attr(data-tab-label)` — instead of adding a third hardcoded string:
   - New label keys (`nav.tabTask`, `nav.tabRoutine`, `nav.tabStats`) in defaultLabels.js; `nav.tabTask` in `LENS_SENSITIVE_KEYS` (maps to the noun — Habit Tracker's pill becomes "Habit \| Routine \| Stats" for free).
   - `_refreshLiveLensLabels()` (or the carousel's dot-sync) sets `dot.dataset.tabLabel = getLabel(key)` on each dot — refreshes on theme/routine change like everything else.
   - Also fix the hardcoded dot `aria-label`s and visually-hidden span texts (miniCycle.html:2008–2013) via the same pass (spans can use the M2 `data-label-key` sweep).
   - Rework the "\|" separator (two separators for three tabs — move separators to dedicated rules instead of Routine-only ::after; the padding-balancing hacks noted at :599 need re-doing for 3 tabs).
3. **Gating**: `focusMode.activate()` → `carousel.setPanelEnabled('focus-task-panel', true)`; `deactivate()` → disable + `goTo('task-view')` if it was active (D7). Panel registered at index 0 always, enabled only in focus mode. **Onboarding gate (D8)**: in addition to the enabled flag, `navigate()`/`goTo()` skip the panel while `body` has `DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE` — lazily checked so no wiring to onboardingManager is needed; the moment the banner is dismissed (skip/complete/×) the panel becomes reachable. Tab visibility during the banner is already covered by first-run-welcome.css hiding `#nav-dots` wholesale.
4. **updateNavDots generalization** already handled by carousel (Phase 0); verify aria-selected/tab semantics with 3 tabs.
5. **A11y pass**: keyboard nav across 3 panels, announceViewChange strings, inert correctness, reduced-motion (transitions already tokenized).

### Phase 3 — Polish (separate, optional)

- Vertical-swipe skip gesture on the card (needs gesturePanelManager vertical detection — new territory, keep out of v1).
- Vocab-theme icons/labels on the card per theme; consider data-label-key sweep for its static bits.
- Stats: track one-task-mode completions (actionUsage) to see if the feature earns its place.
- ~~Consider CSS `content` label theming for all three tabs~~ — pulled into Phase 2 (July 9, 2026: user flagged the hardcoded strings; `attr(data-tab-label)` bridge).

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
