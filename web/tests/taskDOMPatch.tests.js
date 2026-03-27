/**
 * TaskDOMPatch Tests
 * Tests for modules/task/taskDOMPatch.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskDOMPatchTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskDOMPatch.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>TaskDOMPatch Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('TaskDOMPatch is an exported class', () => {
        if (typeof mod.TaskDOMPatch !== 'function') {
            throw new Error(`Expected function (class), got ${typeof mod.TaskDOMPatch}`);
        }
    });

    await test('TaskDOMPatch has a prototype (is a class)', () => {
        if (!mod.TaskDOMPatch.prototype) {
            throw new Error('TaskDOMPatch has no prototype');
        }
    });

    await test('TaskDOMPatch can be referenced without throwing', () => {
        // Verify the class reference is stable and does not throw on access
        const ref = mod.TaskDOMPatch;
        if (!ref) throw new Error('TaskDOMPatch reference is falsy');
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
