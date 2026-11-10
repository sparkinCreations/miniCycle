# Drag and Drop Hardening

> **Status:** Open — 6 items, none started ·
> **Severity:** Item 1 is Medium (a touch drag cannot reach rows that are off screen); the
> rest are Low ·
> **Found:** Nov 2026, read-through of `modules/task/dragDropManager.js` at v2.675.
>
> Scope of the review: `dragDropManager.js` in full, plus the test names in
> `dragDropManager.tests.js` and the reorder journeys in `run-journey-tests.cjs`. Nothing
> here was reproduced on a device; each item is a reading of the code. Symbol names are given
> rather than line numbers so the list survives edits.

The ordering logic is in good shape. `mergeVisibleOrder()` and the id-based move in
`_moveTaskOneStep()` keep hidden and filtered rows in place, the arrow buttons and Alt+arrow
share one code path, abandoned drags revert through `_revertUnfinishedDrag()`, and keyboard
moves are announced with name and position. The items below are in the gesture handling
around that.

---

## 1. A touch drag cannot scroll the list

Once the long press arms, the row's `touchmove` handler calls `preventDefault()` on every
move, and the drop target comes from `document.elementFromPoint()`. Nothing scrolls
`.task-list-container` while the finger is near its top or bottom edge, so only rows already
on screen can be reached. In a routine longer than the visible list (the 14-task "Daily
Routine" sample on an iPhone, for one) a task cannot be dragged from one end to the other in
a single gesture. Desktop HTML5 drags get the browser's own edge scrolling, so this is
touch only.

The workarounds today are several short drags, or the move arrows, which are off by default.

**To do:** scroll the container while a touch drag is held within an edge band, at a speed
that grows toward the edge, and re-run the `elementFromPoint` lookup as rows move under a
stationary finger. Add it to the `drag reorder` journey with a list taller than the viewport.

## 2. The document-level handlers cancel every drag on the page

`_dragoverHandler` and `_dropHandler` are registered on `document`. Both call
`preventDefault()` before checking `this.draggedTask`, so drags that have nothing to do with
tasks are cancelled too: selected text dragged into the Add task field, or a file dragged
onto the page.

**To do:** return early when `this.draggedTask` is null, before `preventDefault()`.

## 3. Dragging over a row in the completed list throws

`_dragoverHandler` and the touch path accept any element matching `DOM_SELECTORS.TASK`,
including rows in `#completedTaskList`. Those have a different parent from the dragged row,
so `parent.insertBefore(this.draggedTask, target…)` in `_applyPendingRearrange()` throws.
The `catch` logs it as a likely race condition and removes the dragging classes, so the row
loses its lifted look mid-drag while `draggedTask` is still set.

**To do:** ignore a target whose `parentNode` is not the dragged row's parent, in
`_applyPendingRearrange()` or before `handleRearrange()` records it.

## 4. Every dependency is declared `optional`

`createDIModule('DragDropManager', …)` marks all fifteen deps `optional(null)`. Two are not
optional in practice:

- `safeAddEventListener` is called unguarded in `setupRearrange()`,
  `setupVisibilityCleanup()` and `enableDragAndDrop()`. Missing, each throws into a `catch`
  that warns, and dragging is quietly unavailable.
- `AppState`: when it is missing or not ready, `saveDragReorder()` skips the write with no
  notification. The row stays where it was dropped on screen and the order is not saved.
  (`_moveTaskOneStep()` does notify in the same situation.)

This is the pattern common mistake 19 in `CLAUDE.md` describes from the other side: a dep
that must be there should be `required()` and read unguarded, so a wiring failure names
itself.

**To do:** make `AppState` and `safeAddEventListener` `required()`, and have
`saveDragReorder()` restore the list from state and notify when it cannot save.

## 5. Leftovers

- `AppMeta` is declared in the DI block and never read.
- `isTap` in `enableDragAndDrop()` is assigned in six places and never read.
- `fallbackNotification()` is an empty function. Its comment says it logs to the console,
  and the unit test named "fallbackNotification() logs to console" passes without checking
  that.
- The instance keeps two views of its deps: `this.deps`, copied once in the constructor, and
  the module-level `_deps` proxy, used only for `appInit`.

## 6. The move lock drops quick repeats

`_moveTaskOneStep()` holds `_arrowMoveInProgress` for 200ms after each move to absorb a
duplicate click. A second Alt+arrow or arrow press inside that window is dropped with no
feedback, so two quick presses move the task once.

**To do:** key the guard to the duplicate it was written for (the same event firing twice)
instead of a time window, or queue the second move.

---

## Test coverage note

The 44 unit tests are mostly existence and "does not throw" checks. The touch sequence
(hold, move, release, cancel) has no unit coverage; the `drag reorder` journey carries it.
Items 1 to 3 would each need a journey step, since they depend on real layout and events.

## Related

- [Task Ordering System](TASK_ORDERING_SYSTEM_PLAN.md)
- [Boot Orchestration Hardening](BOOT_ORCHESTRATION_HARDENING.md)
