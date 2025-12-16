/**
 * @file appContext.js
 * @description Centralized app context for dependency access without window.* globals
 * @module modules/core/appContext
 *
 * This module provides a central registry for core app dependencies.
 * Instead of using lazy getters like `get AppState() { return window.AppState; }`,
 * modules can import from appContext.
 *
 * ARCHITECTURE (December 2025):
 * - Primary: Grouped APIs - state(), task(), cycle(), ui(), undo(), reminder(), recurring()
 * - Legacy: Individual getters (deprecated, maintained for backwards compatibility)
 *
 * USAGE (PREFERRED - Grouped APIs):
 * ```javascript
 * import { state, task, ui } from '../core/appContext.js';
 *
 * // Access state
 * const data = state().loadMiniCycleData();
 * const appState = state().AppState;
 *
 * // Perform task operations
 * task().add('New task', false);
 *
 * // Show notifications
 * ui().showNotification('Success!', 'success');
 * ```
 *
 * USAGE (LEGACY - Individual getters):
 * ```javascript
 * import { getAppState, getShowNotification } from '../core/appContext.js';
 * const state = getAppState()?.get();
 * ```
 *
 * @version 2.0.0 - Simplified with grouped APIs
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEV_MODE = true; // Set to false in production builds

// ============================================================================
// GROUPED API STORAGE
// ============================================================================

/**
 * @typedef {Object} StateApi
 * @property {Object} AppState - Main application state
 * @property {Object} AppGlobalState - Runtime flags and temporary state
 * @property {Object} AppMeta - Application metadata (version, etc.)
 * @property {Function} loadMiniCycleData - Load current cycle data
 * @property {Function} autoSave - Trigger auto-save
 */

/**
 * @typedef {Object} TaskApi
 * @property {Function} add - Add a new task
 * @property {Function} delete - Delete a task
 * @property {Function} edit - Edit a task
 * @property {Function} handleCompleteAll - Complete all tasks
 * @property {Function} loadContext - Load task context
 * @property {Function} createDOM - Create task DOM elements
 * @property {Function} extractFromDOM - Extract task data from DOM
 * @property {Function} updateMoveArrows - Update arrow visibility
 * @property {Function} refresh - Refresh task list UI
 */

/**
 * @typedef {Object} CycleApi
 * @property {Function} load - Load a cycle
 * @property {Function} create - Show cycle creation modal
 * @property {Function} switch - Switch to another cycle
 * @property {Function} rename - Rename a cycle
 * @property {Function} delete - Delete a cycle
 * @property {Function} check - Check cycle completion
 * @property {Function} initializeModeSelector - Initialize mode selector
 */

/**
 * @typedef {Object} UiApi
 * @property {Function} showNotification - Show a notification
 * @property {Function} showConfirmationModal - Show confirmation dialog
 * @property {Function} showPromptModal - Show prompt dialog
 * @property {Function} hideMainMenu - Hide the main menu
 * @property {Function} updateMainMenuHeader - Update menu header
 * @property {Function} closeAllModals - Close all open modals
 * @property {Function} resetNotificationPosition - Reset notification position
 */

/**
 * @typedef {Object} UndoApi
 * @property {Function} capture - Capture state snapshot
 * @property {Function} undo - Perform undo
 * @property {Function} redo - Perform redo
 * @property {Function} updateButtons - Update undo/redo button states
 * @property {Function} enableOnFirstInteraction - Enable undo on first user action
 */

/**
 * @typedef {Object} ReminderApi
 * @property {Object} manager - Reminder manager instance
 * @property {Function} start - Start reminders
 * @property {Function} stop - Stop reminders
 * @property {Function} updateButtons - Update reminder button states
 * @property {Function} loadSettings - Load reminder settings
 */

/**
 * @typedef {Object} RecurringApi
 * @property {Object} panel - Recurring panel instance
 * @property {Object} core - Recurring core functionality
 * @property {Function} openForTask - Open settings panel for a task
 */

/**
 * @typedef {Object} UtilsApi
 * @property {Object} GlobalUtils - Global utility functions
 * @property {Object} DataValidator - Data validation class
 * @property {Function} sanitizeInput - Sanitize user input
 * @property {Function} generateId - Generate unique ID
 * @property {Function} generateHashId - Generate hash ID
 * @property {Function} safeAddEventListener - Add event listener safely
 * @property {Function} isTouchDevice - Check if touch device
 */

const apis = {
    state: null,
    task: null,
    cycle: null,
    ui: null,
    undo: null,
    reminder: null,
    recurring: null,
    utils: null
};

// ============================================================================
// LEGACY INDIVIDUAL VALUES (for backwards compatibility)
// ============================================================================

const legacy = {
    // Core
    AppState: null,
    appInit: null,
    AppGlobalState: null,
    AppMeta: null,
    FeatureFlags: null,
    loadMiniCycleData: null,
    autoSave: null,
    fixTaskValidationIssues: null,

    // Managers
    BackupManager: null,
    CycleManager: null,
    ModeManager: null,
    MenuManager: null,
    SettingsManager: null,
    reminderManager: null,
    gamesManager: null,
    onboardingManager: null,
    deviceDetectionManager: null,
    modalManager: null,
    cycleSwitcher: null,
    statsPanelManager: null,
    completedTasksManager: null,

    // UI Functions
    completeInitialSetup: null,
    showCycleCreationModal: null,
    hideMainMenu: null,
    updateMainMenuHeader: null,
    closeAllModals: null,

    // Notifications
    notifications: null,
    showNotification: null,
    showConfirmationModal: null,
    showPromptModal: null,
    resetNotificationPosition: null,

    // Utilities
    GlobalUtils: null,
    DataValidator: null,
    sanitizeInput: null,
    generateId: null,
    generateHashId: null,
    safeAddEventListener: null,
    safeAddEventListenerById: null,
    isTouchDevice: null,

    // Undo/Redo
    performStateBasedUndo: null,
    performStateBasedRedo: null,
    updateUndoRedoButtons: null,
    captureStateSnapshot: null,

    // Reminders
    updateReminderButtons: null,
    startReminders: null,
    remindOverdueTasks: null,
    loadRemindersSettings: null,

    // Recurring
    recurringPanel: null,
    openRecurringSettingsPanelForTask: null,

    // Mode
    initializeModeSelector: null,

    // Task
    updateMoveArrowsVisibility: null,
    addTask: null,
    validateAndSanitizeTaskInput: null,
    loadTaskContext: null,
    createTaskDOMElements: null,
    createOrUpdateTaskData: null,
    handleCompleteAllTasks: null,
    extractTaskDataFromDOM: null,
    initCompletedTasksSection: null,
    TaskCore: null,
    TaskDOMManager: null,
    handleTaskCompletionChange: null,
    saveCurrentTaskOrder: null,
    resetTasks: null,

    // Cycle
    switchMiniCycle: null,
    renameMiniCycle: null,
    deleteMiniCycle: null,

    // Features
    updateDueDateVisibility: null,
    checkOverdueTasks: null,
    organizeCompletedTasks: null,
    updateThemeColor: null,
    PullToRefresh: null
};

// Track initialization
let isInitialized = false;

// ============================================================================
// GROUPED API REGISTRATION & ACCESS
// ============================================================================

/**
 * Register a grouped API
 * @param {string} name - API name (state, task, cycle, ui, undo, reminder, recurring, utils)
 * @param {Object} api - API object with methods
 */
export function registerApi(name, api) {
    if (!(name in apis)) {
        console.warn(`⚠️ appContext: Unknown API "${name}"`);
        return;
    }
    apis[name] = api;
    console.log(`✅ appContext: ${name} API registered`);
}

/**
 * Get a grouped API
 * @param {string} name - API name
 * @returns {Object|null} API object or null if not yet registered
 */
export function getApi(name) {
    if (!(name in apis)) {
        if (DEV_MODE) {
            console.warn(`⚠️ appContext: Unknown API "${name}"`);
        }
        return null;
    }
    if (apis[name] === null) {
        // Return null to allow optional chaining (e.g., getCycleApi?.()?.load)
        // This is expected during boot when APIs are set up with late binding
        return null;
    }
    return apis[name];
}

// Typed API accessors (preferred usage)
/** @returns {StateApi} */
export const state = () => getApi('state');

/** @returns {TaskApi} */
export const task = () => getApi('task');

/** @returns {CycleApi} */
export const cycle = () => getApi('cycle');

/** @returns {UiApi} */
export const ui = () => getApi('ui');

/** @returns {UndoApi} */
export const undo = () => getApi('undo');

/** @returns {ReminderApi} */
export const reminder = () => getApi('reminder');

/** @returns {RecurringApi} */
export const recurring = () => getApi('recurring');

/** @returns {UtilsApi} */
export const utils = () => getApi('utils');

// ============================================================================
// GROUPED API GETTERS (Alternative naming for existing code)
// ============================================================================

export function getStateApi() { return getApi('state'); }
export function getTaskApi() { return getApi('task'); }
export function getCycleApi() { return getApi('cycle'); }
export function getUiApi() { return getApi('ui'); }
export function getUndoApi() { return getApi('undo'); }
export function getReminderApi() { return getApi('reminder'); }
export function getRecurringApi() { return getApi('recurring'); }
export function getUtilsApi() { return getApi('utils'); }

// ============================================================================
// LEGACY API SUPPORT
// ============================================================================

/**
 * Initialize the app context with legacy dependencies
 * @deprecated Use registerApi() for grouped APIs instead
 * @param {Object} deps - Dependencies to register
 */
export function initAppContext(deps) {
    Object.keys(deps).forEach(key => {
        if (key in legacy) {
            legacy[key] = deps[key];
        } else if (key in apis) {
            apis[key] = deps[key];
        } else {
            console.warn(`⚠️ appContext: Unknown key "${key}"`);
        }
    });
    isInitialized = true;
    console.log('✅ appContext initialized with:', Object.keys(deps).filter(k => deps[k] != null));
}

/**
 * Set a single context value
 * @param {string} key - Context key
 * @param {*} value - Value to set
 */
export function setContextValue(key, value) {
    if (key in apis) {
        apis[key] = value;
    } else if (key in legacy) {
        legacy[key] = value;
    } else {
        // Allow dynamic addition for backwards compatibility
        legacy[key] = value;
    }
}

/**
 * Check if context is initialized
 * @returns {boolean}
 */
export function isContextReady() {
    return isInitialized;
}

/**
 * Validate all grouped APIs are registered
 * @returns {boolean}
 */
export function validateAllApisRegistered() {
    const missing = Object.entries(apis)
        .filter(([_, v]) => v === null)
        .map(([k]) => k);

    if (missing.length > 0) {
        console.warn(`⚠️ appContext: Missing APIs: ${missing.join(', ')}`);
        if (DEV_MODE) {
            // In dev mode, warn but don't throw - some APIs may be optional
            console.trace();
        }
        return false;
    }

    console.log('✅ appContext validation passed - all APIs registered');
    return true;
}

// ============================================================================
// LEGACY GETTERS (Deprecated - use grouped APIs instead)
// ============================================================================

// Core
export function getAppState() { return legacy.AppState; }
export function getAppInit() { return legacy.appInit; }
export function getAppGlobalState() { return legacy.AppGlobalState; }
export function getFeatureFlags() { return legacy.FeatureFlags; }
export function getLoadMiniCycleData() { return legacy.loadMiniCycleData; }
export function getAutoSave() { return legacy.autoSave; }
export function getFixTaskValidationIssues() { return legacy.fixTaskValidationIssues; }

// Managers
export function getBackupManager() { return legacy.BackupManager; }
export function getCycleManager() { return legacy.CycleManager; }
export function getModeManager() { return legacy.ModeManager; }
export function getMenuManager() { return legacy.MenuManager; }
export function getSettingsManager() { return legacy.SettingsManager; }
export function getReminderManager() { return legacy.reminderManager; }
export function getGamesManager() { return legacy.gamesManager; }
export function getOnboardingManager() { return legacy.onboardingManager; }
export function getDeviceDetectionManager() { return legacy.deviceDetectionManager; }
export function getModalManager() { return legacy.modalManager; }
export function getCycleSwitcher() { return legacy.cycleSwitcher; }

// UI Functions
export function getCompleteInitialSetup() { return legacy.completeInitialSetup; }
export function getShowCycleCreationModal() { return legacy.showCycleCreationModal; }
export function getHideMainMenu() { return legacy.hideMainMenu; }
export function getUpdateMainMenuHeader() { return legacy.updateMainMenuHeader; }
export function getCloseAllModals() { return legacy.closeAllModals; }

// Notifications
export function getNotifications() { return legacy.notifications; }
export function getShowNotification() { return legacy.showNotification; }
export function getShowConfirmationModal() { return legacy.showConfirmationModal; }
export function getShowPromptModal() { return legacy.showPromptModal; }
export function getResetNotificationPosition() { return legacy.resetNotificationPosition; }

// Utilities
export function getGlobalUtils() { return legacy.GlobalUtils; }
export function getDataValidator() { return legacy.DataValidator; }
export function getSanitizeInput() { return legacy.sanitizeInput; }
export function getGenerateId() { return legacy.generateId; }
export function getGenerateHashId() { return legacy.generateHashId; }
export function getSafeAddEventListener() { return legacy.safeAddEventListener; }
export function getSafeAddEventListenerById() { return legacy.safeAddEventListenerById; }
export function getIsTouchDevice() { return legacy.isTouchDevice; }

// Undo/Redo
export function getPerformStateBasedUndo() { return legacy.performStateBasedUndo; }
export function getPerformStateBasedRedo() { return legacy.performStateBasedRedo; }
export function getUpdateUndoRedoButtons() { return legacy.updateUndoRedoButtons; }
export function getCaptureStateSnapshot() { return legacy.captureStateSnapshot; }

// Reminders
export function getUpdateReminderButtons() { return legacy.updateReminderButtons; }
export function getStartReminders() { return legacy.startReminders; }
export function getRemindOverdueTasks() { return legacy.remindOverdueTasks; }
export function getLoadRemindersSettings() { return legacy.loadRemindersSettings; }

// Recurring
export function getRecurringPanel() { return legacy.recurringPanel; }
export function getOpenRecurringSettingsPanelForTask() { return legacy.openRecurringSettingsPanelForTask; }

// Mode
export function getInitializeModeSelector() { return legacy.initializeModeSelector; }

// Task
export function getUpdateMoveArrowsVisibility() { return legacy.updateMoveArrowsVisibility; }
export function getAddTask() { return legacy.addTask; }
export function getValidateAndSanitizeTaskInput() { return legacy.validateAndSanitizeTaskInput; }
export function getLoadTaskContext() { return legacy.loadTaskContext; }
export function getCreateTaskDOMElements() { return legacy.createTaskDOMElements; }
export function getCreateOrUpdateTaskData() { return legacy.createOrUpdateTaskData; }
export function getHandleCompleteAllTasks() { return legacy.handleCompleteAllTasks; }
export function getExtractTaskDataFromDOM() { return legacy.extractTaskDataFromDOM; }
export function getInitCompletedTasksSection() { return legacy.initCompletedTasksSection; }
export function getTaskCoreClass() { return legacy.TaskCore; }
export function getTaskDOMManager() { return legacy.TaskDOMManager; }
export function getHandleTaskCompletionChange() { return legacy.handleTaskCompletionChange; }
export function getSaveCurrentTaskOrder() { return legacy.saveCurrentTaskOrder; }
export function getResetTasks() { return legacy.resetTasks; }

// Cycle
export function getSwitchMiniCycle() { return legacy.switchMiniCycle; }
export function getRenameMiniCycle() { return legacy.renameMiniCycle; }
export function getDeleteMiniCycle() { return legacy.deleteMiniCycle; }

// Features
export function getUpdateDueDateVisibility() { return legacy.updateDueDateVisibility; }
export function getCheckOverdueTasks() { return legacy.checkOverdueTasks; }
export function getOrganizeCompletedTasks() { return legacy.organizeCompletedTasks; }
export function getUpdateThemeColor() { return legacy.updateThemeColor; }
export function getPullToRefresh() { return legacy.PullToRefresh; }

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Get full context (for debugging)
 * @returns {Object} Copy of all registered values
 */
export function getAppContext() {
    return {
        apis: { ...apis },
        legacy: { ...legacy }
    };
}

/**
 * Create a lazy deps object for DI
 * @returns {Object} Object with getters for current values
 */
export function createLazyDeps() {
    return {
        get AppState() { return legacy.AppState; },
        get appInit() { return legacy.appInit; },
        get AppGlobalState() { return legacy.AppGlobalState; },
        get loadMiniCycleData() { return legacy.loadMiniCycleData; },
        get autoSave() { return legacy.autoSave; },
        get GlobalUtils() { return legacy.GlobalUtils; },
        get showNotification() { return legacy.showNotification; },
        get hideMainMenu() { return legacy.hideMainMenu; }
    };
}

console.log('📦 appContext module loaded (v2.0 - grouped APIs)');
