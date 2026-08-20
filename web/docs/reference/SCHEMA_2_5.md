# miniCycle Schema 2.5 Documentation

**Version**: See [PROJECT_STATS.md](../PROJECT_STATS.md)
**Last Updated**: July 26, 2026 — audited field-by-field against `createInitialState()`, `types.js`, and the modules that read/write each field.

## Overview

Schema 2.5 represents the current data structure for miniCycle, consolidating all application state, user data, settings, and metadata into a single unified format. This schema supports multiple cycles, recurring tasks, theme unlocks, and comprehensive user progress tracking.

> **Source of Truth**: `modules/core/types.js` contains the canonical JSDoc type definitions.

## Schema Version

**Current Version**: `2.5`

### Two Version Stamps (Document vs. Task)

miniCycle data carries **two separate version stamps**, and they are *intentionally
different values of different types*. They are not a mismatch — they count two
different things:

| Stamp | Where it lives | Current value | Type |
|-------|----------------|---------------|------|
| **Document version** | Top-level `schemaVersion` and `metadata.schemaVersion` | `"2.5"` | string |
| **Task version** | `schemaVersion` on each individual task | `2` | number |

Think of it as a **shipping container with individually-labeled boxes**:

- The **document version** is the label on the whole container — it describes how
  the entire data structure is organized (which sections exist, how cycles are
  stored, etc.).
- The **task version** is a label on each box inside — it describes the shape of a
  *single task*.

Why both exist: a task can travel on its own — exported, shared, copied, or
spawned from a recurring template — *apart from* the document it came from. Its own
version stamp lets any code understand a single task without needing the whole
document. The two also evolve on independent timelines: the document layout can
change without changing a task's shape, and vice versa, so each gets its own counter.

**Current behavior (as implemented today):**

- Every task is written with `schemaVersion: 2` (a number). New, imported, exported,
  and recurring tasks all receive `2`.
- No code compares a task's version to decide it is "outdated." The only task-version
  read (`routineLoader`) simply repairs a missing/invalid stamp back to `2`. So `2`
  is the current, correct task value — not a leftover from an older "Schema 2."
- The document version `"2.5"` is the value gated on for migrations and validation
  (e.g. `schemaVersion === "2.5"`). Pre-2.5 migration applies only to dev-era data;
  public data is always 2.5.

> **Note:** The two stamps currently differ in type (string `"2.5"` vs. number `2`).
> This is accepted as-is today. Because versions are compared by exact match
> (`=== "2.5"`) and task versions are never compared with `<`/`>`, the type difference
> is currently harmless. This document describes current behavior only.

## Complete Schema Structure

```javascript
{
  schemaVersion: "2.5",

  metadata: {
    createdAt: 1696723400000,              // Unix timestamp
    lastModified: 1696723445123,           // Unix timestamp
    appVersion: "1.729",                   // App version string
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
    oneMenuSectionAtATime: true,           // Accordion for menu/settings/personalization (absent = true)
    // Accessibility is FLAT (not nested under an `accessibility` object):
    reducedMotion: false,                  // Reduce animations
    highContrast: false,                   // High contrast mode
    fontSize: "16",                        // Base font size (string)
    debugMode: false,                      // Debug mode enabled
    // …plus guided-tour step trackers (guidedTourStep, statsTourStep, …),
    // customColors {}, savedColorPresets [], and the three collapsed-section
    // maps (menuCollapsedSections, settingsCollapsedSections,
    // preferencesCollapsedSections — see the UI Preferences table below).
    // And more: see createInitialState() in
    // appState.js / the Settings typedef in types.js for the exhaustive list.
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
          deleteWhenComplete: false        // 🧹 Clear on Reset / Marked for Clearing (per-mode auto-remove)
        },
        history: [],                       // Per-routine activity log
        clearedTasks: {                    // Cleared tasks (To-Do mode clears + cycle reset auto-removes)
          entries: [],                     // Array of cleared task records
          totalCleared: 0,                 // Total tasks cleared in this routine
          autoPruneEnabled: true           // Whether old entries are auto-pruned
        }
      }
    }
  },

  appState: {
    activeCycleId: "cycle-abc123",         // Currently selected cycle
    overdueTaskStates: {}                  // { [taskId]: boolean }
    // NOTE: the current mode is NOT stored here — it's derived from the active
    // cycle's autoReset / deleteCheckedTasks flags (see modeManager).
  },

  ui: {
    moveArrowsVisible: false,              // Global arrow visibility
    activeTaskId: null                     // Task ID whose options are currently open
  },

  userProgress: {
    cyclesCompleted: 42,                   // Total cycles completed (global)
    rewardMilestones: []                   // Reached milestone IDs (e.g., "golden-glow-50")
    // Fresh state seeds only these two. A `streaks` object is NOT currently
    // written by any code path — treat it as not-yet-implemented.
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
| `oneMenuSectionAtATime` | boolean | Accordion behaviour for the main menu, settings modal and personalization modal — one section open at a time, each surface opening fully collapsed. **Absent reads as `true`.** When `false`, the three `*CollapsedSections` maps are applied on open instead |
| `menuCollapsedSections` | object | Main menu section name → collapsed. Written on every toggle in **both** modes; only read when `oneMenuSectionAtATime` is `false` |
| `settingsCollapsedSections` | object | Settings modal section name → collapsed. Same write-always / read-conditionally rule |
| `preferencesCollapsedSections` | object | Personalization modal section name → collapsed. Same rule; includes `live-preview`, which is never part of the accordion |

#### Accessibility (flat settings fields — **not** nested under an `accessibility` object)
| Field | Type | Description |
|-------|------|-------------|
| `reducedMotion` | boolean | Reduce animations |
| `highContrast` | boolean | High contrast mode |
| `fontSize` | string | Base font size (e.g. `"16"`) |

#### Collapsible-section State
| Field | Type | Description |
|-------|------|-------------|
| `menuCollapsedSections` | object | Per-section collapse state for the main menu |
| `settingsCollapsedSections` | object | Per-section collapse state for Settings |

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
| `clearedTasks` | object | Cleared tasks tracking (To-Do mode + cycle reset auto-removes) |
| `clearedTasks.entries` | array | Array of cleared task records |
| `clearedTasks.totalCleared` | number | Total tasks cleared in this routine |
| `clearedTasks.autoPruneEnabled` | boolean | Whether old entries are automatically pruned |

#### History Entry Structure

Each entry in the `history` array:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Entry type (e.g., "task_completed", "cycle_completed") |
| `taskId` | string | Task ID (if applicable) |
| `taskText` | string | Task text at time of action |
| `timestamp` | number | Unix timestamp of action |

#### Cleared Task Record Structure

Each entry in `clearedTasks.entries`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique id for the cleared entry (e.g. `clr-...`) |
| `taskText` | string | Text of the cleared task |
| `clearedAt` | number | Unix timestamp when cleared |
| `wasHighPriority` | boolean | Whether the task was high priority when cleared |
| `hadDueDate` | boolean | Whether the task had a due date |
| `dueDate` | string\|null | The task's due date, if any |
| `priorityColor` | string\|null | The task's priority color, if any |
| `remindersEnabled` | boolean | Whether task reminders were enabled |
| `deleteWhenComplete` | boolean | Active delete-when-complete flag at clear time |
| `deleteWhenCompleteSettings` | object\|null | Per-mode delete-when-complete settings snapshot |

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
| `deleteWhenComplete` | 🧹 Clear on Reset (cycle) / Marked for Clearing (to-do) |

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
| `schemaVersion` | number | Per-task shape version. Currently the number `2`. This is a *separate* counter from the document's `schemaVersion` (`"2.5"`) — see "Two Version Stamps" below. |
| `createdAt` | string | ISO timestamp of creation |
| `completedAt` | string\|null | ISO timestamp of completion |
| `deleteWhenComplete` | boolean | 🧹 Active flag for current mode (synced from deleteWhenCompleteSettings) |
| `deleteWhenCompleteSettings` | object | Per-mode settings: `{ cycle: boolean, todo: boolean }` |

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
| `overdueTaskStates` | object | Map of task ID to overdue boolean |

> The current **mode** is not stored in `appState` — it's derived from the active cycle's `autoReset` / `deleteCheckedTasks` flags (see modeManager).

### UI State

Global UI configuration:

| Field | Type | Description |
|-------|------|-------------|
| `moveArrowsVisible` | boolean | Global arrow visibility |
| `activeTaskId` | string\|null | Task ID whose options panel is currently open |

### User Progress

Gamification and achievement tracking:

| Field | Type | Description |
|-------|------|-------------|
| `cyclesCompleted` | number | Total cycles completed (global across all routines) |
| `rewardMilestones` | string[] | Reached milestone IDs (e.g., "golden-glow-50") |

> `streaks` and a `userProgress.totalTasksCompleted` are **not** written by the current code — fresh state seeds only `cyclesCompleted` + `rewardMilestones`. Don't rely on them. (Lifetime task/cycle totals live in `metadata.totalTasksCompleted` / `metadata.totalCyclesCreated`.)

### Achievements

OR-based achievement system (unlock via cycles OR tasks):

| Field | Type | Description |
|-------|------|-------------|
| `unlocked` | string[] | Array of unlocked achievement/badge IDs |
| `seen` | object | Map of achievement ID to boolean (user has seen popup) |

**`achievements.unlocked` and `settings.unlockedThemes` are deliberately separate.**
They look like the same idea — "things the user has earned" — and they are not:

- `achievements.unlocked` is a permanent RECORD of milestones reached. Nothing
  consumes it to gate functionality; it drives badges and the achievements modal.
- `settings.unlockedThemes` is an ENTITLEMENT list the theme system reads to decide
  what the user may actually apply, and it is written by other paths too (import
  reads it to decide whether a routine's theme survives — see
  `notify.themeLockedOnImport`).

Merging them would make a cosmetic badge record load-bearing for theme access, and
would mean an import touching theme entitlements could rewrite the user's milestone
history. Keep them apart.

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

## Undo Snapshots — new state surfaces must join the signature

`undoRedoManager.buildSnapshotSignature()` reduces a snapshot to a comparison key
and **skips pushing** anything whose key matches the previous entry. That dedup is
what stops a burst of no-op updates flooding the undo stack.

The consequence is a rule worth knowing before adding to the schema:

> **Any new user-editable state surface must be added to `buildSnapshotSignature()`,
> or a change touching ONLY that surface will dedup against the previous snapshot
> and never enter undo history.**

It fails silently and looks like "undo just doesn't cover that" rather than a bug.
It has bitten twice already, and both fixes are visible in the function today:

- **Settings objects, not just their booleans.** `recurringSettings` and
  `deleteWhenCompleteSettings` are serialised whole; comparing only the derived
  `recurring` / `deleteWhenComplete` flags meant editing a schedule without
  toggling the flag was invisible.
- **`taskViewLayout.positions`.** A drag-end or dock-back changes nothing else, so
  without `tvl` in the key the whole Task View layout feature sat outside undo.

The same applies to anything added under `settings`, `data.cycles[id]`, or a task
record. If it is user-editable and worth undoing, it belongs in the signature.

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
- [DATA_SCHEMA_GUIDE.md](DATA_SCHEMA_GUIDE.md) - Schema guide with data flow
- [types.js](../../modules/core/types.js) - Canonical JSDoc type definitions
- [minicycle-recurring-guide.md](RECURRING_SYSTEM_REFERENCE.md) - Recurring task implementation
