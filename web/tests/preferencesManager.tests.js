/**
 * PreferencesManager Tests
 * Tests for modules/ui/preferencesManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runPreferencesManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/preferencesManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>PreferencesManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    // =========================================================
    // 🔌 setupEventListeners wiring snapshot — WRITTEN BEFORE THE REFACTOR
    // =========================================================
    // setupEventListeners is 459 lines, ~23% of this file, and had ZERO test
    // references. It is being broken into per-concern private methods; that is
    // pure code MOTION, so the invariant that matters is simple and total: the
    // same set of (element, event) pairs must still be wired afterwards.
    //
    // This records the whole wiring map rather than asserting a handful of
    // elements, because the failure mode of moving 459 lines is not a crash — it
    // is one block quietly not running, leaving a control that silently does
    // nothing. A count plus a full pair list catches exactly that.

    /** Every id/selector the method wires, so the fixture DOM is complete. */
    const PREF_WIRED_IDS = [
        'open-preferences', 'personalization-btn', 'close-preferences-btn',
        'preferences-open-themes', 'pref-pattern-color', 'pref-pattern-opacity',
        'toggle-checkbox-fill', 'toggle-checkbox-incomplete', 'toggle-bg-pattern',
        'toggle-solid-list-bg', 'toggle-solid-stats-bg', 'toggle-bg-image-visible',
        'toggle-help-window', 'toggle-quick-actions', 'pref-toast-select',
        'toggle-completion-animation', 'toggle-completion-toast', 'preferences-reset-all',
        'pref-save-preset', 'pref-import-preset', 'preferences-undo',
        'bg-image-upload', 'bg-image-upload-btn', 'bg-image-remove-btn', 'bg-image-mode'
    ];

    function prefFixture() {
        const host = document.createElement('div');
        host.id = 'pref-wiring-fixture';
        host.innerHTML = PREF_WIRED_IDS.map(id =>
            `<input type="checkbox" id="${id}">`).join('')
            + '<div class="preferences-modal-content"></div>'
            + '<div class="preferences-section"><div class="preferences-section-header"></div></div>'
            + '<button class="quick-preset-btn"></button><button class="preferences-reset-btn"></button>';
        document.body.appendChild(host);
        return host;
    }

    /** Wire the manager with a spying safeAddEventListener and return the map. */
    function captureWiring() {
        const wired = [];
        mod.setPreferencesManagerDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {}, isReady: () => true },
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            safeAddEventListener: (el, event) => {
                wired.push(`${el?.id || el?.className || el?.nodeName || '?'}:${event}`);
            },
            showNotification: () => {}
        });
        const instance = new mod.PreferencesManager();
        instance.setupEventListeners();
        return wired;
    }

    await test('setupEventListeners wires a substantial, stable set of controls', async () => {
        const host = prefFixture();
        try {
            const wired = captureWiring();
            // Guards the whole point: if a moved block stops running, this drops.
            if (wired.length < 20) {
                throw new Error(`only ${wired.length} listener(s) wired — a block is not running: ${wired.join(', ')}`);
            }
        } finally { host.remove(); }
    });

    await test('setupEventListeners wires every toggle, input and action control', async () => {
        // Named explicitly so a silently-skipped section names itself in the failure.
        const host = prefFixture();
        try {
            const wired = captureWiring().join(' ');
            const expected = [
                'open-preferences', 'close-preferences-btn', 'preferences-open-themes',
                'pref-pattern-color', 'pref-pattern-opacity',
                'toggle-checkbox-fill', 'toggle-checkbox-incomplete', 'toggle-bg-pattern',
                'toggle-solid-list-bg', 'toggle-solid-stats-bg', 'toggle-bg-image-visible',
                'toggle-help-window', 'toggle-quick-actions',
                'pref-toast-select', 'toggle-completion-animation', 'toggle-completion-toast',
                'preferences-reset-all', 'pref-save-preset', 'pref-import-preset', 'preferences-undo'
            ];
            const missing = expected.filter(id => !wired.includes(id));
            if (missing.length) throw new Error(`not wired: ${missing.join(', ')}`);
        } finally { host.remove(); }
    });

    await test('setupEventListeners is idempotent in the wiring it reports', async () => {
        // Two runs on the same DOM must produce the same map; a refactor that made
        // one section conditional on first-run state would show up here.
        const host = prefFixture();
        try {
            const a = captureWiring().sort().join('|');
            const b = captureWiring().sort().join('|');
            if (a !== b) throw new Error('the wiring map changed between two identical runs');
        } finally { host.remove(); }
    });

    await test('setupEventListeners bails cleanly when safeAddEventListener is absent', async () => {
        // First branch in the method: without the dep there is nothing safe to do.
        const host = prefFixture();
        try {
            mod.setPreferencesManagerDependencies({
                AppState: { get: () => ({ settings: {} }), update: () => {}, isReady: () => true },
                getElementById: (id) => document.getElementById(id),
                safeAddEventListener: null
            });
            let threw = null;
            try { new mod.PreferencesManager().setupEventListeners(); } catch (e) { threw = e; }
            if (threw) throw new Error(`should no-op without the dep, threw: ${threw.message}`);
        } finally { host.remove(); }
    });

    await test('setPreferencesManagerDependencies is exported as a function', () => {
        if (typeof mod.setPreferencesManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('PreferencesManager class is exported', () => {
        if (typeof mod.PreferencesManager !== 'function') throw new Error('Missing class export');
    });

    await test('initPreferencesManager is exported as a function', () => {
        if (typeof mod.initPreferencesManager !== 'function') throw new Error('Missing export');
    });

    await test('applyCustomColors is exported as a function', () => {
        if (typeof mod.applyCustomColors !== 'function') throw new Error('Missing export');
    });

    await test('removeCustomColors is exported as a function', () => {
        if (typeof mod.removeCustomColors !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setPreferencesManagerDependencies accepts an object without throwing', () => {
        mod.setPreferencesManagerDependencies({});
    });

    await test('injected AppState is actually used by saveColor', () => {
        // Prove the DI wiring takes effect: saveColor writes through the injected AppState.update.
        const captured = { settings: {} };
        mod.setPreferencesManagerDependencies({
            AppState: { get: () => captured, update: (fn) => fn(captured) },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
        new mod.PreferencesManager().saveColor('appBg', '#abcdef');
        if (captured.settings.customColors?.appBg !== '#abcdef') {
            throw new Error('saveColor should persist the color through the injected AppState.update');
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    await test('constructor initializes the documented default state', () => {
        const instance = new mod.PreferencesManager();
        if (instance._initialized !== false) throw new Error('_initialized should start false');
        if (instance.modal !== null) throw new Error('modal should start null');
        if (!Array.isArray(instance.undoStack) || instance.undoStack.length !== 0) throw new Error('undoStack should start as an empty array');
        if (typeof instance.maxUndoSteps !== 'number' || instance.maxUndoSteps <= 0) throw new Error('maxUndoSteps should be a positive number');
    });

    await test('Instance has init method', () => {
        const instance = new mod.PreferencesManager();
        if (typeof instance.init !== 'function') throw new Error('Missing init method');
    });

    await test('applyCustomColors writes the saved color to a root CSS var', () => {
        const body = document.body;
        const root = document.documentElement;
        const hadDark = body.classList.contains('dark-mode');
        const prevVocab = root.dataset.vocabTheme;
        // Force the default-theme path so applyCustomColors applies vars (source:1509).
        body.classList.remove('dark-mode', 'theme-dark-ocean', 'theme-golden-glow');
        delete root.dataset.vocabTheme;
        mod.setPreferencesManagerDependencies({
            AppState: { get: () => ({ settings: { customColors: { appBg: '#123456' } } }), update: () => {} }
        });
        try {
            new mod.PreferencesManager().applyCustomColors();
            // appBg is non-translucent → the raw hex is set on --pref-app-bg (COLOR_MAP).
            if (root.style.getPropertyValue('--pref-app-bg') !== '#123456') {
                throw new Error(`--pref-app-bg should be #123456, got "${root.style.getPropertyValue('--pref-app-bg')}"`);
            }
        } finally {
            root.style.removeProperty('--pref-app-bg');
            if (hadDark) body.classList.add('dark-mode');
            if (prevVocab !== undefined) root.dataset.vocabTheme = prevVocab;
        }
    });

    await test('isDefaultTheme returns true on a clean body and false under a theme class', () => {
        const body = document.body;
        const hadDark = body.classList.contains('dark-mode');
        const prevVocab = document.documentElement.dataset.vocabTheme;
        body.classList.remove('dark-mode', 'theme-dark-ocean', 'theme-golden-glow');
        delete document.documentElement.dataset.vocabTheme;
        mod.setPreferencesManagerDependencies({ AppState: { get: () => ({ settings: {} }), update: () => {} } });
        try {
            const instance = new mod.PreferencesManager();
            if (instance.isDefaultTheme() !== true) throw new Error('clean body should be the default theme');
            body.classList.add('dark-mode');
            if (instance.isDefaultTheme() !== false) throw new Error('dark-mode should NOT be the default theme');
        } finally {
            body.classList.remove('dark-mode');
            if (hadDark) body.classList.add('dark-mode');
            if (prevVocab !== undefined) document.documentElement.dataset.vocabTheme = prevVocab;
        }
    });

    await test('removeCustomColors clears the root CSS vars it manages', () => {
        const root = document.documentElement;
        root.style.setProperty('--pref-app-bg', '#123456');
        mod.setPreferencesManagerDependencies({ AppState: { get: () => ({ settings: {} }), update: () => {} } });
        try {
            new mod.PreferencesManager().removeCustomColors();
            if (root.style.getPropertyValue('--pref-app-bg') !== '') {
                throw new Error('removeCustomColors should remove --pref-app-bg');
            }
        } finally {
            root.style.removeProperty('--pref-app-bg');
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setPreferencesManagerDependencies(null) preserves previously injected deps', () => {
        // diBase treats a null dependency object as a no-op — it must NOT wipe prior wiring.
        const captured = { settings: {} };
        mod.setPreferencesManagerDependencies({ AppState: { get: () => captured, update: (fn) => fn(captured) } });
        mod.setPreferencesManagerDependencies(null);
        new mod.PreferencesManager().saveColor('appBg', '#010203');
        if (captured.settings.customColors?.appBg !== '#010203') {
            throw new Error('a null DI call should not clear the previously injected AppState');
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
