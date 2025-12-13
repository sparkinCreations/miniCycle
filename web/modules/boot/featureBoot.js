/**
 * ============================================================================
 * featureBoot.js - Feature Module DI Wiring
 * ============================================================================
 * Location: modules/boot/featureBoot.js
 *
 * This file handles ALL feature module loading and dependency injection.
 * It minimizes window.* exposures - modules communicate via deps container.
 *
 * RESPONSIBILITIES:
 * - Import all feature modules with cache-busting
 * - Call set*Dependencies() for each module
 * - Initialize module instances
 * - Return features object for main script
 *
 * WINDOW.* EXPOSURES (for backward compatibility):
 * - 131 window.* assignments for Phase 3 compatibility
 * - See "WINDOW.* EXPOSURES" section at end of bootFeatures()
 *
 * IMPORT RULES:
 * - This file imports from coreBoot.js
 * - This file must NOT import from uiBoot.js
 *
 * @module app-featureBoot
 * @version 1.0.0
 */

/**
 * Boot all feature modules with proper DI wiring
 *
 * @param {Object} deps - Dependency container from main script
 * @param {Object} coreResult - Results from coreBoot.js initCoreBoot()
 * @returns {Object} Initialized feature module references
 */
export async function bootFeatures(deps, coreResult) {
  const {
    AppGlobalState,
    FeatureFlags,
    GlobalUtils,
    appInit,
    setAppInitDependencies,
    migrationMod,
    withV,
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS,
    TASK_LIMIT,
    UNDO_LIMIT,
    UNDO_MIN_INTERVAL_MS
  } = coreResult;

  console.log('🚀 app-featureBoot: Starting feature module loading...');

  // Container for initialized modules
  const features = {
    managers: {},
    modules: {},
    apis: {}
  };

  // ============================================================================
  // PHASE 1: CORE UTILITIES (no dependencies on other features)
  // ============================================================================
  console.log('🔧 Phase 1: Loading core utilities...');

  // ========== Error Handler ==========
  try {
    const errorHandlerMod = await import(withV('../utils/errorHandler.js'));
    deps.utils.setErrorHandlerDependencies = errorHandlerMod.setErrorHandlerDependencies;
    features.modules.errorHandler = errorHandlerMod;
    console.log('✅ ErrorHandler loaded');
  } catch (error) {
    console.error('❌ Failed to load ErrorHandler:', error);
  }

  // ========== Data Validator ==========
  try {
    const dataValidatorMod = await import(withV('../utils/dataValidator.js'));
    dataValidatorMod.setDataValidatorDependencies({
      sanitizeInput: deps.utils.sanitizeInput
    });
    deps.utils.DataValidator = dataValidatorMod.DataValidator;
    features.modules.dataValidator = dataValidatorMod;
    console.log('✅ DataValidator loaded');
  } catch (error) {
    console.error('❌ Failed to load DataValidator:', error);
  }

  // ========== Console Capture ==========
  try {
    const consoleCaptureMod = await import(withV('../utils/consoleCapture.js'));
    if (consoleCaptureMod.setConsoleCaptureDependencies) {
      consoleCaptureMod.setConsoleCaptureDependencies({
        showNotification: () => deps.utils.showNotification,
        get appendToTestResults() { return deps.utils.appendToTestResults; }
      });
    }
    deps.utils.consoleCapture = consoleCaptureMod.default;
    features.modules.consoleCapture = consoleCaptureMod;
    console.log('✅ ConsoleCapture loaded');
  } catch (error) {
    console.error('❌ Failed to load ConsoleCapture:', error);
  }

  // ========== Notifications ==========
  try {
    const notificationsMod = await import(withV('../utils/notifications.js'));

    notificationsMod.setNotificationsDependencies({
      AppState: null, // Set later after AppState is created
      appInit: appInit,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      generateHashId: (...args) => deps.utils.generateHashId?.(...args),
      GlobalUtils: GlobalUtils,
      escapeHtml: (...args) => deps.utils.escapeHtml?.(...args),
      safeAddEventListener: GlobalUtils.safeAddEventListener
    });

    const notifications = new notificationsMod.MiniCycleNotifications();

    // Store in deps container
    deps.utils.notifications = notifications;
    deps.utils.showNotification = (message, type, duration) => notifications.show(message, type, duration);
    deps.utils.showNotificationWithTip = (content, type, duration, tipId) => notifications.showWithTip(content, type, duration, tipId);
    deps.utils.showApplyConfirmation = (targetElement) => notifications.showApplyConfirmation(targetElement);
    deps.utils.showConfirmationModal = (options) => notifications.showConfirmationModal(options);
    deps.utils.showPromptModal = (options) => notifications.showPromptModal(options);
    deps.utils.setupNotificationDragging = (container) => notifications.setupNotificationDragging(container);
    deps.utils.resetNotificationPosition = () => notifications.resetPosition();
    deps.utils.setNotificationsDependencies = notificationsMod.setNotificationsDependencies;

    features.managers.notifications = notifications;
    features.modules.notifications = notificationsMod;
    console.log('✅ Notifications loaded');

    // Show deferred cache notification if needed
    if (AppGlobalState.pendingCacheNotification) {
      notifications.show('App updated! Cache refreshed automatically.', 'info', 4000);
      AppGlobalState.pendingCacheNotification = false;
    }
  } catch (error) {
    console.error('❌ Failed to load Notifications:', error);
  }

  // ========== Wire ErrorHandler (needs showNotification) ==========
  if (deps.utils.setErrorHandlerDependencies) {
    deps.utils.setErrorHandlerDependencies({
      showNotification: deps.utils.showNotification
    });
  }

  // ========== Wire GlobalUtils (needs showNotification) ==========
  if (deps.utils.setGlobalUtilsDependencies) {
    deps.utils.setGlobalUtilsDependencies({
      showNotification: deps.utils.showNotification
    });
  }

  // ============================================================================
  // PHASE 2: THEME & VISUAL FEATURES
  // ============================================================================
  console.log('🎨 Phase 2: Loading theme & visual features...');

  // ========== Theme Manager ==========
  let themeManagerMod = null;
  try {
    themeManagerMod = await import(withV('../features/themeManager.js'));
    if (themeManagerMod.setThemeManagerDependencies) {
      themeManagerMod.setThemeManagerDependencies({
        appInit: appInit,
        showNotification: deps.utils.showNotification
        // AppState and hideMainMenu injected later
      });
    }
    deps.features.themeManager = themeManagerMod.themeManager;
    deps.features.applyTheme = themeManagerMod.applyTheme;
    deps.features.updateThemeColor = themeManagerMod.updateThemeColor;
    deps.features.setupDarkModeToggle = themeManagerMod.setupDarkModeToggle;
    deps.features.setupQuickDarkToggle = themeManagerMod.setupQuickDarkToggle;
    deps.features.unlockDarkOceanTheme = themeManagerMod.unlockDarkOceanTheme;
    deps.features.unlockGoldenGlowTheme = themeManagerMod.unlockGoldenGlowTheme;
    deps.features.initializeThemesPanel = themeManagerMod.initializeThemesPanel;
    deps.features.refreshThemeToggles = themeManagerMod.refreshThemeToggles;
    deps.features.setupThemesPanel = themeManagerMod.setupThemesPanel;
    deps.features.setupThemesPanelWithData = themeManagerMod.setupThemesPanelWithData;
    features.modules.themeManager = themeManagerMod;
    console.log('✅ ThemeManager loaded');
  } catch (error) {
    console.error('❌ Failed to load ThemeManager:', error);
  }

  // ========== Games Manager ==========
  try {
    const gamesManagerMod = await import(withV('../ui/gamesManager.js'));
    if (gamesManagerMod.setGamesManagerDependencies) {
      gamesManagerMod.setGamesManagerDependencies({
        appInit: appInit,
        AppMeta: deps.core.AppMeta,
        get AppState() { return deps.core.AppState; },
        safeAddEventListener: deps.utils.safeAddEventListener
      });
    }
    deps.ui.gamesManager = gamesManagerMod.gamesManager;
    deps.ui.unlockMiniGame = (...args) => gamesManagerMod.gamesManager?.unlockMiniGame?.(...args);
    deps.ui.checkGamesUnlock = (...args) => gamesManagerMod.gamesManager?.checkGamesUnlock?.(...args);
    features.managers.gamesManager = gamesManagerMod.gamesManager;
    // Initialize (waits for core internally)
    gamesManagerMod.gamesManager.init();
    console.log('✅ GamesManager loaded');
  } catch (error) {
    console.error('❌ Failed to load GamesManager:', error);
  }

  // ========== Onboarding Manager ==========
  try {
    const onboardingManagerMod = await import(withV('../ui/onboardingManager.js'));
    if (onboardingManagerMod.setOnboardingManagerDependencies) {
      onboardingManagerMod.setOnboardingManagerDependencies({
        appInit: appInit,
        AppMeta: deps.core.AppMeta,
        showNotification: deps.utils.showNotification,
        get AppState() { return deps.core.AppState; },
        get showCycleCreationModal() { return deps.cycle.showCycleCreationModal; },
        get completeInitialSetup() { return window.completeInitialSetup; },
        get safeAddEventListenerById() { return GlobalUtils.safeAddEventListenerById; }
      });
    }
    deps.ui.onboardingManager = onboardingManagerMod.onboardingManager;
    features.managers.onboardingManager = onboardingManagerMod.onboardingManager;
    // Initialize (waits for core internally)
    onboardingManagerMod.onboardingManager.init();
    console.log('✅ OnboardingManager loaded');
  } catch (error) {
    console.error('❌ Failed to load OnboardingManager:', error);
  }

  // ========== Modal Manager (module load only, init later) ==========
  let modalManagerMod = null;
  try {
    modalManagerMod = await import(withV('../ui/modalManager.js'));
    features.modules.modalManager = modalManagerMod;
    console.log('✅ ModalManager module loaded (awaiting initialization)');
  } catch (error) {
    console.error('❌ Failed to load ModalManager:', error);
  }

  // ============================================================================
  // APPSTATE CHECK (may already be initialized by main script)
  // ============================================================================
  // Note: When integrating incrementally, initAppState may have already been
  // called by miniCycle-scripts.js before bootFeatures is called.
  // We check if AppState is ready to avoid duplicate initialization.
  const { initAppState } = coreResult;
  if (!deps.core.AppState?.isReady?.()) {
    console.log('🗃️ Initializing AppState...');
    await initAppState(deps, deps.utils.showNotification);
    console.log('✅ AppState initialized');
  } else {
    console.log('✅ AppState already initialized (skipping)');
  }

  // Update notifications with AppState
  if (deps.utils.setNotificationsDependencies) {
    deps.utils.setNotificationsDependencies({
      AppState: deps.core.AppState
    });
  }

  // ============================================================================
  // PHASE 3: TASK MANAGEMENT MODULES
  // ============================================================================
  console.log('📋 Phase 3: Loading task management modules...');

  // ✅ Expose GlobalUtils.syncAllTasksWithMode to deps.task for mode switching
  deps.task.syncAllTasksWithMode = (mode, tasksDataMap, opts) =>
    GlobalUtils.syncAllTasksWithMode(mode, tasksDataMap, opts);

  // ========== Drag & Drop Manager ==========
  try {
    const dragDropMod = await import(withV('../task/dragDropManager.js'));
    const { initDragDropManager, enableDragAndDropOnTask, updateMoveArrowsVisibility, toggleArrowVisibility, updateArrowsInDOM } = dragDropMod;

    deps.task.updateMoveArrowsVisibility = updateMoveArrowsVisibility;
    deps.task.toggleArrowVisibility = toggleArrowVisibility;
    deps.task.updateArrowsInDOM = updateArrowsInDOM;
    deps.task.enableDragAndDropOnTask = enableDragAndDropOnTask;

    const dragDropManager = await initDragDropManager({
      appInit: appInit,
      AppState: deps.core.AppState,
      AppMeta: deps.core.AppMeta,
      saveCurrentTaskOrder: () => deps.task.saveCurrentTaskOrder?.(),
      autoSave: () => deps.core.autoSave?.(),
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      updateStatsPanel: () => deps.ui.updateStatsPanel?.(),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      updateUndoRedoButtons: () => deps.ui.updateUndoRedoButtons?.(),
      captureStateSnapshot: (state) => deps.ui.captureStateSnapshot?.(state),
      refreshUIFromState: () => deps.task.refreshUIFromState?.(),
      revealTaskButtons: (task) => deps.task.revealTaskButtons?.(task),
      hideTaskButtons: (task) => deps.task.hideTaskButtons?.(task),
      isTouchDevice: () => deps.utils.isTouchDevice?.() || false,
      enableUndoSystemOnFirstInteraction: () => deps.ui.enableUndoSystemOnFirstInteraction?.(),
      showNotification: deps.utils.showNotification,
      safeAddEventListener: deps.utils.safeAddEventListener
    });

    deps.task.dragDropManager = dragDropManager;
    features.managers.dragDropManager = dragDropManager;
    console.log('✅ DragDropManager initialized');
  } catch (error) {
    console.error('❌ Failed to load DragDropManager:', error);
  }

  // ========== Device Detection ==========
  try {
    const { DeviceDetectionManager, setDeviceDetectionDependencies } = await import(withV('../utils/deviceDetection.js'));

    setDeviceDetectionDependencies({
      appInit: appInit,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      showNotification: deps.utils.showNotification,
      get AppState() { return deps.core.AppState; },
      AppMeta: deps.core.AppMeta
    });

    const deviceDetectionManager = new DeviceDetectionManager();
    deps.utils.deviceDetectionManager = deviceDetectionManager;
    features.managers.deviceDetectionManager = deviceDetectionManager;
    console.log('✅ DeviceDetectionManager initialized');
  } catch (error) {
    console.error('❌ Failed to load DeviceDetectionManager:', error);
  }

  // ========== Stats Panel ==========
  try {
    const { StatsPanelManager, setStatsPanelDependencies } = await import(withV('../features/statsPanel.js'));

    setStatsPanelDependencies({
      showNotification: deps.utils.showNotification,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      isOverlayActive: () => deps.ui.isOverlayActive?.() || false,
      isDraggingNotification: () => deps.utils.isDraggingNotification || false,
      updateThemeColor: () => deps.features.updateThemeColor?.(),
      hideMainMenu: () => deps.ui.hideMainMenu?.(),
      setupDarkModeToggle: (id, syncIds) => deps.features.setupDarkModeToggle?.(id, syncIds),
      get AppState() { return deps.core.AppState; },
      appInit: appInit,
      AppMeta: deps.core.AppMeta,
      safeAddEventListener: GlobalUtils.safeAddEventListener
    });

    const statsPanelManager = new StatsPanelManager();
    deps.ui.statsPanelManager = statsPanelManager;
    deps.ui.showStatsPanel = () => statsPanelManager.showStatsPanel();
    deps.ui.showTaskView = () => statsPanelManager.showTaskView();
    deps.ui.updateStatsPanel = () => statsPanelManager.updateStatsPanel();
    features.managers.statsPanelManager = statsPanelManager;
    console.log('✅ StatsPanelManager initialized');
  } catch (error) {
    console.error('❌ Failed to load StatsPanelManager:', error);
  }

  // ========== Task DOM Manager ==========
  try {
    const taskDOMMod = await import(withV('../task/taskDOM.js'));
    const {
      initTaskDOMManager,
      setTaskDOMManagerDependencies,
      extractTaskDataFromDOM,
      createTaskDOMElements,
      createThreeDotsButton,
      setupTaskInteractions,
      setupRecurringButtonHandler,
      finalizeTaskCreation,
      loadTaskContext,
      validateAndSanitizeTaskInput,
      handleTaskButtonClick,
      revealTaskButtons,
      refreshUIFromState
    } = taskDOMMod;

    setTaskDOMManagerDependencies({
      appInit: appInit,
      AppState: deps.core.AppState,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      generateId: deps.utils.generateId
    });

    // Store functions in deps
    deps.task.extractTaskDataFromDOM = extractTaskDataFromDOM;
    deps.task.createTaskDOMElements = createTaskDOMElements;
    deps.task.createThreeDotsButton = createThreeDotsButton;
    deps.task.setupTaskInteractions = setupTaskInteractions;
    deps.task.setupRecurringButtonHandler = setupRecurringButtonHandler;
    deps.task.finalizeTaskCreation = finalizeTaskCreation;
    deps.task.loadTaskContext = loadTaskContext;
    deps.task.validateAndSanitizeTaskInput = validateAndSanitizeTaskInput;
    deps.task.handleTaskButtonClick = handleTaskButtonClick;
    deps.task.revealTaskButtons = revealTaskButtons;
    deps.task.refreshUIFromState = refreshUIFromState;

    const taskDOMManager = await initTaskDOMManager({
      AppState: deps.core.AppState,
      AppMeta: deps.core.AppMeta,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      sanitizeInput: deps.utils.sanitizeInput,
      generateId: deps.utils.generateId,
      autoSave: () => deps.core.autoSave?.(),
      showNotification: deps.utils.showNotification,
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      updateStatsPanel: () => deps.ui.updateStatsPanel?.(),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      refreshUIFromState: () => deps.task.refreshUIFromState?.(),
      updateMainMenuHeader: () => deps.ui.updateMainMenuHeader?.(),
      updateRecurringPanelButtonVisibility: () => deps.recurring.updateRecurringPanelButtonVisibility?.(),
      triggerLogoBackground: (type, dur) => deps.ui.triggerLogoBackground?.(type, dur),
      getElementById: (id) => document.getElementById(id),
      querySelector: (sel) => document.querySelector(sel),
      querySelectorAll: (sel) => document.querySelectorAll(sel),
      safeAddEventListener: deps.utils.safeAddEventListener,
      GlobalUtils: GlobalUtils,
      handleTaskCompletionChange: (taskItem, shouldSave) => deps.task.handleTaskCompletionChange?.(taskItem, shouldSave),
      addTask: (...args) => deps.task.addTask?.(...args),
      createDueDateInput: (taskContext, taskData) => deps.features.createDueDateInput?.(taskContext, taskData),
      setupDueDateButtonInteraction: (input, taskContext) => deps.features.setupDueDateButtonInteraction?.(input, taskContext),
      checkOverdueTasks: () => deps.features.checkOverdueTasks?.(),
      remindOverdueTasks: () => deps.features.remindOverdueTasks?.(),
      recurringPanel: { get current() { return deps.recurring.panel; } },
      // ✅ Don't inject setupRecurringButtonHandler - let taskDOM use its internal method
      // (deps.recurring.setupRecurringButtonHandler was never defined)
      handleRecurringTaskActivation: (taskItem, task, recurringBtn) => deps.recurring.handleActivation?.(taskItem, task, recurringBtn),
      handleRecurringTaskDeactivation: (taskItem, task, recurringBtn) => deps.recurring.handleDeactivation?.(taskItem, task, recurringBtn),
      setupReminderButtonHandler: (btn, ctx) => deps.features.setupReminderButtonHandler?.(btn, ctx),
      enableUndoSystemOnFirstInteraction: () => deps.ui.enableUndoSystemOnFirstInteraction?.(),
      updateUndoRedoButtons: () => deps.ui.updateUndoRedoButtons?.(),
      showTaskOptions: (taskItem) => deps.ui.showTaskOptions?.(taskItem),
      hideTaskOptions: (taskItem) => deps.ui.hideTaskOptions?.(taskItem),
      attachKeyboardTaskOptionToggle: (taskItem, threeDotsBtn) => deps.ui.attachKeyboardTaskOptionToggle?.(taskItem, threeDotsBtn),
      revealTaskButtons: (taskItem) => deps.task.revealTaskButtons?.(taskItem),
      handleTaskButtonClick: (event) => deps.task.handleTaskButtonClick?.(event),
      DragAndDrop: deps.task.DragAndDrop,
      enableDragAndDropOnTask: deps.task.enableDragAndDropOnTask,
      updateArrowsInDOM: deps.task.updateArrowsInDOM,
      updateMoveArrowsVisibility: deps.task.updateMoveArrowsVisibility,
      checkMiniCycle: () => deps.progress.checkMiniCycle?.(),
      loadMiniCycle: () => deps.cycle.loadMiniCycle?.(),
      DEFAULT_TASK_OPTION_BUTTONS: deps.utils.DEFAULT_TASK_OPTION_BUTTONS
    });

    deps.task.taskDOMManager = taskDOMManager;
    deps.task.taskEvents = taskDOMManager.events;
    features.managers.taskDOMManager = taskDOMManager;
    console.log('✅ TaskDOMManager initialized');
  } catch (error) {
    console.error('❌ CRITICAL: Failed to initialize TaskDOMManager:', error);
    throw new Error('TaskDOM initialization failed - cannot render tasks');
  }

  // ========== Task Options Customizer ==========
  try {
    const { initTaskOptionsCustomizer, TaskOptionsCustomizer, setTaskOptionsCustomizerDependencies } = await import(withV('../ui/taskOptionsCustomizer.js'));

    setTaskOptionsCustomizerDependencies({
      appInit: appInit,
      get AppState() { return deps.core.AppState; },
      showNotification: deps.utils.showNotification,
      renderTaskList: () => deps.task.refreshTaskListUI?.(),
      updateMoveArrowsVisibility: () => deps.task.updateMoveArrowsVisibility?.(),
      startReminders: () => deps.features.startReminders?.(),
      stopReminders: () => deps.features.stopReminders?.(),
      get modeManager() { return deps.cycle.modeManager; },
      get DEFAULT_TASK_OPTION_BUTTONS() { return deps.utils.DEFAULT_TASK_OPTION_BUTTONS; }
    });

    const taskOptionsCustomizer = await initTaskOptionsCustomizer();
    deps.ui.taskOptionsCustomizer = taskOptionsCustomizer;
    features.managers.taskOptionsCustomizer = taskOptionsCustomizer;

    // Inject into TaskDOMManager
    if (deps.task.taskDOMManager) {
      deps.task.taskDOMManager.injectDependency('taskOptionsCustomizer', taskOptionsCustomizer);
    }
    console.log('✅ TaskOptionsCustomizer initialized');
  } catch (error) {
    console.error('❌ Failed to initialize TaskOptionsCustomizer:', error);
  }

  // ========== Reminders Module ==========
  try {
    const { initReminderManager, setRemindersDependencies } = await import(withV('../features/reminders.js'));

    setRemindersDependencies({
      appInit: appInit,
      showNotification: deps.utils.showNotification,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      updateUndoRedoButtons: () => deps.ui.updateUndoRedoButtons?.(),
      autoSave: () => deps.core.autoSave?.(),
      get AppState() { return deps.core.AppState; },
      get refreshTaskListUI() { return deps.task.refreshTaskListUI; },
      get AppGlobalState() { return AppGlobalState; },
      AppMeta: deps.core.AppMeta
    });

    const reminderManager = await initReminderManager({
      getElementById: (id) => document.getElementById(id),
      querySelectorAll: (selector) => document.querySelectorAll(selector),
      safeAddEventListener: GlobalUtils.safeAddEventListener
    });

    deps.features.reminderManager = reminderManager;
    deps.features.startReminders = () => reminderManager.startReminders();
    deps.features.stopReminders = () => reminderManager.stopReminders();
    deps.features.handleReminderToggle = () => reminderManager.handleReminderToggle();
    deps.features.autoSaveReminders = () => reminderManager.autoSaveReminders();
    deps.features.loadRemindersSettings = () => reminderManager.loadRemindersSettings();
    deps.features.saveTaskReminderState = (taskId, isEnabled) => reminderManager.saveTaskReminderState(taskId, isEnabled);
    deps.features.updateReminderButtons = () => reminderManager.updateReminderButtons();
    deps.features.setupReminderButtonHandler = (button, taskContext) => reminderManager.setupReminderButtonHandler(button, taskContext);
    features.managers.reminderManager = reminderManager;
    console.log('✅ ReminderManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize ReminderManager:', error);
  }

  // ============================================================================
  // PHASE 4: RECURRING MODULES
  // ============================================================================
  console.log('🔄 Phase 4: Loading recurring modules...');

  try {
    const { initializeRecurringModules, setRecurringIntegrationDependencies, testRecurringIntegration } = await import(withV('../recurring/recurringIntegration.js'));

    setRecurringIntegrationDependencies({
      appInit: appInit,
      AppState: deps.core.AppState,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      showNotification: deps.utils.showNotification,
      showNotificationWithTip: deps.utils.showNotificationWithTip,
      refreshUIFromState: () => deps.task.refreshUIFromState?.(),
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      FeatureFlags: FeatureFlags,
      notifications: deps.utils.notifications,
      isOverlayActive: () => deps.ui.isOverlayActive?.(),
      getDeferredRecurringSetup: () => deps.recurring._deferredSetup || [],
      clearDeferredRecurringSetup: () => { delete deps.recurring._deferredSetup; },
      GlobalUtils: GlobalUtils,
      escapeHtml: (...args) => deps.utils.escapeHtml?.(...args),
      syncRecurringStateToDOM: (...args) => deps.recurring.syncRecurringStateToDOM?.(...args),
      refreshTaskButtonsForModeChange: () => deps.cycle.refreshTaskButtonsForModeChange?.()
    });

    const recurringModules = await initializeRecurringModules({ AppMeta: deps.core.AppMeta });

    // Store in deps
    deps.recurring.modules = recurringModules;
    deps.recurring.core = recurringModules.coreAPI;
    deps.recurring.panel = recurringModules.panelAPI;
    deps.recurring.openForTask = (taskId) => recurringModules.panelAPI.openForTask(taskId);
    deps.recurring.updateButtonVisibility = () => recurringModules.panelAPI.updateButtonVisibility();
    deps.recurring.handleActivation = (task, taskContext, button) => recurringModules.coreAPI.handleActivation(task, taskContext, button);
    deps.recurring.handleDeactivation = (task, taskContext, assignedTaskId) => recurringModules.coreAPI.handleDeactivation(task, taskContext, assignedTaskId);
    deps.recurring.applyRecurringSettings = (...args) => recurringModules.coreAPI.applyRecurringSettings(...args);
    deps.recurring.removeTasksFromCycle = (taskElements, cycleData) => recurringModules.coreAPI.removeTasksFromCycle(taskElements, cycleData);

    // Update notifications with recurring deps
    if (deps.utils.setNotificationsDependencies) {
      deps.utils.setNotificationsDependencies({
        applyRecurringToTaskSchema25: deps.recurring.applyRecurringSettings,
        updateRecurringPanel: () => recurringModules.panelAPI.updatePanel(),
        openRecurringSettingsPanelForTask: deps.recurring.openForTask
      });
    }

    features.apis.recurring = recurringModules;
    features.modules.recurringIntegration = { testRecurringIntegration };
    console.log('✅ Recurring modules initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Recurring modules:', error);
  }

  // ========== Due Dates Module ==========
  try {
    const { initDueDatesManager } = await import(withV('../features/dueDates.js'));

    const dueDatesManager = await initDueDatesManager({
      appInit: appInit,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      showNotification: deps.utils.showNotification,
      updateStatsPanel: () => deps.ui.updateStatsPanel?.(),
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      saveTaskToSchema25: (cycleId, cycleData) => deps.task.saveTaskToSchema25?.(cycleId, cycleData),
      getElementById: (id) => document.getElementById(id),
      querySelectorAll: (selector) => document.querySelectorAll(selector),
      safeAddEventListener: GlobalUtils.safeAddEventListener,
      AppState: () => deps.core.AppState,
      AppMeta: deps.core.AppMeta
    });

    deps.features.dueDatesManager = dueDatesManager;
    deps.features.saveTaskDueDate = (taskId, newDueDate) => dueDatesManager.saveTaskDueDate(taskId, newDueDate);
    deps.features.checkOverdueTasks = (taskToCheck) => dueDatesManager.checkOverdueTasks(taskToCheck);
    deps.features.createDueDateInput = (assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle) =>
      dueDatesManager.createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle);
    deps.features.setupDueDateButtonInteraction = (buttonContainer, dueDateInput) =>
      dueDatesManager.setupDueDateButtonInteraction(buttonContainer, dueDateInput);
    deps.features.updateDueDateVisibility = (autoReset) => dueDatesManager.updateDueDateVisibility(autoReset);
    deps.features.remindOverdueTasks = () => dueDatesManager.remindOverdueTasks();
    features.managers.dueDatesManager = dueDatesManager;
    console.log('✅ DueDatesManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize DueDatesManager:', error);
  }

  // ============================================================================
  // PHASE 5: CYCLE MANAGEMENT MODULES
  // ============================================================================
  console.log('🔄 Phase 5: Loading cycle management modules...');

  // ========== Mode Manager ==========
  try {
    const { initModeManager } = await import(withV('../cycle/modeManager.js'));

    const modeManager = await initModeManager({
      appInit: appInit,
      getAppState: () => deps.core.AppState,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      createTaskButtonContainer: (ctx) => deps.task.createTaskButtonContainer?.(ctx),
      setupDueDateButtonInteraction: (btn, input) => deps.features.setupDueDateButtonInteraction?.(btn, input),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      showNotification: deps.utils.showNotification,
      helpWindowManager: () => deps.ui.helpWindowManager,
      getElementById: (id) => document.getElementById(id),
      querySelectorAll: (sel) => document.querySelectorAll(sel),
      AppMeta: deps.core.AppMeta,
      get recurringCore() { return deps.recurring.core; },
      checkMiniCycle: () => deps.progress.checkMiniCycle?.(),
      refreshTaskListUI: () => deps.task.refreshTaskListUI?.(),
      updateRecurringButtonVisibility: () => deps.recurring.updateButtonVisibility?.(),
      syncAllTasksWithMode: (mode, tasksDataMap, opts) => deps.task.syncAllTasksWithMode?.(mode, tasksDataMap, opts),
      DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
    });

    deps.cycle.modeManager = modeManager;
    deps.cycle.initializeModeSelector = () => modeManager.init();
    deps.cycle.setupModeSelector = () => modeManager.setupModeSelector();
    deps.cycle.syncModeFromToggles = () => modeManager.syncModeFromToggles();
    deps.cycle.updateStorageFromToggles = () => modeManager.updateStorageFromToggles();
    deps.cycle.refreshTaskButtonsForModeChange = () => modeManager.refreshTaskButtonsForModeChange();
    deps.cycle.updateCycleModeDescription = () => modeManager.updateCycleModeDescription();
    deps.cycle.getModeName = (mode) => modeManager.getModeName(mode);
    deps.cycle.saveToggleAutoReset = () => modeManager.setupToggleAutoReset();
    deps.cycle.setupDeleteCheckedTasksModeListener = () => modeManager.setupDeleteCheckedTasksModeListener(); // ✅ Visual indicator sync
    features.managers.modeManager = modeManager;
    console.log('✅ ModeManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize ModeManager:', error);
  }

  // ========== Cycle Switcher ==========
  try {
    const { initializeCycleSwitcher, switchMiniCycle, renameMiniCycle, deleteMiniCycle } = await import(withV('../cycle/cycleSwitcher.js'));

    const cycleSwitcher = await initializeCycleSwitcher({
      AppState: deps.core.AppState,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      showNotification: deps.utils.showNotification,
      hideMainMenu: () => deps.ui.hideMainMenu?.(),
      showPromptModal: (opts) => deps.utils.showPromptModal?.(opts),
      showConfirmationModal: (opts) => deps.utils.showConfirmationModal?.(opts),
      sanitizeInput: (text) => GlobalUtils.sanitizeInput(text),
      loadMiniCycle: () => deps.cycle.loadMiniCycle?.(),
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      updateStatsPanel: () => deps.ui.updateStatsPanel?.(),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      updateReminderButtons: () => deps.features.updateReminderButtons?.(),
      updateUndoRedoButtons: () => deps.ui.updateUndoRedoButtons?.(),
      initialSetup: () => appInit.runInitialSetup(),
      getElementById: (id) => document.getElementById(id),
      querySelector: (sel) => document.querySelector(sel),
      querySelectorAll: (sel) => document.querySelectorAll(sel),
      AppMeta: deps.core.AppMeta,
      onCycleRenamed: (...args) => deps.ui.onCycleRenamed?.(...args),
      onCycleDeleted: (...args) => deps.ui.onCycleDeleted?.(...args),
      onCycleSwitched: (...args) => deps.ui.onCycleSwitched?.(...args)
    });

    deps.cycle.cycleSwitcher = cycleSwitcher;
    deps.cycle.switchMiniCycle = switchMiniCycle;
    deps.cycle.renameMiniCycle = renameMiniCycle;
    deps.cycle.deleteMiniCycle = deleteMiniCycle;
    features.managers.cycleSwitcher = cycleSwitcher;
    console.log('✅ CycleSwitcher initialized');
  } catch (error) {
    console.error('❌ Failed to initialize CycleSwitcher:', error);
  }

  // ========== Cycle Manager ==========
  try {
    const { initializeCycleManager } = await import(withV('../cycle/cycleManager.js'));

    const cycleManager = await initializeCycleManager({
      AppState: deps.core.AppState,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      showPromptModal: (opts) => deps.utils.showPromptModal?.(opts),
      showNotification: deps.utils.showNotification,
      sanitizeInput: (text) => GlobalUtils.sanitizeInput(text),
      completeInitialSetup: (id, data) => window.completeInitialSetup?.(id, data),
      hideMainMenu: () => deps.ui.hideMainMenu?.(),
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      autoSave: () => deps.core.autoSave?.(),
      getElementById: (id) => document.getElementById(id),
      querySelector: (sel) => document.querySelector(sel),
      querySelectorAll: (sel) => document.querySelectorAll(sel),
      safeLocalStorageGet: GlobalUtils.safeLocalStorageGet,
      safeLocalStorageSet: GlobalUtils.safeLocalStorageSet,
      safeJSONParse: GlobalUtils.safeJSONParse,
      safeJSONStringify: GlobalUtils.safeJSONStringify,
      DEFAULT_TASK_OPTION_BUTTONS: deps.utils.DEFAULT_TASK_OPTION_BUTTONS,
      onCycleCreated: (cycleId) => deps.ui.onCycleCreated?.(cycleId),
      AppMeta: deps.core.AppMeta
    });

    deps.cycle.cycleManager = cycleManager;
    deps.cycle.showCycleCreationModal = () => cycleManager.showCycleCreationModal?.();
    deps.cycle.createNewMiniCycle = () => cycleManager.createNewMiniCycle?.();
    features.managers.cycleManager = cycleManager;
    console.log('✅ CycleManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize CycleManager:', error);
  }

  // ============================================================================
  // PHASE 6: UI MODULES
  // ============================================================================
  console.log('🎛️ Phase 6: Loading UI modules...');

  // ========== Undo/Redo Manager ==========
  try {
    const undoRedoModule = await import(withV('../ui/undoRedoManager.js'));

    undoRedoModule.setUndoRedoManagerDependencies({
      appInit: appInit,
      AppState: deps.core.AppState,
      refreshUIFromState: (state) => deps.task.refreshUIFromState?.(state),
      AppGlobalState: AppGlobalState,
      getElementById: (id) => document.getElementById(id),
      safeAddEventListener: deps.utils.safeAddEventListener,
      wrapperActive: false,
      showNotification: deps.utils.showNotification
    });

    undoRedoModule.wireUndoRedoUI();
    undoRedoModule.setupStateBasedUndoRedo();
    await undoRedoModule.initializeUndoSystemForApp();

    deps.ui.wireUndoRedoUI = undoRedoModule.wireUndoRedoUI;
    deps.ui.initializeUndoRedoButtons = undoRedoModule.initializeUndoRedoButtons;
    deps.ui.captureInitialSnapshot = undoRedoModule.captureInitialSnapshot;
    deps.ui.setupStateBasedUndoRedo = undoRedoModule.setupStateBasedUndoRedo;
    deps.ui.enableUndoSystemOnFirstInteraction = undoRedoModule.enableUndoSystemOnFirstInteraction;
    deps.ui.captureStateSnapshot = undoRedoModule.captureStateSnapshot;
    deps.ui.buildSnapshotSignature = undoRedoModule.buildSnapshotSignature;
    deps.ui.snapshotsEqual = undoRedoModule.snapshotsEqual;
    deps.ui.performStateBasedUndo = undoRedoModule.performStateBasedUndo;
    deps.ui.performStateBasedRedo = undoRedoModule.performStateBasedRedo;
    deps.ui.updateUndoRedoButtons = undoRedoModule.updateUndoRedoButtons;
    deps.ui.onCycleSwitched = undoRedoModule.onCycleSwitched;
    deps.ui.onCycleCreated = undoRedoModule.onCycleCreated;
    deps.ui.onCycleDeleted = undoRedoModule.onCycleDeleted;
    deps.ui.onCycleRenamed = undoRedoModule.onCycleRenamed;

    features.modules.undoRedo = undoRedoModule;
    console.log('✅ UndoRedoManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize UndoRedoManager:', error);
  }

  // ========== Menu Manager ==========
  try {
    const { initMenuManager, MenuManager } = await import(withV('../ui/menuManager.js'));

    const menuManager = await initMenuManager({
      appInit: appInit,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      AppState: () => deps.core.AppState,
      showNotification: deps.utils.showNotification,
      showPromptModal: (opts) => deps.utils.showPromptModal?.(opts),
      showConfirmationModal: (opts) => deps.utils.showConfirmationModal?.(opts),
      getElementById: (id) => document.getElementById(id),
      querySelector: (sel) => document.querySelector(sel),
      querySelectorAll: (sel) => document.querySelectorAll(sel),
      safeAddEventListener: GlobalUtils.safeAddEventListener,
      switchMiniCycle: () => deps.cycle.switchMiniCycle?.(),
      createNewMiniCycle: () => deps.cycle.createNewMiniCycle?.(),
      loadMiniCycle: () => deps.cycle.loadMiniCycle?.(),
      updateCycleModeDescription: () => deps.cycle.updateCycleModeDescription?.(),
      checkGamesUnlock: () => deps.ui.checkGamesUnlock?.(),
      sanitizeInput: (text) => GlobalUtils.sanitizeInput(text),
      updateCycleData: deps.core.updateCycleData,
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      updateStatsPanel: () => deps.ui.updateStatsPanel?.(),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      updateUndoRedoButtons: () => deps.ui.updateUndoRedoButtons?.(),
      AppMeta: deps.core.AppMeta,
      get recurringPanel() { return deps.recurring.panel; }
    });

    deps.ui.MenuManager = MenuManager;
    deps.ui.menuManager = menuManager;
    deps.ui.setupMainMenu = () => menuManager?.setupMainMenu();
    deps.ui.closeMainMenu = () => menuManager?.closeMainMenu();
    deps.ui.updateMainMenuHeader = () => menuManager?.updateMainMenuHeader();
    deps.ui.hideMainMenu = () => menuManager?.hideMainMenu();
    deps.ui.closeMenuOnClickOutside = (event) => menuManager?.closeMenuOnClickOutside(event);
    deps.ui.saveMiniCycleAsNew = () => menuManager?.saveMiniCycleAsNew();
    deps.ui.clearAllTasks = () => menuManager?.clearAllTasks();
    deps.ui.deleteAllTasks = () => menuManager?.deleteAllTasks();
    features.managers.menuManager = menuManager;
    console.log('✅ MenuManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize MenuManager:', error);
  }

  // ========== Wire ThemeManager with late deps ==========
  if (themeManagerMod?.setThemeManagerDependencies) {
    themeManagerMod.setThemeManagerDependencies({
      appInit: appInit,
      AppState: deps.core.AppState,
      showNotification: deps.utils.showNotification,
      hideMainMenu: () => deps.ui.hideMainMenu?.()
    });
  }

  // ========== Modal Manager (full init) ==========
  if (modalManagerMod) {
    try {
      const modalManager = await modalManagerMod.initModalManager({
        showNotification: deps.utils.showNotification,
        hideMainMenu: () => deps.ui.hideMainMenu?.(),
        sanitizeInput: deps.utils.sanitizeInput,
        safeAddEventListener: deps.utils.safeAddEventListener,
        waitForCore: () => appInit.waitForCore(),
        AppMeta: deps.core.AppMeta
      });

      deps.ui.modalManager = modalManager;
      deps.ui.closeAllModals = () => modalManager?.closeAllModals?.();
      features.managers.modalManager = modalManager;
      console.log('✅ ModalManager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize ModalManager:', error);
    }
  }

  // ========== Settings Manager ==========
  try {
    const { initSettingsManager, setSettingsManagerDependencies } = await import(withV('../ui/settingsManager.js'));

    setSettingsManagerDependencies({
      appInit: appInit,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      AppState: () => deps.core.AppState,
      showNotification: deps.utils.showNotification,
      showConfirmationModal: (opts) => deps.utils.showConfirmationModal?.(opts),
      hideMainMenu: () => deps.ui.hideMainMenu?.(),
      setupDarkModeToggle: (id, syncIds) => deps.features.setupDarkModeToggle?.(id, syncIds),
      setupQuickDarkToggle: () => deps.features.setupQuickDarkToggle?.(),
      updateMoveArrowsVisibility: () => deps.task.updateMoveArrowsVisibility?.(),
      toggleHoverTaskOptions: (enabled) => deps.ui.toggleHoverTaskOptions?.(enabled),
      refreshTaskListUI: () => deps.task.refreshTaskListUI?.(),
      performSchema25Migration: () => deps.core.performSchema25Migration?.(),
      organizeCompletedTasks: () => deps.ui.organizeCompletedTasks?.(),
      get DataValidator() { return deps.utils.DataValidator; },
      get calculateNextOccurrence() { return deps.recurring.core?.calculateNextOccurrence; },
      sanitizeInput: (text, maxLen) => deps.utils.sanitizeInput?.(text, maxLen),
      AppMeta: deps.core.AppMeta,
      safeAddEventListener: GlobalUtils.safeAddEventListener
    });

    const settingsManager = await initSettingsManager();
    deps.ui.settingsManager = settingsManager;
    deps.ui.syncCurrentSettingsToStorage = () => settingsManager.syncCurrentSettingsToStorage();
    features.managers.settingsManager = settingsManager;
    console.log('✅ SettingsManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize SettingsManager:', error);
  }

  // ========== Completed Tasks Manager ==========
  try {
    const { initCompletedTasksManager, setCompletedTasksManagerDependencies } = await import(withV('../ui/completedTasksManager.js'));

    setCompletedTasksManagerDependencies({
      getAppState: () => deps.core.AppState,
      getElementById: (id) => document.getElementById(id),
      querySelector: (sel) => document.querySelector(sel),
      safeAddEventListener: GlobalUtils.safeAddEventListener
    });

    const completedTasksManager = await initCompletedTasksManager();
    deps.ui.completedTasksManager = completedTasksManager;
    deps.ui.initCompletedTasksSection = () => completedTasksManager.init();
    deps.ui.toggleCompletedTasksSection = () => completedTasksManager.toggle();
    deps.ui.moveTaskToCompleted = (el) => completedTasksManager.moveToCompleted(el);
    deps.ui.moveTaskToActive = (el) => completedTasksManager.moveToActive(el);
    deps.ui.updateCompletedTasksCount = () => completedTasksManager.updateCount();
    deps.ui.handleTaskListMovement = (el, completed) => completedTasksManager.handleMovement(el, completed);
    deps.ui.organizeCompletedTasks = () => completedTasksManager.organize();
    deps.ui.isCompletedDropdownEnabled = () => completedTasksManager.isEnabled();
    features.managers.completedTasksManager = completedTasksManager;
    console.log('✅ CompletedTasksManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize CompletedTasksManager:', error);
  }

  // ========== Cycle Completion ==========
  try {
    const { setCycleCompletionDependencies, incrementCycleCount, showCompletionAnimation, updateProgressBar, checkMiniCycle } = await import(withV('../progress/cycleCompletion.js'));

    setCycleCompletionDependencies({
      AppState: deps.core.AppState,
      showNotification: deps.utils.showNotification,
      updateStatsPanel: () => deps.ui.updateStatsPanel?.(),
      unlockDarkOceanTheme: () => deps.features.unlockDarkOceanTheme?.(),
      unlockGoldenGlowTheme: () => deps.features.unlockGoldenGlowTheme?.(),
      unlockMiniGame: () => deps.ui.unlockMiniGame?.(),
      getTaskList: () => document.getElementById('taskList'),
      getProgressBar: () => document.getElementById('progressBar'),
      assignCycleVariables: () => deps.core.assignCycleVariables?.(),
      resetTasks: () => deps.task.resetTasks?.()
    });

    deps.progress.incrementCycleCount = incrementCycleCount;
    deps.progress.showCompletionAnimation = showCompletionAnimation;
    deps.progress.updateProgressBar = updateProgressBar;
    deps.progress.checkMiniCycle = checkMiniCycle;
    features.apis.cycleCompletion = { incrementCycleCount, showCompletionAnimation, updateProgressBar, checkMiniCycle };
    console.log('✅ CycleCompletion initialized');
  } catch (error) {
    console.error('❌ Failed to initialize CycleCompletion:', error);
  }

  // ========== Task UI ==========
  try {
    const { setTaskUIDependencies, TaskOptionsVisibilityController, refreshTaskListUI, showTaskOptions, hideTaskOptions, hideTaskButtons, checkCompleteAllButton } = await import(withV('../ui/taskUI.js'));

    setTaskUIDependencies({
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      addTask: (...args) => deps.task.addTask?.(...args),
      updateRecurringButtonVisibility: () => deps.recurring.updateButtonVisibility?.(),
      getElementById: (id) => document.getElementById(id),
      getTaskList: () => document.getElementById('taskList'),
      getCompleteAllButton: () => document.getElementById('completeAll'),
      isTouchDevice: () => deps.utils.isTouchDevice?.()
    });

    deps.ui.TaskOptionsVisibilityController = TaskOptionsVisibilityController;
    deps.ui.refreshTaskListUI = refreshTaskListUI;
    deps.task.refreshTaskListUI = refreshTaskListUI;
    deps.ui.showTaskOptions = showTaskOptions;
    deps.ui.hideTaskOptions = hideTaskOptions;
    deps.ui.hideTaskButtons = hideTaskButtons;
    deps.ui.checkCompleteAllButton = checkCompleteAllButton;
    features.modules.taskUI = { TaskOptionsVisibilityController, refreshTaskListUI, showTaskOptions, hideTaskOptions, hideTaskButtons, checkCompleteAllButton };
    console.log('✅ TaskUI initialized');
  } catch (error) {
    console.error('❌ Failed to initialize TaskUI:', error);
  }

  // ========== Task Interactions ==========
  try {
    const { setTaskInteractionsDependencies, attachKeyboardTaskOptionToggle } = await import(withV('../ui/taskInteractions.js'));

    setTaskInteractionsDependencies({
      safeAddEventListener: GlobalUtils.safeAddEventListener
    });

    deps.ui.attachKeyboardTaskOptionToggle = attachKeyboardTaskOptionToggle;
    console.log('✅ TaskInteractions initialized');
  } catch (error) {
    console.error('❌ Failed to initialize TaskInteractions:', error);
  }

  // ========== UI Effects ==========
  try {
    const { setUIEffectsDependencies, triggerLogoBackground } = await import(withV('../ui/uiEffects.js'));

    setUIEffectsDependencies({
      querySelector: (sel) => document.querySelector(sel),
      getLogoTimeoutId: () => AppGlobalState?.logoTimeoutId,
      setLogoTimeoutId: (val) => { if (AppGlobalState) AppGlobalState.logoTimeoutId = val; }
    });

    deps.ui.triggerLogoBackground = triggerLogoBackground;
    console.log('✅ UIEffects initialized');
  } catch (error) {
    console.error('❌ Failed to initialize UIEffects:', error);
  }

  // ========== Help Window Manager ==========
  try {
    const { initHelpWindowManager, setHelpWindowManagerDependencies } = await import(withV('../ui/helpWindowManager.js'));

    setHelpWindowManagerDependencies({
      AppState: deps.core.AppState,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.()
    });

    // Initialize after a delay (DOM needs to be ready)
    setTimeout(() => {
      const helpWindowManager = initHelpWindowManager();
      deps.ui.helpWindowManager = helpWindowManager;
      console.log('✅ HelpWindowManager initialized');
    }, 500);

    console.log('✅ HelpWindowManager module loaded');
  } catch (error) {
    console.error('❌ Failed to load HelpWindowManager:', error);
  }

  // ========== Task Core ==========
  try {
    const { initTaskCore, setTaskCoreDependencies, handleTaskCompletionChange, resetTasks, handleCompleteAllTasks, addTask, editTaskFromCore, deleteTaskFromCore, saveTaskToSchema25 } = await import(withV('../task/taskCore.js'));

    deps.task.handleTaskCompletionChange = handleTaskCompletionChange;
    deps.task.resetTasks = resetTasks;
    deps.task.handleCompleteAllTasks = handleCompleteAllTasks;
    deps.task.saveTaskToSchema25 = saveTaskToSchema25;
    deps.task.addTask = addTask;  // ✅ Required for cycleLoader to render tasks

    const taskCore = await initTaskCore({
      appInit: appInit,
      AppState: deps.core.AppState,
      AppMeta: deps.core.AppMeta,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      sanitizeInput: (text) => GlobalUtils.sanitizeInput(text),
      safeJSONParse: GlobalUtils.safeJSONParse,
      safeJSONStringify: GlobalUtils.safeJSONStringify,
      safeLocalStorageGet: GlobalUtils.safeLocalStorageGet,
      safeLocalStorageSet: GlobalUtils.safeLocalStorageSet,
      showNotification: deps.utils.showNotification,
      updateStatsPanel: () => deps.ui.updateStatsPanel?.(),
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      refreshUIFromState: () => deps.task.refreshUIFromState?.(),
      captureStateSnapshot: (state) => deps.ui.captureStateSnapshot?.(state),
      enableUndoSystemOnFirstInteraction: () => deps.ui.enableUndoSystemOnFirstInteraction?.(),
      isPerformingUndoRedo: () => AppGlobalState?.isPerformingUndoRedo || false,
      showPromptModal: (config) => deps.utils.showPromptModal?.(config),
      showConfirmationModal: (config) => deps.utils.showConfirmationModal?.(config),
      getElementById: (id) => document.getElementById(id),
      querySelector: (sel) => document.querySelector(sel),
      querySelectorAll: (sel) => document.querySelectorAll(sel),
      validateAndSanitizeTaskInput: (text) => deps.task.validateAndSanitizeTaskInput?.(text),
      loadTaskContext: (...args) => deps.task.loadTaskContext?.(...args),
      createOrUpdateTaskData: (ctx) => deps.task.createOrUpdateTaskData?.(ctx),
      createTaskDOMElements: (ctx, data) => deps.task.createTaskDOMElements?.(ctx, data),
      setupTaskInteractions: (els, ctx) => deps.task.setupTaskInteractions?.(els, ctx),
      finalizeTaskCreation: (els, ctx, opts) => deps.task.finalizeTaskCreation?.(els, ctx, opts),
      autoSave: () => deps.core.autoSave?.()
    });

    deps.task.taskCore = taskCore;

    // Inject cycle completion deps
    setTaskCoreDependencies({
      incrementCycleCount: deps.progress.incrementCycleCount,
      showCompletionAnimation: deps.progress.showCompletionAnimation,
      helpWindowManager: {
        get showCycleCompleteMessage() { return deps.ui.helpWindowManager?.showCycleCompleteMessage?.bind(deps.ui.helpWindowManager); },
        get updateConstantMessage() { return deps.ui.helpWindowManager?.updateConstantMessage?.bind(deps.ui.helpWindowManager); }
      },
      removeRecurringTasksFromCycle: deps.recurring.removeTasksFromCycle,
      recurringCore: deps.recurring.core,
      checkMiniCycle: () => deps.progress.checkMiniCycle?.(),
      updateCompletedTasksCount: () => deps.ui.updateCompletedTasksCount?.()
    });

    // Inject into taskEvents
    const { setTaskEventsDependencies } = await import(withV('../task/taskEvents.js'));
    setTaskEventsDependencies({
      get taskCore() { return taskCore; },
      enableUndoSystemOnFirstInteraction: () => deps.ui.enableUndoSystemOnFirstInteraction?.(),
      checkMiniCycle: () => deps.progress.checkMiniCycle?.(),
      triggerLogoBackground: (type, dur) => deps.ui.triggerLogoBackground?.(type, dur),
      showTaskOptions: (e) => deps.ui.showTaskOptions?.(e),
      hideTaskOptions: (e) => deps.ui.hideTaskOptions?.(e),
      get TaskOptionsVisibilityController() { return deps.ui.TaskOptionsVisibilityController; },
      setupDueDateButtonInteraction: (btn, input) => deps.features.setupDueDateButtonInteraction?.(btn, input),
      attachKeyboardTaskOptionToggle: (taskItem) => deps.ui.attachKeyboardTaskOptionToggle?.(taskItem)
    });

    features.managers.taskCore = taskCore;
    console.log('✅ TaskCore initialized');
  } catch (error) {
    console.error('❌ Failed to initialize TaskCore:', error);
  }

  // ========== Cycle Loader ==========
  try {
    const { loadMiniCycle, setCycleLoaderDependencies } = await import(withV('../cycle/cycleLoader.js'));

    setCycleLoaderDependencies({
      appInit: appInit,
      AppState: () => deps.core.AppState,
      loadMiniCycleData: () => deps.core.loadMiniCycleData?.(),
      createInitialSchema25Data: () => deps.core.createInitialSchema25Data?.(),
      addTask: (...args) => deps.task.addTask?.(...args),
      updateThemeColor: () => deps.features.updateThemeColor?.(),
      startReminders: () => deps.features.startReminders?.(),
      catchUpMissedRecurringTasks: () => deps.recurring.core?.catchUpMissed?.(),
      updateProgressBar: () => deps.progress.updateProgressBar?.(),
      checkCompleteAllButton: () => deps.ui.checkCompleteAllButton?.(),
      updateMainMenuHeader: () => deps.ui.updateMainMenuHeader?.(),
      updateStatsPanel: () => deps.ui.updateStatsPanel?.(),
      syncAllTasksWithMode: (...args) => deps.task.syncAllTasksWithMode?.(...args)
    });

    deps.cycle.loadMiniCycle = loadMiniCycle;
    deps.cycle.setCycleLoaderDependencies = setCycleLoaderDependencies;
    console.log('✅ CycleLoader initialized');
  } catch (error) {
    console.error('❌ CRITICAL: Failed to initialize CycleLoader:', error);
    throw new Error('CycleLoader initialization failed - cannot load cycles');
  }

  // ========== Pull-to-Refresh ==========
  try {
    const { initPullToRefresh, setPullToRefreshDependencies } = await import(withV('../ui/pullToRefresh.js'));

    setPullToRefreshDependencies({
      showNotification: deps.utils.showNotification,
      get refreshUIFromState() { return deps.task.refreshUIFromState; },
      get checkRecurringTasksNow() { return deps.recurring.core?.checkNow; },
      get watchRecurringTasks() { return deps.recurring.core?.watch; },
      get promptServiceWorkerUpdate() { return deps.core.promptServiceWorkerUpdate; }
    });

    const pullToRefresh = initPullToRefresh();
    deps.ui.pullToRefresh = pullToRefresh;
    console.log('✅ PullToRefresh initialized');
  } catch (error) {
    console.error('❌ Failed to initialize PullToRefresh:', error);
  }

  // ============================================================================
  // PHASE 7: TESTING & BACKUP (Optional)
  // ============================================================================
  console.log('🔬 Phase 7: Loading testing & backup modules...');

  // ========== Testing Modal ==========
  let testingModalMod = null;
  try {
    testingModalMod = await import(withV('../testing/testing-modal.js'));
    deps.testing = deps.testing || {};
    deps.testing.openStorageViewer = testingModalMod.openStorageViewer;
    deps.testing.closeStorageViewer = testingModalMod.closeStorageViewer;
    deps.testing.appendToTestResults = testingModalMod.appendToTestResults;
    deps.testing.clearTestResults = testingModalMod.clearTestResults;
    deps.testing.exportTestResults = testingModalMod.exportTestResults;
    deps.testing.copyTestResults = testingModalMod.copyTestResults;

    // HTML onclick needs this on window
    window.closeStorageViewer = testingModalMod.closeStorageViewer;

    const testingIntegrationMod = await import(withV('../testing/testing-modal-integration.js'));
    if (testingIntegrationMod.setTestingModalDependencies) {
      testingIntegrationMod.setTestingModalDependencies({
        safeAddEventListenerById: deps.utils.safeAddEventListenerById,
        showNotification: deps.utils.showNotification,
        get ConsoleCapture() { return deps.utils.consoleCapture; }
      });
    }

    features.modules.testingModal = testingModalMod;
    console.log('✅ TestingModal loaded');
  } catch (error) {
    console.error('❌ Failed to load TestingModal:', error);
  }

  // ========== Backup Manager ==========
  try {
    const backupManagerMod = await import(withV('../storage/backupManager.js'));

    if (backupManagerMod.setBackupManagerDependencies) {
      backupManagerMod.setBackupManagerDependencies({
        get AppState() { return deps.core.AppState; }
      });
    }

    deps.storage = deps.storage || {};
    deps.storage.BackupManager = backupManagerMod.default;
    features.managers.backupManager = backupManagerMod.default;

    // Create auto-backup in background
    backupManagerMod.default.createAutoBackup()
      .then(created => {
        if (created) console.log('✅ Auto-backup created');
        else console.log('⏭️ Auto-backup skipped (recent backup exists)');
      })
      .catch(error => console.warn('⚠️ Auto-backup failed:', error));

    console.log('✅ BackupManager loaded');
  } catch (error) {
    console.error('❌ Failed to load BackupManager:', error);
  }

  // ========== Wire Testing Modal deps (needs BackupManager) ==========
  if (testingModalMod?.setTestingModalDependencies) {
    testingModalMod.setTestingModalDependencies({
      AppState: deps.core.AppState,
      BackupManager: deps.storage?.BackupManager,
      notifications: deps.utils.notifications,
      showNotification: deps.utils.showNotification,
      deleteStorageItem: (key, storageType) => {
        const storage = storageType === 'local' ? localStorage : sessionStorage;
        storage.removeItem(key);
      },
      safeAddEventListener: GlobalUtils.safeAddEventListener,
      safeAddEventListenerById: GlobalUtils.safeAddEventListenerById,
      setupAutomatedTestingFunctions: () => deps.testing?.setupAutomatedTestingFunctions?.(),
      startAutoConsoleCapture: () => deps.testing?.startAutoConsoleCapture?.(),
      isConsoleCapturing: () => deps.testing?.consoleCapturing || false
    });

    if (typeof testingModalMod.setupTestingModal === 'function') {
      testingModalMod.setupTestingModal();
    }
    if (typeof testingModalMod.initializeTestingModalEnhancements === 'function') {
      testingModalMod.initializeTestingModalEnhancements();
    }
  }

  // ============================================================================
  // WINDOW.* EXPOSURES - PUBLIC API
  // ============================================================================
  // These globals are actively used via window.* calls in the codebase.
  // Audit performed Dec 2025: Reduced from 131 to 37 essential globals.
  // Before adding new exposures, verify they're actually called via window.*
  console.log('🔧 Setting up window.* public API...');

  // ---- Core/State (3) ----
  // Essential app state and initialization
  window.AppState = deps.core.AppState;
  window.appInit = appInit;
  window.AppGlobalState = AppGlobalState;

  // ---- Utilities (4) ----
  // Common helpers used throughout the app
  window.showNotification = deps.utils.showNotification;
  window.sanitizeInput = deps.utils.sanitizeInput;
  window.generateId = deps.utils.generateId;
  window.isTouchDevice = deps.utils.isTouchDevice;

  // ---- Task Operations (5) ----
  // Task creation and management
  window.addTask = deps.task.addTask;
  window.handleCompleteAllTasks = deps.task.handleCompleteAllTasks;
  window.createTaskDOMElements = deps.task.createTaskDOMElements;
  window.finalizeTaskCreation = deps.task.finalizeTaskCreation;
  window.loadTaskContext = deps.task.loadTaskContext;

  // ---- Drag & Drop (1) ----
  window.updateMoveArrowsVisibility = deps.ui.updateMoveArrowsVisibility;

  // ---- Progress (1) ----
  window.checkMiniCycle = deps.progress.checkMiniCycle;

  // ---- Due Dates (2) ----
  window.checkOverdueTasks = deps.features.checkOverdueTasks;
  window.remindOverdueTasks = deps.features.remindOverdueTasks;

  // ---- Reminders (4) ----
  window.reminderManager = deps.features.reminderManager;
  window.startReminders = deps.features.startReminders;
  window.updateReminderButtons = deps.features.updateReminderButtons;
  window.loadRemindersSettings = deps.features.loadRemindersSettings;

  // ---- Recurring (3) ----
  window.recurringPanel = deps.recurring.panel;
  window.recurringCore = deps.recurring.core;
  window.openRecurringSettingsPanelForTask = deps.recurring.openSettingsPanel;

  // ---- Mode Manager (3) ----
  window.initializeModeSelector = deps.cycle.initializeModeSelector;
  window.syncCurrentSettingsToStorage = deps.cycle.syncCurrentSettingsToStorage;
  window.saveToggleAutoReset = deps.cycle.saveToggleAutoReset;

  // ---- Cycle Management (2) ----
  window.showCycleCreationModal = deps.cycle.showCycleCreationModal;
  window.loadMiniCycle = deps.cycle.loadMiniCycle;

  // ---- Undo/Redo (5) ----
  window.captureStateSnapshot = deps.ui.captureStateSnapshot;
  window.performStateBasedUndo = deps.ui.performStateBasedUndo;
  window.performStateBasedRedo = deps.ui.performStateBasedRedo;
  window.updateUndoRedoButtons = deps.ui.updateUndoRedoButtons;
  window.enableUndoSystemOnFirstInteraction = deps.ui.enableUndoSystemOnFirstInteraction;

  // ---- Menu (1) ----
  window.hideMainMenu = deps.ui.hideMainMenu;

  // ---- Completed Tasks (2) ----
  window.initCompletedTasksSection = deps.ui.initCompletedTasksSection;
  window.organizeCompletedTasks = deps.ui.organizeCompletedTasks;

  // ---- Main Menu Header (1) ----
  window.updateMainMenuHeader = deps.ui.updateMainMenuHeader;

  console.log('✅ Window exposures complete (37 public API globals)');

  // ============================================================================
  // COMPLETE
  // ============================================================================
  console.log('✅ app-featureBoot: Feature boot complete');
  console.log(`📦 Loaded ${Object.keys(features.managers).length} managers, ${Object.keys(features.modules).length} modules`);

  return features;
}

/**
 * Get the deps container structure for initialization
 */
export function createDepsContainer() {
  return {
    utils: {},
    features: {},
    ui: {},
    core: {},
    task: {},
    cycle: {},
    recurring: {},
    progress: {},
    storage: {},
    testing: {}
  };
}
