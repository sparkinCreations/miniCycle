/**
 * Returning users skip the product page (Nov 2026).
 *
 * minicycle.app/ became the product page and the app moved to /app. Someone
 * who already uses the app in this browser (their routines are saved here)
 * and opens the bare domain goes straight to the app, as the root used to do.
 * Only at the root: /pages/product.html is reached on purpose (the app's own
 * "About miniCycle" links) and always shows the page.
 *
 * Loaded in <head>, before the page paints, so there is no flash of it.
 */
(function () {
    try {
        if (location.pathname !== '/') return;
        if (!localStorage.getItem('miniCycleData')) return;
        location.replace('/app' + location.search + location.hash);
    } catch (e) {
        // Storage blocked (private mode, policy) — just show the page.
    }
})();
