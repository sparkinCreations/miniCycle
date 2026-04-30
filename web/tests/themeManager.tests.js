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
        if (!tm || typeof tm.applyTheme !== 'function') {
            throw new Error('ThemeManager not properly initialized');
        }
    });

    await test('has correct theme definitions', () => {
        const tm = new ThemeManager();
        if (!tm.themes || tm.themes.length !== 2) {
            throw new Error('Theme definitions incorrect');
        }
        if (tm.themes[0].unlockKey !== 'dark-ocean') {
            throw new Error('Dark ocean theme not found');
        }
        if (tm.themes[1].unlockKey !== 'golden-glow') {
            throw new Error('Golden glow theme not found');
        }
    });

    await test('has theme color definitions', () => {
        const tm = new ThemeManager();
        if (!tm.themeColors || !tm.themeColors.light || !tm.themeColors.dark) {
            throw new Error('Theme colors not defined');
        }
    });

    // ===== THEME APPLICATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Theme Application</h4>';

    await test('applies default theme correctly', () => {
        const tm = new ThemeManager();
        const mockData = {
            metadata: { version: "2.5", lastModified: Date.now() },
            settings: { theme: 'default', darkMode: false, unlockedThemes: [] }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        tm.applyTheme('default');

        if (document.body.classList.contains('theme-dark-ocean')) {
            throw new Error('Should not have dark-ocean class');
        }
        if (document.body.classList.contains('theme-golden-glow')) {
            throw new Error('Should not have golden-glow class');
        }
    });

    await test('applies dark-ocean theme', () => {
        const tm = new ThemeManager();
        const mockData = {
            metadata: { version: "2.5", lastModified: Date.now() },
            settings: { theme: 'default', darkMode: false, unlockedThemes: [] }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        tm.applyTheme('dark-ocean');

        if (!document.body.classList.contains('theme-dark-ocean')) {
            throw new Error('Theme not applied');
        }
    });

    await test('applies golden-glow theme', () => {
        const tm = new ThemeManager();
        const mockData = {
            metadata: { version: "2.5", lastModified: Date.now() },
            settings: { theme: 'default', darkMode: false, unlockedThemes: [] }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        tm.applyTheme('golden-glow');

        if (!document.body.classList.contains('theme-golden-glow')) {
            throw new Error('Theme not applied');
        }
    });

    await test('switches between themes correctly', () => {
        const tm = new ThemeManager();
        const mockData = {
            metadata: { version: "2.5", lastModified: Date.now() },
            settings: { theme: 'default', darkMode: false, unlockedThemes: [] }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        tm.applyTheme('dark-ocean');
        if (!document.body.classList.contains('theme-dark-ocean')) {
            throw new Error('Dark ocean not applied');
        }

        tm.applyTheme('golden-glow');
        if (document.body.classList.contains('theme-dark-ocean')) {
            throw new Error('Dark ocean should be removed');
        }
        if (!document.body.classList.contains('theme-golden-glow')) {
            throw new Error('Golden glow not applied');
        }
    });

    // ===== DARK MODE TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🌙 Dark Mode</h4>';

    await test('toggles dark mode on', () => {
        const tm = new ThemeManager();
        tm.toggleDarkMode(true);

        if (!document.body.classList.contains('dark-mode')) {
            throw new Error('Dark mode not applied');
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

    await test('has correct theme color definitions', () => {
        const tm = new ThemeManager();

        if (tm.themeColors.light.default !== '#5680ff') {
            throw new Error('Default light color incorrect');
        }
        if (tm.themeColors.dark.default !== '#1c1c1c') {
            throw new Error('Default dark color incorrect');
        }
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

        // Should not throw - applyTheme is now async
        await tm.applyTheme('dark-ocean');
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

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
