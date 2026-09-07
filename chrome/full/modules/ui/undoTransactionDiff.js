/**
 * miniCycle Undo Transaction Diff
 *
 * Works out what changed between two undo snapshots and turns it into the line a
 * user reads on an undo/redo notification ("Undid: task renamed"). Split out of
 * `undoRedoManager.js` (Priority 3, LARGE_MODULE_SPLITS_PLAN.md).
 *
 * PATTERN 2 — pure utility extraction. No DI container, no module-level mutable
 * state, no listeners, and no globals: this pair reads `localStorage`, `document`
 * and `window` exactly zero times. `computeTransactionDiff` is the entry point;
 * `describeChange` is its helper and is exported only so it can be tested
 * directly.
 *
 * ONE HONEST CAVEAT about "pure": every user-facing string comes from
 * `getLabel()`, which is vocabulary-theme sensitive. Same input gives the same
 * output *for a given theme* — assertions on exact wording should match loosely
 * (a regex on the shape) rather than pinning a literal string, which is why the
 * tests do exactly that.
 *
 * CONSEQUENCE: a static import from a boot-critical module makes this file
 * boot-critical too. It IS in `BOOT_CRITICAL` in `service-worker.js`; run
 * `npm run test:sw` if you touch it.
 *
 * KEEP IT DEPENDENCY-FREE. Note that "no _deps" is NOT the same as "pure":
 * `saveToUndoCache`/`loadFromUndoCache` also declare no deps and were deliberately
 * left in the parent because they touch `localStorage`. Anything needing state or
 * a dependency does not belong here.
 *
 * @module ui/undoTransactionDiff
 */

import { getLabel } from '../labels/labelResolver.js';

/**
 * Analyze what changed between two snapshots
 * Returns a descriptive message like "Task added" or "Task reordered"
 */
export function describeChange(fromSnapshot, toSnapshot) {
  if (!fromSnapshot || !toSnapshot) return getLabel('notify.changeGeneric');

  const changes = [];
  const fromTasks = fromSnapshot.tasks || [];
  const toTasks = toSnapshot.tasks || [];

  // Cycle-level changes
  if (fromSnapshot.title !== toSnapshot.title) {
    changes.push(getLabel('notify.changeCycleRenamed'));
  }
  if (fromSnapshot.autoReset !== toSnapshot.autoReset ||
      fromSnapshot.deleteCheckedTasks !== toSnapshot.deleteCheckedTasks) {
    changes.push(getLabel('notify.changeModeChanged'));
  }
  if ((fromSnapshot.theme || 'classic') !== (toSnapshot.theme || 'classic')) {
    changes.push(getLabel('notify.changeThemeChanged'));
  }
  if ((fromSnapshot.cycleCount || 0) !== (toSnapshot.cycleCount || 0)) {
    changes.push(getLabel('notify.changeCycleCount'));
  }
  if ((fromSnapshot.clearedTasks?.totalCleared || 0) !== (toSnapshot.clearedTasks?.totalCleared || 0)) {
    changes.push(getLabel('notify.changeClearedTasks'));
  }

  // Task count changes
  const countDiff = toTasks.length - fromTasks.length;
  if (countDiff > 0) {
    changes.push(countDiff === 1 ? getLabel('notify.changeTaskAdded') : getLabel('notify.changeTasksAdded', { vars: { count: countDiff } }));
  } else if (countDiff < 0) {
    const deleted = Math.abs(countDiff);
    changes.push(deleted === 1 ? getLabel('notify.changeTaskDeleted') : getLabel('notify.changeTasksDeleted', { vars: { count: deleted } }));
  }

  // Per-task modifications
  const fromTaskMap = new Map(fromTasks.map(t => [t.id, t]));
  const toTaskMap = new Map(toTasks.map(t => [t.id, t]));

  // Track per-field change counts to avoid duplicate labels
  const fieldCounts = {
    edited: 0, completed: 0, uncompleted: 0,
    prioritySet: 0, priorityRemoved: 0, priorityColor: 0,
    recurringOn: 0, recurringOff: 0,
    remindersOn: 0, remindersOff: 0,
    dueDateSet: 0, dueDateRemoved: 0, dueDateChanged: 0,
    clearToggled: 0
  };

  for (const [id, toTask] of toTaskMap) {
    const fromTask = fromTaskMap.get(id);
    if (!fromTask) continue;

    if (fromTask.text !== toTask.text) fieldCounts.edited++;
    if (!fromTask.completed && toTask.completed) fieldCounts.completed++;
    if (fromTask.completed && !toTask.completed) fieldCounts.uncompleted++;
    if (fromTask.highPriority !== toTask.highPriority) {
      if (toTask.highPriority) fieldCounts.prioritySet++;
      else fieldCounts.priorityRemoved++;
    }
    if (fromTask.highPriority && toTask.highPriority &&
        (fromTask.priorityColor || null) !== (toTask.priorityColor || null)) {
      fieldCounts.priorityColor++;
    }
    if (!!fromTask.recurring !== !!toTask.recurring) {
      if (toTask.recurring) fieldCounts.recurringOn++;
      else fieldCounts.recurringOff++;
    }
    if (!!fromTask.remindersEnabled !== !!toTask.remindersEnabled) {
      if (toTask.remindersEnabled) fieldCounts.remindersOn++;
      else fieldCounts.remindersOff++;
    }
    if ((fromTask.dueDate || null) !== (toTask.dueDate || null)) {
      if (!fromTask.dueDate && toTask.dueDate) fieldCounts.dueDateSet++;
      else if (fromTask.dueDate && !toTask.dueDate) fieldCounts.dueDateRemoved++;
      else fieldCounts.dueDateChanged++;
    }
    // `deleteWhenComplete` is DERIVED from deleteWhenCompleteSettings[mode], so it
    // also moves whenever the routine's mode does. Only count it as a user action
    // when the stored settings actually changed — the per-task control writes both
    // (taskButtons.js), a mode switch writes only the derived value. Without this,
    // switching to To-Do Mode reported a per-task control the user never touched.
    if (!!fromTask.deleteWhenComplete !== !!toTask.deleteWhenComplete &&
        JSON.stringify(fromTask.deleteWhenCompleteSettings || null) !==
        JSON.stringify(toTask.deleteWhenCompleteSettings || null)) {
      fieldCounts.clearToggled++;
    }
  }

  // Map field counts to labels (first match per field type)
  if (fieldCounts.edited > 0) changes.push(getLabel('notify.changeTaskEdited'));
  if (fieldCounts.completed > 0) {
    changes.push(fieldCounts.completed === 1 ? getLabel('notify.changeTaskCompleted') : getLabel('notify.changeTasksCompleted', { vars: { count: fieldCounts.completed } }));
  }
  if (fieldCounts.uncompleted > 0) {
    changes.push(fieldCounts.uncompleted === 1 ? getLabel('notify.changeTaskUncompleted') : getLabel('notify.changeTasksUncompleted', { vars: { count: fieldCounts.uncompleted } }));
  }
  if (fieldCounts.prioritySet > 0) changes.push(getLabel('notify.changePrioritySet'));
  if (fieldCounts.priorityRemoved > 0) changes.push(getLabel('notify.changePriorityRemoved'));
  if (fieldCounts.priorityColor > 0) changes.push(getLabel('notify.changePriorityColor'));
  if (fieldCounts.recurringOn > 0) changes.push(getLabel('notify.changeRecurringEnabled'));
  if (fieldCounts.recurringOff > 0) changes.push(getLabel('notify.changeRecurringDisabled'));
  if (fieldCounts.remindersOn > 0) changes.push(getLabel('notify.changeRemindersEnabled'));
  if (fieldCounts.remindersOff > 0) changes.push(getLabel('notify.changeRemindersDisabled'));
  if (fieldCounts.dueDateSet > 0) changes.push(getLabel('notify.changeDueDateSet'));
  if (fieldCounts.dueDateRemoved > 0) changes.push(getLabel('notify.changeDueDateRemoved'));
  if (fieldCounts.dueDateChanged > 0) changes.push(getLabel('notify.changeDueDateChanged'));
  if (fieldCounts.clearToggled > 0) changes.push(getLabel('notify.changeClearToggled'));

  // Check for reordering (only if no other task-level changes found)
  if (changes.length === 0) {
    const fromOrder = fromTasks.map(t => t.id).join(',');
    const toOrder = toTasks.map(t => t.id).join(',');
    if (fromOrder !== toOrder) {
      changes.push(getLabel('notify.changeTasksReordered'));
    }
  }

  // Return result
  if (changes.length === 0) return getLabel('notify.changeGeneric');
  if (changes.length === 1) return changes[0];
  // Compound: show primary change + count
  // count (top-level) drives {one, other} plural selection; vars.count fills
  // the {count} placeholder. Without the top-level count the resolver can't
  // pick a form and every two-change compound rendered "… + 1 changes".
  const extraCount = changes.length - 1;
  return changes[0] + ' + ' + getLabel('notify.changeMultiple', { count: extraCount, vars: { count: extraCount } });
}

/**
 * Compute a structured transaction diff between two snapshots
 * Used by UIOrchestrator to decide patch vs full render
 * @param {Object} fromSnapshot - Previous state snapshot
 * @param {Object} toSnapshot - New state snapshot
 * @returns {Object} Transaction diff with actionable metadata
 */
export function computeTransactionDiff(fromSnapshot, toSnapshot) {
  const diff = {
    kind: 'undo', // or 'redo' - set by caller
    cycleChanged: false,
    themeChanged: false,
    recurringChanged: false,
    clearedTasksChanged: false,
    taskCountChanged: false,
    taskOrderChanged: false,
    changedTaskIds: [],
    addedTaskIds: [],
    removedTaskIds: [],
    fieldsChanged: new Set(),
    requiresFullRender: false,
    description: describeChange(fromSnapshot, toSnapshot)
  };

  if (!fromSnapshot || !toSnapshot) {
    diff.requiresFullRender = true;
    return diff;
  }

  const fromTasks = fromSnapshot.tasks || [];
  const toTasks = toSnapshot.tasks || [];

  // Check for cycle-level changes (require full render)
  if (fromSnapshot.activeCycleId !== toSnapshot.activeCycleId) {
    diff.cycleChanged = true;
    diff.requiresFullRender = true;
    return diff;
  }

  if (fromSnapshot.title !== toSnapshot.title ||
      fromSnapshot.autoReset !== toSnapshot.autoReset ||
      fromSnapshot.deleteCheckedTasks !== toSnapshot.deleteCheckedTasks) {
    diff.cycleChanged = true;
    // Cycle metadata changes don't require full task re-render
  }

  // Check theme changes (requires vocab theme refresh)
  if ((fromSnapshot.theme || 'classic') !== (toSnapshot.theme || 'classic')) {
    diff.themeChanged = true;
  }

  // Check recurring template changes (requires recurring panel refresh)
  if (JSON.stringify(fromSnapshot.recurringTemplates || {}) !==
      JSON.stringify(toSnapshot.recurringTemplates || {})) {
    diff.recurringChanged = true;
  }

  // Check cleared tasks changes (requires history refresh)
  if (JSON.stringify(fromSnapshot.clearedTasks || null) !==
      JSON.stringify(toSnapshot.clearedTasks || null)) {
    diff.clearedTasksChanged = true;
  }

  // Check task count changes
  if (fromTasks.length !== toTasks.length) {
    diff.taskCountChanged = true;
  }

  // Build task maps
  const fromTaskMap = new Map(fromTasks.map(t => [t.id, t]));
  const toTaskMap = new Map(toTasks.map(t => [t.id, t]));

  // Find added tasks
  for (const [id] of toTaskMap) {
    if (!fromTaskMap.has(id)) {
      diff.addedTaskIds.push(id);
    }
  }

  // Find removed tasks
  for (const [id] of fromTaskMap) {
    if (!toTaskMap.has(id)) {
      diff.removedTaskIds.push(id);
    }
  }

  // Check for order changes
  const fromOrder = fromTasks.map(t => t.id).join(',');
  const toOrder = toTasks.map(t => t.id).join(',');
  if (fromOrder !== toOrder) {
    diff.taskOrderChanged = true;
  }

  // Find modified tasks and what fields changed
  for (const [id, toTask] of toTaskMap) {
    const fromTask = fromTaskMap.get(id);
    if (!fromTask) continue; // new task, already in addedTaskIds

    const taskFieldsChanged = [];

    if (fromTask.text !== toTask.text) {
      taskFieldsChanged.push('text');
    }
    if (fromTask.completed !== toTask.completed) {
      taskFieldsChanged.push('completed');
    }
    if (fromTask.highPriority !== toTask.highPriority) {
      taskFieldsChanged.push('highPriority');
    }
    if ((fromTask.priorityColor || null) !== (toTask.priorityColor || null)) {
      taskFieldsChanged.push('priorityColor');
    }
    if (fromTask.dueDate !== toTask.dueDate) {
      taskFieldsChanged.push('dueDate');
    }
    if (fromTask.recurring !== toTask.recurring) {
      taskFieldsChanged.push('recurring');
    }
    if (fromTask.remindersEnabled !== toTask.remindersEnabled) {
      taskFieldsChanged.push('remindersEnabled');
    }
    if (fromTask.deleteWhenComplete !== toTask.deleteWhenComplete) {
      taskFieldsChanged.push('deleteWhenComplete');
    }

    if (taskFieldsChanged.length > 0) {
      diff.changedTaskIds.push(id);
      taskFieldsChanged.forEach(f => diff.fieldsChanged.add(f));
    }
  }

  // Convert Set to Array for JSON serialization
  diff.fieldsChanged = [...diff.fieldsChanged];

  // Determine if full render is needed
  // Full render required if: tasks added/removed, order changed, or many tasks modified
  if (diff.addedTaskIds.length > 0 ||
      diff.removedTaskIds.length > 0 ||
      diff.taskOrderChanged ||
      diff.changedTaskIds.length > 5) { // Threshold: patch up to 5 tasks, else full render
    diff.requiresFullRender = true;
  }

  return diff;
}
