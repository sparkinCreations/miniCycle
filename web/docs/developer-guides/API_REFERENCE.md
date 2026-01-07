# API Reference

**Version**: 1.684
**Last Updated**: January 7, 2026

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
import { MiniCycleNotifications } from './modules/notifications.js';

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
import { StatsPanelManager } from './modules/statsPanel.js';

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
import * as recurringCore from './modules/recurringCore.js';

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
import { ThemeManager } from './modules/themeManager.js';

// Apply theme
ThemeManager.applyTheme(themeName);

// Check if unlocked
const unlocked = ThemeManager.isThemeUnlocked(themeName, cycleCount);

// Get available themes
const themes = ThemeManager.getAvailableThemes();
```

### Mode Manager Module

```javascript
import { ModeManager } from './modules/routine/modeManager.js';

// Switch mode
ModeManager.switchMode('auto-cycle');  // or 'manual-cycle', 'todo-mode'

// Get current mode
const mode = ModeManager.getCurrentMode();

// Sync toggles from mode
ModeManager.syncTogglesFromMode(mode);
```

### Achievements Manager Module

```javascript
import { AchievementsManager, initAchievementsManager } from './modules/features/achievementsManager.js';

// Initialize (called by boot)
const manager = initAchievementsManager({
    AppState, showNotification, safeAddEventListener
});

// Update achievements based on current state
manager.refreshAchievements();

// Get all achievements
const achievements = manager.getAchievements();

// Badge UI methods (extracted from statsPanel in v1.684)
manager.initBadgeTooltips();           // Initialize badge click handlers
manager.updateBadges(cyclesCompleted); // Update badge display
manager.showBadgeDetail(milestone);    // Show badge popup
manager.hideBadgeDetail();             // Hide badge popup

// Open achievements modal
manager.showAchievementsModal();
```

### Gesture Panel Manager Module

```javascript
import { GesturePanelManager, initGesturePanelManager } from './modules/ui/gesturePanelManager.js';

// Initialize with callbacks
const gestures = initGesturePanelManager({
    safeAddEventListener,
    showNotification,
    isOverlayActive: () => false,
    isDraggingNotification: () => false,
    onShowStatsPanel: () => statsPanel.showStatsPanel(),
    onShowTaskView: () => statsPanel.showTaskView()
});

// Handles: touch swipes, mouse swipes, wheel scrolls, pointer events, keyboard (Tab)
// Automatically triggers callbacks when gestures detected
```

### History Manager Module

```javascript
import { HistoryManager, initHistoryManager } from './modules/features/historyManager.js';

// Initialize
const history = initHistoryManager({ AppState, showNotification });

// Add entry to history
history.addHistoryEntry(cycleId, {
    type: 'task_completed',
    taskId: 'task-123',
    taskText: 'Morning workout',
    timestamp: Date.now()
});

// Get history for cycle
const entries = history.getHistory(cycleId);

// Open history modal
history.showHistoryModal();

// Clear history for cycle
history.clearHistory(cycleId);
```

### Cleared Tasks Manager Module

```javascript
import { ClearedTasksManager, initClearedTasksManager } from './modules/features/clearedTasksManager.js';

// Initialize
const clearedTasks = initClearedTasksManager({ AppState, showNotification });

// Track cleared task (To-Do mode)
clearedTasks.addClearedTask(cycleId, taskText);

// Get cleared count for cycle
const count = clearedTasks.getClearedCount(cycleId);

// Get all cleared items
const items = clearedTasks.getClearedItems(cycleId);

// Open cleared tasks modal
clearedTasks.showClearedTasksModal();

// Reset cleared tasks for cycle
clearedTasks.resetClearedTasks(cycleId);
```

---

## Next Steps

- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Testing Guide](TESTING_GUIDE.md)** - Run and write tests
- **[Module System Guide](MODULE_SYSTEM_GUIDE.md)** - Learn module patterns

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
