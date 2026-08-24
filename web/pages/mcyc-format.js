/**
 * mcyc-format.js — CTA + pageview tracking for the .mcyc format spec page.
 *
 * Mirrors learn_more.js deliberately, including the privacy shape: the payload
 * carries an event name and a type, and NOTHING else. No referrer, no UTM
 * parameters, no per-visitor identifier — privacy.html promises their absence,
 * so the hit-based counting here is the ceiling, not a limitation to fix.
 *
 * Smooth anchor scrolling is CSS on this page (html { scroll-behavior: smooth },
 * disabled under prefers-reduced-motion), so unlike learn_more.js there is no
 * JS scroll handler to keep in sync.
 */
(function () {
    'use strict';

    function trackEvent(event, type) {
        try {
            fetch('/.netlify/functions/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: event, type: type || 'click' }),
                keepalive: true, // survive navigation when clicking external links
            }).catch(function () { /* silent fail — tracking is non-critical */ });
        } catch (e) { /* silent fail */ }
    }

    function slug(s) {
        return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function inferLabel(elem) {
        var explicit = elem.getAttribute('data-track');
        if (explicit) return slug(explicit);

        var label = slug(elem.getAttribute('aria-label') || elem.textContent);
        if (label) return label;

        if (elem.tagName === 'A' && elem.href) {
            try {
                var u = new URL(elem.href, location.href);
                return 'href-' + slug(u.host + u.pathname);
            } catch (e) { /* invalid URL */ }
        }
        return 'unlabeled';
    }

    document.addEventListener('click', function (e) {
        var target = e.target.closest && e.target.closest('a, button');
        if (!target) return;
        if (target.hasAttribute('data-track-skip')) return;
        trackEvent('mcyc-format-' + inferLabel(target), 'click');
    });

    // Pageview — once per session, skip announced bots
    try {
        if (!navigator.webdriver && !sessionStorage.getItem('pv-mcyc-format')) {
            sessionStorage.setItem('pv-mcyc-format', '1');
            trackEvent('mcyc-format', 'view');
        }
    } catch (e) { /* sessionStorage disabled — skip dedup, don't fire */ }
})();
