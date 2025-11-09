# CSS Refactor Plan for miniCycle

**Document Version**: 1.0
**Created**: 2024-11-09
**Target**: miniCycle-styles.css (7,054 lines)
**Goal**: Improve maintainability, reduce duplication, establish scalable architecture

---

## Executive Summary

The current CSS file is **functional and visually polished**, but has grown to 7,054 lines with significant duplication and organization challenges. This refactor plan outlines a **phased approach** to modernize the CSS architecture without breaking existing functionality.

**Current State**:
- ✅ Works well, app looks professional
- ✅ Modern CSS features (custom properties, animations, safe areas)
- ✅ Responsive design with 26+ media queries
- ⚠️ 7,054 lines in single file
- ⚠️ Duplicate animations (fadeIn x3, fadeInOut x2)
- ⚠️ Duplicate property declarations (background gradients, overflow, etc.)
- ⚠️ Inconsistent use of CSS variables
- ⚠️ Magic numbers throughout

**Target State**:
- Modular CSS split by feature/component
- No duplication (DRY principle)
- Consistent CSS variable usage
- **JSON-based theme system** (40 lines to create a theme, not 200+)
- Grouped media queries
- Documented architecture
- ~40-50% size reduction

**Note**: See **[THEME_ARCHITECTURE.md](THEME_ARCHITECTURE.md)** for detailed theme system design.

---

## Phase 1: Analysis & Preparation (No Code Changes)

**Goal**: Understand what we have before changing anything

### 1.1 Audit Current CSS

**Tasks**:
```bash
# Generate statistics
grep -c "@keyframes" miniCycle-styles.css        # Count animations
grep -c "@media" miniCycle-styles.css            # Count media queries
grep -c "!important" miniCycle-styles.css        # Count important flags
grep -E "background: linear-gradient" miniCycle-styles.css | wc -l  # Duplicates

# Find all duplicate selectors
# (Manual review or use CSS analyzer tool)
```

**Deliverable**: `CSS_AUDIT.md` with:
- Total line count and breakdown by section
- List of all animations and their locations
- List of all custom properties
- Duplicate property declarations
- Media query breakpoints used
- !important usage locations

### 1.2 Identify Module Boundaries

**Proposed Module Structure**:
```
styles/
├── base/
│   ├── reset.css           # Normalization/reset
│   ├── variables.css       # All CSS custom properties
│   └── typography.css      # Font families, sizes, weights
├── layout/
│   ├── app-container.css   # Main app layout
│   ├── header.css          # Header and navigation
│   └── safe-areas.css      # iOS notch handling
├── components/
│   ├── tasks.css           # Task list, task items
│   ├── buttons.css         # All button styles
│   ├── modals.css          # Modal overlays
│   ├── notifications.css   # Toast notifications
│   ├── stats-panel.css     # Statistics panel
│   ├── progress-bar.css    # Progress indicators
│   └── forms.css           # Input fields, checkboxes
├── themes/
│   ├── _base/
│   │   ├── theme-template.css    # Reference template
│   │   └── theme-tokens.json     # Schema (source of truth)
│   ├── definitions/               # JSON theme definitions
│   │   ├── default.json
│   │   ├── dark.json
│   │   ├── ocean.json
│   │   └── golden.json
│   ├── compiled/                  # Auto-generated CSS
│   │   ├── theme-default.css
│   │   ├── theme-dark.css
│   │   ├── theme-ocean.css
│   │   └── theme-golden.css
│   ├── theme-builder.js          # Build script
│   └── create-theme-scaffold.js  # Helper script
├── utilities/
│   ├── animations.css      # All @keyframes
│   ├── helpers.css         # Utility classes
│   └── responsive.css      # Media queries
└── main.css                # Imports all modules
```

**Deliverable**: `MODULE_MAP.md` showing which selectors belong in which module

### 1.3 Set Up Testing Environment

**Before making changes, ensure you can verify nothing breaks**:

1. **Visual regression testing** (manual):
   - Screenshot current state of all pages/views
   - Test on: Desktop Chrome, Mobile Safari, Edge

2. **Checklist of critical UI elements**:
   - [ ] Task list scrolling
   - [ ] Modal overlays
   - [ ] Button states (hover, active, disabled)
   - [ ] Responsive breakpoints (768px, 600px)
   - [ ] Theme switching
   - [ ] Animations (slide-in/out, fade)
   - [ ] Safe area handling on iOS

**Deliverable**: Screenshots folder + `VISUAL_TEST_CHECKLIST.md`

---

## Phase 2: Foundation - Extract Variables & Remove Duplicates

**Goal**: Establish single source of truth for all values

### 2.1 Create Comprehensive CSS Variables

**Current state**: Partial CSS variables (header colors only)

**Target**: All colors, spacing, timing, etc. as variables

**Example**:

```css
/* styles/base/variables.css */
:root {
  /* ========== COLORS ========== */

  /* Brand Colors */
  --color-primary: #4c79ff;
  --color-primary-light: #74c0fc;
  --color-accent: #007BFF;

  /* Semantic Colors */
  --color-success: #28a745;
  --color-warning: #ffc107;
  --color-error: #dc3545;

  /* Neutral Colors */
  --color-white: #ffffff;
  --color-black: #000000;
  --color-gray-100: #f8f9fa;
  --color-gray-800: #2a2a2a;

  /* Background Gradients */
  --gradient-primary: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  --gradient-dark: linear-gradient(135deg, #1a1a1a, #2a2a2a);

  /* ========== SPACING ========== */

  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 15px;
  --spacing-lg: 20px;
  --spacing-xl: 30px;

  /* ========== TIMING ========== */

  --transition-fast: 0.2s;
  --transition-normal: 0.4s;
  --transition-slow: 0.6s;
  --easing-standard: ease-in-out;

  /* ========== LAYOUT ========== */

  --header-height: 110px;
  --max-content-width: 400px;
  --border-radius-sm: 8px;
  --border-radius-md: 15px;
  --border-radius-lg: 20px;

  /* ========== Z-INDEX LAYERS ========== */

  --z-background: -2;
  --z-base: 0;
  --z-content: 1;
  --z-header: 10;
  --z-modal: 100;
  --z-notification: 200;
  --z-loader: 99999;

  /* ========== SAFE AREAS ========== */

  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
  --safe-area-left: env(safe-area-inset-left);
  --safe-area-right: env(safe-area-inset-right);
}

/* Dark Mode Overrides */
[data-theme="dark"] {
  --gradient-primary: linear-gradient(135deg, #1a1a1a, #2a2a2a);
  /* ... */
}
```

**Tasks**:
- [ ] Extract all unique colors to variables
- [ ] Extract all spacing values
- [ ] Extract all timing/easing values
- [ ] Extract all z-index values (create layering system)
- [ ] Extract all border-radius values
- [ ] Document variable naming convention

**Deliverable**: `styles/base/variables.css` with comprehensive variable system

### 2.2 Deduplicate Global Styles

**Problem**: Lines 2-21 have duplicate `html, body` styles

**Before**:
```css
body {
    background: linear-gradient(135deg, #4c79ff, #74c0fc);
    overflow: hidden;
    /* ... */
}

html, body {
    background: linear-gradient(135deg, #4c79ff, #74c0fc);
    overflow: hidden;
    /* ... */
}
```

**After**:
```css
/* styles/base/reset.css */
html, body {
  background: var(--gradient-primary);
  background-color: var(--color-black); /* Fallback */
  overflow: hidden;
  height: 100vh;
  margin: 0;
  padding: 0;
  padding-bottom: var(--safe-area-bottom);
}
```

**Tasks**:
- [ ] Combine duplicate global selectors
- [ ] Replace hard-coded values with variables
- [ ] Document why each global style exists

**Deliverable**: Clean `styles/base/reset.css`

### 2.3 Deduplicate Animations

**Problem**: Multiple `fadeIn`, `fadeInOut` definitions

**Audit**:
```bash
grep -n "@keyframes fadeIn" miniCycle-styles.css
# Shows fadeIn defined 3 times at different lines
```

**Solution**:
```css
/* styles/utilities/animations.css */

/* ========== FADE ANIMATIONS ========== */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

/* ========== SLIDE ANIMATIONS ========== */
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* ========== SCALE ANIMATIONS ========== */
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

/* ========== UTILITY ANIMATIONS ========== */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

**Tasks**:
- [ ] Find all `@keyframes` definitions
- [ ] Identify duplicates
- [ ] Merge into single animation library
- [ ] Document animation purpose and usage

**Deliverable**: `styles/utilities/animations.css` with deduplicated animations

---

## Phase 3: Modularization - Split by Feature

**Goal**: Break monolith into manageable, logical modules

### 3.1 Extract Component Styles

**Strategy**: One component = one CSS file

#### Example: Tasks Component

**Before** (scattered through 7K lines):
```css
/* Line 231 */
#task-input { /* ... */ }

/* Line 480 */
#taskList { /* ... */ }

/* Line 546 */
.custom-checkbox { /* ... */ }

/* Line 1200 somewhere */
.task-item { /* ... */ }
```

**After** (`styles/components/tasks.css`):
```css
/* ========== Task Input ========== */
#task-input {
  width: 90%;
  max-width: var(--max-content-width);
  padding: var(--spacing-md);
  border: none;
  border-radius: var(--border-radius-md);
  font-size: 16px;
  transition: transform var(--transition-normal) var(--easing-standard);
}

/* ========== Task List Container ========== */
#taskList {
  list-style: none;
  padding: 0;
  margin: var(--spacing-md) 0;
  max-height: 60vh;
  overflow-y: auto;
}

/* ========== Task Items ========== */
.task-item {
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  display: flex;
  align-items: center;
  transition: all var(--transition-fast) var(--easing-standard);
}

.task-item:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* ========== Custom Checkbox ========== */
.custom-checkbox {
  /* ... extracted checkbox styles ... */
}
```

**Extraction Order** (by dependency):
1. Base styles (reset, variables, typography)
2. Layout (app-container, header, safe-areas)
3. Components (tasks, buttons, modals, etc.)
4. Themes
5. Utilities (animations, helpers, responsive)

**Tasks per component**:
- [ ] Identify all selectors for component
- [ ] Extract to dedicated file
- [ ] Replace hard-coded values with variables
- [ ] Add section comments
- [ ] Test in isolation

**Deliverables**:
- `styles/components/tasks.css`
- `styles/components/buttons.css`
- `styles/components/modals.css`
- `styles/components/notifications.css`
- `styles/components/stats-panel.css`
- `styles/components/progress-bar.css`
- `styles/components/forms.css`

### 3.2 Extract Layout Styles

**Header Example** (`styles/layout/header.css`):
```css
/* ========== Header Container ========== */
header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  z-index: var(--z-header);
  padding-top: var(--safe-area-top);
}

/* ========== Header Title ========== */
#mini-cycle-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--header-text);
  margin: 0;
  padding: var(--spacing-md);
}
```

**Tasks**:
- [ ] Extract header styles
- [ ] Extract main app container layout
- [ ] Extract safe area handling
- [ ] Ensure proper cascade order

**Deliverables**:
- `styles/layout/app-container.css`
- `styles/layout/header.css`
- `styles/layout/safe-areas.css`

### 3.3 Extract Theme Styles (JSON-Based System)

**⭐ IMPORTANT**: Themes are a core feature of miniCycle. See **[THEME_ARCHITECTURE.md](THEME_ARCHITECTURE.md)** for complete details.

**Current**: Themes scattered with component styles (repeated CSS, hard to maintain)

**Target**: JSON-based theme system with auto-generated CSS

**Why JSON-Based**:
- Creating new theme = 40 lines of JSON vs. 200+ lines of CSS
- Add new themeable property once → rebuild → all themes updated
- Validation ensures themes are complete
- Easy to preview, share, and extend
- Future: could build theme editor UI or theme store

**Architecture Overview**:
```
themes/
├── _base/
│   ├── theme-tokens.json       # Schema: defines all themeable properties
│   └── theme-template.css      # Reference documentation
├── definitions/                 # 👈 THIS IS WHERE YOU WORK
│   ├── default.json            # Theme as data (40 lines)
│   ├── dark.json
│   ├── ocean.json
│   └── golden.json
├── compiled/                    # 🤖 AUTO-GENERATED (don't edit)
│   ├── theme-default.css       # Generated from JSON
│   ├── theme-dark.css
│   └── theme-ocean.css
├── theme-builder.js            # Build script: JSON → CSS
└── create-theme-scaffold.js    # Helper: interactive theme creator
```

**Example Theme Definition** (`definitions/ocean.json`):
```json
{
  "name": "Dark Ocean",
  "id": "ocean",
  "description": "Deep ocean blues with teal accents",
  "tokens": {
    "brand": {
      "primary": "#1a3a4f",
      "primaryLight": "#2a5a7f",
      "accent": "#4ecdc4"
    },
    "backgrounds": {
      "body": "linear-gradient(135deg, #0c1724, #1a3a4f)",
      "surface": "#1e2a3a"
    },
    "header": {
      "bg": "#1a3a4f",
      "border": "rgba(78, 205, 196, 0.3)",
      "text": "#ffffff"
    }
    /* ... 40 lines total */
  }
}
```

**Workflow**:
```bash
# Create new theme interactively
npm run new:theme

# Build all themes (JSON → CSS)
npm run build:themes

# Watch mode (auto-rebuild on save)
npm run watch:themes
```

**Tasks**:
- [ ] Create `theme-tokens.json` schema (defines all themeable properties)
- [ ] Write `theme-builder.js` script (JSON → CSS converter with validation)
- [ ] Write `create-theme-scaffold.js` helper (interactive theme creator)
- [ ] Extract existing themes to JSON format:
  - [ ] default.json
  - [ ] dark.json
  - [ ] ocean.json
  - [ ] golden.json
- [ ] Update CSS to use new theme variable names (`--theme-brand-primary`)
- [ ] Test build process generates correct CSS
- [ ] Update package.json scripts
- [ ] Document theme creation process

**Deliverables**:
- `themes/_base/theme-tokens.json` (schema)
- `themes/definitions/*.json` (theme data)
- `themes/compiled/*.css` (auto-generated)
- `themes/theme-builder.js` (build script)
- `themes/create-theme-scaffold.js` (helper)
- Updated `package.json` with theme build scripts
- **See [THEME_ARCHITECTURE.md](THEME_ARCHITECTURE.md) for complete implementation guide**

---

## Phase 4: Optimize Media Queries

**Goal**: Group responsive styles, reduce duplication

### 4.1 Audit Current Media Queries

**Problem**: 26 media queries scattered throughout file

**Current state**:
```css
/* Line 100 */
@media (max-width: 768px) {
  .some-element { /* ... */ }
}

/* Line 500 */
@media (max-width: 768px) {
  .other-element { /* ... */ }
}

/* Line 1000 */
@media (max-width: 768px) {
  .another-element { /* ... */ }
}
```

**Tasks**:
- [ ] List all unique breakpoints used
- [ ] Count how many times each breakpoint appears
- [ ] Map which components need responsive styles

**Deliverable**: `MEDIA_QUERY_AUDIT.md`

### 4.2 Strategy Choice

**Option A: Mobile-First in Each Module** (Recommended)
```css
/* styles/components/tasks.css */
.task-item {
  /* Mobile styles first (default) */
  font-size: 14px;
  padding: var(--spacing-sm);
}

@media (min-width: 768px) {
  .task-item {
    /* Desktop styles */
    font-size: 16px;
    padding: var(--spacing-md);
  }
}
```

**Option B: Separate Responsive File**
```css
/* styles/utilities/responsive.css */
@media (max-width: 768px) {
  .task-item { /* mobile overrides */ }
  .button { /* mobile overrides */ }
  /* ... all mobile styles ... */
}
```

**Recommendation**: Option A (keeps related styles together)

**Tasks**:
- [ ] Choose strategy
- [ ] Convert to mobile-first (min-width)
- [ ] Group queries by breakpoint
- [ ] Document breakpoint system

**Deliverable**: Responsive styles integrated into modules OR `styles/utilities/responsive.css`

### 4.3 Standardize Breakpoints

**Define breakpoint system**:
```css
/* styles/base/variables.css */
:root {
  /* Breakpoints (for documentation, not usable in @media) */
  --breakpoint-mobile: 0;
  --breakpoint-tablet: 600px;
  --breakpoint-desktop: 768px;
  --breakpoint-wide: 1200px;
}
```

**Usage**:
```css
/* Mobile first */
.element { /* mobile styles */ }

@media (min-width: 600px) { /* tablet */ }
@media (min-width: 768px) { /* desktop */ }
@media (min-width: 1200px) { /* wide */ }
```

**Tasks**:
- [ ] Audit all breakpoints currently used
- [ ] Standardize to 3-4 breakpoints
- [ ] Convert desktop-first to mobile-first
- [ ] Document breakpoint usage

**Deliverable**: Standardized breakpoint system

---

## Phase 5: Improve Specificity & Remove !important

**Goal**: Clean cascade, no specificity wars

### 5.1 Audit !important Usage

**Tasks**:
```bash
grep -n "!important" miniCycle-styles.css > important_audit.txt
# Review each usage
```

**Common reasons for !important**:
1. Overriding inline styles (fix: remove inline styles)
2. Specificity too low (fix: increase specificity properly)
3. Third-party library override (acceptable)
4. Lazy quick fix (fix: restructure)

**Strategy**:
```css
/* ❌ BAD: Using !important to win specificity war */
.button {
  color: blue !important;
}

/* ✅ GOOD: Increase specificity properly */
.modal .button,
.modal-footer .button {
  color: blue;
}

/* ✅ BETTER: Use BEM or unique class */
.button--primary {
  color: blue;
}
```

**Tasks**:
- [ ] Audit all !important uses
- [ ] Categorize by reason
- [ ] Fix specificity issues
- [ ] Remove unnecessary !important
- [ ] Document remaining !important with reason

**Deliverable**: 90% reduction in !important usage

### 5.2 Consider BEM Methodology (Optional)

**Current naming**:
```css
.task-item { }
.task-item .checkbox { }
.task-item .checkbox:checked { }
```

**BEM naming**:
```css
.task { }
.task__checkbox { }
.task__checkbox--checked { }
```

**Benefits**:
- Flat specificity (all single class)
- Self-documenting
- No cascade issues

**Costs**:
- Verbose HTML classes
- Requires renaming everything
- Large refactor

**Recommendation**: **Skip for now**. Current naming is okay. Focus on splitting files first.

---

## Phase 6: Build Process & Tooling

**Goal**: Automate quality and optimization

### 6.1 Set Up CSS Linting

**Install stylelint**:
```bash
npm install --save-dev stylelint stylelint-config-standard
```

**Create `.stylelintrc.json`**:
```json
{
  "extends": "stylelint-config-standard",
  "rules": {
    "indentation": 2,
    "color-hex-case": "lower",
    "color-hex-length": "short",
    "declaration-no-important": true,
    "selector-max-id": 0,
    "max-nesting-depth": 3,
    "no-duplicate-selectors": true,
    "font-family-name-quotes": "always-where-recommended"
  }
}
```

**Add to package.json**:
```json
{
  "scripts": {
    "lint:css": "stylelint 'styles/**/*.css'",
    "lint:css:fix": "stylelint 'styles/**/*.css' --fix"
  }
}
```

**Tasks**:
- [ ] Install stylelint
- [ ] Configure rules
- [ ] Run lint, fix auto-fixable issues
- [ ] Fix remaining issues manually

**Deliverable**: Linted, consistent CSS

### 6.2 Set Up CSS Bundling

**Option A: Simple Concatenation**
```bash
cat styles/base/*.css \
    styles/layout/*.css \
    styles/components/*.css \
    styles/themes/*.css \
    styles/utilities/*.css \
    > miniCycle-styles.css
```

**Option B: PostCSS Build Process** (Recommended)
```bash
npm install --save-dev postcss postcss-cli postcss-import cssnano autoprefixer
```

**Create `postcss.config.js`**:
```js
module.exports = {
  plugins: [
    require('postcss-import'),      // Resolve @import
    require('autoprefixer'),         // Add vendor prefixes
    require('cssnano')({             // Minify
      preset: 'default'
    })
  ]
};
```

**Create `styles/main.css`**:
```css
/* Base */
@import 'base/variables.css';
@import 'base/reset.css';
@import 'base/typography.css';

/* Layout */
@import 'layout/app-container.css';
@import 'layout/header.css';
@import 'layout/safe-areas.css';

/* Components */
@import 'components/tasks.css';
@import 'components/buttons.css';
@import 'components/modals.css';
@import 'components/notifications.css';
@import 'components/stats-panel.css';
@import 'components/progress-bar.css';
@import 'components/forms.css';

/* Themes (auto-generated from JSON) */
@import 'themes/compiled/theme-default.css';
@import 'themes/compiled/theme-dark.css';
@import 'themes/compiled/theme-ocean.css';
@import 'themes/compiled/theme-golden.css';

/* Utilities */
@import 'utilities/animations.css';
@import 'utilities/helpers.css';
@import 'utilities/responsive.css';
```

**Add to package.json**:
```json
{
  "scripts": {
    "build:themes": "node themes/theme-builder.js",
    "watch:themes": "nodemon --watch themes/definitions -e json --exec 'npm run build:themes'",
    "new:theme": "node themes/create-theme-scaffold.js",
    "build:css": "npm run build:themes && postcss styles/main.css -o miniCycle-styles.css",
    "watch:css": "npm run watch:themes & postcss styles/main.css -o miniCycle-styles.css --watch"
  }
}
```

**Note**: `build:css` now builds themes FIRST, then bundles CSS (themes must exist before import).

**Tasks**:
- [ ] Choose build approach
- [ ] Set up PostCSS (recommended)
- [ ] Create main.css with imports
- [ ] Test build output
- [ ] Update service worker cache (if needed)

**Deliverable**: Automated CSS build process

### 6.3 Add CSS Minification

**If not using PostCSS with cssnano**:
```bash
npm install --save-dev clean-css-cli
```

**Add to package.json**:
```json
{
  "scripts": {
    "minify:css": "cleancss -o miniCycle-styles.min.css miniCycle-styles.css"
  }
}
```

**Update HTML to use minified version in production**:
```html
<link rel="stylesheet" href="miniCycle-styles.min.css">
```

**Tasks**:
- [ ] Set up minification
- [ ] Compare file sizes (expect 40-60% reduction)
- [ ] Update HTML references
- [ ] Update service worker cache

**Deliverable**: Minified CSS for production

---

## Phase 7: Documentation

**Goal**: Ensure future maintainability

### 7.1 Architecture Documentation

**Create `docs/CSS_ARCHITECTURE.md`**:
```markdown
# miniCycle CSS Architecture

## Overview
miniCycle uses a modular CSS architecture with separate files for base styles, layout, components, themes, and utilities.

## File Structure
[Document the styles/ folder structure]

## CSS Variable System
[Document all variables and their purposes]

## Theming
[Explain how themes work and how to create new ones]

## Responsive Design
[Document breakpoints and mobile-first approach]

## Adding New Styles
[Guide for developers on where to add new CSS]
```

**Tasks**:
- [ ] Document architecture
- [ ] Document variable naming conventions
- [ ] Document theming system
- [ ] Document responsive strategy
- [ ] Create contribution guide

**Deliverable**: `docs/CSS_ARCHITECTURE.md`

### 7.2 Component Documentation

**For each component, document**:
- Purpose
- Available modifiers/variants
- Dependencies
- Example usage

**Example** (`styles/components/buttons.css`):
```css
/**
 * BUTTONS
 *
 * Base button styles and variants for miniCycle
 *
 * Variants:
 * - .button--primary (main actions)
 * - .button--secondary (secondary actions)
 * - .button--danger (destructive actions)
 *
 * States:
 * - :hover
 * - :active
 * - :disabled
 *
 * Usage:
 * <button class="button button--primary">Click me</button>
 */
```

**Tasks**:
- [ ] Add header comments to all component files
- [ ] Document available modifiers
- [ ] Document states
- [ ] Provide usage examples

**Deliverable**: Self-documenting CSS files

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Phase 1: Analysis & audit
- [ ] Create module structure
- [ ] Set up testing checklist
- [ ] Take screenshots for comparison

### Week 2: Variables & Deduplication
- [ ] Phase 2.1: Extract all CSS variables
- [ ] Phase 2.2: Remove duplicate global styles
- [ ] Phase 2.3: Deduplicate animations
- [ ] Test: Ensure visual parity

### Week 3-4: Modularization
- [ ] Phase 3.1: Extract base styles
- [ ] Phase 3.1: Extract layout styles
- [ ] Phase 3.1: Extract component styles (tasks, buttons)
- [ ] Phase 3.1: Extract component styles (modals, notifications)
- [ ] Phase 3.1: Extract component styles (remaining)
- [ ] Phase 3.3: Set up JSON-based theme system
  - [ ] Create theme-tokens.json schema
  - [ ] Write theme-builder.js script
  - [ ] Write create-theme-scaffold.js helper
  - [ ] Extract existing themes to JSON
  - [ ] Test theme build process
- [ ] Test: Verify all pages/features still work

### Week 5: Optimization
- [ ] Phase 4: Optimize media queries
- [ ] Phase 5: Remove !important and fix specificity
- [ ] Test: Cross-browser testing

### Week 6: Tooling & Documentation
- [ ] Phase 6.1: Set up linting
- [ ] Phase 6.2: Set up build process
- [ ] Phase 6.3: Set up minification
- [ ] Phase 7: Write documentation
- [ ] Final testing and deployment

**Total Estimated Time**: 6 weeks (working part-time)

---

## Success Metrics

### Quantitative
- ✅ File size reduction: Target 40-50% (from ~7,054 lines)
- ✅ Number of modules: ~20 files instead of 1
- ✅ Duplicate code: 0%
- ✅ !important usage: <5 instances (only for overrides)
- ✅ Build time: <5 seconds
- ✅ Minified size: <50KB

### Qualitative
- ✅ No visual regressions
- ✅ Easier to find and modify styles
- ✅ New developers can understand structure quickly
- ✅ Adding new components is straightforward
- ✅ Themes can be added/modified easily

---

## Rollback Plan

**If something breaks**:

1. **Keep original file**:
   ```bash
   cp miniCycle-styles.css miniCycle-styles.BACKUP.css
   ```

2. **Use git**:
   ```bash
   git checkout miniCycle-styles.css
   ```

3. **Staged rollout**:
   - Refactor in feature branch
   - Test thoroughly before merging
   - Can revert merge if issues found

4. **Feature flags** (optional):
   ```html
   <link rel="stylesheet" href="miniCycle-styles.css" data-version="legacy">
   <!-- OR -->
   <link rel="stylesheet" href="miniCycle-styles-v2.css" data-version="refactored">
   ```

---

## Notes & Considerations

### During Refactor
- **Don't change functionality**: This is a refactor, not a redesign
- **Test frequently**: After each phase, verify nothing broke
- **Commit often**: Small, focused commits make issues easier to track
- **Keep original**: Don't delete old file until refactor is complete and tested

### After Refactor
- **Update documentation**: Keep CSS_ARCHITECTURE.md current
- **Train team**: If you add collaborators, explain the new structure
- **Maintain discipline**: Don't fall back into monolith pattern

### Optional Future Enhancements
- CSS-in-JS (if moving to React/Vue)
- Tailwind CSS (utility-first approach)
- CSS Modules (scoped styles)
- Design tokens (JSON → CSS variables)

---

## Questions & Decisions Log

Track decisions made during refactor:

| Date | Question | Decision | Reason |
|------|----------|----------|--------|
| 2024-11-09 | Use BEM naming? | No, skip for now | Not worth the rename effort |
| 2024-11-09 | Build tool? | PostCSS | Industry standard, good plugins |
| | | | |

---

## References

### Documentation
- **[THEME_ARCHITECTURE.md](THEME_ARCHITECTURE.md)** - Complete guide to JSON-based theme system

### Tools & Standards
- [PostCSS](https://postcss.org/)
- [stylelint](https://stylelint.io/)
- [CSS Guidelines](https://cssguidelin.es/)
- [BEM Methodology](http://getbem.com/)
- [Modern CSS](https://moderncss.dev/)

---

**Document Maintainer**: Update this document as refactor progresses
**Last Updated**: 2024-11-09
