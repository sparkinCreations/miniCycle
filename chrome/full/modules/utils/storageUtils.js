/**
 * Storage Utilities Module
 *
 * Manages localStorage quota detection, usage tracking, and storage checks.
 * Provides utilities for estimating object sizes and monitoring quota.
 *
 * Features:
 * - Automatic quota detection with caching
 * - Storage usage calculation and display
 * - Size estimation for objects/tasks
 * - Pre-add storage checks
 * - Quota warning notifications
 *
 * @module utils/storageUtils
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md} - Schema reference
 */

/**
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {Object} StorageCheck
 * @property {boolean} allowed - Whether operation is allowed
 * @property {number} [shortfall] - Bytes short if not allowed
 * @property {number} available - Available bytes
 * @property {number} required - Required bytes
 */

/**
 * @typedef {Object} StorageInfo
 * @property {number} usedBytes - Bytes currently used
 * @property {number} quotaBytes - Total quota bytes
 * @property {number} availableBytes - Available bytes
 * @property {number} percentUsed - Usage percentage
 */

import { APP_VERSION, UI_TIMEOUTS, LIMITS } from '../core/constants.js';
import { createDIModule, optional } from '../core/diBase.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// CONSTANTS
// ============================================================================

// Reserve 0.25MB (256KB) as buffer for system overhead
const STORAGE_BUFFER_BYTES = 0.25 * 1024 * 1024;

// Default localStorage quota (5MB is common, but we detect actual)
const DEFAULT_QUOTA_BYTES = 5 * 1024 * 1024;

// Quota cache validity period (14 days in milliseconds)
const QUOTA_CACHE_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;

// Session flag for one-time 75% warning
let _storageWarningShown = false;

// Flag to track if quota detection has been requested
let _quotaDetectionRequested = false;

// Estimated storage tracking (for delta-based updates without re-measuring)
let _lastMeasuredUsedBytes = null;
let _storageDeltaBytes = 0;

const di = createDIModule('StorageUtils', {
    AppState: optional(null)
});

/**
 * Set dependencies for StorageUtils (e.g., AppState for quota caching)
 * @param {Object} dependencies - Dependencies to inject
 * @returns {void}
 */
export const setStorageDependencies = di.setDependencies;

// ============================================================================
// QUOTA CACHE FUNCTIONS
// ============================================================================

/**
 * Get cached quota from AppState metadata
 * @returns {Object|null} { detectedBytes, detectedAt, detectedVersion } or null
 */
function getCachedQuotaFromState() {
    try {
        const state = di.resolve().AppState?.get?.();
        return state?.metadata?.storageQuota || null;
    } catch (error) {
        console.warn('Could not read cached quota from state:', error);
        return null;
    }
}

/**
 * Save detected quota to AppState metadata
 * @param {number} bytes - Detected quota in bytes
 */
function saveCachedQuotaToState(bytes) {
    try {
        if (!di.resolve().AppState?.isReady?.()) {
            return;
        }

        di.resolve().AppState.update(data => {
            if (!data.metadata) data.metadata = {};
            data.metadata.storageQuota = {
                detectedBytes: bytes,
                detectedAt: Date.now(),
                detectedVersion: APP_VERSION
            };
        });
    } catch (error) {
        console.warn('Could not save quota to state:', error);
    }
}

/**
 * Check if cached quota is still valid
 * @param {Object} cached - Cached quota object
 * @returns {boolean} True if cache is valid
 */
function isCachedQuotaValid(cached) {
    if (!cached || !cached.detectedBytes || !cached.detectedAt) {
        return false;
    }

    const now = Date.now();
    const age = now - cached.detectedAt;
    const currentVersion = APP_VERSION;

    // Invalid if older than 14 days
    if (age > QUOTA_CACHE_VALIDITY_MS) {
        return false;
    }

    // Invalid if app version changed
    if (cached.detectedVersion !== currentVersion) {
        return false;
    }

    return true;
}

/**
 * Cached quota value (used by forceQuotaRedetection and getLocalStorageQuota below)
 */
let _cachedQuota = null;

/**
 * Force re-detection of storage quota (clears cache)
 * @returns {number} Newly detected quota in bytes
 */
export function forceQuotaRedetection() {
    _cachedQuota = null;
    return detectStorageQuota(true);
}

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
 * Get localStorage quota - uses conservative default until detection is triggered
 * @returns {number} Quota in bytes
 */
export function getLocalStorageQuota() {
    // Return cached if available, otherwise use conservative default
    // Actual detection happens lazily via detectStorageQuota()
    return _cachedQuota !== null ? _cachedQuota : DEFAULT_QUOTA_BYTES;
}

/**
 * Detect actual localStorage quota
 * First checks for valid cached quota in AppState, then falls back to fill-test
 * Results are cached both in session memory and persisted to AppState
 * @param {boolean} forceRedetect - Skip cache and force fresh detection
 * @returns {number} Detected quota in bytes
 */
export function detectStorageQuota(forceRedetect = false) {
    // Already detected this session (and not forcing)
    if (_cachedQuota !== null && !forceRedetect) {
        return _cachedQuota;
    }

    // Check for valid persisted cache in AppState (unless forcing)
    if (!forceRedetect) {
        const cachedFromState = getCachedQuotaFromState();
        if (isCachedQuotaValid(cachedFromState)) {
            _cachedQuota = cachedFromState.detectedBytes;
            return _cachedQuota;
        }
    }

    // Mark as requested
    _quotaDetectionRequested = true;

    try {
        const testKey = '__storage_quota_test__';
        const testChunk = 'x'.repeat(1024); // 1KB chunk (2KB in UTF-16)
        let testSize = 0;
        const maxTest = 10 * 1024; // Test up to 10MB

        // Save original value if exists
        const originalValue = localStorage.getItem(testKey);

        try {
            // Write increasingly larger values until quota error
            while (testSize < maxTest) {
                testSize += 100; // 100KB increments
                const testValue = testChunk.repeat(testSize);
                localStorage.setItem(testKey, testValue);
            }
        } catch (e) {
            // QuotaExceededError - found the limit
        }

        // Always clean up test key
        if (originalValue !== null) {
            localStorage.setItem(testKey, originalValue);
        } else {
            localStorage.removeItem(testKey);
        }

        // Cache detected quota (session)
        _cachedQuota = Math.max(testSize * 1024 * 2, DEFAULT_QUOTA_BYTES);

        // Persist to AppState for future sessions
        saveCachedQuotaToState(_cachedQuota);

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
 * Check storage level and show one-time warning if needed
 * @param {Object} info - Storage info from getStorageInfo()
 * @param {Function} showNotification - Notification function (optional)
 * @returns {boolean} True if warning was shown
 */
export function checkStorageWarning(info, showNotification) {
    // Only show once per session, and only at LIMITS.STORAGE_WARNING_PERCENTAGE+ (warning level)
    if (_storageWarningShown || info.percentage < LIMITS.STORAGE_WARNING_PERCENTAGE) {
        return false;
    }

    _storageWarningShown = true;

    if (typeof showNotification === 'function') {
        showNotification(
            getLabel('notify.storageTight'),
            'warning',
            UI_TIMEOUTS.NOTIFICATION_SLOW
        );
    }

    return true;
}

/**
 * Render storage bar with current info
 * @private
 */
function renderStorageBar(barElement, textElement, info) {
    if (barElement) {
        barElement.style.width = `${info.percentage}%`;
        barElement.className = `storage-bar-fill storage-${info.status}`;
    }

    if (textElement) {
        const usedStr = formatBytes(info.used);
        const totalStr = formatBytes(info.total);
        // Use "~" to indicate estimates (remove ~ once quota is detected)
        const prefix = _cachedQuota !== null ? '' : '~';
        textElement.textContent = `${prefix}${usedStr} / ${prefix}${totalStr} used`;
    }
}

/**
 * Update storage bar UI elements
 * Uses idle detection to avoid blocking the main thread on modal open
 * @param {HTMLElement} barElement - The progress bar element
 * @param {HTMLElement} textElement - The text display element
 * @param {Function} showNotification - Optional notification function for warnings
 */
export function updateStorageBarUI(barElement, textElement, showNotification) {
    // Render immediately with current info (uses default quota if not detected)
    const info = getStorageInfo();
    renderStorageBar(barElement, textElement, info);

    // Check for one-time storage warning
    checkStorageWarning(info, showNotification);

    // If quota not yet detected, schedule detection in idle time then repaint
    if (_cachedQuota === null) {
        const detectAndRepaint = () => {
            detectStorageQuota();
            const updatedInfo = getStorageInfo();
            renderStorageBar(barElement, textElement, updatedInfo);
            // Re-check warning with accurate quota
            checkStorageWarning(updatedInfo, showNotification);
        };

        // Use requestIdleCallback for non-blocking detection, with fallback
        if ('requestIdleCallback' in window) {
            requestIdleCallback(detectAndRepaint, { timeout: 2000 });
        } else {
            setTimeout(detectAndRepaint, UI_TIMEOUTS.IDLE_CALLBACK_FALLBACK);
        }
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

// ============================================================================
// ESTIMATED STORAGE TRACKING
// ============================================================================

/**
 * Adjust the storage estimate by a delta (positive for additions, negative for deletions)
 * This avoids re-measuring localStorage for every change.
 * @param {number} deltaBytes - Bytes to add (positive) or remove (negative)
 */
export function adjustStorageEstimate(deltaBytes) {
    // Initialize last measured if needed
    if (_lastMeasuredUsedBytes === null) {
        _lastMeasuredUsedBytes = getLocalStorageUsedBytes();
    }

    _storageDeltaBytes += deltaBytes;
}

/**
 * Get the estimated used bytes (last measurement + accumulated delta)
 * @returns {number} Estimated bytes used
 */
export function getEstimatedUsedBytes() {
    if (_lastMeasuredUsedBytes === null) {
        _lastMeasuredUsedBytes = getLocalStorageUsedBytes();
    }
    return Math.max(0, _lastMeasuredUsedBytes + _storageDeltaBytes);
}

/**
 * Reset the storage estimate to actual measurement
 * Call this when user clicks refresh or when you need accurate values
 */
export function resetStorageEstimate() {
    _lastMeasuredUsedBytes = getLocalStorageUsedBytes();
    _storageDeltaBytes = 0;
}

/**
 * Get storage info using estimated values (faster, no localStorage iteration)
 * @returns {Object} Storage info { used, total, available, percentage, status, isEstimate }
 */
export function getEstimatedStorageInfo() {
    const usedBytes = getEstimatedUsedBytes();
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
        percentage: Math.round(percentage * 10) / 10,
        status,
        isEstimate: _storageDeltaBytes !== 0
    };
}

/**
 * Update storage bar UI using estimated values (no re-measurement)
 * @param {HTMLElement} barElement - The progress bar element
 * @param {HTMLElement} textElement - The text display element
 * @returns {Object} The storage info used for display
 */
export function updateStorageBarUIEstimated(barElement, textElement) {
    const info = getEstimatedStorageInfo();

    if (barElement) {
        barElement.style.width = `${info.percentage}%`;
        barElement.className = `storage-bar-fill storage-${info.status}`;
    }

    if (textElement) {
        const usedStr = formatBytes(info.used);
        const totalStr = formatBytes(info.total);
        // Show ~ prefix if we're using estimates
        const prefix = info.isEstimate ? '~' : (_cachedQuota !== null ? '' : '~');
        textElement.textContent = `${prefix}${usedStr} / ${prefix}${totalStr} used`;
    }

    return info;
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

