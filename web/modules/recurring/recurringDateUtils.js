/**
 * miniCycle Recurring Tasks - Date Utilities
 *
 * Pure date helper functions for recurring task calculations.
 * No side effects, no dependencies - easily testable.
 *
 * @module recurringDateUtils
 */

// ============================================
// TIME CONVERSION
// ============================================

/**
 * Convert 12-hour time to 24-hour format
 * @param {number} hour - Hour in 12-hour format (1-12)
 * @param {string} meridiem - "AM" or "PM"
 * @returns {number} Hour in 24-hour format (0-23)
 */
export function convert12To24(hour, meridiem) {
    hour = parseInt(hour, 10);
    if (meridiem === "PM" && hour !== 12) return hour + 12;
    if (meridiem === "AM" && hour === 12) return 0;
    return hour;
}

// ============================================
// DATE PARSING
// ============================================

/**
 * Parse date string as local date (not UTC)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Parsed date object
 */
export function parseDateAsLocal(dateStr) {
    console.log('📅 Parsing date as local:', dateStr);

    try {
        const [year, month, day] = dateStr.split("-").map(Number);
        const result = new Date(year, month - 1, day); // month is 0-indexed

        console.log('✅ Date parsed successfully:', result);
        return result;
    } catch (error) {
        console.error('❌ Error parsing date:', error);
        return new Date(); // fallback to today
    }
}

// ============================================
// DATE ARITHMETIC
// ============================================

/**
 * Get the number of days in a month
 * @param {number} month - Month (0-11, JavaScript style)
 * @param {number} year - Year
 * @returns {number} Number of days in month
 */
export function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Check if a date is valid
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @param {number} day - Day (1-31)
 * @returns {boolean} True if date is valid
 */
export function isValidDate(year, month, day) {
    const daysInMonth = getDaysInMonth(month, year);
    return day >= 1 && day <= daysInMonth;
}

/**
 * Calculate days between two dates in a DST-safe manner
 * Uses calendar date arithmetic instead of raw milliseconds to avoid DST issues
 * @param {Date} startDate - Earlier date
 * @param {Date} endDate - Later date
 * @returns {number} Number of calendar days between dates
 */
export function getDaysBetween(startDate, endDate) {
    // Normalize both dates to midnight UTC to eliminate DST effects
    const start = new Date(Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
    ));
    const end = new Date(Date.UTC(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
    ));

    // Now we can safely use millisecond arithmetic in UTC
    const millisecondsDiff = end - start;
    return Math.floor(millisecondsDiff / (1000 * 60 * 60 * 24));
}

/**
 * Clone a date object
 * @param {Date} date - Date to clone
 * @returns {Date} Cloned date
 */
export function cloneDate(date) {
    return new Date(date.getTime());
}

/**
 * Check if a date is the last day of its month
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is last day of month
 */
export function isLastDayOfMonth(date) {
    const lastDay = getDaysInMonth(date.getMonth(), date.getFullYear());
    return date.getDate() === lastDay;
}

// ============================================
// TIME APPLICATION
// ============================================

/**
 * Apply time settings to a date
 * @param {Date} date - Date to modify (modifies in place)
 * @param {Object} timeSettings - Time settings object
 * @returns {Date} Modified date (same reference)
 */
export function applyTimeToDate(date, timeSettings) {
    if (!timeSettings) {
        // No specific time - set to start of day
        date.setHours(0, 0, 0, 0);
        return date;
    }

    const { hour, minute, meridiem, military } = timeSettings;

    if (military) {
        date.setHours(hour, minute, 0, 0);
    } else {
        const hour24 = convert12To24(hour, meridiem);
        date.setHours(hour24, minute, 0, 0);
    }

    return date;
}

// ============================================
// WEEKDAY CALCULATIONS
// ============================================

/**
 * Weekday name to index mapping
 */
export const WEEKDAY_MAP = {
    "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3,
    "Thu": 4, "Fri": 5, "Sat": 6
};

/**
 * Calculate the date of the nth occurrence of a weekday in a month
 * @param {number} year - Year
 * @param {number} month - Month (0-11, JavaScript style)
 * @param {string} weekday - Weekday short name ("Sun", "Mon", ..., "Sat")
 * @param {string|number} ordinal - Ordinal ("1", "2", "3", "4", "last")
 * @returns {Date|null} Date of the nth weekday, or null if doesn't exist
 */
export function calculateNthWeekdayOfMonth(year, month, weekday, ordinal) {
    const targetDay = WEEKDAY_MAP[weekday];
    if (targetDay === undefined) return null;

    // Handle "last" occurrence
    if (ordinal === "last") {
        // Start from last day of month and work backwards
        const lastDay = getDaysInMonth(month, year);
        for (let day = lastDay; day >= 1; day--) {
            const testDate = new Date(year, month, day);
            if (testDate.getDay() === targetDay) {
                return testDate;
            }
        }
        return null;
    }

    // Handle numbered occurrence (1st, 2nd, 3rd, 4th)
    const ordinalNum = parseInt(ordinal, 10);
    if (isNaN(ordinalNum) || ordinalNum < 1 || ordinalNum > 4) return null;

    let occurrenceCount = 0;
    const daysInMonth = getDaysInMonth(month, year);

    for (let day = 1; day <= daysInMonth; day++) {
        const testDate = new Date(year, month, day);
        if (testDate.getDay() === targetDay) {
            occurrenceCount++;
            if (occurrenceCount === ordinalNum) {
                return testDate;
            }
        }
    }

    // Requested occurrence doesn't exist (e.g., 5th Monday when month only has 4)
    return null;
}

console.log('📅 RecurringDateUtils module loaded');
