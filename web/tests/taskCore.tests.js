/**
 * TaskCore Tests
 *
 * Tests for the Task Core module (CRUD operations and batch operations)
 *
 * @version 1.333
 * @module tests/taskCore
 */

export async function runTaskCoreTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🎯 TaskCore Tests</h2>';
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
        console.log('🔒 Saved original localStorage for individual taskCore test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual taskCore test completed - original localStorage restored');
        }
    }


    // Import the module class
    const TaskCore = window.TaskCore;

    // Check if class is available
    if (!TaskCore) {
        resultsDiv.innerHTML += '<div class="result fail">❌ TaskCore class not found. Make sure the module is properly loaded.</div>';
        resultsDiv.innerHTML += '<h3>Results: 0/1 tests passed (0%)</h3>';
        return { passed: 0, total: 1 };
    }

    async function test(name, testFn) {
        total.count++;

        // Save state before test
        const savedLocalStorage = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('miniCycle')) {
                savedLocalStorage[key] = localStorage.getItem(key);
            }
        }

        const savedGlobals = {
            AppState: window.AppState,
            showNotification: window.showNotification,
            taskCore: window.taskCore
        };

        try {
            // Clear localStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('miniCycle')) {
                    localStorage.removeItem(key);
                }
            });

            // Reset DOM state
            document.body.className = '';

            // Clear any global state
            delete window.AppState;
            delete window.showNotification;
            delete window.taskCore;

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
            // Restore state
            Object.keys(savedLocalStorage).forEach(key => {
                localStorage.setItem(key, savedLocalStorage[key]);
            });

            Object.keys(savedGlobals).forEach(key => {
                if (savedGlobals[key] === undefined) {
                    delete window[key];
                } else {
                    window[key] = savedGlobals[key];
                }
            });
        }
    }

    function createMockSchemaData() {
        return {
            metadata: {
                version: "2.5",
                lastModified: Date.now(),
                createdAt: Date.now(),
                schemaVersion: "2.5"
            },
            settings: {
                theme: 'default',
                darkMode: false
            },
            data: {
                cycles: {
                    'cycle-1': {
                        id: 'cycle-1',
                        name: 'Test Cycle',
                        tasks: [
                            { id: 'task-1', text: 'Test Task 1', completed: false, highPriority: false },
                            { id: 'task-2', text: 'Test Task 2', completed: true, highPriority: true }
                        ],
                        cycleCount: 5,
                        autoReset: true,
                        deleteCheckedTasks: false
                    }
                }
            },
            appState: {
                activeCycleId: 'cycle-1',
                currentMode: 'auto-cycle'
            },
            userProgress: {
                cyclesCompleted: 10
            },
            reminders: {
                enabled: false
            }
        };
    }

    function createMockAppState(schemaData) {
        return {
            isReady: () => true,
            get: () => schemaData,
            update: async (producer, immediate) => {
                const newState = JSON.parse(JSON.stringify(schemaData));
                producer(newState);
                Object.assign(schemaData, newState);
            }
        };
    }

    // ===================================================================
    // INITIALIZATION TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading & Initialization</h4>';

    await test('TaskCore class is defined', async () => {
        if (typeof TaskCore !== 'function') {
            throw new Error('TaskCore is not a constructor function');
        }
    });

    await test('creates instance successfully', async () => {
        const instance = new TaskCore();
        if (!instance || typeof instance.addTask !== 'function') {
            throw new Error('TaskCore not properly initialized');
        }
    });

    await test('accepts dependency injection', async () => {
        const mockNotification = (msg) => ({ message: msg });

        const instance = new TaskCore({
            showNotification: mockNotification,
            loadMiniCycleData: () => createMockSchemaData()
        });

        if (!instance || !instance.deps.showNotification) {
            throw new Error('Dependency injection failed');
        }
    });

    await test('has correct version number', async () => {
        const instance = new TaskCore();
        if (!instance.version || typeof instance.version !== 'string') {
            throw new Error('Version not set properly');
        }
    });

    await test('initializes with fallback methods', async () => {
        const instance = new TaskCore({});

        if (typeof instance.deps.showNotification !== 'function') {
            throw new Error('Fallback notification not set');
        }
        if (typeof instance.deps.loadMiniCycleData !== 'function') {
            throw new Error('Fallback loadData not set');
        }
    });

    // ===================================================================
    // CRUD OPERATIONS TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">🎯 CRUD Operations</h4>';

    await test('addTask accepts all parameters', async () => {
        const instance = new TaskCore({
            validateAndSanitizeTaskInput: (text) => text,
            loadTaskContext: () => null
        });

        // Should not throw when called with full params
        await instance.addTask('Test Task', false, true, null, null, false, false, false, null, {});
    });

    await test('editTask method exists and is callable', async () => {
        const instance = new TaskCore();

        if (typeof instance.editTask !== 'function') {
            throw new Error('editTask method not found');
        }
    });

    await test('deleteTask method exists and is callable', async () => {
        const instance = new TaskCore();

        if (typeof instance.deleteTask !== 'function') {
            throw new Error('deleteTask method not found');
        }
    });

    await test('toggleTaskPriority method exists and is callable', async () => {
        const instance = new TaskCore();

        if (typeof instance.toggleTaskPriority !== 'function') {
            throw new Error('toggleTaskPriority method not found');
        }
    });

    // ===================================================================
    // BATCH OPERATIONS TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Batch Operations</h4>';

    await test('handleTaskCompletionChange method exists', async () => {
        const instance = new TaskCore();

        if (typeof instance.handleTaskCompletionChange !== 'function') {
            throw new Error('handleTaskCompletionChange method not found');
        }
    });

    await test('saveCurrentTaskOrder method exists', async () => {
        const instance = new TaskCore();

        if (typeof instance.saveCurrentTaskOrder !== 'function') {
            throw new Error('saveCurrentTaskOrder method not found');
        }
    });

    await test('resetTasks method exists', async () => {
        const instance = new TaskCore();

        if (typeof instance.resetTasks !== 'function') {
            throw new Error('resetTasks method not found');
        }
    });

    await test('handleCompleteAllTasks method exists', async () => {
        const instance = new TaskCore();

        if (typeof instance.handleCompleteAllTasks !== 'function') {
            throw new Error('handleCompleteAllTasks method not found');
        }
    });

    // ===================================================================
    // APPSTATE INTEGRATION TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">🔌 AppState Integration</h4>';

    await test('integrates with AppState for task operations', async () => {
        const schemaData = createMockSchemaData();
        const mockAppState = createMockAppState(schemaData);

        const instance = new TaskCore({
            AppState: mockAppState,
            querySelectorAll: () => []
        });

        await instance.saveCurrentTaskOrder();
        // Should not throw
    });

    await test('handles AppState not ready gracefully', async () => {
        const mockAppState = {
            isReady: () => false,
            get: () => null,
            update: async () => {}
        };

        const instance = new TaskCore({
            AppState: mockAppState,
            querySelectorAll: () => []
        });

        // Should not throw even when AppState not ready
        await instance.saveCurrentTaskOrder();
    });

    await test('uses AppState.update for data changes', async () => {
        const schemaData = createMockSchemaData();
        let updateCalled = false;

        const mockAppState = {
            isReady: () => true,
            get: () => schemaData,
            update: async (producer, immediate) => {
                updateCalled = true;
                const newState = JSON.parse(JSON.stringify(schemaData));
                producer(newState);
            }
        };

        const instance = new TaskCore({
            AppState: mockAppState,
            querySelectorAll: () => []
        });

        await instance.saveCurrentTaskOrder();

        if (!updateCalled) {
            throw new Error('AppState.update was not called');
        }
    });

    // ===================================================================
    // ERROR HANDLING TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling</h4>';

    await test('handles missing dependencies gracefully', async () => {
        const instance = new TaskCore();

        // Should not throw even with no dependencies
        const result = instance.deps.showNotification('Test');
        // Fallback should work
    });

    await test('fallback notification works', async () => {
        const instance = new TaskCore();

        // Should use fallback and not throw
        instance.fallbackNotification('Test message', 'info');
    });

    await test('fallback load data returns null', async () => {
        const instance = new TaskCore();

        const result = instance.fallbackLoadData();
        if (result !== null) {
            throw new Error('Fallback loadData should return null');
        }
    });

    await test('fallback prompt modal works', async () => {
        const instance = new TaskCore();

        // Mock native prompt to avoid blocking test
        const originalPrompt = window.prompt;
        window.prompt = (msg) => 'Test Response';

        try {
            let called = false;
            instance.fallbackPromptModal({
                message: 'Test',
                callback: (result) => { called = true; }
            });

            // Fallback uses native prompt, should not throw
        } finally {
            // Restore original prompt
            window.prompt = originalPrompt;
        }
    });

    await test('handles null task item gracefully in completion change', async () => {
        const instance = new TaskCore();

        const mockCheckbox = {
            closest: () => null
        };

        // Should not throw even with null task item
        await instance.handleTaskCompletionChange(mockCheckbox);
    });

    // ===================================================================
    // DOM INTERACTION TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Interaction</h4>';

    await test('task completion handles checkbox state', async () => {
        const taskDiv = document.createElement('div');
        taskDiv.classList.add('task', 'overdue-task');
        document.body.appendChild(taskDiv);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        taskDiv.appendChild(checkbox);

        const instance = new TaskCore();
        await instance.handleTaskCompletionChange(checkbox);

        if (taskDiv.classList.contains('overdue-task')) {
            throw new Error('Overdue class should be removed when checked');
        }

        document.body.removeChild(taskDiv);
    });

    await test('integrates with DOM query selectors', async () => {
        const taskList = document.createElement('ul');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);

        const task1 = document.createElement('li');
        task1.classList.add('task');
        task1.dataset.taskId = 'task-1';
        taskList.appendChild(task1);

        const schemaData = createMockSchemaData();
        const instance = new TaskCore({
            AppState: createMockAppState(schemaData),
            querySelectorAll: (selector) => document.querySelectorAll(selector)
        });

        await instance.saveCurrentTaskOrder();

        document.body.removeChild(taskList);
    });

    // ===================================================================
    // GLOBAL EXPORTS TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">🌍 Global Exports</h4>';

    await test('global window.taskCore is available', async () => {
        // Note: test framework clears window.taskCore for isolation,
        // but it's restored after each test. Check if TaskCore class is available instead.
        if (typeof window.TaskCore === 'undefined') {
            throw new Error('window.TaskCore not exported globally');
        }
        // Verify instance was created during module load
        if (typeof window.addTask !== 'function') {
            throw new Error('window.taskCore instance methods not available');
        }
    });

    await test('global window.addTask function exists', async () => {
        if (typeof window.addTask !== 'function') {
            throw new Error('window.addTask not exported');
        }
    });

    await test('global window.handleTaskCompletionChange exists', async () => {
        if (typeof window.handleTaskCompletionChange !== 'function') {
            throw new Error('window.handleTaskCompletionChange not exported');
        }
    });

    await test('global window.saveCurrentTaskOrder exists', async () => {
        if (typeof window.saveCurrentTaskOrder !== 'function') {
            throw new Error('window.saveCurrentTaskOrder not exported');
        }
    });

    await test('global window.resetTasks exists', async () => {
        if (typeof window.resetTasks !== 'function') {
            throw new Error('window.resetTasks not exported');
        }
    });

    await test('global window.handleCompleteAllTasks exists', async () => {
        if (typeof window.handleCompleteAllTasks !== 'function') {
            throw new Error('window.handleCompleteAllTasks not exported');
        }
    });

    // ===================================================================
    // RESILIENT CONSTRUCTOR PATTERN TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Resilient Constructor Pattern</h4>';

    await test('works with partial dependencies', async () => {
        const instance = new TaskCore({
            showNotification: (msg) => ({ message: msg })
            // Other dependencies missing
        });

        if (!instance.deps.loadMiniCycleData) {
            throw new Error('Should have fallback for missing dependencies');
        }
    });

    await test('all dependency fallbacks are functions', async () => {
        const instance = new TaskCore({});

        const depKeys = Object.keys(instance.deps);
        for (const key of depKeys) {
            const dep = instance.deps[key];
            if (dep !== null && typeof dep !== 'function') {
                throw new Error(`Dependency ${key} is not a function or null`);
            }
        }
    });

    await test('handles missing AppState gracefully', async () => {
        const instance = new TaskCore({
            AppState: null,
            loadMiniCycleData: () => createMockSchemaData()
        });

        // Should fall back to localStorage operations
        await instance.saveCurrentTaskOrder();
        // Should not throw
    });

    // ===================================================================
    // PERFORMANCE TESTS
    // ===================================================================

    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Performance</h4>';

    await test('initializes quickly', async () => {
        const start = performance.now();
        const instance = new TaskCore();
        const duration = performance.now() - start;

        if (duration > 100) {
            throw new Error(`Initialization too slow: ${duration.toFixed(2)}ms`);
        }
    });

    await test('method calls are fast', async () => {
        const instance = new TaskCore();

        const start = performance.now();
        instance.fallbackNotification('Test');
        const duration = performance.now() - start;

        if (duration > 10) {
            throw new Error(`Method call too slow: ${duration.toFixed(2)}ms`);
        }
    });

    // ===================================================================
    // SUMMARY
    // ===================================================================

    const percentage = total.count > 0 ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">❌ ${total.count - passed.count} test(s) failed</div>`;
    }

    
    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

return { passed: passed.count, total: total.count };
}
