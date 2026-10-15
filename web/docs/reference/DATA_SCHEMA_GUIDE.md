# Data Schema Guide

**Last Updated**: January 5, 2026

> **For current version, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

---

## Table of Contents

1. [Schema 2.6 Structure](#schema-26-structure-current)
2. [How Data Flows](#how-data-flows)
3. [Real Example: Adding a Task](#real-example-adding-a-task)

---

## Schema 2.6 Structure (Current)

> **Source of Truth**: `modules/core/types.js` contains the canonical JSDoc type definitions.

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
        schemaVersion: "2.6"                 // Also stamped here, not just at the root
        // NOT here: `appVersion`, `migrationHistory` and `totalTasksCompleted`
        // were listed but nothing writes them. `totalTasksCompleted` is real and
        // lives on `userProgress`.
    },

    data: {
        routine: {
            // Routines are keyed by a GENERATED id — creation, rename,
            // duplication, and import all write `routine[<generated id>]`.
            // `title` is the display name (there is no `name` field), so
            // renaming never rekeys the map entry. The record's `id` repeats
            // its key.
            "routine-1789760998636-bqphapbbc": {
                id: "routine-1789760998636-bqphapbbc",
                title: "Morning Routine",    // Display name
                cycleCount: 42,              // Times completed
                autoReset: true,             // Auto-cycle mode
                deleteCheckedTasks: false,
                createdAt: 1696723400000,    // Creation timestamp
                lastModified: 1696723445123, // OPTIONAL — absent until first edit
                                             // (previews fall back to createdAt)
                tasks: [
                    {
                        id: "task-xyz789",
                        text: "☕ Make coffee",
                        completed: false,
                        priority: null,
                        dueDate: null,           // ISO string or null
                        remindersEnabled: false,
                        recurring: false,
                        recurringSettings: {},
                        schemaVersion: 2,     // per-task shape version (number)
                        createdAt: "2025-10-07T09:00:00.000Z",
                        completedAt: null,       // ISO string or null
                    }
                ],
                recurringTemplates: {
                    "template-def456": {
                        taskText: "💊 Take medication",
                        priority: 'high',
                        dueDate: null,
                        remindersEnabled: true,
                        recurringSettings: {
                            frequency: "daily",      // daily|weekly|monthly|yearly|custom
                            indefinitely: true,
                            repeatCount: 0,          // If not indefinite
                            timesActivated: 0,
                            weekdays: [],            // ["Mon", "Wed", "Fri"]
                            dayOfMonth: null,        // 1-31
                            nthWeekday: null,        // "1"|"2"|"3"|"4"|"last"
                            weekday: null,           // "Mon"|"Tue"|etc.
                            time: null,              // {hour, minute, meridiem}
                            daily: { time: "09:00" },
                            weekly: { days: [] },
                            monthly: { dayOfMonth: null, nthWeekday: null, weekday: null },
                            lastActivated: null,     // ISO string
                            nextActivation: null     // ISO string
                        },
                        createdAt: "2025-10-01T12:00:00.000Z"
                    }
                },
                taskOptionButtons: {
                    customize: true,
                    moveArrows: false,
                    threeDots: false,
                    highPriority: true,          // visibility of the priority button (a boolean, not a level)
                    rename: true,
                    delete: true,
                    recurring: false,
                    dueDate: false,
                    reminders: false,
                }
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
        showTaskInput: true,
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
        frequencyUnit: "minutes"             // "minutes"|"hours"
        // NOT here: `customMessages` appears nowhere in the codebase.
    },

    userProgress: {
        cyclesCompleted: 42,                 // Global cycles completed
        totalTasksCompleted: 156,            // Lifetime tasks cleared
        rewardMilestones: []                 // LIVE, not a placeholder — gamesManager
                                             // pushes "task-order-game-100", the
                                             // migration seeds "dark-ocean-5", and
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

    achievements: {                          // The real achievements store
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
Debounced Save (600ms, uses requestIdleCallback)
    ↓
localStorage.setItem("miniCycleData", JSON.stringify(state))
```

**Note**: Listeners are notified immediately after state mutation, but localStorage persistence is debounced to avoid excessive writes during rapid changes.

---

## Real Example: Adding a Task

```javascript
// User types "Buy groceries" and clicks Add
// Note: AppState is accessed via dependency injection, not window.*

function addTask(taskText) {
    // 1. Generate unique ID
    const taskId = generateId('task');

    // 2. Create task object
    const newTask = {
        id: taskId,
        text: taskText,
        completed: false,
        priority: null,
        dueDate: null,
        remindersEnabled: false,
        recurring: false,
        recurringSettings: {},
        schemaVersion: 2,     // per-task shape version (number)
        createdAt: new Date().toISOString(),
        completedAt: null,
    };

    // 3. Update AppState (via injected dependency)
    this.deps.AppState.update((state) => {
        const activeCycleId = state.appState.activeRoutineId;
        state.data.routine[activeCycleId].tasks.push(newTask);
    }, true);  // true = save immediately

    // 4. Update DOM
    const taskElement = createTaskElement(newTask);
    document.getElementById('taskList').appendChild(taskElement);

    // 5. Notify user
    this.deps.showNotification('Task added!', 'success', 2000);
}
```

---

## Next Steps

- **[API Reference](API_REFERENCE.md)** - Browse available functions and modules
- **[Development Workflow](../working-on-code/DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Architecture Overview](../architecture/ARCHITECTURE_OVERVIEW.md)** - Understand the system structure

---

**Questions?** Check the [Developer Documentation Hub](../DEVELOPER_DOCUMENTATION.md) for links to all guides.
