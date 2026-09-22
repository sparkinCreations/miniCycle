/**
 * desktopBridge.js — the single point of contact with the Electron desktop shell.
 *
 * Pure leaf module, the desktop twin of capacitorBridge.js: it imports nothing
 * from other app modules and is injected nowhere via DI. Import it directly.
 * It ships verbatim in the web app and in every packaged build — the desktop
 * www/ payload is generated from web/ by scripts/build-desktop-www.cjs, so this
 * file is identical everywhere.
 *
 * The contract that keeps the web app safe: only the desktop shell's preload
 * script (desktop/src/preload.js) exposes `globalThis.miniCycleDesktop`, via
 * Electron's contextBridge. On the web, in the Chrome extension and inside the
 * Capacitor apps that global does not exist, so `isDesktopApp()` is false and
 * callers keep their existing behaviour unchanged.
 *
 * What desktop needs from the app is small on purpose (v1 is a minimal shell):
 * the app must know it is packaged — no service worker to wait for, no lite/
 * fallback to navigate to, and "Check for Updates" points at the download page
 * instead of a store. File save/open, notifications and external links are all
 * plain web APIs that Electron's Chromium already provides, so nothing here
 * proxies them. See desktop/docs/DESKTOP_BUILD_AND_DIFFERENCES.md.
 */

'use strict';

// ── platform detection ───────────────────────────────────────────────────────

function shell() {
    // globalThis avoids a hard window.* reference (also works in workers).
    return typeof globalThis !== 'undefined' ? globalThis.miniCycleDesktop : undefined;
}

/** True only inside the Electron desktop app. False on the web and in every other shell. */
export function isDesktopApp() {
    const d = shell();
    return !!(d && typeof d === 'object' && typeof d.platform === 'string');
}

/**
 * Which desktop OS the shell runs on, or null outside the desktop app.
 * The preload passes Node's process.platform through; this maps it to the
 * three names the app talks about.
 * @returns {'mac'|'windows'|'linux'|null}
 */
export function getDesktopPlatform() {
    if (!isDesktopApp()) return null;
    const raw = shell().platform;
    if (raw === 'darwin') return 'mac';
    if (raw === 'win32') return 'windows';
    if (raw === 'linux') return 'linux';
    return null;
}

/**
 * The Electron shell's own version (desktop/package.json), or null outside it.
 * The web payload's APP_VERSION is what "Check for Updates" compares; this is
 * only for diagnostics, so a payload/shell mismatch can be named.
 * @returns {string|null}
 */
export function getDesktopShellVersion() {
    if (!isDesktopApp()) return null;
    const v = shell().shellVersion;
    return typeof v === 'string' && v ? v : null;
}
