/**
 * 🛡️ Data Validator
 * Validates data at the data layer boundary
 *
 * ✅ FIX #12: Ensures all data is validated before storage,
 * preventing malicious/invalid data from import/export bypass
 *
 * @module utils/dataValidator
 * @version 1.395
 * @pattern Static Utilities (with injected sanitizer)
 */

// Module-level dependency - must be set before use
let _sanitizeInput = null;

/**
 * Set the sanitize function dependency
 * @param {Function} sanitizeFn - The sanitize function to use
 */
export function setDataValidatorDependencies({ sanitizeInput }) {
    if (typeof sanitizeInput !== 'function') {
        throw new Error('DataValidator requires sanitizeInput function');
    }
    _sanitizeInput = sanitizeInput;
    console.log('🛡️ DataValidator dependencies injected');
}

export class DataValidator {
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

        // Use injected sanitizeInput
        if (!_sanitizeInput) {
            throw new Error('DataValidator: sanitizeInput not injected. Call setDataValidatorDependencies first.');
        }
        const sanitized = _sanitizeInput(name, 100);

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

        // Use injected sanitizeInput
        if (!_sanitizeInput) {
            throw new Error('DataValidator: sanitizeInput not injected. Call setDataValidatorDependencies first.');
        }
        const sanitized = _sanitizeInput(text, 500);

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

        // Validate dueDate (should be a number timestamp or null)
        if ('dueDate' in task && task.dueDate !== null) {
            const dueDate = Number(task.dueDate);
            if (!Number.isFinite(dueDate)) {
                throw new TypeError('Task dueDate must be a number timestamp or null');
            }
            task.dueDate = dueDate;
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

// Phase 2 Step 5 - Clean exports (no window.* pollution)
console.log('🛡️ DataValidator module loaded (Phase 2 - no window.* exports)');
