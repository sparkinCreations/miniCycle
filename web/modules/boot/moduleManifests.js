/**
 * @file moduleManifests.js
 * @description Declarative module definitions for miniCycle
 * @module modules/boot/moduleManifests
 *
 * This file defines all modules, their dependencies, and load order.
 * Instead of hardcoding 70+ dependency wirings in featureBoot.js,
 * modules declare their requirements here.
 *
 * BENEFITS:
 * - Single source of truth for module dependencies
 * - Automatic load order via topological sort
 * - Easy to add/remove modules
 * - Clear visualization of dependency graph
 *
 * USAGE:
 * ```javascript
 * import { MODULE_MANIFESTS, getLoadOrder, getModulesByPhase } from './moduleManifests.js';
 *
 * // Get modules in correct load order
 * const order = getLoadOrder();
 *
 * // Get modules for a specific phase
 * const phase1 = getModulesByPhase(1);
 * ```
 *
 * @version 1.0.0
 */

// ============================================================================
// LOAD PHASES
// ============================================================================

/**
 * Module load phases - defines when modules are loaded during boot
 */
export const PHASES = {
    CORE_UTILS: 1,      // Error handler, validation, notifications
    THEME_VISUAL: 2,    // Themes, games, onboarding
    TASK_MANAGEMENT: 3, // Task DOM, drag-drop, core task operations
    RECURRING: 4,       // Recurring tasks, due dates
    CYCLE: 5,           // Cycle management, mode manager
    UI_MANAGERS: 6,     // Menu, settings, modals, undo/redo
    FEATURES: 7,        // Stats, help, effects
    TESTING: 8          // Testing modal, backup (optional)
};

// ============================================================================
// MODULE MANIFESTS
// ============================================================================

/**
 * @typedef {Object} ModuleManifest
 * @property {string} path - Module path relative to modules/
 * @property {number} phase - Load phase (1-8)
 * @property {string[]} requires - Required dependencies (module names or API names)
 * @property {string[]} [provides] - APIs/functions this module provides
 * @property {string[]} [after] - Must load after these modules
 * @property {string[]} [before] - Must load before these modules
 * @property {boolean} [optional] - If true, failure doesn't stop boot
 * @property {boolean} [singleton] - If true, only one instance allowed
 * @property {string} [api] - Which grouped API this contributes to (state, task, cycle, ui, etc.)
 */

/**
 * All module manifests indexed by name
 * @type {Object.<string, ModuleManifest>}
 */
export const MODULE_MANIFESTS = {
    // =========================================================================
    // PHASE 1: CORE UTILITIES
    // =========================================================================
    errorHandler: {
        path: '../utils/errorHandler.js',
        phase: PHASES.CORE_UTILS,
        requires: [],
        provides: ['errorHandler'],
        api: 'utils',
        optional: false,
        singleton: true
    },

    dataValidator: {
        path: '../utils/dataValidator.js',
        phase: PHASES.CORE_UTILS,
        requires: ['sanitizeInput'],
        provides: ['DataValidator'],
        api: 'utils'
    },

    consoleCapture: {
        path: '../utils/consoleCapture.js',
        phase: PHASES.CORE_UTILS,
        requires: [],
        provides: ['consoleCapture'],
        api: 'utils',
        optional: true
    },

    notifications: {
        path: '../utils/notifications.js',
        phase: PHASES.CORE_UTILS,
        requires: ['appInit', 'GlobalUtils'],
        provides: ['showNotification', 'showConfirmationModal', 'showPromptModal'],
        api: 'utils'
    },

    // =========================================================================
    // PHASE 2: THEME & VISUAL
    // =========================================================================
    themeManager: {
        path: '../features/themeManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'showNotification'],
        provides: ['applyTheme', 'updateThemeColor', 'setupDarkModeToggle', 'setupQuickDarkToggle', 'unlockDarkOceanTheme', 'unlockGoldenGlowTheme', 'initializeThemesPanel', 'refreshThemeToggles', 'setupThemesPanel'],
        provideInstance: 'themeManager',
        api: 'features',
        after: ['notifications']
    },

    gamesManager: {
        path: '../ui/gamesManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'AppState', 'AppMeta', 'safeAddEventListener'],
        provides: [],
        provideInstance: 'gamesManager',
        api: 'ui',
        after: ['notifications']
    },

    onboardingManager: {
        path: '../ui/onboardingManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'AppState', 'showNotification', 'safeAddEventListenerById', 'safeAddEventListener'],
        provides: [],
        provideInstance: 'onboardingManager',
        api: 'ui',
        after: ['notifications']
    },

    modalManager: {
        path: '../ui/modalManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'showNotification', 'safeAddEventListener'],
        provides: [],
        provideInstance: 'modalManager',
        api: 'ui'
    },

    // =========================================================================
    // PHASE 3: TASK MANAGEMENT
    // =========================================================================
    // NOTE: taskValidation, taskUtils, taskRenderer, and taskEvents are
    // loaded as sub-modules inside taskDOM.init() - do NOT list them here
    // to avoid duplicate initialization and event listener conflicts.

    dragDropManager: {
        path: '../task/dragDropManager.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['enableDragAndDropOnTask', 'updateMoveArrowsVisibility', 'updateArrowsInDOM'],
        api: 'task'
    },

    deviceDetection: {
        path: '../utils/deviceDetection.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['deviceDetectionManager'],
        api: 'utils'
    },

    statsPanel: {
        path: '../features/statsPanel.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['showNotification', 'AppState', 'appInit'],
        provides: ['showStatsPanel', 'showTaskView', 'updateStatsPanel'],
        provideInstance: 'statsPanelManager',
        api: 'ui'
    },

    taskDOM: {
        path: '../task/taskDOM.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'generateId', 'sanitizeInput', 'TaskOptionsVisibilityController', 'showTaskOptions', 'hideTaskOptions', 'attachKeyboardTaskOptionToggle', 'triggerLogoBackground'],
        provides: [
            'createTaskDOMElements', 'setupTaskInteractions', 'refreshUIFromState',
            'loadTaskContext', 'createOrUpdateTaskData', 'finalizeTaskCreation',
            'validateAndSanitizeTaskInput', 'buildTaskContext', 'extractTaskDataFromDOM',
            'renderTasks', 'refreshTaskListUI', 'createTaskButtonContainer', 'handleTaskButtonClick',
            'setupRecurringButtonHandler', 'revealTaskButtons', 'taskToAddTaskOptions'
        ],
        api: 'task',
        after: ['dragDropManager', 'taskUI', 'taskInteractions', 'uiEffects']
    },

    taskOptionsCustomizer: {
        path: '../ui/taskOptionsCustomizer.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification', 'renderTaskList', 'updateMoveArrowsVisibility', 'startReminders', 'stopReminders', 'modeManager', 'DEFAULT_TASK_OPTION_BUTTONS', 'safeAddEventListener'],
        provides: [],
        provideInstance: 'taskOptionsCustomizer',
        api: 'ui',
        after: ['taskDOM', 'reminders', 'modeManager']
    },

    reminders: {
        path: '../features/reminders.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['startReminders', 'stopReminders', 'updateReminderButtons', 'setupReminderButtonHandler', 'loadRemindersSettings'],
        api: 'features',
        provideInstance: 'reminderManager',
        after: ['taskDOM']
    },

    // =========================================================================
    // PHASE 4: RECURRING
    // =========================================================================
    recurringIntegration: {
        path: '../recurring/recurringIntegration.js',
        phase: PHASES.RECURRING,
        requires: ['appInit', 'AppState', 'showNotification', 'showNotificationWithTip', 'notifications', 'FeatureFlags', 'GlobalUtils', 'refreshUIFromState', 'updateProgressBar'],
        provides: ['panel', 'core'],
        api: 'recurring',
        after: ['taskDOM', 'reminders']
    },

    dueDates: {
        path: '../features/dueDates.js',
        phase: PHASES.RECURRING,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['checkOverdueTasks', 'createDueDateInput'],
        api: 'features',
        after: ['taskDOM']
    },

    // =========================================================================
    // PHASE 5: CYCLE MANAGEMENT
    // =========================================================================
    modeManager: {
        path: '../routine/modeManager.js',
        phase: PHASES.CYCLE,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['setupModeSelector', 'refreshTaskButtonsForModeChange', 'updateCycleModeDescription'],
        api: 'cycle',
        after: ['recurringIntegration']
    },

    routineSwitcher: {
        path: '../routine/routineSwitcher.js',
        phase: PHASES.CYCLE,
        requires: ['appInit', 'AppState', 'showNotification', 'showPromptModal'],
        provides: ['switchMiniCycle', 'renameMiniCycle', 'deleteMiniCycle'],
        api: 'cycle'
    },

    routineManager: {
        path: '../routine/routineManager.js',
        phase: PHASES.CYCLE,
        requires: ['appInit', 'AppState', 'showNotification', 'showPromptModal'],
        provides: ['showCycleCreationModal', 'createNewMiniCycle'],
        api: 'cycle',
        after: ['menuManager']  // Needs hideMainMenu from menuManager
    },

    // =========================================================================
    // PHASE 6: UI MANAGERS
    // =========================================================================
    undoRedoManager: {
        path: '../ui/undoRedoManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification', 'safeAddEventListener', 'getElementById', 'refreshUIFromState'],
        provides: ['performStateBasedUndo', 'performStateBasedRedo', 'captureStateSnapshot', 'updateUndoRedoButtons', 'enableUndoSystemOnFirstInteraction', 'wrapAppStateForUndo', 'setupStateBasedUndoRedo', 'initializeUndoSystemForApp'],
        api: 'undo',
        after: ['taskDOM']
    },

    menuManager: {
        path: '../ui/menuManager.js',
        phase: PHASES.CYCLE,  // Moved to Phase 5 - needed by routineManager
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['hideMainMenu', 'updateMainMenuHeader'],
        api: 'ui',
        singleton: true
    },

    settingsManager: {
        path: '../ui/settingsManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['syncCurrentSettingsToStorage'],
        provideInstance: 'settingsManager',
        api: 'ui',
        after: ['menuManager', 'themeManager']
    },

    titleManager: {
        path: '../ui/titleManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'GlobalUtils', 'AppState', 'loadMiniCycleData', 'showNotification', 'updateMainMenuHeader', 'updateUndoRedoButtons'],
        provides: ['setupMiniCycleTitleListener', 'handleMiniCycleTitleBlur'],
        api: 'ui'
    },

    completedTasksManager: {
        path: '../ui/completedTasksManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'GlobalUtils', 'safeAddEventListener'],
        provides: [],
        provideInstance: 'completedTasksManager',
        api: 'ui'
    },

    cycleCompletion: {
        path: '../progress/cycleCompletion.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['checkMiniCycle', 'updateProgressBar', 'incrementCycleCount', 'showCompletionAnimation', 'animateProgressBarFill', 'animateProgressBarEmpty'],
        api: 'progress'
    },

    taskUI: {
        path: '../ui/taskUI.js',
        phase: PHASES.THEME_VISUAL, // Must load before TASK_MANAGEMENT so TaskOptionsVisibilityController is available
        requires: ['appInit', 'loadMiniCycleData'],
        provides: ['refreshTaskListUI', 'showTaskOptions', 'hideTaskOptions', 'checkCompleteAllButton', 'TaskOptionsVisibilityController', 'hideTaskButtons'],
        api: 'ui'
    },

    taskInteractions: {
        path: '../ui/taskInteractions.js',
        phase: PHASES.THEME_VISUAL, // Must load before TASK_MANAGEMENT so attachKeyboardTaskOptionToggle is available
        requires: ['safeAddEventListener', 'TaskOptionsVisibilityController'],
        provides: ['attachKeyboardTaskOptionToggle'],
        api: 'ui',
        after: ['taskUI']  // TaskOptionsVisibilityController comes from taskUI
    },

    uiEffects: {
        path: '../ui/uiEffects.js',
        phase: PHASES.THEME_VISUAL, // Must load before TASK_MANAGEMENT so triggerLogoBackground is available
        requires: [],
        provides: ['triggerLogoBackground'],
        api: 'ui'
    },

    helpWindowManager: {
        path: '../ui/helpWindowManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'loadMiniCycleData'],
        provides: [],
        provideInstance: 'helpWindowManager',
        api: 'ui'
    },

    taskCore: {
        path: '../task/taskCore.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification', 'sanitizeInput', 'removeRecurringTasksFromCycle'],
        provides: ['addTask', 'editTask', 'deleteTask', 'toggleTaskPriority', 'handleTaskCompletionChange', 'resetTasks', 'saveTaskToSchema25', 'handleCompleteAllTasks'],
        provideInstance: 'taskCore',
        api: 'task',
        after: ['taskDOM', 'cycleCompletion', 'recurringIntegration']
    },

    routineLoader: {
        path: '../routine/routineLoader.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'loadMiniCycleData'],
        provides: ['loadMiniCycle'],
        api: 'cycle',
        after: ['taskCore']
    },

    pullToRefresh: {
        path: '../ui/pullToRefresh.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['showNotification'],
        provides: ['pullToRefresh'],
        api: 'ui',
        optional: true
    },

    // =========================================================================
    // PHASE 8: TESTING & BACKUP
    // =========================================================================
    testingModal: {
        path: '../testing/testing-modal.js',
        phase: PHASES.TESTING,
        requires: ['AppState', 'showNotification', 'safeAddEventListener', 'safeAddEventListenerById', 'safeLocalStorageGet', 'safeLocalStorageSet', 'safeJSONParse', 'safeJSONStringify'],
        provides: ['openStorageViewer', 'closeStorageViewer'],
        api: 'testing',
        optional: true
    },

    backupManager: {
        path: '../storage/backupManager.js',
        phase: PHASES.TESTING,
        requires: ['AppState'],
        provides: ['BackupManager'],
        api: 'storage',
        optional: true,
        singleton: true
    },

    basicPluginSystem: {
        path: '../other/basicPluginSystem.js',
        phase: PHASES.TESTING,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['pluginManager'],
        api: 'plugins',
        optional: true
    }
};

// ============================================================================
// LOAD ORDER UTILITIES
// ============================================================================

/**
 * Perform topological sort on modules based on dependencies
 * @returns {string[]} Module names in load order
 */
export function getLoadOrder() {
    const visited = new Set();
    const result = [];
    const visiting = new Set(); // For cycle detection

    function visit(name) {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            console.warn(`⚠️ Circular dependency detected involving: ${name}`);
            return;
        }

        const manifest = MODULE_MANIFESTS[name];
        if (!manifest) return;

        visiting.add(name);

        // Visit dependencies first
        const deps = manifest.after || [];
        for (const dep of deps) {
            visit(dep);
        }

        visiting.delete(name);
        visited.add(name);
        result.push(name);
    }

    // Sort by phase first, then by dependencies
    const modulesByPhase = Object.entries(MODULE_MANIFESTS)
        .sort((a, b) => a[1].phase - b[1].phase);

    for (const [name] of modulesByPhase) {
        visit(name);
    }

    return result;
}

/**
 * Get all modules for a specific phase
 * @param {number} phase - Phase number
 * @returns {Array<[string, ModuleManifest]>} Module name and manifest pairs
 */
export function getModulesByPhase(phase) {
    return Object.entries(MODULE_MANIFESTS)
        .filter(([_, manifest]) => manifest.phase === phase)
        .sort((a, b) => {
            // Within a phase, respect 'after' constraints
            if (a[1].after?.includes(b[0])) return 1;
            if (b[1].after?.includes(a[0])) return -1;
            return 0;
        });
}

/**
 * Get all modules that provide a specific API
 * @param {string} apiName - API name (state, task, cycle, ui, etc.)
 * @returns {Array<[string, ModuleManifest]>}
 */
export function getModulesForApi(apiName) {
    return Object.entries(MODULE_MANIFESTS)
        .filter(([_, manifest]) => manifest.api === apiName);
}

/**
 * Validate that all dependencies exist
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateManifests() {
    const errors = [];
    const moduleNames = new Set(Object.keys(MODULE_MANIFESTS));

    for (const [name, manifest] of Object.entries(MODULE_MANIFESTS)) {
        // Check 'after' references exist
        if (manifest.after) {
            for (const dep of manifest.after) {
                if (!moduleNames.has(dep)) {
                    errors.push(`${name}: 'after' references unknown module '${dep}'`);
                }
            }
        }

        // Check 'before' references exist
        if (manifest.before) {
            for (const dep of manifest.before) {
                if (!moduleNames.has(dep)) {
                    errors.push(`${name}: 'before' references unknown module '${dep}'`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get dependency graph for visualization
 * @returns {Object} { nodes: string[], edges: [string, string][] }
 */
export function getDependencyGraph() {
    const nodes = Object.keys(MODULE_MANIFESTS);
    const edges = [];

    for (const [name, manifest] of Object.entries(MODULE_MANIFESTS)) {
        if (manifest.after) {
            for (const dep of manifest.after) {
                edges.push([dep, name]); // dep -> name (dep must load before name)
            }
        }
    }

    return { nodes, edges };
}

/**
 * Print load order for debugging
 */
export function printLoadOrder() {
    const order = getLoadOrder();
    console.log('📦 Module Load Order:');
    order.forEach((name, i) => {
        const manifest = MODULE_MANIFESTS[name];
        console.log(`  ${i + 1}. [Phase ${manifest.phase}] ${name}`);
    });
}

console.log('📦 moduleManifests loaded');
