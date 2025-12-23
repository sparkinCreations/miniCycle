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
const APP_VERSION = '1.539';

// Boot timeout configuration (in milliseconds)
const BOOT_TIMEOUTS = {
  MODULE_IMPORT: 10000,  // 10s for initial module imports
  PHASE_1: 15000,        // 15s for core boot
  PHASE_2: 20000,        // 20s for feature boot (largest phase)
  PHASE_3: 15000,        // 15s for UI boot
  TOTAL: 45000           // 45s total boot timeout
};

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
 * Show boot error to user (minimal DOM manipulation for critical errors)
 * @param {string} phase - Which phase failed
 * @param {Error} error - The error that occurred
 */
function showBootError(phase, error) {
  console.error(`❌ Boot failed at ${phase}:`, error);

  // Try to show user-friendly error
  const container = document.getElementById('taskListContainer') || document.body;
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'padding:20px;text-align:center;color:#d32f2f;font-family:system-ui;';
  errorDiv.innerHTML = `
    <h2>⚠️ App Loading Error</h2>
    <p>miniCycle failed to load (${phase})</p>
    <p style="font-size:12px;color:#666;">${error.message}</p>
    <button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">
      Reload App
    </button>
  `;
  container.innerHTML = '';
  container.appendChild(errorDiv);
}

/**
 * Main initialization - pure sequence controller
 */
async function initApp() {
  const bootStart = Date.now();
  console.log('🚀 Starting miniCycle initialization...');

  try {
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
    if (!coreResult) { console.log('⏳ Core boot initiated reload...'); return; }

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

  } catch (error) {
    showBootError(error.message.includes('Phase') ? error.message.split(' timed')[0] : 'initialization', error);
    throw error; // Re-throw for debugging
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
