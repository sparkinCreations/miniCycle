/**
 * Orchestrator Tests
 * Tests for modules/boot/orchestrator.js
 *
 * The orchestrator has no named exports — tests verify the module loads without error.
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runOrchestratorTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    let mod, loadError;
    try {
        mod = await import(`../modules/boot/orchestrator.js?v=${cacheBuster}`);
    } catch (e) {
        loadError = e;
    }

    resultsDiv.innerHTML = '<h2>Orchestrator Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without throwing', () => {
        if (loadError) throw new Error(`Module failed to load: ${loadError.message}`);
    });

    await test('Module import resolves to an object', () => {
        if (typeof mod !== 'object' || mod === null) {
            throw new Error(`Expected object, got ${typeof mod}`);
        }
    });

    await test('Module has no syntax errors (import succeeded)', () => {
        // If we reach here, the module parsed and executed without syntax errors
        if (loadError) throw loadError;
    });

    await test('Module is a valid ES module namespace', () => {
        // ES module namespaces have a Symbol.toStringTag of 'Module'
        const tag = Object.prototype.toString.call(mod);
        if (tag !== '[object Module]') {
            throw new Error(`Expected [object Module], got ${tag}`);
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Boot Audit Regressions (M6)</h4>';

    await test('startOrchestrator failure routes through boot-error machinery (M6)', async () => {
        const response = await fetch('../modules/boot/orchestrator.js');
        const code = await response.text();
        // The startOrchestrator catch must not only log — a loadDependencies()
        // failure needs cache recovery or the boot-error screen, not a 60s
        // spinner + Lite redirect.
        if (!code.includes("showBootError('Dependency load'")) {
            throw new Error('M6 regression: startOrchestrator catch must call showBootError');
        }
        if (!code.includes("attemptCacheRecovery('orchestrator-startFailure')")) {
            throw new Error('M6 regression: startOrchestrator catch must fast-path cache-class errors');
        }
    });

    await test('initApp catch guards non-Error rejections (M6)', async () => {
        const response = await fetch('../modules/boot/orchestrator.js');
        const code = await response.text();
        // A string/undefined rejection has no .message — unguarded access threw
        // inside the catch and skipped the error screen and retry entirely.
        if (code.includes("const phase = error.message.includes")) {
            throw new Error('M6 regression: initApp catch reads error.message without ?. guard');
        }
        if (!code.includes("error?.message || ''")) {
            throw new Error('M6 regression: guarded errMsg extraction missing from initApp catch');
        }
    });

    await test('fallback BOOT_TIMEOUTS stays in sync with constants.js', async () => {
        const [orchCode, constantsMod] = await Promise.all([
            fetch('../modules/boot/orchestrator.js').then(r => r.text()),
            import(`../modules/core/constants.js?v=${cacheBuster}`)
        ]);
        const canonical = constantsMod.BOOT_TIMEOUTS;
        const match = orchCode.match(/const FALLBACK_BOOT_TIMEOUTS = Object\.freeze\(\{([\s\S]*?)\}\)/);
        if (!match) throw new Error('FALLBACK_BOOT_TIMEOUTS not found in orchestrator.js');
        for (const [key, value] of Object.entries(canonical)) {
            const entry = match[1].match(new RegExp(`${key}:\\s*(\\d+)`));
            if (!entry) throw new Error(`Fallback missing ${key} (canonical: ${value})`);
            if (Number(entry[1]) !== value) {
                throw new Error(`Fallback ${key}=${entry[1]} drifted from constants.js ${key}=${value}`);
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
