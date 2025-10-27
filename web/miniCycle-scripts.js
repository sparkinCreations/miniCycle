/**
 * Welcome to miniCycle!
 *
 * Hi, I'm MJ, the developer of miniCycle. Thanks for exploring the code!
 * This file (miniCycle-scripts.js) serves as the main entry point for the miniCycle web app.
 * It manages the loading and initialization of all modules and utilities that power the app.
 *
 * The codebase has evolved with both manual improvements and AI-assisted refactoring to enhance structure, readability, and maintainability.
 * If you're new here, start by reading the comments and following the initialization flow.
 *
 * Note: This file is intentionally comprehensive due to miniCycle's modular design.
 * I've included detailed comments throughout to clarify each section and its role.
 * If you have questions or suggestions, feel free to reach out!
 *
 * You can visit my website at https://sparkincreations.com
 *
 * or the official miniCycle product page at https://minicycleapp.com
 */





// 🌍 Global State: Because sometimes you need variables that survive the apocalypse of module imports
// This houses all the app's critical state that needs to be accessible everywhere.
// Think of it as the app's memory bank, storing everything from drag states to undo history.

// ✅ Phase C: Feature Flags for recurring system
window.FeatureFlags = {
  recurringEnabled: true,
  moveArrowsEnabled: true,
  debugMode: false
};

window.AppGlobalState = {
  draggedTask: null,
  logoTimeoutId: null,
  touchStartTime: 0,
  isLongPress: false,
  touchStartY: 0,
  touchEndY: 0,
  holdTimeout: null,
  moved: false,
  isDragging: false,
  rearrangeInitialized: false,
  lastDraggedOver: null,
  lastRearrangeTarget: null,
  hasInteracted: false,
  lastDragOverTime: 0,
  reminderIntervalId: null,
  timesReminded: 0,
  lastReminderTime: null,
  isResetting: false,
  undoSnapshot: null,
  redoSnapshot: null,
  undoStack: [],
  redoStack: [],
  didDragReorderOccur: false,
  lastReorderTime: 0,
  advancedVisible: false,
  isPerformingUndoRedo: false,
  lastSnapshotSignature: null,
  lastSnapshotTs: 0,
  isInitializing: true  // ✅ Track if app is still initializing
};


// ✅ Add these missing property getters after your existing ones
Object.defineProperty(window, 'touchStartTime', {
  get: () => window.AppGlobalState.touchStartTime,
  set: (value) => { window.AppGlobalState.touchStartTime = value; }
});

Object.defineProperty(window, 'isLongPress', {
  get: () => window.AppGlobalState.isLongPress,
  set: (value) => { window.AppGlobalState.isLongPress = value; }
});

Object.defineProperty(window, 'touchStartY', {
  get: () => window.AppGlobalState.touchStartY,
  set: (value) => { window.AppGlobalState.touchStartY = value; }
});

Object.defineProperty(window, 'touchEndY', {
  get: () => window.AppGlobalState.touchEndY,
  set: (value) => { window.AppGlobalState.touchEndY = value; }
});

Object.defineProperty(window, 'holdTimeout', {
  get: () => window.AppGlobalState.holdTimeout,
  set: (value) => { window.AppGlobalState.holdTimeout = value; }
});

Object.defineProperty(window, 'moved', {
  get: () => window.AppGlobalState.moved,
  set: (value) => { window.AppGlobalState.moved = value; }
});

Object.defineProperty(window, 'rearrangeInitialized', {
  get: () => window.AppGlobalState.rearrangeInitialized,
  set: (value) => { window.AppGlobalState.rearrangeInitialized = value; }
});

Object.defineProperty(window, 'lastDraggedOver', {
  get: () => window.AppGlobalState.lastDraggedOver,
  set: (value) => { window.AppGlobalState.lastDraggedOver = value; }
});

Object.defineProperty(window, 'lastRearrangeTarget', {
  get: () => window.AppGlobalState.lastRearrangeTarget,
  set: (value) => { window.AppGlobalState.lastRearrangeTarget = value; }
});

Object.defineProperty(window, 'lastDragOverTime', {
  get: () => window.AppGlobalState.lastDragOverTime,
  set: (value) => { window.AppGlobalState.lastDragOverTime = value; }
});

Object.defineProperty(window, 'didDragReorderOccur', {
  get: () => window.AppGlobalState.didDragReorderOccur,
  set: (value) => { window.AppGlobalState.didDragReorderOccur = value; }
});

Object.defineProperty(window, 'lastReorderTime', {
  get: () => window.AppGlobalState.lastReorderTime,
  set: (value) => { window.AppGlobalState.lastReorderTime = value; }
});


Object.defineProperty(window, 'hasInteracted', {
  get: () => window.AppGlobalState.hasInteracted,
  set: (value) => { window.AppGlobalState.hasInteracted = value; }
});

Object.defineProperty(window, 'logoTimeoutId', {
  get: () => window.AppGlobalState.logoTimeoutId,
  set: (value) => { window.AppGlobalState.logoTimeoutId = value; }
});

Object.defineProperty(window, 'advancedVisible', {
  get: () => window.AppGlobalState.advancedVisible,
  set: (value) => { window.AppGlobalState.advancedVisible = value; }
});

Object.defineProperty(window, 'timesReminded', {
  get: () => window.AppGlobalState.timesReminded,
  set: (value) => { window.AppGlobalState.timesReminded = value; }
});

Object.defineProperty(window, 'reminderIntervalId', {
  get: () => window.AppGlobalState.reminderIntervalId,
  set: (value) => { window.AppGlobalState.reminderIntervalId = value; }
});

Object.defineProperty(window, 'lastReminderTime', {
  get: () => window.AppGlobalState.lastReminderTime,
  set: (value) => { window.AppGlobalState.lastReminderTime = value; }
});

// ✅ CREATE BACKWARD-COMPATIBLE GETTERS/SETTERS
Object.defineProperty(window, 'draggedTask', {
  get: () => window.AppGlobalState.draggedTask,
  set: (value) => { window.AppGlobalState.draggedTask = value; }
});

Object.defineProperty(window, 'isResetting', {
  get: () => window.AppGlobalState.isResetting,
  set: (value) => { window.AppGlobalState.isResetting = value; }
});

Object.defineProperty(window, 'undoStack', {
  get: () => window.AppGlobalState.undoStack,
  set: (value) => { window.AppGlobalState.undoStack = value; }
});

Object.defineProperty(window, 'redoStack', {
  get: () => window.AppGlobalState.redoStack,
  set: (value) => { window.AppGlobalState.redoStack = value; }
});

Object.defineProperty(window, 'isDragging', {
  get: () => window.AppGlobalState.isDragging,
  set: (value) => { window.AppGlobalState.isDragging = value; }
});

// ✅ Add other frequently used properties as needed

// ✅ CONSTANTS - Keep these as they are
const UNDO_LIMIT = 20;
const UNDO_MIN_INTERVAL_MS = 100;

// Additional global variable for notification system compatibility
let isDraggingNotification = false;

// ✅ Debug function for checking app state
window.debugAppState = function() {
    console.group('🔍 App State Debug');
    
    if (!window.AppState) {
        console.error('❌ AppState not available');
        console.groupEnd();
        return;
    }
    
    console.log('Ready:', window.AppState.isReady());
    
    const state = window.AppState.get();
    if (!state) {
        console.error('❌ No state data');
        console.groupEnd();
        return;
    }
    
    console.log('📊 Full State:', state);
    console.log('🎯 Active Cycle:', state.appState?.activeCycleId);
    
    const activeCycle = state.appState?.activeCycleId;
    const cycleData = state.data?.cycles?.[activeCycle];
    console.log('🔢 Cycle Count:', cycleData?.cycleCount || 0);
    console.log('🎨 Unlocked Themes:', state.settings?.unlockedThemes || []);
    console.log('🎮 Unlocked Features:', state.settings?.unlockedFeatures || []);
    console.log('👤 User Progress:', state.userProgress || {});
    console.log('🏆 Reward Milestones:', state.userProgress?.rewardMilestones || []);
    
    // Check milestone eligibility
    const currentCount = cycleData?.cycleCount || 0;
    console.log(`🏆 Milestone Status:
    - Dark Ocean (5 cycles): ${currentCount >= 5 ? '✅ Eligible' : `❌ Need ${5 - currentCount} more`}
    - Golden Glow (50 cycles): ${currentCount >= 50 ? '✅ Eligible' : `❌ Need ${50 - currentCount} more`}
    - Mini Game (100 cycles): ${currentCount >= 100 ? '✅ Eligible' : `❌ Need ${100 - currentCount} more`}`);
    
    console.groupEnd();
};


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








//Main application initialization sequence

document.addEventListener('DOMContentLoaded', async (event) => {
    console.log('🚀 Starting miniCycle initialization (Schema 2.5 only)...');

  window.AppBootStarted = true;
  window.AppBootStartTime = Date.now(); // ✅ Track boot start time

  // ✅ Load appInit FIRST without version (so all static imports in modules share this singleton)
  // This is critical: utility modules use static imports like `import { appInit } from './appInitialization.js'`
  // If we version this import, we create separate instances and break the shared state
  const { appInit } = await import('./utilities/appInitialization.js');

  // ✅ NOW create version helper for all OTHER dynamic imports (not appInit)
  const withV = (path) => `${path}?v=${window.APP_VERSION}`;

  // ✅ Set backward compatibility alias
  window.AppInit = appInit;

  console.log('🚀 appInit loaded (2-phase initialization system)');

// ======================================================================
// 🚀 APPINIT-COMPLIANT INITIALIZATION SEQUENCE
// ======================================================================
// Following APPINIT_INTEGRATION_PLAN.md structure:
// PHASE 1 (CORE): Basic utilities → Migration Manager → AppState → Mark core ready
// PHASE 2 (MODULES): DragDrop, Stats, Recurring, DeviceDetection
// PHASE 3 (UI/DATA): Load data, setup UI, wire event listeners
// ======================================================================

  // ============================================================
  // PHASE 1: CORE SYSTEMS
  // ============================================================
  console.log('🔧 Phase 1: Initializing core systems...');








    /******
     * UTILITY MODULE IMPORTS & INITIALIZATION
     * 
     * This section dynamically imports and initializes all core utility modules
     * that power miniCycle's functionality. Each module is loaded asynchronously
     * to optimize startup performance while maintaining proper dependency order:
     * 
     * 1. Global utilities (foundational helper functions)
     * 2. Console capture system (debugging & diagnostics)
     * 3. Notification system (user feedback & alerts)
     * 4. Device detection (touch/mouse, mobile/desktop optimization)
     * 5. Stats panel manager (analytics & progress tracking)
     * 
     * All modules are made globally accessible for cross-component communication.
     ******/



   



    await import(withV('./utilities/globalUtils.js'));
    console.log('🛠️ Global utilities loaded');

    const { default: consoleCapture } = await import(withV('./utilities/consoleCapture.js'));
    window.consoleCapture = consoleCapture;

    const { MiniCycleNotifications } = await import(withV('./utilities/notifications.js'));
    const notifications = new MiniCycleNotifications();

    window.notifications = notifications;
    window.showNotification = (message, type, duration) => notifications.show(message, type, duration);
    console.log('✅ Notifications loaded');

    // ✅ Load Theme Manager (core visual system)
    await import(withV('./utilities/themeManager.js'));
    console.log('✅ Theme Manager loaded');

    // ✅ Load Games Manager (simple UI component)
    await import(withV('./utilities/ui/gamesManager.js'));
    console.log('✅ Games Manager loaded');

    // ✅ Load Onboarding Manager (simple UI component)
    await import(withV('./utilities/ui/onboardingManager.js'));
    console.log('✅ Onboarding Manager loaded');

    // ✅ Load Modal Manager (UI coordination)
    await import(withV('./utilities/ui/modalManager.js'));
    console.log('✅ Modal Manager loaded');

    // ✅ Load Migration Manager FIRST (before anything tries to use it)
    console.log('🔄 Loading migration manager (core system)...');
    const migrationMod = await import(withV('./utilities/cycle/migrationManager.js'));

    migrationMod.setMigrationManagerDependencies({
      storage: localStorage,
      sessionStorage: sessionStorage,
      showNotification: (msg, type, duration) => showNotification?.(msg, type, duration),
      initialSetup: () => initialSetup?.(),
      now: () => Date.now(),
      document: document
    });

    // Expose migration functions globally (needed immediately)
    window.createInitialSchema25Data = migrationMod.createInitialSchema25Data;
    window.checkMigrationNeeded = migrationMod.checkMigrationNeeded;
    window.simulateMigrationToSchema25 = migrationMod.simulateMigrationToSchema25;
    window.performSchema25Migration = migrationMod.performSchema25Migration;
    window.validateAllMiniCycleTasksLenient = migrationMod.validateAllMiniCycleTasksLenient;
    window.fixTaskValidationIssues = migrationMod.fixTaskValidationIssues;
    window.initializeAppWithAutoMigration = migrationMod.initializeAppWithAutoMigration;
    window.forceAppMigration = migrationMod.forceAppMigration;

    console.log('✅ Migration Manager loaded (Phase 1)');

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
    const TASK_LIMIT = 100; 

    // ✅ Initialize app with proper error handling and Schema 2.5 focus
    console.log('🔧 Starting core initialization sequence...');


    

    // ✅ UI Component Setup - MOVED to async block after migration manager loads
    console.log('🎨 UI Component Setup will run after migration manager loads...');

    // ✅ Stats and Navigation
    console.log('📊 Updating stats and navigation...');
    updateNavDots();


    // ✅ Theme Loading (Schema 2.5 only)
    console.log('🎨 Loading theme settings...');
    try {
        const schemaData = loadMiniCycleData();
        if (schemaData && schemaData.settings.theme) {
            console.log('🎨 Applying theme from Schema 2.5:', schemaData.settings.theme);
            applyTheme(schemaData.settings.theme);
        } else {
            console.log('🎨 Using default theme');
            applyTheme('default');
        }
    } catch (error) {
        console.warn('⚠️ Theme loading failed, using default:', error);
        applyTheme('default');
    }

    // ...inside DOMContentLoaded, replace the current try { await cycleLoaderModulePromise; ... } block...
    
    // ...existing code...
    
    // Inside DOMContentLoaded, replace the current try { await window.cycleLoaderModulePromise; ... } with:
// ✅ Load cycleLoader EARLY so window.loadMiniCycle exists before any initialSetup runs
  try {
    const mod = await import(withV('./utilities/cycle/cycleLoader.js'));

        // ✅ Ensure loadMiniCycle is available globally for refreshUIFromState()
    if (!window.loadMiniCycle) {
      window.loadMiniCycle = mod.loadMiniCycle;
    }

    mod.setCycleLoaderDependencies({
      loadMiniCycleData: () => window.loadMiniCycleData?.(),
      createInitialSchema25Data: () => window.createInitialSchema25Data?.(),
      addTask: (...args) => window.addTask?.(...args),  // ✅ Forward ALL parameters
      updateThemeColor: () => window.updateThemeColor?.(),
      startReminders: () => window.startReminders?.(),
      updateProgressBar: () => window.updateProgressBar?.(),
      checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
      updateMainMenuHeader: () => window.updateMainMenuHeader?.(),
      updateStatsPanel: () => window.updateStatsPanel?.()
    });

    // If completeInitialSetup ran earlier and queued a load, honor it.
    if (window.__pendingCycleLoad) {
      await mod.loadMiniCycle();
      window.__pendingCycleLoad = false;
    }

    // ✅ MOVED: DragDropManager initialization moved to Phase 2 (after markCoreSystemsReady)
    // See async IIFE around line ~690 for the new appInit-compliant location

    // ✅ MOVED: Data initialization moved to async IIFE (after dragDropManager is ready)
    // See line ~700 where initializeAppWithAutoMigration() is now called
    // This ensures: cycleLoader → AppState → dragDropManager → data loading (proper order)
  } catch (e) {
    console.error('❌ cycleLoader import failed:', e);
  }


  // ...remove the later duplicate cycleLoader import block that used to be here...
  // ...existing code continues...

    // ...existing code...

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
    window.completeInitialSetup = completeInitialSetup;



// ...existing code...

// ✅ wireUndoRedoUI moved to utilities/ui/undoRedoManager.js

// ✅ Data-ready initialization - runs immediately (no more deferral needed)
// The code below will execute after data is loaded in the main sequence
(async () => {
  console.log('🟢 Data-ready initializers running…');

  // ✅ Continue Phase 1: Initialize state module
  try {
    console.log('🗃️ Initializing state module...');

    const { createStateManager } = await import(withV('./utilities/state.js'));
    window.AppState = createStateManager({
      showNotification: window.showNotification || console.log.bind(console),
      storage: localStorage,
      createInitialData: createInitialSchema25Data
    });

    await window.AppState.init();
    console.log('✅ State module initialized successfully after data setup');

    // ✅ MOVED: DragDropManager initialization moved earlier (before initializeAppWithAutoMigration)
    // See line ~600 for the new location - must be initialized before any tasks are created

        // ✅ CRITICAL: Mark core systems as ready (unblocks all waiting modules)
        await appInit.markCoreSystemsReady();

        // ============ PHASE 2: MODULES ============
        console.log('🔌 Phase 2: Loading modules (appInit-compliant)...');

        // ✅ Initialize Drag & Drop Manager (Phase 2 module - waits for core internally)
        console.log('🔄 Initializing drag & drop manager...');
        const { initDragDropManager } = await import(withV('./utilities/task/dragDropManager.js'));

        await initDragDropManager({
          saveCurrentTaskOrder: () => window.saveCurrentTaskOrder?.(),
          autoSave: () => autoSave?.(),
          updateProgressBar: () => updateProgressBar?.(),
          updateStatsPanel: () => updateStatsPanel?.(),
          checkCompleteAllButton: () => checkCompleteAllButton?.(),
          updateUndoRedoButtons: () => updateUndoRedoButtons?.(),
          captureStateSnapshot: (state) => captureStateSnapshot?.(state),
          refreshUIFromState: () => refreshUIFromState?.(),
          revealTaskButtons: (task) => revealTaskButtons?.(task),
          hideTaskButtons: (task) => hideTaskButtons?.(task),
          isTouchDevice: () => isTouchDevice?.() || false,
          enableUndoSystemOnFirstInteraction: () => enableUndoSystemOnFirstInteraction?.(),
          showNotification: (msg, type, duration) => showNotification?.(msg, type, duration)
        });

        console.log('✅ DragDropManager initialized and ready (Phase 2)');

        // ✅ Initialize Device Detection (Phase 2 module)
        console.log('📱 Initializing device detection module...');
        const { DeviceDetectionManager } = await import(withV('./utilities/deviceDetection.js'));

        const deviceDetectionManager = new DeviceDetectionManager({
            loadMiniCycleData: () => window.loadMiniCycleData ? window.loadMiniCycleData() : null,
            showNotification: (msg, type, duration) => window.showNotification ? window.showNotification(msg, type, duration) : console.log('Notification:', msg),
            currentVersion: '1.336'
        });

        window.deviceDetectionManager = deviceDetectionManager;
        console.log('✅ DeviceDetectionManager initialized (Phase 2)');

        // ✅ Initialize Stats Panel (Phase 2 module)
        console.log('📊 Initializing stats panel module...');
        const { StatsPanelManager } = await import(withV('./utilities/statsPanel.js'));

        const statsPanelManager = new StatsPanelManager({
            showNotification: (msg, type, duration) => window.showNotification ? window.showNotification(msg, type, duration) : console.log('Notification:', msg),
            loadMiniCycleData: () => {
                // Defensive data loading with error handling
                try {
                    const result = window.loadMiniCycleData ? window.loadMiniCycleData() : null;
                    if (!result) {
                        console.log('📊 StatsPanelManager: Data not ready yet');
                    }
                    return result;
                } catch (error) {
                    console.warn('⚠️ StatsPanelManager: Error loading data:', error);
                    return null;
                }
            },
            isOverlayActive: () => window.isOverlayActive ? window.isOverlayActive() : false
        });

        // Expose stats panel functions globally
        window.statsPanelManager = statsPanelManager;
        window.showStatsPanel = () => statsPanelManager.showStatsPanel();
        window.showTaskView = () => statsPanelManager.showTaskView();
        window.updateStatsPanel = () => statsPanelManager.updateStatsPanel();
        console.log('✅ StatsPanelManager initialized (Phase 2)');

        // ✅ Initialize Recurring Modules (Phase 2 module)
        console.log('🔄 Initializing recurring task modules...');
        try {
            const { initializeRecurringModules } = await import(withV('./utilities/recurringIntegration.js'));
            const recurringModules = await initializeRecurringModules();
            window._recurringModules = recurringModules;
            console.log('✅ Recurring modules initialized (Phase 2)');

            // Optional: Run integration test in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🧪 Running recurring integration test...');
                setTimeout(() => {
                    const results = window.testRecurringIntegration();
                    if (Object.values(results).every(r => r === true)) {
                        console.log('✅ Recurring integration test PASSED:', results);
                    } else {
                        console.log('ℹ️ Recurring integration test results (run window.testRecurringIntegration() to retest):', results);
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('❌ Failed to initialize recurring modules:', error);
            if (typeof showNotification === 'function') {
                showNotification('Recurring feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without recurring functionality');
        }

        // ✅ Initialize Reminders Module (Phase 2 module)
        console.log('🔔 Initializing reminders module...');
        try {
            const { initReminderManager } = await import(withV('./utilities/reminders.js'));

            await initReminderManager({
                showNotification: (msg, type, duration) => window.showNotification?.(msg, type, duration),
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                getElementById: (id) => document.getElementById(id),
                querySelectorAll: (selector) => document.querySelectorAll(selector),
                updateUndoRedoButtons: () => window.updateUndoRedoButtons?.(),
                safeAddEventListener: (element, event, handler) => window.safeAddEventListener?.(element, event, handler),
                autoSave: () => window.autoSave?.()
            });

            console.log('✅ Reminders module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize reminders module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Reminders feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without reminders functionality');
        }

        // ✅ Initialize Due Dates Module (Phase 2 module)
        console.log('📅 Initializing due dates module...');
        try {
            const { initDueDatesManager } = await import(withV('./utilities/dueDates.js'));

            await initDueDatesManager({
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                showNotification: (msg, type, duration) => window.showNotification?.(msg, type, duration),
                updateStatsPanel: () => window.updateStatsPanel?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                saveTaskToSchema25: (cycleId, cycleData) => window.saveTaskToSchema25?.(cycleId, cycleData),
                getElementById: (id) => document.getElementById(id),
                querySelectorAll: (selector) => document.querySelectorAll(selector),
                safeAddEventListener: (element, event, handler) => window.safeAddEventListener?.(element, event, handler)
            });

            console.log('✅ Due dates module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize due dates module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Due dates feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without due dates functionality');
        }

        // ✅ Initialize Mode Manager (Phase 2 module)
        console.log('🎯 Initializing mode manager module...');
        try {
            const { initModeManager } = await import(withV('./utilities/cycle/modeManager.js'));

            await initModeManager({
                getAppState: () => window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                createTaskButtonContainer: (ctx) => window.createTaskButtonContainer?.(ctx),
                setupDueDateButtonInteraction: (btn, input) => window.setupDueDateButtonInteraction?.(btn, input),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
                helpWindowManager: () => window.helpWindowManager,
                getElementById: (id) => document.getElementById(id),
                querySelectorAll: (sel) => document.querySelectorAll(sel)
            });

            console.log('✅ Mode manager module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize mode manager module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Mode manager feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without mode manager functionality');
        }

        // ✅ Initialize Cycle Switcher (Phase 2 module)
        console.log('🔄 Initializing cycle switcher module...');
        try {
            const { initializeCycleSwitcher } = await import(withV('./utilities/cycle/cycleSwitcher.js'));

            await initializeCycleSwitcher({
                AppState: window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
                hideMainMenu: () => window.hideMainMenu?.(),
                showPromptModal: (opts) => window.showPromptModal?.(opts),
                showConfirmationModal: (opts) => window.showConfirmationModal?.(opts),
                sanitizeInput: (input) => window.sanitizeInput?.(input),
                loadMiniCycle: () => window.loadMiniCycle?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                updateStatsPanel: () => window.updateStatsPanel?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                updateReminderButtons: () => window.updateReminderButtons?.(),
                updateUndoRedoButtons: () => window.updateUndoRedoButtons?.(),
                initialSetup: () => initialSetup?.(),
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel)
            });

            console.log('✅ Cycle switcher module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize cycle switcher module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Cycle switcher feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without cycle switcher functionality');
        }

        // ✅ Initialize Cycle Manager (Phase 2 module)
        console.log('🔄 Initializing cycle manager module...');
        try {
            const { initializeCycleManager } = await import(withV('./utilities/cycle/cycleManager.js'));

            await initializeCycleManager({
                AppState: window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                showPromptModal: (opts) => window.showPromptModal?.(opts),
                showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
                sanitizeInput: (input) => window.sanitizeInput?.(input),
                completeInitialSetup: (id, data) => window.completeInitialSetup?.(id, data),
                hideMainMenu: () => window.hideMainMenu?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                autoSave: () => window.autoSave?.(),
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel)
            });

            console.log('✅ Cycle manager module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize cycle manager module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Cycle creation feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without cycle manager functionality');
        }

        // ✅ Initialize Undo/Redo Manager (Phase 2 module)
        console.log('🔄 Initializing undo/redo manager module...');
        try {
            const undoRedoModule = await import(withV('./utilities/ui/undoRedoManager.js'));

            undoRedoModule.setUndoRedoManagerDependencies({
                AppState: window.AppState,
                refreshUIFromState: refreshUIFromState,
                AppGlobalState: window.AppGlobalState,
                getElementById: (id) => document.getElementById(id),
                safeAddEventListener: window.safeAddEventListener
            });

            // Wire up UI and initialize
            undoRedoModule.wireUndoRedoUI();
            undoRedoModule.setupStateBasedUndoRedo();

            // Expose functions globally for backward compatibility
            window.wireUndoRedoUI = undoRedoModule.wireUndoRedoUI;
            window.initializeUndoRedoButtons = undoRedoModule.initializeUndoRedoButtons;
            window.captureInitialSnapshot = undoRedoModule.captureInitialSnapshot;
            window.setupStateBasedUndoRedo = undoRedoModule.setupStateBasedUndoRedo;
            window.enableUndoSystemOnFirstInteraction = undoRedoModule.enableUndoSystemOnFirstInteraction;
            window.captureStateSnapshot = undoRedoModule.captureStateSnapshot;
            window.buildSnapshotSignature = undoRedoModule.buildSnapshotSignature;
            window.snapshotsEqual = undoRedoModule.snapshotsEqual;
            window.performStateBasedUndo = undoRedoModule.performStateBasedUndo;
            window.performStateBasedRedo = undoRedoModule.performStateBasedRedo;
            window.updateUndoRedoButtons = undoRedoModule.updateUndoRedoButtons;

            console.log('✅ Undo/redo manager module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize undo/redo manager module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Undo/redo feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without undo/redo functionality');
        }

        // ✅ Initialize Menu Manager (Phase 2 module)
        console.log('🎛️ Initializing menu manager module...');
        try {
            const { initMenuManager } = await import(withV('./utilities/ui/menuManager.js'));

            await initMenuManager({
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                AppState: () => window.AppState,
                showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
                showPromptModal: (opts) => window.showPromptModal?.(opts),
                showConfirmationModal: (opts) => window.showConfirmationModal?.(opts),
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel),
                safeAddEventListener: (el, ev, handler) => window.safeAddEventListener?.(el, ev, handler),
                switchMiniCycle: () => window.switchMiniCycle?.(),
                createNewMiniCycle: () => window.createNewMiniCycle?.(),
                loadMiniCycle: () => window.loadMiniCycle?.(),
                updateCycleModeDescription: () => window.updateCycleModeDescription?.(),
                checkGamesUnlock: () => window.checkGamesUnlock?.(),
                sanitizeInput: (input) => window.sanitizeInput?.(input),
                updateCycleData: (cycleId, producer, immediate) => window.updateCycleData?.(cycleId, producer, immediate),
                updateProgressBar: () => window.updateProgressBar?.(),
                updateStatsPanel: () => window.updateStatsPanel?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                updateUndoRedoButtons: () => window.updateUndoRedoButtons?.()
            });

            console.log('✅ Menu manager module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize menu manager module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Menu manager feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without menu manager functionality');
        }

        // ✅ Initialize Settings Manager (Phase 2 module)
        console.log('⚙️ Initializing settings manager module...');
        try {
            const { initSettingsManager } = await import(withV('./utilities/ui/settingsManager.js'));

            await initSettingsManager({
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                AppState: () => window.AppState,
                showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
                showConfirmationModal: (opts) => window.showConfirmationModal?.(opts),
                hideMainMenu: () => window.hideMainMenu?.(),
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel),
                safeAddEventListener: (el, ev, handler) => window.safeAddEventListener?.(el, ev, handler),
                setupDarkModeToggle: (id, syncIds) => window.setupDarkModeToggle?.(id, syncIds),
                setupQuickDarkToggle: () => window.setupQuickDarkToggle?.(),
                updateMoveArrowsVisibility: () => window.updateMoveArrowsVisibility?.(),
                toggleHoverTaskOptions: (enabled) => window.toggleHoverTaskOptions?.(enabled),
                refreshTaskListUI: () => window.refreshTaskListUI?.(),
                performSchema25Migration: () => window.performSchema25Migration?.()
            });

            console.log('✅ Settings manager module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize settings manager module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Settings manager feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without settings manager functionality');
        }

        // ✅ Initialize Task Core (Phase 2 module)
        console.log('🎯 Initializing task core module...');
        try {
            const { initTaskCore } = await import(withV('./utilities/task/taskCore.js'));

            await initTaskCore({
                // State management
                AppState: window.AppState,

                // Data operations
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                sanitizeInput: (text) => window.sanitizeInput?.(text),

                // UI updates
                showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
                updateStatsPanel: () => window.updateStatsPanel?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                refreshUIFromState: () => window.refreshUIFromState?.(),

                // Undo system
                captureStateSnapshot: (state) => window.captureStateSnapshot?.(state),
                enableUndoSystemOnFirstInteraction: () => window.enableUndoSystemOnFirstInteraction?.(),

                // Modal system
                showPromptModal: (config) => window.showPromptModal?.(config),
                showConfirmationModal: (config) => window.showConfirmationModal?.(config),

                // DOM helpers
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel),

                // Task DOM creation (temporary - these will be extracted to taskDOM.js later)
                validateAndSanitizeTaskInput: (text) => window.validateAndSanitizeTaskInput?.(text),
                loadTaskContext: (...args) => window.loadTaskContext?.(...args),
                createOrUpdateTaskData: (ctx) => window.createOrUpdateTaskData?.(ctx),
                createTaskDOMElements: (ctx, data) => window.createTaskDOMElements?.(ctx, data),
                setupTaskInteractions: (els, ctx) => window.setupTaskInteractions?.(els, ctx),
                finalizeTaskCreation: (els, ctx, opts) => window.finalizeTaskCreation?.(els, ctx, opts),

                // Auto-save
                autoSave: () => window.autoSave?.()
            });

            console.log('✅ Task core module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize task core module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Task core feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without task core functionality');
        }

        // ✅ Initialize Task DOM Manager (Phase 2 module)
        console.log('🎨 Initializing task DOM module...');
        try {
            const { initTaskDOMManager } = await import(withV('./utilities/task/taskDOM.js'));

            await initTaskDOMManager({
                // State management
                AppState: window.AppState,

                // Data operations
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                sanitizeInput: (text) => window.sanitizeInput?.(text),
                generateId: () => window.generateId?.(),
                autoSave: () => window.autoSave?.(),

                // UI notification and updates
                showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
                updateProgressBar: () => window.updateProgressBar?.(),
                updateStatsPanel: () => window.updateStatsPanel?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                refreshUIFromState: () => window.refreshUIFromState?.(),
                updateMainMenuHeader: () => window.updateMainMenuHeader?.(),
                updateRecurringPanelButtonVisibility: () => window.updateRecurringPanelButtonVisibility?.(),
                triggerLogoBackground: (type, dur) => window.triggerLogoBackground?.(type, dur),

                // DOM helpers
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel),
                safeAddEventListener: (el, evt, handler) => window.safeAddEventListener?.(el, evt, handler),

                // Task operations (from taskCore module)
                handleTaskCompletionChange: (taskItem, shouldSave) => window.handleTaskCompletionChange?.(taskItem, shouldSave),
                addTask: (...args) => window.addTask?.(...args),

                // Due dates module
                createDueDateInput: (taskContext, taskData) => window.createDueDateInput?.(taskContext, taskData),
                setupDueDateButtonInteraction: (input, taskContext) => window.setupDueDateButtonInteraction?.(input, taskContext),
                checkOverdueTasks: () => window.checkOverdueTasks?.(),
                remindOverdueTasks: () => window.remindOverdueTasks?.(),

                // Recurring module
                recurringPanel: window.recurringPanel,
                setupRecurringButtonHandler: (btn, ctx) => window.setupRecurringButtonHandler?.(btn, ctx),
                handleRecurringTaskActivation: (taskItem, task, recurringBtn) => window.handleRecurringTaskActivation?.(taskItem, task, recurringBtn),
                handleRecurringTaskDeactivation: (taskItem, task, recurringBtn) => window.handleRecurringTaskDeactivation?.(taskItem, task, recurringBtn),

                // Reminders module
                setupReminderButtonHandler: (btn, ctx) => window.setupReminderButtonHandler?.(btn, ctx),

                // Undo system
                enableUndoSystemOnFirstInteraction: () => window.enableUndoSystemOnFirstInteraction?.(),
                updateUndoRedoButtons: () => window.updateUndoRedoButtons?.(),

                // Task options UI
                showTaskOptions: (taskItem) => window.showTaskOptions?.(taskItem),
                hideTaskOptions: (taskItem) => window.hideTaskOptions?.(taskItem),
                attachKeyboardTaskOptionToggle: (taskItem, threeDotsBtn) => window.attachKeyboardTaskOptionToggle?.(taskItem, threeDotsBtn),

                // Drag and drop / arrows
                DragAndDrop: window.DragAndDrop,
                updateArrowsInDOM: (taskItem) => window.updateArrowsInDOM?.(taskItem),
                updateMoveArrowsVisibility: () => window.updateMoveArrowsVisibility?.(),

                // Cycle operations
                checkMiniCycle: () => window.checkMiniCycle?.(),
                loadMiniCycle: () => window.loadMiniCycle?.()
            });

            console.log('✅ Task DOM module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize task DOM module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Task DOM feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without task DOM functionality');
        }

        // ✅ Mark Phase 2 complete - all modules are now loaded and ready
        console.log('✅ Phase 2 complete - all modules initialized');
        await appInit.markAppReady();

        // ============ PHASE 3: DATA LOADING ============
        console.log('📊 Phase 3: Loading app data...');

        // 🎯 Now that all modules are ready, load data
        try {
          console.log('🔧 Running fixTaskValidationIssues...');
          fixTaskValidationIssues();

          console.log('🚀 Running initializeAppWithAutoMigration...');
          // ✅ IMPORTANT: initializeAppWithAutoMigration calls initialSetup() after Phase 2 modules are ready
          initializeAppWithAutoMigration({ forceMode: true }); // will call initialSetup() async
          console.log('✅ Data initialization sequence started');
        } catch (error) {
          console.error('❌ Critical initialization error:', error);
          console.error('❌ Error stack:', error.stack);
        }

        // ✅ Setup taskCore event listeners (after taskCore loaded in Phase 2)
        try {
          const completeAllButton = document.getElementById("completeAll");
          if (completeAllButton && typeof window.handleCompleteAllTasks === 'function') {
            safeAddEventListener(completeAllButton, "click", window.handleCompleteAllTasks);
            console.log('✅ Complete All button listener attached');
          }
        } catch (eventErr) {
          console.warn('⚠️ Failed to setup Complete All listener:', eventErr);
        }

        // ✅ Undo/Redo buttons already wired in Phase 2 (undoRedoManager module)

        // 🧰 Centralize undo snapshots on AppState.update (wrap once)
        try {
          if (!window.__wrappedAppStateUpdate) {
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
                  if (prev) captureStateSnapshot(prev);
                }
              } catch (e) {
                console.warn('⚠️ Undo snapshot wrapper error:', e);
              }
              return boundUpdate(producer, immediate);
            };

            window.__wrappedAppStateUpdate = true;
            window.__useUpdateWrapper = true; // ✅ wrapper becomes single snapshot source
            console.log('🧰 Undo snapshots centralized on AppState.update (bound)');
          }
        } catch (e) {
          console.warn('⚠️ Failed to wrap AppState.update:', e);
        }

        // ✅ State-based undo/redo subscription already set up in Phase 2 (undoRedoManager module)

        // 🔘 Update button states and capture an initial snapshot
        try {
          updateUndoRedoButtons();

          // Only capture initial snapshot if not using the update wrapper
          if (!window.__useUpdateWrapper) {
            setTimeout(() => {
              try {
                const st = window.AppState.get?.();
                if (st) captureStateSnapshot(st);
              } catch (e) {
                console.warn('⚠️ Initial snapshot failed:', e);
              }
            }, 50);
          }
        } catch (uiErr) {
          console.warn('⚠️ Undo/redo UI init failed:', uiErr);
        }

        // ✅ Initialize Testing Modal modules (Phase 3)
        console.log('🔬 Loading testing modal modules...');
        try {
            await import(withV('./utilities/testing-modal.js'));
            console.log('✅ Testing modal loaded');

            await import(withV('./utilities/testing-modal-integration.js'));
            console.log('✅ Testing modal integration loaded');
        } catch (error) {
            console.error('❌ Failed to load testing modal modules:', error);
            console.warn('⚠️ App will continue without testing modal functionality');
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
  // Old initialization code removed - see utilities/recurringIntegration.js
  console.log('🔁 Recurring features initialized via recurringIntegration module');

  // ✅ Mode Selector (with delay for DOM readiness)
  console.log('🎯 Initializing mode selector...');
  initializeModeSelector(); // This calls setupModeSelector()

  // ✅ Reminder System (with staggered timing)
  console.log('🔔 Setting up reminder system...');

  // ✅ setupReminderToggle() now handled by reminderManager.init() in Phase 2

  setTimeout(() => {
    try {
      remindOverdueTasks();
    } catch (error) {
      console.warn('⚠️ Overdue task reminder failed:', error);
    }
  }, 2000);
  // ✅ checkDueDates now handled by dueDatesManager.init() in Phase 2

  setTimeout(() => {
    try {
      updateReminderButtons(); // ✅ This is the *right* place!
      startReminders();
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
  updateMoveArrowsVisibility();

  // ✅ App already marked as ready at line 777 after Phase 2 modules loaded
  console.log('✅ miniCycle initialization complete - app is ready');

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
// ✅ All undo/redo functions moved to utilities/ui/undoRedoManager.js:
// - initializeUndoRedoButtons
// - captureInitialSnapshot
// - setupStateBasedUndoRedo
// - enableUndoSystemOnFirstInteraction
// ✅ captureStateSnapshot moved to utilities/ui/undoRedoManager.js
// ✅ buildSnapshotSignature & snapshotsEqual moved to utilities/ui/undoRedoManager.js
// ✅ performStateBasedUndo moved to utilities/ui/undoRedoManager.js
// ✅ performStateBasedRedo moved to utilities/ui/undoRedoManager.js

// ✅ Helper: prefer AppState for UI refresh; fall back to loader
function refreshUIFromState(providedState = null) {
  const state =
    providedState ||
    (window.AppState?.isReady?.() ? window.AppState.get() : null);

  if (state?.data?.cycles && state?.appState?.activeCycleId) {
    const cid = state.appState.activeCycleId;
    const cycle = state.data.cycles[cid];
    if (cycle) {
      // Render directly from current in‑memory state
      renderTasks(cycle.tasks || []);
      
      // ✅ Restore UI state after rendering
      const arrowsVisible = state.ui?.moveArrowsVisible || false;
      updateArrowsInDOM(arrowsVisible);
      
      // Update other UI bits that don't depend on reloading storage
      // ✅ Recurring panel updates now handled by recurringPanel module via window.recurringPanel
      if (window.recurringPanel?.updateRecurringPanel) window.recurringPanel.updateRecurringPanel();
      if (window.recurringPanel?.updateRecurringPanelButtonVisibility) window.recurringPanel.updateRecurringPanelButtonVisibility();
      if (typeof updateMainMenuHeader === 'function') updateMainMenuHeader();
      if (typeof updateProgressBar === 'function') updateProgressBar();
      if (typeof checkCompleteAllButton === 'function') checkCompleteAllButton();
      return;
    }
  }

  // Fallback: loader (reads from localStorage)
  if (typeof window.loadMiniCycle === 'function') {
    window.loadMiniCycle();
    
    // ✅ Also restore arrow visibility after fallback load
    setTimeout(() => {
      if (window.AppState?.isReady?.()) {
        const currentState = window.AppState.get();
        const arrowsVisible = currentState?.ui?.moveArrowsVisible || false;
        updateArrowsInDOM(arrowsVisible);
      }
    }, 50);
  }
}

// ✅ Make refreshUIFromState globally available for recurring modules
// ❌ DISABLED: Old export - now provided by taskDOM module
// window.refreshUIFromState = refreshUIFromState;

// ✅ updateUndoRedoButtons moved to utilities/ui/undoRedoManager.js
// Globally exposed via Phase 2 integration











function renderTasks(tasksArray = []) {
  console.log('🔄 Rendering tasks (Schema 2.5 only)...');
  
  const taskList = document.getElementById("taskList");
  if (!taskList) {
    console.error('❌ Task list container not found');
    return;
  }
  
  taskList.innerHTML = ""; // Clear existing tasks from DOM

  if (!Array.isArray(tasksArray)) {
    console.warn('⚠️ Invalid tasks array provided to renderTasks');
    return;
  }

  console.log(`📋 Rendering ${tasksArray.length} tasks`);

  tasksArray.forEach(task => {
    if (!task || !task.id) {
      console.warn('⚠️ Skipping invalid task:', task);
      return;
    }

    addTask(
      task.text,
      task.completed,
      false,                     // shouldSave: false (don't save during render)
      task.dueDate,
      task.highPriority,
      true,                      // isLoading: true (avoid overdue reminder popups)
      task.remindersEnabled,
      task.recurring,
      task.id,
      task.recurringSettings
    );
  });

  // Re-run UI state updates
  updateProgressBar();
  checkCompleteAllButton();
  updateStatsPanel();
  
  // ✅ Update recurring panel button visibility
  if (typeof updateRecurringPanelButtonVisibility === 'function') {
    updateRecurringPanelButtonVisibility();
  }
  
  // ✅ Restore arrow visibility from state after rendering
  if (window.AppState?.isReady?.()) {
    const currentState = window.AppState.get();
    const arrowsVisible = currentState?.ui?.moveArrowsVisible || false;
    updateArrowsInDOM(arrowsVisible);
  }

  console.log('✅ Task rendering completed and UI state restored');
}



// Undo "Z" and Redo "Y" keyboard shortcuts (state-based)
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        performStateBasedUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        performStateBasedRedo();
    }
});


// ✅ Note: generateNotificationId and generateHashId are now in utilities/globalUtils.js
// They are automatically available globally via window.generateNotificationId and window.generateHashId

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


        function refreshTaskListUI() {
          console.log('🔄 Refreshing task list UI (Schema 2.5 only)...');

          const schemaData = loadMiniCycleData();
          if (!schemaData) {
              console.error('❌ Schema 2.5 data required for refreshTaskListUI');
              throw new Error('Schema 2.5 data not found');
          }

          const { cycles, activeCycle } = schemaData;
          const cycleData = cycles[activeCycle];

          if (!cycleData) {
              console.warn("⚠️ No active cycle found for UI refresh");
              return;
          }

          // Clear current list
          const taskListContainer = document.getElementById("taskList");
          if (!taskListContainer) return;
          taskListContainer.innerHTML = "";

          // Re-render each task from Schema 2.5
          (cycleData.tasks || []).forEach(task => {
              addTask(
                  task.text,
                  task.completed,
                  false, // Don't double save
                  task.dueDate,
                  task.highPriority,
                  true,  // isLoading (skip overdue reminder immediately)
                  task.remindersEnabled,
                  task.recurring,
                  task.id,
                  task.recurringSettings
              );
          });

          if (window.recurringCore?.updateRecurringButtonVisibility) window.recurringCore.updateRecurringButtonVisibility();
          console.log("✅ Task list UI refreshed from Schema 2.5");
      }

// Export for module use
window.refreshTaskListUI = refreshTaskListUI;


// ✅ REMOVED: initializeDefaultRecurringSettings - now handled by recurringCore module

// ...existing code...



// Helper function to get readable mode name (keep this)


// ...existing code...
/**

/**
 * Initializes the miniCycle app by loading or creating a saved miniCycle.
 * Ensures a valid miniCycle is always available in localStorage.
 */
// ✅ UPDATED: Check onboarding first, then handle cycle creation
// ✅ IMPORTANT: async to wait for Phase 2 modules before creating tasks
async function initialSetup() {
    console.log('🚀 Initializing app (Schema 2.5 only)...');

    // ✅ Wait for all Phase 2 modules to be ready before creating tasks
    if (window.appInit && !window.appInit.isAppReady()) {
        console.log('⏳ Waiting for Phase 2 modules to finish loading...');
        await window.appInit.waitForApp();
        console.log('✅ Phase 2 modules ready, proceeding with initialSetup');
    }

    let schemaData = loadMiniCycleData();
    
    // ✅ CREATE SCHEMA 2.5 DATA IF IT DOESN'T EXIST
    if (!schemaData) {
        console.log('🆕 No Schema 2.5 data found - creating initial structure...');
        createInitialSchema25Data();
        schemaData = loadMiniCycleData(); // Load the newly created data
    }

    const { cycles, activeCycle, reminders, settings } = schemaData;
    
    console.log("📦 Loaded Schema 2.5 data:", {
        activeCycle,
        cycleCount: Object.keys(cycles).length,
        hasReminders: !!reminders,
        hasSettings: !!settings
    });
    
    // ✅ CHECK ONBOARDING FIRST - before checking for cycles
    if (window.onboardingManager?.shouldShowOnboarding()) {
        console.log('👋 First time user - showing onboarding first...');
        window.onboardingManager.showOnboarding(cycles, activeCycle);
        return;
    }
    
    // Check if we have a valid active cycle (existing users)
    if (!activeCycle || !cycles[activeCycle]) {
        console.log('🆕 Existing user, no active cycle found, prompting for new cycle creation...');
        showCycleCreationModal();
        return;
    }
    
    // ✅ Complete setup for existing cycles
    completeInitialSetup(activeCycle, null, schemaData);
}

// ✅ Keep the same completeInitialSetup and createInitialSchema25Data functions
async function completeInitialSetup(activeCycle, fullSchemaData = null, schemaData = null) {
  console.log('✅ Completing initial setup for cycle:', activeCycle);

  // Call the loader only via the global (attached by cycleLoader import)
  console.log('🎯 Loading miniCycle...');
  if (typeof window.loadMiniCycle === 'function') {
    await window.loadMiniCycle();

    // ✅ Now that tasks are rendered, update reminder buttons, due date visibility, and check overdue tasks
    console.log('📋 Tasks rendered, updating reminder buttons, due date visibility, and checking overdue tasks...');
    if (typeof window.updateReminderButtons === 'function') {
      await window.updateReminderButtons();
      console.log('✅ Reminder buttons updated after task rendering');
    }
    if (typeof window.updateDueDateVisibility === 'function') {
      const toggleAutoReset = document.getElementById('toggleAutoReset');
      const autoReset = toggleAutoReset?.checked || false;
      await window.updateDueDateVisibility(autoReset);
      console.log('✅ Due date visibility updated after task rendering');
    }
    if (typeof window.checkOverdueTasks === 'function') {
      await window.checkOverdueTasks();
      console.log('✅ Overdue tasks checked after task rendering');
    }
  } else {
    console.log('⏳ Loader not ready yet, flagging pending load');
    window.__pendingCycleLoad = true;
  }
    
    // Get fresh data if not provided
    if (!schemaData) {
        schemaData = loadMiniCycleData();
    }
    
    if (!fullSchemaData) {
        fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    }
    
    const { cycles, reminders, settings } = schemaData;
    const currentCycle = cycles[activeCycle];
    
    if (!currentCycle) {
        console.error('❌ Cycle not found after setup:', activeCycle);
        return;
    }
    
    console.log('✅ Loading existing cycle from Schema 2.5:', activeCycle);
    
    // Load UI from Schema 2.5
    const titleElement = document.getElementById("mini-cycle-title");
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
    const enableReminders = document.getElementById("enableReminders");
    const frequencySection = document.getElementById("frequency-section");
    
    if (titleElement) {
        titleElement.textContent = currentCycle.title;
    }
    
    if (toggleAutoReset) {
        toggleAutoReset.checked = currentCycle.autoReset || false;
    }
    
    if (deleteCheckedTasks) {
        deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
    }
    
    console.log('⚙️ Applied cycle settings:', {
        autoReset: currentCycle.autoReset,
        deleteCheckedTasks: currentCycle.deleteCheckedTasks
    });
    
    // Load reminders from Schema 2.5
    if (enableReminders) {
        enableReminders.checked = reminders.enabled === true;
        
        if (reminders.enabled && frequencySection) {
            console.log('🔔 Starting reminders...');
            frequencySection.classList.remove("hidden");
            startReminders();
        }
    }

    // Apply dark mode and theme from settings
    if (settings.darkMode) {
        console.log('🌙 Applying dark mode...');
        document.body.classList.add("dark-mode");
    }
    
    if (settings.theme && settings.theme !== 'default') {
        console.log('🎨 Applying theme:', settings.theme);
        // Apply theme without calling updateThemeColor() to avoid double call
        const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
        allThemes.forEach(theme => document.body.classList.remove(theme));
        document.body.classList.add(`theme-${settings.theme}`);
    }
    
    // Update theme color after applying all settings
    if (typeof updateThemeColor === 'function') {
        updateThemeColor();
    }
    

  // ✅ Tell the app that data (active cycle) is ready
  try {
    window.AppInit?.signalReady?.(activeCycle);
  } catch (e) {
    console.warn('AppInit signal failed:', e);
  }

    // ✅ Mark app as ready here (after data-ready)
  window.AppReady = true;
  console.log("✅ miniCycle app is fully initialized and ready (Schema 2.5).");
  console.log('🎉 Initialization sequence completed successfully!');
  console.log('✅ Initial setup completed successfully');
}









// Update your existing setupDarkModeToggle function to include quick toggle


// setupQuickDarkToggle function


// ✅ Dynamic Theme Color System with Gradient-Matching Solid Colors

  
  // Optional helper to format checkbox IDs
/**
 * Enables editing of the miniCycle title and saves changes to localStorage.
 * Prevents empty titles and restores the previous title if an invalid entry is made.
 */

function setupMiniCycleTitleListener() {
    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return;

    titleElement.contentEditable = true;

    if (!titleElement.dataset.listenerAdded) {
        titleElement.addEventListener("blur", async () => { // <= make async
            let newTitle = sanitizeInput(titleElement.textContent.trim());


            if (newTitle === "") {
                console.log('🔍 Empty title detected, reverting (Schema 2.5 only)...');
                
                const schemaData = loadMiniCycleData();
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for title revert');
                    return;
                }

                const { cycles, activeCycle } = schemaData;
                const oldTitle = cycles[activeCycle]?.title || "Untitled miniCycle";

                showNotification("⚠ Title cannot be empty. Reverting to previous title.");
                titleElement.textContent = oldTitle;
                return;
            }

             console.log('📝 Updating title (Schema 2.5 only)...');
            const schemaData = loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Schema 2.5 data required for setupMiniCycleTitleListener');
                return;
            }

            const { cycles, activeCycle } = schemaData;
            const miniCycleData = cycles[activeCycle];
            if (!activeCycle || !miniCycleData) {
                console.warn("⚠ No active miniCycle found. Title update aborted.");
                return;
            }

            const oldTitle = miniCycleData.title;
            if (newTitle !== oldTitle) {
                console.log(`🔄 Title change detected: "${oldTitle}" → "${newTitle}"`);

                // ✅ Update via AppState so undo captures oldState
                if (window.AppState?.isReady?.()) {
                    await window.AppState.update(state => {
                        const cid = state.appState.activeCycleId;
                        const cycle = state.data.cycles[cid];
                        if (cycle) cycle.title = newTitle;
                    }, true);
                } else {
                    // Fallback to direct localStorage
                    titleElement.textContent = newTitle;
                    miniCycleData.title = newTitle;
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    fullSchemaData.data.cycles[activeCycle] = miniCycleData;
                    fullSchemaData.metadata.lastModified = Date.now();
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                }

                // 🔄 Refresh UI
                updateMainMenuHeader();
                updateUndoRedoButtons(); // ✅ Use centralized button management
            }
        });

        titleElement.dataset.listenerAdded = true;
    }
}

/**
 * Saves the current state of the active miniCycle to localStorage.
 * Captures task list, completion status, due dates, priority settings, and reminders.
 */
// ✅ SIMPLE FIX: Just make this function async and await the state module update

// ✅ SIMPLIFIED: Clean autosave with proper fallback strategy
// ...near your autoSave() and autoSaveWithStateModule()...
let __stateSaveWarnedOnce = false;

async function autoSave(overrideTaskList = null, immediate = false) {
  // Prefer state module when truly ready
  if (window.AppState && typeof window.AppState.isReady === 'function' && window.AppState.isReady()
      && typeof window.AppState.update === 'function') {
    try {
      return await autoSaveWithStateModule(overrideTaskList, immediate);
    } catch (error) {
      if (!__stateSaveWarnedOnce) {
        console.warn('⚠️ State module save failed, using direct method:', error?.message || error);
        __stateSaveWarnedOnce = true; // avoid log spam
        // optional: reset after a while
        setTimeout(() => { __stateSaveWarnedOnce = false; }, 5000);
      }
      // fall through to direct save
    }
  }
  return await directSave(overrideTaskList);
}

async function autoSaveWithStateModule(overrideTaskList = null, immediate = false) {
  if (!window.AppState || typeof window.AppState.isReady !== 'function' || !window.AppState.isReady()
      || typeof window.AppState.update !== 'function') {
    throw new Error('State module not ready');
  }

  const taskData = overrideTaskList || extractTaskDataFromDOM();
  await window.AppState.update(state => {
    const activeCycle = state.appState.activeCycleId;
    const currentCycle = state.data.cycles[activeCycle];
    if (!currentCycle) throw new Error(`Active cycle "${activeCycle}" not found`);
    currentCycle.tasks = taskData;
    // ✅ updateRecurringTemplates now handled by recurringCore module (called via watcher)
  }, immediate);

  return { success: true, taskCount: taskData.length };
}

// ✅ SIMPLIFIED: Direct save method (fallback)
async function directSave(overrideTaskList = null) {
  const schemaData = loadMiniCycleData();
  if (!schemaData?.activeCycle) {
    throw new Error('No active cycle found');
  }

  const { cycles, activeCycle } = schemaData;
  const taskData = overrideTaskList || extractTaskDataFromDOM();
  
  console.log('📝 Direct saving tasks:', taskData.length);
  
  // Update Schema 2.5 structure
  const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
  const currentCycle = fullSchemaData.data.cycles[activeCycle];

  currentCycle.tasks = taskData;
  // ✅ updateRecurringTemplates now handled by recurringCore module (called via watcher)
  
  fullSchemaData.metadata.lastModified = Date.now();
  localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
  
  console.log('✅ Direct save completed');
  return { success: true, taskCount: taskData.length };
}

// ✅ EXTRACTED: Common task data extraction logic
function extractTaskDataFromDOM() {
  const taskListElement = document.getElementById("taskList");
  if (!taskListElement) {
    console.warn('⚠️ Task list element not found');
    return [];
  }

  return [...taskListElement.children].map(taskElement => {
    const taskTextElement = taskElement.querySelector(".task-text");
    const taskId = taskElement.dataset.taskId;

    if (!taskTextElement || !taskId) {
      console.warn("⚠️ Skipping invalid task element");
      return null;
    }

    // Extract recurring settings safely
    let recurringSettings = {};
    try {
      const settingsAttr = taskElement.getAttribute("data-recurring-settings");
      if (settingsAttr) {
        recurringSettings = JSON.parse(settingsAttr);
      }
    } catch (err) {
      console.warn("⚠️ Invalid recurring settings, using empty object");
    }

    return {
      id: taskId,
      text: taskTextElement.textContent,
      completed: taskElement.querySelector("input[type='checkbox']")?.checked || false,
      dueDate: taskElement.querySelector(".due-date")?.value || null,
      highPriority: taskElement.classList.contains("high-priority"),
      remindersEnabled: taskElement.querySelector(".enable-task-reminders")?.classList.contains("reminder-active") || false,
      recurring: taskElement.querySelector(".recurring-btn")?.classList.contains("active") || false,
      recurringSettings,
      schemaVersion: 2
    };
  }).filter(Boolean);
}

// ✅ EXTRACTED: Common recurring templates update logic
// ✅ REMOVED: updateRecurringTemplates - now handled by recurringCore module

// ✅ REMOVE the legacyAutoSave function since it's now integrated into autoSave
/**
 * Loads the last used miniCycle from localStorage and updates the UI.
 * Ensures tasks, title, settings, and overdue statuses are properly restored.
 */

/**
 * Checks for overdue tasks and visually marks them as overdue.
 * Notifies the user if newly overdue tasks are detected.
 *
 * @param {HTMLElement|null} taskToCheck - The specific task to check, or null to check all tasks.
 */

















// Add this after your existing migration functions, around line 1100

// ==========================================
// 🔄 SCHEMA 2.5 MIGRATION SYSTEM. in migrationManager.js
// ==========================================



// ✅ Make loadMiniCycleData() return legacy-compatible data as fallback
function loadMiniCycleData() {
    const data = localStorage.getItem("miniCycleData");
    if (data) {
        try {
            const parsed = JSON.parse(data);
            return {
                cycles: parsed.data.cycles,
                activeCycle: parsed.appState.activeCycleId,
                reminders: parsed.customReminders,
                settings: parsed.settings
            };
        } catch (error) {
            console.error('❌ Error parsing Schema 2.5 data:', error);
            console.error('❌ This likely means data is corrupted. NOT creating fresh data to preserve existing localStorage.');
            return null; // ✅ FIX: Return null instead of falling through to create fresh data
        }
    }

    // ✅ CREATE INITIAL DATA IF NONE EXISTS
    // ✅ SAFETY CHECK: Verify localStorage truly has no data before creating fresh data
    const existingData = localStorage.getItem("miniCycleData");
    if (existingData) {
        console.error('❌ Data exists in localStorage but failed to parse. NOT creating fresh data to prevent data loss.');
        console.error('❌ Existing data:', existingData.substring(0, 200) + '...');
        return null;
    }

    console.log('🆕 No data found in localStorage - Creating initial Schema 2.5 structure...');
    createInitialSchema25Data();

    // Try again after creating
    const newData = localStorage.getItem("miniCycleData");
    if (newData) {
        const parsed = JSON.parse(newData);
        return {
            cycles: parsed.data.cycles,
            activeCycle: parsed.appState.activeCycleId,
            reminders: parsed.customReminders,
            settings: parsed.settings
        };
    }

    return null;
}

// Make loadMiniCycleData globally accessible for the notification module
window.loadMiniCycleData = loadMiniCycleData;

/**
 * Safely update cycle data - handles AppState or falls back to localStorage
 * Prevents race conditions with debounced saves by using AppState when available
 *
 * @param {string} cycleId - The cycle ID to update
 * @param {function} updateFn - Function that receives the cycle and modifies it
 * @param {boolean} immediate - Force immediate save (default: true for safety)
 * @returns {boolean} - True if update succeeded, false otherwise
 */
function updateCycleData(cycleId, updateFn, immediate = true) {
    console.log(`🔄 Updating cycle data for: ${cycleId} (immediate: ${immediate})`);

    if (!cycleId) {
        console.error('❌ cycleId is required for updateCycleData');
        return false;
    }

    if (typeof updateFn !== 'function') {
        console.error('❌ updateFn must be a function');
        return false;
    }

    try {
        // ✅ Use AppState if available (prevents race conditions)
        if (window.AppState?.isReady?.()) {
            window.AppState.update(state => {
                const cycle = state.data.cycles[cycleId];
                if (cycle) {
                    updateFn(cycle);
                    console.log('✅ Cycle updated via AppState');
                } else {
                    console.warn(`⚠️ Cycle not found: ${cycleId}`);
                }
            }, immediate);
            return true;
        } else {
            // ✅ Fallback to direct localStorage if AppState not ready
            console.warn('⚠️ AppState not ready, using localStorage fallback');
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));

            if (!fullSchemaData?.data?.cycles?.[cycleId]) {
                console.error(`❌ Cycle not found in localStorage: ${cycleId}`);
                return false;
            }

            const cycle = fullSchemaData.data.cycles[cycleId];
            updateFn(cycle);
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            console.log('✅ Cycle updated via localStorage (fallback)');
            return true;
        }
    } catch (error) {
        console.error('❌ updateCycleData failed:', error);
        return false;
    }
}



















/**
 * Remindoverduetasks function.
 *
 * @returns {void}
 */

function remindOverdueTasks() {
    console.log('⚠️ Checking for overdue tasks (Schema 2.5 only)...');
    
    let autoReset = toggleAutoReset.checked;
    if (autoReset) {
        console.log('🔄 Auto-reset enabled, skipping overdue reminders');
        return;
    }

    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for remindOverdueTasks');
        throw new Error('Schema 2.5 data not found');
    }

    const { reminders } = schemaData;
    const remindersSettings = reminders || {};
    
    console.log('📊 Reminder settings:', {
        enabled: remindersSettings.enabled,
        dueDatesReminders: remindersSettings.dueDatesReminders
    });
    
    const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;

    // ✅ Only proceed if due date notifications are enabled
    if (!dueDatesRemindersEnabled) {
        console.log("❌ Due date notifications are disabled. Exiting remindOverdueTasks().");
        return;
    }

    console.log('🔍 Scanning for overdue tasks...');
    
    let overdueTasks = [...document.querySelectorAll(".task")]
        .filter(task => task.classList.contains("overdue-task"))
        .map(task => task.querySelector(".task-text").textContent);

    console.log('📋 Found overdue tasks:', overdueTasks.length);

    if (overdueTasks.length > 0) {
        console.log('⚠️ Showing overdue notification for tasks:', overdueTasks);
        showNotification(`⚠️ Overdue Tasks:<br>- ${overdueTasks.join("<br>- ")}`, "error");
    } else {
        console.log('✅ No overdue tasks found');
    }
}











indefiniteCheckbox.addEventListener("change", () => {
  // If indefinite, hide the repeatCount row
  repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
});


// ============================================
// ✅ REMINDER SYSTEM - ALL FUNCTIONS MOVED TO utilities/reminders.js
// ============================================
// The following functions are now handled by the reminders module:
// - handleReminderToggle()
// - setupReminderToggle()
// - stopReminders()
// - autoSaveReminders()
// - loadRemindersSettings()
// - saveTaskReminderState()
// - sendReminderNotificationIfNeeded()
// - startReminders()
// - setupReminderButtonHandler()
// - updateReminderButtons()
//
// All functions are globally accessible via:
// - window.reminderManager (the module instance)
// - window.startReminders(), window.stopReminders(), etc. (individual functions)
//
// Modal event listeners remain here for backward compatibility:
closeRemindersBtn.addEventListener("click", () => {
    remindersModal.style.display = "none";
});

window.addEventListener("click", (event) => {
    if (event.target === remindersModal) {
        remindersModal.style.display = "none";
    }
});

document.getElementById('try-lite-version')?.addEventListener('click', function() {
  showConfirmationModal({
    title: "Switch to Lite Version",
    message: "Try the Lite version? It works great on older devices and slower connections.",
    confirmText: "Try Lite Version",
    cancelText: "Stay Here",
    callback: (confirmed) => {
      if (confirmed) {
        window.location.href = 'miniCycle-lite.html';
      }
    }
  });
});


/********
 * 
 * Show Notification function (Schema 2.5 only) - Modular Wrapper
 * 
 */
  
function showNotification(message, type = "default", duration = null) {
  if (!window.notifications || typeof window.notifications.show !== 'function') {
    return null;
  }
  return window.notifications.show(message, type, duration);
}

function setupNotificationDragging(notificationContainer) {
  return window.notifications.setupNotificationDragging(notificationContainer);
}

  
function resetNotificationPosition() {
  return window.notifications.resetPosition();
}


// � Access educational tips from the notification module
const educationalTips = notifications.educationalTips;

/**
 * 🚀 Enhanced Recurring Notification with Educational Tip
 * Updated implementation for your recurring feature
 */
// ✅ REMOVED: createRecurringNotificationWithTip - now handled by notifications module


/**
 * ✅ Enhanced recurring notification listeners with proper event handling (Schema 2.5 only)
 */
// ✅ REMOVED: initializeRecurringNotificationListeners - now handled by notifications module

/**
 * Show confirmation message after applying changes
 */
function showApplyConfirmation(targetElement) {
  return notifications.showApplyConfirmation(targetElement);
}

// 🛠 Unified recurring update helper (Schema 2.5 only)
// ✅ REMOVED: applyRecurringToTaskSchema25 - now handled by recurringCore module

// ✅ REMOVED: Old window.applyRecurringToTaskSchema25 assignment - now handled by recurringIntegration module

/**
 * 🔧 Enhanced showNotification function with educational tips support (Schema 2.5 only)
 */
function showNotificationWithTip(content, type = "default", duration = null, tipId = null) {
  if (!window.notifications || typeof window.notifications.showWithTip !== 'function') {
    return showNotification(content, type, duration);
  }
  return notifications.showWithTip(content, type, duration, tipId);
}

// ✅ Expose globally for recurring module
window.showNotificationWithTip = showNotificationWithTip;

/**
 * Show a confirmation modal and call callback with boolean result
 */
function showConfirmationModal(options) {
  return notifications.showConfirmationModal(options);
}

function showPromptModal(options) {
  return notifications.showPromptModal(options);
}

/**
 * Close all modals - delegated to modalManager
 */
function closeAllModals() {
  return window.modalManager?.closeAllModals();
}

// ✅ Expose globally for backward compatibility
window.showConfirmationModal = showConfirmationModal;
window.showPromptModal = showPromptModal;
window.closeAllModals = closeAllModals;


  // ✅ REMOVED: sendReminderNotificationIfNeeded() and startReminders() - Now in utilities/reminders.js
  // Use window.sendReminderNotificationIfNeeded() and window.startReminders() which are globally exported

  // ✅ Update recurring panel button visibility if module is loaded
  if (window.recurringPanel?.updateRecurringPanelButtonVisibility) {
      window.recurringPanel.updateRecurringPanelButtonVisibility();
  }


// ✅ REMOVED: setupRecurringPanel - now handled by recurringPanel module
// ✅ REMOVED: setAdvancedVisibility - now handled by recurringPanel module
// ✅ REMOVED: updateRecurringPanel - now handled by recurringPanel module

// ✅ REMOVED: Old window.updateRecurringPanel assignment - now handled by recurringIntegration module
// ✅ REMOVED: Old window.openRecurringSettingsPanelForTask assignment - now handled by recurringIntegration module
  
// ✅ REMOVED: openRecurringSettingsPanelForTask - now handled by recurringPanel module



// ✅ REMOVED: updateRecurringSettingsVisibility - now handled by recurringPanel module
// ✅ REMOVED: toggle-check-all event listener - now handled by recurringPanel module
// ✅ REMOVED: loadRecurringSettingsForTask - now handled by recurringPanel module
// ✅ REMOVED: specific-date-specific-time event listener - now handled by recurringPanel module
// ✅ REMOVED: saveRecurringTemplate - unused function, template saving handled in handleApplySettings
// ✅ REMOVED: deleteRecurringTemplate - now handled by recurringCore module

// ✅ REMOVED: saveAlwaysShowRecurringSetting - now handled by recurringPanel module

// ✅ REMOVED: loadAlwaysShowRecurringSetting - now handled by recurringPanel module

// ✅ REMOVED: Old event listener for saveAlwaysShowRecurringSetting - now handled by recurringPanel module
document.getElementById("always-show-recurring")?.addEventListener("change", () => {
    if (window.recurringPanel?.saveAlwaysShowRecurringSetting) {
        window.recurringPanel.saveAlwaysShowRecurringSetting();
    }
});

// ✅ REMOVED: apply-recurring-settings event listener - now handled by recurringPanel module
// ✅ REMOVED: normalizeRecurringSettings - now handled by recurringCore module
// ✅ REMOVED: buildRecurringSettingsFromPanel - now handled by recurringPanel module
// ✅ REMOVED: clearNonRelevantRecurringFields - now handled by recurringCore module
// ✅ REMOVED: syncRecurringStateToDOM - now handled by recurringCore module
// ✅ REMOVED: cancel-recurring-settings event listener - now handled by recurringPanel module
// ✅ REMOVED: recur-indefinitely event listener - now handled by recurringPanel module
// ✅ REMOVED: setupBiweeklyDayToggle - now handled by recurringPanel module
// ✅ REMOVED: document click event listener for hiding preview - now handled by recurringPanel module

// ✅ REMOVED: setupMilitaryTimeToggle - now handled by recurringPanel module
// ✅ REMOVED: setupTimeConversion - now handled by recurringPanel module
// ✅ REMOVED: generateMonthlyDayGrid - now handled by recurringPanel module
// ✅ REMOVED: setupWeeklyDayToggle - now handled by recurringPanel module
// ✅ REMOVED: generateYearlyMonthGrid - now handled by recurringPanel module
// ✅ REMOVED: generateYearlyDayGrid - now handled by recurringPanel module
// ✅ REMOVED: handleYearlyApplyToAllChange - now handled by recurringPanel module
// ✅ REMOVED: getSelectedYearlyMonths - now handled by recurringPanel module
// ✅ REMOVED: getSelectedMonthlyDays - now handled by recurringPanel module
// ✅ REMOVED: setupSpecificDatesPanel - now handled by recurringPanel module
// ✅ REMOVED: getTomorrow - now handled by recurringPanel module
// ✅ REMOVED: updateRecurCountVisibility - now handled by recurringPanel module

// ✅ Helper function to build task context for existing tasks (AppState-based)
function buildTaskContext(taskItem, taskId) {
    try {
        // ✅ Use AppState instead of loadMiniCycleData
        if (!AppState.isReady()) {
            console.warn('⚠️ AppState not ready for buildTaskContext');
            return null;
        }

        const state = AppState.get();
        const activeCycleId = state.appState?.activeCycleId;
        
        if (!activeCycleId) return null;

        const currentCycle = state.data?.cycles?.[activeCycleId];
        if (!currentCycle) return null;

        const taskText = taskItem.querySelector('.task-text')?.textContent?.trim() || '';
        
        return {
            taskTextTrimmed: taskText,
            assignedTaskId: taskId,
            schemaData: state, // Pass the full state for backward compatibility
            cycles: state.data.cycles,
            activeCycle: activeCycleId,
            currentCycle,
            settings: state.settings || {},
            autoResetEnabled: currentCycle.autoReset || false,
            deleteCheckedEnabled: currentCycle.deleteCheckedTasks || false
        };
    } catch (error) {
        console.warn('⚠️ Failed to build task context:', error);
        return null;
    }
}



// ✅ REMOVED: updateRecurringButtonVisibility - now handled by recurringCore/recurringPanel modules

// ✅ REMOVED: isAlwaysShowRecurringEnabled - now handled by recurringCore/recurringPanel modules
  
// ✅ REMOVED: updateRecurringPanelButtonVisibility - now handled by recurringCore/recurringPanel modules
  
// ✅ REMOVED: updateRecurringSummary - now handled by recurringCore/recurringPanel modules

// ✅ REMOVED: parseDateAsLocal - now handled by recurringCore/recurringPanel modules

// ✅ REMOVED: attachRecurringSummaryListeners - now handled by recurringPanel module

// ✅ REMOVED: showTaskSummaryPreview - now handled by recurringCore/recurringPanel modules

// ✅ New function to populate form with existing settings
// ✅ REMOVED: populateRecurringFormWithSettings - now handled by recurringCore/recurringPanel modules

// ✅ New function to clear/reset the recurring form
// ✅ REMOVED: clearRecurringForm - now handled by recurringCore/recurringPanel modules
// ✅ REMOVED: createTaskSummaryPreview - now handled by recurringPanel module

// Before:
// ✅ REMOVED: getRecurringSummaryText - now handled by recurringCore/recurringPanel modules




// ✅ Shared utility: Build a recurring summary string from a settings object
// ✅ REMOVED: buildRecurringSummaryFromSettings - now handled by recurringPanel module

// ✅ REMOVED: removeRecurringTasksFromCycle - now handled by recurringCore/recurringPanel modules

// ✅ REMOVED: handleRecurringTasksAfterReset - now handled by recurringCore/recurringPanel modules


// ✅ REMOVED: convert12To24 - now handled by recurringCore/recurringPanel modules


// ✅ Main logic to determine if a task should recur today
// ✅ REMOVED: shouldTaskRecurNow - now handled by recurringCore/recurringPanel modules







// ✅ Helper: Check if a recurring task should be recreated
// ✅ REMOVED: shouldRecreateRecurringTask - now handled by recurringCore/recurringPanel modules

// ✅ REMOVED: watchRecurringTasks - now handled by recurringCore/recurringPanel modules

// ✅ REMOVED: setupRecurringWatcher - now handled by recurringCore/recurringPanel modules




/**
 * Setupsettingsmenu function.
 *
 * @returns {void}
 */
// ✅ REMOVED: setupFeedbackModal() - Now handled by modalManager module
// ✅ REMOVED: Duplicate feedback form sanitization listener - Now handled by modalManager module
// ✅ REMOVED: openFeedbackModal() - Now handled by modalManager module
// ✅ REMOVED: openFeedbackModal() call - Now handled automatically by modalManager module

/**
 * Setupusermanual function.
 *
 * @returns {void}
 */

function setupUserManual() {
    openUserManual.addEventListener("click", () => {
        hideMainMenu(); // Hide the menu when clicking

        // Disable button briefly to prevent multiple clicks
        openUserManual.disabled = true;

        // Redirect to the User Manual page after a short delay
        setTimeout(() => {
            window.location.href = "user-manual.html"; // ✅ Opens the manual page
            
            // Re-enable button after navigation (won't matter much since page changes)
            openUserManual.disabled = false;
        }, 200);
    });
}



// ✅ REMOVED: setupAbout() - Now handled by modalManager module

/**
 * Assigncyclevariables function.
 *
 * @returns {void}
 */

// ✅ AFTER (Schema 2.5 Only):
function assignCycleVariables() {
    console.log('🔄 Assigning cycle variables (state-based)...');
    
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

/**
 * Updateprogressbar function.
 *
 * @returns {void}
 */

function updateProgressBar() {
    const totalTasks = taskList.children.length;
    const completedTasks = [...taskList.children].filter(task => task.querySelector("input").checked).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    // ✅ Add consistent animation for all progress updates
    progressBar.style.transition = "width 0.2s ease-out";
    progressBar.style.width = `${progress}%`;
    
    // ✅ Clear transition after animation
    setTimeout(() => {
        progressBar.style.transition = "";
    }, 200);
    
    autoSave();
}
// ✅ Expose for cycleSwitcher module
window.updateProgressBar = updateProgressBar;


/**
 * Checkminicycle function.
 *
 * @returns {void}
 */

function checkMiniCycle() {
    // ✅ Early return if AppState not ready to prevent initialization race conditions
    if (!window.AppState?.isReady?.()) {
        console.log('⏳ checkMiniCycle deferred - AppState not ready');
        return;
    }
    
    const allCompleted = [...taskList.children].every(task => task.querySelector("input").checked);

    // ✅ Retrieve miniCycle variables
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
    let cycleData = savedMiniCycles[lastUsedMiniCycle];

    if (!lastUsedMiniCycle || !cycleData) {
        console.warn("⚠ No active miniCycle found.");
        return;
    }

     updateProgressBar();

    // ✅ Only trigger reset if ALL tasks are completed AND autoReset is enabled
    if (allCompleted && taskList.children.length > 0) {
        console.log(`✅ All tasks completed for "${lastUsedMiniCycle}"`);

        // ✅ Auto-reset: Only reset if AutoReset is enabled
        if (cycleData.autoReset) {
            console.log(`🔄 AutoReset is ON. Resetting tasks for "${lastUsedMiniCycle}"...`);
            setTimeout(() => {
                resetTasks(); // ✅ Then reset tasks
            }, 1000);
            return;
        }
    }
    console.log("ran check MiniCyle function");
    updateProgressBar();
    updateStatsPanel();
    // ✅ REMOVED: autoSave() here - task completion now saves directly via AppState.update()
    // This prevents duplicate saves and potential race conditions
    console.log("ran check MiniCyle function2");
}

// ✅ Export checkMiniCycle globally for taskDOM module
window.checkMiniCycle = checkMiniCycle;

/**
 * Incrementcyclecount function.
 *
 * @param {any} miniCycleName - Description.
 * @param {any} savedMiniCycles - Description. * @returns {void}
 */

function incrementCycleCount(miniCycleName, savedMiniCycles) {
    console.log('🔢 Incrementing cycle count (Schema 2.5 state-based)...');
    
    // ✅ Use state module instead of legacy direct data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for incrementCycleCount');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for incrementCycleCount');
        return;
    }
    
    const { data, appState } = currentState;
    const activeCycle = appState.activeCycleId;
    const cycleData = data.cycles[activeCycle];
    
    if (!activeCycle || !cycleData) {
        console.error('❌ No active cycle found for incrementCycleCount');
        return;
    }
    
    console.log('📊 Current cycle count:', cycleData.cycleCount || 0);
    
    // ✅ Update through state module and get the actual new count
    let actualNewCount;
    window.AppState.update(state => {
        const cycle = state.data.cycles[activeCycle];
        if (cycle) {
            cycle.cycleCount = (cycle.cycleCount || 0) + 1;
            actualNewCount = cycle.cycleCount; // ✅ Get the actual updated count
            
            // Update user progress
            state.userProgress.cyclesCompleted = (state.userProgress.cyclesCompleted || 0) + 1;
        }
    }, true); // immediate save
    
    console.log(`✅ Cycle count updated (state-based) for "${activeCycle}": ${actualNewCount}`);
    
    // ✅ Handle milestone rewards with the actual updated count
    handleMilestoneUnlocks(activeCycle, actualNewCount);
    
    // ✅ Show animation + update stats
    showCompletionAnimation();
    updateStatsPanel();
}

// Export to window for taskCore module
window.incrementCycleCount = incrementCycleCount;

function handleMilestoneUnlocks(miniCycleName, cycleCount) {
    console.log('🏆 Handling milestone unlocks (state-based)...');
    
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for milestone unlocks');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data for milestone unlocks');
        return;
    }
    
    // ✅ Show milestone achievement message
    checkForMilestone(miniCycleName, cycleCount);

    // ✅ Theme unlocks with state-based tracking
    if (cycleCount >= 5) {
        unlockDarkOceanTheme();
    }
    if (cycleCount >= 50) {
        unlockGoldenGlowTheme();
    }

    // ✅ Game unlock with state-based tracking
    if (cycleCount >= 100) {
        const unlockedFeatures = currentState.settings?.unlockedFeatures || [];
        const hasGameUnlock = unlockedFeatures.includes("task-order-game");
        
        if (!hasGameUnlock) {
            showNotification("🎮 Game Unlocked! 'Task Order' is now available in the Games menu.", "success", 6000);
            unlockMiniGame();
        }
    }
    
    console.log('✅ Milestone unlocks processed (state-based)');
}



// ✅ Rebuild toggles based on unlocked themes (Schema 2.5 only)

// ✅ Close Themes Modal when clicking outside of the modal content

/**
 * Showcompletionanimation function.
 *
 * @returns {void}
 */

function showCompletionAnimation() {
    const animation = document.createElement("div");
    animation.classList.add("mini-cycle-complete-animation");
  //  animation.innerHTML = "✅ miniCycle Completed!";
  animation.innerHTML = "✔";

    document.body.appendChild(animation);

    // ✅ Remove the animation after 1.5 seconds
    setTimeout(() => {
        animation.remove();
    }, 1500);
}

// Export to window for taskCore module
window.showCompletionAnimation = showCompletionAnimation;

/**
 * Checkformilestone function.
 *
 * @param {any} miniCycleName - Description.
 * @param {any} cycleCount - Description. * @returns {void}
 */

function checkForMilestone(miniCycleName, cycleCount) {
    const milestoneLevels = [10, 25, 50, 100, 200, 500, 1000];

    if (milestoneLevels.includes(cycleCount)) {
        showMilestoneMessage(miniCycleName, cycleCount);
    }
}

/**
 * Displays a milestone achievement message when a user reaches a specific cycle count.
 *
 * @param {string} miniCycleName - The name of the miniCycle.
 * @param {number} cycleCount - The number of cycles completed.
 */

function showMilestoneMessage(miniCycleName, cycleCount) {
    const message = `🎉 You've completed ${cycleCount} cycles for "${miniCycleName}"! Keep going! 🚀`;

    // ✅ Create a notification-like popup
    const milestonePopup = document.createElement("div");
    milestonePopup.classList.add("mini-cycle-milestone");
    milestonePopup.textContent = message;

    document.body.appendChild(milestonePopup);

    // ✅ Automatically remove the message after 3 seconds
    setTimeout(() => {
        milestonePopup.remove();
    }, 3000);
}

    /***********************
 *
 *
 * Rearrange Management Logic - MOVED TO MODULE
 * See: utilities/task/dragDropManager.js
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


    
// ✅ Main addTask function - now acts as orchestrator
function addTask(taskText, completed = false, shouldSave = true, dueDate = null, highPriority = null, isLoading = false, remindersEnabled = false, recurring = false, taskId = null, recurringSettings = {}) {
    // ✅ Use NEW taskDOM module functions via window.* (not old inline functions)

    // Input validation and sanitization
    const validatedInput = window.validateAndSanitizeTaskInput?.(taskText) || validateAndSanitizeTaskInput(taskText);
    if (!validatedInput) return;

    // Load and validate data context
    const taskContext = window.loadTaskContext?.(validatedInput, taskId, {
        completed, dueDate, highPriority, remindersEnabled, recurring, recurringSettings
    }, isLoading) || loadTaskContext(validatedInput, taskId, {
        completed, dueDate, highPriority, remindersEnabled, recurring, recurringSettings
    }, isLoading);
    if (!taskContext) return;

    // Create or update task data
    const taskData = window.createOrUpdateTaskData?.(taskContext) || createOrUpdateTaskData(taskContext);

    // Create DOM elements
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
    
    const taskTextTrimmed = sanitizeInput(taskText.trim());
    if (!taskTextTrimmed) {
        console.warn("⚠ Skipping empty or unsafe task.");
        return null;
    }
    
    if (taskTextTrimmed.length > TASK_LIMIT) {
        showNotification(`Task must be ${TASK_LIMIT} characters or less.`);
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
        currentCycle, cycles, activeCycle, isLoading
    } = taskContext;

    let existingTask = cycleTasks.find(task => task.id === assignedTaskId);

    if (!existingTask) {
        console.log('📋 Creating new task in Schema 2.5');

        existingTask = {
            id: assignedTaskId,
            text: taskTextTrimmed,
            completed,
            dueDate,
            highPriority,
            remindersEnabled,
            recurring,
            recurringSettings,
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
                lastTriggeredTimestamp: null,
                schemaVersion: 2
            };
        }

        // ✅ FIX: Only save to AppState if NOT loading from saved data
        if (!isLoading) {
            // Save to Schema 2.5
            saveTaskToSchema25(activeCycle, currentCycle);
            console.log('💾 Task saved to Schema 2.5');
        } else {
            console.log('⏭️ Skipping save during load (isLoading=true)');
        }
    }

    return existingTask;
}

// ✅ Export for taskCore module
window.createOrUpdateTaskData = createOrUpdateTaskData;

// ✅ 4. Recurring Template Creation (extracted from task data creation)
// ✅ REMOVED: createRecurringTemplate - now handled by recurringCore/recurringPanel modules

// ✅ 5. DOM Elements Creation
function createTaskDOMElements(taskContext, taskData) {
    const {
        assignedTaskId, taskTextTrimmed, highPriority, recurring,
        recurringSettings, settings, autoResetEnabled, currentCycle
    } = taskContext;

    // Get required DOM elements
    const taskList = document.getElementById("taskList");
    const taskInput = document.getElementById("taskInput");

    // Create main task element
    const taskItem = createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle);
    
    // Create three dots button if needed
    const threeDotsButton = createThreeDotsButton(taskItem, settings);
    
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

// ✅ Export for taskCore module
// ❌ DISABLED: Old export - now provided by taskDOM module
// window.createTaskDOMElements = createTaskDOMElements;

// ✅ 6. Main Task Element Creation
function createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle) {
    const taskItem = document.createElement("li");
    taskItem.classList.add("task");
    taskItem.setAttribute("draggable", "true");
    taskItem.dataset.taskId = assignedTaskId;

    if (highPriority) {
        taskItem.classList.add("high-priority");
    }

    // ✅ Check if task has a recurring template (source of truth for recurring state)
    const hasRecurringTemplate = currentCycle?.recurringTemplates?.[assignedTaskId];
    const hasValidRecurringSettings = recurringSettings && Object.keys(recurringSettings).length > 0;

    // Task is recurring if: has template OR (recurring flag is true AND has settings)
    const isRecurring = hasRecurringTemplate || (recurring && hasValidRecurringSettings);

    if (isRecurring) {
        taskItem.classList.add("recurring");
        // Use settings from template if available, otherwise use task's settings
        const settingsToUse = hasRecurringTemplate
            ? currentCycle.recurringTemplates[assignedTaskId].recurringSettings
            : recurringSettings;
        taskItem.setAttribute("data-recurring-settings", JSON.stringify(settingsToUse));
    }

    return taskItem;
}

// ✅ 7. Three Dots Button Creation
function createThreeDotsButton(taskItem, settings) {
    const showThreeDots = settings.showThreeDots || false;
    
    if (showThreeDots) {
        const threeDotsButton = document.createElement("button");
        threeDotsButton.classList.add("three-dots-btn");
        threeDotsButton.innerHTML = "⋮";
        threeDotsButton.addEventListener("click", (event) => {
            event.stopPropagation();
            revealTaskButtons(taskItem);
        });
        taskItem.appendChild(threeDotsButton);
        return threeDotsButton;
    }
    
    return null;
}

// ✅ 8. Task Button Container Creation
function createTaskButtonContainer(taskContext) {
    const { 
        autoResetEnabled, deleteCheckedEnabled, settings, 
        remindersEnabled, remindersEnabledGlobal, assignedTaskId, 
        currentCycle, recurring, highPriority
    } = taskContext;

    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("task-options");

    const showRecurring = !autoResetEnabled && deleteCheckedEnabled;

    const buttons = [
        { class: "move-up", icon: "▲", show: true },
        { class: "move-down", icon: "▼", show: true },
        { class: "recurring-btn", icon: "<i class='fas fa-repeat'></i>", show: showRecurring || (settings.alwaysShowRecurring || false) },
        { class: "set-due-date", icon: "<i class='fas fa-calendar-alt'></i>", show: !autoResetEnabled },
        { class: "enable-task-reminders", icon: "<i class='fas fa-bell'></i>", show: remindersEnabled || remindersEnabledGlobal, toggle: true },
        { class: "priority-btn", icon: "<i class='fas fa-exclamation-triangle'></i>", show: true },
        { class: "edit-btn", icon: "<i class='fas fa-edit'></i>", show: true },
        { class: "delete-btn", icon: "<i class='fas fa-trash'></i>", show: true }
    ];

    buttons.forEach(buttonConfig => {
        const button = createTaskButton(buttonConfig, taskContext, buttonContainer);
        buttonContainer.appendChild(button);
    });

    return buttonContainer;
}

// ✅ Export for modules that need to recreate button containers (e.g., modeManager)
window.createTaskButtonContainer = createTaskButtonContainer;

// ✅ 9. Individual Task Button Creation
function createTaskButton(buttonConfig, taskContext, buttonContainer) {
    const { class: btnClass, icon, toggle = false, show } = buttonConfig;
    const { assignedTaskId, currentCycle, settings, remindersEnabled, recurring, highPriority } = taskContext;

    const button = document.createElement("button");
    button.classList.add("task-btn", btnClass);
    button.innerHTML = icon;
    button.setAttribute("type", "button");
    if (!show) button.classList.add("hidden");

    // Setup accessibility attributes
    setupButtonAccessibility(button, btnClass, buttonContainer);

    // Setup ARIA states
    setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority, assignedTaskId, currentCycle);
    
    // Setup button event handlers
    setupButtonEventHandlers(button, btnClass, taskContext);

    return button;
}

// ✅ 10. Button Accessibility Setup
function setupButtonAccessibility(button, btnClass, buttonContainer) {
    button.setAttribute("tabindex", "0");
    
    // Keyboard navigation
    button.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            button.click();
        }

        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            const focusable = Array.from(buttonContainer.querySelectorAll("button.task-btn"));
            const currentIndex = focusable.indexOf(e.target);
            const nextIndex = e.key === "ArrowRight"
                ? (currentIndex + 1) % focusable.length
                : (currentIndex - 1 + focusable.length) % focusable.length;
            focusable[nextIndex].focus();
            e.preventDefault();
        }
    });

    // ARIA labels
    const ariaLabels = {
        "move-up": "Move task up",
        "move-down": "Move task down",
        "recurring-btn": "Toggle recurring task",
        "set-due-date": "Set due date",
        "enable-task-reminders": "Toggle reminders for this task",
        "priority-btn": "Mark task as high priority",
        "edit-btn": "Edit task",
        "delete-btn": "Delete task"
    };
    button.setAttribute("aria-label", ariaLabels[btnClass] || "Task action");
}

// ✅ 11. Button ARIA States Setup
function setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority, assignedTaskId, currentCycle) {
    if (btnClass === "enable-task-reminders") {
        const isActive = remindersEnabled === true;
        button.classList.toggle("reminder-active", isActive);
        button.setAttribute("aria-pressed", isActive.toString());
    } else if (["recurring-btn", "priority-btn"].includes(btnClass)) {
        let isActive;

        if (btnClass === "recurring-btn") {
            // ✅ Check if task has a recurring template (source of truth)
            const hasRecurringTemplate = currentCycle?.recurringTemplates?.[assignedTaskId];
            isActive = hasRecurringTemplate || !!recurring;

            // ✅ Debug log for recurring button
            console.log('🔘 Setting up recurring button:', {
                taskId: assignedTaskId,
                recurring,
                hasRecurringTemplate: !!hasRecurringTemplate,
                isActive,
                hasActiveClass: button.classList.contains('active')
            });
        } else {
            isActive = !!highPriority;
        }

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive.toString());
    }
}

// ✅ 12. Button Event Handlers Setup
function setupButtonEventHandlers(button, btnClass, taskContext) {
    if (btnClass === "recurring-btn") {
        // ✅ Setup recurring button handler
        setupRecurringButtonHandler(button, taskContext);
    } else if (btnClass === "enable-task-reminders") {
        // ✅ Use window.setupReminderButtonHandler from reminders module
        // Safe to call directly - Phase 2 guarantees module is loaded before task creation
        if (typeof window.setupReminderButtonHandler === 'function') {
            window.setupReminderButtonHandler(button, taskContext);
        } else {
            console.error('❌ setupReminderButtonHandler not available - reminders module failed to load');
        }
    } else if (btnClass === "move-up" || btnClass === "move-down") {
        // ✅ Skip attaching old handlers to move buttons - using event delegation
        console.log(`🔄 Skipping old handler for ${btnClass} - using event delegation`);
    } else {
        button.addEventListener("click", handleTaskButtonClick);
    }
}

// ✅ Recurring button handler (uses module functions)
function setupRecurringButtonHandler(button, taskContext) {
    const { assignedTaskId, currentCycle, activeCycle } = taskContext;

    // ✅ Mark that handler is attached to prevent double-attachment
    button.dataset.handlerAttached = 'true';

    button.addEventListener("click", () => {
        // ✅ Read fresh state from AppState to avoid stale closure data
        const currentState = window.AppState?.get();
        if (!currentState) {
            console.error('❌ AppState not available for recurring toggle');
            return;
        }

        const activeCycleId = currentState.appState?.activeCycleId;
        const freshCycle = currentState.data?.cycles?.[activeCycleId];

        if (!freshCycle) {
            console.error('❌ Active cycle not found in AppState');
            return;
        }

        const task = freshCycle.tasks.find(t => t.id === assignedTaskId);
        if (!task) {
            console.warn('⚠️ Task not found:', assignedTaskId);
            return;
        }

        const alwaysShowRecurring = currentState?.settings?.alwaysShowRecurring || false;

        const showRecurring = !taskContext.autoResetEnabled && taskContext.deleteCheckedEnabled;
        if (!(showRecurring || alwaysShowRecurring)) {
            console.log('🚫 Recurring button click ignored - not in correct mode and always-show not enabled');
            return;
        }

        // ✅ Check template existence as source of truth (not task.recurring flag)
        const hasRecurringTemplate = freshCycle?.recurringTemplates?.[assignedTaskId];
        const isCurrentlyRecurring = !!hasRecurringTemplate;
        const isNowRecurring = !isCurrentlyRecurring;

        console.log('🔄 Toggling recurring state:', {
            taskId: assignedTaskId,
            wasRecurring: isCurrentlyRecurring,
            willBeRecurring: isNowRecurring,
            hadTemplate: !!hasRecurringTemplate
        });

        task.recurring = isNowRecurring;

        button.classList.toggle("active", isNowRecurring);
        button.setAttribute("aria-pressed", isNowRecurring.toString());

        // ✅ Add or remove recurring icon from task label
        const taskItem = button.closest('.task');
        if (taskItem) {
            const taskLabel = taskItem.querySelector('.task-text'); // ✅ Fixed: use .task-text not .task-label
            if (taskLabel) {
                let existingIcon = taskLabel.querySelector('.recurring-indicator');

                if (isNowRecurring && !existingIcon) {
                    // Add icon
                    const icon = document.createElement("span");
                    icon.className = "recurring-indicator";
                    icon.innerHTML = `<i class="fas fa-sync-alt"></i>`;
                    taskLabel.appendChild(icon);
                    console.log('✅ Added recurring icon to task:', assignedTaskId);
                } else if (!isNowRecurring && existingIcon) {
                    // Remove icon
                    existingIcon.remove();
                    console.log('✅ Removed recurring icon from task:', assignedTaskId);
                }
            }
        }

        // ✅ Create fresh taskContext with current settings from AppState
        const freshTaskContext = {
            ...taskContext,
            settings: currentState?.settings || {}
        };

        if (isNowRecurring) {
            // ✅ Use global function from module with fresh context
            if (window.handleRecurringTaskActivation) {
                window.handleRecurringTaskActivation(task, freshTaskContext, button);
            }
        } else {
            // ✅ Use global function from module with fresh context
            if (window.handleRecurringTaskDeactivation) {
                window.handleRecurringTaskDeactivation(task, freshTaskContext, assignedTaskId);
            }
        }

        // ✅ Don't call saveTaskToSchema25 here - recurring modules handle AppState directly
        // This was causing the issue where multiple recurring tasks only showed one in the panel

        // ✅ Update panel visibility (use correct method names)
        if (window.recurringPanel?.updateRecurringPanelButtonVisibility) {
            window.recurringPanel.updateRecurringPanelButtonVisibility();
        }

        // ✅ Update recurring panel (use correct method name)
        if (window.recurringPanel?.updateRecurringPanel) {
            window.recurringPanel.updateRecurringPanel();
        }
    });
}

// ✅ 13. Recurring Button Handler (extracted from main function)
// ✅ REMOVED: setupRecurringButtonHandler - now handled by recurringCore/recurringPanel modules

// ✅ 13b. Recurring Helper Functions (global utilities)
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

// ✅ 14. Recurring Task Activation Handler
// ✅ REMOVED: handleRecurringTaskActivation - now handled by recurringCore/recurringPanel modules

// ✅ 15. Recurring Task Deactivation Handler
// ✅ REMOVED: handleRecurringTaskDeactivation - now handled by recurringCore/recurringPanel modules

// ✅ REMOVED: setupReminderButtonHandler - Now in utilities/reminders.js
// Use window.setupReminderButtonHandler() which is globally exported from the module

// ✅ 17. Task Content Elements Creation
function createTaskContentElements(taskContext) {
    const {
        assignedTaskId, taskTextTrimmed, completed, dueDate,
        autoResetEnabled, recurring, currentCycle, activeCycle
    } = taskContext;

    // ✅ Use NEW taskDOM module functions via window.* (with fallbacks)
    const checkbox = window.createTaskCheckbox?.(assignedTaskId, taskTextTrimmed, completed)
        || createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed);

    const taskLabel = window.createTaskLabel?.(taskTextTrimmed, assignedTaskId, recurring)
        || createTaskLabel(taskTextTrimmed, assignedTaskId, recurring);

    // Create due date input (from dueDates.js/taskCore, not taskDOM)
    const dueDateInput = createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle);

    return { checkbox, taskLabel, dueDateInput };
}

// ✅ 18. Task Checkbox Creation
function createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("id", `checkbox-${assignedTaskId}`);
    checkbox.setAttribute("name", `task-complete-${assignedTaskId}`);
    checkbox.checked = completed;
    checkbox.setAttribute("aria-label", `Mark task "${taskTextTrimmed}" as complete`);
    checkbox.setAttribute("role", "checkbox");
    checkbox.setAttribute("aria-checked", checkbox.checked);
    
    safeAddEventListener(checkbox, "change", () => {
        // ✅ Enable undo system on first user interaction
        enableUndoSystemOnFirstInteraction();

        handleTaskCompletionChange(checkbox);
        checkMiniCycle();
        autoSave(null, true);  // ✅ FIX: Force immediate save on task completion
        triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);

        // ✅ Update undo/redo button states
        updateUndoRedoButtons();

        console.log("✅ Task completion toggled — undo snapshot pushed.");
    });
    
    safeAddEventListener(checkbox, "keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
        }
    });

    return checkbox;
}

// ✅ 19. Task Label Creation
function createTaskLabel(taskTextTrimmed, assignedTaskId, recurring) {
    const taskLabel = document.createElement("span");
    taskLabel.classList.add("task-text");
    taskLabel.textContent = taskTextTrimmed;
    taskLabel.setAttribute("tabindex", "0");
    taskLabel.setAttribute("role", "text");
    taskLabel.id = `task-desc-${assignedTaskId}`;
    
    // Add recurring icon if needed
    if (recurring) {
        const icon = document.createElement("span");
        icon.className = "recurring-indicator";
        icon.innerHTML = `<i class="fas fa-sync-alt"></i>`;
        taskLabel.appendChild(icon);
    }

    return taskLabel;
}

// ✅ 20. Due Date Input Creation

// ✅ 21. Task Interactions Setup
// ❌ REMOVED: setupTaskInteractions - now in utilities/task/taskEvents.js
// ❌ REMOVED: setupTaskClickInteraction - now in utilities/task/taskEvents.js
// ❌ REMOVED: setupPriorityButtonState - now in utilities/task/taskEvents.js
// ❌ REMOVED: setupTaskHoverInteractions - now in utilities/task/taskEvents.js
//
// These functions were extracted during taskDOM modularization.
// They are now provided by taskDOM.js which delegates to taskEvents.js.
// Access them via:
//   window.setupTaskInteractions() - exported by taskDOM.js
//   window.setupTaskClickInteraction() - exported by taskDOM.js
//   etc.

// ❌ REMOVED: setupTaskFocusInteractions - now in utilities/task/taskEvents.js

// ✅ 26. Due Date Button Interaction Setup

// ❌ REMOVED: finalizeTaskCreation - now in utilities/task/taskDOM.js
// ❌ REMOVED: scrollToNewTask - now in utilities/task/taskUtils.js
// ❌ REMOVED: handleOverdueStyling - now in utilities/task/taskUtils.js
// ❌ REMOVED: updateUIAfterTaskCreation - now in utilities/task/taskDOM.js
//
// These functions were extracted during taskDOM modularization.
// Access them via window.* exports from the respective modules.

// ✅ 28-31. Task Finalization and UI Updates (moved to modules)
// ❌ REMOVED: setupFinalTaskInteractions - now in utilities/task/taskUtils.js

// ✅ 32. Schema 2.5 Save Helper
function saveTaskToSchema25(activeCycle, currentCycle) {
    // Use AppState if available, otherwise fallback to localStorage
    if (window.AppState && window.AppState.isReady()) {
        try {
            window.AppState.update(state => {
                if (state && state.data && state.data.cycles) {
                    state.data.cycles[activeCycle] = currentCycle;
                    state.metadata.lastModified = Date.now();
                }
            });
            return;
        } catch (error) {
            // Fall through to localStorage fallback
        }
    }
    
    // Fallback to localStorage if AppState not ready or failed
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = currentCycle;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
}

// Ensure the real function is exposed via alias and flush queued calls
(function finalizeAddTaskBootstrap() {
  try {
    if (typeof addTask === 'function') {
      window.addTaskFunction = addTask; // primary programmatic entry
      // Keep legacy global only if it’s not a DOM element
      if (typeof window.addTask !== 'function') {
        window.addTask = addTask;
      }
      if (Array.isArray(window.__queuedAddTaskCalls) && window.__queuedAddTaskCalls.length) {
        console.log(`🚚 Flushing ${window.__queuedAddTaskCalls.length} queued addTask calls`);
        window.__queuedAddTaskCalls.splice(0).forEach(args => {
          try { addTask(...args); } catch (e) { console.warn('addTask flush error:', e); }
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



function toggleHoverTaskOptions(enableHover) {
  document.querySelectorAll(".task").forEach(taskItem => {
    if (enableHover) {
      if (!taskItem.classList.contains("hover-enabled")) {
        taskItem.addEventListener("mouseenter", showTaskOptions);
        taskItem.addEventListener("mouseleave", hideTaskOptions);
        taskItem.classList.add("hover-enabled");
      }
    } else {
      if (taskItem.classList.contains("hover-enabled")) {
        taskItem.removeEventListener("mouseenter", showTaskOptions);
        taskItem.removeEventListener("mouseleave", hideTaskOptions);
        taskItem.classList.remove("hover-enabled");
      }
    }
  });
}

// Export for module use
window.toggleHoverTaskOptions = toggleHoverTaskOptions;



document.addEventListener("click", (e) => {
  const target = e.target.closest(".open-recurring-settings");
  if (!target) return;

  const taskId = target.dataset.taskId;
  if (!taskId) return;

  // 🎯 Use your centralized panel-opening logic
  openRecurringSettingsPanelForTask(taskId);
});

/**
 * ✅ Sanitize user input to prevent XSS attacks or malformed content.
 * @param {string} input - The user input to be sanitized.
 * @returns {string} - Cleaned and safe string, trimmed and limited in length.
 */
function sanitizeInput(input) {
    if (typeof input !== "string") return "";
    const temp = document.createElement("div");
    temp.textContent = input; // Set as raw text (sanitized)
    return temp.textContent.trim().substring(0, TASK_LIMIT); // <-- use textContent here too
  }
// ✅ Expose for cycleSwitcher module
window.sanitizeInput = sanitizeInput;

    /**
 * ⌨️ Accessibility Helper: Toggles visibility of task buttons when task item is focused or blurred.
 * 
 * When navigating with the keyboard (e.g., using Tab), this ensures that the task option buttons
 * (edit, delete, reminders, etc.) are shown while the task is focused and hidden when it loses focus.
 * 
 * This provides a keyboard-accessible experience similar to mouse hover.
 *
 * @param {HTMLElement} taskItem - The task <li> element to attach listeners to.
 */
    function attachKeyboardTaskOptionToggle(taskItem) {
      /**
       * ⌨️ Show task buttons only when focus is inside a real action element.
       * Prevent buttons from appearing when clicking the checkbox or task text.
       */
      safeAddEventListener(taskItem, "focusin", (e) => {
        const target = e.target;
    
        // ✅ Skip if focusing on safe elements that shouldn't trigger button reveal
        if (
          target.classList.contains("task-text") ||
          target.type === "checkbox" ||
          target.closest(".focus-safe")
        ) {
          return;
        }
    
        const options = taskItem.querySelector(".task-options");
        if (options) {
          options.style.opacity = "1";
          options.style.visibility = "visible";
          options.style.pointerEvents = "auto";
        }
      });
    
      /**
       * ⌨️ Hide task buttons when focus moves outside the entire task
       */
      safeAddEventListener(taskItem, "focusout", (e) => {
        if (taskItem.contains(e.relatedTarget)) return;

        const options = taskItem.querySelector(".task-options");
        if (options) {
          options.style.opacity = "0";
          options.style.visibility = "hidden";
          options.style.pointerEvents = "none";
        }
      });
    }

    // ✅ Export for taskDOM module
    window.attachKeyboardTaskOptionToggle = attachKeyboardTaskOptionToggle;


    // ✅ REMOVED: updateReminderButtons() - Now in utilities/reminders.js
    // Use window.updateReminderButtons() which is globally exported from the module




    /**
 * Showtaskoptions function.
 *
 * @param {any} event - Description. * @returns {void}
 */

// ✅ REMOVED: revealTaskButtons - now provided by taskDOM module
// Old function disabled - NEW version in utilities/task/taskDOM.js
// window.revealTaskButtons is exported from taskDOM module

/* OLD CODE - DISABLED
function revealTaskButtons(taskItem) {
  const taskOptions = taskItem.querySelector(".task-options");
  if (!taskOptions) return;

  // 🧹 Hide all other task option menus
  document.querySelectorAll(".task-options").forEach(opts => {
    if (opts !== taskOptions) {
      opts.style.visibility = "hidden";
      opts.style.opacity = "0";
      opts.style.pointerEvents = "none";

      // Optional: hide all child buttons too
      opts.querySelectorAll(".task-btn").forEach(btn => {
        btn.style.visibility = "hidden";
        btn.style.opacity = "0";
        btn.style.pointerEvents = "none";
      });
    }
  });

  // ✅ Show this task's options
  taskOptions.style.visibility = "visible";
  taskOptions.style.opacity = "1";
  taskOptions.style.pointerEvents = "auto";

  const reminderSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
  const remindersEnabledGlobal = reminderSettings.enabled === true;
  const autoResetEnabled = toggleAutoReset.checked;

  // ✅ Early return if AppState not ready to prevent initialization race conditions
  if (!window.AppState?.isReady?.()) {
    console.log('⏳ revealTaskButtons deferred - AppState not ready');
    return;
  }

  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycleData = savedMiniCycles?.[lastUsedMiniCycle] ?? {};
  const deleteCheckedEnabled = cycleData.deleteCheckedTasks;

  const alwaysShow = AppState.isReady() ?
    AppState.get()?.settings?.alwaysShowRecurring === true :
    JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring")) === true;
  const showRecurring = alwaysShow || (!autoResetEnabled && deleteCheckedEnabled);

  taskOptions.querySelectorAll(".task-btn").forEach(btn => {
    const isReminderBtn = btn.classList.contains("enable-task-reminders");
    const isRecurringBtn = btn.classList.contains("recurring-btn");
    const isDueDateBtn = btn.classList.contains("set-due-date");

    const shouldShow =
      !btn.classList.contains("hidden") ||
      (isReminderBtn && remindersEnabledGlobal) ||
      (isRecurringBtn && showRecurring) ||
      (isDueDateBtn && !autoResetEnabled);

    if (shouldShow) {
      btn.classList.remove("hidden");
      btn.style.visibility = "visible";
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  });

  updateMoveArrowsVisibility();
}
*/

    function hideTaskButtons(taskItem) {

      if (taskItem.classList.contains("rearranging")) {
        console.log("⏳ Skipping hide during task rearrangement");
        return;
      }
        const taskOptions = taskItem.querySelector(".task-options");
        if (!taskOptions) return;
    
        taskOptions.style.visibility = "hidden";
        taskOptions.style.opacity = "0";
        taskOptions.style.pointerEvents = "none";
    
        taskItem.querySelectorAll(".task-btn").forEach(btn => {
            btn.style.visibility = "hidden";
            btn.style.opacity = "0";
            btn.style.pointerEvents = "none";
        });
    
        // Keep layout and interactivity clean
        updateMoveArrowsVisibility();
    }




    function showTaskOptions(event) {
        const taskElement = event.currentTarget;

        // ✅ Only allow on desktop or if long-pressed on mobile
        const isMobile = isTouchDevice();
        const allowShow = !isMobile || taskElement.classList.contains("long-pressed");

        if (allowShow) {
            // ✅ Use NEW taskDOM module function if available
            if (typeof window.revealTaskButtons === 'function') {
                window.revealTaskButtons(taskElement);
            }
        }
    }

    // ✅ Export for taskDOM module
    window.showTaskOptions = showTaskOptions;

    function hideTaskOptions(event) {
        const taskElement = event.currentTarget;

        // ✅ Only hide if not long-pressed on mobile (so buttons stay open during drag)
        const isMobile = isTouchDevice();
        const allowHide = !isMobile || !taskElement.classList.contains("long-pressed");

        if (allowHide) {
            hideTaskButtons(taskElement);
        }
    }

    // ✅ Export for taskDOM module
    window.hideTaskOptions = hideTaskOptions;
    
    
// ✅ REMOVED: handleTaskCompletionChange - now in utilities/task/taskCore.js

    /**
 * Istouchdevice function.
 *
 * @returns {void}
 */

function isTouchDevice() {
        let hasTouchEvents = "ontouchstart" in window;
        let touchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints;
        let isFinePointer = window.matchMedia("(pointer: fine)").matches;

        console.log(`touch detected: hasTouchEvents=${hasTouchEvents}, maxTouchPoints=${touchPoints}, isFinePointer=${isFinePointer}`);

        if (isFinePointer) return false;


        return hasTouchEvents || touchPoints > 0;
    }

    // ✅ Export for taskDOM module and device detection
    window.isTouchDevice = isTouchDevice;


/**
 * Handles button clicks for task-related actions, such as moving, editing, deleting, or changing priority.
 *
 * @param {Event} event - The event triggered by clicking a task button.
 */

function handleTaskButtonClick(event) {
    event.stopPropagation();
    const button = event.currentTarget;
    const taskItem = button.closest(".task");
    if (!taskItem) return;

    const taskOptions = taskItem.querySelector(".task-options");
    if (taskOptions) taskOptions.style.pointerEvents = "auto";

    let shouldSave = false;

    // ✅ DISABLED: Old arrow handling logic - now using event delegation
    if (button.classList.contains("move-up") || button.classList.contains("move-down")) {
        console.log('⚠️ Arrow click handled by legacy handler - should use event delegation instead');
        return; // Let the new event delegation handle this
    } else if (button.classList.contains("edit-btn")) {
        // ✅ Use taskCore module for editing
        if (window.taskCore) {
            window.taskCore.editTask(taskItem);
        } else {
            console.warn('⚠️ TaskCore not available, edit operation skipped');
            showNotification?.('Edit feature temporarily unavailable', 'warning');
        }
        shouldSave = false;
    } else if (button.classList.contains("delete-btn")) {
        // ✅ Use taskCore module for deletion
        if (window.taskCore) {
            window.taskCore.deleteTask(taskItem);
            // Note: deleteTask handles arrow visibility internally via updateProgressBar callback
        } else {
            console.warn('⚠️ TaskCore not available, delete operation skipped');
            showNotification?.('Delete feature temporarily unavailable', 'warning');
        }
        shouldSave = false;
    } else if (button.classList.contains("priority-btn")) {
        // ✅ Use taskCore module for priority toggle
        if (window.taskCore) {
            window.taskCore.toggleTaskPriority(taskItem);
        } else {
            console.warn('⚠️ TaskCore not available, priority toggle skipped');
            showNotification?.('Priority toggle feature temporarily unavailable', 'warning');
        }
        shouldSave = false;
    }

    if (shouldSave) autoSave();
    console.log("✅ Task button clicked:", button.className);
}

// ✅ REMOVED: saveCurrentTaskOrder - now in utilities/task/taskCore.js
































// ✅ REMOVED: resetTasks - now in utilities/task/taskCore.js


          // ✅ Remove the old cycle message display logic
          // cycleMessage.style.visibility = "visible";
          // cycleMessage.style.opacity = "1";
          // setTimeout(() => {
          //     cycleMessage.style.opacity = "0";
          //     cycleMessage.style.visibility = "hidden";
          //     isResetting = false;
          // }, 2000);

/**
 * Checkcompleteallbutton function.
 *
 * @returns {void}
 */

function checkCompleteAllButton() {
    const isAutoMode = document.body.classList.contains('auto-cycle-mode');

    if (taskList.children.length > 0 && !isAutoMode) {
        completeAllButton.style.display = "block";
    } else {
        completeAllButton.style.display = "none";
    }
}
// ✅ Expose for cycleSwitcher module
window.checkCompleteAllButton = checkCompleteAllButton;

/**
 * Temporarily changes the logo background color to indicate an action, then resets it.
 *
 * @param {string} [color='green'] - The temporary background color for the logo.
 * @param {number} [duration=300] - The duration (in milliseconds) before resetting the background.
 */

function triggerLogoBackground(color = 'green', duration = 300) {
    // Target the specific logo image (not the app name)
    const logo = document.querySelector('.header-branding .header-logo');

    console.log('🔍 Logo element found:', logo); // Debug log
    console.log('🎨 Applying color:', color); // Debug log

    if (logo) {
        // Clear any existing timeout
        if (logoTimeoutId) {
            clearTimeout(logoTimeoutId);
            logoTimeoutId = null;
        }

        // Apply background color
        logo.style.setProperty('background-color', color, 'important');
        logo.style.setProperty('border-radius', '6px', 'important');
        
        console.log('✅ Background applied:', logo.style.backgroundColor); // Debug log
        
        // Remove background after duration
        logoTimeoutId = setTimeout(() => {
            logo.style.backgroundColor = '';
            logo.style.borderRadius = '';
            logoTimeoutId = null; 
            console.log('🔄 Background cleared'); // Debug log
        }, duration);
    } else {
        console.error('❌ Logo element not found!');
    }
}

// ✅ Export triggerLogoBackground globally for taskDOM module
window.triggerLogoBackground = triggerLogoBackground;

/**
 * Savetoggleautoreset function.
 *
 * @returns {void}
 */
function saveToggleAutoReset() {
    console.log('⚙️ Setting up toggle auto reset (state-based)...');
    
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasksContainer = document.getElementById("deleteCheckedTasksContainer");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
    
    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for saveToggleAutoReset');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for saveToggleAutoReset');
        return;
    }
    
    const { data, appState } = currentState;
    const activeCycle = appState.activeCycleId;
    const currentCycle = data.cycles[activeCycle];
    
    console.log('📊 Setting up toggles for cycle:', activeCycle);
    
    // ✅ Ensure AutoReset reflects the correct state from state system
    if (activeCycle && currentCycle) {
        toggleAutoReset.checked = currentCycle.autoReset || false;
        deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
        console.log('🔄 Auto reset state:', currentCycle.autoReset);
        console.log('🗑️ Delete checked tasks state:', currentCycle.deleteCheckedTasks);
    } else {
        console.warn('⚠️ No active cycle found, defaulting to false');
        toggleAutoReset.checked = false;
        deleteCheckedTasks.checked = false;
    }
    
    // ✅ Hide "Delete Checked Tasks" - always hidden regardless of Auto Reset state
    deleteCheckedTasksContainer.style.display = "none";

    // ✅ Remove previous event listeners before adding new ones to prevent stacking
    toggleAutoReset.removeEventListener("change", handleAutoResetChange);
    deleteCheckedTasks.removeEventListener("change", handleDeleteCheckedTasksChange);

    // ✅ Define event listener functions for state-based system
    function handleAutoResetChange(event) {
        console.log('🔄 Auto reset toggle changed (state-based):', event.target.checked);
        
        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active cycle available for auto reset change');
            return;
        }

        // ✅ Update through state system
        window.AppState.update(state => {
            const cycle = state.data.cycles[activeCycle];
            if (cycle) {
                cycle.autoReset = event.target.checked;
                
                // ✅ If Auto Reset is turned ON, automatically uncheck "Delete Checked Tasks"
                if (event.target.checked) {
                    cycle.deleteCheckedTasks = false;
                    deleteCheckedTasks.checked = false; // ✅ Update UI
                    console.log('🔄 Auto reset ON - disabling delete checked tasks');
                }
            }
        }, true); // immediate save

        // ✅ Keep "Delete Checked Tasks" always hidden regardless of Auto Reset state
        deleteCheckedTasksContainer.style.display = "none";

        // ✅ Only trigger miniCycle reset if AutoReset is enabled
        if (event.target.checked) {
            console.log('🔄 Auto reset enabled - checking cycle state');
            checkMiniCycle();
        }

        refreshTaskListUI();
        if (window.recurringCore?.updateRecurringButtonVisibility) window.recurringCore.updateRecurringButtonVisibility();
        
        console.log('✅ Auto reset settings saved (state-based)');
    }

    function handleDeleteCheckedTasksChange(event) {
        console.log('🗑️ Delete checked tasks toggle changed (state-based):', event.target.checked);
        
        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active cycle available for delete checked tasks change');
            return;
        }

        // ✅ Update through state system
        window.AppState.update(state => {
            const cycle = state.data.cycles[activeCycle];
            if (cycle) {
                cycle.deleteCheckedTasks = event.target.checked;
            }
        }, true); // immediate save
        
        // ✅ Update recurring button visibility when setting changes
        if (window.recurringCore?.updateRecurringButtonVisibility) window.recurringCore.updateRecurringButtonVisibility();
        
        console.log('✅ Delete checked tasks setting saved (state-based)');
    }

    // ✅ Add new event listeners
    toggleAutoReset.addEventListener("change", handleAutoResetChange);
    deleteCheckedTasks.addEventListener("change", handleDeleteCheckedTasksChange);
    
    console.log('✅ Toggle auto reset setup completed (state-based)');
}


/**
 * Checkduedates function.
 *
 * @returns {void}
 */
    
    

// ✅ updateDueDateVisibility moved to utilities/dueDates.js
    
    
    
    



    


 if (!deleteCheckedTasks.dataset.listenerAdded) {
    deleteCheckedTasks.addEventListener("change", (event) => {
        // ✅ Schema 2.5 only
        console.log('🗑️ Delete checked tasks toggle changed (Schema 2.5 only)...');
        
        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for deleteCheckedTasks toggle');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];
        
        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active cycle found for delete checked tasks toggle');
            return;
        }
        
        // Update Schema 2.5
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle].deleteCheckedTasks = event.target.checked;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        // ✅ Update recurring button visibility in real-time
        if (window.recurringCore?.updateRecurringButtonVisibility) window.recurringCore.updateRecurringButtonVisibility();
        
        console.log('✅ Delete checked tasks setting saved (Schema 2.5)');
    });

    deleteCheckedTasks.dataset.listenerAdded = true; 
}



// ✅ Function to complete all tasks and handle reset
// ✅ REMOVED: handleCompleteAllTasks - now in utilities/task/taskCore.js
// ✅ Event listener moved to Phase 3 (after taskCore loads)


/***********************
 * 
 * 
 * Add Event Listeners
 * 
 * 
 ************************/
// 🟢 Add Task Button (Click)
safeAddEventListener(addTaskButton, "click", () => {
    // ✅ Enable undo system on first user interaction
    enableUndoSystemOnFirstInteraction();

    const taskText = taskInput.value ? taskInput.value.trim() : "";
    if (!taskText) {
        console.warn("⚠ Cannot add an empty task.");
        return;
    }


    addTask(taskText);
    taskInput.value = "";
});

// 🟢 Task Input (Enter Key)
safeAddEventListener(taskInput, "keypress", function (event) {
    if (event.key === "Enter") {
        // ✅ Enable undo system on first user interaction
        enableUndoSystemOnFirstInteraction();

        event.preventDefault();
        const taskText = taskInput.value ? taskInput.value.trim() : "";
        if (!taskText) {
            console.warn("⚠ Cannot add an empty task.");
            return;
        }


        addTask(taskText);
        taskInput.value = "";
    }
});



// 🟢 Menu Button (Click) - ✅ FIXED: ES5 compatible function expression
safeAddEventListener(menuButton, "click", function(event) {
    event.stopPropagation();
    syncCurrentSettingsToStorage(); // ✅ Now supports both schemas
    saveToggleAutoReset(); // ✅ Already updated with Schema 2.5 support
    menu.classList.toggle("visible");

    if (menu.classList.contains("visible")) {
        document.addEventListener("click", closeMenuOnClickOutside);
    }
});



safeAddEventListenerById("reset-notification-position", "click", () => {
    console.log('🔄 Resetting notification position (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for reset notification position');
        showNotification("❌ Schema 2.5 data required.", "error", 2000);
        return;
    }
    
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    
    // Reset notification position in Schema 2.5
    fullSchemaData.settings.notificationPosition = { x: 0, y: 0 };
    fullSchemaData.settings.notificationPositionModified = false;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log('✅ Notification position reset in Schema 2.5');
    
    // Reset UI position
    resetNotificationPosition();
    
    showNotification("🔄 Notification position reset (Schema 2.5).", "success", 2000);
});

document.getElementById("open-reminders-modal")?.addEventListener("click", () => {
    console.log('🔔 Opening reminders modal (Schema 2.5 only)...');
    
    // Load current settings from Schema 2.5 before opening
    loadRemindersSettings(); // This function already has Schema 2.5 support
    document.getElementById("reminders-modal").style.display = "flex";
    hideMainMenu();
    
    console.log('✅ Reminders modal opened');
});

// 🟢 Safe Global Click for Hiding Task Buttons
safeAddEventListener(document, "click", (event) => {
    let isTaskOrOptionsClick = event.target.closest(".task, .task-options");
    let isModalClick = event.target.closest(".modal, .mini-modal-overlay, .settings-modal, .notification");
    
    if (!isTaskOrOptionsClick && !isModalClick) {
        console.log("✅ Clicking outside - closing task buttons");

        document.querySelectorAll(".task-options").forEach(action => {
            action.style.opacity = "0";
            action.style.visibility = "hidden";
            action.style.pointerEvents = "none";
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
safeAddEventListener(document, "click", (event) => {
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

// Update your existing HelpWindowManager class to show mode descriptions:
class HelpWindowManager {
    constructor() {
        this.helpWindow = document.getElementById('help-window');
        this.isVisible = false;
        this.currentMessage = null;
        this.isShowingCycleComplete = false;
        this.isShowingModeDescription = false;
        this.modeDescriptionTimeout = null;
        this.initialized = false; // ✅ Prevent double initialization
        
        this.init();
    }
    
    init() {
        if (!this.helpWindow || this.initialized) {
            if (this.initialized) console.warn('⚠️ HelpWindowManager already initialized');
            return;
        }
        
        this.initialized = true;
        
        // Start showing initial message after a delay
        setTimeout(() => {
            this.showConstantMessage();
        }, 3000);
        
        // ✅ IMPROVED: Multiple event listeners for better coverage
        this.setupEventListeners();
    }
    
    setupEventListeners() {
    // ✅ More aggressive event listening
    document.addEventListener('change', (e) => {
        console.log("📡 Change event detected:", e.target); // Debug log
        if (e.target.type === 'checkbox' && e.target.closest('.task')) {
            console.log("📋 Task checkbox change detected"); // Debug log
            setTimeout(() => {
                this.updateConstantMessage();
            }, 50);
        }
    });
    
    // ✅ ADDITIONAL: Listen for click events on tasks
    document.addEventListener('click', (e) => {
        if (e.target.closest('.task')) {
            console.log("📋 Task click detected"); // Debug log
            setTimeout(() => {
                this.updateConstantMessage();
            }, 100);
        }
    });
        
        // ✅ ADDITIONAL: Listen for task list mutations (task additions/deletions)
        const taskList = document.getElementById('taskList');
        if (taskList) {
            const observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                
                mutations.forEach(mutation => {
                    // Check if tasks were added or removed
                    if (mutation.type === 'childList' && 
                        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                        shouldUpdate = true;
                    }
                });
                
                if (shouldUpdate) {
                    console.log('📝 Help window: Task list changed');
                    setTimeout(() => {
                        this.updateConstantMessage();
                    }, 200);
                }
            });
            
            observer.observe(taskList, { 
                childList: true, 
                subtree: true // ✅ Also watch for changes in child elements
            });
        }
        
        // ✅ ADDITIONAL: Listen for custom events that might affect task status
        document.addEventListener('taskCompleted', () => {
            console.log('📝 Help window: Custom taskCompleted event');
            this.updateConstantMessage();
        });
        
        document.addEventListener('tasksReset', () => {
            console.log('📝 Help window: Custom tasksReset event');
            this.updateConstantMessage();
        });
    }
 
    
    showConstantMessage() {
        this.updateConstantMessage();
        this.show();
    }
    
    updateConstantMessage() {
        // Don't update if showing cycle completion message or mode description
        if (this.isShowingCycleComplete || this.isShowingModeDescription) return;
        
        const message = this.getCurrentStatusMessage();
        
        if (message !== this.currentMessage) {
            this.currentMessage = message;
            if (this.isVisible) {
                this.updateContent(message);
            }
        }
    }
    
    // ✅ New method to show mode description temporarily
    showModeDescription(mode) {
        if (!this.helpWindow) return;
        
        // Clear any existing timeout
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }
        
        this.isShowingModeDescription = true;
        
        const modeDescriptions = {
            'auto-cycle': {
                title: "🔄 Auto Cycle Mode",
                description: "Tasks automatically reset when all are completed."
            },
            'manual-cycle': {
                title: "✔️ Manual Cycle Mode", 
                description: "Tasks only reset when you click the Complete button."
            },
            'todo-mode': {
                title: "✓ To-Do Mode",
                description: "Completed tasks are removed when you click Complete."
            }
        };
        
        const modeInfo = modeDescriptions[mode] || modeDescriptions['auto-cycle'];
        
        this.helpWindow.innerHTML = `
            <div class="mode-help-content">
                <h4 style="margin: 0 0 8px 0; color: var(--accent-color, #007bff);">${modeInfo.title}</h4>
                <p style="margin: 0; line-height: 1.4;">${modeInfo.description}</p>
            </div>
        `;
        
        // Show the help window if it's not already visible
        if (!this.isVisible) {
            this.show();
        }
        
        // Auto-hide after 30 seconds and return to normal message
        this.modeDescriptionTimeout = setTimeout(() => {
            this.isShowingModeDescription = false;
            this.modeDescriptionTimeout = null;
            this.updateConstantMessage();
        }, 30000); // 30 seconds
        
        console.log(`📖 Showing mode description for: ${mode}`);
    }
    
    // ✅ Method to show cycle completion message (keep existing)
    showCycleCompleteMessage() {
        if (!this.helpWindow) return;
        
        // Clear mode description if showing
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
            this.isShowingModeDescription = false;
        }
        
        this.isShowingCycleComplete = true;
        this.helpWindow.innerHTML = `
            <p>✅ Cycle Complete! Tasks reset.</p>
        `;
        
        // Auto-hide after 2 seconds and return to normal message
        setTimeout(() => {
            this.isShowingCycleComplete = false;
            this.updateConstantMessage();
        }, 2000);
    }
    
 // In the getCurrentStatusMessage() method, around line 4400:
getCurrentStatusMessage() {
    const totalTasks = document.querySelectorAll('.task').length;
    const completedTasks = document.querySelectorAll('.task input:checked').length;
    const remaining = totalTasks - completedTasks;
    
    // ✅ Get cycle count from Schema 2.5 only
    const schemaData = loadMiniCycleData();
    let cycleCount = 0;
    
    if (schemaData) {
        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];
        cycleCount = currentCycle?.cycleCount || 0;
    }
    
    // Return different constant messages based on state
    if (totalTasks === 0) {
        return `📝 Add your first task to get started! • ${cycleCount} cycle${cycleCount === 1 ? '' : 's'} completed`;
    }
    
    if (remaining === 0 && totalTasks > 0) {
        return `🎉 All tasks complete! • ${cycleCount} cycle${cycleCount === 1 ? '' : 's'} completed`;
    }
    
    if (cycleCount === 0) {
        return `📋 ${remaining} task${remaining === 1 ? '' : 's'} remaining • Complete your first cycle!`;
    }
    
    // Show progress and cycle count
    return `📋 ${remaining} task${remaining === 1 ? '' : 's'} remaining • ${cycleCount} cycle${cycleCount === 1 ? '' : 's'} completed`;
}
    
    updateContent(message) {
        if (!this.helpWindow) return;
        
        this.helpWindow.innerHTML = `
            <p>${message}</p>
        `;
    }
    
    show() {
        if (!this.helpWindow || this.isVisible) return;
        
        const message = this.currentMessage || this.getCurrentStatusMessage();
        
        if (!this.isShowingModeDescription && !this.isShowingCycleComplete) {
            this.helpWindow.innerHTML = `
                <p>${message}</p>
            `;
        }
        
        this.helpWindow.classList.remove('hide');
        this.helpWindow.classList.add('show');
        this.helpWindow.style.display = 'flex';
        this.isVisible = true;
    }
    
    hide() {
        if (!this.helpWindow || !this.isVisible) return;
        
        this.helpWindow.classList.remove('show');
        this.helpWindow.classList.add('hide');
        this.isVisible = false;
        
        setTimeout(() => {
            this.helpWindow.style.display = 'none';
        }, 300);
    }
    
    destroy() {
        // Clear any active timeouts
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }
    }
}

// Initialize help window manager and export to window for taskCore module
let helpWindowManager;

setTimeout(() => {
    helpWindowManager = new HelpWindowManager();
    window.helpWindowManager = helpWindowManager; // Export to window
}, 500);

/**
 * Refresh task buttons when mode changes to show/hide recurring button
 */

// ✅ Updated setupModeSelector to use state-based system


// ✅ Updated updateCycleModeDescription to Schema 2.5 only






/*****SPEACIAL EVENT LISTENERS *****/

// ✅ REMOVED: dragover event listener - now handled by dragDropManager module via setupRearrange()
document.addEventListener("touchstart", () => {
    hasInteracted = true;
}, { once: true, passive: true });



document.addEventListener("touchstart", () => {}, { passive: true });





/***********************
 * 
 * 
 * STATS PANEL - MOVED TO MODULE
 * 
 * Stats panel functionality including swipe detection, view switching,
 * event handlers, and all related code has been moved to:
 * utilities/statsPanel.js (StatsPanelManager class)
 * 
 * Global functions are available through module initialization:
 * - window.showStatsPanel()
 * - window.showTaskView() 
 * - window.updateStatsPanel()
 * 
 ************************/

// ✅ Theme-related functions that were accidentally removed during stats panel extraction





// ✅ Initialize themes panel (moved to DOMContentLoaded for proper timing)
// ✅ REMOVED: updateCycleModeDescription() calls - now handled by modeManager module








/*

(function boot() {
  function start() {
    try {
      // --- sync init ---
      fixTaskValidationIssues();
      // ✅ MOVED TO PHASE 2: setupMainMenu() - now handled by menuManager module
      // ✅ MOVED TO PHASE 2: setupSettingsMenu() - now handled by settingsManager module
      // ✅ REMOVED: setupAbout() - Now handled by modalManager module
      setupUserManual();
      // ✅ REMOVED: setupFeedbackModal() - Now handled by modalManager module
      // Add themes panel setup after other modal setups
      // setupTestingModal(); // Removed duplicate - already called in main boot function
      initializeThemesPanel();
      initializeModeSelector();
      // ✅ Recurring setup now handled by recurringIntegration module
      // Old setupRecurringPanel() and attachRecurringSummaryListeners() calls removed
      updateNavDots();
      loadMiniCycle();
      // ✅ initializeDefaultRecurringSettings() removed - now handled by recurringIntegration module
      setupMiniCycleTitleListener();
      // ✅ MOVED TO PHASE 2: setupDownloadMiniCycle() - now handled by settingsManager module
      // ✅ MOVED TO PHASE 2: setupUploadMiniCycle() - now handled by settingsManager module
      // ✅ REMOVED: setupRearrange() and dragEndCleanup() - now handled by dragDropManager module
      // ✅ MOVED: updateMoveArrowsVisibility() moved to proper initialization phase

      loadAlwaysShowRecurringSetting();
      updateCycleModeDescription();
         setupThemesPanel(); 

      // --- timers / async kickoffs ---
      setTimeout(remindOverdueTasks, 2000);
      // ✅ updateReminderButtons() and startReminders() now handled by reminderManager.init() via afterApp hook
      // ✅ checkOverdueTasks() now handled by dueDatesManager.init() via afterApp hook

      // only on modern browsers
      if (supportsModern()) setTimeout(autoRedetectOnVersionChange, 10000);

      // focus once window is loaded
      window.addEventListener('load', function () {
        var el = document.getElementById('taskInput');
        if (el) { try { el.focus(); } catch(_){} }
      });

      // Initialize stats panel manager
      if (window.statsPanelManager) {
        console.log('📊 Initializing stats panel event handlers...');
        window.statsPanelManager.init();
        // Update stats panel now that it's ready
        window.updateStatsPanel();
      }

      // ✅ Setup navigation dot click handlers
      document.querySelectorAll(".dot").forEach((dot, index) => {
        dot.addEventListener("click", () => {
          if (index === 0) {
            if (window.showTaskView) window.showTaskView();
          } else {
            if (window.showStatsPanel) window.showStatsPanel();
          }
        });
      });

      // ready signal
      window.AppReady = true;
      document.dispatchEvent(new Event('app:ready'));
      console.log('✅ miniCycle app is fully initialized and ready.');
    } catch (err) {
      console.error('🚨 Boot error:', err);
      if (typeof showNotification === 'function') {
        showNotification('⚠️ App failed to finish booting. Some features may be unavailable.', 'warning', 6000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  function supportsModern() {
    try { new Function('()=>{}'); } catch(_) { return false; }
    return !!(window.Promise && window.fetch);
  }
})();

*/

});

  function supportsModern() {
    try { new Function('()=>{}'); } catch(_) { return false; }
    return !!(window.Promise && window.fetch);
  }
