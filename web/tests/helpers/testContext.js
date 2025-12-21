/**
 * @file testContext.js
 * @description Centralized access to app dependencies for tests
 * @module tests/helpers/testContext
 *
 * This module re-exports appContext getters for test usage.
 * Tests should import from here instead of accessing window.* directly.
 *
 * Usage:
 *   import { getTestAppState, getTestBackupManager } from './helpers/testContext.js';
 *   getTestAppState().get()
 *   getTestBackupManager().createBackup()
 *
 * Architecture (Dec 2025):
 * - testContext imports from appContext (single source of truth)
 * - No window.* access - clean DI architecture
 * - Tests get same values as production code
 */

import {
    // Core state
    getAppState,
    getAppInit,
    getAppGlobalState,
    getFeatureFlags,

    // Data functions
    getLoadMiniCycleData,
    getAutoSave,

    // Managers
    getBackupManager,
    getRoutineManager,
    getModeManager,
    getMenuManager,
    getSettingsManager,
    getErrorHandler,
    getReminderManager,
    getGamesManager,
    getOnboardingManagerClass,
    getOnboardingManager,
    getDragDropManager,
    getDeviceDetectionManagerClass,
    getDeviceDetectionManager,
    getModalManagerClass,
    getModalManager,
    getCloseAllModals,
    getRoutineSwitcherClass,
    getRoutineSwitcher,

    // UI functions
    getCompleteInitialSetup,
    getShowCycleCreationModal,
    getHideMainMenu,
    getUpdateMainMenuHeader,
    getShowLoader,
    getHideLoader,
    getWithLoader,

    // Notifications
    getNotifications,
    getShowNotification,
    getShowConfirmationModal,
    getShowPromptModal,
    getResetNotificationPosition,

    // Utilities
    getGlobalUtils,
    getDataValidator,
    getSanitizeInput,
    getGenerateId,
    getGenerateHashId,
    getSafeAddEventListener,
    getSafeAddEventListenerById,
    getIsTouchDevice,

    // Undo/Redo
    getPerformStateBasedUndo,
    getPerformStateBasedRedo,
    getUpdateUndoRedoButtons,
    getCaptureStateSnapshot,

    // Reminders
    getUpdateReminderButtons,
    getStartReminders,
    getRemindOverdueTasks,
    getLoadRemindersSettings,

    // Recurring
    getRecurringPanel,
    getOpenRecurringSettingsPanelForTask,

    // Mode
    getInitializeModeSelector,

    // Task functions
    getUpdateMoveArrowsVisibility,
    getAddTask,
    getValidateAndSanitizeTaskInput,
    getLoadTaskContext,
    getCreateTaskDOMElements,
    getCreateOrUpdateTaskData,
    getFixTaskValidationIssues,
    getTaskRenderer,
    getTaskDOMManager,
    getTaskEvents,
    getTaskUtils,
    getTaskOptionsCustomizer,

    // Cycle Switcher
    getSwitchMiniCycle,
    getRenameMiniCycle,
    getDeleteMiniCycle,
    getConfirmMiniCycle,
    getHideSwitchMiniCycleModal,
    getUpdatePreview,
    getLoadMiniCycleList,
    getSetupModalClickOutside,

    // Features
    getPullToRefresh,
    getMiniCycleReminders,
    getMiniCycleNotifications,
    getEducationalTipManager,

    // Testing
    getConsoleCapture,
    getAppendToTestResults,

    // Convenience
    getAppContext,
    isContextReady
} from '../../modules/core/appContext.js';

// ============================================================================
// CORE STATE GETTERS
// ============================================================================

export function getTestAppState() { return getAppState(); }
export function getTestAppInit() { return getAppInit(); }
export function getTestAppGlobalState() { return getAppGlobalState(); }
export function getTestFeatureFlags() { return getFeatureFlags(); }
export function getTestLoadMiniCycleData() { return getLoadMiniCycleData(); }

// ============================================================================
// MANAGER GETTERS
// ============================================================================

export function getTestBackupManager() { return getBackupManager(); }
export function getTestRoutineManager() { return getRoutineManager(); }
export function getTestModeManager() { return getModeManager(); }
export function getTestMenuManager() { return getMenuManager(); }
export function getTestSettingsManager() { return getSettingsManager(); }
export function getTestErrorHandler() { return getErrorHandler(); }
export function getTestReminderManager() { return getReminderManager(); }

// Classes + instances
export function getTestOnboardingManager() { return getOnboardingManagerClass(); }
export function getTestOnboardingManagerInstance() { return getOnboardingManager(); }
export function getTestDragDropManager() { return getDragDropManager(); }
export function getTestDeviceDetectionManager() { return getDeviceDetectionManagerClass(); }
export function getTestDeviceDetectionManagerInstance() { return getDeviceDetectionManager(); }
export function getTestModalManager() { return getModalManagerClass(); }
export function getTestModalManagerInstance() { return getModalManager(); }
export function getTestRoutineSwitcher() { return getRoutineSwitcherClass(); }
export function getTestRoutineSwitcherInstance() { return getRoutineSwitcher(); }

// ============================================================================
// UI FUNCTION GETTERS
// ============================================================================

export function getTestShowNotification() { return getShowNotification(); }
export function getTestHideMainMenu() { return getHideMainMenu(); }
export function getTestShowLoader() { return getShowLoader(); }
export function getTestHideLoader() { return getHideLoader(); }
export function getTestWithLoader() { return getWithLoader(); }

// ============================================================================
// UTILITY GETTERS
// ============================================================================

export function getTestGlobalUtils() { return getGlobalUtils(); }
export function getTestDataValidator() { return getDataValidator(); }
export function getTestSanitizeInput() { return getSanitizeInput(); }
export function getTestGenerateId() { return getGenerateId(); }
export function getTestGenerateHashId() { return getGenerateHashId(); }
export function getTestSafeAddEventListener() { return getSafeAddEventListener(); }
export function getTestIsTouchDevice() { return getIsTouchDevice(); }

// ============================================================================
// TASK GETTERS
// ============================================================================

export function getTestAddTask() { return getAddTask(); }
export function getTestUpdateMoveArrowsVisibility() { return getUpdateMoveArrowsVisibility(); }
export function getTestTaskRenderer() { return getTaskRenderer(); }
export function getTestTaskDOMManager() { return getTaskDOMManager(); }
export function getTestTaskEvents() { return getTaskEvents(); }
export function getTestTaskUtils() { return getTaskUtils(); }
export function getTestTaskOptionsCustomizer() { return getTaskOptionsCustomizer(); }

// ============================================================================
// ROUTINE SWITCHER GETTERS
// ============================================================================

export function getTestSwitchMiniCycle() { return getSwitchMiniCycle(); }
export function getTestRenameMiniCycle() { return getRenameMiniCycle(); }
export function getTestDeleteMiniCycle() { return getDeleteMiniCycle(); }
export function getTestConfirmMiniCycle() { return getConfirmMiniCycle(); }
export function getTestHideSwitchMiniCycleModal() { return getHideSwitchMiniCycleModal(); }
export function getTestUpdatePreview() { return getUpdatePreview(); }
export function getTestLoadMiniCycleList() { return getLoadMiniCycleList(); }
export function getTestSetupModalClickOutside() { return getSetupModalClickOutside(); }

// ============================================================================
// FEATURE GETTERS
// ============================================================================

export function getTestPullToRefresh() { return getPullToRefresh(); }
export function getTestMiniCycleReminders() { return getMiniCycleReminders(); }
export function getTestMiniCycleNotifications() { return getMiniCycleNotifications(); }
export function getTestEducationalTipManager() { return getEducationalTipManager(); }

// ============================================================================
// UNDO/REDO GETTERS
// ============================================================================

export function getTestPerformStateBasedUndo() { return getPerformStateBasedUndo(); }
export function getTestPerformStateBasedRedo() { return getPerformStateBasedRedo(); }
export function getTestCaptureStateSnapshot() { return getCaptureStateSnapshot(); }
export function getTestUpdateUndoRedoButtons() { return getUpdateUndoRedoButtons(); }

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Wait for the app context to be initialized
 * @param {number} timeout - Max wait time in ms (default: 5000)
 * @returns {Promise<boolean>} True if ready, false if timeout
 */
export async function waitForAppReady(timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (isContextReady()) {
            const appState = getAppState();
            if (appState && typeof appState.isReady === 'function' && appState.isReady()) {
                return true;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.warn('[testContext] Timeout waiting for app ready');
    return false;
}

/**
 * Check if a context value exists
 * @param {string} name - Name to check
 * @returns {boolean}
 */
export function hasContextValue(name) {
    const ctx = getAppContext();
    return ctx[name] != null;
}

/**
 * Alias for hasContextValue for backward compatibility with tests
 * @param {string} name - Name to check
 * @returns {boolean}
 */
export function hasGlobal(name) {
    return hasContextValue(name);
}

/**
 * Get all available test values as an object
 * @returns {Object}
 */
export function getAllTestGlobals() {
    return {
        // Core
        AppState: getTestAppState(),
        AppGlobalState: getTestAppGlobalState(),
        FeatureFlags: getTestFeatureFlags(),
        appInit: getTestAppInit(),
        loadMiniCycleData: getTestLoadMiniCycleData(),
        showNotification: getTestShowNotification(),
        hideMainMenu: getTestHideMainMenu(),

        // Managers
        BackupManager: getTestBackupManager(),
        RoutineManager: getTestRoutineManager(),
        ModeManager: getTestModeManager(),
        MenuManager: getTestMenuManager(),
        ModalManager: getTestModalManager(),
        modalManager: getTestModalManagerInstance(),
        OnboardingManager: getTestOnboardingManager(),
        onboardingManager: getTestOnboardingManagerInstance(),
        DragDropManager: getTestDragDropManager(),
        SettingsManager: getTestSettingsManager(),
        DeviceDetectionManager: getTestDeviceDetectionManager(),
        deviceDetectionManager: getTestDeviceDetectionManagerInstance(),
        ErrorHandler: getTestErrorHandler(),
        RoutineSwitcher: getTestRoutineSwitcher(),
        routineSwitcher: getTestRoutineSwitcherInstance(),
        reminderManager: getTestReminderManager(),

        // Task
        TaskRenderer: getTestTaskRenderer(),
        TaskDOMManager: getTestTaskDOMManager(),
        TaskEvents: getTestTaskEvents(),
        TaskUtils: getTestTaskUtils(),
        TaskOptionsCustomizer: getTestTaskOptionsCustomizer(),
        addTask: getTestAddTask(),
        updateMoveArrowsVisibility: getTestUpdateMoveArrowsVisibility(),

        // Routine Switcher Functions
        switchMiniCycle: getTestSwitchMiniCycle(),
        renameMiniCycle: getTestRenameMiniCycle(),
        deleteMiniCycle: getTestDeleteMiniCycle(),
        confirmMiniCycle: getTestConfirmMiniCycle(),
        hideSwitchMiniCycleModal: getTestHideSwitchMiniCycleModal(),
        updatePreview: getTestUpdatePreview(),
        loadMiniCycleList: getTestLoadMiniCycleList(),
        setupModalClickOutside: getTestSetupModalClickOutside(),

        // Features
        PullToRefresh: getTestPullToRefresh(),
        MiniCycleReminders: getTestMiniCycleReminders(),
        MiniCycleNotifications: getTestMiniCycleNotifications(),
        EducationalTipManager: getTestEducationalTipManager(),

        // Utilities
        GlobalUtils: getTestGlobalUtils(),
        DataValidator: getTestDataValidator(),
        sanitizeInput: getTestSanitizeInput(),
        generateId: getTestGenerateId(),
        generateHashId: getTestGenerateHashId(),
        safeAddEventListener: getTestSafeAddEventListener(),

        // UI Helpers
        showLoader: getTestShowLoader(),
        hideLoader: getTestHideLoader(),
        withLoader: getTestWithLoader(),
        isTouchDevice: getTestIsTouchDevice(),

        // Undo/Redo
        performStateBasedUndo: getTestPerformStateBasedUndo(),
        performStateBasedRedo: getTestPerformStateBasedRedo(),
        captureStateSnapshot: getTestCaptureStateSnapshot(),
        updateUndoRedoButtons: getTestUpdateUndoRedoButtons()
    };
}

/**
 * Assert that required context values exist
 * @param {string[]} names - Names to check
 * @throws {Error} If any required value is missing
 */
export function requireContextValues(...names) {
    const missing = names.filter(name => !hasContextValue(name));
    if (missing.length > 0) {
        throw new Error(`Required context values not found: ${missing.join(', ')}`);
    }
}

console.log('[testContext] Test context helpers loaded (using appContext)');
