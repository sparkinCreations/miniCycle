/**
 * backupFiles.js — the daily backup files the web app writes through IPC.
 *
 * The web app (web/modules/storage/backupFolder.js) asks the shell to write one
 * JSON backup file per day into Documents/miniCycle Backups, list them, read one
 * back for a restore, and remove the oldest. Everything here is confined to that
 * folder: a name must match FILE_RE (no paths, no other files), and a write goes
 * through a temp file + rename so a crash mid-write never leaves a half file.
 * The folder name is also spelled in web/modules/core/constants.js
 * (BACKUP_FOLDER.DESKTOP_DIR) — keep the two in step.
 */

'use strict';

const DIR_NAME = 'miniCycle Backups';
const FILE_RE = /^miniCycle-auto-backup-\d{4}-\d{2}-\d{2}\.json$/;
const MAX_BYTES = 10 * 1024 * 1024;   // the same cap the in-app restore applies

/**
 * File operations bound to one folder. `fs` and `path` are injected so the
 * node test can point it at a temp directory.
 */
function createBackupFiles({ fs, path, dir }) {
    const safePath = (name) => {
        if (typeof name !== 'string' || !FILE_RE.test(name)) throw new Error('Not a daily backup file name');
        return path.join(dir, name);
    };
    return {
        dir,
        async write(name, text) {
            if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BYTES) throw new Error('Backup payload must be a non-empty string under 10 MB');
            const target = safePath(name);
            await fs.promises.mkdir(dir, { recursive: true });
            const tmp = `${target}.tmp`;
            await fs.promises.writeFile(tmp, text, 'utf8');
            await fs.promises.rename(tmp, target);
            return true;
        },
        async list() {
            let names;
            try {
                names = await fs.promises.readdir(dir);
            } catch (error) {
                if (error && error.code === 'ENOENT') return [];   // nothing written yet
                throw error;
            }
            const out = [];
            for (const name of names) {
                if (!FILE_RE.test(name)) continue;
                const stat = await fs.promises.stat(path.join(dir, name));
                if (!stat.isFile()) continue;
                out.push({ name, size: stat.size, mtime: stat.mtimeMs });
            }
            return out;
        },
        async read(name) {
            return fs.promises.readFile(safePath(name), 'utf8');
        },
        async remove(name) {
            await fs.promises.unlink(safePath(name));
            return true;
        }
    };
}

/** Register the IPC handlers preload.js invokes. Returns the bound file ops. */
function registerBackupIpc({ ipcMain, app, fs, path }) {
    const files = createBackupFiles({ fs, path, dir: path.join(app.getPath('documents'), DIR_NAME) });
    ipcMain.handle('minicycle:backups:folder', () => files.dir);
    ipcMain.handle('minicycle:backups:write', (_event, name, text) => files.write(name, text));
    ipcMain.handle('minicycle:backups:list', () => files.list());
    ipcMain.handle('minicycle:backups:read', (_event, name) => files.read(name));
    ipcMain.handle('minicycle:backups:remove', (_event, name) => files.remove(name));
    return files;
}

module.exports = { createBackupFiles, registerBackupIpc, DIR_NAME, FILE_RE };
