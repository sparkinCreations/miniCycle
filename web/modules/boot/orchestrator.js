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

import { installDebugFilter, setDebugModeDependencies, refreshDebugState } from '../utils/debugMode.js';
import { BOOT_TIMEOUTS } from '../core/constants.js';
import {
  attemptCacheRecovery,
  clearAllCaches,
  clearRecoveryFlags,
  isRecoveryExhausted
} from './coreBoot.js';

// Install debug filter FIRST - before any other console.log calls
// Enable with: ?debug=true or localStorage.setItem('miniCycle_debug', 'true')
installDebugFilter();

// ✅ Single source of truth: Read version from globalThis (set by version.js)
// Falls back to 'dev-local' for local development without version.js
const APP_VERSION = globalThis.APP_VERSION || 'dev-local';

// Retry configuration
const MAX_BOOT_RETRIES = 1;
const LITE_VERSION_PATH = './lite/miniCycle-lite.html';
let bootAttempt = 0;

/**
 * Update loader text to show boot progress
 * @param {string} message - Progress message to display
 */
function updateLoaderProgress(message) {
  const loaderText = document.querySelector('.loader-text');
  if (loaderText) {
    loaderText.textContent = message;
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
 * Core boot sequence - separated for retry capability
 */
async function runBootSequence() {
  const bootStart = Date.now();

  // ========== LOAD BOOT MODULES (with timeout) ==========
  updateLoaderProgress('Loading core...');
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
  updateLoaderProgress('Starting systems...');
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

  // Wire AppState into debugMode for state-based persistence
  setDebugModeDependencies({ AppState: deps.core.AppState });
  refreshDebugState();

  console.log(`✅ Phase 1 complete (${Date.now() - bootStart}ms)`);

  // ========== PHASE 2: FEATURES (with timeout) ==========
  updateLoaderProgress('Loading features...');
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
  updateLoaderProgress('Starting up...');
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
 * Main initialization with retry logic
 * - First failure: retry once
 * - Second failure: show error with lite version option
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

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
