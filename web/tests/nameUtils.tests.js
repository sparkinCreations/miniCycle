/**
 * NameUtils Tests
 * Tests for modules/utils/nameUtils.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runNameUtilsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/nameUtils.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>NameUtils Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('getUniqueCycleName is an exported function', () => {
        if (typeof mod.getUniqueCycleName !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getUniqueCycleName}`);
        }
    });

    await test('cycleNameExists is an exported function', () => {
        if (typeof mod.cycleNameExists !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.cycleNameExists}`);
        }
    });

    await test('cycleNameExists returns false for empty cycles', () => {
        const result = mod.cycleNameExists('Test', {});
        if (result !== false) {
            throw new Error(`Expected false, got ${result}`);
        }
    });

    await test('getUniqueCycleName returns object with name and wasModified', () => {
        const result = mod.getUniqueCycleName('My Routine', {});
        if (typeof result !== 'object' || !result) throw new Error('Should return object');
        if (typeof result.name !== 'string') throw new Error('name should be string');
        if (typeof result.wasModified !== 'boolean') throw new Error('wasModified should be boolean');
        if (result.name !== 'My Routine') throw new Error(`Expected "My Routine", got "${result.name}"`);
        if (result.wasModified !== false) throw new Error('Should not be modified for new name');
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
