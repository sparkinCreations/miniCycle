/**
 * 💾 Backup Manager Module (DI-Pure)
 *
 * Manages automatic and manual backups using IndexedDB for efficient,
 * non-blocking storage that doesn't compete with localStorage quota.
 *
 * Pattern: Simple Instance ✨
 * - Single responsibility (backup management)
 * - Required dependencies via diBase.js
 *
 * Note: indexedDB, document.* are browser APIs, not dependencies.
 *
 * @module storage/backupManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { STORAGE_KEYS, INTERVALS } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('BackupManager', {
    AppState: optional(null)
});

// Late-binding deps via Proxy
/** @type {{AppState: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for BackupManager
 * @param {Object} dependencies - { AppState }
 */
export function setBackupManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ==========================================
// 📦 DATABASE CONFIGURATION
// ==========================================

const DB_NAME = 'miniCycle_backups';
const DB_VERSION = 3; // Bumped for test_backups store
const AUTO_BACKUP_STORE = 'auto_backups';
const MANUAL_BACKUP_STORE = 'manual_backups';
const SESSION_BACKUP_STORE = 'session_backups'; // Backups on every app open
const TEST_BACKUP_STORE = 'test_backups'; // Backups before running tests
const MAX_AUTO_BACKUPS = 10; // Keep last 10 auto-backups
const MAX_SESSION_BACKUPS = 5; // Keep last 5 session backups
const MAX_MANUAL_BACKUPS = 50; // Keep last 50 manual backups
// Backup scheduling thresholds live in INTERVALS (BACKUP_DAILY, BACKUP_SESSION_MIN, BACKUP_TEST_MIN).

const LITE_STORAGE_KEYS = Object.freeze([
    STORAGE_KEYS.LITE_DATA,
    STORAGE_KEYS.LITE_MODE,
    STORAGE_KEYS.LITE_THEME,
    STORAGE_KEYS.LITE_CYCLES,
    STORAGE_KEYS.LITE_LIFETIME_COMPLETED,
    STORAGE_KEYS.LITE_TODO_DELETED,
    STORAGE_KEYS.LITE_CELEBRATED_BADGES,
    STORAGE_KEYS.LITE_CELEBRATED_CLEARED_BADGES,
    STORAGE_KEYS.LITE_NOTIFICATIONS
]);

function collectLiteStorageSnapshot() {
    const liteStorage = {};
    let hasLiteData = false;

    LITE_STORAGE_KEYS.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            liteStorage[key] = value;
            hasLiteData = true;
        }
    });

    return hasLiteData ? liteStorage : null;
}

function calculateBackupSize(data, liteStorage) {
    return JSON.stringify({
        data,
        liteStorage: liteStorage || undefined
    }).length;
}

function buildPortableBackupPayload(backup) {
    if (!backup?.data) {
        return null;
    }

    const payload = {
        schemaVersion: backup.data.metadata?.schemaVersion || backup.metadata?.schemaVersion || '2.5',
        miniCycleData: JSON.stringify(backup.data),
        backupMetadata: {
            createdAt: backup.timestamp,
            version: backup.metadata?.version || backup.data.metadata?.version || '2.5',
            schemaVersion: backup.metadata?.schemaVersion || backup.data.metadata?.schemaVersion || '2.5',
            includesLiteStorage: Boolean(backup.liteStorage),
            source: 'miniCycle BackupManager'
        }
    };

    if (backup.liteStorage) {
        payload.liteStorage = backup.liteStorage;
    }

    return payload;
}

class BackupManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    /**
     * Get AppState (DI-pure, no window.* fallback)
     * @private
     */
    _getAppState() {
        return _deps.AppState;
    }

    _buildBackupRecord(currentState, type, { id, name, cycleCount, liteStorage = collectLiteStorageSnapshot(), timestamp = Date.now() } = {}) {
        const backup = {
            timestamp,
            data: currentState,
            metadata: {
                version: currentState.metadata?.version || '1.371',
                schemaVersion: currentState.metadata?.schemaVersion || '2.5',
                size: calculateBackupSize(currentState, liteStorage),
                type,
                created: new Date(timestamp).toISOString(),
                includesLiteStorage: Boolean(liteStorage)
            }
        };

        if (id) backup.id = id;
        if (name) backup.name = name;
        if (typeof cycleCount === 'number') {
            backup.metadata.cycleCount = cycleCount;
        }
        if (liteStorage) {
            backup.liteStorage = liteStorage;
        }

        return backup;
    }

    _getStoreName(type = 'auto') {
        return type === 'test' ? TEST_BACKUP_STORE :
               type === 'session' ? SESSION_BACKUP_STORE :
               type === 'manual' ? MANUAL_BACKUP_STORE : AUTO_BACKUP_STORE;
    }

    /**
     * Initialize IndexedDB connection
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.isInitialized && this.db) {
            return this.db;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            // Timeout safety: don't hang forever if IndexedDB never responds
            const timeout = setTimeout(() => {
                this.initPromise = null;
                reject(new Error('BackupManager: IndexedDB init timed out after 10s'));
            }, 10000);

            request.onerror = () => {
                clearTimeout(timeout);
                console.error('❌ BackupManager: Failed to open IndexedDB', request.error);
                reject(request.error);
            };

            request.onblocked = () => {
                console.warn('⚠️ BackupManager: IndexedDB open blocked by another connection');
                // Don't reject - the request may still succeed once the blocking connection closes
            };

            request.onsuccess = () => {
                clearTimeout(timeout);
                this.db = request.result;
                this.isInitialized = true;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create auto-backups store
                if (!db.objectStoreNames.contains(AUTO_BACKUP_STORE)) {
                    const autoStore = db.createObjectStore(AUTO_BACKUP_STORE, { keyPath: 'timestamp' });
                    autoStore.createIndex('timestamp', 'timestamp', { unique: true });
                }

                // Create manual-backups store
                if (!db.objectStoreNames.contains(MANUAL_BACKUP_STORE)) {
                    const manualStore = db.createObjectStore(MANUAL_BACKUP_STORE, { keyPath: 'id' });
                    manualStore.createIndex('timestamp', 'timestamp', { unique: false });
                    manualStore.createIndex('name', 'name', { unique: false });
                }

                // Create session-backups store (v2) - backups on every app open
                if (!db.objectStoreNames.contains(SESSION_BACKUP_STORE)) {
                    const sessionStore = db.createObjectStore(SESSION_BACKUP_STORE, { keyPath: 'timestamp' });
                    sessionStore.createIndex('timestamp', 'timestamp', { unique: true });
                }

                // Create test-backups store (v3) - backups before running tests
                if (!db.objectStoreNames.contains(TEST_BACKUP_STORE)) {
                    const testStore = db.createObjectStore(TEST_BACKUP_STORE, { keyPath: 'timestamp' });
                    testStore.createIndex('timestamp', 'timestamp', { unique: true });
                }
            };
        });

        return this.initPromise;
    }

    /**
     * Create an automatic backup (non-blocking background operation)
     * @returns {Promise<boolean>}
     */
    async createAutoBackup() {
        try {
            await this.init();

            // Check if we need a backup (only once per day)
            const lastBackup = await this.getLastAutoBackup();
            if (lastBackup) {
                const timeSinceLastBackup = Date.now() - lastBackup.timestamp;
                if (timeSinceLastBackup < INTERVALS.BACKUP_DAILY) {
                    return false;
                }
            }

            // Get current app state (DI-pure)
            const AppState = this._getAppState();
            if (!AppState?.isReady?.()) {
                console.warn('⚠️ BackupManager: AppState not ready, skipping auto-backup');
                return false;
            }

            const currentState = AppState.get();
            if (!currentState) {
                console.warn('⚠️ BackupManager: No state data available for backup');
                return false;
            }

            const backup = this._buildBackupRecord(currentState, 'auto');

            // Save to IndexedDB
            await this.saveBackup(AUTO_BACKUP_STORE, backup);

            // Clean up old backups
            await this.enforceRetentionPolicy();

            return true;

        } catch (error) {
            console.error('❌ BackupManager: Auto-backup failed', error);
            return false;
        }
    }

    /**
     * Create a session backup (runs on every app open)
     * Skips if last session backup was less than 5 minutes ago.
     * Keeps only the last 5 backups for quick recovery.
     * @returns {Promise<boolean>}
     */
    async createSessionBackup() {
        try {
            await this.init();

            // Skip if last session backup was recent (avoid duplicates on rapid app opens)
            const lastSessionBackup = await this.getLastBackupFromStore(SESSION_BACKUP_STORE);
            if (lastSessionBackup) {
                const timeSinceLastBackup = Date.now() - lastSessionBackup.timestamp;
                if (timeSinceLastBackup < INTERVALS.BACKUP_SESSION_MIN) {
                    return false;
                }
            }

            // Get current app state (DI-pure)
            const AppState = this._getAppState();
            if (!AppState?.isReady?.()) {
                console.warn('⚠️ BackupManager: AppState not ready, skipping session backup');
                return false;
            }

            const currentState = AppState.get();
            if (!currentState) {
                console.warn('⚠️ BackupManager: No state data available for session backup');
                return false;
            }

            // Check if data is meaningful (has at least one cycle)
            const cycleCount = Object.keys(currentState?.data?.cycles || {}).length;
            const liteStorage = collectLiteStorageSnapshot();
            if (cycleCount === 0 && !liteStorage) {
                return false;
            }

            const backup = this._buildBackupRecord(currentState, 'session', { cycleCount, liteStorage });

            // Save to IndexedDB
            await this.saveBackup(SESSION_BACKUP_STORE, backup);

            // Clean up old session backups (keep only last 5)
            await this.enforceSessionRetentionPolicy();

            return true;

        } catch (error) {
            console.error('❌ BackupManager: Session backup failed', error);
            return false;
        }
    }

    /**
     * Enforce session backup retention: keep only last N session backups
     * @private
     */
    async enforceSessionRetentionPolicy() {
        try {
            const sessionBackups = await this.getBackupsFromStore(SESSION_BACKUP_STORE);

            if (sessionBackups.length > MAX_SESSION_BACKUPS) {
                // Delete oldest backups
                const toDelete = sessionBackups.slice(MAX_SESSION_BACKUPS);

                await Promise.all(toDelete.map(backup => this.deleteBackup(backup.timestamp, 'session')));

            }

        } catch (error) {
            console.error('❌ BackupManager: Session retention policy enforcement failed', error);
        }
    }

    /**
     * Create a manual backup with user-specified name
     * @param {string} name - Backup name
     * @returns {Promise<boolean>}
     */
    async createManualBackup(name) {
        try {
            await this.init();

            // DI-pure (no window.* fallback)
            const AppState = this._getAppState();
            if (!AppState?.isReady?.()) {
                throw new Error('AppState not ready');
            }

            const currentState = AppState.get();
            if (!currentState) {
                throw new Error('No state data available');
            }

            const timestamp = Date.now();
            const backup = this._buildBackupRecord(currentState, 'manual', {
                id: `manual_${timestamp}`,
                name: name || `Manual Backup ${new Date().toLocaleString()}`,
                timestamp
            });

            await this.saveBackup(MANUAL_BACKUP_STORE, backup);

            // Clean up old manual backups (keep only last 50)
            await this.enforceManualRetentionPolicy();

            return true;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Enforce manual backup retention: keep only last N manual backups
     * @private
     */
    async enforceManualRetentionPolicy() {
        try {
            const manualBackups = await this.getBackupsFromStore(MANUAL_BACKUP_STORE);

            if (manualBackups.length > MAX_MANUAL_BACKUPS) {
                // Delete oldest backups
                const toDelete = manualBackups.slice(MAX_MANUAL_BACKUPS);

                await Promise.all(toDelete.map(backup => this.deleteBackup(backup.id, 'manual')));

            }

        } catch (error) {
            console.error('❌ BackupManager: Manual retention policy enforcement failed', error);
        }
    }

    /**
     * Save backup to IndexedDB store
     * @private
     */
    async saveBackup(storeName, backup) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(backup);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get the most recent auto-backup
     * @returns {Promise<Object|null>}
     */
    async getLastAutoBackup() {
        return this.getLastBackupFromStore(AUTO_BACKUP_STORE);
    }

    /**
     * Get the most recent backup from any store
     * @param {string} storeName - The store to query
     * @returns {Promise<Object|null>}
     * @private
     */
    async getLastBackupFromStore(storeName) {
        try {
            await this.init();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const index = store.index('timestamp');
                const request = index.openCursor(null, 'prev'); // Get newest first

                request.onsuccess = () => {
                    const cursor = request.result;
                    resolve(cursor ? cursor.value : null);
                };

                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error(`❌ BackupManager: Failed to get last backup from ${storeName}`, error);
            return null;
        }
    }

    /**
     * List all backups (auto, manual, session, and test)
     * @returns {Promise<{auto: Array, manual: Array, session: Array, test: Array}>}
     */
    async listAllBackups() {
        try {
            await this.init();

            const autoBackups = await this.getBackupsFromStore(AUTO_BACKUP_STORE);
            const manualBackups = await this.getBackupsFromStore(MANUAL_BACKUP_STORE);
            const sessionBackups = await this.getBackupsFromStore(SESSION_BACKUP_STORE);
            const testBackups = await this.getBackupsFromStore(TEST_BACKUP_STORE);

            return { auto: autoBackups, manual: manualBackups, session: sessionBackups, test: testBackups };
        } catch (error) {
            console.error('❌ BackupManager: Failed to list backups', error);
            return { auto: [], manual: [], session: [], test: [] };
        }
    }

    /**
     * Get all backups from a specific store
     * @private
     */
    async getBackupsFromStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const backups = request.result;
                // Sort by timestamp (newest first)
                backups.sort((a, b) => b.timestamp - a.timestamp);
                resolve(backups);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Restore backup by timestamp or ID
     * @param {number|string} identifier - timestamp (auto/session) or id (manual)
     * @param {string} type - 'auto', 'manual', or 'session'
     * @returns {Promise<Object>} - Restored data
     */
    async restoreBackup(identifier, type = 'auto', options = {}) {
        try {
            const { format = 'data' } = options;
            const backup = await this.getBackupBundle(identifier, type);

            if (!backup) {
                throw new Error(`Backup not found: ${identifier}`);
            }

            if (format === 'bundle') {
                return backup;
            }
            if (format === 'portable') {
                return buildPortableBackupPayload(backup);
            }

            return backup.data;

        } catch (error) {
            console.error('❌ BackupManager: Restore failed', error);
            throw error;
        }
    }

    async getBackupBundle(identifier, type = 'auto') {
        await this.init();
        const storeName = this._getStoreName(type);
        return this.getBackup(storeName, identifier);
    }

    /**
     * Get specific backup from store
     * @private
     */
    async getBackup(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete specific backup
     * @param {number|string} identifier - timestamp or id
     * @param {string} type - 'auto', 'manual', or 'session'
     * @returns {Promise<boolean>}
     */
    async deleteBackup(identifier, type = 'auto') {
        try {
            await this.init();

            const storeName = this._getStoreName(type);

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(identifier);

                request.onsuccess = () => {
                    resolve(true);
                };

                request.onerror = () => reject(request.error);
            });

        } catch (error) {
            console.error('❌ BackupManager: Delete failed', error);
            return false;
        }
    }

    /**
     * Enforce retention policy: keep only last N auto-backups
     * @private
     */
    async enforceRetentionPolicy() {
        try {
            const autoBackups = await this.getBackupsFromStore(AUTO_BACKUP_STORE);

            if (autoBackups.length > MAX_AUTO_BACKUPS) {
                // Delete oldest backups
                const toDelete = autoBackups.slice(MAX_AUTO_BACKUPS);

                await Promise.all(toDelete.map(backup => this.deleteBackup(backup.timestamp, 'auto')));

            }

        } catch (error) {
            console.error('❌ BackupManager: Retention policy enforcement failed', error);
        }
    }

    /**
     * Export backup as .mcyc file
     * @param {number|string} identifier
     * @param {string} type - 'auto', 'manual', or 'session'
     */
    async exportBackup(identifier, type = 'auto') {
        try {
            const backup = await this.getBackupBundle(identifier, type);

            if (!backup) {
                throw new Error('Backup not found');
            }

            const portablePayload = buildPortableBackupPayload(backup);
            if (!portablePayload) {
                throw new Error('Backup payload is empty');
            }

            const filename = `backup_${new Date(backup.timestamp).toISOString().replace(/[:.]/g, '-')}.mcyc`;
            const blob = new Blob([JSON.stringify(portablePayload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return true;

        } catch (error) {
            console.error('❌ BackupManager: Export failed', error);
            throw error;
        }
    }

    /**
     * Get backup statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        try {
            const { auto, manual, session, test } = await this.listAllBackups();

            const totalSize = [...auto, ...manual, ...session, ...test].reduce((sum, backup) => {
                return sum + (backup.metadata?.size || 0);
            }, 0);

            return {
                autoBackups: auto.length,
                manualBackups: manual.length,
                sessionBackups: session.length,
                testBackups: test.length,
                totalBackups: auto.length + manual.length + session.length + test.length,
                totalSize: totalSize,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                oldestBackup: auto.length > 0 ? new Date(auto[auto.length - 1].timestamp) : null,
                newestBackup: auto.length > 0 ? new Date(auto[0].timestamp) : null
            };
        } catch (error) {
            console.error('❌ BackupManager: Failed to get stats', error);
            return null;
        }
    }
}

// ==========================================
// 🌐 GLOBAL EXPORT
// ==========================================

// Create singleton instance
const backupManager = new BackupManager();

// DI-pure module (no window.* fallbacks for dependencies)

// Named export (preferred over default export)
export { backupManager };
