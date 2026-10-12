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
        const appState = { data: { routine: {} }, isDirty: true, isInitialized: true };
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
            schemaVersion: '2.6',
            metadata: { version: '2.5', schemaVersion: '2.6', lastModified: Date.now(), createdAt: Date.now() },
            settings: {},
            data: { routine: {
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
            appState: { activeRoutineId: 'kitchen' },
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
        if (stored.data.routine.kitchen.tasks.length !== 3) {
            throw new Error('fixture: localStorage should remain at the pre-quota 3-task document');
        }
        if (inner.data.routine.kitchen.tasks.length !== 4) {
            throw new Error(`backup used stale storage (${inner.data.routine.kitchen.tasks.length} tasks) instead of live AppState`);
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
        if (inner.data.routine.kitchen.tasks.length !== 4) {
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
        if (inner.data.routine.kitchen.tasks.length !== 4) {
            throw new Error('healthy flush path still must snapshot live state, not leftover storage');
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📁 Backup — save where the user chooses (saveBackupFileAs)</h4>';

    // Swap window.showSaveFilePicker for the duration of `run` (headless Chromium
    // has the real one, which would open a native dialog and hang the suite).
    async function withSavePicker(picker, run) {
        const had = Object.prototype.hasOwnProperty.call(window, 'showSaveFilePicker');
        const orig = window.showSaveFilePicker;
        if (picker === null) delete window.showSaveFilePicker; else window.showSaveFilePicker = picker;
        try { return await run(); }
        finally { if (had) window.showSaveFilePicker = orig; else delete window.showSaveFilePicker; }
    }
    // Async twin of captureBackupDownload: records what the <a download> fallback would ship.
    async function captureBackupDownloadAsync(run) {
        let payloadText = null; let clicked = 0;
        const OrigBlob = window.Blob, origClick = HTMLAnchorElement.prototype.click;
        const origCreate = URL.createObjectURL, origRevoke = URL.revokeObjectURL;
        window.Blob = function (parts, opts) { if (parts && typeof parts[0] === 'string') payloadText = parts[0]; return new OrigBlob(parts, opts); };
        URL.createObjectURL = () => 'blob:backup-test'; URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = () => { clicked++; };
        try { const result = await run(); return { result, payloadText, clicked }; }
        finally { window.Blob = OrigBlob; HTMLAnchorElement.prototype.click = origClick; URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke; }
    }
    const abortError = () => { const e = new Error('The user aborted a request.'); e.name = 'AbortError'; return e; };

    await test('with a Save dialog: writes the backup to the chosen file, suggests a .json name, records the timestamp', async () => {
        let stamped = null; let pickerOpts = null; const written = [];
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(2), forceSave: () => {}, update: (fn) => { const st = { settings: {} }; fn(st); stamped = st.settings.lastFileBackupTimestamp; } },
            showNotification: () => {}, showConfirmationModal: () => {}, safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.583' }
        });
        const picker = async (opts) => { pickerOpts = opts; return { name: 'my-routines.json', createWritable: async () => ({ write: async (b) => { written.push(b); }, close: async () => {} }) }; };
        const { result, clicked } = await captureBackupDownloadAsync(() => withSavePicker(picker, () => mod.saveBackupFileAs()));
        if (result !== 'saved') throw new Error(`expected 'saved', got ${JSON.stringify(result)}`);
        if (!pickerOpts || !/\.json$/.test(pickerOpts.suggestedName)) throw new Error('suggestedName should end in .json: ' + JSON.stringify(pickerOpts));
        if (!pickerOpts.types?.[0]?.accept?.['application/json']) throw new Error('dialog should filter to JSON files');
        if (written.length !== 1) throw new Error(`expected one write to the chosen file, got ${written.length}`);
        const parsed = JSON.parse(await written[0].text());
        if (!parsed.miniCycleData || parsed.backupMetadata?.version !== '2.583') throw new Error('written file is not a miniCycle backup: ' + JSON.stringify(parsed).slice(0, 120));
        if (clicked !== 0) throw new Error('must not ALSO trigger the download fallback');
        if (!stamped) throw new Error('lastFileBackupTimestamp not recorded');
    });

    await test("closing the Save dialog returns 'cancelled': no file, no download fallback, no timestamp", async () => {
        let stamped = false;
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => { stamped = true; } },
            showNotification: () => {}, showConfirmationModal: () => {}, safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.583' }
        });
        const { result, clicked, payloadText } = await captureBackupDownloadAsync(() => withSavePicker(async () => { throw abortError(); }, () => mod.saveBackupFileAs()));
        if (result !== 'cancelled') throw new Error(`expected 'cancelled', got ${JSON.stringify(result)}`);
        if (clicked !== 0 || payloadText !== null) throw new Error('a declined dialog must not fall back to a download');
        if (stamped) throw new Error('a cancelled backup must not record a timestamp');
    });

    await test('a Save dialog that fails for any other reason falls back to the plain download', async () => {
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => {} },
            showNotification: () => {}, showConfirmationModal: () => {}, safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.583' }
        });
        const { result, clicked, payloadText } = await captureBackupDownloadAsync(() => withSavePicker(async () => { throw new TypeError('not allowed in this context'); }, () => mod.saveBackupFileAs()));
        if (result !== 'saved') throw new Error(`expected 'saved' via download, got ${JSON.stringify(result)}`);
        if (clicked !== 1 || !payloadText) throw new Error('the download fallback did not run');
    });

    await test('without a Save dialog (Safari/Firefox): downloads, same as before', async () => {
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => {} },
            showNotification: () => {}, showConfirmationModal: () => {}, safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.583' }
        });
        const { result, clicked } = await captureBackupDownloadAsync(() => withSavePicker(null, () => mod.saveBackupFileAs()));
        if (result !== 'saved' || clicked !== 1) throw new Error(`expected a download, got result=${JSON.stringify(result)} clicks=${clicked}`);
    });

    await test('Backup All button: opens the Save dialog and skips the in-app name prompt', async () => {
        let prompts = 0; let pickerCalls = 0;
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => {} },
            showNotification: () => {}, showConfirmationModal: () => {}, showPromptModal: () => { prompts++; },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.598' }
        });
        let btn = document.getElementById('backup-mini-cycles');
        if (!btn) { btn = document.createElement('button'); btn.id = 'backup-mini-cycles'; document.body.appendChild(btn); }
        mod.setupBackupButton();   // idempotent — binds once for both clicks below
        const picker = async () => { pickerCalls++; return { name: 'chosen.json', createWritable: async () => ({ write: async () => {}, close: async () => {} }) }; };
        const { clicked } = await captureBackupDownloadAsync(() => withSavePicker(picker, async () => { btn.click(); await new Promise(r => setTimeout(r, 30)); }));
        if (pickerCalls !== 1) throw new Error(`the button should open the Save dialog once, opened ${pickerCalls}`);
        if (prompts !== 0) throw new Error('with a Save dialog the in-app name prompt is a second question — it must not show');
        if (clicked !== 0) throw new Error('must not ALSO download');
    });

    await test('Backup All button without a Save dialog: asks for a name in-app, then downloads (unchanged behaviour)', async () => {
        let promptOpts = null;
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => {} },
            showNotification: () => {}, showConfirmationModal: () => {}, showPromptModal: (opts) => { promptOpts = opts; },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.598' }
        });
        const btn = document.getElementById('backup-mini-cycles');
        const { clicked: before } = await captureBackupDownloadAsync(() => withSavePicker(null, async () => { btn.click(); await new Promise(r => setTimeout(r, 30)); }));
        if (!promptOpts) throw new Error('without a Save dialog the name prompt must open');
        if (before !== 0) throw new Error('nothing downloads until the prompt is answered');
        const { clicked, payloadText } = await captureBackupDownloadAsync(async () => { promptOpts.callback('my-backup'); });
        if (clicked !== 1 || !payloadText) throw new Error('answering the prompt must download the file');
    });

    // Swap globalThis.Capacitor for the duration of `run` — the bridge reads it
    // through isNativeApp() / isPluginAvailable() / Plugins[name].
    async function withCapacitor(stub, run) {
        const had = Object.prototype.hasOwnProperty.call(globalThis, 'Capacitor');
        const orig = globalThis.Capacitor;
        globalThis.Capacitor = stub;
        try { return await run(); }
        finally { if (had) globalThis.Capacitor = orig; else delete globalThis.Capacitor; }
    }
    const nativeStub = ({ onWrite, onShare, onSaveAs, platform = 'ios' }) => ({
        isNativePlatform: () => true, getPlatform: () => platform,
        // The SaveAs plugin is app-local to the Android shell: present only when a
        // stub supplies it, exactly as isPluginAvailable() reports on device.
        isPluginAvailable: (name) => name !== 'SaveAs' || typeof onSaveAs === 'function',
        Plugins: {
            SaveAs: { saveFile: async (o) => onSaveAs(o) },
            Filesystem: { writeFile: async (o) => { onWrite(o); return { uri: 'file:///cache/' + o.path }; }, getUri: async (o) => ({ uri: 'file:///cache/' + o.path }) },
            Share: { share: async (o) => onShare(o) },
        },
    });

    await test('iPhone / Android app: Backup All goes to the share sheet (Save to Files) — no download, no name prompt, timestamp on success', async () => {
        let prompts = 0; let stamped = null; let written = null; let shared = null; const notes = [];
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(2), forceSave: () => {}, update: (fn) => { const st = { settings: {} }; fn(st); stamped = st.settings.lastFileBackupTimestamp; } },
            showNotification: (msg, type) => { notes.push(type); }, showConfirmationModal: () => {}, showPromptModal: () => { prompts++; },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.599' }
        });
        const btn = document.getElementById('backup-mini-cycles');
        const stub = nativeStub({ onWrite: (o) => { written = o; }, onShare: (o) => { shared = o; } });
        const { clicked } = await captureBackupDownloadAsync(() => withCapacitor(stub, () => withSavePicker(null, async () => { btn.click(); await new Promise(r => setTimeout(r, 50)); })));
        if (!written || !/^mini-cycle-backup-\d{4}-\d{2}-\d{2}\.json$/.test(written.path)) throw new Error('expected the dated backup written for sharing, got ' + JSON.stringify(written && written.path));
        const parsed = JSON.parse(written.data);
        if (!parsed.miniCycleData || parsed.backupMetadata?.version !== '2.599') throw new Error('shared file is not a miniCycle backup');
        if (!shared || !Array.isArray(shared.files) || shared.files[0] !== 'file:///cache/' + written.path) throw new Error('share sheet did not receive the written file: ' + JSON.stringify(shared));
        if (clicked !== 0) throw new Error('must not ALSO click a download the WebView would drop');
        if (prompts !== 0) throw new Error('the share sheet names and places the file — no in-app name prompt');
        if (!stamped || !notes.includes('success')) throw new Error('a completed share must record the timestamp and say so');
    });

    await test('Android app: Backup All opens the system Save As dialog; a chosen location gets the backup and the timestamp', async () => {
        let asked = null; let written = 0; let stamped = null;
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: (fn) => { const st = { settings: {} }; fn(st); stamped = st.settings.lastFileBackupTimestamp; } },
            showNotification: () => {}, showConfirmationModal: () => {}, showPromptModal: () => {},
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.601' }
        });
        const stub = nativeStub({ platform: 'android', onSaveAs: (o) => { asked = o; return { saved: true, uri: 'content://docs/42' }; }, onWrite: () => { written++; }, onShare: () => { written++; } });
        const { result, clicked } = await captureBackupDownloadAsync(() => withCapacitor(stub, () => withSavePicker(null, () => mod.saveBackupFileAs())));
        if (result !== 'saved') throw new Error(`expected 'saved', got ${JSON.stringify(result)}`);
        if (!asked || !/^mini-cycle-backup-.*\.json$/.test(asked.fileName) || !asked.data.includes('miniCycleData')) throw new Error('the dialog must be offered the dated backup: ' + JSON.stringify(asked && asked.fileName));
        if (written !== 0 || clicked !== 0) throw new Error('a chosen location must not ALSO write to Documents, share, or download');
        if (!stamped) throw new Error('a saved backup records the timestamp');
    });

    await test('Android app: backing out of the Save As dialog is an answer — nothing written anywhere, cancelled reported', async () => {
        let elsewhere = 0; let stamped = false;
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => { stamped = true; } },
            showNotification: () => {}, showConfirmationModal: () => {}, showPromptModal: () => {},
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.601' }
        });
        const stub = nativeStub({ platform: 'android', onSaveAs: () => ({ cancelled: true }), onWrite: () => { elsewhere++; }, onShare: () => { elsewhere++; } });
        const { result, clicked } = await captureBackupDownloadAsync(() => withCapacitor(stub, () => withSavePicker(null, () => mod.saveBackupFileAs())));
        if (result !== 'cancelled') throw new Error(`expected 'cancelled', got ${JSON.stringify(result)} — the factory reset would wipe without a backup`);
        if (elsewhere !== 0 || clicked !== 0 || stamped) throw new Error('a declined dialog must not fall through to Documents, the share sheet, a download, or a timestamp');
    });

    await test('Android app without the SaveAs plugin: Backup All writes to the public Documents folder — no share sheet — and says where it went', async () => {
        let written = null; let shared = 0; let stamped = null; const msgs = [];
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: (fn) => { const st = { settings: {} }; fn(st); stamped = st.settings.lastFileBackupTimestamp; } },
            showNotification: (msg) => { msgs.push(msg); }, showConfirmationModal: () => {}, showPromptModal: () => {},
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.601' }
        });
        const stub = nativeStub({ platform: 'android', onWrite: (o) => { written = o; }, onShare: () => { shared++; } });
        const { result, clicked } = await captureBackupDownloadAsync(() => withCapacitor(stub, () => withSavePicker(null, () => mod.saveBackupFileAs())));
        if (result !== 'saved') throw new Error(`expected 'saved', got ${JSON.stringify(result)}`);
        if (!written || written.directory !== 'DOCUMENTS') throw new Error('expected a write into the public Documents folder, got ' + JSON.stringify(written && { path: written.path, directory: written.directory }));
        if (shared !== 0) throw new Error('Android must not open the share sheet when the write succeeded');
        if (clicked !== 0) throw new Error('must not click a download the WebView would drop');
        if (!stamped) throw new Error('a saved backup records the timestamp');
        if (!msgs.some(m => m.includes('Documents/') && m.includes(written.path))) throw new Error('the notice must name the file in Documents, got ' + JSON.stringify(msgs));
    });

    await test('Android app without the SaveAs plugin: if Documents refuses the write (Android 10), the share sheet is still offered', async () => {
        let shared = null;
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => {} },
            showNotification: () => {}, showConfirmationModal: () => {}, showPromptModal: () => {},
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.601' }
        });
        const stub = nativeStub({ platform: 'android', onWrite: (o) => { if (o.directory === 'DOCUMENTS') throw new Error('EACCES'); }, onShare: (o) => { shared = o; } });
        const { result } = await captureBackupDownloadAsync(() => withCapacitor(stub, () => withSavePicker(null, () => mod.saveBackupFileAs())));
        if (result !== 'saved' || !shared) throw new Error(`expected the share-sheet fallback, got result=${JSON.stringify(result)} shared=${!!shared}`);
    });

    await test('native app: a dismissed share sheet records nothing, says nothing, and reports cancelled to the factory reset', async () => {
        let stamped = false; const notes = [];
        mod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => { stamped = true; } },
            showNotification: (msg, type) => { notes.push(type); }, showConfirmationModal: () => {}, showPromptModal: () => {},
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn), AppMeta: { version: '2.599' }
        });
        const stub = nativeStub({ onWrite: () => {}, onShare: async () => { throw new Error('Share canceled'); } });
        const { result, clicked } = await captureBackupDownloadAsync(() => withCapacitor(stub, () => withSavePicker(null, () => mod.saveBackupFileAs())));
        if (result !== 'cancelled') throw new Error(`expected 'cancelled', got ${JSON.stringify(result)} — the reset would wipe without a backup`);
        if (stamped || notes.includes('success')) throw new Error('a dismissed sheet must not record a timestamp or claim success');
        if (clicked !== 0) throw new Error('a dismissed sheet must not fall back to a download');
    });

    await test('factory reset: cancelling the Save dialog deletes nothing and says so without an error tone', async () => {
        const origSWGetRegs = navigator.serviceWorker && navigator.serviceWorker.getRegistrations;
        const origCachesKeys = (typeof window.caches !== 'undefined') && window.caches.keys;
        const origIdbDelete = indexedDB.deleteDatabase;
        if (origSWGetRegs) navigator.serviceWorker.getRegistrations = async () => [];
        if (origCachesKeys) window.caches.keys = async () => [];
        let idbDeleteCalled = false;
        indexedDB.deleteDatabase = () => { idbDeleteCalled = true; const req = {}; setTimeout(() => { if (req.onsuccess) req.onsuccess({}); }, 0); return req; };
        localStorage.setItem('miniCycleData', JSON.stringify({ x: 1 }));
        const resetBtn = document.createElement('button');
        resetBtn.id = 'factory-reset';   // DOM_IDS.FACTORY_RESET
        document.body.appendChild(resetBtn);
        const notifications = [];
        let confirmPromise = null;
        const resetMod = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}-resetcancel`);
        resetMod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => {}, reload: () => {} },
            showNotification: (msg, type) => { notifications.push({ msg: String(msg), type }); },
            showConfirmationModal: (opts) => { confirmPromise = opts.callback(true); },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            appInit: { runInitialSetup: async () => {} },
            closeAllModals: () => {}, hideMainMenu: () => {}, showLoader: () => {}, hideLoader: () => {}
        });
        try {
            await withSavePicker(async () => { throw abortError(); }, async () => {
                resetMod.setupFactoryResetButton();
                resetBtn.click();
                await confirmPromise;
            });
            if (localStorage.getItem('miniCycleData') === null) throw new Error('a cancelled backup must NOT wipe data');
            if (idbDeleteCalled) throw new Error('a cancelled backup must not reach IndexedDB deletion');
            if (notifications.some(n => n.type === 'error')) throw new Error('declining the dialog is not an error: ' + JSON.stringify(notifications));
            if (!notifications.some(n => n.type === 'info' && /nothing was deleted/i.test(n.msg))) throw new Error('user should be told nothing was deleted: ' + JSON.stringify(notifications));
        } finally {
            indexedDB.deleteDatabase = origIdbDelete;
            if (origSWGetRegs) navigator.serviceWorker.getRegistrations = origSWGetRegs;
            if (origCachesKeys) window.caches.keys = origCachesKeys;
            resetBtn.remove();
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
            schemaVersion: '2.6',
            metadata: { version: '2.5', schemaVersion: '2.6', lastModified: Date.now(), createdAt: Date.now() },
            settings: { onboardingCompleted: true },
            data: { routine: { rescued: { id: 'rescued', title: 'Rescued Routine', tasks: [], cycleCount: 2,
                recurringTemplates: {}, history: { events: [], maxEvents: 100 },
                clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false } } } },
            appState: { activeRoutineId: 'rescued' },
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
        let undoCleared = false;
        mod.setBackupRestoreManagerDependencies({
            AppState: { get: () => ({}), forceSave: () => {} },
            showNotification: (msg) => notes.push(String(msg)),
            // Confirm both prompts: the restore itself, and the "no safety backup" one
            // that fires because BackupManager is absent here.
            showConfirmationModal: ({ callback }) => callback(true),
            safeAddEventListener: (el, ev, fn, opts) => el.addEventListener(ev, fn, opts),
            clearAllUndoHistory: async () => { undoCleared = true; }
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
            // Per-routine undo snapshots cannot undo a whole-document restore; they
            // would half-revert one routine. The stack must be cleared before the write.
            if (!undoCleared) throw new Error('undo history was not cleared before the file restore');
        } finally {
            btn.remove();
            document.getElementById('import-cycle-file-input')?.remove();
        }
    });

    // The pre-2.5 migration was retired Sep 2026 (SCHEMA_2_6_PLAN.md). A legacy
    // backup file must get the same message as any unreadable file — and must not
    // touch current data. The old branch DELETED miniCycleData before converting.
    await test('Settings restore survives a refused write (storage full): says so, keeps the old data, re-arms', async () => {
        // The restore neutralises AppState, then writes the document. A quota
        // error on that write used to escape the confirmation callback: the
        // promise never settled, state stayed neutralised, the app sat dead.
        const previous = JSON.stringify({ schemaVersion: '2.6', data: { routine: {} }, appState: {}, settings: {} });
        localStorage.setItem('miniCycleData', previous);
        const inner = JSON.stringify({
            schemaVersion: '2.6',
            metadata: { version: '2.5', schemaVersion: '2.6', lastModified: Date.now(), createdAt: Date.now() },
            settings: { onboardingCompleted: true },
            data: { routine: { r1: { id: 'r1', title: 'Big', tasks: [], cycleCount: 0,
                recurringTemplates: {}, history: { events: [], maxEvents: 100 },
                clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false } } } },
            appState: { activeRoutineId: 'r1' }, userProgress: {}, achievements: { unlocked: [], seen: {} }
        });
        const file = JSON.stringify({ type: 'miniCycle-backup', appVersion: '2.5', exportedAt: new Date().toISOString(), keys: { miniCycleData: inner } });
        const notes = [];
        // A separate module instance: setupRestoreButton() wires once per module
        // (_initialized.restoreButton), and the rescue test above used this one's.
        const fresh = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}-quota`);
        fresh.setBackupRestoreManagerDependencies({
            AppState: { get: () => ({}), forceSave: () => {}, reload: async () => {} },
            showNotification: (msg) => notes.push(String(msg)),
            showConfirmationModal: ({ callback }) => callback(true),
            safeAddEventListener: (el, ev, fn, opts) => el.addEventListener(ev, fn, opts),
            clearAllUndoHistory: async () => {}
        });
        const realSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
            if (key === 'miniCycleData' && value === inner) {
                const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err;
            }
            return realSetItem.call(this, key, value);
        };
        const btn = document.createElement('button');
        btn.id = 'restore-mini-cycles';
        document.body.appendChild(btn);
        try {
            fresh.setupRestoreButton();
            btn.click();
            const input = document.getElementById('import-cycle-file-input');
            if (!input) throw new Error('restore file input was never created');
            const dt = new DataTransfer();
            dt.items.add(new File([file], 'full.json', { type: 'application/json' }));
            input.files = dt.files;
            input.dispatchEvent(new Event('change'));
            for (let i = 0; i < 60 && !notes.some(n => /storage is full/i.test(n)); i++) {
                await new Promise(r => setTimeout(r, 50));
            }
            if (!notes.some(n => /storage is full/i.test(n))) throw new Error(`no storage-full notice; notices: ${notes.join(' | ')}`);
            if (localStorage.getItem('miniCycleData') !== previous) throw new Error('the previous document should be untouched');
            if (notes.some(n => /restored successfully/i.test(n))) throw new Error('must not claim success');
        } finally {
            Storage.prototype.setItem = realSetItem;
            btn.remove();
            document.getElementById('import-cycle-file-input')?.remove();
        }
    });

    await test('Settings restore survives a refused SIDE-KEY write: the document stays restored, the app re-arms, and it does not claim a full restore', async () => {
        // The main write is guarded (above). The theme/progress keys a rescue
        // export carries are written AFTER it; until Oct 2026 a refusal there
        // escaped the callback the same way — routines already restored, promise
        // never settled, app left un-armed.
        const previous = JSON.stringify({ schemaVersion: '2.6', data: { routine: {} }, appState: {}, settings: {} });
        localStorage.setItem('miniCycleData', previous);
        localStorage.removeItem('currentTheme');
        const inner = JSON.stringify({
            schemaVersion: '2.6',
            metadata: { version: '2.5', schemaVersion: '2.6', lastModified: Date.now(), createdAt: Date.now() },
            settings: { onboardingCompleted: true },
            data: { routine: { r1: { id: 'r1', title: 'Restored', tasks: [], cycleCount: 0,
                recurringTemplates: {}, history: { events: [], maxEvents: 100 },
                clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false } } } },
            appState: { activeRoutineId: 'r1' }, userProgress: {}, achievements: { unlocked: [], seen: {} }
        });
        const file = JSON.stringify({ type: 'miniCycle-backup', appVersion: '2.5', exportedAt: new Date().toISOString(),
            keys: { miniCycleData: inner, currentTheme: 'dark-ocean' } });
        const notes = [];
        let reloaded = 0;
        const fresh = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}-sidekey`);
        fresh.setBackupRestoreManagerDependencies({
            AppState: { get: () => ({}), forceSave: () => {}, reload: async () => { reloaded++; } },
            showNotification: (msg) => notes.push(String(msg)),
            showConfirmationModal: ({ callback }) => callback(true),
            safeAddEventListener: (el, ev, fn, opts) => el.addEventListener(ev, fn, opts),
            clearAllUndoHistory: async () => {}
        });
        const realSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
            if (key === 'currentTheme') {
                const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err;
            }
            return realSetItem.call(this, key, value);
        };
        const btn = document.createElement('button');
        btn.id = 'restore-mini-cycles';
        document.body.appendChild(btn);
        try {
            fresh.setupRestoreButton();
            btn.click();
            const input = document.getElementById('import-cycle-file-input');
            if (!input) throw new Error('restore file input was never created');
            const dt = new DataTransfer();
            dt.items.add(new File([file], 'rescue.json', { type: 'application/json' }));
            input.files = dt.files;
            input.dispatchEvent(new Event('change'));
            for (let i = 0; i < 60 && !notes.some(n => /routines were restored/i.test(n)); i++) {
                await new Promise(r => setTimeout(r, 50));
            }
            if (!notes.some(n => /routines were restored, but/i.test(n))) throw new Error(`no partial-restore notice; notices: ${notes.join(' | ')}`);
            if (notes.some(n => /restored successfully/i.test(n))) throw new Error('must not claim a full restore');
            if (localStorage.getItem('miniCycleData') !== inner) throw new Error('the restored document should be in storage');
            if (localStorage.getItem('currentTheme') !== null) throw new Error('the refused key must not have landed');
            // reloadWithLoader re-arms AppState on a short timer after the notice.
            for (let i = 0; i < 40 && reloaded === 0; i++) await new Promise(r => setTimeout(r, 50));
            if (reloaded === 0) throw new Error('the app was never re-armed (AppState.reload not called) — the old dead-app shape');
        } finally {
            Storage.prototype.setItem = realSetItem;
            btn.remove();
            document.getElementById('import-cycle-file-input')?.remove();
        }
    });

    await test('Settings restore rejects a pre-2.5 backup without touching current data', async () => {
        // A separate module instance: setupRestoreButton() wires once per module
        // (_initialized.restoreButton), and the test above already used this one's.
        const fresh = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}-legacy`);
        const current = JSON.stringify({ schemaVersion: '2.6', sentinel: 'current-data' });
        localStorage.setItem('miniCycleData', current);
        localStorage.removeItem('miniCycleStorage');
        localStorage.removeItem('lastUsedMiniCycle');
        const legacyFile = JSON.stringify({
            schemaVersion: 'legacy',
            miniCycleStorage: JSON.stringify({ Morning: { title: 'Morning', tasks: [] } }),
            lastUsedMiniCycle: 'Morning'
        });

        const notes = [];
        fresh.setBackupRestoreManagerDependencies({
            AppState: { get: () => ({}), forceSave: () => {} },
            showNotification: (msg) => notes.push(String(msg)),
            showConfirmationModal: ({ callback }) => callback(true),
            safeAddEventListener: (el, ev, fn, opts) => el.addEventListener(ev, fn, opts)
        });

        const btn = document.createElement('button');
        btn.id = 'restore-mini-cycles';   // DOM_IDS.RESTORE_MINI_CYCLES
        document.body.appendChild(btn);
        try {
            fresh.setupRestoreButton();
            btn.click();
            const input = document.getElementById('import-cycle-file-input');
            if (!input) throw new Error('restore file input was never created');
            const dt = new DataTransfer();
            dt.items.add(new File([legacyFile], 'legacy.json', { type: 'application/json' }));
            input.files = dt.files;
            input.dispatchEvent(new Event('change'));

            for (let i = 0; i < 60 && !notes.some(n => n.includes('Invalid file format')); i++) {
                await new Promise(r => setTimeout(r, 50));
            }
            if (!notes.some(n => n.includes('Invalid file format'))) {
                throw new Error(`expected the unreadable-file message, got: ${JSON.stringify(notes)}`);
            }
            if (localStorage.getItem('miniCycleData') !== current) throw new Error('current data was changed by a rejected legacy restore');
            if (localStorage.getItem('miniCycleStorage') !== null || localStorage.getItem('lastUsedMiniCycle') !== null) {
                throw new Error('legacy keys were written by a rejected restore');
            }
        } finally {
            btn.remove();
            document.getElementById('import-cycle-file-input')?.remove();
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏭 Factory Reset</h4>';

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🗂️ Pre-migration copy (Settings → Data Management)</h4>';

    const PRE_PREFIX = 'miniCycleData_pre-migration_';   // PRE_MIGRATION_BACKUP_PREFIX
    const legacyDoc = () => JSON.stringify({
        schemaVersion: '2.5',
        metadata: { version: '2.5', schemaVersion: '2.5', createdAt: 1, lastModified: 2 },
        settings: { onboardingCompleted: true },
        data: { cycles: { Morning: { id: 'Morning', title: 'Morning', tasks: [{ id: 't1', text: 'Stretch', completed: false }], cycleCount: 1 } } },
        appState: { activeCycleId: 'Morning' },
        userProgress: {}
    });
    const clearCopies = () => Object.keys(localStorage).filter(k => k.startsWith(PRE_PREFIX)).forEach(k => localStorage.removeItem(k));

    // One block for the whole group: setupPreMigrationCopyControls() wires its
    // listeners once per module instance, so the elements must outlive the tests.
    const preBlock = document.createElement('div');
    preBlock.id = 'pre-migration-copy';
    preBlock.hidden = true;
    preBlock.innerHTML = '<p id="pre-migration-copy-desc"></p>'
        + '<button id="pre-migration-download"></button>'
        + '<button id="pre-migration-restore"></button>'
        + '<button id="pre-migration-delete"></button>';
    document.body.appendChild(preBlock);

    const wirePre = (over = {}) => mod.setBackupRestoreManagerDependencies({
        AppState: { isReady: () => true, get: () => ({}), forceSave: () => {}, reload: () => {}, update: () => {} },
        showNotification: () => {},
        showConfirmationModal: ({ callback }) => callback(true),
        safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
        ...over
    });

    try {
        await test('pre-migration copy: the block stays hidden while no copy exists', () => {
            clearCopies();
            wirePre();
            mod.setupPreMigrationCopyControls();
            if (!preBlock.hidden) throw new Error('block shown with no copy in storage');
        });

        await test('pre-migration copy: the block shows and names the copy date', () => {
            clearCopies();
            const ts = Date.UTC(2026, 8, 19, 12, 0, 0);
            localStorage.setItem(PRE_PREFIX + ts, legacyDoc());
            wirePre();
            mod.refreshPreMigrationCopyControls();
            const desc = document.getElementById('pre-migration-copy-desc').textContent;
            if (preBlock.hidden) throw new Error('block hidden although a copy exists');
            if (!/2026/.test(desc)) throw new Error('description does not carry the copy date: ' + desc);
            const found = mod.findPreMigrationCopy();
            if (!found || found.timestamp !== ts || found.raw !== legacyDoc()) throw new Error('findPreMigrationCopy did not return the stored copy');
        });

        await test('pre-migration copy: the newest of several copies wins', () => {
            clearCopies();
            localStorage.setItem(PRE_PREFIX + '1000', 'older');
            localStorage.setItem(PRE_PREFIX + '2000', legacyDoc());
            localStorage.setItem(PRE_PREFIX + 'garbage', 'x');
            const found = mod.findPreMigrationCopy();
            if (!found || found.timestamp !== 2000) throw new Error('expected the newest numeric copy, got ' + JSON.stringify(found && found.timestamp));
        });

        await test('pre-migration copy: download builds a backup file Restore All Routines reads (raw bytes, 2.5 stamps)', () => {
            clearCopies();
            const raw = legacyDoc();
            localStorage.setItem(PRE_PREFIX + '3000', raw);
            const payload = mod.buildPreMigrationBackupPayload(mod.findPreMigrationCopy());
            if (!payload) throw new Error('no payload built for a readable copy');
            if (payload.miniCycleData !== raw) throw new Error('the document inside the file is not the raw copy');
            if (payload.schemaVersion !== '2.5' || payload.backupMetadata.schemaVersion !== '2.5') throw new Error('file is not stamped 2.5: ' + JSON.stringify(payload.schemaVersion));
            if (payload.backupMetadata.createdAt !== 3000) throw new Error('createdAt is not the copy timestamp');
            if (mod.buildPreMigrationBackupPayload({ timestamp: 1, raw: 'not json' }) !== null) throw new Error('an unreadable copy produced a payload');
        });

        await test('pre-migration copy: restore writes the raw document back, drops the copy, clears undo, re-renders', async () => {
            clearCopies();
            const raw = legacyDoc();
            localStorage.setItem(PRE_PREFIX + '4000', raw);
            localStorage.setItem('miniCycleData', JSON.stringify({ schemaVersion: '2.6', data: { routine: {} }, appState: {}, metadata: {} }));
            let undoCleared = false, reloaded = false, rendered = false;
            const confirms = [];
            wirePre({
                showConfirmationModal: ({ title, callback }) => { confirms.push(title); callback(true); },
                clearAllUndoHistory: async () => { undoCleared = true; },
                AppState: { isReady: () => true, get: () => ({}), forceSave: () => {}, reload: () => { reloaded = true; }, update: () => {} },
                loadMiniCycle: () => { rendered = true; }
            });
            const ok = await mod.restorePreMigrationCopy();
            if (!ok) throw new Error('restore reported failure');
            if (localStorage.getItem('miniCycleData') !== raw) throw new Error('the raw copy was not written back to miniCycleData');
            if (localStorage.getItem(PRE_PREFIX + '4000') !== null) throw new Error('the copy restored from was left behind');
            if (!undoCleared) throw new Error('undo history was not cleared');
            // Two prompts: the restore itself, then "no safety backup" (BackupManager absent here).
            if (confirms.length !== 2) throw new Error('expected 2 confirmations, got ' + confirms.length);
            for (let i = 0; i < 40 && !rendered; i++) await new Promise(r => setTimeout(r, 50));
            if (!reloaded || !rendered) throw new Error('the in-place reload did not run (reload=' + reloaded + ', render=' + rendered + ')');
        });

        await test('pre-migration copy: a declined confirmation changes nothing', async () => {
            clearCopies();
            const raw = legacyDoc();
            const current = JSON.stringify({ schemaVersion: '2.6', data: { routine: {} }, appState: {}, metadata: {} });
            localStorage.setItem(PRE_PREFIX + '5000', raw);
            localStorage.setItem('miniCycleData', current);
            wirePre({ showConfirmationModal: ({ callback }) => callback(false) });
            const ok = await mod.restorePreMigrationCopy();
            if (ok) throw new Error('restore reported success after a decline');
            if (localStorage.getItem('miniCycleData') !== current) throw new Error('current data changed after a decline');
            if (localStorage.getItem(PRE_PREFIX + '5000') !== raw) throw new Error('the copy changed after a decline');
        });

        await test('pre-migration copy: delete removes every copy after confirmation and hides the block', async () => {
            clearCopies();
            localStorage.setItem(PRE_PREFIX + '6000', legacyDoc());
            localStorage.setItem(PRE_PREFIX + '6001', legacyDoc());
            wirePre({ showConfirmationModal: ({ callback }) => callback(false) });
            if (await mod.deletePreMigrationCopy()) throw new Error('deleted after a decline');
            if (Object.keys(localStorage).filter(k => k.startsWith(PRE_PREFIX)).length !== 2) throw new Error('copies changed after a decline');
            wirePre();
            if (!(await mod.deletePreMigrationCopy())) throw new Error('delete reported failure');
            if (Object.keys(localStorage).filter(k => k.startsWith(PRE_PREFIX)).length !== 0) throw new Error('a copy survived the delete');
            mod.refreshPreMigrationCopyControls();
            if (!preBlock.hidden) throw new Error('block still shown after the delete');
        });
    } finally {
        clearCopies();
        preBlock.remove();
    }

    await test('factory reset: the confirmation offers a "skip the backup" opt-out, unchecked by default', async () => {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'factory-reset';   // DOM_IDS.FACTORY_RESET
        document.body.appendChild(resetBtn);
        let confirmOpts = null;
        const resetMod = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}-skipoffer`);
        resetMod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => {}, reload: () => {} },
            showNotification: () => {},
            showConfirmationModal: (opts) => { confirmOpts = opts; opts.callback(false); },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            appInit: { runInitialSetup: async () => {} },
            closeAllModals: () => {}, hideMainMenu: () => {}, showLoader: () => {}, hideLoader: () => {}
        });
        try {
            resetMod.setupFactoryResetButton();
            resetBtn.click();
            if (!confirmOpts) throw new Error('confirmation modal not shown');
            if (!confirmOpts.checkbox || typeof confirmOpts.checkbox.label !== 'string' || !confirmOpts.checkbox.label) {
                throw new Error('confirmation should carry a checkbox with a label: ' + JSON.stringify(confirmOpts.checkbox));
            }
            if (confirmOpts.checkbox.checked) throw new Error('the skip-backup opt-out must be unchecked by default');
            if (!/skip/i.test(confirmOpts.checkbox.label) || !/cannot be recovered/i.test(confirmOpts.checkbox.label)) {
                throw new Error('label should say it skips the backup and that data cannot be recovered: ' + confirmOpts.checkbox.label);
            }
        } finally {
            resetBtn.remove();
        }
    });

    await test('factory reset: with the opt-out ticked, the wipe runs WITHOUT saving a backup', async () => {
        const origSWGetRegs = navigator.serviceWorker && navigator.serviceWorker.getRegistrations;
        const origCachesKeys = (typeof window.caches !== 'undefined') && window.caches.keys;
        const origIdbDelete = indexedDB.deleteDatabase;
        if (origSWGetRegs) navigator.serviceWorker.getRegistrations = async () => [];
        if (origCachesKeys) window.caches.keys = async () => [];
        indexedDB.deleteDatabase = () => { const req = {}; setTimeout(() => { if (req.onsuccess) req.onsuccess({}); }, 0); return req; };
        localStorage.setItem('miniCycleData', JSON.stringify({ x: 1 }));
        const resetBtn = document.createElement('button');
        resetBtn.id = 'factory-reset';   // DOM_IDS.FACTORY_RESET
        document.body.appendChild(resetBtn);
        const notifications = [];
        let confirmPromise = null;
        let pickerCalls = 0;
        const resetMod = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}-skipwipe`);
        resetMod.setBackupRestoreManagerDependencies({
            AppState: { isReady: () => true, get: () => makeExportableState(1), forceSave: () => {}, update: () => {}, reload: () => {} },
            showNotification: (msg, type) => { notifications.push({ msg: String(msg), type }); },
            // The user ticks "skip the backup" and confirms.
            showConfirmationModal: (opts) => { confirmPromise = opts.callback(true, { checked: true }); },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            appInit: { runInitialSetup: async () => {} },
            closeAllModals: () => {}, hideMainMenu: () => {}, showLoader: () => {}, hideLoader: () => {}
        });
        try {
            // If the reset still tried to back up, the picker would be hit (and
            // its abort would cancel the wipe) — so a wipe proves the skip.
            const { clicked } = await captureBackupDownloadAsync(() => withSavePicker(async () => { pickerCalls++; throw abortError(); }, async () => {
                resetMod.setupFactoryResetButton();
                resetBtn.click();
                await confirmPromise;
            }));
            if (pickerCalls !== 0) throw new Error('skip-backup must not open the Save dialog');
            if (clicked !== 0) throw new Error('skip-backup must not fall back to a download either');
            if (localStorage.getItem('miniCycleData') !== null) throw new Error('with the opt-out ticked the data should have been wiped');
            if (notifications.some(n => n.type === 'error')) throw new Error('no error expected: ' + JSON.stringify(notifications));
        } finally {
            indexedDB.deleteDatabase = origIdbDelete;
            if (origSWGetRegs) navigator.serviceWorker.getRegistrations = origSWGetRegs;
            if (origCachesKeys) window.caches.keys = origCachesKeys;
            resetBtn.remove();
        }
    });

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
            // No Save dialog here: headless Chromium auto-dismisses the real one,
            // which reads as "cancelled" — this test is about the FAILURE path
            // (nothing exportable), so take the download route.
            await withSavePicker(null, async () => {
                resetMod.setupFactoryResetButton();
                resetBtn.click();
                await confirmPromise;
            });

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
                data: { routine: {} }
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
            // The reset exports a backup BEFORE wiping, so the Save dialog has to be
            // stubbed or the reset correctly refuses to delete anything (headless
            // Chromium rejects the real picker with AbortError, which reads as
            // "the user declined").
            //
            // Supply a WORKING picker rather than deleting the API. Deleting it sends
            // saveBackupFileAs down its `<a download>` fallback — and that fallback
            // really downloads. This suite also runs IN THE LIVE APP from the Testing
            // modal, where that dropped a mini-cycle-backup-<date>.json into the
            // user's Downloads folder on every single run (measured Oct 2026, traced
            // from the anchor click back to this line). A test must not hand the user
            // a file.
            //
            // captureBackupDownloadAsync is both a second line of defence and the
            // assertion: if the picker stub ever stops working, `clicked` catches the
            // regression here instead of a stray file appearing in someone's browser.
            confirmValue = true;
            let pickerUsed = 0;
            const savingPicker = async () => {
                pickerUsed++;
                return {
                    name: 'reset-backup.json',
                    createWritable: async () => ({ write: async () => {}, close: async () => {} })
                };
            };
            const { clicked: fellBackToDownload } = await captureBackupDownloadAsync(() =>
                withSavePicker(savingPicker, async () => {
                    resetBtn.click();
                    await confirmPromise;
                })
            );
            if (pickerUsed === 0) {
                throw new Error('the reset never offered a Save dialog, so its pre-wipe backup gate went unexercised');
            }
            if (fellBackToDownload) {
                throw new Error('the reset fell back to an <a download> — in the live app that hands the user a file on every test run');
            }
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
