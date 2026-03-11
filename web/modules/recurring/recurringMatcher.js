/**
 * miniCycle Recurring Tasks - Pattern Matching
 *
 * Pure functions for determining if a recurring task should appear now.
 * Date utilities are injected to support versioned dynamic imports.
 *
 * @module recurringMatcher
 */

// ============================================
// DATE UTILITIES (injected via setDateUtils)
// ============================================

let _dateUtils = null;

/**
 * Set date utilities (called by recurringCore after loading sub-modules)
 * @param {Object} utils - Date utility functions
 */
export function setDateUtils(utils) {
    _dateUtils = utils;
}

// Helper getter for cleaner code
const getDateUtils = () => {
    if (!_dateUtils) {
        throw new Error('recurringMatcher: Date utilities not initialized. Call setDateUtils first.');
    }
    return _dateUtils;
};

// ============================================
// MAIN PATTERN MATCHING
// ============================================

/**
 * Determine if a task should recur now based on its settings
 * @param {Object} settings - Recurring settings object
 * @param {Date} now - Current date/time (for testing)
 * @returns {boolean} True if task should appear now
 */
export function shouldTaskRecurNow(settings, now = new Date()) {
    // END DATE VALIDATION: Check if we're past the end date
    if (settings.untilDate) {
        const endDate = getDateUtils().parseDateAsLocal(settings.untilDate);
        // Set end date to end of day (23:59:59) for comparison
        endDate.setHours(23, 59, 59, 999);

        if (now > endDate) {
            return false; // Past the end date, don't recur
        }
    }

    // Specific Dates override all... but still honor specific-time if set
    if (settings.specificDates?.enabled) {
        const todayMatch = settings.specificDates.dates?.some(dateStr => {
            const date = getDateUtils().parseDateAsLocal(dateStr);
            return date.getFullYear() === now.getFullYear()
                && date.getMonth()  === now.getMonth()
                && date.getDate()   === now.getDate();
        });
        if (!todayMatch) return false;

        // Only trigger at the exact time if the user checked "specific time"
        if (settings.time) {
            const hour   = settings.time.military
                ? settings.time.hour
                : getDateUtils().convert12To24(settings.time.hour, settings.time.meridiem);
            const minute = settings.time.minute;
            return now.getHours() === hour && now.getMinutes() === minute;
        }

        return true;
    }

    const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
    const day = now.getDate();
    const month = now.getMonth() + 1;

    switch (settings.frequency) {
        case "daily":
            return matchDaily(settings, now);

        case "weekly":
            return matchWeekly(settings, now, weekday);

        case "biweekly":
            return matchBiweekly(settings, now, weekday);

        case "monthly":
            return matchMonthly(settings, now, day);

        case "yearly":
            return matchYearly(settings, now, day, month);

        case "hourly":
            return matchHourly(settings, now);

        default:
            return false;
    }
}

// ============================================
// FREQUENCY-SPECIFIC MATCHERS
// ============================================

/**
 * Match daily frequency
 */
function matchDaily(settings, now) {
    if (settings.time) {
        const hour = settings.time.military
            ? settings.time.hour
            : getDateUtils().convert12To24(settings.time.hour, settings.time.meridiem);
        const minute = settings.time.minute;
        return now.getHours() === hour && now.getMinutes() === minute;
    }
    // Without specific time, recur once per day (tracked by lastTriggeredTimestamp)
    return true;
}

/**
 * Match weekly frequency
 */
function matchWeekly(settings, now, weekday) {
    // If no specific days selected, recur every day of the week
    if (settings.weekly?.days?.length > 0 && !settings.weekly.days.includes(weekday)) {
        return false;
    }

    if (settings.time) {
        const hour = settings.time.military
            ? settings.time.hour
            : getDateUtils().convert12To24(settings.time.hour, settings.time.meridiem);
        const minute = settings.time.minute;
        return now.getHours() === hour && now.getMinutes() === minute;
    }

    return true; // if no time set, recur any time today
}

/**
 * Match biweekly frequency
 */
function matchBiweekly(settings, now, weekday) {
    // Calculate which week we're in relative to reference date (DST-safe)
    const referenceDate = new Date(settings.biweekly.referenceDate);
    const daysSinceReference = getDateUtils().getDaysBetween(referenceDate, now);
    const weeksSinceReference = Math.floor(daysSinceReference / 7);
    const isWeek1 = weeksSinceReference % 2 === 0;

    // Get the appropriate week's days
    const week1Days = settings.biweekly?.week1 || [];
    const week2Days = settings.biweekly?.week2 || [];
    const currentWeekDays = isWeek1 ? week1Days : week2Days;

    // If specific days are set for this week, check if today matches
    if (currentWeekDays.length > 0 && !currentWeekDays.includes(weekday)) {
        return false;
    }

    // If no days set for this week, don't trigger
    if (currentWeekDays.length === 0) {
        return false;
    }

    if (settings.time) {
        const hour = settings.time.military
            ? settings.time.hour
            : getDateUtils().convert12To24(settings.time.hour, settings.time.meridiem);
        const minute = settings.time.minute;
        return now.getHours() === hour && now.getMinutes() === minute;
    }

    return true; // if no time set, recur any time today
}

/**
 * Match monthly frequency
 */
function matchMonthly(settings, now, day) {
    // PATTERN 1: Week-of-month pattern (e.g., "2nd Tuesday", "Last Friday")
    if (settings.monthly?.useWeekOfMonth && settings.monthly?.weekOfMonth) {
        const { ordinal, day: targetWeekday } = settings.monthly.weekOfMonth;

        // Calculate what date the pattern refers to this month
        const targetDate = getDateUtils().calculateNthWeekdayOfMonth(
            now.getFullYear(),
            now.getMonth(),
            targetWeekday,
            ordinal
        );

        // Check if today matches the pattern
        if (!targetDate || targetDate.getDate() !== day) {
            return false;
        }

        // Date matches, now check time if specified
        if (settings.time) {
            const hour = settings.time.military
                ? settings.time.hour
                : getDateUtils().convert12To24(settings.time.hour, settings.time.meridiem);
            const minute = settings.time.minute;
            return now.getHours() === hour && now.getMinutes() === minute;
        }

        return true;
    }

    // PATTERN 2: Specific days with optional last day
    if (settings.monthly?.useSpecificDays) {
        const targetDays = settings.monthly?.days || [];
        const includeLastDay = settings.monthly?.lastDay || false;

        let dayMatches = false;

        // Check if today is one of the specific days
        if (targetDays.length > 0 && targetDays.includes(day)) {
            dayMatches = true;
        }

        // Check if today is the last day and lastDay is enabled
        if (includeLastDay && getDateUtils().isLastDayOfMonth(now)) {
            dayMatches = true;
        }

        if (!dayMatches) {
            return false;
        }

        // Day matches, now check time if specified
        if (settings.time) {
            const hour = settings.time.military
                ? settings.time.hour
                : getDateUtils().convert12To24(settings.time.hour, settings.time.meridiem);
            const minute = settings.time.minute;
            return now.getHours() === hour && now.getMinutes() === minute;
        }

        return true;
    }

    // PATTERN 3: No specific pattern - recur every day
    if (settings.time) {
        const hour = settings.time.military
            ? settings.time.hour
            : getDateUtils().convert12To24(settings.time.hour, settings.time.meridiem);
        const minute = settings.time.minute;
        return now.getHours() === hour && now.getMinutes() === minute;
    }

    return true; // If no pattern and no time, trigger any time any day
}

/**
 * Match yearly frequency
 */
function matchYearly(settings, now, day, month) {
    // If no specific months selected, recur every month of the year
    if (settings.yearly?.months?.length > 0 && !settings.yearly.months.includes(month)) {
        return false;
    }

    // Fix #73: Add optional chaining to prevent null dereference
    if (settings.yearly?.useSpecificDays) {
        const daysByMonth = settings.yearly.daysByMonth || {};
        const days = settings.yearly.applyDaysToAll
            ? daysByMonth.all || []
            : daysByMonth[month] || [];

        // If no specific days selected, recur every day of the month
        if (days.length > 0 && !days.includes(day)) {
            return false;
        }
    }

    if (settings.time) {
        const hour = settings.time.military
            ? settings.time.hour
            : getDateUtils().convert12To24(settings.time.hour, settings.time.meridiem);
        const minute = settings.time.minute;
        return now.getHours() === hour && now.getMinutes() === minute;
    }

    return true; // If no time is set, recur any time that day
}

/**
 * Match hourly frequency
 */
function matchHourly(settings, now) {
    if (settings.hourly?.useSpecificMinute) {
        const minute = now.getMinutes();
        return minute === settings.hourly.minute;
    }
    return now.getMinutes() === 0;
}

// ============================================
// TASK RECREATION CHECK
// ============================================

/**
 * Check if a recurring task should be recreated
 * @param {Object} template - Recurring task template
 * @param {Array} taskList - Current task list
 * @param {Date} now - Current date/time
 * @returns {boolean} True if task should be recreated
 */
export function shouldRecreateRecurringTask(template, taskList, now) {
    const { id, text, recurringSettings, recurring, lastTriggeredTimestamp, suppressUntil } = template;

    if (!recurring || !recurringSettings) return false;

    // Already exists?
    if (taskList.some(task => task.id === id)) return false;

    // Suppressed?
    if (suppressUntil && new Date(suppressUntil) > now) {
        return false;
    }

    // Triggered recently?
    if (lastTriggeredTimestamp) {
        const last = new Date(lastTriggeredTimestamp);
        const sameMinute =
            last.getFullYear() === now.getFullYear() &&
            last.getMonth()    === now.getMonth()    &&
            last.getDate()     === now.getDate()     &&
            last.getHours()    === now.getHours()    &&
            last.getMinutes()  === now.getMinutes();
        if (sameMinute) return false;
    }

    // Recurrence match?
    return shouldTaskRecurNow(recurringSettings, now);
}

