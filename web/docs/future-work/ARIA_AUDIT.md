# ARIA Roles & Accessibility Audit

**Date:** February 17, 2026
**Status:** Documented — Not Started
**Priority:** Accessibility Enhancement
**Breaking Changes:** None (additive ARIA attributes only)

---

## Summary

Comprehensive audit of ARIA roles, attributes, keyboard accessibility, and screen reader support across miniCycle. The codebase has **strong foundational accessibility** — 80+ aria attributes in HTML, 133 ARIA patterns across 32 JS modules, 85%+ label coverage via `getLabel()`, and proper use of native `<dialog>` elements. Gaps exist primarily in dialog `aria-modal`, custom widget keyboard navigation, and screen reader announcement consistency.

---

## What's Already Done Well

### HTML (miniCycle.html)
- **11 `<dialog>` elements** all have `aria-labelledby` pointing to title headings
- **Skip-to-content link** (L928) — `<a href="#app-container" class="skip-to-content">Skip to main content</a>`
- **7 aria-live regions** — `#notification-container` (polite/status), `#mode-description` (polite), `#recurring-settings-panel` (polite), yearly month/day/time containers (polite), `#recurring-summary` (polite)
- **Hidden live region** (L2741) — `<div id="live-region" aria-live="polite">` for programmatic announcements
- **Tab navigation** (L2713-2717) — proper `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`
- **Landmark roles** — `<main role="main">` (L2549), `role="application"` (L2543), `role="region"` (L2638), `<nav>` (L1006, L2713), `<footer role="contentinfo">` (L2706)
- **Semantic HTML** — `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<dialog>`, `<form>`, `<label>`, `<ul>`/`<li>`
- **Image alt text** — all images have alt attributes (logo, spinner, doughnut chart, background preview)
- **SVG icons** consistently marked `aria-hidden="true"`
- **Doughnut chart** — `role="img" aria-label="Current cycle task completion"` (L2646)
- **Progress bar** — `role="progressbar" aria-label="Progress to next milestone"` (L2692)
- **Listbox** — `#miniCycleList` has `role="listbox" aria-label="Routines"` (L2465)
- **aria-controls** on menu button, mode description toggle, yearly time checkbox, nav tabs
- **aria-describedby** on recurring specific dates, yearly month/day/apply checkboxes
- **Visually-hidden labels** — `class="visually-hidden"` on form labels throughout recurring settings (L1250, L1252, L1319, etc.)
- **sr-only labels** — feedback form labels use `class="sr-only"` (L2519)

### JavaScript Modules (32 files with ARIA patterns)
- **settingsUIManager.js** — GOOD: `aria-expanded` on collapsible sections, Enter/Space/Arrow keyboard handlers
- **modalManager.js** — GOOD: `aria-modal="true"` on prompt modal, `_previousFocus` stored/restored, native `<dialog>` API, Enter/Space on `role="button"` close spans
- **taskDOM.js** — GOOD: `aria-label` on checkboxes with task name, `aria-checked` synced, `aria-pressed` on delete/recurring buttons
- **taskButtons.js** — GOOD: `aria-pressed` on 5+ toggle buttons, `aria-hidden` on decorative icons, custom keydown handlers
- **menuManager.js** — GOOD: `aria-expanded` on collapsible sections, Enter/Space keyboard support
- **statsPanel.js** — GOOD: `inert` attribute on hidden panels, `aria-expanded` on collapsible headers, `tabindex` management for slide navigation
- **onboardingManager.js** — GOOD: `role="dialog"` + `aria-modal="true"` + `aria-label`, emoji `aria-hidden`
- **taskOptionsCustomizer.js** — GOOD: `aria-labelledby` references title element
- **dueDates.js** — GOOD: `aria-describedby` + `aria-label` on date inputs
- **taskCRUD.js** — GOOD: `aria-invalid="true"` on validation error
- **achievementsManager.js** — PARTIAL: `aria-label` on dialog, progress bar with `aria-valuenow/min/max`, coin spin `aria-label` + `tabindex="0"` + keydown handler
- **notifications.js** — PARTIAL: `role="radiogroup"` + `role="radio"` + `aria-checked` on frequency selector, `aria-modal="true"` on prompt, but missing arrow key nav for radios
- **recurringPanel.js** — PARTIAL: `aria-label` on date inputs, `aria-pressed` on buttons, `aria-hidden` on icons, Enter/Arrow keyboard handlers on overlay
- **routineSwitcher.js** — PARTIAL: `role="button"` + `tabindex="0"` + `aria-label` on close span, `aria-selected` on listbox items
- **cycleCompletion.js** — PARTIAL: `aria-live="assertive"` on completion/milestone animations (3 instances)

---

## P0 — Critical Issues

### 1. All 11 Dialog Elements Missing `aria-modal="true"`

**Location:** miniCycle.html — every `<dialog>` element

**Problem:** None of the 11 `<dialog>` elements in HTML have `aria-modal="true"`. While `showModal()` provides native focus trapping, `aria-modal` explicitly signals to assistive technology that the content behind is inert.

**Affected dialogs:**
- `#about-modal` (L1024), `#recurring-panel-overlay` (L1194), `#games-panel` (L1613)
- `#reminders-modal` (L1625), `#settings-modal` (L1680), `#testing-modal` (L1857)
- `#storage-viewer-overlay` (L1993), `#themes-modal` (L2010), `#preferences-modal` (L2036)
- `#routine-switcher-modal` (L2440), `#feedback-modal` (L2501)

**Note:** JS-created modals in `onboardingManager.js` and `notifications.js` DO set `aria-modal="true"` — the gap is only in the static HTML.

**Fix:** Add `aria-modal="true"` to each `<dialog>` element in miniCycle.html.

**Effort:** ~15 min

---

### 2. Toast Notifications — Verify aria-live Fires

**Location:** `modules/utils/notifications.js`, `miniCycle.html` L946

**Problem:** The `#notification-container` has `aria-live="polite" role="status"` in HTML, and a hidden `#live-region` (L2741) exists. However, the notifications component dynamically creates toast elements inside the container. Need to verify screen readers actually announce these — some implementations require text to be injected into a pre-existing aria-live region rather than appending new child elements.

**Fix:** Test with VoiceOver/NVDA. If announcements don't fire, copy notification text into `#live-region` when shown.

**Effort:** ~30 min to verify + fix if needed

---

### 3. Task List Items Missing `aria-label`

**Location:** `modules/task/taskDOM.js` — `<li>` elements created dynamically

**Problem:** Task items are created as `<li>` with `draggable="true"` and `data-task-id` but no `aria-label`. The checkbox inside has `aria-label` with the task name (L846) and `aria-checked` (L848), but the list item itself lacks a summary.

**Fix:** When creating task items, set:
```javascript
taskItem.setAttribute('aria-label', `Task: ${taskName}${isRecurring ? ' (recurring)' : ''}${isCompleted ? ' (completed)' : ''}`);
```

**Effort:** ~30 min

---

## P1 — High Priority

### 4. `role="radio"` Elements Lack Arrow Key Navigation

**Location:** `modules/utils/notifications.js:1035-1049` — quick recurring frequency options

**Problem:** Custom `<div role="radio">` elements have `tabindex="0"` and `aria-checked` but no Arrow Up/Down/Left/Right, Home, or End keyboard handlers. Only click works. All radios have `tabindex="0"` instead of roving tabindex.

**Fix:** Implement roving tabindex pattern per ARIA APG: only selected item gets `tabindex="0"`, others `tabindex="-1"`. Add Arrow key handlers to move focus and selection.

**Effort:** ~45 min

---

### 5. Preferences Collapsible Sections Missing `aria-expanded` (7 sections)

**Location:** miniCycle.html — Preferences modal section headers

**Problem:** Settings modal and menu collapsible headers correctly set `aria-expanded`, but preferences modal headers (L2096+) with `role="button" tabindex="0"` do not.

**Affected sections:** `quick-themes`, `desktop-layout`, `app-bg`, `routine-list`, `tasks`, `buttons`, `stats`

**Fix:** Add `aria-expanded="false"` to each preferences section header in HTML, and sync in the JS collapse/expand handler (`preferencesManager.js`).

**Effort:** ~30 min

---

### 6. Radio Button Groups Lack `<fieldset>` / `<legend>`

**Location:** Recurring settings panel — duration type selection (miniCycle.html L1276-1291)

**Problem:** Radio buttons for "Count" vs "Until Date" have `name="recur-duration-type"` but no wrapping `<fieldset><legend>` or `role="group"` with `aria-labelledby`. Weekly day selection (L1357) also lacks grouping structure, while yearly options (L1522, L1556) correctly use `role="group"`.

**Fix:** Wrap radio group with `<fieldset><legend class="visually-hidden">Duration type</legend>...</fieldset>` or add `role="group" aria-label="Duration type"` to the container.

**Effort:** ~15 min

---

### 7. Custom Overlays Lack Focus Trap

**Location:** `achievementsManager.js`, `clearedTasksManager.js`, `historyManager.js`

**Problem:** These modules create custom `<div>` overlays that don't use `showModal()`, so Tab can escape to background content. `clearedTasksManager.js` (L313) and `historyManager.js` (L219) also lack `aria-modal="true"`.

**Fix:** Convert to `<dialog>` with `showModal()`, or add manual focus trapping + `aria-modal="true"`.

**Effort:** ~1 hour

---

### 8. Search Inputs Missing `aria-label`

**Location:** miniCycle.html

**Problem:** Task search input (L2586) and routine search input (L2444) rely on `placeholder` text instead of `aria-label`. Placeholders disappear when typing and are not announced by all screen readers.

**Fix:** Add `aria-label="Search tasks"` and `aria-label="Search routines"` respectively.

**Effort:** ~5 min

---

## P2 — Medium Priority

### 9. Font Size Select Missing Label Association

**Location:** miniCycle.html — Accessibility settings section, `#font-size-select` (L1767)

**Problem:** The `<select>` dropdown has a preceding `<span>Font Size</span>` but no `<label for="font-size-select">` or `aria-label`.

**Fix:** Change `<span>` to `<label for="font-size-select">` or add `aria-label="Font size"` to the select.

**Effort:** ~5 min

---

### 10. Progress Bar Missing `aria-valuenow/min/max`

**Location:** `#stats-progress-bar` (miniCycle.html L2692), updated by `statsPanel.js:1026`

**Problem:** Has `role="progressbar"` and dynamically set `aria-label`, but no `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

**Note:** `achievementsManager.js` (L523) correctly implements all progress bar ARIA attributes — good pattern to follow.

**Fix:** In `statsPanel.js`, also set `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow="${currentPercent}"`.

**Effort:** ~15 min

---

### 11. Range Input Missing `aria-valuetext`

**Location:** `#pref-pattern-opacity` range slider in preferences modal (L2223)

**Problem:** Slider has `<label>` but no `aria-valuetext` showing human-readable value. Screen readers just announce the raw number.

**Fix:** Add `aria-valuetext` update on input event (e.g., `"Opacity: 28%"`).

**Effort:** ~15 min

---

### 12. Routine Switcher Listbox Missing `aria-activedescendant`

**Location:** `#miniCycleList` with `role="listbox"` (miniCycle.html L2465), managed by `routineSwitcher.js`

**Problem:** List items have `role="option"` (L1207) and `aria-selected` (L1256-1259), but the parent listbox doesn't set `aria-activedescendant`. Also lacks Arrow key navigation for the listbox pattern.

**Fix:** Set `listbox.setAttribute('aria-activedescendant', selectedItemId)` when selection changes. Add Arrow Up/Down keyboard handlers.

**Effort:** ~30 min

---

### 13. Three-Dots Button Lacks `aria-pressed`

**Location:** `modules/task/taskDOM.js` (L737) — three-dots menu button

**Problem:** Gets `aria-label` but no `aria-pressed` to indicate when the task options menu is open.

**Fix:** Toggle `aria-pressed` when menu opens/closes.

**Effort:** ~15 min

---

### 14. Reminders Modal Form Labels

**Location:** miniCycle.html L1631-1670 — reminders modal checkboxes and inputs

**Problem:** `#enableReminders`, `#dueDatesReminders`, `#browserNotifications`, `#indefiniteCheckbox` checkboxes have parent `<label>` wrappers but the label text is sometimes outside the proper association pattern. `#repeatCount` and `#frequencyValue` inputs have nearby labels but not properly linked via `for`/`id`.

**Fix:** Ensure all inputs have properly associated `<label for="...">` or `aria-label`.

**Effort:** ~20 min

---

## P3 — Low Priority / Polish

### 15. Drag-and-Drop Has No Keyboard Alternative
- Task items are `draggable="true"` but no keyboard reorder mechanism exists
- No `aria-grabbed` or `aria-dropeffect` indicators
- Complex to implement properly; consider move-up/move-down buttons as alternative

### 16. `role="button"` Spans Should Be `<button>` Elements
- `routineSwitcher.js:1108` creates `<span role="button">` for close — should be `<button>`
- About modal close (L1026) uses `<span role="button" tabindex="0">` — same issue
- `<h3>` elements with `role="button" tabindex="0"` in stats panel (L2641, L2667) — consider `<button>` inside `<h3>`
- Native `<button>` gets keyboard support for free

### 17. Color Picker Inputs Could Use `aria-describedby`
- 15+ color inputs in preferences modal have `<label>` (good) but no description of what UI aspect they control
- Low priority since labels are descriptive ("App Background", "Task Text", etc.)

### 18. Keyboard Shortcuts Not Documented Accessibly
- Ctrl/Cmd+Z for undo is implemented but not announced or documented in help text
- Consider adding to help window or onboarding

### 19. Inconsistent Screen-Reader-Only Class Names
- Some elements use `class="visually-hidden"` (recurring settings labels)
- Others use `class="sr-only"` (feedback form labels)
- Should standardize on one class name

### 20. `aria-disabled` Misuse in Quick Actions
- `quickActionsManager.js:601` sets `aria-disabled="true"` without matching disabled attribute
- Should use native `disabled` attribute or ensure both are set

### 21. Badge Elements Lack State Indication
- Achievement badges (L2680-2684) have `role="button" tabindex="0"` but no `aria-pressed` or `aria-expanded` to indicate if they reveal detail content

---

## Module Assessment Summary

| Module | Rating | Key Strengths | Gaps |
|--------|--------|---------------|------|
| settingsUIManager.js | **GOOD** | aria-expanded, Enter/Space/Arrow keys | No aria-describedby on inputs |
| modalManager.js | **GOOD** | Native dialog, focus restoration, Enter/Space on role=button | — |
| taskDOM.js | **GOOD** | aria-label/checked/pressed on checkboxes + buttons | Missing aria-label on `<li>`, aria-pressed on 3-dots |
| taskButtons.js | **GOOD** | aria-pressed on 5+ toggles, aria-hidden on icons | — |
| menuManager.js | **GOOD** | aria-expanded, keyboard handlers | — |
| statsPanel.js | **GOOD** | inert attribute, aria-expanded, tabindex management | Progress bar missing valuenow |
| onboardingManager.js | **GOOD** | aria-modal, dialog role, emoji aria-hidden | — |
| taskOptionsCustomizer.js | **GOOD** | aria-labelledby pattern | — |
| dueDates.js | **GOOD** | aria-describedby + aria-label on inputs | — |
| notifications.js | **PARTIAL** | radiogroup/radio roles, aria-checked, aria-modal on prompt | No arrow keys for radios, verify live region |
| recurringPanel.js | **PARTIAL** | aria-label, aria-pressed, keyboard handlers | Complex form needs more ARIA |
| achievementsManager.js | **PARTIAL** | Progress bar ARIA complete, coin spin keyboard | Custom overlay lacks focus trap |
| routineSwitcher.js | **PARTIAL** | aria-selected on listbox items | No arrow keys, role=button span |
| clearedTasksManager.js | **PARTIAL** | aria-label on modal | Missing aria-modal, focus trap |
| historyManager.js | **PARTIAL** | aria-label on modal | Missing aria-modal, focus trap |
| quickActionsManager.js | **PARTIAL** | aria-label on buttons | aria-disabled misused |
| reminders.js | **PARTIAL** | aria-pressed on buttons | Minimal ARIA, form labels weak |
| helpWindowManager.js | **MINIMAL** | — | No ARIA or focus management |

---

## Files Most Affected (by fix priority)

| File | Changes Needed |
|------|---------------|
| `miniCycle.html` | P0: aria-modal on 11 dialogs; P1: preferences aria-expanded, fieldset/legend, search aria-labels; P2: font-size label, reminders form labels |
| `modules/task/taskDOM.js` | P0: aria-label on task items; P2: aria-pressed on 3-dots |
| `modules/utils/notifications.js` | P0: verify aria-live; P1: radio arrow key nav |
| `modules/features/achievementsManager.js` | P1: focus trap + aria-modal |
| `modules/features/clearedTasksManager.js` | P1: focus trap + aria-modal |
| `modules/features/historyManager.js` | P1: focus trap + aria-modal |
| `modules/features/statsPanel.js` | P2: aria-valuenow/min/max |
| `modules/routine/routineSwitcher.js` | P2: aria-activedescendant + arrow keys |
| `modules/ui/preferencesManager.js` | P1: aria-expanded sync on collapse/expand |

---

## Estimated Effort

| Priority | Items | Effort |
|----------|-------|--------|
| P0 | 3 issues | ~1 hour |
| P1 | 5 issues | ~2.5 hours |
| P2 | 6 issues | ~1.5 hours |
| P3 | 7 issues | ~3 hours (drag-drop is the big one) |
| **Total** | **21 issues** | **~8 hours** |
