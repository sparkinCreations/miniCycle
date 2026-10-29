/**
 * userManualLink.js — where the user manual is, and how to open it.
 *
 * In a browser the manual opens in a NEW tab, so the app stays where the user
 * left it (Alt+Shift+U used to navigate away; user report, Oct 2026). In an
 * installed app — home-screen web app, installed PWA, or the iOS / Android /
 * desktop shells — there are no tabs, and a new one would throw the user out
 * into the browser, so it opens in place there.
 *
 * Shared by the menu's User Manual button (uiBoot.setupUserManual, which
 * Alt+Shift+U and the welcome screen press) and the Keyboard Shortcuts list's
 * link to the manual's full list (modalManager). Pure apart from reading the
 * platform: no DI, no state.
 *
 * Static import of boot-critical modules, so listed in BOOT_CRITICAL
 * (service-worker.js).
 *
 * @module utils/userManualLink
 */

import { isNativeApp } from '../platform/capacitorBridge.js';
import { isDesktopApp } from '../platform/desktopBridge.js';

/** The user manual, relative to the app page. */
export const USER_MANUAL_PATH = 'legal/user-manual.html';

/** The manual's Keyboard Shortcuts section — the complete list. */
export const USER_MANUAL_SHORTCUTS_HASH = '#keyboard-shortcuts';

/**
 * Whether miniCycle is running as an installed app rather than in a browser
 * tab. Installed apps have no tabs to open a page in.
 * @returns {boolean}
 */
export function runsAsInstalledApp() {
    if (isNativeApp() || isDesktopApp()) return true;
    if (navigator.standalone === true) return true;   // iOS home-screen web app
    return ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => window.matchMedia?.(`(display-mode: ${mode})`)?.matches);
}

/**
 * Point a link at the manual so it opens the way the menu's button does: a new
 * tab in a browser, in place in an installed app. For a link the browser
 * follows itself, so nothing is listened for.
 * @param {HTMLAnchorElement} link
 * @param {string} [hash] - a section, e.g. USER_MANUAL_SHORTCUTS_HASH
 * @returns {HTMLAnchorElement}
 */
export function linkToUserManual(link, hash = '') {
    link.href = USER_MANUAL_PATH + hash;
    if (!runsAsInstalledApp()) {
        link.target = '_blank';
        link.rel = 'noopener';
    }
    return link;
}
