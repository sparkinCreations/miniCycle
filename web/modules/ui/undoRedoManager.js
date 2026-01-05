/**
 * miniCycle Undo/Redo Manager Module (DI-Pure)
 *
 * State-based undo/redo system with snapshot management.
 * Maintains per-cycle undo stacks with configurable limits.
 *
 * Features:
 * - Snapshot-based state capture
 * - Per-cycle undo/redo stacks
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
 * - Idle-time saves for durability
 * - Minimum interval between snapshots
 *
 * @module ui/undoRedoManager
 * @see {@link file://../../../docs/developer-guides/ARCHITECTURE_OVERVIEW.md} - Architecture
 */

/**
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {Object} UndoRedoStack
 * @property {Schema25Data[]} undoStack - Array of undo snapshots
 * @property {Schema25Data[]} redoStack - Array of redo snapshots
 * @property {number} lastSnapshotTime - Timestamp of last snapshot
 */

import { createDIModule, optional } from '../core/diBase.js';
import { LIMITS, DEBOUNCE } from '../core/constants.js';

// ============ CONSTANTS (from centralized constants.js) ============
const UNDO_LIMIT = LIMITS.UNDO_STACK;
const UNDO_MIN_INTERVAL_MS = DEBOUNCE.UNDO_MIN_INTERVAL;
const UNDO_DB_WRITE_DEBOUNCE_MS = DEBOUNCE.UNDO_DB_WRITE;

// localStorage cache key for instant boot
const UNDO_CACHE_KEY = '__miniCycle_undoCache__';

// ============ LOCALSTORAGE CACHE (for instant boot) ============

/**
 * Save active routine's undo stack to localStorage cache
 * Called on every save for instant boot next time
 * @param {string} cycleId - The cycle ID
 * @param {Array} undoStack - The undo stack
 * @param {Array} redoStack - The redo stack
 */
function saveToUndoCache(cycleId, undoStack, redoStack) {
  if (!cycleId) return;

  try {
    const cacheData = {
      cycleId,
      undoStack: undoStack || [],
      redoStack: redoStack || [],
      timestamp: Date.now()
    };
    localStorage.setItem(UNDO_CACHE_KEY, JSON.stringify(cacheData));
    console.log(`💾 Undo cache saved for "${cycleId}" (${undoStack?.length || 0} undo, ${redoStack?.length || 0} redo)`);
  } catch (e) {
    // Graceful degradation - cache is optional
    console.warn('⚠️ Failed to save undo cache:', e.message);
  }
}

/**
 * Load undo stack from localStorage cache (synchronous, instant)
 * @param {string} expectedCycleId - The cycle ID we expect to find
 * @returns {Object|null} Cache data if found and valid, null otherwise
 */
function loadFromUndoCache(expectedCycleId) {
  if (!expectedCycleId) return null;

  try {
    const cached = localStorage.getItem(UNDO_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);

    // Validate cache matches expected cycle
    if (data.cycleId !== expectedCycleId) {
      console.log(`ℹ️ Undo cache is for different cycle ("${data.cycleId}" vs "${expectedCycleId}")`);
      return null;
    }

    // Validate cache structure
    if (!Array.isArray(data.undoStack) || !Array.isArray(data.redoStack)) {
      console.warn('⚠️ Invalid undo cache structure');
      return null;
    }

    // Filter out any snapshots that don't belong to this cycle
    const validUndoStack = filterValidSnapshots(data.undoStack, expectedCycleId);
    const validRedoStack = filterValidSnapshots(data.redoStack, expectedCycleId);

    console.log(`✅ Loaded undo cache for "${expectedCycleId}" (${validUndoStack.length} undo, ${validRedoStack.length} redo)`);
    return {
      ...data,
      undoStack: validUndoStack,
      redoStack: validRedoStack
    };
  } catch (e) {
    console.warn('⚠️ Failed to load undo cache:', e.message);
    return null;
  }
}

/**
 * Validate a single snapshot belongs to the expected cycle
 * @param {Object} snapshot - The snapshot to validate
 * @param {string} expectedCycleId - The cycle ID it should belong to
 * @returns {boolean} True if valid
 */
function validateSnapshot(snapshot, expectedCycleId) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (!snapshot.activeCycleId) return false;
  if (snapshot.activeCycleId !== expectedCycleId) return false;
  if (!Array.isArray(snapshot.tasks)) return false;
  return true;
}

/**
 * Filter snapshots to only include those belonging to the specified cycle
 * @param {Array} snapshots - Array of snapshots to filter
 * @param {string} cycleId - The cycle ID to filter for
 * @returns {Array} Filtered array of valid snapshots
 */
function filterValidSnapshots(snapshots, cycleId) {
  if (!Array.isArray(snapshots)) return [];
  if (!cycleId) return [];

  const valid = snapshots.filter(snap => validateSnapshot(snap, cycleId));
  const removed = snapshots.length - valid.length;

  if (removed > 0) {
    console.warn(`🧹 Filtered out ${removed} invalid snapshots (wrong cycleId or malformed)`);
  }

  return valid;
}

/**
 * Clear the undo cache (used on cycle deletion or factory reset)
 */
export function clearUndoCache() {
  try {
    localStorage.removeItem(UNDO_CACHE_KEY);
    console.log('🗑️ Undo cache cleared');
  } catch (e) {
    console.warn('⚠️ Failed to clear undo cache:', e.message);
  }
}

// ============ IDLE-TIME SAVE HELPER ============
/**
 * Schedule a state save during idle time for durability without blocking input.
 * Uses requestIdleCallback with setTimeout fallback.
 * Captures AppState reference upfront to avoid repeated proxy gets.
 */
function scheduleIdleSave() {
  // Capture reference now to avoid repeated di.resolve() proxy gets
  const AppState = _deps.AppState;
  if (!AppState?.isReady?.() || !AppState.forceSave) {
    return; // Not ready or missing forceSave - skip silently
  }

  const doSave = () => {
    console.log('💾 Idle-time save after undo/redo');
    AppState.forceSave();
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(doSave, { timeout: 500 });
  } else {
    // Fallback for Safari/older browsers
    setTimeout(doSave, 50);
  }
}

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('UndoRedoManager', {
  appInit: optional(null),
  AppState: optional(null),
  refreshUIFromState: optional(null),
  AppGlobalState: optional(null),
  getElementById: optional(null),
  safeAddEventListener: optional(null),
  showNotification: optional(null),
  // UIOrchestrator for smart UI updates (optional - falls back to refreshUIFromState)
  UIOrchestrator: optional(null)
});

// Late-binding deps via Proxy (standard: _deps with underscore prefix)
// Note: wrapperActive is a mutable instance property, not a DI dep
/** @type {{wrapperActive: boolean, appInit: Object|null, AppState: Object|null, refreshUIFromState: Function|null, AppGlobalState: Object|null, getElementById: Function|null, safeAddEventListener: Function|null, showNotification: Function|null, UIOrchestrator: Object|null}} */
const _deps = new Proxy({ wrapperActive: false }, {
  get(target, prop) {
    // wrapperActive is a mutable instance property, not a DI dep
    if (prop === 'wrapperActive') {
      return target.wrapperActive;
    }
    return di.resolve()[prop];
  },
  set(target, prop, value) {
    // Allow setting wrapperActive
    if (prop === 'wrapperActive') {
      target.wrapperActive = value;
      return true;
    }
    return false;
  }
});

export function setUndoRedoManagerDependencies(overrides = {}) {
  di.setDependencies(overrides);
  console.log('🔄 UndoRedoManager dependencies configured');
}

function assertInjected(name, value) {
  if (value === null || value === undefined) {
    throw new Error(`undoRedoManager: missing required dependency '${name}'. Call setUndoRedoManagerDependencies() first.`);
  }
}

// ============================================================================
// IDEMPOTENCY GUARDS
// ============================================================================

const _initialized = {
  undoRedoUI: false,
  undoRedoKeyboard: false
};

// ============ UI INITIALIZATION ============

/**
 * Wire up undo/redo button event listeners
 * Called once during app initialization
 */
export function wireUndoRedoUI() {
  // ✅ Idempotency guard
  if (_initialized.undoRedoUI) {
    console.log('✅ Undo/redo UI already wired');
    return;
  }
  _initialized.undoRedoUI = true;

  initializeUndoRedoButtons();

  const undoBtn = _deps.getElementById('undo-btn');
  const redoBtn = _deps.getElementById('redo-btn');

  if (!undoBtn || !redoBtn) {
    console.warn('⚠️ Undo/redo buttons not found in DOM - keyboard shortcuts will still work');
    return;
  }

  assertInjected('safeAddEventListener', _deps.safeAddEventListener);

  _deps.safeAddEventListener(undoBtn, 'click', () => performStateBasedUndo());
  _deps.safeAddEventListener(redoBtn, 'click', () => performStateBasedRedo());

  console.log('✅ Undo/redo UI wired');
}

/**
 * Wire up keyboard shortcuts for undo/redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
 * Called once during app initialization
 */
export function wireUndoRedoKeyboardShortcuts() {
  // ✅ Idempotency guard
  if (_initialized.undoRedoKeyboard) {
    console.log('✅ Undo/redo keyboard shortcuts already wired');
    return;
  }
  _initialized.undoRedoKeyboard = true;

  assertInjected('safeAddEventListener', _deps.safeAddEventListener);

  function handleUndoRedoKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      performStateBasedUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault();
      performStateBasedRedo();
    }
  }

  _deps.safeAddEventListener(document, 'keydown', handleUndoRedoKeydown);
  console.log('⌨️ Undo/redo keyboard shortcuts wired (Ctrl+Z, Ctrl+Y)');
}

/**
 * Initialize undo/redo buttons to hidden state
 */
export function initializeUndoRedoButtons() {
  const undoBtn = _deps.getElementById('undo-btn');
  const redoBtn = _deps.getElementById('redo-btn');

  if (undoBtn) {
    undoBtn.hidden = true;
    undoBtn.disabled = true;
  }
  if (redoBtn) {
    redoBtn.hidden = true;
    redoBtn.disabled = true;
  }

  console.log('🔘 Undo/redo buttons initialized (hidden by default)');
}

/**
 * Capture initial snapshot after data loads
 */
export async function captureInitialSnapshot() {
  assertInjected('AppState', _deps.AppState);

  const currentState = _deps.AppState.get();
  if (currentState) {
    console.log('📸 Capturing initial snapshot...');
    await captureStateSnapshot(currentState);
  }
}

// ============ STATE SUBSCRIPTION ============

/**
 * Wrap AppState.update to capture snapshots automatically
 * This centralizes undo snapshot capture on every state update
 * @param {Object} appInit - AppInit module for readiness check
 * @returns {boolean} True if wrapper was installed
 */
export function wrapAppStateForUndo(appInit) {
  assertInjected('AppState', _deps.AppState);
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  // Already wrapped - skip
  if (_deps.AppGlobalState.wrappedAppStateUpdate) {
    console.log('ℹ️ AppState.update already wrapped for undo');
    return false;
  }

  try {
    const AppState = _deps.AppState;
    const globalState = _deps.AppGlobalState;

    // Bind methods to preserve `this`
    const boundUpdate = AppState.update.bind(AppState);
    const boundGet = typeof AppState.get === 'function'
      ? AppState.get.bind(AppState)
      : null;

    // Not async - snapshot capture is synchronous, just pass through the Promise
    AppState.update = (producer, immediate) => {
      try {
        // Capture snapshot before update (if core ready and not during undo/redo)
        if (appInit?.isCoreReady?.() && !globalState?.isPerformingUndoRedo && boundGet) {
          const prev = boundGet();
          if (prev) {
            captureStateSnapshot(prev);
          }
        }
      } catch (e) {
        console.warn('⚠️ Undo snapshot wrapper error:', e);
      }
      // Return the Promise from boundUpdate directly (no await needed)
      return boundUpdate(producer, immediate);
    };

    globalState.wrappedAppStateUpdate = true;
    globalState.useUpdateWrapper = true;  // wrapper becomes single snapshot source
    _deps.wrapperActive = true;  // update internal flag

    console.log('🧰 Undo snapshots centralized on AppState.update');
    return true;
  } catch (e) {
    console.error('❌ Failed to wrap AppState.update:', e);
    return false;
  }
}

/**
 * Set up AppState subscription for automatic snapshots
 */
export function setupStateBasedUndoRedo() {
  assertInjected('AppState', _deps.AppState);

  if (!_deps.AppState.isReady?.()) {
    console.warn('⚠️ State module not ready for undo/redo setup');
    return;
  }

  // Skip installing when wrapper is active
  if (_deps.wrapperActive) {
    console.log('ℹ️ Undo subscriber skipped (wrapper handles snapshots)');
    return;
  }

  try {
    _deps.AppState.subscribe('undo-system', (newState, oldState) => {
      // Runtime guard if wrapper activates later
      if (_deps.wrapperActive) return;

      // Skip during cycle switches
      if (_deps.AppGlobalState.isSwitchingCycles) return;

      if (!_deps.AppGlobalState.isPerformingUndoRedo &&
          oldState?.data?.cycles && newState?.data?.cycles) {
        const activeCycle = newState.appState.activeCycleId;
        if (activeCycle && oldState.data.cycles[activeCycle] && newState.data.cycles[activeCycle]) {
          const oldCycle = oldState.data.cycles[activeCycle];
          const newCycle = newState.data.cycles[activeCycle];

          const tasksChanged = JSON.stringify(oldCycle.tasks) !== JSON.stringify(newCycle.tasks);
          const titleChanged = oldCycle.title !== newCycle.title;
          const settingsChanged = oldCycle.autoReset !== newCycle.autoReset ||
                                  oldCycle.deleteCheckedTasks !== newCycle.deleteCheckedTasks;

          if (tasksChanged || titleChanged || settingsChanged) {
            captureStateSnapshot(oldState);
          }
        }
      }
    });
    console.log('✅ State-based undo/redo system initialized');
  } catch (subscriptionError) {
    console.warn('⚠️ Failed to subscribe to state changes:', subscriptionError);
  }
}

/**
 * Enable undo system on first user interaction
 * Call this when user performs their first action
 */
export function enableUndoSystemOnFirstInteraction() {
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  if (_deps.AppGlobalState.isInitializing) {
    console.log('✅ First user interaction detected - enabling undo system');
    _deps.AppGlobalState.isInitializing = false;
  }
}

// ============ SNAPSHOT MANAGEMENT ============

/**
 * Capture complete state snapshot with deduplication
 */
export function captureStateSnapshot(state) {
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  // Don't capture snapshots during initial app load
  if (_deps.AppGlobalState.isInitializing) {
    console.log('⏭️ Skipping snapshot during initialization');
    return;
  }

  // Don't capture snapshots during cycle switches
  if (_deps.AppGlobalState.isSwitchingCycles) {
    console.log('⏭️ Skipping snapshot during cycle switch');
    return;
  }

  // ✅ FIX #8: Don't capture snapshots during batch operations (reset, complete all)
  if (_deps.AppGlobalState.isResetting) {
    console.log('⏭️ Skipping snapshot during batch reset operation');
    return;
  }

  if (!state?.data?.cycles || !state?.appState?.activeCycleId) {
    console.warn('⚠️ Invalid state for snapshot');
    return;
  }

  const activeCycle = state.appState.activeCycleId;
  const currentCycle = state.data.cycles[activeCycle];
  if (!currentCycle) return;

  // Safety check: Ensure we're tracking the right cycle
  // If activeCycleIdForUndo doesn't match, update it (handles edge cases)
  if (_deps.AppGlobalState.activeCycleIdForUndo &&
      _deps.AppGlobalState.activeCycleIdForUndo !== activeCycle) {
    console.warn(`⚠️ Cycle mismatch: tracking "${_deps.AppGlobalState.activeCycleIdForUndo}" but active is "${activeCycle}". Skipping snapshot.`);
    return;
  }

  const snapshot = {
    activeCycleId: activeCycle,
    tasks: structuredClone(currentCycle.tasks || []),
    recurringTemplates: structuredClone(currentCycle.recurringTemplates || {}),
    title: currentCycle.title || "Untitled miniCycle",
    autoReset: currentCycle.autoReset,
    deleteCheckedTasks: currentCycle.deleteCheckedTasks,
    cycleCount: currentCycle.cycleCount || 0,  // ✅ Include cycle count in snapshot
    timestamp: Date.now()
  };

  // ✅ Build and cache signature once for reuse
  const sig = buildSnapshotSignature(snapshot);
  snapshot._sig = sig;  // Cache on object

  const now = Date.now();

  // Throttle identical snapshots
  if (sig === _deps.AppGlobalState.lastSnapshotSignature &&
      now - _deps.AppGlobalState.lastSnapshotTs < UNDO_MIN_INTERVAL_MS) {
    return;
  }

  // Skip if last on stack is identical (use cached signature if available)
  const last = _deps.AppGlobalState.activeUndoStack.at(-1);
  if (last) {
    const lastSig = last._sig || buildSnapshotSignature(last);
    if (lastSig === sig) return;
  }

  console.log('📸 Capturing snapshot:', {
    taskCount: snapshot.tasks.length,
    title: snapshot.title,
    stackSize: _deps.AppGlobalState.activeUndoStack.length
  });

  _deps.AppGlobalState.activeUndoStack.push(snapshot);
  if (_deps.AppGlobalState.activeUndoStack.length > UNDO_LIMIT) {
    _deps.AppGlobalState.activeUndoStack.shift();
  }

  // Update dedupe trackers
  _deps.AppGlobalState.lastSnapshotSignature = sig;
  _deps.AppGlobalState.lastSnapshotTs = now;

  _deps.AppGlobalState.activeRedoStack = [];
  updateUndoRedoButtons();

  // ✅ Save to IndexedDB (debounced to avoid excessive writes)
  saveUndoStackToIndexedDB(
    activeCycle,
    _deps.AppGlobalState.activeUndoStack,
    _deps.AppGlobalState.activeRedoStack
  );
}

/**
 * Build snapshot signature for comparison
 */
export function buildSnapshotSignature(s) {
  if (!s) return '';
  return JSON.stringify({
    c: s.activeCycleId,
    t: (s.tasks || []).map(t => ({
      id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null
    })),
    ti: s.title || '',
    ar: !!s.autoReset,
    dc: !!s.deleteCheckedTasks
  });
}

/**
 * Analyze what changed between two snapshots
 * Returns a descriptive message like "Task added" or "Task reordered"
 */
function describeChange(fromSnapshot, toSnapshot) {
  if (!fromSnapshot || !toSnapshot) return 'Change';

  const fromTasks = fromSnapshot.tasks || [];
  const toTasks = toSnapshot.tasks || [];

  // Check for cycle changes
  if (fromSnapshot.title !== toSnapshot.title) {
    return 'Cycle renamed';
  }
  if (fromSnapshot.autoReset !== toSnapshot.autoReset) {
    return 'Mode changed';
  }
  if (fromSnapshot.deleteCheckedTasks !== toSnapshot.deleteCheckedTasks) {
    return 'Mode changed';
  }

  // Check task count changes
  const countDiff = toTasks.length - fromTasks.length;
  if (countDiff > 0) {
    return countDiff === 1 ? 'Task added' : `${countDiff} tasks added`;
  }
  if (countDiff < 0) {
    const deleted = Math.abs(countDiff);
    return deleted === 1 ? 'Task deleted' : `${deleted} tasks deleted`;
  }

  // Same count - check for modifications
  const fromTaskMap = new Map(fromTasks.map(t => [t.id, t]));
  const toTaskMap = new Map(toTasks.map(t => [t.id, t]));

  // Check for text changes
  for (const [id, toTask] of toTaskMap) {
    const fromTask = fromTaskMap.get(id);
    if (fromTask && fromTask.text !== toTask.text) {
      return 'Task edited';
    }
  }

  // Check for completion changes
  let completedCount = 0;
  let uncompletedCount = 0;
  for (const [id, toTask] of toTaskMap) {
    const fromTask = fromTaskMap.get(id);
    if (fromTask) {
      if (!fromTask.completed && toTask.completed) completedCount++;
      if (fromTask.completed && !toTask.completed) uncompletedCount++;
    }
  }
  if (completedCount > 0) {
    return completedCount === 1 ? 'Task completed' : `${completedCount} tasks completed`;
  }
  if (uncompletedCount > 0) {
    return uncompletedCount === 1 ? 'Task uncompleted' : `${uncompletedCount} tasks uncompleted`;
  }

  // Check for reordering
  const fromOrder = fromTasks.map(t => t.id).join(',');
  const toOrder = toTasks.map(t => t.id).join(',');
  if (fromOrder !== toOrder) {
    return 'Tasks reordered';
  }

  // Check for priority changes
  for (const [id, toTask] of toTaskMap) {
    const fromTask = fromTaskMap.get(id);
    if (fromTask && fromTask.highPriority !== toTask.highPriority) {
      return 'Priority changed';
    }
  }

  return 'Change';
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

/**
 * Compare two snapshots for equality
 * Uses cached signatures if available for performance
 */
export function snapshotsEqual(a, b) {
  if (!a || !b) return false;

  // ✅ Use cached signatures if available
  if (a._sig && b._sig) {
    return a._sig === b._sig;
  }

  // Fallback to building (shouldn't happen often)
  return buildSnapshotSignature(a) === buildSnapshotSignature(b);
}

// ============ UNDO/REDO OPERATIONS ============

/**
 * Handle UI update after undo/redo using UIOrchestrator if available
 * Falls back to refreshUIFromState for backward compatibility
 * @param {Object} diff - Transaction diff from computeTransactionDiff
 * @param {Object} newState - The new state after undo/redo
 */
function handleUndoRedoUIUpdate(diff, newState) {
  const orchestrator = _deps.UIOrchestrator;

  if (orchestrator?.request) {
    // Use UIOrchestrator for smart updates
    console.log('🎭 Undo/redo using UIOrchestrator:', diff.requiresFullRender ? 'full render' : 'patch');

    if (diff.requiresFullRender) {
      // Full render needed
      orchestrator.request({
        tasks: { type: 'full' },
        progress: true,
        stats: true,
        completeAllButton: true,
        arrows: true,
        mainMenuHeader: diff.cycleChanged
      });
    } else {
      // Patch only changed tasks
      orchestrator.request({
        tasks: {
          type: 'patch',
          taskIds: diff.changedTaskIds,
          changedFields: diff.fieldsChanged
        },
        progress: true,
        stats: true,
        completeAllButton: true
      });
    }
  } else {
    // Fallback to refreshUIFromState
    console.log('🔄 Undo/redo using refreshUIFromState (UIOrchestrator not available)');
    _deps.refreshUIFromState(newState);
  }
}

/**
 * Perform undo operation
 */
export async function performStateBasedUndo() {
  assertInjected('AppState', _deps.AppState);
  assertInjected('AppGlobalState', _deps.AppGlobalState);
  assertInjected('refreshUIFromState', _deps.refreshUIFromState);

  if (_deps.AppGlobalState.activeUndoStack.length === 0) {
    console.warn('⚠️ Nothing to undo');
    return;
  }

  if (!_deps.AppState.isReady?.()) {
    console.warn('⚠️ AppState not ready');
    return;
  }

  _deps.AppGlobalState.isPerformingUndoRedo = true;

  // ✅ Create rollback points
  const rollbackState = structuredClone(_deps.AppState.get());
  const rollbackUndoStack = [..._deps.AppGlobalState.activeUndoStack];
  const rollbackRedoStack = [..._deps.AppGlobalState.activeRedoStack];

  try {
    const currentState = _deps.AppState.get();
    const currentActive = currentState.appState.activeCycleId;
    const currentCycle = currentState.data.cycles[currentActive];

    const currentSnapshot = {
      activeCycleId: currentActive,
      tasks: structuredClone(currentCycle?.tasks || []),
      recurringTemplates: structuredClone(currentCycle?.recurringTemplates || {}),
      title: currentCycle?.title,
      autoReset: currentCycle?.autoReset,
      deleteCheckedTasks: currentCycle?.deleteCheckedTasks,
      cycleCount: currentCycle?.cycleCount || 0,  // ✅ Include cycle count
      timestamp: Date.now()
    };

    let snap = null;
    let skippedDuplicates = 0;
    while (_deps.AppGlobalState.activeUndoStack.length) {
      const candidate = _deps.AppGlobalState.activeUndoStack.pop();
      if (!snapshotsEqual(candidate, currentSnapshot)) {
        snap = candidate;
        break;
      }
      skippedDuplicates++;
    }
    console.log(`🔍 Undo: skipped ${skippedDuplicates} duplicates, found snapshot:`, !!snap);
    if (!snap) {
      console.warn('⚠️ No valid undo snapshot found');
      updateUndoRedoButtons();
      return;
    }

    _deps.AppGlobalState.activeRedoStack.push(currentSnapshot);

    // Compute transaction diff BEFORE applying state change
    const transactionDiff = computeTransactionDiff(currentSnapshot, snap);
    transactionDiff.kind = 'undo';

    // Use non-immediate save for better UI latency (persistence via debounce)
    // NOTE: Undo NEVER switches cycles - each routine has isolated undo history
    await _deps.AppState.update(state => {
      const cid = state.appState.activeCycleId;  // Always use current cycle
      const cycle = state.data.cycles[cid] || (state.data.cycles[cid] = {});
      cycle.tasks = structuredClone(snap.tasks || []);
      cycle.recurringTemplates = structuredClone(snap.recurringTemplates || {});
      if (snap.title) cycle.title = snap.title;
      if ('autoReset' in snap) cycle.autoReset = snap.autoReset;
      if ('deleteCheckedTasks' in snap) cycle.deleteCheckedTasks = snap.deleteCheckedTasks;
      if ('cycleCount' in snap) cycle.cycleCount = snap.cycleCount;  // ✅ Restore cycle count
    }, false);

    // Use UIOrchestrator if available, otherwise fall back to refreshUIFromState
    handleUndoRedoUIUpdate(transactionDiff, _deps.AppState.get());

    updateUndoRedoButtons();

    // ✅ Save updated stacks to IndexedDB (async, doesn't block UI)
    // Use current cycle (undo never switches cycles)
    const activeAfterUndo = currentActive;
    if (activeAfterUndo) {
      saveUndoStackToIndexedDB(
        activeAfterUndo,
        _deps.AppGlobalState.activeUndoStack,
        _deps.AppGlobalState.activeRedoStack
      );
    }

    // ✅ Schedule idle-time save for durability (doesn't block input)
    scheduleIdleSave();

    // ✅ Show success notification
    if (_deps.showNotification) {
      const changeDesc = transactionDiff.description;
      const stepsLeft = _deps.AppGlobalState.activeUndoStack.length;
      const stepsText = stepsLeft === 0 ? 'no steps left' :
                        stepsLeft === 1 ? '1 step left' :
                        `${stepsLeft} steps left`;
      _deps.showNotification(`↩️ Undone: ${changeDesc} (${stepsText})`, 'success', 2000);
    }

    console.log('✅ Undo completed');
  } catch (e) {
    console.error('❌ Undo failed, rolling back:', e);

    // ✅ Rollback on failure
    try {
      await _deps.AppState.set(rollbackState);
      _deps.AppGlobalState.activeUndoStack = rollbackUndoStack;
      _deps.AppGlobalState.activeRedoStack = rollbackRedoStack;
      updateUndoRedoButtons();

      if (_deps.showNotification) {
        _deps.showNotification('⚠️ Undo failed - state restored', 'error', 3000);
      }
    } catch (rollbackError) {
      console.error('❌ Rollback also failed:', rollbackError);
    }

    throw e; // Re-throw so caller knows it failed
  } finally {
    _deps.AppGlobalState.isPerformingUndoRedo = false;
  }
}

/**
 * Perform redo operation
 */
export async function performStateBasedRedo() {
  assertInjected('AppState', _deps.AppState);
  assertInjected('AppGlobalState', _deps.AppGlobalState);
  assertInjected('refreshUIFromState', _deps.refreshUIFromState);

  if (_deps.AppGlobalState.activeRedoStack.length === 0) {
    console.warn('⚠️ Nothing to redo');
    return;
  }

  if (!_deps.AppState.isReady?.()) {
    console.warn('⚠️ AppState not ready');
    return;
  }

  _deps.AppGlobalState.isPerformingUndoRedo = true;

  // ✅ Create rollback points
  const rollbackState = structuredClone(_deps.AppState.get());
  const rollbackUndoStack = [..._deps.AppGlobalState.activeUndoStack];
  const rollbackRedoStack = [..._deps.AppGlobalState.activeRedoStack];

  try {
    const currentState = _deps.AppState.get();
    const currentActive = currentState.appState.activeCycleId;
    const currentCycle = currentState.data.cycles[currentActive];

    const currentSnapshot = {
      activeCycleId: currentActive,
      tasks: structuredClone(currentCycle?.tasks || []),
      recurringTemplates: structuredClone(currentCycle?.recurringTemplates || {}),
      title: currentCycle?.title,
      autoReset: currentCycle?.autoReset,
      deleteCheckedTasks: currentCycle?.deleteCheckedTasks,
      cycleCount: currentCycle?.cycleCount || 0,  // ✅ Include cycle count
      timestamp: Date.now()
    };

    let snap = null;
    let skippedDuplicates = 0;
    while (_deps.AppGlobalState.activeRedoStack.length) {
      const candidate = _deps.AppGlobalState.activeRedoStack.pop();
      if (!snapshotsEqual(candidate, currentSnapshot)) {
        snap = candidate;
        break;
      }
      skippedDuplicates++;
    }
    console.log(`🔍 Redo: skipped ${skippedDuplicates} duplicates, found snapshot:`, !!snap);
    if (!snap) {
      console.warn('⚠️ No valid redo snapshot found');
      updateUndoRedoButtons();
      return;
    }

    _deps.AppGlobalState.activeUndoStack.push(currentSnapshot);

    // Compute transaction diff BEFORE applying state change
    const transactionDiff = computeTransactionDiff(currentSnapshot, snap);
    transactionDiff.kind = 'redo';

    // Use non-immediate save for better UI latency (persistence via debounce)
    // NOTE: Redo NEVER switches cycles - each routine has isolated undo history
    await _deps.AppState.update(state => {
      const cid = state.appState.activeCycleId;  // Always use current cycle
      const cycle = state.data.cycles[cid] || (state.data.cycles[cid] = {});
      cycle.tasks = structuredClone(snap.tasks || []);
      cycle.recurringTemplates = structuredClone(snap.recurringTemplates || {});
      if (snap.title) cycle.title = snap.title;
      if ('autoReset' in snap) cycle.autoReset = snap.autoReset;
      if ('deleteCheckedTasks' in snap) cycle.deleteCheckedTasks = snap.deleteCheckedTasks;
      if ('cycleCount' in snap) cycle.cycleCount = snap.cycleCount;  // ✅ Restore cycle count
    }, false);

    // Use UIOrchestrator if available, otherwise fall back to refreshUIFromState
    handleUndoRedoUIUpdate(transactionDiff, _deps.AppState.get());

    updateUndoRedoButtons();

    // ✅ Save updated stacks to IndexedDB (async, doesn't block UI)
    // Use current cycle (redo never switches cycles)
    const activeAfterRedo = currentActive;
    if (activeAfterRedo) {
      saveUndoStackToIndexedDB(
        activeAfterRedo,
        _deps.AppGlobalState.activeUndoStack,
        _deps.AppGlobalState.activeRedoStack
      );
    }

    // ✅ Schedule idle-time save for durability (doesn't block input)
    scheduleIdleSave();

    // ✅ Show success notification
    if (_deps.showNotification) {
      const changeDesc = transactionDiff.description;
      const stepsLeft = _deps.AppGlobalState.activeRedoStack.length;
      const stepsText = stepsLeft === 0 ? 'no steps left' :
                        stepsLeft === 1 ? '1 step left' :
                        `${stepsLeft} steps left`;
      _deps.showNotification(`↪️ Redone: ${changeDesc} (${stepsText})`, 'success', 2000);
    }

    console.log('✅ Redo completed');
  } catch (e) {
    console.error('❌ Redo failed, rolling back:', e);

    // ✅ Rollback on failure
    try {
      await _deps.AppState.set(rollbackState);
      _deps.AppGlobalState.activeUndoStack = rollbackUndoStack;
      _deps.AppGlobalState.activeRedoStack = rollbackRedoStack;
      updateUndoRedoButtons();

      if (_deps.showNotification) {
        _deps.showNotification('⚠️ Redo failed - state restored', 'error', 3000);
      }
    } catch (rollbackError) {
      console.error('❌ Rollback also failed:', rollbackError);
    }

    throw e; // Re-throw so caller knows it failed
  } finally {
    _deps.AppGlobalState.isPerformingUndoRedo = false;
  }
}

// ============ UI UPDATES ============

/**
 * Update undo/redo button enabled/disabled states
 */
export function updateUndoRedoButtonStates() {
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  const undoBtn = _deps.getElementById('undo-btn');
  const redoBtn = _deps.getElementById('redo-btn');

  // Use actual stack lengths (instant with localStorage cache)
  const hasUndo = _deps.AppGlobalState.activeUndoStack.length > 0;
  const hasRedo = _deps.AppGlobalState.activeRedoStack.length > 0;

  if (undoBtn) {
    undoBtn.disabled = !hasUndo;
    undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
  }
  if (redoBtn) {
    redoBtn.disabled = !hasRedo;
    redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
  }

  console.log(`🔘 Button states: hasUndo=${hasUndo} disabled=${undoBtn?.disabled}, hasRedo=${hasRedo} disabled=${redoBtn?.disabled}`);
}

/**
 * Update undo/redo button visibility
 */
export function updateUndoRedoButtonVisibility() {
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  const undoBtn = _deps.getElementById('undo-btn');
  const redoBtn = _deps.getElementById('redo-btn');

  // Use actual stack lengths (instant with localStorage cache)
  const hasUndo = _deps.AppGlobalState.activeUndoStack.length > 0;
  const hasRedo = _deps.AppGlobalState.activeRedoStack.length > 0;

  if (undoBtn) undoBtn.hidden = !hasUndo;
  if (redoBtn) redoBtn.hidden = !hasRedo;

  console.log(`👁️ Button visibility: undo hidden=${undoBtn?.hidden}, redo hidden=${redoBtn?.hidden}`);
}

/**
 * Update undo/redo button states and visibility (convenience wrapper)
 */
export function updateUndoRedoButtons() {
  updateUndoRedoButtonStates();
  updateUndoRedoButtonVisibility();
}

// ============ CYCLE LIFECYCLE INTEGRATION ============

/**
 * Handle cycle switch - save current, load new
 * Called by cycleSwitcher when user switches cycles
 */
export async function onCycleSwitched(newCycleId) {
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  const oldCycleId = _deps.AppGlobalState.activeCycleIdForUndo;

  if (oldCycleId === newCycleId) {
    console.log('ℹ️ Same cycle, no undo stack swap needed');
    return;
  }

  console.log(`🔄 Switching undo context: "${oldCycleId}" → "${newCycleId}"`);

  // ✅ Set flag to block snapshot capture during transition
  _deps.AppGlobalState.isSwitchingCycles = true;

  try {
    // 1. Save OLD cycle's stacks to IndexedDB (skip cache)
    if (oldCycleId && _deps.AppGlobalState.activeUndoStack.length > 0) {
      saveUndoStackToIndexedDB(
        oldCycleId,
        _deps.AppGlobalState.activeUndoStack,
        _deps.AppGlobalState.activeRedoStack,
        { skipCache: true }
      );
    }

    // 2. Clear everything FIRST - undo stack, active ID, and cache
    _deps.AppGlobalState.activeUndoStack = [];
    _deps.AppGlobalState.activeRedoStack = [];
    _deps.AppGlobalState.activeCycleIdForUndo = null;
    clearUndoCache();
    console.log('🧹 Cleared undo stack, active ID, and cache');

    // 3. Load new cycle's stacks from IndexedDB
    const loaded = await loadUndoStackFromIndexedDB(newCycleId);

    // 4. Validate loaded data (wait for validation to complete)
    const validUndoStack = filterValidSnapshots(loaded.undoStack || [], newCycleId);
    const validRedoStack = filterValidSnapshots(loaded.redoStack || [], newCycleId);

    // 5. NOW set the active ID and populate stacks (after validation)
    _deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
    _deps.AppGlobalState.activeUndoStack = validUndoStack;
    _deps.AppGlobalState.activeRedoStack = validRedoStack;

    // 6. Save validated data to cache for instant boot
    console.log(`📦 Updating cache with validated data for "${newCycleId}"`);
    saveToUndoCache(newCycleId, validUndoStack, validRedoStack);

    // 7. Update UI
    updateUndoRedoButtons();

    console.log(`✅ Switched to "${newCycleId}": ${validUndoStack.length} undo, ${validRedoStack.length} redo steps`);

    // ✅ Small delay to let cycle fully load before re-enabling snapshots
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (e) {
    console.error('❌ Cycle switch failed:', e);

    // On error: clear everything and start fresh for new cycle
    _deps.AppGlobalState.activeUndoStack = [];
    _deps.AppGlobalState.activeRedoStack = [];
    _deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
    clearUndoCache();
    updateUndoRedoButtons();

    if (_deps.showNotification) {
      _deps.showNotification('⚠️ Undo history unavailable for this cycle', 'warning', 3000);
    }
  } finally {
    // ✅ Always clear the flag, even on error
    _deps.AppGlobalState.isSwitchingCycles = false;
    console.log('🔓 Cycle switch complete, snapshots re-enabled');
  }
}

/**
 * Handle cycle creation - initialize empty stacks
 * Called by cycleManager when new cycle is created
 */
export async function onCycleCreated(cycleId) {
  console.log(`🆕 New cycle created: "${cycleId}" - initializing empty undo stack`);

  try {
    // Initialize empty stacks in IndexedDB (also updates cache)
    await saveUndoStackToIndexedDB(cycleId, [], []);

    // Set as active cycle for undo and clear in-memory stacks
    // (newly created cycles immediately become active)
    _deps.AppGlobalState.activeCycleIdForUndo = cycleId;
    _deps.AppGlobalState.activeUndoStack = [];
    _deps.AppGlobalState.activeRedoStack = [];
    updateUndoRedoButtons();
  } catch (e) {
    // ✅ FIX #5: Error boundary for cycle creation
    console.error('❌ Failed to initialize undo stack for new cycle:', e);

    // Still set up empty stacks in memory even if IndexedDB fails
    _deps.AppGlobalState.activeCycleIdForUndo = cycleId;
    _deps.AppGlobalState.activeUndoStack = [];
    _deps.AppGlobalState.activeRedoStack = [];
    updateUndoRedoButtons();

    // Don't notify user - this is an internal operation
  }
}

/**
 * Handle cycle deletion - cleanup IndexedDB and cache
 * Called by cycleManager when cycle is deleted
 */
export async function onCycleDeleted(cycleId) {
  console.log(`🗑️ Cycle deleted: "${cycleId}" - removing undo history`);

  try {
    // Remove from IndexedDB
    await deleteUndoStackFromIndexedDB(cycleId);

    // If this was the active cycle, clear memory and cache
    if (_deps.AppGlobalState.activeCycleIdForUndo === cycleId) {
      _deps.AppGlobalState.activeUndoStack = [];
      _deps.AppGlobalState.activeRedoStack = [];
      _deps.AppGlobalState.activeCycleIdForUndo = null;
      clearUndoCache(); // Clear localStorage cache
      updateUndoRedoButtons();
    }
  } catch (e) {
    // ✅ FIX #5: Error boundary for cycle deletion
    console.error('❌ Failed to delete undo stack:', e);

    // Still clean up memory even if IndexedDB fails
    if (_deps.AppGlobalState.activeCycleIdForUndo === cycleId) {
      _deps.AppGlobalState.activeUndoStack = [];
      _deps.AppGlobalState.activeRedoStack = [];
      _deps.AppGlobalState.activeCycleIdForUndo = null;
      clearUndoCache(); // Clear localStorage cache
      updateUndoRedoButtons();
    }

    // Don't notify user - this is an internal cleanup operation
  }
}

/**
 * Handle cycle rename - migrate IndexedDB entry
 * Called by cycleSwitcher when cycle is renamed
 */
export async function onCycleRenamed(oldCycleId, newCycleId) {
  console.log(`📝 Cycle renamed: "${oldCycleId}" → "${newCycleId}"`);

  try {
    // Migrate in IndexedDB
    await renameUndoStackInIndexedDB(oldCycleId, newCycleId);

    // Update in-memory tracking
    if (_deps.AppGlobalState.activeCycleIdForUndo === oldCycleId) {
      _deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
    }
  } catch (e) {
    // ✅ FIX #5: Error boundary for cycle rename
    console.error('❌ Failed to rename undo stack:', e);

    // Still update in-memory tracking even if IndexedDB fails
    if (_deps.AppGlobalState.activeCycleIdForUndo === oldCycleId) {
      _deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
    }

    // Don't notify user - this is an internal operation
  }
}

/**
 * Initialize undo system for app startup
 * Uses localStorage cache for instant boot, IndexedDB loads in background for cycle switching
 */
export async function initializeUndoSystemForApp() {
  assertInjected('AppState', _deps.AppState);
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  console.log('🔄 Initializing undo system...');

  try {
    // 1. Get current active cycle
    const currentState = _deps.AppState.get();
    const activeCycleId = currentState?.appState?.activeCycleId;

    if (!activeCycleId) {
      // ✅ Normal during Phase 2 - data loads in Phase 3
      console.log('ℹ️ No active cycle yet - undo system will initialize after data loads');
      return;
    }

    // 2. Try localStorage cache first (sync, instant!)
    const cached = loadFromUndoCache(activeCycleId);
    if (cached) {
      // Cache hit! Populate stacks instantly
      _deps.AppGlobalState.activeUndoStack = cached.undoStack;
      _deps.AppGlobalState.activeRedoStack = cached.redoStack;
      _deps.AppGlobalState.activeCycleIdForUndo = activeCycleId;
      updateUndoRedoButtons();
      console.log(`✅ Undo system initialized from cache (instant)`);
    } else {
      // Cache miss - will load from IndexedDB
      _deps.AppGlobalState.activeUndoStack = [];
      _deps.AppGlobalState.activeRedoStack = [];
      _deps.AppGlobalState.activeCycleIdForUndo = activeCycleId;
      console.log('ℹ️ No cache found, will load from IndexedDB');
    }

    // 3. Initialize IndexedDB in background (for cycle switching and persistence)
    // If we had a cache hit, this just sets up the connection
    // If cache miss, we load from IndexedDB and update stacks
    initializeUndoIndexedDB().then(async () => {
      if (!cached) {
        // Cache miss - load from IndexedDB
        const loaded = await loadUndoStackFromIndexedDB(activeCycleId);
        _deps.AppGlobalState.activeUndoStack = loaded.undoStack || [];
        _deps.AppGlobalState.activeRedoStack = loaded.redoStack || [];
        updateUndoRedoButtons();

        // Update cache for next boot
        saveToUndoCache(activeCycleId, loaded.undoStack || [], loaded.redoStack || []);
        console.log(`✅ Undo system loaded from IndexedDB (${loaded.undoStack?.length || 0} undo steps)`);
      }
    }).catch(e => {
      console.warn('⚠️ IndexedDB background init failed:', e);
    });

    // 4. Update UI with whatever we have so far
    updateUndoRedoButtons();

    // 5. Set up page unload handler to force immediate save
    window.addEventListener('beforeunload', () => {
      // Clear debounce timeout and save immediately
      if (dbWriteTimeout) {
        clearTimeout(dbWriteTimeout);
        dbWriteTimeout = null;
      }

      const cycleId = _deps.AppGlobalState.activeCycleIdForUndo;
      const undoStack = _deps.AppGlobalState.activeUndoStack || [];
      const redoStack = _deps.AppGlobalState.activeRedoStack || [];

      // Always save to cache on unload (instant for next boot)
      saveToUndoCache(cycleId, undoStack, redoStack);

      // Also save to IndexedDB if available
      if (cycleId && undoDB) {
        try {
          const transaction = undoDB.transaction(["undoStacks"], "readwrite");
          const objectStore = transaction.objectStore("undoStacks");

          const data = {
            cycleId,
            undoStack,
            redoStack,
            lastUpdated: Date.now(),
            version: "1.344"
          };

          objectStore.put(data);
          console.log('💾 Force-saved undo history on page unload');
        } catch (e) {
          console.warn('⚠️ Failed to force-save undo history:', e);
        }
      }
    });

  } catch (e) {
    // ✅ FIX #5: Error boundary for undo system initialization
    console.error('❌ Undo system initialization failed:', e);

    // Initialize with empty stacks to ensure app still works
    _deps.AppGlobalState.activeUndoStack = [];
    _deps.AppGlobalState.activeRedoStack = [];
    updateUndoRedoButtons();

    if (_deps.showNotification) {
      _deps.showNotification('⚠️ Undo history unavailable', 'warning', 3000);
    }
  }
}

// ============ INDEXEDDB PERSISTENCE ============

let undoDB = null;  // Database connection
let dbWriteTimeout = null;  // Debounce timer

/**
 * Check if test mode flag is active (tests are running)
 * If active, skip IndexedDB restoration to avoid loading test data
 * @returns {Promise<boolean>} True if test mode is active
 */
async function isTestModeActive() {
  try {
    return new Promise((resolve) => {
      // Timeout to prevent indefinite hangs
      const timeout = setTimeout(() => {
        console.warn('⚠️ isTestModeActive timed out');
        resolve(false);
      }, 3000);

      const request = indexedDB.open('miniCycleTestResultsDB', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('results')) {
          db.createObjectStore('results', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        clearTimeout(timeout);
        const db = request.result;
        try {
          const tx = db.transaction('results', 'readonly');
          const store = tx.objectStore('results');
          const getRequest = store.get('testModeActive');
          getRequest.onsuccess = () => {
            const data = getRequest.result;
            db.close();
            if (data && data.active) {
              // Only consider active if set within last 10 minutes
              if (Date.now() - data.timestamp < 600000) {
                console.log('🚦 Test mode active - skipping IndexedDB restore');
                resolve(true);
                return;
              }
            }
            resolve(false);
          };
          getRequest.onerror = () => {
            db.close();
            resolve(false);
          };
        } catch (e) {
          db.close();
          resolve(false);
        }
      };
      request.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      request.onblocked = () => {
        clearTimeout(timeout);
        console.warn('⚠️ isTestModeActive IndexedDB blocked');
        resolve(false);
      };
    });
  } catch (e) {
    return false;
  }
}

/**
 * Initialize IndexedDB for undo history persistence
 * Gracefully degrades if IndexedDB unavailable (private browsing)
 */
export async function initializeUndoIndexedDB() {
  try {
    return new Promise((resolve, reject) => {
      // Timeout to prevent indefinite hangs
      const timeout = setTimeout(() => {
        console.warn('⚠️ initializeUndoIndexedDB timed out');
        undoDB = null;
        resolve(false);
      }, 5000);

      const request = indexedDB.open("miniCycleUndoHistory", 1);

      request.onerror = () => {
        clearTimeout(timeout);
        console.warn('⚠️ IndexedDB unavailable - undo limited to session only');
        undoDB = null;
        resolve(false);
      };

      request.onsuccess = (event) => {
        clearTimeout(timeout);
        undoDB = event.target.result;
        console.log('✅ IndexedDB undo persistence enabled');
        resolve(true);
      };

      request.onblocked = () => {
        clearTimeout(timeout);
        console.warn('⚠️ IndexedDB blocked - undo limited to session only');
        undoDB = null;
        resolve(false);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains("undoStacks")) {
          const objectStore = db.createObjectStore("undoStacks", { keyPath: "cycleId" });
          console.log('🔧 Created undoStacks object store');
        }
      };
    });
  } catch (e) {
    console.warn('⚠️ IndexedDB initialization failed:', e);
    undoDB = null;
    return false;
  }
}

/**
 * Save undo/redo stacks to both localStorage cache (immediate) and IndexedDB (debounced)
 */
export function saveUndoStackToIndexedDB(cycleId, undoStack, redoStack, options = {}) {
  if (!cycleId) return;

  // Save to localStorage cache unless explicitly skipped (e.g., during cycle switching)
  if (!options.skipCache) {
    saveToUndoCache(cycleId, undoStack, redoStack);
  }

  // Graceful degradation if IndexedDB unavailable
  if (!undoDB) return;

  // Debounce IndexedDB writes
  if (dbWriteTimeout) {
    clearTimeout(dbWriteTimeout);
  }

  dbWriteTimeout = setTimeout(async () => {
    try {
      const transaction = undoDB.transaction(["undoStacks"], "readwrite");
      const objectStore = transaction.objectStore("undoStacks");

      const data = {
        cycleId,
        undoStack: undoStack || [],
        redoStack: redoStack || [],
        lastUpdated: Date.now(),
        version: "1.344"
      };

      const request = objectStore.put(data);

      // ✅ FIX #11: Properly await IndexedDB operation
      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log(`💾 Saved undo history for "${cycleId}" (${undoStack?.length || 0} undo, ${redoStack?.length || 0} redo)`);
          resolve();
        };

        request.onerror = () => {
          console.warn(`⚠️ Failed to save undo history for "${cycleId}"`);
          reject(request.error);
        };
      });
    } catch (e) {
      console.error('❌ IndexedDB write failed:', e);

      // ✅ FIX #11: Handle quota exceeded errors
      if (e.name === 'QuotaExceededError') {
        console.error('💾 Storage quota exceeded - undo history not saved');
        if (_deps.showNotification) {
          _deps.showNotification(
            '⚠️ Storage full - undo history not saved. Consider exporting your data.',
            'warning',
            5000
          );
        }
      }
    }
  }, UNDO_DB_WRITE_DEBOUNCE_MS);
}

/**
 * Load undo/redo stacks from IndexedDB
 * Skips restoration if test mode is active to prevent loading test data
 */
export async function loadUndoStackFromIndexedDB(cycleId) {
  // 🚦 Skip IndexedDB restore if tests are running
  if (await isTestModeActive()) {
    console.log(`🚦 Test mode active - returning empty undo history for "${cycleId}"`);
    return { undoStack: [], redoStack: [] };
  }

  if (!undoDB) {
    return { undoStack: [], redoStack: [] };  // Graceful degradation
  }
  if (!cycleId) {
    return { undoStack: [], redoStack: [] };
  }

  try {
    return new Promise((resolve) => {
      // Timeout to prevent indefinite hangs
      const timeout = setTimeout(() => {
        console.warn(`⚠️ loadUndoStackFromIndexedDB timed out for "${cycleId}"`);
        resolve({ undoStack: [], redoStack: [] });
      }, 5000);

      const transaction = undoDB.transaction(["undoStacks"], "readonly");
      const objectStore = transaction.objectStore("undoStacks");
      const request = objectStore.get(cycleId);

      request.onsuccess = (event) => {
        clearTimeout(timeout);
        const data = event.target.result;
        if (data) {
          console.log(`📂 Loaded undo history for "${cycleId}" (${data.undoStack?.length || 0} undo, ${data.redoStack?.length || 0} redo)`);
          resolve({
            undoStack: data.undoStack || [],
            redoStack: data.redoStack || []
          });
        } else {
          console.log(`📂 No undo history found for "${cycleId}" - starting fresh`);
          resolve({ undoStack: [], redoStack: [] });
        }
      };

      request.onerror = () => {
        clearTimeout(timeout);
        console.warn(`⚠️ Failed to load undo history for "${cycleId}"`);
        resolve({ undoStack: [], redoStack: [] });
      };
    });
  } catch (e) {
    console.warn('⚠️ IndexedDB read error:', e);
    return { undoStack: [], redoStack: [] };
  }
}

/**
 * Delete undo/redo stacks from IndexedDB
 */
export async function deleteUndoStackFromIndexedDB(cycleId) {
  if (!undoDB) return;
  if (!cycleId) return;

  try {
    const transaction = undoDB.transaction(["undoStacks"], "readwrite");
    const objectStore = transaction.objectStore("undoStacks");
    const request = objectStore.delete(cycleId);

    // ✅ FIX #11: Properly await IndexedDB operation
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log(`🗑️ Deleted undo history for "${cycleId}"`);
        resolve();
      };

      request.onerror = () => {
        console.warn(`⚠️ Failed to delete undo history for "${cycleId}"`);
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('❌ IndexedDB delete failed:', e);
  }
}

/**
 * Rename cycle's undo/redo stacks in IndexedDB
 */
export async function renameUndoStackInIndexedDB(oldCycleId, newCycleId) {
  if (!undoDB) return;
  if (!oldCycleId || !newCycleId) return;

  try {
    // Load old data
    const oldData = await loadUndoStackFromIndexedDB(oldCycleId);

    // Save under new key
    const transaction = undoDB.transaction(["undoStacks"], "readwrite");
    const objectStore = transaction.objectStore("undoStacks");

    const newData = {
      cycleId: newCycleId,
      undoStack: oldData.undoStack,
      redoStack: oldData.redoStack,
      lastUpdated: Date.now(),
      version: "1.344"
    };

    // ✅ FIX #11: Properly await IndexedDB operations
    const putRequest = objectStore.put(newData);
    await new Promise((resolve, reject) => {
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });

    // Delete old key
    const deleteRequest = objectStore.delete(oldCycleId);
    await new Promise((resolve, reject) => {
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });

    console.log(`📝 Renamed undo history: "${oldCycleId}" → "${newCycleId}"`);
  } catch (e) {
    console.error('❌ IndexedDB rename failed:', e);
  }
}

/**
 * Clear all undo history from IndexedDB (factory reset)
 */
export async function clearAllUndoHistoryFromIndexedDB() {
  if (!undoDB) return;

  try {
    const transaction = undoDB.transaction(["undoStacks"], "readwrite");
    const objectStore = transaction.objectStore("undoStacks");
    const request = objectStore.clear();

    // ✅ FIX #11: Properly await IndexedDB operation
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('🧹 Cleared all undo history from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.warn('⚠️ Failed to clear undo history');
        reject(request.error);
      };
    });
  } catch (e) {
    console.warn('⚠️ IndexedDB clear error:', e);
  }
}

// ============ INIT FUNCTION (for moduleLoader) ============

/**
 * Initialize UndoRedoManager (called by moduleLoader)
 * @param {Object} dependencies - Injected dependencies
 * @returns {Object} Module exports for registration
 */
export async function initUndoRedoManager(dependencies = {}) {
  // Set dependencies
  setUndoRedoManagerDependencies(dependencies);

  // Wrap AppState for undo tracking (if appInit is available)
  if (dependencies.appInit) {
    wrapAppStateForUndo(dependencies.appInit);
  }

  // Wire up undo/redo button event listeners
  wireUndoRedoUI();

  // Wire up keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  wireUndoRedoKeyboardShortcuts();

  // Setup state-based undo/redo system
  setupStateBasedUndoRedo();

  // Initialize undo system for the app
  await initializeUndoSystemForApp();

  console.log('✅ UndoRedoManager initialized via initUndoRedoManager');

  // Return exports for registration
  return {
    performStateBasedUndo,
    performStateBasedRedo,
    captureStateSnapshot,
    updateUndoRedoButtons,
    enableUndoSystemOnFirstInteraction,
    wireUndoRedoUI,
    wireUndoRedoKeyboardShortcuts,
    wrapAppStateForUndo,
    setupStateBasedUndoRedo,
    initializeUndoSystemForApp,
    // Cache helpers
    clearUndoCache
  };
}

// ============ EXPORTS ============

console.log('🔄 UndoRedoManager module loaded');
