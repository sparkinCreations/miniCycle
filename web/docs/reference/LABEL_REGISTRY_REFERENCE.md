# Label Registry Reference

**Status:** Audit Complete
**Purpose:** Catalog of all user-facing strings for centralized label management
**Related:** [CONTEXTUAL_THEME_SYSTEM_PLAN.md](../archive/CONTEXTUAL_THEME_SYSTEM_PLAN.md)

---

## How to Read This File

- **Key**: Label key for `defaultLabels.js` (always 2-level: `category.key`)
- **Current Value**: The string as it appears today
- **Source(s)**: File(s) where this string lives
- **Lens-Sensitive**: Would this string change with a contextual lens? (e.g., "task" becomes "habit" in Habit Tracker lens)

Strings marked lens-sensitive are the primary targets for the contextual theme system. Universal strings stay the same regardless of lens.

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

// Combined
getLabel('stats.completion', { count: 3, vars: { completed: 3, total: 5 } })
                                              // → '3 of 5 Tasks Completed'
```

**Important:** Keys are always 2-level. Pluralization is handled via `{ count }` option, NOT via `.one`/`.other` suffixes in the key.

---

## 1. Core Nouns (Lens-Sensitive)

These are the foundational terms that define the app's vocabulary. A contextual lens primarily swaps these.

| Key | Type | Usage | Result | Source(s) |
|-----|------|-------|--------|-----------|
| `noun.task` | Plural | `getLabel('noun.task', { count: 1 })` | 'task' | Throughout |
| `noun.task` | Plural | `getLabel('noun.task', { count: 5 })` | 'tasks' | Throughout |
| `noun.cycle` | Plural | `getLabel('noun.cycle', { count: 1 })` | 'cycle' | Throughout |
| `noun.cycle` | Plural | `getLabel('noun.cycle', { count: 5 })` | 'cycles' | Throughout |
| `noun.routine` | Plural | `getLabel('noun.routine', { count: 1 })` | 'routine' | Throughout |
| `noun.routine` | Plural | `getLabel('noun.routine', { count: 5 })` | 'routines' | Throughout |
| `noun.miniCycle` | String | `getLabel('noun.miniCycle')` | 'miniCycle' | miniCycle.html, routineSwitcher.js |

**Note:** Plural nouns are stored as `{ one: 'task', other: 'tasks' }` in `defaultLabels.js`. The resolver handles pluralization via the `count` option.

---

## 2. Mode Labels (Lens-Sensitive)

| Key | Current Value | Source(s) | Notes |
|-----|--------------|-----------|-------|
| `mode.auto` | Auto Cycle | miniCycle.html:1185 | Mode selector dropdown |
| `mode.autoEmoji` | ↻ | miniCycle.html:1185 | Mode emoji |
| `mode.autoDescription` | Automatically cycle tasks | miniCycle.html:1185 (title) | Tooltip description |
| `mode.manual` | Manual Cycle | miniCycle.html:1186 | Mode selector dropdown |
| `mode.manualEmoji` | ✋↻ | miniCycle.html:1186 | Mode emoji |
| `mode.manualDescription` | Manually cycle through tasks | miniCycle.html:1186 (title) | Tooltip description |
| `mode.todo` | To-Do Mode | miniCycle.html:1187 | Mode selector dropdown |
| `mode.todoEmoji` | 📋 | miniCycle.html:1187 | Mode emoji |
| `mode.todoDescription` | Simple To-Do list mode | miniCycle.html:1187 (title) | Tooltip description |
| `mode.autoTitle` | Auto Cycle Mode | modeManager.js | Mode info box title |
| `mode.autoDetail` | Tasks will automatically reset to incomplete... | modeManager.js | Mode info box description |
| `mode.manualTitle` | Manual Cycle Mode | modeManager.js | Mode info box title |
| `mode.manualDetail` | Tasks will only reset when you manually... | modeManager.js | Mode info box description |
| `mode.todoTitle` | To-Do Mode | modeManager.js | Mode info box title |
| `mode.todoDetail` | This mode will not complete any cycles... | modeManager.js | Mode info box description |
| `mode.autoToggle` | Auto Reset | miniCycle.html:1352 | Auto reset toggle label |
| `mode.deleteChecked` | Delete Checked Tasks after Complete | miniCycle.html:1364 | Delete checked toggle label |
| `mode.info` | Mode Info | miniCycle.html:1342 | Mode description toggle |

---

## 3. Task Actions (Partially Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `action.addTask` | Add task | miniCycle.html:2593 (title) | Yes | Add button tooltip |
| `action.addTask.button` | Add | miniCycle.html:2593 | No | Button text |
| `action.addTask.placeholder` | Enter a task... | miniCycle.html:2592 | Yes | Input placeholder |
| `action.addTask.title` | Type a task and press Add or Enter | miniCycle.html:2592 (title) | Yes | Input tooltip |
| `action.addTask.menu` | Add Task | miniCycle.html:1176 | Yes | Plus button dropdown |
| `action.editTask.title` | Edit Task Name | taskCRUD.js:343 | Yes | Edit modal title |
| `action.editTask.message` | Rename this task: | taskCRUD.js:344 | Yes | Edit modal body |
| `action.editTask.placeholder` | Enter new task name | taskCRUD.js:345 | Yes | Edit modal input |
| `action.deleteTask.title` | Delete Task | taskCRUD.js:423 | Yes | Delete modal title |
| `action.deleteTask.message` | Are you sure you want to delete "{name}"? | taskCRUD.js:424 | Yes | Delete modal body |
| `action.completeAll` | Complete | miniCycle.html:2644 | Yes | Complete all button |
| `action.completeAll.title` | Complete all checked tasks | miniCycle.html:2644 (title) | Yes | Complete all tooltip |
| `action.completeCycle` | Complete Cycle | miniCycle.html (progress btn) | Yes | Manual mode button |
| `action.clearAll.menu` | Uncheck All | miniCycle.html:1287 | No | Menu button |
| `action.clearAll.title` | Uncheck all tasks in this routine | miniCycle.html:1287 (title) | Yes | Menu tooltip |
| `action.deleteAll.menu` | Delete All | miniCycle.html:1288 | No | Menu button |
| `action.deleteAll.title` | Delete all tasks in this routine | miniCycle.html:1288 (title) | Yes | Menu tooltip |
| `action.clearCompletedTasks` | Clear Completed Tasks | taskUI.js | Yes | Todo-mode button text |
| `action.markTaskComplete` | Mark task "{name}" as complete | taskDOM.js | Yes | Checkbox ARIA label |
| `action.searchTasks` | Search tasks | miniCycle.html:2599 (title) | Yes | Search button tooltip |
| `action.searchTasks.placeholder` | Search tasks... | miniCycle.html:2610 | Yes | Search input placeholder |
| `action.clearSearch` | Clear search | miniCycle.html:2611 (title) | No | Clear search tooltip |

---

## 4. Task Option Buttons (Partially Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `taskOption.moveUp` | Move task up | taskButtons.js:269 | Yes | ARIA label |
| `taskOption.moveDown` | Move task down | taskButtons.js:270 | Yes | ARIA label |
| `taskOption.recurring` | Toggle recurring task | taskButtons.js:271 | Yes | ARIA label |
| `taskOption.dueDate` | Set due date | taskButtons.js:272 | No | ARIA label |
| `taskOption.reminders` | Toggle reminders for this task | taskButtons.js:273 | Yes | ARIA label |
| `taskOption.priority` | Mark task as high priority | taskButtons.js:274 | Yes | ARIA label |
| `taskOption.edit` | Edit task | taskButtons.js:275 | Yes | ARIA label |
| `taskOption.delete` | Delete task | taskButtons.js:276 | Yes | ARIA label |
| `taskOption.deleteOnComplete` | Marked for removal (removes task on reset or clear) | taskButtons.js:277 | Yes | ARIA label |
| `taskOption.showOptions` | Show task options | taskDOM.js:734 | Yes | Three dots tooltip |
| `taskOption.customize` | Customize task options | taskButtons.js:142 | Yes | Customize button tooltip |
| `taskOption.customize.aria` | Customize which task option buttons are visible | taskButtons.js:144 | Yes | ARIA label |

---

## 5. Task Option Customizer Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `taskOptions.title` | Customize Task Options | miniCycle.html:1936, taskOptionsCustomizer.js | No | Modal title |
| `taskOptions.subtitle` | Choose which buttons appear for tasks in "{name}" | taskOptionsCustomizer.js | Yes | Modal subtitle |
| `taskOptions.thisCycle` | THIS CYCLE | taskOptionsCustomizer.js | Yes | Section header |
| `taskOptions.optionDetails` | OPTION DETAILS | taskOptionsCustomizer.js | No | Section header |
| `taskOptions.highPriority` | High Priority Toggle | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.renameTask` | Rename Task | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.deleteTask` | Delete Task | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.recurringTask` | Recurring Task | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.setDueDate` | Set Due Date | taskOptionsCustomizer.js | No | Option name |
| `taskOptions.taskReminders` | Task Reminders | taskOptionsCustomizer.js | Yes | Option name |
| `taskOptions.changesApply` | Changes apply immediately | taskOptionsCustomizer.js | No | Footer note |
| `taskOptions.resetDefault` | Reset to Default | taskOptionsCustomizer.js | No | Reset button |

---

## 6. Routine Actions (Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `routine.create` | Create New Routine | miniCycle.html:1180 | Yes | Plus dropdown |
| `routine.create.title` | Create a new routine | miniCycle.html:1272 (title) | Yes | Menu tooltip |
| `routine.create.menu` | New | miniCycle.html:1272 | No | Menu button |
| `routine.download` | Download | miniCycle.html:1273 | No | Menu button |
| `routine.download.title` | Download the current routine as a file | miniCycle.html:1273 (title) | Yes | Menu tooltip |
| `routine.open` | Open | miniCycle.html:1274 | No | Menu button |
| `routine.open.title` | Open an existing routine | miniCycle.html:1274 (title) | Yes | Menu tooltip |
| `routine.import` | Import | miniCycle.html:1275 | No | Menu button |
| `routine.import.title` | Import a routine from a file | miniCycle.html:1275 (title) | Yes | Menu tooltip |
| `routine.duplicate` | Duplicate | miniCycle.html:1276 | No | Menu button |
| `routine.duplicate.title` | Duplicate the current routine | miniCycle.html:1276 (title) | Yes | Menu tooltip |
| `routine.switch` | Switch routine | miniCycle.html:1189 (aria) | Yes | Routine switcher ARIA |
| `routine.untitled` | Untitled Cycle | routineLoader.js:367 | Yes | Fallback title |

---

## 7. Routine Switcher Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `switcher.title` | Open Routine | miniCycle.html:2468 | Yes | Modal title |
| `switcher.search` | Search routines... | miniCycle.html:2470 | Yes | Search placeholder |
| `switcher.filterAll` | All Modes | miniCycle.html:2476 | No | Filter option |
| `switcher.filterAuto` | Auto Cycle | miniCycle.html:2477 | Yes | Filter option |
| `switcher.filterManual` | Manual Cycle | miniCycle.html:2478 | Yes | Filter option |
| `switcher.filterTodo` | To-Do | miniCycle.html:2479 | No | Filter option |
| `switcher.sort` | Sort: | miniCycle.html:2484 | No | Sort label |
| `switcher.sortAlpha` | A-Z | miniCycle.html:2485 | No | Sort button |
| `switcher.sortAlpha.title` | Sort alphabetically | miniCycle.html:2485 (title) | No | Sort tooltip |
| `switcher.sortRecent` | Recent | miniCycle.html:2486 | No | Sort button |
| `switcher.sortRecent.title` | Sort by recently modified | miniCycle.html:2486 (title) | No | Sort tooltip |
| `switcher.sortSize` | Size | miniCycle.html:2487 | No | Sort button |
| `switcher.sortSize.title` | Sort by file size | miniCycle.html:2487 (title) | No | Sort tooltip |
| `switcher.duplicateRoutine` | Duplicate routine | miniCycle.html:2493 (title) | Yes | Action tooltip |
| `switcher.renameRoutine` | Rename routine | miniCycle.html:2494 (title) | Yes | Action tooltip |
| `switcher.deleteRoutine` | Delete routine | miniCycle.html:2495 (title) | Yes | Action tooltip |
| `switcher.preview` | Preview | miniCycle.html:2496 | No | Preview label |
| `switcher.importExternal` | Import Routine | miniCycle.html:2504 | No | Import button |
| `switcher.storage` | Storage | miniCycle.html:2510 | No | Storage label |
| `switcher.calculating` | Calculating... | miniCycle.html:2518 | No | Storage status |
| `switcher.deleteTitle` | Delete miniCycle | routineSwitcher.js:306 | Yes | Delete modal title |
| `switcher.deleteMessage` | Are you sure you want to delete "{name}"? This action cannot be undone. | routineSwitcher.js:307 | No | Delete modal body |
| `switcher.noSaved` | No saved miniCycles found. | routineSwitcher.js:150 | Yes | Empty state |

---

## 8. Stats & Progress (Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `stats.title` | Stats | miniCycle.html:2663 | No | Panel title |
| `stats.currentRoutine` | Current Routine | miniCycle.html:2666 | Yes | Section header |
| `stats.completion` | {completed} of {total} Tasks Completed | statsPanel.js:952, miniCycle.html:2686 | Yes | Progress text |
| `stats.cyclesCompleted` | {count} Cycles Completed | miniCycle.html:2687 | Yes | Cycle count |
| `stats.clearedTasks` | {count} Cleared Tasks | miniCycle.html:2688 | Yes | Cleared count |
| `stats.milestoneRewards` | Milestone Rewards | miniCycle.html:2692 | No | Section header |
| `stats.achievementBadges` | Achievement Badges | miniCycle.html:2722 | No | Button text |
| `stats.allRoutines` | All Routines: | miniCycle.html:2746 | Yes | Global stat label |
| `stats.allRoutines.value` | {count} Cycles | miniCycle.html:2746 | Yes | Global stat value |
| `stats.progressToNext` | Progress to next milestone | miniCycle.html:2749 (aria) | No | Progress ARIA |
| `stats.progressText.cleared` | {current} of {next} cleared tasks to next milestone | statsPanel.js:995 | Yes | Progress text (cleared mode) |
| `stats.progressText.cycles` | {current} of {next} cycles to next milestone | statsPanel.js:995 | Yes | Progress text (cycle mode) |
| `stats.globalDisplay` | {cycles} {cycleText} / {cleared} {clearedText} | statsPanel.js:961 | Yes | Global stats display |
| `stats.progressCircle.aria` | Current cycle task completion | miniCycle.html:2670 (aria) | Yes | Progress circle ARIA |

---

## 9. Notifications (Partially Lens-Sensitive)

### Task Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.taskRenamed` | Task renamed to "{name}" | taskCRUD.js:380 | Yes | Success |
| `notify.taskDeleteCancelled` | "{name}" has not been deleted. | taskCRUD.js:430 | No | Info |
| `notify.taskDeleted` | Task "{name}" deleted. | taskCRUD.js:464 | Yes | Success |
| `notify.taskUpdateFailed` | Could not update task | taskCompletion.js:196 | Yes | Warning |
| `notify.taskOrderFailed` | Could not save task order | taskCompletion.js:234 | Yes | Warning |
| `notify.taskAddFailed` | Failed to add task. Please try again. | uiBoot.js | Yes | Error |
| `notify.clearTasksFailed` | Failed to clear tasks. Please try again. | menuManager.js:553 | Yes | Error |
| `notify.deleteTasksFailed` | Failed to delete tasks. Please try again. | menuManager.js:643 | Yes | Error |
| `notify.deletionCancelled` | Deletion cancelled. | menuManager.js:623 | No | Info |
| `notify.saveCancelled` | Save cancelled. | menuManager.js:450 | No | Info |
| `notify.noRoutineToSave` | No miniCycle found to save. | menuManager.js:417 | Yes | Warning |

### Cycle/Routine Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.cycleDeletedSwitch` | "{deleted}" deleted. "{active}" is now active. | routineSwitcher.js:422 | No | Info |
| `notify.cycleDeleted` | "{name}" has been deleted. | routineSwitcher.js:424 | No | Info |

### Recurring Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.recurringDisabled` | Recurring disabled for this task | taskButtons.js:511 | Yes | Info |
| `notify.recurringTurnedOff` | Recurring turned off for this task. | recurringPanel.js:970 | Yes | Info |
| `notify.recurringRemoveFailed` | Failed to remove task | recurringPanel.js:1032 | Yes | Error |
| `notify.recurringNoTasksSelected` | No tasks selected | recurringPanel.js:1545 | No | Warning |
| `notify.recurringNoActiveCycle` | No active routine | recurringPanel.js:1554 | Yes | Error |
| `notify.recurringAdded` | Added {count} {taskWord} to recurring (daily by default) | recurringPanel.js:1596 | Yes | Success |
| `notify.recurringAddFailed` | Failed to add tasks | recurringPanel.js:1602 | Yes | Error |
| `notify.recurringDefaultSaved` | Default recurring settings saved! | recurringSettingsApplicator.js:158 | No | Success |
| `notify.recurringNoActiveFound` | No active cycle found. | recurringSettingsApplicator.js:65 | Yes | Warning |
| `notify.recurringDataNotFound` | Active cycle data not found. | recurringSettingsApplicator.js:71 | Yes | Warning |
| `notify.recurringNoChecked` | No tasks checked to apply settings. | recurringSettingsApplicator.js:78 | Yes | Warning |

### History & Progress Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.historyCleared` | History cleared | historyManager.js:132 | No | Success |
| `notify.progressReset` | Routine progress reset to 0 | historyManager.js:167 | Yes | Success |
| `notify.clearedTasksEmptied` | Cleared tasks list emptied | clearedTasksManager.js:196 | Yes | Success |
| `notify.clearedNoSelected` | No tasks selected | clearedTasksManager.js:248 | No | Warning |
| `notify.clearedRecreateFailed` | Failed to recreate tasks - check console for details | clearedTasksManager.js:286 | Yes | Warning |

### Preferences Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.patternColorReset` | Pattern color reset to default | preferencesManager.js:1448 | No | Info |
| `notify.colorReset` | Color reset to default | preferencesManager.js:1471 | No | Info |
| `notify.allColorsReset` | All colors reset to defaults | preferencesManager.js:1514 | No | Success |
| `notify.themeApplied` | Applied "{name}" theme | preferencesManager.js:1733 | No | Success |
| `notify.undone` | Undone | preferencesManager.js:1778 | No | Info |
| `notify.presetSaved` | Preset "{name}" saved | preferencesManager.js:1848 | No | Success |
| `notify.taskOptionsReset` | Reset to defaults | taskOptionsCustomizer.js:727 | No | Info |
| `notify.selectCycleFirst` | Please select a cycle first | taskOptionsCustomizer.js:254 | Yes | Warning |
| `notify.selectRoutineFirst` | Please select a routine first | taskOptionsCustomizer.js:280 | Yes | Warning |

### Import/Export Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.imported` | "{name}" imported with {count} recurring task(s)! | cycleImportManager.js | Yes | Success |

### Storage Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.storageExceeded` | Storage quota exceeded. Please export your data and clear some space. | globalUtils.js:456 | No | Error |
| `notify.saveFailed` | Failed to save data. Your changes may not be preserved. | globalUtils.js:458 | No | Error |

### Drag & Drop Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.reorderFailed` | Unable to reorder tasks right now | dragDropManager.js:616 | Yes | Warning |
| `notify.reorderError` | Failed to reorder task | dragDropManager.js:620 | Yes | Warning |

### Title Notifications

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `notify.titleEmpty` | Title cannot be empty. Reverting to previous title. | titleManager.js:130 | No | Error |
| `notify.titleSaveFailed` | Failed to save title change | titleManager.js:155 | No | Error |

---

## 10. Confirmation Modals

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `modal.resetTasks.title` | Reset Tasks with Due Dates | taskCycleReset.js:753 | Yes | Modal title |
| `modal.resetTasks.message` | This will complete all tasks and reset them to an uncompleted state.\n\nAny assigned Due Dates will be cleared.\n\nProceed? | taskCycleReset.js:754 | Yes | Modal body |
| `modal.resetTasks.confirm` | Reset Tasks | taskCycleReset.js:755 | Yes | Confirm button |
| `modal.resetProgress.title` | Reset Routine Progress | historyManager.js:181 | Yes | Modal title |
| `modal.resetProgress.confirm` | Reset | historyManager.js:183 | No | Confirm button |
| `modal.clearHistory.title` | Clear History | historyManager.js:432 | No | Modal title |
| `modal.clearHistory.confirm` | Clear | historyManager.js:434 | No | Confirm button |
| `modal.removeRecurring.title` | Remove Recurring Task | recurringPanel.js:934 | Yes | Modal title |
| `modal.removeRecurring.confirm` | Remove | recurringPanel.js:936 | No | Confirm button |
| `modal.liteVersion.title` | Switch to Lite Version | uiBoot.js:587 | No | Modal title |
| `modal.liteVersion.confirm` | Try Lite Version | uiBoot.js:589 | No | Confirm button |
| `modal.liteVersion.cancel` | Stay Here | uiBoot.js:590 | No | Cancel button |

---

## 11. Empty States (Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `empty.noTasks` | No tasks yet | miniCycle.html:2618 | Yes | Empty task list |
| `empty.noTasks.hint` | Press the + button above to add a task or create a new routine | miniCycle.html:2620 | Yes | Empty state help |
| `empty.createFirst` | Create your first routine | miniCycle.html:2626 | Yes | Onboarding heading |
| `empty.orTrySample` | or try a sample | miniCycle.html:2627 | No | Onboarding subtext |
| `empty.noRecurringTasks` | Add a task from this routine to make it recurring | miniCycle.html:1391 (title) | Yes | Recurring panel empty |
| `empty.noRecurringSettings` | No recurring settings configured | recurringPanel.js:1160 | No | Recurring preview empty |
| `empty.noRoutineTasks` | No tasks in this routine. Add tasks first! | recurringPanel.js:1487 | Yes | Recurring add modal empty |
| `empty.noSavedPresets` | No saved presets yet | miniCycle.html:2260 | No | Personalization empty |
| `empty.loadingTasks` | Loading tasks... | taskDOM.js:535 | Yes | Loading placeholder |

---

## 12. Recurring Panel

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `recurring.title` | Recurring Tasks | miniCycle.html:1379 | Yes | Panel heading |
| `recurring.checkAll` | Check All | miniCycle.html:1381 | No | Toggle button |
| `recurring.uncheckAll` | Uncheck All | recurringPanel.js:1082 | No | Toggle button |
| `recurring.addToRecurring` | Add Task to Recurring | miniCycle.html:1392 | Yes | Button |
| `recurring.addToRecurringShort` | Add to Recurring | miniCycle.html:1398 | No | Confirm button |
| `recurring.changeSettings` | Change Recurring Settings | recurringPanel.js:1226 | No | Button |
| `recurring.showAdvanced` | Show Advanced Options | miniCycle.html:1489 | No | Toggle button |
| `recurring.hideAdvanced` | Hide Advanced Options | recurringPanelSetup.js:130 | No | Toggle button |
| `recurring.specificDates` | Specific date(s) | miniCycle.html:1408 | No | Checkbox label |
| `recurring.specificTime` | Choose specific time | miniCycle.html:1426 | No | Checkbox label |
| `recurring.indefinitely` | Recur indefinitely | miniCycle.html:1454 | No | Radio label |
| `recurring.specificCount` | Specific number of times | miniCycle.html:1460 | No | Radio label |
| `recurring.occurrences` | Number of occurrences: | miniCycle.html:1463 | No | Input label |
| `recurring.untilDate` | Until specific date | miniCycle.html:1469 | No | Radio label |
| `recurring.endDate` | End date: | miniCycle.html:1472 | No | Input label |
| `recurring.repeat` | Repeat: | miniCycle.html:1478 | No | Select label |
| `recurring.setAsDefault` | Set these recurring settings as default | miniCycle.html:1776 | No | Checkbox label |
| `recurring.removeFromRecurring` | Remove from Recurring | recurringPanel.js:914 | No | Button title |
| `recurring.selectTask` | Select {name} to make recurring | recurringPanel.js:1506 | Yes | ARIA label |

---

## 13. Frequency Labels

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `freq.hourly` | Hourly | miniCycle.html:1480 | No | Frequency option |
| `freq.daily` | Daily | miniCycle.html:1481 | No | Frequency option |
| `freq.weekly` | Weekly | miniCycle.html:1482 | No | Frequency option |
| `freq.biweekly` | Biweekly | miniCycle.html:1483 | No | Frequency option |
| `freq.monthly` | Monthly | miniCycle.html:1484 | No | Frequency option |
| `freq.yearly` | Yearly | miniCycle.html:1485 | No | Frequency option |

---

## 14. Menu Sections

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `menu.routineActions` | Routine Actions | miniCycle.html:1268 | Yes | Section header |
| `menu.taskActions` | Task Actions & Features | miniCycle.html:1283 | Yes | Section header |
| `menu.rewardsExtras` | Rewards & Extras | miniCycle.html:1300 | No | Section header |
| `menu.helpSupport` | Help & Support | miniCycle.html:1316 | No | Section header |
| `menu.settingsPersonalization` | Settings & Personalization | miniCycle.html:1329 | No | Section header |
| `menu.reminders` | Reminders | miniCycle.html:1289 | No | Button |
| `menu.reminders.title` | Configure reminders and notifications | miniCycle.html:1289 (title) | No | Tooltip |
| `menu.taskOptions` | Task Options | miniCycle.html:1290 | Yes | Button |
| `menu.taskOptions.title` | Customize task option buttons | miniCycle.html:1290 (title) | Yes | Tooltip |
| `menu.recurring` | Recurring | miniCycle.html:1291 | No | Button |
| `menu.recurring.title` | Manage recurring tasks | miniCycle.html:1291 (title) | Yes | Tooltip |
| `menu.themes` | Themes | miniCycle.html:1305 | No | Button |
| `menu.games` | Games | miniCycle.html:1308 | No | Button |
| `menu.userManual` | User Manual | miniCycle.html:1320 | No | Button |
| `menu.feedback` | Feedback | miniCycle.html:1321 | No | Button |
| `menu.personalization` | Personalization | miniCycle.html:1333 | No | Button |
| `menu.settings` | Settings | miniCycle.html:1334 | No | Button |
| `menu.aria` | Menu | miniCycle.html:1161 (aria) | No | ARIA label |
| `menu.close` | Close Main Menu | miniCycle.html:1369 (aria) | No | Close ARIA |

---

## 15. Settings Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `settings.title` | Settings | miniCycle.html:1856 | No | Modal title |
| `settings.display` | Display | miniCycle.html:1861 | No | Section header |
| `settings.showMoveArrows` | Show Move Arrows | miniCycle.html:1870 | No | Toggle label |
| `settings.showThreeDots` | Show Three Dots Menu | miniCycle.html:1877 | No | Toggle label |
| `settings.showRecurring` | Always Show Recurring Button | miniCycle.html:1884 | No | Toggle label |
| `settings.showCompleted` | Show Completed in Dropdown | miniCycle.html:1891 | No | Toggle label |
| `settings.darkMode` | Dark Mode | miniCycle.html:1898 | No | Toggle label |
| `settings.behavior` | Behavior | miniCycle.html:1906 | No | Section header |
| `settings.scrollToNew` | Scroll to New Task | miniCycle.html:1915 | Yes | Toggle label |
| `settings.scrollToLast` | Scroll to Last Task on Load | miniCycle.html:1922 | Yes | Toggle label |
| `settings.dataManagement` | Data Management | miniCycle.html:1930 | No | Section header |
| `settings.backupAll` | Backup All Routines | miniCycle.html:1934 | Yes | Button |
| `settings.restoreAll` | Restore All Routines | miniCycle.html:1935 | Yes | Button |
| `settings.resetOptions` | Reset Options | miniCycle.html:1943 | No | Section header |
| `settings.resetOnboarding` | Reset Onboarding | miniCycle.html:1947 | No | Button |
| `settings.resetNotifPosition` | Reset Notification Position | miniCycle.html:1948 | No | Button |
| `settings.resetRecurringDefault` | Reset Recurring Default | miniCycle.html:1949 | No | Button |
| `settings.resetAchievements` | Reset Achievements | miniCycle.html:1950 | No | Button |
| `settings.advanced` | Advanced | miniCycle.html:1957 | No | Section header |
| `settings.debugMode` | Debug Mode | miniCycle.html:1966 | No | Toggle label |
| `settings.diagnostics` | App Diagnostics | miniCycle.html:1968 | No | Button |
| `settings.checkUpdates` | Check for Updates | miniCycle.html:1969 | No | Button |
| `settings.tryLite` | Try Lite Version | miniCycle.html:1970 | No | Button |
| `settings.factoryReset` | Factory Reset | miniCycle.html:1971 | No | Button |

---

## 16. Undo/Redo

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `undo.button` | Undo | miniCycle.html:2766 | No | Button text |
| `undo.title` | Undo last action | miniCycle.html:2766 (title) | No | Tooltip |
| `redo.button` | Redo | miniCycle.html:2767 | No | Button text |
| `redo.title` | Redo last undone action | miniCycle.html:2767 (title) | No | Tooltip |
| `undo.taskCompleted.one` | Task completed | undoRedoManager.js | Yes | Undo label |
| `undo.taskCompleted.other` | {count} tasks completed | undoRedoManager.js | Yes | Undo label |
| `undo.taskUncompleted.one` | Task uncompleted | undoRedoManager.js | Yes | Undo label |
| `undo.taskUncompleted.other` | {count} tasks uncompleted | undoRedoManager.js | Yes | Undo label |

---

## 17. Universal Buttons

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `button.save` | Save | Multiple | No | |
| `button.cancel` | Cancel | Multiple | No | |
| `button.close` | Close | Multiple | No | |
| `button.confirm` | Confirm | Multiple | No | |
| `button.delete` | Delete | Multiple | No | |
| `button.apply` | Apply | miniCycle.html:1786 | No | |
| `button.open` | Open | miniCycle.html:2501 | No | |
| `button.remove` | Remove | Multiple | No | |
| `button.reset` | Reset | Multiple | No | |

---

## 18. Navigation & Layout

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `nav.tasksView` | Tasks view | miniCycle.html:2771 (aria) | Yes | Tab ARIA |
| `nav.tasksTab` | Tasks | miniCycle.html:2772 | Yes | Tab label |
| `nav.statsView` | Statistics view | miniCycle.html:2774 (aria) | No | Tab ARIA |
| `nav.statsTab` | Stats | miniCycle.html:2775 | No | Tab label |
| `nav.showStats` | Show Stats | miniCycle.html:2583 (title) | No | Arrow tooltip |
| `nav.showTasks` | Show Tasks | miniCycle.html:2586 (title) | Yes | Arrow tooltip |
| `nav.quickActions` | Quick Actions | miniCycle.html:2650 | No | Panel title |
| `nav.quickActions.aria` | Quick actions | miniCycle.html:1168 (aria) | No | Button ARIA |
| `nav.previousView` | Previous view | miniCycle.html:2649 (title) | No | Arrow tooltip |
| `nav.nextView` | Next view | miniCycle.html:2651 (title) | No | Arrow tooltip |
| `nav.completed` | Completed | miniCycle.html:2633 | No | Collapsible header |
| `nav.saving` | Saving... | miniCycle.html:1197 | No | Save indicator |
| `nav.hideTaskInput` | Hide Task Input | modeManager.js | Yes | Toggle button text |
| `nav.addTaskToggle` | Add Task | modeManager.js | Yes | Toggle button text |

---

## 19. Quick Actions

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `quickAction.stats` | Stats | quickActionsManager.js | No | Action label |
| `quickAction.openRoutine` | Open Routine | quickActionsManager.js | Yes | Action label |
| `quickAction.recurring` | Recurring | quickActionsManager.js | No | Action label |
| `quickAction.reminders` | Reminders | quickActionsManager.js | No | Action label |
| `quickAction.settings` | Settings | quickActionsManager.js | No | Action label |
| `quickAction.recentlyUsed` | Recently Used | quickActionsManager.js | No | View title |
| `quickAction.frequentlyUsed` | Frequently Used | quickActionsManager.js | No | View title |

---

## 20. Theme Unlock Messages (Lens-Sensitive)

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `unlock.vocabTheme` | {count} more cycles to unlock {name}! | statsPanel.js | Yes | Vocabulary theme unlock progress |
| `unlock.game` | {count} more cleared task(s) to unlock Whack-a-Order Game! | statsPanel.js | Yes | Unlock progress |

> **Note:** `unlock.darkOcean` and `unlock.goldenGlow` were removed when the vocabulary theme system replaced those themes (Feb 2026).

---

## 21. About Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `about.title` | miniCycle | miniCycle.html:1229 | No | Brand name |
| `about.tagline` | Turn Your Routine Into Progress | miniCycle.html:1230 | No | Tagline |
| `about.description` | Your routine workflow companion — turn repeatable tasks into effortless cycles, stay focused, and build momentum. | miniCycle.html:1237 | Yes | Description |
| `about.aria` | About Task Cycle Mini | miniCycle.html:1212 (aria) | No | Button ARIA |
| `about.closeAria` | Close about modal | miniCycle.html:1225 (aria) | No | Close ARIA |

---

## 22. Personalization Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `prefs.title` | Personalization | miniCycle.html:2165 | No | Modal title |
| `prefs.themeNotice` | Custom colors only apply in the Default theme. | miniCycle.html:2169 | No | Notice |
| `prefs.openThemes` | Open Themes | miniCycle.html:2170 | No | Button |
| `prefs.livePreview` | Live Preview | miniCycle.html:2178 | No | Section label |
| `prefs.quickThemes` | Quick Themes | miniCycle.html:2204 | No | Section header |
| `prefs.savedPresets` | Saved Presets | miniCycle.html:2252 | No | Section header |
| `prefs.import` | Import | miniCycle.html:2255 | No | Button |
| `prefs.saveCurrent` | Save Current | miniCycle.html:2256 | No | Button |
| `prefs.appTaskList` | App & Task List | miniCycle.html:2270 | Yes | Section header |
| `prefs.appBackground` | App Background | miniCycle.html:2276 | No | Label |
| `prefs.backgroundPattern` | Background Pattern | miniCycle.html:2282 | No | Label |
| `prefs.patternColor` | Pattern Color | miniCycle.html:2290 | No | Label |
| `prefs.backgroundImage` | Background Image | miniCycle.html:2298 | No | Label |
| `prefs.upload` | Upload | miniCycle.html:2300 | No | Button |
| `prefs.removeImage` | Remove | miniCycle.html:2301 | No | Button |
| `prefs.showImage` | Show Image | miniCycle.html:2306 | No | Label |
| `prefs.displayMode` | Display Mode | miniCycle.html:2314 | No | Label |
| `prefs.stretchToFill` | Stretch to Fill | miniCycle.html:2316 | No | Option |
| `prefs.centered` | Centered | miniCycle.html:2317 | No | Option |
| `prefs.tiled` | Tiled | miniCycle.html:2318 | No | Option |
| `prefs.imageHint` | Images over 2MB are compressed automatically. | miniCycle.html:2325 | No | Hint |
| `prefs.listBackground` | List Background | miniCycle.html:2329 | No | Label |
| `prefs.titleBackground` | Title Background | miniCycle.html:2335 | No | Label |
| `prefs.titleText` | Title Text | miniCycle.html:2341 | No | Label |
| `prefs.tasksCheckboxes` | Tasks & Checkboxes | miniCycle.html:2352 | Yes | Section header |
| `prefs.taskBackground` | Task Background | miniCycle.html:2358 | Yes | Label |
| `prefs.taskText` | Task Text | miniCycle.html:2364 | Yes | Label |
| `prefs.checkboxFill` | Checkbox Fill | miniCycle.html:2370 | No | Label |
| `prefs.checkboxEmpty` | Checkbox Empty | miniCycle.html:2380 | No | Label |
| `prefs.checkmark` | Checkmark | miniCycle.html:2390 | No | Label |
| `prefs.buttonsProgress` | Buttons & Progress | miniCycle.html:2401 | No | Section header |
| `prefs.completeCycle` | Complete Cycle | miniCycle.html:2407 | Yes | Label |
| `prefs.clearCompleted` | Clear Completed | miniCycle.html:2413 | No | Label |
| `prefs.progressBar` | Progress Bar | miniCycle.html:2419 | No | Label |
| `prefs.statsPanel` | Stats Panel | miniCycle.html:2430 | No | Section header |
| `prefs.background` | Background | miniCycle.html:2436 | No | Label |
| `prefs.textColor` | Text Color | miniCycle.html:2442 | No | Label |
| `prefs.undo` | Undo | miniCycle.html:2454 | No | Button |
| `prefs.undoTitle` | Undo last color change | miniCycle.html:2453 (title) | No | Tooltip |
| `prefs.resetAll` | Reset All | miniCycle.html:2456 | No | Button |
| `prefs.resetDefault` | Reset to default | miniCycle.html:2278 (title) | No | Button tooltip |

---

## 23. Quick Theme Presets

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `preset.default` | Default | miniCycle.html:2210 | No | Preset name |
| `preset.default.desc` | Default blue theme | miniCycle.html:2208 (title) | No | Tooltip |
| `preset.warm` | Warm | miniCycle.html:2214 | No | Preset name |
| `preset.warm.desc` | Warm sunset colors | miniCycle.html:2212 (title) | No | Tooltip |
| `preset.cool` | Cool | miniCycle.html:2218 | No | Preset name |
| `preset.cool.desc` | Cool ocean colors | miniCycle.html:2216 (title) | No | Tooltip |
| `preset.forest` | Forest | miniCycle.html:2222 | No | Preset name |
| `preset.forest.desc` | Natural forest colors | miniCycle.html:2220 (title) | No | Tooltip |
| `preset.mono` | Mono | miniCycle.html:2226 | No | Preset name |
| `preset.mono.desc` | Elegant grayscale | miniCycle.html:2224 (title) | No | Tooltip |
| `preset.pro` | Pro | miniCycle.html:2230 | No | Preset name |
| `preset.pro.desc` | Clean minimal look | miniCycle.html:2228 (title) | No | Tooltip |
| `preset.golden` | Golden | miniCycle.html:2234 | No | Preset name |
| `preset.golden.desc` | Golden glow theme | miniCycle.html:2232 (title) | No | Tooltip |
| `preset.ocean` | Ocean | miniCycle.html:2238 | No | Preset name |
| `preset.ocean.desc` | Dark ocean theme | miniCycle.html:2236 (title) | No | Tooltip |
| `preset.berry` | Berry | miniCycle.html:2242 | No | Preset name |
| `preset.berry.desc` | Berry purple theme | miniCycle.html:2240 (title) | No | Tooltip |

---

## 24. Reminders Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `reminders.title` | Reminders & Notifications | miniCycle.html:1810 | No | Modal title |
| `reminders.enable` | Enable Reminders | miniCycle.html:1815 | No | Toggle label |
| `reminders.enableDueDate` | Enable Due Date Notifications | miniCycle.html:1820 | No | Toggle label |
| `reminders.indefinitely` | Remind Indefinitely? | miniCycle.html:1829 | No | Toggle label |
| `reminders.count` | Number of Times: | miniCycle.html:1832 | No | Input label |
| `reminders.every` | Every: | miniCycle.html:1836 | No | Input label |
| `reminders.minutes` | Minutes | miniCycle.html:1839 | No | Unit option |
| `reminders.hours` | Hours | miniCycle.html:1840 | No | Unit option |
| `reminders.days` | Days | miniCycle.html:1841 | No | Unit option |

---

## 25. Games Panel

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `games.title` | Games | miniCycle.html:1798 | No | Panel title |
| `games.description` | Try to complete tasks in the correct order as fast as you can! | miniCycle.html:1799 | Yes | Panel description |
| `games.play` | Play Task Order | miniCycle.html:1800 | Yes | Button |

---

## 26. Feedback Modal

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `feedback.title` | Provide Feedback | miniCycle.html:2530 | No | Modal title |
| `feedback.description` | We appreciate your feedback! Let us know how we can improve miniCycle. | miniCycle.html:2531 | No | Description |
| `feedback.placeholder` | Write your feedback here... | miniCycle.html:2545 | No | Textarea placeholder |
| `feedback.email` | Your Email (optional) | miniCycle.html:2548 | No | Input placeholder |
| `feedback.submit` | Submit | miniCycle.html:2551 | No | Button |
| `feedback.thanks` | Thank you for your feedback! | miniCycle.html:2556 | No | Success message |

---

## 27. Themes Panel

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `themes.title` | Theme Settings | miniCycle.html:2139 | No | Panel title |
| `themes.darkMode` | Dark Mode | miniCycle.html:2154 | No | Toggle label |
| `themes.locked` | (lock emoji) | modals.css:733 | No | CSS content |

---

## 28. History Panel

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `history.title` | History | historyManager.js:221 (aria) | No | Panel ARIA |
| `history.clearedTasks` | Cleared Tasks | clearedTasksManager.js:314 (aria) | Yes | Tab ARIA |
| `history.achievements` | Achievements | achievementsManager.js:225 (aria) | No | Panel ARIA |

---

## 29. Boot & System Messages

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `boot.connecting` | Connecting... | orchestrator.js:611 | No | Loader |
| `boot.loadingModules` | Loading modules... | orchestrator.js:615 | No | Loader |
| `boot.checkingUpdates` | Checking for updates... | orchestrator.js:350 | No | Loader |
| `boot.loadingCore` | Loading core... | orchestrator.js:355 | No | Loader |
| `boot.startingSystems` | Starting systems... | orchestrator.js:413 | No | Loader |
| `boot.loadingFeatures` | Loading features... | orchestrator.js:442 | No | Loader |
| `boot.startingUp` | Starting up... | orchestrator.js:456 | No | Loader |
| `boot.ready` | Ready! | orchestrator.js:472 | No | Loader |
| `boot.unableToLoad` | Unable to Load | orchestrator.js:282 | No | Error title |
| `boot.havingTrouble` | Having trouble loading... | orchestrator.js:272 | No | Error message |
| `boot.retrying` | Retrying automatically... | orchestrator.js:274 | No | Error status |
| `boot.clearCache` | Clear Cache & Reload | orchestrator.js:295 | No | Error button |
| `boot.tryAgain` | Try Again | orchestrator.js:299 | No | Error button |
| `boot.useLite` | Use Lite Version | orchestrator.js:303 | No | Error button |
| `boot.failedAt` | Failed at: {phase} (attempt {number}) | orchestrator.js:307 | No | Error detail |
| `boot.appUpdated` | App updated! Cache refreshed automatically. | featureBoot.js:100 | No | Notification |
| `boot.dataRestored` | Data restored after interrupted test run | featureBoot.js:107 | No | Notification |
| `boot.updateAvailable` | Update Available! | coreBoot.js:904 | No | Banner title |
| `boot.oldCachedVersion` | Your browser has an old cached version. | coreBoot.js:905 | No | Banner message |
| `boot.dismiss` | Dismiss | coreBoot.js:913 | No | Banner button |
| `boot.refreshIOS` | Scroll down and release to refresh, or close and reopen the app. | coreBoot.js:886 | No | Platform instruction |
| `boot.refreshAndroid` | Pull down to refresh, or clear browser data in Settings. | coreBoot.js:889 | No | Platform instruction |
| `boot.refreshMac` | Press Cmd+Shift+R to hard refresh. | coreBoot.js:892 | No | Platform instruction |
| `boot.refreshOther` | Press Ctrl+Shift+R to hard refresh. | coreBoot.js:893 | No | Platform instruction |
| `boot.previewSelect` | Select a miniCycle to preview | uiBoot.js:305 | Yes | Preview placeholder |

---

## 30. Page Metadata

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `meta.title` | miniCycle - Turn Your Routine Into Progress | miniCycle.html:31 | No | Page title |
| `meta.description` | miniCycle is a routine workflow companion that turns repeatable tasks into effortless cycles... | miniCycle.html:32 | No | Meta description |

---

## 31. Footer

| Key | Current Value | Source(s) | Lens-Sensitive | Notes |
|-----|--------------|-----------|----------------|-------|
| `footer.privacyPolicy` | Privacy Policy | miniCycle.html:2784 | No | Link text |
| `footer.termsOfService` | Terms of Service | miniCycle.html:2785 | No | Link text |
| `footer.feedback` | Feedback | miniCycle.html:2786 | No | Link text |
| `footer.productName` | miniCycle | miniCycle.html:2782 | No | Link text |

---

## Summary

| Category | Total Keys | Lens-Sensitive |
|----------|-----------|----------------|
| Core Nouns | 7 | 7 |
| Mode Labels | 12 | 9 |
| Task Actions | 20 | 16 |
| Task Option Buttons | 12 | 10 |
| Task Option Customizer | 12 | 6 |
| Routine Actions | 14 | 9 |
| Routine Switcher | 23 | 7 |
| Stats & Progress | 14 | 11 |
| Notifications | 40 | 23 |
| Confirmation Modals | 12 | 5 |
| Empty States | 9 | 6 |
| Recurring Panel | 19 | 3 |
| Frequency Labels | 6 | 0 |
| Menu Sections | 18 | 5 |
| Settings | 25 | 4 |
| Undo/Redo | 8 | 4 |
| Universal Buttons | 9 | 0 |
| Navigation & Layout | 14 | 3 |
| Quick Actions | 8 | 1 |
| Theme Unlocks | 3 | 3 |
| About Modal | 5 | 1 |
| Personalization | 37 | 5 |
| Quick Theme Presets | 18 | 0 |
| Reminders | 9 | 0 |
| Games | 3 | 2 |
| Feedback | 6 | 0 |
| Themes | 3 | 0 |
| History | 3 | 1 |
| Boot & System | 22 | 1 |
| Page Metadata | 2 | 0 |
| Footer | 4 | 0 |
| Onboarding | 4 | 2 |
| **TOTAL** | **~566** | **~142** |

---

**~566 total label keys identified across 32 categories. ~142 are lens-sensitive (would change with contextual themes).**

> **Note:** This reference was originally created during the Phase 1 audit. The key counts per category above reflect the original audit. The actual `defaultLabels.js` file has grown to 566 keys as the `notify` category expanded significantly during Tier 2-6 migrations. See `defaultLabels.js` for the authoritative count.
