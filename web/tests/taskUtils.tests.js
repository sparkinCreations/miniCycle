/**
 * 🧪 TaskUtils Tests
 * Tests for task utility functions (context building, DOM extraction, etc.)
 */

// Direct import from module (not via appContext which may not be populated)
import {
    TaskUtils,
    setTaskUtilsDependencies,
    getTaskText
} from '../modules/task/taskUtils.js';

import {
    setupTestEnvironment,
    createMockAppState
} from './testHelpers.js';

import { COLORS } from '../modules/core/constants.js';

export async function runTaskUtilsTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🛠️ TaskUtils Tests</h2><h3>Running tests...</h3>';

    // Setup test environment and dependencies
    await setupTestEnvironment();
    setTaskUtilsDependencies({});

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

    await test('TaskUtils class is imported from module', () => {
        if (typeof TaskUtils !== 'function') {
            throw new Error('TaskUtils not available from module import');
        }
    });

    await test('getTaskText prefers text, tolerates legacy taskText, and never returns a non-string', () => {
        // The one read-side fallback for a task seen before routineLoader's repair
        // renames taskText → text (STATE_TRUTH_MIGRATION #5).
        if (getTaskText({ text: 'Water plants' }) !== 'Water plants') throw new Error('text');
        if (getTaskText({ text: 'New', taskText: 'Old' }) !== 'New') throw new Error('text must win over taskText');
        if (getTaskText({ taskText: 'Legacy' }) !== 'Legacy') throw new Error('legacy taskText');
        if (getTaskText({ text: '' , taskText: 'Legacy' }) !== '') throw new Error('an empty string is still text, not missing');
        for (const bad of [{}, { text: null }, { text: 42 }, null, undefined]) {
            if (getTaskText(bad) !== '') throw new Error(`expected '' for ${JSON.stringify(bad)}`);
        }
    });

    await test('all utility functions are exported from module', () => {
        const requiredMethods = [
            'buildTaskContext',
            'loadTaskContext',
            'scrollToNewTask',
            'handleOverdueStyling',
            'setupFinalTaskInteractions'
        ];

        for (const method of requiredMethods) {
            if (typeof TaskUtils[method] !== 'function') {
                throw new Error(`${method} not found as static method on TaskUtils`);
            }
        }
    });

    await test('all static methods exist on TaskUtils', () => {
        const staticMethods = [
            'buildTaskContext',
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
                data: { routine: {} },
                appState: { activeRoutineId: null }
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
                data: { routine: {
                        'cycle-1': { tasks: [], autoReset: false, deleteCheckedTasks: false }
                    }
                },
                appState: { activeRoutineId: 'cycle-1' },
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
                data: { routine: {
                        'cycle-1': { tasks: [], autoReset: true, deleteCheckedTasks: false }
                    }
                },
                appState: { activeRoutineId: 'cycle-1' },
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
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Recurring template</h4>';

    const recurringCtx = (id) => ({
        cycleTasks: [],
        assignedTaskId: id,
        taskTextTrimmed: 'a recurring task',
        completed: false,
        dueDate: null,
        priority: null,
        remindersEnabled: false,
        recurring: true,
        recurringSettings: { frequency: 'daily', indefinitely: true },
        currentCycle: { deleteCheckedTasks: false },
        cycles: {},
        activeCycle: 'cycle-1',
        isLoading: true,
        
        autoClear: null
    });

    await test('a template created here carries a nextScheduledOccurrence', () => {
        // recurringWatcher gates on `template.nextScheduledOccurrence == null`,
        // which matches UNDEFINED as well as null — so a template built without
        // the field never fires. This path is reached by the Cleared Tasks
        // "restore" flow (historyManager passes recurring + recurringSettings
        // into addTask), so a restored recurring task comes back with its
        // recurrence permanently dead.
        //
        // Driven through the legacy commit branch (no AppState, saveTaskToSchema25
        // present) so the template lands on the context's own cycle object and can
        // be inspected directly.
        const WHEN = 1786000000000;
        setTaskUtilsDependencies({ calculateNextOccurrence: () => WHEN });

        const ctx = recurringCtx('t-rec');
        ctx.isLoading = false;
        ctx.currentCycle = { deleteCheckedTasks: false, tasks: [], recurringTemplates: {} };
        TaskUtils.createOrUpdateTaskData(ctx, () => {}, () => {});

        const template = ctx.currentCycle.recurringTemplates['t-rec'];
        if (!template) throw new Error('no template was created at all');
        if (!('nextScheduledOccurrence' in template)) {
            throw new Error('template omits nextScheduledOccurrence — recurringWatcher will never fire it');
        }
        if (template.nextScheduledOccurrence !== WHEN) {
            throw new Error(`expected the calculator's value, got ${template.nextScheduledOccurrence}`);
        }
        // occurrenceCount was missing here too; the watcher reads it for exhaustion.
        if (template.occurrenceCount !== 0) {
            throw new Error(`expected occurrenceCount 0, got ${template.occurrenceCount}`);
        }
    });

    await test('a null nextScheduledOccurrence is as dead as an absent one', () => {
        // Guards against "fixing" this by writing null when the calculator is
        // missing. recurringWatcher gates on `== null`, which matches BOTH — so a
        // null is not a safer default, it is the same bug wearing a field name.
        setTaskUtilsDependencies({ calculateNextOccurrence: null });

        const ctx = recurringCtx('t-nocalc');
        ctx.isLoading = false;
        ctx.currentCycle = { deleteCheckedTasks: false, tasks: [], recurringTemplates: {} };
        TaskUtils.createOrUpdateTaskData(ctx, () => {}, () => {});

        const template = ctx.currentCycle.recurringTemplates['t-nocalc'];
        if (template && template.nextScheduledOccurrence == null) {
            // Documented, not asserted away: without the dep the template is inert.
            // The DI wiring (taskDOM manifest + forward) is what makes it work, and
            // validate:di plus the runtime access audit are what keep it wired.
            return;
        }
        throw new Error('expected an inert template when no calculator is injected');
    });

    const priorityCtx = (id, priority) => ({
        cycleTasks: [],
        assignedTaskId: id,
        taskTextTrimmed: 'a task',
        completed: false,
        dueDate: null,
        priority,
        remindersEnabled: false,
        recurring: false,
        recurringSettings: {},
        currentCycle: { deleteCheckedTasks: false },
        cycles: {},
        activeCycle: 'cycle-1',
        isLoading: true,
        
        autoClear: null
    });

    await test('created task persists priority as a level or null, never undefined', () => {
        // Until Aug 2026 addTaskImpl wrote `null` for a boolean field verbatim, so
        // every UI-created task was schema-invalid until routineLoader repaired it
        // on the next boot. The stored shape must be explicit from the first write.
        for (const given of [null, undefined, 'urgent']) {
            const task = TaskUtils.createOrUpdateTaskData(priorityCtx(`t-${given}`, given), () => {}, null);
            if (task.priority !== null) throw new Error(`${JSON.stringify(given)} should store null, got ${JSON.stringify(task.priority)}`);
        }
        const medium = TaskUtils.createOrUpdateTaskData(priorityCtx('t-medium', 'medium'), () => {}, null);
        if (medium.priority !== 'medium') throw new Error(`level not stored: ${JSON.stringify(medium.priority)}`);
    });

    await test('no colour and no 2.5 flag are stored beside the level', () => {
        const task = TaskUtils.createOrUpdateTaskData(priorityCtx('t-high', 'high'), () => {}, null);
        for (const old of ['highPriority', 'priorityColor', 'deleteWhenComplete', 'deleteWhenCompleteSettings']) {
            if (old in task) throw new Error(`a retired 2.5 field was written: ${old}`);
        }
        if (!task.autoClear || typeof task.autoClear.cycle !== 'boolean') throw new Error('autoClear map missing');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">📝 Load Task Context</h4>';

    // loadTaskContext reads the active routine from AppState (the wrapper it
    // used to take read AROUND the state manager — STATE_TRUTH_MIGRATION #25).
    const appStateWith = (routines, activeRoutineId) => ({
        isReady: () => true,
        get: () => ({ data: { routine: routines }, appState: { activeRoutineId }, settings: {}, customReminders: {} })
    });

    await test('loadTaskContext throws when state is not ready', () => {
        const notReady = { isReady: () => false, get: () => null };
        const mockGenId = () => 'generated-id';

        let errorThrown = false;
        try {
            TaskUtils.loadTaskContext('Test', null, {}, false, notReady, mockGenId);
        } catch (error) {
            errorThrown = true;
        }

        if (!errorThrown) {
            throw new Error('Should throw when schema data not available');
        }
    });

    await test('loadTaskContext throws when no active cycle', () => {
        const mockGenId = () => 'generated-id';

        let errorThrown = false;
        try {
            TaskUtils.loadTaskContext('Test', null, {}, false, appStateWith({}, null), mockGenId);
        } catch (error) {
            errorThrown = true;
        }

        if (!errorThrown) {
            throw new Error('Should throw when no active cycle');
        }
    });

    await test('loadTaskContext generates ID when not provided', () => {
        const mockGenId = () => 'generated-id';

        const context = TaskUtils.loadTaskContext('Test', null, {}, false, appStateWith({ 'cycle-1': { tasks: [] } }, 'cycle-1'), mockGenId);

        if (context.assignedTaskId !== 'generated-id') {
            throw new Error('Should use generated ID');
        }
    });

    await test('loadTaskContext uses provided ID', () => {
        const mockGenId = () => 'generated-id';

        const context = TaskUtils.loadTaskContext('Test', 'custom-id', {}, false, appStateWith({ 'cycle-1': { tasks: [] } }, 'cycle-1'), mockGenId);

        if (context.assignedTaskId !== 'custom-id') {
            throw new Error('Should use provided ID');
        }
    });

    await test('loadTaskContext includes isLoading flag', () => {
        const AppState = appStateWith({ 'cycle-1': { tasks: [] } }, 'cycle-1');
        const mockGenId = () => 'id';

        const contextLoading = TaskUtils.loadTaskContext('Test', 'id', {}, true, AppState, mockGenId);
        const contextNotLoading = TaskUtils.loadTaskContext('Test', 'id', {}, false, AppState, mockGenId);

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
