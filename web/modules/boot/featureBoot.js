/**
 * ============================================================================
 * featureBoot.js - Feature Module DI Wiring Hub
 * ============================================================================
 * Location: modules/boot/featureBoot.js
 *
 * This is the DI WIRING HUB for miniCycle. All feature module loading and
 * dependency injection happens here. Zero window.* globals - modules
 * communicate via deps container and appContext.js.
 *
 * RESPONSIBILITIES:
 * - Load all feature modules via moduleLoader.js with declarative manifests
 * - Initialize module instances with proper dependency injection
 * - Register APIs in appContext.js for cross-module access
 * - Populate deps container for boot-time communication
 *
 * ARCHITECTURE (Dec 2025):
 * - orchestrator.js is a pure sequence controller (no DI writes)
 * - featureBoot.js is the DI wiring hub (this file)
 * - uiBoot.js handles all UI setup via initUIBoot()
 * - moduleLoader.js handles declarative module loading via manifests
 *
 * IMPORT RULES:
 * - This file imports from coreBoot.js
 * - This file must NOT import from uiBoot.js
 *
 * @module featureBoot
 * @version 3.0.0
 */

/**
 * Boot early dependencies needed before AppState initialization
 * This loads only notifications (and its prerequisites) so showNotification
 * is available for initAppState and early error messages.
 *
 * @param {Object} deps - Dependency container from main script
 * @param {Object} coreResult - Results from coreBoot.js initCoreBoot()
 * @returns {Object} { showNotification, notifications }
 */
export async function bootEarlyDeps(deps, coreResult) {
  const { GlobalUtils, appInit, AppGlobalState, withV } = coreResult;

  console.log('🔧 bootEarlyDeps: Loading notifications (pre-AppState)...');

  // ========== Error Handler (needed for notifications error handling) ==========
  try {
    const errorHandlerMod = await import(withV('../utils/errorHandler.js'));
    deps.utils.setErrorHandlerDependencies = errorHandlerMod.setErrorHandlerDependencies;
    console.log('✅ ErrorHandler loaded (early)');
  } catch (error) {
    console.error('❌ Failed to load ErrorHandler:', error);
  }

  // ========== Console Capture (needed for diagnostics) ==========
  try {
    const consoleCaptureMod = await import(withV('../utils/consoleCapture.js'));
    deps.utils.consoleCapture = consoleCaptureMod.consoleCapture;
    console.log('✅ ConsoleCapture loaded (early)');
  } catch (error) {
    console.error('❌ Failed to load ConsoleCapture:', error);
  }

  // ========== Notifications ==========
  let showNotification = null;
  let notifications = null;

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

    notifications = new notificationsMod.MiniCycleNotifications();

    // Store in deps container
    deps.utils.notifications = notifications;
    deps.utils.showNotification = (message, type, duration, options) => notifications.show(message, type, duration, options);
    deps.utils.showNotificationWithTip = (content, type, duration, tipId, options) => notifications.showWithTip(content, type, duration, tipId, options);
    deps.utils.showApplyConfirmation = (targetElement) => notifications.showApplyConfirmation(targetElement);
    deps.utils.showConfirmationModal = (options) => notifications.showConfirmationModal(options);
    deps.utils.showChoiceModal = (options) => notifications.showChoiceModal(options);
    deps.utils.showPromptModal = (options) => notifications.showPromptModal(options);
    deps.utils.setupNotificationDragging = (container) => notifications.setupNotificationDragging(container);
    deps.utils.resetNotificationPosition = () => notifications.resetPosition();
    deps.utils.setNotificationsDependencies = notificationsMod.setNotificationsDependencies;

    showNotification = deps.utils.showNotification;
    deps.earlyDeps = { notificationsMod, notifications }; // Store for bootFeatures to skip

    console.log('✅ Notifications loaded (early)');

    // Show deferred cache notification if needed
    if (AppGlobalState.pendingCacheNotification) {
      notifications.show('App updated! Cache refreshed automatically.', 'info', 4000);
      AppGlobalState.pendingCacheNotification = false;
    }

    // Show notification if data was recovered from interrupted tests
    if (sessionStorage.getItem('__miniCycle_recoveredFromInterruptedTests__')) {
      sessionStorage.removeItem('__miniCycle_recoveredFromInterruptedTests__');
      notifications.show('Data restored after interrupted test run', 'info', 4000);
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

  // ========== Register showNotification with appContext ==========
  // ✅ Use version param for cache-busting (like appInit pattern)
  const { setContextValue } = await import(withV('../core/appContext.js'));
  setContextValue('showNotification', deps.utils.showNotification);

  console.log('✅ bootEarlyDeps complete');

  return { showNotification, notifications };
}

/**
 * Boot all feature modules using moduleLoader.js with declarative manifests
 *
 * @param {Object} deps - Dependency container from main script
 * @param {Object} coreResult - Results from coreBoot.js initCoreBoot()
 * @returns {Object} Initialized feature module references
 */
export async function bootFeatures(deps, coreResult) {
  const { GlobalUtils, appInit, withV } = coreResult;

  console.log('🚀 bootFeatures: Starting moduleLoader-based boot...');

  // Import moduleLoader (which re-exports moduleManifests to avoid duplicate loading)
  const { loadAllModules, loadPhase, PHASES, MODULE_MANIFESTS, getLoadOrder } = await import(withV('./moduleLoader.js'));
  const appContextMod = await import(withV('../core/appContext.js'));

  // Container for initialized modules
  const features = {
    managers: {},
    modules: {},
    apis: {}
  };

  try {
    // Log load order for debugging
    const loadOrder = getLoadOrder();
    console.log(`📦 Will load ${loadOrder.length} modules in order:`, loadOrder.slice(0, 5).join(', ') + '...');

    // Load all modules using moduleLoader
    const result = await loadAllModules(deps, coreResult);

    console.log(`✅ moduleLoader loaded ${result.modules.size} modules`);

    // Copy loaded modules to features container
    for (const [name, mod] of result.modules) {
      features.modules[name] = mod;
    }
    for (const [name, instance] of result.instances) {
      features.managers[name] = instance;
    }
    features.apis = result.apis;

    // Register grouped APIs with appContext
    registerGroupedApisFromLoader(deps, appContextMod, coreResult);

    // =========================================================================
    // INITIALISE VOCABULARY THEME SYSTEM
    // =========================================================================
    if (deps.features?.vocabThemeManager) {
      deps.features.vocabThemeManager.init();
      console.log('✅ Vocabulary theme system initialised');
    }

    // =========================================================================
    // INJECT RECURRING FUNCTIONS INTO NOTIFICATIONS
    // =========================================================================
    // Notifications was loaded early (pre-recurring), now inject recurring functions
    if (deps.utils?.setNotificationsDependencies && deps.recurring?.panel) {
      deps.utils.setNotificationsDependencies({
        openRecurringSettingsPanelForTask: (taskId) => deps.recurring?.panel?.openRecurringSettingsPanelForTask?.(taskId),
        updateRecurringPanel: () => deps.recurring?.panel?.updateRecurringPanel?.()
      });
      console.log('✅ Recurring functions injected into Notifications');
    }

    // =========================================================================
    // HTML EVENT LISTENERS (zero window.* globals)
    // =========================================================================
    // These listeners allow HTML inline scripts (like service worker update UI)
    // to communicate with the app via CustomEvents instead of window.* globals.
    console.log('🔧 Setting up HTML event listeners...');

    // Listen for notification requests from HTML/service worker
    document.addEventListener('app:showNotification', (e) => {
      const { message, type, duration } = e.detail || {};
      deps.utils.showNotification?.(message, type, duration);
    });

    // Listen for confirmation modal requests from HTML/service worker
    document.addEventListener('app:showConfirmationModal', (e) => {
      deps.utils.showConfirmationModal?.(e.detail);
    });

    // Listen for stats panel requests from HTML
    document.addEventListener('app:showStatsPanel', () => {
      deps.ui.showStatsPanel?.();
    });

    // Listen for closeStorageViewer requests (testing modal)
    document.addEventListener('app:closeStorageViewer', () => {
      deps.testing?.closeStorageViewer?.();
    });

    console.log('✅ HTML event listeners configured');

    // =========================================================================
    // LOAD TASK SEARCH MODULE
    // =========================================================================
    try {
      const taskSearchMod = await import(withV('../ui/taskSearch.js'));
      deps.ui.initTaskSearch = taskSearchMod.initTaskSearch;
      deps.ui.updateSearchVisibility = taskSearchMod.updateSearchVisibility;
      deps.ui.resetSearch = taskSearchMod.resetSearch;

      // Inject into TaskRenderer for visibility updates on render
      if (deps.task?.taskDOMManager?.renderer?.injectDependency) {
        deps.task.taskDOMManager.renderer.injectDependency('updateSearchVisibility', taskSearchMod.updateSearchVisibility);
      }

      // Also inject into routineLoader for boot-time rendering
      if (features.modules.routineLoader?.setRoutineLoaderDependencies) {
        features.modules.routineLoader.setRoutineLoaderDependencies({
          updateSearchVisibility: taskSearchMod.updateSearchVisibility,
          completedTasksManager: deps.ui?.completedTasksManager
        });
      }

      // Inject into taskCRUD for add/delete visibility updates
      const { setTaskCRUDDependencies, initTaskCRUD } = await import(withV('../task/taskCRUD.js'));
      await initTaskCRUD(); // Load utilities with version cache-busting
      setTaskCRUDDependencies({
        updateSearchVisibility: taskSearchMod.updateSearchVisibility,
        getTaskCount: taskSearchMod.getTaskCount,
        startReminders: deps.features?.startReminders,
        notifications: deps.utils?.notifications
      });

      console.log('✅ TaskSearch module loaded');
    } catch (err) {
      console.warn('⚠️ TaskSearch module failed to load:', err);
    }

    // =========================================================================
    // VALIDATE CRITICAL DI WIRING
    // =========================================================================
    validateCriticalDIWiring(deps);

    console.log('✅ bootFeatures: Complete');
    console.log(`📦 Loaded ${Object.keys(features.managers).length} managers, ${Object.keys(features.modules).length} modules`);

    return features;

  } catch (error) {
    console.error('❌ bootFeatures failed:', error);
    throw error;
  }
}

/**
 * Get the deps container structure for initialization
 */
export function createDepsContainer() {
  return {
    utils: {},
    labels: {},
    features: {},
    ui: {},
    core: {},
    task: {},
    cycle: {},
    recurring: {},
    progress: {},
    storage: {},
    testing: {},
    plugins: {}
  };
}


/**
 * Register grouped APIs from moduleLoader results
 */
function registerGroupedApisFromLoader(deps, appContextMod, coreResult) {
  const { GlobalUtils } = coreResult;

  // State API
  const stateApiObj = {
    AppState: deps.core?.AppState,
    AppGlobalState: deps.core?.AppGlobalState,
    AppMeta: deps.core?.AppMeta,
    loadMiniCycleData: deps.core?.loadMiniCycleData,
    autoSave: deps.core?.autoSave
  };
  appContextMod.setContextValue('stateApi', stateApiObj);
  appContextMod.registerApi('state', stateApiObj);

  // Task API
  const taskApiObj = {
    add: deps.task?.addTask,
    delete: deps.task?.deleteTask,
    handleCompletionChange: deps.task?.handleTaskCompletionChange,
    handleCompleteAll: deps.task?.handleCompleteAllTasks,
    loadContext: deps.task?.loadTaskContext,
    createDOM: deps.task?.createTaskDOMElements,
    extractFromDOM: deps.task?.extractTaskDataFromDOM,
    updateMoveArrows: deps.task?.updateMoveArrowsVisibility,
    refresh: deps.task?.refreshTaskListUI,
    checkCompleteAllButton: deps.ui?.checkCompleteAllButton
  };
  appContextMod.setContextValue('taskApi', taskApiObj);
  appContextMod.registerApi('task', taskApiObj);

  // Cycle API
  const cycleApiObj = {
    load: deps.cycle?.loadMiniCycle,
    create: deps.cycle?.showCycleCreationModal,
    switch: deps.cycle?.switchMiniCycle,
    rename: deps.cycle?.renameMiniCycle,
    delete: deps.cycle?.deleteMiniCycle,
    check: deps.progress?.checkMiniCycle,
    updateProgress: deps.progress?.updateProgressBar,
    incrementCount: deps.progress?.incrementCycleCount,
    initializeModeSelector: deps.cycle?.setupModeSelector
  };
  appContextMod.setContextValue('cycleApi', cycleApiObj);
  appContextMod.registerApi('cycle', cycleApiObj);

  // UI API
  const uiApiObj = {
    showNotification: deps.utils?.showNotification,
    showConfirmationModal: deps.utils?.showConfirmationModal,
    showPromptModal: deps.utils?.showPromptModal,
    hideMainMenu: deps.ui?.hideMainMenu,
    updateMainMenuHeader: deps.ui?.updateMainMenuHeader,
    closeAllModals: deps.ui?.closeAllModals,
    resetNotificationPosition: deps.utils?.resetNotificationPosition,
    syncCurrentSettingsToStorage: deps.ui?.syncCurrentSettingsToStorage,
    // Additional UI functions
    onboardingManager: deps.ui?.onboardingManager,
    deviceDetectionManager: deps.ui?.deviceDetectionManager,
    updateDueDateVisibility: deps.features?.updateDueDateVisibility,
    organizeCompletedTasks: deps.features?.organizeCompletedTasks,
    updateThemeColor: deps.features?.updateThemeColor,
    trackAction: deps.ui?.trackAction,
    getModal: deps.ui?.getModal,
    initCompletedTasksSection: () => deps.ui?.completedTasksManager?.init?.()
  };
  appContextMod.setContextValue('uiApi', uiApiObj);
  appContextMod.registerApi('ui', uiApiObj);

  // Undo API
  const undoApiObj = {
    capture: deps.ui?.captureStateSnapshot,
    undo: deps.ui?.performStateBasedUndo,
    redo: deps.ui?.performStateBasedRedo,
    updateButtons: deps.ui?.updateUndoRedoButtons,
    enableOnFirstInteraction: deps.ui?.enableUndoSystemOnFirstInteraction
  };
  appContextMod.setContextValue('undoApi', undoApiObj);
  appContextMod.registerApi('undo', undoApiObj);

  // Reminder API
  const reminderApiObj = {
    manager: deps.features?.reminderManager,
    start: deps.features?.startReminders,
    stop: deps.features?.stopReminders,
    updateButtons: deps.features?.updateReminderButtons,
    loadSettings: deps.features?.loadRemindersSettings,
    checkOverdue: deps.features?.checkOverdueTasks
  };
  appContextMod.setContextValue('reminderApi', reminderApiObj);
  appContextMod.registerApi('reminder', reminderApiObj);

  // Recurring API
  const recurringApiObj = {
    panel: deps.recurring?.panel,
    core: deps.recurring?.core,
    openSettingsForTask: (taskId) => deps.recurring?.panel?.openRecurringSettingsPanelForTask?.(taskId)
  };
  appContextMod.setContextValue('recurringApi', recurringApiObj);
  appContextMod.registerApi('recurring', recurringApiObj);

  // Utils API
  const utilsApiObj = {
    GlobalUtils: GlobalUtils,
    DataValidator: deps.utils?.DataValidator,
    sanitizeInput: deps.utils?.sanitizeInput,
    generateId: deps.utils?.generateId,
    generateHashId: deps.utils?.generateHashId,
    safeAddEventListener: GlobalUtils?.safeAddEventListener,
    isTouchDevice: deps.utils?.isTouchDevice
  };
  appContextMod.setContextValue('utilsApi', utilsApiObj);
  appContextMod.registerApi('utils', utilsApiObj);

  // Labels API (pure module, no DI needed - loads synchronously from defaultLabels)
  const labelsApiObj = {
    getLabel: deps.labels?.getLabel,
    getLabelOrFallback: deps.labels?.getLabelOrFallback,
    hasLabel: deps.labels?.hasLabel,
    isLensSensitive: deps.labels?.isLensSensitive,
    getLabels: deps.labels?.getLabels,
    getCategoryLabels: deps.labels?.getCategoryLabels,
    getLensSensitiveKeys: deps.labels?.getLensSensitiveKeys,
    getLabelDiagnostics: deps.labels?.getLabelDiagnostics
  };
  appContextMod.setContextValue('labelsApi', labelsApiObj);
  appContextMod.registerApi('labels', labelsApiObj);

  // Register legacy context values needed by appInit and other modules
  // onboardingManager has api: 'ui' so it's in deps.ui
  appContextMod.setContextValue('onboardingManager', deps.ui?.onboardingManager);
  appContextMod.setContextValue('showCycleCreationModal', deps.cycle?.showCycleCreationModal);
  appContextMod.setContextValue('hideMainMenu', deps.ui?.hideMainMenu);

  // Critical: extractTaskDataFromDOM is used by dataAccess.js autoSave
  // Without this, autoSave defaults to [] and wipes all tasks
  appContextMod.setContextValue('extractTaskDataFromDOM', deps.task?.extractTaskDataFromDOM);

  // Task operations used by menu buttons
  appContextMod.setContextValue('resetTasks', deps.task?.resetTasks);
  appContextMod.setContextValue('handleCompleteAllTasks', deps.task?.handleCompleteAllTasks);
  appContextMod.setContextValue('handleTaskCompletionChange', deps.task?.handleTaskCompletionChange);
  appContextMod.setContextValue('addTask', deps.task?.addTask);
  appContextMod.setContextValue('updateMoveArrowsVisibility', deps.task?.updateMoveArrowsVisibility);

  // UI operations used by uiBoot
  // initCompletedTasksSection is a wrapper around completedTasksManager.init()
  appContextMod.setContextValue('initCompletedTasksSection', () => deps.ui?.completedTasksManager?.init?.());
  appContextMod.setContextValue('initializeModeSelector', deps.cycle?.setupModeSelector);

  // Recurring panel
  appContextMod.setContextValue('recurringPanel', deps.recurring?.panel);

  // Device detection
  appContextMod.setContextValue('deviceDetectionManager', deps.utils?.deviceDetectionManager);

  // Utility functions that may be accessed via legacy getters
  appContextMod.setContextValue('showNotification', deps.utils?.showNotification);
  appContextMod.setContextValue('showConfirmationModal', deps.utils?.showConfirmationModal);
  appContextMod.setContextValue('showPromptModal', deps.utils?.showPromptModal);
  appContextMod.setContextValue('sanitizeInput', deps.utils?.sanitizeInput);
  appContextMod.setContextValue('generateId', deps.utils?.generateId);

  // Undo/redo functions (api: 'undo' maps to deps.ui via apiToCategory)
  appContextMod.setContextValue('performStateBasedUndo', deps.ui?.performStateBasedUndo);
  appContextMod.setContextValue('performStateBasedRedo', deps.ui?.performStateBasedRedo);
  appContextMod.setContextValue('updateUndoRedoButtons', deps.ui?.updateUndoRedoButtons);
  appContextMod.setContextValue('captureStateSnapshot', deps.ui?.captureStateSnapshot);
  appContextMod.setContextValue('enableUndoSystemOnFirstInteraction', deps.ui?.enableUndoSystemOnFirstInteraction);

  console.log('✅ Grouped APIs registered via moduleLoader');
}

/**
 * Validate that critical DI wiring is complete after boot
 * Warns about missing dependencies that could cause runtime issues
 *
 * @param {Object} deps - The deps container
 */
function validateCriticalDIWiring(deps) {
  console.log('🔍 Validating critical DI wiring...');

  const warnings = [];

  // Define critical wiring checks
  const checks = [
    // Notifications should have recurring functions
    {
      name: 'notifications → recurring',
      check: () => deps.recurring?.panel?.openRecurringSettingsPanelForTask,
      fix: 'Ensure recurring panel is loaded and openRecurringSettingsPanelForTask is injected into notifications'
    },
    // Core should have AppState
    {
      name: 'core → AppState',
      check: () => deps.core?.AppState,
      fix: 'Ensure AppState is created in coreBoot and stored in deps.core.AppState'
    },
    // Recurring panel should exist if recurring is enabled
    {
      name: 'recurring → panel',
      check: () => deps.recurring?.panel,
      fix: 'Ensure recurringIntegration module is loaded and panel is registered'
    },
    // Task module should exist
    {
      name: 'task → taskCore',
      check: () => deps.task?.taskCore || deps.task?.addTask,
      fix: 'Ensure taskCore module is loaded'
    },
    // Utils should have notifications
    {
      name: 'utils → notifications',
      check: () => deps.utils?.showNotification,
      fix: 'Ensure notifications is loaded in bootEarlyDeps'
    }
  ];

  // Run checks
  for (const { name, check, fix } of checks) {
    try {
      if (!check()) {
        warnings.push({ name, fix });
      }
    } catch (e) {
      warnings.push({ name, fix, error: e.message });
    }
  }

  // Report warnings
  if (warnings.length > 0) {
    console.warn('⚠️ DI Wiring Issues Detected:');
    for (const { name, fix, error } of warnings) {
      console.warn(`  ❌ ${name}: ${fix}${error ? ` (Error: ${error})` : ''}`);
    }
  } else {
    console.log('✅ All critical DI wiring validated');
  }
}
