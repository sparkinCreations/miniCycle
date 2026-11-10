# Label Registry Reference

**Last verified:** Nov 10 2026

> **Status:** Partial catalog. The tables below cover the keys identified by the original Phase 1 string audit. The registry has since grown well past them (whole categories such as the tours, Focus View, the routine browser and the help window have no table here). `modules/labels/defaultLabels.js` is the authoritative list; `getLabelDiagnostics()` in `labelResolver.js` reports the live totals.

**Purpose:** Catalog of user-facing strings for centralized label management
**Related:** [CONTEXTUAL_THEME_SYSTEM_PLAN.md](../archive/CONTEXTUAL_THEME_SYSTEM_PLAN.md) (archived plan), [LABEL_SYSTEM_ARCHITECTURE.md](../architecture/LABEL_SYSTEM_ARCHITECTURE.md)

---

## How to Read This File

- **Key**: Label key in `DEFAULT_LABELS` (`defaultLabels.js`), always 2-level: `category.key`
- **Current Value**: The default (Classic) string in `DEFAULT_LABELS` on the date above; long values are cut with `...`. A value shown as `touch: ... / pointer: ...` is a device variant (see below)
- **Source(s)**: Files under `modules/` (plus `miniCycle.html`) that name the key as a string literal. "No literal reference found" means the key is defined in `defaultLabels.js` but no file names it literally
- **Lens-Sensitive**: Is the key listed in `LENS_SENSITIVE_KEYS` (`defaultLabels.js`)? That set is the list of keys a vocabulary theme is meant to be able to override (e.g., "task" becomes "habit" in the Habit Tracker theme)

"Lens" is the original planning name for what shipped as **vocabulary themes** (`THEME_DEFINITIONS` in `modules/labels/themes.js`: Classic plus `habit-tracker`, `fitness`, `scholar`, `cleaning`). A theme's `labels` map overrides defaults by full dot-path key; anything it does not override falls through to `DEFAULT_LABELS`. `LENS_SENSITIVE_KEYS` is a declaration, not an enforcement: `validate:labels` only checks that every key listed in it exists in `DEFAULT_LABELS`.

---

## Usage API

All labels use **2-level keys** (`category.key`) with options for pluralization and interpolation:

```javascript
import { getLabel } from '../labels/labelResolver.js';

// Simple string
getLabel('action.addTask')                    // → 'Add task'

// Pluralization (nouns with { one, other })
getLabel('noun.task', { count: 1 })           // → 'task'
getLabel('noun.task', { count: 5 })           // → 'tasks'

// Variable interpolation
getLabel('notify.taskRenamed', { vars: { name: 'Buy milk' } })
                                              // → 'Task renamed to "Buy milk"'

// Theme nouns as interpolation vars (themeWords.js)
import { themeWordVars } from '../labels/themeWords.js';
getLabel('stats.completion', { vars: { completed: 3, total: 5, ...themeWordVars() } })
                                              // → '3 of 5 tasks' ('3 of 5 habits' under Habit Tracker)
```

**Important:** Keys are always 2-level. Pluralization is handled via `{ count }` option, NOT via `.one`/`.other` suffixes in the key.

**Resolution order** (`getLabel()` in `labelResolver.js`): the active theme's override for the full key, else `DEFAULT_LABELS`; then a `{ touch, pointer }` device variant is unwrapped, then a `{ browser, app }` platform variant, then a `{ one, other }` plural; then `{vars}` are interpolated (`count` is always available as a var). `getLabel()` never throws: a missing key logs a warning and returns the key itself, which is what `validate:labels` (CI, gated at 0) exists to catch. Interpolation does not HTML-escape; escaping is the job of the sink that renders the string.

`themeWordVars()` supplies the theme's nouns as vars: `tasks`, `taskWord`, `taskOne`, `taskTitle`, `cycleWord`, `cycleOne`, `completeButton`, `clearButton`.

---

## 1. Core Nouns (Lens-Sensitive)

These are the foundational terms that define the app's vocabulary. A vocabulary theme primarily swaps these.

| Key | Type | Usage | Result | Source(s) |
|-----|------|-------|--------|-----------|
| `noun.task` | Plural | `getLabel('noun.task', { count: 1 })` | 'task' | Throughout |
| `noun.task` | Plural | `getLabel('noun.task', { count: 5 })` | 'tasks' | Throughout |
| `noun.cycle` | Plural | `getLabel('noun.cycle', { count: 1 })` | 'cycle' | Throughout |
| `noun.cycle` | Plural | `getLabel('noun.cycle', { count: 5 })` | 'cycles' | Throughout |
| `noun.routine` | Plural | `getLabel('noun.routine', { count: 1 })` | 'routine' | Throughout |
| `noun.routine` | Plural | `getLabel('noun.routine', { count: 5 })` | 'routines' | Throughout |
| `noun.miniCycle` | String | `getLabel('noun.miniCycle')` | 'miniCycle' | No literal reference found |

**Note:** Plural nouns are stored as `{ one: 'task', other: 'tasks' }` in `defaultLabels.js`. The resolver handles pluralization via the `count` option.

---

## 2. Mode Labels (Lens-Sensitive)

| Key | Current Value | Source(s) | Notes |
|-----|--------------|-----------|-------|
| `mode.auto` | Auto Cycle | modeManager.js, undoTransactionDiff.js | Mode selector dropdown |
| `mode.autoDescription` | Automatically cycle tasks | No literal reference found | Tooltip description |
| `mode.manual` | Manual Cycle | modeManager.js, undoTransactionDiff.js | Mode selector dropdown |
| `mode.manualDescription` | Manually cycle through tasks | No literal reference found | Tooltip description |
| `mode.todo` | To-Do Mode | modeManager.js, onboardingDemo.js, undoTransactionDiff.js | Mode selector dropdown |
| `mode.todoDescription` | Simple To-Do list mode | No literal reference found | Tooltip description |
| `mode.autoTitle` | Auto Cycle Mode | modeManager.js, helpWindowManager.js | Mode info box title |
| `mode.autoDetail` | {tasks} will automatically reset to incomplete when all are completed. This is the traditional miniCycle experience. | modeManager.js | Mode info box description |
| `mode.manualTitle` | Manual Cycle Mode | modeManager.js, helpWindowManager.js | Mode info box title |
| `mode.manualDetail` | {tasks} will only reset when you manually press the {completeButton} button. The {completeButton} button will complete any rema... | modeManager.js | Mode info box description |
| `mode.todoTitle` | To-Do Mode | modeManager.js, helpWindowManager.js | Mode info box title |
| `mode.todoDetail` | This mode will not complete any {cycleWord}. Instead, it will remove completed {taskWord} when you hit the {clearButton} button. | modeManager.js | Mode info box description |
| `mode.autoToggle` | Auto Reset | No literal reference found | Auto reset toggle label |
| `mode.deleteChecked` | Delete Checked Tasks after Complete | No literal reference found | Delete checked toggle label |
| `mode.info` | Mode Info | No literal reference found | Mode description toggle |

---

## 3. Task Actions (Partially Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `action.addTask` | Add task | themeManager.js, taskRenderer.js, miniCycle.html | Yes | Add button tooltip |
| `action.addTaskButton` | Add | miniCycle.html | No | Button text |
| `action.addTaskPlaceholder` | Enter a task... | No literal reference found | Yes | Input placeholder |
| `action.addTaskTitle` | Type a task and press Add or Enter | No literal reference found | Yes | Input tooltip |
| `action.addTaskMenu` | Add Task | No literal reference found | Yes | Plus button dropdown |
| `action.editTaskTitle` | Rename Task | taskCRUD.js | Yes | Edit modal title |
| `action.editTaskMessage` | Rename this task: | taskCRUD.js | Yes | Edit modal body |
| `action.editTaskPlaceholder` | Enter new task name | taskCRUD.js | Yes | Edit modal input |
| `action.deleteTaskTitle` | Delete Task | taskCRUD.js | Yes | Delete modal title |
| `action.deleteTaskMessage` | Are you sure you want to delete "{name}"? | taskCRUD.js | Yes | Delete modal body |
| `action.completeAll` | Complete | No literal reference found | Yes | Complete all button |
| `action.completeAllTitle` | Complete all checked tasks | miniCycle.html | Yes | Complete all tooltip |
| `action.completeCycle` | Complete Cycle | historyManager.js, themeManager.js, themeWords.js, onboardingDemo.js, taskUI.js | Yes | Manual mode button |
| `action.clearAllMenu` | Uncheck All | themeManager.js | No | Menu button |
| `action.clearAllTitle` | Uncheck all tasks in this routine | themeManager.js | Yes | Menu tooltip |
| `action.deleteAllMenu` | Delete All | themeManager.js, menuManager.js | No | Menu button |
| `action.deleteAllTitle` | Delete all tasks in this routine | themeManager.js | Yes | Menu tooltip |
| `action.clearCompletedTasks` | Clear Completed Tasks | themeManager.js, themeWords.js, onboardingDemo.js, taskUI.js | Yes | Todo-mode button text |
| `action.markTaskComplete` | Mark task "{name}" as complete | taskDOM.js | Yes | Checkbox ARIA label |
| `action.searchTasks` | Search tasks | miniCycle.html | Yes | Search button tooltip |
| `action.searchTasksPlaceholder` | Search tasks... | No literal reference found | Yes | Search input placeholder |
| `action.clearSearch` | Clear search | miniCycle.html | No | Clear search tooltip |

---

## 4. Task Option Buttons (Partially Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `taskOption.moveUp` | Move task up | taskButtons.js | Yes | ARIA label |
| `taskOption.moveDown` | Move task down | taskButtons.js | Yes | ARIA label |
| `taskOption.recurring` | Toggle recurring task | taskButtons.js | Yes | ARIA label |
| `taskOption.dueDate` | Set due date | taskButtons.js | No | ARIA label |
| `taskOption.reminders` | Toggle reminders for this task | taskButtons.js | Yes | ARIA label |
| `taskOption.priority` | Toggle task priority | taskButtons.js | Yes | ARIA label |
| `taskOption.edit` | Rename task | taskButtons.js | Yes | ARIA label |
| `taskOption.delete` | Delete task | taskButtons.js | Yes | ARIA label |
| `taskOption.showOptions` | Show task options | taskButtons.js, taskDOM.js | Yes | Three dots tooltip |
| `taskOption.customize` | Add or remove task buttons | taskButtons.js | Yes | Customize button tooltip |
| `taskOption.customizeAria` | Add or remove which task option buttons are visible | No literal reference found | Yes | ARIA label |

---

## 5. Task Option Customizer Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `taskOptions.title` | Add or Remove Task Buttons | taskOptionsCustomizer.js | No | Modal title |
| `taskOptions.subtitle` | Choose which buttons appear for tasks in "{name}" | taskOptionsCustomizer.js | Yes | Modal subtitle |
| `taskOptions.thisCycle` | This Routine | No literal reference found | Yes | Section header |
| `taskOptions.optionDetails` | Option Details | taskOptionsCustomizer.js | No | Section header |
| `taskOptions.highPriority` | Priority Toggle | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.renameTask` | Rename Task | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.deleteTask` | Delete Task | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.recurringTask` | Recurring Task | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.setDueDate` | Set Due Date | taskOptionsCustomizer.js | No | Option name |
| `taskOptions.taskReminders` | Task Reminders | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.changesApply` | touch: Changes apply immediately when checked or double-tapped / pointer: Changes apply immediately when checked or double-clicked | taskOptionsCustomizer.js | No | Footer note |
| `taskOptions.resetDefault` | Reset to Default | taskOptionsCustomizer.js | No | Reset button |

---

## 6. Routine Actions (Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `routine.create` | Create New Routine | miniCycle.html | Yes | Plus dropdown |
| `routine.createTitle` | Create a new routine | miniCycle.html | Yes | Menu tooltip |
| `routine.createMenu` | New | miniCycle.html | No | Menu button |
| `routine.download` | Download | routineSwitcherActions.js, cycleExportManager.js, shareManager.js, miniCycle.html | No | Menu button |
| `routine.downloadTitle` | Download the current routine as a file | miniCycle.html | Yes | Menu tooltip |
| `routine.import` | Import | miniCycle.html | No | Menu button |
| `routine.importTitle` | Import a routine from a file | routineBrowser.js, cycleImportManager.js | Yes | Menu tooltip |
| `routine.duplicate` | Duplicate | miniCycle.html | Yes | Menu button |
| `routine.duplicateTitle` | Duplicate the current routine | miniCycle.html | Yes | Menu tooltip |
| `routine.switchAria` | Switch routines | routineSwitcher.js | Yes | Routine switcher ARIA |
| `routine.untitled` | Untitled Routine | routineLoader.js, routineSwitcherRepair.js | Yes | Fallback title |

---

## 7. Routine Switcher Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `switcher.title` | Switch Routine | No literal reference found | Yes | Modal title |
| `switcher.search` | Search routines... | routineBrowser.js | Yes | Search placeholder |
| `switcher.filterAll` | All Modes | routineSwitcher.js | No | Filter option |
| `switcher.filterAuto` | Auto Cycle | routineSwitcher.js | Yes | Filter option |
| `switcher.filterManual` | Manual Cycle | routineSwitcher.js | Yes | Filter option |
| `switcher.filterTodo` | To-Do | routineSwitcher.js | No | Filter option |
| `switcher.sort` | Sort: | No literal reference found | No | Sort label |
| `switcher.sortAlpha` | A-Z | routineSwitcher.js, miniCycle.html | No | Sort button |
| `switcher.sortAlphaTitle` | Sort alphabetically | miniCycle.html | No | Sort tooltip |
| `switcher.sortRecent` | Recent | routineSwitcher.js, miniCycle.html | No | Sort button |
| `switcher.sortRecentTitle` | Sort by recently used | miniCycle.html | No | Sort tooltip |
| `switcher.sortSize` | Size | routineSwitcher.js, miniCycle.html | No | Sort button |
| `switcher.sortSizeTitle` | Sort by file size | miniCycle.html | No | Sort tooltip |
| `switcher.duplicateRoutine` | Duplicate routine | routineSwitcher.js, miniCycle.html | Yes | Action tooltip |
| `switcher.renameRoutine` | Rename routine | routineSwitcher.js, routineSwitcherActions.js, miniCycle.html | Yes | Action tooltip |
| `switcher.deleteRoutine` | Delete routine | routineSwitcher.js, miniCycle.html | Yes | Action tooltip |
| `switcher.preview` | Preview | routineSwitcherPreview.js, miniCycle.html | No | Preview label |
| `switcher.importExternal` | Import | miniCycle.html | Yes | Import button |
| `switcher.storage` | Routine Storage | No literal reference found | No | Storage label |
| `switcher.calculating` | Calculating... | No literal reference found | No | Storage status |
| `switcher.deleteTitle` | Delete Routine | routineSwitcherActions.js | Yes | Delete modal title |
| `switcher.deleteMessage` | Are you sure you want to delete "{name}"? This action cannot be undone. | routineSwitcherActions.js | Yes | Delete modal body |
| `switcher.noSaved` | No saved routines found. | routineSwitcher.js | Yes | Empty state |

---

## 8. Stats & Progress (Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `stats.title` | Stats | No literal reference found | No | Panel title |
| `stats.currentRoutine` | Current Routine | routineSwitcher.js, miniCycle.html | Yes | Section header |
| `stats.completion` | {completed} of {total} {taskWord} (followed by `stats.completionRound`: this {cycleWord}) | statsPanel.js | Yes | Progress text |
| `stats.cyclesCompleted` | {count} {cycleWord} completed | statsPanel.js | Yes | Cycle count |
| `stats.clearedTasks` | {count} Cleared {taskWord} | statsPanel.js | Yes | Cleared count |
| `stats.milestoneRewards` | Milestone Rewards | No literal reference found | No | Section header |
| `stats.achievementBadges` | Achievement Badges | No literal reference found | No | Button text |
| `stats.allRoutines` | All Routines: | No literal reference found | Yes | Global stat label |
| `stats.allRoutinesValue` | {count} {cycleWord} | No literal reference found | Yes | Global stat value |
| `stats.progressToNext` | Progress to next badge | No literal reference found | No | Progress ARIA |
| `stats.progressCleared` | {current} of {next} cleared {taskWord} to next badge | statsPanel.js | Yes | Progress text (cleared mode) |
| `stats.progressCycles` | {current} of {next} {cycleWord} to next badge | statsPanel.js | Yes | Progress text (cycle mode) |
| `stats.globalDisplay` | {cycles} {cycleText} / {cleared} cleared toward badges | statsPanel.js | Yes | Global stats display |
| `stats.progressCircleAria` | Current {cycleWord} {taskWord} completion | No literal reference found | Yes | Progress circle ARIA |

---

## 9. Notifications (Partially Lens-Sensitive)

### Task Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.taskRenamed` | Task renamed to "{name}" | taskCRUD.js | Yes | Success |
| `notify.taskDeleteCancelled` | "{name}" has not been deleted. | taskCRUD.js | No | Info |
| `notify.taskDeleted` | Task "{name}" deleted. | taskCRUD.js | Yes | Success |
| `notify.taskUpdateFailed` | Could not update task | taskCompletion.js | Yes | Warning |
| `notify.taskOrderFailed` | Could not save task order | taskCompletion.js | Yes | Warning |
| `notify.taskAddFailed` | Could not add task - please try again | uiBoot.js, taskCRUD.js | Yes | Error |
| `notify.clearTasksFailed` | Failed to clear tasks. Please try again. | menuManager.js | Yes | Error |
| `notify.deleteTasksFailed` | Failed to delete tasks. Please try again. | menuManager.js | Yes | Error |
| `notify.deletionCancelled` | Deletion cancelled. | menuManager.js | No | Info |
| `notify.saveCancelled` | Save cancelled. | menuManager.js | No | Info |
| `notify.noRoutineToSave` | No routine found to save. | menuManager.js | Yes | Warning |

### Cycle/Routine Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.cycleDeletedSwitch` | "{deleted}" deleted. "{active}" is now active. | routineSwitcherActions.js | No | Info |
| `notify.cycleDeleted` | "{name}" has been deleted. | routineSwitcherActions.js | No | Info |

### Recurring Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.recurringDisabled` | Recurring disabled for this task | taskButtons.js | Yes | Info |
| `notify.recurringTurnedOff` | Recurring turned off for this task. | recurringActivation.js, recurringPanel.js | Yes | Info |
| `notify.recurringRemoveFailed` | Failed to remove task | recurringPanel.js | Yes | Error |
| `notify.recurringNoTasksSelected` | No tasks selected | recurringPanelAddTask.js | No | Warning |
| `notify.recurringNoActiveCycle` | No active routine | recurringPanel.js, recurringPanelAddTask.js | Yes | Error |
| `notify.recurringAdded` | Added {count} {taskWord} to recurring (daily by default) | recurringPanelAddTask.js | Yes | Success |
| `notify.recurringAddFailed` | Failed to add tasks | recurringPanelAddTask.js | Yes | Error |
| `notify.recurringDefaultSaved` | Default recurring settings saved! | recurringSettingsApplicator.js | No | Success |
| `notify.recurringNoActiveFound` | No active routine found. | recurringSettingsApplicator.js | Yes | Warning |
| `notify.recurringDataNotFound` | Active routine data not found. | recurringSettingsApplicator.js | Yes | Warning |
| `notify.recurringNoChecked` | No tasks checked to apply settings. | recurringSettingsApplicator.js | Yes | Warning |

### History & Progress Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.historyCleared` | History cleared | historyManager.js | No | Success |
| `notify.progressReset` | Routine progress reset to 0 | historyManager.js | Yes | Success |
| `notify.clearedTasksEmptied` | Cleared tasks list emptied | clearedTasksManager.js | Yes | Success |
| `notify.clearedNoSelected` | No tasks selected | clearedTasksManager.js | No | Warning |
| `notify.clearedRecreateFailed` | Failed to recreate tasks - check console for details | clearedTasksManager.js, historyManager.js | Yes | Warning |

### Preferences Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.patternColorReset` | Pattern color reset to default | preferencesManager.js | No | Info |
| `notify.colorReset` | Color reset to default | preferencesManager.js | No | Info |
| `notify.allColorsReset` | All colors reset to defaults | preferencesManager.js | No | Success |
| `notify.themeApplied` | Applied "{name}" theme | routineSwitcherThemePicker.js, preferencesPresets.js | No | Success |
| `notify.undone` | Undone | preferencesManager.js | No | Info |
| `notify.presetSaved` | Preset "{name}" saved | preferencesPresets.js | No | Success |
| `notify.taskOptionsReset` | Task options reset to defaults | taskOptionsCustomizer.js | No | Info |
| `notify.selectCycleFirst` | Please select a routine first | taskOptionsCustomizer.js | Yes | Warning |
| `notify.selectRoutineFirst` | Please select a routine first | taskOptionsCustomizer.js | Yes | Warning |

### Import/Export Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.imported` | "{name}" imported with {count} recurring task(s)! | No literal reference found | Yes | Success |

### Storage Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.storageExceeded` | Storage quota exceeded. Please export your data and clear some space. | globalUtils.js | No | Error |
| `notify.saveFailed` | Failed to save data. Your changes may not be preserved. | appState.js, globalUtils.js | No | Error |

### Drag & Drop Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.reorderFailed` | Unable to reorder tasks right now | dragDropManager.js | No | Warning |
| `notify.reorderError` | Failed to reorder task | dragDropManager.js | No | Warning |

### Title Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.titleEmpty` | Title cannot be empty. Reverting to previous title. | titleManager.js | No | Error |
| `notify.titleSaveFailed` | Failed to save title change | titleManager.js | No | Error |

---

## 10. Confirmation Modals

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `modal.resetTasksTitle` | Complete Cycle with Due Dates | cycleCompletion.js, taskCycleReset.js | Yes | Modal title |
| `modal.resetTasksMessage` | Completing all tasks will reset them to incomplete status.\n\nAll assigned due dates will be cleared.\n\nProceed? | cycleCompletion.js, taskCycleReset.js | Yes | Modal body |
| `modal.resetTasksConfirm` | Complete Cycle | cycleCompletion.js, taskCycleReset.js | Yes | Confirm button |
| `modal.resetProgressTitle` | Reset Routine Progress | historyManager.js | Yes | Modal title |
| `modal.resetProgressConfirm` | Reset | historyManager.js | No | Confirm button |
| `modal.clearHistoryTitle` | Clear History | historyManager.js | No | Modal title |
| `modal.clearHistoryConfirm` | Clear | historyManager.js | No | Confirm button |
| `modal.removeRecurringTitle` | Remove Recurring Task | recurringPanel.js | Yes | Modal title |
| `modal.removeRecurringConfirm` | Remove | recurringPanel.js | No | Confirm button |
| `modal.liteVersionTitle` | Switch to Lite Version | uiBoot.js | No | Modal title |
| `modal.liteVersionConfirm` | Try Lite Version | uiBoot.js, deviceDetection.js | No | Confirm button |
| `modal.liteVersionCancel` | Stay Here | uiBoot.js | No | Cancel button |

---

## 11. Empty States (Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `empty.noTasks` | Your routine is empty | themeManager.js, focusTaskPanel.js | Yes | Empty task list |
| `empty.noTasksHint` | Press the + button to open the task bar and add your first task | themeManager.js, recurringBoot.js, routineManager.js | Yes | Empty state help |
| `empty.createFirst` | Create your first routine | No literal reference found | Yes | Onboarding heading |
| `empty.orTrySample` | or try a sample | No literal reference found | No | Onboarding subtext |
| `empty.noRecurringTasks` | Add a task from this routine to make it recurring | No literal reference found | Yes | Recurring panel empty |
| `empty.noRecurringSettings` | No recurring settings configured | recurringPanel.js | No | Recurring preview empty |
| `empty.noRoutineTasks` | No tasks in this routine. Add tasks first! | recurringPanelAddTask.js | Yes | Recurring add modal empty |
| `empty.noSavedPresets` | No saved presets yet | No literal reference found | No | Personalization empty |
| `empty.loadingTasks` | Loading tasks... | taskDOM.js | Yes | Loading placeholder |

---

## 12. Recurring Panel

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `recurring.title` | Recurring Tasks | modalTemplates.js | Yes | Panel heading |
| `recurring.checkAll` | Check All | modalTemplates.js, recurringPanel.js, recurringPanelSetup.js | No | Toggle button |
| `recurring.uncheckAll` | Uncheck All | recurringPanel.js, recurringPanelSetup.js | No | Toggle button |
| `recurring.addToRecurring` | Add Task to Recurring | modalTemplates.js, recurringPanelAddTask.js | Yes | Button |
| `recurring.addToRecurringShort` | Add to Recurring | modalTemplates.js, recurringPanelAddTask.js | No | Confirm button |
| `recurring.changeSettings` | Change Recurring Settings | modalTemplates.js, recurringPanel.js | No | Button |
| `recurring.showAdvanced` | Show Advanced Options | modalTemplates.js, recurringPanelSetup.js | No | Toggle button |
| `recurring.hideAdvanced` | Hide Advanced Options | recurringPanelSetup.js | No | Toggle button |
| `recurring.specificDates` | Specific date(s) | modalTemplates.js | No | Checkbox label |
| `recurring.specificTime` | Choose specific time | modalTemplates.js | No | Checkbox label |
| `recurring.indefinitely` | Recur indefinitely | modalTemplates.js | No | Radio label |
| `recurring.specificCount` | Specific number of times | modalTemplates.js | No | Radio label |
| `recurring.occurrences` | Number of occurrences: | modalTemplates.js | No | Input label |
| `recurring.untilDate` | Until specific date | modalTemplates.js | No | Radio label |
| `recurring.endDate` | End date: | modalTemplates.js | No | Input label |
| `recurring.repeat` | Repeat: | modalTemplates.js | No | Select label |
| `recurring.setAsDefault` | Set these recurring settings as default | modalTemplates.js | No | Checkbox label |
| `recurring.removeFromRecurring` | Remove from Recurring | recurringPanel.js | No | Button title |
| `recurring.selectTask` | Select {name} to make recurring | recurringPanelAddTask.js | Yes | ARIA label |

---

## 13. Frequency Labels

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `freq.hourly` | Hourly | modalTemplates.js, recurringPanelSetup.js, notifications.js | No | Frequency option |
| `freq.daily` | Daily | modalTemplates.js, recurringPanelSetup.js, notifications.js | No | Frequency option |
| `freq.weekly` | Weekly | modalTemplates.js, recurringPanelSetup.js, notifications.js | No | Frequency option |
| `freq.biweekly` | Biweekly | modalTemplates.js, recurringPanelSetup.js | No | Frequency option |
| `freq.monthly` | Monthly | modalTemplates.js, recurringPanelSetup.js, notifications.js | No | Frequency option |
| `freq.yearly` | Yearly | modalTemplates.js, recurringPanelSetup.js | No | Frequency option |

---

## 14. Menu Sections

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `menu.routineActions` | Routine Actions | miniCycle.html | Yes | Section header |
| `menu.taskActions` | Task Actions & Features | miniCycle.html | Yes | Section header |
| `menu.rewardsExtras` | Rewards & Extras | miniCycle.html | No | Section header |
| `menu.helpSupport` | Help & Support | miniCycle.html | No | Section header |
| `menu.settingsPersonalization` | Settings & Personalization | miniCycle.html | No | Section header |
| `menu.reminders` | Reminders | themeManager.js | Yes | Button |
| `menu.remindersTitle` | Configure reminders and notifications | themeManager.js | Yes | Tooltip |
| `menu.taskOptions` | Task Options | themeManager.js | Yes | Button |
| `menu.taskOptionsTitle` | Add or remove task option buttons | themeManager.js | Yes | Tooltip |
| `menu.recurring` | Recurring | themeManager.js | Yes | Button |
| `menu.recurringTitle` | Manage recurring tasks | themeManager.js | Yes | Tooltip |
| `menu.themes` | Themes | miniCycle.html | No | Button |
| `menu.games` | Games | miniCycle.html | No | Button |
| `menu.userManual` | User Manual | miniCycle.html | No | Button |
| `menu.feedback` | Feedback | miniCycle.html | No | Button |
| `menu.personalization` | Personalization | miniCycle.html | No | Button |
| `menu.settings` | Settings | miniCycle.html | No | Button |
| `menu.aria` | Menu | miniCycle.html | No | ARIA label |
| `menu.close` | Close Main Menu | miniCycle.html | No | Close ARIA |

---

## 15. Settings Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `settings.title` | Settings | modalTemplates.js | No | Modal title |
| `settings.display` | Display | modalTemplates.js | No | Section header |
| `settings.showMoveArrows` | Show Move Arrows | modalTemplates.js | No | Toggle label |
| `settings.showThreeDots` | Show Three Dots Menu | modalTemplates.js | No | Toggle label |
| `settings.showCompleted` | Show Completed in Dropdown | modalTemplates.js | No | Toggle label |
| `settings.darkMode` | Dark Mode | modalTemplates.js | No | Toggle label |
| `settings.behavior` | Behavior | modalTemplates.js | No | Section header |
| `settings.scrollToNew` | Scroll to New Task | modalTemplates.js | Yes | Toggle label |
| `settings.scrollToLast` | Scroll to Last Task on Load | modalTemplates.js | Yes | Toggle label |
| `settings.dataManagement` | Data Management | modalTemplates.js | No | Section header |
| `settings.backupAll` | Backup All Routines | modalTemplates.js, backupRestoreManager.js | Yes | Button |
| `settings.restoreAll` | Restore All Routines | modalTemplates.js | Yes | Button |
| `settings.resetOptions` | Reset Options | modalTemplates.js | No | Section header |
| `settings.resetOnboarding` | Reset Onboarding | modalTemplates.js | No | Button |
| `settings.resetNotifPosition` | Reset Notification Position | modalTemplates.js | No | Button |
| `settings.resetRecurringDefault` | Reset Recurring Default | modalTemplates.js | No | Button |
| `settings.resetAchievements` | Reset Achievements | modalTemplates.js | No | Button |
| `settings.advanced` | Advanced | modalTemplates.js | No | Section header |
| `settings.debugMode` | Debug Mode | modalTemplates.js | No | Toggle label |
| `settings.diagnostics` | App Diagnostics | modalTemplates.js | No | Button |
| `settings.checkUpdates` | Check for Updates | modalTemplates.js, miniCycle.html | No | Button |
| `settings.tryLite` | Try Lite Version | modalTemplates.js | No | Button |
| `settings.factoryReset` | Factory Reset | modalTemplates.js | No | Button |

---

## 16. Undo/Redo

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `undo.button` | Undo | miniCycle.html | No | Button text |
| `undo.title` | Undo last action | miniCycle.html | No | Tooltip |
| `undo.redoButton` | Redo | miniCycle.html | No | Button text |
| `undo.redoTitle` | Redo last undone action | miniCycle.html | No | Tooltip |
| `undo.taskCompletedOne` | Task completed | No literal reference found | Yes | Undo label |
| `undo.taskCompletedOther` | {count} tasks completed | No literal reference found | Yes | Undo label |
| `undo.taskUncompletedOne` | Task uncompleted | No literal reference found | Yes | Undo label |
| `undo.taskUncompletedOther` | {count} tasks uncompleted | No literal reference found | Yes | Undo label |

---

## 17. Universal Buttons

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `button.save` | Save | dueDates.js, routineSwitcherActions.js, dailyResetManager.js, taskCRUD.js, preferencesPresets.js | No |  |
| `button.cancel` | Cancel | modalTemplates.js, clearedTasksManager.js, dueDates.js, historyManager.js, reminders.js, cycleCompletion.js, recurringPanel.js, recurringPanelAddTask.js, routineManager.js, routineSwitcherActions.js, dailyResetManager.js, taskCRUD.js, taskCycleReset.js, backupRestoreManager.js, cycleExportManager.js, cycleImportManager.js, menuManager.js, preferencesPresets.js, settingsUIManager.js, shareManager.js, notifications.js | No |  |
| `button.close` | Close | modalTemplates.js, achievementsManager.js, clearedTasksManager.js, historyManager.js, routineSwitcherPreview.js, preferencesPresets.js, quickActionsManager.js, taskOptionsCustomizer.js, notifications.js, miniCycle.html | No |  |
| `button.confirm` | Confirm | No literal reference found | No |  |
| `button.delete` | Delete | routineSwitcherActions.js, taskCRUD.js, preferencesPresets.js, miniCycle.html | No |  |
| `button.apply` | Apply | modalTemplates.js, notifications.js | No |  |
| `button.open` | Open | miniCycle.html | No |  |
| `button.remove` | Remove | quickActionsManager.js | No |  |
| `button.reset` | Reset | modalTemplates.js | No |  |

---

## 18. Navigation & Layout

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `nav.tasksView` | Tasks view | No literal reference found | Yes | Tab ARIA |
| `nav.tasksTab` | Tasks | No literal reference found | Yes | Tab label |
| `nav.statsView` | Statistics view | No literal reference found | No | Tab ARIA |
| `nav.statsTab` | Stats | No literal reference found | No | Tab label |
| `nav.showStats` | Show Stats | No literal reference found | No | Arrow tooltip |
| `nav.showTasks` | Show Tasks | No literal reference found | Yes | Arrow tooltip |
| `nav.quickActions` | Quick Actions | quickActionsManager.js | No | Panel title |
| `nav.quickActionsAria` | Quick actions | miniCycle.html | No | Button ARIA |
| `nav.quickActionsShort` | Actions | miniCycle.html | No | Word beside the + |
| `nav.previousView` | Previous view | miniCycle.html | No | Arrow tooltip |
| `nav.nextView` | Next view | miniCycle.html | No | Arrow tooltip |
| `nav.completed` | Completed | taskUtils.js, miniCycle.html | Yes | Collapsible header |
| `nav.saving` | Saving... | No literal reference found | No | Save indicator |
| `nav.addTasks` | Add {tasks} | themeWords.js | Yes | Input bar toggle, all three menus, while hidden |
| `nav.hideAddTaskBar` | Hide Add {taskTitle} Bar | themeWords.js | Yes | Input bar toggle, all three menus, while shown |

---

## 19. Quick Actions

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `quickAction.stats` | Stats | quickActionsManager.js | No | Action label |
| `quickAction.openRoutine` | Switch Routine | quickActionsManager.js | Yes | Action label |
| `quickAction.recurring` | Recurring | quickActionsManager.js | No | Action label |
| `quickAction.reminders` | Reminders | quickActionsManager.js | No | Action label |
| `quickAction.settings` | Settings | quickActionsManager.js | No | Action label |
| `quickAction.recentlyUsed` | Recently Used | routineSwitcher.js, quickActionsManager.js | No | View title |
| `quickAction.frequentlyUsed` | Frequently Used | quickActionsManager.js | No | View title |

---

## 20. Theme Unlock Messages (Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `unlock.game` | {count} more cleared {taskWord} to unlock Whack-a-Order Game! | statsPanelRewards.js | Yes | Unlock progress |

> **Note:** `unlock.darkOcean` and `unlock.goldenGlow` were removed when the vocabulary theme system replaced those themes (Feb 2026).

---

## 21. About Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `about.title` | miniCycle | No literal reference found | No | Brand name |
| `about.tagline` | Turn Your Routine Into Progress | No literal reference found | No | Tagline |
| `about.description` | Your routine workflow companion — turn repeatable tasks into effortless cycles, stay focused, and build momentum. | No literal reference found | Yes | Description |
| `about.aria` | About miniCycle | miniCycle.html | No | Button ARIA |
| `about.closeAria` | Close about modal | No literal reference found | No | Close ARIA |

---

## 22. Personalization Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `prefs.title` | Personalization | modalTemplates.js | No | Modal title |
| `prefs.themeNotice` | Custom colors only apply in the Default theme. | modalTemplates.js, preferencesManager.js | No | Notice |
| `prefs.openThemes` | Open Themes | modalTemplates.js | No | Button |
| `prefs.livePreview` | Live Preview | modalTemplates.js | No | Section label |
| `prefs.quickThemes` | Quick Colors | modalTemplates.js | No | Section header |
| `prefs.savedPresets` | Saved Presets | modalTemplates.js | No | Section header |
| `prefs.import` | Import | modalTemplates.js | No | Button |
| `prefs.saveCurrent` | Save Current | modalTemplates.js | No | Button |
| `prefs.appTaskList` | App & Task List | No literal reference found | Yes | Section header |
| `prefs.appBackground` | App Background | modalTemplates.js | No | Label |
| `prefs.backgroundPattern` | Background Pattern | modalTemplates.js | No | Label |
| `prefs.patternColor` | Pattern Color | modalTemplates.js | No | Label |
| `prefs.backgroundImage` | Background Image | modalTemplates.js | No | Label |
| `prefs.upload` | Upload | modalTemplates.js | No | Button |
| `prefs.removeImage` | Remove | modalTemplates.js | No | Button |
| `prefs.showImage` | Show Image | modalTemplates.js | No | Label |
| `prefs.displayMode` | Display Mode | modalTemplates.js | No | Label |
| `prefs.stretchToFill` | Stretch to Fill | modalTemplates.js | No | Option |
| `prefs.centered` | Centered | modalTemplates.js | No | Option |
| `prefs.tiled` | Tiled | modalTemplates.js | No | Option |
| `prefs.imageHint` | Images over 2MB are compressed automatically. | modalTemplates.js | No | Hint |
| `prefs.listBackground` | List Background | modalTemplates.js | No | Label |
| `prefs.titleBackground` | Title Background | modalTemplates.js | No | Label |
| `prefs.titleText` | Title Text | modalTemplates.js | No | Label |
| `prefs.tasksCheckboxes` | Tasks & Checkboxes | modalTemplates.js | Yes | Section header |
| `prefs.taskBackground` | Task Background | modalTemplates.js | Yes | Label |
| `prefs.taskText` | Task Text | modalTemplates.js | Yes | Label |
| `prefs.checkboxFill` | Checkbox Fill | modalTemplates.js | No | Label |
| `prefs.checkboxEmpty` | Checkbox Empty | modalTemplates.js | No | Label |
| `prefs.checkmark` | Checkmark | modalTemplates.js | No | Label |
| `prefs.buttonsProgress` | Buttons & Progress | modalTemplates.js | No | Section header |
| `prefs.completeCycle` | Complete Cycle | modalTemplates.js | Yes | Label |
| `prefs.clearCompleted` | Clear Completed | modalTemplates.js | No | Label |
| `prefs.progressBar` | Progress Bar | modalTemplates.js | No | Label |
| `prefs.statsPanel` | Stats Panel | modalTemplates.js | No | Section header |
| `prefs.background` | Background | modalTemplates.js | No | Label |
| `prefs.textColor` | Text Color | modalTemplates.js | No | Label |
| `prefs.undoButton` | Undo | modalTemplates.js | No | Button |
| `prefs.undoTitle` | Undo last color change | modalTemplates.js | No | Tooltip |
| `prefs.resetAll` | Reset All | modalTemplates.js | No | Button |
| `prefs.resetDefault` | Reset to default | modalTemplates.js | No | Button tooltip |

---

## 23. Quick Theme Presets

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `preset.default` | Default | preferencesPresets.js | No | Preset name |
| `preset.defaultDesc` | Default blue theme | preferencesPresets.js | No | Tooltip |
| `preset.warm` | Warm | preferencesPresets.js | No | Preset name |
| `preset.warmDesc` | Warm sunset colors | preferencesPresets.js | No | Tooltip |
| `preset.cool` | Cool | preferencesPresets.js | No | Preset name |
| `preset.coolDesc` | Cool ocean colors | preferencesPresets.js | No | Tooltip |
| `preset.forest` | Forest | preferencesPresets.js | No | Preset name |
| `preset.forestDesc` | Natural forest colors | preferencesPresets.js | No | Tooltip |
| `preset.mono` | Mono | preferencesPresets.js | No | Preset name |
| `preset.monoDesc` | Elegant grayscale | preferencesPresets.js | No | Tooltip |
| `preset.pro` | Pro | preferencesPresets.js | No | Preset name |
| `preset.proDesc` | Clean minimal look | preferencesPresets.js | No | Tooltip |
| `preset.golden` | Golden | preferencesPresets.js | No | Preset name |
| `preset.goldenDesc` | Golden glow theme | preferencesPresets.js | No | Tooltip |
| `preset.ocean` | Ocean | preferencesPresets.js | No | Preset name |
| `preset.oceanDesc` | Dark ocean theme | preferencesPresets.js | No | Tooltip |
| `preset.berry` | Berry | preferencesPresets.js | No | Preset name |
| `preset.berryDesc` | Berry purple theme | preferencesPresets.js | No | Tooltip |

---

## 24. Reminders Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `reminders.title` | Reminders & Notifications | No literal reference found | No | Modal title |
| `reminders.enable` | Enable Reminders | No literal reference found | No | Toggle label |
| `reminders.enableDueDate` | Enable Due Date Notifications | No literal reference found | No | Toggle label |
| `reminders.indefinitely` | Remind Indefinitely? | No literal reference found | No | Toggle label |
| `reminders.count` | Number of Times: | No literal reference found | No | Input label |
| `reminders.every` | Every: | No literal reference found | No | Input label |
| `reminders.minutes` | Minutes | No literal reference found | No | Unit option |
| `reminders.hours` | Hours | No literal reference found | No | Unit option |
| `reminders.days` | Days | No literal reference found | No | Unit option |

---

## 25. Games Panel

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `games.title` | Games | gamesManager.js | No | Panel title |
| `games.description` | Try to complete tasks in the correct order as fast as you can! | gamesManager.js | Yes | Panel description |
| `games.play` | Play Whack-a-Order | gamesManager.js | Yes | Button |

---

## 26. Feedback Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `feedback.title` | Provide Feedback | modalManager.js | No | Modal title |
| `feedback.description` | We appreciate your feedback! Let us know how we can improve miniCycle. | modalManager.js | No | Description |
| `feedback.placeholder` | Write your feedback here... | modalManager.js | No | Textarea placeholder |
| `feedback.email` | Your Email (optional) | modalManager.js | No | Input placeholder |
| `feedback.submit` | Submit | modalManager.js | No | Button |
| `feedback.thanks` | Thank you for your feedback! | modalManager.js | No | Success message |

---

## 27. Themes Panel

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `themes.title` | Theme Settings | No literal reference found | No | Panel title |
| `themes.darkMode` | Dark Mode | No literal reference found | No | Toggle label |

---

## 28. History Panel

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `history.title` | History | historyManager.js | No | Panel ARIA |
| `history.clearedTasks` | Cleared Tasks | clearedTasksManager.js, historyManager.js | Yes | Tab ARIA |
| `history.achievements` | Achievements | achievementsManager.js | No | Panel ARIA |

---

## 29. Boot & System Messages

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `boot.loadingModules` | Loading modules... | orchestrator.js | No | Loader |
| `boot.checkingUpdates` | Checking for updates... | orchestrator.js | No | Loader |
| `boot.loadingCore` | Loading core... | orchestrator.js | No | Loader |
| `boot.startingSystems` | Starting systems... | orchestrator.js | No | Loader |
| `boot.loadingFeatures` | Loading features... | orchestrator.js | No | Loader |
| `boot.startingUp` | Starting up... | orchestrator.js | No | Loader |
| `boot.ready` | Ready! | orchestrator.js | No | Loader |
| `boot.unableToLoad` | Unable to Load | orchestrator.js | No | Error title |
| `boot.havingTrouble` | Having trouble loading... | orchestrator.js | No | Error message |
| `boot.retrying` | Retrying automatically... | orchestrator.js | No | Error status |
| `boot.clearCache` | Clear Cache & Reload | orchestrator.js | No | Error button |
| `boot.tryAgain` | Try Again | orchestrator.js | No | Error button |
| `boot.useLite` | Use Lite Version | orchestrator.js | No | Error button |
| `boot.failedAt` | Failed at: {phase} (attempt {number}) | No literal reference found | No | Error detail |
| `boot.appUpdated` | App updated! Cache refreshed automatically. | featureBoot.js | No | Notification |
| `boot.dataRestored` | Data restored after interrupted test run | No literal reference found | No | Notification |
| `boot.updateAvailable` | Update Available! | No literal reference found | No | Banner title |
| `boot.oldCachedVersion` | Your browser has an old cached version. | No literal reference found | No | Banner message |
| `boot.dismiss` | Dismiss | No literal reference found | No | Banner button |
| `boot.refreshIOS` | Scroll down and release to refresh, or close and reopen the app. | No literal reference found | No | Platform instruction |
| `boot.refreshAndroid` | Pull down to refresh, or clear browser data in Settings. | No literal reference found | No | Platform instruction |
| `boot.refreshMac` | Press Cmd+Shift+R to hard refresh. | No literal reference found | No | Platform instruction |
| `boot.refreshOther` | Press Ctrl+Shift+R to hard refresh. | No literal reference found | No | Platform instruction |
| `boot.previewSelect` | Select a routine to preview | No literal reference found | Yes | Preview placeholder |

---

## 30. Page Metadata

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `meta.title` | miniCycle - Turn Your Routine Into Progress | No literal reference found | No | Page title |
| `meta.description` | miniCycle is a routine workflow companion that turns repeatable tasks into effortless cycles. Track progress, build momentum, a... | No literal reference found | No | Meta description |

---

## 31. Footer

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `footer.privacyPolicy` | Privacy Policy | No literal reference found | No | Link text |
| `footer.termsOfService` | Terms of Service | No literal reference found | No | Link text |
| `footer.feedback` | Feedback | miniCycle.html | No | Link text |
| `footer.productName` | miniCycle | No literal reference found | No | Link text |

---

## Summary

Per-category and total key counts are not kept here: they change with most releases. For the live numbers call `getLabelDiagnostics()` (`labelResolver.js`), which returns the category count, the total key count and the size of `LENS_SENSITIVE_KEYS`, or read `defaultLabels.js` directly.

> **Note:** This reference was originally created during the Phase 1 audit, before the registry existed. Its tables were re-checked against `defaultLabels.js` on the date at the top (keys, values, lens flags, source files), but they still list only the keys that audit identified, so a key missing from this file is not missing from the app.
