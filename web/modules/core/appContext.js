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
 * - Grouped APIs: getStateApi(), getTaskApi(), getCycleApi(), etc.
 * - Dev protection: assertRegistered() throws if API accessed before registration
 * - Post-boot validation: validateAllApisRegistered() catches missing registrations
 *
 * Usage:
 *   // PREFERRED: Grouped APIs
 *   import { getStateApi, getTaskApi } from '../core/appContext.js';
 *   const state = getStateApi().AppState.get();
 *   getTaskApi().add(taskText, false);
 *
 *   // LEGACY: Individual getters (being phased out)
 *   import { getAppState, getAppInit } from '../core/appContext.js';
 *   const state = getAppState()?.get();
 *
 * Initialization (in coreBoot.js):
 *   import { setContextValue } from '../core/appContext.js';
 *   setContextValue('stateApi', { AppState, AppGlobalState, ... });
 */

// ============================================================================
// DEV MODE PROTECTION
// ============================================================================

const DEV_MODE = true; // Set to false in production builds

/**
 * Assert that a context key is registered before access
 * In dev mode, throws an error with stack trace
 * In prod mode, logs error but continues
 * @param {string} key - Context key to check
 */
function assertRegistered(key) {
    if (context[key] === null) {
        const error = `❌ appContext: "${key}" accessed before registration!`;
        console.error(error);
        console.trace(); // Show call stack to identify the caller

        if (DEV_MODE) {
            throw new Error(error);
        }
    }
}

// ============================================================================
// INTERNAL CONTEXT STORAGE
// ============================================================================

const context = {
    // =========================================================================
    // GROUPED APIs (PREFERRED - use these for new code)
    // =========================================================================
    stateApi: null,      // { AppState, AppGlobalState, AppMeta, loadMiniCycleData, autoSave }
    taskApi: null,       // { add, loadContext, createDOM, extractFromDOM, handleCompleteAll, ... }
    cycleApi: null,      // { load, create, check, createInitialSchema, ... }
    uiApi: null,         // { showNotification, hideMainMenu, updateMainMenuHeader, ... }
    undoApi: null,       // { capture, undo, redo, updateButtons, enableOnFirstInteraction }
    reminderApi: null,   // { manager, start, stop, updateButtons, loadSettings }
    recurringApi: null,  // { panel, core, openSettingsForTask }

    // =========================================================================
    // INDIVIDUAL VALUES (LEGACY - being migrated to grouped APIs)
    // =========================================================================

    // =========================================================================
    // CORE STATE
    // =========================================================================
    AppState: null,
    appInit: null,
    AppGlobalState: null,
    FeatureFlags: null,

    // =========================================================================
    // DATA FUNCTIONS
    // =========================================================================
    loadMiniCycleData: null,
    autoSave: null,

    // =========================================================================
    // MANAGERS (Singletons/Instances)
    // =========================================================================
    BackupManager: null,
    CycleManager: null,
    ModeManager: null,
    MenuManager: null,
    SettingsManager: null,
    ErrorHandler: null,
    reminderManager: null,
    gamesManager: null,

    // Manager classes + instances
    OnboardingManager: null,
    onboardingManager: null,
    DragDropManager: null,
    DeviceDetectionManager: null,
    deviceDetectionManager: null,
    ModalManager: null,
    modalManager: null,
    CycleSwitcher: null,
    cycleSwitcher: null,

    // =========================================================================
    // UI FUNCTIONS
    // =========================================================================
    completeInitialSetup: null,
    showCycleCreationModal: null,
    hideMainMenu: null,
    updateMainMenuHeader: null,
    showLoader: null,
    hideLoader: null,
    withLoader: null,

    // =========================================================================
    // NOTIFICATIONS
    // =========================================================================
    notifications: null,
    showNotification: null,
    showConfirmationModal: null,
    showPromptModal: null,
    resetNotificationPosition: null,

    // =========================================================================
    // UTILITIES
    // =========================================================================
    GlobalUtils: null,
    DataValidator: null,
    sanitizeInput: null,
    generateId: null,
    generateHashId: null,
    safeAddEventListener: null,
    safeAddEventListenerById: null,
    isTouchDevice: null,

    // =========================================================================
    // UNDO/REDO
    // =========================================================================
    performStateBasedUndo: null,
    performStateBasedRedo: null,
    updateUndoRedoButtons: null,
    captureStateSnapshot: null,

    // =========================================================================
    // REMINDERS
    // =========================================================================
    updateReminderButtons: null,
    startReminders: null,
    remindOverdueTasks: null,
    loadRemindersSettings: null,

    // =========================================================================
    // RECURRING
    // =========================================================================
    recurringPanel: null,
    openRecurringSettingsPanelForTask: null,

    // =========================================================================
    // MODE
    // =========================================================================
    initializeModeSelector: null,

    // =========================================================================
    // TASK FUNCTIONS
    // =========================================================================
    updateMoveArrowsVisibility: null,
    addTask: null,
    validateAndSanitizeTaskInput: null,
    loadTaskContext: null,
    createTaskDOMElements: null,
    createOrUpdateTaskData: null,
    fixTaskValidationIssues: null,
    handleCompleteAllTasks: null,
    initCompletedTasksSection: null,
    resumeDeferredRenderIfNeeded: null,
    extractTaskDataFromDOM: null,

    // Task classes
    TaskRenderer: null,
    TaskDOMManager: null,
    TaskEvents: null,
    TaskUtils: null,
    TaskOptionsCustomizer: null,

    // =========================================================================
    // CYCLE SWITCHER
    // =========================================================================
    switchMiniCycle: null,
    renameMiniCycle: null,
    deleteMiniCycle: null,
    confirmMiniCycle: null,
    hideSwitchMiniCycleModal: null,
    updatePreview: null,
    loadMiniCycleList: null,
    setupModalClickOutside: null,

    // =========================================================================
    // FEATURES
    // =========================================================================
    PullToRefresh: null,
    MiniCycleReminders: null,
    MiniCycleNotifications: null,
    EducationalTipManager: null,
    updateDueDateVisibility: null,
    checkOverdueTasks: null,
    organizeCompletedTasks: null,
    updateThemeColor: null,

    // =========================================================================
    // TESTING (lazy-loaded)
    // =========================================================================
    ConsoleCapture: null,
    appendToTestResults: null
};

// Track initialization state
let isInitialized = false;

/**
 * Initialize the app context with core dependencies
 * Should be called early in boot, after core systems are created
 * @param {Object} deps - Dependencies to register
 */
export function initAppContext(deps) {
    Object.keys(deps).forEach(key => {
        if (key in context) {
            context[key] = deps[key];
        } else {
            console.warn(`⚠️ appContext: Unknown dependency "${key}" - add to context object if needed`);
        }
    });
    isInitialized = true;
    console.log('✅ appContext initialized with:', Object.keys(deps).filter(k => deps[k] != null));
}

/**
 * Update a single context value (for late-bound dependencies)
 * @param {string} key - Context key to update
 * @param {*} value - New value
 */
export function setContextValue(key, value) {
    if (key in context) {
        context[key] = value;
    } else {
        console.warn(`⚠️ appContext: Unknown key "${key}"`);
    }
}

/**
 * Check if context is initialized
 * @returns {boolean}
 */
export function isContextReady() {
    return isInitialized;
}

// ============================================================================
// GROUPED API GETTERS (PREFERRED - use these for new code)
// ============================================================================

/**
 * Get State API - core state management
 * @returns {Object} { AppState, AppGlobalState, AppMeta, loadMiniCycleData, autoSave }
 */
export function getStateApi() {
    assertRegistered('stateApi');
    return context.stateApi;
}

/**
 * Get Task API - task operations
 * @returns {Object} { add, loadContext, createDOM, extractFromDOM, handleCompleteAll, ... }
 */
export function getTaskApi() {
    assertRegistered('taskApi');
    return context.taskApi;
}

/**
 * Get Cycle API - cycle management
 * @returns {Object} { load, create, check, createInitialSchema, ... }
 */
export function getCycleApi() {
    assertRegistered('cycleApi');
    return context.cycleApi;
}

/**
 * Get UI API - notifications and menus
 * @returns {Object} { showNotification, hideMainMenu, updateMainMenuHeader, ... }
 */
export function getUiApi() {
    assertRegistered('uiApi');
    return context.uiApi;
}

/**
 * Get Undo API - undo/redo operations
 * @returns {Object} { capture, undo, redo, updateButtons, enableOnFirstInteraction }
 */
export function getUndoApi() {
    assertRegistered('undoApi');
    return context.undoApi;
}

/**
 * Get Reminder API - reminder management
 * @returns {Object} { manager, start, stop, updateButtons, loadSettings }
 */
export function getReminderApi() {
    assertRegistered('reminderApi');
    return context.reminderApi;
}

/**
 * Get Recurring API - recurring task panel
 * @returns {Object} { panel, core, openSettingsForTask }
 */
export function getRecurringApi() {
    assertRegistered('recurringApi');
    return context.recurringApi;
}

/**
 * Validate that all required APIs are registered
 * Call this after boot completes, before UI listeners are attached
 * @throws {Error} if any required API is missing (in DEV_MODE)
 * @returns {boolean} true if all APIs registered
 */
export function validateAllApisRegistered() {
    const requiredApis = [
        'stateApi',
        'taskApi',
        'cycleApi',
        'uiApi',
        'undoApi',
        'reminderApi',
        'recurringApi'
    ];

    const missing = requiredApis.filter(key => context[key] === null);

    if (missing.length > 0) {
        const error = `❌ appContext validation failed! Missing APIs: ${missing.join(', ')}`;
        console.error(error);

        if (DEV_MODE) {
            throw new Error(error);
        }
        return false;
    }

    console.log('✅ appContext validation passed - all APIs registered');
    return true;
}

// ============================================================================
// INDIVIDUAL GETTERS (LEGACY - being phased out)
// Use grouped APIs above for new code
// ============================================================================

/**
 * Get AppState instance
 * @deprecated Use getStateApi().AppState instead
 * @returns {Object|null} AppState or null if not initialized
 */
export function getAppState() {
    return context.AppState;
}

/**
 * Get appInit instance
 * @returns {Object|null} appInit or null if not initialized
 */
export function getAppInit() {
    return context.appInit;
}

/**
 * Get AppGlobalState (runtime flags)
 * @returns {Object|null}
 */
export function getAppGlobalState() {
    return context.AppGlobalState;
}

/**
 * Get FeatureFlags
 * @returns {Object|null}
 */
export function getFeatureFlags() {
    return context.FeatureFlags;
}

/**
 * Get loadMiniCycleData function
 * @returns {Function|null}
 */
export function getLoadMiniCycleData() {
    return context.loadMiniCycleData;
}

/**
 * Get autoSave function
 * @returns {Function|null}
 */
export function getAutoSave() {
    return context.autoSave;
}

/**
 * Get completeInitialSetup function
 * @returns {Function|null}
 */
export function getCompleteInitialSetup() {
    return context.completeInitialSetup;
}

/**
 * Get showCycleCreationModal function
 * @returns {Function|null}
 */
export function getShowCycleCreationModal() {
    return context.showCycleCreationModal;
}

/**
 * Get hideMainMenu function
 * @returns {Function|null}
 */
export function getHideMainMenu() {
    return context.hideMainMenu;
}

/**
 * Get GlobalUtils object
 * @returns {Object|null}
 */
export function getGlobalUtils() {
    return context.GlobalUtils;
}

/**
 * Get showNotification function
 * @returns {Function|null}
 */
export function getShowNotification() {
    return context.showNotification;
}

/**
 * Get ConsoleCapture (testing)
 * @returns {Object|null}
 */
export function getConsoleCapture() {
    return context.ConsoleCapture;
}

/**
 * Get appendToTestResults (testing)
 * @returns {Function|null}
 */
export function getAppendToTestResults() {
    return context.appendToTestResults;
}

// ============================================================================
// UI GETTERS
// ============================================================================

/**
 * Get updateMainMenuHeader function
 * @returns {Function|null}
 */
export function getUpdateMainMenuHeader() {
    return context.updateMainMenuHeader;
}

/**
 * Get resetNotificationPosition function
 * @returns {Function|null}
 */
export function getResetNotificationPosition() {
    return context.resetNotificationPosition;
}

// ============================================================================
// UNDO/REDO GETTERS
// ============================================================================

/**
 * Get performStateBasedUndo function
 * @returns {Function|null}
 */
export function getPerformStateBasedUndo() {
    return context.performStateBasedUndo;
}

/**
 * Get performStateBasedRedo function
 * @returns {Function|null}
 */
export function getPerformStateBasedRedo() {
    return context.performStateBasedRedo;
}

/**
 * Get updateUndoRedoButtons function
 * @returns {Function|null}
 */
export function getUpdateUndoRedoButtons() {
    return context.updateUndoRedoButtons;
}

/**
 * Get captureStateSnapshot function
 * @returns {Function|null}
 */
export function getCaptureStateSnapshot() {
    return context.captureStateSnapshot;
}

// ============================================================================
// REMINDER GETTERS
// ============================================================================

/**
 * Get updateReminderButtons function
 * @returns {Function|null}
 */
export function getUpdateReminderButtons() {
    return context.updateReminderButtons;
}

/**
 * Get startReminders function
 * @returns {Function|null}
 */
export function getStartReminders() {
    return context.startReminders;
}

/**
 * Get remindOverdueTasks function
 * @returns {Function|null}
 */
export function getRemindOverdueTasks() {
    return context.remindOverdueTasks;
}

/**
 * Get loadRemindersSettings function
 * @returns {Function|null}
 */
export function getLoadRemindersSettings() {
    return context.loadRemindersSettings;
}

// ============================================================================
// FEATURE GETTERS (Due Dates, Completed Tasks, Theme)
// ============================================================================

/**
 * Get updateDueDateVisibility function
 * @returns {Function|null}
 */
export function getUpdateDueDateVisibility() {
    return context.updateDueDateVisibility;
}

/**
 * Get checkOverdueTasks function
 * @returns {Function|null}
 */
export function getCheckOverdueTasks() {
    return context.checkOverdueTasks;
}

/**
 * Get organizeCompletedTasks function
 * @returns {Function|null}
 */
export function getOrganizeCompletedTasks() {
    return context.organizeCompletedTasks;
}

/**
 * Get updateThemeColor function
 * @returns {Function|null}
 */
export function getUpdateThemeColor() {
    return context.updateThemeColor;
}

// ============================================================================
// RECURRING GETTERS
// ============================================================================

/**
 * Get recurringPanel instance
 * @returns {Object|null}
 */
export function getRecurringPanel() {
    return context.recurringPanel;
}

/**
 * Get openRecurringSettingsPanelForTask function
 * @returns {Function|null}
 */
export function getOpenRecurringSettingsPanelForTask() {
    return context.openRecurringSettingsPanelForTask;
}

// ============================================================================
// MODE GETTERS
// ============================================================================

/**
 * Get initializeModeSelector function
 * @returns {Function|null}
 */
export function getInitializeModeSelector() {
    return context.initializeModeSelector;
}

// ============================================================================
// TASK GETTERS
// ============================================================================

/**
 * Get updateMoveArrowsVisibility function
 * @returns {Function|null}
 */
export function getUpdateMoveArrowsVisibility() {
    return context.updateMoveArrowsVisibility;
}

/**
 * Get addTask function
 * @returns {Function|null}
 */
export function getAddTask() {
    return context.addTask;
}

/**
 * Get validateAndSanitizeTaskInput function
 * @returns {Function|null}
 */
export function getValidateAndSanitizeTaskInput() {
    return context.validateAndSanitizeTaskInput;
}

/**
 * Get loadTaskContext function
 * @returns {Function|null}
 */
export function getLoadTaskContext() {
    return context.loadTaskContext;
}

/**
 * Get createTaskDOMElements function
 * @returns {Function|null}
 */
export function getCreateTaskDOMElements() {
    return context.createTaskDOMElements;
}

/**
 * Get createOrUpdateTaskData function
 * @returns {Function|null}
 */
export function getCreateOrUpdateTaskData() {
    return context.createOrUpdateTaskData;
}

/**
 * Get fixTaskValidationIssues function
 * @returns {Function|null}
 */
export function getFixTaskValidationIssues() {
    return context.fixTaskValidationIssues;
}

export function getHandleCompleteAllTasks() {
    return context.handleCompleteAllTasks;
}

export function getTaskCoreClass() {
    return context.TaskCore;
}

export function getHandleTaskCompletionChange() {
    return context.handleTaskCompletionChange;
}

export function getSaveCurrentTaskOrder() {
    return context.saveCurrentTaskOrder;
}

export function getResetTasks() {
    return context.resetTasks;
}

export function getInitCompletedTasksSection() {
    return context.initCompletedTasksSection;
}

export function getExtractTaskDataFromDOM() {
    return context.extractTaskDataFromDOM;
}

export function getResumeDeferredRenderIfNeeded() {
    return context.resumeDeferredRenderIfNeeded;
}

// ============================================================================
// MANAGER GETTERS
// ============================================================================

export function getBackupManager() { return context.BackupManager; }
export function getCycleManager() { return context.CycleManager; }
export function getModeManager() { return context.ModeManager; }
export function getMenuManager() { return context.MenuManager; }
export function getSettingsManager() { return context.SettingsManager; }
export function getErrorHandler() { return context.ErrorHandler; }
export function getReminderManager() { return context.reminderManager; }
export function getGamesManager() { return context.gamesManager; }

// Manager classes + instances
export function getOnboardingManagerClass() { return context.OnboardingManager; }
export function getOnboardingManager() { return context.onboardingManager; }
export function getDragDropManager() { return context.DragDropManager; }
export function getDeviceDetectionManagerClass() { return context.DeviceDetectionManager; }
export function getDeviceDetectionManager() { return context.deviceDetectionManager; }
export function getModalManagerClass() { return context.ModalManager; }
export function getModalManager() { return context.modalManager; }
export function getCycleSwitcherClass() { return context.CycleSwitcher; }
export function getCycleSwitcher() { return context.cycleSwitcher; }

// ============================================================================
// NOTIFICATION GETTERS
// ============================================================================

export function getNotifications() { return context.notifications; }
export function getShowConfirmationModal() { return context.showConfirmationModal; }
export function getShowPromptModal() { return context.showPromptModal; }

// ============================================================================
// UTILITY GETTERS
// ============================================================================

export function getDataValidator() { return context.DataValidator; }
export function getSanitizeInput() { return context.sanitizeInput; }
export function getGenerateId() { return context.generateId; }
export function getGenerateHashId() { return context.generateHashId; }
export function getSafeAddEventListener() { return context.safeAddEventListener; }
export function getSafeAddEventListenerById() { return context.safeAddEventListenerById; }
export function getIsTouchDevice() { return context.isTouchDevice; }

// ============================================================================
// UI HELPER GETTERS
// ============================================================================

export function getShowLoader() { return context.showLoader; }
export function getHideLoader() { return context.hideLoader; }
export function getWithLoader() { return context.withLoader; }

// ============================================================================
// TASK CLASS GETTERS
// ============================================================================

export function getTaskRenderer() { return context.TaskRenderer; }
export function getTaskDOMManager() { return context.TaskDOMManager; }
export function getTaskEvents() { return context.TaskEvents; }
export function getTaskUtils() { return context.TaskUtils; }
export function getTaskOptionsCustomizer() { return context.TaskOptionsCustomizer; }

// ============================================================================
// CYCLE SWITCHER GETTERS
// ============================================================================

export function getSwitchMiniCycle() { return context.switchMiniCycle; }
export function getRenameMiniCycle() { return context.renameMiniCycle; }
export function getDeleteMiniCycle() { return context.deleteMiniCycle; }
export function getConfirmMiniCycle() { return context.confirmMiniCycle; }
export function getHideSwitchMiniCycleModal() { return context.hideSwitchMiniCycleModal; }
export function getUpdatePreview() { return context.updatePreview; }
export function getLoadMiniCycleList() { return context.loadMiniCycleList; }
export function getSetupModalClickOutside() { return context.setupModalClickOutside; }

// ============================================================================
// FEATURE GETTERS
// ============================================================================

export function getPullToRefresh() { return context.PullToRefresh; }
export function getMiniCycleReminders() { return context.MiniCycleReminders; }
export function getMiniCycleNotifications() { return context.MiniCycleNotifications; }
export function getEducationalTipManager() { return context.EducationalTipManager; }

// ============================================================================
// CONVENIENCE - Get multiple values at once
// ============================================================================

/**
 * Get the full context object (readonly copy)
 * Useful for debugging or when you need multiple values
 * @returns {Object} Copy of context
 */
export function getAppContext() {
    return { ...context };
}

/**
 * Create a deps object compatible with setDependencies() calls
 * Uses getters so values are always current
 * @returns {Object} Deps object with lazy getters
 */
export function createLazyDeps() {
    return {
        // Core
        get AppState() { return context.AppState; },
        get appInit() { return context.appInit; },
        get AppGlobalState() { return context.AppGlobalState; },
        get loadMiniCycleData() { return context.loadMiniCycleData; },
        get autoSave() { return context.autoSave; },

        // UI
        get completeInitialSetup() { return context.completeInitialSetup; },
        get showCycleCreationModal() { return context.showCycleCreationModal; },
        get hideMainMenu() { return context.hideMainMenu; },
        get updateMainMenuHeader() { return context.updateMainMenuHeader; },

        // Utilities
        get GlobalUtils() { return context.GlobalUtils; },
        get showNotification() { return context.showNotification; },
        get resetNotificationPosition() { return context.resetNotificationPosition; },

        // Undo/Redo
        get performStateBasedUndo() { return context.performStateBasedUndo; },
        get performStateBasedRedo() { return context.performStateBasedRedo; },
        get updateUndoRedoButtons() { return context.updateUndoRedoButtons; },
        get captureStateSnapshot() { return context.captureStateSnapshot; },

        // Reminders
        get updateReminderButtons() { return context.updateReminderButtons; },
        get startReminders() { return context.startReminders; },
        get remindOverdueTasks() { return context.remindOverdueTasks; },
        get loadRemindersSettings() { return context.loadRemindersSettings; },

        // Recurring
        get recurringPanel() { return context.recurringPanel; },
        get openRecurringSettingsPanelForTask() { return context.openRecurringSettingsPanelForTask; },

        // Mode
        get initializeModeSelector() { return context.initializeModeSelector; },

        // Task
        get updateMoveArrowsVisibility() { return context.updateMoveArrowsVisibility; },
        get addTask() { return context.addTask; },
        get validateAndSanitizeTaskInput() { return context.validateAndSanitizeTaskInput; },
        get loadTaskContext() { return context.loadTaskContext; },
        get createTaskDOMElements() { return context.createTaskDOMElements; },
        get createOrUpdateTaskData() { return context.createOrUpdateTaskData; },
        get fixTaskValidationIssues() { return context.fixTaskValidationIssues; },

        // Testing
        get ConsoleCapture() { return context.ConsoleCapture; },
        get appendToTestResults() { return context.appendToTestResults; }
    };
}

console.log('📦 appContext module loaded (with grouped APIs + dev protection)');
