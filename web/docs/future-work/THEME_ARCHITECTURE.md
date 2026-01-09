# Theme Architecture

Technical documentation for miniCycle's JSON-based theming system.

**Related Documents:**
- [CSS Refactor Plan](./CSS_REFACTOR_PLAN.md) - Overall CSS architecture
- [Theme Creation Guide](../guides/THEME_CREATION_GUIDE.md) - User-friendly guide for creating themes

---

## Overview

miniCycle uses a runtime theme system that:
1. Stores themes as JSON files
2. Loads themes dynamically via fetch
3. Applies themes by setting CSS custom properties
4. Requires no build step

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Theme JSON     │────▶│  Theme Manager   │────▶│  CSS Variables  │
│  (definitions/) │     │  (JavaScript)    │     │  (:root style)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## File Structure

```
styles/
└── themes/
    ├── theme-manager.js        # Runtime theme application
    ├── theme-schema.json       # JSON Schema for validation
    └── definitions/            # Theme JSON files
        ├── default.json
        ├── dark.json
        ├── dark-ocean.json
        ├── golden-glow.json
        └── [custom-themes].json
```

---

## Theme Manager

### Module Overview

```javascript
// styles/themes/theme-manager.js
import { createDIModule, required, optional } from '../../modules/core/diBase.js';

const di = createDIModule('ThemeManager', {
  appState: required(),      // For persisting theme preference
  storage: optional(null),   // For theme caching
  showNotification: optional(null)
});
```

### Public API

| Method | Description | Returns |
|--------|-------------|---------|
| `loadTheme(id)` | Load theme JSON from definitions/ | `Promise<Theme>` |
| `applyTheme(theme)` | Apply theme object to document | `boolean` |
| `resetTheme()` | Reset to default CSS variables | `void` |
| `setTheme(id)` | Load and apply theme (convenience) | `Promise<boolean>` |
| `getAvailableThemes()` | List all available themes | `Promise<Theme[]>` |
| `exportTheme(theme)` | Serialize theme to JSON string | `string` |
| `importTheme(json)` | Parse and validate theme JSON | `Theme \| null` |

### Token to CSS Mapping

The theme manager maps JSON token paths to CSS custom properties:

```javascript
const TOKEN_TO_CSS = {
  // Backgrounds
  'colors.backgrounds.gradient': '--theme-bg-gradient',
  'colors.backgrounds.solid': '--theme-bg-solid',
  'colors.backgrounds.surface': '--theme-bg-surface',
  'colors.backgrounds.surfaceElevated': '--theme-bg-surface-elevated',

  // Text
  'colors.text.primary': '--theme-text-primary',
  'colors.text.secondary': '--theme-text-secondary',
  'colors.text.onSurface': '--theme-text-on-surface',
  'colors.text.muted': '--theme-text-muted',

  // Semantic
  'colors.semantic.success': '--theme-color-success',
  'colors.semantic.warning': '--theme-color-warning',
  'colors.semantic.error': '--theme-color-error',
  'colors.semantic.info': '--theme-color-info',

  // Header
  'colors.header.bg': '--theme-header-bg',
  'colors.header.text': '--theme-header-text',
  'colors.header.border': '--theme-header-border',

  // Components - Card
  'colors.components.card.bg': '--theme-card-bg',
  'colors.components.card.border': '--theme-card-border',
  'colors.components.card.shadow': '--theme-card-shadow',

  // Components - Input
  'colors.components.input.bg': '--theme-input-bg',
  'colors.components.input.border': '--theme-input-border',
  'colors.components.input.focusBorder': '--theme-input-focus-border',

  // Components - Button
  'colors.components.button.primaryBg': '--theme-button-primary-bg',
  'colors.components.button.primaryText': '--theme-button-primary-text',
  'colors.components.button.secondaryBg': '--theme-button-secondary-bg',
  'colors.components.button.secondaryText': '--theme-button-secondary-text',

  // Components - Modal
  'colors.components.modal.bg': '--theme-modal-bg',
  'colors.components.modal.text': '--theme-modal-text',
  'colors.components.modal.border': '--theme-modal-border',
  'colors.components.modal.overlay': '--theme-modal-overlay',

  // Components - Notification
  'colors.components.notification.bg': '--theme-notification-bg',
  'colors.components.notification.text': '--theme-notification-text',

  // Components - Task
  'colors.components.task.bg': '--theme-task-bg',
  'colors.components.task.completedBg': '--theme-task-completed-bg',
  'colors.components.task.border': '--theme-task-border',
  'colors.components.task.checkmark': '--theme-task-checkmark',

  // Components - Progress
  'colors.components.progress.trackBg': '--theme-progress-track-bg',
  'colors.components.progress.fillBg': '--theme-progress-fill-bg',
  'colors.components.progress.text': '--theme-progress-text',

  // Components - Stats Panel
  'colors.components.statsPanel.bg': '--theme-stats-bg',
  'colors.components.statsPanel.text': '--theme-stats-text',
  'colors.components.statsPanel.border': '--theme-stats-border'
};
```

### Theme Application Flow

```
1. User selects theme
         │
         ▼
2. ThemeManager.setTheme('theme-id')
         │
         ▼
3. Fetch ./styles/themes/definitions/{id}.json
         │
         ▼
4. Parse JSON, validate structure
         │
         ▼
5. Flatten tokens: { "colors.backgrounds.gradient": "#..." }
         │
         ▼
6. For each token:
   └─▶ document.documentElement.style.setProperty(cssVar, value)
         │
         ▼
7. Add body class: body.theme-{id}
         │
         ▼
8. Persist preference to appState/storage
```

### Flattening Algorithm

Nested JSON tokens are flattened to dot-notation paths:

```javascript
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

// Input:
{
  colors: {
    backgrounds: {
      gradient: "linear-gradient(...)"
    }
  }
}

// Output:
{
  "colors.backgrounds.gradient": "linear-gradient(...)"
}
```

---

## CSS Integration

### Default Variables

All theme CSS variables must have defaults in `styles/base/variables.css`:

```css
:root {
  /* Theme variables with defaults */
  --theme-bg-gradient: linear-gradient(135deg, #4c79ff, #74c0fc);
  --theme-bg-solid: #4c79ff;
  --theme-bg-surface: rgba(255, 255, 255, 0.95);
  --theme-text-primary: #ffffff;
  --theme-text-on-surface: #333333;
  /* ... etc */
}
```

### Component Usage

Components use theme variables, never hard-coded colors:

```css
/* ❌ WRONG - hard-coded */
.modal {
  background: #ffffff;
  color: #333333;
}

/* ✅ CORRECT - theme variables */
.modal {
  background: var(--theme-modal-bg);
  color: var(--theme-modal-text);
}
```

### Fallback Chain

```css
.component {
  /* Fallback chain: theme var → default var → hard-coded */
  background: var(--theme-card-bg, var(--color-white, #ffffff));
}
```

---

## DI Integration

### Module Registration

```javascript
// modules/boot/moduleManifests.js
export const featureManifests = {
  // ...
  themeManager: {
    path: './styles/themes/theme-manager.js',
    exportName: 'ThemeManager',
    setDepsExport: 'setThemeManagerDependencies',
    requiredDeps: ['appState'],
    optionalDeps: ['storage', 'showNotification']
  }
};
```

### Wiring Dependencies

```javascript
// modules/boot/featureBoot.js
themeManager: {
  appState: modules.appState,
  storage: modules.storage,
  showNotification: modules.notifications?.show
}
```

### Usage in App

```javascript
// After boot
const theme = await ThemeManager.setTheme(appState.get('theme') || 'default');

// On theme change (settings panel)
settingsUI.onThemeChange = async (themeId) => {
  await ThemeManager.setTheme(themeId);
  appState.set('theme', themeId);
};
```

---

## Theme Schema

See full schema in [CSS_REFACTOR_PLAN.md](./CSS_REFACTOR_PLAN.md#21-theme-schema).

### Validation

```javascript
async function validateTheme(theme) {
  const required = ['id', 'name'];

  for (const field of required) {
    if (!theme[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!/^[a-z][a-z0-9-]*$/.test(theme.id)) {
    throw new Error('Invalid theme ID format');
  }

  return true;
}
```

### Extensibility

The schema supports future expansion:

| Section | Status | Purpose |
|---------|--------|---------|
| `colors` | Active | Color palette tokens |
| `typography` | Future | Font family, size, weight |
| `spacing` | Future | Density, scale multiplier |
| `shape` | Future | Border radius styles |
| `motion` | Future | Animation preferences |
| `effects` | Future | Shadows, blur, glass |

Future sections are ignored by the current theme manager but preserved in theme files.

---

## Caching Strategy

### Memory Cache

```javascript
const themeCache = new Map();

async function loadTheme(id) {
  if (themeCache.has(id)) {
    return themeCache.get(id);
  }

  const theme = await fetchTheme(id);
  themeCache.set(id, theme);
  return theme;
}
```

### Persistent Cache (Future)

```javascript
// Using app's storage module
async function loadTheme(id) {
  // Check memory
  if (themeCache.has(id)) return themeCache.get(id);

  // Check IndexedDB
  const cached = await storage.get(`theme:${id}`);
  if (cached) {
    themeCache.set(id, cached);
    return cached;
  }

  // Fetch from network
  const theme = await fetchTheme(id);
  await storage.set(`theme:${id}`, theme);
  themeCache.set(id, theme);
  return theme;
}
```

---

## Error Handling

### Theme Load Failure

```javascript
async function setTheme(id) {
  try {
    const theme = await loadTheme(id);
    return applyTheme(theme);
  } catch (error) {
    console.error(`Failed to load theme: ${id}`, error);

    // Notify user
    deps.showNotification?.(`Theme "${id}" not found`, 'error');

    // Fall back to default
    resetTheme();
    return false;
  }
}
```

### Invalid Theme JSON

```javascript
function importTheme(json) {
  try {
    const theme = JSON.parse(json);
    validateTheme(theme);
    return theme;
  } catch (error) {
    console.error('Invalid theme JSON:', error);
    deps.showNotification?.('Invalid theme format', 'error');
    return null;
  }
}
```

### Missing CSS Variables

If a component uses a theme variable that doesn't exist:

```css
/* Variable doesn't exist → uses fallback → uses hard-coded default */
.component {
  color: var(--theme-nonexistent, var(--color-text, #333));
}
```

---

## Performance Considerations

### Initial Load

- Default theme is pure CSS (no JS required)
- Theme preference loaded from appState during boot
- Non-default theme applied after initial render

### Theme Switching

- ~20 CSS variables set via `style.setProperty()`
- Single repaint triggered
- Typically <16ms (within single frame)

### Memory

- Theme JSON: ~1-2KB per theme
- Cached in memory Map
- Minimal footprint

---

## Testing

### Unit Tests

```javascript
describe('ThemeManager', () => {
  test('loadTheme returns theme object', async () => {
    const theme = await ThemeManager.loadTheme('default');
    expect(theme).toHaveProperty('id', 'default');
    expect(theme).toHaveProperty('name');
  });

  test('applyTheme sets CSS variables', () => {
    const theme = { id: 'test', name: 'Test', tokens: {
      colors: { backgrounds: { gradient: '#000' } }
    }};

    ThemeManager.applyTheme(theme);

    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--theme-bg-gradient');
    expect(value.trim()).toBe('#000');
  });

  test('resetTheme removes custom variables', () => {
    ThemeManager.applyTheme({ id: 'test', name: 'Test', tokens: {...} });
    ThemeManager.resetTheme();

    // Should fall back to :root default
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--theme-bg-gradient');
    expect(value).toContain('linear-gradient');
  });
});
```

### Visual Testing

1. Apply each theme
2. Screenshot all major views
3. Compare against baseline
4. Check contrast ratios

---

## Migration Guide

### From Current CSS Themes

Current approach (selector-based):
```css
body.theme-dark-ocean .modal { background: #18304a; }
body.theme-dark-ocean .card { background: #1e3a4f; }
/* Repeated for every component × every theme */
```

New approach (variable-based):
```css
.modal { background: var(--theme-modal-bg); }
.card { background: var(--theme-card-bg); }
/* Theme JSON sets the variables */
```

### Migration Steps

1. Create JSON theme file from existing CSS values
2. Add CSS variables to components
3. Remove selector-based theme overrides
4. Test theme switching
5. Repeat for each theme

---

## Future Enhancements

### Theme Marketplace

```javascript
// Fetch community themes
const themes = await fetch('https://themes.minicycle.app/api/themes');

// Install theme
await ThemeManager.installTheme(themeUrl);
```

### Theme Editor UI

- Live preview as you edit
- Color picker integration
- Export/share functionality

### Seasonal Themes

```javascript
// Auto-apply seasonal themes
const season = getSeason(new Date());
if (season === 'winter' && !userPreference) {
  ThemeManager.setTheme('winter-wonderland');
}
```

### Accessibility Themes

- High contrast
- Reduced motion (via `motion.reducedMotion`)
- Color blind friendly palettes

---

**Last Updated**: 2025-01-09
