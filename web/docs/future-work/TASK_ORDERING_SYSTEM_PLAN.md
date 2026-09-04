# Task Ordering System Plan

**Status:** Planned — not scheduled
**Priority:** Low (was Medium; re-priced 2026-09-04, see below)
**Estimated Effort:** 3-4 days
**Breaking Changes:** Yes (schema change, requires migration)

> **Re-priced Sep 2026 (v2.540).** The strongest *defect* argument for this plan is gone:
> the index-arithmetic reorder bug it would have prevented was fixed directly, in about an
> hour, without a schema change. What remains is position-restoration polish (problems 1–2,
> currently handled by a `dataset.originalIndex` attribute that works) and problem 3, which
> is a **feature** — numbered tasks — not a defect.
>
> That is a poor trade for a breaking migration that runs against every user's stored data.
> Do this when you actually want task numbering; then the migration buys something visible.
> `STATE_TRUTH_MIGRATION.md`'s own implementation order says the same thing from the other
> direction: *"Do not start at schema 2.6 or UUID keys. Collapse Gen 1 on the loop first."*

---

## Overview

Implement a fractional indexing system for task ordering, where each task has a persistent `order` field (e.g., `1.001`, `2.002`). This provides a single source of truth for task position that persists across all operations.

### Problems Solved

1. **Completed task restoration** - Tasks return to exact position after uncomplete
2. **Recurring task restoration** - Recurring tasks reset to original position
3. **User-facing numbering** - Enable "Task #1, #2, #3" display feature
4. **Drag reorder persistence** - Order survives refresh without relying on array position
5. **Conflict resolution** - Decimal precision handles insertions gracefully
6. ~~**Index-arithmetic reorder bugs**~~ — **no longer a motivation.** This plan would make
   them structurally impossible, but the one live instance
   ([STATE_TRUTH_MIGRATION.md](./STATE_TRUTH_MIGRATION.md) #10, the move-up/down arrows
   splicing `cycle.tasks` at a DOM index) was **fixed in v2.540** by resolving through task
   ids instead. No code maps a DOM position onto an array index today. Kept listed so the
   next reader does not re-derive it as a reason to start.

### Current Limitations

- Task position is determined by array order in AppState
- Completed tasks lose position info (currently using temporary DOM attribute)
- Recurring tasks don't know their original position after reset
- No foundation for user-facing task numbering feature

---

## Proposed Schema Change

### Task Object (Schema 2.6+)

```javascript
task: {
  id: "abc123",
  text: "Do laundry",
  completed: false,
  order: 2.001,           // NEW: Fractional order value
  // ... existing fields
}
```

### Order Value Format

```
order = integer.decimal

Where:
- integer = base position (1, 2, 3...)
- decimal = uniqueness suffix for insertions

Examples:
- 1.001 → First task
- 2.001 → Second task
- 1.500 → Inserted between 1.001 and 2.001
- 1.250 → Inserted between 1.001 and 1.500
```

### Order Generation Strategy

**For appending new tasks:**
```javascript
function getNextOrder(tasks) {
  if (tasks.length === 0) return 1.001;

  const maxOrder = Math.max(...tasks.map(t => t.order), 0);
  return Math.floor(maxOrder) + 1 + 0.001;
}
// Example: Tasks have 1.001, 2.001 → new task gets 3.001
```

**For insertions (drag between tasks):**
```javascript
function calculateInsertOrder(prevOrder, nextOrder) {
  const midpoint = (prevOrder + nextOrder) / 2;
  return parseFloat(midpoint.toFixed(3)); // 3 decimal max
}
// Example: Insert between 1.001 and 2.001
// → (1.001 + 2.001) / 2 = 1.501
```

**Why this works:**
- No counter state to track
- No timestamp randomness
- Simple math, deterministic results
- 3 decimal precision prevents floating point issues

---

## Implementation Plan

### Phase 1: Schema & Migration

1. **Add `order` field to task schema**
   - Default: array index + 0.001
   - Files: `constants.js`, `dataValidator.js`

2. **Create `taskOrdering.js` module**
   ```javascript
   // modules/task/taskOrdering.js
   export function getNextOrder(tasks) { ... }
   export function calculateInsertOrder(prev, next) { ... }
   export function shouldNormalize(tasks) { ... }
   export function normalizeOrders(tasks) { ... }
   ```

3. **Migration function**
   ```javascript
   function migrateTaskOrdering(tasks) {
     return tasks.map((task, index) => ({
       ...task,
       order: task.order ?? (index + 1) + 0.001
     }));
   }
   ```

4. **Update `migrationManager.js`**
   - Add migration step for existing tasks

### Phase 2: Core Operations

1. **Task Creation** (`taskCRUD.js`)
   ```javascript
   import { getNextOrder } from './taskOrdering.js';

   const newTask = {
     ...taskData,
     order: getNextOrder(existingTasks)
   };
   ```

2. **Drag & Drop Reorder** (`dragDropManager.js`)
   ```javascript
   import { calculateInsertOrder } from './taskOrdering.js';

   const newOrder = calculateInsertOrder(
     prevTask?.order ?? 0,
     nextTask?.order ?? prevTask.order + 1
   );
   ```

3. **Task Rendering** (`taskRenderer.js`, `routineLoader.js`)
   ```javascript
   // Sort by order before rendering
   const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
   ```

### Phase 3: Feature Integration

1. **Completed Task Dropdown** (`completedTasksManager.js`)
   - Remove `dataset.originalIndex` approach
   - Use `task.order` for position restoration
   ```javascript
   moveToActive(taskElement) {
     const taskOrder = getTaskOrder(taskElement.dataset.taskId);
     // Insert at correct position based on order
   }
   ```

2. **Recurring Tasks** (`recurringCore.js`)
   - Preserve `order` when task resets
   - Task returns to same position after cycle completion

3. **Cycle Reset** (`taskCycleReset.js`)
   - Sort by `order` when moving tasks back
   - Remove complex position restoration logic

### Phase 4: Optional Features

1. **User-Facing Numbering**

   **Option A: CSS Counters (Recommended)**
   ```css
   /* Zero JavaScript needed */
   #taskList {
     counter-reset: task-counter;
   }

   .task::before {
     counter-increment: task-counter;
     content: counter(task-counter) ". ";
   }
   ```

   **Option B: JavaScript (if more control needed)**
   ```javascript
   function getDisplayNumber(task, allTasks) {
     const sorted = [...allTasks].sort((a, b) => a.order - b.order);
     return sorted.findIndex(t => t.id === task.id) + 1;
   }
   ```

   > **Note:** Don't use `Math.floor(task.order)` - it breaks after insertions.
   > Task with order 1.500 would display as "1" instead of its actual position.

2. **Reorder Normalization**
   ```javascript
   function normalizeOrders(tasks) {
     const sorted = [...tasks].sort((a, b) => a.order - b.order);
     return sorted.map((task, i) => ({
       ...task,
       order: (i + 1) + 0.001
     }));
   }
   ```

---

## Normalization Strategy

### When to Normalize

Normalization resets orders to clean values (1.001, 2.001, 3.001...) when:

```javascript
function shouldNormalize(tasks) {
  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  // Check 1: Gap too tight (precision getting squeezed)
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].order - sorted[i].order;
    if (gap < 0.002) return true;
  }

  // Check 2: Numbers too large
  if (sorted.some(t => t.order > 1000)) return true;

  // Check 3: Too many decimal places
  if (sorted.some(t => {
    const decimals = (t.order.toString().split('.')[1] || '').length;
    return decimals > 3;
  })) return true;

  return false;
}
```

### When to Trigger

- **After drag-drop:** Check `shouldNormalize()`, run if needed
- **On app startup:** Validate and normalize if issues detected
- **Manual option:** "Clean up task order" in settings (optional)

---

## Files Affected

| File | Changes |
|------|---------|
| `taskOrdering.js` | **NEW** - Core ordering logic module |
| `constants.js` | Add DEFAULT_TASK_ORDER |
| `dataValidator.js` | Validate order field, check uniqueness |
| `migrationManager.js` | Add migration step |
| `taskCRUD.js` | Calculate order on create |
| `dragDropManager.js` | Calculate midpoint order on drag |
| `taskRenderer.js` | Sort by order before render |
| `routineLoader.js` | Sort by order on load |
| `completedTasksManager.js` | Use order for position restore |
| `taskCycleReset.js` | Sort by order on reset |
| `recurringCore.js` | Preserve order on recurring reset |

---

## Edge Cases

### Precision Limits

After many insertions between the same two tasks:
```
1.001 → 1.501 → 1.251 → 1.126 → 1.063...
```

**Solution:** `shouldNormalize()` detects when gap < 0.002 and triggers cleanup.

### Conflict Resolution

If two tasks somehow have identical orders:
```javascript
function resolveOrderConflict(tasks) {
  return tasks.sort((a, b) => {
    if (a.order === b.order) {
      // Tiebreaker: older task first
      return (a.createdAt || 0) - (b.createdAt || 0);
    }
    return a.order - b.order;
  });
}
```

### Import/Export

- Preserve `order` values on export
- On import, validate and repair if needed
- If orders missing, generate from array position

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration fails for some users | Low | High | Validate before/after, auto-repair fallback |
| Precision loss after many ops | Medium | Low | Auto-normalize when `shouldNormalize()` returns true |
| Duplicate orders | Low | Medium | Validate on load, tiebreaker by createdAt |
| Performance (sorting on render) | Low | Low | Memoize sorted array, only re-sort on change |
| Breaking change for users | High | Medium | Schema 2.6, proper migration in migrationManager |

### Rollback Plan

If critical issues found post-release:
1. Revert schema version check
2. Ignore `order` field (fall back to array position)
3. Don't delete field - allows re-enabling later

---

## Testing Strategy

1. **Unit Tests**
   - `getNextOrder()` - returns correct next order
   - `calculateInsertOrder()` - midpoint calculation
   - `shouldNormalize()` - detects all trigger conditions
   - `normalizeOrders()` - produces clean 1.001, 2.001 sequence
   - Migration of existing tasks

2. **Integration Tests**
   - Complete task → uncomplete → position restored
   - Drag reorder → refresh → order preserved
   - Recurring task → reset → position preserved
   - Many insertions → normalization triggered → order cleaned

3. **Edge Case Tests**
   - 50+ insertions between same tasks (precision)
   - Duplicate orders (conflict resolution)
   - Empty task list
   - Single task
   - Import with missing orders

---

## Effort Breakdown

| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | `taskOrdering.js` module + unit tests | ~6 |
| 2 | Migration + schema update + validation | ~4 |
| 3 | Update drag-drop, rendering, completed dropdown | ~6 |
| 4 | Edge cases, normalization, integration tests | ~4 |

**Total: ~20 hours (3-4 days)**

---

## Rollout Plan

1. Add `order` field (optional, backwards compatible)
2. Migrate existing tasks to have `order`
3. Update drag/drop to use `order`
4. Update completed dropdown to use `order`
5. Update recurring reset to use `order`
6. (Optional) Add user-facing numbering feature

---

## Related Documents

- [STATE_TRUTH_MIGRATION.md](./STATE_TRUTH_MIGRATION.md) - #10 was the live bug this plan
  would have made structurally impossible. It got the small id-based fix instead (v2.540),
  which is the precedent worth noting: a targeted fix closed it in an hour where this plan
  would have taken ~20 hours and a migration.
- [SCHEMA_2_6_PLAN.md](./SCHEMA_2_6_PLAN.md) - Could bundle with schema update
- [COMPLETED_TASKS_DROPDOWN.md](../features/COMPLETED_TASKS_DROPDOWN.md) - Current position handling
