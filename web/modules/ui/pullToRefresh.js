/**
 * Pull-to-Refresh Module for miniCycle PWA (DI-Pure)
 *
 * Provides mobile pull-to-refresh functionality that:
 * 1. Checks for service worker updates
 * 2. Refreshes UI from state
 * 3. Triggers recurring task check
 *
 * Pattern: Simple Instance ✨
 * - Single responsibility (pull-to-refresh)
 * - Required dependencies via diBase.js
 *
 * Note: document.*, window.scrollY, navigator.serviceWorker are browser APIs,
 * not dependencies - they cannot be injected.
 *
 * @module pullToRefresh
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('PullToRefresh', {
    refreshUIFromState: optional(null),
    checkRecurringTasksNow: optional(null),
    watchRecurringTasks: optional(null),
    promptServiceWorkerUpdate: optional(null),
    showNotification: optional(null),
    isModalOpen: optional(null)
});

// Late-binding deps via Proxy
/** @type {{refreshUIFromState: Function|null, checkRecurringTasksNow: Function|null, watchRecurringTasks: Function|null, promptServiceWorkerUpdate: Function|null, showNotification: Function|null, isModalOpen: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for PullToRefresh (call before initPullToRefresh)
 * @param {Object} dependencies - { refreshUIFromState, checkRecurringTasksNow, watchRecurringTasks, promptServiceWorkerUpdate, showNotification }
 */
export function setPullToRefreshDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🔄 PullToRefresh dependencies set:', Object.keys(dependencies));
}

export class PullToRefresh {
    constructor(options = {}) {
        // Configuration
        this.threshold = options.threshold || 80; // pixels to pull before triggering
        this.maxPull = options.maxPull || 120; // max pull distance
        this.resistance = options.resistance || 2.5; // pull resistance factor
        this.activationDistance = options.activationDistance || 15; // min distance before activating (prevents accidental triggers)

        // Callbacks (can be overridden via constructor)
        this.onRefresh = options.onRefresh || this.defaultRefresh.bind(this);

        // State
        this.startY = 0;
        this.currentY = 0;
        this.isPulling = false;
        this.isActivated = false; // True once pull exceeds activationDistance
        this.isRefreshing = false;
        this.enabled = true;
        this.touchStartTarget = null; // Track where touch started

        // DOM elements
        this.indicator = null;
        this.spinnerIcon = null;
        this.statusText = null;

        // Scrollable containers to check (task list, etc.)
        this.scrollableContainers = options.scrollableContainers || ['.task-list-container'];
        this._cachedContainers = null; // cached DOM references for scrollable containers

        // Timer tracking
        this._resetTimerId = null;

        // Bind methods
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);

        // Initialize
        this.createIndicator();
        this.attachEventListeners();

        console.log('Pull-to-refresh initialized');
    }

    /**
     * Getter for dependencies - resolves from DI module
     */
    get deps() {
        const resolved = di.resolve();
        return {
            ...resolved,
            showNotification: resolved.showNotification || this.fallbackNotification
        };
    }

    /**
     * Fallback notification (console log)
     */
    fallbackNotification(message, type, duration) {
        console.log(`[PullToRefresh - ${type}] ${message}`);
    }

    /**
     * Creates the pull indicator DOM element
     */
    createIndicator() {
        // Check if already exists
        if (document.getElementById(DOM_IDS.PULL_REFRESH_INDICATOR)) {
            this.indicator = document.getElementById(DOM_IDS.PULL_REFRESH_INDICATOR);
            this.spinnerIcon = this.indicator.querySelector(DOM_SELECTORS.PULL_REFRESH_ICON);
            this.statusText = this.indicator.querySelector(DOM_SELECTORS.PULL_REFRESH_TEXT);
            return;
        }

        this.indicator = document.createElement('div');
        this.indicator.id = DOM_IDS.PULL_REFRESH_INDICATOR;
        this.indicator.className = 'pull-refresh-indicator';
        this.indicator.innerHTML = `
            <div class="pull-refresh-content">
                <span class="pull-refresh-icon">&#8635;</span>
                <span class="pull-refresh-text">${getLabel('pullRefresh.pull')}</span>
            </div>
        `;

        document.body.insertBefore(this.indicator, document.body.firstChild);

        this.spinnerIcon = this.indicator.querySelector(DOM_SELECTORS.PULL_REFRESH_ICON);
        this.statusText = this.indicator.querySelector(DOM_SELECTORS.PULL_REFRESH_TEXT);
    }

    /**
     * Attaches touch event listeners
     */
    attachEventListeners() {
        // Use safeAddEventListener to prevent duplicates
        const safeAdd = (el, ev, fn, opts) => { el?.removeEventListener(ev, fn, opts); el?.addEventListener(ev, fn, opts); };

        // Use passive: false for touchmove to allow preventDefault
        safeAdd(document, 'touchstart', this.handleTouchStart, { passive: true });
        safeAdd(document, 'touchmove', this.handleTouchMove, { passive: false });
        safeAdd(document, 'touchend', this.handleTouchEnd, { passive: true });
    }

    /**
     * Removes event listeners (for cleanup)
     */
    detachEventListeners() {
        document.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
    }

    /**
     * Checks if page is scrolled to top
     * Also checks if any scrollable container the touch started in is at the top
     */
    isAtTop() {
        // Window must be at top
        if (window.scrollY > 0) return false;

        // If touch started inside a scrollable container, that container must also be at top
        if (this.touchStartTarget) {
            // Cache container DOM references (re-query if cache is stale)
            if (!this._cachedContainers) {
                this._cachedContainers = this.scrollableContainers
                    .map(selector => document.querySelector(selector))
                    .filter(Boolean);
            }

            for (const container of this._cachedContainers) {
                if (container.contains(this.touchStartTarget)) {
                    if (container.scrollTop > 0) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * Handle touch start
     */
    handleTouchStart(e) {
        if (!this.enabled || this.isRefreshing) return;

        // Only allow pull-to-refresh on main task view
        if (!this.isMainTaskViewActive()) return;

        // Store the touch target to check scrollable containers
        this.touchStartTarget = e.target;
        // Invalidate cached containers in case DOM changed since last gesture
        this._cachedContainers = null;

        if (!this.isAtTop()) {
            this.touchStartTarget = null;
            return;
        }

        this.startY = e.touches[0].clientY;
        this.isPulling = true;
    }

    /**
     * Check if main task view is active (no modals, menus, or stats view open)
     * @returns {boolean} True if pull-to-refresh should be allowed
     */
    isMainTaskViewActive() {
        // Check if any modal is open via dependency
        if (this.deps.isModalOpen?.()) return false;

        // Check for stats view being active
        const statsPanel = document.querySelector(DOM_SELECTORS.STATS_PANEL);
        if (statsPanel && (statsPanel.classList.contains('active') || statsPanel.classList.contains('show'))) {
            return false;
        }

        // Check for any visible modal (data-modal covers most; specific selectors catch the rest)
        const modals = document.querySelectorAll(`${DOM_SELECTORS.DATA_MODAL}, ${DOM_SELECTORS.SETTINGS_MODAL}, ${DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL}, ${DOM_SELECTORS.PREFERENCES_MODAL}, ${DOM_SELECTORS.TESTING_MODAL}, ${DOM_SELECTORS.FEEDBACK_MODAL}`);
        for (const modal of modals) {
            const style = window.getComputedStyle(modal);
            if (style.display !== 'none' && (modal.classList.contains('active') || modal.classList.contains('show') || style.display === 'flex')) {
                return false;
            }
        }

        // Check if main menu is open
        const mainMenu = document.querySelector(DOM_SELECTORS.MAIN_MENU);
        if (mainMenu && (mainMenu.classList.contains('active') || mainMenu.classList.contains('show'))) {
            return false;
        }

        // Check for hamburger menu open
        const hamburgerMenu = document.querySelector(DOM_SELECTORS.HAMBURGER_MENU);
        if (hamburgerMenu && hamburgerMenu.classList.contains('open')) {
            return false;
        }

        return true;
    }

    /**
     * Handle touch move - the main pull logic
     */
    handleTouchMove(e) {
        if (!this.isPulling || this.isRefreshing) return;
        if (!this.isAtTop()) {
            this.resetIndicator();
            this.isPulling = false;
            this.isActivated = false;
            return;
        }

        this.currentY = e.touches[0].clientY;
        const rawPullDistance = this.currentY - this.startY;
        const pullDistance = rawPullDistance / this.resistance;

        // Only activate when pulling down
        if (pullDistance <= 0) {
            this.resetIndicator();
            this.isActivated = false;
            return;
        }

        // Check if we've passed the activation threshold
        // Only then do we prevent default and take over scrolling
        if (!this.isActivated) {
            if (rawPullDistance >= this.activationDistance) {
                this.isActivated = true;
            } else {
                // Not activated yet - allow normal scroll behavior
                return;
            }
        }

        // Now we're activated - prevent default scroll behavior (only if cancelable)
        if (e.cancelable) {
            e.preventDefault();
        }

        // Clamp pull distance
        const clampedDistance = Math.min(pullDistance, this.maxPull);

        // Update indicator position and state
        this.updateIndicator(clampedDistance);
    }

    /**
     * Handle touch end - trigger refresh if threshold met
     */
    handleTouchEnd() {
        if (!this.isPulling) return;

        const pullDistance = (this.currentY - this.startY) / this.resistance;

        if (this.isActivated && pullDistance >= this.threshold && !this.isRefreshing) {
            this.triggerRefresh();
        } else {
            this.resetIndicator();
        }

        this.isPulling = false;
        this.isActivated = false;
        this.startY = 0;
        this.currentY = 0;
        this.touchStartTarget = null;
    }

    /**
     * Updates the visual indicator based on pull distance
     */
    updateIndicator(distance) {
        if (!this.indicator) return;

        // Show indicator
        this.indicator.classList.add('visible');

        // Update position
        this.indicator.style.transform = `translateY(${distance - 60}px)`;

        // Update rotation of icon based on pull progress
        const progress = Math.min(distance / this.threshold, 1);
        this.spinnerIcon.style.transform = `rotate(${progress * 180}deg)`;

        // Update text based on threshold
        if (distance >= this.threshold) {
            this.statusText.textContent = getLabel('pullRefresh.release');
            this.indicator.classList.add('ready');
        } else {
            this.statusText.textContent = getLabel('pullRefresh.pull');
            this.indicator.classList.remove('ready');
        }
    }

    /**
     * Resets the indicator to hidden state
     */
    resetIndicator() {
        if (!this.indicator) return;

        this.indicator.classList.remove('visible', 'ready', 'refreshing');
        this.indicator.style.transform = 'translateY(-60px)';
        this.spinnerIcon.style.transform = 'rotate(0deg)';
        this.statusText.textContent = getLabel('pullRefresh.pull');

        // Reset activation state
        this.isActivated = false;
        this.touchStartTarget = null;
    }

    /**
     * Triggers the refresh action
     */
    async triggerRefresh() {
        if (this.isRefreshing) return;

        this.isRefreshing = true;

        // Update UI to show refreshing state
        this.indicator.classList.add('refreshing');
        this.indicator.style.transform = 'translateY(10px)';
        this.statusText.textContent = getLabel('pullRefresh.refreshing');
        if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            this.spinnerIcon.style.animation = 'pull-refresh-spin 1s linear infinite';
        }

        try {
            // Execute refresh callback
            await this.onRefresh();
        } catch (error) {
            console.error('Pull-to-refresh error:', error);
            this.deps.showNotification(getLabel('notify.refreshFailed'), 'error', 3000);
        } finally {
            // Small delay for visual feedback
            this._resetTimerId = setTimeout(() => {
                this._resetTimerId = null;
                this.isRefreshing = false;
                this.spinnerIcon.style.animation = '';
                this.resetIndicator();
            }, 500);
        }
    }

    /**
     * Default refresh behavior
     * Checks SW updates, refreshes UI, checks recurring tasks
     */
    async defaultRefresh() {
        const results = {
            swUpdate: false,
            uiRefreshed: false,
            recurringChecked: false
        };

        // 1. Check for service worker updates
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();

                    // Check if there's a waiting worker (update available)
                    if (registration.waiting) {
                        results.swUpdate = true;

                        // Prompt user about update
                        if (this.deps.promptServiceWorkerUpdate) {
                            this.deps.promptServiceWorkerUpdate();
                        } else {
                            this.deps.showNotification(getLabel('notify.updateAvailableReload'), 'info', 5000);
                        }
                    }
                }
            } catch (err) {
                console.warn('SW update check failed:', err);
            }
        }

        // 2. Refresh UI from state
        if (this.deps.refreshUIFromState) {
            try {
                this.deps.refreshUIFromState();
                results.uiRefreshed = true;
            } catch (err) {
                console.warn('UI refresh failed:', err);
            }
        }

        // 3. Check recurring tasks
        if (this.deps.checkRecurringTasksNow) {
            try {
                await this.deps.checkRecurringTasksNow();
                results.recurringChecked = true;
            } catch (err) {
                console.warn('Recurring check failed:', err);
            }
        } else if (this.deps.watchRecurringTasks) {
            try {
                await this.deps.watchRecurringTasks();
                results.recurringChecked = true;
            } catch (err) {
                console.warn('Recurring check failed:', err);
            }
        }

        // Show result notification
        if (results.swUpdate) {
            // Already showed update notification
        } else if (results.uiRefreshed || results.recurringChecked) {
            this.deps.showNotification(getLabel('notify.refreshed'), 'success', 2000);
        }

        return results;
    }

    /**
     * Enable pull-to-refresh
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable pull-to-refresh
     */
    disable() {
        this.enabled = false;
        this.resetIndicator();
    }

    /**
     * Cleanup - removes event listeners and DOM element
     */
    destroy() {
        this.detachEventListeners();
        if (this._resetTimerId) {
            clearTimeout(this._resetTimerId);
            this._resetTimerId = null;
        }
        this._cachedContainers = null;
        if (this.indicator && this.indicator.parentNode) {
            this.indicator.parentNode.removeChild(this.indicator);
        }
    }
}

// Create singleton instance with miniCycle integration
let pullToRefreshInstance = null;

/**
 * Initialize pull-to-refresh with miniCycle dependencies
 * @param {Object} options - Configuration options (threshold, maxPull, etc.)
 */
export function initPullToRefresh(options = {}) {
    if (pullToRefreshInstance) {
        console.log('Pull-to-refresh already initialized');
        return pullToRefreshInstance;
    }

    pullToRefreshInstance = new PullToRefresh(options);

    return pullToRefreshInstance;
}

/**
 * Get the current instance
 */
export function getPullToRefresh() {
    return pullToRefreshInstance;
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🔄 PullToRefresh module loaded (DI-pure, no window.* exports)');
