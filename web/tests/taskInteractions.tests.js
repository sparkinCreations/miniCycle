/**
 * TaskInteractions Tests (DI-Pure)
 * Tests for modules/ui/taskInteractions.js
 *
 * Tests keyboard accessibility for task options:
 * - Focus-based visibility toggling
 * - Keyboard navigation support
 */

let setTaskInteractionsDependencies = null;
let attachKeyboardTaskOptionToggle = null;
let ensureTaskUILoaded = null;

export async function runTaskInteractionsTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>TaskInteractions Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const module = await import('../modules/ui/taskInteractions.js');
        setTaskInteractionsDependencies = module.setTaskInteractionsDependencies;
        attachKeyboardTaskOptionToggle = module.attachKeyboardTaskOptionToggle;
        ensureTaskUILoaded = module.ensureTaskUILoaded;
        // Ensure TaskOptionsVisibilityController is loaded before running tests
        await ensureTaskUILoaded();
        resultsDiv.innerHTML = '<h2>TaskInteractions Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>TaskInteractions Tests</h2><div class="result fail">Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    if (!attachKeyboardTaskOptionToggle) {
        resultsDiv.innerHTML += '<div class="result fail">attachKeyboardTaskOptionToggle function not found</div>';
        return { passed: 0, total: 1 };
    }

    let passed = { count: 0 }, total = { count: 0 };

    // Create mock dependencies
    function createMockDeps(overrides = {}) {
        return {
            safeAddEventListener: (el, evt, fn) => el?.addEventListener(evt, fn),
            ...overrides
        };
    }

    // Create DOM elements for testing
    function createTestDOM() {
        const container = document.createElement('div');
        container.id = 'test-task-interactions-container';
        container.innerHTML = `<ul id="taskList"></ul>`;
        document.body.appendChild(container);
        return container;
    }

    function createMockTaskElement(id = 'test-task') {
        const task = document.createElement('li');
        task.className = 'task';
        task.dataset.id = id;
        task.tabIndex = 0;

        const taskOptions = document.createElement('div');
        taskOptions.className = 'task-options';
        taskOptions.style.visibility = 'hidden';
        taskOptions.style.opacity = '0';
        taskOptions.style.pointerEvents = 'none';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'focus-safe';

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = 'Test task';

        const editBtn = document.createElement('button');
        editBtn.className = 'task-btn edit-btn';
        editBtn.tabIndex = 0;

        taskOptions.appendChild(editBtn);
        task.appendChild(checkbox);
        task.appendChild(taskText);
        task.appendChild(taskOptions);

        return task;
    }

    function cleanupTestDOM() {
        const container = document.getElementById('test-task-interactions-container');
        if (container) container.remove();
        document.body.classList.remove('show-three-dots-enabled');
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
    // attachKeyboardTaskOptionToggle Tests
    // =====================================================
    resultsDiv.innerHTML += '<h3>attachKeyboardTaskOptionToggle</h3>';

    await test('attachKeyboardTaskOptionToggle adds event listeners', async () => {
        createTestDOM();
        setTaskInteractionsDependencies(createMockDeps());
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        let listenersAdded = [];
        setTaskInteractionsDependencies({
            safeAddEventListener: (el, evt, fn) => {
                listenersAdded.push(evt);
                el?.addEventListener(evt, fn);
            }
        });

        attachKeyboardTaskOptionToggle(task);

        if (!listenersAdded.includes('focusin')) {
            throw new Error('focusin listener should be added');
        }
        if (!listenersAdded.includes('focusout')) {
            throw new Error('focusout listener should be added');
        }
    });

    await test('focusin on action button shows task options', async () => {
        createTestDOM();
        setTaskInteractionsDependencies(createMockDeps());
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        attachKeyboardTaskOptionToggle(task);

        const editBtn = task.querySelector('.edit-btn');
        const focusEvent = new FocusEvent('focusin', {
            bubbles: true,
            relatedTarget: null
        });
        Object.defineProperty(focusEvent, 'target', { value: editBtn });
        task.dispatchEvent(focusEvent);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options should be visible after focusin on button');
        }
    });

    await test('focusin on checkbox does not show task options', async () => {
        createTestDOM();
        setTaskInteractionsDependencies(createMockDeps());
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        attachKeyboardTaskOptionToggle(task);

        const checkbox = task.querySelector('input[type="checkbox"]');
        const focusEvent = new FocusEvent('focusin', {
            bubbles: true,
            relatedTarget: null
        });
        Object.defineProperty(focusEvent, 'target', { value: checkbox });
        task.dispatchEvent(focusEvent);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility === 'visible') {
            throw new Error('Task options should remain hidden when focusing checkbox');
        }
    });

    await test('focusin on task-text does not show task options', async () => {
        createTestDOM();
        setTaskInteractionsDependencies(createMockDeps());
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        attachKeyboardTaskOptionToggle(task);

        const taskText = task.querySelector('.task-text');
        const focusEvent = new FocusEvent('focusin', {
            bubbles: true,
            relatedTarget: null
        });
        Object.defineProperty(focusEvent, 'target', { value: taskText });
        task.dispatchEvent(focusEvent);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility === 'visible') {
            throw new Error('Task options should remain hidden when focusing task-text');
        }
    });

    await test('focusout hides task options when focus leaves task', async () => {
        createTestDOM();
        setTaskInteractionsDependencies(createMockDeps());
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        attachKeyboardTaskOptionToggle(task);

        // First show options
        const editBtn = task.querySelector('.edit-btn');
        const focusinEvent = new FocusEvent('focusin', {
            bubbles: true,
            relatedTarget: null
        });
        Object.defineProperty(focusinEvent, 'target', { value: editBtn });
        task.dispatchEvent(focusinEvent);

        // Now focus out to external element
        const external = document.createElement('button');
        document.body.appendChild(external);

        const focusoutEvent = new FocusEvent('focusout', {
            bubbles: true,
            relatedTarget: external
        });
        task.dispatchEvent(focusoutEvent);

        external.remove();

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'hidden') {
            throw new Error('Task options should be hidden after focus leaves task');
        }
    });

    await test('focusout does not hide when focus stays within task', async () => {
        createTestDOM();
        setTaskInteractionsDependencies(createMockDeps());
        document.body.classList.remove('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        // Add another button inside task
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'task-btn delete-btn';
        task.querySelector('.task-options').appendChild(deleteBtn);

        attachKeyboardTaskOptionToggle(task);

        // First show options
        const editBtn = task.querySelector('.edit-btn');
        const focusinEvent = new FocusEvent('focusin', {
            bubbles: true,
            relatedTarget: null
        });
        Object.defineProperty(focusinEvent, 'target', { value: editBtn });
        task.dispatchEvent(focusinEvent);

        // Focus out to another element within task
        const focusoutEvent = new FocusEvent('focusout', {
            bubbles: true,
            relatedTarget: deleteBtn
        });
        task.dispatchEvent(focusoutEvent);

        const taskOptions = task.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options should remain visible when focus stays within task');
        }
    });

    await test('handles missing safeAddEventListener gracefully', async () => {
        createTestDOM();
        setTaskInteractionsDependencies({ safeAddEventListener: null });

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        // Should not throw
        attachKeyboardTaskOptionToggle(task);
        // If we get here without error, test passes
    });

    await test('respects three-dots mode permissions', async () => {
        createTestDOM();
        setTaskInteractionsDependencies(createMockDeps());
        document.body.classList.add('show-three-dots-enabled');

        const task = createMockTaskElement();
        document.getElementById('taskList').appendChild(task);

        attachKeyboardTaskOptionToggle(task);

        // Try to show via focusin - should be blocked in three-dots mode
        const editBtn = task.querySelector('.edit-btn');
        const focusEvent = new FocusEvent('focusin', {
            bubbles: true,
            relatedTarget: null
        });
        Object.defineProperty(focusEvent, 'target', { value: editBtn });
        task.dispatchEvent(focusEvent);

        const taskOptions = task.querySelector('.task-options');
        // focusin is not in three-dots permissions, so should be blocked
        if (taskOptions.style.visibility === 'visible') {
            throw new Error('Task options should be blocked by three-dots mode for focusin');
        }
    });

    // Final cleanup
    cleanupTestDOM();

    // Results
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace('<h3>Running tests...</h3>', summary);

    return { passed: passed.count, total: total.count };
}
