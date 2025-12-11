/**
 * ============================================================================
 * coreBoot.js - Core State & Initialization
 * ============================================================================
 * Location: modules/boot/coreBoot.js
 *
 * This is the FOUNDATION boot file. It:
 * - Sets window.AppBootStarted IMMEDIATELY (for HTML fallback detection)
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
 * @version 1.0.0
 * ============================================================================
 */

// ============================================================================
// CRITICAL: Set boot flag IMMEDIATELY for HTML fallback detection
// ============================================================================
window.AppBootStarted = true;
window.AppGlobalState = window.AppGlobalState || {}; // Ensure exists before async
window.AppGlobalState.bootStartTime = Date.now();

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
let withV = (path) => `${path}?v=${window.APP_VERSION || '1.0'}`;

// ============================================================================
// SECTION 1: Core Initialization
// ============================================================================

/**
 * Initialize core boot systems. This is the first phase of app initialization.
 * @param {Object} deps - Dependency container to populate
 * @returns {Promise<Object>} Core module references
 */
export async function initCoreBoot(deps) {
  console.log('🚀 coreBoot: Starting core initialization...');

  // ========== Load AppGlobalState ==========
  const appGlobalStateMod = await import(
    `../core/appGlobalState.js?v=${window.APP_VERSION || '1.0'}`
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

  // ========== Clean up cache-clearing URL parameter ==========
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('_cc')) {
    urlParams.delete('_cc');
    const cleanUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }

  // ========== Update boot timestamp ==========
  AppGlobalState.bootStartTime = Date.now();

  // ========== Load appInit ==========
  const appInitModule = await import(`../core/appInit.js?v=${window.APP_VERSION}`);
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

  // Set backward compatibility aliases
  window.AppInit = appInit;
  window.appInit = appInit;

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
  withV = (path) => `${path}?v=${window.APP_VERSION}`;
  deps.core.withV = withV;

  // ========== Create AppMeta ==========
  window.AppMeta = {
    version: window.APP_VERSION,
    appInitVersion: APPINIT_VERSION || null
  };
  deps.core.AppMeta = window.AppMeta;

  console.log('🚀 appInit and constants loaded (2-phase initialization system)');

  // ========== Load GlobalUtils ==========
  const globalUtilsModule = await import(withV('../utils/globalUtils.js'));
  GlobalUtils = globalUtilsModule.default;

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

  // Expose to window for backward compat
  window.GlobalUtils = GlobalUtils;
  window.DEFAULT_TASK_OPTION_BUTTONS = globalUtilsModule.DEFAULT_TASK_OPTION_BUTTONS;
  window.sanitizeInput = GlobalUtils.sanitizeInput;
  window.escapeHtml = GlobalUtils.escapeHtml;
  window.generateHashId = GlobalUtils.generateHashId;
  window.syncAllTasksWithMode = GlobalUtils.syncAllTasksWithMode;
  window.safeLocalStorageGet = GlobalUtils.safeLocalStorageGet;
  window.safeLocalStorageSet = GlobalUtils.safeLocalStorageSet;
  window.safeLocalStorageRemove = GlobalUtils.safeLocalStorageRemove;
  window.safeJSONParse = GlobalUtils.safeJSONParse;
  window.safeJSONStringify = GlobalUtils.safeJSONStringify;
  window.generateId = GlobalUtils.generateId;

  console.log('🛠️ Global utilities loaded');

  // ========== Load Migration Manager ==========
  console.log('🔄 Loading migration manager (core system)...');
  const migrationMod = await import(withV('../cycle/migrationManager.js'));

  deps.core.migrationMod = migrationMod;
  deps.core.createInitialSchema25Data = migrationMod.createInitialSchema25Data;
  deps.core.checkMigrationNeeded = migrationMod.checkMigrationNeeded;
  deps.core.performSchema25Migration = migrationMod.performSchema25Migration;

  // Expose migration functions globally
  window.createInitialSchema25Data = migrationMod.createInitialSchema25Data;
  window.checkMigrationNeeded = migrationMod.checkMigrationNeeded;
  window.simulateMigrationToSchema25 = migrationMod.simulateMigrationToSchema25;
  window.performSchema25Migration = migrationMod.performSchema25Migration;
  window.validateAllMiniCycleTasksLenient = migrationMod.validateAllMiniCycleTasksLenient;
  window.fixTaskValidationIssues = migrationMod.fixTaskValidationIssues;
  window.initializeAppWithAutoMigration = migrationMod.initializeAppWithAutoMigration;
  window.forceAppMigration = migrationMod.forceAppMigration;

  console.log('✅ Migration Manager loaded');

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
 * Called after notifications are available.
 * @param {Object} deps - Dependency container
 * @param {Function} showNotification - Notification function
 * @returns {Promise<Object>} AppState instance
 */
export async function initAppState(deps, showNotification) {
  console.log('🗃️ Initializing AppState...');

  const { appInit, migrationMod, setAppInitDependencies, withV } = deps.core;

  // Wire appInit setup dependencies
  if (typeof setAppInitDependencies === 'function') {
    setAppInitDependencies({
      // For initialSetup
      loadMiniCycleData: () => loadMiniCycleData?.(),
      createInitialSchema25Data: () => migrationMod.createInitialSchema25Data?.(),
      showCycleCreationModal: () => window.showCycleCreationModal?.(),
      getOnboardingManager: () => window.onboardingManager,
      getMiniCycleState: () => null,

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

  // Expose assignCycleVariables to window (needed by cycleCompletion and other modules)
  window.assignCycleVariables = assignCycleVariables;
  deps.core.assignCycleVariables = assignCycleVariables;

  AppState = createStateManager({
    showNotification: showNotification || console.log.bind(console),
    storage: localStorage,
    createInitialData: migrationMod.createInitialSchema25Data,
    AppMeta: window.AppMeta
  });

  window.AppState = AppState;
  deps.core.AppState = AppState;

  // ✅ Expose core data functions to deps.core for featureBoot.js
  deps.core.loadMiniCycleData = loadMiniCycleData;
  deps.core.autoSave = autoSave;
  deps.core.updateCycleData = updateCycleData;

  // Initialize AppState
  await AppState.init();
  console.log('✅ AppState initialized');

  // Mark core systems ready
  await appInit.markCoreSystemsReady();
  console.log('✅ Core systems ready');

  return AppState;
}

// ============================================================================
// SECTION 2: Core Data Functions
// ============================================================================

/**
 * Load miniCycle data from AppState (Schema 2.5 format)
 * Returns legacy-compatible format for backward compatibility
 * Creates initial data if none exists
 */
export function loadMiniCycleData() {
  // Try AppState first for most current data (if available)
  if (window.AppState?.isReady?.()) {
    try {
      const state = window.AppState.get();
      if (state) {
        // Load reminders from active cycle (per-cycle)
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
          reminders: reminders,
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
        reminders: reminders,
        settings: parsed.settings
      };
    } catch (error) {
      console.error('❌ Error parsing Schema 2.5 data:', error);
      console.error('❌ This likely means data is corrupted. NOT creating fresh data to preserve existing localStorage.');
      return null;
    }
  }

  // CREATE INITIAL DATA IF NONE EXISTS
  // SAFETY CHECK: Verify localStorage truly has no data before creating fresh data
  const existingData = localStorage.getItem("miniCycleData");
  if (existingData) {
    console.error('❌ Data exists in localStorage but failed to parse. NOT creating fresh data to prevent data loss.');
    console.error('❌ Existing data:', existingData.substring(0, 200) + '...');
    return null;
  }

  console.log('🆕 No data found in localStorage - Creating initial Schema 2.5 structure...');
  window.createInitialSchema25Data?.();

  // Try again after creating
  const newData = localStorage.getItem("miniCycleData");
  if (newData) {
    const parsed = JSON.parse(newData);
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
      reminders: reminders,
      settings: parsed.settings
    };
  }

  return null;
}
window.loadMiniCycleData = loadMiniCycleData;

/**
 * Auto-save current state with debouncing
 */
export async function autoSave(overrideTaskList = null, immediate = false) {
  // AppState must be ready
  if (!window.AppState?.isReady?.()) {
    console.error('❌ autoSave called before AppState ready');
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
    }, immediate);

    return { success: true, taskCount: taskData.length };
  } catch (error) {
    console.error('❌ autoSave failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}
window.autoSave = autoSave;

/**
 * Update cycle data with a producer function
 */
export async function updateCycleData(cycleId, updateFn, immediate = true) {
  if (!window.AppState?.isReady?.()) {
    console.warn('⚠️ updateCycleData called before AppState ready');
    return;
  }

  try {
    await window.AppState.update(state => {
      if (state.data?.cycles?.[cycleId]) {
        updateFn(state.data.cycles[cycleId]);
        state.metadata.lastModified = new Date().toISOString();
      }
    }, immediate);
  } catch (error) {
    console.error('❌ updateCycleData failed:', error);
  }
}
window.updateCycleData = updateCycleData;

// ============================================================================
// SECTION 3: Cache Recovery Helpers
// ============================================================================

/**
 * Handle stale cache recovery with reload
 */
async function handleStaleCacheRecovery() {
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

    // Unregister service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
        console.log('🗑️ Unregistered service worker');
      }
    }

    // Navigate to cache-busted URL
    const url = new URL(window.location.href);
    url.searchParams.set('_cc', Date.now().toString());
    window.location.href = url.toString();
    return true;
  }

  // If we've tried twice and still stale, show user instructions
  sessionStorage.removeItem('_staleCacheReload');
  sessionStorage.setItem('_staleAppInitForgiven', 'true');
  showStaleCacheBanner();
  return false;
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

    if (!activeCycle || !cycles?.[activeCycle]) {
      console.log('🆕 No active cycle - showing cycle creation modal...');
      window.showCycleCreationModal?.();
      return;
    }

    console.log('📦 Loading cycle:', activeCycle);
    await window.loadMiniCycle?.(activeCycle);

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
