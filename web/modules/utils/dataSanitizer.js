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
    // Only allow ISO date format YYYY-MM-DD with optional time component
    // eslint-disable-next-line security/detect-unsafe-regex -- anchored ISO 8601 pattern, input is length-limited by caller
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?([+-]\d{2}:?\d{2}|Z)?)?$/.test(dateValue)) return null;
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

function sanitizeTask(task) {
    if (!task || typeof task !== 'object') return;

    if (task.text) {
        task.text = sanitizeText(task.text, 500);
    }
    if (task.dueDate !== undefined) {
        task.dueDate = validateDateString(task.dueDate);
    }
    if (task.recurringTemplate?.text) {
        task.recurringTemplate.text = sanitizeText(task.recurringTemplate.text, 500);
    }
}

function sanitizeCycle(cycle) {
    if (!cycle || typeof cycle !== 'object') return;

    if (cycle.title) {
        cycle.title = sanitizeText(cycle.title, 100);
    }
    if (cycle.name) {
        cycle.name = sanitizeText(cycle.name, 100);
    }

    if (Array.isArray(cycle.tasks)) {
        cycle.tasks.forEach(sanitizeTask);
    }

    if (cycle.recurringTemplates && typeof cycle.recurringTemplates === 'object') {
        Object.values(cycle.recurringTemplates).forEach(template => {
            if (!template || typeof template !== 'object') return;

            if (template.text) {
                template.text = sanitizeText(template.text, 500);
            }
            if (template.dueDate !== undefined) {
                template.dueDate = validateDateString(template.dueDate);
            }
        });
    }
}

function sanitizeSchema25State(state) {
    const cycles = state?.data?.cycles || state?.cycles;
    if (!cycles || typeof cycles !== 'object') {
        return;
    }

    Object.values(cycles).forEach(sanitizeCycle);
}

function sanitizeLiteStructuredValue(value) {
    if (typeof value === 'string') {
        return sanitizeText(value, 500);
    }
    if (Array.isArray(value)) {
        return value.map(item => sanitizeLiteStructuredValue(item));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, entryValue]) => [key, sanitizeLiteStructuredValue(entryValue)])
        );
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'boolean' || value === null) {
        return value;
    }
    return null;
}

function sanitizeNonNegativeIntegerString(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }
    return String(parsed);
}

function sanitizeLiteStringArrayJson(value) {
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return null;
        return JSON.stringify(parsed.map(item => sanitizeText(String(item), 100)));
    } catch {
        return null;
    }
}

function sanitizeLiteStorage(backupData) {
    if (!backupData.liteStorage || typeof backupData.liteStorage !== 'object' || Array.isArray(backupData.liteStorage)) {
        return;
    }

    const sanitizedLiteStorage = {};

    Object.entries(backupData.liteStorage).forEach(([key, value]) => {
        if (typeof value !== 'string') {
            return;
        }

        switch (key) {
            case 'miniCycleLite': {
                try {
                    const parsed = JSON.parse(value);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        return;
                    }
                    sanitizedLiteStorage[key] = JSON.stringify(sanitizeLiteStructuredValue(parsed));
                } catch {
                    return;
                }
                break;
            }
            case 'miniCycleLiteMode':
                if (['auto-cycle', 'manual-cycle', 'todo-mode'].includes(value)) {
                    sanitizedLiteStorage[key] = value;
                }
                break;
            case 'miniCycleLiteTheme':
                if (['default', 'dark'].includes(value)) {
                    sanitizedLiteStorage[key] = value;
                }
                break;
            case 'miniCycleLiteCycles':
            case 'miniCycleLiteLifetimeCompleted':
            case 'miniCycleLiteToDoDeleted': {
                const sanitizedValue = sanitizeNonNegativeIntegerString(value);
                if (sanitizedValue !== null) {
                    sanitizedLiteStorage[key] = sanitizedValue;
                }
                break;
            }
            case 'miniCycleLite_celebratedBadges':
            case 'miniCycleLite_celebratedClearedBadges': {
                const sanitizedValue = sanitizeLiteStringArrayJson(value);
                if (sanitizedValue !== null) {
                    sanitizedLiteStorage[key] = sanitizedValue;
                }
                break;
            }
            case 'miniCycleLiteNotifications':
                if (value === 'off') {
                    sanitizedLiteStorage[key] = value;
                }
                break;
            default:
                break;
        }
    });

    backupData.liteStorage = sanitizedLiteStorage;
}

/**
 * Sanitize all user-generated content in imported backup data
 * Security fix: Prevent XSS attacks via malicious .mcyc files
 * @param {Object} backupData - The parsed backup data object
 * @returns {Object} Sanitized backup data
 */
export function sanitizeImportedData(backupData) {

    // Sanitize Schema 2.5 format
    if (backupData.schemaVersion === '2.5' && backupData.miniCycleData) {
        try {
            const data = JSON.parse(backupData.miniCycleData);
            sanitizeSchema25State(data);

            // Write sanitized data back
            backupData.miniCycleData = JSON.stringify(data);
        } catch (error) {
            console.error('Error sanitizing Schema 2.5 data:', error);
        }
    }

    sanitizeLiteStorage(backupData);

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
        } catch (error) {
            console.error('Error sanitizing legacy data:', error);
        }
    }

    return backupData;
}
