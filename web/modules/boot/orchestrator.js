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

import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { isNativeApp } from '../platform/capacitorBridge.js';
import { goToLiteVersion } from '../utils/liteVersion.js';

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
let setStorageDependencies, getLocalStorageUsedBytesFn, getLocalStorageQuotaFn;
let BOOT_TIMEOUTS;
let attemptCacheRecovery, clearAllCaches, clearRecoveryFlags, isRecoveryExhausted;

// Emergency fallback if constants.js fails to load or lacks BOOT_TIMEOUTS —
// keep values in sync with BOOT_TIMEOUTS in core/constants.js.
const FALLBACK_BOOT_TIMEOUTS = Object.freeze({
  MODULE_IMPORT: 10000,
  PHASE_1: 15000,
  PHASE_2: 30000,
  PHASE_3: 15000,
  TOTAL: 60000,
  RETRY_DELAY: 2000,
  IDB_OPERATION: 3000,
  VERSION_GATE: 1500
});

// ✅ FIX: Shared deps container that persists across boot retries
// Creating fresh deps on each retry breaks DI closures that capture deps reference
let deps = null;

// ═══════════════════════════════════════════════════════════════════════════
// BOOT TIMING INSTRUMENTATION
// Lightweight performance.mark/measure wrappers so real devices (especially
// slow ones) can report exactly WHERE boot time goes — fetch vs core vs
// features vs UI. Read results via window.getMiniCycleBootTiming(), which the
// in-browser testing modal surfaces.
//
// Marks are timestamped relative to navigation start (timeOrigin), so the very
// first mark already includes the pre-orchestrator cold-cache/precache window —
// which dominates first loads. These are internal diagnostic identifiers (not
// user-tunable knobs), so they live here rather than in constants.js.
// ═══════════════════════════════════════════════════════════════════════════
const BOOT_MARKS = Object.freeze({
  START: 'mc:boot:start',
  MODULES_LOADED: 'mc:boot:modules-loaded',
  PHASE1_DONE: 'mc:boot:phase1-done',
  PHASE2_DONE: 'mc:boot:phase2-done',
  INTERACTIVE: 'mc:boot:interactive'
});
const BOOT_MEASURES = Object.freeze({
  MODULE_IMPORT: 'mc:phase:module-import',
  CORE: 'mc:phase:core',
  FEATURES: 'mc:phase:features',
  UI: 'mc:phase:ui',
  TOTAL: 'mc:boot:total'
});

function markBoot(name) {
  try { performance.mark(name); } catch (_) { /* perf API unavailable */ }
}
function measureBoot(name, startMark, endMark) {
  // Throws if either mark is missing (e.g. boot aborted mid-phase) — swallow it.
  try { performance.measure(name, startMark, endMark); } catch (_) { /* marks missing */ }
}
// Per-phase module-load measures emitted by loadAllModules() in moduleLoader.js,
// named `mc:subphase:<PHASE_NAME>` (+ `:start` marks). Read here by prefix so the
// two files stay decoupled — orchestrator never imports the PHASES enum.
const SUBPHASE_PREFIX = 'mc:subphase:';
// Per-module measures emitted by loadModule/loadPhase in moduleLoader.js, named
// `mc:module:<name>:import` and `mc:module:<name>:init` (+ `:start` marks).
const MODULE_PREFIX = 'mc:module:';

function clearBootTiming() {
  // Wipe prior-attempt entries so a retry's timing isn't read as the first attempt's.
  try {
    Object.values(BOOT_MARKS).forEach(m => performance.clearMarks(m));
    Object.values(BOOT_MEASURES).forEach(m => performance.clearMeasures(m));
    // Sub-phase and per-module marks/measures use dynamic names — clear by prefix.
    performance.getEntriesByType('mark')
      .forEach(e => { if (e.name.startsWith(SUBPHASE_PREFIX) || e.name.startsWith(MODULE_PREFIX)) performance.clearMarks(e.name); });
    performance.getEntriesByType('measure')
      .forEach(e => { if (e.name.startsWith(SUBPHASE_PREFIX) || e.name.startsWith(MODULE_PREFIX)) performance.clearMeasures(e.name); });
  } catch (_) { /* perf API unavailable */ }
}

/**
 * Read boot phase timings from the performance buffer.
 * Exposed as window.getMiniCycleBootTiming() for the in-browser testing modal.
 * Safe to call any time after boot; returns nulls for phases that didn't record.
 * @returns {object} Phase breakdown in milliseconds.
 */
function getBootTiming() {
  const dur = (name) => {
    const e = performance.getEntriesByName(name, 'measure').pop();
    return e ? Math.round(e.duration) : null;
  };
  const at = (name) => {
    const e = performance.getEntriesByName(name, 'mark').pop();
    return e ? Math.round(e.startTime) : null;
  };
  // Per-phase module-load breakdown of the dominant `features` window. Prefix-scan
  // the measures (last entry per name wins, so a boot retry reads the latest attempt)
  // and key the result by the short phase name (e.g. UI_MANAGERS_ms).
  const subPhases = {};
  try {
    const byName = new Map();
    performance.getEntriesByType('measure').forEach(e => {
      if (e.name.startsWith(SUBPHASE_PREFIX)) byName.set(e.name, e); // last wins
    });
    byName.forEach((e, name) => {
      subPhases[name.slice(SUBPHASE_PREFIX.length) + '_ms'] = Math.round(e.duration);
    });
  } catch (_) { /* perf API unavailable */ }
  // Per-module breakdown, ranked by cost. init_ms is exact and additive (Stage 2 is
  // sequential; includes DI-wiring + init()). import_ms values OVERLAP within a phase
  // (parallel Promise.all) — use them to rank heavy parses, never to sum.
  const moduleTimings = [];
  try {
    const byModule = new Map();
    performance.getEntriesByType('measure').forEach(e => {
      if (!e.name.startsWith(MODULE_PREFIX)) return;
      const rest = e.name.slice(MODULE_PREFIX.length);           // '<name>:import' | '<name>:init'
      const sep = rest.lastIndexOf(':');
      const modName = rest.slice(0, sep);
      const kind = rest.slice(sep + 1);
      const entry = byModule.get(modName) || { name: modName, import_ms: null, init_ms: null, at_ms: null };
      entry[kind + '_ms'] = Math.round(e.duration);              // last wins per name
      // Import start time (since navigation) — an at_ms after boot-interactive
      // marks an on-demand (deferred) load rather than boot cost.
      if (kind === 'import') entry.at_ms = Math.round(e.startTime);
      byModule.set(modName, entry);
    });
    byModule.forEach(entry => {
      entry.total_ms = (entry.import_ms || 0) + (entry.init_ms || 0);
      moduleTimings.push(entry);
    });
    moduleTimings.sort((a, b) => b.total_ms - a.total_ms);
  } catch (_) { /* perf API unavailable */ }
  // First-run choice-screen perception metrics (only present when the screen was
  // shown — a brand-new user). Marks are set by the inline controller in
  // miniCycle.html. perceivedWait = how long the user actually waited AFTER
  // picking; ~0 (or bootDoneBeforeTap true) means boot finished while they read.
  let firstRun = null;
  try {
    const shownAt = at('mc:firstrun:choiceShown');
    if (shownAt != null) {
      const tappedAt = at('mc:firstrun:choiceTapped');
      const interactiveAt = at(BOOT_MARKS.INTERACTIVE);
      firstRun = {
        choiceShownAt_ms: shownAt,
        choiceTappedAt_ms: tappedAt,
        decisionTime_ms: (tappedAt != null) ? tappedAt - shownAt : null,
        perceivedWait_ms: (tappedAt != null && interactiveAt != null) ? Math.max(0, interactiveAt - tappedAt) : null,
        bootDoneBeforeTap: (tappedAt != null && interactiveAt != null) ? interactiveAt <= tappedAt : null
      };
    }
  } catch (_) { /* perf API unavailable */ }
  return {
    // ms from navigation start (timeOrigin) until app interactive — includes the
    // pre-orchestrator cold-cache/precache window, which dominates first loads.
    interactiveSinceNavigation_ms: at(BOOT_MARKS.INTERACTIVE),
    // when runBootSequence() actually started, relative to navigation start.
    bootStartSinceNavigation_ms: at(BOOT_MARKS.START),
    phases: {
      moduleImport_ms: dur(BOOT_MEASURES.MODULE_IMPORT),
      core_ms: dur(BOOT_MEASURES.CORE),
      features_ms: dur(BOOT_MEASURES.FEATURES),
      ui_ms: dur(BOOT_MEASURES.UI)
    },
    // Breakdown of features_ms by module-load phase (CORE_UTILS … TESTING).
    featuresByPhase: subPhases,
    // Per-module {name, import_ms, init_ms, total_ms}, ranked by total_ms desc.
    // init_ms is exact/additive; import_ms overlaps within a phase (rank-only).
    moduleTimings,
    // Choice-screen perception metrics, or null for returning users.
    firstRun,
    // total time spent inside runBootSequence() (start → interactive).
    bootSequence_ms: dur(BOOT_MEASURES.TOTAL)
  };
}

if (typeof window !== 'undefined') {
  window.getMiniCycleBootTiming = getBootTiming;
}

// Load all dependencies with version params (Safari memory cache fix)
async function loadDependencies() {

  try {
    const [debugMod, storageMod, constantsMod, coreBootMod] = await Promise.all([
      import(`../utils/debugMode.js?v=${APP_VERSION}`),
      import(`../utils/storageUtils.js?v=${APP_VERSION}`),
      import(`../core/constants.js?v=${APP_VERSION}`),
      import(`./coreBoot.js?v=${APP_VERSION}`)
    ]);

    // Assign from debugMode
    installDebugFilter = debugMod.installDebugFilter;
    setDebugModeDependencies = debugMod.setDebugModeDependencies;
    refreshDebugState = debugMod.refreshDebugState;
    enableDebugFn = debugMod.enableDebug;
    disableDebugFn = debugMod.disableDebug;
    isDebugFn = debugMod.isDebug;

    // Assign from storageUtils
    setStorageDependencies = storageMod.setStorageDependencies;
    getLocalStorageUsedBytesFn = storageMod.getLocalStorageUsedBytes;
    getLocalStorageQuotaFn = storageMod.getLocalStorageQuota;

    // Assign from constants - with validation
    BOOT_TIMEOUTS = constantsMod.BOOT_TIMEOUTS;
    if (!BOOT_TIMEOUTS) {
      console.error('❌ BOOT_TIMEOUTS not found in constants.js exports!');
      console.error('   Available exports:', Object.keys(constantsMod));
      // Use fallback values to prevent crash
      BOOT_TIMEOUTS = FALLBACK_BOOT_TIMEOUTS;
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

  } catch (error) {
    console.error('❌ Failed to load orchestrator dependencies:', error);
    // Use fallback BOOT_TIMEOUTS to allow boot to continue
    BOOT_TIMEOUTS = FALLBACK_BOOT_TIMEOUTS;
    throw error; // Re-throw to trigger error handling
  }
}

// Retry configuration
const MAX_BOOT_RETRIES = 1;
let bootAttempt = 0;

// If set, overrides all boot progress messages (e.g., during routine import reload)
let loaderMessageOverride = null;

/**
 * Inject a boot-time modal template only once across in-page retries.
 * Retries reuse the same document, so blindly reinserting templates creates
 * duplicate IDs and stale node bindings.
 *
 * @param {string} anchorId - Existing element used as insertion anchor
 * @param {string} modalId - Root ID of the template being injected
 * @param {string} templateHtml - HTML template to inject
 */
function ensureBootModalTemplate(anchorId, modalId, templateHtml) {
  if (document.getElementById(modalId)) {
    return;
  }

  const anchor = document.getElementById(anchorId);
  if (!anchor) {
    console.warn(`⚠️ Boot modal anchor not found: #${anchorId}`);
    return;
  }

  anchor.insertAdjacentHTML('beforebegin', templateHtml);
}

/**
 * Update loader text and progress bar
 * @param {string} message - Progress message to display
 * @param {number} percent - Progress percentage (0-100)
 */
function updateLoaderProgress(message, percent = 0) {
  const text = loaderMessageOverride || message;
  const loaderText = document.querySelector(DOM_SELECTORS.LOADER_TEXT);
  if (loaderText) {
    loaderText.textContent = text;
  }
  const loaderBar = document.querySelector(DOM_SELECTORS.LOADER_BAR);
  if (loaderBar) {
    loaderBar.style.transform = `scaleX(${percent / 100})`;
  }
  // Mirror into the first-run choice screen's low-key bottom-right status.
  // The centered .loader-text is hidden there, so this keeps live boot progress
  // visible while the user reads the choices. No-op on the normal splash.
  const status = document.getElementById('first-run-status');
  if (status) {
    status.textContent = text;
  }
  // Drive the first-run bottom progress bar from the SAME real percent — honest
  // progress (moves in real boot steps: 2→4→5→15→30→55→85→100), not a timed
  // creep. If boot stalls on a phase, the bar sits there — diagnostic, not fake.
  const bottomFill = document.querySelector('.first-run-bottom-fill');
  if (bottomFill) {
    bottomFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
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

  // Offline-specific errors — check BEFORE cache errors because the SW's 504
  // "Module not available offline: ..." contains "module", matching the cache path
  if (!navigator.onLine) {
    if (msg.includes('offline') || msg.includes('module') || msg.includes('Module') ||
        msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to load')) {
      return {
        description: getLabel('boot.errorOffline'),
        suggestion: getLabel('boot.suggestReconnect')
      };
    }
  }

  // Cache/import errors (only reached when online)
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
 * Replace the boot-error UI with a friendly "Updating to latest version..."
 * overlay during automatic cache recovery. Called immediately before
 * `attemptCacheRecovery()` so the user sees a clear, non-alarming explanation
 * for the brief moment between cache clear and reload (typically <1s, longer
 * on slow networks).
 *
 * The recovery itself triggers a full page reload, so this DOM is replaced
 * shortly after — no listener cleanup needed.
 * @returns {void}
 */
function showUpdatingOverlay() {
  const loader = document.getElementById(DOM_IDS.APP_LOADER);
  if (!loader) return;

  loader.style.display = 'flex';
  loader.classList.remove(DOM_CLASSES.FADE_OUT);

  const headline = escapeHtml(getLabel('boot.updatingToLatest'));
  const detail   = escapeHtml(getLabel('boot.updatingDetail'));

  loader.innerHTML = `
    <img src="assets/images/logo/minicycle_logo_icon.png" alt="miniCycle" class="loader-logo" width="120" height="96">
    <div class="loader-text" style="animation: none; margin-top: 16px;">${headline}</div>
    <div style="margin-top: 8px; color: rgba(255,255,255,0.75); font-size: 13px;">${detail}</div>
  `;
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
  loader.classList.remove(DOM_CLASSES.FADE_OUT);

  const { description, suggestion } = getErrorDetails(error, phase);
  const shortError = (error?.message || 'Unknown error').substring(0, 80);

  // Escape dynamic values to prevent XSS
  const safeDescription = escapeHtml(description);
  const safeSuggestion = escapeHtml(suggestion);
  const safeShortError = escapeHtml(shortError);

  if (willRetry) {
    // Include diagnostic details so user can screenshot on iOS
    const diagOnline = navigator.onLine ? 'online' : 'offline';
    const diagSW = navigator.serviceWorker?.controller ? 'SW:active' : 'SW:none';
    const diagTime = typeof performance !== 'undefined' ? Math.round(performance.now()) + 'ms' : '?';
    const diagError = escapeHtml((error?.message || 'Unknown').substring(0, 120));
    const diagPhase = escapeHtml(phase);

    loader.innerHTML = `
      <img src="assets/images/logo/minicycle_logo_icon.png" alt="miniCycle" class="loader-logo" width="120" height="96">
      <div class="loader-text" style="animation: none;">${escapeHtml(getLabel('boot.havingTrouble'))}</div>
      <div style="margin-top: 8px; color: rgba(255,255,255,0.9); font-size: 13px;">${safeDescription}</div>
      <div style="margin-top: 10px; color: rgba(255,255,255,0.7); font-size: 14px;">${escapeHtml(getLabel('boot.retrying'))}</div>
      <div style="margin-top: 16px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 6px; color: rgba(255,255,255,0.7); font-size: 10px; font-family: monospace; max-width: 300px; word-break: break-word; text-align: left;">
        Phase: ${diagPhase} | ${diagOnline} | ${diagSW} | ${diagTime}<br>
        Error: ${diagError}
      </div>
    `;
  } else {
    // Check if this looks like a cache error — only show destructive "Clear Cache"
    // button when online (offline, clearing caches destroys the only available files)
    const isCacheErrorMatch = isCacheError(error) && navigator.onLine;

    // Diagnostic info for iOS debugging (visible in screenshots)
    const finalDiagOnline = navigator.onLine ? 'online' : 'offline';
    const finalDiagSW = navigator.serviceWorker?.controller ? 'SW:active' : 'SW:none';
    const finalDiagTime = typeof performance !== 'undefined' ? Math.round(performance.now()) + 'ms' : '?';
    const finalDiagError = escapeHtml((error?.message || 'Unknown').substring(0, 200));
    const finalDiagPhase = escapeHtml(phase);

    loader.innerHTML = `
      <img src="assets/images/logo/minicycle_logo_icon.png" alt="miniCycle" width="120" height="96" style="object-fit: contain; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2)); animation: none;">
      <div style="margin-top: 20px; color: white; font-size: 18px; font-weight: 500; font-family: 'Inter', sans-serif;">${escapeHtml(getLabel('boot.unableToLoad'))}</div>
      <div style="margin-top: 8px; color: rgba(255,255,255,0.9); font-size: 14px; max-width: 300px; text-align: center;">
        ${safeDescription}
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
      <div style="margin-top: 14px; display: flex; gap: 16px; justify-content: center;">
        ${hasBackupableData() ? `
        <button id="boot-backup-btn" style="padding: 8px 14px; cursor: pointer; border: 1px solid rgba(255,255,255,0.5); background: transparent; color: white; border-radius: 8px; font-size: 13px; font-family: 'Inter', sans-serif;">
          💾 ${escapeHtml(getLabel('boot.backupData'))}
        </button>
        ` : ''}
        <button id="boot-report-btn" style="padding: 8px 14px; cursor: pointer; border: 1px solid rgba(255,255,255,0.5); background: transparent; color: white; border-radius: 8px; font-size: 13px; font-family: 'Inter', sans-serif;">
          📧 ${escapeHtml(getLabel('boot.reportProblem'))}
        </button>
      </div>
      <div style="margin-top: 12px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 6px; color: rgba(255,255,255,0.7); font-size: 10px; font-family: monospace; max-width: 300px; word-break: break-word; text-align: left;">
        Phase: ${finalDiagPhase} | ${finalDiagOnline} | ${finalDiagSW} | ${finalDiagTime}<br>
        Attempt: ${bootAttempt} | v${escapeHtml(APP_VERSION || '?')}<br>
        Error: ${finalDiagError}
      </div>
    `;

    // Add button handlers (uses addEventListener instead of inline onclick)
    const tryAgainBtn = document.getElementById('try-again-btn');
    tryAgainBtn?.addEventListener('click', () => location.reload());

    // Backup: works even though boot failed — reads localStorage directly, no
    // module machinery. See INCIDENT_service-worker-stale-cache.md §6a.
    const backupBtn = document.getElementById('boot-backup-btn');
    backupBtn?.addEventListener('click', () => {
      try {
        const count = downloadDataBackup();
        backupBtn.textContent = '✅ ' + getLabel('boot.backupSaved', { vars: { count } });
        backupBtn.disabled = true;
      } catch (err) {
        console.error('Backup failed:', err);
        backupBtn.textContent = '⚠️ ' + getLabel('boot.backupFailed');
      }
    });

    // Crash report: diagnostics ONLY (never user data) via mailto — zero
    // infrastructure, works from a broken boot. §6b.
    const reportBtn = document.getElementById('boot-report-btn');
    reportBtn?.addEventListener('click', () => {
      const subject = `miniCycle boot failure report (v${APP_VERSION})`;
      const body = [
        'Auto-generated diagnostic from the boot error screen.',
        'No routine/task data is included.',
        '',
        `Phase: ${phase}`,
        `Error: ${(error?.message || 'Unknown').substring(0, 300)}`,
        `Version: ${APP_VERSION} | Attempt: ${bootAttempt}`,
        `Online: ${navigator.onLine} | SW controlling: ${!!navigator.serviceWorker?.controller}`,
        `UA: ${navigator.userAgent}`,
        `Time: ${new Date().toISOString()}`,
      ].join('\n');
      const mailtoUrl = 'mailto:sparkintechproductions@gmail.com?subject=' +
        encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      reportBtn.dataset.mailto = mailtoUrl; // inspectable (location.href is unforgeable in tests)
      location.href = mailtoUrl;
    });

    const liteBtn = document.getElementById('lite-version-btn');
    liteBtn?.addEventListener('click', () => goToLiteVersion({ params: { fallback: 'true' }, reason: 'boot-failure UI' }));

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

// ═══════════════════════════════════════════════════════════════════════════
// DATA BACKUP FROM THE ERROR SCREEN (INCIDENT_service-worker-stale-cache.md §6a)
// All user data is plain localStorage, available even when boot failed — so a
// stranded user can save their routines BEFORE trying destructive recovery
// (clear cache / reinstall). Restore lives on the first-run choice screen.
// ═══════════════════════════════════════════════════════════════════════════

// Non-prefixed legacy keys that belong to miniCycle (see STORAGE_KEYS in
// constants.js — not imported here so backup works independent of module state).
const BACKUP_EXTRA_KEYS = ['lastUsedMiniCycle', 'milestoneUnlocks', 'darkModeEnabled', 'currentTheme'];

function collectBackupEntries() {
  const entries = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.indexOf('miniCycle') === 0 || key.indexOf('__miniCycle') === 0 || BACKUP_EXTRA_KEYS.includes(key))) {
      entries[key] = localStorage.getItem(key); // raw strings — never parse/rewrite
    }
  }
  return entries;
}

function hasBackupableData() {
  try { return !!localStorage.getItem('miniCycleData') || Object.keys(collectBackupEntries()).length > 0; }
  catch (_) { return false; }
}

/** Download all miniCycle localStorage keys as a JSON file. @returns {number} key count */
function downloadDataBackup() {
  const keys = collectBackupEntries();
  const payload = {
    type: 'miniCycle-backup',
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    keys,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `minicycle-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return Object.keys(keys).length;
}

/**
 * Bounded pre-boot version gate (resilience for stale clients).
 *
 * A user on a cached old build can request a module path that was renamed or
 * removed in a newer deploy. If the NEW service worker has already claimed, that
 * request 404s and the dynamic import HARD-FAILS — landing on the boot-error
 * screen instead of gracefully updating. verifyVersionFresh() in miniCycle.html
 * catches server-ahead mismatches, but it runs in PARALLEL with boot and can lose
 * the race against the feature-module imports.
 *
 * This GATES the feature-load phase: if the server is ahead, clear caches and
 * reload to the fresh build BEFORE importing any (possibly-renamed) feature module.
 *
 * - Fail-open: offline / timeout / malformed version.js → resolve and boot from
 *   cache (a working stale app beats a blocked one).
 * - ≈Free on the happy path: the caller kicks this off early so the tiny no-store
 *   fetch overlaps the boot-module imports + Phase 1, then awaits it before Phase 2.
 * - Loop-safe: mirrors the __miniCycle_lastVersion / __miniCycle_justCleared guards
 *   used by the inline early-version check and verifyVersionFresh().
 *
 * @param {number} timeoutMs - Max wait for the version fetch before failing open.
 * @returns {Promise<void>} Resolves when boot may proceed; never resolves if it reloads.
 */
async function gateOnServerVersion(timeoutMs) {
  try {
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const fetchText = fetch(`./version.js?_cb=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    }).then((r) => r.text()).catch(() => null);

    const text = await Promise.race([fetchText, timeout]);
    if (!text) return; // timeout or fetch error → fail open, boot from cache

    const match = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    const serverVersion = match ? match[1] : null;
    if (!serverVersion || serverVersion === APP_VERSION) return; // fresh (or unknown) → proceed

    // Server is ahead — the loaded build is stale. Loop guard: if we already
    // cleared for this exact server version this session, the reload didn't take
    // (e.g. CDN still serving old) — proceed rather than spin on reloads.
    try {
      if (sessionStorage.getItem('__miniCycle_justCleared') === serverVersion) {
        console.warn(`⚠️ Version gate: already cleared for v${serverVersion} this session — proceeding to avoid a reload loop`);
        return;
      }
      localStorage.setItem('__miniCycle_lastVersion', serverVersion);
      sessionStorage.setItem('__miniCycle_justCleared', serverVersion);
    } catch (_) { /* storage unavailable — still attempt the reload */ }

    console.warn(`🔄 Pre-boot version gate: loaded=${APP_VERSION}, server=${serverVersion} — clearing caches and reloading to the fresh build`);
    // Swap the boot splash for the friendly "Updating to latest version…" overlay so
    // the gate-triggered reload reads as a deliberate update, not a glitchy flash —
    // consistent with the isCacheError recovery path which shows the same overlay.
    try { showUpdatingOverlay(); } catch (_) { /* loader missing — proceed to reload */ }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) { /* cache clear is best-effort */ }

    window.location.href = window.location.pathname + '?_cb=' + Date.now();
    // Block here — the page is navigating. Never let boot continue on stale code
    // and hit a renamed-module 404 before the reload takes effect.
    await new Promise(() => {});
  } catch (err) {
    console.warn('Pre-boot version gate failed (proceeding):', err);
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

  // 🧬 Boot generation: a timed-out phase keeps running (withTimeout can't
  // cancel it). Bumping the generation FIRST makes the zombie attempt abort at
  // its next moduleLoader checkpoint instead of racing this attempt's writes
  // into the shared deps container (July 2026 boot audit, C2).
  globalThis.__miniCycleBootGeneration = (globalThis.__miniCycleBootGeneration || 0) + 1;

  // ⏱️ Boot timing: wipe any prior-attempt marks, then anchor the start.
  clearBootTiming();
  markBoot(BOOT_MARKS.START);

  // ✅ Version suffix strategy for imports:
  // - Online retry: append retry counter for cache busting (clears stale DI state)
  // - Offline retry: DROP version param entirely — use browser HTTP cache
  //   iOS kills the PWA's service worker after the app is backgrounded. When the
  //   user reopens offline, the SW may not restart. Without ?v=, the import URL
  //   matches what the browser cached during previous online sessions, so the
  //   browser's HTTP cache serves the file even without the SW.
  // - Normal (first attempt): use APP_VERSION for SW cache matching
  // Bundled dist (__MC_MODULE_MAP present): hashed filenames ARE the version,
  // so the first attempt imports BARE mapped URLs — matching the modulepreload
  // hints and the SW precache keys (no double-fetch). Retries still append a
  // ?v= suffix ON TOP of the mapped URL (the build keeps the `${vParam}` tail
  // for this file) because the retry teardown depends on distinct URLs yielding
  // fresh module instances. Offline retries keep the suffix too: hashed files
  // are served cache-first by the SW regardless of query, so no network needed.
  const hasModuleMap = !!globalThis.__MC_MODULE_MAP;
  let versionSuffix;
  if (isRetry && (navigator.onLine || hasModuleMap)) {
    versionSuffix = `${APP_VERSION}.r${bootAttempt}`;
  } else if (isRetry) {
    versionSuffix = ''; // Drop version — use browser HTTP cache
  } else {
    versionSuffix = APP_VERSION;
  }
  const vParam = (hasModuleMap && !isRetry) ? '' : (versionSuffix ? `?v=${versionSuffix}` : '');

  // ⛔ Kick off the pre-boot version gate NOW (non-blocking) so its tiny no-store
  // fetch overlaps the boot-module imports + Phase 1 — ≈free on a healthy network.
  // Awaited just before Phase 2, below. Skipped on retry: the retry path already
  // does its own cache-busting (.r suffix) + teardown, and a gate reload mid-retry
  // would fight it. Offline fails open fast (fetch rejects → null), so no special-case.
  const versionGate = isRetry
    ? Promise.resolve()
    : gateOnServerVersion(BOOT_TIMEOUTS.VERSION_GATE);

  // ========== CHECK FOR UPDATES ==========
  updateLoaderProgress(getLabel('boot.checkingUpdates'), 5);
  // Service worker handles actual update check asynchronously
  // This step ensures version.js is loaded and ready

  // ========== LOAD BOOT MODULES (with timeout) ==========
  updateLoaderProgress(getLabel('boot.loadingCore'), 15);
  const importStart = Date.now();
  const [coreBoot, featureBoot, uiBoot] = await withTimeout(
    Promise.all([
      import(`./coreBoot.js${vParam}`),
      import(`./featureBoot.js${vParam}`),
      import(`./uiBoot.js${vParam}`)
    ]),
    BOOT_TIMEOUTS.MODULE_IMPORT,
    'Module import'
  );

  markBoot(BOOT_MARKS.MODULES_LOADED); // ⏱️ boot coordinators fetched + parsed

  const { initCoreBoot, initAppState } = coreBoot;
  const { bootFeatures, bootEarlyDeps } = featureBoot;
  const { initUIBoot } = uiBoot;

  // Import moduleLoader to clear cache on retry. Even though this retry-suffixed
  // URL yields a FRESH moduleLoader instance, the module registries live on
  // globalThis.__miniCycleModuleRegistry (shared across instances), so
  // destroyAllModules()/clearLoadedModules() below reach attempt 1's modules.
  const { clearLoadedModules, destroyAllModules } = await import(`./moduleLoader.js${vParam}`);

  // Import appInit to reset its state on retry
  const { appInit } = await import(`../core/appInit.js${vParam}`);

  // ========== CREATE/REUSE DEPS CONTAINER ==========
  // Reuse deps across retries to preserve DI closure references AND module state
  if (!deps) {
    deps = {
      utils: {}, features: {}, ui: {}, core: {}, task: {},
      cycle: {}, recurring: {}, progress: {}, storage: {}, testing: {}
    };
  } else {
    // ✅ Destroy all module instances before clearing cache (listeners, timers, etc.)
    destroyAllModules();

    // ✅ CRITICAL FIX: Clear module loader cache on retry
    // Cached modules have DI closures that captured the old deps from attempt 1
    // We need to reload all modules so they get fresh closures with the current deps
    clearLoadedModules();

    // ✅ CRITICAL FIX 3: Reset appInit state on retry
    // appInit singleton persists across retries with stale coreReady/appReady flags
    appInit.reset();

    // ✅ CRITICAL FIX 4: Tear down old AppState before clearing deps
    // On retry, coreBoot re-imports appState.js with a new version suffix, creating
    // a fresh module instance with its own singleton. The old instance's global
    // beforeunload/storage listeners must be removed here, before deps.core is cleared.
    deps.core?.AppState?.destroy?.();

    // ✅ Root-cause guard for the broken `?.AppState` pattern: null the reference the
    // instant it's destroyed. destroy() does NOT clear the instance's `data`, so until
    // the delete loop below runs the AppState Proxy would still resolve `.get()` to the
    // destroyed instance and hand back stale data. Nulling it here makes the Proxy fall
    // through to its safe no-op path for the entire teardown→rebuild window, which is
    // what the ~287 `AppState?.get()` guards across the codebase expect to happen.
    if (deps.core) deps.core.AppState = null;

    // ✅ CRITICAL FIX 2: Clear nested objects to prevent stale references
    // On retry, we need to rebuild all deps from scratch so Proxy getters work correctly
    // IMPORTANT: We must CLEAR properties, not replace objects, because moduleLoader
    // creates Proxies with closures that capture deps.core reference
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
  const coreResult = await withTimeout(
    initCoreBoot(deps, versionSuffix),
    BOOT_TIMEOUTS.PHASE_1,
    'Phase 1 (Core)'
  );
  if (!coreResult) { return false; }

  const { GlobalUtils } = coreResult;
  await bootEarlyDeps(deps, coreResult);
  await initAppState(deps, deps.utils.showNotification);

  markBoot(BOOT_MARKS.PHASE1_DONE); // ⏱️ AppState + core ready

  // Wire AppState + diagnostic deps into debugMode
  setDebugModeDependencies({
      AppState: deps.core.AppState,
      getLocalStorageUsedBytes: getLocalStorageUsedBytesFn,
      getLocalStorageQuota: getLocalStorageQuotaFn,
      AppGlobalState: deps.core.AppGlobalState,
      FeatureFlags: deps.core.FeatureFlags
  });
  refreshDebugState();

  // Store versioned debug functions in deps for DI chain
  // (settingsUIManager needs these from the versioned instance, not a bare import)
  deps.utils.enableDebug = enableDebugFn;
  deps.utils.disableDebug = disableDebugFn;
  deps.utils.isDebug = isDebugFn;

  // Wire AppState into storageUtils for quota caching
  setStorageDependencies({ AppState: deps.core.AppState });

  // Inject large dialog modals BEFORE Phase 2 — modules query these elements during init
  const { RECURRING_PANEL_HTML, PREFERENCES_MODAL_HTML, SETTINGS_MODAL_HTML } =
      await import(`./modalTemplates.js${vParam}`);
  ensureBootModalTemplate(
    DOM_IDS.GAMES_PANEL,
    DOM_IDS.RECURRING_PANEL_OVERLAY,
    RECURRING_PANEL_HTML
  );
  ensureBootModalTemplate(
    DOM_IDS.ROUTINE_SWITCHER_MODAL,
    DOM_IDS.PREFERENCES_MODAL,
    PREFERENCES_MODAL_HTML
  );
  ensureBootModalTemplate(
    DOM_IDS.TESTING_MODAL,
    DOM_IDS.SETTINGS_MODAL,
    SETTINGS_MODAL_HTML
  );

  // ⛔ Gate before loading feature modules: if the server is ahead, this reloads
  // to the fresh build and never returns — so we never import a possibly-renamed
  // feature module on stale code. Resolves instantly when fresh/offline/timed-out.
  await versionGate;

  // ========== PHASE 2: FEATURES (with timeout) ==========
  updateLoaderProgress(getLabel('boot.loadingFeatures'), 55);
  await withTimeout(
    bootFeatures(deps, coreResult),
    BOOT_TIMEOUTS.PHASE_2,
    'Phase 2 (Features)'
  );

  // ✅ Use version param for cache-busting (like appInit pattern)
  const appContextMod = await import(`../core/appContext.js${vParam}`);
  appContextMod.validateAllApisRegistered();

  markBoot(BOOT_MARKS.PHASE2_DONE); // ⏱️ all feature modules loaded + wired

  // ========== PHASE 3: DATA & UI (with timeout) ==========
  updateLoaderProgress(getLabel('boot.startingUp'), 85);

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

  // ⏱️ Boot timing: app is now interactive — record phase durations.
  markBoot(BOOT_MARKS.INTERACTIVE);
  measureBoot(BOOT_MEASURES.MODULE_IMPORT, BOOT_MARKS.START, BOOT_MARKS.MODULES_LOADED);
  measureBoot(BOOT_MEASURES.CORE, BOOT_MARKS.MODULES_LOADED, BOOT_MARKS.PHASE1_DONE);
  measureBoot(BOOT_MEASURES.FEATURES, BOOT_MARKS.PHASE1_DONE, BOOT_MARKS.PHASE2_DONE);
  measureBoot(BOOT_MEASURES.UI, BOOT_MARKS.PHASE2_DONE, BOOT_MARKS.INTERACTIVE);
  measureBoot(BOOT_MEASURES.TOTAL, BOOT_MARKS.START, BOOT_MARKS.INTERACTIVE);
  try {
    if (deps.utils?.isDebug?.()) console.info('⏱️ Boot timing', getBootTiming());
  } catch (_) { /* diagnostic only */ }

  updateLoaderProgress(getLabel('boot.ready'), 100);
  const totalTime = Date.now() - bootStart;

  // Clear recovery flags on successful boot
  clearRecoveryFlags();

  // Clear boot failure counter (failsafe in miniCycle.html)
  if (typeof window.__miniCycleBootSuccess === 'function') {
    window.__miniCycleBootSuccess();
  }

  // ✅ WARM CACHE: After successful online boot, tell the SW to verify all
  // boot-critical files are cached. iOS can fail to precache files during install
  // (partial cache.addAll failure). This fills gaps so the next offline boot works.
  if (navigator.onLine && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({ type: 'WARM_CACHE' });
    } catch (e) {
      // Non-critical — don't let cache warming break boot
    }
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
        const name = file.name.toLowerCase();
        if (!name.endsWith('.mcyc') && !name.endsWith('.json')) return;
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

  try {
    const success = await runBootSequence();
    if (success === false) return; // Reload initiated by core boot
  } catch (error) {
    // Non-Error rejections (string/undefined) have no .message — guard so the
    // error screen still renders instead of throwing inside the catch.
    const errMsg = error?.message || '';
    const phase = errMsg.includes('Phase') ? errMsg.split(' timed')[0] : 'initialization';

    // ✅ FAST-PATH: A "binding name not found" / "Importing"-class error is a
    // signature stale-cache failure (e.g. a static import like
    // `import { EVENTS } from '../core/constants.js'` resolved against an old
    // cached constants.js missing a newly-added export). Retrying without
    // clearing caches just hits the same stale entry again and burns ~3s of
    // user-facing error screen. Recover immediately on the first such failure.
    if (isCacheError(error) && !isRecoveryExhausted() && navigator.onLine) {
      console.warn('🧹 Cache-class error on attempt ' + bootAttempt + ' — fast-path recovery');
      // Show a friendly "Updating to latest version..." overlay so the user
      // doesn't see a generic boot-error screen during the brief moment
      // before the reload kicks in.
      showUpdatingOverlay();
      const recovered = await attemptCacheRecovery('orchestrator-cacheErrorFastPath');
      if (recovered) return;
      // Recovery exhausted — fall through to retry/error path
    }

    if (bootAttempt <= MAX_BOOT_RETRIES) {
      // Always retry at least once — on iOS, the SW process needs time to restart
      // after being killed while backgrounded. The retry delay gives it time to spin up.
      // Version suffix is already suppressed when offline (no version mismatch risk).
      showBootError(phase, error, true);
      await new Promise(resolve => setTimeout(resolve, BOOT_TIMEOUTS.RETRY_DELAY));
      return initApp(); // Retry
    } else {
      // Max retries exceeded - show final error with lite option (cache recovery
      // was already attempted via the fast-path above when applicable)
      showBootError(phase, error, false);
    }
  }
}

// Wait for service worker to be ready (prevents first-load import failures)
async function waitForServiceWorker(timeoutMs = 3000) {
  // Native (Capacitor) ships every asset bundled locally and registers NO service
  // worker — build-android-www.cjs strips the SW registration from index.html. The
  // Android WebView still exposes navigator.serviceWorker, so `.ready` never resolves
  // and this would burn the full timeout (~8s) on every cold start. Skip it on native;
  // there is nothing to wait for. No effect on the web/PWA build (isNativeApp() is false).
  if (isNativeApp()) return;
  if (!('serviceWorker' in navigator)) return;

  // iOS kills SW when PWA is backgrounded. It needs more time to restart.
  // ⚠️ navigator.onLine is unreliable on iOS (often returns true when offline),
  // so always use the longer timeout to give the SW time to spin up.
  const isOffline = !navigator.onLine;
  const effectiveTimeout = Math.max(timeoutMs, 8000);

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
      return;
    }
    // If controller exists, SW is active and ready
    if (navigator.serviceWorker.controller) {
      return;
    }
    // Wait for controller to be set
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, effectiveTimeout);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  } catch (e) {
    console.warn('SW ready check failed:', e.message);
    // If offline and SW isn't ready, wait a bit more for iOS to spin it up
    if (isOffline && !navigator.serviceWorker.controller) {
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
    // A loadDependencies() failure never reached initApp's retry/recovery
    // machinery — without this, the user gets a 60s spinner then the Lite
    // redirect. Give the signature stale-cache failure the same one-shot
    // recovery as initApp's fast-path, else show the boot error screen.
    // attemptCacheRecovery is wired BY loadDependencies, so it can be
    // undefined when the failure happened early — guard it.
    if (isCacheError(error) && typeof attemptCacheRecovery === 'function' && navigator.onLine) {
      showUpdatingOverlay();
      const recovered = await attemptCacheRecovery('orchestrator-startFailure');
      if (recovered) return;
    }
    showBootError('Dependency load', error, false);
    // If the error screen couldn't render, the HTML fallback still redirects to Lite.
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startOrchestrator);
} else {
  startOrchestrator();
}
