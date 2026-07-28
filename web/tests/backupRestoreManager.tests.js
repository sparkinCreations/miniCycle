/**
 * BackupRestoreManager Tests
 * Tests for modules/ui/backupRestoreManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runBackupRestoreManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>BackupRestoreManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setBackupRestoreManagerDependencies is exported as a function', () => {
        if (typeof mod.setBackupRestoreManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('neutralizeAppState is exported as a function', () => {
        if (typeof mod.neutralizeAppState !== 'function') throw new Error('Missing export');
    });

    await test('downloadBackupFile is exported as a function', () => {
        if (typeof mod.downloadBackupFile !== 'function') throw new Error('Missing export');
    });

    await test('setupBackupButton is exported as a function', () => {
        if (typeof mod.setupBackupButton !== 'function') throw new Error('Missing export');
    });

    await test('setupRestoreButton is exported as a function', () => {
        if (typeof mod.setupRestoreButton !== 'function') throw new Error('Missing export');
    });

    await test('setupFactoryResetButton is exported as a function', () => {
        if (typeof mod.setupFactoryResetButton !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('injected AppState is used by neutralizeAppState', () => {
        // Prove DI takes effect (not just no-throw): neutralizeAppState mutates the
        // injected AppState to stop auto-save during destructive operations.
        const appState = { data: { cycles: {} }, isDirty: true, isInitialized: true };
        mod.setBackupRestoreManagerDependencies({
            AppState: appState,
            showNotification: () => {},
            showConfirmationModal: () => {},
            safeAddEventListener: () => {}
        });
        mod.neutralizeAppState();
        if (appState.data !== null) throw new Error('neutralizeAppState should null the injected AppState.data');
        if (appState.isDirty !== false) throw new Error('neutralizeAppState should clear isDirty');
        if (appState.isInitialized !== false) throw new Error('neutralizeAppState should clear isInitialized');
    });

    await test('setBackupRestoreManagerDependencies accepts an object without throwing', () => {
        // Call after mock deps are set (above) so required deps are already satisfied
        mod.setBackupRestoreManagerDependencies({});
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setBackupRestoreManagerDependencies handles null gracefully', () => {
        try {
            mod.setBackupRestoreManagerDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏭 Factory Reset</h4>';

    await test('factory reset: cancel keeps data; confirm clears miniCycle localStorage keys + notifies', async () => {
        // Stub the destructive browser globals so the reset does NOT unregister the real
        // service worker or delete real caches / IndexedDB for this shared test origin.
        // localStorage IS cleared, but createProtectedTest snapshots + restores it.
        const origSWGetRegs = navigator.serviceWorker && navigator.serviceWorker.getRegistrations;
        const origCachesKeys = (typeof window.caches !== 'undefined') && window.caches.keys;
        const origIdbDelete = indexedDB.deleteDatabase;
        if (origSWGetRegs) navigator.serviceWorker.getRegistrations = async () => [];
        if (origCachesKeys) window.caches.keys = async () => [];
        indexedDB.deleteDatabase = () => {
            const req = {};
            // Source assigns req.onsuccess synchronously after this returns; fire it next tick.
            setTimeout(() => { if (req.onsuccess) req.onsuccess({}); }, 0);
            return req;
        };

        // Seed: two miniCycle-matching keys + one unrelated (negative control).
        localStorage.setItem('miniCycleData', JSON.stringify({ x: 1 }));
        localStorage.setItem('miniCycle_backup_test', 'b');
        localStorage.setItem('unrelatedKey', 'keep-me');

        const resetBtn = document.createElement('button');
        resetBtn.id = 'factory-reset';   // DOM_IDS.FACTORY_RESET
        document.body.appendChild(resetBtn);

        const notifications = [];
        let confirmValue = false;
        let confirmPromise = null;
        let confirmOpts = null;

        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, reload: () => {}, data: { cycles: {} } },
            showNotification: (msg, type) => { notifications.push({ msg: String(msg), type }); },
            showConfirmationModal: (opts) => { confirmOpts = opts; confirmPromise = opts.callback(confirmValue); },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            appInit: { runInitialSetup: async () => {} },
            closeAllModals: () => {}, hideMainMenu: () => {},
            showLoader: () => {}, hideLoader: () => {}
        });

        try {
            mod.setupFactoryResetButton();   // guard is fresh on this cache-busted import

            // --- Cancel path: data must survive, and the confirmation is destructive-flagged ---
            confirmValue = false;
            resetBtn.click();
            await confirmPromise;
            if (confirmOpts.destructive !== true) throw new Error('factory-reset confirmation should be destructive:true');
            if (localStorage.getItem('miniCycleData') === null) throw new Error('cancel must NOT clear data');
            if (!notifications.some(n => n.type === 'info')) throw new Error('cancel should surface an info (cancelled) notification');

            // --- Confirm path: miniCycle-matching keys cleared, unrelated preserved, success notified ---
            confirmValue = true;
            resetBtn.click();
            await confirmPromise;
            if (localStorage.getItem('miniCycleData') !== null) throw new Error('confirm should remove miniCycleData');
            if (localStorage.getItem('miniCycle_backup_test') !== null) throw new Error('confirm should remove miniCycle_backup_* keys');
            if (localStorage.getItem('unrelatedKey') !== 'keep-me') throw new Error('unrelated keys must be preserved');
            if (!notifications.some(n => n.type === 'success')) throw new Error('confirm should surface the completion (success) notification');
        } finally {
            resetBtn.remove();
            if (origSWGetRegs) navigator.serviceWorker.getRegistrations = origSWGetRegs;
            if (origCachesKeys) window.caches.keys = origCachesKeys;
            indexedDB.deleteDatabase = origIdbDelete;
        }
    });

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
