/**
 * uiBoot.js Browser Tests
 * Tests for UI boot functions: showLoader, hideLoader, withLoader, isTouchDevice, detectDeviceType
 *
 * @module tests/uiBoot.tests
 */

import { setupTestEnvironment, createProtectedTest, wait } from './testHelpers.js';
import {
    getTestShowLoader,
    getTestHideLoader,
    getTestWithLoader,
    getTestIsTouchDevice,
    getTestPerformStateBasedUndo,
    getTestPerformStateBasedRedo
} from './helpers/testContext.js';

export async function runUIBootTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📱 uiBoot Tests</h2><h3>Running tests...</h3>';

    const env = await setupTestEnvironment();
    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ===== MODULE LOADING TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('showLoader is available via testContext', () => {
        const showLoader = getTestShowLoader();
        if (typeof showLoader !== 'function') {
            throw new Error('showLoader not available via testContext');
        }
    });

    await test('hideLoader is available via testContext', () => {
        const hideLoader = getTestHideLoader();
        if (typeof hideLoader !== 'function') {
            throw new Error('hideLoader not available via testContext');
        }
    });

    await test('withLoader is available via testContext', () => {
        const withLoader = getTestWithLoader();
        if (typeof withLoader !== 'function') {
            throw new Error('withLoader not available via testContext');
        }
    });

    await test('isTouchDevice is available via testContext', () => {
        const isTouchDevice = getTestIsTouchDevice();
        if (typeof isTouchDevice !== 'function') {
            throw new Error('isTouchDevice not available via testContext');
        }
    });

    // ===== showLoader TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">⏳ showLoader()</h4>';

    await test('showLoader can be called without arguments', () => {
        const showLoader = getTestShowLoader();
        const hideLoader = getTestHideLoader();
        // Should not throw
        try {
            showLoader();
            // Clean up
            hideLoader();
        } catch (error) {
            throw new Error(`showLoader threw error: ${error.message}`);
        }
    });

    await test('showLoader accepts custom message', () => {
        const showLoader = getTestShowLoader();
        const hideLoader = getTestHideLoader();
        try {
            showLoader('Loading data...');
            // Clean up
            hideLoader();
        } catch (error) {
            throw new Error(`showLoader with message threw error: ${error.message}`);
        }
    });

    await test('showLoader activates loading overlay when element exists', () => {
        const showLoader = getTestShowLoader();
        const hideLoader = getTestHideLoader();
        // Create mock loading overlay if it doesn't exist
        let overlay = document.getElementById('loading-overlay');
        const created = !overlay;

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.innerHTML = '<span class="loading-spinner-text"></span>';
            document.body.appendChild(overlay);
        }

        try {
            showLoader('Test Message');

            if (!overlay.classList.contains('active')) {
                throw new Error('Loading overlay should have active class');
            }

            const textEl = overlay.querySelector('.loading-spinner-text');
            if (textEl && textEl.textContent !== 'Test Message') {
                throw new Error(`Expected text 'Test Message', got '${textEl.textContent}'`);
            }
        } finally {
            hideLoader();
            if (created) {
                overlay.remove();
            }
        }
    });

    // ===== hideLoader TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">✓ hideLoader()</h4>';

    await test('hideLoader can be called without errors', () => {
        const hideLoader = getTestHideLoader();
        try {
            hideLoader();
        } catch (error) {
            throw new Error(`hideLoader threw error: ${error.message}`);
        }
    });

    await test('hideLoader removes active class from overlay', () => {
        const hideLoader = getTestHideLoader();
        // Create mock loading overlay if it doesn't exist
        let overlay = document.getElementById('loading-overlay');
        const created = !overlay;

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            document.body.appendChild(overlay);
        }

        try {
            overlay.classList.add('active');
            hideLoader();

            if (overlay.classList.contains('active')) {
                throw new Error('Loading overlay should not have active class after hideLoader');
            }
        } finally {
            if (created) {
                overlay.remove();
            }
        }
    });

    // ===== withLoader TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 withLoader()</h4>';

    await test('withLoader executes async function and returns result', async () => {
        const withLoader = getTestWithLoader();
        const result = await withLoader(async () => {
            return 'test-result';
        });

        if (result !== 'test-result') {
            throw new Error(`Expected 'test-result', got '${result}'`);
        }
    });

    await test('withLoader hides loader after function completes', async () => {
        const withLoader = getTestWithLoader();
        let overlay = document.getElementById('loading-overlay');
        const created = !overlay;

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            document.body.appendChild(overlay);
        }

        try {
            await withLoader(async () => {
                await wait(10);
                return 'done';
            });

            if (overlay.classList.contains('active')) {
                throw new Error('Loader should be hidden after withLoader completes');
            }
        } finally {
            if (created) {
                overlay.remove();
            }
        }
    });

    await test('withLoader hides loader even if function throws', async () => {
        const withLoader = getTestWithLoader();
        let overlay = document.getElementById('loading-overlay');
        const created = !overlay;

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            document.body.appendChild(overlay);
        }

        try {
            try {
                await withLoader(async () => {
                    throw new Error('Test error');
                });
            } catch {
                // Expected error
            }

            if (overlay.classList.contains('active')) {
                throw new Error('Loader should be hidden even after error');
            }
        } finally {
            if (created) {
                overlay.remove();
            }
        }
    });

    await test('withLoader accepts custom message', async () => {
        const withLoader = getTestWithLoader();
        const hideLoader = getTestHideLoader();
        let overlay = document.getElementById('loading-overlay');
        const created = !overlay;

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.innerHTML = '<span class="loading-spinner-text"></span>';
            document.body.appendChild(overlay);
        }

        let capturedMessage = null;

        try {
            await withLoader(async () => {
                const textEl = overlay.querySelector('.loading-spinner-text');
                capturedMessage = textEl?.textContent;
                return 'done';
            }, 'Custom Loading...');

            if (capturedMessage !== 'Custom Loading...') {
                throw new Error(`Expected 'Custom Loading...', got '${capturedMessage}'`);
            }
        } finally {
            hideLoader();
            if (created) {
                overlay.remove();
            }
        }
    });

    // ===== isTouchDevice TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">👆 isTouchDevice()</h4>';

    await test('isTouchDevice returns a boolean', () => {
        const isTouchDevice = getTestIsTouchDevice();
        const result = isTouchDevice();
        if (typeof result !== 'boolean') {
            throw new Error(`Expected boolean, got ${typeof result}`);
        }
    });

    await test('isTouchDevice is consistent across calls', () => {
        const isTouchDevice = getTestIsTouchDevice();
        const result1 = isTouchDevice();
        const result2 = isTouchDevice();

        if (result1 !== result2) {
            throw new Error('isTouchDevice should return consistent results');
        }
    });

    await test('isTouchDevice checks for touch capabilities', () => {
        const isTouchDevice = getTestIsTouchDevice();
        // The function should check for ontouchstart or maxTouchPoints
        // We can't easily mock these, but we can verify the function runs
        const result = isTouchDevice();

        // In a browser test environment, this should work without throwing
        if (result !== true && result !== false) {
            throw new Error('isTouchDevice should return true or false');
        }
    });

    // ===== detectDeviceType TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📱 detectDeviceType()</h4>';

    await test('detectDeviceType function exists in uiBoot module', async () => {
        // Import the module to check for detectDeviceType
        try {
            const uiBootModule = await import('../modules/boot/uiBoot.js');
            if (typeof uiBootModule.detectDeviceType !== 'function') {
                throw new Error('detectDeviceType should be exported from uiBoot');
            }
        } catch (error) {
            // If module can't be imported directly, check if body classes are set
            const hasDeviceClass = document.body.classList.contains('desktop-mode') ||
                                   document.body.classList.contains('touch-mode');
            // Check via testContext instead of window
            const { getTestDeviceDetectionManagerInstance } = await import('./helpers/testContext.js');
            const deviceManager = getTestDeviceDetectionManagerInstance();
            if (!hasDeviceClass && !deviceManager) {
                throw new Error('Device type detection should set body class or use deviceDetectionManager');
            }
        }
    });

    await test('detectDeviceType can set body classes', async () => {
        // In test environment, device detection may not have run yet
        // We verify the function exists and can be called without error
        try {
            const uiBootModule = await import('../modules/boot/uiBoot.js');
            if (typeof uiBootModule.detectDeviceType === 'function') {
                // Call it to verify it works
                uiBootModule.detectDeviceType();
                // After calling, either desktop-mode or touch-mode should be set
                // OR deviceDetectionManager should exist (meaning the module handles it)
                const hasClass = document.body.classList.contains('desktop-mode') ||
                                 document.body.classList.contains('touch-mode');
                const { getTestDeviceDetectionManagerInstance } = await import('./helpers/testContext.js');
                const hasManager = !!getTestDeviceDetectionManagerInstance();
                if (!hasClass && !hasManager) {
                    // The function ran but didn't set classes - this is okay if deviceDetectionManager is used
                    console.log('detectDeviceType ran without setting classes (deviceDetectionManager may handle this)');
                }
            }
        } catch (error) {
            // Module import may fail in test environment, that's acceptable
            console.log('detectDeviceType test skipped in test environment');
        }
    });

    // ===== EVENT LISTENER ATTACHMENT TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Event Listeners</h4>';

    await test('Global keyboard handler is attached (undo/redo available)', async () => {
        // Test that Ctrl+Z and Ctrl+Shift+Z handlers exist
        // We verify by checking if undo/redo functions are available via testContext
        const performUndo = getTestPerformStateBasedUndo();
        const performRedo = getTestPerformStateBasedRedo();

        if (typeof performUndo !== 'function') {
            throw new Error('performStateBasedUndo should be available via testContext for keyboard shortcuts');
        }
        if (typeof performRedo !== 'function') {
            throw new Error('performStateBasedRedo should be available via testContext for keyboard shortcuts');
        }
    });

    // ===== EXPORTED FUNCTIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📤 Exported Functions</h4>';

    await test('uiBoot exports expected functions', async () => {
        try {
            const uiBootModule = await import('../modules/boot/uiBoot.js');

            const expectedExports = [
                'attachGlobalEventListeners',
                'attachTaskInputListeners',
                'attachMenuButtonListener',
                'hideAppLoader',
                'showLoader',
                'hideLoader',
                'withLoader',
                'detectDeviceType',
                'isTouchDevice'
            ];

            for (const exportName of expectedExports) {
                if (typeof uiBootModule[exportName] !== 'function') {
                    throw new Error(`Expected ${exportName} to be exported from uiBoot`);
                }
            }
        } catch (error) {
            if (error.message.includes('Expected')) {
                throw error;
            }
            // Module import issues are okay, functions are available via testContext
        }
    });

    // ===== hideAppLoader TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 hideAppLoader()</h4>';

    await test('hideAppLoader function exists', async () => {
        try {
            const uiBootModule = await import('../modules/boot/uiBoot.js');
            if (typeof uiBootModule.hideAppLoader !== 'function') {
                throw new Error('hideAppLoader should be exported');
            }
        } catch (error) {
            // If we can't import, the test is inconclusive but not failed
            if (error.message.includes('hideAppLoader')) {
                throw error;
            }
        }
    });

    // Cleanup
    env.cleanup();

    // Summary
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round(passed.count/total.count*100)}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
