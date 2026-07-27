# Focus Task View ("Task" tab)

> **Added:** v2.286 (July 2026)
> **Modules:** [`web/modules/ui/focusTaskPanel.js`](../../modules/ui/focusTaskPanel.js), [`web/modules/ui/panelCarousel.js`](../../modules/ui/panelCarousel.js)
> **Plan/history:** [FOCUS_TASK_VIEW_PLAN.md](../archive/FOCUS_TASK_VIEW_PLAN.md)

A one-task-at-a-time card inside **Focus View**. The panel switcher at the bottom of Focus View reads **Task | Routine | Stats** — the Task tab shows only the routine's *current step*, with a big Complete button. It exists only in Focus View and stays hidden until onboarding is completed or skipped.

---

## Why It Exists

miniCycle routines are often **sequential work processes** (an inspection checklist: job number → part number → serial number → …). The Routine list is the *management* view — see everything, reorder, edit. The Task view is the *execution* view — one step at a time, nothing else competing for attention. Completing the final card and watching the cycle complete is also a stronger payoff moment than checking a box in a list.

---

## User-Facing Behavior

### Where it lives

- **Focus View only.** The pill switcher gains a third tab: **Task | Routine | Stats** (swipe, tap a pill, or Shift+Arrow keys to move between panels; Shift+Tab quick-toggles).
- In Home View the Task tab is hidden — the switcher shows the usual two dots.
- **Onboarding gate:** during the first-run intro the Task tab is hidden AND unreachable (swipes skip it). It appears once the intro is completed or skipped — same rule as the Focus View exit button.

### The card

- **Position indicator** — "3 of 10" so you always know where you are in the routine.
- **Task text**, high-priority accent (left border in the task's priority color), recurring indicator (🔁), and due date when set.
- **Complete task** button — goes through the exact same path as tapping the task in the list, so undo, progress, achievements, and auto-cycle detection all behave identically.
- **‹ › browse buttons** — step through the whole list, including completed tasks (rendered dimmed with a strikethrough; the button becomes "Mark incomplete" there). Browsing is a temporary override: it resets when you complete a task, switch routines, reset the cycle, or leave the panel.
- **Vertical swipe (touch)** — swipe **up** on the card for the next task, **down** for the previous one. Same browsing rules as ‹ ›. Pull-to-refresh is disabled while this panel is shown so a down-swipe can't trigger both.

### Which task shows

The **first incomplete task** in list order. Completing it auto-advances to the next incomplete one.

### Mode behavior

The always-visible cycle/clear control is Focus View's existing floating action button (bottom-right) — the card doesn't duplicate it.

| Mode | Behavior |
|------|----------|
| **Auto Cycle** 🔄 | Completing the last task triggers the normal cycle completion, the card shows a ~2s "Cycle complete!" celebration, then task 1 appears. |
| **Manual Cycle** ✋ | Tap the floating Cycle button anytime → tasks reset → card shows task 1. All-done state hints at the cycle button. |
| **To-Do Mode** 📋 | Floating button reads Clear → completed tasks are removed → card shows the next remaining task. |

### Vocabulary themes

The tab labels go through the label system, and all four non-classic themes override them: Habit Tracker renders **Habit | Routine | Stats**, Fitness **Exercise**, Scholar **Topic**, Cleaning **Chore**. The card strings follow the same voice ("Complete habit", "All exercises complete!", "Current chore" ARIA, …) and retheme live when the routine's theme changes. Card completions are counted in `userProgress.focusTaskCompletions` for usage insight.

---

## Architecture Notes

- **Panel carousel** (`ui/panelCarousel.js`) — a pure-utility class owned by statsPanel that generalized the old binary task/stats switcher into an ordered, indexed registry (`navigate(±1)`, `goTo`, clamping, disabled-panel skipping, `inert` + nav-dot sync). All five gesture modalities (touch/mouse/wheel/pointer/keyboard) route through `gesturePanelManager._navigate(direction)` → `statsPanelManager.navigatePanels()`.
- **Deferred module** — `focusTaskPanel` is `deferred: true`; it loads via `ensureModuleLoaded('focusTaskPanel')` when Focus View activates, keeping it off the boot path. (featureBoot wires `deps.core.ensureModuleLoaded` *before* `loadAllModules` so restored focus sessions can load it mid-boot.)
- **Completion parity** — the card flips the real list checkbox and dispatches `change` (the `taskEvents.js` tap pattern: `enableUndoSystemOnFirstInteraction` → checkbox flip → `dispatchEvent('change')` → `checkMiniCycle`), never mutating state directly.
- **Gating** — the carousel's lazy `isEnabled` check (`body.focus-mode && !body.first-run-welcome-active`) governs reachability with zero event wiring; exiting Focus View while on the Task panel returns the carousel to Routine.
- **Tab labels** — CSS `content: attr(data-tab-label)` on the nav dots; `themeManager._refreshLiveLensLabels()` re-resolves the attributes (plus `aria-label`/`title`) through `getLabel()` on every theme/routine change.
- **Reset detection** — the panel's AppState subscriber treats a `cycleCount` bump on the active routine as a cycle reset; the celebration (`UI_TIMEOUTS.FOCUS_TASK_CELEBRATION`) plays only while the panel is visible.

---

## Related Documentation

- **User Guide — Views: Home & Focus:** [USER_GUIDE.md](../user-guides/USER_GUIDE.md)
- **Implementation plan & decision log (D1–D8):** [FOCUS_TASK_VIEW_PLAN.md](../archive/FOCUS_TASK_VIEW_PLAN.md)
- **Feature List:** [FEATURE_LIST.md](./FEATURE_LIST.md)
- **Stats Panel (the carousel's other panel):** [STATS_PANEL.md](./STATS_PANEL.md)
