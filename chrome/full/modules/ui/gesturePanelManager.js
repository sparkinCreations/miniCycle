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
    // Indexed navigation (panel carousel) — returns {id,index} on move, null on
    // clamp, undefined when the carousel isn't available (→ legacy fallback).
    onNavigate: optional(null),
    // Legacy binary callbacks — fallback path when onNavigate is unwired/dead
    onShowStatsPanel: optional(null),
    onShowTaskView: optional(null)
});

// Keyboard-shortcut toast labels per landed panel (arrow keys / quick toggle).
// Panels without an entry (future panels) simply don't toast.
const ARROW_TOAST_BY_PANEL = {
    'stats-panel': 'notify.keyboardStatsOpened',
    'task-view': 'notify.keyboardTaskOpened',
    'focus-task-panel': 'notify.keyboardFocusTaskOpened'
};
const QUICK_TOGGLE_TOAST_BY_PANEL = {
    'stats-panel': 'notify.quickToggleStats',
    'task-view': 'notify.quickToggleTask',
    'focus-task-panel': 'notify.quickToggleFocusTask'
};

/**
 * Inject dependencies for the gesture panel manager module.
 * @param {Object} deps - Dependencies including AppState, getElementById, etc.
 * @returns {void}
 */
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
            startY: 0,
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
            MOUSE_DRAG_START_THRESHOLD: GESTURE.MOUSE_DRAG_START,
            WHEEL_SCROLL_MIN: GESTURE.WHEEL_SCROLL_MIN,
            AXIS_DOMINANCE_RATIO: GESTURE.AXIS_DOMINANCE_RATIO
        };

        // Timers
        this.wheelTimeout = null;

        // Event handler bindings (for proper removal)
        this.boundHandlers = {};

        // Initialization flag
        this._eventListenersInitialized = false;

        // One-shot guard so the dead-onNavigate warning doesn't spam every swipe
        this._warnedDeadNavigate = false;

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
        this.state.startY = event.touches[0].clientY;
        this.state.isSwiping = true;
    }

    handleTouchMove(event) {
        if (!this.state.isSwiping || this.deps.isDraggingNotification()) return;
        if (this.deps.isOverlayActive()) return;

        const moveX = event.touches[0].clientX;
        const difference = this.state.startX - moveX;

        // Require horizontal intent before consuming the gesture. Scrolling a
        // long task list arcs the thumb sideways; without this, that drift hit
        // TOUCH_SWIPE (50px) and flipped panels mid-scroll. Same rule the focus
        // task panel applies on its axis.
        const verticalDrift = Math.abs(event.touches[0].clientY - this.state.startY);
        if (Math.abs(difference) < verticalDrift * this.config.AXIS_DOMINANCE_RATIO) return;

        // Left swipe = next panel, right swipe = previous. The gesture is only
        // consumed when a move actually happened — a clamped swipe at either
        // end keeps tracking, so reversing direction mid-gesture still works
        // (matches the old guarded-binary behavior).
        if (difference > this.config.TOUCH_SWIPE_THRESHOLD) {
            if (this._navigate(1)) this.state.isSwiping = false;
        } else if (difference < -this.config.TOUCH_SWIPE_THRESHOLD) {
            if (this._navigate(-1)) this.state.isSwiping = false;
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
            // Left drag (negative deltaX) = next panel
            if (deltaX < -this.config.MOUSE_DRAG_THRESHOLD) {
                if (this._navigate(1)) this.resetMouseDrag();
            }
            // Right drag (positive deltaX) = previous panel
            else if (deltaX > this.config.MOUSE_DRAG_THRESHOLD) {
                if (this._navigate(-1)) this.resetMouseDrag();
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
        if (Math.abs(event.deltaX) < this.config.WHEEL_SCROLL_MIN) return;

        // Horizontal intent gates BOTH preventDefault and accumulation — when
        // it only gated preventDefault, sideways drift during a vertical
        // trackpad scroll still crept toward the threshold.
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();

        this.state.wheelDeltaX += event.deltaX;

        // Clear previous timeout
        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
        }

        // Check if we've reached the swipe threshold
        // (wheel accumulation resets at the threshold whether or not the
        // carousel moved — same as the old guarded behavior)
        if (this.state.wheelDeltaX > this.config.SWIPE_THRESHOLD) {
            this._navigate(1);
            this.state.wheelDeltaX = 0;
        } else if (this.state.wheelDeltaX < -this.config.SWIPE_THRESHOLD) {
            this._navigate(-1);
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
        // Pen ONLY. Touch is served by the touchstart/move/end handlers and mouse
        // by the mousedown/move/up handlers — a touch device dispatches BOTH the
        // touch and pointer streams for one finger swipe, so handling "touch" here
        // too made every swipe call _navigate() twice, stepping two panels at once
        // (e.g. from the Task panel a left-swipe landed on Stats, skipping Routine).
        // Restricting the pointer path to pen keeps each input type on exactly one
        // handler and eliminates the double-navigate.
        if (event.pointerType === "pen") {
            if (this.deps.isDraggingNotification()) return;
            if (this.deps.isOverlayActive()) return;

            // Exclude interactive elements (match mouse handler)
            if (
                event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
                ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
            ) {
                return;
            }

            // A pen also emits a COMPATIBILITY MOUSE stream (mousedown/move/up),
            // which handleMouse* would process — navigating a second time for one
            // pen swipe. Canceling the primary pointerdown sets the browser's
            // "prevent mouse event" flag (Pointer Events spec), suppressing that
            // compat stream so a pen swipe navigates exactly once.
            if (event.isPrimary && event.cancelable) {
                event.preventDefault();
            }

            this.state.isPointerSwiping = true;
            this.state.pointerStartX = event.clientX;
        }
    }

    handlePointerMove(event) {
        // Pen only (see handlePointerDown) — isPointerSwiping is set exclusively
        // for pen, and this guard keeps a stray touch/mouse pointermove out.
        if (!this.state.isPointerSwiping || event.pointerType !== "pen") return;

        const moveX = event.clientX;
        const difference = this.state.pointerStartX - moveX;

        if (Math.abs(difference) > this.config.TOUCH_SWIPE_THRESHOLD) {
            if (difference > this.config.TOUCH_SWIPE_THRESHOLD) {
                if (this._navigate(1)) this.state.isPointerSwiping = false;
            } else if (difference < -this.config.TOUCH_SWIPE_THRESHOLD) {
                if (this._navigate(-1)) this.state.isPointerSwiping = false;
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

        // Overlay guard, hoisted: every other handler opens with this, and the
        // Shift+Tab branch below already had it — the arrow branches did not,
        // so Shift+Arrow navigated panels behind an open modal.
        if (this.deps.isOverlayActive()) return;

        // Shift+Arrow is the standard text-selection shortcut — never steal it
        // from an editable field. Mirrors the exclusion the touch/mouse/pointer
        // handlers already carry; keyboard was the only path missing it, and
        // the one where typing in a field is the normal case.
        const target = event.target;
        if (
            target?.closest?.("input, textarea, select, [contenteditable]") ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)
        ) {
            return;
        }

        const showNotification = this.deps.showNotification || (() => {});

        if (event.key === "ArrowRight") {
            const result = this._navigate(1);
            if (result) {
                event.preventDefault();
                const labelKey = ARROW_TOAST_BY_PANEL[result.id];
                if (labelKey) showNotification(`⌨️ ${getLabel(labelKey)}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            }
        } else if (event.key === "ArrowLeft") {
            const result = this._navigate(-1);
            if (result) {
                event.preventDefault();
                const labelKey = ARROW_TOAST_BY_PANEL[result.id];
                if (labelKey) showNotification(`⌨️ ${getLabel(labelKey)}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            }
        }

        // Shift+Tab for quick toggle (only when nothing is focused — preserve normal tab navigation)
        if (event.key === "Tab") {
            const activeEl = document.activeElement;
            const hasFocusedElement = activeEl && activeEl !== document.body;
            if (hasFocusedElement || this.deps.isOverlayActive()) return;

            event.preventDefault();
            // Next panel, or step back when clamped at the end — with two
            // panels this is exactly the historical toggle. (If a true wrap is
            // wanted once a third panel exists, route this through the
            // carousel's cycleNext() instead — see Phase 2 of the plan.)
            const result = this._navigate(1) || this._navigate(-1);
            if (result) {
                const labelKey = QUICK_TOGGLE_TOAST_BY_PANEL[result.id];
                if (labelKey) showNotification(`⌨️ ${getLabel(labelKey)}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            }
        }
    }

    // ==========================================
    // 🔗 CALLBACKS
    // ==========================================

    /**
     * Navigate the panel carousel by direction (+1 next / -1 previous).
     * Every input modality reduces to this. Returns the landed panel
     * ({id, index}) or null when nothing moved (clamped at an end).
     *
     * Fallback discipline: onNavigate is a depMappings closure, which is
     * TRUTHY even when its inner path is dead (July 2026 audit, truthy-closure
     * trap). The carousel contract is "null = clamped, undefined = not
     * available" — so an undefined result falls back to the legacy binary
     * path, keeping gestures alive even if the carousel wiring breaks.
     * @param {number} direction
     * @returns {{id:string, index:number}|null}
     * @private
     */
    _navigate(direction) {
        if (typeof this.deps.onNavigate === 'function') {
            const result = this.deps.onNavigate(direction);
            if (result !== undefined) {
                if (result) {
                    this.state.isStatsVisible = result.id === 'stats-panel';
                }
                return result;
            }
            // Wired but not answering — the truthy-closure trap above. Falling
            // back is correct, but this state is NOT normal: it silently
            // demotes a 3-panel carousel to 2-panel behavior, which is exactly
            // how the v2.388 regression (statsPanel never forwarded
            // navigatePanels) survived. Warn once so the next one is visible.
            if (!this._warnedDeadNavigate) {
                this._warnedDeadNavigate = true;
                console.warn('⚠️ gesturePanelManager: onNavigate is wired but returned undefined — carousel unavailable, using legacy 2-panel fallback.');
            }
        }

        // Legacy binary fallback — identical to the pre-carousel behavior
        if (direction > 0 && !this.state.isStatsVisible) {
            this._triggerShowStatsPanel();
            return { id: 'stats-panel', index: 1 };
        }
        if (direction < 0 && this.state.isStatsVisible) {
            this._triggerShowTaskView();
            return { id: 'task-view', index: 0 };
        }
        return null;
    }

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
     * @returns {void}
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
 * @param {Object} [deps={}] - Dependencies
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

