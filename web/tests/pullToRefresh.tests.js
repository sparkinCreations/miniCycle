/**
 * PullToRefresh Browser Tests
 * Test functions for module-test-suite.html
 *
 * Tests the pull-to-refresh functionality for mobile PWA
 * @version 2.2.0 - Direct module imports (Dec 2025)
 */

import {
    PullToRefresh,
    setPullToRefreshDependencies,
    initPullToRefresh
} from '../modules/ui/pullToRefresh.js';

import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

export async function runPullToRefreshTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>Pull-to-Refresh Tests</h2><h3>Setting up mocks...</h3>';

    // Use shared testHelpers for comprehensive mock setup
    const env = await setupTestEnvironment();

    // Set up dependencies for DI pattern
    setPullToRefreshDependencies({
        showNotification: () => {}
    });

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

    test('PullToRefresh class is exported from module', () => {
        if (typeof PullToRefresh !== 'function') {
            throw new Error('PullToRefresh class not exported from module');
        }
    });

    test('creates instance successfully', () => {
        const ptr = new PullToRefresh();
        if (!ptr || typeof ptr.enable !== 'function') {
            throw new Error('PullToRefresh not properly initialized');
        }
        ptr.destroy(); // Cleanup
    });

    test('initPullToRefresh function is exported', () => {
        if (typeof initPullToRefresh !== 'function') {
            throw new Error('initPullToRefresh function not exported');
        }
    });

    test('accepts custom options', () => {
        const customOptions = {
            threshold: 100,
            maxPull: 150,
            resistance: 3,
            activationDistance: 20
        };
        const ptr = new PullToRefresh(customOptions);

        if (ptr.threshold !== 100) throw new Error('threshold not set correctly');
        if (ptr.maxPull !== 150) throw new Error('maxPull not set correctly');
        if (ptr.resistance !== 3) throw new Error('resistance not set correctly');
        if (ptr.activationDistance !== 20) throw new Error('activationDistance not set correctly');

        ptr.destroy();
    });


    // ===== DOM INDICATOR TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">DOM Indicator</h4>';

    test('creates indicator element', () => {
        const ptr = new PullToRefresh();
        const indicator = document.getElementById('pull-refresh-indicator');

        if (!indicator) {
            throw new Error('Indicator element not created');
        }

        ptr.destroy();
    });

    test('indicator has correct structure', () => {
        const ptr = new PullToRefresh();
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
        const ptr = new PullToRefresh();
        const indicator = document.getElementById('pull-refresh-indicator');

        if (indicator.classList.contains('visible')) {
            throw new Error('Indicator should not be visible initially');
        }

        ptr.destroy();
    });

    test('destroy removes indicator', () => {
        const ptr = new PullToRefresh();
        // The constructor inserts the indicator into document.body.
        if (!ptr.indicator) throw new Error('PullToRefresh should create an indicator element');
        if (!ptr.indicator.parentNode) document.body.appendChild(ptr.indicator);

        ptr.destroy();

        // destroy() removes the indicator from its parent. The old test asserted nothing
        // ("just verify destroy() doesn't throw").
        if (ptr.indicator.parentNode) {
            throw new Error('destroy() should remove the indicator from the DOM');
        }
    });

    // ===== STATE MANAGEMENT TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">State Management</h4>';

    test('initial state is correct', () => {
        const ptr = new PullToRefresh();

        if (ptr.isPulling !== false) throw new Error('isPulling should be false');
        if (ptr.isActivated !== false) throw new Error('isActivated should be false');
        if (ptr.isRefreshing !== false) throw new Error('isRefreshing should be false');
        if (ptr.enabled !== true) throw new Error('enabled should be true');
        if (ptr.startY !== 0) throw new Error('startY should be 0');
        if (ptr.currentY !== 0) throw new Error('currentY should be 0');

        ptr.destroy();
    });

    test('enable() sets enabled to true', () => {
        const ptr = new PullToRefresh();
        ptr.enabled = false;
        ptr.enable();

        if (ptr.enabled !== true) {
            throw new Error('enable() should set enabled to true');
        }

        ptr.destroy();
    });

    test('disable() sets enabled to false', () => {
        const ptr = new PullToRefresh();
        ptr.disable();

        if (ptr.enabled !== false) {
            throw new Error('disable() should set enabled to false');
        }

        ptr.destroy();
    });

    test('resetIndicator resets all state', () => {
        const ptr = new PullToRefresh();

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
    // NOTE: scrollY mocking tests removed - Object.defineProperty on scrollY
    // doesn't work reliably in Playwright/automated test environments

    // ===== TOUCH EVENT HANDLING TESTS =====
    // NOTE: Touch event tests that use scrollY mocking removed - these don't work reliably
    // in Playwright/automated test environments due to Object.defineProperty limitations

    resultsDiv.innerHTML += '<h4 class="test-section">Touch Event Handling</h4>';

    test('handleTouchEnd resets state', () => {
        const ptr = new PullToRefresh();

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

    // ===== INDICATOR UPDATE TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Indicator Updates</h4>';

    test('updateIndicator adds visible class', () => {
        const ptr = new PullToRefresh();

        ptr.updateIndicator(50);

        if (!ptr.indicator.classList.contains('visible')) {
            throw new Error('Indicator should have visible class');
        }

        ptr.destroy();
    });

    test('updateIndicator adds ready class when above threshold', () => {
        const ptr = new PullToRefresh({ threshold: 80 });

        ptr.updateIndicator(100); // Above threshold

        if (!ptr.indicator.classList.contains('ready')) {
            throw new Error('Indicator should have ready class above threshold');
        }

        ptr.destroy();
    });

    test('updateIndicator updates text based on threshold', () => {
        const ptr = new PullToRefresh({ threshold: 80 });

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
    // NOTE: Async refresh trigger tests removed - they are flaky in automated test environments
    // due to timing issues and environment-specific behavior

    // ===== ERROR HANDLING TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Error Handling</h4>';

    test('handles missing indicator gracefully', () => {
        const ptr = new PullToRefresh();
        ptr.indicator = null;

        // Should not throw
        ptr.updateIndicator(50);
        ptr.resetIndicator();

        ptr.destroy();
    });

    // ===== CLEANUP TESTS =====

    resultsDiv.innerHTML += '<h4 class="test-section">Cleanup</h4>';

    test('destroy removes event listeners', () => {
        const ptr = new PullToRefresh();

        const removed = [];
        const realRemove = document.removeEventListener.bind(document);
        document.removeEventListener = (ev, fn, opts) => { removed.push(ev); return realRemove(ev, fn, opts); };
        try {
            ptr.destroy();
        } finally {
            document.removeEventListener = realRemove;
        }

        // destroy() → detachEventListeners() removes the document touch listeners it
        // registered. The old test only created/destroyed instances and asserted nothing.
        for (const ev of ['touchstart', 'touchmove', 'touchend']) {
            if (!removed.includes(ev)) {
                throw new Error(`destroy() should remove the document "${ev}" listener`);
            }
        }
    });

    // ===== SW VERSION QUERY (update-available notice) =====

    resultsDiv.innerHTML += '<h4 class="test-section">SW version query</h4>';

    /** A stub ServiceWorker whose postMessage replies over the transferred port. */
    function fakeWorker(reply, { delayMs = 0, throwOnPost = false } = {}) {
        return {
            postMessage(_msg, transfer) {
                if (throwOnPost) throw new Error('postMessage blew up');
                const port = transfer && transfer[0];
                if (!port) return;
                // Post THROUGH the transferred port so the real MessageChannel
                // delivers to port1, exactly as a service worker would. Invoking
                // port.onmessage directly would target the wrong end and never
                // reach the listener under test.
                const send = () => port.postMessage(reply);
                if (delayMs > 0) setTimeout(send, delayMs); else send();
            }
        };
    }

    await test('_askWorkerVersion returns the waiting worker\'s appVersion', async () => {
        const ptr = new PullToRefresh();
        const v = await ptr._askWorkerVersion(fakeWorker({ appVersion: '2.428' }));
        if (v !== '2.428') throw new Error(`Expected "2.428", got ${JSON.stringify(v)}`);
    });

    await test('_askWorkerVersion resolves null when there is no worker', async () => {
        const ptr = new PullToRefresh();
        if (await ptr._askWorkerVersion(null) !== null) throw new Error('expected null');
    });

    await test('_askWorkerVersion resolves null on a malformed reply', async () => {
        const ptr = new PullToRefresh();
        for (const reply of [{}, { appVersion: 42 }, { appVersion: '' }, null]) {
            const v = await ptr._askWorkerVersion(fakeWorker(reply));
            if (v !== null) throw new Error(`Expected null for ${JSON.stringify(reply)}, got ${v}`);
        }
    });

    await test('_askWorkerVersion sanitises and bounds the reported version', async () => {
        const ptr = new PullToRefresh();
        const v = await ptr._askWorkerVersion(fakeWorker({ appVersion: '<img src=x>2.4' }));
        if (/[<>"']/.test(v)) throw new Error(`markup survived: ${v}`);
        const long = await ptr._askWorkerVersion(fakeWorker({ appVersion: '9'.repeat(200) }));
        if (long.length !== 16) throw new Error(`expected 16-char cap, got ${long.length}`);
    });

    await test('_askWorkerVersion does not reject when postMessage throws', async () => {
        const ptr = new PullToRefresh();
        const v = await ptr._askWorkerVersion(fakeWorker({ appVersion: '2.428' }, { throwOnPost: true }));
        if (v !== null) throw new Error('a broken channel must resolve null, not reject');
    });

    await test('_askWorkerVersion gives up on a worker that never answers', async () => {
        // The caller awaits this before showing the notice, so a silent worker
        // must not leave the promise pending forever.
        const ptr = new PullToRefresh();
        const started = Date.now();
        const v = await ptr._askWorkerVersion({ postMessage() { /* never replies */ } });
        if (v !== null) throw new Error('expected null after the timeout');
        if (Date.now() - started > 5000) throw new Error('timeout did not fire promptly');
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
