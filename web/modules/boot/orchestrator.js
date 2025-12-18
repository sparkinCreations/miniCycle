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
const APP_VERSION = '1.511';

/**
 * Main initialization - pure sequence controller
 */
async function initApp() {
  console.log('🚀 Starting miniCycle initialization...');

  // ========== LOAD BOOT MODULES ==========
  const coreBoot = await import(`./coreBoot.js?v=${APP_VERSION}`);
  const { initCoreBoot, initAppState } = coreBoot;

  const featureBoot = await import(`./featureBoot.js?v=${APP_VERSION}`);
  const { bootFeatures, bootEarlyDeps } = featureBoot;

  const uiBoot = await import(`./uiBoot.js?v=${APP_VERSION}`);
  const { initUIBoot } = uiBoot;

  // ========== CREATE DEPS CONTAINER ==========
  const deps = {
    utils: {}, features: {}, ui: {}, core: {}, task: {},
    cycle: {}, recurring: {}, progress: {}, storage: {}, testing: {}
  };

  // ========== PHASE 1: CORE ==========
  console.log('🔧 Phase 1: Core systems...');
  const coreResult = await initCoreBoot(deps);
  if (!coreResult) { console.log('⏳ Core boot initiated reload...'); return; }

  const { GlobalUtils } = coreResult;
  await bootEarlyDeps(deps, coreResult);
  await initAppState(deps, deps.utils.showNotification);
  console.log('✅ Phase 1 complete');

  // ========== PHASE 2: FEATURES ==========
  console.log('🔌 Phase 2: Feature modules...');
  await bootFeatures(deps, coreResult);

  // ✅ Use version param for cache-busting (like appInit pattern)
  const appContextMod = await import(`../core/appContext.js?v=${APP_VERSION}`);
  appContextMod.validateAllApisRegistered();
  console.log('✅ Phase 2 complete');

  // ========== PHASE 3: DATA & UI ==========
  console.log('🎨 Phase 3: Data & UI...');

  // Load app data
  const { getFixTaskValidationIssues } = appContextMod;
  getFixTaskValidationIssues()?.();
  await deps.core.initializeAppWithAutoMigration({ forceMode: true });

  // Initialize UI (single entrypoint - all DOM/listeners/finalization)
  await initUIBoot({ GlobalUtils, deps, appContextMod });

  console.log('✅ miniCycle initialization complete');
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
