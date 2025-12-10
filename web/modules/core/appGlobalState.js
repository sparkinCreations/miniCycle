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
 */

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FeatureFlags = {
  recurringEnabled: true,
  moveArrowsEnabled: true,
  debugMode: false
};

// Expose to window for legacy access
window.FeatureFlags = FeatureFlags;

// ============================================================================
// APP GLOBAL STATE
// ============================================================================

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

// Expose to window for legacy access
window.AppGlobalState = AppGlobalState;

// ============================================================================
// BACKWARD-COMPATIBLE PROPERTY GETTERS
// ============================================================================
// These allow legacy code to access window.propertyName while the actual
// data lives in AppGlobalState.

// Touch state
Object.defineProperty(window, 'touchStartTime', {
  get: () => window.AppGlobalState.touchStartTime,
  set: (value) => { window.AppGlobalState.touchStartTime = value; }
});

Object.defineProperty(window, 'isLongPress', {
  get: () => window.AppGlobalState.isLongPress,
  set: (value) => { window.AppGlobalState.isLongPress = value; }
});

Object.defineProperty(window, 'touchStartY', {
  get: () => window.AppGlobalState.touchStartY,
  set: (value) => { window.AppGlobalState.touchStartY = value; }
});

Object.defineProperty(window, 'touchEndY', {
  get: () => window.AppGlobalState.touchEndY,
  set: (value) => { window.AppGlobalState.touchEndY = value; }
});

Object.defineProperty(window, 'holdTimeout', {
  get: () => window.AppGlobalState.holdTimeout,
  set: (value) => { window.AppGlobalState.holdTimeout = value; }
});

Object.defineProperty(window, 'moved', {
  get: () => window.AppGlobalState.moved,
  set: (value) => { window.AppGlobalState.moved = value; }
});

// Drag state
Object.defineProperty(window, 'rearrangeInitialized', {
  get: () => window.AppGlobalState.rearrangeInitialized,
  set: (value) => { window.AppGlobalState.rearrangeInitialized = value; }
});

Object.defineProperty(window, 'lastDraggedOver', {
  get: () => window.AppGlobalState.lastDraggedOver,
  set: (value) => { window.AppGlobalState.lastDraggedOver = value; }
});

Object.defineProperty(window, 'lastRearrangeTarget', {
  get: () => window.AppGlobalState.lastRearrangeTarget,
  set: (value) => { window.AppGlobalState.lastRearrangeTarget = value; }
});

Object.defineProperty(window, 'lastDragOverTime', {
  get: () => window.AppGlobalState.lastDragOverTime,
  set: (value) => { window.AppGlobalState.lastDragOverTime = value; }
});

Object.defineProperty(window, 'didDragReorderOccur', {
  get: () => window.AppGlobalState.didDragReorderOccur,
  set: (value) => { window.AppGlobalState.didDragReorderOccur = value; }
});

Object.defineProperty(window, 'lastReorderTime', {
  get: () => window.AppGlobalState.lastReorderTime,
  set: (value) => { window.AppGlobalState.lastReorderTime = value; }
});

Object.defineProperty(window, 'draggedTask', {
  get: () => window.AppGlobalState.draggedTask,
  set: (value) => { window.AppGlobalState.draggedTask = value; }
});

Object.defineProperty(window, 'isDragging', {
  get: () => window.AppGlobalState.isDragging,
  set: (value) => { window.AppGlobalState.isDragging = value; }
});

// Interaction state
Object.defineProperty(window, 'hasInteracted', {
  get: () => window.AppGlobalState.hasInteracted,
  set: (value) => { window.AppGlobalState.hasInteracted = value; }
});

Object.defineProperty(window, 'logoTimeoutId', {
  get: () => window.AppGlobalState.logoTimeoutId,
  set: (value) => { window.AppGlobalState.logoTimeoutId = value; }
});

Object.defineProperty(window, 'advancedVisible', {
  get: () => window.AppGlobalState.advancedVisible,
  set: (value) => { window.AppGlobalState.advancedVisible = value; }
});

// Reminder state
Object.defineProperty(window, 'timesReminded', {
  get: () => window.AppGlobalState.timesReminded,
  set: (value) => { window.AppGlobalState.timesReminded = value; }
});

Object.defineProperty(window, 'reminderIntervalId', {
  get: () => window.AppGlobalState.reminderIntervalId,
  set: (value) => { window.AppGlobalState.reminderIntervalId = value; }
});

Object.defineProperty(window, 'lastReminderTime', {
  get: () => window.AppGlobalState.lastReminderTime,
  set: (value) => { window.AppGlobalState.lastReminderTime = value; }
});

// Undo/redo state
Object.defineProperty(window, 'isResetting', {
  get: () => window.AppGlobalState.isResetting,
  set: (value) => { window.AppGlobalState.isResetting = value; }
});

// Legacy names mapped to actual property names
Object.defineProperty(window, 'undoStack', {
  get: () => window.AppGlobalState.activeUndoStack,
  set: (value) => { window.AppGlobalState.activeUndoStack = value; }
});

Object.defineProperty(window, 'redoStack', {
  get: () => window.AppGlobalState.activeRedoStack,
  set: (value) => { window.AppGlobalState.activeRedoStack = value; }
});

// ============================================================================
// CONSTANTS
// ============================================================================

export const UNDO_LIMIT = 20;
export const UNDO_MIN_INTERVAL_MS = 100;

// ============================================================================
// DEBUG FUNCTION
// ============================================================================

export function debugAppState() {
  console.group('🔍 App State Debug');

  if (!window.AppState) {
    console.error('❌ AppState not available');
    console.groupEnd();
    return;
  }

  console.log('Ready:', window.AppState.isReady());

  const state = window.AppState.get();
  if (!state) {
    console.error('❌ No state data');
    console.groupEnd();
    return;
  }

  console.log('📊 Full State:', state);
  console.log('🎯 Active Cycle:', state.appState?.activeCycleId);

  const activeCycle = state.appState?.activeCycleId;
  const cycleData = state.data?.cycles?.[activeCycle];
  console.log('🔢 Cycle Count:', cycleData?.cycleCount || 0);
  console.log('🎨 Unlocked Themes:', state.settings?.unlockedThemes || []);
  console.log('🎮 Unlocked Features:', state.settings?.unlockedFeatures || []);
  console.log('👤 User Progress:', state.userProgress || {});
  console.log('🏆 Reward Milestones:', state.userProgress?.rewardMilestones || []);

  // Check milestone eligibility
  const currentCount = cycleData?.cycleCount || 0;
  console.log(`🏆 Milestone Status:
    - Dark Ocean (5 cycles): ${currentCount >= 5 ? '✅ Eligible' : `❌ Need ${5 - currentCount} more`}
    - Golden Glow (50 cycles): ${currentCount >= 50 ? '✅ Eligible' : `❌ Need ${50 - currentCount} more`}
    - Mini Game (100 cycles): ${currentCount >= 100 ? '✅ Eligible' : `❌ Need ${100 - currentCount} more`}`);

  console.groupEnd();
}

// Expose debug function to window
window.debugAppState = debugAppState;

console.log('✅ appGlobalState.js loaded');
