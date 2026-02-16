# Accessibility Settings Section

**Date:** February 16, 2026
**Status:** Phase 1 Complete — Core features implemented, refinement remaining
**Priority:** Enhancement
**Breaking Changes:** None (new settings default to disabled/default values, no migration needed)

---

## Summary

Added a dedicated "Accessibility" collapsible section to the Settings modal with five controls: two existing toggles moved from the Display section, and three new features (Reduced Motion, High Contrast, Font Size). Comprehensive high contrast CSS overrides cover every modal, the main menu, task list, and all major UI elements in both light and dark mode.

---

## What Was Completed (Phase 1)

### New Settings Section
- [x] Accessibility collapsible section added between Display and Behavior in Settings modal
- [x] Moved "Show Move Arrows" toggle from Display section
- [x] Moved "Show Three Dots Menu" toggle from Display section
- [x] New "Reduced Motion" toggle
- [x] New "High Contrast" toggle
- [x] New "Font Size" select dropdown (Small 14px / Default 16px / Large 18px / Extra Large 20px)

### State & Persistence
- [x] Three new state properties: `settings.reducedMotion`, `settings.highContrast`, `settings.fontSize`
- [x] No migration needed — `|| false` / `|| '16'` handles undefined
- [x] Settings persist across page reload via AppState
- [x] Early-boot inline script prevents flash (applies classes before body renders)
- [x] Settings apply on boot (`appInit.js`) and on routine switch (`routineLoader.js`)

### Reduced Motion
- [x] Toggles `body.reduced-motion` and `html.reduced-motion` classes
- [x] CSS zeroes all transition/animation timing variables (`variables.css`)
- [x] Early-boot script prevents animation flash on page load
- [x] Mirrors the `@media (prefers-reduced-motion: reduce)` block for manual override

### High Contrast — Comprehensive CSS (1,162 lines in `accessibility.css`)
- [x] **Variable overrides** — text muted/secondary/placeholder colors, border colors, background opacity, progress bar, completed task colors (both light and dark mode)
- [x] **Task list** — 2px borders, checkbox borders, completed task opacity, empty state text
- [x] **Settings** — section borders, toggle sliders, buttons
- [x] **Main menu** — container border, section borders/backgrounds, button borders, date/header text, mode description, section toggles, close button
- [x] **About modal** — border, opaque background, tagline/description/footer opacity boosted, version badge border, links section border, footer separator
- [x] **Routine Switcher modal** — content border, title separator, list border, item dividers, search input, sort/filter controls, size badge, preview window, action buttons, switcher button
- [x] **Themes modal** — content border, header border, radio option borders, checked state, radio inputs, dark mode section, custom checkbox
- [x] **Personalization modal** — content border, header border, theme notice, color rows, color picker, range slider, reset buttons, footer, undo/reset-all buttons, preview label
- [x] **Feedback modal** — content border, paragraph opacity, textarea/email input borders
- [x] **Reminders modal** — content border, close button color, frequency section border
- [x] **Games modal** — content border, game card borders, description text, button borders, disabled state
- [x] **Storage modal** — box border, header/footer dividers, confirm button
- [x] **Settings modal** — content border
- [x] **Recurring panel** — panel border
- [x] **Mini modal box** — generic small modal border
- [x] **Notifications** — close button, quick option buttons
- [x] **Progress bar** — track visibility, border
- [x] **Task options** — button borders, option items, section headers
- [x] **Forms** — input placeholders, mode selector border
- [x] **Focus indicators** — 3px solid currentColor on all `:focus-visible`
- [x] **Disabled states** — opacity 0.5→0.65

### Font Size
- [x] Select dropdown with 4 options (14/16/18/20px)
- [x] Sets `--font-size-base` CSS custom property on `:root`
- [x] All font size variables (`--font-size-xs` through `--font-size-3xl`) derive from base via `calc()`
- [x] Key content areas converted from hardcoded px to CSS variables:
  - `task-list.css`: `.task-text`, `.task-edit-input`, `.empty-state-text`, `.empty-state-hint`, `.completed-tasks-header`
  - `task-input.css`: `input[type="text"]`, `#taskInput`
  - `settings.css`: `.settings-option`, `.settings-btn`, `.settings-section-header`
  - `forms.css`: `.time-picker-group`, `.input-group label`
  - `accessibility.css`: `.settings-select`

### Infrastructure
- [x] `constants.js` — `TOGGLE_REDUCED_MOTION`, `TOGGLE_HIGH_CONTRAST`, `FONT_SIZE_SELECT` in DOM_IDS; `REDUCED_MOTION`, `HIGH_CONTRAST` in DOM_CLASSES
- [x] `defaultLabels.js` — 13 new label keys (8 settings + 5 notifications)
- [x] `settingsUIManager.js` — 3 new setup functions following all existing patterns (safeAddEventListener, _initialized guards, loadMiniCycleData, AppState save, getLabel notifications)
- [x] `main.css` — accessibility.css import added
- [x] `service-worker.js` — accessibility.css added to cache manifest
- [x] `miniCycle.html` — Accessibility section HTML, early-boot script

---

## Files Modified (11 + 1 new)

| File | Changes |
|------|---------|
| `modules/core/constants.js` | 3 DOM_IDS + 2 DOM_CLASSES |
| `modules/labels/defaultLabels.js` | 13 label keys + validation entries |
| `miniCycle.html` | Moved 2 toggles, added Accessibility section (5 controls), early-boot script |
| `modules/ui/settingsUIManager.js` | 3 setup functions, _initialized entries, FONT_SIZE_LABELS map, initAllToggles update |
| `modules/core/appInit.js` | Apply reducedMotion/highContrast/fontSize on boot |
| `modules/routine/routineLoader.js` | Apply accessibility settings on routine switch |
| `styles/base/variables.css` | Font size variables derived from base via calc(); reduced-motion class rule |
| `styles/base/accessibility.css` | **NEW** — 1,162 lines: HC light/dark overrides, focus indicators, font size controls |
| `styles/main.css` | Import accessibility.css |
| `styles/components/task-list.css` | 5 selectors: hardcoded px → CSS variables |
| `styles/components/task-input.css` | 2 selectors: hardcoded px → CSS variables |
| `styles/components/settings.css` | 3 selectors: hardcoded px → CSS variables |
| `styles/components/forms.css` | 2 selectors: hardcoded px → CSS variables |
| `service-worker.js` | accessibility.css added to cache manifest |

---

## What Remains (Phase 2 — Future Work)

### Font Size: Remaining Hardcoded px Values
~170 `font-size: Npx` values remain across component CSS files. The most visible content scales (tasks, inputs, settings), but smaller UI elements don't. Converting these would be a separate CSS variable migration pass.

**Files with most remaining hardcoded font sizes:**

| File | Count | Key Elements |
|------|-------|--------------|
| `modals.css` | ~50 | Modal headers, body text, preview elements, about modal |
| `menu.css` | ~25 | Menu buttons, section headers, date, icons |
| `buttons.css` | ~20 | Various button sizes, undo/redo |
| `stats-panel.css` | ~18 | Stats numbers, labels, section headers |
| `recurring.css` | ~20 | Panel text, form labels, badges |
| `task-options.css` | ~8 | Option labels, section headers |
| `quick-actions.css` | ~12 | Action labels, category headers |
| `notifications.css` | ~8 | Close button, educational text |
| `task-list.css` | ~5 | Due date, emoji indicators, search clear |
| `onboarding.css` | ~10 | Welcome screen text |
| `games.css` | ~8 | Card text, button sizes |
| `mode-selector.css` | ~6 | Mode labels |
| `header.css` | ~4 | Menu button, logo |
| `storage.css` | ~3 | Modal text |
| `routine-switcher.css` | ~2 | Search input, sort buttons |

**Recommended approach:** Convert in batches by component priority (modals → menu → buttons → stats), replacing `Npx` with the nearest CSS variable (`--font-size-xs` through `--font-size-3xl`). Some values (like 60px emoji icons or 32px decorative text) should stay hardcoded — only scale readable text.

### High Contrast: Visual Verification
- [ ] Test every modal in both light + dark HC mode on actual screen
- [ ] Verify WCAG AA (4.5:1) contrast ratios for all text/background pairs
- [ ] Adjust specific values where visual testing reveals issues
- [ ] Test with actual users who need high contrast

### High Contrast: Additional Elements
- [ ] Recurring panel internal elements (schedule badges, frequency controls, template cards)
- [ ] Onboarding screens (if still active)
- [ ] Achievement unlock toast styling
- [ ] Quick actions panel buttons and categories
- [ ] Stats panel internal cards and numbers
- [ ] Custom theme interactions (themes may override HC variables)

### Reduced Motion: Verify Coverage
- [ ] Confirm all CSS animations use the timing variables (not hardcoded `animation-duration`)
- [ ] Check for JS-driven animations (e.g., `requestAnimationFrame`, `setTimeout` transitions) that won't respond to CSS variable zeroing
- [ ] Test drag-and-drop behavior with reduced motion enabled

### Testing
- [ ] Playwright tests for Reduced Motion toggle (persists, applies class, removes class)
- [ ] Playwright tests for High Contrast toggle (persists, applies class, removes class)
- [ ] Playwright tests for Font Size select (persists, changes CSS variable)
- [ ] Playwright tests for Accessibility section visibility and collapse/expand
- [ ] Verify settings survive routine switch
- [ ] Verify early-boot script applies before first paint

### Potential Future Enhancements
- [ ] Respect `prefers-contrast: high` media query to auto-enable high contrast
- [ ] Respect `prefers-reduced-motion: reduce` to auto-enable reduced motion toggle
- [ ] Screen reader announcements for setting changes (aria-live region)
- [ ] Keyboard navigation improvements within the accessibility section
- [ ] "Reset Accessibility" button to restore all defaults at once
- [ ] Font size preview (show sample text at selected size before applying)
- [ ] Line height / letter spacing controls for dyslexia support

---

## State Schema

```
state.settings.reducedMotion  : boolean (default false)
state.settings.highContrast   : boolean (default false)
state.settings.fontSize       : string  (default '16', options: '14'|'16'|'18'|'20')
```

No migration needed — undefined values handled by `|| false` / `|| '16'` fallbacks.

---

## CSS Architecture

```
styles/base/accessibility.css (1,162 lines)
├── Light Mode HC — Variable Overrides (text, borders, backgrounds, completed tasks, progress)
├── Light Mode HC — Element Overrides
│   ├── Tasks, checkboxes, settings, stats panel
│   ├── Task options modal
│   ├── All modals (about, routine, themes, preferences, feedback, reminders, games, storage, settings)
│   ├── Recurring panel, mini modal box
│   ├── Progress bar, notifications
│   ├── Forms, placeholders, mode selector
│   └── Main menu (container, sections, buttons, date, header, mode description, close)
├── Dark Mode HC — Variable Overrides (mirrored with lighter values)
├── Dark Mode HC — Element Overrides (mirrors light mode structure)
├── Enhanced Focus Indicators (both modes)
└── Font Size Select (settings control styles)

styles/base/variables.css
├── --font-size-base: 16px (settable via JS)
├── --font-size-xs through --font-size-3xl: calc() derived from base
└── body.reduced-motion / html.reduced-motion: all timing vars → 0ms
```
