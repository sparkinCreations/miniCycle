/**
 * Migration Manager Tests
 * Tests for the boot entry and fresh-install factory. The pre-2.5 migration these
 * tests used to cover was retired Sep 2026 (docs/future-work/SCHEMA_2_6_PLAN.md).
 */

// Module-level variable for dynamic import
let MigrationManager;

export async function runMigrationManagerTests(resultsDiv, isPartOfSuite = false) {
    // Dynamic import with cache busting
    const cacheBuster = window.testCacheBuster || Date.now();
    MigrationManager = await import(`../modules/routine/migrationManager.js?v=${cacheBuster}`);
    resultsDiv.innerHTML = '<h2>🔄 Migration Manager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // 🔒 SAVE REAL APP DATA ONCE before all tests run (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleStorage', 'lastUsedMiniCycle', 'miniCycleReminders'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original storage for individual migration test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            sessionStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual migration test completed - original storage restored');
        }
    }

    async function test(name, testFn) {
        total.count++;

        try {
            // Clear all storage before each test
            localStorage.clear();
            sessionStorage.clear();

            // ✅ AWAIT async tests
            await testFn();

            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // Wrap all tests in try-finally to handle restoration properly
    try {

    // === DEPENDENCY INJECTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Dependency Injection</h4>';

    await test('sets dependencies correctly', () => {
        const mockDeps = {
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: (msg, type, duration) => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        };

        MigrationManager.setMigrationManagerDependencies(mockDeps);
        // If no error thrown, dependencies were set
    });

    await test('throws error when dependency missing', () => {
        // Reset dependencies
        MigrationManager.setMigrationManagerDependencies({
            storage: null,
            sessionStorage: null,
            showNotification: null,
            initialSetup: null,
            now: null,
            document: null
        });

        let thrown = false;
        try {
            MigrationManager.createInitialSchema25Data();
        } catch (error) {
            if (error.message.includes('missing required dependency')) {
                thrown = true;
            }
        }

        if (!thrown) {
            throw new Error('Should have thrown error for missing dependency');
        }
    });

    await test('validates all required dependencies', () => {
        const incompleteDeps = {
            storage: localStorage,
            sessionStorage: sessionStorage,
            // Missing other dependencies
        };

        MigrationManager.setMigrationManagerDependencies(incompleteDeps);

        let thrown = false;
        try {
            MigrationManager.createInitialSchema25Data();
        } catch (error) {
            if (error.message.includes('missing required dependency')) {
                thrown = true;
            }
        }

        if (!thrown) {
            throw new Error('Should validate all dependencies');
        }
    });

    // === INITIAL DATA CREATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🆕 Initial Data Creation</h4>';

    await test('creates valid Schema 2.5 structure', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        MigrationManager.createInitialSchema25Data();

        const data = JSON.parse(localStorage.getItem('miniCycleData'));

        if (data.schemaVersion !== "2.5") {
            throw new Error('Invalid schema version');
        }
    });

    await test('includes all required top-level keys', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        MigrationManager.createInitialSchema25Data();

        const data = JSON.parse(localStorage.getItem('miniCycleData'));
        const requiredKeys = ['metadata', 'settings', 'data', 'appState', 'userProgress', 'customReminders'];

        requiredKeys.forEach(key => {
            if (!(key in data)) {
                throw new Error(`Missing required key: ${key}`);
            }
        });
    });

    await test('includes metadata with timestamps', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        MigrationManager.createInitialSchema25Data();

        const data = JSON.parse(localStorage.getItem('miniCycleData'));

        if (!data.metadata.createdAt) {
            throw new Error('Missing createdAt timestamp');
        }
        if (!data.metadata.lastModified) {
            throw new Error('Missing lastModified timestamp');
        }
    });

    await test('includes empty cycles object', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        MigrationManager.createInitialSchema25Data();

        const data = JSON.parse(localStorage.getItem('miniCycleData'));

        if (!data.data.cycles || typeof data.data.cycles !== 'object') {
            throw new Error('Missing or invalid cycles object');
        }
    });

    await test('includes default settings', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        MigrationManager.createInitialSchema25Data();

        const data = JSON.parse(localStorage.getItem('miniCycleData'));

        if (data.settings.theme !== 'default') {
            throw new Error('Invalid default theme');
        }
        if (data.settings.darkMode !== false) {
            throw new Error('Invalid default darkMode');
        }
    });

    await test('saves to localStorage', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        MigrationManager.createInitialSchema25Data();

        const data = localStorage.getItem('miniCycleData');

        if (!data) {
            throw new Error('Data not saved to localStorage');
        }
    });

    await test('includes overdueTaskStates in appState', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        MigrationManager.createInitialSchema25Data();

        const data = JSON.parse(localStorage.getItem('miniCycleData'));

        if (!('overdueTaskStates' in data.appState)) {
            throw new Error('Missing overdueTaskStates in appState');
        }
    });

    // === BOOT ENTRY TESTS ===
    // The boot entry now only runs setup. It must never read, convert or delete the
    // legacy keys a pre-launch browser may still hold (retired Sep 2026).
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 Boot Entry</h4>';

    await test('initAppWithAutoMigration runs initialSetup, then onInitialSetupComplete', async () => {
        const calls = [];
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            now: () => Date.now(),
            initialSetup: async () => { await Promise.resolve(); calls.push('setup'); },
            onInitialSetupComplete: () => calls.push('ready')
        });
        await MigrationManager.initAppWithAutoMigration();
        if (calls.join(',') !== 'setup,ready') throw new Error(`expected setup,ready — got ${calls.join(',')}`);
    });

    await test('initAppWithAutoMigration leaves pre-2.5 keys untouched and converts nothing', async () => {
        const legacy = {
            miniCycleStorage: JSON.stringify({ 'Morning Routine': { title: 'Morning Routine', tasks: [{ id: 't1', text: 'Wake up' }], cycleCount: 5 } }),
            lastUsedMiniCycle: 'Morning Routine',
            miniCycleReminders: JSON.stringify({ enabled: true })
        };
        Object.entries(legacy).forEach(([k, v]) => localStorage.setItem(k, v));
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            now: () => Date.now(),
            initialSetup: () => {},
            onInitialSetupComplete: () => {}
        });
        await MigrationManager.initAppWithAutoMigration();
        for (const [k, v] of Object.entries(legacy)) {
            if (localStorage.getItem(k) !== v) throw new Error(`${k} was changed or deleted`);
        }
        if (localStorage.getItem('miniCycleData') !== null) throw new Error('legacy data was converted into miniCycleData');
        const backups = Object.keys(localStorage).filter(k => k.includes('migration_backup_'));
        if (backups.length > 0) throw new Error(`migration backups were written: ${backups.join(', ')}`);
    });

    await test('initAppWithAutoMigration fails fast when initialSetup is not injected', async () => {
        MigrationManager.setMigrationManagerDependencies({ initialSetup: null });
        let thrown = false;
        try {
            await MigrationManager.initAppWithAutoMigration();
        } catch (error) {
            thrown = error.message.includes('missing required dependency');
        }
        if (!thrown) throw new Error('should throw without initialSetup');
    });

    // === RESULTS SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    } catch (error) {
        console.error('Error running migration manager tests:', error);
        resultsDiv.innerHTML += `<div class="result fail">❌ Fatal error: ${error.message}</div>`;
    } finally {
        if (!isPartOfSuite) {
            // 🔒 RESTORE REAL APP DATA after individual test complete
            restoreOriginalData();
        }
    }

    return { passed: passed.count, total: total.count };
}
