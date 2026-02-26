// legal-footer.js — Shared footer year script for legal pages
(function () {
    'use strict';
    var el = document.getElementById('year');
    if (el) {
        el.textContent = new Date().getFullYear();
    }
})();
