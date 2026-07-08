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

    await test('injectCoreDeps is an exported function', () => {
        if (typeof mod.injectCoreDeps !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.injectCoreDeps}`);
        }
    });

    await test('injects depMappings-sourced CORE_DEPS (survive strict mode)', () => {
        const coreDeps = new Set(['getElementById', 'sanitizeInput', 'AppState']);
        const depMappings = { getElementById: 'gei', sanitizeInput: 'si', unrelated: 'x' };
        const result = mod.injectCoreDeps({}, coreDeps, depMappings);
        if (result.getElementById !== 'gei') throw new Error('DOM-helper CORE_DEP not injected');
        if (result.sanitizeInput !== 'si') throw new Error('util CORE_DEP not injected');
        if ('unrelated' in result) throw new Error('non-CORE depMapping leaked into result');
    });

    await test('does NOT clobber a Phase-1 CORE_DEP already set (AppState Proxy safety)', () => {
        const proxySentinel = { __isAppStateProxy: true };
        const coreDeps = new Set(['AppState', 'getElementById']);
        const depMappings = { getElementById: 'gei' }; // AppState intentionally absent
        const result = mod.injectCoreDeps({ AppState: proxySentinel }, coreDeps, depMappings);
        if (result.AppState !== proxySentinel) throw new Error('AppState Proxy was clobbered');
        if (result.getElementById !== 'gei') throw new Error('depMappings CORE_DEP not injected');
    });

    await test('uses key-presence (in), not truthiness — writes present-but-undefined resolvers', () => {
        // Real CORE_DEP entries like generateId/safeJSONParse are direct refs
        // (deps.utils?.x) that are present-but-undefined until their module populates.
        // The `in` guard must still write them (overwriting any stale prior value),
        // matching Object.assign semantics — a truthiness guard would silently drop them.
        const result = mod.injectCoreDeps({ generateId: 'STALE' }, new Set(['generateId']), { generateId: undefined });
        if (!('generateId' in result)) throw new Error('present-but-undefined CORE_DEP key not written');
        if (result.generateId !== undefined) throw new Error('stale prior value not overwritten');
    });

    await test('Phase-1 CORE_DEPS are not depMappings keys (AppState Proxy safety invariant)', () => {
        // injectCoreDeps only overwrites depMappings-keyed CORE_DEPS; the AppState
        // Proxy survives strict mode *only* because the 6 Phase-1 names are absent
        // from depMappings. Pin that cross-file invariant against the real maps.
        const dmKeys = mod.ensureDepMappingKeys();
        const phase1 = ['AppState', 'AppGlobalState', 'appInit', 'GlobalUtils', 'FeatureFlags', 'AppMeta'];
        const leaked = phase1.filter(n => dmKeys.has(n));
        if (leaked.length) {
            throw new Error(`Phase-1 CORE_DEPS leaked into depMappings: ${leaked.join(', ')} — injectCoreDeps would clobber them`);
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🧬 Boot-retry safety (July 2026 audit C1/C2/C3)</h4>';

    await test('module registries are shared across differently-versioned instances (C1)', async () => {
        // A boot retry imports moduleLoader with a different ?v= suffix — a separate
        // ES module instance. destroyAllModules() there must still see attempt 1's
        // modules, so the registries live on globalThis.__miniCycleModuleRegistry.
        const modB = await import(`../modules/boot/moduleLoader.js?v=${cacheBuster}-retrysim`);
        if (modB === mod) throw new Error('Test setup: expected two distinct module instances');
        const host = globalThis.__miniCycleModuleRegistry;
        if (!host?.loadedModules || !host?.moduleInstances) {
            throw new Error('globalThis.__miniCycleModuleRegistry host missing');
        }
        // Register a destroyable through instance A, destroy through instance B.
        let destroyed = false;
        host.moduleInstances.set('__c1Probe', { destroy() { destroyed = true; } });
        try {
            if (!modB.getModuleInstance || modB.getModuleInstance('__c1Probe') === null) {
                throw new Error('Instance B cannot see instance A\'s registration — registries not shared');
            }
            modB.destroyAllModules();
            if (!destroyed) throw new Error('destroyAllModules() from instance B did not reach instance A\'s module');
        } finally {
            host.moduleInstances.delete('__c1Probe');
        }
    });

    await test('clearLoadedModules from a second instance clears the shared registry (C1)', async () => {
        const modB = await import(`../modules/boot/moduleLoader.js?v=${cacheBuster}-retrysim`);
        const host = globalThis.__miniCycleModuleRegistry;
        host.loadedModules.set('__c1ClearProbe', {});
        modB.clearLoadedModules();
        if (host.loadedModules.has('__c1ClearProbe')) {
            throw new Error('clearLoadedModules() from another instance left the shared map intact');
        }
    });

    await test('assertBootGenerationCurrent throws only when superseded (C2)', () => {
        const prevGen = globalThis.__miniCycleBootGeneration;
        try {
            // No generation set (unit-test context) → must no-op
            delete globalThis.__miniCycleBootGeneration;
            mod.assertBootGenerationCurrent(1);
            mod.assertBootGenerationCurrent(undefined);

            // Current attempt → must pass
            globalThis.__miniCycleBootGeneration = 2;
            mod.assertBootGenerationCurrent(2);
            // Caller with no captured generation (never booted) → must no-op
            mod.assertBootGenerationCurrent(undefined);

            // Superseded attempt → must throw
            let threw = false;
            try { mod.assertBootGenerationCurrent(1); } catch (e) {
                threw = /superseded/.test(e.message);
            }
            if (!threw) throw new Error('Stale generation did not throw — zombie boot attempts would keep wiring');
        } finally {
            if (prevGen === undefined) delete globalThis.__miniCycleBootGeneration;
            else globalThis.__miniCycleBootGeneration = prevGen;
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
