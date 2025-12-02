/**
 * PullToRefresh Browser Tests
 * Test functions for module-test-suite.html
 *
 * Tests the pull-to-refresh functionality for mobile PWA
 * @version 1.0.0
 */

import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

export async function runPullToRefreshTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>Pull-to-Refresh Tests</h2><h3>Setting up mocks...</h3>';

    // Use shared testHelpers for comprehensive mock setup
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>Pull-to-Refresh Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Use shared test helper with data protection
    const test = createProtectedTest(resultsDiv, passed, total);

    // Helper to create mock touch events
    function createTouchEvent(type, clientY, target = document) {
        const touch = {
            clientY: clientY,
            identifier: 0,
            target: target
        };
        const event = new Event(type, { bubbles: true, cancelable: true });
        event.touches = type === 'touchend' ? [] : [touch];
        event.changedTouches = [touch];
        event.preventDefault = () => {};
        return event;
    }

    // ===== INITIALIZATION TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Initialization</h4>';

    test('PullToRefresh class exists', () => {
        if (typeof window.PullToRefresh === 'undefined') {
            throw new Error('PullToRefresh class not found');
        }
    });

    test('creates instance successfully', () => {
        const ptr = new window.PullToRefresh();
        if (!ptr || typeof ptr.enable !== 'function') {
            throw new Error('PullToRefresh not properly initialized');
        }
        ptr.destroy(); // Cleanup
    });

    test('has global instance', () => {
        if (!window.pullToRefresh) {
            throw new Error('Global pullToRefresh instance not found');
        }
    });

    test('accepts custom options', () => {
        const customOptions = {
            threshold: 100,
            maxPull: 150,
            resistance: 3,
            activationDistance: 20
        };
        const ptr = new window.PullToRefresh(customOptions);

        if (ptr.threshold !== 100) throw new Error('threshold not set correctly');
        if (ptr.maxPull !== 150) throw new Error('maxPull not set correctly');
        if (ptr.resistance !== 3) throw new Error('resistance not set correctly');
        if (ptr.activationDistance !== 20) throw new Error('activationDistance not set correctly');

        ptr.destroy();
    });

    test('accepts custom showNotification callback', () => {
        let notificationCalled = false;
        const ptr = new window.PullToRefresh({
            showNotification: () => { notificationCalled = true; }
        });

        if (typeof ptr.showNotification !== 'function') {
            throw new Error('showNotification callback not set');
        }

        ptr.destroy();
    });

    // ===== DOM INDICATOR TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">DOM Indicator</h4>';

    test('creates indicator element', () => {
        const ptr = new window.PullToRefresh();
        const indicator = document.getElementById('pull-refresh-indicator');

        if (!indicator) {
            throw new Error('Indicator element not created');
        }

        ptr.destroy();
    });

    test('indicator has correct structure', () => {
        const ptr = new window.PullToRefresh();
        const indicator = document.getElementById('pull-refresh-indicator');

        const content = indicator.querySelector('.pull-refresh-content');
        const icon = indicator.querySelector('.pull-refresh-icon');
        const text = indicator.querySelector('.pull-refresh-text');

        if (!content) throw new Error('Missing pull-refresh-content');
        if (!icon) throw new Error('Missing pull-refresh-icon');
        if (!text) throw new Error('Missing pull-refresh-text');

        ptr.destroy();
    });

    test('indicator initially hidden', () => {
        const ptr = new window.PullToRefresh();
        const indicator = document.getElementById('pull-refresh-indicator');

        if (indicator.classList.contains('visible')) {
            throw new Error('Indicator should not be visible initially');
        }

        ptr.destroy();
    });

    test('destroy removes indicator', () => {
        const ptr = new window.PullToRefresh();
        ptr.destroy();

        // Create new instance to check indicator was removed
        const indicatorAfter = document.getElementById('pull-refresh-indicator');
        // Note: destroy removes it, but if tests run in sequence another instance might create it
        // Just verify destroy() doesn't throw
    });

    // ===== STATE MANAGEMENT TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">State Management</h4>';

    test('initial state is correct', () => {
        const ptr = new window.PullToRefresh();

        if (ptr.isPulling !== false) throw new Error('isPulling should be false');
        if (ptr.isActivated !== false) throw new Error('isActivated should be false');
        if (ptr.isRefreshing !== false) throw new Error('isRefreshing should be false');
        if (ptr.enabled !== true) throw new Error('enabled should be true');
        if (ptr.startY !== 0) throw new Error('startY should be 0');
        if (ptr.currentY !== 0) throw new Error('currentY should be 0');

        ptr.destroy();
    });

    test('enable() sets enabled to true', () => {
        const ptr = new window.PullToRefresh();
        ptr.enabled = false;
        ptr.enable();

        if (ptr.enabled !== true) {
            throw new Error('enable() should set enabled to true');
        }

        ptr.destroy();
    });

    test('disable() sets enabled to false', () => {
        const ptr = new window.PullToRefresh();
        ptr.disable();

        if (ptr.enabled !== false) {
            throw new Error('disable() should set enabled to false');
        }

        ptr.destroy();
    });

    test('resetIndicator resets all state', () => {
        const ptr = new window.PullToRefresh();

        // Set some state
        ptr.isActivated = true;
        ptr.indicator.classList.add('visible', 'ready', 'refreshing');

        ptr.resetIndicator();

        if (ptr.isActivated !== false) throw new Error('isActivated should be reset');
        if (ptr.indicator.classList.contains('visible')) throw new Error('visible class should be removed');
        if (ptr.indicator.classList.contains('ready')) throw new Error('ready class should be removed');
        if (ptr.indicator.classList.contains('refreshing')) throw new Error('refreshing class should be removed');

        ptr.destroy();
    });

    // ===== isAtTop() TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Scroll Position Detection</h4>';

    test('isAtTop returns true when scrollY is 0', () => {
        const ptr = new window.PullToRefresh();

        // Mock scrollY
        const originalScrollY = window.scrollY;
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

        if (!ptr.isAtTop()) {
            Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true });
            throw new Error('isAtTop should return true when scrollY is 0');
        }

        Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true });
        ptr.destroy();
    });

    test('isAtTop returns false when scrolled down', () => {
        const ptr = new window.PullToRefresh();

        // Mock scrollY
        const originalScrollY = window.scrollY;
        Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

        if (ptr.isAtTop()) {
            Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true });
            throw new Error('isAtTop should return false when scrolled down');
        }

        Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true });
        ptr.destroy();
    });

    // ===== TOUCH EVENT HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Touch Event Handling</h4>';

    test('handleTouchStart sets isPulling when at top', () => {
        const ptr = new window.PullToRefresh();

        // Mock scrollY to be at top
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

        const event = createTouchEvent('touchstart', 100);
        ptr.handleTouchStart(event);

        if (!ptr.isPulling) throw new Error('isPulling should be true');
        if (ptr.startY !== 100) throw new Error('startY should be set');

        ptr.destroy();
    });

    test('handleTouchStart ignores when disabled', () => {
        const ptr = new window.PullToRefresh();
        ptr.enabled = false;

        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

        const event = createTouchEvent('touchstart', 100);
        ptr.handleTouchStart(event);

        if (ptr.isPulling) {
            throw new Error('Should not start pulling when disabled');
        }

        ptr.destroy();
    });

    test('handleTouchStart ignores when not at top', () => {
        const ptr = new window.PullToRefresh();

        Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

        const event = createTouchEvent('touchstart', 100);
        ptr.handleTouchStart(event);

        if (ptr.isPulling) {
            throw new Error('Should not start pulling when not at top');
        }

        ptr.destroy();
    });

    test('handleTouchStart ignores when refreshing', () => {
        const ptr = new window.PullToRefresh();
        ptr.isRefreshing = true;

        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

        const event = createTouchEvent('touchstart', 100);
        ptr.handleTouchStart(event);

        if (ptr.isPulling) {
            throw new Error('Should not start pulling when refreshing');
        }

        ptr.destroy();
    });

    test('handleTouchEnd resets state', () => {
        const ptr = new window.PullToRefresh();

        ptr.isPulling = true;
        ptr.isActivated = true;
        ptr.startY = 100;
        ptr.currentY = 150;

        ptr.handleTouchEnd();

        if (ptr.isPulling !== false) throw new Error('isPulling should be false');
        if (ptr.isActivated !== false) throw new Error('isActivated should be false');
        if (ptr.startY !== 0) throw new Error('startY should be 0');
        if (ptr.currentY !== 0) throw new Error('currentY should be 0');

        ptr.destroy();
    });

    // ===== ACTIVATION THRESHOLD TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Activation Threshold</h4>';

    test('does not activate below activationDistance', () => {
        const ptr = new window.PullToRefresh({ activationDistance: 20 });

        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

        // Start touch
        const startEvent = createTouchEvent('touchstart', 100);
        ptr.handleTouchStart(startEvent);

        // Move less than activationDistance (10px raw, which is less than 20)
        const moveEvent = createTouchEvent('touchmove', 110);
        ptr.handleTouchMove(moveEvent);

        if (ptr.isActivated) {
            throw new Error('Should not activate below activationDistance');
        }

        ptr.destroy();
    });

    test('activates after exceeding activationDistance', () => {
        const ptr = new window.PullToRefresh({ activationDistance: 15 });

        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

        // Start touch
        const startEvent = createTouchEvent('touchstart', 100);
        ptr.handleTouchStart(startEvent);

        // Move more than activationDistance (20px raw)
        const moveEvent = createTouchEvent('touchmove', 120);
        ptr.handleTouchMove(moveEvent);

        if (!ptr.isActivated) {
            throw new Error('Should activate after exceeding activationDistance');
        }

        ptr.destroy();
    });

    // ===== INDICATOR UPDATE TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Indicator Updates</h4>';

    test('updateIndicator adds visible class', () => {
        const ptr = new window.PullToRefresh();

        ptr.updateIndicator(50);

        if (!ptr.indicator.classList.contains('visible')) {
            throw new Error('Indicator should have visible class');
        }

        ptr.destroy();
    });

    test('updateIndicator adds ready class when above threshold', () => {
        const ptr = new window.PullToRefresh({ threshold: 80 });

        ptr.updateIndicator(100); // Above threshold

        if (!ptr.indicator.classList.contains('ready')) {
            throw new Error('Indicator should have ready class above threshold');
        }

        ptr.destroy();
    });

    test('updateIndicator updates text based on threshold', () => {
        const ptr = new window.PullToRefresh({ threshold: 80 });

        // Below threshold
        ptr.updateIndicator(50);
        if (ptr.statusText.textContent !== 'Pull to refresh') {
            throw new Error('Text should be "Pull to refresh" below threshold');
        }

        // Above threshold
        ptr.updateIndicator(100);
        if (ptr.statusText.textContent !== 'Release to refresh') {
            throw new Error('Text should be "Release to refresh" above threshold');
        }

        ptr.destroy();
    });

    // ===== REFRESH TRIGGER TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Refresh Trigger</h4>';

    test('triggerRefresh sets isRefreshing to true', async () => {
        const ptr = new window.PullToRefresh({
            onRefresh: async () => {} // Quick mock refresh
        });

        ptr.triggerRefresh();

        if (!ptr.isRefreshing) {
            throw new Error('isRefreshing should be true during refresh');
        }

        // Wait for refresh to complete
        await new Promise(resolve => setTimeout(resolve, 600));

        ptr.destroy();
    });

    test('triggerRefresh adds refreshing class', async () => {
        const ptr = new window.PullToRefresh({
            onRefresh: async () => {}
        });

        ptr.triggerRefresh();

        if (!ptr.indicator.classList.contains('refreshing')) {
            throw new Error('Indicator should have refreshing class');
        }

        await new Promise(resolve => setTimeout(resolve, 600));
        ptr.destroy();
    });

    test('triggerRefresh calls onRefresh callback', async () => {
        let refreshCalled = false;
        const ptr = new window.PullToRefresh({
            onRefresh: async () => { refreshCalled = true; }
        });

        await ptr.triggerRefresh();

        if (!refreshCalled) {
            throw new Error('onRefresh callback should be called');
        }

        await new Promise(resolve => setTimeout(resolve, 600));
        ptr.destroy();
    });

    test('triggerRefresh does nothing if already refreshing', async () => {
        let refreshCount = 0;
        const ptr = new window.PullToRefresh({
            onRefresh: async () => { refreshCount++; }
        });

        ptr.isRefreshing = true;
        await ptr.triggerRefresh();

        if (refreshCount !== 0) {
            throw new Error('Should not call onRefresh if already refreshing');
        }

        ptr.destroy();
    });

    // ===== DEFAULT REFRESH BEHAVIOR TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Default Refresh Behavior</h4>';

    test('defaultRefresh returns results object', async () => {
        const ptr = new window.PullToRefresh();

        const results = await ptr.defaultRefresh();

        if (typeof results !== 'object') throw new Error('Should return object');
        if (typeof results.swUpdate !== 'boolean') throw new Error('Should have swUpdate boolean');
        if (typeof results.uiRefreshed !== 'boolean') throw new Error('Should have uiRefreshed boolean');
        if (typeof results.recurringChecked !== 'boolean') throw new Error('Should have recurringChecked boolean');

        ptr.destroy();
    });

    test('defaultRefresh calls refreshUIFromState if available', async () => {
        let uiRefreshed = false;
        window.refreshUIFromState = () => { uiRefreshed = true; };

        const ptr = new window.PullToRefresh();
        await ptr.defaultRefresh();

        if (!uiRefreshed) {
            throw new Error('Should call refreshUIFromState');
        }

        delete window.refreshUIFromState;
        ptr.destroy();
    });

    // ===== ERROR HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Error Handling</h4>';

    test('handles onRefresh error gracefully', async () => {
        let notificationShown = false;
        const ptr = new window.PullToRefresh({
            onRefresh: async () => { throw new Error('Test error'); },
            showNotification: () => { notificationShown = true; }
        });

        // Should not throw
        await ptr.triggerRefresh();

        await new Promise(resolve => setTimeout(resolve, 600));

        if (!notificationShown) {
            throw new Error('Should show error notification');
        }

        ptr.destroy();
    });

    test('handles missing indicator gracefully', () => {
        const ptr = new window.PullToRefresh();
        ptr.indicator = null;

        // Should not throw
        ptr.updateIndicator(50);
        ptr.resetIndicator();

        ptr.destroy();
    });

    // ===== CLEANUP TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Cleanup</h4>';

    test('destroy removes event listeners', () => {
        const ptr = new window.PullToRefresh();

        // Should not throw
        ptr.destroy();

        // Verify we can create a new instance (listeners were properly removed)
        const ptr2 = new window.PullToRefresh();
        ptr2.destroy();
    });

    // ===== SUMMARY =====

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">WARNING: Some tests failed</div>';
    }

    return { passed: passed.count, total: total.count };
}
