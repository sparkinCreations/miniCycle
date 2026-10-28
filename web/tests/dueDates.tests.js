/**
 * DueDates Module Tests
 * Comprehensive tests for the miniCycle Due Dates module (Schema 2.5)
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 * @version 1.330
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    waitForAsyncOperations
} from './testHelpers.js';

import {
    MiniCycleDueDates,
    setDueDatesDependencies,
    computeDueDateNotificationSlots
} from '../modules/features/dueDates.js';

// The module compares against LOCAL midnight (parseDateAsLocal), so tests must
// build date strings the same way. See the yesterday computation below.
import { formatLocalDate } from '../modules/recurring/recurringDateUtils.js';
import {
    createDueDateChip,
    formatDueLabel,
    isTaskOverdue,
    normalizeDueTime,
    getDueMoment
} from '../modules/utils/dueDateUtils.js';

export async function runDueDatesTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>Due Dates Module Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Set up DueDates module dependencies
    setDueDatesDependencies({
        safeAddEventListener: env.deps.safeAddEventListener
    });

    // Make MiniCycleDueDates available for tests (fallback compatibility)
    window.MiniCycleDueDates = MiniCycleDueDates;

    resultsDiv.innerHTML = '<h2>Due Dates Module Tests</h2>';
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
        console.log('🔒 Saved original localStorage for individual dueDates test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual dueDates test completed - original localStorage restored');
        }
    }


    try {

        // Import the module class
        const MiniCycleDueDates = window.MiniCycleDueDates;

        // Check if class is available
        if (!MiniCycleDueDates) {
            resultsDiv.innerHTML += '<div class="result fail">❌ MiniCycleDueDates class not found. Make sure the module is properly loaded.</div>';
            resultsDiv.innerHTML += '<h3>Results: 0/1 tests passed (0%)</h3>';
            return { passed: 0, total: 1 };
        }

        // Create test container for DOM elements (persists across tests)
        let testContainer = document.getElementById('duedates-test-container');
        if (!testContainer) {
            testContainer = document.createElement('div');
            testContainer.id = 'duedates-test-container';
            testContainer.style.cssText = 'display: none; position: absolute; left: -9999px;';
            document.body.appendChild(testContainer);
        }

        // Helper to create mock AppState that actually updates localStorage
        function createMockAppStateForDueDates() {
            return {
                isReady: () => true,
                get: () => JSON.parse(localStorage.getItem('miniCycleData')),
                update: async (updateFn, shouldSave = false) => {
                    const currentData = JSON.parse(localStorage.getItem('miniCycleData'));
                    updateFn(currentData);
                    // Update metadata timestamp
                    currentData.metadata.lastModified = Date.now();
                    if (shouldSave) {
                        localStorage.setItem('miniCycleData', JSON.stringify(currentData));
                    }
                }
            };
        }

        /** Add a task to the stored test routine (checkOverdueTasks reads state, not the row). */
        function putTask(task) {
            const data = JSON.parse(localStorage.getItem('miniCycleData'));
            data.data.routine['test-cycle'].tasks.push(task);
            localStorage.setItem('miniCycleData', JSON.stringify(data));
        }

        /** A rendered task row with its due-date line, mounted in the test container. */
        function makeRow(taskId, text) {
            const row = document.createElement('div');
            row.classList.add('task');
            row.dataset.taskId = taskId;
            const label = document.createElement('span');
            label.classList.add('task-text');
            label.textContent = text;
            const chip = createDueDateChip(taskId);
            row.appendChild(label);
            row.appendChild(chip);
            testContainer.appendChild(row);
            return { row, chip };
        }

        /** "YYYY-MM-DD" for today + offset days, from LOCAL parts (never toISOString). */
        function localDay(offset = 0) {
            const d = new Date();
            d.setDate(d.getDate() + offset);
            return formatLocalDate(d);
        }

        async function test(name, testFn) {
            total.count++;
            try {
                // Reset environment before each test
                localStorage.clear();

                // Mock Schema 2.5 data
                const mockSchemaData = {
                    metadata: {
                        version: "2.5",
                        lastModified: Date.now()
                    },
                    data: { routine: {
                            'test-cycle': {
                                name: 'Test Cycle',
                                tasks: [
                                    {
                                        id: 'task-1',
                                        text: 'Test Task 1',
                                        completed: false,
                                        dueDate: null
                                    },
                                    {
                                        id: 'task-2',
                                        text: 'Test Task 2',
                                        completed: false,
                                        dueDate: '2025-12-31'
                                    }
                                ],
                                autoReset: false
                            }
                        },
                        activeCycle: 'test-cycle'
                    },
                    appState: {
                        activeRoutineId: 'test-cycle',
                        overdueTaskStates: {}
                    },
                    settings: {}
                };
                localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

                // Clear test container
                testContainer.innerHTML = '';

                // Clear any global state (but preserve appInit!)
                delete window.AppState;
                delete window.dueDatesManager;

                await testFn();
                resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
                passed.count++;
            } catch (error) {
                resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            }
        }

        // === INITIALIZATION TESTS ===
        resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';

        await test('creates instance successfully', async () => {
            const instance = new MiniCycleDueDates();
            if (!instance || typeof instance.saveTaskDueDate !== 'function') {
                throw new Error('MiniCycleDueDates not properly initialized');
            }
        });

        await test('accepts dependency injection', async () => {
            const mockShowNotification = (msg) => console.log(msg);

            const instance = new MiniCycleDueDates({
                showNotification: mockShowNotification,
                AppState: createMockAppStateForDueDates()
            });

            if (!instance || !instance.deps.showNotification) {
                throw new Error('Dependency injection failed');
            }
        });


        // === CORE FUNCTIONALITY TESTS ===
        resultsDiv.innerHTML += '<h4>⚡ Core Functionality</h4>';

        await test('saveTaskDueDate updates task in Schema 2.5', async () => {
            const instance = new MiniCycleDueDates({
                AppState: createMockAppStateForDueDates()
            });

            await instance.saveTaskDueDate('task-1', '2025-11-15');

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.routine['test-cycle'].tasks.find(t => t.id === 'task-1');

            if (task.dueDate !== '2025-11-15') {
                throw new Error('Due date not saved correctly');
            }
        });

        await test('saveTaskDueDate updates metadata timestamp', async () => {
            const originalData = JSON.parse(localStorage.getItem('miniCycleData'));
            const originalTimestamp = originalData.metadata.lastModified;

            await new Promise(resolve => setTimeout(resolve, 10));

            const instance = new MiniCycleDueDates({
                AppState: createMockAppStateForDueDates()
            });

            await instance.saveTaskDueDate('task-1', '2025-12-01');

            const updatedData = JSON.parse(localStorage.getItem('miniCycleData'));

            if (updatedData.metadata.lastModified <= originalTimestamp) {
                throw new Error('Metadata timestamp not updated');
            }
        });

        await test('saveTaskDueDate keeps the recurring template in step (set and clear)', async () => {
            // The watcher recreates a recurring task from its template; a date
            // changed or cleared on the task alone came back on the next
            // occurrence (Oct 2026).
            const seeded = JSON.parse(localStorage.getItem('miniCycleData'));
            seeded.data.routine['test-cycle'].recurringTemplates = {
                'task-1': { id: 'task-1', text: 'Test Task 1', recurring: true, dueDate: '2025-01-01', recurringSettings: { frequency: 'daily' }, nextScheduledOccurrence: 1 }
            };
            localStorage.setItem('miniCycleData', JSON.stringify(seeded));
            const instance = new MiniCycleDueDates({ AppState: createMockAppStateForDueDates() });

            await instance.saveTaskDueDate('task-1', '2025-11-15');
            let tpl = JSON.parse(localStorage.getItem('miniCycleData')).data.routine['test-cycle'].recurringTemplates['task-1'];
            if (tpl.dueDate !== '2025-11-15') throw new Error(`template should follow the task's new date, got ${tpl.dueDate}`);

            await instance.saveTaskDueDate('task-1', null);
            tpl = JSON.parse(localStorage.getItem('miniCycleData')).data.routine['test-cycle'].recurringTemplates['task-1'];
            if (tpl.dueDate !== null) throw new Error(`template should be cleared with the task, got ${tpl.dueDate}`);
        });

        await test('clears due date when set to null', async () => {
            const instance = new MiniCycleDueDates({
                AppState: createMockAppStateForDueDates()
            });

            await instance.saveTaskDueDate('task-2', null);

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.routine['test-cycle'].tasks.find(t => t.id === 'task-2');

            if (task.dueDate !== null) {
                throw new Error('Due date not cleared correctly');
            }
        });

        await test('createDueDateInput returns the due-date line (a button) showing the date', async () => {
            const instance = new MiniCycleDueDates();

            const chip = instance.createDueDateInput('task-1', localDay(1), false, {}, 'test-cycle');

            if (chip.tagName !== 'BUTTON' || !chip.classList.contains('due-date')) {
                throw new Error(`expected a .due-date button, got <${chip.tagName.toLowerCase()} class="${chip.className}">`);
            }
            if (chip.classList.contains('hidden')) throw new Error('a dated task must show its line');
            if (chip.textContent.trim() !== 'Tomorrow') throw new Error(`line text: "${chip.textContent}"`);
            if (chip.getAttribute('aria-haspopup') !== 'dialog') throw new Error('the line opens the picker dialog');
        });

        await test('createDueDateInput shows the time beside the date, and hides without a date', async () => {
            const instance = new MiniCycleDueDates();

            const timed = instance.createDueDateInput('task-1', localDay(1), false, {}, 'test-cycle', '15:30');
            if (!/Tomorrow · .*3:30/.test(timed.textContent)) throw new Error(`timed line: "${timed.textContent}"`);

            const none = instance.createDueDateInput('task-1', null, true, {}, 'test-cycle');
            if (!none.classList.contains('hidden')) throw new Error('an undated task must hide its line');
        });

        await test('checkOverdueTasks identifies overdue tasks (from state)', async () => {
            const instance = new MiniCycleDueDates({
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });

            // Yesterday via LOCAL date parts, not toISOString() — in any negative
            // UTC offset an evening "yesterday" serialises as TODAY's date (this
            // test once failed every evening after 20:00 EDT for that reason).
            putTask({ id: 'overdue-task-1', text: 'Overdue Task', completed: false, dueDate: localDay(-1) });
            const { row, chip } = makeRow('overdue-task-1', 'Overdue Task');

            await instance.checkOverdueTasks(row);

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            // Implementation stores by task ID, not task text
            if (!savedData.appState.overdueTaskStates['overdue-task-1']) {
                throw new Error('Overdue task not tracked in overdueTaskStates');
            }
            if (!row.classList.contains('overdue-task')) throw new Error('row should carry the overdue class');
            if (!chip.classList.contains('due-date-overdue')) throw new Error('the due-date line should turn overdue');
            if (!/Overdue/.test(row.getAttribute('aria-label') || '')) throw new Error(`row label: ${row.getAttribute('aria-label')}`);
        });

        await test('checkOverdueTasks: a completed task is never shown as overdue (but its memory is kept)', async () => {
            // Until Oct 2026 the overdue check read the inline date input and never
            // looked at completion, so a checked-off task was styled, announced
            // ("Overdue Tasks: …") and labelled "Overdue" anyway.
            let banner = null;
            const instance = new MiniCycleDueDates({
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates(),
                showNotification: (msg) => { banner = msg; }
            });
            putTask({ id: 'done-late', text: 'Done Late', completed: true, dueDate: localDay(-2) });
            const data = JSON.parse(localStorage.getItem('miniCycleData'));
            data.appState.overdueTaskStates = { 'done-late': true };
            localStorage.setItem('miniCycleData', JSON.stringify(data));
            const { row, chip } = makeRow('done-late', 'Done Late');
            row.classList.add('overdue-task');

            await instance.checkOverdueTasks(row);

            if (row.classList.contains('overdue-task')) throw new Error('completed task kept the overdue class');
            if (chip.classList.contains('due-date-overdue')) throw new Error('completed task line still overdue');
            if (!/Completed/.test(row.getAttribute('aria-label') || '')) throw new Error(`row label: ${row.getAttribute('aria-label')}`);
            if (banner) throw new Error(`no overdue banner for a completed task: ${banner}`);
            const saved = JSON.parse(localStorage.getItem('miniCycleData'));
            if (!saved.appState.overdueTaskStates['done-late']) {
                throw new Error('the remembered overdue state should survive, so unchecking does not re-announce it');
            }
        });

        await test('checkOverdueTasks: a due time already past today is overdue; a later one is not', async () => {
            const now = new Date();
            // Skip the edges of the day, where "an hour ago" or "in an hour" is another date.
            if (now.getHours() < 1 || now.getHours() > 22) return;
            const hh = (h) => `${String(h).padStart(2, '0')}:00`;
            const instance = new MiniCycleDueDates({
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });
            putTask({ id: 'past', text: 'Past', completed: false, dueDate: localDay(0), dueTime: hh(now.getHours() - 1) });
            putTask({ id: 'later', text: 'Later', completed: false, dueDate: localDay(0), dueTime: hh(now.getHours() + 1) });
            const past = makeRow('past', 'Past');
            const later = makeRow('later', 'Later');

            await instance.checkOverdueTasks(past.row);
            await instance.checkOverdueTasks(later.row);

            if (!past.row.classList.contains('overdue-task')) throw new Error('a time an hour ago today should be overdue');
            if (later.row.classList.contains('overdue-task')) throw new Error('a time an hour from now should not be overdue');
            if (!/Today · /.test(later.chip.textContent)) throw new Error(`line: "${later.chip.textContent}"`);
        });

        await test('checkOverdueTasks: clearing the date drops the class AND the "Overdue" label', async () => {
            const instance = new MiniCycleDueDates({
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });
            putTask({ id: 'cleared', text: 'Cleared', completed: false, dueDate: null });
            const { row, chip } = makeRow('cleared', 'Cleared');
            row.classList.add('overdue-task');
            row.setAttribute('aria-label', 'Cleared, Overdue');

            await instance.checkOverdueTasks(row);

            if (row.classList.contains('overdue-task')) throw new Error('class kept after the date was cleared');
            if (/Overdue/.test(row.getAttribute('aria-label') || '')) throw new Error(`label kept: ${row.getAttribute('aria-label')}`);
            if (!chip.classList.contains('hidden')) throw new Error('an undated task must hide its line');
        });

        // === SCHEMA 2.5 STORAGE TESTS ===
        resultsDiv.innerHTML += '<h4>💾 Schema 2.5 Storage</h4>';

        await test('saves due date to correct Schema 2.5 location', async () => {
            const instance = new MiniCycleDueDates({
                AppState: createMockAppStateForDueDates()
            });

            await instance.saveTaskDueDate('task-2', '2026-01-01');

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.routine['test-cycle'].tasks.find(t => t.id === 'task-2');

            if (!task || task.dueDate !== '2026-01-01') {
                throw new Error('Due date not saved to correct Schema 2.5 location');
            }
        });

        await test('stores overdue states in Schema 2.5', async () => {
            const instance = new MiniCycleDueDates({
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });

            await instance.checkOverdueTasks();

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));

            if (!savedData.appState.overdueTaskStates) {
                throw new Error('overdueTaskStates not created in appState');
            }
        });

        // === ERROR HANDLING TESTS ===
        resultsDiv.innerHTML += '<h4>⚠️ Error Handling</h4>';

        await test('handles missing task gracefully', async () => {
            const instance = new MiniCycleDueDates({
                AppState: createMockAppStateForDueDates(),
                showNotification: () => {}
            });

            // Should not throw when task doesn't exist
            await instance.saveTaskDueDate('non-existent-task', '2025-12-31');

            // Task should not be created
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.routine['test-cycle'].tasks.find(t => t.id === 'non-existent-task');

            if (task) {
                throw new Error('Non-existent task should not be created');
            }
        });

        await test('handles missing Schema 2.5 data', async () => {
            localStorage.clear();

            const instance = new MiniCycleDueDates({
                AppState: { isReady: () => false, get: () => null },
                showNotification: () => {}
            });

            // Should throw error when state is not ready
            let errorThrown = false;
            try {
                await instance.saveTaskDueDate('task-1', '2025-12-31');
            } catch (error) {
                errorThrown = true;
            }

            if (!errorThrown) {
                throw new Error('Should throw error when Schema 2.5 data is missing');
            }
        });

        // === INTEGRATION TESTS ===
        resultsDiv.innerHTML += '<h4>🔗 Integration Tests</h4>';

        await test('the calendar button opens the picker; Save stores date and time as separate fields', async () => {
            const instance = new MiniCycleDueDates({
                AppState: createMockAppStateForDueDates(),
                showNotification: () => {}
            });
            // No auto-reset toggle in the harness: setup still installs the one
            // document listener the picker hangs off, then returns.
            instance.setupDueDateSystem();
            try {
                const { row } = makeRow('task-1', 'Test Task 1');
                const button = document.createElement('button');
                button.classList.add('task-btn', 'set-due-date');
                row.appendChild(button);

                button.click();
                const dialog = document.getElementById('due-date-picker');
                if (!dialog?.open) throw new Error('the picker did not open');
                const date = document.getElementById('due-date-picker-date');
                const time = document.getElementById('due-date-picker-time');
                if (date.value !== '' || time.value !== '') throw new Error('an undated task opens with empty fields');

                date.value = '2026-11-02';
                time.value = '14:45';
                dialog.querySelector('form').requestSubmit();
                await waitForAsyncOperations(50);

                if (dialog.open) throw new Error('Save should close the picker');
                const task = JSON.parse(localStorage.getItem('miniCycleData')).data.routine['test-cycle'].tasks.find(t => t.id === 'task-1');
                if (task.dueDate !== '2026-11-02' || task.dueTime !== '14:45') {
                    throw new Error(`stored ${JSON.stringify({ dueDate: task.dueDate, dueTime: task.dueTime })}`);
                }
            } finally {
                instance.destroy();
            }
            if (document.getElementById('due-date-picker')) throw new Error('destroy should remove the picker');
        });

        await test('the picker: tapping the due-date line opens it filled in; Clear drops date AND time', async () => {
            const instance = new MiniCycleDueDates({
                AppState: createMockAppStateForDueDates(),
                showNotification: () => {}
            });
            instance.setupDueDateSystem();
            try {
                putTask({ id: 'timed', text: 'Timed', completed: false, dueDate: '2026-12-01', dueTime: '08:15' });
                const { chip } = makeRow('timed', 'Timed');
                chip.classList.remove('hidden');

                chip.click();
                const dialog = document.getElementById('due-date-picker');
                if (!dialog?.open) throw new Error('the due-date line should open the picker');
                if (document.getElementById('due-date-picker-date').value !== '2026-12-01') throw new Error('date not prefilled');
                if (document.getElementById('due-date-picker-time').value !== '08:15') throw new Error('time not prefilled');

                dialog.querySelector('.due-date-picker-clear').click();
                await waitForAsyncOperations(50);

                const task = JSON.parse(localStorage.getItem('miniCycleData')).data.routine['test-cycle'].tasks.find(t => t.id === 'timed');
                if (task.dueDate !== null || task.dueTime !== null) {
                    throw new Error(`Clear left ${JSON.stringify({ dueDate: task.dueDate, dueTime: task.dueTime })}`);
                }
            } finally {
                instance.destroy();
            }
        });

        await test('due-date lines render from state: shown with a date, hidden without', async () => {
            putTask({ id: 'dated', text: 'Dated', completed: false, dueDate: localDay(3) });
            putTask({ id: 'undated', text: 'Undated', completed: false, dueDate: null });
            const dated = makeRow('dated', 'Dated');
            const undated = makeRow('undated', 'Undated');
            undated.chip.classList.remove('hidden');

            const instance = new MiniCycleDueDates({
                getElementById: () => null,
                querySelectorAll: (selector) => selector === '.task' ? [dated.row, undated.row] : [],
                AppState: createMockAppStateForDueDates()
            });

            await instance.checkOverdueTasks();

            if (dated.chip.classList.contains('hidden') || !dated.chip.textContent.trim()) {
                throw new Error('a dated task must show its line with text');
            }
            if (!undated.chip.classList.contains('hidden')) throw new Error('an undated task must hide its line');
        });

        // === PERFORMANCE TESTS ===
        resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';

        await test('saveTaskDueDate completes within reasonable time', async () => {
            const instance = new MiniCycleDueDates({
                AppState: createMockAppStateForDueDates()
            });

            const startTime = performance.now();
            await instance.saveTaskDueDate('task-1', '2025-12-31');
            const endTime = performance.now();

            const duration = endTime - startTime;

            if (duration > 100) {
                throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
            }
        });

        await test('checkOverdueTasks completes within reasonable time', async () => {
            const instance = new MiniCycleDueDates({
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });

            const startTime = performance.now();
            await instance.checkOverdueTasks();
            const endTime = performance.now();

            const duration = endTime - startTime;

            if (duration > 100) {
                throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
            }
        });

        // === REMIND OVERDUE TASKS TESTS ===
        resultsDiv.innerHTML += '<h4>⏰ Remind Overdue Tasks</h4>';

        await test('remindOverdueTasks method exists', () => {
            const instance = new MiniCycleDueDates();
            if (typeof instance.remindOverdueTasks !== 'function') {
                throw new Error('remindOverdueTasks method should exist');
            }
        });

        // NOTE: former test 'remindOverdueTasks skips when autoReset is enabled' removed.
        // It asserted nothing AND was mis-premised: remindOverdueTasks() has no autoReset
        // check (it skips only on missing schema data or dueDatesReminders disabled), so
        // the injected toggleAutoReset was inert. Those real skip paths are covered by the
        // 'dueDatesReminders disabled' and 'missing schema data' tests below. (Test-suite audit.)

        await test('remindOverdueTasks skips when dueDatesReminders disabled', () => {
            const mockToggle = { checked: false };
            let notificationShown = false;

            const instance = new MiniCycleDueDates({
                AppState: { isReady: () => true, get: () => ({ customReminders: { dueDatesReminders: false } }) },
                querySelectorAll: () => [],
                showNotification: () => { notificationShown = true; }
            });
            instance.toggleAutoReset = mockToggle;

            instance.remindOverdueTasks();

            if (notificationShown) {
                throw new Error('Should not show notification when dueDatesReminders is disabled');
            }
        });

        await test('remindOverdueTasks shows notification for overdue tasks', () => {
            const mockToggle = { checked: false };
            let notificationMessage = null;

            // Create mock overdue task
            const mockTask = document.createElement('div');
            mockTask.classList.add('task', 'overdue-task');
            const taskText = document.createElement('span');
            taskText.classList.add('task-text');
            taskText.textContent = 'Overdue Task 1';
            mockTask.appendChild(taskText);

            const instance = new MiniCycleDueDates({
                AppState: { isReady: () => true, get: () => ({ customReminders: { dueDatesReminders: true } }) },
                querySelectorAll: (selector) => {
                    if (selector === '.task') return [mockTask];
                    return [];
                },
                showNotification: (msg) => { notificationMessage = msg; }
            });
            instance.toggleAutoReset = mockToggle;

            instance.remindOverdueTasks();

            if (!notificationMessage || !notificationMessage.includes('Overdue Task 1')) {
                throw new Error('Should show notification with overdue task name');
            }
        });

        await test('remindOverdueTasks does not show notification when no overdue tasks', () => {
            const mockToggle = { checked: false };
            let notificationShown = false;

            // Create mock non-overdue task
            const mockTask = document.createElement('div');
            mockTask.classList.add('task'); // Not overdue

            const instance = new MiniCycleDueDates({
                AppState: { isReady: () => true, get: () => ({ customReminders: { dueDatesReminders: true } }) },
                querySelectorAll: (selector) => {
                    if (selector === '.task') return [mockTask];
                    return [];
                },
                showNotification: () => { notificationShown = true; }
            });
            instance.toggleAutoReset = mockToggle;

            instance.remindOverdueTasks();

            if (notificationShown) {
                throw new Error('Should not show notification when no overdue tasks');
            }
        });

        await test('remindOverdueTasks handles missing schema data gracefully', () => {
            const mockToggle = { checked: false };
            const instance = new MiniCycleDueDates({
                AppState: { isReady: () => false, get: () => null },
                querySelectorAll: () => []
            });
            instance.toggleAutoReset = mockToggle;

            // Should not throw
            instance.remindOverdueTasks();
        });

        await test('a task due TODAY is not marked overdue (local-midnight date parsing)', async () => {
            // Regression guard for the UTC date-only parse. <input type="date">.value
            // is "YYYY-MM-DD", and new Date() reads that as UTC midnight — which in
            // any negative UTC offset is the PREVIOUS local day, so a task due today
            // was flagged overdue across the Americas. parseDateAsLocal fixes it.
            //
            // NOTE: CI runs in UTC, where local and UTC midnight coincide and this
            // assertion passes either way. Its teeth are in negative-offset zones;
            // verified failing against the old code under TZ=America/New_York.
            // Build today's date from LOCAL components (toISOString would re-introduce
            // the very UTC shift under test).
            const now = new Date();
            const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const instance = new MiniCycleDueDates({
                querySelectorAll: () => [],
                AppState: createMockAppStateForDueDates()
            });

            putTask({ id: 'due-today-task', text: 'Due Today', completed: false, dueDate: todayLocal });
            const { row: taskDiv } = makeRow('due-today-task', 'Due Today');

            await instance.checkOverdueTasks(taskDiv);

            if (taskDiv.classList.contains('overdue-task')) {
                throw new Error('a task due today must not carry the overdue class');
            }
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            if (savedData.appState.overdueTaskStates?.['due-today-task']) {
                throw new Error('a task due today must not be tracked as overdue');
            }
        });

        // === DUE-DAY SYSTEM NOTIFICATIONS ===
        resultsDiv.innerHTML += '<h4>🔔 Due-day system notifications</h4>';

        // A fixed "now": Tue 2026-10-13 08:00 local. Due dates are date-only, so
        // the moment is the due day at the configured hour (9:00 by default).
        const NOW = new Date(2026, 9, 13, 8, 0, 0).getTime();
        const at = (y, m, d, h = 9) => new Date(y, m, d, h, 0, 0).getTime();
        const stateWith = (routines, customReminders = { dueDatesReminders: true, browserNotifications: true }) => ({
            customReminders, appState: { activeRoutineId: 'r1' }, data: { routine: routines }, settings: {}
        });

        await test('slots: one per due day at the notify hour, grouped, sorted, across routines', () => {
            const state = stateWith({
                r1: { id: 'r1', tasks: [
                    { id: 'a', text: 'Pay rent', dueDate: '2026-10-14', completed: false },
                    { id: 'b', text: 'Call Sam', dueDate: '2026-10-13', completed: false }
                ] },
                r2: { id: 'r2', tasks: [
                    { id: 'c', text: 'Water plants', dueDate: '2026-10-14', completed: false }
                ] }
            });
            const slots = computeDueDateNotificationSlots(state, NOW);
            if (slots.length !== 2) throw new Error(`expected 2 slots, got ${JSON.stringify(slots)}`);
            if (slots[0].at !== at(2026, 9, 13) || slots[1].at !== at(2026, 9, 14)) throw new Error(`moments wrong: ${JSON.stringify(slots.map(s => new Date(s.at).toString()))}`);
            if (slots[0].tasks.join() !== 'Call Sam') throw new Error(`today's slot: ${slots[0].tasks}`);
            if (slots[1].tasks.slice().sort().join() !== 'Pay rent,Water plants') throw new Error(`tomorrow's slot should hold both routines' tasks: ${slots[1].tasks}`);
        });

        await test('slots: completed tasks and moments already past are left out (no repeat for overdue)', () => {
            const state = stateWith({ r1: { id: 'r1', tasks: [
                { id: 'a', text: 'Done one', dueDate: '2026-10-14', completed: true },
                { id: 'b', text: 'Yesterday', dueDate: '2026-10-12', completed: false },
                { id: 'c', text: 'Undated', dueDate: null, completed: false },
                { id: 'd', text: 'Later', dueDate: '2026-10-20', completed: false }
            ] } });
            const slots = computeDueDateNotificationSlots(state, NOW);
            if (slots.length !== 1 || slots[0].tasks.join() !== 'Later') throw new Error(`expected only "Later": ${JSON.stringify(slots)}`);
        });

        await test('slots: a due day whose hour has passed today is not re-notified', () => {
            const afterNine = new Date(2026, 9, 13, 9, 30, 0).getTime();
            const state = stateWith({ r1: { id: 'r1', tasks: [{ id: 'a', text: 'Today', dueDate: '2026-10-13', completed: false }] } });
            if (computeDueDateNotificationSlots(state, afterNine).length !== 0) throw new Error('9:00 today has passed, so no slot');
        });

        await test('slots: a task with a due time fires at that time, apart from the 9:00 group', () => {
            const state = stateWith({ r1: { id: 'r1', tasks: [
                { id: 'a', text: 'Dentist', dueDate: '2026-10-14', dueTime: '15:30', completed: false },
                { id: 'b', text: 'Rent', dueDate: '2026-10-14', completed: false },
                { id: 'c', text: 'Early', dueDate: '2026-10-13', dueTime: '07:00', completed: false }
            ] } });
            const slots = computeDueDateNotificationSlots(state, NOW);
            const nine = at(2026, 9, 14);
            const half3 = new Date(2026, 9, 14, 15, 30, 0).getTime();
            if (slots.length !== 2) throw new Error(`expected 2 slots (07:00 today has passed): ${JSON.stringify(slots)}`);
            if (slots[0].at !== nine || slots[0].tasks.join() !== 'Rent' || slots[0].timed) throw new Error(`9:00 slot: ${JSON.stringify(slots[0])}`);
            if (slots[1].at !== half3 || slots[1].tasks.join() !== 'Dentist' || !slots[1].timed) throw new Error(`15:30 slot: ${JSON.stringify(slots[1])}`);
        });

        await test('content: a slot of timed tasks says "due now", not "due today"', () => {
            const instance = wireDueDateNotifications(stateWith({}));
            try {
                const timed = instance._dueDateSlotContent({ at: 0, tasks: ['Dentist'], timed: true });
                if (!/1 task due now/.test(timed.title)) throw new Error(`timed title: "${timed.title}"`);
            } finally { instance.destroy(); }
        });

        // === DUE DATE MEANING (utils/dueDateUtils.js) ===
        await test('dueDateUtils: labels, overdue rule and time validation', () => {
            const now = new Date(2026, 9, 28, 14, 0); // Wed 2026-10-28 14:00
            const label = (dueDate, dueTime = null) => formatDueLabel({ dueDate, dueTime }, now);
            if (label('2026-10-28') !== 'Today') throw new Error(`today: ${label('2026-10-28')}`);
            if (label('2026-10-29') !== 'Tomorrow') throw new Error(`tomorrow: ${label('2026-10-29')}`);
            if (label('2026-10-27') !== 'Yesterday') throw new Error(`yesterday: ${label('2026-10-27')}`);
            if (!/^Today · .*9:15/.test(label('2026-10-28', '09:15'))) throw new Error(`with time: ${label('2026-10-28', '09:15')}`);
            if (!/2027/.test(label('2027-01-02'))) throw new Error(`another year shows the year: ${label('2027-01-02')}`);
            if (label(null) !== '') throw new Error('no date, no label');

            if (isTaskOverdue({ dueDate: '2026-10-28' }, now)) throw new Error('due today (no time) is not overdue');
            if (!isTaskOverdue({ dueDate: '2026-10-28', dueTime: '09:15' }, now)) throw new Error('a passed time today is overdue');
            if (isTaskOverdue({ dueDate: '2026-10-28', dueTime: '18:00' }, now)) throw new Error('a later time today is not overdue');
            if (isTaskOverdue({ dueDate: '2026-10-20', completed: true }, now)) throw new Error('a completed task is never overdue');

            if (normalizeDueTime('24:00') !== null || normalizeDueTime('7:05') !== null || normalizeDueTime('07:05') !== '07:05') {
                throw new Error('dueTime must be strict "HH:MM"');
            }
            const fallback = getDueMoment({ dueDate: '2026-10-28', dueTime: 'nonsense' });
            if (fallback.getHours() !== 9 || fallback.getMinutes() !== 0) throw new Error('a bad time falls back to the 9:00 moment');
        });

        await test('slots: a nameless task is listed under the unnamed label, never blank', () => {
            const state = stateWith({ r1: { id: 'r1', tasks: [{ id: 'a', text: '', dueDate: '2026-10-14', completed: false }] } });
            const slots = computeDueDateNotificationSlots(state, NOW);
            if (!slots[0] || !slots[0].tasks[0] || !slots[0].tasks[0].trim()) throw new Error(`blank task name in slot: ${JSON.stringify(slots)}`);
        });

        function wireDueDateNotifications(state) {
            const AppState = { isReady: () => true, get: () => state, update: async (fn) => fn(state), subscribe: () => {}, unsubscribe: () => true };
            const instance = new MiniCycleDueDates({ AppState, showNotification: () => {} });
            instance._canPostWebNotifications = () => true;
            return instance;
        }

        await test('sync: arms one timer for the next due-day moment when both switches are on', () => {
            const tomorrow = formatLocalDate(new Date(Date.now() + 86400000));
            const instance = wireDueDateNotifications(stateWith({ r1: { id: 'r1', tasks: [{ id: 'a', text: 'T', dueDate: tomorrow, completed: false }] } }));
            try {
                instance.syncDueDateNotifications();
                if (!instance._dueDateTimerId) throw new Error('no timer armed for a dated task due tomorrow');
            } finally { instance.destroy(); }
        });

        await test('sync: does nothing while either switch is off, and clears a timer it had armed', () => {
            const tomorrow = formatLocalDate(new Date(Date.now() + 86400000));
            const routines = { r1: { id: 'r1', tasks: [{ id: 'a', text: 'T', dueDate: tomorrow, completed: false }] } };
            const state = stateWith(routines);
            const instance = wireDueDateNotifications(state);
            try {
                instance.syncDueDateNotifications();
                if (!instance._dueDateTimerId) throw new Error('fixture: timer should be armed first');
                state.customReminders = { dueDatesReminders: true, browserNotifications: false };
                instance.syncDueDateNotifications();
                if (instance._dueDateTimerId) throw new Error('channel off: the timer should have been cleared');
                state.customReminders = { dueDatesReminders: false, browserNotifications: true };
                instance.syncDueDateNotifications();
                if (instance._dueDateTimerId) throw new Error('due-date notices off: nothing may be armed');
            } finally { instance.destroy(); }
        });

        await test('sync: completing the only dated task clears the timer on re-plan', () => {
            const tomorrow = formatLocalDate(new Date(Date.now() + 86400000));
            const state = stateWith({ r1: { id: 'r1', tasks: [{ id: 'a', text: 'T', dueDate: tomorrow, completed: false }] } });
            const instance = wireDueDateNotifications(state);
            try {
                instance.syncDueDateNotifications();
                state.data.routine.r1.tasks[0].completed = true;
                instance.syncDueDateNotifications();
                if (instance._dueDateTimerId) throw new Error('a completed task must not keep its notification');
            } finally { instance.destroy(); }
        });

        await test('content: title and body come from the labels, one line per task', () => {
            const instance = wireDueDateNotifications(stateWith({}));
            try {
                const one = instance._dueDateSlotContent({ at: 0, tasks: ['Pay rent'] });
                const two = instance._dueDateSlotContent({ at: 0, tasks: ['Pay rent', 'Call Sam'] });
                if (!/1 task due today/.test(one.title)) throw new Error(`singular title: "${one.title}"`);
                if (!/2 tasks due today/.test(two.title)) throw new Error(`plural title: "${two.title}"`);
                if (two.body.split('\n').length !== 2 || !/Call Sam/.test(two.body)) throw new Error(`body: ${JSON.stringify(two.body)}`);
            } finally { instance.destroy(); }
        });

        await test('destroy: unsubscribes and leaves no timer behind', () => {
            const tomorrow = formatLocalDate(new Date(Date.now() + 86400000));
            const state = stateWith({ r1: { id: 'r1', tasks: [{ id: 'a', text: 'T', dueDate: tomorrow, completed: false }] } });
            let unsubscribed = false;
            const AppState = { isReady: () => true, get: () => state, update: async (fn) => fn(state), subscribe: () => {}, unsubscribe: () => { unsubscribed = true; return true; } };
            const instance = new MiniCycleDueDates({ AppState, showNotification: () => {} });
            instance._canPostWebNotifications = () => true;
            instance._subscribeDueDateNotifications();
            instance.syncDueDateNotifications();
            instance.destroy();
            if (instance._dueDateTimerId) throw new Error('timer survived destroy');
            if (!unsubscribed) throw new Error('state subscription survived destroy');
        });

        // === SUMMARY ===
        const percentage = Math.round((passed.count / total.count) * 100);
        resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

        if (passed.count === total.count) {
            resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
        } else {
            resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
        }

        return { passed: passed.count, total: total.count };

    } catch (error) {
        console.error('❌ Test suite error:', error);
        resultsDiv.innerHTML += `<div class="result fail">❌ Test suite error: ${error.message}</div>`;
        resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (test suite error)</h3>`;
        
    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

return { passed: passed.count, total: total.count };
    }
}
