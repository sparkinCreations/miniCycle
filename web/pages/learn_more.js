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
    function trackClick(event) {
        try {
            fetch('/.netlify/functions/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: event }),
            }).catch(function () { /* silent fail — tracking is non-critical */ });
        } catch (e) { /* silent fail */ }
    }

    document.querySelectorAll('a.cta-primary, a.cta-secondary, a.cta-btn').forEach(function (link) {
        link.addEventListener('click', function () {
            var label = this.textContent.trim().toLowerCase().replace(/\s+/g, '-');
            trackClick('learn-more-' + label);
        });
    });
})();
