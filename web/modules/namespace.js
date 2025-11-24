/**
 * ==========================================
 * 🌐 NAMESPACE MODULE (Phase 2 - Direct Delegation)
 * ==========================================
 *
 * Consolidates 163 global variables into a single unified API:
 * window.miniCycle.*
 *
 * Phase 1: Wrapper layer that delegates to existing globals ✅
 * Phase 2: Direct module delegation (no globals) 🚧 IN PROGRESS
 *   - Step 1: GlobalUtils migrated ✅
 *   - Step 2: ThemeManager migrated ✅
 *   - Step 3: Notifications + ModalManager migrated ✅
 *
 * @version 1.374
 * @see docs/future-work/NAMESPACE_ARCHITECTURE.md
 */

// Phase 2 imports - direct module access
import GlobalUtils, { DEFAULT_TASK_OPTION_BUTTONS } from './utils/globalUtils.js';
import ThemeManager, {
    themeManager,
    applyTheme,
    updateThemeColor,
    setupDarkModeToggle,
    setupQuickDarkToggle,
    unlockDarkOceanTheme,
    unlockGoldenGlowTheme,
    initializeThemesPanel,
    refreshThemeToggles,
    setupThemesPanel,
    setupThemesPanelWithData
} from './features/themeManager.js';
import { MiniCycleNotifications, EducationalTipManager } from './utils/notifications.js';
import ModalManager, { modalManager } from './ui/modalManager.js';

/**
 * Initialize the miniCycle namespace
 * Phase 2: Some APIs delegate directly to modules (no window.* middleman)
 */
export function initializeNamespace() {
    // Create the root namespace object
    window.miniCycle = {
        // Internal metadata
        _version: '1.374',
        _deprecationWarnings: new Set(),

        // ===================================
        // TASKS API (28 functions)
        // ===================================
        tasks: {
            // Core CRUD operations
            add: (...args) => window.addTask?.(...args),
            edit: (...args) => window.editTask?.(...args),
            delete: (...args) => window.deleteTask?.(...args),
            validate: (...args) => window.validateAndSanitizeTaskInput?.(...args),

            // Rendering & UI
            render: (...args) => window.renderTasks?.(...args),
            refresh: (...args) => window.refreshTaskListUI?.(...args),
            toggle: (...args) => window.toggleTaskCompletion?.(...args),

            // Priority management
            priority: {
                toggle: (...args) => window.toggleHighPriority?.(...args),
                set: (...args) => window.setTaskPriority?.(...args)
            },

            // Recurring tasks
            recurring: {
                set: (...args) => window.setTaskRecurring?.(...args),
                update: (...args) => window.updateRecurringButtonVisibility?.(...args)
            },

            // Movement/ordering
            move: {
                up: (...args) => window.moveTaskUp?.(...args),
                down: (...args) => window.moveTaskDown?.(...args),
                toPosition: (...args) => window.moveTaskToPosition?.(...args)
            },

            // DOM operations
            getElement: (...args) => window.getTaskElement?.(...args),
            getData: (...args) => window.getTaskData?.(...args),
            createElement: (...args) => window.createTaskElement?.(...args),
            updateDOM: (...args) => window.updateTaskDOM?.(...args),
            removeFromDOM: (...args) => window.removeTaskFromDOM?.(...args),
            clear: (...args) => window.clearTaskList?.(...args),

            // Queries
            getCompleted: (...args) => window.getCompletedTasks?.(...args),
            getIncomplete: (...args) => window.getIncompleteTasks?.(...args),
            sort: (...args) => window.sortTasks?.(...args),
            filter: (...args) => window.filterTasks?.(...args),
            search: (...args) => window.searchTasks?.(...args),
            reorder: (...args) => window.reorderTasks?.(...args),
            duplicate: (...args) => window.duplicateTask?.(...args),
            bulkDelete: (...args) => window.bulkDeleteTasks?.(...args)
        },

        // ===================================
        // CYCLES API (19 functions)
        // ===================================
        cycles: {
            // Core operations
            create: (...args) => window.createNewMiniCycle?.(...args),
            switch: (...args) => window.switchMiniCycle?.(...args),
            delete: (...args) => window.deleteMiniCycle?.(...args),
            reset: (...args) => window.resetCurrentMiniCycle?.(...args),
            rename: (...args) => window.renameMiniCycle?.(...args),
            list: (...args) => window.listMiniCycles?.(...args),

            // Import/Export
            import: (...args) => window.importMiniCycle?.(...args),
            export: (...args) => window.exportMiniCycle?.(...args),

            // Data operations
            getActive: (...args) => window.getActiveCycle?.(...args),
            getData: (...args) => window.getCycleData?.(...args),
            update: (...args) => window.updateCycleData?.(...args),
            save: (...args) => window.saveCycleData?.(...args),
            load: (...args) => window.loadCycleData?.(...args),
            duplicate: (...args) => window.duplicateCycle?.(...args),
            archive: (...args) => window.archiveCycle?.(...args),
            unarchive: (...args) => window.unarchiveCycle?.(...args),
            getArchived: (...args) => window.getArchivedCycles?.(...args),
            restoreFromArchive: (...args) => window.restoreFromArchive?.(...args),
            permanentlyDelete: (...args) => window.permanentlyDeleteCycle?.(...args)
        },

        // ===================================
        // UI API
        // ===================================
        ui: {
            // Notifications (5 functions)
            notifications: {
                show: (...args) => window.showNotification?.(...args),
                showWithTip: (...args) => window.showNotificationWithTip?.(...args),
                hide: (...args) => window.hideNotification?.(...args),
                clearAll: (...args) => window.clearAllNotifications?.(...args),
                queue: (...args) => window.queueNotification?.(...args)
            },

            // Modals (8 functions)
            modals: {
                confirm: (...args) => window.showConfirmModal?.(...args),
                prompt: (...args) => window.showPromptModal?.(...args),
                show: (...args) => window.showModal?.(...args),
                hide: (...args) => window.hideModal?.(...args),
                closeAll: (...args) => window.closeAllModals?.(...args),
                alert: (...args) => window.showAlertModal?.(...args),
                custom: (...args) => window.showCustomModal?.(...args),
                isOpen: (...args) => window.isModalOpen?.(...args)
            },

            // Loaders & Progress (6 functions)
            loader: {
                show: (...args) => window.showLoader?.(...args),
                hide: (...args) => window.hideLoader?.(...args),
                with: (...args) => window.withLoader?.(...args)
            },
            progress: {
                update: (...args) => window.updateProgressBar?.(...args),
                show: (...args) => window.showProgressBar?.(...args),
                hide: (...args) => window.hideProgressBar?.(...args)
            },

            // Menu (3 functions)
            menu: {
                toggle: (...args) => window.toggleMainMenu?.(...args),
                show: (...args) => window.showMainMenu?.(...args),
                hide: (...args) => window.hideMainMenu?.(...args)
            }
        },

        // ===================================
        // UTILS API (26 functions)
        // Phase 2 Step 1: Direct delegation to GlobalUtils ✅
        // ===================================
        utils: {
            // DOM utilities
            dom: {
                addListener: (...args) => GlobalUtils.safeAddEventListener(...args),
                removeListener: (...args) => GlobalUtils.safeRemoveEventListener(...args),
                query: (...args) => GlobalUtils.safeQuerySelector(...args),
                queryAll: (...args) => GlobalUtils.safeQuerySelectorAll(...args),
                getElementById: (...args) => GlobalUtils.safeGetElementById(...args),
                setInnerHTML: (...args) => GlobalUtils.safeSetInnerHTML(...args),
                setTextContent: (...args) => GlobalUtils.safeSetTextContent(...args),
                toggleClass: (...args) => GlobalUtils.safeToggleClass(...args),
                addClass: (...args) => GlobalUtils.safeAddClass(...args),
                removeClass: (...args) => GlobalUtils.safeRemoveClass(...args)
            },

            // Storage utilities
            storage: {
                get: (...args) => GlobalUtils.safeLocalStorageGet(...args),
                set: (...args) => GlobalUtils.safeLocalStorageSet(...args),
                remove: (...args) => GlobalUtils.safeLocalStorageRemove(...args)
            },

            // JSON utilities
            json: {
                parse: (...args) => GlobalUtils.safeJSONParse(...args),
                stringify: (...args) => GlobalUtils.safeJSONStringify(...args)
            },

            // String utilities
            sanitize: (...args) => GlobalUtils.sanitizeInput(...args),
            escape: (...args) => GlobalUtils.escapeHtml(...args),

            // Function utilities
            debounce: (...args) => GlobalUtils.debounce(...args),
            throttle: (...args) => GlobalUtils.throttle(...args),

            // ID generation
            generateId: (...args) => GlobalUtils.generateId(...args),
            generateHashId: (...args) => GlobalUtils.generateHashId(...args),
            generateNotificationId: (...args) => GlobalUtils.generateNotificationId(...args),

            // Viewport
            isElementInViewport: (...args) => GlobalUtils.isElementInViewport(...args),

            // DeleteWhenComplete utilities
            validateDeleteSettings: (...args) => GlobalUtils.validateDeleteSettings(...args),
            syncTaskDeleteWhenCompleteDOM: (...args) => GlobalUtils.syncTaskDeleteWhenCompleteDOM(...args),
            syncAllTasksWithMode: (...args) => GlobalUtils.syncAllTasksWithMode(...args),

            // Constants
            DEFAULT_TASK_OPTION_BUTTONS
        },

        // ===================================
        // STATE API (3 functions)
        // ===================================
        state: {
            load: (...args) => window.loadMiniCycleData?.(...args),
            save: (...args) => window.saveTaskToSchema25?.(...args),
            get: (...args) => window.getMiniCycleState?.(...args)
        },

        // ===================================
        // HISTORY API (3 functions)
        // ===================================
        history: {
            undo: (...args) => window.performStateBasedUndo?.(...args),
            redo: (...args) => window.performStateBasedRedo?.(...args),
            capture: (...args) => window.captureStateSnapshot?.(...args)
        },

        // ===================================
        // FEATURES API
        // Phase 2 Step 2: ThemeManager migrated ✅
        // ===================================
        features: {
            themes: {
                // Core theme operations - direct delegation
                apply: (...args) => applyTheme(...args),
                updateColor: (...args) => updateThemeColor(...args),

                // Dark mode setup
                setupDarkMode: (...args) => setupDarkModeToggle(...args),
                setupQuickToggle: (...args) => setupQuickDarkToggle(...args),

                // Theme unlocks
                unlockDarkOcean: (...args) => unlockDarkOceanTheme(...args),
                unlockGoldenGlow: (...args) => unlockGoldenGlowTheme(...args),

                // Panel setup
                initializePanel: (...args) => initializeThemesPanel(...args),
                refreshToggles: (...args) => refreshThemeToggles(...args),
                setupPanel: (...args) => setupThemesPanel(...args),
                setupPanelWithData: (...args) => setupThemesPanelWithData(...args),

                // Legacy API (still delegates to window.* if exists)
                toggle: (...args) => window.toggleTheme?.(...args),
                get: (...args) => window.getCurrentTheme?.(...args)
            },
            games: {
                initialize: (...args) => window.initializeGames?.(...args),
                show: (...args) => window.showGame?.(...args),
                hide: (...args) => window.hideGame?.(...args)
            },
            onboarding: {
                start: (...args) => window.startOnboarding?.(...args),
                skip: (...args) => window.skipOnboarding?.(...args),
                isComplete: (...args) => window.isOnboardingComplete?.(...args)
            }
        }
    };

    console.log('✅ miniCycle namespace initialized (v1.374)');
    console.log('📖 API available at window.miniCycle.*');
}

/**
 * Install deprecation warnings on commonly used globals
 * Warns once per global, then allows normal usage
 *
 * Phase 2: Also installs backward-compat shims for migrated modules
 */
export function installDeprecationWarnings() {
    const topGlobals = [
        { old: 'showNotification', new: 'ui.notifications.show()' },
        { old: 'addTask', new: 'tasks.add()' },
        { old: 'switchMiniCycle', new: 'cycles.switch()' },
        { old: 'editTask', new: 'tasks.edit()' },
        { old: 'deleteTask', new: 'tasks.delete()' },
        { old: 'showConfirmModal', new: 'ui.modals.confirm()' },
        { old: 'showPromptModal', new: 'ui.modals.prompt()' },
        { old: 'createNewMiniCycle', new: 'cycles.create()' },
        { old: 'resetCurrentMiniCycle', new: 'cycles.reset()' },
        { old: 'deleteMiniCycle', new: 'cycles.delete()' },
        { old: 'sanitizeInput', new: 'utils.sanitize()' },
        { old: 'escapeHtml', new: 'utils.escape()' },
        { old: 'showLoader', new: 'ui.loader.show()' },
        { old: 'hideLoader', new: 'ui.loader.hide()' },
        { old: 'updateProgressBar', new: 'ui.progress.update()' },
        { old: 'toggleTaskCompletion', new: 'tasks.toggle()' },
        { old: 'renderTasks', new: 'tasks.render()' },
        { old: 'refreshTaskListUI', new: 'tasks.refresh()' },
        { old: 'performStateBasedUndo', new: 'history.undo()' },
        { old: 'performStateBasedRedo', new: 'history.redo()' }
    ];

    // Phase 2 Step 1: GlobalUtils backward-compat shims
    const globalUtilsShims = [
        // DOM utilities
        { old: 'safeAddEventListener', new: 'utils.dom.addListener()' },
        { old: 'safeAddEventListenerById', newFunc: GlobalUtils.safeAddEventListenerById },
        { old: 'safeAddEventListenerBySelector', newFunc: GlobalUtils.safeAddEventListenerBySelector },
        { old: 'safeRemoveEventListener', new: 'utils.dom.removeListener()' },
        { old: 'safeRemoveEventListenerById', newFunc: GlobalUtils.safeRemoveEventListenerById },
        { old: 'safeGetElementById', new: 'utils.dom.getElementById()' },
        { old: 'safeQuerySelector', new: 'utils.dom.query()' },
        { old: 'safeQuerySelectorAll', new: 'utils.dom.queryAll()' },
        { old: 'safeSetInnerHTML', new: 'utils.dom.setInnerHTML()' },
        { old: 'safeSetTextContent', new: 'utils.dom.setTextContent()' },
        { old: 'safeToggleClass', new: 'utils.dom.toggleClass()' },
        { old: 'safeAddClass', new: 'utils.dom.addClass()' },
        { old: 'safeRemoveClass', new: 'utils.dom.removeClass()' },
        { old: 'safeSetInnerHTMLWithEscape', newFunc: GlobalUtils.safeSetInnerHTMLWithEscape },

        // Storage utilities
        { old: 'safeLocalStorageGet', new: 'utils.storage.get()' },
        { old: 'safeLocalStorageSet', new: 'utils.storage.set()' },
        { old: 'safeLocalStorageRemove', new: 'utils.storage.remove()' },

        // JSON utilities
        { old: 'safeJSONParse', new: 'utils.json.parse()' },
        { old: 'safeJSONStringify', new: 'utils.json.stringify()' },

        // String utilities
        { old: 'sanitizeInput', new: 'utils.sanitize()' },
        { old: 'escapeHtml', new: 'utils.escape()' },

        // Function utilities
        { old: 'debounce', new: 'utils.debounce()' },
        { old: 'throttle', new: 'utils.throttle()' },

        // ID generation
        { old: 'generateId', new: 'utils.generateId()' },
        { old: 'generateHashId', new: 'utils.generateHashId()' },
        { old: 'generateNotificationId', new: 'utils.generateNotificationId()' },

        // Viewport
        { old: 'isElementInViewport', new: 'utils.isElementInViewport()' },

        // DeleteWhenComplete utilities
        { old: 'validateDeleteSettings', new: 'utils.validateDeleteSettings()' },
        { old: 'syncTaskDeleteWhenCompleteDOM', new: 'utils.syncTaskDeleteWhenCompleteDOM()' },
        { old: 'syncAllTasksWithMode', new: 'utils.syncAllTasksWithMode()' }
    ];

    // Phase 2 Step 2: ThemeManager backward-compat shims
    const themeManagerShims = [
        { old: 'applyTheme', newFunc: applyTheme, new: 'features.themes.apply()' },
        { old: 'updateThemeColor', newFunc: updateThemeColor, new: 'features.themes.updateColor()' },
        { old: 'setupDarkModeToggle', newFunc: setupDarkModeToggle, new: 'features.themes.setupDarkMode()' },
        { old: 'setupQuickDarkToggle', newFunc: setupQuickDarkToggle, new: 'features.themes.setupQuickToggle()' },
        { old: 'unlockDarkOceanTheme', newFunc: unlockDarkOceanTheme, new: 'features.themes.unlockDarkOcean()' },
        { old: 'unlockGoldenGlowTheme', newFunc: unlockGoldenGlowTheme, new: 'features.themes.unlockGoldenGlow()' },
        { old: 'initializeThemesPanel', newFunc: initializeThemesPanel, new: 'features.themes.initializePanel()' },
        { old: 'refreshThemeToggles', newFunc: refreshThemeToggles, new: 'features.themes.refreshToggles()' },
        { old: 'setupThemesPanel', newFunc: setupThemesPanel, new: 'features.themes.setupPanel()' },
        { old: 'setupThemesPanelWithData', newFunc: setupThemesPanelWithData, new: 'features.themes.setupPanelWithData()' },
        { old: 'ThemeManager', newFunc: ThemeManager, new: 'features.themes (class)' },
        { old: 'themeManager', newFunc: themeManager, new: 'features.themes (instance)' }
    ];

    // Phase 2 Step 3: Notifications + ModalManager backward-compat shims
    const notificationsShims = [
        { old: 'MiniCycleNotifications', newFunc: MiniCycleNotifications, new: 'ui.notifications (class)' },
        { old: 'EducationalTipManager', newFunc: EducationalTipManager, new: 'ui.notifications.tips (class)' }
    ];

    const modalManagerShims = [
        { old: 'ModalManager', newFunc: ModalManager, new: 'ui.modals (class)' },
        { old: 'modalManager', newFunc: modalManager, new: 'ui.modals (instance)' },
        { old: 'closeAllModals', newFunc: () => modalManager?.closeAllModals(), new: 'ui.modals.closeAll()' }
    ];

    // Install deprecation wrappers for existing globals
    topGlobals.forEach(({ old, new: newPath }) => {
        const original = window[old];
        if (typeof original === 'function') {
            window[old] = function (...args) {
                if (!window.miniCycle._deprecationWarnings.has(old)) {
                    console.warn(
                        `⚠️ DEPRECATED: window.${old}() is deprecated. ` +
                        `Use window.miniCycle.${newPath} instead. ` +
                        `Backward compatibility will be removed in v2.0.`
                    );
                    window.miniCycle._deprecationWarnings.add(old);
                }
                return original.apply(this, args);
            };
        }
    });

    // Phase 2: Install backward-compat shims for migrated modules
    // These functions no longer exist on window.*, so we create them
    const allPhase2Shims = [...globalUtilsShims, ...themeManagerShims, ...notificationsShims, ...modalManagerShims];

    allPhase2Shims.forEach(({ old, new: newPath, newFunc }) => {
        let targetFunc;

        // Option 1: Direct function reference
        if (newFunc) {
            targetFunc = newFunc;
        }
        // Option 2: Extract from namespace path
        else if (newPath) {
            const pathParts = newPath.replace('()', '').split('.');
            let namespaceFunc = window.miniCycle;
            for (const part of pathParts) {
                namespaceFunc = namespaceFunc?.[part];
            }
            targetFunc = namespaceFunc;
        }

        if (typeof targetFunc === 'function' || typeof targetFunc === 'object') {
            // For functions, create wrapper with deprecation warning
            if (typeof targetFunc === 'function') {
                window[old] = function (...args) {
                    if (!window.miniCycle._deprecationWarnings.has(old)) {
                        console.warn(
                            `⚠️ DEPRECATED: window.${old}() is deprecated. ` +
                            `Use window.miniCycle.${newPath || 'features.*'} instead. ` +
                            `Backward compatibility will be removed in v2.0.`
                        );
                        window.miniCycle._deprecationWarnings.add(old);
                    }
                    return targetFunc.apply(this, args);
                };
            }
            // For objects/classes, expose directly (e.g., ThemeManager class, themeManager instance)
            else {
                window[old] = targetFunc;
            }
        }
    });

    // Also expose constants and classes
    window.DEFAULT_TASK_OPTION_BUTTONS = DEFAULT_TASK_OPTION_BUTTONS;
    window.GlobalUtils = GlobalUtils;

    console.log(`⚠️  Deprecation warnings installed (20 top globals, ${globalUtilsShims.length} GlobalUtils shims, ${themeManagerShims.length} ThemeManager shims, ${notificationsShims.length + modalManagerShims.length} Step 3 shims)`);
}
