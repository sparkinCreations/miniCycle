/**
 * GlobalUtils Browser Tests
 * Test functions for module-test-suite.html
 */

export function runGlobalUtilsTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🛠️ GlobalUtils Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    async function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });

        try {
            // Await async test bodies so their assertions are observed: a floating
            // promise would report ✅ before the body runs (see the menuManager fix).
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ===== MODULE LOADING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    test('GlobalUtils class is defined', () => {
        if (typeof GlobalUtils === 'undefined') {
            throw new Error('GlobalUtils class not found');
        }
    });

    test('Global functions are exported', () => {
        const requiredFunctions = [
            'safeAddEventListener',
            'safeGetElementById',
            'debounce',
            'throttle',
            'generateId'
        ];
        for (const func of requiredFunctions) {
            if (typeof window[func] !== 'function') {
                throw new Error(`${func} not found on window`);
            }
        }
    });

    test('getModuleInfo returns correct structure', () => {
        const info = GlobalUtils.getModuleInfo();
        if (!info.version || !info.name || typeof info.functionsCount !== 'number') {
            throw new Error('Module info incomplete');
        }
        if (info.name !== 'GlobalUtils') {
            throw new Error('Incorrect module name');
        }
    });

    // ===== ELEMENT SELECTION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Element Selection</h4>';

    test('safeGetElementById finds existing element', () => {
        const element = GlobalUtils.safeGetElementById('test-element', false);
        if (!element || element.id !== 'test-element') {
            throw new Error('Failed to find element');
        }
    });

    test('safeGetElementById returns null for missing element', () => {
        const element = GlobalUtils.safeGetElementById('nonexistent-element', false);
        if (element !== null) {
            throw new Error('Should return null for missing element');
        }
    });

    test('safeQuerySelectorAll finds multiple elements', () => {
        const elements = GlobalUtils.safeQuerySelectorAll('.selector-test', false);
        if (elements.length !== 3) {
            throw new Error(`Expected 3 elements, found ${elements.length}`);
        }
    });

    test('safeQuerySelectorAll returns empty NodeList for missing selector', () => {
        const elements = GlobalUtils.safeQuerySelectorAll('.nonexistent-class', false);
        if (elements.length !== 0) {
            throw new Error('Should return empty NodeList');
        }
    });

    // ===== EVENT LISTENER TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">👂 Event Listeners</h4>';

    test('safeAddEventListener adds event listener', () => {
        const element = document.getElementById('test-element');
        let called = false;
        const handler = () => { called = true; };

        GlobalUtils.safeAddEventListener(element, 'click', handler);
        element.click();

        if (!called) {
            throw new Error('Event listener was not called');
        }
    });

    test('safeAddEventListener handles null element', () => {
        GlobalUtils.safeAddEventListener(null, 'click', () => {});
        // Should not throw
    });

    test('safeAddEventListener removes old listener', () => {
        const element = document.getElementById('test-element');
        let callCount = 0;
        const handler = () => { callCount++; };

        GlobalUtils.safeAddEventListener(element, 'click', handler);
        GlobalUtils.safeAddEventListener(element, 'click', handler);
        element.click();

        if (callCount !== 1) {
            throw new Error(`Should only call once, called ${callCount} times`);
        }
    });

    test('safeAddEventListenerById adds event listener', () => {
        const element = document.getElementById('test-element-2');
        let called = false;
        const handler = () => { called = true; };

        GlobalUtils.safeAddEventListenerById('test-element-2', 'click', handler);
        element.click();

        if (!called) {
            throw new Error('Event listener was not called');
        }
    });

    test('safeAddEventListenerBySelector adds to multiple elements', () => {
        let callCount = 0;
        const handler = () => { callCount++; };

        GlobalUtils.safeAddEventListenerBySelector('.selector-test', 'click', handler);
        document.querySelectorAll('.selector-test').forEach(el => el.click());

        if (callCount !== 3) {
            throw new Error(`Expected 3 calls, got ${callCount}`);
        }
    });

    test('safeRemoveEventListener removes event listener', () => {
        const element = document.getElementById('test-element');
        let callCount = 0;
        const handler = () => { callCount++; };

        GlobalUtils.safeAddEventListener(element, 'click', handler);
        element.click();

        GlobalUtils.safeRemoveEventListener(element, 'click', handler);
        element.click();

        if (callCount !== 1) {
            throw new Error(`Expected 1 call, got ${callCount}`);
        }
    });

    test('safeRemoveEventListenerById removes listener', () => {
        const element = document.getElementById('test-element-2');
        let callCount = 0;
        const handler = () => { callCount++; };

        GlobalUtils.safeAddEventListenerById('test-element-2', 'click', handler);
        element.click();

        GlobalUtils.safeRemoveEventListenerById('test-element-2', 'click', handler);
        element.click();

        if (callCount !== 1) {
            throw new Error(`Expected 1 call, got ${callCount}`);
        }
    });

    // ===== CONTENT MANIPULATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">📝 Content Manipulation</h4>';

    test('safeSetInnerHTML sets HTML with element', () => {
        const element = document.getElementById('test-element');
        const success = GlobalUtils.safeSetInnerHTML(element, '<span>New HTML</span>');

        if (!success || element.innerHTML !== '<span>New HTML</span>') {
            throw new Error('Failed to set innerHTML');
        }
    });

    test('safeSetInnerHTML sets HTML with ID', () => {
        const success = GlobalUtils.safeSetInnerHTML('test-element-2', '<span>ID HTML</span>');
        const element = document.getElementById('test-element-2');

        if (!success || element.innerHTML !== '<span>ID HTML</span>') {
            throw new Error('Failed to set innerHTML by ID');
        }
    });

    test('safeSetInnerHTML returns false for missing element', () => {
        const success = GlobalUtils.safeSetInnerHTML('nonexistent', '<span>Test</span>');

        if (success !== false) {
            throw new Error('Should return false for missing element');
        }
    });

    test('safeSetTextContent sets text with element', () => {
        const element = document.getElementById('test-element');
        const success = GlobalUtils.safeSetTextContent(element, 'Plain text');

        if (!success || element.textContent !== 'Plain text') {
            throw new Error('Failed to set textContent');
        }
    });

    test('safeSetTextContent sets text with ID', () => {
        const success = GlobalUtils.safeSetTextContent('test-element-2', 'ID text');
        const element = document.getElementById('test-element-2');

        if (!success || element.textContent !== 'ID text') {
            throw new Error('Failed to set textContent by ID');
        }
    });

    test('safeSetTextContent returns false for missing element', () => {
        const success = GlobalUtils.safeSetTextContent('nonexistent', 'text');

        if (success !== false) {
            throw new Error('Should return false for missing element');
        }
    });

    // ===== CSS CLASS MANIPULATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 CSS Classes</h4>';

    test('safeAddClass adds CSS class', () => {
        const element = document.getElementById('test-element');
        element.className = '';

        const success = GlobalUtils.safeAddClass(element, 'new-class');

        if (!success || !element.classList.contains('new-class')) {
            throw new Error('Failed to add class');
        }
    });

    test('safeAddClass works with element ID', () => {
        const element = document.getElementById('test-element-2');
        element.className = '';

        const success = GlobalUtils.safeAddClass('test-element-2', 'id-class');

        if (!success || !element.classList.contains('id-class')) {
            throw new Error('Failed to add class by ID');
        }
    });

    test('safeRemoveClass removes CSS class', () => {
        const element = document.getElementById('test-element');
        element.className = 'remove-me';

        const success = GlobalUtils.safeRemoveClass(element, 'remove-me');

        if (!success || element.classList.contains('remove-me')) {
            throw new Error('Failed to remove class');
        }
    });

    test('safeRemoveClass works with element ID', () => {
        const element = document.getElementById('test-element-2');
        element.className = 'remove-id';

        const success = GlobalUtils.safeRemoveClass('test-element-2', 'remove-id');

        if (!success || element.classList.contains('remove-id')) {
            throw new Error('Failed to remove class by ID');
        }
    });

    test('safeToggleClass toggles CSS class', () => {
        const element = document.getElementById('test-element');
        element.className = '';

        GlobalUtils.safeToggleClass(element, 'toggle-class');
        const hasClass = element.classList.contains('toggle-class');

        GlobalUtils.safeToggleClass(element, 'toggle-class');
        const noClass = !element.classList.contains('toggle-class');

        if (!hasClass || !noClass) {
            throw new Error('Failed to toggle class');
        }
    });

    test('safeToggleClass with force parameter', () => {
        const element = document.getElementById('test-element');
        element.className = '';

        GlobalUtils.safeToggleClass(element, 'forced-class', true);
        const hasClass = element.classList.contains('forced-class');

        GlobalUtils.safeToggleClass(element, 'forced-class', true);
        const stillHasClass = element.classList.contains('forced-class');

        if (!hasClass || !stillHasClass) {
            throw new Error('Failed to force toggle class');
        }
    });

    test('safeToggleClass works with element ID', () => {
        const element = document.getElementById('test-element-2');
        element.className = '';

        const result = GlobalUtils.safeToggleClass('test-element-2', 'id-toggle');

        if (!result || !element.classList.contains('id-toggle')) {
            throw new Error('Failed to toggle class by ID');
        }
    });

    test('Class manipulation returns false for missing element', () => {
        const addResult = GlobalUtils.safeAddClass('nonexistent', 'class');
        const removeResult = GlobalUtils.safeRemoveClass('nonexistent', 'class');
        const toggleResult = GlobalUtils.safeToggleClass('nonexistent', 'class');

        if (addResult !== false || removeResult !== false || toggleResult !== false) {
            throw new Error('Should return false for missing elements');
        }
    });

    // ===== PERFORMANCE UTILITY TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Performance</h4>';

    test('debounce delays function execution', () => {
        let called = false;
        const debouncedFn = GlobalUtils.debounce(() => { called = true; }, 50);

        debouncedFn();

        if (called) {
            throw new Error('Function should not be called immediately');
        }
    });

    test('throttle limits function calls', () => {
        let callCount = 0;
        const throttledFn = GlobalUtils.throttle(() => { callCount++; }, 100);

        throttledFn();
        throttledFn();
        throttledFn();

        if (callCount !== 1) {
            throw new Error(`Expected 1 call, got ${callCount}`);
        }
    });

    test('debounce with immediate executes immediately', () => {
        let called = false;
        const debouncedFn = GlobalUtils.debounce(() => { called = true; }, 50, true);

        debouncedFn();

        if (!called) {
            throw new Error('Function should be called immediately with immediate=true');
        }
    });

    // ===== UTILITY FUNCTION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Utilities</h4>';

    test('generateId creates unique IDs', () => {
        const id1 = GlobalUtils.generateId();
        const id2 = GlobalUtils.generateId();

        if (id1 === id2) {
            throw new Error('IDs should be unique');
        }
        if (!id1.startsWith('id-')) {
            throw new Error('Default prefix should be "id-"');
        }
    });

    test('generateId respects custom prefix', () => {
        const id = GlobalUtils.generateId('custom');

        if (!id.startsWith('custom-')) {
            throw new Error('Custom prefix not applied');
        }
    });

    test('generateId creates valid ID format', () => {
        const id = GlobalUtils.generateId('test');
        const pattern = /^test-\d+-[a-z0-9]+$/;

        if (!pattern.test(id)) {
            throw new Error('ID format is invalid');
        }
    });

    test('isElementInViewport detects visible elements', () => {
        const element = document.getElementById('test-element');
        const isVisible = GlobalUtils.isElementInViewport(element);

        if (typeof isVisible !== 'boolean') {
            throw new Error('Should return boolean');
        }
    });

    test('isElementInViewport handles null element', () => {
        const isVisible = GlobalUtils.isElementInViewport(null);

        if (isVisible !== false) {
            throw new Error('Should return false for null element');
        }
    });

    // ===== syncAllTasksWithMode: DOM invariant healing =====
    resultsDiv.innerHTML += '<h4 class="test-section">🩹 syncAllTasksWithMode DOM Healing</h4>';

    function buildSyncDOM() {
        document.getElementById('test-sync-dom')?.remove();
        const container = document.createElement('div');
        container.id = 'test-sync-dom';
        container.innerHTML = `<ul id="taskList"></ul><ul id="completedTaskList"></ul>`;
        document.body.appendChild(container);
        return container;
    }
    function makeTaskEl(taskId) {
        const li = document.createElement('li');
        li.className = 'task';
        li.dataset.taskId = taskId;
        return li;
    }
    const SYNC_CONSTANTS = { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: { todo: true, cycle: false } };

    test('syncAllTasksWithMode removes orphaned DOM nodes (DOM without data)', () => {
        const container = buildSyncDOM();
        try {
            const taskList = container.querySelector('#taskList');
            taskList.appendChild(makeTaskEl('real'));
            taskList.appendChild(makeTaskEl('ghost')); // no matching data
            GlobalUtils.syncAllTasksWithMode('cycle', { real: { id: 'real' } }, SYNC_CONSTANTS);
            if (taskList.querySelectorAll('.task').length !== 1) {
                throw new Error(`Expected 1 task after orphan removal, got ${taskList.querySelectorAll('.task').length}`);
            }
            if (taskList.querySelector('[data-task-id="ghost"]')) {
                throw new Error('Orphaned node should have been removed');
            }
        } finally {
            container.remove();
        }
    });

    test('syncAllTasksWithMode removes duplicate-id nodes across lists (data with two nodes)', () => {
        const container = buildSyncDOM();
        try {
            const taskList = container.querySelector('#taskList');
            const completedList = container.querySelector('#completedTaskList');
            // Canonical fresh node in active list, stale duplicate sitting in completed list.
            taskList.appendChild(makeTaskEl('dup'));
            completedList.appendChild(makeTaskEl('dup'));
            GlobalUtils.syncAllTasksWithMode('cycle', { dup: { id: 'dup' } }, SYNC_CONSTANTS);
            const total = container.querySelectorAll('[data-task-id="dup"]').length;
            if (total !== 1) {
                throw new Error(`Expected exactly 1 node for id "dup", got ${total}`);
            }
            // Active list is canonical (iterated first) — its node is the one kept.
            if (!taskList.querySelector('[data-task-id="dup"]')) {
                throw new Error('The active-list (canonical) node should be the one kept');
            }
            if (completedList.querySelector('[data-task-id="dup"]')) {
                throw new Error('The stale completed-list duplicate should have been removed');
            }
        } finally {
            container.remove();
        }
    });

    // ===== normalizeText — text normalization, NOT XSS escaping =====
    resultsDiv.innerHTML += '<h4 class="test-section">🧼 normalizeText (normalize, not escape)</h4>';

    // Tests the REAL implementation (no mock). Guards the documented contract:
    // normalizeText trims + length-clamps only. It does NOT HTML-escape — the app
    // escapes at the render sink instead (textContent / escapeHtml). If someone
    // "fixes" this to escape at input time, this test fails loudly and points
    // them at the sink (input-time escaping double-encodes shared .mcyc data).
    test('normalizeText passes HTML through unchanged (does NOT escape)', () => {
        const payload = '<img src=x onerror="alert(1)">';
        const out = GlobalUtils.normalizeText(payload, 500);
        if (out !== payload) {
            throw new Error(`normalizeText must not alter HTML — expected unchanged, got: ${out}`);
        }
    });

    test('normalizeText trims, clamps length, and rejects non-strings', () => {
        if (GlobalUtils.normalizeText('  hello  ') !== 'hello') {
            throw new Error('should trim surrounding whitespace');
        }
        if (GlobalUtils.normalizeText('abcdef', 3) !== 'abc') {
            throw new Error('should clamp to maxLength');
        }
        if (GlobalUtils.normalizeText(42) !== '') {
            throw new Error('non-strings should return empty string');
        }
    });

    test('sanitizeInput is a deprecated alias of normalizeText', () => {
        const payload = '  <b>Trim & clamp me</b>  ';
        // Alias must forward correctly even when called unbound (it's injected as
        // the sanitizeInput CORE_DEP, so `this` is not GlobalUtils at call time).
        const alias = GlobalUtils.sanitizeInput;
        if (alias(payload, 10) !== GlobalUtils.normalizeText(payload, 10)) {
            throw new Error('sanitizeInput alias must match normalizeText output (even unbound)');
        }
    });

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
