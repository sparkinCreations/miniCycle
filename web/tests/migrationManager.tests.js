/**
 * Migration Manager Tests
 * Tests for the Schema 2.5 migration system with strict dependency injection
 */

import * as MigrationManager from '../utilities/cycle/migrationManager.js';

export async function runMigrationManagerTests(resultsDiv, isPartOfSuite = false) {
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
        const sessionKeys = ['miniCycleLegacyModeActive', 'miniCycleMigrationFailureReason'];
        sessionKeys.forEach(key => {
            const value = sessionStorage.getItem(key);
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
                if (key.startsWith('miniCycleLegacy') || key.startsWith('miniCycleMigration')) {
                    sessionStorage.setItem(key, savedRealData[key]);
                } else {
                    localStorage.setItem(key, savedRealData[key]);
                }
            });
            console.log('✅ Individual migration test completed - original storage restored');
        }
    }

    // Helper: Create mock legacy data
    function createMockLegacyData() {
        return {
            cycles: {
                'Morning Routine': {
                    title: 'Morning Routine',
                    tasks: [
                        { id: 'task1', taskText: 'Wake up', checked: false },
                        { id: 'task2', taskText: 'Brush teeth', checked: false }
                    ],
                    autoReset: true,
                    deleteCheckedTasks: false,
                    cycleCount: 5
                },
                'Evening Routine': {
                    title: 'Evening Routine',
                    tasks: [
                        { id: 'task3', taskText: 'Dinner', checked: false }
                    ],
                    autoReset: false,
                    cycleCount: 2
                }
            }
        };
    }

    // Helper: Create complete Schema 2.5 mock
    function createMockSchema25Data() {
        return {
            schemaVersion: "2.5",
            metadata: {
                createdAt: Date.now(),
                lastModified: Date.now(),
                migratedFrom: null,
                migrationDate: null,
                totalCyclesCreated: 0,
                totalTasksCompleted: 0,
                schemaVersion: "2.5"
            },
            settings: {
                theme: 'default',
                darkMode: false,
                alwaysShowRecurring: false,
                autoSave: true,
                unlockedThemes: [],
                unlockedFeatures: []
            },
            data: {
                cycles: {}
            },
            appState: {
                activeCycleId: null,
                overdueTaskStates: {}
            },
            userProgress: {
                cyclesCompleted: 0,
                rewardMilestones: []
            },
            customReminders: {
                enabled: false,
                indefinite: false,
                dueDatesReminders: false,
                repeatCount: 0,
                frequencyValue: 30,
                frequencyUnit: "minutes"
            }
        };
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

    // === MIGRATION DETECTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔍 Migration Detection</h4>';

    await test('detects Schema 2.5 (no migration needed)', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const mockData = createMockSchema25Data();
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const result = MigrationManager.checkMigrationNeeded();

        if (result.needed !== false) {
            throw new Error('Should not need migration for Schema 2.5');
        }
        if (result.currentVersion !== "2.5") {
            throw new Error('Wrong version detected');
        }
    });

    await test('detects legacy data (migration needed)', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        // Ensure no Schema 2.5 data exists (already cleared by test function)
        // This test specifically checks legacy data detection
        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const result = MigrationManager.checkMigrationNeeded();

        if (result.needed !== true) {
            throw new Error(`Should need migration for legacy data. Got needed=${result.needed}, currentVersion=${result.currentVersion}`);
        }
    });

    await test('detects old cycles in localStorage', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const result = MigrationManager.checkMigrationNeeded();

        if (!result.oldDataFound.cycles) {
            throw new Error('Old cycles not detected');
        }
    });

    await test('detects lastUsedMiniCycle', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        localStorage.setItem('lastUsedMiniCycle', 'Morning Routine');

        const result = MigrationManager.checkMigrationNeeded();

        if (!result.oldDataFound.lastUsed) {
            throw new Error('lastUsed not detected');
        }
    });

    await test('detects reminders data', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        localStorage.setItem('miniCycleReminders', JSON.stringify({ enabled: true }));

        const result = MigrationManager.checkMigrationNeeded();

        if (!result.oldDataFound.reminders) {
            throw new Error('Reminders not detected');
        }
    });

    await test('returns correct currentVersion', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        // No data = legacy
        const result1 = MigrationManager.checkMigrationNeeded();
        if (result1.currentVersion !== "legacy") {
            throw new Error('Should return "legacy" for no data');
        }

        // Schema 2.5 data
        const mockData = createMockSchema25Data();
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));
        const result2 = MigrationManager.checkMigrationNeeded();
        if (result2.currentVersion !== "2.5") {
            throw new Error('Should return "2.5" for Schema 2.5 data');
        }
    });

    await test('handles missing data gracefully', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        // No data at all
        const result = MigrationManager.checkMigrationNeeded();

        // Should not throw error
        if (typeof result !== 'object') {
            throw new Error('Should return object even with no data');
        }
    });

    // === MIGRATION SIMULATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🧪 Migration Simulation</h4>';

    await test('simulates migration without saving (dry run)', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const beforeKeys = Object.keys(localStorage);
        const result = MigrationManager.simulateMigrationToSchema25(true); // dryRun = true

        // Should not create miniCycleData in dry run
        if (localStorage.getItem('miniCycleData')) {
            throw new Error('Dry run should not save data');
        }

        if (!result.success) {
            throw new Error('Simulation should succeed');
        }
    });

    await test('performs actual migration when dryRun=false', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));
        localStorage.setItem('lastUsedMiniCycle', 'Morning Routine');

        const result = MigrationManager.simulateMigrationToSchema25(false); // dryRun = false

        if (!result.success) {
            throw new Error('Migration should succeed');
        }

        const newData = localStorage.getItem('miniCycleData');
        if (!newData) {
            throw new Error('Migration should save data');
        }
    });

    await test('migrates cycles correctly', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const result = MigrationManager.simulateMigrationToSchema25(false);

        const newData = JSON.parse(localStorage.getItem('miniCycleData'));
        const cycleCount = Object.keys(newData.data.cycles).length;

        if (cycleCount !== 2) {
            throw new Error(`Expected 2 cycles, got ${cycleCount}`);
        }
    });

    await test('migrates activeCycleId', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));
        localStorage.setItem('lastUsedMiniCycle', 'Morning Routine');

        const result = MigrationManager.simulateMigrationToSchema25(false);

        const newData = JSON.parse(localStorage.getItem('miniCycleData'));

        if (newData.appState.activeCycleId !== 'Morning Routine') {
            throw new Error('Active cycle not migrated');
        }
    });

    await test('migrates reminders', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));
        localStorage.setItem('miniCycleReminders', JSON.stringify({
            enabled: true,
            indefinite: true,
            frequencyValue: 60
        }));

        const result = MigrationManager.simulateMigrationToSchema25(false);

        const newData = JSON.parse(localStorage.getItem('miniCycleData'));

        if (newData.customReminders.enabled !== true) {
            throw new Error('Reminders not migrated');
        }
    });

    await test('creates backup when dryRun=false', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const result = MigrationManager.simulateMigrationToSchema25(false);

        // Check for backup
        const hasBackup = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
            .some(key => key && key.startsWith('migration_backup_'));

        if (!hasBackup) {
            throw new Error('Backup not created');
        }
    });

    await test('returns success with changes array', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const result = MigrationManager.simulateMigrationToSchema25(false);

        if (!result.success) {
            throw new Error('Should return success');
        }
        if (!Array.isArray(result.changes)) {
            throw new Error('Should return changes array');
        }
        if (result.changes.length === 0) {
            throw new Error('Changes array should not be empty');
        }
    });

    await test('handles migration errors gracefully', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        // Create corrupted legacy data
        localStorage.setItem('miniCycleStorage', 'invalid json{{{');

        const result = MigrationManager.simulateMigrationToSchema25(false);

        if (result.success) {
            throw new Error('Should fail for corrupted data');
        }
        if (!Array.isArray(result.errors)) {
            throw new Error('Should return errors array');
        }
    });

    // === DATA VALIDATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Data Validation</h4>';

    await test('validates tasks with lenient rules', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const results = MigrationManager.validateAllMiniCycleTasksLenient();

        // Should return array (empty for valid data)
        if (!Array.isArray(results)) {
            throw new Error('Should return array');
        }
    });

    await test('detects missing task text', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const invalidData = {
            'Test Cycle': {
                tasks: [
                    { id: 'task1' } // Missing text
                ]
            }
        };
        localStorage.setItem('miniCycleStorage', JSON.stringify(invalidData));

        const results = MigrationManager.validateAllMiniCycleTasksLenient();

        if (results.length === 0) {
            throw new Error('Should detect missing text');
        }
    });

    await test('detects missing task ID', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const invalidData = {
            'Test Cycle': {
                tasks: [
                    { taskText: 'Test task' } // Missing id
                ]
            }
        };
        localStorage.setItem('miniCycleStorage', JSON.stringify(invalidData));

        const results = MigrationManager.validateAllMiniCycleTasksLenient();

        if (results.length === 0) {
            throw new Error('Should detect missing ID');
        }
    });

    await test('returns empty array for valid data', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const results = MigrationManager.validateAllMiniCycleTasksLenient();

        if (results.length !== 0) {
            throw new Error('Should return empty array for valid data');
        }
    });

    // === DATA FIXING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Data Fixing</h4>';

    await test('fixes missing recurCount', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const dataWithMissingField = {
            'Test Cycle': {
                tasks: [
                    {
                        id: 'task1',
                        taskText: 'Test task',
                        recurring: {
                            frequency: 'daily'
                            // Missing recurCount
                        }
                    }
                ]
            }
        };
        localStorage.setItem('miniCycleStorage', JSON.stringify(dataWithMissingField));

        const result = MigrationManager.fixTaskValidationIssues();

        if (!result.success) {
            throw new Error('Fix should succeed');
        }
        if (result.fixedCount === 0) {
            throw new Error('Should fix missing recurCount');
        }
    });

    await test('fixes missing frequency', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const dataWithMissingField = {
            'Test Cycle': {
                tasks: [
                    {
                        id: 'task1',
                        taskText: 'Test task',
                        recurring: {
                            recurCount: 1
                            // Missing frequency
                        }
                    }
                ]
            }
        };
        localStorage.setItem('miniCycleStorage', JSON.stringify(dataWithMissingField));

        const result = MigrationManager.fixTaskValidationIssues();

        const fixed = JSON.parse(localStorage.getItem('miniCycleStorage'));
        if (!fixed['Test Cycle'].tasks[0].recurring.frequency) {
            throw new Error('Should add default frequency');
        }
    });

    await test('adds daily block when missing', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const dataWithMissingBlock = {
            'Test Cycle': {
                tasks: [
                    {
                        id: 'task1',
                        taskText: 'Test task',
                        recurring: {
                            recurCount: 1,
                            frequency: 'daily'
                            // Missing daily block
                        }
                    }
                ]
            }
        };
        localStorage.setItem('miniCycleStorage', JSON.stringify(dataWithMissingBlock));

        const result = MigrationManager.fixTaskValidationIssues();

        const fixed = JSON.parse(localStorage.getItem('miniCycleStorage'));
        if (!fixed['Test Cycle'].tasks[0].recurring.daily) {
            throw new Error('Should add daily block');
        }
    });

    await test('saves fixed data to localStorage', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const dataWithMissingField = {
            'Test Cycle': {
                tasks: [
                    {
                        id: 'task1',
                        taskText: 'Test task',
                        recurring: {
                            frequency: 'daily'
                        }
                    }
                ]
            }
        };
        localStorage.setItem('miniCycleStorage', JSON.stringify(dataWithMissingField));

        MigrationManager.fixTaskValidationIssues();

        const fixed = localStorage.getItem('miniCycleStorage');
        if (!fixed) {
            throw new Error('Fixed data not saved');
        }
    });

    await test('returns fixedCount correctly', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const dataWithMultipleIssues = {
            'Test Cycle': {
                tasks: [
                    {
                        id: 'task1',
                        taskText: 'Test task',
                        recurring: {
                            // Missing multiple fields
                        }
                    }
                ]
            }
        };
        localStorage.setItem('miniCycleStorage', JSON.stringify(dataWithMultipleIssues));

        const result = MigrationManager.fixTaskValidationIssues();

        if (!result.fixedCount || result.fixedCount === 0) {
            throw new Error('Should return fixedCount > 0');
        }
    });

    // === MIGRATION EXECUTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 Migration Execution</h4>';

    await test('performSchema25Migration creates backup', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const result = MigrationManager.performSchema25Migration();

        const hasBackup = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
            .some(key => key && key.startsWith('pre_migration_backup_'));

        if (!hasBackup) {
            throw new Error('Should create pre-migration backup');
        }
    });

    await test('performSchema25Migration saves Schema 2.5', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        const legacyData = createMockLegacyData();
        localStorage.setItem('miniCycleStorage', JSON.stringify(legacyData.cycles));

        const result = MigrationManager.performSchema25Migration();

        const newData = localStorage.getItem('miniCycleData');
        if (!newData) {
            throw new Error('Schema 2.5 data not created');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('handles no legacy data gracefully', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        // No legacy data
        const result = MigrationManager.fixTaskValidationIssues();

        // Should not throw
        if (typeof result !== 'object') {
            throw new Error('Should return result object');
        }
    });

    await test('handles corrupted JSON gracefully', () => {
        MigrationManager.setMigrationManagerDependencies({
            storage: localStorage,
            sessionStorage: sessionStorage,
            showNotification: () => {},
            initialSetup: () => {},
            now: () => Date.now(),
            document: document
        });

        localStorage.setItem('miniCycleStorage', 'invalid json{{{');

        const result = MigrationManager.fixTaskValidationIssues();

        if (result.success) {
            throw new Error('Should report failure for corrupted data');
        }
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
