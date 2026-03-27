/**
 * DataAccess Tests
 * Tests for modules/core/dataAccess.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runDataAccessTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/core/dataAccess.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>DataAccess Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('setDataAccessDeps is an exported function', () => {
        if (typeof mod.setDataAccessDeps !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setDataAccessDeps}`);
        }
    });

    await test('loadMiniCycleData is an exported function', () => {
        if (typeof mod.loadMiniCycleData !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.loadMiniCycleData}`);
        }
    });

    await test('autoSave is an exported function', () => {
        if (typeof mod.autoSave !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.autoSave}`);
        }
    });

    await test('updateCycleData is an exported function', () => {
        if (typeof mod.updateCycleData !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.updateCycleData}`);
        }
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
