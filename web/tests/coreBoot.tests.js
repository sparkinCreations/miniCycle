/**
 * coreBoot.js Browser Tests
 * Tests for core boot module - verifies boot state and document markers
 *
 * @module tests/coreBoot.tests
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

export async function runCoreBootTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🚀 coreBoot Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createTest(resultsDiv, passed, total);

    // ===== BOOT STATE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Boot State Markers</h4>';

    await test('appBooted dataset attribute is valid if set', () => {
        const appBooted = document.documentElement.dataset.appBooted;
        if (appBooted !== undefined && appBooted !== 'true') {
            throw new Error(`appBooted should be 'true' or undefined, got: ${appBooted}`);
        }
    });

    await test('bootStartTime dataset attribute is valid if set', () => {
        const bootStartTime = document.documentElement.dataset.bootStartTime;
        if (bootStartTime !== undefined) {
            const parsed = parseInt(bootStartTime, 10);
            if (isNaN(parsed) || parsed <= 0) {
                throw new Error('bootStartTime should be a valid positive timestamp');
            }
        }
    });

    // ===== RECOVERY-FLAG LOGIC (real coreBoot exports) =====
    // Replaced a cluster of tests that exercised localStorage / JSON.parse PLATFORM
    // behavior and a hand-built mock object — none of which called coreBoot.
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Recovery flags</h4>';

    const loadCoreBoot = () => import(((globalThis.__MC_MODULE_MAP || {})['/modules/boot/coreBoot.js'] || '../modules/boot/coreBoot.js') + '?v=' + Date.now());

    await test('getRecoveryAttemptCount reflects sessionStorage and clearRecoveryFlags resets it', async () => {
        const { getRecoveryAttemptCount, clearRecoveryFlags } = await loadCoreBoot();
        clearRecoveryFlags();
        if (getRecoveryAttemptCount() !== 0) throw new Error('cleared counter should read 0');

        sessionStorage.setItem('_cacheRecoveryAttempts', '2');
        if (getRecoveryAttemptCount() !== 2) throw new Error('counter should reflect sessionStorage value');

        clearRecoveryFlags();
        if (getRecoveryAttemptCount() !== 0) throw new Error('clearRecoveryFlags should reset the counter');
    });

    await test('isRecoveryExhausted flips at the MAX_RECOVERY_ATTEMPTS (2) threshold', async () => {
        const { isRecoveryExhausted, clearRecoveryFlags } = await loadCoreBoot();
        try {
            clearRecoveryFlags();
            if (isRecoveryExhausted()) throw new Error('0 attempts should not be exhausted');

            sessionStorage.setItem('_cacheRecoveryAttempts', '1');
            if (isRecoveryExhausted()) throw new Error('1 attempt (< max) should not be exhausted');

            sessionStorage.setItem('_cacheRecoveryAttempts', '2');
            if (!isRecoveryExhausted()) throw new Error('2 attempts (>= max) should be exhausted');
        } finally {
            clearRecoveryFlags();
        }
    });

    // ===== MODULE STRUCTURE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📁 Module Structure</h4>';

    await test('coreBoot.js file is accessible', async () => {
        const response = await fetch((globalThis.__MC_MODULE_MAP || {})['/modules/boot/coreBoot.js'] || '../modules/boot/coreBoot.js');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    });

    await test('coreBoot.js exports data functions', async () => {
        const response = await fetch((globalThis.__MC_MODULE_MAP || {})['/modules/boot/coreBoot.js'] || '../modules/boot/coreBoot.js');
        const code = await response.text();

        if (!code.includes('loadMiniCycleData')) {
            throw new Error('loadMiniCycleData not found');
        }
        if (!code.includes('autoSave')) {
            throw new Error('autoSave not found');
        }
        if (!code.includes('updateCycleData')) {
            throw new Error('updateCycleData not found');
        }
    });

    await test('coreBoot.js sets boot flags', async () => {
        const response = await fetch((globalThis.__MC_MODULE_MAP || {})['/modules/boot/coreBoot.js'] || '../modules/boot/coreBoot.js');
        const code = await response.text();

        if (!code.includes("dataset.appBooted")) {
            throw new Error('Should set appBooted');
        }
    });

    await test('stale-constants path continues boot when recovery unavailable (M5)', async () => {
        if (globalThis.__MC_MODULE_MAP) { console.log('⏭️ skipped on bundled build — source-structural check (identifiers are minified; covered by the source CI run)'); return; }
        const response = await fetch((globalThis.__MC_MODULE_MAP || {})['/modules/boot/coreBoot.js'] || '../modules/boot/coreBoot.js');
        const code = await response.text();

        // Offline (or recovery-exhausted), returning null left the splash
        // screen up forever with no retry or error screen. The branch must
        // capture the recovery result and continue with fallback defaults
        // when no reload is coming.
        if (!code.includes('recoveryInitiated')) {
            throw new Error('M5 regression: stale-constants branch must capture handleStaleCacheRecovery() result');
        }
        if (!code.includes('Continuing boot with stale constants.js')) {
            throw new Error('M5 regression: continue-anyway path missing from stale-constants branch');
        }
    });

    // Summary
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round(passed.count/total.count*100)}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
