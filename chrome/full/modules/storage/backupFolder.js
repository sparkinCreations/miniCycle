/**
 * 📁 Backup Folder (DI-Pure)
 *
 * A daily backup FILE written silently to a folder on the device: desktop →
 * Documents/miniCycle Backups through the shell's IPC (desktopBridge), Android →
 * the public Documents/miniCycle folder, iPhone → Backups inside the app's
 * Documents folder shown in the Files app (both through the Filesystem plugin,
 * capacitorBridge). Unlike the IndexedDB snapshots BackupManager keeps, these
 * files outlive the app's own storage, and the user can see them; on desktop
 * and Android they also outlive an uninstall. Nothing here touches the network.
 *
 * The file is the same JSON the Backup button writes, so Restore All Routines
 * reads it. One file per local day (BACKUP_FOLDER.FILE_PREFIX + YYYY-MM-DD),
 * rewritten through the day whenever the state changed, newest
 * LIMITS.BACKUP_FOLDER_KEEP kept. uiBoot calls writeDailyBackupFile on app open
 * and whenever the app is hidden, beside the snapshots.
 *
 * On the web there is no adapter and every call is a no-op; the Settings panel
 * shows the folder note only when isAvailable() is true.
 *
 * Pattern: Simple Instance ✨ — required deps via diBase.js.
 *
 * @module storage/backupFolder
 */

import { createDIModule, required } from '../core/diBase.js';
import { LIMITS, SCHEMA, APP_VERSION, BACKUP_FOLDER, BACKUP_TRIGGERS } from '../core/constants.js';
import { getRoutines } from '../utils/cycleMode.js';
import { isDesktopApp, getDesktopBackupFolder } from '../platform/desktopBridge.js';
import { getNativeBackupFolder } from '../platform/capacitorBridge.js';
import { collectLiteStorageSnapshot } from './backupManager.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('BackupFolder', {
    AppState: required()
});

/**
 * Set dependencies for BackupFolder
 * @param {Object} dependencies - { AppState }
 */
export function setBackupFolderDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * @typedef {Object} BackupFolderAdapter
 * @property {function(): Promise<string>} describe - where the folder is, for the user
 * @property {function(string, string): Promise<*>} write - write a file (name, text)
 * @property {function(): Promise<Array<{name: string, size: number, mtime: number}>>} list
 * @property {function(string): Promise<string>} read
 * @property {function(string): Promise<*>} remove
 */

function localDateStamp(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** The local-midnight timestamp a daily file name stands for, or 0. */
function timestampFromName(name) {
    const m = /(\d{4})-(\d{2})-(\d{2})\.json$/.exec(name || '');
    if (!m) return 0;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

export class BackupFolder {
    constructor() {
        /** @type {BackupFolderAdapter|null|undefined} undefined = not resolved yet */
        this._adapter = undefined;
        /** The modified stamp of the state last written this session (null = none yet). */
        this._lastStamp = null;
        this._inFlight = null;
    }

    get deps() {
        return di.resolve();
    }

    /**
     * Test seam / shell override: use this adapter instead of the platform's.
     * @param {BackupFolderAdapter|null} adapter
     */
    useAdapter(adapter) {
        this._adapter = adapter || null;
        this._lastStamp = null;
    }

    /** @returns {BackupFolderAdapter|null} @private */
    _resolveAdapter() {
        if (this._adapter !== undefined) return this._adapter;
        this._adapter = (isDesktopApp()
            ? getDesktopBackupFolder()
            : getNativeBackupFolder({ android: BACKUP_FOLDER.ANDROID_DIR, ios: BACKUP_FOLDER.IOS_DIR })) || null;
        return this._adapter;
    }

    /** True on a platform with a device folder (desktop, Android). */
    isAvailable() {
        return !!this._resolveAdapter();
    }

    /** Where the files are, worded for the user (e.g. "Documents/miniCycle Backups"), or null. */
    async describeFolder() {
        const adapter = this._resolveAdapter();
        if (!adapter) return null;
        try {
            return await adapter.describe();
        } catch {
            return null;
        }
    }

    /** The daily file name for a date (local day). */
    static fileNameFor(date = new Date()) {
        return `${BACKUP_FOLDER.FILE_PREFIX}${localDateStamp(date)}.json`;
    }

    /**
     * The backup-file payload for a state document — the shape Restore All
     * Routines reads (schemaVersion + miniCycleData string + backupMetadata +
     * the Lite snapshot when present).
     * @param {Object} state
     * @param {string} trigger - BACKUP_TRIGGERS.*
     * @returns {Object}
     */
    buildPayload(state, trigger = BACKUP_TRIGGERS.OPEN) {
        const liteStorage = collectLiteStorageSnapshot();
        const payload = {
            schemaVersion: SCHEMA.CURRENT,
            miniCycleData: JSON.stringify(state),
            backupMetadata: {
                createdAt: Date.now(),
                version: APP_VERSION,
                schemaVersion: state?.metadata?.schemaVersion || SCHEMA.CURRENT,
                includesLiteStorage: Boolean(liteStorage),
                source: 'miniCycle App',
                automatic: true,
                trigger,
                stateModified: state?.metadata?.lastModified || 0
            }
        };
        if (liteStorage) payload.liteStorage = liteStorage;
        return payload;
    }

    /**
     * Write today's file when the state changed since the last write (this
     * session, or today's file on disk on the first call), then rotate. Never
     * throws; a failed write is logged and reported as false. Concurrent calls
     * share one write.
     * @param {{reason?: string}} [options]
     * @returns {Promise<boolean>} true when a file was written
     */
    async writeDailyBackupFile({ reason = BACKUP_TRIGGERS.OPEN } = {}) {
        if (this._inFlight) return this._inFlight;
        this._inFlight = this._writeDailyBackupFile(reason)
            .finally(() => { this._inFlight = null; });
        return this._inFlight;
    }

    /** @private */
    async _writeDailyBackupFile(reason) {
        const adapter = this._resolveAdapter();
        if (!adapter) return false;
        try {
            const AppState = this.deps.AppState;
            if (!AppState.isReady()) return false;
            const state = AppState.get();
            if (!state) return false;
            const routines = getRoutines(state);
            if (!routines || Object.keys(routines).length === 0) return false;

            const stamp = state.metadata?.lastModified || 0;
            if (stamp && stamp === this._lastStamp) return false;

            const name = BackupFolder.fileNameFor(new Date());
            if (this._lastStamp === null && stamp) {
                // First write this session: today's file may already hold this
                // very state (a reopen with nothing changed).
                try {
                    const existing = JSON.parse(await adapter.read(name));
                    if (existing?.backupMetadata?.stateModified === stamp) {
                        this._lastStamp = stamp;
                        return false;
                    }
                } catch {
                    // no file for today yet, or unreadable — write it
                }
            }

            await adapter.write(name, JSON.stringify(this.buildPayload(state, reason), null, 2));
            this._lastStamp = stamp;
            await this._rotate(adapter);
            return true;
        } catch (error) {
            console.warn('📁 BackupFolder: daily backup file not written (non-critical):', error);
            return false;
        }
    }

    /** Keep the newest LIMITS.BACKUP_FOLDER_KEEP daily files (names sort by date). @private */
    async _rotate(adapter) {
        const files = (await adapter.list())
            .filter((f) => BACKUP_FOLDER.FILE_PATTERN.test(f.name))
            .sort((a, b) => b.name.localeCompare(a.name));
        for (const stale of files.slice(LIMITS.BACKUP_FOLDER_KEEP)) {
            try {
                await adapter.remove(stale.name);
            } catch (error) {
                console.warn('📁 BackupFolder: could not remove an old backup file:', stale.name, error);
            }
        }
    }

    /**
     * The daily files in the folder, newest first.
     * @returns {Promise<Array<{name: string, size: number, timestamp: number}>>}
     */
    async listBackupFiles() {
        const adapter = this._resolveAdapter();
        if (!adapter) return [];
        const files = await adapter.list();
        return files
            .filter((f) => BACKUP_FOLDER.FILE_PATTERN.test(f.name))
            .map((f) => ({ name: f.name, size: Number(f.size) || 0, timestamp: Number(f.mtime) || timestampFromName(f.name) }))
            .sort((a, b) => b.name.localeCompare(a.name));
    }

    /**
     * The text of one daily file. Only names of the daily pattern are read.
     * @param {string} name
     * @returns {Promise<string>}
     */
    async readBackupFile(name) {
        const adapter = this._resolveAdapter();
        if (!adapter) throw new Error('No backup folder on this platform');
        if (!BACKUP_FOLDER.FILE_PATTERN.test(name)) throw new Error('Not a daily backup file name');
        return adapter.read(name);
    }
}

// ==========================================
// 🌐 EXPORT
// ==========================================

const backupFolder = new BackupFolder();

export { backupFolder };
