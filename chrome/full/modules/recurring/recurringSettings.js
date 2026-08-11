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

// The complete set of frequency values the app understands: the recur-frequency
// dropdown options (modalTemplates.js) and the calculator switch cases
// (recurringCalculators.js). NOT 'specificDates' — that's a nested toggle
// (settings.specificDates.enabled), checked before the frequency switch, never
// a frequency value itself.
//
// SECURITY (notifications-review, Aug 2026): frequency reaches an UNESCAPED
// HTML sink — the recurring notification's status line renders
// '<strong>' + frequency + '</strong>' via getLabel (no var escaping) under
// { trusted: true }. Imports normalize through here, so an unconstrained
// value from a hostile .mcyc file was a stored-XSS vector. Anything off this
// list is coerced to 'daily'.
const VALID_FREQUENCIES = new Set([
    'hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'
]);

// weekOfMonth allowlists — same import door as frequency above. The panel's
// selects can only produce these, but imports are a second producer for the
// same schema: an unconstrained ordinal (e.g. '5') or day makes
// calculateNthWeekdayOfMonth return null for EVERY month, degenerating the
// recurrence to "1st of next month" — a date the user never picked.
// VALID_WEEK_DAYS mirrors WEEKDAY_MAP in recurringDateUtils.js.
const VALID_ORDINALS = new Set(['1', '2', '3', '4', 'last']);
const VALID_WEEK_DAYS = new Set(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

// ── Array-member filters — the rest of the same class ────────────────────────
// The weekOfMonth note above generalizes: EVERY selection array below reaches
// date math, and an out-of-range member degenerates the schedule silently
// rather than erroring. Verified by running the real normalizer through the
// real calculator from Feb 10 2026 (Aug 2026 sweep):
//   monthly.days [99]        -> Mar 1 2026   (the 1st-of-month degeneration,
//                                             identical to ordinal '5')
//   yearly.months [13]       -> Jan 1 2027   (month index overflows the year)
//   yearly daysByMonth [99]  -> Feb 10 2027  (wrong month AND wrong day)
//   weekly.days ['Funday']   -> Feb 17 2026  (silent "next week, same day")
//   biweekly.week1 ['Funday']-> Feb 24 2026  (silent "two weeks on")
//   specificDates ['zzz']    -> Jan 1 1970   (epoch: permanently in the PAST,
//                                             so the watcher sees it as due
//                                             on every tick)
// The panel can produce none of these — it emits parseInt'd numbers and
// <select> weekday names — but the .mcyc importer is a second producer for the
// same schema. Filter membership only; element TYPE is left alone so stored
// numeric strings from older versions keep working exactly as before.
const inRange = (v, min, max) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max;
};
const keepDayNumbers = (arr) => (Array.isArray(arr) ? arr.filter(d => inRange(d, 1, 31)) : []);
const keepMonthNumbers = (arr) => (Array.isArray(arr) ? arr.filter(m => inRange(m, 1, 12)) : []);
const keepWeekDays = (arr) => (Array.isArray(arr) ? arr.filter(d => VALID_WEEK_DAYS.has(d)) : []);
// Date.parse rejects garbage, but `new Date(null)` is the epoch — a valid time —
// so null/empty must be excluded explicitly before parsing.
const keepParsableDates = (arr) => (Array.isArray(arr)
    ? arr.filter(d => (typeof d === 'string' || typeof d === 'number')
        && String(d).trim() !== ''
        && !Number.isNaN(new Date(d).getTime()))
    : []);
// daysByMonth is { all: [days] } or { '1'..'12': [days] } — filter each bucket.
// Built via entries/fromEntries rather than indexed writes so the security
// linter's object-injection rule stays satisfied without a disable comment.
const keepDaysByMonth = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([key]) => key === 'all' || inRange(key, 1, 12))
            .map(([key, days]) => [key, keepDayNumbers(days)])
    );
};

/**
 * Normalize recurring settings with all required fields
 * Uses memoization to avoid creating objects on every call
 * @param {Object} settings - Partial recurring settings
 * @returns {Object} Normalized settings with defaults
 */
export function normalizeRecurringSettings(settings = {}) {
    // Generate cache key from settings
    const cacheKey = JSON.stringify(settings);

    // Build the time-independent normalized shape (cacheable)
    let normalized;
    const cached = normalizationCache.get(cacheKey);

    if (cached) {
        // Fix #29: Return deep clone to prevent cache corruption from caller mutations
        normalized = typeof structuredClone === 'function'
            ? structuredClone(cached)
            : JSON.parse(JSON.stringify(cached));
    } else {
        normalized = {
            frequency: VALID_FREQUENCIES.has(settings.frequency) ? settings.frequency : "daily",
            indefinitely: settings.indefinitely !== false,
            count: settings.count ?? null,
            untilDate: settings.untilDate || null,
            time: settings.time || null,
            useSpecificTime: settings.useSpecificTime ?? false,

            specificDates: {
                enabled: settings.specificDates?.enabled || false,
                dates: keepParsableDates(settings.specificDates?.dates)
            },

            hourly: {
                useSpecificMinute: settings.hourly?.useSpecificMinute || false,
                minute: settings.hourly?.minute || 0
            },

            weekly: {
                days: keepWeekDays(settings.weekly?.days)
            },

            biweekly: {
                week1: keepWeekDays(settings.biweekly?.week1),
                week2: keepWeekDays(settings.biweekly?.week2),
                referenceDate: settings.biweekly?.referenceDate || null
            },

            monthly: {
                useSpecificDays: settings.monthly?.useSpecificDays ?? (
                    (settings.monthly?.days?.length > 0) ||
                    settings.monthly?.lastDay ||
                    settings.monthly?.useWeekOfMonth ||
                    false
                ),
                days: keepDayNumbers(settings.monthly?.days),
                lastDay: settings.monthly?.lastDay || false,
                useWeekOfMonth: settings.monthly?.useWeekOfMonth || false,
                weekOfMonth: settings.monthly?.weekOfMonth ? {
                    ordinal: VALID_ORDINALS.has(String(settings.monthly.weekOfMonth.ordinal))
                        ? String(settings.monthly.weekOfMonth.ordinal) : "1",
                    day: VALID_WEEK_DAYS.has(settings.monthly.weekOfMonth.day)
                        ? settings.monthly.weekOfMonth.day : "Mon"
                } : null
            },

            yearly: {
                months: keepMonthNumbers(settings.yearly?.months),
                useSpecificDays: settings.yearly?.useSpecificDays || false,
                applyDaysToAll: settings.yearly?.applyDaysToAll !== false,
                daysByMonth: keepDaysByMonth(settings.yearly?.daysByMonth)
            }
        };

        // Bound cache size
        if (normalizationCache.size >= MAX_NORMALIZATION_CACHE_SIZE) {
            const firstKey = normalizationCache.keys().next().value;
            normalizationCache.delete(firstKey);
        }

        normalizationCache.set(cacheKey, normalized);

        // Return a clone so callers (and the defaults pass below) don't corrupt the cache
        normalized = typeof structuredClone === 'function'
            ? structuredClone(normalized)
            : JSON.parse(JSON.stringify(normalized));
    }

    // ========================================================================
    // ENFORCE SENSIBLE DEFAULTS FOR EMPTY SELECTIONS (always fresh, never cached)
    // ========================================================================
    // When a frequency requires selections (days, months, etc.) but none are
    // provided, apply sensible defaults instead of silently falling back to
    // daily. This fixes a regression from the module split where the original
    // monolith's positive-match behavior ([].includes() → false → no trigger)
    // was replaced with negative-filter logic that falls through to true.
    //
    // These defaults depend on wall-clock time (current weekday, day-of-month,
    // etc.) so they must NOT be served from the cache.

    const freq = normalized.frequency;

    // Use the current date as the reference point for defaults — if you set up
    // a weekly task on Wednesday, it should recur on Wednesdays, not all weekdays.
    const now = new Date();

    // Backfill biweekly referenceDate (time-dependent, excluded from cache)
    if (!normalized.biweekly.referenceDate) {
        normalized.biweekly.referenceDate = now.toISOString();
    }

    const currentWeekday = now.toLocaleDateString("en-US", { weekday: "short" });
    const currentDayOfMonth = now.getDate();
    const currentMonth = now.getMonth() + 1;

    if (freq === 'hourly' && !normalized.hourly.useSpecificMinute) {
        // Anchor to the current minute — 2:47 PM → next at 3:47, 4:47, etc.
        const currentMinute = now.getMinutes();
        normalized.hourly.useSpecificMinute = true;
        normalized.hourly.minute = currentMinute;
        console.debug(`Hourly recurring with no specific minute — defaulting to :${String(currentMinute).padStart(2, '0')}`);
    }

    if (freq === 'weekly' && normalized.weekly.days.length === 0) {
        normalized.weekly.days = [currentWeekday];
        console.debug(`Weekly recurring with no days selected — defaulting to ${currentWeekday}`);
    }

    if (freq === 'biweekly' &&
        normalized.biweekly.week1.length === 0 && normalized.biweekly.week2.length === 0) {
        // Only set week 1 — week 2 stays empty so the task recurs every OTHER week
        normalized.biweekly.week1 = [currentWeekday];
        console.debug(`Biweekly recurring with no days selected — defaulting to ${currentWeekday} every other week`);
    }

    if (freq === 'monthly' && !normalized.monthly.useWeekOfMonth) {
        if (!normalized.monthly.useSpecificDays) {
            normalized.monthly.useSpecificDays = true;
            normalized.monthly.days = [currentDayOfMonth];
            console.debug(`Monthly recurring with no pattern selected — defaulting to day ${currentDayOfMonth}`);
        } else if (normalized.monthly.days.length === 0 && !normalized.monthly.lastDay) {
            normalized.monthly.days = [currentDayOfMonth];
            console.debug(`Monthly recurring with specific days enabled but none selected — defaulting to day ${currentDayOfMonth}`);
        }
    }

    if (freq === 'yearly' && normalized.yearly.months.length === 0) {
        // Default to same month AND same day — April 4th → every April 4th
        normalized.yearly.months = [currentMonth];
        normalized.yearly.useSpecificDays = true;
        normalized.yearly.applyDaysToAll = true;
        normalized.yearly.daysByMonth = { all: [currentDayOfMonth] };
        console.debug(`Yearly recurring with no months selected — defaulting to month ${currentMonth}, day ${currentDayOfMonth}`);
    }

    return normalized;
}

