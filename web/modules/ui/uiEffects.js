/**
 * UI Effects Module (DI-Pure)
 *
 * Handles visual effects and animations including:
 * - Logo background color feedback
 * - Visual indicators for user actions
 *
 * @module modules/ui/uiEffects
 */

// Module-level deps for late injection (DI-pure, no window.* fallbacks)
let _deps = {
    querySelector: null,
    getLogoTimeoutId: null,
    setLogoTimeoutId: null
};

/**
 * Set dependencies for UIEffects module
 * @param {Object} dependencies - Injected dependencies
 */
export function setUIEffectsDependencies(dependencies) {
    const descriptors = {};
    for (const [key, value] of Object.entries(dependencies)) {
        descriptors[key] = { value, writable: true, configurable: true };
    }
    Object.defineProperties(_deps, descriptors);
    console.log('UIEffects dependencies set:', Object.keys(dependencies));
}

/**
 * Temporarily changes the logo background color to indicate an action, then resets it.
 *
 * @param {string} [color='green'] - The temporary background color for the logo.
 * @param {number} [duration=300] - The duration (in milliseconds) before resetting the background.
 */
export function triggerLogoBackground(color = 'green', duration = 300) {
    // Target the specific logo image (not the app name)
    const querySelector = _deps.querySelector || ((sel) => document.querySelector(sel));
    const logo = querySelector('.header-branding .header-logo');

    console.log('Logo element found:', logo);
    console.log('Applying color:', color);

    if (logo) {
        // Clear any existing timeout
        const getLogoTimeoutId = _deps.getLogoTimeoutId;
        const setLogoTimeoutId = _deps.setLogoTimeoutId;

        let currentTimeoutId = null;
        if (typeof getLogoTimeoutId === 'function') {
            currentTimeoutId = getLogoTimeoutId();
        }

        if (currentTimeoutId) {
            clearTimeout(currentTimeoutId);
            if (typeof setLogoTimeoutId === 'function') {
                setLogoTimeoutId(null);
            }
        }

        // Apply background color
        logo.style.setProperty('background-color', color, 'important');
        logo.style.setProperty('border-radius', '6px', 'important');

        console.log('Background applied:', logo.style.backgroundColor);

        // Remove background after duration
        const newTimeoutId = setTimeout(() => {
            logo.style.backgroundColor = '';
            logo.style.borderRadius = '';
            if (typeof setLogoTimeoutId === 'function') {
                setLogoTimeoutId(null);
            }
            console.log('Background cleared');
        }, duration);

        if (typeof setLogoTimeoutId === 'function') {
            setLogoTimeoutId(newTimeoutId);
        }
    } else {
        console.error('Logo element not found!');
    }
}

// DI-pure module (no window.* exports)
console.log('UIEffects module loaded (DI-pure, no window.* exports)');
