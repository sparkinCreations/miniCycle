/**
 * miniCycle Recurring Tasks - Settings Normalization
 *
 * Provides settings normalization with memoization cache.
 * Separated from recurringCore to avoid circular dependencies.
 *
 * Features:
 * - Settings normalization with default values
 * - Memoization cache for performance
 * - Support for all frequency types (hourly, daily, weekly, etc.)
 *
 * @module recurring/recurringSettings
 * @version 1.0.0
 * @see {@link module:recurring/recurringCore} - Uses normalized settings
 * @see {@link module:recurring/recurringPanel} - UI for settings
 */

/**
 * @typedef {import('../core/types.js').RecurringSettings} RecurringSettings
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
    // Fix #29: Return deep clone to prevent cache corruption from caller mutations
    if (normalizationCache.has(cacheKey)) {
        const cached = normalizationCache.get(cacheKey);
        // Use structuredClone if available, otherwise JSON round-trip
        return typeof structuredClone === 'function'
            ? structuredClone(cached)
            : JSON.parse(JSON.stringify(cached));
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

    // ========================================================================
    // ENFORCE SENSIBLE DEFAULTS FOR EMPTY SELECTIONS
    // ========================================================================
    // When a frequency requires selections (days, months, etc.) but none are
    // provided, apply sensible defaults instead of silently falling back to
    // daily. This fixes a regression from the module split where the original
    // monolith's positive-match behavior ([].includes() → false → no trigger)
    // was replaced with negative-filter logic that falls through to true.

    const freq = normalized.frequency;

    if (freq === 'weekly' && normalized.weekly.days.length === 0) {
        normalized.weekly.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        console.warn('⚠️ Weekly recurring with no days selected — defaulting to weekdays');
    }

    if (freq === 'biweekly') {
        if (normalized.biweekly.week1.length === 0 && normalized.biweekly.week2.length === 0) {
            normalized.biweekly.week1 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            normalized.biweekly.week2 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            console.warn('⚠️ Biweekly recurring with no days selected — defaulting to weekdays');
        }
    }

    if (freq === 'monthly' && !normalized.monthly.useWeekOfMonth) {
        if (!normalized.monthly.useSpecificDays) {
            normalized.monthly.useSpecificDays = true;
            normalized.monthly.days = [1];
            console.warn('⚠️ Monthly recurring with no pattern selected — defaulting to 1st of month');
        } else if (normalized.monthly.days.length === 0 && !normalized.monthly.lastDay) {
            normalized.monthly.days = [1];
            console.warn('⚠️ Monthly recurring with specific days enabled but none selected — defaulting to 1st');
        }
    }

    if (freq === 'yearly' && normalized.yearly.months.length === 0) {
        normalized.yearly.months = [new Date().getMonth() + 1];
        console.warn('⚠️ Yearly recurring with no months selected — defaulting to current month');
    }

    // Bound cache size
    if (normalizationCache.size >= MAX_NORMALIZATION_CACHE_SIZE) {
        const firstKey = normalizationCache.keys().next().value;
        normalizationCache.delete(firstKey);
    }

    normalizationCache.set(cacheKey, normalized);
    return structuredClone(normalized);
}

