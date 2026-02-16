# Contextual Theme System Plan

**Status:** Planned
**Priority:** High
**Estimated Effort:** 2-3 weeks
**Breaking Changes:** No (additive feature, backward compatible)

---

## Overview

Transform miniCycle's unlockable theme system from color-only changes to **contextual lenses** that adapt the app's terminology, icons, and personality to different use cases while keeping core logic unchanged.

### The Insight

miniCycle is not a task manager. It's a **cyclical routine engine**. The core mechanic—create items, complete them, list resets, track cycle count—is domain-agnostic. It maps to:

- Habits (habit/streak)
- Workouts (exercise/routine)
- Pet care (care task/care cycle)
- Cooking (recipe/menu)
- Studying (topic/study session)
- Cleaning (chore/cleaning cycle)

The app already does this. It just doesn't *speak* this way.

### Current State

| Theme | Unlock | What Changes |
|-------|--------|--------------|
| Dark Ocean | 10 cycles | Colors only |
| Golden Glow | 50 cycles | Colors only |

Themes are JSON files setting CSS variables. Presentation is already decoupled from logic.

### Proposed State

| Lens | Unlock | What Changes |
|------|--------|--------------|
| Classic | Default | Nothing (current behavior) |
| Habit Tracker | 10 cycles | "task"→"habit", "cycle"→"streak", icons |
| Fitness | 25 cycles | "task"→"exercise", "cycle"→"routine", icons |
| Custom | 50 cycles | User defines own labels |

Color themes (Dark Ocean, Golden Glow) move to Personalization, available immediately.

---

## Why This Works

### 1. Architecture Already Supports It

- Theme system separates presentation from logic
- Extending JSON schema to include labels is incremental
- No core logic changes required

### 2. Each Lens Is a Market Entry Point

"Habit tracker," "fitness app," "pet care tracker" are different search terms, different audiences—same codebase. SEO and discoverability multiply.

### 3. Unlockables Become Valuable

A color swap feels cosmetic. A contextual reframe feels like unlocking a new app. Perceived value increases significantly.

### 4. Core Mechanic Is Already Abstract

The cycling system doesn't know "tasks" from "habits" from "exercises." It tracks items, completions, and cycles. The abstraction is already there.

---

## Technical Design

### Extended Theme Schema

```javascript
{
  "id": "fitness-tracker",
  "name": "Fitness Tracker",
  "description": "Track workouts, build routines",
  "unlockAt": {
    "cycles": 25,
    "tasks": 125
  },

  "labels": {
    "task": { "one": "exercise", "other": "exercises" },
    "cycle": { "one": "routine", "other": "routines" },
    "routine": { "one": "workout", "other": "workouts" },

    "addTask": "Add exercise",
    "completeAll": "Finish Workout",
    "clearAll": "Clear Routine",
    "cycleCompleted": "Routine completed!",
    "cyclesCompleted": "{count} {count, plural, one {routine} other {routines}} completed",
    "tasksRemaining": "{count} {count, plural, one {exercise} other {exercises}} remaining",

    "modeAuto": "Auto Reset",
    "modeManual": "Manual Reset",
    "modeTodo": "One-Time"
  },

  "icons": {
    "taskComplete": "💪",
    "taskIncomplete": "○",
    "cycleComplete": "🏆",
    "highPriority": "⚡",
    "recurring": "🔄"
  },

  "preview": {
    "tagline": "Track workouts, build routines",
    "sampleLabels": ["Exercise", "Routine", "Finish Workout"],
    "sampleIcons": ["💪", "🏆"]
  },

  "colors": {
    // Optional: lens can include color suggestions
    // But colors primarily handled in Personalization
  }
}
```

### Default Labels Registry

Create `modules/labels/defaultLabels.js` as canonical source:

```javascript
/**
 * Default Labels Registry
 * Single source of truth for all user-facing strings
 *
 * @module labels/defaultLabels
 */

export const DEFAULT_LABELS = {
  // === Nouns ===
  task: { one: 'task', other: 'tasks' },
  cycle: { one: 'cycle', other: 'cycles' },
  routine: { one: 'routine', other: 'routines' },

  // === Actions ===
  addTask: 'Add task',
  completeAll: 'Complete All',
  clearAll: 'Clear All',
  editTask: 'Edit',
  deleteTask: 'Delete',
  duplicateTask: 'Duplicate',

  // === Notifications ===
  cycleCompleted: 'Cycle completed!',
  taskAdded: 'Task added',
  taskDeleted: 'Task deleted',
  taskCompleted: 'Task completed',

  // === Stats ===
  cyclesCompleted: '{count} {count, plural, one {cycle} other {cycles}} completed',
  tasksRemaining: '{count} {count, plural, one {task} other {tasks}} remaining',
  completionRate: '{percent}% complete',

  // === Modes ===
  modeAuto: 'Auto Cycle',
  modeManual: 'Manual Cycle',
  modeTodo: 'To-Do Mode',
  modeAutoDescription: 'Tasks reset automatically when all complete',
  modeManualDescription: 'You decide when to reset',
  modeTodoDescription: 'Completed tasks are deleted',

  // === Milestones ===
  milestoneBronze: 'Bronze',
  milestoneSilver: 'Silver',
  milestoneGold: 'Gold',
  milestoneDiamond: 'Diamond',
  milestoneCrown: 'Crown',

  // === Buttons ===
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  confirm: 'Confirm',
  delete: 'Delete',

  // === Empty States ===
  noTasks: 'No tasks yet',
  noRoutines: 'No routines yet',

  // === Recurring ===
  recurringDaily: 'Daily',
  recurringWeekly: 'Weekly',
  recurringMonthly: 'Monthly',

  // ... continue for all user-facing strings
};

export const LABEL_KEYS = Object.keys(DEFAULT_LABELS);
```

### Label Resolution Function

```javascript
/**
 * Label Resolution Module
 * Resolves user-facing strings based on active context lens
 *
 * @module labels/labelResolver
 */

import { DEFAULT_LABELS } from './defaultLabels.js';

const di = createDIModule('LabelResolver', {
  getActiveTheme: optional(null),
  getRoutineTheme: optional(null)
});

/**
 * Get a localized/themed label
 * @param {string} key - Label key from DEFAULT_LABELS
 * @param {Object} options - Options
 * @param {number} options.count - Count for pluralization
 * @param {string} options.routineId - Routine ID for per-routine themes
 * @param {Object} options.vars - Variables for interpolation
 * @returns {string} Resolved label
 */
export function getLabel(key, options = {}) {
  const { count = 1, routineId = null, vars = {} } = options;

  // Get theme (per-routine or global)
  const theme = routineId
    ? _deps.getRoutineTheme?.(routineId)
    : _deps.getActiveTheme?.();

  // Resolve label: theme override → default
  const label = theme?.labels?.[key] ?? DEFAULT_LABELS[key];

  if (!label) {
    console.warn(`Unknown label key: ${key}`);
    return key;
  }

  // Handle pluralization
  if (typeof label === 'object' && ('one' in label || 'other' in label)) {
    const plural = count === 1 ? 'one' : 'other';
    return interpolate(label[plural] || label.other, { count, ...vars });
  }

  // Handle string interpolation
  if (typeof label === 'string') {
    return interpolate(label, { count, ...vars });
  }

  return String(label);
}

/**
 * Interpolate variables into a string
 * Supports: {var}, {count, plural, one {x} other {y}}
 */
function interpolate(template, vars) {
  return template.replace(/\{(\w+)(?:,\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\})?\}/g,
    (match, key, one, other) => {
      if (one !== undefined && other !== undefined) {
        // Plural form
        return vars[key] === 1 ? one : other;
      }
      // Simple variable
      return vars[key] ?? match;
    }
  );
}

/**
 * Get an icon for the current theme
 * @param {string} key - Icon key
 * @param {string} routineId - Optional routine ID
 * @returns {string} Icon (emoji or character)
 */
export function getIcon(key, routineId = null) {
  const theme = routineId
    ? _deps.getRoutineTheme?.(routineId)
    : _deps.getActiveTheme?.();

  const defaultIcons = {
    taskComplete: '✓',
    taskIncomplete: '○',
    cycleComplete: '🎉',
    highPriority: '⭐',
    recurring: '🔄'
  };

  return theme?.icons?.[key] ?? defaultIcons[key] ?? '';
}
```

### Per-Routine Theme Storage

```javascript
// In cycle/routine object
{
  "cycle-abc123": {
    "name": "Morning Workout",
    "contextLens": "fitness-tracker",  // Per-routine lens
    "tasks": [...],
    // ...
  }
}

// In settings (for defaults)
{
  "settings": {
    "defaultContextLens": "classic",
    "unlockedLenses": ["classic", "habit-tracker", "fitness-tracker"]
  }
}
```

### Schema Addition (Compatible with 2.5)

```javascript
// Additive changes - no migration required
{
  // Existing structure unchanged

  "settings": {
    // ... existing settings

    // New fields
    "defaultContextLens": "classic",
    "unlockedLenses": ["classic"],
    "customLens": null  // User-created lens (unlocked at 50 cycles)
  },

  "data": {
    "cycles": {
      "cycle-abc123": {
        // ... existing fields

        // New field
        "contextLens": "classic"  // Defaults to "classic" if missing
      }
    }
  }
}
```

---

## Initial Lens Set

### 1. Classic (Default)

```javascript
{
  "id": "classic",
  "name": "Classic",
  "description": "The original miniCycle experience",
  "unlockAt": null,  // Always available

  "labels": {
    "task": { "one": "task", "other": "tasks" },
    "cycle": { "one": "cycle", "other": "cycles" },
    "addTask": "Add task",
    "completeAll": "Complete All",
    "cycleCompleted": "Cycle completed!"
  },

  "icons": {
    "taskComplete": "✓",
    "cycleComplete": "🎉"
  }
}
```

### 2. Habit Tracker (Unlock: 10 cycles)

```javascript
{
  "id": "habit-tracker",
  "name": "Habit Tracker",
  "description": "Build streaks, track habits",
  "unlockAt": { "cycles": 10, "tasks": 50 },

  "labels": {
    "task": { "one": "habit", "other": "habits" },
    "cycle": { "one": "streak", "other": "streaks" },
    "routine": { "one": "habit list", "other": "habit lists" },
    "addTask": "Add habit",
    "completeAll": "Complete Day",
    "clearAll": "Reset Habits",
    "cycleCompleted": "Day completed! Streak extended!",
    "cyclesCompleted": "{count} day {count, plural, one {streak} other {streaks}}"
  },

  "icons": {
    "taskComplete": "🔥",
    "cycleComplete": "⚡",
    "highPriority": "💎"
  },

  "preview": {
    "tagline": "Build streaks, track habits",
    "sampleLabels": ["Habit", "Streak", "Complete Day"],
    "sampleIcons": ["🔥", "⚡"]
  }
}
```

### 3. Fitness Tracker (Unlock: 25 cycles)

```javascript
{
  "id": "fitness-tracker",
  "name": "Fitness Tracker",
  "description": "Track workouts, build routines",
  "unlockAt": { "cycles": 25, "tasks": 125 },

  "labels": {
    "task": { "one": "exercise", "other": "exercises" },
    "cycle": { "one": "workout", "other": "workouts" },
    "routine": { "one": "routine", "other": "routines" },
    "addTask": "Add exercise",
    "completeAll": "Finish Workout",
    "clearAll": "Clear Routine",
    "cycleCompleted": "Workout complete!",
    "cyclesCompleted": "{count} {count, plural, one {workout} other {workouts}} completed"
  },

  "icons": {
    "taskComplete": "💪",
    "cycleComplete": "🏆",
    "highPriority": "⚡"
  },

  "preview": {
    "tagline": "Track workouts, build routines",
    "sampleLabels": ["Exercise", "Workout", "Finish Workout"],
    "sampleIcons": ["💪", "🏆"]
  }
}
```

### 4. Custom Lens (Unlock: 50 cycles)

```javascript
{
  "id": "custom",
  "name": "Custom",
  "description": "Create your own lens",
  "unlockAt": { "cycles": 50, "tasks": 250 },
  "editable": true,

  "labels": {
    // User-defined, starts as copy of Classic
  },

  "icons": {
    // User-defined via emoji picker
  }
}
```

---

## UI Changes

### 1. Routine Switcher Updates

Show lens icon alongside mode emoji:

```
┌─────────────────────────────────────────┐
│ 🔥 Daily Habits                    🔄   │
│    Habit Tracker · Modified today       │
├─────────────────────────────────────────┤
│ 💪 Evening Workout                 ✋   │
│    Fitness · Modified yesterday         │
├─────────────────────────────────────────┤
│ ✓  Morning Tasks                   📋   │
│    Classic · Modified 2 days ago        │
└─────────────────────────────────────────┘
```

### 2. Routine Settings: Lens Selector

Add to routine settings (three-dot menu or edit modal):

```
┌─ Routine Settings ─────────────────────┐
│                                        │
│  Name: [Morning Workout          ]     │
│                                        │
│  Mode: ○ Auto  ● Manual  ○ To-Do       │
│                                        │
│  Context Lens:                         │
│  ┌──────────────────────────────────┐  │
│  │ 💪 Fitness Tracker        ✓     │  │
│  │    exercise → workout            │  │
│  ├──────────────────────────────────┤  │
│  │ 🔥 Habit Tracker                 │  │
│  │    habit → streak                │  │
│  ├──────────────────────────────────┤  │
│  │ ✓  Classic                       │  │
│  │    task → cycle                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│           [Cancel]  [Save]             │
└────────────────────────────────────────┘
```

### 3. Lens Unlock Preview

When approaching unlock milestone:

```
┌─ Milestone Progress ───────────────────┐
│                                        │
│  🔒 Fitness Tracker                    │
│  "Track workouts, build routines"      │
│                                        │
│  Preview:                              │
│  • "task" → "exercise"                 │
│  • "cycle" → "workout"                 │
│  • Icons: 💪 🏆                        │
│                                        │
│  ████████████░░░░░░░░ 15/25 cycles     │
│  10 more cycles to unlock              │
│                                        │
└────────────────────────────────────────┘
```

### 4. Settings: Personalization Section

Move color themes here, add lens management:

```
┌─ Personalization ──────────────────────┐
│                                        │
│  Colors                                │
│  ├─ Header: [████] #667eea             │
│  ├─ Background: [████] #f5f5f5         │
│  ├─ Accent: [████] #764ba2             │
│  └─ Quick Presets: Ocean | Sunset | …  │
│                                        │
│  ─────────────────────────────────────  │
│                                        │
│  Default Lens for New Routines         │
│  [▼ Classic                    ]       │
│                                        │
│  Unlocked Lenses: 3/4                  │
│  ✓ Classic  ✓ Habit  ✓ Fitness  🔒 Custom │
│                                        │
└────────────────────────────────────────┘
```

### 5. Custom Lens Builder (v2)

Unlocked at 50 cycles:

```
┌─ Custom Lens Builder ──────────────────┐
│                                        │
│  Lens Name: [My Custom Lens     ]      │
│                                        │
│  Terminology                           │
│  ├─ Task called:    [item        ]     │
│  ├─ Tasks called:   [items       ]     │
│  ├─ Cycle called:   [round       ]     │
│  ├─ Cycles called:  [rounds      ]     │
│  └─ "Complete All": [Finish Round]     │
│                                        │
│  Icons                                 │
│  ├─ Task complete:  [😊] (picker)      │
│  ├─ Cycle complete: [🎯] (picker)      │
│  └─ High priority:  [❗] (picker)      │
│                                        │
│         [Reset] [Preview] [Save]       │
└────────────────────────────────────────┘
```

---

## Migration Strategy

### For Existing Users

```javascript
// In migration/boot code
function migrateToContextLenses() {
  const state = AppState.get();

  // Already migrated?
  if (state.settings.unlockedLenses) return;

  // Initialize lens system
  const unlockedLenses = ['classic'];

  // Grant lenses based on existing progress
  const progress = state.userProgress?.cyclesCompleted || 0;

  if (progress >= 10) unlockedLenses.push('habit-tracker');
  if (progress >= 25) unlockedLenses.push('fitness-tracker');
  if (progress >= 50) unlockedLenses.push('custom');

  // Bonus for early adopters: if they had Dark Ocean/Golden Glow unlocked,
  // those move to Personalization (always available) + they get a free lens
  if (state.settings.unlockedThemes?.includes('dark-ocean') && progress < 10) {
    unlockedLenses.push('habit-tracker');
    showNotification('🎁 Habit Tracker lens unlocked - thanks for being an early user!');
  }

  AppState.update(s => {
    s.settings.unlockedLenses = unlockedLenses;
    s.settings.defaultContextLens = 'classic';

    // Set all existing routines to 'classic' lens
    Object.values(s.data.cycles).forEach(cycle => {
      if (!cycle.contextLens) {
        cycle.contextLens = 'classic';
      }
    });
  });
}
```

### Color Theme Migration

```javascript
// Dark Ocean and Golden Glow become Personalization presets
const COLOR_PRESETS = {
  'dark-ocean': {
    name: 'Dark Ocean',
    colors: {
      header: '#1a365d',
      background: '#0d1b2a',
      accent: '#4299e1',
      text: '#e2e8f0'
    }
  },
  'golden-glow': {
    name: 'Golden Glow',
    colors: {
      header: '#744210',
      background: '#fffaf0',
      accent: '#d69e2e',
      text: '#2d3748'
    }
  }
};

// These are available to ALL users in Personalization
// No unlock required anymore
```

---

## Implementation Phases

### Phase 1: Foundation (3-4 days)

1. **Create label registry** (`modules/labels/defaultLabels.js`)
   - Audit all user-facing strings in codebase
   - Create canonical key for each string
   - Document each label's usage context

2. **Implement label resolver** (`modules/labels/labelResolver.js`)
   - `getLabel(key, options)` function
   - Pluralization support
   - Interpolation support
   - Theme override logic

3. **Create lens schema** (`modules/themes/contextLenses.js`)
   - Define JSON schema for lenses
   - Create Classic lens as default
   - Validation for lens files

### Phase 2: Core Integration (4-5 days)

4. **Migrate UI components to use `getLabel()`**
   - Start with high-visibility components (header, buttons)
   - Progress through all components systematically
   - Test each component with Classic lens

5. **Add per-routine lens storage**
   - Add `contextLens` field to routine schema
   - Default to 'classic' for existing routines
   - Update routine CRUD operations

6. **Implement lens switching**
   - Load correct lens when switching routines
   - Update all UI on lens change
   - Handle missing/invalid lens gracefully

### Phase 3: Lenses & UI (3-4 days)

7. **Create initial lens set**
   - Classic (default)
   - Habit Tracker
   - Fitness Tracker

8. **Build lens selector UI**
   - Add to routine settings modal
   - Show lens preview (labels + icons)
   - Lock indicator for unavailable lenses

9. **Update Routine Switcher**
   - Show lens icon per routine
   - Add lens to routine card display

### Phase 4: Unlock System (2-3 days)

10. **Integrate with achievement system**
    - Check lens unlocks on cycle completion
    - Show unlock notification with preview
    - Update milestones display

11. **Lens preview on milestone approach**
    - Show what's coming in stats panel
    - Preview labels and icons
    - Progress indicator

12. **Migration for existing users**
    - Grant appropriate lenses based on progress
    - Early adopter bonus
    - Move color themes to Personalization

### Phase 5: Polish & Custom (2-3 days)

13. **Move color themes to Personalization**
    - Dark Ocean, Golden Glow as presets
    - Available to all users
    - No unlock required

14. **Custom lens builder** (if time permits)
    - Simple UI for label customization
    - Emoji picker for icons
    - Save/load custom lens

15. **Testing & refinement**
    - Test all flows with each lens
    - Edge cases (lens switching mid-flow)
    - Performance testing

---

## String Audit Checklist

### High Priority (User sees constantly)
- [ ] Task item text/labels
- [ ] "Add task" input placeholder
- [ ] "Complete All" / "Clear All" buttons
- [ ] Progress text ("3 of 5 tasks")
- [ ] Cycle count display
- [ ] Mode labels (Auto/Manual/To-Do)
- [ ] Header/title elements

### Medium Priority (User sees often)
- [ ] Notification messages
- [ ] Modal titles and buttons
- [ ] Stats panel labels
- [ ] Milestone names
- [ ] Help text
- [ ] Empty state messages
- [ ] Search placeholders

### Lower Priority (User sees occasionally)
- [ ] Settings labels
- [ ] Error messages
- [ ] Onboarding text
- [ ] Confirmation dialogs
- [ ] Tooltip text
- [ ] Accessibility labels (aria-label)

---

## Testing Strategy

### Unit Tests
- `labelResolver.js` - All pluralization cases
- `labelResolver.js` - Interpolation edge cases
- `labelResolver.js` - Theme override logic
- `contextLenses.js` - Schema validation

### Integration Tests
- Lens switching updates all UI
- Per-routine lens isolation
- Unlock flow triggers correctly
- Migration preserves user data

### Manual Testing Matrix

| Flow | Classic | Habit | Fitness | Custom |
|------|---------|-------|---------|--------|
| Add task | | | | |
| Complete task | | | | |
| Complete cycle | | | | |
| Cycle notification | | | | |
| Stats panel | | | | |
| Mode switching | | | | |
| Routine creation | | | | |
| Routine switching | | | | |
| Onboarding | | | | |
| Help window | | | | |

---

## Success Metrics

1. **Adoption** - % of users who switch from Classic lens
2. **Retention** - Do lens users complete more cycles?
3. **Discovery** - Search traffic for "habit tracker," "fitness tracker," etc.
4. **Unlock motivation** - Do approaching-unlock notifications increase engagement?

---

## Future Expansion

### Additional Lenses (Post-Launch)
- **Pet Care** - care task/care routine, 🐾 🦴
- **Study Tracker** - topic/study session, 📚 🎓
- **Cleaning** - chore/cleaning cycle, 🧹 ✨
- **Cooking** - recipe/menu, 🍳 👨‍🍳
- **Self Care** - activity/wellness routine, 🧘 💆

### Advanced Features
- **Community lenses** - User-submitted lens marketplace
- **Lens suggestions** - AI suggests lens based on routine names
- **Lens statistics** - Which lenses are most popular?

### Internationalization (i18n)

The lens system is designed to be compatible with a future language pack system. When i18n ships, the label resolution order becomes: **locale → lens → default (English)**. Lens JSON files will support an optional locale-keyed structure:

```javascript
// Current (English only, works today)
"labels": { "task": { "one": "exercise", "other": "exercises" } }

// Future (with locale support)
"labels": {
  "en": { "task": { "one": "exercise", "other": "exercises" } },
  "ja": { "task": "エクササイズ" },
  "zh": { "task": "锻炼" },
  "es": { "task": { "one": "ejercicio", "other": "ejercicios" } }
}
```

The resolver will detect whether a lens uses the flat (English-only) or locale-keyed structure and handle both. This means existing lenses work unchanged when i18n launches.

See: **[I18N_LANGUAGE_PACK_PLAN.md](./I18N_LANGUAGE_PACK_PLAN.md)** for the full internationalization plan.

---

## Open Questions

1. **Should lens affect data export?** When exporting .mcyc, include lens? What if recipient doesn't have that lens unlocked?

2. **Lens in recurring tasks?** Should recurring task notifications use lens terminology?

3. **Per-routine vs global default?** If user sets "Fitness" as default, should existing routines update?

4. **Lens and achievements?** Should achievement names change? "50 workouts completed" vs "50 cycles completed"?

---

## Related Documentation

- [FEATURE_LIST.md](../features/FEATURE_LIST.md) - Current feature inventory
- [THEME_ARCHITECTURE.md](./THEME_ARCHITECTURE.md) - Existing theme system
- [SCHEMA_2_6_PLAN.md](./SCHEMA_2_6_PLAN.md) - Schema evolution plans
- [HISTORY_AND_ACHIEVEMENTS_PLAN.md](./HISTORY_AND_ACHIEVEMENTS_PLAN.md) - Achievement system
- [I18N_LANGUAGE_PACK_PLAN.md](./I18N_LANGUAGE_PACK_PLAN.md) - Internationalization plan

---

**Author:** sparkinCreations
**Created:** January 2026
**Last Updated:** January 2026
