/**
 * ============================================================================
 * MINI-CYCLE ORCHESTRATOR - FUTURE MIGRATION TARGET
 * ============================================================================
 *
 * STATUS: SCAFFOLD / REFERENCE FILE
 * ---------------------------------
 * This file documents the target architecture for when the main script
 * (miniCycle-scripts.js) is eventually modularized. It is NOT currently
 * used by the application.
 *
 * CURRENT STATE:
 * --------------
 * The orchestration logic currently lives in miniCycle-scripts.js which has:
 * - Section 1: Global State Setup (Lines ~60-262)
 * - Section 2: DI Wiring Hub (Lines ~263-1850)
 * - Section 3: Runtime Functions (Lines ~1885-4692)
 *
 * WHY NOT EXTRACT NOW:
 * --------------------
 * The DOMContentLoaded handler in miniCycle-scripts.js contains:
 * - 4,400+ lines of initialization and runtime code
 * - Many functions that share closure-scoped variables (deps, uiRefs)
 * - Complex dependencies between module loading and function definitions
 *
 * Extracting this safely requires:
 * 1. First extracting the runtime functions (Section 3) to their own modules
 * 2. Then extracting the DI wiring (Section 2) to this orchestrator
 * 3. Leaving only global state (Section 1) in the main script
 *
 * EXTRACTION ORDER (from REMAINING_EXTRACTIONS_ANALYSIS.md):
 * ----------------------------------------------------------
 * P0: saveToggleAutoReset (758 lines) → settingsManager.js
 * P1: createTaskLabel (350 lines) → taskLabelManager.js
 * P2: Completed Tasks (214 lines) → completedTasksManager.js
 * P3: Initial Setup (190 lines) → appInit.js
 * P4: Notification Wrappers (80 lines) → DELETE (modules exist)
 * P5: Progress System (270 lines) → progressManager.js
 * P6: remindOverdueTasks (102 lines) → taskReminders.js
 *
 * After these extractions, the DI wiring can be moved here.
 *
 * See: docs/future-work/REMAINING_EXTRACTIONS_ANALYSIS.md
 * See: docs/developer-guides/MODULE_SYSTEM_GUIDE.md
 *
 * @module orchestrator
 * ============================================================================
 */

// Module-level dependency container (populated during initialization)
let moduleDeps = null;

/**
 * Main application initialization function.
 * Called by miniCycle-scripts.js on DOMContentLoaded.
 *
 * @param {Object} config - Configuration from main script
 * @param {Object} config.AppGlobalState - Global state reference
 * @param {Object} config.FeatureFlags - Feature flag reference
 * @param {string} config.APP_VERSION - App version for cache-busting
 * @returns {Promise<void>}
 */
export async function initializeApp(config) {
    const { AppGlobalState, FeatureFlags, APP_VERSION } = config;

    console.log('🚀 Starting miniCycle initialization (Schema 2.5 only)...');

    window.AppBootStarted = true;
    window.AppBootStartTime = Date.now();

    // ============================================
    // 🎯 SECTION 1: DEPENDENCY CONTAINER
    // ============================================
    // This object collects all module references for true dependency injection.
    // Modules receive deps instead of reaching for window.*
    // See: docs/future-work/MODULAR_OVERHAUL_PLAN.md
    const deps = {
        utils: {},
        features: {},
        ui: {},
        core: {}
    };
    moduleDeps = deps;

    // ============================================
    // 🎯 SECTION 2: VERSION HELPER & CORE IMPORTS
    // ============================================

    // Load appInit FIRST without version (singleton pattern)
    const { appInit } = await import('./appInit.js');
    deps.core.appInit = appInit;

    // Load core constants
    const {
        DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
        DEFAULT_RECURRING_DELETE_SETTINGS
    } = await import('./constants.js');

    // Version helper for cache-busting dynamic imports
    const withV = (path) => `${path}?v=${APP_VERSION}`;

    // Create AppMeta for DI-friendly version access
    window.AppMeta = { version: APP_VERSION };

    // Backward compatibility alias
    window.AppInit = appInit;

    console.log('🚀 appInit and constants loaded (2-phase initialization system)');

    // ============================================
    // 🎯 SECTION 3: PHASE 1 - CORE SYSTEMS
    // ============================================
    console.log('🔧 Phase 1: Initializing core systems...');

    // --- 3.1: Load Utility Modules ---
    await loadUtilityModules(deps, withV);

    // --- 3.2: Load Migration Manager ---
    await loadMigrationManager(deps, withV);

    // --- 3.3: Initialize UI References ---
    const uiRefs = initializeUIReferences();

    // --- 3.4: Apply Initial Theme ---
    applyInitialTheme();

    // --- 3.5: Feature Setup ---
    setupMiniCycleTitleListener();
    initializeThemesPanel();
    setupThemesPanel();
    setupUserManual();

    // Expose completeInitialSetup for cycleLoader
    window.completeInitialSetup = completeInitialSetup;

    // ============================================
    // 🎯 SECTION 4: PHASE 1 CONTINUED - STATE INIT
    // ============================================
    await initializeStateAndPhase2(deps, withV, appInit, uiRefs);
}

// ============================================================================
// SECTION 5: MODULE LOADING FUNCTIONS
// ============================================================================

/**
 * Loads all utility modules and wires their dependencies.
 */
async function loadUtilityModules(deps, withV) {
    // --- GlobalUtils ---
    const globalUtilsModule = await import(withV('../utils/globalUtils.js'));
    const GlobalUtils = globalUtilsModule.default;

    deps.utils.GlobalUtils = GlobalUtils;
    deps.utils.sanitizeInput = GlobalUtils.sanitizeInput;
    deps.utils.escapeHtml = GlobalUtils.escapeHtml;
    deps.utils.generateId = GlobalUtils.generateId;
    deps.utils.debounce = GlobalUtils.debounce;
    deps.utils.throttle = GlobalUtils.throttle;
    deps.utils.safeAddEventListener = GlobalUtils.safeAddEventListener;
    deps.utils.syncAllTasksWithMode = GlobalUtils.syncAllTasksWithMode;
    deps.utils.DEFAULT_TASK_OPTION_BUTTONS = globalUtilsModule.DEFAULT_TASK_OPTION_BUTTONS;

    // Window exposure for backward compat
    exposeGlobalUtils(GlobalUtils, globalUtilsModule);
    console.log('🛠️ Global utilities loaded');

    // --- Error Handler ---
    await import(withV('../utils/errorHandler.js'));
    console.log('🛡️ Global error handlers initialized');

    // --- Data Validator ---
    const dataValidatorMod = await import(withV('../utils/dataValidator.js'));
    dataValidatorMod.setDataValidatorDependencies({
        sanitizeInput: deps.utils.sanitizeInput
    });
    deps.utils.DataValidator = dataValidatorMod.DataValidator;
    window.DataValidator = dataValidatorMod.DataValidator;
    console.log('🛡️ Data Validator loaded');

    // --- Console Capture ---
    const consoleCaptureMod = await import(withV('../utils/consoleCapture.js'));
    window.consoleCapture = consoleCaptureMod.default;

    // --- Notifications ---
    const notificationsMod = await import(withV('../utils/notifications.js'));
    const notifications = new notificationsMod.MiniCycleNotifications();
    deps.utils.notifications = notifications;
    deps.utils.showNotification = (message, type, duration) => notifications.show(message, type, duration);
    window.notifications = notifications;
    window.showNotification = function(message, type, duration) {
        return notifications.show(message, type, duration);
    };
    console.log('✅ Notifications loaded');

    // --- Theme Manager ---
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
    if (themeManagerMod.setThemeManagerDependencies) {
        themeManagerMod.setThemeManagerDependencies({
            showNotification: deps.utils.showNotification
        });
    }
    console.log('✅ Theme Manager loaded');

    // --- Games Manager ---
    const gamesManagerMod = await import(withV('../ui/gamesManager.js'));
    if (gamesManagerMod.setGamesManagerDependencies) {
        gamesManagerMod.setGamesManagerDependencies({
            AppMeta: window.AppMeta
        });
    }
    window.GamesManager = gamesManagerMod.default;
    window.gamesManager = gamesManagerMod.gamesManager;
    window.unlockMiniGame = (...args) => gamesManagerMod.gamesManager?.unlockMiniGame?.(...args);
    window.checkGamesUnlock = (...args) => gamesManagerMod.gamesManager?.checkGamesUnlock?.(...args);
    console.log('✅ Games Manager loaded');

    // --- Onboarding Manager ---
    const onboardingManagerMod = await import(withV('../ui/onboardingManager.js'));
    if (onboardingManagerMod.setOnboardingManagerDependencies) {
        onboardingManagerMod.setOnboardingManagerDependencies({
            AppMeta: window.AppMeta
        });
    }
    window.onboardingManager = onboardingManagerMod.onboardingManager;
    console.log('✅ Onboarding Manager loaded');

    // --- Modal Manager (loaded, initialized later) ---
    await import(withV('../ui/modalManager.js'));
    console.log('✅ Modal Manager module loaded (awaiting initialization)');
}

/**
 * Exposes GlobalUtils functions to window for backward compatibility.
 */
function exposeGlobalUtils(GlobalUtils, globalUtilsModule) {
    window.GlobalUtils = GlobalUtils;
    window.DEFAULT_TASK_OPTION_BUTTONS = globalUtilsModule.DEFAULT_TASK_OPTION_BUTTONS;
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
}

/**
 * Loads migration manager and exposes its functions.
 */
async function loadMigrationManager(deps, withV) {
    console.log('🔄 Loading migration manager (core system)...');
    const migrationMod = await import(withV('../cycle/migrationManager.js'));

    migrationMod.setMigrationManagerDependencies({
        storage: localStorage,
        sessionStorage: sessionStorage,
        showNotification: (msg, type, duration) => window.showNotification?.(msg, type, duration),
        initialSetup: () => initialSetup?.(),
        now: () => Date.now(),
        document: document
    });

    window.createInitialSchema25Data = migrationMod.createInitialSchema25Data;
    window.checkMigrationNeeded = migrationMod.checkMigrationNeeded;
    window.simulateMigrationToSchema25 = migrationMod.simulateMigrationToSchema25;
    window.performSchema25Migration = migrationMod.performSchema25Migration;
    window.validateAllMiniCycleTasksLenient = migrationMod.validateAllMiniCycleTasksLenient;
    window.fixTaskValidationIssues = migrationMod.fixTaskValidationIssues;
    window.initializeAppWithAutoMigration = migrationMod.initializeAppWithAutoMigration;
    window.forceAppMigration = migrationMod.forceAppMigration;

    console.log('✅ Migration Manager loaded (Phase 1)');
}

// ============================================================================
// SECTION 6: UI INITIALIZATION
// ============================================================================

/**
 * Initializes UI element references.
 */
function initializeUIReferences() {
    // Centralized overlay detection
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

    // Navigation dots
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
    updateNavDots();

    // Return DOM references for use elsewhere
    return {
        taskInput: document.getElementById("taskInput"),
        addTaskButton: document.getElementById("addTaskBtn"),
        taskList: document.getElementById("taskList"),
        progressBar: document.getElementById("progressBar"),
        completeAllButton: document.getElementById("completeAll"),
        toggleAutoReset: document.getElementById("toggleAutoReset"),
        menuButton: document.querySelector(".menu-button"),
        menu: document.querySelector(".menu-container"),
        quickToggle: document.getElementById("quick-dark-toggle")
    };
}

/**
 * Applies initial theme from saved data.
 */
function applyInitialTheme() {
    console.log('🎨 Loading theme settings...');
    try {
        const schemaData = loadMiniCycleData();
        if (schemaData && schemaData.settings.theme) {
            console.log('🎨 Applying theme from Schema 2.5:', schemaData.settings.theme);
            applyTheme(schemaData.settings.theme, false);
        } else {
            console.log('🎨 Using default theme');
            applyTheme('default', false);
        }
    } catch (error) {
        console.warn('⚠️ Theme loading failed, using default:', error);
        applyTheme('default', false);
    }

    // Dark mode toggle setup
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
}

// ============================================================================
// SECTION 7: PHASE 2 INITIALIZATION
// ============================================================================

/**
 * Initializes AppState and Phase 2 modules.
 */
async function initializeStateAndPhase2(deps, withV, appInit, uiRefs) {
    console.log('🟢 Data-ready initializers running…');

    try {
        console.log('🗃️ Initializing state module...');

        const { createStateManager } = await import(withV('./appState.js'));
        window.AppState = createStateManager({
            showNotification: deps.utils.showNotification || console.log.bind(console),
            storage: localStorage,
            createInitialData: window.createInitialSchema25Data,
            AppMeta: window.AppMeta
        });

        deps.core.AppState = window.AppState;

        await window.AppState.init();
        console.log('✅ State module initialized successfully after data setup');

        // Mark core systems ready
        await appInit.markCoreSystemsReady();

        // ============================================
        // 🎯 PHASE 2: MODULES
        // ============================================
        console.log('🔌 Phase 2: Loading modules (appInit-compliant)...');

        await loadPhase2Modules(deps, withV);

        // ============================================
        // 🎯 PHASE 3: UI & DATA
        // ============================================
        await finalizeInitialization(deps, uiRefs);

    } catch (error) {
        console.error('❌ Initialization failed:', error);
        throw error;
    }
}

/**
 * Loads Phase 2 modules (DragDrop, DeviceDetection, Stats, etc.)
 */
async function loadPhase2Modules(deps, withV) {
    // NOTE: This function contains the Phase 2 module loading logic.
    // Due to the size of this initialization, the actual loading code
    // is kept in the main orchestration flow. This stub exists for
    // documentation and future refactoring purposes.

    // The actual Phase 2 loading happens in initializeStateAndPhase2
    // and includes:
    // - DragDropManager
    // - DeviceDetectionManager
    // - StatsPanelManager
    // - RecurringCore/RecurringPanel
    // - SettingsManager
    // - MenuManager
    // - UndoRedoManager
    // - TaskDOM/TaskCore
    // - CycleLoader/CycleManager
    // - And other feature modules

    console.log('📦 Phase 2 modules loading handled in main flow...');
}

/**
 * Finalizes initialization after all modules are loaded.
 */
async function finalizeInitialization(deps, uiRefs) {
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Device detection
    console.log('📱 Running device detection...');
    if (window.deviceDetectionManager && window.loadMiniCycleData) {
        await window.deviceDetectionManager.autoRedetectOnVersionChange();
    } else {
        console.log('⏭️ Skipping device detection (not fully initialized yet)');
    }

    // Focus task input on load
    window.onload = () => {
        if (uiRefs.taskInput) {
            uiRefs.taskInput.focus();
        }
    };
}

/**
 * Sets up global keyboard shortcuts.
 */
function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
            e.preventDefault();
            window.performStateBasedUndo?.();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
            e.preventDefault();
            window.performStateBasedRedo?.();
        }
    });
}

// ============================================================================
// SECTION 8: RUNTIME FUNCTIONS
// ============================================================================
// These functions are defined here because they need access to the deps
// container and are called during initialization and runtime.

/**
 * Device type detection fallback.
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

// Run device detection if manager not available
if (typeof window !== 'undefined' && !window.deviceDetectionManager) {
    detectDeviceType();
}

// ============================================================================
// SECTION 9: STUB FUNCTIONS (Defined in main script, referenced here)
// ============================================================================
// These functions are defined in miniCycle-scripts.js and exposed to window.
// They are documented here for reference.

// The following functions remain in miniCycle-scripts.js:
// - loadMiniCycleData()
// - autoSave()
// - initialSetup()
// - completeInitialSetup()
// - setupMiniCycleTitleListener()
// - setupUserManual()
// - applyTheme() (from themeManager)
// - initializeThemesPanel() (from themeManager)
// - setupThemesPanel() (from themeManager)

// ============================================================================
// END OF ORCHESTRATOR MODULE
// ============================================================================
