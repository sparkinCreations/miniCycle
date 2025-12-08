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

  // Clean up cache-clearing URL parameter if present (from stale cache recovery)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('_cc')) {
    urlParams.delete('_cc');
    const cleanUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }

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

    // ✅ Load appInit FIRST (now canonical at modules/core/appInit.js)
    // NO version param - must match static imports in other modules for singleton pattern
    // Service worker uses network-first for JS files, so fresh code is served automatically
    let appInitModule = await import('./modules/core/appInit.js');
    let { appInit, setAppInitDependencies, APPINIT_VERSION } = appInitModule;

    const staleForgiven = sessionStorage.getItem('_staleAppInitForgiven') === 'true';

    // ⚠️ Cache validation: ensure setAppInitDependencies was exported (added in v1.409)
    // If users have stale cached appInit.js, we attempt recovery a limited number of times.
    if (typeof setAppInitDependencies !== 'function' && !staleForgiven) {
        console.error('❌ Stale appInit.js cache detected - clearing caches and reloading...');

        // Check how many reload attempts we've made
        const reloadAttempts = parseInt(sessionStorage.getItem('_staleCacheReload') || '0', 10);

        if (reloadAttempts < 2) {
            sessionStorage.setItem('_staleCacheReload', (reloadAttempts + 1).toString());
            sessionStorage.setItem('_cacheRecoveryReload', 'true');

            // Clear all service worker caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('🗑️ Cleared', cacheNames.length, 'caches');
            }

            // Unregister service worker completely to clear module cache association
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.unregister();
                    console.log('🗑️ Unregistered service worker');
                }
            }

            // Navigate to cache-busted URL (more effective than reload for ES modules)
            const url = new URL(window.location.href);
            url.searchParams.set('_cc', Date.now().toString());
            window.location.href = url.toString();
            return;
        }

        // If we've tried twice and still stale, show user-friendly instructions
        sessionStorage.removeItem('_staleCacheReload');
        sessionStorage.setItem('_staleAppInitForgiven', 'true');
        console.error('⚠️ Cache clearing failed after 2 attempts. Showing manual refresh instructions.');

        // Show a persistent notification with refresh instructions
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);

        let refreshInstructions;
        if (isIOS) {
            refreshInstructions = 'Scroll down and release to refresh, or close and reopen the app.';
        } else if (isAndroid) {
            refreshInstructions = 'Pull down to refresh, or clear browser data in Settings.';
        } else if (isMac) {
            refreshInstructions = 'Press Cmd+Shift+R to hard refresh.';
        } else {
            refreshInstructions = 'Press Ctrl+Shift+R to hard refresh.';
        }

        // Create a dismissible banner at top of page
        const banner = document.createElement('div');
        banner.id = 'stale-cache-banner';
        banner.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
            background: linear-gradient(135deg, #ff6b6b, #ee5a5a); color: white;
            padding: 12px 16px; font-family: -apple-system, system-ui, sans-serif;
            font-size: 14px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        banner.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto;">
                <strong>Update Available!</strong> Your browser has an old cached version.
                <br>${refreshInstructions}
                <button onclick="this.parentElement.parentElement.remove()" style="
                    margin-left: 12px; padding: 4px 12px; border: none; border-radius: 4px;
                    background: rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 12px;
                ">Dismiss</button>
            </div>
        `;
        document.body.insertBefore(banner, document.body.firstChild);
        // Don't throw - let the app try to continue (may partially work)
    }

        // Clear reload flag on successful load (normal or forgiven path)
        sessionStorage.removeItem('_staleCacheReload');

        // Aggressively try to remove any cached copies of legacy appInit.js
        // This is best-effort and may not affect HTTP cache, but will
        // clean up any entries stored in Service Worker Cache Storage.
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                const appInitRequest = new Request('/modules/core/appInit.js');

                for (const name of cacheNames) {
                    const cache = await caches.open(name);
                    const match = await cache.match(appInitRequest);
                    if (match) {
                        await cache.delete(appInitRequest);
                        console.log(`🧹 Removed /modules/core/appInit.js from cache "${name}"`);
                    }
                }
            } catch (err) {
                console.warn('🧹 Failed to clean legacy appInit.js cache', err);
            }
        }

    // Check if we just recovered from a cache issue (for notification)
    const justReloaded = sessionStorage.getItem('_cacheRecoveryReload');
    if (justReloaded) {
        sessionStorage.removeItem('_cacheRecoveryReload');
        window._pendingCacheNotification = true;
    }

        deps.core.appInit = appInit;
        deps.core.setAppInitDependencies = setAppInitDependencies;
        deps.core.appInitVersion = APPINIT_VERSION || null;

  // ✅ Load core constants (with reload fallback for stale cache)
  const constantsModule = await import('./modules/core/constants.js');
  const { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, DEFAULT_RECURRING_DELETE_SETTINGS } = constantsModule;

  // Cache validation for constants - if stale, reload like appInit (same singleton issue)
  if (typeof DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS === 'undefined') {
    console.error('❌ Stale constants.js cache detected - clearing caches and reloading...');
    if (!sessionStorage.getItem('_staleCacheReload')) {
      sessionStorage.setItem('_staleCacheReload', Date.now().toString());
      sessionStorage.setItem('_cacheRecoveryReload', 'true');
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      window.location.reload(true);
      return;
    }
    sessionStorage.removeItem('_staleCacheReload');
    throw new Error('Stale cache persists. Please clear browser cache manually.');
  }

  // ✅ NOW create version helper for all OTHER dynamic imports (not appInit or constants)
  const withV = (path) => `${path}?v=${window.APP_VERSION}`;

    // ✅ Create AppMeta object for DI-friendly version access
    window.AppMeta = {
        version: window.APP_VERSION,
        appInitVersion: APPINIT_VERSION || null
    };

    // ✅ Set backward compatibility alias
    window.AppInit = appInit;

    // ==========================================================
    // appInit version/compat diagnostics + optional auto-refresh
    // ==========================================================
    if (APPINIT_VERSION) {
        console.info(`🚀 appInit loaded (version ${APPINIT_VERSION})`);
    } else {
        console.warn('⚠️ appInit loaded in compat mode (no APPINIT_VERSION export)');

        // One-time gentle self-heal: if this browser has never refreshed to
        // recover from a stale appInit, trigger a single soft reload.
        try {
            const refreshKey = 'minicycle.appinitCompatRefreshed';
            const alreadyRefreshed = window.localStorage.getItem(refreshKey) === '1';

            if (!alreadyRefreshed) {
                console.warn('♻️ Triggering one-time refresh to recover from stale appInit.js');
                window.localStorage.setItem(refreshKey, '1');

                // Use location.reload so SW/HTTP caching can serve the latest build.
                // This preserves state as much as possible while updating code.
                window.location.reload();
            }
        } catch (e) {
            console.warn('⚠️ Failed to record compat refresh flag:', e);
        }
    }

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

    // Still expose to window for backward compat (minimal set - others removed as unused)
    window.GlobalUtils = GlobalUtils;
    window.DEFAULT_TASK_OPTION_BUTTONS = globalUtilsModule.DEFAULT_TASK_OPTION_BUTTONS;
    // Essential utilities used in DI wiring or direct calls
    window.sanitizeInput = GlobalUtils.sanitizeInput;
    window.escapeHtml = GlobalUtils.escapeHtml;
    window.generateHashId = GlobalUtils.generateHashId;
    window.syncAllTasksWithMode = GlobalUtils.syncAllTasksWithMode;
    // Test-only utilities (kept for test compatibility)
    window.safeLocalStorageGet = GlobalUtils.safeLocalStorageGet;
    window.safeLocalStorageSet = GlobalUtils.safeLocalStorageSet;
    window.safeLocalStorageRemove = GlobalUtils.safeLocalStorageRemove;
    window.safeJSONParse = GlobalUtils.safeJSONParse;
    window.safeJSONStringify = GlobalUtils.safeJSONStringify;
    window.generateId = GlobalUtils.generateId;
    console.log('🛠️ Global utilities loaded');

    // ✅ Load Error Handler (DI-pure - wiring done after notifications load)
    const errorHandlerMod = await import(withV('./modules/utils/errorHandler.js'));
    deps.utils.setErrorHandlerDependencies = errorHandlerMod.setErrorHandlerDependencies;
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

    // ✅ Load Console Capture (DI-pure)
    const consoleCaptureMod = await import(withV('./modules/utils/consoleCapture.js'));

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
    const notificationsMod = await import(withV('./modules/utils/notifications.js'));

    // Set early dependencies (others set later when available)
    notificationsMod.setNotificationsDependencies({
        // These will be available later - use deferred getters
        AppState: null, // Set after AppState is created
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
    if (window._pendingCacheNotification) {
      notifications.show('App updated! Cache refreshed automatically.', 'info', 4000);
      delete window._pendingCacheNotification;
    }

    // ✅ Wire ErrorHandler now that showNotification is available
    deps.utils.setErrorHandlerDependencies({
        showNotification: deps.utils.showNotification
    });

    // ✅ Wire GlobalUtils now that showNotification is available (DI-pure)
    if (globalUtilsModule.setGlobalUtilsDependencies) {
        globalUtilsModule.setGlobalUtilsDependencies({
            showNotification: deps.utils.showNotification
        });
    }

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

    // ✅ Load Games Manager (DI-pure)
    const gamesManagerMod = await import(withV('./modules/ui/gamesManager.js'));
    // Inject dependencies (DI-pure)
    if (gamesManagerMod.setGamesManagerDependencies) {
        gamesManagerMod.setGamesManagerDependencies({
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
    console.log('✅ Games Manager loaded');

    // ✅ Load Onboarding Manager (DI-pure)
    const onboardingManagerMod = await import(withV('./modules/ui/onboardingManager.js'));
    // Inject dependencies (DI-pure, use lazy getters for late-available deps)
    if (onboardingManagerMod.setOnboardingManagerDependencies) {
        onboardingManagerMod.setOnboardingManagerDependencies({
            AppMeta: window.AppMeta,
            showNotification: deps.utils.showNotification,
            get AppState() { return window.AppState; },
            get showCycleCreationModal() { return window.showCycleCreationModal; },
            get completeInitialSetup() { return window.completeInitialSetup; },
            safeAddEventListenerById: deps.utils.GlobalUtils?.safeAddEventListenerById
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

    // ✅ Wire appInit setup dependencies (uses closures for late-binding)
    // Skip if setAppInitDependencies is not available (stale cache scenario)
    if (typeof setAppInitDependencies === 'function') {
      setAppInitDependencies({
        // For initialSetup
        loadMiniCycleData: () => loadMiniCycleData?.(),
        createInitialSchema25Data: () => migrationMod.createInitialSchema25Data?.(),
        showCycleCreationModal: () => window.showCycleCreationModal?.(),
        getOnboardingManager: () => window.onboardingManager,
        getMiniCycleState: () => null, // window.miniCycle namespace was never implemented

        // For completeInitialSetup
        loadMiniCycle: () => window.loadMiniCycle,
        updateReminderButtons: () => window.updateReminderButtons,
        updateDueDateVisibility: () => window.updateDueDateVisibility,
        checkOverdueTasks: () => window.checkOverdueTasks,
        organizeCompletedTasks: () => window.organizeCompletedTasks,
        startReminders: () => window.startReminders?.(),
        updateThemeColor: () => window.updateThemeColor?.(),
        getElementById: (id) => document.getElementById(id),
        addBodyClass: (cls) => document.body.classList.add(cls),
        removeBodyClass: (cls) => document.body.classList.remove(cls)
      });
      console.log('✅ AppInit setup dependencies configured');
    } else {
      console.warn('⚠️ setAppInitDependencies not available (stale cache) - skipping dependency injection');
    }

    migrationMod.setMigrationManagerDependencies({
      storage: localStorage,
      sessionStorage: sessionStorage,
      showNotification: (msg, type, duration) => showNotification?.(msg, type, duration),
      // Check if runInitialSetup exists (may not on stale cache)
      initialSetup: () => {
        if (typeof appInit.runInitialSetup === 'function') {
          return appInit.runInitialSetup();
        }
        console.warn('⚠️ appInit.runInitialSetup not available (stale cache) - skipping initial setup');
        return Promise.resolve(); // Return resolved promise for compatibility
      },
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
    // ✅ completeInitialSetup now delegates to appInit method (extracted from main script)
    window.completeInitialSetup = (activeCycle, fullSchemaData, schemaData) =>
        appInit.runCompleteInitialSetup(activeCycle, fullSchemaData, schemaData);



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

    // ✅ Update notifications with AppState now that it's available
    if (deps.utils.setNotificationsDependencies) {
        deps.utils.setNotificationsDependencies({
            AppState: window.AppState
        });
    }

        await window.AppState.init();
        console.log('✅ State module initialized successfully after data setup');

        // ✅ CRITICAL: Mark core systems as ready (unblocks all waiting modules)
        await appInit.markCoreSystemsReady();

        // ✅ Restore last session (Schema 2.5) using DI-pure startup manager
        try {
            const startupManagerMod = await import(withV('./modules/core/startupManager.js'));
            startupManagerMod.setStartupManagerDependencies({
                AppState: () => window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                loadMiniCycle: (name) => window.loadMiniCycle?.(name),
                refreshUIFromState: () => window.refreshUIFromState?.(),
                showNotification: deps.utils.showNotification,
                AppMeta: window.AppMeta
            });

            const startupManager = new startupManagerMod.StartupManager();
            await startupManager.restoreLastSession();
        } catch (err) {
            console.error('StartupManager: Failed to restore last session', err);
        }

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
          // Core state (DI-pure, no AppGlobalState - uses local instance state)
          AppState: window.AppState,
          AppMeta: window.AppMeta,
          // Task operations
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

        // Phase 3: Main script handles window.* exposure
        window.dragDropManager = dragDropManager;
        window.enableDragAndDropOnTask = enableDragAndDropOnTask;

        console.log('✅ DragDropManager initialized and ready (Phase 3)');

        // ✅ Initialize Device Detection (DI-pure module)
        console.log('📱 Initializing device detection module...');
        const { DeviceDetectionManager, setDeviceDetectionDependencies } = await import(withV('./modules/utils/deviceDetection.js'));

        // Wire dependencies before creating instance (DI-pure pattern)
        setDeviceDetectionDependencies({
            loadMiniCycleData: () => window.loadMiniCycleData ? window.loadMiniCycleData() : null,
            showNotification: deps.utils.showNotification,
            get AppState() { return window.AppState; },
            get appInit() { return window.appInit; },
            AppMeta: window.AppMeta
        });

        const deviceDetectionManager = new DeviceDetectionManager();

        window.deviceDetectionManager = deviceDetectionManager;

        console.log('✅ DeviceDetectionManager initialized (DI-pure)');

        // ✅ Initialize Stats Panel (DI-pure module)
        console.log('📊 Initializing stats panel module...');
        const { StatsPanelManager, setStatsPanelDependencies } = await import(withV('./modules/features/statsPanel.js'));

        // Wire dependencies before creating instance (DI-pure pattern)
        setStatsPanelDependencies({
            showNotification: deps.utils.showNotification,
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
            isDraggingNotification: () => window.isDraggingNotification?.() || false,
            updateThemeColor: () => window.updateThemeColor?.(),
            hideMainMenu: () => window.hideMainMenu?.(),
            setupDarkModeToggle: (id, syncIds) => window.setupDarkModeToggle?.(id, syncIds),
            get AppState() { return window.AppState; },
            get appInit() { return window.appInit; },
            AppMeta: window.AppMeta,
            safeAddEventListener: GlobalUtils.safeAddEventListener
        });

        const statsPanelManager = new StatsPanelManager();

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
            } = await import(withV('./modules/task/taskDOM.js'));
            console.log('✅ taskDOM.js imported successfully');

            // ✅ Set module-level deps for wrapper functions (DI-pure)
            // Note: TaskUtils deps flow through taskDOM instance deps (set in initTaskDOMManager below)
            setTaskDOMManagerDependencies({
                AppState: window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                generateId: deps.utils.generateId
            });

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

        // ✅ Initialize Task Options Customizer (DI-pure module)
        console.log('⚙️ Initializing task options customizer...');
        try {
            const { initTaskOptionsCustomizer, TaskOptionsCustomizer, setTaskOptionsCustomizerDependencies } = await import(withV('./modules/ui/taskOptionsCustomizer.js'));

            // Wire dependencies before creating instance (DI-pure pattern)
            setTaskOptionsCustomizerDependencies({
                get AppState() { return window.AppState; },
                showNotification: deps.utils.showNotification,
                renderTaskList: () => window.refreshTaskListUI?.(),
                updateMoveArrowsVisibility: () => window.updateMoveArrowsVisibility?.(),
                startReminders: () => window.startReminders?.(),
                stopReminders: () => window.stopReminders?.(),
                get modeManager() { return window.modeManager; },
                get appInit() { return window.appInit; },
                get DEFAULT_TASK_OPTION_BUTTONS() { return window.DEFAULT_TASK_OPTION_BUTTONS; }
            });

            const taskOptionsCustomizer = await initTaskOptionsCustomizer();

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

        // ✅ Initialize Reminders Module (DI-pure)
        // IMPORTANT: Load BEFORE recurring modules because recurring task rendering needs reminder button handlers
        console.log('🔔 Initializing reminders module...');
        try {
            const { initReminderManager, setRemindersDependencies } = await import(withV('./modules/features/reminders.js'));

            // Wire dependencies BEFORE creating instance (DI-pure pattern)
            setRemindersDependencies({
                showNotification: deps.utils.showNotification,
                loadMiniCycleData: () => window.loadMiniCycleData ? window.loadMiniCycleData() : null,
                updateUndoRedoButtons: () => window.updateUndoRedoButtons?.(),
                autoSave: () => window.autoSave?.(),
                // Use lazy getters for deps that don't exist at wiring time
                get AppState() { return window.AppState; },
                get appInit() { return window.appInit; },
                get refreshTaskListUI() { return window.refreshTaskListUI; },
                get AppGlobalState() { return window.AppGlobalState; },
                AppMeta: window.AppMeta
            });

            const reminderManager = await initReminderManager({
                // Browser API overrides (for testing) - these go via constructor
                getElementById: (id) => document.getElementById(id),
                querySelectorAll: (selector) => document.querySelectorAll(selector),
                safeAddEventListener: (element, event, handler) => window.safeAddEventListener?.(element, event, handler)
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

            console.log('✅ Reminders module initialized (DI-pure)');
        } catch (error) {
            console.error('❌ Failed to initialize reminders module:', error);
            if (typeof showNotification === 'function') {
                showNotification('Reminders feature unavailable', 'warning', 3000);
            }
            console.warn('⚠️ App will continue without reminders functionality');
        }

        // ✅ Initialize Recurring Modules (Phase 3 module - DI-pure)
        console.log('🔄 Initializing recurring task modules...');
        try {
            const { initializeRecurringModules, setRecurringIntegrationDependencies, testRecurringIntegration } = await import(withV('./modules/recurring/recurringIntegration.js'));

            // ✅ Set dependencies for DI-pure (before initialization)
            setRecurringIntegrationDependencies({
                AppState: window.AppState,
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                showNotification: (...args) => window.showNotification?.(...args),
                showNotificationWithTip: (...args) => window.showNotificationWithTip?.(...args),
                refreshUIFromState: () => window.refreshUIFromState?.(),
                updateProgressBar: () => window.updateProgressBar?.(),
                FeatureFlags: window.FeatureFlags,
                notifications: window.notifications,
                isOverlayActive: () => window.isOverlayActive?.(),
                getDeferredRecurringSetup: () => window._deferredRecurringSetup || [],
                clearDeferredRecurringSetup: () => { delete window._deferredRecurringSetup; },
                // Utilities for recurringCore and recurringPanel
                GlobalUtils: window.GlobalUtils,
                escapeHtml: (...args) => window.escapeHtml?.(...args),
                syncRecurringStateToDOM: (...args) => window.syncRecurringStateToDOM?.(...args),
                refreshTaskButtonsForModeChange: () => window.refreshTaskButtonsForModeChange?.()
            });

            const recurringModules = await initializeRecurringModules({ AppMeta: window.AppMeta });

            // Phase 3: Main script handles window.* exposure
            window._recurringModules = recurringModules;
            window.recurringCore = recurringModules.coreAPI;
            window.recurringPanel = recurringModules.panelAPI;
            // Direct function exposure for backward compatibility
            window.openRecurringSettingsPanelForTask = (taskId) => recurringModules.panelAPI.openForTask(taskId);
            window.updateRecurringPanelButtonVisibility = () => recurringModules.panelAPI.updateButtonVisibility();
            // ✅ Expose activation/deactivation handlers for taskDOM.js
            window.handleRecurringTaskActivation = (task, taskContext, button) => recurringModules.coreAPI.handleActivation(task, taskContext, button);
            window.handleRecurringTaskDeactivation = (task, taskContext, assignedTaskId) => recurringModules.coreAPI.handleDeactivation(task, taskContext, assignedTaskId);
            window.applyRecurringToTaskSchema25 = (...args) => recurringModules.coreAPI.applyRecurringSettings(...args);
            // ✅ Expose removeRecurringTasksFromCycle for taskCore.js reset logic
            window.removeRecurringTasksFromCycle = (taskElements, cycleData) => recurringModules.coreAPI.removeTasksFromCycle(taskElements, cycleData);

            // ✅ Store in deps for DI-pure injection into taskCore
            deps.core.recurringModules = recurringModules;
            deps.core.removeRecurringTasksFromCycle = recurringModules.coreAPI.removeTasksFromCycle;

            // ✅ Update notifications with recurring deps now that they're available
            if (deps.utils.setNotificationsDependencies) {
                deps.utils.setNotificationsDependencies({
                    applyRecurringToTaskSchema25: (...args) => recurringModules.coreAPI.applyRecurringSettings(...args),
                    updateRecurringPanel: () => recurringModules.panelAPI.updatePanel(),
                    openRecurringSettingsPanelForTask: (taskId) => recurringModules.panelAPI.openForTask(taskId)
                });
            }

            console.log('✅ Recurring modules initialized (Phase 3)');

            // Optional: Run integration test in development (DI-pure - pass modules)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🧪 Running recurring integration test...');
                setTimeout(() => {
                    const results = testRecurringIntegration(recurringModules);
                    if (Object.values(results).every(r => r === true)) {
                        console.log('✅ Recurring integration test PASSED:', results);
                    } else {
                        console.log('ℹ️ Recurring integration test results:', results);
                    }
                }, 2000);
            }
            // Expose test function with modules bound (for console testing)
            window.testRecurringIntegration = () => testRecurringIntegration(recurringModules);
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
            window.remindOverdueTasks = () => dueDatesManager.remindOverdueTasks();

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
                AppMeta: window.AppMeta,
                get recurringCore() { return window.recurringCore; },  // Lazy getter for late binding (DI-pure)
                // For setupToggleAutoReset
                checkMiniCycle: () => window.checkMiniCycle?.(),
                refreshTaskListUI: () => window.refreshTaskListUI?.(),
                updateRecurringButtonVisibility: () => window.updateRecurringButtonVisibility?.(),
                syncAllTasksWithMode: (mode, tasksDataMap, opts) => window.syncAllTasksWithMode?.(mode, tasksDataMap, opts),
                DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: { cycle: false, todo: true }
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
            window.saveToggleAutoReset = () => modeManager.setupToggleAutoReset();

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
                initialSetup: () => appInit.runInitialSetup(),  // ✅ Uses appInit method
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                querySelectorAll: (sel) => document.querySelectorAll(sel),
                AppMeta: window.AppMeta,
                // Undo system callbacks (DI-pure)
                onCycleRenamed: (...args) => window.onCycleRenamed?.(...args),
                onCycleDeleted: (...args) => window.onCycleDeleted?.(...args),
                onCycleSwitched: (...args) => window.onCycleSwitched?.(...args)
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
                safeAddEventListener: GlobalUtils.safeAddEventListener,
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
                AppMeta: window.AppMeta,
                get recurringPanel() { return window.recurringPanel; }  // Lazy getter for late binding
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

        // ✅ Initialize Settings Manager (DI-pure module)
        console.log('⚙️ Initializing settings manager module...');
        try {
            const { initSettingsManager, setSettingsManagerDependencies } = await import(withV('./modules/ui/settingsManager.js'));

            // Wire dependencies before creating instance (DI-pure pattern)
            setSettingsManagerDependencies({
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                AppState: () => window.AppState,
                showNotification: deps.utils.showNotification,
                showConfirmationModal: (opts) => window.showConfirmationModal?.(opts),
                hideMainMenu: () => window.hideMainMenu?.(),
                setupDarkModeToggle: (id, syncIds) => window.setupDarkModeToggle?.(id, syncIds),
                setupQuickDarkToggle: () => window.setupQuickDarkToggle?.(),
                updateMoveArrowsVisibility: () => window.updateMoveArrowsVisibility?.(),
                toggleHoverTaskOptions: (enabled) => window.toggleHoverTaskOptions?.(enabled),
                refreshTaskListUI: () => window.refreshTaskListUI?.(),
                performSchema25Migration: () => window.performSchema25Migration?.(),
                organizeCompletedTasks: () => window.organizeCompletedTasks?.(),
                get DataValidator() { return window.DataValidator; },
                get calculateNextOccurrence() { return window.recurringCore?.calculateNextOccurrence || window.calculateNextOccurrence; },
                sanitizeInput: (text, maxLen) => window.sanitizeInput?.(text, maxLen),
                AppMeta: window.AppMeta,
                safeAddEventListener: GlobalUtils.safeAddEventListener
            });

            const settingsManager = await initSettingsManager();

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

        // ✅ Initialize Completed Tasks Manager
        console.log('🎯 Initializing completed tasks manager module...');
        try {
            const { initCompletedTasksManager, setCompletedTasksManagerDependencies } = await import(withV('./modules/ui/completedTasksManager.js'));

            // Wire dependencies (DI-pure pattern)
            setCompletedTasksManagerDependencies({
                getAppState: () => window.AppState,
                getElementById: (id) => document.getElementById(id),
                querySelector: (sel) => document.querySelector(sel),
                safeAddEventListener: GlobalUtils.safeAddEventListener
            });

            const completedTasksManager = await initCompletedTasksManager();

            // Phase 3: Main script handles window.* exposure
            window.completedTasksManager = completedTasksManager;
            window.initCompletedTasksSection = () => completedTasksManager.init();
            window.toggleCompletedTasksSection = () => completedTasksManager.toggle();
            window.moveTaskToCompleted = (el) => completedTasksManager.moveToCompleted(el);
            window.moveTaskToActive = (el) => completedTasksManager.moveToActive(el);
            window.updateCompletedTasksCount = () => completedTasksManager.updateCount();
            window.handleTaskListMovement = (el, completed) => completedTasksManager.handleMovement(el, completed);
            window.organizeCompletedTasks = () => completedTasksManager.organize();
            window.isCompletedDropdownEnabled = () => completedTasksManager.isEnabled();

            console.log('✅ Completed tasks manager module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize completed tasks manager module:', error);
            console.warn('⚠️ App will continue without completed tasks manager functionality');
        }

        // ✅ Initialize Cycle Completion Module (needed by taskCore)
        console.log('🎯 Initializing cycle completion module...');
        const { setCycleCompletionDependencies, incrementCycleCount, showCompletionAnimation, updateProgressBar, checkMiniCycle } = await import(withV('./modules/progress/cycleCompletion.js'));

        // Wire cycle completion dependencies
        setCycleCompletionDependencies({
            AppState: window.AppState,
            showNotification: deps.utils.showNotification,
            updateStatsPanel: () => window.updateStatsPanel?.(),
            unlockDarkOceanTheme: () => window.unlockDarkOceanTheme?.(),
            unlockGoldenGlowTheme: () => window.unlockGoldenGlowTheme?.(),
            unlockMiniGame: () => window.unlockMiniGame?.(),
            // For updateProgressBar and checkMiniCycle
            getTaskList: () => document.getElementById('taskList'),
            getProgressBar: () => document.getElementById('progressBar'),
            assignCycleVariables: () => assignCycleVariables?.(),
            resetTasks: () => window.resetTasks?.()
        });

        // Expose to window for backward compatibility
        window.incrementCycleCount = incrementCycleCount;
        window.showCompletionAnimation = showCompletionAnimation;
        window.updateProgressBar = updateProgressBar;
        window.checkMiniCycle = checkMiniCycle;

        console.log('✅ Cycle completion module initialized (with progress functions)');

        // ✅ Initialize Task UI Module (DI-pure)
        console.log('🎯 Initializing task UI module...');
        try {
            const { setTaskUIDependencies, TaskOptionsVisibilityController, refreshTaskListUI, showTaskOptions, hideTaskOptions, hideTaskButtons, checkCompleteAllButton } = await import(withV('./modules/ui/taskUI.js'));

            // Wire dependencies (DI-pure pattern)
            setTaskUIDependencies({
                loadMiniCycleData: () => window.loadMiniCycleData?.(),
                addTask: (...args) => window.addTask?.(...args),
                updateRecurringButtonVisibility: () => window.updateRecurringButtonVisibility?.(),
                getElementById: (id) => document.getElementById(id),
                getTaskList: () => document.getElementById('taskList'),
                getCompleteAllButton: () => document.getElementById('completeAll'),
                isTouchDevice: () => window.isTouchDevice?.()
            });

            // Phase 3: Main script handles window.* exposure
            window.TaskOptionsVisibilityController = TaskOptionsVisibilityController;
            window.refreshTaskListUI = refreshTaskListUI;
            window.showTaskOptions = showTaskOptions;
            window.hideTaskOptions = hideTaskOptions;
            window.hideTaskButtons = hideTaskButtons;
            window.checkCompleteAllButton = checkCompleteAllButton;

            console.log('✅ Task UI module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize task UI module:', error);
            console.warn('⚠️ App will continue without task UI module functionality');
        }

        // ✅ Initialize Task Interactions Module (DI-pure)
        console.log('🎯 Initializing task interactions module...');
        try {
            const { setTaskInteractionsDependencies, attachKeyboardTaskOptionToggle } = await import(withV('./modules/ui/taskInteractions.js'));

            // Wire dependencies (DI-pure pattern)
            setTaskInteractionsDependencies({
                safeAddEventListener: GlobalUtils.safeAddEventListener
            });

            // Phase 3: Main script handles window.* exposure
            window.attachKeyboardTaskOptionToggle = attachKeyboardTaskOptionToggle;

            console.log('✅ Task interactions module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize task interactions module:', error);
            console.warn('⚠️ App will continue without task interactions module functionality');
        }

        // ✅ Initialize UI Effects Module (DI-pure)
        console.log('🎯 Initializing UI effects module...');
        try {
            const { setUIEffectsDependencies, triggerLogoBackground } = await import(withV('./modules/ui/uiEffects.js'));

            // Wire dependencies (DI-pure pattern)
            setUIEffectsDependencies({
                querySelector: (sel) => document.querySelector(sel),
                getLogoTimeoutId: () => window.AppGlobalState?.logoTimeoutId,
                setLogoTimeoutId: (val) => { if (window.AppGlobalState) window.AppGlobalState.logoTimeoutId = val; }
            });

            // Phase 3: Main script handles window.* exposure
            window.triggerLogoBackground = triggerLogoBackground;

            console.log('✅ UI effects module initialized (Phase 3)');
        } catch (error) {
            console.error('❌ Failed to initialize UI effects module:', error);
            console.warn('⚠️ App will continue without UI effects module functionality');
        }

        // ✅ Initialize Help Window Manager (needed by taskCore)
        console.log('🎯 Initializing help window manager...');
        const { initHelpWindowManager, setHelpWindowManagerDependencies } = await import(withV('./modules/ui/helpWindowManager.js'));

        // Wire help window dependencies (DI-pure)
        setHelpWindowManagerDependencies({
            AppState: window.AppState,
            loadMiniCycleData: () => window.loadMiniCycleData?.()
        });

        // Initialize after a delay (DOM needs to be ready)
        setTimeout(() => {
            const helpWindowManager = initHelpWindowManager();
            window.helpWindowManager = helpWindowManager;
            console.log('✅ Help window manager initialized');
        }, 500);

        console.log('✅ Help window manager module loaded');

        // ✅ Initialize Task Core (Phase 2 module)
        console.log('🎯 Initializing task core module...');
        try {
            const { initTaskCore, setTaskCoreDependencies, handleTaskCompletionChange, resetTasks, handleCompleteAllTasks, addTask, editTaskFromCore, deleteTaskFromCore, saveTaskToSchema25 } = await import(withV('./modules/task/taskCore.js'));

            // Expose setTaskCoreDependencies for late injection
            window.setTaskCoreDependencies = setTaskCoreDependencies;

            // ✅ Expose taskCore functions to window (needed by various modules)
            window.handleTaskCompletionChange = handleTaskCompletionChange;
            window.resetTasks = resetTasks;
            window.handleCompleteAllTasks = handleCompleteAllTasks;
            window.saveTaskToSchema25 = saveTaskToSchema25;

            const taskCore = await initTaskCore({
                // State management (no AppGlobalState - uses local instance state)
                AppState: window.AppState,
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
                isPerformingUndoRedo: () => window.AppGlobalState?.isPerformingUndoRedo || false,

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

                // Note: Cycle completion deps (incrementCycleCount, helpWindowManager,
                // showCompletionAnimation) are injected via setTaskCoreDependencies
                // immediately after init (see below) using deferred getters.
            });

            // Phase 3: Main script handles window.* exposure
            window.taskCore = taskCore;

            // ✅ Inject cycle completion deps directly (from modules, no window.* getters)
            setTaskCoreDependencies({
                incrementCycleCount: incrementCycleCount,
                showCompletionAnimation: showCompletionAnimation,
                // helpWindowManager initialized async, use getter for now
                helpWindowManager: {
                    get showCycleCompleteMessage() {
                        return window.helpWindowManager?.showCycleCompleteMessage?.bind(window.helpWindowManager);
                    },
                    get updateConstantMessage() {
                        return window.helpWindowManager?.updateConstantMessage?.bind(window.helpWindowManager);
                    }
                },
                // ✅ Recurring task removal (DI-pure from deps.core)
                removeRecurringTasksFromCycle: deps.core.removeRecurringTasksFromCycle,
                // ✅ Recurring core API for post-reset handling
                recurringCore: deps.core.recurringModules?.coreAPI,
                // ✅ Cycle check (for auto-reset) - still window.* as defined later in script
                checkMiniCycle: () => window.checkMiniCycle?.(),
                // ✅ Completed tasks dropdown - still window.* as defined later in script
                updateCompletedTasksCount: () => window.updateCompletedTasksCount?.()
            });

            // ✅ Inject taskCore into taskEvents immediately (can't wait for afterApp hook)
            // Using lazy getters so timing doesn't matter
            const { setTaskEventsDependencies } = await import(withV('./modules/task/taskEvents.js'));
            setTaskEventsDependencies({
                get taskCore() { return taskCore; },  // Direct reference, not window
                enableUndoSystemOnFirstInteraction: () => window.enableUndoSystemOnFirstInteraction?.(),
                checkMiniCycle: () => window.checkMiniCycle?.(),
                triggerLogoBackground: (type, dur) => window.triggerLogoBackground?.(type, dur),
                showTaskOptions: (e) => window.showTaskOptions?.(e),
                hideTaskOptions: (e) => window.hideTaskOptions?.(e),
                get TaskOptionsVisibilityController() { return window.TaskOptionsVisibilityController; },
                setupDueDateButtonInteraction: (btn, input) => window.setupDueDateButtonInteraction?.(btn, input),
                attachKeyboardTaskOptionToggle: (taskItem) => window.attachKeyboardTaskOptionToggle?.(taskItem)
            });

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
                updateStatsPanel: () => window.updateStatsPanel?.(),
                syncAllTasksWithMode: (...args) => window.syncAllTasksWithMode?.(...args)  // ✅ DI-pure
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

        // ✅ Initialize Pull-to-Refresh (DI-pure - mobile only)
        console.log('📱 Initializing pull-to-refresh module...');
        try {
            const { initPullToRefresh, setPullToRefreshDependencies } = await import(withV('./modules/ui/pullToRefresh.js'));

            // Wire dependencies BEFORE creating instance (DI-pure pattern)
            setPullToRefreshDependencies({
                showNotification: deps.utils.showNotification,
                // Use lazy getters for deps that don't exist at wiring time
                get refreshUIFromState() { return window.refreshUIFromState; },
                get checkRecurringTasksNow() { return window.checkRecurringTasksNow; },
                get watchRecurringTasks() { return window.watchRecurringTasks; },
                get promptServiceWorkerUpdate() { return window.promptServiceWorkerUpdate; }
            });

            const pullToRefresh = initPullToRefresh();

            // DI-pure: Main script handles window.* exposure
            window.pullToRefresh = pullToRefresh;

            console.log('✅ Pull-to-refresh module initialized (DI-pure)');
        } catch (error) {
            console.error('⚠️ Failed to initialize pull-to-refresh module:', error);
            console.warn('⚠️ App will continue without pull-to-refresh functionality');
        }

        // ✅ Mark Phase 2 complete - all modules are now loaded and ready
        console.log('✅ Phase 2 complete - all modules initialized');

        // ============================================
        // 🪝 AFTERAPP HOOKS (for future late DI wiring)
        // ============================================
        // Note: taskEvents deps are wired immediately after taskCore creation
        // (can't wait for afterApp - user may interact before then)
        // Add other late DI wiring hooks here if needed.

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
            GlobalUtils.safeAddEventListener(completeAllButton, "click", window.handleCompleteAllTasks);
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
        let testingModalMod = null;
        try {
            testingModalMod = await import(withV('./modules/testing/testing-modal.js'));
            console.log('✅ Testing modal loaded');

            // Expose testing modal functions to window (before setup, for compatibility)
            if (testingModalMod.openStorageViewer) window.openStorageViewer = testingModalMod.openStorageViewer;
            if (testingModalMod.closeStorageViewer) window.closeStorageViewer = testingModalMod.closeStorageViewer;
            if (testingModalMod.appendToTestResults) window.appendToTestResults = testingModalMod.appendToTestResults;
            if (testingModalMod.clearTestResults) window.clearTestResults = testingModalMod.clearTestResults;
            if (testingModalMod.exportTestResults) window.exportTestResults = testingModalMod.exportTestResults;
            if (testingModalMod.copyTestResults) window.copyTestResults = testingModalMod.copyTestResults;

            const testingIntegrationMod = await import(withV('./modules/testing/testing-modal-integration.js'));

            // Wire dependencies for testing-modal-integration (DI-pure)
            if (testingIntegrationMod.setTestingModalDependencies) {
                testingIntegrationMod.setTestingModalDependencies({
                    safeAddEventListenerById: deps.utils.safeAddEventListenerById,
                    showNotification: deps.utils.showNotification,
                    get ConsoleCapture() { return window.ConsoleCapture; }
                });
            }
            console.log('✅ Testing modal integration loaded (DI-pure)');
        } catch (error) {
            console.error('❌ Failed to load testing modal modules:', error);
            console.warn('⚠️ App will continue without testing modal functionality');
        }

        // ✅ Initialize Backup Manager (DI-pure)
        console.log('💾 Loading backup manager...');
        let backupManagerInstance = null;
        try {
            const backupManagerMod = await import(withV('./modules/storage/backupManager.js'));

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

        // ✅ Inject dependencies into Testing Modal (DI-pure)
        // Done after BackupManager is loaded since testing modal uses it
        if (testingModalMod?.setTestingModalDependencies) {
            testingModalMod.setTestingModalDependencies({
                // State management
                AppState: window.AppState,

                // Backup system
                BackupManager: window.BackupManager,

                // Notifications
                notifications: deps.utils.notifications,
                showNotification: deps.utils.showNotification,

                // Utility functions
                deleteStorageItem: (key, storageType) => {
                    const storage = storageType === 'local' ? localStorage : sessionStorage;
                    storage.removeItem(key);
                },
                safeAddEventListener: GlobalUtils.safeAddEventListener,
                safeAddEventListenerById: GlobalUtils.safeAddEventListenerById,

                // Testing utilities
                setupAutomatedTestingFunctions: () => window.setupAutomatedTestingFunctions?.(),

                // Console capture
                startAutoConsoleCapture: () => window.startAutoConsoleCapture?.(),
                isConsoleCapturing: () => window.consoleCapturing || false
            });

            // ✅ NOW setup testing modal (after deps are injected)
            if (typeof testingModalMod.setupTestingModal === 'function') {
                testingModalMod.setupTestingModal();
                window.setupTestingModal = testingModalMod.setupTestingModal;
                console.log('✅ Testing modal initialized');
            }

            // ✅ Initialize testing modal enhancements
            if (typeof testingModalMod.initializeTestingModalEnhancements === 'function') {
                testingModalMod.initializeTestingModalEnhancements();
                window.initializeTestingModalEnhancements = testingModalMod.initializeTestingModalEnhancements;
                console.log('✅ Testing modal enhancements initialized');
            }
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

        showNotification("Title cannot be empty. Reverting to previous title.");
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
            showNotification('Failed to save title change', 'error');
            titleElement.textContent = oldTitle; // Revert UI
            return;
        }

        // Refresh UI
        updateMainMenuHeader();
        updateUndoRedoButtons();
    }
}

function setupMiniCycleTitleListener() {
    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return;

    titleElement.contentEditable = true;

    // safeAddEventListener handles duplicate prevention - no dataset flag needed
    GlobalUtils.safeAddEventListener(titleElement, "blur", handleMiniCycleTitleBlur);
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
    hideMainMenu(); // Hide the menu when clicking

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


    
// ✅ Main addTask function - now acts as orchestrator
function addTask(taskText, completed = false, shouldSave = true, dueDate = null, highPriority = null, isLoading = false, remindersEnabled = false, recurring = false, taskId = null, recurringSettings = {}, deleteWhenComplete = undefined, deleteWhenCompleteSettings = undefined) {
    // ✅ Use NEW taskDOM module functions via window.* (not old inline functions)

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



// ✅ REMOVED: createTaskCheckbox - now in modules/task/taskDOM.js
// ✅ REMOVED: createTaskLabel - now in modules/task/taskDOM.js



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

function handleRecurringSettingsClick(e) {
  const target = e.target.closest(".open-recurring-settings");
  if (!target) return;

  const taskId = target.dataset.taskId;
  if (!taskId) return;

  // 🎯 Use your centralized panel-opening logic
  openRecurringSettingsPanelForTask(taskId);
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
 * Add Event Listeners
 * 
 * 
 ************************/
// 🟢 Add Task Button (Click)
GlobalUtils.safeAddEventListener(addTaskButton, "click", () => {
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
GlobalUtils.safeAddEventListener(taskInput, "keypress", function (event) {
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
GlobalUtils.safeAddEventListener(menuButton, "click", function(event) {
    event.stopPropagation();
    syncCurrentSettingsToStorage(); // ✅ Now supports both schemas
    saveToggleAutoReset(); // ✅ Already updated with Schema 2.5 support
    menu.classList.toggle("visible");

    if (menu.classList.contains("visible")) {
        GlobalUtils.safeAddEventListener(document, "click", closeMenuOnClickOutside);
    }
});



GlobalUtils.safeAddEventListenerById("reset-notification-position", "click", async () => {
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

// Named handler for safeAddEventListener duplicate prevention
function handleOpenRemindersModalClick() {
    console.log('🔔 Opening reminders modal (Schema 2.5 only)...');

    // Load current settings from Schema 2.5 before opening
    loadRemindersSettings(); // This function already has Schema 2.5 support
    document.getElementById("reminders-modal").style.display = "flex";
    hideMainMenu();

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

// ✅ REMOVED: dragover event listener - now handled by dragDropManager module via setupRearrange()
// Named handler for safeAddEventListener duplicate prevention
function handleFirstTouchInteraction() {
    hasInteracted = true;
}
GlobalUtils.safeAddEventListener(document, "touchstart", handleFirstTouchInteraction, { once: true, passive: true });

// Passive touchstart to prevent scroll jank
function handlePassiveTouchstart() {}
GlobalUtils.safeAddEventListener(document, "touchstart", handlePassiveTouchstart, { passive: true });

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
