/**
 * 💾 Backup Manager Module
 *
 * Manages automatic and manual backups using IndexedDB for efficient,
 * non-blocking storage that doesn't compete with localStorage quota.
 *
 * @module storage/backupManager
 * @version 1.381
 */

// ==========================================
// 📦 DATABASE CONFIGURATION
// ==========================================

const DB_NAME = 'miniCycle_backups';
const DB_VERSION = 1;
const AUTO_BACKUP_STORE = 'auto_backups';
const MANUAL_BACKUP_STORE = 'manual_backups';
const MAX_AUTO_BACKUPS = 10; // Keep last 10 auto-backups
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Only backup once per day

class BackupManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.initPromise = null;
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

            request.onerror = () => {
                console.error('❌ BackupManager: Failed to open IndexedDB', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('✅ BackupManager: IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create auto-backups store
                if (!db.objectStoreNames.contains(AUTO_BACKUP_STORE)) {
                    const autoStore = db.createObjectStore(AUTO_BACKUP_STORE, { keyPath: 'timestamp' });
                    autoStore.createIndex('timestamp', 'timestamp', { unique: true });
                    console.log('✅ Created auto_backups store');
                }

                // Create manual-backups store
                if (!db.objectStoreNames.contains(MANUAL_BACKUP_STORE)) {
                    const manualStore = db.createObjectStore(MANUAL_BACKUP_STORE, { keyPath: 'id' });
                    manualStore.createIndex('timestamp', 'timestamp', { unique: false });
                    manualStore.createIndex('name', 'name', { unique: false });
                    console.log('✅ Created manual_backups store');
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
                if (timeSinceLastBackup < BACKUP_INTERVAL_MS) {
                    console.log('⏭️ BackupManager: Skipping auto-backup (last backup was recent)');
                    return false;
                }
            }

            // Get current app state
            if (!window.AppState?.isReady?.()) {
                console.warn('⚠️ BackupManager: AppState not ready, skipping auto-backup');
                return false;
            }

            const currentState = window.AppState.get();
            if (!currentState) {
                console.warn('⚠️ BackupManager: No state data available for backup');
                return false;
            }

            const timestamp = Date.now();
            const backup = {
                timestamp,
                data: currentState,
                metadata: {
                    version: currentState.metadata?.version || '1.371',
                    schemaVersion: currentState.metadata?.schemaVersion || '2.5',
                    size: JSON.stringify(currentState).length,
                    type: 'auto',
                    created: new Date(timestamp).toISOString()
                }
            };

            // Save to IndexedDB
            await this.saveBackup(AUTO_BACKUP_STORE, backup);

            // Clean up old backups
            await this.enforceRetentionPolicy();

            console.log(`✅ BackupManager: Auto-backup created (${(backup.metadata.size / 1024).toFixed(2)} KB)`);
            return true;

        } catch (error) {
            console.error('❌ BackupManager: Auto-backup failed', error);
            return false;
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

            if (!window.AppState?.isReady?.()) {
                throw new Error('AppState not ready');
            }

            const currentState = window.AppState.get();
            if (!currentState) {
                throw new Error('No state data available');
            }

            const timestamp = Date.now();
            const backup = {
                id: `manual_${timestamp}`,
                name: name || `Manual Backup ${new Date().toLocaleString()}`,
                timestamp,
                data: currentState,
                metadata: {
                    version: currentState.metadata?.version || '1.371',
                    schemaVersion: currentState.metadata?.schemaVersion || '2.5',
                    size: JSON.stringify(currentState).length,
                    type: 'manual',
                    created: new Date(timestamp).toISOString()
                }
            };

            await this.saveBackup(MANUAL_BACKUP_STORE, backup);

            console.log(`✅ BackupManager: Manual backup created: "${backup.name}"`);
            return true;

        } catch (error) {
            console.error('❌ BackupManager: Manual backup failed', error);
            throw error;
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
        try {
            await this.init();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([AUTO_BACKUP_STORE], 'readonly');
                const store = transaction.objectStore(AUTO_BACKUP_STORE);
                const index = store.index('timestamp');
                const request = index.openCursor(null, 'prev'); // Get newest first

                request.onsuccess = () => {
                    const cursor = request.result;
                    resolve(cursor ? cursor.value : null);
                };

                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ BackupManager: Failed to get last auto-backup', error);
            return null;
        }
    }

    /**
     * List all backups (auto and manual)
     * @returns {Promise<{auto: Array, manual: Array}>}
     */
    async listAllBackups() {
        try {
            await this.init();

            const autoBackups = await this.getBackupsFromStore(AUTO_BACKUP_STORE);
            const manualBackups = await this.getBackupsFromStore(MANUAL_BACKUP_STORE);

            return { auto: autoBackups, manual: manualBackups };
        } catch (error) {
            console.error('❌ BackupManager: Failed to list backups', error);
            return { auto: [], manual: [] };
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
     * @param {number|string} identifier - timestamp (auto) or id (manual)
     * @param {string} type - 'auto' or 'manual'
     * @returns {Promise<Object>} - Restored data
     */
    async restoreBackup(identifier, type = 'auto') {
        try {
            await this.init();

            const storeName = type === 'auto' ? AUTO_BACKUP_STORE : MANUAL_BACKUP_STORE;
            const backup = await this.getBackup(storeName, identifier);

            if (!backup) {
                throw new Error(`Backup not found: ${identifier}`);
            }

            console.log(`🔄 BackupManager: Restoring backup from ${new Date(backup.timestamp).toLocaleString()}`);
            return backup.data;

        } catch (error) {
            console.error('❌ BackupManager: Restore failed', error);
            throw error;
        }
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
     * @param {string} type - 'auto' or 'manual'
     * @returns {Promise<boolean>}
     */
    async deleteBackup(identifier, type = 'auto') {
        try {
            await this.init();

            const storeName = type === 'auto' ? AUTO_BACKUP_STORE : MANUAL_BACKUP_STORE;

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(identifier);

                request.onsuccess = () => {
                    console.log(`✅ BackupManager: Deleted ${type} backup: ${identifier}`);
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

                for (const backup of toDelete) {
                    await this.deleteBackup(backup.timestamp, 'auto');
                }

                console.log(`🧹 BackupManager: Cleaned up ${toDelete.length} old auto-backups`);
            }

        } catch (error) {
            console.error('❌ BackupManager: Retention policy enforcement failed', error);
        }
    }

    /**
     * Export backup as .mcyc file
     * @param {number|string} identifier
     * @param {string} type
     */
    async exportBackup(identifier, type = 'auto') {
        try {
            const storeName = type === 'auto' ? AUTO_BACKUP_STORE : MANUAL_BACKUP_STORE;
            const backup = await this.getBackup(storeName, identifier);

            if (!backup) {
                throw new Error('Backup not found');
            }

            const filename = `backup_${new Date(backup.timestamp).toISOString().replace(/[:.]/g, '-')}.mcyc`;
            const blob = new Blob([JSON.stringify(backup.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log(`✅ BackupManager: Exported backup as ${filename}`);
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
            const { auto, manual } = await this.listAllBackups();

            const totalSize = [...auto, ...manual].reduce((sum, backup) => {
                return sum + (backup.metadata?.size || 0);
            }, 0);

            return {
                autoBackups: auto.length,
                manualBackups: manual.length,
                totalBackups: auto.length + manual.length,
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

// Phase 2 Step 5 - Clean exports (no window.* pollution)
console.log('💾 BackupManager module loaded (Phase 2 - no window.* exports)');

export default backupManager;
