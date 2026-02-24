/**
 * Help Window Manager Module (DI-Pure)
 *
 * Manages the help window that shows task status and cycle completion messages.
 *
 * @module ui/helpWindowManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

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
 */
export function setHelpWindowManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎯 HelpWindowManager dependencies set:', Object.keys(dependencies));
}

/**
 * Manages the help window UI component.
 */
export class HelpWindowManager {
    constructor() {
        this.helpWindow = _deps.getModal('help');
        this.isVisible = false;
        this.currentMessage = null;
        this.isShowingCycleComplete = false;
        this.isShowingModeDescription = false;
        this.currentMode = null;
        this.modeDescriptionTimeout = null;
        this.initialized = false;
        this.sideLayoutEnabled = false;
        this._pendingTimeouts = [];

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
        const isDesktop = window.innerWidth >= 1024;

        if (!isDesktop) {
            // On mobile/tablet, always use bottom layout
            if (this.sideLayoutEnabled) {
                this.sideLayoutEnabled = false;
                taskView.classList.remove('help-window-side');
                console.log('📐 Help window layout: bottom (not desktop)');
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
            const normalMaxHeight = window.innerHeight - 385;
            shouldEnableSideLayout = scrollHeight > (normalMaxHeight - bufferPx);
        } else {
            // Currently in bottom layout - enable if overflowing
            shouldEnableSideLayout = isOverflowing;
        }

        if (shouldEnableSideLayout !== this.sideLayoutEnabled) {
            this.sideLayoutEnabled = shouldEnableSideLayout;
            taskView.classList.toggle('help-window-side', shouldEnableSideLayout);
            console.log(`📐 Help window layout: ${shouldEnableSideLayout ? 'side' : 'bottom'} (scrollH: ${scrollHeight}, clientH: ${clientHeight})`);
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
        this.helpWindow.classList.add('show');
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
            console.log('✅ HelpWindowManager event listeners already set up');
            return;
        }
        this._eventListenersInitialized = true;

        // Use injected safeAddEventListener (strict DI - no fallback)
        const safeAdd = _deps.safeAddEventListener;

        // Listen for checkbox changes on tasks
        this._changeHandler = (e) => {
            // Guard: e.target may not have closest() if event dispatched on document
            if (e.target?.type === 'checkbox' && e.target?.closest?.('.task')) {
                this._pendingTimeouts.push(setTimeout(() => {
                    this.updateConstantMessage();
                }, 50));
            }
        };
        safeAdd(document, 'change', this._changeHandler);

        // Listen for click events on tasks
        this._clickHandler = (e) => {
            // Guard: e.target may not have closest() if event dispatched on document
            if (e.target?.closest?.('.task')) {
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
                    console.log('📝 Help window: Task list changed');
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

        const message = this.getCurrentStatusMessage();

        if (message !== this.currentMessage) {
            this.currentMessage = message;
            if (this.isVisible) {
                this.updateContent(message);
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
        this.updateConstantMessage();
    }

    /**
     * Shows mode description temporarily.
     * @param {string} mode - The mode to describe
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
        taskView?.classList.add('mode-description-visible');

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
                <h4 style="margin: 0 0 8px 0; color: var(--accent-color, #007bff);">${modeInfo.title}</h4>
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
            taskView?.classList.remove('mode-description-visible');
            this.updateConstantMessage();
        }, 30000);

        console.log(`📖 Showing mode description for: ${mode}`);
    }

    /**
     * Shows cycle completion message.
     */
    showCycleCompleteMessage() {
        if (!this.helpWindow) return;

        // Clear mode description if showing
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
            this.isShowingModeDescription = false;
            // Remove class from task-view
            const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
            taskView?.classList.remove('mode-description-visible');
        }

        this.isShowingCycleComplete = true;
        this.helpWindow.innerHTML = `
            <p>✅ ${getLabel('help.cycleComplete')}</p>
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
     */
    showTasksClearedMessage(count = 0) {
        if (!this.helpWindow) return;

        // Clear mode description if showing
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
            this.isShowingModeDescription = false;
            const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
            taskView?.classList.remove('mode-description-visible');
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

    getCurrentStatusMessage() {
        const totalTasks = document.querySelectorAll(DOM_SELECTORS.TASK).length;
        const completedTasks = document.querySelectorAll('.task input:checked').length;
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

        // Size suffix for messages (💾 floppy disk icon for storage)
        const sizeSuffix = routineSize ? ` • 💾 ${routineSize}` : '';

        // Mode-aware progress text: show cleared tasks in To-Do mode, cycles in other modes
        const progressText = isToDoMode
            ? getLabel('help.progressCleared', { vars: { count: clearedTasksCount, taskWord: getLabel('noun.task', { count: clearedTasksCount }) } })
            : getLabel('help.progressCycles', { vars: { count: cycleCount, cycleWord: getLabel('noun.cycle', { count: cycleCount }) } });

        // Return different constant messages based on state
        if (totalTasks === 0) {
            return `📝 ${getLabel('help.addFirstTask')} • ${progressText}${sizeSuffix}`;
        }

        if (remaining === 0 && totalTasks > 0) {
            return `🎉 ${getLabel('help.allComplete')} • ${progressText}${sizeSuffix}`;
        }

        const remainingText = getLabel('help.tasksRemaining', { vars: { remaining, taskWord: getLabel('noun.task', { count: remaining }) } });

        // First-time message for either mode
        if (isToDoMode && clearedTasksCount === 0) {
            return `📋 ${remainingText} • ${getLabel('help.clearFirst')}${sizeSuffix}`;
        }
        if (!isToDoMode && cycleCount === 0) {
            return `📋 ${remainingText} • ${getLabel('help.completeFirst')}${sizeSuffix}`;
        }

        // Show progress and cycle count or cleared tasks
        return `📋 ${remainingText} • ${progressText}${sizeSuffix}`;
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

        const message = this.currentMessage || this.getCurrentStatusMessage();

        if (!this.isShowingModeDescription && !this.isShowingCycleComplete) {
            this.helpWindow.innerHTML = `
                <p>${message}</p>
            `;
        }

        this.helpWindow.classList.remove('hide');
        this.helpWindow.classList.add('show');
        // Don't toggle display - use opacity only to prevent CLS
        this.isVisible = true;
    }

    hide() {
        if (!this.helpWindow || !this.isVisible) return;

        this.helpWindow.classList.remove('show');
        this.helpWindow.classList.add('hide');
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
            taskView.classList.remove('mode-description-visible');
            taskView.classList.remove('help-window-side');
        }

        this.sideLayoutEnabled = false;
        this._eventListenersInitialized = false;
    }
}

// Singleton instance
let helpWindowManagerInstance = null;

/**
 * Initialize and get the HelpWindowManager instance.
 * Dynamically imports utilities with version cache-busting before creating instance
 * @param {Object} dependencies - Optional dependencies to inject
 * @returns {Promise<HelpWindowManager>} The manager instance
 */
export async function initHelpWindowManager(dependencies = {}) {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    console.log(`📦 HelpWindowManager: Loading utilities with version ${version}...`);

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    getObjectSizeBytes = storageUtils.getObjectSizeBytes;
    formatBytes = storageUtils.formatBytes;

    // Import undo manager utilities
    const undoManager = await import(`./undoRedoManager.js?v=${version}`);
    getUndoCacheSizeBytes = undoManager.getUndoCacheSizeBytes;

    console.log('✅ HelpWindowManager: Utilities loaded');

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
