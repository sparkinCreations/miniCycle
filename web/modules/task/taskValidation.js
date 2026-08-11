/**
 * miniCycle Task Validation Module
 *
 * Validates and sanitizes task input for security and data integrity.
 * Ensures task text meets length requirements and is properly sanitized.
 *
 * Features:
 * - Input sanitization via injected sanitizeInput function
 * - Character limit enforcement (LIMITS.TASK_CHARACTER_INPUT)
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
import { LIMITS } from '../core/constants.js';

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

        // Character limit for text typed into the UI. Named TASK_CHAR_LIMIT, not
        // TASK_LIMIT: coreBoot has its own TASK_LIMIT meaning tasks-PER-CYCLE
        // (LIMITS.TASKS_PER_CYCLE, 150), and one name for two unrelated limits
        // is how the 100-vs-500 divergence went unnoticed. See
        // LIMITS.TASK_CHARACTER_INPUT for why this is below the storage ceiling.
        this.TASK_CHAR_LIMIT = LIMITS.TASK_CHARACTER_INPUT;

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
        if (taskTextTrimmed.length > this.TASK_CHAR_LIMIT) {
            this.deps.showNotification?.(getLabel('notify.taskCharLimit', { vars: { limit: this.TASK_CHAR_LIMIT } }), 'warning');
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
        // Apply the guarantees that DON'T need an injected dependency. This
        // fallback previously returned the bare trim, dropping both
        // sanitizeInput and the character limit — so during the uninitialized
        // window, unbounded text containing control characters could enter
        // state. This is the only route by which unvalidated task text reaches
        // storage, so clamp rather than pass through. Text is preserved (not
        // rejected) because dropping user input silently is the worse failure.
        // eslint-disable-next-line no-control-regex -- stripping control chars is the point
        const stripped = taskText.replace(/[\u0000-\u001F\u007F]/g, '').trim();
        if (!stripped) return null;
        return stripped.slice(0, LIMITS.TASK_CHARACTER_INPUT);
    }
    return taskValidator.validateAndSanitizeTaskInput(taskText);
}

// ============================================
// Exports
// ============================================

// ES6 exports
export { validateAndSanitizeTaskInput };

// Phase 2 Step 6 - Clean exports (no window.* pollution)
