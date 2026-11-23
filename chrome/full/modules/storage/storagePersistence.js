/**
 * 💾 Storage Persistence (DI-Pure)
 *
 * Asks the browser for DURABLE (non-evictable) origin storage via the Storage
 * API, so localStorage/IndexedDB won't be evicted under storage pressure or
 * idle-eviction policies (e.g. WebKit's script-writable-storage cleanup). This
 * protects *already-saved* routines — a different threat from the unload-flush
 * in appState.js, which protects *unsaved* changes.
 *
 * Best-effort by design:
 *  - The Storage API isn't universally supported.
 *  - Grants are heuristic (Chrome decides silently based on engagement/install)
 *    or gesture-gated, so we check first, request once at boot, and re-attempt
 *    on the first user interaction (which many browsers require before granting).
 *  - The outcome is shown, not acted on: Settings → Data Management says
 *    whether the data is protected (backupRestoreManager.refreshStorageStatus),
 *    and the backup reminder comes twice as often when it is not
 *    (backupReminder.js). `protectionLevel()` is the one answer both read;
 *    EVENTS.STORAGE_PERSISTENCE_CHANGED tells Settings when it changes (a grant
 *    on the first tap arrives after Settings has drawn).
 *
 * No injected dependencies: `navigator.storage` and `document` are browser
 * APIs, not app dependencies, and the platform checks are plain imports. The diBase scaffold is kept for boot-contract
 * consistency with the rest of the module system.
 *
 * @module storagePersistence
 */

import { createDIModule } from '../core/diBase.js';
import { EVENTS } from '../core/constants.js';
import { isNativeApp } from '../platform/capacitorBridge.js';
import { isDesktopApp } from '../platform/desktopBridge.js';
import { runsAsInstalledApp } from '../utils/userManualLink.js';

/**
 * iPhone or iPad. iPadOS Safari reports itself as a Mac by default, so a Mac
 * with a touch screen counts too (no real Mac has one).
 * @returns {boolean}
 */
function isAppleMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent || '')) return true;
    return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('StoragePersistence', {});

/**
 * Set dependencies for StoragePersistence (call before initStoragePersistence).
 * The module is dependency-free; the setter exists for boot-contract parity.
 * @param {Object} dependencies
 * @returns {void}
 */
export function setStoragePersistenceDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Requests and tracks durable origin storage.
 */
export class StoragePersistence {
    constructor() {
        this.initialized = false;
        this._gestureHandler = null;
        this._gestureArmed = false;
        // Cached snapshot of the last known grant state. The live truth is always
        // navigator.storage.persisted(); this is just a cheap read for getStatus().
        // null = unknown / not yet checked.
        this._persisted = null;
        this._supported = typeof navigator !== 'undefined'
            && !!navigator.storage
            && typeof navigator.storage.persist === 'function'
            && typeof navigator.storage.persisted === 'function';
    }

    /** Late-binding dependency accessor (unused today — see module header). */
    get deps() {
        return di.resolve();
    }

    /**
     * Check current grant, request once if not granted, and arm a one-shot
     * gesture retry for browsers that only grant after interaction.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;
        this.initialized = true;

        if (!this._supported) {
            console.info('💾 Persistent storage: Storage API unavailable — using best-effort storage.');
            return;
        }

        // Already granted (e.g. installed PWA / prior grant) — nothing to do.
        if (await this._checkPersisted()) return;

        // Try now. Chrome evaluates heuristics silently; harmless if it declines.
        await this._requestPersist();

        // Still not granted → many browsers only grant after a user gesture.
        // Re-attempt on the first interaction, then stop.
        if (this._persisted !== true) this._armGestureRetry();
    }

    /**
     * Whether the browser may clear the saved data on its own.
     *  - 'app': the iOS, Android or desktop build. Not a browser site, and those
     *    builds write a daily backup file (storage/backupFolder.js), so there is
     *    nothing to tell the user here.
     *  - 'protected': the browser granted persistent storage.
     *  - 'unprotected': refused, not answered yet, or the Storage API is missing.
     * Synchronous — reads the last answer init() or a later check recorded.
     * @returns {'app'|'protected'|'unprotected'}
     */
    protectionLevel() {
        if (isNativeApp() || isDesktopApp()) return 'app';
        return this._persisted === true ? 'protected' : 'unprotected';
    }

    /**
     * True in Safari (or any browser) on an iPhone or iPad, outside a Home Screen
     * app. There, WebKit clears a site's storage after seven days of browser use
     * without a visit; a Home Screen app counts only its own days of use, so the
     * data stays. (A Home Screen app also starts with its OWN empty storage —
     * the wording that suggests it says to back up and restore.)
     * @returns {boolean}
     */
    suggestsHomeScreen() {
        if (isNativeApp() || isDesktopApp()) return false;
        return isAppleMobileDevice() && !runsAsInstalledApp();
    }

    /**
     * Live persistence status for any UI that wants it.
     * @returns {Promise<{supported: boolean, persisted: boolean|null, estimate: {usage?: number, quota?: number}|null}>}
     */
    async getStatus() {
        if (!this._supported) return { supported: false, persisted: false, estimate: null };
        let estimate = null;
        try {
            if (typeof navigator.storage.estimate === 'function') {
                estimate = await navigator.storage.estimate();
            }
        } catch { /* estimate is best-effort */ }
        return { supported: true, persisted: await this._checkPersisted(), estimate };
    }

    /** @returns {Promise<boolean>} @private */
    async _checkPersisted() {
        let answer;
        try {
            answer = await navigator.storage.persisted();
        } catch (e) {
            console.warn('💾 Persistent storage: persisted() check failed:', e?.message || e);
            answer = null;
        }
        this._record(answer);
        return this._persisted === true;
    }

    /**
     * Store the browser's answer and announce it when it changed. The event
     * carries the whole answer, not just the flag: the first one fires while
     * init() runs, BEFORE the module loader has registered this instance, so a
     * listener that looked the instance up then would find nothing (Settings,
     * phase 6, builds its line before this phase-7 module starts).
     * @param {boolean|null} answer
     * @private
     */
    _record(answer) {
        const changed = answer !== this._persisted;
        this._persisted = answer;
        if (!changed || typeof document === 'undefined') return;
        try {
            document.dispatchEvent(new CustomEvent(EVENTS.STORAGE_PERSISTENCE_CHANGED, {
                detail: { persisted: answer, level: this.protectionLevel(), homeScreen: this.suggestsHomeScreen() }
            }));
        } catch { /* no CustomEvent — nothing listens there either */ }
    }

    /** @returns {Promise<boolean>} @private */
    async _requestPersist() {
        try {
            const granted = await navigator.storage.persist();
            this._record(granted);
            console.info(granted
                ? '💾 Persistent storage: GRANTED — saved data is now durable.'
                : '💾 Persistent storage: not granted (best-effort storage; backups remain the durability net).');
        } catch (e) {
            console.warn('💾 Persistent storage: persist() request failed:', e?.message || e);
            this._record(null);
        }
        return this._persisted === true;
    }

    /** @private */
    _armGestureRetry() {
        if (this._gestureArmed) return;
        this._gestureArmed = true;
        this._gestureHandler = () => {
            this._disarmGestureRetry();
            // Fire-and-forget: the request runs inside the (now-consumed) gesture.
            this._requestPersist();
        };
        // First meaningful interaction only. { once } auto-removes each listener
        // after it fires; the handler also disarms both so a pointerdown clears
        // the keydown listener (and vice-versa).
        document.addEventListener('pointerdown', this._gestureHandler, { once: true, passive: true });
        document.addEventListener('keydown', this._gestureHandler, { once: true });
    }

    /** @private */
    _disarmGestureRetry() {
        if (!this._gestureArmed) return;
        document.removeEventListener('pointerdown', this._gestureHandler);
        document.removeEventListener('keydown', this._gestureHandler);
        this._gestureArmed = false;
    }

    /** Remove listeners on boot-retry teardown. */
    destroy() {
        this._disarmGestureRetry();
        this._gestureHandler = null;
        this.initialized = false;
    }
}

// Module-level singleton (named export preferred over default).
export const storagePersistence = new StoragePersistence();

/**
 * Boot entry point — discovered by moduleLoader.findInitFunction.
 * @param {Object} dependencies - Resolved deps from the manifest (unused).
 * @returns {Promise<StoragePersistence>}
 */
export async function initStoragePersistence(dependencies) {
    setStoragePersistenceDependencies(dependencies);
    await storagePersistence.init();
    return storagePersistence;
}
