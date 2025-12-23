/**
 * orchestrator.js - Boot Orchestration
 *
 * Pure sequence controller for miniCycle boot:
 *   Phase 1: coreBoot (AppState, GlobalUtils, migration)
 *   Phase 2: featureBoot (all feature modules)
 *   Phase 3: uiBoot (event listeners, UI finalization)
 *
 * This file only coordinates - no DI writes, no UI logic, no DOM queries.
 */

// Version constant - auto-updated by update-version.sh
const APP_VERSION = '1.543';

// Boot timeout configuration (in milliseconds)
const BOOT_TIMEOUTS = {
  MODULE_IMPORT: 10000,  // 10s for initial module imports
  PHASE_1: 15000,        // 15s for core boot
  PHASE_2: 20000,        // 20s for feature boot (largest phase)
  PHASE_3: 15000,        // 15s for UI boot
  TOTAL: 45000           // 45s total boot timeout
};

// Retry configuration
const MAX_BOOT_RETRIES = 1;
const LITE_VERSION_PATH = './lite/miniCycle-lite.html';
let bootAttempt = 0;

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
 * Show boot error to user with retry or lite fallback
 * @param {string} phase - Which phase failed
 * @param {Error} error - The error that occurred
 * @param {boolean} willRetry - Whether a retry will be attempted
 */
function showBootError(phase, error, willRetry = false) {
  console.error(`❌ Boot failed at ${phase} (attempt ${bootAttempt}):`, error);

  const container = document.getElementById('taskListContainer') || document.body;
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'padding:20px;text-align:center;color:#d32f2f;font-family:system-ui;';

  if (willRetry) {
    errorDiv.innerHTML = `
      <h2>⚠️ Loading Issue</h2>
      <p>miniCycle is having trouble loading (${phase})</p>
      <p style="font-size:14px;color:#666;">Retrying automatically...</p>
      <div style="margin-top:15px;">
        <div class="spinner" style="width:24px;height:24px;border:3px solid #ccc;border-top-color:#1976d2;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
  } else {
    errorDiv.innerHTML = `
      <h2>⚠️ App Loading Error</h2>
      <p>miniCycle failed to load after ${bootAttempt} attempt(s)</p>
      <p style="font-size:12px;color:#666;">${error.message}</p>
      <div style="margin-top:15px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button onclick="location.reload()" style="padding:10px 20px;cursor:pointer;border:1px solid #ccc;background:#fff;border-radius:4px;">
          Try Again
        </button>
        <button onclick="window.location.href='${LITE_VERSION_PATH}'" style="padding:10px 20px;cursor:pointer;border:none;background:#1976d2;color:#fff;border-radius:4px;">
          Use Lite Version
        </button>
      </div>
      <p style="font-size:11px;color:#999;margin-top:15px;">Lite version has fewer features but loads faster</p>
    `;
  }

  container.innerHTML = '';
  container.appendChild(errorDiv);
}

/**
 * Core boot sequence - separated for retry capability
 */
async function runBootSequence() {
  const bootStart = Date.now();

  // ========== LOAD BOOT MODULES (with timeout) ==========
  const [coreBoot, featureBoot, uiBoot] = await withTimeout(
    Promise.all([
      import(`./coreBoot.js?v=${APP_VERSION}`),
      import(`./featureBoot.js?v=${APP_VERSION}`),
      import(`./uiBoot.js?v=${APP_VERSION}`)
    ]),
    BOOT_TIMEOUTS.MODULE_IMPORT,
    'Module import'
  );

  const { initCoreBoot, initAppState } = coreBoot;
  const { bootFeatures, bootEarlyDeps } = featureBoot;
  const { initUIBoot } = uiBoot;

  // ========== CREATE DEPS CONTAINER ==========
  const deps = {
    utils: {}, features: {}, ui: {}, core: {}, task: {},
    cycle: {}, recurring: {}, progress: {}, storage: {}, testing: {}
  };

  // ========== PHASE 1: CORE (with timeout) ==========
  console.log('🔧 Phase 1: Core systems...');
  const coreResult = await withTimeout(
    initCoreBoot(deps),
    BOOT_TIMEOUTS.PHASE_1,
    'Phase 1 (Core)'
  );
  if (!coreResult) { console.log('⏳ Core boot initiated reload...'); return false; }

  const { GlobalUtils } = coreResult;
  await bootEarlyDeps(deps, coreResult);
  await initAppState(deps, deps.utils.showNotification);
  console.log(`✅ Phase 1 complete (${Date.now() - bootStart}ms)`);

  // ========== PHASE 2: FEATURES (with timeout) ==========
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
  console.log('🎨 Phase 3: Data & UI...');

  await withTimeout(
    (async () => {
      // Load app data
      const { getFixTaskValidationIssues } = appContextMod;
      getFixTaskValidationIssues()?.();
      await deps.core.initializeAppWithAutoMigration({ forceMode: true });

      // Initialize UI (single entrypoint - all DOM/listeners/finalization)
      await initUIBoot({ GlobalUtils, deps, appContextMod });
    })(),
    BOOT_TIMEOUTS.PHASE_3,
    'Phase 3 (UI)'
  );

  const totalTime = Date.now() - bootStart;
  console.log(`✅ miniCycle initialization complete (${totalTime}ms)`);
  return true;
}

/**
 * Main initialization with retry logic
 * - First failure: retry once
 * - Second failure: show error with lite version option
 */
async function initApp() {
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
      console.log(`🔄 Retrying boot in 1 second...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return initApp(); // Retry
    } else {
      // Max retries exceeded - show final error with lite option
      showBootError(phase, error, false);
    }
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
