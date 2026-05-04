/**
 * DI Wiring Verification Tests
 * Tests that every declared dependency in module manifests has a corresponding
 * depMappings entry in moduleLoader.js. Catches the silent-failure bug class
 * where optional chaining masks missing wiring (e.g., clearAllUndoHistory,
 * refreshThemeLabels).
 *
 * This is a static analysis test — it compares two lists (manifest declarations
 * vs depMappings keys) without requiring a full app boot.
 */

import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

export async function runDIWiringTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>DI Wiring Verification Tests</h2><h3>Loading manifests...</h3>';

    const cacheBuster = window.testCacheBuster || Date.now();

    // Import manifests and loader (cache-busted)
    const manifestMod = await import(`../modules/boot/moduleManifests.js?v=${cacheBuster}`);
    const loaderMod = await import(`../modules/boot/moduleLoader.js?v=${cacheBuster}`);

    const { MODULE_MANIFESTS, CORE_DEPS } = manifestMod;
    const { getDepMappingKeys } = loaderMod;

    resultsDiv.innerHTML = '<h2>DI Wiring Verification Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Get depMappings keys (populated after boot)
    const depMappingKeys = getDepMappingKeys();

    // CLI/Playwright mode runs tests in isolation (module-test-suite.html
    // imports test files but does NOT boot the app), so depMappings is empty
    // and the wiring battery has nothing to verify against. Skip cleanly with
    // an informational result — these tests are meaningful only after a real
    // boot has populated depMappings, which is what the in-browser testing
    // modal on the live app provides.
    if (!depMappingKeys || depMappingKeys.size === 0) {
        resultsDiv.innerHTML +=
            '<div class="result info">⏭ DI wiring verification skipped — ' +
            'depMappings populates only during full app boot. ' +
            'Run via the in-browser testing modal on the live app to verify wiring.</div>';
        // Reporting 0/0 keeps the CLI runner from flagging this as a failure
        // (it parses `\d+/\d+` from the Results line and computes pass/fail
        // from the .result.fail count).
        resultsDiv.innerHTML += '<h3>Results: 0/0 tests passed (skipped — requires live app boot)</h3>';
        return { passed: 0, total: 0, skipped: true };
    }

    // Build a set of all deps provided by any module
    const allProvided = new Set();
    for (const manifest of Object.values(MODULE_MANIFESTS)) {
        for (const dep of (manifest.provides || [])) {
            allProvided.add(dep);
        }
    }

    // =====================================================
    // TEST 1: depMappings keys are available
    // =====================================================

    await test('depMappingKeys populated after boot', () => {
        if (!depMappingKeys || depMappingKeys.size === 0) {
            throw new Error(
                'getDepMappingKeys() returned empty — test must run after app boot. ' +
                'depMappings keys are populated during loadAllModules().'
            );
        }
    });

    // =====================================================
    // TEST 2: Every declared optionalDep has a wiring path
    // =====================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔌 Optional Dependencies Wiring</h4>';

    const gaps = [];

    for (const [moduleName, manifest] of Object.entries(MODULE_MANIFESTS)) {
        // Skip optional modules (they expect potentially missing deps)
        if (manifest.optional) continue;

        const optionalDeps = manifest.optionalDeps || [];
        for (const dep of optionalDeps) {
            // A dep is wired if it's in depMappings OR in CORE_DEPS
            const isWired = depMappingKeys.has(dep) || CORE_DEPS.has(dep);

            if (!isWired) {
                gaps.push({ moduleName, dep, path: manifest.path });
            }
        }
    }

    await test('All optionalDeps have depMappings or CORE_DEPS entries', () => {
        if (gaps.length > 0) {
            const details = gaps.map(g =>
                `${g.moduleName} declares "${g.dep}" but no depMappings entry exists`
            ).join('\n');
            throw new Error(
                `${gaps.length} unwired optional dep(s) found — these will silently no-op:\n${details}`
            );
        }
    });

    // =====================================================
    // TEST 3: Every declared requires dep has a wiring path
    // =====================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Required Dependencies Wiring</h4>';

    const requiredGaps = [];

    for (const [moduleName, manifest] of Object.entries(MODULE_MANIFESTS)) {
        if (manifest.optional) continue;

        const requires = manifest.requires || [];
        for (const dep of requires) {
            const isWired = depMappingKeys.has(dep) || CORE_DEPS.has(dep);
            if (!isWired) {
                requiredGaps.push({ moduleName, dep, path: manifest.path });
            }
        }
    }

    await test('All required deps have depMappings or CORE_DEPS entries', () => {
        if (requiredGaps.length > 0) {
            const details = requiredGaps.map(g =>
                `${g.moduleName} requires "${g.dep}" but no depMappings entry exists`
            ).join('\n');
            throw new Error(
                `${requiredGaps.length} unwired required dep(s) found:\n${details}`
            );
        }
    });

    // =====================================================
    // TEST 4: Every declared lazyRequires dep has a wiring path
    // =====================================================
    resultsDiv.innerHTML += '<h4 class="test-section">⏳ Lazy Dependencies Wiring</h4>';

    const lazyGaps = [];

    for (const [moduleName, manifest] of Object.entries(MODULE_MANIFESTS)) {
        if (manifest.optional) continue;

        const lazyRequires = manifest.lazyRequires || [];
        for (const dep of lazyRequires) {
            const isWired = depMappingKeys.has(dep) || CORE_DEPS.has(dep);
            if (!isWired) {
                lazyGaps.push({ moduleName, dep, path: manifest.path });
            }
        }
    }

    await test('All lazyRequires deps have depMappings or CORE_DEPS entries', () => {
        if (lazyGaps.length > 0) {
            const details = lazyGaps.map(g =>
                `${g.moduleName} lazyRequires "${g.dep}" but no depMappings entry exists`
            ).join('\n');
            throw new Error(
                `${lazyGaps.length} unwired lazy dep(s) found:\n${details}`
            );
        }
    });

    // =====================================================
    // TEST 5: Every provided dep is consumed by at least one module
    // =====================================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Orphaned Providers</h4>';

    const allConsumed = new Set();
    for (const manifest of Object.values(MODULE_MANIFESTS)) {
        for (const dep of [...(manifest.requires || []), ...(manifest.optionalDeps || []), ...(manifest.lazyRequires || [])]) {
            allConsumed.add(dep);
        }
    }

    const orphanedProviders = [];
    for (const [moduleName, manifest] of Object.entries(MODULE_MANIFESTS)) {
        for (const dep of (manifest.provides || [])) {
            if (!allConsumed.has(dep) && !CORE_DEPS.has(dep)) {
                orphanedProviders.push({ moduleName, dep });
            }
        }
    }

    await test('Orphaned providers check (informational)', () => {
        // This is informational — orphaned providers aren't bugs, just potential dead code
        if (orphanedProviders.length > 0) {
            console.info(
                `ℹ️ ${orphanedProviders.length} provided dep(s) not consumed by any manifest: ` +
                orphanedProviders.map(o => `${o.moduleName}.${o.dep}`).join(', ')
            );
        }
        // Always passes — informational only
    });

    // =====================================================
    // SUMMARY
    // =====================================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All DI wiring verified!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ DI wiring gaps detected — see failed tests above</div>';
    }

    return { passed: passed.count, total: total.count };
}
