# Step-by-Step Removal Guide

**Backup created:** ✅ `miniCycle-scripts.js.backup-before-recurring-removal`

---

## Safest Removal Method: Search & Delete

### Step 1: Open miniCycle-scripts.js in Your Editor

### Step 2: Remove Functions One by One

For each function below, use your editor's search (Cmd/Ctrl+F) to find it, then delete the ENTIRE function including its closing brace.

---

## Functions to Remove (in order of appearance)

### 1. Line 1449 - initializeDefaultRecurringSettings
**Search for:** `function initializeDefaultRecurringSettings()`
**Delete:** Entire function (until closing `}`)

### 2. Line 2523 - updateRecurringTemplates
**Search for:** `function updateRecurringTemplates(currentCycle, taskData)`
**Delete:** Entire function

### 3. Line 5614 - createRecurringNotificationWithTip
**Search for:** `function createRecurringNotificationWithTip(assignedTaskId, frequency, pattern)`
**Delete:** Entire function

### 4. Line 5625 - initializeRecurringNotificationListeners
**Search for:** `function initializeRecurringNotificationListeners(notification)`
**Delete:** Entire function

### 5. Line 5640 - applyRecurringToTaskSchema25
**Search for:** `function applyRecurringToTaskSchema25(taskId, newSettings, cycles, activeCycle)`
**Delete:** Entire function (large, ~80 lines)

### 6. Line 5872 - setupRecurringPanel (nested function)
**Search for:** `function setupRecurringPanel() {`
**Delete:** Entire function (large, ~500+ lines)
**⚠️ This is inside another function - be careful with braces**

### 7. Line 6053 - updateRecurringPanel
**Search for:** `function updateRecurringPanel(currentCycleData = null)`
**Delete:** Entire function

### 8. Line 6238 - openRecurringSettingsPanelForTask
**Search for:** `function openRecurringSettingsPanelForTask(taskIdToPreselect)`
**Delete:** Entire function

### 9. Line 6282 - updateRecurringSettingsVisibility
**Search for:** `function updateRecurringSettingsVisibility()`
**Delete:** Entire function

### 10. Line 6337 - loadRecurringSettingsForTask
**Search for:** `function loadRecurringSettingsForTask(task)`
**Delete:** Entire function

### 11. Line 6425 - deleteRecurringTemplate
**Search for:** `function deleteRecurringTemplate(taskId, cycleName)`
**Delete:** Entire function

### 12. Line 6461 - saveAlwaysShowRecurringSetting
**Search for:** `function saveAlwaysShowRecurringSetting()`
**Delete:** Entire function

### 13. Line 6484 - loadAlwaysShowRecurringSetting
**Search for:** `function loadAlwaysShowRecurringSetting()`
**Delete:** Entire function

### 14. Line 6662 - normalizeRecurringSettings
**Search for:** `function normalizeRecurringSettings(settings = {})`
**Delete:** Entire function

### 15. Line 6700 - buildRecurringSettingsFromPanel
**Search for:** `function buildRecurringSettingsFromPanel()`
**Delete:** Entire function

### 16. Line 6801 - clearNonRelevantRecurringFields
**Search for:** `function clearNonRelevantRecurringFields(task, frequency)`
**Delete:** Entire function

### 17. Line 6825 - syncRecurringStateToDOM
**Search for:** `function syncRecurringStateToDOM(taskEl, recurringSettings)`
**Delete:** Entire function

### 18. Line 7371 - updateRecurringButtonVisibility
**Search for:** `function updateRecurringButtonVisibility()`
**Delete:** Entire function

### 19. Line 7444 - isAlwaysShowRecurringEnabled
**Search for:** `function isAlwaysShowRecurringEnabled()`
**Delete:** Entire function

### 20. Line 7462 - updateRecurringPanelButtonVisibility
**Search for:** `function updateRecurringPanelButtonVisibility()`
**Delete:** Entire function

### 21. Line 7484 - updateRecurringSummary
**Search for:** `function updateRecurringSummary()`
**Delete:** Entire function

### 22. Line 7516 - parseDateAsLocal
**Search for:** `function parseDateAsLocal(dateStr)`
**Delete:** Entire function

### 23. Line 7531 - attachRecurringSummaryListeners
**Search for:** `function attachRecurringSummaryListeners()`
**Delete:** Entire function

### 24. Line 7546 - showTaskSummaryPreview
**Search for:** `function showTaskSummaryPreview(task)`
**Delete:** Entire function

### 25. Line 7626 - populateRecurringFormWithSettings
**Search for:** `function populateRecurringFormWithSettings(settings)`
**Delete:** Entire function

### 26. Line 7706 - clearRecurringForm
**Search for:** `function clearRecurringForm()`
**Delete:** Entire function

### 27. Line 7761 - getRecurringSummaryText
**Search for:** `function getRecurringSummaryText(template)`
**Delete:** Entire function

### 28. Line 7769 - buildRecurringSummaryFromSettings
**Search for:** `function buildRecurringSummaryFromSettings(settings = {})`
**Delete:** Entire function (large, ~100 lines)

### 29. Line 7880 - removeRecurringTasksFromCycle
**Search for:** `function removeRecurringTasksFromCycle(taskElements, cycleData)`
**Delete:** Entire function

### 30. Line 7903 - handleRecurringTasksAfterReset
**Search for:** `function handleRecurringTasksAfterReset()`
**Delete:** Entire function

### 31. Line 7946 - convert12To24
**Search for:** `function convert12To24(hour, meridiem)`
**Delete:** Entire function

### 32. Line 7955 - shouldTaskRecurNow
**Search for:** `function shouldTaskRecurNow(settings, now = new Date())`
**Delete:** Entire function (large, ~100 lines)

### 33. Line 8062 - shouldRecreateRecurringTask
**Search for:** `function shouldRecreateRecurringTask(template, taskList, now)`
**Delete:** Entire function

### 34. Line 8092 - watchRecurringTasks
**Search for:** `function watchRecurringTasks()`
**Delete:** Entire function (large, ~90 lines)

### 35. Line 8183 - setupRecurringWatcher
**Search for:** `function setupRecurringWatcher()`
**Delete:** Entire function (large, ~80 lines)

### 36. Line 10201 - createRecurringTemplate
**Search for:** `function createRecurringTemplate(taskContext, taskData)`
**Delete:** Entire function

### 37. Line 10427 - setupRecurringButtonHandler
**Search for:** `function setupRecurringButtonHandler(button, taskContext)`
**Delete:** Entire function

### 38. Line 10472 - handleRecurringTaskActivation
**Search for:** `function handleRecurringTaskActivation(task, taskContext, button)`
**Delete:** Entire function (large, ~70 lines)

### 39. Line 10541 - handleRecurringTaskDeactivation
**Search for:** `function handleRecurringTaskDeactivation(task, taskContext, assignedTaskId)`
**Delete:** Entire function

---

## Also Remove These Global Assignments

Search for and delete these lines (they're now set by the integration module):

```javascript
window.applyRecurringToTaskSchema25 = applyRecurringToTaskSchema25;
window.handleRecurringTaskActivation = ...;
window.handleRecurringTaskDeactivation = ...;
// ... etc
```

These are typically found near the end of the file or after function definitions.

---

## After Removal - Test Checklist

1. **Save file**
2. **Reload browser** (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
3. **Open console**
4. **Run:** `window.testRecurringIntegration()`
5. **Verify all tests pass** ✅

### Features to Test:
- ✅ Create recurring task
- ✅ Quick Actions notification appears
- ✅ Open "Manage Recurring Tasks" panel
- ✅ Modify recurring settings
- ✅ Watch function recreates tasks
- ✅ Cycle reset works

---

## If Something Breaks

### Rollback Command:
```bash
cp miniCycle-scripts.js.backup-before-recurring-removal miniCycle-scripts.js
```

Then reload browser.

---

## Alternative: Comment Out First

Instead of deleting, you can comment out functions first:

```javascript
/*
function oldRecurringFunction() {
    // ... old code ...
}
*/
```

This makes it easier to restore if needed.

---

**Estimated time:** 15-30 minutes
**Risk level:** Low (backup exists, modules working)
**Benefit:** Cleaner codebase, ~2,500 lines removed
