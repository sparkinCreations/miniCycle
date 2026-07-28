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
