# Accessibility & ARIA Audit #3 — Comprehensive

**Date:** February 19, 2026
**Status:** ALL RESOLVED (P0 + P1 + P2 + P3)
**Scope:** Full accessibility + ARIA re-audit — focus management, color contrast, keyboard navigation, screen reader announcements, semantic HTML, form accessibility, WCAG compliance
**Prerequisites:** ARIA Audit (Feb 17) — ALL 21 resolved; Accessibility Audit #2 (Feb 18) — ALL 17 resolved
**Breaking Changes:** None expected

---

## Summary

Third comprehensive accessibility audit of miniCycle, covering ARIA correctness, keyboard operability, screen reader compatibility, visual accessibility, and form handling. The codebase has **strong accessibility foundations** — native `<dialog>` focus trapping, proper `inert` toggling, `prefers-reduced-motion` support, high contrast mode, 565+ label keys, and 7+ aria-live regions.

**12 real issues found** across P0–P3 priorities. Many initial findings from automated scanning were **false alarms** after code verification (9 dismissed).

---

## What's Already Done Well

- **Native `<dialog>` API** — all 11 modals use `showModal()` for automatic focus trapping
- **Focus restoration** — 8+ modal managers use `_previousFocus` capture/restore pattern
- **`inert` toggling** — statsPanel.js correctly toggles `inert` on stats/task panels AND slide arrow `tabIndex` when switching views
- **Skip-to-content link** — properly hidden, visible on focus, targets `#app-container`
- **Heading hierarchy** — H2→H3→H4, no skipped levels across 24 headings
- **Landmark structure** — header, nav (2, differentiated), main, section, footer all present
- **Keyboard equivalents** — all mouse-hover interactions paired with focus/blur handlers; collapsible sections have Enter/Space handlers
- **No positive tabindex** — natural tab order preserved everywhere
- **Notification timeouts** — pause on hover AND focus; resume only when both clear
- **Error announcements** — all errors use `role="alert"` (implicit assertive); success/info use `role="status"` (polite)
- **Emoji handling** — 90%+ decorative emojis marked `aria-hidden="true"`
- **Language attribute** — `<html lang="en">` present
- **Reduced motion** — CSS variables auto-disable animations via `@media (prefers-reduced-motion: reduce)` in variables.css
- **High contrast** — comprehensive overrides (1,160+ lines) for light + dark mode
- **aria-expanded** — properly toggled on all collapsible sections, menus, and disclosure buttons
- **aria-pressed** — correctly set on toggle buttons (delete-when-complete, etc.)
- **aria-checked** — synced with checkbox state on task completion
- **Form labels** — most inputs have `<label>`, `aria-label`, or `aria-labelledby`; recurring checkboxes properly wrapped in `<label>` elements
- **Task edit input** — already has `aria-label="Edit task name"` (taskCRUD.js:339)
- **Icon-only buttons** — all have `aria-label` (menu, quick-actions, personalization, dark toggle, search, close buttons)
- **Live region announcements** — view changes via `announceViewChange()`, task moves via live region, cycle completion announced

---

## False Alarms Dismissed (9)

| Finding | Why Dismissed |
|---------|--------------|
| Stats panel `inert` not toggled | statsPanel.js:774/811/852 correctly toggles `inert` on show/hide |
| Slide-left arrow `tabindex="-1"` | Intentional — hidden at load; JS sets `tabIndex = 0` when stats shown (statsPanel.js:823) |
| Recurring checkboxes missing labels | Wrapped in `<label>` elements (HTML lines 1241-1244, 1441-1444) |
| Task edit input missing `aria-label` | Already has `aria-label="Edit task name"` (taskCRUD.js:339) |
| Warning notification contrast failure | Black (#000) on yellow (#ffc107) = ~15.8:1 ratio — passes easily |
| Dark mode placeholder too light | Already fixed to `#555555` in Accessibility Audit #2 |
| Reduced motion "0% complete" | variables.css:282-309 has comprehensive `@media (prefers-reduced-motion)` |
| No keyboard for task completion | Checkboxes are native `<input type="checkbox">` — Space key works natively |
| Focus-visible indicators missing | 50+ `:focus-visible` CSS rules; global rule in reset.css:83-95 |

---

## P0 — Critical (ALL RESOLVED)

### 1. ~~Recurring Day Boxes Missing ARIA + Keyboard Support~~ FIXED

**Location:** `miniCycle.html:1359-1416` (21 bare `<div>` elements)

**Issue:** Weekly and biweekly day selection boxes were bare `<div>` elements with no accessibility attributes:
```html
<div class="weekly-day-box" data-day="Sun">Sun</div>
<div class="biweekly-day-box" data-day="Mon" data-week="1">Mon</div>
```

**Missing:**
- `role="button"` or `role="checkbox"`
- `tabindex="0"` for keyboard focus
- `aria-pressed` or `aria-checked` for selection state
- `aria-label` for screen reader context
- Keyboard handlers (Enter/Space to toggle, Arrow keys to navigate)

**Impact:** Keyboard-only users **cannot** set recurring task days. Screen readers cannot announce day selection state.

**WCAG:** 2.1.1 Keyboard (Level A), 4.1.2 Name/Role/Value (Level A)

**Fixed:**
- Added `role="checkbox"`, `tabindex="0"`, `aria-checked="false"` to all 21 weekly + 14 biweekly day boxes in HTML
- Added `role="group"` with `aria-label` to biweekly-days and monthly-days containers
- Added same ARIA attributes to dynamically created monthly (31) and yearly day boxes in `recurringPanelGrids.js`
- Added same ARIA attributes to dynamically created yearly month boxes
- Added Enter/Space keyboard handlers via event delegation in `recurringPanelEvents.js` (weekly, monthly, yearly month, yearly day)
- Added Enter/Space keyboard handlers to biweekly per-element listeners in `recurringPanel.js`
- All handlers sync `aria-checked` with the `.selected` class toggle

---

### 2. ~~Task Input Missing Label~~ FIXED

**Location:** `miniCycle.html:2568`

**Issue:** The main task input had no associated `<label>` element and no `aria-label`:
```html
<input type="text" id="taskInput" name="taskInput" class="taskInput"
       placeholder="Enter a task..." title="Type a task and press Add or Enter" tabindex="-1">
```

`placeholder` is NOT a label substitute. `title` provides a tooltip but is not reliably announced by all screen readers.

**WCAG:** 1.3.1 Info and Relationships (Level A), 3.3.2 Labels or Instructions (Level A)

**Fixed:** Added `<label for="taskInput" class="visually-hidden">Add a new task</label>` before the input element.

---

## P1 — High Priority (ALL RESOLVED)

### 3. ~~Milestone Badges Missing aria-label~~ FIXED

**Location:** `miniCycle.html:2680-2684`

**Issue:** 5 milestone badges have `role="button"` and `aria-haspopup="dialog"` but no `aria-label`. Screen readers only read the emoji text content:
```html
<div class="badge" data-milestone="5" tabindex="0" role="button" aria-haspopup="dialog">🌊</div>
<div class="badge" data-milestone="25" tabindex="0" role="button" aria-haspopup="dialog">💎</div>
<div class="badge" data-milestone="50" tabindex="0" role="button" aria-haspopup="dialog">🌞</div>
<div class="badge" data-milestone="75" tabindex="0" role="button" aria-haspopup="dialog">💫</div>
<div class="badge" data-milestone="100" tabindex="0" role="button" aria-haspopup="dialog">👑</div>
```

**WCAG:** 1.1.1 Non-text Content (Level A), 4.1.2 Name/Role/Value (Level A)

**Fixed:** Added `aria-label="N cycles milestone"` to all 5 badges (5, 25, 50, 75, 100).

---

### 4. ~~Modal-Content Links Missing Default Underline~~ FIXED

**Location:** `styles/components/modals.css:128-136`

**Issue:** Links inside `.modal-content` were styled with color-only distinction — no underline by default.

**Fixed:** Changed `.modal-content a` from `text-decoration: none` to `text-decoration: underline`. Added `:focus-visible` underline rule alongside `:hover`.

---

### 5. ~~Routine Name Edit Input Missing aria-label~~ FIXED

**Location:** `modules/routine/routineSwitcher.js:558-561`

**Fixed:** Added `input.setAttribute('aria-label', getLabel('accessibility.editRoutineName'))`. Label key added to `defaultLabels.js`.

---

### 6. ~~Preset Name Edit Input Missing aria-label~~ FIXED

**Location:** `modules/ui/preferencesPresets.js:637-640`

**Issue:** Inline edit input for preset names has no `aria-label`:
```javascript
const input = document.createElement('input');
input.type = 'text';
input.className = 'preferences-preset-name-input';
input.value = currentName;
// ← No aria-label
```

**Fixed:** Added `input.setAttribute('aria-label', getLabel('accessibility.editPresetName'))`. Label key added to `defaultLabels.js`.

---

## P2 — Medium Priority (ALL RESOLVED)

### 7. ~~Task Addition Not Announced via Live Region~~ FIXED

**Location:** `modules/task/taskCRUD.js` — `addTaskImpl()`

**Issue:** When a task was successfully added, no live region announcement was made.

**Fixed:** Added `#live-region` update after successful task creation (skipped during bulk loading via `isLoading` check). Uses `getLabel('accessibility.taskAdded', { vars: { name: validatedInput } })`.

---

### 8. ~~`announceViewChange()` Uses Hardcoded Strings~~ FIXED

**Location:** `modules/features/statsPanel.js:791, 828`

**Fixed:** Changed to use `getLabel('accessibility.taskViewOpened')` and `getLabel('accessibility.statsPanelOpened')`. Three new label keys added to `defaultLabels.js`.

---

### 9. ~~AM/PM Select Missing Label~~ FIXED

**Location:** `miniCycle.html` — 5 meridiem selects

**Issue:** 5 of 6 `<select>` elements for AM/PM had no label (only `yearly-meridiem` had `aria-label`).

**Fixed:** Added `aria-label="AM or PM"` to all 5 unlabeled selects: `specific-date-meridiem`, `daily-meridiem`, `weekly-meridiem`, `biweekly-meridiem`, `monthly-meridiem`.

---

### 10. ~~Smooth Scrolling Not Reduced-Motion Wrapped~~ FIXED

**Location:** `styles/base/reset.css:67-70`

**Fixed:** Moved `scroll-behavior: smooth` inside `@media (prefers-reduced-motion: no-preference)` block. Base `.scrollable` rule now only has `-webkit-overflow-scrolling: touch`.

---

## P3 — Low Priority / Polish (ALL RESOLVED)

### 11. ~~No H1 Heading on Page~~ FIXED

**Fixed:** Added `<h1 class="visually-hidden">miniCycle Routine Manager</h1>` inside `<header>`, before the logo/branding content.

---

### 12. ~~Milestone Badges Missing aria-expanded~~ FIXED

**Location:** `miniCycle.html:2680-2684`, `modules/features/achievementsManager.js`

**Fixed:**
- Added `aria-expanded="false"` to all 5 badges in HTML
- Toggle `aria-expanded="true"` on the triggering badge in `showBadgeDetail()`
- Reset all badges to `aria-expanded="false"` in `hideBadgeDetail()`

---

## Files Modified

| File | Changes |
|------|---------|
| `miniCycle.html` | P0: day box ARIA (role, tabindex, aria-checked) on 21 weekly + 14 biweekly divs; role="group" on biweekly + monthly containers; P0: visually-hidden label for taskInput; P1: aria-label on 5 badges; P2: aria-label on 5 meridiem selects; P3: visually-hidden H1; P3: aria-expanded on 5 badges |
| `modules/recurring/recurringPanelEvents.js` | P0: keyboard handlers (Enter/Space) + aria-checked toggle for weekly, monthly, yearly month, yearly day boxes |
| `modules/recurring/recurringPanelGrids.js` | P0: ARIA attributes on dynamically created monthly day boxes, yearly month boxes, yearly day boxes |
| `modules/recurring/recurringPanel.js` | P0: keyboard handler + aria-checked toggle for biweekly day boxes |
| `styles/components/modals.css` | P1: modal-content link text-decoration: underline + :focus-visible |
| `modules/routine/routineSwitcher.js` | P1: aria-label via getLabel() on routine name edit input |
| `modules/ui/preferencesPresets.js` | P1: aria-label via getLabel() on preset name edit input |
| `modules/task/taskCRUD.js` | P2: live region announcement on task add |
| `modules/features/statsPanel.js` | P2: getLabel() for view change announcements |
| `styles/base/reset.css` | P2: reduced-motion wrap for smooth scrolling |
| `modules/features/achievementsManager.js` | P3: aria-expanded toggle on badge popup open/close |
| `modules/labels/defaultLabels.js` | P1+P2: 5 new label keys |

---

## Resolution Summary

| Priority | Items | Fixed | False Alarm/Won't Fix | Already OK |
|----------|-------|-------|----------------------|------------|
| P0 | 2 | 2 | — | — |
| P1 | 4 | 4 | — | — |
| P2 | 4 | 4 | — | — |
| P3 | 2 | 2 | — | — |
| **Total** | **12** | **12** | **0** | **0** |

**False alarms dismissed during verification:** 9 (see table above)
