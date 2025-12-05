/**
 * 🔄 miniCycle Drag & Drop Manager
 * Handles task rearrangement via drag-and-drop and arrow buttons
 * Uses Resilient Constructor Pattern - graceful degradation with user feedback
 *
 * @module modules/task/dragDropManager
 * @version 1.393
 */

import { appInit } from '../core/appInit.js';

// Module-level deps for late injection
let _deps = {};

/**
 * Set dependencies for DragDropManager (call before init)
 * @param {Object} dependencies - { AppState, saveCurrentTaskOrder, etc. }
 */
export function setDragDropManagerDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('🔄 DragDropManager dependencies set:', Object.keys(dependencies));
}

export class DragDropManager {
    constructor(dependencies = {}) {
        // Merge injected deps with constructor deps (constructor takes precedence)
        const mergedDeps = { ..._deps, ...dependencies };

        // Store dependencies with intelligent fallbacks
        this.deps = {
            // Core state access
            AppState: mergedDeps.AppState,
            saveCurrentTaskOrder: mergedDeps.saveCurrentTaskOrder || this.fallbackSave,
            autoSave: mergedDeps.autoSave || this.fallbackAutoSave,
            updateProgressBar: mergedDeps.updateProgressBar || this.fallbackUpdate,
            updateStatsPanel: mergedDeps.updateStatsPanel || this.fallbackUpdate,
            checkCompleteAllButton: mergedDeps.checkCompleteAllButton || this.fallbackUpdate,
            updateUndoRedoButtons: mergedDeps.updateUndoRedoButtons || this.fallbackUpdate,
            captureStateSnapshot: mergedDeps.captureStateSnapshot || this.fallbackCapture,
            refreshUIFromState: mergedDeps.refreshUIFromState || this.fallbackRefresh,
            revealTaskButtons: mergedDeps.revealTaskButtons || this.fallbackReveal,
            hideTaskButtons: mergedDeps.hideTaskButtons || this.fallbackHide,
            isTouchDevice: mergedDeps.isTouchDevice || this.fallbackIsTouchDevice,
            enableUndoSystemOnFirstInteraction: mergedDeps.enableUndoSystemOnFirstInteraction || this.fallbackEnableUndo,
            showNotification: mergedDeps.showNotification || this.fallbackNotification
        };

        // Internal state
        this.rearrangeTimeout = null;
        this.REARRANGE_DELAY = 75; // ms delay to smooth reordering
        this.REORDER_SNAPSHOT_INTERVAL = 500; // ms between undo snapshots

        // Initialization flag
        this.initialized = false;

        console.log('🔄 DragDropManager created with dependencies');
    }

    /**
     * Get AppState (deferred lookup for late binding)
     * @private
     */
    _getAppState() {
        return this.deps.AppState || window.AppState;
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
            await appInit.waitForCore();
            console.log('✅ Core systems ready, initializing drag & drop...');

            this.setupRearrange();
            this.initialized = true;
            console.log('✅ DragDropManager initialized successfully');
        } catch (error) {
            console.warn('⚠️ DragDropManager initialization failed:', error);
            this.deps.showNotification('Drag & drop may not work properly', 'warning');
        }
    }

    /**
     * Setup drag and drop event handling
     */
    setupRearrange() {
        if (window.AppGlobalState?.rearrangeInitialized) {
            console.log('ℹ️ Rearrange already initialized');
            return;
        }

        try {
            // Mark as initialized
            if (window.AppGlobalState) {
                window.AppGlobalState.rearrangeInitialized = true;
            }

            // Add event delegation for arrow clicks (survives DOM re-renders)
            const taskList = document.getElementById("taskList");
            if (taskList) {
                taskList.addEventListener("click", (event) => {
                    if (event.target.matches('.move-up, .move-down')) {
                        event.preventDefault();
                        event.stopPropagation();
                        this.handleArrowClick(event.target);
                    }
                });
            }

            // Setup dragover handler
            document.addEventListener("dragover", (event) => {
                event.preventDefault();
                requestAnimationFrame(() => {
                    const movingTask = event.target.closest(".task");
                    if (movingTask) {
                        this.handleRearrange(movingTask, event);
                    }
                });
            });

            // Setup drop handler
            document.addEventListener("drop", (event) => {
                event.preventDefault();
                if (!window.AppGlobalState?.draggedTask) return;

                if (window.AppGlobalState.didDragReorderOccur) {
                    this.deps.saveCurrentTaskOrder();
                    this.deps.autoSave();
                    this.deps.updateProgressBar();
                    this.deps.updateStatsPanel();
                    this.deps.checkCompleteAllButton();
                    this.deps.updateUndoRedoButtons();

                    // Update move arrows (first/last task may have changed)
                    this.updateMoveArrowsVisibility();

                    console.log("🔁 Drag reorder completed and saved with undo snapshot.");
                }

                this.cleanupDragState();
                if (window.AppGlobalState) {
                    window.AppGlobalState.lastReorderTime = 0;
                    window.AppGlobalState.didDragReorderOccur = false;
                }
            });

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

            let readyToDrag = false;
            let touchStartX = 0;
            let touchStartY = 0;
            let holdTimeout = null;
            let isDragging = false;
            let isLongPress = false;
            let isTap = false;
            let preventClick = false;
            const moveThreshold = 15; // Movement threshold for long press

            // 📱 **Touch-based Drag for Mobile**
            taskElement.addEventListener("touchstart", (event) => {
                if (event.target.closest(".task-options")) return;
                isLongPress = false;
                isDragging = false;
                isTap = true;
                readyToDrag = false;
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                preventClick = false;

                // Remove .long-pressed from all other tasks before long press starts
                document.querySelectorAll(".task").forEach(task => {
                    if (task !== taskElement) {
                        task.classList.remove("long-pressed");
                        this.deps.hideTaskButtons(task);
                    }
                });

                holdTimeout = setTimeout(() => {
                    isLongPress = true;
                    isTap = false;
                    if (window.AppGlobalState) {
                        window.AppGlobalState.draggedTask = taskElement;
                    }
                    isDragging = true;
                    taskElement.classList.add("dragging", "long-pressed");

                    event.preventDefault();

                    console.log("📱 Long Press Detected - Showing Task Options", taskElement);

                    // Ensure task options remain visible
                    // Pass 'long-press' as caller so controller allows it in both modes
                    this.deps.revealTaskButtons(taskElement, 'long-press');
                }, 500); // Long-press delay (500ms)
            }, { passive: false }); // Must be non-passive - calls preventDefault() on line 199

            taskElement.addEventListener("touchmove", (event) => {
                const touchMoveX = event.touches[0].clientX;
                const touchMoveY = event.touches[0].clientY;
                const deltaX = Math.abs(touchMoveX - touchStartX);
                const deltaY = Math.abs(touchMoveY - touchStartY);

                // Cancel long press if moving too much
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

                if (isLongPress && readyToDrag && !isDragging) {
                    // draggable already set in enableDragAndDrop()
                    isDragging = true;

                    if (event.cancelable) {
                        event.preventDefault();
                    }
                }

                if (isDragging && window.AppGlobalState?.draggedTask) {
                    if (event.cancelable) {
                        event.preventDefault();
                    }
                    const movingTask = document.elementFromPoint(event.touches[0].clientX, event.touches[0].clientY);
                    if (movingTask) {
                        this.handleRearrange(movingTask, event);
                    }
                }
            }, { passive: false }); // Must be non-passive - calls preventDefault() on lines 234, 240

            taskElement.addEventListener("touchend", () => {
                clearTimeout(holdTimeout);

                if (isTap) {
                    preventClick = true;
                    setTimeout(() => {
                        preventClick = false;
                    }, 100);
                }

                if (window.AppGlobalState?.draggedTask) {
                    window.AppGlobalState.draggedTask.classList.remove("dragging", "rearranging");
                    window.AppGlobalState.draggedTask = null;
                }

                isDragging = false;

                // Ensure task options remain open only when a long press is detected
                if (isLongPress) {
                    console.log("✅ Long Press Completed - Keeping Task Options Open", taskElement);
                    return;
                }

                taskElement.classList.remove("long-pressed");
            }, { passive: true });

            // 🖱️ **Mouse-based Drag for Desktop**
            taskElement.addEventListener("dragstart", (event) => {
                if (event.target.closest(".task-options")) return;

                // Enable undo system on first user interaction
                this.deps.enableUndoSystemOnFirstInteraction();

                if (window.AppGlobalState) {
                    window.AppGlobalState.draggedTask = taskElement;
                }
                event.dataTransfer.setData("text/plain", "");

                // Add dragging class for desktop as well
                taskElement.classList.add("dragging");

                // Hide ghost image on desktop (use pre-created image for Safari compatibility)
                if (!this.deps.isTouchDevice()) {
                    event.dataTransfer.setDragImage(transparentPixel, 0, 0);
                }
            });

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
        if (!target || !window.AppGlobalState?.draggedTask || target === window.AppGlobalState.draggedTask) return;

        clearTimeout(this.rearrangeTimeout);

        this.rearrangeTimeout = setTimeout(() => {
            if (!document.contains(target) || !document.contains(window.AppGlobalState.draggedTask)) return;

            const parent = window.AppGlobalState.draggedTask.parentNode;
            if (!parent || !target.parentNode) return;

            const bounding = target.getBoundingClientRect();
            const offset = event.clientY - bounding.top;

            // ✅ ALWAYS mark that a reorder occurred (for save on drop)
            window.AppGlobalState.didDragReorderOccur = true;

            // Snapshot only if enough time has passed (for undo system)
            const now = Date.now();
            if (window.AppGlobalState.lastReorderTime &&
                now - window.AppGlobalState.lastReorderTime > this.REORDER_SNAPSHOT_INTERVAL) {
                window.AppGlobalState.lastReorderTime = now;
            } else if (!window.AppGlobalState.lastReorderTime) {
                window.AppGlobalState.lastReorderTime = now;
            }

            const isLastTask = !target.nextElementSibling;
            const isFirstTask = !target.previousElementSibling;

            document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));

            // ✅ Wrap all DOM manipulation in try-catch to handle race conditions
            try {
                if (isLastTask && target.nextSibling !== window.AppGlobalState.draggedTask) {
                    // ✅ Verify nodes are still valid before DOM manipulation
                    if (!document.contains(window.AppGlobalState.draggedTask) || !parent.contains) {
                        console.warn('⚠️ DOM nodes became invalid before appendChild');
                        return;
                    }
                    parent.appendChild(window.AppGlobalState.draggedTask);
                    window.AppGlobalState.draggedTask.classList.add("drop-target");
                    return;
                }

                if (isFirstTask && target.previousSibling !== window.AppGlobalState.draggedTask) {
                    // ✅ Verify nodes are still valid before DOM manipulation
                    if (!document.contains(window.AppGlobalState.draggedTask) || !parent.firstChild) {
                        console.warn('⚠️ DOM nodes became invalid before insertBefore (first child)');
                        return;
                    }
                    parent.insertBefore(window.AppGlobalState.draggedTask, parent.firstChild);
                    window.AppGlobalState.draggedTask.classList.add("drop-target");
                    return;
                }

                if (offset > bounding.height / 3) {
                    if (target.nextSibling !== window.AppGlobalState.draggedTask) {
                        // ✅ Verify nodes are still valid before DOM manipulation
                        if (!document.contains(window.AppGlobalState.draggedTask) || !document.contains(target)) {
                            console.warn('⚠️ DOM nodes became invalid before insertBefore (next sibling)');
                            return;
                        }
                        parent.insertBefore(window.AppGlobalState.draggedTask, target.nextSibling);
                    }
                } else {
                    if (target.previousSibling !== window.AppGlobalState.draggedTask) {
                        // ✅ Verify nodes are still valid before DOM manipulation (line 357 fix)
                        if (!document.contains(window.AppGlobalState.draggedTask) || !document.contains(target)) {
                            console.warn('⚠️ DOM nodes became invalid before insertBefore (target)');
                            return;
                        }
                        parent.insertBefore(window.AppGlobalState.draggedTask, target);
                    }
                }

                // ✅ Final verification before adding class
                if (window.AppGlobalState.draggedTask && document.contains(window.AppGlobalState.draggedTask)) {
                    window.AppGlobalState.draggedTask.classList.add("drop-target");
                }
            } catch (error) {
                // ✅ Gracefully handle DOM manipulation errors (e.g., NotFoundError during race conditions)
                console.warn('⚠️ DOM manipulation failed during rearrange (likely race condition):', error.message);
                // Clear dragging state to prevent stuck UI
                if (window.AppGlobalState.draggedTask) {
                    window.AppGlobalState.draggedTask.classList.remove("dragging", "drop-target");
                }
                return;
            }
        }, this.REARRANGE_DELAY);
    }

    /**
     * Handle arrow button clicks for task reordering
     * @param {HTMLElement} button - The arrow button that was clicked
     */
    handleArrowClick(button) {
        try {
            const taskItem = button.closest('.task');
            if (!taskItem) return;

            const taskList = document.getElementById('taskList');
            const allTasks = Array.from(taskList.children);
            const currentIndex = allTasks.indexOf(taskItem);

            let newIndex;
            if (button.classList.contains('move-up')) {
                newIndex = Math.max(0, currentIndex - 1);
            } else {
                newIndex = Math.min(allTasks.length - 1, currentIndex + 1);
            }

            if (newIndex === currentIndex) return; // No movement needed

            // Reorder via state system (splice in array)
            const AppState = this._getAppState();
            if (AppState?.isReady?.()) {
                // Capture undo snapshot BEFORE reordering
                const currentState = AppState.get();
                if (currentState) this.deps.captureStateSnapshot(currentState);

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
                }, true); // immediate save

                // Re-render from state to reflect changes
                this.deps.refreshUIFromState();

                // Update undo/redo buttons
                this.deps.updateUndoRedoButtons();

                console.log(`✅ Task moved from position ${currentIndex} to ${newIndex} via arrows`);
            } else {
                console.warn('⚠️ AppState not ready for arrow reordering');
                this.deps.showNotification('Unable to reorder tasks right now', 'warning');
            }
        } catch (error) {
            console.warn('⚠️ Arrow click handler failed:', error);
            this.deps.showNotification('Failed to reorder task', 'warning');
        }
    }

    /**
     * Cleanup drag state after drag operation completes
     */
    cleanupDragState() {
        try {
            if (window.AppGlobalState?.draggedTask) {
                window.AppGlobalState.draggedTask.classList.remove("dragging", "rearranging");
                window.AppGlobalState.draggedTask = null;
            }

            if (window.AppGlobalState) {
                window.AppGlobalState.lastRearrangeTarget = null;
            }

            document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));
        } catch (error) {
            console.warn('⚠️ Failed to cleanup drag state:', error);
        }
    }

    /**
     * Setup drag end cleanup handlers
     */
    setupDragEndCleanup() {
        try {
            document.addEventListener("drop", () => this.cleanupDragState());
            document.addEventListener("dragover", () => {
                document.querySelectorAll(".rearranging").forEach(task => task.classList.remove("rearranging"));
            });
        } catch (error) {
            console.warn('⚠️ Failed to setup drag end cleanup:', error);
        }
    }

    /**
     * Update move arrows visibility based on state
     */
    updateMoveArrowsVisibility() {
        try {
            console.log('🔄 Updating move arrows visibility (state-based)...');

            let showArrows = false;
            const AppState = this._getAppState();

            if (AppState?.isReady?.()) {
                const currentState = AppState.get();
                showArrows = currentState?.ui?.moveArrowsVisible || false;
                console.log('📊 Arrow visibility from AppState:', showArrows);
            } else {
                // Silent fallback when state isn't ready (during initialization)
                const storedValue = localStorage.getItem("miniCycleMoveArrows");
                if (storedValue !== null) {
                    showArrows = storedValue === "true";
                    console.log('📊 Arrow visibility from localStorage fallback:', showArrows);
                } else {
                    showArrows = false;
                    console.log('📊 Arrow visibility using default:', showArrows);
                }
            }

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
            this.deps.showNotification('Failed to toggle arrow visibility', 'warning');
        }
    }

    /**
     * Update arrow visibility in the DOM
     * @param {boolean} showArrows - Whether to show arrows
     */
    updateArrowsInDOM(showArrows) {
        try {
            const allTasks = document.querySelectorAll(".task");

            allTasks.forEach((task, index) => {
                const upButton = task.querySelector('.move-up');
                const downButton = task.querySelector('.move-down');
                const taskOptions = task.querySelector('.task-options');
                const taskButtons = task.querySelectorAll('.task-btn');

                // ✅ Use .hidden class for consistent behavior (display: none !important)
                if (upButton) {
                    if (showArrows && index !== 0) {
                        upButton.classList.remove("hidden");
                    } else {
                        upButton.classList.add("hidden");
                    }
                }
                if (downButton) {
                    if (showArrows && index !== allTasks.length - 1) {
                        downButton.classList.remove("hidden");
                    } else {
                        downButton.classList.add("hidden");
                    }
                }

                // Ensure task options remain interactive
                if (taskOptions) {
                    taskOptions.style.pointerEvents = "auto";
                }

                // Ensure individual buttons remain interactive
                taskButtons.forEach(button => {
                    button.style.pointerEvents = "auto";
                });
            });
        } catch (error) {
            console.warn('⚠️ Failed to update arrows in DOM:', error);
        }
    }

    // ============================================
    // Fallback Methods (Resilient Constructor Pattern)
    // ============================================

    fallbackSave() {
        console.warn('⚠️ saveCurrentTaskOrder not available - task order may not persist');
    }

    fallbackAutoSave() {
        console.warn('⚠️ autoSave not available - changes may not be saved');
    }

    fallbackUpdate() {
        // Silent fallback - these are UI updates that can be skipped
    }

    fallbackCapture(state) {
        console.warn('⚠️ captureStateSnapshot not available - undo may not work for drag operations');
    }

    fallbackRefresh() {
        console.warn('⚠️ refreshUIFromState not available - UI may not reflect changes');
    }

    fallbackReveal(task) {
        console.warn('⚠️ revealTaskButtons not available - task buttons may not appear');
    }

    fallbackHide(task) {
        console.warn('⚠️ hideTaskButtons not available - task buttons may not hide');
    }

    fallbackIsTouchDevice() {
        // Simple touch detection fallback
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    fallbackEnableUndo() {
        // Silent fallback - undo system activation is optional
    }

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
 * Note: Uses window.dragDropManager as fallback for cross-module instance access
 */
function enableDragAndDropOnTask(taskElement) {
    const manager = dragDropManager || window.dragDropManager;
    if (!manager) {
        console.warn('⚠️ DragDropManager not initialized - call initDragDropManager() first');
        return;
    }
    manager.enableDragAndDrop(taskElement);
}

/**
 * Update move arrows visibility
 */
function updateMoveArrowsVisibility() {
    const manager = dragDropManager || window.dragDropManager;
    if (!manager) {
        console.warn('⚠️ DragDropManager not initialized');
        return;
    }
    manager.updateMoveArrowsVisibility();
}

/**
 * Toggle arrow visibility
 */
function toggleArrowVisibility() {
    const manager = dragDropManager || window.dragDropManager;
    if (!manager) {
        console.warn('⚠️ DragDropManager not initialized');
        return;
    }
    manager.toggleArrowVisibility();
}

/**
 * Update arrows in DOM (called from renderTasks)
 * @param {boolean} showArrows - Whether to show arrows
 */
function updateArrowsInDOM(showArrows) {
    const manager = dragDropManager || window.dragDropManager;
    if (!manager) {
        console.warn('⚠️ DragDropManager not initialized');
        return;
    }
    manager.updateArrowsInDOM(showArrows);
}

// Phase 2 Step 9 - Clean exports (no window.* pollution)
console.log('🔄 DragDropManager module loaded (Phase 2 - no window.* exports)');

// Export for ES6 modules
export { initDragDropManager, enableDragAndDropOnTask, updateMoveArrowsVisibility, toggleArrowVisibility, updateArrowsInDOM };
