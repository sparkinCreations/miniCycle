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
 *  - Outcomes are logged, never surfaced to the user: a denied grant isn't
 *    actionable, and the .mcyc export + backup-reminder system is the
 *    user-facing durability net. `getStatus()` exposes the live state for any
 *    future settings UI that wants to show it.
 *
 * No injected dependencies: `navigator.storage` and `document` are browser
 * APIs, not app dependencies. The diBase scaffold is kept for boot-contract
 * consistency with the rest of the module system.
 *
 * @module storagePersistence
 */

import { createDIModule } from '../core/diBase.js';

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
     * Live persistence status for any UI that wants it (nothing consumes it yet).
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
        try {
            this._persisted = await navigator.storage.persisted();
        } catch (e) {
            console.warn('💾 Persistent storage: persisted() check failed:', e?.message || e);
            this._persisted = null;
        }
        return this._persisted === true;
    }

    /** @returns {Promise<boolean>} @private */
    async _requestPersist() {
        try {
            this._persisted = await navigator.storage.persist();
            console.info(this._persisted
                ? '💾 Persistent storage: GRANTED — saved data is now durable.'
                : '💾 Persistent storage: not granted (best-effort storage; backups remain the durability net).');
        } catch (e) {
            console.warn('💾 Persistent storage: persist() request failed:', e?.message || e);
            this._persisted = null;
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
