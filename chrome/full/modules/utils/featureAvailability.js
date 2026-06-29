/**
 * Feature Availability Tracker
 *
 * When an OPTIONAL module fails to load, moduleLoader currently swallows the error
 * (logs + returns null) so the app stays up — but the user gets no signal that a
 * feature is silently missing. This tracker records those failures, flags a degraded
 * mode (a `data-degraded-mode` hook on <html> for CSS), and surfaces a single,
 * non-blocking notification after boot. Fail loud, not silent.
 *
 * Boot-level leaf singleton (imported directly by moduleLoader before the DI/manifest
 * system is wired) — intentionally NOT a createDIModule. It has no injected deps;
 * showNotification + getLabel are only used post-boot when both are ready.
 *
 * @module modules/utils/featureAvailability
 */

import { getLabel } from '../labels/labelResolver.js';

// Module key → user-facing display name. Unmapped keys fall back to the raw key.
const FRIENDLY_NAMES = {
    gamesManager: 'Mini Games',
    statsPanel: 'Statistics',
    pullToRefresh: 'Pull to Refresh',
    helpWindowManager: 'Help Windows',
    guidedTourManager: 'Guided Tour',
    consoleCapture: 'Debug Console',
    testingModal: 'Testing Tools',
    basicPluginSystem: 'Plugins'
};

class FeatureAvailability {
    constructor() {
        this.failedFeatures = new Map();
        this.warningShown = false;
    }

    get degradedMode() {
        return this.failedFeatures.size > 0;
    }

    /**
     * Record that an optional feature failed to load.
     * @param {string} featureName - manifest/module key
     * @param {Error} error
     */
    markFailed(featureName, error) {
        if (this.failedFeatures.has(featureName)) return;
        this.failedFeatures.set(featureName, {
            error: error?.message || String(error),
            stack: error?.stack
        });
        // CSS/UI hook — lets stylesheets or a future indicator react to degraded mode.
        try {
            if (typeof document !== 'undefined') {
                document.documentElement.dataset.degradedMode = 'true';
            }
        } catch { /* non-DOM context (tests/SW) — ignore */ }
        console.warn(`⚠️ Feature unavailable: ${featureName}`, error?.message || error);
    }

    /**
     * @param {string} featureName
     * @returns {boolean} true unless the feature failed to load
     */
    isAvailable(featureName) {
        return !this.failedFeatures.has(featureName);
    }

    /**
     * @returns {Array<{name: string, error: string, stack?: string}>}
     */
    getFailedFeatures() {
        return Array.from(this.failedFeatures.entries()).map(([name, info]) => ({ name, ...info }));
    }

    /**
     * Show a one-time, non-blocking "reduced functionality" notice. No-op if nothing
     * failed or it's already been shown.
     * @param {Function} showNotification - (message, type, duration) => void
     */
    showDegradedModeWarning(showNotification) {
        if (this.warningShown || this.failedFeatures.size === 0) return;
        this.warningShown = true;

        const displayNames = Array.from(this.failedFeatures.keys())
            .map(f => FRIENDLY_NAMES[f] || f)
            .join(', ');

        if (typeof showNotification === 'function') {
            showNotification(
                getLabel('notify.featuresUnavailable', { vars: { features: displayNames } }),
                'warning',
                8000
            );
        }
    }

    /** Plain-text report of failures (for the testing/diagnostics surfaces). */
    exportReport() {
        if (this.failedFeatures.size === 0) return 'No features failed to load.';
        return this.getFailedFeatures().map(f => `${f.name}: ${f.error}`).join('\n');
    }

    /** Reset (primarily for tests). */
    reset() {
        this.failedFeatures.clear();
        this.warningShown = false;
        try {
            if (typeof document !== 'undefined') {
                delete document.documentElement.dataset.degradedMode;
            }
        } catch { /* ignore */ }
    }
}

export const featureAvailability = new FeatureAvailability();
export default featureAvailability;
