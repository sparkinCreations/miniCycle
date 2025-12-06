/**
 * ============================================================================
 * MINI-CYCLE MAIN ENTRY POINT & APPLICATION ORCHESTRATOR
 * ============================================================================
 *
 * Welcome to miniCycle! - MJ, Developer
 * Website: https://sparkincreations.com | App: https://minicycleapp.com
 *
 * ============================================================================
 * WHY THIS FILE IS LARGE (~4,700 lines) - READ THIS FIRST
 * ============================================================================
 *
 * This file is the APPLICATION WIRING HUB and is INTENTIONALLY comprehensive.
 * It should NOT be arbitrarily split - doing so creates circular dependencies.
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * 1. GLOBAL STATE SETUP (Lines 1-262)
 *    - AppGlobalState, FeatureFlags, property getters
 *    - Must exist before any module loads
 *
 * 2. DEPENDENCY INJECTION WIRING (Lines 263-1850)
 *    - Creates `deps` container for true DI
 *    - Loads all modules with version cache-busting
 *    - Wires dependencies between 44+ modules
 *    - Phase 1 (Core) → Phase 2 (Features) → Phase 3 (UI)
 *
 * 3. RUNTIME FUNCTIONS (Lines 1851-4692)
 *    - Core task operations (addTask, createTaskLabel, etc.)
 *    - Settings management (saveToggleAutoReset - 758 lines)
 *    - Progress tracking (updateProgressBar, checkMiniCycle, etc.)
 *    - UI utilities and helpers
 *
 * WHY NOT SPLIT FURTHER:
 * ----------------------
 * - DI wiring MUST happen in one place to avoid circular deps
 * - Functions share closure-scoped variables (deps, uiRefs)
 * - Splitting creates more files without true decoupling
 * - See: docs/future-work/REMAINING_EXTRACTIONS_ANALYSIS.md
 *
 * EXTRACTION CANDIDATES (When Ready):
 * ------------------------------------
 * - saveToggleAutoReset (758 lines) → settingsManager.js
 * - createTaskLabel (350 lines) → taskLabelManager.js
 * - Completed Tasks section (214 lines) → completedTasksManager.js
 * - Progress system (270 lines) → progressManager.js
 *
 * ARCHITECTURE DOCS:
 * ------------------
 * - Module patterns: docs/developer-guides/MODULE_SYSTEM_GUIDE.md
 * - DI-pure modules: docs/developer-guides/TASKDOM_DI_GUIDE.md
 * - Extraction plan: docs/future-work/REMAINING_EXTRACTIONS_ANALYSIS.md
 *
 * ============================================================================
 */





// ============================================================================
// SECTION 1: GLOBAL STATE SETUP (Lines ~60-262)
// ============================================================================
// This houses all the app's critical state that needs to be accessible everywhere.
// Must exist BEFORE any module loads - these are the foundation variables.

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
  activeUndoStack: [],  // ✅ Renamed from undoStack (per-cycle)
  activeRedoStack: [],  // ✅ Renamed from redoStack (per-cycle)
  activeCycleIdForUndo: null,  // ✅ Track which cycle's undo is loaded
  isSwitchingCycles: false,  // ✅ Block snapshots during cycle switches
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

// ✅ FIX: Map legacy names to actual property names (activeUndoStack/activeRedoStack)
Object.defineProperty(window, 'undoStack', {
  get: () => window.AppGlobalState.activeUndoStack,
  set: (value) => { window.AppGlobalState.activeUndoStack = value; }
});

Object.defineProperty(window, 'redoStack', {
  get: () => window.AppGlobalState.activeRedoStack,
  set: (value) => { window.AppGlobalState.activeRedoStack = value; }
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








// ============================================================================
// SECTION 2: DEPENDENCY INJECTION WIRING HUB (Lines ~263-1850)
// ============================================================================
// Main application initialization sequence.
// This section loads all modules and wires their dependencies together.
// The `deps` container enables true DI - modules receive deps, not window.*

document.addEventListener('DOMContentLoaded', async (event) => {
    console.log('🚀 Starting miniCycle initialization (Schema 2.5 only)...');

  window.AppBootStarted = true;
  window.AppBootStartTime = Date.now(); // ✅ Track boot start time

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
    // Cycle/task modules
    core: {}
  };

  // ✅ Load appInit FIRST without version (so all static imports in modules share this singleton)
  // This is critical: utility modules use static imports like `import { appInit } from './appInitialization.js'`
  // If we version this import, we create separate instances and break the shared state
  const { appInit } = await import('./modules/core/appInit.js');
  deps.core.appInit = appInit;

  // ✅ Load core constants (without version for consistency)
  const {
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS
  } = await import('./modules/core/constants.js');

  // ✅ NOW create version helper for all OTHER dynamic imports (not appInit or constants)
  const withV = (path) => `${path}?v=${window.APP_VERSION}`;

  // ✅ Create AppMeta object for DI-friendly version access
  window.AppMeta = {
    version: window.APP_VERSION
  };

  // ✅ Set backward compatibility alias
  window.AppInit = appInit;

  console.log('🚀 appInit and constants loaded (2-phase initialization system)');

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



   



    // ============================================
    // MODULE LOADING WITH DEPENDENCY COLLECTION
    // All modules loaded with withV() for cache-busting
    // ============================================

    // ✅ Inject core constants (imported earlier, before withV was available)

    // ✅ Load GlobalUtils
    const globalUtilsModule = await import(withV('./modules/utils/globalUtils.js'));
    const GlobalUtils = globalUtilsModule.default;

    // Store in deps container
    deps.utils.GlobalUtils = GlobalUtils;
    deps.utils.sanitizeInput = GlobalUtils.sanitizeInput;
    deps.utils.escapeHtml = GlobalUtils.escapeHtml;
    deps.utils.generateId = GlobalUtils.generateId;
    deps.utils.debounce = GlobalUtils.debounce;
    deps.utils.throttle = GlobalUtils.throttle;
    deps.utils.safeAddEventListener = GlobalUtils.safeAddEventListener;
    deps.utils.syncAllTasksWithMode = GlobalUtils.syncAllTasksWithMode;
    deps.utils.DEFAULT_TASK_OPTION_BUTTONS = globalUtilsModule.DEFAULT_TASK_OPTION_BUTTONS;

    // Still expose to window for backward compat (will be removed incrementally)
    window.GlobalUtils = GlobalUtils;
    window.DEFAULT_TASK_OPTION_BUTTONS = globalUtilsModule.DEFAULT_TASK_OPTION_BUTTONS;
    // Expose individual utility functions to window
    window.safeAddEventListener = GlobalUtils.safeAddEventListener;
    window.safeAddEventListenerById = GlobalUtils.safeAddEventListenerById;
    window.safeRemoveEventListener = GlobalUtils.safeRemoveEventListener;
    window.safeGetElementById = GlobalUtils.safeGetElementById;
    window.safeQuerySelector = GlobalUtils.safeQuerySelector;
    window.safeQuerySelectorAll = GlobalUtils.safeQuerySelectorAll;
    window.safeSetInnerHTML = GlobalUtils.safeSetInnerHTML;
    window.safeSetTextContent = GlobalUtils.safeSetTextContent;
    window.safeToggleClass = GlobalUtils.safeToggleClass;
    window.safeAddClass = GlobalUtils.safeAddClass;
    window.safeRemoveClass = GlobalUtils.safeRemoveClass;
    window.safeLocalStorageGet = GlobalUtils.safeLocalStorageGet;
    window.safeLocalStorageSet = GlobalUtils.safeLocalStorageSet;
    window.safeLocalStorageRemove = GlobalUtils.safeLocalStorageRemove;
    window.safeJSONParse = GlobalUtils.safeJSONParse;
    window.safeJSONStringify = GlobalUtils.safeJSONStringify;
    window.sanitizeInput = GlobalUtils.sanitizeInput;
    window.escapeHtml = GlobalUtils.escapeHtml;
    window.debounce = GlobalUtils.debounce;
    window.throttle = GlobalUtils.throttle;
    window.generateId = GlobalUtils.generateId;
    window.generateHashId = GlobalUtils.generateHashId;
    window.generateNotificationId = GlobalUtils.generateNotificationId;
    window.isElementInViewport = GlobalUtils.isElementInViewport;
    window.syncAllTasksWithMode = GlobalUtils.syncAllTasksWithMode;
    console.log('🛠️ Global utilities loaded');

    // ✅ Load Error Handler
    const errorHandlerMod = await import(withV('./modules/utils/errorHandler.js'));
    console.log('🛡️ Global error handlers initialized');

    // ✅ Load Data Validator (needed before settingsManager)
    const dataValidatorMod = await import(withV('./modules/utils/dataValidator.js'));
    // Wire dependency using deps container (true DI pattern)
    dataValidatorMod.setDataValidatorDependencies({
        sanitizeInput: deps.utils.sanitizeInput
    });
    deps.utils.DataValidator = dataValidatorMod.DataValidator;
    // Still expose to window for backward compat
    window.DataValidator = dataValidatorMod.DataValidator;
    console.log('🛡️ Data Validator loaded');

    // ✅ Load Console Capture
    const consoleCaptureMod = await import(withV('./modules/utils/consoleCapture.js'));
    window.consoleCapture = consoleCaptureMod.default;

    // ✅ Load Notifications
    const notificationsMod = await import(withV('./modules/utils/notifications.js'));
    const notifications = new notificationsMod.MiniCycleNotifications();

    // Store in deps container - this is the canonical reference
    deps.utils.notifications = notifications;
    deps.utils.showNotification = (message, type, duration) => notifications.show(message, type, duration);

    // Still expose to window for backward compat
    window.notifications = notifications;
    window.showNotification = function(message, type, duration) {
        console.log(`🔍 WRAPPER received - Type: "${type}", Duration: ${duration} (type: ${typeof duration}), arguments.length: ${arguments.length}`);
        return notifications.show(message, type, duration);
    };
    console.log('✅ Notifications loaded');

    // ✅ Load Theme Manager
    const themeManagerMod = await import(withV('./modules/features/themeManager.js'));
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
            showNotification: deps.utils.showNotification
            // AppState and hideMainMenu injected later
        });
    }
    console.log('✅ Theme Manager loaded');

    // ✅ Load Games Manager
    const gamesManagerMod = await import(withV('./modules/ui/gamesManager.js'));
    // Inject appVersion via dependency setter
    if (gamesManagerMod.setGamesManagerDependencies) {
        gamesManagerMod.setGamesManagerDependencies({
            AppMeta: window.AppMeta
        });
    }
    // Expose to window immediately
    window.GamesManager = gamesManagerMod.default;
    window.gamesManager = gamesManagerMod.gamesManager;
    window.unlockMiniGame = (...args) => gamesManagerMod.gamesManager?.unlockMiniGame?.(...args);
    window.checkGamesUnlock = (...args) => gamesManagerMod.gamesManager?.checkGamesUnlock?.(...args);
    console.log('✅ Games Manager loaded');

    // ✅ Load Onboarding Manager
    const onboardingManagerMod = await import(withV('./modules/ui/onboardingManager.js'));
    // Inject appVersion via dependency setter
    if (onboardingManagerMod.setOnboardingManagerDependencies) {
        onboardingManagerMod.setOnboardingManagerDependencies({
            AppMeta: window.AppMeta
        });
    }
    window.onboardingManager = onboardingManagerMod.onboardingManager;
    console.log('✅ Onboarding Manager loaded');

    // ✅ Load Modal Manager (Phase 3 - no auto-init, initialized later with full deps)
    const modalManagerMod = await import(withV('./modules/ui/modalManager.js'));
    // Note: modalManager instance is null until initModalManager is called later
    console.log('✅ Modal Manager module loaded (awaiting initialization)');

    // ✅ Load Migration Manager
    console.log('🔄 Loading migration manager (core system)...');
    const migrationMod = await import(withV('./modules/cycle/migrationManager.js'));

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
    window.completeInitialSetup = completeInitialSetup;



// ...existing code...

// ✅ wireUndoRedoUI moved to modules/ui/undoRedoManager.js

// ✅ Data-ready initialization - runs immediately (no more deferral needed)
// The code below will execute after data is loaded in the main sequence
(async () => {
  console.log('🟢 Data-ready initializers running…');

  // ✅ Continue Phase 1: Initialize state module
  try {
    console.log('🗃️ Initializing state module...');

    const { createStateManager, resetStateManager } = await import(withV('./modules/core/appState.js'));
    window.AppState = createStateManager({
      showNotification: deps.utils.showNotification || console.log.bind(console),  // ✅ Use direct function
      storage: localStorage,
      createInitialData: createInitialSchema25Data,
      AppMeta: window.AppMeta
    });

    // ✅ Store in deps container for DI
    deps.core.AppState = window.AppState;

    await window.AppState.init();
    console.log('✅ State module initialized successfully after data setup');

    // ✅ CRITICAL: Mark core systems as ready (unblocks all waiting modules)
    await appInit.markCoreSystemsReady();

        // ============ PHASE 2: MODULES ============
        console.log('🔌 Phase 2: Loading modules (appInit-compliant)...');

        // ✅ Initialize Drag & Drop Manager (Phase 2 module - waits for core internally)
        console.log('🔄 Initializing drag & drop manager...');
        const dragDropMod = await import(withV('./modules/task/dragDropManager.js'));
        const { initDragDropManager, enableDragAndDropOnTask, updateMoveArrowsVisibility, toggleArrowVisibility, updateArrowsInDOM } = dragDropMod;


        window.updateMoveArrowsVisibility = updateMoveArrowsVisibility;
        window.toggleArrowVisibility = toggleArrowVisibility;
        window.updateArrowsInDOM = updateArrowsInDOM;

        const dragDropManager = await initDragDropManager({
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
          showNotification: (msg, type, duration) => showNotification?.(msg, type, duration),
          AppMeta: window.AppMeta
        });

        // Phase 3: Main script handles window.* exposure
        window.dragDropManager = dragDropManager;
        window.enableDragAndDropOnTask = enableDragAndDropOnTask;

        console.log('✅ DragDropManager initialized and ready (Phase 3)');

        // ✅ Initialize Device Detection (Phase 2 module)
        console.log('📱 Initializing device detection module...');
        const { DeviceDetectionManager } = await import(withV('./modules/utils/deviceDetection.js'));

        const deviceDetectionManager = new DeviceDetectionManager({
            loadMiniCycleData: () => window.loadMiniCycleData ? window.loadMiniCycleData() : null,
            showNotification: deps.utils.showNotification,  // ✅ Use direct function
            AppMeta: window.AppMeta
        });

        window.deviceDetectionManager = deviceDetectionManager;


        console.log('✅ DeviceDetectionManager initialized (Phase 2)');

        // ✅ Initialize Stats Panel (Phase 2 module)
        console.log('📊 Initializing stats panel module...');
        const { StatsPanelManager } = await import(withV('./modules/features/statsPanel.js'));

        const statsPanelManager = new StatsPanelManager({
            showNotification: deps.utils.showNotification,  // ✅ Use direct function
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
            isOverlayActive: () => window.isOverlayActive ? window.isOverlayActive() : false,
            AppMeta: window.AppMeta
        });

        // Expose stats panel functions globally
        window.statsPanelManager = statsPanelManager;
        window.showStatsPanel = () => statsPanelManager.showStatsPanel();
        window.showTaskView = () => statsPanelManager.showTaskView();
        window.updateStatsPanel = () => statsPanelManager.updateStatsPanel();


        console.log('✅ StatsPanelManager initialized (Phase 2)');

        // ✅ Initialize Task DOM Manager (Phase 2 module)
        console.log('🎨 Initializing task DOM module...');
        console.log('⏱️ CHECKPOINT: About to call initTaskDOMManager');
        try {
            const {
                initTaskDOMManager,
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
            } = await import(withV('./modules/task/taskDOM.js'));
            console.log('✅ taskDOM.js imported successfully');

            // ✅ Expose taskDOM functions to window (needed by addTask and other modules)
            window.extractTaskDataFromDOM = extractTaskDataFromDOM;
            window.createTaskDOMElements = createTaskDOMElements;
            window.createThreeDotsButton = createThreeDotsButton;
            window.setupTaskInteractions = setupTaskInteractions;
            window.setupRecurringButtonHandler = setupRecurringButtonHandler;
            window.finalizeTaskCreation = finalizeTaskCreation;
            window.loadTaskContext = loadTaskContext;
            window.validateAndSanitizeTaskInput = validateAndSanitizeTaskInput;
            window.handleTaskButtonClick = handleTaskButtonClick;
            window.revealTaskButtons = revealTaskButtons;
            window.refreshUIFromState = refreshUIFromState;

            console.log('⏱️ CHECKPOINT: Calling initTaskDOMManager with dependencies...');
            const taskDOMManager = await initTaskDOMManager({
                // State management - use deps container
                AppState: window.AppState,  // Will be deps.core.AppState once wired
                AppMeta: window.AppMeta,  // ✅ Injected version (no window.* in modules)

                // Data operations - use deps.utils
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                sanitizeInput: deps.utils.sanitizeInput,  // ✅ From deps container
                generateId: deps.utils.generateId,  // ✅ From deps container
                autoSave: () => window.autoSave?.(),

                // UI notification and updates - use deps.utils
                showNotification: deps.utils.showNotification,  // ✅ From deps container
                updateProgressBar: () => window.updateProgressBar?.(),
                updateStatsPanel: () => window.updateStatsPanel?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                refreshUIFromState: () => window.refreshUIFromState?.(),
                updateMainMenuHeader: () => window.updateMainMenuHeader?.(),
                updateRecurringPanelButtonVisibility: () => window.updateRecurringPanelButtonVisibility?.(),
                triggerLogoBackground: (type, dur) => window.triggerLogoBackground?.(type, dur),

                // DOM helpers - use deps.utils where available
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel),
                safeAddEventListener: deps.utils.safeAddEventListener,  // ✅ From deps container
                GlobalUtils: window.GlobalUtils,  // ✅ For delete-when-complete sync

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
                revealTaskButtons: (taskItem) => window.revealTaskButtons?.(taskItem),
                handleTaskButtonClick: (event) => window.handleTaskButtonClick?.(event),
                // taskOptionsCustomizer: injected later via afterApp hook (initialized after TaskDOMManager)

                // Drag and drop / arrows
                DragAndDrop: window.DragAndDrop,
                enableDragAndDropOnTask,
                updateArrowsInDOM,
                updateMoveArrowsVisibility,

                // Cycle operations
                checkMiniCycle: () => window.checkMiniCycle?.(),
                loadMiniCycle: () => window.loadMiniCycle?.(),

                // Constants from deps container
                DEFAULT_TASK_OPTION_BUTTONS: deps.utils.DEFAULT_TASK_OPTION_BUTTONS
            });

            // Phase 3: Main script handles window.* exposure
            window.__taskDOMManager = taskDOMManager;
            window.taskEvents = taskDOMManager.events;

            // Expose sub-module classes globally (for multiple module instance fallback)
            window.__TaskValidator = taskDOMManager.TaskValidator;
            window.__TaskUtils = taskDOMManager.TaskUtils;
            window.__TaskRenderer = taskDOMManager.TaskRenderer;
            window.__TaskEvents = taskDOMManager.TaskEvents;

            console.log('✅ Task DOM module initialized (Phase 3)');
            console.log('⏱️ CHECKPOINT: initTaskDOMManager completed successfully');


            // ✅ Expose taskDOMManager status globally for debugging
            window.isTaskDOMReady = true;
            console.log('✅ window.isTaskDOMReady = true');
        } catch (error) {
            console.error('❌ CRITICAL: Failed to initialize task DOM module:', error);
            console.error('❌ Error details:', error.message);
            console.error('❌ Stack:', error.stack);
            if (typeof showNotification === 'function') {
                showNotification('❌ Critical error: Task DOM failed to initialize', 'error', 5000);
            }

            // ✅ STOP EXECUTION - can't continue without TaskDOM
            throw new Error('TaskDOM initialization failed - cannot render tasks');
        }

        // ✅ Initialize Task Options Customizer (Phase 3 module - no window.* in module)
        console.log('⚙️ Initializing task options customizer...');
        try {
            const { initTaskOptionsCustomizer, TaskOptionsCustomizer } = await import(withV('./modules/ui/taskOptionsCustomizer.js'));

            const taskOptionsCustomizer = await initTaskOptionsCustomizer({
                AppState: window.AppState,
                showNotification: deps.utils.showNotification,  // ✅ Use direct function
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                renderTaskList: () => window.refreshTaskListUI?.()
            });

            // Phase 3: Main script handles window.* exposure
            window.taskOptionsCustomizer = taskOptionsCustomizer;
            window.TaskOptionsCustomizer = TaskOptionsCustomizer;

            // Inject into TaskDOMManager (late-bound dependency)
            if (window.__taskDOMManager) {
                window.__taskDOMManager.injectDependency('taskOptionsCustomizer', taskOptionsCustomizer);
            }

            console.log('✅ Task options customizer initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize task options customizer:', error);
            if (typeof showNotification === 'function') {
                showNotification('Task customization feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without task customization functionality');
        }

        // ✅ Initialize Reminders Module (Phase 3 module - no window.* in module)
        // IMPORTANT: Load BEFORE recurring modules because recurring task rendering needs reminder button handlers
        console.log('🔔 Initializing reminders module...');
        try {
            const { initReminderManager } = await import(withV('./modules/features/reminders.js'));

            const reminderManager = await initReminderManager({
                showNotification: deps.utils.showNotification,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                getElementById: (id) => document.getElementById(id),
                querySelectorAll: (selector) => document.querySelectorAll(selector),
                updateUndoRedoButtons: () => window.updateUndoRedoButtons?.(),
                safeAddEventListener: (element, event, handler) => window.safeAddEventListener?.(element, event, handler),
                autoSave: () => window.autoSave?.(),
                AppMeta: window.AppMeta
            });

            // ✅ Phase 3: Main script handles window.* exposure (not the module)
            window.reminderManager = reminderManager;
            window.startReminders = () => reminderManager.startReminders();
            window.stopReminders = () => reminderManager.stopReminders();
            window.handleReminderToggle = () => reminderManager.handleReminderToggle();
            window.autoSaveReminders = () => reminderManager.autoSaveReminders();
            window.loadRemindersSettings = () => reminderManager.loadRemindersSettings();
            window.saveTaskReminderState = (taskId, isEnabled) => reminderManager.saveTaskReminderState(taskId, isEnabled);
            window.updateReminderButtons = () => reminderManager.updateReminderButtons();
            window.setupReminderButtonHandler = (button, taskContext) => reminderManager.setupReminderButtonHandler(button, taskContext);

            console.log('✅ Reminders module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize reminders module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Reminders feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without reminders functionality');
        }

        // ✅ Initialize Recurring Modules (Phase 3 module - no window.* in module)
        console.log('🔄 Initializing recurring task modules...');
        try {
            const { initializeRecurringModules, testRecurringIntegration } = await import(withV('./modules/recurring/recurringIntegration.js'));
            const recurringModules = await initializeRecurringModules({ AppMeta: window.AppMeta });

            // Phase 3: Main script handles window.* exposure
            window._recurringModules = recurringModules;
            window.recurringCore = recurringModules.coreAPI;
            window.recurringPanel = recurringModules.panelAPI;
            window.testRecurringIntegration = testRecurringIntegration;
            // Direct function exposure for backward compatibility
            window.openRecurringSettingsPanelForTask = (taskId) => recurringModules.panelAPI.openForTask(taskId);
            window.updateRecurringPanelButtonVisibility = () => recurringModules.panelAPI.updateButtonVisibility();
            // ✅ Expose activation/deactivation handlers for taskDOM.js
            window.handleRecurringTaskActivation = (task, taskContext, button) => recurringModules.coreAPI.handleActivation(task, taskContext, button);
            window.handleRecurringTaskDeactivation = (task, taskContext, assignedTaskId) => recurringModules.coreAPI.handleDeactivation(task, taskContext, assignedTaskId);
            window.applyRecurringToTaskSchema25 = (...args) => recurringModules.coreAPI.applyRecurringSettings(...args);
            // ✅ Expose removeRecurringTasksFromCycle for taskCore.js reset logic
            window.removeRecurringTasksFromCycle = (taskElements, cycleData) => recurringModules.coreAPI.removeTasksFromCycle(taskElements, cycleData);

            console.log('✅ Recurring modules initialized (Phase 3)');

            // Optional: Run integration test in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🧪 Running recurring integration test...');
                setTimeout(() => {
                    const results = testRecurringIntegration();
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

        // ✅ Initialize Due Dates Module (Phase 3 module - no window.* in module)
        console.log('📅 Initializing due dates module...');
        try {
            const { initDueDatesManager } = await import(withV('./modules/features/dueDates.js'));

            const dueDatesManager = await initDueDatesManager({
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                showNotification: deps.utils.showNotification,  // ✅ Use direct function
                updateStatsPanel: () => window.updateStatsPanel?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                saveTaskToSchema25: (cycleId, cycleData) => window.saveTaskToSchema25?.(cycleId, cycleData),
                getElementById: (id) => document.getElementById(id),
                querySelectorAll: (selector) => document.querySelectorAll(selector),
                safeAddEventListener: (element, event, handler) => window.safeAddEventListener?.(element, event, handler),
                AppState: () => window.AppState,  // ✅ Inject AppState getter
                AppMeta: window.AppMeta
            });

            // Phase 3: Main script handles window.* exposure
            window.dueDatesManager = dueDatesManager;
            window.saveTaskDueDate = (taskId, newDueDate) => dueDatesManager.saveTaskDueDate(taskId, newDueDate);
            window.checkOverdueTasks = (taskToCheck) => dueDatesManager.checkOverdueTasks(taskToCheck);
            window.createDueDateInput = (assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle) =>
                dueDatesManager.createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle);
            window.setupDueDateButtonInteraction = (buttonContainer, dueDateInput) =>
                dueDatesManager.setupDueDateButtonInteraction(buttonContainer, dueDateInput);
            window.updateDueDateVisibility = (autoReset) => dueDatesManager.updateDueDateVisibility(autoReset);

            console.log('✅ Due dates module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize due dates module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Due dates feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without due dates functionality');
        }

        // ✅ Initialize Mode Manager (Phase 3 module - no window.* in module)
        console.log('🎯 Initializing mode manager module...');
        try {
            const { initModeManager } = await import(withV('./modules/cycle/modeManager.js'));

            const modeManager = await initModeManager({
                getAppState: () => window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                createTaskButtonContainer: (ctx) => window.createTaskButtonContainer?.(ctx),
                setupDueDateButtonInteraction: (btn, input) => window.setupDueDateButtonInteraction?.(btn, input),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                showNotification: deps.utils.showNotification,
                helpWindowManager: () => window.helpWindowManager,
                getElementById: (id) => document.getElementById(id),
                querySelectorAll: (sel) => document.querySelectorAll(sel),
                AppMeta: window.AppMeta
            });

            // ✅ Phase 3: Main script handles window.* exposure (not the module)
            window.modeManager = modeManager;
            window.initializeModeSelector = () => modeManager.init();
            window.setupModeSelector = () => modeManager.setupModeSelector();
            window.syncModeFromToggles = () => modeManager.syncModeFromToggles();
            window.updateStorageFromToggles = () => modeManager.updateStorageFromToggles();
            window.refreshTaskButtonsForModeChange = () => modeManager.refreshTaskButtonsForModeChange();
            window.updateCycleModeDescription = () => modeManager.updateCycleModeDescription();
            window.getModeName = (mode) => modeManager.getModeName(mode);

            console.log('✅ Mode manager module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize mode manager module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Mode manager feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without mode manager functionality');
        }

        // ✅ Initialize Cycle Switcher (Phase 3 module - no window.* in module)
        console.log('🔄 Initializing cycle switcher module...');
        try {
            const { initializeCycleSwitcher, switchMiniCycle, renameMiniCycle, deleteMiniCycle } = await import(withV('./modules/cycle/cycleSwitcher.js'));

            const cycleSwitcher = await initializeCycleSwitcher({
                AppState: window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                showNotification: deps.utils.showNotification,
                hideMainMenu: () => window.hideMainMenu?.(),
                showPromptModal: (opts) => window.showPromptModal?.(opts),
                showConfirmationModal: (opts) => window.showConfirmationModal?.(opts),
                sanitizeInput: (text) => GlobalUtils.sanitizeInput(text),
                loadMiniCycle: () => window.loadMiniCycle?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                updateStatsPanel: () => window.updateStatsPanel?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                updateReminderButtons: () => window.updateReminderButtons?.(),
                updateUndoRedoButtons: () => window.updateUndoRedoButtons?.(),
                initialSetup: () => initialSetup?.(),
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel),
                AppMeta: window.AppMeta
            });

            // ✅ Phase 3: Main script handles window.* exposure (not the module)
            window.cycleSwitcher = cycleSwitcher;
            window.switchMiniCycle = switchMiniCycle;
            window.renameMiniCycle = renameMiniCycle;
            window.deleteMiniCycle = deleteMiniCycle;

            console.log('✅ Cycle switcher module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize cycle switcher module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Cycle switcher feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without cycle switcher functionality');
        }

        // ✅ Initialize Cycle Manager (Phase 3 module - no window.* in module)
        console.log('🔄 Initializing cycle manager module...');
        try {
            const { initializeCycleManager } = await import(withV('./modules/cycle/cycleManager.js'));

            const cycleManager = await initializeCycleManager({
                AppState: window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                showPromptModal: (opts) => window.showPromptModal?.(opts),
                showNotification: deps.utils.showNotification,
                sanitizeInput: (text) => GlobalUtils.sanitizeInput(text),
                completeInitialSetup: (id, data) => window.completeInitialSetup?.(id, data),
                hideMainMenu: () => window.hideMainMenu?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                autoSave: () => window.autoSave?.(),
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel),

                // ✅ Storage functions (no global fallbacks in module)
                safeLocalStorageGet: (key, def) => safeLocalStorageGet(key, def),
                safeLocalStorageSet: (key, val) => safeLocalStorageSet(key, val),
                safeJSONParse: (str, def) => safeJSONParse(str, def),
                safeJSONStringify: (data, def) => safeJSONStringify(data, def),

                // ✅ Constants (no global fallbacks in module)
                DEFAULT_TASK_OPTION_BUTTONS: window.DEFAULT_TASK_OPTION_BUTTONS,

                // ✅ Undo system callback (deferred - initialized later)
                onCycleCreated: (cycleId) => window.onCycleCreated?.(cycleId),
                AppMeta: window.AppMeta
            });

            // ✅ Phase 3: Main script handles window.* exposure (not the module)
            window.cycleManager = cycleManager;
            window.showCycleCreationModal = () => cycleManager.showCycleCreationModal?.();
            window.createNewMiniCycle = () => cycleManager.createNewMiniCycle?.();

            console.log('✅ Cycle manager module initialized (Phase 3)');
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
            const undoRedoModule = await import(withV('./modules/ui/undoRedoManager.js'));

            undoRedoModule.setUndoRedoManagerDependencies({
                AppState: window.AppState,
                refreshUIFromState: (state) => window.refreshUIFromState?.(state),
                AppGlobalState: window.AppGlobalState,
                getElementById: (id) => document.getElementById(id),
                safeAddEventListener: deps.utils.safeAddEventListener,  // ✅ From deps container
                wrapperActive: false,
                showNotification: deps.utils.showNotification  // ✅ From deps container
            });

            // Wire up UI and initialize
            undoRedoModule.wireUndoRedoUI();
            undoRedoModule.setupStateBasedUndoRedo();

            // ✅ Initialize undo system with IndexedDB
            await undoRedoModule.initializeUndoSystemForApp();

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

            // ✅ Expose new lifecycle functions
            window.onCycleSwitched = undoRedoModule.onCycleSwitched;
            window.onCycleCreated = undoRedoModule.onCycleCreated;
            window.onCycleDeleted = undoRedoModule.onCycleDeleted;
            window.onCycleRenamed = undoRedoModule.onCycleRenamed;


            console.log('✅ Undo/redo manager module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ Failed to initialize undo/redo manager module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Undo/redo feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without undo/redo functionality');
        }

        // ✅ Initialize Menu Manager (Phase 3 module - no window.* in module)
        console.log('🎛️ Initializing menu manager module...');
        try {
            const { initMenuManager, MenuManager } = await import(withV('./modules/ui/menuManager.js'));

            const menuManager = await initMenuManager({
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                AppState: () => window.AppState,
                showNotification: deps.utils.showNotification,
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
                sanitizeInput: (text) => GlobalUtils.sanitizeInput(text),
                updateCycleData: window.updateCycleData,
                updateProgressBar: () => window.updateProgressBar?.(),
                updateStatsPanel: () => window.updateStatsPanel?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                updateUndoRedoButtons: () => window.updateUndoRedoButtons?.(),
                AppMeta: window.AppMeta
            });

            // ✅ Phase 3: Main script handles window.* exposure (not the module)
            window.MenuManager = MenuManager;
            window.menuManager = menuManager;
            window.setupMainMenu = () => menuManager?.setupMainMenu();
            window.closeMainMenu = () => menuManager?.closeMainMenu();
            window.updateMainMenuHeader = () => menuManager?.updateMainMenuHeader();
            window.hideMainMenu = () => menuManager?.hideMainMenu();
            window.closeMenuOnClickOutside = (event) => menuManager?.closeMenuOnClickOutside(event);
            window.saveMiniCycleAsNew = () => menuManager?.saveMiniCycleAsNew();
            window.clearAllTasks = () => menuManager?.clearAllTasks();
            window.deleteAllTasks = () => menuManager?.deleteAllTasks();

            console.log('✅ Menu manager module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize menu manager module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Menu manager feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without menu manager functionality');
        }

        // ✅ Wire ThemeManager dependencies now that AppState and hideMainMenu are available
        if (themeManagerMod.setThemeManagerDependencies) {
            themeManagerMod.setThemeManagerDependencies({
                AppState: deps.core.AppState,  // ✅ From deps container
                showNotification: deps.utils.showNotification,
                hideMainMenu: () => window.hideMainMenu?.()
            });
        }

        // ✅ Initialize ModalManager (Phase 3 - no auto-init, explicit initialization)
        console.log('🔄 Initializing modal manager module...');
        try {
            const modalManager = await modalManagerMod.initModalManager({
                showNotification: deps.utils.showNotification,
                hideMainMenu: () => window.hideMainMenu?.(),
                sanitizeInput: deps.utils.sanitizeInput,
                safeAddEventListener: deps.utils.safeAddEventListener,
                waitForCore: () => deps.core.appInit.waitForCore(),
                AppMeta: window.AppMeta
            });

            // ✅ Expose to window for backward compatibility
            window.modalManager = modalManager;
            window.closeAllModals = () => modalManager?.closeAllModals?.();

            console.log('✅ Modal manager module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize modal manager:', error);
            console.warn('⚠️ App will continue without modal manager functionality');
        }

        // ✅ Initialize Settings Manager (Phase 3 module - no window.* in module)
        console.log('⚙️ Initializing settings manager module...');
        try {
            const { initSettingsManager } = await import(withV('./modules/ui/settingsManager.js'));

            const settingsManager = await initSettingsManager({
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                AppState: () => window.AppState,
                showNotification: deps.utils.showNotification,  // ✅ Use direct function
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
                performSchema25Migration: () => window.performSchema25Migration?.(),
                AppMeta: window.AppMeta
            });

            // Phase 3: Main script handles window.* exposure
            window.settingsManager = settingsManager;
            window.syncCurrentSettingsToStorage = () => settingsManager.syncCurrentSettingsToStorage();

            console.log('✅ Settings manager module initialized (Phase 3)');
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
            const { initTaskCore, handleTaskCompletionChange, resetTasks, handleCompleteAllTasks, addTask, editTaskFromCore, deleteTaskFromCore, saveTaskToSchema25 } = await import(withV('./modules/task/taskCore.js'));

            // ✅ Expose taskCore functions to window (needed by various modules)
            window.handleTaskCompletionChange = handleTaskCompletionChange;
            window.resetTasks = resetTasks;
            window.handleCompleteAllTasks = handleCompleteAllTasks;
            window.saveTaskToSchema25 = saveTaskToSchema25;

            const taskCore = await initTaskCore({
                // State management
                AppState: window.AppState,
                AppGlobalState: window.AppGlobalState,
                AppMeta: window.AppMeta,

                // Data operations
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                sanitizeInput: (text) => GlobalUtils.sanitizeInput(text),

                // Safe storage utilities (DI-pure)
                safeJSONParse: GlobalUtils.safeJSONParse,
                safeJSONStringify: GlobalUtils.safeJSONStringify,
                safeLocalStorageGet: GlobalUtils.safeLocalStorageGet,
                safeLocalStorageSet: GlobalUtils.safeLocalStorageSet,

                // UI updates
                showNotification: deps.utils.showNotification,
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

                // Task DOM creation (from taskDOM.js)
                validateAndSanitizeTaskInput: (text) => window.validateAndSanitizeTaskInput?.(text),
                loadTaskContext: (...args) => window.loadTaskContext?.(...args),
                createOrUpdateTaskData: (ctx) => window.createOrUpdateTaskData?.(ctx),
                createTaskDOMElements: (ctx, data) => window.createTaskDOMElements?.(ctx, data),
                setupTaskInteractions: (els, ctx) => window.setupTaskInteractions?.(els, ctx),
                finalizeTaskCreation: (els, ctx, opts) => window.finalizeTaskCreation?.(els, ctx, opts),

                // Auto-save
                autoSave: () => window.autoSave?.()
            });

            // Phase 3: Main script handles window.* exposure
            window.taskCore = taskCore;

            console.log('✅ Task core module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize task core module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Task core feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without task core functionality');
        }

        // ✅ Initialize Cycle Loader (Phase 2 module - MUST be after AppState and TaskDOMManager)
        console.log('🔄 Initializing cycle loader module...');
        try {
            const { loadMiniCycle, setCycleLoaderDependencies } = await import(withV('./modules/cycle/cycleLoader.js'));

            // ✅ CRITICAL FIX: Pass AppState as GETTER FUNCTION, not value
            // This prevents capturing null reference from early initialization
            setCycleLoaderDependencies({
                AppState: () => window.AppState,  // ✅ Lazy getter - always returns current value
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                createInitialSchema25Data: () => window.createInitialSchema25Data?.(),
                addTask: (...args) => window.addTask?.(...args),
                updateThemeColor: () => window.updateThemeColor?.(),
                startReminders: () => window.startReminders?.(),
                catchUpMissedRecurringTasks: () => window.catchUpMissedRecurringTasks?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                checkCompleteAllButton: () => window.checkCompleteAllButton?.(),
                updateMainMenuHeader: () => window.updateMainMenuHeader?.(),
                updateStatsPanel: () => window.updateStatsPanel?.()
            });

            // ✅ Expose globally
            window.loadMiniCycle = loadMiniCycle;
            window.setCycleLoaderDependencies = setCycleLoaderDependencies;


            console.log('✅ Cycle loader module initialized (Phase 2)');
        } catch (error) {
            console.error('❌ CRITICAL: Failed to initialize cycle loader:', error);
            console.error('❌ Stack:', error.stack);
            throw new Error('Cycle loader initialization failed - cannot load cycles');
        }

        // ✅ Initialize Pull-to-Refresh (Phase 2 module - mobile only)
        console.log('📱 Initializing pull-to-refresh module...');
        try {
            const { initPullToRefresh } = await import(withV('./modules/ui/pullToRefresh.js'));

            const pullToRefresh = initPullToRefresh({
                showNotification: deps.utils.showNotification
            });

            // Phase 2: Main script handles window.* exposure
            window.pullToRefresh = pullToRefresh;

            console.log('✅ Pull-to-refresh module initialized (Phase 2)');
        } catch (error) {
            console.error('⚠️ Failed to initialize pull-to-refresh module:', error);
            console.warn('⚠️ App will continue without pull-to-refresh functionality');
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
                  if (prev && typeof window.captureStateSnapshot === 'function') {
                    window.captureStateSnapshot(prev);
                  }
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
          if (typeof window.updateUndoRedoButtons === 'function') {
            window.updateUndoRedoButtons();
          }

          // Only capture initial snapshot if not using the update wrapper
          if (!window.__useUpdateWrapper) {
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

        // ✅ Initialize Testing Modal modules (Phase 3)
        console.log('🔬 Loading testing modal modules...');
        try {
            const testingModalMod = await import(withV('./modules/testing/testing-modal.js'));
            console.log('✅ Testing modal loaded');

            // ✅ Setup testing modal button handlers (call directly from module export)
            if (typeof testingModalMod.setupTestingModal === 'function') {
                testingModalMod.setupTestingModal();
                window.setupTestingModal = testingModalMod.setupTestingModal; // Expose for compatibility
                console.log('✅ Testing modal initialized');
            } else {
                console.warn('⚠️ setupTestingModal function not found in module');
            }

            // ✅ Initialize testing modal enhancements (keyboard shortcuts, etc.)
            if (typeof testingModalMod.initializeTestingModalEnhancements === 'function') {
                testingModalMod.initializeTestingModalEnhancements();
                window.initializeTestingModalEnhancements = testingModalMod.initializeTestingModalEnhancements;
                console.log('✅ Testing modal enhancements initialized');
            }

            // Expose other testing modal functions to window
            if (testingModalMod.openStorageViewer) window.openStorageViewer = testingModalMod.openStorageViewer;
            if (testingModalMod.closeStorageViewer) window.closeStorageViewer = testingModalMod.closeStorageViewer;
            if (testingModalMod.appendToTestResults) window.appendToTestResults = testingModalMod.appendToTestResults;
            if (testingModalMod.clearTestResults) window.clearTestResults = testingModalMod.clearTestResults;
            if (testingModalMod.exportTestResults) window.exportTestResults = testingModalMod.exportTestResults;
            if (testingModalMod.copyTestResults) window.copyTestResults = testingModalMod.copyTestResults;

            await import(withV('./modules/testing/testing-modal-integration.js'));
            console.log('✅ Testing modal integration loaded');
        } catch (error) {
            console.error('❌ Failed to load testing modal modules:', error);
            console.warn('⚠️ App will continue without testing modal functionality');
        }

        // ✅ Initialize Backup Manager (Phase 3)
        console.log('💾 Loading backup manager...');
        try {
            await import(withV('./modules/storage/backupManager.js'));
            console.log('✅ Backup manager loaded');

            // ✅ Create auto-backup in background (non-blocking)
            if (window.BackupManager) {
                // Don't await - run in background
                window.BackupManager.createAutoBackup()
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

  // ✅ Initialize completed tasks section
  if (typeof initCompletedTasksSection === 'function') {
    initCompletedTasksSection();
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
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        window.performStateBasedUndo?.();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        window.performStateBasedRedo?.();
    }
});


// ============================================================================
// SECTION 3: RUNTIME FUNCTIONS (Lines ~1885-4692)
// ============================================================================
// Core task operations, settings management, progress tracking, and UI helpers.
// These functions share closure-scoped variables with the DI wiring above.
//
// EXTRACTION CANDIDATES (42% of this section can be extracted when ready):
// - saveToggleAutoReset (758 lines @ ~3934) → settingsManager.js
// - createTaskLabel (350 lines @ ~3286) → taskLabelManager.js
// - Completed Tasks (214 lines @ ~3636) → completedTasksManager.js
// - Progress system (270 lines @ ~2684) → progressManager.js
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


        function refreshTaskListUI() {
          console.log('🔄 Refreshing task list UI (Schema 2.5 only)...');

          const schemaData = window.miniCycle?.state?.load() || loadMiniCycleData();
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
              // ✅ Use window.addTask to ensure we get the correctly initialized function
              (window.addTask || addTask)(
                  task.text,
                  task.completed,
                  false, // Don't double save
                  task.dueDate,
                  task.highPriority,
                  true,  // isLoading (skip overdue reminder immediately)
                  task.remindersEnabled,
                  task.recurring,
                  task.id,
                  task.recurringSettings,
                  task.deleteWhenComplete,
                  task.deleteWhenCompleteSettings
              );
          });

          (window.miniCycle?.tasks?.recurring?.update || window.updateRecurringButtonVisibility || (() => {}))();
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

    let schemaData = window.miniCycle?.state?.load() || loadMiniCycleData();
    
    // ✅ CREATE SCHEMA 2.5 DATA IF IT DOESN'T EXIST
    if (!schemaData) {
        console.log('🆕 No Schema 2.5 data found - creating initial structure...');
        createInitialSchema25Data();
        schemaData = window.miniCycle?.state?.load() || loadMiniCycleData(); // Load the newly created data
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
    await completeInitialSetup(activeCycle, null, schemaData);
}

// ✅ Keep the same completeInitialSetup and createInitialSchema25Data functions
async function completeInitialSetup(activeCycle, fullSchemaData = null, schemaData = null) {
  console.log('✅ Completing initial setup for cycle:', activeCycle);

  // ✅ CRITICAL: Wait for TaskDOM to be fully initialized before loading tasks
  console.log('⏳ Waiting for TaskDOM to be ready...');
  await appInit.waitForApp(); // Ensures all Phase 2 modules (including TaskDOM) are initialized
  console.log('✅ TaskDOM ready, proceeding with task loading');

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

    // ✅ Organize completed tasks into completed section
    if (typeof window.organizeCompletedTasks === 'function') {
      window.organizeCompletedTasks();
      console.log('✅ Completed tasks organized after task rendering');
    }
  } else {
    console.log('⏳ Loader not ready yet, flagging pending load');
    window.__pendingCycleLoad = true;
  }
    
    // Get fresh data if not provided (read-only, safe to use loadMiniCycleData)
    if (!schemaData) {
        schemaData = window.miniCycle?.state?.load() || loadMiniCycleData();
    }

    // ✅ REMOVED: fullSchemaData was loaded but never used (dead code)

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
    

    // ✅ Mark app as ready here (after data-ready)
    // Note: signalReady was removed - appInit.markAppReady() is called in Phase 2
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
            let newTitle = window.sanitizeInput(titleElement.textContent.trim());


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
            const schemaData = window.miniCycle?.state?.load() || loadMiniCycleData();
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

                // ✅ Update via AppState only (no direct localStorage fallback)
                if (window.AppState?.isReady?.()) {
                    await window.AppState.update(state => {
                        const cid = state?.appState?.activeCycleId;
                        const cycle = state?.data?.cycles?.[cid];
                        if (cycle) cycle.title = newTitle;
                    }, true);
                } else {
                    // ✅ AppState should always be ready by this point
                    console.error('❌ Title update failed: AppState not ready');
                    showNotification('Failed to save title change', 'error');
                    titleElement.textContent = oldTitle; // Revert UI
                    return;
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

// ✅ UNIFIED: Single autoSave through AppState only (no direct localStorage writes)
// This prevents race conditions and double-writes that cause data loss

async function autoSave(overrideTaskList = null, immediate = false) {
  // ✅ AppState must be ready - if not, this is a bug in initialization order
  if (!window.AppState?.isReady?.()) {
    console.error('❌ autoSave called before AppState ready - this should not happen after Phase 1');
    console.error('❌ Skipping save to prevent data corruption');
    return { success: false, error: 'AppState not ready' };
  }

  try {
    const taskData = overrideTaskList || window.extractTaskDataFromDOM?.() || [];

    await window.AppState.update(state => {
      const activeCycle = state?.appState?.activeCycleId;
      if (!activeCycle) {
        throw new Error('No active cycle ID found in state');
      }

      const currentCycle = state?.data?.cycles?.[activeCycle];
      if (!currentCycle) {
        throw new Error(`Active cycle "${activeCycle}" not found in state`);
      }

      currentCycle.tasks = taskData;
      // ✅ updateRecurringTemplates handled by recurringCore module (called via watcher)
    }, immediate);

    return { success: true, taskCount: taskData.length };
  } catch (error) {
    console.error('❌ autoSave failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// ✅ REMOVED: directSave() function
// Direct localStorage writes bypass AppState's conflict detection and debouncing,
// causing race conditions and data loss. All saves now go through AppState.

// ✅ Expose autoSave for modules that need it
window.autoSave = autoSave;

// ==========================================
// 🔄 SCHEMA 2.5 MIGRATION SYSTEM. in migrationManager.js
// ==========================================



// ✅ Make loadMiniCycleData() return legacy-compatible data as fallback
function loadMiniCycleData() {
    // ✅ Try AppState first for most current data (if available)
    if (window.AppState?.isReady?.()) {
        try {
            const state = window.AppState.get();
            if (state) {
                // ✅ Load reminders from active cycle (per-cycle)
                const activeCycleId = state.appState.activeCycleId;
                const activeCycle = state.data.cycles[activeCycleId];
                const reminders = activeCycle?.reminders || {
                    enabled: false,
                    indefinite: false,
                    dueDatesReminders: false,
                    repeatCount: 0,
                    frequencyValue: 30,
                    frequencyUnit: "minutes"
                };

                return {
                    cycles: state.data.cycles,
                    activeCycle: activeCycleId,
                    reminders: reminders, // Per-cycle reminders
                    settings: state.settings
                };
            }
        } catch (error) {
            console.warn('⚠️ AppState read failed, falling back to localStorage:', error);
        }
    }

    // Fallback to localStorage
    const data = localStorage.getItem("miniCycleData");
    if (data) {
        try {
            const parsed = JSON.parse(data);
            // ✅ Load reminders from active cycle (per-cycle)
            const activeCycleId = parsed.appState.activeCycleId;
            const activeCycle = parsed.data.cycles[activeCycleId];
            const reminders = activeCycle?.reminders || {
                enabled: false,
                indefinite: false,
                dueDatesReminders: false,
                repeatCount: 0,
                frequencyValue: 30,
                frequencyUnit: "minutes"
            };

            return {
                cycles: parsed.data.cycles,
                activeCycle: activeCycleId,
                reminders: reminders, // Per-cycle reminders
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
        // ✅ Load reminders from active cycle (per-cycle)
        const activeCycleId = parsed.appState.activeCycleId;
        const activeCycle = parsed.data.cycles[activeCycleId];
        const reminders = activeCycle?.reminders || {
            enabled: false,
            indefinite: false,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 30,
            frequencyUnit: "minutes"
        };

        return {
            cycles: parsed.data.cycles,
            activeCycle: activeCycleId,
            reminders: reminders, // Per-cycle reminders
            settings: parsed.settings
        };
    }

    return null;
}

// Make loadMiniCycleData globally accessible
window.loadMiniCycleData = loadMiniCycleData;

/**
 * Safely update cycle data - handles AppState or falls back to localStorage
 * Prevents race conditions with debounced saves by using AppState when available
 *
 * @param {string} cycleId - The cycle ID to update
 * @param {function} updateFn - Function that receives the cycle and modifies it
 * @param {boolean} immediate - Force immediate save (default: true for safety)
 * @returns {Promise<boolean>} - True if update succeeded, false otherwise
 */
async function updateCycleData(cycleId, updateFn, immediate = true) {
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
        // ✅ Use AppState only (no direct localStorage fallback to prevent race conditions)
        if (!window.AppState?.isReady?.()) {
            console.error('❌ updateCycleData called before AppState ready');
            return false;
        }

        // ✅ CRITICAL: Await the update to ensure state is saved before returning
        await window.AppState.update(state => {
            const cycle = state?.data?.cycles?.[cycleId];
            if (cycle) {
                updateFn(cycle);
                console.log('✅ Cycle updated via AppState');
            } else {
                console.warn(`⚠️ Cycle not found: ${cycleId}`);
            }
        }, immediate);
        return true;
    } catch (error) {
        console.error('❌ updateCycleData failed:', error);
        return false;
    }
}

// Make updateCycleData globally accessible for other modules
window.updateCycleData = updateCycleData;





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

    const schemaData = window.miniCycle?.state?.load() || loadMiniCycleData();
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
// ✅ Expose for taskUtils module
window.remindOverdueTasks = remindOverdueTasks;











indefiniteCheckbox.addEventListener("change", () => {
  // If indefinite, hide the repeatCount row
  repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
});



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
        window.location.href = 'lite/miniCycle-lite.html';
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
  // Call notifications directly via window to access the instance
  return window.notifications?.showConfirmationModal?.(options);
}

function showPromptModal(options) {
  // Call notifications directly directly
  return window.notifications?.showPromptModal?.(options);
}

/**
 * Close all modals - delegated to modalManager directly
 */
function closeAllModals() {
  // Call modalManager directly directly
  return window.modalManager?.closeAllModals?.();
}

// ✅ Expose globally
window.showConfirmationModal = showConfirmationModal;
window.showPromptModal = showPromptModal;
window.closeAllModals = closeAllModals;


  // ✅ REMOVED: sendReminderNotificationIfNeeded() and startReminders() - Now in modules/features/reminders.js
  // Use window.sendReminderNotificationIfNeeded() and window.startReminders() which are globally exported

  // ✅ Update recurring panel button visibility if module is loaded
  if (window.recurringPanel?.updateRecurringPanelButtonVisibility) {
      window.recurringPanel.updateRecurringPanelButtonVisibility();
  }


document.getElementById("always-show-recurring")?.addEventListener("change", () => {
    if (window.recurringPanel?.saveAlwaysShowRecurringSetting) {
        window.recurringPanel.saveAlwaysShowRecurringSetting();
    }
});



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
            window.location.href = "legal/user-manual.html"; // ✅ Opens the manual page

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

    // ✅ REMOVED: autoSave() here - causes race condition during initialization
    // Task completion saves explicitly via autoSave(null, true) in checkbox handler
    // This prevents empty task list from being saved before tasks are loaded
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

     (window.miniCycle?.ui?.progress?.update || updateProgressBar)();

    // ✅ Only trigger reset if ALL tasks are completed AND autoReset is enabled
    if (allCompleted && taskList.children.length > 0) {
        console.log(`✅ All tasks completed for "${lastUsedMiniCycle}"`);

        // ✅ Auto-reset: Only reset if AutoReset is enabled
        if (cycleData.autoReset) {
            console.log(`🔄 AutoReset is ON. Resetting tasks for "${lastUsedMiniCycle}"...`);
            setTimeout(() => {
                (window.resetTasks || window.miniCycle?.tasks?.reset)?.();
            }, 1000);
            return;
        }
    }
    console.log("ran check MiniCyle function");
    (window.miniCycle?.ui?.progress?.update || updateProgressBar)();
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

    // ✅ NOTE: Undo snapshot is captured by resetTasks() before the entire cycle completion flow
    // We don't capture it here to avoid duplicate snapshots

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

    // ✅ Handle milestone rewards with the global cycle count
    const globalCyclesCompleted = currentState.userProgress.cyclesCompleted;
    handleMilestoneUnlocks(activeCycle, globalCyclesCompleted);
    
    // ✅ Show animation + update stats
    showCompletionAnimation();
    updateStatsPanel();
}

// Export to window for taskCore module
window.incrementCycleCount = incrementCycleCount;

function handleMilestoneUnlocks(miniCycleName, globalCyclesCompleted) {
    console.log('🏆 Handling milestone unlocks (global cycles)...', globalCyclesCompleted);

    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for milestone unlocks');
        return;
    }

    const currentState = window.AppState.get();
    if (!currentState) {
        console.error('❌ No state data for milestone unlocks');
        return;
    }

    // ✅ Show milestone achievement message based on global cycles
    checkForMilestone(miniCycleName, globalCyclesCompleted);

    // ✅ Theme unlocks based on GLOBAL cycle count across all cycles
    if (globalCyclesCompleted >= 5) {
        unlockDarkOceanTheme();
    }
    if (globalCyclesCompleted >= 50) {
        unlockGoldenGlowTheme();
    }

    // ✅ Game unlock based on GLOBAL cycle count
    if (globalCyclesCompleted >= 100) {
        const unlockedFeatures = currentState.settings?.unlockedFeatures || [];
        const hasGameUnlock = unlockedFeatures.includes("task-order-game");

        if (!hasGameUnlock) {
            showNotification("🎮 Game Unlocked! 'Task Order' is now available in the Games menu.", "success", 6000);
            unlockMiniGame();
        }
    }

    console.log('✅ Milestone unlocks processed (global cycles)');
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


    
// ✅ Main addTask function - now acts as orchestrator
function addTask(taskText, completed = false, shouldSave = true, dueDate = null, highPriority = null, isLoading = false, remindersEnabled = false, recurring = false, taskId = null, recurringSettings = {}, deleteWhenComplete = undefined, deleteWhenCompleteSettings = undefined) {
    // ✅ Use NEW taskDOM module functions via window.* (not old inline functions)

    // Input validation and sanitization
    const validatedInput = window.validateAndSanitizeTaskInput?.(taskText) || (window.miniCycle?.tasks?.validate || validateAndSanitizeTaskInput)(taskText);
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

    const schemaData = window.miniCycle?.state?.load() || loadMiniCycleData();
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
        if (typeof window.enableUndoSystemOnFirstInteraction === 'function') {
            window.enableUndoSystemOnFirstInteraction();
        }

        // ✅ FIX: Use window. prefix to ensure function is found
        if (typeof window.handleTaskCompletionChange === 'function') {
            window.handleTaskCompletionChange(checkbox);
        } else {
            console.warn('⚠️ handleTaskCompletionChange not available');
        }

        if (typeof checkMiniCycle === 'function') {
            checkMiniCycle();
        }
        autoSave(null, true);  // ✅ FIX: Force immediate save on task completion
        triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);

        // ✅ Update undo/redo button states
        if (typeof window.updateUndoRedoButtons === 'function') {
            window.updateUndoRedoButtons();
        }

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

// ✅ toggleHoverTaskOptions removed - now using module version from taskDOM.js

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
// ✅ sanitizeInput removed - now using module version from globalUtils.js

    /**
 * ═══════════════════════════════════════════════════════════════════
 * TASK OPTIONS VISIBILITY CONTROLLER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Centralized controller for task options visibility state.
 * Coordinates between multiple interaction modes (hover, three-dots, focus)
 * to prevent race conditions and conflicting behavior.
 *
 * MODES:
 * - HOVER MODE: Options show on mouseenter/focusin, hide on mouseleave/focusout
 * - THREE-DOTS MODE: Options show ONLY on three-dots button click (manual toggle)
 *
 * See: docs/architecture/EVENT_FLOW_PATTERNS.md for complete documentation
 * ═══════════════════════════════════════════════════════════════════
 */
class TaskOptionsVisibilityController {
    /**
     * Get the current visibility mode
     * @returns {'hover' | 'three-dots'} Current mode
     */
    static getMode() {
        return document.body.classList.contains("show-three-dots-enabled") ? 'three-dots' : 'hover';
    }

    /**
     * Check if a caller is allowed to change visibility in the current mode
     * @param {string} caller - Identifier for the event handler calling this
     * @returns {boolean} Whether the caller can modify visibility
     */
    static canHandle(caller) {
        const mode = this.getMode();

        // 🟣 Always allow long-press, regardless of mode
        // This guarantees mobile long-press can reveal options
        // whether three-dots is enabled or not.
        if (caller === 'long-press') {
            return true;
        }

        const permissions = {
            'hover': ['mouseenter', 'mouseleave', 'focusin', 'focusout', 'hideTaskButtons'],
            'three-dots': ['three-dots-button', 'focusout']
        };

        return permissions[mode]?.includes(caller) || false;
    }

    /**
     * Set task options visibility with mode-aware coordination
     * @param {HTMLElement} taskItem - The task element
     * @param {boolean} visible - Desired visibility state
     * @param {string} caller - Identifier for the event handler (for logging/permissions)
     * @returns {boolean} Whether the visibility was changed
     */
    static setVisibility(taskItem, visible, caller = 'unknown') {
        const taskOptions = taskItem.querySelector('.task-options');
        if (!taskOptions) {
            console.warn(`⚠️ TaskOptionsVisibilityController: No .task-options found for ${caller}`);
            return false;
        }

        // Check if this caller is allowed to change visibility in current mode
        if (!this.canHandle(caller)) {
            console.log(`⏭️ ${caller}: Skipping visibility change in ${this.getMode()} mode`);
            return false;
        }

        // Apply visibility state
        taskOptions.style.visibility = visible ? "visible" : "hidden";
        taskOptions.style.opacity = visible ? "1" : "0";
        taskOptions.style.pointerEvents = visible ? "auto" : "none";

        console.log(`👁️ ${caller}: visibility → ${visible ? 'visible' : 'hidden'} (mode: ${this.getMode()})`);
        return true;
    }

    /**
     * Show task options (convenience method)
     * @param {HTMLElement} taskItem - The task element
     * @param {string} caller - Identifier for the event handler
     * @returns {boolean} Whether the visibility was changed
     */
    static show(taskItem, caller) {
        return this.setVisibility(taskItem, true, caller);
    }

    /**
     * Hide task options (convenience method)
     * @param {HTMLElement} taskItem - The task element
     * @param {string} caller - Identifier for the event handler
     * @returns {boolean} Whether the visibility was changed
     */
    static hide(taskItem, caller) {
        return this.setVisibility(taskItem, false, caller);
    }
}

// Export for global access
window.TaskOptionsVisibilityController = TaskOptionsVisibilityController;

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

        // ✅ Use centralized controller (handles mode checking automatically)
        TaskOptionsVisibilityController.show(taskItem, 'focusin');
      });

      /**
       * ⌨️ Hide task buttons when focus moves outside the entire task
       */
      safeAddEventListener(taskItem, "focusout", (e) => {
        if (taskItem.contains(e.relatedTarget)) return;

        // ✅ Use centralized controller (handles mode checking automatically)
        TaskOptionsVisibilityController.hide(taskItem, 'focusout');
      });
    }

    // ✅ Export for taskDOM module
    window.attachKeyboardTaskOptionToggle = attachKeyboardTaskOptionToggle;


    // ✅ REMOVED: updateReminderButtons() - Now in modules/features/reminders.js
    // Use window.updateReminderButtons() which is globally exported from the module




    /**
 * Showtaskoptions function.
 *
 * @param {any} event - Description. * @returns {void}
 */



    function hideTaskButtons(taskItem) {

      if (taskItem.classList.contains("rearranging")) {
        console.log("⏳ Skipping hide during task rearrangement");
        return;
      }

      // ✅ Don't hide if task is long-pressed (mobile long-press in progress)
      if (taskItem.classList.contains("long-pressed")) {
        console.log("⏳ Skipping hide during long-press");
        return;
      }

        // ✅ Use centralized controller instead of direct manipulation
        // Controller will check permissions and skip if not allowed in current mode
        // In three-dots mode: hideTaskButtons is NOT in the permissions list,
        // so it won't be able to override the three-dots button's visibility control
        const wasHidden = TaskOptionsVisibilityController.hide(taskItem, 'hideTaskButtons');

        if (!wasHidden) {
            console.log('⏭️ hideTaskButtons: Skipped by controller (three-dots mode protection)');
            return;
        }

        // Clear individual button inline styles if we successfully hid
        const taskOptions = taskItem.querySelector(".task-options");
        if (taskOptions) {
            const threeDotsEnabled = document.body.classList.contains("show-three-dots-enabled");

            if (threeDotsEnabled) {
                // Three-dots mode: use inline styles to explicitly hide individual buttons
                taskItem.querySelectorAll(".task-btn").forEach(btn => {
                    btn.style.visibility = "hidden";
                    btn.style.opacity = "0";
                    btn.style.pointerEvents = "none";
                });
            } else {
                // Regular hover mode: clear inline styles to let CSS handle it
                taskItem.querySelectorAll(".task-btn").forEach(btn => {
                    btn.style.visibility = "";
                    btn.style.opacity = "";
                    btn.style.pointerEvents = "";
                });
            }
        }

        // ✅ REMOVED: updateMoveArrowsVisibility() - was causing performance issues
        // Arrow visibility is now controlled by taskOptionButtons customization
        // and should only update when settings change, not on every hide event
    }




    function showTaskOptions(event) {
        const taskElement = event.currentTarget;

        // ✅ Only allow on desktop or if long-pressed on mobile
        const isMobile = isTouchDevice();
        const allowShow = !isMobile || taskElement.classList.contains("long-pressed");

        console.log('🟣 showTaskOptions (hover handler) called:', {
            taskId: taskElement.dataset.id || 'unknown',
            eventType: event.type,
            isMobile,
            isLongPressed: taskElement.classList.contains("long-pressed"),
            allowShow
        });

        if (allowShow) {
            // ✅ Use centralized controller (handles mode checking automatically)
            TaskOptionsVisibilityController.show(taskElement, 'mouseenter');
        }
    }

    // ✅ Export for taskDOM module
    window.showTaskOptions = showTaskOptions;

    function hideTaskOptions(event) {
        const taskElement = event.currentTarget;

        // ✅ Only hide if not long-pressed on mobile (so buttons stay open during drag)
        const isMobile = isTouchDevice();
        const allowHide = !isMobile || !taskElement.classList.contains("long-pressed");

        console.log('🔴 hideTaskOptions (mouseleave handler) called:', {
            taskId: taskElement.dataset.id || 'unknown',
            eventType: event.type,
            isMobile,
            isLongPressed: taskElement.classList.contains("long-pressed"),
            allowHide
        });

        if (allowHide) {
            // ✅ Use centralized controller (handles mode checking automatically)
            TaskOptionsVisibilityController.hide(taskElement, 'mouseleave');
        }
    }

    // ✅ Export for taskDOM module
    window.hideTaskOptions = hideTaskOptions;


// ✅ REMOVED: handleTaskCompletionChange - now in modules/task/taskCore.js

// ========================================
// Completed Tasks Management
// ========================================

/**
 * Initialize completed tasks section
 * Sets up event listeners and restores saved state
 */
function initCompletedTasksSection() {
    console.log('🎯 Initializing completed tasks section...');

    const header = document.getElementById('completed-tasks-header');
    const completedList = document.getElementById('completedTaskList');

    if (!header || !completedList) {
        console.warn('⚠️ Completed tasks elements not found');
        return;
    }

    // Add click handler for toggling
    safeAddEventListener(header, 'click', toggleCompletedTasksSection);

    // Restore saved collapsed state
    restoreCompletedTasksState();

    // Update count on page load
    updateCompletedTasksCount();

    console.log('✅ Completed tasks section initialized');
}

/**
 * Toggle the completed tasks section visibility
 */
function toggleCompletedTasksSection() {
    const completedList = document.getElementById('completedTaskList');
    const toggleIcon = document.querySelector('#completed-tasks-header .toggle-icon');

    if (!completedList || !toggleIcon) return;

    const isVisible = completedList.classList.toggle('visible');
    toggleIcon.textContent = isVisible ? '▲' : '▼';

    // Save preference to AppState
    if (window.AppState && window.AppState.isReady()) {
        window.AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.completedTasksExpanded = isVisible;
        }, true);
    }

    console.log(`✅ Completed tasks section ${isVisible ? 'expanded' : 'collapsed'}`);
}

/**
 * Restore completed tasks section state from AppState
 */
function restoreCompletedTasksState() {
    if (!window.AppState || !window.AppState.isReady()) return;

    const state = window.AppState.get();
    const isExpanded = state?.settings?.completedTasksExpanded || false;

    const completedList = document.getElementById('completedTaskList');
    const toggleIcon = document.querySelector('#completed-tasks-header .toggle-icon');

    if (completedList && toggleIcon) {
        if (isExpanded) {
            completedList.classList.add('visible');
            toggleIcon.textContent = '▲';
        } else {
            completedList.classList.remove('visible');
            toggleIcon.textContent = '▼';
        }
    }
}

/**
 * Move a task to the completed list
 * @param {HTMLElement} taskElement - The task element to move
 */
function moveTaskToCompleted(taskElement) {
    const completedList = document.getElementById('completedTaskList');
    const completedSection = document.getElementById('completed-tasks-section');

    if (!completedList || !completedSection || !taskElement) return;

    // Move the task element
    completedList.appendChild(taskElement);

    // Show the completed section if it has tasks
    completedSection.style.display = 'block';

    // Update count
    updateCompletedTasksCount();

    console.log('✅ Task moved to completed section');
}

/**
 * Move a task back to the active list
 * @param {HTMLElement} taskElement - The task element to move
 */
function moveTaskToActive(taskElement) {
    const taskList = document.getElementById('taskList');

    if (!taskList || !taskElement) return;

    // Move the task element back to the top of active list
    taskList.insertBefore(taskElement, taskList.firstChild);

    // Update count
    updateCompletedTasksCount();

    console.log('✅ Task moved back to active list');
}

/**
 * Update the completed tasks count display
 */
function updateCompletedTasksCount() {
    const completedList = document.getElementById('completedTaskList');
    const completedCount = document.getElementById('completed-count');
    const completedSection = document.getElementById('completed-tasks-section');

    if (!completedList || !completedCount || !completedSection) return;

    const count = completedList.children.length;
    completedCount.textContent = count;

    // Hide section if no completed tasks
    if (count === 0) {
        completedSection.style.display = 'none';
    } else {
        completedSection.style.display = 'block';
    }
}

/**
 * Handle task completion/un-completion to move between lists
 * This should be called after the checkbox state changes
 * @param {HTMLElement} taskElement - The task element
 * @param {boolean} isCompleted - Whether the task is completed
 */
function handleTaskListMovement(taskElement, isCompleted) {
    if (!taskElement) return;

    // Check if completed dropdown feature is enabled
    const isFeatureEnabled = isCompletedDropdownEnabled();
    if (!isFeatureEnabled) {
        return; // Feature disabled, keep tasks in main list
    }

    if (isCompleted) {
        moveTaskToCompleted(taskElement);
    } else {
        moveTaskToActive(taskElement);
    }
}

/**
 * Check if the completed dropdown feature is enabled
 * @returns {boolean} - True if enabled, false otherwise
 */
function isCompletedDropdownEnabled() {
    // Check AppState first
    if (window.AppState && window.AppState.isReady()) {
        const state = window.AppState.get();
        return state?.settings?.showCompletedDropdown || false;
    }

    // Fallback to checkbox state
    const toggle = document.getElementById('toggle-completed-dropdown');
    return toggle ? toggle.checked : false;
}

/**
 * Organize all completed tasks when loading a cycle
 * Scans the main task list and moves completed tasks to the completed section
 */
function organizeCompletedTasks() {
    // Check if feature is enabled first
    if (!isCompletedDropdownEnabled()) {
        console.log('⏭️ Completed dropdown disabled, skipping organization');
        return;
    }

    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    console.log('🔄 Organizing completed tasks on load...');

    // Get all tasks in the main list
    const tasks = Array.from(taskList.querySelectorAll('.task'));

    // Move each completed task to the completed section
    tasks.forEach(taskElement => {
        const checkbox = taskElement.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            moveTaskToCompleted(taskElement);
        }
    });

    console.log(`✅ Organized ${taskList.querySelectorAll('.task').length} active and completed tasks`);
}

// Export functions globally
window.initCompletedTasksSection = initCompletedTasksSection;
window.toggleCompletedTasksSection = toggleCompletedTasksSection;
window.moveTaskToCompleted = moveTaskToCompleted;
window.moveTaskToActive = moveTaskToActive;
window.updateCompletedTasksCount = updateCompletedTasksCount;
window.handleTaskListMovement = handleTaskListMovement;
window.organizeCompletedTasks = organizeCompletedTasks;
window.isCompletedDropdownEnabled = isCompletedDropdownEnabled;

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

        (window.miniCycle?.tasks?.refresh || refreshTaskListUI)();
        (window.miniCycle?.tasks?.recurring?.update || window.updateRecurringButtonVisibility || (() => {}))();

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
        (window.miniCycle?.tasks?.recurring?.update || window.updateRecurringButtonVisibility || (() => {}))();

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
    
    

// ✅ updateDueDateVisibility moved to modules/features/dueDates.js
    
    
    


 if (!deleteCheckedTasks.dataset.listenerAdded) {
    deleteCheckedTasks.addEventListener("change", async (event) => {
        // ✅ Schema 2.5 only
        console.log('🗑️ Delete checked tasks toggle changed (Schema 2.5 only)...');

        const schemaData = window.miniCycle?.state?.load() || loadMiniCycleData();
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

        const isToDoMode = event.target.checked;
        const currentMode = isToDoMode ? 'todo' : 'cycle';

        // ✅ Update via AppState instead of direct localStorage manipulation
        if (window.AppState?.isReady?.()) {
            // Store updated state to avoid race condition
            let updatedCycle = null;

            await window.AppState.update(state => {
                const cycle = state.data.cycles[activeCycle];

                // Update mode
                cycle.deleteCheckedTasks = isToDoMode;

                // ✅ Sync all tasks' deleteWhenComplete with mode-specific settings
                if (cycle.tasks) {
                    cycle.tasks.forEach(task => {
                        // Initialize settings if missing (for existing tasks)
                        if (!task.deleteWhenCompleteSettings) {
                            task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
                        }

                        // Sync active value from mode-specific setting
                        task.deleteWhenComplete = task.deleteWhenCompleteSettings[currentMode];
                    });
                    console.log(`✅ Synced deleteWhenComplete for all tasks to ${currentMode} mode settings`);
                }

                // ✅ Capture updated cycle to avoid race condition
                updatedCycle = cycle;
            }, true); // Immediate save

            // ✅ Update UI using centralized DOM sync with captured state
            if (updatedCycle?.tasks && window.syncAllTasksWithMode) {
                // Create task data map for batch sync
                const tasksDataMap = {};
                updatedCycle.tasks.forEach(task => {
                    tasksDataMap[task.id] = task;
                });

                console.log(`🔄 Mode switch: Syncing ${Object.keys(tasksDataMap).length} tasks to ${currentMode} mode`);

                // Sync immediately AND after a small delay to catch any late DOM updates
                window.syncAllTasksWithMode(currentMode, tasksDataMap, {
                    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
                });

                // Second sync after delay to catch any stragglers
                setTimeout(() => {
                    window.syncAllTasksWithMode(currentMode, tasksDataMap, {
                        DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
                    });
                }, 100);
            } else if (!window.syncAllTasksWithMode) {
                console.error('❌ syncAllTasksWithMode not available - GlobalUtils may not be loaded');
            } else if (!updatedCycle?.tasks) {
                console.warn('⚠️ No tasks to sync');
            }
        }

        // ✅ Update recurring button visibility in real-time
        (window.miniCycle?.tasks?.recurring?.update || window.updateRecurringButtonVisibility || (() => {}))();

        console.log('✅ Delete checked tasks setting saved (Schema 2.5)');
    });

    deleteCheckedTasks.dataset.listenerAdded = true;
}



// ✅ Function to complete all tasks and handle reset
// ✅ REMOVED: handleCompleteAllTasks - now in modules/task/taskCore.js
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

    // ✅ Use window.addTask directly (modules.addTask may not be set)
    (window.addTask || addTask)(taskText);
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

        // ✅ Use window.addTask directly (modules.addTask may not be set)
        (window.addTask || addTask)(taskText);
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



safeAddEventListenerById("reset-notification-position", "click", async () => {
    console.log('🔄 Resetting notification position (Schema 2.5 only)...');

    // ✅ Use AppState only (no direct localStorage writes)
    if (!window.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for reset notification position');
        showNotification("❌ Unable to reset position.", "error", 2000);
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
        resetNotificationPosition();

        showNotification("🔄 Notification position reset.", "success", 2000);
    } catch (error) {
        console.error('❌ Failed to reset notification position:', error);
        showNotification("❌ Failed to reset position.", "error", 2000);
    }
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
    const schemaData = window.miniCycle?.state?.load() || loadMiniCycleData();
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

  // Hide initial app loader when app is ready
  setTimeout(() => {
    const appLoader = document.getElementById('app-loader');
    if (appLoader) {
      appLoader.classList.add('fade-out');
      setTimeout(() => {
        appLoader.style.display = 'none';
        // Cancel the load timeout failsafe since we loaded successfully
        if (typeof window.__cancelLoadTimeout === 'function') {
          window.__cancelLoadTimeout();
        }
      }, 500);
    }
  }, 500);

});

  function supportsModern() {
    try { new Function('()=>{}'); } catch(_) { return false; }
    return !!(window.Promise && window.fetch);
  }

// ============================================
// LOADING SPINNER GLOBAL FUNCTIONS
// ============================================

/**
 * Shows the loading overlay with optional custom message
 * @param {string} message - Custom loading message (optional)
 */
window.showLoader = function(message = 'Processing...') {
  const overlay = document.getElementById('loading-overlay');
  const textElement = overlay?.querySelector('.loading-spinner-text');

  if (overlay) {
    if (textElement && message) {
      textElement.textContent = message;
    }
    overlay.classList.add('active');
  }
};

/**
 * Hides the loading overlay
 */
window.hideLoader = function() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
};

/**
 * Wraps an async operation with loading indicator
 * @param {Function} asyncFunction - Async function to execute
 * @param {string} message - Loading message to display
 * @returns {Promise} - Result of the async function
 */
window.withLoader = async function(asyncFunction, message = 'Processing...') {
  try {
    showLoader(message);
    const result = await asyncFunction();
    return result;
  } finally {
    hideLoader();
  }
};
