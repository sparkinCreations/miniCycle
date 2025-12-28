/**
 * Name Utilities
 * Helpers for generating unique routine/cycle names
 *
 * @module utils/nameUtils
 */

/**
 * Generate a unique cycle name by appending (2), (3), etc. if needed
 * @param {string} baseName - The desired name
 * @param {Object} existingCycles - Object with cycle keys (names)
 * @param {number} maxAttempts - Max number of variations to try (default 10)
 * @returns {{ name: string, wasModified: boolean }} Unique name and whether it was modified
 */
export function getUniqueCycleName(baseName, existingCycles = {}, maxAttempts = 10) {
    // If name doesn't exist, use it as-is
    if (!existingCycles[baseName]) {
        return { name: baseName, wasModified: false };
    }

    // Try numbered variations: "Name (2)", "Name (3)", etc.
    for (let counter = 2; counter <= maxAttempts + 1; counter++) {
        const numberedName = `${baseName} (${counter})`;
        if (!existingCycles[numberedName]) {
            return { name: numberedName, wasModified: true };
        }
    }

    // Fallback: append timestamp for guaranteed uniqueness
    const fallbackName = `${baseName} (${Date.now()})`;
    return { name: fallbackName, wasModified: true };
}

/**
 * Check if a cycle name already exists
 * @param {string} name - Name to check
 * @param {Object} existingCycles - Object with cycle keys (names)
 * @returns {boolean} True if name exists
 */
export function cycleNameExists(name, existingCycles = {}) {
    return !!existingCycles[name];
}

console.log('Name Utils loaded');
