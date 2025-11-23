# API Reference

**Version**: 1.373
**Last Updated**: November 23, 2025

---

## Table of Contents

1. [Global Functions](#global-functions-available-everywhere)
   - [Task Management](#task-management)
   - [Cycle Management](#cycle-management)
   - [State Management](#state-management)
   - [UI Functions](#ui-functions)
   - [Undo/Redo](#undoredo)
2. [Module APIs](#module-apis)

---

## Global Functions (Available Everywhere)

### Task Management

```javascript
// Add task
addTask(text, completed, shouldSave, dueDate, highPriority, isLoading, remindersEnabled, recurring, taskId, recurringSettings)
→ Creates and adds task to current cycle

// Example:
addTask("Buy milk", false, true, null, false, false, false, false);

// Toggle task completion
function toggleTaskCompletion(taskId)
→ Marks task as done/undone, checks for auto-reset

// Delete task
function deleteTask(taskId)
→ Removes task from cycle

// Edit task text
function editTaskText(taskId, newText)
→ Updates task text and saves
```

### Cycle Management

```javascript
// Create new cycle
function createNewCycle(cycleName)
→ Creates empty cycle and switches to it

// Switch cycles
function switchActiveCycle(cycleId)
→ Changes active cycle, updates UI

// Get current cycle
function getCurrentCycle()
→ Returns: { name, tasks, cycleCount, autoReset, ... }

// Export cycle
function exportCurrentCycle()
→ Downloads .mcyc file

// Import cycle
function importCycleFile(file)
→ Loads .mcyc file and adds to cycles
```

### State Management

```javascript
// Get current state
const state = window.AppState.get();

// Update state
window.AppState.update((state) => {
    // Modify state directly
    state.appState.activeCycleId = newId;
}, immediate);  // immediate = true/false

// Check if ready
if (window.AppState?.isReady()) {
    // Safe to use
}
```

### UI Functions

```javascript
// Show notification
showNotification(message, type, duration)
→ Types: 'success', 'error', 'info', 'warning'

// Example:
showNotification('Task completed!', 'success', 3000);

// Refresh UI from state
refreshUIFromState()
→ Rebuilds entire UI from AppState

// Update progress bar
updateProgressBar()
→ Recalculates and updates completion percentage

// Update stats panel
updateStatsPanel()
→ Refreshes statistics and achievements
```

### Undo/Redo

```javascript
// Undo last action
performUndo()
→ Returns to previous state

// Redo undone action
performRedo()
→ Restores undone state

// Check if can undo/redo
canUndo()  → boolean
canRedo()  → boolean
```

---

## Module APIs

### Notifications Module

```javascript
import { MiniCycleNotifications } from './utilities/notifications.js';

const notif = new MiniCycleNotifications();

// Show notification
notif.show(message, type, duration);

// Show with educational tip
notif.showWithTip(content, type, duration, tipId);

// Reset position
notif.resetPosition();
```

### Stats Panel Module

```javascript
import { StatsPanelManager } from './utilities/statsPanel.js';

const stats = new StatsPanelManager({
    showNotification,
    loadData,
    updateThemeColor
});

// Update stats
stats.updateStatsPanel();

// Show/hide
stats.showStatsPanel();
stats.showTaskView();

// Get stats
stats.getStatistics();
```

### Recurring Core Module

```javascript
import * as recurringCore from './utilities/recurringCore.js';

// Set dependencies
recurringCore.setRecurringCoreDependencies({
    updateAppState,
    showNotification,
    refreshUI
});

// Check if task is due
const isDue = recurringCore.isRecurringTaskDue(template, new Date());

// Generate task from template
const task = recurringCore.generateRecurringTask(template);
```

### Theme Manager Module

```javascript
import { ThemeManager } from './utilities/themeManager.js';

// Apply theme
ThemeManager.applyTheme(themeName);

// Check if unlocked
const unlocked = ThemeManager.isThemeUnlocked(themeName, cycleCount);

// Get available themes
const themes = ThemeManager.getAvailableThemes();
```

### Mode Manager Module

```javascript
import { ModeManager } from './utilities/cycle/modeManager.js';

// Switch mode
ModeManager.switchMode('auto-cycle');  // or 'manual-cycle', 'todo-mode'

// Get current mode
const mode = ModeManager.getCurrentMode();

// Sync toggles from mode
ModeManager.syncTogglesFromMode(mode);
```

---

## Next Steps

- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Testing Guide](TESTING_GUIDE.md)** - Run and write tests
- **[Module System Guide](MODULE_SYSTEM_GUIDE.md)** - Learn module patterns

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
