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
        optional: true
    },

    notifications: {
        path: '../utils/notifications.js',
        phase: PHASES.CORE_UTILS,
        requires: ['appInit', 'GlobalUtils'],
        provides: ['showNotification', 'showConfirmationModal', 'showPromptModal'],
        api: 'ui'
    },

    // =========================================================================
    // PHASE 2: THEME & VISUAL
    // =========================================================================
    themeManager: {
        path: '../features/themeManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'showNotification'],
        provides: ['applyTheme', 'updateThemeColor', 'setupDarkModeToggle'],
        after: ['notifications']
    },

    gamesManager: {
        path: '../ui/gamesManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'AppState', 'AppMeta'],
        provides: ['unlockMiniGame', 'checkGamesUnlock'],
        after: ['notifications']
    },

    onboardingManager: {
        path: '../ui/onboardingManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['onboardingManager'],
        after: ['notifications']
    },

    modalManager: {
        path: '../ui/modalManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['showNotification', 'safeAddEventListener'],
        provides: ['modalManager', 'closeAllModals'],
        api: 'ui'
    },

    // =========================================================================
    // PHASE 3: TASK MANAGEMENT
    // =========================================================================
    taskValidation: {
        path: '../task/taskValidation.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['sanitizeInput', 'showNotification'],
        provides: ['TaskValidator', 'validateAndSanitizeTaskInput'],
        api: 'task'
    },

    taskUtils: {
        path: '../task/taskUtils.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['AppState', 'loadMiniCycleData', 'generateId'],
        provides: ['TaskUtils', 'buildTaskContext', 'loadTaskContext', 'createOrUpdateTaskData'],
        api: 'task',
        after: ['taskValidation']
    },

    taskRenderer: {
        path: '../task/taskRenderer.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['AppState', 'addTask', 'updateProgressBar'],
        provides: ['TaskRenderer', 'renderTasks', 'refreshUIFromState'],
        api: 'task',
        after: ['taskUtils']
    },

    taskEvents: {
        path: '../task/taskEvents.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState'],
        provides: ['TaskEvents', 'initTaskEvents'],
        api: 'task',
        after: ['taskUtils']
    },

    dragDropManager: {
        path: '../task/dragDropManager.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['enableDragAndDropOnTask', 'updateMoveArrowsVisibility'],
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
        provides: ['showStatsPanel', 'updateStatsPanel'],
        api: 'ui'
    },

    taskDOM: {
        path: '../task/taskDOM.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'generateId'],
        provides: ['createTaskDOMElements', 'setupTaskInteractions', 'refreshUIFromState'],
        api: 'task',
        after: ['dragDropManager']
    },

    taskOptionsCustomizer: {
        path: '../ui/taskOptionsCustomizer.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['taskOptionsCustomizer'],
        after: ['taskDOM']
    },

    reminders: {
        path: '../features/reminders.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['startReminders', 'stopReminders', 'updateReminderButtons'],
        api: 'reminder',
        after: ['taskDOM']
    },

    // =========================================================================
    // PHASE 4: RECURRING
    // =========================================================================
    recurringIntegration: {
        path: '../recurring/recurringIntegration.js',
        phase: PHASES.RECURRING,
        requires: ['appInit', 'AppState', 'showNotification', 'FeatureFlags'],
        provides: ['recurringPanel', 'recurringCore'],
        api: 'recurring',
        after: ['taskDOM', 'reminders']
    },

    dueDates: {
        path: '../features/dueDates.js',
        phase: PHASES.RECURRING,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['checkOverdueTasks', 'createDueDateInput'],
        after: ['taskDOM']
    },

    // =========================================================================
    // PHASE 5: CYCLE MANAGEMENT
    // =========================================================================
    modeManager: {
        path: '../cycle/modeManager.js',
        phase: PHASES.CYCLE,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['initializeModeSelector', 'refreshTaskButtonsForModeChange'],
        api: 'cycle',
        after: ['recurringIntegration']
    },

    cycleSwitcher: {
        path: '../cycle/cycleSwitcher.js',
        phase: PHASES.CYCLE,
        requires: ['AppState', 'showNotification', 'showPromptModal'],
        provides: ['switchMiniCycle', 'renameMiniCycle', 'deleteMiniCycle'],
        api: 'cycle'
    },

    cycleManager: {
        path: '../cycle/cycleManager.js',
        phase: PHASES.CYCLE,
        requires: ['AppState', 'showNotification', 'showPromptModal'],
        provides: ['showCycleCreationModal', 'createNewMiniCycle'],
        api: 'cycle'
    },

    // =========================================================================
    // PHASE 6: UI MANAGERS
    // =========================================================================
    undoRedoManager: {
        path: '../ui/undoRedoManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['performStateBasedUndo', 'performStateBasedRedo', 'captureStateSnapshot'],
        api: 'undo',
        after: ['taskDOM']
    },

    menuManager: {
        path: '../ui/menuManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['hideMainMenu', 'updateMainMenuHeader'],
        api: 'ui',
        singleton: true
    },

    settingsManager: {
        path: '../ui/settingsManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['settingsManager'],
        after: ['menuManager', 'themeManager']
    },

    titleManager: {
        path: '../ui/titleManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['GlobalUtils', 'AppState'],
        provides: ['titleManager']
    },

    completedTasksManager: {
        path: '../ui/completedTasksManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['AppState'],
        provides: ['initCompletedTasksSection', 'organizeCompletedTasks'],
        api: 'ui'
    },

    cycleCompletion: {
        path: '../progress/cycleCompletion.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['AppState', 'showNotification'],
        provides: ['checkMiniCycle', 'updateProgressBar', 'incrementCycleCount'],
        api: 'cycle'
    },

    taskUI: {
        path: '../ui/taskUI.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['loadMiniCycleData'],
        provides: ['refreshTaskListUI', 'showTaskOptions', 'checkCompleteAllButton'],
        api: 'task'
    },

    taskInteractions: {
        path: '../ui/taskInteractions.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['safeAddEventListener'],
        provides: ['attachKeyboardTaskOptionToggle']
    },

    uiEffects: {
        path: '../ui/uiEffects.js',
        phase: PHASES.UI_MANAGERS,
        requires: [],
        provides: ['triggerLogoBackground'],
        api: 'ui'
    },

    helpWindowManager: {
        path: '../ui/helpWindowManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['AppState', 'loadMiniCycleData'],
        provides: ['helpWindowManager']
    },

    taskCore: {
        path: '../task/taskCore.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification', 'sanitizeInput'],
        provides: ['addTask', 'handleTaskCompletionChange', 'resetTasks'],
        api: 'task',
        after: ['taskDOM', 'cycleCompletion']
    },

    cycleLoader: {
        path: '../cycle/cycleLoader.js',
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
        optional: true
    },

    // =========================================================================
    // PHASE 8: TESTING & BACKUP
    // =========================================================================
    testingModal: {
        path: '../testing/testing-modal.js',
        phase: PHASES.TESTING,
        requires: [],
        provides: ['openStorageViewer', 'closeStorageViewer'],
        optional: true
    },

    backupManager: {
        path: '../storage/backupManager.js',
        phase: PHASES.TESTING,
        requires: ['AppState'],
        provides: ['BackupManager'],
        optional: true,
        singleton: true
    },

    basicPluginSystem: {
        path: '../other/basicPluginSystem.js',
        phase: PHASES.TESTING,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['pluginManager'],
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
