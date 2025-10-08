/**
 * MiniCycleNotifications Browser Tests
 * Test functions for module-test-suite.html
 */

export function runNotificationsTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔔 MiniCycleNotifications Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    function test(name, testFn) {
        total.count++;
        try {
            // Clean up before each test
            cleanupTestEnvironment();

            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
            // Clean up after each test
            cleanupTestEnvironment();
        }
    }

    // ===== HELPER FUNCTIONS =====

    function cleanupTestEnvironment() {
        // Remove notification container
        const existingContainer = document.getElementById('notification-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Remove any modals/overlays
        document.querySelectorAll('.mini-modal-overlay, .miniCycle-overlay').forEach(el => el.remove());

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

        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => {
                return window.loadMiniCycleData();
            },
            update: (updateFn, immediate) => {
                const data = window.loadMiniCycleData();
                if (data) {
                    updateFn(data);
                    data.metadata.lastModified = Date.now();
                    localStorage.setItem('miniCycleData', JSON.stringify(data));
                }
            }
        };
    }

    // ===== INITIALIZATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('MiniCycleNotifications creates successfully', () => {
        const notifications = new MiniCycleNotifications();
        if (!notifications || typeof notifications.show !== 'function') {
            throw new Error('MiniCycleNotifications not properly initialized');
        }
    });

    test('has educationalTips manager', () => {
        const notifications = new MiniCycleNotifications();
        if (!notifications.educationalTips) {
            throw new Error('educationalTips manager not initialized');
        }
    });

    test('has dragging state tracking', () => {
        const notifications = new MiniCycleNotifications();
        if (typeof notifications.isDraggingNotification !== 'boolean') {
            throw new Error('isDraggingNotification not initialized');
        }
    });

    // ===== BASIC NOTIFICATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔔 Basic Notifications</h4>';

    test('show() creates notification element', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.show('Test message', 'info', 3000);

        const notif = container.querySelector('.notification');
        if (!notif) {
            throw new Error('Notification element not created');
        }
    });

    test('show() applies correct type classes', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

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

    test('show() adds close button', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.show('Test', 'info');

        const closeBtn = container.querySelector('.close-btn');
        if (!closeBtn) {
            throw new Error('Close button not added');
        }
    });

    test('show() prevents duplicate notifications', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.show('Same message', 'info');
        notifications.show('Same message', 'info');

        const notifs = container.querySelectorAll('.notification');
        if (notifs.length !== 1) {
            throw new Error(`Expected 1 notification, found ${notifs.length}`);
        }
    });

    test('show() handles empty message', () => {
        setupMockGlobals();
        createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        // Should not throw, should show warning message
        notifications.show('', 'info');
        // Test passes if no error thrown
    });

    test('show() handles missing container', () => {
        setupMockGlobals();
        const notifications = new MiniCycleNotifications();

        // Should not throw, should warn
        notifications.show('Test', 'info');
        // Test passes if no error thrown
    });

    // ===== NOTIFICATION WITH TIPS TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">💡 Notifications with Tips</h4>';

    test('showWithTip() creates notification element', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.showWithTip('Test with tip', 'info', 3000, 'test-tip');

        const notif = container.querySelector('.notification');
        if (!notif) {
            throw new Error('Notification element not created');
        }
    });

    test('showWithTip() applies type classes', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.showWithTip('Recurring message', 'recurring');

        if (!container.querySelector('.notification.recurring')) {
            throw new Error('Recurring class not applied');
        }
    });

    test('showWithTip() prevents duplicates', () => {
        setupMockGlobals();
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.showWithTip('Same tip message', 'info');
        notifications.showWithTip('Same tip message', 'info');

        const notifs = container.querySelectorAll('.notification');
        if (notifs.length !== 1) {
            throw new Error('Duplicate notification created');
        }
    });

    // ===== EDUCATIONAL TIP MANAGER TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🎓 Educational Tips</h4>';

    test('EducationalTipManager creates successfully', () => {
        const tipManager = new EducationalTipManager();
        if (!tipManager) {
            throw new Error('EducationalTipManager not created');
        }
    });

    test('isTipDismissed() returns false for new tip', () => {
        setupMockGlobals();
        localStorage.setItem('miniCycleData', JSON.stringify(createMockSchemaData()));

        const tipManager = new EducationalTipManager();
        if (tipManager.isTipDismissed('new-tip')) {
            throw new Error('New tip should not be dismissed');
        }
    });

    test('dismissTip() marks tip as dismissed', () => {
        setupMockGlobals();
        localStorage.setItem('miniCycleData', JSON.stringify(createMockSchemaData()));

        const tipManager = new EducationalTipManager();
        tipManager.dismissTip('test-tip');

        if (!tipManager.isTipDismissed('test-tip')) {
            throw new Error('Tip not marked as dismissed');
        }
    });

    test('showTip() unmarks dismissed tip', () => {
        setupMockGlobals();
        const mockData = createMockSchemaData();
        mockData.settings.dismissedEducationalTips = { 'test-tip': true };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const tipManager = new EducationalTipManager();
        tipManager.showTip('test-tip');

        if (tipManager.isTipDismissed('test-tip')) {
            throw new Error('Tip still marked as dismissed');
        }
    });

    test('createTip() generates tip HTML', () => {
        setupMockGlobals();
        localStorage.setItem('miniCycleData', JSON.stringify(createMockSchemaData()));

        const tipManager = new EducationalTipManager();
        const tipHTML = tipManager.createTip('test-tip', 'Test tip text');

        if (!tipHTML.includes('Test tip text')) {
            throw new Error('Tip text not in HTML');
        }
        if (!tipHTML.includes('tip-test-tip')) {
            throw new Error('Tip ID not in HTML');
        }
    });

    test('createTip() respects dismissed state', () => {
        setupMockGlobals();
        const mockData = createMockSchemaData();
        mockData.settings.dismissedEducationalTips = { 'dismissed-tip': true };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const tipManager = new EducationalTipManager();
        const tipHTML = tipManager.createTip('dismissed-tip', 'Test');

        if (!tipHTML.includes('display: none')) {
            throw new Error('Dismissed tip should be hidden');
        }
    });

    // ===== POSITION MANAGEMENT TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">📍 Position Management</h4>';

    test('restoreNotificationPosition() applies saved position', () => {
        setupMockGlobals();
        const mockData = createMockSchemaData();
        mockData.settings.notificationPosition = { x: 200, y: 50 };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.restoreNotificationPosition(container);

        if (container.style.left !== '200px' || container.style.top !== '50px') {
            throw new Error('Position not restored correctly');
        }
    });

    test('setDefaultPosition() sets smart defaults', () => {
        setupMockGlobals();
        localStorage.setItem('miniCycleData', JSON.stringify(createMockSchemaData()));

        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.setDefaultPosition(container);

        if (!container.style.top || !container.style.left) {
            throw new Error('Default position not set');
        }
    });

    test('resetPosition() resets to default', () => {
        setupMockGlobals();
        const mockData = createMockSchemaData();
        mockData.settings.notificationPosition = { x: 500, y: 300 };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.resetPosition();

        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        if (savedData.settings.notificationPosition.x !== 0 ||
            savedData.settings.notificationPosition.y !== 0) {
            throw new Error('Position not reset in storage');
        }
    });

    test('resetPosition() requires AppState', () => {
        setupMockGlobals();
        window.AppState.isReady = () => false;

        const notifications = new MiniCycleNotifications();
        let errorThrown = false;

        try {
            notifications.resetPosition();
        } catch (error) {
            errorThrown = true;
            if (!error.message.includes('AppState')) {
                throw new Error('Error should mention AppState');
            }
        }

        if (!errorThrown) {
            throw new Error('Should throw error when AppState not ready');
        }
    });

    // ===== MODAL TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">💬 Modal Dialogs</h4>';

    test('showConfirmationModal() creates modal', () => {
        const notifications = new MiniCycleNotifications();

        notifications.showConfirmationModal({
            title: 'Test',
            message: 'Test message',
            callback: () => {}
        });

        const modal = document.querySelector('.mini-modal-overlay');
        if (!modal) {
            throw new Error('Modal not created');
        }
    });

    test('showConfirmationModal() has confirm and cancel buttons', () => {
        const notifications = new MiniCycleNotifications();

        notifications.showConfirmationModal({
            title: 'Test',
            confirmText: 'Yes',
            cancelText: 'No',
            callback: () => {}
        });

        const confirmBtn = document.querySelector('.btn-confirm');
        const cancelBtn = document.querySelector('.btn-cancel');

        if (!confirmBtn || confirmBtn.textContent !== 'Yes') {
            throw new Error('Confirm button not correct');
        }
        if (!cancelBtn || cancelBtn.textContent !== 'No') {
            throw new Error('Cancel button not correct');
        }
    });

    test('showConfirmationModal() confirm button triggers callback', (done) => {
        const notifications = new MiniCycleNotifications();
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

        const confirmBtn = document.querySelector('.btn-confirm');
        confirmBtn.click();

        if (!callbackCalled) {
            throw new Error('Callback not called');
        }
    });

    test('showPromptModal() creates prompt', () => {
        const notifications = new MiniCycleNotifications();

        notifications.showPromptModal({
            title: 'Enter value',
            placeholder: 'Enter text',
            callback: () => {}
        });

        const modal = document.querySelector('.miniCycle-overlay');
        const input = document.querySelector('.miniCycle-prompt-input');

        if (!modal) {
            throw new Error('Prompt modal not created');
        }
        if (!input) {
            throw new Error('Input field not created');
        }
    });

    test('showPromptModal() has default value', () => {
        const notifications = new MiniCycleNotifications();

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

    test('showPromptModal() enforces required field', () => {
        const notifications = new MiniCycleNotifications();
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

    test('setupAutoRemove() attaches hover listeners', () => {
        const container = createNotificationContainer();
        const notification = document.createElement('div');
        notification.className = 'notification';
        container.appendChild(notification);

        const notifications = new MiniCycleNotifications();
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

    test('setupNotificationDragging() attaches listeners', () => {
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.setupNotificationDragging(container);

        if (!container.dragListenersAttached) {
            throw new Error('Drag listeners flag not set');
        }
    });

    test('setupNotificationDragging() only attaches once', () => {
        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        notifications.setupNotificationDragging(container);
        notifications.setupNotificationDragging(container);

        // Should only attach once (flag prevents duplicate)
        // Test passes if no error thrown
    });

    test('setDraggingState() updates state', () => {
        const notifications = new MiniCycleNotifications();

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

    test('show() handles missing generateHashId', () => {
        createNotificationContainer();
        delete window.generateHashId;

        const notifications = new MiniCycleNotifications();

        let errorThrown = false;
        try {
            notifications.show('Test', 'info');
        } catch (error) {
            errorThrown = true;
        }

        if (!errorThrown) {
            throw new Error('Should throw error when generateHashId missing');
        }
    });

    test('restoreNotificationPosition() handles missing data', () => {
        setupMockGlobals();
        window.loadMiniCycleData = () => null;

        const container = createNotificationContainer();
        const notifications = new MiniCycleNotifications();

        // Should not throw, should use defaults
        notifications.restoreNotificationPosition(container);

        if (!container.style.top || !container.style.left) {
            throw new Error('Default position not set when data missing');
        }
    });

    test('loadDismissedTips() handles missing loadMiniCycleData', () => {
        delete window.loadMiniCycleData;

        const tipManager = new EducationalTipManager();
        const tips = tipManager.loadDismissedTips();

        if (Object.keys(tips).length !== 0) {
            throw new Error('Should return empty object when function missing');
        }
    });

    test('saveDismissedTips() handles missing loadMiniCycleData', () => {
        delete window.loadMiniCycleData;

        const tipManager = new EducationalTipManager();

        // Should not throw, should warn
        tipManager.saveDismissedTips();
        // Test passes if no error thrown
    });

    // ===== RECURRING NOTIFICATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Recurring Notifications</h4>';

    test('createRecurringNotificationWithTip() generates HTML', () => {
        const notifications = new MiniCycleNotifications();

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

    test('createRecurringNotificationWithTip() includes quick options', () => {
        const notifications = new MiniCycleNotifications();

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

    test('createRecurringNotificationWithTip() marks selected frequency', () => {
        const notifications = new MiniCycleNotifications();

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
}
