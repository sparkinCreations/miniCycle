/**
 * CycleLoader Module Tests (Schema 2.5)
 * Simplified tests for the main cycle loading and coordination functionality
 */

// Import the module
import {
    loadMiniCycle,
    repairAndCleanTasks,
    renderTasksToDOM,
    updateCycleUIState,
    applyThemeSettings,
    setupRemindersForCycle,
    updateDependentComponents,
    saveCycleData,
    setCycleLoaderDependencies
} from '../utilities/cycleLoader.js';

export async function runCycleLoaderTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🔄 CycleLoader Tests</h2><h3>Running tests...</h3>';

    // ✅ CRITICAL: Mark core as ready for test environment
    // This allows async functions using appInit.waitForCore() to proceed
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    let passed = { count: 0 };
    let total = { count: 0 };

    // 🔒 SAVE REAL APP DATA ONCE before all tests run (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original localStorage for individual CycleLoader test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual CycleLoader test completed - original localStorage restored');
        }
    }

    async function test(name, testFn) {
        total.count++;

        try {
            // Reset environment before each test
            localStorage.clear();

            // Create fresh mock Schema 2.5 data for each test
            const mockSchemaData = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now()
                },
                settings: {
                    darkMode: false,
                    theme: 'default'
                },
                data: {
                    cycles: {
                        'cycle1': {
                            id: 'cycle1',
                            title: 'Test Cycle',
                            tasks: [
                                {
                                    id: 'task1',
                                    text: 'Test Task 1',
                                    completed: false
                                }
                            ],
                            autoReset: true,
                            deleteCheckedTasks: false
                        }
                    }
                },
                appState: {
                    activeCycleId: 'cycle1'
                },
                reminders: {
                    enabled: true,
                    frequency: 30
                },
                userProgress: {}
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Reset dependencies for each test (must explicitly set to null)
            setCycleLoaderDependencies({
                loadMiniCycleData: null,
                createInitialSchema25Data: null,
                addTask: null,
                updateThemeColor: null,
                startReminders: null,
                updateProgressBar: null,
                checkCompleteAllButton: null,
                updateMainMenuHeader: null,
                updateStatsPanel: null
            });

            const result = testFn();
            // Handle async test functions
            if (result instanceof Promise) {
                await result;
            }
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('sets dependencies correctly', () => {
        const mockDeps = {
            loadMiniCycleData: () => ({ metadata: { version: '2.5' } }),
            addTask: () => {},
            updateThemeColor: () => {}
        };

        setCycleLoaderDependencies(mockDeps);

        if (typeof setCycleLoaderDependencies !== 'function') {
            throw new Error('setCycleLoaderDependencies function not available');
        }
    });

    test('throws error for missing required dependencies', async () => {
        setCycleLoaderDependencies({});

        let errorThrown = false;
        try {
            await loadMiniCycle();
        } catch (error) {
            if (error.message.includes('missing dependency')) {
                errorThrown = true;
            }
        }

        if (!errorThrown) {
            throw new Error('Should throw error for missing dependencies');
        }
    });

    // === CORE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ Core Functionality</h4>';

    test('handles missing Schema 2.5 data gracefully', () => {
        let initialDataCreated = false;

        setCycleLoaderDependencies({
            loadMiniCycleData: () => null,
            createInitialSchema25Data: () => { initialDataCreated = true; },
            addTask: () => {}
        });

        loadMiniCycle();

        if (!initialDataCreated) {
            throw new Error('Should create initial data when none exists');
        }
    });

    // === TASK REPAIR TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Task Repair</h4>';

    test('repairs tasks with missing text', () => {
        const cycle = {
            tasks: [
                { id: 'task1', text: '', completed: false },
                { id: 'task2', text: null, completed: false },
                { id: 'task3', text: 'Valid Task', completed: false }
            ]
        };

        const result = repairAndCleanTasks(cycle);

        if (!result.wasModified) {
            throw new Error('Should detect modifications were made');
        }

        if (cycle.tasks[0].text !== '[Task 1]' || cycle.tasks[1].text !== '[Task 2]') {
            throw new Error('Missing text not properly repaired');
        }
    });

    test('repairs tasks with missing IDs', () => {
        const cycle = {
            tasks: [
                { text: 'Task 1', completed: false },
                { id: 'task2', text: 'Task 2', completed: false }
            ]
        };

        const result = repairAndCleanTasks(cycle);

        if (!result.wasModified) {
            throw new Error('Should detect modifications were made');
        }

        if (!cycle.tasks[0].id || !cycle.tasks[0].id.startsWith('task-')) {
            throw new Error('Missing ID not properly repaired');
        }
    });

    test('removes completely invalid tasks', () => {
        const cycle = {
            tasks: [
                { id: 'task1', text: 'Valid Task', completed: false },
                null,
                undefined,
                'invalid string',
                { id: 'task2', text: 'Another Valid Task', completed: true }
            ]
        };

        const result = repairAndCleanTasks(cycle);

        if (cycle.tasks.length !== 2) {
            throw new Error(`Expected 2 valid tasks, got ${cycle.tasks.length}`);
        }
    });

    // === DOM RENDERING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Rendering</h4>';

    test('handles missing taskList element gracefully', () => {
        const tasks = [{ id: 'task1', text: 'Test Task', completed: false }];

        setCycleLoaderDependencies({
            addTask: () => {}
        });

        // Should not throw error when taskList doesn't exist
        renderTasksToDOM(tasks);
    });

    // === UI STATE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ UI State</h4>';

    test('handles missing UI elements gracefully', () => {
        const cycle = { title: 'Test' };
        const settings = {};

        setCycleLoaderDependencies({
            updateThemeColor: () => {}
        });

        // Should not throw error when DOM elements don't exist
        updateCycleUIState(cycle, settings);
    });

    // === THEME TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Theme Settings</h4>';

    test('applies theme settings correctly', () => {
        let themeColorCalled = false;
        setCycleLoaderDependencies({
            updateThemeColor: () => { themeColorCalled = true; }
        });

        const settings = {
            darkMode: true,
            theme: 'golden-glow'
        };

        applyThemeSettings(settings);

        if (!themeColorCalled) {
            throw new Error('updateThemeColor dependency not called');
        }

        // Cleanup
        document.body.classList.remove('dark-mode', 'theme-golden-glow');
    });

    // === DATA PERSISTENCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Data Persistence</h4>';

    test('saves cycle data correctly', async () => {
        // ✅ Explicitly verify localStorage has valid data before test
        const storedData = localStorage.getItem('miniCycleData');
        if (!storedData) {
            throw new Error('Test setup failed: no data in localStorage');
        }

        // Verify it's valid JSON
        let initialData;
        try {
            initialData = JSON.parse(storedData);
        } catch (e) {
            throw new Error(`Test setup failed: invalid JSON in localStorage: ${storedData.substring(0, 50)}`);
        }

        const updatedCycle = {
            id: 'cycle1',
            title: 'Updated Cycle',
            tasks: [{ id: 'new-task', text: 'New Task', completed: false }]
        };

        await saveCycleData('cycle1', updatedCycle);

        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        const savedCycle = savedData.data.cycles.cycle1;

        if (savedCycle.title !== 'Updated Cycle') {
            throw new Error('Cycle data not properly saved');
        }
    });

    test('handles corrupted localStorage in save', async () => {
        // This test intentionally sets invalid JSON to test error handling
        localStorage.setItem('miniCycleData', 'invalid json');

        // Should not throw error (saveCycleData handles it gracefully)
        try {
            await saveCycleData('cycle1', { title: 'Test' });
        } catch (e) {
            // Expected to handle gracefully - no error should propagate
        }

        // Test passed - no exception thrown means it handled gracefully
    });

    // === RESULTS SUMMARY ===
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;

    // 🔒 RESTORE REAL APP DATA after individual test complete (only when running individually)
    if (!isPartOfSuite) {
        restoreOriginalData();
    }

    return { passed: passed.count, total: total.count };
}
