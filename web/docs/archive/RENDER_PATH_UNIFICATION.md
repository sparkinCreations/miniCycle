# Render-Path Unification Plan (Completed Dropdown)

> **✅ ARCHIVED 2026-08-13** — work verified shipped in the tree at v2.412. All 3 phases done: `taskRenderer.js:210-244` implements the partitioned render and cites this doc. Note: the "Why DOM order matters" section below remains the only home of that rationale — flagged as a JSDoc-salvage candidate. Live leftovers moved to `docs/future-work/AUDIT_RESIDUALS_2026_08.md`.

## Context

The completed-tasks dropdown is populated by **two DOM-owning code paths** that don't know about each other:

1. **Full render** — `TaskRenderer.renderTasks()` rebuilds the **active** list only, atomically: it builds every task (active *and* completed) into a `DocumentFragment` and swaps it in via `taskList.replaceChildren(...)` (`modules/task/taskRenderer.js:211`). The completed list (`#completedTaskList`) is a separate element it never touches.
2. **Post-render move** — immediately after, `renderTasks` calls `organizeCompletedTasks()` → `CompletedTasksManager.organize()`, which *moves* the just-rendered completed nodes out of the active list and into `#completedTaskList` via `appendChild`.

Because the full render never clears `#completedTaskList`, any nodes left there from a **previous** render survive, and `organize()` appends the fresh copies alongside them → **two DOM nodes sharing one `data-task-id`** ("duplicate in completed" bug). It only surfaced on lists that load *pre-populated* with completed tasks (imported / old `.mcyc` files), because those fill the dropdown on first load and then duplicate on the next full re-render (undo/redo, mode switch, routine switch-and-back, theme change).

This is the classic hand-rolled-list failure mode that keyed reconciliation in a framework prevents by construction. We hand-roll the reconciliation across two sibling containers, so the `one taskId → one node` invariant is **ours to enforce**.

### Already shipped (the stop-gap)

The bug is **already fixed defensively** — this plan is debt reduction, not a fix for something broken:

- `CompletedTasksManager.organize()` now de-dupes: before the DOWN pass it drops any `#completedTaskList` node whose `data-task-id` already has a fresh counterpart in the active list. No-op in steady state and for undo/redo callers. (`modules/ui/completedTasksManager.js`)
- `GlobalUtils.syncAllTasksWithMode()` is now a symmetric DOM healer: it removes both **orphaned** nodes (DOM-without-data) *and* **duplicate-id** nodes (data-with-two-nodes), keeping the first/canonical occurrence. (`modules/utils/globalUtils.js`)

Both are **belt-and-suspenders**. The goal of this plan is to make them *redundant* by removing the seam that produces duplicates in the first place — so correctness no longer depends on a healer running after the fact.

---

## Goal

Make rendering the **single source of truth for list membership**: `renderTasks` partitions tasks by `task.completed` and builds **both** `#taskList` and `#completedTaskList` in one keyed pass. After a full render there is exactly one node per task, already in the correct container — no post-render move, no stale accumulation, no dedup needed.

`organize()` survives, but only for the **patch-render** path (undo/redo un-completing a task updates the checkbox in place without relocating the node). That's the one case where a node legitimately needs to move *after* render — and it's the case `organize()`'s UP-direction was built for.

---

## Phase 1: Partitioned full render
**Risk: MEDIUM | Files: taskRenderer.js**

Teach `renderTasks` to route each built task element to the right container instead of dumping everything into the active list.

**Approach:**
- Build into **two** fragments while iterating `tasksArray` — `activeFragment` and `completedFragment` — choosing by `task.completed` **only when the dropdown feature is enabled** (`this.deps.isCompletedDropdownEnabled?.()` — add a thin DI wrapper around `completedTasksManager.isEnabled()`). When the feature is disabled, everything goes to `activeFragment` exactly as today.
- Atomic swap **both** lists: `taskList.replaceChildren(...activeFragment.childNodes)` **and** `completedList.replaceChildren(...completedFragment.childNodes)`. Clearing the completed list is now part of the atomic rebuild — the root cause is gone.
- Completed nodes built for the dropdown need the same post-move treatment `moveToCompleted` applies today: `draggable="false"`, cleared interaction classes, options force-hidden. Extract that into a shared helper (e.g. `CompletedTasksManager.prepareCompletedNode(el)`) and call it during the build so the two paths can't drift.

**Remove:** the `organizeCompletedTasks()` call at the end of `renderTasks` (it's now redundant for full renders — see Phase 2 for the patch path).

**Verify:** Import an old `.mcyc` with pre-completed tasks → first load groups them correctly. Trigger every full-render path (undo/redo, mode switch, routine switch-and-back, theme change) → still exactly one node per task, none duplicated, count correct. Toggle feature off → all tasks render in the active list. `npm test -- completedTasksManager`.

---

## Phase 2: Keep `organize()` for patch renders only
**Risk: LOW | Files: undoRedoManager.js (no change expected), completedTasksManager.js**

After Phase 1, `organize()` is no longer called from the full-render path. It must still run after **patch renders** — undo/redo un-completing a task updates the checkbox in place without moving the DOM node, leaving it stranded in the wrong list. That call already exists (see `COMPLETED_DROPDOWN_INTEGRATION_PLAN.md` Phase 3, `handleUndoRedoUIUpdate` → `organizeCompletedTasks()`), so **no new wiring is needed** — just confirm the patch path still invokes it and the full path no longer does.

The dedup guard added to `organize()` stays (cheap, and the patch path can still encounter a transient duplicate during rapid undo/redo).

**Verify:** Enable dropdown → complete B → Ctrl+Z → B unchecks and returns to active. Ctrl+Y → B re-completes into the dropdown. Rapid undo 5× → no duplicates, no stranded nodes.

---

## Phase 3: Demote the healer to a guard rail
**Risk: LOWEST | Files: globalUtils.js (no behavior change)**

`syncAllTasksWithMode`'s duplicate-removal branch becomes a pure safety net rather than a load-bearing healer. No code change — just document (in the function's comment) that with the unified render path it should never find a duplicate, and that a duplicate appearing in logs (`Removing duplicate task element`) now signals a regression in the render path worth investigating, not normal operation.

---

## Why DOM order matters (don't skip the regression surface)

The dual-list design exists for real reasons, and several systems read **DOM order** directly. Phase 1 must preserve all of them:

- **Drag-drop** excludes completed tasks via `closest('#completedTaskList')` (`modules/task/dragDropManager.js`). Completed nodes must land in the completed list with `draggable="false"`.
- **Move-arrow boundary markers** (`IS_FIRST_TASK` / `IS_LAST_TASK`) are computed from the active list's child order (`_updateBoundaryMarkers`). Building completed tasks out of the active list must leave the active list's ordering intact.
- **Un-complete restoration** uses `dataset.originalIndex` captured at completion time (`moveToActive`). A task rendered straight into the completed dropdown by Phase 1 won't have an `originalIndex` — confirm `moveToActive`'s "no original position → append to end" fallback is acceptable, or seed `originalIndex` from the task's index in `tasksArray` during the build.

This is exactly why a **pure-CSS** approach was rejected: grouping completed tasks to the bottom of a single list via flexbox `order` would decouple visual order from DOM order and break all three systems above. Unifying the render keeps DOM order canonical.

---

## Critical Files
- `/web/modules/task/taskRenderer.js` — Phase 1 (partitioned render, remove post-render organize)
- `/web/modules/ui/completedTasksManager.js` — Phase 1 (shared `prepareCompletedNode` helper), Phase 2 (`organize` retained for patches)
- `/web/modules/ui/undoRedoManager.js` — Phase 2 (confirm patch-path organize call)
- `/web/modules/utils/globalUtils.js` — Phase 3 (comment only)
- `/web/modules/boot/moduleLoader.js` — if a new `isCompletedDropdownEnabled` DI wrapper is added, register it in `depMappings` (the full 4-step pipeline)

## Versioning & Boot Sequence
No boot-sequence changes — same manifests, same phases. If a new DI wrapper (`isCompletedDropdownEnabled`) is introduced, complete the 4-step pipeline (manifest `provides`/`optionalDeps` → `depMappings` → integration → consumer `this.deps`) or it will silently resolve `undefined`. Run `./scripts/update-version.sh --auto` after implementation.

## Verification
After each phase: `npm test -- completedTasksManager` + `npm test -- globalUtils` + manual smoke (import an old pre-completed `.mcyc`, then exercise every full-render trigger). After all phases: full `npm test`, plus the journey suite (`npm run test:journey`) since rendering is on every user path.

## Relationship to other plans
- `COMPLETED_DROPDOWN_INTEGRATION_PLAN.md` — the integration points (deletion, settings disable, undo/redo, add-with-completed). This plan assumes those are in place; Phase 2 here depends on that plan's Phase 3 (patch-path `organizeCompletedTasks` call).
- `TASK_ORDERING_SYSTEM_PLAN.md` — any future move to a persisted order field should land before or alongside Phase 1, since both touch how `renderTasks` orders nodes.
