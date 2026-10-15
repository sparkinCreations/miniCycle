'use strict';
// node --test: the folder-bound file ops behind the backups IPC.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBackupFiles, FILE_RE } = require('../src/backupFiles.js');

const freshDir = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'minicycle-backups-')), 'miniCycle Backups');

test('write creates the folder, lists the file, reads it back, removes it', async () => {
    const files = createBackupFiles({ fs, path, dir: freshDir() });
    assert.deepEqual(await files.list(), [], 'an absent folder lists as empty');
    await files.write('miniCycle-auto-backup-2026-10-15.json', '{"a":1}');
    const listed = await files.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].name, 'miniCycle-auto-backup-2026-10-15.json');
    assert.equal(listed[0].size, 7);
    assert.equal(await files.read('miniCycle-auto-backup-2026-10-15.json'), '{"a":1}');
    await files.remove('miniCycle-auto-backup-2026-10-15.json');
    assert.deepEqual(await files.list(), []);
    assert.equal(fs.existsSync(path.join(files.dir, 'miniCycle-auto-backup-2026-10-15.json.tmp')), false, 'no temp file left behind');
});

test('only daily backup names are accepted — no paths, no other files', async () => {
    const files = createBackupFiles({ fs, path, dir: freshDir() });
    for (const bad of ['../etc/passwd', 'notes.txt', 'miniCycle-auto-backup-2026-10-15.json/../x.json', 'miniCycle-auto-backup-20261015.json', '']) {
        await assert.rejects(files.write(bad, '{}'), /Not a daily backup file name/, bad);
        await assert.rejects(files.read(bad), /Not a daily backup file name/, bad);
        await assert.rejects(files.remove(bad), /Not a daily backup file name/, bad);
    }
    assert.ok(FILE_RE.test('miniCycle-auto-backup-2026-01-02.json'));
});

test('list ignores files that are not daily backups', async () => {
    const files = createBackupFiles({ fs, path, dir: freshDir() });
    await files.write('miniCycle-auto-backup-2026-10-14.json', '{}');
    fs.writeFileSync(path.join(files.dir, 'README.txt'), 'hi');
    fs.mkdirSync(path.join(files.dir, 'miniCycle-auto-backup-2026-10-13.json'));   // a directory with a matching name
    const names = (await files.list()).map((f) => f.name);
    assert.deepEqual(names, ['miniCycle-auto-backup-2026-10-14.json']);
});

test('write rejects an empty or oversized payload', async () => {
    const files = createBackupFiles({ fs, path, dir: freshDir() });
    await assert.rejects(files.write('miniCycle-auto-backup-2026-10-15.json', ''), /non-empty/);
    await assert.rejects(files.write('miniCycle-auto-backup-2026-10-15.json', 'x'.repeat(10 * 1024 * 1024 + 1)), /under 10 MB/);
});
