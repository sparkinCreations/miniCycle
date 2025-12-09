/**
 * ============================================================================
 * app-featureBoot.js - Feature Module DI Wiring (Skeleton)
 * ============================================================================
 *
 * This file handles ALL dependency injection wiring and module initialization.
 * It also handles ALL window.* exports for modules that need global access.
 *
 * RESPONSIBILITIES:
 * - Import all feature modules
 * - Call set*Dependencies() for each module
 * - Initialize module instances
 * - Expose services to window.* (uiBoot should NOT do this)
 *
 * IMPORT RULES:
 * - This file CAN import from app-coreBoot.js
 * - This file must NOT import from app-uiBoot.js
 *
 * ============================================================================
 */

/**
 * Boot all feature modules with proper DI wiring
 *
 * @param {Object} deps - Core dependencies from app-coreBoot.js
 * @param {Object} deps.appInit - App initialization coordinator
 * @param {Object} deps.AppState - Central state manager
 * @param {Object} deps.AppGlobalState - Runtime state
 * @param {Object} deps.GlobalUtils - Utility functions
 * @param {Function} deps.withV - Version helper for imports
 * @returns {Object} Initialized feature module references
 */
export async function bootFeatures(deps) {
  const { appInit, AppState, AppGlobalState, GlobalUtils, withV } = deps;

  console.log('🚀 Starting feature boot...');

  // Container for initialized modules
  const features = {};

  // ============================================================================
  // PHASE 1: Core Utilities (no dependencies on other features)
  // ============================================================================

  // ========== Data Validator ==========
  try {
    const dataValidatorMod = await import(withV('./modules/utils/dataValidator.js'));
    window.DataValidator = dataValidatorMod.DataValidator;
    console.log('✅ DataValidator loaded');
  } catch (error) {
    console.error('❌ Failed to load DataValidator:', error);
  }

  // ========== Error Handler ==========
  try {
    const errorHandlerMod = await import(withV('./modules/utils/errorHandler.js'));
    if (errorHandlerMod.setErrorHandlerDependencies) {
      errorHandlerMod.setErrorHandlerDependencies({
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur)
      });
    }
    console.log('✅ ErrorHandler loaded');
  } catch (error) {
    console.error('❌ Failed to load ErrorHandler:', error);
  }

  // ========== Notifications ==========
  try {
    const notificationsMod = await import(withV('./modules/utils/notifications.js'));

    if (notificationsMod.setNotificationsDependencies) {
      notificationsMod.setNotificationsDependencies({
        get AppState() { return window.AppState; },
        loadMiniCycleData: () => window.loadMiniCycleData?.(),
        GlobalUtils
      });
    }

    const notifications = new notificationsMod.MiniCycleNotifications();
    features.notifications = notifications;

    // Window exports
    window.notifications = notifications;
    window.showNotification = (msg, type, dur) => notifications.show(msg, type, dur);
    window.showNotificationWithTip = (content, type, dur, tipId) => notifications.showWithTip(content, type, dur, tipId);
    window.showConfirmationModal = (options) => notifications.showConfirmationModal(options);
    window.showPromptModal = (options) => notifications.showPromptModal(options);

    console.log('✅ Notifications loaded');
  } catch (error) {
    console.error('❌ Failed to load Notifications:', error);
  }

  // ============================================================================
  // PHASE 2: Theme & Visual Features
  // ============================================================================

  // ========== Theme Manager ==========
  try {
    const themeManagerMod = await import(withV('./modules/features/themeManager.js'));

    if (themeManagerMod.setThemeManagerDependencies) {
      themeManagerMod.setThemeManagerDependencies({
        get AppState() { return window.AppState; },
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur)
      });
    }

    features.themeManager = themeManagerMod.themeManager;

    // Window exports
    window.ThemeManager = themeManagerMod.default;
    window.themeManager = themeManagerMod.themeManager;
    window.applyTheme = themeManagerMod.applyTheme;
    window.updateThemeColor = themeManagerMod.updateThemeColor;
    window.setupDarkModeToggle = themeManagerMod.setupDarkModeToggle;

    console.log('✅ ThemeManager loaded');
  } catch (error) {
    console.error('❌ Failed to load ThemeManager:', error);
  }

  // ========== Games Manager ==========
  try {
    const gamesManagerMod = await import(withV('./modules/ui/gamesManager.js'));

    if (gamesManagerMod.setGamesManagerDependencies) {
      gamesManagerMod.setGamesManagerDependencies({
        AppMeta: window.AppMeta,
        get AppState() { return window.AppState; },
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur)
      });
    }

    features.gamesManager = gamesManagerMod.gamesManager;

    // Window exports
    window.GamesManager = gamesManagerMod.default;
    window.gamesManager = gamesManagerMod.gamesManager;
    window.unlockMiniGame = (...args) => gamesManagerMod.gamesManager?.unlockMiniGame?.(...args);
    window.checkGamesUnlock = (...args) => gamesManagerMod.gamesManager?.checkGamesUnlock?.(...args);

    console.log('✅ GamesManager loaded');
  } catch (error) {
    console.error('❌ Failed to load GamesManager:', error);
  }

  // ============================================================================
  // PHASE 3: Task Management
  // ============================================================================

  // ========== Task DOM ==========
  try {
    const taskDOMMod = await import(withV('./modules/task/taskDOM.js'));

    if (taskDOMMod.setTaskDOMDependencies) {
      taskDOMMod.setTaskDOMDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        loadMiniCycleData: () => window.loadMiniCycleData?.(),
        // TODO: Add all required dependencies
      });
    }

    const taskDOMManager = taskDOMMod.taskDOMManager || new taskDOMMod.default();
    features.taskDOMManager = taskDOMManager;

    // Window exports
    window.__taskDOMManager = taskDOMManager;
    window.createTaskDOMElements = taskDOMMod.createTaskDOMElements;
    window.setupTaskInteractions = taskDOMMod.setupTaskInteractions;
    window.finalizeTaskCreation = taskDOMMod.finalizeTaskCreation;
    window.loadTaskContext = taskDOMMod.loadTaskContext;
    window.validateAndSanitizeTaskInput = taskDOMMod.validateAndSanitizeTaskInput;
    window.refreshUIFromState = taskDOMMod.refreshUIFromState;
    window.extractTaskDataFromDOM = taskDOMMod.extractTaskDataFromDOM;

    console.log('✅ TaskDOM loaded');
  } catch (error) {
    console.error('❌ Failed to load TaskDOM:', error);
  }

  // ========== Task Core ==========
  try {
    const taskCoreMod = await import(withV('./modules/task/taskCore.js'));

    if (taskCoreMod.setTaskCoreDependencies) {
      taskCoreMod.setTaskCoreDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        loadMiniCycleData: () => window.loadMiniCycleData?.(),
        updateProgressBar: () => window.updateProgressBar?.(),
        checkMiniCycle: () => window.checkMiniCycle?.(),
        // TODO: Add all required dependencies
      });
    }

    features.taskCore = taskCoreMod;

    // Window exports
    window.taskCore = taskCoreMod;
    window.handleTaskCompletionChange = taskCoreMod.handleTaskCompletionChange;
    window.resetTasks = taskCoreMod.resetTasks;
    window.handleCompleteAllTasks = taskCoreMod.handleCompleteAllTasks;

    console.log('✅ TaskCore loaded');
  } catch (error) {
    console.error('❌ Failed to load TaskCore:', error);
  }

  // ========== Drag & Drop Manager ==========
  try {
    const dragDropMod = await import(withV('./modules/task/dragDropManager.js'));

    if (dragDropMod.setDragDropDependencies) {
      dragDropMod.setDragDropDependencies({
        AppGlobalState,
        GlobalUtils,
        autoSave: () => window.autoSave?.()
      });
    }

    features.dragDropManager = dragDropMod.dragDropManager;

    // Window exports
    window.dragDropManager = dragDropMod.dragDropManager;
    window.enableDragAndDropOnTask = dragDropMod.enableDragAndDropOnTask;

    console.log('✅ DragDropManager loaded');
  } catch (error) {
    console.error('❌ Failed to load DragDropManager:', error);
  }

  // ============================================================================
  // PHASE 4: Cycle Management
  // ============================================================================

  // ========== Cycle Manager ==========
  try {
    const cycleManagerMod = await import(withV('./modules/cycle/cycleManager.js'));

    if (cycleManagerMod.setCycleManagerDependencies) {
      cycleManagerMod.setCycleManagerDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        loadMiniCycleData: () => window.loadMiniCycleData?.(),
        // TODO: Add all required dependencies
      });
    }

    features.cycleManager = cycleManagerMod.cycleManager;

    // Window exports
    window.cycleManager = cycleManagerMod.cycleManager;
    window.showCycleCreationModal = cycleManagerMod.showCycleCreationModal;
    window.deleteMiniCycle = cycleManagerMod.deleteMiniCycle;
    window.renameMiniCycle = cycleManagerMod.renameMiniCycle;

    console.log('✅ CycleManager loaded');
  } catch (error) {
    console.error('❌ Failed to load CycleManager:', error);
  }

  // ========== Cycle Loader ==========
  try {
    const cycleLoaderMod = await import(withV('./modules/cycle/cycleLoader.js'));

    if (cycleLoaderMod.setCycleLoaderDependencies) {
      cycleLoaderMod.setCycleLoaderDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        addTask: (...args) => window.addTask?.(...args),
        // TODO: Add all required dependencies
      });
    }

    features.cycleLoader = cycleLoaderMod;

    // Window exports
    window.loadMiniCycle = cycleLoaderMod.loadMiniCycle;
    window.setCycleLoaderDependencies = cycleLoaderMod.setCycleLoaderDependencies;

    console.log('✅ CycleLoader loaded');
  } catch (error) {
    console.error('❌ Failed to load CycleLoader:', error);
  }

  // ========== Cycle Switcher ==========
  try {
    const cycleSwitcherMod = await import(withV('./modules/cycle/cycleSwitcher.js'));

    if (cycleSwitcherMod.setCycleSwitcherDependencies) {
      cycleSwitcherMod.setCycleSwitcherDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        loadMiniCycle: () => window.loadMiniCycle,
        // TODO: Add all required dependencies
      });
    }

    features.cycleSwitcher = cycleSwitcherMod.cycleSwitcher;

    // Window exports
    window.cycleSwitcher = cycleSwitcherMod.cycleSwitcher;

    console.log('✅ CycleSwitcher loaded');
  } catch (error) {
    console.error('❌ Failed to load CycleSwitcher:', error);
  }

  // ========== Mode Manager ==========
  try {
    const modeManagerMod = await import(withV('./modules/cycle/modeManager.js'));

    if (modeManagerMod.setModeManagerDependencies) {
      modeManagerMod.setModeManagerDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        // TODO: Add all required dependencies
      });
    }

    features.modeManager = modeManagerMod.modeManager;

    // Window exports
    window.modeManager = modeManagerMod.modeManager;
    window.saveToggleAutoReset = () => modeManagerMod.modeManager?.setupToggleAutoReset?.();

    console.log('✅ ModeManager loaded');
  } catch (error) {
    console.error('❌ Failed to load ModeManager:', error);
  }

  // ============================================================================
  // PHASE 5: Progress & Completion
  // ============================================================================

  // ========== Cycle Completion / Progress ==========
  try {
    const cycleCompletionMod = await import(withV('./modules/progress/cycleCompletion.js'));

    if (cycleCompletionMod.setCycleCompletionDependencies) {
      cycleCompletionMod.setCycleCompletionDependencies({
        get AppState() { return window.AppState; },
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        // TODO: Add all required dependencies
      });
    }

    features.cycleCompletion = cycleCompletionMod;

    // Window exports
    window.updateProgressBar = cycleCompletionMod.updateProgressBar;
    window.checkMiniCycle = cycleCompletionMod.checkMiniCycle;
    window.incrementCycleCount = cycleCompletionMod.incrementCycleCount;
    window.showCompletionAnimation = cycleCompletionMod.showCompletionAnimation;

    console.log('✅ CycleCompletion loaded');
  } catch (error) {
    console.error('❌ Failed to load CycleCompletion:', error);
  }

  // ============================================================================
  // PHASE 6: Recurring Tasks
  // ============================================================================

  // ========== Recurring Core ==========
  try {
    const recurringCoreMod = await import(withV('./modules/recurring/recurringCore.js'));

    if (recurringCoreMod.setRecurringCoreDependencies) {
      recurringCoreMod.setRecurringCoreDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        // TODO: Add all required dependencies
      });
    }

    features.recurringCore = recurringCoreMod;

    // Window exports
    window.recurringCore = recurringCoreMod;
    window.checkRecurringTasksNow = recurringCoreMod.checkRecurringTasksNow;
    window.catchUpMissedRecurringTasks = recurringCoreMod.catchUpMissedRecurringTasks;
    window.calculateNextOccurrence = recurringCoreMod.calculateNextOccurrence;

    console.log('✅ RecurringCore loaded');
  } catch (error) {
    console.error('❌ Failed to load RecurringCore:', error);
  }

  // ========== Recurring Panel ==========
  try {
    const recurringPanelMod = await import(withV('./modules/recurring/recurringPanel.js'));

    if (recurringPanelMod.setRecurringPanelDependencies) {
      recurringPanelMod.setRecurringPanelDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        // TODO: Add all required dependencies
      });
    }

    features.recurringPanel = recurringPanelMod;

    // Window exports
    window.recurringPanel = recurringPanelMod;
    window.openRecurringSettingsPanelForTask = recurringPanelMod.openRecurringSettingsPanelForTask;

    console.log('✅ RecurringPanel loaded');
  } catch (error) {
    console.error('❌ Failed to load RecurringPanel:', error);
  }

  // ============================================================================
  // PHASE 7: UI Components
  // ============================================================================

  // ========== Settings Manager ==========
  try {
    const settingsManagerMod = await import(withV('./modules/ui/settingsManager.js'));

    if (settingsManagerMod.setSettingsManagerDependencies) {
      settingsManagerMod.setSettingsManagerDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        loadMiniCycleData: () => window.loadMiniCycleData?.(),
        // TODO: Add all required dependencies
      });
    }

    const settingsManager = settingsManagerMod.settingsManager || new settingsManagerMod.default();
    features.settingsManager = settingsManager;

    // Window exports
    window.settingsManager = settingsManager;
    window.syncCurrentSettingsToStorage = () => settingsManager.syncCurrentSettingsToStorage?.();

    console.log('✅ SettingsManager loaded');
  } catch (error) {
    console.error('❌ Failed to load SettingsManager:', error);
  }

  // ========== Stats Panel ==========
  try {
    const statsPanelMod = await import(withV('./modules/features/statsPanel.js'));

    if (statsPanelMod.setStatsPanelDependencies) {
      statsPanelMod.setStatsPanelDependencies({
        get AppState() { return window.AppState; },
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        loadMiniCycleData: () => window.loadMiniCycleData?.(),
        appInit
      });
    }

    const statsPanelManager = new statsPanelMod.StatsPanelManager();
    features.statsPanelManager = statsPanelManager;

    // Window exports
    window.statsPanelManager = statsPanelManager;
    window.showStatsPanel = () => statsPanelManager.showStatsPanel();
    window.showTaskView = () => statsPanelManager.showTaskView();
    window.updateStatsPanel = () => statsPanelManager.updateStatsPanel();

    console.log('✅ StatsPanel loaded');
  } catch (error) {
    console.error('❌ Failed to load StatsPanel:', error);
  }

  // ========== Modal Manager ==========
  try {
    const modalManagerMod = await import(withV('./modules/ui/modalManager.js'));

    if (modalManagerMod.setModalManagerDependencies) {
      modalManagerMod.setModalManagerDependencies({
        GlobalUtils
      });
    }

    const modalManager = modalManagerMod.modalManager || new modalManagerMod.default();
    features.modalManager = modalManager;

    // Window exports
    window.modalManager = modalManager;
    window.closeAllModals = () => modalManager?.closeAllModals?.();

    console.log('✅ ModalManager loaded');
  } catch (error) {
    console.error('❌ Failed to load ModalManager:', error);
  }

  // ========== Completed Tasks Manager ==========
  try {
    const completedTasksMod = await import(withV('./modules/ui/completedTasksManager.js'));

    if (completedTasksMod.setCompletedTasksManagerDependencies) {
      completedTasksMod.setCompletedTasksManagerDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils
      });
    }

    const completedTasksManager = completedTasksMod.completedTasksManager || new completedTasksMod.default();
    features.completedTasksManager = completedTasksManager;

    // Window exports
    window.completedTasksManager = completedTasksManager;
    window.initCompletedTasksSection = () => completedTasksManager.init?.();
    window.toggleCompletedTasksSection = () => completedTasksManager.toggle?.();
    window.moveTaskToCompleted = (el) => completedTasksManager.moveToCompleted?.(el);
    window.moveTaskToActive = (el) => completedTasksManager.moveToActive?.(el);
    window.organizeCompletedTasks = () => completedTasksManager.organize?.();

    console.log('✅ CompletedTasksManager loaded');
  } catch (error) {
    console.error('❌ Failed to load CompletedTasksManager:', error);
  }

  // ========== Undo/Redo Manager ==========
  try {
    const undoRedoMod = await import(withV('./modules/ui/undoRedoManager.js'));

    if (undoRedoMod.setUndoRedoManagerDependencies) {
      undoRedoMod.setUndoRedoManagerDependencies({
        get AppState() { return window.AppState; },
        AppGlobalState,
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        refreshUIFromState: () => window.refreshUIFromState?.()
      });
    }

    features.undoRedoManager = undoRedoMod;

    // Window exports
    window.captureStateSnapshot = undoRedoMod.captureStateSnapshot;
    window.performStateBasedUndo = undoRedoMod.performStateBasedUndo;
    window.performStateBasedRedo = undoRedoMod.performStateBasedRedo;
    window.updateUndoRedoButtons = undoRedoMod.updateUndoRedoButtons;
    window.enableUndoSystemOnFirstInteraction = undoRedoMod.enableUndoSystemOnFirstInteraction;

    console.log('✅ UndoRedoManager loaded');
  } catch (error) {
    console.error('❌ Failed to load UndoRedoManager:', error);
  }

  // ========== Help Window Manager ==========
  try {
    const helpWindowMod = await import(withV('./modules/ui/helpWindowManager.js'));

    if (helpWindowMod.setHelpWindowManagerDependencies) {
      helpWindowMod.setHelpWindowManagerDependencies({
        safeAddEventListener: GlobalUtils.safeAddEventListener
      });
    }

    const helpWindowManager = helpWindowMod.initHelpWindowManager?.() || new helpWindowMod.default();
    features.helpWindowManager = helpWindowManager;

    // Window exports
    window.helpWindowManager = helpWindowManager;

    console.log('✅ HelpWindowManager loaded');
  } catch (error) {
    console.error('❌ Failed to load HelpWindowManager:', error);
  }

  // ========== Onboarding Manager ==========
  try {
    const onboardingMod = await import(withV('./modules/ui/onboardingManager.js'));

    if (onboardingMod.setOnboardingManagerDependencies) {
      onboardingMod.setOnboardingManagerDependencies({
        AppMeta: window.AppMeta,
        get AppState() { return window.AppState; },
        get showCycleCreationModal() { return window.showCycleCreationModal; },
        // TODO: Add all required dependencies
      });
    }

    features.onboardingManager = onboardingMod.onboardingManager;

    // Window exports
    window.onboardingManager = onboardingMod.onboardingManager;

    console.log('✅ OnboardingManager loaded');
  } catch (error) {
    console.error('❌ Failed to load OnboardingManager:', error);
  }

  // ========== Menu Manager ==========
  try {
    const menuManagerMod = await import(withV('./modules/ui/menuManager.js'));

    if (menuManagerMod.setMenuManagerDependencies) {
      menuManagerMod.setMenuManagerDependencies({
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        // TODO: Add all required dependencies
      });
    }

    features.menuManager = menuManagerMod.menuManager;

    // Window exports
    window.MenuManager = menuManagerMod.default;
    window.menuManager = menuManagerMod.menuManager;
    window.hideMainMenu = menuManagerMod.hideMainMenu;
    window.updateMainMenuHeader = menuManagerMod.updateMainMenuHeader;

    console.log('✅ MenuManager loaded');
  } catch (error) {
    console.error('❌ Failed to load MenuManager:', error);
  }

  // ============================================================================
  // PHASE 8: Additional Features
  // ============================================================================

  // ========== Due Dates ==========
  try {
    const dueDatesMod = await import(withV('./modules/features/dueDates.js'));

    if (dueDatesMod.setDueDatesDependencies) {
      dueDatesMod.setDueDatesDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        // TODO: Add all required dependencies
      });
    }

    features.dueDatesManager = dueDatesMod.dueDatesManager;

    // Window exports
    window.dueDatesManager = dueDatesMod.dueDatesManager;
    window.checkOverdueTasks = dueDatesMod.checkOverdueTasks;
    window.remindOverdueTasks = dueDatesMod.remindOverdueTasks;
    window.updateDueDateVisibility = dueDatesMod.updateDueDateVisibility;

    console.log('✅ DueDates loaded');
  } catch (error) {
    console.error('❌ Failed to load DueDates:', error);
  }

  // ========== Reminders ==========
  try {
    const remindersMod = await import(withV('./modules/features/reminders.js'));

    if (remindersMod.setRemindersDependencies) {
      remindersMod.setRemindersDependencies({
        get AppState() { return window.AppState; },
        GlobalUtils,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        // TODO: Add all required dependencies
      });
    }

    features.reminderManager = remindersMod.reminderManager;

    // Window exports
    window.reminderManager = remindersMod.reminderManager;
    window.startReminders = remindersMod.startReminders;
    window.stopReminders = remindersMod.stopReminders;
    window.loadRemindersSettings = remindersMod.loadRemindersSettings;
    window.updateReminderButtons = remindersMod.updateReminderButtons;

    console.log('✅ Reminders loaded');
  } catch (error) {
    console.error('❌ Failed to load Reminders:', error);
  }

  // ========== Device Detection ==========
  try {
    const deviceDetectionMod = await import(withV('./modules/utils/deviceDetection.js'));

    if (deviceDetectionMod.setDeviceDetectionDependencies) {
      deviceDetectionMod.setDeviceDetectionDependencies({
        AppMeta: window.AppMeta
      });
    }

    features.deviceDetectionManager = deviceDetectionMod.deviceDetectionManager;

    // Window exports
    window.deviceDetectionManager = deviceDetectionMod.deviceDetectionManager;

    console.log('✅ DeviceDetection loaded');
  } catch (error) {
    console.error('❌ Failed to load DeviceDetection:', error);
  }

  // ========== Backup Manager ==========
  try {
    const backupManagerMod = await import(withV('./modules/storage/backupManager.js'));

    if (backupManagerMod.setBackupManagerDependencies) {
      backupManagerMod.setBackupManagerDependencies({
        get AppState() { return window.AppState; }
      });
    }

    features.backupManager = backupManagerMod.default;

    // Window exports
    window.BackupManager = backupManagerMod.default;

    console.log('✅ BackupManager loaded');
  } catch (error) {
    console.error('❌ Failed to load BackupManager:', error);
  }

  // ============================================================================
  // PHASE 9: Testing (Optional - loads only if debug mode or testing modal present)
  // ============================================================================

  try {
    const testingModalMod = await import(withV('./modules/testing/testing-modal.js'));

    if (testingModalMod.openStorageViewer) window.openStorageViewer = testingModalMod.openStorageViewer;
    if (testingModalMod.closeStorageViewer) window.closeStorageViewer = testingModalMod.closeStorageViewer;
    if (testingModalMod.appendToTestResults) window.appendToTestResults = testingModalMod.appendToTestResults;
    if (testingModalMod.setupTestingModal) window.setupTestingModal = testingModalMod.setupTestingModal;

    console.log('✅ Testing modal loaded');
  } catch (error) {
    console.warn('⚠️ Testing modal not loaded (optional):', error.message);
  }

  // ============================================================================
  // COMPLETE
  // ============================================================================

  console.log('✅ Feature boot complete');
  console.log(`📦 Loaded ${Object.keys(features).length} feature modules`);

  return features;
}
