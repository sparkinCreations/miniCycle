# CSS Refactor Plan v2 - No-Build Architecture

**Document Version**: 2.0
**Created**: 2025-01-09
**Archived**: v1 moved to `archive/CSS_REFACTOR_PLAN_v1_ARCHIVED.md`
**Target**: miniCycle-styles.css (9,483 lines)
**Philosophy**: No build step, native CSS features, runtime theme generation

---

## Executive Summary

Refactor the monolithic CSS file into a modular, maintainable architecture using **native CSS features only** (no PostCSS, no build step). The crown jewel is a **JSON-based theme system** that makes creating new themes trivially easy.

**Current State**:
- 9,483 lines in single file
- 35 media queries scattered throughout
- 41 `!important` usages
- Only 35 CSS variable usages (severely underutilized)
- Theme styles duplicated per component (explosion of selectors)
- Hard-coded colors, spacing, timing values everywhere

**Target State**:
- Modular CSS using native `@import`
- Comprehensive CSS variable system (single source of truth)
- JSON-based themes → CSS variables at runtime
- Creating a new theme = writing ~50 lines of JSON
- ~50% size reduction
- Zero build step required

---

## Core Principles

### 1. No Build Step
The app uses ES modules directly. CSS should follow the same philosophy:
- Native CSS `@import` for modularity
- CSS custom properties for theming
- Runtime theme application via JavaScript
- No PostCSS, no Sass, no bundlers

### 2. Align with App Architecture
CSS modules should mirror the JS module structure:
```
modules/features/statsPanel.js    →  styles/components/stats-panel.css
modules/ui/notifications.js       →  styles/components/notifications.css
modules/core/constants.js         →  styles/base/variables.css (CSS equivalent)
```

### 3. Theme-First Design
Themes are a key feature. The architecture must make it trivial to:
- Create new themes (JSON file only)
- Modify existing themes
- Preview themes instantly
- Share themes (export/import JSON)

---

## Performance Considerations

### @import Trade-offs

Native CSS `@import` creates separate HTTP requests for each file. With ~20 CSS files, that's ~20 requests on first load.

**Why this is usually acceptable:**
- HTTP/2 handles parallel requests efficiently
- Files are cached after first load
- Development experience greatly improved
- Total bytes transferred is the same (or less due to deduplication)

**When it might matter:**
- First load on slow 3G connections
- iOS PWA install (we optimized service worker for this)

### Production Optimization (Optional)

If @import performance becomes an issue, use a simple concatenation script (no build tool):

```bash
#!/bin/bash
# scripts/bundle-css.sh
# Concatenates CSS files for production - no dependencies required

cat styles/base/variables.css \
    styles/base/reset.css \
    styles/base/typography.css \
    styles/base/animations.css \
    styles/layout/app-container.css \
    styles/layout/header.css \
    styles/layout/safe-areas.css \
    styles/components/task-input.css \
    styles/components/task-list.css \
    styles/components/task-options.css \
    styles/components/buttons.css \
    styles/components/modals.css \
    styles/components/notifications.css \
    styles/components/stats-panel.css \
    styles/components/progress-bar.css \
    styles/components/forms.css \
    styles/components/settings.css \
    styles/utilities/helpers.css \
    > miniCycle-styles.css

echo "✅ CSS bundled to miniCycle-styles.css"
```

**Workflow:**
- Development: Use `styles/main.css` with @imports (easy debugging, hot reload)
- Production: Run `./scripts/bundle-css.sh` to create single file
- Both work without any build tools or npm dependencies

**Recommendation:** Start with @imports only. Add bundling script later IF performance testing shows it's needed. Premature optimization is the root of all evil.

---

## Architecture Overview

### File Structure
```
styles/
├── main.css                    # Entry point with @imports
├── base/
│   ├── reset.css              # Normalization
│   ├── variables.css          # All CSS custom properties
│   ├── typography.css         # Font families, sizes
│   └── animations.css         # All @keyframes (deduplicated)
├── layout/
│   ├── app-container.css      # Main app structure
│   ├── header.css             # Header and nav
│   └── safe-areas.css         # iOS notch handling
├── components/
│   ├── task-input.css         # Task input field
│   ├── task-list.css          # Task list and items
│   ├── task-options.css       # Task action buttons
│   ├── buttons.css            # Generic button styles
│   ├── modals.css             # All modal styles
│   ├── notifications.css      # Toast notifications
│   ├── stats-panel.css        # Statistics panel
│   ├── progress-bar.css       # Progress indicators
│   ├── forms.css              # Inputs, selects, checkboxes
│   └── settings.css           # Settings panel
├── themes/
│   ├── theme-manager.js       # Runtime theme application
│   ├── theme-schema.json      # Defines all themeable properties
│   └── definitions/           # Theme JSON files
│       ├── default.json
│       ├── dark.json
│       ├── dark-ocean.json
│       ├── golden-glow.json
│       └── [future-themes].json
└── utilities/
    ├── helpers.css            # Utility classes
    └── responsive.css         # Shared breakpoint mixins (optional)
```

### Entry Point (main.css)
```css
/* styles/main.css */
/* Base - Load order matters */
@import 'base/variables.css';
@import 'base/reset.css';
@import 'base/typography.css';
@import 'base/animations.css';

/* Layout */
@import 'layout/app-container.css';
@import 'layout/header.css';
@import 'layout/safe-areas.css';

/* Components */
@import 'components/task-input.css';
@import 'components/task-list.css';
@import 'components/task-options.css';
@import 'components/buttons.css';
@import 'components/modals.css';
@import 'components/notifications.css';
@import 'components/stats-panel.css';
@import 'components/progress-bar.css';
@import 'components/forms.css';
@import 'components/settings.css';

/* Utilities */
@import 'utilities/helpers.css';
```

---

## Phase 1: CSS Variables Foundation

**Goal**: Create comprehensive variable system that enables theming

### 1.1 Design the Variable System

```css
/* styles/base/variables.css */
:root {
  /* ═══════════════════════════════════════════════════════════════════════════
     BRAND COLORS
     ═══════════════════════════════════════════════════════════════════════════ */
  --color-primary: #4c79ff;
  --color-primary-light: #74c0fc;
  --color-primary-dark: #3a5fc7;
  --color-accent: #007BFF;

  /* ═══════════════════════════════════════════════════════════════════════════
     SEMANTIC COLORS
     ═══════════════════════════════════════════════════════════════════════════ */
  --color-success: #28a745;
  --color-success-light: #48c764;
  --color-warning: #ffc107;
  --color-warning-light: #ffda6a;
  --color-error: #dc3545;
  --color-error-light: #f1737e;
  --color-info: #17a2b8;

  /* ═══════════════════════════════════════════════════════════════════════════
     NEUTRAL COLORS
     ═══════════════════════════════════════════════════════════════════════════ */
  --color-white: #ffffff;
  --color-black: #000000;
  --color-gray-50: #fafafa;
  --color-gray-100: #f5f5f5;
  --color-gray-200: #e5e5e5;
  --color-gray-300: #d4d4d4;
  --color-gray-400: #a3a3a3;
  --color-gray-500: #737373;
  --color-gray-600: #525252;
  --color-gray-700: #404040;
  --color-gray-800: #262626;
  --color-gray-900: #171717;

  /* ═══════════════════════════════════════════════════════════════════════════
     THEME VARIABLES (overridden by themes)
     ═══════════════════════════════════════════════════════════════════════════ */

  /* Backgrounds */
  --theme-bg-gradient: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  --theme-bg-solid: var(--color-primary);
  --theme-bg-surface: rgba(255, 255, 255, 0.95);
  --theme-bg-surface-elevated: rgba(255, 255, 255, 1);

  /* Text */
  --theme-text-primary: var(--color-white);
  --theme-text-secondary: rgba(255, 255, 255, 0.8);
  --theme-text-on-surface: var(--color-gray-900);
  --theme-text-muted: var(--color-gray-500);

  /* Header */
  --theme-header-bg: transparent;
  --theme-header-text: var(--color-white);
  --theme-header-border: rgba(255, 255, 255, 0.2);

  /* Components */
  --theme-card-bg: rgba(255, 255, 255, 0.95);
  --theme-card-border: transparent;
  --theme-card-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  --theme-input-bg: var(--color-white);
  --theme-input-border: var(--color-gray-300);
  --theme-input-focus-border: var(--color-primary);

  --theme-button-primary-bg: var(--color-primary);
  --theme-button-primary-text: var(--color-white);
  --theme-button-secondary-bg: var(--color-gray-200);
  --theme-button-secondary-text: var(--color-gray-800);

  /* Modal */
  --theme-modal-bg: var(--color-white);
  --theme-modal-text: var(--color-gray-900);
  --theme-modal-border: transparent;
  --theme-modal-overlay: rgba(0, 0, 0, 0.5);

  /* Notifications */
  --theme-notification-bg: var(--color-gray-800);
  --theme-notification-text: var(--color-white);

  /* ═══════════════════════════════════════════════════════════════════════════
     SPACING SCALE
     ═══════════════════════════════════════════════════════════════════════════ */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* ═══════════════════════════════════════════════════════════════════════════
     TYPOGRAPHY
     ═══════════════════════════════════════════════════════════════════════════ */
  --font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* ═══════════════════════════════════════════════════════════════════════════
     TIMING & EASING
     ═══════════════════════════════════════════════════════════════════════════ */
  --transition-fast: 150ms;
  --transition-normal: 300ms;
  --transition-slow: 500ms;
  --ease-default: ease-in-out;
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* ═══════════════════════════════════════════════════════════════════════════
     BORDERS & RADIUS
     ═══════════════════════════════════════════════════════════════════════════ */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;

  /* ═══════════════════════════════════════════════════════════════════════════
     SHADOWS
     ═══════════════════════════════════════════════════════════════════════════ */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

  /* ═══════════════════════════════════════════════════════════════════════════
     Z-INDEX LAYERS
     ═══════════════════════════════════════════════════════════════════════════ */
  --z-background: -1;
  --z-base: 0;
  --z-content: 1;
  --z-header: 10;
  --z-dropdown: 50;
  --z-modal-backdrop: 90;
  --z-modal: 100;
  --z-notification: 200;
  --z-tooltip: 300;
  --z-loader: 9999;

  /* ═══════════════════════════════════════════════════════════════════════════
     LAYOUT
     ═══════════════════════════════════════════════════════════════════════════ */
  --header-height: 110px;
  --max-content-width: 400px;
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);

  /* ═══════════════════════════════════════════════════════════════════════════
     BREAKPOINTS (for documentation - CSS can't use vars in media queries)
     ═══════════════════════════════════════════════════════════════════════════ */
  /* Mobile: 0 - 599px */
  /* Tablet: 600px - 767px */
  /* Desktop: 768px+ */
}
```

### 1.2 Tasks
- [ ] Audit all unique values in current CSS (colors, spacing, etc.)
- [ ] Create `styles/base/variables.css` with comprehensive system
- [ ] Document naming conventions
- [ ] Identify all theme-able properties

**Deliverable**: `styles/base/variables.css`

---

## Phase 2: JSON Theme System

**Goal**: Make theme creation as easy as writing 50 lines of JSON

### 2.1 Theme Schema

```json
// styles/themes/theme-schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "miniCycle Theme",
  "description": "Schema for miniCycle theme definitions",
  "type": "object",
  "required": ["id", "name", "tokens"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier (used in body class)",
      "pattern": "^[a-z][a-z0-9-]*$"
    },
    "name": {
      "type": "string",
      "description": "Display name"
    },
    "description": {
      "type": "string"
    },
    "author": {
      "type": "string"
    },
    "version": {
      "type": "string",
      "default": "1.0.0"
    },
    "tokens": {
      "type": "object",
      "required": ["backgrounds", "text", "header", "components"],
      "properties": {
        "backgrounds": {
          "type": "object",
          "required": ["gradient", "solid", "surface"],
          "properties": {
            "gradient": { "type": "string" },
            "solid": { "type": "string" },
            "surface": { "type": "string" },
            "surfaceElevated": { "type": "string" }
          }
        },
        "text": {
          "type": "object",
          "required": ["primary", "secondary", "onSurface"],
          "properties": {
            "primary": { "type": "string" },
            "secondary": { "type": "string" },
            "onSurface": { "type": "string" },
            "muted": { "type": "string" }
          }
        },
        "header": {
          "type": "object",
          "properties": {
            "bg": { "type": "string" },
            "text": { "type": "string" },
            "border": { "type": "string" }
          }
        },
        "components": {
          "type": "object",
          "properties": {
            "card": {
              "type": "object",
              "properties": {
                "bg": { "type": "string" },
                "border": { "type": "string" },
                "shadow": { "type": "string" }
              }
            },
            "input": {
              "type": "object",
              "properties": {
                "bg": { "type": "string" },
                "border": { "type": "string" },
                "focusBorder": { "type": "string" }
              }
            },
            "button": {
              "type": "object",
              "properties": {
                "primaryBg": { "type": "string" },
                "primaryText": { "type": "string" },
                "secondaryBg": { "type": "string" },
                "secondaryText": { "type": "string" }
              }
            },
            "modal": {
              "type": "object",
              "properties": {
                "bg": { "type": "string" },
                "text": { "type": "string" },
                "border": { "type": "string" },
                "overlay": { "type": "string" }
              }
            },
            "notification": {
              "type": "object",
              "properties": {
                "bg": { "type": "string" },
                "text": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

### 2.2 Example Theme Definition

```json
// styles/themes/definitions/dark-ocean.json
{
  "id": "dark-ocean",
  "name": "Dark Ocean",
  "description": "Deep ocean blues with teal accents",
  "author": "miniCycle",
  "version": "1.0.0",
  "tokens": {
    "backgrounds": {
      "gradient": "linear-gradient(135deg, #0c1724, #1a3a4f)",
      "solid": "#0c1724",
      "surface": "rgba(26, 58, 79, 0.95)",
      "surfaceElevated": "#1e4a5f"
    },
    "text": {
      "primary": "#ffffff",
      "secondary": "rgba(255, 255, 255, 0.8)",
      "onSurface": "#e0f7fa",
      "muted": "#78909c"
    },
    "header": {
      "bg": "rgba(12, 23, 36, 0.9)",
      "text": "#4ecdc4",
      "border": "rgba(78, 205, 196, 0.3)"
    },
    "components": {
      "card": {
        "bg": "rgba(26, 58, 79, 0.95)",
        "border": "1px solid rgba(78, 205, 196, 0.2)",
        "shadow": "0 4px 12px rgba(0, 0, 0, 0.4)"
      },
      "input": {
        "bg": "#1e3a4f",
        "border": "rgba(78, 205, 196, 0.3)",
        "focusBorder": "#4ecdc4"
      },
      "button": {
        "primaryBg": "#4ecdc4",
        "primaryText": "#0c1724",
        "secondaryBg": "#1e3a4f",
        "secondaryText": "#e0f7fa"
      },
      "modal": {
        "bg": "#18304a",
        "text": "#e0f7fa",
        "border": "1px solid #4ecdc4",
        "overlay": "rgba(0, 0, 0, 0.7)"
      },
      "notification": {
        "bg": "#1e4a5f",
        "text": "#e0f7fa"
      }
    }
  }
}
```

### 2.3 Theme Manager (Runtime Application)

```javascript
// styles/themes/theme-manager.js
/**
 * Theme Manager Module (DI-Compatible)
 *
 * Loads JSON theme definitions and applies them as CSS custom properties.
 * No build step required - themes are applied at runtime.
 */

import { createDIModule, required, optional } from '../../modules/core/diBase.js';

const di = createDIModule('ThemeManager', {
  appState: required(),
  storage: optional(null),
  showNotification: optional(null)
});

export const setThemeManagerDependencies = di.setDependencies;

// Cache for loaded themes
const themeCache = new Map();

// CSS variable mapping from JSON tokens to CSS properties
const TOKEN_TO_CSS = {
  'backgrounds.gradient': '--theme-bg-gradient',
  'backgrounds.solid': '--theme-bg-solid',
  'backgrounds.surface': '--theme-bg-surface',
  'backgrounds.surfaceElevated': '--theme-bg-surface-elevated',
  'text.primary': '--theme-text-primary',
  'text.secondary': '--theme-text-secondary',
  'text.onSurface': '--theme-text-on-surface',
  'text.muted': '--theme-text-muted',
  'header.bg': '--theme-header-bg',
  'header.text': '--theme-header-text',
  'header.border': '--theme-header-border',
  'components.card.bg': '--theme-card-bg',
  'components.card.border': '--theme-card-border',
  'components.card.shadow': '--theme-card-shadow',
  'components.input.bg': '--theme-input-bg',
  'components.input.border': '--theme-input-border',
  'components.input.focusBorder': '--theme-input-focus-border',
  'components.button.primaryBg': '--theme-button-primary-bg',
  'components.button.primaryText': '--theme-button-primary-text',
  'components.button.secondaryBg': '--theme-button-secondary-bg',
  'components.button.secondaryText': '--theme-button-secondary-text',
  'components.modal.bg': '--theme-modal-bg',
  'components.modal.text': '--theme-modal-text',
  'components.modal.border': '--theme-modal-border',
  'components.modal.overlay': '--theme-modal-overlay',
  'components.notification.bg': '--theme-notification-bg',
  'components.notification.text': '--theme-notification-text'
};

/**
 * Flatten nested object to dot notation
 * { a: { b: 1 } } → { 'a.b': 1 }
 */
function flattenTokens(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value, path));
    } else {
      result[path] = value;
    }
  }
  return result;
}

/**
 * Load theme from JSON file
 */
async function loadTheme(themeId) {
  if (themeCache.has(themeId)) {
    return themeCache.get(themeId);
  }

  try {
    const response = await fetch(`./styles/themes/definitions/${themeId}.json`);
    if (!response.ok) throw new Error(`Theme not found: ${themeId}`);

    const theme = await response.json();
    themeCache.set(themeId, theme);
    return theme;
  } catch (error) {
    console.error(`Failed to load theme: ${themeId}`, error);
    return null;
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  if (!theme || !theme.tokens) {
    console.warn('Invalid theme object');
    return false;
  }

  const root = document.documentElement;
  const flatTokens = flattenTokens(theme.tokens);

  // Apply each token as CSS variable
  for (const [tokenPath, cssVar] of Object.entries(TOKEN_TO_CSS)) {
    const value = flatTokens[tokenPath];
    if (value !== undefined) {
      root.style.setProperty(cssVar, value);
    }
  }

  // Update body class for theme-specific overrides (if any)
  document.body.classList.forEach(cls => {
    if (cls.startsWith('theme-')) {
      document.body.classList.remove(cls);
    }
  });
  document.body.classList.add(`theme-${theme.id}`);

  console.log(`✅ Theme applied: ${theme.name}`);
  return true;
}

/**
 * Reset to default theme
 */
function resetTheme() {
  const root = document.documentElement;

  // Remove all theme CSS variables (they'll fall back to :root defaults)
  for (const cssVar of Object.values(TOKEN_TO_CSS)) {
    root.style.removeProperty(cssVar);
  }

  // Remove theme class
  document.body.classList.forEach(cls => {
    if (cls.startsWith('theme-')) {
      document.body.classList.remove(cls);
    }
  });

  console.log('✅ Theme reset to default');
}

/**
 * Get list of available themes
 */
async function getAvailableThemes() {
  // This could be a static list or fetched from a manifest
  return [
    { id: 'default', name: 'Default Blue' },
    { id: 'dark', name: 'Dark Mode' },
    { id: 'dark-ocean', name: 'Dark Ocean' },
    { id: 'golden-glow', name: 'Golden Glow' }
  ];
}

/**
 * Export theme as JSON (for sharing)
 */
function exportTheme(theme) {
  return JSON.stringify(theme, null, 2);
}

/**
 * Import theme from JSON string
 */
function importTheme(jsonString) {
  try {
    const theme = JSON.parse(jsonString);
    // Validate required fields
    if (!theme.id || !theme.name || !theme.tokens) {
      throw new Error('Invalid theme: missing required fields');
    }
    themeCache.set(theme.id, theme);
    return theme;
  } catch (error) {
    console.error('Failed to import theme:', error);
    return null;
  }
}

// Public API
export const ThemeManager = {
  loadTheme,
  applyTheme,
  resetTheme,
  getAvailableThemes,
  exportTheme,
  importTheme,

  // Convenience method
  async setTheme(themeId) {
    if (themeId === 'default') {
      resetTheme();
      return true;
    }
    const theme = await loadTheme(themeId);
    return theme ? applyTheme(theme) : false;
  }
};

export default ThemeManager;
```

### 2.4 Tasks
- [ ] Create `styles/themes/theme-schema.json`
- [ ] Create `styles/themes/theme-manager.js`
- [ ] Extract existing themes to JSON:
  - [ ] `definitions/default.json`
  - [ ] `definitions/dark.json`
  - [ ] `definitions/dark-ocean.json`
  - [ ] `definitions/golden-glow.json`
- [ ] Integrate ThemeManager with existing settings/appState
- [ ] Add theme import/export UI (future)

**Deliverables**:
- `styles/themes/theme-schema.json`
- `styles/themes/theme-manager.js`
- `styles/themes/definitions/*.json`

---

## Phase 3: Modularization

**Goal**: Split monolith into logical modules using native @import

### 3.1 Extraction Strategy

**Order matters** - extract in this sequence to maintain cascade:

1. **Base** (no dependencies)
   - `reset.css` - Global resets
   - `variables.css` - All CSS custom properties
   - `typography.css` - Font styles
   - `animations.css` - All @keyframes

2. **Layout** (depends on base)
   - `app-container.css`
   - `header.css`
   - `safe-areas.css`

3. **Components** (depends on base + layout)
   - Extract one at a time
   - Test after each extraction
   - Remove theme-specific overrides (handled by variables now)

### 3.2 Component Extraction Template

```css
/* styles/components/[component].css */
/**
 * [Component Name]
 *
 * Description of what this component styles
 *
 * Usage:
 *   <div class="component-name">...</div>
 *
 * Modifiers:
 *   .component-name--variant
 *   .component-name--size-lg
 */

/* ═══════════════════════════════════════════════════════════════════════════
   BASE STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

.component-name {
  /* Use CSS variables - no hard-coded values */
  background: var(--theme-card-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: all var(--transition-normal) var(--ease-default);
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATES
   ═══════════════════════════════════════════════════════════════════════════ */

.component-name:hover {
  /* Hover styles */
}

.component-name:focus {
  /* Focus styles */
}

.component-name:disabled,
.component-name.is-disabled {
  /* Disabled styles */
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODIFIERS
   ═══════════════════════════════════════════════════════════════════════════ */

.component-name--primary {
  /* Primary variant */
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 767px) {
  .component-name {
    /* Mobile adjustments */
  }
}
```

### 3.3 Remove Theme Duplication

**Before** (current state - repeated for every theme):
```css
.mini-modal-box {
  background: #ffffff;
}

body.dark-mode .mini-modal-box {
  background: #23272e;
}

body.theme-dark-ocean .mini-modal-box {
  background: #18304a;
}

body.theme-golden-glow .mini-modal-box {
  background: #fffbe6;
}

/* ... repeated for every theme × every component */
```

**After** (with CSS variables):
```css
.mini-modal-box {
  background: var(--theme-modal-bg);
  color: var(--theme-modal-text);
  border: var(--theme-modal-border);
}

/* That's it. Themes change the variables, not the selectors. */
```

### 3.4 Tasks
- [ ] Create `styles/main.css` with @import structure
- [ ] Extract base styles:
  - [ ] `base/reset.css`
  - [ ] `base/variables.css` (from Phase 1)
  - [ ] `base/typography.css`
  - [ ] `base/animations.css`
- [ ] Extract layout styles:
  - [ ] `layout/app-container.css`
  - [ ] `layout/header.css`
  - [ ] `layout/safe-areas.css`
- [ ] Extract component styles (one at a time, test each):
  - [ ] `components/task-input.css`
  - [ ] `components/task-list.css`
  - [ ] `components/task-options.css`
  - [ ] `components/buttons.css`
  - [ ] `components/modals.css`
  - [ ] `components/notifications.css`
  - [ ] `components/stats-panel.css`
  - [ ] `components/progress-bar.css`
  - [ ] `components/forms.css`
  - [ ] `components/settings.css`
- [ ] Remove all theme-specific selector blocks
- [ ] Update HTML to use `styles/main.css`

---

## Phase 4: Animation Deduplication

**Goal**: Single source of truth for all animations

### 4.1 Audit Current Animations

```bash
grep -n "@keyframes" miniCycle-styles.css
```

### 4.2 Consolidated Animations

```css
/* styles/base/animations.css */
/**
 * Animation Library
 *
 * All @keyframes definitions in one place.
 * Use CSS variables for timing in components.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   FADE ANIMATIONS
   ═══════════════════════════════════════════════════════════════════════════ */

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SLIDE ANIMATIONS
   ═══════════════════════════════════════════════════════════════════════════ */

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slideOutRight {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes slideInUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes slideInDown {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY ANIMATIONS
   ═══════════════════════════════════════════════════════════════════════════ */

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESS ANIMATIONS
   ═══════════════════════════════════════════════════════════════════════════ */

@keyframes progressStripes {
  from { background-position: 1rem 0; }
  to { background-position: 0 0; }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### 4.3 Tasks
- [ ] Audit all existing @keyframes
- [ ] Identify duplicates
- [ ] Create `styles/base/animations.css`
- [ ] Remove duplicate definitions from components
- [ ] Update animation references to use consistent names

---

## Phase 5: Clean Up

### 5.1 Remove !important

**Audit**:
```bash
grep -n "!important" miniCycle-styles.css
```

**Strategy**:
1. Most `!important` is from specificity wars
2. With proper cascade order, they're unnecessary
3. Keep only for overriding third-party styles (if any)

### 5.2 Standardize Media Queries

**Breakpoint System**:
```css
/* Mobile first - these are the breakpoints */
/* xs: 0 - 479px (default styles) */
/* sm: 480px+ */
/* md: 768px+ */
/* lg: 1024px+ */

/* Usage: */
.component {
  /* Mobile styles (default) */
  padding: var(--space-2);
}

@media (min-width: 768px) {
  .component {
    /* Desktop styles */
    padding: var(--space-4);
  }
}
```

### 5.3 Tasks
- [ ] Remove unnecessary `!important`
- [ ] Convert `max-width` queries to `min-width` (mobile-first)
- [ ] Group media queries at end of each component file
- [ ] Document breakpoint system

---

## Phase 6: Documentation

### 6.1 Create Theme Creation Guide

```markdown
# Creating a New Theme

1. Copy `styles/themes/definitions/default.json` to `styles/themes/definitions/my-theme.json`

2. Edit the JSON:
   - Change `id` to a unique slug (e.g., "my-theme")
   - Change `name` to display name
   - Update colors in `tokens`

3. Test your theme:
   - Open browser console
   - Run: `ThemeManager.setTheme('my-theme')`

4. Add to theme list in settings (optional):
   - Edit theme selector UI to include new theme

That's it! No CSS to write, no build step, instant preview.
```

### 6.2 Tasks
- [ ] Create `docs/CSS_ARCHITECTURE.md`
- [ ] Create `docs/THEME_CREATION_GUIDE.md`
- [ ] Add inline documentation to CSS files
- [ ] Document CSS variable naming conventions

---

## Implementation Order

### Priority 1: Foundation (Enables Everything Else)
1. Create `styles/base/variables.css` with comprehensive system
2. Create theme JSON schema and manager
3. Convert existing themes to JSON

### Priority 2: Quick Wins
4. Deduplicate animations
5. Create `styles/main.css` with @import structure

### Priority 3: Modularization
6. Extract components one by one
7. Remove theme-specific selector blocks as you go
8. Test after each extraction

### Priority 4: Polish
9. Remove `!important`
10. Standardize media queries
11. Documentation

---

## Testing Checklist

After each phase, verify:

- [ ] App loads without CSS errors
- [ ] All themes work correctly
- [ ] Theme switching is instant
- [ ] Animations play correctly
- [ ] Responsive breakpoints work
- [ ] iOS safe areas handled
- [ ] No visual regressions
- [ ] Stats panel swipe works
- [ ] Modals display correctly
- [ ] Notifications appear properly

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Total lines | 9,483 | ~4,000 |
| CSS files | 1 | ~20 |
| !important | 41 | <5 |
| CSS variable usages | 35 | 500+ |
| Lines to create new theme | ~200 | ~50 (JSON) |
| Duplicate animations | Multiple | 0 |
| Theme-specific selectors | Hundreds | 0 |

---

## Rollback Plan

1. **Keep original**: `miniCycle-styles.BACKUP.css`
2. **Git branch**: Work in `feature/css-refactor`
3. **Incremental**: Each phase is independently revertible
4. **Feature flag**: Can switch between old/new CSS via HTML

---

## Migration Risk Mitigation

Converting 9,483 lines of CSS while keeping everything working is risky. One missed selector breaks styling.

### Strategies

1. **Extract one component at a time**
   - Don't try to do it all at once
   - Complete extraction → test → commit → next component
   - Small PRs are easier to review and revert

2. **Visual regression testing**
   - Screenshot key screens before starting
   - Compare after each extraction
   - Test on: Desktop Chrome, Mobile Safari, iOS PWA

3. **Keep original file until done**
   - Don't delete `miniCycle-styles.css` until migration complete
   - Can quickly revert by switching `<link>` tag

4. **Theme Manager fallback**
   - Default theme uses `:root` CSS variables (pure CSS)
   - JS theme manager only needed for non-default themes
   - If JS fails to load, default theme still works

5. **Component checklist per extraction**
   ```
   [ ] Identify all selectors for component
   [ ] Extract to new file
   [ ] Replace hard-coded values with CSS variables
   [ ] Remove theme-specific selectors (body.theme-x .component)
   [ ] Test default theme
   [ ] Test dark mode
   [ ] Test other themes
   [ ] Test responsive breakpoints
   [ ] Commit
   ```

6. **Git branch strategy**
   - Work in `feature/css-refactor`
   - Merge to main only after full testing
   - Each phase can be a separate PR if preferred

---

## Notes

### What This Plan Does NOT Include
- CSS-in-JS (not aligned with app philosophy)
- Sass/LESS (requires build step)
- Tailwind (requires build step)
- CSS Modules (requires bundler)
- PostCSS (requires build step)

### Future Possibilities
- Theme marketplace/sharing
- User-created themes
- Theme preview tool
- Seasonal/holiday themes
- Accessibility themes (high contrast, etc.)

---

**Document Maintainer**: Update as refactor progresses
**Last Updated**: 2025-01-09
