/**
 * Data Sanitizer Module (DI-Pure)
 * Provides XSS protection for imported data
 *
 * NO window.* globals - all dependencies must be injected
 *
 * @module utils/dataSanitizer
 */

import { createDIModule, required } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('DataSanitizer', {
    sanitizeInput: required()  // Required - no fallbacks
});

/** @type {{sanitizeInput: Function}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setDataSanitizerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('DataSanitizer dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Validate that a date string is a safe ISO date format (YYYY-MM-DD) or null
 * Prevents injection via malformed date strings
 * @param {*} dateValue - Value to validate
 * @returns {string|null} Valid date string or null
 */
function validateDateString(dateValue) {
    if (dateValue === null || dateValue === undefined) return null;
    if (typeof dateValue !== 'string') return null;
    // Only allow ISO date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(dateValue)) return null;
    // Verify it's actually a valid date
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return null;
    return dateValue;
}

/**
 * Sanitize text content to prevent XSS
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized text
 */
export function sanitizeText(text, maxLength = 500) {
    const sanitizeInput = _deps.sanitizeInput;

    if (typeof sanitizeInput !== 'function') {
        console.error('DataSanitizer: sanitizeInput dependency not injected');
        throw new Error('sanitizeInput dependency required');
    }

    return sanitizeInput(text, maxLength);
}

/**
 * Sanitize all user-generated content in imported backup data
 * Security fix: Prevent XSS attacks via malicious .mcyc files
 * @param {Object} backupData - The parsed backup data object
 * @returns {Object} Sanitized backup data
 */
export function sanitizeImportedData(backupData) {
    console.log('Sanitizing imported data for XSS protection...');

    // Sanitize Schema 2.5 format
    if (backupData.schemaVersion === '2.5' && backupData.miniCycleData) {
        try {
            const data = JSON.parse(backupData.miniCycleData);

            if (data.cycles && typeof data.cycles === 'object') {
                Object.values(data.cycles).forEach(cycle => {
                    if (!cycle || typeof cycle !== 'object') return;

                    // Sanitize cycle title and name
                    if (cycle.title) {
                        cycle.title = sanitizeText(cycle.title, 100);
                    }
                    if (cycle.name) {
                        cycle.name = sanitizeText(cycle.name, 100);
                    }

                    // Sanitize all task text and related fields
                    if (Array.isArray(cycle.tasks)) {
                        cycle.tasks.forEach(task => {
                            if (task && typeof task === 'object') {
                                if (task.text) {
                                    task.text = sanitizeText(task.text, 500);
                                }
                                // Validate due date format
                                if (task.dueDate !== undefined) {
                                    task.dueDate = validateDateString(task.dueDate);
                                }
                                // Sanitize recurring task template text if present
                                if (task.recurringTemplate?.text) {
                                    task.recurringTemplate.text = sanitizeText(task.recurringTemplate.text, 500);
                                }
                            }
                        });
                    }

                    // Sanitize cycle-level recurring templates
                    if (cycle.recurringTemplates && typeof cycle.recurringTemplates === 'object') {
                        Object.values(cycle.recurringTemplates).forEach(template => {
                            if (template && typeof template === 'object') {
                                if (template.text) {
                                    template.text = sanitizeText(template.text, 500);
                                }
                                if (template.dueDate !== undefined) {
                                    template.dueDate = validateDateString(template.dueDate);
                                }
                            }
                        });
                    }
                });
            }

            // Write sanitized data back
            backupData.miniCycleData = JSON.stringify(data);
            console.log('Schema 2.5 data sanitized successfully');
        } catch (error) {
            console.error('Error sanitizing Schema 2.5 data:', error);
        }
    }

    // Sanitize legacy format
    if (backupData.miniCycleStorage) {
        try {
            const legacyData = JSON.parse(backupData.miniCycleStorage);

            if (Array.isArray(legacyData)) {
                legacyData.forEach(cycle => {
                    if (!cycle || typeof cycle !== 'object') return;

                    // Sanitize cycle name
                    if (cycle.name) {
                        cycle.name = sanitizeText(cycle.name, 100);
                    }

                    // Sanitize task text
                    if (Array.isArray(cycle.tasks)) {
                        cycle.tasks.forEach(task => {
                            if (task && typeof task === 'object' && task.text) {
                                task.text = sanitizeText(task.text, 500);
                            }
                        });
                    }
                });
            }

            // Write sanitized data back
            backupData.miniCycleStorage = JSON.stringify(legacyData);
            console.log('Legacy data sanitized successfully');
        } catch (error) {
            console.error('Error sanitizing legacy data:', error);
        }
    }

    return backupData;
}

console.log('Data Sanitizer module loaded');
