/**
 * featureBoot.js Browser Tests
 * Tests for feature boot module - verifies dependency container structure
 *
 * @module tests/featureBoot.tests
 * @version 2.2.0 - Standalone tests (Dec 2025)
 *
 * NOTE: These tests are standalone and do not import testHelpers to avoid
 * triggering module side effects that can cause hangs in the test environment.
 */

// Simple test helper (inline to avoid testHelpers import)
function createTest(resultsDiv, passed, total) {
    return async function test(name, testFn) {
        total.count++;
        try {
            const result = testFn();
            if (result instanceof Promise) await result;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    };
}

export async function runFeatureBootTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔌 featureBoot Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createTest(resultsDiv, passed, total);

    // ===== MODULE STRUCTURE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📁 Module Structure</h4>';

    await test('featureBoot.js file is accessible', async () => {
        const response = await fetch((globalThis.__MC_MODULE_MAP || {})['/modules/boot/featureBoot.js'] || '../modules/boot/featureBoot.js');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    });

    await test('featureBoot.js exports createDepsContainer', async () => {
        // Import-based (not a source grep): works on source AND the minified bundle.
        const m = await import(((globalThis.__MC_MODULE_MAP || {})['/modules/boot/featureBoot.js'] || '../modules/boot/featureBoot.js') + '?v=' + Date.now());
        if (typeof m.createDepsContainer !== 'function') throw new Error('createDepsContainer not found');
    });

    await test('featureBoot.js exports boot functions', async () => {
        const m = await import(((globalThis.__MC_MODULE_MAP || {})['/modules/boot/featureBoot.js'] || '../modules/boot/featureBoot.js') + '?v=' + Date.now());
        if (typeof m.bootEarlyDeps !== 'function') throw new Error('bootEarlyDeps not found');
        if (typeof m.bootFeatures !== 'function') throw new Error('bootFeatures not found');
    });

    // ===== NAMESPACE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Namespace Structure</h4>';

    await test('Container has expected namespaces', async () => {
        const response = await fetch((globalThis.__MC_MODULE_MAP || {})['/modules/boot/featureBoot.js'] || '../modules/boot/featureBoot.js');
        const code = await response.text();

        const namespaces = ['utils:', 'features:', 'ui:', 'core:', 'task:', 'cycle:'];
        for (const ns of namespaces) {
            if (!code.includes(ns)) {
                throw new Error(`Namespace ${ns} not found`);
            }
        }
    });

    await test('Container has recurring namespace', async () => {
        const response = await fetch((globalThis.__MC_MODULE_MAP || {})['/modules/boot/featureBoot.js'] || '../modules/boot/featureBoot.js');
        const code = await response.text();

        if (!code.includes('recurring:')) {
            throw new Error('recurring namespace not found');
        }
    });

    await test('Container has storage namespace', async () => {
        const response = await fetch((globalThis.__MC_MODULE_MAP || {})['/modules/boot/featureBoot.js'] || '../modules/boot/featureBoot.js');
        const code = await response.text();

        if (!code.includes('storage:')) {
            throw new Error('storage namespace not found');
        }
    });

    // ===== createDepsContainer (real featureBoot export) =====
    // Replaced a cluster of "object pattern" / "async pattern" tests that asserted JS
    // object/async LANGUAGE semantics on local literals and never called featureBoot.
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 createDepsContainer</h4>';

    const loadFeatureBoot = () => import(((globalThis.__MC_MODULE_MAP || {})['/modules/boot/featureBoot.js'] || '../modules/boot/featureBoot.js') + '?v=' + Date.now());
    const EXPECTED_NS = ['utils', 'labels', 'features', 'ui', 'core', 'task', 'cycle', 'recurring', 'progress', 'storage', 'testing', 'plugins'];

    await test('createDepsContainer returns all expected namespaces as empty objects', async () => {
        const { createDepsContainer } = await loadFeatureBoot();
        const deps = createDepsContainer();
        for (const ns of EXPECTED_NS) {
            if (typeof deps[ns] !== 'object' || deps[ns] === null) throw new Error(`missing/invalid namespace: ${ns}`);
            if (Object.keys(deps[ns]).length !== 0) throw new Error(`namespace ${ns} should start empty`);
        }
        if (Object.keys(deps).length !== EXPECTED_NS.length) {
            throw new Error(`expected ${EXPECTED_NS.length} namespaces, got ${Object.keys(deps).length}`);
        }
    });

    await test('createDepsContainer namespaces hold values independently', async () => {
        const { createDepsContainer } = await loadFeatureBoot();
        const deps = createDepsContainer();
        deps.utils.sanitize = (s) => s.trim();
        deps.core.AppState = { isReady: () => true };
        if (deps.utils.sanitize('  x  ') !== 'x') throw new Error('stored function should work through the container');
        if (!deps.core.AppState.isReady()) throw new Error('stored object should work through the container');
        if (deps.core.sanitize !== undefined) throw new Error('namespaces should not bleed into each other');
    });

    await test('createDepsContainer returns a fresh independent instance each call', async () => {
        const { createDepsContainer } = await loadFeatureBoot();
        const a = createDepsContainer();
        const b = createDepsContainer();
        a.utils.marker = 1;
        if (b.utils.marker !== undefined) throw new Error('separate containers must not share namespace state');
        if (a.utils === b.utils) throw new Error('namespace objects must be distinct per container');
    });

    // Summary
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round(passed.count/total.count*100)}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
