/**
 * miniCycle Recurring Tasks - Settings Normalization
 *
 * Provides settings normalization with memoization cache.
 * Separated to avoid circular dependencies.
 *
 * @module recurringSettings
 */

import { LIMITS } from '../core/constants.js';

// ============================================================================
// SETTINGS NORMALIZATION (with memoization)
// ============================================================================

const normalizationCache = new Map();
const MAX_NORMALIZATION_CACHE_SIZE = LIMITS.NORMALIZATION_CACHE;

/**
 * Normalize recurring settings with all required fields
 * Uses memoization to avoid creating objects on every call
 * @param {Object} settings - Partial recurring settings
 * @returns {Object} Normalized settings with defaults
 */
export function normalizeRecurringSettings(settings = {}) {
    // Generate cache key from settings
    const cacheKey = JSON.stringify(settings);

    // Return cached result if available
    if (normalizationCache.has(cacheKey)) {
        return normalizationCache.get(cacheKey);
    }

    const normalized = {
        frequency: settings.frequency || "daily",
        indefinitely: settings.indefinitely !== false,
        count: settings.count ?? null,
        untilDate: settings.untilDate || null,
        time: settings.time || null,

        specificDates: {
            enabled: settings.specificDates?.enabled || false,
            dates: Array.isArray(settings.specificDates?.dates) ? settings.specificDates.dates : []
        },

        hourly: {
            useSpecificMinute: settings.hourly?.useSpecificMinute || false,
            minute: settings.hourly?.minute || 0
        },

        weekly: {
            days: Array.isArray(settings.weekly?.days) ? settings.weekly.days : []
        },

        biweekly: {
            week1: Array.isArray(settings.biweekly?.week1) ? settings.biweekly.week1 : [],
            week2: Array.isArray(settings.biweekly?.week2) ? settings.biweekly.week2 : [],
            referenceDate: settings.biweekly?.referenceDate || new Date().toISOString()
        },

        monthly: {
            useSpecificDays: settings.monthly?.useSpecificDays ?? (
                (settings.monthly?.days?.length > 0) ||
                settings.monthly?.lastDay ||
                settings.monthly?.useWeekOfMonth ||
                false
            ),
            days: Array.isArray(settings.monthly?.days) ? settings.monthly.days : [],
            lastDay: settings.monthly?.lastDay || false,
            useWeekOfMonth: settings.monthly?.useWeekOfMonth || false,
            weekOfMonth: settings.monthly?.weekOfMonth ? {
                ordinal: settings.monthly.weekOfMonth.ordinal || "1",
                day: settings.monthly.weekOfMonth.day || "Mon"
            } : null
        },

        yearly: {
            months: Array.isArray(settings.yearly?.months) ? settings.yearly.months : [],
            useSpecificDays: settings.yearly?.useSpecificDays || false,
            applyDaysToAll: settings.yearly?.applyDaysToAll !== false,
            daysByMonth: settings.yearly?.daysByMonth || {}
        }
    };

    // Bound cache size
    if (normalizationCache.size >= MAX_NORMALIZATION_CACHE_SIZE) {
        const firstKey = normalizationCache.keys().next().value;
        normalizationCache.delete(firstKey);
    }

    normalizationCache.set(cacheKey, normalized);
    return normalized;
}

console.log('⚙️ RecurringSettings module loaded');
