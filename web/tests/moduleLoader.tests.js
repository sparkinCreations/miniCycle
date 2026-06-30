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

    resultsDiv.innerHTML += '<h4 class="test-section">🔌 Declared-dep injection (ENFORCE_REQUIRES path)</h4>';

    await test('injectDeclaredDeps is an exported function', () => {
        if (typeof mod.injectDeclaredDeps !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.injectDeclaredDeps}`);
        }
    });

    await test('injects requires, optionalDeps AND lazyRequires from depMappings', () => {
        const manifest = { requires: ['reqA'], optionalDeps: ['optB'], lazyRequires: ['lazyC'] };
        const depMappings = { reqA: 1, optB: 2, lazyC: 3, unrelated: 4 };
        const result = mod.injectDeclaredDeps({}, manifest, depMappings, {});
        if (result.reqA !== 1) throw new Error('requires not injected');
        if (result.lazyC !== 3) throw new Error('lazyRequires not injected');
        // The fix: optionalDeps must be injected here, not only via the broad assign.
        if (result.optB !== 2) throw new Error('optionalDeps not injected (the ENFORCE_REQUIRES gap)');
        if ('unrelated' in result) throw new Error('undeclared dep leaked into result');
    });

    await test('falls back to coreResult when a dep is not in depMappings', () => {
        const manifest = { requires: ['fromCore'], optionalDeps: [], lazyRequires: [] };
        const result = mod.injectDeclaredDeps({}, manifest, {}, { fromCore: 'core-value' });
        if (result.fromCore !== 'core-value') throw new Error('coreResult fallback failed');
    });

    await test('tolerates manifests with missing dep arrays', () => {
        const result = mod.injectDeclaredDeps({}, {}, {}, {});
        if (Object.keys(result).length !== 0) throw new Error('expected empty result for empty manifest');
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
