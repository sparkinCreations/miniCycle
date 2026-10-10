/**
 * liteVersion.js — the single entry point for navigating to the lite version.
 *
 * The lite version is a web-only fallback for old browsers and slow connections.
 * It is intentionally NOT bundled in the native (Capacitor) build, the packaged
 * Chrome extension, or the Electron desktop app — all run a modern engine that
 * always runs the full app, so navigating to the unbundled lite page would 404
 * (a blank chrome-error page in the extension). Every lite navigation MUST
 * route through goToLiteVersion() so these guards live in exactly one place and
 * can never be forgotten by a new caller. On the web/PWA build every guard is
 * false, so this is a no-op gate and the redirect behaves exactly as before.
 */

import { LITE_VERSION_PATH } from '../core/constants.js';
import { isNativeApp } from '../platform/capacitorBridge.js';
import { isDesktopApp } from '../platform/desktopBridge.js';

/**
 * True when running as a packaged Chrome extension page (chrome-extension://
 * origin). lite/ is not bundled there, so a lite navigation would 404.
 * @returns {boolean}
 */
function isPackagedExtension() {
  return typeof location !== 'undefined' && location.protocol === 'chrome-extension:';
}

/**
 * True in any packaged build that does not bundle lite/: the Capacitor apps, the
 * Chrome extension and the desktop app. (uiBoot and deviceDetection hide their
 * lite entry points with their own, narrower tests — the extension keeps its
 * menu entry on purpose; this is the navigation backstop behind all of them.)
 * @returns {boolean}
 */
function isLiteVersionUnavailable() {
  return isNativeApp() || isPackagedExtension() || isDesktopApp();
}

/**
 * Navigate to the lite version, unless running in a packaged shell.
 *
 * @param {Object} [options]
 * @param {Object<string, string|number>} [options.params] - query params to append
 * @param {string} [options.reason] - short tag for the suppressed-on-native log
 * @returns {boolean} true if navigation started, false if suppressed in a packaged build
 */
export function goToLiteVersion({ params = {}, reason = '' } = {}) {
  if (isLiteVersionUnavailable()) {
    console.warn(`[miniCycle] lite version unavailable here${reason ? ` (${reason})` : ''}`);
    return false;
  }

  const url = new URL(LITE_VERSION_PATH, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  window.location.href = url.href;
  return true;
}
