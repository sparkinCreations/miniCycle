/**
 * GesturePanelManager Tests
 * Tests for modules/ui/gesturePanelManager.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runGesturePanelManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/gesturePanelManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>GesturePanelManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('GesturePanelManager is an exported class', () => {
        if (typeof mod.GesturePanelManager !== 'function') {
            throw new Error(`Expected function (class), got ${typeof mod.GesturePanelManager}`);
        }
    });

    await test('setGesturePanelManagerDependencies is an exported function', () => {
        if (typeof mod.setGesturePanelManagerDependencies !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setGesturePanelManagerDependencies}`);
        }
    });

    await test('initGesturePanelManager is an exported function', () => {
        if (typeof mod.initGesturePanelManager !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.initGesturePanelManager}`);
        }
    });

    await test('getGesturePanelManager is an exported function', () => {
        if (typeof mod.getGesturePanelManager !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getGesturePanelManager}`);
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
