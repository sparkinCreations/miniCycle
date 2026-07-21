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

    // ===== LOCALSTORAGE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📦 localStorage</h4>';

    await test('localStorage can store and retrieve data', () => {
        const testKey = 'coreBoot-test-key';
        const testData = { test: true, timestamp: Date.now() };

        localStorage.setItem(testKey, JSON.stringify(testData));
        const retrieved = JSON.parse(localStorage.getItem(testKey));
        localStorage.removeItem(testKey);

        if (!retrieved || !retrieved.test) {
            throw new Error('Failed to store/retrieve from localStorage');
        }
    });

    await test('Schema 2.5 structure can be created', () => {
        const mockData = {
            metadata: { version: '2.5', lastModified: Date.now() },
            settings: { theme: 'default' },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        const requiredProps = ['metadata', 'settings', 'data', 'appState'];
        for (const prop of requiredProps) {
            if (!(prop in mockData)) {
                throw new Error(`Missing property: ${prop}`);
            }
        }
    });

    await test('Empty localStorage returns null', () => {
        const key = 'nonexistent-key-12345';
        const data = localStorage.getItem(key);
        if (data !== null) {
            throw new Error('Non-existent key should return null');
        }
    });

    await test('Corrupted JSON can be detected', () => {
        const key = 'coreBoot-corrupt-test';
        localStorage.setItem(key, 'not-valid-json{{{');

        let parseError = null;
        try {
            JSON.parse(localStorage.getItem(key));
        } catch (e) {
            parseError = e;
        }
        localStorage.removeItem(key);

        if (!parseError) {
            throw new Error('Corrupted JSON should throw');
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
