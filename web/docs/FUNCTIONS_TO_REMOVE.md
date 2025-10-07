# Old Recurring Functions to Remove

**Backup created:** `miniCycle-scripts.js.backup-before-recurring-removal`

---

## Functions to Remove (43 total)

### Core Recurring Functions (33 functions)

1. Line 1449: `function initializeDefaultRecurringSettings()`
2. Line 2523: `function updateRecurringTemplates(currentCycle, taskData)`
3. Line 5614: `function createRecurringNotificationWithTip(assignedTaskId, frequency, pattern)`
4. Line 5625: `function initializeRecurringNotificationListeners(notification)`
5. Line 5640: `function applyRecurringToTaskSchema25(taskId, newSettings, cycles, activeCycle)`
6. Line 6053: `function updateRecurringPanel(currentCycleData = null)`
7. Line 6425: `function deleteRecurringTemplate(taskId, cycleName)`
8. Line 6461: `function saveAlwaysShowRecurringSetting()`
9. Line 6484: `function loadAlwaysShowRecurringSetting()`
10. Line 6801: `function clearNonRelevantRecurringFields(task, frequency)`
11. Line 6825: `function syncRecurringStateToDOM(taskEl, recurringSettings)`
12. Line 7371: `function updateRecurringButtonVisibility()`
13. Line 7444: `function isAlwaysShowRecurringEnabled()`
14. Line 7462: `function updateRecurringPanelButtonVisibility()`
15. Line 7484: `function updateRecurringSummary()`
16. Line 7531: `function attachRecurringSummaryListeners()`
17. Line 7626: `function populateRecurringFormWithSettings(settings)`
18. Line 7706: `function clearRecurringForm()`
19. Line 7761: `function getRecurringSummaryText(template)`
20. Line 7769: `function buildRecurringSummaryFromSettings(settings = {})`
21. Line 7880: `function removeRecurringTasksFromCycle(taskElements, cycleData)`
22. Line 7903: `function handleRecurringTasksAfterReset()`
23. Line 8062: `function shouldRecreateRecurringTask(template, taskList, now)`
24. Line 8092: `function watchRecurringTasks()`
25. Line 8183: `function setupRecurringWatcher()`
26. Line 10073: `function addTask(...)` - **KEEP** (not recurring-specific, just has recurring param)
27. Line 10201: `function createRecurringTemplate(taskContext, taskData)`
28. Line 10270: `function createMainTaskElement(...)` - **KEEP** (not recurring-specific)
29. Line 10400: `function setupButtonAriaStates(...)` - **KEEP** (handles multiple buttons)
30. Line 10427: `function setupRecurringButtonHandler(button, taskContext)`
31. Line 10472: `function handleRecurringTaskActivation(task, taskContext, button)`
32. Line 10541: `function handleRecurringTaskDeactivation(task, taskContext, assignedTaskId)`
33. Line 10646: `function createTaskLabel(...)` - **KEEP** (not recurring-specific)

### Helper Functions (10 functions)

34. Line 5872: `function setupRecurringPanel()` (inside setupRecurringPanel context)
35. Line 6238: `function openRecurringSettingsPanelForTask(taskIdToPreselect)`
36. Line 6282: `function updateRecurringSettingsVisibility()`
37. Line 6337: `function loadRecurringSettingsForTask(task)`
38. Line 6662: `function normalizeRecurringSettings(settings = {})`
39. Line 6700: `function buildRecurringSettingsFromPanel()`
40. Line 7516: `function parseDateAsLocal(dateStr)`
41. Line 7546: `function showTaskSummaryPreview(task)`
42. Line 7946: `function convert12To24(hour, meridiem)`
43. Line 7955: `function shouldTaskRecurNow(settings, now = new Date())`

---

## Functions to KEEP (Not Remove)

These are NOT recurring-specific, they just have recurring parameters:

- `function addTask(...)` - General task creation
- `function createMainTaskElement(...)` - General task element creation
- `function setupButtonAriaStates(...)` - Handles all button types (recurring, priority, reminders)
- `function createTaskLabel(...)` - General label creation

---

## Removal Strategy

1. **Search for each function by name**
2. **Find the entire function body** (from `function` to closing `}`)
3. **Comment out or delete** the entire function
4. **Save file**
5. **Test in browser**

---

## After Removal - What to Check

### Global Functions (Should still work via modules)
- `window.applyRecurringToTaskSchema25` ✅ (from module)
- `window.handleRecurringTaskActivation` ✅ (from module)
- `window.watchRecurringTasks` ✅ (from module)
- `window.updateRecurringPanel` ✅ (from module)

### Features to Test
- Create recurring task
- Open "Manage Recurring Tasks" panel
- Watch function (30-second checks)
- Cycle reset with recurring tasks
- Task recreation on schedule

---

## Rollback Plan

If anything breaks:

```bash
# Restore backup
cp miniCycle-scripts.js.backup-before-recurring-removal miniCycle-scripts.js

# Reload browser
# Clear cache if needed
```

---

**Total Functions to Remove:** 39 functions
**Approximate Lines to Remove:** ~2,500-3,000 lines
**Backup Location:** `miniCycle-scripts.js.backup-before-recurring-removal`
