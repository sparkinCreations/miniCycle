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

// ✅ FeatureFlags accessible via import - no window.* exposure

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

// ✅ AppGlobalState accessible via import and appContext - no window.* exposure

// ============================================================================
// REMOVED: BACKWARD-COMPATIBLE PROPERTY GETTERS (Dec 2025)
// ============================================================================
// These window.propertyName aliases were removed as part of zero-globals initiative.
// All code now uses AppGlobalState directly via import or appContext.

// ============================================================================
// CONSTANTS
// ============================================================================

export const UNDO_LIMIT = 20;
export const UNDO_MIN_INTERVAL_MS = 100;

// ============================================================================
// DEBUG FUNCTION
// ============================================================================

export async function debugAppState() {
  console.group('🔍 App State Debug');

  // Use dynamic import to avoid circular dependency
  const { getAppState } = await import('./appContext.js');
  const AppState = getAppState();

  if (!AppState) {
    console.error('❌ AppState not available');
    console.groupEnd();
    return;
  }

  console.log('Ready:', AppState.isReady());

  const state = AppState.get();
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

// ✅ debugAppState accessible via: import('./modules/core/appGlobalState.js').then(m => m.debugAppState())

console.log('✅ appGlobalState.js loaded');
