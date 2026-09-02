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
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Backup export — in-memory snapshot</h4>';

    function makeExportableState(taskCount) {
        const tasks = [];
        for (let i = 0; i < taskCount; i++) {
            tasks.push({ id: `t${i + 1}`, text: `Task ${i + 1}`, completed: false });
        }
        return {
            schemaVersion: '2.5',
            metadata: { version: '2.5', schemaVersion: '2.5', lastModified: Date.now(), createdAt: Date.now() },
            settings: {},
            data: {
                cycles: {
                    kitchen: {
                        id: 'kitchen',
                        title: 'Kitchen',
                        tasks,
                        cycleCount: 0,
                        recurringTemplates: {},
                        history: { events: [], maxEvents: 100 },
                        clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false }
                    }
                }
            },
            appState: { activeCycleId: 'kitchen' },
            userProgress: {},
            achievements: { unlocked: [], seen: {} }
        };
    }

    function captureBackupDownload(run) {
        let payloadText = null;
        const OrigBlob = window.Blob;
        const origClick = HTMLAnchorElement.prototype.click;
        const origCreate = URL.createObjectURL;
        const origRevoke = URL.revokeObjectURL;
        window.Blob = function (parts, opts) {
            if (parts && typeof parts[0] === 'string') payloadText = parts[0];
            return new OrigBlob(parts, opts);
        };
        URL.createObjectURL = () => 'blob:backup-test';
        URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = () => {};
        try {
            run();
            return payloadText;
        } finally {
            window.Blob = OrigBlob;
            HTMLAnchorElement.prototype.click = origClick;
            URL.createObjectURL = origCreate;
            URL.revokeObjectURL = origRevoke;
        }
    }

    function wireExportDeps(liveState, { forceSave = () => {} } = {}) {
        mod.setBackupRestoreManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => liveState,
                forceSave,
                update: () => {}
            },
            showNotification: () => {},
            showConfirmationModal: () => {},
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            AppMeta: { version: '2.523' }
        });
    }

    await test('export includes in-memory edits when localStorage is stale after a quota failure', () => {
        const live = makeExportableState(4);
        const stale = makeExportableState(3);
        localStorage.setItem('miniCycleData', JSON.stringify(stale));

        // Production-shaped quota flush. The real forceSave() is async AND never
        // throws: save() catches QuotaExceededError, raises the persistent
        // storage-full warning and returns (appState.js _handleQuotaError), so
        // the store is simply left at its last-accepted document. A synchronous
        // throw here would exercise a path production cannot reach — it only
        // ever hit the try/catch that used to wrap this call.
        wireExportDeps(live, { forceSave: async () => { /* write rejected; storage untouched */ } });

        const raw = captureBackupDownload(() => {
            if (mod.downloadBackupFile({ skipNamePrompt: true }) !== true) {
                throw new Error('downloadBackupFile should still initiate on quota flush failure');
            }
        });
        if (!raw) throw new Error('no backup blob was created');
        const file = JSON.parse(raw);
        const inner = JSON.parse(file.miniCycleData);
        const stored = JSON.parse(localStorage.getItem('miniCycleData'));
        if (stored.data.cycles.kitchen.tasks.length !== 3) {
            throw new Error('fixture: localStorage should remain at the pre-quota 3-task document');
        }
        if (inner.data.cycles.kitchen.tasks.length !== 4) {
            throw new Error(`backup used stale storage (${inner.data.cycles.kitchen.tasks.length} tasks) instead of live AppState`);
        }
    });

    await test('export succeeds from memory when no previous stored document exists', () => {
        localStorage.removeItem('miniCycleData');
        const live = makeExportableState(4);
        wireExportDeps(live, { forceSave: async () => { /* quota; nothing reaches storage */ } });

        const raw = captureBackupDownload(() => {
            mod.downloadBackupFile({ skipNamePrompt: true });
        });
        if (!raw) throw new Error('no backup blob was created with empty localStorage');
        const inner = JSON.parse(JSON.parse(raw).miniCycleData);
        if (inner.data.cycles.kitchen.tasks.length !== 4) {
            throw new Error('empty localStorage should not block an in-memory export');
        }
        if (localStorage.getItem('miniCycleData') !== null) {
            throw new Error('export must not require writing localStorage first');
        }
    });

    await test('healthy-storage export still serializes live AppState (pending edits)', () => {
        const live = makeExportableState(4);
        const stale = makeExportableState(3);
        localStorage.setItem('miniCycleData', JSON.stringify(stale));
        wireExportDeps(live, { forceSave: () => {} });

        const raw = captureBackupDownload(() => {
            mod.downloadBackupFile({ skipNamePrompt: true });
        });
        const inner = JSON.parse(JSON.parse(raw).miniCycleData);
        if (inner.data.cycles.kitchen.tasks.length !== 4) {
            throw new Error('healthy flush path still must snapshot live state, not leftover storage');
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">♻️ Restore — both backup formats</h4>';

    // The app writes TWO backup shapes and, until v2.506, each restore entry point
    // accepted only one of them: Settings took Create Backup's
    // { schemaVersion, miniCycleData }, the first-run screen took the pre-boot
    // rescue screen's { type:'miniCycle-backup', keys:{...} }, and neither took the
    // other's. A user's own backup was rejected on the first-run screen while
    // restoring fine from Settings — reported from a phone, invisible to every test.
    await test('Settings restore accepts a pre-boot rescue-screen backup ({ type, keys })', async () => {
        const inner = JSON.stringify({
            schemaVersion: '2.5',
            metadata: { version: '2.5', schemaVersion: '2.5', lastModified: Date.now(), createdAt: Date.now() },
            settings: { onboardingCompleted: true },
            data: { cycles: { rescued: { id: 'rescued', title: 'Rescued Routine', tasks: [], cycleCount: 2,
                recurringTemplates: {}, history: { events: [], maxEvents: 100 },
                clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false } } } },
            appState: { activeCycleId: 'rescued' },
            userProgress: { cyclesCompleted: 2 },
            achievements: { unlocked: [], seen: {} }
        });
        const rescueFile = JSON.stringify({
            type: 'miniCycle-backup',
            appVersion: '2.5',
            exportedAt: new Date().toISOString(),
            keys: {
                miniCycleData: inner,
                currentTheme: 'dark-ocean',
                // Not a key any exporter collects — must NOT be written back, so a
                // hand-edited file can't use restore to set arbitrary storage.
                evilKey: 'should-not-land'
            }
        });

        localStorage.removeItem('miniCycleData');
        localStorage.removeItem('currentTheme');
        localStorage.removeItem('evilKey');

        const notes = [];
        mod.setBackupRestoreManagerDependencies({
            AppState: { get: () => ({}), forceSave: () => {} },
            showNotification: (msg) => notes.push(String(msg)),
            // Confirm both prompts: the restore itself, and the "no safety backup" one
            // that fires because BackupManager is absent here.
            showConfirmationModal: ({ callback }) => callback(true),
            safeAddEventListener: (el, ev, fn, opts) => el.addEventListener(ev, fn, opts)
        });

        const btn = document.createElement('button');
        btn.id = 'restore-mini-cycles';   // DOM_IDS.RESTORE_MINI_CYCLES
        document.body.appendChild(btn);

        try {
            mod.setupRestoreButton();
            btn.click();

            const input = document.getElementById('import-cycle-file-input');
            if (!input) throw new Error('restore file input was never created');

            const dt = new DataTransfer();
            dt.items.add(new File([rescueFile], 'rescue.json', { type: 'application/json' }));
            input.files = dt.files;
            input.dispatchEvent(new Event('change'));

            // FileReader + the confirm chain are async; poll rather than fixed-sleep.
            for (let i = 0; i < 60 && localStorage.getItem('miniCycleData') === null; i++) {
                await new Promise(r => setTimeout(r, 50));
            }

            const restored = localStorage.getItem('miniCycleData');
            if (restored !== inner) {
                throw new Error(`miniCycleData not restored from the rescue payload (got ${restored === null ? 'null' : 'different content'})`);
            }
            if (localStorage.getItem('currentTheme') !== 'dark-ocean') {
                throw new Error(`theme key beside miniCycleData was dropped (got ${localStorage.getItem('currentTheme')})`);
            }
            if (localStorage.getItem('evilKey') !== null) {
                throw new Error('a key no exporter collects was written back — the restorable-key filter is not applied');
            }
        } finally {
            btn.remove();
            document.getElementById('import-cycle-file-input')?.remove();
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏭 Factory Reset</h4>';

    await test('factory reset: a failed pre-wipe backup blocks the wipe instead of deleting unprotected', async () => {
        // The reset destroys localStorage, sessionStorage, caches AND every app
        // IndexedDB database, so the downloaded file is the ONLY thing that can
        // outlive it. If that export produces nothing, wiping anyway is
        // unrecoverable data loss — so the reset must stop and say so.
        const origIdbDelete = indexedDB.deleteDatabase;
        const origSWGetRegs = navigator.serviceWorker && navigator.serviceWorker.getRegistrations;
        const origCachesKeys = (typeof window.caches !== 'undefined') && window.caches.keys;
        if (origSWGetRegs) navigator.serviceWorker.getRegistrations = async () => [];
        if (origCachesKeys) window.caches.keys = async () => [];
        let idbDeleteCalled = false;
        indexedDB.deleteDatabase = () => {
            idbDeleteCalled = true;
            const req = {};
            setTimeout(() => { if (req.onsuccess) req.onsuccess({}); }, 0);
            return req;
        };

        localStorage.setItem('miniCycleData', JSON.stringify({ x: 1 }));

        const resetBtn = document.createElement('button');
        resetBtn.id = 'factory-reset';   // DOM_IDS.FACTORY_RESET
        document.body.appendChild(resetBtn);

        const notifications = [];
        let confirmPromise = null;

        // setupFactoryResetButton() guards against double-init at MODULE scope,
        // so a second test sharing `mod` would silently get a no-op setup and
        // assert against a button with no handler. Fresh import, fresh guard.
        const resetMod = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}-resetblock`);

        resetMod.setBackupRestoreManagerDependencies({
            // isReady() true (so there IS data to lose) but get() returns null,
            // which is exactly how serializeLiveMiniCycleData reports "could not
            // build a backup".
            AppState: { isReady: () => true, get: () => null, forceSave: () => {}, update: () => {}, reload: () => {} },
            showNotification: (msg, type) => { notifications.push({ msg: String(msg), type }); },
            showConfirmationModal: (opts) => { confirmPromise = opts.callback(true); },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            appInit: { runInitialSetup: async () => {} },
            closeAllModals: () => {}, hideMainMenu: () => {},
            showLoader: () => {}, hideLoader: () => {}
        });

        try {
            resetMod.setupFactoryResetButton();
            resetBtn.click();
            await confirmPromise;

            if (localStorage.getItem('miniCycleData') === null) {
                throw new Error('a failed backup must NOT wipe data');
            }
            if (idbDeleteCalled) {
                throw new Error('a failed backup must not reach IndexedDB deletion');
            }
            if (!notifications.some(n => n.type === 'error')) {
                throw new Error('a blocked reset must tell the user why');
            }
        } finally {
            indexedDB.deleteDatabase = origIdbDelete;
            if (origSWGetRegs) navigator.serviceWorker.getRegistrations = origSWGetRegs;
            if (origCachesKeys) window.caches.keys = origCachesKeys;
            resetBtn.remove();
        }
    });

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
        // A plugin key the name-matching rule cannot see, and the device-gate
        // override that must OUTLIVE the wipe (clearing it sent old devices to
        // the frozen Lite app with no discoverable way back).
        localStorage.setItem('timeTrackerData', 'plugin-state');
        localStorage.setItem('miniCycleForceFullVersion', 'true');

        const resetBtn = document.createElement('button');
        resetBtn.id = 'factory-reset';   // DOM_IDS.FACTORY_RESET
        document.body.appendChild(resetBtn);

        const notifications = [];
        let confirmValue = false;
        let confirmPromise = null;
        let confirmOpts = null;

        mod.setBackupRestoreManagerDependencies({
            // Production-shaped: the reset now exports a backup BEFORE wiping,
            // and that export reads get() and calls update(). A double without
            // them fails the export, which correctly blocks the wipe — green
            // here would mean testing a path the app cannot take.
            AppState: {
                isReady: () => true,
                get: () => makeExportableState(2),
                forceSave: () => {},
                update: () => {},
                reload: () => {},
                data: { cycles: {} }
            },
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
            // Completion notice. Success when everything went, warning when a
            // database could not be deleted — and in THIS page both are legitimate:
            // the suite runs inside the live app, which holds its IndexedDB
            // connections open, so deleteDatabase is blocked and the warning is the
            // truthful outcome. What must never happen is silence.
            const completion = notifications.filter(n => n.type === 'success' || n.type === 'warning');
            if (completion.length === 0) throw new Error('confirm should surface a completion notification (success or partial)');

            if (localStorage.getItem('timeTrackerData') !== null) {
                throw new Error('confirm should remove plugin keys the name rule cannot match (timeTrackerData)');
            }
            if (localStorage.getItem('miniCycleForceFullVersion') !== 'true') {
                throw new Error('confirm must PRESERVE the full-version override, or old devices are sent to Lite');
            }
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
