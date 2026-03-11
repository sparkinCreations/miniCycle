# History System

The history system tracks activity events for each routine — cycle completions, task changes, achievement unlocks, and more. Events are stored per-routine and travel with `.mcyc` exports.

---

## How It Works

### The event logging flow

```
logHistoryEvent('task_added', { taskName: 'Buy milk' })
  → moduleLoader depMappings
  → deps.features?.historyManager?.logEvent?.('task_added', { taskName: 'Buy milk' })
  → AppState.update() → cycle.history.events.unshift(event)
  → Trimmed to MAX_EVENTS (100)
```

Events are stored newest-first in the active routine's `history.events` array. Each event gets a unique ID, timestamp, type, and details object.

### Key files

| File | Role |
|------|------|
| `modules/features/historyManager.js` | `HistoryManager` class — logging, modal UI, rendering |
| `modules/task/taskCRUD.js` | Logs `task_added`, `task_deleted`, `task_edited` events |
| `modules/progress/cycleCompletion.js` | Logs `cycle_completed` events |
| `modules/task/taskCycleReset.js` | Logs `tasks_cleared` and `cycle_reset` events |
| `modules/features/achievementsManager.js` | Logs `achievement_unlocked` events |
| `modules/labels/defaultLabels.js` | Label keys under `history.*` |
| `modules/boot/moduleManifests.js` | `taskCore` declares `logHistoryEvent` in `optionalDeps` |
| `modules/boot/moduleLoader.js` | `depMappings.logHistoryEvent` wires the DI bridge |

### Event types

| Type | Icon | Source Module | Details |
|------|------|---------------|---------|
| `cycle_completed` | `🔄` | cycleCompletion.js | `{ cycleCount }` |
| `tasks_cleared` | `✓` | taskCycleReset.js | `{ tasksCleared }` |
| `cycle_reset` | `🔁` | taskCycleReset.js | `{}` |
| `achievement_unlocked` | `🏆` | achievementsManager.js | `{ achievementId, achievementName }` |
| `task_added` | `➕` | taskCRUD.js | `{ taskName }` |
| `task_deleted` | `🗑️` | taskCRUD.js | `{ taskName }` |
| `task_edited` | `✏️` | taskCRUD.js | `{ oldName, newName }` |

---

## Per-routine storage

History is stored inside each routine (cycle object):

```
state.data.cycles[cycleId].history.events[]   // array of event objects
```

Each event has this shape:

```javascript
{
    id: 'evt-1706123456789-a1b2c',   // unique ID
    type: 'task_added',               // event type string
    timestamp: 1706123456789,          // Date.now() at time of logging
    details: { taskName: 'Buy milk' } // type-specific payload
}
```

Events are capped at `MAX_EVENTS` (100). When the cap is exceeded, oldest events are trimmed.

---

## DI wiring

### How `logHistoryEvent` reaches taskCRUD

The `logHistoryEvent` function is not a direct import. It flows through the module loader's dependency injection:

1. **historyManager manifest** (`moduleManifests.js`) declares `provides: ['logHistoryEvent', ...]`
2. **moduleLoader.js** `depMappings` maps `logHistoryEvent` to `deps.features?.historyManager?.logEvent?.(...args)`
3. **taskCore manifest** (`moduleManifests.js`) declares `optionalDeps: ['logHistoryEvent']`
4. **taskCRUD.js** DI declares `logHistoryEvent: optional(null)`
5. At runtime, `_deps.logHistoryEvent('task_added', { taskName })` calls through the chain

### Adding `logHistoryEvent` to a new module

1. Add `logHistoryEvent` to the module's manifest `optionalDeps` array in `moduleManifests.js`
2. Add `logHistoryEvent: optional(null)` to the module's `createDIModule()` declaration
3. Call it with a guard: `if (typeof _deps.logHistoryEvent === 'function') { ... }`

---

## Adding a new event type

1. **Choose a type string** — snake_case, descriptive (e.g. `routine_renamed`)

2. **Add labels** in `defaultLabels.js`:
   ```javascript
   // In the history: { ... } section
   routineRenamed: 'Routine Renamed',
   ```
   And register the key in the validation array:
   ```javascript
   'history.routineRenamed',
   ```

3. **Log the event** in the source module:
   ```javascript
   if (typeof _deps.logHistoryEvent === 'function') {
       _deps.logHistoryEvent('routine_renamed', {
           oldName: oldName,
           newName: newName
       });
   }
   ```
   Use `!isLoading` guard if the action can fire during bulk loading.

4. **Render the event** in `historyManager.js` `_renderEvent()`:
   - Add an entry to the `icons` object
   - Add an entry to the `labels` object using `getLabel('history.routineRenamed')`
   - Add detail text logic in the `if/else if` chain (use `_escapeHtml()` for user data)

5. **Wire DI** if the source module doesn't already have `logHistoryEvent`:
   - Add to manifest `optionalDeps` in `moduleManifests.js`
   - Add `logHistoryEvent: optional(null)` to the module's DI

### Detail text rendering order

The `_renderEvent()` method checks details in this order:

```javascript
if (event.details.cycleCount !== undefined)        → "Cycle #N"
else if (event.details.tasksCleared !== undefined)  → "N task(s)"
else if (event.details.achievementId)               → achievement name
else if (event.details.oldName !== undefined)        → "old → new"  (edit events)
else if (event.details.taskName !== undefined)       → task name    (add/delete events)
```

`oldName` is checked before `taskName` because edit events could have both. If your new event type uses a unique detail key, add it in the appropriate position.

---

## History modal UI

The history modal is opened from the stats panel via a button. It has two tabs:

- **Events** — chronological event list grouped by date (Today / Yesterday / Earlier)
- **Cleared Tasks** — tasks cleared in To-Do Mode (delegates to `clearedTasksManager`)

The modal is created dynamically (`document.createElement`) and destroyed on close. All event listeners are cleaned up in the close handler.

### Modal entry points

```javascript
// From statsPanel button click:
deps.features?.historyManager?.openModal();

// From anywhere with the instance:
historyManager.openModal();
```

---

## Common pitfalls

### 1. Flooding history during bulk load

When tasks are loaded from storage at boot, `addTaskImpl` is called with `isLoading = true`. Without a guard, every stored task generates a `task_added` event on every page load.

```javascript
// CORRECT — skip during bulk loading
if (!isLoading && typeof _deps.logHistoryEvent === 'function') {
    _deps.logHistoryEvent('task_added', { taskName: validatedInput });
}

// WRONG — logs events during storage load
if (typeof _deps.logHistoryEvent === 'function') {
    _deps.logHistoryEvent('task_added', { taskName: validatedInput });
}
```

### 2. Using `innerHTML` with user data in detail text

Event details contain user-provided text (task names). Always use `_escapeHtml()`:

```javascript
// CORRECT
detailText = this._escapeHtml(event.details.taskName);

// WRONG — XSS vulnerability
detailText = event.details.taskName;
```

### 3. Forgetting to register the label key

If you add a label value in `defaultLabels.js` but forget to add the key to the validation array at the bottom of the file, the label works but won't be validated.

---

## Related modules

- **clearedTasksManager.js** — Tracks cleared tasks (To-Do mode + cycle reset auto-removes); displayed in the history modal's "Cleared" tab
- **achievementsManager.js** — Logs `achievement_unlocked` events to history when milestones are reached
- **statsPanel.js** — Contains the "History" button that opens the modal

---

**Created:** February 24, 2026
**Author:** Developer guide for the history system
