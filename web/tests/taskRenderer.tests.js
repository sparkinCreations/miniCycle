/**
 * 🧪 TaskRenderer Tests
 * Tests for task rendering and UI refresh operations
 */

// Direct import from module (not via appContext which may not be populated)
import {
    TaskRenderer,
    setTaskRendererDependencies
} from '../modules/task/taskRenderer.js';

import {
    setupTestEnvironment
} from './testHelpers.js';

import { DOM_CLASSES } from '../modules/core/constants.js';

// ============================================
// 🧪 MOCK DEPENDENCIES FOR TASKRENDERER
// (Phase 3 - all deps are now required)
// ============================================
function createMockDependencies(overrides = {}) {
    return {
        AppState: { isReady: () => true, get: () => ({}) },
        addTask: async () => {},
        loadMiniCycle: () => {},
        updateProgressBar: () => {},
        checkCompleteAllButton: () => {},
        updateStatsPanel: () => {},
        updateMainMenuHeader: () => {},
        updateArrowsInDOM: () => {},
        checkOverdueTasks: () => {},
        enableDragAndDropOnTask: () => {},
        recurringPanel: { updateRecurringPanel: () => {}, updateRecurringPanelButtonVisibility: () => {} },
        updateRecurringPanelButtonVisibility: () => {},
        getElementById: (id) => document.getElementById(id),
        querySelectorAll: (sel) => document.querySelectorAll(sel),
        ...overrides
    };
}

export async function runTaskRendererTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎨 TaskRenderer Tests</h2><h3>Running tests...</h3>';

    // Setup test environment
    await setupTestEnvironment();
    setTaskRendererDependencies({
        loadMiniCycle: () => {},
        updateProgressBar: () => {},
        checkCompleteAllButton: () => {}
    });

    let passed = { count: 0 };
    let total = { count: 0 };

    // Test helper with data protection
    async function test(name, testFn) {
        total.count++;
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion', 'miniCycleMoveArrows'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) savedRealData[key] = value;
        });

        try {
            const result = testFn();
            if (result instanceof Promise) await result;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
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

    await test('TaskRenderer class is defined', () => {
        if (typeof TaskRenderer === 'undefined') {
            throw new Error('TaskRenderer class not found');
        }
    });

    await test('TaskRenderer class is exported from module', () => {
        if (typeof TaskRenderer !== 'function') {
            throw new Error('TaskRenderer class not exported from module');
        }
    });

    await test('setTaskRendererDependencies function is exported', () => {
        if (typeof setTaskRendererDependencies !== 'function') {
            throw new Error('setTaskRendererDependencies not exported from module');
        }
    });

    await test('all rendering functions are exported', () => {
        const requiredFunctions = ['renderTasks', 'refreshUIFromState', 'refreshTaskListUI'];
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

    await test('creates instance with required dependencies', () => {
        const renderer = new TaskRenderer(createMockDependencies());
        if (!renderer) throw new Error('Failed to create TaskRenderer instance');
        if (!renderer.deps) throw new Error('Dependencies not initialized');
    });

    await test('creates instance with custom dependencies', () => {
        const mockAppState = { isReady: () => true, get: () => ({}) };
        const renderer = new TaskRenderer(createMockDependencies({ AppState: mockAppState }));
        if (renderer.deps.AppState !== mockAppState) {
            throw new Error('Custom AppState dependency not set');
        }
    });


    await test('warns when missing dependencies', () => {
        // Capture console.warn
        const originalWarn = console.warn;
        let warnCalled = false;
        console.warn = (...args) => {
            if (args[0]?.includes?.('missing dependencies')) {
                warnCalled = true;
            }
        };

        try {
            new TaskRenderer({});  // Missing deps should warn, not throw
            if (!warnCalled) {
                throw new Error('Should have warned about missing dependencies');
            }
        } finally {
            console.warn = originalWarn;
        }
    });

    // ============================================
    // 🎨 RENDERING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Rendering</h4>';

    await test('renderTasks requires taskList element', async () => {
        const renderer = new TaskRenderer(createMockDependencies({
            getElementById: () => null
        }));
        // Should not throw, just return early
        await renderer.renderTasks([]);
    });

    await test('renderTasks handles empty array', async () => {
        const taskList = document.createElement('ul');
        const renderer = new TaskRenderer(createMockDependencies({
            getElementById: (id) => id === 'taskList' ? taskList : null
        }));
        await renderer.renderTasks([]);
        if (taskList.innerHTML !== '') {
            throw new Error('Should clear taskList for empty array');
        }
    });

    await test('renderTasks validates array input', async () => {
        const renderer = new TaskRenderer(createMockDependencies({
            getElementById: () => document.createElement('ul')
        }));
        // Should not throw for non-array
        await renderer.renderTasks(null);
        await renderer.renderTasks(undefined);
        await renderer.renderTasks('not an array');
    });

    // ============================================
    // 🔄 REFRESH UI TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Refresh UI</h4>';

    await test('refreshUIFromState handles null state', async () => {
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: { isReady: () => false }
        }));
        // Should not throw
        await renderer.refreshUIFromState(null);
    });

    await test('refreshUIFromState uses AppState when ready', async () => {
        let appStateCalled = false;
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: {
                isReady: () => true,
                get: () => {
                    appStateCalled = true;
                    return {
                        data: { cycles: { 'cycle-1': { tasks: [] } } },
                        appState: { activeCycleId: 'cycle-1' },
                        ui: {}
                    };
                }
            },
            getElementById: () => document.createElement('ul')
        }));
        await renderer.refreshUIFromState();
        if (!appStateCalled) throw new Error('Should call AppState.get() when ready');
    });

    await test('refreshTaskListUI delegates to refreshUIFromState', async () => {
        let refreshCalled = false;
        const renderer = new TaskRenderer(createMockDependencies());
        renderer.refreshUIFromState = async () => { refreshCalled = true; };
        await renderer.refreshTaskListUI();
        if (!refreshCalled) throw new Error('Should call refreshUIFromState');
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

    await test('global renderTasks handles uninitialized renderer', async () => {
        // Should not throw even if renderer is null
        await window.renderTasks([]);
    });

    await test('global refreshUIFromState handles uninitialized renderer', async () => {
        // Should not throw
        await window.refreshUIFromState(null);
    });

    await test('global refreshTaskListUI handles uninitialized renderer', async () => {
        // Should not throw
        await window.refreshTaskListUI();
    });

    // ============================================
    // 🪺 Render-path unification (completed dropdown projected from state)
    // ============================================

    // When the dropdown is enabled, renderTasks must partition the freshly-built nodes by
    // STATE (task.completed) into the active list vs the completed list in one atomic swap —
    // not render everything into the active list and re-sort afterward. This is the
    // structural fix for the duplicate-in-completed seam.
    await test('renderTasks projects completed tasks into the dropdown from state', async () => {
        const taskList = document.createElement('ul');
        const completedList = document.createElement('ul');
        document.body.append(taskList, completedList);

        const prepped = [];
        let countUpdated = false;
        const ctm = {
            isEnabled: () => true,
            prepareCompletedNode: (node) => { node.setAttribute('draggable', 'false'); prepped.push(node.dataset.taskId); },
            updateCount: () => { countUpdated = true; }
        };

        const renderer = new TaskRenderer(createMockDependencies({
            getElementById: (id) => id === 'taskList' ? taskList : (id === 'completedTaskList' ? completedList : null),
            taskToAddTaskOptions: (task) => ({ __id: task.id }),
            addTask: async (text, options) => {
                const li = document.createElement('li');
                li.className = 'task';
                li.dataset.taskId = options.__id;
                li.setAttribute('draggable', 'true');
                (options.targetContainer || document.body).appendChild(li);
            }
        }));
        // completedTasksManager is late-injected in the real app (not a constructor dep)
        renderer.injectDependency('completedTasksManager', ctm);

        try {
            await renderer.renderTasks([
                { id: 'A', text: 'A', completed: true },
                { id: 'B', text: 'B', completed: false },
                { id: 'C', text: 'C', completed: true }
            ]);

            const activeIds = [...taskList.querySelectorAll('.task')].map(n => n.dataset.taskId);
            const completedIds = [...completedList.querySelectorAll('.task')].map(n => n.dataset.taskId).sort();

            if (activeIds.join(',') !== 'B') {
                throw new Error(`Active list should hold only the incomplete task [B], got [${activeIds}]`);
            }
            if (completedIds.join(',') !== 'A,C') {
                throw new Error(`Completed dropdown should hold [A,C], got [${completedIds}]`);
            }
            if (prepped.sort().join(',') !== 'A,C') {
                throw new Error(`prepareCompletedNode should run on A,C, got [${prepped}]`);
            }
            if (completedList.querySelector('[data-task-id="A"]').getAttribute('draggable') !== 'false') {
                throw new Error('Completed node should be non-draggable');
            }
            if (!countUpdated) throw new Error('updateCount should be called after the swap');
        } finally {
            taskList.remove();
            completedList.remove();
        }
    });

    // Re-rendering the SAME state must never duplicate: each full render rebuilds both lists
    // atomically, so a completed task can't accumulate copies in the dropdown.
    await test('repeated renderTasks does not duplicate completed nodes (dup regression)', async () => {
        const taskList = document.createElement('ul');
        const completedList = document.createElement('ul');
        document.body.append(taskList, completedList);

        const ctm = {
            isEnabled: () => true,
            prepareCompletedNode: (node) => node.setAttribute('draggable', 'false'),
            updateCount: () => {}
        };
        const renderer = new TaskRenderer(createMockDependencies({
            getElementById: (id) => id === 'taskList' ? taskList : (id === 'completedTaskList' ? completedList : null),
            taskToAddTaskOptions: (task) => ({ __id: task.id }),
            addTask: async (text, options) => {
                const li = document.createElement('li');
                li.className = 'task';
                li.dataset.taskId = options.__id;
                (options.targetContainer || document.body).appendChild(li);
            }
        }));
        renderer.injectDependency('completedTasksManager', ctm);

        const state = [
            { id: 'A', text: 'A', completed: true },
            { id: 'B', text: 'B', completed: false }
        ];
        try {
            await renderer.renderTasks(state);
            await renderer.renderTasks(state); // full re-render of the same state
            await renderer.renderTasks(state);

            if (completedList.querySelectorAll('[data-task-id="A"]').length !== 1) {
                throw new Error('Completed task A duplicated across re-renders');
            }
            if (taskList.querySelectorAll('.task').length !== 1) {
                throw new Error(`Active list should hold exactly 1 task, got ${taskList.querySelectorAll('.task').length}`);
            }
        } finally {
            taskList.remove();
            completedList.remove();
        }
    });

    // ============================================
    // 🚩 TASK OPTION RESTORE FLAG TESTS
    // Validates that _restoreActiveTaskOptions() only runs when
    // ui.shouldRestoreActiveTaskOptions is explicitly set to true.
    // This prevents background renders (e.g. recurring task watcher)
    // from re-opening task option buttons automatically.
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🚩 Task Option Restore Flag</h4>';

    await test('_restoreActiveTaskOptions does nothing when flag is false', () => {
        let stateUpdateCalled = false;
        const mockState = {
            ui: { activeTaskId: 'task-1', shouldRestoreActiveTaskOptions: false }
        };
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (fn) => { stateUpdateCalled = true; fn(mockState); }
            }
        }));

        // Create a fake task element in the DOM
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        taskEl.dataset.taskId = 'task-1';
        const taskOptions = document.createElement('div');
        taskOptions.className = 'task-options';
        taskEl.appendChild(taskOptions);
        document.body.appendChild(taskEl);

        try {
            renderer._restoreActiveTaskOptions();
            if (taskOptions.classList.contains(DOM_CLASSES.TASK_OPTIONS_VISIBLE)) {
                throw new Error('Options should NOT be shown when shouldRestoreActiveTaskOptions is false');
            }
            if (stateUpdateCalled) {
                throw new Error('AppState.update should not be called when flag is false');
            }
        } finally {
            taskEl.remove();
        }
    });

    await test('_restoreActiveTaskOptions does nothing when flag is undefined', () => {
        const mockState = { ui: { activeTaskId: 'task-2' } };
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: () => {}
            }
        }));

        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        taskEl.dataset.taskId = 'task-2';
        const taskOptions = document.createElement('div');
        taskOptions.className = 'task-options';
        taskEl.appendChild(taskOptions);
        document.body.appendChild(taskEl);

        try {
            renderer._restoreActiveTaskOptions();
            if (taskOptions.classList.contains(DOM_CLASSES.TASK_OPTIONS_VISIBLE)) {
                throw new Error('Options should NOT be shown when shouldRestoreActiveTaskOptions is undefined');
            }
        } finally {
            taskEl.remove();
        }
    });

    await test('_restoreActiveTaskOptions shows options when flag is true', () => {
        const mockState = {
            ui: { activeTaskId: 'task-3', shouldRestoreActiveTaskOptions: true }
        };
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (fn) => { fn(mockState); }
            }
        }));

        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        taskEl.dataset.taskId = 'task-3';
        const taskOptions = document.createElement('div');
        taskOptions.className = 'task-options';
        taskEl.appendChild(taskOptions);
        document.body.appendChild(taskEl);

        try {
            renderer._restoreActiveTaskOptions();
            if (!taskOptions.classList.contains(DOM_CLASSES.TASK_OPTIONS_VISIBLE)) {
                throw new Error('Options should be shown when shouldRestoreActiveTaskOptions is true');
            }
        } finally {
            taskEl.remove();
        }
    });

    await test('_restoreActiveTaskOptions clears the flag after restoring', () => {
        const mockState = {
            ui: { activeTaskId: 'task-4', shouldRestoreActiveTaskOptions: true }
        };
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (fn) => { fn(mockState); }
            }
        }));

        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        taskEl.dataset.taskId = 'task-4';
        const taskOptions = document.createElement('div');
        taskOptions.className = 'task-options';
        taskEl.appendChild(taskOptions);
        document.body.appendChild(taskEl);

        try {
            renderer._restoreActiveTaskOptions();
            if (mockState.ui.shouldRestoreActiveTaskOptions !== false) {
                throw new Error('Flag should be cleared to false after restoring options');
            }
        } finally {
            taskEl.remove();
        }
    });

    await test('_restoreActiveTaskOptions clears flag even when activeTaskId is missing', () => {
        const mockState = {
            ui: { activeTaskId: null, shouldRestoreActiveTaskOptions: true }
        };
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (fn) => { fn(mockState); }
            }
        }));

        renderer._restoreActiveTaskOptions();
        if (mockState.ui.shouldRestoreActiveTaskOptions !== false) {
            throw new Error('Flag should be cleared even when there is no activeTaskId');
        }
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
