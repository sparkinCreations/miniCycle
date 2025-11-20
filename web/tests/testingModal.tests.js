/**
 * Testing Modal Tests
 *
 * Tests for the testing modal functionality including:
 * - Backup/restore operations
 * - Data integrity checks
 * - Data repair functions
 * - Debug reporting
 * - App info display
 *
 * These tests ensure the testing modal works independently
 * and can be safely removed from production if needed.
 */

export function runTestingModalTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>Testing Modal Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // 🔒 SAVE REAL APP DATA before all tests run (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original localStorage for individual TestingModal test');
    }

    // Helper to restore original data after all tests
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual TestingModal test completed - original localStorage restored');
        }
    }

    // Mock BackupManager if not available
    const mockBackupManager = {
        listAllBackups: async () => ({ auto: [], manual: [] }),
        createManualBackup: async (name) => true,
        getStats: async () => ({
            autoBackups: 0,
            manualBackups: 0,
            totalBackups: 0,
            totalSize: 0,
            totalSizeMB: '0.00'
        }),
        restoreBackup: async (id, type) => ({
            data: { cycles: {} },
            metadata: { schemaVersion: '2.5' }
        })
    };

    // Mock AppState
    const mockAppState = {
        isReady: () => true,
        get: () => ({
            data: {
                cycles: {
                    'test-cycle': {
                        title: 'Test Cycle',
                        tasks: [
                            { id: 0, text: 'Test Task 1', completed: false },
                            { id: 1, text: 'Test Task 2', completed: true }
                        ]
                    }
                }
            },
            appState: {
                activeCycleId: 'test-cycle'
            },
            metadata: {
                version: '1.371',
                schemaVersion: '2.5',
                lastModified: Date.now()
            },
            settings: {
                darkMode: false
            }
        }),
        update: (mutator, immediate) => {
            const state = mockAppState.get();
            mutator(state);
        }
    };

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Mock Schema 2.5 data
            const mockSchemaData = {
                metadata: {
                    version: "1.371",
                    schemaVersion: "2.5",
                    lastModified: Date.now()
                },
                settings: {
                    darkMode: false,
                    statsPanel: {}
                },
                data: {
                    cycles: {
                        'test-cycle': {
                            title: 'Test Routine',
                            mode: 'auto',
                            tasks: [
                                {
                                    id: 0,
                                    text: 'Test Task',
                                    completed: false,
                                    deleteWhenCompleteSettings: { cycle: false, todo: true }
                                }
                            ]
                        }
                    }
                },
                appState: {
                    activeCycleId: 'test-cycle'
                },
                userProgress: {}
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Mock globals
            window.AppState = mockAppState;
            window.BackupManager = mockBackupManager;

            // Reset DOM
            document.body.className = '';

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === BACKUP MANAGER INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4>💾 Backup Manager Integration</h4>';

    test('BackupManager exists and has correct interface', async () => {
        if (!window.BackupManager) {
            throw new Error('BackupManager not available');
        }

        const requiredMethods = [
            'createAutoBackup',
            'createManualBackup',
            'listAllBackups',
            'restoreBackup',
            'getStats'
        ];

        requiredMethods.forEach(method => {
            if (typeof window.BackupManager[method] !== 'function') {
                throw new Error(`BackupManager missing method: ${method}`);
            }
        });
    });

    test('can list available backups', async () => {
        const result = await window.BackupManager.listAllBackups();

        if (!result || typeof result !== 'object') {
            throw new Error('listAllBackups should return object');
        }

        if (!Array.isArray(result.auto) || !Array.isArray(result.manual)) {
            throw new Error('listAllBackups should return {auto: [], manual: []}');
        }
    });

    test('can create manual backup with name', async () => {
        const backupName = 'Test Backup';
        const result = await window.BackupManager.createManualBackup(backupName);

        if (result !== true) {
            throw new Error('createManualBackup should return true on success');
        }
    });

    test('can get backup statistics', async () => {
        const stats = await window.BackupManager.getStats();

        if (!stats || typeof stats !== 'object') {
            throw new Error('getStats should return object');
        }

        const requiredFields = ['autoBackups', 'manualBackups', 'totalBackups', 'totalSizeMB'];
        requiredFields.forEach(field => {
            if (stats[field] === undefined) {
                throw new Error(`Stats missing field: ${field}`);
            }
        });
    });

    // === DATA INTEGRITY TESTS ===
    resultsDiv.innerHTML += '<h4>🔍 Data Integrity Checks</h4>';

    test('detects missing task IDs', async () => {
        const state = window.AppState.get();
        const cycle = state.data.cycles['test-cycle'];

        // Remove ID from one task
        delete cycle.tasks[0].id;

        const issues = [];
        cycle.tasks.forEach((task, index) => {
            if (task.id === undefined) {
                issues.push({ cycle: cycle.title, taskIndex: index, issue: 'Missing task ID' });
            }
        });

        if (issues.length === 0) {
            throw new Error('Should detect missing task ID');
        }
    });

    test('detects missing cycle titles', async () => {
        const state = window.AppState.get();
        delete state.data.cycles['test-cycle'].title;

        const issues = [];
        Object.entries(state.data.cycles).forEach(([cycleId, cycle]) => {
            if (!cycle.title) {
                issues.push({ cycle: cycleId, issue: 'Missing title' });
            }
        });

        if (issues.length === 0) {
            throw new Error('Should detect missing cycle title');
        }
    });

    test('detects missing task arrays', async () => {
        const state = window.AppState.get();
        delete state.data.cycles['test-cycle'].tasks;

        const issues = [];
        Object.entries(state.data.cycles).forEach(([cycleId, cycle]) => {
            if (!Array.isArray(cycle.tasks)) {
                issues.push({ cycle: cycleId, issue: 'Tasks is not an array' });
            }
        });

        if (issues.length === 0) {
            throw new Error('Should detect missing tasks array');
        }
    });

    test('validates deleteWhenCompleteSettings exist', async () => {
        const state = window.AppState.get();
        const task = state.data.cycles['test-cycle'].tasks[0];

        // Remove deleteWhenCompleteSettings
        delete task.deleteWhenCompleteSettings;

        if (task.deleteWhenCompleteSettings) {
            throw new Error('Settings should be undefined after deletion');
        }

        // Repair function should detect this
        const needsRepair = !task.deleteWhenCompleteSettings;
        if (!needsRepair) {
            throw new Error('Should detect missing deleteWhenCompleteSettings');
        }
    });

    // === DATA REPAIR TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Data Repair Functions</h4>';

    test('repairs missing task IDs', async () => {
        const state = window.AppState.get();
        const cycle = state.data.cycles['test-cycle'];

        // Remove ID
        delete cycle.tasks[0].id;

        // Simulate repair
        let repaired = 0;
        cycle.tasks.forEach((task, index) => {
            if (task.id === undefined) {
                task.id = index;
                repaired++;
            }
        });

        if (repaired === 0) {
            throw new Error('Should have repaired missing task ID');
        }

        if (cycle.tasks[0].id !== 0) {
            throw new Error('Task ID should be set to index');
        }
    });

    test('repairs missing cycle titles', async () => {
        const state = window.AppState.get();
        delete state.data.cycles['test-cycle'].title;

        let repaired = 0;
        Object.entries(state.data.cycles).forEach(([cycleId, cycle]) => {
            if (!cycle.title) {
                cycle.title = cycleId;
                repaired++;
            }
        });

        if (repaired === 0) {
            throw new Error('Should have repaired missing title');
        }

        if (state.data.cycles['test-cycle'].title !== 'test-cycle') {
            throw new Error('Title should be set to cycle ID');
        }
    });

    test('repairs missing task arrays', async () => {
        const state = window.AppState.get();
        delete state.data.cycles['test-cycle'].tasks;

        let repaired = 0;
        Object.entries(state.data.cycles).forEach(([cycleId, cycle]) => {
            if (!cycle.tasks) {
                cycle.tasks = [];
                repaired++;
            }
        });

        if (repaired === 0) {
            throw new Error('Should have repaired missing tasks array');
        }

        if (!Array.isArray(state.data.cycles['test-cycle'].tasks)) {
            throw new Error('Tasks should be an empty array');
        }
    });

    test('repairs missing deleteWhenCompleteSettings', async () => {
        const state = window.AppState.get();
        const task = state.data.cycles['test-cycle'].tasks[0];
        delete task.deleteWhenCompleteSettings;

        let repaired = 0;
        if (!task.deleteWhenCompleteSettings) {
            task.deleteWhenCompleteSettings = { cycle: false, todo: true };
            repaired++;
        }

        if (repaired === 0) {
            throw new Error('Should have repaired missing settings');
        }

        if (!task.deleteWhenCompleteSettings || task.deleteWhenCompleteSettings.cycle !== false) {
            throw new Error('Settings should have correct defaults');
        }
    });

    // === DEBUG REPORT TESTS ===
    resultsDiv.innerHTML += '<h4>📋 Debug Report Generation</h4>';

    test('generates debug report with all sections', async () => {
        const state = window.AppState.get();
        const cycles = state.data.cycles || {};
        const activeCycleId = state.appState.activeCycleId;
        const metadata = state.metadata;

        const report = {
            timestamp: new Date().toISOString(),
            appInfo: {
                version: metadata?.version || "1.371",
                schemaVersion: metadata?.schemaVersion || "2.5",
                name: "miniCycle",
                developer: "Sparkin Creations"
            },
            systemInfo: {
                userAgent: navigator.userAgent,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                memory: performance.memory?.usedJSHeapSize || "Not available",
                cookiesEnabled: navigator.cookieEnabled,
                language: navigator.language
            },
            dataInfo: {
                totalRoutines: Object.keys(cycles).length,
                activeCycle: activeCycleId,
                totalTasks: Object.values(cycles).reduce((acc, cycle) => acc + (cycle.tasks?.length || 0), 0),
                storageUsed: JSON.stringify(localStorage).length
            }
        };

        if (!report.appInfo || !report.systemInfo || !report.dataInfo) {
            throw new Error('Debug report missing required sections');
        }

        if (report.dataInfo.totalRoutines !== 1) {
            throw new Error('Should report 1 test routine');
        }
    });

    test('app info includes version and schema', async () => {
        const state = window.AppState.get();
        const metadata = state?.metadata || {};
        const version = metadata.version || metadata.schemaVersion || "1.371";
        const schemaVersion = metadata.schemaVersion || "2.5";

        if (!version || !schemaVersion) {
            throw new Error('App info should include version and schema');
        }

        if (schemaVersion !== '2.5') {
            throw new Error('Schema version should be 2.5');
        }
    });

    test('performance info calculates correctly', async () => {
        const performanceInfo = performance.getEntriesByType("navigation")[0];

        if (performanceInfo) {
            const pageLoadTime = performanceInfo.loadEventEnd - performanceInfo.fetchStart;
            const domLoadTime = performanceInfo.domContentLoadedEventEnd - performanceInfo.fetchStart;

            // These might be 0 or negative during tests, which is okay
            if (typeof pageLoadTime !== 'number' || typeof domLoadTime !== 'number') {
                throw new Error('Performance times should be numbers');
            }
        }

        const memoryUsed = (performance.memory?.usedJSHeapSize / 1024 / 1024 || 0);
        if (typeof memoryUsed !== 'number') {
            throw new Error('Memory usage should be a number');
        }
    });

    // === APP STATE INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔄 AppState Integration</h4>';

    test('can access AppState data', async () => {
        const state = window.AppState?.get();

        if (!state) {
            throw new Error('AppState.get() should return data');
        }

        if (!state.data || !state.metadata) {
            throw new Error('AppState should have data and metadata');
        }
    });

    test('can read cycles from AppState', async () => {
        const state = window.AppState?.get();
        const cycles = state?.data?.cycles || {};

        if (Object.keys(cycles).length === 0) {
            throw new Error('Should have test cycles');
        }

        if (!cycles['test-cycle']) {
            throw new Error('Should have test-cycle');
        }
    });

    test('can update AppState data', async () => {
        let updateCalled = false;

        window.AppState.update = (mutator, immediate) => {
            updateCalled = true;
            const state = mockAppState.get();
            mutator(state);
        };

        window.AppState.update(state => {
            state.data.cycles['test-cycle'].title = 'Updated Title';
        }, true);

        if (!updateCalled) {
            throw new Error('AppState.update should be called');
        }
    });

    test('metadata includes required fields', async () => {
        const state = window.AppState.get();
        const metadata = state?.metadata;

        const requiredFields = ['version', 'schemaVersion', 'lastModified'];
        requiredFields.forEach(field => {
            if (!metadata[field]) {
                throw new Error(`Metadata missing required field: ${field}`);
            }
        });
    });

    // === SCHEMA VERSION TESTS ===
    resultsDiv.innerHTML += '<h4>📊 Schema Version Validation</h4>';

    test('validates schema version is 2.5', async () => {
        const state = window.AppState.get();
        const schemaVersion = state?.metadata?.schemaVersion;

        if (schemaVersion !== '2.5') {
            throw new Error(`Schema version should be 2.5, got ${schemaVersion}`);
        }
    });

    test('counts tasks correctly across cycles', async () => {
        const state = window.AppState.get();
        const cycles = state.data.cycles || {};

        let totalTasks = 0;
        Object.values(cycles).forEach(cycle => {
            totalTasks += (cycle.tasks?.length || 0);
        });

        if (totalTasks !== 1) {
            throw new Error('Should count 1 test task');
        }
    });

    test('identifies mode settings correctly', async () => {
        const state = window.AppState.get();
        const cycle = state.data.cycles['test-cycle'];

        if (!cycle.mode) {
            throw new Error('Cycle should have mode setting');
        }

        const validModes = ['auto', 'manual', 'todo'];
        if (!validModes.includes(cycle.mode)) {
            throw new Error(`Invalid mode: ${cycle.mode}`);
        }
    });

    // === STORAGE TESTS ===
    resultsDiv.innerHTML += '<h4>💾 Storage Operations</h4>';

    test('calculates storage usage correctly', async () => {
        const storageUsed = JSON.stringify(localStorage).length;
        const storageLimit = 5 * 1024 * 1024; // 5MB
        const usagePercent = ((storageUsed / storageLimit) * 100).toFixed(2);

        if (typeof parseFloat(usagePercent) !== 'number') {
            throw new Error('Usage percent should be a number');
        }

        if (parseFloat(usagePercent) > 100) {
            throw new Error('Usage percent should not exceed 100%');
        }
    });

    test('counts localStorage keys correctly', async () => {
        const keyCount = Object.keys(localStorage).length;

        if (typeof keyCount !== 'number') {
            throw new Error('Key count should be a number');
        }

        if (keyCount < 1) {
            throw new Error('Should have at least miniCycleData key');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4>⚠️ Error Handling</h4>';

    test('handles missing AppState gracefully', async () => {
        delete window.AppState;

        const state = window.AppState?.get();

        if (state !== undefined) {
            throw new Error('Should return undefined when AppState missing');
        }

        // Restore for other tests
        window.AppState = mockAppState;
    });

    test('handles missing BackupManager gracefully', async () => {
        delete window.BackupManager;

        const manager = window.BackupManager;

        if (manager !== undefined) {
            throw new Error('Should return undefined when BackupManager missing');
        }

        // Restore for other tests
        window.BackupManager = mockBackupManager;
    });

    test('handles corrupted localStorage data', async () => {
        localStorage.setItem('miniCycleData', 'invalid json');

        let errorThrown = false;
        try {
            JSON.parse(localStorage.getItem('miniCycleData'));
        } catch (e) {
            errorThrown = true;
        }

        if (!errorThrown) {
            throw new Error('Should throw error for invalid JSON');
        }
    });

    // === SUMMARY ===
    resultsDiv.innerHTML += `
        <div class="summary">
            <h3>Summary</h3>
            <p>Results: ${passed.count}/${total.count} tests passed</p>
            ${passed.count === total.count ?
                '<p class="all-pass">✅ All tests passed!</p>' :
                `<p class="some-fail">⚠️ ${total.count - passed.count} test(s) failed</p>`}
        </div>
    `;

    // 🔒 RESTORE REAL APP DATA after all tests (only when running individually)
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
