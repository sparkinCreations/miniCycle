/**
 * TaskUI Tests (DI-Pure)
 * Tests for modules/ui/taskUI.js
 *
 * Tests the task UI functionality:
 * - TaskOptionsVisibilityController (mode-aware visibility)
 * - refreshTaskListUI
 * - showTaskOptions/hideTaskOptions
 * - checkCompleteAllButton
 */

let TaskOptionsVisibilityController = null;
let setTaskUIDependencies = null;
let refreshTaskListUI = null;
let showTaskOptions = null;
let hideTaskOptions = null;
let hideTaskButtons = null;
let checkCompleteAllButton = null;

export async function runTaskUITests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>TaskUI Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const module = await import('../modules/ui/taskUI.js');
        TaskOptionsVisibilityController = module.TaskOptionsVisibilityController;
        setTaskUIDependencies = module.setTaskUIDependencies;
        refreshTaskListUI = module.refreshTaskListUI;
        showTaskOptions = module.showTaskOptions;
        hideTaskOptions = module.hideTaskOptions;
        hideTaskButtons = module.hideTaskButtons;
        checkCompleteAllButton = module.checkCompleteAllButton;
        resultsDiv.innerHTML = '<h2>TaskUI Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>TaskUI Tests</h2><div class="result fail">Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    if (!TaskOptionsVisibilityController) {
        resultsDiv.innerHTML += '<div class="result fail">TaskOptionsVisibilityController class not found</div>';
        return { passed: 0, total: 1 };
    }

    let passed = { count: 0 }, total = { count: 0 };

    // Create mock dependencies
    function createMockDeps(overrides = {}) {
        return {
            loadMiniCycleData: () => ({
                cycles: {
                    'test-cycle': {
                        title: 'Test Cycle',
                        tasks: [
                            { id: '1', text: 'Task 1', completed: false },
                            { id: '2', text: 'Task 2', completed: true }
                        ]
                    }
                },
                activeCycle: 'test-cycle'
            }),
            addTask: () => {},
            updateRecurringButtonVisibility: () => {},
            getElementById: (id) => document.getElementById(id),
            getTaskList: () => document.getElementById('taskList'),
            getCompleteAllButton: () => document.getElementById('completeAll'),
            isTouchDevice: () => false,
            ...overrides
        };
    }

    // Create DOM elements for testing
    function createTestDOM() {
        const container = document.createElement('div');
        container.id = 'test-task-ui-container';
        container.innerHTML = `
            <ul id="taskList"></ul>
            <button id="completeAll" style="display: none;"></button>
        `;
        document.body.appendChild(container);
        return container;
    }

    function createMockTaskElement(id = 'test-task') {
        const task = document.createElement('li');
        task.className = 'task';
        task.dataset.id = id;

        const taskOptions = document.createElement('div');
        taskOptions.className = 'task-options';
        taskOptions.style.visibility = 'hidden';
        taskOptions.style.opacity = '0';
        taskOptions.style.pointerEvents = 'none';

        const btn1 = document.createElement('button');
        btn1.className = 'task-btn';
        const btn2 = document.createElement('button');
        btn2.className = 'task-btn';

        taskOptions.appendChild(btn1);
        taskOptions.appendChild(btn2);
        task.appendChild(taskOptions);

        return task;
    }

    function cleanupTestDOM() {
        const container = document.getElementById('test-task-ui-container');
        if (container) container.remove();
        // Clean up body classes
        document.body.classList.remove('show-three-dots-enabled', 'auto-cycle-mode');
    }

    async function test(name, testFn) {
        total.count++;
        try {
            cleanupTestDOM();
            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            cleanupTestDOM();
        }
    }

    // =====================================================
    // TaskOptionsVisibilityController Tests
    // =====================================================
    resultsDiv.innerHTML += '<h3>TaskOptionsVisibilityController</h3>';

    await test('getMode returns hover when three-dots not enabled', async () => {
        document.body.classList.remove('show-three-dots-enabled');
        const mode = TaskOptionsVisibilityController.getMode();
        if (mode !== 'hover') {
            throw new Error(`Expected 'hover', got '${mode}'`);
        }
    });

    await test('getMode returns three-dots when enabled', async () => {
        document.body.classList.add('show-three-dots-enabled');
        const mode = TaskOptionsVisibilityController.getMode();
        if (mode !== 'three-dots') {
            throw new Error(`Expected 'three-dots', got '${mode}'`);
        }
    });

    await test('canHandle allows mouseenter in hover mode', async () => {
        document.body.classList.remove('show-three-dots-enabled');
        if (!TaskOptionsVisibilityController.canHandle('mouseenter')) {
            throw new Error('mouseenter should be allowed in hover mode');
        }
    });

    await test('canHandle blocks mouseenter in three-dots mode', async () => {
        document.body.classList.add('show-three-dots-enabled');
        if (TaskOptionsVisibilityController.canHandle('mouseenter')) {
            throw new Error('mouseenter should be blocked in three-dots mode');
        }
    });

    await test('canHandle always allows long-press', async () => {
        document.body.classList.remove('show-three-dots-enabled');
        if (!TaskOptionsVisibilityController.canHandle('long-press')) {
            throw new Error('long-press should be allowed in hover mode');
        }

        document.body.classList.add('show-three-dots-enabled');
        if (!TaskOptionsVisibilityController.canHandle('long-press')) {
            throw new Error('long-press should be allowed in three-dots mode');
        }
    });

    await test('canHandle allows three-dots-button in three-dots mode', async () => {
        document.body.classList.add('show-three-dots-enabled');
        if (!TaskOptionsVisibilityController.canHandle('three-dots-button')) {
            throw new Error('three-dots-button should be allowed in three-dots mode');
        }
    });

    await test('show makes task options visible in hover mode', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        const result = TaskOptionsVisibilityController.show(task, 'mouseenter');
        const taskOptions = task.querySelector('.task-options');

        if (!result) {
            throw new Error('show should return true');
        }
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('visibility should be visible');
        }
        if (taskOptions.style.opacity !== '1') {
            throw new Error('opacity should be 1');
        }
    });

    await test('hide makes task options hidden in hover mode', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        // First show
        TaskOptionsVisibilityController.show(task, 'mouseenter');
        // Then hide
        const result = TaskOptionsVisibilityController.hide(task, 'mouseleave');
        const taskOptions = task.querySelector('.task-options');

        if (!result) {
            throw new Error('hide should return true');
        }
        if (taskOptions.style.visibility !== 'hidden') {
            throw new Error('visibility should be hidden');
        }
        if (taskOptions.style.opacity !== '0') {
            throw new Error('opacity should be 0');
        }
    });

    await test('setVisibility returns false for missing task-options', async () => {
        createTestDOM();
        const task = document.createElement('li');
        task.className = 'task';
        // No .task-options child

        const result = TaskOptionsVisibilityController.setVisibility(task, true, 'test');
        if (result !== false) {
            throw new Error('Should return false for missing task-options');
        }
    });

    await test('show blocked in three-dots mode for hover callers', async () => {
        createTestDOM();
        document.body.classList.add('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        const result = TaskOptionsVisibilityController.show(task, 'mouseenter');
        const taskOptions = task.querySelector('.task-options');

        if (result !== false) {
            throw new Error('show should return false in three-dots mode for mouseenter');
        }
        if (taskOptions.style.visibility !== 'hidden') {
            throw new Error('visibility should remain hidden');
        }
    });

    // =====================================================
    // showTaskOptions/hideTaskOptions Tests
    // =====================================================
    resultsDiv.innerHTML += '<h3>showTaskOptions/hideTaskOptions</h3>';

    await test('showTaskOptions shows options on desktop', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');
        setTaskUIDependencies({ isTouchDevice: () => false });

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        const event = { currentTarget: task, type: 'mouseenter' };
        showTaskOptions(event);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options should be visible on desktop');
        }
    });

    await test('showTaskOptions blocked on mobile without long-press', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');
        setTaskUIDependencies({ isTouchDevice: () => true });

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        const event = { currentTarget: task, type: 'mouseenter' };
        showTaskOptions(event);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility === 'visible') {
            throw new Error('Task options should remain hidden on mobile without long-press');
        }
    });

    await test('showTaskOptions works on mobile with long-press', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');
        setTaskUIDependencies({ isTouchDevice: () => true });

        const task = createMockTaskElement();
        task.classList.add('long-pressed');
        document.getElementById('taskList').appendChild(task);

        const event = { currentTarget: task, type: 'mouseenter' };
        showTaskOptions(event);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options should be visible on mobile with long-press');
        }
    });

    await test('hideTaskOptions hides options on desktop', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');
        setTaskUIDependencies({ isTouchDevice: () => false });

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        // First show
        TaskOptionsVisibilityController.show(task, 'mouseenter');

        const event = { currentTarget: task, type: 'mouseleave' };
        hideTaskOptions(event);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'hidden') {
            throw new Error('Task options should be hidden');
        }
    });

    await test('hideTaskOptions blocked on mobile with long-press', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');
        setTaskUIDependencies({ isTouchDevice: () => true });

        const task = createMockTaskElement();
        task.classList.add('long-pressed');
        document.getElementById('taskList').appendChild(task);

        // First show
        TaskOptionsVisibilityController.show(task, 'long-press');

        const event = { currentTarget: task, type: 'mouseleave' };
        hideTaskOptions(event);

        const taskOptions = task.querySelector('.task-options');
        // Should remain visible because long-pressed
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options should remain visible during long-press');
        }
    });

    // =====================================================
    // hideTaskButtons Tests
    // =====================================================
    resultsDiv.innerHTML += '<h3>hideTaskButtons</h3>';

    await test('hideTaskButtons hides options in hover mode', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        // First show
        TaskOptionsVisibilityController.show(task, 'mouseenter');

        hideTaskButtons(task);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'hidden') {
            throw new Error('Task options should be hidden');
        }
    });

    await test('hideTaskButtons skipped during rearranging', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        task.classList.add('rearranging');
        document.getElementById('taskList').appendChild(task);

        // First show
        TaskOptionsVisibilityController.show(task, 'mouseenter');

        hideTaskButtons(task);

        const taskOptions = task.querySelector('.task-options');
        // Should remain visible because rearranging
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options should remain visible during rearranging');
        }
    });

    await test('hideTaskButtons skipped during long-press', async () => {
        createTestDOM();
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        task.classList.add('long-pressed');
        document.getElementById('taskList').appendChild(task);

        // First show
        TaskOptionsVisibilityController.show(task, 'long-press');

        hideTaskButtons(task);

        const taskOptions = task.querySelector('.task-options');
        // Should remain visible because long-pressed
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options should remain visible during long-press');
        }
    });

    await test('hideTaskButtons blocked in three-dots mode', async () => {
        createTestDOM();
        document.body.classList.add('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        // Show via three-dots-button
        TaskOptionsVisibilityController.show(task, 'three-dots-button');

        hideTaskButtons(task);

        const taskOptions = task.querySelector('.task-options');
        // Should remain visible because hideTaskButtons not allowed in three-dots mode
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options should remain visible in three-dots mode');
        }
    });

    // =====================================================
    // checkCompleteAllButton Tests
    // =====================================================
    resultsDiv.innerHTML += '<h3>checkCompleteAllButton</h3>';

    await test('checkCompleteAllButton shows button when tasks exist', async () => {
        createTestDOM();
        setTaskUIDependencies(createMockDeps());
        document.body.classList.remove('auto-cycle-mode');

        const taskList = document.getElementById('taskList');
        const task = document.createElement('li');
        taskList.appendChild(task);

        checkCompleteAllButton();

        const btn = document.getElementById('completeAll');
        if (btn.style.display !== 'block') {
            throw new Error('Button should be displayed when tasks exist');
        }
    });

    await test('checkCompleteAllButton hides button when no tasks', async () => {
        createTestDOM();
        setTaskUIDependencies(createMockDeps());
        document.body.classList.remove('auto-cycle-mode');

        // No tasks added
        checkCompleteAllButton();

        const btn = document.getElementById('completeAll');
        if (btn.style.display !== 'none') {
            throw new Error('Button should be hidden when no tasks');
        }
    });

    await test('checkCompleteAllButton hides button in auto mode', async () => {
        createTestDOM();
        setTaskUIDependencies(createMockDeps());
        document.body.classList.add('auto-cycle-mode');

        const taskList = document.getElementById('taskList');
        const task = document.createElement('li');
        taskList.appendChild(task);

        checkCompleteAllButton();

        const btn = document.getElementById('completeAll');
        if (btn.style.display !== 'none') {
            throw new Error('Button should be hidden in auto mode');
        }
    });

    // =====================================================
    // refreshTaskListUI Tests
    // =====================================================
    resultsDiv.innerHTML += '<h3>refreshTaskListUI</h3>';

    await test('refreshTaskListUI clears and repopulates task list', async () => {
        createTestDOM();

        let addTaskCalls = [];
        setTaskUIDependencies({
            ...createMockDeps(),
            addTask: (...args) => { addTaskCalls.push(args); }
        });

        const taskList = document.getElementById('taskList');
        const oldTask = document.createElement('li');
        oldTask.textContent = 'Old task';
        taskList.appendChild(oldTask);

        await refreshTaskListUI();

        if (addTaskCalls.length !== 2) {
            throw new Error(`Expected 2 addTask calls, got ${addTaskCalls.length}`);
        }

        if (addTaskCalls[0][0] !== 'Task 1') {
            throw new Error('First task text should be Task 1');
        }
    });

    await test('refreshTaskListUI throws when no schema data', async () => {
        createTestDOM();
        setTaskUIDependencies({
            ...createMockDeps(),
            loadMiniCycleData: () => null
        });

        let threwError = false;
        try {
            await refreshTaskListUI();
        } catch (e) {
            threwError = true;
            if (!e.message.includes('Schema 2.5 data not found')) {
                throw new Error('Wrong error message');
            }
        }

        if (!threwError) {
            throw new Error('Should throw error when no schema data');
        }
    });

    await test('refreshTaskListUI handles missing active cycle gracefully', async () => {
        createTestDOM();
        setTaskUIDependencies({
            ...createMockDeps(),
            loadMiniCycleData: () => ({
                cycles: {},
                activeCycle: 'nonexistent'
            })
        });

        // Should not throw, just return early
        await refreshTaskListUI();
        // If we get here without error, test passes
    });

    await test('refreshTaskListUI calls updateRecurringButtonVisibility', async () => {
        createTestDOM();

        let updateCalled = false;
        setTaskUIDependencies({
            ...createMockDeps(),
            updateRecurringButtonVisibility: () => { updateCalled = true; }
        });

        await refreshTaskListUI();

        if (!updateCalled) {
            throw new Error('updateRecurringButtonVisibility should be called');
        }
    });

    // Final cleanup
    cleanupTestDOM();

    // Results
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace('<h3>Running tests...</h3>', summary);

    return { passed: passed.count, total: total.count };
}
