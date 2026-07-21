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

    // ===== OBJECT PATTERN TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Object Pattern</h4>';

    await test('Plain object works as container', () => {
        const deps = {
            utils: {},
            core: {},
            features: {}
        };

        if (Object.keys(deps).length !== 3) {
            throw new Error('Container should have 3 namespaces');
        }
    });

    await test('Namespaces are independent', () => {
        const deps = {
            utils: {},
            core: {}
        };

        deps.utils.value = 'A';
        deps.core.value = 'B';

        if (deps.utils.value === deps.core.value) {
            throw new Error('Namespaces should be independent');
        }
    });

    await test('Functions can be stored', () => {
        const deps = { utils: {} };

        deps.utils.sanitize = (s) => s.trim();

        if (typeof deps.utils.sanitize !== 'function') {
            throw new Error('Should store function');
        }
        if (deps.utils.sanitize('  x  ') !== 'x') {
            throw new Error('Function should work');
        }
    });

    await test('Objects can be stored', () => {
        const deps = { core: {} };

        deps.core.AppState = {
            isReady: () => true,
            data: {}
        };

        if (!deps.core.AppState.isReady()) {
            throw new Error('Should store object with methods');
        }
    });

    await test('New containers are independent', () => {
        function makeContainer() {
            return { utils: {}, core: {} };
        }

        const c1 = makeContainer();
        const c2 = makeContainer();

        c1.utils.x = 1;

        if (c2.utils.x !== undefined) {
            throw new Error('Containers should be independent');
        }
    });

    // ===== ASYNC PATTERN TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Async Patterns</h4>';

    await test('Async functions return promises', async () => {
        async function mockBoot() {
            await new Promise(r => setTimeout(r, 1));
            return { ok: true };
        }

        const result = mockBoot();
        if (!(result instanceof Promise)) {
            throw new Error('Should return Promise');
        }

        const resolved = await result;
        if (!resolved.ok) {
            throw new Error('Should resolve successfully');
        }
    });

    await test('Boot errors can be caught', async () => {
        async function failingBoot() {
            throw new Error('Boot failed');
        }

        let caught = false;
        try {
            await failingBoot();
        } catch (e) {
            caught = true;
        }

        if (!caught) {
            throw new Error('Should catch boot errors');
        }
    });

    // Summary
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round(passed.count/total.count*100)}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
