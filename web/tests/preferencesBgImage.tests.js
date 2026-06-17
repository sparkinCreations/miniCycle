/**
 * PreferencesBgImage Tests
 * Tests for modules/ui/preferencesBgImage.js
 *
 * Note: this module is a standalone sub-module (no diBase). Functions take
 * AppState / deps as explicit parameters, which makes them easy to drive
 * with plain mocks. IndexedDB-backed helpers are exercised against the real
 * browser IndexedDB (available in the Playwright test page).
 */
import { createProtectedTest } from './testHelpers.js';

export async function runPreferencesBgImageTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/preferencesBgImage.js?v=${cacheBuster}`);
    const {
        openBgImageDB, saveBgImage, loadBgImage, readFileAsDataURL,
        applyBgImage, removeBgImage, handleBgImageUpload, handleBgImageModeChange,
        updateBgImageUI, handleBgImageVisibleToggle, initBgImage
    } = mod;

    resultsDiv.innerHTML = '<h2>PreferencesBgImage Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── helpers ─────────────────────────────────────────────────────────────
    const makeAppState = (state) => {
        const s = state;
        return {
            get: () => s,
            update: (fn) => { fn(s); }
        };
    };

    const makeNotifier = () => {
        const calls = [];
        const fn = (...args) => calls.push(args);
        fn.calls = calls;
        return fn;
    };

    // A 1x1 transparent PNG data URL.
    const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const fakeFile = (name, type, size = 100) => ({
        name, type, size,
        // not a real File, but the module only reads name/type/size for validation
    });

    // Resets body/root state touched by applyBgImage between tests.
    const resetBgDom = () => {
        document.body.classList.remove('has-bg-image', 'bg-mode-cover', 'bg-mode-center', 'bg-mode-tile');
        document.documentElement.style.removeProperty('--custom-bg-image');
    };

    // Clean the IndexedDB store so DB tests are deterministic.
    const clearBgDb = async () => {
        try {
            const db = await openBgImageDB();
            await new Promise((resolve) => {
                const tx = db.transaction(['backgroundImage'], 'readwrite');
                tx.objectStore('backgroundImage').clear();
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => { db.close(); resolve(); };
            });
        } catch { /* ignore */ }
    };

    // ── exports / load checks (kept) ────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('all documented functions are exported', () => {
        const names = ['openBgImageDB', 'saveBgImage', 'loadBgImage', 'readFileAsDataURL',
            'applyBgImage', 'removeBgImage', 'handleBgImageUpload', 'handleBgImageModeChange',
            'updateBgImageUI', 'handleBgImageVisibleToggle', 'initBgImage'];
        names.forEach(n => { if (typeof mod[n] !== 'function') throw new Error(`${n} not exported`); });
    });

    // ── applyBgImage (DOM side effects) ─────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🖼️ applyBgImage</h4>';

    await test('applyBgImage sets --custom-bg-image and mode class', () => {
        resetBgDom();
        try {
            const AppState = makeAppState({ settings: { customColors: { showBgImage: true } } });
            applyBgImage('data:image/png;base64,XYZ', 'center', AppState);
            const cssVar = document.documentElement.style.getPropertyValue('--custom-bg-image');
            if (!cssVar.includes('XYZ')) throw new Error('css var not set: ' + cssVar);
            if (!document.body.classList.contains('bg-mode-center')) throw new Error('mode class missing');
            if (!document.body.classList.contains('has-bg-image')) throw new Error('has-bg-image missing (showBgImage=true)');
        } finally { resetBgDom(); }
    });

    await test('applyBgImage respects showBgImage=false (no has-bg-image class)', () => {
        resetBgDom();
        try {
            const AppState = makeAppState({ settings: { customColors: { showBgImage: false } } });
            applyBgImage('data:image/png;base64,ABC', 'cover', AppState);
            if (document.body.classList.contains('has-bg-image')) throw new Error('should not add has-bg-image when hidden');
            // but the css var is always set so it is ready when toggled on
            if (!document.documentElement.style.getPropertyValue('--custom-bg-image')) throw new Error('css var should still be set');
        } finally { resetBgDom(); }
    });

    await test('applyBgImage swaps mode class (removes prior mode)', () => {
        resetBgDom();
        try {
            const AppState = makeAppState({ settings: {} });
            applyBgImage('data:image/png;base64,A', 'cover', AppState);
            applyBgImage('data:image/png;base64,A', 'tile', AppState);
            if (document.body.classList.contains('bg-mode-cover')) throw new Error('old mode not removed');
            if (!document.body.classList.contains('bg-mode-tile')) throw new Error('new mode not applied');
        } finally { resetBgDom(); }
    });

    // ── handleBgImageVisibleToggle ──────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ visibility toggle</h4>';

    await test('toggle on adds has-bg-image and persists showBgImage=true', () => {
        resetBgDom();
        try {
            const AppState = makeAppState({ settings: {} });
            handleBgImageVisibleToggle(true, AppState);
            if (!document.body.classList.contains('has-bg-image')) throw new Error('class not added');
            if (AppState.get().settings.customColors.showBgImage !== true) throw new Error('not persisted true');
        } finally { resetBgDom(); }
    });

    await test('toggle off removes has-bg-image and persists showBgImage=false', () => {
        resetBgDom();
        document.body.classList.add('has-bg-image');
        try {
            const AppState = makeAppState({ settings: { customColors: {} } });
            handleBgImageVisibleToggle(false, AppState);
            if (document.body.classList.contains('has-bg-image')) throw new Error('class not removed');
            if (AppState.get().settings.customColors.showBgImage !== false) throw new Error('not persisted false');
        } finally { resetBgDom(); }
    });

    await test('toggle with null AppState still updates body class (no throw)', () => {
        resetBgDom();
        try {
            handleBgImageVisibleToggle(true, null);
            if (!document.body.classList.contains('has-bg-image')) throw new Error('class not toggled without AppState');
        } finally { resetBgDom(); }
    });

    // ── updateBgImageUI (injected getElementById) ───────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧩 updateBgImageUI</h4>';

    const buildBgUiEls = () => {
        const els = {
            'bg-image-options': Object.assign(document.createElement('div'), { style: {} }),
            'bg-image-remove-btn': Object.assign(document.createElement('button'), { style: {} }),
            'bg-image-preview': document.createElement('img'),
            'bg-image-mode': document.createElement('select'),
            'toggle-bg-image-visible': Object.assign(document.createElement('input'), { type: 'checkbox' })
        };
        // give the select a 'cover' option so .value assignment sticks
        ['cover', 'center', 'tile'].forEach(v => {
            const o = document.createElement('option'); o.value = v; els['bg-image-mode'].appendChild(o);
        });
        return els;
    };

    await test('updateBgImageUI with a dataUrl shows options + sets preview/mode', () => {
        const els = buildBgUiEls();
        const getElementById = (id) => els[id] || null;
        const AppState = makeAppState({ settings: { customColors: { showBgImage: true } } });
        updateBgImageUI('data:image/png;base64,Z', 'center', AppState, { getElementById });
        if (els['bg-image-options'].style.display !== 'block') throw new Error('options not shown');
        if (els['bg-image-remove-btn'].style.display !== 'inline-block') throw new Error('remove btn not shown');
        if (els['bg-image-preview'].src.indexOf('base64,Z') === -1) throw new Error('preview src wrong');
        if (els['bg-image-mode'].value !== 'center') throw new Error('mode select not set');
        if (els['toggle-bg-image-visible'].checked !== true) throw new Error('toggle not checked from prefs');
    });

    await test('updateBgImageUI with null dataUrl hides options + resets mode to cover', () => {
        const els = buildBgUiEls();
        els['bg-image-mode'].value = 'tile';
        const getElementById = (id) => els[id] || null;
        const AppState = makeAppState({ settings: {} });
        updateBgImageUI(null, 'tile', AppState, { getElementById });
        if (els['bg-image-options'].style.display !== 'none') throw new Error('options not hidden');
        if (els['bg-image-remove-btn'].style.display !== 'none') throw new Error('remove btn not hidden');
        if (els['bg-image-mode'].value !== 'cover') throw new Error('mode not reset to cover');
        if (els['bg-image-preview'].src && !els['bg-image-preview'].src.endsWith('/')) {
            // jsdom-less browser: empty src resolves to page URL; just ensure not the data url
            if (els['bg-image-preview'].src.includes('base64')) throw new Error('preview not cleared');
        }
    });

    await test('updateBgImageUI tolerates missing elements (getElementById returns null)', () => {
        const AppState = makeAppState({ settings: {} });
        updateBgImageUI('data:image/png;base64,Q', 'cover', AppState, { getElementById: () => null });
        // no throw = pass
    });

    // ── handleBgImageUpload validation (guard/error paths) ───────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🚫 upload validation</h4>';

    await test('upload with no file returns null and notifies nothing', async () => {
        const notify = makeNotifier();
        const event = { target: { files: [], value: 'x' } };
        const result = await handleBgImageUpload(event, { showNotification: notify, AppState: makeAppState({ settings: {} }) });
        if (result !== null) throw new Error('expected null for no file');
        if (notify.calls.length !== 0) throw new Error('should not notify when no file selected');
    });

    await test('upload resets input value (so same file re-selectable)', async () => {
        const event = { target: { files: [], value: 'somefile.png' } };
        await handleBgImageUpload(event, { showNotification: makeNotifier(), AppState: makeAppState({ settings: {} }) });
        if (event.target.value !== '') throw new Error('input value not reset');
    });

    await test('upload rejects SVG (blocked MIME) with error notification, returns null', async () => {
        const notify = makeNotifier();
        const event = { target: { files: [fakeFile('x.svg', 'image/svg+xml')], value: '' } };
        const result = await handleBgImageUpload(event, { showNotification: notify, AppState: makeAppState({ settings: {} }) });
        if (result !== null) throw new Error('SVG should be rejected');
        if (notify.calls.length !== 1 || notify.calls[0][1] !== 'error') throw new Error('expected one error notification');
    });

    await test('upload rejects oversized file (>20MB) with error, returns null', async () => {
        const notify = makeNotifier();
        const event = { target: { files: [fakeFile('big.png', 'image/png', 25 * 1024 * 1024)], value: '' } };
        const result = await handleBgImageUpload(event, { showNotification: notify, AppState: makeAppState({ settings: {} }) });
        if (result !== null) throw new Error('oversized should be rejected');
        if (notify.calls.length !== 1 || notify.calls[0][1] !== 'error') throw new Error('expected one error notification');
    });

    await test('upload rejects mismatched extension (.txt with image/png) returns null', async () => {
        const notify = makeNotifier();
        const event = { target: { files: [fakeFile('x.txt', 'image/png')], value: '' } };
        const result = await handleBgImageUpload(event, { showNotification: notify, AppState: makeAppState({ settings: {} }) });
        if (result !== null) throw new Error('bad extension should be rejected');
        if (notify.calls.length !== 1 || notify.calls[0][1] !== 'error') throw new Error('expected one error notification');
    });

    // ── readFileAsDataURL ───────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📄 readFileAsDataURL</h4>';

    await test('readFileAsDataURL resolves a data: URL for a Blob', async () => {
        const blob = new Blob(['hello'], { type: 'text/plain' });
        const url = await readFileAsDataURL(blob);
        if (typeof url !== 'string' || !url.startsWith('data:')) throw new Error('not a data url: ' + url);
    });

    // ── IndexedDB round-trip ────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">💾 IndexedDB persistence</h4>';

    await test('openBgImageDB creates the backgroundImage store', async () => {
        const db = await openBgImageDB();
        try {
            if (!db.objectStoreNames.contains('backgroundImage')) throw new Error('store missing');
        } finally { db.close(); }
    });

    await test('saveBgImage + loadBgImage round-trips dataUrl and mode', async () => {
        await clearBgDb();
        await saveBgImage(PNG_1x1, 'tile');
        const loaded = await loadBgImage();
        if (!loaded) throw new Error('nothing loaded');
        if (loaded.dataUrl !== PNG_1x1) throw new Error('dataUrl mismatch');
        if (loaded.mode !== 'tile') throw new Error('mode mismatch: ' + loaded.mode);
        await clearBgDb();
    });

    await test('loadBgImage returns null when nothing stored', async () => {
        await clearBgDb();
        const loaded = await loadBgImage();
        if (loaded !== null) throw new Error('expected null when empty');
    });

    await test('handleBgImageModeChange updates stored mode + body class', async () => {
        resetBgDom();
        await clearBgDb();
        try {
            await saveBgImage(PNG_1x1, 'cover');
            await handleBgImageModeChange('center');
            const loaded = await loadBgImage();
            if (loaded.mode !== 'center') throw new Error('mode not updated in DB: ' + loaded.mode);
            if (!document.body.classList.contains('bg-mode-center')) throw new Error('body mode class not applied');
        } finally { resetBgDom(); await clearBgDb(); }
    });

    await test('handleBgImageModeChange is a no-op when no image stored', async () => {
        resetBgDom();
        await clearBgDb();
        try {
            await handleBgImageModeChange('tile'); // bgData null -> early return
            if (document.body.classList.contains('bg-mode-tile')) throw new Error('should not apply class with no image');
        } finally { resetBgDom(); }
    });

    await test('removeBgImage clears DB entry + body classes + notifies', async () => {
        resetBgDom();
        await clearBgDb();
        try {
            await saveBgImage(PNG_1x1, 'cover');
            applyBgImage(PNG_1x1, 'cover', makeAppState({ settings: { customColors: { showBgImage: true } } }));
            const notify = makeNotifier();
            const ok = await removeBgImage({ showNotification: notify });
            if (ok !== true) throw new Error('removeBgImage should return true');
            if (document.body.classList.contains('has-bg-image')) throw new Error('has-bg-image not removed');
            const loaded = await loadBgImage();
            if (loaded !== null) throw new Error('DB entry not removed');
            if (notify.calls.length !== 1) throw new Error('expected a removal notification');
        } finally { resetBgDom(); await clearBgDb(); }
    });

    await test('initBgImage applies a stored image on startup', async () => {
        resetBgDom();
        await clearBgDb();
        try {
            await saveBgImage(PNG_1x1, 'center');
            const AppState = makeAppState({ settings: { customColors: { showBgImage: true } } });
            await initBgImage(AppState);
            if (!document.body.classList.contains('bg-mode-center')) throw new Error('stored image not applied on init');
        } finally { resetBgDom(); await clearBgDb(); }
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
