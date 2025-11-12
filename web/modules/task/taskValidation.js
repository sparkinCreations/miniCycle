/**
 * 🔒 miniCycle Task Validation
 * Validates and sanitizes task input for security and data integrity
 *
 * Pattern: Simple Instance ✨
 * - Single responsibility (validation only)
 * - Minimal dependencies (sanitizeInput, showNotification)
 * - Pure input validation logic
 *
 * @module modules/task/taskValidation
 * @version 1.350
 */

export class TaskValidator {
    constructor(dependencies = {}) {
        // Store dependencies with fallbacks
        this.deps = {
            sanitizeInput: dependencies.sanitizeInput || window.sanitizeInput,
            showNotification: dependencies.showNotification || ((msg) => console.log(msg))
        };

        // Constants
        this.TASK_LIMIT = 100; // Character limit for tasks

        // Instance version
        this.version = '1.350';

        console.log('🔒 TaskValidator created');
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
            this.deps.showNotification?.(`Task must be ${this.TASK_LIMIT} characters or less.`, 'warning');
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
export function initTaskValidator(dependencies = {}) {
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
        // Fallback validation
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

// Window exports (CRITICAL for ES6 module scope)
window.TaskValidator = TaskValidator;
window.initTaskValidator = initTaskValidator;
window.validateAndSanitizeTaskInput = validateAndSanitizeTaskInput;

console.log('🔒 TaskValidation module loaded and ready');
