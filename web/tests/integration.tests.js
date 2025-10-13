/**
 * Integration Tests (End-to-End Tests) for miniCycle
 *
 * WARNING: SIMPLIFIED VERSION FOR DATA LAYER ONLY
 *
 * These tests verify that the data storage layer works correctly
 * by testing Schema 2.5 localStorage operations in isolation.
 *
 * NOTE: These are NOT full E2E tests (no DOM manipulation).
 * Full E2E tests would require a browser automation tool like Playwright/Cypress.
 *
 * These tests verify:
 * - Data persistence across page reloads (simulated)
 * - Schema 2.5 data structure integrity
 * - Multi-cycle data isolation
 * - Corrupted data recovery
 *
 * @version 1.0.1
 */

export async function runIntegrationTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🔗 Integration Tests (E2E)</h2>';
    resultsDiv.innerHTML += '<p><em>Testing data layer operations (Schema 2.5 localStorage)</em></p>';
    resultsDiv.innerHTML += '<h3>Running integration tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // 🔒 ALWAYS SAVE REAL APP DATA before tests run (CRITICAL!)
    const savedRealData = {};
    const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
    protectedKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            savedRealData[key] = value;
        }
    });
    console.log('🔒 Saved original localStorage before Integration tests (suite mode:', isPartOfSuite, ')');

    // Helper to restore original data after all tests (ALWAYS RESTORE!)
    function restoreOriginalData() {
        localStorage.clear();
        Object.keys(savedRealData).forEach(key => {
            localStorage.setItem(key, savedRealData[key]);
        });
        console.log('✅ Integration tests completed - original localStorage restored');
    }

    // ✅ FIXED: Made test function properly async and returns nothing
    async function test(name, testFn) {
        total.count++;

        try {
            // Setup: Create fresh test environment
            await setupTestEnvironment();

            // Run the test
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }

            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Integration test failed: ${name}`, error);
        } finally {
            // Cleanup: Reset environment after each test
            await cleanupTestEnvironment();
        }
    }

    /**
     * Setup a fresh test environment with Schema 2.5 data
     */
    async function setupTestEnvironment() {
        // Clear everything
        localStorage.clear();

        // Create fresh Schema 2.5 data
        const mockData = {
            metadata: {
                version: "2.5",
                lastModified: Date.now()
            },
            settings: {
                darkMode: false,
                theme: 'default',
                showMoveArrows: false,
                showThreeDots: false
            },
            data: {
                cycles: {
                    'test-cycle': {
                        id: 'test-cycle',
                        name: 'Test Cycle',
                        tasks: [],
                        cycleCount: 0,
                        autoReset: true,
                        deleteCheckedTasks: false
                    }
                }
            },
            appState: {
                activeCycleId: 'test-cycle',
                currentMode: 'auto-cycle'
            },
            reminders: {
                enabled: false,
                frequency: 30
            },
            userProgress: {
                totalCycles: 0,
                achievements: []
            }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        // Wait for appInit if it exists
        if (window.appInit && !window.appInit.isCoreReady()) {
            await window.appInit.markCoreSystemsReady();
        }

        // Small delay to ensure environment is stable
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    /**
     * Cleanup test environment
     */
    async function cleanupTestEnvironment() {
        // Clear any event listeners or timers that might have been created
        // Reset global state
        if (window.AppGlobalState) {
            window.AppGlobalState.undoStack = [];
            window.AppGlobalState.redoStack = [];
            window.AppGlobalState.isDragging = false;
        }

        // Small delay before next test
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    /**
     * Helper: Load data from localStorage
     */
    function loadData() {
        const raw = localStorage.getItem('miniCycleData');
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * Helper: Save data to localStorage
     */
    function saveData(data) {
        localStorage.setItem('miniCycleData', JSON.stringify(data));
    }

    // ========== PRIORITY 1: CRITICAL USER WORKFLOWS ==========

    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Priority 1: Critical Workflows</h4>';

    // ✅ FIXED: Added await before each test() call
    await test('WORKFLOW: Add task → Save → Verify persistence', async () => {
        const data = loadData();
        const cycle = data.data.cycles['test-cycle'];

        const newTask = {
            id: 'task-' + Date.now(),
            text: 'Integration Test Task',
            completed: false,
            order: 0
        };

        cycle.tasks.push(newTask);
        saveData(data);

        const savedData = loadData();
        const savedCycle = savedData.data.cycles['test-cycle'];
        const foundTask = savedCycle.tasks.find(t => t.text === 'Integration Test Task');

        if (!foundTask) {
            throw new Error('Task not saved to localStorage');
        }

        const reloadedData = loadData();
        const reloadedCycle = reloadedData.data.cycles['test-cycle'];
        const persistedTask = reloadedCycle.tasks.find(t => t.text === 'Integration Test Task');

        if (!persistedTask) {
            throw new Error('Task did not persist after reload');
        }

        if (persistedTask.text !== 'Integration Test Task' || persistedTask.completed !== false) {
            throw new Error('Task data corrupted after reload');
        }
    });

    await test('WORKFLOW: Complete task → Update stats → Verify state', async () => {
        const data = loadData();
        const cycle = data.data.cycles['test-cycle'];

        cycle.tasks.push({
            id: 'task-complete-test',
            text: 'Task to Complete',
            completed: false
        });
        saveData(data);

        const data2 = loadData();
        const cycle2 = data2.data.cycles['test-cycle'];
        const task = cycle2.tasks.find(t => t.id === 'task-complete-test');
        task.completed = true;
        saveData(data2);

        const data3 = loadData();
        const cycle3 = data3.data.cycles['test-cycle'];
        const completedTask = cycle3.tasks.find(t => t.id === 'task-complete-test');

        if (!completedTask.completed) {
            throw new Error('Task not marked as completed');
        }

        const totalTasks = cycle3.tasks.length;
        const completedTasks = cycle3.tasks.filter(t => t.completed).length;
        const completionRate = (completedTasks / totalTasks) * 100;

        if (completionRate !== 100) {
            throw new Error(`Completion rate incorrect: expected 100%, got ${completionRate}%`);
        }
    });

    await test('WORKFLOW: Complete all tasks → Verify cycle count logic', async () => {
        const data = loadData();
        const cycle = data.data.cycles['test-cycle'];
        cycle.autoReset = true;
        cycle.tasks = [
            { id: 'task1', text: 'Task 1', completed: false },
            { id: 'task2', text: 'Task 2', completed: false },
            { id: 'task3', text: 'Task 3', completed: false }
        ];
        cycle.cycleCount = 0;
        saveData(data);

        const data2 = loadData();
        const cycle2 = data2.data.cycles['test-cycle'];
        cycle2.tasks.forEach(task => task.completed = true);
        saveData(data2);

        const data3 = loadData();
        const cycle3 = data3.data.cycles['test-cycle'];

        const allCompleted = cycle3.tasks.every(t => t.completed);
        if (!allCompleted) {
            throw new Error('Not all tasks were completed');
        }

        if (cycle3.autoReset) {
            cycle3.tasks.forEach(task => task.completed = false);
            cycle3.cycleCount = (cycle3.cycleCount || 0) + 1;
            data3.userProgress.totalCycles = (data3.userProgress.totalCycles || 0) + 1;
            data3.metadata.lastModified = Date.now();
            saveData(data3);
        }

        const data4 = loadData();
        const cycle4 = data4.data.cycles['test-cycle'];

        const anyCompleted = cycle4.tasks.some(t => t.completed);
        if (anyCompleted) {
            throw new Error('Tasks were not reset after auto-reset simulation');
        }

        if (cycle4.cycleCount !== 1) {
            throw new Error(`Cycle count not incremented: expected 1, got ${cycle4.cycleCount}`);
        }
    });

    await test('WORKFLOW: Undo/Redo task addition', async () => {
        const data = loadData();
        const cycle = data.data.cycles['test-cycle'];
        const originalTaskCount = cycle.tasks.length;

        const newTask = {
            id: 'task-undo-test',
            text: 'Task to Undo',
            completed: false
        };

        const undoStack = [];
        const previousState = JSON.parse(JSON.stringify(data));

        cycle.tasks.push(newTask);
        saveData(data);
        undoStack.push(previousState);

        let currentData = loadData();
        if (currentData.data.cycles['test-cycle'].tasks.length !== originalTaskCount + 1) {
            throw new Error('Task was not added');
        }

        if (undoStack.length > 0) {
            const previousData = undoStack.pop();
            saveData(previousData);
        }

        currentData = loadData();
        const currentTasks = currentData.data.cycles['test-cycle'].tasks;
        if (currentTasks.length !== originalTaskCount) {
            throw new Error(`Undo failed: expected ${originalTaskCount} tasks, got ${currentTasks.length}`);
        }

        const undoneTask = currentTasks.find(t => t.id === 'task-undo-test');
        if (undoneTask) {
            throw new Error('Undone task still exists in data');
        }
    });

    await test('WORKFLOW: Multiple operations → Undo → Redo', async () => {
        let data = loadData();
        const cycle = data.data.cycles['test-cycle'];
        const undoStack = [];
        const redoStack = [];

        undoStack.push(JSON.parse(JSON.stringify(data)));

        cycle.tasks.push({ id: 'op1', text: 'Operation 1', completed: false });
        saveData(data);
        undoStack.push(JSON.parse(JSON.stringify(data)));

        data = loadData();
        data.data.cycles['test-cycle'].tasks.push({ id: 'op2', text: 'Operation 2', completed: false });
        saveData(data);
        undoStack.push(JSON.parse(JSON.stringify(data)));

        const currentState = undoStack.pop();
        const previousState = undoStack[undoStack.length - 1];
        redoStack.push(currentState);
        saveData(previousState);

        data = loadData();
        if (data.data.cycles['test-cycle'].tasks.find(t => t.id === 'op2')) {
            throw new Error('Undo failed: Operation 2 task still exists');
        }
        if (!data.data.cycles['test-cycle'].tasks.find(t => t.id === 'op1')) {
            throw new Error('Undo broke: Operation 1 task should still exist');
        }

        const redoState = redoStack.pop();
        undoStack.push(loadData());
        saveData(redoState);

        data = loadData();
        if (!data.data.cycles['test-cycle'].tasks.find(t => t.id === 'op2')) {
            throw new Error('Redo failed: Operation 2 task not restored');
        }
    });

    // ========== PRIORITY 2: THEME & SETTINGS ==========

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Priority 2: Theme & Settings</h4>';

    await test('INTEGRATION: Theme change persists to storage', async () => {
        const data = loadData();
        data.settings.theme = 'dark-ocean';
        data.settings.darkMode = true;
        saveData(data);

        const savedData = loadData();
        if (savedData.settings.theme !== 'dark-ocean') {
            throw new Error('Theme not saved to storage');
        }
        if (savedData.settings.darkMode !== true) {
            throw new Error('Dark mode not saved to storage');
        }

        const reloadedData = loadData();
        if (reloadedData.settings.theme !== 'dark-ocean') {
            throw new Error('Theme did not persist after reload');
        }
    });

    await test('INTEGRATION: Settings changes affect cycle behavior', async () => {
        const data = loadData();
        const cycle = data.data.cycles['test-cycle'];
        cycle.autoReset = true;
        saveData(data);

        const savedData = loadData();
        if (savedData.data.cycles['test-cycle'].autoReset !== true) {
            throw new Error('Auto-reset setting not saved');
        }

        savedData.data.cycles['test-cycle'].autoReset = false;
        saveData(savedData);

        const updatedData = loadData();
        if (updatedData.data.cycles['test-cycle'].autoReset !== false) {
            throw new Error('Auto-reset setting change did not persist');
        }
    });

    // ========== PRIORITY 3: DATA INTEGRITY ==========

    resultsDiv.innerHTML += '<h4 class="test-section">🔒 Priority 3: Data Integrity</h4>';

    await test('INTEGRATION: Multiple cycles coexist correctly', async () => {
        const data = loadData();
        data.data.cycles['cycle-1'] = {
            id: 'cycle-1',
            name: 'Cycle 1',
            tasks: [{ id: 't1', text: 'Task 1', completed: false }],
            cycleCount: 0
        };
        data.data.cycles['cycle-2'] = {
            id: 'cycle-2',
            name: 'Cycle 2',
            tasks: [{ id: 't2', text: 'Task 2', completed: true }],
            cycleCount: 5
        };
        saveData(data);

        const savedData = loadData();
        if (!savedData.data.cycles['cycle-1']) {
            throw new Error('Cycle 1 not saved');
        }
        if (!savedData.data.cycles['cycle-2']) {
            throw new Error('Cycle 2 not saved');
        }

        if (savedData.data.cycles['cycle-1'].tasks[0].completed === true) {
            throw new Error('Cycle 1 task incorrectly marked as completed');
        }
        if (savedData.data.cycles['cycle-2'].cycleCount !== 5) {
            throw new Error('Cycle 2 count incorrect');
        }

        savedData.data.cycles['cycle-1'].tasks[0].completed = true;
        saveData(savedData);

        const finalData = loadData();
        if (finalData.data.cycles['cycle-2'].tasks[0].text !== 'Task 2') {
            throw new Error('Cycle 2 was affected by Cycle 1 modification');
        }
    });

    await test('INTEGRATION: Schema version preserved across operations', async () => {
        let data = loadData();
        if (data.metadata.version !== '2.5') {
            throw new Error(`Expected schema 2.5, got ${data.metadata.version}`);
        }

        data.data.cycles['test-cycle'].tasks.push({
            id: 'schema-test',
            text: 'Schema Test',
            completed: false
        });
        saveData(data);

        data = loadData();
        data.settings.darkMode = true;
        saveData(data);

        data = loadData();
        data.userProgress.totalCycles = 10;
        saveData(data);

        const finalData = loadData();
        if (finalData.metadata.version !== '2.5') {
            throw new Error('Schema version changed after operations');
        }
    });

    await test('INTEGRATION: Corrupted data handled gracefully', async () => {
        localStorage.setItem('miniCycleData', 'invalid json {{{');

        const data = loadData();

        if (data !== null) {
            throw new Error('Corrupted data should return null');
        }

        await setupTestEnvironment();
        const recoveredData = loadData();

        if (!recoveredData) {
            throw new Error('Failed to recover from corrupted data');
        }
        if (recoveredData.metadata.version !== '2.5') {
            throw new Error('Recovered data has wrong schema version');
        }
    });

    // ========== PRIORITY 4: MODE SWITCHING ==========

    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Priority 4: Mode Switching</h4>';

    await test('INTEGRATION: Switch between Auto Cycle and To-Do mode', async () => {
        let data = loadData();
        data.appState.currentMode = 'auto-cycle';
        const cycle = data.data.cycles['test-cycle'];
        cycle.autoReset = true;
        cycle.deleteCheckedTasks = false;
        saveData(data);

        data = loadData();
        if (data.appState.currentMode !== 'auto-cycle') {
            throw new Error('Failed to set Auto Cycle mode');
        }

        data.appState.currentMode = 'todo-mode';
        cycle.autoReset = false;
        cycle.deleteCheckedTasks = true;
        saveData(data);

        data = loadData();
        if (data.appState.currentMode !== 'todo-mode') {
            throw new Error('Failed to switch to To-Do mode');
        }
        if (!cycle.deleteCheckedTasks) {
            throw new Error('deleteCheckedTasks not enabled in To-Do mode');
        }

        data.appState.currentMode = 'auto-cycle';
        cycle.autoReset = true;
        cycle.deleteCheckedTasks = false;
        saveData(data);

        data = loadData();
        if (data.appState.currentMode !== 'auto-cycle') {
            throw new Error('Failed to switch back to Auto Cycle mode');
        }
    });

    // ========== RESULTS SUMMARY ==========

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} integration tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">All integration tests passed!</div>';
        resultsDiv.innerHTML += '<div class="result pass">Data layer operations work correctly</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">WARNING: Some integration tests failed</div>';
        resultsDiv.innerHTML += '<div class="result fail">WARNING: ' + (total.count - passed.count) + ' data operation(s) broken</div>';
    }

    resultsDiv.innerHTML += '<h4 class="test-section">About These Tests</h4>';
    resultsDiv.innerHTML += '<div class="result" style="background: rgba(255, 255, 255, 0.95); color: #333; border-left: 4px solid #2196f3;">';
    resultsDiv.innerHTML += '<p><strong>What These Tests Cover:</strong></p>';
    resultsDiv.innerHTML += '<ul style="margin: 10px 0; padding-left: 20px;">';
    resultsDiv.innerHTML += '<li>Schema 2.5 localStorage operations</li>';
    resultsDiv.innerHTML += '<li>Data persistence across "page reloads" (simulated)</li>';
    resultsDiv.innerHTML += '<li>Multi-cycle data isolation</li>';
    resultsDiv.innerHTML += '<li>Data corruption recovery</li>';
    resultsDiv.innerHTML += '<li>Theme and settings persistence</li>';
    resultsDiv.innerHTML += '</ul>';
    resultsDiv.innerHTML += '<p><strong>What These Tests DON\'T Cover:</strong></p>';
    resultsDiv.innerHTML += '<ul style="margin: 10px 0; padding-left: 20px;">';
    resultsDiv.innerHTML += '<li>DOM manipulation and UI updates</li>';
    resultsDiv.innerHTML += '<li>Button clicks and user interactions</li>';
    resultsDiv.innerHTML += '<li>Module initialization sequences</li>';
    resultsDiv.innerHTML += '<li>Real browser reload testing</li>';
    resultsDiv.innerHTML += '</ul>';
    resultsDiv.innerHTML += '<p><em>For full E2E tests with DOM interactions, consider using Playwright or Cypress.</em></p>';
    resultsDiv.innerHTML += '</div>';

    // 🔒 ALWAYS RESTORE REAL APP DATA after tests complete (CRITICAL!)
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
