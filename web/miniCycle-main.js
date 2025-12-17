/**
 * ============================================================================
 * miniCycle-main.js - Application Entrypoint
 * ============================================================================
 *
 * This is the ONLY file loaded by miniCycle.html.
 * It imports and executes the boot sequence from the boot modules.
 *
 * WHY SO SMALL?
 * - Single responsibility: just start the app
 * - If boot fails, the HTML's 8-second timeout triggers lite fallback
 * - Easy to debug - all logic is in the boot files
 *
 * BOOT FILE STRUCTURE (all in modules/boot/):
 * - miniCycle-main.js (this file) - Entrypoint, error handling
 * - modules/boot/coreBoot.js - Core state, AppState, migration
 * - modules/boot/featureBoot.js - Feature module loading, DI wiring
 * - modules/boot/uiBoot.js - UI event handlers, loader helpers
 * - modules/boot/orchestrator.js - Boot orchestration (coordinates all boot files)
 *
 * ============================================================================
 */

const APP_VERSION = window.APP_VERSION || '1.507';

// Start the application
(async () => {
  const bootStart = Date.now();
  console.log('🚀 miniCycle-main.js: Starting application...');

  try {
    // Import the orchestrator - this triggers the boot sequence
    // orchestrator.js has a DOMContentLoaded listener that runs automatically
    await import(`./modules/boot/orchestrator.js?v=${APP_VERSION}`);

    const bootTime = Date.now() - bootStart;
    console.log(`✅ miniCycle-main.js: Boot sequence initiated in ${bootTime}ms`);

  } catch (error) {
    console.error('❌ miniCycle-main.js: Boot failed:', error);

    // Log additional context for debugging
    console.error('Boot error details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // The HTML page has an 8-second timeout that will redirect to lite version
    // if window.AppBootStarted is not set. Since app-coreBoot.js sets this flag
    // immediately when loaded, the fallback only triggers if boot files fail entirely.

    // Show user-friendly error message
    showBootError(error);

    // Redirect to lite version after a short delay
    setTimeout(() => {
      window.location.href = 'lite/miniCycle-lite.html?mode=lite&src=boot-error';
    }, 5000);
  }
})();

/**
 * Show a user-friendly boot error message
 * @param {Error} error - The error that occurred
 */
function showBootError(error) {
  // Don't show error if app already loaded (error was during non-critical phase)
  if (window.AppState?.isReady?.()) {
    console.warn('⚠️ Boot error occurred but app is ready - not showing error UI');
    return;
  }

  const errorDiv = document.createElement('div');
  errorDiv.id = 'boot-error-overlay';
  errorDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(26, 26, 46, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
  `;

  errorDiv.innerHTML = `
    <div style="
      background: #1a1a2e;
      color: #fff;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      max-width: 90%;
      width: 400px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    ">
      <h2 style="margin: 0 0 1rem 0; color: #ff6b6b; font-size: 1.5rem;">
        Unable to Load
      </h2>
      <p style="margin: 0 0 1rem 0; opacity: 0.8; line-height: 1.5;">
        MiniCycle encountered an error during startup.
      </p>
      <p style="margin: 0 0 0.5rem 0; opacity: 0.5; font-size: 0.85rem;">
        Error: ${error.message || 'Unknown error'}
      </p>
      <p style="margin: 0 0 1.5rem 0; opacity: 0.6; font-size: 0.9rem;">
        Redirecting to lite version in 5 seconds...
      </p>
      <a href="lite/miniCycle-lite.html?mode=lite&src=boot-error"
         style="
           display: inline-block;
           color: #4ecdc4;
           text-decoration: none;
           padding: 0.75rem 1.5rem;
           border: 1px solid #4ecdc4;
           border-radius: 8px;
           transition: all 0.2s;
         "
         onmouseover="this.style.background='#4ecdc4';this.style.color='#1a1a2e';"
         onmouseout="this.style.background='transparent';this.style.color='#4ecdc4';">
        Go to Lite Version Now
      </a>
    </div>
  `;

  document.body.appendChild(errorDiv);
}

console.log('📦 miniCycle-main.js loaded');
