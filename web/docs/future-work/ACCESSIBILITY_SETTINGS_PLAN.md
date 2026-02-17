# Accessibility Settings Section

**Date:** February 17, 2026
**Status:** Phase 1 + Font Size + HC Additional + Reduced Motion Complete — Core features, CSS variable conversion, extended HC coverage, and motion verification done
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

### Font Size: Hardcoded px Value Migration — COMPLETE
All readable text `font-size` values across 20 CSS files have been converted to CSS custom property variables (`--font-size-xs` through `--font-size-2xl`). 168 total `var(--font-size-*)` usages now exist across 23 files.

**86 values intentionally kept hardcoded** (should NOT scale with font size setting):
- Icons and emoji: close buttons (24px ×), emoji icons (32-60px), three-dots (25px), slide arrows (32px), checkboxes (28px), empty-state icons (48-56px)
- Preview miniatures: theme/layout previews in preferences modal (7-12px)
- Tiny UI chrome: section toggles (8-10px), mode badges (11px), nav arrows (10px), footer copyright (10px), educational hints (11px)
- Compact controls: mode selector (11-12px), menu grid buttons (12px), preset UI (9-12px)

**Files modified (20):**
modals.css (30), recurring.css (19), buttons.css (16), stats-panel.css (14), task-list.css (12), settings.css (10), games.css (9), onboarding.css (7), quick-actions.css (7), notifications.css (6), task-options.css (6), menu.css (5), forms.css (4), task-input.css (3), critical.css (2), helpers.css (2), storage.css (2), routine-switcher.css (1), mode-selector.css (1), header.css (1)

### High Contrast: Visual Verification
- [ ] Test every modal in both light + dark HC mode on actual screen
- [ ] Verify WCAG AA (4.5:1) contrast ratios for all text/background pairs
- [ ] Adjust specific values where visual testing reveals issues
- [ ] Test with actual users who need high contrast

### High Contrast: Additional Elements — COMPLETE
Added ~200 lines to `accessibility.css` covering both light and dark mode HC overrides:
- [x] Recurring panel: settings panel, frequency select, task items, monthly/weekly/biweekly/yearly day boxes, time pickers, specific dates panel, available tasks list, empty states, disabled buttons
- [x] Stats panel: container border, feature buttons, history/achievement buttons, badges, muted text opacity boost
- [x] Quick actions: picker border, picker items, empty slot dashed borders, section titles opacity boost
- [x] Onboarding: content border, skip button, step indicator, navigation dots, prompt input
- [x] Notifications: recurring notification border visibility boost

Still remaining (low priority):
- [ ] Achievement unlock toast styling
- [ ] Custom theme interactions (themes may override HC variables)

### Reduced Motion: Verify Coverage — COMPLETE
- [x] CSS timing variables confirmed — all `@keyframes` use `var()` durations
- [x] Fixed 3 hardcoded transitions in `critical.css` (0.5s/0.3s → CSS variables)
- [x] Fixed `pullToRefresh.js` spinner — now checks `reduced-motion` class + media query
- [x] Fixed `recurringPanel.js` smooth scroll — now uses `'auto'` when reduced motion active
- [x] Drag-and-drop verified — no animation issues
- [x] `achievementsManager.js` and `cycleCompletion.js` already check reduced motion correctly

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
styles/base/accessibility.css (~1,370 lines)
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
├── Font Size Select (settings control styles)
├── Recurring Panel HC — Light + Dark (settings, frequency, day selectors, time pickers, task lists)
├── Stats Panel HC — Light + Dark (container, buttons, badges, text opacity)
├── Quick Actions HC — Light + Dark (picker, items, empty slots, section titles)
├── Onboarding HC — Light + Dark (content, skip, dots, step indicator, prompt input)
└── Notifications HC — recurring border boost

styles/base/variables.css
├── --font-size-base: 16px (settable via JS)
├── --font-size-xs through --font-size-3xl: calc() derived from base
└── body.reduced-motion / html.reduced-motion: all timing vars → 0ms
```
