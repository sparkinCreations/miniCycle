/**
 * ============================================================================
 * orchestrator.js - Boot Orchestration
 * ============================================================================
 * Location: modules/boot/orchestrator.js
 *
 * Welcome to miniCycle! - MJ, Developer
 * Website: https://sparkincreations.com | App: https://minicycleapp.com
 *
 * ============================================================================
 * BOOT FILE STRUCTURE (Dec 2025)
 * ============================================================================
 *
 * All boot files are now in modules/boot/:
 *
 * 1. modules/boot/coreBoot.js (~673 lines)
 *    - Core initialization (appInit, constants, GlobalUtils, migration)
 *    - AppState creation and initialization
 *    - Core data functions (loadMiniCycleData, autoSave, updateCycleData)
 *
 * 2. modules/boot/featureBoot.js (~1,470 lines)
 *    - Feature module loading and DI wiring
 *    - Window.* exposures for backward compatibility
 *
 * 3. modules/boot/uiBoot.js (~406 lines)
 *    - UI event handlers (keyboard, clicks, touch)
 *    - Loader/spinner helpers
 *
 * 4. modules/boot/orchestrator.js - THIS FILE
 *    - Coordinates boot sequence
 *    - Early module loading (before AppState)
 *    - UI setup and initialization
 *
 * LOAD ORDER:
 * -----------
 * miniCycle-main.js (entrypoint)
 *   → modules/boot/orchestrator.js (this file)
 *       → modules/boot/coreBoot.js
 *       → modules/boot/featureBoot.js
 *       → modules/boot/uiBoot.js
 *
 * ============================================================================
 */





// ============================================================================
// SECTION 1: GLOBAL STATE SETUP
// ============================================================================
// AppGlobalState, FeatureFlags, and backward-compatible property getters
// are now in modules/core/appGlobalState.js
//
// The module is imported synchronously at the top of Section 2 (DOMContentLoaded)
// to ensure it loads before any other modules.
//
// Exports from appGlobalState.js:
// - AppGlobalState: Runtime mutable state
// - FeatureFlags: Feature toggles
// - UNDO_LIMIT, UNDO_MIN_INTERVAL_MS: Constants
// - debugAppState(): Debug helper function
// ============================================================================

// Additional global variable for notification system compatibility
let isDraggingNotification = false;


/**  🚦 App Initialization Lifecycle Manager
// ✅ REMOVED: Old AppInit system replaced with proper appInit from appInitialization.js
// The new system provides 2-phase initialization:
// - Phase 1 (Core): AppState + cycle data loaded (use appInit.waitForCore())
// - Phase 2 (App): All modules initialized (use appInit.waitForApp())
//
// Old API mapping:
// - AppInit.onReady(fn) → Use appInit.waitForCore() in async functions
// - AppInit.isReady() → Use appInit.isCoreReady()
// - AppInit.signalReady() → Use appInit.markCoreSystemsReady()
**/

// ✅ Backward compatibility alias - will be set after appInit loads
window.AppInit = null; // Will be replaced with appInit below

// ============================================================================
// CRITICAL: Import coreBoot IMMEDIATELY to set window.AppBootStarted
// This MUST happen before DOMContentLoaded to prevent lite fallback
// ============================================================================
import('./coreBoot.js').catch(err => {
  console.error('❌ Failed to load coreBoot.js:', err);
});






// ============================================================================
// SECTION 2: DEPENDENCY INJECTION WIRING HUB
// ============================================================================
// Main application initialization sequence.
// This section loads all modules and wires their dependencies together.
// The `deps` container enables true DI - modules receive deps, not window.*
//
// Core initialization (AppGlobalState, appInit, constants, GlobalUtils, migration)
// is now handled by coreBoot.js

// Handle case where DOMContentLoaded may have already fired
async function initApp() {
    console.log('🚀 Starting miniCycle initialization (Schema 2.5 only)...');

  // ============================================
  // 🎯 LOAD BOOT MODULES
  // coreBoot: AppGlobalState, appInit, constants, GlobalUtils, migration
  // featureBoot: All feature module loading and DI wiring
  // ============================================
  const coreBoot = await import(`./coreBoot.js?v=${window.APP_VERSION || '1.470'}`);
  const { initCoreBoot, initAppState, loadMiniCycleData, autoSave, updateCycleData } = coreBoot;

  // Feature boot module - handles Phase 2 module loading
  const featureBoot = await import(`./featureBoot.js?v=${window.APP_VERSION || '1.470'}`);
  const { bootFeatures } = featureBoot;
  console.log('📦 Feature boot module loaded');

  // UI boot module - handles UI event listeners and helpers
  const uiBoot = await import(`./uiBoot.js?v=${window.APP_VERSION || '1.470'}`);
  const { attachGlobalEventListeners, attachTaskInputListeners, attachMenuButtonListener, hideAppLoader } = uiBoot;
  console.log('📦 UI boot module loaded');

  // ============================================
  // 🎯 DEPENDENCY CONTAINER
  // This object collects all module references for true dependency injection.
  // Modules receive deps instead of reaching for window.*
  // See: docs/future-work/MODULAR_OVERHAUL_PLAN.md
  // ============================================
  const deps = {
    // Will be populated as modules are loaded
    // Core utilities
    utils: {},
    // Feature modules
    features: {},
    // UI modules
    ui: {},
    // Core systems (AppState, appInit, etc.)
    core: {},
    // Task modules
    task: {},
    // Cycle modules
    cycle: {},
    // Recurring task modules
    recurring: {},
    // Progress/stats modules
    progress: {},
    // Storage/backup modules
    storage: {},
    // Testing modules
    testing: {}
  };

  // Initialize core boot (AppGlobalState, appInit, constants, GlobalUtils, migration)
  const coreResult = await initCoreBoot(deps);
  if (!coreResult) {
    // Reload happening due to stale cache, bail out
    console.log('⏳ Core boot initiated reload...');
    return;
  }

  // Extract core references for local use
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

  console.log('✅ Core boot complete');

// ======================================================================
// 🚀 APPINIT-COMPLIANT INITIALIZATION SEQUENCE
// ======================================================================
// Following APPINIT_INTEGRATION_PLAN.md structure:
// PHASE 1 (CORE): Basic utilities → Migration Manager → AppState → Mark core ready
//   ✅ Now handled by app-coreBoot.js (AppGlobalState, appInit, constants, GlobalUtils, migration)
// PHASE 2 (MODULES): DragDrop, Stats, Recurring, DeviceDetection
// PHASE 3 (UI/DATA): Load data, setup UI, wire event listeners
// ======================================================================

  // ============================================================
  // PHASE 1: CORE SYSTEMS (Partially in app-coreBoot.js)
  // ============================================================
  console.log('🔧 Phase 1: Initializing remaining core systems...');





    /******
     * UTILITY MODULE IMPORTS & INITIALIZATION
     *
     * Core utilities (GlobalUtils) are now loaded by app-coreBoot.js
     * This section continues with remaining utility modules:
     *
     * 1. Error handler (global error handling)
     * 2. Data validator (input validation)
     * 3. Console capture system (debugging & diagnostics)
     * 4. Notification system (user feedback & alerts)
     *
     * All modules are made globally accessible for cross-component communication.
     ******/

    // ============================================
    // MODULE LOADING WITH DEPENDENCY COLLECTION
    // All modules loaded with withV() for cache-busting
    // ============================================

    // ✅ GlobalUtils already loaded by app-coreBoot.js and stored in deps.utils
    // Just log confirmation
    console.log('🛠️ Global utilities already loaded by app-coreBoot.js');

    // ✅ Load Error Handler (DI-pure - wiring done after notifications load)
    const errorHandlerMod = await import(withV('../utils/errorHandler.js'));
    deps.utils.setErrorHandlerDependencies = errorHandlerMod.setErrorHandlerDependencies;
    console.log('🛡️ Global error handlers initialized');

    // ✅ Load Data Validator (needed before settingsManager)
    const dataValidatorMod = await import(withV('../utils/dataValidator.js'));
    // Wire dependency using deps container (true DI pattern)
    dataValidatorMod.setDataValidatorDependencies({
        sanitizeInput: deps.utils.sanitizeInput
    });
    deps.utils.DataValidator = dataValidatorMod.DataValidator;
    // Still expose to window for backward compat
    window.DataValidator = dataValidatorMod.DataValidator;
    console.log('🛡️ Data Validator loaded');

    // ✅ Load Console Capture (DI-pure)
    const consoleCaptureMod = await import(withV('../utils/consoleCapture.js'));

    // Wire dependencies for ConsoleCapture (DI-pure)
    if (consoleCaptureMod.setConsoleCaptureDependencies) {
        consoleCaptureMod.setConsoleCaptureDependencies({
            showNotification: deps.utils.showNotification,
            get appendToTestResults() { return window.appendToTestResults; }
        });
    }

    window.consoleCapture = consoleCaptureMod.default;
    window.ConsoleCapture = consoleCaptureMod.default;  // Alias for testing-modal-integration

    // ✅ Load Notifications (DI-pure)
    const notificationsMod = await import(withV('../utils/notifications.js'));

    // Set early dependencies (others set later when available)
    notificationsMod.setNotificationsDependencies({
        // These will be available later - use deferred getters
        AppState: null, // Set after AppState is created
        appInit: appInit,  // ✅ DI-injected (no static import in module)
        loadMiniCycleData: () => window.loadMiniCycleData?.(),
        generateHashId: (...args) => window.generateHashId?.(...args),
        GlobalUtils: window.GlobalUtils,
        escapeHtml: (...args) => window.escapeHtml?.(...args),
        safeAddEventListener: GlobalUtils.safeAddEventListener
    });

    const notifications = new notificationsMod.MiniCycleNotifications();

    // Store in deps container - this is the canonical reference
    deps.utils.notifications = notifications;
    deps.utils.showNotification = (message, type, duration) => notifications.show(message, type, duration);
    deps.utils.setNotificationsDependencies = notificationsMod.setNotificationsDependencies;

    // Still expose to window for backward compat - all notification functions point directly to module
    window.notifications = notifications;
    window.showNotification = (message, type, duration) => notifications.show(message, type, duration);
    window.showNotificationWithTip = (content, type, duration, tipId) => notifications.showWithTip(content, type, duration, tipId);
    window.showApplyConfirmation = (targetElement) => notifications.showApplyConfirmation(targetElement);
    window.showConfirmationModal = (options) => notifications.showConfirmationModal(options);
    window.showPromptModal = (options) => notifications.showPromptModal(options);
    window.setupNotificationDragging = (container) => notifications.setupNotificationDragging(container);
    window.resetNotificationPosition = () => notifications.resetPosition();
    console.log('✅ Notifications loaded');

    // Show deferred cache notification if we had to fetch fresh appInit.js
    if (window.AppGlobalState.pendingCacheNotification) {
      notifications.show('App updated! Cache refreshed automatically.', 'info', 4000);
      window.AppGlobalState.pendingCacheNotification = false;
    }

    // ✅ Wire ErrorHandler now that showNotification is available
    deps.utils.setErrorHandlerDependencies({
        showNotification: deps.utils.showNotification
    });

    // ✅ Wire GlobalUtils now that showNotification is available (DI-pure)
    // setGlobalUtilsDependencies was stored in deps.utils by app-coreBoot.js
    if (deps.utils.setGlobalUtilsDependencies) {
        deps.utils.setGlobalUtilsDependencies({
            showNotification: deps.utils.showNotification
        });
    }

    // ✅ Load Theme Manager
    const themeManagerMod = await import(withV('../features/themeManager.js'));
    window.ThemeManager = themeManagerMod.default;
    window.themeManager = themeManagerMod.themeManager;
    window.applyTheme = themeManagerMod.applyTheme;
    window.updateThemeColor = themeManagerMod.updateThemeColor;
    window.setupDarkModeToggle = themeManagerMod.setupDarkModeToggle;
    window.setupQuickDarkToggle = themeManagerMod.setupQuickDarkToggle;
    window.unlockDarkOceanTheme = themeManagerMod.unlockDarkOceanTheme;
    window.unlockGoldenGlowTheme = themeManagerMod.unlockGoldenGlowTheme;
    window.initializeThemesPanel = themeManagerMod.initializeThemesPanel;
    window.refreshThemeToggles = themeManagerMod.refreshThemeToggles;
    window.setupThemesPanel = themeManagerMod.setupThemesPanel;
    window.setupThemesPanelWithData = themeManagerMod.setupThemesPanelWithData;
    // ✅ Inject available deps early (AppState injected later after it's created)
    if (themeManagerMod.setThemeManagerDependencies) {
        themeManagerMod.setThemeManagerDependencies({
            appInit: appInit,  // ✅ DI-injected (no static import in module)
            showNotification: deps.utils.showNotification
            // AppState and hideMainMenu injected later
        });
    }
    console.log('✅ Theme Manager loaded');

    // ✅ Load Games Manager (DI-pure)
    const gamesManagerMod = await import(withV('../ui/gamesManager.js'));
    // Inject dependencies (DI-pure)
    if (gamesManagerMod.setGamesManagerDependencies) {
        gamesManagerMod.setGamesManagerDependencies({
            appInit: appInit,  // ✅ DI-injected (no static import in module)
            AppMeta: window.AppMeta,
            get AppState() { return window.AppState; },  // Lazy getter for late binding
            safeAddEventListener: deps.utils.safeAddEventListener
        });
    }
    // Expose to window immediately
    window.GamesManager = gamesManagerMod.default;
    window.gamesManager = gamesManagerMod.gamesManager;
    window.unlockMiniGame = (...args) => gamesManagerMod.gamesManager?.unlockMiniGame?.(...args);
    window.checkGamesUnlock = (...args) => gamesManagerMod.gamesManager?.checkGamesUnlock?.(...args);
    // ✅ Initialize AFTER dependencies are set (DI-pure pattern)
    // NOTE: Don't await - init() waits for core internally, which hasn't been marked ready yet
    window.gamesManager.init();
    console.log('✅ Games Manager loaded');

    // ✅ Load Onboarding Manager (DI-pure)
    const onboardingManagerMod = await import(withV('../ui/onboardingManager.js'));
    // Inject dependencies (DI-pure, use lazy getters for late-available deps)
    if (onboardingManagerMod.setOnboardingManagerDependencies) {
        onboardingManagerMod.setOnboardingManagerDependencies({
            appInit: appInit,  // ✅ DI-injected (no static import in module)
            AppMeta: window.AppMeta,
            showNotification: deps.utils.showNotification,
            get AppState() { return window.AppState; },
            get showCycleCreationModal() { return window.showCycleCreationModal; },
            get completeInitialSetup() { return window.completeInitialSetup; },
            get safeAddEventListenerById() { return window.GlobalUtils?.safeAddEventListenerById; }
        });
    }
    window.onboardingManager = onboardingManagerMod.onboardingManager;
    // Initialize AFTER dependencies are set (fixes race condition)
    // NOTE: Don't await - init() waits for core internally, which hasn't been marked ready yet
    window.onboardingManager.init();
    console.log('✅ Onboarding Manager loaded');

    // ✅ Load Modal Manager (Phase 3 - no auto-init, initialized later with full deps)
    const modalManagerMod = await import(withV('../ui/modalManager.js'));
    // Note: modalManager instance is null until initModalManager is called later
    console.log('✅ Modal Manager module loaded (awaiting initialization)');

    // ✅ Migration Manager already loaded by app-coreBoot.js
    // Now initialize AppState with showNotification available
    console.log('🗃️ Initializing AppState (after notifications ready)...');
    await initAppState(deps, deps.utils.showNotification);
    console.log('✅ AppState initialized via app-coreBoot.js');

    // ✅ NOW it's safe to set up UI components that may call loadMiniCycleData()
    console.log('🎨 Setting up UI components (after migration manager)...');

    // Centralized overlay detection for UI state management
    window.isOverlayActive = function() {
        if (document.querySelector(".menu-container.visible")) return true;
        
        const overlaySelectors = [
            '.settings-modal[style*="display: flex"]',
            '.mini-cycle-switch-modal[style*="display: flex"]',
            '#feedback-modal[style*="display: flex"]',
            '#about-modal[style*="display: flex"]',
            '#themes-modal[style*="display: flex"]',
            '#games-panel[style*="display: flex"]',
            '#reminders-modal[style*="display: flex"]',
            '#testing-modal[style*="display: flex"]',
            '#recurring-panel-overlay:not(.hidden)',
            '.notification-container .notification',
            '#storage-viewer-overlay:not(.hidden)',
            '.mini-modal-overlay',
            '.miniCycle-overlay',
            '.onboarding-modal:not([style*="display: none"])'
        ];
        
        return overlaySelectors.some(selector => document.querySelector(selector));
    };

    // Navigation dots for task/stats panel switching
    function updateNavDots() {
        const statsPanel = document.getElementById("stats-panel");
        const statsVisible = statsPanel && statsPanel.classList.contains("show");
        const dots = document.querySelectorAll(".dot");

        if (dots.length === 2) {
            dots[0].classList.toggle("active", !statsVisible);
            dots[1].classList.toggle("active", statsVisible);
        }
    }
    
    window.updateNavDots = updateNavDots;


    // ✅ DOM Element References
    const taskInput = document.getElementById("taskInput");
   const addTaskButton = document.getElementById("addTaskBtn");
    const taskList = document.getElementById("taskList");
    const progressBar = document.getElementById("progressBar");
    const completeAllButton = document.getElementById("completeAll");
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const menuButton = document.querySelector(".menu-button");
    const menu = document.querySelector(".menu-container");
    const exitMiniCycle = document.getElementById("exit-mini-cycle");
    const feedbackModal = document.getElementById("feedback-modal");
    const openFeedbackBtn = document.getElementById("open-feedback-modal");
    const closeFeedbackBtn = document.querySelector(".close-feedback-modal");
    const submitFeedbackBtn = document.getElementById("submit-feedback");
    const feedbackText = document.getElementById("feedback-text");
    const openUserManual = document.getElementById("open-user-manual");
    const enableReminders = document.getElementById("enableReminders");
    const enableTaskReminders = document.getElementById("enable-task-reminders");
    const indefiniteCheckbox = document.getElementById("indefiniteCheckbox");
    const repeatCountRow = document.getElementById("repeat-count-row");
    const frequencySection = document.getElementById("frequency-section");
    const remindersModal = document.getElementById("reminders-modal");
    const closeRemindersBtn = document.getElementById("close-reminders-btn");
    const closeMainMenuBtn = document.getElementById("close-main-menu");
    const themeUnlockMessage = document.getElementById("theme-unlock-message");
    const themeUnlockStatus = document.getElementById("theme-unlock-status");
    const selectedYearlyDays = {}; // key = month number, value = array of selected days
    const yearlyApplyToAllCheckbox = document.getElementById("yearly-apply-days-to-all");

    // ✅ Dark Mode Toggle Setup (Schema 2.5)
    const quickToggle = document.getElementById("quick-dark-toggle");
    let darkModeEnabled = false;


    try {
        const schemaData = loadMiniCycleData();
        if (schemaData) {
            darkModeEnabled = schemaData.settings.darkMode || false;
        }
    } catch (error) {
        console.warn('⚠️ Could not load dark mode setting, using default');
    }

    if (quickToggle) {
        quickToggle.textContent = darkModeEnabled ? "☀️" : "🌙";
    }

    // === 🎯 Constants for event delegation targets ===
    const RECURRING_CLICK_TARGETS = [
        ".weekly-day-box",
        ".biweekly-day-box",
        ".monthly-day-box",
        ".yearly-day-box",
        ".yearly-month-box"
    ];
    
    const RECURRING_CHANGE_TARGETS = [
        "input",
        "select",
        "#yearly-apply-days-to-all"
    ];
    
    // === 🔁 Delegated Change Handler ===
    const handleRecurringChange = (e) => {
        const isMatch = RECURRING_CHANGE_TARGETS.some(selector =>
            e.target.matches(selector)
        );
        if (isMatch) {
            if (window.recurringPanel?.updateRecurringSummary) window.recurringPanel.updateRecurringSummary();
        }
    };
    
    // === 🔁 Delegated Click Handler ===
    const handleRecurringClick = (e) => {
        const isMatch = RECURRING_CLICK_TARGETS.some(selector =>
            e.target.matches(selector)
        );
        if (isMatch) {
            if (window.recurringPanel?.updateRecurringSummary) window.recurringPanel.updateRecurringSummary();
        }
    };
    
    // === 🧠 Attach Delegated Listeners ===
// ✅ REMOVED: attachRecurringSummaryListeners - now handled by recurringCore/recurringPanel modules

    const DRAG_THROTTLE_MS = 50;
    // TASK_LIMIT is now from app-coreBoot.js (coreResult.TASK_LIMIT)

    // ✅ Initialize app with proper error handling and Schema 2.5 focus
    console.log('🔧 Starting core initialization sequence...');


    

    // ✅ UI Component Setup - MOVED to async block after migration manager loads
    console.log('🎨 UI Component Setup will run after migration manager loads...');

    // ✅ Stats and Navigation
    console.log('📊 Updating stats and navigation...');
    updateNavDots();


    // ✅ Theme Loading (Schema 2.5 only) - don't save during initial load
    console.log('🎨 Loading theme settings...');
    try {
        const schemaData = loadMiniCycleData();
        if (schemaData && schemaData.settings.theme) {
            console.log('🎨 Applying theme from Schema 2.5:', schemaData.settings.theme);
            applyTheme(schemaData.settings.theme, false);  // Don't save during initial load
        } else {
            console.log('🎨 Using default theme');
            applyTheme('default', false);  // Don't save during initial load
        }
    } catch (error) {
        console.warn('⚠️ Theme loading failed, using default:', error);
        applyTheme('default', false);  // Don't save during initial load
    }

    // ✅ MOVED TO PHASE 2: cycleLoader initialization moved after AppState is ready
    // This prevents capturing null AppState reference
    // See Phase 2 initialization section (line ~1152) for cycleLoader setup

    // ✅ Feature Setup
    console.log('⚙️ Setting up features...');
    setupMiniCycleTitleListener();
    // ✅ MOVED TO PHASE 2: setupDownloadMiniCycle() - now handled by settingsManager module
    // ✅ MOVED TO PHASE 2: setupUploadMiniCycle() - now handled by settingsManager module
    // ✅ REMOVED: setupRearrange() and dragEndCleanup() - now handled by dragDropManager module
    // ✅ MOVED: updateMoveArrowsVisibility() to AppInit.onReady() where AppState is available
    initializeThemesPanel();
    setupThemesPanel();

    // ✅ UI Setup (Modal Manager handles modal setup automatically)
    // ✅ MOVED TO PHASE 2: setupMainMenu() - now handled by menuManager module
    // ✅ MOVED TO PHASE 2: setupSettingsMenu() - now handled by settingsManager module
    setupUserManual();

    // ✅ Expose functions needed by cycleLoader and cycleManager
    // Note: updateMainMenuHeader now exported by menuManager module
    // ✅ completeInitialSetup now delegates to appInit method (extracted from main script)
    window.completeInitialSetup = (activeCycle, fullSchemaData, schemaData) =>
        appInit.runCompleteInitialSetup(activeCycle, fullSchemaData, schemaData);



// ...existing code...

// ✅ wireUndoRedoUI moved to modules/ui/undoRedoManager.js

// ✅ Data-ready initialization - runs immediately (no more deferral needed)
// The code below will execute after data is loaded in the main sequence
// NOTE: AppState initialization is now handled by initAppState() in app-coreBoot.js
// which was called earlier after notifications were loaded (line ~363)
(async () => {
  console.log('🟢 Data-ready initializers running…');

  // ✅ AppState already initialized via initAppState() in app-coreBoot.js
  // Update notifications with AppState now available
  if (deps.utils.setNotificationsDependencies) {
      deps.utils.setNotificationsDependencies({
          AppState: window.AppState
      });
  }

  try {
        // ✅ Core systems already marked ready by initAppState()
        console.log('✅ Core systems already initialized by app-coreBoot.js');

        // ============ PHASE 2: MODULES ============
        // Feature module loading now handled by app-featureBoot.js
        console.log('🔌 Phase 2: Loading modules via bootFeatures...');

        const featureResult = await bootFeatures(deps, coreResult);
        console.log('✅ bootFeatures complete:', Object.keys(featureResult.managers).length, 'managers,', Object.keys(featureResult.modules).length, 'modules');

        // ✅ Mark Phase 2 complete - all modules are now loaded and ready
        console.log('✅ Phase 2 complete - all modules initialized');

        // ============ PHASE 3: DATA LOADING ============
        console.log('📊 Phase 3: Loading app data...');

        // 🎯 Now that all modules are ready, load data
        try {
          console.log('🔧 Running fixTaskValidationIssues...');
          window.fixTaskValidationIssues?.();

          console.log('🚀 Running initializeAppWithAutoMigration...');
          // ✅ IMPORTANT: initializeAppWithAutoMigration calls initialSetup() after Phase 2 modules are ready
          await initializeAppWithAutoMigration({ forceMode: true }); // will call initialSetup() async
          console.log('✅ Data initialization sequence started');
        } catch (error) {
          console.error('❌ Critical initialization error:', error);
          console.error('❌ Error stack:', error.stack);
        }

        // ✅ Setup taskCore event listeners (after taskCore loaded in Phase 2)
        try {
          const completeAllButton = document.getElementById("completeAll");
          if (completeAllButton && typeof window.handleCompleteAllTasks === 'function') {
            GlobalUtils.safeAddEventListener(completeAllButton, "click", window.handleCompleteAllTasks);
            console.log('✅ Complete All button listener attached');
          }
        } catch (eventErr) {
          console.warn('⚠️ Failed to setup Complete All listener:', eventErr);
        }

        // ✅ Undo/Redo buttons already wired in Phase 2 (undoRedoManager module)

        // 🧰 Centralize undo snapshots on AppState.update (wrap once)
        try {
          if (!window.AppGlobalState.wrappedAppStateUpdate) {
            // Bind methods to preserve `this`
            const boundUpdate = window.AppState.update.bind(window.AppState);
            const boundGet = typeof window.AppState.get === 'function'
              ? window.AppState.get.bind(window.AppState)
              : null;

             window.AppState.update = async (producer, immediate) => {
              try {
                // ✅ Use new appInit API
                if (window.appInit?.isCoreReady?.() && !window.AppGlobalState.isPerformingUndoRedo && boundGet) {
                  const prev = boundGet();
                  if (prev && typeof window.captureStateSnapshot === 'function') {
                    window.captureStateSnapshot(prev);
                  }
                }
              } catch (e) {
                console.warn('⚠️ Undo snapshot wrapper error:', e);
              }
              return boundUpdate(producer, immediate);
            };

            window.AppGlobalState.wrappedAppStateUpdate = true;
            window.AppGlobalState.useUpdateWrapper = true; // ✅ wrapper becomes single snapshot source
            console.log('🧰 Undo snapshots centralized on AppState.update (bound)');
          }
        } catch (e) {
          console.warn('⚠️ Failed to wrap AppState.update:', e);
        }

        // ✅ State-based undo/redo subscription already set up in Phase 2 (undoRedoManager module)

        // 🔘 Update button states and capture an initial snapshot
        try {
          if (typeof window.updateUndoRedoButtons === 'function') {
            window.updateUndoRedoButtons();
          }

          // Only capture initial snapshot if not using the update wrapper
          if (!window.AppGlobalState.useUpdateWrapper) {
            setTimeout(() => {
              try {
                const st = window.AppState.get?.();
                if (st && typeof window.captureStateSnapshot === 'function') {
                  window.captureStateSnapshot(st);
                }
              } catch (e) {
                console.warn('⚠️ Initial snapshot failed:', e);
              }
            }, 50);
          }
        } catch (uiErr) {
          console.warn('⚠️ Undo/redo UI init failed:', uiErr);
        }

        // ✅ LAZY LOAD Testing Modal - only loads when button is clicked
        let testingModalMod = null;
        let testingModalLoaded = false;

        const openTestingBtn = document.getElementById('open-testing-modal');
        if (openTestingBtn) {
            openTestingBtn.addEventListener('click', async (e) => {
                // If already loaded, the module's own click handler will open it
                if (testingModalLoaded) return;

                e.stopPropagation();
                console.log('🔬 Lazy loading testing modal...');
                deps.utils.showNotification?.('🔬 Loading diagnostics...', 'info', 2000);

                try {
                    // Load modules on-demand
                    testingModalMod = await import(withV('../testing/testing-modal.js'));
                    console.log('✅ Testing modal loaded (lazy)');

                    // Expose testing modal functions to window
                    if (testingModalMod.openStorageViewer) window.openStorageViewer = testingModalMod.openStorageViewer;
                    if (testingModalMod.closeStorageViewer) window.closeStorageViewer = testingModalMod.closeStorageViewer;
                    if (testingModalMod.appendToTestResults) window.appendToTestResults = testingModalMod.appendToTestResults;
                    if (testingModalMod.clearTestResults) window.clearTestResults = testingModalMod.clearTestResults;
                    if (testingModalMod.exportTestResults) window.exportTestResults = testingModalMod.exportTestResults;
                    if (testingModalMod.copyTestResults) window.copyTestResults = testingModalMod.copyTestResults;

                    const testingIntegrationMod = await import(withV('../testing/testing-modal-integration.js'));

                    // Wire dependencies for testing-modal-integration (DI-pure)
                    if (testingIntegrationMod.setTestingModalDependencies) {
                        testingIntegrationMod.setTestingModalDependencies({
                            safeAddEventListenerById: deps.utils.safeAddEventListenerById,
                            showNotification: deps.utils.showNotification,
                            get ConsoleCapture() { return window.ConsoleCapture; }
                        });
                    }

                    // Inject dependencies into Testing Modal
                    if (testingModalMod.setTestingModalDependencies) {
                        testingModalMod.setTestingModalDependencies({
                            AppState: window.AppState,
                            BackupManager: window.BackupManager,
                            notifications: deps.utils.notifications,
                            showNotification: deps.utils.showNotification,
                            deleteStorageItem: (key, storageType) => {
                                const storage = storageType === 'local' ? localStorage : sessionStorage;
                                storage.removeItem(key);
                            },
                            safeAddEventListener: GlobalUtils.safeAddEventListener,
                            safeAddEventListenerById: GlobalUtils.safeAddEventListenerById,
                            setupAutomatedTestingFunctions: () => window.setupAutomatedTestingFunctions?.(),
                            startAutoConsoleCapture: () => window.startAutoConsoleCapture?.(),
                            isConsoleCapturing: () => window.consoleCapturing || false
                        });
                    }

                    // Setup testing modal
                    if (typeof testingModalMod.setupTestingModal === 'function') {
                        testingModalMod.setupTestingModal();
                        window.setupTestingModal = testingModalMod.setupTestingModal;
                    }

                    // Initialize enhancements
                    if (typeof testingModalMod.initializeTestingModalEnhancements === 'function') {
                        testingModalMod.initializeTestingModalEnhancements();
                        window.initializeTestingModalEnhancements = testingModalMod.initializeTestingModalEnhancements;
                    }

                    testingModalLoaded = true;
                    console.log('✅ Testing modal initialized (lazy)');

                    // Now open the modal
                    const testingModal = document.getElementById('testing-modal');
                    if (testingModal) {
                        testingModal.style.display = 'flex';
                    }
                } catch (error) {
                    console.error('❌ Failed to load testing modal:', error);
                    deps.utils.showNotification?.('❌ Failed to load diagnostics', 'error', 3000);
                }
            });
            console.log('✅ Testing modal lazy loader attached');
        }

        // ✅ Initialize Backup Manager (DI-pure)
        console.log('💾 Loading backup manager...');
        let backupManagerInstance = null;
        try {
            const backupManagerMod = await import(withV('../storage/backupManager.js'));

            // Wire dependencies (DI-pure)
            if (backupManagerMod.setBackupManagerDependencies) {
                backupManagerMod.setBackupManagerDependencies({
                    get AppState() { return window.AppState; }  // Lazy getter for late binding
                });
            }

            backupManagerInstance = backupManagerMod.default;
            window.BackupManager = backupManagerInstance;  // Expose for backward compat
            console.log('✅ Backup manager loaded');

            // ✅ Create auto-backup in background (non-blocking)
            if (backupManagerInstance) {
                // Don't await - run in background
                backupManagerInstance.createAutoBackup()
                    .then(created => {
                        if (created) {
                            console.log('✅ Auto-backup created successfully');
                        } else {
                            console.log('⏭️ Auto-backup skipped (recent backup exists)');
                        }
                    })
                    .catch(error => {
                        console.warn('⚠️ Auto-backup failed (non-critical):', error);
                    });
            }
        } catch (error) {
            console.error('❌ Failed to load backup manager:', error);
            console.warn('⚠️ App will continue without auto-backup functionality');
        }

        // Optional debug subscribe
        window.AppState.subscribe('debug', (newState, oldState) => {
          console.log('🔄 State changed:', {
            timestamp: new Date().toISOString(),
            activeCycle: newState.appState.activeCycleId,
            taskCount:
              newState.data.cycles[newState.appState.activeCycleId]?.tasks?.length || 0
          });
        });
  } catch (error) {
    console.warn('⚠️ State module initialization failed, using legacy methods:', error);
    window.AppState = null;
  }

  // ✅ REMOVED: No more setTimeout hacks - InitGuard handles timing
  // ✅ REMOVED: No more deferred queue processing - modules wait for core via AppInit

  // ✅ Recurring Features - now handled by recurringIntegration module
  // Old initialization code removed - see modules/recurring/recurringIntegration.js
  console.log('🔁 Recurring features initialized via recurringIntegration module');

  // ✅ Mode Selector (with delay for DOM readiness)
  console.log('🎯 Initializing mode selector...');
  window.initializeModeSelector?.(); // This calls setupModeSelector()

  // ✅ Reminder System (with staggered timing)
  console.log('🔔 Setting up reminder system...');

  // ✅ setupReminderToggle() now handled by reminderManager.init() in Phase 2

  setTimeout(() => {
    try {
      window.remindOverdueTasks?.();
    } catch (error) {
      console.warn('⚠️ Overdue task reminder failed:', error);
    }
  }, 2000);
  // ✅ checkDueDates now handled by dueDatesManager.init() in Phase 2

  setTimeout(() => {
    try {
      window.updateReminderButtons?.(); // ✅ This is the *right* place!
      window.startReminders?.();
    } catch (error) {
      console.warn('⚠️ Reminder system setup failed:', error);
    }
  }, 200);

  // ✅ Note: setupRecurringWatcher() is now called by initializeRecurringModules() below
  // No need to call it here - it would cause "setupRecurringWatcher is not defined" error

  // ✅ Final Setup
  console.log('🎯 Completing initialization...');

  // ✅ MOVED: DragDropManager initialization moved earlier (before markCoreSystemsReady)
  // See line ~668 for the new location

  // ✅ Now that AppState is ready, setup arrow visibility
  window.updateMoveArrowsVisibility?.();

  // ✅ App already marked as ready at line 777 after Phase 2 modules loaded
  console.log('✅ miniCycle initialization complete - app is ready');

  // ✅ Initialize completed tasks section
  if (typeof window.initCompletedTasksSection === 'function') {
    window.initCompletedTasksSection();
  }

  // ✅ Keep isInitializing true - will be disabled on first user interaction
  // This prevents the undo button from appearing on page load
  console.log('✅ Initialization complete - undo system will activate on first user action');

  // ✅ Run device detection (now uses appInit.waitForCore() internally - no setTimeout needed)
  console.log('📱 Running device detection...');
  if (window.deviceDetectionManager && window.loadMiniCycleData) {
    await window.deviceDetectionManager.autoRedetectOnVersionChange();
  } else {
    // Not critical - device detection will be available on next full load
    console.log('⏭️ Skipping device detection (not fully initialized yet)');
  }

  window.onload = () => {
    if (taskInput) {
      taskInput.focus();
    }
  };
})(); // ✅ End of async IIFE - executes immediately
// ...existing code...

// ...existing code...





    
  



// ✅ REMOVED: Duplicate recurring modules initialization
// Now handled in Phase 2 (see line ~712)

















// ==== 🔁 UNDO / REDO SYSTEM =============================
// - Tracks task + recurring state snapshots
// - Limit: 4 snapshots
// - Functions: pushUndoSnapshot, performUndo, performRedo
// ========================================================







 // ✅ Add this new function
// ✅ All undo/redo functions moved to modules/ui/undoRedoManager.js:
// - initializeUndoRedoButtons
// - captureInitialSnapshot
// - setupStateBasedUndoRedo
// - enableUndoSystemOnFirstInteraction
// ✅ refreshUIFromState, captureStateSnapshot, updateUndoRedoButtons moved to modules
// Using deferred dependency injection pattern: () => window.functionName?.()
// This allows modules to be injected before they're fully loaded (follows modularization guide v4)














// Undo "Z" and Redo "Y" keyboard shortcuts (state-based)
function handleUndoRedoKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        window.performStateBasedUndo?.();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        window.performStateBasedRedo?.();
    }
}
GlobalUtils.safeAddEventListener(document, "keydown", handleUndoRedoKeydown);


// ============================================================================
// SECTION 3: RUNTIME FUNCTIONS (Lines 2556-3776)
// ============================================================================
// Core task orchestration, fallback functions, and small event handlers.
// These functions share closure-scoped variables with the DI wiring above.
//
// EXTRACTIONS COMPLETED (Dec 2025):
// ✅ saveToggleAutoReset → cycle/modeManager.js
// ✅ createTaskLabel/createTaskCheckbox → task/taskDOM.js
// ✅ Completed Tasks (9 funcs) → ui/completedTasksManager.js
// ✅ Progress system (7 funcs) → progress/cycleCompletion.js
// See: docs/future-work/REMAINING_EXTRACTIONS_ANALYSIS.md
// ============================================================================

// Note: generateNotificationId and generateHashId are in modules/utils/globalUtils.js

/**
 * Detects the device type and applies the appropriate class to the body.
 * Determines if the device has touch capabilities or a fine pointer (mouse).
 */
function detectDeviceType() {
    let hasTouchEvents = "ontouchstart" in window;
    let touchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints;
    let isFinePointer = window.matchMedia("(pointer: fine)").matches;

    console.log(`touch detected: hasTouchEvents=${hasTouchEvents}, maxTouchPoints=${touchPoints}, isFinePointer=${isFinePointer}`);

    if (!isFinePointer && (hasTouchEvents || touchPoints > 0)) {
        document.body.classList.add("touch-device");
    } else {
        document.body.classList.add("non-touch-device");
    }
}
if (!window.deviceDetectionManager) {
  detectDeviceType();
}


// ✅ MOVED: refreshTaskListUI to modules/ui/taskUI.js


// ✅ REMOVED: initializeDefaultRecurringSettings - now handled by recurringCore module

// ...existing code...



// Helper function to get readable mode name (keep this)


// ✅ EXTRACTED: initialSetup() and completeInitialSetup() moved to modules/core/appInit.js
// Now accessed via appInit.runInitialSetup() and appInit.runCompleteInitialSetup()
// window.completeInitialSetup is a wrapper that delegates to appInit method









// Update your existing setupDarkModeToggle function to include quick toggle


// setupQuickDarkToggle function


// ✅ Dynamic Theme Color System with Gradient-Matching Solid Colors

  
  // Optional helper to format checkbox IDs
/**
 * Enables editing of the miniCycle title and saves changes to localStorage.
 * Prevents empty titles and restores the previous title if an invalid entry is made.
 */

// Named handler for title blur - defined at module level for safeAddEventListener
async function handleMiniCycleTitleBlur() {
    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return;

    let newTitle = window.sanitizeInput(titleElement.textContent.trim());

    if (newTitle === "") {
        console.log('Empty title detected, reverting (Schema 2.5 only)...');

        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('Schema 2.5 data required for title revert');
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const oldTitle = cycles[activeCycle]?.title || "Untitled miniCycle";

        window.showNotification?.("Title cannot be empty. Reverting to previous title.");
        titleElement.textContent = oldTitle;
        return;
    }

    console.log('Updating title (Schema 2.5 only)...');
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('Schema 2.5 data required for setupMiniCycleTitleListener');
        return;
    }

    const { cycles, activeCycle } = schemaData;
    const miniCycleData = cycles[activeCycle];
    if (!activeCycle || !miniCycleData) {
        console.warn("No active miniCycle found. Title update aborted.");
        return;
    }

    const oldTitle = miniCycleData.title;
    if (newTitle !== oldTitle) {
        console.log(`Title change detected: "${oldTitle}" → "${newTitle}"`);

        // Update via AppState only (no direct localStorage fallback)
        if (window.AppState?.isReady?.()) {
            await window.AppState.update(state => {
                const cid = state?.appState?.activeCycleId;
                const cycle = state?.data?.cycles?.[cid];
                if (cycle) cycle.title = newTitle;
            }, true);
        } else {
            // AppState should always be ready by this point
            console.error('Title update failed: AppState not ready');
            window.showNotification?.('Failed to save title change', 'error');
            titleElement.textContent = oldTitle; // Revert UI
            return;
        }

        // Refresh UI
        window.updateMainMenuHeader?.();
        window.updateUndoRedoButtons?.();
    }
}

function setupMiniCycleTitleListener() {
    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return;

    titleElement.contentEditable = true;

    // safeAddEventListener handles duplicate prevention - no dataset flag needed
    GlobalUtils.safeAddEventListener(titleElement, "blur", handleMiniCycleTitleBlur);
}

// ==========================================
// 🔄 CORE DATA FUNCTIONS
// ==========================================
// autoSave, loadMiniCycleData, and updateCycleData are now in app-coreBoot.js
// They are imported at initialization and exposed on window.*
// See app-coreBoot.js for implementation details





// ✅ EXTRACTED: remindOverdueTasks moved to modules/features/dueDates.js
// Now accessed via window.remindOverdueTasks (set during dueDates module init)











function handleIndefiniteCheckboxChange() {
  // If indefinite, hide the repeatCount row
  repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
}
GlobalUtils.safeAddEventListener(indefiniteCheckbox, "change", handleIndefiniteCheckboxChange);



// All functions are globally accessible via:
// - window.reminderManager (the module instance)
// - window.startReminders(), window.stopReminders(), etc. (individual functions)
//
// Modal event listeners remain here for backward compatibility:
function handleCloseRemindersBtnClick() {
    remindersModal.style.display = "none";
}
GlobalUtils.safeAddEventListener(closeRemindersBtn, "click", handleCloseRemindersBtnClick);

function handleWindowClickForRemindersModal(event) {
    if (event.target === remindersModal) {
        remindersModal.style.display = "none";
    }
}
GlobalUtils.safeAddEventListener(window, "click", handleWindowClickForRemindersModal);

// Named handler for safeAddEventListener duplicate prevention
function handleTryLiteVersionClick() {
  showConfirmationModal({
    title: "Switch to Lite Version",
    message: "Try the Lite version? It works great on older devices and slower connections.",
    confirmText: "Try Lite Version",
    cancelText: "Stay Here",
    callback: (confirmed) => {
      if (confirmed) {
        window.location.href = 'lite/miniCycle-lite.html';
      }
    }
  });
}
GlobalUtils.safeAddEventListenerById('try-lite-version', 'click', handleTryLiteVersionClick);


// ✅ REMOVED: Notification wrapper functions (showNotification, showConfirmationModal, showPromptModal, etc.)
// Now exposed directly on window from notifications module initialization (see line ~504)

  // ✅ REMOVED: sendReminderNotificationIfNeeded() and startReminders() - Now in modules/features/reminders.js
  // Use window.sendReminderNotificationIfNeeded() and window.startReminders() which are globally exported

  // ✅ Update recurring panel button visibility if module is loaded
  if (window.recurringPanel?.updateRecurringPanelButtonVisibility) {
      window.recurringPanel.updateRecurringPanelButtonVisibility();
  }


// Named handler for safeAddEventListener duplicate prevention
function handleAlwaysShowRecurringChange() {
    if (window.recurringPanel?.saveAlwaysShowRecurringSetting) {
        window.recurringPanel.saveAlwaysShowRecurringSetting();
    }
}
GlobalUtils.safeAddEventListenerById("always-show-recurring", "change", handleAlwaysShowRecurringChange);



/**
 * Setupusermanual function.
 *
 * @returns {void}
 */

function handleOpenUserManualClick() {
    window.hideMainMenu?.(); // Hide the menu when clicking

    // Disable button briefly to prevent multiple clicks
    openUserManual.disabled = true;

    // Redirect to the User Manual page after a short delay
    setTimeout(() => {
        window.location.href = "legal/user-manual.html"; // ✅ Opens the manual page

        // Re-enable button after navigation (won't matter much since page changes)
        openUserManual.disabled = false;
    }, 200);
}

function setupUserManual() {
    GlobalUtils.safeAddEventListener(openUserManual, "click", handleOpenUserManualClick);
}



// ✅ REMOVED: setupAbout() - Now handled by modalManager module

/**
 * Assigncyclevariables function.
 *
 * @returns {void}
 */

// ✅ MIGRATED: assignCycleVariables now in modules/core/appState.js
// This inline version is a FALLBACK only - prefer window.assignCycleVariables from module
function assignCycleVariables() {
    // Use module version if available
    if (window.assignCycleVariables && window.assignCycleVariables !== assignCycleVariables) {
        return window.assignCycleVariables();
    }

    console.log('🔄 Assigning cycle variables (inline fallback)...');

    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for assignCycleVariables');
        return { lastUsedMiniCycle: null, savedMiniCycles: {} };
    }

    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for assignCycleVariables');
        return { lastUsedMiniCycle: null, savedMiniCycles: {} };
    }

    const { data, appState } = currentState;

    console.log('📊 Retrieved cycle data:', {
        activeCycle: appState.activeCycleId,
        cycleCount: Object.keys(data.cycles).length
    });

    return {
        lastUsedMiniCycle: appState.activeCycleId,
        savedMiniCycles: data.cycles
    };
}

// ✅ EXTRACTED: updateProgressBar and checkMiniCycle moved to modules/progress/cycleCompletion.js
// Now accessed via window.updateProgressBar and window.checkMiniCycle (set during module init)

// ✅ MOVED TO MODULE: modules/progress/cycleCompletion.js
// - incrementCycleCount
// - updateProgressBar
// - checkMiniCycle
// - handleMilestoneUnlocks
// - showCompletionAnimation
// - checkForMilestone
// - showMilestoneMessage

    /***********************
 *
 *
 * Rearrange Management Logic - MOVED TO MODULE
 * See: modules/task/dragDropManager.js
 *
 *
 ************************/

    /***********************
 * 
 * 
 * Task Management
 * 
 * 
 ************************/
    /**
     * Adds a new task to the list.
     * @param {string} taskText - The task description.
     * @param {boolean} [completed=false] - Whether the task starts as completed.
     * @param {boolean} [shouldSave=true] - If true, the task is saved.
     * @param {string|null} [dueDate=null] - Optional due date.
     * @param {boolean} [highPriority=false] - If true, the task is marked as high priority.
     * @param {boolean} [isLoading=false] - If true, task is loaded from storage.
     * @param {boolean} [remindersEnabled=false] - If true, reminders are turned on.
     */


    
// ✅ MIGRATED: addTask now in modules/task/taskCore.js
// window.addTask is set when taskCore module loads
// This inline version is a FALLBACK only (used before taskCore initializes)
function addTaskFallback(taskText, completed = false, shouldSave = true, dueDate = null, highPriority = null, isLoading = false, remindersEnabled = false, recurring = false, taskId = null, recurringSettings = {}, deleteWhenComplete = undefined, deleteWhenCompleteSettings = undefined) {
    // Input validation and sanitization
    const validatedInput = window.validateAndSanitizeTaskInput?.(taskText) || validateAndSanitizeTaskInput(taskText);
    if (!validatedInput) return;

    // Load and validate data context
    const taskContext = window.loadTaskContext?.(validatedInput, taskId, {
        completed, dueDate, highPriority, remindersEnabled, recurring, recurringSettings, deleteWhenComplete, deleteWhenCompleteSettings
    }, isLoading) || loadTaskContext(validatedInput, taskId, {
        completed, dueDate, highPriority, remindersEnabled, recurring, recurringSettings, deleteWhenComplete, deleteWhenCompleteSettings
    }, isLoading);
    if (!taskContext) return;

    // Create or update task data
    const taskData = window.createOrUpdateTaskData?.(taskContext) || createOrUpdateTaskData(taskContext);

    // Create DOM elements - prefer window.createTaskDOMElements from taskDOM.js
    const taskElements = window.createTaskDOMElements?.(taskContext, taskData) || createTaskDOMElements(taskContext, taskData);

    // Setup task interactions and events (from taskEvents.js via taskDOM.js)
    if (window.setupTaskInteractions) {
        window.setupTaskInteractions(taskElements, taskContext);
    } else {
        console.warn('⚠️ setupTaskInteractions not available - event handlers may not work!');
    }

    // Finalize task creation (from taskDOM.js)
    if (window.finalizeTaskCreation) {
        window.finalizeTaskCreation(taskElements, taskContext, { shouldSave, isLoading });
    } else {
        console.warn('⚠️ finalizeTaskCreation not available - task may not be added properly!');
    }

    console.log('✅ Task creation completed (Schema 2.5)');
}

// ✅ 1. Input Validation and Sanitization
function validateAndSanitizeTaskInput(taskText) {
    if (typeof taskText !== "string") {
        console.error("❌ Error: taskText is not a string", taskText);
        return null;
    }

    const taskTextTrimmed = window.sanitizeInput(taskText.trim());
    if (!taskTextTrimmed) {
        console.warn("⚠ Skipping empty or unsafe task.");
        return null;
    }
    
    if (taskTextTrimmed.length > TASK_LIMIT) {
        window.showNotification?.(`Task must be ${TASK_LIMIT} characters or less.`);
        return null;
    }
    
    return taskTextTrimmed;
}

// ✅ Export for taskCore module
// ❌ DISABLED: Old export - now provided by taskDOM module
// window.validateAndSanitizeTaskInput = validateAndSanitizeTaskInput;

// ✅ 2. Data Context Loading and Validation
function loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading = false) {
    console.log('📝 Adding task (Schema 2.5 only)...');

    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for addTask');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle, settings, reminders } = schemaData;
    const currentCycle = cycles[activeCycle];

    if (!activeCycle || !currentCycle) {
        console.error("❌ No active cycle found in Schema 2.5 for addTask");
        throw new Error('No active cycle found');
    }

    console.log('📊 Active cycle found:', activeCycle);

    const assignedTaskId = taskId || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    console.log('🆔 Assigned task ID:', assignedTaskId);

    return {
        taskTextTrimmed,
        assignedTaskId,
        schemaData,
        cycles,
        activeCycle,
        currentCycle,
        settings,
        reminders,
        cycleTasks: currentCycle.tasks || [],
        autoResetEnabled: currentCycle.autoReset || false,
        remindersEnabledGlobal: reminders?.enabled === true,
        deleteCheckedEnabled: currentCycle.deleteCheckedTasks || false,
        isLoading,  // ✅ Pass through isLoading flag
        ...taskOptions
    };
}

// ✅ Export for taskCore module
// ❌ DISABLED: Old export - now provided by taskDOM module
// window.loadTaskContext = loadTaskContext;

// ✅ 3. Task Data Creation and Storage
function createOrUpdateTaskData(taskContext) {
    const {
        cycleTasks, assignedTaskId, taskTextTrimmed, completed, dueDate,
        highPriority, remindersEnabled, recurring, recurringSettings,
        currentCycle, cycles, activeCycle, isLoading, deleteWhenComplete,
        deleteWhenCompleteSettings
    } = taskContext;

    let existingTask = cycleTasks.find(task => task.id === assignedTaskId);

    if (!existingTask) {
        console.log('📋 Creating new task in Schema 2.5');

        // ✅ Mode-specific deleteWhenComplete architecture:
        // - Active value synced with current mode
        // - Settings object stores preference per mode
        const isToDoMode = currentCycle.deleteCheckedTasks === true;

        // Use provided settings or defaults
        const finalSettings = deleteWhenCompleteSettings || { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };

        // Active value based on current mode (unless explicitly provided)
        const activeDeleteWhenComplete = deleteWhenComplete !== undefined ?
            deleteWhenComplete :
            (isToDoMode ? finalSettings.todo : finalSettings.cycle);

        existingTask = {
            id: assignedTaskId,
            text: taskTextTrimmed,
            completed,
            dueDate,
            highPriority,
            remindersEnabled,
            recurring,
            recurringSettings,
            deleteWhenComplete: activeDeleteWhenComplete,
            deleteWhenCompleteSettings: finalSettings,
            schemaVersion: 2
        };

        // ✅ FIX: Only push to cycle data if NOT loading (prevents duplicate tasks with new IDs)
        if (!isLoading) {
            currentCycle.tasks.push(existingTask);
        } else {
            console.log('⏭️ Skipping push to currentCycle.tasks during load (task already in AppState)');
        }

        // Handle recurring template creation
        if (recurring && recurringSettings) {
            console.log('🔁 Saving recurring template');

            if (!currentCycle.recurringTemplates) {
                currentCycle.recurringTemplates = {};
            }

            currentCycle.recurringTemplates[assignedTaskId] = {
                id: assignedTaskId,
                text: taskTextTrimmed,
                recurring: true,
                recurringSettings: structuredClone(recurringSettings),
                highPriority: highPriority || false,
                dueDate: dueDate || null,
                remindersEnabled: remindersEnabled || false,
                deleteWhenComplete: true, // Recurring tasks always auto-remove
                deleteWhenCompleteSettings: { ...DEFAULT_RECURRING_DELETE_SETTINGS },
                lastTriggeredTimestamp: null,
                schemaVersion: 2
            };
        }

        // ✅ FIX: Only save to AppState if NOT loading from saved data
        if (!isLoading) {
            // Save to Schema 2.5 directly
            window.saveTaskToSchema25(activeCycle, currentCycle);
            console.log('💾 Task saved to Schema 2.5');
        } else {
            console.log('⏭️ Skipping save during load (isLoading=true)');
        }
    }

    return existingTask;
}

// ✅ MIGRATED: createOrUpdateTaskData now in modules/task/taskUtils.js
// The inline version above is a FALLBACK - prefer window.createOrUpdateTaskData from taskDOM module
// window.createOrUpdateTaskData is set by taskDOM.js during initialization

// ✅ 4. Recurring Template Creation (extracted from task data creation)
// ✅ REMOVED: createRecurringTemplate - now handled by recurringCore/recurringPanel modules

// ✅ 5. DOM Elements Creation
function createTaskDOMElements(taskContext, taskData) {
    const {
        assignedTaskId, taskTextTrimmed, highPriority, recurring,
        recurringSettings, settings, autoResetEnabled, currentCycle
    } = taskContext;

    // ✅ Extract deleteWhenComplete settings from task data
    const deleteWhenComplete = taskData.deleteWhenComplete || false;
    const deleteWhenCompleteSettings = taskData.deleteWhenCompleteSettings || { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };

    // Get required DOM elements
    const taskList = document.getElementById("taskList");
    const taskInput = document.getElementById("taskInput");

    // Create main task element with deleteWhenComplete settings
    const taskItem = createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle, deleteWhenComplete, deleteWhenCompleteSettings);

    // Create three dots button if needed (use window.* to ensure we get the taskDOM version)
    const threeDotsButton = (window.createThreeDotsButton || createThreeDotsButton)(taskItem, settings);

    // Create button container and buttons
    const buttonContainer = createTaskButtonContainer(taskContext);
    
    // Create task content elements
    const { checkbox, taskLabel, dueDateInput } = createTaskContentElements(taskContext);
    
    // Create task content wrapper
    const taskContent = document.createElement("div");
    taskContent.classList.add("task-content");
    taskContent.appendChild(checkbox);
    taskContent.appendChild(taskLabel);

    // Assemble the task item
    taskItem.appendChild(buttonContainer);
    taskItem.appendChild(taskContent);
    taskItem.appendChild(dueDateInput);

    return {
        taskItem,
        taskList,
        taskInput,
        buttonContainer,
        checkbox,
        taskLabel,
        dueDateInput,
        threeDotsButton
    };
}






/**
 * Sync recurring state to DOM elements
 * Called by recurring modules to update task UI
 */
window.syncRecurringStateToDOM = function(taskEl, recurringSettings) {
    taskEl.setAttribute("data-recurring-settings", JSON.stringify(recurringSettings));
    const recurringBtn = taskEl.querySelector(".recurring-btn");
    if (recurringBtn) {
        recurringBtn.classList.add("active");
        recurringBtn.setAttribute("aria-pressed", "true");
    }

    // ✅ Add recurring icon to task label if not already present
    const taskLabel = taskEl.querySelector(".task-text");
    if (taskLabel) {
        let existingIcon = taskLabel.querySelector('.recurring-indicator');
        if (!existingIcon) {
            const icon = document.createElement("span");
            icon.className = "recurring-indicator";
            icon.innerHTML = `<i class="fas fa-sync-alt"></i>`;
            taskLabel.appendChild(icon);
            console.log('✅ Added recurring icon via syncRecurringStateToDOM');
        }
    }
};



// ✅ REMOVED: createTaskCheckbox - now in modules/task/taskDOM.js
// ✅ REMOVED: createTaskLabel - now in modules/task/taskDOM.js



// Flush queued addTask calls (window.addTask is set by taskCore module)
(function finalizeAddTaskBootstrap() {
  try {
    // window.addTask should already be set by taskCore module
    // If not, use the fallback
    if (typeof window.addTask !== 'function' && typeof addTaskFallback === 'function') {
      window.addTask = addTaskFallback;
    }

    if (typeof window.addTask === 'function') {
      window.addTaskFunction = window.addTask; // alias for programmatic entry
      const queuedCalls = window.AppGlobalState?.queuedAddTaskCalls;
      if (Array.isArray(queuedCalls) && queuedCalls.length) {
        console.log(`🚚 Flushing ${queuedCalls.length} queued addTask calls`);
        queuedCalls.splice(0).forEach(args => {
          try { window.addTask(...args); } catch (e) { console.warn('addTask flush error:', e); }
        });
      }
      if (typeof window.resumeDeferredRenderIfNeeded === 'function') {
        window.resumeDeferredRenderIfNeeded();
      }
    }
  } catch (e) {
    console.warn('finalizeAddTaskBootstrap error:', e);
  }
})();
// ▶️ Attempt to resume deferred render once real addTask is present
if (typeof window.resumeDeferredRenderIfNeeded === 'function') {
  window.resumeDeferredRenderIfNeeded();
} else {
  // Fallback: try again shortly if cycleLoader not finished attaching hook yet
  setTimeout(() => {
    if (typeof window.resumeDeferredRenderIfNeeded === 'function') {
      window.resumeDeferredRenderIfNeeded();
    }
  }, 200);
}

// ✅ toggleHoverTaskOptions removed - now using module version from taskDOM.js

function handleRecurringSettingsClick(e) {
  const target = e.target.closest(".open-recurring-settings");
  if (!target) return;

  const taskId = target.dataset.taskId;
  if (!taskId) return;

  // 🎯 Use your centralized panel-opening logic
  window.openRecurringSettingsPanelForTask?.(taskId);
}
GlobalUtils.safeAddEventListener(document, "click", handleRecurringSettingsClick);

/**
 * ✅ Sanitize user input to prevent XSS attacks or malformed content.
 * @param {string} input - The user input to be sanitized.
 * @returns {string} - Cleaned and safe string, trimmed and limited in length.
 */
// ✅ sanitizeInput removed - now using module version from globalUtils.js

// ✅ MOVED: TaskOptionsVisibilityController to modules/ui/taskUI.js
// ✅ MOVED: attachKeyboardTaskOptionToggle to modules/ui/taskInteractions.js
// ✅ MOVED: hideTaskButtons to modules/ui/taskUI.js
// ✅ MOVED: showTaskOptions to modules/ui/taskUI.js
// ✅ MOVED: hideTaskOptions to modules/ui/taskUI.js


// ✅ REMOVED: handleTaskCompletionChange - now in modules/task/taskCore.js

// ========================================
// Completed Tasks Management
// ========================================

// ✅ MOVED: Completed tasks functions to modules/ui/completedTasksManager.js
// Functions: initCompletedTasksSection, toggleCompletedTasksSection, moveTaskToCompleted,
// moveTaskToActive, updateCompletedTasksCount, handleTaskListMovement, organizeCompletedTasks, isCompletedDropdownEnabled

// ✅ MIGRATED: isTouchDevice now in modules/utils/deviceDetection.js
// window.isTouchDevice is set when deviceDetection module loads
// The inline version below is a FALLBACK only
function isTouchDevice() {
    // Use module version if available
    if (window.isTouchDevice && window.isTouchDevice !== isTouchDevice) {
        return window.isTouchDevice();
    }

    // Inline fallback
    const hasTouchEvents = "ontouchstart" in window;
    const touchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    console.log(`touch detected (fallback): hasTouchEvents=${hasTouchEvents}, maxTouchPoints=${touchPoints}, isFinePointer=${isFinePointer}`);

    if (isFinePointer) return false;

    return hasTouchEvents || touchPoints > 0;
}




// ✅ MOVED: checkCompleteAllButton to modules/ui/taskUI.js
// ✅ MOVED: triggerLogoBackground to modules/ui/uiEffects.js

// ✅ MOVED: saveToggleAutoReset() to modules/cycle/modeManager.js
// Now accessed via window.saveToggleAutoReset() which calls modeManager.setupToggleAutoReset()

// ✅ Function to complete all tasks and handle reset
// ✅ REMOVED: handleCompleteAllTasks - now in modules/task/taskCore.js
// ✅ Event listener moved to Phase 3 (after taskCore loads)


/***********************
 *
 *
 * Add Event Listeners (via app-uiBoot.js)
 *
 *
 ************************/
// ✅ Task input listeners now handled by app-uiBoot.js
attachTaskInputListeners(GlobalUtils, taskInput, addTaskButton);

// ✅ Menu button listener now handled by app-uiBoot.js
attachMenuButtonListener(GlobalUtils, menuButton, menu);

// ✅ Global event listeners (keyboard shortcuts, global clicks, touch events) now handled by app-uiBoot.js
attachGlobalEventListeners(GlobalUtils);

// ✅ LEGACY: Keep reset-notification-position handler inline for now (requires AppState access)
GlobalUtils.safeAddEventListenerById("reset-notification-position", "click", async () => {
    console.log('🔄 Resetting notification position (Schema 2.5 only)...');

    // ✅ Use AppState only (no direct localStorage writes)
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for reset notification position');
        window.showNotification?.("❌ Unable to reset position.", "error", 2000);
        return;
    }

    try {
        await window.AppState.update(state => {
            if (!state?.settings) {
                state.settings = {};
            }
            state.settings.notificationPosition = { x: 0, y: 0 };
            state.settings.notificationPositionModified = false;
        }, true);

        console.log('✅ Notification position reset in Schema 2.5');

        // Reset UI position
        window.resetNotificationPosition?.();

        window.showNotification?.("🔄 Notification position reset.", "success", 2000);
    } catch (error) {
        console.error('❌ Failed to reset notification position:', error);
        window.showNotification?.("❌ Failed to reset position.", "error", 2000);
    }
});

// Named handler for safeAddEventListener duplicate prevention
function handleOpenRemindersModalClick() {
    console.log('🔔 Opening reminders modal (Schema 2.5 only)...');

    // Load current settings from Schema 2.5 before opening
    window.loadRemindersSettings?.(); // This function already has Schema 2.5 support
    document.getElementById("reminders-modal").style.display = "flex";
    window.hideMainMenu?.();

    console.log('✅ Reminders modal opened');
}
GlobalUtils.safeAddEventListenerById("open-reminders-modal", "click", handleOpenRemindersModalClick);

// 🟢 Safe Global Click for Hiding Task Buttons
GlobalUtils.safeAddEventListener(document, "click", (event) => {
    let isTaskOrOptionsClick = event.target.closest(".task, .task-options");
    let isModalClick = event.target.closest(".modal, .mini-modal-overlay, .settings-modal, .notification");

    if (!isTaskOrOptionsClick && !isModalClick) {
        console.log("✅ Clicking outside - closing task buttons");

        // ✅ Check if three-dots mode is enabled
        const threeDotsEnabled = document.body.classList.contains("show-three-dots-enabled");

        document.querySelectorAll(".task-options").forEach(action => {
            if (threeDotsEnabled) {
                // Three-dots mode: use inline styles to explicitly hide
                action.style.opacity = "0";
                action.style.visibility = "hidden";
                action.style.pointerEvents = "none";
            } else {
                // Regular hover mode: clear inline styles to let CSS handle it
                action.style.opacity = "";
                action.style.visibility = "";
                action.style.pointerEvents = "";
            }
        });

        document.querySelectorAll(".task").forEach(task => {
            task.classList.remove("long-pressed");
            task.classList.remove("draggable");
            task.classList.remove("dragging");
            
            // Only remove selected class if not in recurring panel
            if (!document.getElementById("recurring-panel-overlay")?.classList.contains("hidden")) {
                // Keep selections in recurring panel
            } else {
                task.classList.remove("selected");
            }
        });
    }
});

// 🟢 Safe Global Click for Deselecting miniCycle in Switch Modal
GlobalUtils.safeAddEventListener(document, "click", (event) => {
    const switchModalContent = document.querySelector(".mini-cycle-switch-modal-content");
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");
    const switchItemsRow = document.getElementById("switch-items-row");
    const previewWindow = document.querySelector(".switch-preview-window");

    if (
        switchModalContent?.contains(event.target) &&
        selectedCycle &&
        !event.target.classList.contains("mini-cycle-switch-item") &&
        !previewWindow?.contains(event.target)
    ) {
        selectedCycle.classList.remove("selected");
        if (switchItemsRow) {
            switchItemsRow.style.display = "none";
        }
        
        // Clear preview content
        if (previewWindow) {
            previewWindow.innerHTML = '<p style="color: #888; font-style: italic;">Select a miniCycle to preview</p>';
        }
    }
});




// ✅ REMOVED: closeAllModals() - Now handled by modalManager module
// ✅ REMOVED: ESC key listener - Now handled by modalManager module

// ✅ MOVED TO MODULE: modules/ui/helpWindowManager.js
// - HelpWindowManager class
// - helpWindowManager initialization

/**
 * Refresh task buttons when mode changes to show/hide recurring button
 */

// ✅ Updated setupModeSelector to use state-based system


// ✅ Updated updateCycleModeDescription to Schema 2.5 only






/*****SPEACIAL EVENT LISTENERS *****/
// ✅ MOVED TO app-uiBoot.js: Touch event handlers (handleFirstTouchInteraction, handlePassiveTouchstart)

// ✅ Hide initial app loader when app is ready (now via app-uiBoot.js)
hideAppLoader();

} // End of initApp function

// Run initApp when DOM is ready (or immediately if already ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

  function supportsModern() {
    try { new Function('()=>{}'); } catch(_) { return false; }
    return !!(window.Promise && window.fetch);
  }

// ============================================
// LOADING SPINNER GLOBAL FUNCTIONS
// ✅ MOVED TO app-uiBoot.js: showLoader, hideLoader, withLoader
// These are now exported from app-uiBoot.js and exposed to window there
// ============================================
