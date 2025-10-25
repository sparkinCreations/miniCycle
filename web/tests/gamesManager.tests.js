/**
 * GamesManager Browser Tests
 * Test functions for module-test-suite.html
 */

export function runGamesManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎮 GamesManager Tests</h2><h3>Running tests...</h3>';

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

    test('GamesManager class exists', () => {
        if (typeof window.GamesManager === 'undefined') {
            throw new Error('GamesManager class not found');
        }
    });

    test('creates instance successfully', () => {
        const gm = new window.GamesManager();
        if (!gm || typeof gm.checkGamesUnlock !== 'function') {
            throw new Error('GamesManager not properly initialized');
        }
    });

    test('has global instance', () => {
        if (!window.gamesManager) {
            throw new Error('Global gamesManager instance not found');
        }
        if (typeof window.gamesManager.checkGamesUnlock !== 'function') {
            throw new Error('Global instance missing methods');
        }
    });

    test('has version property', () => {
        const gm = new window.GamesManager();
        if (!gm.version) {
            throw new Error('Version property missing');
        }
        if (typeof gm.version !== 'string') {
            throw new Error('Version should be a string');
        }
    });

    // ===== APPSTATE INTEGRATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">💾 AppState Integration</h4>';

    test('checkGamesUnlock handles AppState not ready', () => {
        const gm = new window.GamesManager();

        // Clear AppState
        delete window.AppState;

        // Should not throw, just warn
        gm.checkGamesUnlock();
    });

    test('checkGamesUnlock reads from AppState', () => {
        const gm = new window.GamesManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    unlockedFeatures: ['task-order-game']
                }
            })
        };

        // Should not throw
        gm.checkGamesUnlock();
    });

    test('unlockMiniGame handles AppState not ready', () => {
        const gm = new window.GamesManager();

        // Clear AppState
        delete window.AppState;

        // Should not throw, just warn
        gm.unlockMiniGame();
    });

    test('unlockMiniGame adds to unlockedFeatures', () => {
        const gm = new window.GamesManager();

        let updateCalled = false;
        const mockState = {
            settings: {
                unlockedFeatures: []
            },
            userProgress: {
                rewardMilestones: []
            }
        };

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => mockState,
            update: (updateFn, save) => {
                updateCalled = true;
                updateFn(mockState);
            }
        };

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

    test('unlockMiniGame does not duplicate if already unlocked', () => {
        const gm = new window.GamesManager();

        let updateCalled = false;
        const mockState = {
            settings: {
                unlockedFeatures: ['task-order-game']
            },
            userProgress: {
                rewardMilestones: ['task-order-game-100']
            }
        };

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => mockState,
            update: (updateFn, save) => {
                updateCalled = true;
            }
        };

        gm.unlockMiniGame();

        if (updateCalled) {
            throw new Error('Should not update if already unlocked');
        }
    });

    // ===== DOM MANIPULATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Manipulation</h4>';

    test('checkGamesUnlock shows menu when unlocked', () => {
        const gm = new window.GamesManager();

        // Create mock DOM element
        const mockElement = document.createElement('div');
        mockElement.id = 'games-menu-option';
        mockElement.style.display = 'none';
        document.body.appendChild(mockElement);

        // Mock AppState with unlocked game
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    unlockedFeatures: ['task-order-game']
                }
            })
        };

        gm.checkGamesUnlock();

        if (mockElement.style.display !== 'block') {
            throw new Error('Menu should be visible when unlocked');
        }

        // Cleanup
        document.body.removeChild(mockElement);
    });

    test('checkGamesUnlock hides menu when locked', () => {
        const gm = new window.GamesManager();

        // Create mock DOM element
        const mockElement = document.createElement('div');
        mockElement.id = 'games-menu-option';
        mockElement.style.display = 'block';
        document.body.appendChild(mockElement);

        // Mock AppState with no unlocked games
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    unlockedFeatures: []
                }
            })
        };

        gm.checkGamesUnlock();

        if (mockElement.style.display !== 'none') {
            throw new Error('Menu should be hidden when locked');
        }

        // Cleanup
        document.body.removeChild(mockElement);
    });

    test('checkGamesUnlock handles missing DOM element', () => {
        const gm = new window.GamesManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    unlockedFeatures: ['task-order-game']
                }
            })
        };

        // Should not throw even if element doesn't exist
        gm.checkGamesUnlock();
    });

    // ===== GLOBAL WRAPPER TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

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

    // ===== ERROR HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    test('handles null AppState gracefully', () => {
        const gm = new window.GamesManager();

        window.AppState = null;

        // Should not throw
        gm.checkGamesUnlock();
        gm.unlockMiniGame();
    });

    test('handles missing settings object', () => {
        const gm = new window.GamesManager();

        window.AppState = {
            isReady: () => true,
            get: () => ({
                // Missing settings
            })
        };

        // Should not throw
        gm.checkGamesUnlock();
    });

    test('handles missing unlockedFeatures array', () => {
        const gm = new window.GamesManager();

        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    // Missing unlockedFeatures
                }
            })
        };

        // Should not throw and treat as empty array
        gm.checkGamesUnlock();
    });

    // ===== UNLOCK FLOW TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔓 Unlock Flow</h4>';

    test('unlockMiniGame calls checkGamesUnlock', () => {
        const gm = new window.GamesManager();

        let checkCalled = false;
        const originalCheck = gm.checkGamesUnlock;
        gm.checkGamesUnlock = () => {
            checkCalled = true;
        };

        const mockState = {
            settings: {
                unlockedFeatures: []
            },
            userProgress: {
                rewardMilestones: []
            }
        };

        window.AppState = {
            isReady: () => true,
            get: () => mockState,
            update: (updateFn) => updateFn(mockState)
        };

        gm.unlockMiniGame();

        if (!checkCalled) {
            throw new Error('checkGamesUnlock should be called after unlock');
        }

        // Restore
        gm.checkGamesUnlock = originalCheck;
    });

    test('complete unlock flow updates UI', () => {
        const gm = new window.GamesManager();

        // Create mock DOM element
        const mockElement = document.createElement('div');
        mockElement.id = 'games-menu-option';
        mockElement.style.display = 'none';
        document.body.appendChild(mockElement);

        const mockState = {
            settings: {
                unlockedFeatures: []
            },
            userProgress: {
                rewardMilestones: []
            }
        };

        window.AppState = {
            isReady: () => true,
            get: () => mockState,
            update: (updateFn) => updateFn(mockState)
        };

        // Unlock the game
        gm.unlockMiniGame();

        // UI should be updated (menu visible)
        if (mockElement.style.display !== 'block') {
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
