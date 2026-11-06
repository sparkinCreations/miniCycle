# Data Schema Guide

**Last verified:** Nov 6 2026

> **For current version, see [PROJECT_STATS.md](../PROJECT_STATS.md).**
>
> This is the short tour. The full field-by-field reference is
> [SCHEMA_2_6.md](SCHEMA_2_6.md); read stored names through the accessors in
> `modules/utils/cycleMode.js` (`getActiveRoutine()`, `getRoutine()`, `getAutoClear()`, …)
> and `modules/utils/priorityLevel.js`, not by spelling the keys.

---

## Table of Contents

1. [Schema 2.6 Structure](#schema-26-structure-current)
2. [How Data Flows](#how-data-flows)
3. [Real Example: Adding a Task](#real-example-adding-a-task)

---

## Schema 2.6 Structure (Current)

> **Source of truth is the code that writes the data:** `createInitialSchemaData()`
> (`modules/routine/migrationManager.js`) for a fresh install, `routineManager.js` for a
> new routine, `task/taskUtils.js` and `recurring/recurringTemplate.js` for tasks and
> templates, and `routine/schemaMigration26.js` for migrated 2.5 data. The JSDoc in
> `modules/core/types.js` is partly stale (its `Cycle` typedef still names `name` as the
> display field; it is `title`), so check it against those writers.

```typescript
{
    schemaVersion: "2.6",

    metadata: {
        createdAt: 1696723400000,            // Unix timestamp
        lastModified: 1696723445123,         // Unix timestamp
        migratedFrom: "2.0",                 // Previous schema version (null when fresh)
        migrationDate: "2025-10-07",         // Migration date (null when fresh)
        totalRoutinesCreated: 5,               // Total cycles ever created
        totalCyclesCompleted: 12,            // Total cycles ever completed
        schemaVersion: "2.6",                // Also stamped here, not just at the root
        lastModifiedBy: "tab-x7f2"           // Writing tab's id (multi-tab conflict check)
        // NOT here: `appVersion`, `migrationHistory` and `totalTasksCompleted`
        // were listed but nothing writes them. `totalTasksCompleted` is real and
        // lives on `userProgress`.
    },

    data: {
        routine: {
            // KEYS — the code in this tree does two things:
            //  • The 2.5 → 2.6 boot migration re-keys every existing routine
            //    under a generated id (GlobalUtils.generateId('routine')), so
            //    key === id, as below.
            //  • Routines created, imported, duplicated or renamed from the UI
            //    (routineManager.js, cycleImportManager.js,
            //    routineSwitcherActions.js, menuManager.js, titleManager.js) are
            //    still filed under their TITLE, and a rename moves the entry to
            //    the new title. Their `id` is set separately (e.g.
            //    `cycle_<timestamp>`, `imported_<timestamp>`).
            // So never assume key === id or key === title: look routines up with
            // getRoutine(state, key) and getActiveRoutineId(state).
            // `title` is the display name (there is no `name` field).
            "routine-1789760998636-bqphapbbc": {
                id: "routine-1789760998636-bqphapbbc",
                title: "Morning Routine",    // Display name
                theme: "classic",            // Per-routine vocabulary theme
                showTaskInput: true,         // Per-routine task-input bar visibility
                cycleCount: 42,              // Times completed
                autoReset: true,             // Auto-cycle mode
                deleteCheckedTasks: false,   // To-Do mode (wins over autoReset)
                createdAt: 1696723400000,    // Creation timestamp
                lastModified: 1696723445123, // OPTIONAL — absent until first edit
                                             // (previews fall back to createdAt)
                tasks: [
                    {
                        id: "task-xyz789",
                        text: "☕ Make coffee",
                        completed: false,
                        priority: null,          // 'high'|'medium'|'low'|null — a level, no colour stored
                        dueDate: null,           // ISO string or null
                        dueTime: null,           // "HH:MM" or null, only beside a dueDate
                        remindersEnabled: false,
                        recurring: false,
                        recurringSettings: {},
                        autoClear: { cycle: false, todo: true }, // Clear on Reset / Marked for Clearing, per mode
                                                 // (defaults: DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS)
                        schemaVersion: 2         // per-task shape version (number)
                        // NOT written by task creation: `createdAt`, `completedAt`
                    }
                ],
                recurringTemplates: {            // keyed by the task's id (buildRecurringTemplate)
                    "task-def456": {
                        id: "task-def456",
                        text: "💊 Take medication",
                        recurring: true,
                        priority: 'high',
                        dueDate: null,
                        dueTime: null,
                        remindersEnabled: true,
                        autoClear: { cycle: true, todo: true },  // DEFAULT_RECURRING_DELETE_SETTINGS
                        recurringSettings: {
                            frequency: "daily",      // hourly|daily|weekly|biweekly|monthly|yearly
                            indefinitely: true,
                            // …plus count, untilDate, time, specificDates and one
                            // block per frequency — the full shape is what
                            // normalizeRecurringSettings() (recurring/recurringSettings.js)
                            // returns; see RECURRING_SYSTEM_REFERENCE.md
                        },
                        occurrenceCount: 0,
                        lastTriggeredTimestamp: null,
                        paused: false,
                        nextScheduledOccurrence: 1696809600000, // null = never fires again
                        position: null,              // where a recreated instance is inserted
                        schemaVersion: 2             // RECURRING_TEMPLATE_SCHEMA_VERSION
                    }
                },
                taskOptionButtons: {             // defaults: DEFAULT_TASK_OPTION_BUTTONS (utils/globalUtils.js)
                    customize: true,
                    moveArrows: false,
                    highPriority: true,          // visibility of the priority button (a boolean, not a level)
                    rename: true,
                    delete: true,
                    recurring: false,
                    dueDate: false,
                    reminders: false,
                    deleteWhenComplete: false    // visibility of the Clear on Reset button (an option-button id)
                },
                history: { events: [], maxEvents: 100 },   // an OBJECT, not an array
                clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: true },
                reminders: {}                    // per-routine reminder settings
            }
        }
    },

    appState: {
        activeRoutineId: "routine-1789760998636-bqphapbbc", // The active routine's generated id
        overdueTaskStates: {}                // {[taskId]: boolean}
        // Mode is NOT stored here — derived from the cycle's autoReset/deleteCheckedTasks.
    },

    ui: {                                    // ⚠️ OPTIONAL — created on demand, not part of
                                             // the minimal valid shape (validateStateStructure
                                             // requires only schemaVersion, data.routine, appState)
        moveArrowsVisible: false,
        activeTaskId: null                   // Task ID whose options panel is open
    },

    settings: {
        theme: "default",
        darkMode: false,
        alwaysShowRecurring: false,
        autoSave: true,
        showThreeDots: false,
        onboardingCompleted: false,
        dismissedEducationalTips: {},
        defaultRecurringSettings: {
            frequency: "daily",
            indefinitely: true
        },
        unlockedThemes: [],
        unlockedFeatures: [],
        notificationPosition: { x: 100, y: 20 },
        notificationPositionModified: false,
        showCompletedDropdown: false,
        completedTasksExpanded: false,
        reducedMotion: false,                // FLAT — not nested under `accessibility`
        highContrast: false,
        fontSize: "16",
        debugMode: false
        // …plus tour-step trackers, customColors, savedColorPresets,
        // menuCollapsedSections, settingsCollapsedSections. Full list: SCHEMA_2_6.md / types.js.
    },

    customReminders: {
        enabled: false,
        indefinite: false,
        dueDatesReminders: false,
        repeatCount: 0,
        frequencyValue: 30,
        frequencyUnit: "minutes"             // "minutes"|"hours"|"days"
        // NOT here: `customMessages` appears nowhere in the codebase.
    },

    userProgress: {
        cyclesCompleted: 42,                 // Global cycles completed
        totalTasksCompleted: 156,            // Lifetime To-Do clears (Auto/Manual Cycle clears don't count)
        rewardMilestones: []                 // LIVE, not a placeholder — gamesManager
                                             // and statsPanelRewards push
                                             // "task-order-game-100", and
                                             // Reset Progress clears it
        // NOT here (both were listed as placeholders; neither is a field the app writes):
        //  • `achievementsUnlocked` — superseded. Achievements live in the TOP-LEVEL
        //    `achievements` object ({ unlocked: [], seen: {} }), which is what
        //    achievementsManager reads and writes. See SCHEMA_2_6.md.
        //  • `streaks` — never implemented. types.js declares a `StreakData`
        //    typedef, but no code path writes one. (Searching for "streaks" mostly
        //    hit the habit-tracker VOCAB THEME, which renamed "cycle" to "streak"
        //    in UI labels — unrelated to state.)
    },

    achievements: {                          // The real achievements store (created on demand)
        unlocked: [],                        // Unlocked achievement IDs
        seen: {}                             // { [achievementId]: boolean }
    }
}
```

---

## How Data Flows

```
User Action
    ↓
DOM Event Handler
    ↓
AppState.update((state) => {
    // Modify state
})
    ↓
State Listeners Notified (immediate)
    ↓
UI Components Refresh
    ↓
Debounced Save (DEBOUNCE.STATE_SAVE, 600ms; immediate = true saves now)
    ↓
AppState.save() → storage key STORAGE_KEYS.DATA ("miniCycleData")
```

**Note**: Listeners are notified immediately after state mutation, but localStorage persistence is debounced to avoid excessive writes during rapid changes.

---

## Real Example: Adding a Task

A simplified sketch of what `addTaskImpl()` (`modules/task/taskCRUD.js`) does through
`TaskUtils.loadTaskContext()` and `TaskUtils.createOrUpdateTaskData()`
(`modules/task/taskUtils.js`). Real callers just call `addTask(text, options)` —
see [API_REFERENCE.md](API_REFERENCE.md#task-management).

```javascript
// User types "Buy groceries" and clicks Add.
// AppState and generateId arrive by dependency injection, not window.*
import { getActiveRoutineId, getRoutine, autoClearFields } from '../utils/cycleMode.js';
import { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS } from '../core/constants.js';

async function addTask(taskText) {
    const { AppState, generateId } = this.deps;

    // 1. Read the active routine's key through the cycleMode.js accessors
    const routineId = getActiveRoutineId(AppState.get());

    // 2. Build the task (the stored shape above)
    const newTask = {
        id: generateId(),
        text: taskText,
        completed: false,
        priority: null,
        dueDate: null,
        dueTime: null,
        remindersEnabled: false,
        recurring: false,
        recurringSettings: {},
        ...autoClearFields({ defaults: DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }),
        schemaVersion: 2
    };

    // 3. Commit inside the producer — never mutate AppState.get()'s object directly
    await AppState.update((state) => {
        getRoutine(state, routineId).tasks.push(newTask);
    }, true);  // true = save immediately

    // 4. Render it (the real path builds the row in taskDOM / taskRenderer and
    //    appends it to document.getElementById(DOM_IDS.TASK_LIST))
}
```

---

## Next Steps

- **[API Reference](API_REFERENCE.md)** - Browse available functions and modules
- **[Development Workflow](../working-on-code/DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Architecture Overview](../architecture/ARCHITECTURE_OVERVIEW.md)** - Understand the system structure

---

**Questions?** The [docs index](../INDEX.md) routes you to the guide to read first.
