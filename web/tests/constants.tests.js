/**
 * Constants Tests
 * Tests for modules/core/constants.js
 *
 * Tests core constant values:
 * - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * - DEFAULT_RECURRING_DELETE_SETTINGS
 * - Immutability (Object.freeze)
 */

import {
    setupTestEnvironment,
    createMockData
} from './testHelpers.js';

import {
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS
} from '../modules/core/constants.js';

export async function runConstantsTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>Constants Tests</h2><h3>Setting up...</h3>';

    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>Constants Tests</h2><h3>Running tests...</h3>';
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

    // === DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS</h4>';

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS is exported', () => {
        if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS === undefined) {
            throw new Error('Should be exported');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS is an object', () => {
        if (typeof DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS !== 'object') {
            throw new Error('Should be an object');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS has cycle property', () => {
        if (!('cycle' in DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS)) {
            throw new Error('Should have cycle property');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS has todo property', () => {
        if (!('todo' in DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS)) {
            throw new Error('Should have todo property');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle is false', () => {
        if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle !== false) {
            throw new Error('cycle should be false (keep tasks, reset to incomplete)');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.todo is true', () => {
        if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.todo !== true) {
            throw new Error('todo should be true (delete tasks on complete)');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS is frozen', () => {
        if (!Object.isFrozen(DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS)) {
            throw new Error('Should be frozen (immutable)');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS cannot be modified', () => {
        const originalCycle = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle;

        // Attempt to modify (should silently fail in non-strict mode)
        try {
            DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle = true;
        } catch (e) {
            // In strict mode, this throws - that's expected
        }

        if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle !== originalCycle) {
            throw new Error('Should not be modifiable');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS cannot have new properties added', () => {
        const originalKeys = Object.keys(DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS).length;

        try {
            DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.newProp = 'test';
        } catch (e) {
            // Expected in strict mode
        }

        if (Object.keys(DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS).length !== originalKeys) {
            throw new Error('Should not allow new properties');
        }
    });

    // === DEFAULT_RECURRING_DELETE_SETTINGS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 DEFAULT_RECURRING_DELETE_SETTINGS</h4>';

    await test('DEFAULT_RECURRING_DELETE_SETTINGS is exported', () => {
        if (DEFAULT_RECURRING_DELETE_SETTINGS === undefined) {
            throw new Error('Should be exported');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS is an object', () => {
        if (typeof DEFAULT_RECURRING_DELETE_SETTINGS !== 'object') {
            throw new Error('Should be an object');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS has cycle property', () => {
        if (!('cycle' in DEFAULT_RECURRING_DELETE_SETTINGS)) {
            throw new Error('Should have cycle property');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS has todo property', () => {
        if (!('todo' in DEFAULT_RECURRING_DELETE_SETTINGS)) {
            throw new Error('Should have todo property');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS.cycle is true', () => {
        if (DEFAULT_RECURRING_DELETE_SETTINGS.cycle !== true) {
            throw new Error('cycle should be true (recurring always deletes)');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS.todo is true', () => {
        if (DEFAULT_RECURRING_DELETE_SETTINGS.todo !== true) {
            throw new Error('todo should be true (recurring always deletes)');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS is frozen', () => {
        if (!Object.isFrozen(DEFAULT_RECURRING_DELETE_SETTINGS)) {
            throw new Error('Should be frozen (immutable)');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS cannot be modified', () => {
        const originalCycle = DEFAULT_RECURRING_DELETE_SETTINGS.cycle;

        try {
            DEFAULT_RECURRING_DELETE_SETTINGS.cycle = false;
        } catch (e) {
            // Expected in strict mode
        }

        if (DEFAULT_RECURRING_DELETE_SETTINGS.cycle !== originalCycle) {
            throw new Error('Should not be modifiable');
        }
    });

    // === SEMANTIC CORRECTNESS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Semantic Correctness</h4>';

    await test('Regular tasks: cycle mode keeps tasks (false)', () => {
        // In cycle mode, regular tasks should NOT be deleted - they reset
        if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle !== false) {
            throw new Error('Regular tasks in cycle mode should keep (reset), not delete');
        }
    });

    await test('Regular tasks: todo mode deletes tasks (true)', () => {
        // In todo mode, regular tasks should be deleted when complete
        if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.todo !== true) {
            throw new Error('Regular tasks in todo mode should be deleted');
        }
    });

    await test('Recurring tasks: always delete in both modes', () => {
        // Recurring tasks should always delete (spawn new instance)
        if (DEFAULT_RECURRING_DELETE_SETTINGS.cycle !== true) {
            throw new Error('Recurring tasks should delete in cycle mode');
        }
        if (DEFAULT_RECURRING_DELETE_SETTINGS.todo !== true) {
            throw new Error('Recurring tasks should delete in todo mode');
        }
    });

    await test('Constants have different behaviors for regular vs recurring', () => {
        // The key difference: regular tasks in cycle mode DON'T delete
        const regularCycle = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle;
        const recurringCycle = DEFAULT_RECURRING_DELETE_SETTINGS.cycle;

        if (regularCycle === recurringCycle) {
            throw new Error('Regular and recurring should differ in cycle mode');
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
