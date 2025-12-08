/**
 * Task Interactions Module (DI-Pure)
 *
 * Handles keyboard and accessibility interactions for tasks including:
 * - Keyboard navigation for task options
 * - Focus-based visibility toggling
 *
 * @module modules/ui/taskInteractions
 */

import { TaskOptionsVisibilityController } from './taskUI.js';

// Module-level deps for late injection (DI-pure, no window.* fallbacks)
let _deps = {
    safeAddEventListener: null
};

/**
 * Set dependencies for TaskInteractions module
 * @param {Object} dependencies - Injected dependencies
 */
export function setTaskInteractionsDependencies(dependencies) {
    const descriptors = {};
    for (const [key, value] of Object.entries(dependencies)) {
        descriptors[key] = { value, writable: true, configurable: true };
    }
    Object.defineProperties(_deps, descriptors);
    console.log('TaskInteractions dependencies set:', Object.keys(dependencies));
}

/**
 * Accessibility Helper: Toggles visibility of task buttons when task item is focused or blurred.
 *
 * When navigating with the keyboard (e.g., using Tab), this ensures that the task option buttons
 * (edit, delete, reminders, etc.) are shown while the task is focused and hidden when it loses focus.
 *
 * This provides a keyboard-accessible experience similar to mouse hover.
 *
 * @param {HTMLElement} taskItem - The task <li> element to attach listeners to.
 */
export function attachKeyboardTaskOptionToggle(taskItem) {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (typeof safeAddEventListener !== 'function') {
        console.error('attachKeyboardTaskOptionToggle: safeAddEventListener dependency not set');
        return;
    }

    /**
     * Show task buttons only when focus is inside a real action element.
     * Prevent buttons from appearing when clicking the checkbox or task text.
     */
    safeAddEventListener(taskItem, "focusin", (e) => {
        const target = e.target;

        // Skip if focusing on safe elements that shouldn't trigger button reveal
        if (
            target.classList.contains("task-text") ||
            target.type === "checkbox" ||
            target.closest(".focus-safe")
        ) {
            return;
        }

        // Use centralized controller (handles mode checking automatically)
        TaskOptionsVisibilityController.show(taskItem, 'focusin');
    });

    /**
     * Hide task buttons when focus moves outside the entire task
     */
    safeAddEventListener(taskItem, "focusout", (e) => {
        if (taskItem.contains(e.relatedTarget)) return;

        // Use centralized controller (handles mode checking automatically)
        TaskOptionsVisibilityController.hide(taskItem, 'focusout');
    });
}

// DI-pure module (no window.* exports)
console.log('TaskInteractions module loaded (DI-pure, no window.* exports)');
