# Data Schema Guide

**Last verified:** Nov 10 2026

> **For current version, see [PROJECT_STATS.md](../PROJECT_STATS.md).**
>
> This is the short tour: how a change travels from a click to storage, and one
> worked example. The stored shape itself is described only in
> [SCHEMA_2_6.md](SCHEMA_2_6.md); read stored names through the accessors in
> `modules/utils/cycleMode.js` (`getActiveRoutine()`, `getRoutine()`, `getAutoClear()`, …)
> and `modules/utils/priorityLevel.js`, not by spelling the keys.

---

## Table of Contents

1. [Schema 2.6 Structure](#schema-26-structure-current) (a pointer to SCHEMA_2_6.md)
2. [How Data Flows](#how-data-flows)
3. [Real Example: Adding a Task](#real-example-adding-a-task)

---

## Schema 2.6 Structure (Current)

The stored shape is described in one place, [SCHEMA_2_6.md](SCHEMA_2_6.md), field by
field: types, defaults, which fields are optional, and what changed from 2.5. This
guide does not repeat it. What you need to follow the rest of this page:

- Everything is one JSON document under the storage key `STORAGE_KEYS.DATA`
  (`"miniCycleData"`), stamped `schemaVersion: "2.6"` (`SCHEMA.CURRENT`).
- Its top-level keys are `metadata`, `settings`, `data`, `appState`, `userProgress`
  and `customReminders`, plus `ui` and `achievements`, which are created on demand.
- Routines live in `data.routine`, each under its own generated id, with `title` as
  the name. `appState.activeRoutineId` is the open routine.
- A routine holds its `tasks` array and its `recurringTemplates` map. See
  [Task Object Structure](SCHEMA_2_6.md#task-object-structure) and
  [Recurring Template Structure](SCHEMA_2_6.md#recurring-template-structure).
- Fields that older docs listed and the app does not store (`streaks`, an
  unlocked-achievements list under `userProgress`, custom reminder messages, a
  settings-level `showTaskInput`) are
  called out in [SCHEMA_2_6.md](SCHEMA_2_6.md#complete-schema-structure) next to
  where they would have been.

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

    // 2. Build the task (the stored shape: SCHEMA_2_6.md, "Task Object Structure")
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

- **[Schema 2.6](SCHEMA_2_6.md)** - The stored shape, field by field
- **[API Reference](API_REFERENCE.md)** - Browse available functions and modules
- **[Development Workflow](../working-on-code/DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Architecture Overview](../architecture/ARCHITECTURE_OVERVIEW.md)** - Understand the system structure

---

**Questions?** The [docs index](../INDEX.md) routes you to the guide to read first.
