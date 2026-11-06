# Accessibility Documentation

> **Making miniCycle accessible to everyone**
>
> **For current app version, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

**Last verified:** Nov 6 2026
**WCAG target:** 2.2 Level AA — the goal stated in the user-facing
[accessibility statement](../../legal/accessibility.html), which is not a claim of
full conformance.

> **Status:** Developer reference. The user-facing statement is
> `web/legal/accessibility.html`; where the two disagree, check the code and fix
> whichever is wrong.

---

## Current Accessibility Status

### Enforced by CI (both run on pushes and PRs to `main` in `.github/workflows/test.yml`)

- **`npm run test:a11y`** (`tests/automated/run-a11y-tests.cjs`) — drives the real
  app's main surfaces (main menu, settings, personalization, routine switcher,
  recurring panel, themes, reminders, task options, stats panel) and fails when a
  focusable custom control is not keyboard-operable (no interactive role or no key
  handler) or an interactive element has no accessible name.
- **`CONTRAST_GATE=1 npm run test:contrast`** (`tests/automated/run-contrast-tests.cjs`)
  — axe-core's `color-contrast` rule per theme state (default, dark, the
  Personalization presets, a user-picked colour, High Contrast light and dark) and
  per view (Home, Focus View, focus task panel), plus hand-measured checks axe
  cannot make. Gated at zero serious/critical violations on solid backgrounds;
  text over the photographic/gradient backgrounds is reported, not judged.

### Implemented, not gated

- ARIA labels from `getLabel()`, semantic landmarks, live regions (below)
- Skip-to-content link (`.skip-to-content` → `#app-container`)
- Reduced motion — the OS `prefers-reduced-motion` query **and** the app's own
  Settings → Reduced Motion toggle (`settings.reducedMotion`)
- High Contrast mode (Settings toggle, `settings.highContrast` → `body.high-contrast`,
  `styles/base/accessibility.css`) and `prefers-contrast` rules for the footer and
  stats arrows
- Font size presets (Settings: 14 / 16 / 18 / 20 px, `settings.fontSize`)
- App keyboard shortcuts (Alt+Shift+key, plus opt-in single keys) and keyboard task
  reordering (Alt+↑/↓)
- Native `<dialog>` modals opened with `showModal()` (focus containment and Escape
  from the platform)

### Open / not verified (as of Nov 2026)

- Screen-reader testing with VoiceOver, NVDA, JAWS and TalkBack has not been
  formally performed and documented
- Browser zoom at 200% / 400% not formally verified
- No gate measures touch-target size (44×44px is met on some controls only)
- Incomplete-task checkbox ring is about 1.5:1 against the task row (reported, not
  gated — a design choice; High Contrast strengthens it)

---

## Keyboard Navigation

### Undo / Redo ✅

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| **Undo** | Ctrl + Z | ⌘ + Z |
| **Redo** | Ctrl + Y or Ctrl + Shift + Z | ⌘ + Y or ⌘ + Shift + Z |

Ignored while typing in a text field, so the field's own text undo still works
(`undoRedoShortcut()` in `modules/utils/keyboardNav.js`).

### App shortcuts ✅

Alt+Shift+<key> (Option+Shift on a Mac), defined in `KEYBOARD_SHORTCUTS`
(`modules/core/constants.js`) and handled in `modules/boot/uiBoot.js`. Each one
clicks the same button a user would, and the target buttons carry
`aria-keyshortcuts` written from the same constant. They are off while typing, while
a dialog or the menu is open, and on the first-run screen.

| Key (with Alt+Shift) | Action |
|---|---|
| N | New routine |
| O | Open the routine switcher |
| M | Next mode (Auto Cycle → Manual Cycle → To-Do) |
| F | Focus View on / off |
| I | Show / hide the add-task input bar |
| U | User manual |
| [ / ] | Previous / next routine |
| S | Settings |
| . | The view's menu (☰ in Home View, ⋯ in Focus View) |
| ? | The Keyboard Shortcuts list |

Settings → Behavior → **Single-key shortcuts** (`settings.singleKeyShortcuts`, off by
default) adds plain M, S, [, ] and ? for some of them (`SINGLE_KEY_SHORTCUTS`).

### Tasks ✅

| Action | Keys |
|--------|------|
| **Add task** | Enter (in the input field) |
| **Move between tasks** | Tab / Shift+Tab; ↑ / ↓ between task checkboxes or names (roving tabindex) |
| **Toggle task** | Space or Enter on the checkbox or the task name |
| **Reorder** | Alt + ↑ / ↓ (Option on a Mac) on a task's checkbox or name (`dragDropManager.handleReorderKeydown`) |

### Modal Dialogs ✅

| Action | Shortcut |
|--------|----------|
| **Confirm** | Enter |
| **Cancel / close** | Escape |
| **Navigate options** | Tab |

---

## Screen Reader Support

### ARIA Labels ✅

Interactive elements carry ARIA labels, resolved through `getLabel()` so they follow
the vocabulary theme. `npm run test:a11y` fails on any unnamed interactive element
on the surfaces it opens.

**Task System:**
```javascript
// Checkbox (TaskDOMManager.createTaskCheckbox, modules/task/taskDOM.js)
checkbox.setAttribute("aria-label", getLabel('action.markTaskComplete', { vars: { name: taskTextTrimmed } }));
// No aria-checked: a native checkbox already exposes its state, and aria-checked
// would override it. Custom role="checkbox" divs (recurring weekday boxes,
// onboarding demo) do set aria-checked.
```

**Example Implementation:**
```html
<!-- Task checkbox -->
<input type="checkbox" aria-label='Mark task "Morning Exercise" as complete'>

<!-- Quick Access Buttons (miniCycle.html) -->
<button id="personalization-btn" aria-label="Personalization" title="Personalize colors">…</button>
<button id="quick-dark-toggle" aria-label="Toggle dark mode" title="Toggle dark mode">…</button>
```

### Semantic HTML ✅

miniCycle uses proper semantic structure:

- `<main role="main">` for primary content
- `<nav role="tablist">` for navigation
- `<section role="region" aria-labelledby="...">` for logical groupings — **except the
  three carousel panels**, see below
- `<footer role="contentinfo">` for footer
- `<button>` for clickable actions; the few custom controls (`role="checkbox"` day
  boxes, list rows) must pass `npm run test:a11y`
- `<label>` (or an `aria-label`) for form inputs
- `<input>` elements with both `id` and `name` attributes

#### Exception: the three carousel panels are `tabpanel`, not `region`

`#focus-task-panel`, `#task-view` and `#stats-panel` use `role="tabpanel"`, **not**
`role="region"`. This is deliberate and the two patterns above cannot both apply here.

The nav dots (`#nav-dots`) are a real tab widget — `<nav role="tablist">` containing three
`role="tab"` buttons with `aria-controls`. Under ARIA, every active `role="tab"` must have a
matching `role="tabpanel"`; the W3C Nu validator reports a hard **error** when it doesn't
(this was one of the 4 errors fixed in the Jul 2026 validation pass). Since the panels are
controlled by a tablist, `tabpanel` is the correct role and `region` is not available to them.

Consequence, stated plainly: `#focus-task-panel` and `#stats-panel` were previously
`role="region"` and are **no longer landmarks**, so they don't appear in screen-reader landmark
navigation. (`#task-view` was a bare `<div>` with no role, so it lost nothing.) That is the
accepted trade — the tab widget provides equivalent navigation and announces position
("tab 2 of 3").

Landmark coverage is unaffected at the document level. `miniCycle.html` still exposes the core
set: `banner` (`<header>`), `main` (`<main role="main">`), `contentinfo`
(`<footer role="contentinfo">`), and `navigation` (`<nav id="main-menu">`). Note that
`#nav-dots` is `<nav role="tablist">` — the explicit role overrides the implicit navigation
landmark, which is correct for a tab widget.

As a result `miniCycle.html` currently contains **no** `role="region"` at all; the pattern
remains the right default for any *future* logical grouping that is not driven by a tablist
(it is still in use in `pages/product.html` and `lite/miniCycle-lite.html`).

Panel naming: `#task-view` is named via `aria-labelledby` pointing at its tab
(`#nav-dot-task-view`) rather than a hardcoded `aria-label`, because `themeManager` rewrites the
dots' accessible names per vocabulary theme — a static label would go stale. `#stats-panel`
keeps its existing `aria-labelledby="stats-header"`, and `#focus-task-panel` gets its name at
runtime from `focusTaskPanel.js` via `getLabel()`.

### Screen Reader Announcements ✅

**Live regions announce:**
- Notifications (via `aria-live="polite"` container)
- Mode changes
- Recurring task updates

**Implementation:**
```html
<!-- Notification container (miniCycle.html) -->
<div id="notification-container" popover="manual" aria-live="polite" aria-atomic="true" role="status"></div>

<!-- Hidden screen reader announcements (miniCycle.html) -->
<div id="live-region" aria-live="polite"
     style="position: absolute; left: -9999px; top: auto;
            width: 1px; height: 1px; overflow: hidden;">
</div>

<!-- Mode description (miniCycle.html) -->
<div id="mode-description" class="mode-description" aria-live="polite"></div>
```

**Note:** No test asserts what is announced for task completion, cycle completion or errors; that is part of the screen-reader testing that has not been done (see *Open / not verified*).

---

## Visual Accessibility

### Color Contrast ✅

**Target:** WCAG AA
- Text: Minimum 4.5:1 contrast ratio
- Large text: Minimum 3:1 contrast ratio
- UI components: Minimum 3:1 contrast ratio

**Status:** Text on solid backgrounds is gated in CI by
`CONTRAST_GATE=1 npm run test:contrast` (axe `color-contrast`, every theme state
and view the runner lists in `THEMES` / `VIEWS`, zero serious/critical violations).
The same runner adds hand-measured checks for what axe cannot judge — the footer
over every gradient stop (gated in High Contrast, under the OS "more contrast"
setting and for a user-picked colour; reported otherwise), the Focus View "Complete task" button, and the task checkbox
edge (reported only, a design choice). Text over the photographic backgrounds is
reported as "incomplete", never failed; the two branded screens over the desk
photo were measured by hand (below).

#### Measured: the branded screens over the desk photo (Sep 2026)

Both the first-run choice screen and the Welcome Screen put white text over
`Routine_Lists.webp`. Composited with the app's blue overlay, the backdrop under
the content column is `rgb(174, 200, 248)` — nearly white. White text on that
reaches only **1.69:1 even at full opacity**, so no amount of raising text
opacity could fix it; the backdrop itself had to come down.

| Surface | Before | After |
|---|---|---|
| Welcome Screen (tagline, legal, credit, use-case) | 1.47–1.69:1 | **5.35–5.96:1** |
| First-run screen (descriptor, tagline, use-case, restore link) | 1.56–3.42:1 | **6.42–7.09:1** |

Verified at ultrawide (3440), desktop (1440), phone (390) and short (900×600).

**How to re-measure** — do not eyeball it, and do not model the gradient:

1. Record each text element's rect, computed `color` and `opacity`.
2. Set `visibility: hidden` on those elements.
3. Screenshot the page, feed the PNG back into the page as a data URL, and sample
   the canvas at each recorded rect. That is the true backdrop *behind* the text.
4. Composite text colour over it at its opacity and apply the WCAG formula.

Sampling *beside* a text run instead of behind it reports false failures whenever
the scrim is narrower than the surrounding area — that mistake was made during
this work and cost two rounds of chasing a non-existent regression.

**The scrim, and what not to repeat** (`critical.css`, `title-screen.css`):

- Size the radii in **% of the viewport**, not px. A px radius tuned on a 1440
  screen reads as a distinct dark **oval** at 3440, where it is only 25% of the
  width.
- But a *small* % fails the other way: 34% of a 390px phone is 133px — narrower
  than the fixed 300px content column, so the text sat outside its own scrim
  (1.77:1).
- Use **many stops on a smooth curve**, not four linear ones. Linear interpolation
  produces Mach banding, and what reads as "an oval" is the falloff *rate*
  changing, not the darkness. The current curve is `(1-t⁴)²`: flat through the
  middle where the text sits, falling late, reaching zero with zero *slope* as
  well as zero value. A plain bell curve was tried and failed — it thinned to
  0.24 alpha at mid-radius and every viewport dropped below 4.5:1.

### High Contrast Mode ✅

Two sources:

- **The app's High Contrast setting** (Settings → Accessibility,
  `settings.highContrast`) adds `body.high-contrast`; `styles/base/accessibility.css`
  overrides text, border and surface tokens in light and dark mode and gives
  focus a 3px `:focus-visible` outline.
- **The OS setting** (`prefers-contrast`) is honoured in a few places, e.g.
  `styles/components/footer.css` (footer links get a backing strip) and
  `styles/components/menu.css`:

```css
/* styles/components/menu.css */
@media (prefers-contrast: high) {
    .slide-arrow {
        border: 2px solid currentColor;
    }
    .slide-arrow:focus-visible {
        outline: 3px solid #007BFF;
    }
}
```

### Text Sizing ✅

- **Default:** 16px base font size
- **Font size setting:** Small / Default / Large / Extra Large (14 / 16 / 18 / 20px,
  `settings.fontSize`)
- **Browser zoom:** not formally verified at 200% / 400%
- **Responsive:** `npm run test:layout` checks panel overlap across app viewports

### Color Blindness Considerations ✅

**Visual indicators use icons + text, not color alone:**
- ✅ Checkmarks for completion (not just green)
- ⚠️ Warning icons for alerts (not just yellow)
- ❌ Delete icons (not just red)
- Priority is shown as the theme's colour on the task; the priority button also
  exposes set / unset through `aria-pressed`

---

## Motor Accessibility

### Touch Targets ⚠️

**Target:** Minimum 44x44px for all interactive elements

**Current Status:** Partial, and not measured by any gate. Several stylesheets set
44px minimums (e.g. `modals.css`, `task-options.css`, `header.css`); task
checkboxes, action buttons and navigation controls have not been swept.

**Touch Optimization:** ✅ `touch-action: manipulation` and
`@media (hover: none) and (pointer: coarse)` rules in the component stylesheets.

### Drag & Drop Alternatives ✅

**Can't drag?** Use alternatives:
- **Alt + ↑ / ↓** on a focused task moves it one place (no setting needed)
- **Arrow buttons** (▲▼) to reorder tasks — Settings → Show Move Arrows, off by default
- **Three-dot menu** for task options — Settings → Show Three Dots Menu

### Long Press Support ✅

**Mobile:**
- Long-press (`UI_TIMEOUTS.TASK_DRAG_LONG_PRESS`) lifts a task for reordering
- Visual feedback during press
- Alternative: Three-dot menu

### Click vs. Hover ✅

**Never rely on hover alone:**
- All hover actions have click alternatives
- Three-dot menu for task options
- Long-press on mobile
- Touch-friendly button sizes

---

## Cognitive Accessibility

### Simple Language ✅

- Clear, concise labels
- Minimal jargon
- Tooltips for unfamiliar terms
- Help text for complex features

### Visual Hierarchy ✅

- Clear headings
- Logical tab order
- Grouped related content
- Consistent layout

### Error Prevention ✅

- Confirmation dialogs for destructive actions
- **"Are you sure?"** before deleting
- Undo/redo for mistakes (Ctrl+Z / Ctrl+Y)
- Clear error messages

### Consistent UI ✅

- Same action always in same place
- Predictable navigation
- Familiar patterns
- No unexpected changes

---

## Focus Management

### Visible Focus Indicators ✅

Interactive elements show `:focus-visible` outlines (2px by default, 3px in High
Contrast mode):

**Examples:**
```css
/* Navigation dots (styles/utilities/helpers.css) */
.dot:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -4px;
}

/* Title field (styles/components/task-list.css) */
#mini-cycle-title:focus-visible {
    outline: 2px solid var(--theme-input-focus-border, #4c79ff);
    outline-offset: 2px;
}

/* High Contrast mode (styles/base/accessibility.css) */
body.high-contrast *:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 2px;
}
```

### Focus Trapping ✅

**Modal dialogs** are native `<dialog>` elements opened with `showModal()`
(`modules/ui/modalManager.js`), so the browser keeps focus inside the dialog, makes
the page behind it inert, and closes it on Escape. Modules that open dialogs restore
focus to the opener on close. The Guided Tour, which is not a `<dialog>`, traps Tab
itself (`GuidedTourManager._trapFocus`).

### Skip Links ✅

`<a href="#app-container" class="skip-to-content">` is the first focusable element in
`miniCycle.html`; it is hidden until focused (`styles/base/reset.css`) and jumps to
`<main id="app-container" tabindex="-1">`.

---

## Animation & Motion

### Reduced Motion ✅

Two sources, both honoured:

- the OS `prefers-reduced-motion: reduce` query, and
- the app's **Settings → Reduced Motion** toggle (`settings.reducedMotion`), which
  adds the `reduced-motion` class to `<html>` and `<body>`.

`styles/base/variables.css` zeroes every `--transition-*` / `--animation-*` token
under either, so CSS that uses the tokens stops animating on its own; components
with their own keyframes add `prefers-reduced-motion` blocks. JavaScript-driven
motion (progress bar, achievements, splash, smooth scrolls) asks
`prefersReducedMotion()` / `scrollBehavior()` in `modules/utils/motionPreference.js`,
which checks both sources (fixed Oct 2026 — before that the app's own switch did not
stop them).

---

## Testing with Assistive Technologies

### Screen Readers

**Testing Status:** Not formally performed and documented (Nov 2026)

**Planned testing with:**
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (Mac/iOS)
- TalkBack (Android)

**Automated coverage instead:** `npm run test:a11y` checks accessible names and
keyboard operability from the accessibility tree; it does not drive a screen reader.

### Keyboard-Only Testing

- `npm run test:a11y` — custom controls on the audited surfaces are keyboard-operable
- Keyboard shortcuts and Alt+arrow reordering are covered by `npm run test:journey`;
  undo/redo key handling by `tests/keyboardNav.tests.js`
- No test walks the whole app keyboard-only

### Browser Zoom

Not formally verified at 200% / 400% (the accessibility statement says the same).
The built-in font size presets are tested. `npm run test:layout` checks the app for
panel overlap at a set of viewports and `pages/product.html` for horizontal overflow
across a range of widths.

---

## Known Accessibility Limitations

### Current Gaps

1. **Screen-reader testing** — not formally performed with VoiceOver, NVDA, JAWS or
   TalkBack.
2. **Browser zoom** — 200% / 400% not formally verified.
3. **Touch targets** — not consistently 44x44px, and no gate measures them.
   **Mitigation:** touch-action optimisation, three-dot menu and move arrows.
4. **Task checkbox ring** — the empty ring is about 1.5:1 against the task row (by
   design; reported, not gated). **Mitigation:** High Contrast mode.
5. **Footer links over the gradient** — fall below 4.5:1 over the light end of the
   gradient unless High Contrast, the OS "increase contrast" setting, or a
   personalised colour is in use (see the accessibility statement).
6. **Custom colour combinations** — vocabulary theme and Personalization colours a
   user picks may not meet WCAG ratios in every combination.

### Open Improvements

- [ ] Screen reader testing (NVDA, JAWS, VoiceOver, TalkBack), documented
- [ ] Verify browser zoom at 200% and 400%
- [ ] Enforce 44x44px minimum touch targets
- [ ] Assert announcements for task completion, cycle completion and errors
- [ ] User testing with assistive technology users
- [ ] Third-party accessibility audit

---

## Accessibility Testing Checklist

### Before Release

**Gated in CI:**
- [x] Accessible names and keyboard operability of custom controls (`npm run test:a11y`)
- [x] Color contrast on solid backgrounds, every theme state and view (`CONTRAST_GATE=1 npm run test:contrast`)

**In place, not gated:**
- [x] Semantic HTML structure and ARIA landmarks
- [x] Focus indicators visible (`:focus-visible`)
- [x] Reduced motion (OS setting and app setting)
- [x] Skip link present
- [x] High contrast mode
- [x] Undo/redo, app shortcuts and keyboard reordering (journey tests)

**Not yet done:**
- [ ] Screen reader tested (NVDA/JAWS/VoiceOver/TalkBack)
- [ ] Zoom verified at 200% / 400%
- [ ] Touch targets measured
- [ ] User testing with disabled users
- [ ] WCAG AAA compliance

---

## Testing Tools & Resources

### Automated Testing

**Recommended tools:**
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluator
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Built into Chrome DevTools
- [Pa11y](https://pa11y.org/) - Command-line testing

### Manual Testing

**Screen Readers:**
- NVDA (Windows) - Free
- JAWS (Windows) - Commercial
- VoiceOver (Mac/iOS) - Built-in
- TalkBack (Android) - Built-in

**Keyboard Testing:**
- Disconnect mouse
- Navigate entire app with Tab/Shift+Tab
- Test all shortcuts
- Verify modal interactions

**Visual Testing:**
- Browser zoom: 100%, 150%, 200%, 400%
- High contrast mode
- Windows High Contrast theme
- Color blindness simulators

---

## Reporting Accessibility Issues

### How to Report

If you encounter accessibility barriers:

1. **Email** admin@sparkinCreations.com, or **GitHub Issues**
   (`github.com/sparkinCreations/miniCycle/issues`) — the two channels the
   accessibility statement lists
2. Include:
   - Your assistive technology (screen reader, etc.)
   - Browser and version
   - Steps to reproduce
   - Expected vs actual behavior

### Response Time

The accessibility statement (`web/legal/accessibility.html`) says: "We aim to
respond to accessibility feedback within 5 business days."

---

## Standards & Compliance

### Current Target

**WCAG 2.2 Level AA** — the goal the accessibility statement names; it is explicitly
not a claim of complete conformance.

**What is checked against it (Nov 2026):**
- **Perceivable:** contrast on solid backgrounds gated (`test:contrast`); text over
  photos measured by hand; screen-reader output not tested
- **Operable:** custom controls gated for keyboard operability (`test:a11y`);
  shortcuts and reordering journey-tested; touch targets not measured
- **Understandable / Robust:** accessible names gated (`test:a11y`); W3C validity
  checked by `npm run validate:html`

### Standards References

- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

---

## Summary

Names, keyboard operability of custom controls, and contrast on solid backgrounds
are enforced in CI (`npm run test:a11y`, `CONTRAST_GATE=1 npm run test:contrast`).
Reduced motion, High Contrast, font size, a skip link, keyboard shortcuts and
keyboard reordering are implemented. The open items are the ones no gate can see:
screen-reader testing, zoom, touch-target size and user testing — see
*Known Accessibility Limitations*.

**Questions?** Open a GitHub Issue or email admin@sparkinCreations.com.

---

*We're committed to making miniCycle accessible to all users. This document honestly reflects our current progress.*
