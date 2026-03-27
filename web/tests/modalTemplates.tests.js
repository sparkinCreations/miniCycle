/**
 * ModalTemplates Tests
 * Tests for modules/boot/modalTemplates.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runModalTemplatesTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/boot/modalTemplates.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>ModalTemplates Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('RECURRING_PANEL_HTML is a non-empty string', () => {
        if (typeof mod.RECURRING_PANEL_HTML !== 'string') {
            throw new Error(`Expected string, got ${typeof mod.RECURRING_PANEL_HTML}`);
        }
        if (mod.RECURRING_PANEL_HTML.length === 0) {
            throw new Error('RECURRING_PANEL_HTML is empty');
        }
    });

    await test('PREFERENCES_MODAL_HTML is a non-empty string', () => {
        if (typeof mod.PREFERENCES_MODAL_HTML !== 'string') {
            throw new Error(`Expected string, got ${typeof mod.PREFERENCES_MODAL_HTML}`);
        }
        if (mod.PREFERENCES_MODAL_HTML.length === 0) {
            throw new Error('PREFERENCES_MODAL_HTML is empty');
        }
    });

    await test('SETTINGS_MODAL_HTML is a non-empty string', () => {
        if (typeof mod.SETTINGS_MODAL_HTML !== 'string') {
            throw new Error(`Expected string, got ${typeof mod.SETTINGS_MODAL_HTML}`);
        }
        if (mod.SETTINGS_MODAL_HTML.length === 0) {
            throw new Error('SETTINGS_MODAL_HTML is empty');
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
