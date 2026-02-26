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
})();
