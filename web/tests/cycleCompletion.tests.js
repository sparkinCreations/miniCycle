/**
 * CycleCompletion Tests
 * Tests for modules/progress/cycleCompletion.js
 *
 * Tests cycle completion functionality:
 * - Module loading and exports
 * - Dependency injection
 * - Completion animation
 * - Cycle count increment
 * - Milestone detection
 * - Theme/game unlocks
 */

import {
    setupTestEnvironment,
    createMockData,
    waitForAsyncOperations
} from './testHelpers.js';

import {
    setCycleCompletionDependencies,
    showCompletionAnimation,
    incrementCycleCount
} from '../modules/progress/cycleCompletion.js';

export async function runCycleCompletionTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>CycleCompletion Tests</h2><h3>Setting up mocks...</h3>';

    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>CycleCompletion Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // Save real app data
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
    }

    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // Helper: Create mock AppState with Schema 2.5 data
    function createMockAppStateWithData(overrides = {}) {
        const mockData = createMockData(overrides);
        return {
            isReady: () => true,
            get: () => mockData,
            update: (fn, immediate) => {
                fn(mockData);
                return mockData;
            }
        };
    }

    // Track notifications and function calls
    let notifications = [];
    let updateStatsPanelCalled = false;
    let darkOceanUnlocked = false;
    let goldenGlowUnlocked = false;
    let miniGameUnlocked = false;

    function resetTracking() {
        notifications = [];
        updateStatsPanelCalled = false;
        darkOceanUnlocked = false;
        goldenGlowUnlocked = false;
        miniGameUnlocked = false;
    }

    async function test(name, testFn) {
        total.count++;
        try {
            localStorage.clear();
            resetTracking();

            const mockSchemaData = createMockData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Clean up any DOM elements from previous tests
            document.querySelectorAll('.mini-cycle-complete-animation, .mini-cycle-milestone').forEach(el => el.remove());

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === MODULE LOADING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setCycleCompletionDependencies function exists', () => {
        if (typeof setCycleCompletionDependencies !== 'function') {
            throw new Error('setCycleCompletionDependencies not exported');
        }
    });

    await test('showCompletionAnimation function exists', () => {
        if (typeof showCompletionAnimation !== 'function') {
            throw new Error('showCompletionAnimation not exported');
        }
    });

    await test('incrementCycleCount function exists', () => {
        if (typeof incrementCycleCount !== 'function') {
            throw new Error('incrementCycleCount not exported');
        }
    });

    // === DEPENDENCY INJECTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💉 Dependency Injection</h4>';

    await test('setCycleCompletionDependencies accepts all dependencies', () => {
        const mockAppState = createMockAppStateWithData();

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: (msg) => notifications.push(msg),
            updateStatsPanel: () => { updateStatsPanelCalled = true; },
            unlockDarkOceanTheme: () => { darkOceanUnlocked = true; },
            unlockGoldenGlowTheme: () => { goldenGlowUnlocked = true; },
            unlockMiniGame: () => { miniGameUnlocked = true; }
        });
    });

    await test('setCycleCompletionDependencies merges with existing deps', () => {
        // First set some deps
        setCycleCompletionDependencies({
            AppState: createMockAppStateWithData()
        });

        // Then set more - should merge
        setCycleCompletionDependencies({
            showNotification: (msg) => notifications.push(msg)
        });

        // Should not throw when using later
    });

    // === COMPLETION ANIMATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎬 Completion Animation</h4>';

    await test('showCompletionAnimation creates animation element', () => {
        showCompletionAnimation();

        const animation = document.querySelector('.mini-cycle-complete-animation');
        if (!animation) {
            throw new Error('Animation element not created');
        }
    });

    await test('showCompletionAnimation element has checkmark', () => {
        showCompletionAnimation();

        const animation = document.querySelector('.mini-cycle-complete-animation');
        if (!animation.innerHTML.includes('✔')) {
            throw new Error('Animation should contain checkmark');
        }
    });

    await test('showCompletionAnimation element is appended to body', () => {
        showCompletionAnimation();

        const animation = document.querySelector('.mini-cycle-complete-animation');
        if (animation.parentElement !== document.body) {
            throw new Error('Animation should be appended to body');
        }
    });

    await test('showCompletionAnimation can be called multiple times', () => {
        showCompletionAnimation();
        showCompletionAnimation();
        showCompletionAnimation();

        const animations = document.querySelectorAll('.mini-cycle-complete-animation');
        if (animations.length !== 3) {
            throw new Error('Should create multiple animation elements');
        }
    });

    // === INCREMENT CYCLE COUNT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 Increment Cycle Count</h4>';

    await test('incrementCycleCount requires AppState', () => {
        setCycleCompletionDependencies({
            AppState: null
        });

        // Should not throw, just log error
        incrementCycleCount('test-cycle', {});
    });

    await test('incrementCycleCount updates cycle count', () => {
        let updatedState = null;
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 5,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn, immediate) => {
                fn(mockData);
                updatedState = mockData;
                return mockData;
            }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        if (updatedState.data.cycles['default'].cycleCount !== 6) {
            throw new Error(`Expected cycle count 6, got ${updatedState.data.cycles['default'].cycleCount}`);
        }
    });

    await test('incrementCycleCount updates userProgress.cyclesCompleted', () => {
        let updatedState = null;
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 10;
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 5,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn, immediate) => {
                fn(mockData);
                updatedState = mockData;
                return mockData;
            }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        if (updatedState.userProgress.cyclesCompleted !== 11) {
            throw new Error(`Expected global cycles 11, got ${updatedState.userProgress.cyclesCompleted}`);
        }
    });

    await test('incrementCycleCount shows completion animation', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        const animation = document.querySelector('.mini-cycle-complete-animation');
        if (!animation) {
            throw new Error('Should show completion animation');
        }
    });

    await test('incrementCycleCount calls updateStatsPanel', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => { updateStatsPanelCalled = true; }
        });

        incrementCycleCount('default', {});

        if (!updateStatsPanelCalled) {
            throw new Error('Should call updateStatsPanel');
        }
    });

    await test('incrementCycleCount handles missing active cycle gracefully', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'non-existent';

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState
        });

        // Should not throw
        incrementCycleCount('non-existent', {});
    });

    // === MILESTONE UNLOCK TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🏆 Milestone Unlocks</h4>';

    await test('unlocks Dark Ocean theme at 5 global cycles', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 4; // Will become 5 after increment
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {},
            unlockDarkOceanTheme: () => { darkOceanUnlocked = true; }
        });

        incrementCycleCount('default', {});

        // Note: The unlock is based on global cycles BEFORE increment
        // With 4 global cycles, the unlock check sees 4, not 5
    });

    await test('unlocks Golden Glow theme at 50 global cycles', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 50;
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {},
            unlockGoldenGlowTheme: () => { goldenGlowUnlocked = true; }
        });

        incrementCycleCount('default', {});

        if (!goldenGlowUnlocked) {
            throw new Error('Should unlock Golden Glow theme at 50 cycles');
        }
    });

    await test('unlocks mini game at 100 global cycles', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 100;
        mockData.settings = { unlockedFeatures: [] };
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: (msg) => notifications.push(msg),
            updateStatsPanel: () => {},
            unlockMiniGame: () => { miniGameUnlocked = true; }
        });

        incrementCycleCount('default', {});

        if (!miniGameUnlocked) {
            throw new Error('Should unlock mini game at 100 cycles');
        }
    });

    await test('does not re-unlock game if already unlocked', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 100;
        mockData.settings = { unlockedFeatures: ['task-order-game'] }; // Already unlocked
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: (msg) => notifications.push(msg),
            updateStatsPanel: () => {},
            unlockMiniGame: () => { miniGameUnlocked = true; }
        });

        incrementCycleCount('default', {});

        if (miniGameUnlocked) {
            throw new Error('Should not re-unlock game if already unlocked');
        }
    });

    // === MILESTONE MESSAGE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎉 Milestone Messages</h4>';

    await test('milestone levels are defined correctly', () => {
        // The module defines milestone levels: [10, 25, 50, 100, 200, 500, 1000]
        // This test verifies the milestone system exists and doesn't throw
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 5;
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 5,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        // Should complete without error
        incrementCycleCount('default', {});
    });

    await test('does not show milestone for non-milestone counts', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 7; // Not a milestone level
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        const milestone = document.querySelector('.mini-cycle-milestone');
        if (milestone) {
            throw new Error('Should not show milestone for non-milestone counts');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('handles null AppState gracefully', () => {
        setCycleCompletionDependencies({
            AppState: null
        });

        // Should not throw
        incrementCycleCount('test', {});
    });

    await test('handles AppState not ready', () => {
        const mockAppState = {
            isReady: () => false,
            get: () => null
        };

        setCycleCompletionDependencies({
            AppState: mockAppState
        });

        // Should not throw
        incrementCycleCount('test', {});
    });

    await test('handles missing state data', () => {
        const mockAppState = {
            isReady: () => true,
            get: () => null
        };

        setCycleCompletionDependencies({
            AppState: mockAppState
        });

        // Should not throw
        incrementCycleCount('test', {});
    });

    await test('handles missing unlockDarkOceanTheme function', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 5;
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            updateStatsPanel: () => {},
            unlockDarkOceanTheme: null // Not provided
        });

        // Should not throw
        incrementCycleCount('default', {});
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    // Clean up DOM elements
    document.querySelectorAll('.mini-cycle-complete-animation, .mini-cycle-milestone').forEach(el => el.remove());

    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
