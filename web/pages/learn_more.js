// learn_more.js — FAQ accordion and smooth scroll for Learn More page

(function () {
    'use strict';

    // FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(function (button) {
        button.addEventListener('click', function () {
            var item = button.parentElement;
            var isActive = item.classList.contains('active');

            // Close all items and reset aria-expanded
            document.querySelectorAll('.faq-item').forEach(function (i) {
                i.classList.remove('active');
                i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
            });

            // Open clicked item if it wasn't active
            if (!isActive) {
                item.classList.add('active');
                button.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
    // =========================================================
    // CTA Click Tracking
    // =========================================================
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
        trackEvent('learn-more-' + inferLabel(target), 'click');
    });

    // Pageview — once per session, skip announced bots
    try {
        if (!navigator.webdriver && !sessionStorage.getItem('pv-learn-more')) {
            sessionStorage.setItem('pv-learn-more', '1');
            trackEvent('learn-more', 'view');
        }
    } catch (e) { /* sessionStorage disabled — skip dedup, don't fire */ }
})();
