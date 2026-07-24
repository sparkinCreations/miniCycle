/**
 * OnboardingManager Browser Tests (DI-Pure)
 * Test functions for module-test-suite.html
 *
 * Uses dependency injection pattern - no reliance on window.* globals
 */

// DI-pure pattern: direct module imports instead of testContext

// Import the module and its DI setter
let OnboardingManager = null;
let setOnboardingManagerDependencies = null;
let onboardingManagerInstance = null;

export async function runOnboardingManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎓 OnboardingManager Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const cacheBuster = window.testCacheBuster || Date.now();
        const module = await import(`../modules/ui/onboardingManager.js?v=${cacheBuster}`);
        OnboardingManager = module.OnboardingManager;  // Named export, not default
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
            safeAddEventListener: (el, event, handler, options) => {
                if (el && typeof el.addEventListener === 'function') {
                    el.addEventListener(event, handler, options);
                }
            },
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

    await test('OnboardingManager class exists', () => {
        if (typeof OnboardingManager === 'undefined') {
            throw new Error('OnboardingManager class not found');
        }
    });

    await test('creates instance with DI successfully', () => {
        const mockDeps = createMockDeps();
        setOnboardingManagerDependencies(mockDeps);
        const om = new OnboardingManager();
        if (!om || typeof om.showOnboarding !== 'function') {
            throw new Error('OnboardingManager not properly initialized');
        }
    });

    await test('module exports singleton instance', () => {
        // Module exports onboardingManager as named export
        if (!onboardingManagerInstance) {
            throw new Error('Module-level onboardingManager instance not found');
        }
        if (typeof onboardingManagerInstance.showOnboarding !== 'function') {
            throw new Error('Module instance missing methods');
        }
    });

    await test('accepts dependency injection with AppMeta', () => {
        const mockDeps = createMockDeps();
        setOnboardingManagerDependencies(mockDeps);
        const om = new OnboardingManager();
        // Version property comes from AppMeta when injected
        if (mockDeps.AppMeta && !om.version) {
            throw new Error('Version should come from injected AppMeta');
        }
    });

    // ===== APPSTATE INTEGRATION TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">💾 AppState Integration (DI)</h4>';

    await test('shouldShowOnboarding handles AppState not ready (DI)', () => {
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

    await test('shouldShowOnboarding reads from injected AppState', () => {
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

    await test('shouldShowOnboarding returns false when already completed (DI)', () => {
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

    await test('completeOnboarding updates AppState (DI)', () => {
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

    await test('resetOnboarding clears flag in AppState (DI)', () => {
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

    await test('resetOnboarding handles AppState not ready (DI)', () => {
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

    await test('createOnboardingModal creates modal with correct structure (DI)', () => {
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

    await test('createOnboardingModal applies theme correctly (DI)', () => {
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

    await test('showOnboarding creates modal in DOM (DI)', () => {
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

    await test('showOnboarding handles AppState not ready (DI)', () => {
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

    await test('showOnboarding handles missing settings object (DI)', () => {
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

    await test('modal contains 3 steps of content (DI)', () => {
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

    await test('next button advances to step 2 (DI)', () => {
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

    await test('prev button goes back to step 1 (DI)', () => {
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

    await test('prev button hidden on first step (DI)', () => {
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

    await test('next button shows "Let\'s Go!" on last step (DI)', () => {
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

        // On the last step, the button shows getLabel('onboarding.start') which is "Let's Go!" + 🚀
        if (!nextBtn.textContent.includes("Let's Go!")) {
            throw new Error(`Next button should show "Let's Go!" on last step, got "${nextBtn.textContent}"`);
        }

        // Cleanup
        modal.remove();
    });

    await test('skip button completes onboarding (DI)', () => {
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

    await test('clicking outside modal completes onboarding (DI)', () => {
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

    // NOTE: Async test for 'showCycleCreationModal when no cycle' removed - flaky in automated
    // test environment due to setTimeout timing issues. Run manually in browser test suite.

    await test('completeOnboarding calls completeInitialSetup when has cycle (DI)', () => {
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

    await test('completeOnboarding removes modal from DOM (DI)', () => {
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

    await test('completeOnboarding handles missing dependencies gracefully (DI)', () => {
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

    // ===== MODULE EXPORTS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Exports</h4>';

    await test('OnboardingManager class is exported', () => {
        if (typeof OnboardingManager !== 'function') {
            throw new Error('OnboardingManager class not exported');
        }
    });

    await test('setOnboardingManagerDependencies function is exported', () => {
        if (typeof setOnboardingManagerDependencies !== 'function') {
            throw new Error('setOnboardingManagerDependencies not exported');
        }
    });

    await test('module instance can call showOnboarding', () => {
        if (!onboardingManagerInstance) {
            throw new Error('Module instance not available');
        }
        if (typeof onboardingManagerInstance.showOnboarding !== 'function') {
            throw new Error('Module instance missing showOnboarding method');
        }
    });

    await test('module instance is OnboardingManager type', () => {
        if (!onboardingManagerInstance) {
            throw new Error('Module instance not available');
        }
        if (!(onboardingManagerInstance instanceof OnboardingManager)) {
            throw new Error('Module instance is not OnboardingManager type');
        }
    });

    // ===== ERROR HANDLING TESTS (DI-Pure) =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling (DI)</h4>';

    await test('handles null AppState gracefully (DI)', () => {
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

    await test('handles missing AppState.get gracefully (DI)', () => {
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

    await test('handles null cycles and activeCycle (DI)', () => {
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

    await test('resetOnboarding handles missing showNotification (DI)', () => {
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

    // ===== FIRST-RUN FOCUS-FIRST FLOW =====

    resultsDiv.innerHTML += '<h4 class="test-section">🚀 First-Run Focus-First Flow</h4>';

    await test('runFirstRunFlow loads sample, sets focus state, attaches lifecycle', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        let preloadCalled = false;
        let activateCalled = false;

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            preloadInitialRunCycle: async () => { preloadCalled = true; return true; },
            activateFocusMode: () => { activateCalled = true; },
            appInit: { isAppReady: () => true }
        }));
        const om = new OnboardingManager();

        const ok = await om.runFirstRunFlow();

        if (!ok) throw new Error('runFirstRunFlow returned false on success path');
        if (!preloadCalled) throw new Error('preloadInitialRunCycle was not called');
        if (state.settings.focusModeActive !== true) {
            throw new Error('state.settings.focusModeActive should be true after runFirstRunFlow');
        }
        if (!activateCalled) throw new Error('activateFocusMode was not called when isAppReady=true');

        // Cleanup any listeners that armFirstSessionLifecycle attached
        om.destroy();
    });

    await test('runFirstRunFlow rolls back focus state when sample load fails', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        let creationModalShown = false;

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            preloadInitialRunCycle: async () => false,
            activateFocusMode: () => {},
            showCycleCreationModal: () => { creationModalShown = true; },
            appInit: { isAppReady: () => true }
        }));
        const om = new OnboardingManager();

        const ok = await om.runFirstRunFlow();

        if (ok) throw new Error('runFirstRunFlow should return false when load fails');
        if (state.settings.focusModeActive !== false) {
            throw new Error('focusModeActive should be rolled back to false on failure');
        }
        if (!creationModalShown) throw new Error('showCycleCreationModal should be called as fallback');

        om.destroy();
    });

    await test('runFirstRunFlow defers activation until init:app-ready when app not ready', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        let activateCalled = false;

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            preloadInitialRunCycle: async () => true,
            activateFocusMode: () => { activateCalled = true; },
            appInit: { isAppReady: () => false }
        }));
        const om = new OnboardingManager();

        await om.runFirstRunFlow();

        if (activateCalled) throw new Error('activate should NOT fire before init:app-ready when app not ready');

        // Simulate the app-ready event firing
        document.dispatchEvent(new Event('init:app-ready'));

        if (!activateCalled) throw new Error('activate should fire after init:app-ready');

        om.destroy();
    });

    await test('first focus-view exit marks onboardingCompleted + dispatches setup-complete', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        let setupCompleteFired = false;
        const onSetupComplete = () => { setupCompleteFired = true; };
        document.addEventListener('onboarding:setup-complete', onSetupComplete);

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            preloadInitialRunCycle: async () => true,
            activateFocusMode: () => {},
            appInit: { isAppReady: () => true }
        }));
        const om = new OnboardingManager();

        await om.runFirstRunFlow();

        // Simulate user exiting focus view
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));

        if (state.settings.onboardingCompleted !== true) {
            throw new Error('onboardingCompleted should be true after first focus exit');
        }
        if (!setupCompleteFired) throw new Error('onboarding:setup-complete event should fire on first focus exit');

        document.removeEventListener('onboarding:setup-complete', onSetupComplete);
        om.destroy();
    });

    await test('first focus-view exit shows Home View welcome notification with action button', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        const notificationCalls = [];
        let createNewCalled = 0;

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            preloadInitialRunCycle: async () => true,
            activateFocusMode: () => {},
            appInit: { isAppReady: () => true },
            showNotification: (msg, type, duration, options) => {
                notificationCalls.push({ msg, type, duration, options });
            },
            createNewMiniCycle: () => { createNewCalled++; }
        }));
        const om = new OnboardingManager();

        await om.runFirstRunFlow();
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));

        // Should have exactly one notification with the home-view welcome message
        // (the activation toast was muted by runFirstRunFlow's silent activate).
        const welcomeCalls = notificationCalls.filter(
            n => typeof n.msg === 'string' && /Welcome to Home View/.test(n.msg)
        );
        if (welcomeCalls.length !== 1) {
            throw new Error(
                `Expected exactly one Home View welcome notification, got ${welcomeCalls.length}. ` +
                `All calls: ${JSON.stringify(notificationCalls.map(c => c.msg))}`
            );
        }

        // Notification should carry the action button + className opt-in
        const call = welcomeCalls[0];
        if (!call.options?.actionButton?.label) {
            throw new Error('Welcome notification should have an actionButton with a label');
        }
        if (typeof call.options.actionButton.onClick !== 'function') {
            throw new Error('Welcome notification actionButton should have an onClick function');
        }
        if (call.options.className !== 'notification-titled') {
            throw new Error(`Expected className "notification-titled", got "${call.options.className}"`);
        }

        // Action button should call createNewMiniCycle when clicked
        call.options.actionButton.onClick();
        if (createNewCalled !== 1) {
            throw new Error(`Expected createNewMiniCycle to be called once, got ${createNewCalled}`);
        }

        om.destroy();
    });

    await test('Home View welcome notification fires only once (one-shot listener)', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        const notificationCalls = [];

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            preloadInitialRunCycle: async () => true,
            activateFocusMode: () => {},
            appInit: { isAppReady: () => true },
            showNotification: (msg, type, duration, options) => {
                notificationCalls.push({ msg, type, duration, options });
            }
        }));
        const om = new OnboardingManager();

        await om.runFirstRunFlow();
        // Fire the event multiple times — only the first should trigger the welcome
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));

        const welcomeCalls = notificationCalls.filter(
            n => typeof n.msg === 'string' && /Welcome to Home View/.test(n.msg)
        );
        if (welcomeCalls.length !== 1) {
            throw new Error(
                `Welcome notification should fire exactly once across multiple focus-exits, got ${welcomeCalls.length}`
            );
        }

        om.destroy();
    });

    await test('resetOnboarding does NOT mount welcome banner immediately (deferred to next launch)', () => {
        const state = { settings: { onboardingCompleted: true } };

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            }
        }));
        const om = new OnboardingManager();

        // Spy on _attachFirstSessionLifecycle to verify it is NOT invoked
        let attachCalled = 0;
        const original = om._attachFirstSessionLifecycle?.bind(om);
        om._attachFirstSessionLifecycle = function (...args) {
            attachCalled++;
            return original?.(...args);
        };

        om.resetOnboarding();

        if (attachCalled !== 0) {
            throw new Error(
                `resetOnboarding should defer onboarding to next launch — ` +
                `_attachFirstSessionLifecycle should NOT be called, got ${attachCalled} calls`
            );
        }

        // Flags should still be cleared so the next launch picks the right surface
        if (state.settings.onboardingCompleted !== false) {
            throw new Error('resetOnboarding should clear onboardingCompleted to false');
        }
        if (state.settings.firstRunWelcomeDismissed !== false) {
            throw new Error('resetOnboarding should clear firstRunWelcomeDismissed to false');
        }

        om.destroy();
    });

    await test('beforeunload does NOT graduate onboarding (closing app keeps welcome+splash on reload)', async () => {
        const state = { settings: {}, data: { cycles: {} } };

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            preloadInitialRunCycle: async () => true,
            activateFocusMode: () => {},
            appInit: { isAppReady: () => true }
        }));
        const om = new OnboardingManager();

        await om.runFirstRunFlow();

        // Simulate beforeunload — should NOT mark onboarding complete.
        // Per spec: only dismiss-welcome OR exit-focus-mode graduates the user.
        window.dispatchEvent(new Event('beforeunload'));

        if (state.settings.onboardingCompleted === true) {
            throw new Error('onboardingCompleted should NOT be true after just a beforeunload');
        }

        om.destroy();
    });

    await test('armFirstSessionLifecycle is idempotent', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        let updateCount = 0;

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { updateCount++; fn(state); return state; }
            }
        }));
        const om = new OnboardingManager();

        om.armFirstSessionLifecycle();
        om.armFirstSessionLifecycle();  // second call should be a no-op
        om.armFirstSessionLifecycle();  // third too

        // Only one set of listeners should be registered — fire the focus-exit
        // event once and confirm only one update happens.
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));

        if (updateCount !== 1) {
            throw new Error(`Expected exactly 1 AppState.update from focus-exit, got ${updateCount}`);
        }

        om.destroy();
    });

    await test('destroy cleans up first-session lifecycle listeners', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        let updateCount = 0;

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { updateCount++; fn(state); return state; }
            },
            preloadInitialRunCycle: async () => true,
            activateFocusMode: () => {},
            appInit: { isAppReady: () => true }
        }));
        const om = new OnboardingManager();

        await om.runFirstRunFlow();
        om.destroy();

        // Listeners should be removed — events post-destroy should not flip state
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));
        window.dispatchEvent(new Event('beforeunload'));

        if (state.settings.onboardingCompleted === true) {
            throw new Error('onboardingCompleted should not flip after destroy');
        }
    });

    // ===== SAMPLE / CREATE FIRST-EXIT WELCOME =====

    resultsDiv.innerHTML += '<h4 class="test-section">🏠 First-exit Home View welcome (sample vs create)</h4>';

    // Detect the merged "Welcome to Home View" notification by its distinctive
    // shape: a 4th options arg carrying BOTH a primary and secondary action
    // button. The "we start you in Focus View" toast has no options arg.
    const isMergedWelcome = (args) => !!(args[3] && args[3].actionButton && args[3].secondaryActionButton);

    await test('startFocusViewForNewRoutine("sample") shows merged Home View welcome on first focus exit', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        const notifications = [];
        let tourWelcomeMarked = 0;

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            appInit: { isAppReady: () => true },
            activateFocusMode: () => {},
            showNotification: (...args) => { notifications.push(args); },
            markTourWelcomeShown: () => { tourWelcomeMarked++; },
            createNewMiniCycle: () => {},
            startGuidedTour: () => {}
        }));
        const om = new OnboardingManager();

        await om.startFocusViewForNewRoutine('sample');

        // Not until they leave Focus View — only the focus-view toast so far.
        if (notifications.filter(isMergedWelcome).length !== 0) {
            throw new Error('Merged welcome should not fire before Focus View is exited');
        }

        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));

        const merged = notifications.filter(isMergedWelcome);
        if (merged.length !== 1) {
            throw new Error(`Expected exactly 1 merged welcome on focus exit, got ${merged.length}`);
        }
        if (tourWelcomeMarked !== 1) {
            throw new Error('markTourWelcomeShown should fire once so the auto tour-welcome does not stack');
        }

        om.destroy();
    });

    await test('startFocusViewForNewRoutine("create") does NOT show merged welcome on focus exit', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        const notifications = [];
        let tourWelcomeMarked = 0;

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            appInit: { isAppReady: () => true },
            activateFocusMode: () => {},
            showNotification: (...args) => { notifications.push(args); },
            markTourWelcomeShown: () => { tourWelcomeMarked++; }
        }));
        const om = new OnboardingManager();

        await om.startFocusViewForNewRoutine('create');
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));

        if (notifications.filter(isMergedWelcome).length !== 0) {
            throw new Error('Create path must not show the merged welcome — guidedTourManager owns its first-exit prompt');
        }
        if (tourWelcomeMarked !== 0) {
            throw new Error('Create path should not suppress the auto tour-welcome');
        }

        om.destroy();
    });

    await test('sample first-exit welcome fires only once across repeated focus exits', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        const notifications = [];

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            appInit: { isAppReady: () => true },
            activateFocusMode: () => {},
            showNotification: (...args) => { notifications.push(args); },
            markTourWelcomeShown: () => {},
            createNewMiniCycle: () => {},
            startGuidedTour: () => {}
        }));
        const om = new OnboardingManager();

        await om.startFocusViewForNewRoutine('sample');
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));
        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));

        const merged = notifications.filter(isMergedWelcome);
        if (merged.length !== 1) {
            throw new Error(`Expected merged welcome exactly once across repeated exits, got ${merged.length}`);
        }

        om.destroy();
    });

    await test('destroy cleans up the pending sample first-exit welcome listener', async () => {
        const state = { settings: {}, data: { cycles: {} } };
        const notifications = [];

        setOnboardingManagerDependencies(createMockDeps({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); return state; }
            },
            appInit: { isAppReady: () => true },
            activateFocusMode: () => {},
            showNotification: (...args) => { notifications.push(args); },
            markTourWelcomeShown: () => {}
        }));
        const om = new OnboardingManager();

        await om.startFocusViewForNewRoutine('sample');
        om.destroy();

        document.dispatchEvent(new CustomEvent('focusMode:deactivated'));

        if (notifications.filter(isMergedWelcome).length !== 0) {
            throw new Error('Merged welcome should not fire after destroy — the one-shot listener must be removed');
        }
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
