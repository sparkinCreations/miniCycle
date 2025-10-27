/**
 * 🧪 TaskDOM Tests
 * Tests for task DOM creation, rendering, and interaction management
 */

export async function runTaskDOMTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎨 TaskDOM Tests</h2><h3>Running tests...</h3>';

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

    // ✅ CRITICAL: Mark core as ready for test environment
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('TaskDOMManager class is defined', () => {
        if (typeof TaskDOMManager === 'undefined') {
            throw new Error('TaskDOMManager class not found');
        }
    });

    await test('TaskDOMManager class is exported to window', () => {
        if (typeof window.TaskDOMManager === 'undefined') {
            throw new Error('TaskDOMManager not available on window object');
        }
    });

    await test('initTaskDOMManager function is exported', () => {
        if (typeof window.initTaskDOMManager !== 'function') {
            throw new Error('initTaskDOMManager not found on window object');
        }
    });

    await test('all global wrapper functions are exported', () => {
        const requiredFunctions = [
            'validateAndSanitizeTaskInput',
            'buildTaskContext',
            'extractTaskDataFromDOM',
            'loadTaskContext',
            'createTaskDOMElements',
            'createTaskCheckbox',
            'createTaskLabel',
            'renderTasks',
            'refreshUIFromState',
            'setupTaskInteractions',
            'revealTaskButtons',
            'handleTaskButtonClick'
        ];

        for (const funcName of requiredFunctions) {
            if (typeof window[funcName] !== 'function') {
                throw new Error(`${funcName} not found on window object`);
            }
        }
    });

    // ============================================
    // 🔧 INITIALIZATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('creates instance with no dependencies', () => {
        const manager = new TaskDOMManager();

        if (!manager) {
            throw new Error('Failed to create TaskDOMManager instance');
        }

        if (!manager.deps) {
            throw new Error('Dependencies not initialized');
        }
    });

    await test('creates instance with custom dependencies', () => {
        const mockAppState = {
            isReady: () => true,
            get: () => ({ data: { cycles: {} }, appState: {} })
        };

        const mockNotification = (msg) => console.log(msg);

        const manager = new TaskDOMManager({
            AppState: mockAppState,
            showNotification: mockNotification
        });

        if (!manager) {
            throw new Error('Failed to create instance with dependencies');
        }

        if (manager.deps.AppState !== mockAppState) {
            throw new Error('Custom AppState dependency not set');
        }
    });

    await test('has correct version property', () => {
        const manager = new TaskDOMManager();

        if (!manager.version) {
            throw new Error('Version property not set');
        }

        if (typeof manager.version !== 'string') {
            throw new Error('Version should be a string');
        }
    });

    await test('initializes with uninitialized flag', () => {
        const manager = new TaskDOMManager();

        if (manager.initialized !== false) {
            throw new Error('Should start uninitialized');
        }
    });

    await test('init method waits for core systems', async () => {
        const manager = new TaskDOMManager();

        await manager.init();

        if (!manager.initialized) {
            throw new Error('Should be initialized after init() call');
        }
    });

    await test('init method is idempotent', async () => {
        const manager = new TaskDOMManager();

        await manager.init();
        await manager.init(); // Call again

        if (!manager.initialized) {
            throw new Error('Should still be initialized');
        }
    });

    await test('destroy method cleans up state', () => {
        const manager = new TaskDOMManager();
        manager.initialized = true;
        manager.state.renderCount = 10;

        manager.destroy();

        if (manager.initialized !== false) {
            throw new Error('Should be uninitialized after destroy');
        }

        if (manager.state.renderCount !== 0) {
            throw new Error('State should be reset');
        }
    });

    // ============================================
    // ✅ VALIDATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Validation</h4>';

    await test('validateAndSanitizeTaskInput rejects non-string', () => {
        const manager = new TaskDOMManager({
            sanitizeInput: (input) => input
        });

        const result = manager.validator.validateAndSanitizeTaskInput(123);

        if (result !== null) {
            throw new Error('Should return null for non-string input');
        }
    });

    await test('validateAndSanitizeTaskInput trims whitespace', () => {
        const manager = new TaskDOMManager({
            sanitizeInput: (input) => input
        });

        const result = manager.validator.validateAndSanitizeTaskInput('  test task  ');

        if (result !== 'test task') {
            throw new Error('Should trim whitespace');
        }
    });

    await test('validateAndSanitizeTaskInput rejects empty string', () => {
        const manager = new TaskDOMManager({
            sanitizeInput: (input) => input.trim()
        });

        const result = manager.validator.validateAndSanitizeTaskInput('   ');

        if (result !== null) {
            throw new Error('Should return null for empty/whitespace string');
        }
    });

    await test('validateAndSanitizeTaskInput enforces character limit', () => {
        const manager = new TaskDOMManager({
            sanitizeInput: (input) => input,
            showNotification: () => {}
        });

        const longText = 'a'.repeat(150); // Over 100 char limit
        const result = manager.validator.validateAndSanitizeTaskInput(longText);

        if (result !== null) {
            throw new Error('Should reject text over 100 characters');
        }
    });

    await test('validateAndSanitizeTaskInput uses sanitize function', () => {
        let sanitizeCalled = false;

        const manager = new TaskDOMManager({
            sanitizeInput: (input) => {
                sanitizeCalled = true;
                return input.replace(/[<>]/g, '');
            }
        });

        const result = manager.validator.validateAndSanitizeTaskInput('test<script>alert(1)</script>');

        if (!sanitizeCalled) {
            throw new Error('Sanitize function should be called');
        }

        if (result.includes('<') || result.includes('>')) {
            throw new Error('Should sanitize HTML tags');
        }
    });

    // ============================================
    // 🎨 DOM CREATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Creation</h4>';

    await test('createTaskCheckbox creates checkbox element', () => {
        const manager = new TaskDOMManager();

        const checkbox = manager.createTaskCheckbox('test-id', 'Test task', false);

        if (!checkbox || checkbox.tagName !== 'INPUT') {
            throw new Error('Should create INPUT element');
        }

        if (checkbox.type !== 'checkbox') {
            throw new Error('Should be checkbox type');
        }

        if (checkbox.id !== 'checkbox-test-id') {
            throw new Error('Should have correct ID');
        }
    });

    await test('createTaskCheckbox sets checked state', () => {
        const manager = new TaskDOMManager();

        const checked = manager.createTaskCheckbox('test-id', 'Test', true);
        const unchecked = manager.createTaskCheckbox('test-id', 'Test', false);

        if (checked.checked !== true) {
            throw new Error('Should be checked when completed=true');
        }

        if (unchecked.checked !== false) {
            throw new Error('Should be unchecked when completed=false');
        }
    });

    await test('createTaskCheckbox adds ARIA attributes', () => {
        const manager = new TaskDOMManager();

        const checkbox = manager.createTaskCheckbox('test-id', 'Test task', false);

        if (!checkbox.hasAttribute('aria-label')) {
            throw new Error('Should have aria-label');
        }

        if (!checkbox.hasAttribute('aria-checked')) {
            throw new Error('Should have aria-checked');
        }
    });

    await test('createTaskLabel creates span element', () => {
        const manager = new TaskDOMManager();

        const label = manager.createTaskLabel('Test task', 'test-id', false);

        if (!label || label.tagName !== 'SPAN') {
            throw new Error('Should create SPAN element');
        }

        if (!label.classList.contains('task-text')) {
            throw new Error('Should have task-text class');
        }

        if (label.textContent !== 'Test task') {
            throw new Error('Should have correct text content');
        }
    });

    await test('createTaskLabel adds recurring indicator when recurring=true', () => {
        const manager = new TaskDOMManager();

        const label = manager.createTaskLabel('Test task', 'test-id', true);

        const indicator = label.querySelector('.recurring-indicator');

        if (!indicator) {
            throw new Error('Should have recurring indicator for recurring task');
        }
    });

    await test('createTaskLabel does not add indicator when recurring=false', () => {
        const manager = new TaskDOMManager();

        const label = manager.createTaskLabel('Test task', 'test-id', false);

        const indicator = label.querySelector('.recurring-indicator');

        if (indicator) {
            throw new Error('Should not have recurring indicator for non-recurring task');
        }
    });

    await test('createMainTaskElement creates list item', () => {
        const manager = new TaskDOMManager();

        const taskItem = manager.createMainTaskElement('test-id', false, false, {}, {});

        if (!taskItem || taskItem.tagName !== 'LI') {
            throw new Error('Should create LI element');
        }

        if (!taskItem.classList.contains('task')) {
            throw new Error('Should have task class');
        }

        if (taskItem.dataset.taskId !== 'test-id') {
            throw new Error('Should have correct task ID');
        }
    });

    await test('createMainTaskElement makes element draggable', () => {
        const manager = new TaskDOMManager();

        const taskItem = manager.createMainTaskElement('test-id', false, false, {}, {});

        if (taskItem.getAttribute('draggable') !== 'true') {
            throw new Error('Should be draggable');
        }
    });

    await test('createMainTaskElement adds high-priority class when highPriority=true', () => {
        const manager = new TaskDOMManager();

        const taskItem = manager.createMainTaskElement('test-id', true, false, {}, {});

        if (!taskItem.classList.contains('high-priority')) {
            throw new Error('Should have high-priority class');
        }
    });

    await test('createMainTaskElement adds recurring class when has template', () => {
        const manager = new TaskDOMManager();

        const currentCycle = {
            recurringTemplates: {
                'test-id': {
                    recurringSettings: { interval: 'daily' }
                }
            }
        };

        const taskItem = manager.createMainTaskElement('test-id', false, false, {}, currentCycle);

        if (!taskItem.classList.contains('recurring')) {
            throw new Error('Should have recurring class when template exists');
        }
    });

    // ============================================
    // 🔄 RENDERING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Rendering</h4>';

    await test('renderTasks requires taskList element', async () => {
        const manager = new TaskDOMManager({
            getElementById: (id) => null
        });

        // Should not throw, just return early
        await manager.renderer.renderTasks([]);

        // If we get here, it handled missing taskList gracefully
    });

    await test('renderTasks handles empty array', async () => {
        const taskList = document.createElement('ul');
        taskList.id = 'taskList';

        const manager = new TaskDOMManager({
            getElementById: (id) => id === 'taskList' ? taskList : null,
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            updateStatsPanel: () => {}
        });

        await manager.renderer.renderTasks([]);

        if (taskList.innerHTML !== '') {
            throw new Error('Should clear taskList for empty array');
        }
    });

    await test('renderTasks validates array input', async () => {
        const manager = new TaskDOMManager({
            getElementById: (id) => document.createElement('ul')
        });

        // Should not throw for non-array
        await manager.renderer.renderTasks(null);
        await manager.renderer.renderTasks(undefined);
        await manager.renderer.renderTasks('not an array');
    });

    // ============================================
    // 🔧 UTILITY TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Utility Methods</h4>';

    await test('buildTaskContext requires AppState to be ready', () => {
        const mockAppState = {
            isReady: () => false
        };

        const taskItem = document.createElement('li');
        const result = TaskUtils.buildTaskContext(taskItem, 'test-id', mockAppState);

        if (result !== null) {
            throw new Error('Should return null when AppState not ready');
        }
    });

    await test('buildTaskContext extracts task data', () => {
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
                        'cycle-1': {
                            tasks: []
                        }
                    }
                },
                appState: {
                    activeCycleId: 'cycle-1'
                },
                settings: {}
            })
        };

        const context = TaskUtils.buildTaskContext(taskItem, 'test-id', mockAppState);

        if (!context) {
            throw new Error('Should return context object');
        }

        if (context.taskTextTrimmed !== 'Test task') {
            throw new Error('Should extract task text');
        }

        if (context.assignedTaskId !== 'test-id') {
            throw new Error('Should have correct task ID');
        }
    });

    await test('extractTaskDataFromDOM returns empty array when no taskList', () => {
        const mockGetById = (id) => null;

        const result = TaskUtils.extractTaskDataFromDOM(mockGetById);

        if (!Array.isArray(result) || result.length !== 0) {
            throw new Error('Should return empty array when taskList not found');
        }
    });

    await test('extractTaskDataFromDOM parses task elements', () => {
        const taskList = document.createElement('ul');
        taskList.id = 'taskList';

        const taskItem = document.createElement('li');
        taskItem.dataset.taskId = 'task-1';

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = 'Test task';
        taskItem.appendChild(taskText);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        taskItem.appendChild(checkbox);

        taskList.appendChild(taskItem);

        const mockGetById = (id) => id === 'taskList' ? taskList : null;

        const result = TaskUtils.extractTaskDataFromDOM(mockGetById);

        if (result.length !== 1) {
            throw new Error('Should extract one task');
        }

        if (result[0].id !== 'task-1') {
            throw new Error('Should have correct ID');
        }

        if (result[0].text !== 'Test task') {
            throw new Error('Should have correct text');
        }

        if (result[0].completed !== true) {
            throw new Error('Should have correct completed state');
        }
    });

    // ============================================
    // 🛡️ ERROR HANDLING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling</h4>';

    await test('handles missing sanitizeInput gracefully', () => {
        // Save and clear window.sanitizeInput to ensure no fallback available
        const savedSanitize = window.sanitizeInput;
        delete window.sanitizeInput;

        try {
            const manager = new TaskDOMManager({
                sanitizeInput: undefined
            });

            const result = manager.validator.validateAndSanitizeTaskInput('test');

            if (result !== null) {
                throw new Error('Should return null when sanitizeInput unavailable');
            }
        } finally {
            // Restore window.sanitizeInput
            if (savedSanitize) {
                window.sanitizeInput = savedSanitize;
            }
        }
    });

    await test('destroy handles missing DOM elements', () => {
        const manager = new TaskDOMManager({
            querySelectorAll: () => [] // No elements
        });

        // Should not throw
        manager.destroy();
    });

    await test('createTaskButton handles missing event handlers', () => {
        const manager = new TaskDOMManager();

        const buttonConfig = {
            class: 'test-btn',
            icon: '✓',
            show: true
        };

        const taskContext = {
            assignedTaskId: 'test-id',
            currentCycle: {},
            settings: {},
            remindersEnabled: false,
            recurring: false,
            highPriority: false
        };

        const container = document.createElement('div');

        // Should not throw even without handlers
        const button = manager.createTaskButton(buttonConfig, taskContext, container);

        if (!button) {
            throw new Error('Should create button even without handlers');
        }
    });

    await test('refreshUIFromState handles null state', async () => {
        const manager = new TaskDOMManager({
            AppState: {
                isReady: () => false
            }
        });

        // Should not throw
        await manager.renderer.refreshUIFromState(null);
    });

    await test('refreshUIFromState uses AppState when ready', async () => {
        let appStateCalled = false;

        const manager = new TaskDOMManager({
            AppState: {
                isReady: () => true,
                get: () => {
                    appStateCalled = true;
                    return {
                        data: {
                            cycles: {
                                'cycle-1': {
                                    tasks: []
                                }
                            }
                        },
                        appState: {
                            activeCycleId: 'cycle-1'
                        },
                        ui: {}
                    };
                }
            },
            getElementById: () => document.createElement('ul'),
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {}
        });

        await manager.renderer.refreshUIFromState();

        if (!appStateCalled) {
            throw new Error('Should call AppState.get() when ready');
        }
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

    await test('global validateAndSanitizeTaskInput works without manager', () => {
        // Call global wrapper before manager initialized
        const result = window.validateAndSanitizeTaskInput('test');

        // Should use fallback validation
        if (result !== 'test') {
            throw new Error('Global wrapper should have basic fallback');
        }
    });

    await test('global renderTasks handles uninitialized manager gracefully', async () => {
        // Should not throw even if taskDOMManager is null
        await window.renderTasks([]);
    });

    await test('global refreshUIFromState handles uninitialized manager', async () => {
        // Should not throw
        await window.refreshUIFromState(null);
    });

    // ============================================
    // 📊 INTEGRATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Integration</h4>';

    await test('integrates with window.addTask when available', async () => {
        const taskList = document.createElement('ul');
        taskList.id = 'taskList';

        let addTaskCalled = false;
        window.addTask = () => {
            addTaskCalled = true;
        };

        const manager = new TaskDOMManager({
            getElementById: (id) => id === 'taskList' ? taskList : null,
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            updateStatsPanel: () => {}
        });

        await manager.renderer.renderTasks([
            { id: 'task-1', text: 'Test', completed: false }
        ]);

        if (!addTaskCalled) {
            throw new Error('Should call window.addTask for rendering');
        }

        delete window.addTask;
    });

    await test('revealTaskButtons respects arrow visibility setting', () => {
        const taskItem = document.createElement('li');
        const taskOptions = document.createElement('div');
        taskOptions.className = 'task-options';

        const upBtn = document.createElement('button');
        upBtn.className = 'task-btn move-up';
        taskOptions.appendChild(upBtn);

        const downBtn = document.createElement('button');
        downBtn.className = 'task-btn move-down';
        taskOptions.appendChild(downBtn);

        taskItem.appendChild(taskOptions);

        const manager = new TaskDOMManager({
            AppState: {
                isReady: () => true,
                get: () => ({
                    ui: {
                        moveArrowsVisible: false
                    },
                    appState: {
                        activeCycleId: 'cycle-1'
                    },
                    data: {
                        cycles: {
                            'cycle-1': {}
                        }
                    }
                })
            },
            getElementById: () => document.createElement('div')
        });

        manager.events.revealTaskButtons(taskItem);

        if (upBtn.style.visibility !== 'hidden') {
            throw new Error('Up arrow should be hidden when setting is false');
        }

        if (downBtn.style.visibility !== 'hidden') {
            throw new Error('Down arrow should be hidden when setting is false');
        }
    });

    // ============================================
    // 📈 RESULTS
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
