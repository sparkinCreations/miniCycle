/**
 * Pull-to-Refresh Module for miniCycle PWA
 *
 * Provides mobile pull-to-refresh functionality that:
 * 1. Checks for service worker updates
 * 2. Refreshes UI from state
 * 3. Triggers recurring task check
 *
 * @version 1.390
 * @module pullToRefresh
 */

// Module-level deps for late injection
let _deps = {};

/**
 * Set dependencies for PullToRefresh (call before initPullToRefresh)
 * @param {Object} dependencies - { refreshUIFromState, checkRecurringTasksNow, promptServiceWorkerUpdate, showNotification }
 */
export function setPullToRefreshDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('🔄 PullToRefresh dependencies set:', Object.keys(dependencies));
}

export class PullToRefresh {
    constructor(options = {}) {
        // Merge module-level deps with constructor options
        const mergedDeps = { ..._deps, ...options };

        // Configuration
        this.threshold = options.threshold || 80; // pixels to pull before triggering
        this.maxPull = options.maxPull || 120; // max pull distance
        this.resistance = options.resistance || 2.5; // pull resistance factor
        this.activationDistance = options.activationDistance || 15; // min distance before activating (prevents accidental triggers)

        // Store injected dependencies with window.* backward compatibility for tests
        // Priority: constructor options > module deps > window.* (for test compatibility)
        this.deps = {
            refreshUIFromState: mergedDeps.refreshUIFromState || window.refreshUIFromState,
            checkRecurringTasksNow: mergedDeps.checkRecurringTasksNow || window.checkRecurringTasksNow,
            watchRecurringTasks: mergedDeps.watchRecurringTasks || window.watchRecurringTasks,
            promptServiceWorkerUpdate: mergedDeps.promptServiceWorkerUpdate || window.promptServiceWorkerUpdate,
            showNotification: mergedDeps.showNotification || window.showNotification || console.log
        };

        // Callbacks (injected dependencies)
        this.onRefresh = options.onRefresh || this.defaultRefresh.bind(this);
        this.showNotification = this.deps.showNotification;

        // State
        this.startY = 0;
        this.currentY = 0;
        this.isPulling = false;
        this.isActivated = false; // True once pull exceeds activationDistance
        this.isRefreshing = false;
        this.enabled = true;

        // DOM elements
        this.indicator = null;
        this.spinnerIcon = null;
        this.statusText = null;

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
     * Creates the pull indicator DOM element
     */
    createIndicator() {
        // Check if already exists
        if (document.getElementById('pull-refresh-indicator')) {
            this.indicator = document.getElementById('pull-refresh-indicator');
            this.spinnerIcon = this.indicator.querySelector('.pull-refresh-icon');
            this.statusText = this.indicator.querySelector('.pull-refresh-text');
            return;
        }

        this.indicator = document.createElement('div');
        this.indicator.id = 'pull-refresh-indicator';
        this.indicator.className = 'pull-refresh-indicator';
        this.indicator.innerHTML = `
            <div class="pull-refresh-content">
                <span class="pull-refresh-icon">&#8635;</span>
                <span class="pull-refresh-text">Pull to refresh</span>
            </div>
        `;

        document.body.insertBefore(this.indicator, document.body.firstChild);

        this.spinnerIcon = this.indicator.querySelector('.pull-refresh-icon');
        this.statusText = this.indicator.querySelector('.pull-refresh-text');
    }

    /**
     * Attaches touch event listeners
     */
    attachEventListeners() {
        // Use passive: false for touchmove to allow preventDefault
        document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd, { passive: true });
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
     */
    isAtTop() {
        return window.scrollY <= 0;
    }

    /**
     * Handle touch start
     */
    handleTouchStart(e) {
        if (!this.enabled || this.isRefreshing) return;
        if (!this.isAtTop()) return;

        this.startY = e.touches[0].clientY;
        this.isPulling = true;
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

        // Now we're activated - prevent default scroll behavior
        e.preventDefault();

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
            this.statusText.textContent = 'Release to refresh';
            this.indicator.classList.add('ready');
        } else {
            this.statusText.textContent = 'Pull to refresh';
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
        this.statusText.textContent = 'Pull to refresh';

        // Reset activation state
        this.isActivated = false;
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
        this.statusText.textContent = 'Refreshing...';
        this.spinnerIcon.style.animation = 'pull-refresh-spin 1s linear infinite';

        try {
            // Execute refresh callback
            await this.onRefresh();
        } catch (error) {
            console.error('Pull-to-refresh error:', error);
            this.showNotification('Refresh failed', 'error', 3000);
        } finally {
            // Small delay for visual feedback
            setTimeout(() => {
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
                            this.showNotification('App update available! Reload to update.', 'info', 5000);
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
            this.showNotification('Refreshed', 'success', 2000);
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
        if (this.indicator && this.indicator.parentNode) {
            this.indicator.parentNode.removeChild(this.indicator);
        }
    }
}

// Create singleton instance with miniCycle integration
let pullToRefreshInstance = null;

/**
 * Initialize pull-to-refresh with miniCycle dependencies
 */
export function initPullToRefresh(options = {}) {
    if (pullToRefreshInstance) {
        console.log('Pull-to-refresh already initialized');
        return pullToRefreshInstance;
    }

    // Merge module-level deps with options
    const mergedOptions = { ..._deps, ...options };

    pullToRefreshInstance = new PullToRefresh(mergedOptions);

    // Expose globally for debugging
    window.pullToRefresh = pullToRefreshInstance;

    return pullToRefreshInstance;
}

/**
 * Get the current instance
 */
export function getPullToRefresh() {
    return pullToRefreshInstance;
}

// Auto-init when DOM is ready (if dependencies are available)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for other modules to load
        setTimeout(() => {
            if (_deps.showNotification && !pullToRefreshInstance) {
                initPullToRefresh();
            }
        }, 1000);
    });
}
