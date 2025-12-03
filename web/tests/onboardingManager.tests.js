/**
 * OnboardingManager Browser Tests
 * Test functions for module-test-suite.html
 */

export function runOnboardingManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎓 OnboardingManager Tests</h2><h3>Running tests...</h3>';

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
        if (typeof window.OnboardingManager === 'undefined') {
            throw new Error('OnboardingManager class not found');
        }
    });

    test('creates instance successfully', () => {
        const om = new window.OnboardingManager();
        if (!om || typeof om.showOnboarding !== 'function') {
            throw new Error('OnboardingManager not properly initialized');
        }
    });

    test('has global instance', () => {
        if (!window.onboardingManager) {
            throw new Error('Global onboardingManager instance not found');
        }
        if (typeof window.onboardingManager.showOnboarding !== 'function') {
            throw new Error('Global instance missing methods');
        }
    });

    test('has version property', () => {
        const om = new window.OnboardingManager();
        if (!om.version) {
            throw new Error('Version property missing');
        }
        if (typeof om.version !== 'string') {
            throw new Error('Version should be a string');
        }
    });

    // ===== APPSTATE INTEGRATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">💾 AppState Integration</h4>';

    test('shouldShowOnboarding handles AppState not ready', () => {
        const om = new window.OnboardingManager();

        // Clear AppState
        delete window.AppState;

        // Should return false when AppState not ready
        const result = om.shouldShowOnboarding();
        if (result !== false) {
            throw new Error('Should return false when AppState not ready');
        }
    });

    test('shouldShowOnboarding reads from AppState', () => {
        const om = new window.OnboardingManager();

        // Mock AppState with onboarding not completed
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    onboardingCompleted: false
                }
            })
        };

        const result = om.shouldShowOnboarding();
        if (result !== true) {
            throw new Error('Should return true when onboarding not completed');
        }
    });

    test('shouldShowOnboarding returns false when already completed', () => {
        const om = new window.OnboardingManager();

        // Mock AppState with onboarding completed
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    onboardingCompleted: true
                }
            })
        };

        const result = om.shouldShowOnboarding();
        if (result !== false) {
            throw new Error('Should return false when onboarding completed');
        }
    });

    test('completeOnboarding updates AppState', () => {
        const om = new window.OnboardingManager();

        let updateCalled = false;
        const mockState = {
            settings: {
                onboardingCompleted: false
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

    test('resetOnboarding clears flag in AppState', () => {
        const om = new window.OnboardingManager();

        let updateCalled = false;
        const mockState = {
            settings: {
                onboardingCompleted: true
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

        // Mock showNotification
        window.showNotification = () => {};

        om.resetOnboarding();

        if (!updateCalled) {
            throw new Error('AppState.update not called');
        }
        if (mockState.settings.onboardingCompleted !== false) {
            throw new Error('onboardingCompleted not set to false');
        }
    });

    test('resetOnboarding handles AppState not ready', () => {
        const om = new window.OnboardingManager();

        // Clear AppState
        delete window.AppState;

        // Mock showNotification
        let notificationShown = false;
        window.showNotification = () => {
            notificationShown = true;
        };

        // Should not throw
        om.resetOnboarding();

        if (!notificationShown) {
            throw new Error('Should show error notification when AppState not ready');
        }
    });

    // ===== DOM MANIPULATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Manipulation</h4>';

    test('createOnboardingModal creates modal with correct structure', () => {
        const om = new window.OnboardingManager();

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

    test('createOnboardingModal applies theme correctly', () => {
        const om = new window.OnboardingManager();

        const modal = om.createOnboardingModal('ocean');

        const content = modal.querySelector('.onboarding-content');
        if (!content || !content.className.includes('theme-ocean')) {
            throw new Error('Theme not applied correctly');
        }

        // Cleanup
        modal.remove();
    });

    test('showOnboarding creates modal in DOM', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    theme: 'default',
                    onboardingCompleted: false
                }
            })
        };

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        if (!modal) {
            throw new Error('Modal not added to DOM');
        }

        // Cleanup
        modal.remove();
    });

    test('showOnboarding handles AppState not ready', () => {
        const om = new window.OnboardingManager();

        // Clear AppState
        delete window.AppState;

        // Should not throw
        om.showOnboarding({}, null);

        // Should not create modal
        const modal = document.getElementById('onboarding-modal');
        if (modal) {
            modal.remove();
            throw new Error('Should not create modal when AppState not ready');
        }
    });

    test('showOnboarding handles missing settings object', () => {
        const om = new window.OnboardingManager();

        // Mock AppState with no settings
        window.AppState = {
            isReady: () => true,
            get: () => ({
                // Missing settings
            })
        };

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

    test('modal contains 3 steps of content', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    theme: 'default',
                    onboardingCompleted: false
                }
            })
        };

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

    // ===== MODAL CONTROLS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎮 Modal Controls</h4>';

    test('next button advances to step 2', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    theme: 'default'
                }
            })
        };

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

    test('prev button goes back to step 1', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    theme: 'default'
                }
            })
        };

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

    test('prev button hidden on first step', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    theme: 'default'
                }
            })
        };

        om.showOnboarding({}, null);

        const modal = document.getElementById('onboarding-modal');
        const prevBtn = modal.querySelector('#onboarding-prev');

        if (!prevBtn.classList.contains('hidden')) {
            throw new Error('Prev button should be hidden on first step');
        }

        // Cleanup
        modal.remove();
    });

    test('next button shows "Start" on last step', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({
                settings: {
                    theme: 'default'
                }
            })
        };

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

    test('skip button completes onboarding', () => {
        const om = new window.OnboardingManager();

        let updateCalled = false;
        const mockState = {
            settings: {
                theme: 'default',
                onboardingCompleted: false
            }
        };

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => mockState,
            update: (updateFn) => {
                updateCalled = true;
                updateFn(mockState);
            }
        };

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

    test('clicking outside modal completes onboarding', () => {
        const om = new window.OnboardingManager();

        let updateCalled = false;
        const mockState = {
            settings: {
                theme: 'default',
                onboardingCompleted: false
            }
        };

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => mockState,
            update: (updateFn) => {
                updateCalled = true;
                updateFn(mockState);
            }
        };

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

    // ===== FLOW INTEGRATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Flow Integration</h4>';

    test('completeOnboarding calls showCycleCreationModal when no cycle', () => {
        const om = new window.OnboardingManager();

        let modalCalled = false;

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({ settings: {} }),
            update: (updateFn) => {
                updateFn({ settings: {} });
            }
        };

        // Mock showCycleCreationModal
        window.showCycleCreationModal = () => {
            modalCalled = true;
        };

        const modal = document.createElement('div');
        modal.id = 'onboarding-modal';

        // Complete with no active cycle
        om.completeOnboarding(modal, {}, null);

        // Wait for setTimeout
        setTimeout(() => {
            if (!modalCalled) {
                throw new Error('showCycleCreationModal should be called when no active cycle');
            }
        }, 400);
    });

    test('completeOnboarding calls completeInitialSetup when has cycle', () => {
        const om = new window.OnboardingManager();

        let setupCalled = false;

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({ settings: {} }),
            update: (updateFn) => {
                updateFn({ settings: {} });
            }
        };

        // Mock completeInitialSetup
        window.completeInitialSetup = () => {
            setupCalled = true;
        };

        const modal = document.createElement('div');
        modal.id = 'onboarding-modal';

        const cycles = { 'cycle1': { title: 'Test Cycle' } };

        // Complete with active cycle
        om.completeOnboarding(modal, cycles, 'cycle1');

        if (!setupCalled) {
            throw new Error('completeInitialSetup should be called when has active cycle');
        }
    });

    test('completeOnboarding removes modal from DOM', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({ settings: {} }),
            update: (updateFn) => {
                updateFn({ settings: {} });
            }
        };

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

    test('completeOnboarding handles missing dependencies gracefully', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({ settings: {} }),
            update: (updateFn) => {
                updateFn({ settings: {} });
            }
        };

        // No showCycleCreationModal or completeInitialSetup available
        delete window.showCycleCreationModal;
        delete window.completeInitialSetup;

        const modal = document.createElement('div');
        modal.id = 'onboarding-modal';

        // Should not throw
        om.completeOnboarding(modal, {}, null);
    });

    // ===== GLOBAL WRAPPERS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

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

    // ===== ERROR HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    test('handles null AppState gracefully', () => {
        const om = new window.OnboardingManager();

        window.AppState = null;

        // Should not throw
        om.shouldShowOnboarding();
        om.showOnboarding({}, null);
        om.resetOnboarding();
    });

    test('handles missing AppState.get gracefully', () => {
        const om = new window.OnboardingManager();

        window.AppState = {
            isReady: () => true
            // Missing get method
        };

        // Should not throw
        om.shouldShowOnboarding();
    });

    test('handles null cycles and activeCycle', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({ settings: {} }),
            update: (updateFn) => {
                updateFn({ settings: {} });
            }
        };

        const modal = document.createElement('div');

        // Should not throw
        om.completeOnboarding(modal, null, null);
        om.completeOnboarding(modal, undefined, undefined);
    });

    test('resetOnboarding handles missing showNotification', () => {
        const om = new window.OnboardingManager();

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({ settings: {} }),
            update: (updateFn) => {
                updateFn({ settings: {} });
            }
        };

        // Clear showNotification
        delete window.showNotification;

        // Should not throw
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
