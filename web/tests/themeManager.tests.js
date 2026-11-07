/**
 * ThemeManager Browser Tests
 * Test functions for module-test-suite.html
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 */

import {
    setupTestEnvironment,
    createMockNotification,
    createMockHideMainMenu
} from './testHelpers.js';

// Will need to use setThemeManagerDependencies inside tests
let setThemeManagerDependencies = null;
let _setMenuButtonLabel = null;

export async function runThemeManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎨 ThemeManager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Import setThemeManagerDependencies to inject mocks
    const cacheBuster = window.testCacheBuster || Date.now();
    const themeModule = await import(`../modules/features/themeManager.js?v=${cacheBuster}`);
    setThemeManagerDependencies = themeModule.setThemeManagerDependencies;
    _setMenuButtonLabel = themeModule._setMenuButtonLabel;

    // Inject mock dependencies using testHelpers mocks
    setThemeManagerDependencies({
        AppState: env.AppState,
        showNotification: createMockNotification(),
        hideMainMenu: createMockHideMainMenu()
    });

    resultsDiv.innerHTML = '<h2>🎨 ThemeManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    async function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });

        try {
            const result = testFn();
            // Handle async test functions
            if (result instanceof Promise) {
                await result;
            }
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ===== INITIALIZATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('ThemeManager creates successfully', () => {
        const tm = new ThemeManager();
        if (!tm || typeof tm.updateThemeColor !== 'function') {
            throw new Error('ThemeManager not properly initialized');
        }
    });

    // The colour themes (dark-ocean, golden-glow, dark) were retired in Nov 2026:
    // Personalization presets replaced them, and boot moves a stored one to its
    // preset (retireLegacyColorTheme, tested in schemaMigration26.tests.js).
    await test('the retired colour themes leave no API behind', () => {
        const tm = new ThemeManager();
        for (const name of ['themes', 'themeColors', 'applyTheme', 'refreshThemeToggles', 'addThemeToggle',
            'updateThemeToggles', 'initThemesPanel', 'saveThemeToStorage', 'unlockDarkOceanTheme', 'unlockGoldenGlowTheme']) {
            if (typeof tm[name] !== 'undefined') throw new Error(`${name} should have been removed`);
        }
    });

    // ===== DARK MODE TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🌙 Dark Mode</h4>';

    // On a first run the toggle was set up before any data existed, stamped its
    // idempotency flag, and bailed — a dead toggle for the whole session. It only
    // looked fine because another module's boot-time read of the legacy
    // loadMiniCycleData wrapper CREATED the initial data first (measured Sep 2026).
    await test('setupDarkModeToggle attaches its handler even when no schema data exists yet', () => {
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.id = 'darkModeToggle';
        document.body.appendChild(toggle);
        const savedData = localStorage.getItem('miniCycleData');
        const rootWasDark = document.documentElement.classList.contains('dark-mode');
        try {
            localStorage.removeItem('miniCycleData');
            document.documentElement.classList.add('dark-mode');     // what the pre-paint script leaves
            setThemeManagerDependencies({
                AppState: { isReady: () => false, get: () => null },
                safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn)
            });
            const tm = new ThemeManager();
            tm.setupDarkModeToggle('darkModeToggle', ['darkModeToggle']);
            if (typeof toggle._darkModeChangeHandler !== 'function') {
                throw new Error('no change handler attached — the toggle is dead until reload');
            }
            if (toggle.checked !== true) {
                throw new Error('initial state should mirror the dark-mode class already on <html>');
            }
        } finally {
            toggle.remove();
            document.documentElement.classList.toggle('dark-mode', rootWasDark);
            if (savedData !== null) localStorage.setItem('miniCycleData', savedData);
            setThemeManagerDependencies({ AppState: env.AppState, safeAddEventListener: null });
        }
    });

    await test('toggles dark mode on', () => {
        const tm = new ThemeManager();
        tm.toggleDarkMode(true);

        if (!document.body.classList.contains('dark-mode')) {
            throw new Error('Dark mode not applied');
        }
    });

    await test('quick dark toggle: the desktop caption names the mode a press switches to', async () => {
        const { getLabel } = await import('../modules/labels/labelResolver.js');
        const quick = document.createElement('button');
        quick.id = 'quick-dark-toggle';
        document.body.appendChild(quick);
        setThemeManagerDependencies({ getElementById: (id) => document.getElementById(id) });
        try {
            const tm = new ThemeManager();
            tm.updateQuickToggleIcon(true);
            if (quick.dataset.label !== getLabel('nav.lightModeCaption')) throw new Error(`in dark mode the caption should read "Light mode", got ${JSON.stringify(quick.dataset.label)}`);
            tm.updateQuickToggleIcon(false);
            if (quick.dataset.label !== getLabel('nav.darkModeCaption')) throw new Error(`in light mode the caption should read "Dark mode", got ${JSON.stringify(quick.dataset.label)}`);
        } finally {
            quick.remove();
            setThemeManagerDependencies({ getElementById: (id) => document.getElementById(id) });
        }
    });

    await test('quick dark toggle: a long press shows its label on touch and does not toggle', async () => {
        const { UI_TIMEOUTS, DOM_CLASSES } = await import(`../modules/core/constants.js?v=${cacheBuster}`);
        const { resetLongPressHints } = await import(`../modules/utils/longPressHint.js?v=${cacheBuster}`);
        const quick = document.createElement('button');
        quick.id = 'quick-dark-toggle'; quick.title = 'Toggle dark mode'; quick.setAttribute('aria-label', 'Toggle dark mode');
        document.body.appendChild(quick);
        const primary = document.createElement('input'); primary.type = 'checkbox'; primary.id = 'darkModeToggle';
        document.body.appendChild(primary);
        setThemeManagerDependencies({
            AppState: { isReady: () => false, get: () => null },
            getElementById: (id) => document.getElementById(id),
            getRootElement: () => document.documentElement,
            getBody: () => document.body,
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn)
        });
        try {
            new ThemeManager().setupQuickDarkToggle();
            const live = document.getElementById('quick-dark-toggle');   // setup swaps in a clone
            live.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, UI_TIMEOUTS.LONG_PRESS_HINT + 120));
            live.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
            live.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));   // the click a browser fires after touchend
            const hint = document.getElementById('long-press-hint');
            if (!hint || !hint.classList.contains(DOM_CLASSES.VISIBLE)) throw new Error('a long press must show the label bubble');
            // The bubble says what a press would do: light mode now → dark next.
            const { getLabel } = await import('../modules/labels/labelResolver.js');
            const want = getLabel('nav.darkModeHintOn');
            if (hint.textContent !== want) throw new Error(`bubble should read "${want}", got ` + JSON.stringify(hint.textContent));
            if (primary.checked) throw new Error('asking what the button does must not toggle dark mode');
        } finally {
            document.getElementById('quick-dark-toggle')?.remove();
            primary.remove();
            resetLongPressHints();
            setThemeManagerDependencies({ AppState: env.AppState, safeAddEventListener: null });
        }
    });

    await test('toggles dark mode off', () => {
        const tm = new ThemeManager();
        document.body.classList.add('dark-mode');

        tm.toggleDarkMode(false);

        if (document.body.classList.contains('dark-mode')) {
            throw new Error('Dark mode not removed');
        }
    });

    // ===== THEME COLOR TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Theme Colors</h4>';

    await test('updateThemeColor runs without error', () => {
        const tm = new ThemeManager();
        tm.updateThemeColor();
        // Just verify it runs without throwing
    });

    // ===== STORAGE TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">💾 Storage</h4>';

    await test('loadSchemaData returns data', () => {
        const tm = new ThemeManager();
        const mockData = {
            metadata: { version: "2.5", lastModified: Date.now() },
            settings: { theme: 'default', darkMode: false, unlockedThemes: [] }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const data = tm.loadSchemaData();
        if (!data || !data.settings) {
            throw new Error('Failed to load schema data');
        }
    });

    await test('loadSchemaData returns null when no data', () => {
        const tm = new ThemeManager();
        localStorage.clear();

        const data = tm.loadSchemaData();
        if (data !== null) {
            throw new Error('Should return null when no data');
        }
    });

    // ===== ERROR HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('handles missing localStorage gracefully', async () => {
        const tm = new ThemeManager();
        localStorage.clear();

        // Should not throw with no stored data
        tm.updateThemeColor();
    });

    await test('handles null body element gracefully', () => {
        const tm = new ThemeManager();

        // updateThemeColor checks for document.body
        tm.updateThemeColor();
        // Should not throw
    });

    // === _setMenuButtonLabel TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 _setMenuButtonLabel</h4>';

    /**
     * Build a menu button with the standard `<i><text>` structure used
     * everywhere in the main menu. Returns the button + the icon ref.
     */
    function buildMenuButton(id) {
        document.getElementById(id)?.remove();
        const btn = document.createElement('button');
        btn.id = id;
        btn.title = 'placeholder title';
        const icon = document.createElement('i');
        icon.className = 'fas fa-eraser';
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode('Placeholder Text'));
        document.body.appendChild(btn);
        return { btn, icon };
    }

    await test('_setMenuButtonLabel is exported as a function', () => {
        if (typeof _setMenuButtonLabel !== 'function') {
            throw new Error('_setMenuButtonLabel should be exported');
        }
    });

    await test('_setMenuButtonLabel updates the text node and preserves the icon', () => {
        const { btn, icon } = buildMenuButton('menu-test-button');
        // 'action.clearAllMenu' resolves to "Uncheck All" in default labels
        _setMenuButtonLabel('menu-test-button', 'action.clearAllMenu', 'action.clearAllTitle');

        // Icon must still be present and unchanged
        if (!btn.contains(icon)) {
            throw new Error('Icon element should survive the label update');
        }
        if (icon.className !== 'fas fa-eraser') {
            throw new Error('Icon className should not be modified');
        }

        // Text node should now read "Uncheck All"
        const textNode = Array.from(btn.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (!textNode || !textNode.textContent.includes('Uncheck All')) {
            throw new Error(`Text node should be "Uncheck All", got: ${textNode?.textContent}`);
        }

        btn.remove();
    });

    await test('_setMenuButtonLabel sets the title attribute when titleKey is provided', () => {
        const { btn } = buildMenuButton('menu-test-button-title');
        _setMenuButtonLabel('menu-test-button-title', 'action.clearAllMenu', 'action.clearAllTitle');

        if (!btn.title.includes('Uncheck all tasks')) {
            throw new Error(`Title should reflect action.clearAllTitle, got: ${btn.title}`);
        }
        btn.remove();
    });

    await test('_setMenuButtonLabel does not change title when titleKey is omitted', () => {
        const { btn } = buildMenuButton('menu-test-button-no-title');
        const originalTitle = btn.title;
        _setMenuButtonLabel('menu-test-button-no-title', 'action.clearAllMenu', null);

        if (btn.title !== originalTitle) {
            throw new Error(`Title should remain unchanged, got: ${btn.title}`);
        }
        btn.remove();
    });

    await test('_setMenuButtonLabel fails soft when element does not exist', () => {
        try {
            _setMenuButtonLabel('this-id-definitely-does-not-exist', 'action.clearAllMenu', 'action.clearAllTitle');
        } catch (e) {
            throw new Error('Should not throw when element is missing: ' + e.message);
        }
    });

    await test('_setMenuButtonLabel appends a text node when button has only an icon', () => {
        // Edge case: button with no existing text node (icon-only button)
        document.getElementById('menu-test-button-icon-only')?.remove();
        const btn = document.createElement('button');
        btn.id = 'menu-test-button-icon-only';
        const icon = document.createElement('i');
        icon.className = 'fas fa-bell';
        btn.appendChild(icon);
        document.body.appendChild(btn);

        _setMenuButtonLabel('menu-test-button-icon-only', 'menu.reminders', null);

        const textNode = Array.from(btn.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (!textNode) {
            throw new Error('A new text node should have been appended');
        }
        if (!textNode.textContent.includes('Reminders')) {
            throw new Error(`Appended text should be "Reminders", got: ${textNode.textContent}`);
        }
        // Icon must still be there
        if (!btn.contains(icon)) {
            throw new Error('Icon should still be present after text-node append');
        }
        btn.remove();
    });

    // ===== SETTINGS WRITES GO THROUGH THE PRODUCER =====

    resultsDiv.innerHTML += '<h4 class="test-section">💾 Settings writes (producer)</h4>';

    // These use an AppState mock whose update() records the producer but never
    // RUNS it. That is what gives the tests teeth: if a writer mutates the
    // object returned by get() before calling update — the old
    // loadSchemaData → mutate → saveSchemaData shim — the value appears in
    // state anyway. Only a real producer-based write leaves it untouched here.
    function makeInertAppState() {
        const state = { settings: { theme: 'default', darkMode: false } };
        const calls = [];
        return {
            state,
            calls,
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (producer, immediate) => {
                    calls.push({ producer, immediate });
                    return Promise.resolve();
                }
            }
        };
    }

    async function withInertAppState(fn) {
        const harness = makeInertAppState();
        setThemeManagerDependencies({ AppState: harness.AppState });
        try {
            await fn(harness);
        } finally {
            setThemeManagerDependencies({ AppState: env.AppState });
        }
    }

    await test('saveDarkModeToStorage writes only via AppState.update', async () => {
        await withInertAppState(async (h) => {
            const tm = new ThemeManager();
            await tm.saveDarkModeToStorage(true);

            if (h.calls.length !== 1) {
                throw new Error(`Expected exactly 1 update call, got ${h.calls.length}`);
            }
            if (h.state.settings.darkMode !== false) {
                throw new Error('State was mutated outside the producer');
            }
            h.calls[0].producer(h.state);
            if (h.state.settings.darkMode !== true) {
                throw new Error('Producer did not set darkMode');
            }
        });
    });

    await test('settings producer creates state.settings when absent', async () => {
        await withInertAppState(async (h) => {
            const tm = new ThemeManager();
            await tm.saveDarkModeToStorage(true);
            const bare = {};
            h.calls[0].producer(bare);
            if (bare.settings?.darkMode !== true) {
                throw new Error('Producer should create settings when missing');
            }
        });
    });

    await test('writers survive a missing AppState without throwing', async () => {
        setThemeManagerDependencies({ AppState: null });
        try {
            const tm = new ThemeManager();
            await tm.saveDarkModeToStorage(true);
        } finally {
            setThemeManagerDependencies({ AppState: env.AppState });
        }
    });

    await test('whole-state writer and dead unlock fallback are gone', async () => {
        // saveSchemaData did Object.assign(state, data) — a whole-state
        // overwrite that could pair with loadSchemaData's detached
        // localStorage fallback. unlockThemeFallback was its last mutating
        // caller and had no callers of its own.
        const tm = new ThemeManager();
        if (typeof tm.saveSchemaData !== 'undefined') {
            throw new Error('saveSchemaData should have been removed');
        }
        if (typeof tm.unlockThemeFallback !== 'undefined') {
            throw new Error('unlockThemeFallback should have been removed');
        }
        // loadSchemaData stays — it still has read-only callers.
        if (typeof tm.loadSchemaData !== 'function') {
            throw new Error('loadSchemaData should still exist for readers');
        }
    });

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
