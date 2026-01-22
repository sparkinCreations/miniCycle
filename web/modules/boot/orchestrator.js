/**
 * miniCycle Boot Orchestrator
 *
 * Pure sequence controller for the 3-phase boot process.
 * This file ONLY coordinates - no DI writes, no UI logic, no DOM queries.
 *
 * Boot Phases:
 * - Phase 1: coreBoot (AppState, GlobalUtils, migration)
 * - Phase 2: featureBoot (all feature modules)
 * - Phase 3: uiBoot (event listeners, UI finalization)
 *
 * Error Handling:
 * - Automatic retry on first failure
 * - Cache recovery for stale module issues
 * - Lite version fallback for persistent failures
 *
 * @module boot/orchestrator
 * @version 1.0.0
 * @see {@link module:boot/coreBoot} - Phase 1 implementation
 * @see {@link module:boot/featureBoot} - Phase 2 implementation
 * @see {@link module:boot/uiBoot} - Phase 3 implementation
 */

// ✅ Single source of truth: Read version from globalThis (set by version.js)
// Falls back to 'dev-local' for local development without version.js
const APP_VERSION = globalThis.APP_VERSION || 'dev-local';

// ═══════════════════════════════════════════════════════════════════════════
// SAFARI FIX: Use dynamic imports with version params to bypass memory cache
// Safari's memory cache sits ABOVE service workers and serves stale static imports.
// Converting to dynamic imports with ?v= params forces fresh fetches.
// ═══════════════════════════════════════════════════════════════════════════

// Module references (populated by loadDependencies)
let installDebugFilter, setDebugModeDependencies, refreshDebugState;
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

/**
 * Update loader text and progress bar
 * @param {string} message - Progress message to display
 * @param {number} percent - Progress percentage (0-100)
 */
function updateLoaderProgress(message, percent = 0) {
  const loaderText = document.querySelector('.loader-text');
  if (loaderText) {
    loaderText.textContent = message;
  }
  const loaderBar = document.querySelector('.loader-bar');
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
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${phaseName} timed out after ${ms}ms`)), ms)
    )
  ]);
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
      description: 'A cached file is outdated',
      suggestion: 'Clear browser cache and reload'
    };
  }

  // Network errors
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to load')) {
    return {
      description: 'Network connection issue',
      suggestion: 'Check your internet connection'
    };
  }

  // Timeout errors
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return {
      description: `${phase} took too long`,
      suggestion: 'Try again or use Lite version'
    };
  }

  // Storage errors
  if (msg.includes('localStorage') || msg.includes('storage') || msg.includes('quota')) {
    return {
      description: 'Storage access problem',
      suggestion: 'Clear site data in browser settings'
    };
  }

  // Default
  return {
    description: 'Something went wrong during startup',
    suggestion: 'Try refreshing or clearing cache'
  };
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
  const loader = document.getElementById('app-loader');
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
  const safePhase = escapeHtml(phase);

  if (willRetry) {
    loader.innerHTML = `
      <img src="assets/images/logo/minicycle_logo_icon.png" alt="miniCycle" class="loader-logo" width="120" height="96">
      <div class="loader-text" style="animation: none;">Having trouble loading...</div>
      <div style="margin-top: 8px; color: rgba(255,255,255,0.9); font-size: 13px;">${safeDescription}</div>
      <div style="margin-top: 10px; color: rgba(255,255,255,0.7); font-size: 14px;">Retrying automatically...</div>
    `;
  } else {
    // Check if this looks like a cache error
    const errorMsg = error?.message || '';
    const isCacheError = errorMsg.includes('Importing') || errorMsg.includes('module') || errorMsg.includes('binding name') || errorMsg.includes('export');

    loader.innerHTML = `
      <img src="assets/images/logo/minicycle_logo_icon.png" alt="miniCycle" width="120" height="96" style="object-fit: contain; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2)); animation: none;">
      <div style="margin-top: 20px; color: white; font-size: 18px; font-weight: 500; font-family: 'Inter', sans-serif;">Unable to Load</div>
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
        ${isCacheError ? `
        <button id="clear-cache-btn" style="padding: 12px 24px; cursor: pointer; border: none; background: #ff9800; color: white; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif; transition: all 0.2s;">
          🗑️ Clear Cache & Reload
        </button>
        ` : `
        <button onclick="location.reload()" style="padding: 12px 24px; cursor: pointer; border: 2px solid white; background: transparent; color: white; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif; transition: all 0.2s;">
          Try Again
        </button>
        `}
        <button onclick="window.location.href='${LITE_VERSION_PATH}'" style="padding: 12px 24px; cursor: pointer; border: none; background: white; color: #4c79ff; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif; transition: all 0.2s;">
          Use Lite Version
        </button>
      </div>
      <div style="margin-top: 12px; color: rgba(255,255,255,0.5); font-size: 11px;">
        Failed at: ${safePhase} (attempt ${bootAttempt})
      </div>
    `;

    // Add clear cache handler (uses shared utility)
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        clearCacheBtn.textContent = 'Clearing...';
        clearCacheBtn.disabled = true;

        try {
          await clearAllCaches();
          window.location.reload(true);
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
  const isRetry = bootAttemptNumber > 1;

  // ✅ On retry, append retry counter to version for cache busting
  // This forces fresh ES module loads, bypassing browser's module cache
  // Critical for clearing DI module state that persists in cached modules
  const versionSuffix = isRetry ? `${APP_VERSION}.r${bootAttemptNumber}` : APP_VERSION;

  // ========== CHECK FOR UPDATES ==========
  updateLoaderProgress('Checking for updates...', 5);
  // Service worker handles actual update check asynchronously
  // This step ensures version.js is loaded and ready

  // ========== LOAD BOOT MODULES (with timeout) ==========
  updateLoaderProgress('Loading core...', 15);
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
  updateLoaderProgress('Starting systems...', 30);
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

  // Wire AppState into storageUtils for quota caching
  setStorageDependencies({ AppState: deps.core.AppState });

  console.log(`✅ Phase 1 complete (${Date.now() - bootStart}ms)`);

  // ========== PHASE 2: FEATURES (with timeout) ==========
  updateLoaderProgress('Loading features...', 55);
  console.log('🔌 Phase 2: Feature modules...');
  await withTimeout(
    bootFeatures(deps, coreResult),
    BOOT_TIMEOUTS.PHASE_2,
    'Phase 2 (Features)'
  );

  // ✅ Use version param for cache-busting (like appInit pattern)
  const appContextMod = await import(`../core/appContext.js?v=${APP_VERSION}`);
  appContextMod.validateAllApisRegistered();
  console.log(`✅ Phase 2 complete (${Date.now() - bootStart}ms)`);

  // ========== PHASE 3: DATA & UI (with timeout) ==========
  updateLoaderProgress('Starting up...', 85);
  console.log('🎨 Phase 3: Data & UI...');

  await withTimeout(
    (async () => {
      // Load app data - fix any task validation issues first
      appContextMod.state?.()?.fixTaskValidationIssues?.();
      await deps.core.initializeAppWithAutoMigration({ forceMode: true });

      // Initialize UI (single entrypoint - all DOM/listeners/finalization)
      await initUIBoot({ GlobalUtils, deps, appContextMod });
    })(),
    BOOT_TIMEOUTS.PHASE_3,
    'Phase 3 (UI)'
  );

  updateLoaderProgress('Ready!', 100);
  const totalTime = Date.now() - bootStart;
  console.log(`✅ miniCycle initialization complete (${totalTime}ms)`);

  // Clear recovery flags on successful boot
  clearRecoveryFlags();

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
      // Max retries exceeded - show final error with lite option
      showBootError(phase, error, false);
    }
  }
}

// Wait for service worker to be ready (prevents first-load import failures)
async function waitForServiceWorker(timeoutMs = 3000) {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
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
    // Wait briefly for controller to be set
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, timeoutMs);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  } catch (e) {
    console.warn('SW ready check failed:', e);
  }
}

// Run when DOM is ready - must load dependencies first (Safari memory cache fix)
async function startOrchestrator() {
  try {
    // Show initial progress immediately
    updateLoaderProgress('Connecting...', 2);

    // Wait for SW to be ready before importing modules
    await waitForServiceWorker();
    updateLoaderProgress('Loading modules...', 4);

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
