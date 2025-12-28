/**
 * Storage Utilities
 * Calculates localStorage usage and provides storage information
 *
 * @module utils/storageUtils
 */

// ============================================================================
// CONSTANTS
// ============================================================================

// Reserve 0.25MB (256KB) as buffer for system overhead
const STORAGE_BUFFER_BYTES = 0.25 * 1024 * 1024;

// Default localStorage quota (5MB is common, but we detect actual)
const DEFAULT_QUOTA_BYTES = 5 * 1024 * 1024;

// ============================================================================
// STORAGE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate total bytes used in localStorage
 * @returns {number} Total bytes used
 */
export function getLocalStorageUsedBytes() {
    let totalBytes = 0;

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                // Each character in JavaScript is 2 bytes (UTF-16)
                const keyBytes = key.length * 2;
                const valueBytes = (localStorage.getItem(key) || '').length * 2;
                totalBytes += keyBytes + valueBytes;
            }
        }
    } catch (error) {
        console.warn('Error calculating localStorage usage:', error);
    }

    return totalBytes;
}

/**
 * Estimate localStorage quota by attempting to fill it
 * This is cached after first call to avoid repeated expensive operations
 * @returns {number} Estimated quota in bytes
 */
let _cachedQuota = null;

export function getLocalStorageQuota() {
    if (_cachedQuota !== null) {
        return _cachedQuota;
    }

    // Try to estimate quota by checking navigator.storage if available
    // Otherwise use a conservative default
    try {
        // Most browsers have 5-10MB localStorage quota
        // We'll use a test-based approach to estimate
        const testKey = '__storage_quota_test__';
        const testChunk = 'x'.repeat(1024); // 1KB chunk (2KB in UTF-16)
        let testSize = 0;
        const maxTest = 10 * 1024; // Test up to 10MB

        // First, save current usage
        const originalValue = localStorage.getItem(testKey);

        try {
            // Try to write increasingly larger values
            while (testSize < maxTest) {
                testSize += 100; // 100KB increments
                const testValue = testChunk.repeat(testSize);
                localStorage.setItem(testKey, testValue);
            }
        } catch (e) {
            // QuotaExceededError - we've found the limit
        }

        // Clean up test
        if (originalValue !== null) {
            localStorage.setItem(testKey, originalValue);
        } else {
            localStorage.removeItem(testKey);
        }

        // Calculate detected quota
        const usedBeforeTest = getLocalStorageUsedBytes();
        _cachedQuota = Math.max(testSize * 1024 * 2, DEFAULT_QUOTA_BYTES); // Convert to bytes

    } catch (error) {
        console.warn('Could not detect localStorage quota, using default:', error);
        _cachedQuota = DEFAULT_QUOTA_BYTES;
    }

    return _cachedQuota;
}

/**
 * Get storage information with buffer applied
 * @returns {Object} Storage info { used, total, available, percentage, status }
 */
export function getStorageInfo() {
    const usedBytes = getLocalStorageUsedBytes();
    const quotaBytes = getLocalStorageQuota();

    // Apply 0.25MB buffer - show less total than actual
    const effectiveQuotaBytes = Math.max(0, quotaBytes - STORAGE_BUFFER_BYTES);

    const availableBytes = Math.max(0, effectiveQuotaBytes - usedBytes);
    const percentage = effectiveQuotaBytes > 0
        ? Math.min(100, (usedBytes / effectiveQuotaBytes) * 100)
        : 0;

    // Determine status based on percentage
    let status = 'normal';
    if (percentage >= 90) {
        status = 'critical';
    } else if (percentage >= 75) {
        status = 'warning';
    } else if (percentage >= 50) {
        status = 'caution';
    }

    return {
        used: usedBytes,
        total: effectiveQuotaBytes,
        available: availableBytes,
        percentage: Math.round(percentage * 10) / 10, // 1 decimal place
        status
    };
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string (e.g., "2.5 MB")
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);

    // Use appropriate decimal places based on unit
    if (i === 0) return `${bytes} B`;
    if (i === 1) return `${Math.round(value)} KB`;
    return `${value.toFixed(2)} MB`;
}

/**
 * Update storage bar UI elements
 * @param {HTMLElement} barElement - The progress bar element
 * @param {HTMLElement} textElement - The text display element
 */
export function updateStorageBarUI(barElement, textElement) {
    const info = getStorageInfo();

    if (barElement) {
        barElement.style.width = `${info.percentage}%`;
        barElement.className = `storage-bar-fill storage-${info.status}`;
    }

    if (textElement) {
        const usedStr = formatBytes(info.used);
        const totalStr = formatBytes(info.total);
        textElement.textContent = `${usedStr} / ${totalStr} used`;
    }

    return info;
}

/**
 * Calculate the size in bytes of a JavaScript object when stringified
 * @param {Object} obj - Object to measure
 * @returns {number} Size in bytes
 */
export function getObjectSizeBytes(obj) {
    try {
        const jsonString = JSON.stringify(obj);
        // Each character is 2 bytes in UTF-16
        return jsonString.length * 2;
    } catch (error) {
        console.warn('Error calculating object size:', error);
        return 0;
    }
}

/**
 * Check if adding data of a certain size would exceed storage quota
 * @param {number} additionalBytes - Bytes to be added
 * @returns {Object} { allowed: boolean, available: number, needed: number, shortfall: number }
 */
export function canAddToStorage(additionalBytes) {
    const info = getStorageInfo();
    const available = info.available;
    const allowed = additionalBytes <= available;

    return {
        allowed,
        available,
        needed: additionalBytes,
        shortfall: allowed ? 0 : additionalBytes - available
    };
}

/**
 * Check if an object can be added to storage
 * @param {Object} obj - Object to check
 * @returns {Object} { allowed: boolean, size: number, available: number, shortfall: number }
 */
export function canAddObjectToStorage(obj) {
    const size = getObjectSizeBytes(obj);
    const result = canAddToStorage(size);
    return {
        ...result,
        size
    };
}

/**
 * Estimate the size of a new task
 * @param {string} taskText - Task text
 * @returns {number} Estimated size in bytes
 */
export function estimateTaskSize(taskText) {
    // Base task structure overhead (id, completed, dates, settings, etc.)
    const baseOverhead = 400; // ~200 characters * 2 bytes
    const textBytes = (taskText || '').length * 2;
    return baseOverhead + textBytes;
}

/**
 * Get a user-friendly message about storage shortage
 * @param {number} shortfall - Bytes short
 * @returns {string} User-friendly message
 */
export function getStorageShortageMessage(shortfall) {
    const shortfallStr = formatBytes(shortfall);
    return `Not enough storage space. Need ${shortfallStr} more. Delete some tasks or routines to free up space.`;
}

console.log('Storage Utils loaded');
