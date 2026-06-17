/**
 * TaskDOMPatch Tests
 * Tests for modules/task/taskDOMPatch.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskDOMPatchTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskDOMPatch.js?v=${cacheBuster}`);
    const { TaskDOMPatch } = mod;

    resultsDiv.innerHTML = '<h2>TaskDOMPatch Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── DOM fixture helpers ─────────────────────────────────────────────────
    // Builds a single task element matching the real DOM shape (classes/selectors
    // come from constants.js: .task[data-task-id], .task-text, .priority-btn, etc.)
    const makeTaskEl = (id) => {
        const el = document.createElement('div');
        el.className = 'task';
        el.dataset.taskId = id;
        el.innerHTML = `
            <input type="checkbox">
            <span class="task-text"></span>
            <button class="priority-btn"></button>
            <span class="due-date hidden"></span>
            <button class="recurring-btn"></button>
            <button class="enable-task-reminders"></button>
            <button class="delete-when-complete-btn"></button>
        `;
        return el;
    };

    // Mount a container that IS the taskList (#taskList) so list-level ops work.
    const mountList = (...ids) => {
        const list = document.createElement('div');
        list.id = 'taskList';
        ids.forEach(id => list.appendChild(makeTaskEl(id)));
        document.body.appendChild(list);
        return list;
    };
    const unmount = (el) => { if (el && el.parentNode) el.parentNode.removeChild(el); };

    const make = (deps = {}) => new TaskDOMPatch(deps);

    // ── exports / load checks (kept) ────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('TaskDOMPatch is an exported class with a prototype', () => {
        if (typeof mod.TaskDOMPatch !== 'function') throw new Error('not a class');
        if (!mod.TaskDOMPatch.prototype) throw new Error('no prototype');
    });

    await test('can instantiate with empty deps (optional DI)', () => {
        const p = make();
        if (!p) throw new Error('instance falsy');
    });

    // ── patchTask: guard paths ──────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ patchTask guards</h4>';

    await test('patchTask returns false when element not found', () => {
        const p = make();
        if (p.patchTask('does-not-exist', { text: 'x' }) !== false) {
            throw new Error('expected false for missing element');
        }
    });

    await test('patchTask returns true when element found', () => {
        const list = mountList('t1');
        try {
            const p = make();
            if (p.patchTask('t1', { text: 'Hello' }) !== true) throw new Error('expected true');
        } finally { unmount(list); }
    });

    // ── patchTask: completed ────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✅ completed</h4>';

    await test('completed=true checks the checkbox and adds completed class', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { completed: true }, ['completed']);
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (!el.querySelector('input').checked) throw new Error('checkbox not checked');
            if (!el.classList.contains('completed')) throw new Error('completed class missing');
        } finally { unmount(list); }
    });

    await test('completed=false unchecks and removes completed class', () => {
        const list = mountList('t1');
        try {
            const el = list.querySelector('.task[data-task-id="t1"]');
            el.classList.add('completed');
            el.querySelector('input').checked = true;
            const p = make();
            p.patchTask('t1', { completed: false }, ['completed']);
            if (el.querySelector('input').checked) throw new Error('checkbox still checked');
            if (el.classList.contains('completed')) throw new Error('completed class still present');
        } finally { unmount(list); }
    });

    // ── patchTask: text (XSS-safe via sanitizeInput) ────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📝 text</h4>';

    await test('text patch sets the task label text node', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { text: 'Buy milk' }, ['text']);
            const label = list.querySelector('.task[data-task-id="t1"] .task-text');
            if (label.textContent.trim() !== 'Buy milk') throw new Error('text not set: ' + label.textContent);
        } finally { unmount(list); }
    });

    await test('text patch runs through injected sanitizeInput', () => {
        const list = mountList('t1');
        try {
            let received = null;
            const p = make({ sanitizeInput: (s) => { received = s; return s.replace(/</g, ''); } });
            p.patchTask('t1', { text: '<script>x' }, ['text']);
            if (received !== '<script>x') throw new Error('sanitizeInput not invoked with raw text');
            const label = list.querySelector('.task[data-task-id="t1"] .task-text');
            if (label.textContent.includes('<')) throw new Error('sanitized output not used');
        } finally { unmount(list); }
    });

    await test('text patch preserves existing child elements (e.g. recurring icon)', () => {
        const list = mountList('t1');
        try {
            const label = list.querySelector('.task[data-task-id="t1"] .task-text');
            const icon = document.createElement('span');
            icon.className = 'recurring-indicator';
            label.appendChild(icon);
            const p = make();
            p.patchTask('t1', { text: 'Renamed' }, ['text']);
            if (!label.querySelector('.recurring-indicator')) throw new Error('child icon lost');
            if (!label.textContent.includes('Renamed')) throw new Error('text not applied');
        } finally { unmount(list); }
    });

    // ── patchTask: high priority + color ────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔴 high priority</h4>';

    await test('highPriority=true sets class, css var, and aria-pressed', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { highPriority: true, priorityColor: '#ff0000' }, ['highPriority']);
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (!el.classList.contains('high-priority')) throw new Error('high-priority class missing');
            if (el.style.getPropertyValue('--task-priority-color') !== '#ff0000') throw new Error('css var not set');
            const btn = el.querySelector('.priority-btn');
            if (btn.getAttribute('aria-pressed') !== 'true') throw new Error('aria-pressed wrong');
            if (!btn.classList.contains('priority-active')) throw new Error('priority-active missing');
        } finally { unmount(list); }
    });

    await test('highPriority without color falls back to COLORS.PRIORITY_DEFAULT (#dc3545)', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { highPriority: true }, ['highPriority']);
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (el.style.getPropertyValue('--task-priority-color') !== '#dc3545') {
                throw new Error('default color fallback wrong: ' + el.style.getPropertyValue('--task-priority-color'));
            }
        } finally { unmount(list); }
    });

    await test('highPriority=false removes class and css var', () => {
        const list = mountList('t1');
        try {
            const el = list.querySelector('.task[data-task-id="t1"]');
            el.classList.add('high-priority');
            el.style.setProperty('--task-priority-color', '#abc');
            const p = make();
            p.patchTask('t1', { highPriority: false }, ['highPriority']);
            if (el.classList.contains('high-priority')) throw new Error('class not removed');
            if (el.style.getPropertyValue('--task-priority-color') !== '') throw new Error('css var not removed');
        } finally { unmount(list); }
    });

    await test('priorityColor-only patch updates var when highPriority truthy', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { highPriority: true, priorityColor: '#123456' }, ['priorityColor']);
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (el.style.getPropertyValue('--task-priority-color') !== '#123456') throw new Error('color not applied');
        } finally { unmount(list); }
    });

    // ── patchTask: due date ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📅 due date</h4>';

    await test('dueDate set: shows formatted date and removes hidden class', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { dueDate: '2025-01-15' }, ['dueDate']);
            const span = list.querySelector('.task[data-task-id="t1"] .due-date');
            if (span.classList.contains('hidden')) throw new Error('still hidden');
            if (!span.textContent) throw new Error('no date text rendered');
        } finally { unmount(list); }
    });

    await test('dueDate cleared: empties text and adds hidden class', () => {
        const list = mountList('t1');
        try {
            const span = list.querySelector('.task[data-task-id="t1"] .due-date');
            span.classList.remove('hidden');
            span.textContent = '1/1/2025';
            const p = make();
            p.patchTask('t1', { dueDate: null }, ['dueDate']);
            if (!span.classList.contains('hidden')) throw new Error('not hidden');
            if (span.textContent !== '') throw new Error('text not cleared');
        } finally { unmount(list); }
    });

    // ── patchTask: recurring (icon add/remove) ──────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 recurring</h4>';

    await test('recurring=true adds class, sets aria, injects indicator icon', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { recurring: true }, ['recurring']);
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (!el.classList.contains('recurring')) throw new Error('recurring class missing');
            if (el.querySelector('.recurring-btn').getAttribute('aria-pressed') !== 'true') throw new Error('aria wrong');
            if (!el.querySelector('.task-text .recurring-indicator')) throw new Error('indicator icon not added');
        } finally { unmount(list); }
    });

    await test('recurring=false removes the indicator icon if present', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { recurring: true }, ['recurring']);   // add
            p.patchTask('t1', { recurring: false }, ['recurring']);  // remove
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (el.querySelector('.recurring-indicator')) throw new Error('indicator not removed');
            if (el.classList.contains('recurring')) throw new Error('recurring class not removed');
        } finally { unmount(list); }
    });

    await test('recurring=true twice does not duplicate the indicator', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { recurring: true }, ['recurring']);
            p.patchTask('t1', { recurring: true }, ['recurring']);
            const icons = list.querySelectorAll('.task[data-task-id="t1"] .recurring-indicator');
            if (icons.length !== 1) throw new Error('duplicate indicators: ' + icons.length);
        } finally { unmount(list); }
    });

    // ── patchTask: reminders ────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔔 reminders</h4>';

    await test('remindersEnabled toggles reminder-active class + aria-pressed', () => {
        const list = mountList('t1');
        try {
            const p = make();
            p.patchTask('t1', { remindersEnabled: true }, ['remindersEnabled']);
            const btn = list.querySelector('.task[data-task-id="t1"] .enable-task-reminders');
            if (!btn.classList.contains('reminder-active')) throw new Error('class missing');
            if (btn.getAttribute('aria-pressed') !== 'true') throw new Error('aria wrong');
        } finally { unmount(list); }
    });

    // ── patchTask: deleteWhenComplete (uses AppState) ───────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗑️ deleteWhenComplete</h4>';

    await test('deleteWhenComplete sets dataset + button state (cycle mode shows indicator)', () => {
        const list = mountList('t1');
        try {
            const AppState = { get: () => ({
                appState: { activeCycleId: 'c1' },
                data: { cycles: { c1: { deleteCheckedTasks: false } } } // cycle mode
            }) };
            const p = make({ AppState });
            p.patchTask('t1', { deleteWhenComplete: true, recurring: false }, ['deleteWhenComplete']);
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (el.dataset.deleteWhenComplete !== 'true') throw new Error('dataset wrong');
            if (!el.classList.contains('show-delete-indicator')) throw new Error('indicator class missing in cycle mode');
            const btn = el.querySelector('.delete-when-complete-btn');
            if (btn.getAttribute('aria-pressed') !== 'true') throw new Error('aria wrong');
        } finally { unmount(list); }
    });

    await test('deleteWhenComplete in to-do mode marks kept-task instead of indicator', () => {
        const list = mountList('t1');
        try {
            const AppState = { get: () => ({
                appState: { activeCycleId: 'c1' },
                data: { cycles: { c1: { deleteCheckedTasks: true } } } // to-do mode
            }) };
            const p = make({ AppState });
            // not active + not recurring + to-do mode -> kept-task class added (!isActive)
            p.patchTask('t1', { deleteWhenComplete: false, recurring: false }, ['deleteWhenComplete']);
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (!el.classList.contains('kept-task')) throw new Error('kept-task not applied in to-do mode');
            if (el.classList.contains('show-delete-indicator')) throw new Error('should not show delete indicator in to-do mode');
        } finally { unmount(list); }
    });

    // ── default fields (no changedFields) ───────────────────────────────────
    await test('patchTask with no changedFields patches the default field set', () => {
        const list = mountList('t1');
        try {
            const p = make();
            const ok = p.patchTask('t1', { completed: true, text: 'Multi', highPriority: true });
            if (!ok) throw new Error('returned false');
            const el = list.querySelector('.task[data-task-id="t1"]');
            if (!el.classList.contains('completed')) throw new Error('completed not patched');
            if (!el.classList.contains('high-priority')) throw new Error('priority not patched');
            if (!el.querySelector('.task-text').textContent.includes('Multi')) throw new Error('text not patched');
        } finally { unmount(list); }
    });

    // ── removeTask ──────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 removeTask</h4>';

    await test('removeTask removes element and returns true', () => {
        const list = mountList('t1', 't2');
        try {
            const p = make();
            if (p.removeTask('t1') !== true) throw new Error('expected true');
            if (list.querySelector('.task[data-task-id="t1"]')) throw new Error('element still present');
            if (!list.querySelector('.task[data-task-id="t2"]')) throw new Error('removed wrong element');
        } finally { unmount(list); }
    });

    await test('removeTask returns false for missing element', () => {
        const p = make();
        if (p.removeTask('nope') !== false) throw new Error('expected false');
    });

    // ── applyTaskOrder ──────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">↕️ applyTaskOrder</h4>';

    await test('applyTaskOrder reorders DOM children to match given order', () => {
        const list = mountList('a', 'b', 'c');
        try {
            const p = make();
            const ok = p.applyTaskOrder(['c', 'a', 'b']);
            if (!ok) throw new Error('returned false');
            const order = Array.from(list.children).map(el => el.dataset.taskId);
            if (order.join(',') !== 'c,a,b') throw new Error('order wrong: ' + order.join(','));
        } finally { unmount(list); }
    });

    await test('applyTaskOrder returns false when taskList missing', () => {
        const p = make(); // no #taskList in DOM (mountList not called)
        if (p.applyTaskOrder(['a']) !== false) throw new Error('expected false without taskList');
    });

    // ── syncBoundaryMarkers ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🚧 syncBoundaryMarkers</h4>';

    await test('marks first + last incomplete tasks', () => {
        const list = mountList('a', 'b', 'c');
        try {
            const p = make();
            p.syncBoundaryMarkers();
            const a = list.querySelector('.task[data-task-id="a"]');
            const c = list.querySelector('.task[data-task-id="c"]');
            if (!a.classList.contains('is-first-task')) throw new Error('first not marked');
            if (!c.classList.contains('is-last-task')) throw new Error('last not marked');
        } finally { unmount(list); }
    });

    await test('single incomplete task gets first marker but NOT last', () => {
        const list = mountList('only');
        try {
            const p = make();
            p.syncBoundaryMarkers();
            const el = list.querySelector('.task[data-task-id="only"]');
            if (!el.classList.contains('is-first-task')) throw new Error('first not marked');
            if (el.classList.contains('is-last-task')) throw new Error('single task should not be last');
        } finally { unmount(list); }
    });

    await test('completed tasks are skipped when choosing boundaries', () => {
        const list = mountList('a', 'b', 'c');
        try {
            // mark 'a' completed via checked checkbox (selector: .task input:checked)
            list.querySelector('.task[data-task-id="a"] input').checked = true;
            const p = make();
            p.syncBoundaryMarkers();
            // first incomplete is 'b', last is 'c'
            if (!list.querySelector('.task[data-task-id="b"]').classList.contains('is-first-task')) {
                throw new Error('b should be first incomplete');
            }
            if (list.querySelector('.task[data-task-id="a"]').classList.contains('is-first-task')) {
                throw new Error('completed task a should not be first');
            }
        } finally { unmount(list); }
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
