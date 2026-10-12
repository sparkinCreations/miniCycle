/**
 * 🔄 miniCycle Drag & Drop Manager (DI-Pure)
 * Handles task rearrangement via drag-and-drop and arrow buttons
 * Uses Resilient Constructor Pattern - graceful degradation with user feedback
 *
 * @module modules/task/dragDropManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS, UI_TIMEOUTS, GESTURE } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { announce } from '../utils/announce.js';
import { getActiveRoutineId, getRoutine } from '../utils/cycleMode.js';

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
 * Merge the on-screen order of a drag back into the routine without moving
 * anything that was not on screen.
 *
 * Rows that are not in #taskList — completed tasks parked in the dropdown —
 * used to be appended after the dragged order, so ANY drag moved every hidden
 * completed task to the end of the routine (measured Oct 2026: task 2 done,
 * task 5 dragged to the top, the done task went from position 2 to 12). In a
 * routine manager the sequence is the routine; this keeps every hidden row at
 * its index and lets the visible rows fill the remaining slots in their new
 * order. Ids in the DOM that the routine no longer has are ignored.
 *
 * @param {Array<{id: string}>} tasks - The routine's tasks, current order
 * @param {string[]} visibleIdsInDomOrder - Task ids as #taskList now shows them
 * @returns {Array<{id: string}>} New task array (same objects, new order)
 */
export function mergeVisibleOrder(tasks, visibleIdsInDomOrder) {
    if (!Array.isArray(tasks)) return tasks;
    const byId = new Map(tasks.map(t => [t.id, t]));
    const visible = (visibleIdsInDomOrder || []).filter(id => byId.has(id));
    const visibleSet = new Set(visible);
    let next = 0;
    return tasks.map(t => (visibleSet.has(t.id) ? byId.get(visible[next++]) : t));
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

        // The move handleRearrange has scheduled but not yet applied — the
        // drop/touchend paths flush it before saving (see _flushPendingRearrange).
        this._pendingRearrange = null;

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
     * True while the task search has a non-default sort applied.
     * The sort lives only in the DOM (taskSearch reorders nodes), so the sorted
     * view has no meaningful "up"/"down": a reorder written through it changed
     * the REAL routine order while the re-render immediately re-sorted the view,
     * so nothing visibly moved (arrows) — or the whole order was replaced by the
     * sort order (drag). Measured Oct 2026.
     * @returns {boolean}
     */
    _isSortActive() {
        const body = this.deps.getBody?.() || document.body;
        return !!body?.classList?.contains(DOM_CLASSES.TASKS_SORTED);
    }

    /** Tell the user why nothing moved, once per attempt. */
    _notifyReorderPaused() {
        this.deps.showNotification?.(
            '⏸️ ' + getLabel('notify.reorderPausedWhileSorted'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_SHORT
        );
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
                    this._revertUnfinishedDrag();
                }
            };
            safeAdd(document, 'visibilitychange', this._dragVisibilityHandler);

            // Also cleanup on window blur (user clicks outside browser)
            this._dragBlurHandler = () => {
                if (this.draggedTask) {
                    this._revertUnfinishedDrag();
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
            const moveThreshold = GESTURE.TASK_HOLD_SLOP; // finger drift allowed during the hold, per axis

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
            if (taskElement._dragendHandler) {
                taskElement.removeEventListener("dragend", taskElement._dragendHandler);
            }
            if (taskElement._clickGuardHandler) {
                taskElement.removeEventListener("click", taskElement._clickGuardHandler);
            }

            // 📱 **Touch-based Drag for Mobile**
            taskElement._touchstartHandler = (event) => {
                if (event.target.closest(DOM_SELECTORS.TASK_OPTIONS)) return;

                // Prevent drag on completed tasks in the completed dropdown
                if (taskElement.closest(`#${DOM_IDS.COMPLETED_TASK_LIST}`)) return;
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
                    // Sorted view: no touch drag either (same reason as dragstart).
                    if (this._isSortActive()) {
                        this._notifyReorderPaused();
                        return;
                    }
                    isLongPress = true;
                    isTap = false;
                    this.draggedTask = taskElement;
                    isDragging = true;
                    taskElement.classList.add(DOM_CLASSES.DRAGGING);

                    // (No preventDefault here: the touchstart finished dispatching
                    // a hold ago, so it would be a no-op. Scroll is blocked by the
                    // touchmove handler once isDragging is set.)

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
                }, UI_TIMEOUTS.TASK_DRAG_LONG_PRESS);
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

                // Before the long press activates: a real move (a scroll, a
                // swipe) cancels the hold. Only past the threshold — a second
                // `deltaY > deltaX` branch used to cancel on ANY vertical drift,
                // so a finger that settled one pixel downward never armed the
                // drag while the same drift sideways was tolerated (measured
                // Oct 2026: 2px down → no drag, 2px across → drag). A scroll
                // clears the slop long before the hold is up.
                if (deltaX > moveThreshold || deltaY > moveThreshold) {
                    clearTimeout(holdTimeout);
                    isLongPress = false;
                    isTap = false;
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
                if (isDragging) {
                    this.saveDragReorder();   // flushes a pending move; no-op if nothing moved
                }

                if (this.draggedTask) {
                    this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.REARRANGING, DOM_CLASSES.DROP_TARGET);
                    this.draggedTask = null;
                }
                this._currentDropTarget = null;
                this._pendingRearrange = null;
                clearTimeout(this.rearrangeTimeout);

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

                // Real cancel (system alert, etc.) — keep what the user had
                // already arranged, then clean up everything
                if (isDragging) {
                    this.saveDragReorder();
                }

                if (this.draggedTask) {
                    this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.REARRANGING, DOM_CLASSES.DROP_TARGET);
                    this.draggedTask = null;
                }
                this._currentDropTarget = null;
                this._pendingRearrange = null;
                clearTimeout(this.rearrangeTimeout);

                isDragging = false;
                isLongPress = false;
                isTap = false;
                taskElement.classList.remove(DOM_CLASSES.LONG_PRESSED);
            };
            safeAdd(taskElement, "touchcancel", taskElement._touchcancelHandler, { passive: true });

            // 🖱️ **Mouse-based Drag for Desktop (also fires on iOS native DnD)**
            taskElement._dragstartHandler = (event) => {
                // Not from the ⋯ options: cancel the native drag too, or the
                // browser lifts a ghost of the row that nothing is tracking.
                if (event.target.closest(DOM_SELECTORS.TASK_OPTIONS)) {
                    event.preventDefault();
                    return;
                }

                // Prevent dragging completed tasks in the completed dropdown
                if (taskElement.closest(`#${DOM_IDS.COMPLETED_TASK_LIST}`)) {
                    event.preventDefault();
                    return;
                }
                // Sorted view: a drop would write the SORT order into the routine.
                if (this._isSortActive()) {
                    event.preventDefault();
                    this._notifyReorderPaused();
                    return;
                }

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

            // A drag that ends WITHOUT a drop — Escape, released outside the
            // window, a cancelled iOS native drag. Nothing handled this until Oct
            // 2026: dragover had already moved the row in the DOM, state was
            // untouched, and the row kept `.dragging` (translucent, scaled) until
            // something else re-rendered. dragend also fires after a successful
            // drop, by which time the drop handler has saved and cleared
            // draggedTask, so this is a no-op there.
            taskElement._dragendHandler = () => {
                if (this.draggedTask !== taskElement) return;
                this._revertUnfinishedDrag();
            };
            safeAdd(taskElement, "dragend", taskElement._dragendHandler);

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

        // Fix #33: Handle both mouse events (clientY) and touch events (touches[0].clientY)
        const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY;

        // Trailing debounce: the move is applied REARRANGE_DELAY after the last
        // dragover/touchmove, which smooths a fast pass over several rows. The
        // last move is therefore still pending when the user lets go within
        // that window — drop/touchend must flush it (_flushPendingRearrange) or
        // the row lands one short of where it was released. Measured Oct 2026:
        // same target, release 300ms after the last move → lands there; release
        // 20ms after → does not move at all.
        clearTimeout(this.rearrangeTimeout);
        this._pendingRearrange = { target, clientY };
        this.rearrangeTimeout = setTimeout(() => this._applyPendingRearrange(), this.REARRANGE_DELAY);
    }

    /**
     * Apply the move handleRearrange scheduled, now. Called by its timer and by
     * _flushPendingRearrange when the gesture ends before the timer fires.
     */
    _applyPendingRearrange() {
        clearTimeout(this.rearrangeTimeout);
        this.rearrangeTimeout = null;
        const pending = this._pendingRearrange;
        this._pendingRearrange = null;
        if (!pending) return;
        const { target, clientY } = pending;

        if (!document.contains(target) || !this.draggedTask || !document.contains(this.draggedTask)) return;
        if (target === this.draggedTask) return;

        const parent = this.draggedTask.parentNode;
        if (!parent || !target.parentNode) return;

        const bounding = target.getBoundingClientRect();
        const offset = clientY - bounding.top;

        // ✅ ALWAYS mark that a reorder occurred (for save on drop)
        this.didDragReorderOccur = true;

        // Batch reads: collect all DOM reads before any writes
        const isNextSiblingDragged = target.nextSibling === this.draggedTask;
        const isPrevSiblingDragged = target.previousSibling === this.draggedTask;

        // Clear previous drop target (O(1) instead of querySelectorAll)
        if (this._currentDropTarget) {
            this._currentDropTarget.classList.remove(DOM_CLASSES.DROP_TARGET);
            this._currentDropTarget = null;
        }

        // The pointer offset decides on EVERY row, the end rows included. Two
        // special cases used to force "first row → very top, last row → very
        // bottom" regardless of where the pointer was, so a drop aimed at the
        // top of the last row still landed below it and one aimed at the bottom
        // of the first row still landed above it (measured Oct 2026). The
        // general rule already covers both ends: below a last row,
        // `target.nextSibling` is null and insertBefore(…, null) appends.
        // Midpoint split: the lower half of the row means "after", the upper
        // half "before". The dragged row takes the slot it moves into, so the
        // flip point is the only hysteresis — and a split at one third (as it
        // was until Oct 2026) made it asymmetric: on a 70px row a downward
        // drag flipped after ~23px of travel into the row, an upward one only
        // after ~47px, so the list felt reluctant going up. The midpoint makes
        // both directions equal and cannot oscillate, since the dragged row
        // sits between the pointer and the row it just passed.
        // ✅ Wrap all DOM manipulation in try-catch to handle race conditions
        try {
            if (offset > bounding.height / 2) {
                if (!isNextSiblingDragged) {
                    parent.insertBefore(this.draggedTask, target.nextSibling);
                }
            } else if (!isPrevSiblingDragged) {
                parent.insertBefore(this.draggedTask, target);
            }

            this.draggedTask.classList.add(DOM_CLASSES.DROP_TARGET);
            this._currentDropTarget = this.draggedTask;
        } catch (error) {
            // ✅ Gracefully handle DOM manipulation errors (e.g., NotFoundError during race conditions)
            console.warn('⚠️ DOM manipulation failed during rearrange (likely race condition):', error.message);
            // Clear dragging state to prevent stuck UI
            if (this.draggedTask) {
                this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.DROP_TARGET);
            }
        }
    }

    /** Apply a still-pending move before the gesture's result is read or saved. */
    _flushPendingRearrange() {
        if (this._pendingRearrange) this._applyPendingRearrange();
    }

    /**
     * A drag ended without a drop (Escape, released off-window, cancelled native
     * drag, window blur, tab hidden). The DOM may already show the moved row
     * while state never changed; put the list back to what state says, and clear
     * every drag mark. A drop that DID land is handled by the drop/touchend paths.
     */
    _revertUnfinishedDrag() {
        const moved = this.didDragReorderOccur || !!this._pendingRearrange;
        this.cleanupDragState();
        if (moved) {
            try {
                this.deps.refreshUIFromState?.();
            } catch (error) {
                console.warn('⚠️ Could not restore the task order after an unfinished drag:', error);
            }
        }
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

            // Sorted view: refuse rather than reorder a list the user cannot see move.
            if (this._isSortActive()) {
                this._notifyReorderPaused();
                return;
            }

            // Prevent arrow reordering on completed tasks
            if (taskItem.querySelector(DOM_SELECTORS.TASK_INPUT_CHECKED)) return;

            // Resolve the NEIGHBOUR from the DOM, then reorder state by ID.
            //
            // This used to take `currentIndex` from `taskList.children` and splice
            // `cycle.tasks` at it, which is only correct while the two are
            // index-for-index identical. Two ordinary things break that, and both
            // moved the WRONG task with no visible feedback (measured, v2.538):
            //
            //   - the completed-tasks dropdown moves completed rows OUT of
            //     #taskList (completedTasksManager.moveToCompleted), so the lists
            //     desynchronise. state [A,B,C,D] with A completed, move-down on B
            //     produced [B,A,C,D] instead of [A,C,B,D] — it moved A.
            //   - a non-default sort reorders the DOM within the active list:
            //     state [Zebra,Apple,Mango] renders as [Apple,Mango,Zebra].
            //     (Since Oct 2026 the arrows refuse under a sort — see the
            //     _isSortActive guard above — because the re-render re-sorted
            //     the view and the move was correct but invisible.)
            //
            // In a routine manager the task sequence IS the routine, so that was
            // silent corruption of the thing the user built to run repeatedly.
            // `saveDragReorder` below already did it correctly — it maps ids and
            // preserves rows not in the DOM. Same operation, two doors; this is the
            // one that was never hardened.
            //
            // The DOM still decides WHICH neighbour (it is what the user is looking
            // at and pointing the arrow at); state decides where that lands.
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            const rows = Array.from(taskList.children);
            const domIndex = rows.indexOf(taskItem);
            const movingUp = button.classList.contains(DOM_CLASSES.MOVE_UP);
            const targetRow = movingUp ? rows[domIndex - 1] : rows[domIndex + 1];

            // Already at the end of the list the user can see.
            if (domIndex === -1 || !targetRow) return;

            const taskId = taskItem.dataset.taskId;
            const targetTaskId = targetRow.dataset.taskId;
            if (!taskId || !targetTaskId) return;

            // Reorder via state system (state-first pattern)
            const AppState = this._getAppState();
            if (AppState?.isReady?.()) {
                // Capture undo snapshot BEFORE reordering
                const currentState = AppState.get();
                if (currentState) this.deps.captureStateSnapshot?.(currentState);

                // Update state: reorder tasks AND set activeTaskId
                AppState.update(state => {
                    const activeCycleId = getActiveRoutineId(state);
                    if (activeCycleId && getRoutine(state, activeCycleId)) {
                        const tasks = getRoutine(state, activeCycleId).tasks;
                        const from = tasks ? tasks.findIndex(t => t.id === taskId) : -1;
                        if (tasks && from !== -1 && tasks.some(t => t.id === targetTaskId)) {
                            // Lift the task out first, THEN locate the target — its
                            // index shifts when the moved task sat before it.
                            const [movedTask] = tasks.splice(from, 1);
                            const targetIndex = tasks.findIndex(t => t.id === targetTaskId);
                            tasks.splice(movingUp ? targetIndex : targetIndex + 1, 0, movedTask);
                        }
                    }
                    // Set activeTaskId so rendering restores task options (state-driven UI)
                    if (!state.ui) state.ui = {};
                    state.ui.activeTaskId = taskId || null;
                    // Signal that this render should restore options (explicit user action)
                    state.ui.shouldRestoreActiveTaskOptions = true;
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
                        // Escaped builder, not an inline template — an id with a
                        // quote/bracket would throw DOMException here otherwise.
                        const movedTask = document.querySelector(DATA_SELECTORS.elementByTaskId(taskId));
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
                announce(getLabel(arrowClass === DOM_CLASSES.MOVE_UP
                        ? 'accessibility.taskMovedUp'
                        : 'accessibility.taskMovedDown'));

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
        // The last move may still be on its timer — apply it first, or a quick
        // release saves the order from BEFORE the row the user let go over.
        this._flushPendingRearrange();
        if (!this.didDragReorderOccur) return;

        const AppState = this._getAppState();
        if (AppState?.isReady?.()) {
            // Read task order from DOM
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            const taskElements = taskList?.querySelectorAll(DOM_SELECTORS.TASK);
            const newTaskOrder = [];
            taskElements?.forEach(taskEl => {
                const taskId = taskEl.dataset.taskId;
                if (taskId) newTaskOrder.push(taskId);
            });

            // A drag that wandered over a neighbour and came back has moved
            // nothing: no snapshot, no write, no undo step for it.
            const currentState = AppState.get();
            const currentTasks = currentState ? getRoutine(currentState, getActiveRoutineId(currentState))?.tasks : null;
            const unchanged = Array.isArray(currentTasks) &&
                mergeVisibleOrder(currentTasks, newTaskOrder).every((t, i) => t === currentTasks[i]);

            // Capture undo snapshot BEFORE saving new order
            if (currentState && !unchanged) this.deps.captureStateSnapshot?.(currentState);

            // Update AppState with new order
            if (!unchanged) AppState.update(state => {
                const activeCycleId = getActiveRoutineId(state);
                if (activeCycleId && getRoutine(state, activeCycleId)) {
                    const tasks = getRoutine(state, activeCycleId).tasks;
                    if (tasks && newTaskOrder.length > 0) {
                        // Hidden rows (completed tasks in the dropdown) keep their
                        // index — see mergeVisibleOrder for what appending them did.
                        getRoutine(state, activeCycleId).tasks = mergeVisibleOrder(tasks, newTaskOrder);
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
            this._pendingRearrange = null;

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

        // Find first/last INCOMPLETE tasks (skip completed — their arrows are hidden)
        const tasks = Array.from(taskList.children).filter(el =>
            el.classList.contains(DOM_CLASSES.TASK) && !el.querySelector(DOM_SELECTORS.TASK_INPUT_CHECKED)
        );

        const firstTask = tasks[0] || null;
        const lastTask = tasks.length > 1 ? tasks[tasks.length - 1] : null;

        if (firstTask) {
            firstTask.classList.add(DOM_CLASSES.IS_FIRST_TASK);
        }
        if (lastTask && lastTask !== firstTask) {
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
