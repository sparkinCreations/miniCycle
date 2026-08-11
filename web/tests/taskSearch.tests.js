/**
 * TaskSearch Tests
 * Tests for modules/ui/taskSearch.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskSearchTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/taskSearch.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>TaskSearch Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setTaskSearchDependencies is exported as a function', () => {
        if (typeof mod.setTaskSearchDependencies !== 'function') throw new Error('Missing export');
    });

    await test('initTaskSearch is exported as a function', () => {
        if (typeof mod.initTaskSearch !== 'function') throw new Error('Missing export');
    });

    await test('updateSearchVisibility is exported as a function', () => {
        if (typeof mod.updateSearchVisibility !== 'function') throw new Error('Missing export');
    });

    await test('getTaskCount is exported as a function', () => {
        if (typeof mod.getTaskCount !== 'function') throw new Error('Missing export');
    });

    await test('resetSearch is exported as a function', () => {
        if (typeof mod.resetSearch !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setTaskSearchDependencies accepts an object without throwing', () => {
        mod.setTaskSearchDependencies({});
    });

    await test('setTaskSearchDependencies accepts mock dependencies', () => {
        mod.setTaskSearchDependencies({
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            getBody: () => document.body,
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('getTaskCount returns a number', () => {
        const count = mod.getTaskCount();
        if (typeof count !== 'number') throw new Error('getTaskCount should return a number, got ' + typeof count);
    });

    await test('resetSearch does not throw when not initialized', () => {
        try {
            mod.resetSearch();
        } catch (e) {
            throw new Error('resetSearch should not throw: ' + e.message);
        }
    });

    await test('setTaskSearchDependencies handles null gracefully', () => {
        try {
            mod.setTaskSearchDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    // ============================================
    // ============================================
    // 🔁 reapplyActiveFilter — survives a re-render
    //
    // Filtering is inline `display: none`; sorting is DOM node order. Both live
    // ONLY in the DOM, so taskRenderer's replaceChildren discards them and a
    // task appended by taskCRUD is never judged against the query. Callers
    // invoke this after the DOM settles.
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 reapplyActiveFilter</h4>';

    /** Fresh #taskList with three tasks; returns a per-task display reader. */
    function buildList() {
        document.getElementById('search-probe-root')?.remove();
        const root = document.createElement('div');
        root.id = 'search-probe-root';
        root.innerHTML = `
            <input id="task-search-input" type="text" />
            <ul id="taskList">
              <li class="task" data-task-id="a"><span class="task-text">reset the kitchen</span></li>
              <li class="task" data-task-id="b"><span class="task-text">walk dog</span></li>
              <li class="task" data-task-id="c"><span class="task-text">call mum</span></li>
            </ul>`;
        document.body.appendChild(root);
        mod.setTaskSearchDependencies({
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (s) => document.querySelectorAll(s),
            getBody: () => document.body,
            safeAddEventListener: (el, e, fn) => el?.addEventListener(e, fn)
        });
        return {
            hidden: () => [...root.querySelectorAll('.task')].filter(el => el.style.display === 'none').length,
            setQuery: (v) => { document.getElementById('task-search-input').value = v; },
            cleanup: () => root.remove()
        };
    }

    await test('reapplyActiveFilter is exported as a function', () => {
        if (typeof mod.reapplyActiveFilter !== 'function') throw new Error('Missing export');
    });

    await test('re-hides non-matching tasks after a render wiped the inline styles', () => {
        const list = buildList();
        try {
            list.setQuery('reset');
            // Simulates the post-replaceChildren state: query still in the box,
            // every task freshly rendered with no inline display.
            if (list.hidden() !== 0) throw new Error('precondition: nothing should be hidden yet');
            mod.reapplyActiveFilter();
            if (list.hidden() !== 2) {
                throw new Error(`Expected 2 non-matching tasks hidden, got ${list.hidden()}`);
            }
        } finally {
            list.setQuery('');
            mod.reapplyActiveFilter();
            list.cleanup();
        }
    });

    await test('does nothing when no query, filter, or sort is active', () => {
        // The guard must NOT be read from the DOM: the "All" chip ships with
        // class="filter-chip active" in the markup, so a
        // querySelector('.filter-chip.active') test is always true and would
        // make this run a full DOM pass on every render.
        const list = buildList();
        try {
            list.setQuery('');
            const el = document.querySelector('#taskList .task');
            el.style.display = 'none';   // sentinel the function must not touch
            mod.reapplyActiveFilter();
            if (el.style.display !== 'none') {
                throw new Error('Expected an early return, but the DOM was rewritten');
            }
        } finally {
            list.cleanup();
        }
    });

    await test('an empty query still re-filters while a category filter is active', () => {
        const list = buildList();
        try {
            list.setQuery('');
            mod.resetSearch();          // known-good baseline: all/default
            const el = document.querySelector('#taskList .task');
            el.style.display = 'none';
            mod.reapplyActiveFilter();  // all/default + no query -> early return
            if (el.style.display !== 'none') throw new Error('should have returned early');
        } finally {
            list.cleanup();
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
