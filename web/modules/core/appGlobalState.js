/**
 * ============================================================================
 * appGlobalState.js - Centralized Runtime State & Feature Flags
 * ============================================================================
 *
 * This module contains:
 * - AppGlobalState: Runtime mutable state for the application
 * - FeatureFlags: Feature toggles
 * - Property getters for backward compatibility with legacy window.* access
 *
 * MUST be loaded before any other module that accesses these globals.
 *
 * @module appGlobalState
 * @version 1.0.0
 * @see {@link file://../../../docs/developer-guides/DI_PATTERNS.md} - DI patterns
 */

/**
 * @typedef {Object} FeatureFlagsType
 * @property {boolean} recurringEnabled - Whether recurring tasks are enabled
 * @property {boolean} moveArrowsEnabled - Whether move arrows are shown
 * @property {boolean} debugMode - Whether debug mode is active
 */

/**
 * @typedef {Object} AppGlobalStateType
 * @property {HTMLElement|null} draggedTask - Currently dragged task element
 * @property {number|null} logoTimeoutId - Logo animation timeout
 * @property {number} touchStartTime - Touch start timestamp
 * @property {boolean} isLongPress - Long press detection flag
 * @property {number} touchStartY - Touch start Y coordinate
 * @property {number} touchEndY - Touch end Y coordinate
 * @property {number|null} holdTimeout - Hold timeout ID
 * @property {boolean} moved - Whether touch has moved
 * @property {boolean} isDragging - Active drag operation flag
 * @property {boolean} rearrangeInitialized - Rearrange mode initialized
 * @property {HTMLElement|null} lastDraggedOver - Last drag over element
 * @property {HTMLElement|null} lastRearrangeTarget - Last rearrange target
 * @property {boolean} hasInteracted - User has interacted with app
 * @property {number} lastDragOverTime - Last drag over timestamp
 * @property {number|null} reminderIntervalId - Reminder interval ID
 * @property {number} timesReminded - Reminder count
 * @property {Date|null} lastReminderTime - Last reminder timestamp
 * @property {boolean} isResetting - Cycle reset in progress
 * @property {Object|null} undoSnapshot - Undo state snapshot
 * @property {Object|null} redoSnapshot - Redo state snapshot
 * @property {Array} activeUndoStack - Per-cycle undo stack
 * @property {Array} activeRedoStack - Per-cycle redo stack
 * @property {string|null} activeCycleIdForUndo - Cycle ID for undo context
 * @property {boolean} isSwitchingCycles - Cycle switch in progress
 * @property {boolean} didDragReorderOccur - Drag reorder occurred
 * @property {number} lastReorderTime - Last reorder timestamp
 * @property {boolean} isPerformingUndoRedo - Undo/redo in progress
 * @property {string|null} lastSnapshotSignature - Last snapshot hash
 * @property {number} lastSnapshotTs - Last snapshot timestamp
 * @property {boolean} advancedVisible - Advanced panel visible
 * @property {boolean} isInitializing - App initialization in progress
 * @property {boolean} pendingCacheNotification - Cache notification pending
 * @property {Array} queuedAddTaskCalls - Queued add task calls
 * @property {boolean} wrappedAppStateUpdate - AppState update wrapped
 * @property {boolean} useUpdateWrapper - Use update wrapper flag
 * @property {number|null} bootStartTime - Boot start timestamp
 * @property {Object|null} recurringModules - Recurring module references
 */

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/** @type {FeatureFlagsType} */
export const FeatureFlags = {
  recurringEnabled: true,
  moveArrowsEnabled: true,
  debugMode: false
};

// ✅ FeatureFlags accessible via import - no window.* exposure

// ============================================================================
// APP GLOBAL STATE
// ============================================================================

/** @type {AppGlobalStateType} */
export const AppGlobalState = {
  // Drag & touch state
  draggedTask: null,
  logoTimeoutId: null,
  touchStartTime: 0,
  isLongPress: false,
  touchStartY: 0,
  touchEndY: 0,
  holdTimeout: null,
  moved: false,
  isDragging: false,
  rearrangeInitialized: false,
  lastDraggedOver: null,
  lastRearrangeTarget: null,
  hasInteracted: false,
  lastDragOverTime: 0,

  // Reminder state
  reminderIntervalId: null,
  timesReminded: 0,
  lastReminderTime: null,

  // Undo/redo state
  isResetting: false,
  isSystemMutation: false,     // Legacy/test fallback: captureStateSnapshot honors it, but system mutations now pass { system: true } through AppState.update instead (review F-005)
  undoSnapshot: null,
  redoSnapshot: null,
  activeUndoStack: [],      // Per-cycle undo stack
  activeRedoStack: [],      // Per-cycle redo stack
  activeCycleIdForUndo: null,  // Track which cycle's undo is loaded
  isSwitchingCycles: false,    // Block snapshots during cycle switches
  didDragReorderOccur: false,
  lastReorderTime: 0,
  isPerformingUndoRedo: false,
  lastSnapshotSignature: null,
  lastSnapshotTs: 0,

  // UI state
  advancedVisible: false,
  isInitializing: true,      // Track if app is still initializing

  // Consolidated internal flags
  pendingCacheNotification: false,
  queuedAddTaskCalls: [],
  wrappedAppStateUpdate: false,
  useUpdateWrapper: false,
  bootStartTime: null,
  recurringModules: null     // Stores recurring module references
};

// ✅ AppGlobalState accessible via import and appContext - no window.* exposure

// ============================================================================
// REMOVED: BACKWARD-COMPATIBLE PROPERTY GETTERS (Dec 2025)
// ============================================================================
// These window.propertyName aliases were removed as part of zero-globals initiative.
// All code now uses AppGlobalState directly via import or appContext.

// ============================================================================
// CONSTANTS
// ============================================================================

/** @type {number} Maximum number of undo snapshots to retain per cycle */
export const UNDO_LIMIT = 20;

/** @type {number} Minimum interval in milliseconds between undo snapshots */
export const UNDO_MIN_INTERVAL_MS = 100;

// ============================================================================
// DEBUG FUNCTION
// ============================================================================

// Debug AppState - receives AppState as parameter to avoid module import issues
let _debugAppState = null;

/**
 * Inject AppState reference for debug logging
 * @param {Object} AppState - The AppState manager instance
 * @returns {void}
 */
export function setDebugAppState(AppState) {
  _debugAppState = AppState;
}

/**
 * Log current application state to the console for debugging
 * @returns {Promise<void>}
 */
export async function debugAppState() {
  console.group('🔍 App State Debug');

  // Use injected AppState to avoid module instance mismatch
  const AppState = _debugAppState;

  if (!AppState) {
    console.error('❌ AppState not available');
    console.groupEnd();
    return;
  }

  const state = AppState.get();
  if (!state) {
    console.error('❌ No state data');
    console.groupEnd();
    return;
  }

  const activeCycle = state.appState?.activeCycleId;
  const cycleData = state.data?.cycles?.[activeCycle];

  // Restored Aug 2026. A "Remove console.log statements" pass (23459e5b) stripped
  // every log line but left the group, the guards and these two assignments — so
  // this opened an empty console group and closed it. Worse than deleting it:
  // someone reaching for it mid-incident reads the silence as "state is empty".
  console.log('schemaVersion :', state.schemaVersion ?? '(none)');
  console.log('activeCycleId :', activeCycle ?? '(none)');
  console.log('cycles        :', Object.keys(state.data?.cycles ?? {}).length);
  console.log('tasks (active):', Array.isArray(cycleData?.tasks) ? cycleData.tasks.length : '(no active cycle)');
  console.log('cycleCount    :', cycleData?.cycleCount ?? '(n/a)');
  console.log('lastModified  :', state.metadata?.lastModified
      ? new Date(state.metadata.lastModified).toLocaleString()
      : '(none)');

  console.groupEnd();
}

// ✅ debugAppState requires AppState to be set first via setDebugAppState(AppState)

