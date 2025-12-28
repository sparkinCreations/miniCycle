/**
 * @file testContext.js
 * @description Centralized access to app dependencies for tests
 * @module tests/helpers/testContext
 *
 * This module provides access to appContext values for test usage.
 * Tests should import from here instead of accessing window.* directly.
 *
 * Usage:
 *   import { getTestAppState, getTestBackupManager } from './helpers/testContext.js';
 *   getTestAppState().get()
 *   getTestBackupManager().createBackup()
 *
 * Architecture (Dec 2025):
 * - testContext uses getContextValue() from appContext
 * - No window.* access - clean DI architecture
 * - Tests get same values as production code
 */

import {
    // Grouped API accessors
    state,
    task,
    cycle,
    ui,
    undo,
    reminder,
    recurring,
    utils,
    getStateApi,
    getTaskApi,
    getCycleApi,
    getUiApi,
    getUndoApi,
    getReminderApi,
    getRecurringApi,
    getUtilsApi,

    // Context access
    getContextValue,
    getAppContext,
    isContextReady
} from '../../modules/core/appContext.js';

// ============================================================================
// CORE STATE GETTERS
// ============================================================================

export function getTestAppState() { return getContextValue('AppState'); }
export function getTestAppInit() { return getContextValue('appInit'); }
export function getTestAppGlobalState() { return getContextValue('AppGlobalState'); }
export function getTestFeatureFlags() { return getContextValue('FeatureFlags'); }
export function getTestLoadMiniCycleData() { return getContextValue('loadMiniCycleData'); }

// ============================================================================
// MANAGER GETTERS
// ============================================================================

export function getTestBackupManager() { return getContextValue('BackupManager'); }
export function getTestRoutineManager() { return getContextValue('RoutineManager'); }
export function getTestModeManager() { return getContextValue('ModeManager'); }
export function getTestMenuManager() { return getContextValue('MenuManager'); }
export function getTestSettingsManager() { return getContextValue('SettingsManager'); }
export function getTestErrorHandler() { return getContextValue('ErrorHandler'); }
export function getTestReminderManager() { return getContextValue('reminderManager'); }
export function getTestGamesManager() { return getContextValue('gamesManager'); }

// Classes + instances
export function getTestOnboardingManager() { return getContextValue('OnboardingManager'); }
export function getTestOnboardingManagerInstance() { return getContextValue('onboardingManager'); }
export function getTestDragDropManager() { return getContextValue('DragDropManager'); }
export function getTestDeviceDetectionManager() { return getContextValue('DeviceDetectionManager'); }
export function getTestDeviceDetectionManagerInstance() { return getContextValue('deviceDetectionManager'); }
export function getTestModalManager() { return getContextValue('ModalManager'); }
export function getTestModalManagerInstance() { return getContextValue('modalManager'); }
export function getTestRoutineSwitcher() { return getContextValue('RoutineSwitcher'); }
export function getTestRoutineSwitcherInstance() { return getContextValue('routineSwitcher'); }
export function getTestStatsPanelManager() { return getContextValue('statsPanelManager'); }
export function getTestCompletedTasksManager() { return getContextValue('completedTasksManager'); }

// ============================================================================
// UI FUNCTION GETTERS
// ============================================================================

export function getTestShowNotification() { return getContextValue('showNotification'); }
export function getTestHideMainMenu() { return getContextValue('hideMainMenu'); }
export function getTestUpdateMainMenuHeader() { return getContextValue('updateMainMenuHeader'); }
export function getTestShowLoader() { return ui()?.showLoader; }
export function getTestHideLoader() { return ui()?.hideLoader; }
export function getTestWithLoader() { return ui()?.withLoader; }
export function getTestCloseAllModals() { return getContextValue('closeAllModals'); }
export function getTestCompleteInitialSetup() { return getContextValue('completeInitialSetup'); }
export function getTestShowCycleCreationModal() { return getContextValue('showCycleCreationModal'); }
export function getTestShowConfirmationModal() { return getContextValue('showConfirmationModal'); }
export function getTestShowPromptModal() { return getContextValue('showPromptModal'); }
export function getTestResetNotificationPosition() { return getContextValue('resetNotificationPosition'); }

// ============================================================================
// UTILITY GETTERS
// ============================================================================

export function getTestGlobalUtils() { return getContextValue('GlobalUtils'); }
export function getTestDataValidator() { return getContextValue('DataValidator'); }
export function getTestSanitizeInput() { return getContextValue('sanitizeInput'); }
export function getTestGenerateId() { return getContextValue('generateId'); }
export function getTestGenerateHashId() { return getContextValue('generateHashId'); }
export function getTestSafeAddEventListener() { return getContextValue('safeAddEventListener'); }
export function getTestSafeAddEventListenerById() { return getContextValue('safeAddEventListenerById'); }
export function getTestIsTouchDevice() { return getContextValue('isTouchDevice'); }

// ============================================================================
// TASK GETTERS
// ============================================================================

export function getTestAddTask() { return getContextValue('addTask'); }
export function getTestUpdateMoveArrowsVisibility() { return getContextValue('updateMoveArrowsVisibility'); }
export function getTestValidateAndSanitizeTaskInput() { return getContextValue('validateAndSanitizeTaskInput'); }
export function getTestLoadTaskContext() { return getContextValue('loadTaskContext'); }
export function getTestCreateTaskDOMElements() { return getContextValue('createTaskDOMElements'); }
export function getTestCreateOrUpdateTaskData() { return getContextValue('createOrUpdateTaskData'); }
export function getTestFixTaskValidationIssues() { return getContextValue('fixTaskValidationIssues'); }
export function getTestTaskRenderer() { return getContextValue('TaskRenderer'); }
export function getTestTaskDOMManager() { return getContextValue('TaskDOMManager'); }
export function getTestTaskEvents() { return getContextValue('TaskEvents'); }
export function getTestTaskUtils() { return getContextValue('TaskUtils'); }
export function getTestTaskOptionsCustomizer() { return getContextValue('TaskOptionsCustomizer'); }
export function getTestTaskCore() { return getContextValue('TaskCore'); }
export function getTestHandleTaskCompletionChange() { return getContextValue('handleTaskCompletionChange'); }
export function getTestHandleCompleteAllTasks() { return getContextValue('handleCompleteAllTasks'); }
export function getTestExtractTaskDataFromDOM() { return getContextValue('extractTaskDataFromDOM'); }

// ============================================================================
// ROUTINE SWITCHER GETTERS
// ============================================================================

export function getTestSwitchMiniCycle() { return getContextValue('switchMiniCycle'); }
export function getTestRenameMiniCycle() { return getContextValue('renameMiniCycle'); }
export function getTestDeleteMiniCycle() { return getContextValue('deleteMiniCycle'); }
export function getTestConfirmMiniCycle() { return cycle()?.confirm; }
export function getTestHideSwitchMiniCycleModal() { return cycle()?.hideModal; }
export function getTestUpdatePreview() { return cycle()?.updatePreview; }
export function getTestLoadMiniCycleList() { return cycle()?.loadList; }
export function getTestSetupModalClickOutside() { return cycle()?.setupClickOutside; }
export function getTestInitializeModeSelector() { return getContextValue('initializeModeSelector'); }

// ============================================================================
// FEATURE GETTERS
// ============================================================================

export function getTestPullToRefresh() { return getContextValue('PullToRefresh'); }
export function getTestMiniCycleReminders() { return reminder()?.manager; }
export function getTestMiniCycleNotifications() { return getContextValue('notifications'); }
export function getTestEducationalTipManager() { return ui()?.tipManager; }
export function getTestUpdateDueDateVisibility() { return getContextValue('updateDueDateVisibility'); }
export function getTestCheckOverdueTasks() { return getContextValue('checkOverdueTasks'); }
export function getTestOrganizeCompletedTasks() { return getContextValue('organizeCompletedTasks'); }
export function getTestUpdateThemeColor() { return getContextValue('updateThemeColor'); }

// ============================================================================
// UNDO/REDO GETTERS
// ============================================================================

export function getTestPerformStateBasedUndo() { return getContextValue('performStateBasedUndo'); }
export function getTestPerformStateBasedRedo() { return getContextValue('performStateBasedRedo'); }
export function getTestCaptureStateSnapshot() { return getContextValue('captureStateSnapshot'); }
export function getTestUpdateUndoRedoButtons() { return getContextValue('updateUndoRedoButtons'); }

// ============================================================================
// REMINDER GETTERS
// ============================================================================

export function getTestUpdateReminderButtons() { return getContextValue('updateReminderButtons'); }
export function getTestStartReminders() { return getContextValue('startReminders'); }
export function getTestRemindOverdueTasks() { return getContextValue('remindOverdueTasks'); }
export function getTestLoadRemindersSettings() { return getContextValue('loadRemindersSettings'); }

// ============================================================================
// RECURRING GETTERS
// ============================================================================

export function getTestRecurringPanel() { return getContextValue('recurringPanel'); }
export function getTestOpenRecurringSettingsPanelForTask() { return getContextValue('openRecurringSettingsPanelForTask'); }

// ============================================================================
// GROUPED API ACCESSORS (for tests that want to use new pattern)
// ============================================================================

export { state, task, cycle, ui, undo, reminder, recurring, utils };
export { getStateApi, getTaskApi, getCycleApi, getUiApi, getUndoApi, getReminderApi, getRecurringApi, getUtilsApi };

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
            const appState = getTestAppState();
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
    return getContextValue(name) != null;
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
