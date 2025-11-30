/**
 * ==========================================
 * miniCycle Namespace Module (Trimmed)
 * ==========================================
 *
 * Provides a clean public API at window.miniCycle.*
 *
 * PHILOSOPHY:
 * - Only expose the PUBLIC API (functions new code should use)
 * - Internal/helper functions stay on window.* via direct exposure
 * - Minimal shims for backward compatibility
 *
 * USAGE:
 * - New code: use window.miniCycle.tasks.add(), miniCycle.ui.notify(), etc.
 * - Old code: window.addTask() still works via shims (will show deprecation warning)
 *
 * @version 2.0.0
 */

// ============================================
// PUBLIC API REGISTRY
// Only functions that should be part of the public API
// ============================================
const modules = {
    // === TASKS ===
    addTask: null,
    editTask: null,
    deleteTask: null,
    resetTasks: null,
    handleCompleteAllTasks: null,
    validateAndSanitizeTaskInput: null,

    // === CYCLES ===
    switchMiniCycle: null,
    deleteMiniCycle: null,
    renameMiniCycle: null,
    loadMiniCycle: null,

    // === UI - Notifications ===
    showNotification: null,

    // === UI - Modals ===
    showConfirmModal: null,
    showPromptModal: null,
    closeAllModals: null,

    // === STATE ===
    loadMiniCycleData: null,
    AppState: null,

    // === UTILS ===
    sanitizeInput: null,
    escapeHtml: null,
    generateId: null,

    // === HISTORY (Undo/Redo) ===
    performStateBasedUndo: null,
    performStateBasedRedo: null
};

/**
 * Inject public API dependencies.
 * Called by miniCycle-scripts.js after loading modules.
 *
 * @param {Object} deps - Object containing public API function references
 */
export function injectNamespaceDeps(deps) {
    Object.keys(deps).forEach(key => {
        if (key in modules && deps[key] !== undefined) {
            modules[key] = deps[key];
        }
    });
    console.log(`✅ Namespace: ${Object.keys(deps).filter(k => k in modules).length} public API functions injected`);
}

/**
 * Initialize the miniCycle namespace
 * Creates a clean, minimal window.miniCycle.* API
 */
export function initializeNamespace() {
    window.miniCycle = {
        _version: '2.0.0',
        _deprecationWarnings: new Set(),

        // ===================================
        // TASKS API
        // ===================================
        tasks: {
            add: (...args) => modules.addTask?.(...args),
            edit: (...args) => modules.editTask?.(...args),
            delete: (...args) => modules.deleteTask?.(...args),
            reset: () => modules.resetTasks?.(),
            completeAll: () => modules.handleCompleteAllTasks?.(),
            validate: (...args) => modules.validateAndSanitizeTaskInput?.(...args)
        },

        // ===================================
        // CYCLES API
        // ===================================
        cycles: {
            switch: (...args) => modules.switchMiniCycle?.(...args),
            delete: (...args) => modules.deleteMiniCycle?.(...args),
            rename: (...args) => modules.renameMiniCycle?.(...args),
            load: (...args) => modules.loadMiniCycle?.(...args)
        },

        // ===================================
        // UI API
        // ===================================
        ui: {
            notify: (...args) => modules.showNotification?.(...args),
            confirm: (...args) => modules.showConfirmModal?.(...args),
            prompt: (...args) => modules.showPromptModal?.(...args),
            closeModals: () => modules.closeAllModals?.()
        },

        // ===================================
        // STATE API
        // ===================================
        state: {
            load: (...args) => modules.loadMiniCycleData?.(...args),
            get: () => modules.AppState
        },

        // ===================================
        // UTILS API
        // ===================================
        utils: {
            sanitize: (...args) => modules.sanitizeInput?.(...args),
            escape: (...args) => modules.escapeHtml?.(...args),
            generateId: () => modules.generateId?.()
        },

        // ===================================
        // HISTORY API (Undo/Redo)
        // ===================================
        history: {
            undo: (...args) => modules.performStateBasedUndo?.(...args),
            redo: (...args) => modules.performStateBasedRedo?.(...args)
        }
    };

    console.log('✅ miniCycle namespace initialized (v2.0.0)');
    console.log('📖 Public API: window.miniCycle.{tasks, cycles, ui, state, utils, history}');
}

/**
 * Install deprecation warnings on commonly used legacy globals.
 * Only covers the PUBLIC API functions - internal helpers don't need warnings.
 */
export function installDeprecationWarnings() {
    const deprecatedGlobals = [
        { old: 'addTask', path: 'tasks.add' },
        { old: 'editTask', path: 'tasks.edit' },
        { old: 'deleteTask', path: 'tasks.delete' },
        { old: 'resetTasks', path: 'tasks.reset' },
        { old: 'switchMiniCycle', path: 'cycles.switch' },
        { old: 'deleteMiniCycle', path: 'cycles.delete' },
        { old: 'renameMiniCycle', path: 'cycles.rename' },
        { old: 'showNotification', path: 'ui.notify' },
        { old: 'showConfirmModal', path: 'ui.confirm' },
        { old: 'showPromptModal', path: 'ui.prompt' },
        { old: 'sanitizeInput', path: 'utils.sanitize' },
        { old: 'escapeHtml', path: 'utils.escape' }
    ];

    deprecatedGlobals.forEach(({ old, path }) => {
        const original = window[old];
        if (typeof original === 'function') {
            window[old] = function (...args) {
                if (!window.miniCycle._deprecationWarnings.has(old)) {
                    console.warn(
                        `⚠️ DEPRECATED: window.${old}() → use window.miniCycle.${path}() instead`
                    );
                    window.miniCycle._deprecationWarnings.add(old);
                }
                return original.apply(this, args);
            };
        }
    });

    console.log('✅ Deprecation warnings installed for legacy globals');
}
