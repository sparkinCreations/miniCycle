# API Reference

**Last verified:** Nov 6 2026

> **For current version, see [PROJECT_STATS.md](../PROJECT_STATS.md).**
>
> **Nothing here is a global.** Module code reaches every function below in one
> of two ways:
>
> 1. **Through DI** (feature modules): declare the DI name in the module's entry in
>    `modules/boot/moduleManifests.js` (`requires` / `optionalDeps` / `lazyRequires`)
>    and read it from `this.deps`. The name must be one some manifest `provides`.
>    See [MAKING_CODE_CHANGES.md](../working-on-code/MAKING_CODE_CHANGES.md) and
>    [DI_PATTERNS.md](../working-on-code/DI_PATTERNS.md).
> 2. **Through appContext's grouped APIs** (mostly boot code): `getTaskApi()`,
>    `getCycleApi()`, `getUiApi()`, `getUndoApi()`, … from `modules/core/appContext.js`.
>    These objects are hand-written allow-lists in `registerGroupedApisFromLoader()`
>    (`modules/boot/featureBoot.js`) — a method not named there is not on the API
>    (`validate:api` gates reads of them).
>
> The `import` lines in the module sections below show where a class lives; a
> feature module does not import another manager — the loader constructs it and
> hands it out by DI.

---

## Table of Contents

1. [App-wide APIs (DI names and appContext)](#app-wide-apis-di-names-and-appcontext)
   - [Task Management](#task-management)
   - [Routine Management](#routine-management)
   - [State Management](#state-management)
   - [UI Functions](#ui-functions)
   - [Undo/Redo](#undoredo)
2. [Module APIs](#module-apis)

---

## App-wide APIs (DI names and appContext)

### Task Management

Provided by `taskCore` (`modules/task/taskCore.js`, a facade over `taskCRUD.js`,
`taskCompletion.js`, `taskCycleReset.js`); appContext: `getTaskApi()`.

```javascript
// DI: addTask        appContext: getTaskApi().add
await addTask(taskText, options)
→ Creates a task in the active routine; resolves to the task, or undefined on failure
// options (all optional): completed, shouldSave, dueDate, dueTime,
//   priority ('high'|'medium'|'low'|null), remindersEnabled, recurring,
//   recurringSettings, taskId, autoClear, isLoading, deferAppend, targetContainer.
//   (addTaskImpl in task/taskCRUD.js still also accepts the 2.5 option names
//   from older callers.)

// Example:
await addTask('Buy milk', { priority: 'high' });

// DI: editTask / deleteTask / toggleTaskPriority — each takes the task's DOM element
await editTask(taskItem)        → opens the rename prompt
await deleteTask(taskItem)      → asks for confirmation, then removes it
await toggleTaskPriority(taskItem)

// DI: handleTaskCompletionChange   appContext: getTaskApi().handleCompletionChange
await handleTaskCompletionChange(checkbox)
→ Takes the task's checkbox element; updates state, then the cycle check runs
```

### Routine Management

Routines are switched, renamed and deleted by `routineSwitcher`
(`modules/routine/routineSwitcher.js`) and created by `routineManager`
(`modules/routine/routineManager.js`); appContext: `getCycleApi()`. The DI names
keep their pre-2.6 "MiniCycle"/"Cycle" spelling (renaming a DI name is a dedicated
change, see the repo-root `CLAUDE.md`).

```javascript
// DI: showCycleCreationModal   appContext: getCycleApi().create
showCycleCreationModal(options)
→ Opens the create-routine modal (blank or from a sample)

// DI: switchMiniCycle          appContext: getCycleApi().switch
switchMiniCycle({ view, returnFocus })
→ Opens the routine switcher (List or Browse view) — the user picks the routine;
  it does not take a routine id

// DI: stepRecentRoutine        appContext: getCycleApi().stepRecent
stepRecentRoutine(direction)    → Alt+Shift+[ / ] through recent routines

// DI: renameMiniCycle / deleteMiniCycle — act on the routine selected in the switcher
renameMiniCycle()
deleteMiniCycle()

// Current routine: read state, don't ask a module (utils/cycleMode.js)
const routine = getActiveRoutine(AppState.get());
→ { id, title, tasks, cycleCount, autoReset, deleteCheckedTasks, ... }
```

Export and import of `.mcyc` files live in the `settingsManager` facade's
sub-modules (`modules/ui/cycleExportManager.js`, `modules/ui/cycleImportManager.js`);
see [MCYC_FILE_FORMAT.md](MCYC_FILE_FORMAT.md).

### State Management

`AppState` (`modules/core/appState.js`) is injected by DI (`this.deps.AppState`);
appContext: `getStateApi().AppState`. Read through the `utils/cycleMode.js` helpers.

```javascript
import { getActiveRoutineId, setActiveRoutineId } from '../utils/cycleMode.js';

// Get current state (a live reference — never mutate it outside update())
const state = this.deps.AppState.get();

// Update state (producer pattern)
await this.deps.AppState.update((state) => {
    setActiveRoutineId(state, newId);
}, immediate);  // immediate = true saves now; default false debounces (DEBOUNCE.STATE_SAVE)

// Check if ready (false on a first run until a routine exists)
if (this.deps.AppState.isReady()) {
    // Safe to read
}

// Subscribe to a key
this.deps.AppState.subscribe(key, callback);
this.deps.AppState.unsubscribe(key, callback);
```

### UI Functions

```javascript
// DI: showNotification (notifications.js)   appContext: getUiApi().showNotification
showNotification(message, type, duration, options)
→ Types: 'success', 'error', 'info', 'warning' (and 'default')

// Example (strings come from getLabel; durations from UI_TIMEOUTS):
showNotification(getLabel('notify.taskRenamed', { vars: { name } }), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);

// DI: showConfirmationModal / showPromptModal — one options object
showConfirmationModal({ title, message, confirmText, cancelText, callback, destructive, checkbox })
showPromptModal({ title, message, placeholder, defaultValue, confirmText, cancelText, required, callback })

// DI: refreshUIFromState (taskDOM)
await refreshUIFromState(state?)
→ Re-renders the active routine's task list from AppState

// DI: updateProgressBar (progress/cycleCompletion.js)   appContext: getCycleApi().updateProgress
updateProgressBar()
→ Recalculates and updates completion percentage

// DI: updateStatsPanel (features/statsPanel.js)
updateStatsPanel()
→ Refreshes statistics and achievements
```

### Undo/Redo

Provided by `modules/ui/undoRedoManager.js`; appContext: `getUndoApi()`.

```javascript
// DI: performStateBasedUndo   appContext: getUndoApi().undo
await performStateBasedUndo()

// DI: performStateBasedRedo   appContext: getUndoApi().redo
await performStateBasedRedo()

// DI: updateUndoRedoButtons   appContext: getUndoApi().updateButtons
updateUndoRedoButtons()
→ Enables/disables the buttons from the per-routine undo/redo stacks
```

---

## Module APIs

### Notifications Module

```javascript
// modules/utils/notifications.js — the instance is built by featureBoot;
// modules get showNotification / showNotificationWithTip by DI.
import { MiniCycleNotifications } from '../utils/notifications.js';

const notif = new MiniCycleNotifications();

// Show notification
notif.show(message, type, duration, options);

// Show with educational tip
notif.showWithTip(content, type, duration, tipId, options);

// Reset position (async)
await notif.resetPosition();
```

### Stats Panel Module

```javascript
// modules/features/statsPanel.js — a facade (sub-modules statsPanelGestures,
// statsPanelRewards); DI: showStatsPanel, showTaskView, navigatePanels, updateStatsPanel
import { StatsPanelManager } from '../features/statsPanel.js';

const stats = new StatsPanelManager(dependencies);

// Update stats (async)
await stats.updateStatsPanel();

// Show/hide
stats.showStatsPanel();
stats.showTaskView();
stats.navigatePanels(direction);

// Visibility
stats.isStatsVisible();
```

### Recurring Core Module

`recurringCore` is not a manifest entry: `modules/recurring/recurringIntegration.js`
wires it, and its functions stay `null` until that call has loaded the sub-modules.

```javascript
import * as recurringCore from '../recurring/recurringCore.js';

// Set dependencies — async; loads the sub-modules and resolves to their functions
const recurring = await recurringCore.setRecurringCoreDependencies({
    AppState,
    showNotification,
    // ...
});

// Should a task with these settings recur now? (recurringMatcher.js)
const due = recurring.shouldTaskRecurNow(recurringSettings, new Date());

// Next occurrence (recurringCalculators.js)
const next = recurring.calculateNextOccurrence(recurringSettings, Date.now());
```

### Theme Manager Module

Reached through DI (`deps.themeManager`, or the `provides` names below), not imported.
Colour choice lives in Personalization presets (`ui/preferencesPresets.js`); vocabulary
themes (unlocked by milestones) in `labels/themes.js` (`vocabThemeManager`).

```javascript
// modules/features/themeManager.js provides:
updateThemeColor();       // PWA theme-color / status bar for the current look
setupDarkModeToggle(id);  // wire a dark-mode toggle (synced with the others)
setupQuickDarkToggle();   // the corner quick toggle
setupThemesPanel();       // the Themes modal (vocabulary themes)
renderVocabThemes();      // refresh the modal's theme list
```

The colour themes (Dark Ocean, Golden Glow, dark) and `applyTheme` were retired in
Nov 2026; boot moves a stored one to its preset (`retireLegacyColorTheme`,
`routine/schemaMigration26.js`).

### Mode Manager Module

```javascript
// modules/routine/modeManager.js — instance methods; DI: setupModeSelector,
// refreshTaskButtonsForModeChange, updateCycleModeDescription, syncModeFromToggles
import { ModeManager } from '../routine/modeManager.js';

// The mode is not stored: it is derived from the routine's autoReset /
// deleteCheckedTasks flags (utils/cycleMode.js)
const mode = getCycleMode(routine);   // 'auto' | 'manual' | 'todo'

// Apply the toggles' state to the active routine (and sync tasks to it)
await modeManager.syncModeFromToggles();

// Label for a mode — note modeManager's own mode ids ('auto-cycle' |
// 'manual-cycle' | 'todo-mode'), not getCycleMode()'s
modeManager.getModeName('manual-cycle');   // 'Manual Cycle'
```

### Achievements Manager Module

```javascript
import { AchievementsManager, initAchievementsManager } from '../features/achievementsManager.js';

// Initialize (called by boot; async)
const manager = await initAchievementsManager({
    AppState, showNotification, safeAddEventListener
});

// Check and unlock milestones (DI: checkAchievements)
manager.checkAchievements(cyclesCompleted, tasksCleared);

// Get all achievements (DI: getAchievements)
const achievements = manager.getAchievements();
manager.isUnlocked(milestoneId);       // DI: isAchievementUnlocked

// Badge UI methods (extracted from statsPanel in v1.729)
manager.initBadgeTooltips();           // Initialize badge click handlers
manager.updateBadges(globalCyclesCompleted, globalTasksCleared); // Update badge display
manager.showBadgeDetail(milestone);    // Show badge popup
manager.hideBadgeDetail();             // Hide badge popup

// Open achievements modal (DI: openAchievementsModal)
manager.openModal();
```

### Gesture Panel Manager Module

```javascript
import { GesturePanelManager, initGesturePanelManager } from '../ui/gesturePanelManager.js';

// Initialize with callbacks (a singleton: later calls return the first instance)
const gestures = initGesturePanelManager({
    safeAddEventListener,
    showNotification,
    isOverlayActive: () => false,
    isDraggingNotification: () => false,
    onNavigate: (direction) => statsPanel.navigatePanels(direction), // +1 / -1
    // Legacy two-panel fallbacks, used when onNavigate is not wired:
    onShowStatsPanel: () => statsPanel.showStatsPanel(),
    onShowTaskView: () => statsPanel.showTaskView()
});

// Handles: touch swipes, mouse swipes, wheel scrolls, pointer events, keyboard
// Automatically triggers callbacks when gestures detected
```

### History Manager Module

```javascript
import { HistoryManager, initHistoryManager } from '../features/historyManager.js';

// Initialize
const history = initHistoryManager({ AppState, showNotification });

// Log an event to the ACTIVE routine (DI: logHistoryEvent)
history.logEvent('task_added', { /* event-specific details */ });

// Get history for a routine (defaults to the active one) (DI: getHistory)
const entries = history.getHistory(routineId);

// Open history modal (DI: openHistoryModal)
history.openModal();

// Clear history for a routine (DI: clearHistory)
history.clearHistory(routineId);
```

Every event type passed to `logEvent` must be mapped in the history registry —
`validate:labels` gates it.

### Cleared Tasks Manager Module

```javascript
import { ClearedTasksManager, initClearedTasksManager } from '../features/clearedTasksManager.js';

// Initialize
const clearedTasks = initClearedTasksManager({ AppState, showNotification });

// Record a cleared task (takes the task object) (DI: recordClearedTask)
clearedTasks.recordClearedTask(task);
clearedTasks.recordMultipleClearedTasks(tasks);

// Get cleared entries for a routine (defaults to the active one) (DI: getClearedTasks)
const items = clearedTasks.getClearedTasks(routineId);

// Open cleared tasks modal (DI: openClearedTasksModal)
clearedTasks.openModal();

// Clear all entries for a routine (DI: clearClearedTasks)
clearedTasks.clearAll(routineId);
```

---

## Next Steps

- **[Development Workflow](../working-on-code/DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Testing Guide](../working-on-code/TESTING_GUIDE.md)** - Run and write tests
- **[Module System Guide](../architecture/MODULE_SYSTEM_GUIDE.md)** - Learn module patterns

---

**Questions?** The [docs index](../INDEX.md) routes you to the guide to read first.
