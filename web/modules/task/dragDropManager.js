/**
 * 🔄 miniCycle Drag & Drop Manager (DI-Pure)
 * Handles task rearrangement via drag-and-drop and arrow buttons
 * Uses Resilient Constructor Pattern - graceful degradation with user feedback
 *
 * @module modules/task/dragDropManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('DragDropManager', {
    appInit: optional(null),
    AppState: optional(null),
    // saveCurrentTaskOrder removed - now using state-first pattern
    // autoSave removed - AppState.update handles persistence
    updateProgressBar: optional(null),
    updateStatsPanel: optional(null),
    checkCompleteAllButton: optional(null),
    updateUndoRedoButtons: optional(null),
    captureStateSnapshot: optional(null),
    refreshUIFromState: optional(null),
    revealTaskButtons: optional(null),
    hideTaskButtons: optional(null),
    getBody: optional(null),
    enableUndoSystemOnFirstInteraction: optional(null),
    showNotification: optional(null),
    safeAddEventListener: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, updateProgressBar: Function|null, updateStatsPanel: Function|null, checkCompleteAllButton: Function|null, updateUndoRedoButtons: Function|null, captureStateSnapshot: Function|null, refreshUIFromState: Function|null, revealTaskButtons: Function|null, hideTaskButtons: Function|null, getBody: Function|null, enableUndoSystemOnFirstInteraction: Function|null, showNotification: Function|null, safeAddEventListener: Function|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for DragDropManager (call before init)
 * @param {Object} dependencies - { AppState, updateProgressBar, etc. }
 */
export function setDragDropManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Manages drag-and-drop reordering of tasks in the task list
 */
export class DragDropManager {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Store dependencies - DI provides all via moduleLoader (use ?.() for optional calls)
        // Note: saveCurrentTaskOrder and autoSave removed - now using state-first pattern
        this.deps = {
            AppState: resolvedDeps.AppState,
            updateProgressBar: resolvedDeps.updateProgressBar,
            updateStatsPanel: resolvedDeps.updateStatsPanel,
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton,
            updateUndoRedoButtons: resolvedDeps.updateUndoRedoButtons,
            captureStateSnapshot: resolvedDeps.captureStateSnapshot,
            refreshUIFromState: resolvedDeps.refreshUIFromState,
            revealTaskButtons: resolvedDeps.revealTaskButtons,
            hideTaskButtons: resolvedDeps.hideTaskButtons,
            getBody: resolvedDeps.getBody,
            enableUndoSystemOnFirstInteraction: resolvedDeps.enableUndoSystemOnFirstInteraction,
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            safeAddEventListener: resolvedDeps.safeAddEventListener
        };

        // Internal state (local to this instance, not global)
        this.rearrangeTimeout = null;
        this.REARRANGE_DELAY = 75; // ms delay to smooth reordering

        // Drag state (previously on AppGlobalState, now local)
        this.draggedTask = null;
        this.rearrangeInitialized = false;
        this.didDragReorderOccur = false;

        // Track current drop target to avoid querySelectorAll in hot paths
        this._currentDropTarget = null;

        // Track if native HTML5 dragstart fired (iOS native DnD).
        // When true, touchcancel should NOT clear this.draggedTask
        // because the drop handler needs it to persist the reorder.
        this._nativeDragActive = false;

        // Initialization flag
        this.initialized = false;

    }

    /**
     * Get AppState (DI-pure, no window.* fallback)
     * @private
     */
    _getAppState() {
        return this.deps.AppState;
    }

    /**
     * Initialize the drag & drop system
     * Follows appInit 2-phase initialization: waits for core (AppState + data) before setup
     */
    async init() {
        try {
            if (this.initialized) {
                console.warn('⚠️ DragDropManager already initialized');
                return;
            }

            // ✅ Wait for core systems (AppState + data) to be ready
            await _deps.appInit?.waitForCore();

            this.setupRearrange();
            this.setupVisibilityCleanup();
            this.initialized = true;
        } catch (error) {
            console.warn('⚠️ DragDropManager initialization failed:', error);
            this.deps.showNotification(getLabel('notify.dragDropWarning'), 'warning');
        }
    }

    /**
     * Setup visibility change handler to cleanup drag state when tab loses focus
     * Prevents corrupted drag state if user switches tabs mid-drag
     */
    setupVisibilityCleanup() {
        try {
            const safeAdd = this.deps.safeAddEventListener;

            // Cleanup drag state when page becomes hidden (tab switch, minimize, etc.)
            this._dragVisibilityHandler = () => {
                if (document.hidden && this.draggedTask) {
                    this.cleanupDragState();
                }
            };
            safeAdd(document, 'visibilitychange', this._dragVisibilityHandler);

            // Also cleanup on window blur (user clicks outside browser)
            this._dragBlurHandler = () => {
                if (this.draggedTask) {
                    this.cleanupDragState();
                }
            };
            safeAdd(window, 'blur', this._dragBlurHandler);

        } catch (error) {
            console.warn('⚠️ Failed to setup visibility cleanup:', error);
        }
    }

    /**
     * Setup drag and drop event handling
     */
    setupRearrange() {
        if (this.rearrangeInitialized) {
            return;
        }

        try {
            // Mark as initialized (instance state)
            this.rearrangeInitialized = true;

            // Use safeAddEventListener to prevent duplicate handlers
            const safeAdd = this.deps.safeAddEventListener;

            // Add event delegation for arrow clicks (survives DOM re-renders)
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            if (taskList) {
                taskList._arrowClickHandler = (event) => {
                    if (event.target.matches(DOM_SELECTORS.MOVE_ARROWS)) {
                        event.preventDefault();
                        event.stopPropagation();
                        this.handleArrowClick(event.target);
                    }
                };
                safeAdd(taskList, "click", taskList._arrowClickHandler);
            }

            // Setup dragover handler
            this._dragoverHandler = (event) => {
                event.preventDefault();
                requestAnimationFrame(() => {
                    const movingTask = event.target.closest(DOM_SELECTORS.TASK);
                    if (movingTask) {
                        this.handleRearrange(movingTask, event);
                    }
                });
            };
            safeAdd(document, "dragover", this._dragoverHandler);

            // Setup drop handler (desktop HTML5 drag-and-drop + iOS native DnD)
            this._dropHandler = (event) => {
                event.preventDefault();
                if (!this.draggedTask) return;

                this.saveDragReorder();
                this.cleanupDragState();
                this._nativeDragActive = false;
            };
            safeAdd(document, "drop", this._dropHandler);

        } catch (error) {
            console.warn('⚠️ Failed to setup rearrange handlers:', error);
        }
    }

    /**
     * Enable drag and drop on a task element
     * @param {HTMLElement} taskElement - The task element to enable dragging on
     */
    enableDragAndDrop(taskElement) {
        if (!taskElement) {
            console.warn('⚠️ No task element provided to enableDragAndDrop');
            return;
        }

        try {
            // ✅ Safari desktop REQUIRES draggable="true" before dragstart fires
            taskElement.setAttribute("draggable", "true");

            // ✅ Safari/WebKit REQUIRES -webkit-user-drag CSS property
            taskElement.style.webkitUserDrag = "element";

            // Prevent text selection on mobile
            taskElement.style.userSelect = "none";
            taskElement.style.webkitUserSelect = "none";
            taskElement.style.msUserSelect = "none";

            let touchStartX = 0;
            let touchStartY = 0;
            let holdTimeout = null;
            let isDragging = false;
            let isLongPress = false;
            let isTap = false;
            let preventClick = false;
            const moveThreshold = 15; // Movement threshold for long press

            // Use safeAddEventListener
            const safeAdd = this.deps.safeAddEventListener;

            // ✅ FIX: Remove old handlers BEFORE creating new ones
            // This prevents duplicate handlers when enableDragAndDrop is called multiple times
            // (e.g., during re-rendering after three-dots toggle)
            if (taskElement._touchstartHandler) {
                taskElement.removeEventListener("touchstart", taskElement._touchstartHandler);
            }
            if (taskElement._touchmoveHandler) {
                taskElement.removeEventListener("touchmove", taskElement._touchmoveHandler);
            }
            if (taskElement._touchendHandler) {
                taskElement.removeEventListener("touchend", taskElement._touchendHandler);
            }
            if (taskElement._touchcancelHandler) {
                taskElement.removeEventListener("touchcancel", taskElement._touchcancelHandler);
            }
            if (taskElement._dragstartHandler) {
                taskElement.removeEventListener("dragstart", taskElement._dragstartHandler);
            }
            if (taskElement._clickGuardHandler) {
                taskElement.removeEventListener("click", taskElement._clickGuardHandler);
            }

            // 📱 **Touch-based Drag for Mobile**
            taskElement._touchstartHandler = (event) => {
                if (event.target.closest(DOM_SELECTORS.TASK_OPTIONS)) return;
                isLongPress = false;
                isDragging = false;
                isTap = true;
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                preventClick = false;
                this._nativeDragActive = false; // Reset for new touch sequence

                // Remove .long-pressed from all other tasks before long press starts
                const taskList = document.getElementById(DOM_IDS.TASK_LIST);
                if (taskList) {
                    for (const task of taskList.children) {
                        if (task !== taskElement && task.classList.contains(DOM_CLASSES.TASK)) {
                            task.classList.remove(DOM_CLASSES.LONG_PRESSED);
                            this.deps.hideTaskButtons?.(task);
                        }
                    }
                }

                holdTimeout = setTimeout(() => {
                    isLongPress = true;
                    isTap = false;
                    this.draggedTask = taskElement;
                    isDragging = true;
                    taskElement.classList.add(DOM_CLASSES.DRAGGING);

                    event.preventDefault();

                    // Enable undo system on first user interaction (touch drag path)
                    this.deps.enableUndoSystemOnFirstInteraction?.();

                    // Only reveal task option buttons if three-dots mode is NOT enabled.
                    // When three-dots is on, the dedicated button handles visibility;
                    // long press should only activate drag mode.
                    const body = this.deps.getBody?.() || document.body;
                    const threeDotsEnabled = body.classList.contains(DOM_CLASSES.SHOW_THREE_DOTS_ENABLED);
                    if (!threeDotsEnabled) {
                        taskElement.classList.add(DOM_CLASSES.LONG_PRESSED);
                        this.deps.revealTaskButtons?.(taskElement, 'long-press');
                    }
                }, 500); // Long-press delay (500ms)
            };
            safeAdd(taskElement, "touchstart", taskElement._touchstartHandler, { passive: false }); // Must be non-passive - calls preventDefault()

            taskElement._touchmoveHandler = (event) => {
                const touchMoveX = event.touches[0].clientX;
                const touchMoveY = event.touches[0].clientY;
                const deltaX = Math.abs(touchMoveX - touchStartX);
                const deltaY = Math.abs(touchMoveY - touchStartY);

                // If long press already activated and dragging, process the drag move
                if (isDragging && this.draggedTask) {
                    if (event.cancelable) {
                        event.preventDefault();
                    }
                    const elementAtPoint = document.elementFromPoint(touchMoveX, touchMoveY);
                    const targetTask = elementAtPoint?.closest(DOM_SELECTORS.TASK);
                    if (targetTask) {
                        this.handleRearrange(targetTask, event);
                    }
                    return;
                }

                // Before long press activates: cancel if moving too much
                if (deltaX > moveThreshold || deltaY > moveThreshold) {
                    clearTimeout(holdTimeout);
                    isLongPress = false;
                    isTap = false;
                    return;
                }

                // Allow normal scrolling if moving vertically
                if (deltaY > deltaX) {
                    clearTimeout(holdTimeout);
                    isTap = false;
                    return;
                }
            };
            safeAdd(taskElement, "touchmove", taskElement._touchmoveHandler, { passive: false }); // Must be non-passive - calls preventDefault()

            taskElement._touchendHandler = () => {
                clearTimeout(holdTimeout);

                // After a long-press or drag, suppress the synthetic click that
                // browsers fire after touchend — it would toggle the checkbox
                // via the delegated click handler on taskList.
                if (isLongPress || isDragging) {
                    preventClick = true;
                    setTimeout(() => {
                        preventClick = false;
                    }, 300);
                }

                // If native DnD took over (iOS), let the drop handler save.
                // touchend won't fire after touchcancel, but handle both for safety.
                if (this._nativeDragActive) {
                    isDragging = false;
                    return;
                }

                // Save reordered state before clearing drag references (custom touch drag)
                if (isDragging && this.didDragReorderOccur) {
                    this.saveDragReorder();
                }

                if (this.draggedTask) {
                    this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.REARRANGING);
                    this.draggedTask = null;
                }

                isDragging = false;

                // Keep task options open after a long press (only when buttons were revealed)
                const body = this.deps.getBody?.() || document.body;
                const threeDotsEnabled = body.classList.contains(DOM_CLASSES.SHOW_THREE_DOTS_ENABLED);
                if (isLongPress && !threeDotsEnabled) {
                    return;
                }

                taskElement.classList.remove(DOM_CLASSES.LONG_PRESSED);
            };
            safeAdd(taskElement, "touchend", taskElement._touchendHandler, { passive: true });

            // Handle touchcancel (browser gesture takeover, system alert, etc.)
            taskElement._touchcancelHandler = () => {
                clearTimeout(holdTimeout);

                if (this._nativeDragActive) {
                    // iOS native DnD took over — DON'T clear this.draggedTask!
                    // The drop handler needs it to save the reorder.
                    // Only reset local touch state.
                    isDragging = false;
                    isLongPress = false;
                    isTap = false;
                    return;
                }

                // Real cancel (system alert, etc.) — clean up everything
                if (isDragging && this.didDragReorderOccur) {
                    this.saveDragReorder();
                }

                if (this.draggedTask) {
                    this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.REARRANGING);
                    this.draggedTask = null;
                }

                isDragging = false;
                isLongPress = false;
                isTap = false;
                taskElement.classList.remove(DOM_CLASSES.LONG_PRESSED);
            };
            safeAdd(taskElement, "touchcancel", taskElement._touchcancelHandler, { passive: true });

            // 🖱️ **Mouse-based Drag for Desktop (also fires on iOS native DnD)**
            taskElement._dragstartHandler = (event) => {
                if (event.target.closest(DOM_SELECTORS.TASK_OPTIONS)) return;

                // Mark that native HTML5 DnD has started.
                // On iOS, touchcancel will fire next — this flag tells that handler
                // to preserve this.draggedTask so the drop handler can save the reorder.
                this._nativeDragActive = true;

                // Enable undo system on first user interaction
                this.deps.enableUndoSystemOnFirstInteraction?.();

                this.draggedTask = taskElement;
                event.dataTransfer.setData("text/plain", "");

                // Add dragging class for desktop as well
                taskElement.classList.add(DOM_CLASSES.DRAGGING);

                // ✅ SAFARI DESKTOP FIX: Safari needs an explicit setDragImage call,
                // and its default ghost rendering can be inconsistent. Build a custom
                // ghost clone that mirrors the task's appearance for a polished preview.
                // Non-Safari browsers use the browser's native ghost (no intervention needed).
                const ua = navigator.userAgent;
                const isSafariDesktop = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua)
                    && !('ontouchstart' in window);
                if (isSafariDesktop) {
                    const rect = taskElement.getBoundingClientRect();
                    const ghost = taskElement.cloneNode(true);
                    ghost.style.cssText = `
                        position: fixed;
                        top: -9999px;
                        left: -9999px;
                        width: ${Math.round(rect.width * 0.7)}px;
                        background: var(--theme-task-bg, #fff);
                        border-radius: var(--radius-md, 8px);
                        padding: var(--space-2, 8px) var(--space-3, 12px);
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                        opacity: 0.9;
                        pointer-events: none;
                        z-index: -1;
                    `;
                    // Hide task-options buttons in the ghost
                    const ghostOptions = ghost.querySelector(DOM_SELECTORS.TASK_OPTIONS);
                    if (ghostOptions) ghostOptions.style.display = 'none';

                    document.body.appendChild(ghost);
                    const offsetX = event.clientX - rect.left;
                    const offsetY = event.clientY - rect.top;
                    event.dataTransfer.setDragImage(ghost, offsetX, offsetY);

                    // Remove ghost after browser captures it (next frame is sufficient)
                    requestAnimationFrame(() => ghost.remove());
                }
            };
            safeAdd(taskElement, "dragstart", taskElement._dragstartHandler);

            // 🛡️ Click guard: suppress synthetic click after long-press/drag
            // Browsers fire a click event after touchend — without this guard,
            // the delegated click handler on taskList would toggle the checkbox.
            taskElement._clickGuardHandler = (event) => {
                if (preventClick) {
                    event.stopPropagation();
                    event.preventDefault();
                }
            };
            safeAdd(taskElement, "click", taskElement._clickGuardHandler);

        } catch (error) {
            console.warn('⚠️ Failed to enable drag and drop on task:', error);
        }
    }

    /**
     * Handles the rearrangement of tasks when dragged
     * @param {HTMLElement} target - The task element being moved
     * @param {DragEvent | TouchEvent} event - The event triggering the rearrangement
     */
    handleRearrange(target, event) {
        if (!target || !this.draggedTask || target === this.draggedTask) return;

        clearTimeout(this.rearrangeTimeout);

        this.rearrangeTimeout = setTimeout(() => {
            if (!document.contains(target) || !document.contains(this.draggedTask)) return;

            const parent = this.draggedTask.parentNode;
            if (!parent || !target.parentNode) return;

            const bounding = target.getBoundingClientRect();
            // Fix #33: Handle both mouse events (clientY) and touch events (touches[0].clientY)
            const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY;
            const offset = clientY - bounding.top;

            // ✅ ALWAYS mark that a reorder occurred (for save on drop)
            this.didDragReorderOccur = true;

            // Batch reads: collect all DOM reads before any writes
            const isLastTask = !target.nextElementSibling;
            const isFirstTask = !target.previousElementSibling;
            const isNextSiblingDragged = target.nextSibling === this.draggedTask;
            const isPrevSiblingDragged = target.previousSibling === this.draggedTask;

            // Clear previous drop target (O(1) instead of querySelectorAll)
            if (this._currentDropTarget) {
                this._currentDropTarget.classList.remove(DOM_CLASSES.DROP_TARGET);
                this._currentDropTarget = null;
            }

            // ✅ Wrap all DOM manipulation in try-catch to handle race conditions
            try {
                if (isLastTask && !isNextSiblingDragged) {
                    // ✅ Verify nodes are still valid before DOM manipulation
                    if (!document.contains(this.draggedTask) || !parent.contains) {
                        console.warn('⚠️ DOM nodes became invalid before appendChild');
                        return;
                    }
                    parent.appendChild(this.draggedTask);
                    this.draggedTask.classList.add(DOM_CLASSES.DROP_TARGET);
                    this._currentDropTarget = this.draggedTask;
                    return;
                }

                if (isFirstTask && !isPrevSiblingDragged) {
                    // ✅ Verify nodes are still valid before DOM manipulation
                    if (!document.contains(this.draggedTask) || !parent.firstChild) {
                        console.warn('⚠️ DOM nodes became invalid before insertBefore (first child)');
                        return;
                    }
                    parent.insertBefore(this.draggedTask, parent.firstChild);
                    this.draggedTask.classList.add(DOM_CLASSES.DROP_TARGET);
                    this._currentDropTarget = this.draggedTask;
                    return;
                }

                if (offset > bounding.height / 3) {
                    if (!isNextSiblingDragged) {
                        // ✅ Verify nodes are still valid before DOM manipulation
                        if (!document.contains(this.draggedTask) || !document.contains(target)) {
                            console.warn('⚠️ DOM nodes became invalid before insertBefore (next sibling)');
                            return;
                        }
                        parent.insertBefore(this.draggedTask, target.nextSibling);
                    }
                } else {
                    if (!isPrevSiblingDragged) {
                        // ✅ Verify nodes are still valid before DOM manipulation (line 357 fix)
                        if (!document.contains(this.draggedTask) || !document.contains(target)) {
                            console.warn('⚠️ DOM nodes became invalid before insertBefore (target)');
                            return;
                        }
                        parent.insertBefore(this.draggedTask, target);
                    }
                }

                // ✅ Final verification before adding class
                if (this.draggedTask && document.contains(this.draggedTask)) {
                    this.draggedTask.classList.add(DOM_CLASSES.DROP_TARGET);
                    this._currentDropTarget = this.draggedTask;
                }
            } catch (error) {
                // ✅ Gracefully handle DOM manipulation errors (e.g., NotFoundError during race conditions)
                console.warn('⚠️ DOM manipulation failed during rearrange (likely race condition):', error.message);
                // Clear dragging state to prevent stuck UI
                if (this.draggedTask) {
                    this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.DROP_TARGET);
                }
                return;
            }
        }, this.REARRANGE_DELAY);
    }

    /**
     * Handle arrow button clicks for task reordering (state-first pattern)
     * @param {HTMLElement} button - The arrow button that was clicked
     */
    async handleArrowClick(button) {
        // Guard against double execution (Enter key can fire both synthetic and native click in some browsers)
        if (this._arrowMoveInProgress) return;
        this._arrowMoveInProgress = true;

        try {
            const taskItem = button.closest(DOM_SELECTORS.TASK);
            if (!taskItem) return;

            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            const allTasks = Array.from(taskList.children);
            const currentIndex = allTasks.indexOf(taskItem);

            let newIndex;
            if (button.classList.contains(DOM_CLASSES.MOVE_UP)) {
                newIndex = Math.max(0, currentIndex - 1);
            } else {
                newIndex = Math.min(allTasks.length - 1, currentIndex + 1);
            }

            if (newIndex === currentIndex) return; // No movement needed

            // Get task ID for state-driven active task tracking
            const taskId = taskItem.dataset.taskId;

            // Reorder via state system (state-first pattern)
            const AppState = this._getAppState();
            if (AppState?.isReady?.()) {
                // Capture undo snapshot BEFORE reordering
                const currentState = AppState.get();
                if (currentState) this.deps.captureStateSnapshot?.(currentState);

                // Update state: reorder tasks AND set activeTaskId
                AppState.update(state => {
                    const activeCycleId = state.appState.activeCycleId;
                    if (activeCycleId && state.data.cycles[activeCycleId]) {
                        const tasks = state.data.cycles[activeCycleId].tasks;
                        if (tasks && currentIndex >= 0 && currentIndex < tasks.length) {
                            // Remove task from current position and insert at new position
                            const [movedTask] = tasks.splice(currentIndex, 1);
                            tasks.splice(newIndex, 0, movedTask);
                            state.metadata.lastModified = Date.now();
                        }
                    }
                    // Set activeTaskId so rendering restores task options (state-driven UI)
                    if (!state.ui) state.ui = {};
                    state.ui.activeTaskId = taskId || null;
                }, true); // immediate save

                // Remember which arrow was pressed for focus restoration
                const arrowClass = button.classList.contains(DOM_CLASSES.MOVE_UP) ? DOM_CLASSES.MOVE_UP : DOM_CLASSES.MOVE_DOWN;

                // Re-render from state (await to ensure DOM is ready)
                await this.deps.refreshUIFromState?.();

                // Update first/last markers after re-render (O(1))
                this.updateFirstLastMarkers();

                // Update undo/redo buttons
                this.deps.updateUndoRedoButtons?.();

                // Task options are now restored automatically by _restoreActiveTaskOptions in renderTasks

                // Restore focus to the same arrow button on the moved task (a11y)
                // Use rAF to ensure the browser has completed layout before focusing
                if (taskId) {
                    requestAnimationFrame(() => {
                        const movedTask = document.querySelector(`[data-task-id="${taskId}"]`);
                        if (!movedTask) return;

                        // Ensure task options are visible on the moved task
                        const taskOptions = movedTask.querySelector(DOM_SELECTORS.TASK_OPTIONS);
                        if (taskOptions) {
                            taskOptions.classList.add(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
                            taskOptions.classList.remove(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
                            taskOptions.querySelectorAll('button.task-btn').forEach(btn => {
                                btn.tabIndex = 0;
                            });
                        }

                        // Try the same arrow first; if hidden (first/last boundary), fall back to opposite arrow
                        const arrowBtn = movedTask.querySelector(`.${arrowClass}`);
                        const oppositeClass = arrowClass === DOM_CLASSES.MOVE_UP ? DOM_CLASSES.MOVE_DOWN : DOM_CLASSES.MOVE_UP;
                        const oppositeBtn = movedTask.querySelector(`.${oppositeClass}`);

                        if (arrowBtn && getComputedStyle(arrowBtn).visibility !== 'hidden') {
                            arrowBtn.focus();
                        } else if (oppositeBtn && getComputedStyle(oppositeBtn).visibility !== 'hidden') {
                            oppositeBtn.focus();
                        } else {
                            // All arrows hidden — focus task text as fallback
                            movedTask.querySelector(DOM_SELECTORS.TASK_TEXT)?.focus();
                        }
                    });
                }

                // Announce move to screen readers via live region
                const liveRegion = document.getElementById(DOM_IDS.LIVE_REGION);
                if (liveRegion) {
                    liveRegion.textContent = getLabel(arrowClass === DOM_CLASSES.MOVE_UP
                        ? 'accessibility.taskMovedUp'
                        : 'accessibility.taskMovedDown');
                }

            } else {
                console.warn('⚠️ AppState not ready for arrow reordering');
                this.deps.showNotification(getLabel('notify.reorderFailed'), 'warning');
            }
        } catch (error) {
            console.warn('⚠️ Arrow click handler failed:', error);
            this.deps.showNotification(getLabel('notify.reorderError'), 'warning');
        } finally {
            // Release guard after a brief delay to absorb any duplicate events
            setTimeout(() => { this._arrowMoveInProgress = false; }, 200);
        }
    }

    /**
     * Persist the current DOM task order to AppState after a drag reorder.
     * Called from both the HTML5 drop handler (desktop) and touchend (mobile).
     */
    saveDragReorder() {
        if (!this.didDragReorderOccur) return;

        const AppState = this._getAppState();
        if (AppState?.isReady?.()) {
            // Capture undo snapshot BEFORE saving new order
            const currentState = AppState.get();
            if (currentState) this.deps.captureStateSnapshot?.(currentState);

            // Read task order from DOM
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            const taskElements = taskList?.querySelectorAll(DOM_SELECTORS.TASK);
            const newTaskOrder = [];
            taskElements?.forEach(taskEl => {
                const taskId = taskEl.dataset.taskId;
                if (taskId) newTaskOrder.push(taskId);
            });

            // Update AppState with new order
            AppState.update(state => {
                const activeCycleId = state.appState.activeCycleId;
                if (activeCycleId && state.data.cycles[activeCycleId]) {
                    const tasks = state.data.cycles[activeCycleId].tasks;
                    if (tasks && newTaskOrder.length > 0) {
                        const taskMap = new Map(tasks.map(t => [t.id, t]));
                        const reorderedTasks = newTaskOrder
                            .map(id => taskMap.get(id))
                            .filter(Boolean);

                        // Preserve tasks not in DOM (e.g., completed tasks in dropdown)
                        const missingTasks = tasks.filter(t => !newTaskOrder.includes(t.id));
                        state.data.cycles[activeCycleId].tasks = [...reorderedTasks, ...missingTasks];
                        state.metadata.lastModified = Date.now();
                    }
                }
            }, true); // immediate save

        }

        // Update UI elements
        this.deps.updateProgressBar?.();
        this.deps.updateStatsPanel?.();
        this.deps.checkCompleteAllButton?.();
        this.deps.updateUndoRedoButtons?.();
        this.updateFirstLastMarkers();

        // Clear force-hidden from all task options so CSS :hover can take over.
        // During touch drag, hideTaskButtons adds task-options-force-hidden to sibling tasks;
        // without this cleanup, those tasks stay hidden on hover after switching to desktop.
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        if (taskList) {
            const forceHidden = taskList.querySelectorAll(
                `${DOM_SELECTORS.TASK_OPTIONS}.${DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN}`
            );
            forceHidden.forEach(el => {
                el.classList.remove(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
            });
        }

        this.didDragReorderOccur = false;
    }

    /**
     * Cleanup drag state after drag operation completes
     */
    cleanupDragState() {
        try {
            clearTimeout(this.rearrangeTimeout);
            this.rearrangeTimeout = null;

            if (this.draggedTask) {
                this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.REARRANGING);
                this.draggedTask = null;
            }

            this._nativeDragActive = false;
            this.didDragReorderOccur = false;

            // O(1) cleanup instead of querySelectorAll
            if (this._currentDropTarget) {
                this._currentDropTarget.classList.remove(DOM_CLASSES.DROP_TARGET);
                this._currentDropTarget = null;
            }

            // Clear force-hidden from all task options so CSS :hover can take over
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            if (taskList) {
                const forceHidden = taskList.querySelectorAll(
                    `${DOM_SELECTORS.TASK_OPTIONS}.${DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN}`
                );
                forceHidden.forEach(el => {
                    el.classList.remove(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
                });
            }
        } catch (error) {
            console.warn('⚠️ Failed to cleanup drag state:', error);
        }
    }

    /**
     * Teardown all listeners and state for boot retry via destroyAllModules()
     */
    destroy() {
        this.cleanupDragState();

        // Remove document/window-level listeners
        if (this._dragoverHandler) {
            document.removeEventListener('dragover', this._dragoverHandler);
            this._dragoverHandler = null;
        }
        if (this._dropHandler) {
            document.removeEventListener('drop', this._dropHandler);
            this._dropHandler = null;
        }
        if (this._dragVisibilityHandler) {
            document.removeEventListener('visibilitychange', this._dragVisibilityHandler);
            this._dragVisibilityHandler = null;
        }
        if (this._dragBlurHandler) {
            window.removeEventListener('blur', this._dragBlurHandler);
            this._dragBlurHandler = null;
        }

        // Remove taskList arrow click delegation
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        if (taskList?._arrowClickHandler) {
            taskList.removeEventListener('click', taskList._arrowClickHandler);
            taskList._arrowClickHandler = null;
        }

        this.rearrangeInitialized = false;
        this.initialized = false;
    }

    /**
     * Update move arrows visibility based on AppState (single source of truth)
     */
    updateMoveArrowsVisibility() {
        try {

            const AppState = this._getAppState();

            if (!AppState?.isReady?.()) {
                return;
            }

            const currentState = AppState.get();
            const showArrows = currentState?.ui?.moveArrowsVisible || false;

            // Update DOM to reflect current state
            this.updateArrowsInDOM(showArrows);

        } catch (error) {
            console.warn('⚠️ Failed to update arrow visibility:', error);
        }
    }

    /**
     * Toggle arrow visibility
     */
    toggleArrowVisibility() {
        try {

            const AppState = this._getAppState();

            if (!AppState?.isReady?.()) {
                setTimeout(() => {
                    const AppStateRetry = this._getAppState();
                    if (AppStateRetry?.isReady?.()) {
                        this.toggleArrowVisibility();
                    } else {
                        console.warn('❌ AppState still not ready after timeout');
                    }
                }, 100);
                return;
            }

            const currentState = AppState.get();
            if (!currentState) {
                console.error('❌ No state data available for toggleArrowVisibility');
                return;
            }

            const currentlyVisible = currentState.ui?.moveArrowsVisible || false;
            const newVisibility = !currentlyVisible;

            // Update through state system
            AppState.update(state => {
                if (!state.ui) state.ui = {};
                state.ui.moveArrowsVisible = newVisibility;
                state.metadata.lastModified = Date.now();
            }, true); // immediate save

            // Update DOM to reflect new state
            this.updateArrowsInDOM(newVisibility);

        } catch (error) {
            console.warn('⚠️ Failed to toggle arrow visibility:', error);
            this.deps.showNotification(getLabel('notify.arrowToggleFailed'), 'warning');
        }
    }

    /**
     * O(1) update: Set data attribute on taskList for CSS-driven visibility
     * @param {boolean} showArrows - Whether to show arrows
     */
    setArrowsEnabled(showArrows) {
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        if (taskList) {
            taskList.dataset.moveArrows = showArrows ? 'true' : 'false';
        }
    }

    /**
     * O(1) update: Mark first/last tasks with boundary classes
     * Called after task add, delete, or reorder
     */
    updateFirstLastMarkers() {
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        if (!taskList) return;

        // Remove old markers (O(1) - at most one of each)
        taskList.querySelector(DOM_SELECTORS.IS_FIRST_TASK)?.classList.remove(DOM_CLASSES.IS_FIRST_TASK);
        taskList.querySelector(DOM_SELECTORS.IS_LAST_TASK)?.classList.remove(DOM_CLASSES.IS_LAST_TASK);

        // Add new markers (direct children only)
        const firstTask = taskList.firstElementChild;
        const lastTask = taskList.lastElementChild;

        if (firstTask?.classList.contains(DOM_CLASSES.TASK)) {
            firstTask.classList.add(DOM_CLASSES.IS_FIRST_TASK);
        }
        if (lastTask?.classList.contains(DOM_CLASSES.TASK) && lastTask !== firstTask) {
            lastTask.classList.add(DOM_CLASSES.IS_LAST_TASK);
        }
    }

    /**
     * Update arrow visibility in the DOM (O(1) CSS-driven approach)
     * @param {boolean} showArrows - Whether to show arrows
     */
    updateArrowsInDOM(showArrows) {
        try {
            // O(1) operations - CSS handles per-task visibility
            this.setArrowsEnabled(showArrows);
            this.updateFirstLastMarkers();
        } catch (error) {
            console.warn('⚠️ Failed to update arrows in DOM:', error);
        }
    }

    // Fallback for notification (logs to console)
    fallbackNotification(message, type) {
    }
}

// ============================================
// Global Management
// ============================================

let dragDropManager = null;

/**
 * Initialize the global drag drop manager
 * @param {Object} dependencies - Required dependencies
 */
async function initDragDropManager(dependencies = {}) {
    if (dragDropManager) {
        console.warn('⚠️ DragDropManager already initialized');
        return dragDropManager;
    }

    dragDropManager = new DragDropManager(dependencies);
    await dragDropManager.init(); // Await async init

    // Phase 3 - No window.* exports (main script handles exposure)
    return dragDropManager;
}

/**
 * Enable drag and drop on a task element
 * @param {HTMLElement} taskElement - The task element
 */
function enableDragAndDropOnTask(taskElement) {
    if (!dragDropManager) {
        console.warn('⚠️ DragDropManager not initialized - call initDragDropManager() first');
        return;
    }
    dragDropManager.enableDragAndDrop(taskElement);
}

/**
 * Update move arrows visibility
 */
function updateMoveArrowsVisibility() {
    if (!dragDropManager) {
        console.warn('⚠️ DragDropManager not initialized');
        return;
    }
    dragDropManager.updateMoveArrowsVisibility();
}

/**
 * Toggle arrow visibility
 */
function toggleArrowVisibility() {
    if (!dragDropManager) {
        console.warn('⚠️ DragDropManager not initialized');
        return;
    }
    dragDropManager.toggleArrowVisibility();
}

/**
 * Update arrows in DOM (called from renderTasks)
 * @param {boolean} showArrows - Whether to show arrows
 */
function updateArrowsInDOM(showArrows) {
    if (!dragDropManager) {
        console.warn('⚠️ DragDropManager not initialized');
        return;
    }
    dragDropManager.updateArrowsInDOM(showArrows);
}

/**
 * O(1) update: Set arrows enabled state via data attribute
 * @param {boolean} showArrows - Whether to show arrows
 */
function setArrowsEnabled(showArrows) {
    if (!dragDropManager) {
        console.warn('⚠️ DragDropManager not initialized');
        return;
    }
    dragDropManager.setArrowsEnabled(showArrows);
}

/**
 * O(1) update: Update first/last task markers
 * Call after task add, delete, or reorder
 */
function updateFirstLastMarkers() {
    if (!dragDropManager) {
        console.warn('⚠️ DragDropManager not initialized');
        return;
    }
    dragDropManager.updateFirstLastMarkers();
}

// Phase 3 - DI-pure pattern (no window.* in module code)

// Export for ES6 modules
export { initDragDropManager, enableDragAndDropOnTask, updateMoveArrowsVisibility, toggleArrowVisibility, updateArrowsInDOM, setArrowsEnabled, updateFirstLastMarkers };
