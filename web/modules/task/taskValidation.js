/**
 * miniCycle Task Validation Module
 *
 * Validates and sanitizes task input for security and data integrity.
 * Ensures task text meets length requirements and is properly sanitized.
 *
 * Features:
 * - Input sanitization via injected sanitizeInput function
 * - Character limit enforcement (100 chars)
 * - Empty/invalid input handling
 * - User notification for validation failures
 *
 * @module task/taskValidation
 * @version 1.0.0
 * @see {@link module:task/taskDOM} - Uses this for task creation
 * @see {@link module:core/globalUtils} - Provides sanitizeInput
 */

import { createDIModule, optional } from '../core/diBase.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================
// NOTE: No appContext fallback - all dependencies must come through DI
// This avoids versioned/unversioned module instance mismatch issues

const di = createDIModule('TaskValidation', {
    sanitizeInput: optional(null),
    showNotification: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
/** @type {{sanitizeInput: Function|null, showNotification: Function|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskValidator (call before initTaskValidator)
 * @param {Object} dependencies - { sanitizeInput, showNotification }
 */
export function setTaskValidationDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Validates and sanitizes task input text before creation or update
 */
export class TaskValidator {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Require sanitizeInput - no fallback to window
        if (typeof resolvedDeps.sanitizeInput !== 'function') {
            throw new Error('TaskValidator requires sanitizeInput function');
        }

        // Store dependencies - showNotification is optional
        this.deps = {
            sanitizeInput: resolvedDeps.sanitizeInput,
            showNotification: resolvedDeps.showNotification || (() => {})
        };

        // Constants
        this.TASK_LIMIT = 100; // Character limit for tasks

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;

    }

    /**
     * Validate and sanitize task input text
     * @param {string} taskText - Raw task input
     * @returns {string|null} - Sanitized text or null if invalid
     */
    validateAndSanitizeTaskInput(taskText) {
        // Type check
        if (typeof taskText !== "string") {
            console.warn("⚠️ taskText is not a string", taskText);
            return null;
        }

        // Use sanitizeInput function
        const sanitizeFn = this.deps.sanitizeInput;
        if (!sanitizeFn) {
            console.warn("⚠️ sanitizeInput function not available");
            return null;
        }

        // Sanitize and trim
        const taskTextTrimmed = sanitizeFn(taskText.trim());
        if (!taskTextTrimmed) {
            console.warn("⚠️ Skipping empty or unsafe task.");
            return null;
        }

        // Character limit check
        if (taskTextTrimmed.length > this.TASK_LIMIT) {
            this.deps.showNotification?.(getLabel('notify.taskCharLimit', { vars: { limit: this.TASK_LIMIT } }), 'warning');
            return null;
        }

        return taskTextTrimmed;
    }
}

// ============================================
// Global Instance Management
// ============================================

let taskValidator = null;

/**
 * Initialize the global task validator
 * @param {Object} dependencies - Required dependencies
 */
export async function initTaskValidator(dependencies = {}) {
    if (taskValidator) {
        console.warn('⚠️ TaskValidator already initialized');
        return taskValidator;
    }

    taskValidator = new TaskValidator(dependencies);
    return taskValidator;
}

// ============================================
// Wrapper Function
// ============================================

/**
 * Validate and sanitize task input (global wrapper)
 * @param {string} taskText - Raw task input
 * @returns {string|null} - Sanitized text or null if invalid
 */
function validateAndSanitizeTaskInput(taskText) {
    if (!taskValidator) {
        console.warn('⚠️ TaskValidator not initialized - using fallback');
        // Fallback: normalize only (trim). Do NOT HTML-escape here — task text is
        // rendered via textContent, so escaping at input would double-encode it
        // (store literal &lt; / &amp;). XSS safety lives at the render sink. The old
        // "Fix #43" escaped here, which corrupted task text with entities in this
        // rare uninitialized-validator path. See the input-normalizer audit
        // (SECURITY.md v2.336).
        if (typeof taskText !== 'string' || !taskText.trim()) return null;
        return taskText.trim();
    }
    return taskValidator.validateAndSanitizeTaskInput(taskText);
}

// ============================================
// Exports
// ============================================

// ES6 exports
export { validateAndSanitizeTaskInput };

// Phase 2 Step 6 - Clean exports (no window.* pollution)
