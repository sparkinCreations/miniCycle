/**
 * DataValidator Tests
 * Tests for modules/utils/dataValidator.js
 *
 * Tests data validation functionality:
 * - Module loading and exports
 * - Dependency injection (sanitizeInput)
 * - Cycle name validation
 * - Task text validation
 * - Cycle data validation
 * - Task object validation
 * - Imported data validation
 * - Error handling
 */

import {
    setupTestEnvironment,
    createMockData,
    createMockSanitizeInput
} from './testHelpers.js';

import {
    setDataValidatorDependencies,
    DataValidator
} from '../modules/utils/dataValidator.js';

export async function runDataValidatorTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>DataValidator Tests</h2><h3>Setting up mocks...</h3>';

    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>DataValidator Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // Save real app data
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
    }

    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // Canonical faithful mock from testHelpers (trim + clamp, like normalizeText —
    // it never escapes or strips; escaping happens at the render sink). Shared so
    // this file can't drift back into the over-capable-mock fiction the Round 2
    // audit removed. DataValidator always passes explicit maxLength (100/500),
    // so the helper's default clamp is never in play here.
    const mockSanitizeInput = createMockSanitizeInput();

    async function test(name, testFn) {
        total.count++;
        try {
            localStorage.clear();
            const mockSchemaData = createMockData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === MODULE LOADING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setDataValidatorDependencies function exists', () => {
        if (typeof setDataValidatorDependencies !== 'function') {
            throw new Error('setDataValidatorDependencies not exported');
        }
    });

    await test('DataValidator class exists', () => {
        if (!DataValidator) {
            throw new Error('DataValidator class not exported');
        }
    });

    await test('DataValidator has validateCycleName method', () => {
        if (typeof DataValidator.validateCycleName !== 'function') {
            throw new Error('validateCycleName not a function');
        }
    });

    await test('DataValidator has validateTaskText method', () => {
        if (typeof DataValidator.validateTaskText !== 'function') {
            throw new Error('validateTaskText not a function');
        }
    });

    await test('DataValidator has validateCycleData method', () => {
        if (typeof DataValidator.validateCycleData !== 'function') {
            throw new Error('validateCycleData not a function');
        }
    });

    await test('DataValidator has validateTask method', () => {
        if (typeof DataValidator.validateTask !== 'function') {
            throw new Error('validateTask not a function');
        }
    });

    await test('DataValidator has validateImportedData method', () => {
        if (typeof DataValidator.validateImportedData !== 'function') {
            throw new Error('validateImportedData not a function');
        }
    });

    // === DEPENDENCY INJECTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💉 Dependency Injection</h4>';

    await test('setDataValidatorDependencies accepts sanitizeInput', () => {
        setDataValidatorDependencies({
            sanitizeInput: mockSanitizeInput
        });
    });

    await test('DataValidator throws when used without sanitizeInput dependency', () => {
        // DI system logs warning on setDependencies, but throws on resolve() in strict mode
        // Explicitly set sanitizeInput to undefined (since DI merges, not replaces)
        setDataValidatorDependencies({ sanitizeInput: undefined });

        // The throw happens when we try to USE the validator
        let threw = false;
        try {
            DataValidator.validateCycleName('Test');
        } catch (error) {
            threw = true;
            if (!error.message.includes('sanitizeInput')) {
                throw new Error('Should mention sanitizeInput in error');
            }
        }
        if (!threw) {
            throw new Error('Should throw when sanitizeInput not injected');
        }
    });

    await test('DataValidator throws when sanitizeInput is not a function', () => {
        // Set a non-function sanitizeInput
        setDataValidatorDependencies({
            sanitizeInput: 'not a function'
        });

        // The throw happens when we try to call it
        let threw = false;
        try {
            DataValidator.validateCycleName('Test');
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw when sanitizeInput is not callable');
        }
    });

    // Set up dependencies for remaining tests
    setDataValidatorDependencies({
        sanitizeInput: mockSanitizeInput
    });

    // === CYCLE NAME VALIDATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Cycle Name Validation</h4>';

    await test('validateCycleName accepts valid name', () => {
        const result = DataValidator.validateCycleName('My Cycle');
        if (result !== 'My Cycle') {
            throw new Error('Should return the name unchanged');
        }
    });

    await test('validateCycleName throws for non-string', () => {
        let threw = false;
        try {
            DataValidator.validateCycleName(123);
        } catch (error) {
            threw = true;
            if (!(error instanceof TypeError)) {
                throw new Error('Should throw TypeError');
            }
        }
        if (!threw) {
            throw new Error('Should throw for non-string');
        }
    });

    await test('validateCycleName throws for empty string', () => {
        let threw = false;
        try {
            DataValidator.validateCycleName('   ');
        } catch (error) {
            threw = true;
            if (!error.message.includes('empty')) {
                throw new Error('Should mention empty in error');
            }
        }
        if (!threw) {
            throw new Error('Should throw for empty string');
        }
    });

    await test('validateCycleName throws for too long name', () => {
        let threw = false;
        try {
            DataValidator.validateCycleName('a'.repeat(101));
        } catch (error) {
            threw = true;
            if (!error.message.includes('100')) {
                throw new Error('Should mention max length');
            }
        }
        if (!threw) {
            throw new Error('Should throw for name over 100 chars');
        }
    });

    await test('validateCycleName passes HTML through unchanged (escaping happens at render)', () => {
        // The sanitizer is normalizeText: trim + clamp ONLY. It never escapes or
        // strips — XSS protection lives at the render sink (textContent), and
        // taskDOMPatch.tests.js asserts that sink. This pins the pass-through so
        // an "improved" over-capable mock can't sneak the old fiction back in.
        const payload = '<script>alert(1)</script>';
        const result = DataValidator.validateCycleName(payload);
        if (result !== payload) {
            throw new Error(`expected pass-through, got '${result}'`);
        }
    });

    await test('validateCycleName accepts max length name', () => {
        const name = 'a'.repeat(100);
        const result = DataValidator.validateCycleName(name);
        if (result.length !== 100) {
            throw new Error('Should accept 100 char name');
        }
    });

    // === TASK TEXT VALIDATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Task Text Validation</h4>';

    await test('validateTaskText accepts valid text', () => {
        const result = DataValidator.validateTaskText('Complete task');
        if (result !== 'Complete task') {
            throw new Error('Should return text unchanged');
        }
    });

    await test('validateTaskText throws for non-string', () => {
        let threw = false;
        try {
            DataValidator.validateTaskText({ text: 'hello' });
        } catch (error) {
            threw = true;
            if (!(error instanceof TypeError)) {
                throw new Error('Should throw TypeError');
            }
        }
        if (!threw) {
            throw new Error('Should throw for non-string');
        }
    });

    await test('validateTaskText throws for empty string', () => {
        let threw = false;
        try {
            DataValidator.validateTaskText('');
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for empty string');
        }
    });

    await test('validateTaskText throws for too long text', () => {
        let threw = false;
        try {
            DataValidator.validateTaskText('a'.repeat(501));
        } catch (error) {
            threw = true;
            if (!error.message.includes('500')) {
                throw new Error('Should mention max length');
            }
        }
        if (!threw) {
            throw new Error('Should throw for text over 500 chars');
        }
    });

    await test('validateTaskText passes HTML through unchanged (escaping happens at render)', () => {
        // Same contract as validateCycleName above: trim + clamp, no escaping.
        const payload = '<img src=x onerror=alert(1)>';
        const result = DataValidator.validateTaskText(payload);
        if (result !== payload) {
            throw new Error(`expected pass-through, got '${result}'`);
        }
    });

    await test('validateTaskText accepts max length text', () => {
        const text = 'a'.repeat(500);
        const result = DataValidator.validateTaskText(text);
        if (result.length !== 500) {
            throw new Error('Should accept 500 char text');
        }
    });

    // === TASK OBJECT VALIDATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Task Object Validation</h4>';

    await test('validateTask accepts valid task', () => {
        const task = {
            id: 'task-123',
            text: 'Complete something',
            completed: false
        };
        const result = DataValidator.validateTask(task);
        if (result.id !== 'task-123') {
            throw new Error('Should preserve task ID');
        }
    });

    await test('validateTask throws for non-object', () => {
        let threw = false;
        try {
            DataValidator.validateTask('not an object');
        } catch (error) {
            threw = true;
            if (!(error instanceof TypeError)) {
                throw new Error('Should throw TypeError');
            }
        }
        if (!threw) {
            throw new Error('Should throw for non-object');
        }
    });

    await test('validateTask throws for null', () => {
        let threw = false;
        try {
            DataValidator.validateTask(null);
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for null');
        }
    });

    await test('validateTask throws for missing id', () => {
        let threw = false;
        try {
            DataValidator.validateTask({ text: 'Hello' });
        } catch (error) {
            threw = true;
            if (!error.message.includes('ID')) {
                throw new Error('Should mention ID');
            }
        }
        if (!threw) {
            throw new Error('Should throw for missing id');
        }
    });

    await test('validateTask throws for non-string id', () => {
        let threw = false;
        try {
            DataValidator.validateTask({ id: 123, text: 'Hello' });
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for non-string id');
        }
    });

    await test('validateTask throws for missing text', () => {
        let threw = false;
        try {
            DataValidator.validateTask({ id: 'task-1' });
        } catch (error) {
            threw = true;
            if (!error.message.includes('text')) {
                throw new Error('Should mention text');
            }
        }
        if (!threw) {
            throw new Error('Should throw for missing text');
        }
    });

    await test('validateTask throws for non-boolean completed', () => {
        let threw = false;
        try {
            DataValidator.validateTask({
                id: 'task-1',
                text: 'Hello',
                completed: 'yes'
            });
        } catch (error) {
            threw = true;
            if (!(error instanceof TypeError)) {
                throw new Error('Should throw TypeError');
            }
        }
        if (!threw) {
            throw new Error('Should throw for non-boolean completed');
        }
    });

    await test('validateTask throws for non-boolean highPriority', () => {
        let threw = false;
        try {
            DataValidator.validateTask({
                id: 'task-1',
                text: 'Hello',
                highPriority: 1
            });
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for non-boolean highPriority');
        }
    });

    await test('validateTask converts numeric dueDate to ISO string', () => {
        const task = {
            id: 'task-1',
            text: 'Hello',
            dueDate: Date.now()
        };
        const result = DataValidator.validateTask(task);
        // Validator converts numeric timestamp to ISO date string (YYYY-MM-DD)
        if (typeof result.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(result.dueDate)) {
            throw new Error('dueDate should be converted to ISO date string');
        }
    });

    await test('validateTask accepts null dueDate', () => {
        const task = {
            id: 'task-1',
            text: 'Hello',
            dueDate: null
        };
        const result = DataValidator.validateTask(task);
        if (result.dueDate !== null) {
            throw new Error('Should accept null dueDate');
        }
    });

    await test('validateTask throws for invalid dueDate', () => {
        let threw = false;
        try {
            DataValidator.validateTask({
                id: 'task-1',
                text: 'Hello',
                dueDate: 'tomorrow'
            });
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for invalid dueDate');
        }
    });

    await test('validateTask runs text through the sanitizer (trim, no escaping)', () => {
        // Whitespace proves the sanitizer actually ran (normalizeText trims);
        // the surviving <b> pins that it does NOT escape/strip — that happens
        // at the render sink, not here.
        const task = {
            id: 'task-1',
            text: '  <b>Bold</b> task  '
        };
        const result = DataValidator.validateTask(task);
        if (result.text !== '<b>Bold</b> task') {
            throw new Error(`expected trimmed pass-through, got '${result.text}'`);
        }
    });

    // === CYCLE DATA VALIDATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Cycle Data Validation</h4>';

    await test('validateCycleData accepts valid cycle', () => {
        const cycleData = {
            title: 'My Cycle',
            tasks: [
                { id: 'task-1', text: 'Task 1' }
            ],
            autoReset: true,
            cycleCount: 5
        };
        const result = DataValidator.validateCycleData(cycleData);
        if (result.title !== 'My Cycle') {
            throw new Error('Should preserve title');
        }
    });

    await test('validateCycleData throws for non-object', () => {
        let threw = false;
        try {
            DataValidator.validateCycleData('not an object');
        } catch (error) {
            threw = true;
            if (!(error instanceof TypeError)) {
                throw new Error('Should throw TypeError');
            }
        }
        if (!threw) {
            throw new Error('Should throw for non-object');
        }
    });

    await test('validateCycleData throws for null', () => {
        let threw = false;
        try {
            DataValidator.validateCycleData(null);
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for null');
        }
    });

    await test('validateCycleData runs title through the sanitizer (trim, no escaping)', () => {
        const cycleData = {
            title: '  <script>bad</script>  '
        };
        const result = DataValidator.validateCycleData(cycleData);
        // Trimmed = sanitizer ran; tags intact = no escaping (render-sink concern).
        if (result.title !== '<script>bad</script>') {
            throw new Error(`expected trimmed pass-through, got '${result.title}'`);
        }
    });

    await test('validateCycleData throws for non-array tasks', () => {
        let threw = false;
        try {
            DataValidator.validateCycleData({
                tasks: 'not an array'
            });
        } catch (error) {
            threw = true;
            if (!(error instanceof TypeError)) {
                throw new Error('Should throw TypeError');
            }
        }
        if (!threw) {
            throw new Error('Should throw for non-array tasks');
        }
    });

    await test('validateCycleData validates each task (nested text is sanitized)', () => {
        const cycleData = {
            tasks: [
                { id: 'task-1', text: '  <b>Task</b>  ' }
            ]
        };
        const result = DataValidator.validateCycleData(cycleData);
        // The trim proves validateTask ran on the nested task; the intact <b>
        // pins pass-through (no escaping at the validation layer).
        if (result.tasks[0].text !== '<b>Task</b>') {
            throw new Error(`expected trimmed pass-through, got '${result.tasks[0].text}'`);
        }
    });

    await test('validateCycleData throws for non-boolean autoReset', () => {
        let threw = false;
        try {
            DataValidator.validateCycleData({
                autoReset: 'yes'
            });
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for non-boolean autoReset');
        }
    });

    await test('validateCycleData throws for non-boolean deleteCheckedTasks', () => {
        let threw = false;
        try {
            DataValidator.validateCycleData({
                deleteCheckedTasks: 1
            });
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for non-boolean deleteCheckedTasks');
        }
    });

    await test('validateCycleData validates cycleCount', () => {
        const cycleData = {
            cycleCount: '10'
        };
        const result = DataValidator.validateCycleData(cycleData);
        if (result.cycleCount !== 10) {
            throw new Error('Should convert cycleCount to number');
        }
    });

    await test('validateCycleData throws for negative cycleCount', () => {
        let threw = false;
        try {
            DataValidator.validateCycleData({
                cycleCount: -5
            });
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for negative cycleCount');
        }
    });

    await test('validateCycleData floors decimal cycleCount', () => {
        const cycleData = {
            cycleCount: 5.7
        };
        const result = DataValidator.validateCycleData(cycleData);
        if (result.cycleCount !== 5) {
            throw new Error('Should floor cycleCount');
        }
    });

    // === IMPORTED DATA VALIDATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📥 Imported Data Validation</h4>';

    await test('validateImportedData accepts valid data', () => {
        const importedData = {
            schemaVersion: '2.5',
            data: {
                cycles: {
                    'cycle-1': {
                        title: 'Test Cycle',
                        tasks: []
                    }
                }
            }
        };
        const result = DataValidator.validateImportedData(importedData);
        if (result.schemaVersion !== '2.5') {
            throw new Error('Should preserve schemaVersion');
        }
    });

    await test('validateImportedData throws for non-object', () => {
        let threw = false;
        try {
            DataValidator.validateImportedData('not an object');
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for non-object');
        }
    });

    await test('validateImportedData throws for null', () => {
        let threw = false;
        try {
            DataValidator.validateImportedData(null);
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for null');
        }
    });

    await test('validateImportedData throws for missing schemaVersion', () => {
        let threw = false;
        try {
            DataValidator.validateImportedData({
                data: { cycles: {} }
            });
        } catch (error) {
            threw = true;
            if (!error.message.includes('schemaVersion')) {
                throw new Error('Should mention schemaVersion');
            }
        }
        if (!threw) {
            throw new Error('Should throw for missing schemaVersion');
        }
    });

    await test('validateImportedData throws for unsupported schema version', () => {
        let threw = false;
        try {
            DataValidator.validateImportedData({
                schemaVersion: '1.0',
                data: { cycles: {} }
            });
        } catch (error) {
            threw = true;
            if (!error.message.includes('Unsupported')) {
                throw new Error('Should mention unsupported');
            }
        }
        if (!threw) {
            throw new Error('Should throw for unsupported schema');
        }
    });

    await test('validateImportedData throws for missing data field', () => {
        let threw = false;
        try {
            DataValidator.validateImportedData({
                schemaVersion: '2.5'
            });
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for missing data field');
        }
    });

    await test('validateImportedData throws for missing cycles', () => {
        let threw = false;
        try {
            DataValidator.validateImportedData({
                schemaVersion: '2.5',
                data: {}
            });
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error('Should throw for missing cycles');
        }
    });

    await test('validateImportedData validates each cycle', () => {
        const importedData = {
            schemaVersion: '2.5',
            data: {
                cycles: {
                    'cycle-1': {
                        title: '  <script>bad</script>  ',
                        tasks: []
                    }
                }
            }
        };
        const result = DataValidator.validateImportedData(importedData);
        // Trim proves validateCycleData ran on the nested cycle; intact tags pin
        // pass-through (escaping is a render-sink concern, not validation's).
        if (result.data.cycles['cycle-1'].title !== '<script>bad</script>') {
            throw new Error(`expected trimmed pass-through, got '${result.data.cycles['cycle-1'].title}'`);
        }
    });

    await test('validateImportedData throws for invalid cycle with cycle name in error', () => {
        let threw = false;
        try {
            DataValidator.validateImportedData({
                schemaVersion: '2.5',
                data: {
                    cycles: {
                        'bad-cycle': {
                            tasks: 'not an array'
                        }
                    }
                }
            });
        } catch (error) {
            threw = true;
            if (!error.message.includes('bad-cycle')) {
                throw new Error('Should include cycle ID in error');
            }
        }
        if (!threw) {
            throw new Error('Should throw for invalid cycle');
        }
    });

    await test('validateTask converts a legacy numeric dueDate using LOCAL calendar components', () => {
        // A timestamp is an instant; the date the user picked is the one on
        // THEIR calendar. toISOString() renders the UTC date, which shifts in
        // both directions: 21:00 in New York migrated forward a day, 00:30 in
        // Tokyo backward a day. Building from local components is offset-proof,
        // so this assertion holds in every timezone (including CI's UTC).
        const evening = new Date(2026, 7, 6, 21, 0); // Aug 6 2026, 9 PM local
        const out = DataValidator.validateTask({ id: 'task-legacy-1', text: 'legacy', dueDate: evening.getTime() });
        if (out.dueDate !== '2026-08-06') {
            throw new Error(`expected the LOCAL date 2026-08-06, got ${out.dueDate}`);
        }

        const earlyMorning = new Date(2026, 7, 6, 0, 30); // Aug 6 2026, 12:30 AM local
        const out2 = DataValidator.validateTask({ id: 'task-legacy-2', text: 'legacy', dueDate: earlyMorning.getTime() });
        if (out2.dueDate !== '2026-08-06') {
            throw new Error(`expected the LOCAL date 2026-08-06, got ${out2.dueDate}`);
        }
    });

    await test('validateTask still rejects an unusable dueDate timestamp', () => {
        // id/text supplied so the throw can only come from the timestamp —
        // without them this passes on the missing-id error instead.
        let message = '';
        try {
            DataValidator.validateTask({ id: 'task-bad-ts', text: 'bad', dueDate: NaN });
        } catch (e) {
            message = e.message;
        }
        if (!message.includes('timestamp')) {
            throw new Error(`expected the timestamp error, got: ${message || '(no throw)'}`);
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
