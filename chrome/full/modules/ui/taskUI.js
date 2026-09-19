/**
 * Task UI Module (DI-Pure)
 *
 * Handles task list UI operations including:
 * - Task list refresh from state
 * - Task options visibility (show/hide on hover/focus)
 * - Complete all button visibility
 *
 * Pattern: Simple Instance ✨
 * - Single responsibility (task UI operations)
 * - Required dependencies via diBase.js
 *
 * @module modules/ui/taskUI
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { getActiveRoutine, getCycleMode, routineHasTasks } from '../utils/cycleMode.js';
// NOTE: taskToAddTaskOptions injected via DI to avoid duplicate module loading

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TaskUI', {
    // For checkCompleteAllButton — the button's visibility and mode are decided
    // from the active routine in state, never from the rendered lists. Required
    // and read unguarded (CLAUDE.md #19): a wiring miss must throw, not hide the
    // button silently. Delivered as a CORE_DEP, so no manifest entry.
    AppState: required(),

    // For refreshTaskListUI
    addTask: optional(null),
    getElementById: optional(null),

    // For touch detection
    isTouchDevice: optional(null),

    // From taskUtils - injected to avoid duplicate module loading
    taskToAddTaskOptions: optional(null),

    // Help window tip for task customizer
    showCustomizerTip: optional(null)
});

// Late-binding deps via Proxy
/** @type {{AppState: Object, addTask: Function|null, getElementById: Function|null, isTouchDevice: Function|null, taskToAddTaskOptions: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskUI module
 * @param {Object} dependencies - Injected dependencies
 */
export function setTaskUIDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * TASK OPTIONS VISIBILITY CONTROLLER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Centralized controller for task options visibility state.
 * Coordinates between multiple interaction modes (hover, three-dots, focus)
 * to prevent race conditions and conflicting behavior.
 *
 * MODES:
 * - HOVER MODE: Options show on mouseenter/focusin, hide on mouseleave/focusout
 * - THREE-DOTS MODE: Options show ONLY on three-dots button click (manual toggle)
 *
 * See: docs/architecture/EVENT_FLOW_PATTERNS.md for complete documentation
 * ═══════════════════════════════════════════════════════════════════
 */
export class TaskOptionsVisibilityController {
    /**
     * Get the current visibility mode
     * @returns {'hover' | 'three-dots'} Current mode
     */
    static getMode() {
        return document.body.classList.contains(DOM_CLASSES.SHOW_THREE_DOTS_ENABLED) ? 'three-dots' : 'hover';
    }

    /**
     * Check if a caller is allowed to change visibility in the current mode
     * @param {string} caller - Identifier for the event handler calling this
     * @returns {boolean} Whether the caller can modify visibility
     */
    static canHandle(caller) {
        const mode = this.getMode();

        // Always allow long-press, regardless of mode
        // This guarantees mobile long-press can reveal options
        // whether three-dots is enabled or not.
        if (caller === 'long-press') {
            return true;
        }

        const permissions = {
            'hover': ['mouseenter', 'mouseleave', 'focusin', 'focusout', 'hideTaskButtons'],
            'three-dots': ['three-dots-button', 'focusout']
        };

        return permissions[mode]?.includes(caller) || false;
    }

    /**
     * Set task options visibility with mode-aware coordination
     * @param {HTMLElement} taskItem - The task element
     * @param {boolean} visible - Desired visibility state
     * @param {string} caller - Identifier for the event handler (for logging/permissions)
     * @returns {boolean} Whether the visibility was changed
     */
    static setVisibility(taskItem, visible, caller = 'unknown') {
        const taskOptions = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
        if (!taskOptions) {
            console.warn(`TaskOptionsVisibilityController: No .task-options found for ${caller}`);
            return false;
        }

        // Check if this caller is allowed to change visibility in current mode
        if (!this.canHandle(caller)) {
            return false;
        }

        // Clear any inline styles so CSS classes take effect
        taskOptions.style.visibility = '';
        taskOptions.style.opacity = '';
        taskOptions.style.pointerEvents = '';

        // Apply visibility state via CSS class toggle
        if (visible) {
            taskOptions.classList.remove(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
            taskOptions.classList.add(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
        } else {
            taskOptions.classList.remove(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
            taskOptions.classList.add(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
        }

        // Sync button tabindex so hidden buttons can't steal keyboard focus
        const buttons = taskOptions.querySelectorAll('button.task-btn');
        buttons.forEach(btn => {
            btn.tabIndex = visible ? 0 : -1;
        });

        return true;
    }

    /**
     * Show task options (convenience method)
     * @param {HTMLElement} taskItem - The task element
     * @param {string} caller - Identifier for the event handler
     * @returns {boolean} Whether the visibility was changed
     */
    static show(taskItem, caller) {
        return this.setVisibility(taskItem, true, caller);
    }

    /**
     * Hide task options (convenience method)
     * @param {HTMLElement} taskItem - The task element
     * @param {string} caller - Identifier for the event handler
     * @returns {boolean} Whether the visibility was changed
     */
    static hide(taskItem, caller) {
        return this.setVisibility(taskItem, false, caller);
    }
}

/**
 * Refreshes the task list UI from state.
 * Clears and re-renders all tasks from the active routine.
 */
export async function refreshTaskListUI() {

    const AppState = _deps.AppState;
    if (!AppState.isReady()) {
        console.error('State data required for refreshTaskListUI');
        throw new Error('State data not found');
    }

    const cycleData = getActiveRoutine(AppState.get());

    if (!cycleData) {
        console.warn("No active cycle found for UI refresh");
        return;
    }

    // Clear current list
    const getElementById = _deps.getElementById || ((id) => document.getElementById(id));
    const taskListContainer = getElementById(DOM_IDS.TASK_LIST);
    if (!taskListContainer) return;
    taskListContainer.innerHTML = "";

    // Re-render each task from state (await each to ensure proper settings are loaded)
    const addTask = _deps.addTask;
    if (typeof addTask !== 'function') {
        console.error('refreshTaskListUI: addTask dependency not set');
        return;
    }

    const tasks = cycleData.tasks || [];
    const taskToAddTaskOptions = _deps.taskToAddTaskOptions;
    if (typeof taskToAddTaskOptions !== 'function') {
        console.error('refreshTaskListUI: taskToAddTaskOptions not available - aborting to prevent task duplication');
        return;
    }
    for (const task of tasks) {
        const options = taskToAddTaskOptions(task);
        await addTask(task.text, options);
    }

    // NOTE: an updateRecurringButtonVisibility call used to sit here, but the dep
    // was resolvable nowhere (no manifest/depMappings route) so it never ran —
    // verified harmless (drift-review C-24): recurring visibility is refreshed by
    // recurringIntegration and modeManager on their own events.
}

/**
 * Hides task buttons with mode-aware coordination.
 * Used by hideTaskOptions and dragDropManager.
 * @param {HTMLElement} taskItem - The task element
 */
export function hideTaskButtons(taskItem) {
    if (taskItem.classList.contains(DOM_CLASSES.REARRANGING)) {
        return;
    }

    // Don't hide if task is long-pressed (mobile long-press in progress)
    if (taskItem.classList.contains(DOM_CLASSES.LONG_PRESSED)) {
        return;
    }

    // Use centralized controller instead of direct manipulation
    // Controller will check permissions and skip if not allowed in current mode
    // In three-dots mode: hideTaskButtons is NOT in the permissions list,
    // so it won't be able to override the three-dots button's visibility control
    const wasHidden = TaskOptionsVisibilityController.hide(taskItem, 'hideTaskButtons');

    if (!wasHidden) {
        return;
    }

    // Clear individual button inline styles if we successfully hid
    const taskOptions = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
    if (taskOptions) {
        const threeDotsEnabled = document.body.classList.contains(DOM_CLASSES.SHOW_THREE_DOTS_ENABLED);

        if (threeDotsEnabled) {
            // Three-dots mode: use inline styles to explicitly hide individual buttons
            taskItem.querySelectorAll(DOM_SELECTORS.TASK_BTN).forEach(btn => {
                btn.style.visibility = "hidden";
                btn.style.opacity = "0";
                btn.style.pointerEvents = "none";
            });
        } else {
            // Regular hover mode: clear inline styles to let CSS handle it
            taskItem.querySelectorAll(DOM_SELECTORS.TASK_BTN).forEach(btn => {
                btn.style.visibility = "";
                btn.style.opacity = "";
                btn.style.pointerEvents = "";
            });
        }
    }
}

/**
 * Pending hover-intent listeners, keyed by task row.
 *
 * WeakMap so a row removed from the DOM takes its entry with it — task rows are
 * created and destroyed constantly, and this is the pattern EVENT_LISTENER_GUIDE
 * prescribes for exactly that case.
 * @type {WeakMap<HTMLElement, Function>}
 */
const _hoverIntentHandlers = new WeakMap();

/**
 * Stop waiting for movement evidence on a row. Safe to call when nothing is armed.
 * @param {HTMLElement} taskElement
 * @returns {void}
 */
function disarmHoverIntent(taskElement) {
    const handler = _hoverIntentHandlers.get(taskElement);
    if (!handler) return;
    taskElement.removeEventListener('mousemove', handler);
    _hoverIntentHandlers.delete(taskElement);
}

/**
 * Wait for the pointer to actually move inside this row before treating the
 * mouseenter as a hover.
 *
 * `mouseenter` does not mean "the user pointed at this". The browser also fires
 * it — genuinely, isTrusted and all — when an element MOVES UNDER a stationary
 * pointer, which any task-list re-render can do: switching modes redraws the
 * list, a row slides under the parked cursor, and the app used to open that
 * row's option buttons and spend the once-per-reload customizer tip on a hover
 * that never happened.
 *
 * The discriminator is the event that follows, not the enter itself. Measured
 * both cases: a real hover fires `mouseenter` and then a `mousemove` inside the
 * row (the pointer is in motion, so the very next motion sample lands there);
 * a re-render fires `mouseenter` alone and nothing after it. movementX/movementY
 * are 0 in BOTH cases, so they cannot be used, and no elapsed-time threshold is
 * needed either — waiting for the move is exact.
 *
 * `once: true` removes the listener when it fires; mouseleave and re-arming
 * disarm it otherwise; the WeakMap entry dies with the row.
 * @param {HTMLElement} taskElement
 * @returns {void}
 */
function armHoverIntent(taskElement) {
    disarmHoverIntent(taskElement);
    const handler = () => {
        _hoverIntentHandlers.delete(taskElement);
        revealTaskOptionsForHover(taskElement);
    };
    _hoverIntentHandlers.set(taskElement, handler);
    taskElement.addEventListener('mousemove', handler, { once: true, passive: true });
}

/**
 * Open a row's options because the user really is pointing at it.
 * @param {HTMLElement} taskElement
 * @returns {void}
 */
function revealTaskOptionsForHover(taskElement) {
    // Use centralized controller (handles mode checking automatically)
    TaskOptionsVisibilityController.show(taskElement, 'mouseenter');

    // Show customizer tip on first hover (desktop only, once per reload)
    _deps.showCustomizerTip?.('hover');
}

/**
 * Shows task options on mouse enter (hover handler).
 * Only shows on desktop or if long-pressed on mobile.
 * @param {Event} event - The mouseenter event
 */
export function showTaskOptions(event) {
    const taskElement = event.currentTarget;

    // Only allow on desktop or if long-pressed on mobile
    const isTouchDevice = _deps.isTouchDevice;
    const isMobile = typeof isTouchDevice === 'function' ? isTouchDevice() : false;
    const longPressed = taskElement.classList.contains(DOM_CLASSES.LONG_PRESSED);
    const allowShow = !isMobile || longPressed;

    if (!allowShow) return;

    // A long-press is a deliberate gesture the user already completed, and the
    // emulated mouse events touch produces carry no mousemove to wait for.
    // Gating it on movement would break task options on touch entirely.
    if (longPressed) {
        revealTaskOptionsForHover(taskElement);
        return;
    }

    armHoverIntent(taskElement);
}

/**
 * Hides task options on mouse leave (hover handler).
 * Only hides if not long-pressed on mobile.
 * @param {Event} event - The mouseleave event
 */
export function hideTaskOptions(event) {
    const taskElement = event.currentTarget;

    // Only hide if not long-pressed on mobile (so buttons stay open during drag)
    const isTouchDevice = _deps.isTouchDevice;
    const isMobile = typeof isTouchDevice === 'function' ? isTouchDevice() : false;
    const allowHide = !isMobile || !taskElement.classList.contains(DOM_CLASSES.LONG_PRESSED);

    // Always drop a pending hover-intent arm, even when the hide itself is
    // suppressed for a long-press: the pointer has left, so a later mousemove
    // inside this row can only come from the row moving again.
    disarmHoverIntent(taskElement);

    if (allowHide) {
        // Use centralized controller (handles mode checking automatically)
        TaskOptionsVisibilityController.hide(taskElement, 'mouseleave');
    }
}

/**
 * Checks if the complete all button should be visible.
 * Shows when the active routine has tasks and is not in auto cycle mode.
 * Updates button text and color based on mode (To-Do vs Cycle).
 *
 * Decided from STATE, not the rendered lists. It used to count
 * `#taskList.children`, and with the completed dropdown on, every finished row
 * moves out of `#taskList` — so a manual-cycle routine whose tasks were all done
 * lost its Complete Cycle button on the next boot render (reproduced Sep 2026),
 * the one button that finishes the cycle. The mode comes from the same routine
 * (`getCycleMode`), which is what modeManager derives the body classes from.
 */
export function checkCompleteAllButton() {
    // getCompleteAllButton was a dead DI dep (resolvable nowhere — the DOM
    // fallback always ran). Use the CORE_DEP DOM helper directly instead.
    const completeAllButton = typeof _deps.getElementById === 'function'
        ? _deps.getElementById(DOM_IDS.COMPLETE_ALL)
        : document.getElementById(DOM_IDS.COMPLETE_ALL);

    if (!completeAllButton) {
        // Element should exist after DOMContentLoaded - warn if missing
        console.warn('checkCompleteAllButton: #' + DOM_IDS.COMPLETE_ALL + ' not found');
        return;
    }

    // No routine yet (first run, mid-boot, after a factory reset) reads as no tasks.
    const routine = getActiveRoutine(_deps.AppState.get());
    const mode = getCycleMode(routine);
    const isAutoMode = mode === 'auto';
    const isToDoMode = mode === 'todo';
    const taskView = document.getElementById(DOM_IDS.TASK_VIEW);

    // Update button text and styling based on mode
    if (isToDoMode) {
        completeAllButton.textContent = '🧹 ' + getLabel('action.clearCompletedTasks');
        completeAllButton.classList.add(DOM_CLASSES.TODO_MODE_BTN);
        completeAllButton.classList.remove(DOM_CLASSES.CYCLE_MODE_BTN);
    } else {
        completeAllButton.textContent = '🔄 ' + getLabel('action.completeCycle');
        completeAllButton.classList.add(DOM_CLASSES.CYCLE_MODE_BTN);
        completeAllButton.classList.remove(DOM_CLASSES.TODO_MODE_BTN);
    }

    if (routineHasTasks(routine) && !isAutoMode) {
        completeAllButton.style.display = "block";
        taskView?.classList.add(DOM_CLASSES.COMPLETE_BTN_VISIBLE);
    } else {
        completeAllButton.style.display = "none";
        taskView?.classList.remove(DOM_CLASSES.COMPLETE_BTN_VISIBLE);
    }
}

// DI-pure module (no window.* exports)
