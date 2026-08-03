/**
 * StatsPanelRewards Tests
 * Tests for modules/features/statsPanelRewards.js
 *
 * Facade sub-module of statsPanel.js (D-03 split) — imported directly with a
 * cache-buster and driven with a mock manager, matching the sub-module test
 * convention (see preferencesBgImage.tests.js).
 */

export async function runStatsPanelRewardsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/statsPanelRewards.js?v=${cacheBuster}`);
    const { StatsPanelRewards } = mod;
    const { DOM_CLASSES } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🏆 StatsPanelRewards Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    async function test(name, testFn) {
        total.count++;
        try {
            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // ── mocks ───────────────────────────────────────────────────────────────
    const makeAppState = (state) => ({
        isReady: () => true,
        get: () => state,
        update: async (fn) => { fn(state); }
    });

    // vtm with Habit Tracker unlocked and Fitness next at 25 cycles.
    const makeVtm = () => ({
        getUnlockedThemeIds: () => ['classic', 'habit-tracker'],
        getNextLockedTheme: (cycles) => cycles < 25
            ? { id: 'fitness', name: 'Fitness', unlockAt: { cycles: 25 }, icons: { badge: '💪' } }
            : null,
        getThemeDefinition: (id) => id === 'habit-tracker'
            ? { id: 'habit-tracker', name: 'Habit Tracker', icons: { badge: '🔥' } }
            : null
    });

    // Mirrors the slice of StatsPanelManager the rewards module touches.
    const makeManager = (overrides = {}) => {
        const themeUnlockMessage = document.createElement('div');
        const goldenUnlockMessage = document.createElement('div');
        const gameUnlockMessage = document.createElement('div');
        return {
            elements: { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage, themeUnlockStatus: null, themesModal: null },
            dependencies: {
                AppState: makeAppState({ userProgress: { totalTasksCompleted: 0 }, appState: {}, data: { cycles: {} }, settings: {} }),
                vocabThemeManager: makeVtm(),
                hideMainMenu: () => {}
            },
            rawDeps: { getActiveElement: () => document.activeElement },
            MILESTONES: { TASK_ORDER_GAME: 100 },
            _milestonesExpanded: true,
            saveCollapsiblePreference: () => {},
            ...overrides
        };
    };

    await test('lists unlocked themes with badge icons', () => {
        const m = makeManager();
        const r = new StatsPanelRewards(m);
        r.updateThemeMessages(10, { taskOrderGame: false });

        const text = m.elements.themeUnlockMessage.textContent;
        if (!text.includes('🔥 Habit Tracker')) {
            throw new Error('Unlocked list should show badge icon + theme name');
        }
        if (!m.elements.themeUnlockMessage.classList.contains(DOM_CLASSES.UNLOCKED_MESSAGE)) {
            throw new Error('Unlocked list should carry the unlocked-message class');
        }
    });

    await test('shows countdown to the next locked theme', () => {
        const m = makeManager();
        const r = new StatsPanelRewards(m);
        r.updateThemeMessages(10, { taskOrderGame: false });

        const text = m.elements.goldenUnlockMessage.textContent;
        if (!text.includes('Fitness') || !text.includes('15')) {
            throw new Error(`Should show "Fitness" and 15 cycles remaining, got: "${text}"`);
        }
    });

    await test('hides game message while vocab themes remain locked', () => {
        const m = makeManager();
        const r = new StatsPanelRewards(m);
        r.updateThemeMessages(10, { taskOrderGame: false });

        if (m.elements.gameUnlockMessage.textContent !== '') {
            throw new Error('Game message should stay hidden until all vocab themes unlock');
        }
    });

    await test('shows game unlocked message once earned', () => {
        const m = makeManager();
        // All vocab themes unlocked (no next locked theme)
        m.dependencies.vocabThemeManager.getNextLockedTheme = () => null;
        const r = new StatsPanelRewards(m);
        r.updateThemeMessages(120, { taskOrderGame: true });

        const el = m.elements.gameUnlockMessage;
        if (!el.classList.contains(DOM_CLASSES.UNLOCKED_MESSAGE)) {
            throw new Error('Earned game should carry the unlocked-message class');
        }
        if (el.textContent.trim().endsWith('🔒')) {
            throw new Error('Unlocked message must not end with a padlock (drift-review B-02)');
        }
    });

    await test('shows cycle countdown to game when all themes unlocked but game locked', () => {
        const m = makeManager();
        m.dependencies.vocabThemeManager.getNextLockedTheme = () => null;
        const r = new StatsPanelRewards(m);
        r.updateThemeMessages(60, { taskOrderGame: false });

        const text = m.elements.gameUnlockMessage.textContent;
        if (!text.includes('40')) {
            throw new Error(`Should show 40 cycles remaining to the game, got: "${text}"`);
        }
    });

    await test('clears messages when vocabThemeManager is unavailable', () => {
        const m = makeManager();
        m.dependencies.vocabThemeManager = null;
        const r = new StatsPanelRewards(m);
        m.elements.themeUnlockMessage.textContent = 'stale';
        r.updateThemeMessages(10, { taskOrderGame: false });

        if (m.elements.themeUnlockMessage.textContent !== '') {
            throw new Error('Theme list should clear without a vocab theme manager');
        }
        if (m.elements.goldenUnlockMessage.textContent !== '') {
            throw new Error('Next-theme message should clear without a vocab theme manager');
        }
    });

    await test('theme toggle click collapses and persists the preference', () => {
        const saved = [];
        const m = makeManager({ saveCollapsiblePreference: (key, val) => saved.push([key, val]) });
        const r = new StatsPanelRewards(m);
        r.updateThemeMessages(10, { taskOrderGame: false }); // expanded → visible

        r.handleThemeToggleClick(); // collapse
        if (m._milestonesExpanded !== false) {
            throw new Error('Toggle should flip expanded state to false');
        }
        if (m.elements.themeUnlockMessage.classList.contains(DOM_CLASSES.VISIBLE)) {
            throw new Error('Collapse should hide the theme list');
        }
        if (saved.length !== 1 || saved[0][0] !== 'milestonesExpanded' || saved[0][1] !== false) {
            throw new Error('Toggle should persist the collapsed preference');
        }

        r.handleThemeToggleClick(); // expand again
        if (!m.elements.themeUnlockMessage.classList.contains(DOM_CLASSES.VISIBLE)) {
            throw new Error('Expand should reveal the populated theme list');
        }
    });

    await test('unlockThemesIfEligible awards the game at the milestone', async () => {
        const state = { settings: {}, userProgress: {} };
        const m = makeManager();
        m.dependencies.AppState = makeAppState(state);
        const r = new StatsPanelRewards(m);

        await r.unlockThemesIfEligible(100, { taskOrderGame: false });
        if (!state.settings.unlockedFeatures.includes('task-order-game')) {
            throw new Error('100 global cycles should unlock the task order game');
        }
        if (!state.userProgress.rewardMilestones.includes('task-order-game-100')) {
            throw new Error('Unlock should record the reward milestone');
        }
    });

    await test('unlockThemesIfEligible does nothing below the milestone', async () => {
        const state = { settings: {}, userProgress: {} };
        const m = makeManager();
        m.dependencies.AppState = makeAppState(state);
        const r = new StatsPanelRewards(m);

        await r.unlockThemesIfEligible(99, { taskOrderGame: false });
        if ((state.settings.unlockedFeatures || []).includes('task-order-game')) {
            throw new Error('99 cycles must not unlock the game');
        }
    });

    await test('openThemesPanel and closeThemesPanel drive the dialog', () => {
        const dialog = document.createElement('dialog');
        document.body.appendChild(dialog);
        try {
            let menuHidden = 0;
            const m = makeManager();
            m.elements.themesModal = dialog;
            m.dependencies.hideMainMenu = () => { menuHidden++; };
            const r = new StatsPanelRewards(m);

            r.openThemesPanel();
            if (!dialog.open) throw new Error('openThemesPanel should open the dialog');
            if (menuHidden !== 1) throw new Error('Opening themes should hide the main menu');

            r.closeThemesPanel();
            if (dialog.open) throw new Error('closeThemesPanel should close the dialog');
        } finally {
            dialog.remove();
        }
    });

    // Final summary
    const allPassed = passed.count === total.count;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    if (allPassed) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All StatsPanelRewards tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
}
