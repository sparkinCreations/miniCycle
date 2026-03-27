/**
 * ModuleManifests Tests
 * Tests for modules/boot/moduleManifests.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runModuleManifestsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/boot/moduleManifests.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>ModuleManifests Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('PHASES is an object with phase keys', () => {
        if (typeof mod.PHASES !== 'object' || mod.PHASES === null) {
            throw new Error(`Expected object, got ${typeof mod.PHASES}`);
        }
        if (Object.keys(mod.PHASES).length === 0) {
            throw new Error('PHASES has no entries');
        }
    });

    await test('MODULE_MANIFESTS is an object with entries', () => {
        if (typeof mod.MODULE_MANIFESTS !== 'object' || mod.MODULE_MANIFESTS === null) {
            throw new Error(`Expected object, got ${typeof mod.MODULE_MANIFESTS}`);
        }
        if (Object.keys(mod.MODULE_MANIFESTS).length === 0) {
            throw new Error('MODULE_MANIFESTS has no entries');
        }
    });

    await test('getLoadOrder is a function', () => {
        if (typeof mod.getLoadOrder !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getLoadOrder}`);
        }
    });

    await test('getModulesByPhase is a function', () => {
        if (typeof mod.getModulesByPhase !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getModulesByPhase}`);
        }
    });

    await test('CORE_DEPS is a Set with entries', () => {
        if (!(mod.CORE_DEPS instanceof Set)) {
            throw new Error(`Expected Set, got ${typeof mod.CORE_DEPS}`);
        }
        if (mod.CORE_DEPS.size === 0) {
            throw new Error('CORE_DEPS is empty');
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
