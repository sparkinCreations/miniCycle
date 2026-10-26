/**
 * BackupManager Tests
 * Tests for modules/storage/backupManager.js
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 *
 * Tests backup management functionality:
 * - Module loading and export
 * - Dependency injection
 * - IndexedDB initialization
 * - Auto-backup creation and retention
 * - Manual backup creation
 * - Backup listing and retrieval
 * - Backup restoration
 * - Backup deletion
 * - Statistics
 */

import {
    setupTestEnvironment,
    createProtectedTest,
    createMockAppState,
    createMockData,
    waitForAsyncOperations
} from './testHelpers.js';

// Module-level variables for dynamic imports
let backupManager, setBackupManagerDependencies;

export async function runBackupManagerTests(resultsDiv, isPartOfSuite = false) {
    // Dynamic import with cache busting
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/storage/backupManager.js?v=${cacheBuster}`);
    backupManager = module.backupManager;
    setBackupManagerDependencies = module.setBackupManagerDependencies;
    resultsDiv.innerHTML = '<h2>BackupManager Tests</h2><h3>Setting up mocks...</h3>';

    // Reset singleton state to avoid stale connections from previous test modules
    // (e.g., Testing Modal tests also import backupManager and may leave a cached initPromise)
    if (backupManager.db) {
        try { backupManager.db.close(); } catch (e) { /* ignore */ }
    }
    backupManager.db = null;
    backupManager.isInitialized = false;
    backupManager.initPromise = null;

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>BackupManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // Save real app data (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('Saved original localStorage for individual backupManager test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('Individual backupManager test completed - original localStorage restored');
        }
    }

    // Helper: Create mock AppState with Schema 2.5 data
    function createMockAppStateWithData(overrides = {}) {
        const mockData = createMockData(overrides);
        return {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => {
                fn(mockData);
                return mockData;
            }
        };
    }

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Set up default mock data
            const mockSchemaData = createMockData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === MODULE LOADING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('backupManager instance exists', () => {
        if (!backupManager) {
            throw new Error('backupManager instance not found');
        }
    });

    await test('backupManager has required methods', () => {
        const requiredMethods = [
            'init', 'createAutoBackup', 'createManualBackup',
            'listAllBackups', 'restoreBackup', 'deleteBackup',
            'exportBackup', 'getStats', 'getLastAutoBackup'
        ];

        for (const method of requiredMethods) {
            if (typeof backupManager[method] !== 'function') {
                throw new Error(`Missing method: ${method}`);
            }
        }
    });

    await test('setBackupManagerDependencies function exists', () => {
        if (typeof setBackupManagerDependencies !== 'function') {
            throw new Error('setBackupManagerDependencies not exported');
        }
    });

    await test('backupManager has correct initial state properties', () => {
        // Verify the properties exist (the singleton may already be initialized)
        if (typeof backupManager.isInitialized !== 'boolean') {
            throw new Error('isInitialized property should be boolean');
        }
    });

    // === DEPENDENCY INJECTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💉 Dependency Injection</h4>';

    await test('setBackupManagerDependencies accepts AppState', () => {
        const mockAppState = createMockAppStateWithData();

        // Should not throw
        setBackupManagerDependencies({
            AppState: mockAppState
        });
    });

    await test('setBackupManagerDependencies works with getter-based dependencies', () => {
        // DI supports both direct values and getters
        let getterCalled = false;
        const depsWithGetter = {
            get AppState() {
                getterCalled = true;
                return createMockAppStateWithData();
            }
        };

        setBackupManagerDependencies(depsWithGetter);
        // Getters should be preserved
    });

    // === INDEXEDDB INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🗄️ IndexedDB Initialization</h4>';

    await test('init() returns a Promise', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        const result = backupManager.init();
        if (!(result instanceof Promise)) {
            throw new Error('init() should return a Promise');
        }
        await result; // Wait for it to complete
    });

    await test('init() sets isInitialized to true', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        if (backupManager.isInitialized !== true) {
            throw new Error('isInitialized should be true after init()');
        }
    });

    await test('init() sets db property', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        if (!backupManager.db) {
            throw new Error('db property should be set after init()');
        }
    });

    await test('multiple init() calls return same promise', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        const promise1 = backupManager.init();
        const promise2 = backupManager.init();

        // Should be the same promise (singleton init)
        const db1 = await promise1;
        const db2 = await promise2;

        if (db1 !== db2) {
            throw new Error('Multiple init() calls should return same database');
        }
    });

    // === AUTO-BACKUP TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Auto Backup</h4>';

    await test('createAutoBackup returns a Promise', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        const result = backupManager.createAutoBackup();
        if (!(result instanceof Promise)) {
            throw new Error('createAutoBackup() should return a Promise');
        }
        await result;
    });

    await test('createAutoBackup creates a backup entry', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        await backupManager.createAutoBackup();

        // Check that a backup was created
        const { auto } = await backupManager.listAllBackups();
        if (auto.length === 0) {
            throw new Error('Should have at least one auto backup');
        }
    });

    await test('auto backup has timestamp', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        await backupManager.createAutoBackup();

        const lastBackup = await backupManager.getLastAutoBackup();
        if (!lastBackup || !lastBackup.timestamp) {
            throw new Error('Auto backup should have timestamp');
        }
    });

    await test('auto backup stores current data', async () => {
        const mockAppState = createMockAppStateWithData({ cycles: ['test-cycle-1', 'test-cycle-2'] });
        setBackupManagerDependencies({ AppState: mockAppState });

        await backupManager.createAutoBackup();

        const lastBackup = await backupManager.getLastAutoBackup();
        if (!lastBackup || !lastBackup.data) {
            throw new Error('Auto backup should have data');
        }
    });

    // === MANUAL BACKUP TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Manual Backup</h4>';

    await test('createManualBackup returns a Promise', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        const result = backupManager.createManualBackup('Test Backup');
        if (!(result instanceof Promise)) {
            throw new Error('createManualBackup() should return a Promise');
        }
        await result;
    });

    await test('createManualBackup uses provided name', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        await backupManager.createManualBackup('My Test Backup');

        const { manual } = await backupManager.listAllBackups();
        const found = manual.some(b => b.name && b.name.includes('My Test Backup'));
        if (!found) {
            throw new Error('Manual backup should have the provided name');
        }
    });

    await test('createManualBackup creates unique ID', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        await backupManager.createManualBackup('Unique Test 1');
        await waitForAsyncOperations(50);
        await backupManager.createManualBackup('Unique Test 2');

        const { manual } = await backupManager.listAllBackups();
        if (manual.length < 2) {
            throw new Error('Should have at least 2 manual backups');
        }

        const ids = manual.map(b => b.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
            throw new Error('Each backup should have a unique ID');
        }
    });

    // === LIST BACKUPS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Listing Backups</h4>';

    await test('listAllBackups returns object with auto and manual arrays', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        const result = await backupManager.listAllBackups();
        if (!Array.isArray(result.auto)) {
            throw new Error('Should have auto array');
        }
        if (!Array.isArray(result.manual)) {
            throw new Error('Should have manual array');
        }
    });

    await test('listAllBackups returns created backups', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        const initialBackups = await backupManager.listAllBackups();
        const initialManualCount = initialBackups.manual.length;

        // Note: createAutoBackup has a 24-hour cooldown, so we only test manual backup here
        await backupManager.createManualBackup('List Test Manual');

        const { manual } = await backupManager.listAllBackups();

        // When at retention limit (MAX_MANUAL_BACKUPS=50), a new backup replaces
        // the oldest so count stays the same. Accept either increase or same count.
        if (manual.length < initialManualCount) {
            throw new Error(`Expected at least ${initialManualCount} manual backups, got ${manual.length}`);
        }

        // The newly created backup must be present by name. Even at the retention
        // limit (MAX_MANUAL_BACKUPS=50) the NEW backup is kept and the OLDEST is
        // trimmed, so it is findable regardless of the total count. The old test
        // computed hasNewBackup and then left its only branch empty, asserting nothing.
        const hasNewBackup = manual.some(b => b.name === 'List Test Manual' || b.label === 'List Test Manual');
        if (!hasNewBackup) {
            throw new Error('newly created manual backup "List Test Manual" not found in listAllBackups()');
        }
    });

    // === SESSION SNAPSHOTS (open / hide) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🕘 Session snapshots: open vs hide, unchanged-state skip</h4>';

    const newestSession = async () => (await backupManager.listAllBackups()).session[0] || null;
    // Each fixture's lastModified must differ from every record already in the
    // store: the session/auto paths skip silently (return false) when the newest
    // record has the same value. Date.now() + random(0..999) could land on the
    // value a neighbouring test had just written (its st + 1, ms earlier), and
    // then a test that expects a write got false/false (WebKit CI, Oct 2026:
    // "concurrent calls ... share one write"). Strictly increasing, spaced
    // wider than the tests' own `+= 1` bumps, and based on this run's clock so
    // records left by an earlier run cannot match either.
    const touchBase = Date.now() * 1000;
    let touchSeq = 0;
    const touchedState = () => {
        const mock = createMockAppStateWithData();
        const st = mock.get();
        touchSeq += 1;
        st.metadata = { ...(st.metadata || {}), lastModified: touchBase + touchSeq * 10 };
        return { mock, st };
    };

    await test('createSessionBackup: a hide snapshot is written even inside the 5-minute gap and carries its trigger', async () => {
        const { mock, st } = touchedState();
        setBackupManagerDependencies({ AppState: mock });
        const first = await backupManager.createSessionBackup({ reason: 'hide' });
        if (!first) throw new Error('the first hide snapshot was not written');
        const a = await newestSession();
        if (!a || a.metadata?.trigger !== 'hide') throw new Error('the snapshot does not carry trigger=hide: ' + JSON.stringify(a && a.metadata));
        st.metadata.lastModified += 1;
        const second = await backupManager.createSessionBackup({ reason: 'hide' });
        if (!second) throw new Error('a changed state inside the gap was not snapshotted on hide');
        // Assert on CONTENT, not on a new timestamp key: the store is keyed by the
        // millisecond, so two snapshots in the same ms share a key and the second
        // replaces the first (CI, Oct 2026). The newest record must hold the
        // changed state.
        const b = await newestSession();
        if (!b || b.data?.metadata?.lastModified !== st.metadata.lastModified) throw new Error('the newest record does not hold the changed state: ' + JSON.stringify(b && b.data && b.data.metadata));
    });

    await test('createSessionBackup: nothing changed since the last snapshot → skipped, on open and on hide', async () => {
        const { mock } = touchedState();
        setBackupManagerDependencies({ AppState: mock });
        if (!(await backupManager.createSessionBackup({ reason: 'hide' }))) throw new Error('setup snapshot not written');
        const before = await newestSession();
        if (await backupManager.createSessionBackup({ reason: 'hide' })) throw new Error('an unchanged state was snapshotted on hide');
        if (await backupManager.createSessionBackup({ reason: 'open' })) throw new Error('an unchanged state was snapshotted on open');
        if (await backupManager.createSessionBackup()) throw new Error('an unchanged state was snapshotted by the default call');
        const after = await newestSession();
        if (after.timestamp !== before.timestamp) throw new Error('a record was written for an unchanged state');
    });

    await test('createSessionBackup: on open, a changed state inside the 5-minute gap is still skipped (burst guard)', async () => {
        const { mock, st } = touchedState();
        setBackupManagerDependencies({ AppState: mock });
        if (!(await backupManager.createSessionBackup({ reason: 'hide' }))) throw new Error('setup snapshot not written');
        st.metadata.lastModified += 1;
        if (await backupManager.createSessionBackup({ reason: 'open' })) throw new Error('open inside the 5-minute gap wrote a snapshot');
        if (!(await backupManager.createSessionBackup({ reason: 'hide' }))) throw new Error('the same change was then refused on hide');
    });

    await test('createSessionBackup: concurrent calls (pagehide + visibilitychange) share one write', async () => {
        const { mock } = touchedState();
        setBackupManagerDependencies({ AppState: mock });
        // Count the WRITES, not records by timestamp: the store is keyed by the
        // millisecond, so neighbouring tests' records can share a key with this
        // one (CI, v2.619/v2.620: "got 2"; v2.622: a same-ms overwrite).
        const realSave = backupManager.saveBackup;
        let saves = 0;
        backupManager.saveBackup = function (...args) { saves++; return realSave.apply(this, args); };
        let a, b;
        try {
            [a, b] = await Promise.all([
            backupManager.createSessionBackup({ reason: 'hide' }),
            backupManager.createSessionBackup({ reason: 'hide' })
            ]);
        } finally {
            backupManager.saveBackup = realSave;
        }
        if (!a || !b) throw new Error('both callers should resolve with the shared result, got ' + a + '/' + b);
        if (saves !== 1) throw new Error('expected exactly one write from the pair, got ' + saves);
    });

    await test('createAutoBackup: an unchanged state since the last daily copy is skipped', async () => {
        const { mock } = touchedState();
        setBackupManagerDependencies({ AppState: mock });
        // Whether or not the 24h gate lets the first call through, the second call
        // sees an identical state and must not write.
        await backupManager.createAutoBackup();
        const { auto: before } = await backupManager.listAllBackups();
        if (await backupManager.createAutoBackup()) throw new Error('an unchanged state wrote a daily copy');
        const { auto: after } = await backupManager.listAllBackups();
        if (after.length !== before.length) throw new Error('the daily store changed for an unchanged state');
    });

    // === STATISTICS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Statistics</h4>';

    await test('getStats returns stats object', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        const stats = await backupManager.getStats();

        if (typeof stats.autoBackups !== 'number') {
            throw new Error('Should have autoBackups count');
        }
        if (typeof stats.manualBackups !== 'number') {
            throw new Error('Should have manualBackups count');
        }
        if (typeof stats.totalBackups !== 'number') {
            throw new Error('Should have totalBackups count');
        }
        if (typeof stats.totalSize !== 'number') {
            throw new Error('Should have totalSize');
        }
    });

    await test('getStats includes size in MB', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        await backupManager.createManualBackup('Stats Size Test');

        const stats = await backupManager.getStats();

        if (stats.totalSizeMB === undefined) {
            throw new Error('Should have totalSizeMB');
        }
    });

    // === RETENTION POLICY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Retention Policy</h4>';

    await test('enforceRetentionPolicy method exists', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        if (typeof backupManager.enforceRetentionPolicy !== 'function') {
            throw new Error('enforceRetentionPolicy method should exist');
        }
    });

    await test('enforceRetentionPolicy does not throw', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        // Should not throw
        await backupManager.enforceRetentionPolicy();
    });

    // === BACKUP METADATA TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Backup Metadata</h4>';

    await test('auto backup has metadata', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        await backupManager.createAutoBackup();

        const lastBackup = await backupManager.getLastAutoBackup();

        if (!lastBackup.metadata) {
            throw new Error('Backup should have metadata');
        }
        if (lastBackup.metadata.type !== 'auto') {
            throw new Error('Type should be "auto"');
        }
    });

    await test('manual backup has metadata', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        await backupManager.createManualBackup('Metadata Test');

        const { manual } = await backupManager.listAllBackups();
        const testBackup = manual.find(b => b.name && b.name.includes('Metadata Test'));

        if (!testBackup) {
            throw new Error('Should find the test backup');
        }
        if (!testBackup.metadata) {
            throw new Error('Backup should have metadata');
        }
        if (testBackup.metadata.type !== 'manual') {
            throw new Error('Type should be "manual"');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('handles missing AppState in auto backup', async () => {
        setBackupManagerDependencies({
            AppState: null
        });

        // Should not throw, just return false
        const result = await backupManager.createAutoBackup();
        if (result !== false) {
            throw new Error('Should return false with null AppState');
        }
    });

    // AppState is required() (STATE_TRUTH_MIGRATION #15). The manual backup used to throw
    // "AppState not ready" for a missing AppState too, so broken wiring read as a timing
    // problem. (The auto-backup test above cannot tell the two apart: a backup from the last
    // day returns false before AppState is read.)
    await test('createManualBackup names broken wiring, not "not ready", when AppState is not wired', async () => {
        setBackupManagerDependencies({ AppState: null });
        let message = null;
        try {
            await backupManager.createManualBackup('wiring probe');
        } catch (error) {
            message = error.message;
        } finally {
            setBackupManagerDependencies({ AppState: createMockAppStateWithData() });
        }
        if (!message || !message.includes('isReady')) {
            throw new Error(`expected a TypeError reading isReady, got ${message === null ? 'no throw' : JSON.stringify(message)}`);
        }
    });

    await test('restoreBackup throws for invalid ID', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        let threw = false;
        try {
            await backupManager.restoreBackup(999999999);
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for non-existent backup');
        }
    });

    await test('deleteBackup returns success for any ID', async () => {
        // Note: IndexedDB delete operations succeed even for non-existent keys
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        // Should return true (IndexedDB delete is idempotent)
        const result = await backupManager.deleteBackup(999999999);
        if (result !== true) {
            throw new Error('deleteBackup should return true for any ID');
        }
    });

    await test('exportBackup throws for invalid ID', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        let threw = false;
        try {
            await backupManager.exportBackup(999999999);
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for non-existent backup');
        }
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Performance</h4>';

    await test('init() completes within reasonable time', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });

        const startTime = performance.now();
        await backupManager.init();
        const duration = performance.now() - startTime;

        // Already initialized, should be very fast
        if (duration > 100) {
            throw new Error(`init() took too long: ${duration.toFixed(2)}ms`);
        }
    });

    await test('listAllBackups completes within reasonable time', async () => {
        const mockAppState = createMockAppStateWithData();
        setBackupManagerDependencies({ AppState: mockAppState });
        await backupManager.init();

        const startTime = performance.now();
        await backupManager.listAllBackups();
        const duration = performance.now() - startTime;

        if (duration > 500) {
            throw new Error(`listAllBackups took too long: ${duration.toFixed(2)}ms`);
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    // Restore original localStorage data (only when running individually)
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
