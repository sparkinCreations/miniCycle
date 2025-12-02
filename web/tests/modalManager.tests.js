/**
 * ModalManager Browser Tests
 * Test functions for module-test-suite.html
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 */

import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

export async function runModalManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎭 ModalManager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>🎭 ModalManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Use shared test helper with data protection
    const test = createProtectedTest(resultsDiv, passed, total);

    // ===== INITIALIZATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('ModalManager class exists', () => {
        if (typeof window.ModalManager === 'undefined') {
            throw new Error('ModalManager class not found');
        }
    });

    test('creates instance successfully', () => {
        const mm = new window.ModalManager();
        if (!mm || typeof mm.closeAllModals !== 'function') {
            throw new Error('ModalManager not properly initialized');
        }
    });

    test('has global instance', () => {
        if (!window.modalManager) {
            throw new Error('Global modalManager instance not found');
        }
        if (typeof window.modalManager.closeAllModals !== 'function') {
            throw new Error('Global instance missing methods');
        }
    });

    test('has version property', () => {
        const mm = new window.ModalManager();
        if (!mm.version) {
            throw new Error('Version property missing');
        }
        if (typeof mm.version !== 'string') {
            throw new Error('Version should be a string');
        }
    });

    test('has initialized property', () => {
        const mm = new window.ModalManager();
        if (typeof mm.initialized === 'undefined') {
            throw new Error('initialized property missing');
        }
        if (typeof mm.initialized !== 'boolean') {
            throw new Error('initialized should be a boolean');
        }
    });

    // ===== MODAL SETUP TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ Modal Setup</h4>';

    test('setupEventListeners method exists', () => {
        const mm = new window.ModalManager();
        if (typeof mm.setupEventListeners !== 'function') {
            throw new Error('setupEventListeners method not found');
        }
    });

    test('setupFeedbackModal method exists', () => {
        const mm = new window.ModalManager();
        if (typeof mm.setupFeedbackModal !== 'function') {
            throw new Error('setupFeedbackModal method not found');
        }
    });

    test('setupAboutModal method exists', () => {
        const mm = new window.ModalManager();
        if (typeof mm.setupAboutModal !== 'function') {
            throw new Error('setupAboutModal method not found');
        }
    });

    test('setupSettingsModalClickOutside method exists', () => {
        const mm = new window.ModalManager();
        if (typeof mm.setupSettingsModalClickOutside !== 'function') {
            throw new Error('setupSettingsModalClickOutside method not found');
        }
    });

    test('setupRemindersModalHandlers method exists', () => {
        const mm = new window.ModalManager();
        if (typeof mm.setupRemindersModalHandlers !== 'function') {
            throw new Error('setupRemindersModalHandlers method not found');
        }
    });

    test('setupGlobalKeyHandlers method exists', () => {
        const mm = new window.ModalManager();
        if (typeof mm.setupGlobalKeyHandlers !== 'function') {
            throw new Error('setupGlobalKeyHandlers method not found');
        }
    });

    // ===== CLOSE ALL MODALS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🚪 Close All Modals</h4>';

    test('closeAllModals method exists', () => {
        const mm = new window.ModalManager();
        if (typeof mm.closeAllModals !== 'function') {
            throw new Error('closeAllModals method not found');
        }
    });

    test('closeAllModals hides visible modals', () => {
        const mm = new window.ModalManager();

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
        const mm = new window.ModalManager();

        // Create test modal with data-modal attribute
        const modal = document.createElement('div');
        modal.setAttribute('data-modal', 'test');
        modal.classList.add('visible');
        document.body.appendChild(modal);

        mm.closeAllModals();

        if (modal.classList.contains('visible')) {
            throw new Error('Modal should not have visible class');
        }

        // Cleanup
        modal.remove();
    });

    test('closeAllModals handles overlay elements', () => {
        const mm = new window.ModalManager();

        // Create test overlay
        const overlay = document.createElement('div');
        overlay.id = 'recurring-panel-overlay';
        document.body.appendChild(overlay);

        mm.closeAllModals();

        if (!overlay.classList.contains('hidden')) {
            throw new Error('Overlay should have hidden class');
        }

        // Cleanup
        overlay.remove();
    });

    test('closeAllModals clears task options', () => {
        const mm = new window.ModalManager();

        // Create test task options
        const taskOptions = document.createElement('div');
        taskOptions.classList.add('task-options');
        taskOptions.style.opacity = '1';
        taskOptions.style.visibility = 'visible';
        taskOptions.style.pointerEvents = 'auto';
        document.body.appendChild(taskOptions);

        mm.closeAllModals();

        if (taskOptions.style.opacity !== '0' ||
            taskOptions.style.visibility !== 'hidden' ||
            taskOptions.style.pointerEvents !== 'none') {
            throw new Error('Task options should be hidden');
        }

        // Cleanup
        taskOptions.remove();
    });

    test('closeAllModals resets task states', () => {
        const mm = new window.ModalManager();

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
        const mm = new window.ModalManager();

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
        const mm = new window.ModalManager();

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
        const mm = new window.ModalManager();

        // Should not throw when elements don't exist
        mm.setupFeedbackModal();
    });

    test('setupFeedbackFooterButton method exists', () => {
        const mm = new window.ModalManager();
        if (typeof mm.setupFeedbackFooterButton !== 'function') {
            throw new Error('setupFeedbackFooterButton method not found');
        }
    });

    test('feedback modal opens when button clicked', () => {
        const mm = new window.ModalManager();

        // Create mock elements
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.style.display = 'none';
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

        // Mock hideMainMenu
        window.hideMainMenu = () => {};

        mm.setupFeedbackModal();

        openBtn.click();

        if (modal.style.display !== 'flex') {
            throw new Error('Modal should be visible after open button clicked');
        }

        // Cleanup
        modal.remove();
        openBtn.remove();
        delete window.hideMainMenu;
    });

    test('feedback modal closes when close button clicked', () => {
        const mm = new window.ModalManager();

        // Create mock elements
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.style.display = 'flex';
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

        closeBtn.click();

        if (modal.style.display !== 'none') {
            throw new Error('Modal should be hidden after close button clicked');
        }

        // Cleanup
        modal.remove();
        openBtn.remove();
    });

    // ===== ABOUT MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">ℹ️ About Modal</h4>';

    test('setupAboutModal handles missing elements gracefully', () => {
        const mm = new window.ModalManager();

        // Should not throw when elements don't exist
        mm.setupAboutModal();
    });

    test('about modal opens when button clicked', () => {
        const mm = new window.ModalManager();

        // Create mock elements
        const modal = document.createElement('div');
        modal.id = 'about-modal';
        modal.style.display = 'none';
        document.body.appendChild(modal);

        const openBtn = document.createElement('button');
        openBtn.id = 'open-about-modal';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('close-modal');
        modal.appendChild(closeBtn);

        mm.setupAboutModal();

        openBtn.click();

        if (modal.style.display !== 'flex') {
            throw new Error('About modal should be visible after open button clicked');
        }

        // Cleanup
        modal.remove();
        openBtn.remove();
    });

    test('about modal closes when close button clicked', () => {
        const mm = new window.ModalManager();

        // Create mock elements
        const modal = document.createElement('div');
        modal.id = 'about-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const openBtn = document.createElement('button');
        openBtn.id = 'open-about-modal';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('close-modal');
        modal.appendChild(closeBtn);

        mm.setupAboutModal();

        closeBtn.click();

        if (modal.style.display !== 'none') {
            throw new Error('About modal should be hidden after close button clicked');
        }

        // Cleanup
        modal.remove();
        openBtn.remove();
    });

    // ===== REMINDERS MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⏰ Reminders Modal</h4>';

    test('setupRemindersModalHandlers handles missing elements gracefully', () => {
        const mm = new window.ModalManager();

        // Should not throw when elements don't exist
        mm.setupRemindersModalHandlers();
    });

    test('reminders modal closes when close button clicked', () => {
        const mm = new window.ModalManager();

        // Create mock elements
        const modal = document.createElement('div');
        modal.id = 'reminders-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-reminders-btn';
        document.body.appendChild(closeBtn);

        mm.setupRemindersModalHandlers();

        closeBtn.click();

        if (modal.style.display !== 'none') {
            throw new Error('Reminders modal should be hidden after close button clicked');
        }

        // Cleanup
        modal.remove();
        closeBtn.remove();
    });

    // ===== SETTINGS MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ Settings Modal</h4>';

    test('setupSettingsModalClickOutside handles missing elements gracefully', () => {
        const mm = new window.ModalManager();

        // Should not throw when elements don't exist
        mm.setupSettingsModalClickOutside();
    });

    // ===== GLOBAL KEY HANDLERS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⌨️ Global Key Handlers</h4>';

    test('setupGlobalKeyHandlers attaches ESC key handler', () => {
        // Mock safeAddEventListener as a dependency
        let handlerAttached = false;
        const mockSafeAddEventListener = (element, event, handler) => {
            if (element === document && event === 'keydown') {
                handlerAttached = true;
            }
        };

        const mm = new window.ModalManager({
            safeAddEventListener: mockSafeAddEventListener
        });

        mm.setupGlobalKeyHandlers();

        if (!handlerAttached) {
            throw new Error('ESC key handler should be attached');
        }
    });

    test('setupGlobalKeyHandlers handles missing safeAddEventListener', () => {
        const mm = new window.ModalManager();

        // Clear safeAddEventListener
        delete window.safeAddEventListener;

        // Should not throw
        mm.setupGlobalKeyHandlers();
    });

    test('ESC key closes modals', () => {
        // Create test modal
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        // Mock safeAddEventListener as a dependency
        let keyHandler;
        const mockSafeAddEventListener = (element, event, handler) => {
            if (element === document && event === 'keydown') {
                keyHandler = handler;
                document.addEventListener(event, handler);
            }
        };

        const mm = new window.ModalManager({
            safeAddEventListener: mockSafeAddEventListener
        });

        mm.setupGlobalKeyHandlers();

        // Simulate ESC key press
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(escEvent);

        if (modal.style.display !== 'none') {
            throw new Error('ESC key should close modals');
        }

        // Cleanup
        modal.remove();
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
        }
    });


    // ===== IS MODAL OPEN TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔍 Is Modal Open</h4>';

    test('isModalOpen method exists', () => {
        const mm = new window.ModalManager();
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

        const mm = new window.ModalManager();
        const result = mm.isModalOpen();

        if (result !== false) {
            throw new Error('Should return false when no modals open');
        }
    });

    test('isModalOpen detects open feedback modal', () => {
        const mm = new window.ModalManager();

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
        const mm = new window.ModalManager();

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
        const mm = new window.ModalManager();

        // Create visible modal
        const modal = document.createElement('div');
        modal.classList.add('settings-modal');
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const result = mm.isModalOpen();

        if (result !== true) {
            throw new Error('Should detect open settings modal');
        }

        // Cleanup
        modal.remove();
    });

    test('isModalOpen detects onboarding modal', () => {
        const mm = new window.ModalManager();

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

    // ===== GLOBAL WRAPPERS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

    test('window.closeAllModals exists', () => {
        if (typeof window.closeAllModals !== 'function') {
            throw new Error('Global closeAllModals not found');
        }
    });

    test('global closeAllModals calls instance method', () => {
        // Create test modal
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        window.closeAllModals();

        if (modal.style.display !== 'none') {
            throw new Error('Global closeAllModals should close modals');
        }

        // Cleanup
        modal.remove();
    });

    test('modalManager instance is accessible globally', () => {
        if (!window.modalManager) {
            throw new Error('modalManager instance not accessible globally');
        }
        if (!(window.modalManager instanceof window.ModalManager)) {
            throw new Error('Global instance is not ModalManager instance');
        }
    });

    // ===== CLICK OUTSIDE TO CLOSE TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🖱️ Click Outside to Close</h4>';

    test('feedback modal closes when clicking outside', () => {
        // Remove any existing feedback modal first
        const existingModal = document.getElementById('feedback-modal');
        if (existingModal) existingModal.remove();
        const existingBtn = document.getElementById('open-feedback-modal');
        if (existingBtn) existingBtn.remove();

        // Create mock elements
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.style.display = 'flex';
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

        const mm = new window.ModalManager();
        mm.setupFeedbackModal();

        // Simulate click on modal background - use window event since handler is on window
        const clickEvent = new MouseEvent('click', { bubbles: true, target: modal });
        Object.defineProperty(clickEvent, 'target', { value: modal, writable: false });
        window.dispatchEvent(clickEvent);

        if (modal.style.display !== 'none') {
            throw new Error('Modal should close when clicking outside');
        }

        // Cleanup
        modal.remove();
        openBtn.remove();
    });

    test('about modal closes when clicking outside', () => {
        const mm = new window.ModalManager();

        // Create mock elements
        const modal = document.createElement('div');
        modal.id = 'about-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const openBtn = document.createElement('button');
        openBtn.id = 'open-about-modal';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('close-modal');
        modal.appendChild(closeBtn);

        mm.setupAboutModal();

        // Simulate click on modal background (dispatch on modal, bubbles to window)
        const clickEvent = new MouseEvent('click', { bubbles: true });
        modal.dispatchEvent(clickEvent);

        if (modal.style.display !== 'none') {
            throw new Error('About modal should close when clicking outside');
        }

        // Cleanup
        modal.remove();
        openBtn.remove();
    });

    test('reminders modal closes when clicking outside', () => {
        const mm = new window.ModalManager();

        // Create mock elements
        const modal = document.createElement('div');
        modal.id = 'reminders-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-reminders-btn';
        document.body.appendChild(closeBtn);

        mm.setupRemindersModalHandlers();

        // Simulate click on modal background (dispatch on modal, bubbles to window)
        const clickEvent = new MouseEvent('click', { bubbles: true });
        modal.dispatchEvent(clickEvent);

        if (modal.style.display !== 'none') {
            throw new Error('Reminders modal should close when clicking outside');
        }

        // Cleanup
        modal.remove();
        closeBtn.remove();
    });

    // ===== ERROR HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    test('closeAllModals handles missing elements gracefully', () => {
        const mm = new window.ModalManager();

        // Should not throw when no modals exist
        mm.closeAllModals();
    });

    test('setupFeedbackModal handles null elements', () => {
        const mm = new window.ModalManager();

        // Clear any existing elements
        const existingModal = document.getElementById('feedback-modal');
        if (existingModal) existingModal.remove();

        // Should not throw
        mm.setupFeedbackModal();
    });

    test('setupAboutModal handles null elements', () => {
        const mm = new window.ModalManager();

        // Clear any existing elements
        const existingModal = document.getElementById('about-modal');
        if (existingModal) existingModal.remove();

        // Should not throw
        mm.setupAboutModal();
    });

    test('setupRemindersModalHandlers handles null elements', () => {
        const mm = new window.ModalManager();

        // Clear any existing elements
        const existingModal = document.getElementById('reminders-modal');
        if (existingModal) existingModal.remove();

        // Should not throw
        mm.setupRemindersModalHandlers();
    });

    test('isModalOpen handles no modal elements', () => {
        const mm = new window.ModalManager();

        // Should return false, not throw
        const result = mm.isModalOpen();

        if (result !== false) {
            throw new Error('Should return false when no modal elements exist');
        }
    });

    test('global closeAllModals handles undefined modalManager', () => {
        // Save original
        const original = window.modalManager;

        // Set to undefined
        window.modalManager = undefined;

        // Should not throw
        window.closeAllModals();

        // Restore
        window.modalManager = original;
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
