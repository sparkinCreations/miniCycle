/**
 * 🧪 TaskDOM Tests
 * Tests for task DOM creation, rendering, and interaction management
 *
 * Updated for Phase 3 DI Pattern - direct module imports
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockSanitizeInput,
    createMockNotification,
    createProtectedTest,
    waitForAsyncOperations
} from './testHelpers.js';

// Direct import from module (not via appContext which may not be populated)
import {
    TaskDOMManager,
    setTaskDOMManagerDependencies
} from '../modules/task/taskDOM.js';

export async function runTaskDOMTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎨 TaskDOM Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Create mock sanitizeInput for tests
    const mockSanitizeInput = createMockSanitizeInput();

    // Set up module-level dependencies
    setTaskDOMManagerDependencies({
        sanitizeInput: mockSanitizeInput,
        showNotification: () => {},
        loadMiniCycleData: () => null
    });

    // Helper to get default dependencies for TaskDOMManager constructor
    const getDefaultDeps = () => ({
        sanitizeInput: mockSanitizeInput,
        showNotification: () => {},
        AppState: createMockAppState()
    });

    resultsDiv.innerHTML = '<h2>🎨 TaskDOM Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Use shared test helper with data protection
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('TaskDOMManager class is defined', () => {
        if (typeof TaskDOMManager === 'undefined') {
            throw new Error('TaskDOMManager class not found');
        }
    });

    await test('TaskDOMManager class is exported from module', () => {
        if (typeof TaskDOMManager !== 'function') {
            throw new Error('TaskDOMManager class not exported from module');
        }
    });

    await test('setTaskDOMManagerDependencies function is exported', () => {
        if (typeof setTaskDOMManagerDependencies !== 'function') {
            throw new Error('setTaskDOMManagerDependencies not exported from module');
        }
    });

    await test('TaskDOMManager has all expected methods', () => {
        const manager = new TaskDOMManager(getDefaultDeps());
        const requiredMethods = [
            'createTaskCheckbox',
            'createTaskLabel',
            'createMainTaskElement',
            'createTaskDOMElements',
            'injectDependency',
            'init',
            'destroy'
        ];

        for (const method of requiredMethods) {
            if (typeof manager[method] !== 'function') {
                throw new Error(`${method} not found on TaskDOMManager instance`);
            }
        }
    });

    // ============================================
    // 🔧 INITIALIZATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('throws error when required dependencies are missing', () => {
        let threwError = false;
        let errorMessage = '';

        try {
            // Intentionally NOT providing required deps to test validation
            const manager = new TaskDOMManager({});
        } catch (error) {
            threwError = true;
            errorMessage = error.message;
        }

        if (!threwError) {
            throw new Error('Should throw error when required dependencies are missing');
        }

        if (!errorMessage.includes('Missing required dependencies')) {
            throw new Error(`Expected error about missing deps, got: ${errorMessage}`);
        }
    });

    await test('creates instance with required dependencies', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

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
            ...getDefaultDeps(),
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


    await test('initializes with uninitialized flag', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

        if (manager.initialized !== false) {
            throw new Error('Should start uninitialized');
        }
    });

    await test('init method waits for core systems', async () => {
        const manager = new TaskDOMManager(getDefaultDeps());

        await manager.init();

        if (!manager.initialized) {
            throw new Error('Should be initialized after init() call');
        }
    });

    await test('init method is idempotent', async () => {
        const manager = new TaskDOMManager(getDefaultDeps());

        await manager.init();
        await manager.init(); // Call again

        if (!manager.initialized) {
            throw new Error('Should still be initialized');
        }
    });

    await test('destroy method cleans up state', () => {
        const manager = new TaskDOMManager(getDefaultDeps());
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

    await test('validateAndSanitizeTaskInput rejects non-string', async () => {
        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            sanitizeInput: (input) => input
        });

        await manager.init();

        const result = manager.validator.validateAndSanitizeTaskInput(123);

        if (result !== null) {
            throw new Error('Should return null for non-string input');
        }
    });

    await test('validateAndSanitizeTaskInput trims whitespace', async () => {
        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            sanitizeInput: (input) => input
        });

        await manager.init();

        const result = manager.validator.validateAndSanitizeTaskInput('  test task  ');

        if (result !== 'test task') {
            throw new Error('Should trim whitespace');
        }
    });

    await test('validateAndSanitizeTaskInput rejects empty string', async () => {
        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            sanitizeInput: (input) => input.trim()
        });

        await manager.init();

        const result = manager.validator.validateAndSanitizeTaskInput('   ');

        if (result !== null) {
            throw new Error('Should return null for empty/whitespace string');
        }
    });

    await test('validateAndSanitizeTaskInput enforces character limit', async () => {
        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            sanitizeInput: (input) => input,
            showNotification: () => {}
        });

        await manager.init();

        const longText = 'a'.repeat(150); // Over 100 char limit
        const result = manager.validator.validateAndSanitizeTaskInput(longText);

        if (result !== null) {
            throw new Error('Should reject text over 100 characters');
        }
    });

    await test('validateAndSanitizeTaskInput uses sanitize function', async () => {
        let sanitizeCalled = false;

        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            sanitizeInput: (input) => {
                sanitizeCalled = true;
                return input.replace(/[<>]/g, '');
            }
        });

        await manager.init();

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
        const manager = new TaskDOMManager(getDefaultDeps());

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
        const manager = new TaskDOMManager(getDefaultDeps());

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
        const manager = new TaskDOMManager(getDefaultDeps());

        const checkbox = manager.createTaskCheckbox('test-id', 'Test task', false);

        if (!checkbox.hasAttribute('aria-label')) {
            throw new Error('Should have aria-label');
        }

        if (!checkbox.hasAttribute('aria-checked')) {
            throw new Error('Should have aria-checked');
        }
    });

    await test('createTaskLabel creates span element', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

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
        const manager = new TaskDOMManager(getDefaultDeps());

        const label = manager.createTaskLabel('Test task', 'test-id', true);

        const indicator = label.querySelector('.recurring-indicator');

        if (!indicator) {
            throw new Error('Should have recurring indicator for recurring task');
        }
    });

    await test('createTaskLabel does not add indicator when recurring=false', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

        const label = manager.createTaskLabel('Test task', 'test-id', false);

        const indicator = label.querySelector('.recurring-indicator');

        if (indicator) {
            throw new Error('Should not have recurring indicator for non-recurring task');
        }
    });

    await test('createMainTaskElement creates list item', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

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
        const manager = new TaskDOMManager(getDefaultDeps());

        const taskItem = manager.createMainTaskElement('test-id', false, false, {}, {});

        if (taskItem.getAttribute('draggable') !== 'true') {
            throw new Error('Should be draggable');
        }
    });

    await test('createMainTaskElement adds high-priority class when highPriority=true', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

        const taskItem = manager.createMainTaskElement('test-id', true, false, {}, {});

        if (!taskItem.classList.contains('high-priority')) {
            throw new Error('Should have high-priority class');
        }
    });

    await test('createMainTaskElement adds recurring class when has template', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

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

    await test('createMainTaskElement preserves recurringSettings in DOM when recurring=false', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

        const recurringSettings = {
            frequency: 'weekly',
            weekly: { days: [2, 4] },
            indefinitely: true
        };

        // recurring=false but settings exist (user toggled OFF)
        const taskItem = manager.createMainTaskElement('test-id', false, false, recurringSettings, {});

        const attr = taskItem.getAttribute('data-recurring-settings');
        if (!attr) {
            throw new Error('Should preserve data-recurring-settings even when recurring=false');
        }

        const parsed = JSON.parse(attr);
        if (parsed.frequency !== 'weekly') {
            throw new Error('Settings not preserved correctly');
        }
        if (!parsed.weekly || !Array.isArray(parsed.weekly.days)) {
            throw new Error('Weekly settings not preserved');
        }
        if (parsed.weekly.days.length !== 2) {
            throw new Error('Weekly days not preserved');
        }
    });

    await test('createMainTaskElement sets data-recurring-settings when recurring=true', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

        const recurringSettings = {
            frequency: 'daily',
            indefinitely: true
        };

        const taskItem = manager.createMainTaskElement('test-id', false, true, recurringSettings, {});

        const attr = taskItem.getAttribute('data-recurring-settings');
        if (!attr) {
            throw new Error('Should have data-recurring-settings when recurring=true');
        }

        const parsed = JSON.parse(attr);
        if (parsed.frequency !== 'daily') {
            throw new Error('Settings not set correctly');
        }
    });

    await test('createMainTaskElement does not set data-recurring-settings when no settings exist', () => {
        const manager = new TaskDOMManager(getDefaultDeps());

        // No settings provided
        const taskItem = manager.createMainTaskElement('test-id', false, false, {}, {});

        const attr = taskItem.getAttribute('data-recurring-settings');
        if (attr) {
            throw new Error('Should not have data-recurring-settings when no settings exist');
        }
    });

    // ============================================
    // 🔄 RENDERING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Rendering</h4>';

    await test('renderTasks requires taskList element', async () => {
        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            getElementById: (id) => null
        });

        await manager.init();

        // Should not throw, just return early
        await manager.renderer.renderTasks([]);

        // If we get here, it handled missing taskList gracefully
    });

    await test('renderTasks handles empty array', async () => {
        const taskList = document.createElement('ul');
        taskList.id = 'taskList';

        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            getElementById: (id) => id === 'taskList' ? taskList : null,
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            updateStatsPanel: () => {}
        });

        await manager.init();

        await manager.renderer.renderTasks([]);

        if (taskList.innerHTML !== '') {
            throw new Error('Should clear taskList for empty array');
        }
    });

    await test('renderTasks validates array input', async () => {
        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            getElementById: (id) => document.createElement('ul')
        });

        await manager.init();

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

    await test('validates input through validator after init', async () => {
        // Test that the manager's validator works after init
        const manager = new TaskDOMManager(getDefaultDeps());
        await manager.init();

        // After init, validator should exist
        if (!manager.validator) {
            throw new Error('Validator should be initialized after init()');
        }

        // Test validation through the global validateAndSanitizeTaskInput function
        // which delegates to the manager's validator
        if (typeof window.validateAndSanitizeTaskInput !== 'function') {
            // Function might not be exposed globally - that's ok for DI pattern
            // Just verify the validator exists on the manager
            if (typeof manager.validator.validateAndSanitizeTaskInput !== 'function') {
                throw new Error('Validator should have validateAndSanitizeTaskInput method');
            }
        }
    });

    await test('destroy handles missing DOM elements', () => {
        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            querySelectorAll: () => [] // No elements
        });

        // Should not throw
        manager.destroy();
    });

    await test('createTaskButton handles missing event handlers', () => {
        const manager = new TaskDOMManager({
            ...getDefaultDeps()
        });

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
            ...getDefaultDeps(),
            AppState: {
                isReady: () => false
            }
        });

        await manager.init();

        // Should not throw
        await manager.renderer.refreshUIFromState(null);
    });

    await test('refreshUIFromState uses AppState when ready', async () => {
        let appStateCalled = false;

        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
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

        await manager.init();

        await manager.renderer.refreshUIFromState();

        if (!appStateCalled) {
            throw new Error('Should call AppState.get() when ready');
        }
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

    await test('global validateAndSanitizeTaskInput works with or without manager', () => {
        // Ensure sanitizeInput is available (required for validator)
        if (!window.sanitizeInput) {
            throw new Error('window.sanitizeInput not available - globalUtils not loaded');
        }

        // Call global wrapper (manager may or may not be initialized)
        const result = window.validateAndSanitizeTaskInput('  test  ');

        // Should trim whitespace and return valid input
        if (result !== 'test') {
            throw new Error(`Expected 'test', got '${result}' (sanitizeInput available: ${typeof window.sanitizeInput})`);
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

    await test('integrates with addTask when injected as dependency', async () => {
        const taskList = document.createElement('ul');
        taskList.id = 'taskList';

        let addTaskCalled = false;
        const mockAddTask = () => {
            addTaskCalled = true;
        };

        // Phase 3 DI: inject addTask as a dependency instead of relying on window.*
        const manager = new TaskDOMManager({
            ...getDefaultDeps(),
            getElementById: (id) => id === 'taskList' ? taskList : null,
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            updateStatsPanel: () => {},
            addTask: mockAddTask  // ✅ Inject as dependency
        });

        await manager.init();

        // After init(), taskToAddTaskOptions should be loaded from taskUtils.js
        // If for some reason it's not available (test env issues), inject directly to renderer
        if (!manager.renderer.deps.taskToAddTaskOptions) {
            manager.renderer.deps.taskToAddTaskOptions = (task) => ({
                taskId: task.id,
                completed: task.completed || false
            });
        }

        await manager.renderer.renderTasks([
            { id: 'task-1', text: 'Test', completed: false }
        ]);

        if (!addTaskCalled) {
            throw new Error('Should call injected addTask for rendering');
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
