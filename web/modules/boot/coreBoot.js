/**
 * miniCycle Core Boot Module
 *
 * Foundation boot file that initializes core systems in the correct order.
 * This is the FIRST phase of the 3-phase boot sequence (core → feature → ui).
 *
 * Responsibilities:
 * - Sets boot flag IMMEDIATELY (for HTML fallback detection)
 * - Loads AppGlobalState and FeatureFlags from appGlobalState.js
 * - Loads and configures appInit (2-phase initialization system)
 * - Creates AppState (central state manager)
 * - Loads core constants and migration manager
 * - Provides core data functions (loadMiniCycleData, autoSave, updateCycleData)
 *
 * IMPORT RULES:
 * - This file must NOT import from featureBoot.js or uiBoot.js
 * - This file CAN import from ../core/* and ../utils/globalUtils.js
 *
 * @module boot/coreBoot
 * @version 1.0.0
 * @see {@link module:boot/featureBoot} - Second phase (feature initialization)
 * @see {@link module:boot/uiBoot} - Third phase (UI initialization)
 */

/**
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {Object} CoreBootDeps
 * @property {Object} core - Core module references
 * @property {Object} core.AppGlobalState - Global application state
 * @property {Object} core.FeatureFlags - Feature flag settings
 * @property {Object} core.appInit - App initialization manager
 * @property {MiniCycleState} core.AppState - State manager instance
 * @property {Object} core.AppMeta - App metadata with version
 * @property {Function} core.loadMiniCycleData - Load data from state
 * @property {Function} core.autoSave - Auto-save function
 * @property {Object} utils - Utility functions
 * @property {Object} utils.GlobalUtils - Global utility methods
 */

// ============================================================================
// POLYFILLS: Must run before any other code
// ============================================================================

// structuredClone polyfill for Safari < 15.4 (March 2022)
// Falls back to JSON round-trip which handles most cases
if (typeof structuredClone === 'undefined') {
    globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
    console.log('🔧 structuredClone polyfill installed (Safari < 15.4)');
}

// ✅ Single source of truth: Read version from globalThis (set by version.js)
// Falls back to 'dev-local' for local development without version.js
const APP_VERSION = globalThis.APP_VERSION || 'dev-local';

// ============================================================================
// CRITICAL: Set boot flag IMMEDIATELY for HTML fallback detection
// Uses dataset attribute instead of window.* for zero-globals compliance
// ============================================================================
document.documentElement.dataset.appBooted = 'true';
document.documentElement.dataset.bootStartTime = Date.now().toString();

// ============================================================================
// INTERRUPTED TEST RECOVERY
// Must run BEFORE any modules load to restore user data if tests were interrupted
// This uses IndexedDB directly (not appState.js) because recovery must happen first
// ============================================================================

const TEST_MODE_DB = 'miniCycleTestResultsDB';
const TEST_MODE_STORE = 'results';

/**
 * Check if test mode is active in IndexedDB
 * @returns {Promise<boolean>}
 */
async function checkTestModeActive() {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(TEST_MODE_DB, 1);
            request.onerror = () => resolve(false);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(TEST_MODE_STORE)) {
                    db.createObjectStore(TEST_MODE_STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                try {
                    const tx = db.transaction(TEST_MODE_STORE, 'readonly');
                    const store = tx.objectStore(TEST_MODE_STORE);
                    const getRequest = store.get('testModeActive');
                    getRequest.onsuccess = () => {
                        const isActive = getRequest.result?.active === true;
                        db.close();
                        resolve(isActive);
                    };
                    getRequest.onerror = () => { db.close(); resolve(false); };
                } catch (e) {
                    db.close();
                    resolve(false);
                }
            };
        } catch (e) {
            resolve(false);
        }
    });
}

/**
 * Get pre-test backup from IndexedDB
 * @returns {Promise<Object|null>}
 */
async function getPreTestBackup() {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(TEST_MODE_DB, 1);
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const db = request.result;
                try {
                    const tx = db.transaction(TEST_MODE_STORE, 'readonly');
                    const store = tx.objectStore(TEST_MODE_STORE);
                    const getRequest = store.get('preTestBackup');
                    getRequest.onsuccess = () => {
                        const data = getRequest.result;
                        db.close();
                        if (data?.localStorageBackup) {
                            resolve(data.localStorageBackup);
                        } else {
                            resolve(null);
                        }
                    };
                    getRequest.onerror = () => { db.close(); resolve(null); };
                } catch (e) {
                    db.close();
                    resolve(null);
                }
            };
        } catch (e) {
            resolve(null);
        }
    });
}

/**
 * Clear test mode flags and backup from IndexedDB
 * @returns {Promise<void>}
 */
async function clearTestModeFlags() {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(TEST_MODE_DB, 1);
            request.onerror = () => resolve();
            request.onsuccess = () => {
                const db = request.result;
                try {
                    const tx = db.transaction(TEST_MODE_STORE, 'readwrite');
                    const store = tx.objectStore(TEST_MODE_STORE);
                    store.delete('testModeActive');
                    store.delete('appInitiatedTests');
                    store.delete('preTestBackup');
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onerror = () => { db.close(); resolve(); };
                } catch (e) {
                    db.close();
                    resolve();
                }
            };
        } catch (e) {
            resolve();
        }
    });
}

/**
 * Recover from interrupted tests by restoring localStorage from IndexedDB backup
 * Called at the very start of boot, BEFORE any modules load
 * @returns {Promise<boolean>} True if recovery was performed
 */
async function recoverFromInterruptedTests() {
    try {
        const testModeActive = await checkTestModeActive();
        if (!testModeActive) {
            return false;
        }

        console.warn('⚠️ Test mode flag detected - tests may have been interrupted');

        const backup = await getPreTestBackup();
        if (backup) {
            console.log('🔄 Restoring pre-test localStorage backup...');
            // Clear current localStorage and restore backup
            localStorage.clear();
            Object.entries(backup).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });
            console.log('✅ Pre-test data restored from IndexedDB backup');
            // Clear the test mode flag and backup
            await clearTestModeFlags();
            console.log('🧹 Cleared test mode flags');
            return true;
        } else {
            console.warn('⚠️ No backup found - clearing potentially corrupted test data');
            localStorage.removeItem('miniCycleData');
            await clearTestModeFlags();
            return true;
        }
    } catch (e) {
        console.error('❌ Failed to recover from interrupted tests:', e);
        return false;
    }
}

// ============================================================================
// MODULE STATE
// ============================================================================

// Core module references (populated by initCoreBoot)
let AppGlobalState = null;
let FeatureFlags = null;
let UNDO_LIMIT = 20;
let UNDO_MIN_INTERVAL_MS = 100;
let GlobalUtils = null;
let appInit = null;
let AppState = null;
let DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = null;
let DEFAULT_RECURRING_DELETE_SETTINGS = null;
let TASK_LIMIT = 500;

// Version helper for cache-busted imports
let withV = (path) => `${path}?v=${APP_VERSION}`;

// ============================================================================
// SECTION 1: Core Initialization
// ============================================================================

/**
 * Initialize core boot systems. This is the first phase of app initialization.
 *
 * Loads and configures:
 * - AppGlobalState and FeatureFlags
 * - appInit (2-phase initialization system)
 * - Core constants (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, etc.)
 * - GlobalUtils
 * - Migration manager
 * - appContext (early initialization)
 *
 * @param {CoreBootDeps} deps - Dependency container to populate
 * @returns {Promise<Object|null>} Core module references, or null if cache recovery triggered
 * @throws {Error} If critical module loading fails
 * @example
 * const deps = { core: {}, utils: {} };
 * const coreRefs = await initCoreBoot(deps);
 * if (coreRefs) {
 *     // Core boot succeeded
 *     const { AppGlobalState, appInit } = coreRefs;
 * }
 */
export async function initCoreBoot(deps) {
  console.log('🚀 coreBoot: Starting core initialization...');

  // ========== FIRST: Check for interrupted tests and restore data ==========
  // This MUST happen before any modules load to ensure localStorage has correct data
  const recovered = await recoverFromInterruptedTests();
  if (recovered) {
    console.log('🔄 Recovered from interrupted tests - localStorage restored');
  }

  // ========== Load AppGlobalState ==========
  const appGlobalStateMod = await import(
    `../core/appGlobalState.js?v=${APP_VERSION}`
  );
  AppGlobalState = appGlobalStateMod.AppGlobalState;
  FeatureFlags = appGlobalStateMod.FeatureFlags;
  UNDO_LIMIT = appGlobalStateMod.UNDO_LIMIT || 20;
  UNDO_MIN_INTERVAL_MS = appGlobalStateMod.UNDO_MIN_INTERVAL_MS || 100;

  // Store in deps container
  deps.core = deps.core || {};
  deps.core.AppGlobalState = AppGlobalState;
  deps.core.FeatureFlags = FeatureFlags;
  deps.core.UNDO_LIMIT = UNDO_LIMIT;
  deps.core.UNDO_MIN_INTERVAL_MS = UNDO_MIN_INTERVAL_MS;

  console.log('✅ AppGlobalState loaded');

  // ========== Clean up cache-clearing URL parameters ==========
  const urlParams = new URLSearchParams(window.location.search);
  let paramsModified = false;
  if (urlParams.has('_cc')) {
    urlParams.delete('_cc');
    paramsModified = true;
  }
  if (urlParams.has('_vg')) {
    urlParams.delete('_vg');
    paramsModified = true;
  }
  if (paramsModified) {
    const cleanUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }

  // ========== Update boot timestamp from dataset (set at module load time) ==========
  AppGlobalState.bootStartTime = parseInt(document.documentElement.dataset.bootStartTime, 10) || Date.now();

  // ========== Load appInit ==========
  const appInitModule = await import(`../core/appInit.js?v=${APP_VERSION}`);
  const { appInit: appInitInstance, setAppInitDependencies, APPINIT_VERSION } = appInitModule;
  appInit = appInitInstance;

  // Check for stale cache
  const staleForgiven = sessionStorage.getItem('_staleAppInitForgiven') === 'true';
  if (typeof setAppInitDependencies !== 'function' && !staleForgiven) {
    console.error('❌ Stale appInit.js cache detected - attempting recovery...');
    const shouldReload = await handleStaleCacheRecovery();
    if (shouldReload) return null; // Reload happening, bail out
  }

  // Clear reload flag on successful load
  sessionStorage.removeItem('_staleCacheReload');

  // Clean up any cached copies of legacy appInit.js
  await cleanLegacyAppInitCache();

  // Check for cache recovery reload
  const justReloaded = sessionStorage.getItem('_cacheRecoveryReload');
  if (justReloaded) {
    sessionStorage.removeItem('_cacheRecoveryReload');
    AppGlobalState.pendingCacheNotification = true;
  }

  // Store in deps container
  deps.core.appInit = appInit;
  deps.core.setAppInitDependencies = setAppInitDependencies;
  deps.core.appInitVersion = APPINIT_VERSION || null;

  // appInit is available via appContext.getAppInit()

  // Log version info
  if (APPINIT_VERSION) {
    console.info(`🚀 appInit loaded (version ${APPINIT_VERSION})`);
  } else {
    console.warn('⚠️ appInit loaded in compat mode (no APPINIT_VERSION export)');
    handleCompatModeRefresh();
  }

  // ========== Load Constants ==========
  const constantsModule = await import('../core/constants.js');
  DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = constantsModule.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS;
  DEFAULT_RECURRING_DELETE_SETTINGS = constantsModule.DEFAULT_RECURRING_DELETE_SETTINGS;
  TASK_LIMIT = constantsModule.TASK_LIMIT || 500;

  // Validate constants loaded
  if (typeof DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS === 'undefined') {
    console.error('❌ Stale constants.js cache detected');
    await handleStaleCacheRecovery();
    return null;
  }

  deps.core.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS;
  deps.core.DEFAULT_RECURRING_DELETE_SETTINGS = DEFAULT_RECURRING_DELETE_SETTINGS;
  deps.core.TASK_LIMIT = TASK_LIMIT;

  console.log('✅ Constants loaded');

  // ========== Update withV helper ==========
  withV = (path) => `${path}?v=${APP_VERSION}`;
  deps.core.withV = withV;

  // ========== Create AppMeta ==========
  // Create locally first, then expose to window for backward compatibility
  const AppMeta = {
    version: APP_VERSION,
    appInitVersion: APPINIT_VERSION || null
  };
  deps.core.AppMeta = AppMeta;
  // ✅ AppMeta accessible via deps.core.AppMeta and appContext - no window.* exposure

  console.log('🚀 appInit and constants loaded (2-phase initialization system)');

  // ========== Load GlobalUtils ==========
  const globalUtilsModule = await import(withV('../utils/globalUtils.js'));
  GlobalUtils = globalUtilsModule.GlobalUtils;

  // Store in deps container
  deps.utils = deps.utils || {};
  deps.utils.GlobalUtils = GlobalUtils;
  deps.utils.sanitizeInput = GlobalUtils.sanitizeInput;
  deps.utils.escapeHtml = GlobalUtils.escapeHtml;
  deps.utils.generateId = GlobalUtils.generateId;
  deps.utils.debounce = GlobalUtils.debounce;
  deps.utils.throttle = GlobalUtils.throttle;
  deps.utils.safeAddEventListener = GlobalUtils.safeAddEventListener;
  deps.utils.safeAddEventListenerById = GlobalUtils.safeAddEventListenerById;
  deps.utils.syncAllTasksWithMode = GlobalUtils.syncAllTasksWithMode;
  deps.utils.DEFAULT_TASK_OPTION_BUTTONS = globalUtilsModule.DEFAULT_TASK_OPTION_BUTTONS;
  deps.utils.setGlobalUtilsDependencies = globalUtilsModule.setGlobalUtilsDependencies;

  // ✅ GlobalUtils accessible via deps.utils and appContext.getGlobalUtils() - no window.* exposure

  console.log('🛠️ Global utilities loaded');

  // ========== Load Migration Manager ==========
  console.log('🔄 Loading migration manager (core system)...');
  const migrationMod = await import(withV('../routine/migrationManager.js'));

  deps.core.migrationMod = migrationMod;
  deps.core.createInitialSchema25Data = migrationMod.createInitialSchema25Data;
  deps.core.checkMigrationNeeded = migrationMod.checkMigrationNeeded;
  deps.core.performSchema25Migration = migrationMod.performSchema25Migration;
  deps.core.initializeAppWithAutoMigration = migrationMod.initializeAppWithAutoMigration;

  // Initialize migration facade (consolidates 8 globals into 1 importable object)
  const migrationFacadeMod = await import(`../core/migrationFacade.js?v=${APP_VERSION}`);
  migrationFacadeMod.initMigrationFacade(migrationMod);
  deps.core.MigrationFacade = migrationFacadeMod.MigrationFacade;

  // ✅ Migration functions accessible via deps.core and MigrationFacade - no window.* exposure

  console.log('✅ Migration Manager loaded (with facade)');

  // ========== Initialize appContext early ==========
  // This allows modules loaded between initCoreBoot and initAppState
  // to use appContext getters (e.g., getGlobalUtils())
  // ✅ Use version param for cache-busting (like appInit pattern)
  const appContextMod = await import(`../core/appContext.js?v=${APP_VERSION}`);
  appContextMod.initAppContext({
    appInit,
    AppGlobalState,
    GlobalUtils,
    fixTaskValidationIssues: migrationMod.fixTaskValidationIssues
    // Note: AppState will be added via setContextValue in initAppState
  });

  // Register completeInitialSetup (wrapper for appInit.runCompleteInitialSetup)
  const completeInitialSetup = (activeCycle, fullSchemaData, schemaData) =>
    appInit.runCompleteInitialSetup(activeCycle, fullSchemaData, schemaData);
  appContextMod.setContextValue('completeInitialSetup', completeInitialSetup);

  console.log('✅ appContext initialized (early) with appInit, AppGlobalState, GlobalUtils, fixTaskValidationIssues, completeInitialSetup');

  return {
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
    UNDO_MIN_INTERVAL_MS,
    // Function reference for featureBoot.js to call after notifications ready
    initAppState
  };
}

/**
 * Initialize AppState and wire migration dependencies.
 * Called after notifications are available (from featureBoot).
 *
 * This function:
 * - Wires appInit setup dependencies
 * - Configures migration manager
 * - Creates and initializes AppState singleton
 * - Adds AppState to appContext
 * - Initializes data access functions
 *
 * @param {CoreBootDeps} deps - Dependency container with core modules
 * @param {Function} showNotification - Notification display function
 * @returns {Promise<MiniCycleState>} Initialized AppState instance
 * @example
 * const AppState = await initAppState(deps, showNotification);
 * await AppState.update(state => {
 *     state.settings.darkMode = true;
 * });
 */
export async function initAppState(deps, showNotification) {
  console.log('🗃️ Initializing AppState...');

  const { appInit, migrationMod, setAppInitDependencies, withV } = deps.core;

  // Import appContext early for use in deferred dependency getters
  // ✅ Use version param for cache-busting (like appInit pattern)
  const appContextMod = await import(`../core/appContext.js?v=${APP_VERSION}`);

  // Wire appInit setup dependencies
  // Note: These are GETTER FUNCTIONS that resolve at call time (deferred DI)
  // Use appContext getters instead of window.* for proper DI
  if (typeof setAppInitDependencies === 'function') {
    setAppInitDependencies({
      // For initialSetup
      loadMiniCycleData: () => loadMiniCycleData?.(),
      createInitialSchema25Data: () => migrationMod.createInitialSchema25Data?.(),
      showCycleCreationModal: () => appContextMod.getCycleApi?.()?.create?.(),
      getOnboardingManager: () => appContextMod.getUiApi?.()?.onboardingManager || null,
      getMiniCycleState: () => deps.core.AppState || null,
      showNotification: (msg, type, duration) => showNotification?.(msg, type, duration),  // For data integrity warnings

      // For completeInitialSetup - use grouped APIs (not legacy getters)
      loadMiniCycle: () => appContextMod.getCycleApi?.()?.load,
      updateReminderButtons: () => appContextMod.getReminderApi?.()?.updateButtons,
      updateDueDateVisibility: () => appContextMod.getUiApi?.()?.updateDueDateVisibility,
      checkOverdueTasks: () => appContextMod.getReminderApi?.()?.checkOverdue,
      organizeCompletedTasks: () => appContextMod.getUiApi?.()?.organizeCompletedTasks,
      startReminders: () => appContextMod.getReminderApi?.()?.start?.(),
      updateThemeColor: () => appContextMod.getUiApi?.()?.updateThemeColor?.(),
      getElementById: (id) => document.getElementById(id),
      addBodyClass: (cls) => document.body.classList.add(cls),
      removeBodyClass: (cls) => document.body.classList.remove(cls)
    });
    console.log('✅ AppInit setup dependencies configured');
  }

  // Wire migration manager dependencies
  migrationMod.setMigrationManagerDependencies({
    storage: localStorage,
    sessionStorage: sessionStorage,
    showNotification: (msg, type, duration) => showNotification?.(msg, type, duration),
    initialSetup: () => {
      if (typeof appInit.runInitialSetup === 'function') {
        return appInit.runInitialSetup();
      }
      return runFallbackInitialSetup(deps);
    },
    onInitialSetupComplete: () => appInit.markAppReady(),
    now: () => Date.now(),
    document: document
  });

  console.log('✅ Migration manager dependencies configured');

  // Load and create AppState
  const { createStateManager, assignCycleVariables } = await import(withV('../core/appState.js'));

  // ✅ assignCycleVariables accessible via deps.core - no window.* exposure
  deps.core.assignCycleVariables = assignCycleVariables;

  AppState = createStateManager({
    showNotification: showNotification || console.log.bind(console),
    storage: localStorage,
    createInitialData: migrationMod.createInitialSchema25Data,
    AppMeta: deps.core.AppMeta  // Use deps, not window.*
  });

  // ✅ AppState accessible via deps.core.AppState and appContext.state().AppState - no window.* exposure
  deps.core.AppState = AppState;

  // Initialize AppState
  // Note: AppState._initializeInternal() handles interrupted test restoration from IndexedDB
  await AppState.init();
  console.log('✅ AppState initialized');

  // ========== Add AppState to appContext ==========
  // appContext was already initialized in initCoreBoot with appInit, AppGlobalState, GlobalUtils
  // Now we add AppState which is created here
  // Note: appContextMod already imported at start of initAppState
  appContextMod.setContextValue('AppState', AppState);
  console.log('✅ AppState added to appContext');

  // ========== Inject AppState into Notifications ==========
  // Notifications was loaded early (pre-AppState) with AppState: null
  // Now that AppState exists, inject it so recurring notifications work
  if (deps.utils?.setNotificationsDependencies) {
    deps.utils.setNotificationsDependencies({ AppState });
    console.log('✅ AppState injected into Notifications');
  }

  // ========== Initialize data access functions ==========
  // Must be after appContext so dataAccess.js can use state().AppState
  await initDataAccess(deps);

  // Update appContext with data functions (legacy individual values)
  appContextMod.setContextValue('loadMiniCycleData', loadMiniCycleData);
  appContextMod.setContextValue('autoSave', autoSave);

  // ========== Register stateApi (grouped API) ==========
  // This is the preferred way to access state - groups related functions
  appContextMod.setContextValue('stateApi', {
    AppState,
    AppGlobalState: deps.core.AppGlobalState,
    AppMeta: deps.core.AppMeta,  // Use deps, not window.*
    loadMiniCycleData,
    autoSave,
    fixTaskValidationIssues: migrationMod.fixTaskValidationIssues
  });
  console.log('✅ stateApi registered in appContext');

  // Update deps.core with data functions
  deps.core.loadMiniCycleData = loadMiniCycleData;
  deps.core.autoSave = autoSave;
  deps.core.updateCycleData = updateCycleData;

  // Mark core systems ready
  await appInit.markCoreSystemsReady();
  console.log('✅ Core systems ready');

  return AppState;
}

// ============================================================================
// SECTION 2: Core Data Functions (imported from dataAccess.js)
// ============================================================================
// These functions are now defined in modules/core/dataAccess.js
// Re-exported here for backward compatibility

// Import will be done dynamically after appContext is initialized
let loadMiniCycleData, autoSave, updateCycleData;

// Initialize data access functions (called after appContext is ready)
async function initDataAccess(deps) {
  const dataAccessMod = await import(`../core/dataAccess.js?v=${APP_VERSION}`);

  // ✅ FIX: Inject all deps directly into dataAccess to avoid versioned/unversioned module mismatch
  if (dataAccessMod.setDataAccessDeps) {
    dataAccessMod.setDataAccessDeps({
      AppState,
      // createInitialSchema25Data is set by initMigration before this is called
      createInitialSchema25Data: deps?.core?.createInitialSchema25Data,
      // getExtractTaskDataFromDOM is set later by featureBoot - use lazy wrapper
      getExtractTaskDataFromDOM: () => deps?.task?.extractTaskDataFromDOM?.()
    });
  }

  loadMiniCycleData = dataAccessMod.loadMiniCycleData;
  autoSave = dataAccessMod.autoSave;
  updateCycleData = dataAccessMod.updateCycleData;

  // ✅ Data functions accessible via appContext.getStateApi() and deps.core - no window.* exposure

  console.log('✅ Data access functions loaded from dataAccess.js');
}

// Export the functions (they'll be populated after initDataAccess)
export { loadMiniCycleData, autoSave, updateCycleData, initDataAccess };

// ============================================================================
// SECTION 3: Cache Recovery Helpers (SINGLE SOURCE OF TRUTH)
// ============================================================================

// Unified cache recovery - single flag prevents reload loops across all systems
const CACHE_RECOVERY_FLAG = '_cacheRecoveryAttempts';
const MAX_RECOVERY_ATTEMPTS = 2;

/**
 * Clear all service worker caches and unregister workers
 * @returns {Promise<number>} Number of caches cleared
 */
export async function clearAllCaches() {
  let cleared = 0;

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    cleared = cacheNames.length;
    console.log('🗑️ Cleared', cleared, 'caches');
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
    if (registrations.length > 0) {
      console.log('🗑️ Unregistered', registrations.length, 'service worker(s)');
    }
  }

  return cleared;
}

/**
 * Get current recovery attempt count
 * @returns {number}
 */
export function getRecoveryAttemptCount() {
  return parseInt(sessionStorage.getItem(CACHE_RECOVERY_FLAG) || '0', 10);
}

/**
 * Check if recovery attempts are exhausted
 * @returns {boolean}
 */
export function isRecoveryExhausted() {
  return getRecoveryAttemptCount() >= MAX_RECOVERY_ATTEMPTS;
}

/**
 * Clear recovery flags (call after successful boot)
 */
export function clearRecoveryFlags() {
  sessionStorage.removeItem(CACHE_RECOVERY_FLAG);
  sessionStorage.removeItem('_staleCacheReload'); // Legacy cleanup
  sessionStorage.removeItem('_versionGuardReload'); // Legacy cleanup
  sessionStorage.removeItem('_cacheRecoveryReload'); // Legacy cleanup
}

/**
 * Attempt cache recovery with reload
 * Uses single shared counter to prevent reload loops across systems
 * @param {string} source - Identifier for logging (e.g., 'coreBoot', 'orchestrator')
 * @returns {Promise<boolean>} true if reload initiated, false if exhausted
 */
export async function attemptCacheRecovery(source = 'unknown') {
  const attempts = getRecoveryAttemptCount();

  if (attempts < MAX_RECOVERY_ATTEMPTS) {
    console.log(`🔄 Cache recovery attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS} from ${source}`);
    sessionStorage.setItem(CACHE_RECOVERY_FLAG, (attempts + 1).toString());

    await clearAllCaches();

    // Navigate to cache-busted URL
    const url = new URL(window.location.href);
    url.searchParams.set('_cc', Date.now().toString());
    window.location.href = url.toString();
    return true;
  }

  // Exhausted retries
  console.warn(`⚠️ Cache recovery exhausted (${MAX_RECOVERY_ATTEMPTS} attempts) - ${source}`);
  sessionStorage.removeItem(CACHE_RECOVERY_FLAG);
  return false;
}

/**
 * Handle stale cache recovery (wrapper for backward compatibility)
 */
async function handleStaleCacheRecovery() {
  const recovered = await attemptCacheRecovery('coreBoot-stale');
  if (!recovered) {
    sessionStorage.setItem('_staleAppInitForgiven', 'true');
    showStaleCacheBanner();
  }
  return recovered;
}

/**
 * Show a user-friendly banner for manual refresh
 */
function showStaleCacheBanner() {
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
}

/**
 * Clean up legacy appInit.js from cache
 */
async function cleanLegacyAppInitCache() {
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
}

/**
 * Handle compat mode refresh for old appInit versions
 */
function handleCompatModeRefresh() {
  try {
    const refreshKey = 'minicycle.appinitCompatRefreshed_v2';
    const alreadyRefreshed = window.localStorage.getItem(refreshKey) === '1';

    if (!alreadyRefreshed) {
      console.warn('♻️ Triggering one-time refresh to recover from stale appInit.js');
      window.localStorage.setItem(refreshKey, '1');
      window.location.reload();
    }
  } catch (e) {
    console.warn('⚠️ Failed to record compat refresh flag:', e);
  }
}

/**
 * Fallback initial setup for old appInit versions
 */
async function runFallbackInitialSetup(deps) {
  console.warn('⚠️ appInit.runInitialSetup not available - using fallback initialization');

  try {
    const createData = deps.core.createInitialSchema25Data;

    let schemaData = loadMiniCycleData?.();

    if (!schemaData) {
      console.log('🆕 No data found - creating initial structure...');
      createData?.();
      schemaData = loadMiniCycleData?.();
    }

    if (!schemaData) {
      console.error('❌ Failed to load or create data');
      return;
    }

    const { cycles, activeCycle } = schemaData;

    // Use appContext instead of window.* for app functions
    // ✅ Use version param for cache-busting (like appInit pattern)
    const appContextMod = await import(`../core/appContext.js?v=${APP_VERSION}`);

    if (!activeCycle || !cycles?.[activeCycle]) {
      console.log('🆕 No active cycle - showing cycle creation modal...');
      appContextMod.getCycleApi?.()?.create?.();
      return;
    }

    console.log('📦 Loading cycle:', activeCycle);
    await appContextMod.getCycleApi?.()?.load?.(activeCycle);

    console.log('✅ Fallback initialization complete');
  } catch (error) {
    console.error('❌ Fallback initialization failed:', error);
  }
}

// ============================================================================
// SECTION 4: Exports
// ============================================================================

export {
  AppGlobalState,
  FeatureFlags,
  GlobalUtils,
  appInit,
  AppState,
  withV,
  DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
  DEFAULT_RECURRING_DELETE_SETTINGS,
  TASK_LIMIT,
  UNDO_LIMIT,
  UNDO_MIN_INTERVAL_MS
};

console.log('✅ coreBoot.js loaded');
