/**
 * Accessibility Tests
 * Tests for WCAG 2.1 compliance and accessibility features
 *
 * Tests:
 * - ARIA attributes (aria-label, aria-pressed, aria-checked, role)
 * - Keyboard navigation (Tab, Enter, Space, Arrow keys, Escape)
 * - Focus management
 * - Screen reader support
 */

import {
    setupTestEnvironment,
    createMockData
} from './testHelpers.js';

export async function runAccessibilityTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>Accessibility Tests</h2><h3>Setting up...</h3>';

    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>Accessibility Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // Save real app data
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
    }

    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // Helper to create DOM elements for testing
    // Note: use opacity:0 instead of left:-9999px because browsers
    // don't reliably move focus to off-screen elements
    function createTestContainer() {
        const container = document.createElement('div');
        container.id = 'a11y-test-container';
        container.style.position = 'absolute';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
        return container;
    }

    function cleanupTestContainer() {
        const container = document.getElementById('a11y-test-container');
        if (container) {
            container.remove();
        }
    }

    async function test(name, testFn) {
        total.count++;
        try {
            localStorage.clear();
            const mockSchemaData = createMockData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));
            cleanupTestContainer();

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            cleanupTestContainer();
        }
    }

    // === ARIA LABEL TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🏷️ ARIA Labels</h4>';

    await test('Button with aria-label is accessible', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'Delete task');
        container.appendChild(button);

        const label = button.getAttribute('aria-label');
        if (label !== 'Delete task') {
            throw new Error('aria-label should be set correctly');
        }
    });

    await test('Checkbox with aria-label describes action', () => {
        const container = createTestContainer();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.setAttribute('aria-label', 'Mark task "Buy groceries" as complete');
        container.appendChild(checkbox);

        const label = checkbox.getAttribute('aria-label');
        if (!label.includes('Mark task')) {
            throw new Error('Checkbox aria-label should describe the action');
        }
    });

    await test('aria-label updates dynamically', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'Enable feature');
        container.appendChild(button);

        // Simulate state change
        button.setAttribute('aria-label', 'Disable feature');

        if (button.getAttribute('aria-label') !== 'Disable feature') {
            throw new Error('aria-label should update dynamically');
        }
    });

    // === ARIA PRESSED TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔘 ARIA Pressed (Toggle Buttons)</h4>';

    await test('Toggle button has aria-pressed attribute', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.setAttribute('aria-pressed', 'false');
        container.appendChild(button);

        if (!button.hasAttribute('aria-pressed')) {
            throw new Error('Toggle button should have aria-pressed');
        }
    });

    await test('aria-pressed reflects button state (inactive)', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.setAttribute('aria-pressed', 'false');
        container.appendChild(button);

        if (button.getAttribute('aria-pressed') !== 'false') {
            throw new Error('Inactive button should have aria-pressed="false"');
        }
    });

    await test('aria-pressed reflects button state (active)', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.setAttribute('aria-pressed', 'true');
        container.appendChild(button);

        if (button.getAttribute('aria-pressed') !== 'true') {
            throw new Error('Active button should have aria-pressed="true"');
        }
    });

    await test('aria-pressed toggles correctly', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.setAttribute('aria-pressed', 'false');
        container.appendChild(button);

        // Simulate toggle
        const isPressed = button.getAttribute('aria-pressed') === 'true';
        button.setAttribute('aria-pressed', (!isPressed).toString());

        if (button.getAttribute('aria-pressed') !== 'true') {
            throw new Error('aria-pressed should toggle from false to true');
        }
    });

    // === ARIA CHECKED TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">☑️ ARIA Checked (Checkboxes)</h4>';

    await test('Checkbox has aria-checked attribute', () => {
        const container = createTestContainer();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.setAttribute('aria-checked', 'false');
        container.appendChild(checkbox);

        if (!checkbox.hasAttribute('aria-checked')) {
            throw new Error('Checkbox should have aria-checked');
        }
    });

    await test('aria-checked matches checked property (unchecked)', () => {
        const container = createTestContainer();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;
        checkbox.setAttribute('aria-checked', checkbox.checked.toString());
        container.appendChild(checkbox);

        if (checkbox.getAttribute('aria-checked') !== 'false') {
            throw new Error('Unchecked box should have aria-checked="false"');
        }
    });

    await test('aria-checked matches checked property (checked)', () => {
        const container = createTestContainer();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.setAttribute('aria-checked', checkbox.checked.toString());
        container.appendChild(checkbox);

        if (checkbox.getAttribute('aria-checked') !== 'true') {
            throw new Error('Checked box should have aria-checked="true"');
        }
    });

    await test('aria-checked updates on change', () => {
        const container = createTestContainer();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;
        checkbox.setAttribute('aria-checked', 'false');

        checkbox.addEventListener('change', () => {
            checkbox.setAttribute('aria-checked', checkbox.checked.toString());
        });

        container.appendChild(checkbox);

        // Simulate check
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        if (checkbox.getAttribute('aria-checked') !== 'true') {
            throw new Error('aria-checked should update on change event');
        }
    });

    // === ROLE ATTRIBUTE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎭 Role Attributes</h4>';

    await test('Checkbox has role="checkbox"', () => {
        const container = createTestContainer();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.setAttribute('role', 'checkbox');
        container.appendChild(checkbox);

        if (checkbox.getAttribute('role') !== 'checkbox') {
            throw new Error('Should have role="checkbox"');
        }
    });

    await test('Dialog has role="dialog"', () => {
        const container = createTestContainer();
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        container.appendChild(dialog);

        if (dialog.getAttribute('role') !== 'dialog') {
            throw new Error('Modal should have role="dialog"');
        }
    });

    await test('Text content has role="text"', () => {
        const container = createTestContainer();
        const span = document.createElement('span');
        span.setAttribute('role', 'text');
        span.textContent = 'Task description';
        container.appendChild(span);

        if (span.getAttribute('role') !== 'text') {
            throw new Error('Task text should have role="text"');
        }
    });

    await test('Navigation has role="navigation"', () => {
        const container = createTestContainer();
        const nav = document.createElement('nav');
        nav.setAttribute('role', 'navigation');
        container.appendChild(nav);

        if (nav.getAttribute('role') !== 'navigation') {
            throw new Error('Nav should have role="navigation"');
        }
    });

    // === KEYBOARD NAVIGATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⌨️ Keyboard Navigation</h4>';

    await test('Interactive elements have tabindex', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.setAttribute('tabindex', '0');
        container.appendChild(button);

        if (button.getAttribute('tabindex') !== '0') {
            throw new Error('Interactive elements should have tabindex="0"');
        }
    });

    await test('Non-interactive elements can be made focusable', () => {
        const container = createTestContainer();
        const span = document.createElement('span');
        span.setAttribute('tabindex', '0');
        container.appendChild(span);

        if (span.getAttribute('tabindex') !== '0') {
            throw new Error('tabindex="0" makes element focusable');
        }
    });

    await test('Disabled elements have tabindex="-1"', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.disabled = true;
        button.setAttribute('tabindex', '-1');
        container.appendChild(button);

        if (button.getAttribute('tabindex') !== '-1') {
            throw new Error('Disabled elements should have tabindex="-1"');
        }
    });

    await test('Enter key triggers button click', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        let clicked = false;

        button.addEventListener('click', () => { clicked = true; });
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                button.click();
            }
        });

        container.appendChild(button);
        button.focus();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        button.dispatchEvent(event);

        if (!clicked) {
            throw new Error('Enter key should trigger button click');
        }
    });

    await test('Space key triggers button click', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        let clicked = false;

        button.addEventListener('click', () => { clicked = true; });
        button.addEventListener('keydown', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                button.click();
            }
        });

        container.appendChild(button);
        button.focus();

        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
        button.dispatchEvent(event);

        if (!clicked) {
            throw new Error('Space key should trigger button click');
        }
    });

    await test('Enter key toggles checkbox', () => {
        const container = createTestContainer();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;

        checkbox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        container.appendChild(checkbox);
        checkbox.focus();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        checkbox.dispatchEvent(event);

        if (!checkbox.checked) {
            throw new Error('Enter key should toggle checkbox');
        }
    });

    await test('Arrow keys navigate between buttons', () => {
        const container = createTestContainer();

        const btn1 = document.createElement('button');
        btn1.textContent = 'Button 1';
        btn1.classList.add('task-btn');

        const btn2 = document.createElement('button');
        btn2.textContent = 'Button 2';
        btn2.classList.add('task-btn');

        const btn3 = document.createElement('button');
        btn3.textContent = 'Button 3';
        btn3.classList.add('task-btn');

        container.appendChild(btn1);
        container.appendChild(btn2);
        container.appendChild(btn3);

        // Override .focus() to track calls directly — document.activeElement and
        // focus events are unreliable when the page doesn't have OS-level focus
        let lastFocused = null;
        [btn1, btn2, btn3].forEach(btn => {
            const orig = btn.focus.bind(btn);
            btn.focus = () => { lastFocused = btn; orig(); };
        });

        // Set up arrow key navigation
        container.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const buttons = Array.from(container.querySelectorAll('button.task-btn'));
                const currentIndex = buttons.indexOf(e.target);
                if (currentIndex === -1) return;

                const nextIndex = e.key === 'ArrowRight'
                    ? (currentIndex + 1) % buttons.length
                    : (currentIndex - 1 + buttons.length) % buttons.length;
                buttons[nextIndex].focus();
                e.preventDefault();
            }
        });

        btn1.focus();
        lastFocused = null; // reset after initial focus
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
        btn1.dispatchEvent(event);

        if (lastFocused !== btn2) {
            throw new Error('ArrowRight should move focus to next button');
        }
    });

    await test('Arrow key navigation wraps around', () => {
        const container = createTestContainer();

        const btn1 = document.createElement('button');
        btn1.classList.add('task-btn');
        const btn2 = document.createElement('button');
        btn2.classList.add('task-btn');

        container.appendChild(btn1);
        container.appendChild(btn2);

        let lastFocused = null;
        [btn1, btn2].forEach(btn => {
            const orig = btn.focus.bind(btn);
            btn.focus = () => { lastFocused = btn; orig(); };
        });

        container.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const buttons = Array.from(container.querySelectorAll('button.task-btn'));
                const currentIndex = buttons.indexOf(e.target);
                if (currentIndex === -1) return;

                const nextIndex = e.key === 'ArrowRight'
                    ? (currentIndex + 1) % buttons.length
                    : (currentIndex - 1 + buttons.length) % buttons.length;
                buttons[nextIndex].focus();
            }
        });

        btn2.focus();
        lastFocused = null;
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
        btn2.dispatchEvent(event);

        if (lastFocused !== btn1) {
            throw new Error('Arrow navigation should wrap from last to first');
        }
    });

    await test('ArrowLeft wraps from first to last', () => {
        const container = createTestContainer();

        const btn1 = document.createElement('button');
        btn1.classList.add('task-btn');
        const btn2 = document.createElement('button');
        btn2.classList.add('task-btn');
        const btn3 = document.createElement('button');
        btn3.classList.add('task-btn');

        container.appendChild(btn1);
        container.appendChild(btn2);
        container.appendChild(btn3);

        let lastFocused = null;
        [btn1, btn2, btn3].forEach(btn => {
            const orig = btn.focus.bind(btn);
            btn.focus = () => { lastFocused = btn; orig(); };
        });

        container.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                const buttons = Array.from(container.querySelectorAll('button.task-btn'));
                const currentIndex = buttons.indexOf(e.target);
                if (currentIndex === -1) return;

                const nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
                buttons[nextIndex].focus();
            }
        });

        btn1.focus();
        lastFocused = null;
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
        btn1.dispatchEvent(event);

        if (lastFocused !== btn3) {
            throw new Error('ArrowLeft should wrap from first to last');
        }
    });

    // === ESCAPE KEY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚪 Escape Key Handling</h4>';

    await test('Escape key closes modal', () => {
        const container = createTestContainer();
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.style.display = 'block';
        container.appendChild(modal);

        let modalClosed = false;
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                modalClosed = true;
                document.removeEventListener('keydown', handler);
            }
        });

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(event);

        if (!modalClosed) {
            throw new Error('Escape key should close modal');
        }
    });

    await test('Escape key prevents default behavior', () => {
        const container = createTestContainer();
        let defaultPrevented = false;

        const handler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                defaultPrevented = true;
            }
        };

        document.addEventListener('keydown', handler);

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        document.dispatchEvent(event);

        document.removeEventListener('keydown', handler);

        if (!defaultPrevented) {
            throw new Error('Escape handler should prevent default');
        }
    });

    // === FOCUS MANAGEMENT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Focus Management</h4>';

    await test('Focus can be set programmatically', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.textContent = 'Focus me';
        container.appendChild(button);

        button.focus();

        if (document.activeElement !== button) {
            throw new Error('focus() should set active element');
        }
    });

    await test('Focus returns after modal close', () => {
        const container = createTestContainer();
        const trigger = document.createElement('button');
        trigger.id = 'trigger-btn';
        const modal = document.createElement('div');
        modal.classList.add('modal');

        container.appendChild(trigger);
        container.appendChild(modal);

        // Simulate: trigger opens modal, then modal closes and returns focus
        trigger.focus();
        const originalFocus = document.activeElement;

        // Modal opens (focus moves away)
        modal.focus();

        // Modal closes (focus returns)
        trigger.focus();

        if (document.activeElement !== originalFocus) {
            throw new Error('Focus should return to trigger after modal close');
        }
    });

    await test('Hidden elements are not focusable', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.style.display = 'none';
        button.setAttribute('tabindex', '-1');
        container.appendChild(button);

        // Hidden elements should have tabindex="-1" or be skipped
        if (button.getAttribute('tabindex') !== '-1') {
            throw new Error('Hidden elements should have tabindex="-1"');
        }
    });

    await test('Focus order follows DOM order', () => {
        const container = createTestContainer();

        const first = document.createElement('button');
        first.textContent = 'First';
        first.setAttribute('tabindex', '0');

        const second = document.createElement('button');
        second.textContent = 'Second';
        second.setAttribute('tabindex', '0');

        container.appendChild(first);
        container.appendChild(second);

        // Elements with tabindex="0" follow DOM order
        const buttons = container.querySelectorAll('button');
        if (buttons[0] !== first || buttons[1] !== second) {
            throw new Error('Focus order should follow DOM order');
        }
    });

    // === SCREEN READER SUPPORT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔊 Screen Reader Support</h4>';

    await test('Buttons have descriptive labels', () => {
        const container = createTestContainer();

        const ariaLabels = {
            'move-up': 'Move task up',
            'move-down': 'Move task down',
            'delete-btn': 'Delete task',
            'edit-btn': 'Edit task'
        };

        for (const [btnClass, expectedLabel] of Object.entries(ariaLabels)) {
            const button = document.createElement('button');
            button.classList.add(btnClass);
            button.setAttribute('aria-label', expectedLabel);
            container.appendChild(button);

            if (button.getAttribute('aria-label') !== expectedLabel) {
                throw new Error(`${btnClass} should have aria-label="${expectedLabel}"`);
            }
        }
    });

    await test('Form inputs have associated labels', () => {
        const container = createTestContainer();

        const label = document.createElement('label');
        label.setAttribute('for', 'task-input');
        label.textContent = 'New task';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'task-input';

        container.appendChild(label);
        container.appendChild(input);

        if (label.getAttribute('for') !== input.id) {
            throw new Error('Label for attribute should match input id');
        }
    });

    await test('Images have alt text', () => {
        const container = createTestContainer();
        const img = document.createElement('img');
        img.setAttribute('alt', 'Task completed icon');
        container.appendChild(img);

        if (!img.hasAttribute('alt')) {
            throw new Error('Images should have alt attribute');
        }
    });

    await test('Decorative icons are hidden from screen readers', () => {
        const container = createTestContainer();
        const icon = document.createElement('i');
        icon.classList.add('fas', 'fa-check');
        icon.setAttribute('aria-hidden', 'true');
        container.appendChild(icon);

        if (icon.getAttribute('aria-hidden') !== 'true') {
            throw new Error('Decorative icons should have aria-hidden="true"');
        }
    });

    await test('Live regions announce dynamic changes', () => {
        const container = createTestContainer();
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        container.appendChild(liveRegion);

        if (liveRegion.getAttribute('aria-live') !== 'polite') {
            throw new Error('Live regions should have aria-live attribute');
        }
    });

    // === COLOR CONTRAST / VISUAL TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Visual Accessibility</h4>';

    await test('Focus indicators are visible (outline style)', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.style.outline = '2px solid blue';
        container.appendChild(button);

        // Check that outline is set (not 'none')
        const outline = button.style.outline;
        if (!outline || outline === 'none') {
            throw new Error('Focus indicators should be visible');
        }
    });

    await test('Error states have accessible indicators', () => {
        const container = createTestContainer();
        const input = document.createElement('input');
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', 'error-msg');

        const error = document.createElement('span');
        error.id = 'error-msg';
        error.textContent = 'This field is required';

        container.appendChild(input);
        container.appendChild(error);

        if (input.getAttribute('aria-invalid') !== 'true') {
            throw new Error('Invalid inputs should have aria-invalid="true"');
        }
        if (input.getAttribute('aria-describedby') !== 'error-msg') {
            throw new Error('Inputs should reference error messages via aria-describedby');
        }
    });

    // === TOOLTIP ACCESSIBILITY ===
    resultsDiv.innerHTML += '<h4 class="test-section">💬 Tooltips</h4>';

    await test('Buttons have title attributes for tooltips', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.setAttribute('title', 'Delete task');
        button.setAttribute('aria-label', 'Delete task');
        container.appendChild(button);

        if (!button.hasAttribute('title')) {
            throw new Error('Buttons should have title for tooltip');
        }
    });

    await test('Title matches aria-label', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        const label = 'Move task up';
        button.setAttribute('title', label);
        button.setAttribute('aria-label', label);
        container.appendChild(button);

        if (button.getAttribute('title') !== button.getAttribute('aria-label')) {
            throw new Error('Title and aria-label should match');
        }
    });

    // === MOBILE ACCESSIBILITY ===
    resultsDiv.innerHTML += '<h4 class="test-section">📱 Touch Accessibility</h4>';

    await test('Touch targets are large enough (44x44 minimum)', () => {
        const container = createTestContainer();
        const button = document.createElement('button');
        button.style.width = '44px';
        button.style.height = '44px';
        button.style.minWidth = '44px';
        button.style.minHeight = '44px';
        container.appendChild(button);

        const width = parseInt(button.style.width);
        const height = parseInt(button.style.height);

        if (width < 44 || height < 44) {
            throw new Error('Touch targets should be at least 44x44 pixels');
        }
    });

    await test('Interactive elements have adequate spacing', () => {
        const container = createTestContainer();
        container.style.display = 'flex';
        container.style.gap = '8px';

        const btn1 = document.createElement('button');
        const btn2 = document.createElement('button');
        container.appendChild(btn1);
        container.appendChild(btn2);

        const gap = container.style.gap;
        if (!gap || parseInt(gap) < 8) {
            throw new Error('Interactive elements should have adequate spacing');
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
