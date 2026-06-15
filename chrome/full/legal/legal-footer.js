// legal-footer.js — Shared footer year + smart back-button for legal pages
(function () {
    'use strict';

    // Year stamp (©)
    var yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // Find the back button by aria-label semantics — survives Netlify pretty-URL rewrites
    // (deployed href is "/minicycle" rather than "../miniCycle.html"), and avoids matching
    // unrelated buttons that happen to share a class.
    var backBtn = document.querySelector('a[aria-label^="Back to"], a[aria-label^="Go back"]');
    if (!backBtn) return;

    var referrer = document.referrer;
    if (!referrer) return; // no referrer (direct visit / bookmark) — keep the default

    try {
        var ref = new URL(referrer);
        if (ref.origin !== location.origin) return; // external referrer — keep default
        if (ref.pathname === location.pathname) return; // don't loop back to ourselves

        var path = ref.pathname;
        var pageName;
        if (path.endsWith('/product.html')) pageName = 'Product';
        else if (path.endsWith('/learn_more.html')) pageName = 'Learn More';
        else if (path.endsWith('/miniCycle.html')) pageName = 'miniCycle';
        else if (path === '/' || path.endsWith('/index.html')) pageName = 'miniCycle';
        else pageName = null;

        // Preserve whichever arrow style this page already uses (⬅ or ←).
        var current = backBtn.textContent.trim();
        var arrowMatch = current.match(/^[⬅←]+/);
        var arrow = arrowMatch ? arrowMatch[0] : '←';
        var label = pageName ? 'Back to ' + pageName : 'Back';

        backBtn.setAttribute('href', referrer);
        backBtn.setAttribute('aria-label', 'Go back to ' + (pageName || 'previous page'));
        backBtn.textContent = arrow + ' ' + label;
    } catch (e) {
        // Malformed referrer URL — keep default
    }
})();
