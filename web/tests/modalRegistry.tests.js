/**
 * ModalRegistry Tests
 * Tests for modules/ui/modalRegistry.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runModalRegistryTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/modalRegistry.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>ModalRegistry Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('MODAL_DEFS is an exported object with entries', () => {
        if (typeof mod.MODAL_DEFS !== 'object' || mod.MODAL_DEFS === null) {
            throw new Error(`Expected object, got ${typeof mod.MODAL_DEFS}`);
        }
        if (Object.keys(mod.MODAL_DEFS).length === 0) {
            throw new Error('MODAL_DEFS has no entries');
        }
    });

    await test('MODAL_NAMES is an array with entries', () => {
        if (!Array.isArray(mod.MODAL_NAMES)) {
            throw new Error(`Expected array, got ${typeof mod.MODAL_NAMES}`);
        }
        if (mod.MODAL_NAMES.length === 0) {
            throw new Error('MODAL_NAMES is empty');
        }
    });

    await test('setModalRegistryDependencies is an exported function', () => {
        if (typeof mod.setModalRegistryDependencies !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setModalRegistryDependencies}`);
        }
    });

    await test('getModal is an exported function', () => {
        if (typeof mod.getModal !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getModal}`);
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
