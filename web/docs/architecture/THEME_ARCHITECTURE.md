# Theme Architecture for miniCycle

**Last Updated**: February 24, 2026
**Status**: Production — describes the actual implemented system

> For current version metrics see [PROJECT_STATS.md](../PROJECT_STATS.md).

---

## Overview

miniCycle has **three independent theming layers**. They interact but each can be changed without affecting the others.

| Layer | What it changes | Scope | Set via |
|-------|-----------------|-------|---------|
| **Vocabulary Themes** | Labels, icons, terminology | Per-routine | Routine Switcher 🎨 button |
| **Color Themes (Quick Colors)** | App gradient + UI palette | Global (all routines) | Personalization modal |
| **Dark Mode** | Light/dark contrast scheme | Global | Bottom-right 🌓 toggle |

---

## Layer 1: Vocabulary Themes

Vocabulary themes let each routine use its own terminology. "Add task" becomes "Add habit", "Cycle" becomes "Streak", and so on — without touching any app logic.

### The 5 Themes

| ID | Name | Unlock Threshold | Core Concept |
|----|------|-----------------|--------------|
| `classic` | Classic | 0 cycles (default) | Tasks & Cycles |
| `habit-tracker` | Habit Tracker | 5 cycles | Habits & Streaks |
| `fitness` | Fitness | 25 cycles | Workouts & Sessions |
| `scholar` | Scholar | 50 cycles | Study Goals & Study Sessions |
| `cleaning` | Cleaning | 75 cycles | Chores & Cleaning Rounds |

Themes are unlocked globally (based on total cycle count across all routines), but applied per-routine. A routine can keep its theme even after another routine earns the unlock.

### Key Files

| File | Role |
|------|------|
| `modules/labels/themes.js` | `THEME_DEFINITIONS` — labels, icons, colorPreset per theme. `VocabThemeManager` singleton. |
| `modules/labels/labelResolver.js` | `getLabel()` — checks active theme before falling back to `DEFAULT_LABELS` |
| `modules/labels/defaultLabels.js` | Fallback strings for every key (566 keys) |
| `modules/features/themeManager.js` | `refreshThemeLabels()` — DOM updates on boot + theme change |
| `modules/progress/cycleCompletion.js` | Detects newly unlocked themes on cycle completion, calls `renderVocabThemes()` |

### Schema

Vocabulary theme is stored per routine:

```javascript
// state.data.cycles[cycleId].theme  →  e.g. 'habit-tracker'
// state.settings.unlockedThemes      →  ['classic', 'habit-tracker', ...]
// state.settings.defaultTheme        →  applied to new routines
```

### Label Resolution Chain

```
getLabel('action.addTask')
  → labelResolver.getActiveLens()
  → vocabThemeManager.getActiveTheme()
  → AppState.get().data.cycles[activeCycleId].theme   // e.g. 'habit-tracker'
  → THEME_DEFINITIONS['habit-tracker'].labels['action.addTask']  // 'Add habit'
```

If any step returns null/undefined, it falls back to `DEFAULT_LABELS['action.addTask']` → `'Add task'`.

### THEME_DEFINITIONS Structure

Each theme definition in `modules/labels/themes.js` has:

```javascript
const THEME_DEFINITIONS = {
  'habit-tracker': {
    name: 'Habit Tracker',
    icon: '🔁',
    unlockCycles: 5,
    labels: {
      // Overrides for specific label keys
      'action.addTask':    'Add habit',
      'noun.task':         'habit',
      'noun.cycle':        'streak',
      // ... other overrides
    },
    colorPreset: {
      bgStart:     '#2d8653',
      bgEnd:       '#45b37a',
      headerBg:    '#1e6e42',
      modalBg:     'rgba(30, 80, 50, 0.85)',  // Glass background for modals
      modalText:   '#e8f5e9',                  // Text color for modals
      modalBorder: 'rgba(255, 255, 255, 0.12)', // Border color for modals
      // ... other color values
    }
  },
  // ... other themes
};
```

Keys not present in a theme's `labels` object fall through to `DEFAULT_LABELS` automatically.

### Color Presets

Each non-classic theme includes a `colorPreset` object that is applied as `--pref-*` CSS variables when that routine is active. This gives each vocabulary theme its own visual identity on top of the label changes.

```javascript
// Applied by themeManager.js when vocab theme is activated:
root.style.setProperty('--pref-bg-start',    preset.bgStart);
root.style.setProperty('--pref-bg-end',      preset.bgEnd);
root.style.setProperty('--pref-header-bg',   preset.headerBg);
root.style.setProperty('--pref-modal-bg',    preset.modalBg);
root.style.setProperty('--pref-modal-text',  preset.modalText);
root.style.setProperty('--pref-modal-border', preset.modalBorder);
// ...
```

When the Classic theme is active, color presets are reverted to the user's custom colors (or defaults) via `applyCustomColors()`.

### HTML Signals

When a vocabulary theme is active, two attributes are set on `<html>`:

```html
<html data-vocab-theme="habit-tracker" data-vocab-theme-name="Habit Tracker">
```

CSS can target these for theme-specific visual overrides:

```css
[data-vocab-theme="fitness"] .some-element { /* ... */ }
```

The Personalization modal reads `dataset.vocabTheme` to detect whether a vocab theme is active and shows a notice: *"Habit Tracker theme colors are active"* when the user opens the color customizer.

### Boot-Time Refresh

Static HTML strings (like the "Add task" button label) are hardcoded in the HTML file. On boot, `themeManager.refreshThemeLabels()` is called in `uiBoot.finalizeUI()` to overwrite these with the themed versions. Any new themed HTML element must be added to `_refreshLiveLensLabels()` in `themeManager.js`.

### Live Refresh on Routine Switch/Creation

When a routine is created or switched to, the routine modules (`routineManager`, `routineSwitcher`, `routineLoader`) call `this.deps.refreshThemeLabels()` to update the UI with the new routine's theme. This dependency must be wired through all three DI layers (definition, constructor, manifest `optionalDeps`) — see [VOCAB_THEME_SYSTEM.md pitfall #4](../developer-guides/VOCAB_THEME_SYSTEM.md#4-refreshthemelabels-must-be-wired-in-three-places-fixed-feb-2026).

`_refreshLiveLensLabels()` also unconditionally calls `renderVocabThemes()` to keep the Themes modal's radio buttons in sync with the active routine's theme. This ensures the modal always shows the correct selected theme regardless of which code path opens it.

### Theme Picker

The theme picker is accessed via the 🎨 button in the routine switcher action row (`#theme-picker-row`). It shows chips for each unlocked theme; selecting one updates `state.data.cycles[cycleId].theme` and triggers a label refresh.

---

## Layer 2: Color Themes (Quick Colors)

Color themes are the traditional app-wide palette presets. They change the app gradient, header color, and related UI colors using a CSS class on `<body>`.

### Available Presets

Six built-in Quick Color presets (Classic Blue, Midnight, Coral, Sage, Lavender, Slate) plus full custom color support.

### How It Works

```javascript
// themeManager.js applies a CSS class
document.body.classList.add('theme-midnight');

// CSS picks up the class
body.theme-midnight {
  --pref-bg-start: #1a1a2e;
  --pref-bg-end:   #16213e;
  /* ... */
}
```

Custom colors set `--pref-*` variables directly (no class). The Personalization modal provides the color pickers.

### Interaction with Vocabulary Themes

When a vocabulary theme with a `colorPreset` is active, it overrides the Quick Colors for that routine. When the user opens the Personalization modal while a vocab theme is active, a notice explains that the vocab theme controls colors for this routine. `applyCustomColors()` is a no-op in this state (it does not clear the vocab theme colors).

---

## Layer 3: Dark Mode

Dark mode is a separate system that inverts contrast without affecting the hue/gradient choices of the other two layers.

- Toggled by the 🌓 button in the bottom-right corner
- CSS class `dark-mode` on `<body>`
- All dark mode overrides in `styles/utilities/dark-mode.css`
- State persisted in `state.settings.darkMode`

---

## Key Architectural Principles

### No Build Step

The vocabulary theme system requires **no build process**. Labels and color presets are plain JavaScript objects in `modules/labels/themes.js`. Adding a new theme means adding an entry to `THEME_DEFINITIONS` — nothing needs to be compiled or generated.

### CSS Variables as the Bridge

All three theming layers communicate with CSS through `--pref-*` variables defined in `styles/base/variables.css`. Modules set these variables via JavaScript; CSS consumes them. No inline styles, no class-name gymnastics.

```css
/* styles/layout/header.css */
header {
  background: var(--pref-header-bg, var(--color-primary));
}
```

The fallback chain ensures a value always exists: vocab theme preset → user custom color → CSS default.

### Per-Routine, Not Per-Session

Vocabulary themes are stored in the routine's data (`state.data.cycles[cycleId].theme`), not in a session variable. Switching routines instantly switches the active theme without any reload.

---

## Adding a New Vocabulary Theme

1. **Add to `THEME_DEFINITIONS`** in `modules/labels/themes.js`:
   ```javascript
   'my-theme': {
     name: 'My Theme',
     icon: '🌿',
     unlockCycles: 150,
     labels: {
       'action.addTask': 'Add item',
       // ... only keys you want to override
     },
     colorPreset: {
       bgStart:  '#2a5',
       bgEnd:    '#1a4',
       headerBg: '#194',
       // ...
     }
   }
   ```

2. **Update `defaultLabels.js`** if your theme needs label keys that don't exist yet.

3. **Test** by setting `state.data.cycles[cycleId].theme = 'my-theme'` in the browser console and reloading.

4. No build step required.

---

## Related Documentation

- [VOCAB_THEME_SYSTEM.md](../developer-guides/VOCAB_THEME_SYSTEM.md) — Full developer guide including pitfalls
- [LABEL_SYSTEM_ARCHITECTURE.md](LABEL_SYSTEM_ARCHITECTURE.md) — How `getLabel()` and `defaultLabels.js` work
- [FEATURE_LIST.md](../features/FEATURE_LIST.md) — User-facing feature overview
