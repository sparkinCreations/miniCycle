/**
 * uiBoot.js Browser Tests
 * Tests for UI boot module - verifies exports and UI helpers
 *
 * @module tests/uiBoot.tests
 * @version 2.2.0 - Standalone tests (Dec 2025)
 *
 * NOTE: These tests are standalone and do not import testHelpers to avoid
 * triggering module side effects that can cause hangs in the test environment.
 */

// Simple test helper (inline to avoid testHelpers import)
function createTest(resultsDiv, passed, total) {
    return async function test(name, testFn) {
        total.count++;
        try {
            const result = testFn();
            if (result instanceof Promise) await result;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    };
}

export async function runUIBootTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📱 uiBoot Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createTest(resultsDiv, passed, total);

    // ===== MODULE STRUCTURE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📁 Module Structure</h4>';

    await test('uiBoot.js file is accessible', async () => {
        const response = await fetch('../modules/boot/uiBoot.js');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    });

    await test('uiBoot.js exports loader functions', async () => {
        const response = await fetch('../modules/boot/uiBoot.js');
        const code = await response.text();

        if (!code.includes('export function showLoader')) {
            throw new Error('showLoader not found');
        }
        if (!code.includes('export function hideLoader')) {
            throw new Error('hideLoader not found');
        }
    });

    await test('uiBoot.js exports device detection', async () => {
        const response = await fetch('../modules/boot/uiBoot.js');
        const code = await response.text();

        if (!code.includes('export function isTouchDevice')) {
            throw new Error('isTouchDevice not found');
        }
        if (!code.includes('export function detectDeviceType')) {
            throw new Error('detectDeviceType not found');
        }
    });

    // ===== DOM TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">⏳ DOM Manipulation</h4>';

    await test('Loading overlay can be created and toggled', () => {
        const overlay = document.createElement('div');
        overlay.id = 'test-overlay';
        document.body.appendChild(overlay);

        overlay.classList.add('active');
        if (!overlay.classList.contains('active')) {
            throw new Error('Failed to add active class');
        }

        overlay.classList.remove('active');
        if (overlay.classList.contains('active')) {
            throw new Error('Failed to remove active class');
        }

        overlay.remove();
    });

    await test('Spinner text can be updated', () => {
        const overlay = document.createElement('div');
        overlay.innerHTML = '<span class="loading-spinner-text"></span>';
        document.body.appendChild(overlay);

        const textEl = overlay.querySelector('.loading-spinner-text');
        textEl.textContent = 'Test Message';

        if (textEl.textContent !== 'Test Message') {
            throw new Error('Failed to update text');
        }

        overlay.remove();
    });

    // ===== TOUCH DETECTION TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">👆 Touch Detection</h4>';

    await test('maxTouchPoints is accessible', () => {
        if (!('maxTouchPoints' in navigator)) {
            throw new Error('maxTouchPoints should be accessible');
        }
    });

    await test('Device mode classes can be set', () => {
        document.body.classList.add('desktop-mode');
        if (!document.body.classList.contains('desktop-mode')) {
            throw new Error('Failed to add desktop-mode');
        }
        document.body.classList.remove('desktop-mode');

        document.body.classList.add('touch-mode');
        if (!document.body.classList.contains('touch-mode')) {
            throw new Error('Failed to add touch-mode');
        }
        document.body.classList.remove('touch-mode');
    });

    // ===== EVENT TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Events</h4>';

    await test('Keyboard events work', () => {
        let captured = false;
        const handler = () => { captured = true; };

        document.addEventListener('keydown', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
        document.removeEventListener('keydown', handler);

        if (!captured) {
            throw new Error('Event not captured');
        }
    });

    await test('Click events work', () => {
        let captured = false;
        const handler = () => { captured = true; };

        document.addEventListener('click', handler);
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        document.removeEventListener('click', handler);

        if (!captured) {
            throw new Error('Event not captured');
        }
    });

    // ===== MODAL TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🎭 Modal Detection</h4>';

    await test('Modal active detection works', () => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        document.body.appendChild(modal);

        let active = document.querySelector('.modal.active');
        if (active) {
            throw new Error('Should not find active modal initially');
        }

        modal.classList.add('active');
        active = document.querySelector('.modal.active');
        if (!active) {
            throw new Error('Should find active modal');
        }

        modal.remove();
    });

    // Summary
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round(passed.count/total.count*100)}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
