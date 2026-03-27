/**
 * ModuleLoader Tests
 * Tests for modules/boot/moduleLoader.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runModuleLoaderTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/boot/moduleLoader.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>ModuleLoader Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('loadManifests is an exported async function', () => {
        if (typeof mod.loadManifests !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.loadManifests}`);
        }
    });

    await test('detectCircularDeps is an exported function', () => {
        if (typeof mod.detectCircularDeps !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.detectCircularDeps}`);
        }
    });

    await test('isModuleLoaded is an exported function', () => {
        if (typeof mod.isModuleLoaded !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.isModuleLoaded}`);
        }
    });

    await test('destroyAllModules is an exported function', () => {
        if (typeof mod.destroyAllModules !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.destroyAllModules}`);
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
