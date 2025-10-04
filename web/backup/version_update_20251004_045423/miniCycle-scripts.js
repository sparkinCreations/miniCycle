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
  lastSnapshotTs: 0   
};


// ✅ REMOVE ALL THESE DUPLICATE VARIABLES - DELETE THIS ENTIRE SECTION:
/*
let draggedTask = null;
let logoTimeoutId = null;
let touchStartTime = 0;
let isLongPress = false;
let touchStartY = 0;
let touchEndY = 0;
let holdTimeout = null;
let moved = false;
let isDragging = false;
let rearrangeInitialized = false;
let lastDraggedOver = null;
let lastRearrangeTarget = null;
let lastDragOverTime = 0;
let hasInteracted = false;
let reminderIntervalId = null;
let timesReminded = 0;
let lastReminderTime = null;
let isResetting = false;
let undoSnapshot = null;
let redoSnapshot = null;
let undoStack = [];
let redoStack = [];
let didDragReorderOccur = false;
let lastReorderTime = 0;
let advancedVisible = false;
*/


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
// This system ensures that data-dependent initializers only run after an active cycle is ready.
// It prevents race conditions between data loading and feature initialization by providing:
// - onReady(fn): Queue functions to run when data is available
// - isReady(): Check if initialization is complete  
// - signalReady(activeCycle): Mark data as ready and trigger queued functions
**/
const AppInit = (() => {
  let resolveReady;
  const ready = new Promise(r => (resolveReady = r));
  let readyFlag = false;

  return {
    onReady(fn) { ready.then(() => { try { fn(); } catch (e) { console.error('onReady error:', e); } }); },
    isReady() { return readyFlag; },
    signalReady(activeCycle) {
      if (readyFlag) return;
      readyFlag = true;
      document.dispatchEvent(new CustomEvent('cycle:ready', { detail: { activeCycle } }));
      resolveReady();
    }
  };
})();
window.AppInit = AppInit;








//Main application initialization sequence

document.addEventListener('DOMContentLoaded', async (event) => {
    console.log('🚀 Starting miniCycle initialization (Schema 2.5 only)...');

  window.AppBootStarted = true;
  window.AppBootStartTime = Date.now(); // ✅ Track boot start time
// ======================================================================
// 🚀 MAIN APPLICATION INITIALIZATION SEQUENCE
// ======================================================================
// This is the entry point that orchestrates the entire miniCycle app startup.
// Execution flow:
// 1. Load and initialize all utility modules (notifications, device detection, etc.)
// 2. Set up DOM element references and UI components
// 3. Configure theme and dark mode settings
// 4. Load cycle data and handle data migration if needed
// 5. Initialize features that depend on active cycle data
// 6. Complete setup and mark the app as ready
// ======================================================================








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



   



    await import('./utilities/globalUtils.js');
    console.log('🛠️ Global utilities loaded');

    const { default: consoleCapture } = await import('./utilities/consoleCapture.js');
    window.consoleCapture = consoleCapture;

    const { MiniCycleNotifications } = await import('./utilities/notifications.js');
    const notifications = new MiniCycleNotifications();
    
    window.notifications = notifications;
    window.showNotification = (message, type, duration) => notifications.show(message, type, duration);
    
    console.log('📱 Initializing device detection module...');
    const { DeviceDetectionManager } = await import('./utilities/deviceDetection.js');
    
    const deviceDetectionManager = new DeviceDetectionManager({
        loadMiniCycleData: () => window.loadMiniCycleData ? window.loadMiniCycleData() : null,
        showNotification: (msg, type, duration) => window.showNotification ? window.showNotification(msg, type, duration) : console.log('Notification:', msg),
        currentVersion: '1.305'
    });
    
    window.deviceDetectionManager = deviceDetectionManager;
    
    console.log('📊 Initializing stats panel module...');
    const { StatsPanelManager } = await import('./utilities/statsPanel.js');
    
    const statsPanelManager = new StatsPanelManager({
        showNotification: (msg, type, duration) => window.showNotification ? window.showNotification(msg, type, duration) : console.log('Notification:', msg),
        loadMiniCycleData: () => {
            // Defensive data loading with error handling
            try {
                const result = window.loadMiniCycleData ? window.loadMiniCycleData() : null;
                if (!result) {
                    console.log('� StatsPanelManager: Data not ready yet');
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
    
    // ✅ Create a deferred stats update queue
    window._deferredStatsUpdates = [];
    
    window.updateStatsPanel = () => {
        const dataAvailable = window.loadMiniCycleData && window.loadMiniCycleData();
        if (dataAvailable) {
            // ✅ Check if AppState is ready before updating
            if (window.AppState?.isReady?.()) {
                return statsPanelManager.updateStatsPanel();
            } else {
                // ✅ Defer the update until AppState is ready
                console.log('📊 Deferring stats update - AppState not ready yet');
                window._deferredStatsUpdates.push(() => statsPanelManager.updateStatsPanel());
                return;
            }
        } else {
            console.log('📊 Skipping stats update - data not ready');
        }
    };
    console.log('📊 StatsPanelManager global functions updated');
    
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
            updateRecurringSummary();
        }
    };
    
    // === 🔁 Delegated Click Handler ===
    const handleRecurringClick = (e) => {
        const isMatch = RECURRING_CLICK_TARGETS.some(selector =>
            e.target.matches(selector)
        );
        if (isMatch) {
            updateRecurringSummary();
        }
    };
    
    // === 🧠 Attach Delegated Listeners ===
    function attachRecurringSummaryListeners() {
        const panel = document.getElementById("recurring-settings-panel");
        safeAddEventListener(panel, "change", handleRecurringChange);
        safeAddEventListener(panel, "click", handleRecurringClick);
    }

    const DRAG_THROTTLE_MS = 50;
    const TASK_LIMIT = 100; 

    // ✅ Initialize app with proper error handling and Schema 2.5 focus
    console.log('🔧 Starting core initialization sequence...');


    

    // ✅ UI Component Setup
    console.log('🎨 Setting up UI components...');
    loadRemindersSettings();
    setupReminderToggle();
    setupMainMenu();
    setupSettingsMenu();
    setupAbout();
    setupUserManual();
    setupFeedbackModal();
    setupTestingModal();
    setupModalClickOutside();

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
    const mod = await import('./utilities/cycleLoader.js');

        // ✅ Ensure loadMiniCycle is available globally for refreshUIFromState()
    if (!window.loadMiniCycle) {
      window.loadMiniCycle = mod.loadMiniCycle;
    }

    mod.setCycleLoaderDependencies({
      loadMiniCycleData,         // function defined in this file
      createInitialSchema25Data, // function defined in this file
      addTask,                   // function defined in this file
      updateThemeColor,          // function defined in this file
      startReminders,            // function defined in this file
      updateProgressBar,         // function defined in this file
      checkCompleteAllButton,    // function defined in this file
      updateMainMenuHeader,      // function defined in this file
      updateStatsPanel           // function defined in this file
    });

    // If completeInitialSetup ran earlier and queued a load, honor it.
    if (window.__pendingCycleLoad) {
      mod.loadMiniCycle();
      window.__pendingCycleLoad = false;
    }

    // 🎯 Core data initialization (move here so loader is ready)
    console.log('🎯 About to start core data initialization...');
    try {
      console.log('🔧 Running fixTaskValidationIssues...');
      fixTaskValidationIssues();

      console.log('🚀 Running initializeAppWithAutoMigration...');
      initializeAppWithAutoMigration({ forceMode: true }); // will call initialSetup()
      console.log('✅ Core initialization sequence started successfully');
    } catch (error) {
      console.error('❌ Critical initialization error:', error);
      console.error('❌ Error stack:', error.stack);
    }
  } catch (e) {
    console.error('❌ cycleLoader import failed:', e);
  }


  // ...remove the later duplicate cycleLoader import block that used to be here...
  // ...existing code continues...

    // ...existing code...

    // ✅ Feature Setup
    console.log('⚙️ Setting up features...');
    setupMiniCycleTitleListener();
    setupDownloadMiniCycle();
    setupUploadMiniCycle();
    setupRearrange();
    dragEndCleanup();
    // ✅ MOVED: updateMoveArrowsVisibility() to AppInit.onReady() where AppState is available
    initializeThemesPanel();
    setupThemesPanel();



// ...existing code...


function wireUndoRedoUI() {
  if (window.__undoRedoWired) return; // idempotent guard
  window.__undoRedoWired = true;

  initializeUndoRedoButtons();
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  if (undoBtn) safeAddEventListener(undoBtn, "click", () => performStateBasedUndo());
  if (redoBtn) safeAddEventListener(redoBtn, "click", () => performStateBasedRedo());
}

// ✅ Defer anything that needs cycles/data until an active cycle exists
// ...existing code...
AppInit.onReady(async () => {
  console.log('🟢 Data-ready initializers running…');

  // ✅ Initialize state module SYNCHRONOUSLY after data exists
  try {
    console.log('🗃️ Initializing state module after data setup...');

    const { createStateManager } = await import('./utilities/state.js');
    window.AppState = createStateManager({
      showNotification: window.showNotification || console.log.bind(console),
      storage: localStorage,
      createInitialData: createInitialSchema25Data
    });

    await window.AppState.init();
    console.log('✅ State module initialized successfully after data setup');

        // ✅ Idempotent wiring for Undo/Redo buttons
        wireUndoRedoUI();


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
                if (window.AppInit?.isReady?.() && !window.AppGlobalState.isPerformingUndoRedo && boundGet) {
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


        // ✅ Subscribe for state-based undo snapshots
        setupStateBasedUndoRedo();

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

  // ✅ Give AppState a moment to fully initialize before other modules try to use it
  await new Promise(resolve => setTimeout(resolve, 50));

  // ✅ Process any deferred stats updates now that AppState is ready
  if (window._deferredStatsUpdates && window._deferredStatsUpdates.length > 0) {
    console.log(`📊 Processing ${window._deferredStatsUpdates.length} deferred stats updates`);
    window._deferredStatsUpdates.forEach(updateFn => {
      try {
        updateFn();
      } catch (error) {
        console.warn('⚠️ Deferred stats update failed:', error);
      }
    });
    window._deferredStatsUpdates = []; // Clear the queue
  }

  // ✅ Process any deferred recurring setups now that AppState is ready
  if (window._deferredRecurringSetup && window._deferredRecurringSetup.length > 0) {
    console.log(`🔁 Processing ${window._deferredRecurringSetup.length} deferred recurring setups`);
    window._deferredRecurringSetup.forEach(setupFn => {
      try {
        setupFn();
      } catch (error) {
        console.warn('⚠️ Deferred recurring setup failed:', error);
      }
    });
    window._deferredRecurringSetup = []; // Clear the queue
  }

  // ✅ Recurring Features
  console.log('🔁 Setting up recurring features...');
  setupRecurringPanel();
  attachRecurringSummaryListeners();
  loadAlwaysShowRecurringSetting();

  // ✅ Mode Selector (with delay for DOM readiness)
  console.log('🎯 Initializing mode selector...');
  initializeModeSelector(); // This calls setupModeSelector()

  // ✅ Reminder System (with staggered timing)
  console.log('🔔 Setting up reminder system...');
  setTimeout(() => {
    try {
      remindOverdueTasks();
    } catch (error) {
      console.warn('⚠️ Overdue task reminder failed:', error);
    }
  }, 2000);
  checkDueDates();

  setTimeout(() => {
    try {
      updateReminderButtons(); // ✅ This is the *right* place!
      startReminders();
    } catch (error) {
      console.warn('⚠️ Reminder system setup failed:', error);
    }
  }, 200);

  // ✅ Recurring Watcher Setup (with Schema 2.5 compatibility)
  console.log('👁️ Setting up recurring task watcher...');
  try {
    // ✅ Use AppState-based watcher setup
    if (window.AppState && window.AppState.isReady()) {
      setupRecurringWatcher();
    } else {
      console.log('⏳ AppState not ready, deferring recurring watcher setup...');
      // Defer setup until AppState is ready
      window._deferredRecurringSetup = window._deferredRecurringSetup || [];
      window._deferredRecurringSetup.push(() => setupRecurringWatcher());
    }
  } catch (error) {
    console.warn('⚠️ Recurring watcher setup failed:', error);
  }

  // ✅ Final Setup
  console.log('🎯 Completing initialization...');
  
  // ✅ Now that AppState is ready, setup arrow visibility
  updateMoveArrowsVisibility();
  
  window.onload = () => {
    if (taskInput) {
      taskInput.focus();
    }
  };
});
// ...existing code...

// ...existing code...





    
  
    // ✅ FIXED: Device detection call at the end, after everything is initialized
    setTimeout(() => {
        console.log('📱 Running device detection...');
        if (window.deviceDetectionManager && window.loadMiniCycleData) {
            window.deviceDetectionManager.autoRedetectOnVersionChange();
        } else {
            console.error('❌ Device detection manager or dependencies not available');
        }
    }, 10000);






// ==== 🔁 UNDO / REDO SYSTEM =============================
// - Tracks task + recurring state snapshots
// - Limit: 4 snapshots
// - Functions: pushUndoSnapshot, performUndo, performRedo
// ========================================================







 // ✅ Add this new function
function initializeUndoRedoButtons() {
    const undoBtn = document.getElementById("undo-btn");
    const redoBtn = document.getElementById("redo-btn");
    
    if (undoBtn) {
        undoBtn.hidden = false; // Show the button
        undoBtn.disabled = true; // Initially disabled
    }
    if (redoBtn) {
        redoBtn.hidden = false; // Show the button  
        redoBtn.disabled = true; // Initially disabled
    }
    
    console.log('🔘 Undo/redo buttons initialized');
}

// ✅ Add this function
function captureInitialSnapshot() {
    const currentState = window.AppState.get();
    if (currentState) {
        console.log('📸 Capturing initial snapshot...');
        captureStateSnapshot(currentState);
    }
}


// ✅ FIXED: Update the setupStateBasedUndoRedo function around line 835
function setupStateBasedUndoRedo() {
    if (!window.AppState?.isReady?.()) {
        console.warn('⚠️ State module not ready for undo/redo setup');
        return;
    }

    // Skip installing when wrapper is active
    if (window.__useUpdateWrapper) {
        console.log('ℹ️ Undo subscriber skipped (wrapper handles snapshots)');
        return;
    }

    try {
        window.AppState.subscribe('undo-system', (newState, oldState) => {
            // ✅ Runtime guard if wrapper activates later
            if (window.__useUpdateWrapper) return;

            if (!window.AppGlobalState.isPerformingUndoRedo &&
                oldState?.data?.cycles && newState?.data?.cycles) {
                const activeCycle = newState.appState.activeCycleId;
                if (activeCycle && oldState.data.cycles[activeCycle] && newState.data.cycles[activeCycle]) {
                    const oldCycle = oldState.data.cycles[activeCycle];
                    const newCycle = newState.data.cycles[activeCycle];

                    const tasksChanged = JSON.stringify(oldCycle.tasks) !== JSON.stringify(newCycle.tasks);
                    const titleChanged = oldCycle.title !== newCycle.title;
                    const settingsChanged = oldCycle.autoReset !== newCycle.autoReset ||
                                            oldCycle.deleteCheckedTasks !== newCycle.deleteCheckedTasks;

                    if (tasksChanged || titleChanged || settingsChanged) {
                        captureStateSnapshot(oldState);
                    }
                }
            }
        });
        console.log('✅ State-based undo/redo system initialized');
    } catch (subscriptionError) {
        console.warn('⚠️ Failed to subscribe to state changes:', subscriptionError);
    }
}

// ✅ Capture complete state snapshots instead of manual extraction
function captureStateSnapshot(state) {
    if (!state?.data?.cycles || !state?.appState?.activeCycleId) {
        console.warn('⚠️ Invalid state for snapshot');
        return;
    }

    const activeCycle = state.appState.activeCycleId;
    const currentCycle = state.data.cycles[activeCycle];
    if (!currentCycle) return;

    const snapshot = {
        activeCycleId: activeCycle,
        tasks: structuredClone(currentCycle.tasks || []),
        recurringTemplates: structuredClone(currentCycle.recurringTemplates || {}),
        title: currentCycle.title || "Untitled miniCycle",
        autoReset: currentCycle.autoReset,
        deleteCheckedTasks: currentCycle.deleteCheckedTasks,
        timestamp: Date.now()
    };

    // Build minimal signature to detect duplicates
    const sig = JSON.stringify({
        c: snapshot.activeCycleId,
        t: snapshot.tasks.map(t => ({ id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null })),
        ti: snapshot.title,
        ar: !!snapshot.autoReset,
        dc: !!snapshot.deleteCheckedTasks
    });

    const now = Date.now();

    // Throttle identical snapshots
    if (sig === window.AppGlobalState.lastSnapshotSignature &&
        now - window.AppGlobalState.lastSnapshotTs < UNDO_MIN_INTERVAL_MS) {
        return;
    }

    // Skip if last on stack is identical
    const last = window.AppGlobalState.undoStack.at(-1);
    if (last) {
        const lastSig = JSON.stringify({
            c: last.activeCycleId,
            t: (last.tasks || []).map(t => ({ id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null })),
            ti: last.title,
            ar: !!last.autoReset,
            dc: !!last.deleteCheckedTasks
        });
        if (lastSig === sig) return;
    }

    console.log('📸 Capturing snapshot:', {
        taskCount: snapshot.tasks.length,
        title: snapshot.title,
        stackSize: window.AppGlobalState.undoStack.length
    });

    window.AppGlobalState.undoStack.push(snapshot);
    if (window.AppGlobalState.undoStack.length > UNDO_LIMIT) {
        window.AppGlobalState.undoStack.shift();
    }

    // Update dedupe trackers
    window.AppGlobalState.lastSnapshotSignature = sig;
    window.AppGlobalState.lastSnapshotTs = now;

    window.AppGlobalState.redoStack = [];
    updateUndoRedoButtons();
}

function buildSnapshotSignature(s) {
  if (!s) return '';
  return JSON.stringify({
    c: s.activeCycleId,
    t: (s.tasks || []).map(t => ({
      id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null
    })),
    ti: s.title || '',
    ar: !!s.autoReset,
    dc: !!s.deleteCheckedTasks
  });
}

function snapshotsEqual(a, b) {
  return buildSnapshotSignature(a) === buildSnapshotSignature(b);
}



// ✅ State-based undo operation
async function performStateBasedUndo() {
  if (window.AppGlobalState.undoStack.length === 0) return;
  if (!window.AppState?.isReady?.()) return;

  window.AppGlobalState.isPerformingUndoRedo = true;
  try {
    const currentState = window.AppState.get();
    const currentActive = currentState.appState.activeCycleId;
    const currentCycle = currentState.data.cycles[currentActive];

    const currentSnapshot = {
      activeCycleId: currentActive,
      tasks: structuredClone(currentCycle?.tasks || []),
      recurringTemplates: structuredClone(currentCycle?.recurringTemplates || {}),
      title: currentCycle?.title,
      autoReset: currentCycle?.autoReset,
      deleteCheckedTasks: currentCycle?.deleteCheckedTasks,
      timestamp: Date.now()
    };

    let snap = null;
    while (window.AppGlobalState.undoStack.length) {
      const candidate = window.AppGlobalState.undoStack.pop();
      if (!snapshotsEqual(candidate, currentSnapshot)) {
        snap = candidate;
        break;
      }
    }
    if (!snap) { updateUndoRedoButtons(); return; }

    window.AppGlobalState.redoStack.push(currentSnapshot);

    await window.AppState.update(state => {
      if (snap.activeCycleId && snap.activeCycleId !== state.appState.activeCycleId) {
        state.appState.activeCycleId = snap.activeCycleId;
      }
      const cid = state.appState.activeCycleId;
      const cycle = state.data.cycles[cid] || (state.data.cycles[cid] = {});
      cycle.tasks = structuredClone(snap.tasks || []);
      cycle.recurringTemplates = structuredClone(snap.recurringTemplates || {});
      if (snap.title) cycle.title = snap.title;
      if ('autoReset' in snap) cycle.autoReset = snap.autoReset;
      if ('deleteCheckedTasks' in snap) cycle.deleteCheckedTasks = snap.deleteCheckedTasks;
    }, true);

    await Promise.resolve();
    refreshUIFromState(window.AppState.get());
    updateUndoRedoButtons();
  } catch (e) {
    console.error('❌ Undo failed:', e);
  } finally {
    window.AppGlobalState.isPerformingUndoRedo = false;
  }
}



// ✅ State-based redo operation
async function performStateBasedRedo() {
  if (window.AppGlobalState.redoStack.length === 0) return;
  if (!window.AppState?.isReady?.()) return;

  window.AppGlobalState.isPerformingUndoRedo = true;
  try {
    const currentState = window.AppState.get();
    const currentActive = currentState.appState.activeCycleId;
    const currentCycle = currentState.data.cycles[currentActive];

    const currentSnapshot = {
      activeCycleId: currentActive,
      tasks: structuredClone(currentCycle?.tasks || []),
      recurringTemplates: structuredClone(currentCycle?.recurringTemplates || {}),
      title: currentCycle?.title,
      autoReset: currentCycle?.autoReset,
      deleteCheckedTasks: currentCycle?.deleteCheckedTasks,
      timestamp: Date.now()
    };

    let snap = null;
    while (window.AppGlobalState.redoStack.length) {
      const candidate = window.AppGlobalState.redoStack.pop();
      if (!snapshotsEqual(candidate, currentSnapshot)) {
        snap = candidate;
        break;
      }
    }
    if (!snap) { updateUndoRedoButtons(); return; }

    window.AppGlobalState.undoStack.push(currentSnapshot);

    await window.AppState.update(state => {
      if (snap.activeCycleId && snap.activeCycleId !== state.appState.activeCycleId) {
        state.appState.activeCycleId = snap.activeCycleId;
      }
      const cid = state.appState.activeCycleId;
      const cycle = state.data.cycles[cid] || (state.data.cycles[cid] = {});
      cycle.tasks = structuredClone(snap.tasks || []);
      cycle.recurringTemplates = structuredClone(snap.recurringTemplates || {});
      if (snap.title) cycle.title = snap.title;
      if ('autoReset' in snap) cycle.autoReset = snap.autoReset;
      if ('deleteCheckedTasks' in snap) cycle.deleteCheckedTasks = snap.deleteCheckedTasks;
    }, true);

    await Promise.resolve();
    refreshUIFromState(window.AppState.get());
    updateUndoRedoButtons();
  } catch (e) {
    console.error('❌ Redo failed:', e);
  } finally {
    window.AppGlobalState.isPerformingUndoRedo = false;
  }
}

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
      if (typeof updateRecurringPanel === 'function') updateRecurringPanel();
      if (typeof updateRecurringPanelButtonVisibility === 'function') updateRecurringPanelButtonVisibility();
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
// ✅ Update button states
function updateUndoRedoButtons() {
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  const undoCount = window.AppGlobalState.undoStack.length;
  const redoCount = window.AppGlobalState.redoStack.length;

  if (undoBtn) {
    undoBtn.disabled = undoCount === 0;
    undoBtn.hidden = (undoCount === 0 && redoCount === 0);
    undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
  }
  if (redoBtn) {
    redoBtn.disabled = redoCount === 0;
    redoBtn.hidden = (redoCount === 0);
    redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
  }
      console.log('🔘 Button states updated:', {
        undoCount: window.AppGlobalState.undoStack.length,
        redoCount: window.AppGlobalState.redoStack.length
    });
}
    










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


// 🔧 Utility Function (can go at top of your scripts)
function generateNotificationId(message) {
    return message
        .replace(/<br\s*\/?>/gi, '\n')   // Convert <br> to newline
        .replace(/<[^>]*>/g, '')         // Remove all HTML tags
        .replace(/\s+/g, ' ')            // Collapse whitespace
        .trim()
        .toLowerCase();                  // Normalize case
}

function generateHashId(message) {
    const text = generateNotificationId(message);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0; // Force 32-bit int
    }
    return `note-${Math.abs(hash)}`;
}

// Make utility functions globally accessible for the notification module
window.generateNotificationId = generateNotificationId;
window.generateHashId = generateHashId;

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
          
          updateRecurringButtonVisibility();
          console.log("✅ Task list UI refreshed from Schema 2.5");
      }


function initializeDefaultRecurringSettings() {
    console.log('🧩 Initializing default recurring settings (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for initializeDefaultRecurringSettings');
        throw new Error('Schema 2.5 data not found');
    }
    
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    
    // Check if default recurring settings exist in Schema 2.5
    if (!fullSchemaData.settings.defaultRecurringSettings || Object.keys(fullSchemaData.settings.defaultRecurringSettings).length === 0) {
        const defaultSettings = {
            frequency: "daily",
            indefinitely: true,
            time: null
        };
        
        fullSchemaData.settings.defaultRecurringSettings = defaultSettings;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
        console.log("🧩 Initialized default recurring settings in Schema 2.5:", defaultSettings);
    } else {
        console.log("ℹ️ Default recurring settings already exist in Schema 2.5.");
    }
}

document.getElementById("toggleAutoReset").addEventListener("change", updateCycleModeDescription);
document.getElementById("deleteCheckedTasks").addEventListener("change", updateCycleModeDescription);
// ...existing code...



// Helper function to get readable mode name (keep this)
function getModeName(mode) {
    const modeNames = {
        'auto-cycle': 'Auto Cycle ↻',
        'manual-cycle': 'Manual Cycle ✔︎↻',
        'todo-mode': 'To-Do Mode ✓'
    };
    
    const result = modeNames[mode] || 'Auto Cycle ↻';
    console.log('📝 Getting mode name:', { input: mode, output: result });
    return result;
}

function initializeModeSelector() {
      if (!window.AppInit?.isReady?.()) {
    // Defer this whole initializer until data-ready (safety net)
    return AppInit.onReady(() => initializeModeSelector());
  }
    console.log('⏰ Initializing mode selector with 200ms delay...');
    setTimeout(() => {
        console.log('⏰ Delay complete, calling setupModeSelector...');
        setupModeSelector();
    }, 200);
}

// ...existing code...
/**
 * Initializes the main menu by attaching event listeners to menu buttons.
 * Ensures the function runs only once to prevent duplicate event bindings.
 */

function setupMainMenu() {
    if (setupMainMenu.hasRun) return; // Prevents running more than once
    setupMainMenu.hasRun = true;

    safeAddEventListener(document.getElementById("save-as-mini-cycle"), "click", saveMiniCycleAsNew);
    safeAddEventListener(document.getElementById("open-mini-cycle"), "click", switchMiniCycle);    
    safeAddEventListener(document.getElementById("clear-mini-cycle-tasks"), "click", clearAllTasks);
    safeAddEventListener(document.getElementById("delete-all-mini-cycle-tasks"), "click", deleteAllTasks);
    safeAddEventListener(document.getElementById("new-mini-cycle"), "click", createNewMiniCycle);
    safeAddEventListener(document.getElementById("close-main-menu"), "click", closeMainMenu);
    checkGamesUnlock();
    safeAddEventListener(exitMiniCycle, "click", () => {
        window.location.href = "../index.html";
    });
    
}

function checkGamesUnlock() {
    console.log('🎮 Checking games unlock (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for checkGamesUnlock');
        return;
    }
    
    const hasGameUnlock = schemaData.settings.unlockedFeatures.includes("task-order-game");
    
    console.log('🔍 Game unlock status:', hasGameUnlock);
    
    if (hasGameUnlock) {
        document.getElementById("games-menu-option").style.display = "block";
        console.log('✅ Games menu option displayed');
    } else {
        console.log('🔒 Games still locked');
    }
}


document.getElementById("open-games-panel").addEventListener("click", () => {
    document.getElementById("games-panel").style.display = "flex";
    setupGamesModalOutsideClick();

});

document.getElementById("close-games-panel").addEventListener("click", () => {
    document.getElementById("games-panel").style.display = "none";
});

document.getElementById("open-task-order-game").addEventListener("click", () => {
    // Load game into container or open in new modal

        window.location.href = "miniCycleGames/miniCycle-taskOrder.html";
   
});
/*
function loadTaskOrderGame() {
    const container = document.getElementById("taskOrderGameContainer");
    if (!container) return;

    fetch("/miniCycleGames/miniCycle-taskOrder.html")
        .then(res => res.text())
        .then(html => {
            container.innerHTML = html;
            container.style.display = "block";
        });
}
*/


function setupGamesModalOutsideClick() {
    const gamesPanel = document.getElementById("games-panel");
    const gamesContent = document.querySelector(".games-modal-content");
    const openButton = document.getElementById("open-games-panel");
  
    if (!gamesPanel || !gamesContent || !openButton) return;
  
    console.log("✅ Games outside click ready");
  
    safeAddEventListener(document, "click", function (event) {
      const isOpen = gamesPanel.style.display === "flex";
      const clickedOutside =
        !gamesContent.contains(event.target) && event.target !== openButton;
  
      if (isOpen && clickedOutside) {
        gamesPanel.style.display = "none";
      }
    });
  }

function closeMainMenu() {
if (menu) { menu.classList.remove("visible");}
}



/**
 * Initializes the miniCycle app by loading or creating a saved miniCycle.
 * Ensures a valid miniCycle is always available in localStorage.
 */
// ✅ UPDATED: Check onboarding first, then handle cycle creation
function initialSetup() {
    console.log('🚀 Initializing app (Schema 2.5 only)...');
    
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
    const hasSeenOnboarding = settings.onboardingCompleted || false;
    
    if (!hasSeenOnboarding) {
        console.log('👋 First time user - showing onboarding first...');
        showOnboardingThenCycleCreation(cycles, activeCycle);
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

// ✅ NEW: Show onboarding, then cycle creation
function showOnboardingThenCycleCreation(cycles, activeCycle) {
    console.log('🎯 Starting onboarding flow first...');
    
    const schemaData = loadMiniCycleData();
    const currentTheme = schemaData.settings.theme || 'default';
    
    const steps = [
        `<h2>Welcome to miniCycle! 🎉</h2>
         <p>miniCycle helps you manage tasks with a powerful task cycling system!</p>`,
        `<ul>
           <li>✅ Add tasks using the input box to create your cycle list.</li>
           <li>🔄 When all tasks are completed, they reset automatically (if Auto-Cycle is enabled)</li>
           <li>📊 Track your progress and unlock themes</li>
         </ul>`,
        `<ul>
           <li>📱 On mobile, long press a task to open the menu</li>
           <li>📱 Long press and move to rearrange tasks</li>
           <li>📱 Swipe Left to access Stats Panel</li>
           <li>📵 Use Settings to show task buttons on older phones</li>
         </ul>`
    ];

    let currentStep = 0;

    const modal = document.createElement("div");
    modal.id = "onboarding-modal";
    modal.className = "onboarding-modal";
    modal.innerHTML = `
        <div class="onboarding-content theme-${currentTheme}">
            <button id="onboarding-skip" class="onboarding-skip">Skip ✖</button>
            <div id="onboarding-step-content"></div>
            <div class="onboarding-controls">
                <button id="onboarding-prev" class="hidden">⬅ Back</button>
                <button id="onboarding-next">Next ➡</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const stepContent = document.getElementById("onboarding-step-content");
    const nextBtn = document.getElementById("onboarding-next");
    const prevBtn = document.getElementById("onboarding-prev");
    const skipBtn = document.getElementById("onboarding-skip");

    function renderStep(index) {
        stepContent.innerHTML = steps[index];
        prevBtn.classList.toggle("hidden", index === 0);
        nextBtn.textContent = index === steps.length - 1 ? "Start 🚀" : "Next ➡";
    }

    function completeOnboardingAndShowCycleCreation() {
        console.log('✅ Onboarding completed, now showing cycle creation...');
        
        // Mark onboarding as complete
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.settings.onboardingCompleted = true;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
        modal.remove();
        
        // ✅ Now check if they need to create a cycle
        if (!activeCycle || !cycles[activeCycle]) {
            setTimeout(() => {
                showCycleCreationModal();
            }, 300); // Small delay for smooth transition
        } else {
            // They already have a cycle, just load it
            const updatedSchemaData = loadMiniCycleData();
            completeInitialSetup(activeCycle, null, updatedSchemaData);
        }
    }

    nextBtn.addEventListener("click", () => {
        if (currentStep < steps.length - 1) {
            currentStep++;
            renderStep(currentStep);
        } else {
            completeOnboardingAndShowCycleCreation();
        }
    });

    prevBtn.addEventListener("click", () => {
        if (currentStep > 0) {
            currentStep--;
            renderStep(currentStep);
        }
    });

    skipBtn.addEventListener("click", () => {
        completeOnboardingAndShowCycleCreation();
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            completeOnboardingAndShowCycleCreation();
        }
    });

    renderStep(currentStep);
}

// ✅ NEW: Extracted cycle creation modal logic
function showCycleCreationModal() {
    console.log('🆕 Showing cycle creation modal...');
    
    setTimeout(() => {
        showPromptModal({
            title: "Create a miniCycle",
            message: "Enter a name to get started:",
            placeholder: "e.g., Morning Routine",
            confirmText: "Create",
            cancelText: "Load Sample",
            callback: async (input) => {
                if (!input || input.trim() === "") {
                    console.log('📥 User chose sample cycle');
                    await preloadGettingStartedCycle();
                    return;
                }
                
                const newCycleName = sanitizeInput(input.trim());
                const cycleId = `cycle_${Date.now()}`;
                
                console.log('🔄 Creating new cycle:', newCycleName);
                
                // Create new cycle in Schema 2.5 format
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                
                fullSchemaData.data.cycles[cycleId] = {
                    id: cycleId,
                    title: newCycleName,
                    tasks: [],
                    autoReset: true,
                    deleteCheckedTasks: false,
                    cycleCount: 0,
                    createdAt: Date.now(),
                    recurringTemplates: {}
                };
                
                fullSchemaData.appState.activeCycleId = cycleId;
                fullSchemaData.metadata.lastModified = Date.now();
                fullSchemaData.metadata.totalCyclesCreated++;
                
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                
                console.log('💾 New cycle saved to Schema 2.5');
                
                // ✅ Complete the setup after user interaction
                completeInitialSetup(cycleId, fullSchemaData);
            }
        });
    }, 500);
}

// ✅ UPDATED: Close modal and complete setup after loading sample
async function preloadGettingStartedCycle() {
    console.log('📥 Preloading getting started cycle (Schema 2.5 only)...');
    
    try {
        const response = await fetch("data/sample-getting-started.mcyc");
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const sample = await response.json();
        
        console.log('📄 Sample data loaded:', {
            title: sample.title || sample.name,
            taskCount: sample.tasks?.length || 0
        });

        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for preloadGettingStartedCycle');
            throw new Error('Schema 2.5 data not found');
        }
        
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        const cycleId = `cycle_${Date.now()}`;
        
        console.log('🔄 Creating sample cycle with ID:', cycleId);
        
        // Create sample cycle in Schema 2.5 format
        fullSchemaData.data.cycles[cycleId] = {
            id: cycleId,
            title: sample.title || sample.name || "Getting Started",
            tasks: sample.tasks || [],
            autoReset: sample.autoReset !== false, // Default to true if not specified
            cycleCount: sample.cycleCount || 0,
            deleteCheckedTasks: sample.deleteCheckedTasks || false,
            createdAt: Date.now(),
            recurringTemplates: {}
        };
        
        fullSchemaData.appState.activeCycleId = cycleId;
        fullSchemaData.metadata.lastModified = Date.now();
        fullSchemaData.metadata.totalCyclesCreated++;
        
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
        console.log('💾 Sample cycle saved to Schema 2.5');
        console.log('📈 Total cycles created:', fullSchemaData.metadata.totalCyclesCreated);
        
        // ✅ CLOSE ANY OPEN MODALS
        const existingModals = document.querySelectorAll('.miniCycle-overlay, .mini-modal-overlay');
        existingModals.forEach(modal => modal.remove());
        
        showNotification("✨ A sample miniCycle has been preloaded to help you get started!", "success", 5000);
        
        // ✅ COMPLETE SETUP AFTER LOADING SAMPLE
        completeInitialSetup(cycleId, fullSchemaData);
        
    } catch (err) {
        console.error('❌ Failed to load sample miniCycle:', err);
        
        // ✅ CLOSE MODAL ON ERROR TOO
        const existingModals = document.querySelectorAll('.miniCycle-overlay, .mini-modal-overlay');
        existingModals.forEach(modal => modal.remove());
        
        showNotification("❌ Failed to load sample miniCycle. Creating a basic cycle instead.", "error");
        
        // ✅ CREATE A BASIC FALLBACK CYCLE
        createBasicFallbackCycle();
    }
}

// ✅ NEW: Create a basic cycle if sample loading fails
function createBasicFallbackCycle() {
    console.log('🆘 Creating basic fallback cycle...');
    
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    const cycleId = `cycle_${Date.now()}`;
    
    fullSchemaData.data.cycles[cycleId] = {
        id: cycleId,
        title: "Getting Started",
        tasks: [
            {
                id: "task-welcome",
                text: "Welcome to miniCycle! 🎉",
                completed: false,
                schemaVersion: 2
            },
            {
                id: "task-guide",
                text: "Add your first task using the input box above ✏️",
                completed: false,
                schemaVersion: 2
            }
        ],
        autoReset: true,
        deleteCheckedTasks: false,
        cycleCount: 0,
        createdAt: Date.now(),
        recurringTemplates: {}
    };
    
    fullSchemaData.appState.activeCycleId = cycleId;
    fullSchemaData.metadata.lastModified = Date.now();
    fullSchemaData.metadata.totalCyclesCreated++;
    
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log('✅ Basic fallback cycle created');
    completeInitialSetup(cycleId, fullSchemaData);
}

// ✅ UPDATED: Simplified showOnboarding for existing users or edge cases
function showOnboarding() {
    console.log('👋 Checking onboarding status (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for showOnboarding');
        return;
    }

    const hasSeenOnboarding = schemaData.settings.onboardingCompleted || false;
    
    if (hasSeenOnboarding) {
        console.log('✅ User has already completed onboarding');
        return;
    }
    
    // ✅ This function is now only called for edge cases
    // Main onboarding flow is handled in initialSetup
    console.log('🎯 Showing standalone onboarding...');
    showOnboardingThenCycleCreation({}, null);
}

// ✅ Keep the same completeInitialSetup and createInitialSchema25Data functions
function completeInitialSetup(activeCycle, fullSchemaData = null, schemaData = null) {
  console.log('✅ Completing initial setup for cycle:', activeCycle);

  // Call the loader only via the global (attached by cycleLoader import)
  console.log('🎯 Loading miniCycle...');
  if (typeof window.loadMiniCycle === 'function') {
    window.loadMiniCycle();
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

function createInitialSchema25Data() {
    const initialData = {
        schemaVersion: "2.5",
        metadata: {
            createdAt: Date.now(),
            lastModified: Date.now(),
            migratedFrom: null,
            migrationDate: null,
            totalCyclesCreated: 0,
            totalTasksCompleted: 0,
            schemaVersion: "2.5"
        },
        settings: {
            theme: 'default',
            darkMode: false,
            alwaysShowRecurring: false,
            autoSave: true,
            showThreeDots: false,
            onboardingCompleted: false,
            dismissedEducationalTips: {},
            defaultRecurringSettings: {
                frequency: "daily",
                indefinitely: true,
                time: null
            },
            unlockedThemes: [],
            unlockedFeatures: [],
            notificationPosition: { x: 0, y: 0 },
            notificationPositionModified: false,
            accessibility: {
                reducedMotion: false,
                highContrast: false,
                screenReaderHints: false
            }
        },
        data: {
            cycles: {} // Empty - user will create their first cycle
        },
        appState: {
            activeCycleId: null, // No active cycle yet
            overdueTaskStates: {} // ✅ Add this for overdue task tracking
        },
        userProgress: {
            cyclesCompleted: 0,
            rewardMilestones: []
        },
        customReminders: {
            enabled: false,
            indefinite: false,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 30,
            frequencyUnit: "minutes"
        }
    };
    
    localStorage.setItem("miniCycleData", JSON.stringify(initialData));
    console.log('✅ Initial Schema 2.5 data created');
}









// Update your existing setupDarkModeToggle function to include quick toggle
function setupDarkModeToggle(toggleId, allToggleIds = []) {
    const thisToggle = document.getElementById(toggleId);
    if (!thisToggle) return;

    console.log('🌙 Setting up dark mode toggle (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for setupDarkModeToggle');
        return;
    }
    
    const isDark = schemaData.settings.darkMode || false;
    
    console.log('📊 Loading dark mode state from Schema 2.5:', isDark);

    // Set initial checked state
    thisToggle.checked = isDark;
    document.body.classList.toggle("dark-mode", isDark);

    // ✅ Update theme color on initial load
    if (typeof updateThemeColor === 'function') {
        updateThemeColor();
    }

    // ✅ Handle quick toggle button initial state
    const quickToggle = document.getElementById("quick-dark-toggle");
    if (quickToggle) {
        quickToggle.textContent = isDark ? "☀️" : "🌙";
    }

    // Event handler
    thisToggle.addEventListener("change", (e) => {
        const enabled = e.target.checked;
        document.body.classList.toggle("dark-mode", enabled);
        
        console.log('🌙 Dark mode toggle changed:', enabled);
        
        // ✅ Save to Schema 2.5 only
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.settings.darkMode = enabled;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
        console.log("✅ Dark mode saved to Schema 2.5:", enabled);

        // ✅ Sync all other toggles
        allToggleIds.forEach(id => {
            const otherToggle = document.getElementById(id);
            if (otherToggle && otherToggle !== thisToggle) {
                otherToggle.checked = enabled;
            }
        });

        // ✅ Update quick toggle icon - GET FRESH REFERENCE
        const currentQuickToggle = document.getElementById("quick-dark-toggle");
        if (currentQuickToggle) {
            currentQuickToggle.textContent = enabled ? "☀️" : "🌙";
        }

        // ✅ Update theme color after dark mode change
        if (typeof updateThemeColor === 'function') {
            updateThemeColor();
        }
    });
    
    console.log('✅ Dark mode toggle setup completed');
}


// setupQuickDarkToggle function
function setupQuickDarkToggle() {
    const quickToggle = document.getElementById("quick-dark-toggle");
    if (!quickToggle) {
        console.warn('⚠️ Quick dark toggle element not found');
        return;
    }
    
    console.log('🌙 Setting up quick dark toggle...');
    
    // ✅ Get current dark mode state BEFORE replacing element
    const schemaData = loadMiniCycleData();
    const isDark = schemaData ? (schemaData.settings.darkMode || false) : false;
    
    // ✅ Remove any existing listeners to prevent duplicates
    const newQuickToggle = quickToggle.cloneNode(true);
    quickToggle.parentNode.replaceChild(newQuickToggle, quickToggle);
    
    // ✅ Set the correct initial icon state on the NEW element
    newQuickToggle.textContent = isDark ? "☀️" : "🌙";
    
    newQuickToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🌙 Quick dark toggle clicked');
        
        // Find the primary dark mode toggle and simulate its change
        const primaryToggle = document.getElementById("darkModeToggle");
        if (primaryToggle) {
            console.log('🔄 Triggering primary toggle, current state:', primaryToggle.checked);
            primaryToggle.checked = !primaryToggle.checked;
            
            // Create and dispatch a proper change event
            const changeEvent = new Event("change", { bubbles: true, cancelable: true });
            primaryToggle.dispatchEvent(changeEvent);
            
            console.log('🔄 Primary toggle new state:', primaryToggle.checked);
        } else {
            console.error('❌ Primary dark mode toggle not found');
        }
    });
    
    console.log('✅ Quick dark toggle setup completed');
}


// ✅ Dynamic Theme Color System with Gradient-Matching Solid Colors
function updateThemeColor() {
    const body = document.body;
    const themeColorMeta = document.getElementById('theme-color-meta');
    const statusBarMeta = document.getElementById('status-bar-style-meta');
    
    let themeColor = '#5680ff'; // Default (matches gradient start)
    let statusBarStyle = 'default';
    
    // ✅ Check for Dark Mode + Themes
    if (body.classList.contains('dark-mode')) {
        if (body.classList.contains('theme-dark-ocean')) {
            themeColor = '#0e1d2f'; // Matches dark ocean gradient
            statusBarStyle = 'black-translucent';
        } else if (body.classList.contains('theme-golden-glow')) {
            themeColor = '#4a3d00'; // Matches dark golden gradient
            statusBarStyle = 'black-translucent';
        } else {
            themeColor = '#1c1c1c'; // Regular dark mode
            statusBarStyle = 'black-translucent';
        }
    } else {
        // ✅ Light Mode Themes
        if (body.classList.contains('theme-dark-ocean')) {
            themeColor = '#0e1d2f'; // Matches light ocean gradient start
            statusBarStyle = 'default';
        } else if (body.classList.contains('theme-golden-glow')) {
            themeColor = '#ffe066'; // Matches light golden gradient start
            statusBarStyle = 'default';
        } else {
            themeColor = '#5680ff'; // Matches default gradient start (#5680ff to #74c0fc)
            statusBarStyle = 'default';
        }
    }
    
    // ✅ Update meta tags
    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', themeColor);
    }
    
    if (statusBarMeta) {
        statusBarMeta.setAttribute('content', statusBarStyle);
    }
    
    console.log(`Theme color updated to: ${themeColor}, Status bar: ${statusBarStyle}`);
}

function applyTheme(themeName) {
    console.log('🎨 Applying theme (Schema 2.5 only)...', themeName);
    
    // Step 1: Remove all theme classes
    const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
    allThemes.forEach(theme => document.body.classList.remove(theme));
  
    // Step 2: Add selected theme class if it's not 'default'
    if (themeName && themeName !== 'default') {
        document.body.classList.add(`theme-${themeName}`);
    }

    // Step 3: Update theme color after applying theme
    if (typeof updateThemeColor === 'function') {
        updateThemeColor();
    }
  
    // Step 4: Save to Schema 2.5 only
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for applyTheme');
        return;
    }
    
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.settings.theme = themeName || 'default';
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log("✅ Theme saved to Schema 2.5:", themeName);
  
    // Step 5: Update UI checkboxes
    document.querySelectorAll('.theme-toggle').forEach(cb => {
        cb.checked = cb.id === `toggle${capitalize(themeName)}Theme`;
    });
    
    console.log('✅ Theme application completed');
}
  
  // Optional helper to format checkbox IDs
  function capitalize(str) {
    return str
      ? str.charAt(0).toUpperCase() + str.slice(1).replace(/-./g, s => s.charAt(1).toUpperCase())
      : '';
  }
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
                document.getElementById("undo-btn").hidden = false;
                document.getElementById("redo-btn").hidden = true;
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
    updateRecurringTemplates(currentCycle, taskData);
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
  updateRecurringTemplates(currentCycle, taskData);
  
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
function updateRecurringTemplates(currentCycle, taskData) {
  if (!currentCycle.recurringTemplates) {
    currentCycle.recurringTemplates = {};
  }

  // Clear existing templates for tasks that are no longer recurring
  const currentTaskIds = new Set(taskData.map(t => t.id));
  Object.keys(currentCycle.recurringTemplates).forEach(templateId => {
    if (!currentTaskIds.has(templateId)) {
      delete currentCycle.recurringTemplates[templateId];
    }
  });

  // Update templates for recurring tasks
  taskData.forEach(task => {
    if (task.recurring && task.recurringSettings) {
      const existingTemplate = currentCycle.recurringTemplates[task.id];
      
      currentCycle.recurringTemplates[task.id] = {
        id: task.id,
        text: task.text,
        recurring: true,
        recurringSettings: structuredClone(task.recurringSettings),
        highPriority: task.highPriority || false,
        dueDate: task.dueDate || null,
        remindersEnabled: task.remindersEnabled || false,
        lastTriggeredTimestamp: existingTemplate?.lastTriggeredTimestamp || null,
        schemaVersion: 2
      };
    }
  });
}

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

function checkOverdueTasks(taskToCheck = null) {
    const tasks = taskToCheck ? [taskToCheck] : document.querySelectorAll(".task");
    let autoReset = toggleAutoReset.checked;

    // ✅ Get overdue states from Schema 2.5 instead of separate localStorage key
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for checkOverdueTasks');
        return;
    }

    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    let overdueTaskStates = fullSchemaData.appState.overdueTaskStates || {};

    // ✅ Track tasks that just became overdue
    let newlyOverdueTasks = [];

    tasks.forEach(task => {
        const taskText = task.querySelector(".task-text").textContent;
        const dueDateInput = task.querySelector(".due-date");
        if (!dueDateInput) return;

        const dueDateValue = dueDateInput.value;
        if (!dueDateValue) {
            // ✅ Date was cleared — remove overdue class
            task.classList.remove("overdue-task");
            delete overdueTaskStates[taskText];
            return;
        }

        const dueDate = new Date(dueDateValue);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate < today) {
            if (!autoReset) {
                if (!overdueTaskStates[taskText]) {
                    newlyOverdueTasks.push(taskText); // ✅ Only notify if it just became overdue
                }
                task.classList.add("overdue-task");
                overdueTaskStates[taskText] = true;
            } else if (overdueTaskStates[taskText]) {
                task.classList.add("overdue-task");
            } else {
                task.classList.remove("overdue-task");
            }
        } else {
            task.classList.remove("overdue-task");
            delete overdueTaskStates[taskText];
        }
    });

    // ✅ Save overdue states back to Schema 2.5
    fullSchemaData.appState.overdueTaskStates = overdueTaskStates;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

    // ✅ Show notification ONLY if there are newly overdue tasks
    if (newlyOverdueTasks.length > 0) {
        showNotification(`⚠️ Overdue Tasks:<br>- ${newlyOverdueTasks.join("<br>- ")}`, "error");
    }
}
















// Add this after your existing migration functions, around line 1100

// ==========================================
// 🔄 SCHEMA 2.5 MIGRATION SYSTEM
// ==========================================

const SCHEMA_2_5_TARGET = {
  schemaVersion: "2.5",
  metadata: {
    createdAt: null,
    lastModified: null,
    migratedFrom: null,
    migrationDate: null,
    totalCyclesCreated: 0,
    totalTasksCompleted: 0,
    schemaVersion: "2.5"
  },
  settings: {
    theme: null,
    darkMode: false,
    alwaysShowRecurring: false,
    autoSave: true,
    defaultRecurringSettings: {
      frequency: null,
      indefinitely: true,
      time: null
    },
    unlockedThemes: [],
    unlockedFeatures: [],
    notificationPosition: { x: 0, y: 0 },
    notificationPositionModified: false,
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      screenReaderHints: false
    }
  },
  data: {
    cycles: {}
  },
  appState: {
    activeCycleId: null
  },
  userProgress: {
    cyclesCompleted: 0,
    rewardMilestones: []
  },
  customReminders: {
    enabled: false,
    indefinite: false,
    dueDatesReminders: false,
    repeatCount: 0,
    frequencyValue: 30,
    frequencyUnit: "minutes"
  }
};

function checkMigrationNeeded() {
  const currentData = localStorage.getItem("miniCycleData");
  if (currentData) {
    const parsed = JSON.parse(currentData);
    if (parsed.schemaVersion === "2.5") {
      return { needed: false, currentVersion: "2.5" };
    }
  }

  // Check for old format data
  const oldCycles = localStorage.getItem("miniCycleStorage");
  const lastUsed = localStorage.getItem("lastUsedMiniCycle");
  const reminders = localStorage.getItem("miniCycleReminders");
  
  const hasOldData = oldCycles || lastUsed || reminders;
  
  return {
    needed: hasOldData,
    currentVersion: currentData ? "unknown" : "legacy",
    oldDataFound: {
      cycles: !!oldCycles,
      lastUsed: !!lastUsed,
      reminders: !!reminders,
      milestones: !!localStorage.getItem("milestoneUnlocks"),
      darkMode: document.body.classList.contains('dark-mode')
    }
  };
}

function simulateMigrationToSchema25(dryRun = true) {
  const results = {
    success: false,
    errors: [],
    warnings: [],
    changes: [],
    dataPreview: null
  };

  try {
    // 1. Gather existing data
    const oldCycles = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
    const lastUsed = localStorage.getItem("lastUsedMiniCycle");
    const reminders = JSON.parse(localStorage.getItem("miniCycleReminders") || "{}");
    const milestones = JSON.parse(localStorage.getItem("milestoneUnlocks") || "{}");
    const moveArrows = localStorage.getItem("miniCycleMoveArrows") === "true";
    const threeDots = localStorage.getItem("miniCycleThreeDots") === "true";
    const alwaysRecurring = JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring")) || false;
    const darkModeEnabled = localStorage.getItem("darkModeEnabled") === "true";
    const currentTheme = localStorage.getItem("currentTheme") || null;
    const notifPosition = JSON.parse(localStorage.getItem("miniCycleNotificationPosition") || "{}");

    // 2. Create new schema structure
    const newData = JSON.parse(JSON.stringify(SCHEMA_2_5_TARGET));
    
    // 3. Populate metadata
    newData.metadata.createdAt = Date.now();
    newData.metadata.lastModified = Date.now();
    newData.metadata.migratedFrom = "legacy";
    newData.metadata.migrationDate = Date.now();
    newData.metadata.totalCyclesCreated = Object.keys(oldCycles).length;
    
    // Calculate total completed tasks
    let totalCompleted = 0;
    Object.values(oldCycles).forEach(cycle => {
      totalCompleted += cycle.cycleCount || 0;
    });
    newData.metadata.totalTasksCompleted = totalCompleted;

    // 4. Populate settings
    newData.settings.theme = currentTheme;
    newData.settings.darkMode = darkModeEnabled;
    newData.settings.alwaysShowRecurring = alwaysRecurring;
    
    // Unlocked themes from milestones
    if (milestones.darkOcean) newData.settings.unlockedThemes.push("dark-ocean");
    if (milestones.goldenGlow) newData.settings.unlockedThemes.push("golden-glow");
    if (milestones.taskOrderGame) newData.settings.unlockedFeatures.push("task-order-game");

    // Notification position
    if (notifPosition.x || notifPosition.y) {
      newData.settings.notificationPosition = notifPosition;
      newData.settings.notificationPositionModified = true;
    }

    // 5. Migrate cycles
    newData.data.cycles = oldCycles;
    newData.appState.activeCycleId = lastUsed;

    // 6. Migrate reminders
    newData.customReminders = {
      enabled: reminders.enabled || false,
      indefinite: reminders.indefinite || false,
      dueDatesReminders: reminders.dueDatesReminders || false,
      repeatCount: reminders.repeatCount || 0,
      frequencyValue: reminders.frequencyValue || 30,
      frequencyUnit: reminders.frequencyUnit || "minutes"
    };

    // 7. User progress
    newData.userProgress.cyclesCompleted = totalCompleted;
    if (milestones.darkOcean) newData.userProgress.rewardMilestones.push("dark-ocean-5");
    if (milestones.goldenGlow) newData.userProgress.rewardMilestones.push("golden-glow-50");

    results.changes.push(`✅ Found ${Object.keys(oldCycles).length} cycles to migrate`);
    results.changes.push(`✅ Active cycle: ${lastUsed || "none"}`);
    results.changes.push(`✅ Total completed cycles: ${totalCompleted}`);
    results.changes.push(`✅ Reminders enabled: ${reminders.enabled ? "yes" : "no"}`);
    results.changes.push(`✅ Themes unlocked: ${newData.settings.unlockedThemes.length}`);
    
    if (!dryRun) {
      // Actually perform migration
      localStorage.setItem("miniCycleData", JSON.stringify(newData));
      results.changes.push("🚀 Migration completed - data saved to miniCycleData");
      
      // Optionally backup old data
      const backupKey = `migration_backup_${Date.now()}`;
      const oldData = {
        miniCycleStorage: oldCycles,
        lastUsedMiniCycle: lastUsed,
        miniCycleReminders: reminders,
        milestoneUnlocks: milestones,
        darkModeEnabled: darkModeEnabled,
        currentTheme: currentTheme
      };
      localStorage.setItem(backupKey, JSON.stringify(oldData));
      results.changes.push(`💾 Old data backed up to ${backupKey}`);
    }

    results.dataPreview = newData;
    results.success = true;

  } catch (error) {
    results.errors.push(`Migration failed: ${error.message}`);
  }

  return results;
}

function performSchema25Migration() {
  // Create backup first
  const backupKey = `pre_migration_backup_${Date.now()}`;
  const currentData = {};
  
  // Backup all current localStorage
  ["miniCycleStorage", "lastUsedMiniCycle", "miniCycleReminders", 
   "milestoneUnlocks", "darkModeEnabled", "currentTheme", 
   "miniCycleNotificationPosition", "miniCycleAlwaysShowRecurring"].forEach(key => {
    const value = localStorage.getItem(key);
    if (value) currentData[key] = value;
  });
  
  localStorage.setItem(backupKey, JSON.stringify(currentData));

  // Perform actual migration
  const results = simulateMigrationToSchema25(false);
  
  if (results.success) {
    // Clean up old keys (optional - you might want to keep them temporarily)
    // Object.keys(currentData).forEach(key => localStorage.removeItem(key));
    results.changes.push(`🗂️ Backup created: ${backupKey}`);
  }

  return results;
}



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
        }
    }
    
    // ✅ CREATE INITIAL DATA IF NONE EXISTS
    console.log('🆕 Creating initial Schema 2.5 structure...');
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





// ✅ Auto-Migration with Enhanced Data Fixing and Lenient Validation
async function performAutoMigration(options = {}) {
    const { 
        forceMode = false, 
        skipValidation = false, 
        skipBackup = false 
    } = options;
    
    try {
        console.log('🔄 Starting auto-migration process…', {
            forceMode,
            skipValidation,
            skipBackup
        });
        
        // ✅ FORCE MODE: Skip all safety checks
        if (forceMode) {
            console.log('🚨 FORCE MODE ACTIVE - Bypassing all safety checks');
            
            if (!skipBackup) {
                const backupResult = await createAutomaticMigrationBackup();
                console.log('💾 Emergency backup created:', backupResult.backupKey);
            }
            
            // ✅ Apply fixes without validation
            const fixResult = fixTaskValidationIssues();
            console.log('🔧 Applied fixes:', fixResult);
            
            // ✅ Force the migration
            const migrationResult = performSchema25Migration();
            
            if (migrationResult.success || migrationResult.partialSuccess) {
                showNotification('✅ Force migration completed! Some data may need manual review.', 'success', 6000);
                return {
                    success: true,
                    forced: true,
                    message: 'Force migration completed',
                    warnings: migrationResult.warnings || []
                };
            } else {
                // Even force mode failed - create minimal Schema 2.5 structure
                return createMinimalSchema25();
            }
        }
    console.log('📊 Current localStorage keys:', Object.keys(localStorage));
    
    // Step 1: Check if migration is needed
    console.log('🔍 Checking if migration is needed...');
    const migrationCheck = checkMigrationNeeded();
    console.log('📋 Migration check result:', migrationCheck);
    
    if (!migrationCheck.needed) {
        console.log('✅ No migration needed - user already on Schema 2.5');
        console.log('📦 Current miniCycleData exists:', !!localStorage.getItem("miniCycleData"));
        return { success: true, message: 'Already on latest schema' };
    }
    
    console.log('🚨 Migration needed. Old data found:', migrationCheck.oldDataFound);
    
    // Step 2: Show user notification
    console.log('📢 Showing migration notification to user...');
    showNotification('🔄 Updating your data format... This will take a moment.', 'info', 200);
    
    // Step 3: Create automatic backup before migration
    console.log('📥 Creating automatic backup before migration...');
    console.log('💾 Available storage before backup:', {
        used: JSON.stringify(localStorage).length,
        limit: '~5-10MB (browser dependent)'
    });
    
    const backupResult = await createAutomaticMigrationBackup();
    console.log('💾 Backup result:', backupResult);
    
    if (!backupResult.success) {
        console.error('❌ Backup creation failed:', backupResult.message);
        console.error('🔧 Troubleshooting: Check storage space and localStorage accessibility');
        return await handleMigrationFailure('Backup creation failed', null);
    }
    
    console.log('✅ Backup created successfully:', {
        backupKey: backupResult.backupKey,
        size: backupResult.size,
        sizeKB: Math.round(backupResult.size / 1024)
    });

    // Step 3.5: ✅ ENHANCED - Pre-fix data validation issues with detailed reporting
    console.log('🔧 Pre-fixing known data validation issues...');
    const fixResult = fixTaskValidationIssues();
    console.log('🔧 Data fix result:', fixResult);
    
    if (fixResult.success && fixResult.fixedCount > 0) {
        console.log(`✅ Successfully fixed ${fixResult.fixedCount} data issues:`);
        fixResult.details?.forEach(detail => console.log(`   - ${detail}`));
        showNotification(`🔧 Fixed ${fixResult.fixedCount} data compatibility issues`, 'info', 3000);
    } else if (!fixResult.success) {
        console.warn('⚠️ Data fixing encountered issues, but continuing with migration');
        console.warn('🔧 Fix error:', fixResult.message);
    } else {
        console.log('✅ No data fixes needed - all data is already compatible');
    }
    
    // Step 4: ✅ ENHANCED - Use lenient validation for auto-migration
    console.log('🔍 Performing lenient validation for auto-migration...');
    console.log('📋 Using lenient validation approach for better migration success...');
    
    // ✅ Use lenient validation instead of strict validation
    const legacyValidationResults = validateAllMiniCycleTasksLenient();
    console.log('📊 Lenient validation results:', legacyValidationResults);
    
    if (legacyValidationResults.length > 0) {
        console.error('❌ Critical data issues found even after fixes:', legacyValidationResults);
        console.error('🔧 These are fundamental problems that prevent migration:');
        legacyValidationResults.forEach((error, index) => {
            console.error(`   ${index + 1}. ${JSON.stringify(error, null, 2)}`);
        });
        
        // ✅ Show user-friendly message about what went wrong
        const errorSummary = legacyValidationResults.length === 1 
            ? `1 critical issue: ${legacyValidationResults[0].errors?.[0] || 'Unknown error'}`
            : `${legacyValidationResults.length} critical issues found`;
            
        return await handleMigrationFailure(`Data validation failed: ${errorSummary}`, backupResult.backupKey);
    }
    
    console.log('✅ Lenient validation passed - data is ready for migration');
    
    // Step 5: Perform the actual migration using your existing function
    console.log('🔄 Performing Schema 2.5 migration...');
    console.log('📦 Calling performSchema25Migration()...');
    
    const migrationResult = performSchema25Migration();
    console.log('🔄 Migration process result:', migrationResult);
    
    if (!migrationResult.success) {
        console.error('❌ Migration failed:', migrationResult.errors || migrationResult);
        console.error('🔧 Troubleshooting: Check performSchema25Migration() function');
        if (migrationResult.errors) {
            migrationResult.errors.forEach((error, index) => {
                console.error(`   Error ${index + 1}:`, error);
            });
        }
        return await handleMigrationFailure('Migration process failed', backupResult.backupKey);
    }
    
    console.log('✅ Migration process completed successfully');
    console.log('📋 Changes applied:', migrationResult.changes || 'No changes array provided');
    
    // Step 6: ✅ Simple post-migration validation
    console.log('✅ Validating migrated data...');
    const newSchemaData = localStorage.getItem("miniCycleData");
    console.log('📦 New schema data exists:', !!newSchemaData);
    console.log('📏 New schema data size:', newSchemaData ? newSchemaData.length : 0);
    
    if (!newSchemaData) {
        console.error('❌ Post-migration validation failed: No Schema 2.5 data found');
        console.error('🔧 Troubleshooting: Migration did not create miniCycleData key');
        console.error('📊 Current localStorage keys after migration:', Object.keys(localStorage));
        return await handleMigrationFailure('Migration validation failed - no new data found', backupResult.backupKey);
    }
    
    try {
        console.log('🔍 Parsing and validating new schema structure...');
        const parsed = JSON.parse(newSchemaData);
        console.log('📊 Parsed schema structure:', {
            schemaVersion: parsed.schemaVersion,
            hasMetadata: !!parsed.metadata,
            hasData: !!parsed.data,
            hasCycles: !!parsed.data?.cycles,
            cycleCount: parsed.data?.cycles ? Object.keys(parsed.data.cycles).length : 0,
            hasAppState: !!parsed.appState,
            activeCycleId: parsed.appState?.activeCycleId
        });
        
        if (!parsed.schemaVersion || parsed.schemaVersion !== '2.5') {
            throw new Error(`Schema version missing or incorrect: ${parsed.schemaVersion}`);
        }
        if (!parsed.data || !parsed.data.cycles) {
            throw new Error('Missing cycles data structure');
        }
        
        console.log('✅ Post-migration validation passed');
        console.log('🎯 Final data structure validated successfully');
        
    } catch (validationError) {
        console.error('❌ Post-migration validation failed:', validationError.message);
        console.error('🔧 Troubleshooting: Schema structure is invalid');
        console.error('📋 Raw data snippet:', newSchemaData.substring(0, 500) + '...');
        return await handleMigrationFailure('Migration validation failed', backupResult.backupKey);
    }
    
    // Step 7: Success!
    console.log('✅ Auto-migration completed successfully');
    console.log('🎉 Migration summary:', {
        backupKey: backupResult.backupKey,
        migrationChanges: migrationResult.changes?.length || 0,
        finalDataSize: newSchemaData.length,
        dataFixesApplied: fixResult.fixedCount || 0,
        timestamp: new Date().toISOString()
    });

    // ✅ Clean up old separate localStorage keys
console.log('🧹 Cleaning up legacy localStorage keys...');
localStorage.removeItem("overdueTaskStates"); // Clean up old separate key
console.log('✅ Removed old overdueTaskStates key');
    
    // ✅ Enhanced success notification with fix details
    const successMessage = fixResult.fixedCount > 0 
        ? `✅ Data updated successfully! Fixed ${fixResult.fixedCount} compatibility issues.`
        : '✅ Data format updated successfully!';
    showNotification(successMessage, 'success', 4000);
    
    // Step 8: Store migration completion info
    const legacyData = localStorage.getItem('miniCycleStorage') || '{}';
    const migrationInfo = {
        completed: Date.now(),
        backupKey: backupResult.backupKey,
        version: '2.5',
        autoMigrated: true,
        dataFixesApplied: fixResult.fixedCount || 0,
        migrationSummary: {
            originalDataSize: legacyData.length,
            newDataSize: newSchemaData.length,
            changesApplied: migrationResult.changes?.length || 0,
            fixesApplied: fixResult.details || []
        }
    };
    
    console.log('💾 Storing migration completion info:', migrationInfo);
    localStorage.setItem('miniCycleMigrationInfo', JSON.stringify(migrationInfo));
    
    return {
        success: true,
        message: 'Auto-migration completed successfully',
        backupKey: backupResult.backupKey,
        fixesApplied: fixResult.fixedCount || 0
    };
    
 } catch (error) {
        if (forceMode) {
            console.warn('⚠️ Force migration failed, creating minimal schema');
            return createMinimalSchema25();
        }
        return await handleMigrationFailure(`Unexpected error: ${error.message}`, null);
    }
}

// ✅ NEW: Create minimal working Schema 2.5 if everything else fails
function createMinimalSchema25() {
    console.log('🆘 Creating minimal Schema 2.5 structure as last resort');
    
    const minimalData = {
        schemaVersion: "2.5",
        metadata: {
            createdAt: Date.now(),
            lastModified: Date.now(),
            migratedFrom: "force_migration",
            migrationDate: Date.now(),
            totalCyclesCreated: 1,
            totalTasksCompleted: 0,
            schemaVersion: "2.5"
        },
        settings: {
            theme: null,
            darkMode: false,
            alwaysShowRecurring: false,
            autoSave: true,
            defaultRecurringSettings: { time: null },
            unlockedThemes: [],
            unlockedFeatures: [],
            notificationPosition: { x: 0, y: 0 },
            notificationPositionModified: false
        },
        data: {
            cycles: {
                "Default Cycle": {
                    id: "default_cycle",
                    title: "Default Cycle",
                    tasks: [],
                    autoReset: true,
                    deleteCheckedTasks: false,
                    cycleCount: 0,
                    createdAt: Date.now(),
                    recurringTemplates: {}
                }
            }
        },
        appState: {
            activeCycleId: "Default Cycle"
        },
        userProgress: {
            rewardMilestones: []
        },
        customReminders: {
            enabled: false,
            indefinite: false,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 30,
            frequencyUnit: "minutes"
        }
    };
    
    localStorage.setItem("miniCycleData", JSON.stringify(minimalData));
    
    showNotification('⚠️ Created fresh miniCycle. Previous data may have been incompatible.', 'warning', 8000);
    
    return {
        success: true,
        forced: true,
        minimal: true,
        message: 'Created minimal Schema 2.5 structure'
    };
}

// ✅ ADD: Lenient validation function for auto-migration
function validateAllMiniCycleTasksLenient() {
  const storage = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  const results = [];

  for (const [cycleName, cycleData] of Object.entries(storage)) {
    if (!Array.isArray(cycleData.tasks)) continue;

    cycleData.tasks.forEach(task => {
      const criticalErrors = [];
      
      // ✅ Only check for critical errors that would break migration
      if (!task.text && !task.taskText) {
        criticalErrors.push("Task has no text content");
      }
      
      if (!task.id) {
        criticalErrors.push("Task missing unique ID");
      }
      
      // ✅ Check for completely malformed recurring settings (not just missing properties)
      if (task.recurring && task.recurringSettings && typeof task.recurringSettings !== 'object') {
        criticalErrors.push("Recurring settings is not a valid object");
      }
      
      // ✅ Only report tasks with critical issues
      if (criticalErrors.length > 0) {
        results.push({
          cycle: cycleName,
          taskText: task.text || task.taskText || "(no text)",
          id: task.id || "(no id)",
          errors: criticalErrors
        });
      }
    });
  }

  return results;
}


// ✅ Handle Migration Failure with Legacy Data Fallback
async function handleMigrationFailure(reason, backupKey) {
try {
console.log('🔄 Handling migration failure, attempting to maintain legacy data access…');
console.log('❌ Failure reason:', reason);
console.log('📦 Backup key available:', backupKey);

    // Step 1: Try to restore from backup if available
    if (backupKey) {
        console.log('📥 Attempting to restore from backup:', backupKey);
        console.log('🔍 Checking if backup exists in localStorage...');
        const backupExists = !!localStorage.getItem(backupKey);
        console.log('💾 Backup exists:', backupExists);
        
        try {
            await restoreFromAutomaticBackup(backupKey);
            console.log('✅ Successfully restored from backup');
            console.log('📊 Post-restore localStorage keys:', Object.keys(localStorage));
        } catch (restoreError) {
            console.error('❌ Failed to restore from backup:', restoreError);
            console.error('🔧 Restore error details:', restoreError.message);
            console.error('📋 Continuing with fallback strategy...');
            // Continue with fallback - don't fail here
        }
    } else {
        console.log('⚠️ No backup key provided, skipping restore attempt');
    }
    
    // Step 2: Ensure legacy data is accessible
    console.log('🔍 Checking legacy data accessibility...');
    const legacyDataExists = ensureLegacyDataAccess();
    console.log('📦 Legacy data accessible:', legacyDataExists);
    
    if (legacyDataExists) {
        console.log('✅ Legacy data found and accessible');
        
        // Step 3: Set session flag to use legacy mode until reload
        console.log('🚩 Setting legacy fallback mode flags...');
        sessionStorage.setItem('miniCycleLegacyModeActive', 'true');
        sessionStorage.setItem('miniCycleMigrationFailureReason', reason);
        
        console.log('📊 Session storage flags set:', {
            legacyMode: sessionStorage.getItem('miniCycleLegacyModeActive'),
            failureReason: sessionStorage.getItem('miniCycleMigrationFailureReason')
        });
        
        // Step 4: Show user-friendly notification
        showNotification(
            '⚠️ Unable to update data format. Using existing data until next app reload. Your data is safe!', 
            'warning', 
            8000
        );
        
        console.log('✅ Fallback to legacy data successful');
        
        return {
            success: false,
            fallbackActive: true,
            message: 'Migration failed but legacy data access maintained',
            reason: reason
        };
    } else {
        // Step 5: Last resort - critical error
        console.error('❌ No legacy data available for fallback');
        console.error('🚨 CRITICAL: Complete data loss scenario');
        console.error('📊 Final localStorage state:', Object.keys(localStorage));
        console.error('💾 Available data sources:', {
            miniCycleStorage: !!localStorage.getItem('miniCycleStorage'),
            miniCycleData: !!localStorage.getItem('miniCycleData'),
            lastUsedMiniCycle: !!localStorage.getItem('lastUsedMiniCycle'),
            anyBackups: Object.keys(localStorage).filter(key => key.includes('backup')),
        });
        
        showCriticalError('Unable to access your data. Please contact support or try refreshing the page.');
        
        return {
            success: false,
            fallbackActive: false,
            message: 'Migration failed and no legacy data available',
            reason: reason
        };
    }
    
} catch (error) {
    console.error('❌ Failed to handle migration failure:', error);
    console.error('🔧 Handler error stack:', error.stack);
    console.error('🚨 CRITICAL: Migration failure handler itself failed');
    showCriticalError('Critical error occurred. Please refresh the page.');
    
    return {
        success: false,
        fallbackActive: false,
        message: 'Failed to handle migration failure',
        reason: `${reason} + ${error.message}`
    };
}
}

// ✅ Ensure Legacy Data is Accessible
function ensureLegacyDataAccess() {
try {
console.log('🔍 Checking legacy data access...');

// Check if legacy data exists
const legacyStorage = localStorage.getItem('miniCycleStorage');
console.log('📦 Legacy storage exists:', !!legacyStorage);
console.log('📏 Legacy storage size:', legacyStorage ? legacyStorage.length : 0);

    if (!legacyStorage) {
        console.error('❌ No legacy data found in localStorage');
        console.error('📋 Available localStorage keys:', Object.keys(localStorage));
        return false;
    }
    
    // Try to parse the legacy data to ensure it's valid
    try {
        console.log('🔍 Attempting to parse legacy data...');
        const parsedData = JSON.parse(legacyStorage);
        console.log('📊 Parsed legacy data structure:', {
            type: typeof parsedData,
            isObject: typeof parsedData === 'object',
            isNull: parsedData === null,
            keys: typeof parsedData === 'object' && parsedData !== null ? Object.keys(parsedData) : 'N/A',
            cycleCount: typeof parsedData === 'object' && parsedData !== null ? Object.keys(parsedData).length : 0
        });
        
        if (typeof parsedData === 'object' && parsedData !== null) {
            console.log('✅ Legacy data is accessible and valid');
            
            // Additional validation
            const cycleKeys = Object.keys(parsedData);
            console.log('📋 Available legacy cycles:', cycleKeys);
            
            if (cycleKeys.length > 0) {
                const firstCycle = parsedData[cycleKeys[0]];
                console.log('📊 First cycle structure:', {
                    hasTasks: !!firstCycle.tasks,
                    taskCount: Array.isArray(firstCycle.tasks) ? firstCycle.tasks.length : 'Not array',
                    hasTitle: !!firstCycle.title,
                    hasAutoReset: 'autoReset' in firstCycle
                });
            }
            
            return true;
        } else {
            console.error('❌ Legacy data is not a valid object');
            console.error('📋 Actual data type:', typeof parsedData);
            console.error('📋 Data content preview:', JSON.stringify(parsedData).substring(0, 200));
            return false;
        }
    } catch (parseError) {
        console.error('❌ Legacy data is corrupted:', parseError);
        console.error('🔧 Parse error details:', parseError.message);
        console.error('📋 Raw data preview:', legacyStorage.substring(0, 200) + '...');
        return false;
    }
    
} catch (error) {
    console.error('❌ Error checking legacy data access:', error);
    console.error('🔧 Access check error:', error.message);
    return false;
}
}

// ✅ Check if App is Running in Legacy Fallback Mode
function isLegacyFallbackModeActive() {
const isActive = sessionStorage.getItem('miniCycleLegacyModeActive') === 'true';
console.log('🚩 Legacy fallback mode check:', {
    isActive: isActive,
    sessionFlag: sessionStorage.getItem('miniCycleLegacyModeActive'),
    failureReason: sessionStorage.getItem('miniCycleMigrationFailureReason')
});
return isActive;
}
// ✅ Fixed createAutomaticMigrationBackup function
async function createAutomaticMigrationBackup() {
try {
console.log('📥 Starting automatic backup creation...');
const timestamp = Date.now();
const backupKey = `auto_migration_backup_${timestamp}`;
console.log('🏷️ Generated backup key:', backupKey);

    // Check if we have data to backup
    console.log('🔍 Checking for legacy data to backup...');
    const legacyData = localStorage.getItem('miniCycleStorage');
    console.log('📦 Legacy data found:', !!legacyData);
    console.log('📏 Legacy data size:', legacyData ? legacyData.length : 0);
    
    if (!legacyData) {
        console.error('❌ No legacy data found to backup');
        console.error('📋 Available localStorage keys:', Object.keys(localStorage));
        throw new Error('No legacy data found to backup');
    }
    
    // Gather all data to backup - FIXED STORAGE KEYS
    console.log('📋 Gathering additional data for backup...');
    const remindersData = localStorage.getItem('miniCycleReminders');
    const lastUsed = localStorage.getItem('lastUsedMiniCycle');
    const milestones = localStorage.getItem('milestoneUnlocks');
    console.log('🔔 Reminders data:', !!remindersData);
    console.log('📌 Last used cycle:', !!lastUsed);
    console.log('🏆 Milestones:', !!milestones);
    
    const settingsData = {
        threeDots: localStorage.getItem('miniCycleThreeDots'),
        darkMode: localStorage.getItem('darkModeEnabled'), // ✅ FIXED
        moveArrows: localStorage.getItem('miniCycleMoveArrows'),
        alwaysShowRecurring: localStorage.getItem('miniCycleAlwaysShowRecurring'),
        defaultRecurring: localStorage.getItem('miniCycleDefaultRecurring'),
        theme: localStorage.getItem('currentTheme'), // ✅ FIXED
        onboarding: localStorage.getItem('miniCycleOnboarding'),
        notificationPosition: localStorage.getItem('miniCycleNotificationPosition')
    };
    
    console.log('⚙️ Settings data collected:', Object.keys(settingsData).filter(key => settingsData[key] !== null));
    
    const backupData = {
        version: 'legacy',
        created: timestamp,
        type: 'auto_migration_backup',
        data: {
            miniCycleStorage: legacyData,
            lastUsedMiniCycle: lastUsed, // ✅ ADDED
            miniCycleReminders: remindersData,
            milestoneUnlocks: milestones, // ✅ ADDED
            settings: settingsData
        },
        metadata: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            migrationReason: 'Automatic migration to Schema 2.5'
        }
    };
    
    const backupSize = JSON.stringify(backupData).length;
    console.log('📊 Backup data prepared:', {
        totalSize: backupSize,
        totalSizeKB: Math.round(backupSize / 1024),
        legacyDataSize: legacyData.length,
        remindersSize: remindersData ? remindersData.length : 0,
        lastUsedSize: lastUsed ? lastUsed.length : 0,
        milestonesSize: milestones ? milestones.length : 0,
        settingsCount: Object.keys(settingsData).filter(key => settingsData[key] !== null).length
    });
    
    // Rest of the function remains the same...
    try {
        console.log('💾 Attempting to store backup in localStorage...');
        localStorage.setItem(backupKey, JSON.stringify(backupData));
        console.log('✅ Backup stored successfully');
    } catch (storageError) {
        console.error('❌ Storage error during backup:', storageError);
        console.error('🔧 Storage error details:', storageError.message);
        console.error('📊 Storage usage info:', {
            backupSize: backupSize,
            estimatedTotalStorage: JSON.stringify(localStorage).length,
            availableKeys: Object.keys(localStorage).length
        });
        throw new Error('Insufficient storage space for backup');
    }
    
    // Add to backup index for management
    try {
        console.log('📋 Updating backup index...');
        const backupIndex = JSON.parse(localStorage.getItem('miniCycleBackupIndex') || '[]');
        console.log('📊 Current backup index size:', backupIndex.length);
        
        backupIndex.push({
            key: backupKey,
            created: timestamp,
            type: 'auto_migration',
            size: JSON.stringify(backupData).length
        });
        
        // Keep only last 5 automatic backups to prevent storage bloat
        const autoBackups = backupIndex.filter(b => b.type === 'auto_migration');
        console.log('🗂️ Auto backup count:', autoBackups.length);
        
        if (autoBackups.length > 5) {
            console.log('🧹 Cleaning up old backups...');
            const oldestAutoBackup = autoBackups.sort((a, b) => a.created - b.created)[0];
            console.log('🗑️ Removing oldest backup:', oldestAutoBackup.key);
            
            try {
                localStorage.removeItem(oldestAutoBackup.key);
                const index = backupIndex.findIndex(b => b.key === oldestAutoBackup.key);
                backupIndex.splice(index, 1);
                console.log('✅ Old backup cleaned up successfully');
            } catch (cleanupError) {
                console.warn('⚠️ Failed to cleanup old backup:', cleanupError);
                console.warn('🔧 Cleanup error details:', cleanupError.message);
                // Continue anyway - this isn't critical
            }
        }
        
        localStorage.setItem('miniCycleBackupIndex', JSON.stringify(backupIndex));
        console.log('✅ Backup index updated successfully');
        
    } catch (indexError) {
        console.warn('⚠️ Failed to update backup index:', indexError);
        console.warn('🔧 Index error details:', indexError.message);
        // Continue anyway - backup was created successfully
    }
    
    console.log('✅ Automatic backup created successfully:', backupKey);
    return {
        success: true,
        backupKey: backupKey,
        size: JSON.stringify(backupData).length
    };
    
} catch (error) {
    console.error('❌ Failed to create automatic backup:', error);
    console.error('🔧 Backup creation error:', error.message);
    console.error('📊 System state at backup failure:', {
        localStorage: Object.keys(localStorage),
        storageEstimate: JSON.stringify(localStorage).length
    });
    return {
        success: false,
        message: error.message
    };
}
}

// ✅ Also update the restore function
async function restoreFromAutomaticBackup(backupKey) {
try {
console.log('🔄 Restoring from automatic backup:', backupKey);

    console.log('🔍 Checking if backup exists...');
    const backupData = localStorage.getItem(backupKey);
    console.log('📦 Backup data found:', !!backupData);
    console.log('📏 Backup data size:', backupData ? backupData.length : 0);
    
    if (!backupData) {
        console.error('❌ Backup not found in localStorage');
        console.error('📋 Available backup keys:', Object.keys(localStorage).filter(key => key.includes('backup')));
        throw new Error('Backup not found');
    }
    
    let backup;
    try {
        console.log('🔍 Parsing backup data...');
        backup = JSON.parse(backupData);
        console.log('📊 Backup structure:', {
            version: backup.version,
            type: backup.type,
            created: new Date(backup.created).toISOString(),
            hasData: !!backup.data,
            hasMetadata: !!backup.metadata
        });
    } catch (parseError) {
        console.error('❌ Backup data is corrupted:', parseError);
        console.error('🔧 Parse error details:', parseError.message);
        console.error('📋 Raw backup preview:', backupData.substring(0, 200) + '...');
        throw new Error('Backup data is corrupted');
    }
    
    // Restore legacy data
    if (backup.data.miniCycleStorage) {
        console.log('📦 Restoring miniCycleStorage...');
        localStorage.setItem('miniCycleStorage', backup.data.miniCycleStorage);
        console.log('✅ miniCycleStorage restored');
    } else {
        console.warn('⚠️ No miniCycleStorage found in backup');
    }
    
    // ✅ RESTORE LAST USED CYCLE
    if (backup.data.lastUsedMiniCycle) {
        console.log('📌 Restoring lastUsedMiniCycle...');
        localStorage.setItem('lastUsedMiniCycle', backup.data.lastUsedMiniCycle);
        console.log('✅ lastUsedMiniCycle restored');
    }
    
    if (backup.data.miniCycleReminders) {
        console.log('🔔 Restoring miniCycleReminders...');
        localStorage.setItem('miniCycleReminders', backup.data.miniCycleReminders);
        console.log('✅ miniCycleReminders restored');
    } else {
        console.warn('⚠️ No miniCycleReminders found in backup');
    }
    
    // ✅ RESTORE MILESTONES
    if (backup.data.milestoneUnlocks) {
        console.log('🏆 Restoring milestoneUnlocks...');
        localStorage.setItem('milestoneUnlocks', backup.data.milestoneUnlocks);
        console.log('✅ milestoneUnlocks restored');
    }
    
    // Restore settings - FIXED KEYS
    if (backup.data.settings) {
        console.log('⚙️ Restoring settings...');
        const settings = backup.data.settings;
        const settingsRestored = [];
        
        Object.keys(settings).forEach(key => {
            if (settings[key] !== null && settings[key] !== undefined) {
                try {
                    // ✅ FIXED: Use correct storage keys
                    let storageKey;
                    switch(key) {
                        case 'darkMode':
                            storageKey = 'darkModeEnabled';
                            break;
                        case 'theme':
                            storageKey = 'currentTheme';
                            break;
                        default:
                            storageKey = `miniCycle${key.charAt(0).toUpperCase() + key.slice(1)}`;
                    }
                    
                    localStorage.setItem(storageKey, settings[key]);
                    settingsRestored.push(key);
                    console.log(`   ✅ Restored setting: ${key} -> ${storageKey}`);
                } catch (settingError) {
                    console.warn(`⚠️ Failed to restore setting ${key}:`, settingError);
                    // Continue with other settings
                }
            }
        });
        
        console.log('✅ Settings restoration complete:', settingsRestored);
    } else {
        console.warn('⚠️ No settings found in backup');
    }
    
    // Remove any Schema 2.5 data that might have been created
    try {
        console.log('🧹 Cleaning up any Schema 2.5 data...');
        const schema25Existed = !!localStorage.getItem('miniCycleData');
        localStorage.removeItem('miniCycleData');
        console.log('🧹 Schema 2.5 data cleanup:', schema25Existed ? 'removed' : 'none found');
    } catch (removeError) {
        console.warn('⚠️ Failed to remove Schema 2.5 data:', removeError);
        // Continue anyway
    }
    
    console.log('✅ Data restored from automatic backup successfully');
    console.log('📊 Post-restore localStorage keys:', Object.keys(localStorage));
    
    return { success: true };
    
} catch (error) {
    console.error('❌ Failed to restore from automatic backup:', error);
    console.error('🔧 Restore error stack:', error.stack);
    console.error('📊 System state at restore failure:', {
        backupKey: backupKey,
        backupExists: !!localStorage.getItem(backupKey),
        currentKeys: Object.keys(localStorage)
    });
    throw error;
}
}

// ✅ Initialize App with Auto-Migration and Fallback Support
function initializeAppWithAutoMigration(options = {}) {
console.log('🚀 Initializing app with auto-migration check…');
console.log('📊 Initial system state:', {
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage),
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
});

// Check if we're already in legacy fallback mode
console.log('🚩 Checking for existing legacy fallback mode...');
if (isLegacyFallbackModeActive()) {
    console.log('⚠️ App is running in legacy fallback mode');
    const failureReason = sessionStorage.getItem('miniCycleMigrationFailureReason') || 'Unknown reason';
    console.log('❌ Previous failure reason:', failureReason);
    
    showNotification(
        `⚠️ Running in compatibility mode due to: ${failureReason}. Restart app to retry migration.`, 
        'warning', 
        5000
    );
    
    // Load app with legacy data
    console.log('📱 Loading app in legacy fallback mode...');
    initialSetup();
    return;
}

console.log('✅ No existing fallback mode detected');

// ✅ FIXED: Use your existing function correctly
console.log('🔍 Running migration check...');
const migrationCheck = checkMigrationNeeded();
console.log('📋 Migration check complete:', migrationCheck);

if (migrationCheck.needed) { // ✅ Use .needed property
    console.log('📋 Migration needed - starting auto-migration process...');
    console.log('🔄 Auto-migration will be performed asynchronously...');
    
    // ✅ NEW: Pass through any options (like forceMode)
    performAutoMigration(options).then(result => {
        console.log('🏁 Auto-migration promise resolved:', result);
        
        if (result.success) {
            console.log('✅ Auto-migration successful, loading app...');
            console.log('📊 Migration success details:', {
                backupKey: result.backupKey,
                message: result.message,
                forced: result.forced || false,
                minimal: result.minimal || false
            });
            initialSetup();
        } else if (result.fallbackActive) {
            console.log('⚠️ Migration failed but fallback active, loading app with legacy data...');
            console.log('📊 Fallback details:', {
                reason: result.reason,
                message: result.message
            });
            initialSetup();
        } else {
            console.error('❌ Auto-migration failed completely:', result.message);
            console.error('🚨 Critical failure details:', result);
            // Critical error is already shown by handleMigrationFailure
        }
    }).catch(error => {
        console.error('❌ Unexpected error during auto-migration:', error);
        console.error('🔧 Promise rejection stack:', error.stack);
        console.error('📊 System state at promise failure:', {
            localStorage: Object.keys(localStorage),
            sessionStorage: Object.keys(sessionStorage)
        });
        showCriticalError('An unexpected error occurred. Please refresh the page.');
    });
} else {
    console.log('✅ No migration needed, loading app normally...');
    console.log('📦 Current schema status:', migrationCheck.currentVersion);
    initialSetup();
}
}

// ✅ NEW: Helper function to trigger force migration
function forceAppMigration() {
    console.log('🚨 Forcing app migration...');
    return initializeAppWithAutoMigration({ 
        forceMode: true, 
        skipValidation: true 
    });
}

// ✅ Show Critical Error (Enhanced for better UX)
function showCriticalError(message) {
console.log('🚨 Showing critical error to user:', message);
console.log('📊 System state at critical error:', {
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage),
    url: window.location.href,
    timestamp: new Date().toISOString()
});

const errorContainer = document.createElement('div');
errorContainer.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #ff4444; color: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; max-width: 400px; text-align: center; font-family: Inter, sans-serif; line-height: 1.5;`;

errorContainer.innerHTML = `
    <h3 style="margin-top: 0;">⚠️ App Error</h3>
    <p style="margin-bottom: 20px;">${message}</p>
    <div style="display: flex; gap: 10px; justify-content: center;">
        <button onclick="location.reload()" style="
            background: white;
            color: #ff4444;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        ">Reload App</button>
        <button onclick="this.parentElement.parentElement.remove()" style="
            background: transparent;
            color: white;
            border: 1px solid white;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        ">Dismiss</button>
    </div>
`;

document.body.appendChild(errorContainer);

console.log('📢 Critical error dialog displayed to user');

// Auto-remove after 15 seconds
setTimeout(() => {
    if (errorContainer.parentElement) {
        errorContainer.remove();
        console.log('⏰ Critical error dialog auto-removed after timeout');
    }
}, 15000);
}

// Add this function before your migration functions
function fixTaskValidationIssues() {
    console.log('🔧 Fixing task validation issues...');
    
    try {
        const legacyData = localStorage.getItem('miniCycleStorage');
        if (!legacyData) {
            console.log('⚠️ No legacy data found');
            return { success: false, message: 'No legacy data found' };
        }
        
        const cycles = JSON.parse(legacyData);
        let fixedTasks = 0;
        let fixedDetails = [];
        
        Object.keys(cycles).forEach(cycleName => {
            const cycle = cycles[cycleName];
            if (!cycle.tasks || !Array.isArray(cycle.tasks)) return;
            
            cycle.tasks.forEach(task => {
                const taskId = task.id || 'unknown';
                console.log(`🔍 Checking task: "${task.taskText}" (${taskId})`);
                
                // ✅ NEW: Handle tasks that SHOULD have recurring but don't
                if (!task.recurring && (task.taskText || task.id)) {
                    // Skip tasks that are clearly not meant to be recurring
                    // (This is the safest approach - only fix existing recurring objects)
                    return;
                }
                
                // ✅ Handle tasks with incomplete recurring objects
                if (task.recurring && typeof task.recurring === 'object') {
                    
                    // Set sensible defaults based on existing data or fallbacks
                    if (task.recurring.recurCount === undefined) {
                        task.recurring.recurCount = 1;
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added recurCount`);
                        console.log('  ✅ Fixed: Added recurCount = 1');
                    }
                    
                    if (task.recurring.recurIndefinitely === undefined) {
                        task.recurring.recurIndefinitely = true;
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added recurIndefinitely`);
                        console.log('  ✅ Fixed: Added recurIndefinitely = true');
                    }
                    
                    if (task.recurring.useSpecificTime === undefined) {
                        task.recurring.useSpecificTime = false;
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added useSpecificTime`);
                        console.log('  ✅ Fixed: Added useSpecificTime = false');
                    }
                    
                    // ✅ Set frequency if missing
                    if (!task.recurring.frequency) {
                        task.recurring.frequency = 'daily'; // Most common default
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added default frequency`);
                        console.log('  ✅ Fixed: Added frequency = daily');
                    }
                    
                    // Fix missing frequency blocks based on actual frequency
                    const freq = task.recurring.frequency;
                    
                    if (freq === 'hourly' && !task.recurring.hourly) {
                        task.recurring.hourly = {
                            useSpecificMinute: false,
                            minute: 0
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added hourly block`);
                        console.log('  ✅ Fixed: Added hourly block');
                    }
                    
                    if (freq === 'daily' && !task.recurring.daily) {
                        task.recurring.daily = {
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added daily block`);
                        console.log('  ✅ Fixed: Added daily block');
                    }
                    
                    if (freq === 'weekly' && !task.recurring.weekly) {
                        task.recurring.weekly = {
                            useSpecificDays: false,
                            days: [],
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added weekly block`);
                        console.log('  ✅ Fixed: Added weekly block');
                    }
                    
                    if (freq === 'biweekly' && !task.recurring.biweekly) {
                        task.recurring.biweekly = {
                            useSpecificDays: false,
                            days: [],
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added biweekly block`);
                        console.log('  ✅ Fixed: Added biweekly block');
                    }
                    
                    if (freq === 'monthly' && !task.recurring.monthly) {
                        task.recurring.monthly = {
                            useSpecificDays: false,
                            days: [],
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added monthly block`);
                        console.log('  ✅ Fixed: Added monthly block');
                    }
                    
                    if (freq === 'yearly' && !task.recurring.yearly) {
                        task.recurring.yearly = {
                            useSpecificMonths: false,
                            months: [],
                            useSpecificDays: false,
                            days: [],
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added yearly block`);
                        console.log('  ✅ Fixed: Added yearly block');
                    }
                }
            });
        });
        
        if (fixedTasks > 0) {
            localStorage.setItem('miniCycleStorage', JSON.stringify(cycles));
            console.log(`✅ Fixed ${fixedTasks} task validation issues:`);
            fixedDetails.forEach(detail => console.log(`   - ${detail}`));
            
            return { 
                success: true, 
                fixedCount: fixedTasks,
                details: fixedDetails,
                message: `Fixed ${fixedTasks} validation issues`
            };
        } else {
            console.log('✅ No fixes needed');
            return { 
                success: true, 
                fixedCount: 0,
                message: 'No validation issues found' 
            };
        }
        
    } catch (error) {
        console.error('❌ Error fixing task validation:', error);
        return { 
            success: false, 
            error: error.message,
            message: `Error during fix: ${error.message}`
        };
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







/**
 * Updates the main menu header with the active miniCycle title and current date.
 * Ensures proper display of selected miniCycle.
 */

function updateMainMenuHeader() {
    console.log('📰 Updating main menu header (Schema 2.5 only)...');
    
    const menuHeaderTitle = document.getElementById("main-menu-mini-cycle-title");
    const dateElement = document.getElementById("current-date");
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for updateMainMenuHeader');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    let activeCycleTitle = "No miniCycle Selected";
    
    console.log('📊 Looking up active cycle:', activeCycle);
    
    if (activeCycle && cycles[activeCycle]) {
        const currentCycle = cycles[activeCycle];
        activeCycleTitle = currentCycle.title || activeCycle;
        console.log('✅ Found active cycle title:', activeCycleTitle);
    } else {
        console.warn('⚠️ No active cycle found for header update');
    }

    // ✅ Get Current Date
    const today = new Date();
    const formattedDate = today.toLocaleDateString(undefined, {
        weekday: 'short', // "Mon"
        month: 'short', // "Jan"
        day: '2-digit', // "08"
        year: 'numeric' // "2025"
    });

    console.log('📅 Formatted date:', formattedDate);

    // ✅ Update Title & Date
    if (menuHeaderTitle) {
        menuHeaderTitle.textContent = activeCycleTitle;
        console.log('🏷️ Updated menu header title');
    } else {
        console.warn('⚠️ Menu header title element not found');
    }
    
    if (dateElement) {
        dateElement.textContent = formattedDate;
        console.log('📅 Updated date element');
    } else {
        console.warn('⚠️ Date element not found');
    }
    
    console.log('✅ Main menu header update completed');
}

/**
 * Saves the due date for a specific task in the active miniCycle.
 *
 * @param {string} taskText - The text of the task to update.
 * @param {string|null} dueDate - The due date to assign, or null to remove the due date.
 */

function saveTaskDueDate(taskId, newDueDate) {
    console.log('📅 Saving task due date (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for saveTaskDueDate');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    
    if (!activeCycle || !cycles[activeCycle]) {
        console.error("❌ Error: Active cycle not found in Schema 2.5.");
        return;
    }
    
    console.log('🔍 Finding task:', taskId);
    
    const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);
    
    if (!task) {
        console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
        return;
    }
    
    console.log('📊 Updating due date:', {
        taskId,
        taskText: task.text,
        oldDueDate: task.dueDate,
        newDueDate
    });
    
    // Update task due date
    task.dueDate = newDueDate;
    
    // Update the full schema data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log(`✅ Due date updated for task "${task.text}": ${newDueDate || 'cleared'}`);
}
  /***********************
 * 
 * 
 * Menu Management Logic
 * 
 * 
 ************************/

/**
 * Saves the current miniCycle under a new name, creating a separate copy.
 * Ensures that the new name is unique before saving.
 */

function saveMiniCycleAsNew() {
    console.log('💾 Saving miniCycle as new (state-based)...');
    
    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for saveMiniCycleAsNew');
        showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
        return;
    }

    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for saveMiniCycleAsNew');
        showNotification("⚠️ No data available. Please try again.", "error", 3000);
        return;
    }

    const { data, appState } = currentState;
    const activeCycle = appState.activeCycleId;
    const currentCycle = data.cycles[activeCycle];
    
    console.log('📊 Checking active cycle:', activeCycle);
    
    if (!activeCycle || !currentCycle) {
        console.warn('⚠️ No active miniCycle found to save');
        showNotification("⚠ No miniCycle found to save.");
        return;
    }

    console.log('📝 Prompting user for new cycle name');

    showPromptModal({
        title: "Duplicate Cycle List",
        message: `Enter a new name for your copy of "${currentCycle.title}":`,
        placeholder: "e.g., My Custom Routine",
        confirmText: "Save Copy",
        cancelText: "Cancel",
        required: true,
        callback: (input) => {
            if (!input) {
                console.log('❌ User cancelled save operation');
                showNotification("❌ Save cancelled.");
                return;
            }

            const newCycleName = sanitizeInput(input.trim());
            console.log('🔍 Processing new cycle name:', newCycleName);

            if (!newCycleName) {
                console.warn('⚠️ Invalid cycle name provided');
                showNotification("⚠ Please enter a valid name.");
                return;
            }

            // ✅ Update through state system
            window.AppState.update(state => {
                // ✅ Check for existing cycles by key
                if (state.data.cycles[newCycleName]) {
                    console.warn('⚠️ Cycle name already exists:', newCycleName);
                    showNotification("⚠ A miniCycle with this name already exists. Please choose a different name.");
                    return; // Don't save if duplicate exists
                }

                console.log('🔄 Creating new cycle copy...');

                // ✅ Create new cycle with title as key for Schema 2.5
                const newCycleId = `copy_${Date.now()}`;
                
                console.log('📊 Deep copying current cycle data');
                
                // ✅ Deep copy the current cycle with new title as storage key
                state.data.cycles[newCycleName] = {
                    ...JSON.parse(JSON.stringify(currentCycle)),
                    id: newCycleId,
                    title: newCycleName,
                    createdAt: Date.now()
                };

                console.log('🎯 Setting new cycle as active:', newCycleName);

                // ✅ Set as active cycle using the title as key
                state.appState.activeCycleId = newCycleName;
                state.metadata.lastModified = Date.now();
                state.metadata.totalCyclesCreated++;

                console.log(`✅ Successfully created cycle copy: "${currentCycle.title}" → "${newCycleName}"`);
                console.log('📈 Total cycles created:', state.metadata.totalCyclesCreated);

            }, true); // immediate save

            showNotification(`✅ miniCycle "${currentCycle.title}" was copied as "${newCycleName}"!`);
            hideMainMenu();
            
            // ✅ Use proper cycle loader if available
            if (typeof window.loadMiniCycle === 'function') {
                window.loadMiniCycle();
            } else {
                // Fallback to manual refresh
                setTimeout(() => window.location.reload(), 1000);
            }
        }
    });
}


/**
 * Switchminicycle function.
 *
 * @returns {void}
 */

function switchMiniCycle() {
    console.log('🔄 Opening switch miniCycle modal (state-based)...');
    
    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for switchMiniCycle');
        showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
        return;
    }

    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for switchMiniCycle');
        showNotification("⚠️ No data available. Please try again.", "error", 3000);
        return;
    }

    const cycles = currentState.data?.cycles || {};
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    const switchRow = document.querySelector(".switch-items-row");
    const renameButton = document.getElementById("switch-rename");
    const deleteButton = document.getElementById("switch-delete");

    console.log('📊 Found cycles:', Object.keys(cycles).length);

    hideMainMenu();

    if (Object.keys(cycles).length === 0) {
        console.warn('⚠️ No saved miniCycles found');
        showNotification("No saved miniCycles found.");
        return;
    }

    console.log('� Showing switch modal...');
    switchModal.style.display = "flex";
    switchRow.style.display = "none";
    
    // ✅ Let loadMiniCycleList() handle all the population logic
    loadMiniCycleList();

    console.log('🔗 Setting up event listeners...');

    // ✅ Event listeners remain the same
    renameButton.removeEventListener("click", renameMiniCycle);
    renameButton.addEventListener("click", renameMiniCycle);

    deleteButton.removeEventListener("click", deleteMiniCycle);
    deleteButton.addEventListener("click", deleteMiniCycle);

    document.getElementById("miniCycleSwitchConfirm").removeEventListener("click", confirmMiniCycle);
    document.getElementById("miniCycleSwitchConfirm").addEventListener("click", confirmMiniCycle);

document.getElementById("miniCycleSwitchCancel").removeEventListener("click", hideSwitchMiniCycleModal);
document.getElementById("miniCycleSwitchCancel").addEventListener("click", hideSwitchMiniCycleModal);
    
    console.log('✅ Switch miniCycle modal setup completed');
}
  

/**
 * Renameminicycle function.
 *
 * @returns {void}
 */

function renameMiniCycle() {
    console.log('📝 Renaming miniCycle (state-based)...');
    
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");

    if (!selectedCycle) {
        console.warn('⚠️ No cycle selected for rename');
        showNotification("Please select a miniCycle to rename.", "info", 1500);
        return;
    }

    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for renameMiniCycle');
        showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
        return;
    }

    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for renameMiniCycle');
        showNotification("⚠️ No data available. Please try again.", "error", 3000);
        return;
    }

    const { data, appState } = currentState;
    const cycles = data.cycles || {};
    const cycleKey = selectedCycle.dataset.cycleKey;
    const currentCycle = cycles[cycleKey];
    
    console.log('🔍 Renaming cycle:', cycleKey);
    
    if (!cycleKey || !currentCycle) {
        console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
        showNotification("⚠️ Invalid cycle selection.", "error", 1500);
        return;
    }

    const oldName = currentCycle.title;
    console.log('📊 Current cycle details:', { oldName, cycleKey });

    showPromptModal({
        title: "Rename miniCycle",
        message: `Rename "${oldName}" to:`,
        placeholder: "e.g., Morning Routine",
        defaultValue: oldName,
        confirmText: "Rename",
        cancelText: "Cancel",
        required: true,
        callback: (newName) => {
            if (!newName) {
                console.log('❌ User cancelled rename');
                showNotification("❌ Rename canceled.", "show", 1500);
                return;
            }

            const cleanName = sanitizeInput(newName.trim());
            console.log('🧹 Cleaned name:', { original: newName, cleaned: cleanName });
            
            if (cleanName === oldName) {
                console.log('ℹ️ Name unchanged');
                showNotification("ℹ Name unchanged.", "show", 1500);
                return;
            }

            // ✅ Update through state system
            window.AppState.update(state => {
                // Check for existing cycles by title (key collision check)
                if (state.data.cycles[cleanName]) {
                    console.warn('⚠️ Cycle name already exists:', cleanName);
                    showNotification("⚠ A miniCycle with that name already exists.", "show", 1500);
                    return; // Don't save if duplicate exists
                }

                console.log('🔄 Performing rename operation...');

                // Create new entry with new title as key
                const updatedCycle = { ...currentCycle, title: cleanName };
                state.data.cycles[cleanName] = updatedCycle;
                
                // Remove old entry
                delete state.data.cycles[cycleKey];
                
                console.log('📊 Updated cycles structure:', Object.keys(state.data.cycles));
                
                // Update active cycle if this was the active one
                if (state.appState.activeCycleId === cycleKey) {
                    state.appState.activeCycleId = cleanName;
                    console.log('🎯 Updated active cycle ID to:', cleanName);
                }
                
                state.metadata.lastModified = Date.now();

                console.log('💾 Rename saved through state system');

                // Store clean name for UI updates
                window._tempRenameData = { oldKey: cycleKey, newKey: cleanName, newName: cleanName };

            }, true); // immediate save

            // ✅ Get the rename data for UI updates
            const renameData = window._tempRenameData || {};
            delete window._tempRenameData; // cleanup

            // Update UI
            selectedCycle.dataset.cycleKey = cleanName;
            selectedCycle.dataset.cycleName = cleanName;
            selectedCycle.textContent = cleanName;

            console.log('🔄 Refreshing UI...');

            // Refresh UI
            loadMiniCycleList();
            updatePreview(cleanName);
            setTimeout(() => {
                const updatedItem = [...document.querySelectorAll(".mini-cycle-switch-item")]
                    .find(item => item.dataset.cycleKey === cleanName);
                if (updatedItem) {
                    updatedItem.classList.add("selected");
                    updatedItem.click();
                    console.log('✅ Updated item selected in UI');
                }
            }, 50);

            console.log(`✅ Successfully renamed: "${oldName}" → "${cleanName}"`);
            showNotification(`✅ miniCycle renamed to "${cleanName}"`, "success", 2500);
        }
    });
}

/**
 * Deleteminicycle function.
 *
 * @returns {void}
 */
function deleteMiniCycle() {
    console.log('🗑️ Deleting miniCycle (state-based)...');
    
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");
    if (!selectedCycle) {
        console.warn('⚠️ No cycle selected for deletion');
        showNotification("⚠ No miniCycle selected for deletion.");
        return;
    }

    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for deleteMiniCycle');
        showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
        return;
    }

    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for deleteMiniCycle');
        showNotification("⚠️ No data available. Please try again.", "error", 3000);
        return;
    }

    const { data, appState } = currentState;
    const cycles = data.cycles || {};
    const activeCycle = appState.activeCycleId;
    const cycleKey = selectedCycle.dataset.cycleKey;
    const currentCycle = cycles[cycleKey];
    
    console.log('🔍 Deleting cycle:', cycleKey);
    console.log('📊 Current cycles count:', Object.keys(cycles).length);
    
    if (!cycleKey || !currentCycle) {
        console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
        showNotification("⚠️ Invalid cycle selection.", "error", 1500);
        return;
    }

    const cycleToDelete = currentCycle.title;
    console.log('📊 Cycle to delete:', { title: cycleToDelete, isActive: cycleKey === activeCycle });

    showConfirmationModal({
        title: "Delete miniCycle",
        message: `❌ Are you sure you want to delete "${cycleToDelete}"? This action cannot be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        callback: (confirmed) => {
            if (!confirmed) {
                console.log('❌ User cancelled deletion');
                return;
            }

            console.log('🔄 Performing deletion...');

            // ✅ Update through state system
            window.AppState.update(state => {
                // Remove the selected miniCycle
                delete state.data.cycles[cycleKey];
                
                console.log(`✅ miniCycle "${cycleToDelete}" deleted from state`);
                console.log('📊 Remaining cycles:', Object.keys(state.data.cycles));

                // If the deleted cycle was the active one, handle fallback
                if (cycleKey === activeCycle) {
                    console.log('🎯 Deleted cycle was active, handling fallback...');
                    const remainingCycleKeys = Object.keys(state.data.cycles);

                    if (remainingCycleKeys.length > 0) {
                        // Switch to the first available miniCycle
                        const newActiveCycleKey = remainingCycleKeys[0];
                        state.appState.activeCycleId = newActiveCycleKey;
                        
                        const newActiveCycle = state.data.cycles[newActiveCycleKey];
                        console.log(`🔄 Switched to miniCycle: "${newActiveCycle.title}"`);
                    } else {
                        console.log('⚠️ No cycles remaining, resetting app...');
                        state.appState.activeCycleId = null;
                    }
                }

                state.metadata.lastModified = Date.now();
            }, true); // immediate save

            console.log('💾 Deletion saved through state system');
            console.log('🔄 Refreshing UI...');

            // ✅ Check if any cycles remain
            const finalState = window.AppState.get();
            const remainingCycles = Object.keys(finalState.data.cycles);

            if (remainingCycles.length === 0) {
                // No cycles left - handle gracefully
                setTimeout(() => {
                    hideSwitchMiniCycleModal();
                    showNotification("⚠ No miniCycles left. Please create a new one.");
                    
                    // Manually reset UI instead of reloading
                    const taskList = document.getElementById("taskList");
                    const toggleAutoReset = document.getElementById("toggleAutoReset");
                    
                    if (taskList) taskList.innerHTML = "";
                    if (toggleAutoReset) toggleAutoReset.checked = false;
                    
                    // Trigger initial setup for new cycle creation
                    setTimeout(initialSetup, 500);
                }, 300);
            } else {
                // Refresh UI with remaining cycles
                if (typeof window.loadMiniCycle === 'function') {
                    window.loadMiniCycle();
                } else {
                    setTimeout(() => window.location.reload(), 1000);
                }
                
                loadMiniCycleList();
                setTimeout(updateProgressBar, 500);
                setTimeout(updateStatsPanel, 500);
                checkCompleteAllButton();
                
                setTimeout(() => {
                    const firstCycle = document.querySelector(".mini-cycle-switch-item");
                    if (firstCycle) {
                        firstCycle.classList.add("selected");
                        firstCycle.click();
                        console.log('✅ First remaining cycle selected');
                    }
                }, 50);
            }

            console.log(`✅ Successfully deleted: "${cycleToDelete}"`);
            showNotification(`🗑️ "${cycleToDelete}" has been deleted.`);
        }
    });
}
/**
 * Hideswitchminicyclemodal function.
 *
 * @returns {void}
 */
function hideSwitchMiniCycleModal() {
    console.log("🔍 Hiding switch miniCycle modal (Schema 2.5 only)...");
    
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    console.log("🔍 Modal Found?", switchModal);

    if (!switchModal) {
        console.error("❌ Error: Modal not found.");
        return;
    }
    
    switchModal.style.display = "none";
    console.log("✅ Modal hidden successfully");
}

/**
 * Confirmminicycle function.
 *
 * @returns {void}
 */
function confirmMiniCycle() {
    console.log("✅ Confirming miniCycle selection (state-based)...");
    
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");

    if (!selectedCycle) {
        showNotification("⚠️ Please select a miniCycle first.", "warning", 3000);
        return;
    }

    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for confirmMiniCycle');
        showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
        return;
    }

    const cycleKey = selectedCycle.dataset.cycleKey;
    
    if (!cycleKey) {
        console.error("❌ Invalid cycle selection - missing cycleKey");
        showNotification("⚠️ Invalid cycle selection.", "error", 3000);
        return;
    }
    
    console.log(`🔄 Switching to cycle: ${cycleKey}`);
    console.log('🔍 Current active cycle before switch:', window.AppState.get()?.appState?.activeCycleId);
    
    // ✅ Update through state system
    window.AppState.update(state => {
        console.log('🔍 Inside state update - changing from:', state.appState.activeCycleId, 'to:', cycleKey);
        state.appState.activeCycleId = cycleKey;
        state.metadata.lastModified = Date.now();
    }, true); // immediate save
    
    // ✅ Verify the change took effect
    const newActiveId = window.AppState.get()?.appState?.activeCycleId;
    console.log('🔍 Active cycle after state update:', newActiveId);
    
    if (newActiveId !== cycleKey) {
        console.error('❌ State update failed! Expected:', cycleKey, 'Got:', newActiveId);
        showNotification("⚠️ Failed to switch cycle. Please try again.", "error", 3000);
        return;
    }
    
    console.log(`✅ Switched to cycle (state-based): ${cycleKey}`);
    
    // ✅ Close modal first to avoid UI conflicts
    hideSwitchMiniCycleModal();
    
    // ✅ Add a small delay to ensure state is fully propagated
    setTimeout(() => {
        console.log('🔄 Loading new cycle after delay...');
        console.log('🔍 Final active cycle check before loading:', window.AppState.get()?.appState?.activeCycleId);
        
        // Load the new cycle
        if (typeof window.loadMiniCycle === 'function') {
            window.loadMiniCycle();
        } else {
            console.error('❌ loadMiniCycle function not available');
            // Fallback refresh
            setTimeout(() => window.location.reload(), 1000);
        }
        
        // ✅ Get cycle name from state for confirmation
        const currentState = window.AppState.get();
        const cycleName = currentState?.data?.cycles?.[cycleKey]?.title || cycleKey;
        showNotification(`✅ Switched to "${cycleName}"`, "success", 2000);
    }, 100);
}



// ✅ Updated event listener with proper error checking
function setupModalClickOutside() {
    document.addEventListener("click", function closeOnClickOutside(event) {
        const switchModalContent = document.querySelector(".mini-cycle-switch-modal-content");
        const switchModal = document.querySelector(".mini-cycle-switch-modal");
        const mainMenu = document.querySelector(".menu-container");

        // ✅ Add error checking for missing elements
        if (!switchModalContent || !switchModal || !mainMenu) {
            console.warn('⚠️ Modal elements not found for click outside handler');
            return;
        }

        // ✅ If the modal is open and the clicked area is NOT inside the modal or main menu, close it
        if (
            switchModal.style.display === "flex" &&
            !switchModalContent.contains(event.target) && 
            !mainMenu.contains(event.target)
        ) {
            switchModal.style.display = "none"; 
        }
    });
}

// ✅ Call this function during initialization instead of immediate attachment

/**
 * Updatepreview function.
 *
 * @param {any} cycleName - Description. * @returns {void}
 */

function updatePreview(cycleName) {
    console.log('👁️ Updating preview (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for updatePreview');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles } = schemaData;
    const cycleData = cycles[cycleName];
    
    console.log('🔍 Preview for cycle:', cycleName);
    
    const previewWindow = document.getElementById("switch-preview-window");

    function escapeHTML(str) {
        const temp = document.createElement("div");
        temp.textContent = str;
        return temp.innerHTML;
    }

    if (!cycleData || !cycleData.tasks) {
        previewWindow.innerHTML = `<br><strong>No tasks found.</strong>`;
        console.log('⚠️ No tasks found for preview');
        return;
    }

    console.log('📋 Generating preview for', cycleData.tasks.length, 'tasks');

    // ✅ Create a simple list of tasks for preview
    const tasksPreview = cycleData.tasks
        .map(task => `<div class="preview-task">${task.completed ? "✔️" : "___"} ${escapeHTML(task.text)}</div>`)
        .join("");

    previewWindow.innerHTML = `<strong>Tasks:</strong><br>${tasksPreview}`;
    
    console.log('✅ Preview updated successfully');
}
/**
 * Loadminicyclelist function.
 *
 * @returns {void}
 */
// ✅ Add debouncing to prevent multiple rapid calls
let loadMiniCycleListTimeout;
function loadMiniCycleList() {
    // ✅ Clear any pending calls
    if (loadMiniCycleListTimeout) {
        clearTimeout(loadMiniCycleListTimeout);
    }
    
    // ✅ Debounce to prevent rapid successive calls
    loadMiniCycleListTimeout = setTimeout(() => {
        loadMiniCycleListActual();
    }, 50);
}

function loadMiniCycleListActual() {
    console.log('📋 Loading miniCycle list (state-based)...');
    
    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for loadMiniCycleList');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for loadMiniCycleList');
        return;
    }

    const cycles = currentState.data?.cycles || {};
    const miniCycleList = document.getElementById("miniCycleList");
    
    if (!miniCycleList) {
        console.error('❌ miniCycleList element not found');
        return;
    }
    
    miniCycleList.innerHTML = ""; // Clear the list before repopulating

    console.log('📊 Found cycles:', Object.keys(cycles).length);

    // ✅ Ensure we have cycles to display
    if (Object.keys(cycles).length === 0) {
        console.warn('⚠️ No cycles found to display');
        miniCycleList.innerHTML = '<div class="no-cycles-message">No miniCycles found</div>';
        return;
    }

    // ✅ Use Object.entries to get both key and cycle data
    Object.entries(cycles).forEach(([cycleKey, cycleData], index) => {
        if (!cycleData) {
            console.warn('⚠️ Invalid cycle data for key:', cycleKey);
            return;
        }

        const listItem = document.createElement("div");
        listItem.classList.add("mini-cycle-switch-item");
        listItem.dataset.cycleName = cycleData.title || cycleKey; // Use title for compatibility
        listItem.dataset.cycleKey = cycleKey; // ✅ Store the storage key

        // 🏷️ Determine emoji based on miniCycle properties
        let emoji = "📋"; // Default to 📋 (Standard Document)
        if (cycleData.autoReset) {
            emoji = "🔃"; // If Auto Reset is ON, show 🔃
        }

        // 📌 Ensure spacing between emoji and text
        listItem.textContent = emoji + " ";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = cycleData.title || cycleKey;
        listItem.appendChild(nameSpan);

        // 🖱️ Handle selection
        listItem.addEventListener("click", function () {
            console.log('🎯 Cycle selected:', cycleData.title || cycleKey, 'Key:', cycleKey);
            
            document.querySelectorAll(".mini-cycle-switch-item").forEach(item => item.classList.remove("selected"));
            this.classList.add("selected");

            // Show preview & buttons
            const switchItemsRow = document.getElementById("switch-items-row");
            if (switchItemsRow) {
                switchItemsRow.style.display = "block";
            }
            
            // ✅ Pass the cycle key for Schema 2.5
            updatePreview(cycleKey);
        });

        miniCycleList.appendChild(listItem);
    });

    updateReminderButtons();
    
    console.log('✅ MiniCycle list loaded successfully (state-based), final count:', miniCycleList.children.length);
}



/**
 * Clearalltasks function.
 *
 * @returns {void}
 */
function clearAllTasks() {
    console.log('🧹 Clearing all tasks (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for clearAllTasks');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    const currentCycle = cycles[activeCycle];
    
    if (!activeCycle || !currentCycle) {
        console.warn('⚠️ No active miniCycle to clear tasks');
        showNotification("⚠ No active miniCycle to clear tasks.");
        return;
    }

    console.log('📊 Clearing tasks for cycle:', activeCycle);

    // ✅ Create undo snapshot before making changes
    

    // ✅ Uncheck all tasks (DO NOT DELETE)
    currentCycle.tasks.forEach(task => task.completed = false);

    // ✅ Update the full schema data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = currentCycle;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

    console.log('💾 Tasks unchecked and saved to Schema 2.5');

    // ✅ Uncheck tasks in the UI and remove overdue styling
    document.querySelectorAll("#taskList .task").forEach(taskElement => {
        const checkbox = taskElement.querySelector("input[type='checkbox']");
        if (checkbox) {
            checkbox.checked = false;
        }
        // ✅ Remove overdue styling
        taskElement.classList.remove("overdue-task");
    });

    // ✅ Update UI elements
    updateProgressBar();
    updateStatsPanel();
    checkCompleteAllButton();
    updateRecurringPanelButtonVisibility();
    hideMainMenu();

    // ✅ Show undo/hide redo buttons
    document.getElementById("undo-btn").hidden = false;
    document.getElementById("redo-btn").hidden = true;

    console.log(`✅ All tasks unchecked for miniCycle: "${currentCycle.title}"`);
    showNotification(`✅ All tasks unchecked for "${currentCycle.title}"`, "success", 2000);
}

/**
 * Deletealltasks function.
 *
 * @returns {void}
 */
function deleteAllTasks() {
    console.log('🗑️ Deleting all tasks (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for deleteAllTasks');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    const currentCycle = cycles[activeCycle];
    
    if (!activeCycle || !currentCycle) {
        console.warn('⚠️ No active miniCycle to delete tasks from');
        showNotification("⚠ No active miniCycle to delete tasks from.");
        return;
    }

    console.log('📊 Preparing to delete tasks for cycle:', activeCycle);

    // ✅ Use callback pattern with showConfirmationModal
    showConfirmationModal({
        title: "Delete All Tasks",
        message: `⚠ Are you sure you want to permanently delete all tasks in "${currentCycle.title}"? This action cannot be undone.`,
        confirmText: "Delete All",
        cancelText: "Cancel",
        callback: (confirmed) => {
            if (!confirmed) {
                console.log('❌ User cancelled deletion');
                showNotification("❌ Deletion cancelled.");
                return;
            }

            console.log('🔄 Proceeding with task deletion...');

            // ✅ Push undo snapshot before deletion
            

            // ✅ Clear tasks completely
            currentCycle.tasks = [];

            // ✅ Clear recurring templates too
            if (currentCycle.recurringTemplates) {
                currentCycle.recurringTemplates = {};
            }

            // ✅ Update the full schema data
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = currentCycle;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

            console.log('💾 All tasks deleted and saved to Schema 2.5');

            // ✅ Clear UI & update progress
            const taskList = document.getElementById("taskList");
            if (taskList) {
                taskList.innerHTML = "";
            }
            
            updateProgressBar();
            updateStatsPanel();
            checkCompleteAllButton();
            updateRecurringPanelButtonVisibility();

            // ✅ Show undo/hide redo buttons
            document.getElementById("undo-btn").hidden = false;
            document.getElementById("redo-btn").hidden = true;

            console.log(`✅ All tasks deleted for miniCycle: "${currentCycle.title}"`);
            showNotification(`✅ All tasks deleted from "${currentCycle.title}"`, "success", 3000);
        }
    });
}


/**
 * Create new miniCycle function.
 *
 * @returns {void}
 */
function createNewMiniCycle() {
    console.log('🆕 Creating new miniCycle (state-based)...');
    
    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for createNewMiniCycle');
        showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
        return;
    }

    showPromptModal({
        title: "Create New miniCycle",
        message: "What would you like to name it?",
        placeholder: "e.g., Daily Routine",
        defaultValue: "",
        confirmText: "Create",
        cancelText: "Cancel",
        required: true,
        callback: (result) => {
            if (!result) {
                console.log('❌ User cancelled creation');
                showNotification("❌ Creation canceled.");
                return;
            }
            
            const newCycleName = sanitizeInput(result.trim());
            console.log('🔍 Processing new cycle name:', newCycleName);
            
            // ✅ Create unique ID first
            const cycleId = `cycle_${Date.now()}`;
            console.log('🆔 Generated cycle ID:', cycleId);
            
            // ✅ Update through state system
            window.AppState.update(state => {
                // ✅ Determine the storage key (title-first approach with ID fallback)
                let storageKey = newCycleName;
                let finalTitle = newCycleName;
                
                // ✅ Handle duplicate titles by checking existing keys
                if (state.data.cycles[storageKey]) {
                    console.log('⚠️ Duplicate title detected, finding unique variation');
                    
                    // Try numbered variations first: "Title (2)", "Title (3)", etc.
                    let counter = 2;
                    let numberedTitle = `${newCycleName} (${counter})`;
                    
                    while (state.data.cycles[numberedTitle] && counter < 10) {
                        counter++;
                        numberedTitle = `${newCycleName} (${counter})`;
                    }
                    
                    // If we found a unique numbered title, use it
                    if (!state.data.cycles[numberedTitle]) {
                        storageKey = numberedTitle;
                        finalTitle = numberedTitle;
                        console.log('🔄 Using numbered variation:', finalTitle);
                        showNotification(`⚠ Title already exists. Using "${finalTitle}" instead.`, "warning", 3000);
                    } else {
                        // Fallback to ID if too many duplicates
                        storageKey = cycleId;
                        finalTitle = newCycleName; // Keep original title inside object
                        console.log('🔄 Using unique ID for storage:', storageKey);
                        showNotification(`⚠ Multiple cycles with this name exist. Using unique ID for storage.`, "warning", 3000);
                    }
                }

                console.log('🔄 Creating new cycle with storage key:', storageKey);

                // ✅ Create new cycle in Schema 2.5 format
                state.data.cycles[storageKey] = {
                    title: finalTitle,
                    id: cycleId,
                    tasks: [],
                    autoReset: true,
                    deleteCheckedTasks: false,
                    cycleCount: 0,
                    createdAt: Date.now(),
                    recurringTemplates: {}
                };

                // ✅ Set as active cycle using the storage key
                state.appState.activeCycleId = storageKey;
                state.metadata.lastModified = Date.now();
                state.metadata.totalCyclesCreated++;

                console.log('💾 Saving through state system...');
                console.log('📈 Total cycles created:', state.metadata.totalCyclesCreated);
                
                // Store final title for UI updates
                window._tempNewCycleData = { storageKey, finalTitle };
                
            }, true); // immediate save

            // ✅ Get the final data for UI updates
            const { storageKey, finalTitle } = window._tempNewCycleData || {};
            delete window._tempNewCycleData; // cleanup

            console.log('🔄 Updating UI elements...');

            // ✅ Clear UI & Load new miniCycle
            const taskList = document.getElementById("taskList");
            const toggleAutoReset = document.getElementById("toggleAutoReset");
            const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
            
            if (taskList) taskList.innerHTML = "";
            
            const titleElement = document.getElementById("mini-cycle-title");
            if (titleElement) titleElement.textContent = finalTitle;
            
            if (toggleAutoReset) toggleAutoReset.checked = true;
            if (deleteCheckedTasks) deleteCheckedTasks.checked = false;

            // ✅ Ensure UI updates
            hideMainMenu();
            updateProgressBar();
            checkCompleteAllButton();
            autoSave();

            console.log(`✅ Created and switched to new miniCycle (state-based): "${finalTitle}" (key: ${storageKey})`);
            
            showNotification(`✅ Created new miniCycle "${finalTitle}"`, "success", 3000);
        }
    });
}



indefiniteCheckbox.addEventListener("change", () => {
  // If indefinite, hide the repeatCount row
  repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
});



function handleReminderToggle() {
    console.log('🔔 Handling reminder toggle (Schema 2.5 only)...');
    
    const isEnabled = enableReminders.checked;
  
    // ✅ Get previous state from Schema 2.5
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for handleReminderToggle');
        throw new Error('Schema 2.5 data not found');
    }

    const previousSettings = schemaData.reminders || {};
    const wasEnabled = previousSettings.enabled === true;
    
    console.log('📊 Reminder toggle state:', {
        wasEnabled,
        nowEnabled: isEnabled,
        changed: wasEnabled !== isEnabled
    });
  
    // ✅ Update the visibility of the frequency section
    frequencySection.classList.toggle("hidden", !isEnabled);
  
    // ✅ Save updated settings and get the current global state
    const globalReminderState = autoSaveReminders();
  
    // ✅ Update the 🔔 task buttons
    updateReminderButtons();
  
    // ✅ Start or stop reminders
    if (globalReminderState) {
        console.log("🔔 Global Reminders Enabled — Starting reminders...");
        if (!wasEnabled) {
            showNotification("🔔 Task reminders enabled!", "success", 2500);
        }
        setTimeout(() => startReminders(), 200);
    } else {
        console.log("🔕 Global Reminders Disabled — Stopping reminders...");
        if (wasEnabled) {
            showNotification("🔕 Task reminders disabled.", "error", 2500);
        }
        stopReminders();
    }
    
    console.log('✅ Reminder toggle handled successfully');
}
  
  function setupReminderToggle() {
      console.log('⚙️ Setting up reminder toggle (Schema 2.5 only)...');
      
      safeAddEventListener(enableReminders, "change", handleReminderToggle);
  
      // ✅ Load reminder settings from Schema 2.5
      const schemaData = loadMiniCycleData();
      if (!schemaData) {
          console.error('❌ Schema 2.5 data required for setupReminderToggle');
          throw new Error('Schema 2.5 data not found');
      }
  
      const reminderSettings = schemaData.reminders || {
          enabled: false,
          indefinite: true,
          dueDatesReminders: false,
          repeatCount: 0,
          frequencyValue: 0,
          frequencyUnit: "hours"
      };
  
      console.log('📊 Loading reminder settings from Schema 2.5:', reminderSettings);
  
      enableReminders.checked = reminderSettings.enabled === true;
      frequencySection.classList.toggle("hidden", !reminderSettings.enabled);
  
      // ✅ 🧠 Reminder system will re-run if already enabled
      if (reminderSettings.enabled) {
          console.log('🔄 Reminders were enabled, starting system...');
          updateReminderButtons();
          startReminders();
      } else {
          console.log('🔕 Reminders disabled in settings');
      }
      
      console.log('✅ Reminder toggle setup completed');
  }

  function stopReminders() {
      console.log('🛑 Stopping reminder system (Schema 2.5 only)...');
      
      if (reminderIntervalId) {
          clearInterval(reminderIntervalId);
          reminderIntervalId = null;
          console.log("🛑 Reminder interval cleared");
      } else {
          console.log("ℹ️ No active reminder interval to stop");
      }
      
      console.log("✅ Reminder system stopped successfully");
  }






/**
 * Auto-save reminders function (Schema 2.5 only).
 *
 * @returns {boolean} - Returns the enabled state
 */
function autoSaveReminders() {
    console.log('💾 Auto-saving reminders (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for autoSaveReminders');
        throw new Error('Schema 2.5 data not found');
    }
    
    const enabled = document.getElementById("enableReminders").checked;
    
    const remindersToSave = {
        enabled,
        indefinite: document.getElementById("indefiniteCheckbox").checked,
        dueDatesReminders: document.getElementById("dueDatesReminders").checked,
        repeatCount: parseInt(document.getElementById("repeatCount").value) || 0,
        frequencyValue: parseInt(document.getElementById("frequencyValue").value) || 0,
        frequencyUnit: document.getElementById("frequencyUnit").value
    };
    
    // ⏱️ Save reminder start time only when enabling reminders
    if (enabled) {
        remindersToSave.reminderStartTime = Date.now();
    }
    
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.customReminders = remindersToSave;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log("✅ Reminders settings saved automatically (Schema 2.5):", remindersToSave);
    return enabled;
}

/**
 * Load reminders settings function (Schema 2.5 only).
 *
 * @returns {void}
 */
function loadRemindersSettings() {
    console.log('📥 Loading reminders settings (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for loadRemindersSettings');
        throw new Error('Schema 2.5 data not found');
    }
    
    const reminders = schemaData.reminders || {
        enabled: false,
        indefinite: true,
        dueDatesReminders: false,
        repeatCount: 0,
        frequencyValue: 0,
        frequencyUnit: "hours"
    };

    console.log('📊 Loading reminder settings from Schema 2.5:', reminders);

    // ✅ Apply settings to UI
    document.getElementById("enableReminders").checked = reminders.enabled;
    document.getElementById("indefiniteCheckbox").checked = reminders.indefinite;
    document.getElementById("dueDatesReminders").checked = reminders.dueDatesReminders;
    document.getElementById("repeatCount").value = reminders.repeatCount;
    document.getElementById("frequencyValue").value = reminders.frequencyValue;
    document.getElementById("frequencyUnit").value = reminders.frequencyUnit;

    // ✅ Show/hide frequency settings dynamically
    const frequencySection = document.getElementById("frequency-section");
    if (frequencySection) {
        frequencySection.classList.toggle("hidden", !reminders.enabled);
    }
    
    const repeatCountRow = document.getElementById("repeat-count-row");
    if (repeatCountRow) {
        repeatCountRow.style.display = reminders.indefinite ? "none" : "block";
    }

    // ✅ 🔔 Show/hide reminder buttons on load
    updateReminderButtons();
    
    console.log("✅ Reminder settings loaded from Schema 2.5");
}

// ✅ Attach auto-save & restart reminders to all reminder settings inputs safely


// ✅ Updated indefinite checkbox listener
safeAddEventListenerById("indefiniteCheckbox", "change", () => {
    console.log('🔄 Indefinite checkbox changed (Schema 2.5 only)');
    
    const repeatCountRow = document.getElementById("repeat-count-row");
    if (repeatCountRow) {
        repeatCountRow.style.display = document.getElementById("indefiniteCheckbox").checked ? "none" : "block";
    }
    
    autoSaveReminders();
    startReminders();
});

// ✅ Updated due dates reminders listener
safeAddEventListenerById("dueDatesReminders", "change", () => {
    console.log('📅 Due dates reminders changed (Schema 2.5 only)');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for dueDatesReminders change');
        return;
    }
    
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    
    // ✅ Update only the due dates reminders setting in Schema 2.5
    if (!fullSchemaData.customReminders) {
        fullSchemaData.customReminders = {};
    }
    
    fullSchemaData.customReminders.dueDatesReminders = document.getElementById("dueDatesReminders").checked;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

    console.log(`💾 Saved Due Dates Reminders setting (Schema 2.5): ${fullSchemaData.customReminders.dueDatesReminders}`);
});

// ✅ Updated reminder input listeners
["repeatCount", "frequencyValue", "frequencyUnit"].forEach(id => {
    safeAddEventListenerById(id, "input", () => {
        console.log(`🔄 Reminder input changed: ${id} (Schema 2.5 only)`);
        
        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for reminder input change');
            return;
        }
        
        const settings = schemaData.reminders || {};
        if (settings.enabled) {
            autoSaveReminders();
            startReminders();
        }
    });
});

/**
 * Save the reminder state for a specific task inside the active miniCycle (Schema 2.5 only).
 * @param {string} taskId - The ID of the task to update.
 * @param {boolean} isEnabled - Whether reminders are enabled for this task.
 * @returns {void}
 */
function saveTaskReminderState(taskId, isEnabled) {
    console.log('🔔 Saving task reminder state (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for saveTaskReminderState');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    
    if (!activeCycle || !cycles[activeCycle]) {
        console.error('❌ No active cycle found for task reminder state');
        return;
    }
    
    console.log('🔍 Finding task for reminder state update:', taskId);
    
    const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);
    
    if (!task) {
        console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
        return;
    }
    
    console.log('📊 Updating reminder state:', {
        taskId,
        taskText: task.text,
        oldState: task.remindersEnabled,
        newState: isEnabled
    });
    
    // Update task reminder state
    task.remindersEnabled = isEnabled;
    
    // Update the full schema data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log(`✅ Task reminder state saved (Schema 2.5): ${taskId} = ${isEnabled}`);
}
/**
 * 📌 Handle click event for saving reminders settings.
 * - Saves the settings.
 * - Starts the reminders.
 * - Shows a confirmation alert.
 */

/**
 * 📌 Close the reminders settings modal when the close button is clicked.
 */
closeRemindersBtn.addEventListener("click", () => {
    remindersModal.style.display = "none";
});

/**
 * 📌 Close the reminders modal when clicking outside of it.
 */
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
function createRecurringNotificationWithTip(assignedTaskId, frequency, pattern) {
  if (!window.notifications || typeof window.notifications.createRecurringNotificationWithTip !== 'function') {
    return `Task set to recurring (${frequency}, ${pattern})`;
  }
  return notifications.createRecurringNotificationWithTip(assignedTaskId, frequency, pattern);
}


/**
 * ✅ Enhanced recurring notification listeners with proper event handling (Schema 2.5 only)
 */
function initializeRecurringNotificationListeners(notification) {
  if (!window.notifications || typeof window.notifications.initializeRecurringNotificationListeners !== 'function') {
    return;
  }
  return notifications.initializeRecurringNotificationListeners(notification);
}

/**
 * Show confirmation message after applying changes
 */
function showApplyConfirmation(targetElement) {
  return notifications.showApplyConfirmation(targetElement);
}

// 🛠 Unified recurring update helper (Schema 2.5 only)
function applyRecurringToTaskSchema25(taskId, newSettings, cycles, activeCycle) {
  // ✅ Use AppState instead of direct parameter passing
  if (!AppState.isReady()) {
    console.warn('⚠️ AppState not ready for applyRecurringToTaskSchema25');
    return;
  }

  const state = AppState.get();
  const activeCycleId = state.appState?.activeCycleId;
  
  if (!activeCycleId) {
    console.error('❌ No active cycle found for applyRecurringToTaskSchema25');
    return;
  }

  const cycleData = state.data?.cycles?.[activeCycleId];
  if (!cycleData) {
    console.error('❌ Cycle data not found for applyRecurringToTaskSchema25');
    return;
  }

  let task = cycleData.tasks.find(t => t.id === taskId);
  if (!task) {
    console.error('❌ Task not found for applyRecurringToTaskSchema25:', taskId);
    return;
  }

  // ✅ Update via AppState instead of localStorage
  AppState.update(draft => {
    const cycle = draft.data.cycles[activeCycleId];
    const targetTask = cycle.tasks.find(t => t.id === taskId);
    
    if (targetTask) {
      // Merge instead of overwrite so we keep advanced panel settings
      targetTask.recurringSettings = {
        ...targetTask.recurringSettings,
        ...newSettings
      };
      targetTask.recurring = true;
      targetTask.schemaVersion = 2;

      // Keep recurringTemplates in sync
      if (!cycle.recurringTemplates) cycle.recurringTemplates = {};
      cycle.recurringTemplates[taskId] = {
        ...(cycle.recurringTemplates[taskId] || {}),
        id: taskId,
        text: targetTask.text,
        recurring: true,
        schemaVersion: 2,
        recurringSettings: { ...targetTask.recurringSettings }
      };
    }
  });

  // Update DOM attributes for this task
  const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
  if (taskElement) {
    taskElement.classList.add("recurring");
    taskElement.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
    const recurringBtn = taskElement.querySelector(".recurring-btn");
    if (recurringBtn) {
      recurringBtn.classList.add("active");
      recurringBtn.setAttribute("aria-pressed", "true");
    }
  }

  // ✅ Update recurring panel display if it's open
  if (typeof updateRecurringPanel === 'function') {
    updateRecurringPanel();
  }
  
  // ✅ Update recurring summary to reflect changes
  if (typeof updateRecurringSummary === 'function') {
    updateRecurringSummary();
  }
  
  // ✅ Update panel button visibility based on recurring task count
  if (typeof updateRecurringPanelButtonVisibility === 'function') {
    updateRecurringPanelButtonVisibility();
  }
}

// Make recurring function globally accessible for the notification module
window.applyRecurringToTaskSchema25 = applyRecurringToTaskSchema25;

/**
 * 🔧 Enhanced showNotification function with educational tips support (Schema 2.5 only)
 */
function showNotificationWithTip(content, type = "default", duration = null, tipId = null) {
  if (!window.notifications || typeof window.notifications.showWithTip !== 'function') {
    return showNotification(content, type, duration);
  }
  return notifications.showWithTip(content, type, duration, tipId);
}

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
 * Startreminders function.
 *
 * @returns {void}
 */


  function sendReminderNotificationIfNeeded() {
      console.log('🔔 Sending reminder notification if needed (Schema 2.5 only)...');
      
      // ✅ Schema 2.5 only
      const schemaData = loadMiniCycleData();
      if (!schemaData) {
          console.error('❌ Schema 2.5 data required for sendReminderNotificationIfNeeded');
          throw new Error('Schema 2.5 data not found');
      }
  
      const { reminders } = schemaData;
      const remindersSettings = reminders || {};
      
      console.log('📊 Reminder settings:', remindersSettings);
  
      let tasksWithReminders = [...document.querySelectorAll(".task")]
          .filter(task => task.querySelector(".enable-task-reminders.reminder-active"));
  
      console.log("🔍 Tasks With Active Reminders:", tasksWithReminders.length);
  
      let incompleteTasks = tasksWithReminders
          .filter(task => !task.querySelector("input[type='checkbox']").checked)
          .map(task => task.querySelector(".task-text").textContent);
  
      if (incompleteTasks.length === 0) {
          console.log("✅ All tasks complete. Stopping reminders.");
          clearInterval(reminderIntervalId);
          return;
      }
  
      if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
          console.log("✅ Max reminders sent. Stopping reminders.");
          clearInterval(reminderIntervalId);
          return;
      }
  
      console.log('📢 Showing reminder notification for tasks:', incompleteTasks);
      showNotification(`🔔 You have tasks to complete:<br>- ${incompleteTasks.join("<br>- ")}`, "default");
      timesReminded++;
      
      console.log('✅ Reminder notification sent (Schema 2.5)');
  }

function startReminders() {
    console.log("🔄 Starting Reminder System (Schema 2.5 only)...");

    if (reminderIntervalId) {
        clearInterval(reminderIntervalId);
        console.log('🛑 Cleared existing reminder interval');
    }

    // ✅ Schema 2.5 only
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for startReminders');
        throw new Error('Schema 2.5 data not found');
    }

    const { reminders } = schemaData;
    const remindersSettings = reminders || {};
    
    console.log('📊 Loading reminder settings from Schema 2.5:', remindersSettings);
    
    if (!remindersSettings.enabled) {
        console.log('🔕 Reminders disabled in settings');
        return;
    }

    let multiplier = remindersSettings.frequencyUnit === "hours" ? 3600000 :
                     remindersSettings.frequencyUnit === "days" ? 86400000 : 60000;
    const intervalMs = remindersSettings.frequencyValue * multiplier;

    console.log('⏰ Reminder interval:', {
        value: remindersSettings.frequencyValue,
        unit: remindersSettings.frequencyUnit,
        intervalMs: intervalMs
    });

    // ⏱️ Use stored start time or now if missing
    const now = Date.now();
    const startTime = remindersSettings.reminderStartTime || now;
    const elapsedTime = now - startTime;
    const intervalsPassed = Math.floor(elapsedTime / intervalMs);

    timesReminded = intervalsPassed;
    lastReminderTime = startTime + (intervalsPassed * intervalMs);

    console.log(`⏱️ ${intervalsPassed} interval(s) have passed since reminderStartTime`);

    // If max reminders already sent, exit early
    if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
        console.log("✅ Max reminders already reached. Skipping further reminders.");
        return;
    }

    // Only send if enough time has passed since last reminder
    if ((Date.now() - lastReminderTime) >= intervalMs) {
        console.log("⏰ Sending catch-up reminder on startup.");
        sendReminderNotificationIfNeeded();
    } else {
        const timeUntilNext = intervalMs - (Date.now() - lastReminderTime);
        console.log(`⏳ Next reminder in ${Math.round(timeUntilNext / 1000 / 60)} minutes`);
    }

    // 🔁 Set up recurring reminders on interval
    reminderIntervalId = setInterval(() => {
        console.log('🔔 Reminder interval triggered');
        sendReminderNotificationIfNeeded();
    }, intervalMs);
    
    console.log('✅ Reminder system started successfully (Schema 2.5)');
}



  updateRecurringPanelButtonVisibility();


  function setupRecurringPanel() {
    const overlay = document.getElementById("recurring-panel-overlay");
    const panel = document.getElementById("recurring-panel");
    const closeBtn = document.getElementById("close-recurring-panel");
    const openBtn = document.getElementById("open-recurring-panel");
    const yearlyApplyToAllCheckbox = document.getElementById("yearly-apply-days-to-all");
    const specificDatesCheckbox = document.getElementById("recur-specific-dates");
    const specificDatesPanel = document.getElementById("specific-dates-panel");
    const toggleBtn = document.getElementById("toggle-advanced-settings");
   
    advancedVisible = false; // Use global variable instead of let
    setAdvancedVisibility(advancedVisible, toggleBtn);
  
    toggleBtn.addEventListener("click", () => {
        advancedVisible = !advancedVisible;
        setAdvancedVisibility(advancedVisible, toggleBtn);
    });
  
    if (!overlay || !panel || !closeBtn || !openBtn) return;
  
    openBtn.addEventListener("click", () => {
        console.log('🔁 Opening recurring panel (Schema 2.5 only)...');
        
        // ✅ Schema 2.5 only
        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for recurring panel');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];
        
        if (!currentCycle) {
            console.warn('⚠️ No active cycle found');
            return;
        }
        
        updateRecurringPanel(currentCycle);

        document.getElementById("recurring-settings-panel")?.classList.add("hidden");
        overlay.classList.remove("hidden");
        updateRecurringSettingsVisibility();
        document.getElementById("set-default-recurring").checked = false;
        
        console.log('✅ Recurring panel opened successfully');
    });

    // Rest of your existing setup code stays the same...
    closeBtn.addEventListener("click", () => {
        updateRecurringSettingsVisibility();
        overlay.classList.add("hidden");
    });
    
      overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
              updateRecurringSettingsVisibility();
              overlay.classList.add("hidden");
          }
      });
    
      // Rest of the function remains the same...
      const frequencySelect = document.getElementById("recur-frequency");
      if (frequencySelect) {
          frequencySelect.addEventListener("change", () => {
              const selectedFrequency = frequencySelect.value;
              const frequencyMap = {
                  hourly: document.getElementById("hourly-options"),
                  daily: document.getElementById("daily-options"),
                  weekly: document.getElementById("weekly-options"),
                  biweekly: document.getElementById("biweekly-options"),
                  monthly: document.getElementById("monthly-options"),
                  yearly: document.getElementById("yearly-options")
              };
              Object.values(frequencyMap).forEach(section => section?.classList.add("hidden"));
              frequencyMap[selectedFrequency]?.classList.remove("hidden");
          });
          updateRecurringSummary();
      }
      
      // Rest of the setup code remains the same...
      const toggleVisibility = (triggerId, contentId) => {
          const trigger = document.getElementById(triggerId);
          const content = document.getElementById(contentId);
          if (trigger && content) {
              trigger.addEventListener("change", () => {
                  content.classList.toggle("hidden", !trigger.checked);
              });
          }
      };
  
      toggleVisibility("hourly-specific-time", "hourly-minute-container");
      toggleVisibility("daily-specific-time", "daily-time-container");
      toggleVisibility("weekly-specific-days", "weekly-day-container");
      toggleVisibility("weekly-specific-time", "weekly-time-container");
      toggleVisibility("biweekly-specific-days", "biweekly-day-container");
      toggleVisibility("biweekly-specific-time", "biweekly-time-container");
      toggleVisibility("monthly-specific-days", "monthly-day-container");
      toggleVisibility("monthly-specific-time", "monthly-time-container");
      toggleVisibility("yearly-specific-months", "yearly-month-container");
      toggleVisibility("yearly-specific-time", "yearly-time-container");
  
      const yearlySpecificDaysCheckbox = document.getElementById("yearly-specific-days");
      const yearlyDayContainer = document.getElementById("yearly-day-container");
      const yearlyMonthSelect = document.getElementById("yearly-month-select");
  
      if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
          yearlySpecificDaysCheckbox.addEventListener("change", () => {
              const hasMonthSelected = getSelectedYearlyMonths().length > 0;
              yearlyDayContainer.classList.toggle("hidden", !yearlySpecificDaysCheckbox.checked || !hasMonthSelected);
          });
      }
  
      setupTimeConversion({ hourInputId: "specific-date-hour", minuteInputId: "specific-date-minute", meridiemSelectId: "specific-date-meridiem", militaryCheckboxId: "specific-date-military" });
      setupTimeConversion({ hourInputId: "daily-hour", minuteInputId: "daily-minute", meridiemSelectId: "daily-meridiem", militaryCheckboxId: "daily-military" });
      setupTimeConversion({ hourInputId: "weekly-hour", minuteInputId: "weekly-minute", meridiemSelectId: "weekly-meridiem", militaryCheckboxId: "weekly-military" });
      setupTimeConversion({ hourInputId: "biweekly-hour", minuteInputId: "biweekly-minute", meridiemSelectId: "biweekly-meridiem", militaryCheckboxId: "biweekly-military" });
      setupTimeConversion({ hourInputId: "monthly-hour", minuteInputId: "monthly-minute", meridiemSelectId: "monthly-meridiem", militaryCheckboxId: "monthly-military" });
      setupTimeConversion({ hourInputId: "yearly-hour", minuteInputId: "yearly-minute", meridiemSelectId: "yearly-meridiem", militaryCheckboxId: "yearly-military" });
  
      setupMilitaryTimeToggle("daily");
      setupMilitaryTimeToggle("weekly");
      setupMilitaryTimeToggle("biweekly");
      setupMilitaryTimeToggle("monthly");
      setupMilitaryTimeToggle("yearly");
  
      setupWeeklyDayToggle();
      generateMonthlyDayGrid();
      generateYearlyMonthGrid();
  
      if (yearlyMonthSelect) {
          yearlyMonthSelect.addEventListener("change", (e) => {
              const selectedMonth = parseInt(e.target.value);
              generateYearlyDayGrid(selectedMonth);
          });
          generateYearlyDayGrid(1);
      }
  
      yearlyApplyToAllCheckbox?.addEventListener("change", handleYearlyApplyToAllChange);
      setupSpecificDatesPanel();
      updateRecurringSummary();
  }

// Define the helper first
function setAdvancedVisibility(visible, toggleBtn) {
    advancedVisible = visible;
    toggleBtn.textContent = visible ? "Hide Advanced Options" : "Show Advanced Options";
  
    // Show/hide all `.frequency-options` panels
    document.querySelectorAll(".frequency-options").forEach(option => {
      option.style.display = visible ? "block" : "none";
    });
  
    // Always show frequency dropdown container
    const frequencyContainer = document.getElementById("recur-frequency-container");
    if (frequencyContainer) frequencyContainer.style.display = "block";
  
    // Handle extras like 'Recur indefinitely' and 'Specific Dates'
    const advancedControls = [
        { checkboxId: "recur-indefinitely" },
        { checkboxId: "recur-specific-dates" }
      ];


    advancedControls.forEach(({ checkboxId, panelId }) => {
      const checkbox = document.getElementById(checkboxId);
      if (!checkbox) return;
  
      const label = checkbox.closest("label");
      if (label) {
        label.style.display = visible ? "flex" : "none";
        
      }
    });
    const defaultBoxContainer = document.getElementById("set-default-recurring-container");
    if (defaultBoxContainer) {
      defaultBoxContainer.style.display = visible ? "block" : "none";
    }

  }

function updateRecurringPanel(currentCycleData = null) {
    console.log('🔄 Updating recurring panel (Schema 2.5 only)...');
    
    const recurringList = document.getElementById("recurring-task-list");
    
    // ✅ Use AppState only - no fallback to avoid state drift
    if (!window.AppState || !window.AppState.isReady()) {
        console.warn('⚠️ AppState not ready for updateRecurringPanel');
        return;
    }
    
    const state = window.AppState.get();
    const activeCycleId = state.appState?.activeCycleId;
    
    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring panel');
        return;
    }
    
    const cycles = state.data?.cycles || {};
    const schemaData = { cycles, activeCycle: activeCycleId };
    
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for updateRecurringPanel');
        throw new Error('Schema 2.5 data not found');
    }

    let cycleData = currentCycleData;
    
    if (!cycleData) {
        const { cycles, activeCycle } = schemaData;
        cycleData = cycles[activeCycle];
    }
    
    if (!cycleData) {
        console.warn('⚠️ No cycle data found for recurring panel');
        return;
    }
    
    console.log('📊 Processing recurring templates:', Object.keys(cycleData.recurringTemplates || {}).length);
    
    const templateTasks = Object.values(cycleData.recurringTemplates || {});
    const recurringTasks = templateTasks.map(template => {
        const existingTask = cycleData.tasks.find(t => t.id === template.id);
        return existingTask || template;
    });

    recurringList.innerHTML = "";

    if (recurringTasks.length === 0) {
        console.log('📋 No recurring tasks found, hiding panel');
        document.getElementById("recurring-panel-overlay")?.classList.add("hidden");
        return;
    }

    document.querySelectorAll(".recurring-task-item").forEach(el => {
        el.classList.remove("selected");
    });

    recurringTasks.forEach(task => {
        if (!task || !task.id || !task.text) {
            console.warn("⚠ Skipping malformed recurring task in panel:", task);
            return;
        }

        const item = document.createElement("li");
        item.className = "recurring-task-item";
        item.setAttribute("data-task-id", task.id);

        item.innerHTML = `
            <input type="checkbox" 
                   class="recurring-check" 
                   id="recurring-check-${task.id}" 
                   name="recurring-check-${task.id}" 
                   aria-label="Mark this task temporarily">
            <span class="recurring-task-text">${task.text}</span>
            <button title="Remove from Recurring" class="recurring-remove-btn">
              <i class='fas fa-trash recurring-trash-icon'></i>
            </button>
        `;

        const checkbox = item.querySelector(".recurring-check");
        checkbox.addEventListener("click", (e) => {
            e.stopPropagation();
            item.classList.toggle("checked");
        });
        checkbox.classList.add("hidden");

        // ✅ Handle remove button with Schema 2.5 only
        item.querySelector("button").addEventListener("click", () => {
            showConfirmationModal({
                title: "Remove Recurring Task",
                message: `Are you sure you want to remove "${task.text}" from recurring tasks?`,
                confirmText: "Remove",
                cancelText: "Cancel",
                callback: (confirmed) => {
                    if (!confirmed) return;

                    

                    // ✅ Schema 2.5 only
                    const schemaData = window.loadMiniCycleData();
                    if (!schemaData) {
                        console.error('❌ Schema 2.5 data required for task removal');
                        return;
                    }

                    const { cycles, activeCycle } = schemaData;
                    const currentCycle = cycles[activeCycle];
                    
                    // Remove recurrence from the live task
                    const liveTask = currentCycle.tasks.find(t => t.id === task.id);
                    if (liveTask) {
                        liveTask.recurring = false;
                        delete liveTask.recurringSettings;
                    }

                    // Delete from recurringTemplates
                    delete currentCycle.recurringTemplates[task.id];

                    // Update the full schema data
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    fullSchemaData.data.cycles[activeCycle] = currentCycle;
                    fullSchemaData.metadata.lastModified = Date.now();
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                    showNotification("↩️ Recurring turned off for this task.", "info", 5000);

                    // Remove recurring visual state
                    const matchingTaskItem = document.querySelector(`.task[data-task-id="${task.id}"]`);
                    if (matchingTaskItem) {
                        const recurringBtn = matchingTaskItem.querySelector(".recurring-btn");
                        if (recurringBtn) {
                            recurringBtn.classList.remove("active");
                            recurringBtn.setAttribute("aria-pressed", "false");
                            recurringBtn.disabled = false;
                        }
                        matchingTaskItem.classList.remove("recurring");
                        matchingTaskItem.removeAttribute("data-recurring-settings");
                    }

                    item.remove();
                    updateRecurringPanelButtonVisibility();

                    const remaining = Object.values(currentCycle.recurringTemplates || {});
                    if (remaining.length === 0) {
                        document.getElementById("recurring-panel-overlay")?.classList.add("hidden");
                    }

                    document.getElementById("undo-btn").hidden = false;
                    document.getElementById("redo-btn").hidden = true;
                }
            });
        });

        // ✅ Handle task row selection for preview
        item.addEventListener("click", (e) => {
            if (
                e.target.closest(".recurring-remove-btn") ||
                e.target.closest("input[type='checkbox']")
            ) return;

            document.querySelectorAll(".recurring-task-item").forEach(el => {
                el.classList.remove("selected");
            });
            item.classList.add("selected");

            const taskId = item.dataset.taskId;
            const fullTask = cycleData.tasks.find(t => t.id === taskId) || task;
            showTaskSummaryPreview(fullTask);
        });

        recurringList.appendChild(item);
    });

    updateRecurringSummary();
    console.log('✅ Recurring panel updated successfully');
}

// Make updateRecurringPanel globally accessible for the notification module
window.updateRecurringPanel = updateRecurringPanel;

// Make openRecurringSettingsPanelForTask globally accessible for the notification module
window.openRecurringSettingsPanelForTask = openRecurringSettingsPanelForTask;
  
  function openRecurringSettingsPanelForTask(taskIdToPreselect) {
      console.log('⚙️ Opening recurring settings panel (AppState-based)...', taskIdToPreselect);
      
      updateRecurringPanel(); // Render panel fresh
  
      // Find and preselect the correct task
      const itemToSelect = document.querySelector(`.recurring-task-item[data-task-id="${taskIdToPreselect}"]`);
      if (itemToSelect) {
          itemToSelect.classList.add("selected");
  
          const checkbox = itemToSelect.querySelector("input[type='checkbox']");
          if (checkbox) {
              checkbox.checked = true;
              itemToSelect.classList.add("checked");
          }
  
          // ✅ Use AppState instead of loadMiniCycleData
          if (!AppState.isReady()) {
              console.warn('⚠️ AppState not ready for task preview');
              return;
          }

          const state = AppState.get();
          const activeCycleId = state.appState?.activeCycleId;
          const task = state.data?.cycles?.[activeCycleId]?.tasks.find(t => t.id === taskIdToPreselect);
          
          if (task) {
              showTaskSummaryPreview(task);
          } else {
              console.warn('⚠️ Task not found for preview:', taskIdToPreselect);
          }
      }
  
      // Show panel
      document.getElementById("recurring-panel-overlay")?.classList.remove("hidden");
  
      // Make sure checkboxes and toggle show correctly
      updateRecurringSettingsVisibility();
      
      console.log('✅ Recurring settings panel opened successfully');
  }



  function updateRecurringSettingsVisibility() {
    const anySelected = document.querySelector(".recurring-task-item.selected");
    const settingsPanel = document.getElementById("recurring-settings-panel");
    const checkboxes = document.querySelectorAll(".recurring-check");
    const changeBtns = document.querySelectorAll(".change-recurring-btn");
    const toggleContainer = document.getElementById("recurring-toggle-actions");
    const toggleBtn = document.getElementById("toggle-check-all");
    const taskCount = document.querySelectorAll(".recurring-task-item").length;
  
    const show = !!anySelected;
  
    if (settingsPanel) {
      settingsPanel.classList.toggle("hidden", !show);
  
      // Show or hide checkboxes
      checkboxes.forEach(box => {
        box.classList.toggle("hidden", !show);
      });
  
      // Hide change buttons when panel is open
      changeBtns.forEach(btn => {
        btn.classList.toggle("hidden", show);
      });
    }
  
    // ✅ Only show toggle if panel is open AND checkboxes are visible AND more than one task
    const checkboxesVisible = Array.from(checkboxes).some(cb => !cb.classList.contains("hidden"));
    const shouldShowToggle = show && taskCount > 1 && checkboxesVisible;
    toggleContainer?.classList.toggle("hidden", !shouldShowToggle);
  
    // Update button label (optional)
    if (toggleBtn && shouldShowToggle) {
      const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked && !cb.classList.contains("hidden"));
      toggleBtn.textContent = anyUnchecked ? "Check All" : "Uncheck All";
    }
  
    updateRecurringSummary();
  }

  document.getElementById("toggle-check-all").addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".recurring-check:not(.hidden)");
    const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
  
    checkboxes.forEach(cb => {
      cb.checked = anyUnchecked;
      cb.closest(".recurring-task-item").classList.toggle("checked", anyUnchecked);
    });
  
    // 🔁 Update the label based on what you just did
    const toggleCheckAllBtn = document.getElementById("toggle-check-all");
    toggleCheckAllBtn.textContent = anyUnchecked ? "Uncheck All" : "Check All";
  
    updateRecurringSummary();
  });
  
  function loadRecurringSettingsForTask(task) {
    if (!task) return;
  
    const freqSelect = document.getElementById("recur-frequency");
    const recurCheckbox = document.getElementById("recur-indefinitely");
    const recurCountInput = document.getElementById("recur-count-input");
    const countContainer = document.getElementById("recur-count-container");
  
    if (freqSelect && task.recurFrequency) {
        freqSelect.value = task.recurFrequency;
        const changeEvent = new Event("change");
        freqSelect.dispatchEvent(changeEvent);
      }
  
    if (recurCheckbox) {
      recurCheckbox.checked = task.recurIndefinitely ?? true;
    }
  
    if (recurCountInput && task.recurCount != null) {
      recurCountInput.value = task.recurCount;
    }
    updateRecurCountVisibility();
    updateRecurringSummary();
  }






  document.getElementById("specific-date-specific-time").addEventListener("change", (e) => {
    const timeContainer = document.getElementById("specific-date-time-container");
    timeContainer.classList.toggle("hidden", !e.target.checked);
    updateRecurringSummary();
  });
  







  

  function saveRecurringTemplate(task, cycleName, savedMiniCycles) {
      console.log('💾 Saving recurring template (Schema 2.5 only)...');
      
      const schemaData = loadMiniCycleData();
      if (!schemaData) {
          console.error('❌ Schema 2.5 data required for saveRecurringTemplate');
          return;
      }
  
      const { cycles, activeCycle } = schemaData;
      const currentCycle = cycles[activeCycle];
      
      if (!currentCycle) {
          console.error(`❌ Cannot save recurring template. Active cycle not found.`);
          return;
      }
  
      if (!currentCycle.recurringTemplates) {
          currentCycle.recurringTemplates = {};
      }
  
      console.log('📊 Saving template for task:', task.id);
  
      currentCycle.recurringTemplates[task.id] = {
          id: task.id,
          text: task.text,
          recurring: true,
          recurringSettings: task.recurringSettings,
          highPriority: task.highPriority || false,
          dueDate: task.dueDate || null,
          remindersEnabled: task.remindersEnabled || false,
          lastTriggeredTimestamp: null,
          schemaVersion: task.schemaVersion || 2
      };
  
      // Update the full schema data
      const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
      fullSchemaData.data.cycles[activeCycle] = currentCycle;
      fullSchemaData.metadata.lastModified = Date.now();
      localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
      
      console.log('✅ Recurring template saved to Schema 2.5');
  }
function deleteRecurringTemplate(taskId, cycleName) {
    console.log('🗑️ Deleting recurring template (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for deleteRecurringTemplate');
        return;
    }

    const { cycles, activeCycle } = schemaData;
    const currentCycle = cycles[activeCycle];
    
    if (!currentCycle) {
        console.error(`❌ Active cycle not found for deleteRecurringTemplate.`);
        return;
    }

    if (!currentCycle.recurringTemplates || !currentCycle.recurringTemplates[taskId]) {
        console.warn(`⚠ Task "${taskId}" not found in recurring templates.`);
        return;
    }

    console.log('🔍 Deleting template for task:', taskId);

    // Delete the task template
    delete currentCycle.recurringTemplates[taskId];

    // Update the full schema data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = currentCycle;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log('✅ Recurring template deleted from Schema 2.5');
}

function saveAlwaysShowRecurringSetting() {
    console.log('💾 Saving always show recurring setting (AppState-based)...');
    
    const alwaysShow = document.getElementById("always-show-recurring").checked;
    
    // ✅ Check AppState readiness
    if (!AppState.isReady()) {
        console.warn('⚠️ AppState not ready for saveAlwaysShowRecurringSetting');
        return;
    }
    
    // ✅ Update via AppState instead of localStorage
    AppState.update(draft => {
        if (!draft.settings) draft.settings = {};
        draft.settings.alwaysShowRecurring = alwaysShow;
    });
    
    console.log('✅ Always show recurring setting saved via AppState:', alwaysShow);
    
    refreshTaskListUI();
    updateRecurringButtonVisibility();
}

function loadAlwaysShowRecurringSetting() {
    console.log('📥 Loading always show recurring setting (AppState-based)...');
    
    // ✅ Use AppState instead of loadMiniCycleData
    if (!AppState.isReady()) {
        console.warn('⚠️ AppState not ready for loadAlwaysShowRecurringSetting');
        return;
    }
    
    const state = AppState.get();
    const isEnabled = state.settings?.alwaysShowRecurring || false;
    
    console.log('📊 Loaded always show recurring setting from AppState:', isEnabled);
    
    const checkbox = document.getElementById("always-show-recurring");
    if (checkbox) {
        checkbox.checked = isEnabled;
    }
}

document.getElementById("always-show-recurring").addEventListener("change", saveAlwaysShowRecurringSetting);

document.getElementById("apply-recurring-settings")?.addEventListener("click", () => {
    console.log('📝 Applying recurring settings (AppState-based)...');
    
    // ✅ Check AppState readiness
    if (!AppState.isReady()) {
        console.warn('⚠️ AppState not ready for apply recurring settings');
        showNotification("❌ App not ready. Please try again.", "error");
        return;
    }

    const state = AppState.get();
    const activeCycleId = state.appState?.activeCycleId;
    
    if (!activeCycleId) {
        showNotification("⚠ No active cycle found.");
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        showNotification("⚠ Active cycle data not found.");
        return;
    }

    const checkedEls = document.querySelectorAll(".recurring-check:checked");

    if (!checkedEls.length) {
        showNotification("⚠ No tasks checked to apply settings.");
        return;
    }

    const settings = normalizeRecurringSettings(buildRecurringSettingsFromPanel());

    // 🕒 Set defaultRecurTime if not using specific time
    if (!settings.specificTime && !settings.defaultRecurTime) {
        settings.defaultRecurTime = new Date().toISOString();
    }

    // ✅ Batch all updates in one AppState operation
    AppState.update(draft => {
        // 💾 Save default recurring settings if requested
        if (document.getElementById("set-default-recurring")?.checked) {
            if (!draft.settings) draft.settings = {};
            draft.settings.defaultRecurringSettings = settings;
        }

        const cycle = draft.data.cycles[activeCycleId];
        if (!cycle.recurringTemplates) {
            cycle.recurringTemplates = {};
        }

        checkedEls.forEach(checkbox => {
            const taskEl = checkbox.closest("[data-task-id]");
            const taskId = taskEl?.dataset.taskId;
            if (!taskId || !taskEl) return;

            let task = cycle.tasks.find(t => t.id === taskId);
            if (!task) {
                task = {
                    id: taskId,
                    text: taskEl.querySelector(".recurring-task-text")?.textContent || "Untitled Task",
                    recurring: true,
                    recurringSettings: structuredClone(settings),
                    schemaVersion: 2
                };
                cycle.tasks.push(task);
            }

            // ✅ Apply recurring settings to task
            task.recurring = true;
            task.schemaVersion = 2;
            task.recurringSettings = structuredClone(settings);

            // ✅ Update recurringTemplates
            cycle.recurringTemplates[task.id] = {
                id: task.id,
                text: task.text,
                dueDate: task.dueDate || null,
                highPriority: task.highPriority || false,
                remindersEnabled: task.remindersEnabled || false,
                recurring: true,
                recurringSettings: structuredClone(settings),
                schemaVersion: 2
            };
        });
    });

    // ✅ Update DOM after state changes
    checkedEls.forEach(checkbox => {
        const taskEl = checkbox.closest("[data-task-id]");
        if (!taskEl) return;

        // ✅ Update DOM
        taskEl.classList.add("recurring");
        taskEl.setAttribute("data-recurring-settings", JSON.stringify(settings));
        const recurringBtn = taskEl.querySelector(".recurring-btn");
        if (recurringBtn) {
            recurringBtn.classList.add("active");
            recurringBtn.setAttribute("aria-pressed", "true");
        }

        syncRecurringStateToDOM(taskEl, settings);
    });

    // Show success notifications
    if (document.getElementById("set-default-recurring")?.checked) {
        showNotification("✅ Default recurring settings saved!", "success", 1500);
    }

    updateRecurringSummary();
    showNotification("✅ Recurring settings applied!", "success", 2000);
    updateRecurringPanel();

    // ✅ Refresh task preview if a task is currently selected
    const selectedTask = document.querySelector(".recurring-task-item.selected");
    if (selectedTask) {
        const taskId = selectedTask.dataset.taskId;
        const state = AppState.get();
        const activeCycleId = state.appState?.activeCycleId;
        const task = state.data?.cycles?.[activeCycleId]?.tasks.find(t => t.id === taskId);
        
        if (task) {
            showTaskSummaryPreview(task);
        }
    }

    // ✅ Clean up UI state - remove selections and hide panels
    document.querySelectorAll(".recurring-task-item").forEach(el => {
        el.classList.remove("selected", "checked");
    });

    const settingsPanel = document.getElementById("recurring-settings-panel");
    settingsPanel?.classList.add("hidden");

    // ✅ Explicitly hide checkboxes and toggle container
    document.querySelectorAll(".recurring-check").forEach(cb => {
        cb.classList.add("hidden");
        cb.checked = false;
    });

    const toggleContainer = document.getElementById("recurring-toggle-actions");
    toggleContainer?.classList.add("hidden");

    const preview = document.getElementById("recurring-summary-preview");
    if (preview) preview.classList.add("hidden");

    updateRecurringPanelButtonVisibility();
    
    // ✅ Clear the form since no task is selected anymore
    clearRecurringForm();
    
    console.log('✅ Recurring settings applied successfully');
});
  


  function normalizeRecurringSettings(settings = {}) {
    return {
      frequency: settings.frequency || "daily",
      indefinitely: settings.indefinitely !== false,
      count: settings.count ?? null,
      time: settings.time || null,
  
      specificDates: {
        enabled: settings.specificDates?.enabled || false,
        dates: Array.isArray(settings.specificDates?.dates) ? settings.specificDates.dates : []
      },
  
      hourly: {
        useSpecificMinute: settings.hourly?.useSpecificMinute || false,
        minute: settings.hourly?.minute || 0
      },
  
      weekly: {
        days: Array.isArray(settings.weekly?.days) ? settings.weekly.days : []
      },
  
      biweekly: {
        days: Array.isArray(settings.biweekly?.days) ? settings.biweekly.days : []
      },
  
      monthly: {
        days: Array.isArray(settings.monthly?.days) ? settings.monthly.days : []
      },
  
      yearly: {
        months: Array.isArray(settings.yearly?.months) ? settings.yearly.months : [],
        useSpecificDays: settings.yearly?.useSpecificDays || false,
        applyDaysToAll: settings.yearly?.applyDaysToAll !== false, // default is true
        daysByMonth: settings.yearly?.daysByMonth || {}
      }
    };
  }

  function buildRecurringSettingsFromPanel() {
    const frequency = document.getElementById("recur-frequency").value;
    const indefinitely = document.getElementById("recur-indefinitely").checked;
    const count = indefinitely ? null : parseInt(document.getElementById("recur-count-input").value) || 1;
    const settings = {
      frequency,
      indefinitely,
      count,
      useSpecificTime: false,
      time: null,
      specificDates: {
        enabled: false,
        dates: []
      },
      daily: {},
      hourly: {},
      weekly: {},
      biweekly: {},
      monthly: {},
      yearly: {}
    };
  
    // ✅ Specific Dates Mode
    if (document.getElementById("recur-specific-dates").checked) {
      const dateInputs = document.querySelectorAll("#specific-date-list input[type='date']");
      settings.specificDates.enabled = true;
      settings.specificDates.dates = Array.from(dateInputs).map(input => input.value).filter(Boolean);
  
      if (document.getElementById("specific-date-specific-time").checked) {
        settings.useSpecificTime = true;
        settings.time = {
          hour: parseInt(document.getElementById("specific-date-hour").value) || 0,
          minute: parseInt(document.getElementById("specific-date-minute").value) || 0,
          meridiem: document.getElementById("specific-date-meridiem").value,
          military: document.getElementById("specific-date-military").checked
        };
      }
    } else {
      // ✅ Time block for non-specific-dates
      const timeId = frequency;
      const timeEnabled = document.getElementById(`${timeId}-specific-time`)?.checked;
  
// ✅ Time block for non-specific-dates — EXCLUDE hourly!
if (frequency !== "hourly" && timeEnabled) {
  settings.useSpecificTime = true;
  settings.time = {
    hour: parseInt(document.getElementById(`${timeId}-hour`).value) || 0,
    minute: parseInt(document.getElementById(`${timeId}-minute`).value) || 0,
    meridiem: document.getElementById(`${timeId}-meridiem`).value,
    military: document.getElementById(`${timeId}-military`).checked
  };
}
  
      // ✅ Hourly Specific Minute
      if (frequency === "hourly") {
        const useSpecificMinute = document.getElementById("hourly-specific-time")?.checked;
        const minuteEl = document.getElementById("hourly-minute");
        
        settings.hourly = {
          useSpecificMinute: !!useSpecificMinute,
          minute: useSpecificMinute && minuteEl ? parseInt(minuteEl.value) || 0 : 0
        };
      }
  
      // ✅ Weekly & Biweekly
      if (frequency === "weekly" || frequency === "biweekly") {
        const selector = `.${frequency}-day-box.selected`;
        settings[frequency] = {
          useSpecificDays: document.getElementById(`${frequency}-specific-days`)?.checked,
          days: Array.from(document.querySelectorAll(selector)).map(el => el.dataset.day)
        };
      }
  
      // ✅ Monthly
      if (frequency === "monthly") {
        settings.monthly = {
          useSpecificDays: document.getElementById("monthly-specific-days")?.checked,
          days: Array.from(document.querySelectorAll(".monthly-day-box.selected")).map(el => parseInt(el.dataset.day))
        };
      }
  
      // ✅ Yearly
      if (frequency === "yearly") {
        const applyAll = document.getElementById("yearly-apply-days-to-all")?.checked;
        const useMonths = document.getElementById("yearly-specific-months")?.checked;
        const useDays = document.getElementById("yearly-specific-days")?.checked;
  
        settings.yearly = {
          useSpecificMonths: useMonths,
          months: getSelectedYearlyMonths(),
          useSpecificDays: useDays,
          daysByMonth: applyAll ? { all: selectedYearlyDays["all"] || [] } : { ...selectedYearlyDays },
          applyDaysToAll: applyAll
        };
      }
    }
  
    return settings;
  }
  

function clearNonRelevantRecurringFields(task, frequency) {
  const allowedFields = {
    daily: ["dailyTime"],
    weekly: ["weeklyDays"],
    biweekly: ["biweeklyDays"],
    monthly: ["monthlyDays"],
    yearly: ["yearlyMonths", "yearlyDates"],
    hourly: [],
  };

  const allExtraFields = [
    "specificDates", "specificTime",
    "dailyTime", "weeklyDays", "biweeklyDays", "monthlyDays",
    "yearlyMonths", "yearlyDates"
  ];

  const keep = allowedFields[frequency] || [];
  task.recurringSettings = Object.fromEntries(
    Object.entries(task.recurringSettings).filter(([key]) =>
      ["frequency", "count", "indefinitely", ...keep].includes(key)
    )
  );
}

function syncRecurringStateToDOM(taskEl, recurringSettings) {
  taskEl.setAttribute("data-recurring-settings", JSON.stringify(recurringSettings));
  const recurringBtn = taskEl.querySelector(".recurring-btn");
  if (recurringBtn) {
    recurringBtn.classList.add("active");
    recurringBtn.setAttribute("aria-pressed", "true");
  }
}











  const cancelBtn = document.getElementById("cancel-recurring-settings");

  cancelBtn?.addEventListener("click", () => {
    const settingsPanel = document.getElementById("recurring-settings-panel");
    settingsPanel?.classList.add("hidden");
  
    // Deselect all selected tasks
    document.querySelectorAll(".recurring-task-item").forEach(el => {
      el.classList.remove("selected");
      el.querySelector("input[type='checkbox']").checked = false;
    });
  
    // Hide checkboxes and uncheck them
    document.querySelectorAll(".recurring-check").forEach(cb => {
      cb.checked = false;
      cb.classList.add("hidden");
      cb.closest(".recurring-task-item")?.classList.remove("checked");
    });
  
    // Hide the summary preview if visible
    const preview = document.getElementById("recurring-summary-preview");
    if (preview) preview.classList.add("hidden");
  
    updateRecurringSettingsVisibility();
  });





  document.getElementById("recur-indefinitely").addEventListener("change", (e) => {
    const countContainer = document.getElementById("recur-count-container");
    const recurCount = document.getElementById("recur-count-input");
    const hidden = e.target.checked;
    countContainer.classList.toggle("hidden", hidden);
    updateRecurCountVisibility();
    updateRecurringSummary();
  });

  function setupBiweeklyDayToggle() {
    document.querySelectorAll(".biweekly-day-box").forEach(box => {
      box.addEventListener("click", () => {
        box.classList.toggle("selected");
      });
    });
  }

  setupBiweeklyDayToggle();
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("recurring-panel");
    const taskList = document.getElementById("recurring-task-list");
    const settingsPanel = document.getElementById("recurring-settings-panel");
    const overlay = document.getElementById("recurring-panel-overlay");
    const summaryPreview = document.getElementById("recurring-summary-preview");
  
    if (!overlay || overlay.classList.contains("hidden")) return;
  
    if (taskList.contains(e.target) || settingsPanel.contains(e.target)) return;
  
    // 🔽 New block for hiding summary preview
    if (summaryPreview && !summaryPreview.contains(e.target) && !taskList.contains(e.target)) {
      summaryPreview.classList.add("hidden");
      document.querySelectorAll(".recurring-task-item").forEach(el => el.classList.remove("selected"));
    }
  });









  function setupMilitaryTimeToggle(prefix) {
    const toggle = document.getElementById(`${prefix}-military`);
    const hourInput = document.getElementById(`${prefix}-hour`);
    const meridiemSelect = document.getElementById(`${prefix}-meridiem`);
  
    // ✅ Add better error handling
    if (!toggle || !hourInput || !meridiemSelect) {
      console.warn(`⚠️ Missing elements for military time toggle: ${prefix}`);
      return;
    }
  
    toggle.addEventListener("change", () => {
      const is24Hour = toggle.checked;
  
      // ✅ Add try-catch for safer property updates
      try {
        hourInput.min = is24Hour ? 0 : 1;
        hourInput.max = is24Hour ? 23 : 12;
        meridiemSelect.classList.toggle("hidden", is24Hour);
        
        // ✅ Update summary when time format changes
        if (typeof updateRecurringSummary === 'function') {
          updateRecurringSummary();
        }
      } catch (error) {
        console.warn(`⚠️ Error updating military time toggle for ${prefix}:`, error);
      }
    });
  }

  function setupTimeConversion({
    hourInputId,
    minuteInputId,
    meridiemSelectId,
    militaryCheckboxId
  }) {
    const hourInput = document.getElementById(hourInputId);
    const minuteInput = document.getElementById(minuteInputId);
    const meridiemSelect = document.getElementById(meridiemSelectId);
    const militaryToggle = document.getElementById(militaryCheckboxId);
  
    if (!hourInput || !minuteInput || !meridiemSelect || !militaryToggle) return;
  
    militaryToggle.addEventListener("change", () => {
      const is24Hour = militaryToggle.checked;
      let hour = parseInt(hourInput.value) || 0;
      let meridiem = meridiemSelect.value;
  
      if (is24Hour) {
        // Convert from 12h to 24h
        if (meridiem === "AM") {
          hour = hour === 12 ? 0 : hour;
        } else {
          hour = hour === 12 ? 12 : hour + 12;
        }
        hourInput.value = hour;
        meridiemSelect.classList.add("hidden");
      } else {
        // Convert from 24h to 12h
        if (hour === 0) {
          hourInput.value = 12;
          meridiemSelect.value = "AM";
        } else if (hour < 12) {
          hourInput.value = hour;
          meridiemSelect.value = "AM";
        } else if (hour === 12) {
          hourInput.value = 12;
          meridiemSelect.value = "PM";
        } else {
          hourInput.value = hour - 12;
          meridiemSelect.value = "PM";
        }
        meridiemSelect.classList.remove("hidden");
      }
    });
  }






  function generateMonthlyDayGrid() {
    const container = document.querySelector(".monthly-days");
    if (!container) return;
  
    container.innerHTML = "";
  
    for (let i = 1; i <= 31; i++) {
      const dayBox = document.createElement("div");
      dayBox.className = "monthly-day-box";
      dayBox.setAttribute("data-day", i);
      dayBox.textContent = i;
  
      // Toggle selection on click
      dayBox.addEventListener("click", () => {
        dayBox.classList.toggle("selected");
      });
  
      container.appendChild(dayBox);
    }
  }

  

  function setupWeeklyDayToggle() {
    document.querySelectorAll(".weekly-day-box").forEach(box => {
      box.addEventListener("click", () => {
        box.classList.toggle("selected");
      });
    });
  }



  function generateYearlyMonthGrid() {
    const container = document.querySelector(".yearly-months");
    if (!container) return;
  
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
    container.innerHTML = "";
  
    monthNames.forEach((name, index) => {
      const monthBox = document.createElement("div");
      monthBox.className = "yearly-month-box";
      monthBox.setAttribute("data-month", index + 1);
      monthBox.textContent = name;
  
      monthBox.addEventListener("click", () => {
        // Toggle selection
        monthBox.classList.toggle("selected");
  
        const selectedMonths = getSelectedYearlyMonths();
  
        // ✅ Reveal or hide the specific-days checkbox label
        const specificDaysLabel = document.getElementById("yearly-specific-days-label");
        if (specificDaysLabel) {
          specificDaysLabel.classList.toggle("hidden", selectedMonths.length === 0);
        }
  
        // Show/hide day container based on selection + checkbox state
        const yearlySpecificDaysCheckbox = document.getElementById("yearly-specific-days");
        const yearlyDayContainer = document.getElementById("yearly-day-container");
  
        if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
          const shouldShow = yearlySpecificDaysCheckbox.checked && selectedMonths.length > 0;
          yearlyDayContainer.classList.toggle("hidden", !shouldShow);
        }
  
        // Update dropdown
        const yearlyMonthSelect = document.getElementById("yearly-month-select");
        if (yearlyMonthSelect) {
          yearlyMonthSelect.innerHTML = "";
  
          selectedMonths.forEach((monthNum) => {
            const option = document.createElement("option");
            option.value = monthNum;
            option.textContent = new Date(0, monthNum - 1).toLocaleString('default', { month: 'long' });
            yearlyMonthSelect.appendChild(option);
          });
  
          if (selectedMonths.length > 0) {
            const currentMonth = index + 1;
            yearlyMonthSelect.value = currentMonth;
            generateYearlyDayGrid(currentMonth);
          } else {
            document.querySelector(".yearly-days").innerHTML = "";
          }
        }
      });
  
      container.appendChild(monthBox);
    });
  }

  
  function generateYearlyDayGrid(monthNumber) {
    const container = document.querySelector(".yearly-days");
    if (!container) return;
  
    container.innerHTML = "";
  
    const daysInMonth = new Date(2025, monthNumber, 0).getDate();
    const selectedDays = selectedYearlyDays[monthNumber] || [];
  const applyToAll = yearlyApplyToAllCheckbox?.checked;
const activeMonths = getSelectedYearlyMonths();

// If "apply to all" is checked, use the shared day list
const sharedDays = selectedYearlyDays["all"] || [];

for (let i = 1; i <= daysInMonth; i++) {
  const dayBox = document.createElement("div");
  dayBox.className = "yearly-day-box";
  dayBox.setAttribute("data-day", i);
  dayBox.textContent = i;

  const isSelected = applyToAll
    ? sharedDays.includes(i)
    : selectedDays.includes(i);

  if (isSelected) {
    dayBox.classList.add("selected");
  }

  dayBox.addEventListener("click", () => {
    dayBox.classList.toggle("selected");
    const isNowSelected = dayBox.classList.contains("selected");

    if (applyToAll) {
      // Update sharedDays
      if (isNowSelected && !sharedDays.includes(i)) {
        sharedDays.push(i);
      } else if (!isNowSelected && sharedDays.includes(i)) {
        const idx = sharedDays.indexOf(i);
        sharedDays.splice(idx, 1);
      }

      selectedYearlyDays["all"] = sharedDays;

      // Sync all selected months
      activeMonths.forEach(month => {
        selectedYearlyDays[month] = [...sharedDays];
      });
    } else {
      // Regular mode, per-month
      const current = selectedYearlyDays[monthNumber] || [];
      if (isNowSelected && !current.includes(i)) {
        current.push(i);
      } else if (!isNowSelected && current.includes(i)) {
        const idx = current.indexOf(i);
        current.splice(idx, 1);
      }
      selectedYearlyDays[monthNumber] = current;
    }
  });

  container.appendChild(dayBox);
}

  }
  
  function handleYearlyApplyToAllChange() {
    const checkbox = document.getElementById("yearly-apply-days-to-all");
    const dropdown = document.getElementById("yearly-month-select");
    const selectedMonths = getSelectedYearlyMonths();
  
    if (!checkbox || !dropdown) return;
  
    if (checkbox.checked) {
      dropdown.classList.add("hidden");
      if (selectedMonths.length > 0) {
        generateYearlyDayGrid(selectedMonths[0]); // Use any selected month for grid
      }
    } else {
      dropdown.classList.remove("hidden");
      const selectedMonth = parseInt(dropdown.value);
      generateYearlyDayGrid(selectedMonth);
    }
  }


  function getSelectedYearlyMonths() {
    return Array.from(document.querySelectorAll(".yearly-month-box.selected"))
                .map(el => parseInt(el.dataset.month));
  }

  function getSelectedMonthlyDays() {
    return Array.from(document.querySelectorAll(".monthly-day-box.selected"))
                .map(el => parseInt(el.dataset.day));
  }
  

function setupSpecificDatesPanel() {
  const checkbox = document.getElementById("recur-specific-dates");
  const panel = document.getElementById("specific-dates-panel");
  const timeOptions = document.getElementById("specific-date-time-options");
  const addBtn = document.getElementById("add-specific-date");
  const list = document.getElementById("specific-date-list");

  // ✅ Add error handling for missing elements
  if (!checkbox || !panel || !timeOptions || !addBtn || !list) {
    console.warn("⚠️ Missing elements for specific dates panel setup");
    return;
  }

  const createDateInput = (isFirst = false) => {
    const wrapper = document.createElement("div");
    wrapper.className = "specific-date-item";

    const input = document.createElement("input");
    input.type = "date";
    const index = list.children.length;
    input.setAttribute("aria-label", isFirst ? "First specific date" : `Specific date ${index + 1}`);
    input.required = true;
    
    // ✅ Better error handling for date setting
    try {
      input.valueAsDate = getTomorrow();
    } catch (error) {
      console.warn("⚠️ Could not set default date:", error);
    }

    if (isFirst) {
        input.classList.add("first-specific-date");
    }

    input.addEventListener("change", () => {
      if (isFirst && !input.value) {
        try {
          input.valueAsDate = getTomorrow();
        } catch (error) {
          console.warn("⚠️ Could not reset date:", error);
        }
      }
      updateRecurringSummary(); // ✅ Add this to update summary when date changes
    });

    wrapper.appendChild(input);

    if (!isFirst) {
      const trash = document.createElement("button");
      trash.type = "button";
      trash.className = "trash-btn";
      trash.innerHTML = "<i class='fas fa-trash recurring-date-trash-icon'></i>";
      trash.title = "Remove this date";

      trash.addEventListener("click", () => {
        wrapper.remove();
        updateRecurCountVisibility();
        updateRecurringSummary();
      });
      wrapper.appendChild(trash);
    }

    list.appendChild(wrapper);
    updateRecurringSummary(); // ✅ Update summary when new date is added
  };

  // Rest of the function remains the same...
  checkbox.addEventListener("change", () => {
    const shouldShow = checkbox.checked;
  
    panel.classList.toggle("hidden", !shouldShow);
    timeOptions.classList.toggle("hidden", !shouldShow);
  
    document.querySelectorAll(".frequency-options").forEach(panel => {
      panel.classList.add("hidden");
    });
  
    document.getElementById("recur-frequency-container").classList.toggle("hidden", shouldShow);
    document.getElementById("recur-indefinitely").closest("label").classList.toggle("hidden", shouldShow);
  
    const advancedBtn = document.getElementById("toggle-advanced-settings");
    if (advancedBtn) {
      advancedBtn.classList.toggle("hidden", shouldShow);
    }
  
    if (shouldShow && list.children.length === 0) {
      createDateInput(true);
    }
  
    if (!shouldShow) {
      document.getElementById("specific-date-specific-time").checked = false;
      document.getElementById("specific-date-time-container").classList.add("hidden");
  
      const freqSelect = document.getElementById("recur-frequency");
      if (freqSelect) {
        const event = new Event("change");
        freqSelect.dispatchEvent(event);
      }
    }
  
    updateRecurCountVisibility();
    updateRecurringSummary();
  });

  addBtn.addEventListener("click", () => {
    createDateInput(false);
  });

  updateRecurringSummary();
}
  
  function getTomorrow() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // ✅ Validate the date is reasonable
      if (isNaN(tomorrow.getTime()) || tomorrow.getFullYear() > 2100) {
        throw new Error("Invalid date generated");
      }
      
      return tomorrow;
    } catch (error) {
      console.warn("⚠️ Error generating tomorrow's date:", error);
      // ✅ Fallback to a basic future date
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 1);
      return fallback;
    }
  }

  function updateRecurCountVisibility() {
    const isIndefinite = document.getElementById("recur-indefinitely").checked;
    const isUsingSpecificDates = document.getElementById("recur-specific-dates").checked;
    const countContainer = document.getElementById("recur-count-container");
  
    // Only show if NOT using specific dates AND NOT recurring indefinitely
    const shouldShow = !isUsingSpecificDates && !isIndefinite;
    countContainer.classList.toggle("hidden", !shouldShow);
  }

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



function updateRecurringButtonVisibility() {
    console.log('🔄 Updating recurring button visibility (AppState-based)...');
    
    // ✅ Use AppState instead of loadMiniCycleData
    if (!AppState.isReady()) {
        console.warn('⚠️ AppState not ready for updateRecurringButtonVisibility');
        return;
    }

    const state = AppState.get();
    const activeCycleId = state.appState?.activeCycleId;
    
    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring button visibility');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn("⚠️ No active cycle found for recurring button visibility");
        return;
    }
    
    const settings = state.settings || {};
    
    console.log('📊 Checking visibility conditions:', {
        activeCycle: activeCycleId,
        autoReset: cycleData.autoReset,
        deleteCheckedTasks: cycleData.deleteCheckedTasks,
        alwaysShowRecurring: settings.alwaysShowRecurring
    });
    
    const autoReset = cycleData.autoReset || false;
    const deleteCheckedEnabled = cycleData.deleteCheckedTasks || false;
    const alwaysShowRecurring = settings.alwaysShowRecurring || false;
    
    // Check if buttons should be visible
    const shouldShowButtons = alwaysShowRecurring || (!autoReset && deleteCheckedEnabled);
    
    console.log('🔍 Button visibility decision:', {
        shouldShow: shouldShowButtons,
        reason: alwaysShowRecurring ? 'Always show enabled' : 
                (!autoReset && deleteCheckedEnabled) ? 'Manual mode with delete enabled' : 
                'Conditions not met'
    });

    document.querySelectorAll(".task").forEach(taskItem => {
        const recurringButton = taskItem.querySelector(".recurring-btn");
        if (!recurringButton) return;

        if (shouldShowButtons) {
            recurringButton.classList.remove("hidden");
            console.log('👁️ Showing recurring button for task:', taskItem.dataset.taskId);
            
            // ✅ Ensure event handler is attached when button becomes visible
            if (!recurringButton.dataset.handlerAttached) {
                const taskId = taskItem.dataset.taskId;
                const taskContext = buildTaskContext(taskItem, taskId);
                if (taskContext) {
                    setupRecurringButtonHandler(recurringButton, taskContext);
                    recurringButton.dataset.handlerAttached = 'true';
                    console.log('🔗 Attached recurring handler for task:', taskId);
                }
            }
        } else {
            recurringButton.classList.add("hidden");
            console.log('🙈 Hiding recurring button for task:', taskItem.dataset.taskId);
        }
    });
    
    console.log('✅ Recurring button visibility update completed');
}

function isAlwaysShowRecurringEnabled() {
    console.log('🔍 Checking always show recurring enabled (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for isAlwaysShowRecurringEnabled');
        return false;
    }
    
    // Check Schema 2.5 setting first, then DOM as fallback
    const result = schemaData.settings.alwaysShowRecurring || 
                   document.getElementById("always-show-recurring")?.checked || 
                   false;
    
    console.log('✅ Always show recurring enabled:', result);
    return result;
}
  
function updateRecurringPanelButtonVisibility() {
    const panelButton = document.getElementById("open-recurring-panel");
    if (!panelButton) return;
    
    // Simple check: get current data and look for recurring tasks
    let hasRecurring = false;
    
    try {
        const schemaData = loadMiniCycleData();
        if (schemaData?.cycles?.[schemaData.activeCycle]) {
            const cycle = schemaData.cycles[schemaData.activeCycle];
            hasRecurring = cycle.tasks.some(task => task.recurring) || 
                          Object.keys(cycle.recurringTemplates || {}).length > 0;
        }
    } catch (error) {
        console.warn('Could not check recurring tasks:', error);
        return;
    }
    
    panelButton.classList.toggle("hidden", !hasRecurring);
}
  
function updateRecurringSummary() {
    console.log('📝 Updating recurring summary (Schema 2.5 only)...');
    
    const summaryEl = document.getElementById("recurring-summary");
    if (!summaryEl) {
        console.warn('⚠️ Recurring summary element not found');
        return;
    }

    // ✅ Build settings from the panel input
    const settings = buildRecurringSettingsFromPanel();
    
    console.log('📊 Built settings from panel:', settings);

    // ✅ Simulate fallback default time (for preview only)
    if (!settings.useSpecificTime && !settings.defaultRecurTime) {
        settings.defaultRecurTime = new Date().toISOString();
        console.log('🕒 Added default recur time for preview');
    }

    // ✅ Generate summary text using the shared utility
    const summaryText = buildRecurringSummaryFromSettings(settings);
    
    console.log('📄 Generated summary text:', summaryText);

    // ✅ Apply to DOM
    summaryEl.textContent = summaryText;
    summaryEl.classList.remove("hidden");
    
    console.log('✅ Recurring summary updated successfully');
}

function parseDateAsLocal(dateStr) {
    console.log('📅 Parsing date as local:', dateStr);
    
    try {
        const [year, month, day] = dateStr.split("-").map(Number);
        const result = new Date(year, month - 1, day); // month is 0-indexed
        
        console.log('✅ Date parsed successfully:', result);
        return result;
    } catch (error) {
        console.error('❌ Error parsing date:', error);
        return new Date(); // fallback to today
    }
}

function attachRecurringSummaryListeners() {
    console.log('🔗 Attaching recurring summary listeners (Schema 2.5 only)...');
    
    const panel = document.getElementById("recurring-settings-panel");
    if (!panel) {
        console.warn('⚠️ Recurring settings panel not found');
        return;
    }
    
    safeAddEventListener(panel, "change", handleRecurringChange);
    safeAddEventListener(panel, "click", handleRecurringClick);
    
    console.log('✅ Recurring summary listeners attached successfully');
}

function showTaskSummaryPreview(task) {
    console.log('👁️ Showing task summary preview (Schema 2.5 only)...', task?.id);
    
    if (!task || !task.id) {
        console.warn("⚠️ No valid task provided for recurring preview.");
        return;
    }

    const summaryContainer = document.getElementById("recurring-summary-preview") || createTaskSummaryPreview();
    summaryContainer.innerHTML = "";

    // ✅ Use AppState instead of loadMiniCycleData
    if (!AppState.isReady()) {
        console.warn('⚠️ AppState not ready for showTaskSummaryPreview');
        return;
    }

    const state = AppState.get();
    const activeCycleId = state.appState?.activeCycleId;
    
    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for task preview');
        return;
    }

    const currentCycle = state.data?.cycles?.[activeCycleId];
    if (!currentCycle) {
        console.warn('⚠️ No active cycle found for task preview');
        return;
    }
    
    console.log('🔍 Looking for recurring settings for task:', task.id);
    
    const recurringSettings = task.recurringSettings ||
                             currentCycle?.recurringTemplates?.[task.id]?.recurringSettings;
    
    console.log('📊 Found recurring settings:', !!recurringSettings);

    // 🏷️ Label
    const label = document.createElement("div");
    label.textContent = "Current Recurring Settings:";
    label.className = "summary-label";
    summaryContainer.appendChild(label);

    // 📄 Summary Text
    const summaryText = document.createElement("div");
    summaryText.className = "summary-text";
    summaryText.textContent = recurringSettings
        ? getRecurringSummaryText(recurringSettings)
        : "This task is not marked as recurring.";
    summaryContainer.appendChild(summaryText);

    // 🔘 Change Button
    const changeBtn = document.createElement("button");
    changeBtn.textContent = "Change Recurring Settings";
    changeBtn.className = "change-recurring-btn";
    changeBtn.setAttribute("aria-label", "Change recurring settings for this task");

    const settingsPanel = document.getElementById("recurring-settings-panel");
    if (settingsPanel && !settingsPanel.classList.contains("hidden")) {
        changeBtn.classList.add("hidden");
    }

    changeBtn.addEventListener("click", () => {
        console.log('🔘 Opening recurring settings panel for task:', task.id);
        openRecurringSettingsPanelForTask(task.id);
    });

    summaryContainer.appendChild(changeBtn);
    summaryContainer.classList.remove("hidden");
    
    // ✅ Populate form with task's current settings
    if (recurringSettings) {
        populateRecurringFormWithSettings(recurringSettings);
    }
    
    console.log('✅ Task summary preview displayed successfully');
}

// ✅ New function to populate form with existing settings
function populateRecurringFormWithSettings(settings) {
    console.log('📝 Populating recurring form with settings:', settings);
    
    try {
        // Frequency dropdown
        const frequencySelect = document.getElementById('recur-frequency');
        if (frequencySelect && settings.frequency) {
            frequencySelect.value = settings.frequency;
            frequencySelect.dispatchEvent(new Event('change'));
        }
        
        // Indefinite checkbox
        const indefiniteCheckbox = document.getElementById('indefiniteCheckbox');
        if (indefiniteCheckbox) {
            indefiniteCheckbox.checked = settings.indefinitely !== false;
        }
        
        // Repeat count
        if (settings.indefinitely === false && settings.repeatCount) {
            const repeatCountInput = document.getElementById('repeatCount');
            if (repeatCountInput) {
                repeatCountInput.value = settings.repeatCount;
            }
        }
        
        // Specific time settings
        if (settings.useSpecificTime && settings.specificTime) {
            const useTimeCheckbox = document.getElementById('useSpecificTime');
            const timeInput = document.getElementById('specificTime');
            
            if (useTimeCheckbox) useTimeCheckbox.checked = true;
            if (timeInput) {
                // Convert ISO string to HH:MM format
                const timeDate = new Date(settings.specificTime);
                const hours = timeDate.getHours().toString().padStart(2, '0');
                const minutes = timeDate.getMinutes().toString().padStart(2, '0');
                timeInput.value = `${hours}:${minutes}`;
            }
        }
        
        // Populate frequency-specific settings
        if (settings.frequency === 'weekly' && settings.daysOfWeek) {
            settings.daysOfWeek.forEach(day => {
                const dayBox = document.querySelector(`.weekly-day-box[data-day="${day}"]`);
                if (dayBox) dayBox.classList.add('selected');
            });
        }
        
        if (settings.frequency === 'monthly' && settings.days) {
            settings.days.forEach(day => {
                const dayBox = document.querySelector(`.monthly-day-box[data-day="${day}"]`);
                if (dayBox) dayBox.classList.add('selected');
            });
        }
        
        if (settings.frequency === 'yearly' && settings.daysByMonth) {
            Object.entries(settings.daysByMonth).forEach(([month, days]) => {
                if (month !== 'all') {
                    const monthBox = document.querySelector(`.yearly-month-box[data-month="${month}"]`);
                    if (monthBox) monthBox.classList.add('selected');
                }
                
                days.forEach(day => {
                    const dayBox = document.querySelector(`.yearly-day-box[data-day="${day}"]`);
                    if (dayBox) dayBox.classList.add('selected');
                });
            });
        }
        
        // Update the summary display
        updateRecurringSummary();
        
        console.log('✅ Form populated successfully');
        
    } catch (error) {
        console.error('❌ Error populating form with settings:', error);
    }
}

// ✅ New function to clear/reset the recurring form
function clearRecurringForm() {
    console.log('🧹 Clearing recurring form');
    
    try {
        // Reset frequency to default
        const frequencySelect = document.getElementById('recur-frequency');
        if (frequencySelect) {
            frequencySelect.value = 'daily';
            frequencySelect.dispatchEvent(new Event('change'));
        }
        
        // Reset indefinite checkbox
        const indefiniteCheckbox = document.getElementById('indefiniteCheckbox');
        if (indefiniteCheckbox) {
            indefiniteCheckbox.checked = true;
        }
        
        // Clear repeat count
        const repeatCountInput = document.getElementById('repeatCount');
        if (repeatCountInput) {
            repeatCountInput.value = '';
        }
        
        // Clear specific time settings
        const useTimeCheckbox = document.getElementById('useSpecificTime');
        const timeInput = document.getElementById('specificTime');
        
        if (useTimeCheckbox) useTimeCheckbox.checked = false;
        if (timeInput) timeInput.value = '';
        
        // Clear all selected day boxes
        document.querySelectorAll('.weekly-day-box.selected, .biweekly-day-box.selected, .monthly-day-box.selected, .yearly-day-box.selected, .yearly-month-box.selected').forEach(box => {
            box.classList.remove('selected');
        });
        
        // Update the summary
        updateRecurringSummary();
        
        console.log('✅ Form cleared successfully');
        
    } catch (error) {
        console.error('❌ Error clearing form:', error);
    }
}
  // Helper to create the preview container if it doesn’t exist yet
  function createTaskSummaryPreview() {
    const container = document.createElement("div");
    container.id = "recurring-summary-preview";
    container.className = "recurring-summary recurring-summary-preview hidden";
    document.getElementById("recurring-panel").appendChild(container);
    return container;
  }
  

// Before:
function getRecurringSummaryText(template) {
  return buildRecurringSummaryFromSettings(template.recurringSettings || {});
}




// ✅ Shared utility: Build a recurring summary string from a settings object
function buildRecurringSummaryFromSettings(settings = {}) {
  const freq = settings.frequency || "daily";
  const indefinitely = settings.indefinitely ?? true;
  const count = settings.count;

  // === ✅ SPECIFIC DATES OVERRIDE ===
  if (settings.specificDates?.enabled && settings.specificDates.dates?.length) {
    const formattedDates = settings.specificDates.dates.map(dateStr => {
      const date = parseDateAsLocal(dateStr);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short"
      });
    });

    let summary = `📅 Specific dates: ${formattedDates.join(", ")}`;

    // Optionally show time for specific dates
    if (settings.time) {
      const { hour, minute, meridiem, military } = settings.time;
      const formattedTime = military
        ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
      summary += ` ⏰ at ${formattedTime}`;
    } else if (!settings.useSpecificTime && settings.defaultRecurTime) {
      const time = new Date(settings.defaultRecurTime);
      const fallbackTime = time.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      summary += ` ⏰ at ${fallbackTime}`;
    }

    return summary;
  }

  // === 🔁 Normal Recurrence Fallback ===
  let summaryText = `⏱ Repeats ${freq}`;
  if (!indefinitely && count) {
    summaryText += ` for ${count} time${count !== 1 ? "s" : ""}`;
  } else {
    summaryText += " indefinitely";
  }

  // === TIME HANDLING ===
  if (settings.time && (settings.useSpecificTime ?? true)) {
    const { hour, minute, meridiem, military } = settings.time;
    const formatted = military
      ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
      : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
    summaryText += ` at ${formatted}`;
  } else if (!settings.useSpecificTime && settings.defaultRecurTime) {
    const time = new Date(settings.defaultRecurTime);
    const fallbackTime = time.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    summaryText += ` at ${fallbackTime}`;
  }

  // === HOURLY ===
  if (freq === "hourly" && settings.hourly?.useSpecificMinute) {
    summaryText += ` every hour at :${settings.hourly.minute.toString().padStart(2, "0")}`;
  }

  // === WEEKLY & BIWEEKLY ===
  if ((freq === "weekly" || freq === "biweekly") && settings[freq]?.days?.length) {
    summaryText += ` on ${settings[freq].days.join(", ")}`;
  }

  // === MONTHLY ===
  if (freq === "monthly" && settings.monthly?.days?.length) {
    summaryText += ` on day${settings.monthly.days.length > 1 ? "s" : ""} ${settings.monthly.days.join(", ")}`;
  }

  // === YEARLY ===
  if (freq === "yearly") {
    const months = settings.yearly?.months || [];
    const daysByMonth = settings.yearly?.daysByMonth || {};

    if (months.length) {
      const monthNames = months.map(m => new Date(0, m - 1).toLocaleString("default", { month: "short" }));
      summaryText += ` in ${monthNames.join(", ")}`;
    }

    if (settings.yearly?.useSpecificDays) {
      if (settings.yearly.applyDaysToAll && daysByMonth.all?.length) {
        summaryText += ` on day${daysByMonth.all.length > 1 ? "s" : ""} ${daysByMonth.all.join(", ")}`;
      } else {
        const parts = months.map(month => {
          const days = daysByMonth[month] || [];
          if (days.length === 0) return null;
          const monthName = new Date(0, month - 1).toLocaleString("default", { month: "short" });
          return `${monthName}: ${days.join(", ")}`;
        }).filter(Boolean);

        if (parts.length) {
          summaryText += ` on ${parts.join("; ")}`;
        }
      }
    }
  }

  return summaryText;
}

// Usage in summary preview:
// const summary = buildRecurringSummaryFromSettings(task.recurringSettings);

function removeRecurringTasksFromCycle(taskElements, cycleData) {
    taskElements.forEach(taskEl => {
        const taskId = taskEl.dataset.taskId;
        const isRecurring = taskEl.classList.contains("recurring");

        if (isRecurring) {
            // Remove from DOM
            taskEl.remove();
            
            // ✅ IMPORTANT: Only remove from tasks array, keep in recurringTemplates
            if (cycleData.tasks) {
                const taskIndex = cycleData.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    cycleData.tasks.splice(taskIndex, 1);
                }
            }
            
            // ✅ Keep in recurringTemplates so they can be recreated
            // DON'T delete from recurringTemplates here
        }
    });
}

function handleRecurringTasksAfterReset() {
    console.log('🔄 Handling recurring tasks after reset (Schema 2.5 only)...');
    
    // ✅ Schema 2.5 only
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for handleRecurringTasksAfterReset');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    const cycleData = cycles[activeCycle];
    
    if (!cycleData) {
        console.warn('⚠️ No active cycle data found for recurring task reset');
        return;
    }
    
    console.log('📊 Processing recurring tasks reset for cycle:', activeCycle);
    
    const taskElements = [...taskList.querySelectorAll(".task")];
    console.log('🔍 Found task elements for processing:', taskElements.length);
    
    // ✅ Reuse the same helper function
    removeRecurringTasksFromCycle(taskElements, cycleData);
    
    // ✅ Update the full schema data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = cycleData;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log('💾 Recurring tasks reset saved to Schema 2.5');
    
    // ✅ Update UI components
    updateProgressBar();
    updateStatsPanel();
    checkCompleteAllButton();
    
    console.log('✅ Recurring tasks after reset handling completed');
}


function convert12To24(hour, meridiem) {
  hour = parseInt(hour, 10);
  if (meridiem === "PM" && hour !== 12) return hour + 12;
  if (meridiem === "AM" && hour === 12) return 0;
  return hour;
}


// ✅ Main logic to determine if a task should recur today
function shouldTaskRecurNow(settings, now = new Date()) {
 // ✅ Specific Dates override all… but still honor specific‑time if set
if (settings.specificDates?.enabled) {
  const todayMatch = settings.specificDates.dates?.some(dateStr => {
    const date = parseDateAsLocal(dateStr);
    return date.getFullYear() === now.getFullYear()
        && date.getMonth()  === now.getMonth()
        && date.getDate()   === now.getDate();
  });
  if (!todayMatch) return false;

  // Only trigger at the exact time if the user checked “specific time”
  if (settings.time) {
    const hour   = settings.time.military
                   ? settings.time.hour
                   : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }

  return true;
}

  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const day = now.getDate();
  const month = now.getMonth() + 1;

  switch (settings.frequency) {
case "daily":
  if (settings.time) {
    const hour = settings.time.military
      ? settings.time.hour
      : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }
  return now.getHours() === 0 && now.getMinutes() === 0;

   case "weekly":
case "biweekly":
  if (!settings[settings.frequency]?.days?.includes(weekday)) return false;

  if (settings.time) {
    const hour = settings.time.military
      ? settings.time.hour
      : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }

  return true; // if no time set, recur any time today


   case "monthly":
  if (!settings.monthly?.days?.includes(day)) return false;

  if (settings.time) {
    const hour = settings.time.military
      ? settings.time.hour
      : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }

  return true; // If no time is set, trigger any time during the day

    case "yearly":
  if (!settings.yearly?.months?.includes(month)) return false;

  if (settings.yearly.useSpecificDays) {
    const daysByMonth = settings.yearly.daysByMonth || {};
    const days = settings.yearly.applyDaysToAll
      ? daysByMonth.all || []
      : daysByMonth[month] || [];

    if (!days.includes(day)) return false;
  }

  if (settings.time) {
    const hour = settings.time.military
      ? settings.time.hour
      : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }

  return true; // If no time is set, recur any time that day

    case "hourly":
      if (settings.hourly?.useSpecificMinute) {
        const minute = now.getMinutes();
        return minute === settings.hourly.minute;
      }
      return now.getMinutes() === 0;

    default:
      return false;
  }
}







// ✅ Helper: Check if a recurring task should be recreated
function shouldRecreateRecurringTask(template, taskList, now) {
  const { id, text, recurringSettings, recurring, lastTriggeredTimestamp, suppressUntil } = template;

  if (!recurring || !recurringSettings) return false;

  // 🔒 Already exists?
  if (taskList.some(task => task.id === id)) return false;

  // ⏸️ Suppressed?
  if (suppressUntil && new Date(suppressUntil) > now) {
    console.log(`⏸ Skipping "${text}" — suppressed until ${suppressUntil}`);
    return false;
  }

  // ⏱ Triggered recently?
  if (lastTriggeredTimestamp) {
    const last = new Date(lastTriggeredTimestamp);
    const sameMinute =
      last.getFullYear() === now.getFullYear() &&
      last.getMonth()    === now.getMonth()    &&
      last.getDate()     === now.getDate()     &&
      last.getHours()    === now.getHours()    &&
      last.getMinutes()  === now.getMinutes();
    if (sameMinute) return false;
  }

  // 🧠 Recurrence match?
  return shouldTaskRecurNow(recurringSettings, now);
}

function watchRecurringTasks() {
    console.log('👁️ Watching recurring tasks (AppState-based)...');
    
    // ✅ Check feature flag
    if (!window.FeatureFlags?.recurringEnabled) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return;
    }
    
    // ✅ Read from AppState instead of localStorage
    if (!AppState.isReady()) {
        console.warn('⚠️ AppState not ready for recurring task watch');
        return;
    }
    
    const state = AppState.get();
    const activeCycleId = state.appState?.activeCycleId;
    
    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring task watch');
        return;
    }
    
    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for recurring task watch');
        return;
    }

    const templates = cycleData.recurringTemplates || {};
    const taskList = cycleData.tasks || [];

    if (!Object.keys(templates).length) {
        console.log('📋 No recurring templates found');
        return;
    }

    console.log('🔍 Checking recurring templates:', Object.keys(templates).length);

    const now = new Date();
    const tasksToAdd = [];
    const templateUpdates = {};

    // ✅ Collect changes without mutating state directly
    Object.values(templates).forEach(template => {
        // ⛔ Prevent re-adding if task already exists by ID
        if (taskList.some(task => task.id === template.id)) return;
        if (!shouldRecreateRecurringTask(template, taskList, now)) return;

        console.log("⏱ Auto‑recreating recurring task:", template.text);

        tasksToAdd.push({
            text: template.text,
            completed: false,
            dueDate: template.dueDate,
            highPriority: template.highPriority,
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings
        });

        templateUpdates[template.id] = {
            ...template,
            lastTriggeredTimestamp: now.getTime()
        };
    });

    // ✅ Batch all changes in one AppState update
    if (tasksToAdd.length > 0) {
        AppState.update(draft => {
            const cycle = draft.data.cycles[activeCycleId];
            
            // Add new recurring tasks
            tasksToAdd.forEach(taskData => {
                cycle.tasks.push({
                    ...taskData,
                    dateCreated: now.toISOString()
                });
            });
            
            // Update template timestamps
            Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        });
        
        console.log(`✅ Added ${tasksToAdd.length} recurring tasks via AppState`);
    }
}

function setupRecurringWatcher() {
    console.log('⚙️ Setting up recurring watcher (AppState-based)...');
    
    // ✅ Check feature flag
    if (!window.FeatureFlags?.recurringEnabled) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return;
    }
    
    // ✅ Check AppState readiness with deferred setup
    if (!AppState.isReady()) {
        console.log('⏳ AppState not ready, deferring recurring watcher setup...');
        
        // Defer setup until AppState is ready
        window._deferredRecurringSetup = window._deferredRecurringSetup || [];
        window._deferredRecurringSetup.push(() => setupRecurringWatcher());
        return;
    }
    
    // ✅ Read from AppState instead of loadMiniCycleData
    const state = AppState.get();
    const activeCycleId = state.appState?.activeCycleId;
    
    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring watcher setup');
        return;
    }
    
    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for recurring watcher setup');
        return;
    }

    const recurringTemplates = cycleData.recurringTemplates || {};
    
    if (Object.keys(recurringTemplates).length === 0) {
        console.log('📋 No recurring templates found, skipping watcher setup');
        return;
    }

    console.log('🔄 Setting up recurring task watcher with', Object.keys(recurringTemplates).length, 'templates');

    watchRecurringTasks();
    setInterval(watchRecurringTasks, 30000);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            console.log('👁️ Page became visible, checking recurring tasks');
            watchRecurringTasks();
        }
    });
    
    console.log('✅ Recurring watcher setup completed');
}




/**
 * Setupsettingsmenu function.
 *
 * @returns {void}
 */
function setupSettingsMenu() {
    const settingsModal = document.querySelector(".settings-modal");
    const settingsModalContent = document.querySelector(".settings-modal-content");
    const openSettingsBtn = document.getElementById("open-settings");
    const closeSettingsBtn = document.getElementById("close-settings");

    /**
     * Opens the settings menu.
     *
     * @param {Event} event - The click event.
     */
    function openSettings(event) {
        event.stopPropagation();
        settingsModal.style.display = "flex";
        hideMainMenu();
    }

    /**
     * Closes the settings menu.
     */
    function closeSettings() {
        settingsModal.style.display = "none";
    }

    function closeOnClickOutside(event) {
        if (settingsModal.style.display === "flex" && 
            !settingsModalContent.contains(event.target) && 
            event.target !== openSettingsBtn) {
            settingsModal.style.display = "none";
        }
    }

    // ✅ Remove previous listeners before adding new ones
    openSettingsBtn.removeEventListener("click", openSettings);
    closeSettingsBtn.removeEventListener("click", closeSettings);
    document.removeEventListener("click", closeOnClickOutside);

    // ✅ Add event listeners (only once)
    openSettingsBtn.addEventListener("click", openSettings);
    closeSettingsBtn.addEventListener("click", closeSettings);
    document.addEventListener("click", closeOnClickOutside);

    // ✅ Dark Mode Toggle (Check if the element exists first)
    setupDarkModeToggle("darkModeToggle", ["darkModeToggle", "darkModeToggleThemes"]);
    
    // ✅ Setup Quick Dark Toggle right after primary toggle
    setupQuickDarkToggle();


// ✅ Toggle Move Arrows Setting (Schema 2.5 only)
const moveArrowsToggle = document.getElementById("toggle-move-arrows");
if (moveArrowsToggle) {
    console.log('🔄 Setting up move arrows toggle (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for move arrows toggle');
        return;
    }
    
    // ✅ Use state-based approach for move arrows setting
    let moveArrowsEnabled = false;
    
    if (window.AppState?.isReady?.()) {
        const currentState = window.AppState.get();
        moveArrowsEnabled = currentState?.ui?.moveArrowsVisible || false;
    } else {
        // Fallback for legacy or when state isn't ready
        const schemaData = loadMiniCycleData();
        moveArrowsEnabled = schemaData?.settings?.showMoveArrows || false;
    }
    
    console.log('📊 Loading move arrows setting from state:', moveArrowsEnabled);
    
    moveArrowsToggle.checked = moveArrowsEnabled;
    
    moveArrowsToggle.addEventListener("change", () => {
        const enabled = moveArrowsToggle.checked;
        
        console.log('🔄 Move arrows toggle changed:', enabled);
        
        // ✅ Use state system if available
        if (window.AppState?.isReady?.()) {
            window.AppState.update(state => {
                if (!state.ui) state.ui = {};
                state.ui.moveArrowsVisible = enabled;
                state.metadata.lastModified = Date.now();
            }, true); // immediate save
            
            console.log('✅ Move arrows setting saved to state:', enabled);
        } else {
            // ✅ Fallback to localStorage if state not ready
            console.warn('⚠️ AppState not ready, using localStorage fallback');
            const schemaData = loadMiniCycleData();
            if (schemaData) {
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                fullSchemaData.settings.showMoveArrows = enabled;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            }
        }
        
        updateMoveArrowsVisibility();
    });
    
    console.log('✅ Move arrows toggle setup completed');
}

// ✅ Toggle Three-Dot Menu Setting (Schema 2.5 only)
const threeDotsToggle = document.getElementById("toggle-three-dots");
if (threeDotsToggle) {
    console.log('🔄 Setting up three dots toggle (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for three dots toggle');
        return;
    }
    
    const threeDotsEnabled = schemaData.settings.showThreeDots || false;
    
    console.log('📊 Loading three dots setting from Schema 2.5:', threeDotsEnabled);
    
    threeDotsToggle.checked = threeDotsEnabled;
    document.body.classList.toggle("show-three-dots-enabled", threeDotsEnabled);

    threeDotsToggle.addEventListener("change", () => {
        const enabled = threeDotsToggle.checked;
        
        console.log('🔄 Three dots toggle changed:', enabled);
        
        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for saving three dots setting');
            return;
        }
        
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.settings.showThreeDots = enabled;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
        console.log('✅ Three dots setting saved to Schema 2.5:', enabled);
        
        document.body.classList.toggle("show-three-dots-enabled", enabled);

        // ✅ Disable/enable hover behavior for current tasks
        toggleHoverTaskOptions(!enabled);

        // ✅ Update task list UI
        refreshTaskListUI(); 
    });
    
    console.log('✅ Three dots toggle setup completed');
}

             // ✅ Update backup function to be Schema 2.5 only
      document.getElementById("backup-mini-cycles").addEventListener("click", () => {
          console.log('📤 Creating backup (Schema 2.5 only)...');
          
          const schemaData = localStorage.getItem("miniCycleData");
          if (!schemaData) {
              console.error('❌ Schema 2.5 data required for backup');
              showNotification("❌ No Schema 2.5 data found. Cannot create backup.", "error");
              return;
          }
      
          // Schema 2.5 backup - everything is in one key
          const backupData = {
              schemaVersion: "2.5",
              miniCycleData: schemaData,
              backupMetadata: {
                  createdAt: Date.now(),
                  version: "2.5",
                  source: "miniCycle App"
              }
          };
          
          const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
          const backupUrl = URL.createObjectURL(backupBlob);
          const a = document.createElement("a");
          a.href = backupUrl;
          a.download = `mini-cycle-backup-schema25-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(backupUrl);
          
          showNotification("✅ Schema 2.5 backup created successfully!", "success", 3000);
      });
      
        
        // ✅ Update restore function to convert legacy backups to Schema 2.5 (idempotent + cancel-safe)
        (() => {
          const restoreBtn = document.getElementById("restore-mini-cycles");
          if (!restoreBtn) return;
        
          let fileInput = null;
          let isPickerOpen = false;
        
          const resetPicker = () => { isPickerOpen = false; };
        
          const handleRestore = () => {
            if (isPickerOpen) return;
            isPickerOpen = true;
        
            // Clean previous input
            if (fileInput) {
              fileInput.remove();
              fileInput = null;
            }
        
            // Fresh input
            fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = "application/json,.json";
            fileInput.style.display = "none";
            document.body.appendChild(fileInput);
        
            // When picker closes (even on cancel), window regains focus
            const onFocusAfterPicker = () => {
              resetPicker();
              window.removeEventListener("focus", onFocusAfterPicker);
              // Cleanup dangling input on cancel
              if (fileInput && !fileInput.files?.length) {
                fileInput.remove();
                fileInput = null;
              }
            };
            window.addEventListener("focus", onFocusAfterPicker, { once: true });
        
            fileInput.addEventListener("change", (event) => {
              const file = event.target.files[0];
              if (!file) {
                if (fileInput) {
                  fileInput.remove();
                  fileInput = null;
                }
                resetPicker();
                return;
              }
        
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const backupData = JSON.parse(e.target.result);
        
                  // ✅ Check if user is currently on Schema 2.5 (should always be true now)
                  const currentSchemaData = localStorage.getItem("miniCycleData");
                  if (!currentSchemaData) {
                    showNotification("❌ Cannot restore - Schema 2.5 data structure required.", "error");
                    return;
                  }
        
                  // ✅ Handle Schema 2.5 backup
                  if (backupData.schemaVersion === "2.5" && backupData.miniCycleData) {
                    localStorage.setItem("miniCycleData", backupData.miniCycleData);
                    showNotification("✅ Schema 2.5 backup restored successfully!", "success", 4000);
        
                    showNotification("🔄 Reloading app to apply changes...", "info", 2000);
                    setTimeout(() => location.reload(), 2500);
                    return;
                  }
        
                  // ✅ Handle legacy backup - convert to Schema 2.5
                  if (backupData.schemaVersion === "legacy" || backupData.miniCycleStorage) {
                    showNotification("🔄 Auto-converting legacy backup to Schema 2.5...", "info", 3000);
        
                    if (!backupData.miniCycleStorage) {
                      showNotification("❌ Invalid legacy backup file format.", "error", 3000);
                      return;
                    }
        
                    // Temporarily restore legacy keys
                    localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                    localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");
        
                    if (backupData.miniCycleReminders) {
                      localStorage.setItem("miniCycleReminders", backupData.miniCycleReminders);
                    }
                    if (backupData.milestoneUnlocks) {
                      localStorage.setItem("milestoneUnlocks", backupData.milestoneUnlocks);
                    }
                    if (backupData.darkModeEnabled !== undefined) {
                      localStorage.setItem("darkModeEnabled", backupData.darkModeEnabled);
                    }
                    if (backupData.currentTheme) {
                      localStorage.setItem("currentTheme", backupData.currentTheme);
                    }
        
                    // Migrate to 2.5
                    setTimeout(() => {
                      const migrationResults = performSchema25Migration();
        
                      if (migrationResults.success) {
                        showNotification("✅ Legacy backup restored and converted to Schema 2.5!", "success", 4000);
                      } else {
                        showNotification("❌ Migration failed during restore", "error", 4000);
                      }
        
                      setTimeout(() => location.reload(), 1000);
                    }, 500);
        
                    return; // prevent double reload path
                  }
        
                  showNotification("❌ Invalid backup file format.", "error", 3000);
                } catch (error) {
                  console.error("Backup restore error:", error);
                  showNotification("❌ Error restoring backup - file may be corrupted.", "error", 4000);
                } finally {
                  if (fileInput) {
                    fileInput.remove();
                    fileInput = null;
                  }
                  resetPicker();
                  window.removeEventListener("focus", onFocusAfterPicker);
                }
              };
        
              reader.readAsText(file);
            }, { once: true });
        
            fileInput.click();
          };
        
          // Idempotent listener attachment
          if (restoreBtn._restoreHandler) {
            restoreBtn.removeEventListener("click", restoreBtn._restoreHandler);
          }
          restoreBtn._restoreHandler = handleRestore;
          restoreBtn.addEventListener("click", restoreBtn._restoreHandler);
        })();
        
      
    document.getElementById("reset-recurring-default")?.addEventListener("click", resetDefaultRecurringSettings);
      // ✅ Update reset recurring default for Schema 2.5 only
      function resetDefaultRecurringSettings() {
          console.log('🔁 Resetting recurring defaults (Schema 2.5 only)...');
          
          const schemaData = localStorage.getItem("miniCycleData");
          if (!schemaData) {
              console.error('❌ Schema 2.5 data required for reset');
              showNotification("❌ No Schema 2.5 data found. Cannot reset defaults.", "error");
              return;
          }
      
          const parsed = JSON.parse(schemaData);
          
          const defaultSettings = {
              frequency: "daily",
              indefinitely: true,
              time: null
          };
          
          // Reset defaults in Schema 2.5
          parsed.settings.defaultRecurringSettings = defaultSettings;
          parsed.metadata.lastModified = Date.now();
          localStorage.setItem("miniCycleData", JSON.stringify(parsed));
          
          showNotification("🔁 Recurring default reset to Daily Indefinitely.", "success");
      }
      
      // ✅ Update Factory Reset for Schema 2.5 only
      document.getElementById("factory-reset").addEventListener("click", async () => {
          const confirmed = showConfirmationModal({
              title: "Factory Reset",
              message: "⚠️ This will DELETE ALL miniCycle data, settings, and progress. Are you sure?",
              confirmText: "Delete Everything",
              cancelText: "Cancel",
              callback: (confirmed) => {
                  if (!confirmed) {
                      showNotification("❌ Factory reset cancelled.", "info", 2000);
                      return;
                  }
                  
                  console.log('🧹 Performing bulletproof Schema 2.5 factory reset...');
                  
                  // Schema 2.5 - Single key cleanup
                  localStorage.removeItem("miniCycleData");
                  
                  // Also clean up any remaining legacy keys for thorough cleanup
                  const legacyKeysToRemove = [
                      "miniCycleStorage",
                      "lastUsedMiniCycle",
                      "miniCycleReminders",
                      "miniCycleDefaultRecurring",
                      "milestoneUnlocks",
                      "darkModeEnabled",
                      "currentTheme",
                      "miniCycleNotificationPosition",
                      "miniCycleThreeDots",
                      "miniCycleMoveArrows",
                      "miniCycleOnboarding",
                      "overdueTaskStates",
                      "bestRound",
                      "bestTime",
                      "miniCycleAlwaysShowRecurring",
                      "miniCycle_console_logs",
                      "miniCycle_console_capture_start",
                      "miniCycle_console_capture_enabled"
                  ];
                  
                  legacyKeysToRemove.forEach(key => localStorage.removeItem(key));
                  
                  // Clean up any backup files and dynamic keys
                  const allKeys = Object.keys(localStorage);
                  let dynamicKeysRemoved = 0;
                  
                  allKeys.forEach(key => {
                      // Backup files
                      if (key.startsWith('miniCycle_backup_') || key.startsWith('pre_migration_backup_')) {
                          localStorage.removeItem(key);
                          dynamicKeysRemoved++;
                          return;
                      }
                      
                      // Any key containing miniCycle, minicycle, or TaskCycle (case-insensitive)
                      const keyLower = key.toLowerCase();
                      if (keyLower.includes('minicycle') || keyLower.includes('taskcycle')) {
                          console.log('🧹 Removing additional key:', key);
                          localStorage.removeItem(key);
                          dynamicKeysRemoved++;
                      }
                  });
                  
                  console.log(`🧹 Removed ${dynamicKeysRemoved} additional dynamic keys`);
                  
                  // Optional: Clear service worker cache for complete reset
                  if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(registrations => {
                          registrations.forEach(registration => {
                              console.log('🧹 Unregistering service worker:', registration.scope);
                              registration.unregister();
                          });
                      }).catch(err => console.warn('⚠️ Service worker cleanup failed:', err));
                  }
                  
                  // Clear any cached data in memory
                  if (typeof window.caches !== 'undefined') {
                      caches.keys().then(cacheNames => {
                          return Promise.all(
                              cacheNames.map(cacheName => {
                                  if (cacheName.includes('miniCycle') || cacheName.includes('taskCycle')) {
                                      console.log('🧹 Clearing cache:', cacheName);
                                      return caches.delete(cacheName);
                                  }
                              })
                          );
                      }).catch(err => console.warn('⚠️ Cache cleanup failed:', err));
                  }
      
                  showNotification("✅ Factory Reset Complete. Reloading...", "success", 2000);
                  setTimeout(() => location.reload(), 1000);
              }
          });
      });

    }


/**
 * Setupdownloadminicycle function - Schema 2.5 ONLY
 *
 * @returns {void}
 */
function setupDownloadMiniCycle() {
  document.getElementById("export-mini-cycle").addEventListener("click", () => {
    console.log('📤 Exporting miniCycle (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for export');
      showNotification("❌ No Schema 2.5 data found. Cannot export.", "error");
      return;
    }

    const { cycles, activeCycle } = schemaData;
    const cycle = cycles[activeCycle];
    
    if (!activeCycle || !cycle) {
      showNotification("⚠ No active miniCycle to export.");
      return;
    }

    console.log('📊 Exporting cycle:', activeCycle);

    const miniCycleData = {
      name: activeCycle,
      title: cycle.title || "New miniCycle",
      tasks: cycle.tasks.map(task => {
        const settings = task.recurringSettings || {};
        
        // Add fallback time if task is recurring and doesn't use specificTime
        if (task.recurring && !settings.specificTime && !settings.defaultRecurTime) {
          settings.defaultRecurTime = new Date().toISOString();
        }

        return {
          id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          text: task.text || "",
          completed: task.completed || false,
          dueDate: task.dueDate || null,
          highPriority: task.highPriority || false,
          remindersEnabled: task.remindersEnabled || false,
          recurring: task.recurring || false,
          recurringSettings: settings,
          schemaVersion: task.schemaVersion || 2
        };
      }),
      autoReset: cycle.autoReset || false,
      cycleCount: cycle.cycleCount || 0,
      deleteCheckedTasks: cycle.deleteCheckedTasks || false
    };

    console.log('✅ Export data prepared');
    exportMiniCycleData(miniCycleData, cycle.title || activeCycle);
  });
}

function exportMiniCycleData(miniCycleData, cycleName) {
    console.log('📤 Exporting miniCycle data (Schema 2.5 only)...');
    
    try {
        const dataStr = JSON.stringify(miniCycleData, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${cycleName.replace(/[^a-z0-9]/gi, '_')}.mcyc`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(link.href);
        
        console.log('✅ Export completed successfully');
        showNotification(`✅ "${cycleName}" exported successfully!`, "success", 3000);
        
    } catch (error) {
        console.error('❌ Export failed:', error);
        showNotification("❌ Export failed. Please try again.", "error", 3000);
    }
}


function setupUploadMiniCycle() {
  const importButtons = ["import-mini-cycle", "miniCycleUpload"];

  // Shared state
  let fileInput = null;
  let isPickerOpen = false;

  const resetPickerState = () => {
    isPickerOpen = false;
  };

  const handleImport = () => {
    if (isPickerOpen) return;
    isPickerOpen = true;

    // Clean previous input
    if (fileInput) {
      fileInput.remove();
      fileInput = null;
    }

    // Fresh input
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".mcyc";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    // When the OS file dialog closes (even on cancel), window regains focus
    const onFocusAfterPicker = () => {
      // If change didn't fire (cancel), release the lock
      resetPickerState();
      window.removeEventListener("focus", onFocusAfterPicker);
      // Cleanup dangling input on cancel
      if (fileInput && !fileInput.files?.length) {
        fileInput.remove();
        fileInput = null;
      }
    };
    window.addEventListener("focus", onFocusAfterPicker, { once: true });

    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) {
        fileInput.remove();
        fileInput = null;
        resetPickerState();
        return;
      }

      if (file.name.endsWith(".tcyc")) {
        showNotification("❌ miniCycle does not support .tcyc files.\nPlease save your Task Cycle as .MCYC to import into miniCycle.");
        fileInput.remove();
        fileInput = null;
        resetPickerState();
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);

          if (!importedData.name || !Array.isArray(importedData.tasks)) {
            showNotification("❌ Invalid miniCycle file format.");
            return;
          }

          console.log("📥 Importing miniCycle with auto-conversion to Schema 2.5...");

          // Ensure Schema 2.5 data exists
          const schemaData = loadMiniCycleData();
          if (!schemaData) {
            console.error("❌ Schema 2.5 data required for import");
            showNotification("❌ Cannot import - Schema 2.5 data structure required.", "error");
            return;
          }

          const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
          const cycleId = `imported_${Date.now()}`;

          console.log("🔄 Creating imported cycle with ID:", cycleId);

          fullSchemaData.data.cycles[cycleId] = {
            id: cycleId,
            title: importedData.title || importedData.name,
            tasks: importedData.tasks.map((task) => {
              const safeSettings = task.recurringSettings || {};
              if (task.recurring && !safeSettings.specificTime && !safeSettings.defaultRecurTime) {
                safeSettings.defaultRecurTime = new Date().toISOString();
              }
              return {
                id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                text: task.text || "",
                completed: false,
                dueDate: task.dueDate || null,
                highPriority: task.highPriority || false,
                remindersEnabled: task.remindersEnabled || false,
                recurring: task.recurring || false,
                recurringSettings: safeSettings,
                schemaVersion: task.schemaVersion || 2
              };
            }),
            autoReset: importedData.autoReset !== false,
            cycleCount: importedData.cycleCount || 0,
            deleteCheckedTasks: importedData.deleteCheckedTasks || false,
            createdAt: Date.now(),
            recurringTemplates: {}
          };

          // Set as active cycle and persist
          fullSchemaData.appState.activeCycleId = cycleId;
          fullSchemaData.metadata.lastModified = Date.now();
          fullSchemaData.metadata.totalCyclesCreated++;
          localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

          console.log("💾 Import completed successfully to Schema 2.5");
          showNotification(`✅ miniCycle "${importedData.name}" imported and converted to Schema 2.5!`, "success");
          location.reload();
        } catch (error) {
          showNotification("❌ Error importing miniCycle.");
          console.error("Import error:", error);
        } finally {
          if (fileInput) {
            fileInput.remove();
            fileInput = null;
          }
          resetPickerState();
          window.removeEventListener("focus", onFocusAfterPicker);
        }
      };

      reader.readAsText(file);
    }, { once: true });

    fileInput.click();
  };

  // Attach listeners idempotently
  importButtons.forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (button._importHandler) {
      button.removeEventListener("click", button._importHandler);
    }
    button._importHandler = handleImport;
    button.addEventListener("click", button._importHandler);
  });
}



/**
 * Setupfeedbackmodal function.
 *
 * @returns {void}
 */

function setupFeedbackModal() {
    const feedbackModal = document.getElementById("feedback-modal");
    const openFeedbackBtn = document.getElementById("open-feedback-modal");
    const closeFeedbackBtn = document.querySelector(".close-feedback-modal");
    const feedbackForm = document.getElementById("feedback-form");
    const feedbackText = document.getElementById("feedback-text");
    const submitButton = document.getElementById("submit-feedback");
    const thankYouMessage = document.getElementById("thank-you-message");

    // Open Modal
    openFeedbackBtn.addEventListener("click", () => {
        feedbackModal.style.display = "flex";
        hideMainMenu();
        thankYouMessage.style.display = "none"; // Hide thank you message if shown before
    });

    // Close Modal
    closeFeedbackBtn.addEventListener("click", () => {
        feedbackModal.style.display = "none";
    });

    // Close Modal on Outside Click
    window.addEventListener("click", (event) => {
        if (event.target === feedbackModal) {
            feedbackModal.style.display = "none";
        }
    });

    // Handle Form Submission via AJAX (Prevent Page Refresh)
    feedbackForm.addEventListener("submit", function (event) {
        event.preventDefault(); // Prevent default form submission

        // Disable button while sending
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";

        // Prepare Form Data
        const formData = new FormData(feedbackForm);

        // Send request to Web3Forms API
        fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show Thank You Message
                thankYouMessage.style.display = "block";

                // Clear Textarea
                feedbackText.value = "";

                // Hide Form After Submission
                setTimeout(() => {
                    thankYouMessage.style.display = "none";
                    feedbackModal.style.display = "none"; // Close modal after a short delay
                }, 2000);
            } else {
                showNotification("❌ Error sending feedback. Please try again.");
            }
        })
        .catch(error => {
            showNotification("❌ Network error. Please try again later.");
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = "Submit";
        });
    });
}


document.getElementById("feedback-form").addEventListener("submit", (e) => {
    const textarea = document.getElementById("feedback-text");
    textarea.value = sanitizeInput(textarea.value);
});


function openFeedbackModal() {
    const openFeedbackFooter = document.getElementById("open-feedback-modal-footer");
        openFeedbackFooter.addEventListener("click", () => {
              setupFeedbackModal();
        feedbackModal.style.display = "flex";
        thankYouMessage.style.display = "none"; // Hide thank you message if shown before
    });
}

openFeedbackModal();

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



/**
 * Setupabout function.
 *
 * @returns {void}
 */

function setupAbout() {
    const aboutModal = document.getElementById("about-modal");
    const openAboutBtn = document.getElementById("open-about-modal");
    const closeAboutBtn = aboutModal.querySelector(".close-modal");

    // Open Modal
    openAboutBtn.addEventListener("click", () => {
        aboutModal.style.display = "flex";
    });

    // Close Modal
    closeAboutBtn.addEventListener("click", () => {
        aboutModal.style.display = "none";
    });

    // Close Modal on Outside Click
    window.addEventListener("click", (event) => {
        if (event.target === aboutModal) {
            aboutModal.style.display = "none";
        }
    });
}


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
    autoSave();
    console.log("ran check MiniCyle function2");
}

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
        const hasGameUnlock = currentState.settings.unlockedFeatures.includes("task-order-game");
        
        if (!hasGameUnlock) {
            showNotification("🎮 Game Unlocked! 'Task Order' is now available in the Games menu.", "success", 6000);
            unlockMiniGame();
        }
    }
    
    console.log('✅ Milestone unlocks processed (state-based)');
}

function unlockMiniGame() {
    console.log('🎮 Unlocking mini game (state-based)...');
    
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for unlockMiniGame');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data for unlockMiniGame');
        return;
    }
    
    if (!currentState.settings.unlockedFeatures.includes("task-order-game")) {
        window.AppState.update(state => {
            state.settings.unlockedFeatures.push("task-order-game");
            state.userProgress.rewardMilestones.push("task-order-game-100");
        }, true);
        
        console.log("🎮 Task Order Game unlocked (state-based)!");
    }
    
    checkGamesUnlock();
}

function unlockDarkOceanTheme() {
    console.log("🌊 Unlocking Dark Ocean theme (state-based)...");
    
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for unlockDarkOceanTheme');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data for unlockDarkOceanTheme');
        return;
    }
    
    if (!currentState.settings.unlockedThemes.includes("dark-ocean")) {
        window.AppState.update(state => {
            state.settings.unlockedThemes.push("dark-ocean");
            state.userProgress.rewardMilestones.push("dark-ocean-5");
        }, true);
        
        console.log("🎨 Dark Ocean theme unlocked (state-based)!");
        refreshThemeToggles();
        
        // Show the theme option in menu
        const themeContainer = document.querySelector('.theme-container');
        if (themeContainer) {
            themeContainer.classList.remove('hidden');
        }

        // ✅ Show the Themes Button Immediately
        const themeButton = document.getElementById("open-themes-panel");
        if (themeButton) {
            themeButton.style.display = "block";
        }
        
        showNotification('🎉 New theme unlocked: Dark Ocean! Check the menu to activate it.', 'success', 5000);
    } else {
        console.log('ℹ️ Dark Ocean theme already unlocked');
    }
    
    refreshThemeToggles();
}

function unlockGoldenGlowTheme() {
    console.log("🌟 Unlocking Golden Glow theme (state-based)...");
    
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for unlockGoldenGlowTheme');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data for unlockGoldenGlowTheme');
        return;
    }
    
    if (!currentState.settings.unlockedThemes.includes("golden-glow")) {
        window.AppState.update(state => {
            state.settings.unlockedThemes.push("golden-glow");
            state.userProgress.rewardMilestones.push("golden-glow-50");
        }, true);
        
        console.log("🎨 Golden Glow theme unlocked (state-based)!");
        refreshThemeToggles();

        // Show the theme container (if hidden)
        const themeContainer = document.querySelector('.theme-container');
        if (themeContainer) {
            themeContainer.classList.remove('hidden');
        }

        // Show the theme toggle if it exists
        const themeButton = document.getElementById("open-themes-panel");
        if (themeButton) {
            themeButton.style.display = "block";
        }

        showNotification("🌟 New theme unlocked: Golden Glow! Check the themes menu to activate it.", "success", 5000);
    } else {
        console.log('ℹ️ Golden Glow theme already unlocked');
    }
    
    refreshThemeToggles();
}



function initializeThemesPanel() {
    console.log("🌈 Initializing Theme Panel");

    const existingContainer = document.querySelector('.theme-container');
    if (existingContainer) return; // Prevent duplicates

    const themeContainer = document.createElement('div');
    themeContainer.className = 'theme-container';
    themeContainer.id = 'theme-container';

    const themeOptionContainer = document.createElement('div');
    themeOptionContainer.className = 'theme-option-container';
    themeOptionContainer.id = 'theme-option-container'; // 👈 We'll update this later

    themeContainer.appendChild(themeOptionContainer);

    // Inject into modal
    const themeSection = document.getElementById("theme-options-section");
    themeSection.appendChild(themeContainer);

    // Setup toggle logic
    refreshThemeToggles(); // ⬅ Run this on load
}

// ✅ Rebuild toggles based on unlocked themes (Schema 2.5 only)
function refreshThemeToggles() {
    console.log('🎨 Refreshing theme toggles (Schema 2.5 only)...');
    
    const container = document.getElementById("theme-option-container");
    if (!container) {
        console.warn('⚠️ Theme option container not found');
        return;
    }
    
    container.innerHTML = ""; // 🧹 Clear current options

    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for refreshThemeToggles');
        return;
    }

    const unlockedThemes = schemaData.settings.unlockedThemes || [];
    const currentTheme = schemaData.settings.theme || 'default';
    
    console.log('📊 Theme data from Schema 2.5:', {
        unlockedThemes,
        currentTheme,
        unlockedCount: unlockedThemes.length
    });

    const themeList = [
        {
          id: "DarkOcean",
          class: "dark-ocean",
          label: "Dark Ocean Theme 🌊",
          unlockKey: "dark-ocean"
        },
        {
          id: "GoldenGlow",
          class: "golden-glow",
          label: "Golden Glow Theme 🌟",
          unlockKey: "golden-glow"
        }
    ];

    themeList.forEach(theme => {
        if (!unlockedThemes.includes(theme.unlockKey)) {
            console.log(`🔒 Theme ${theme.unlockKey} not unlocked, skipping`);
            return;
        }

        console.log(`🎨 Adding theme toggle for: ${theme.label}`);

        const label = document.createElement("label");
        label.className = "custom-checkbox";
        label.innerHTML = `
            <input type="checkbox" id="toggle${theme.id}Theme" class="theme-toggle">
            <span class="checkmark"></span>
            ${theme.label}
        `;

        container.appendChild(label);

        const checkbox = label.querySelector("input");
        checkbox.checked = currentTheme === theme.class;
        
        console.log(`🔘 Theme ${theme.class} checked:`, checkbox.checked);

        checkbox.addEventListener("change", function () {
            if (this.checked) {
                console.log(`🎨 Applying theme: ${theme.class}`);
                
                document.querySelectorAll(".theme-toggle").forEach(cb => {
                    if (cb !== this) cb.checked = false;
                });
                applyTheme(theme.class);
            } else {
                console.log('🎨 Applying default theme');
                applyTheme("default");
            }
        });
    });
    
    console.log('✅ Theme toggles refreshed successfully');
}

// ✅ Close Themes Modal when clicking outside of the modal content
window.addEventListener("click", (event) => {
    const themesModal = document.getElementById("themes-modal");
    

    // Only close if you click on the background (not inside modal)
    if (event.target === themesModal) {
        themesModal.style.display = "none";
    }
});

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
 * Rearrange Management Logic
 * 
 * 
 ************************/


/**
 * Draganddrop function.
 *
 * @param {any} taskElement - Description. * @returns {void}
 */

function DragAndDrop(taskElement) {
    // Prevent text selection on mobile
    taskElement.style.userSelect = "none";
    taskElement.style.webkitUserSelect = "none";
    taskElement.style.msUserSelect = "none";
    let readyToDrag = false; 
    let touchStartX = 0;
    let touchStartY = 0;
    let holdTimeout = null;
    let isDragging = false;
    let isLongPress = false;
    let isTap = false;
    let preventClick = false;
    const moveThreshold = 15; // 🚀 Movement threshold for long press

    // 📱 **Touch-based Drag for Mobile**
    taskElement.addEventListener("touchstart", (event) => {
        if (event.target.closest(".task-options")) return;
        isLongPress = false;
        isDragging = false;
        isTap = true; 
        readyToDrag = false; 
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        preventClick = false;

        // ✅ NEW FIX: Remove `.long-pressed` from all other tasks before long press starts
        document.querySelectorAll(".task").forEach(task => {
            if (task !== taskElement) {
                task.classList.remove("long-pressed");
                hideTaskButtons(task);
            }
        });

        holdTimeout = setTimeout(() => {
            isLongPress = true;
            isTap = false;
            window.AppGlobalState.draggedTask = taskElement; // ✅ Use centralized state
            isDragging = true;
            taskElement.classList.add("dragging", "long-pressed");

            event.preventDefault();

            console.log("📱 Long Press Detected - Showing Task Options", taskElement);

            // ✅ Ensure task options remain visible
            revealTaskButtons(taskElement);

        }, 500); // Long-press delay (500ms)
    });

    taskElement.addEventListener("touchmove", (event) => {
        const touchMoveX = event.touches[0].clientX;
        const touchMoveY = event.touches[0].clientY;
        const deltaX = Math.abs(touchMoveX - touchStartX);
        const deltaY = Math.abs(touchMoveY - touchStartY);

        // ✅ Cancel long press if moving too much
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
            clearTimeout(holdTimeout);
            isLongPress = false;
            isTap = false; // ✅ Prevent accidental taps after dragging
            return;
        }

        // ✅ Allow normal scrolling if moving vertically
        if (deltaY > deltaX) {
            clearTimeout(holdTimeout);
            isTap = false;
            return;
        }

        if (isLongPress && readyToDrag && !isDragging) {
            taskElement.setAttribute("draggable", "true");
            isDragging = true;

            if (event.cancelable) {
                event.preventDefault();
            }
        }

        if (isDragging && draggedTask) {
            if (event.cancelable) {
                event.preventDefault();
            }
            const movingTask = document.elementFromPoint(event.touches[0].clientX, event.touches[0].clientY);
            if (movingTask) {
              handleRearrange(movingTask, event);
          }
      
        }
    });

    taskElement.addEventListener("touchend", () => {
        clearTimeout(holdTimeout);

        if (isTap) {
            preventClick = true;
            setTimeout(() => { 
                preventClick = false; 
            }, 100);
        }

        if (window.AppGlobalState.draggedTask) { // ✅ Use centralized state
            window.AppGlobalState.draggedTask.classList.remove("dragging", "rearranging"); // ✅ Use centralized state
            window.AppGlobalState.draggedTask = null; // ✅ Use centralized state
        }

        isDragging = false;

        // ✅ Ensure task options remain open only when a long press is detected
        if (isLongPress) {
            console.log("✅ Long Press Completed - Keeping Task Options Open", taskElement);
            return;
        }
    
        taskElement.classList.remove("long-pressed");
    });

    // 🖱️ **Mouse-based Drag for Desktop**
    taskElement.addEventListener("dragstart", (event) => {
        if (event.target.closest(".task-options")) return;
        window.AppGlobalState.draggedTask = taskElement; // ✅ Use centralized state
        event.dataTransfer.setData("text/plain", "");

        // ✅ NEW: Add dragging class for desktop as well
        taskElement.classList.add("dragging");

        // ✅ Hide ghost image on desktop
        if (!isTouchDevice()) {
            const transparentPixel = new Image();
            transparentPixel.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
            event.dataTransfer.setDragImage(transparentPixel, 0, 0);
        }
    });
}


let rearrangeTimeout; // Prevents excessive reordering calls

/**
 * Handles the rearrangement of tasks when dragged.
 *
 * @param {HTMLElement} target - The task element being moved.
 * @param {DragEvent | TouchEvent} event - The event triggering the rearrangement.
 */

const REARRANGE_DELAY = 75; // ms delay to smooth reordering
const REORDER_SNAPSHOT_INTERVAL = 500;

// ✅ Update the handleRearrange function
function handleRearrange(target, event) {
  if (!target || !window.AppGlobalState.draggedTask || target === window.AppGlobalState.draggedTask) return; // ✅ Use centralized state

  clearTimeout(rearrangeTimeout);

  rearrangeTimeout = setTimeout(() => {
    if (!document.contains(target) || !document.contains(window.AppGlobalState.draggedTask)) return; // ✅ Use centralized state

    const parent = window.AppGlobalState.draggedTask.parentNode; // ✅ Use centralized state
    if (!parent || !target.parentNode) return;

    const bounding = target.getBoundingClientRect();
    const offset = event.clientY - bounding.top;

    // 🧠 Snapshot only if enough time has passed
    const now = Date.now();
    if (now - window.AppGlobalState.lastReorderTime > REORDER_SNAPSHOT_INTERVAL) { // ✅ Use centralized state
      
      window.AppGlobalState.lastReorderTime = now; // ✅ Use centralized state
      window.AppGlobalState.didDragReorderOccur = true; // ✅ Use centralized state
    }

    const isLastTask = !target.nextElementSibling;
    const isFirstTask = !target.previousElementSibling;

    document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));

    if (isLastTask && target.nextSibling !== window.AppGlobalState.draggedTask) { // ✅ Use centralized state
      parent.appendChild(window.AppGlobalState.draggedTask); // ✅ Use centralized state
      window.AppGlobalState.draggedTask.classList.add("drop-target"); // ✅ Use centralized state
      return;
    }

    if (isFirstTask && target.previousSibling !== window.AppGlobalState.draggedTask) { // ✅ Use centralized state
      parent.insertBefore(window.AppGlobalState.draggedTask, parent.firstChild); // ✅ Use centralized state
      window.AppGlobalState.draggedTask.classList.add("drop-target"); // ✅ Use centralized state
      return;
    }

    if (offset > bounding.height / 3) {
      if (target.nextSibling !== window.AppGlobalState.draggedTask) { // ✅ Use centralized state
        parent.insertBefore(window.AppGlobalState.draggedTask, target.nextSibling); // ✅ Use centralized state
      }
    } else {
      if (target.previousSibling !== window.AppGlobalState.draggedTask) { // ✅ Use centralized state
        parent.insertBefore(window.AppGlobalState.draggedTask, target); // ✅ Use centralized state
      }
    }

    window.AppGlobalState.draggedTask.classList.add("drop-target"); // ✅ Use centralized state
  }, REARRANGE_DELAY);
}


/**
 * Setuprearrange function.
 *
 * @returns {void}
 */
// ✅ Update the setupRearrange function to use centralized state
function setupRearrange() {
  if (window.AppGlobalState.rearrangeInitialized) return;
  window.AppGlobalState.rearrangeInitialized = true; // ✅ Use centralized state

  // ✅ Add event delegation for arrow clicks (survives DOM re-renders)
  const taskList = document.getElementById("taskList");
  if (taskList) {
    taskList.addEventListener("click", (event) => {
      if (event.target.matches('.move-up, .move-down')) {
        event.preventDefault();
        event.stopPropagation();
        handleArrowClick(event.target);
      }
    });
  }

  document.addEventListener("dragover", (event) => {
    event.preventDefault();
    requestAnimationFrame(() => {
      const movingTask = event.target.closest(".task");
      if (movingTask) {
        handleRearrange(movingTask, event);
        // ❌ Don't save yet — just rearrange visually
      }
    });
  });

  document.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!window.AppGlobalState.draggedTask) return; // ✅ Use centralized state

    if (window.AppGlobalState.didDragReorderOccur) { // ✅ Use centralized state
      saveCurrentTaskOrder();
      autoSave();
      updateProgressBar();
      updateStatsPanel();
      checkCompleteAllButton();

      document.getElementById("undo-btn").hidden = false;
      document.getElementById("redo-btn").hidden = true;

      console.log("🔁 Drag reorder completed and saved with undo snapshot.");
    }

    cleanupDragState();
    window.AppGlobalState.lastReorderTime = 0; // ✅ Use centralized state
    window.AppGlobalState.didDragReorderOccur = false; // ✅ Use centralized state
  });
}

// ✅ Add arrow click handler
function handleArrowClick(button) {
    const taskItem = button.closest('.task');
    if (!taskItem) return;

    const taskList = document.getElementById('taskList');
    const allTasks = Array.from(taskList.children);
    const currentIndex = allTasks.indexOf(taskItem);
    
    let newIndex;
    if (button.classList.contains('move-up')) {
        newIndex = Math.max(0, currentIndex - 1);
    } else {
        newIndex = Math.min(allTasks.length - 1, currentIndex + 1);
    }
    
    if (newIndex === currentIndex) return; // No movement needed
    
    // ✅ Reorder via state system (splice in array)
    if (window.AppState?.isReady?.()) {
        // ✅ Capture undo snapshot BEFORE reordering
        const currentState = window.AppState.get();
        if (currentState) captureStateSnapshot(currentState);
        
        window.AppState.update(state => {
            const activeCycleId = state.appState.activeCycleId;
            if (activeCycleId && state.data.cycles[activeCycleId]) {
                const tasks = state.data.cycles[activeCycleId].tasks;
                if (tasks && currentIndex >= 0 && currentIndex < tasks.length) {
                    // Remove task from current position and insert at new position
                    const [movedTask] = tasks.splice(currentIndex, 1);
                    tasks.splice(newIndex, 0, movedTask);
                    state.metadata.lastModified = Date.now();
                }
            }
        }, true); // immediate save
        
        // ✅ Re-render from state to reflect changes
        refreshUIFromState();
        
        // ✅ Update undo/redo buttons
        updateUndoRedoButtons();
        
        console.log(`✅ Task moved from position ${currentIndex} to ${newIndex} via arrows`);
    } else {
        console.warn('⚠️ AppState not ready for arrow reordering');
    }
}


/**
 * Cleanupdragstate function.
 *
 * @returns {void}
 */
// ✅ Update the cleanupDragState function
function cleanupDragState() {
    if (window.AppGlobalState.draggedTask) { // ✅ Use centralized state
        window.AppGlobalState.draggedTask.classList.remove("dragging", "rearranging");
        window.AppGlobalState.draggedTask = null; // ✅ Use centralized state
    }

    window.AppGlobalState.lastRearrangeTarget = null; // ✅ Use centralized state
    document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));
}


/**
 * Dragendcleanup function.
 *
 * @returns {void}
 */

function dragEndCleanup () {
    document.addEventListener("drop", cleanupDragState);
    document.addEventListener("dragover", () => {
        document.querySelectorAll(".rearranging").forEach(task => task.classList.remove("rearranging"));
    });
    
    
    }
/**
 * Updatemovearrowsvisibility function.
 *
 * @returns {void}
 */
function updateMoveArrowsVisibility() {
    console.log('🔄 Updating move arrows visibility (state-based)...');
    
    // ✅ Use state-based system
    let showArrows = false;
    
    if (window.AppState?.isReady?.()) {
        const currentState = window.AppState.get();
        showArrows = currentState?.ui?.moveArrowsVisible || false;
        console.log('📊 Arrow visibility from AppState:', showArrows);
    } else {
        // ✅ Silent fallback when state isn't ready (during initialization)
        const storedValue = localStorage.getItem("miniCycleMoveArrows");
        if (storedValue !== null) {
            showArrows = storedValue === "true";
            console.log('📊 Arrow visibility from localStorage fallback:', showArrows);
        } else {
            // Default to false if no setting exists
            showArrows = false;
            console.log('📊 Arrow visibility using default:', showArrows);
        }
    }

    // ✅ Update DOM to reflect current state
    updateArrowsInDOM(showArrows);

    console.log(`✅ Move arrows visibility updated: ${showArrows ? "visible" : "hidden"}`);
}

/**
 * Togglearrowvisibility function.
 *
 * @returns {void}
 */
function toggleArrowVisibility() {
    console.log('🔄 Toggling arrow visibility (state-based)...');
    
    // ✅ Use state-based system
    if (!window.AppState?.isReady?.()) {
        console.log('⚠️ AppState not ready yet, deferring toggle until ready');
        // Defer the toggle until AppState is ready
        setTimeout(() => {
            if (window.AppState?.isReady?.()) {
                toggleArrowVisibility();
            } else {
                console.warn('❌ AppState still not ready after timeout');
            }
        }, 100);
        return;
    }

    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for toggleArrowVisibility');
        return;
    }

    const currentlyVisible = currentState.ui?.moveArrowsVisible || false;
    const newVisibility = !currentlyVisible;

    // ✅ Update through state system
    window.AppState.update(state => {
        if (!state.ui) state.ui = {};
        state.ui.moveArrowsVisible = newVisibility;
        state.metadata.lastModified = Date.now();
    }, true); // immediate save

    // ✅ Update DOM to reflect new state
    updateArrowsInDOM(newVisibility);

    console.log(`✅ Move arrows toggled to ${newVisibility ? "visible" : "hidden"} via state system`);
}

// ✅ Extracted DOM update logic
function updateArrowsInDOM(showArrows) {
    const allTasks = document.querySelectorAll(".task");

    allTasks.forEach((task, index) => {
        const upButton = task.querySelector('.move-up');
        const downButton = task.querySelector('.move-down');
        const taskOptions = task.querySelector('.task-options');
        const taskButtons = task.querySelectorAll('.task-btn');

        if (upButton) {
            upButton.style.visibility = (showArrows && index !== 0) ? "visible" : "hidden";
            upButton.style.opacity = (showArrows && index !== 0) ? "1" : "0";
            upButton.style.pointerEvents = showArrows ? "auto" : "none"; 
        }
        if (downButton) {
            downButton.style.visibility = (showArrows && index !== allTasks.length - 1) ? "visible" : "hidden";
            downButton.style.opacity = (showArrows && index !== allTasks.length - 1) ? "1" : "0";
            downButton.style.pointerEvents = showArrows ? "auto" : "none"; 
        }

        // ✅ Ensure task options remain interactive
        if (taskOptions) {
            taskOptions.style.pointerEvents = "auto";  
        }

        // ✅ Ensure individual buttons remain interactive
        taskButtons.forEach(button => {
            button.style.pointerEvents = "auto";
        });
    });
}
    
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
    // Input validation and sanitization
    const validatedInput = validateAndSanitizeTaskInput(taskText);
    if (!validatedInput) return;
    
    // Load and validate data context
    const taskContext = loadTaskContext(validatedInput, taskId, {
        completed, dueDate, highPriority, remindersEnabled, recurring, recurringSettings
    });
    if (!taskContext) return;
    
    // Create or update task data
    const taskData = createOrUpdateTaskData(taskContext);
    
    // Create DOM elements
    const taskElements = createTaskDOMElements(taskContext, taskData);
    
    // Setup task interactions and events
    setupTaskInteractions(taskElements, taskContext);
    
    // Finalize task creation
    finalizeTaskCreation(taskElements, taskContext, { shouldSave, isLoading });
    
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

// ✅ 2. Data Context Loading and Validation
function loadTaskContext(taskTextTrimmed, taskId, taskOptions) {
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
        ...taskOptions
    };
}

// ✅ 3. Task Data Creation and Storage
function createOrUpdateTaskData(taskContext) {
    const { 
        cycleTasks, assignedTaskId, taskTextTrimmed, completed, dueDate, 
        highPriority, remindersEnabled, recurring, recurringSettings,
        currentCycle, cycles, activeCycle
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
        
        currentCycle.tasks.push(existingTask);
        
        // Handle recurring template creation
        if (recurring && recurringSettings) {
            createRecurringTemplate(taskContext, existingTask);
        }
        
        // Save to Schema 2.5
        saveTaskToSchema25(activeCycle, currentCycle);
        console.log('💾 Task saved to Schema 2.5');
    }
    
    return existingTask;
}

// ✅ 4. Recurring Template Creation (extracted from task data creation)
function createRecurringTemplate(taskContext, taskData) {
    const { currentCycle, assignedTaskId, taskTextTrimmed, highPriority, dueDate, remindersEnabled, recurringSettings } = taskContext;
    
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

// ✅ 5. DOM Elements Creation
function createTaskDOMElements(taskContext, taskData) {
    const { 
        assignedTaskId, taskTextTrimmed, highPriority, recurring, 
        recurringSettings, settings, autoResetEnabled
    } = taskContext;

    // Get required DOM elements
    const taskList = document.getElementById("taskList");
    const taskInput = document.getElementById("taskInput");
    
    // Create main task element
    const taskItem = createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings);
    
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

// ✅ 6. Main Task Element Creation
function createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings) {
    const taskItem = document.createElement("li");
    taskItem.classList.add("task");
    taskItem.setAttribute("draggable", "true");
    taskItem.dataset.taskId = assignedTaskId;
    
    if (highPriority) {
        taskItem.classList.add("high-priority");
    }

    const hasValidRecurringSettings = recurring && recurringSettings && Object.keys(recurringSettings).length > 0;
    if (hasValidRecurringSettings) {
        taskItem.classList.add("recurring");
        taskItem.setAttribute("data-recurring-settings", JSON.stringify(recurringSettings));
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
    setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority);
    
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
function setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority) {
    if (btnClass === "enable-task-reminders") {
        const isActive = remindersEnabled === true;
        button.classList.toggle("reminder-active", isActive);
        button.setAttribute("aria-pressed", isActive.toString());
    } else if (["recurring-btn", "priority-btn"].includes(btnClass)) {
        const isActive = btnClass === "recurring-btn" ? !!recurring : !!highPriority;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive.toString());
    }
}

// ✅ 12. Button Event Handlers Setup
function setupButtonEventHandlers(button, btnClass, taskContext) {
    if (btnClass === "recurring-btn") {
        setupRecurringButtonHandler(button, taskContext);
    } else if (btnClass === "enable-task-reminders") {
        setupReminderButtonHandler(button, taskContext);
    } else if (btnClass === "move-up" || btnClass === "move-down") {
        // ✅ Skip attaching old handlers to move buttons - using event delegation
        console.log(`🔄 Skipping old handler for ${btnClass} - using event delegation`);
    } else {
        button.addEventListener("click", handleTaskButtonClick);
    }
}

// ✅ 13. Recurring Button Handler (extracted from main function)
function setupRecurringButtonHandler(button, taskContext) {
    const { assignedTaskId, currentCycle, settings, activeCycle } = taskContext;
    
    // ✅ Mark that handler is attached to prevent double-attachment
    button.dataset.handlerAttached = 'true';
    
    button.addEventListener("click", () => {
        const task = currentCycle.tasks.find(t => t.id === assignedTaskId);
        if (!task) {
            console.warn('⚠️ Task not found:', assignedTaskId);
            return;
        }

        if (!task) return;

        

        const showRecurring = !taskContext.autoResetEnabled && taskContext.deleteCheckedEnabled;
        if (!(showRecurring || (settings.alwaysShowRecurring || false))) return;

        const isNowRecurring = !task.recurring;
        task.recurring = isNowRecurring;

        button.classList.toggle("active", isNowRecurring);
        button.setAttribute("aria-pressed", isNowRecurring.toString());

        if (isNowRecurring) {
            handleRecurringTaskActivation(task, taskContext, button);
        } else {
            handleRecurringTaskDeactivation(task, taskContext, assignedTaskId);
        }

        // Save to Schema 2.5
        saveTaskToSchema25(activeCycle, currentCycle);
        
        // ✅ Simple panel button visibility update
        updateRecurringPanelButtonVisibility();
        
        updateRecurringPanel?.();
        
        updateRecurringPanel?.();
    });
}

// ✅ 14. Recurring Task Activation Handler
function handleRecurringTaskActivation(task, taskContext, button) {
    const { assignedTaskId, currentCycle, settings } = taskContext;
    const taskItem = document.querySelector(`[data-task-id="${assignedTaskId}"]`);
    
    const defaultSettings = settings.defaultRecurringSettings || {
        frequency: "daily",
        indefinitely: true,
        time: null
    };

    task.recurringSettings = normalizeRecurringSettings(structuredClone(defaultSettings));
    taskItem.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
    taskItem.classList.add("recurring");
    task.schemaVersion = 2;

    // Create recurring template
    if (!currentCycle.recurringTemplates) {
        currentCycle.recurringTemplates = {};
    }

    currentCycle.recurringTemplates[assignedTaskId] = {
        id: assignedTaskId,
        text: task.text,
        recurring: true,
        recurringSettings: structuredClone(task.recurringSettings),
        highPriority: task.highPriority || false,
        dueDate: task.dueDate || null,
        remindersEnabled: task.remindersEnabled || false,
        lastTriggeredTimestamp: null,
        schemaVersion: 2
    };

    // Show notification with tip
    const rs = task.recurringSettings || {};
    const frequency = rs.frequency || "daily";
    const pattern = rs.indefinitely ? "Indefinitely" : "Limited";

    try {
        const notificationContent = createRecurringNotificationWithTip(assignedTaskId, frequency, pattern);
        const notification = showNotificationWithTip(notificationContent, "recurring", 20000, "recurring-cycle-explanation");
        if (notification) {
            initializeRecurringNotificationListeners(notification);
        } else {
            // Fallback to basic notification
            const notificationDiv = document.createElement('div');
            notificationDiv.className = 'notification success';
            notificationDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px; border-radius: 5px; z-index: 10000;';
            notificationDiv.innerHTML = `
                <div>🔄 Task set to recurring (${frequency})</div>
                <div style="margin-top: 10px; font-size: 12px;">
                    <button onclick="this.parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Change</button>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 5px;">More Options</button>
                </div>
            `;
            document.body.appendChild(notificationDiv);
            setTimeout(() => notificationDiv.remove(), 5000);
        }
    } catch (error) {
        // Silent fallback - basic notification
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'notification success';
        notificationDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px; border-radius: 5px; z-index: 10000;';
        notificationDiv.innerHTML = `🔄 Task set to recurring (${frequency})`;
        document.body.appendChild(notificationDiv);
        setTimeout(() => notificationDiv.remove(), 3000);
    }
}

// ✅ 15. Recurring Task Deactivation Handler
function handleRecurringTaskDeactivation(task, taskContext, assignedTaskId) {
    const { currentCycle } = taskContext;
    const taskItem = document.querySelector(`[data-task-id="${assignedTaskId}"]`);
    
    task.recurring = false;
    task.recurringSettings = {};
    task.schemaVersion = 2;
    taskItem.removeAttribute("data-recurring-settings");
    taskItem.classList.remove("recurring");

    // Remove from templates, keep task in main array
    if (currentCycle.recurringTemplates?.[assignedTaskId]) {
        delete currentCycle.recurringTemplates[assignedTaskId];
    }

    // Ensure the task stays in the main tasks array
    const taskExists = currentCycle.tasks.find(t => t.id === assignedTaskId);
    if (!taskExists) {
        console.warn('⚠️ Task missing from main array, re-adding:', assignedTaskId);
        currentCycle.tasks.push(task);
    }

    showNotification("↩️ Recurring turned off for this task.", "info", 2000);
}

// ✅ 16. Reminder Button Handler (extracted)
function setupReminderButtonHandler(button, taskContext) {
    const { assignedTaskId } = taskContext;
    
    button.addEventListener("click", () => {
        

        const isActive = button.classList.toggle("reminder-active");
        button.setAttribute("aria-pressed", isActive.toString());

        saveTaskReminderState(assignedTaskId, isActive);
        autoSaveReminders();
        startReminders();

        const undoBtn = document.getElementById("undo-btn");
        const redoBtn = document.getElementById("redo-btn");
        if (undoBtn) undoBtn.hidden = false;
        if (redoBtn) redoBtn.hidden = true;

        showNotification(`Reminders ${isActive ? "enabled" : "disabled"} for task.`, "info", 1500);
    });
}

// ✅ 17. Task Content Elements Creation
function createTaskContentElements(taskContext) {
    const { 
        assignedTaskId, taskTextTrimmed, completed, dueDate, 
        autoResetEnabled, recurring, currentCycle, activeCycle 
    } = taskContext;

    // Create checkbox
    const checkbox = createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed);
    
    // Create task label
    const taskLabel = createTaskLabel(taskTextTrimmed, assignedTaskId, recurring);
    
    // Create due date input
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
        
        handleTaskCompletionChange(checkbox);
        checkMiniCycle();
        autoSave();
        triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);

        const undoBtn = document.getElementById("undo-btn");
        const redoBtn = document.getElementById("redo-btn");
        if (undoBtn) undoBtn.hidden = false;
        if (redoBtn) redoBtn.hidden = true;

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
function createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle) {
    const dueDateInput = document.createElement("input");
    dueDateInput.type = "date";
    dueDateInput.classList.add("due-date");
    dueDateInput.setAttribute("aria-describedby", `task-desc-${assignedTaskId}`);

    if (dueDate) {
        dueDateInput.value = dueDate;
        if (!autoResetEnabled) {
            dueDateInput.classList.remove("hidden");
        } else {
            dueDateInput.classList.add("hidden");
        }
    } else {
        dueDateInput.classList.add("hidden");
    }
    
    dueDateInput.addEventListener("change", () => {
        

        // Update task in Schema 2.5
        const taskToUpdate = currentCycle.tasks.find(t => t.id === assignedTaskId);
        if (taskToUpdate) {
            taskToUpdate.dueDate = dueDateInput.value;
            saveTaskToSchema25(activeCycle, currentCycle);
        }

        updateStatsPanel();
        updateProgressBar();
        checkCompleteAllButton();

        showNotification("📅 Due date updated", "info", 1500);
    });

    return dueDateInput;
}

// ✅ 21. Task Interactions Setup
function setupTaskInteractions(taskElements, taskContext) {
    const { taskItem, buttonContainer, checkbox, dueDateInput } = taskElements;
    const { settings } = taskContext;

    // Setup task click interaction
    setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput);
    
    // Setup priority button state
    setupPriorityButtonState(buttonContainer, taskContext.highPriority);
    
    // Setup hover interactions based on three dots setting
    setupTaskHoverInteractions(taskItem, settings);
    
    // Setup focus interactions
    setupTaskFocusInteractions(taskItem);
    
    // Setup due date button interaction
    setupDueDateButtonInteraction(buttonContainer, dueDateInput);
}

// ✅ 22. Task Click Interaction Setup
function setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput) {
    taskItem.addEventListener("click", (event) => {
        if (event.target === checkbox || buttonContainer.contains(event.target) || event.target === dueDateInput) return;
        
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
        checkbox.setAttribute("aria-checked", checkbox.checked);
    
        checkMiniCycle();
        autoSave();
        triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
    });
}

// ✅ 23. Priority Button State Setup
function setupPriorityButtonState(buttonContainer, highPriority) {
    const priorityButton = buttonContainer.querySelector(".priority-btn");
    if (highPriority && priorityButton) {
        priorityButton.classList.add("priority-active");
        priorityButton.setAttribute("aria-pressed", "true");
    }
}

// ✅ 24. Task Hover Interactions Setup
function setupTaskHoverInteractions(taskItem, settings) {
    const threeDotsEnabled = settings.showThreeDots || false;
    if (!threeDotsEnabled) {
        taskItem.addEventListener("mouseenter", showTaskOptions);
        taskItem.addEventListener("mouseleave", hideTaskOptions);
    }
}

// ✅ 25. Task Focus Interactions Setup
function setupTaskFocusInteractions(taskItem) {
    safeAddEventListener(taskItem, "focus", () => {
        const options = taskItem.querySelector(".task-options");
        if (options) {
            options.style.opacity = "1";
            options.style.visibility = "visible";
            options.style.pointerEvents = "auto";
        }
    });
    
    attachKeyboardTaskOptionToggle(taskItem);
}

// ✅ 26. Due Date Button Interaction Setup
function setupDueDateButtonInteraction(buttonContainer, dueDateInput) {
    const dueDateButton = buttonContainer.querySelector(".set-due-date");
    if (dueDateButton) {
        dueDateButton.addEventListener("click", () => {
            dueDateInput.classList.toggle("hidden");
            dueDateButton.classList.toggle("active", !dueDateInput.classList.contains("hidden"));
        });
    }
}

// ✅ 27. Task Creation Finalization
function finalizeTaskCreation(taskElements, taskContext, options) {
    const { taskItem, taskList, taskInput } = taskElements;
    const { completed } = taskContext;
    const { shouldSave, isLoading } = options;

    // Append to DOM
    taskList.appendChild(taskItem);
    
    // Clear input
    if (taskInput) taskInput.value = "";

    // Scroll to new task
    scrollToNewTask(taskList);
    
    // Handle overdue styling
    handleOverdueStyling(taskItem, completed);
    
    // Update UI components
    updateUIAfterTaskCreation(shouldSave);
    
    // Setup final interactions
    setupFinalTaskInteractions(taskItem, isLoading);
}

// ✅ 28. Scroll to New Task
function scrollToNewTask(taskList) {
    const taskListContainer = document.querySelector(".task-list-container");
    if (taskListContainer && taskList) {
        taskListContainer.scrollTo({
            top: taskList.scrollHeight,
            behavior: "smooth"
        });
    }
}

// ✅ 29. Handle Overdue Styling
function handleOverdueStyling(taskItem, completed) {
    setTimeout(() => { 
        if (completed) {
            taskItem.classList.remove("overdue-task");
        }
    }, 300);
}

// ✅ 30. Update UI After Task Creation
function updateUIAfterTaskCreation(shouldSave) {
    checkCompleteAllButton();
    updateProgressBar();
    updateStatsPanel();
    
    // ✅ Update recurring panel button visibility when tasks are added
    if (typeof updateRecurringPanelButtonVisibility === 'function') {
        updateRecurringPanelButtonVisibility();
    }
    
    if (shouldSave) autoSave();
}

// ✅ 31. Setup Final Task Interactions
function setupFinalTaskInteractions(taskItem, isLoading) {
    if (!isLoading) setTimeout(() => { remindOverdueTasks(); }, 1000);

    DragAndDrop(taskItem);
    updateMoveArrowsVisibility();
}

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



    /**
 * Updatereminderbuttons function.
 *
 * @returns {void}
 */

  

    
    function updateReminderButtons() {
        console.log("🔍 Running updateReminderButtons() (Schema 2.5 only)...");
      
        // ✅ Schema 2.5 only
        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for updateReminderButtons');
            return;
        }
    
        const { cycles, activeCycle, reminders } = schemaData;
        const currentCycle = cycles[activeCycle];
        const reminderSettings = reminders || {};
        const remindersGloballyEnabled = reminderSettings.enabled === true;
        
        console.log('📊 Reminder settings from Schema 2.5:', {
            globallyEnabled: remindersGloballyEnabled,
            activeCycle,
            hasCycle: !!currentCycle
        });
      
        document.querySelectorAll(".task").forEach(taskItem => {
          const buttonContainer = taskItem.querySelector(".task-options");
          let reminderButton = buttonContainer.querySelector(".enable-task-reminders");
      
          const taskId = taskItem.dataset.taskId;
          if (!taskId) {
            console.warn("⚠ Skipping task with missing ID:", taskItem);
            return;
          }
      
          // ✅ Get task data from Schema 2.5
          const taskData = currentCycle?.tasks?.find(t => t.id === taskId);
          const isActive = taskData?.remindersEnabled === true;
          
          console.log(`🔍 Task ${taskId}: reminders enabled = ${isActive}`);
      
          if (remindersGloballyEnabled) {
            if (!reminderButton) {
              // ✅ Create Reminder Button
              reminderButton = document.createElement("button");
              reminderButton.classList.add("task-btn", "enable-task-reminders");
              reminderButton.innerHTML = "<i class='fas fa-bell'></i>";
      
              // Add click event
              reminderButton.addEventListener("click", () => {
                const nowActive = reminderButton.classList.toggle("reminder-active");
                reminderButton.setAttribute("aria-pressed", nowActive.toString());
                saveTaskReminderState(taskId, nowActive);
                autoSaveReminders();
              });
      
              buttonContainer.insertBefore(reminderButton, buttonContainer.children[2]);
              console.log("   ✅ Reminder Button Created & Inserted");
            }
      
            // ✅ Ensure correct state and make it visible
            reminderButton.classList.toggle("reminder-active", isActive);
            reminderButton.setAttribute("aria-pressed", isActive.toString());
            reminderButton.classList.remove("hidden");
      
            console.log(`   🔄 Reminder Button Visible - Active: ${isActive}`);
          } else {
            // ❌ Hide button if reminders are disabled globally
            if (reminderButton) {
              reminderButton.classList.add("hidden"); // Don't remove it; just hide for layout consistency
              reminderButton.classList.remove("reminder-active");
              reminderButton.setAttribute("aria-pressed", "false");
      
              console.log("   🔕 Reminder Button Hidden (Global toggle OFF)");
            }
          }
        });
      
        console.log("✅ Finished updateReminderButtons() (Schema 2.5).");
    }
    

    
    

    /**
 * Showtaskoptions function.
 *
 * @param {any} event - Description. * @returns {void}
 */

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
            revealTaskButtons(taskElement);
        }
    }
    

    function hideTaskOptions(event) {
        const taskElement = event.currentTarget;
    
        // ✅ Only hide if not long-pressed on mobile (so buttons stay open during drag)
        const isMobile = isTouchDevice();
        const allowHide = !isMobile || !taskElement.classList.contains("long-pressed");
    
        if (allowHide) {
            hideTaskButtons(taskElement);
        }
    }
    
    
/**
 * Handles the change event when a task's completion status is toggled.
 *
 * @param {HTMLInputElement} checkbox - The checkbox element of the task.
 */
function handleTaskCompletionChange(checkbox) {
    const taskItem = checkbox.closest(".task");

     if (checkbox.checked) {
        taskItem.classList.remove("overdue-task");
    } else {
        checkOverdueTasks(taskItem);
    }
    
    // ✅ ADD THIS: Force help window update
    if (window.helpWindowManager && typeof window.helpWindowManager.updateConstantMessage === 'function') {
        setTimeout(() => {
            window.helpWindowManager.updateConstantMessage();
        }, 100);
    }
}
    


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
        const taskLabel = taskItem.querySelector("span");
        const oldText = taskLabel.textContent.trim();

        showPromptModal({
            title: "Edit Task Name",
            message: "Rename this task:",
            placeholder: "Enter new task name",
            defaultValue: oldText,
            confirmText: "Save",
            cancelText: "Cancel",
            required: true,
            callback: async (newText) => {
                if (newText && newText.trim() !== oldText) {
                    const cleanText = sanitizeInput(newText.trim());
                    
                    // ✅ ADD: Capture snapshot BEFORE changing text
                    if (window.AppState?.isReady?.()) {
                        const currentState = window.AppState.get();
                        if (currentState) captureStateSnapshot(currentState);
                    }
                    
                    taskLabel.textContent = cleanText;

                    const taskId = taskItem.dataset.taskId;

                    // ✅ Use AppState.update so undo sees the change
                    if (window.AppState?.isReady?.()) {
                        await window.AppState.update(state => {
                            const cid = state.appState.activeCycleId;
                            const cycle = state.data.cycles[cid];
                            const t = cycle?.tasks?.find(t => t.id === taskId);
                            if (t) t.text = cleanText;
                        }, true);
                    } else {
                        // ...existing localStorage fallback...
                        const schemaData = loadMiniCycleData();
                        if (!schemaData) return;
                        const { cycles, activeCycle } = schemaData;
                        const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
                        if (task) {
                            task.text = cleanText;
                            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                            fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
                            fullSchemaData.metadata.lastModified = Date.now();
                            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                        }
                    }

                    showNotification(`Task renamed to "${cleanText}"`, "info", 1500);
                    updateStatsPanel();
                    updateProgressBar();
                    checkCompleteAllButton();
                    shouldSave = false;
                }
            }
        });
    } else if (button.classList.contains("delete-btn")) {
        const taskId = taskItem.dataset.taskId;
        const taskName = taskItem.querySelector(".task-text")?.textContent || "Task";

        showConfirmationModal({
            title: "Delete Task",
            message: `Are you sure you want to delete "${taskName}"?`,
            confirmText: "Delete",
            cancelText: "Cancel",
            callback: async (confirmDelete) => {
                if (!confirmDelete) {
                    showNotification(`"${taskName}" has not been deleted.`, "show", 2500);
                    return;
                }

                // ✅ ADD: Capture snapshot BEFORE deletion
                if (window.AppState?.isReady?.()) {
                    const currentState = window.AppState.get();
                    if (currentState) captureStateSnapshot(currentState);
                }

                // ✅ Use AppState.update so undo sees the change
                if (window.AppState?.isReady?.()) {
                    await window.AppState.update(state => {
                        const cid = state.appState.activeCycleId;
                        const cycle = state.data.cycles[cid];
                        if (!cycle) return;
                        cycle.tasks = (cycle.tasks || []).filter(t => t.id !== taskId);
                        if (cycle.recurringTemplates?.[taskId]) {
                            delete cycle.recurringTemplates[taskId];
                        }
                    }, true);
                } else {
                    // ...existing localStorage fallback...
                    const schemaData = loadMiniCycleData();
                    if (!schemaData) return;
                    const { cycles, activeCycle } = schemaData;
                    const currentCycle = cycles[activeCycle];
                    if (currentCycle) {
                        currentCycle.tasks = currentCycle.tasks.filter(task => task.id !== taskId);
                        if (currentCycle.recurringTemplates?.[taskId]) {
                            delete currentCycle.recurringTemplates[taskId];
                        }
                        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                        fullSchemaData.data.cycles[activeCycle] = currentCycle;
                        fullSchemaData.metadata.lastModified = Date.now();
                        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                    }
                }

                taskItem.remove();
                updateProgressBar();
                updateStatsPanel();
                checkCompleteAllButton();
                toggleArrowVisibility();

                showNotification(`"${taskName}" has been deleted.`, "info", 2000);
            }
        });

        shouldSave = false;
    } else if (button.classList.contains("priority-btn")) {
        // ✅ ADD: Capture snapshot BEFORE changing priority
        if (window.AppState?.isReady?.()) {
            const currentState = window.AppState.get();
            if (currentState) captureStateSnapshot(currentState);
        }

        taskItem.classList.toggle("high-priority");
        if (taskItem.classList.contains("high-priority")) {
            button.classList.add("priority-active");
        } else {
            button.classList.remove("priority-active");
        }

        const taskId = taskItem.dataset.taskId;

        // ✅ Use AppState.update so undo sees the change
        if (window.AppState?.isReady?.()) {
            window.AppState.update(state => {
                const cid = state.appState.activeCycleId;
                const cycle = state.data.cycles[cid];
                const t = cycle?.tasks?.find(t => t.id === taskId);
                if (t) t.highPriority = taskItem.classList.contains("high-priority");
            }, true);
        } else {
            // ...existing localStorage fallback...
            const schemaData = loadMiniCycleData();
            if (!schemaData) return;
            const { cycles, activeCycle } = schemaData;
            const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
            if (task) {
                task.highPriority = taskItem.classList.contains("high-priority");
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                showNotification(
                    `Priority ${task.highPriority ? "enabled" : "removed"}.`,
                    task.highPriority ? "error" : "info",
                    1500
                );
            }
        }

        shouldSave = false;
    }

    if (shouldSave) autoSave();
    console.log("✅ Task button clicked:", button.className);
}
async function saveCurrentTaskOrder() {
    const taskElements = document.querySelectorAll("#taskList .task");
    const newOrderIds = Array.from(taskElements).map(task => task.dataset.taskId);

    // ✅ Prefer AppState to trigger undo snapshots via subscriber
    if (window.AppState?.isReady?.()) {
        await window.AppState.update(state => {
            const cid = state.appState.activeCycleId;
            const cycle = state.data.cycles[cid];
            if (!cycle?.tasks) return;

            // ✅ Use the same pattern as your example
            const reorderedTasks = newOrderIds.map(id =>
                cycle.tasks.find(task => task.id === id)
            ).filter(Boolean); // filters out any nulls

            cycle.tasks = reorderedTasks;
        }, true);
        return;
    }

    // Fallback: direct localStorage (same pattern as your example)
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for saveCurrentTaskOrder');
        return;
    }
    const { cycles, activeCycle } = schemaData;
    const currentCycle = cycles[activeCycle];
    if (!currentCycle || !Array.isArray(currentCycle.tasks)) return;

    // Reorder task array based on current DOM order
    const reorderedTasks = newOrderIds.map(id =>
        currentCycle.tasks.find(task => task.id === id)
    ).filter(Boolean);

    currentCycle.tasks = reorderedTasks;

    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = currentCycle;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
}
































/**
 * Resettasks function.
 *
 * @returns {void}
 */

function resetTasks() {
    if (isResetting) return;
    isResetting = true;

    // ✅ Schema 2.5 only
    console.log('🔄 Resetting tasks (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for resetTasks');
        isResetting = false;
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    const cycleData = cycles[activeCycle];
    const taskElements = [...taskList.querySelectorAll(".task")];

    if (!activeCycle || !cycleData) {
        console.error("❌ No active cycle found in Schema 2.5 for resetTasks");
        isResetting = false;
        return;
    }

    console.log('📊 Resetting tasks for cycle:', activeCycle);

    // ✅ ANIMATION: Show progress bar becoming full first
    progressBar.style.width = "100%";
    progressBar.style.transition = "width 0.2s ease-out";
    
    // ✅ Wait for animation, then reset tasks
    setTimeout(() => {
        console.log('🧹 Removing recurring tasks and resetting non-recurring tasks');
        
        // 🧹 Remove recurring tasks
        removeRecurringTasksFromCycle(taskElements, cycleData);

        // ♻️ Reset non-recurring tasks
        taskElements.forEach(taskEl => {
            const isRecurring = taskEl.classList.contains("recurring");
            if (isRecurring) return;

            const checkbox = taskEl.querySelector("input[type='checkbox']");
            const dueDateInput = taskEl.querySelector(".due-date");

            if (checkbox) checkbox.checked = false;
            taskEl.classList.remove("overdue-task");

            if (dueDateInput) {
                dueDateInput.value = "";
                dueDateInput.classList.add("hidden");
            }
        });

        // ✅ Increment cycle count in Schema 2.5
        incrementCycleCount(activeCycle, cycles);

        // ✅ Animate progress bar reset with different timing
        progressBar.style.transition = "width 0.3s ease-in";
        progressBar.style.width = "0%";
        
        // ✅ Reset transition after animation completes
        setTimeout(() => {
            progressBar.style.transition = "";
        }, 50);
        
        console.log('✅ Task reset animation completed');
        
    }, 100); // Wait for fill animation to complete

    // ✅ Show cycle completion message in help window instead of separate element
    if (helpWindowManager) {
        helpWindowManager.showCycleCompleteMessage();
    }

    // ✅ Set isResetting to false after help window message duration
    setTimeout(() => {
        isResetting = false;
        console.log('🔓 Reset lock released');
    }, 2000);

    // ✅ Handle recurring tasks and cleanup (keep existing timing)
    setTimeout(() => {
        console.log('🔄 Running post-reset cleanup tasks');
        watchRecurringTasks();
        autoSave();
        updateStatsPanel();
        console.log('✅ Reset tasks completed successfully');
    }, 1000);
}

// ...existing code...


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
    
    // ✅ Show "Delete Checked Tasks" only when Auto Reset is OFF
    deleteCheckedTasksContainer.style.display = toggleAutoReset.checked ? "none" : "block";

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

        // ✅ Show/Hide "Delete Checked Tasks" toggle dynamically
        deleteCheckedTasksContainer.style.display = event.target.checked ? "none" : "block";

        // ✅ Only trigger miniCycle reset if AutoReset is enabled
        if (event.target.checked) {
            console.log('🔄 Auto reset enabled - checking cycle state');
            checkMiniCycle();
        }

        refreshTaskListUI();
        updateRecurringButtonVisibility();
        
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
        updateRecurringButtonVisibility();
        
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
function checkDueDates() {
    console.log('📅 Setting up due date checks (Schema 2.5 only)...');
    
    // Make sure we only attach the listener once
    if (!toggleAutoReset.dataset.listenerAdded) {
        toggleAutoReset.dataset.listenerAdded = true;

        toggleAutoReset.addEventListener("change", function () {
            console.log('🔄 Auto reset toggle changed for due dates:', this.checked);
            
            let autoReset = this.checked;
            updateDueDateVisibility(autoReset);
            
            const schemaData = loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Schema 2.5 data required for checkDueDates');
                throw new Error('Schema 2.5 data not found');
            }

            const { cycles, activeCycle } = schemaData;
            
            if (activeCycle && cycles[activeCycle]) {
                console.log('💾 Updating auto reset setting in Schema 2.5');
                
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                fullSchemaData.data.cycles[activeCycle].autoReset = autoReset;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                
                console.log('✅ Auto reset setting saved to Schema 2.5');
            } else {
                console.warn('⚠️ No active cycle found for due date settings');
            }
        });
    }

    // ✅ Prevent duplicate event listeners before adding a new one
    document.removeEventListener("change", handleDueDateChange);
    document.addEventListener("change", handleDueDateChange);
    
    console.log('✅ Due date check setup completed');
}
    
    // ✅ Function to handle due date changes (placed outside to avoid re-declaration)
    function handleDueDateChange(event) {
        if (!event.target.classList.contains("due-date")) return;
    
        let taskItem = event.target.closest(".task");
        let taskId = taskItem.dataset.taskId;
        let dueDateValue = event.target.value;
    
        console.log('📅 Handling due date change (Schema 2.5 only)...');
        
        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for handleDueDateChange');
            throw new Error('Schema 2.5 data not found');
        }
    
        const { cycles, activeCycle, reminders } = schemaData;
        
        if (!activeCycle || !cycles[activeCycle]) {
            console.error("❌ Error: Active cycle not found in Schema 2.5.");
            return;
        }
        
        console.log('🔍 Finding task for due date update:', taskId);
        
        const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);
        
        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }
        
        console.log('� Updating due date:', {
            taskId,
            taskText: task.text,
            oldDueDate: task.dueDate,
            newDueDate: dueDateValue
        });
        
        // Update task due date
        task.dueDate = dueDateValue;
        
        // Update the full schema data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
        console.log(`✅ Due date updated (Schema 2.5): "${task.text}" → ${dueDateValue || 'cleared'}`);
    
        checkOverdueTasks(taskItem);
    
        // ✅ Load Due Date Notification Setting from Schema 2.5
        const remindersSettings = reminders || {};
        const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;
        
        console.log('📢 Due date reminders enabled:', dueDatesRemindersEnabled);
    
        if (!dueDatesRemindersEnabled) {
            console.log('⏭️ Skipping due date notification - reminders disabled');
            return;
        }
    
        if (dueDateValue) {
            const today = new Date().setHours(0, 0, 0, 0);
            const selectedDate = new Date(dueDateValue).setHours(0, 0, 0, 0);
    
            if (selectedDate > today) {
                const taskText = task.text;
                showNotification(`📅 Task "${taskText}" is due soon!`, "default");
                console.log('📢 Due date notification shown for:', taskText);
            }
        }
    }
    
    
    // ✅ Apply initial visibility state on load
    let autoReset = toggleAutoReset.checked;
    updateDueDateVisibility(autoReset);
    
    

/**
 * Updates the visibility of due date fields and related UI elements based on Auto Reset settings.
 *
 * @param {boolean} autoReset - Whether Auto Reset is enabled.
 */
    function updateDueDateVisibility(autoReset) {
        const dueDatesRemindersOption = document.getElementById("dueDatesReminders").parentNode; // Get the label container
        if (dueDatesRemindersOption) {
            dueDatesRemindersOption.style.display = autoReset ? "none" : "block";
            }
        

        // Toggle visibility of "Set Due Date" buttons
        document.querySelectorAll(".set-due-date").forEach(button => {
            button.classList.toggle("hidden", autoReset);
        });
    
        if (autoReset) {
            
            // Auto Reset ON = hide all due dates
            document.querySelectorAll(".due-date").forEach(input => {
                input.classList.add("hidden");
            });
    
            // Remove overdue visual styling
            document.querySelectorAll(".overdue-task").forEach(task => {
                task.classList.remove("overdue-task");
            });
    
        } else {
            // Auto Reset OFF = show due dates ONLY if they have a value
            document.querySelectorAll(".due-date").forEach(input => {
                if (input.value) {
                    input.classList.remove("hidden");
                } else {
                    input.classList.add("hidden");
                }
            });
    
            // ✅ Dynamically add the "Set Due Date" button to tasks that don’t have it
            document.querySelectorAll(".task").forEach(taskItem => {
                let buttonContainer = taskItem.querySelector(".task-options");
                let existingDueDateButton = buttonContainer.querySelector(".set-due-date");
    
                if (!existingDueDateButton) {
                    const dueDateButton = document.createElement("button");
                    dueDateButton.classList.add("task-btn", "set-due-date");
                    dueDateButton.innerHTML = "<i class='fas fa-calendar-alt'></i>";
                    dueDateButton.addEventListener("click", () => {
                        const dueDateInput = taskItem.querySelector(".due-date");
                        dueDateInput.classList.toggle("hidden");
                    });
    
                    buttonContainer.insertBefore(dueDateButton, buttonContainer.children[2]); // Insert in correct position
                }
            });
    
            // Recheck and reapply overdue classes as needed
            checkOverdueTasks();
        }
    }
    
    
    
    



    


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
        updateRecurringButtonVisibility();
        
        console.log('✅ Delete checked tasks setting saved (Schema 2.5)');
    });

    deleteCheckedTasks.dataset.listenerAdded = true; 
}

/**
 * Closes the menu when clicking outside of it.
 * Ensures the menu only closes when clicking outside both the menu and menu button.
 *
 * @param {MouseEvent} event - The click event that triggers the check.
 */

function closeMenuOnClickOutside(event) {
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
        menu.classList.remove("visible"); // Hide the menu
        document.removeEventListener("click", closeMenuOnClickOutside); // ✅ Remove listener after closing
    }
}



/**
 * Hidemainmenu function.
 *
 * @returns {void}
 */

function hideMainMenu() {
    const menu = document.querySelector(".menu-container");
    menu.classList.remove("visible");
}



// ✅ Function to complete all tasks and handle reset
function handleCompleteAllTasks() {
    // ✅ Schema 2.5 only
    console.log('✔️ Handling complete all tasks (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for handleCompleteAllTasks');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    const cycleData = cycles[activeCycle];

    // ✅ Ensure there's an active miniCycle
    if (!activeCycle || !cycleData) {
        console.warn('⚠️ No active cycle found for complete all tasks');
        return;
    }

    console.log('📊 Processing complete all tasks for cycle:', activeCycle);

    // ✅ Only show alert if tasks will be reset (not deleted)
    if (!cycleData.deleteCheckedTasks) {
        const hasDueDates = [...taskList.querySelectorAll(".due-date")].some(
            dueDateInput => dueDateInput.value
        );

        if (hasDueDates) {
            showConfirmationModal({
                title: "Reset Tasks with Due Dates",
                message: "⚠️ This will complete all tasks and reset them to an uncompleted state.<br><br>Any assigned Due Dates will be cleared.<br><br>Proceed?",
                confirmText: "Reset Tasks",
                cancelText: "Cancel",
                callback: (confirmed) => {
                    if (!confirmed) return;
                    
                    if (cycleData.deleteCheckedTasks) {
                        const checkedTasks = document.querySelectorAll(".task input:checked");
                        if (checkedTasks.length === 0) {
                            showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
                            return;
                        }
            
                        checkedTasks.forEach(checkbox => {
                            const taskId = checkbox.closest(".task").dataset.taskId;
                            // Remove from Schema 2.5
                            cycleData.tasks = cycleData.tasks.filter(t => t.id !== taskId);
                            checkbox.closest(".task").remove();
                        });
                        
                        // ✅ Use autoSave() instead of direct save
                        autoSave();
                        
                    } else {
                        taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
                        checkMiniCycle();
            
                        if (!cycleData.autoReset) {
                            setTimeout(resetTasks, 1000);
                        }
                    }
                }
            });
            return;
        }
    }

    if (cycleData.deleteCheckedTasks) {
        const checkedTasks = document.querySelectorAll(".task input:checked");
        if (checkedTasks.length === 0) {
            showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
            return;
        }

        console.log('🗑️ Deleting checked tasks from Schema 2.5');

        checkedTasks.forEach(checkbox => {
            const taskId = checkbox.closest(".task").dataset.taskId;
            // Remove from Schema 2.5
            cycleData.tasks = cycleData.tasks.filter(t => t.id !== taskId);
            checkbox.closest(".task").remove();
        });
        
        // ✅ Update Schema 2.5 data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = cycleData;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

    } else {
        // ✅ If "Delete Checked Tasks" is OFF, just mark all as complete
        console.log('✔️ Marking all tasks as complete');
        
        taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
        checkMiniCycle();

        // ✅ Only call resetTasks() if autoReset is OFF
        if (!cycleData.autoReset) {
            setTimeout(resetTasks, 1000);
        }
    }
    
    console.log('✅ Complete all tasks handled (Schema 2.5)');
}

// ✅ Use the new function with safe listener
safeAddEventListener(completeAllButton, "click", handleCompleteAllTasks);


/***********************
 * 
 * 
 * Add Event Listeners
 * 
 * 
 ************************/
// 🟢 Add Task Button (Click)
safeAddEventListener(addTaskButton, "click", () => {
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

function syncCurrentSettingsToStorage() {
    console.log('⚙️ Syncing current settings to storage (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for syncCurrentSettingsToStorage');
        return;
    }
    
    const { cycles, activeCycle } = schemaData;
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
    
    if (!activeCycle || !cycles[activeCycle]) {
        console.warn('⚠️ No active cycle found for settings sync');
        return;
    }
    
    if (!toggleAutoReset || !deleteCheckedTasks) {
        console.warn('⚠️ Settings toggles not found');
        return;
    }
    
    console.log('📊 Syncing settings:', {
        activeCycle,
        autoReset: toggleAutoReset.checked,
        deleteCheckedTasks: deleteCheckedTasks.checked
    });
    
    // Update Schema 2.5 data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle].autoReset = toggleAutoReset.checked;
    fullSchemaData.data.cycles[activeCycle].deleteCheckedTasks = deleteCheckedTasks.checked;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log('✅ Settings synced to Schema 2.5 successfully');
}


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

// ✅ Updated reset onboarding with Schema 2.5 only
safeAddEventListenerById("reset-onboarding", "click", () => {
    console.log('🎯 Resetting onboarding (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for reset onboarding');
        showNotification("❌ Schema 2.5 data required.", "error", 2000);
        return;
    }
    
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    
    // Clear onboarding flag in Schema 2.5
    fullSchemaData.settings.onboardingCompleted = false;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    console.log('✅ Onboarding flag reset in Schema 2.5');
    
    showNotification("✅ Onboarding will show again next time you open the app (Schema 2.5).", "success", 3000);
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




// ✅ Modal Utility Functions
function closeAllModals() {
    // Close Schema 2.5 and legacy modals
    const modalSelectors = [
        "[data-modal]",
        ".settings-modal",
        ".mini-cycle-switch-modal",
        "#feedback-modal",
        "#about-modal", 
        "#themes-modal",
        "#games-panel",
        "#reminders-modal",
        "#testing-modal",
        "#recurring-panel-overlay",
        "#storage-viewer-overlay",
        ".mini-modal-overlay",
        ".miniCycle-overlay",
        ".onboarding-modal"
    ];
    
    modalSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(modal => {
            // Special handling for different modal types
            if (modal.dataset.modal !== undefined || modal.classList.contains("menu-container")) {
                modal.classList.remove("visible");
            } else if (modal.id === "recurring-panel-overlay" || modal.id === "storage-viewer-overlay") {
                modal.classList.add("hidden");
            } else {
                modal.style.display = "none";
            }
        });
    });

    // Close task options
    document.querySelectorAll(".task-options").forEach(action => {
        action.style.opacity = "0";
        action.style.visibility = "hidden";
        action.style.pointerEvents = "none";
    });

    // Reset task states
    document.querySelectorAll(".task").forEach(task => {
        task.classList.remove("long-pressed", "draggable", "dragging", "selected");
    });
    
    // Clear any active selections in recurring panels
    document.querySelectorAll(".recurring-task-item.selected").forEach(item => {
        item.classList.remove("selected");
    });
    
    // Hide recurring settings panel if open
    const recurringSettingsPanel = document.getElementById("recurring-settings-panel");
    if (recurringSettingsPanel) {
        recurringSettingsPanel.classList.add("hidden");
    }
}


// ✅ ESC key listener to close modals and reset task UI
safeAddEventListener(document, "keydown", (e) => {
    if (e.key === "Escape") {
        e.preventDefault();
        closeAllModals();
        
        // Also clear any notification focus
        const notifications = document.querySelectorAll(".notification");
        notifications.forEach(notification => {
            if (notification.querySelector(".close-btn")) {
                notification.querySelector(".close-btn").click();
            }
        });
        
        // Return focus to task input
        setTimeout(() => {
            const taskInput = document.getElementById("taskInput");
            if (taskInput && document.activeElement !== taskInput) {
                taskInput.focus();
            }
        }, 100);
    }
});



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

// Initialize help window manager (keep this part the same)
let helpWindowManager;

setTimeout(() => {
    helpWindowManager = new HelpWindowManager();
}, 500);

// ✅ Updated setupModeSelector to use state-based system
function setupModeSelector() {
    console.log('🎯 Setting up mode selectors (state-based)...');
    
    const modeSelector = document.getElementById('mode-selector');
    const mobileModeSelector = document.getElementById('mobile-mode-selector');
    const toggleAutoReset = document.getElementById('toggleAutoReset');
    const deleteCheckedTasks = document.getElementById('deleteCheckedTasks');
    
    console.log('🔍 Element detection:', {
        modeSelector: !!modeSelector,
        mobileModeSelector: !!mobileModeSelector,
        toggleAutoReset: !!toggleAutoReset,
        deleteCheckedTasks: !!deleteCheckedTasks
    });
    
    if (!modeSelector || !mobileModeSelector || !toggleAutoReset || !deleteCheckedTasks) {
        console.warn('⚠️ Mode selector elements not found');
        return;
    }
    
// ✅ Function to sync both selectors with toggles (state-based)
function syncModeFromToggles() {
    console.log('🔄 Syncing mode from toggles (state-based)...');
    
    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for syncModeFromToggles');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for syncModeFromToggles');
        return;
    }
    
    const { data, appState } = currentState;
    const activeCycle = appState.activeCycleId;
    const currentCycle = data.cycles[activeCycle];
    
    let autoReset = false;
    let deleteChecked = false;
    
    if (currentCycle) {
        autoReset = currentCycle.autoReset || false;
        deleteChecked = currentCycle.deleteCheckedTasks || false;
        
        console.log('📊 Mode settings from state:', {
            activeCycle,
            autoReset,
            deleteChecked
        });
        
        // ✅ CRITICAL FIX: Update DOM to match data
        toggleAutoReset.checked = autoReset;
        deleteCheckedTasks.checked = deleteChecked;
    } else {
        console.warn('⚠️ No active cycle found, using DOM state as fallback');
        // ✅ Fallback to DOM state only if no saved data exists
        autoReset = toggleAutoReset.checked;
        deleteChecked = deleteCheckedTasks.checked;
    }
    
    console.log('🔄 Syncing mode from data source:', { autoReset, deleteChecked });
    
    let mode = 'auto-cycle';
    
    // ✅ FIXED: Check deleteChecked FIRST before other conditions
    if (deleteChecked) {
        mode = 'todo-mode';
    } else if (autoReset && !deleteChecked) {
        mode = 'auto-cycle';
    } else if (!autoReset && !deleteChecked) {
        mode = 'manual-cycle';  
    }
    
    console.log('📝 Setting both selectors to:', mode);
    
    // Update both selectors
    modeSelector.value = mode;
    mobileModeSelector.value = mode;
    
    // Update body classes
    document.body.className = document.body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
    document.body.classList.add(mode + '-mode');
    
    // ✅ FIXED: Update container visibility based on mode, not just autoReset
    const deleteContainer = document.getElementById('deleteCheckedTasksContainer');
    const autoResetContainer = document.getElementById('autoResetContainer');
    
    // Hide both individual toggle containers since mode selector controls this functionality
    if (deleteContainer) {
        deleteContainer.style.display = 'none';
    }
    if (autoResetContainer) {
        autoResetContainer.style.display = 'none';
    }
    
    console.log('✅ Mode selectors synced to Schema 2.5:', mode);
}
    
    // ✅ Function to sync toggles from either selector
    function syncTogglesFromMode(selectedMode) {
        console.log('🔄 Syncing toggles from mode selector:', selectedMode);
        
        switch(selectedMode) {
            case 'auto-cycle':
                toggleAutoReset.checked = true;
                deleteCheckedTasks.checked = false;
                break;
            case 'manual-cycle':
                toggleAutoReset.checked = false;
                deleteCheckedTasks.checked = false;
                break;
            case 'todo-mode':
                toggleAutoReset.checked = false;
                deleteCheckedTasks.checked = true;
                break;
        }
        
        // Keep both selectors in sync
        modeSelector.value = selectedMode;
        mobileModeSelector.value = selectedMode;
        
        // ✅ UPDATE STORAGE FIRST before dispatching events
        updateStorageFromToggles();
        
        // ✅ THEN trigger change events (but prevent them from updating storage again)
        console.log('🔔 Dispatching change events to update storage...');
        toggleAutoReset.dispatchEvent(new Event('change'));
        deleteCheckedTasks.dispatchEvent(new Event('change'));
        
        // Update UI
        syncModeFromToggles();
        
        checkCompleteAllButton();
        
        if (typeof updateRecurringButtonVisibility === 'function') {
            updateRecurringButtonVisibility();
        }
        
        // ✅ Show mode description in help window
        if (helpWindowManager && typeof helpWindowManager.showModeDescription === 'function') {
            helpWindowManager.showModeDescription(selectedMode);
        }
        
        console.log('✅ Toggles synced from mode selector');
    }
    
    // ✅ Add this helper function to update storage from current toggle states (state-based)
function updateStorageFromToggles() {
    console.log('💾 Updating storage from toggles (state-based)...');
    
    // ✅ Use state-based data access
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for updateStorageFromToggles');
        return;
    }
    
    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for updateStorageFromToggles');
        return;
    }
    
    const { appState } = currentState;
    const activeCycle = appState.activeCycleId;
    
    if (!activeCycle) {
        console.warn('⚠️ No active cycle found for storage update');
        return;
    }
    
    const toggleAutoReset = document.getElementById('toggleAutoReset');
    const deleteCheckedTasks = document.getElementById('deleteCheckedTasks');
    
    // ✅ Update through state system
    window.AppState.update(state => {
        const cycle = state.data.cycles[activeCycle];
        if (cycle) {
            cycle.autoReset = toggleAutoReset.checked;
            cycle.deleteCheckedTasks = deleteCheckedTasks.checked;
        }
    }, true); // immediate save
    
    console.log('✅ Storage updated from toggles (state-based)');
} 
    // ✅ Set up event listeners for both selectors
    console.log('📡 Setting up event listeners for both selectors...');
    
    modeSelector.addEventListener('change', (e) => {
        console.log('🎯 Desktop mode selector changed:', e.target.value);
        syncTogglesFromMode(e.target.value);
        showNotification(`Switched to ${getModeName(e.target.value)}`, 'info', 2000);
    });
    
    mobileModeSelector.addEventListener('change', (e) => {
        console.log('📱 Mobile mode selector changed:', e.target.value);
        syncTogglesFromMode(e.target.value);
        showNotification(`Switched to ${getModeName(e.target.value)}`, 'info', 2000);
    });
    
    toggleAutoReset.addEventListener('change', (e) => {
        console.log('🔘 Auto Reset toggle changed:', e.target.checked);
        syncModeFromToggles();
         checkCompleteAllButton();
    });
    
    deleteCheckedTasks.addEventListener('change', (e) => {
        console.log('🗑️ Delete Checked Tasks toggle changed:', e.target.checked);
        syncModeFromToggles();
         checkCompleteAllButton();
    });
    
    // ✅ Initialize on load
    console.log('🚀 Initializing mode selectors...');
    syncModeFromToggles();
    
    console.log('✅ Mode selectors setup complete');
}


// ✅ Updated updateCycleModeDescription to Schema 2.5 only
function updateCycleModeDescription() {
    console.log('📝 Updating cycle mode description (Schema 2.5 only)...');
    
    // ✅ Schema 2.5 only
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for updateCycleModeDescription');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    const currentCycle = cycles[activeCycle];
    
    let autoReset = false;
    let deleteChecked = false;
    
    if (currentCycle) {
        autoReset = currentCycle.autoReset || false;
        deleteChecked = currentCycle.deleteCheckedTasks || false;
    }
    
    console.log('📊 Mode settings:', { autoReset, deleteChecked });
    
    const descriptionBox = document.getElementById("mode-description");
    if (!descriptionBox) {
        console.warn('⚠️ Mode description box not found');
        return;
    }

    let modeTitle = "";
    let modeDetail = "";
    let currentMode = "";

    if (deleteChecked) {
        currentMode = "todo-mode";
        modeTitle = "To-Do List Mode";
        modeDetail = `This mode will not complete any cycles.<br>
        Instead, it will delete all tasks when <br> you hit the complete button.<br>
        This will reveal a recurring option in the <br> task options menu.`;
    } else if (autoReset) {
        currentMode = "auto-cycle";
        modeTitle = "Auto Cycle Mode";
        modeDetail = `Tasks will automatically reset when<br>all are completed. This is the traditional<br>miniCycle experience.`;
    } else {
        currentMode = "manual-cycle";
        modeTitle = "Manual Cycle Mode";
        modeDetail = `Tasks will only reset when you<br>manually click the complete button.<br>Gives you more control over timing.`;
    }

    descriptionBox.innerHTML = `<strong>${modeTitle}:</strong><br>${modeDetail}`;
    
    console.log('✅ Mode description updated:', currentMode);
}






/*****SPEACIAL EVENT LISTENERS *****/

document.addEventListener("dragover", (event) => {
  event.preventDefault();
  requestAnimationFrame(() => {
      const movingTask = event.target.closest(".task");
      if (movingTask) {
          handleRearrange(movingTask, event);
      }
      autoSave();
  });
});
document.addEventListener("touchstart", () => {
    hasInteracted = true;
}, { once: true });



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

function setupThemesPanel() {
    // ✅ Schema 2.5 only
    console.log('🎨 Setting up themes panel (Schema 2.5 only)...');
    
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.warn('⚠️ Schema 2.5 data not yet available for setupThemesPanel - deferring setup');
        // Defer setup until data is available
        setTimeout(() => {
            const retryData = loadMiniCycleData();
            if (retryData) {
                console.log('🎨 Retrying setupThemesPanel with loaded data...');
                setupThemesPanelWithData(retryData);
            } else {
                console.warn('⚠️ Schema 2.5 data still not available for setupThemesPanel');
            }
        }, 1000);
        return;
    }

    setupThemesPanelWithData(schemaData);
}

function setupThemesPanelWithData(schemaData) {
    const { settings } = schemaData;
    const unlockedThemes = settings.unlockedThemes || [];
    const hasUnlockedThemes = unlockedThemes.length > 0;
    
    const themeButton = document.getElementById("open-themes-panel");
    const themesModal = document.getElementById("themes-modal");
    const closeThemesBtn = document.getElementById("close-themes-btn");
  
    // ✅ Show the button if ANY theme is unlocked
    if (hasUnlockedThemes && themeButton) {
      themeButton.style.display = "block";
    }
  
    // ✅ Open modal
    if (themeButton) {
        themeButton.addEventListener("click", () => {
          themesModal.style.display = "flex";
          hideMainMenu(); // Hide the main menu when opening
        });
    }
  
    // ✅ Close modal
    if (closeThemesBtn) {
        closeThemesBtn.addEventListener("click", () => {
          themesModal.style.display = "none";
        });
    }
  
    // ✅ Setup dark mode toggle inside themes modal
    setupDarkModeToggle("darkModeToggleThemes", ["darkModeToggle", "darkModeToggleThemes"]);
    
    console.log('✅ Themes panel setup completed (Schema 2.5)');
}



// ✅ Initialize themes panel (moved to DOMContentLoaded for proper timing)


updateCycleModeDescription();
 // Moved to initialization sequence
 setTimeout(updateCycleModeDescription, 10000);








/*

(function boot() {
  function start() {
    try {
      // --- sync init ---
      fixTaskValidationIssues();
      setupMainMenu();
      setupSettingsMenu();
      setupAbout();
      setupUserManual();
      setupFeedbackModal();
      // Add themes panel setup after other modal setups
      // setupTestingModal(); // Removed duplicate - already called in main boot function
      initializeThemesPanel();
      initializeModeSelector();
      setupRecurringPanel();
      attachRecurringSummaryListeners();
      updateNavDots();
      loadMiniCycle();
      initializeDefaultRecurringSettings();
      setupMiniCycleTitleListener();
      setupDownloadMiniCycle();
      setupUploadMiniCycle();
      setupRearrange();
      dragEndCleanup();
      // ✅ MOVED: updateMoveArrowsVisibility() moved to proper initialization phase
      checkDueDates();
      loadAlwaysShowRecurringSetting();
      updateCycleModeDescription();
         setupThemesPanel(); 

      // --- timers / async kickoffs ---
      setTimeout(remindOverdueTasks, 2000);
      setTimeout(function(){ updateReminderButtons(); startReminders(); }, 200);

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
