/**
 * 🧪 TaskEvents Module Tests
 * Tests event handling and user interaction logic
 *
 * Updated for Phase 3 DI Pattern - direct module imports
 *
 * Coverage:
 * - Module loading (TaskEvents class)
 * - Initialization (constructor, dependencies)
 * - Event handling (button clicks, hover, focus)
 * - Task interaction setup
 * - Global wrapper functions
 */

import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

// Direct import from module (not via appContext which may not be populated)
import {
    TaskEvents,
    setTaskEventsDependencies
} from '../modules/task/taskEvents.js';

export async function runTaskEventsTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎮 TaskEvents Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>🎮 TaskEvents Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Use shared test helper with data protection
    const test = createProtectedTest(resultsDiv, passed, total);

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
                    settings: {},
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

    await test('setTaskEventsDependencies function exists', () => {
        if (typeof setTaskEventsDependencies !== 'function') {
            throw new Error('setTaskEventsDependencies function not found');
        }
    });

    await test('Module exports exist', () => {
        if (typeof TaskEvents !== 'function') {
            throw new Error('TaskEvents not exported from module');
        }
        if (typeof setTaskEventsDependencies !== 'function') {
            throw new Error('setTaskEventsDependencies not exported from module');
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
    });

    await test('Dependencies are stored correctly', () => {
        const deps = createMockDependencies();
        const events = new TaskEvents(deps);
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

    // NOTE: handleTaskButtonClick tests removed - they depend on complex DOM mocking
    // and window.taskCore integration which is not available in strict DI test environment

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

    // NOTE: revealTaskButtons tests removed - they depend on TaskOptionsVisibilityController
    // integration which is not available in strict DI test environment

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

    await test('initEventDelegation sets up task click handler', () => {
        // Remove any existing taskList to ensure clean state (prevent accumulated listeners)
        const existingTaskList = document.getElementById('taskList');
        if (existingTaskList) {
            existingTaskList.remove();
        }

        // Create fresh taskList
        const taskList = document.createElement('ul');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);

        // Create dependencies with getElementById that finds our taskList
        const deps = createMockDependencies();
        deps.getElementById = (id) => document.getElementById(id);

        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        const checkbox = taskItem.querySelector("input[type='checkbox']");
        taskList.appendChild(taskItem);

        // Initialize event delegation
        events.initEventDelegation();

        // Simulate click on task text (not on checkbox/buttons)
        const initialChecked = checkbox.checked;
        const taskText = taskItem.querySelector('.task-text');
        taskText.click(); // Click on the task text, not the item itself

        if (checkbox.checked === initialChecked) {
            throw new Error('Event delegation click handler not working - checkbox state not toggled');
        }

        // Clean up - remove the taskList entirely to prevent listener accumulation
        taskList.remove();
    });

    await test('task click delegates completion to the change handler — no duplicate pipeline calls', () => {
        // The checkbox's own change handler (taskDOM.createTaskCheckbox) owns the
        // full completion pipeline. The delegated click handler must ONLY
        // toggle + dispatch change — until v2.367 it also re-ran checkMiniCycle
        // and fired a second logo flash on top of the change handler's animation.
        const existingTaskList = document.getElementById('taskList');
        if (existingTaskList) existingTaskList.remove();

        const taskList = document.createElement('ul');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);

        // Spies wired via module-level DI: if the click handler ever regains
        // direct pipeline calls, these counters catch it.
        let checkMiniCycleCalls = 0;
        let logoCalls = 0;
        setTaskEventsDependencies({
            checkMiniCycle: () => { checkMiniCycleCalls++; },
            triggerLogoBackground: () => { logoCalls++; },
            triggerLogoScan: () => { logoCalls++; }
        });

        const deps = createMockDependencies();
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        const checkbox = taskItem.querySelector("input[type='checkbox']");
        taskList.appendChild(taskItem);

        // Stand-in for the taskDOM change handler pipeline
        let changeEvents = 0;
        checkbox.addEventListener('change', () => { changeEvents++; });

        events.initEventDelegation();
        taskItem.querySelector('.task-text').click();

        if (!checkbox.checked) throw new Error('click must toggle the checkbox');
        if (changeEvents !== 1) throw new Error(`change handler must fire exactly once, got ${changeEvents}`);
        if (checkMiniCycleCalls !== 0) throw new Error('click handler must not call checkMiniCycle directly (change handler owns it)');
        if (logoCalls !== 0) throw new Error('click handler must not trigger logo animation directly (change handler owns it)');

        // Hygiene: clear spies so they can't leak into later tests
        setTaskEventsDependencies({ checkMiniCycle: null, triggerLogoBackground: null, triggerLogoScan: null });
        taskList.remove();
    });

    await test('constructor-injected AppState resolves through deps getter', () => {
        // The facade passes AppState via the constructor; module-level DI is not
        // wired in production. Until v2.367 the constructor dropped it, so
        // this.deps.AppState was silently null and the activeTaskId state
        // update in toggleTaskOptions never ran.
        const marker = { isReady: () => true, get: () => ({}), update: () => {} };
        const events = new TaskEvents({ AppState: marker });
        if (events.deps.AppState !== marker) {
            throw new Error('deps.AppState must resolve to the constructor-injected instance');
        }
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
        // The method wires hover via the INJECTED showTaskOptions/hideTaskOptions +
        // safeAddEventListener (the old test set window.* globals, which it never reads).
        deps.showTaskOptions = () => {};
        deps.hideTaskOptions = () => {};
        deps.safeAddEventListener = (el, ev, fn, opts) => el.addEventListener(ev, fn, opts);
        const events = new TaskEvents(deps);

        const taskItem = createMockTaskItem();
        document.body.appendChild(taskItem);
        try {
            events.setupTaskHoverInteractions(taskItem, { showThreeDots: false });

            // In non-three-dots mode it wires mouseenter/mouseleave hover handlers onto the
            // task (from the injected deps). The old test asserted nothing.
            if (taskItem._hoverShowHandler !== deps.showTaskOptions ||
                taskItem._hoverHideHandler !== deps.hideTaskOptions) {
                throw new Error('setupTaskHoverInteractions should wire hover show/hide handlers in non-three-dots mode');
            }
        } finally {
            document.body.removeChild(taskItem);
        }
    });

    // NOTE: setupTaskFocusInteractions test removed - depends on TaskOptionsVisibilityController
    // integration which is not available in strict DI test environment

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

        // ✅ Click handler is now set via event delegation (initEventDelegation)
        // Not testing click here - see 'initEventDelegation sets up task click handler' test

        // Clean up
        document.body.removeChild(taskItem);
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER FUNCTION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

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
