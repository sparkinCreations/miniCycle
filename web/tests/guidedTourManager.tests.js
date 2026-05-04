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
    // Pull constants from the live source so the test tracks future tweaks
    // (e.g., TOUR_FIRST_RUN_DELAY was bumped from 10s → 17s — assert against
    // the constant, not a literal).
    const { UI_TIMEOUTS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>GuidedTourManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    let mockState;
    let notifications;
    let modalOpen = false;

    function cleanupDom() {
        document.querySelectorAll(
            '.tour-overlay, .tour-spotlight, .tour-tooltip, ' +
            '#quick-actions-btn, #progressBar, #mode-selector, ' +
            '#help-window, #quick-actions-window, #personalization-btn, ' +
            '#quick-dark-toggle, #slide-right, #retake-guided-tour, ' +
            '#current-routine-status, #history-btn, ' +
            '#preferences-modal, #preferences-preview, #pref-section-quick-themes, ' +
            '#preferences-reset-all, ' +
            '#task-options-customizer-modal, #option-preview-content, #reset-task-options-btn, ' +
            '#reminders-modal, #enableReminders, #dueDatesReminders, #browserNotifications, #frequency-section, ' +
            '#recurring-panel-overlay, #settings-modal, #routine-switcher-modal'
        ).forEach(el => el.remove());
        document.querySelectorAll('.task, .hamburger-menu, .badge-container, .global-stats-container, .preferences-section-header').forEach(el => el.remove());
        document.documentElement.removeAttribute('data-tour-active');
    }

    function setupTargets({ withTask = true, withHelpWindow = true, withQuickActionsWindow = true } = {}) {
        createTarget('button', {
            id: 'quick-actions-btn',
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

        createTarget('select', {
            id: 'mode-selector',
            rect: { left: 200, top: 60, width: 160, height: 36 }
        });

        if (withHelpWindow) {
            createTarget('div', {
                id: 'help-window',
                rect: { left: 700, top: 200, width: 200, height: 120 }
            });
        }

        if (withQuickActionsWindow) {
            createTarget('div', {
                id: 'quick-actions-window',
                rect: { left: 20, top: 200, width: 200, height: 120 }
            });
        }

        createTarget('button', {
            id: 'personalization-btn',
            rect: { left: 10, top: 700, width: 50, height: 50 }
        });

        createTarget('button', {
            id: 'quick-dark-toggle',
            rect: { left: 1200, top: 700, width: 50, height: 50 }
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
            },
            userProgress: {
                cyclesCompleted: 0,
                ...stateOverrides.userProgress
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

        if (scheduledDelay !== UI_TIMEOUTS.TOUR_FIRST_RUN_DELAY) {
            throw new Error(`Expected ${UI_TIMEOUTS.TOUR_FIRST_RUN_DELAY}ms delay (TOUR_FIRST_RUN_DELAY), got ${scheduledDelay}`);
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

        // Filter: setupTargets() omits focus-mode-btn (step 1 of original 5) and
        // routine-switcher-btn (step 4), so _filteredSteps = [mode-selector,
        // help-window, personalization-btn]. Persisted step 2 = personalization-btn.
        if (manager._currentStepIndex !== 2) {
            throw new Error(`Expected current step 2, got ${manager._currentStepIndex}`);
        }
        // Substring is the durable part of tour.step4 — survives copy tweaks like
        // "Customize your colors..." → "Customize colors, backgrounds, and themes here..."
        if (!document.querySelector('.tour-message')?.textContent?.includes('Customize colors')) {
            throw new Error('Expected personalization step message to render');
        }
    });

    await test('startTour filters out steps with missing targets', async () => {
        // setupTargets() omits focus-mode-btn and routine-switcher-btn from main tour
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager.startTour();

        // Original main tour has 5 steps; filter should remove the 2 missing ones
        if (manager._steps.length !== 3) {
            throw new Error(`Expected 3 filtered steps, got ${manager._steps.length}`);
        }
    });

    await test('startTour skips entirely when no steps have valid targets', async () => {
        // No targets at all — every main-tour step should filter out
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        const started = manager.startTour();

        if (started !== false) {
            throw new Error('startTour should return false when no steps are available');
        }
        if (manager._active) {
            throw new Error('manager should not be active after empty-filter early return');
        }
    });

    await test('startTour shrinks step count further when help window is hidden', async () => {
        setupTargets({ withHelpWindow: false });
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager.startTour();

        // Without help-window, filtered = [mode-selector, personalization-btn]
        if (manager._steps.length !== 2) {
            throw new Error(`Expected 2 filtered steps, got ${manager._steps.length}`);
        }
    });

    await test('prevStep walks back through filtered steps', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        // Filtered steps: [mode-selector (0), help-window (1), personalization-btn (2)]
        manager.startTour();
        manager.showStep(2);
        manager.prevStep();

        // After filter, prevStep is a simple decrement — every filtered step
        // already has a valid target.
        if (manager._currentStepIndex !== 1) {
            throw new Error(`Expected previous step 1, got ${manager._currentStepIndex}`);
        }
    });

    await test('completeTour marks the tour done and removes tour UI', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 9 }
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
            settings: { onboardingCompleted: true, guidedTourStep: 9 }
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

    // ---- Stats Tour Tests ----

    function setupStatsPanelTargets({ withHistoryBtn = true } = {}) {
        createTarget('div', {
            id: 'current-routine-status',
            rect: { left: 50, top: 100, width: 300, height: 200 }
        });

        if (withHistoryBtn) {
            createTarget('button', {
                id: 'history-btn',
                rect: { left: 50, top: 320, width: 120, height: 36 }
            });
        }

        createTarget('div', {
            className: 'badge-container',
            rect: { left: 50, top: 380, width: 300, height: 80 }
        });

        createTarget('div', {
            className: 'global-stats-container',
            rect: { left: 50, top: 480, width: 300, height: 100 }
        });
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Stats Tour</h4>';

    await test('showStatsTourNotification shows notification when statsTourStep is null', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', statsTourStep: null },
            userProgress: { cyclesCompleted: 1 }
        });

        notifications.length = 0;
        manager.showStatsTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'info') {
            throw new Error(`Expected info type, got ${notifications[0].type}`);
        }
        if (!notifications[0].options?.actionButton?.label?.includes('Stats Tour')) {
            throw new Error('Expected stats tour CTA label');
        }
    });

    await test('showStatsTourNotification is a no-op when statsTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', statsTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showStatsTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('stats tour completion sets statsTourStep to done without affecting guidedTourStep', async () => {
        setupStatsPanelTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', statsTourStep: null }
        });

        manager.startTour('stats');
        manager.completeTour();

        if (mockState.settings.statsTourStep !== 'done') {
            throw new Error(`Expected statsTourStep to be done, got ${mockState.settings.statsTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }
    });

    await test('startTour with no args still runs the main tour', async () => {
        setupTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: null }
        });

        manager.startTour();

        // Main tour step 0 targets quick-actions-btn
        if (mockState.settings.guidedTourStep !== 0) {
            throw new Error(`Expected guidedTourStep 0, got ${mockState.settings.guidedTourStep}`);
        }
    });

    await test('stats tour filters out missing history button', async () => {
        setupStatsPanelTargets({ withHistoryBtn: false });
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', statsTourStep: null }
        });

        manager.startTour('stats');

        // Original stats tour has 4 steps; with history-btn missing the filter
        // should drop it to 3.
        if (manager._steps.length !== 3) {
            throw new Error(`Expected 3 filtered steps, got ${manager._steps.length}`);
        }
    });

    await test('dismissing stats tour notification marks statsTourStep as done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', statsTourStep: null },
            userProgress: { cyclesCompleted: 1 }
        });

        manager.showStatsTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.statsTourStep !== 'done') {
            throw new Error(`Expected statsTourStep done, got ${mockState.settings.statsTourStep}`);
        }
    });

    // ---- Personalization Tour Tests ----

    function setupPreferencesModalTargets() {
        // Create a dialog element to act as the container
        const dialog = document.createElement('dialog');
        dialog.id = 'preferences-modal';
        dialog.className = 'preferences-modal';
        document.body.appendChild(dialog);

        // Create targets inside the dialog
        const preview = document.createElement('div');
        preview.id = 'preferences-preview';
        assignRect(preview, { left: 50, top: 80, width: 400, height: 200 });
        dialog.appendChild(preview);

        const presetsGrid = document.createElement('div');
        presetsGrid.id = 'pref-section-quick-themes';
        assignRect(presetsGrid, { left: 50, top: 300, width: 400, height: 120 });
        dialog.appendChild(presetsGrid);

        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'preferences-section-header collapsible';
        assignRect(sectionHeader, { left: 50, top: 440, width: 400, height: 40 });
        dialog.appendChild(sectionHeader);

        const resetBtn = document.createElement('button');
        resetBtn.id = 'preferences-reset-all';
        assignRect(resetBtn, { left: 50, top: 600, width: 120, height: 36 });
        dialog.appendChild(resetBtn);

        return dialog;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Personalization Tour</h4>';

    await test('showPersonalizationTourNotification shows notification when prefsTourStep is null', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', prefsTourStep: null }
        });

        notifications.length = 0;
        manager.showPersonalizationTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'info') {
            throw new Error(`Expected info notification, got ${notifications[0].type}`);
        }
        if (!notifications[0].options?.actionButton?.label) {
            throw new Error('Expected personalization tour CTA label');
        }
    });

    await test('showPersonalizationTourNotification is a no-op when prefsTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', prefsTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showPersonalizationTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('personalization notification dismiss marks tour as done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', prefsTourStep: null }
        });

        notifications.length = 0;
        manager.showPersonalizationTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.prefsTourStep !== 'done') {
            throw new Error(`Expected prefsTourStep done, got ${mockState.settings.prefsTourStep}`);
        }
    });

    await test('personalization tour appends elements inside the dialog container', async () => {
        const dialog = setupPreferencesModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', prefsTourStep: null }
        });

        manager.startTour('personalization');

        const overlayInDialog = dialog.querySelector('.tour-overlay');
        const overlayInBody = document.body.querySelector(':scope > .tour-overlay');

        if (!overlayInDialog) {
            throw new Error('Expected tour overlay inside the dialog');
        }
        if (overlayInBody) {
            throw new Error('Tour overlay should NOT be a direct child of body');
        }

        dialog.remove();
    });

    await test('personalization tour completion sets prefsTourStep to done', async () => {
        const dialog = setupPreferencesModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', prefsTourStep: null }
        });

        manager.startTour('personalization');
        manager.completeTour();

        if (mockState.settings.prefsTourStep !== 'done') {
            throw new Error(`Expected prefsTourStep done, got ${mockState.settings.prefsTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }

        dialog.remove();
    });

    // ---- Task Options Tour Tests ----

    function setupTaskOptionsModalTargets() {
        const dialog = document.createElement('dialog');
        dialog.id = 'task-options-customizer-modal';
        document.body.appendChild(dialog);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        dialog.appendChild(modalBody);

        const container = document.createElement('div');
        container.className = 'task-options-container';
        modalBody.appendChild(container);

        const optionsList = document.createElement('div');
        optionsList.className = 'task-options-list';
        assignRect(optionsList, { left: 50, top: 80, width: 300, height: 280 });
        container.appendChild(optionsList);

        const previewContent = document.createElement('div');
        previewContent.id = 'option-preview-content';
        assignRect(previewContent, { left: 370, top: 80, width: 200, height: 200 });
        container.appendChild(previewContent);

        // Two sections: first is "This Routine", last is "Global"
        const section1 = document.createElement('div');
        section1.className = 'options-section';
        container.appendChild(section1);

        const section2 = document.createElement('div');
        section2.className = 'options-section';
        assignRect(section2, { left: 50, top: 380, width: 300, height: 120 });
        container.appendChild(section2);

        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-task-options-btn';
        assignRect(resetBtn, { left: 50, top: 520, width: 140, height: 36 });
        dialog.appendChild(resetBtn);

        return dialog;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Task Options Tour</h4>';

    await test('showTaskOptionsTourNotification shows notification when taskOptionsTourStep is null', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', taskOptionsTourStep: null }
        });

        // Create dialog so container resolution works
        const dialog = document.createElement('dialog');
        dialog.id = 'task-options-customizer-modal';
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        dialog.appendChild(modalBody);
        document.body.appendChild(dialog);

        notifications.length = 0;
        manager.showTaskOptionsTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'info') {
            throw new Error(`Expected info notification, got ${notifications[0].type}`);
        }
        if (!notifications[0].options?.actionButton?.label) {
            throw new Error('Expected task options tour CTA label');
        }

        dialog.remove();
    });

    await test('showTaskOptionsTourNotification is a no-op when taskOptionsTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', taskOptionsTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showTaskOptionsTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('task options notification dismiss marks tour as done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', taskOptionsTourStep: null }
        });

        // Create dialog so container resolution works
        const dialog = document.createElement('dialog');
        dialog.id = 'task-options-customizer-modal';
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        dialog.appendChild(modalBody);
        document.body.appendChild(dialog);

        notifications.length = 0;
        manager.showTaskOptionsTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.taskOptionsTourStep !== 'done') {
            throw new Error(`Expected taskOptionsTourStep done, got ${mockState.settings.taskOptionsTourStep}`);
        }

        dialog.remove();
    });

    await test('task options tour appends elements inside the dialog container', async () => {
        const dialog = setupTaskOptionsModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', taskOptionsTourStep: null }
        });

        manager.startTour('taskOptions');

        const overlayInDialog = dialog.querySelector('.tour-overlay');
        const overlayInBody = document.body.querySelector(':scope > .tour-overlay');

        if (!overlayInDialog) {
            throw new Error('Expected tour overlay inside the dialog');
        }
        if (overlayInBody) {
            throw new Error('Tour overlay should NOT be a direct child of body');
        }

        dialog.remove();
    });

    await test('task options tour completion sets taskOptionsTourStep to done', async () => {
        const dialog = setupTaskOptionsModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', taskOptionsTourStep: null }
        });

        manager.startTour('taskOptions');
        manager.completeTour();

        if (mockState.settings.taskOptionsTourStep !== 'done') {
            throw new Error(`Expected taskOptionsTourStep done, got ${mockState.settings.taskOptionsTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }

        dialog.remove();
    });

    // ---- Reminders Tour Tests ----

    function setupRemindersModalTargets() {
        const dialog = document.createElement('dialog');
        dialog.id = 'reminders-modal';
        document.body.appendChild(dialog);

        const content = document.createElement('div');
        content.className = 'reminders-modal-content';
        dialog.appendChild(content);

        const enableReminders = document.createElement('input');
        enableReminders.type = 'checkbox';
        enableReminders.id = 'enableReminders';
        assignRect(enableReminders, { left: 50, top: 100, width: 20, height: 20 });
        content.appendChild(enableReminders);

        const dueDates = document.createElement('input');
        dueDates.type = 'checkbox';
        dueDates.id = 'dueDatesReminders';
        assignRect(dueDates, { left: 50, top: 160, width: 20, height: 20 });
        content.appendChild(dueDates);

        const browserNotif = document.createElement('input');
        browserNotif.type = 'checkbox';
        browserNotif.id = 'browserNotifications';
        assignRect(browserNotif, { left: 50, top: 220, width: 20, height: 20 });
        content.appendChild(browserNotif);

        const frequencySection = document.createElement('div');
        frequencySection.id = 'frequency-section';
        assignRect(frequencySection, { left: 50, top: 280, width: 400, height: 120 });
        content.appendChild(frequencySection);

        return dialog;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Reminders Tour</h4>';

    await test('showRemindersTourNotification shows notification when remindersTourStep is null', async () => {
        const dialog = setupRemindersModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', remindersTourStep: null }
        });

        notifications.length = 0;
        manager.showRemindersTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'info') {
            throw new Error(`Expected info notification, got ${notifications[0].type}`);
        }
        if (!notifications[0].options?.actionButton?.label) {
            throw new Error('Expected reminders tour CTA label');
        }

        dialog.remove();
    });

    await test('showRemindersTourNotification is a no-op when remindersTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', remindersTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showRemindersTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('reminders notification dismiss marks tour as done', async () => {
        const dialog = setupRemindersModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', remindersTourStep: null }
        });

        notifications.length = 0;
        manager.showRemindersTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.remindersTourStep !== 'done') {
            throw new Error(`Expected remindersTourStep done, got ${mockState.settings.remindersTourStep}`);
        }

        dialog.remove();
    });

    await test('reminders tour appends elements inside the dialog container', async () => {
        const dialog = setupRemindersModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', remindersTourStep: null }
        });

        manager.startTour('reminders');

        const overlayInDialog = dialog.querySelector('.tour-overlay');
        const overlayInBody = document.body.querySelector(':scope > .tour-overlay');

        if (!overlayInDialog) {
            throw new Error('Expected tour overlay inside the dialog');
        }
        if (overlayInBody) {
            throw new Error('Tour overlay should NOT be a direct child of body');
        }

        dialog.remove();
    });

    await test('reminders tour completion sets remindersTourStep to done', async () => {
        const dialog = setupRemindersModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', remindersTourStep: null }
        });

        manager.startTour('reminders');
        manager.completeTour();

        if (mockState.settings.remindersTourStep !== 'done') {
            throw new Error(`Expected remindersTourStep done, got ${mockState.settings.remindersTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }

        dialog.remove();
    });

    // ---- Menu Tour Tests ----

    function setupMenuTargets() {
        const sections = ['routines', 'tasks', 'rewards', 'app'];
        const elements = [];
        sections.forEach((name, i) => {
            const section = document.createElement('div');
            section.className = 'menu-section';
            section.setAttribute('data-section', name);
            assignRect(section, { left: 50, top: 100 + i * 80, width: 300, height: 60 });
            document.body.appendChild(section);
            elements.push(section);
        });
        return elements;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Menu Tour</h4>';

    await test('showMenuTourNotification shows notification when menuTourStep is null', async () => {
        const elements = setupMenuTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', menuTourStep: null }
        });

        notifications.length = 0;
        manager.showMenuTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (!notifications[0].options?.actionButton) {
            throw new Error('Expected notification to have an actionButton');
        }

        elements.forEach(el => el.remove());
    });

    await test('showMenuTourNotification is a no-op when menuTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', menuTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showMenuTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('showMenuTourNotification dismiss marks menuTourStep as done', async () => {
        const elements = setupMenuTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', menuTourStep: null }
        });

        notifications.length = 0;
        manager.showMenuTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.menuTourStep !== 'done') {
            throw new Error(`Expected menuTourStep done, got ${mockState.settings.menuTourStep}`);
        }

        elements.forEach(el => el.remove());
    });

    await test('showMenuTourNotification does not pass container option (global notification)', async () => {
        const elements = setupMenuTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', menuTourStep: null }
        });

        notifications.length = 0;
        manager.showMenuTourNotification();

        if (notifications[0].options?.container) {
            throw new Error('Menu tour should not pass container option (not a dialog)');
        }

        elements.forEach(el => el.remove());
    });

    await test('menu tour completion sets menuTourStep to done', async () => {
        const elements = setupMenuTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', menuTourStep: null }
        });

        manager.startTour('menu');
        manager.completeTour();

        if (mockState.settings.menuTourStep !== 'done') {
            throw new Error(`Expected menuTourStep done, got ${mockState.settings.menuTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }

        elements.forEach(el => el.remove());
    });

    // ---- Settings Tour Tests ----

    function setupSettingsModalTargets() {
        const dialog = document.createElement('dialog');
        dialog.id = 'settings-modal';
        dialog.className = 'settings-modal';
        assignRect(dialog, { left: 100, top: 50, width: 500, height: 600 });
        document.body.appendChild(dialog);

        const content = document.createElement('div');
        content.className = 'settings-modal-content';
        dialog.appendChild(content);

        const sectionNames = ['display', 'accessibility', 'behavior', 'data', 'reset', 'advanced'];
        sectionNames.forEach((name, i) => {
            // Outer section div (visible even when collapsed) — tour targets this
            const section = document.createElement('div');
            section.className = 'settings-section collapsible';
            section.setAttribute('data-section', name);
            assignRect(section, { left: 110, top: 100 + i * 80, width: 480, height: 60 });
            content.appendChild(section);
        });

        return dialog;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Settings Tour</h4>';

    await test('showSettingsTourNotification shows notification when settingsTourStep is null', async () => {
        const dialog = setupSettingsModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', settingsTourStep: null }
        });

        notifications.length = 0;
        manager.showSettingsTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'info') {
            throw new Error(`Expected info notification, got ${notifications[0].type}`);
        }
        if (!notifications[0].options?.actionButton?.label) {
            throw new Error('Expected settings tour CTA label');
        }

        dialog.remove();
    });

    await test('showSettingsTourNotification is a no-op when settingsTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', settingsTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showSettingsTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('settings notification dismiss marks tour as done', async () => {
        const dialog = setupSettingsModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', settingsTourStep: null }
        });

        notifications.length = 0;
        manager.showSettingsTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.settingsTourStep !== 'done') {
            throw new Error(`Expected settingsTourStep done, got ${mockState.settings.settingsTourStep}`);
        }

        dialog.remove();
    });

    await test('settings tour appends elements inside the dialog container', async () => {
        const dialog = setupSettingsModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', settingsTourStep: null }
        });

        manager.startTour('settings');

        const overlayInDialog = dialog.querySelector('.tour-overlay');
        const overlayInBody = document.body.querySelector(':scope > .tour-overlay');

        if (!overlayInDialog) {
            throw new Error('Expected tour overlay inside the dialog');
        }
        if (overlayInBody) {
            throw new Error('Tour overlay should NOT be a direct child of body');
        }

        dialog.remove();
    });

    await test('settings tour completion sets settingsTourStep to done', async () => {
        const dialog = setupSettingsModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', settingsTourStep: null }
        });

        manager.startTour('settings');
        manager.completeTour();

        if (mockState.settings.settingsTourStep !== 'done') {
            throw new Error(`Expected settingsTourStep done, got ${mockState.settings.settingsTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }

        dialog.remove();
    });

    // ---- Routine Switcher Tour Tests ----

    function setupRoutineSwitcherModalTargets() {
        const dialog = document.createElement('dialog');
        dialog.id = 'routine-switcher-modal';
        assignRect(dialog, { left: 50, top: 50, width: 600, height: 500 });
        document.body.appendChild(dialog);

        const content = document.createElement('div');
        content.className = 'mini-cycle-switch-modal-content';
        dialog.appendChild(content);

        const searchInput = document.createElement('input');
        searchInput.id = 'routine-search-input';
        assignRect(searchInput, { left: 60, top: 70, width: 500, height: 30 });
        content.appendChild(searchInput);

        const list = document.createElement('ul');
        list.id = 'miniCycleList';
        assignRect(list, { left: 60, top: 110, width: 300, height: 300 });
        content.appendChild(list);

        const actionRow = document.createElement('div');
        actionRow.id = 'switch-items-row';
        assignRect(actionRow, { left: 60, top: 420, width: 500, height: 40 });
        content.appendChild(actionRow);

        const confirmBtn = document.createElement('button');
        confirmBtn.id = 'miniCycleSwitchConfirm';
        assignRect(confirmBtn, { left: 400, top: 470, width: 100, height: 30 });
        content.appendChild(confirmBtn);

        return dialog;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Routine Switcher Tour</h4>';

    await test('showRoutineSwitcherTourNotification shows notification when routineSwitcherTourStep is null', async () => {
        const dialog = setupRoutineSwitcherModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', routineSwitcherTourStep: null }
        });

        notifications.length = 0;
        manager.showRoutineSwitcherTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'info') {
            throw new Error(`Expected info notification, got ${notifications[0].type}`);
        }
        if (!notifications[0].options?.actionButton?.label) {
            throw new Error('Expected routine switcher tour CTA label');
        }

        dialog.remove();
    });

    await test('showRoutineSwitcherTourNotification is a no-op when routineSwitcherTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', routineSwitcherTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showRoutineSwitcherTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('routine switcher notification dismiss marks tour as done', async () => {
        const dialog = setupRoutineSwitcherModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', routineSwitcherTourStep: null }
        });

        notifications.length = 0;
        manager.showRoutineSwitcherTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.routineSwitcherTourStep !== 'done') {
            throw new Error(`Expected routineSwitcherTourStep done, got ${mockState.settings.routineSwitcherTourStep}`);
        }

        dialog.remove();
    });

    await test('routine switcher tour appends elements inside the dialog container', async () => {
        const dialog = setupRoutineSwitcherModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', routineSwitcherTourStep: null }
        });

        manager.startTour('routineSwitcher');

        const overlayInDialog = dialog.querySelector('.tour-overlay');
        const overlayInBody = document.body.querySelector(':scope > .tour-overlay');

        if (!overlayInDialog) {
            throw new Error('Expected tour overlay inside the dialog');
        }
        if (overlayInBody) {
            throw new Error('Tour overlay should NOT be a direct child of body');
        }

        dialog.remove();
    });

    await test('routine switcher tour completion sets routineSwitcherTourStep to done', async () => {
        const dialog = setupRoutineSwitcherModalTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', routineSwitcherTourStep: null }
        });

        manager.startTour('routineSwitcher');
        manager.completeTour();

        if (mockState.settings.routineSwitcherTourStep !== 'done') {
            throw new Error(`Expected routineSwitcherTourStep done, got ${mockState.settings.routineSwitcherTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }

        dialog.remove();
    });

    // ---- Recurring List Tour Tests ----

    function setupRecurringPanelTargets() {
        const overlay = document.createElement('dialog');
        overlay.id = 'recurring-panel-overlay';
        assignRect(overlay, { left: 0, top: 0, width: 400, height: 700 });
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.id = 'recurring-panel';
        assignRect(panel, { left: 0, top: 0, width: 400, height: 700 });
        overlay.appendChild(panel);

        const taskList = document.createElement('ul');
        taskList.id = 'recurring-task-list';
        assignRect(taskList, { left: 10, top: 60, width: 380, height: 400 });
        panel.appendChild(taskList);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'recurring-remove-btn';
        assignRect(removeBtn, { left: 350, top: 80, width: 30, height: 30 });
        taskList.appendChild(removeBtn);

        const addBtn = document.createElement('button');
        addBtn.id = 'add-recurring-task-btn';
        assignRect(addBtn, { left: 10, top: 480, width: 380, height: 40 });
        panel.appendChild(addBtn);

        return overlay;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Recurring List Tour</h4>';

    await test('showRecurringListTourNotification shows notification when recurringListTourStep is null', async () => {
        const dialog = setupRecurringPanelTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringListTourStep: null }
        });

        notifications.length = 0;
        manager.showRecurringListTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'info') {
            throw new Error(`Expected info notification, got ${notifications[0].type}`);
        }
        if (!notifications[0].options?.actionButton?.label) {
            throw new Error('Expected recurring list tour CTA label');
        }

        dialog.remove();
    });

    await test('showRecurringListTourNotification is a no-op when recurringListTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringListTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showRecurringListTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('recurring list notification dismiss marks tour as done', async () => {
        const dialog = setupRecurringPanelTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringListTourStep: null }
        });

        notifications.length = 0;
        manager.showRecurringListTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.recurringListTourStep !== 'done') {
            throw new Error(`Expected recurringListTourStep done, got ${mockState.settings.recurringListTourStep}`);
        }

        dialog.remove();
    });

    await test('recurring list tour appends elements inside the dialog container', async () => {
        const dialog = setupRecurringPanelTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringListTourStep: null }
        });

        manager.startTour('recurringList');

        const overlayInDialog = dialog.querySelector('.tour-overlay');
        const overlayInBody = document.body.querySelector(':scope > .tour-overlay');

        if (!overlayInDialog) {
            throw new Error('Expected tour overlay inside the dialog');
        }
        if (overlayInBody) {
            throw new Error('Tour overlay should NOT be a direct child of body');
        }

        dialog.remove();
    });

    await test('recurring list tour completion sets recurringListTourStep to done', async () => {
        const dialog = setupRecurringPanelTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringListTourStep: null }
        });

        manager.startTour('recurringList');
        manager.completeTour();

        if (mockState.settings.recurringListTourStep !== 'done') {
            throw new Error(`Expected recurringListTourStep done, got ${mockState.settings.recurringListTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }

        dialog.remove();
    });

    // ---- Recurring Settings Tour Tests ----

    function setupRecurringSettingsTargets() {
        const overlay = document.createElement('dialog');
        overlay.id = 'recurring-panel-overlay';
        assignRect(overlay, { left: 0, top: 0, width: 400, height: 700 });
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.id = 'recurring-panel';
        assignRect(panel, { left: 0, top: 0, width: 400, height: 700 });
        overlay.appendChild(panel);

        const taskList = document.createElement('ul');
        taskList.id = 'recurring-task-list';
        assignRect(taskList, { left: 10, top: 60, width: 380, height: 200 });
        panel.appendChild(taskList);

        const summaryPreview = document.createElement('div');
        summaryPreview.id = 'recurring-summary-preview';
        assignRect(summaryPreview, { left: 10, top: 270, width: 380, height: 60 });
        panel.appendChild(summaryPreview);

        const frequencySelect = document.createElement('select');
        frequencySelect.id = 'recur-frequency';
        assignRect(frequencySelect, { left: 10, top: 340, width: 380, height: 40 });
        panel.appendChild(frequencySelect);

        const advancedToggle = document.createElement('button');
        advancedToggle.id = 'toggle-advanced-settings';
        assignRect(advancedToggle, { left: 10, top: 400, width: 380, height: 40 });
        panel.appendChild(advancedToggle);

        const applyBtn = document.createElement('button');
        applyBtn.id = 'apply-recurring-settings';
        assignRect(applyBtn, { left: 10, top: 600, width: 380, height: 40 });
        panel.appendChild(applyBtn);

        return overlay;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">Recurring Settings Tour</h4>';

    await test('showRecurringSettingsTourNotification shows notification when recurringSettingsTourStep is null', async () => {
        const dialog = setupRecurringSettingsTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringSettingsTourStep: null }
        });

        notifications.length = 0;
        manager.showRecurringSettingsTourNotification();

        if (notifications.length !== 1) {
            throw new Error(`Expected 1 notification, got ${notifications.length}`);
        }
        if (notifications[0].type !== 'info') {
            throw new Error(`Expected info notification, got ${notifications[0].type}`);
        }
        if (!notifications[0].options?.actionButton?.label) {
            throw new Error('Expected recurring settings tour CTA label');
        }

        dialog.remove();
    });

    await test('showRecurringSettingsTourNotification is a no-op when recurringSettingsTourStep is done', async () => {
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringSettingsTourStep: 'done' }
        });

        notifications.length = 0;
        manager.showRecurringSettingsTourNotification();

        if (notifications.length !== 0) {
            throw new Error(`Expected 0 notifications, got ${notifications.length}`);
        }
    });

    await test('recurring settings notification dismiss marks tour as done', async () => {
        const dialog = setupRecurringSettingsTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringSettingsTourStep: null }
        });

        notifications.length = 0;
        manager.showRecurringSettingsTourNotification();
        notifications[0].options.onDismiss();

        if (mockState.settings.recurringSettingsTourStep !== 'done') {
            throw new Error(`Expected recurringSettingsTourStep done, got ${mockState.settings.recurringSettingsTourStep}`);
        }

        dialog.remove();
    });

    await test('recurring settings tour appends elements inside the dialog container', async () => {
        const dialog = setupRecurringSettingsTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringSettingsTourStep: null }
        });

        manager.startTour('recurringSettings');

        const overlayInDialog = dialog.querySelector('.tour-overlay');
        const overlayInBody = document.body.querySelector(':scope > .tour-overlay');

        if (!overlayInDialog) {
            throw new Error('Expected tour overlay inside the dialog');
        }
        if (overlayInBody) {
            throw new Error('Tour overlay should NOT be a direct child of body');
        }

        dialog.remove();
    });

    await test('recurring settings tour completion sets recurringSettingsTourStep to done', async () => {
        const dialog = setupRecurringSettingsTargets();
        const manager = await createManager({
            appReady: false,
            settings: { onboardingCompleted: true, guidedTourStep: 'done', recurringSettingsTourStep: null }
        });

        manager.startTour('recurringSettings');
        manager.completeTour();

        if (mockState.settings.recurringSettingsTourStep !== 'done') {
            throw new Error(`Expected recurringSettingsTourStep done, got ${mockState.settings.recurringSettingsTourStep}`);
        }
        if (mockState.settings.guidedTourStep !== 'done') {
            throw new Error(`guidedTourStep should remain done, got ${mockState.settings.guidedTourStep}`);
        }

        dialog.remove();
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
