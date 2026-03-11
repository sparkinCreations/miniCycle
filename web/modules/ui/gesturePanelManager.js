/**
 * Gesture Panel Manager Module (DI-Pure)
 *
 * Handles multi-platform gesture/input detection for panel navigation.
 * Supports touch, mouse, wheel, pointer, and keyboard events.
 * Extracted from statsPanel.js for better separation of concerns.
 *
 * @module ui/gesturePanelManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { GESTURE, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('GesturePanelManager', {
    safeAddEventListener: required(),
    showNotification: optional(null),
    isOverlayActive: optional(() => false),
    isDraggingNotification: optional(() => false),
    // Callbacks for view switching
    onShowStatsPanel: optional(null),
    onShowTaskView: optional(null)
});

export const setGesturePanelManagerDependencies = di.setDependencies;

// ============================================================================
// GESTURE PANEL MANAGER CLASS
// ============================================================================

/**
 * Manages gesture/input detection for panel navigation
 */
export class GesturePanelManager {
    constructor(overrides = {}) {
        this.deps = di.resolve(overrides);

        // State management
        this.state = {
            startX: 0,
            isSwiping: false,
            isStatsVisible: false,
            isMouseDragging: false,
            mouseStartX: 0,
            wheelDeltaX: 0,
            isPointerSwiping: false,
            pointerStartX: 0
        };

        // Configuration thresholds (from centralized constants.js)
        this.config = {
            SWIPE_THRESHOLD: GESTURE.SWIPE_THRESHOLD,
            MOUSE_DRAG_THRESHOLD: GESTURE.MOUSE_DRAG_THRESHOLD,
            WHEEL_RESET_DELAY: UI_TIMEOUTS.WHEEL_RESET_DELAY,
            TOUCH_SWIPE_THRESHOLD: GESTURE.TOUCH_SWIPE,
            MOUSE_DRAG_START_THRESHOLD: GESTURE.MOUSE_DRAG_START
        };

        // Timers
        this.wheelTimeout = null;

        // Event handler bindings (for proper removal)
        this.boundHandlers = {};

        // Initialization flag
        this._eventListenersInitialized = false;

    }

    /**
     * Initialize gesture handling
     */
    init() {
        this.setupEventListeners();
    }

    /**
     * Set up all event listeners for gesture detection
     */
    setupEventListeners() {
        // Idempotency guard
        if (this._eventListenersInitialized) {
            return;
        }
        this._eventListenersInitialized = true;

        // Bind methods to preserve 'this' context
        this.boundHandlers = {
            handleTouchStart: this.handleTouchStart.bind(this),
            handleTouchMove: this.handleTouchMove.bind(this),
            handleTouchEnd: this.handleTouchEnd.bind(this),
            handleWheel: this.handleWheel.bind(this),
            handleMouseDown: this.handleMouseDown.bind(this),
            handleMouseMove: this.handleMouseMove.bind(this),
            handleMouseUp: this.handleMouseUp.bind(this),
            handlePointerDown: this.handlePointerDown.bind(this),
            handlePointerMove: this.handlePointerMove.bind(this),
            handlePointerUp: this.handlePointerUp.bind(this),
            handleKeydown: this.handleKeydown.bind(this)
        };

        this.setupTouchEvents();
        this.setupMouseEvents();
        this.setupWheelEvents();
        this.setupPointerEvents();
        this.setupKeyboardEvents();
    }

    /**
     * Setup touch event listeners for mobile devices
     */
    setupTouchEvents() {
        const safeAdd = this.deps.safeAddEventListener;
        if (!safeAdd) return;
        safeAdd(document, "touchstart", this.boundHandlers.handleTouchStart, { passive: true });
        safeAdd(document, "touchmove", this.boundHandlers.handleTouchMove, { passive: true });
        safeAdd(document, "touchend", this.boundHandlers.handleTouchEnd, { passive: true });
    }

    /**
     * Setup mouse event listeners for desktop
     */
    setupMouseEvents() {
        const safeAdd = this.deps.safeAddEventListener;
        if (!safeAdd) return;
        safeAdd(document, "mousedown", this.boundHandlers.handleMouseDown);
        safeAdd(document, "mousemove", this.boundHandlers.handleMouseMove);
        safeAdd(document, "mouseup", this.boundHandlers.handleMouseUp);
    }

    /**
     * Setup wheel event listeners for trackpad/mouse wheel
     */
    setupWheelEvents() {
        const safeAdd = this.deps.safeAddEventListener;
        if (!safeAdd) return;
        safeAdd(document, "wheel", this.boundHandlers.handleWheel, { passive: false });
    }

    /**
     * Setup pointer event listeners for modern devices
     */
    setupPointerEvents() {
        const safeAdd = this.deps.safeAddEventListener;
        if (!safeAdd) return;
        safeAdd(document, "pointerdown", this.boundHandlers.handlePointerDown);
        safeAdd(document, "pointermove", this.boundHandlers.handlePointerMove);
        safeAdd(document, "pointerup", this.boundHandlers.handlePointerUp);
    }

    /**
     * Setup keyboard event listeners
     */
    setupKeyboardEvents() {
        const safeAdd = this.deps.safeAddEventListener;
        if (!safeAdd) return;
        safeAdd(document, "keydown", this.boundHandlers.handleKeydown);
    }

    // ==========================================
    // 📱 TOUCH EVENT HANDLERS
    // ==========================================

    handleTouchStart(event) {
        if (this.deps.isDraggingNotification()) return;
        if (this.deps.isOverlayActive()) return;

        // Exclude interactive elements (match mouse handler)
        if (
            event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
            ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
        ) {
            return;
        }

        this.state.startX = event.touches[0].clientX;
        this.state.isSwiping = true;
    }

    handleTouchMove(event) {
        if (!this.state.isSwiping || this.deps.isDraggingNotification()) return;
        if (this.deps.isOverlayActive()) return;

        const moveX = event.touches[0].clientX;
        const difference = this.state.startX - moveX;

        if (difference > this.config.TOUCH_SWIPE_THRESHOLD && !this.state.isStatsVisible) {
            this.state.isStatsVisible = true;
            this._triggerShowStatsPanel();
            this.state.isSwiping = false;
        }

        if (difference < -this.config.TOUCH_SWIPE_THRESHOLD && this.state.isStatsVisible) {
            this.state.isStatsVisible = false;
            this._triggerShowTaskView();
            this.state.isSwiping = false;
        }
    }

    handleTouchEnd() {
        this.state.isSwiping = false;
    }

    // ==========================================
    // 🖱️ MOUSE EVENT HANDLERS
    // ==========================================

    handleMouseDown(event) {
        if (this.deps.isOverlayActive()) return;

        // Exclude interactive elements
        if (
            this.deps.isDraggingNotification() ||
            event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
            ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
        ) {
            return;
        }

        this.state.isMouseDragging = false;
        this.state.mouseStartX = event.clientX;
        document.body.style.userSelect = "none";
    }

    handleMouseMove(event) {
        if (this.state.mouseStartX === 0) return;

        const deltaX = event.clientX - this.state.mouseStartX;
        const absDelta = Math.abs(deltaX);

        // Start dragging after threshold is met
        if (!this.state.isMouseDragging && absDelta > this.config.MOUSE_DRAG_START_THRESHOLD) {
            this.state.isMouseDragging = true;
        }

        if (this.state.isMouseDragging && absDelta > this.config.MOUSE_DRAG_THRESHOLD) {
            // Left drag (negative deltaX) = show stats panel
            if (deltaX < -this.config.MOUSE_DRAG_THRESHOLD && !this.state.isStatsVisible) {
                this.state.isStatsVisible = true;
                this._triggerShowStatsPanel();
                this.resetMouseDrag();
            }
            // Right drag (positive deltaX) = show task view
            else if (deltaX > this.config.MOUSE_DRAG_THRESHOLD && this.state.isStatsVisible) {
                this.state.isStatsVisible = false;
                this._triggerShowTaskView();
                this.resetMouseDrag();
            }
        }
    }

    handleMouseUp() {
        this.resetMouseDrag();
    }

    resetMouseDrag() {
        this.state.isMouseDragging = false;
        this.state.mouseStartX = 0;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }

    // ==========================================
    // 🛞 WHEEL EVENT HANDLERS
    // ==========================================

    handleWheel(event) {
        if (this.deps.isOverlayActive()) return;

        // Only handle horizontal scrolling
        if (Math.abs(event.deltaX) < 10) return;

        // Prevent default horizontal scrolling
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            event.preventDefault();
        }

        this.state.wheelDeltaX += event.deltaX;

        // Clear previous timeout
        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
        }

        // Check if we've reached the swipe threshold
        if (this.state.wheelDeltaX > this.config.SWIPE_THRESHOLD) {
            if (!this.state.isStatsVisible) {
                this.state.isStatsVisible = true;
                this._triggerShowStatsPanel();
            }
            this.state.wheelDeltaX = 0;
        } else if (this.state.wheelDeltaX < -this.config.SWIPE_THRESHOLD) {
            if (this.state.isStatsVisible) {
                this.state.isStatsVisible = false;
                this._triggerShowTaskView();
            }
            this.state.wheelDeltaX = 0;
        }

        // Reset wheel tracking after a delay
        this.wheelTimeout = setTimeout(() => {
            this.state.wheelDeltaX = 0;
        }, this.config.WHEEL_RESET_DELAY);
    }

    // ==========================================
    // 👆 POINTER EVENT HANDLERS
    // ==========================================

    handlePointerDown(event) {
        // Only track if it's a touch or pen input
        if (event.pointerType === "touch" || event.pointerType === "pen") {
            if (this.deps.isDraggingNotification()) return;
            if (this.deps.isOverlayActive()) return;

            // Exclude interactive elements (match mouse handler)
            if (
                event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
                ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
            ) {
                return;
            }

            this.state.isPointerSwiping = true;
            this.state.pointerStartX = event.clientX;
        }
    }

    handlePointerMove(event) {
        if (!this.state.isPointerSwiping || event.pointerType === "mouse") return;

        const moveX = event.clientX;
        const difference = this.state.pointerStartX - moveX;

        if (Math.abs(difference) > this.config.TOUCH_SWIPE_THRESHOLD) {
            if (difference > this.config.TOUCH_SWIPE_THRESHOLD && !this.state.isStatsVisible) {
                this.state.isStatsVisible = true;
                this._triggerShowStatsPanel();
                this.state.isPointerSwiping = false;
            } else if (difference < -this.config.TOUCH_SWIPE_THRESHOLD && this.state.isStatsVisible) {
                this.state.isStatsVisible = false;
                this._triggerShowTaskView();
                this.state.isPointerSwiping = false;
            }
        }
    }

    handlePointerUp() {
        this.state.isPointerSwiping = false;
    }

    // ==========================================
    // ⌨️ KEYBOARD EVENT HANDLERS
    // ==========================================

    handleKeydown(event) {
        if (!event.shiftKey) return;

        const showNotification = this.deps.showNotification || (() => {});

        if (event.key === "ArrowRight" && !this.state.isStatsVisible) {
            event.preventDefault();
            this._triggerShowStatsPanel();
            showNotification(`⌨️ ${getLabel('notify.keyboardStatsOpened')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
        } else if (event.key === "ArrowLeft" && this.state.isStatsVisible) {
            event.preventDefault();
            this._triggerShowTaskView();
            showNotification(`⌨️ ${getLabel('notify.keyboardTaskOpened')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
        }

        // Shift+Tab for quick toggle (only when nothing is focused — preserve normal tab navigation)
        if (event.key === "Tab") {
            const activeEl = document.activeElement;
            const hasFocusedElement = activeEl && activeEl !== document.body;
            if (hasFocusedElement || this.deps.isOverlayActive()) return;

            event.preventDefault();
            if (this.state.isStatsVisible) {
                this._triggerShowTaskView();
                showNotification(`⌨️ ${getLabel('notify.quickToggleTask')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            } else {
                this._triggerShowStatsPanel();
                showNotification(`⌨️ ${getLabel('notify.quickToggleStats')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            }
        }
    }

    // ==========================================
    // 🔗 CALLBACKS
    // ==========================================

    /**
     * Trigger show stats panel callback
     * @private
     */
    _triggerShowStatsPanel() {
        this.state.isStatsVisible = true;
        if (typeof this.deps.onShowStatsPanel === 'function') {
            this.deps.onShowStatsPanel();
        }
    }

    /**
     * Trigger show task view callback
     * @private
     */
    _triggerShowTaskView() {
        this.state.isStatsVisible = false;
        if (typeof this.deps.onShowTaskView === 'function') {
            this.deps.onShowTaskView();
        }
    }

    // ==========================================
    // 🛠️ PUBLIC API
    // ==========================================

    /**
     * Sync state with external stats visibility
     * Call this when stats panel visibility changes externally
     * @param {boolean} isVisible - Whether stats panel is visible
     */
    syncStatsVisibility(isVisible) {
        this.state.isStatsVisible = isVisible;
    }

    /**
     * Get current state
     * @returns {Object} Current gesture state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Check if stats panel is visible (from gesture state)
     * @returns {boolean}
     */
    isStatsVisible() {
        return this.state.isStatsVisible;
    }

    /**
     * Cleanup event listeners
     */
    destroy() {

        // Remove event listeners
        document.removeEventListener("touchstart", this.boundHandlers.handleTouchStart);
        document.removeEventListener("touchmove", this.boundHandlers.handleTouchMove);
        document.removeEventListener("touchend", this.boundHandlers.handleTouchEnd);
        document.removeEventListener("wheel", this.boundHandlers.handleWheel);
        document.removeEventListener("mousedown", this.boundHandlers.handleMouseDown);
        document.removeEventListener("mousemove", this.boundHandlers.handleMouseMove);
        document.removeEventListener("mouseup", this.boundHandlers.handleMouseUp);
        document.removeEventListener("pointerdown", this.boundHandlers.handlePointerDown);
        document.removeEventListener("pointermove", this.boundHandlers.handlePointerMove);
        document.removeEventListener("pointerup", this.boundHandlers.handlePointerUp);
        document.removeEventListener("keydown", this.boundHandlers.handleKeydown);

        // Clear timers
        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
            this.wheelTimeout = null;
        }

        this._eventListenersInitialized = false;
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let instance = null;

/**
 * Initialize the gesture panel manager
 * @param {Object} deps - Dependencies
 * @returns {GesturePanelManager}
 */
export function initGesturePanelManager(deps = {}) {
    if (!instance) {
        setGesturePanelManagerDependencies(deps);
        instance = new GesturePanelManager(deps);
        instance.init();
    }
    return instance;
}

/**
 * Get the gesture panel manager instance
 * @returns {GesturePanelManager|null}
 */
export function getGesturePanelManager() {
    return instance;
}

