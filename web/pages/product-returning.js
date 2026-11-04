/**
 * Returning users: one redirect to the app's new address (Nov 2026).
 *
 * minicycle.app/ became the product page and the app moved to /app. Someone
 * who already uses the app in this browser (their routines are saved here)
 * and opens the bare domain is sent to /app ONCE, where the app tells them it
 * moved (uiBoot announceAppMove, on ?moved=1). After that the root shows the
 * product page for them like everyone else — the flag is set before leaving,
 * so a slow or failed app load cannot send them round again.
 *
 * Loaded in <head>, before the page paints, so there is no flash of it.
 */
(function () {
    // STORAGE_KEYS.MOVED_TO_APP_NOTICE in modules/core/constants.js.
    var SHOWN_KEY = 'miniCycle_movedToAppNotice';
    try {
        if (location.pathname !== '/') return;
        if (!localStorage.getItem('miniCycleData')) return;
        if (localStorage.getItem(SHOWN_KEY)) return;
        localStorage.setItem(SHOWN_KEY, '1');
        location.replace('/app?moved=1');
    } catch (e) {
        // Storage blocked (private mode, policy) — just show the page.
    }
})();
