/**
 * @file updateCheck.js
 * @description "Check for Updates" (Settings → Advanced, and the main menu), per platform.
 * @module utils/updateCheck
 *
 * Until Sep 2026 the two buttons called `window.forceServiceWorkerUpdate` and
 * `window.checkForUpdates` from an inline script — neither existed anywhere, so
 * the button silently did nothing on every platform. This module owns it now.
 *
 *  - **Web (PWA):** ask the service worker registration to update; a WAITING
 *    worker names the version it would install (GET_VERSION, the same channel the
 *    About modal uses); `app:verifyVersion` (miniCycle.html's verifyVersionFresh)
 *    catches stale cached HTML and hard-reloads on its own. When nothing is
 *    waiting, the live `version.js` decides between "up to date" and "reload".
 *  - **Chrome extension, iOS, Android, desktop:** there is no service worker and
 *    the app cannot update itself. The live `version.js` is fetched cross-origin
 *    (netlify.toml sends `Access-Control-Allow-Origin: *` on it) and compared with
 *    the running build; the notification names where to get the update — the
 *    store, or the download page for the desktop app.
 *  - **Offline / fetch failed:** say so, and name the running version.
 *
 * DI-pure: no window.* globals. `fetch` and the SW registration are injectable
 * so tests never hit the network or the page's own service worker.
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, UI_TIMEOUTS, APP_URL } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { isNativeApp, getNativePlatform } from '../platform/capacitorBridge.js';
import { isDesktopApp } from '../platform/desktopBridge.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('UpdateCheck', {
    showNotification: required(),
    AppMeta: required(),
    safeAddEventListener: optional(null)
});

/** @type {{showNotification: Function, AppMeta: {version: string}, safeAddEventListener: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Inject dependencies (called by the module loader before initUpdateCheck).
 * @param {Object} dependencies
 * @returns {void}
 */
export function setUpdateCheckDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// PLATFORM
// ============================================================================

/** How long to wait for a waiting worker to answer GET_VERSION before giving up. */
const WORKER_VERSION_TIMEOUT_MS = 1500;

const STORE_LABEL_KEY = Object.freeze({
    extension: 'noun.chromeWebStore',
    ios: 'noun.appStore',
    android: 'noun.googlePlay',
    desktop: 'noun.desktopDownloadSite'
});

/**
 * Where updates come from for the running build.
 * @returns {'web'|'extension'|'ios'|'android'|'desktop'}
 */
export function detectUpdateChannel() {
    if (typeof location !== 'undefined' && location.protocol === 'chrome-extension:') return 'extension';
    if (isNativeApp()) return getNativePlatform() === 'ios' ? 'ios' : 'android';
    if (isDesktopApp()) return 'desktop';
    return 'web';
}

/**
 * True when `candidate` is a newer dotted version than `current` ("2.10" > "2.9").
 * Non-numeric or missing input is never "newer" — a broken read must not nag.
 * @param {string} candidate
 * @param {string} current
 * @returns {boolean}
 */
export function isNewerVersion(candidate, current) {
    const parse = (v) => String(v ?? '').trim().split('.').map((part) => Number.parseInt(part, 10));
    const a = parse(candidate);
    const b = parse(current);
    if (!a.length || !b.length || a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const x = a[i] ?? 0;
        const y = b[i] ?? 0;
        if (x !== y) return x > y;
    }
    return false;
}

/**
 * The APP_VERSION the live site serves right now, or null when unreachable.
 * `version.js` is never cached (netlify.toml) and carries CORS for the packaged
 * builds, whose origins are chrome-extension://, capacitor://localhost,
 * http://localhost and app://minicycle (desktop).
 * @param {Function} [fetchImpl] - fetch to use (injectable for tests)
 * @returns {Promise<string|null>}
 */
export async function fetchLiveVersion(fetchImpl) {
    const doFetch = fetchImpl || ((url, init) => fetch(url, init));
    try {
        const response = await doFetch(`${APP_URL}/version.js?nocache=${Date.now()}`, { cache: 'no-store' });
        if (!response || !response.ok) return null;
        const text = await response.text();
        const match = /APP_VERSION\s*=\s*['"]([\d.]+)['"]/.exec(text);
        return match ? match[1] : null;
    } catch (error) {
        console.warn('Update check: could not read the live version:', error);
        return null;
    }
}

/**
 * Ask a service worker for its APP_VERSION over a MessageChannel.
 * @param {ServiceWorker} worker
 * @returns {Promise<string|null>}
 */
function askWorkerVersion(worker) {
    return new Promise((resolve) => {
        let settled = false;
        const done = (value) => { if (!settled) { settled = true; resolve(value); } };
        try {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => done(event?.data?.version || null);
            worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        } catch {
            done(null);
        }
        setTimeout(() => done(null), WORKER_VERSION_TIMEOUT_MS);
    });
}

// ============================================================================
// THE CHECK
// ============================================================================

/**
 * Run the check for the running platform and tell the user what it found.
 *
 * @param {Object} [options] - Injection points; production callers pass none
 * @param {'web'|'extension'|'ios'|'android'|'desktop'} [options.channel] - override detection
 * @param {Function} [options.fetchImpl] - fetch to use for the live version
 * @param {Function} [options.getRegistration] - returns the SW registration (web)
 * @param {Function} [options.verifyVersion] - the stale-HTML check trigger (web)
 * @returns {Promise<{channel: string, current: string, latest: string|null, status: 'up-to-date'|'update-available'|'unknown'}>}
 */
export async function checkForUpdates(options = {}) {
    const channel = options.channel || detectUpdateChannel();
    const current = String(_deps.AppMeta.version || '');
    const notify = (message, type, duration) => _deps.showNotification(message, type, duration);

    notify(getLabel('notify.checkingUpdates'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);

    if (channel !== 'web') {
        const latest = await fetchLiveVersion(options.fetchImpl);
        if (!latest) {
            notify('⚠️ ' + getLabel('notify.updateCheckFailed', { vars: { version: current } }), 'warning', UI_TIMEOUTS.NOTIFICATION_LONG);
            return { channel, current, latest: null, status: 'unknown' };
        }
        if (isNewerVersion(latest, current)) {
            const store = getLabel(STORE_LABEL_KEY[channel]);
            notify(getLabel('notify.updateAvailableStore', { vars: { from: current, to: latest, store } }), 'info', UI_TIMEOUTS.NOTIFICATION_SLOW);
            return { channel, current, latest, status: 'update-available' };
        }
        notify('✅ ' + getLabel('notify.updateUpToDate', { vars: { version: current } }), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
        return { channel, current, latest, status: 'up-to-date' };
    }

    // ---- Web: the service worker owns updates; this asks it to look now ----
    // verifyVersionFresh (miniCycle.html) hard-reloads on its own when the cached
    // HTML is stale; when that fires, nothing below is reached and that is fine.
    try {
        if (options.verifyVersion) options.verifyVersion();
        else document.dispatchEvent(new CustomEvent('app:verifyVersion'));
    } catch (error) {
        console.warn('Update check: version freshness dispatch failed:', error);
    }

    let registration = null;
    try {
        registration = options.getRegistration
            ? await options.getRegistration()
            : (('serviceWorker' in navigator) ? await navigator.serviceWorker.getRegistration() : null);
        if (registration) await registration.update();
    } catch (error) {
        console.warn('Update check: service worker update failed:', error);
    }

    if (registration?.waiting) {
        const toVersion = await askWorkerVersion(registration.waiting);
        const message = (toVersion && toVersion !== current)
            ? getLabel('notify.updateAvailableFromTo', { vars: { from: current, to: toVersion } })
            : getLabel('notify.updateAvailableReload');
        notify(message, 'info', UI_TIMEOUTS.NOTIFICATION_SLOW);
        return { channel, current, latest: toVersion, status: 'update-available' };
    }

    const latest = await fetchLiveVersion(options.fetchImpl);
    if (!latest) {
        notify('⚠️ ' + getLabel('notify.updateCheckFailed', { vars: { version: current } }), 'warning', UI_TIMEOUTS.NOTIFICATION_LONG);
        return { channel, current, latest: null, status: 'unknown' };
    }
    if (isNewerVersion(latest, current)) {
        notify(getLabel('notify.updateAvailableFromTo', { vars: { from: current, to: latest } }), 'info', UI_TIMEOUTS.NOTIFICATION_SLOW);
        return { channel, current, latest, status: 'update-available' };
    }
    notify('✅ ' + getLabel('notify.updateUpToDate', { vars: { version: current } }), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
    return { channel, current, latest, status: 'up-to-date' };
}

// ============================================================================
// BUTTONS
// ============================================================================

let _buttonsWired = false;

/**
 * Wire both "Check for Updates" buttons. Idempotent. The settings button lives
 * in SETTINGS_MODAL_HTML, injected by orchestrator before the UI phase, so it
 * exists by the time the loader calls this.
 * @returns {void}
 */
export function initUpdateCheck() {
    if (_buttonsWired) return;
    _buttonsWired = true;
    const onClick = () => { checkForUpdates(); };
    [DOM_IDS.CHECK_FOR_UPDATES, DOM_IDS.MENU_CHECK_UPDATES].forEach((id) => {
        const button = document.getElementById(id);
        if (!button) return;
        if (_deps.safeAddEventListener) _deps.safeAddEventListener(button, 'click', onClick);
        else button.addEventListener('click', onClick);
    });
}

/** Test seam: allow a fresh module instance to wire again. @returns {void} */
export function resetUpdateCheckForTests() {
    _buttonsWired = false;
}
