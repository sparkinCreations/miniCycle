/**
 * UI Effects Module (DI-Pure)
 *
 * Handles visual effects and animations including:
 * - Logo background color feedback
 * - Visual indicators for user actions
 *
 * @module modules/ui/uiEffects
 */

import { createDIModule, required, optional, createFallback } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

/**
 * @typedef {Object} UIEffectsDeps
 * @property {Function} querySelector - DOM query function
 * @property {Function} [getLogoTimeoutId] - Get current timeout ID
 * @property {Function} [setLogoTimeoutId] - Set timeout ID for cleanup
 */

const di = createDIModule('UIEffects', {
    querySelector: optional((sel) => document.querySelector(sel)),
    getLogoTimeoutId: optional(() => null),
    setLogoTimeoutId: optional(() => {})
});

/**
 * Set dependencies for UIEffects module
 * @param {UIEffectsDeps} dependencies - Injected dependencies
 */
export const setUIEffectsDependencies = (dependencies) => di.setDependencies(dependencies);

// ============================================================================
// MODULE IMPLEMENTATION
// ============================================================================

/**
 * Temporarily changes the logo background color to indicate an action, then resets it.
 *
 * @param {string} [color='green'] - The temporary background color for the logo.
 * @param {number} [duration=300] - The duration (in milliseconds) before resetting the background.
 */
export function triggerLogoBackground(color = 'green', duration = 300) {
    const deps = di.resolve();

    // Target the specific logo image (not the app name)
    const logo = deps.querySelector('.header-branding .header-logo');

    console.log('Logo element found:', logo);
    console.log('Applying color:', color);

    if (logo) {
        // Clear any existing timeout
        const currentTimeoutId = deps.getLogoTimeoutId?.();

        if (currentTimeoutId) {
            clearTimeout(currentTimeoutId);
            deps.setLogoTimeoutId?.(null);
        }

        // Apply background color
        logo.style.setProperty('background-color', color, 'important');
        logo.style.setProperty('border-radius', '6px', 'important');

        console.log('Background applied:', logo.style.backgroundColor);

        // Remove background after duration
        const newTimeoutId = setTimeout(() => {
            logo.style.backgroundColor = '';
            logo.style.borderRadius = '';
            deps.setLogoTimeoutId?.(null);
            console.log('Background cleared');
        }, duration);

        deps.setLogoTimeoutId?.(newTimeoutId);
    } else {
        console.error('Logo element not found!');
    }
}

console.log('📦 UIEffects module loaded (using diBase)');
