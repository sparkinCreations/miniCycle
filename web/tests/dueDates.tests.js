/**
 * DueDates Module Tests
 * Comprehensive tests for the miniCycle Due Dates module (Schema 2.5)
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 * @version 1.330
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    waitForAsyncOperations
} from './testHelpers.js';

import {
    MiniCycleDueDates,
    setDueDatesDependencies
} from '../modules/features/dueDates.js';

export async function runDueDatesTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>Due Dates Module Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Set up DueDates module dependencies
    setDueDatesDependencies({
        safeAddEventListener: env.deps.safeAddEventListener
    });

    // Make MiniCycleDueDates available for tests (fallback compatibility)
    window.MiniCycleDueDates = MiniCycleDueDates;

    resultsDiv.innerHTML = '<h2>Due Dates Module Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };
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
        console.log('🔒 Saved original localStorage for individual dueDates test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual dueDates test completed - original localStorage restored');
        }
    }


    try {

        // Import the module class
        const MiniCycleDueDates = window.MiniCycleDueDates;

        // Check if class is available
        if (!MiniCycleDueDates) {
            resultsDiv.innerHTML += '<div class="result fail">❌ MiniCycleDueDates class not found. Make sure the module is properly loaded.</div>';
            resultsDiv.innerHTML += '<h3>Results: 0/1 tests passed (0%)</h3>';
            return { passed: 0, total: 1 };
        }

        // Create test container for DOM elements (persists across tests)
        let testContainer = document.getElementById('duedates-test-container');
        if (!testContainer) {
            testContainer = document.createElement('div');
            testContainer.id = 'duedates-test-container';
            testContainer.style.cssText = 'display: none; position: absolute; left: -9999px;';
            document.body.appendChild(testContainer);
        }

        // Helper to create mock AppState that actually updates localStorage
        function createMockAppStateForDueDates() {
            return {
                isReady: () => true,
                get: () => JSON.parse(localStorage.getItem('miniCycleData')),
                update: async (updateFn, shouldSave = false) => {
                    const currentData = JSON.parse(localStorage.getItem('miniCycleData'));
                    updateFn(currentData);
                    // Update metadata timestamp
                    currentData.metadata.lastModified = Date.now();
                    if (shouldSave) {
                        localStorage.setItem('miniCycleData', JSON.stringify(currentData));
                    }
                }
            };
        }

        async function test(name, testFn) {
            total.count++;
            try {
                // Reset environment before each test
                localStorage.clear();

                // Mock Schema 2.5 data
                const mockSchemaData = {
                    metadata: {
                        version: "2.5",
                        lastModified: Date.now()
                    },
                    data: {
                        cycles: {
                            'test-cycle': {
                                name: 'Test Cycle',
                                tasks: [
                                    {
                                        id: 'task-1',
                                        text: 'Test Task 1',
                                        completed: false,
                                        dueDate: null
                                    },
                                    {
                                        id: 'task-2',
                                        text: 'Test Task 2',
                                        completed: false,
                                        dueDate: '2025-12-31'
                                    }
                                ],
                                autoReset: false
                            }
                        },
                        activeCycle: 'test-cycle'
                    },
                    appState: {
                        activeCycleId: 'test-cycle',
                        overdueTaskStates: {}
                    },
                    settings: {}
                };
                localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

                // Clear test container
                testContainer.innerHTML = '';

                // Clear any global state (but preserve appInit!)
                delete window.AppState;
                delete window.dueDatesManager;

                await testFn();
                resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
                passed.count++;
            } catch (error) {
                resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            }
        }

        // === INITIALIZATION TESTS ===
        resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';

        await test('creates instance successfully', async () => {
            const instance = new MiniCycleDueDates();
            if (!instance || typeof instance.saveTaskDueDate !== 'function') {
                throw new Error('MiniCycleDueDates not properly initialized');
            }
        });

        await test('accepts dependency injection', async () => {
            const mockShowNotification = (msg) => console.log(msg);
            const mockLoadData = () => ({ metadata: { version: '2.5' }, data: { cycles: {} }});

            const instance = new MiniCycleDueDates({
                showNotification: mockShowNotification,
                loadMiniCycleData: mockLoadData
            });

            if (!instance || !instance.deps.showNotification) {
                throw new Error('Dependency injection failed');
            }
        });


        // === CORE FUNCTIONALITY TESTS ===
        resultsDiv.innerHTML += '<h4>⚡ Core Functionality</h4>';

        await test('saveTaskDueDate updates task in Schema 2.5', async () => {
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                AppState: createMockAppStateForDueDates()
            });

            await instance.saveTaskDueDate('task-1', '2025-11-15');

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.cycles['test-cycle'].tasks.find(t => t.id === 'task-1');

            if (task.dueDate !== '2025-11-15') {
                throw new Error('Due date not saved correctly');
            }
        });

        await test('saveTaskDueDate updates metadata timestamp', async () => {
            const originalData = JSON.parse(localStorage.getItem('miniCycleData'));
            const originalTimestamp = originalData.metadata.lastModified;

            await new Promise(resolve => setTimeout(resolve, 10));

            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                AppState: createMockAppStateForDueDates()
            });

            await instance.saveTaskDueDate('task-1', '2025-12-01');

            const updatedData = JSON.parse(localStorage.getItem('miniCycleData'));

            if (updatedData.metadata.lastModified <= originalTimestamp) {
                throw new Error('Metadata timestamp not updated');
            }
        });

        await test('clears due date when set to null', async () => {
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                AppState: createMockAppStateForDueDates()
            });

            await instance.saveTaskDueDate('task-2', null);

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.cycles['test-cycle'].tasks.find(t => t.id === 'task-2');

            if (task.dueDate !== null) {
                throw new Error('Due date not cleared correctly');
            }
        });

        await test('createDueDateInput returns valid input element', async () => {
            const instance = new MiniCycleDueDates();

            const input = instance.createDueDateInput('task-1', '2025-12-31', false, {}, 'test-cycle');

            if (input.type !== 'date' || !input.classList.contains('due-date')) {
                throw new Error('Invalid due date input created');
            }

            if (input.value !== '2025-12-31') {
                throw new Error('Due date value not set correctly');
            }
        });

        await test('createDueDateInput hides when no value and autoReset enabled', async () => {
            const instance = new MiniCycleDueDates();

            const input = instance.createDueDateInput('task-1', null, true, {}, 'test-cycle');

            if (!input.classList.contains('hidden')) {
                throw new Error('Input should be hidden when no value and autoReset enabled');
            }
        });

        await test('checkOverdueTasks identifies overdue tasks', async () => {
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });

            // Create mock task element
            const taskDiv = document.createElement('div');
            taskDiv.classList.add('task');
            // Set taskId - required by checkOverdueTasks (uses task.dataset.taskId, not text)
            taskDiv.dataset.taskId = 'overdue-task-1';
            const taskText = document.createElement('span');
            taskText.classList.add('task-text');
            taskText.textContent = 'Overdue Task';
            const dueDateInput = document.createElement('input');
            dueDateInput.type = 'date';
            dueDateInput.classList.add('due-date');

            // Set to yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            dueDateInput.value = yesterday.toISOString().split('T')[0];

            taskDiv.appendChild(taskText);
            taskDiv.appendChild(dueDateInput);
            testContainer.appendChild(taskDiv);

            await instance.checkOverdueTasks(taskDiv);

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));

            // Implementation stores by task ID, not task text
            if (!savedData.appState.overdueTaskStates['overdue-task-1']) {
                throw new Error('Overdue task not tracked in overdueTaskStates');
            }
        });

        // === SCHEMA 2.5 STORAGE TESTS ===
        resultsDiv.innerHTML += '<h4>💾 Schema 2.5 Storage</h4>';

        await test('saves due date to correct Schema 2.5 location', async () => {
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                AppState: createMockAppStateForDueDates()
            });

            await instance.saveTaskDueDate('task-2', '2026-01-01');

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.cycles['test-cycle'].tasks.find(t => t.id === 'task-2');

            if (!task || task.dueDate !== '2026-01-01') {
                throw new Error('Due date not saved to correct Schema 2.5 location');
            }
        });

        await test('stores overdue states in Schema 2.5', async () => {
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });

            await instance.checkOverdueTasks();

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));

            if (!savedData.appState.overdueTaskStates) {
                throw new Error('overdueTaskStates not created in appState');
            }
        });

        // === ERROR HANDLING TESTS ===
        resultsDiv.innerHTML += '<h4>⚠️ Error Handling</h4>';

        await test('handles missing task gracefully', async () => {
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                showNotification: () => {}
            });

            // Should not throw when task doesn't exist
            await instance.saveTaskDueDate('non-existent-task', '2025-12-31');

            // Task should not be created
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.cycles['test-cycle'].tasks.find(t => t.id === 'non-existent-task');

            if (task) {
                throw new Error('Non-existent task should not be created');
            }
        });

        await test('handles missing Schema 2.5 data', async () => {
            localStorage.clear();

            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => null,
                showNotification: () => {}
            });

            // Should throw error when Schema 2.5 data is missing
            let errorThrown = false;
            try {
                await instance.saveTaskDueDate('task-1', '2025-12-31');
            } catch (error) {
                errorThrown = true;
            }

            if (!errorThrown) {
                throw new Error('Should throw error when Schema 2.5 data is missing');
            }
        });

        // === INTEGRATION TESTS ===
        resultsDiv.innerHTML += '<h4>🔗 Integration Tests</h4>';

        await test('setupDueDateButtonInteraction attaches event listener', async () => {
            const instance = new MiniCycleDueDates();

            const buttonContainer = document.createElement('div');
            const dueDateButton = document.createElement('button');
            dueDateButton.classList.add('set-due-date');
            buttonContainer.appendChild(dueDateButton);

            const dueDateInput = document.createElement('input');
            dueDateInput.type = 'date';
            dueDateInput.classList.add('due-date', 'hidden');

            instance.setupDueDateButtonInteraction(buttonContainer, dueDateInput);

            if (dueDateButton.dataset.listenerAttached !== 'true') {
                throw new Error('Event listener not attached');
            }
        });

        await test('updateDueDateVisibility hides dates when autoReset on', async () => {
            const mockInput = document.createElement('input');
            mockInput.classList.add('due-date');
            // No value set — should be hidden

            const mockInputWithValue = document.createElement('input');
            mockInputWithValue.classList.add('due-date');
            mockInputWithValue.value = '2026-01-15';
            mockInputWithValue.classList.add('hidden'); // Start hidden — should be shown

            const instance = new MiniCycleDueDates({
                getElementById: () => null,
                querySelectorAll: (selector) => {
                    if (selector === '.due-date') return [mockInput, mockInputWithValue];
                    if (selector === '.set-due-date') return [];
                    // checkOverdueTasks queries for '.task' — return empty to skip overdue logic
                    if (selector === '.task') return [];
                    return [];
                },
                AppState: {
                    isReady: () => false,
                    get: () => null
                }
            });

            instance.updateDueDateVisibility(true);

            if (!mockInput.classList.contains('hidden')) {
                throw new Error('Due date input without value should be hidden');
            }

            if (mockInputWithValue.classList.contains('hidden')) {
                throw new Error('Due date input with value should be visible');
            }
        });

        // === PERFORMANCE TESTS ===
        resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';

        await test('saveTaskDueDate completes within reasonable time', async () => {
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                AppState: createMockAppStateForDueDates()
            });

            const startTime = performance.now();
            await instance.saveTaskDueDate('task-1', '2025-12-31');
            const endTime = performance.now();

            const duration = endTime - startTime;

            if (duration > 100) {
                throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
            }
        });

        await test('checkOverdueTasks completes within reasonable time', async () => {
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });

            const startTime = performance.now();
            await instance.checkOverdueTasks();
            const endTime = performance.now();

            const duration = endTime - startTime;

            if (duration > 100) {
                throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
            }
        });

        // === REMIND OVERDUE TASKS TESTS ===
        resultsDiv.innerHTML += '<h4>⏰ Remind Overdue Tasks</h4>';

        await test('remindOverdueTasks method exists', () => {
            const instance = new MiniCycleDueDates();
            if (typeof instance.remindOverdueTasks !== 'function') {
                throw new Error('remindOverdueTasks method should exist');
            }
        });

        // NOTE: former test 'remindOverdueTasks skips when autoReset is enabled' removed.
        // It asserted nothing AND was mis-premised: remindOverdueTasks() has no autoReset
        // check (it skips only on missing schema data or dueDatesReminders disabled), so
        // the injected toggleAutoReset was inert. Those real skip paths are covered by the
        // 'dueDatesReminders disabled' and 'missing schema data' tests below. (Test-suite audit.)

        await test('remindOverdueTasks skips when dueDatesReminders disabled', () => {
            const mockToggle = { checked: false };
            let notificationShown = false;

            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => ({ reminders: { dueDatesReminders: false } }),
                querySelectorAll: () => [],
                showNotification: () => { notificationShown = true; }
            });
            instance.toggleAutoReset = mockToggle;

            instance.remindOverdueTasks();

            if (notificationShown) {
                throw new Error('Should not show notification when dueDatesReminders is disabled');
            }
        });

        await test('remindOverdueTasks shows notification for overdue tasks', () => {
            const mockToggle = { checked: false };
            let notificationMessage = null;

            // Create mock overdue task
            const mockTask = document.createElement('div');
            mockTask.classList.add('task', 'overdue-task');
            const taskText = document.createElement('span');
            taskText.classList.add('task-text');
            taskText.textContent = 'Overdue Task 1';
            mockTask.appendChild(taskText);

            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => ({ reminders: { dueDatesReminders: true } }),
                querySelectorAll: (selector) => {
                    if (selector === '.task') return [mockTask];
                    return [];
                },
                showNotification: (msg) => { notificationMessage = msg; }
            });
            instance.toggleAutoReset = mockToggle;

            instance.remindOverdueTasks();

            if (!notificationMessage || !notificationMessage.includes('Overdue Task 1')) {
                throw new Error('Should show notification with overdue task name');
            }
        });

        await test('remindOverdueTasks does not show notification when no overdue tasks', () => {
            const mockToggle = { checked: false };
            let notificationShown = false;

            // Create mock non-overdue task
            const mockTask = document.createElement('div');
            mockTask.classList.add('task'); // Not overdue

            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => ({ reminders: { dueDatesReminders: true } }),
                querySelectorAll: (selector) => {
                    if (selector === '.task') return [mockTask];
                    return [];
                },
                showNotification: () => { notificationShown = true; }
            });
            instance.toggleAutoReset = mockToggle;

            instance.remindOverdueTasks();

            if (notificationShown) {
                throw new Error('Should not show notification when no overdue tasks');
            }
        });

        await test('remindOverdueTasks handles missing schema data gracefully', () => {
            const mockToggle = { checked: false };
            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => null,
                querySelectorAll: () => []
            });
            instance.toggleAutoReset = mockToggle;

            // Should not throw
            instance.remindOverdueTasks();
        });

        await test('a task due TODAY is not marked overdue (local-midnight date parsing)', async () => {
            // Regression guard for the UTC date-only parse. <input type="date">.value
            // is "YYYY-MM-DD", and new Date() reads that as UTC midnight — which in
            // any negative UTC offset is the PREVIOUS local day, so a task due today
            // was flagged overdue across the Americas. parseDateAsLocal fixes it.
            //
            // NOTE: CI runs in UTC, where local and UTC midnight coincide and this
            // assertion passes either way. Its teeth are in negative-offset zones;
            // verified failing against the old code under TZ=America/New_York.
            // Build today's date from LOCAL components (toISOString would re-introduce
            // the very UTC shift under test).
            const now = new Date();
            const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const instance = new MiniCycleDueDates({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });

            const taskDiv = document.createElement('div');
            taskDiv.classList.add('task');
            taskDiv.dataset.taskId = 'due-today-task';
            const taskText = document.createElement('span');
            taskText.classList.add('task-text');
            taskText.textContent = 'Due Today';
            const dueDateInput = document.createElement('input');
            dueDateInput.type = 'date';
            dueDateInput.classList.add('due-date');
            dueDateInput.value = todayLocal;
            taskDiv.appendChild(taskText);
            taskDiv.appendChild(dueDateInput);
            testContainer.appendChild(taskDiv);

            await instance.checkOverdueTasks(taskDiv);

            if (taskDiv.classList.contains('overdue-task')) {
                throw new Error('a task due today must not carry the overdue class');
            }
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            if (savedData.appState.overdueTaskStates?.['due-today-task']) {
                throw new Error('a task due today must not be tracked as overdue');
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

        return { passed: passed.count, total: total.count };

    } catch (error) {
        console.error('❌ Test suite error:', error);
        resultsDiv.innerHTML += `<div class="result fail">❌ Test suite error: ${error.message}</div>`;
        resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (test suite error)</h3>`;
        
    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

return { passed: passed.count, total: total.count };
    }
}
