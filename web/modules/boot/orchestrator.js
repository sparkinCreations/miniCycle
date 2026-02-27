/**
 * miniCycle Boot Orchestrator
 *
 * Coordinates the 3-phase boot process and provides boot UI feedback.
 *
 * Responsibilities:
 * - Sequence control for coreBoot → featureBoot → uiBoot
 * - Loader UI updates during boot (progress text, spinner)
 * - Error display for boot failures (renders error UI in DOM)
 * - Automatic retry and cache recovery for stale module issues
 *
 * Boot Phases:
 * - Phase 1: coreBoot (AppState, GlobalUtils, migration)
 * - Phase 2: featureBoot (all feature modules via moduleLoader)
 * - Phase 3: uiBoot (event listeners, UI finalization)
 *
 * Note: This file does include DOM manipulation for boot UI feedback.
 * A future refactor could extract boot UI to a separate module.
 *
 * @module boot/orchestrator
 * @version 1.1.0
 * @see {@link module:boot/coreBoot} - Phase 1 implementation
 * @see {@link module:boot/featureBoot} - Phase 2 implementation
 * @see {@link module:boot/uiBoot} - Phase 3 implementation
 */

import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ✅ Single source of truth: Read version from globalThis (set by version.js)
// Falls back to 'dev-local' for local development without version.js
const APP_VERSION = globalThis.APP_VERSION || 'dev-local';

// ═══════════════════════════════════════════════════════════════════════════
// SAFARI FIX: Use dynamic imports with version params to bypass memory cache
// Safari's memory cache sits ABOVE service workers and serves stale static imports.
// Converting to dynamic imports with ?v= params forces fresh fetches.
// ═══════════════════════════════════════════════════════════════════════════

// Module references (populated by loadDependencies)
let installDebugFilter, setDebugModeDependencies, refreshDebugState, enableDebugFn, disableDebugFn, isDebugFn;
let setStorageDependencies;
let BOOT_TIMEOUTS;
let attemptCacheRecovery, clearAllCaches, clearRecoveryFlags, isRecoveryExhausted;

// ✅ FIX: Shared deps container that persists across boot retries
// Creating fresh deps on each retry breaks DI closures that capture deps reference
let deps = null;

// Load all dependencies with version params (Safari memory cache fix)
async function loadDependencies() {
  console.log('🔄 Loading orchestrator dependencies...');

  try {
    const [debugMod, storageMod, constantsMod, coreBootMod] = await Promise.all([
      import(`../utils/debugMode.js?v=${APP_VERSION}`),
      import(`../utils/storageUtils.js?v=${APP_VERSION}`),
      import(`../core/constants.js?v=${APP_VERSION}`),
      import(`./coreBoot.js?v=${APP_VERSION}`)
    ]);

    console.log('📦 Modules loaded, extracting exports...');
    console.log('   constants exports:', Object.keys(constantsMod));

    // Assign from debugMode
    installDebugFilter = debugMod.installDebugFilter;
    setDebugModeDependencies = debugMod.setDebugModeDependencies;
    refreshDebugState = debugMod.refreshDebugState;
    enableDebugFn = debugMod.enableDebug;
    disableDebugFn = debugMod.disableDebug;
    isDebugFn = debugMod.isDebug;

    // Assign from storageUtils
    setStorageDependencies = storageMod.setStorageDependencies;

    // Assign from constants - with validation
    BOOT_TIMEOUTS = constantsMod.BOOT_TIMEOUTS;
    if (!BOOT_TIMEOUTS) {
      console.error('❌ BOOT_TIMEOUTS not found in constants.js exports!');
      console.error('   Available exports:', Object.keys(constantsMod));
      // Use fallback values to prevent crash
      BOOT_TIMEOUTS = {
        MODULE_IMPORT: 10000,
        PHASE_1: 15000,
        PHASE_2: 20000,
        PHASE_3: 15000,
        TOTAL: 45000,
        RETRY_DELAY: 1000
      };
    }

    // Assign from coreBoot
    attemptCacheRecovery = coreBootMod.attemptCacheRecovery;
    clearAllCaches = coreBootMod.clearAllCaches;
    clearRecoveryFlags = coreBootMod.clearRecoveryFlags;
    isRecoveryExhausted = coreBootMod.isRecoveryExhausted;

    // Install debug filter after loading
    if (typeof installDebugFilter === 'function') {
      installDebugFilter();
    }

    console.log('✅ Orchestrator dependencies loaded (BOOT_TIMEOUTS.MODULE_IMPORT =', BOOT_TIMEOUTS?.MODULE_IMPORT, ')');
  } catch (error) {
    console.error('❌ Failed to load orchestrator dependencies:', error);
    // Use fallback BOOT_TIMEOUTS to allow boot to continue
    BOOT_TIMEOUTS = {
      MODULE_IMPORT: 10000,
      PHASE_1: 15000,
      PHASE_2: 20000,
      PHASE_3: 15000,
      TOTAL: 45000,
      RETRY_DELAY: 1000
    };
    throw error; // Re-throw to trigger error handling
  }
}

// Retry configuration
const MAX_BOOT_RETRIES = 1;
const LITE_VERSION_PATH = './lite/miniCycle-lite.html';
let bootAttempt = 0;

// If set, overrides all boot progress messages (e.g., during routine import reload)
let loaderMessageOverride = null;

/**
 * Update loader text and progress bar
 * @param {string} message - Progress message to display
 * @param {number} percent - Progress percentage (0-100)
 */
function updateLoaderProgress(message, percent = 0) {
  const loaderText = document.querySelector(DOM_SELECTORS.LOADER_TEXT);
  if (loaderText) {
    loaderText.textContent = loaderMessageOverride || message;
  }
  const loaderBar = document.querySelector(DOM_SELECTORS.LOADER_BAR);
  if (loaderBar) {
    loaderBar.style.transform = `scaleX(${percent / 100})`;
  }
}

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} phaseName - Name of the phase for error messages
 * @returns {Promise} - Resolves with original value or rejects on timeout
 */
function withTimeout(promise, ms, phaseName) {
  // Fix #12: Clear timeout when main promise resolves to prevent lingering timers
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${phaseName} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Redirect to lite version as fallback
 */
function redirectToLite() {
  console.log('🔄 Redirecting to lite version...');
  // Preserve any query params except mode
  const url = new URL(LITE_VERSION_PATH, window.location.origin);
  url.searchParams.set('fallback', 'true');
  window.location.href = url.href;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for innerHTML
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get user-friendly error description and suggestion
 * @param {Error} error - The error that occurred
 * @param {string} phase - Which phase failed
 * @returns {Object} - { description, suggestion }
 */
function getErrorDetails(error, phase) {
  const msg = error?.message || '';

  // Cache/import errors
  if (msg.includes('Importing') || msg.includes('module') || msg.includes('binding name')) {
    return {
      description: getLabel('boot.errorCachedFile'),
      suggestion: getLabel('boot.suggestClearCache')
    };
  }

  // Network errors
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to load')) {
    return {
      description: getLabel('boot.errorNetwork'),
      suggestion: getLabel('boot.suggestCheckInternet')
    };
  }

  // Timeout errors
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return {
      description: getLabel('boot.errorTimeout', { vars: { phase } }),
      suggestion: getLabel('boot.suggestRetryOrLite')
    };
  }

  // Storage errors
  if (msg.includes('localStorage') || msg.includes('storage') || msg.includes('quota')) {
    return {
      description: getLabel('boot.errorStorage'),
      suggestion: getLabel('boot.suggestClearSiteData')
    };
  }

  // Default
  return {
    description: getLabel('boot.errorGeneric'),
    suggestion: getLabel('boot.suggestRefresh')
  };
}

/**
 * Detect cache-related boot errors (stale module/cache mismatch)
 * @param {Error} error - The error that occurred
 * @returns {boolean}
 */
function isCacheError(error) {
  const msg = error?.message || '';
  return msg.includes('Importing') ||
    msg.includes('module') ||
    msg.includes('binding name') ||
    msg.includes('export');
}

/**
 * Show boot error to user with retry or lite fallback
 * Uses the existing #app-loader for consistent branding
 * @param {string} phase - Which phase failed
 * @param {Error} error - The error that occurred
 * @param {boolean} willRetry - Whether a retry will be attempted
 */
function showBootError(phase, error, willRetry = false) {
  console.error(`❌ Boot failed at ${phase} (attempt ${bootAttempt}):`, error);

  // Use existing app-loader for consistent styling
  const loader = document.getElementById(DOM_IDS.APP_LOADER);
  if (!loader) {
    // Fallback if loader not found
    console.error('App loader element not found');
    return;
  }

  // Keep loader visible and update its content
  loader.style.display = 'flex';
  loader.classList.remove('fade-out');

  const { description, suggestion } = getErrorDetails(error, phase);
  const shortError = (error?.message || 'Unknown error').substring(0, 80);

  // Escape dynamic values to prevent XSS
  const safeDescription = escapeHtml(description);
  const safeSuggestion = escapeHtml(suggestion);
  const safeShortError = escapeHtml(shortError);

  if (willRetry) {
    loader.innerHTML = `
      <img src="assets/images/logo/minicycle_logo_icon.png" alt="miniCycle" class="loader-logo" width="120" height="96">
      <div class="loader-text" style="animation: none;">${escapeHtml(getLabel('boot.havingTrouble'))}</div>
      <div style="margin-top: 8px; color: rgba(255,255,255,0.9); font-size: 13px;">${safeDescription}</div>
      <div style="margin-top: 10px; color: rgba(255,255,255,0.7); font-size: 14px;">${escapeHtml(getLabel('boot.retrying'))}</div>
    `;
  } else {
    // Check if this looks like a cache error
    const isCacheErrorMatch = isCacheError(error);

    loader.innerHTML = `
      <img src="assets/images/logo/minicycle_logo_icon.png" alt="miniCycle" width="120" height="96" style="object-fit: contain; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2)); animation: none;">
      <div style="margin-top: 20px; color: white; font-size: 18px; font-weight: 500; font-family: 'Inter', sans-serif;">${escapeHtml(getLabel('boot.unableToLoad'))}</div>
      <div style="margin-top: 8px; color: rgba(255,255,255,0.9); font-size: 14px; max-width: 300px; text-align: center;">
        ${safeDescription}
      </div>
      <div style="margin-top: 6px; color: rgba(255,255,255,0.6); font-size: 12px; max-width: 280px; text-align: center; font-family: monospace; word-break: break-word;">
        ${safeShortError}
      </div>
      <div style="margin-top: 12px; color: rgba(255,255,255,0.8); font-size: 13px;">
        💡 ${safeSuggestion}
      </div>
      <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
        ${isCacheErrorMatch ? `
        <button id="clear-cache-btn" style="padding: 12px 24px; cursor: pointer; border: none; background: #ff9800; color: white; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif; transition: all 0.2s;">
          🗑️ ${escapeHtml(getLabel('boot.clearCache'))}
        </button>
        ` : `
        <button id="try-again-btn" style="padding: 12px 24px; cursor: pointer; border: 2px solid white; background: transparent; color: white; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif; transition: all 0.2s;">
          ${escapeHtml(getLabel('boot.tryAgain'))}
        </button>
        `}
        <button id="lite-version-btn" style="padding: 12px 24px; cursor: pointer; border: none; background: white; color: #4c79ff; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif; transition: all 0.2s;">
          ${escapeHtml(getLabel('boot.useLite'))}
        </button>
      </div>
      <div style="margin-top: 12px; color: rgba(255,255,255,0.5); font-size: 11px;">
        ${escapeHtml(getLabel('boot.failedAt', { vars: { phase: phase, number: bootAttempt } }))}
      </div>
    `;

    // Add button handlers (uses addEventListener instead of inline onclick)
    const tryAgainBtn = document.getElementById('try-again-btn');
    tryAgainBtn?.addEventListener('click', () => location.reload());

    const liteBtn = document.getElementById('lite-version-btn');
    liteBtn?.addEventListener('click', () => { window.location.href = LITE_VERSION_PATH; });

    // Add clear cache handler (uses shared utility)
    const clearCacheBtn = document.getElementById(DOM_IDS.CLEAR_CACHE_BTN);
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        clearCacheBtn.textContent = getLabel('boot.clearing');
        clearCacheBtn.disabled = true;

        try {
          const recovered = await attemptCacheRecovery('orchestrator-user');
          if (!recovered) {
            await clearAllCaches();
            window.location.reload(true);
          }
        } catch (e) {
          console.error('Cache clear failed:', e);
          window.location.reload(true);
        }
      });
    }
  }
}

/**
 * Execute the core boot sequence with timeout protection.
 * Separated from initApp() to enable retry on failure.
 *
 * @returns {Promise<boolean>} True if boot succeeded, false if reload initiated
 * @throws {Error} If any phase times out or fails critically
 */
async function runBootSequence() {
  const bootStart = Date.now();
  const isRetry = bootAttempt > 1;

  // ✅ On retry, append retry counter to version for cache busting
  // This forces fresh ES module loads, bypassing browser's module cache
  // Critical for clearing DI module state that persists in cached modules
  const versionSuffix = isRetry ? `${APP_VERSION}.r${bootAttempt}` : APP_VERSION;

  // ========== CHECK FOR UPDATES ==========
  updateLoaderProgress(getLabel('boot.checkingUpdates'), 5);
  // Service worker handles actual update check asynchronously
  // This step ensures version.js is loaded and ready

  // ========== LOAD BOOT MODULES (with timeout) ==========
  updateLoaderProgress(getLabel('boot.loadingCore'), 15);
  const [coreBoot, featureBoot, uiBoot] = await withTimeout(
    Promise.all([
      import(`./coreBoot.js?v=${versionSuffix}`),
      import(`./featureBoot.js?v=${versionSuffix}`),
      import(`./uiBoot.js?v=${versionSuffix}`)
    ]),
    BOOT_TIMEOUTS.MODULE_IMPORT,
    'Module import'
  );

  const { initCoreBoot, initAppState } = coreBoot;
  const { bootFeatures, bootEarlyDeps } = featureBoot;
  const { initUIBoot } = uiBoot;

  // Import moduleLoader to clear cache on retry
  const { clearLoadedModules } = await import(`./moduleLoader.js?v=${versionSuffix}`);

  // Import appInit to reset its state on retry
  const { appInit } = await import(`../core/appInit.js?v=${versionSuffix}`);

  // ========== CREATE/REUSE DEPS CONTAINER ==========
  // Reuse deps across retries to preserve DI closure references AND module state
  if (!deps) {
    deps = {
      utils: {}, features: {}, ui: {}, core: {}, task: {},
      cycle: {}, recurring: {}, progress: {}, storage: {}, testing: {}
    };
    console.log('📦 Created fresh deps container');
  } else {
    // ✅ CRITICAL FIX: Clear module loader cache on retry
    // Cached modules have DI closures that captured the old deps from attempt 1
    // We need to reload all modules so they get fresh closures with the current deps
    console.log('♻️ Retry detected - clearing module cache to refresh DI closures');
    clearLoadedModules();

    // ✅ CRITICAL FIX 3: Reset appInit state on retry
    // appInit singleton persists across retries with stale coreReady/appReady flags
    appInit.reset();

    // ✅ CRITICAL FIX 2: Clear nested objects to prevent stale references
    // On retry, we need to rebuild all deps from scratch so Proxy getters work correctly
    // IMPORTANT: We must CLEAR properties, not replace objects, because moduleLoader
    // creates Proxies with closures that capture deps.core reference
    console.log('🧹 Clearing nested deps object properties for fresh DI wiring');
    Object.keys(deps.utils || {}).forEach(key => delete deps.utils[key]);
    Object.keys(deps.features || {}).forEach(key => delete deps.features[key]);
    Object.keys(deps.ui || {}).forEach(key => delete deps.ui[key]);
    Object.keys(deps.core || {}).forEach(key => delete deps.core[key]);
    Object.keys(deps.task || {}).forEach(key => delete deps.task[key]);
    Object.keys(deps.cycle || {}).forEach(key => delete deps.cycle[key]);
    Object.keys(deps.recurring || {}).forEach(key => delete deps.recurring[key]);
    Object.keys(deps.progress || {}).forEach(key => delete deps.progress[key]);
    Object.keys(deps.storage || {}).forEach(key => delete deps.storage[key]);
    Object.keys(deps.testing || {}).forEach(key => delete deps.testing[key]);
  }

  // ========== PHASE 1: CORE (with timeout) ==========
  updateLoaderProgress(getLabel('boot.startingSystems'), 30);
  console.log('🔧 Phase 1: Core systems...');
  const coreResult = await withTimeout(
    initCoreBoot(deps, versionSuffix),
    BOOT_TIMEOUTS.PHASE_1,
    'Phase 1 (Core)'
  );
  if (!coreResult) { console.log('⏳ Core boot initiated reload...'); return false; }

  const { GlobalUtils } = coreResult;
  await bootEarlyDeps(deps, coreResult);
  await initAppState(deps, deps.utils.showNotification);

  // Wire AppState into debugMode for state-based persistence
  setDebugModeDependencies({ AppState: deps.core.AppState });
  refreshDebugState();

  // Store versioned debug functions in deps for DI chain
  // (settingsUIManager needs these from the versioned instance, not a bare import)
  deps.utils.enableDebug = enableDebugFn;
  deps.utils.disableDebug = disableDebugFn;
  deps.utils.isDebug = isDebugFn;

  // Wire AppState into storageUtils for quota caching
  setStorageDependencies({ AppState: deps.core.AppState });

  console.log(`✅ Phase 1 complete (${Date.now() - bootStart}ms)`);

  // Inject large dialog modals BEFORE Phase 2 — modules query these elements during init
  const { RECURRING_PANEL_HTML, PREFERENCES_MODAL_HTML, SETTINGS_MODAL_HTML } =
      await import(`./modalTemplates.js?v=${versionSuffix}`);
  document.getElementById('games-panel')
      ?.insertAdjacentHTML('beforebegin', RECURRING_PANEL_HTML);
  document.getElementById('routine-switcher-modal')
      ?.insertAdjacentHTML('beforebegin', PREFERENCES_MODAL_HTML);
  document.getElementById('testing-modal')
      ?.insertAdjacentHTML('beforebegin', SETTINGS_MODAL_HTML);
  console.log('✅ Modal templates injected');

  // ========== PHASE 2: FEATURES (with timeout) ==========
  updateLoaderProgress(getLabel('boot.loadingFeatures'), 55);
  console.log('🔌 Phase 2: Feature modules...');
  await withTimeout(
    bootFeatures(deps, coreResult),
    BOOT_TIMEOUTS.PHASE_2,
    'Phase 2 (Features)'
  );

  // ✅ Use version param for cache-busting (like appInit pattern)
  const appContextMod = await import(`../core/appContext.js?v=${versionSuffix}`);
  appContextMod.validateAllApisRegistered();
  console.log(`✅ Phase 2 complete (${Date.now() - bootStart}ms)`);

  // ========== PHASE 3: DATA & UI (with timeout) ==========
  updateLoaderProgress(getLabel('boot.startingUp'), 85);
  console.log('🎨 Phase 3: Data & UI...');

  await withTimeout(
    (async () => {
      // Load app data - fix any task validation issues first
      appContextMod.state?.()?.fixTaskValidationIssues?.();
      await deps.core.initAppWithAutoMigration({ forceMode: true });

      // Re-initialize vocab themes and themes panel for new users.
      // vocabThemeManager.init() and setupThemesPanel() both run during Phase 2, but
      // for brand-new users AppState has no data yet at that point and both return early.
      // Now that initAppWithAutoMigration() has created the initial state, retry them.
      // Both are no-ops for returning users (init() guards on unlockedThemes length;
      // setupThemesPanel() guards on _setupThemesPanelInitialized flag).
      deps.features?.vocabThemeManager?.init?.();
      deps.features?.setupThemesPanel?.();

      // Initialize UI (single entrypoint - all DOM/listeners/finalization)
      await initUIBoot({ GlobalUtils, deps, appContextMod });
    })(),
    BOOT_TIMEOUTS.PHASE_3,
    'Phase 3 (UI)'
  );

  updateLoaderProgress(getLabel('boot.ready'), 100);
  const totalTime = Date.now() - bootStart;
  console.log(`✅ miniCycle initialization complete (${totalTime}ms)`);

  // Clear recovery flags on successful boot
  clearRecoveryFlags();

  // Clear boot failure counter (failsafe in miniCycle.html)
  if (typeof window.__miniCycleBootSuccess === 'function') {
    window.__miniCycleBootSuccess();
  }

  // PWA File Handling: open .mcyc files from desktop
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams.files?.length) return;

      // Guard against reload loop: processImportedData calls location.reload()
      // and the launchQueue re-fires on reload in some browsers
      if (sessionStorage.getItem('__mcyc_file_import_pending')) {
        sessionStorage.removeItem('__mcyc_file_import_pending');
        return;
      }

      try {
        const fileHandle = launchParams.files[0];
        const file = await fileHandle.getFile();
        if (!file.name.endsWith('.mcyc')) return;
        const content = await file.text();

        // Set flag before import (processImportedData will reload)
        sessionStorage.setItem('__mcyc_file_import_pending', '1');

        const { processImportedData } = await import(
          `../ui/cycleImportManager.js?v=${APP_VERSION}`
        );
        await processImportedData(content);
      } catch (e) {
        sessionStorage.removeItem('__mcyc_file_import_pending');
        console.error('File handling failed:', e);
      }
    });
  }

  return true;
}

/**
 * Production guard: If version.js failed to load on production, trigger cache recovery
 * This prevents running with mismatched cached modules
 * Uses shared cache recovery to prevent reload loops
 */
async function checkProductionVersionGuard() {
  const isProduction = location.hostname.includes('minicycle.app');
  const versionMissing = APP_VERSION === 'dev-local';

  if (isProduction && versionMissing) {
    console.error('❌ version.js failed to load on production - triggering cache recovery');
    return await attemptCacheRecovery('orchestrator-versionGuard');
  }

  return false; // No reload needed
}

/**
 * Main application initialization entry point.
 * Implements retry logic for resilient startup.
 *
 * Retry Strategy:
 * - First failure: Show retry message, wait, then retry
 * - Second failure: Show error with Lite version fallback option
 *
 * @returns {Promise<void>}
 */
async function initApp() {
  // Check production version guard first
  const needsReload = await checkProductionVersionGuard();
  if (needsReload) return;

  bootAttempt++;
  console.log(`🚀 Starting miniCycle initialization (attempt ${bootAttempt})...`);

  try {
    const success = await runBootSequence();
    if (success === false) return; // Reload initiated by core boot
  } catch (error) {
    const phase = error.message.includes('Phase') ? error.message.split(' timed')[0] : 'initialization';

    if (bootAttempt <= MAX_BOOT_RETRIES) {
      // Show retry message and try again
      showBootError(phase, error, true);
      console.log(`🔄 Retrying boot in ${BOOT_TIMEOUTS.RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, BOOT_TIMEOUTS.RETRY_DELAY));
      return initApp(); // Retry
    } else {
      if (isCacheError(error) && !isRecoveryExhausted()) {
        console.warn('🧹 Cache error after retries - attempting recovery');
        const recovered = await attemptCacheRecovery('orchestrator-bootFailure');
        if (recovered) return;
      }
      // Max retries exceeded - show final error with lite option
      showBootError(phase, error, false);
    }
  }
}

// Wait for service worker to be ready (prevents first-load import failures)
async function waitForServiceWorker(timeoutMs = 3000) {
  if (!('serviceWorker' in navigator)) return;

  // iOS kills SW when PWA is backgrounded. Offline, it needs more time to restart.
  const isOffline = !navigator.onLine;
  const effectiveTimeout = isOffline ? Math.max(timeoutMs, 8000) : timeoutMs;

  try {
    // navigator.serviceWorker.ready can hang on iOS offline — add a timeout
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SW ready timeout')), effectiveTimeout)
      )
    ]);

    // If there's a waiting worker, it means an update is pending - don't wait
    if (registration.waiting) {
      console.log('⚠️ SW update pending, proceeding with boot');
      return;
    }
    // If controller exists, SW is active and ready
    if (navigator.serviceWorker.controller) {
      console.log('✅ Service worker ready');
      return;
    }
    // Wait for controller to be set
    console.log(`⏳ Waiting for SW controller (offline: ${isOffline}, timeout: ${effectiveTimeout}ms)`);
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, effectiveTimeout);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timeout);
        console.log('✅ SW controller acquired');
        resolve();
      }, { once: true });
    });
  } catch (e) {
    console.warn('SW ready check failed:', e.message);
    // If offline and SW isn't ready, wait a bit more for iOS to spin it up
    if (isOffline && !navigator.serviceWorker.controller) {
      console.log('⏳ Offline with no SW controller, extra wait...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Run when DOM is ready - must load dependencies first (Safari memory cache fix)
async function startOrchestrator() {
  try {
    // Check if this reload was triggered by a routine import
    // If so, show "Importing routine..." instead of normal boot messages
    if (localStorage.getItem('miniCycle_importReloading')) {
      localStorage.removeItem('miniCycle_importReloading');
      loaderMessageOverride = getLabel('boot.importingRoutine');
    }

    // Show initial progress immediately
    updateLoaderProgress(getLabel('boot.connecting'), 2);

    // Wait for SW to be ready before importing modules
    await waitForServiceWorker();
    updateLoaderProgress(getLabel('boot.loadingModules'), 4);

    await loadDependencies();
    await initApp();
  } catch (error) {
    console.error('❌ Orchestrator failed to start:', error);
    // HTML fallback will redirect to lite version after timeout
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startOrchestrator);
} else {
  startOrchestrator();
}
