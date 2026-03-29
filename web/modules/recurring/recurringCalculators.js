/**
 * miniCycle Recurring Tasks - Next Occurrence Calculators
 *
 * Pure functions for calculating when a recurring task should next appear.
 * Date utilities are injected to support versioned dynamic imports.
 *
 * @module recurringCalculators
 */

// ============================================
// INJECTED DEPENDENCIES (via setDateUtils / setNormalizer / setLabelResolver)
// ============================================
//
// NOTE: normalizeRecurringSettings is injected via setNormalizer() instead of
// a static import. This avoids the dual-instance problem documented in MEMORY.md:
// recurringCore loads this module dynamically with ?v= cache-busting, so a static
// import of recurringSettings.js would resolve to a SEPARATE unversioned instance
// with its own normalization cache.
//

let _dateUtils = null;
let _normalizeSettings = null;
// Fallback: return interpolated key if label resolver not yet injected (e.g., tests)
let _getLabel = (key, opts) => {
    const base = key.split('.').pop() || key;
    if (opts?.vars) {
        return Object.entries(opts.vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), base);
    }
    return base;
};

/**
 * Set date utilities (called by recurringCore after loading sub-modules)
 * @param {Object} utils - Date utility functions
 * @returns {void}
 */
export function setDateUtils(utils) {
    _dateUtils = utils;
}

/**
 * Set normalizer function (called by recurringCore after loading sub-modules)
 * @param {Function} fn - normalizeRecurringSettings function
 * @returns {void}
 */
export function setNormalizer(fn) {
    _normalizeSettings = fn;
}

/**
 * Set label resolver (called by recurringCore after loading sub-modules)
 * @param {Function} fn - getLabel function from labelResolver
 * @returns {void}
 */
export function setLabelResolver(fn) {
    _getLabel = fn;
}

// Helper getters for cleaner code
const getDateUtils = () => {
    if (!_dateUtils) {
        throw new Error('recurringCalculators: Date utilities not initialized. Call setDateUtils first.');
    }
    return _dateUtils;
};

// ============================================
// FREQUENCY-SPECIFIC CALCULATORS
// ============================================

/**
 * Calculate next hourly occurrence
 * @param {Object} hourlySettings - Hourly settings { useSpecificMinute, minute }
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
export function calculateNextHourly(hourlySettings, from) {
    const next = getDateUtils().cloneDate(from);

    if (hourlySettings?.useSpecificMinute) {
        const targetMinute = hourlySettings.minute || 0;

        // Set to target minute
        next.setMinutes(targetMinute, 0, 0);

        // If this minute already passed this hour, move to next hour
        if (next <= from) {
            next.setHours(next.getHours() + 1);
        }
    } else {
        // Default: top of next hour
        next.setHours(next.getHours() + 1, 0, 0, 0);
    }

    return next.getTime();
}

/**
 * Calculate next daily occurrence
 * @param {Object} timeSettings - Time settings { hour, minute, meridiem, military }
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
export function calculateNextDaily(timeSettings, from) {
    const next = getDateUtils().cloneDate(from);

    if (timeSettings) {
        getDateUtils().applyTimeToDate(next, timeSettings);

        // If time already passed today, move to tomorrow
        if (next <= from) {
            next.setDate(next.getDate() + 1);
        }
    } else {
        // No specific time - next occurrence is start of tomorrow
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
    }

    return next.getTime();
}

/**
 * Calculate next weekly occurrence
 * @param {Object} weeklySettings - Weekly settings { days: ["Mon", "Wed", "Fri"] }
 * @param {Object} timeSettings - Time settings
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
export function calculateNextWeekly(weeklySettings, timeSettings, from) {
    const targetDays = weeklySettings?.days || [];

    // Safety fallback: normalizer should have defaulted empty days to weekdays
    if (targetDays.length === 0) {
        return calculateNextDaily(timeSettings, from);
    }

    // Try each day in the next 8 days (covers a full week + today)
    for (let i = 0; i <= 7; i++) {
        const testDate = getDateUtils().cloneDate(from);
        testDate.setDate(from.getDate() + i);

        const weekday = testDate.toLocaleDateString("en-US", { weekday: "short" });

        if (targetDays.includes(weekday)) {
            getDateUtils().applyTimeToDate(testDate, timeSettings);

            // Only return if this occurrence is in the future
            if (testDate > from) {
                return testDate.getTime();
            }
        }
    }

    // Fallback: next week, same day
    const fallback = getDateUtils().cloneDate(from);
    fallback.setDate(from.getDate() + 7);
    getDateUtils().applyTimeToDate(fallback, timeSettings);
    return fallback.getTime();
}

/**
 * Calculate next biweekly occurrence
 * @param {Object} biweeklySettings - Biweekly settings { week1: ["Mon", "Wed"], week2: ["Tue", "Thu"], referenceDate }
 * @param {Object} timeSettings - Time settings
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
export function calculateNextBiweekly(biweeklySettings, timeSettings, from) {
    const week1Days = biweeklySettings?.week1 || [];
    const week2Days = biweeklySettings?.week2 || [];
    const referenceDate = biweeklySettings?.referenceDate
        ? new Date(biweeklySettings.referenceDate)
        : from;

    // Safety fallback: normalizer should have defaulted empty weeks to weekdays
    if (week1Days.length === 0 && week2Days.length === 0) {
        // Calculate if we're in an even week (DST-safe)
        const daysSinceReference = getDateUtils().getDaysBetween(referenceDate, from);
        const weeksSinceReference = Math.floor(daysSinceReference / 7);

        if (weeksSinceReference % 2 === 0) {
            // We're in an even week (Week 1) - next occurrence is tomorrow
            return calculateNextDaily(timeSettings, from);
        } else {
            // We're in an odd week (Week 2) - next occurrence is start of next even week
            const next = getDateUtils().cloneDate(from);
            const daysUntilNextEvenWeek = 7 - (daysSinceReference % 7);
            next.setDate(from.getDate() + daysUntilNextEvenWeek);
            getDateUtils().applyTimeToDate(next, timeSettings);
            return next.getTime();
        }
    }

    // Try each day in the next 15 days (covers 2+ weeks)
    for (let i = 0; i <= 14; i++) {
        const testDate = getDateUtils().cloneDate(from);
        testDate.setDate(from.getDate() + i);

        // Check if we're in Week 1 (even weeks) or Week 2 (odd weeks) relative to reference (DST-safe)
        const daysSinceReference = getDateUtils().getDaysBetween(referenceDate, testDate);
        const weeksSinceReference = Math.floor(daysSinceReference / 7);
        const isWeek1 = weeksSinceReference % 2 === 0;

        const weekday = testDate.toLocaleDateString("en-US", { weekday: "short" });

        // Check appropriate week's days
        const targetDays = isWeek1 ? week1Days : week2Days;

        if (targetDays.includes(weekday)) {
            getDateUtils().applyTimeToDate(testDate, timeSettings);

            if (testDate > from) {
                return testDate.getTime();
            }
        }
    }

    // Fallback: 2 weeks from now
    const fallback = getDateUtils().cloneDate(from);
    fallback.setDate(from.getDate() + 14);
    getDateUtils().applyTimeToDate(fallback, timeSettings);
    return fallback.getTime();
}

/**
 * Calculate next monthly occurrence
 * @param {Object} monthlySettings - Monthly settings { useSpecificDays, days, lastDay, useWeekOfMonth, weekOfMonth }
 * @param {Object} timeSettings - Time settings
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
export function calculateNextMonthly(monthlySettings, timeSettings, from) {
    const currentMonth = from.getMonth();
    const currentYear = from.getFullYear();

    // PATTERN 1: Week-of-month pattern (e.g., "2nd Tuesday", "Last Friday")
    if (monthlySettings?.useWeekOfMonth && monthlySettings?.weekOfMonth) {
        const { ordinal, day } = monthlySettings.weekOfMonth;

        // Try current month first
        const thisMonthDate = getDateUtils().calculateNthWeekdayOfMonth(currentYear, currentMonth, day, ordinal);
        if (thisMonthDate) {
            getDateUtils().applyTimeToDate(thisMonthDate, timeSettings);
            if (thisMonthDate > from) {
                return thisMonthDate.getTime();
            }
        }

        // Try next month
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
        }

        const nextMonthDate = getDateUtils().calculateNthWeekdayOfMonth(nextYear, nextMonth, day, ordinal);
        if (nextMonthDate) {
            getDateUtils().applyTimeToDate(nextMonthDate, timeSettings);
            return nextMonthDate.getTime();
        }

        // Fallback if pattern doesn't exist
        const fallback = new Date(nextYear, nextMonth, 1);
        getDateUtils().applyTimeToDate(fallback, timeSettings);
        return fallback.getTime();
    }

    // PATTERN 2: Specific days with optional last day
    if (monthlySettings?.useSpecificDays) {
        const targetDays = monthlySettings?.days || [];
        const includeLastDay = monthlySettings?.lastDay || false;

        // Build list of target dates for this month
        const thisMonthDates = [];

        // Add specific days
        for (const day of targetDays) {
            if (getDateUtils().isValidDate(currentYear, currentMonth, day)) {
                const testDate = new Date(currentYear, currentMonth, day);
                thisMonthDates.push(testDate);
            }
        }

        // Add last day if enabled
        if (includeLastDay) {
            const lastDay = getDateUtils().getDaysInMonth(currentMonth, currentYear);
            const lastDayDate = new Date(currentYear, currentMonth, lastDay);
            // Only add if not already in list
            if (!thisMonthDates.some(d => d.getDate() === lastDay)) {
                thisMonthDates.push(lastDayDate);
            }
        }

        // Sort dates ascending
        thisMonthDates.sort((a, b) => a - b);

        // Try to find a date later this month
        for (const testDate of thisMonthDates) {
            getDateUtils().applyTimeToDate(testDate, timeSettings);
            if (testDate > from) {
                return testDate.getTime();
            }
        }

        // No valid date found this month - try next month
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;

        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
        }

        const nextMonthDates = [];

        // Add specific days for next month
        for (const day of targetDays) {
            if (getDateUtils().isValidDate(nextYear, nextMonth, day)) {
                const testDate = new Date(nextYear, nextMonth, day);
                nextMonthDates.push(testDate);
            }
        }

        // Add last day for next month if enabled
        if (includeLastDay) {
            const lastDay = getDateUtils().getDaysInMonth(nextMonth, nextYear);
            const lastDayDate = new Date(nextYear, nextMonth, lastDay);
            if (!nextMonthDates.some(d => d.getDate() === lastDay)) {
                nextMonthDates.push(lastDayDate);
            }
        }

        // Sort and return first date
        nextMonthDates.sort((a, b) => a - b);

        if (nextMonthDates.length > 0) {
            const firstDate = nextMonthDates[0];
            getDateUtils().applyTimeToDate(firstDate, timeSettings);
            return firstDate.getTime();
        }

        // Fallback: first day of next month
        const fallback = new Date(nextYear, nextMonth, 1);
        getDateUtils().applyTimeToDate(fallback, timeSettings);
        return fallback.getTime();
    }

    // PATTERN 3: Safety fallback — normalizer should have set useSpecificDays + days
    return calculateNextDaily(timeSettings, from);
}

/**
 * Calculate next yearly occurrence
 * @param {Object} yearlySettings - Yearly settings { months: [1, 6, 12], daysByMonth, applyDaysToAll, useSpecificDays }
 * @param {Object} timeSettings - Time settings
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
export function calculateNextYearly(yearlySettings, timeSettings, from) {
    const targetMonths = yearlySettings?.months || [];
    const daysByMonth = yearlySettings?.daysByMonth || {};
    const applyDaysToAll = yearlySettings?.applyDaysToAll !== false;
    const useSpecificDays = yearlySettings?.useSpecificDays !== false;

    const currentMonth = from.getMonth() + 1; // Convert to 1-12
    const currentYear = from.getFullYear();

    // Safety fallback: normalizer should have defaulted empty months to current month
    if (targetMonths.length === 0) {
        const monthlyDays = applyDaysToAll ? (daysByMonth.all || []) : [];
        return calculateNextMonthly({ useSpecificDays: true, days: monthlyDays }, timeSettings, from);
    }

    // Sort months ascending
    const sortedMonths = [...targetMonths].sort((a, b) => a - b);

    // Get days for a specific month
    const getDaysForMonth = (month) => {
        if (!useSpecificDays) return []; // No specific days - any day of month
        if (applyDaysToAll) return daysByMonth.all || [];
        return daysByMonth[month] || [];
    };

    // Try to find next occurrence this year
    for (const month of sortedMonths) {
        if (month < currentMonth) continue; // Skip past months

        const days = getDaysForMonth(month);

        if (days.length === 0) {
            // No specific days - first day of month
            const testDate = new Date(currentYear, month - 1, 1);
            getDateUtils().applyTimeToDate(testDate, timeSettings);

            if (testDate > from) {
                return testDate.getTime();
            }
        } else {
            // Check each target day in this month
            const sortedDays = [...days].sort((a, b) => a - b);

            for (const day of sortedDays) {
                if (getDateUtils().isValidDate(currentYear, month - 1, day)) {
                    const testDate = new Date(currentYear, month - 1, day);
                    getDateUtils().applyTimeToDate(testDate, timeSettings);

                    if (testDate > from) {
                        return testDate.getTime();
                    }
                }
            }
        }
    }

    // No occurrence found this year - try next year
    const nextYear = currentYear + 1;
    const firstMonth = sortedMonths[0];
    const days = getDaysForMonth(firstMonth);

    if (days.length === 0) {
        // First day of first month next year
        const nextDate = new Date(nextYear, firstMonth - 1, 1);
        getDateUtils().applyTimeToDate(nextDate, timeSettings);
        return nextDate.getTime();
    } else {
        // First valid day in first month next year
        const sortedDays = [...days].sort((a, b) => a - b);

        for (const day of sortedDays) {
            if (getDateUtils().isValidDate(nextYear, firstMonth - 1, day)) {
                const nextDate = new Date(nextYear, firstMonth - 1, day);
                getDateUtils().applyTimeToDate(nextDate, timeSettings);
                return nextDate.getTime();
            }
        }
    }

    // Fallback: 1 year from now
    const fallback = getDateUtils().cloneDate(from);
    fallback.setFullYear(nextYear);
    getDateUtils().applyTimeToDate(fallback, timeSettings);
    return fallback.getTime();
}

/**
 * Calculate next occurrence from specific dates
 * @param {Array<string>} dates - Array of date strings ["2025-10-15", "2025-10-22"]
 * @param {Date} from - Calculate from this time
 * @param {Object} timeSettings - Time settings
 * @returns {number|null} Unix timestamp of next occurrence, or null if no future dates
 */
export function calculateNextSpecificDate(dates, from, timeSettings) {
    if (!dates || dates.length === 0) {
        return null;
    }

    // Parse all dates and filter to future ones
    const futureDates = dates
        .map(dateStr => {
            const date = getDateUtils().parseDateAsLocal(dateStr);
            if (!date) return null;
            getDateUtils().applyTimeToDate(date, timeSettings);
            return date;
        })
        .filter(date => date && date > from)
        .sort((a, b) => a - b); // Sort ascending

    if (futureDates.length === 0) {
        return null; // No future dates
    }

    return futureDates[0].getTime(); // Return earliest future date
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Calculate the next occurrence timestamp for a recurring task
 *
 * This is the main entry point for calculating when a recurring task
 * should next appear. It handles all frequency types and edge cases.
 *
 * @param {Object} settings - Recurring settings object
 * @param {Date|number} fromTime - Calculate from this time (default: now)
 * @returns {number|null} Unix timestamp of next occurrence, or null if cannot calculate
 * @example
 * // Daily task at 9:00 AM
 * const next = calculateNextOccurrence({
 *     frequency: 'daily',
 *     time: { hour: 9, minute: 0, meridiem: 'AM' }
 * });
 * console.log(new Date(next)); // Tomorrow at 9:00 AM
 *
 * @example
 * // Weekly task on Mon/Wed/Fri
 * const next = calculateNextOccurrence({
 *     frequency: 'weekly',
 *     weekly: { days: ['Mon', 'Wed', 'Fri'] },
 *     time: { hour: 10, minute: 30, meridiem: 'AM' }
 * });
 */
export function calculateNextOccurrence(settings, fromTime = Date.now()) {
    if (!settings) {
        console.error('calculateNextOccurrence: No settings provided');
        return null;
    }

    // Normalize to enforce defaults for empty selections (handles legacy data
    // saved before the empty-selection fix was added to the normalizer)
    if (!_normalizeSettings) {
        throw new Error('recurringCalculators: Normalizer not initialized. Call setNormalizer first.');
    }
    settings = _normalizeSettings(settings);

    const from = new Date(fromTime);

    // Validate from date
    if (isNaN(from.getTime())) {
        console.error('calculateNextOccurrence: Invalid fromTime:', fromTime);
        return null;
    }

    try {
        // SPECIFIC DATES OVERRIDE ALL OTHER SETTINGS
        if (settings.specificDates?.enabled && settings.specificDates?.dates?.length > 0) {
            const next = calculateNextSpecificDate(
                settings.specificDates.dates,
                from,
                settings.time
            );

            if (next === null) {
            }

            return next;
        }

        // FREQUENCY-BASED CALCULATION
        const frequency = settings.frequency || 'daily';
        const timeSettings = settings.time || null;

        switch (frequency) {
            case 'hourly':
                return calculateNextHourly(settings.hourly, from);

            case 'daily':
                return calculateNextDaily(timeSettings, from);

            case 'weekly':
                return calculateNextWeekly(settings.weekly, timeSettings, from);

            case 'biweekly':
                return calculateNextBiweekly(settings.biweekly, timeSettings, from);

            case 'monthly':
                return calculateNextMonthly(settings.monthly, timeSettings, from);

            case 'yearly':
                return calculateNextYearly(settings.yearly, timeSettings, from);

            default:
                console.warn('calculateNextOccurrence: Unknown frequency:', frequency);
                // Fallback: tomorrow
                return calculateNextDaily(null, from);
        }

    } catch (error) {
        console.error('calculateNextOccurrence: Calculation failed:', error);
        // Fallback: 24 hours from now
        return from.getTime() + (24 * 60 * 60 * 1000);
    }
}

/**
 * Calculate multiple future occurrences for a recurring task
 * Useful for calendar view or showing upcoming schedule
 *
 * @param {Object} settings - Recurring settings object
 * @param {number} count - Number of occurrences to calculate
 * @param {Date|number} fromTime - Calculate from this time (default: now)
 * @returns {Array<number>} Array of timestamps for next occurrences
 */
export function calculateNextOccurrences(settings, count = 5, fromTime = Date.now()) {
    const occurrences = [];
    let currentTime = fromTime;

    for (let i = 0; i < count; i++) {
        const next = calculateNextOccurrence(settings, currentTime);

        if (next === null) {
            break; // No more occurrences (e.g., specific dates exhausted)
        }

        occurrences.push(next);
        currentTime = next + 1000; // Move 1 second past this occurrence
    }

    return occurrences;
}

/**
 * Get human-readable description of next occurrence
 *
 * @param {number|null} nextOccurrence - Unix timestamp of next occurrence
 * @returns {string} Human-readable string like "Tomorrow at 9:00 AM"
 * @example
 * const next = calculateNextOccurrence(settings);
 * console.log(formatNextOccurrence(next));
 * // "Appears in 2 hours" or "Next: Tomorrow at 9:00 AM"
 */
export function formatNextOccurrence(nextOccurrence) {
    if (!nextOccurrence) {
        return _getLabel('recurring.nextNone');
    }

    const next = new Date(nextOccurrence);
    const now = new Date();
    const msUntil = next - now;

    // Overdue
    if (msUntil < 0) {
        return _getLabel('recurring.nextOverdue');
    }

    // Less than 1 minute
    if (msUntil < 60000) {
        return _getLabel('recurring.nextUnderMinute');
    }

    // Less than 1 hour
    if (msUntil < 3600000) {
        const count = Math.floor(msUntil / 60000);
        const unit = _getLabel('recurring.nextMinuteUnit', { count });
        return _getLabel('recurring.nextMinutes', { vars: { count, unit } });
    }

    // Less than 24 hours
    if (msUntil < 86400000) {
        const count = Math.floor(msUntil / 3600000);
        const unit = _getLabel('recurring.nextHourUnit', { count });
        return _getLabel('recurring.nextHours', { vars: { count, unit } });
    }

    // Beyond 24 hours - show specific date/time
    const timeStr = next.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    // Check if it's tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    if (next.getDate() === tomorrow.getDate() &&
        next.getMonth() === tomorrow.getMonth() &&
        next.getFullYear() === tomorrow.getFullYear()) {
        return _getLabel('recurring.nextTomorrow', { vars: { time: timeStr } });
    }

    // Check if it's within this week (next 7 days)
    if (msUntil < 604800000) {
        const weekday = next.toLocaleDateString(undefined, { weekday: 'long' });
        return _getLabel('recurring.nextWeekday', { vars: { weekday, time: timeStr } });
    }

    // Further out - show full date (include year for clarity)
    const dateStr = next.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return _getLabel('recurring.nextDate', { vars: { date: dateStr, time: timeStr } });
}

