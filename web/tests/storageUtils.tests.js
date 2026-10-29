/**
 * StorageUtils Tests
 * Tests for storage quota detection, size estimation, canAddToStorage, and formatBytes
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runStorageUtilsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/storageUtils.js?v=${cacheBuster}`);
    const {
        getLocalStorageUsedBytes, getStorageInfo, canAddToStorage,
        canAddObjectToStorage, estimateTaskSize, formatBytes,
        adjustStorageEstimate, getEstimatedUsedBytes, resetStorageEstimate,
        setStorageDependencies
    } = mod;

    resultsDiv.innerHTML = '<h2>StorageUtils Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('all key functions are exported', () => {
        const fns = [getLocalStorageUsedBytes, getStorageInfo, canAddToStorage,
            canAddObjectToStorage, estimateTaskSize, formatBytes,
            adjustStorageEstimate, getEstimatedUsedBytes, resetStorageEstimate];
        for (const fn of fns) {
            if (typeof fn !== 'function') throw new Error(`Missing export: ${fn}`);
        }
    });

    await test('setStorageDependencies is exported', () => {
        if (typeof setStorageDependencies !== 'function') throw new Error('DI setter not exported');
    });

    // ============================================
    // 📏 formatBytes
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📏 formatBytes</h4>';

    await test('formatBytes formats 0 bytes', () => {
        const result = formatBytes(0);
        if (!result.includes('0')) throw new Error(`Expected "0", got "${result}"`);
    });

    await test('formatBytes formats bytes', () => {
        const result = formatBytes(500);
        if (!result.includes('500') || !result.toLowerCase().includes('b')) {
            throw new Error(`Expected bytes format, got "${result}"`);
        }
    });

    await test('formatBytes formats bytes/KB/MB with correct units', () => {
        // Source: i===0 → "N B"; i===1 → "N KB" (rounded); else "N.NN MB". The old check
        // (`includes('kb') || includes('1.')`) would pass "1.5 bytes" (wrong unit) too.
        if (formatBytes(0) !== '0 B') throw new Error(`0 → "${formatBytes(0)}"`);
        if (formatBytes(512) !== '512 B') throw new Error(`512 → "${formatBytes(512)}"`);
        if (formatBytes(1500) !== '1 KB') throw new Error(`1500 → "${formatBytes(1500)}" (expected "1 KB")`);
        if (formatBytes(5 * 1024 * 1024) !== '5.00 MB') throw new Error(`5MB → "${formatBytes(5 * 1024 * 1024)}"`);
    });

    await test('formatBytes formats MB', () => {
        const result = formatBytes(2 * 1024 * 1024);
        if (!result.toLowerCase().includes('mb')) {
            throw new Error(`Expected MB format, got "${result}"`);
        }
    });

    // ============================================
    // 📐 estimateTaskSize
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📐 estimateTaskSize</h4>';

    await test('estimateTaskSize returns number', () => {
        const result = estimateTaskSize('Buy groceries');
        if (typeof result !== 'number') throw new Error(`Expected number, got ${typeof result}`);
    });

    await test('estimateTaskSize includes base overhead', () => {
        const result = estimateTaskSize('');
        if (result < 100) throw new Error(`Base overhead too low: ${result}`);
    });

    await test('estimateTaskSize increases with text length', () => {
        const short = estimateTaskSize('Hi');
        const long = estimateTaskSize('This is a much longer task description for testing');
        if (long <= short) throw new Error('Longer text should estimate higher');
    });

    // ============================================
    // 💾 getLocalStorageUsedBytes
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Storage Measurement</h4>';

    await test('getLocalStorageUsedBytes returns a number', () => {
        const bytes = getLocalStorageUsedBytes();
        if (typeof bytes !== 'number') throw new Error(`Expected number, got ${typeof bytes}`);
    });

    await test('getLocalStorageUsedBytes is non-negative', () => {
        const bytes = getLocalStorageUsedBytes();
        if (bytes < 0) throw new Error(`Expected non-negative, got ${bytes}`);
    });

    // ============================================
    // 📊 getStorageInfo
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📊 getStorageInfo</h4>';

    await test('getStorageInfo returns expected shape', () => {
        const info = getStorageInfo();
        if (typeof info !== 'object') throw new Error('Should return object');
        if (typeof info.used !== 'number') throw new Error('Missing used');
        if (typeof info.total !== 'number') throw new Error('Missing total');
        if (typeof info.available !== 'number') throw new Error('Missing available');
        if (typeof info.percentage !== 'number') throw new Error('Missing percentage');
        if (typeof info.status !== 'string') throw new Error('Missing status');
    });

    await test('getStorageInfo percentage is 0-100', () => {
        const info = getStorageInfo();
        if (info.percentage < 0 || info.percentage > 100) {
            throw new Error(`Percentage out of range: ${info.percentage}`);
        }
    });

    // ============================================
    // ✅ canAddToStorage
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">✅ canAddToStorage</h4>';

    await test('canAddToStorage returns object with allowed boolean', () => {
        const result = canAddToStorage(100);
        if (typeof result !== 'object') throw new Error('Should return object');
        if (typeof result.allowed !== 'boolean') throw new Error('Missing allowed boolean');
        if (typeof result.available !== 'number') throw new Error('Missing available');
        if (typeof result.needed !== 'number') throw new Error('Missing needed');
    });

    await test('canAddToStorage allows small additions', () => {
        const result = canAddToStorage(100);
        if (!result.allowed) throw new Error('Should allow adding 100 bytes');
    });

    await test('canAddObjectToStorage works with objects', () => {
        const result = canAddObjectToStorage({ key: 'value' });
        if (typeof result !== 'object') throw new Error('Should return object');
        if (typeof result.allowed !== 'boolean') throw new Error('Missing allowed boolean');
        if (typeof result.size !== 'number') throw new Error('Missing size');
    });

    // ============================================
    // 🔄 Estimate Tracking
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Estimate Tracking</h4>';

    await test('resetStorageEstimate does not throw', () => {
        resetStorageEstimate();
    });

    await test('getEstimatedUsedBytes returns a number', () => {
        const bytes = getEstimatedUsedBytes();
        if (typeof bytes !== 'number') throw new Error(`Expected number, got ${typeof bytes}`);
    });

    await test('adjustStorageEstimate modifies estimate', () => {
        resetStorageEstimate();
        const before = getEstimatedUsedBytes();
        adjustStorageEstimate(500);
        const after = getEstimatedUsedBytes();
        if (after <= before) throw new Error('Estimate should increase after positive adjustment');
    });

    // ============================================
    // 🧪 QUOTA DETECTION (Oct 2026)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧪 Quota Detection</h4>';

    // Each test imports a FRESH copy, so no session-cached quota carries over.
    let freshCopy = 0;
    const freshModule = () => import(`../modules/utils/storageUtils.js?v=${cacheBuster}-quota-${++freshCopy}`);
    const countProbeWrites = (fn) => {
        const orig = Storage.prototype.setItem;
        let writes = 0;
        Storage.prototype.setItem = function (key, value) {
            if (key === '__storage_quota_test__') writes++;
            return orig.call(this, key, value);
        };
        try { return { result: fn(), writes }; } finally { Storage.prototype.setItem = orig; }
    };
    const stateWith = (storageQuota) => ({
        isReady: () => true,
        get: () => ({ metadata: { storageQuota } }),
        update: () => {}
    });

    await test('quota detection is a binary search: a handful of writes, not one per 100KB', async () => {
        const m = await freshModule();
        m.setStorageDependencies({ AppState: null });
        const { result, writes } = countProbeWrites(() => m.detectStorageQuota(true));
        // The old walk wrote 100KB, 200KB, 300KB… — ~50 writes on a 5MB quota,
        // about 2s on desktop with the routine switcher's list waiting behind it.
        if (writes > 12) throw new Error(`${writes} probe writes — expected ~7`);
        if (result < 5 * 1024 * 1024) throw new Error(`detected ${result} bytes, below the 5MB floor`);
        if (localStorage.getItem('__storage_quota_test__') !== null) throw new Error('probe key left behind');
    });

    await test('a cached quota survives an app update (only a detection-method change re-runs it)', async () => {
        const m = await freshModule();
        m.setStorageDependencies({ AppState: stateWith({
            detectedBytes: 7 * 1024 * 1024, detectedAt: Date.now(), detectedVersion: '0.0.1', method: 2
        }) });
        const { result, writes } = countProbeWrites(() => m.detectStorageQuota());
        if (writes !== 0) throw new Error(`re-ran the probe (${writes} writes) for a cache from an older app version`);
        if (result !== 7 * 1024 * 1024) throw new Error(`expected the cached 7MB, got ${result}`);
    });

    await test('a cache from the old detection method is re-detected', async () => {
        const m = await freshModule();
        m.setStorageDependencies({ AppState: stateWith({
            detectedBytes: 7 * 1024 * 1024, detectedAt: Date.now(), detectedVersion: '0.0.1'   // no method: pre-Oct-2026
        }) });
        const { writes } = countProbeWrites(() => m.detectStorageQuota());
        if (writes === 0) throw new Error('kept a cache written by the old linear probe');
    });

    // ============================================
    // 📊 RESULTS
    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
