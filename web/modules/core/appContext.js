/**
 * @file appContext.js
 * @description Centralized app context for dependency access without window.* globals
 * @module modules/core/appContext
 *
 * This module provides a central registry for core app dependencies.
 * Instead of using lazy getters like `get AppState() { return window.AppState; }`,
 * modules can import from appContext.
 *
 * Usage:
 *   import { getAppState, getAppInit } from '../core/appContext.js';
 *   const state = getAppState()?.get();
 *
 * Initialization (in coreBoot.js):
 *   import { initAppContext } from '../core/appContext.js';
 *   initAppContext({ AppState, appInit, ... });
 */

// Internal context storage
const context = {
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
// GETTERS - Use these in modules instead of window.*
// ============================================================================

/**
 * Get AppState instance
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

console.log('📦 appContext module loaded');
