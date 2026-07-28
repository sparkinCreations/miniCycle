/**
 * AchievementsManager Tests
 * Tests for achievement unlock logic, progress tracking, and milestone detection
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runAchievementsManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/achievementsManager.js?v=${cacheBuster}`);
    const { AchievementsManager, setAchievementsManagerDependencies, initAchievementsManager } = mod;

    resultsDiv.innerHTML = '<h2>AchievementsManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Mock helpers
    function createMockState(overrides = {}) {
        return {
            metadata: { lastModified: Date.now() },
            settings: { unlockedThemes: ['classic'] },
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [],
                        clearedTasks: { items: [], totalCleared: 0 },
                        metadata: { title: 'Test' }
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' },
            userProgress: { cyclesCompleted: 0, totalTasksCleared: 0 },
            achievements: { unlocked: [], seen: {} },
            ...overrides
        };
    }

    function createMockAppState(stateOverrides = {}) {
        let state = createMockState(stateOverrides);
        return {
            isReady: () => true,
            get: () => state,
            update: (fn) => { fn(state); },
            subscribe: () => () => {}
        };
    }

    function createMockAppInit() {
        return {
            waitForCore: () => Promise.resolve(),
            isCoreReady: () => true
        };
    }

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('AchievementsManager class is exported', () => {
        if (typeof AchievementsManager !== 'function') throw new Error('AchievementsManager not a class');
    });

    await test('setAchievementsManagerDependencies is exported', () => {
        if (typeof setAchievementsManagerDependencies !== 'function') throw new Error('DI setter not exported');
    });

    // ============================================
    // 🏗️ INITIALIZATION
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Initialization</h4>';

    // initAchievementsManager dynamically loads MILESTONES from constants.js
    // Must be called before any instance methods work
    let mgr;
    await test('initAchievementsManager creates instance', async () => {
        setAchievementsManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
        });
        mgr = await initAchievementsManager();
        if (!mgr) throw new Error('Instance not created');
    });

    await test('instance has deps accessor', () => {
        if (!mgr) throw new Error('No instance from init');
        if (!mgr.deps) throw new Error('deps not accessible');
    });

    await test('instance has milestones loaded', () => {
        if (!mgr) throw new Error('No instance from init');
        if (!mgr.milestones || !Array.isArray(mgr.milestones)) {
            throw new Error('milestones not loaded');
        }
        if (mgr.milestones.length === 0) throw new Error('milestones is empty');
    });

    // ============================================
    // 🏆 ACHIEVEMENT CHECKING
    // ============================================
    // NOTE: In the browser, the singleton already exists from app boot.
    // We create fresh instances via constructor overrides to avoid stale deps.
    resultsDiv.innerHTML += '<h4 class="test-section">🏆 Achievement Checking</h4>';

    function freshMgr(stateOverrides = {}) {
        const deps = {
            AppState: createMockAppState(stateOverrides),
            appInit: createMockAppInit(),
            showNotification: () => {},
            logHistoryEvent: () => {},
            vocabThemeManager: { unlockThemeFromAchievement: () => false },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            getBody: () => document.body,
            getActiveElement: () => document.activeElement,
        };
        const inst = new AchievementsManager(deps);
        inst.milestones = mgr.milestones; // reuse loaded MILESTONES
        return inst;
    }

    await test('checkAchievements returns array', () => {
        const m = freshMgr();
        const result = m.checkAchievements(0, 0);
        if (!Array.isArray(result)) throw new Error('Should return array');
    });

    await test('checkAchievements unlocks at 5 cycles', () => {
        const m = freshMgr();
        const result = m.checkAchievements(5, 0);
        // Assert the SPECIFIC milestone unlocked — the old `result.length === 0` check would
        // pass even if the WRONG milestone unlocked.
        if (!result.some(a => a.milestone.id === 'milestone-5')) {
            throw new Error(`expected milestone-5 to unlock at 5 cycles, got: ${JSON.stringify(result.map(a => a.milestone.id))}`);
        }
    });

    await test('checkAchievements does not double-unlock', () => {
        const m = freshMgr({
            achievements: {
                unlocked: [{ milestoneId: 'milestone-5', unlockedAt: Date.now() }],
                seen: {}
            }
        });
        const result = m.checkAchievements(5, 0);
        if (result.length > 0) throw new Error('Should not re-unlock already unlocked');
    });

    await test('checkAchievements returns empty for 0 progress', () => {
        const m = freshMgr();
        const result = m.checkAchievements(0, 0);
        if (result.length !== 0) throw new Error('Should return empty at 0 progress');
    });

    // ============================================
    // 📊 PROGRESS QUERIES
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Progress Queries</h4>';

    await test('getAchievements returns object with unlocked and upcoming', () => {
        const m = freshMgr();
        const result = m.getAchievements();
        if (!result) throw new Error('Should return object');
        if (!Array.isArray(result.unlocked)) throw new Error('Missing unlocked array');
        if (!Array.isArray(result.upcoming)) throw new Error('Missing upcoming array');
    });

    await test('getAchievements shows progress toward next milestone', () => {
        const m = freshMgr({
            userProgress: { cyclesCompleted: 3, totalTasksCleared: 10 }
        });
        const result = m.getAchievements();
        if (result.upcoming.length === 0) throw new Error('Should show upcoming milestones');
    });

    await test('isUnlocked returns false for locked achievement', () => {
        const m = freshMgr();
        if (m.isUnlocked('milestone-100')) throw new Error('Should be locked');
    });

    await test('isUnlocked returns true for unlocked achievement', () => {
        const m = freshMgr({
            achievements: {
                unlocked: [{ milestoneId: 'milestone-5', unlockedAt: Date.now() }],
                seen: {}
            }
        });
        if (!m.isUnlocked('milestone-5')) throw new Error('Should be unlocked');
    });

    // ============================================
    // ⚠️ ERROR HANDLING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('checkAchievements handles minimal state', () => {
        const m = freshMgr({
            achievements: { unlocked: [], seen: {} }
        });
        const result = m.checkAchievements(0, 0);
        if (!Array.isArray(result)) throw new Error('Should return array');
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
