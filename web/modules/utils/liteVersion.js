/**
 * liteVersion.js — the single entry point for navigating to the lite version.
 *
 * The lite version is a web-only fallback for old browsers and slow connections.
 * It is intentionally NOT bundled in the native (Capacitor) build, whose WebView
 * is a modern Chromium that can always run the full app — so navigating there
 * would 404. Every lite navigation MUST route through goToLiteVersion() so the
 * native guard lives in exactly one place and can never be forgotten by a new
 * caller. On the web/PWA build isNativeApp() is false, so this is a no-op gate
 * and the redirect behaves exactly as before.
 */

import { LITE_VERSION_PATH } from '../core/constants.js';
import { isNativeApp } from '../platform/capacitorBridge.js';

/**
 * Navigate to the lite version, unless running in the native shell.
 *
 * @param {Object} [options]
 * @param {Object<string, string|number>} [options.params] - query params to append
 * @param {string} [options.reason] - short tag for the suppressed-on-native log
 * @returns {boolean} true if navigation started, false if suppressed on native
 */
export function goToLiteVersion({ params = {}, reason = '' } = {}) {
  if (isNativeApp()) {
    console.warn(`[miniCycle] lite version unavailable in native build${reason ? ` (${reason})` : ''}`);
    return false;
  }

  const url = new URL(LITE_VERSION_PATH, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  window.location.href = url.href;
  return true;
}
