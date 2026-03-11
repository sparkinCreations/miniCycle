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
import { getLabel } from '../labels/labelResolver.js';
import { LIMITS, DEBOUNCE, DOM_IDS, APP_VERSION, UI_TIMEOUTS } from '../core/constants.js';

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
 * Get the size in bytes of the undo cache for the active routine
 * Reads directly from localStorage - synchronous and fast
 * @returns {number} Size in bytes, or 0 if no cache exists
 */
export function getUndoCacheSizeBytes() {
  try {
    const cached = localStorage.getItem(UNDO_CACHE_KEY);
    if (!cached) return 0;
    // Return the actual string length (approximately bytes in UTF-8 for ASCII)
    return cached.length;
  } catch (e) {
    console.warn('⚠️ Failed to get undo cache size:', e.message);
    return 0;
  }
}

/**
 * Get the cycle ID that the current undo cache belongs to
 * @returns {string|null} The cycle ID or null if no cache
 */
export function getUndoCacheCycleId() {
  try {
    const cached = localStorage.getItem(UNDO_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    return data.cycleId || null;
  } catch (e) {
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

// Known valid theme IDs (avoids importing side-effectful themes.js)
const VALID_THEME_IDS = new Set(['classic', 'habit-tracker', 'fitness', 'scholar', 'cleaning']);

/**
 * Sanitize a snapshot before restoring to prevent corrupted data from entering state.
 * Clamps numeric fields, validates task entries, and normalizes theme IDs.
 * @param {Object} snapshot - The snapshot to sanitize
 * @returns {Object} The sanitized snapshot (mutated in place for efficiency)
 */
function sanitizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;

  // Clamp cycleCount to non-negative integer
  if ('cycleCount' in snapshot) {
    const cc = snapshot.cycleCount;
    snapshot.cycleCount = (Number.isFinite(cc) && cc >= 0) ? Math.floor(cc) : 0;
  }

  // Validate theme is a known ID
  if ('theme' in snapshot) {
    if (!VALID_THEME_IDS.has(snapshot.theme)) {
      snapshot.theme = 'classic';
    }
  }

  // Sanitize clearedTasks
  if (snapshot.clearedTasks && typeof snapshot.clearedTasks === 'object') {
    const tc = snapshot.clearedTasks.totalCleared;
    snapshot.clearedTasks.totalCleared = (Number.isFinite(tc) && tc >= 0) ? Math.floor(tc) : 0;
    if (!Array.isArray(snapshot.clearedTasks.items)) {
      snapshot.clearedTasks.items = [];
    }
  }

  // Validate task entries — filter out malformed tasks
  if (Array.isArray(snapshot.tasks)) {
    snapshot.tasks = snapshot.tasks.filter(t =>
      t && typeof t === 'object' && typeof t.id === 'string' && typeof t.text === 'string'
    );
  }

  return snapshot;
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
  UIOrchestrator: optional(null),
  logHistoryEvent: optional(null),  // (type, details) => void — logs undo/redo to routine history
  refreshHistoryIfOpen: optional(null),  // () => void — re-renders history modal if open (for cleared tasks tab)
  updateRecurringInfoLink: optional(null),  // () => void — refreshes "X tasks set to recurring" indicator
  updateHelpWindow: optional(null),  // () => void — refreshes help window status message
  syncModeFromToggles: optional(null)  // () => void — syncs delete-checked/auto-reset toggles from state
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
    return;
  }
  _initialized.undoRedoUI = true;

  initUndoRedoButtons();

  const undoBtn = _deps.getElementById(DOM_IDS.UNDO_BTN);
  const redoBtn = _deps.getElementById(DOM_IDS.REDO_BTN);

  if (!undoBtn || !redoBtn) {
    console.warn('⚠️ Undo/redo buttons not found in DOM - keyboard shortcuts will still work');
    return;
  }

  assertInjected('safeAddEventListener', _deps.safeAddEventListener);

  _deps.safeAddEventListener(undoBtn, 'click', () => performStateBasedUndo());
  _deps.safeAddEventListener(redoBtn, 'click', () => performStateBasedRedo());

}

/**
 * Wire up keyboard shortcuts for undo/redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
 * Called once during app initialization
 */
export function wireUndoRedoKeyboardShortcuts() {
  // ✅ Idempotency guard
  if (_initialized.undoRedoKeyboard) {
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
}

/**
 * Initialize undo/redo buttons to hidden state
 */
export function initUndoRedoButtons() {
  const undoBtn = _deps.getElementById(DOM_IDS.UNDO_BTN);
  const redoBtn = _deps.getElementById(DOM_IDS.REDO_BTN);

  if (undoBtn) {
    undoBtn.hidden = true;
    undoBtn.disabled = true;
  }
  if (redoBtn) {
    redoBtn.hidden = true;
    redoBtn.disabled = true;
  }

}

/**
 * Capture initial snapshot after data loads
 */
export async function captureInitialSnapshot() {
  assertInjected('AppState', _deps.AppState);

  const currentState = _deps.AppState.get();
  if (currentState) {
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
    return;
  }

  // Skip installing when wrapper is active
  if (_deps.wrapperActive) {
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
    return;
  }

  // Don't capture snapshots during cycle switches
  if (_deps.AppGlobalState.isSwitchingCycles) {
    return;
  }

  // ✅ FIX #8: Don't capture snapshots during batch operations (reset, complete all)
  if (_deps.AppGlobalState.isResetting) {
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
    theme: currentCycle.theme || 'classic',
    clearedTasks: currentCycle.clearedTasks ? structuredClone(currentCycle.clearedTasks) : null,
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

  _deps.AppGlobalState.activeUndoStack.push(snapshot);
  if (_deps.AppGlobalState.activeUndoStack.length > UNDO_LIMIT) {
    _deps.AppGlobalState.activeUndoStack.shift();
  }

  // Update dedupe trackers
  _deps.AppGlobalState.lastSnapshotSignature = sig;
  _deps.AppGlobalState.lastSnapshotTs = now;

  // Only clear redo stack if this is a genuine user action, not a render-triggered
  // state update after an undo/redo operation. On mobile, async renderTasks() can
  // trigger AppState.update() after isPerformingUndoRedo is cleared, which would
  // wipe the redo stack. The grace period prevents this.
  const completedAt = _deps.AppGlobalState.undoRedoCompletedAt || 0;
  if (Date.now() - completedAt > 2000) {
    _deps.AppGlobalState.activeRedoStack = [];
  }
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
      id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null,
      r: !!t.recurring, re: !!t.remindersEnabled, dwc: !!t.deleteWhenComplete, pc: t.priorityColor || null
    })),
    ti: s.title || '',
    ar: !!s.autoReset,
    dc: !!s.deleteCheckedTasks,
    cc: s.cycleCount || 0,
    th: s.theme || 'classic',
    rt: Object.keys(s.recurringTemplates || {}).sort(),
    ct: s.clearedTasks?.totalCleared || 0
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

    // ✅ FIX: Force synchronous flush so the render happens while
    // isPerformingUndoRedo is still true. Without this, the deferred rAF
    // fires after isPerformingUndoRedo is cleared, and any AppState.update()
    // triggered during rendering captures a snapshot that clears activeRedoStack.
    if (orchestrator.flush) {
      orchestrator.flush();
    }
  } else {
    // Fallback to refreshUIFromState
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
      theme: currentCycle?.theme || 'classic',
      clearedTasks: currentCycle?.clearedTasks ? structuredClone(currentCycle.clearedTasks) : null,
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
    if (!snap) {
      console.warn('⚠️ No valid undo snapshot found');
      updateUndoRedoButtons();
      return;
    }

    // Sanitize snapshot before restoring to prevent corrupted data
    sanitizeSnapshot(snap);

    // Cache signature for efficient dedup comparison later
    currentSnapshot._sig = buildSnapshotSignature(currentSnapshot);
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
      if ('theme' in snap) cycle.theme = snap.theme;
      if ('clearedTasks' in snap) cycle.clearedTasks = snap.clearedTasks ? structuredClone(snap.clearedTasks) : cycle.clearedTasks;

      // ✅ Delta-based userProgress adjustment
      // Reverse global counters by the per-routine diff between snapshots
      const cycleDelta = (snap.cycleCount || 0) - (currentSnapshot.cycleCount || 0);
      if (cycleDelta !== 0 && state.userProgress) {
        state.userProgress.cyclesCompleted = Math.max(0,
          (state.userProgress.cyclesCompleted || 0) + cycleDelta);
      }
      const clearedDelta = (snap.clearedTasks?.totalCleared || 0) - (currentSnapshot.clearedTasks?.totalCleared || 0);
      if (clearedDelta !== 0 && state.userProgress) {
        state.userProgress.totalTasksCompleted = Math.max(0,
          (state.userProgress.totalTasksCompleted || 0) + clearedDelta);
      }
    }, false);

    // Log undo as a history event
    _deps.logHistoryEvent?.('undo', { description: transactionDiff.description || 'Undo' });

    // Use UIOrchestrator if available, otherwise fall back to refreshUIFromState
    handleUndoRedoUIUpdate(transactionDiff, _deps.AppState.get());

    // Refresh peripheral UI elements that aren't covered by UIOrchestrator
    _deps.refreshHistoryIfOpen?.();
    _deps.updateRecurringInfoLink?.();
    _deps.updateHelpWindow?.();
    _deps.syncModeFromToggles?.();

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
      const stepsText = stepsLeft === 0 ? getLabel('notify.stepsLeftNone') :
                        stepsLeft === 1 ? getLabel('notify.stepsLeftOne') :
                        getLabel('notify.stepsLeftMany', { vars: { count: stepsLeft } });
      _deps.showNotification('↩️ ' + getLabel('notify.undoAction', { vars: { description: changeDesc, steps: stepsText } }), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    // Clear dedup trackers so the next user-initiated change is always captured
    _deps.AppGlobalState.lastSnapshotSignature = null;
    _deps.AppGlobalState.lastSnapshotTs = 0;

  } catch (e) {
    console.error('❌ Undo failed, rolling back:', e);

    // ✅ Rollback on failure
    try {
      await _deps.AppState.set(rollbackState);
      _deps.AppGlobalState.activeUndoStack = rollbackUndoStack;
      _deps.AppGlobalState.activeRedoStack = rollbackRedoStack;
      updateUndoRedoButtons();

      if (_deps.showNotification) {
        _deps.showNotification('⚠️ ' + getLabel('notify.undoFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
      }
    } catch (rollbackError) {
      console.error('❌ Rollback also failed:', rollbackError);
    }

    throw e; // Re-throw so caller knows it failed
  } finally {
    _deps.AppGlobalState.isPerformingUndoRedo = false;
    // Grace period: prevent async render-triggered AppState.update() calls
    // from clearing the redo stack after undo completes (especially on mobile
    // where renderTasks() is async and continues after this flag is cleared)
    _deps.AppGlobalState.undoRedoCompletedAt = Date.now();
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
      theme: currentCycle?.theme || 'classic',
      clearedTasks: currentCycle?.clearedTasks ? structuredClone(currentCycle.clearedTasks) : null,
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
    if (!snap) {
      console.warn('⚠️ No valid redo snapshot found');
      updateUndoRedoButtons();
      return;
    }

    // Sanitize snapshot before restoring to prevent corrupted data
    sanitizeSnapshot(snap);

    // Cache signature for efficient dedup comparison later
    currentSnapshot._sig = buildSnapshotSignature(currentSnapshot);
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
      if ('theme' in snap) cycle.theme = snap.theme;
      if ('clearedTasks' in snap) cycle.clearedTasks = snap.clearedTasks ? structuredClone(snap.clearedTasks) : cycle.clearedTasks;

      // ✅ Delta-based userProgress adjustment
      // Restore global counters by the per-routine diff between snapshots
      const cycleDelta = (snap.cycleCount || 0) - (currentSnapshot.cycleCount || 0);
      if (cycleDelta !== 0 && state.userProgress) {
        state.userProgress.cyclesCompleted = Math.max(0,
          (state.userProgress.cyclesCompleted || 0) + cycleDelta);
      }
      const clearedDelta = (snap.clearedTasks?.totalCleared || 0) - (currentSnapshot.clearedTasks?.totalCleared || 0);
      if (clearedDelta !== 0 && state.userProgress) {
        state.userProgress.totalTasksCompleted = Math.max(0,
          (state.userProgress.totalTasksCompleted || 0) + clearedDelta);
      }
    }, false);

    // Log redo as a history event
    _deps.logHistoryEvent?.('redo', { description: transactionDiff.description || 'Redo' });

    // Use UIOrchestrator if available, otherwise fall back to refreshUIFromState
    handleUndoRedoUIUpdate(transactionDiff, _deps.AppState.get());

    // Refresh peripheral UI elements that aren't covered by UIOrchestrator
    _deps.refreshHistoryIfOpen?.();
    _deps.updateRecurringInfoLink?.();
    _deps.updateHelpWindow?.();
    _deps.syncModeFromToggles?.();

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
      const stepsText = stepsLeft === 0 ? getLabel('notify.stepsLeftNone') :
                        stepsLeft === 1 ? getLabel('notify.stepsLeftOne') :
                        getLabel('notify.stepsLeftMany', { vars: { count: stepsLeft } });
      _deps.showNotification('↪️ ' + getLabel('notify.redoAction', { vars: { description: changeDesc, steps: stepsText } }), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    // Clear dedup trackers so the next user-initiated change is always captured
    _deps.AppGlobalState.lastSnapshotSignature = null;
    _deps.AppGlobalState.lastSnapshotTs = 0;

  } catch (e) {
    console.error('❌ Redo failed, rolling back:', e);

    // ✅ Rollback on failure
    try {
      await _deps.AppState.set(rollbackState);
      _deps.AppGlobalState.activeUndoStack = rollbackUndoStack;
      _deps.AppGlobalState.activeRedoStack = rollbackRedoStack;
      updateUndoRedoButtons();

      if (_deps.showNotification) {
        _deps.showNotification('⚠️ ' + getLabel('notify.redoFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
      }
    } catch (rollbackError) {
      console.error('❌ Rollback also failed:', rollbackError);
    }

    throw e; // Re-throw so caller knows it failed
  } finally {
    _deps.AppGlobalState.isPerformingUndoRedo = false;
    // Grace period: prevent async render-triggered AppState.update() calls
    // from clearing the undo stack after redo completes
    _deps.AppGlobalState.undoRedoCompletedAt = Date.now();
  }
}

// ============ UI UPDATES ============

/**
 * Update undo/redo button enabled/disabled states
 */
export function updateUndoRedoButtonStates() {
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  const undoBtn = _deps.getElementById(DOM_IDS.UNDO_BTN);
  const redoBtn = _deps.getElementById(DOM_IDS.REDO_BTN);

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
}

/**
 * Update undo/redo button visibility
 */
export function updateUndoRedoButtonVisibility() {
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  const undoBtn = _deps.getElementById(DOM_IDS.UNDO_BTN);
  const redoBtn = _deps.getElementById(DOM_IDS.REDO_BTN);

  // Use actual stack lengths (instant with localStorage cache)
  const hasUndo = _deps.AppGlobalState.activeUndoStack.length > 0;
  const hasRedo = _deps.AppGlobalState.activeRedoStack.length > 0;

  if (undoBtn) undoBtn.hidden = !hasUndo;
  if (redoBtn) redoBtn.hidden = !hasRedo;
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
    return;
  }

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
    saveToUndoCache(newCycleId, validUndoStack, validRedoStack);

    // 7. Update UI
    updateUndoRedoButtons();

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
      _deps.showNotification('⚠️ ' + getLabel('notify.undoHistoryUnavailableCycle'), 'warning', UI_TIMEOUTS.NOTIFICATION_LONG);
    }
  } finally {
    // ✅ Always clear the flag, even on error
    _deps.AppGlobalState.isSwitchingCycles = false;
  }
}

/**
 * Handle cycle creation - initialize empty stacks
 * Called by cycleManager when new cycle is created
 */
export async function onCycleCreated(cycleId) {

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
export async function initUndoSystemForApp() {
  assertInjected('AppState', _deps.AppState);
  assertInjected('AppGlobalState', _deps.AppGlobalState);

  try {
    // 1. Always initialize IndexedDB (even if no active cycle yet — first-time users
    //    complete onboarding later, and cycle lifecycle hooks need undoDB ready)
    const dbReady = initUndoIndexedDB();

    // 2. Get current active cycle
    const currentState = _deps.AppState.get();
    const activeCycleId = currentState?.appState?.activeCycleId;

    if (!activeCycleId) {
      // Normal for first-time users — onboarding hasn't completed yet
      return;
    }

    // 3. Try localStorage cache first (sync, instant!)
    const cached = loadFromUndoCache(activeCycleId);
    if (cached) {
      // Cache hit! Populate stacks instantly
      _deps.AppGlobalState.activeUndoStack = cached.undoStack;
      _deps.AppGlobalState.activeRedoStack = cached.redoStack;
      _deps.AppGlobalState.activeCycleIdForUndo = activeCycleId;
      updateUndoRedoButtons();
    } else {
      // Cache miss - will load from IndexedDB
      _deps.AppGlobalState.activeUndoStack = [];
      _deps.AppGlobalState.activeRedoStack = [];
      _deps.AppGlobalState.activeCycleIdForUndo = activeCycleId;
    }

    // 4. After IndexedDB is ready, load stacks if cache missed
    dbReady.then(async () => {
      if (!cached) {
        const loaded = await loadUndoStackFromIndexedDB(activeCycleId);
        _deps.AppGlobalState.activeUndoStack = loaded.undoStack || [];
        _deps.AppGlobalState.activeRedoStack = loaded.redoStack || [];
        updateUndoRedoButtons();

        // Update cache for next boot
        saveToUndoCache(activeCycleId, loaded.undoStack || [], loaded.redoStack || []);
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
            version: APP_VERSION
          };

          objectStore.put(data);
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
      _deps.showNotification('⚠️ ' + getLabel('notify.undoHistoryUnavailable'), 'warning', UI_TIMEOUTS.NOTIFICATION_LONG);
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
export async function initUndoIndexedDB() {
  try {
    return new Promise((resolve, reject) => {
      // Timeout to prevent indefinite hangs
      const timeout = setTimeout(() => {
        console.warn('⚠️ initUndoIndexedDB timed out');
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
        version: APP_VERSION
      };

      const request = objectStore.put(data);

      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.warn(`⚠️ Failed to save undo history for "${cycleId}"`);
          reject(request.error);
        };
      });
    } catch (e) {
      console.error('❌ IndexedDB write failed:', e);

      if (e.name === 'QuotaExceededError') {
        console.error('💾 Storage quota exceeded - undo history not saved');
        if (_deps.showNotification) {
          _deps.showNotification(
            '⚠️ ' + getLabel('notify.undoStorageFull'),
            'warning',
            UI_TIMEOUTS.NOTIFICATION_SLOW
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
          resolve({
            undoStack: data.undoStack || [],
            redoStack: data.redoStack || []
          });
        } else {
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
      version: APP_VERSION
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

/**
 * Clear ALL undo/redo history: in-memory stacks, localStorage cache, and IndexedDB.
 * Called by the Settings "Clear Undo History" button.
 *
 * Sets isPerformingUndoRedo guard so any AppState.update() calls that follow
 * (e.g., zeroing undoSizeBytes) don't immediately recapture a new snapshot
 * and repopulate the cache we just cleared.
 */
export async function clearAllUndoHistory() {
  // 1. Cancel any pending debounced IndexedDB write that would re-save old data
  if (dbWriteTimeout) {
    clearTimeout(dbWriteTimeout);
    dbWriteTimeout = null;
  }

  // 2. Guard against snapshot recapture during cleanup
  if (_deps.AppGlobalState) {
    _deps.AppGlobalState.isPerformingUndoRedo = true;
    _deps.AppGlobalState.activeUndoStack = [];
    _deps.AppGlobalState.activeRedoStack = [];
    // Reset dedup trackers so next real user action gets captured fresh
    _deps.AppGlobalState.lastSnapshotSignature = null;
    _deps.AppGlobalState.lastSnapshotTs = 0;
  }

  // 3. Clear persistent storage
  clearUndoCache();
  await clearAllUndoHistoryFromIndexedDB();

  // 4. Update button states
  updateUndoRedoButtons();

  // 5. Release guard after a macrotask so caller's synchronous AppState.update()
  //    (e.g., zeroing undoSizeBytes) doesn't recapture a snapshot
  if (_deps.AppGlobalState) {
    setTimeout(() => {
      _deps.AppGlobalState.isPerformingUndoRedo = false;
    }, 0);
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
  await initUndoSystemForApp();

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
    initUndoSystemForApp,
    // Cycle lifecycle hooks
    onCycleCreated,
    onCycleSwitched,
    onCycleDeleted,
    onCycleRenamed,
    // Cache helpers
    clearUndoCache,
    clearAllUndoHistory
  };
}

// ============ EXPORTS ============

