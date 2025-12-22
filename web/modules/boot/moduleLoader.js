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

// Re-export for consumers that import moduleLoader (avoids duplicate module loading)
export { MODULE_MANIFESTS, PHASES, getLoadOrder };

// ============================================================================
// APPCONTEXT DYNAMIC IMPORT (versioned for cache-busting, like appInit pattern)
// ============================================================================
let _appContextModule = null;
let registerApi = () => { console.warn('⚠️ registerApi not loaded yet'); };
let getCompleteInitialSetup = () => null;
let getHideMainMenu = () => null;

async function loadAppContext() {
    if (!_appContextModule) {
        const version = typeof window !== 'undefined' ? (window.APP_VERSION || '1.507') : '1.507';
        _appContextModule = await import(`../core/appContext.js?v=${version}`);
        registerApi = _appContextModule.registerApi;
        getCompleteInitialSetup = _appContextModule.getCompleteInitialSetup || (() => null);
        getHideMainMenu = _appContextModule.getHideMainMenu || (() => null);
        console.log('✅ ModuleLoader: appContext loaded with version', version);
    }
    return _appContextModule;
}

// Load appContext early (non-blocking)
loadAppContext().catch(e => console.warn('⚠️ ModuleLoader: Failed to load appContext:', e));

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
            // Pass both instance and raw module - instance is checked first, then module exports as fallback
            if (manifest.provides && instance) {
                registerProvides(name, manifest, instance, deps, mod);
            }

            // Register instance itself if provideInstance is specified
            if (manifest.provideInstance && instance) {
                const category = getDepsCategoryForModule(manifest);
                if (deps[category]) {
                    deps[category][manifest.provideInstance] = instance;
                }
            }

            return instance;
        }

        // No init function - module is just a collection of exports
        // Still register provides from the raw module exports
        if (manifest.provides) {
            registerProvides(name, manifest, mod, deps);
        }

        // Check for exported instances that have init() methods (e.g., onboardingManager)
        // These are pre-created singletons that need initialization after dependencies are set
        if (manifest.provides) {
            for (const provided of manifest.provides) {
                const exportedInstance = mod[provided];
                if (exportedInstance && typeof exportedInstance.init === 'function' && !exportedInstance.initialized) {
                    try {
                        await exportedInstance.init();
                        console.log(`✅ ${name}.${provided}.init() called`);
                    } catch (initError) {
                        console.warn(`⚠️ ${name}.${provided}.init() failed:`, initError.message);
                    }
                }
            }
        }

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
    const { appInit } = coreResult;

    // Ensure core systems (AppState, Schema 2.5 data) are ready before loading modules
    if (appInit && !appInit.isCoreReady()) {
        console.log('⏳ moduleLoader: Waiting for core systems...');
        await appInit.waitForCore();
    }

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

    // =========================================================================
    // POST-INIT CROSS-MODULE INJECTIONS
    // Some modules need to be injected into other modules after all are loaded
    // =========================================================================

    // Inject taskOptionsCustomizer into taskDOMManager (required for three-dots menu)
    if (deps.task?.taskDOMManager && deps.ui?.taskOptionsCustomizer) {
        if (typeof deps.task.taskDOMManager.injectDependency === 'function') {
            deps.task.taskDOMManager.injectDependency('taskOptionsCustomizer', deps.ui.taskOptionsCustomizer);
            console.log('✅ moduleLoader: Injected taskOptionsCustomizer into taskDOMManager');
        }
    }

    // Inject enableDragAndDropOnTask into taskDOMManager (required for long-press after refresh)
    if (deps.task?.taskDOMManager && deps.task?.enableDragAndDropOnTask) {
        if (typeof deps.task.taskDOMManager.injectDependency === 'function') {
            deps.task.taskDOMManager.injectDependency('enableDragAndDropOnTask', deps.task.enableDragAndDropOnTask);
            console.log('✅ moduleLoader: Injected enableDragAndDropOnTask into taskDOMManager');
        }
    }

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

    // Also search for any exported function starting with 'init' or 'initialize'
    // This handles cases like initTaskValidator for module taskValidation
    for (const key of Object.keys(mod)) {
        if ((key.startsWith('init') || key.startsWith('initialize')) &&
            typeof mod[key] === 'function' &&
            key !== 'initDependencies') {  // Skip dependency setters
            return mod[key];
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
    // AppState: callable Proxy that works both as function and object
    // - this.deps.AppState() returns the AppState object (for settingsManager, etc.)
    // - this.deps.AppState?.isReady?.() works via property access (for taskCore, etc.)
    // - this.deps.AppState.data = x works via property assignment (for cycleManager, etc.)
    const appStateGetter = () => deps.core?.AppState;
    result.AppState = new Proxy(appStateGetter, {
        get(target, prop) {
            if (prop === 'apply' || prop === 'call' || prop === 'bind') {
                return target[prop].bind(target);
            }
            // Proxy property access to the actual AppState
            return deps.core?.AppState?.[prop];
        },
        set(target, prop, value) {
            // Proxy property assignment to the actual AppState
            const appState = deps.core?.AppState;
            if (appState) {
                appState[prop] = value;
                return true;
            }
            return false;
        },
        apply(target, thisArg, args) {
            // Allow function call: this.deps.AppState()
            return target();
        }
    });

    // Map common dependencies from deps container
    const depMappings = {
        // Core
        loadMiniCycleData: () => deps.core?.loadMiniCycleData?.(),
        autoSave: () => deps.core?.autoSave?.(),
        updateCycleData: (...args) => deps.core?.updateCycleData?.(...args),
        assignCycleVariables: () => deps.core?.assignCycleVariables?.(),

        // Utils
        showNotification: deps.utils?.showNotification,
        showNotificationWithTip: deps.utils?.showNotificationWithTip,
        notifications: deps.utils?.notifications,
        showConfirmationModal: deps.utils?.showConfirmationModal,
        showPromptModal: deps.utils?.showPromptModal,
        sanitizeInput: deps.utils?.sanitizeInput || GlobalUtils?.sanitizeInput,
        generateId: deps.utils?.generateId,
        generateHashId: deps.utils?.generateHashId,
        escapeHtml: deps.utils?.escapeHtml,
        safeAddEventListener: GlobalUtils?.safeAddEventListener,
        safeAddEventListenerById: GlobalUtils?.safeAddEventListenerById,
        isTouchDevice: deps.utils?.isTouchDevice,

        // Constants
        DEFAULT_TASK_OPTION_BUTTONS: deps.utils?.DEFAULT_TASK_OPTION_BUTTONS,

        // DOM helpers
        getElementById: (id) => document.getElementById(id),
        querySelector: (sel) => document.querySelector(sel),
        querySelectorAll: (sel) => document.querySelectorAll(sel),
        getTaskList: () => document.getElementById('taskList'),
        getProgressBar: () => document.getElementById('progressBar'),

        // Safe storage
        safeLocalStorageGet: GlobalUtils?.safeLocalStorageGet,
        safeLocalStorageSet: GlobalUtils?.safeLocalStorageSet,
        safeJSONParse: GlobalUtils?.safeJSONParse,
        safeJSONStringify: GlobalUtils?.safeJSONStringify,

        // From appContext (registered by coreBoot/featureBoot) - wrapper functions for lazy resolution
        completeInitialSetup: (...args) => getCompleteInitialSetup()?.(...args),

        // UI functions (from appContext or deps.ui) - wrapper functions for lazy resolution
        hideMainMenu: (...args) => (getHideMainMenu() || deps.ui?.hideMainMenu)?.(...args),
        updateProgressBar: (...args) => deps.progress?.updateProgressBar?.(...args),
        checkCompleteAllButton: (...args) => deps.ui?.checkCompleteAllButton?.(...args),

        // Theme manager instance (from deps.features) - returns instance when called as function
        themeManager: () => deps.features?.themeManager,

        // Theme functions (from themeManager in deps.features)
        setupDarkModeToggle: (...args) => deps.features?.setupDarkModeToggle?.(...args),
        setupQuickDarkToggle: (...args) => deps.features?.setupQuickDarkToggle?.(...args),
        updateThemeColor: (...args) => deps.features?.updateThemeColor?.(...args),
        unlockDarkOceanTheme: (...args) => deps.features?.unlockDarkOceanTheme?.(...args),
        unlockGoldenGlowTheme: (...args) => deps.features?.unlockGoldenGlowTheme?.(...args),
        initializeThemesPanel: (...args) => deps.features?.initializeThemesPanel?.(...args),
        refreshThemeToggles: (...args) => deps.features?.refreshThemeToggles?.(...args),
        setupThemesPanel: (...args) => deps.features?.setupThemesPanel?.(...args),

        // Games functions (from gamesManager instance in deps.ui)
        unlockMiniGame: (...args) => deps.ui?.gamesManager?.unlockMiniGame?.(...args),
        checkGamesUnlock: (...args) => deps.ui?.gamesManager?.checkGamesUnlock?.(...args),

        // Task functions (from task modules in deps.task) - lazy resolution for cross-phase deps
        validateAndSanitizeTaskInput: (...args) => deps.task?.validateAndSanitizeTaskInput?.(...args),
        loadTaskContext: (...args) => deps.task?.loadTaskContext?.(...args),
        createOrUpdateTaskData: (...args) => deps.task?.createOrUpdateTaskData?.(...args),
        createTaskDOMElements: (...args) => deps.task?.createTaskDOMElements?.(...args),
        setupTaskInteractions: (...args) => deps.task?.setupTaskInteractions?.(...args),
        finalizeTaskCreation: (...args) => deps.task?.finalizeTaskCreation?.(...args),
        refreshTaskListUI: (...args) => deps.task?.refreshTaskListUI?.(...args),
        addTask: (...args) => deps.task?.addTask?.(...args),
        resetTasks: (...args) => deps.task?.resetTasks?.(...args),
        handleTaskCompletionChange: (...args) => deps.task?.handleTaskCompletionChange?.(...args),
        saveTaskToSchema25: (...args) => deps.task?.saveTaskToSchema25?.(...args),

        // Task button container and click handler (from taskDOM)
        createTaskButtonContainer: (...args) => deps.task?.createTaskButtonContainer?.(...args),
        handleTaskButtonClick: (...args) => deps.task?.handleTaskButtonClick?.(...args),
        setupRecurringButtonHandler: (...args) => deps.task?.setupRecurringButtonHandler?.(...args),
        revealTaskButtons: (...args) => deps.task?.revealTaskButtons?.(...args),

        // TaskCore instance (for editTask, deleteTask, toggleTaskPriority) - lazy proxy
        taskCore: new Proxy({}, {
            get(target, prop) {
                return deps.task?.taskCore?.[prop];
            }
        }),

        // Task list rendering (loads from AppState then renders)
        renderTaskList: () => deps.task?.refreshTaskListUI?.(),

        // Mode sync (from GlobalUtils)
        syncAllTasksWithMode: (...args) => GlobalUtils?.syncAllTasksWithMode?.(...args),

        // Drag & drop functions (from deps.task)
        enableDragAndDropOnTask: (...args) => deps.task?.enableDragAndDropOnTask?.(...args),
        updateMoveArrowsVisibility: (...args) => deps.task?.updateMoveArrowsVisibility?.(...args),
        updateArrowsInDOM: (...args) => deps.task?.updateArrowsInDOM?.(...args),

        // Cycle functions (from cycle modules in deps.cycle) - lazy resolution
        switchMiniCycle: (...args) => deps.cycle?.switchMiniCycle?.(...args),
        renameMiniCycle: (...args) => deps.cycle?.renameMiniCycle?.(...args),
        deleteMiniCycle: (...args) => deps.cycle?.deleteMiniCycle?.(...args),
        loadMiniCycle: (...args) => deps.cycle?.loadMiniCycle?.(...args),
        showCycleCreationModal: (...args) => deps.cycle?.showCycleCreationModal?.(...args),
        createNewMiniCycle: (...args) => deps.cycle?.createNewMiniCycle?.(...args),
        checkMiniCycle: (...args) => deps.progress?.checkMiniCycle?.(...args),
        incrementCycleCount: (...args) => deps.progress?.incrementCycleCount?.(...args),
        showCompletionAnimation: (...args) => deps.progress?.showCompletionAnimation?.(...args),

        // UI functions (from deps.ui)
        refreshUIFromState: (...args) => deps.task?.refreshUIFromState?.(...args),
        closeAllModals: (...args) => deps.ui?.modalManager?.closeAllModals?.(...args),
        updateMainMenuHeader: (...args) => deps.ui?.updateMainMenuHeader?.(...args),
        organizeCompletedTasks: (...args) => deps.ui?.completedTasksManager?.organize?.(...args),
        initCompletedTasksSection: (...args) => deps.ui?.completedTasksManager?.init?.(...args),
        updateStatsPanel: (...args) => deps.ui?.updateStatsPanel?.(...args),
        triggerLogoBackground: (...args) => deps.ui?.triggerLogoBackground?.(...args),
        showTaskOptions: (...args) => deps.ui?.showTaskOptions?.(...args),
        hideTaskOptions: (...args) => deps.ui?.hideTaskOptions?.(...args),
        get TaskOptionsVisibilityController() { return deps.ui?.TaskOptionsVisibilityController; },
        attachKeyboardTaskOptionToggle: (...args) => deps.ui?.attachKeyboardTaskOptionToggle?.(...args),
        // taskOptionsCustomizer is an object - use Proxy for lazy resolution since it loads after taskDOM
        taskOptionsCustomizer: new Proxy({}, {
            get(target, prop) {
                return deps.ui?.taskOptionsCustomizer?.[prop];
            }
        }),

        // Undo/redo functions (api: 'undo' maps to deps.ui via apiToCategory)
        captureStateSnapshot: (...args) => deps.ui?.captureStateSnapshot?.(...args),
        performStateBasedUndo: (...args) => deps.ui?.performStateBasedUndo?.(...args),
        performStateBasedRedo: (...args) => deps.ui?.performStateBasedRedo?.(...args),
        enableUndoSystemOnFirstInteraction: (...args) => deps.ui?.enableUndoSystemOnFirstInteraction?.(...args),
        updateUndoRedoButtons: (...args) => deps.ui?.updateUndoRedoButtons?.(...args),

        // Reminders (from deps.features)
        startReminders: (...args) => deps.features?.startReminders?.(...args),
        stopReminders: (...args) => deps.features?.stopReminders?.(...args),
        updateReminderButtons: (...args) => deps.features?.updateReminderButtons?.(...args),
        setupReminderButtonHandler: (...args) => deps.features?.setupReminderButtonHandler?.(...args),

        // Due dates (from deps.features)
        checkOverdueTasks: (...args) => deps.features?.checkOverdueTasks?.(...args),
        remindOverdueTasks: (...args) => deps.features?.remindOverdueTasks?.(...args),
        createDueDateInput: (...args) => deps.features?.createDueDateInput?.(...args),

        // Recurring task activation/deactivation (from recurringCore via deps.recurring.core)
        handleRecurringTaskActivation: (...args) => deps.recurring?.core?.handleRecurringTaskActivation?.(...args),
        handleRecurringTaskDeactivation: (...args) => deps.recurring?.core?.handleRecurringTaskDeactivation?.(...args),

        // Recurring (from deps.recurring) - use Proxy for lazy evaluation
        // Proxy allows property access (e.g., recurringPanel.updateRecurringPanelButtonVisibility)
        // to be resolved lazily after the module loads
        recurringPanel: new Proxy({}, {
            get(target, prop) {
                return deps.recurring?.recurringPanel?.[prop];
            }
        }),
        recurringCore: new Proxy({}, {
            get(target, prop) {
                return deps.recurring?.recurringCore?.[prop];
            }
        }),
        updateRecurringPanelButtonVisibility: (...args) => deps.recurring?.recurringPanel?.updateRecurringPanelButtonVisibility?.(...args),
        catchUpMissedRecurringTasks: (...args) => deps.recurring?.core?.catchUpMissedRecurringTasks?.(...args),
        removeRecurringTasksFromCycle: (...args) => {
            // Try multiple paths for compatibility
            const fn = deps.recurring?.core?.removeRecurringTasksFromCycle
                    || deps.recurring?.removeTasksFromCycle;
            return fn?.(...args);
        },

        // Mode manager (from deps.cycle)
        modeManager: new Proxy({}, {
            get(target, prop) {
                return deps.cycle?.modeManager?.[prop];
            }
        }),
        refreshTaskButtonsForModeChange: (...args) => deps.cycle?.refreshTaskButtonsForModeChange?.(...args),
        initializeModeSelector: (...args) => deps.cycle?.setupModeSelector?.(...args),
        setupModeSelector: (...args) => deps.cycle?.setupModeSelector?.(...args),
        updateCycleModeDescription: (...args) => deps.cycle?.updateCycleModeDescription?.(...args),

        // Help window manager (from deps.ui) - returns instance when called as function
        helpWindowManager: () => deps.ui?.helpWindowManager,

        // Stats panel manager (from deps.ui) - returns instance when called as function
        statsPanelManager: () => deps.ui?.statsPanelManager,

        // State access - returns AppState object (not the state data)
        getAppState: () => deps.core?.AppState
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
 * @param {Object} instance - Module instance (from init function)
 * @param {Object} deps - Dependencies container
 * @param {Object} mod - Raw module exports (optional fallback for wrapper functions)
 */
function registerProvides(name, manifest, instance, deps, mod = null) {
    if (!manifest.provides) return;

    // Determine which deps category to use
    const category = getDepsCategoryForModule(manifest);

    for (const provided of manifest.provides) {
        // Look for the provided function/property on instance first
        let value = findProvidedValue(instance, provided);

        // Fallback to raw module exports if not found on instance
        // This handles cases where init returns an instance but wrapper functions are module-level exports
        if (value === undefined && mod) {
            value = findProvidedValue(mod, provided);
        }

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
        features: 'features',
        recurring: 'recurring',
        utils: 'utils',
        testing: 'testing',
        storage: 'storage',
        plugins: 'plugins',
        progress: 'progress'
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
    const value = instance[name];

    if (typeof value === 'function') {
        // Check if this is a class (ES6 class or constructor function with static methods)
        // Classes should NOT be bound because .bind() strips away static methods
        const isClass = /^class\s/.test(value.toString()) ||
                        (value.prototype && value.prototype.constructor === value &&
                         Object.getOwnPropertyNames(value).some(prop =>
                             prop !== 'length' && prop !== 'name' && prop !== 'prototype' &&
                             typeof value[prop] === 'function'));

        if (isClass) {
            // Return class as-is to preserve static methods
            return value;
        }

        // Regular function - bind to preserve 'this' context
        return value.bind(instance);
    }

    // Direct property (non-function)
    if (value !== undefined) {
        return value;
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
            initializeModeSelector: deps.cycle?.setupModeSelector,
            setupModeSelector: deps.cycle?.setupModeSelector
        },
        ui: {
            showNotification: deps.utils?.showNotification,
            showConfirmationModal: deps.utils?.showConfirmationModal,
            showPromptModal: deps.utils?.showPromptModal,
            hideMainMenu: deps.ui?.hideMainMenu,
            updateMainMenuHeader: deps.ui?.updateMainMenuHeader,
            closeAllModals: (...args) => deps.ui?.modalManager?.closeAllModals?.(...args),
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
