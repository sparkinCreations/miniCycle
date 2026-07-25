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
        optionalDeps: ['showNotification'],  // guarded, opportunistic — errorHandler must work before notifications exists
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
        optionalDeps: ['showNotification'],
        provides: ['consoleCapture'],
        api: 'utils',
        optional: true
    },

    labelResolver: {
        path: '../labels/labelResolver.js',
        phase: PHASES.CORE_UTILS,
        requires: [],
        // No optionalDeps — getActiveLens/getRoutineLens were removed (April 2026):
        // they're injection hooks set externally (not from depMappings) and the
        // unified vocabThemeManager handles lens resolution internally now.
        optionalDeps: [],
        provides: ['getLabel', 'getLabelOrFallback', 'hasLabel', 'isLensSensitive', 'getLabels', 'getCategoryLabels', 'getLensSensitiveKeys', 'getLabelDiagnostics'],
        api: 'labels',
        optional: false,
        singleton: true
    },

    notifications: {
        path: '../utils/notifications.js',
        phase: PHASES.CORE_UTILS,
        requires: ['appInit', 'GlobalUtils'],
        optionalDeps: ['applyRecurringToTaskSchema25', 'openRecurringSettingsPanelForTask', 'updateRecurringPanel', 'vocabThemeManager'],
        provides: ['showNotification', 'showConfirmationModal', 'showPromptModal'],
        api: 'utils'
    },

    iconInit: {
        path: '../utils/iconInit.js',
        phase: PHASES.CORE_UTILS,
        requires: [],
        provides: ['initIcons', 'iconHTML', 'createIcon', 'replaceFAIcon'],
        api: 'utils',
        optional: true
    },

    // =========================================================================
    // PHASE 2: THEME & VISUAL
    // =========================================================================
    themeManager: {
        path: '../features/themeManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'showNotification', 'getModal'],
        optionalDeps: ['vocabThemeManager', 'checkCompleteAllButton', 'updateStatsPanel', 'updateMainMenuHeader', 'updateHelpWindow', 'refreshFocusActionButton', 'applyCustomColors', 'logHistoryEvent', 'hideMainMenu'],
        provides: ['applyTheme', 'updateThemeColor', 'setupDarkModeToggle', 'setupQuickDarkToggle', 'initThemesPanel', 'refreshThemeToggles', 'setupThemesPanel', 'renderVocabThemes'],
        provideInstance: 'themeManager',
        api: 'features',
        after: ['notifications']
    },

    vocabThemes: {
        path: '../labels/themes.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['AppState'],
        provides: ['vocabThemeManager', 'THEME_DEFINITIONS'],
        provideInstance: 'vocabThemeManager',
        api: 'features',
        after: ['labelResolver']
    },

    gamesManager: {
        path: '../ui/gamesManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'AppState', 'AppMeta', 'safeAddEventListener', 'getModal'],
        provides: [],
        provideInstance: 'gamesManager',
        api: 'ui',
        // Deferred: games are menu-gated. Loaded on first main-menu open (stub in
        // uiBoot.setupDeferredFeatureTriggers), whose init() runs checkGamesUnlock
        // to reveal #games-menu-option (default display:none) if unlocked. The
        // unlockMiniGame depMapping auto-loads it when a cycle milestone fires.
        deferred: true,
        // Resilience: a stale client whose deploy renamed/removed this module would
        // 404 on the post-boot on-demand load. optional=true makes loadModule return
        // null (graceful no-op) instead of throwing an uncaught rejection in the
        // menu-trigger handler — matching the other deferred modules (testing group).
        // The games feature simply stays hidden until verifyVersionFresh() reloads.
        optional: true,
        after: ['notifications']
    },

    onboardingManager: {
        path: '../ui/onboardingManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'AppState', 'showNotification', 'safeAddEventListenerById', 'safeAddEventListener'],
        optionalDeps: ['preloadGettingStartedCycle', 'preloadInitialRunCycle', 'createNewMiniCycle', 'completeInitialSetup', 'showCycleCreationModal', 'activateFocusMode'],
        // Cross-phase: startGuidedTour + markTourWelcomeShown come from
        // guidedTourManager (Phase 6, UI_MANAGERS). Only called from user
        // interactions (SVG "Start Tour" button on step 3, and the merged
        // Home View welcome notification's action buttons + onDismiss).
        lazyRequires: ['startGuidedTour', 'markTourWelcomeShown'],
        provides: [],
        provideInstance: 'onboardingManager',
        api: 'ui',
        after: ['notifications']
    },

    modalRegistry: {
        path: '../ui/modalRegistry.js',
        phase: PHASES.THEME_VISUAL,
        requires: [],
        provides: ['getModal', 'invalidateModal', 'clearModalCache'],
        api: 'ui',
        before: ['modalManager']
    },

    modalManager: {
        path: '../ui/modalManager.js',
        phase: PHASES.THEME_VISUAL,
        requires: ['appInit', 'showNotification', 'safeAddEventListener', 'getModal'],
        optionalDeps: ['hideMainMenu', 'waitForCore'],
        provides: ['hasActiveNotifications'],
        provideInstance: 'modalManager',
        api: 'ui'
    },

    notificationDialogHost: {
        path: '../ui/notificationDialogHost.js',
        phase: PHASES.THEME_VISUAL,
        requires: [],
        optionalDeps: ['getBody', 'waitForCore'],
        provides: [],
        provideInstance: 'notificationDialogHost',
        api: 'ui',
        after: ['notifications', 'modalManager']
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
        optionalDeps: ['captureStateSnapshot', 'checkCompleteAllButton', 'enableUndoSystemOnFirstInteraction', 'hideTaskButtons', 'refreshUIFromState', 'revealTaskButtons', 'updateProgressBar', 'updateStatsPanel', 'updateUndoRedoButtons'],
        provides: ['enableDragAndDropOnTask', 'updateMoveArrowsVisibility', 'updateArrowsInDOM', 'setArrowsEnabled', 'updateFirstLastMarkers'],
        api: 'task'
    },

    deviceDetection: {
        path: '../utils/deviceDetection.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['deviceDetectionManager', 'isTouchDevice'],
        api: 'utils'
    },

    statsPanel: {
        path: '../features/statsPanel.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['showNotification', 'AppState', 'appInit', 'getModal'],
        optionalDeps: ['historyManager', 'clearedTasksManager', 'achievementsManager', 'gesturePanelManager', 'vocabThemeManager', 'focusTaskPanel', 'hideMainMenu', 'isDraggingNotification', 'isOverlayActive', 'setupDarkModeToggle', 'trackAction', 'updateThemeColor', 'showStatsTourNotification'],
        provides: ['showStatsPanel', 'showTaskView', 'navigatePanels', 'updateStatsPanel', 'openHistoryModal', 'openClearedTasksModal', 'openAchievementsModal'],
        provideInstance: 'statsPanelManager',
        api: 'ui'
    },

    taskDOM: {
        path: '../task/taskDOM.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'generateId', 'sanitizeInput', 'TaskOptionsVisibilityController', 'showTaskOptions', 'hideTaskOptions', 'attachKeyboardTaskOptionToggle', 'triggerLogoBackground'],
        optionalDeps: ['saveTaskToSchema25', 'showNotification', 'taskCore'],
        provides: [
            'createTaskDOMElements', 'setupTaskInteractions', 'refreshUIFromState',
            'loadTaskContext', 'createOrUpdateTaskData', 'finalizeTaskCreation',
            'validateAndSanitizeTaskInput', 'buildTaskContext', 'extractTaskDataFromDOM',
            'renderTasks', 'refreshTaskListUI', 'createTaskButtonContainer', 'handleTaskButtonClick',
            'setupRecurringButtonHandler', 'revealTaskButtons', 'taskToAddTaskOptions',
            'patchTask', 'removeTask', 'applyTaskOrder', 'syncBoundaryMarkers',
            'syncRecurringStateToDOM', 'toggleHoverTaskOptions'
        ],
        provideInstance: 'taskDOMManager',
        api: 'task',
        after: ['dragDropManager', 'taskUI', 'taskInteractions', 'uiEffects']
    },

    taskOptionsCustomizer: {
        path: '../ui/taskOptionsCustomizer.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification', 'renderTaskList', 'updateMoveArrowsVisibility', 'startReminders', 'stopReminders', 'DEFAULT_TASK_OPTION_BUTTONS', 'safeAddEventListener', 'getModal'],
        // modeManager is Phase 5 (CYCLE) but taskOptionsCustomizer is Phase 3 - must be lazy
        lazyRequires: ['modeManager'],
        optionalDeps: ['showTaskOptionsTourNotification'],
        provides: [],
        provideInstance: 'taskOptionsCustomizer',
        api: 'ui',
        after: ['taskDOM', 'reminders', 'dragDropManager']  // dragDropManager provides updateMoveArrowsVisibility
    },

    reminders: {
        path: '../features/reminders.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['appInit', 'AppState', 'showNotification', 'showConfirmationModal', 'getModal'],
        optionalDeps: ['hideMainMenu', 'refreshTaskListUI', 'trackAction', 'updateUndoRedoButtons', 'showRemindersTourNotification'],
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
        requires: ['appInit', 'AppState', 'showNotification', 'showNotificationWithTip', 'notifications', 'FeatureFlags', 'GlobalUtils', 'refreshUIFromState', 'getModal'],
        optionalDeps: ['isOverlayActive', 'refreshTaskButtonsForModeChange', 'showRecurringListTourNotification', 'showRecurringSettingsTourNotification', 'syncRecurringStateToDOM'],
        // Cross-phase lazy deps: these are from later phases but only called after user interaction
        lazyRequires: ['updateProgressBar'],  // From cycleCompletion (Phase 6)
        provides: ['panel', 'core'],
        api: 'recurring',
        after: ['taskDOM', 'reminders']
    },

    dueDates: {
        path: '../features/dueDates.js',
        phase: PHASES.RECURRING,
        requires: ['appInit', 'AppState', 'showNotification'],
        optionalDeps: ['checkCompleteAllButton', 'saveTaskToSchema25', 'updateProgressBar', 'updateStatsPanel'],  // UI refresh after a due-date edit
        provides: ['checkOverdueTasks', 'createDueDateInput'],
        provideInstance: 'dueDates',  // depMappings setupDueDateButtonInteraction resolves via deps.features.dueDates
        api: 'features',
        after: ['taskDOM']
    },

    dailyResetManager: {
        path: '../task/dailyResetManager.js',
        phase: PHASES.RECURRING,
        requires: ['AppState', 'showNotification'],
        optionalDeps: ['safeAddEventListener', 'loadMiniCycle'],
        provides: ['dailyResetManager'],
        provideInstance: 'dailyResetManager',
        api: 'task',
        after: ['notifications']
    },

    // =========================================================================
    // PHASE 5: CYCLE MANAGEMENT
    // =========================================================================
    modeManager: {
        path: '../routine/modeManager.js',
        phase: PHASES.CYCLE,
        requires: ['appInit', 'AppState', 'showNotification', 'switchMiniCycle', 'createNewMiniCycle'],
        optionalDeps: ['checkCompleteAllButton', 'checkMiniCycle', 'createTaskButtonContainer', 'helpWindowManager', 'recurringCore', 'setupDueDateButtonInteraction', 'showTaskView', 'statsPanelManager', 'syncAllTasksWithMode'],
        provides: ['setupModeSelector', 'refreshTaskButtonsForModeChange', 'updateCycleModeDescription', 'syncModeFromToggles'],
        api: 'cycle',
        provideInstance: 'modeManager',
        after: ['recurringIntegration', 'routineSwitcher', 'routineManager']
    },

    routineSwitcher: {
        path: '../routine/routineSwitcher.js',
        phase: PHASES.CYCLE,
        requires: ['appInit', 'AppState', 'showNotification', 'showPromptModal', 'showCycleCreationModal', 'getModal'],
        optionalDeps: ['onCycleRenamed', 'onCycleDeleted', 'onCycleSwitched', 'vocabThemeManager', 'checkCompleteAllButton', 'updateStatsPanel', 'updateMainMenuHeader', 'refreshThemeLabels', 'logHistoryEvent', 'exportMiniCycleData', 'hideMainMenu', 'showRoutineSwitcherTourNotification', 'hasActiveNotifications', 'isTouchDevice', 'loadMiniCycle', 'showConfirmationModal', 'updateReminderButtons'],
        provides: ['switchMiniCycle', 'renameMiniCycle', 'deleteMiniCycle'],
        api: 'cycle',
        after: ['routineManager', 'onboardingManager']
    },

    routineManager: {
        path: '../routine/routineManager.js',
        phase: PHASES.CYCLE,
        requires: ['appInit', 'AppState', 'showNotification', 'showPromptModal', 'updateMainMenuHeader'],
        optionalDeps: ['refreshThemeLabels', 'onCycleCreated', 'syncModeFromToggles', 'updateRecurringInfoLink', 'loadMiniCycle', 'DEFAULT_TASK_OPTION_BUTTONS', 'checkCompleteAllButton', 'completeInitialSetup', 'hideMainMenu', 'updateProgressBar'],
        provides: ['showCycleCreationModal', 'createNewMiniCycle', 'preloadGettingStartedCycle', 'preloadInitialRunCycle'],
        api: 'cycle',
        after: ['menuManager']  // Needs hideMainMenu and updateMainMenuHeader from menuManager
    },

    // =========================================================================
    // PHASE 6: UI MANAGERS
    // =========================================================================
    uiOrchestrator: {
        path: '../ui/uiOrchestrator.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'TaskDOMManager', 'renderTasks', 'updateProgressBar', 'updateStatsPanel', 'checkCompleteAllButton', 'setArrowsEnabled', 'updateFirstLastMarkers'],
        optionalDeps: ['TaskRenderer', 'checkOverdueTasks', 'showNotification', 'updateMainMenuHeader'],
        provides: ['requestUIUpdate', 'flushUIUpdates', 'initUIOrchestrator', 'getUIOrchestrator', 'ui'],
        api: 'ui',
        after: ['taskDOM', 'cycleCompletion', 'statsPanel', 'dragDropManager']
    },

    undoRedoManager: {
        path: '../ui/undoRedoManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification', 'safeAddEventListener', 'refreshUIFromState', 'UIOrchestrator', 'requestUIUpdate'],
        optionalDeps: ['logHistoryEvent', 'organizeCompletedTasks', 'refreshHistoryIfOpen', 'updateRecurringInfoLink', 'updateHelpWindow', 'syncModeFromToggles', 'refreshThemeLabels', 'updateRecurringPanel', 'refreshTaskViewLayout', 'AppGlobalState'],
        provides: ['performStateBasedUndo', 'performStateBasedRedo', 'captureStateSnapshot', 'updateUndoRedoButtons', 'enableUndoSystemOnFirstInteraction', 'wrapAppStateForUndo', 'setupStateBasedUndoRedo', 'initUndoSystemForApp', 'onCycleCreated', 'onCycleRenamed', 'onCycleDeleted', 'onCycleSwitched', 'clearAllUndoHistory'],
        api: 'undo',
        after: ['taskDOM', 'uiOrchestrator']
    },

    menuManager: {
        path: '../ui/menuManager.js',
        phase: PHASES.CYCLE,  // Phase 5 (not Phase 6 UI_MANAGERS) because routineManager needs it in same phase
        requires: ['appInit', 'AppState', 'showNotification'],
        optionalDeps: ['activateFocusMode', 'checkCompleteAllButton', 'checkGamesUnlock', 'createNewMiniCycle', 'loadMiniCycle', 'organizeCompletedTasks', 'recurringPanel', 'showConfirmationModal', 'showPromptModal', 'switchMiniCycle', 'trackAction', 'updateCycleData', 'updateCycleModeDescription', 'updateProgressBar', 'updateStatsPanel', 'updateUndoRedoButtons'],
        provides: ['hideMainMenu', 'updateMainMenuHeader', 'clearAllTasks', 'deleteAllTasks'],
        api: 'ui',            // Exports to deps.ui — api category != phase
        singleton: true
    },

    settingsManager: {
        path: '../ui/settingsManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification', 'getModal'],
        optionalDeps: ['clearAllUndoHistory', 'loadMiniCycle', 'showLoader', 'hideLoader', 'closeAllModals', 'hasActiveNotifications', 'hideMainMenu', 'BackupManager', 'DataValidator', 'calculateNextOccurrence', 'disableDebug', 'enableDebug', 'isDebug', 'handleTaskListMovement', 'organizeCompletedTasks', 'onCycleCreated', 'performSchema25Migration', 'refreshTaskListUI', 'resetDefaultRecurringSettings', 'setupDarkModeToggle', 'setupQuickDarkToggle', 'showConfirmationModal', 'showPromptModal', 'showSettingsTourNotification', 'startGuidedTour', 'toggleHoverTaskOptions', 'updateCompletedTasksCount', 'updateHelpWindow', 'updateMoveArrowsVisibility', 'updateStatsPanel'],
        provides: ['syncCurrentSettingsToStorage', 'exportMiniCycleData', 'downloadBackupFile'],
        provideInstance: 'settingsManager',
        api: 'ui',
        after: ['menuManager', 'themeManager', 'undoRedoManager']
    },

    guidedTourManager: {
        path: '../ui/guidedTourManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'getElementById', 'querySelector', 'getBody', 'getRootElement', 'getActiveElement', 'showNotification', 'safeAddEventListener'],
        optionalDeps: ['isModalOpen'],
        provides: ['startGuidedTour', 'markTourWelcomeShown', 'showStatsTourNotification', 'showPersonalizationTourNotification', 'showTaskOptionsTourNotification', 'showRemindersTourNotification', 'showMenuTourNotification', 'showSettingsTourNotification', 'showRoutineSwitcherTourNotification', 'showRecurringListTourNotification', 'showRecurringSettingsTourNotification', 'showHistoryTourNotification', 'showClearedTasksTourNotification', 'showAchievementsTourNotification'],
        provideInstance: 'guidedTourManager',
        api: 'ui',
        after: ['onboardingManager']
    },

    // NOTE: preferencesBgImage and preferencesPresets are loaded as
    // sub-modules inside preferencesManager.init() - do NOT list them here
    // to avoid duplicate initialization.
    preferencesManager: {
        path: '../ui/preferencesManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification', 'showPromptModal', 'showConfirmationModal', 'safeAddEventListener', 'hideMainMenu', 'getModal'],
        optionalDeps: ['renderVocabThemes', 'showPersonalizationTourNotification', 'hasActiveNotifications'],
        provides: ['applyCustomColors', 'removeCustomColors'],
        provideInstance: 'preferencesManager',
        api: 'ui',
        after: ['menuManager', 'themeManager']
    },

    titleManager: {
        path: '../ui/titleManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'GlobalUtils', 'AppState', 'loadMiniCycleData', 'showNotification', 'updateMainMenuHeader', 'updateUndoRedoButtons', 'captureStateSnapshot', 'enableUndoSystemOnFirstInteraction', 'onCycleRenamed'],
        provides: ['setupMiniCycleTitleListener', 'handleMiniCycleTitleBlur'],
        api: 'ui',
        after: ['undoRedoManager']  // undoRedoManager provides updateUndoRedoButtons, captureStateSnapshot, onCycleRenamed
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
        optionalDeps: ['logHistoryEvent', 'checkAchievements', 'checkBackupReminderOnCycleComplete', 'vocabThemeManager', 'renderVocabThemes', 'showConfirmationModal', 'assignCycleVariables', 'resetTasks', 'unlockMiniGame', 'updateStatsPanel'],
        provides: ['checkMiniCycle', 'updateProgressBar', 'incrementCycleCount', 'showCompletionAnimation', 'showClearAnimation', 'animateProgressBarFill', 'animateProgressBarEmpty', 'showMilestoneCelebrationOverlay'],
        api: 'progress'
    },

    taskUI: {
        path: '../ui/taskUI.js',
        phase: PHASES.THEME_VISUAL, // Must load before TASK_MANAGEMENT so TaskOptionsVisibilityController is available
        requires: ['appInit', 'loadMiniCycleData'],
        optionalDeps: ['showCustomizerTip', 'addTask', 'isTouchDevice', 'taskToAddTaskOptions'],
        // NOTE: taskUI also exports refreshTaskListUI (tested directly), but the DI
        // mapping reads taskDOM's deps.task copy — declaring it here would mask
        // taskDOM as the provider in buildProviderMap (last-writer-wins).
        provides: ['showTaskOptions', 'hideTaskOptions', 'checkCompleteAllButton', 'TaskOptionsVisibilityController', 'hideTaskButtons'],
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
        // No optionalDeps — getLogoTimeoutId/setLogoTimeoutId were removed (April 2026):
        // they're internal-state hooks not flowed through depMappings; uiEffects
        // manages timeout IDs internally now.
        optionalDeps: [],
        provides: ['triggerLogoBackground', 'triggerLogoScan'],
        api: 'ui'
    },

    taskSearch: {
        path: '../ui/taskSearch.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit'],
        provides: ['initTaskSearch', 'updateSearchVisibility', 'resetSearch'],
        api: 'ui',
        after: ['taskDOM']
    },

    quickActionsManager: {
        path: '../ui/quickActionsManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification', 'getModal'],
        optionalDeps: ['hideMainMenu', 'isDebug', 'recurringPanel', 'showStatsPanel', 'showTaskView', 'switchMiniCycle'],
        provides: ['trackAction'],
        provideInstance: 'quickActionsManager',
        api: 'ui',
        after: ['menuManager', 'statsPanel']
    },

    helpWindowManager: {
        path: '../ui/helpWindowManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'loadMiniCycleData', 'safeAddEventListener', 'getModal'],
        provides: [],
        provideInstance: 'helpWindowManager',
        api: 'ui'
    },

    focusTaskPanel: {
        path: '../ui/focusTaskPanel.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState'],
        // Completion-path companions — same trio the task-list tap uses
        optionalDeps: ['checkMiniCycle', 'enableUndoSystemOnFirstInteraction', 'safeAddEventListener'],
        provides: [],
        provideInstance: 'focusTaskPanel',
        api: 'ui',
        optional: true,
        // Deferred: focus-view-only panel (FOCUS_TASK_VIEW_PLAN). Loaded
        // on-demand when focus mode activates (Phase 2 wires
        // ensureModuleLoaded('focusTaskPanel')) — keeps it off the boot path.
        deferred: true,
        after: ['statsPanel']
    },

    gesturePanelManager: {
        path: '../ui/gesturePanelManager.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['safeAddEventListener', 'showNotification'],
        optionalDeps: ['isOverlayActive', 'isDraggingNotification', 'onNavigate', 'onShowStatsPanel', 'onShowTaskView'],
        provides: [],
        provideInstance: 'gesturePanelManager',
        api: 'ui',
        after: ['statsPanel']
    },

    taskCore: {
        path: '../task/taskCore.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'showNotification', 'sanitizeInput', 'removeRecurringTasksFromCycle'],
        optionalDeps: ['showCompletionAnimation', 'showClearAnimation', 'handleTaskListMovement', 'logHistoryEvent', 'showMilestoneCelebrationOverlay', 'checkBackupReminderOnTaskClear', 'DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS', 'DEFAULT_TASK_OPTION_BUTTONS', 'animateProgressBarEmpty', 'animateProgressBarFill', 'checkCompleteAllButton', 'checkMiniCycle', 'checkOverdueTasks', 'enableDragAndDropOnTask', 'incrementCycleCount', 'isPerformingUndoRedo', 'isTouchDevice', 'pluginManager', 'recurringPanel', 'updateArrowsInDOM', 'updateMainMenuHeader', 'updateMoveArrowsVisibility', 'updateProgressBar', 'updateRecurringPanelButtonVisibility', 'updateStatsPanel', 'updateCompletedTasksCount'],
        provides: ['addTask', 'editTask', 'deleteTask', 'toggleTaskPriority', 'handleTaskCompletionChange', 'resetTasks', 'saveTaskToSchema25', 'handleCompleteAllTasks'],
        provideInstance: 'taskCore',
        api: 'task',
        after: ['taskDOM', 'cycleCompletion', 'recurringIntegration']
    },

    routineLoader: {
        path: '../routine/routineLoader.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['appInit', 'AppState', 'loadMiniCycleData'],
        optionalDeps: ['refreshThemeLabels', 'syncModeFromToggles', 'updateRecurringInfoLink', 'addTask', 'catchUpMissedRecurringTasks', 'checkCompleteAllButton', 'completedTasksManager', 'createInitialSchema25Data', 'startReminders', 'syncAllTasksWithMode', 'taskToAddTaskOptions', 'updateMainMenuHeader', 'updateProgressBar', 'updateSearchVisibility', 'updateStatsPanel', 'updateThemeColor'],
        provides: ['loadMiniCycle'],
        api: 'cycle',
        after: ['taskCore']
    },

    pullToRefresh: {
        path: '../ui/pullToRefresh.js',
        phase: PHASES.UI_MANAGERS,
        requires: ['showNotification'],
        optionalDeps: ['refreshUIFromState', 'loadMiniCycle', 'watchRecurringTasks', 'isModalOpen'],
        provides: ['pullToRefresh'],
        api: 'ui',
        optional: true
    },

    focusMode: {
        path: '../ui/focusMode.js',
        phase: PHASES.UI_MANAGERS,
        optionalDeps: ['showNotification', 'safeAddEventListener', 'AppState', 'clearAllTasks', 'deleteAllTasks', 'switchMiniCycle', 'createNewMiniCycle', 'ensureModuleLoaded', 'showTaskView'],
        provides: ['activateFocusMode'],
        provideInstance: 'focusMode',
        api: 'ui',
        optional: true
    },

    taskViewLayoutManager: {
        path: '../ui/taskViewLayoutManager.js',
        phase: PHASES.UI_MANAGERS,
        optionalDeps: ['AppState', 'appInit', 'enableUndoSystemOnFirstInteraction'],
        provides: ['resetTaskViewLayout', 'refreshTaskViewLayout'],
        provideInstance: 'taskViewLayoutManager',
        api: 'ui',
        optional: true,
        after: ['focusMode', 'undoRedoManager']
    },

    // =========================================================================
    // PHASE 7: FEATURES - History, Achievements
    // =========================================================================
    historyManager: {
        path: '../features/historyManager.js',
        phase: PHASES.FEATURES,
        requires: ['appInit', 'AppState', 'showNotification'],
        optionalDeps: ['safeAddEventListener', 'showConfirmationModal', 'updateStatsPanel', 'updateHelpWindow', 'clearedTasksManager', 'addTask', 'showHistoryTourNotification', 'showClearedTasksTourNotification'],
        provides: ['logHistoryEvent', 'getHistory', 'clearHistory', 'openHistoryModal'],
        provideInstance: 'historyManager',
        api: 'features',
        after: ['statsPanel']
    },

    clearedTasksManager: {
        path: '../features/clearedTasksManager.js',
        phase: PHASES.FEATURES,
        requires: ['appInit', 'AppState', 'showNotification'],
        optionalDeps: ['addTask', 'showConfirmationModal'],
        provides: ['recordClearedTask', 'getClearedTasks', 'clearClearedTasks', 'openClearedTasksModal'],
        provideInstance: 'clearedTasksManager',
        api: 'features',
        after: ['historyManager']
    },

    achievementsManager: {
        path: '../features/achievementsManager.js',
        phase: PHASES.FEATURES,
        requires: ['appInit', 'AppState', 'showNotification'],
        optionalDeps: ['unlockMiniGame', 'safeAddEventListener', 'vocabThemeManager', 'logHistoryEvent', 'showAchievementsTourNotification'],
        provides: ['checkAchievements', 'getAchievements', 'isAchievementUnlocked', 'openAchievementsModal', 'initBadgeTooltips', 'showBadgeDetail', 'hideBadgeDetail', 'updateBadges'],
        provideInstance: 'achievementsManager',
        api: 'features',
        after: ['clearedTasksManager', 'themeManager', 'gamesManager', 'vocabThemes']
    },

    uxRatings: {
        path: '../features/uxRatings.js',
        phase: PHASES.FEATURES,
        requires: ['appInit', 'AppState', 'safeAddEventListener'],
        optionalDeps: ['AppMeta'],
        provides: [],
        provideInstance: 'uxRatings',
        api: 'features'
    },

    backupReminder: {
        path: '../features/backupReminder.js',
        phase: PHASES.FEATURES,
        requires: ['AppState', 'showConfirmationModal'],
        optionalDeps: ['showNotification', 'downloadBackupFile'],
        provides: ['checkBackupReminderOnBoot', 'checkBackupReminderOnCycleComplete', 'checkBackupReminderOnTaskClear'],
        api: 'features',
        optional: true,
        after: ['achievementsManager']
    },

    // =========================================================================
    // PHASE 8: TESTING & BACKUP
    // =========================================================================
    // backupManager must load FIRST so testingModal and testingModalIntegration can use it
    backupManager: {
        path: '../storage/backupManager.js',
        phase: PHASES.TESTING,
        requires: ['AppState'],
        provides: ['backupManager'],
        api: 'storage',
        optional: true,
        singleton: true
    },

    testingModal: {
        path: '../testing/testing-modal.js',
        phase: PHASES.TESTING,
        requires: ['AppState', 'showNotification', 'notifications', 'safeAddEventListener', 'safeAddEventListenerById', 'safeLocalStorageGet', 'safeLocalStorageSet', 'safeJSONParse', 'safeJSONStringify', 'consoleCapture', 'backupManager', 'getModal'],
        provides: ['openStorageViewer', 'closeStorageViewer'],
        api: 'testing',
        optional: true,
        // Deferred: loaded on-demand when #open-testing-modal is clicked (stub in
        // uiBoot.setupDeferredFeatureTriggers). Dev/diagnostic UI most users never open.
        deferred: true,
        after: ['backupManager']  // backupManager (eager) loads first
    },

    testingModalIntegration: {
        path: '../testing/testing-modal-integration.js',
        phase: PHASES.TESTING,
        // Hermetic runner: embeds the suite from a separate origin, so no AppState/backup deps.
        requires: ['safeAddEventListenerById', 'showNotification'],
        provides: ['runAllAutomatedTests'],
        api: 'testing',
        optional: true,
        // Deferred: loaded alongside testingModal via the #open-testing-modal stub.
        deferred: true
    },

    basicPluginSystem: {
        path: '../other/basicPluginSystem.js',
        phase: PHASES.TESTING,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['pluginManager'],
        api: 'plugins',
        optional: true,
        // Deferred: inert plugin substrate — no plugins are registered at boot and
        // every pluginManager consumer guards with ?. (taskCycleReset triggerHook).
        // No UI entry point, so it simply stays unloaded (zero behavior change today).
        deferred: true
    }
};

// ============================================================================
// DEPENDENCY RESOLUTION CONSTANTS
// ============================================================================
// These are the single source of truth - moduleLoader.js imports them from here
// via the versioned dynamic import to avoid cache mismatches.

/**
 * Core dependencies provided by coreBoot (not by manifest modules).
 * These are always available before any manifest modules load.
 * Used to:
 * - Exclude from circular dependency detection
 * - Exclude from effective after computation
 */
export const CORE_DEPS = new Set([
    'AppState',
    'AppGlobalState',  // Injected via coreResult in moduleLoader (not depMappings)
    'appInit',
    'GlobalUtils',
    'FeatureFlags',
    'AppMeta',
    'DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS',  // Constant from coreBoot (deps.core); also a depMappings key
    'performSchema25Migration',                // Migration fn from coreBoot (deps.core); also a depMappings key
    'loadMiniCycleData',
    'autoSave',
    'sanitizeInput',
    'generateId',
    'generateHashId',
    'escapeHtml',
    'safeAddEventListener',
    'safeAddEventListenerById',
    'safeLocalStorageGet',
    'safeLocalStorageSet',
    'safeJSONParse',
    'safeJSONStringify',
    // DOM helpers — always available, framework-level (direct document calls in depMappings)
    'getElementById',
    'querySelector',
    'querySelectorAll',
    'getBody',
    'getRootElement',
    'getActiveElement',
    'getTaskList',
    'getProgressBar',
]);

/**
 * Alias map for depMappings entries that don't match provides names.
 * Key: alias name used in `requires`
 * Value: canonical name from `provides`
 *
 * IMPORTANT: Only add TRUE aliases here - where the alias and canonical name
 * refer to the exact same functionality. Do NOT add entries where two names
 * are distinct APIs that happen to be provided by the same module.
 */
export const ALIAS_MAP = new Map([
    // Cycle/mode aliases (true alias - same function, different name)
    ['initializeModeSelector', 'setupModeSelector'],   // modeManager provides setupModeSelector

    // renderTaskList is a depMappings wrapper that calls refreshTaskListUI
    // This is a true alias - same underlying function
    ['renderTaskList', 'refreshTaskListUI'],

    // NOTE: renderTasks is NOT an alias of refreshTaskListUI - they are distinct APIs.
    // renderTasks is accessed via deps.task?.renderTasks and is not in any provides.
    // Do NOT add ['renderTasks', 'refreshTaskListUI'] here.
]);

/**
 * Resolve an API name to its canonical provides name
 * @param {string} apiName - The name from requires (may be alias)
 * @returns {string} - Canonical name from provides
 */
export function resolveAlias(apiName) {
    return ALIAS_MAP.get(apiName) || apiName;
}

// ============================================================================
// LOAD ORDER UTILITIES
// ============================================================================

/**
 * Perform topological sort on modules based on effective dependencies.
 * Uses computeEffectiveAfterConstraints() to include derived `after` from `requires`.
 * @returns {string[]} Module names in load order
 */
export function getLoadOrder() {
    // Ensure effective after is computed
    const effectiveAfter = computeEffectiveAfterConstraints();

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

        // Visit dependencies first (using effective after, not just explicit)
        const deps = effectiveAfter.get(name) || new Set();
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

// ============================================================================
// EFFECTIVE AFTER COMPUTATION
// ============================================================================

/** Cached effective after constraints (computed once on first use) */
let _effectiveAfter = null;
let _providerMap = null;

/**
 * Build a map of API name → module name from provides/provideInstance
 * @returns {Map<string, string>}
 */
function buildProviderMap() {
    if (_providerMap) return _providerMap;

    _providerMap = new Map();
    for (const [moduleName, manifest] of Object.entries(MODULE_MANIFESTS)) {
        for (const api of manifest.provides || []) {
            _providerMap.set(api, moduleName);
        }
        if (manifest.provideInstance) {
            _providerMap.set(manifest.provideInstance, moduleName);
        }
    }
    return _providerMap;
}

/**
 * Compute effective 'after' constraints by analyzing requires → provides relationships.
 * This makes `requires` actually affect load order within a phase.
 *
 * @returns {Map<string, Set<string>>} Map of module name → Set of modules it must load after
 */
export function computeEffectiveAfterConstraints() {
    if (_effectiveAfter) return _effectiveAfter;

    _effectiveAfter = new Map();
    const providerMap = buildProviderMap();

    for (const [moduleName, manifest] of Object.entries(MODULE_MANIFESTS)) {
        // Start with explicit 'after' constraints
        const afterSet = new Set(manifest.after || []);

        // Add constraints derived from 'requires'
        for (const req of manifest.requires || []) {
            // Skip core deps (always available from coreBoot)
            if (CORE_DEPS.has(req)) continue;

            // Skip lazyRequires (intentionally cross-phase, loaded lazily)
            if (manifest.lazyRequires?.includes(req)) continue;

            // Resolve alias to canonical name
            const canonical = resolveAlias(req);
            const provider = providerMap.get(canonical);

            if (provider && provider !== moduleName) {
                // Only add same-phase constraints
                // Cross-phase deps are handled by phase ordering
                const providerPhase = MODULE_MANIFESTS[provider]?.phase;
                const myPhase = manifest.phase;

                if (providerPhase === myPhase) {
                    afterSet.add(provider);
                }
            }
        }

        _effectiveAfter.set(moduleName, afterSet);
    }

    return _effectiveAfter;
}

/**
 * Topological sort of modules within a phase using effective after constraints
 * @param {Array<[string, Object]>} modules - Module entries to sort
 * @param {Map<string, Set<string>>} effectiveAfter - Computed after constraints
 * @returns {Array<[string, Object]>} Sorted modules
 */
function topologicalSortWithinPhase(modules, effectiveAfter) {
    const moduleMap = new Map(modules);
    const moduleNames = new Set(modules.map(([name]) => name));
    const sorted = [];
    const visited = new Set();
    const visiting = new Set(); // For cycle detection

    function visit(name) {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            console.error(`🔄 Circular dependency detected within phase: ${name}`);
            return; // Break cycle
        }

        visiting.add(name);

        // Visit dependencies first (only those in this phase)
        const deps = effectiveAfter.get(name) || new Set();
        for (const dep of deps) {
            if (moduleNames.has(dep)) {
                visit(dep);
            }
        }

        visiting.delete(name);
        visited.add(name);
        sorted.push([name, moduleMap.get(name)]);
    }

    for (const [name] of modules) {
        visit(name);
    }

    return sorted;
}

/**
 * Get all modules for a specific phase, sorted by effective dependencies.
 * This now respects both explicit 'after' AND derived constraints from 'requires'.
 *
 * @param {number} phase - Phase number
 * @returns {Array<[string, ModuleManifest]>} Module name and manifest pairs
 */
export function getModulesByPhase(phase) {
    const modules = Object.entries(MODULE_MANIFESTS)
        .filter(([_, manifest]) => manifest.phase === phase);

    // Compute effective after constraints (cached after first call)
    const effectiveAfter = computeEffectiveAfterConstraints();

    // Use topological sort for correct ordering
    return topologicalSortWithinPhase(modules, effectiveAfter);
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
 * Validate cross-phase dependencies.
 * Warns if a module requires an API from a later phase without declaring it in lazyRequires.
 *
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateCrossPhaseDeps() {
    const warnings = [];
    const providerMap = buildProviderMap();

    for (const [moduleName, manifest] of Object.entries(MODULE_MANIFESTS)) {
        const myPhase = manifest.phase;

        for (const req of manifest.requires || []) {
            // Skip core deps
            if (CORE_DEPS.has(req)) continue;

            // Resolve alias
            const canonical = resolveAlias(req);
            const provider = providerMap.get(canonical);

            if (!provider) continue; // Unknown provider, handled elsewhere

            const providerPhase = MODULE_MANIFESTS[provider]?.phase;

            // Check for forward cross-phase reference (requires something from a later phase)
            if (providerPhase && providerPhase > myPhase) {
                if (!manifest.lazyRequires?.includes(req)) {
                    warnings.push(
                        `${moduleName} (Phase ${myPhase}) requires '${req}' from ${provider} (Phase ${providerPhase}) ` +
                        `but '${req}' is not in lazyRequires. This dep must be lazy-only or move to lazyRequires.`
                    );
                }
            }
        }
    }

    if (warnings.length > 0) {
        console.warn('⚠️ Cross-phase dependency warnings:');
        warnings.forEach(w => console.warn(`   ${w}`));
    }

    return {
        valid: warnings.length === 0,
        warnings
    };
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
    order.forEach((name, i) => {
        const manifest = MODULE_MANIFESTS[name];
    });
}
