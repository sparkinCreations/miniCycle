/**
 * @file moduleLoader.js
 * @description Module loader that uses manifests for loading
 * @module modules/boot/moduleLoader
 *
 * This module provides utilities for loading modules based on their manifests.
 * It handles:
 * - Loading modules by phase
 * - Calling setDependencies functions
 * - Initializing modules
 * - Registering with appContext
 *
 * USAGE:
 * ```javascript
 * import { loadPhase, loadAllModules } from './moduleLoader.js';
 *
 * // Load a specific phase
 * await loadPhase(deps, coreResult, PHASES.CORE_UTILS);
 *
 * // Or load all phases
 * await loadAllModules(deps, coreResult);
 * ```
 *
 * @version 1.0.0
 */

import { MODULE_MANIFESTS, PHASES, getModulesByPhase, getLoadOrder } from './moduleManifests.js';
import { registerApi } from '../core/appContext.js';

// ============================================================================
// MODULE LOADING STATE
// ============================================================================

const loadedModules = new Map();
const moduleInstances = new Map();

// ============================================================================
// CORE LOADER
// ============================================================================

/**
 * Load a single module by name
 * @param {string} name - Module name from manifests
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @param {Function} withV - Version-appending function for cache busting
 * @returns {Promise<Object|null>} Loaded module or null if failed
 */
export async function loadModule(name, deps, coreResult, withV) {
    if (loadedModules.has(name)) {
        return loadedModules.get(name);
    }

    const manifest = MODULE_MANIFESTS[name];
    if (!manifest) {
        console.warn(`⚠️ Unknown module: ${name}`);
        return null;
    }

    try {
        console.log(`📦 Loading: ${name}...`);

        // Import the module
        const mod = await import(withV(manifest.path));
        loadedModules.set(name, mod);

        // Find and call setDependencies if it exists
        const setDepsFn = findSetDependenciesFunction(mod, name);
        if (setDepsFn) {
            const moduleDeps = buildModuleDependencies(manifest, deps, coreResult);
            setDepsFn(moduleDeps);
        }

        console.log(`✅ ${name} loaded`);
        return mod;
    } catch (error) {
        if (manifest.optional) {
            console.warn(`⚠️ Optional module ${name} failed to load:`, error.message);
            return null;
        }
        console.error(`❌ Failed to load ${name}:`, error);
        throw error;
    }
}

/**
 * Initialize a loaded module
 * @param {string} name - Module name
 * @param {Object} mod - Loaded module
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @returns {Promise<Object|null>} Initialized instance or null
 */
export async function initializeModule(name, mod, deps, coreResult) {
    if (moduleInstances.has(name)) {
        return moduleInstances.get(name);
    }

    const manifest = MODULE_MANIFESTS[name];
    if (!manifest) return null;

    try {
        // Look for init function
        const initFn = findInitFunction(mod, name);
        if (initFn) {
            const initDeps = buildModuleDependencies(manifest, deps, coreResult);
            const instance = await initFn(initDeps);
            moduleInstances.set(name, instance);

            // Register provides in deps container
            if (manifest.provides && instance) {
                registerProvides(name, manifest, instance, deps);
            }

            return instance;
        }

        // No init function - module is just a collection of exports
        return mod;
    } catch (error) {
        if (manifest.optional) {
            console.warn(`⚠️ Optional module ${name} failed to initialize:`, error.message);
            return null;
        }
        console.error(`❌ Failed to initialize ${name}:`, error);
        throw error;
    }
}

// ============================================================================
// PHASE LOADING
// ============================================================================

/**
 * Load all modules in a specific phase
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @param {number} phase - Phase number to load
 * @returns {Promise<Map<string, Object>>} Map of loaded modules
 */
export async function loadPhase(deps, coreResult, phase) {
    const { withV } = coreResult;
    const modules = getModulesByPhase(phase);
    const results = new Map();

    console.log(`🚀 Loading Phase ${phase} (${modules.length} modules)...`);

    for (const [name, manifest] of modules) {
        const mod = await loadModule(name, deps, coreResult, withV);
        if (mod) {
            const instance = await initializeModule(name, mod, deps, coreResult);
            results.set(name, instance || mod);
        }
    }

    return results;
}

/**
 * Load all modules in correct order
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @returns {Promise<Object>} All loaded modules and instances
 */
export async function loadAllModules(deps, coreResult) {
    const results = {
        modules: new Map(),
        instances: new Map(),
        apis: {}
    };

    // Load each phase in order
    for (const phase of Object.values(PHASES)) {
        const phaseResults = await loadPhase(deps, coreResult, phase);
        for (const [name, result] of phaseResults) {
            results.modules.set(name, loadedModules.get(name));
            results.instances.set(name, result);
        }
    }

    // Build grouped APIs
    results.apis = buildGroupedApis(deps);

    return results;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find the setDependencies function for a module
 * @param {Object} mod - Loaded module
 * @param {string} name - Module name
 * @returns {Function|null}
 */
function findSetDependenciesFunction(mod, name) {
    // Try common naming patterns
    const patterns = [
        `set${capitalize(name)}Dependencies`,
        'setDependencies',
        'setModuleDependencies'
    ];

    for (const pattern of patterns) {
        if (typeof mod[pattern] === 'function') {
            return mod[pattern];
        }
    }

    // Look for any function starting with 'set' and ending with 'Dependencies'
    for (const key of Object.keys(mod)) {
        if (key.startsWith('set') && key.endsWith('Dependencies') && typeof mod[key] === 'function') {
            return mod[key];
        }
    }

    return null;
}

/**
 * Find the init function for a module
 * @param {Object} mod - Loaded module
 * @param {string} name - Module name
 * @returns {Function|null}
 */
function findInitFunction(mod, name) {
    // Try common naming patterns
    const patterns = [
        `init${capitalize(name)}`,
        `initialize${capitalize(name)}`,
        'init',
        'initialize'
    ];

    for (const pattern of patterns) {
        if (typeof mod[pattern] === 'function') {
            return mod[pattern];
        }
    }

    return null;
}

/**
 * Build dependencies object for a module based on its manifest
 * @param {Object} manifest - Module manifest
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @returns {Object}
 */
function buildModuleDependencies(manifest, deps, coreResult) {
    const { GlobalUtils, appInit, AppGlobalState, FeatureFlags } = coreResult;
    const result = {};

    // Add core dependencies
    result.appInit = appInit;
    result.GlobalUtils = GlobalUtils;
    result.AppGlobalState = AppGlobalState;
    result.FeatureFlags = FeatureFlags;
    result.AppMeta = deps.core?.AppMeta;
    result.AppState = deps.core?.AppState;

    // Map common dependencies from deps container
    const depMappings = {
        // Core
        loadMiniCycleData: () => deps.core?.loadMiniCycleData?.(),
        autoSave: () => deps.core?.autoSave?.(),

        // Utils
        showNotification: deps.utils?.showNotification,
        showConfirmationModal: deps.utils?.showConfirmationModal,
        showPromptModal: deps.utils?.showPromptModal,
        sanitizeInput: deps.utils?.sanitizeInput || GlobalUtils?.sanitizeInput,
        generateId: deps.utils?.generateId,
        generateHashId: deps.utils?.generateHashId,
        escapeHtml: deps.utils?.escapeHtml,
        safeAddEventListener: GlobalUtils?.safeAddEventListener,
        safeAddEventListenerById: GlobalUtils?.safeAddEventListenerById,
        isTouchDevice: deps.utils?.isTouchDevice,

        // DOM helpers
        getElementById: (id) => document.getElementById(id),
        querySelector: (sel) => document.querySelector(sel),
        querySelectorAll: (sel) => document.querySelectorAll(sel),

        // Safe storage
        safeLocalStorageGet: GlobalUtils?.safeLocalStorageGet,
        safeLocalStorageSet: GlobalUtils?.safeLocalStorageSet,
        safeJSONParse: GlobalUtils?.safeJSONParse,
        safeJSONStringify: GlobalUtils?.safeJSONStringify
    };

    // Add required dependencies
    for (const req of manifest.requires || []) {
        if (req in depMappings) {
            result[req] = depMappings[req];
        } else if (req in coreResult) {
            result[req] = coreResult[req];
        }
    }

    // Add all mappings as fallbacks
    Object.assign(result, depMappings);

    return result;
}

/**
 * Register a module's provided APIs in the deps container
 * @param {string} name - Module name
 * @param {Object} manifest - Module manifest
 * @param {Object} instance - Module instance
 * @param {Object} deps - Dependencies container
 */
function registerProvides(name, manifest, instance, deps) {
    if (!manifest.provides) return;

    // Determine which deps category to use
    const category = getDepsCategoryForModule(manifest);

    for (const provided of manifest.provides) {
        // Look for the provided function/property
        const value = findProvidedValue(instance, provided);
        if (value !== undefined) {
            // Add to appropriate deps category
            if (deps[category]) {
                deps[category][provided] = value;
            }
        }
    }
}

/**
 * Get the deps category for a module
 * @param {Object} manifest - Module manifest
 * @returns {string}
 */
function getDepsCategoryForModule(manifest) {
    const apiToCategory = {
        state: 'core',
        task: 'task',
        cycle: 'cycle',
        ui: 'ui',
        undo: 'ui',
        reminder: 'features',
        recurring: 'recurring',
        utils: 'utils'
    };

    return apiToCategory[manifest.api] || 'features';
}

/**
 * Find a provided value from a module instance
 * @param {Object} instance - Module instance
 * @param {string} name - Name to find
 * @returns {*}
 */
function findProvidedValue(instance, name) {
    // Direct property
    if (instance[name] !== undefined) {
        return instance[name];
    }

    // Method on instance
    if (typeof instance[name] === 'function') {
        return instance[name].bind(instance);
    }

    // Getter
    const descriptor = Object.getOwnPropertyDescriptor(instance, name);
    if (descriptor?.get) {
        return descriptor.get.call(instance);
    }

    return undefined;
}

/**
 * Build grouped APIs from loaded modules
 * @param {Object} deps - Dependencies container
 * @returns {Object}
 */
function buildGroupedApis(deps) {
    return {
        state: {
            AppState: deps.core?.AppState,
            AppGlobalState: deps.core?.AppGlobalState,
            AppMeta: deps.core?.AppMeta,
            loadMiniCycleData: deps.core?.loadMiniCycleData,
            autoSave: deps.core?.autoSave
        },
        task: {
            add: deps.task?.addTask,
            delete: deps.task?.deleteTask,
            handleCompleteAll: deps.task?.handleCompleteAllTasks,
            loadContext: deps.task?.loadTaskContext,
            createDOM: deps.task?.createTaskDOMElements,
            extractFromDOM: deps.task?.extractTaskDataFromDOM,
            updateMoveArrows: deps.task?.updateMoveArrowsVisibility,
            refresh: deps.task?.refreshTaskListUI
        },
        cycle: {
            load: deps.cycle?.loadMiniCycle,
            create: deps.cycle?.showCycleCreationModal,
            switch: deps.cycle?.switchMiniCycle,
            rename: deps.cycle?.renameMiniCycle,
            delete: deps.cycle?.deleteMiniCycle,
            check: deps.progress?.checkMiniCycle,
            initializeModeSelector: deps.cycle?.initializeModeSelector
        },
        ui: {
            showNotification: deps.utils?.showNotification,
            showConfirmationModal: deps.utils?.showConfirmationModal,
            showPromptModal: deps.utils?.showPromptModal,
            hideMainMenu: deps.ui?.hideMainMenu,
            updateMainMenuHeader: deps.ui?.updateMainMenuHeader,
            closeAllModals: deps.ui?.closeAllModals,
            resetNotificationPosition: deps.utils?.resetNotificationPosition
        },
        undo: {
            capture: deps.ui?.captureStateSnapshot,
            undo: deps.ui?.performStateBasedUndo,
            redo: deps.ui?.performStateBasedRedo,
            updateButtons: deps.ui?.updateUndoRedoButtons,
            enableOnFirstInteraction: deps.ui?.enableUndoSystemOnFirstInteraction
        },
        reminder: {
            manager: deps.features?.reminderManager,
            start: deps.features?.startReminders,
            stop: deps.features?.stopReminders,
            updateButtons: deps.features?.updateReminderButtons,
            loadSettings: deps.features?.loadRemindersSettings
        },
        recurring: {
            panel: deps.recurring?.panel,
            core: deps.recurring?.core,
            openForTask: deps.recurring?.openForTask
        },
        utils: {
            GlobalUtils: deps.utils?.GlobalUtils,
            DataValidator: deps.utils?.DataValidator,
            sanitizeInput: deps.utils?.sanitizeInput,
            generateId: deps.utils?.generateId,
            generateHashId: deps.utils?.generateHashId,
            safeAddEventListener: deps.utils?.safeAddEventListener,
            isTouchDevice: deps.utils?.isTouchDevice
        }
    };
}

/**
 * Capitalize first letter
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get a loaded module by name
 * @param {string} name - Module name
 * @returns {Object|null}
 */
export function getLoadedModule(name) {
    return loadedModules.get(name) || null;
}

/**
 * Get a module instance by name
 * @param {string} name - Module name
 * @returns {Object|null}
 */
export function getModuleInstance(name) {
    return moduleInstances.get(name) || null;
}

/**
 * Check if a module is loaded
 * @param {string} name - Module name
 * @returns {boolean}
 */
export function isModuleLoaded(name) {
    return loadedModules.has(name);
}

/**
 * Clear all loaded modules (for testing)
 */
export function clearLoadedModules() {
    loadedModules.clear();
    moduleInstances.clear();
}

console.log('📦 moduleLoader loaded');
