/**
 * StoragePersistence Tests
 * Tests for modules/storage/storagePersistence.js
 */
import { createProtectedTest } from './testHelpers.js';

export async function runStoragePersistenceTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/storage/storagePersistence.js?v=${cacheBuster}`);
    const { StoragePersistence, initStoragePersistence, storagePersistence } = mod;

    resultsDiv.innerHTML = '<h2>💾 StoragePersistence Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Run a scenario with a mocked navigator.storage, restored afterward. The
    // constructor reads navigator.storage.persist/persisted, so each scenario
    // builds a FRESH instance under its mock (never the real singleton).
    const withMockStorage = async (mockStorage, fn) => {
        const orig = Object.getOwnPropertyDescriptor(navigator, 'storage');
        try {
            Object.defineProperty(navigator, 'storage', { configurable: true, get: () => mockStorage });
            await fn();
        } finally {
            if (orig) Object.defineProperty(navigator, 'storage', orig);
            else delete navigator.storage;
        }
    };
    const tick = () => new Promise(r => setTimeout(r, 0));

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('exports class + singleton + init function', () => {
        if (typeof StoragePersistence !== 'function') throw new Error('StoragePersistence class missing');
        if (!storagePersistence) throw new Error('singleton missing');
        if (typeof initStoragePersistence !== 'function') throw new Error('initStoragePersistence missing');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🚫 Unsupported browser</h4>';

    await test('no-op when the Storage API is unavailable', async () => {
        await withMockStorage(undefined, async () => {
            const sp = new StoragePersistence();
            await sp.init(); // must not throw
            const status = await sp.getStatus();
            if (status.supported !== false) throw new Error('should report unsupported');
            sp.destroy();
        });
    });

    resultsDiv.innerHTML += '<h4 class="test-section">✅ Already persisted</h4>';

    await test('does not re-request when already persisted', async () => {
        let persistCalls = 0;
        await withMockStorage({
            persisted: async () => true,
            persist: async () => { persistCalls++; return true; }
        }, async () => {
            const sp = new StoragePersistence();
            await sp.init();
            if (persistCalls !== 0) throw new Error('should not call persist() when already granted');
            sp.destroy();
        });
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🙋 Request on boot</h4>';

    await test('requests persist() once when not yet granted', async () => {
        let persistCalls = 0;
        await withMockStorage({
            persisted: async () => false,
            persist: async () => { persistCalls++; return true; }
        }, async () => {
            const sp = new StoragePersistence();
            await sp.init();
            if (persistCalls !== 1) throw new Error('should request persist() once, got ' + persistCalls);
            sp.destroy();
        });
    });

    resultsDiv.innerHTML += '<h4 class="test-section">👆 Gesture retry</h4>';

    await test('re-requests on first user gesture when denied at boot', async () => {
        let persistCalls = 0;
        await withMockStorage({
            persisted: async () => false,
            persist: async () => { persistCalls++; return false; } // denied
        }, async () => {
            const sp = new StoragePersistence();
            await sp.init();
            if (persistCalls !== 1) throw new Error('boot should request once');
            document.dispatchEvent(new Event('pointerdown'));
            await tick();
            if (persistCalls !== 2) throw new Error('gesture should trigger a re-request, got ' + persistCalls);
            sp.destroy();
        });
    });

    await test('destroy() removes the gesture listener (no leak)', async () => {
        let persistCalls = 0;
        await withMockStorage({
            persisted: async () => false,
            persist: async () => { persistCalls++; return false; }
        }, async () => {
            const sp = new StoragePersistence();
            await sp.init(); // arms gesture retry (persistCalls = 1)
            sp.destroy();    // must remove the listener
            document.dispatchEvent(new Event('pointerdown'));
            await tick();
            if (persistCalls !== 1) throw new Error('destroy() should remove the gesture listener; got ' + persistCalls + ' calls');
        });
    });

    resultsDiv.innerHTML += '<h4 class="test-section">📊 getStatus</h4>';

    await test('getStatus surfaces persisted + estimate', async () => {
        await withMockStorage({
            persisted: async () => true,
            persist: async () => true,
            estimate: async () => ({ usage: 1234, quota: 5678 })
        }, async () => {
            const sp = new StoragePersistence();
            const status = await sp.getStatus();
            if (status.supported !== true) throw new Error('should be supported');
            if (status.persisted !== true) throw new Error('should report persisted');
            if (!status.estimate || status.estimate.quota !== 5678) throw new Error('should surface estimate');
            sp.destroy();
        });
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
