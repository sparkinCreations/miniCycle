# Accessibility Audit #2 — Beyond ARIA

**Date:** February 18, 2026
**Status:** ALL RESOLVED (P0 + P1 + P2 + P3)
**Scope:** Focus management, color contrast, keyboard navigation, screen reader announcements, WCAG compliance
**Prerequisite:** ARIA Audit (Feb 17) — ALL 21 issues resolved
**Breaking Changes:** None expected (CSS color changes, ARIA additions)

---

## Summary

Comprehensive post-ARIA accessibility audit of miniCycle. The codebase has **strong foundational accessibility** — native `<dialog>` focus trapping, `prefers-reduced-motion` support, high contrast mode, font size customization, 7+ aria-live regions, and 565+ label keys. Gaps exist primarily in **default-mode text contrast** (15+ low-contrast grays), **missing focus-visible indicators** (12+ outline removals without replacement), and **screen reader announcement gaps** for dynamic operations.

---

## What's Already Done Well

- **Native `<dialog>` API** — all 11 modals use `showModal()` for automatic focus trapping
- **Focus restoration** — 8+ modal managers use `_previousFocus` capture/restore pattern
- **Skip-to-content link** — properly hidden, visible on focus, targets `#app-container`
- **Heading hierarchy** — no skipped levels across 21 headings
- **Landmark structure** — header, nav (2, differentiated), main, section, footer all present
- **Keyboard equivalents** — all mouse-hover interactions paired with focus/blur handlers
- **No positive tabindex** — natural tab order preserved everywhere
- **`inert` attribute** — properly used on hidden panels (stats panel)
- **Notification timeouts** — pause on hover AND focus; resume only when both clear
- **Error announcements** — all errors use `role="alert"` (implicit assertive)
- **Emoji handling** — 90%+ decorative emojis marked `aria-hidden="true"`
- **Language attribute** — `<html lang="en">` present
- **No data tables** — no table accessibility concerns
- **Reduced motion** — CSS variables auto-disable animations; JS checks respected
- **High contrast** — comprehensive overrides for light + dark mode

---

## P0 — Critical (ALL RESOLVED)

### 1. ~~Low-Contrast Text Colors (WCAG 1.4.3)~~ FIXED (4 real / 11 false alarms)

Verification found most items were false alarms (icon colors, already-passing values, placeholders, dark-mode-on-dark-bg). **4 real failures** fixed:

| File | Line | Was | Now | Issue |
|------|------|-----|-----|-------|
| `styles/layout/header.css` | 250 | `#999` | `#ccc` | Dark mode subtitle (~3.5:1 on dark bg → ~10:1) |
| `styles/components/storage.css` | 101 | `#888` | `#555` | Bar text on light bg (~3.5:1 → 5.8:1) |
| `styles/components/onboarding.css` | 154 | `#888` | `#555` | Skip button text (~3.5:1 → 5.8:1) |
| `styles/components/modals.css` | 2555 | `#888` | `#555` | Welcome message text (~3.5:1 → 5.8:1) |

False alarms from initial audit: menu.css:228 (icon color, not text), recurring.css:189/411 (icon colors), recurring.css:549 (placeholder), recurring.css:782/792 (#666 at ~4.5:1 borderline pass), routine-switcher.css:130 (placeholder), routine-switcher.css:153/170/201/464 (#555/#666 already passing), task-options.css:196 (icon), task-options.css:506/704 (#6c757d at ~4.6:1 pass), settings.css:238 (#555 already passing), helpers.css:329 (background decoration, not text).

---

### 2. ~~Placeholder Text Contrast (WCAG 1.4.3)~~ FIXED

**Location:** `styles/base/variables.css:98`

Changed `--theme-input-placeholder` from `#767676` (3.5:1) to `#555555` (5.8:1).

---

### 3. ~~Focus Indicator Gaps (WCAG 2.4.7)~~ FIXED (3 real / 8 false alarms)

Verification found most items use the correct `:focus`/`:focus:not(:focus-visible)` pattern where the base `:focus-visible` rule from `reset.css` still applies. **3 real gaps** fixed:

| File | Line | Element | Fix |
|------|------|---------|-----|
| `styles/components/task-list.css` | 537 | Checkbox | Added `:focus-visible` with border + box-shadow |
| `styles/components/modals.css` | 1544 | Preset name input | Added `:focus-visible` with box-shadow |
| `styles/components/modals.css` | 1695 | Range slider | Added `:focus-visible` with outline |

False alarms: menu.css:486 (has `:focus-visible` replacement), mode-selector.css:66 (has `:focus-visible` box-shadow), routine-switcher.css:192/308 (has `:focus` + `:focus-visible`), task-list.css:381 (has `:focus`), task-list.css:455 (has `:focus-visible`), task-list.css:677 (has border + box-shadow), helpers.css:323 (has inset `:focus-visible`).

---

## P1 — High Priority (ALL RESOLVED)

### 4. ~~Missing Loading State Announcements (WCAG 4.1.3)~~ FIXED

Added `aria-busy="true"` to `showLoader()` and `aria-busy="false"` to `hideLoader()` in `modules/boot/uiBoot.js`. The `withLoader()` wrapper automatically manages this via show/hide.

---

### 5. ~~Achievement Unlock Hardcoded String~~ FIXED

**Location:** `modules/features/achievementsManager.js:128`

- Added `notify.achievementUnlocked: 'Achievement Unlocked: {name}!'` to `defaultLabels.js`
- Added validation entry `notify.achievementUnlocked`
- Changed to `getLabel('notify.achievementUnlocked', { vars: { name: milestone.name } })`

---

### 6. ~~Completion/Clear Animation Emojis Not Hidden~~ FIXED

**Location:** `modules/progress/cycleCompletion.js:106, 128`

- Wrapped ✔ in `<span aria-hidden="true">✔</span>`
- Wrapped 🧹 in `<span aria-hidden="true">🧹</span>`
- Live region announcements via `getLabel()` remain unaffected (they use `textContent`, not `innerHTML`)

---

### 7. ~~Timing-Dependent Focus Restoration in Achievements~~ FIXED

**Location:** `modules/features/achievementsManager.js:320-327`

Moved `previousFocus?.focus({ focusVisible: false })` to execute **before** the `setTimeout` removal, eliminating the timing dependency. Focus is restored immediately while the fade-out animation runs.

---

## P2 — Medium Priority (ALL RESOLVED)

### 8. ~~Task Reorder Success Not Announced~~ FIXED

**Location:** `modules/task/dragDropManager.js` — `handleArrowClick()`

Added live region announcement after successful move-up/move-down. Uses `accessibility.taskMovedUp` / `accessibility.taskMovedDown` label keys via `#live-region`.

---

### 9. ~~Due Date Visibility Not Announced~~ FIXED

**Location:** `modules/task/taskButtons.js`, `modules/task/taskEvents.js`

- Added `aria-expanded="false"` to set-due-date button on creation in `setupButtonAriaStates()`
- Toggle `aria-expanded` when due date input visibility changes in `taskEvents.js`

---

### 10. ~~Delete-When-Complete Indicator Has No SR Equivalent~~ FALSE ALARM

The delete button already has `aria-pressed` (set at taskDOM.js:1032, 1121) which IS the screen reader equivalent. The CSS visual indicators (`show-delete-indicator`, `kept-task`) are supplementary visual cues. Screen readers get the state via the button's `aria-pressed` attribute.

---

### 11. ~~Milestone Emojis Embedded in Label Text~~ FIXED

**Location:** `modules/progress/cycleCompletion.js:161`

Changed from `textContent` with embedded emojis to DOM-constructed content with `aria-hidden="true"` spans wrapping 🎉 and 🚀. Used `document.createTextNode()` for the label text to prevent XSS from user-supplied routine names.

---

### 12. ~~Opacity-Based Text Fading~~ FALSE ALARM

Verification found all flagged items are WCAG exempt or non-text:
- quick-actions.css:97 — empty slot placeholder (decorative)
- quick-actions.css:405 — disabled element (WCAG exempt)
- task-list.css:235 — completed task dropdown buttons (secondary/muted UI)
- menu.css:373 — element with `display: none` (hidden)
- menu.css:381 — small badge indicator (decorative)

---

## P3 — Low Priority / Polish (ALL RESOLVED)

### 13. ~~Link/Button Visual Distinction (WCAG 1.4.1)~~ FIXED

Added `:hover` and `:focus-visible` underlines to:
- `.about-links a` and `.about-footer a` in `modals.css` (about modal links)
- `.footer-item a` and `.footer-item button` in `footer.css` (footer links — had hover but no `:focus-visible`)

---

### 14. ~~Touch Target Sizes (WCAG 2.5.5 Enhanced)~~ WON'T FIX

All buttons are above the WCAG 2.5.8 minimum (24px, AA level). The 44px target is WCAG 2.5.5 Enhanced (AAA level) — not required for AA compliance.

---

### 15. ~~helpWindowManager.js Has No ARIA~~ FIXED

The help window is an informational status panel (not a modal). Added `role="status"` and `aria-label="Help information"` to the `#help-window` element in HTML. `role="status"` implicitly provides `aria-live="polite"`, so content updates will be announced to screen readers.

---

### 16. ~~Games Manager & Onboarding Focus Restoration Unverified~~ VERIFIED OK

- **gamesManager.js** — Already has proper focus management: stores `_previousFocus = document.activeElement` before `showModal()`, restores on close and outside-click
- **onboardingManager.js** — Has ARIA (`role="dialog"`, `aria-modal="true"`, `aria-label`). No `_previousFocus` but not needed — after completion, flow proceeds to either cycle creation modal (which manages its own focus) or `completeInitialSetup`

---

### 17. ~~Recurring Task Match Not Announced~~ WON'T FIX

Missed recurring tasks ARE announced via `showNotification()` ("Added N missed recurring tasks") which uses `role="status"`. Regular daily spawning is silent by design — announcing every recurring task spawn would be spammy for users with many recurring tasks.

---

## Files Modified

| File | Changes |
|------|---------|
| `styles/layout/header.css` | P0: #999 → #ccc (dark mode subtitle) |
| `styles/components/storage.css` | P0: #888 → #555 (bar text) |
| `styles/components/onboarding.css` | P0: #888 → #555 (skip button) |
| `styles/components/modals.css` | P0: #888 → #555 (welcome msg); P0: focus-visible on preset input + range; P3: link underlines |
| `styles/base/variables.css` | P0: placeholder #767676 → #555555 |
| `styles/components/task-list.css` | P0: focus-visible on checkbox |
| `styles/components/footer.css` | P3: focus-visible underline on footer links |
| `modules/features/achievementsManager.js` | P1: getLabel() for unlock notification + focus restoration timing |
| `modules/progress/cycleCompletion.js` | P1: aria-hidden on ✔/🧹 emojis; P2: milestone emojis separated |
| `modules/boot/uiBoot.js` | P1: aria-busy on loader show/hide |
| `modules/labels/defaultLabels.js` | P1+P2: 3 new label keys |
| `modules/task/dragDropManager.js` | P2: live region announcement after move |
| `modules/task/taskButtons.js` | P2: aria-expanded on due date button |
| `modules/task/taskEvents.js` | P2: aria-expanded toggle on due date |
| `miniCycle.html` | P3: role="status" + aria-label on help window |

---

## Resolution Summary

| Priority | Items | Fixed | False Alarm/Won't Fix | Already OK |
|----------|-------|-------|----------------------|------------|
| P0 | 3 | 3 (7 real sub-issues) | 0 (19 false alarms in sub-issues) | 0 |
| P1 | 4 | 4 | 0 | 0 |
| P2 | 5 | 3 | 2 (#10 delete-when-complete, #12 opacity) | 0 |
| P3 | 5 | 2 | 2 (#14 touch targets, #17 recurring) | 1 (#16 games/onboarding) |
| **Total** | **17** | **12** | **4** | **1** |

---

## WCAG 2.1 Compliance Summary (Post-Fix)

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | PASS | All images have alt text, decorative SVGs/emojis hidden |
| 1.3.1 Info and Relationships | PASS | Proper headings, landmarks, labels, ARIA |
| 1.3.2 Meaningful Sequence | PASS | DOM order matches visual order |
| 1.4.1 Use of Color | PASS | Links now have underline on hover/focus |
| 1.4.3 Contrast (Minimum) | PASS | Low-contrast grays fixed; placeholder darkened |
| 1.4.11 Non-text Contrast | PASS | Borders, buttons, icons meet 3:1 |
| 2.1.1 Keyboard | PASS | All interactions keyboard-accessible |
| 2.4.1 Bypass Blocks | PASS | Skip-to-content link works |
| 2.4.3 Focus Order | PASS | No positive tabindex values |
| 2.4.6 Headings and Labels | PASS | Proper hierarchy, no skipped levels |
| 2.4.7 Focus Visible | PASS | Focus-visible added to checkbox, preset input, range slider |
| 2.5.8 Target Size (Minimum) | PASS | All targets above 24px AA minimum |
| 3.3.1 Error Identification | PASS | Errors use role="alert" |
| 4.1.2 Name, Role, Value | PASS | All resolved in ARIA audit |
| 4.1.3 Status Messages | PASS | aria-busy on loader; move/completion/clear announced |
