/**
 * GamesManager Browser Tests (DI-Pure)
 * Test functions for module-test-suite.html
 *
 * Uses dependency injection pattern - no reliance on window.* globals
 */

// Import the module and its DI setter
let GamesManager = null;
let setGamesManagerDependencies = null;
let gamesManagerInstance = null;

export async function runGamesManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎮 GamesManager Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const module = await import('../modules/ui/gamesManager.js');
        GamesManager = module.default;
        setGamesManagerDependencies = module.setGamesManagerDependencies;
        gamesManagerInstance = module.gamesManager;
        resultsDiv.innerHTML = '<h2>🎮 GamesManager Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>🎮 GamesManager Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    let passed = { count: 0 };
    let total = { count: 0 };

    // Create mock dependencies for DI-pure testing
    function createMockDeps(overrides = {}) {
        const mockState = {
            settings: { unlockedFeatures: [] },
            userProgress: { rewardMilestones: [] }
        };
        return {
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (fn) => { fn(mockState); return mockState; }
            },
            AppMeta: { version: '1.0.0-test' },
            safeAddEventListener: () => {},
            ...overrides
        };
    }

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

    test('GamesManager class exists', () => {
        if (typeof GamesManager === 'undefined') {
            throw new Error('GamesManager class not found');
        }
    });

    test('creates instance with DI successfully', () => {
        const mockDeps = createMockDeps();
        setGamesManagerDependencies(mockDeps);
        const gm = new GamesManager();
        if (!gm || typeof gm.checkGamesUnlock !== 'function') {
            throw new Error('GamesManager not properly initialized');
        }
    });

    test('has global instance (backward compat)', () => {
        if (!window.gamesManager) {
            throw new Error('Global gamesManager instance not found');
        }
        if (typeof window.gamesManager.checkGamesUnlock !== 'function') {
            throw new Error('Global instance missing methods');
        }
    });

    test('has version property via DI', () => {
        const mockDeps = createMockDeps();
        setGamesManagerDependencies(mockDeps);
        const gm = new GamesManager();
        if (!gm.version) {
            throw new Error('Version property missing');
        }
        if (gm.version !== '1.0.0-test') {
            throw new Error('Version should come from injected AppMeta');
        }
    });

    // ===== APPSTATE INTEGRATION TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">💾 AppState Integration (DI)</h4>';

    test('checkGamesUnlock handles AppState not ready (DI)', () => {
        // Inject deps with AppState that's not ready
        setGamesManagerDependencies({
            AppState: { isReady: () => false, get: () => null },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        // Should not throw, just warn
        gm.checkGamesUnlock();
    });

    test('checkGamesUnlock reads from injected AppState', () => {
        const mockState = {
            settings: { unlockedFeatures: ['task-order-game'] }
        };
        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        // Should not throw
        gm.checkGamesUnlock();
    });

    test('unlockMiniGame handles AppState not ready (DI)', () => {
        setGamesManagerDependencies({
            AppState: { isReady: () => false, get: () => null },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        // Should not throw, just warn
        gm.unlockMiniGame();
    });

    test('unlockMiniGame adds to unlockedFeatures (DI)', () => {
        let updateCalled = false;
        const mockState = {
            settings: { unlockedFeatures: [] },
            userProgress: { rewardMilestones: [] }
        };

        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (updateFn, save) => {
                    updateCalled = true;
                    updateFn(mockState);
                }
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        gm.unlockMiniGame();

        if (!updateCalled) {
            throw new Error('AppState.update not called');
        }
        if (!mockState.settings.unlockedFeatures.includes('task-order-game')) {
            throw new Error('task-order-game not added to unlockedFeatures');
        }
        if (!mockState.userProgress.rewardMilestones.includes('task-order-game-100')) {
            throw new Error('Milestone not added');
        }
    });

    test('unlockMiniGame does not duplicate if already unlocked (DI)', () => {
        let updateCalled = false;
        const mockState = {
            settings: { unlockedFeatures: ['task-order-game'] },
            userProgress: { rewardMilestones: ['task-order-game-100'] }
        };

        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (updateFn, save) => { updateCalled = true; }
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        gm.unlockMiniGame();

        if (updateCalled) {
            throw new Error('Should not update if already unlocked');
        }
    });

    // ===== DOM MANIPULATION TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Manipulation (DI)</h4>';

    test('checkGamesUnlock shows menu when unlocked (DI)', () => {
        // Create mock DOM element
        const mockElement = document.createElement('div');
        mockElement.id = 'games-menu-option';
        mockElement.style.display = 'none';
        document.body.appendChild(mockElement);

        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: { unlockedFeatures: ['task-order-game'] } })
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        gm.checkGamesUnlock();

        if (mockElement.style.display !== 'block') {
            document.body.removeChild(mockElement);
            throw new Error('Menu should be visible when unlocked');
        }

        // Cleanup
        document.body.removeChild(mockElement);
    });

    test('checkGamesUnlock hides menu when locked (DI)', () => {
        // Create mock DOM element
        const mockElement = document.createElement('div');
        mockElement.id = 'games-menu-option';
        mockElement.style.display = 'block';
        document.body.appendChild(mockElement);

        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: { unlockedFeatures: [] } })
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        gm.checkGamesUnlock();

        if (mockElement.style.display !== 'none') {
            document.body.removeChild(mockElement);
            throw new Error('Menu should be hidden when locked');
        }

        // Cleanup
        document.body.removeChild(mockElement);
    });

    test('checkGamesUnlock handles missing DOM element (DI)', () => {
        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: { unlockedFeatures: ['task-order-game'] } })
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        // Should not throw even if element doesn't exist
        gm.checkGamesUnlock();
    });

    // ===== GLOBAL WRAPPER TESTS (Backward Compat) =====

    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers (Backward Compat)</h4>';

    test('window.checkGamesUnlock exists', () => {
        if (typeof window.checkGamesUnlock !== 'function') {
            throw new Error('Global checkGamesUnlock not found');
        }
    });

    test('window.unlockMiniGame exists', () => {
        if (typeof window.unlockMiniGame !== 'function') {
            throw new Error('Global unlockMiniGame not found');
        }
    });

    test('global checkGamesUnlock calls instance method', () => {
        let called = false;

        // Mock the instance method
        const originalMethod = window.gamesManager.checkGamesUnlock;
        window.gamesManager.checkGamesUnlock = () => {
            called = true;
        };

        window.checkGamesUnlock();

        if (!called) {
            throw new Error('Global wrapper did not call instance method');
        }

        // Restore
        window.gamesManager.checkGamesUnlock = originalMethod;
    });

    test('global unlockMiniGame calls instance method', () => {
        let called = false;

        // Mock the instance method
        const originalMethod = window.gamesManager.unlockMiniGame;
        window.gamesManager.unlockMiniGame = () => {
            called = true;
        };

        window.unlockMiniGame();

        if (!called) {
            throw new Error('Global wrapper did not call instance method');
        }

        // Restore
        window.gamesManager.unlockMiniGame = originalMethod;
    });

    // ===== ERROR HANDLING TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling (DI)</h4>';

    test('handles null AppState gracefully (DI)', () => {
        setGamesManagerDependencies({
            AppState: null,
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        // Should not throw
        gm.checkGamesUnlock();
        gm.unlockMiniGame();
    });

    test('handles missing settings object (DI)', () => {
        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({}) // Missing settings
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        // Should not throw
        gm.checkGamesUnlock();
    });

    test('handles missing unlockedFeatures array (DI)', () => {
        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: {} }) // Missing unlockedFeatures
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        // Should not throw and treat as empty array
        gm.checkGamesUnlock();
    });

    // ===== UNLOCK FLOW TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔓 Unlock Flow (DI)</h4>';

    test('unlockMiniGame calls checkGamesUnlock (DI)', () => {
        const mockState = {
            settings: { unlockedFeatures: [] },
            userProgress: { rewardMilestones: [] }
        };

        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (updateFn) => updateFn(mockState)
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        let checkCalled = false;
        const originalCheck = gm.checkGamesUnlock;
        gm.checkGamesUnlock = () => { checkCalled = true; };

        gm.unlockMiniGame();

        if (!checkCalled) {
            throw new Error('checkGamesUnlock should be called after unlock');
        }

        // Restore
        gm.checkGamesUnlock = originalCheck;
    });

    test('complete unlock flow updates UI (DI)', () => {
        // Create mock DOM element
        const mockElement = document.createElement('div');
        mockElement.id = 'games-menu-option';
        mockElement.style.display = 'none';
        document.body.appendChild(mockElement);

        const mockState = {
            settings: { unlockedFeatures: [] },
            userProgress: { rewardMilestones: [] }
        };

        setGamesManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (updateFn) => updateFn(mockState)
            },
            AppMeta: { version: '1.0.0' }
        });
        const gm = new GamesManager();

        // Unlock the game
        gm.unlockMiniGame();

        // UI should be updated (menu visible)
        if (mockElement.style.display !== 'block') {
            document.body.removeChild(mockElement);
            throw new Error('Menu should be visible after unlock');
        }

        // Cleanup
        document.body.removeChild(mockElement);
    });

    // ===== SUMMARY =====

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }

    return { passed: passed.count, total: total.count };
}
