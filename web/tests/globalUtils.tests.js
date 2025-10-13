/**
 * GlobalUtils Browser Tests
 * Test functions for module-test-suite.html
 */

export function runGlobalUtilsTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🛠️ GlobalUtils Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    function test(name, testFn) {
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
            testFn();
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

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
