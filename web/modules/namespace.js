/**
 * ==========================================
 * 🌐 NAMESPACE MODULE (Pure Orchestrator Pattern)
 * ==========================================
 *
 * Consolidates 163 global variables into a single unified API:
 * window.miniCycle.*
 *
 * ARCHITECTURE: Zero Static Imports
 * ---------------------------------
 * This module has NO static imports of app modules. All dependencies
 * are injected from miniCycle-scripts.js which loads modules with
 * ?v=APP_VERSION cache-busting. This prevents duplicate module instances.
 *
 * Flow:
 * 1. miniCycle-scripts.js loads all modules with withV()
 * 2. miniCycle-scripts.js calls injectNamespaceDeps() with module refs
 * 3. miniCycle-scripts.js calls initializeNamespace() to create API
 * 4. miniCycle-scripts.js calls installDeprecationWarnings() for shims
 *
 * @version 1.383
 * @see docs/future-work/NAMESPACE_ARCHITECTURE.md
 */

// ============================================
// MODULE REGISTRY - All deps injected at runtime
// ============================================
const modules = {
    // Utils
    GlobalUtils: null,
    DEFAULT_TASK_OPTION_BUTTONS: null,
    DataValidator: null,
    errorHandler: null,
    consoleCapture: null,
    showAllCapturedLogs: null,
    clearAllConsoleLogs: null,
    showMigrationErrorsOnly: null,
    getConsoleCaptureStats: null,
    stopConsoleCapture: null,

    // Storage
    backupManager: null,

    // Core
    appInit: null,
    createStateManager: null,
    resetStateManager: null,
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: null,
    DEFAULT_RECURRING_DELETE_SETTINGS: null,

    // Features
    ThemeManager: null,
    themeManager: null,
    applyTheme: null,
    updateThemeColor: null,
    setupDarkModeToggle: null,
    setupQuickDarkToggle: null,
    unlockDarkOceanTheme: null,
    unlockGoldenGlowTheme: null,
    initializeThemesPanel: null,
    refreshThemeToggles: null,
    setupThemesPanel: null,
    setupThemesPanelWithData: null,
    MiniCycleDueDates: null,
    MiniCycleReminders: null,
    StatsPanelManager: null,

    // UI - Notifications & Modals
    MiniCycleNotifications: null,
    EducationalTipManager: null,
    ModalManager: null,
    modalManager: null,
    OnboardingManager: null,
    onboardingManager: null,
    GamesManager: null,
    gamesManager: null,

    // UI - Menu & Settings
    MenuManager: null,
    initMenuManager: null,
    SettingsManager: null,
    initSettingsManager: null,
    TaskOptionsCustomizer: null,
    initTaskOptionsCustomizer: null,
    taskOptionsCustomizer: null,

    // Cycle
    CycleManager: null,
    initializeCycleManager: null,
    getCycleManager: null,
    ModeManager: null,
    initModeManager: null,
    CycleSwitcher: null,
    initializeCycleSwitcher: null,
    switchMiniCycle: null,
    renameMiniCycle: null,
    deleteMiniCycle: null,
    hideSwitchMiniCycleModal: null,
    confirmMiniCycle: null,
    updatePreview: null,
    loadMiniCycleList: null,
    setupModalClickOutside: null,
    loadMiniCycle: null,
    repairAndCleanTasks: null,
    renderTasksToDOM: null,
    updateCycleUIState: null,
    applyThemeSettings: null,
    setupRemindersForCycle: null,
    updateDependentComponents: null,
    saveCycleData: null,
    setCycleLoaderDependencies: null,

    // Migration
    initializeAppWithAutoMigration: null,
    performSchema25Migration: null,
    checkMigrationNeeded: null,
    simulateMigrationToSchema25: null,
    validateAllMiniCycleTasksLenient: null,
    forceAppMigration: null,

    // Task - Core
    TaskCore: null,
    initTaskCore: null,
    taskCoreInstance: null,
    addTask: null,
    editTaskFromCore: null,
    deleteTaskFromCore: null,
    toggleTaskPriorityFromCore: null,
    handleTaskCompletionChange: null,
    saveCurrentTaskOrder: null,
    saveTaskToSchema25: null,
    resetTasks: null,
    handleCompleteAllTasks: null,

    // Task - Validation
    TaskValidator: null,
    initTaskValidator: null,
    validateAndSanitizeTaskInput: null,

    // Task - Renderer
    TaskRenderer: null,
    initTaskRenderer: null,
    renderTasks: null,
    refreshUIFromState: null,
    refreshTaskListUI: null,

    // Task - DOM
    TaskDOMManager: null,
    initTaskDOMManager: null,
    createTaskDOMElements: null,
    createMainTaskElement: null,
    createThreeDotsButton: null,
    createTaskButtonContainer: null,
    createTaskButton: null,
    createTaskContentElements: null,
    createTaskCheckbox: null,
    createTaskLabel: null,
    setupRecurringButtonHandler: null,
    setupTaskHoverInteractions: null,
    setupTaskFocusInteractions: null,
    finalizeTaskCreation: null,
    updateUIAfterTaskCreation: null,

    // Task - Events
    TaskEvents: null,
    initTaskEvents: null,
    handleTaskButtonClick: null,
    toggleHoverTaskOptions: null,
    revealTaskButtons: null,
    syncRecurringStateToDOM: null,
    setupTaskInteractions: null,
    setupTaskClickInteraction: null,

    // Task - Utils
    TaskUtils: null,
    buildTaskContext: null,
    extractTaskDataFromDOM: null,
    loadTaskContext: null,
    scrollToNewTask: null,
    handleOverdueStyling: null,
    setupFinalTaskInteractions: null,

    // Task - Drag & Drop
    initDragDropManager: null,
    enableDragAndDropOnTask: null,
    updateMoveArrowsVisibility: null,
    toggleArrowVisibility: null,
    updateArrowsInDOM: null,

    // Undo/Redo
    setUndoRedoManagerDependencies: null,
    wireUndoRedoUI: null,
    initializeUndoRedoButtons: null,
    captureInitialSnapshot: null,
    setupStateBasedUndoRedo: null,
    enableUndoSystemOnFirstInteraction: null,
    captureStateSnapshot: null,
    buildSnapshotSignature: null,
    snapshotsEqual: null,
    performStateBasedUndo: null,
    performStateBasedRedo: null,
    updateUndoRedoButtonStates: null,
    updateUndoRedoButtonVisibility: null,
    updateUndoRedoButtons: null,
    onCycleSwitched: null,
    onCycleCreated: null,
    onCycleDeleted: null,
    onCycleRenamed: null,
    initializeUndoSystemForApp: null,
    initializeUndoIndexedDB: null,
    saveUndoStackToIndexedDB: null,
    loadUndoStackFromIndexedDB: null,
    deleteUndoStackFromIndexedDB: null,
    renameUndoStackInIndexedDB: null,
    clearAllUndoHistoryFromIndexedDB: null,

    // Recurring
    setRecurringCoreDependencies: null,
    applyRecurringToTaskSchema25: null,
    handleRecurringTaskActivation: null,
    handleRecurringTaskDeactivation: null,
    deleteRecurringTemplate: null,
    removeRecurringTasksFromCycle: null,
    handleRecurringTasksAfterReset: null,
    watchRecurringTasks: null,
    catchUpMissedRecurringTasks: null,
    setupRecurringWatcher: null,
    RecurringPanelManager: null,
    buildRecurringSummaryFromSettings: null,

    // Device Detection
    DeviceDetectionManager: null,
    deviceDetectionManager: null,
    initializeDeviceDetectionManager: null,
    runDeviceDetection: null,
    autoRedetectOnVersionChange: null,
    reportDeviceCompatibility: null,
    testDeviceDetection: null,

    // Plugins
    PluginManager: null,
    MiniCyclePlugin: null,
    pluginManager: null,
    TimeTrackerPlugin: null,

    // Testing
    setupAutomatedTestingFunctions: null,
    runIndividualModuleTest: null,
    runAllAutomatedTests: null,
    loadTestModules: null,
    setupTestingModal: null,
    initializeTestingModalEnhancements: null,
    openStorageViewer: null,
    closeStorageViewer: null,
    appendToTestResults: null,
    clearTestResults: null,
    exportTestResults: null,
    copyTestResults: null,
    safeShowNotification: null,
    safeShowConfirmationModal: null,
    safeShowPromptModal: null
};

/**
 * Inject all module dependencies into namespace.
 * Called by miniCycle-scripts.js after loading modules with withV().
 *
 * @param {Object} deps - Object containing all module references
 */
export function injectNamespaceDeps(deps) {
    // Merge all provided deps into modules registry
    Object.keys(deps).forEach(key => {
        if (deps[key] !== undefined) {
            modules[key] = deps[key];
        }
    });
    console.log(`✅ Namespace dependencies injected (${Object.keys(deps).length} modules)`);
}

/**
 * Initialize the miniCycle namespace
 * Creates window.miniCycle.* API using injected module references
 */
export function initializeNamespace() {
    // Create the root namespace object
    window.miniCycle = {
        // Internal metadata
        _version: '1.383',
        _deprecationWarnings: new Set(),

        // ===================================
        // TASKS API
        // ===================================
        tasks: {
            // Core CRUD operations
            add: (...args) => modules.addTask?.(...args),
            edit: (taskItem) => modules.editTaskFromCore?.(taskItem),
            delete: (taskItem) => modules.deleteTaskFromCore?.(taskItem),
            validate: (...args) => modules.validateAndSanitizeTaskInput?.(...args),

            // Task state management
            toggleCompletion: (checkbox) => modules.handleTaskCompletionChange?.(checkbox),
            togglePriority: (taskItem) => modules.toggleTaskPriorityFromCore?.(taskItem),
            saveOrder: () => modules.saveCurrentTaskOrder?.(),
            reset: () => modules.resetTasks?.(),
            completeAll: () => modules.handleCompleteAllTasks?.(),

            // Data persistence
            saveToSchema: (cycleId, cycleData) => modules.saveTaskToSchema25?.(cycleId, cycleData),

            // Rendering & UI
            render: (...args) => modules.renderTasks?.(...args) ?? window.renderTasks?.(...args),
            refresh: (...args) => modules.refreshTaskListUI?.(...args) ?? window.refreshTaskListUI?.(...args),
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
        // CYCLES API
        // ===================================
        cycles: {
            // Core operations
            create: (...args) => window.createNewMiniCycle?.(...args),
            switch: (...args) => modules.switchMiniCycle?.(...args) ?? window.switchMiniCycle?.(...args),
            delete: (...args) => modules.deleteMiniCycle?.(...args) ?? window.deleteMiniCycle?.(...args),
            reset: (...args) => window.resetCurrentMiniCycle?.(...args),
            rename: (...args) => modules.renameMiniCycle?.(...args) ?? window.renameMiniCycle?.(...args),
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

            // Cycle loading & management
            load: (...args) => modules.loadMiniCycle?.(...args),
            save: (...args) => modules.saveCycleData?.(...args),
            repair: () => modules.repairAndCleanTasks?.(),
            renderTasks: () => modules.renderTasksToDOM?.(),
            updateUI: () => modules.updateCycleUIState?.(),
            applyTheme: () => modules.applyThemeSettings?.(),
            setupReminders: () => modules.setupRemindersForCycle?.(),
            updateComponents: () => modules.updateDependentComponents?.()
        },

        // ===================================
        // UI API
        // ===================================
        ui: {
            // Notifications
            notifications: {
                show: (...args) => modules.safeShowNotification?.(...args) ?? window.showNotification?.(...args),
                showWithTip: (...args) => window.showNotificationWithTip?.(...args),
                hide: (...args) => window.hideNotification?.(...args),
                clearAll: (...args) => window.clearAllNotifications?.(...args),
                queue: (...args) => window.queueNotification?.(...args)
            },

            // Modals
            modals: {
                confirm: (...args) => modules.safeShowConfirmationModal?.(...args) ?? window.showConfirmModal?.(...args),
                prompt: (...args) => modules.safeShowPromptModal?.(...args) ?? window.showPromptModal?.(...args),
                show: (...args) => window.showModal?.(...args),
                hide: (...args) => window.hideModal?.(...args),
                closeAll: (...args) => modules.modalManager?.closeAllModals?.(...args) ?? window.closeAllModals?.(...args),
                alert: (...args) => window.showAlertModal?.(...args),
                custom: (...args) => window.showCustomModal?.(...args),
                isOpen: (...args) => window.isModalOpen?.(...args)
            },

            // Loaders & Progress
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

            // Menu
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

            // Settings
            settings: {
                setup: () => window.setupSettingsMenu?.(),
                setupDownload: () => window.setupDownloadMiniCycle?.(),
                export: (data, name) => window.exportMiniCycleData?.(data, name),
                setupUpload: () => window.setupUploadMiniCycle?.(),
                sync: () => window.syncCurrentSettingsToStorage?.()
            },

            // Task Options Customizer
            taskOptions: {
                getInstance: () => modules.taskOptionsCustomizer ?? window.taskOptionsCustomizer
            }
        },

        // ===================================
        // UTILS API
        // ===================================
        utils: {
            // DOM utilities
            dom: {
                addListener: (...args) => modules.GlobalUtils?.safeAddEventListener?.(...args),
                removeListener: (...args) => modules.GlobalUtils?.safeRemoveEventListener?.(...args),
                query: (...args) => modules.GlobalUtils?.safeQuerySelector?.(...args),
                queryAll: (...args) => modules.GlobalUtils?.safeQuerySelectorAll?.(...args),
                getElementById: (...args) => modules.GlobalUtils?.safeGetElementById?.(...args),
                setInnerHTML: (...args) => modules.GlobalUtils?.safeSetInnerHTML?.(...args),
                setTextContent: (...args) => modules.GlobalUtils?.safeSetTextContent?.(...args),
                toggleClass: (...args) => modules.GlobalUtils?.safeToggleClass?.(...args),
                addClass: (...args) => modules.GlobalUtils?.safeAddClass?.(...args),
                removeClass: (...args) => modules.GlobalUtils?.safeRemoveClass?.(...args)
            },

            // Storage utilities
            storage: {
                get: (...args) => modules.GlobalUtils?.safeLocalStorageGet?.(...args),
                set: (...args) => modules.GlobalUtils?.safeLocalStorageSet?.(...args),
                remove: (...args) => modules.GlobalUtils?.safeLocalStorageRemove?.(...args)
            },

            // JSON utilities
            json: {
                parse: (...args) => modules.GlobalUtils?.safeJSONParse?.(...args),
                stringify: (...args) => modules.GlobalUtils?.safeJSONStringify?.(...args)
            },

            // String utilities
            sanitize: (...args) => modules.GlobalUtils?.sanitizeInput?.(...args),
            escape: (...args) => modules.GlobalUtils?.escapeHtml?.(...args),

            // Function utilities
            debounce: (...args) => modules.GlobalUtils?.debounce?.(...args),
            throttle: (...args) => modules.GlobalUtils?.throttle?.(...args),

            // ID generation
            generateId: (...args) => modules.GlobalUtils?.generateId?.(...args),
            generateHashId: (...args) => modules.GlobalUtils?.generateHashId?.(...args),
            generateNotificationId: (...args) => modules.GlobalUtils?.generateNotificationId?.(...args),

            // Device detection
            device: {
                run: () => modules.runDeviceDetection?.(),
                autoRedetect: () => modules.autoRedetectOnVersionChange?.(),
                report: () => modules.reportDeviceCompatibility?.(),
                test: () => modules.testDeviceDetection?.(),
                getManager: () => modules.deviceDetectionManager ?? window.deviceDetectionManager
            },

            // Viewport
            isElementInViewport: (...args) => modules.GlobalUtils?.isElementInViewport?.(...args),

            // DeleteWhenComplete utilities
            validateDeleteSettings: (...args) => modules.GlobalUtils?.validateDeleteSettings?.(...args),
            syncTaskDeleteWhenCompleteDOM: (...args) => modules.GlobalUtils?.syncTaskDeleteWhenCompleteDOM?.(...args),
            syncAllTasksWithMode: (...args) => modules.GlobalUtils?.syncAllTasksWithMode?.(...args),

            // Constants
            DEFAULT_TASK_OPTION_BUTTONS: null // Set after injection
        },

        // ===================================
        // STATE API
        // ===================================
        state: {
            load: (...args) => window.loadMiniCycleData?.(...args),
            save: (...args) => modules.saveTaskToSchema25?.(...args),
            get: (...args) => window.getMiniCycleState?.(...args),
            create: (deps) => modules.createStateManager?.(deps),
            reset: () => modules.resetStateManager?.(),
            getManager: () => window.AppState
        },

        // ===================================
        // MIGRATION API
        // ===================================
        migration: {
            init: (opts) => modules.initializeAppWithAutoMigration?.(opts),
            migrate: () => modules.performSchema25Migration?.(),
            check: () => modules.checkMigrationNeeded?.(),
            simulate: (dryRun) => modules.simulateMigrationToSchema25?.(dryRun),
            validate: () => modules.validateAllMiniCycleTasksLenient?.(),
            force: () => modules.forceAppMigration?.()
        },

        // ===================================
        // HISTORY API (Undo/Redo)
        // ===================================
        history: {
            // Core undo/redo operations
            undo: (...args) => modules.performStateBasedUndo?.(...args),
            redo: (...args) => modules.performStateBasedRedo?.(...args),
            capture: (state) => {
                try {
                    return modules.captureStateSnapshot?.(state);
                } catch (e) {
                    return null;
                }
            },

            // Initialization
            init: (...args) => modules.initializeUndoSystemForApp?.(...args),
            setup: (...args) => modules.setupStateBasedUndoRedo?.(...args),
            enable: () => modules.enableUndoSystemOnFirstInteraction?.(),

            // UI updates
            updateButtons: () => modules.updateUndoRedoButtons?.(),
            updateButtonStates: () => modules.updateUndoRedoButtonStates?.(),
            updateButtonVisibility: () => modules.updateUndoRedoButtonVisibility?.(),

            // Lifecycle hooks
            onCycleSwitched: (cycleId) => modules.onCycleSwitched?.(cycleId),
            onCycleCreated: (cycleId) => modules.onCycleCreated?.(cycleId),
            onCycleDeleted: (cycleId) => modules.onCycleDeleted?.(cycleId),
            onCycleRenamed: (oldId, newId) => modules.onCycleRenamed?.(oldId, newId),

            // IndexedDB persistence
            db: {
                init: () => modules.initializeUndoIndexedDB?.(),
                save: (cycleId, undo, redo) => modules.saveUndoStackToIndexedDB?.(cycleId, undo, redo),
                load: (cycleId) => modules.loadUndoStackFromIndexedDB?.(cycleId),
                delete: (cycleId) => modules.deleteUndoStackFromIndexedDB?.(cycleId),
                rename: (oldId, newId) => modules.renameUndoStackInIndexedDB?.(oldId, newId),
                clearAll: () => modules.clearAllUndoHistoryFromIndexedDB?.()
            }
        },

        // ===================================
        // FEATURES API
        // ===================================
        features: {
            themes: {
                // Core theme operations
                apply: (...args) => modules.applyTheme?.(...args),
                updateColor: (...args) => modules.updateThemeColor?.(...args),

                // Dark mode setup
                setupDarkMode: (...args) => modules.setupDarkModeToggle?.(...args),
                setupQuickToggle: (...args) => modules.setupQuickDarkToggle?.(...args),

                // Theme unlocks
                unlockDarkOcean: (...args) => modules.unlockDarkOceanTheme?.(...args),
                unlockGoldenGlow: (...args) => modules.unlockGoldenGlowTheme?.(...args),

                // Panel setup
                initializePanel: (...args) => modules.initializeThemesPanel?.(...args),
                refreshToggles: (...args) => modules.refreshThemeToggles?.(...args),
                setupPanel: (...args) => modules.setupThemesPanel?.(...args),
                setupPanelWithData: (...args) => modules.setupThemesPanelWithData?.(...args),

                // Legacy API
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

            // Recurring tasks - use lazy evaluation through window.recurringCore.*
            recurring: {
                apply: (taskId, settings) => window.recurringCore?.applyRecurringSettings?.(taskId, settings),
                activate: (task, context, button) => window.recurringCore?.handleActivation?.(task, context, button),
                deactivate: (task, context, taskId) => window.recurringCore?.handleDeactivation?.(task, context, taskId),
                delete: (taskId) => window.recurringCore?.deleteTemplate?.(taskId),
                remove: (elements, data) => window.recurringCore?.removeTasksFromCycle?.(elements, data),
                afterReset: () => window.recurringCore?.handleAfterReset?.(),

                // Watcher/background tasks
                watch: () => window.recurringCore?.watchTasks?.(),
                catchUp: () => window.recurringCore?.catchUpMissedTasks?.(),
                setupWatcher: () => modules.setupRecurringWatcher?.(),

                // Panel UI
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
                buildSummary: (settings) => modules.buildRecurringSummaryFromSettings?.(settings)
            }
        }
    };

    // Set the constant after namespace is created
    window.miniCycle.utils.DEFAULT_TASK_OPTION_BUTTONS = modules.DEFAULT_TASK_OPTION_BUTTONS;

    console.log('✅ miniCycle namespace initialized (v1.378)');
    console.log('📖 API available at window.miniCycle.*');
}

/**
 * Install deprecation warnings on commonly used globals
 * Also installs backward-compat shims for migrated modules
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

    // ============================================
    // BACKWARD COMPATIBILITY SHIMS
    // These create window.* globals that delegate to modules
    // ============================================

    // GlobalUtils shims
    const globalUtilsShims = [
        'safeAddEventListener', 'safeAddEventListenerById', 'safeAddEventListenerBySelector',
        'safeRemoveEventListener', 'safeRemoveEventListenerById', 'safeGetElementById',
        'safeQuerySelector', 'safeQuerySelectorAll', 'safeSetInnerHTML', 'safeSetTextContent',
        'safeToggleClass', 'safeAddClass', 'safeRemoveClass', 'safeSetInnerHTMLWithEscape',
        'safeLocalStorageGet', 'safeLocalStorageSet', 'safeLocalStorageRemove',
        'safeJSONParse', 'safeJSONStringify', 'sanitizeInput', 'escapeHtml',
        'debounce', 'throttle', 'generateId', 'generateHashId', 'generateNotificationId',
        'isElementInViewport', 'validateDeleteSettings', 'syncTaskDeleteWhenCompleteDOM', 'syncAllTasksWithMode'
    ];

    globalUtilsShims.forEach(name => {
        if (!window[name] && modules.GlobalUtils?.[name]) {
            window[name] = (...args) => modules.GlobalUtils[name](...args);
        }
    });

    // Expose GlobalUtils class and DEFAULT_TASK_OPTION_BUTTONS
    window.GlobalUtils = modules.GlobalUtils;
    window.DEFAULT_TASK_OPTION_BUTTONS = modules.DEFAULT_TASK_OPTION_BUTTONS;

    // ThemeManager shims
    if (modules.ThemeManager) window.ThemeManager = modules.ThemeManager;
    if (modules.themeManager) window.themeManager = modules.themeManager;
    if (modules.applyTheme) window.applyTheme = (...args) => modules.applyTheme(...args);
    if (modules.updateThemeColor) window.updateThemeColor = (...args) => modules.updateThemeColor(...args);
    if (modules.setupDarkModeToggle) window.setupDarkModeToggle = (...args) => modules.setupDarkModeToggle(...args);
    if (modules.setupQuickDarkToggle) window.setupQuickDarkToggle = (...args) => modules.setupQuickDarkToggle(...args);
    if (modules.unlockDarkOceanTheme) window.unlockDarkOceanTheme = (...args) => modules.unlockDarkOceanTheme(...args);
    if (modules.unlockGoldenGlowTheme) window.unlockGoldenGlowTheme = (...args) => modules.unlockGoldenGlowTheme(...args);
    if (modules.initializeThemesPanel) window.initializeThemesPanel = (...args) => modules.initializeThemesPanel(...args);
    if (modules.refreshThemeToggles) window.refreshThemeToggles = (...args) => modules.refreshThemeToggles(...args);
    if (modules.setupThemesPanel) window.setupThemesPanel = (...args) => modules.setupThemesPanel(...args);
    if (modules.setupThemesPanelWithData) window.setupThemesPanelWithData = (...args) => modules.setupThemesPanelWithData(...args);

    // Notifications & Modals shims
    if (modules.MiniCycleNotifications) window.MiniCycleNotifications = modules.MiniCycleNotifications;
    if (modules.EducationalTipManager) window.EducationalTipManager = modules.EducationalTipManager;
    if (modules.ModalManager) window.ModalManager = modules.ModalManager;
    if (modules.modalManager) window.modalManager = modules.modalManager;
    if (modules.modalManager) window.closeAllModals = (...args) => modules.modalManager.closeAllModals?.(...args);

    // Onboarding & Games shims
    if (modules.OnboardingManager) window.OnboardingManager = modules.OnboardingManager;
    if (modules.onboardingManager) window.onboardingManager = modules.onboardingManager;
    if (modules.GamesManager) window.GamesManager = modules.GamesManager;
    if (modules.gamesManager) window.gamesManager = modules.gamesManager;

    // Console capture shims
    if (modules.showAllCapturedLogs) window.showAllCapturedLogs = modules.showAllCapturedLogs;
    if (modules.clearAllConsoleLogs) window.clearAllConsoleLogs = modules.clearAllConsoleLogs;
    if (modules.showMigrationErrorsOnly) window.showMigrationErrorsOnly = modules.showMigrationErrorsOnly;
    if (modules.getConsoleCaptureStats) window.getConsoleCaptureStats = modules.getConsoleCaptureStats;
    if (modules.stopConsoleCapture) window.stopConsoleCapture = modules.stopConsoleCapture;

    // Data utilities shims
    if (modules.DataValidator) window.DataValidator = modules.DataValidator;
    if (modules.errorHandler) window.ErrorHandler = modules.errorHandler;
    if (modules.backupManager) window.BackupManager = modules.backupManager;

    // Features shims
    if (modules.MiniCycleDueDates) window.MiniCycleDueDates = modules.MiniCycleDueDates;
    if (modules.MiniCycleReminders) window.MiniCycleReminders = modules.MiniCycleReminders;
    if (modules.StatsPanelManager) window.StatsPanelManager = modules.StatsPanelManager;

    // Core shims
    if (modules.appInit) window.appInit = modules.appInit;
    if (modules.ModeManager) window.ModeManager = modules.ModeManager;
    if (modules.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS) window.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = modules.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS;
    if (modules.DEFAULT_RECURRING_DELETE_SETTINGS) window.DEFAULT_RECURRING_DELETE_SETTINGS = modules.DEFAULT_RECURRING_DELETE_SETTINGS;

    // Task validation shims
    if (modules.TaskValidator) window.TaskValidator = modules.TaskValidator;
    if (modules.initTaskValidator) window.initTaskValidator = modules.initTaskValidator;
    if (modules.validateAndSanitizeTaskInput) window.validateAndSanitizeTaskInput = (...args) => modules.validateAndSanitizeTaskInput(...args);

    // Plugin shims
    if (modules.pluginManager) window.pluginManager = modules.pluginManager;
    if (modules.MiniCyclePlugin) window.MiniCyclePlugin = modules.MiniCyclePlugin;
    if (modules.TimeTrackerPlugin) window.TimeTrackerPlugin = modules.TimeTrackerPlugin;

    // Testing shims
    if (modules.setupAutomatedTestingFunctions) window.setupAutomatedTestingFunctions = modules.setupAutomatedTestingFunctions;
    if (modules.runIndividualModuleTest) window.runIndividualModuleTest = modules.runIndividualModuleTest;
    if (modules.runAllAutomatedTests) window.runAllAutomatedTests = modules.runAllAutomatedTests;
    if (modules.loadTestModules) window.loadTestModules = modules.loadTestModules;

    // Cycle manager shims
    if (modules.CycleManager) window.CycleManager = modules.CycleManager;
    if (modules.switchMiniCycle) window.switchMiniCycle = (...args) => modules.switchMiniCycle(...args);
    if (modules.renameMiniCycle) window.renameMiniCycle = (...args) => modules.renameMiniCycle(...args);
    if (modules.deleteMiniCycle) window.deleteMiniCycle = (...args) => modules.deleteMiniCycle(...args);

    // Task renderer shims
    if (modules.TaskRenderer) window.TaskRenderer = modules.TaskRenderer;
    if (modules.renderTasks) window.renderTasks = (...args) => modules.renderTasks(...args);
    if (modules.refreshUIFromState) window.refreshUIFromState = (...args) => modules.refreshUIFromState(...args);
    if (modules.refreshTaskListUI) window.refreshTaskListUI = (...args) => modules.refreshTaskListUI(...args);

    // Task core shims
    if (modules.TaskCore) window.TaskCore = modules.TaskCore;
    if (modules.addTask) window.addTask = (...args) => modules.addTask(...args);
    if (modules.editTaskFromCore) window.editTask = (...args) => modules.editTaskFromCore(...args);
    if (modules.deleteTaskFromCore) window.deleteTask = (...args) => modules.deleteTaskFromCore(...args);

    // Task DOM shims
    if (modules.TaskDOMManager) window.TaskDOMManager = modules.TaskDOMManager;
    if (modules.createTaskDOMElements) window.createTaskDOMElements = (...args) => modules.createTaskDOMElements(...args);

    // Drag/drop shims
    if (modules.initDragDropManager) window.initDragDropManager = modules.initDragDropManager;
    if (modules.updateMoveArrowsVisibility) window.updateMoveArrowsVisibility = (...args) => modules.updateMoveArrowsVisibility(...args);

    // Task events shims
    if (modules.TaskEvents) window.TaskEvents = modules.TaskEvents;
    if (modules.handleTaskButtonClick) window.handleTaskButtonClick = (...args) => modules.handleTaskButtonClick(...args);

    // Undo/redo shims
    if (modules.performStateBasedUndo) window.performStateBasedUndo = (...args) => modules.performStateBasedUndo(...args);
    if (modules.performStateBasedRedo) window.performStateBasedRedo = (...args) => modules.performStateBasedRedo(...args);
    if (modules.captureStateSnapshot) window.captureStateSnapshot = (...args) => modules.captureStateSnapshot(...args);

    // Cycle loader shims
    if (modules.loadMiniCycle) window.loadMiniCycle = (...args) => modules.loadMiniCycle(...args);

    // Recurring shims (use lazy evaluation through window.recurringCore and window.recurringPanel)
    window.applyRecurringToTaskSchema25 = (...args) => window.recurringCore?.applyRecurringSettings?.(...args);
    window.handleRecurringTaskActivation = (...args) => window.recurringCore?.handleActivation?.(...args);
    window.handleRecurringTaskDeactivation = (...args) => window.recurringCore?.handleDeactivation?.(...args);
    window.deleteRecurringTemplate = (...args) => window.recurringCore?.deleteTemplate?.(...args);
    window.removeRecurringTasksFromCycle = (...args) => window.recurringCore?.removeTasksFromCycle?.(...args);
    window.handleRecurringTasksAfterReset = (...args) => window.recurringCore?.handleAfterReset?.(...args);
    window.watchRecurringTasks = (...args) => window.recurringCore?.watchTasks?.(...args);
    window.catchUpMissedRecurringTasks = (...args) => window.recurringCore?.catchUpMissedTasks?.(...args);
    window.openRecurringSettingsPanelForTask = (...args) => window.recurringPanel?.openForTask?.(...args);
    window.updateRecurringPanel = (...args) => window.recurringPanel?.updatePanel?.(...args);
    window.updateRecurringSummary = (...args) => window.recurringPanel?.updateSummary?.(...args);
    window.updateRecurringButtonVisibility = (...args) => window.recurringPanel?.updateButtonVisibility?.(...args);
    window.updateRecurringPanelButtonVisibility = (...args) => window.recurringPanel?.updateButtonVisibility?.(...args);
    if (modules.setupRecurringWatcher) window.setupRecurringWatcher = (...args) => modules.setupRecurringWatcher(...args);
    if (modules.buildRecurringSummaryFromSettings) window.buildRecurringSummaryFromSettings = (...args) => modules.buildRecurringSummaryFromSettings(...args);

    // Device detection shims
    if (modules.DeviceDetectionManager) window.DeviceDetectionManager = modules.DeviceDetectionManager;
    if (modules.deviceDetectionManager) window.deviceDetectionManager = modules.deviceDetectionManager;
    if (modules.runDeviceDetection) window.runDeviceDetection = (...args) => modules.runDeviceDetection(...args);
    if (modules.autoRedetectOnVersionChange) window.autoRedetectOnVersionChange = (...args) => modules.autoRedetectOnVersionChange(...args);
    if (modules.reportDeviceCompatibility) window.reportDeviceCompatibility = (...args) => modules.reportDeviceCompatibility(...args);
    if (modules.testDeviceDetection) window.testDeviceDetection = (...args) => modules.testDeviceDetection(...args);

    // Testing modal shims
    if (modules.setupTestingModal) window.setupTestingModal = modules.setupTestingModal;
    if (modules.openStorageViewer) window.openStorageViewer = modules.openStorageViewer;
    if (modules.closeStorageViewer) window.closeStorageViewer = modules.closeStorageViewer;

    // Task options customizer shims
    if (modules.TaskOptionsCustomizer) window.TaskOptionsCustomizer = modules.TaskOptionsCustomizer;
    if (modules.taskOptionsCustomizer) window.taskOptionsCustomizer = modules.taskOptionsCustomizer;

    console.log(`⚠️  Deprecation warnings and backward-compat shims installed`);
}
