# Contextual Theme System Plan

**Status:** In Progress
**Priority:** High
**Breaking Changes:** No (additive feature, backward compatible)

---

## Overview

Replace miniCycle's color-only unlock system with **vocabulary themes** that adapt the app's
terminology and icons to different use cases while keeping core logic unchanged.

### The Insight

miniCycle is not a task manager. It's a **cyclical routine engine**. The core mechanic — create
items, complete them, list resets, track cycle count — is domain-agnostic. It maps equally well to:

- Habits (habit/streak)
- Fitness (exercise/workout)
- Studying (topic/study session)
- Cleaning (chore/clean sweep)

The app already does this. It just doesn't *speak* this way yet.

---

## Decisions Made

### Naming
- The new system is called **"Themes"** — universally understood, no invented terminology
- The color presets section in Personalization is renamed **"Quick Colors"** (already done) to
  free up the word "Theme" for this system

### Dark Ocean & Golden Glow
- **Removed as unlockables** — equivalent colors (Ocean, Golden) already exist freely in Quick Colors
- No migration needed — users who had them unlocked still have the colors via Quick Colors presets
- All unlock logic, labels, and references to Dark Ocean / Golden Glow unlocks are removed

### Theme Set & Unlock Milestones

| Cycles | Theme | "task" → | "cycle" → |
|--------|-------|----------|----------|
| Free | **Classic** | task | cycle |
| 5 | **Habit Tracker** | habit | streak |
| 25 | **Fitness** | exercise | workout |
| 50 | **Scholar** | topic | study session |
| 75 | **Cleaning** | chore | clean sweep |

---

## Technical Design

### Schema Changes (additive, no migration required)

```javascript
// Per-routine (state.data.cycles[cycleId])
{
    "theme": "classic"  // defaults to "classic" if missing
}

// Per-app settings (state.settings)
{
    "defaultTheme": "classic",
    "unlockedThemes": ["classic"]  // populated on unlock
}
```

### Theme Definition Format

```javascript
{
    id: 'habit-tracker',
    name: 'Habit Tracker',
    description: 'Build streaks, track habits',
    unlockAt: { cycles: 5 },
    labels: {
        'noun.task':          { one: 'habit',  other: 'habits' },
        'noun.cycle':         { one: 'streak', other: 'streaks' },
        'action.addTask':     'Add habit',
        'action.completeAll': 'Complete Day',
        'notify.cycleComplete': 'Day completed! Streak extended!',
    },
    icons: {
        cycleComplete: '⚡',
        celebrate:     '🔥',
    },
    preview: {
        tagline:      'Build streaks, track habits',
        sampleLabels: ['Habit', 'Streak', 'Complete Day'],
        sampleIcons:  ['🔥', '⚡'],
    }
}
```

Labels use **full dot-path keys** matching `getLabel()`'s format so the resolver can look them up
directly: `lens.labels['noun.task']` etc.

### Resolution Order

```
getLabel('noun.task')
  → check active routine's theme for override
  → fall back to DEFAULT_LABELS
```

`getIcon('cycleComplete')` follows the same pattern, checking `theme.icons[key]` first.

### Module: `modules/labels/themes.js`

Lives alongside `defaultLabels.js` and `labelResolver.js` — all label-related files in one place:

```
modules/labels/
  defaultLabels.js   ← all default strings
  labelResolver.js   ← resolves strings (with theme override)
  themes.js          ← theme definitions (what to override)
```



Exports:
- `THEME_DEFINITIONS` — all 5 theme objects
- `ThemeManager` class with:
  - `init()` — migrate existing state (set `unlockedThemes`, `defaultTheme`)
  - `getActiveTheme()` — returns theme object for the active routine
  - `getRoutineTheme(routineId)` — returns theme object for a specific routine
  - `setRoutineTheme(routineId, themeId)` — saves per-routine theme
  - `setDefaultTheme(themeId)` — saves default for new routines
  - `checkThemeUnlocks()` — called after cycle completion, returns newly unlocked theme IDs
  - `getUnlockedThemeIds()` — returns array from state or computes from progress
- `themeManager` — singleton instance
- At module load time: calls `setLabelResolverDependencies` to inject lazy theme getters

### Wire into labelResolver.js

Uncomment the currently-commented override block in `getLabel()`:

```javascript
const deps = di.resolve();
const theme = routineId
    ? deps.getRoutineLens?.(routineId)
    : deps.getActiveLens?.();

if (theme?.labels?.[key] !== undefined) {
    label = theme.labels[key];
} else {
    // fall through to DEFAULT_LABELS
}
```

And update `getIcon()` to check `theme.icons[key]` before falling back to the `icons.*` label.

---

## All Five Themes

### Classic (always available)
```javascript
{ id: 'classic', name: 'Classic', unlockAt: null, labels: {}, icons: {} }
```
Empty overrides — everything falls through to defaults.

### Habit Tracker (5 cycles)
```javascript
labels: {
    'noun.task':          { one: 'habit',  other: 'habits' },
    'noun.cycle':         { one: 'streak', other: 'streaks' },
    'action.addTask':     'Add habit',
    'action.completeAll': 'Complete Day',
    'action.clearAll':    'Reset Habits',
    'notify.cycleComplete': 'Day completed! Streak extended!',
},
icons: { cycleComplete: '⚡', celebrate: '🔥' }
```

### Fitness (25 cycles)
```javascript
labels: {
    'noun.task':          { one: 'exercise', other: 'exercises' },
    'noun.cycle':         { one: 'workout',  other: 'workouts' },
    'action.addTask':     'Add exercise',
    'action.completeAll': 'Finish Workout',
    'action.clearAll':    'Clear Routine',
    'notify.cycleComplete': 'Workout complete!',
},
icons: { cycleComplete: '🏆', celebrate: '💪' }
```

### Scholar (50 cycles)
```javascript
labels: {
    'noun.task':          { one: 'topic',         other: 'topics' },
    'noun.cycle':         { one: 'study session', other: 'study sessions' },
    'action.addTask':     'Add topic',
    'action.completeAll': 'Complete Session',
    'action.clearAll':    'Clear Topics',
    'notify.cycleComplete': 'Study session complete!',
},
icons: { cycleComplete: '🎓', celebrate: '📚' }
```

### Cleaning (75 cycles)
```javascript
labels: {
    'noun.task':          { one: 'chore',       other: 'chores' },
    'noun.cycle':         { one: 'clean sweep', other: 'clean sweeps' },
    'action.addTask':     'Add chore',
    'action.completeAll': 'Finish Sweep',
    'action.clearAll':    'Clear Chores',
    'notify.cycleComplete': 'Clean sweep done!',
},
icons: { cycleComplete: '✨', celebrate: '🧹' }
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `modules/labels/themes.js` | **New** — theme definitions + ThemeManager |
| `modules/labels/labelResolver.js` | Uncomment override block; update `getIcon()` |
| `modules/boot/moduleManifests.js` | Add `themeSystem` manifest (THEME_VISUAL phase) |
| `modules/boot/featureBoot.js` | Call `themeManager.init()` after `loadAllModules` |
| `modules/routine/routineManager.js` | Add `theme: 'classic'` to all 3 cycle creation paths |
| `modules/labels/defaultLabels.js` | Remove Dark Ocean / Golden Glow unlock label keys; add Scholar/Cleaning icons to `icons` category |
| `modules/features/statsPanel.js` | Remove Dark Ocean / Golden Glow unlock UI; add new theme unlock previews |
| `miniCycle.html` | Remove Dark Ocean / Golden Glow unlock DOM elements; add theme selector UI (Phase 2) |
| Import handler | Check theme is unlocked on `.mcyc` import; substitute default + notify if not |

---

## Import Behaviour: Locked Theme

When a user imports a `.mcyc` file whose `theme` field references a theme they haven't unlocked:

1. The routine loads normally — `theme` is set to the user's `defaultTheme` (Classic if not changed)
2. A one-time notification fires explaining the substitution

**Notification copy:**
> *"This routine uses the [Theme Name] theme — keep cycling to unlock it! Using Classic for now."*

**Logic (in the import handler):**
```javascript
const importedTheme = routine.theme ?? 'classic';
const unlocked = themeManager.getUnlockedThemeIds();

if (importedTheme !== 'classic' && !unlocked.includes(importedTheme)) {
    routine.theme = state.settings?.defaultTheme ?? 'classic';
    showNotification(
        getLabel('notify.themeLockedOnImport', { vars: { name: THEME_DEFINITIONS[importedTheme]?.name ?? importedTheme } }),
        'info',
        5000
    );
}
```

**Label to add to `defaultLabels.js`:**
```javascript
themeLockedOnImport: 'This routine uses the {name} theme — keep cycling to unlock it! Using Classic for now.'
```

Non-blocking — the routine still imports and works perfectly.

---

## Implementation Phases

### Phase 1: Core (no UI yet)
1. Create `modules/labels/themes.js`
2. Activate theme override in `labelResolver.js`
3. Register in `moduleManifests.js`
4. Wire `init()` in `featureBoot.js`
5. Add `theme: 'classic'` to routine creation
6. Remove Dark Ocean / Golden Glow unlock logic and labels
7. Add locked-theme handling to import handler

### Phase 2: UI
8. Theme selector in routine edit modal (per-routine)
9. Unlock notification on cycle completion
10. Theme preview in stats panel / achievements

---

## What Was Already Done (Prerequisites)

- `defaultLabels.js` — `icons` category with 15 emoji constants ✅
- `labelResolver.js` — `getIcon()` function + DI hooks (`getActiveLens`, `getRoutineLens`) ready ✅
- All emoji centralized via `getIcon()` in cycleCompletion, themeManager, statsPanel, recurringWatcher ✅
- `LENS_SENSITIVE_KEYS` updated with all `icons.*` keys ✅
- "Quick Themes" → "Quick Colors" rename in Personalization modal ✅

---

**Author:** sparkinCreations
**Updated:** February 2026
