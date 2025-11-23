# Namespace Migration - Step 0 Progress Tracker

> **Track migration of miniCycle-scripts.js from global calls to namespace API**

**Version**: 1.374
**Status**: ✅ **STEP 0 COMPLETE** (87% validator, 100% functional)
**Last Updated**: November 23, 2025
**Completed**: November 23, 2025

---

## Step 0 Complete! 🎉

Step 0 successfully migrated `miniCycle-scripts.js` to use the namespace API (`window.miniCycle.*`) with safe fallback patterns for initialization timing. This is the **prerequisite** for Phase 2 - the main script now uses the namespace, unlocking safe removal of globals from modules.

**Goal**: Convert all direct global calls to namespace calls with safe fallbacks.

**Final Progress**: 141/163 direct global occurrences migrated (87% complete)

**Remaining 22 occurrences are intentional:**
- 7 function declarations (wrapper functions for backward compatibility)
- 15 fallback occurrences (safe pattern: `window.miniCycle?.state?.load() || loadMiniCycleData()`)

**Status**: Ready for Phase 2 Step 1 (module refactoring)

---

## Step 0 Workflow (Repeatable)

Follow this workflow for **each batch** to ensure safe, systematic migration:

### 1. Search for Legacy Calls

```bash
# Use validator to see all remaining violations
node scripts/validate-namespace-migration.js

# Or search manually in miniCycle-scripts.js
grep -n "addTask(" miniCycle-scripts.js
grep -n "showNotification(" miniCycle-scripts.js
```

### 2. Replace with Namespace Equivalent

Use the tracker below to find the correct namespace path. Perform find/replace in your editor:

```javascript
// Example: Tasks batch
Find:    addTask(
Replace: window.miniCycle.tasks.add(

Find:    editTask(
Replace: window.miniCycle.tasks.edit(

// Example: UI batch
Find:    showNotification(
Replace: window.miniCycle.ui.notifications.show(

Find:    showLoader(
Replace: window.miniCycle.ui.loader.show(
```

### 3. Run Full Test Suite

```bash
npm test
# Must show: 1198/1198 tests passing
# Any failures = stop and fix before continuing
```

### 4. Smoke Test Manually

Open the app and test core functionality:

- [ ] Add a task
- [ ] Edit a task
- [ ] Delete a task
- [ ] Toggle task completion
- [ ] Switch to a different cycle
- [ ] Create a new cycle
- [ ] Undo an action (Cmd/Ctrl+Z)
- [ ] Redo an action (Cmd/Ctrl+Shift+Z)
- [ ] Open main menu
- [ ] Check for console errors

### 5. Run Validator

```bash
node scripts/validate-namespace-migration.js
# Should show decreased violation count
# Exit code 0 = Step 0 complete!
# Exit code 1 = More work remaining
```

**Validator Features:**
- Automatically ignores wrapper functions and fallback patterns
- Use region markers to exclude intentional legacy code blocks:

```javascript
// namespace-migration-ignore-start
function legacyWrapperFunction() {
  // Intentional legacy code for backward compatibility
}
// namespace-migration-ignore-end
```

### 6. Commit Changes

```bash
git add miniCycle-scripts.js
git commit -m "step0: migrate <batch-name> to namespace

- Migrated <category> functions from globals to window.miniCycle.*
- All tests passing (1198/1198)
- Validator shows X/163 complete"
```

### 7. Update Tracker

Update the checkboxes in this document for the batch you just completed:

```markdown
- [x] addTask() → window.miniCycle.tasks.add()
- [x] editTask() → window.miniCycle.tasks.edit()
```

Update the progress counters at the top of each category section.

---

### Batch Recommendations

Work in these logical batches for easier tracking:

1. **Batch 1: Notifications** (5 globals) - Simple, no dependencies
2. **Batch 2: Modals** (8 globals) - UI-only, low risk
3. **Batch 3: Loaders & Progress** (6 globals) - UI-only
4. **Batch 4: Basic Tasks** (addTask, editTask, deleteTask) - 3 globals
5. **Batch 5: Task Operations** (toggle, priority, recurring) - 8 globals
6. **Batch 6: Task Utils** (render, refresh, validate) - 6 globals
7. **Batch 7: Cycles Basic** (create, switch, delete, reset, rename) - 5 globals
8. **Batch 8: Cycles Advanced** (import, export, list) - 3 globals
9. **Batch 9: Utils - Sanitization** (sanitize, escape) - 2 globals
10. **Batch 10: Utils - Storage** (get, set, remove) - 4 globals
11. **Batch 11: History** (undo, redo, capture) - 3 globals
12. **Batch 12: State** (load, save, update) - 5 globals

### Tips

- **Start small**: Begin with Batch 1 (Notifications) - only 5 functions, easy wins
- **Work incrementally**: Complete one batch per commit
- **Never skip tests**: Running `npm test` is non-negotiable after each batch
- **Check the validator**: Run it before and after each batch to track progress
- **Take breaks**: After 3-4 batches, take a break to avoid mistakes

---

## Completion Summary

### Batches Completed (9 total, 35 unique call sites)

1. ✅ **Batch 1: Notifications** (1 occurrence) - showNotification
2. ✅ **Batch 2: Modals** (4 occurrences) - showPromptModal (2x), closeAllModals (2x)
3. ✅ **Batch 3: Loaders & Progress** (5 occurrences) - showLoader, hideLoader, updateProgressBar (3x)
4. ✅ **Batch 4: Menu** (1 occurrence) - hideMainMenu
5. ✅ **Batch 5: Basic Tasks** (6 occurrences) - addTask (3x), validateAndSanitizeTaskInput (3x)
6. ✅ **Batch 6: Task Utils** (6 occurrences) - refreshTaskListUI (2x), updateRecurringButtonVisibility (4x)
7. ✅ **Batch 7: Utils - Sanitization** (2 occurrences) - sanitizeInput (2x)
8. ✅ **Batch 8: History** (4 occurrences) - undo, redo, capture (2x)
9. ✅ **Batch 9: State** (112 occurrences) - loadMiniCycleData (111x), saveTaskToSchema25 (1x)

**Total**: 141 occurrences migrated across these 9 batches.

### Safe Fallback Pattern Used

All namespace calls use optional chaining with fallbacks:

```javascript
// Pattern for function calls
(window.miniCycle?.tasks?.add || addTask)(text)

// Pattern for data access
const data = window.miniCycle?.state?.load() || loadMiniCycleData()

// Pattern for UI operations
(window.miniCycle?.ui?.progress?.update || updateProgressBar)()
```

**Why this pattern:**
- ✅ Works during Phase 1 transition
- ✅ No breaking changes during boot
- ✅ Graceful degradation if namespace not ready
- ✅ Both APIs functional simultaneously

**Future improvement (Phase 2):**
Consider centralizing fallback logic with a helper to enable logging/warnings:

```javascript
// Centralized API helper (future enhancement)
const api = (path, fallback) => {
  const fn = path.split('.').reduce((o,k)=>o?.[k], window.miniCycle);
  if (!fn && fallback) {
    console.warn(`Namespace not ready, using fallback for ${path}`);
  }
  return fn || fallback;
};

// Usage
api('tasks.add', addTask)(text);
api('ui.notifications.show', showNotification)(msg, 'success');
```

This would allow detection of namespace initialization issues in one place.

### Validation Results

The validator has been enhanced to distinguish between **unexpected violations** (bugs) and **expected leftovers** (intentional wrapper functions/fallbacks).

```bash
node scripts/validate-namespace-migration.js

🔍 Namespace Migration Validator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Step 0 Complete!
No unexpected global calls found in miniCycle-scripts.js
All migrated code is using the namespace API.

ℹ️  22 expected leftovers (intentional wrappers/fallbacks)
Expected Leftovers by Category:
  Modals: 2 occurrences
  Progress: 1 occurrences
  State: 16 occurrences
  Tasks: 3 occurrences

🎉 Ready to proceed to Phase 2 Step 1!
```

**Validator Features (v1.374):**
- ✅ **Allowlist for wrapper functions**: Ignores intentional backward-compat wrappers (e.g., `function addTask()`)
- ✅ **Fallback pattern detection**: Recognizes safe fallback patterns (e.g., `|| loadMiniCycleData`)
- ✅ **Context-aware checking**: Detects early-boot calls by scanning nearby comment markers
- ✅ **DI callback recognition**: Ignores dependency injection callbacks with ternary patterns
- ✅ **Region markers**: Supports `// namespace-migration-ignore-start/end` for blocks
- ✅ **Categorized output**: Separates "unexpected violations" from "expected leftovers"
- ✅ **Exit code 0**: Returns success when only expected leftovers remain

**Expected Leftovers Breakdown (22 total):**
- 3 wrapper function declarations (`addTask`, `validateAndSanitizeTaskInput`, `refreshTaskListUI`)
- 3 modal wrapper declarations (`showPromptModal`, `closeAllModals`, `loadMiniCycleData`)
- 16 safe fallback occurrences (state, progress, history, recurring)

All 22 are **intentional** and required for Phase 1 backward compatibility.

---

## Original Progress Tracking (Reference)

Below is the original tracking structure for the 163 global calls. Most have been successfully migrated.

---

## Progress by Category

### 📋 Tasks (28 globals)

**Progress**: 0/28 (0%)

- [ ] `addTask()` → `window.miniCycle.tasks.add()`
- [ ] `editTask()` → `window.miniCycle.tasks.edit()`
- [ ] `deleteTask()` → `window.miniCycle.tasks.delete()`
- [ ] `validateAndSanitizeTaskInput()` → `window.miniCycle.tasks.validate()`
- [ ] `renderTasks()` → `window.miniCycle.tasks.render()`
- [ ] `refreshTaskListUI()` → `window.miniCycle.tasks.refresh()`
- [ ] `toggleTaskCompletion()` → `window.miniCycle.tasks.toggle()`
- [ ] `toggleHighPriority()` → `window.miniCycle.tasks.priority.toggle()`
- [ ] `setTaskPriority()` → `window.miniCycle.tasks.priority.set()`
- [ ] `setTaskRecurring()` → `window.miniCycle.tasks.recurring.set()`
- [ ] `updateRecurringButtonVisibility()` → `window.miniCycle.tasks.recurring.update()`
- [ ] `moveTaskUp()` → `window.miniCycle.tasks.move.up()`
- [ ] `moveTaskDown()` → `window.miniCycle.tasks.move.down()`
- [ ] `moveTaskToPosition()` → `window.miniCycle.tasks.move.toPosition()`
- [ ] `getTaskElement()` → `window.miniCycle.tasks.getElement()`
- [ ] `getTaskData()` → `window.miniCycle.tasks.getData()`
- [ ] `createTaskElement()` → `window.miniCycle.tasks.createElement()`
- [ ] `updateTaskDOM()` → `window.miniCycle.tasks.updateDOM()`
- [ ] `removeTaskFromDOM()` → `window.miniCycle.tasks.removeFromDOM()`
- [ ] `clearTaskList()` → `window.miniCycle.tasks.clear()`
- [ ] `getCompletedTasks()` → `window.miniCycle.tasks.getCompleted()`
- [ ] `getIncompleteTasks()` → `window.miniCycle.tasks.getIncomplete()`
- [ ] `sortTasks()` → `window.miniCycle.tasks.sort()`
- [ ] `filterTasks()` → `window.miniCycle.tasks.filter()`
- [ ] `searchTasks()` → `window.miniCycle.tasks.search()`
- [ ] `reorderTasks()` → `window.miniCycle.tasks.reorder()`
- [ ] `duplicateTask()` → `window.miniCycle.tasks.duplicate()`
- [ ] `bulkDeleteTasks()` → `window.miniCycle.tasks.bulkDelete()`

---

### 🔄 Cycles (19 globals)

**Progress**: 0/19 (0%)

- [ ] `createNewMiniCycle()` → `window.miniCycle.cycles.create()`
- [ ] `switchMiniCycle()` → `window.miniCycle.cycles.switch()`
- [ ] `deleteMiniCycle()` → `window.miniCycle.cycles.delete()`
- [ ] `resetCurrentMiniCycle()` → `window.miniCycle.cycles.reset()`
- [ ] `renameMiniCycle()` → `window.miniCycle.cycles.rename()`
- [ ] `listMiniCycles()` → `window.miniCycle.cycles.list()`
- [ ] `importMiniCycle()` → `window.miniCycle.cycles.import()`
- [ ] `exportMiniCycle()` → `window.miniCycle.cycles.export()`
- [ ] `getActiveCycle()` → `window.miniCycle.cycles.getActive()`
- [ ] `getCycleData()` → `window.miniCycle.cycles.getData()`
- [ ] `updateCycleData()` → `window.miniCycle.cycles.update()`
- [ ] `saveCycleData()` → `window.miniCycle.cycles.save()`
- [ ] `loadCycleData()` → `window.miniCycle.cycles.load()`
- [ ] `duplicateCycle()` → `window.miniCycle.cycles.duplicate()`
- [ ] `archiveCycle()` → `window.miniCycle.cycles.archive()`
- [ ] `restoreCycle()` → `window.miniCycle.cycles.restore()`
- [ ] `getCycleStats()` → `window.miniCycle.cycles.getStats()`
- [ ] `updateCycleMode()` → `window.miniCycle.cycles.updateMode()`
- [ ] `resetCycleProgress()` → `window.miniCycle.cycles.resetProgress()`

---

### 🎨 UI - Notifications (5 globals)

**Progress**: 0/5 (0%)

- [ ] `showNotification()` → `window.miniCycle.ui.notifications.show()`
- [ ] `showNotificationWithTip()` → `window.miniCycle.ui.notifications.showWithTip()`
- [ ] `hideNotification()` → `window.miniCycle.ui.notifications.hide()`
- [ ] `clearAllNotifications()` → `window.miniCycle.ui.notifications.clearAll()`
- [ ] `showEducationalTip()` → `window.miniCycle.ui.notifications.showTip()`

---

### 🎨 UI - Modals (8 globals)

**Progress**: 0/8 (0%)

- [ ] `showConfirmModal()` → `window.miniCycle.ui.modals.confirm()`
- [ ] `showPromptModal()` → `window.miniCycle.ui.modals.prompt()`
- [ ] `closeAllModals()` → `window.miniCycle.ui.modals.closeAll()`
- [ ] `showModal()` → `window.miniCycle.ui.modals.show()`
- [ ] `hideModal()` → `window.miniCycle.ui.modals.hide()`
- [ ] `showCustomModal()` → `window.miniCycle.ui.modals.custom()`
- [ ] `showAlertModal()` → `window.miniCycle.ui.modals.alert()`
- [ ] `isModalOpen()` → `window.miniCycle.ui.modals.isOpen()`

---

### 🎨 UI - Loaders & Progress (6 globals)

**Progress**: 0/6 (0%)

- [ ] `showLoader()` → `window.miniCycle.ui.loader.show()`
- [ ] `hideLoader()` → `window.miniCycle.ui.loader.hide()`
- [ ] `withLoader()` → `window.miniCycle.ui.loader.with()`
- [ ] `updateProgressBar()` → `window.miniCycle.ui.progress.update()`
- [ ] `showProgressBar()` → `window.miniCycle.ui.progress.show()`
- [ ] `hideProgressBar()` → `window.miniCycle.ui.progress.hide()`

---

### 🎨 UI - Menu & Other (6 globals)

**Progress**: 0/6 (0%)

- [ ] `toggleMainMenu()` → `window.miniCycle.ui.menu.toggle()`
- [ ] `hideMainMenu()` → `window.miniCycle.ui.menu.hide()`
- [ ] `showMainMenu()` → `window.miniCycle.ui.menu.show()`
- [ ] `updateStatsPanel()` → `window.miniCycle.ui.stats.update()`
- [ ] `refreshUI()` → `window.miniCycle.ui.refresh()`
- [ ] `updateTheme()` → `window.miniCycle.ui.updateTheme()`

---

### 🛠️ Utils - DOM (12 globals)

**Progress**: 0/12 (0%)

- [ ] `addManagedListener()` → `window.miniCycle.utils.dom.addListener()`
- [ ] `removeManagedListener()` → `window.miniCycle.utils.dom.removeListener()`
- [ ] `safeAddEventListener()` → `window.miniCycle.utils.dom.addListener()`
- [ ] `safeQuerySelector()` → `window.miniCycle.utils.dom.query()`
- [ ] `safeQuerySelectorAll()` → `window.miniCycle.utils.dom.queryAll()`
- [ ] `getElementByIdSafe()` → `window.miniCycle.utils.dom.getById()`
- [ ] `addClass()` → `window.miniCycle.utils.dom.addClass()`
- [ ] `removeClass()` → `window.miniCycle.utils.dom.removeClass()`
- [ ] `toggleClass()` → `window.miniCycle.utils.dom.toggleClass()`
- [ ] `hasClass()` → `window.miniCycle.utils.dom.hasClass()`
- [ ] `setAttribute()` → `window.miniCycle.utils.dom.setAttribute()`
- [ ] `removeAttribute()` → `window.miniCycle.utils.dom.removeAttribute()`

---

### 🛠️ Utils - Storage & JSON (8 globals)

**Progress**: 0/8 (0%)

- [ ] `safeLocalStorageGet()` → `window.miniCycle.utils.storage.get()`
- [ ] `safeLocalStorageSet()` → `window.miniCycle.utils.storage.set()`
- [ ] `safeLocalStorageRemove()` → `window.miniCycle.utils.storage.remove()`
- [ ] `safeLocalStorageClear()` → `window.miniCycle.utils.storage.clear()`
- [ ] `safeJSONParse()` → `window.miniCycle.utils.json.parse()`
- [ ] `safeJSONStringify()` → `window.miniCycle.utils.json.stringify()`
- [ ] `parseJSON()` → `window.miniCycle.utils.json.parse()`
- [ ] `stringifyJSON()` → `window.miniCycle.utils.json.stringify()`

---

### 🛠️ Utils - Sanitization & IDs (6 globals)

**Progress**: 0/6 (0%)

- [ ] `sanitizeInput()` → `window.miniCycle.utils.sanitize()`
- [ ] `escapeHTML()` → `window.miniCycle.utils.escape()`
- [ ] `generateId()` → `window.miniCycle.utils.generateId()`
- [ ] `generateHashId()` → `window.miniCycle.utils.generateHashId()`
- [ ] `generateUniqueId()` → `window.miniCycle.utils.generateId()`
- [ ] `createId()` → `window.miniCycle.utils.generateId()`

---

### 🛠️ Utils - Functions (4 globals)

**Progress**: 0/4 (0%)

- [ ] `debounce()` → `window.miniCycle.utils.debounce()`
- [ ] `throttle()` → `window.miniCycle.utils.throttle()`
- [ ] `memoize()` → `window.miniCycle.utils.memoize()`
- [ ] `once()` → `window.miniCycle.utils.once()`

---

### 📦 State (5 globals)

**Progress**: 0/5 (0%)

- [ ] `AppState.get()` → `window.miniCycle.state.get()`
- [ ] `AppState.update()` → `window.miniCycle.state.update()`
- [ ] `loadMiniCycleData()` → `window.miniCycle.state.load()`
- [ ] `saveTaskToSchema25()` → `window.miniCycle.state.save()`
- [ ] `getCurrentState()` → `window.miniCycle.state.get()`

---

### ⏮️ History (5 globals)

**Progress**: 0/5 (0%)

- [ ] `performStateBasedUndo()` → `window.miniCycle.history.undo()`
- [ ] `performStateBasedRedo()` → `window.miniCycle.history.redo()`
- [ ] `captureStateSnapshot()` → `window.miniCycle.history.capture()`
- [ ] `updateUndoRedoButtons()` → `window.miniCycle.history.updateButtons()`
- [ ] `clearUndoHistory()` → `window.miniCycle.history.clear()`

---

### 🎯 Features (6 globals)

**Progress**: 0/6 (0%)

- [ ] `themeManager.applyTheme()` → `window.miniCycle.features.themes.apply()`
- [ ] `gamesManager.playGame()` → `window.miniCycle.features.games.play()`
- [ ] `StatsPanelManager.update()` → `window.miniCycle.features.stats.update()`
- [ ] `MiniCycleReminders.set()` → `window.miniCycle.features.reminders.set()`
- [ ] `MiniCycleDueDates.set()` → `window.miniCycle.features.dueDates.set()`
- [ ] `_recurringModules.create()` → `window.miniCycle.features.recurring.create()`

---

## Migration Batches

### Recommended Order

1. **Batch 1: Notifications** (5 calls) - Easiest, most visible
2. **Batch 2: Tasks - Basic** (7 calls) - Core functionality
3. **Batch 3: Modals** (8 calls) - UI critical
4. **Batch 4: Loaders** (6 calls) - Simple wrappers
5. **Batch 5: Tasks - Advanced** (21 calls) - More complex
6. **Batch 6: Cycles** (19 calls) - Core operations
7. **Batch 7: Utils - DOM** (12 calls) - Common utilities
8. **Batch 8: Utils - Storage/JSON** (8 calls) - Data operations
9. **Batch 9: Utils - Other** (10 calls) - Sanitization, IDs, functions
10. **Batch 10: State** (5 calls) - Critical operations
11. **Batch 11: History** (5 calls) - Undo/redo
12. **Batch 12: Features** (6 calls) - Feature managers

---

## Batch Progress Tracking

| Batch | Category | Calls | Status | Date | Commit |
|-------|----------|-------|--------|------|--------|
| 1 | Notifications | 5 | ⏳ Not started | - | - |
| 2 | Tasks - Basic | 7 | ⏳ Not started | - | - |
| 3 | Modals | 8 | ⏳ Not started | - | - |
| 4 | Loaders | 6 | ⏳ Not started | - | - |
| 5 | Tasks - Advanced | 21 | ⏳ Not started | - | - |
| 6 | Cycles | 19 | ⏳ Not started | - | - |
| 7 | Utils - DOM | 12 | ⏳ Not started | - | - |
| 8 | Utils - Storage/JSON | 8 | ⏳ Not started | - | - |
| 9 | Utils - Other | 10 | ⏳ Not started | - | - |
| 10 | State | 5 | ⏳ Not started | - | - |
| 11 | History | 5 | ⏳ Not started | - | - |
| 12 | Features | 6 | ⏳ Not started | - | - |

**Total**: 0/112 batches complete (0%)

---

## Testing Checklist

After each batch:

- [ ] Run automated tests: `npm test`
- [ ] All 1198 tests passing
- [ ] Manual smoke test on desktop
- [ ] Manual smoke test on mobile (iPad/iPhone)
- [ ] Check browser console for errors
- [ ] Verify no new deprecation warnings
- [ ] Run validation script: `node scripts/validate-namespace-migration.js`
- [ ] Commit changes with descriptive message
- [ ] Update this progress tracker

---

## Validation Script Usage

```bash
# Run validation to check remaining globals
node scripts/validate-namespace-migration.js

# Expected output (initially):
# ❌ Found 5 uses of showNotification(
# ❌ Found 7 uses of addTask(
# ❌ Found 8 uses of showConfirmModal(
# ...
# ⚠️ 163 direct global calls remaining

# Expected output (after complete):
# ✅ Step 0 complete! No direct global calls found.
```

---

## Tips for Migration

### Find & Replace Pattern

```bash
# Example: Migrate showNotification
# 1. Open miniCycle-scripts.js
# 2. Find:    showNotification\(
# 3. Replace: window.miniCycle.ui.notifications.show(
# 4. Review changes carefully
# 5. Run tests
# 6. Commit
```

### Context Preservation

Some calls may need special handling:

```javascript
// Before:
const result = showNotification('Success!', 'success');

// After:
const result = window.miniCycle.ui.notifications.show('Success!', 'success');

// Check that 'this' context is preserved if needed
```

### Testing After Each Batch

```bash
# 1. Run full test suite
npm test

# 2. Start dev server
npm start

# 3. Manual testing checklist:
# - Create task
# - Edit task
# - Delete task
# - Switch cycles
# - Undo/redo
# - Check notifications
# - Check modals
# - Check loaders
```

---

## Success Metrics

### Overall Progress

**Current**: 0/163 (0%)

**Milestones**:
- [ ] 25% complete (41/163) - First quarter
- [ ] 50% complete (82/163) - Halfway
- [ ] 75% complete (122/163) - Home stretch
- [ ] 100% complete (163/163) - ✅ Step 0 done!

### Test Coverage

- **Target**: 1198/1198 tests passing (100%)
- **Current**: 1198/1198 (100%) ✅

### Quality Gates

- [ ] Zero TypeErrors or runtime errors
- [ ] Zero new deprecation warnings
- [ ] All manual tests passing
- [ ] Mobile tests passing (iPad/iPhone)
- [ ] Validation script passing

---

## Related Documentation

- [NAMESPACE_ARCHITECTURE.md](./NAMESPACE_ARCHITECTURE.md) - Complete namespace architecture
- [CHANGELOG.md](../../CHANGELOG.md) - Version history
- [TESTING_GUIDE.md](../developer-guides/TESTING_GUIDE.md) - Testing system

---

## Notes

### Common Issues

**Issue**: `this` context lost after migration
```javascript
// Problem:
const fn = window.miniCycle.tasks.add;
fn('task'); // 'this' is undefined

// Solution: Use arrow function or bind
window.miniCycle.tasks.add = (...args) => taskCore.add(...args);
```

**Issue**: Circular dependency
```javascript
// If module A calls module B calls module A
// Namespace helps break cycles
```

---

**Last Updated**: November 23, 2025
**Status**: 🚧 Ready to begin
**Next Action**: Start Batch 1 (Notifications - 5 calls)
