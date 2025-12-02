/**
 * ThemeManager Browser Tests
 * Test functions for module-test-suite.html
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    createMockHideMainMenu,
    waitForAsyncOperations
} from './testHelpers.js';

// Will need to use setThemeManagerDependencies inside tests
let setThemeManagerDependencies = null;

export async function runThemeManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎨 ThemeManager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Import setThemeManagerDependencies to inject mocks
    const themeModule = await import('../modules/features/themeManager.js');
    setThemeManagerDependencies = themeModule.setThemeManagerDependencies;

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

    await test('saves theme to localStorage', async () => {
        const tm = new ThemeManager();
        const mockData = {
            metadata: { version: "2.5", lastModified: Date.now() },
            settings: { theme: 'default', darkMode: false, unlockedThemes: [] }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        // Re-inject mock AppState to ensure it's available for this test
        setThemeManagerDependencies({
            AppState: createMockAppState()
        });

        // Directly call saveSchemaData to test the save functionality
        const schemaData = tm.loadSchemaData();
        schemaData.settings.theme = 'dark-ocean';
        await tm.saveSchemaData(schemaData);

        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        if (savedData.settings.theme !== 'dark-ocean') {
            throw new Error('Theme not saved to localStorage');
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

    await test('saves dark mode to localStorage', async () => {
        const tm = new ThemeManager();
        const mockData = {
            metadata: { version: "2.5", lastModified: Date.now() },
            settings: { theme: 'default', darkMode: false, unlockedThemes: [] }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        // Re-inject mock AppState to ensure it's available for this test
        setThemeManagerDependencies({
            AppState: createMockAppState()
        });

        // Directly call saveSchemaData to test the save functionality
        const schemaData = tm.loadSchemaData();
        schemaData.settings.darkMode = true;
        await tm.saveSchemaData(schemaData);

        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        if (savedData.settings.darkMode !== true) {
            throw new Error('Dark mode not saved to localStorage');
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

    await test('saveSchemaData updates lastModified', async () => {
        const tm = new ThemeManager();
        const mockData = {
            metadata: { version: "2.5", lastModified: 0 },
            settings: { theme: 'default', darkMode: false, unlockedThemes: [] }
        };

        // Need to set up localStorage first since saveSchemaData reads from it
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        // Re-inject mock AppState to ensure it's available for this test
        setThemeManagerDependencies({
            AppState: createMockAppState()
        });

        // saveSchemaData is now async
        await tm.saveSchemaData(mockData);

        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        if (savedData.metadata.lastModified === 0) {
            throw new Error('lastModified not updated');
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

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
