# Data Schema Guide

**Version**: 1.729
**Last Updated**: January 5, 2026

---

## Table of Contents

1. [Schema 2.5 Structure](#schema-25-structure-current)
2. [How Data Flows](#how-data-flows)
3. [Real Example: Adding a Task](#real-example-adding-a-task)

---

## Schema 2.5 Structure (Current)

> **Source of Truth**: `modules/core/types.js` contains the canonical JSDoc type definitions.

```typescript
{
    schemaVersion: "2.5",

    metadata: {
        createdAt: 1696723400000,            // Unix timestamp
        lastModified: 1696723445123,         // Unix timestamp
        appVersion: "1.729",
        migrationHistory: ["2.0 → 2.5"],
        migratedFrom: "2.0",                 // Previous schema version
        migrationDate: "2025-10-07",         // Migration date
        totalCyclesCreated: 5,               // Total cycles ever created
        totalTasksCompleted: 156             // Total tasks ever completed
    },

    data: {
        cycles: {
            "cycle-abc123": {
                id: "cycle-abc123",
                name: "Morning Routine",
                title: "Morning Routine",    // Legacy field
                cycleCount: 42,              // Times completed
                autoReset: true,             // Auto-cycle mode
                deleteCheckedTasks: false,
                createdAt: 1696723400000,    // Creation timestamp
                lastModified: 1696723445123, // Last modification timestamp
                tasks: [
                    {
                        id: "task-xyz789",
                        text: "☕ Make coffee",
                        completed: false,
                        highPriority: false,
                        dueDate: null,           // ISO string or null
                        remindersEnabled: false,
                        recurring: false,
                        recurringSettings: {},
                        schemaVersion: 2.5,
                        createdAt: "2025-10-07T09:00:00.000Z",
                        completedAt: null,       // ISO string or null
                        deleteWhenComplete: false
                    }
                ],
                recurringTemplates: {
                    "template-def456": {
                        taskText: "💊 Take medication",
                        highPriority: true,
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
                    highPriority: true,
                    rename: true,
                    delete: true,
                    recurring: false,
                    dueDate: false,
                    reminders: false,
                    deleteWhenComplete: false
                }
            }
        }
    },

    appState: {
        activeCycleId: "cycle-abc123",
        currentMode: "auto-cycle",           // "auto-cycle"|"manual-cycle"|"todo-mode"
        overdueTaskStates: {}                // {[taskId]: boolean}
    },

    ui: {
        moveArrowsVisible: false,
        statsView: "tasks"
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
        accessibility: {
            reducedMotion: false,
            highContrast: false,
            screenReaderHints: false
        },
        debugMode: false
    },

    customReminders: {
        enabled: false,
        indefinite: false,
        dueDatesReminders: false,
        repeatCount: 0,
        frequencyValue: 30,
        frequencyUnit: "minutes",            // "minutes"|"hours"
        customMessages: []
    },

    userProgress: {
        cyclesCompleted: 42,
        totalTasksCompleted: 156,
        achievementsUnlocked: [],            // Placeholder for future feature
        rewardMilestones: [],                // Placeholder for future feature
        streaks: {                           // Placeholder for future feature
            current: 0,
            longest: 0
        }
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
        highPriority: false,
        dueDate: null,
        remindersEnabled: false,
        recurring: false,
        recurringSettings: {},
        schemaVersion: 2.5,
        createdAt: new Date().toISOString(),
        completedAt: null,
        deleteWhenComplete: false
    };

    // 3. Update AppState (via injected dependency)
    this.deps.AppState.update((state) => {
        const activeCycleId = state.appState.activeCycleId;
        state.data.cycles[activeCycleId].tasks.push(newTask);
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
- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)** - Understand the system structure

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
