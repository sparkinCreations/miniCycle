# ARIA Roles & Accessibility Audit

**Date:** February 17, 2026
**Status:** Documented — Not Started
**Priority:** Accessibility Enhancement
**Breaking Changes:** None (additive ARIA attributes only)

---

## Summary

Comprehensive audit of ARIA roles, attributes, keyboard accessibility, and screen reader support across miniCycle. The codebase has a solid foundation (labeled dialogs, icon hiding, toggle states, focus restoration) but has specific gaps in form control synchronization, live region announcements, and custom widget keyboard support.

---

## What's Already Done Well

- **12 dialog modals** all have `aria-labelledby` pointing to headings
- **8 aria-live regions** in HTML (`#notification-container`, `#mode-description`, `#recurring-settings-panel`, yearly selectors, `#recurring-summary`, `#live-region`)
- **SVG icons** consistently marked `aria-hidden="true"` (via `iconInit.js`)
- **aria-pressed / aria-expanded** properly synced on toggle buttons and collapsible sections (`taskButtons.js`, `settingsUIManager.js`, `menuManager.js`, `modeManager.js`)
- **Focus restoration** — `modalManager.js` stores `_previousFocus` on open, restores on close
- **Native `<dialog>` elements** with `showModal()` provide focus trapping and ESC support
- **Landmark roles** — `role="main"` on app container, `role="application"` on app-root, `role="region"` on stats panel, `<nav>` for menu and nav-dots, `<footer role="contentinfo">`
- **aria-checked** properly set on task checkboxes (`taskEvents.js:173`)
- **Doughnut chart** has `role="img" aria-label="Current cycle task completion"`
- **Progress bar** has `role="progressbar" aria-label="Progress to next milestone"`

---

## P0 — Critical Issues

### 1. Toggle Checkboxes Missing `aria-checked` Sync (20+ instances)

**Location:** Settings modal, Preferences modal — all custom toggle switches

**Problem:** Settings toggles use `<label><input type="checkbox"><span class="toggle-slider"></span></label>` but never sync `aria-checked` on the checkbox when state changes.

**Affected toggles (miniCycle.html):**
- `toggle-move-arrows`, `toggle-three-dots` (Accessibility section)
- `toggle-reduced-motion`, `toggle-high-contrast` (Accessibility section — ironic)
- `toggle-dark-mode`, `toggle-debug-mode`, `toggle-help-window`, `toggle-quick-actions`
- `toggle-auto-sort`, `toggle-sound`, `toggle-gestures`
- All preference checkboxes in preferences modal

**Fix:** In `settingsUIManager.js`, add `checkbox.setAttribute('aria-checked', checkbox.checked.toString())` in each toggle's change handler.

**Effort:** ~1 hour

---

### 2. Toast Notifications Not Announced to Screen Readers

**Location:** `modules/utils/notifications.js`

**Problem:** Notification toasts are purely visual — no text is pushed to an aria-live region. The `#notification-container` in HTML has `aria-live="polite"` but the notification component CSS creates toast elements that rely on visual animation only.

**Note:** The HTML `#notification-container` (miniCycle.html L947) does have `aria-live="polite" role="status"` — but the component CSS `notifications.css` redefines `#notification-container` properties. Needs verification that the aria-live region actually fires announcements when notifications appear. If it does, this may already work.

**Fix (if not working):** Ensure notification text content is injected as a direct text child or into a container that triggers the aria-live announcement. Test with VoiceOver/NVDA.

**Effort:** ~30 min to verify + fix if needed

---

### 3. Task List Items Missing `aria-label`

**Location:** `modules/task/taskDOM.js` — `<li>` elements created dynamically

**Problem:** Task items are created as `<li>` with `draggable="true"` and `data-task-id` but no `aria-label`. Screen readers must parse child elements to understand the task, rather than hearing a summary.

**Fix:** When creating task items, set:
```javascript
taskItem.setAttribute('aria-label', `Task: ${taskName}${isRecurring ? ' (recurring)' : ''}${isCompleted ? ' (completed)' : ''}`);
```

**Effort:** ~30 min

---

## P1 — High Priority

### 4. `role="radio"` Elements Lack Keyboard Navigation

**Location:** `modules/utils/notifications.js:1240-1260` — quick recurring frequency options

**Problem:** Custom `<div role="radio">` elements have `tabindex="0"` and `aria-checked` but no Arrow key, Home, or End keyboard handlers. Only click works.

**Fix:** Add Arrow Left/Right handlers to move focus between radio options. Implement roving tabindex pattern (only selected item has `tabindex="0"`, others get `tabindex="-1"`).

**Effort:** ~45 min

---

### 5. Preferences Collapsible Sections Missing `aria-expanded` (7 sections)

**Location:** `miniCycle.html` — Preferences modal section headers

**Problem:** Settings modal collapsible headers correctly set `aria-expanded`, but preferences modal headers do not.

**Affected sections:** `quick-themes`, `desktop-layout`, `app-bg`, `routine-list`, `tasks`, `buttons`, `stats`

**Fix:** Add `aria-expanded="false"` to each preferences section header in HTML, and sync in the JS collapse/expand handler.

**Effort:** ~30 min

---

### 6. Radio Button Groups Lack `<fieldset>` / `<legend>`

**Location:** Recurring settings panel — duration type selection (miniCycle.html L1275-1290)

**Problem:** Radio buttons for "Count" vs "Until Date" have `name="recur-duration-type"` but no wrapping `<fieldset><legend>` or `role="group"` with `aria-labelledby`.

**Fix:** Wrap radio group with `<fieldset><legend class="sr-only">Duration type</legend>...</fieldset>` or add `role="group" aria-label="Duration type"` to the container.

**Effort:** ~15 min

---

### 7. Custom Overlays Lack Focus Trap

**Location:** `achievementsManager.js`, `clearedTasksManager.js`, `historyManager.js`

**Problem:** These modules create custom `<div>` overlays (not `<dialog>`) that don't use `showModal()`, so Tab can escape to background content.

**Fix:** Either convert to `<dialog>` with `showModal()`, or add manual focus trapping (intercept Tab/Shift+Tab at first/last focusable element).

**Effort:** ~1 hour

---

## P2 — Medium Priority

### 8. Font Size Select Missing `aria-label`

**Location:** `miniCycle.html` — Accessibility settings section, `#font-size-select`

**Problem:** The `<select>` dropdown has no `aria-label` or associated `<label for="">`. It's inside the Accessibility section but isn't itself accessible.

**Fix:** Add `aria-label="Font size"` to the select element, or wrap with `<label for="font-size-select">Font Size</label>`.

**Effort:** ~5 min

---

### 9. Progress Bar Missing `aria-valuenow/min/max`

**Location:** `#stats-progress-bar` in miniCycle.html, updated by `statsPanel.js:1026`

**Problem:** Has `role="progressbar"` and `aria-label` (dynamically set), but no `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Screen readers can't announce the completion percentage numerically.

**Fix:** In `statsPanel.js`, also set `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow="${currentPercent}"`.

**Effort:** ~15 min

---

### 10. Range Input Missing `aria-valuetext`

**Location:** `#pref-pattern-opacity` range slider in preferences modal

**Problem:** Slider has `<label>` but no `aria-valuetext` showing human-readable value (e.g., "28%"). Screen readers just announce the raw number.

**Fix:** Add `aria-valuetext` update on input event.

**Effort:** ~15 min

---

### 11. Routine Switcher Listbox Missing `aria-activedescendant`

**Location:** `#miniCycleList` with `role="listbox"` in miniCycle.html, managed by `routineSwitcher.js`

**Problem:** List items have `role="option"` and `aria-selected`, but the parent listbox doesn't set `aria-activedescendant` to point to the currently selected item.

**Fix:** Set `listbox.setAttribute('aria-activedescendant', selectedItemId)` when selection changes.

**Effort:** ~15 min

---

### 12. Three-Dots Button Lacks `aria-pressed`

**Location:** `modules/task/taskDOM.js` — three-dots menu button

**Problem:** Gets `aria-label` but no `aria-pressed` to indicate when the task options menu is open.

**Fix:** Toggle `aria-pressed` when menu opens/closes.

**Effort:** ~15 min

---

## P3 — Low Priority / Polish

### 13. Drag-and-Drop Has No Keyboard Alternative
- Task items are `draggable="true"` but no keyboard reorder mechanism exists
- No `aria-grabbed` or `aria-dropeffect` indicators
- Complex to implement properly; consider move-up/move-down buttons as alternative

### 14. `role="button"` Spans Should Be `<button>` Elements
- `routineSwitcher.js:1108` creates `<span role="button">` for close — should be `<button>`
- Native `<button>` gets keyboard support for free

### 15. Color Picker Inputs Could Use `aria-describedby`
- 15+ color inputs in preferences modal have `<label>` (good) but no description of what UI aspect they control
- Low priority since labels are descriptive ("App Background", "Task Text", etc.)

### 16. Keyboard Shortcuts Not Documented Accessibly
- Ctrl/Cmd+Z for undo is implemented but not announced or documented in help text
- Consider adding to help window or onboarding

### 17. Redundant ESC Handlers on `showModal()` Dialogs
- Some modules add manual Escape key handlers on top of native `<dialog>` ESC support
- Not harmful but adds unnecessary code; could clean up

---

## Files Most Affected (by fix priority)

| File | Changes Needed |
|------|---------------|
| `modules/ui/settingsUIManager.js` | P0: aria-checked sync on all toggles |
| `modules/task/taskDOM.js` | P0: aria-label on task items; P2: aria-pressed on 3-dots |
| `modules/utils/notifications.js` | P0: verify aria-live; P1: radio keyboard nav |
| `miniCycle.html` | P1: preferences aria-expanded; P1: fieldset/legend; P2: font-size aria-label |
| `modules/features/achievementsManager.js` | P1: focus trap |
| `modules/features/clearedTasksManager.js` | P1: focus trap |
| `modules/features/historyManager.js` | P1: focus trap |
| `modules/features/statsPanel.js` | P2: aria-valuenow/min/max |
| `modules/routine/routineSwitcher.js` | P2: aria-activedescendant; P3: use `<button>` |

---

## Estimated Effort

| Priority | Items | Effort |
|----------|-------|--------|
| P0 | 3 issues | ~2 hours |
| P1 | 4 issues | ~2.5 hours |
| P2 | 5 issues | ~1 hour |
| P3 | 5 issues | ~2 hours (drag-drop is the big one) |
| **Total** | **17 issues** | **~7.5 hours** |
