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
      undoStack: (undoStack || []).slice(),
      redoStack: (redoStack || []).slice(),
      timestamp: Date.now()
    };
    let serialized = JSON.stringify(cacheData);
    // Byte cap alongside the UNDO_LIMIT count cap (drift-review C-08): large
    // routines × 20 full-state snapshots could otherwise grow toward the ~5MB
    // localStorage quota shared with main app state. Shed oldest undo entries
    // (index 0) first, then redo entries, until under the cap.
    // localStorage stores UTF-16, so actual bytes = string length × 2 — the
    // same convention storageUtils uses to meter the quota (drift-review C-27;
    // comparing raw length to a _BYTES constant silently doubled the budget).
    while (serialized.length * 2 > LIMITS.UNDO_CACHE_MAX_BYTES &&
           (cacheData.undoStack.length > 1 || cacheData.redoStack.length > 0)) {
      if (cacheData.undoStack.length > 1) {
        cacheData.undoStack.shift();
      } else {
        cacheData.redoStack.shift();
      }
      serialized = JSON.stringify(cacheData);
    }
    if (serialized.length * 2 > LIMITS.UNDO_CACHE_MAX_BYTES) {
      // Even a single snapshot exceeds the cap — skip the write rather than
      // risk evicting quota needed by the main state save.
      console.warn('⚠️ Undo cache exceeds byte cap even after shedding — skipping cache write');
      return;
    }
    localStorage.setItem(UNDO_CACHE_KEY, serialized);
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
    if (!Array.isArray(snapshot.clearedTasks.entries)) {
      snapshot.clearedTasks.entries = [];
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
 * Relabel snapshots for a renamed cycle. Snapshots embed the cycle identity
 * twice — activeCycleId (the cycles-map key) and title (equal to the key in
 * this app) — so a rename must rewrite BOTH in every snapshot of both stacks,
 * or validateSnapshot discards the history and Undo restores the old title.
 * @param {Array} snapshots - Snapshots to relabel
 * @param {string} newCycleId - The new cycle id (= new title)
 * @returns {Array} New array with relabeled snapshot copies
 */
function relabelSnapshotsForCycle(snapshots, newCycleId) {
  return (snapshots || []).map(snap =>
    (snap && typeof snap === 'object')
      ? { ...snap, activeCycleId: newCycleId, title: newCycleId }
      : snap
  );
}

/**
 * Filter snapshots to only include those belonging to the specified cycle
 * @param {Array} snapshots - Array of snapshots to filter
 * @param {string} cycleId - The cycle ID to filter for
 * @returns {Array} Filtered array of valid snapshots
 */
export function filterValidSnapshots(snapshots, cycleId) {
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
    setTimeout(doSave, UI_TIMEOUTS.SAVE_DEFER);
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
  organizeCompletedTasks: optional(null),  // () => void — re-organize completed dropdown after undo/redo
  logHistoryEvent: optional(null),  // (type, details) => void — logs undo/redo to routine history
  refreshHistoryIfOpen: optional(null),  // () => void — re-renders history modal if open (for cleared tasks tab)
  updateRecurringInfoLink: optional(null),  // () => void — refreshes "X tasks set to recurring" indicator
  updateHelpWindow: optional(null),  // () => void — refreshes help window status message
  syncModeFromToggles: optional(null),  // () => void — syncs delete-checked/auto-reset toggles from state
  refreshThemeLabels: optional(null),  // () => void — refreshes vocab theme labels/colors after undo/redo
  updateRecurringPanel: optional(null),  // () => void — refreshes recurring panel after undo/redo
  refreshTaskViewLayout: optional(null)  // () => void — reconciles drag positions after undo/redo restores state.settings.taskViewLayout
});

// Module-level state: whether the AppState.update wrapper is installed (the
// single snapshot source). Plain variable, NOT a DI dep — it used to live on
// the _deps Proxy, which made the DI validator report it as an
// accessed-but-resolvable-nowhere dependency (drift-review C-24).
let _wrapperActive = false;

// Late-binding deps via Proxy (standard: _deps with underscore prefix)
/** @type {{appInit: Object|null, AppState: Object|null, refreshUIFromState: Function|null, AppGlobalState: Object|null, getElementById: Function|null, safeAddEventListener: Function|null, showNotification: Function|null, UIOrchestrator: Object|null}} */
const _deps = new Proxy({}, {
  get(target, prop) {
    return di.resolve()[prop];
  },
  set() {
    return false;
  }
});

/**
 * Inject or override dependencies for the undo/redo manager module.
 * @param {Object} [overrides] - Dependency overrides to merge into the DI container
 * @returns {void}
 */
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

// Module-scope handler reference for cleanup
let _handleUndoRedoKeydown = null;

// beforeunload handler reference so destroyUndoRedoManager() can remove it (an
// anonymous listener would accumulate across boot retries and let a torn-down
// instance still write history on unload).
let _beforeunloadHandler = null;
let _visibilityFlushHandler = null;

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
 * Wire up keyboard shortcuts for undo/redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z).
 *
 * ⚠️ NOT called during normal boot. Global undo/redo shortcuts are owned by
 * uiBoot.handleGlobalKeydown (via the public appContext undo API). Calling this
 * in addition installs a SECOND document keydown listener, making every shortcut
 * fire undo/redo twice. Kept exported only for standalone/embedded use where uiBoot's
 * global handler is not present — never wire both in the same document.
 */
export function wireUndoRedoKeyboardShortcuts() {
  // ✅ Idempotency guard
  if (_initialized.undoRedoKeyboard) {
    return;
  }
  _initialized.undoRedoKeyboard = true;

  assertInjected('safeAddEventListener', _deps.safeAddEventListener);

  _handleUndoRedoKeydown = function handleUndoRedoKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      performStateBasedUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault();
      performStateBasedRedo();
    }
  };

  _deps.safeAddEventListener(document, 'keydown', _handleUndoRedoKeydown);
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
    _wrapperActive = true;  // update internal flag

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
  if (_wrapperActive) {
    return;
  }

  try {
    _deps.AppState.subscribe('undo-system', (newState, oldState) => {
      // Runtime guard if wrapper activates later
      if (_wrapperActive) return;

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

  // Don't capture snapshots during system-driven mutations (recurring watcher
  // recreations / wake-time catch-up). These aren't user actions — capturing them
  // puts a system-created task at the top of the undo stack, so the user's next Undo
  // removes the recurring task (which then silently reappears on the next tick).
  // See docs/future-work/ARCHITECTURE REVIEW FINDINGS.md §1.2.
  if (_deps.AppGlobalState.isSystemMutation) {
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
  // Self-heal via onCycleSwitched — stale activeCycleIdForUndo permanently disables undo
  if (_deps.AppGlobalState.activeCycleIdForUndo &&
      _deps.AppGlobalState.activeCycleIdForUndo !== activeCycle) {
    console.warn(`⚠️ Cycle mismatch: was tracking "${_deps.AppGlobalState.activeCycleIdForUndo}", correcting to "${activeCycle}"`);
    onCycleSwitched(activeCycle).catch(() => {});
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
    // Task view drag layout is global (state.settings) but captured per
    // snapshot so undo/redo restores the layout that was active when the
    // snapshot was taken alongside the per-cycle data.
    taskViewLayout: state.settings?.taskViewLayout
      ? structuredClone(state.settings.taskViewLayout)
      : null,
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
  if (Date.now() - completedAt > UI_TIMEOUTS.UNDO_REDO_GRACE_PERIOD) {
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
      r: !!t.recurring, re: !!t.remindersEnabled, dwc: !!t.deleteWhenComplete, pc: t.priorityColor || null,
      // Settings OBJECTS, not just their booleans — an edit touching only
      // these would otherwise dedup-skip its snapshot (same class of bug as
      // the taskViewLayout omission below).
      rs: t.recurringSettings ? JSON.stringify(t.recurringSettings) : null,
      dws: t.deleteWhenCompleteSettings ? JSON.stringify(t.deleteWhenCompleteSettings) : null
    })),
    ti: s.title || '',
    ar: !!s.autoReset,
    dc: !!s.deleteCheckedTasks,
    cc: s.cycleCount || 0,
    th: s.theme || 'classic',
    rt: Object.keys(s.recurringTemplates || {}).sort().map(k => {
      const tmpl = s.recurringTemplates[k];
      return { id: k, rs: JSON.stringify(tmpl?.recurringSettings || {}) };
    }),
    ct: s.clearedTasks?.totalCleared || 0,
    // Task view layout — without this in the signature, a layout-only
    // change (drag-end or dock-back) would dedup against the previous
    // snapshot and never push, leaving the move outside undo history.
    tvl: JSON.stringify(s.taskViewLayout?.positions || {})
  });
}

/**
 * Analyze what changed between two snapshots
 * Returns a descriptive message like "Task added" or "Task reordered"
 */
function describeChange(fromSnapshot, toSnapshot) {
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
    if (!!fromTask.deleteWhenComplete !== !!toTask.deleteWhenComplete) {
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
  return changes[0] + ' + ' + getLabel('notify.changeMultiple', { vars: { count: changes.length - 1 } });
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

  // Re-organize completed tasks dropdown (handles both patch and full render paths)
  _deps.organizeCompletedTasks?.();

  // Refresh theme labels/colors if theme changed (outside UIOrchestrator scope)
  if (diff.themeChanged) {
    _deps.refreshThemeLabels?.();
  }

  // Refresh recurring panel if templates changed (outside UIOrchestrator scope)
  if (diff.recurringChanged) {
    _deps.updateRecurringPanel?.();
  }

  // Refresh history modal if cleared tasks changed
  if (diff.clearedTasksChanged) {
    _deps.refreshHistoryIfOpen?.();
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
      taskViewLayout: currentState.settings?.taskViewLayout
        ? structuredClone(currentState.settings.taskViewLayout)
        : null,
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
      if ('clearedTasks' in snap) cycle.clearedTasks = snap.clearedTasks ? structuredClone(snap.clearedTasks) : null;
      // Task view layout lives in state.settings (global), restored alongside per-cycle data.
      if ('taskViewLayout' in snap) {
        if (!state.settings) state.settings = {};
        state.settings.taskViewLayout = snap.taskViewLayout
          ? structuredClone(snap.taskViewLayout)
          : null;
      }

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
    // Reconcile drag positions so the visible task-view layout follows the
    // restored state.settings.taskViewLayout.positions map.
    _deps.refreshTaskViewLayout?.();

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
      // Restore through update() — the sanctioned single door (ADR-003).
      // NOTE: this previously called AppState.set(), which DOES NOT EXIST on
      // StateManager — the TypeError was swallowed by the catch below, so the
      // whole rollback path (state restore, stacks, toast) was silently dead.
      await restoreFullState(rollbackState);
      _deps.AppGlobalState.activeUndoStack = rollbackUndoStack;
      _deps.AppGlobalState.activeRedoStack = rollbackRedoStack;

      // Repaint from the restored state — restoring AppState alone does NOT
      // redraw the DOM, so without this the screen keeps showing the
      // half-applied state while the data is already correct (the exact
      // trust-killer for an undo feature). Full render: after a partial apply
      // we can't know which tasks changed, so no patch diff is possible.
      // Runs while isPerformingUndoRedo is still true (finally clears it),
      // same flush-window rule as the success path.
      handleUndoRedoUIUpdate({ requiresFullRender: true, cycleChanged: true }, _deps.AppState.get());

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
 * Restore a full state snapshot through AppState.update() (ADR-003: every
 * change goes through the one door — there is no AppState.set()). Replaces
 * all top-level keys of the draft with a deep copy of the snapshot.
 * @param {Object} snapshot - structuredClone of a prior full state
 */
async function restoreFullState(snapshot) {
  const restored = structuredClone(snapshot);
  await _deps.AppState.update(state => {
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, restored);
  }, false);
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
      taskViewLayout: currentState.settings?.taskViewLayout
        ? structuredClone(currentState.settings.taskViewLayout)
        : null,
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
      if ('clearedTasks' in snap) cycle.clearedTasks = snap.clearedTasks ? structuredClone(snap.clearedTasks) : null;
      // Task view layout lives in state.settings (global), restored alongside per-cycle data.
      if ('taskViewLayout' in snap) {
        if (!state.settings) state.settings = {};
        state.settings.taskViewLayout = snap.taskViewLayout
          ? structuredClone(snap.taskViewLayout)
          : null;
      }

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
    // Reconcile drag positions so the visible task-view layout follows the
    // restored state.settings.taskViewLayout.positions map.
    _deps.refreshTaskViewLayout?.();

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
      // Restore through update() — same fix as the undo catch (AppState.set()
      // never existed; the old call died as a swallowed TypeError).
      await restoreFullState(rollbackState);
      _deps.AppGlobalState.activeUndoStack = rollbackUndoStack;
      _deps.AppGlobalState.activeRedoStack = rollbackRedoStack;

      // Repaint from the restored state — same reasoning as the undo catch:
      // restoring state alone doesn't redraw, and a failed partial apply means
      // only a full render is safe. Symmetric fix; keep both in sync.
      handleUndoRedoUIUpdate({ requiresFullRender: true, cycleChanged: true }, _deps.AppState.get());

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
    await new Promise(resolve => setTimeout(resolve, UI_TIMEOUTS.CYCLE_SWITCH_TRANSITION));
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
    // Cancel any pending debounced write FIRST — otherwise it fires after the
    // delete below and recreates the record we just removed (orphaned history).
    cancelPendingDbWrite(cycleId);

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
    // Cancel any pending write for the OLD id first — otherwise it fires after
    // the migration below and recreates a stale record under the old name.
    cancelPendingDbWrite(oldCycleId);

    // Migrate in IndexedDB
    await renameUndoStackInIndexedDB(oldCycleId, newCycleId);

    // Update in-memory tracking AND relabel the live stacks — they hold the
    // same stale-id snapshots the IDB migration rewrites; without this, a
    // rename → Undo in the same session restores the old title into the new
    // key, and the next persist re-saves stale ids over the migrated record.
    if (_deps.AppGlobalState.activeCycleIdForUndo === oldCycleId) {
      _deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
      _deps.AppGlobalState.activeUndoStack =
        relabelSnapshotsForCycle(_deps.AppGlobalState.activeUndoStack, newCycleId);
      _deps.AppGlobalState.activeRedoStack =
        relabelSnapshotsForCycle(_deps.AppGlobalState.activeRedoStack, newCycleId);
    }
  } catch (e) {
    // ✅ FIX #5: Error boundary for cycle rename
    console.error('❌ Failed to rename undo stack:', e);

    // Still update in-memory tracking (and relabel) even if IndexedDB fails
    if (_deps.AppGlobalState.activeCycleIdForUndo === oldCycleId) {
      _deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
      _deps.AppGlobalState.activeUndoStack =
        relabelSnapshotsForCycle(_deps.AppGlobalState.activeUndoStack, newCycleId);
      _deps.AppGlobalState.activeRedoStack =
        relabelSnapshotsForCycle(_deps.AppGlobalState.activeRedoStack, newCycleId);
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
        // Filter like every other load path — this was the one unfiltered
        // entry point, where stale-id snapshots (e.g. from a pre-fix rename)
        // survived into the live stacks and could restore a stale title.
        _deps.AppGlobalState.activeUndoStack = filterValidSnapshots(loaded.undoStack || [], activeCycleId);
        _deps.AppGlobalState.activeRedoStack = filterValidSnapshots(loaded.redoStack || [], activeCycleId);
        updateUndoRedoButtons();

        // Update cache for next boot
        saveToUndoCache(activeCycleId, loaded.undoStack || [], loaded.redoStack || []);
      }
    }).catch(e => {
      console.warn('⚠️ IndexedDB background init failed:', e);
    });

    // 4. Update UI with whatever we have so far
    updateUndoRedoButtons();

    // 5. Set up page unload handler to force immediate save. Store the reference
    //    and drop any prior one first so re-init (boot retry) can't stack handlers.
    //    beforeunload alone is unreliable on iOS — frequently NOT fired when the
    //    app is backgrounded or swiped away — so also flush on pagehide and on
    //    visibilitychange→hidden, the events that DO fire there. Same trio
    //    appState uses for its debounced-save flush. The handler is idempotent
    //    (timers cleared, cache overwritten with same data), so firing on both
    //    hidden and unload is safe.
    if (_beforeunloadHandler) {
      window.removeEventListener('beforeunload', _beforeunloadHandler);
      window.removeEventListener('pagehide', _beforeunloadHandler);
    }
    if (_visibilityFlushHandler) {
      document.removeEventListener('visibilitychange', _visibilityFlushHandler);
    }
    _beforeunloadHandler = () => {
      // Flush EVERY pending debounced write synchronously (not just the active
      // cycle's) so a fast switch-then-close can't drop a scheduled write.
      dbWriteTimers.forEach((entry, cid) => {
        clearTimeout(entry.timer);
        if (undoDB && cid) {
          try {
            const tx = undoDB.transaction(["undoStacks"], "readwrite");
            tx.objectStore("undoStacks").put({
              cycleId: cid,
              undoStack: entry.undoSnap,
              redoStack: entry.redoSnap,
              lastUpdated: Date.now(),
              version: APP_VERSION
            });
          } catch (e) {
            console.warn('⚠️ Failed to flush pending undo write:', e);
          }
        }
      });
      dbWriteTimers.clear();

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
    };
    _visibilityFlushHandler = () => {
      if (document.visibilityState === 'hidden') _beforeunloadHandler?.();
    };
    window.addEventListener('beforeunload', _beforeunloadHandler);
    window.addEventListener('pagehide', _beforeunloadHandler);
    document.addEventListener('visibilitychange', _visibilityFlushHandler);

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

// Per-cycle debounced IndexedDB write timers, keyed by cycleId.
// A SINGLE shared timer used to let a save for one cycle cancel another cycle's
// pending write (clearTimeout on every call) — dropping the other cycle's undo
// history on a fast switch, and letting a late write resurrect a deleted/renamed
// record. Keying by cycleId keeps cycles independent. Each entry also carries the
// call-time array snapshots so beforeunload can flush every pending write.
// Map<cycleId, { timer:number, undoSnap:Array, redoSnap:Array }>
const dbWriteTimers = new Map();

/**
 * Cancel a cycle's pending debounced IndexedDB write, if any. Used on
 * delete/rename so a late write can't recreate the deleted record or misfile
 * the renamed one.
 * @param {string} cycleId
 */
function cancelPendingDbWrite(cycleId) {
  const entry = dbWriteTimers.get(cycleId);
  if (entry) {
    clearTimeout(entry.timer);
    dbWriteTimers.delete(cycleId);
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

  // Snapshot the arrays at CALL time. captureStateSnapshot mutates the live
  // stack in place (push/shift), so serializing at fire time could otherwise
  // persist a state that no longer matches this call. (Belt-and-suspenders — the
  // cross-cycle switch path reassigns, but a copy is cheap and removes the class.)
  const undoSnap = Array.isArray(undoStack) ? [...undoStack] : [];
  const redoSnap = Array.isArray(redoStack) ? [...redoStack] : [];

  // Debounce IndexedDB writes PER CYCLE (see dbWriteTimers) — only cancel this
  // cycle's own pending write, never another cycle's.
  cancelPendingDbWrite(cycleId);

  const timer = setTimeout(async () => {
    dbWriteTimers.delete(cycleId);
    try {
      const transaction = undoDB.transaction(["undoStacks"], "readwrite");
      const objectStore = transaction.objectStore("undoStacks");

      const data = {
        cycleId,
        undoStack: undoSnap,
        redoStack: redoSnap,
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

  dbWriteTimers.set(cycleId, { timer, undoSnap, redoSnap });
}

/**
 * Load undo/redo stacks from IndexedDB
 */
export async function loadUndoStackFromIndexedDB(cycleId) {
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

    // Relabel every snapshot, not just the storage key — snapshots embed
    // activeCycleId and title (key=title in this app). A verbatim copy left
    // each one carrying the OLD id, so validateSnapshot's strict-equality
    // check rejected the entire migrated history on the next filtered load
    // (silent total wipe), and any snapshot that DID survive an unfiltered
    // path would restore the old title into the renamed cycle on Undo,
    // breaking the key=title invariant.
    const newData = {
      cycleId: newCycleId,
      undoStack: relabelSnapshotsForCycle(oldData.undoStack, newCycleId),
      redoStack: relabelSnapshotsForCycle(oldData.redoStack, newCycleId),
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
 * don't immediately recapture a new snapshot
 * and repopulate the cache we just cleared.
 */
export async function clearAllUndoHistory() {
  // 1. Cancel ALL pending debounced IndexedDB writes that would re-save old data
  dbWriteTimers.forEach(entry => clearTimeout(entry.timer));
  dbWriteTimers.clear();

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
  //    doesn't recapture a snapshot
  if (_deps.AppGlobalState) {
    setTimeout(() => {
      _deps.AppGlobalState.isPerformingUndoRedo = false;
    }, 0);
  }

}

/**
 * Clean up listeners and reset state for boot retry.
 */
function destroyUndoRedoManager() {
  if (_handleUndoRedoKeydown) {
    document.removeEventListener('keydown', _handleUndoRedoKeydown);
    _handleUndoRedoKeydown = null;
  }
  // Remove the unload handlers so retries don't stack listeners (and a torn-down
  // instance can't still write history on unload).
  if (_beforeunloadHandler) {
    window.removeEventListener('beforeunload', _beforeunloadHandler);
    window.removeEventListener('pagehide', _beforeunloadHandler);
    _beforeunloadHandler = null;
  }
  if (_visibilityFlushHandler) {
    document.removeEventListener('visibilitychange', _visibilityFlushHandler);
    _visibilityFlushHandler = null;
  }
  // Cancel any pending debounced writes so they don't fire after teardown.
  dbWriteTimers.forEach(entry => clearTimeout(entry.timer));
  dbWriteTimers.clear();
  _initialized.undoRedoUI = false;
  _initialized.undoRedoKeyboard = false;
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

  // NOTE: Global keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) are owned by
  // uiBoot.attachGlobalEventListeners → handleGlobalKeydown, which drives undo/redo
  // through the public appContext undo API (getUndoApi().undo/redo). Do NOT also call
  // wireUndoRedoKeyboardShortcuts() here — a second document-level keydown listener
  // makes every shortcut fire undo/redo TWICE (see run-journey-tests undo/redo journey).

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
    clearAllUndoHistory,
    // Cleanup
    destroy: destroyUndoRedoManager
  };
}

// ============ EXPORTS ============

