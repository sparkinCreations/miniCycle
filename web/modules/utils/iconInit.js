/**
 * Icon Initialization Module
 * Replaces Font Awesome icons with inline SVGs on page load
 * and provides utilities for dynamic icon replacement
 */

import { ICONS, FA_MAP, getIcon } from './icons.js';

/**
 * Replace a single Font Awesome <i> element with an SVG icon
 * @param {HTMLElement} element - The <i> element to replace
 * @returns {HTMLElement|null} The new span element, or null if replacement failed
 */
export function replaceFAIcon(element) {
    if (!element || !element.className) return null;

    const classes = element.className.split(' ');
    let iconName = null;

    // Find the icon name from FA classes
    for (const cls of classes) {
        if (cls.startsWith('fa-') && !['fa-solid', 'fa-regular', 'fa-brands'].includes(cls)) {
            iconName = cls.replace('fa-', '');
            break;
        }
    }

    if (iconName && ICONS[iconName]) {
        const span = document.createElement('span');
        span.className = 'icon';
        span.innerHTML = ICONS[iconName];
        span.setAttribute('aria-hidden', 'true');

        // Preserve any additional custom classes (not FA classes)
        const customClasses = classes.filter(c =>
            !c.startsWith('fa-') && !['fas', 'far', 'fab', 'fa'].includes(c)
        );
        if (customClasses.length > 0) {
            span.className += ' ' + customClasses.join(' ');
        }

        element.replaceWith(span);
        return span;
    }

    return null;
}

/**
 * Replace all Font Awesome icons in a container
 * @param {HTMLElement} container - Container to search within (defaults to document.body)
 * @returns {number} Number of icons replaced
 */
export function replaceAllFAIcons(container = document.body) {
    const faIcons = container.querySelectorAll('i.fas, i.far, i.fab, i.fa');
    let count = 0;

    faIcons.forEach(icon => {
        if (replaceFAIcon(icon)) {
            count++;
        }
    });

    return count;
}

/**
 * Create an icon span from a Font Awesome class string
 * Useful for creating icons in JavaScript
 * @param {string} faClass - Font Awesome class (e.g., "fas fa-trash")
 * @returns {HTMLElement} The icon span element
 */
export function createIcon(faClass) {
    const classes = faClass.split(' ');
    let iconName = null;

    for (const cls of classes) {
        if (cls.startsWith('fa-') && !['fa-solid', 'fa-regular', 'fa-brands'].includes(cls)) {
            iconName = cls.replace('fa-', '');
            break;
        }
    }

    const span = document.createElement('span');
    span.className = 'icon';
    span.setAttribute('aria-hidden', 'true');

    if (iconName && ICONS[iconName]) {
        span.innerHTML = ICONS[iconName];
    }

    return span;
}

/**
 * Get icon HTML string for use in innerHTML
 * @param {string} name - Icon name (without 'fa-' prefix)
 * @returns {string} HTML string
 */
export function iconHTML(name) {
    const svg = ICONS[name];
    if (!svg) return '';
    return `<span class="icon" aria-hidden="true">${svg}</span>`;
}

/**
 * Initialize icons - replace all FA icons in the document
 * Call this after DOM is ready
 */
export function initIcons() {
    const count = replaceAllFAIcons();
    if (count > 0) {
        console.log(`[Icons] Replaced ${count} Font Awesome icons with SVGs`);
    }
}

// Auto-initialize if DOM is already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIcons);
} else {
    // DOM already loaded, init immediately
    initIcons();
}

export { ICONS, getIcon };
