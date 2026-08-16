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

    resultsDiv.innerHTML += '<h4 class="test-section">🔎 Undeclared-dep access audit (ENFORCE_REQUIRES runtime net)</h4>';

    // The audit gates on orchestrator's `mc:boot:interactive` performance mark.
    // These tests drive that mark directly, and each uses its OWN module instance
    // (unique ?v= suffix) because `bootIsInteractive()` latches once true — a
    // shared instance would carry that latch between tests.
    const INTERACTIVE_MARK = 'mc:boot:interactive';
    const freshLoader = (tag) => import(`../modules/boot/moduleLoader.js?v=${cacheBuster}-${tag}`);
    const markInteractive = () => { try { performance.mark(INTERACTIVE_MARK); } catch (_) { /* no perf API */ } };
    const clearInteractive = () => { try { performance.clearMarks(INTERACTIVE_MARK); } catch (_) { /* no perf API */ } };
    // Restore whatever the page had, so a real app boot's timing marks survive
    // these tests (getBootTiming reads this mark; it is diagnostic-only).
    const hadInteractiveMark = (() => {
        try { return performance.getEntriesByName(INTERACTIVE_MARK, 'mark').length > 0; }
        catch (_) { return false; }
    })();
    const restoreInteractiveMark = () => {
        clearInteractive();
        if (hadInteractiveMark) markInteractive();
    };
    // Capture console.warn for the duration of fn.
    const captureWarnings = async (fn) => {
        const original = console.warn;
        const lines = [];
        console.warn = (...args) => { lines.push(args.join(' ')); };
        try { await fn(); } finally { console.warn = original; }
        return lines;
    };

    await test('attachUndeclaredDepWarnings is an exported function', () => {
        if (typeof mod.attachUndeclaredDepWarnings !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.attachUndeclaredDepWarnings}`);
        }
    });

    await test('delivered deps keep a plain data property — no accessor on the hot path', () => {
        const result = { given: 'value' };
        mod.attachUndeclaredDepWarnings(result, { path: 'm.js' }, { given: 'x', absent: 'y' });
        const d = Object.getOwnPropertyDescriptor(result, 'given');
        if (typeof d.get === 'function') throw new Error('delivered dep was wrapped in an accessor');
        if (result.given !== 'value') throw new Error('delivered dep value was altered');
    });

    await test('absent deps get a NON-ENUMERABLE accessor invisible to keys/spread', () => {
        const result = { given: 1 };
        mod.attachUndeclaredDepWarnings(result, { path: 'm.js' }, { given: 1, absent: 2 });
        const d = Object.getOwnPropertyDescriptor(result, 'absent');
        if (typeof d.get !== 'function') throw new Error('absent dep did not get a getter');
        if (d.enumerable) {
            throw new Error('warner is enumerable — spread/Object.keys would fire every getter, ' +
                'which is exactly the false-positive storm the old audit Proxy had');
        }
        if (Object.keys(result).includes('absent')) throw new Error('warner leaked into Object.keys');
        if ('absent' in { ...result }) throw new Error('warner leaked into spread');
    });

    await test('names outside depMappings are never instrumented', () => {
        const result = {};
        mod.attachUndeclaredDepWarnings(result, { path: 'm.js' }, { known: 1 });
        if (Object.getOwnPropertyDescriptor(result, 'somethingElse')) {
            throw new Error('instrumented a name that is not a depMappings key');
        }
    });

    await test('reading an undeclared dep warns once, post-boot, naming module and dep', async () => {
        const m = await freshLoader('audit-warn');
        markInteractive();
        try {
            const result = {};
            m.attachUndeclaredDepWarnings(result, { path: 'task/taskDOM.js' }, { setupRecurringButtonHandler: 1 });
            const lines = await captureWarnings(() => {
                const first = result.setupRecurringButtonHandler;
                const second = result.setupRecurringButtonHandler;
                if (first !== undefined || second !== undefined) {
                    throw new Error('warner changed the value — must stay undefined, as an absent key was');
                }
            });
            if (lines.length !== 1) throw new Error(`Expected exactly 1 warning (deduped), got ${lines.length}`);
            if (!lines[0].includes('task/taskDOM.js')) throw new Error('warning does not name the module');
            if (!lines[0].includes('setupRecurringButtonHandler')) throw new Error('warning does not name the dep');
            if (!/DI /.test(lines[0])) {
                throw new Error('warning lacks the "DI " prefix run-journey-tests.cjs filters on');
            }
        } finally {
            restoreInteractiveMark();
        }
    });

    await test('boot-time reads are BUFFERED, not dropped, and flush once boot completes', async () => {
        // Boot reads must survive. The first cut of this audit suppressed them, and
        // measuring against the real app showed that is exactly backwards: taskDOM
        // snapshots resolvedDeps.setupRecurringButtonHandler into this.deps inside
        // its CONSTRUCTOR, so the only read of the undeclared name happens during
        // boot. Suppressing would have made the audit blind to its headline case.
        const m = await freshLoader('audit-buffer');
        clearInteractive();
        try {
            const result = {};
            m.attachUndeclaredDepWarnings(result, { path: 'm.js' }, { early: 1, later: 2 });
            const duringBoot = await captureWarnings(() => { void result.early; });
            if (duringBoot.length !== 0) throw new Error(`Expected quiet console during boot, got ${duringBoot.length}`);
            if (!m.getUndeclaredDepAccesses().includes('m.js::early')) {
                throw new Error('boot-time read was dropped instead of buffered');
            }
            // Post-boot: the buffered read drains alongside the new one.
            markInteractive();
            const afterBoot = await captureWarnings(() => { void result.later; });
            const joined = afterBoot.join('\n');
            if (!joined.includes('"early"')) throw new Error('buffered boot-time read never surfaced');
            if (!/during boot/.test(joined)) throw new Error('flushed read is not labelled as a boot-time read');
            if (!joined.includes('"later"')) throw new Error('post-boot read did not warn');
        } finally {
            restoreInteractiveMark();
            m.resetUndeclaredDepAudit();
        }
    });

    await test('buffered reads flush on the interactive mark with no further access', async () => {
        // The PerformanceObserver path: nothing may read a dep again after boot, so
        // the flush cannot depend on another access to trigger it.
        const m = await freshLoader('audit-observer');
        clearInteractive();
        const original = console.warn;
        const lines = [];
        try {
            const result = {};
            m.attachUndeclaredDepWarnings(result, { path: 'm.js' }, { orphan: 1 });
            void result.orphan;                       // buffered — boot not finished
            console.warn = (...args) => { lines.push(args.join(' ')); };
            markInteractive();                        // observer should drain on its own
            const deadline = Date.now() + 2000;
            while (lines.length === 0 && Date.now() < deadline) {
                await new Promise(r => setTimeout(r, 25));
            }
        } finally {
            console.warn = original;
            restoreInteractiveMark();
            m.resetUndeclaredDepAudit();
        }
        if (typeof PerformanceObserver !== 'function') return;  // env without the observer
        if (lines.length === 0) throw new Error('observer never flushed the buffered read');
        if (!lines.join('\n').includes('"orphan"')) throw new Error('flushed the wrong entry');
    });

    await test('warner survives the getOwnPropertyDescriptors copy diBase.setDependencies performs', async () => {
        // THE load-bearing behaviour. Modules do not read the built deps object —
        // setDependencies copies descriptors into the module's own `_injected`, and
        // reads go there. A Proxy trap would be dropped by that copy; a
        // non-enumerable accessor is carried by it, which is why this is an accessor.
        const m = await freshLoader('audit-copy');
        markInteractive();
        try {
            const built = {};
            m.attachUndeclaredDepWarnings(built, { path: 'task/taskCore.js' }, { forwarded: 1 });
            const injected = {};
            Object.defineProperties(injected, Object.getOwnPropertyDescriptors(built));
            if (!Object.getOwnPropertyDescriptor(injected, 'forwarded')) {
                throw new Error('warner was lost in the descriptor copy — the audit would never fire in practice');
            }
            const lines = await captureWarnings(() => { void injected.forwarded; });
            if (lines.length !== 1) throw new Error(`Expected the copied warner to fire, got ${lines.length} warnings`);
            if (!lines[0].includes('task/taskCore.js')) {
                throw new Error('copied warner lost its attribution to the declaring manifest');
            }
        } finally {
            restoreInteractiveMark();
        }
    });

    await test('assigning over a warner does not throw in strict mode and wins', () => {
        // Modules are ES modules, so they run strict: assigning to a getter-only
        // accessor throws TypeError. A late `_deps.x = fn` / injectDependency / test
        // stub must keep working, and must land on the receiver being written to.
        const built = {};
        mod.attachUndeclaredDepWarnings(built, { path: 'm.js' }, { late: 1 });
        const injected = {};
        Object.defineProperties(injected, Object.getOwnPropertyDescriptors(built));
        const fn = () => 'real';
        injected.late = fn;                       // must not throw
        if (injected.late !== fn) throw new Error('assignment did not replace the warner');
        if (!Object.keys(injected).includes('late')) {
            throw new Error('assigned dep stayed non-enumerable — it should behave like a normal dep now');
        }
        if (Object.getOwnPropertyDescriptor(built, 'late')?.value === fn) {
            throw new Error('assignment landed on the ORIGINAL object, not the receiver — closure bug');
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
