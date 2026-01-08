# miniCycle Schema 2.5 Documentation

**Version**: 1.684
**Last Updated**: January 8, 2026

## Overview

Schema 2.5 represents the current data structure for miniCycle, consolidating all application state, user data, settings, and metadata into a single unified format. This schema supports multiple cycles, recurring tasks, theme unlocks, and comprehensive user progress tracking.

> **Source of Truth**: `modules/core/types.js` contains the canonical JSDoc type definitions.

## Schema Version

**Current Version**: `2.5`

## Complete Schema Structure

```javascript
{
  schemaVersion: "2.5",

  metadata: {
    createdAt: 1696723400000,              // Unix timestamp
    lastModified: 1696723445123,           // Unix timestamp
    appVersion: "1.684",                   // App version string
    migrationHistory: ["2.0 → 2.5"],       // Migration path history
    migratedFrom: "2.0",                   // Previous schema version
    migrationDate: "2025-10-07",           // When migration occurred
    totalCyclesCreated: 5,                 // Lifetime cycle creation count
    totalTasksCompleted: 156               // Lifetime task completion count
  },

  settings: {
    theme: "default",                      // Current theme name
    darkMode: false,                       // Dark mode enabled
    alwaysShowRecurring: false,            // Always show recurring panel
    autoSave: true,                        // Auto-save enabled
    showThreeDots: false,                  // Global three dots menu visibility
    showTaskInput: true,                   // Show task input bar
    onboardingCompleted: false,            // User completed onboarding
    dismissedEducationalTips: {},          // { [tipId]: boolean }
    defaultRecurringSettings: {            // Default values for new recurring tasks
      frequency: "daily",
      indefinitely: true
    },
    unlockedThemes: [],                    // Themes unlocked through milestones
    unlockedFeatures: [],                  // Features unlocked through milestones
    notificationPosition: { x: 100, y: 20 }, // Draggable notification position
    notificationPositionModified: false,   // User has customized position
    showCompletedDropdown: false,          // Enable completed tasks dropdown
    completedTasksExpanded: false,         // Completed section expanded state
    accessibility: {
      reducedMotion: false,                // Reduce animations
      highContrast: false,                 // High contrast mode
      screenReaderHints: false             // Enhanced screen reader support
    },
    debugMode: false,                      // Debug mode enabled
    statsPanel: {                          // Stats panel preferences
      currentRoutineExpanded: true,        // Current routine section expanded
      milestonesExpanded: false            // Milestones section expanded
    }
  },

  data: {
    cycles: {
      "cycle-abc123": {
        id: "cycle-abc123",                // Unique cycle identifier
        name: "Morning Routine",           // Display name
        title: "Morning Routine",          // Legacy field (same as name)
        cycleCount: 42,                    // Times completed
        autoReset: true,                   // Auto-reset on completion
        deleteCheckedTasks: false,         // Delete tasks when checked
        createdAt: 1696723400000,          // Creation timestamp
        lastModified: 1696723445123,       // Last modification timestamp
        tasks: [/* Task objects */],
        recurringTemplates: {/* Template objects */},
        taskOptionButtons: {
          customize: true,                 // -/+ customize button
          moveArrows: false,               // Move task arrows
          threeDots: false,                // Three dots menu
          highPriority: true,              // High priority toggle
          rename: true,                    // Rename/edit task
          delete: true,                    // Delete task
          recurring: false,                // Recurring task option
          dueDate: false,                  // Due date option
          reminders: false,                // Reminders option
          deleteWhenComplete: false        // Delete when complete option
        },
        history: [],                       // Per-routine activity log
        clearedTasks: {                    // For To-Do mode
          items: [],                       // Array of cleared task records
          totalCleared: 0                  // Total tasks cleared in this routine
        }
      }
    }
  },

  appState: {
    activeCycleId: "cycle-abc123",         // Currently selected cycle
    currentMode: "auto-cycle",             // "auto-cycle"|"manual-cycle"|"todo-mode"
    overdueTaskStates: {}                  // { [taskId]: boolean }
  },

  ui: {
    moveArrowsVisible: false,              // Global arrow visibility
    statsView: "tasks"                     // Current stats panel view
  },

  userProgress: {
    cyclesCompleted: 42,                   // Total cycles completed (global)
    totalTasksCompleted: 156,              // Total tasks cleared in To-Do mode (global)
    rewardMilestones: [],                  // Reached milestone IDs (e.g., "golden-glow-50")
    streaks: {                             // Streak tracking (placeholder)
      current: 0,
      longest: 0
    }
  },

  achievements: {
    unlocked: [],                          // Unlocked achievement IDs (OR-based)
    seen: {}                               // { [achievementId]: boolean } - user has seen popup
  },

  customReminders: {
    enabled: false,                        // Reminders enabled
    indefinite: false,                     // Remind forever
    dueDatesReminders: false,              // Remind about due dates
    repeatCount: 0,                        // Times to repeat
    frequencyValue: 30,                    // Interval value
    frequencyUnit: "minutes",              // "minutes"|"hours"
    customMessages: []                     // Custom reminder messages
  }
}
```

## Key Sections

### Metadata

Tracks application-level information and migration history:

| Field | Type | Description |
|-------|------|-------------|
| `createdAt` | number | Initial data creation timestamp |
| `lastModified` | number | Last update timestamp |
| `appVersion` | string | Application version string |
| `migrationHistory` | string[] | Array of migration paths taken |
| `migratedFrom` | string | Previous schema version (if migrated) |
| `migrationDate` | string | When migration occurred |
| `totalCyclesCreated` | number | Lifetime cycle creation count |
| `totalTasksCompleted` | number | Lifetime task completion count |

### Settings

#### Theme & Display
| Field | Type | Description |
|-------|------|-------------|
| `theme` | string | Currently selected theme name |
| `darkMode` | boolean | Dark mode enabled/disabled |
| `unlockedThemes` | string[] | Themes unlocked through milestones |
| `unlockedFeatures` | string[] | Features unlocked through milestones |

#### Recurring Task Defaults
| Field | Type | Description |
|-------|------|-------------|
| `defaultRecurringSettings.frequency` | string | Daily, weekly, monthly, yearly |
| `defaultRecurringSettings.indefinitely` | boolean | Whether to repeat forever |

#### Notifications
| Field | Type | Description |
|-------|------|-------------|
| `notificationPosition` | {x, y} | User-draggable notification position |
| `notificationPositionModified` | boolean | Whether user has customized position |

#### UI Preferences
| Field | Type | Description |
|-------|------|-------------|
| `showTaskInput` | boolean | Show task input bar |
| `showCompletedDropdown` | boolean | Enable completed tasks dropdown |
| `completedTasksExpanded` | boolean | Completed section expanded state |
| `showThreeDots` | boolean | Global three dots menu visibility |
| `alwaysShowRecurring` | boolean | Always show recurring panel |
| `onboardingCompleted` | boolean | User completed onboarding |
| `dismissedEducationalTips` | object | Map of dismissed tip IDs |
| `debugMode` | boolean | Debug mode enabled |

#### Accessibility
| Field | Type | Description |
|-------|------|-------------|
| `reducedMotion` | boolean | Reduce animations |
| `highContrast` | boolean | High contrast mode |
| `screenReaderHints` | boolean | Enhanced screen reader support |

#### Stats Panel Preferences
| Field | Type | Description |
|-------|------|-------------|
| `statsPanel.currentRoutineExpanded` | boolean | Current routine section expanded |
| `statsPanel.milestonesExpanded` | boolean | Milestones section expanded |

### Data

#### Cycle Structure

Each cycle contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique cycle identifier |
| `name` | string | Display name of the cycle |
| `title` | string | Legacy field (same as name) |
| `tasks` | Task[] | Array of task objects |
| `recurringTemplates` | object | Recurring task template definitions |
| `autoReset` | boolean | Auto-reset on completion (Auto Cycle Mode) |
| `deleteCheckedTasks` | boolean | Delete tasks when checked (To-Do Mode) |
| `cycleCount` | number | Number of times cycle has been completed |
| `createdAt` | number | Creation timestamp |
| `lastModified` | number | Last modification timestamp |
| `taskOptionButtons` | object | Per-cycle button visibility settings |
| `history` | array | Per-routine activity log entries |
| `clearedTasks` | object | Cleared tasks tracking (To-Do mode) |
| `clearedTasks.items` | array | Array of cleared task records |
| `clearedTasks.totalCleared` | number | Total tasks cleared in this routine |

#### History Entry Structure

Each entry in the `history` array:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Entry type (e.g., "task_completed", "cycle_completed") |
| `taskId` | string | Task ID (if applicable) |
| `taskText` | string | Task text at time of action |
| `timestamp` | number | Unix timestamp of action |

#### Cleared Task Record Structure

Each item in `clearedTasks.items`:

| Field | Type | Description |
|-------|------|-------------|
| `taskText` | string | Text of the cleared task |
| `clearedAt` | number | Unix timestamp when cleared |

#### Task Option Buttons

| Field | Description |
|-------|-------------|
| `customize` | -/+ customize button (always true) |
| `moveArrows` | Move task arrows |
| `threeDots` | Three dots menu |
| `highPriority` | High priority toggle |
| `rename` | Rename/edit task |
| `delete` | Delete task |
| `recurring` | Recurring task option |
| `dueDate` | Due date option |
| `reminders` | Reminders option |
| `deleteWhenComplete` | Delete when complete option |

#### Task Object Structure

Each task object in the `tasks` array:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier |
| `text` | string | Task description text |
| `completed` | boolean | Completion status |
| `highPriority` | boolean | Priority flag |
| `dueDate` | string\|null | Due date in ISO format |
| `remindersEnabled` | boolean | Task-specific reminder toggle |
| `recurring` | boolean | Whether task is recurring |
| `recurringSettings` | object | Recurring task configuration |
| `schemaVersion` | number | Schema version (2.5) |
| `createdAt` | string | ISO timestamp of creation |
| `completedAt` | string\|null | ISO timestamp of completion |
| `deleteWhenComplete` | boolean | Auto-remove on reset |

#### Recurring Settings Structure

```javascript
{
  frequency: "daily",              // "daily"|"weekly"|"monthly"|"yearly"|"custom"
  indefinitely: true,              // Repeat forever
  repeatCount: 0,                  // Times to repeat (if not indefinite)
  timesActivated: 0,               // How many times activated
  weekdays: ["Mon", "Wed", "Fri"], // Days for weekly recurrence
  dayOfMonth: 15,                  // Day of month (1-31)
  nthWeekday: "1",                 // Ordinal: "1"|"2"|"3"|"4"|"last"
  weekday: "Mon",                  // Weekday name for nth pattern
  time: {                          // Specific activation time
    hour: 9,
    minute: 0,
    meridiem: "AM"
  },
  daily: { time: "09:00" },        // Daily-specific settings
  weekly: { days: [] },            // Weekly-specific settings
  monthly: {                       // Monthly-specific settings
    dayOfMonth: null,
    nthWeekday: null,
    weekday: null
  },
  lastActivated: null,             // ISO timestamp of last activation
  nextActivation: null             // ISO timestamp of next activation
}
```

### App State

Tracks current application state:

| Field | Type | Description |
|-------|------|-------------|
| `activeCycleId` | string\|null | Currently selected cycle ID |
| `currentMode` | string | "auto-cycle"\|"manual-cycle"\|"todo-mode" |
| `overdueTaskStates` | object | Map of task ID to overdue boolean |

### UI State

Global UI configuration:

| Field | Type | Description |
|-------|------|-------------|
| `moveArrowsVisible` | boolean | Global arrow visibility |
| `statsView` | string | Current stats panel view |

### User Progress

Gamification and achievement tracking:

| Field | Type | Description |
|-------|------|-------------|
| `cyclesCompleted` | number | Total cycles completed (global across all routines) |
| `totalTasksCompleted` | number | Total tasks cleared in To-Do mode (global) |
| `rewardMilestones` | string[] | Reached milestone IDs (e.g., "golden-glow-50") |
| `streaks` | object | Streak tracking (placeholder) |
| `streaks.current` | number | Current streak count |
| `streaks.longest` | number | Longest streak ever |

### Achievements

OR-based achievement system (unlock via cycles OR tasks):

| Field | Type | Description |
|-------|------|-------------|
| `unlocked` | string[] | Array of unlocked achievement/badge IDs |
| `seen` | object | Map of achievement ID to boolean (user has seen popup) |

**Achievement tiers unlock at:**
| Badge | Cycles | Tasks |
|-------|--------|-------|
| Bronze | 5 | 25 |
| Silver | 10 | 50 |
| Gold | 25 | 125 |
| Diamond | 50 | 250 |
| Crown | 100 | 500 |
| Star | 250 | 1250 |
| Lightning | 500 | 2500 |
| Fire | 1000 | 5000 |

### Custom Reminders

User-configurable reminder system:

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Reminders on/off |
| `indefinite` | boolean | Repeat reminders forever |
| `dueDatesReminders` | boolean | Remind about task due dates |
| `repeatCount` | number | Number of times to repeat |
| `frequencyValue` | number | Numeric interval value |
| `frequencyUnit` | string | "minutes"\|"hours" |
| `customMessages` | string[] | Custom reminder messages |

## Migration Support

Schema 2.5 includes built-in migration tracking:

```javascript
metadata: {
  migratedFrom: "2.0",
  migrationDate: "2025-10-15",
  migrationHistory: ["2.0 → 2.5"]
}
```

## Usage Example

```javascript
// Loading data (via DI - AppState is injected, not accessed via window.*)
const state = this.deps.AppState.get();
if (state.schemaVersion === "2.5") {
  const activeCycle = state.data.cycles[state.appState.activeCycleId];
  const isDarkMode = state.settings.darkMode;
}

// Updating data
this.deps.AppState.update(state => {
  state.settings.darkMode = true;
}, true); // true = save immediately
```

## File Format Compatibility

This schema structure is also used in `.mcyc` file exports/imports, ensuring consistent data representation across:
- localStorage persistence
- File exports
- File imports
- Data migrations

## Related Documentation

- [MCYC_FILE_FORMAT.md](./MCYC_FILE_FORMAT.md) - File import/export format
- [DATA_SCHEMA_GUIDE.md](../developer-guides/DATA_SCHEMA_GUIDE.md) - Schema guide with data flow
- [types.js](../../modules/core/types.js) - Canonical JSDoc type definitions
- [minicycle-recurring-guide.md](../features/minicycle-recurring-guide.md) - Recurring task implementation
