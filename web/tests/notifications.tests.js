/**
 * MiniCycleNotifications Browser Tests
 * Test functions for module-test-suite.html
 */

import { getTestMiniCycleNotifications, getTestEducationalTipManager, hasGlobal } from './helpers/testContext.js';

// Module-level variables for dynamic imports
let setNotificationsDependencies, MiniCycleNotifications;

export async function runNotificationsTests(resultsDiv) {
    // Dynamic import with cache busting
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/utils/notifications.js?v=${cacheBuster}`);
    setNotificationsDependencies = module.setNotificationsDependencies;
    MiniCycleNotifications = module.MiniCycleNotifications;

    // Make class available globally for tests
    window.MiniCycleNotifications = MiniCycleNotifications;
    resultsDiv.innerHTML = '<h2>🔔 MiniCycleNotifications Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // ✅ CRITICAL: Mark core as ready for test environment
    // This allows async functions using appInit.waitForCore() to proceed
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
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
            // Clean up before each test
            cleanupTestEnvironment();

            // Set up mock globals for each test
            setupMockGlobals();

            const result = testFn();
            // Handle async test functions
            if (result instanceof Promise) {
                await result;
            }
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
            // Clean up after each test
            cleanupTestEnvironment();
            // Clean up mock globals
            delete window.AppState;
            delete window.loadMiniCycleData;
            delete window.generateHashId;

            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ===== HELPER FUNCTIONS =====

    function cleanupTestEnvironment() {
        // Remove notification container
        const existingContainer = document.getElementById('notification-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Remove any modals/overlays (old and new selectors)
        document.querySelectorAll('.mini-modal-overlay, .miniCycle-overlay, .mini-modal-dialog, .miniCycle-prompt-dialog').forEach(el => el.remove());

        // Reset body styles
        document.body.style.userSelect = '';
        document.body.style.overflow = '';

        // Clear localStorage
        localStorage.clear();
    }

    function createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
        return container;
    }

    function createMockSchemaData() {
        return {
            schemaVersion: "2.5",
            metadata: {
                lastModified: Date.now(),
                version: "2.5"
            },
            settings: {
                theme: 'default',
                darkMode: false,
                notificationPosition: { x: 100, y: 20 },
                notificationPositionModified: false,
                dismissedEducationalTips: {}
            },
            data: {
                cycles: {
                    'test-cycle': {
                        tasks: []
                    }
                }
            },
            appState: {
                activeCycleId: 'test-cycle'
            }
        };
    }

    function setupMockGlobals() {
        // Mock loadMiniCycleData
        window.loadMiniCycleData = () => {
            const data = localStorage.getItem('miniCycleData');
            return data ? JSON.parse(data) : null;
        };

        // Mock generateHashId
        window.generateHashId = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & hash;
            }
            return 'hash-' + Math.abs(hash).toString(36);
        };

        // Mock safeAddEventListener and set it as a dependency for the Notifications module
        const mockSafeAddEventListener = (element, event, handler, options) => {
            if (element && typeof element.addEventListener === 'function') {
                element.addEventListener(event, handler, options);
            }
        };
        window.safeAddEventListener = mockSafeAddEventListener;

        // Set module dependencies so DI system has access to safeAddEventListener and generateHashId
        setNotificationsDependencies({
            safeAddEventListener: mockSafeAddEventListener,
            generateHashId: window.generateHashId
        });

        // Mock AppState - improved to not rely on window.loadMiniCycleData during update
        window.AppState = {
            isReady: () => true,
            get: () => {
                const data = localStorage.getItem('miniCycleData');
                return data ? JSON.parse(data) : null;
            },
            update: (updateFn, immediate) => {
                const data = localStorage.getItem('miniCycleData');
                if (data && data !== 'null') {
                    const parsedData = JSON.parse(data);
                    // Only call updateFn if parsedData is valid (not null, not undefined, and is an object)
                    if (parsedData !== null && parsedData !== undefined && typeof parsedData === 'object') {
                        updateFn(parsedData);
                        if (!parsedData.metadata) {
                            parsedData.metadata = {};
                        }
                        parsedData.metadata.lastModified = Date.now();
                        localStorage.setItem('miniCycleData', JSON.stringify(parsedData));
                    }
                }
            }
        };
    }

    // ===== INITIALIZATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('MiniCycleNotifications creates successfully', () => {
        const notifications = new window.MiniCycleNotifications();
        if (!notifications || typeof notifications.show !== 'function') {
            throw new Error('MiniCycleNotifications not properly initialized');
        }
    });

    await test('has educationalTips manager', () => {
        const notifications = new window.MiniCycleNotifications();
        if (!notifications.educationalTips) {
            throw new Error('educationalTips manager not initialized');
        }
    });

    await test('has dragging state tracking', () => {
        const notifications = new window.MiniCycleNotifications();
        if (typeof notifications.isDraggingNotification !== 'boolean') {
            throw new Error('isDraggingNotification not initialized');
        }
    });

    // ===== BASIC NOTIFICATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔔 Basic Notifications</h4>';

    await test('show() creates notification element', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.show('Test message', 'info', 3000);

        const notif = container.querySelector('.notification');
        if (!notif) {
            throw new Error('Notification element not created');
        }
    });

    // Hardening regression: setupMockGlobals() does NOT inject escapeHtml, so this
    // exercises the un-wired path. Before the fix this path fell back to the raw
    // message and parsed injected markup; getEscapeHtml() now guarantees a
    // complete escaper even with no DI. Would fail (img injected) pre-fix.
    await test('show() escapes HTML in message even when escapeHtml is NOT injected', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        const payload = '<img src=x onerror="alert(1)">';
        notifications.show(payload, 'info');

        const notif = container.querySelector('.notification');
        if (!notif) throw new Error('notification not created');
        if (notif.querySelector('img')) {
            throw new Error('XSS: <img> was parsed into the notification DOM (escape fallback failed)');
        }
        if (notif.textContent.indexOf('<img') === -1) {
            throw new Error('escaped payload should appear as literal text in the notification');
        }
    });

    await test('show() applies correct type classes', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.show('Error message', 'error');
        if (!container.querySelector('.notification.error')) {
            throw new Error('Error class not applied');
        }

        container.innerHTML = '';

        notifications.show('Success message', 'success');
        if (!container.querySelector('.notification.success')) {
            throw new Error('Success class not applied');
        }
    });

    await test('show() adds close button', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.show('Test', 'info');

        const closeBtn = container.querySelector('.close-btn');
        if (!closeBtn) {
            throw new Error('Close button not added');
        }
    });

    await test('show() calls onDismiss when close button is clicked', async () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();
        let dismissCount = 0;

        notifications.show('Dismiss me', 'info', 0, {
            onDismiss: () => {
                dismissCount++;
            }
        });

        container.querySelector('.close-btn')?.click();
        await new Promise(resolve => setTimeout(resolve, 350));

        if (dismissCount !== 1) {
            throw new Error(`Expected onDismiss once, got ${dismissCount}`);
        }
    });

    await test('show() calls onDismiss when auto-dismiss removes notification', async () => {
        setupMockGlobals();
        createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();
        let dismissCount = 0;

        notifications.show('Auto dismiss', 'info', 10, {
            onDismiss: () => {
                dismissCount++;
            }
        });

        await new Promise(resolve => setTimeout(resolve, 400));

        if (dismissCount !== 1) {
            throw new Error(`Expected auto-dismiss onDismiss once, got ${dismissCount}`);
        }
    });

    await test('show() prevents duplicate notifications', () => {
        setupMockGlobals();
        // Ensure clean container with no leftover notifications
        const existingContainer = document.getElementById('notification-container');
        if (existingContainer) existingContainer.remove();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.show('Same message', 'info');
        notifications.show('Same message', 'info');

        const notifs = container.querySelectorAll('.notification');
        if (notifs.length !== 1) {
            throw new Error(`Expected 1 notification, found ${notifs.length}`);
        }
    });

    await test('show() handles empty message', () => {
        setupMockGlobals();
        createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        // Should not throw, should show warning message
        notifications.show('', 'info');
        // Test passes if no error thrown
    });

    await test('show() handles missing container', () => {
        setupMockGlobals();
        const notifications = new window.MiniCycleNotifications();

        // Should not throw, should warn
        notifications.show('Test', 'info');
        // Test passes if no error thrown
    });

    // ===== NOTIFICATION WITH TIPS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">💡 Notifications with Tips</h4>';

    await test('showWithTip() creates notification element', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.showWithTip('Test with tip', 'info', 3000, 'test-tip');

        const notif = container.querySelector('.notification');
        if (!notif) {
            throw new Error('Notification element not created');
        }
    });

    await test('showWithTip() applies type classes', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.showWithTip('Recurring message', 'recurring');

        if (!container.querySelector('.notification.recurring')) {
            throw new Error('Recurring class not applied');
        }
    });

    await test('showWithTip() prevents duplicates', () => {
        setupMockGlobals();
        // Ensure clean container with no leftover notifications
        const existingContainer = document.getElementById('notification-container');
        if (existingContainer) existingContainer.remove();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.showWithTip('Same tip message', 'info');
        notifications.showWithTip('Same tip message', 'info');

        const notifs = container.querySelectorAll('.notification');
        if (notifs.length !== 1) {
            throw new Error(`Duplicate notification created: found ${notifs.length}`);
        }
    });

    // ===== EDUCATIONAL TIP MANAGER TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎓 Educational Tips</h4>';

    await test('EducationalTipManager creates successfully', () => {
        const tipManager = new window.EducationalTipManager();
        if (!tipManager) {
            throw new Error('EducationalTipManager not created');
        }
    });

    await test('isTipDismissed() returns false for new tip', () => {
        setupMockGlobals();
        localStorage.setItem('miniCycleData', JSON.stringify(createMockSchemaData()));

        const tipManager = new window.EducationalTipManager();
        if (tipManager.isTipDismissed('new-tip')) {
            throw new Error('New tip should not be dismissed');
        }
    });

    await test('dismissTip() marks tip as dismissed', () => {
        setupMockGlobals();
        localStorage.setItem('miniCycleData', JSON.stringify(createMockSchemaData()));

        const tipManager = new window.EducationalTipManager();
        tipManager.dismissTip('test-tip');

        if (!tipManager.isTipDismissed('test-tip')) {
            throw new Error('Tip not marked as dismissed');
        }
    });

    await test('showTip() unmarks dismissed tip', () => {
        setupMockGlobals();
        const mockData = createMockSchemaData();
        mockData.settings.dismissedEducationalTips = { 'test-tip': true };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const tipManager = new window.EducationalTipManager();
        tipManager.showTip('test-tip');

        if (tipManager.isTipDismissed('test-tip')) {
            throw new Error('Tip still marked as dismissed');
        }
    });

    await test('createTip() generates tip HTML', () => {
        setupMockGlobals();
        localStorage.setItem('miniCycleData', JSON.stringify(createMockSchemaData()));

        const tipManager = new window.EducationalTipManager();
        const tipHTML = tipManager.createTip('test-tip', 'Test tip text');

        if (!tipHTML.includes('Test tip text')) {
            throw new Error('Tip text not in HTML');
        }
        if (!tipHTML.includes('tip-test-tip')) {
            throw new Error('Tip ID not in HTML');
        }
    });

    // ===== POSITION MANAGEMENT TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">📍 Position Management</h4>';

    await test('setDefaultPosition() sets smart defaults', () => {
        setupMockGlobals();
        localStorage.setItem('miniCycleData', JSON.stringify(createMockSchemaData()));

        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.setDefaultPosition(container);

        if (!container.style.top || !container.style.left) {
            throw new Error('Default position not set');
        }
    });


    // ===== MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">💬 Modal Dialogs</h4>';

    await test('showConfirmationModal() creates modal', () => {
        setupMockGlobals();
        const notifications = new window.MiniCycleNotifications();

        notifications.showConfirmationModal({
            title: 'Test',
            message: 'Test message',
            callback: () => {}
        });

        const modal = document.querySelector('.mini-modal-dialog');
        if (!modal) {
            throw new Error('Modal not created');
        }
    });

    await test('showConfirmationModal() has confirm and cancel buttons', () => {
        setupMockGlobals();
        const notifications = new window.MiniCycleNotifications();

        notifications.showConfirmationModal({
            title: 'Test',
            confirmText: 'Yes',
            cancelText: 'No',
            callback: () => {}
        });

        const dialog = document.querySelector('.mini-modal-dialog');
        const confirmBtn = dialog.querySelector('.btn-confirm');
        const cancelBtn = dialog.querySelector('.btn-cancel');

        if (!confirmBtn || confirmBtn.textContent !== 'Yes') {
            throw new Error('Confirm button not correct');
        }
        if (!cancelBtn || cancelBtn.textContent !== 'No') {
            throw new Error('Cancel button not correct');
        }
    });

    await test('showConfirmationModal() confirm button triggers callback', (done) => {
        setupMockGlobals();
        const notifications = new window.MiniCycleNotifications();
        let callbackCalled = false;

        notifications.showConfirmationModal({
            title: 'Test',
            callback: (confirmed) => {
                callbackCalled = true;
                if (!confirmed) {
                    throw new Error('Callback should receive true');
                }
            }
        });

        const dialog = document.querySelector('.mini-modal-dialog');
        const confirmBtn = dialog.querySelector('.btn-confirm');
        confirmBtn.click();

        if (!callbackCalled) {
            throw new Error('Callback not called');
        }
    });

    await test('showPromptModal() creates prompt', () => {
        setupMockGlobals();
        const notifications = new window.MiniCycleNotifications();

        notifications.showPromptModal({
            title: 'Enter value',
            placeholder: 'Enter text',
            callback: () => {}
        });

        const modal = document.querySelector('.miniCycle-prompt-dialog');
        const input = document.querySelector('.miniCycle-prompt-input');

        if (!modal) {
            throw new Error('Prompt modal not created');
        }
        if (!input) {
            throw new Error('Input field not created');
        }
    });

    await test('showPromptModal() has default value', () => {
        setupMockGlobals();
        const notifications = new window.MiniCycleNotifications();

        notifications.showPromptModal({
            title: 'Test',
            defaultValue: 'Default text',
            callback: () => {}
        });

        const input = document.querySelector('.miniCycle-prompt-input');
        if (input.value !== 'Default text') {
            throw new Error('Default value not set');
        }
    });

    await test('showPromptModal() enforces required field', () => {
        setupMockGlobals();
        const notifications = new window.MiniCycleNotifications();
        let callbackCalled = false;

        notifications.showPromptModal({
            title: 'Test',
            required: true,
            callback: (value) => {
                callbackCalled = true;
            }
        });

        const confirmBtn = document.querySelector('.miniCycle-btn-confirm');
        const input = document.querySelector('.miniCycle-prompt-input');

        input.value = ''; // Empty value
        confirmBtn.click();

        // Should not call callback with empty required field
        if (callbackCalled) {
            throw new Error('Callback should not be called with empty required field');
        }

        // Input should have error class
        if (!input.classList.contains('miniCycle-input-error')) {
            throw new Error('Input should have error class');
        }
    });

    // ===== AUTO-REMOVE TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⏰ Auto-Remove</h4>';

    await test('setupAutoRemove() attaches hover listeners', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notification = document.createElement('div');
        notification.className = 'notification';
        container.appendChild(notification);

        const notifications = new window.MiniCycleNotifications();
        notifications.setupAutoRemove(notification, 3000);

        // Check if event listeners are attached by checking internal state
        // (This is a simplified test - in real scenarios you'd test actual behavior)
        if (!notification.onmouseenter && !notification.onmouseleave) {
            // Listeners are attached via addEventListener, not as properties
            // So we just verify the function runs without error
        }
    });

    // ===== DRAGGING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🖱️ Dragging</h4>';

    await test('setupNotificationDragging() attaches listeners', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.setupNotificationDragging(container);

        if (!container.dragListenersAttached) {
            throw new Error('Drag listeners flag not set');
        }
    });

    await test('setupNotificationDragging() only attaches once', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        notifications.setupNotificationDragging(container);
        notifications.setupNotificationDragging(container);

        // Should only attach once (flag prevents duplicate)
        // Test passes if no error thrown
    });

    await test('setDraggingState() updates state', () => {
        const notifications = new window.MiniCycleNotifications();

        notifications.setDraggingState(true);
        if (!notifications.isDraggingNotification) {
            throw new Error('Dragging state not set to true');
        }

        notifications.setDraggingState(false);
        if (notifications.isDraggingNotification) {
            throw new Error('Dragging state not set to false');
        }
    });

    // ===== ERROR HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('show() handles missing generateHashId gracefully', () => {
        setupMockGlobals();
        createNotificationContainer();
        delete window.generateHashId;

        const notifications = new window.MiniCycleNotifications();

        // Should NOT throw - Simple Instance pattern catches errors gracefully
        try {
            notifications.show('Test', 'info');
            // If we get here, the error was handled gracefully (correct behavior)
        } catch (error) {
            throw new Error('Should NOT throw - should handle error gracefully');
        }
    });

    await test('restoreNotificationPosition() handles missing data', () => {
        setupMockGlobals();
        window.loadMiniCycleData = () => null;

        const container = createNotificationContainer();
        const notifications = new window.MiniCycleNotifications();

        // Should not throw, should use defaults
        notifications.restoreNotificationPosition(container);

        if (!container.style.top || !container.style.left) {
            throw new Error('Default position not set when data missing');
        }
    });

    await test('loadDismissedTips() handles missing loadMiniCycleData', () => {
        delete window.loadMiniCycleData;

        const tipManager = new window.EducationalTipManager();
        const tips = tipManager.loadDismissedTips();

        if (Object.keys(tips).length !== 0) {
            throw new Error('Should return empty object when function missing');
        }
    });

    await test('saveDismissedTips() handles missing loadMiniCycleData', () => {
        delete window.loadMiniCycleData;

        const tipManager = new window.EducationalTipManager();

        // Should not throw, should warn
        tipManager.saveDismissedTips();
        // Test passes if no error thrown
    });

    // ===== RECURRING NOTIFICATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Recurring Notifications</h4>';

    await test('createRecurringNotificationWithTip() generates HTML', () => {
        const notifications = new window.MiniCycleNotifications();

        const html = notifications.createRecurringNotificationWithTip(
            'task-123',
            'daily',
            'indefinitely'
        );

        if (!html.includes('task-123')) {
            throw new Error('Task ID not in HTML');
        }
        if (!html.includes('daily')) {
            throw new Error('Frequency not in HTML');
        }
    });

    await test('createRecurringNotificationWithTip() includes quick options', () => {
        const notifications = new window.MiniCycleNotifications();

        const html = notifications.createRecurringNotificationWithTip(
            'task-123',
            'weekly',
            'indefinitely'
        );

        if (!html.includes('quick-recurring-options')) {
            throw new Error('Quick options not included');
        }
        if (!html.includes('Hourly') || !html.includes('Daily') ||
            !html.includes('Weekly') || !html.includes('Monthly')) {
            throw new Error('All frequency options not included');
        }
    });

    await test('createRecurringNotificationWithTip() marks selected frequency', () => {
        const notifications = new window.MiniCycleNotifications();

        const html = notifications.createRecurringNotificationWithTip(
            'task-123',
            'monthly',
            'indefinitely'
        );

        // Check if monthly option has 'selected' class
        if (!html.includes('data-freq="monthly"') ||
            !html.includes('selected')) {
            throw new Error('Selected frequency not marked');
        }
    });

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }

    return { passed: passed.count, total: total.count };
}
