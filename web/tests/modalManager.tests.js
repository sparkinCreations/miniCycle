/**
 * ModalManager Browser Tests
 * Test functions for module-test-suite.html
 *
 * Updated for Phase 3 DI Pattern - direct module imports with DI
 */

import {
    setupTestEnvironment,
    createProtectedTest,
    createMockNotification,
    createMockHideMainMenu,
    createMockSanitizeInput
} from './testHelpers.js';

// Direct import from module (not via appContext which may not be populated)
import {
    ModalManager,
    setModalManagerDependencies,
    initModalManager,
    getModalManager
} from '../modules/ui/modalManager.js';

export async function runModalManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎭 ModalManager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // =====================================================
    // Create mock dependencies for tests
    // =====================================================
    const mockShowNotification = createMockNotification();
    const mockHideMainMenu = createMockHideMainMenu();
    const mockSanitizeInput = createMockSanitizeInput();
    const mockSafeAddEventListener = (el, ev, fn) => {
        el?.removeEventListener?.(ev, fn);
        el?.addEventListener?.(ev, fn);
    };

    // Mock getModal that looks up real DOM elements by modal name → element ID
    const mockGetModal = (name) => {
        const idMap = {
            feedback: 'feedback-modal', about: 'about-modal',
            settings: 'settings-modal', reminders: 'reminders-modal',
            recurringOverlay: 'recurring-panel-overlay',
            recurringPanel: 'recurring-settings-panel',
            themes: 'theme-modal', games: 'games-modal',
            preferences: 'preferences-modal', help: 'help-window',
            testing: 'testing-modal', routineSwitcher: 'routine-switcher-modal',
            taskOptionsCustomizer: 'task-options-customizer-modal'
        };
        return document.getElementById(idMap[name]) || null;
    };

    // Set dependencies at module level
    setModalManagerDependencies({
        showNotification: mockShowNotification,
        hideMainMenu: mockHideMainMenu,
        sanitizeInput: mockSanitizeInput,
        safeAddEventListener: mockSafeAddEventListener,
        waitForCore: () => Promise.resolve(),
        getModal: mockGetModal
    });

    // Initialize the module-level instance
    let modalManagerInstance = await initModalManager({
        showNotification: mockShowNotification,
        hideMainMenu: mockHideMainMenu,
        sanitizeInput: mockSanitizeInput,
        safeAddEventListener: mockSafeAddEventListener,
        waitForCore: () => Promise.resolve(),
        getModal: mockGetModal
    });

    resultsDiv.innerHTML = '<h2>🎭 ModalManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Use shared test helper with data protection
    const test = createProtectedTest(resultsDiv, passed, total);

    // ===== INITIALIZATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('ModalManager class exists', () => {
        if (typeof ModalManager === 'undefined') {
            throw new Error('ModalManager class not found');
        }
    });

    test('creates instance successfully', () => {
        const mm = new ModalManager();
        if (!(mm instanceof ModalManager)) throw new Error('should be a ModalManager instance');
        // Constructor contract (modalManager.js:113): a fresh instance is NOT yet initialized.
        if (mm.initialized !== false) throw new Error(`fresh instance should have initialized===false, got ${mm.initialized}`);
    });

    test('has global instance', () => {
        const instance = getModalManager();
        if (!(instance instanceof ModalManager)) throw new Error('global instance should be a ModalManager');
        // The singleton was awaited through initModalManager() in setup, so init() ran →
        // initialized flips true (modalManager.js:136). A weak truthiness check missed this.
        if (instance.initialized !== true) throw new Error('initialized global instance should have initialized===true');
    });


    test('has initialized property', () => {
        // Assert the EXACT constructor value, not merely "is a boolean" — the old check would
        // pass even if the constructor wrongly started initialized===true.
        const mm = new ModalManager();
        if (mm.initialized !== false) throw new Error(`new ModalManager().initialized should be false, got ${mm.initialized}`);
    });

    // ===== MODAL SETUP TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ Modal Setup</h4>';

    test('setupEventListeners is idempotent (runs sub-setups once)', () => {
        const mm = new ModalManager();
        // Count how many times a delegated sub-setup runs across two calls.
        let feedbackSetups = 0;
        const realSetup = mm.setupFeedbackModal.bind(mm);
        mm.setupFeedbackModal = () => { feedbackSetups++; return realSetup(); };

        mm.setupEventListeners();
        if (mm._eventListenersInitialized !== true) throw new Error('first call should set the idempotency flag');
        if (feedbackSetups !== 1) throw new Error(`first call should run the feedback sub-setup once, ran ${feedbackSetups}`);

        // Second call must early-return (modalManager.js:144) — no duplicate wiring.
        mm.setupEventListeners();
        if (feedbackSetups !== 1) throw new Error(`second call should be a no-op, sub-setup ran ${feedbackSetups} times total`);
    });

    test('setupFeedbackModal method exists', () => {
        const mm = new ModalManager();
        if (typeof mm.setupFeedbackModal !== 'function') {
            throw new Error('setupFeedbackModal method not found');
        }
    });

    test('setupAboutModal method exists', () => {
        const mm = new ModalManager();
        if (typeof mm.setupAboutModal !== 'function') {
            throw new Error('setupAboutModal method not found');
        }
    });

    test('setupSettingsModalClickOutside method exists', () => {
        const mm = new ModalManager();
        if (typeof mm.setupSettingsModalClickOutside !== 'function') {
            throw new Error('setupSettingsModalClickOutside method not found');
        }
    });

    test('setupRemindersModalHandlers method exists', () => {
        const mm = new ModalManager();
        if (typeof mm.setupRemindersModalHandlers !== 'function') {
            throw new Error('setupRemindersModalHandlers method not found');
        }
    });

    test('setupGlobalKeyHandlers method exists', () => {
        const mm = new ModalManager();
        if (typeof mm.setupGlobalKeyHandlers !== 'function') {
            throw new Error('setupGlobalKeyHandlers method not found');
        }
    });

    // ===== CLOSE ALL MODALS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🚪 Close All Modals</h4>';

    test('closeAllModals method exists', () => {
        const mm = new ModalManager();
        if (typeof mm.closeAllModals !== 'function') {
            throw new Error('closeAllModals method not found');
        }
    });

    await test('closeAllModals returns focus to the opener and clears _previousFocus', async () => {
        const mm = new ModalManager();

        const trigger = document.createElement('button');
        trigger.textContent = 'opener';
        document.body.appendChild(trigger);

        // A real <dialog> with a child: that's the production shape, and it's
        // what makes animateDialogClose take its async (animation) path.
        const modal = document.createElement('dialog');
        modal.id = 'feedback-modal';
        modal.innerHTML = '<div><button>inside</button></div>';
        document.body.appendChild(modal);

        trigger.focus();
        modal._previousFocus = document.activeElement;   // what every open path does
        modal.showModal();

        mm.closeAllModals();

        // Focus lands when the dialog actually CLOSES, not when closeAllModals
        // returns — animateDialogClose waits for the closing animation (200ms
        // fallback). Asserting synchronously here would test the inert window,
        // where a focus() call outside an open modal dialog is ignored.
        await new Promise(resolve => setTimeout(resolve, 350));

        const active = document.activeElement;
        const cleared = modal._previousFocus === null;
        trigger.remove();
        modal.remove();

        if (active !== trigger) {
            throw new Error(`focus should return to the opener, got <${active?.tagName?.toLowerCase()}>`);
        }
        if (!cleared) {
            throw new Error('_previousFocus should be nulled after close (stale ref pins a detached node)');
        }
    });

    test('closeAllModals hides visible modals', () => {
        const mm = new ModalManager();

        // Create test modal
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        mm.closeAllModals();

        if (modal.style.display !== 'none') {
            throw new Error('Modal should be hidden');
        }

        // Cleanup
        modal.remove();
    });

    test('closeAllModals handles data-modal elements', () => {
        const mm = new ModalManager();

        // Create a native <dialog> modal (settings uses 'close' method in registry)
        const modal = document.createElement('dialog');
        modal.id = 'settings-modal';
        document.body.appendChild(modal);
        modal.showModal(); // Opens the dialog natively

        mm.closeAllModals();

        if (modal.open) {
            throw new Error('Modal should be closed');
        }

        // Cleanup
        modal.remove();
    });

    test('closeAllModals handles overlay elements', () => {
        const mm = new ModalManager();

        // Create a native <dialog> overlay (recurringOverlay uses 'close' method in registry)
        const overlay = document.createElement('dialog');
        overlay.id = 'recurring-panel-overlay';
        document.body.appendChild(overlay);
        overlay.showModal(); // Opens the dialog natively

        mm.closeAllModals();

        if (overlay.open) {
            throw new Error('Overlay dialog should be closed');
        }

        // Cleanup
        overlay.remove();
    });

    test('closeAllModals clears task options', () => {
        const mm = new ModalManager();

        // Create test task options
        const taskOptions = document.createElement('div');
        taskOptions.classList.add('task-options');
        // Task options start visible (no force-hidden class)
        document.body.appendChild(taskOptions);

        mm.closeAllModals();

        if (!taskOptions.classList.contains('task-options-force-hidden')) {
            throw new Error('Task options should be hidden');
        }

        // Cleanup
        taskOptions.remove();
    });

    test('closeAllModals resets task states', () => {
        const mm = new ModalManager();

        // Create test task
        const task = document.createElement('div');
        task.classList.add('task', 'long-pressed', 'draggable', 'dragging', 'selected');
        document.body.appendChild(task);

        mm.closeAllModals();

        if (task.classList.contains('long-pressed') ||
            task.classList.contains('draggable') ||
            task.classList.contains('dragging') ||
            task.classList.contains('selected')) {
            throw new Error('Task state classes should be removed');
        }

        // Cleanup
        task.remove();
    });

    test('closeAllModals clears recurring task selections', () => {
        const mm = new ModalManager();

        // Create test recurring task item
        const item = document.createElement('div');
        item.classList.add('recurring-task-item', 'selected');
        document.body.appendChild(item);

        mm.closeAllModals();

        if (item.classList.contains('selected')) {
            throw new Error('Recurring task selection should be cleared');
        }

        // Cleanup
        item.remove();
    });

    test('closeAllModals hides recurring settings panel', () => {
        const mm = new ModalManager();

        // Create test recurring settings panel
        const panel = document.createElement('div');
        panel.id = 'recurring-settings-panel';
        document.body.appendChild(panel);

        mm.closeAllModals();

        if (!panel.classList.contains('hidden')) {
            throw new Error('Recurring settings panel should be hidden');
        }

        // Cleanup
        panel.remove();
    });

    // ===== FEEDBACK MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">📝 Feedback Modal</h4>';

    test('setupFeedbackModal handles missing elements gracefully', () => {
        const mm = new ModalManager();

        // Should not throw when elements don't exist
        mm.setupFeedbackModal();
    });

    test('setupFeedbackFooterButton opens the feedback dialog and hides thank-you', () => {
        const mm = new ModalManager({ safeAddEventListener: mockSafeAddEventListener });

        const modal = document.createElement('dialog');
        modal.id = 'feedback-modal';
        document.body.appendChild(modal);

        const thankYou = document.createElement('div');
        thankYou.id = 'thank-you-message';
        thankYou.style.display = 'block';
        modal.appendChild(thankYou);

        const footerBtn = document.createElement('button');
        footerBtn.id = 'open-feedback-modal-footer';   // DOM_IDS.OPEN_FEEDBACK_MODAL_FOOTER
        document.body.appendChild(footerBtn);

        mm.setupFeedbackFooterButton();
        footerBtn.click();

        // Source (modalManager.js:363-369): click handler opens the dialog and hides thank-you.
        if (!modal.open) throw new Error('footer button click should open the feedback dialog');
        if (thankYou.style.display !== 'none') throw new Error('footer button click should hide the thank-you message');

        if (modal.open) modal.close();
        modal.remove();
        footerBtn.remove();
    });

    test('feedback modal opens when button clicked', () => {
        const mm = new ModalManager({
            hideMainMenu: mockHideMainMenu,
            safeAddEventListener: mockSafeAddEventListener
        });

        // Create native <dialog> modal (code calls feedbackModal.showModal())
        const modal = document.createElement('dialog');
        modal.id = 'feedback-modal';
        document.body.appendChild(modal);

        const openBtn = document.createElement('button');
        openBtn.id = 'open-feedback-modal';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('close-feedback-modal');
        modal.appendChild(closeBtn);

        const form = document.createElement('form');
        form.id = 'feedback-form';
        modal.appendChild(form);

        const textarea = document.createElement('textarea');
        textarea.id = 'feedback-text';
        form.appendChild(textarea);

        const submitBtn = document.createElement('button');
        submitBtn.id = 'submit-feedback';
        submitBtn.type = 'submit';
        form.appendChild(submitBtn);

        const thankYou = document.createElement('div');
        thankYou.id = 'thank-you-message';
        modal.appendChild(thankYou);

        mm.setupFeedbackModal();

        openBtn.click();

        if (!modal.open) {
            throw new Error('Modal should be open after open button clicked');
        }

        // Cleanup
        if (modal.open) modal.close();
        modal.remove();
        openBtn.remove();
    });

    test('feedback modal closes when close button clicked', () => {
        const mm = new ModalManager({
            safeAddEventListener: mockSafeAddEventListener
        });

        // Create native <dialog> modal (code calls feedbackModal.close())
        const modal = document.createElement('dialog');
        modal.id = 'feedback-modal';
        document.body.appendChild(modal);
        modal.showModal(); // Start open

        const openBtn = document.createElement('button');
        openBtn.id = 'open-feedback-modal';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('close-feedback-modal');
        modal.appendChild(closeBtn);

        const form = document.createElement('form');
        form.id = 'feedback-form';
        modal.appendChild(form);

        const textarea = document.createElement('textarea');
        textarea.id = 'feedback-text';
        form.appendChild(textarea);

        const submitBtn = document.createElement('button');
        submitBtn.id = 'submit-feedback';
        submitBtn.type = 'submit';
        form.appendChild(submitBtn);

        const thankYou = document.createElement('div');
        thankYou.id = 'thank-you-message';
        modal.appendChild(thankYou);

        mm.setupFeedbackModal();

        closeBtn.click();

        if (modal.open) {
            throw new Error('Modal should be closed after close button clicked');
        }

        // Cleanup
        modal.remove();
        openBtn.remove();
    });

    // ===== ABOUT MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">ℹ️ About Modal</h4>';

    test('setupAboutModal handles missing elements gracefully', () => {
        const mm = new ModalManager();

        // Should not throw when elements don't exist
        mm.setupAboutModal();
    });

    test('about modal opens when button clicked', () => {
        const mm = new ModalManager({
            safeAddEventListener: mockSafeAddEventListener
        });

        // Create native <dialog> modal (code calls aboutModal.showModal())
        const modal = document.createElement('dialog');
        modal.id = 'about-modal';
        document.body.appendChild(modal);

        const openBtn = document.createElement('button');
        openBtn.id = 'open-about-modal';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('close-modal');
        modal.appendChild(closeBtn);

        mm.setupAboutModal();

        openBtn.click();

        if (!modal.open) {
            throw new Error('About modal should be open after open button clicked');
        }

        // Cleanup
        if (modal.open) modal.close();
        modal.remove();
        openBtn.remove();
    });

    test('about modal closes when close button clicked', () => {
        const mm = new ModalManager({
            safeAddEventListener: mockSafeAddEventListener
        });

        // Create native <dialog> modal (code calls aboutModal.close())
        const modal = document.createElement('dialog');
        modal.id = 'about-modal';
        document.body.appendChild(modal);
        modal.showModal(); // Start open

        const openBtn = document.createElement('button');
        openBtn.id = 'open-about-modal';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('close-modal');
        modal.appendChild(closeBtn);

        mm.setupAboutModal();

        closeBtn.click();

        if (modal.open) {
            throw new Error('About modal should be closed after close button clicked');
        }

        // Cleanup
        modal.remove();
        openBtn.remove();
    });

    // ===== REMINDERS MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⏰ Reminders Modal</h4>';

    test('setupRemindersModalHandlers handles missing elements gracefully', () => {
        const mm = new ModalManager();

        // Should not throw when elements don't exist
        mm.setupRemindersModalHandlers();
    });

    test('reminders modal closes when close button clicked', () => {
        const mm = new ModalManager({
            safeAddEventListener: mockSafeAddEventListener
        });

        // Create native <dialog> modal (code calls remindersModal.close())
        const modal = document.createElement('dialog');
        modal.id = 'reminders-modal';
        document.body.appendChild(modal);
        modal.showModal(); // Start open

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-reminders-btn';
        document.body.appendChild(closeBtn);

        mm.setupRemindersModalHandlers();

        closeBtn.click();

        if (modal.open) {
            throw new Error('Reminders modal should be closed after close button clicked');
        }

        // Cleanup
        modal.remove();
        closeBtn.remove();
    });

    // ===== SETTINGS MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ Settings Modal</h4>';

    test('setupSettingsModalClickOutside handles missing elements gracefully', () => {
        const mm = new ModalManager();

        // Should not throw when elements don't exist
        mm.setupSettingsModalClickOutside();
    });

    // ===== GLOBAL KEY HANDLERS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⌨️ Global Key Handlers</h4>';

    test('setupGlobalKeyHandlers attaches ESC key handler', () => {
        // Track if the global key handler was attached
        let keyHandler;
        const mm = new ModalManager({
            safeAddEventListener: (el, ev, fn) => {
                el?.removeEventListener?.(ev, fn);
                el?.addEventListener?.(ev, fn);
                if (el === document && ev === 'keydown') {
                    keyHandler = fn;
                }
            }
        });

        // Create native <dialog> modal
        const modal = document.createElement('dialog');
        modal.id = 'feedback-modal';
        document.body.appendChild(modal);
        modal.showModal(); // Open it natively

        // Call setupGlobalKeyHandlers
        mm.setupGlobalKeyHandlers();

        // Simulate ESC key press to verify handler is attached
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(escEvent);

        const handlerWorks = !modal.open;

        // Cleanup
        if (modal.open) modal.close();
        modal.remove();
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
        }

        if (!handlerWorks) {
            throw new Error('ESC key handler should be attached');
        }
    });

    test('ESC key closes modals', () => {
        // Create native <dialog> modal
        const modal = document.createElement('dialog');
        modal.id = 'feedback-modal';
        document.body.appendChild(modal);
        modal.showModal(); // Open it natively

        // Mock safeAddEventListener as a dependency
        let keyHandler;
        const localMockSafeAdd = (element, event, handler) => {
            element?.removeEventListener?.(event, handler);
            element?.addEventListener?.(event, handler);
            if (element === document && event === 'keydown') {
                keyHandler = handler;
            }
        };

        const mm = new ModalManager({
            safeAddEventListener: localMockSafeAdd
        });

        mm.setupGlobalKeyHandlers();

        // Simulate ESC key press
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(escEvent);

        if (modal.open) {
            throw new Error('ESC key should close modals');
        }

        // Cleanup
        if (modal.open) modal.close();
        modal.remove();
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
        }
    });


    // ===== IS MODAL OPEN TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔍 Is Modal Open</h4>';

    test('isModalOpen method exists', () => {
        const mm = new ModalManager();
        if (typeof mm.isModalOpen !== 'function') {
            throw new Error('isModalOpen method not found');
        }
    });

    test('isModalOpen returns false when no modals open', () => {
        // Clean up any leftover modals from previous tests
        const cleanupSelectors = [
            '.mini-modal-overlay',
            '.miniCycle-overlay',
            '.onboarding-modal',
            '#feedback-modal',
            '#about-modal',
            '#reminders-modal',
            '.settings-modal'
        ];
        cleanupSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
        });

        const mm = new ModalManager();
        const result = mm.isModalOpen();

        if (result !== false) {
            throw new Error('Should return false when no modals open');
        }
    });

    test('isModalOpen detects open feedback modal', () => {
        const mm = new ModalManager();

        // Create visible modal
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const result = mm.isModalOpen();

        if (result !== true) {
            throw new Error('Should detect open feedback modal');
        }

        // Cleanup
        modal.remove();
    });

    test('isModalOpen detects open about modal', () => {
        const mm = new ModalManager();

        // Create visible modal
        const modal = document.createElement('div');
        modal.id = 'about-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const result = mm.isModalOpen();

        if (result !== true) {
            throw new Error('Should detect open about modal');
        }

        // Cleanup
        modal.remove();
    });

    test('isModalOpen detects open settings modal', () => {
        const mm = new ModalManager();

        // Create native <dialog> modal (settings uses 'close' method in registry)
        const modal = document.createElement('dialog');
        modal.id = 'settings-modal';
        document.body.appendChild(modal);
        modal.showModal(); // Opens the dialog natively, sets .open = true

        const result = mm.isModalOpen();

        if (result !== true) {
            throw new Error('Should detect open settings modal');
        }

        // Cleanup
        modal.close();
        modal.remove();
    });

    test('isModalOpen detects onboarding modal', () => {
        const mm = new ModalManager();

        // Create visible onboarding modal
        const modal = document.createElement('div');
        modal.classList.add('onboarding-modal');
        document.body.appendChild(modal);

        const result = mm.isModalOpen();

        if (result !== true) {
            throw new Error('Should detect open onboarding modal');
        }

        // Cleanup
        modal.remove();
    });

    // ===== GLOBAL INSTANCE TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Instance</h4>';

    test('closeAllModals is available via getModalManager()', () => {
        const instance = getModalManager();
        if (!instance || typeof instance.closeAllModals !== 'function') {
            throw new Error('closeAllModals not available via getModalManager()');
        }
    });

    test('closeAllModals via getModalManager() closes modals', () => {
        const instance = getModalManager();

        // Create test modal
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        instance.closeAllModals();

        if (modal.style.display !== 'none') {
            throw new Error('closeAllModals via getModalManager() should close modals');
        }

        // Cleanup
        modal.remove();
    });

    test('modalManager instance is accessible via getModalManager()', () => {
        const instance = getModalManager();

        if (!instance) {
            throw new Error('modalManager instance not accessible');
        }
        if (!(instance instanceof ModalManager)) {
            throw new Error('Instance is not ModalManager instance');
        }
    });

    // ===== ERROR HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    test('closeAllModals handles missing elements gracefully', () => {
        const mm = new ModalManager();

        // Should not throw when no modals exist
        mm.closeAllModals();
    });

    test('setupFeedbackModal handles null elements', () => {
        const mm = new ModalManager();

        // Clear any existing elements
        const existingModal = document.getElementById('feedback-modal');
        if (existingModal) existingModal.remove();

        // Should not throw
        mm.setupFeedbackModal();
    });

    test('setupAboutModal handles null elements', () => {
        const mm = new ModalManager();

        // Clear any existing elements
        const existingModal = document.getElementById('about-modal');
        if (existingModal) existingModal.remove();

        // Should not throw
        mm.setupAboutModal();
    });

    test('setupRemindersModalHandlers handles null elements', () => {
        const mm = new ModalManager();

        // Clear any existing elements
        const existingModal = document.getElementById('reminders-modal');
        if (existingModal) existingModal.remove();

        // Should not throw
        mm.setupRemindersModalHandlers();
    });

    test('isModalOpen handles no modal elements', () => {
        const mm = new ModalManager();

        // Should return false, not throw
        const result = mm.isModalOpen();

        if (result !== false) {
            throw new Error('Should return false when no modal elements exist');
        }
    });

    // ===== SUMMARY =====

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round((passed.count / total.count) * 100)}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }

    return { passed: passed.count, total: total.count };
}
