/**
 * ============================================================================
 * miniCycle-main.js - Application Entrypoint (Skeleton)
 * ============================================================================
 *
 * This is the ONLY file loaded by miniCycle.html.
 * It simply imports and calls bootUI() from app-uiBoot.js.
 *
 * WHY SO SMALL?
 * - Single responsibility: just start the app
 * - If boot fails, the HTML's 8-second timeout triggers lite fallback
 * - Nothing to debug here - all logic is in the boot files
 *
 * ============================================================================
 */

import { bootUI } from './app-uiBoot.js';

// Start the application
bootUI().catch(err => {
  console.error('❌ MiniCycle failed to boot:', err);

  // Log additional context for debugging
  console.error('Boot error details:', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  // The HTML page has an 8-second timeout that will redirect to lite version
  // if window.AppBootStarted is not set. Since app-coreBoot.js sets this flag
  // immediately, the fallback only triggers if the boot files fail to load entirely.

  // Optionally show user-friendly error message
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1a1a2e;
    color: #fff;
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    font-family: Inter, sans-serif;
    z-index: 10000;
    max-width: 90%;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  `;
  errorDiv.innerHTML = `
    <h2 style="margin: 0 0 1rem 0; color: #ff6b6b;">Unable to Load</h2>
    <p style="margin: 0 0 1rem 0; opacity: 0.8;">MiniCycle encountered an error during startup.</p>
    <p style="margin: 0 0 1.5rem 0; opacity: 0.6; font-size: 0.9rem;">Redirecting to lite version...</p>
    <a href="lite/miniCycle-lite.html?mode=lite&src=boot-error"
       style="color: #4ecdc4; text-decoration: underline;">
      Click here if not redirected
    </a>
  `;
  document.body.appendChild(errorDiv);

  // Redirect to lite version after a short delay
  setTimeout(() => {
    window.location.href = 'lite/miniCycle-lite.html?mode=lite&src=boot-error';
  }, 3000);
});
