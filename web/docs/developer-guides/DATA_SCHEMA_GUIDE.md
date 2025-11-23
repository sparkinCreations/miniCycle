# Data Schema Guide

**Version**: 1.373
**Last Updated**: November 23, 2025

---

## Table of Contents

1. [Schema 2.5 Structure](#schema-25-structure-current)
2. [How Data Flows](#how-data-flows)
3. [Real Example: Adding a Task](#real-example-adding-a-task)

---

## Schema 2.5 Structure (Current)

```typescript
{
    schemaVersion: "2.5",

    metadata: {
        lastModified: 1696723445123,        // Unix timestamp
        appVersion: "1.373",
        migrationHistory: ["2.0 → 2.5"]
    },

    data: {
        cycles: {
            "cycle-abc123": {
                name: "Morning Routine",
                cycleCount: 42,              // Times completed
                autoReset: true,             // Auto-cycle mode
                deleteCheckedTasks: false,
                tasks: [
                    {
                        id: "task-xyz789",
                        text: "☕ Make coffee",
                        completed: false,
                        highPriority: false,
                        dueDate: null,
                        remindersEnabled: false,
                        recurring: false,
                        recurringSettings: {},
                        schemaVersion: 2.5,
                        createdAt: "2025-10-07T09:00:00.000Z",
                        completedAt: null
                    }
                ],
                recurringTemplates: {
                    "template-def456": {
                        taskText: "💊 Take medication",
                        highPriority: true,
                        dueDate: null,
                        remindersEnabled: true,
                        recurringSettings: {
                            frequency: "daily",
                            daily: { time: "09:00" },
                            indefinitely: true
                        },
                        createdAt: "2025-10-01T12:00:00.000Z"
                    }
                },
                taskOptionButtons: {          // v1.357+: Per-cycle button visibility
                    customize: true,
                    moveArrows: false,       // Global setting
                    threeDots: false,        // Global setting
                    highPriority: true,
                    rename: true,
                    delete: true,
                    recurring: false,
                    dueDate: false,
                    reminders: false,
                    deleteWhenComplete: false  // v1.370+
                }
            }
        }
    },

    appState: {
        activeCycleId: "cycle-abc123",
        currentMode: "auto-cycle",           // or "manual-cycle" or "todo-mode"
        ui: {
            moveArrowsVisible: true,
            statsView: "tasks"
        }
    },

    settings: {
        darkMode: true,
        theme: "dark-ocean",
        unlockedThemes: ["dark-ocean"],
        dismissedEducationalTips: {
            "recurring-cycle-explanation": true
        },
        notificationPosition: { x: 100, y: 20 },
        defaultRecurringSettings: {
            frequency: "daily",
            indefinitely: true
        },
        showCompletedDropdown: false,        // v1.352+
        completedTasksExpanded: false,
        showThreeDots: true                  // v1.357+: Global three dots setting
    },

    reminders: {
        enabled: true,
        frequency: 30,
        customMessages: []
    },

    userProgress: {
        cyclesCompleted: 42,
        totalTasksCompleted: 156,
        achievementsUnlocked: ["cycle-5", "cycle-25"],
        streaks: {
            current: 7,
            longest: 14
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
Debounced Save (600ms)
    ↓
localStorage.setItem("miniCycleData", JSON.stringify(state))
    ↓
State Listeners Notified
    ↓
UI Components Refresh
```

---

## Real Example: Adding a Task

```javascript
// User types "Buy groceries" and clicks Add

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
        completedAt: null
    };

    // 3. Update AppState
    window.AppState.update((state) => {
        const activeCycleId = state.appState.activeCycleId;
        state.data.cycles[activeCycleId].tasks.push(newTask);
    }, true);  // true = save immediately

    // 4. Update DOM
    const taskElement = createTaskElement(newTask);
    document.getElementById('taskList').appendChild(taskElement);

    // 5. Notify user
    showNotification('Task added!', 'success', 2000);
}
```

---

## Next Steps

- **[API Reference](API_REFERENCE.md)** - Browse available functions and modules
- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)** - Understand the system structure

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
