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
import { DOM_SELECTORS, Z_INDEX } from '../core/constants.js';

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
 * Uses the checkbox fill color from personalization settings if available, otherwise falls back to green.
 *
 * @param {string} [color='green'] - The temporary background color for the logo (used as fallback).
 * @param {number} [duration=300] - The duration (in milliseconds) before resetting the background.
 */
export function triggerLogoBackground(color = 'green', duration = 300) {
    const deps = di.resolve();

    // Target the specific logo image (not the app name)
    const logo = deps.querySelector(DOM_SELECTORS.HEADER_BRANDING_LOGO);

    if (logo) {
        // Clear any existing timeout
        const currentTimeoutId = deps.getLogoTimeoutId?.();

        if (currentTimeoutId) {
            clearTimeout(currentTimeoutId);
            deps.setLogoTimeoutId?.(null);
        }

        // Get checkbox fill color from personalization settings, fallback to provided color or green
        const checkboxFillColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--pref-checkbox-bg')
            .trim();
        const effectColor = checkboxFillColor || color;

        // Apply background color
        logo.style.setProperty('background-color', effectColor, 'important');
        logo.style.setProperty('border-radius', '6px', 'important');

        // Remove background after duration
        const newTimeoutId = setTimeout(() => {
            logo.style.backgroundColor = '';
            logo.style.borderRadius = '';
            deps.setLogoTimeoutId?.(null);
        }, duration);

        deps.setLogoTimeoutId?.(newTimeoutId);
    }
}

/**
 * Triggers a scan line effect on the logo (used for to-do mode task clearing).
 * A blue rectangle sweeps from top to bottom of the logo.
 *
 * @param {number} [duration=400] - The duration (in milliseconds) of the scan animation.
 */
export function triggerLogoScan(duration = 400) {
    const deps = di.resolve();
    const logo = deps.querySelector(DOM_SELECTORS.HEADER_BRANDING_LOGO);

    if (logo) {
        // Get logo's exact screen position
        const logoRect = logo.getBoundingClientRect();

        // Get clear button color from personalization settings, fallback to blue
        const clearBtnColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--pref-clear-btn')
            .trim() || '#3b82f6';

        // Create scan line element - bold rectangle with fixed positioning and glow
        const scanLine = document.createElement('div');
        scanLine.style.cssText = `
            position: fixed;
            left: ${logoRect.left}px;
            top: ${logoRect.top}px;
            width: ${logoRect.width}px;
            height: 5px;
            background: linear-gradient(90deg, transparent, ${clearBtnColor}, ${clearBtnColor}, ${clearBtnColor}, transparent);
            box-shadow: 0 0 8px ${clearBtnColor}, 0 0 15px ${clearBtnColor}99;
            border-radius: 2px;
            z-index: ${Z_INDEX.MODAL};
            pointer-events: none;
        `;

        // Add scan line to body for reliable positioning
        document.body.appendChild(scanLine);

        // Skip animation frames if user prefers reduced motion
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            scanLine.remove();
            return;
        }

        // Animate from top to bottom
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            scanLine.style.top = `${logoRect.top + (logoRect.height * progress)}px`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                scanLine.remove();
            }
        };

        requestAnimationFrame(animate);
    }
}

console.log('📦 UIEffects module loaded (using diBase)');
