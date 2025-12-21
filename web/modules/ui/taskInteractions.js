/**
 * Task Interactions Module (DI-Pure)
 *
 * Handles keyboard and accessibility interactions for tasks including:
 * - Keyboard navigation for task options
 * - Focus-based visibility toggling
 *
 * Pattern: Simple Instance ✨
 * - Single responsibility (keyboard/focus interactions)
 * - Required dependencies via diBase.js
 *
 * @module modules/ui/taskInteractions
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// TASKUI DYNAMIC IMPORT (avoids duplicate loading with versioned imports)
// ============================================================================
let TaskOptionsVisibilityController = null;

async function loadTaskUI() {
    if (!TaskOptionsVisibilityController) {
        const version = typeof window !== 'undefined' ? (window.APP_VERSION || '1.508') : '1.508';
        const taskUIModule = await import(`./taskUI.js?v=${version}`);
        TaskOptionsVisibilityController = taskUIModule.TaskOptionsVisibilityController;
    }
    return TaskOptionsVisibilityController;
}

// Load early (non-blocking)
loadTaskUI().catch(e => console.warn('⚠️ taskInteractions: Failed to load taskUI:', e));

/**
 * Ensure TaskUI is loaded (for tests and initialization)
 * @returns {Promise<typeof TaskOptionsVisibilityController>}
 */
export { loadTaskUI as ensureTaskUILoaded };

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TaskInteractions', {
    safeAddEventListener: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskInteractions module
 * @param {Object} dependencies - Injected dependencies
 */
export function setTaskInteractionsDependencies(dependencies) {
    di.setDependencies(dependencies);
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
        if (TaskOptionsVisibilityController) {
            TaskOptionsVisibilityController.show(taskItem, 'focusin');
        }
    });

    /**
     * Hide task buttons when focus moves outside the entire task
     */
    safeAddEventListener(taskItem, "focusout", (e) => {
        if (taskItem.contains(e.relatedTarget)) return;

        // Use centralized controller (handles mode checking automatically)
        if (TaskOptionsVisibilityController) {
            TaskOptionsVisibilityController.hide(taskItem, 'focusout');
        }
    });
}

// DI-pure module (no window.* exports)
console.log('TaskInteractions module loaded (DI-pure, no window.* exports)');
