/**
 * Help Window Manager Module (DI-Pure)
 *
 * Manages the help window that shows task status and cycle completion messages.
 *
 * @module ui/helpWindowManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, APP_VERSION, BREAKPOINTS } from '../core/constants.js';

// Vertical chrome above/below the task view — MUST match task-list.css
// `max-height: calc(100vh - 385px)` (header + 200px bottom padding). The
// side-layout hysteresis compares content height against the same budget.
const VIEWPORT_CHROME_PX = 385;
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Toast message label map for cycle completion
const TOAST_LABEL_MAP = {
    'default': 'help.cycleComplete',
    'greatJob': 'prefs.toastGreatJob',
    'nailed': 'prefs.toastNailed',
    'finished': 'prefs.toastFinished',
};

// Storage utilities - dynamically loaded to avoid ES module cache issues
let getObjectSizeBytes, formatBytes;

// Undo manager utilities
let getUndoCacheSizeBytes;

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('HelpWindowManager', {
    loadMiniCycleData: optional(null),
    AppState: optional(null),
    safeAddEventListener: optional(null),
    getModal: optional(null)
});

// Late-binding deps via Proxy (standard: _deps with underscore prefix)
/** @type {{loadMiniCycleData: Function|null, AppState: Object|null, safeAddEventListener: Function|null, getModal: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for HelpWindowManager.
 * @param {Object} dependencies - Injected dependencies
 * @returns {void}
 */
export function setHelpWindowManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Manages the help window UI component.
 */
export class HelpWindowManager {
    constructor() {
        this.helpWindow = _deps.getModal('help');
        this.isVisible = false;
        this.currentMessage = null;
        this._currentPartsKey = null;
        this.isShowingCycleComplete = false;
        this.isShowingModeDescription = false;
        this.currentMode = null;
        this.modeDescriptionTimeout = null;
        this.initialized = false;
        this.sideLayoutEnabled = false;
        this._pendingTimeouts = [];
        this._customizerTipShownOnHover = false;

        this.init();
    }

    /**
     * Check if help window should be in side layout (desktop only, task list overflowing)
     * When task list reaches max height and starts scrolling, move help window to side
     * to give more vertical space to the task list
     */
    updateSideLayout() {
        const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
        const taskListContainer = document.querySelector(DOM_SELECTORS.TASK_LIST_CONTAINER);

        if (!taskView || !taskListContainer) return;

        // Only apply on desktop (1024px+)
        const isDesktop = window.innerWidth >= BREAKPOINTS.DESKTOP_MIN;

        if (!isDesktop) {
            // On mobile/tablet, always use bottom layout
            if (this.sideLayoutEnabled) {
                this.sideLayoutEnabled = false;
                taskView.classList.remove(DOM_CLASSES.HELP_WINDOW_SIDE);
            }
            return;
        }

        // Calculate if content would overflow at the normal (smaller) max-height
        // Normal max-height is calc(100vh - 385px), side layout is calc(100vh - 250px)
        // Difference is 135px - so if content exceeds visible + 135px buffer, keep side layout
        const scrollHeight = taskListContainer.scrollHeight;
        const clientHeight = taskListContainer.clientHeight;
        const isOverflowing = scrollHeight > clientHeight;

        // Use hysteresis to prevent flip-flopping:
        // - Enable when overflowing
        // - Disable only when content fits comfortably (with buffer)
        const bufferPx = 100; // Buffer to prevent rapid toggling

        let shouldEnableSideLayout;
        if (this.sideLayoutEnabled) {
            // Currently in side layout - only disable if content fits with buffer
            // Check against the smaller max-height threshold
            const normalMaxHeight = window.innerHeight - VIEWPORT_CHROME_PX;
            shouldEnableSideLayout = scrollHeight > (normalMaxHeight - bufferPx);
        } else {
            // Currently in bottom layout - enable if overflowing
            shouldEnableSideLayout = isOverflowing;
        }

        if (shouldEnableSideLayout !== this.sideLayoutEnabled) {
            this.sideLayoutEnabled = shouldEnableSideLayout;
            taskView.classList.toggle(DOM_CLASSES.HELP_WINDOW_SIDE, shouldEnableSideLayout);
        }
    }

    init() {
        if (this.initialized) {
            console.warn('⚠️ HelpWindowManager already initialized');
            return;
        }
        if (!this.helpWindow) return;

        this.initialized = true;

        // Show welcome message immediately
        this.currentMessage = getLabel('help.welcome');
        this.updateContent(this.currentMessage);
        this.helpWindow.classList.add(DOM_CLASSES.SHOW);
        this.isVisible = true;

        // Switch to normal help message after delay
        this._pendingTimeouts.push(setTimeout(() => {
            this.showConstantMessage();
        }, 3000));

        this.setupEventListeners();
    }

    setupEventListeners() {
        // ✅ FIX: Only set up handlers once - idempotency guard to prevent accumulation
        if (this._eventListenersInitialized) {
            return;
        }
        this._eventListenersInitialized = true;

        // Use injected safeAddEventListener (strict DI - no fallback)
        const safeAdd = _deps.safeAddEventListener;

        // Listen for checkbox changes on tasks
        this._changeHandler = (e) => {
            // Guard: e.target may not have closest() if event dispatched on document
            if (e.target?.type === 'checkbox' && e.target?.closest?.(DOM_SELECTORS.TASK)) {
                this._pendingTimeouts.push(setTimeout(() => {
                    this.updateConstantMessage();
                }, 50));
            }
        };
        safeAdd(document, 'change', this._changeHandler);

        // Listen for click events on tasks
        this._clickHandler = (e) => {
            // Guard: e.target may not have closest() if event dispatched on document
            if (e.target?.closest?.(DOM_SELECTORS.TASK)) {
                this._pendingTimeouts.push(setTimeout(() => {
                    this.updateConstantMessage();
                }, 100));
            }
        };
        safeAdd(document, 'click', this._clickHandler);

        // Listen for task list mutations (task additions/deletions)
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        if (taskList) {
            // Disconnect previous observer if re-initialized
            if (this._taskListObserver) {
                this._taskListObserver.disconnect();
            }

            this._taskListObserver = new MutationObserver((mutations) => {
                let shouldUpdate = false;

                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' &&
                        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                        shouldUpdate = true;
                    }
                });

                if (shouldUpdate) {
                    this._pendingTimeouts.push(setTimeout(() => {
                        this.updateConstantMessage();
                        this.updateSideLayout();
                    }, 200));
                }
            });

            this._taskListObserver.observe(taskList, {
                childList: true,
                subtree: true
            });
        }

        // Listen for window resize to update side layout
        this._resizeHandler = () => {
            this.updateSideLayout();
        };
        // Debounce resize handler — stored as instance property for cleanup
        this._debouncedResizeHandler = () => {
            clearTimeout(this._resizeTimeout);
            this._resizeTimeout = setTimeout(this._resizeHandler, UI_TIMEOUTS.RESIZE_DEBOUNCE);
        };
        window.addEventListener('resize', this._debouncedResizeHandler);

        // Initial side layout check after a delay (tasks may still be loading)
        this._pendingTimeouts.push(setTimeout(() => {
            this.updateSideLayout();
        }, 500));

        // Listen for custom events
        this._taskCompletedHandler = () => {
            this.updateConstantMessage();
        };
        safeAdd(document, 'taskCompleted', this._taskCompletedHandler);

        this._tasksResetHandler = () => {
            this.updateConstantMessage();
        };
        safeAdd(document, 'tasksReset', this._tasksResetHandler);
    }

    showConstantMessage() {
        this.updateConstantMessage();
        this.show();
    }

    updateConstantMessage() {
        // Don't update if showing cycle completion message or mode description
        if (this.isShowingCycleComplete || this.isShowingModeDescription) return;

        const parts = this.getCurrentStatusMessage();
        const partsKey = `${parts.icon}|${parts.body}|${parts.size}`;

        if (partsKey !== this._currentPartsKey) {
            this._currentPartsKey = partsKey;
            this.currentMessage = parts;
            if (this.isVisible) {
                this._renderStatusContent(parts);
            }
        }
    }

    /**
     * Re-render the current help window content with fresh labels.
     * Called when the vocabulary theme changes so themed labels update
     * regardless of which state the help window is in (mode description,
     * cycle complete, or normal status message).
     */
    refreshLabels() {
        if (!this.helpWindow) return;

        if (this.isShowingModeDescription && this.currentMode) {
            // Re-render mode description with new themed labels
            this.showModeDescription(this.currentMode);
            return;
        }

        if (this.isShowingCycleComplete) {
            this.showCycleCompleteMessage();
            return;
        }

        // Force re-evaluation of the constant message by clearing the cache
        this.currentMessage = null;
        this._currentPartsKey = null;
        this.updateConstantMessage();
    }

    /**
     * Shows mode description temporarily.
     * @param {string} mode - The mode to describe
     * @returns {void}
     */
    showModeDescription(mode) {
        if (!this.helpWindow) return;

        // Clear any existing timeout
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }

        this.isShowingModeDescription = true;
        this.currentMode = mode;

        // Add class to task-view for CSS to reduce task card height
        const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
        taskView?.classList.add(DOM_CLASSES.MODE_DESCRIPTION_VISIBLE);

        const modeDescriptions = {
            'auto-cycle': {
                title: "🔄 " + getLabel('mode.autoTitle'),
                description: getLabel('help.modeAutoShort')
            },
            'manual-cycle': {
                title: "✋ " + getLabel('mode.manualTitle'),
                description: getLabel('help.modeManualShort')
            },
            'todo-mode': {
                title: "📋 " + getLabel('mode.todoTitle'),
                description: getLabel('help.modeTodoShort')
            }
        };

        const modeInfo = modeDescriptions[mode] || modeDescriptions['auto-cycle'];

        this.helpWindow.innerHTML = `
            <div class="mode-help-content">
                <h4 style="margin: 0 0 8px 0;">${modeInfo.title}</h4>
                <p style="margin: 0; line-height: 1.4;">${modeInfo.description}</p>
            </div>
        `;

        // Show the help window if it's not already visible
        if (!this.isVisible) {
            this.show();
        }

        // Auto-hide after 30 seconds and return to normal message
        this.modeDescriptionTimeout = setTimeout(() => {
            this.isShowingModeDescription = false;
            this.modeDescriptionTimeout = null;
            // Remove class from task-view
            const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
            taskView?.classList.remove(DOM_CLASSES.MODE_DESCRIPTION_VISIBLE);
            this.updateConstantMessage();
        }, 30000);

    }

    /**
     * Shows cycle completion message.
     */
    showCycleCompleteMessage() {
        if (!this.helpWindow) return;

        // Check if toast is disabled
        const state = _deps.AppState?.get?.();
        if (state?.settings?.disableCompletionToast) return;

        // Clear mode description if showing
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
            this.isShowingModeDescription = false;
            // Remove class from task-view
            const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
            taskView?.classList.remove(DOM_CLASSES.MODE_DESCRIPTION_VISIBLE);
        }

        // Use selected toast message
        const toastKey = state?.settings?.cycleCompletionToast || 'default';
        const toastMessage = getLabel(TOAST_LABEL_MAP[toastKey] || 'help.cycleComplete');

        this.isShowingCycleComplete = true;
        this.helpWindow.innerHTML = `
            <p>✅ ${toastMessage}</p>
        `;

        // Auto-hide after 2 seconds and return to normal message
        this._pendingTimeouts.push(setTimeout(() => {
            this.isShowingCycleComplete = false;
            this.updateConstantMessage();
        }, 2000));
    }

    /**
     * Shows tasks cleared message (for To-Do mode).
     * @param {number} count - Number of tasks cleared
     * @returns {void}
     */
    showTasksClearedMessage(count = 0) {
        if (!this.helpWindow) return;

        // Clear mode description if showing
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
            this.isShowingModeDescription = false;
            const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
            taskView?.classList.remove(DOM_CLASSES.MODE_DESCRIPTION_VISIBLE);
        }

        this.isShowingCycleComplete = true; // Reuse flag to prevent updates
        const taskWord = getLabel('noun.task', { count });
        this.helpWindow.innerHTML = `
            <p>🧹 ${getLabel('help.tasksCleared', { vars: { count, taskWord } })}</p>
        `;

        // Auto-hide after 2 seconds and return to normal message
        this._pendingTimeouts.push(setTimeout(() => {
            this.isShowingCycleComplete = false;
            this.updateConstantMessage();
        }, 2000));
    }

    /**
     * Shows a contextual tip about the task options customizer.
     * @param {'three-dots'|'hover'} trigger - What triggered the tip
     *   - 'three-dots': show every time (user pressed three-dots button)
     *   - 'hover': show only once per page reload (first desktop hover)
     * @returns {void}
     */
    showCustomizerTip(trigger) {
        if (!this.helpWindow) return;

        // Hover tip: only show once per page reload
        if (trigger === 'hover') {
            if (this._customizerTipShownOnHover) return;
            this._customizerTipShownOnHover = true;
        }

        // Don't interrupt cycle complete message
        if (this.isShowingCycleComplete) return;

        // Clear any existing mode description timeout
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }

        this.isShowingModeDescription = true;
        this.currentMode = null; // Not a mode description — refreshLabels() will fall through to updateConstantMessage()

        const tipText = getLabel('help.customizerTip');
        this.helpWindow.innerHTML = `
            <div class="mode-help-content">
                <p style="margin: 0; line-height: 1.4;">${tipText}</p>
            </div>
        `;

        // Auto-hide after 10 seconds
        this.modeDescriptionTimeout = setTimeout(() => {
            this.isShowingModeDescription = false;
            this.modeDescriptionTimeout = null;
            const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
            taskView?.classList.remove(DOM_CLASSES.MODE_DESCRIPTION_VISIBLE);
            // Force re-evaluation by clearing cached message (same pattern as refreshLabels)
            this.currentMessage = null;
            this.updateConstantMessage();
        }, 10000);
    }

    /**
     * Shows a message about recurring tasks being removed after cycle reset or task clearing.
     * Chains after the 2-second cycle-complete or tasks-cleared message.
     */
    showRecurringRemovedMessage() {
        if (!this.helpWindow) return;

        // Don't interrupt cycle complete message (this should be called with a delay)
        if (this.isShowingCycleComplete) return;

        // Clear any existing mode description timeout
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }

        this.isShowingModeDescription = true;
        this.currentMode = null; // Not a mode description — refreshLabels() will fall through to updateConstantMessage()

        const message = getLabel('help.recurringRemoved');
        this.helpWindow.innerHTML = `
            <div class="mode-help-content">
                <p style="margin: 0; line-height: 1.4;">${message}</p>
            </div>
        `;

        // Auto-hide after 10 seconds
        this.modeDescriptionTimeout = setTimeout(() => {
            this.isShowingModeDescription = false;
            this.modeDescriptionTimeout = null;
            const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
            taskView?.classList.remove(DOM_CLASSES.MODE_DESCRIPTION_VISIBLE);
            // Force re-evaluation by clearing cached message
            this.currentMessage = null;
            this.updateConstantMessage();
        }, 10000);
    }

    /**
     * Build the parts of the current status message.
     * Returns a structured object so the renderer can wrap the leading
     * icon and the storage-size suffix in their own spans (used by
     * focus mode to hide them via CSS).
     * @returns {{icon: string, body: string, size: string}}
     */
    getCurrentStatusMessage() {
        const totalTasks = document.querySelectorAll(DOM_SELECTORS.TASK).length;
        const completedTasks = document.querySelectorAll(DOM_SELECTORS.TASK_INPUT_CHECKED).length;
        const remaining = totalTasks - completedTasks;

        // Get cycle count, cleared tasks, mode, and size from Schema 2.5 (DI-pure, no window.* fallbacks)
        let cycleCount = 0;
        let clearedTasksCount = 0;
        let isToDoMode = false;
        let routineSize = '';

        // Prefer AppState if available, fall back to loadMiniCycleData
        if (_deps.AppState?.isReady?.()) {
            const state = _deps.AppState.get();
            if (state) {
                const activeCycle = state.appState?.activeCycleId;
                const currentCycle = state.data?.cycles?.[activeCycle];
                cycleCount = currentCycle?.cycleCount || 0;
                clearedTasksCount = currentCycle?.clearedTasks?.totalCleared || 0;
                isToDoMode = currentCycle?.deleteCheckedTasks === true;
                // Calculate routine size including undo history (~ indicates estimate)
                if (currentCycle) {
                    const cycleDataSize = getObjectSizeBytes(currentCycle);
                    const undoSize = getUndoCacheSizeBytes();
                    routineSize = `~${formatBytes(cycleDataSize + undoSize)}`;
                }
            }
        } else if (typeof _deps.loadMiniCycleData === 'function') {
            const schemaData = _deps.loadMiniCycleData();
            if (schemaData) {
                const { cycles, activeCycle } = schemaData;
                const currentCycle = cycles[activeCycle];
                cycleCount = currentCycle?.cycleCount || 0;
                clearedTasksCount = currentCycle?.clearedTasks?.totalCleared || 0;
                isToDoMode = currentCycle?.deleteCheckedTasks === true;
                // Calculate routine size including undo history (~ indicates estimate)
                if (currentCycle) {
                    const cycleDataSize = getObjectSizeBytes(currentCycle);
                    const undoSize = getUndoCacheSizeBytes();
                    routineSize = `~${formatBytes(cycleDataSize + undoSize)}`;
                }
            }
        }

        // Mode-aware progress text: show cleared tasks in To-Do mode, cycles in other modes
        const progressText = isToDoMode
            ? getLabel('help.progressCleared', { vars: { count: clearedTasksCount, taskWord: getLabel('noun.task', { count: clearedTasksCount }) } })
            : getLabel('help.progressCycles', { vars: { count: cycleCount, cycleWord: getLabel('noun.cycle', { count: cycleCount }) } });

        // Return parts for different constant messages based on state.
        // `body` is the preamble (e.g. "3 tasks remaining"); `cta` is the
        // post-bullet phrase (e.g. "Complete your first cycle!"). The
        // renderer joins them with " • " and wraps `cta` in a nowrap span
        // so when the line wraps it breaks at the bullet rather than
        // splitting the call-to-action mid-phrase.
        if (totalTasks === 0) {
            return { icon: '📝', body: getLabel('help.addFirstTask'), cta: progressText, size: routineSize };
        }

        if (remaining === 0 && totalTasks > 0) {
            return { icon: '🎉', body: getLabel('help.allComplete'), cta: progressText, size: routineSize };
        }

        const remainingText = getLabel('help.tasksRemaining', { vars: { remaining, taskWord: getLabel('noun.task', { count: remaining }) } });

        // First-time message for either mode
        if (isToDoMode && clearedTasksCount === 0) {
            return { icon: '📋', body: remainingText, cta: getLabel('help.clearFirst'), size: routineSize };
        }
        if (!isToDoMode && cycleCount === 0) {
            return { icon: '📋', body: remainingText, cta: getLabel('help.completeFirst'), size: routineSize };
        }

        // Show progress and cycle count or cleared tasks
        return { icon: '📋', body: remainingText, cta: progressText, size: routineSize };
    }

    /**
     * Render structured status parts inside the help window.
     * Wraps the leading icon and storage-size in dedicated spans so
     * focus mode can strip them via CSS (.help-window-icon / .help-window-size).
     * Each dynamic part is escaped individually for XSS safety (Fix #40).
     * @param {{icon: string, body: string, size: string}} parts
     * @returns {void}
     */
    _renderStatusContent(parts) {
        if (!this.helpWindow) return;

        const escapeHtml = (str) => {
            if (typeof str !== 'string') return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
        };

        const iconHtml = parts.icon
            ? `<span class="help-window-icon">${escapeHtml(parts.icon)} </span>`
            : '';
        const sizeHtml = parts.size
            ? `<span class="help-window-size"> • 💾 ${escapeHtml(parts.size)}</span>`
            : '';
        // Wrap the preamble + CTA in their own inline spans with
        // white-space: nowrap. The browser keeps each span intact, so
        // when the line wraps the only valid break point is the gap
        // between the spans — giving a clean preamble-on-line-1 /
        // CTA-on-line-2 split rather than tearing either phrase
        // mid-word. The leading " • " is inside the CTA span so it
        // travels with the CTA when it drops to the second line.
        const bodyHtml = `<span class="help-window-body">${escapeHtml(parts.body)}</span>`;
        // Leading space lives OUTSIDE the CTA span — that's the only
        // valid break opportunity between the two nowrap spans, so it's
        // where the browser wraps when the line is too narrow.
        const ctaHtml = parts.cta
            ? ` <span class="help-window-cta">• ${escapeHtml(parts.cta)}</span>`
            : '';

        this.helpWindow.innerHTML = `<p>${iconHtml}${bodyHtml}${ctaHtml}${sizeHtml}</p>`;
    }

    updateContent(message) {
        if (!this.helpWindow) return;

        // Fix #40: Escape message to prevent XSS
        const escapeHtml = (str) => {
            if (typeof str !== 'string') return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
        };

        this.helpWindow.innerHTML = `
            <p>${escapeHtml(message)}</p>
        `;
    }

    show() {
        if (!this.helpWindow || this.isVisible) return;

        if (!this.isShowingModeDescription && !this.isShowingCycleComplete) {
            // currentMessage is either a parts object (normal status) or a
            // plain string (e.g. the welcome message during init).
            if (this.currentMessage && typeof this.currentMessage === 'object') {
                this._renderStatusContent(this.currentMessage);
            } else if (typeof this.currentMessage === 'string') {
                this.updateContent(this.currentMessage);
            } else {
                this._renderStatusContent(this.getCurrentStatusMessage());
            }
        }

        this.helpWindow.classList.remove(DOM_CLASSES.HIDE);
        this.helpWindow.classList.add(DOM_CLASSES.SHOW);
        // Don't toggle display - use opacity only to prevent CLS
        this.isVisible = true;
    }

    hide() {
        if (!this.helpWindow || !this.isVisible) return;

        this.helpWindow.classList.remove(DOM_CLASSES.SHOW);
        this.helpWindow.classList.add(DOM_CLASSES.HIDE);
        this.isVisible = false;
        // Don't toggle display - use opacity only to prevent CLS
    }

    destroy() {
        // Clear any active timeouts
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
            this.isShowingModeDescription = false;
        }
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
            this._resizeTimeout = null;
        }
        for (const id of this._pendingTimeouts) {
            clearTimeout(id);
        }
        this._pendingTimeouts = [];

        // Remove event listeners
        if (this._debouncedResizeHandler) {
            window.removeEventListener('resize', this._debouncedResizeHandler);
            this._debouncedResizeHandler = null;
        }
        if (this._changeHandler) {
            document.removeEventListener('change', this._changeHandler);
            this._changeHandler = null;
        }
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }
        if (this._taskCompletedHandler) {
            document.removeEventListener('taskCompleted', this._taskCompletedHandler);
            this._taskCompletedHandler = null;
        }
        if (this._tasksResetHandler) {
            document.removeEventListener('tasksReset', this._tasksResetHandler);
            this._tasksResetHandler = null;
        }

        // Disconnect mutation observer
        if (this._taskListObserver) {
            this._taskListObserver.disconnect();
            this._taskListObserver = null;
        }

        // Remove layout classes from task-view
        const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
        if (taskView) {
            taskView.classList.remove(DOM_CLASSES.MODE_DESCRIPTION_VISIBLE);
            taskView.classList.remove(DOM_CLASSES.HELP_WINDOW_SIDE);
        }

        this.sideLayoutEnabled = false;
        this._eventListenersInitialized = false;
    }
}

// Singleton instance
let helpWindowManagerInstance = null;

/**
 * Initialize and get the HelpWindowManager instance.
 * Dynamically imports utilities with version cache-busting before creating instance.
 * @param {Object} [dependencies={}] - Optional dependencies to inject
 * @returns {Promise<HelpWindowManager>} The manager instance
 */
export async function initHelpWindowManager(dependencies = {}) {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    getObjectSizeBytes = storageUtils.getObjectSizeBytes;
    formatBytes = storageUtils.formatBytes;

    // Import undo manager utilities
    const undoManager = await import(`./undoRedoManager.js?v=${version}`);
    getUndoCacheSizeBytes = undoManager.getUndoCacheSizeBytes;

    // Set dependencies
    if (dependencies && Object.keys(dependencies).length > 0) {
        setHelpWindowManagerDependencies(dependencies);
    }

    // Create singleton instance
    if (!helpWindowManagerInstance) {
        helpWindowManagerInstance = new HelpWindowManager();
    }

    return helpWindowManagerInstance;
}

/**
 * Get the current HelpWindowManager instance (may be null if not initialized).
 * @returns {HelpWindowManager|null}
 */
export function getHelpWindowManager() {
    return helpWindowManagerInstance;
}
