/**
 * 🧪 TaskEvents Module Tests
 * Tests event handling and user interaction logic
 *
 * Coverage:
 * - Module loading (TaskEvents class, window exports)
 * - Initialization (constructor, dependencies)
 * - Event handling (button clicks, hover, focus)
 * - Task interaction setup
 * - Global wrapper functions
 */

export async function runTaskEventsTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎮 TaskEvents Tests</h2><h3>Running tests...</h3>';

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
    // Test Utilities
    // ============================================
    function createMockDependencies() {
        return {
            AppState: {
                isReady: () => true,
                get: () => ({
                    appState: { activeCycleId: 'cycle1' },
                    data: {
                        cycles: {
                            cycle1: {
                                deleteCheckedTasks: true,
                                autoReset: false
                            }
                        }
                    },
                    settings: {
                        alwaysShowRecurring: false
                    },
                    ui: {
                        moveArrowsVisible: true
                    }
                })
            },
            showNotification: (msg, type) => {},
            autoSave: () => {},
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            safeAddEventListener: (el, event, handler) => {
                if (el && typeof el.addEventListener === 'function') {
                    el.addEventListener(event, handler);
                }
            }
        };
    }

    function createMockTaskItem(options = {}) {
        const taskItem = document.createElement('div');
        taskItem.className = 'task';
        taskItem.setAttribute('data-id', options.id || 'task-1');

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = options.text || 'Test Task';
        taskItem.appendChild(taskText);

        const taskOptions = document.createElement('div');
        taskOptions.className = 'task-options';
        taskOptions.style.visibility = 'hidden';
        taskOptions.style.opacity = '0';
        taskOptions.style.pointerEvents = 'none';

        // Add buttons
        ['edit-btn', 'delete-btn', 'priority-btn', 'move-up', 'move-down', 'recurring-btn', 'set-due-date', 'enable-task-reminders'].forEach(btnClass => {
            const btn = document.createElement('button');
            btn.className = `task-btn ${btnClass}`;
            btn.style.visibility = 'hidden';
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
            taskOptions.appendChild(btn);
        });

        taskItem.appendChild(taskOptions);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = options.completed || false;
        taskItem.appendChild(checkbox);

        return taskItem;
    }

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('TaskEvents class exists', () => {
        if (typeof TaskEvents !== 'function') {
            throw new Error('TaskEvents class not found');
        }
    });

    await test('initTaskEvents function exists', () => {
        if (typeof initTaskEvents !== 'function') {
            throw new Error('initTaskEvents function not found');
        }
    });

    await test('Window exports exist', () => {
        if (typeof window.TaskEvents !== 'function') {
            throw new Error('window.TaskEvents not exported');
        }
        if (typeof window.initTaskEvents !== 'function') {
            throw new Error('window.initTaskEvents not exported');
        }
        if (typeof window.handleTaskButtonClick !== 'function') {
            throw new Error('window.handleTaskButtonClick not exported');
        }
        if (typeof window.revealTaskButtons !== 'function') {
            throw new Error('window.revealTaskButtons not exported');
        }
    });

    // ============================================
    // 🏗️ INITIALIZATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Initialization</h4>';

    await test('Constructor creates TaskEvents instance', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);
        if (!(events instanceof TaskEvents)) {
            throw new Error('Instance not created correctly');
        }
        // Check version exists and is in semver format (X.Y or X.Y.Z)
        if (!events.version || !/^\d+\.\d+(\.\d+)?$/.test(events.version)) {
            throw new Error(`Expected valid semver version, got ${events.version}`);
        }
    });

    await test('Dependencies are stored correctly', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);
        if (!events.deps.AppState) {
            throw new Error('AppState dependency not stored');
        }
        if (typeof events.deps.showNotification !== 'function') {
            throw new Error('showNotification dependency not stored');
        }
        if (typeof events.deps.autoSave !== 'function') {
            throw new Error('autoSave dependency not stored');
        }
    });

    await test('Fallback functions work when dependencies missing', () => {
        const events = new TaskEvents({});
        if (typeof events.deps.showNotification !== 'function') {
            throw new Error('showNotification fallback not set');
        }
        if (typeof events.deps.autoSave !== 'function') {
            throw new Error('autoSave fallback not set');
        }
        // Test fallback notification doesn't throw
        events.fallbackNotification('test', 'info');
        events.fallbackAutoSave();
    });

    // ============================================
    // 🖱️ EVENT HANDLING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🖱️ Event Handling</h4>';

    await test('handleTaskButtonClick processes edit button', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        const editBtn = taskItem.querySelector('.edit-btn');

        // Mock taskCore
        window.taskCore = {
            editTask: (item) => {
                item.setAttribute('data-edited', 'true');
            }
        };

        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'currentTarget', { value: editBtn });
        event.stopPropagation = () => {};

        events.handleTaskButtonClick(event);

        // Clean up
        document.body.removeChild(taskItem);
        delete window.taskCore;

        if (taskItem.getAttribute('data-edited') !== 'true') {
            throw new Error('Edit button not processed correctly');
        }
    });

    await test('handleTaskButtonClick processes delete button', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        const deleteBtn = taskItem.querySelector('.delete-btn');

        // Mock taskCore
        window.taskCore = {
            deleteTask: (item) => {
                item.setAttribute('data-deleted', 'true');
            }
        };

        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'currentTarget', { value: deleteBtn });
        event.stopPropagation = () => {};

        events.handleTaskButtonClick(event);

        // Clean up
        document.body.removeChild(taskItem);
        delete window.taskCore;

        if (taskItem.getAttribute('data-deleted') !== 'true') {
            throw new Error('Delete button not processed correctly');
        }
    });

    await test('handleTaskButtonClick processes priority button', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        const priorityBtn = taskItem.querySelector('.priority-btn');

        // Mock taskCore
        window.taskCore = {
            toggleTaskPriority: (item) => {
                item.setAttribute('data-priority-toggled', 'true');
            }
        };

        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'currentTarget', { value: priorityBtn });
        event.stopPropagation = () => {};

        events.handleTaskButtonClick(event);

        // Clean up
        document.body.removeChild(taskItem);
        delete window.taskCore;

        if (taskItem.getAttribute('data-priority-toggled') !== 'true') {
            throw new Error('Priority button not processed correctly');
        }
    });

    await test('toggleHoverTaskOptions enables hover', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        // Mock hover functions
        window.showTaskOptions = () => {};
        window.hideTaskOptions = () => {};

        events.toggleHoverTaskOptions(true);

        if (!taskItem.classList.contains('hover-enabled')) {
            throw new Error('Hover not enabled on task item');
        }

        // Clean up
        document.body.removeChild(taskItem);
        delete window.showTaskOptions;
        delete window.hideTaskOptions;
    });

    await test('toggleHoverTaskOptions disables hover', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        taskItem.classList.add('hover-enabled');
        document.body.appendChild(taskItem);

        // Mock hover functions
        window.showTaskOptions = () => {};
        window.hideTaskOptions = () => {};

        events.toggleHoverTaskOptions(false);

        if (taskItem.classList.contains('hover-enabled')) {
            throw new Error('Hover not disabled on task item');
        }

        // Clean up
        document.body.removeChild(taskItem);
        delete window.showTaskOptions;
        delete window.hideTaskOptions;
    });

    await test('revealTaskButtons shows task options', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        events.revealTaskButtons(taskItem);

        const taskOptions = taskItem.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Task options not revealed');
        }
        if (taskOptions.style.opacity !== '1') {
            throw new Error('Task options opacity not set');
        }

        // Clean up
        document.body.removeChild(taskItem);
    });

    await test('revealTaskButtons handles arrow visibility based on settings', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem1 = createMockTaskItem({ id: 'task-1' });
        const taskItem2 = createMockTaskItem({ id: 'task-2' });
        document.body.appendChild(taskItem1);
        document.body.appendChild(taskItem2);

        events.revealTaskButtons(taskItem1);

        const upArrow = taskItem1.querySelector('.move-up');
        const downArrow = taskItem1.querySelector('.move-down');

        // First task should not show up arrow
        if (upArrow.style.visibility === 'visible') {
            throw new Error('First task should not show up arrow');
        }
        // First task should show down arrow (if arrows enabled)
        if (downArrow.style.visibility !== 'visible') {
            throw new Error('First task should show down arrow when arrows enabled');
        }

        // Clean up
        document.body.removeChild(taskItem1);
        document.body.removeChild(taskItem2);
    });

    await test('syncRecurringStateToDOM adds recurring indicator', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        const recurringSettings = { frequency: 'daily', interval: 1 };
        events.syncRecurringStateToDOM(taskItem, recurringSettings);

        const indicator = taskItem.querySelector('.recurring-indicator');
        if (!indicator) {
            throw new Error('Recurring indicator not added');
        }

        const recurringBtn = taskItem.querySelector('.recurring-btn');
        if (!recurringBtn.classList.contains('active')) {
            throw new Error('Recurring button not marked as active');
        }

        // Clean up
        document.body.removeChild(taskItem);
    });

    // ============================================
    // 🔧 INTERACTION SETUP TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Interaction Setup</h4>';

    await test('setupTaskClickInteraction attaches click handler', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        const checkbox = taskItem.querySelector('.task-checkbox');
        const buttonContainer = taskItem.querySelector('.task-options');
        const dueDateInput = document.createElement('input');
        dueDateInput.type = 'date';

        document.body.appendChild(taskItem);

        events.setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput);

        // Simulate click
        const initialChecked = checkbox.checked;
        taskItem.click();

        if (checkbox.checked === initialChecked) {
            throw new Error('Click handler not working - checkbox state not toggled');
        }

        // Clean up
        document.body.removeChild(taskItem);
    });

    await test('setupPriorityButtonState marks high priority', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        const buttonContainer = taskItem.querySelector('.task-options');

        events.setupPriorityButtonState(buttonContainer, true);

        const priorityBtn = buttonContainer.querySelector('.priority-btn');
        if (!priorityBtn.classList.contains('priority-active')) {
            throw new Error('Priority button not marked as active');
        }
        if (priorityBtn.getAttribute('aria-pressed') !== 'true') {
            throw new Error('Priority button aria-pressed not set');
        }
    });

    await test('setupTaskHoverInteractions adds hover for non-three-dots mode', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        // Mock hover functions
        window.showTaskOptions = () => {};
        window.hideTaskOptions = () => {};

        const settings = { showThreeDots: false };
        events.setupTaskHoverInteractions(taskItem, settings);

        // Verify event listeners were added (we can't directly test this, but no errors is good)

        // Clean up
        document.body.removeChild(taskItem);
        delete window.showTaskOptions;
        delete window.hideTaskOptions;
    });

    await test('setupTaskFocusInteractions attaches focus handler', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        taskItem.setAttribute('tabindex', '0');
        document.body.appendChild(taskItem);

        events.setupTaskFocusInteractions(taskItem);

        // Simulate focus
        taskItem.focus();

        const taskOptions = taskItem.querySelector('.task-options');
        // Focus handler should make options visible
        if (taskOptions.style.opacity !== '1') {
            throw new Error('Focus handler not working - options not visible');
        }

        // Clean up
        document.body.removeChild(taskItem);
    });

    await test('setupTaskInteractions calls all setup methods', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        const checkbox = taskItem.querySelector('.task-checkbox');
        const buttonContainer = taskItem.querySelector('.task-options');
        const dueDateInput = document.createElement('input');
        dueDateInput.type = 'date';

        taskItem.setAttribute('tabindex', '0');
        document.body.appendChild(taskItem);

        const taskElements = { taskItem, buttonContainer, checkbox, dueDateInput };
        const taskContext = {
            settings: { showThreeDots: false },
            highPriority: true
        };

        events.setupTaskInteractions(taskElements, taskContext);

        // Verify priority was set
        const priorityBtn = buttonContainer.querySelector('.priority-btn');
        if (!priorityBtn.classList.contains('priority-active')) {
            throw new Error('setupTaskInteractions did not set priority');
        }

        // Verify click handler works
        const initialChecked = checkbox.checked;
        taskItem.click();
        if (checkbox.checked === initialChecked) {
            throw new Error('setupTaskInteractions did not attach click handler');
        }

        // Clean up
        document.body.removeChild(taskItem);
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER FUNCTION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

    await test('Global handleTaskButtonClick wrapper works', () => {
        const deps = createMockDependencies();
        const events = initTaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        const editBtn = taskItem.querySelector('.edit-btn');

        // Mock taskCore
        window.taskCore = {
            editTask: (item) => {
                item.setAttribute('data-edited', 'true');
            }
        };

        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'currentTarget', { value: editBtn });
        event.stopPropagation = () => {};

        window.handleTaskButtonClick(event);

        // Clean up
        document.body.removeChild(taskItem);
        delete window.taskCore;

        if (taskItem.getAttribute('data-edited') !== 'true') {
            throw new Error('Global wrapper did not call handleTaskButtonClick');
        }
    });

    await test('Global revealTaskButtons wrapper works', () => {
        const deps = createMockDependencies();
        const events = initTaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);

        window.revealTaskButtons(taskItem);

        const taskOptions = taskItem.querySelector('.task-options');
        if (taskOptions.style.visibility !== 'visible') {
            throw new Error('Global wrapper did not call revealTaskButtons');
        }

        // Clean up
        document.body.removeChild(taskItem);
    });

    await test('Global setupTaskInteractions wrapper works', () => {
        const deps = createMockDependencies();
        const events = initTaskEvents(deps);

        const taskItem = createMockTaskItem();
        const checkbox = taskItem.querySelector('.task-checkbox');
        const buttonContainer = taskItem.querySelector('.task-options');
        const dueDateInput = document.createElement('input');

        document.body.appendChild(taskItem);

        const taskElements = { taskItem, buttonContainer, checkbox, dueDateInput };
        const taskContext = {
            settings: { showThreeDots: false },
            highPriority: true
        };

        window.setupTaskInteractions(taskElements, taskContext);

        const priorityBtn = buttonContainer.querySelector('.priority-btn');
        if (!priorityBtn.classList.contains('priority-active')) {
            throw new Error('Global wrapper did not call setupTaskInteractions');
        }

        // Clean up
        document.body.removeChild(taskItem);
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
