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
    isTouchDevice: optional(null),
    enableUndoSystemOnFirstInteraction: optional(null),
    showNotification: optional(null),
    safeAddEventListener: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, updateProgressBar: Function|null, updateStatsPanel: Function|null, checkCompleteAllButton: Function|null, updateUndoRedoButtons: Function|null, captureStateSnapshot: Function|null, refreshUIFromState: Function|null, revealTaskButtons: Function|null, hideTaskButtons: Function|null, isTouchDevice: Function|null, enableUndoSystemOnFirstInteraction: Function|null, showNotification: Function|null, safeAddEventListener: Function|null, AppMeta: Object|null}} */
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
    console.log('🔄 DragDropManager dependencies set:', Object.keys(dependencies));
}

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
            isTouchDevice: resolvedDeps.isTouchDevice || (() => 'ontouchstart' in window),
            enableUndoSystemOnFirstInteraction: resolvedDeps.enableUndoSystemOnFirstInteraction,
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            safeAddEventListener: resolvedDeps.safeAddEventListener
        };

        // Internal state (local to this instance, not global)
        this.rearrangeTimeout = null;
        this.REARRANGE_DELAY = 75; // ms delay to smooth reordering
        this.REORDER_SNAPSHOT_INTERVAL = 500; // ms between undo snapshots

        // Drag state (previously on AppGlobalState, now local)
        this.draggedTask = null;
        this.rearrangeInitialized = false;
        this.didDragReorderOccur = false;
        this.lastReorderTime = 0;
        this.lastRearrangeTarget = null;

        // Track current drop target to avoid querySelectorAll in hot paths
        this._currentDropTarget = null;

        // Initialization flag
        this.initialized = false;

        console.log('🔄 DragDropManager created with dependencies');
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
            console.log('⏳ DragDropManager waiting for core systems...');
            await _deps.appInit?.waitForCore();
            console.log('✅ Core systems ready, initializing drag & drop...');

            this.setupRearrange();
            this.setupVisibilityCleanup();
            this.initialized = true;
            console.log('✅ DragDropManager initialized successfully');
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
                    console.log('🧹 Cleaning up drag state due to visibility change');
                    this.cleanupDragState();
                }
            };
            safeAdd(document, 'visibilitychange', this._dragVisibilityHandler);

            // Also cleanup on window blur (user clicks outside browser)
            this._dragBlurHandler = () => {
                if (this.draggedTask) {
                    console.log('🧹 Cleaning up drag state due to window blur');
                    this.cleanupDragState();
                }
            };
            safeAdd(window, 'blur', this._dragBlurHandler);

            console.log('✅ Drag visibility cleanup handlers installed');
        } catch (error) {
            console.warn('⚠️ Failed to setup visibility cleanup:', error);
        }
    }

    /**
     * Setup drag and drop event handling
     */
    setupRearrange() {
        if (this.rearrangeInitialized) {
            console.log('ℹ️ Rearrange already initialized');
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
                    if (event.target.matches('.move-up, .move-down')) {
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
                    const movingTask = event.target.closest(".task");
                    if (movingTask) {
                        this.handleRearrange(movingTask, event);
                    }
                });
            };
            safeAdd(document, "dragover", this._dragoverHandler);

            // Setup drop handler (desktop HTML5 drag-and-drop)
            this._dropHandler = (event) => {
                event.preventDefault();
                if (!this.draggedTask) return;

                this.saveDragReorder();
                this.cleanupDragState();
                this.lastReorderTime = 0;
            };
            safeAdd(document, "drop", this._dropHandler);

            console.log('✅ Rearrange event handlers setup complete');
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

            // ✅ SAFARI FIX: Create transparent drag image OUTSIDE event handler
            // Safari requires the image to exist before dragstart fires
            const transparentPixel = new Image();
            transparentPixel.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

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

            // 📱 **Touch-based Drag for Mobile**
            taskElement._touchstartHandler = (event) => {
                if (event.target.closest(".task-options")) return;
                isLongPress = false;
                isDragging = false;
                isTap = true;
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                preventClick = false;

                // Remove .long-pressed from all other tasks before long press starts
                document.querySelectorAll(DOM_SELECTORS.TASK).forEach(task => {
                    if (task !== taskElement) {
                        task.classList.remove("long-pressed");
                        this.deps.hideTaskButtons?.(task);
                    }
                });

                holdTimeout = setTimeout(() => {
                    isLongPress = true;
                    isTap = false;
                    this.draggedTask = taskElement;
                    isDragging = true;
                    taskElement.classList.add("dragging", "long-pressed");

                    event.preventDefault();

                    console.log("📱 Long Press Detected - Showing Task Options", taskElement);

                    // Ensure task options remain visible
                    // Pass 'long-press' as caller so controller allows it in both modes
                    this.deps.revealTaskButtons?.(taskElement, 'long-press');
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
                    const movingTask = document.elementFromPoint(touchMoveX, touchMoveY);
                    if (movingTask) {
                        this.handleRearrange(movingTask, event);
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

                if (isTap) {
                    preventClick = true;
                    setTimeout(() => {
                        preventClick = false;
                    }, 100);
                }

                // Save reordered state before clearing drag references
                if (isDragging && this.didDragReorderOccur) {
                    this.saveDragReorder();
                }

                if (this.draggedTask) {
                    this.draggedTask.classList.remove("dragging", "rearranging");
                    this.draggedTask = null;
                }

                isDragging = false;
                this.lastReorderTime = 0;

                // Keep task options open after a long press (no drag occurred)
                if (isLongPress) {
                    return;
                }

                taskElement.classList.remove("long-pressed");
            };
            safeAdd(taskElement, "touchend", taskElement._touchendHandler, { passive: true });

            // Fix #72: Handle touchcancel (system alert, gesture takeover, etc.)
            taskElement._touchcancelHandler = () => {
                clearTimeout(holdTimeout);

                if (this.draggedTask) {
                    this.draggedTask.classList.remove("dragging", "rearranging");
                    this.draggedTask = null;
                }

                isDragging = false;
                isLongPress = false;
                isTap = false;
                taskElement.classList.remove("long-pressed");
                console.log("🚫 Touch cancelled - cleaned up drag state");
            };
            safeAdd(taskElement, "touchcancel", taskElement._touchcancelHandler, { passive: true });

            // 🖱️ **Mouse-based Drag for Desktop**
            taskElement._dragstartHandler = (event) => {
                if (event.target.closest(".task-options")) return;

                // Enable undo system on first user interaction
                this.deps.enableUndoSystemOnFirstInteraction?.();

                this.draggedTask = taskElement;
                event.dataTransfer.setData("text/plain", "");

                // Add dragging class for desktop as well
                taskElement.classList.add("dragging");

                // Hide ghost image on desktop only - let iOS show native drag preview on mobile
                const isMobileDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                if (!isMobileDevice) {
                    event.dataTransfer.setDragImage(transparentPixel, 0, 0);
                }
            };
            safeAdd(taskElement, "dragstart", taskElement._dragstartHandler);

            console.log('✅ Drag and drop enabled on task element');
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

            // Snapshot only if enough time has passed (for undo system)
            const now = Date.now();
            if (this.lastReorderTime &&
                now - this.lastReorderTime > this.REORDER_SNAPSHOT_INTERVAL) {
                this.lastReorderTime = now;
            } else if (!this.lastReorderTime) {
                this.lastReorderTime = now;
            }

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
                    this.draggedTask.classList.remove("dragging", "drop-target");
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
            const taskItem = button.closest('.task');
            if (!taskItem) return;

            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            const allTasks = Array.from(taskList.children);
            const currentIndex = allTasks.indexOf(taskItem);

            let newIndex;
            if (button.classList.contains('move-up')) {
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
                const arrowClass = button.classList.contains('move-up') ? 'move-up' : 'move-down';

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
                            taskOptions.classList.add('task-options-visible');
                            taskOptions.classList.remove('task-options-force-hidden');
                            taskOptions.querySelectorAll('button.task-btn').forEach(btn => {
                                btn.tabIndex = 0;
                            });
                        }

                        // Try the same arrow first; if hidden (first/last boundary), fall back to opposite arrow
                        const arrowBtn = movedTask.querySelector(`.${arrowClass}`);
                        const oppositeClass = arrowClass === 'move-up' ? 'move-down' : 'move-up';
                        const oppositeBtn = movedTask.querySelector(`.${oppositeClass}`);

                        if (arrowBtn && getComputedStyle(arrowBtn).visibility !== 'hidden') {
                            arrowBtn.focus();
                        } else if (oppositeBtn && getComputedStyle(oppositeBtn).visibility !== 'hidden') {
                            oppositeBtn.focus();
                        } else {
                            // All arrows hidden — focus task text as fallback
                            movedTask.querySelector('.task-text')?.focus();
                        }
                    });
                }

                console.log(`✅ Task moved from position ${currentIndex} to ${newIndex} via arrows`);
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

            console.log("🔁 Drag reorder: state updated with new order");
        }

        // Update UI elements
        this.deps.updateProgressBar?.();
        this.deps.updateStatsPanel?.();
        this.deps.checkCompleteAllButton?.();
        this.deps.updateUndoRedoButtons?.();
        this.updateFirstLastMarkers();

        this.didDragReorderOccur = false;
    }

    /**
     * Cleanup drag state after drag operation completes
     */
    cleanupDragState() {
        try {
            if (this.draggedTask) {
                this.draggedTask.classList.remove("dragging", "rearranging");
                this.draggedTask = null;
            }

            this.lastRearrangeTarget = null;

            // O(1) cleanup instead of querySelectorAll
            if (this._currentDropTarget) {
                this._currentDropTarget.classList.remove(DOM_CLASSES.DROP_TARGET);
                this._currentDropTarget = null;
            }
        } catch (error) {
            console.warn('⚠️ Failed to cleanup drag state:', error);
        }
    }

    /**
     * Setup drag end cleanup handlers
     */
    setupDragEndCleanup() {
        try {
            const safeAdd = this.deps.safeAddEventListener;
            this._dragEndDropHandler = () => this.cleanupDragState();
            safeAdd(document, "drop", this._dragEndDropHandler);
            this._dragEndDragoverHandler = () => {
                document.querySelectorAll(DOM_SELECTORS.REARRANGING).forEach(task => task.classList.remove("rearranging"));
            };
            safeAdd(document, "dragover", this._dragEndDragoverHandler);
        } catch (error) {
            console.warn('⚠️ Failed to setup drag end cleanup:', error);
        }
    }

    /**
     * Update move arrows visibility based on AppState (single source of truth)
     */
    updateMoveArrowsVisibility() {
        try {
            console.log('🔄 Updating move arrows visibility (state-based)...');

            const AppState = this._getAppState();

            if (!AppState?.isReady?.()) {
                console.log('⏳ AppState not ready, deferring arrow visibility update');
                return;
            }

            const currentState = AppState.get();
            const showArrows = currentState?.ui?.moveArrowsVisible || false;
            console.log('📊 Arrow visibility from AppState:', showArrows);

            // Update DOM to reflect current state
            this.updateArrowsInDOM(showArrows);

            console.log(`✅ Move arrows visibility updated: ${showArrows ? "visible" : "hidden"}`);
        } catch (error) {
            console.warn('⚠️ Failed to update arrow visibility:', error);
        }
    }

    /**
     * Toggle arrow visibility
     */
    toggleArrowVisibility() {
        try {
            console.log('🔄 Toggling arrow visibility (state-based)...');

            const AppState = this._getAppState();

            if (!AppState?.isReady?.()) {
                console.log('⚠️ AppState not ready yet, deferring toggle until ready');
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

            console.log(`✅ Move arrows toggled to ${newVisibility ? "visible" : "hidden"} via state system`);
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
        taskList.querySelector(DOM_SELECTORS.IS_FIRST_TASK)?.classList.remove('is-first-task');
        taskList.querySelector(DOM_SELECTORS.IS_LAST_TASK)?.classList.remove('is-last-task');

        // Add new markers (direct children only)
        const firstTask = taskList.firstElementChild;
        const lastTask = taskList.lastElementChild;

        if (firstTask?.classList.contains('task')) {
            firstTask.classList.add('is-first-task');
        }
        if (lastTask?.classList.contains('task') && lastTask !== firstTask) {
            lastTask.classList.add('is-last-task');
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
            console.log(`✅ Arrow visibility updated via CSS (O(1)): ${showArrows ? 'visible' : 'hidden'}`);
        } catch (error) {
            console.warn('⚠️ Failed to update arrows in DOM:', error);
        }
    }

    // Fallback for notification (logs to console)
    fallbackNotification(message, type) {
        console.log(`[DragDrop] ${message}`);
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
console.log('🔄 DragDropManager module loaded (Phase 3 - DI-pure)');

// Export for ES6 modules
export { initDragDropManager, enableDragAndDropOnTask, updateMoveArrowsVisibility, toggleArrowVisibility, updateArrowsInDOM, setArrowsEnabled, updateFirstLastMarkers };
