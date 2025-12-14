/**
 * @file testContext.js
 * @description Centralized access to app globals for tests
 * @module tests/helpers/testContext
 *
 * Created Dec 2025 as part of Window Globals Reduction Plan (Tier 4).
 *
 * Instead of accessing window.* globals directly in tests:
 *   window.AppState.get()
 *   window.BackupManager.createBackup()
 *
 * Use these helpers:
 *   import { getTestAppState, getTestBackupManager } from './helpers/testContext.js';
 *   getTestAppState().get()
 *   getTestBackupManager().createBackup()
 *
 * Benefits:
 * - Single point of access for all test globals
 * - Easier to refactor when window.* globals are removed
 * - Clear documentation of what globals tests depend on
 * - Can add safety checks, logging, or mocking support
 */

// ============================================================================
// CORE STATE GETTERS
// ============================================================================

/**
 * Get AppState from window (central state management)
 * @returns {Object|null} AppState instance
 */
export function getTestAppState() {
    return window.AppState || null;
}

/**
 * Get AppGlobalState from window (runtime flags)
 * @returns {Object|null} AppGlobalState instance
 */
export function getTestAppGlobalState() {
    return window.AppGlobalState || null;
}

/**
 * Get FeatureFlags from window
 * @returns {Object|null} FeatureFlags object
 */
export function getTestFeatureFlags() {
    return window.FeatureFlags || null;
}

// ============================================================================
// MANAGER GETTERS (Singletons)
// ============================================================================

/**
 * Get BackupManager from window
 * @returns {Object|null} BackupManager instance
 */
export function getTestBackupManager() {
    return window.BackupManager || null;
}

/**
 * Get CycleManager class from window
 * @returns {Function|null} CycleManager constructor
 */
export function getTestCycleManager() {
    return window.CycleManager || null;
}

/**
 * Get ModeManager from window
 * @returns {Object|null} ModeManager instance
 */
export function getTestModeManager() {
    return window.ModeManager || null;
}

/**
 * Get MenuManager from window
 * @returns {Object|null} MenuManager instance
 */
export function getTestMenuManager() {
    return window.MenuManager || null;
}

/**
 * Get OnboardingManager class from window
 * @returns {Function|null} OnboardingManager constructor
 */
export function getTestOnboardingManager() {
    return window.OnboardingManager || null;
}

/**
 * Get onboardingManager instance from window
 * @returns {Object|null} onboardingManager singleton instance
 */
export function getTestOnboardingManagerInstance() {
    return window.onboardingManager || null;
}

/**
 * Get DragDropManager class from window
 * @returns {Function|null} DragDropManager constructor
 */
export function getTestDragDropManager() {
    return window.DragDropManager || null;
}

/**
 * Get SettingsManager from window
 * @returns {Object|null} SettingsManager instance
 */
export function getTestSettingsManager() {
    return window.SettingsManager || null;
}

/**
 * Get DeviceDetectionManager from window
 * @returns {Object|null} DeviceDetectionManager instance
 */
export function getTestDeviceDetectionManager() {
    return window.DeviceDetectionManager || null;
}

/**
 * Get ErrorHandler from window
 * @returns {Object|null} ErrorHandler instance
 */
export function getTestErrorHandler() {
    return window.ErrorHandler || null;
}

// ============================================================================
// TASK-RELATED GETTERS
// ============================================================================

/**
 * Get TaskRenderer class from window
 * @returns {Function|null} TaskRenderer constructor
 */
export function getTestTaskRenderer() {
    return window.TaskRenderer || null;
}

/**
 * Get TaskDOMManager class from window
 * @returns {Function|null} TaskDOMManager constructor
 */
export function getTestTaskDOMManager() {
    return window.TaskDOMManager || null;
}

/**
 * Get TaskEvents class from window
 * @returns {Function|null} TaskEvents constructor
 */
export function getTestTaskEvents() {
    return window.TaskEvents || null;
}

/**
 * Get TaskUtils from window
 * @returns {Object|null} TaskUtils object
 */
export function getTestTaskUtils() {
    return window.TaskUtils || null;
}

/**
 * Get TaskOptionsCustomizer class from window
 * @returns {Function|null} TaskOptionsCustomizer constructor
 */
export function getTestTaskOptionsCustomizer() {
    return window.TaskOptionsCustomizer || null;
}

// ============================================================================
// FEATURE GETTERS
// ============================================================================

/**
 * Get PullToRefresh class from window
 * @returns {Function|null} PullToRefresh constructor
 */
export function getTestPullToRefresh() {
    return window.PullToRefresh || null;
}

/**
 * Get MiniCycleReminders class from window
 * @returns {Function|null} MiniCycleReminders constructor
 */
export function getTestMiniCycleReminders() {
    return window.MiniCycleReminders || null;
}

/**
 * Get MiniCycleNotifications class from window
 * @returns {Function|null} MiniCycleNotifications constructor
 */
export function getTestMiniCycleNotifications() {
    return window.MiniCycleNotifications || null;
}

/**
 * Get EducationalTipManager class from window
 * @returns {Function|null} EducationalTipManager constructor
 */
export function getTestEducationalTipManager() {
    return window.EducationalTipManager || null;
}

// ============================================================================
// UTILITY GETTERS
// ============================================================================

/**
 * Get GlobalUtils from window
 * @returns {Object|null} GlobalUtils object
 */
export function getTestGlobalUtils() {
    return window.GlobalUtils || null;
}

/**
 * Get DataValidator from window
 * @returns {Object|null} DataValidator instance
 */
export function getTestDataValidator() {
    return window.DataValidator || null;
}

/**
 * Get sanitizeInput function from window
 * @returns {Function|null} sanitizeInput function
 */
export function getTestSanitizeInput() {
    return window.sanitizeInput || null;
}

/**
 * Get generateId function from window
 * @returns {Function|null} generateId function
 */
export function getTestGenerateId() {
    return window.generateId || null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Wait for the app to be fully initialized
 * Useful when tests need to wait for async boot
 * @param {number} timeout - Max wait time in ms (default: 5000)
 * @returns {Promise<boolean>} True if app ready, false if timeout
 */
export async function waitForAppReady(timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const appState = getTestAppState();
        if (appState && typeof appState.isReady === 'function' && appState.isReady()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.warn('[testContext] Timeout waiting for app ready');
    return false;
}

/**
 * Check if a specific global exists
 * @param {string} name - Name of the global (e.g., 'AppState', 'BackupManager')
 * @returns {boolean} True if exists
 */
export function hasGlobal(name) {
    return typeof window[name] !== 'undefined';
}

/**
 * Get all available test globals as an object
 * Useful for debugging or bulk access
 * @returns {Object} Object with all available globals
 */
export function getAllTestGlobals() {
    return {
        // Core
        AppState: getTestAppState(),
        AppGlobalState: getTestAppGlobalState(),
        FeatureFlags: getTestFeatureFlags(),

        // Managers
        BackupManager: getTestBackupManager(),
        CycleManager: getTestCycleManager(),
        ModeManager: getTestModeManager(),
        MenuManager: getTestMenuManager(),
        OnboardingManager: getTestOnboardingManager(),
        DragDropManager: getTestDragDropManager(),
        SettingsManager: getTestSettingsManager(),
        DeviceDetectionManager: getTestDeviceDetectionManager(),
        ErrorHandler: getTestErrorHandler(),

        // Task
        TaskRenderer: getTestTaskRenderer(),
        TaskDOMManager: getTestTaskDOMManager(),
        TaskEvents: getTestTaskEvents(),
        TaskUtils: getTestTaskUtils(),
        TaskOptionsCustomizer: getTestTaskOptionsCustomizer(),

        // Features
        PullToRefresh: getTestPullToRefresh(),
        MiniCycleReminders: getTestMiniCycleReminders(),
        MiniCycleNotifications: getTestMiniCycleNotifications(),
        EducationalTipManager: getTestEducationalTipManager(),

        // Utilities
        GlobalUtils: getTestGlobalUtils(),
        DataValidator: getTestDataValidator(),
        sanitizeInput: getTestSanitizeInput(),
        generateId: getTestGenerateId()
    };
}

/**
 * Assert that required globals exist, throwing if missing
 * Use at the start of test files to fail fast
 * @param {string[]} globalNames - Array of global names to check
 * @throws {Error} If any required global is missing
 */
export function requireGlobals(...globalNames) {
    const missing = globalNames.filter(name => !hasGlobal(name));
    if (missing.length > 0) {
        throw new Error(`Required globals not found: ${missing.join(', ')}`);
    }
}

console.log('[testContext] Test context helpers loaded');
