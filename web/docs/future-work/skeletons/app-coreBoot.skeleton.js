/**
 * ============================================================================
 * app-coreBoot.js - Core State & Initialization (Skeleton)
 * ============================================================================
 *
 * This is the FOUNDATION boot file. It must:
 * - Set window.AppBootStarted IMMEDIATELY (for HTML fallback detection)
 * - Define AppGlobalState and FeatureFlags
 * - Load and configure appInit
 * - Create AppState
 * - Load core constants and migration manager
 * - Provide core data functions (loadMiniCycleData, autoSave, updateCycleData)
 *
 * IMPORT RULES:
 * - This file must NOT import from app-featureBoot.js or app-uiBoot.js
 * - This file CAN import from modules/core/* and modules/utils/globalUtils.js
 *
 * ============================================================================
 */

// ============================================================================
// CRITICAL: Set boot flag IMMEDIATELY for HTML fallback detection
// ============================================================================
window.AppBootStarted = true;
window.AppGlobalState = window.AppGlobalState || {}; // Ensure exists before async
window.AppGlobalState.bootStartTime = Date.now();

// ============================================================================
// SECTION 1: Feature Flags & Global State
// ============================================================================

export const FeatureFlags = {
  recurringEnabled: true,
  moveArrowsEnabled: true,
  debugMode: false
};
window.FeatureFlags = FeatureFlags;

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
  activeUndoStack: [],
  activeRedoStack: [],
  activeCycleIdForUndo: null,
  isSwitchingCycles: false,
  didDragReorderOccur: false,
  lastReorderTime: 0,
  isPerformingUndoRedo: false,
  lastSnapshotSignature: null,
  lastSnapshotTs: 0,

  // UI state
  advancedVisible: false,
  isInitializing: true,

  // Consolidated internal flags
  pendingCacheNotification: false,
  queuedAddTaskCalls: [],
  wrappedAppStateUpdate: false,
  useUpdateWrapper: false,
  bootStartTime: Date.now(),
  recurringModules: null
};
window.AppGlobalState = AppGlobalState;

// ============================================================================
// SECTION 2: Property Getters for Backward Compatibility
// ============================================================================

// TODO: Move these from miniCycle-scripts.js
// Object.defineProperty(window, 'touchStartTime', { ... });
// Object.defineProperty(window, 'isLongPress', { ... });
// ... etc.

// ============================================================================
// SECTION 3: Version & App Meta
// ============================================================================

export const APP_VERSION = window.APP_VERSION || '1.459';

export const AppMeta = {
  version: APP_VERSION,
  moduleCache: {},
  bootStartTime: Date.now()
};
window.AppMeta = AppMeta;

// Version helper for cache-busted imports
export const withV = (path) => `${path}?v=${APP_VERSION}`;

// ============================================================================
// SECTION 4: Core Module Imports
// ============================================================================

// GlobalUtils - needed early for safe operations
let GlobalUtils = null;

// appInit - initialization coordinator
let appInit = null;

// AppState - central state manager
let AppState = null;

// Core constants
let DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = null;
let DEFAULT_RECURRING_DELETE_SETTINGS = null;
let TASK_LIMIT = 500;

/**
 * Initialize core modules. Call this before using any exports.
 * This is separated to allow synchronous export of the shell objects
 * while async loading the actual implementations.
 */
export async function initCore() {
  // ========== Load GlobalUtils ==========
  const globalUtilsModule = await import(withV('./modules/utils/globalUtils.js'));
  GlobalUtils = globalUtilsModule.GlobalUtils || globalUtilsModule.default;
  window.GlobalUtils = GlobalUtils;

  // Expose commonly used utilities
  window.sanitizeInput = GlobalUtils.sanitizeInput;
  window.escapeHtml = GlobalUtils.escapeHtml;
  window.generateHashId = GlobalUtils.generateHashId;
  window.safeLocalStorageGet = GlobalUtils.safeLocalStorageGet;
  window.safeLocalStorageSet = GlobalUtils.safeLocalStorageSet;
  window.safeJSONParse = GlobalUtils.safeJSONParse;
  window.safeJSONStringify = GlobalUtils.safeJSONStringify;
  window.generateId = GlobalUtils.generateId;

  console.log('✅ GlobalUtils loaded');

  // ========== Load appInit ==========
  const appInitModule = await import(withV('./modules/core/appInit.js'));
  const { createAppInit, setAppInitDependencies } = appInitModule;

  appInit = createAppInit();
  window.AppInit = appInit;
  window.appInit = appInit;

  console.log('✅ appInit loaded');

  // ========== Load Constants ==========
  const constantsModule = await import(withV('./modules/core/constants.js'));
  DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = constantsModule.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS;
  DEFAULT_RECURRING_DELETE_SETTINGS = constantsModule.DEFAULT_RECURRING_DELETE_SETTINGS;
  TASK_LIMIT = constantsModule.TASK_LIMIT || 500;

  console.log('✅ Constants loaded');

  // ========== Load Migration Manager ==========
  const migrationMod = await import(withV('./modules/cycle/migrationManager.js'));

  // Wire migration dependencies
  if (migrationMod.setMigrationDependencies) {
    migrationMod.setMigrationDependencies({
      // TODO: Add required dependencies
    });
  }

  window.createInitialSchema25Data = migrationMod.createInitialSchema25Data;
  window.checkMigrationNeeded = migrationMod.checkMigrationNeeded;
  window.performSchema25Migration = migrationMod.performSchema25Migration;

  console.log('✅ Migration manager loaded');

  // ========== Load AppState ==========
  const appStateMod = await import(withV('./modules/core/appState.js'));
  const { createStateManager, setAppStateDependencies } = appStateMod;

  // Wire AppState dependencies
  setAppStateDependencies({
    appInit,
    GlobalUtils,
    createInitialSchema25Data: migrationMod.createInitialSchema25Data,
    // TODO: Add other dependencies
  });

  AppState = createStateManager({
    // Configuration options
  });
  window.AppState = AppState;

  console.log('✅ AppState loaded');

  // ========== Mark Core Ready ==========
  appInit.markCoreSystemsReady();
  console.log('✅ Core systems ready');

  return {
    GlobalUtils,
    appInit,
    AppState,
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS,
    TASK_LIMIT
  };
}

// ============================================================================
// SECTION 5: Core Data Functions
// ============================================================================

/**
 * Load miniCycle data from AppState (Schema 2.5 format)
 * Returns legacy-compatible format for backward compatibility
 */
export function loadMiniCycleData() {
  if (!window.AppState?.isReady?.()) {
    console.warn('⚠️ loadMiniCycleData called before AppState ready');
    return null;
  }

  const state = window.AppState.get();
  if (!state) {
    console.warn('⚠️ loadMiniCycleData: No state data');
    return null;
  }

  // Return Schema 2.5 compatible format
  return {
    cycles: state.data?.cycles || {},
    activeCycle: state.appState?.activeCycleId,
    settings: state.settings || {},
    metadata: state.metadata || {},
    userProgress: state.userProgress || {}
  };
}
window.loadMiniCycleData = loadMiniCycleData;

/**
 * Auto-save current state with debouncing
 */
export async function autoSave(overrideTaskList = null, immediate = false) {
  if (!window.AppState?.isReady?.()) {
    console.warn('⚠️ autoSave called before AppState ready');
    return;
  }

  try {
    const taskData = overrideTaskList || window.extractTaskDataFromDOM?.() || [];

    await window.AppState.update(state => {
      const activeCycleId = state.appState?.activeCycleId;
      if (activeCycleId && state.data?.cycles?.[activeCycleId]) {
        state.data.cycles[activeCycleId].tasks = taskData;
        state.metadata.lastModified = new Date().toISOString();
      }
    }, immediate);

    console.log('✅ Auto-save complete');
  } catch (error) {
    console.error('❌ Auto-save failed:', error);
  }
}
window.autoSave = autoSave;

/**
 * Update cycle data with a producer function
 */
export async function updateCycleData(cycleId, updateFn, immediate = true) {
  if (!window.AppState?.isReady?.()) {
    console.warn('⚠️ updateCycleData called before AppState ready');
    return;
  }

  try {
    await window.AppState.update(state => {
      if (state.data?.cycles?.[cycleId]) {
        updateFn(state.data.cycles[cycleId]);
        state.metadata.lastModified = new Date().toISOString();
      }
    }, immediate);
  } catch (error) {
    console.error('❌ updateCycleData failed:', error);
  }
}
window.updateCycleData = updateCycleData;

// ============================================================================
// SECTION 6: Exports
// ============================================================================

export {
  GlobalUtils,
  appInit,
  AppState,
  DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
  DEFAULT_RECURRING_DELETE_SETTINGS,
  TASK_LIMIT
};

// ============================================================================
// DEBUG: Expose for console access
// ============================================================================

window.debugAppState = function() {
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

  console.groupEnd();
};
