/**
 * TaskCRUD Tests
 * Tests for task creation, editing, deletion, and priority toggle
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';
import { LIMITS } from '../modules/core/constants.js';

export async function runTaskCRUDTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskCRUD.js?v=${cacheBuster}`);
    const { setTaskCRUDDependencies, addTaskImpl, toggleTaskPriorityImpl } = mod;

    resultsDiv.innerHTML = '<h2>TaskCRUD Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function createMockState() {
        return {
            metadata: { lastModified: Date.now() },
            settings: { taskLimit: 100 },
            data: { routine: {
                    'cycle-1': {
                        tasks: [
                            { id: 'task-1', text: 'Existing', completed: false, priority: false }
                        ],
                        recurringTemplates: [],
                        metadata: { title: 'Test' }
                    }
                }
            },
            appState: { activeRoutineId: 'cycle-1', currentMode: 'auto' }
        };
    }

    function createMockAppState(state) {
        return {
            isReady: () => true,
            get: () => state,
            update: (fn) => { fn(state); state.metadata.lastModified = Date.now(); }
        };
    }

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setTaskCRUDDependencies is exported', () => {
        if (typeof setTaskCRUDDependencies !== 'function') throw new Error('DI setter missing');
    });

    await test('addTaskImpl is exported', () => {
        if (typeof addTaskImpl !== 'function') throw new Error('addTaskImpl missing');
    });

    await test('toggleTaskPriorityImpl is exported', () => {
        if (typeof toggleTaskPriorityImpl !== 'function') throw new Error('toggleTaskPriorityImpl missing');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">➕ addTaskImpl</h4>';

    await test('addTaskImpl rejects empty text', async () => {
        const state = createMockState();
        const taskInput = document.createElement('input');
        taskInput.id = 'taskInput';   // DOM_IDS.TASK_INPUT — the guard flags this on rejection
        document.body.appendChild(taskInput);
        try {
            const deps = {
                AppState: createMockAppState(state),
                sanitizeInput: (t) => t.trim(),
                // Faithful contract: returns the sanitized string, or null when invalid.
                validateAndSanitizeTaskInput: (t) => (t.trim() ? t.trim() : null),
                showNotification: () => {},
            };
            setTaskCRUDDependencies(deps);

            // isLoading:true skips the storage-quota/task-limit pre-checks (which early-return
            // in a unit context) so execution reaches the input-validation guard we're testing.
            await addTaskImpl('', { isLoading: true }, deps);

            // Empty text → validation returns null → the guard sets aria-invalid and returns
            // BEFORE adding (taskCRUD.js:264-268). The OLD mock returned a truthy object, so the
            // guard was never hit — the task was only "not added" because loadTaskContext was
            // absent, i.e. green even if empty-text validation were deleted.
            if (taskInput.getAttribute('aria-invalid') !== 'true') {
                throw new Error('empty input should be flagged aria-invalid by the validation guard');
            }
            if (state.data.routine['cycle-1'].tasks.length !== 1) {
                throw new Error('empty task should not be added');
            }
        } finally {
            document.body.removeChild(taskInput);
        }
    });

    await test('REGRESSION: edit modal flags empty text for AT and warns when a long edit is truncated', async () => {
        // Mobile edit modal (isTouchDevice → true). Two gaps, both twins of the
        // routine-creation dialog's: empty text got only a red border (no
        // aria-invalid, nothing announced), and sanitizeInput clamped a long
        // edit to the limit silently.
        const { editTaskImpl } = mod;
        const limit = LIMITS.TASK_CHARACTER_INPUT;
        const state = createMockState();
        const notifications = [];

        const taskItem = document.createElement('div');
        taskItem.className = 'task';
        taskItem.dataset.taskId = 'task-1';
        const label = document.createElement('span');
        label.className = 'task-text';   // DOM_SELECTORS.TASK_TEXT
        label.textContent = 'Existing';
        taskItem.appendChild(label);
        document.body.appendChild(taskItem);

        const deps = {
            AppState: createMockAppState(state),
            // Faithful mock: the real GlobalUtils.sanitizeInput clamps to the limit.
            sanitizeInput: (t, maxLength = limit) => t.trim().substring(0, maxLength),
            showNotification: (msg, type) => notifications.push({ msg: String(msg), type }),
            isTouchDevice: () => true,
            getBody: () => document.body
        };
        setTaskCRUDDependencies(deps);

        try {
            await editTaskImpl(taskItem, deps);
            const dialog = document.querySelector('.miniCycle-prompt-dialog');
            if (!dialog) throw new Error('edit modal should open on a touch device');
            const input = dialog.querySelector('.miniCycle-prompt-input');
            const saveBtn = dialog.querySelector('.miniCycle-btn-confirm');

            // 1) Empty text: flagged for AT and explained, dialog stays open
            input.value = '   ';
            saveBtn.click();
            await new Promise(r => setTimeout(r, 50));
            if (!document.body.contains(dialog)) throw new Error('dialog should stay open on empty text');
            if (input.getAttribute('aria-invalid') !== 'true') throw new Error('empty text should set aria-invalid="true"');
            if (!input.classList.contains('miniCycle-input-error')) throw new Error('empty text should add the error class');
            const emptyWarn = notifications.find(n => /cannot be empty/i.test(n.msg));
            if (!emptyWarn) throw new Error(`expected an "empty" notification, got: ${JSON.stringify(notifications.map(n => n.msg))}`);
            if (emptyWarn.type !== 'warning') throw new Error(`expected a warning, got "${emptyWarn.type}"`);

            // 2) Typing clears the error state
            input.value = 'x';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            if (input.hasAttribute('aria-invalid') || input.classList.contains('miniCycle-input-error')) {
                throw new Error('error state should clear once the user types');
            }

            // 3) Over-long edit: saved clamped, WITH a truncation warning
            input.value = 't'.repeat(limit + 30);
            saveBtn.click();
            await new Promise(r => setTimeout(r, 100));
            const truncWarn = notifications.find(n => /truncated/i.test(n.msg) && n.msg.includes(String(limit)));
            if (!truncWarn) throw new Error(`expected a "truncated to ${limit}" warning, got: ${JSON.stringify(notifications.map(n => n.msg))}`);
            const saved = state.data.routine['cycle-1'].tasks.find(t => t.id === 'task-1');
            if (!saved || saved.text.length !== limit) throw new Error(`saved text should be ${limit} chars, got ${saved ? saved.text.length : 'none'}`);
            if (document.body.contains(dialog)) throw new Error('dialog should close after a successful save');
        } finally {
            taskItem.remove();
            document.querySelectorAll('.miniCycle-prompt-dialog').forEach(d => d.remove());
        }
    });

    await test('addTaskImpl rejects whitespace-only text', async () => {
        const state = createMockState();
        const taskInput = document.createElement('input');
        taskInput.id = 'taskInput';
        document.body.appendChild(taskInput);
        try {
            const deps = {
                AppState: createMockAppState(state),
                sanitizeInput: (t) => t.trim(),
                validateAndSanitizeTaskInput: (t) => (t.trim() ? t.trim() : null),
                showNotification: () => {},
            };
            setTaskCRUDDependencies(deps);

            await addTaskImpl('   ', { isLoading: true }, deps);

            // '   '.trim() === '' → validation returns null → same rejection path.
            if (taskInput.getAttribute('aria-invalid') !== 'true') {
                throw new Error('whitespace input should be flagged aria-invalid by the validation guard');
            }
            if (state.data.routine['cycle-1'].tasks.length !== 1) {
                throw new Error('whitespace task should not be added');
            }
        } finally {
            document.body.removeChild(taskInput);
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    // AppState is required() on the add path (STATE_TRUTH_MIGRATION #15). Missing wiring
    // used to fall through the guards and return quietly; it must reach addTaskImpl's catch
    // and tell the user the add failed.
    await test('addTaskImpl reports a failure when AppState is not wired', async () => {
        const notes = [];
        const deps = {
            AppState: null,
            showNotification: (msg, type) => notes.push(type),
        };
        setTaskCRUDDependencies(deps);
        await addTaskImpl('test', {}, deps);   // must not throw out — the catch surfaces it
        if (!notes.includes('warning')) {
            throw new Error('no failure notification — the add was skipped silently');
        }
    });

    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
