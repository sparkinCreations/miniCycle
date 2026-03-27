/**
 * Icons Tests
 * Tests for modules/utils/icons.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runIconsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/icons.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>Icons Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('ICONS is an object with entries', () => {
        if (typeof mod.ICONS !== 'object' || mod.ICONS === null) {
            throw new Error(`Expected object, got ${typeof mod.ICONS}`);
        }
        if (Object.keys(mod.ICONS).length === 0) {
            throw new Error('ICONS has no entries');
        }
    });

    await test('FA_MAP is an exported object', () => {
        if (typeof mod.FA_MAP !== 'object' || mod.FA_MAP === null) {
            throw new Error(`Expected object, got ${typeof mod.FA_MAP}`);
        }
    });

    await test('getIcon is an exported function', () => {
        if (typeof mod.getIcon !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getIcon}`);
        }
    });

    await test('getIcon returns a string for a known icon', () => {
        // Try a common icon name — if it exists, result should be a string
        const firstKey = Object.keys(mod.ICONS)[0];
        if (firstKey) {
            const result = mod.getIcon(firstKey);
            if (typeof result !== 'string') {
                throw new Error(`Expected string, got ${typeof result}`);
            }
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
