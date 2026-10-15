/**
 * BackupFolder Tests — modules/storage/backupFolder.js
 *
 * The daily backup FILE written to a device folder (desktop / Android). The
 * platform adapter is replaced by an in-memory folder through useAdapter(), so
 * the rules — one file per day, rewrite only when the state changed, keep the
 * newest 7, read-back of today's file on the first write, name validation —
 * run here without a shell.
 */
import { setupTestEnvironment, createProtectedTest, createMockData } from './testHelpers.js';

export async function runBackupFolderTests(resultsDiv, isPartOfSuite = false) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/storage/backupFolder.js?v=${cacheBuster}`);
    const { backupFolder, BackupFolder, setBackupFolderDependencies } = mod;

    resultsDiv.innerHTML = '<h2>BackupFolder Tests</h2><h3>Running tests...</h3>';
    await setupTestEnvironment();
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // An in-memory folder with the adapter contract (describe/write/list/read/remove).
    const memoryFolder = () => {
        const files = new Map();
        return {
            files,
            writes: 0,
            describe: async () => 'Documents/miniCycle Backups (test)',
            async write(name, text) { this.writes++; files.set(name, { text, mtime: Date.now() }); },
            async list() { return [...files.entries()].map(([name, f]) => ({ name, size: f.text.length, mtime: f.mtime })); },
            async read(name) { if (!files.has(name)) throw new Error('ENOENT'); return files.get(name).text; },
            async remove(name) { files.delete(name); }
        };
    };
    const stateWith = (stamp, title = 'Routine') => {
        const data = createMockData();
        data.metadata = { ...(data.metadata || {}), lastModified: stamp };
        if (!data.data?.routine || Object.keys(data.data.routine).length === 0) {
            data.data = { routine: { r1: { id: 'r1', title, tasks: [], cycleCount: 0 } } };
            data.appState = { activeRoutineId: 'r1' };
        } else {
            Object.values(data.data.routine)[0].title = title;
        }
        return data;
    };
    const wire = (state) => setBackupFolderDependencies({ AppState: { isReady: () => true, get: () => state, update: () => {} } });
    const today = BackupFolder.fileNameFor(new Date());

    try {
        await test('unavailable platform: no adapter → nothing written, nothing listed, not available', async () => {
            backupFolder.useAdapter(null);
            wire(stateWith(1));
            if (backupFolder.isAvailable()) throw new Error('available with no adapter');
            if (await backupFolder.writeDailyBackupFile()) throw new Error('wrote with no adapter');
            if ((await backupFolder.listBackupFiles()).length !== 0) throw new Error('listed files with no adapter');
            if (await backupFolder.describeFolder() !== null) throw new Error('described a folder with no adapter');
        });

        await test('first write creates today\'s file as a Restore-readable backup payload', async () => {
            const folder = memoryFolder();
            backupFolder.useAdapter(folder);
            const state = stateWith(1000, 'Morning');
            wire(state);
            if (!(await backupFolder.writeDailyBackupFile({ reason: 'open' }))) throw new Error('not written');
            if (!folder.files.has(today)) throw new Error('today\'s file missing, got ' + [...folder.files.keys()]);
            const payload = JSON.parse(folder.files.get(today).text);
            if (payload.schemaVersion !== '2.6' || typeof payload.miniCycleData !== 'string') throw new Error('not the backup-file shape: ' + Object.keys(payload));
            const inside = JSON.parse(payload.miniCycleData);
            if (Object.values(inside.data.routine)[0].title !== 'Morning') throw new Error('the document inside is not the state');
            if (payload.backupMetadata.stateModified !== 1000 || payload.backupMetadata.trigger !== 'open' || payload.backupMetadata.automatic !== true) throw new Error('metadata missing: ' + JSON.stringify(payload.backupMetadata));
            if (await backupFolder.describeFolder() !== 'Documents/miniCycle Backups (test)') throw new Error('describeFolder did not come from the adapter');
        });

        await test('unchanged state → no rewrite; changed state → today\'s file rewritten (one file per day)', async () => {
            const folder = memoryFolder();
            backupFolder.useAdapter(folder);
            const state = stateWith(2000);
            wire(state);
            await backupFolder.writeDailyBackupFile();
            if (await backupFolder.writeDailyBackupFile({ reason: 'hide' })) throw new Error('rewrote an unchanged state');
            if (folder.writes !== 1) throw new Error('expected 1 write, got ' + folder.writes);
            state.metadata.lastModified = 2001;
            if (!(await backupFolder.writeDailyBackupFile({ reason: 'hide' }))) throw new Error('a changed state was not written');
            if (folder.writes !== 2 || folder.files.size !== 1) throw new Error(`expected a rewrite of the same file (writes=${folder.writes}, files=${folder.files.size})`);
            if (JSON.parse(folder.files.get(today).text).backupMetadata.stateModified !== 2001) throw new Error('the rewrite does not hold the new stamp');
        });

        await test('a fresh session reads today\'s file first: same state on disk → nothing written', async () => {
            const folder = memoryFolder();
            folder.files.set(today, { text: JSON.stringify({ schemaVersion: '2.6', miniCycleData: '{}', backupMetadata: { stateModified: 3000 } }), mtime: 1 });
            backupFolder.useAdapter(folder);   // resets the in-memory stamp, like a new app session
            wire(stateWith(3000));
            if (await backupFolder.writeDailyBackupFile()) throw new Error('rewrote a file that already holds this state');
            if (folder.writes !== 0) throw new Error('a write happened');
            wire(stateWith(3001));
            backupFolder.useAdapter(folder);
            if (!(await backupFolder.writeDailyBackupFile())) throw new Error('a newer state was not written over the stale file');
        });

        await test('rotation keeps the newest 7 daily files and leaves other files alone', async () => {
            const folder = memoryFolder();
            for (let d = 1; d <= 9; d++) folder.files.set(`miniCycle-auto-backup-2026-09-${String(d).padStart(2, '0')}.json`, { text: '{}', mtime: d });
            folder.files.set('notes.txt', { text: 'keep me', mtime: 0 });
            backupFolder.useAdapter(folder);
            wire(stateWith(4000));
            if (!(await backupFolder.writeDailyBackupFile())) throw new Error('not written');
            const daily = [...folder.files.keys()].filter(n => /^miniCycle-auto-backup-/.test(n)).sort();
            if (daily.length !== 7) throw new Error('expected 7 daily files after rotation, got ' + daily.length + ': ' + daily.join(','));
            if (daily.includes('miniCycle-auto-backup-2026-09-01.json') || daily.includes('miniCycle-auto-backup-2026-09-03.json')) throw new Error('the oldest files survived: ' + daily.join(','));
            if (!daily.includes(today)) throw new Error('today\'s file was rotated out');
            if (!folder.files.has('notes.txt')) throw new Error('a foreign file was removed');
        });

        await test('listBackupFiles: only daily files, newest first, with size and a timestamp', async () => {
            const folder = memoryFolder();
            folder.files.set('miniCycle-auto-backup-2026-09-10.json', { text: '{"x":1}', mtime: 10 });
            folder.files.set('miniCycle-auto-backup-2026-09-12.json', { text: '{"x":12}', mtime: 12 });
            folder.files.set('other.json', { text: '{}', mtime: 99 });
            backupFolder.useAdapter(folder);
            const list = await backupFolder.listBackupFiles();
            if (list.map(f => f.name).join(',') !== 'miniCycle-auto-backup-2026-09-12.json,miniCycle-auto-backup-2026-09-10.json') throw new Error('wrong files/order: ' + list.map(f => f.name).join(','));
            if (list[0].size !== 8 || list[0].timestamp !== 12) throw new Error('size/timestamp wrong: ' + JSON.stringify(list[0]));
        });

        await test('readBackupFile refuses anything but a daily file name', async () => {
            const folder = memoryFolder();
            folder.files.set('miniCycle-auto-backup-2026-09-12.json', { text: '{"ok":true}', mtime: 12 });
            backupFolder.useAdapter(folder);
            if (await backupFolder.readBackupFile('miniCycle-auto-backup-2026-09-12.json') !== '{"ok":true}') throw new Error('did not read the file');
            let threw = false;
            try { await backupFolder.readBackupFile('../secrets.json'); } catch { threw = true; }
            if (!threw) throw new Error('a non-daily name was read');
        });

        await test('nothing is written while the state has no routine, and an adapter failure is swallowed', async () => {
            const folder = memoryFolder();
            backupFolder.useAdapter(folder);
            const empty = createMockData(); empty.data = { routine: {} }; empty.metadata = { lastModified: 5000 };
            wire(empty);
            if (await backupFolder.writeDailyBackupFile()) throw new Error('wrote with no routines');
            const broken = memoryFolder(); broken.write = async () => { throw new Error('disk full'); };
            backupFolder.useAdapter(broken);
            wire(stateWith(5001));
            if (await backupFolder.writeDailyBackupFile()) throw new Error('reported a write that failed');
        });

        await test('concurrent calls share one write', async () => {
            const folder = memoryFolder();
            backupFolder.useAdapter(folder);
            wire(stateWith(6000));
            const [a, b] = await Promise.all([backupFolder.writeDailyBackupFile(), backupFolder.writeDailyBackupFile()]);
            if (!a || !b || folder.writes !== 1) throw new Error(`expected one shared write (a=${a}, b=${b}, writes=${folder.writes})`);
        });
    } finally {
        backupFolder.useAdapter(null);
        backupFolder._adapter = undefined;   // back to platform resolution for anything that runs after
    }

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
