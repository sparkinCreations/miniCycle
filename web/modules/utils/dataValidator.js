/**
 * 🛡️ Data Validator
 * Validates data at the data layer boundary
 *
 * ✅ FIX #12: Ensures all data is validated before storage,
 * preventing malicious/invalid data from import/export bypass
 *
 * @module utils/dataValidator
 * @pattern Static Utilities (with injected sanitizer)
 */

import { createDIModule, required } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

/**
 * @typedef {Object} DataValidatorDeps
 * @property {Function} sanitizeInput - Function to sanitize user input (required)
 */

const di = createDIModule('DataValidator', {
    sanitizeInput: required()
}, { strict: true }); // Strict mode - throw if sanitizeInput missing

/**
 * Set the sanitize function dependency
 * @param {DataValidatorDeps} dependencies - { sanitizeInput }
 */
export const setDataValidatorDependencies = (dependencies) => di.setDependencies(dependencies);

// ============================================================================
// DATA VALIDATOR CLASS
// ============================================================================

export class DataValidator {
    /**
     * Dangerous keys that could cause prototype pollution
     * @private
     */
    static _DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

    /**
     * Get sanitizeInput from DI container
     * @private
     * @returns {Function}
     */
    static _getSanitizer() {
        const deps = di.resolve();
        if (!deps.sanitizeInput) {
            throw new Error('DataValidator: sanitizeInput not injected. Call setDataValidatorDependencies first.');
        }
        return deps.sanitizeInput;
    }

    /**
     * Fix #7: Check object for prototype pollution keys
     * @private
     * @param {object} obj - Object to check
     * @param {string} path - Current path for error messages
     * @throws {Error} If dangerous keys are found
     */
    static _checkForPrototypePollution(obj, path = 'root') {
        if (typeof obj !== 'object' || obj === null) return;

        for (const key of Object.keys(obj)) {
            if (this._DANGEROUS_KEYS.includes(key)) {
                throw new Error(`Prototype pollution attempt detected: "${key}" at ${path}`);
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                this._checkForPrototypePollution(obj[key], `${path}.${key}`);
            }
        }
    }

    /**
     * Validate and sanitize cycle name
     * @param {string} name - The cycle name to validate
     * @returns {string} Sanitized cycle name
     * @throws {TypeError} If name is not a string
     * @throws {Error} If name is invalid
     */
    static validateCycleName(name) {
        if (typeof name !== 'string') {
            throw new TypeError('Cycle name must be a string');
        }

        if (name.trim().length === 0) {
            throw new Error('Cycle name cannot be empty');
        }

        if (name.length > 100) {
            throw new Error('Cycle name too long (max 100 characters)');
        }

        const sanitized = this._getSanitizer()(name, 100);
        return sanitized;
    }

    /**
     * Validate and sanitize task text
     * @param {string} text - The task text to validate
     * @returns {string} Sanitized task text
     * @throws {TypeError} If text is not a string
     * @throws {Error} If text is invalid
     */
    static validateTaskText(text) {
        if (typeof text !== 'string') {
            throw new TypeError('Task text must be a string');
        }

        if (text.trim().length === 0) {
            throw new Error('Task text cannot be empty');
        }

        if (text.length > 500) {
            throw new Error('Task text too long (max 500 characters)');
        }

        const sanitized = this._getSanitizer()(text, 500);
        return sanitized;
    }

    /**
     * Validate cycle data structure
     * @param {object} cycleData - The cycle data to validate
     * @returns {object} Validated cycle data
     * @throws {TypeError} If cycleData is not an object
     * @throws {Error} If cycleData structure is invalid
     */
    static validateCycleData(cycleData) {
        if (typeof cycleData !== 'object' || cycleData === null) {
            throw new TypeError('Cycle data must be an object');
        }

        // Validate title
        if ('title' in cycleData) {
            cycleData.title = this.validateCycleName(cycleData.title);
        }

        // Validate tasks array
        if ('tasks' in cycleData) {
            if (!Array.isArray(cycleData.tasks)) {
                throw new TypeError('Cycle tasks must be an array');
            }

            // Validate each task
            cycleData.tasks = cycleData.tasks.map(task => this.validateTask(task));
        }

        // Validate boolean fields
        if ('autoReset' in cycleData && typeof cycleData.autoReset !== 'boolean') {
            throw new TypeError('autoReset must be a boolean');
        }

        if ('deleteCheckedTasks' in cycleData && typeof cycleData.deleteCheckedTasks !== 'boolean') {
            throw new TypeError('deleteCheckedTasks must be a boolean');
        }

        // Validate cycle count
        if ('cycleCount' in cycleData) {
            const count = Number(cycleData.cycleCount);
            if (!Number.isFinite(count) || count < 0) {
                throw new Error('Cycle count must be a non-negative number');
            }
            cycleData.cycleCount = Math.floor(count);
        }

        return cycleData;
    }

    /**
     * Validate task object
     * @param {object} task - The task to validate
     * @returns {object} Validated task
     * @throws {TypeError} If task is not an object
     * @throws {Error} If task structure is invalid
     */
    static validateTask(task) {
        if (typeof task !== 'object' || task === null) {
            throw new TypeError('Task must be an object');
        }

        // Validate required fields
        if (!task.id || typeof task.id !== 'string') {
            throw new Error('Task must have a valid string ID');
        }

        if (!('text' in task)) {
            throw new Error('Task must have a text field');
        }

        // Sanitize text
        task.text = this.validateTaskText(task.text);

        // Validate completed
        if ('completed' in task && typeof task.completed !== 'boolean') {
            throw new TypeError('Task completed must be a boolean');
        }

        // Validate highPriority
        if ('highPriority' in task && typeof task.highPriority !== 'boolean') {
            throw new TypeError('Task highPriority must be a boolean');
        }

        // Validate remindersEnabled
        if ('remindersEnabled' in task && typeof task.remindersEnabled !== 'boolean') {
            throw new TypeError('Task remindersEnabled must be a boolean');
        }

        // Validate recurring
        if ('recurring' in task && typeof task.recurring !== 'boolean') {
            throw new TypeError('Task recurring must be a boolean');
        }

        // Validate dueDate (should be an ISO date string like "2024-12-31", or null/empty)
        if ('dueDate' in task) {
            if (task.dueDate === null || task.dueDate === '') {
                task.dueDate = null;
            } else if (typeof task.dueDate === 'string') {
                // Validate ISO date format (YYYY-MM-DD) from HTML date inputs
                const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
                if (!isoDatePattern.test(task.dueDate)) {
                    throw new TypeError('Task dueDate must be an ISO date string (YYYY-MM-DD) or null');
                }
            } else if (typeof task.dueDate === 'number') {
                // Accept legacy number timestamps - convert to ISO string
                const date = new Date(task.dueDate);
                if (isNaN(date.getTime())) {
                    throw new TypeError('Task dueDate timestamp is invalid');
                }
                task.dueDate = date.toISOString().split('T')[0];
            } else {
                throw new TypeError('Task dueDate must be an ISO date string (YYYY-MM-DD), number timestamp, or null');
            }
        }

        return task;
    }

    /**
     * Validate imported data before merging into state
     * @param {object} importedData - The imported data to validate
     * @returns {object} Validated imported data
     * @throws {Error} If data structure is invalid
     */
    static validateImportedData(importedData) {
        if (typeof importedData !== 'object' || importedData === null) {
            throw new TypeError('Imported data must be an object');
        }

        // Fix #7: Check for prototype pollution before processing
        this._checkForPrototypePollution(importedData, 'importedData');

        // Validate schema version
        if (!importedData.schemaVersion) {
            throw new Error('Imported data missing schemaVersion');
        }

        if (importedData.schemaVersion !== '2.5') {
            throw new Error(`Unsupported schema version: ${importedData.schemaVersion}`);
        }

        // Validate data structure
        if (!importedData.data || typeof importedData.data !== 'object') {
            throw new Error('Imported data missing or invalid data field');
        }

        if (!importedData.data.cycles || typeof importedData.data.cycles !== 'object') {
            throw new Error('Imported data missing or invalid cycles field');
        }

        // Validate each cycle
        for (const [cycleId, cycleData] of Object.entries(importedData.data.cycles)) {
            try {
                this.validateCycleData(cycleData);
            } catch (error) {
                throw new Error(`Invalid cycle "${cycleId}": ${error.message}`);
            }
        }

        return importedData;
    }
}

console.log('📦 DataValidator module loaded (using diBase)');
