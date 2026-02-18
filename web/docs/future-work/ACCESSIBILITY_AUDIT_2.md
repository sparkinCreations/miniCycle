# Accessibility Audit #2 — Beyond ARIA

**Date:** February 18, 2026
**Status:** Documented — Not Started
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

## P0 — Critical (WCAG AA Non-Compliance)

### 1. Low-Contrast Text Colors (WCAG 1.4.3)

15+ instances of gray text colors that fail the 4.5:1 minimum contrast ratio against white/light backgrounds. High contrast mode corrects these, but **default mode fails WCAG AA**.

| File | Lines | Color | Contrast | Usage |
|------|-------|-------|----------|-------|
| `styles/components/menu.css` | 228 | `#b8860b` | ~1.8:1 | Menu section header text |
| `styles/layout/header.css` | 250 | `#999` | ~2.1:1 | Navigation text |
| `styles/components/recurring.css` | 189, 411 | `#999` | ~2.1:1 | Button text, labels |
| `styles/components/recurring.css` | 549 | `#aaa` | ~1.5:1 | Helper text |
| `styles/components/recurring.css` | 782, 792 | `#666` | ~3.1:1 | Section labels |
| `styles/components/routine-switcher.css` | 130, 170, 201 | `#999` | ~2.1:1 | Secondary text |
| `styles/components/routine-switcher.css` | 153, 464 | `#666` | ~3.1:1 | Routine labels |
| `styles/components/task-options.css` | 196, 506, 704 | `#666`, `#6c757d` | ~2.8–3.1:1 | Option descriptions |
| `styles/components/task-options.css` | 354 | `#999` | ~2.1:1 | Modal subtitle |
| `styles/components/storage.css` | 27, 101 | `#666` | ~3.1:1 | Metadata labels |
| `styles/components/settings.css` | 238, 285 | `#999`, `#888` | ~2.1–2.4:1 | Form labels |
| `styles/components/onboarding.css` | 154, 193 | `#888` | ~2.4:1 | Secondary text |
| `styles/components/modals.css` | 2555 | `#888` | ~2.4:1 | Modal body text |
| `styles/utilities/helpers.css` | 329 | `#aaa` | ~1.5:1 | Overlay text |

**Fix:** Replace with WCAG AA-compliant alternatives:
- `#999`/`#aaa` → `#555555` (5.8:1) or `var(--theme-text-secondary)`
- `#888` → `#555555` (5.8:1)
- `#666` → `#444444` (6.9:1)
- `#b8860b` → `#333333` or `var(--theme-text-primary)`

---

### 2. Placeholder Text Contrast (WCAG 1.4.3)

**Location:** `styles/base/variables.css:98`

Default placeholder color `--theme-input-placeholder: #767676` = 3.5:1 against white (needs 4.5:1).

**Fix:** Change to `#555555` (5.8:1) or darker.

---

### 3. Focus Indicator Gaps (WCAG 2.4.7)

12+ elements have `outline: none` without corresponding `:focus-visible` replacement, making focus invisible to keyboard users.

| File | Lines | Element |
|------|-------|---------|
| `styles/components/menu.css` | 486 | Button |
| `styles/components/mode-selector.css` | 66 | Select dropdown |
| `styles/components/routine-switcher.css` | 192, 308 | Buttons/selects |
| `styles/components/task-list.css` | 381, 455, 537, 677 | Various inputs |
| `styles/components/modals.css` | 1544, 1695 | Modal inputs/buttons |
| `styles/utilities/helpers.css` | 323 | Generic button |

**Note:** Base `:focus-visible` in `reset.css:83` provides 2px solid outline, and high contrast mode provides 3px solid `currentColor`. The issue is that these component-level `outline: none` rules **override** the base rule without providing their own.

**Fix:** Either remove `outline: none` (let base rule apply) or add component-specific `:focus-visible` with box-shadow/border alternative.

---

## P1 — High Priority

### 4. Missing Loading State Announcements (WCAG 4.1.3)

No loading overlay in the codebase uses `aria-busy`. Screen reader users get no indication that content is loading or has finished.

| Feature | Location | Issue |
|---------|----------|-------|
| App boot splash | `miniCycle.html:940-944` | No `aria-busy` |
| Cycle import | `modules/ui/cycleImportManager.js` | No loading announcement |
| Backup restore | `modules/ui/backupRestoreManager.js` | No loading announcement |
| Stats panel "Loading..." | `modules/features/statsPanel.js` | Visual text only |
| UI boot loader | `modules/boot/uiBoot.js` | `showLoader()` has no `aria-busy` |

**Fix:** Set `aria-busy="true"` on loading container when loading starts, `aria-busy="false"` on complete.

---

### 5. Achievement Unlock Hardcoded String

**Location:** `modules/features/achievementsManager.js:128`

Uses hardcoded `'Achievement Unlocked: ${milestone.name}!'` instead of `getLabel()`. Bypasses label system.

**Fix:** Add label key to `defaultLabels.js` and use `getLabel('notify.achievementUnlocked', { vars: { name: milestone.name } })`.

---

### 6. Completion/Clear Animation Emojis Not Hidden

**Location:** `modules/progress/cycleCompletion.js:106, 128`

The ✔ and 🧹 emojis in completion/clear animations are set via `innerHTML` without `aria-hidden="true"`, so screen readers will read them.

**Fix:** Wrap in `<span aria-hidden="true">✔</span>` and `<span aria-hidden="true">🧹</span>`.

---

### 7. Timing-Dependent Focus Restoration in Achievements

**Location:** `modules/features/achievementsManager.js:320-327`

Focus restoration uses `setTimeout(ANIMATION_DURATION)` which could fail if the element is removed before the timeout fires.

**Fix:** Restore focus in the dialog `close` event listener or use `requestAnimationFrame` instead.

---

## P2 — Medium Priority

### 8. Task Reorder Success Not Announced

**Location:** `modules/task/taskCompletion.js:257`

When tasks are reordered (via drag-and-drop or move buttons), only errors are announced. Success reorder is silent for screen reader users.

**Fix:** Add success notification or live region update after reorder completes.

---

### 9. Due Date Visibility Not Announced

**Location:** `modules/task/taskEvents.js:296`

When the due date input is shown/hidden (toggling `.hidden` class), there's no screen reader announcement.

**Fix:** Update task `aria-label` to include due date state, or announce via live region.

---

### 10. Delete-When-Complete Indicator Has No SR Equivalent

**Location:** `modules/task/taskDOM.js:1119-1131`

The visual indicator (`.show-delete-indicator`, `.kept-task` classes) has no screen reader equivalent. SR users don't know a task is marked for deletion on complete.

**Fix:** Add `aria-describedby` or update task `aria-label` when delete-when-complete is active.

---

### 11. Milestone Emojis Embedded in Label Text

**Location:** `modules/progress/cycleCompletion.js:161`

Milestone messages include 🎉 and 🚀 directly in the label text. Screen readers will attempt to read them.

**Fix:** Separate emojis from label text: `<span aria-hidden="true">🎉</span> ${getLabel(...)}`

---

### 12. Opacity-Based Text Fading

Low opacity on text content reduces effective contrast:

| File | Lines | Element | Opacity | Issue |
|------|-------|---------|---------|-------|
| `styles/base/accessibility.css` | 149-154 | Footer copyright/cache text | 0.65-0.75 | ~2.3:1 effective |
| `styles/components/quick-actions.css` | 97, 374, 405 | Quick action labels | 0.35-0.5 | Very low |
| `styles/components/task-list.css` | 235 | Empty state hint | 0.5 | Theme-dependent |
| `styles/components/menu.css` | 373, 381 | Menu toggle, mode badge | 0.5 | Reduced recognizability |

**Fix:** Raise minimum opacity on text-carrying elements to 0.85+ or use solid colors.

---

## P3 — Low Priority / Polish

### 13. Link/Button Visual Distinction (WCAG 1.4.1)

Some interactive elements use color alone to distinguish from non-interactive text. Missing `text-decoration: underline` on hover for link-styled elements.

---

### 14. Touch Target Sizes (WCAG 2.5.5 Enhanced)

Some icon buttons are 18-20px, below the WCAG 2.5.5 enhanced guideline of 44px (but above the 2.5.8 minimum of 24px). Consider adding padding to increase touch targets.

---

### 15. helpWindowManager.js Has No ARIA or Focus Management

Rated MINIMAL in ARIA audit. No focus trapping, no `_previousFocus` restoration, no ARIA attributes.

---

### 16. Games Manager & Onboarding Focus Restoration Unverified

`gamesManager.js` and `onboardingManager.js` were not confirmed to implement `_previousFocus` capture/restore pattern.

---

### 17. Recurring Task Match Not Announced

**Location:** `modules/recurring/recurringWatcher.js`

When a recurring task is automatically added to the task list, there's no screen reader announcement.

---

## Files Most Affected

| File | Changes |
|------|---------|
| 10+ CSS component files | P0: Replace low-contrast grays with AA-compliant colors |
| `styles/base/variables.css` | P0: Fix placeholder color |
| 6+ CSS component files | P0: Fix outline:none without focus-visible |
| `modules/features/achievementsManager.js` | P1: Fix hardcoded string + focus restoration timing |
| `modules/progress/cycleCompletion.js` | P1: aria-hidden on emojis; P2: separate emojis from labels |
| `modules/boot/uiBoot.js` | P1: Add aria-busy to loader |
| `modules/task/taskCompletion.js` | P2: Reorder success announcement |
| `modules/task/taskEvents.js` | P2: Due date visibility announcement |
| `modules/task/taskDOM.js` | P2: Delete-when-complete SR support |

---

## Estimated Effort

| Priority | Items | Effort |
|----------|-------|--------|
| P0 | 3 issues | ~2 hours (color replacements are mechanical) |
| P1 | 4 issues | ~1.5 hours |
| P2 | 5 issues | ~1.5 hours |
| P3 | 5 issues | ~2 hours |
| **Total** | **17 issues** | **~7 hours** |

---

## WCAG 2.1 Compliance Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | PASS | All images have alt text, decorative SVGs hidden |
| 1.3.1 Info and Relationships | PASS | Proper headings, landmarks, labels, ARIA |
| 1.3.2 Meaningful Sequence | PASS | DOM order matches visual order |
| 1.4.1 Use of Color | PARTIAL | Some links use color-only distinction |
| 1.4.3 Contrast (Minimum) | **FAIL** | 15+ low-contrast text instances |
| 1.4.11 Non-text Contrast | PASS | Borders, buttons, icons meet 3:1 |
| 2.1.1 Keyboard | PASS | All interactions keyboard-accessible |
| 2.4.1 Bypass Blocks | PASS | Skip-to-content link works |
| 2.4.3 Focus Order | PASS | No positive tabindex values |
| 2.4.6 Headings and Labels | PASS | Proper hierarchy, no skipped levels |
| 2.4.7 Focus Visible | PARTIAL | 12+ elements missing focus indicators |
| 2.5.5 Target Size (Enhanced) | PARTIAL | Some buttons below 44px |
| 3.3.1 Error Identification | PASS | Errors use role="alert" |
| 4.1.2 Name, Role, Value | PASS | All resolved in ARIA audit |
| 4.1.3 Status Messages | PARTIAL | Loading states not announced |
