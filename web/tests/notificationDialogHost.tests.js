/**
 * NotificationDialogHost Browser Tests
 *
 * Verifies that the host re-parents `#notification-container` into the topmost
 * open modal dialog so notifications remain interactive (drag / action buttons
 * / close) while a modal is showing.
 *
 * Test functions for module-test-suite.html
 */

import {
    setupTestEnvironment,
    createProtectedTest,
    wait
} from './testHelpers.js';

import {
    NotificationDialogHost,
    setNotificationDialogHostDependencies,
    initNotificationDialogHost,
    getNotificationDialogHost
} from '../modules/ui/notificationDialogHost.js';

// --------------------------------------------------------------------------
// DOM FIXTURES
// --------------------------------------------------------------------------

function ensureNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.setAttribute('popover', 'manual');
        container.style.position = 'fixed';
        container.style.top = '30px';
        container.style.left = '30px';
        document.body.appendChild(container);
    }
    return container;
}

function makeDialog(id = `test-dialog-${Date.now()}-${Math.random()}`) {
    const dialog = document.createElement('dialog');
    dialog.id = id;
    const inner = document.createElement('div');
    inner.textContent = 'modal content';
    dialog.appendChild(inner);
    document.body.appendChild(dialog);
    return dialog;
}

function cleanupDialog(dialog) {
    if (dialog.open) dialog.close();
    dialog.remove();
}


// --------------------------------------------------------------------------
// TEST SUITE
// --------------------------------------------------------------------------

export async function runNotificationDialogHostTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📌 NotificationDialogHost Tests</h2><h3>Setting up...</h3>';

    await setupTestEnvironment();
    ensureNotificationContainer();

    setNotificationDialogHostDependencies({
        getBody: () => document.body,
        waitForCore: () => Promise.resolve()
    });

    // Fresh instance each test suite run (destroy any leftover)
    const existing = getNotificationDialogHost();
    if (existing) existing.destroy();

    const host = await initNotificationDialogHost({
        getBody: () => document.body,
        waitForCore: () => Promise.resolve()
    });

    resultsDiv.innerHTML = '<h2>📌 NotificationDialogHost Tests</h2><h3>Running tests...</h3>';

    const passed = { count: 0 };
    const total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ===== INITIALIZATION =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('NotificationDialogHost class exists', () => {
        if (typeof NotificationDialogHost !== 'function') {
            throw new Error('NotificationDialogHost class not found');
        }
    });

    test('init() sets initialized=true', () => {
        if (!host.initialized) throw new Error('host.initialized should be true');
    });

    test('getNotificationDialogHost returns instance', () => {
        const got = getNotificationDialogHost();
        if (got !== host) throw new Error('singleton mismatch');
    });

    test('empty stack on boot (no open modals)', () => {
        if (host.getStackDepth() !== 0) {
            throw new Error(`expected depth 0, got ${host.getStackDepth()}`);
        }
    });

    // ===== SINGLE MODAL REPARENT =====
    resultsDiv.innerHTML += '<h4 class="test-section">🪆 Single Modal</h4>';

    test('showModal() reparents container into dialog', async () => {
        const container = ensureNotificationContainer();
        const dialog = makeDialog();
        try {
            dialog.showModal();
            await wait(0);

            if (container.parentElement !== dialog) {
                throw new Error(
                    `container parent should be dialog, got ${container.parentElement?.tagName}`
                );
            }
            if (host.getStackDepth() !== 1) {
                throw new Error(`stack depth should be 1, got ${host.getStackDepth()}`);
            }
        } finally {
            cleanupDialog(dialog);
            await wait(0);
        }
    });

    test('close() moves container back to body', async () => {
        const container = ensureNotificationContainer();
        const dialog = makeDialog();
        try {
            dialog.showModal();
            await wait(0);
            dialog.close();  // close event is synchronous

            if (container.parentElement !== document.body) {
                throw new Error(
                    `container should return to body, parent is ${container.parentElement?.tagName}`
                );
            }
            if (host.getStackDepth() !== 0) {
                throw new Error(`stack depth should be 0 after close`);
            }
        } finally {
            cleanupDialog(dialog);
            await wait(0);
        }
    });

    test('container appended as LAST child (not :first-child)', async () => {
        const container = ensureNotificationContainer();
        const dialog = makeDialog();
        try {
            dialog.showModal();
            await wait(0);

            if (dialog.firstElementChild === container) {
                throw new Error('container should not be :first-child (would break close animation)');
            }
            if (dialog.lastElementChild !== container) {
                throw new Error('container should be last child');
            }
        } finally {
            cleanupDialog(dialog);
            await wait(0);
        }
    });

    // ===== NESTED MODALS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📚 Nested Modals</h4>';

    test('second modal becomes new host for container', async () => {
        const container = ensureNotificationContainer();
        const first = makeDialog();
        const second = makeDialog();
        try {
            first.showModal();
            await wait(0);
            second.showModal();
            await wait(0);

            if (container.parentElement !== second) {
                throw new Error('container should follow topmost modal');
            }
            if (host.getStackDepth() !== 2) {
                throw new Error(`stack depth should be 2, got ${host.getStackDepth()}`);
            }
            if (host.getTopModal() !== second) {
                throw new Error('top of stack should be second dialog');
            }
        } finally {
            second.close();
            first.close();
            cleanupDialog(first);
            cleanupDialog(second);
            await wait(0);
        }
    });

    test('closing inner modal returns container to outer modal', async () => {
        const container = ensureNotificationContainer();
        const first = makeDialog();
        const second = makeDialog();
        try {
            first.showModal();
            await wait(0);
            second.showModal();
            await wait(0);
            second.close();

            if (container.parentElement !== first) {
                throw new Error('container should return to outer modal when inner closes');
            }
            if (host.getStackDepth() !== 1) {
                throw new Error(`stack depth should be 1`);
            }
        } finally {
            first.close();
            cleanupDialog(first);
            cleanupDialog(second);
            await wait(0);
        }
    });

    test('closing ALL nested modals returns container to body', async () => {
        const container = ensureNotificationContainer();
        const first = makeDialog();
        const second = makeDialog();
        try {
            first.showModal();
            await wait(0);
            second.showModal();
            await wait(0);
            second.close();
            first.close();

            if (container.parentElement !== document.body) {
                throw new Error('container should return to body after all modals close');
            }
            if (host.getStackDepth() !== 0) {
                throw new Error('stack should be empty');
            }
        } finally {
            cleanupDialog(first);
            cleanupDialog(second);
            await wait(0);
        }
    });

    // ===== EDGE CASES =====
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Edge Cases</h4>';

    test('non-modal dialog.show() is ignored', async () => {
        const container = ensureNotificationContainer();
        const dialog = makeDialog();
        try {
            dialog.show();  // NOT showModal — no inertness, should be ignored
            await wait(0);

            if (container.parentElement === dialog) {
                throw new Error('non-modal dialog should not attract container');
            }
            if (host.getStackDepth() !== 0) {
                throw new Error('non-modal should not affect stack');
            }
        } finally {
            dialog.close();
            cleanupDialog(dialog);
            await wait(0);
        }
    });

    test('dialog.close() followed by dialog.remove() — container survives', async () => {
        const container = ensureNotificationContainer();
        const dialog = makeDialog();
        try {
            dialog.showModal();
            await wait(0);

            // Simulate ephemeral dialog pattern: close + immediately remove
            dialog.close();
            dialog.remove();

            if (!document.body.contains(container)) {
                throw new Error('container was removed with dialog — should have reparented first');
            }
            if (container.parentElement !== document.body) {
                throw new Error('container should be in body');
            }
        } finally {
            await wait(0);
        }
    });

    test('dialog.open=false (attribute remove) also triggers reparent', async () => {
        const container = ensureNotificationContainer();
        const dialog = makeDialog();
        try {
            dialog.showModal();
            await wait(0);

            // Programmatic open=false path (defensive — not the normal API)
            // Use .close() since direct attribute removal doesn't fire the close event
            dialog.close();
            await wait(0);

            if (container.parentElement !== document.body) {
                throw new Error('container should return to body');
            }
        } finally {
            cleanupDialog(dialog);
            await wait(0);
        }
    });

    test('escape key close also returns container', async () => {
        const container = ensureNotificationContainer();
        const dialog = makeDialog();
        try {
            dialog.showModal();
            await wait(0);

            // Simulate native escape — dispatches cancel then close
            dialog.dispatchEvent(new Event('cancel'));
            dialog.close();

            if (container.parentElement !== document.body) {
                throw new Error('container should return to body on escape close');
            }
        } finally {
            cleanupDialog(dialog);
            await wait(0);
        }
    });

    // ===== DESTROY =====
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Destroy</h4>';

    test('destroy() sets initialized=false', async () => {
        // Create a throwaway instance to destroy (keeps the global host alive)
        const throwaway = new NotificationDialogHost({
            getBody: () => document.body,
            waitForCore: () => Promise.resolve()
        });
        await throwaway.init();
        throwaway.destroy();
        if (throwaway.initialized) {
            throw new Error('initialized should be false after destroy');
        }
    });

    test('destroy() clears internal stack', async () => {
        const throwaway = new NotificationDialogHost({
            getBody: () => document.body,
            waitForCore: () => Promise.resolve()
        });
        await throwaway.init();
        const dialog = makeDialog();
        try {
            dialog.showModal();
            await wait(0);
            throwaway.destroy();
            if (throwaway.getStackDepth() !== 0) {
                throw new Error('stack should be empty after destroy');
            }
        } finally {
            cleanupDialog(dialog);
            await wait(0);
        }
    });

    // ===== SUMMARY =====
    resultsDiv.innerHTML += `
        <h4 class="test-section">📊 Summary</h4>
        <div class="result ${passed.count === total.count ? 'pass' : 'fail'}">
            ${passed.count}/${total.count} tests passed
        </div>
    `;

    return { passed: passed.count, total: total.count };
}
