/**
 * ==========================================
 * 🌐 NAMESPACE MODULE (Phase 2 - Direct Delegation)
 * ==========================================
 *
 * Consolidates 163 global variables into a single unified API:
 * window.miniCycle.*
 *
 * Phase 1: Wrapper layer that delegates to existing globals ✅
 * Phase 2: Direct module delegation (no globals) ✅ COMPLETE!
 *   - Step 1-13: 28 modules migrated, 170 shims installed ✅
 * Phase 3: Critical modules ✅ COMPLETE!
 *   - Step 1: TaskCore migrated ✅ (11 exports)
 *   - Step 2: UndoRedoManager migrated ✅ (17 exports)
 *   - Step 3: CycleLoader migrated ✅ (2 exports)
 *   - Step 4: Recurring modules migrated ✅ (14 exports)
 *   - Step 5: UI managers migrated ✅ (17 exports)
 * Phase 4: Final cleanup ✅ COMPLETE!
 *   - Step 1: DeviceDetection migrated ✅ (6 exports)
 *   - Step 2: AppState added to namespace ✅ (3 functions)
 *   - Step 3: MigrationManager added to namespace ✅ (4 functions)
 *   - Step 4: RecurringIntegration cleaned up ✅ (removed duplicates)
 *   - Bug Fix: Lazy evaluation pattern for DI modules ✅ (13 recurring shims)
 *
 * CRITICAL PATTERN: Modules with Dependency Injection
 * Recurring modules use strict DI - dependencies are injected at runtime by
 * recurringIntegration. Shims MUST use lazy evaluation through window.recurringCore.*
 * to ensure dependencies are available when functions are called.
 *
 * ❌ WRONG: { old: 'foo', newFunc: importedFoo, ... }  // Called before DI!
 * ✅ RIGHT: { old: 'foo', newFunc: () => window.obj.foo(), ... }  // Lazy lookup after DI
 *
 * @version 1.377
 * @see docs/future-work/NAMESPACE_ARCHITECTURE.md
 */

// Phase 2 imports - direct module access
import GlobalUtils, { DEFAULT_TASK_OPTION_BUTTONS } from './utils/globalUtils.js';
import { PluginManager, MiniCyclePlugin, pluginManager } from './other/basicPluginSystem.js';
import { CycleManager, initializeCycleManager, getCycleManager } from './cycle/cycleManager.js';
import { TaskRenderer, initTaskRenderer, renderTasks, refreshUIFromState, refreshTaskListUI } from './task/taskRenderer.js';
import TimeTrackerPlugin from './other/exampleTimeTrackerPlugin.js';
import {
    setupAutomatedTestingFunctions,
    runIndividualModuleTest,
    runAllAutomatedTests,
    loadTestModules
} from './testing/testing-modal-integration.js';
import { DataValidator } from './utils/dataValidator.js';
import errorHandler from './utils/errorHandler.js';
import backupManager from './storage/backupManager.js';
import MiniCycleDueDates from './features/dueDates.js';
import MiniCycleReminders from './features/reminders.js';
import StatsPanelManager from './features/statsPanel.js';
import { appInit } from './core/appInit.js';
import { ModeManager, initModeManager } from './cycle/modeManager.js';
import { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, DEFAULT_RECURRING_DELETE_SETTINGS } from './core/constants.js';
import { TaskValidator, initTaskValidator, validateAndSanitizeTaskInput } from './task/taskValidation.js';
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
import OnboardingManager, { onboardingManager } from './ui/onboardingManager.js';
import GamesManager, { gamesManager } from './ui/gamesManager.js';
import consoleCapture, {
    showAllCapturedLogs,
    clearAllConsoleLogs,
    showMigrationErrorsOnly,
    getConsoleCaptureStats,
    stopConsoleCapture
} from './utils/consoleCapture.js';
import {
    initDragDropManager,
    enableDragAndDropOnTask,
    updateMoveArrowsVisibility,
    toggleArrowVisibility,
    updateArrowsInDOM
} from './task/dragDropManager.js';
import { TaskUtils, buildTaskContext, extractTaskDataFromDOM, loadTaskContext, scrollToNewTask, handleOverdueStyling, setupFinalTaskInteractions } from './task/taskUtils.js';
import { TaskEvents, initTaskEvents, handleTaskButtonClick, toggleHoverTaskOptions, revealTaskButtons, syncRecurringStateToDOM, setupTaskInteractions, setupTaskClickInteraction } from './task/taskEvents.js';
import { CycleSwitcher, initializeCycleSwitcher, switchMiniCycle, renameMiniCycle, deleteMiniCycle, hideSwitchMiniCycleModal, confirmMiniCycle, updatePreview, loadMiniCycleList, setupModalClickOutside } from './cycle/cycleSwitcher.js';
import {
    setupTestingModal,
    initializeTestingModalEnhancements,
    openStorageViewer,
    closeStorageViewer,
    appendToTestResults,
    clearTestResults,
    exportTestResults,
    copyTestResults,
    safeShowNotification,
    safeShowConfirmationModal,
    safeShowPromptModal
} from './testing/testing-modal.js';
import { TaskDOMManager, initTaskDOMManager, createTaskDOMElements, createMainTaskElement, createThreeDotsButton, createTaskButtonContainer, createTaskButton, createTaskContentElements, createTaskCheckbox, createTaskLabel, setupRecurringButtonHandler, setupTaskHoverInteractions, setupTaskFocusInteractions, finalizeTaskCreation, updateUIAfterTaskCreation } from './task/taskDOM.js';
import { TaskCore, initTaskCore, taskCoreInstance, addTask, editTaskFromCore, deleteTaskFromCore, toggleTaskPriorityFromCore, handleTaskCompletionChange, saveCurrentTaskOrder, saveTaskToSchema25, resetTasks, handleCompleteAllTasks } from './task/taskCore.js';
import {
    setUndoRedoManagerDependencies,
    wireUndoRedoUI,
    initializeUndoRedoButtons,
    captureInitialSnapshot,
    setupStateBasedUndoRedo,
    enableUndoSystemOnFirstInteraction,
    captureStateSnapshot,
    buildSnapshotSignature,
    snapshotsEqual,
    performStateBasedUndo,
    performStateBasedRedo,
    updateUndoRedoButtonStates,
    updateUndoRedoButtonVisibility,
    updateUndoRedoButtons,
    onCycleSwitched,
    onCycleCreated,
    onCycleDeleted,
    onCycleRenamed,
    initializeUndoSystemForApp,
    initializeUndoIndexedDB,
    saveUndoStackToIndexedDB,
    loadUndoStackFromIndexedDB,
    deleteUndoStackFromIndexedDB,
    renameUndoStackInIndexedDB,
    clearAllUndoHistoryFromIndexedDB
} from './ui/undoRedoManager.js';
import {
    loadMiniCycle,
    repairAndCleanTasks,
    renderTasksToDOM,
    updateCycleUIState,
    applyThemeSettings,
    setupRemindersForCycle,
    updateDependentComponents,
    saveCycleData,
    setCycleLoaderDependencies
} from './cycle/cycleLoader.js';
import {
    setRecurringCoreDependencies,
    applyRecurringToTaskSchema25,
    handleRecurringTaskActivation,
    handleRecurringTaskDeactivation,
    deleteRecurringTemplate,
    removeRecurringTasksFromCycle,
    handleRecurringTasksAfterReset,
    watchRecurringTasks,
    catchUpMissedRecurringTasks,
    setupRecurringWatcher
} from './recurring/recurringCore.js';
import {
    RecurringPanelManager,
    buildRecurringSummaryFromSettings
} from './recurring/recurringPanel.js';
import { MenuManager, initMenuManager } from './ui/menuManager.js';
import { SettingsManager, initSettingsManager } from './ui/settingsManager.js';
import { TaskOptionsCustomizer, initTaskOptionsCustomizer, taskOptionsCustomizer } from './ui/taskOptionsCustomizer.js';
import {
    DeviceDetectionManager,
    deviceDetectionManager,
    initializeDeviceDetectionManager,
    runDeviceDetection,
    autoRedetectOnVersionChange,
    reportDeviceCompatibility,
    testDeviceDetection
} from './utils/deviceDetection.js';
import { createStateManager, resetStateManager } from './core/appState.js';
import {
    initializeAppWithAutoMigration,
    performSchema25Migration,
    checkMigrationNeeded,
    simulateMigrationToSchema25,
    validateAllMiniCycleTasksLenient,
    forceAppMigration
} from './cycle/migrationManager.js';

/**
 * Initialize the miniCycle namespace
 * Phase 2: Some APIs delegate directly to modules (no window.* middleman)
 */
export function initializeNamespace() {
    // Create the root namespace object
    window.miniCycle = {
        // Internal metadata
        _version: '1.377',
        _deprecationWarnings: new Set(),

        // ===================================
        // TASKS API (Phase 3 - Direct imports)
        // ===================================
        tasks: {
            // Core CRUD operations (Phase 3 Step 1: taskCore.js)
            add: (...args) => addTask?.(...args),
            edit: (taskItem) => editTaskFromCore?.(taskItem),
            delete: (taskItem) => deleteTaskFromCore?.(taskItem),
            validate: (...args) => validateAndSanitizeTaskInput?.(...args),

            // Task state management (Phase 3 Step 1: taskCore.js)
            toggleCompletion: (checkbox) => handleTaskCompletionChange?.(checkbox),
            togglePriority: (taskItem) => toggleTaskPriorityFromCore?.(taskItem),
            saveOrder: () => saveCurrentTaskOrder?.(),
            reset: () => resetTasks?.(),
            completeAll: () => handleCompleteAllTasks?.(),

            // Data persistence (Phase 3 Step 1: taskCore.js)
            saveToSchema: (cycleId, cycleData) => saveTaskToSchema25?.(cycleId, cycleData),

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
        // CYCLES API (Phase 3 Step 3: cycleLoader.js + others)
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
            duplicate: (...args) => window.duplicateCycle?.(...args),
            archive: (...args) => window.archiveCycle?.(...args),
            unarchive: (...args) => window.unarchiveCycle?.(...args),
            getArchived: (...args) => window.getArchivedCycles?.(...args),
            restoreFromArchive: (...args) => window.restoreFromArchive?.(...args),
            permanentlyDelete: (...args) => window.permanentlyDeleteCycle?.(...args),

            // Cycle loading & management (Phase 3 Step 3: cycleLoader.js)
            load: (...args) => loadMiniCycle?.(...args),
            save: (...args) => saveCycleData?.(...args),
            repair: () => repairAndCleanTasks?.(),
            renderTasks: () => renderTasksToDOM?.(),
            updateUI: () => updateCycleUIState?.(),
            applyTheme: () => applyThemeSettings?.(),
            setupReminders: () => setupRemindersForCycle?.(),
            updateComponents: () => updateDependentComponents?.()
        },

        // ===================================
        // UI API
        // ===================================
        ui: {
            // Notifications (5 functions)
            notifications: {
                show: (...args) => safeShowNotification?.(...args),
                showWithTip: (...args) => window.showNotificationWithTip?.(...args),
                hide: (...args) => window.hideNotification?.(...args),
                clearAll: (...args) => window.clearAllNotifications?.(...args),
                queue: (...args) => window.queueNotification?.(...args)
            },

            // Modals (8 functions)
            modals: {
                confirm: (...args) => safeShowConfirmationModal?.(...args),
                prompt: (...args) => safeShowPromptModal?.(...args),
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

            // Menu (Phase 3 Step 5: menuManager.js)
            menu: {
                toggle: (...args) => window.toggleMainMenu?.(...args),
                show: (...args) => window.showMainMenu?.(...args),
                hide: (...args) => window.hideMainMenu?.(...args),
                setup: () => window.setupMainMenu?.(),
                close: () => window.closeMainMenu?.(),
                updateHeader: () => window.updateMainMenuHeader?.(),
                closeOnClickOutside: (event) => window.closeMenuOnClickOutside?.(event),
                saveAsNew: () => window.saveMiniCycleAsNew?.(),
                clearAll: () => window.clearAllTasks?.(),
                deleteAll: () => window.deleteAllTasks?.()
            },

            // Settings (Phase 3 Step 5: settingsManager.js)
            settings: {
                setup: () => window.setupSettingsMenu?.(),
                setupDownload: () => window.setupDownloadMiniCycle?.(),
                export: (data, name) => window.exportMiniCycleData?.(data, name),
                setupUpload: () => window.setupUploadMiniCycle?.(),
                sync: () => window.syncCurrentSettingsToStorage?.()
            },

            // Task Options Customizer (Phase 3 Step 5: taskOptionsCustomizer.js)
            taskOptions: {
                // Instance available through window.taskOptionsCustomizer
                getInstance: () => window.taskOptionsCustomizer || taskOptionsCustomizer
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

            // Device detection (Phase 4 Step 1: deviceDetection.js)
            device: {
                run: () => runDeviceDetection?.(),
                autoRedetect: () => autoRedetectOnVersionChange?.(),
                report: () => reportDeviceCompatibility?.(),
                test: () => testDeviceDetection?.(),
                getManager: () => deviceDetectionManager || window.deviceDetectionManager
            },

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
        // STATE API (Phase 4 Step 2: appState.js)
        // ===================================
        state: {
            load: (...args) => window.loadMiniCycleData?.(...args),
            save: (...args) => window.saveTaskToSchema25?.(...args),
            get: (...args) => window.getMiniCycleState?.(...args),
            // State manager (Phase 4 Step 2)
            create: (deps) => createStateManager?.(deps),
            reset: () => resetStateManager?.(),
            getManager: () => window.AppState
        },

        // ===================================
        // MIGRATION API (Phase 4 Step 3: migrationManager.js)
        // ===================================
        migration: {
            init: (opts) => initializeAppWithAutoMigration?.(opts),
            migrate: () => performSchema25Migration?.(),
            check: () => checkMigrationNeeded?.(),
            simulate: (dryRun) => simulateMigrationToSchema25?.(dryRun),
            validate: () => validateAllMiniCycleTasksLenient?.(),
            force: () => forceAppMigration?.()
        },

        // ===================================
        // HISTORY API (Phase 3 Step 2: undoRedoManager.js)
        // ===================================
        history: {
            // Core undo/redo operations
            undo: (...args) => performStateBasedUndo?.(...args),
            redo: (...args) => performStateBasedRedo?.(...args),
            capture: (state) => {
                // Safe wrapper - check if function exists before calling
                // (dependencies might not be initialized yet)
                try {
                    return captureStateSnapshot?.(state);
                } catch (e) {
                    // Silently fail if undo system not initialized yet
                    // This is expected during early app initialization
                    return null;
                }
            },

            // Initialization
            init: (...args) => initializeUndoSystemForApp?.(...args),
            setup: (...args) => setupStateBasedUndoRedo?.(...args),
            enable: () => enableUndoSystemOnFirstInteraction?.(),

            // UI updates
            updateButtons: () => updateUndoRedoButtons?.(),
            updateButtonStates: () => updateUndoRedoButtonStates?.(),
            updateButtonVisibility: () => updateUndoRedoButtonVisibility?.(),

            // Lifecycle hooks
            onCycleSwitched: (cycleId) => onCycleSwitched?.(cycleId),
            onCycleCreated: (cycleId) => onCycleCreated?.(cycleId),
            onCycleDeleted: (cycleId) => onCycleDeleted?.(cycleId),
            onCycleRenamed: (oldId, newId) => onCycleRenamed?.(oldId, newId),

            // IndexedDB persistence
            db: {
                init: () => initializeUndoIndexedDB?.(),
                save: (cycleId, undo, redo) => saveUndoStackToIndexedDB?.(cycleId, undo, redo),
                load: (cycleId) => loadUndoStackFromIndexedDB?.(cycleId),
                delete: (cycleId) => deleteUndoStackFromIndexedDB?.(cycleId),
                rename: (oldId, newId) => renameUndoStackInIndexedDB?.(oldId, newId),
                clearAll: () => clearAllUndoHistoryFromIndexedDB?.()
            }
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
            },

            // Recurring tasks (Phase 3 Step 4: recurringCore.js + recurringPanel.js)
            // IMPORTANT: Use lazy evaluation through window.recurringCore.* for DI
            recurring: {
                // Core operations - delegate to window.recurringCore (set by recurringIntegration)
                apply: (taskId, settings) => window.recurringCore?.applyRecurringSettings?.(taskId, settings),
                activate: (task, context, button) => window.recurringCore?.handleActivation?.(task, context, button),
                deactivate: (task, context, taskId) => window.recurringCore?.handleDeactivation?.(task, context, taskId),
                delete: (taskId) => window.recurringCore?.deleteTemplate?.(taskId),
                remove: (elements, data) => window.recurringCore?.removeTasksFromCycle?.(elements, data),
                afterReset: () => window.recurringCore?.handleAfterReset?.(),

                // Watcher/background tasks
                watch: () => window.recurringCore?.watchTasks?.(),
                catchUp: () => window.recurringCore?.catchUpMissedTasks?.(),
                setupWatcher: () => setupRecurringWatcher?.(),

                // Panel UI - accessed through recurringIntegration window.recurringPanel
                panel: {
                    update: () => window.recurringPanel?.updatePanel(),
                    updateSummary: () => window.recurringPanel?.updateSummary(),
                    updateButtonVisibility: () => window.recurringPanel?.updateButtonVisibility(),
                    open: () => window.recurringPanel?.openPanel(),
                    close: () => window.recurringPanel?.closePanel(),
                    openForTask: (taskId) => window.recurringPanel?.openForTask(taskId),
                    saveAlwaysShow: () => window.recurringPanel?.saveAlwaysShowRecurringSetting(),
                    loadAlwaysShow: () => window.recurringPanel?.loadAlwaysShowRecurringSetting()
                },

                // Utility
                buildSummary: (settings) => buildRecurringSummaryFromSettings?.(settings)
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
        { old: 'closeAllModals', newFunc: (...args) => modalManager?.closeAllModals(...args), new: 'ui.modals.closeAll()' }
    ];

    // Phase 2 Step 4: OnboardingManager + GamesManager + ConsoleCapture backward-compat shims
    const onboardingShims = [
        { old: 'OnboardingManager', newFunc: OnboardingManager, new: 'ui.onboarding (class)' },
        { old: 'onboardingManager', newFunc: onboardingManager, new: 'ui.onboarding (instance)' },
        { old: 'showOnboarding', newFunc: (...args) => onboardingManager?.showOnboarding(...args), new: 'ui.onboarding.show()' }
    ];

    const gamesShims = [
        { old: 'GamesManager', newFunc: GamesManager, new: 'ui.games (class)' },
        { old: 'gamesManager', newFunc: gamesManager, new: 'ui.games (instance)' },
        { old: 'checkGamesUnlock', newFunc: (...args) => gamesManager?.checkGamesUnlock(...args), new: 'ui.games.checkUnlock()' },
        { old: 'unlockMiniGame', newFunc: (...args) => gamesManager?.unlockMiniGame(...args), new: 'ui.games.unlock()' }
    ];

    const consoleCaptureShims = [
        { old: 'showAllCapturedLogs', newFunc: showAllCapturedLogs, new: 'utils.console.showAllLogs()' },
        { old: 'clearAllConsoleLogs', newFunc: clearAllConsoleLogs, new: 'utils.console.clearLogs()' },
        { old: 'showMigrationErrorsOnly', newFunc: showMigrationErrorsOnly, new: 'utils.console.showErrors()' },
        { old: 'getConsoleCaptureStats', newFunc: getConsoleCaptureStats, new: 'utils.console.getStats()' },
        { old: 'stopConsoleCapture', newFunc: stopConsoleCapture, new: 'utils.console.stop()' }
    ];

    // Phase 2 Step 5: DataValidator + ErrorHandler + BackupManager + DueDates + Reminders + StatsPanel backward-compat shims
    const step5Shims = [
        { old: 'DataValidator', newFunc: DataValidator, new: 'utils.validation (class)' },
        { old: 'ErrorHandler', newFunc: errorHandler, new: 'utils.errors (instance)' },
        { old: 'BackupManager', newFunc: backupManager, new: 'storage.backups (instance)' },
        { old: 'MiniCycleDueDates', newFunc: MiniCycleDueDates, new: 'features.dueDates (class)' },
        { old: 'MiniCycleReminders', newFunc: MiniCycleReminders, new: 'features.reminders (class)' },
        { old: 'StatsPanelManager', newFunc: StatsPanelManager, new: 'features.stats (class)' }
    ];

    // Phase 2 Step 6: AppInit + ModeManager + Constants + TaskValidation backward-compat shims
    const step6Shims = [
        { old: 'appInit', newFunc: appInit, new: 'core.init (instance)' },
        { old: 'ModeManager', newFunc: ModeManager, new: 'cycle.modes (class)' },
        { old: 'DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS', newFunc: DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, new: 'core.constants.DELETE_WHEN_COMPLETE' },
        { old: 'DEFAULT_RECURRING_DELETE_SETTINGS', newFunc: DEFAULT_RECURRING_DELETE_SETTINGS, new: 'core.constants.RECURRING_DELETE' },
        { old: 'TaskValidator', newFunc: TaskValidator, new: 'tasks.validation (class)' },
        { old: 'initTaskValidator', newFunc: initTaskValidator, new: 'tasks.validation.init()' },
        { old: 'validateAndSanitizeTaskInput', newFunc: validateAndSanitizeTaskInput, new: 'tasks.validation.validate()' }
    ];

    // Phase 2 Step 7: BasicPluginSystem + TimeTrackerPlugin + TestingModalIntegration backward-compat shims
    const step7Shims = [
        { old: 'pluginManager', newFunc: pluginManager, new: 'plugins.manager (instance)' },
        { old: 'MiniCyclePlugin', newFunc: MiniCyclePlugin, new: 'plugins.base (class)' },
        { old: 'TimeTrackerPlugin', newFunc: TimeTrackerPlugin, new: 'plugins.timeTracker (class)' },
        { old: 'setupAutomatedTestingFunctions', newFunc: setupAutomatedTestingFunctions, new: 'testing.setup()' },
        { old: 'runIndividualModuleTest', newFunc: runIndividualModuleTest, new: 'testing.runModule()' },
        { old: 'runAllAutomatedTests', newFunc: runAllAutomatedTests, new: 'testing.runAll()' },
        { old: 'loadTestModules', newFunc: loadTestModules, new: 'testing.loadModules()' }
    ];

    // Phase 2 Step 8: CycleManager + TaskRenderer backward-compat shims
    // Note: cycleManager instance methods use window.cycleManager as fallback for cross-module instance access
    const step8Shims = [
        { old: 'CycleManager', newFunc: CycleManager, new: 'cycles.manager (class)' },
        { old: 'showCycleCreationModal', newFunc: (...args) => window.cycleManager?.showCycleCreationModal(...args), new: 'cycles.showCreationModal()' },
        { old: 'preloadGettingStartedCycle', newFunc: (...args) => window.cycleManager?.preloadGettingStartedCycle(...args), new: 'cycles.preloadGettingStarted()' },
        { old: 'createBasicFallbackCycle', newFunc: (...args) => window.cycleManager?.createBasicFallbackCycle(...args), new: 'cycles.createFallback()' },
        { old: 'createNewMiniCycle', newFunc: (...args) => window.cycleManager?.createNewMiniCycle(...args), new: 'cycles.create()' },
        { old: 'TaskRenderer', newFunc: TaskRenderer, new: 'tasks.renderer (class)' },
        { old: 'initTaskRenderer', newFunc: initTaskRenderer, new: 'tasks.renderer.init()' },
        { old: 'renderTasks', newFunc: renderTasks, new: 'tasks.render()' },
        { old: 'refreshUIFromState', newFunc: refreshUIFromState, new: 'tasks.refreshUI()' },
        { old: 'refreshTaskListUI', newFunc: refreshTaskListUI, new: 'tasks.refreshList()' }
    ];

    // Phase 2 Step 9: DragDropManager + TaskUtils backward-compat shims
    const step9Shims = [
        { old: 'initDragDropManager', newFunc: initDragDropManager, new: 'tasks.dragDrop.init()' },
        { old: 'DragAndDrop', newFunc: enableDragAndDropOnTask, new: 'tasks.dragDrop.enable()' },
        { old: 'updateMoveArrowsVisibility', newFunc: updateMoveArrowsVisibility, new: 'tasks.arrows.updateVisibility()' },
        { old: 'toggleArrowVisibility', newFunc: toggleArrowVisibility, new: 'tasks.arrows.toggle()' },
        { old: 'updateArrowsInDOM', newFunc: updateArrowsInDOM, new: 'tasks.arrows.updateDOM()' },
        { old: 'TaskUtils', newFunc: TaskUtils, new: 'tasks.utils (class)' },
        { old: 'buildTaskContext', newFunc: buildTaskContext, new: 'tasks.utils.buildContext()' },
        { old: 'extractTaskDataFromDOM', newFunc: extractTaskDataFromDOM, new: 'tasks.utils.extractData()' },
        { old: 'loadTaskContext', newFunc: loadTaskContext, new: 'tasks.utils.loadContext()' },
        { old: 'scrollToNewTask', newFunc: scrollToNewTask, new: 'tasks.utils.scrollToNew()' },
        { old: 'handleOverdueStyling', newFunc: handleOverdueStyling, new: 'tasks.utils.handleOverdue()' },
        { old: 'setupFinalTaskInteractions', newFunc: setupFinalTaskInteractions, new: 'tasks.utils.setupInteractions()' }
    ];

    // Phase 2 Step 10: TaskEvents backward-compat shims
    const step10Shims = [
        { old: 'TaskEvents', newFunc: TaskEvents, new: 'tasks.events (class)' },
        { old: 'initTaskEvents', newFunc: initTaskEvents, new: 'tasks.events.init()' },
        { old: 'handleTaskButtonClick', newFunc: handleTaskButtonClick, new: 'tasks.events.handleButtonClick()' },
        { old: 'toggleHoverTaskOptions', newFunc: toggleHoverTaskOptions, new: 'tasks.events.toggleHover()' },
        { old: 'revealTaskButtons', newFunc: revealTaskButtons, new: 'tasks.events.revealButtons()' },
        { old: 'syncRecurringStateToDOM', newFunc: syncRecurringStateToDOM, new: 'tasks.events.syncRecurring()' },
        { old: 'setupTaskInteractions', newFunc: setupTaskInteractions, new: 'tasks.events.setupInteractions()' },
        { old: 'setupTaskClickInteraction', newFunc: setupTaskClickInteraction, new: 'tasks.events.setupClick()' }
    ];

    // Phase 2 Step 11: CycleSwitcher backward-compat shims
    const step11Shims = [
        { old: 'CycleSwitcher', newFunc: CycleSwitcher, new: 'cycles.switcher (class)' },
        { old: 'initializeCycleSwitcher', newFunc: initializeCycleSwitcher, new: 'cycles.switcher.init()' },
        { old: 'switchMiniCycle', newFunc: switchMiniCycle, new: 'cycles.switch()' },
        { old: 'renameMiniCycle', newFunc: renameMiniCycle, new: 'cycles.rename()' },
        { old: 'deleteMiniCycle', newFunc: deleteMiniCycle, new: 'cycles.delete()' },
        { old: 'hideSwitchMiniCycleModal', newFunc: hideSwitchMiniCycleModal, new: 'cycles.switcher.hideModal()' },
        { old: 'confirmMiniCycle', newFunc: confirmMiniCycle, new: 'cycles.switcher.confirm()' },
        { old: 'updatePreview', newFunc: updatePreview, new: 'cycles.switcher.updatePreview()' },
        { old: 'loadMiniCycleList', newFunc: loadMiniCycleList, new: 'cycles.switcher.loadList()' },
        { old: 'setupModalClickOutside', newFunc: setupModalClickOutside, new: 'cycles.switcher.setupClickOutside()' }
    ];

    // Phase 2 Step 12: Testing Modal backward-compat shims
    const step12Shims = [
        { old: 'setupTestingModal', newFunc: setupTestingModal, new: 'testing.setupModal()' },
        { old: 'initializeTestingModalEnhancements', newFunc: initializeTestingModalEnhancements, new: 'testing.initEnhancements()' },
        { old: 'openStorageViewer', newFunc: openStorageViewer, new: 'testing.openStorage()' },
        { old: 'closeStorageViewer', newFunc: closeStorageViewer, new: 'testing.closeStorage()' },
        { old: 'appendToTestResults', newFunc: appendToTestResults, new: 'testing.appendResults()' },
        { old: 'clearTestResults', newFunc: clearTestResults, new: 'testing.clearResults()' },
        { old: 'exportTestResults', newFunc: exportTestResults, new: 'testing.exportResults()' },
        { old: 'copyTestResults', newFunc: copyTestResults, new: 'testing.copyResults()' },
        { old: 'showNotification', newFunc: safeShowNotification, new: 'ui.notify()' },
        { old: 'showConfirmationModal', newFunc: safeShowConfirmationModal, new: 'ui.confirm()' },
        { old: 'showPromptModal', newFunc: safeShowPromptModal, new: 'ui.prompt()' }
    ];

    // Phase 2 Step 13: TaskDOM backward-compat shims (FINAL STEP!)
    const step13Shims = [
        // Core
        { old: 'TaskDOMManager', newFunc: TaskDOMManager, new: 'tasks.dom (class)' },
        { old: 'initTaskDOMManager', newFunc: initTaskDOMManager, new: 'tasks.dom.init()' },
        // Validation (re-exported from taskValidation, but shimmed here for completeness)
        { old: 'validateAndSanitizeTaskInput', newFunc: validateAndSanitizeTaskInput, new: 'tasks.validation.validate()' },
        // Utilities (re-exported from taskUtils, but shimmed here for completeness)
        { old: 'buildTaskContext', newFunc: buildTaskContext, new: 'tasks.utils.buildContext()' },
        { old: 'extractTaskDataFromDOM', newFunc: extractTaskDataFromDOM, new: 'tasks.utils.extractData()' },
        { old: 'loadTaskContext', newFunc: loadTaskContext, new: 'tasks.utils.loadContext()' },
        { old: 'scrollToNewTask', newFunc: scrollToNewTask, new: 'tasks.utils.scrollToNew()' },
        { old: 'handleOverdueStyling', newFunc: handleOverdueStyling, new: 'tasks.utils.handleOverdue()' },
        { old: 'setupFinalTaskInteractions', newFunc: setupFinalTaskInteractions, new: 'tasks.utils.setupInteractions()' },
        // DOM Creation (unique to taskDOM)
        { old: 'createTaskDOMElements', newFunc: createTaskDOMElements, new: 'tasks.dom.createElements()' },
        { old: 'createMainTaskElement', newFunc: createMainTaskElement, new: 'tasks.dom.createMain()' },
        { old: 'createThreeDotsButton', newFunc: createThreeDotsButton, new: 'tasks.dom.createThreeDots()' },
        { old: 'createTaskButtonContainer', newFunc: createTaskButtonContainer, new: 'tasks.dom.createButtonContainer()' },
        { old: 'createTaskButton', newFunc: createTaskButton, new: 'tasks.dom.createButton()' },
        { old: 'createTaskContentElements', newFunc: createTaskContentElements, new: 'tasks.dom.createContent()' },
        { old: 'createTaskCheckbox', newFunc: createTaskCheckbox, new: 'tasks.dom.createCheckbox()' },
        { old: 'createTaskLabel', newFunc: createTaskLabel, new: 'tasks.dom.createLabel()' },
        // Button Setup (unique to taskDOM + some re-exports from taskEvents)
        { old: 'setupRecurringButtonHandler', newFunc: setupRecurringButtonHandler, new: 'tasks.dom.setupRecurring()' },
        { old: 'handleTaskButtonClick', newFunc: handleTaskButtonClick, new: 'tasks.events.handleButtonClick()' },
        { old: 'toggleHoverTaskOptions', newFunc: toggleHoverTaskOptions, new: 'tasks.events.toggleHover()' },
        { old: 'revealTaskButtons', newFunc: revealTaskButtons, new: 'tasks.events.revealButtons()' },
        { old: 'syncRecurringStateToDOM', newFunc: syncRecurringStateToDOM, new: 'tasks.events.syncRecurring()' },
        // Task Interactions (mix of unique + re-exports from taskEvents)
        { old: 'setupTaskInteractions', newFunc: setupTaskInteractions, new: 'tasks.events.setupInteractions()' },
        { old: 'setupTaskClickInteraction', newFunc: setupTaskClickInteraction, new: 'tasks.events.setupClick()' },
        { old: 'setupTaskHoverInteractions', newFunc: setupTaskHoverInteractions, new: 'tasks.dom.setupHover()' },
        { old: 'setupTaskFocusInteractions', newFunc: setupTaskFocusInteractions, new: 'tasks.dom.setupFocus()' },
        { old: 'finalizeTaskCreation', newFunc: finalizeTaskCreation, new: 'tasks.dom.finalize()' },
        { old: 'updateUIAfterTaskCreation', newFunc: updateUIAfterTaskCreation, new: 'tasks.dom.updateUI()' },
        // Rendering (re-exported from taskRenderer, but shimmed here for completeness)
        { old: 'renderTasks', newFunc: renderTasks, new: 'tasks.render()' },
        { old: 'refreshUIFromState', newFunc: refreshUIFromState, new: 'tasks.refreshUI()' },
        { old: 'refreshTaskListUI', newFunc: refreshTaskListUI, new: 'tasks.refreshList()' }
    ];

    // Phase 3 Step 1: TaskCore backward-compat shims
    const phase3Step1Shims = [
        // Core class and instance
        { old: 'TaskCore', newFunc: TaskCore, new: 'tasks.core (class)' },
        { old: 'taskCore', newFunc: taskCoreInstance, new: 'tasks.core (instance)' },
        // CRUD operations
        { old: 'addTask', newFunc: addTask, new: 'tasks.add()' },
        { old: 'editTaskFromCore', newFunc: editTaskFromCore, new: 'tasks.edit()' },
        { old: 'deleteTaskFromCore', newFunc: deleteTaskFromCore, new: 'tasks.delete()' },
        // State management
        { old: 'toggleTaskPriorityFromCore', newFunc: toggleTaskPriorityFromCore, new: 'tasks.togglePriority()' },
        { old: 'handleTaskCompletionChange', newFunc: handleTaskCompletionChange, new: 'tasks.toggleCompletion()' },
        { old: 'saveCurrentTaskOrder', newFunc: saveCurrentTaskOrder, new: 'tasks.saveOrder()' },
        { old: 'resetTasks', newFunc: resetTasks, new: 'tasks.reset()' },
        { old: 'handleCompleteAllTasks', newFunc: handleCompleteAllTasks, new: 'tasks.completeAll()' },
        // Data persistence
        { old: 'saveTaskToSchema25', newFunc: saveTaskToSchema25, new: 'tasks.saveToSchema()' }
    ];

    // Phase 3 Step 2: UndoRedoManager backward-compat shims
    const phase3Step2Shims = [
        // Core operations
        { old: 'performStateBasedUndo', newFunc: performStateBasedUndo, new: 'history.undo()' },
        { old: 'performStateBasedRedo', newFunc: performStateBasedRedo, new: 'history.redo()' },
        { old: 'captureStateSnapshot', newFunc: captureStateSnapshot, new: 'history.capture()' },
        // Initialization
        { old: 'wireUndoRedoUI', newFunc: wireUndoRedoUI, new: 'history.init() (internal)' },
        { old: 'initializeUndoRedoButtons', newFunc: initializeUndoRedoButtons, new: 'history.init() (internal)' },
        { old: 'captureInitialSnapshot', newFunc: captureInitialSnapshot, new: 'history.init() (internal)' },
        { old: 'setupStateBasedUndoRedo', newFunc: setupStateBasedUndoRedo, new: 'history.setup()' },
        { old: 'enableUndoSystemOnFirstInteraction', newFunc: enableUndoSystemOnFirstInteraction, new: 'history.enable()' },
        // UI updates
        { old: 'updateUndoRedoButtons', newFunc: updateUndoRedoButtons, new: 'history.updateButtons()' },
        { old: 'updateUndoRedoButtonStates', newFunc: updateUndoRedoButtonStates, new: 'history.updateButtonStates()' },
        { old: 'updateUndoRedoButtonVisibility', newFunc: updateUndoRedoButtonVisibility, new: 'history.updateButtonVisibility()' },
        // Lifecycle hooks
        { old: 'onCycleSwitched', newFunc: onCycleSwitched, new: 'history.onCycleSwitched()' },
        { old: 'onCycleCreated', newFunc: onCycleCreated, new: 'history.onCycleCreated()' },
        { old: 'onCycleDeleted', newFunc: onCycleDeleted, new: 'history.onCycleDeleted()' },
        { old: 'onCycleRenamed', newFunc: onCycleRenamed, new: 'history.onCycleRenamed()' },
        // Utilities (less commonly used publicly, but exposed for completeness)
        { old: 'buildSnapshotSignature', newFunc: buildSnapshotSignature, new: 'history (internal)' },
        { old: 'snapshotsEqual', newFunc: snapshotsEqual, new: 'history (internal)' }
    ];

    // Phase 3 Step 3: CycleLoader backward-compat shims
    const phase3Step3Shims = [
        // Main functions
        { old: 'loadMiniCycle', newFunc: loadMiniCycle, new: 'cycles.load()' },
        { old: 'setCycleLoaderDependencies', newFunc: setCycleLoaderDependencies, new: 'cycles (internal)' }
    ];

    // Phase 3 Step 4: Recurring modules backward-compat shims
    // IMPORTANT: These must use lazy evaluation through window.recurringCore.*
    // because dependencies are injected at runtime by recurringIntegration
    const phase3Step4Shims = [
        // Core functions - delegate to window.recurringCore (set by recurringIntegration after DI)
        { old: 'applyRecurringToTaskSchema25', newFunc: (...args) => window.recurringCore?.applyRecurringSettings?.(...args), new: 'features.recurring.apply()' },
        { old: 'handleRecurringTaskActivation', newFunc: (...args) => window.recurringCore?.handleActivation?.(...args), new: 'features.recurring.activate()' },
        { old: 'handleRecurringTaskDeactivation', newFunc: (...args) => window.recurringCore?.handleDeactivation?.(...args), new: 'features.recurring.deactivate()' },
        { old: 'deleteRecurringTemplate', newFunc: (...args) => window.recurringCore?.deleteTemplate?.(...args), new: 'features.recurring.delete()' },
        { old: 'removeRecurringTasksFromCycle', newFunc: (...args) => window.recurringCore?.removeTasksFromCycle?.(...args), new: 'features.recurring.remove()' },
        { old: 'handleRecurringTasksAfterReset', newFunc: (...args) => window.recurringCore?.handleAfterReset?.(...args), new: 'features.recurring.afterReset()' },
        { old: 'watchRecurringTasks', newFunc: (...args) => window.recurringCore?.watchTasks?.(...args), new: 'features.recurring.watch()' },
        { old: 'catchUpMissedRecurringTasks', newFunc: (...args) => window.recurringCore?.catchUpMissedTasks?.(...args), new: 'features.recurring.catchUp()' },
        { old: 'setupRecurringWatcher', newFunc: (...args) => setupRecurringWatcher?.(...args), new: 'features.recurring.setupWatcher()' },
        // Panel functions - delegate to window.recurringPanel (set by recurringIntegration)
        { old: 'updateRecurringPanel', newFunc: (...args) => window.recurringPanel?.updatePanel?.(...args), new: 'features.recurring.panel.update()' },
        { old: 'updateRecurringSummary', newFunc: (...args) => window.recurringPanel?.updateSummary?.(...args), new: 'features.recurring.panel.updateSummary()' },
        { old: 'updateRecurringPanelButtonVisibility', newFunc: (...args) => window.recurringPanel?.updateButtonVisibility?.(...args), new: 'features.recurring.panel.updateButtonVisibility()' },
        { old: 'openRecurringSettingsPanelForTask', newFunc: (...args) => window.recurringPanel?.openForTask?.(...args), new: 'features.recurring.panel.openForTask()' },
        { old: 'buildRecurringSummaryFromSettings', newFunc: buildRecurringSummaryFromSettings, new: 'features.recurring.buildSummary()' }
    ];

    // Phase 3 Step 5: UI managers backward-compat shims
    const phase3Step5Shims = [
        // MenuManager
        { old: 'MenuManager', newFunc: MenuManager, new: 'ui.menu (class)' },
        { old: 'setupMainMenu', new: 'ui.menu.setup()' },
        { old: 'closeMainMenu', new: 'ui.menu.close()' },
        { old: 'updateMainMenuHeader', new: 'ui.menu.updateHeader()' },
        { old: 'hideMainMenu', new: 'ui.menu.hide()' },
        { old: 'closeMenuOnClickOutside', new: 'ui.menu.closeOnClickOutside()' },
        { old: 'saveMiniCycleAsNew', new: 'ui.menu.saveAsNew()' },
        { old: 'clearAllTasks', new: 'ui.menu.clearAll()' },
        { old: 'deleteAllTasks', new: 'ui.menu.deleteAll()' },
        // SettingsManager
        { old: 'SettingsManager', newFunc: SettingsManager, new: 'ui.settings (class)' },
        { old: 'setupSettingsMenu', new: 'ui.settings.setup()' },
        { old: 'setupDownloadMiniCycle', new: 'ui.settings.setupDownload()' },
        { old: 'exportMiniCycleData', new: 'ui.settings.export()' },
        { old: 'setupUploadMiniCycle', new: 'ui.settings.setupUpload()' },
        { old: 'syncCurrentSettingsToStorage', new: 'ui.settings.sync()' },
        // TaskOptionsCustomizer
        { old: 'TaskOptionsCustomizer', newFunc: TaskOptionsCustomizer, new: 'ui.taskOptions (class)' },
        { old: 'taskOptionsCustomizer', newFunc: taskOptionsCustomizer, new: 'ui.taskOptions.getInstance()' }
    ];

    // ============================================
    // Phase 4: Final cleanup modules
    // ============================================

    // Phase 4 Step 1: deviceDetection.js (6 exports)
    const phase4Step1Shims = [
        { old: 'DeviceDetectionManager', newFunc: DeviceDetectionManager, new: 'utils.device (class)' },
        { old: 'deviceDetectionManager', newFunc: deviceDetectionManager, new: 'utils.device.getManager()' },
        { old: 'runDeviceDetection', newFunc: runDeviceDetection, new: 'utils.device.run()' },
        { old: 'autoRedetectOnVersionChange', newFunc: autoRedetectOnVersionChange, new: 'utils.device.autoRedetect()' },
        { old: 'reportDeviceCompatibility', newFunc: reportDeviceCompatibility, new: 'utils.device.report()' },
        { old: 'testDeviceDetection', newFunc: testDeviceDetection, new: 'utils.device.test()' }
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

    // Phase 2 & 3: Install backward-compat shims for migrated modules
    // These functions no longer exist on window.*, so we create them
    const allShims = [
        // Phase 2 shims
        ...globalUtilsShims,
        ...themeManagerShims,
        ...notificationsShims,
        ...modalManagerShims,
        ...onboardingShims,
        ...gamesShims,
        ...consoleCaptureShims,
        ...step5Shims,
        ...step6Shims,
        ...step7Shims,
        ...step8Shims,
        ...step9Shims,
        ...step10Shims,
        ...step11Shims,
        ...step12Shims,
        ...step13Shims,
        // Phase 3 shims
        ...phase3Step1Shims,
        ...phase3Step2Shims,
        ...phase3Step3Shims,
        ...phase3Step4Shims,
        ...phase3Step5Shims,
        // Phase 4 shims
        ...phase4Step1Shims
    ];

    allShims.forEach(({ old, new: newPath, newFunc }) => {
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

    const step3Count = notificationsShims.length + modalManagerShims.length;
    const step4Count = onboardingShims.length + gamesShims.length + consoleCaptureShims.length;
    const phase2Total = globalUtilsShims.length + themeManagerShims.length + step3Count + step4Count + step5Shims.length + step6Shims.length + step7Shims.length + step8Shims.length + step9Shims.length + step10Shims.length + step11Shims.length + step12Shims.length + step13Shims.length;
    const phase3Total = phase3Step1Shims.length + phase3Step2Shims.length + phase3Step3Shims.length + phase3Step4Shims.length + phase3Step5Shims.length;
    const phase4Total = phase4Step1Shims.length;
    console.log(`⚠️  Deprecation warnings installed: Phase 2 (${phase2Total} shims), Phase 3 (${phase3Total} shims), Phase 4 (${phase4Total} shims) - Total: ${allShims.length} shims`);
}
