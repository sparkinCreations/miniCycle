# CSS Architecture Guide

**Last Updated:** March 2026
**Status:** Complete reference for the CSS design system

> miniCycle uses a token-based CSS architecture built on `styles/base/variables.css`. All colors, spacing, typography, timing, and z-index values are CSS custom properties. This guide explains the system and how to extend it.

---

## Table of Contents

1. [File Structure](#file-structure)
2. [Design Tokens (variables.css)](#design-tokens-variablescss)
3. [Color System](#color-system)
4. [Spacing Scale](#spacing-scale)
5. [Typography](#typography)
6. [Timing and Transitions](#timing-and-transitions)
7. [Borders and Radius](#borders-and-radius)
8. [Shadows](#shadows)
9. [Z-Index Layers](#z-index-layers)
10. [Layout Variables](#layout-variables)
11. [Theming System](#theming-system)
12. [Dark Mode](#dark-mode)
13. [Vocab Theme Color Presets](#vocab-theme-color-presets)
14. [Accessibility](#accessibility)
15. [Responsive Design](#responsive-design)
16. [Conventions and Rules](#conventions-and-rules)

---

## File Structure

```
styles/
├── base/
│   ├── variables.css        # Design tokens — single source of truth
│   ├── reset.css            # CSS reset / normalize
│   ├── typography.css       # Font loading, text styles
│   ├── background.css       # Background patterns
│   ├── animations.css       # @keyframes definitions
│   ├── critical.css         # Above-the-fold critical styles
│   └── accessibility.css    # High contrast, reduced motion overrides
├── components/
│   ├── buttons.css          # Button variants
│   ├── forms.css            # Input, select, checkbox styles
│   ├── modals.css           # Modal overlay, content, transitions
│   ├── notifications.css    # Toast notifications
│   ├── task-list.css        # Task items, completed state
│   ├── task-input.css       # Task input area
│   ├── task-options.css     # Per-task option buttons
│   ├── menu.css             # Slide-out menu
│   ├── settings.css         # Settings modal
│   ├── stats-panel.css      # Stats panel, charts
│   ├── routine-switcher.css # Routine switching modal
│   ├── recurring.css        # Recurring panel, settings
│   ├── themes-modal.css     # Theme picker modal
│   ├── onboarding.css       # Onboarding wizard
│   ├── quick-actions.css    # Quick action buttons
│   ├── focus-mode.css       # Focus mode overlay
│   ├── mode-selector.css    # Cycle/Todo mode toggle
│   ├── progress-bar.css     # Progress indicators
│   ├── footer.css           # Footer area
│   ├── games.css            # Games panel
│   ├── icons.css            # Icon sizing
│   ├── storage.css          # Storage viewer
│   └── testing.css          # Test runner modal
├── layout/
│   ├── app-container.css    # Main app grid/flex layout
│   ├── header.css           # Header bar
│   └── safe-areas.css       # PWA safe area insets
├── themes/
│   └── themes.css           # Color theme class overrides
├── utilities/
│   ├── dark-mode.css        # Dark mode overrides
│   ├── helpers.css          # Utility classes
│   └── responsive.css       # Media queries, breakpoints
└── main.css                 # Imports all stylesheets
```

**38 CSS files** organized by layer: base → components → layout → themes → utilities.

---

## Design Tokens (variables.css)

`styles/base/variables.css` defines all design tokens on `:root`. Every style rule should reference these variables instead of hardcoding values.

```css
/* CORRECT — uses design tokens */
background: var(--theme-task-bg);
padding: var(--space-4);
font-size: var(--font-size-md);
border-radius: var(--radius-md);
transition: opacity var(--transition-normal);

/* WRONG — hardcoded values */
background: #ffffff;
padding: 16px;
font-size: 16px;
border-radius: 8px;
transition: opacity 300ms;
```

---

## Color System

### Static Colors (don't change per theme)

**Brand:**
- `--color-primary`: #4c79ff (main blue)
- `--color-primary-light`: #74c0fc
- `--color-primary-dark`: #3a5fc7
- `--color-accent`: #007BFF

**Semantic:**
- `--color-success` / `--color-success-light`: Green (#28a745)
- `--color-warning` / `--color-warning-light`: Yellow (#ffc107)
- `--color-error` / `--color-error-light`: Red (#dc3545)
- `--color-info`: Teal (#17a2b8)

**Extended palette:**
- `--color-yellow-light`, `--color-orange`, `--color-orange-light`
- `--color-red`, `--color-red-light`, `--color-amber`
- `--color-blue-medium`, `--color-blue-light`, `--color-steel-blue`
- `--color-game-primary` / `--color-game-primary-dark` (achievement teal)

**Neutrals:**
- Gray scale: `--color-gray-50` through `--color-gray-900` (10 stops)
- Slate scale: `--color-slate-100` through `--color-slate-900` (7 stops, blue-tinted)
- Nav dots: `--color-nav-dot`, `--color-nav-dot-active`, `--color-nav-dot-press`
- Navy: `--color-navy`, `--color-navy-dark`

### Themeable Variables (change per theme/mode)

All `--theme-*` variables can be overridden by themes:

| Category | Variables |
|----------|-----------|
| Backgrounds | `--theme-bg-gradient`, `--theme-bg-solid`, `--theme-bg-surface` |
| Text | `--theme-text-primary`, `--theme-text-on-surface`, `--theme-text-muted` |
| Cards | `--theme-card-bg`, `--theme-card-border`, `--theme-card-shadow` |
| Inputs | `--theme-input-bg`, `--theme-input-text`, `--theme-input-border` |
| Buttons | `--theme-button-primary-bg`, `--theme-button-secondary-bg` |
| Modals | `--theme-modal-bg`, `--theme-modal-glass-bg`, `--theme-modal-glass-bg-soft`, `--theme-modal-text`, `--theme-modal-border`, `--theme-modal-overlay` |
| Tasks | `--theme-task-bg`, `--theme-task-completed-bg`, `--theme-task-checkmark` |
| Header | `--theme-header-bg`, `--theme-header-text`, `--theme-header-border` |
| Stats | `--theme-stats-bg`, `--theme-stats-text` |
| Notifications | `--theme-notification-bg`, `--theme-notification-text` |

---

## Spacing Scale

Base unit: 4px. The scale uses a `--space-N` naming convention where N is the number of 4px units.

| Variable | Value | Usage |
|----------|-------|-------|
| `--space-px` | 1px | Hairline borders |
| `--space-0-5` | 2px | Tiny gaps |
| `--space-1` | 4px | Minimal padding |
| `--space-2` | 8px | Small gaps, icon margins |
| `--space-3` | 12px | Standard gap |
| `--space-4` | 16px | Standard padding |
| `--space-5` | 20px | Section margins |
| `--space-6` | 24px | Large padding |
| `--space-8` | 32px | Section gaps |
| `--space-10` | 40px | Large spacing |
| `--space-12` | 48px | Extra-large |
| `--space-20` | 80px | Layout spacing |
| `--space-30` | 120px | Reserved zones |

Fractional values available: `--space-0-75` (3px), `--space-1-25` (5px), `--space-1-5` (6px), `--space-2-5` (10px), `--space-3-5` (14px), `--space-7-5` (30px), etc.

---

## Typography

### Font Families
- `--font-family`: Poppins (with system font fallbacks)
- `--font-family-mono`: SF Mono, Monaco, Consolas

### Font Sizes
All sizes are `calc()` based on `--font-size-base` (16px), so changing the base scales everything:

| Variable | Default | Computed |
|----------|---------|----------|
| `--font-size-xs` | `calc(base - 4px)` | 12px |
| `--font-size-sm` | `calc(base - 2px)` | 14px |
| `--font-size-base` | 16px | 16px |
| `--font-size-lg` | `calc(base + 2px)` | 18px |
| `--font-size-xl` | `calc(base + 4px)` | 20px |
| `--font-size-2xl` | `calc(base + 8px)` | 24px |
| `--font-size-3xl` | `calc(base + 14px)` | 30px |

The accessibility font size setting changes `--font-size-base`, and all `calc()` sizes scale automatically.

### Font Weights
- `--font-weight-normal`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600
- `--font-weight-bold`: 700

### Line Heights
- `--line-height-tight`: 1.25
- `--line-height-normal`: 1.5
- `--line-height-relaxed`: 1.75

---

## Timing and Transitions

### Transition Durations
| Variable | Value | Usage |
|----------|-------|-------|
| `--transition-fast` | 150ms | Hover effects, small state changes |
| `--transition-normal` | 300ms | Standard transitions |
| `--transition-slow` | 500ms | Modal open/close |

### Animation Durations
| Variable | Value | Usage |
|----------|-------|-------|
| `--animation-pop` | 400ms | popIn, taskResetFlash, fadeInUp |
| `--animation-slow` | 600ms | Header coin-flip, SVG stroke |
| `--animation-exit` | 1500ms | Cycle completion fadeOutScale |
| `--animation-spin` | 1s | Infinite spin |
| `--animation-pulse` | 2s | Infinite pulse |
| `--transition-stagger` | 800ms | Sequential reveal delays |

### Easing Functions
- `--ease-default`: ease-in-out
- `--ease-bounce`: cubic-bezier(0.68, -0.55, 0.265, 1.55)
- `--ease-smooth`: cubic-bezier(0.4, 0, 0.2, 1)

### Reduced Motion
All timing variables are automatically set to `0ms` under `prefers-reduced-motion: reduce` or when the user enables "Reduced Motion" in settings (`body.reduced-motion`). No extra CSS needed — if you use the timing variables, your animations are automatically motion-safe.

---

## Borders and Radius

| Variable | Value | Usage |
|----------|-------|-------|
| `--radius-2xs` | 2px | Hairline radius |
| `--radius-sm` | 4px | Subtle rounding |
| `--radius-md` | 8px | Standard cards/inputs |
| `--radius-lg` | 12px | Modals, large cards |
| `--radius-xl` | 16px | Feature cards |
| `--radius-2xl` | 20px | Hero elements |
| `--radius-full` | 9999px | Pills, circles |

---

## Shadows

| Variable | Value | Usage |
|----------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Modals |
| `--shadow-inner` | `inset 0 2px 4px rgba(0,0,0,0.05)` | Pressed states |
| `--shadow-modal` | `0 20px 40px rgba(0,0,0,0.15)` | Modal containers |

---

## Z-Index Layers

Defined in both CSS (`--z-*` variables) and JS (`Z_INDEX` constants). See the [Constants System Guide](./CONSTANTS_SYSTEM_GUIDE.md#z_index--stacking-layers) for the full table.

**Rule:** Never hardcode z-index numbers. Use `var(--z-modal)` in CSS or `Z_INDEX.MODAL` in JS.

---

## Layout Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `--header-height` | 110px | Fixed header height |
| `--max-content-width` | 400px | Max width of main content area |
| `--task-card-offset` | 320px | Vertical budget above/below task list |
| `--task-card-offset-with-btn` | 380px | When Complete/Clear button is visible |
| `--nav-area-height` | 55px | Nav dots bottom position |
| `--help-window-clearance` | 55px | Help window margin to clear nav dots |
| `--safe-area-*` | `env(safe-area-inset-*)` | PWA safe area insets |

---

## Theming System

### Color Themes (Quick Colors)

Color themes are CSS classes on `<body>` managed by `themeManager.js`. Each theme overrides `--theme-*` variables.

Location: `styles/themes/themes.css`

### How themes are applied

1. User selects a theme in the personalization modal
2. `themeManager.js` sets a class on `<body>` (e.g., `body.theme-sunset`)
3. CSS rules in `themes.css` override the `--theme-*` variables
4. All components using those variables automatically update

### Creating a new color theme

1. Add a CSS block in `themes.css`:
   ```css
   body.theme-my-theme {
       --theme-bg-gradient: linear-gradient(135deg, #myColor1, #myColor2);
       --theme-task-bg: rgba(...);
       /* Override any --theme-* variables */
   }
   ```
2. Register it in the theme picker JS

---

## Dark Mode

Dark mode is handled by `styles/utilities/dark-mode.css` which overrides `--theme-*` variables and adds dark-specific styles when `body.dark-mode` is present.

```css
body.dark-mode {
    --theme-bg-gradient: linear-gradient(135deg, #1a1a2e, #16213e);
    --theme-bg-surface: #1e1e1e;
    --theme-text-on-surface: #e0e0e0;
    --theme-task-bg: rgba(30, 30, 30, 0.95);
    /* ... overrides for all --theme-* variables */
}
```

**Rule:** Dark mode colors should use CSS variables from `dark-mode.css`, not hardcoded dark hex values in component CSS.

---

## Vocab Theme Color Presets

Vocab themes (unlocked via milestones) can override both labels AND colors. Each non-classic theme defines a `colorPreset` object in `THEME_DEFINITIONS` (in `modules/labels/themes.js`).

When a vocab theme is active:
1. `data-vocab-theme="active"` and `data-vocab-theme-name="<name>"` are set on `<html>`
2. `--pref-*` CSS variables are applied directly to the root element
3. The personalization modal shows a notice that theme colors are active

Vocab theme colors take precedence over Quick Colors and user custom colors.

### Modal-Specific Preset Variables

Vocab themes can include modal styling via `--pref-modal-*` variables:

| Variable              | colorPreset Key | Purpose                      |
|-----------------------|-----------------|------------------------------|
| `--pref-modal-bg`     | `modalBg`       | Glass background for modals  |
| `--pref-modal-text`   | `modalText`     | Text color for modals        |
| `--pref-modal-border` | `modalBorder`   | Border color for modals      |

These integrate into the modal fallback chain:

```css
background: var(--pref-modal-bg, var(--theme-modal-glass-bg, var(--theme-modal-bg, var(--color-white))));
```

The chain ensures a value always resolves: vocab theme preset --> theme glass bg --> theme modal bg --> base color.

---

## Accessibility

### Reduced Motion
- OS level: `@media (prefers-reduced-motion: reduce)` in `variables.css`
- App level: `body.reduced-motion` / `html.reduced-motion` class
- Both set all timing variables to `0ms`

### High Contrast
- `body.high-contrast` class triggers rules in `styles/base/accessibility.css`
- ~1,162 lines of high-contrast overrides
- Increases border visibility, text contrast, and focus indicators

### Font Size
- 4 options: Small (-2px), Default (16px), Large (+2px), Extra Large (+4px)
- Changes `--font-size-base`; all `calc()` sizes scale automatically

---

## Responsive Design

Breakpoints and responsive rules live in `styles/utilities/responsive.css`.

Key responsive behavior:
- PWA safe areas via `env(safe-area-inset-*)` in `styles/layout/safe-areas.css`
- `--max-content-width: 400px` constrains the main content column
- `--task-card-offset` adjusts vertical space budget

---

## Conventions and Rules

1. **Always use CSS variables** — never hardcode colors, spacing, font sizes, timing, or z-index
2. **Use semantic token names** — `var(--theme-task-bg)` not `var(--color-white)` for a task background
3. **Dark mode via variables** — override `--theme-*` in `dark-mode.css`, not per-component
4. **Timing via variables** — use `var(--transition-normal)` so reduced motion works automatically
5. **Z-index via variables** — use `var(--z-modal)` so the stacking scale is centralized
6. **One style per concern** — don't mix layout and theming in the same rule when possible
7. **Comment non-obvious values** — if a magic number must exist, comment why

---

## See Also

- [CONSTANTS_SYSTEM_GUIDE.md](./CONSTANTS_SYSTEM_GUIDE.md) — Z-index JS constants and all constant groups
- [VOCAB_THEME_SYSTEM.md](./VOCAB_THEME_SYSTEM.md) — Vocabulary theme system details
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) — General coding conventions
