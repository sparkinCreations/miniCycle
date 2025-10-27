/**
 * 🧪 TaskUtils Tests
 * Tests for task utility functions (context building, DOM extraction, etc.)
 */

export async function runTaskUtilsTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🛠️ TaskUtils Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // ============================================
    // Test Helper Function with Data Protection
    // ============================================
    async function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion', 'miniCycleMoveArrows'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) savedRealData[key] = value;
        });

        try {
            // Run test (handle both sync and async)
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }

            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
            // 🔒 RESTORE REAL APP DATA (runs even if test crashes)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('TaskUtils class is defined', () => {
        if (typeof TaskUtils === 'undefined') {
            throw new Error('TaskUtils class not found');
        }
    });

    await test('TaskUtils class is exported to window', () => {
        if (typeof window.TaskUtils === 'undefined') {
            throw new Error('TaskUtils not available on window object');
        }
    });

    await test('all utility functions are exported', () => {
        const requiredFunctions = [
            'buildTaskContext',
            'extractTaskDataFromDOM',
            'loadTaskContext',
            'scrollToNewTask',
            'handleOverdueStyling',
            'setupFinalTaskInteractions'
        ];

        for (const funcName of requiredFunctions) {
            if (typeof window[funcName] !== 'function') {
                throw new Error(`${funcName} not found on window object`);
            }
        }
    });

    await test('all static methods exist on TaskUtils', () => {
        const staticMethods = [
            'buildTaskContext',
            'extractTaskDataFromDOM',
            'loadTaskContext',
            'scrollToNewTask',
            'handleOverdueStyling',
            'setupFinalTaskInteractions'
        ];

        for (const method of staticMethods) {
            if (typeof TaskUtils[method] !== 'function') {
                throw new Error(`${method} not found as static method`);
            }
        }
    });

    // ============================================
    // 🏗️ BUILD TASK CONTEXT TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Build Task Context</h4>';

    await test('buildTaskContext requires AppState to be ready', () => {
        const taskItem = document.createElement('li');
        const mockAppState = {
            isReady: () => false
        };

        const result = TaskUtils.buildTaskContext(taskItem, 'test-id', mockAppState);

        if (result !== null) {
            throw new Error('Should return null when AppState not ready');
        }
    });

    await test('buildTaskContext returns null when no active cycle', () => {
        const taskItem = document.createElement('li');
        const mockAppState = {
            isReady: () => true,
            get: () => ({
                data: { cycles: {} },
                appState: { activeCycleId: null }
            })
        };

        const result = TaskUtils.buildTaskContext(taskItem, 'test-id', mockAppState);

        if (result !== null) {
            throw new Error('Should return null when no active cycle');
        }
    });

    await test('buildTaskContext extracts task text from DOM', () => {
        const taskItem = document.createElement('li');
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = 'Test task';
        taskItem.appendChild(taskText);

        const mockAppState = {
            isReady: () => true,
            get: () => ({
                data: {
                    cycles: {
                        'cycle-1': { tasks: [], autoReset: false, deleteCheckedTasks: false }
                    }
                },
                appState: { activeCycleId: 'cycle-1' },
                settings: {}
            })
        };

        const context = TaskUtils.buildTaskContext(taskItem, 'test-id', mockAppState);

        if (!context) {
            throw new Error('Should return context object');
        }

        if (context.taskTextTrimmed !== 'Test task') {
            throw new Error('Should extract task text correctly');
        }

        if (context.assignedTaskId !== 'test-id') {
            throw new Error('Should include task ID');
        }
    });

    await test('buildTaskContext includes cycle settings', () => {
        const taskItem = document.createElement('li');
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = 'Test';
        taskItem.appendChild(taskText);

        const mockAppState = {
            isReady: () => true,
            get: () => ({
                data: {
                    cycles: {
                        'cycle-1': { tasks: [], autoReset: true, deleteCheckedTasks: false }
                    }
                },
                appState: { activeCycleId: 'cycle-1' },
                settings: { theme: 'dark' }
            })
        };

        const context = TaskUtils.buildTaskContext(taskItem, 'test-id', mockAppState);

        if (context.autoResetEnabled !== true) {
            throw new Error('Should include autoReset setting');
        }

        if (context.deleteCheckedEnabled !== false) {
            throw new Error('Should include deleteCheckedTasks setting');
        }

        if (context.settings.theme !== 'dark') {
            throw new Error('Should include app settings');
        }
    });

    // ============================================
    // 📥 EXTRACT TASK DATA FROM DOM TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📥 Extract Task Data</h4>';

    await test('extractTaskDataFromDOM returns empty array when no taskList', () => {
        const mockGetById = (id) => null;
        const result = TaskUtils.extractTaskDataFromDOM(mockGetById);

        if (!Array.isArray(result) || result.length !== 0) {
            throw new Error('Should return empty array when taskList not found');
        }
    });

    await test('extractTaskDataFromDOM parses basic task elements', () => {
        const taskList = document.createElement('ul');

        const taskItem = document.createElement('li');
        taskItem.dataset.taskId = 'task-1';

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = 'Test task';
        taskItem.appendChild(taskText);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;
        taskItem.appendChild(checkbox);

        taskList.appendChild(taskItem);

        const mockGetById = (id) => id === 'taskList' ? taskList : null;
        const result = TaskUtils.extractTaskDataFromDOM(mockGetById);

        if (result.length !== 1) {
            throw new Error('Should extract one task');
        }

        if (result[0].id !== 'task-1') {
            throw new Error('Should extract task ID');
        }

        if (result[0].text !== 'Test task') {
            throw new Error('Should extract task text');
        }

        if (result[0].completed !== false) {
            throw new Error('Should extract completed state');
        }
    });

    await test('extractTaskDataFromDOM handles completed tasks', () => {
        const taskList = document.createElement('ul');

        const taskItem = document.createElement('li');
        taskItem.dataset.taskId = 'task-1';

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = 'Completed task';
        taskItem.appendChild(taskText);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        taskItem.appendChild(checkbox);

        taskList.appendChild(taskItem);

        const mockGetById = (id) => taskList;
        const result = TaskUtils.extractTaskDataFromDOM(mockGetById);

        if (result[0].completed !== true) {
            throw new Error('Should detect completed task');
        }
    });

    await test('extractTaskDataFromDOM detects high priority tasks', () => {
        const taskList = document.createElement('ul');

        const taskItem = document.createElement('li');
        taskItem.dataset.taskId = 'task-1';
        taskItem.classList.add('high-priority');

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = 'Important task';
        taskItem.appendChild(taskText);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        taskItem.appendChild(checkbox);

        taskList.appendChild(taskItem);

        const mockGetById = (id) => taskList;
        const result = TaskUtils.extractTaskDataFromDOM(mockGetById);

        if (result[0].highPriority !== true) {
            throw new Error('Should detect high priority');
        }
    });

    await test('extractTaskDataFromDOM skips invalid tasks', () => {
        const taskList = document.createElement('ul');

        // Valid task
        const validTask = document.createElement('li');
        validTask.dataset.taskId = 'task-1';
        const validText = document.createElement('span');
        validText.className = 'task-text';
        validText.textContent = 'Valid';
        validTask.appendChild(validText);
        const validCheckbox = document.createElement('input');
        validCheckbox.type = 'checkbox';
        validTask.appendChild(validCheckbox);

        // Invalid task (no task ID)
        const invalidTask = document.createElement('li');
        const invalidText = document.createElement('span');
        invalidText.className = 'task-text';
        invalidText.textContent = 'Invalid';
        invalidTask.appendChild(invalidText);

        taskList.appendChild(validTask);
        taskList.appendChild(invalidTask);

        const mockGetById = (id) => taskList;
        const result = TaskUtils.extractTaskDataFromDOM(mockGetById);

        if (result.length !== 1) {
            throw new Error('Should skip invalid tasks');
        }

        if (result[0].id !== 'task-1') {
            throw new Error('Should only include valid task');
        }
    });

    // ============================================
    // 📝 LOAD TASK CONTEXT TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Load Task Context</h4>';

    await test('loadTaskContext throws when no schema data', () => {
        const mockLoadData = () => null;
        const mockGenId = () => 'generated-id';

        let errorThrown = false;
        try {
            TaskUtils.loadTaskContext('Test', null, {}, false, mockLoadData, mockGenId);
        } catch (error) {
            errorThrown = true;
        }

        if (!errorThrown) {
            throw new Error('Should throw when schema data not available');
        }
    });

    await test('loadTaskContext throws when no active cycle', () => {
        const mockLoadData = () => ({
            cycles: {},
            activeCycle: null,
            settings: {},
            reminders: {}
        });
        const mockGenId = () => 'generated-id';

        let errorThrown = false;
        try {
            TaskUtils.loadTaskContext('Test', null, {}, false, mockLoadData, mockGenId);
        } catch (error) {
            errorThrown = true;
        }

        if (!errorThrown) {
            throw new Error('Should throw when no active cycle');
        }
    });

    await test('loadTaskContext generates ID when not provided', () => {
        const mockLoadData = () => ({
            cycles: { 'cycle-1': { tasks: [] } },
            activeCycle: 'cycle-1',
            settings: {},
            reminders: {}
        });
        const mockGenId = () => 'generated-id';

        const context = TaskUtils.loadTaskContext('Test', null, {}, false, mockLoadData, mockGenId);

        if (context.assignedTaskId !== 'generated-id') {
            throw new Error('Should use generated ID');
        }
    });

    await test('loadTaskContext uses provided ID', () => {
        const mockLoadData = () => ({
            cycles: { 'cycle-1': { tasks: [] } },
            activeCycle: 'cycle-1',
            settings: {},
            reminders: {}
        });
        const mockGenId = () => 'generated-id';

        const context = TaskUtils.loadTaskContext('Test', 'custom-id', {}, false, mockLoadData, mockGenId);

        if (context.assignedTaskId !== 'custom-id') {
            throw new Error('Should use provided ID');
        }
    });

    await test('loadTaskContext includes isLoading flag', () => {
        const mockLoadData = () => ({
            cycles: { 'cycle-1': { tasks: [] } },
            activeCycle: 'cycle-1',
            settings: {},
            reminders: {}
        });
        const mockGenId = () => 'id';

        const contextLoading = TaskUtils.loadTaskContext('Test', 'id', {}, true, mockLoadData, mockGenId);
        const contextNotLoading = TaskUtils.loadTaskContext('Test', 'id', {}, false, mockLoadData, mockGenId);

        if (contextLoading.isLoading !== true) {
            throw new Error('Should set isLoading to true when passed');
        }

        if (contextNotLoading.isLoading !== false) {
            throw new Error('Should set isLoading to false by default');
        }
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

    await test('global buildTaskContext works', () => {
        const taskItem = document.createElement('li');
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = 'Test';
        taskItem.appendChild(taskText);

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                data: {
                    cycles: { 'cycle-1': { tasks: [] } }
                },
                appState: { activeCycleId: 'cycle-1' },
                settings: {}
            })
        };

        const result = window.buildTaskContext(taskItem, 'test-id');

        if (!result) {
            throw new Error('Global wrapper should work');
        }

        if (result.taskTextTrimmed !== 'Test') {
            throw new Error('Global wrapper should extract task text');
        }
    });

    await test('global extractTaskDataFromDOM works', () => {
        const result = window.extractTaskDataFromDOM();

        if (!Array.isArray(result)) {
            throw new Error('Global wrapper should return array');
        }
    });

    await test('global scrollToNewTask does not throw', () => {
        const mockList = document.createElement('ul');

        // Should not throw
        window.scrollToNewTask(mockList);
    });

    await test('global handleOverdueStyling does not throw', () => {
        const mockItem = document.createElement('li');

        // Should not throw
        window.handleOverdueStyling(mockItem, true);
    });

    await test('global setupFinalTaskInteractions does not throw', () => {
        const mockItem = document.createElement('li');

        // Should not throw
        window.setupFinalTaskInteractions(mockItem, false);
    });

    // ============================================
    // 📊 RESULTS
    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    return { passed: passed.count, total: total.count };
}
