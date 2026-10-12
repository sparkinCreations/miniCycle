/**
 * ModalUtils Tests
 * Tests for modules/ui/modalUtils.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runModalUtilsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/modalUtils.js?v=${cacheBuster}`);
    const constants = await import(`../modules/core/constants.js?v=${cacheBuster}`);
    const { DOM_IDS, DOM_SELECTORS } = constants;

    resultsDiv.innerHTML = '<h2>ModalUtils Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── DOM fixture helpers ──────────────────────────────────────────────────
    // Build a notification container that the helpers query by DOM_IDS/SELECTORS.
    const NOTIF_CLASS = DOM_SELECTORS.NOTIFICATION.replace(/^\./, '');

    function makeContainer() {
        const c = document.createElement('div');
        c.id = DOM_IDS.NOTIFICATION_CONTAINER;
        document.body.appendChild(c);
        return c;
    }
    function removeContainer() {
        const c = document.getElementById(DOM_IDS.NOTIFICATION_CONTAINER);
        if (c) c.remove();
    }
    // Create a notification at fixed screen coordinates via getBoundingClientRect stub.
    function makeNotif(container, rect, closeRect = null, closeSelectorClass = null) {
        const n = document.createElement('div');
        n.className = NOTIF_CLASS;
        n.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height });
        if (closeRect) {
            const cls = (closeSelectorClass || DOM_SELECTORS.CLOSE_BTN).replace(/^\./, '');
            const btn = document.createElement('button');
            btn.className = cls;
            btn.getBoundingClientRect = () => ({
                ...closeRect, right: closeRect.left + closeRect.width, bottom: closeRect.top + closeRect.height
            });
            n.appendChild(btn);
        }
        container.appendChild(n);
        return n;
    }

    // ── Module Loading (keep original smoke checks) ──────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('hasActiveNotifications is an exported function', () => {
        if (typeof mod.hasActiveNotifications !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.hasActiveNotifications}`);
        }
    });

    await test('isClickOnNotification is an exported function', () => {
        if (typeof mod.isClickOnNotification !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.isClickOnNotification}`);
        }
    });

    await test('hasActiveNotifications returns a boolean', () => {
        const result = mod.hasActiveNotifications();
        if (typeof result !== 'boolean') {
            throw new Error(`Expected boolean, got ${typeof result}`);
        }
    });

    // ── hasActiveNotifications: behavior ─────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔔 hasActiveNotifications</h4>';

    await test('false when no container exists', () => {
        removeContainer();
        if (mod.hasActiveNotifications() !== false) throw new Error('expected false with no container');
    });

    await test('false when container exists but is empty', () => {
        removeContainer();
        makeContainer();
        try {
            if (mod.hasActiveNotifications() !== false) throw new Error('expected false for empty container');
        } finally { removeContainer(); }
    });

    await test('true when at least one notification is present', () => {
        removeContainer();
        const c = makeContainer();
        makeNotif(c, { left: 0, top: 0, width: 10, height: 10 });
        try {
            if (mod.hasActiveNotifications() !== true) throw new Error('expected true with a notification');
        } finally { removeContainer(); }
    });

    await test('ignores non-notification children of the container', () => {
        removeContainer();
        const c = makeContainer();
        const other = document.createElement('div');
        other.className = 'not-a-notification';
        c.appendChild(other);
        try {
            if (mod.hasActiveNotifications() !== false) {
                throw new Error('non-notification child should not count');
            }
        } finally { removeContainer(); }
    });

    // ── isClickOnNotification: hit-testing ───────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 isClickOnNotification</h4>';

    await test('false when container is missing (no throw)', () => {
        removeContainer();
        const r = mod.isClickOnNotification({ clientX: 5, clientY: 5 });
        if (r !== false) throw new Error('expected false with no container');
    });

    await test('false when no notifications present', () => {
        removeContainer();
        makeContainer();
        try {
            const r = mod.isClickOnNotification({ clientX: 5, clientY: 5 });
            if (r !== false) throw new Error('expected false with empty container');
        } finally { removeContainer(); }
    });

    await test('true when click is inside a notification rect', () => {
        removeContainer();
        const c = makeContainer();
        makeNotif(c, { left: 100, top: 100, width: 200, height: 80 });
        try {
            const r = mod.isClickOnNotification({ clientX: 150, clientY: 130 });
            if (r !== true) throw new Error('click inside rect should return true');
        } finally { removeContainer(); }
    });

    await test('false when click is outside the notification rect', () => {
        removeContainer();
        const c = makeContainer();
        makeNotif(c, { left: 100, top: 100, width: 200, height: 80 });
        try {
            const r = mod.isClickOnNotification({ clientX: 50, clientY: 50 });
            if (r !== false) throw new Error('click outside rect should return false');
        } finally { removeContainer(); }
    });

    await test('true on the rect edge (inclusive boundary)', () => {
        removeContainer();
        const c = makeContainer();
        makeNotif(c, { left: 100, top: 100, width: 200, height: 80 }); // right=300, bottom=180
        try {
            const r = mod.isClickOnNotification({ clientX: 300, clientY: 180 });
            if (r !== true) throw new Error('boundary click should be inclusive (>= / <=)');
        } finally { removeContainer(); }
    });

    await test('matches when there are multiple notifications and click hits the 2nd', () => {
        removeContainer();
        const c = makeContainer();
        makeNotif(c, { left: 0, top: 0, width: 50, height: 50 });
        makeNotif(c, { left: 400, top: 400, width: 100, height: 100 });
        try {
            const r = mod.isClickOnNotification({ clientX: 450, clientY: 450 });
            if (r !== true) throw new Error('should match the second notification');
        } finally { removeContainer(); }
    });

    await test('clicking the close button dismisses (clicks) it and returns true', () => {
        removeContainer();
        const c = makeContainer();
        // notif at 100,100 200x80 ; close btn at 280,105 16x16
        const n = makeNotif(c, { left: 100, top: 100, width: 200, height: 80 },
                               { left: 280, top: 105, width: 16, height: 16 });
        let clicked = false;
        n.querySelector(DOM_SELECTORS.CLOSE_BTN).addEventListener('click', () => { clicked = true; });
        try {
            const r = mod.isClickOnNotification({ clientX: 285, clientY: 110 });
            if (r !== true) throw new Error('expected true when clicking close button area');
            if (!clicked) throw new Error('close button .click() was not invoked');
        } finally { removeContainer(); }
    });

    await test('click inside notif but NOT on close button does not click it', () => {
        removeContainer();
        const c = makeContainer();
        const n = makeNotif(c, { left: 100, top: 100, width: 200, height: 80 },
                               { left: 280, top: 105, width: 16, height: 16 });
        let clicked = false;
        n.querySelector(DOM_SELECTORS.CLOSE_BTN).addEventListener('click', () => { clicked = true; });
        try {
            const r = mod.isClickOnNotification({ clientX: 120, clientY: 120 }); // body of notif
            if (r !== true) throw new Error('expected true (inside notif)');
            if (clicked) throw new Error('close button should not be clicked for a body click');
        } finally { removeContainer(); }
    });

    // ── Focus return + tab wrap (WCAG 2.4.3 / 2.4.7, Oct 2026 audit) ─────────
    resultsDiv.innerHTML += '<h4>🎯 restoreFocusAfterClose</h4>';
    function makeDialogFixture() {
        const host = document.createElement('div');
        host.innerHTML = `
            <button id="mu-opener">opener</button>
            <button class="menu-button" id="mu-menu">menu</button>
            <main id="app-container" tabindex="-1"></main>
            <dialog id="mu-dialog"><button id="mu-first">first</button><input id="mu-mid"><button id="mu-last">last</button></dialog>`;
        document.body.appendChild(host);
        return { host, dialog: host.querySelector('#mu-dialog'), opener: host.querySelector('#mu-opener'), menu: host.querySelector('#mu-menu'), remove: () => host.remove() };
    }
    await test('restores focus to the remembered opener when it is still visible', () => {
        const f = makeDialogFixture();
        try {
            f.dialog._previousFocus = f.opener;
            const landed = mod.restoreFocusAfterClose(f.dialog);
            if (landed !== f.opener || document.activeElement !== f.opener) throw new Error(`focus landed on ${document.activeElement && document.activeElement.id}`);
        } finally { f.remove(); }
    });
    await test('skips a hidden opener (a closed menu item) and lands on the menu button', () => {
        const f = makeDialogFixture();
        try {
            f.dialog._previousFocus = f.opener;
            f.opener.style.display = 'none';
            const landed = mod.restoreFocusAfterClose(f.dialog);
            if (landed !== f.menu || document.activeElement !== f.menu) throw new Error(`expected the menu button, got ${document.activeElement && document.activeElement.id}`);
        } finally { f.remove(); }
    });
    await test('a caller fallback outranks the menu button', () => {
        const f = makeDialogFixture();
        try {
            f.dialog._previousFocus = null;
            const fb = document.createElement('button'); fb.id = 'mu-fallback'; f.host.appendChild(fb);
            const landed = mod.restoreFocusAfterClose(f.dialog, { fallbacks: [fb] });
            if (landed !== fb) throw new Error(`expected the fallback, got ${document.activeElement && document.activeElement.id}`);
        } finally { f.remove(); }
    });
    await test('never lands inside the dialog that just closed', () => {
        const f = makeDialogFixture();
        try {
            f.dialog._previousFocus = f.dialog.querySelector('#mu-first');
            f.menu.style.display = 'none';
            const landed = mod.restoreFocusAfterClose(f.dialog);
            if (!landed || f.dialog.contains(landed)) throw new Error(`landed inside the closed dialog: ${landed && landed.id}`);
            if (landed.id !== 'app-container') throw new Error(`expected the main container as last resort, got ${landed.id}`);
        } finally { f.remove(); }
    });
    await test('uses plain focus (no focusVisible:false), so a keyboard close shows the ring', () => {
        const f = makeDialogFixture();
        try {
            let opts = null;
            f.opener.focus = function (o) { opts = o; HTMLElement.prototype.focus.call(this, o); };
            f.dialog._previousFocus = f.opener;
            mod.restoreFocusAfterClose(f.dialog);
            if (opts && opts.focusVisible === false) throw new Error('focusVisible:false was passed on a close');
        } finally { f.remove(); }
    });

    resultsDiv.innerHTML += '<h4>↹ installDialogTabWrap</h4>';
    const tab = (el, shift) => { const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
    await test('Shift+Tab on the first control wraps to the last, inside the dialog', () => {
        const f = makeDialogFixture();
        try {
            mod.installDialogTabWrap(f.dialog);
            f.dialog.show();
            f.dialog.querySelector('#mu-first').focus();
            const prevented = tab(document.activeElement, true);
            if (!prevented || document.activeElement.id !== 'mu-last') throw new Error(`landed on ${document.activeElement.id}, prevented=${prevented}`);
        } finally { f.dialog.close(); f.remove(); }
    });
    await test('Tab on the last control wraps to the first', () => {
        const f = makeDialogFixture();
        try {
            mod.installDialogTabWrap(f.dialog);
            f.dialog.show();
            f.dialog.querySelector('#mu-last').focus();
            const prevented = tab(document.activeElement, false);
            if (!prevented || document.activeElement.id !== 'mu-first') throw new Error(`landed on ${document.activeElement.id}`);
        } finally { f.dialog.close(); f.remove(); }
    });
    await test('Tab in the middle is left to the browser; a closed dialog is ignored; install is idempotent', () => {
        const f = makeDialogFixture();
        try {
            mod.installDialogTabWrap(f.dialog);
            const h = f.dialog._tabWrapHandler;
            mod.installDialogTabWrap(f.dialog);
            if (f.dialog._tabWrapHandler !== h) throw new Error('a second install replaced the handler');
            f.dialog.show();
            f.dialog.querySelector('#mu-mid').focus();
            if (tab(document.activeElement, false)) throw new Error('mid-dialog Tab must not be intercepted');
            f.dialog.close();
            f.dialog.querySelector('#mu-last').focus();
            if (tab(document.activeElement, false)) throw new Error('a closed dialog must not intercept Tab');
        } finally { f.remove(); }
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
