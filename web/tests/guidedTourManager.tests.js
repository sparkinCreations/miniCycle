/**
 * GuidedTourManager Tests
 * Tests for modules/ui/guidedTourManager.js
 */

let GuidedTourModule;

function createRect(left, top, width, height) {
    return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON() {
            return this;
        }
    };
}

function assignRect(element, rect) {
    element.getBoundingClientRect = () => createRect(rect.left, rect.top, rect.width, rect.height);
    element.getClientRects = () => [element.getBoundingClientRect()];
    element.scrollIntoView = () => {};
    return element;
}

function createTarget(tagName, { id = null, className = '', rect }) {
    const element = document.createElement(tagName);
    if (id) element.id = id;
    if (className) element.className = className;
    assignRect(element, rect);
    document.body.appendChild(element);
    return element;
}

function wait(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runGuidedTourManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    GuidedTourModule = await import(`../modules/ui/guidedTourManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>GuidedTourManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    let mockState;
    let notifications;
    let modalOpen = false;

    function cleanupDom() {
        document.querySelectorAll(
            '.tour-overlay, .tour-spotlight, .tour-tooltip, ' +
            '#toggle-task-input-btn, #progressBar, #slide-right, #retake-guided-tour'
        ).forEach(el => el.remove());
        document.querySelectorAll('.task, .hamburger-menu').forEach(el => el.remove());
        document.documentElement.removeAttribute('data-tour-active');
    }

    function setupTargets({ withTask = true } = {}) {
        createTarget('button', {
            id: 'toggle-task-input-btn',
            rect: { left: 40, top: 100, width: 44, height: 44 }
        });

        if (withTask) {
            createTarget('div', {
                className: 'task',
                rect: { left: 48, top: 190, width: 280, height: 52 }
            });
        }

        createTarget('div', {
            id: 'progressBar',
            rect: { left: 48, top: 290, width: 280, height: 16 }
        });

        createTarget('button', {
            className: 'hamburger-menu',
            rect: { left: 320, top: 36, width: 42, height: 42 }
        });

        createTarget('div', {
            id: 'slide-right',
            rect: { left: 350, top: 340, width: 34, height: 56 }
        });
    }

    function createMockDeps(stateOverrides = {}) {
        mockState = {
            settings: {
                onboardingCompleted: true,
                guidedTourStep: null,
                ...stateOverrides.settings
            }
        };

        notifications = [];
        modalOpen = !!stateOverrides.modalOpen;

        return {
            appInit: {
                waitForCore: async () => {},
                isAppReady: () => !!stateOverrides.appReady
            },
            AppState: {
                isReady: () => true,
                get: () => mockState,
                update: async (updater) => {
                    updater(mockState);
                }
            },
            getElementById: (id) => document.getElementById(id),
            querySelector: (selector) => document.querySelector(selector),
            getBody: () => document.body,
            getRootElement: () => document.documentElement,
            getActiveElement: () => document.activeElement,
            showNotification: (message, type, duration, options = {}) => {
                notifications.push({ message, type, duration, options });
                return null;
            },
            safeAddEventListener: (element, event, handler, options) => {
                element?.removeEventListener?.(event, handler, options);
                element?.addEventListener?.(event, handler, options);
            },
            isModalOpen: () => modalOpen
        };
    }

    async function createManager(stateOverrides = {}) {
        GuidedTourModule._resetForTesting();
        GuidedTourModule.setGuidedTourManagerDependencies(createMockDeps(stateOverrides));
        return GuidedTourModule.initGuidedTourManager();
    }

    async function test(name, testFn) {
        total.count++;

        try {
            cleanupDom();
            GuidedTourModule._resetForTesting();
            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`GuidedTourManager test failed: ${name}`, error);
        } finally {
            cleanupDom();
            GuidedTourModule._resetForTesting();
        }
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Triggering</h4>';

    await test('init listens for app-ready for returning users', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        let scheduledDelay = null;
        manager._scheduleNotification = (delay) => {
            scheduledDelay = delay;
        };

        document.dispatchEvent(new Event('init:app-ready'));

        if (scheduledDelay !== 2000) {
            throw new Error(`Expected 2000ms delay, got ${scheduledDelay}`);
        }
    });

    await test('init listens for onboarding setup completion for first-run users', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: false, guidedTourStep: null }
        });

        let scheduledDelay = null;
        manager._scheduleNotification = (delay) => {
            scheduledDelay = delay;
        };

        document.dispatchEvent(new Event('onboarding:setup-complete'));

        if (scheduledDelay !== 9000) {
            throw new Error(`Expected 9000ms delay, got ${scheduledDelay}`);
        }
    });

    await test('_scheduleNotification shows welcome notification for new tours', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager._scheduleNotification(0);
        await wait();

        if (notifications.length !== 1) {
            throw new Error('Expected one welcome notification');
        }
        if (notifications[0].options?.actionButton?.label !== 'Take a Quick Tour') {
            throw new Error('Expected welcome CTA label');
        }
    });

    await test('_scheduleNotification shows resume notification for in-progress tours', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 2 }
        });

        manager._scheduleNotification(0);
        await wait();

        if (notifications.length !== 1) {
            throw new Error('Expected one resume notification');
        }
        if (notifications[0].options?.actionButton?.label !== 'Resume Tour') {
            throw new Error('Expected resume CTA label');
        }
    });

    await test('dismissing the welcome notification marks the tour done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager._showWelcomeNotification();
        await notifications[0].options.onDismiss();

        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error('Expected guidedTourStep to be marked done');
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">Tour Flow</h4>';

    await test('startTour creates overlay and persists step 0 for a fresh tour', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager.startTour();

        if (!document.querySelector('.tour-overlay')) {
            throw new Error('Expected overlay to be created');
        }
        if (mockState.settings.guidedTourStep !== 0) {
            throw new Error(`Expected guidedTourStep 0, got ${mockState.settings.guidedTourStep}`);
        }
        if (document.documentElement.getAttribute('data-tour-active') !== 'true') {
            throw new Error('Expected data-tour-active attribute');
        }
    });

    await test('startTour resumes from the persisted step', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 2 }
        });

        manager.startTour();

        if (manager._currentStepIndex !== 2) {
            throw new Error(`Expected current step 2, got ${manager._currentStepIndex}`);
        }
        if (!document.querySelector('.tour-message')?.textContent?.includes('Complete all tasks')) {
            throw new Error('Expected step 3 message to render');
        }
    });

    await test('showStep skips missing task rows and advances to the next available step', async () => {
        setupTargets({ withTask: false });
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager.startTour();
        manager.showStep(1);

        if (manager._currentStepIndex !== 2) {
            throw new Error(`Expected skip to step 2, got ${manager._currentStepIndex}`);
        }
    });

    await test('prevStep skips backwards over missing targets', async () => {
        setupTargets({ withTask: false });
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager.startTour();
        manager.showStep(2);
        manager.prevStep();

        if (manager._currentStepIndex !== 0) {
            throw new Error(`Expected previous valid step 0, got ${manager._currentStepIndex}`);
        }
    });

    await test('completeTour marks the tour done and removes tour UI', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 4 }
        });

        manager.startTour();
        manager.completeTour();

        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error('Expected tour to be marked done');
        }
        if (document.querySelector('.tour-overlay')) {
            throw new Error('Expected overlay to be removed');
        }
    });

    await test('completeTour shows a success notification', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 4 }
        });

        manager.startTour();
        notifications.length = 0;
        manager.completeTour();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'success') {
            throw new Error(`Expected success type, got ${notifications[0].type}`);
        }
    });

    await test('prevStep at step 0 does nothing', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager.startTour();
        if (manager._currentStepIndex !== 0) {
            throw new Error(`Expected step 0, got ${manager._currentStepIndex}`);
        }

        manager.prevStep();

        if (manager._currentStepIndex !== 0) {
            throw new Error(`Expected step to remain 0, got ${manager._currentStepIndex}`);
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">Guards & Cleanup</h4>';

    await test('startTour bails when a modal is open and reschedules the prompt', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            modalOpen: true,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        const started = manager.startTour();

        if (started !== false) {
            throw new Error('Expected startTour to bail out');
        }
        if (notifications[0]?.message !== 'Close the open dialog to start the tour') {
            throw new Error('Expected close-dialog hint notification');
        }
        if (!manager._scheduleTimeout) {
            throw new Error('Expected prompt reschedule timeout');
        }
        clearTimeout(manager._scheduleTimeout);
        manager._scheduleTimeout = null;
    });

    await test('startTour clears a pending schedule timeout', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        // Simulate a pending scheduled notification
        manager._scheduleNotification(60000);
        const pendingTimeout = manager._scheduleTimeout;
        if (!pendingTimeout) {
            throw new Error('Expected a pending schedule timeout');
        }

        manager.startTour();

        if (manager._scheduleTimeout !== null) {
            throw new Error('Expected schedule timeout to be cleared after startTour');
        }
    });

    await test('destroy removes active tour elements and clears the active attribute', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager.startTour();
        manager.destroy();

        if (document.querySelector('.tour-overlay')) {
            throw new Error('Expected overlay removal on destroy');
        }
        if (document.documentElement.hasAttribute('data-tour-active')) {
            throw new Error('Expected data-tour-active to be cleared');
        }
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
