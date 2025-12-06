/**
 * OnboardingManager Browser Tests (DI-Pure)
 * Test functions for module-test-suite.html
 *
 * Uses dependency injection pattern - no reliance on window.* globals
 */

// Import the module and its DI setter
let OnboardingManager = null;
let setOnboardingManagerDependencies = null;
let onboardingManagerInstance = null;

export async function runOnboardingManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎓 OnboardingManager Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const module = await import('../modules/ui/onboardingManager.js');
        OnboardingManager = module.default;
        setOnboardingManagerDependencies = module.setOnboardingManagerDependencies;
        onboardingManagerInstance = module.onboardingManager;
        resultsDiv.innerHTML = '<h2>🎓 OnboardingManager Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>🎓 OnboardingManager Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    let passed = { count: 0 };
    let total = { count: 0 };

    // Create mock dependencies for DI-pure testing
    function createMockDeps(overrides = {}) {
        const mockState = {
            settings: { onboardingCompleted: false, theme: 'default' }
        };
        return {
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (fn) => { fn(mockState); return mockState; }
            },
            AppMeta: { version: '1.0.0-test' },
            showNotification: () => {},
            showCycleCreationModal: () => {},
            completeInitialSetup: () => {},
            safeAddEventListenerById: () => {},
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
            // Also clean up any modals created during tests
            const testModal = document.getElementById('onboarding-modal');
            if (testModal) {
                testModal.remove();
            }

            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ===== INITIALIZATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('OnboardingManager class exists', () => {
        if (typeof OnboardingManager === 'undefined') {
            throw new Error('OnboardingManager class not found');
        }
    });

    test('creates instance with DI successfully', () => {
        const mockDeps = createMockDeps();
        setOnboardingManagerDependencies(mockDeps);
        const om = new OnboardingManager();
        if (!om || typeof om.showOnboarding !== 'function') {
            throw new Error('OnboardingManager not properly initialized');
        }
    });

    test('has global instance (backward compat)', () => {
        if (!window.onboardingManager) {
            throw new Error('Global onboardingManager instance not found');
        }
        if (typeof window.onboardingManager.showOnboarding !== 'function') {
            throw new Error('Global instance missing methods');
        }
    });

    test('has version property via DI', () => {
        const mockDeps = createMockDeps();
        setOnboardingManagerDependencies(mockDeps);
        const om = new OnboardingManager();
        if (!om.version) {
            throw new Error('Version property missing');
        }
        if (om.version !== '1.0.0-test') {
            throw new Error('Version should come from injected AppMeta');
        }
    });

    // ===== APPSTATE INTEGRATION TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">💾 AppState Integration (DI)</h4>';

    test('shouldShowOnboarding handles AppState not ready (DI)', () => {
        // Inject deps with AppState that's not ready
        setOnboardingManagerDependencies({
            AppState: { isReady: () => false, get: () => null },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        // Should return false when AppState not ready
        const result = om.shouldShowOnboarding();
        if (result !== false) {
            throw new Error('Should return false when AppState not ready');
        }
    });

    test('shouldShowOnboarding reads from injected AppState', () => {
        const mockState = {
            settings: { onboardingCompleted: false }
        };
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        const result = om.shouldShowOnboarding();
        if (result !== true) {
            throw new Error('Should return true when onboarding not completed');
        }
    });

    test('shouldShowOnboarding returns false when already completed (DI)', () => {
        const mockState = {
            settings: { onboardingCompleted: true }
        };
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        const result = om.shouldShowOnboarding();
        if (result !== false) {
            throw new Error('Should return false when onboarding completed');
        }
    });

    test('completeOnboarding updates AppState (DI)', () => {
        let updateCalled = false;
        const mockState = {
            settings: { onboardingCompleted: false }
        };

        setOnboardingManagerDependencies({
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
        const om = new OnboardingManager();

        // Create mock modal
        const modal = document.createElement('div');
        modal.id = 'onboarding-modal';

        om.completeOnboarding(modal, {}, null);

        if (!updateCalled) {
            throw new Error('AppState.update not called');
        }
        if (mockState.settings.onboardingCompleted !== true) {
            throw new Error('onboardingCompleted not set to true');
        }
    });

    test('resetOnboarding clears flag in AppState (DI)', () => {
        let updateCalled = false;
        let notificationShown = false;
        const mockState = {
            settings: { onboardingCompleted: true }
        };

        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (updateFn, save) => {
                    updateCalled = true;
                    updateFn(mockState);
                }
            },
            AppMeta: { version: '1.0.0' },
            showNotification: () => { notificationShown = true; }
        });
        const om = new OnboardingManager();

        om.resetOnboarding();

        if (!updateCalled) {
            throw new Error('AppState.update not called');
        }
        if (mockState.settings.onboardingCompleted !== false) {
            throw new Error('onboardingCompleted not set to false');
        }
    });

    test('resetOnboarding handles AppState not ready (DI)', () => {
        let notificationShown = false;

        setOnboardingManagerDependencies({
            AppState: { isReady: () => false, get: () => null },
            AppMeta: { version: '1.0.0' },
            showNotification: () => { notificationShown = true; }
        });
        const om = new OnboardingManager();

        // Should not throw
        om.resetOnboarding();

        if (!notificationShown) {
            throw new Error('Should show error notification when AppState not ready');
        }
    });

    // ===== DOM MANIPULATION TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Manipulation (DI)</h4>';

    test('createOnboardingModal creates modal with correct structure (DI)', () => {
        setOnboardingManagerDependencies(createMockDeps());
        const om = new OnboardingManager();

        const modal = om.createOnboardingModal('default');

        if (!modal || modal.id !== 'onboarding-modal') {
            throw new Error('Modal not created with correct ID');
        }
        if (!modal.querySelector('#onboarding-skip')) {
            throw new Error('Skip button not found');
        }
        if (!modal.querySelector('#onboarding-step-content')) {
            throw new Error('Step content container not found');
        }
        if (!modal.querySelector('#onboarding-next')) {
            throw new Error('Next button not found');
        }
        if (!modal.querySelector('#onboarding-prev')) {
            throw new Error('Prev button not found');
        }

        // Cleanup
        modal.remove();
    });

    test('createOnboardingModal applies theme correctly (DI)', () => {
        setOnboardingManagerDependencies(createMockDeps());
        const om = new OnboardingManager();

        const modal = om.createOnboardingModal('ocean');

        const content = modal.querySelector('.onboarding-content');
        if (!content || !content.className.includes('theme-ocean')) {
            throw new Error('Theme not applied correctly');
        }

        // Cleanup
        modal.remove();
    });

    test('showOnboarding creates modal in DOM (DI)', () => {
        const mockState = {
            settings: { theme: 'default', onboardingCompleted: false }
        };
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        if (!modal) {
            throw new Error('Modal not added to DOM');
        }

        // Cleanup
        modal.remove();
    });

    test('showOnboarding handles AppState not ready (DI)', () => {
        setOnboardingManagerDependencies({
            AppState: { isReady: () => false, get: () => null },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        // Should not throw
        om.showOnboarding({}, null);

        // Should not create modal
        const modal = document.getElementById('onboarding-modal');
        if (modal) {
            modal.remove();
            throw new Error('Should not create modal when AppState not ready');
        }
    });

    test('showOnboarding handles missing settings object (DI)', () => {
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({}) // Missing settings
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        // Should not throw, should use default theme
        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        if (modal) {
            const content = modal.querySelector('.onboarding-content');
            if (!content.className.includes('theme-default')) {
                throw new Error('Should use default theme when settings missing');
            }
            modal.remove();
        }
    });

    test('modal contains 3 steps of content (DI)', () => {
        const mockState = {
            settings: { theme: 'default', onboardingCompleted: false }
        };
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        if (!modal) {
            throw new Error('Modal not created');
        }

        const stepContent = modal.querySelector('#onboarding-step-content');
        if (!stepContent || !stepContent.innerHTML.includes('Welcome to miniCycle')) {
            throw new Error('First step content not rendered');
        }

        // Cleanup
        modal.remove();
    });

    // ===== MODAL CONTROLS TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎮 Modal Controls (DI)</h4>';

    test('next button advances to step 2 (DI)', () => {
        const mockState = {
            settings: { theme: 'default' }
        };
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        const nextBtn = modal.querySelector('#onboarding-next');
        const stepContent = modal.querySelector('#onboarding-step-content');

        // Click next
        nextBtn.click();

        // Check if step content changed
        if (!stepContent.innerHTML.includes('How Cycles Work')) {
            throw new Error('Did not advance to step 2');
        }

        // Cleanup
        modal.remove();
    });

    test('prev button goes back to step 1 (DI)', () => {
        const mockState = {
            settings: { theme: 'default' }
        };
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        const nextBtn = modal.querySelector('#onboarding-next');
        const prevBtn = modal.querySelector('#onboarding-prev');
        const stepContent = modal.querySelector('#onboarding-step-content');

        // Go to step 2
        nextBtn.click();

        // Go back to step 1
        prevBtn.click();

        // Check if back to step 1
        if (!stepContent.innerHTML.includes('Welcome to miniCycle')) {
            throw new Error('Did not go back to step 1');
        }

        // Cleanup
        modal.remove();
    });

    test('prev button hidden on first step (DI)', () => {
        const mockState = {
            settings: { theme: 'default' }
        };
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        const prevBtn = modal.querySelector('#onboarding-prev');

        if (!prevBtn.classList.contains('hidden')) {
            throw new Error('Prev button should be hidden on first step');
        }

        // Cleanup
        modal.remove();
    });

    test('next button shows "Start" on last step (DI)', () => {
        const mockState = {
            settings: { theme: 'default' }
        };
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        const nextBtn = modal.querySelector('#onboarding-next');

        // Go to last step
        nextBtn.click();
        nextBtn.click();

        if (!nextBtn.textContent.includes('Start')) {
            throw new Error('Next button should show "Start" on last step');
        }

        // Cleanup
        modal.remove();
    });

    test('skip button completes onboarding (DI)', () => {
        let updateCalled = false;
        const mockState = {
            settings: { theme: 'default', onboardingCompleted: false }
        };

        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (updateFn) => {
                    updateCalled = true;
                    updateFn(mockState);
                }
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        const skipBtn = modal.querySelector('#onboarding-skip');

        // Click skip
        skipBtn.click();

        if (!updateCalled) {
            throw new Error('Skip should complete onboarding');
        }
        if (mockState.settings.onboardingCompleted !== true) {
            throw new Error('onboardingCompleted should be true after skip');
        }
    });

    test('clicking outside modal completes onboarding (DI)', () => {
        let updateCalled = false;
        const mockState = {
            settings: { theme: 'default', onboardingCompleted: false }
        };

        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: (updateFn) => {
                    updateCalled = true;
                    updateFn(mockState);
                }
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');

        // Simulate click on modal background (not content)
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: modal, enumerable: true });
        modal.dispatchEvent(event);

        if (!updateCalled) {
            throw new Error('Click outside should complete onboarding');
        }
    });

    // ===== FLOW INTEGRATION TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Flow Integration (DI)</h4>';

    test('completeOnboarding calls showCycleCreationModal when no cycle (DI)', async () => {
        let modalCalled = false;

        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: {} }),
                update: (updateFn) => { updateFn({ settings: {} }); }
            },
            AppMeta: { version: '1.0.0' },
            showCycleCreationModal: () => { modalCalled = true; }
        });
        const om = new OnboardingManager();

        const modal = document.createElement('div');
        modal.id = 'onboarding-modal';

        // Complete with no active cycle
        om.completeOnboarding(modal, {}, null);

        // Wait for setTimeout
        await new Promise(resolve => setTimeout(resolve, 400));

        if (!modalCalled) {
            throw new Error('showCycleCreationModal should be called when no active cycle');
        }
    });

    test('completeOnboarding calls completeInitialSetup when has cycle (DI)', () => {
        let setupCalled = false;

        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: {} }),
                update: (updateFn) => { updateFn({ settings: {} }); }
            },
            AppMeta: { version: '1.0.0' },
            completeInitialSetup: () => { setupCalled = true; }
        });
        const om = new OnboardingManager();

        const modal = document.createElement('div');
        modal.id = 'onboarding-modal';

        const cycles = { 'cycle1': { title: 'Test Cycle' } };

        // Complete with active cycle
        om.completeOnboarding(modal, cycles, 'cycle1');

        if (!setupCalled) {
            throw new Error('completeInitialSetup should be called when has active cycle');
        }
    });

    test('completeOnboarding removes modal from DOM (DI)', () => {
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: {} }),
                update: (updateFn) => { updateFn({ settings: {} }); }
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        const modal = document.createElement('div');
        modal.id = 'onboarding-modal';
        document.body.appendChild(modal);

        om.completeOnboarding(modal, {}, null);

        // Modal should be removed
        const checkModal = document.getElementById('onboarding-modal');
        if (checkModal) {
            throw new Error('Modal should be removed after completion');
        }
    });

    test('completeOnboarding handles missing dependencies gracefully (DI)', () => {
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: {} }),
                update: (updateFn) => { updateFn({ settings: {} }); }
            },
            AppMeta: { version: '1.0.0' }
            // No showCycleCreationModal or completeInitialSetup
        });
        const om = new OnboardingManager();

        const modal = document.createElement('div');
        modal.id = 'onboarding-modal';

        // Should not throw
        om.completeOnboarding(modal, {}, null);
    });

    // ===== GLOBAL WRAPPER TESTS (Backward Compat) =====

    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers (Backward Compat)</h4>';

    test('window.showOnboarding exists', () => {
        if (typeof window.showOnboarding !== 'function') {
            throw new Error('Global showOnboarding not found');
        }
    });

    test('global showOnboarding calls instance method', () => {
        let called = false;

        // Mock the instance method
        const originalMethod = window.onboardingManager.showOnboarding;
        window.onboardingManager.showOnboarding = () => {
            called = true;
        };

        window.showOnboarding({}, null);

        if (!called) {
            throw new Error('Global wrapper did not call instance method');
        }

        // Restore
        window.onboardingManager.showOnboarding = originalMethod;
    });

    test('onboardingManager instance is accessible globally', () => {
        if (!window.onboardingManager) {
            throw new Error('onboardingManager instance not accessible globally');
        }
        if (!(window.onboardingManager instanceof window.OnboardingManager)) {
            throw new Error('Global instance is not OnboardingManager instance');
        }
    });

    // ===== ERROR HANDLING TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling (DI)</h4>';

    test('handles null AppState gracefully (DI)', () => {
        setOnboardingManagerDependencies({
            AppState: null,
            AppMeta: { version: '1.0.0' },
            showNotification: () => {}
        });
        const om = new OnboardingManager();

        // Should not throw
        om.shouldShowOnboarding();
        om.showOnboarding({}, null);
        om.resetOnboarding();
    });

    test('handles missing AppState.get gracefully (DI)', () => {
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true
                // Missing get method
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        // Should not throw
        om.shouldShowOnboarding();
    });

    test('handles null cycles and activeCycle (DI)', () => {
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: {} }),
                update: (updateFn) => { updateFn({ settings: {} }); }
            },
            AppMeta: { version: '1.0.0' }
        });
        const om = new OnboardingManager();

        const modal = document.createElement('div');

        // Should not throw
        om.completeOnboarding(modal, null, null);
        om.completeOnboarding(modal, undefined, undefined);
    });

    test('resetOnboarding handles missing showNotification (DI)', () => {
        setOnboardingManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => ({ settings: {} }),
                update: (updateFn) => { updateFn({ settings: {} }); }
            },
            AppMeta: { version: '1.0.0' }
            // No showNotification - falls back to console
        });
        const om = new OnboardingManager();

        // Should not throw (uses fallback notification)
        om.resetOnboarding();
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
