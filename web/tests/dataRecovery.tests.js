/**
 * DataRecovery — Browser Tests
 * Verifies corrupted-data salvage, backup snapshotting, and validation.
 */

export async function runDataRecoveryTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🩹 DataRecovery Tests</h2><h3>Loading module...</h3>';

    let mod;
    try {
        const cacheBuster = window.testCacheBuster || Date.now();
        mod = await import(`../modules/utils/dataRecovery.js?v=${cacheBuster}`);
        resultsDiv.innerHTML = '<h2>🩹 DataRecovery Tests</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>🩹 DataRecovery Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    const { attemptJsonSalvage, backupCorruptedData, validateRecoveredData, recoverCorruptedData } = mod;

    const passed = { count: 0 };
    const total = { count: 0 };

    function assert(cond, msg) { if (!cond) throw new Error(msg); }

    // In-memory Storage stand-in so tests never touch real localStorage.
    function mockStorage(seed = {}) {
        const map = new Map(Object.entries(seed));
        return {
            get length() { return map.size; },
            key(i) { return Array.from(map.keys())[i] ?? null; },
            getItem(k) { return map.has(k) ? map.get(k) : null; },
            setItem(k, v) { map.set(k, String(v)); },
            removeItem(k) { map.delete(k); },
            _map: map
        };
    }

    async function test(name, testFn) {
        total.count++;
        try {
            const result = testFn();
            if (result instanceof Promise) await result;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    const validData = { schemaVersion: '2.5', data: { cycles: { c1: { tasks: [] } } }, appState: {} };

    await test('attemptJsonSalvage: parses valid JSON directly', () => {
        const result = attemptJsonSalvage(JSON.stringify(validData));
        assert(result !== null, 'should not be null');
        assert(result.strategy === 'direct-parse', `expected direct-parse, got ${result?.strategy}`);
        assert(result.data.schemaVersion === '2.5', 'data round-trips');
    });

    await test('attemptJsonSalvage: strips control characters', () => {
        const dirty = '{"a":\x00 1,"b":\x07 2}';
        const result = attemptJsonSalvage(dirty);
        assert(result !== null, 'should salvage after stripping control chars');
        assert(result.strategy === 'remove-control-chars', `got ${result?.strategy}`);
        assert(result.data.a === 1 && result.data.b === 2, 'values preserved');
    });

    await test('attemptJsonSalvage: closes truncated brackets', () => {
        const truncated = '{"data":{"cycles":{"c1":{"tasks":[]}';
        const result = attemptJsonSalvage(truncated);
        assert(result !== null, 'should repair truncation');
        // The string-aware strategy runs first and handles this case; the
        // naive 'close-brackets' remains as last resort.
        assert(result.strategy === 'close-string-and-brackets', `got ${result?.strategy}`);
        assert(Array.isArray(result.data.data.cycles.c1.tasks), 'tasks array recovered');
    });

    await test('attemptJsonSalvage: repairs truncation MID-STRING (the common case)', () => {
        const truncated = '{"data":{"cycles":{"c1":{"tasks":[{"id":"t1","text":"buy mi';
        const result = attemptJsonSalvage(truncated);
        assert(result !== null, 'mid-string truncation should salvage');
        assert(result.strategy === 'close-string-and-brackets', `got ${result?.strategy}`);
        const task = result.data.data.cycles.c1.tasks[0];
        assert(task && task.id === 't1', 'task id recovered');
        assert(task.text === 'buy mi', `partial text preserved, got ${task?.text}`);
    });

    await test('attemptJsonSalvage: braces inside task text do not skew the repair', () => {
        const truncated = '{"data":{"cycles":{"c1":{"tasks":[{"id":"t1","text":"step {1} of {2}"}]}';
        const result = attemptJsonSalvage(truncated);
        assert(result !== null, 'should salvage despite braces in string');
        const task = result.data.data.cycles.c1.tasks[0];
        assert(task && task.text === 'step {1} of {2}', `in-string braces preserved, got ${task?.text}`);
    });

    await test('attemptJsonSalvage: repairs truncation ON a backslash (dangling escape)', () => {
        const truncated = '{"data":{"cycles":{"c1":{"tasks":[{"id":"t1","text":"line1\\';
        const result = attemptJsonSalvage(truncated);
        assert(result !== null, 'dangling-escape truncation should salvage');
        const task = result.data.data.cycles.c1.tasks[0];
        assert(task && task.text === 'line1', `text recovered without the dangling backslash, got ${task?.text}`);
    });

    await test('attemptJsonSalvage: strips a dangling partial member before closing', () => {
        const truncated = '{"data":{"cycles":{"c1":{"tasks":[],"cycleCount":';
        const result = attemptJsonSalvage(truncated);
        assert(result !== null, 'dangling key truncation should salvage');
        assert(Array.isArray(result.data.data.cycles.c1.tasks), 'tasks survive');
        assert(!('cycleCount' in result.data.data.cycles.c1), 'partial member dropped, not corrupted');
    });

    await test('attemptJsonSalvage: truncation MID-NUMBER drops the member instead of adopting a wrong value', () => {
        // Regression guard (Aug 2026 external review #5, fix corrected during
        // verification): `1723200000000` cut to `1723200` still parses after
        // bracket repair — the salvage adopted a silently WRONG number instead
        // of a visibly missing one. Two shapes must both be handled:
        // comma-preceded members, and the FIRST member of an object (the
        // reviewer's regex missed that one — and metadata.lastModified, the
        // most dangerous field to mangle, IS metadata's first member).
        const commaCase = '{"data":{"cycles":{}},"settings":{"theme":"dark","fontSize":16000';
        const r1 = attemptJsonSalvage(commaCase);
        assert(r1 !== null, 'comma-preceded mid-number truncation should still salvage');
        assert(!('fontSize' in r1.data.settings), `truncated number must be DROPPED, got fontSize=${r1.data.settings.fontSize}`);
        assert(r1.data.settings.theme === 'dark', 'intact sibling member survives');

        const firstMemberCase = '{"schemaVersion":"2.5","metadata":{"lastModified":1723200';
        const r2 = attemptJsonSalvage(firstMemberCase);
        assert(r2 !== null, 'first-member mid-number truncation should still salvage');
        assert(!('lastModified' in (r2.data.metadata || {})), `first-member truncated number must be DROPPED, got lastModified=${r2.data.metadata?.lastModified}`);
        assert(r2.data.schemaVersion === '2.5', 'preceding members survive');
    });

    await test('attemptJsonSalvage: intact trailing number member is NOT stripped', () => {
        // The mid-number strip must be a no-op on clean input: it only fires
        // when the string ends in a bare literal (never after `"`, `}`, `]`).
        const intact = '{"settings":{"fontSize":16},"count":42}';
        const result = attemptJsonSalvage(intact);
        assert(result !== null && result.data.settings.fontSize === 16 && result.data.count === 42,
            'legitimate number members must survive salvage untouched');
    });

    await test('attemptJsonSalvage: returns null for unrecoverable garbage', () => {
        assert(attemptJsonSalvage('not json at all <<<') === null, 'garbage → null');
        assert(attemptJsonSalvage('') === null, 'empty → null');
        assert(attemptJsonSalvage(null) === null, 'null → null');
    });

    await test('backupCorruptedData: stores a snapshot under a prefixed key', () => {
        const store = mockStorage();
        const key = backupCorruptedData('corrupted-blob', store);
        assert(typeof key === 'string', 'returns a key');
        assert(key.includes('_corrupted_'), `key has corrupted prefix: ${key}`);
        assert(store.getItem(key) === 'corrupted-blob', 'raw data stored verbatim');
    });

    await test('backupCorruptedData: prunes to MAX_CORRUPT_BACKUPS', () => {
        // Seed 3 old backups; a 4th must evict the oldest.
        const store = mockStorage({
            'miniCycleData_corrupted_1': 'a',
            'miniCycleData_corrupted_2': 'b',
            'miniCycleData_corrupted_3': 'c'
        });
        const newKey = backupCorruptedData('d', store);
        let backupCount = 0;
        for (let i = 0; i < store.length; i++) {
            if (store.key(i).includes('_corrupted_')) backupCount++;
        }
        assert(backupCount <= 3, `expected ≤3 backups, got ${backupCount}`);
        assert(store.getItem('miniCycleData_corrupted_1') === null, 'oldest evicted');
        assert(store.getItem(newKey) === 'd', 'newest kept');
    });

    await test('backupCorruptedData: returns null when storage is broken', () => {
        // A storage whose access throws must be handled gracefully → null, no throw. The old
        // first assertion (`=== null || typeof === 'string'`) was a tautology — the fn only
        // ever returns null or a string — and `null` storage falls back to real localStorage,
        // so it isn't actually "unavailable"; only the broken-storage case tests the name.
        const broken = { get length() { throw new Error('boom'); }, setItem() {}, removeItem() {}, key() {} };
        assert(backupCorruptedData('x', broken) === null, 'broken storage → null, no throw');
    });

    await test('validateRecoveredData: accepts well-shaped data', () => {
        assert(validateRecoveredData(validData) === true, 'schema-shaped data valid');
        assert(validateRecoveredData({ cycles: { c1: { tasks: [] } } }) === true, 'bare cycles map valid');
    });

    await test('validateRecoveredData: rejects malformed data', () => {
        assert(validateRecoveredData(null) === false, 'null invalid');
        assert(validateRecoveredData({ data: {} }) === false, 'no cycles invalid');
        assert(validateRecoveredData({ cycles: { c1: { tasks: 'nope' } } }) === false, 'non-array tasks invalid');
    });

    await test('recoverCorruptedData: salvages + backs up in one pass', () => {
        const store = mockStorage();
        const truncated = '{"schemaVersion":"2.5","data":{"cycles":{"c1":{"tasks":[]}';
        const result = recoverCorruptedData(truncated, { storage: store });
        assert(result.recovered === true, 'recovered flag set');
        assert(result.data.data.cycles.c1.tasks.length === 0, 'data salvaged');
        assert(typeof result.backupKey === 'string', 'backup snapshot taken');
        assert(store.getItem(result.backupKey) === truncated, 'raw corrupted string backed up');
    });

    await test('recoverCorruptedData: reports failure but still backs up', () => {
        const store = mockStorage();
        const result = recoverCorruptedData('total garbage }{][', { storage: store });
        assert(result.recovered === false, 'not recovered');
        assert(result.data === null, 'no data');
        assert(typeof result.backupKey === 'string', 'backup still taken for manual recovery');
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
