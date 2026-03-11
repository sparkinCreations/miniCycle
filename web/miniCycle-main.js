/**
 * ============================================================================
 * miniCycle-main.js - Application Entrypoint
 * ============================================================================
 *
 * This is the ONLY file loaded by miniCycle.html.
 * It imports the orchestrator which handles the full boot sequence.
 *
 * ERROR HANDLING STRATEGY:
 * - This file only catches catastrophic import failures (syntax errors, network)
 * - orchestrator.js handles all runtime boot failures with retry logic
 * - HTML has 8-second timeout fallback to lite version
 *
 * BOOT FILE STRUCTURE (all in modules/boot/):
 * - miniCycle-main.js (this file) - Entrypoint only
 * - modules/boot/orchestrator.js - Boot orchestration, error handling, retries
 * - modules/boot/coreBoot.js - Core state, AppState, migration
 * - modules/boot/featureBoot.js - Feature module loading, DI wiring
 * - modules/boot/uiBoot.js - UI event handlers, loader helpers
 *
 * ============================================================================
 */

// ✅ Single source of truth: Read version from globalThis (set by version.js)
const APP_VERSION = globalThis.APP_VERSION || 'dev-local';

// Start the application
(async () => {
  const bootStart = Date.now();

  try {
    // Import the orchestrator - this triggers the boot sequence
    // orchestrator.js has its own error handling with retries
    await import(`./modules/boot/orchestrator.js?v=${APP_VERSION}`);

    const bootTime = Date.now() - bootStart;

  } catch (error) {
    // This only catches catastrophic failures (orchestrator.js can't load at all)
    // e.g., syntax errors, network failures, module not found
    console.error('❌ miniCycle-main.js: Failed to load orchestrator:', error);
    console.error('Boot error details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // HTML's 8-second timeout will redirect to lite version
    // No need to duplicate error UI here - orchestrator.js has better handling
    // If we got here, orchestrator couldn't even load, so just wait for HTML fallback
  }
})();

