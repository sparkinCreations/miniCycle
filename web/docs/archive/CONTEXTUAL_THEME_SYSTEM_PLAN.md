# Contextual Theme System Plan

**Status:** ✅ COMPLETE (Phases 1 & 2)
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
- The color presets section in Personalization is renamed **"Quick Colors"** (done) to
  free up the word "Theme" for this system

### Dark Ocean & Golden Glow
- **Removed as unlockables** — equivalent colors (Ocean, Golden) already exist freely in Quick Colors
- No migration needed — users who had them unlocked still have the colors via Quick Colors presets
- All unlock logic, labels, and references have been removed

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
  themes.js          ← theme definitions + VocabThemeManager
```

Exports:
- `THEME_DEFINITIONS` — all 5 theme objects
- `VocabThemeManager` class with:
  - `init()` — migrate existing state (set `unlockedThemes`, `defaultTheme`)
  - `getActiveTheme()` — returns theme object for the active routine
  - `getRoutineTheme(routineId)` — returns theme object for a specific routine
  - `setRoutineTheme(routineId, themeId)` — saves per-routine theme
  - `setDefaultTheme(themeId)` — saves default for new routines
  - `checkThemeUnlocks()` — call after cycle completion, returns newly unlocked theme IDs
  - `getUnlockedThemeIds()` — returns array from state or computes from progress
  - `getThemeDefinition(id)` — look up a theme object by ID
  - `getNextLockedTheme(globalCycles)` — returns the next theme not yet earned
- `vocabThemeManager` — singleton instance
- At module load time: calls `setLabelResolverDependencies` to inject lazy theme getters

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
    'noun.task':          { one: 'topic',         other: 'topics'         },
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
    'noun.task':          { one: 'chore',       other: 'chores'       },
    'noun.cycle':         { one: 'clean sweep', other: 'clean sweeps' },
    'action.addTask':     'Add chore',
    'action.completeAll': 'Finish Sweep',
    'action.clearAll':    'Clear Chores',
    'notify.cycleComplete': 'Clean sweep done!',
},
icons: { cycleComplete: '✨', celebrate: '🧹' }
```

---

## Import Behaviour: Locked Theme

When a user imports a `.mcyc` file whose `theme` field references a theme they haven't unlocked:

1. The routine loads normally — `theme` is set to the user's `defaultTheme` (Classic if not changed)
2. A one-time notification fires explaining the substitution

**Notification:** *"This routine uses the [Theme Name] theme — keep cycling to unlock it! Using Classic for now."*

Non-blocking — the routine still imports and works perfectly.

---

## Implementation Phases

### Phase 1: Core ✅ COMPLETE

- [x] Create `modules/labels/themes.js` — THEME_DEFINITIONS + VocabThemeManager + singleton
- [x] Activate theme override in `labelResolver.js` — uncomment block, update `getIcon()`
- [x] Register `vocabThemes` manifest in `moduleManifests.js` (THEME_VISUAL phase)
- [x] Wire `vocabThemeManager.init()` in `featureBoot.js`
- [x] Add `theme: 'classic'` to all 3 routine creation paths in `routineManager.js`
- [x] Remove Dark Ocean / Golden Glow unlock logic from `cycleCompletion.js`, `achievementsManager.js`, `themeManager.js`, `moduleLoader.js`, `moduleManifests.js`
- [x] Remove Dark Ocean / Golden Glow label keys from `defaultLabels.js`
- [x] Add locked-theme handling to `cycleImportManager.js`
- [x] Clean up `statsPanel.js` — remove Dark Ocean / Golden Glow blocks, ungated game unlock

---

### Phase 2: UI ✅ COMPLETE

- [x] **Unlock notifications** (`cycleCompletion.js`) — `checkThemeUnlocks()` called after every cycle; each new unlock fires a 5s success notification
- [x] **Stats panel theme status** (`statsPanel.js`) — `#theme-unlock-message` shows current theme with icon; `#golden-unlock-message` shows next unlock milestone or "All themes unlocked!"
- [x] **Theme picker in routine switcher** (`routineSwitcher.js`, `miniCycle.html`, `routine-switcher.css`) — 🎨 button in action row opens compact picker; unlocked = clickable, locked = grayed with cycle count; applying fires confirmation notification; picker cleans up on modal close
- [x] New VocabThemeManager helpers: `getThemeDefinition(id)`, `getNextLockedTheme(globalCycles)`
- [x] New label keys: `unlock.themeCurrentPrefix`, `unlock.nextThemeUnlock`, `unlock.allThemesUnlocked`, `switcher.selectFirst`
- [x] New DOM IDs: `SWITCH_THEME_BTN`, `THEME_PICKER_ROW`

---

## Known Limitation

Theme labels update on **routine switch** (full `loadMiniCycle()` re-render). If a user changes a routine's theme while already on that routine, the add-task placeholder, button labels, etc. won't reflect the new theme until they switch away and back. This is acceptable for an initial release.

---

## Post-Implementation Gap Fixes

Three gaps discovered after Phase 2 and resolved:

1. **Task input placeholder** — HTML hardcoded `placeholder="Enter a task..."`. Fixed in `taskRenderer.js:refreshUIFromState()` — now calls `getLabel('action.addTask')` each time the routine loads, so themes like Fitness get "Add exercise" correctly.

2. **Button label key mismatches** — `themes.js` defined `'action.completeAll'` and `'action.clearAll'`, but `taskUI.js` reads `'action.completeCycle'` (cycle mode) and `'action.clearCompletedTasks'` (to-do mode). Fixed: all 4 non-classic themes now use the correct keys.

3. **`notify.cycleComplete` never surfaced** — Defined in each theme but never called. Fixed: `showCompletionAnimation()` in `cycleCompletion.js` now announces `getLabel('notify.cycleComplete')` to the ARIA live region (previously used `accessibility.cycleCompleted`, which had no theme override). Added `'notify.cycleComplete'` to `LENS_SENSITIVE_KEYS`.

---

## Files Modified / Created

| File | Phase | Status |
|------|-------|--------|
| `modules/labels/themes.js` | 1 + fix | ✅ Created |
| `modules/labels/labelResolver.js` | 1 | ✅ Modified |
| `modules/boot/moduleManifests.js` | 1+2 | ✅ Modified |
| `modules/boot/featureBoot.js` | 1 | ✅ Modified |
| `modules/routine/routineManager.js` | 1 | ✅ Modified |
| `modules/labels/defaultLabels.js` | 1+2+fix | ✅ Modified |
| `modules/features/statsPanel.js` | 1+2 | ✅ Modified |
| `modules/features/themeManager.js` | 1 | ✅ Modified (no-ops) |
| `modules/features/achievementsManager.js` | 1 | ✅ Modified |
| `modules/progress/cycleCompletion.js` | 1+2+fix | ✅ Modified |
| `modules/boot/moduleLoader.js` | 1 | ✅ Modified |
| `modules/ui/cycleImportManager.js` | 1 | ✅ Modified |
| `modules/routine/routineSwitcher.js` | 2 | ✅ Modified |
| `modules/core/constants.js` | 2 | ✅ Modified |
| `miniCycle.html` | 2 | ✅ Modified |
| `styles/components/routine-switcher.css` | 2 | ✅ Modified |
| `modules/task/taskRenderer.js` | fix | ✅ Modified |

---

## What Was Already Done (Prerequisites)

- `defaultLabels.js` — `icons` category with emoji constants ✅
- `labelResolver.js` — `getIcon()` function + DI hooks (`getActiveLens`, `getRoutineLens`) ready ✅
- All emoji centralized via `getIcon()` in cycleCompletion, themeManager, statsPanel, recurringWatcher ✅
- `LENS_SENSITIVE_KEYS` updated with all `icons.*` keys ✅
- "Quick Themes" → "Quick Colors" rename in Personalization modal ✅

---

**Author:** sparkinCreations
**Completed:** February 2026
