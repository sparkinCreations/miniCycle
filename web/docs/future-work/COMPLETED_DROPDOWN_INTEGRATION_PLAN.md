# Completed Tasks Dropdown Integration Plan

## Context

The completed tasks dropdown was built as a DOM-level feature (move elements between two lists) without updating the systems that depend on list membership. It's 40% integrated — task completion and routine load work, but task deletion, undo/redo, settings disable, and task addition all break the dropdown in different ways. This plan adds the missing integration points using existing DI wrappers, no new patterns.

---

## Phase 1: Task deletion count update
**Risk: LOW | Files: taskCRUD.js, moduleManifests.js**

Deleting a task from the completed dropdown leaves the count badge stale.

**Fix:** After task removal in `deleteTaskImpl`, call `_deps.updateCompletedTasksCount?.()`. Add `'updateCompletedTasksCount'` to `taskCore.optionalDeps` in manifest. The dep flows through moduleLoader → taskCore DI → wireSubModuleDependencies → setTaskCRUDDependencies automatically.

**Verify:** Enable dropdown, complete 3 tasks, delete one from dropdown → count shows 2. Delete all → section hides.

---

## Phase 2: Settings disable toggle cleanup
**Risk: LOW | Files: settingsUIManager.js, settingsManager.js, moduleManifests.js**

Disabling the toggle does manual `appendChild` without restoring `draggable`, cleaning interaction classes, or updating boundary markers.

**Fix:** Replace manual DOM manipulation with `handleTaskListMovement(task, false)` per task. Critical: move tasks BEFORE updating AppState (while `isEnabled()` still returns true). Add `handleTaskListMovement` and `updateCompletedTasksCount` to settingsUIManager's DI chain (DI schema → settingsManager wireSubModuleDependencies → manifest optionalDeps).

**Verify:** Enable dropdown, complete 3 tasks, disable toggle → all tasks return to active list with `draggable="true"`, no stale classes. Re-enable → tasks reorganize. Test with 0 completed tasks → no errors.

---

## Phase 3: Undo/redo dropdown reorganization
**Risk: MEDIUM | Files: undoRedoManager.js, moduleManifests.js**

Undo/redo that changes task completion status via the patch path leaves the task in the wrong list. Most common case: undo a single task completion → task unchecks but stays in the completed dropdown.

**Fix:** Add `_deps.organizeCompletedTasks?.()` in `handleUndoRedoUIUpdate` after the orchestrator flush / fallback render. This is idempotent — for full renders it's a no-op (already organized by taskRenderer), for patches it fixes the position. Add `'organizeCompletedTasks'` to undoRedoManager's `optionalDeps` in manifest.

**Safety:** `organizeCompletedTasks` only manipulates DOM, never calls `AppState.update()`, so it won't corrupt the redo stack even while `isPerformingUndoRedo=true`.

**Verify:** Enable dropdown → complete task B → Ctrl+Z → B uncompletes and returns to active list. Ctrl+Y → B re-completes and moves to dropdown. Rapid undo 5x → no race conditions.

---

## Phase 4: Task addition with completed=true
**Risk: MEDIUM | Files: taskCRUD.js**

A task added with `completed=true` (e.g., recurring catch-up) stays in the active list instead of moving to the dropdown.

**Fix:** After `finalizeTaskCreation` returns the result element in `addTaskImpl`, if `completed && result`, call `_deps.handleTaskListMovement?.(result, true)`. Guard with `if (!isLoading)` to avoid redundant moves during initial load (where `organizeCompletedTasks` already handles it).

**Verify:** Enable dropdown → force recurring catch-up → completed tasks appear in dropdown. Normal page load → no regression.

---

## Phase 5: Manifest hygiene (optional)
**Risk: LOWEST | Files: moduleManifests.js**

Make implicit dependencies explicit in manifests. Not required (works without it) but prepares for future `ENFORCE_REQUIRES=true`.

Add to `optionalDeps`:
- `taskCore`: `'updateCompletedTasksCount'`, `'handleTaskListMovement'`
- `undoRedoManager`: `'organizeCompletedTasks'`
- `settingsManager`: `'handleTaskListMovement'`, `'updateCompletedTasksCount'`

---

## All phases use existing DI wrappers

No direct imports of `completedTasksManager.js` needed. All fixes call through moduleLoader depMappings (lines 811-814):
- `organizeCompletedTasks` → `deps.ui?.completedTasksManager?.organize?.()`
- `updateCompletedTasksCount` → `deps.ui?.completedTasksManager?.updateCount?.()`
- `handleTaskListMovement` → `deps.ui?.completedTasksManager?.handleMovement?.()`

## Versioning & Boot Sequence

All modified files are loaded via the manifest system with versioned imports. Run `./scripts/update-version.sh --auto` after implementation. No boot sequence changes — same manifests, same phases, same deps (just additional `optionalDeps` entries).

## Critical Files
- `/web/modules/task/taskCRUD.js` — Phases 1, 4
- `/web/modules/ui/undoRedoManager.js` — Phase 3
- `/web/modules/ui/settingsUIManager.js` — Phase 2
- `/web/modules/ui/settingsManager.js` — Phase 2
- `/web/modules/boot/moduleManifests.js` — All phases

## Verification
After each phase: `npm test -- routineSwitcher` + `npm test -- completedTasksManager` + manual smoke test. After all phases: full `npm test`.
