# Theme Architecture for miniCycle

**Last Updated**: August 5, 2026
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
| `modules/labels/defaultLabels.js` | Fallback strings for every key (~1,575 keys) |
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
    id: 'habit-tracker',
    name: 'Habit Tracker',
    description: 'Build streaks, track habits',
    unlockAt: { cycles: 5 },        // null = always available (Classic only)
    labels: {
      // Overrides for specific label keys (nouns keep { one, other } shape)
      'action.addTask':    'Add habit',
      'noun.task':         { one: 'habit',  other: 'habits'  },
      'noun.cycle':        { one: 'streak', other: 'streaks' },
      // ... other overrides
    },
    colorPreset: {
      appBg:      'linear-gradient(160deg, #c87132 0%, #5c2800 100%)',
      taskListBg: 'rgba(255, 225, 195, 0.5)',
      taskBg:     '#ffd0a0',
      taskText:   '#3d1a00',
      modalBg:    'rgba(255, 225, 195, 0.82)',  // Glass background for modals
      modalText:  '#3d1a00',                     // Text color for modals
      // ... other color slots (titleBg, checkboxBg, progressBar, stats*, celebration*, ...)
    }
  },
  // ... other themes
};
```

Keys not present in a theme's `labels` object fall through to `DEFAULT_LABELS` automatically.

### Color Presets

Each non-classic theme includes a `colorPreset` object that is applied as `--pref-*` CSS variables when that routine is active. This gives each vocabulary theme its own visual identity on top of the label changes.

```javascript
// Applied by themeManager.js when vocab theme is activated
// (colorPreset key → CSS variable mapping lives at the top of themeManager.js):
root.style.setProperty('--pref-app-bg',        preset.appBg);
root.style.setProperty('--pref-task-list-bg',  preset.taskListBg);
root.style.setProperty('--pref-task-bg',       preset.taskBg);
root.style.setProperty('--pref-task-text',     preset.taskText);
root.style.setProperty('--pref-modal-bg',      preset.modalBg);
root.style.setProperty('--pref-modal-text',    preset.modalText);
// ... one --pref-* variable per colorPreset slot
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

When a routine is created or switched to, the routine modules (`routineManager`, `routineSwitcher`, `routineLoader`) call `this.deps.refreshThemeLabels()` to update the UI with the new routine's theme. This dependency must be wired through all three DI layers (definition, constructor, manifest `optionalDeps`) — see [VOCAB_THEME_SYSTEM.md pitfall #4](../features/VOCAB_THEME_SYSTEM.md#4-refreshthemelabels-must-be-wired-in-three-places-fixed-feb-2026).

`_refreshLiveLensLabels()` also unconditionally calls `renderVocabThemes()` to keep the Themes modal's radio buttons in sync with the active routine's theme. This ensures the modal always shows the correct selected theme regardless of which code path opens it.

### Theme Picker

The theme picker is accessed via the 🎨 button in the routine switcher action row (`#theme-picker-row`). It shows chips for each unlocked theme; selecting one updates `state.data.cycles[cycleId].theme` and triggers a label refresh.

---

## Layer 2: Color Themes (Quick Colors)

Color themes are the traditional app-wide palette presets. They change the app gradient, header color, and related UI colors using a CSS class on `<body>`.

### Available Presets

Nine built-in Quick Color presets (`QUICK_PRESETS` in `modules/ui/preferencesPresets.js`: Default, Warm, Cool, Forest, Monochrome, Professional, Golden Glow, Dark Ocean, Berry) plus full custom color support.

### How It Works

Quick presets don't use a CSS class — selecting one fills the custom-color set and applies it via `applyCustomColors()`, which sets `--pref-*` variables directly:

```javascript
// preferencesPresets.js → preferencesManager.applyCustomColors()
root.style.setProperty('--pref-app-bg',       colors.appBg);
root.style.setProperty('--pref-task-list-bg', colors.taskListBg);
// ... one --pref-* variable per color slot
```

Custom colors set the same `--pref-*` variables. The Personalization modal provides the color pickers.

A separate legacy pair of **unlockable color themes** (Dark Ocean, Golden Glow) is managed by `themeManager.js` as a CSS class on `<body>` (`theme-dark-ocean` / `theme-golden-glow`); their unlock state lives in `state.settings.unlockedThemes`.

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
/* styles/base/background.css */
body {
  background: var(--pref-app-bg, var(--theme-bg-gradient));
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
     id: 'my-theme',
     name: 'My Theme',
     description: 'What this theme reframes the app as',
     unlockAt: { cycles: 150 },
     labels: {
       'action.addTask': 'Add item',
       // ... only keys you want to override
     },
     colorPreset: {
       appBg:      'linear-gradient(160deg, #2a5 0%, #1a4 100%)',
       taskListBg: 'rgba(240, 253, 244, 0.55)',
       taskBg:     '#e0f5e8',
       // ... (see VOCAB_THEME_CSS_VARS at the top of themeManager.js for all slots)
     }
   }
   ```

2. **Update `defaultLabels.js`** if your theme needs label keys that don't exist yet.

3. **Test** by setting `state.data.cycles[cycleId].theme = 'my-theme'` in the browser console and reloading.

4. No build step required.

---

## Related Documentation

- [VOCAB_THEME_SYSTEM.md](../features/VOCAB_THEME_SYSTEM.md) — Full developer guide including pitfalls
- [LABEL_SYSTEM_ARCHITECTURE.md](LABEL_SYSTEM_ARCHITECTURE.md) — How `getLabel()` and `defaultLabels.js` work
- [FEATURE_LIST.md](../reference/FEATURE_LIST.md) — User-facing feature overview
