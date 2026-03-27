/**
 * Vocabulary Themes Tests
 * Tests for THEME_DEFINITIONS structure, VocabThemeManager methods,
 * theme unlocking, per-routine assignment, and label resolution integration.
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runThemesTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/labels/themes.js?v=${cacheBuster}`);
    const { THEME_DEFINITIONS, VocabThemeManager, setVocabThemeManagerDependencies } = mod;

    resultsDiv.innerHTML = '<h2>Vocabulary Themes Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Mock AppState helper
    function createMockState(overrides = {}) {
        const base = {
            metadata: { lastModified: Date.now() },
            settings: { unlockedThemes: ['classic'], defaultTheme: 'classic' },
            data: { cycles: { 'cycle-1': { tasks: [], theme: 'classic' } } },
            appState: { activeCycleId: 'cycle-1' },
            userProgress: { cyclesCompleted: 0 }
        };
        return { ...base, ...overrides };
    }

    function createMockAppState(stateOverrides = {}) {
        let state = createMockState(stateOverrides);
        return {
            isReady: () => true,
            get: () => state,
            update: (fn, immediate) => {
                fn(state);
                if (!state.metadata) state.metadata = {};
                state.metadata.lastModified = Date.now();
            }
        };
    }

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('THEME_DEFINITIONS is exported', () => {
        if (!THEME_DEFINITIONS || typeof THEME_DEFINITIONS !== 'object') {
            throw new Error('THEME_DEFINITIONS not exported');
        }
    });

    await test('VocabThemeManager class is exported', () => {
        if (typeof VocabThemeManager !== 'function') {
            throw new Error('VocabThemeManager class not exported');
        }
    });

    await test('setVocabThemeManagerDependencies is exported', () => {
        if (typeof setVocabThemeManagerDependencies !== 'function') {
            throw new Error('DI setter not exported');
        }
    });

    // ============================================
    // 🎨 THEME DEFINITIONS STRUCTURE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Theme Definitions Structure</h4>';

    await test('has classic theme', () => {
        if (!THEME_DEFINITIONS.classic) throw new Error('Missing classic theme');
    });

    await test('has all 5 expected themes', () => {
        const expected = ['classic', 'habit-tracker', 'fitness', 'scholar', 'cleaning'];
        const missing = expected.filter(id => !THEME_DEFINITIONS[id]);
        if (missing.length > 0) throw new Error(`Missing themes: ${missing.join(', ')}`);
    });

    await test('classic theme has no unlock requirement', () => {
        if (THEME_DEFINITIONS.classic.unlockAt !== null) {
            throw new Error('Classic should have unlockAt: null');
        }
    });

    await test('non-classic themes have unlockAt with cycles', () => {
        const nonClassic = Object.entries(THEME_DEFINITIONS).filter(([id]) => id !== 'classic');
        for (const [id, theme] of nonClassic) {
            if (!theme.unlockAt || typeof theme.unlockAt.cycles !== 'number') {
                throw new Error(`Theme "${id}" missing unlockAt.cycles`);
            }
        }
    });

    await test('all themes have required fields', () => {
        for (const [id, theme] of Object.entries(THEME_DEFINITIONS)) {
            if (!theme.id) throw new Error(`Theme "${id}" missing id`);
            if (!theme.name) throw new Error(`Theme "${id}" missing name`);
            if (!theme.description) throw new Error(`Theme "${id}" missing description`);
            if (!theme.labels || typeof theme.labels !== 'object') {
                throw new Error(`Theme "${id}" missing labels object`);
            }
            if (!theme.icons || typeof theme.icons !== 'object') {
                throw new Error(`Theme "${id}" missing icons object`);
            }
        }
    });

    await test('theme IDs match their key in THEME_DEFINITIONS', () => {
        for (const [key, theme] of Object.entries(THEME_DEFINITIONS)) {
            if (theme.id !== key) throw new Error(`Theme key "${key}" doesn't match id "${theme.id}"`);
        }
    });

    await test('non-classic themes have colorPreset', () => {
        const nonClassic = Object.entries(THEME_DEFINITIONS).filter(([id]) => id !== 'classic');
        for (const [id, theme] of nonClassic) {
            if (!theme.colorPreset || typeof theme.colorPreset !== 'object') {
                throw new Error(`Theme "${id}" missing colorPreset`);
            }
        }
    });

    await test('non-classic themes have label overrides', () => {
        const nonClassic = Object.entries(THEME_DEFINITIONS).filter(([id]) => id !== 'classic');
        for (const [id, theme] of nonClassic) {
            if (Object.keys(theme.labels).length === 0) {
                throw new Error(`Theme "${id}" has no label overrides`);
            }
        }
    });

    await test('unlock thresholds are in ascending order', () => {
        const thresholds = Object.values(THEME_DEFINITIONS)
            .filter(t => t.unlockAt)
            .map(t => t.unlockAt.cycles)
            .sort((a, b) => a - b);
        for (let i = 1; i < thresholds.length; i++) {
            if (thresholds[i] <= thresholds[i - 1]) {
                throw new Error('Unlock thresholds should be in ascending order');
            }
        }
    });

    // ============================================
    // ⚡ VOCABTHEMEMANAGER BASICS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ VocabThemeManager Basics</h4>';

    await test('getActiveTheme returns classic when no AppState', () => {
        setVocabThemeManagerDependencies({ AppState: null }, { replace: true });
        const mgr = new VocabThemeManager();
        const theme = mgr.getActiveTheme();
        if (theme.id !== 'classic') throw new Error(`Expected classic, got ${theme.id}`);
    });

    await test('getActiveTheme returns routine theme', () => {
        const mockState = createMockState();
        mockState.data.cycles['cycle-1'].theme = 'fitness';
        mockState.settings.unlockedThemes = ['classic', 'fitness'];
        setVocabThemeManagerDependencies({ AppState: { get: () => mockState } }, { replace: true });

        const mgr = new VocabThemeManager();
        const theme = mgr.getActiveTheme();
        if (theme.id !== 'fitness') throw new Error(`Expected fitness, got ${theme.id}`);
    });

    await test('getActiveTheme falls back to classic for unknown theme', () => {
        const mockState = createMockState();
        mockState.data.cycles['cycle-1'].theme = 'nonexistent';
        setVocabThemeManagerDependencies({ AppState: { get: () => mockState } }, { replace: true });

        const mgr = new VocabThemeManager();
        const theme = mgr.getActiveTheme();
        if (theme.id !== 'classic') throw new Error(`Should fall back to classic, got ${theme.id}`);
    });

    await test('getRoutineTheme returns correct theme for routine', () => {
        const mockState = createMockState();
        mockState.data.cycles['cycle-1'].theme = 'scholar';
        setVocabThemeManagerDependencies({ AppState: { get: () => mockState } }, { replace: true });

        const mgr = new VocabThemeManager();
        const theme = mgr.getRoutineTheme('cycle-1');
        if (theme.id !== 'scholar') throw new Error(`Expected scholar, got ${theme.id}`);
    });

    // ============================================
    // 🔓 UNLOCK LOGIC
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔓 Unlock Logic</h4>';

    await test('getUnlockedThemeIds always includes classic', () => {
        setVocabThemeManagerDependencies({ AppState: createMockAppState() }, { replace: true });
        const mgr = new VocabThemeManager();
        const ids = mgr.getUnlockedThemeIds();
        if (!ids.includes('classic')) throw new Error('Should always include classic');
    });

    await test('getUnlockedThemeIds returns stored list', () => {
        const mockAS = createMockAppState({
            settings: { unlockedThemes: ['classic', 'habit-tracker', 'fitness'] }
        });
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });
        const mgr = new VocabThemeManager();
        const ids = mgr.getUnlockedThemeIds();
        if (!ids.includes('habit-tracker')) throw new Error('Should include habit-tracker');
        if (!ids.includes('fitness')) throw new Error('Should include fitness');
    });

    await test('checkThemeUnlocks returns newly unlocked themes', () => {
        const mockAS = createMockAppState({
            settings: { unlockedThemes: ['classic'] },
            userProgress: { cyclesCompleted: 5 }
        });
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        const newlyUnlocked = mgr.checkThemeUnlocks();
        if (!newlyUnlocked.includes('habit-tracker')) {
            throw new Error('Should unlock habit-tracker at 5 cycles');
        }
    });

    await test('checkThemeUnlocks returns empty when nothing new', () => {
        const mockAS = createMockAppState({
            settings: { unlockedThemes: ['classic', 'habit-tracker'] },
            userProgress: { cyclesCompleted: 5 }
        });
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        const newlyUnlocked = mgr.checkThemeUnlocks();
        if (newlyUnlocked.length !== 0) {
            throw new Error(`Expected 0 new unlocks, got ${newlyUnlocked.length}`);
        }
    });

    await test('unlockThemeFromAchievement unlocks a specific theme', () => {
        const mockAS = createMockAppState({
            settings: { unlockedThemes: ['classic'] }
        });
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        const result = mgr.unlockThemeFromAchievement('fitness');
        if (result !== true) throw new Error('Should return true for new unlock');

        const ids = mgr.getUnlockedThemeIds();
        if (!ids.includes('fitness')) throw new Error('fitness should now be unlocked');
    });

    await test('unlockThemeFromAchievement returns false if already unlocked', () => {
        const mockAS = createMockAppState({
            settings: { unlockedThemes: ['classic', 'fitness'] }
        });
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        const result = mgr.unlockThemeFromAchievement('fitness');
        if (result !== false) throw new Error('Should return false for already-unlocked');
    });

    await test('unlockThemeFromAchievement rejects unknown theme', () => {
        const mockAS = createMockAppState();
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        const result = mgr.unlockThemeFromAchievement('nonexistent');
        if (result !== false) throw new Error('Should return false for unknown theme');
    });

    // ============================================
    // 📝 THEME ASSIGNMENT
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Theme Assignment</h4>';

    await test('setRoutineTheme assigns theme to routine', () => {
        const mockAS = createMockAppState({
            settings: { unlockedThemes: ['classic', 'scholar'] }
        });
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        const result = mgr.setRoutineTheme('cycle-1', 'scholar');
        if (result !== true) throw new Error('Should return true');

        const state = mockAS.get();
        if (state.data.cycles['cycle-1'].theme !== 'scholar') {
            throw new Error('Theme not set on routine');
        }
    });

    await test('setRoutineTheme rejects locked theme', () => {
        const mockAS = createMockAppState({
            settings: { unlockedThemes: ['classic'] }
        });
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        const result = mgr.setRoutineTheme('cycle-1', 'scholar');
        if (result !== false) throw new Error('Should return false for locked theme');
    });

    await test('setRoutineTheme rejects unknown theme', () => {
        const mockAS = createMockAppState();
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        const result = mgr.setRoutineTheme('cycle-1', 'nonexistent');
        if (result !== false) throw new Error('Should return false for unknown theme');
    });

    await test('setDefaultTheme updates settings', () => {
        const mockAS = createMockAppState();
        setVocabThemeManagerDependencies({ AppState: mockAS }, { replace: true });

        const mgr = new VocabThemeManager();
        mgr.setDefaultTheme('classic');
        const state = mockAS.get();
        if (state.settings.defaultTheme !== 'classic') {
            throw new Error('Default theme not updated');
        }
    });

    // ============================================
    // ⚠️ ERROR HANDLING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('all methods handle null AppState gracefully', () => {
        setVocabThemeManagerDependencies({ AppState: null }, { replace: true });
        const mgr = new VocabThemeManager();

        // None of these should throw
        mgr.getActiveTheme();
        mgr.getRoutineTheme('cycle-1');
        mgr.getUnlockedThemeIds();
        mgr.checkThemeUnlocks();
    });

    // ============================================
    // 📊 RESULTS
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
