/**
 * miniCycle Recurring Tasks - Core Scheduling Engine
 *
 * Pattern: Strict Dependency Injection 🔧
 * Purpose: Mission-critical business logic for recurring task scheduling
 *
 * This module handles:
 * - Recurring task scheduling and pattern matching
 * - Template management and lifecycle
 * - Task activation/deactivation logic
 * - Cycle reset integration
 *
 * @module recurringCore
 * @version 1.341
 * @requires AppState (via dependency injection)
 * @requires AppInit (for initialization coordination)
 */

import { appInit } from './appInitialization.js';

// ============================================
// DEPENDENCY INJECTION SETUP
// ============================================

/**
 * Dependency container for all external functions
 * All dependencies MUST be injected before using this module
 */
const Deps = {
    // State management
    getAppState: null,        // () => AppState.get()
    updateAppState: null,     // (updateFn) => AppState.update(updateFn)
    isAppStateReady: null,    // () => AppState.isReady()

    // Data operations (legacy - for backwards compatibility)
    loadData: null,           // () => loadMiniCycleData()

    // Notifications
    showNotification: null,   // (msg, type, duration) => showNotification()

    // DOM operations
    querySelector: null,      // (selector) => document.querySelector(selector)

    // UI callbacks (optional - for panel updates)
    updateRecurringPanel: null,        // () => updateRecurringPanel()
    updateRecurringSummary: null,      // () => updateRecurringSummary()
    updatePanelButtonVisibility: null, // () => updateRecurringPanelButtonVisibility()
    refreshUIFromState: null,          // () => refreshUIFromState() - refresh DOM after data changes

    // Time/scheduling
    now: null,                // () => Date.now()
    setInterval: null,        // (fn, ms) => setInterval(fn, ms)

    // Feature flags
    isEnabled: null           // () => FeatureFlags.recurringEnabled
};

/**
 * Configure dependencies for the recurring core module
 * @param {Object} overrides - Dependency overrides
 * @throws {Error} If called multiple times (prevents accidental reconfiguration)
 */
export function setRecurringCoreDependencies(overrides = {}) {
    Object.assign(Deps, overrides);
    console.log('🔧 RecurringCore dependencies configured');
}

/**
 * Ensure a dependency is available, throw clear error if not
 * @param {string} name - Dependency name for error message
 * @param {*} value - The dependency value to check
 * @throws {Error} If dependency is missing
 */
function assertInjected(name, value) {
    if (typeof value !== 'function') {
        throw new Error(`recurringCore: missing required dependency '${name}'. Call setRecurringCoreDependencies() first.`);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert 12-hour time to 24-hour format
 * @param {number} hour - Hour in 12-hour format (1-12)
 * @param {string} meridiem - "AM" or "PM"
 * @returns {number} Hour in 24-hour format (0-23)
 */
function convert12To24(hour, meridiem) {
    hour = parseInt(hour, 10);
    if (meridiem === "PM" && hour !== 12) return hour + 12;
    if (meridiem === "AM" && hour === 12) return 0;
    return hour;
}

/**
 * Parse date string as local date (not UTC)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Parsed date object
 */
function parseDateAsLocal(dateStr) {
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

/**
 * Normalize recurring settings with all required fields
 * @param {Object} settings - Partial recurring settings
 * @returns {Object} Normalized settings with defaults
 */
export function normalizeRecurringSettings(settings = {}) {
    return {
        frequency: settings.frequency || "daily",
        indefinitely: settings.indefinitely !== false,
        count: settings.count ?? null,
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
            days: Array.isArray(settings.biweekly?.days) ? settings.biweekly.days : [],
            // Reference date to calculate which week we're in (defaults to creation date)
            referenceDate: settings.biweekly?.referenceDate || new Date().toISOString()
        },

        monthly: {
            days: Array.isArray(settings.monthly?.days) ? settings.monthly.days : []
        },

        yearly: {
            months: Array.isArray(settings.yearly?.months) ? settings.yearly.months : [],
            useSpecificDays: settings.yearly?.useSpecificDays || false,
            applyDaysToAll: settings.yearly?.applyDaysToAll !== false, // default is true
            daysByMonth: settings.yearly?.daysByMonth || {}
        }
    };
}

// ============================================
// NEXT OCCURRENCE CALCULATION
// ============================================

/**
 * Get the number of days in a month
 * @param {number} month - Month (0-11, JavaScript style)
 * @param {number} year - Year
 * @returns {number} Number of days in month
 */
function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Check if a date is valid
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @param {number} day - Day (1-31)
 * @returns {boolean} True if date is valid
 */
function isValidDate(year, month, day) {
    const daysInMonth = getDaysInMonth(month, year);
    return day >= 1 && day <= daysInMonth;
}

/**
 * Apply time settings to a date
 * @param {Date} date - Date to modify (modifies in place)
 * @param {Object} timeSettings - Time settings object
 * @returns {Date} Modified date (same reference)
 */
function applyTimeToDate(date, timeSettings) {
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

/**
 * Clone a date object
 * @param {Date} date - Date to clone
 * @returns {Date} Cloned date
 */
function cloneDate(date) {
    return new Date(date.getTime());
}

/**
 * Calculate next hourly occurrence
 * @param {Object} hourlySettings - Hourly settings { useSpecificMinute, minute }
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
function calculateNextHourly(hourlySettings, from) {
    const next = cloneDate(from);

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
function calculateNextDaily(timeSettings, from) {
    const next = cloneDate(from);

    if (timeSettings) {
        applyTimeToDate(next, timeSettings);

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
function calculateNextWeekly(weeklySettings, timeSettings, from) {
    const targetDays = weeklySettings?.days || [];

    // If no days specified, recur every day (fall back to daily)
    if (targetDays.length === 0) {
        return calculateNextDaily(timeSettings, from);
    }

    // Try each day in the next 8 days (covers a full week + today)
    for (let i = 0; i <= 7; i++) {
        const testDate = cloneDate(from);
        testDate.setDate(from.getDate() + i);

        const weekday = testDate.toLocaleDateString("en-US", { weekday: "short" });

        if (targetDays.includes(weekday)) {
            applyTimeToDate(testDate, timeSettings);

            // Only return if this occurrence is in the future
            if (testDate > from) {
                return testDate.getTime();
            }
        }
    }

    // Fallback: next week, same day
    const fallback = cloneDate(from);
    fallback.setDate(from.getDate() + 7);
    applyTimeToDate(fallback, timeSettings);
    return fallback.getTime();
}

/**
 * Calculate next biweekly occurrence
 * @param {Object} biweeklySettings - Biweekly settings { days: ["Mon", "Wed"], referenceDate }
 * @param {Object} timeSettings - Time settings
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
function calculateNextBiweekly(biweeklySettings, timeSettings, from) {
    const targetDays = biweeklySettings?.days || [];
    const referenceDate = biweeklySettings?.referenceDate
        ? new Date(biweeklySettings.referenceDate)
        : from;

    // If no days specified, recur every day in even weeks
    if (targetDays.length === 0) {
        // Calculate if we're in an even week
        const daysSinceReference = Math.floor((from - referenceDate) / (1000 * 60 * 60 * 24));
        const weeksSinceReference = Math.floor(daysSinceReference / 7);

        if (weeksSinceReference % 2 === 0) {
            // We're in an even week - next occurrence is tomorrow
            return calculateNextDaily(timeSettings, from);
        } else {
            // We're in an odd week - next occurrence is start of next even week
            const next = cloneDate(from);
            const daysUntilNextEvenWeek = 7 - (daysSinceReference % 7);
            next.setDate(from.getDate() + daysUntilNextEvenWeek);
            applyTimeToDate(next, timeSettings);
            return next.getTime();
        }
    }

    // Try each day in the next 15 days (covers 2+ weeks)
    for (let i = 0; i <= 14; i++) {
        const testDate = cloneDate(from);
        testDate.setDate(from.getDate() + i);

        // Check if we're in an even week relative to reference
        const daysSinceReference = Math.floor((testDate - referenceDate) / (1000 * 60 * 60 * 24));
        const weeksSinceReference = Math.floor(daysSinceReference / 7);

        if (weeksSinceReference % 2 === 0) {
            const weekday = testDate.toLocaleDateString("en-US", { weekday: "short" });

            if (targetDays.includes(weekday)) {
                applyTimeToDate(testDate, timeSettings);

                if (testDate > from) {
                    return testDate.getTime();
                }
            }
        }
    }

    // Fallback: 2 weeks from now
    const fallback = cloneDate(from);
    fallback.setDate(from.getDate() + 14);
    applyTimeToDate(fallback, timeSettings);
    return fallback.getTime();
}

/**
 * Calculate next monthly occurrence
 * @param {Object} monthlySettings - Monthly settings { days: [1, 15, 30] }
 * @param {Object} timeSettings - Time settings
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
function calculateNextMonthly(monthlySettings, timeSettings, from) {
    const targetDays = monthlySettings?.days || [];

    // If no days specified, recur every day
    if (targetDays.length === 0) {
        return calculateNextDaily(timeSettings, from);
    }

    const currentDay = from.getDate();
    const currentMonth = from.getMonth();
    const currentYear = from.getFullYear();

    // Sort target days ascending
    const sortedDays = [...targetDays].sort((a, b) => a - b);

    // Try to find a day later this month
    for (const day of sortedDays) {
        if (isValidDate(currentYear, currentMonth, day)) {
            const testDate = new Date(currentYear, currentMonth, day);
            applyTimeToDate(testDate, timeSettings);

            if (testDate > from) {
                return testDate.getTime();
            }
        }
    }

    // No valid day found this month - try next month
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;

    if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
    }

    // Try each target day in next month
    for (const day of sortedDays) {
        if (isValidDate(nextYear, nextMonth, day)) {
            const testDate = new Date(nextYear, nextMonth, day);
            applyTimeToDate(testDate, timeSettings);
            return testDate.getTime();
        }
    }

    // Fallback: first day of next month
    const fallback = new Date(nextYear, nextMonth, 1);
    applyTimeToDate(fallback, timeSettings);
    return fallback.getTime();
}

/**
 * Calculate next yearly occurrence
 * @param {Object} yearlySettings - Yearly settings { months: [1, 6, 12], daysByMonth, applyDaysToAll, useSpecificDays }
 * @param {Object} timeSettings - Time settings
 * @param {Date} from - Calculate from this time
 * @returns {number} Unix timestamp of next occurrence
 */
function calculateNextYearly(yearlySettings, timeSettings, from) {
    const targetMonths = yearlySettings?.months || [];
    const daysByMonth = yearlySettings?.daysByMonth || {};
    const applyDaysToAll = yearlySettings?.applyDaysToAll !== false;
    const useSpecificDays = yearlySettings?.useSpecificDays !== false;

    const currentMonth = from.getMonth() + 1; // Convert to 1-12
    const currentYear = from.getFullYear();

    // If no months specified, recur every month (fall back to monthly)
    if (targetMonths.length === 0) {
        const monthlyDays = applyDaysToAll ? (daysByMonth.all || []) : [];
        return calculateNextMonthly({ days: monthlyDays }, timeSettings, from);
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
            applyTimeToDate(testDate, timeSettings);

            if (testDate > from) {
                return testDate.getTime();
            }
        } else {
            // Check each target day in this month
            const sortedDays = [...days].sort((a, b) => a - b);

            for (const day of sortedDays) {
                if (isValidDate(currentYear, month - 1, day)) {
                    const testDate = new Date(currentYear, month - 1, day);
                    applyTimeToDate(testDate, timeSettings);

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
        applyTimeToDate(nextDate, timeSettings);
        return nextDate.getTime();
    } else {
        // First valid day in first month next year
        const sortedDays = [...days].sort((a, b) => a - b);

        for (const day of sortedDays) {
            if (isValidDate(nextYear, firstMonth - 1, day)) {
                const nextDate = new Date(nextYear, firstMonth - 1, day);
                applyTimeToDate(nextDate, timeSettings);
                return nextDate.getTime();
            }
        }
    }

    // Fallback: 1 year from now
    const fallback = cloneDate(from);
    fallback.setFullYear(nextYear);
    applyTimeToDate(fallback, timeSettings);
    return fallback.getTime();
}

/**
 * Calculate next occurrence from specific dates
 * @param {Array<string>} dates - Array of date strings ["2025-10-15", "2025-10-22"]
 * @param {Date} from - Calculate from this time
 * @param {Object} timeSettings - Time settings
 * @returns {number|null} Unix timestamp of next occurrence, or null if no future dates
 */
function calculateNextSpecificDate(dates, from, timeSettings) {
    if (!dates || dates.length === 0) {
        return null;
    }

    // Parse all dates and filter to future ones
    const futureDates = dates
        .map(dateStr => {
            const date = parseDateAsLocal(dateStr);
            applyTimeToDate(date, timeSettings);
            return date;
        })
        .filter(date => date > from)
        .sort((a, b) => a - b); // Sort ascending

    if (futureDates.length === 0) {
        return null; // No future dates
    }

    return futureDates[0].getTime(); // Return earliest future date
}

/**
 * Calculate the next occurrence timestamp for a recurring task
 *
 * This is the main entry point for calculating when a recurring task
 * should next appear. It handles all frequency types and edge cases.
 *
 * @param {Object} settings - Recurring settings object
 * @param {Date|number} fromTime - Calculate from this time (default: now)
 * @returns {number|null} Unix timestamp of next occurrence, or null if cannot calculate
 */
export function calculateNextOccurrence(settings, fromTime = Date.now()) {
    if (!settings) {
        console.error('calculateNextOccurrence: No settings provided');
        return null;
    }

    const from = new Date(fromTime);

    // Validate from date
    if (isNaN(from.getTime())) {
        console.error('calculateNextOccurrence: Invalid fromTime:', fromTime);
        return null;
    }

    try {
        // ✅ SPECIFIC DATES OVERRIDE ALL OTHER SETTINGS
        if (settings.specificDates?.enabled && settings.specificDates?.dates?.length > 0) {
            const next = calculateNextSpecificDate(
                settings.specificDates.dates,
                from,
                settings.time
            );

            if (next === null) {
                console.log('calculateNextOccurrence: No future specific dates found');
            }

            return next;
        }

        // ✅ FREQUENCY-BASED CALCULATION
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
 */
export function formatNextOccurrence(nextOccurrence) {
    if (!nextOccurrence) {
        return "No upcoming occurrences";
    }

    const next = new Date(nextOccurrence);
    const now = new Date();
    const msUntil = next - now;

    // Overdue
    if (msUntil < 0) {
        return "Overdue";
    }

    // Less than 1 minute
    if (msUntil < 60000) {
        return "Appears in less than 1 minute";
    }

    // Less than 1 hour
    if (msUntil < 3600000) {
        const minutes = Math.floor(msUntil / 60000);
        return `Appears in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    // Less than 24 hours
    if (msUntil < 86400000) {
        const hours = Math.floor(msUntil / 3600000);
        return `Appears in ${hours} hour${hours !== 1 ? 's' : ''}`;
    }

    // ✅ Beyond 24 hours - show specific date/time
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
        return `Next: Tomorrow at ${timeStr}`;
    }

    // Check if it's within this week (next 7 days)
    if (msUntil < 604800000) {
        const weekday = next.toLocaleDateString(undefined, { weekday: 'long' });
        return `Next: ${weekday} at ${timeStr}`;
    }

    // Further out - show full date
    const dateStr = next.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    return `Next: ${dateStr} at ${timeStr}`;
}

// ============================================
// PATTERN MATCHING LOGIC
// ============================================

/**
 * Determine if a task should recur now based on its settings
 * @param {Object} settings - Recurring settings object
 * @param {Date} now - Current date/time (for testing)
 * @returns {boolean} True if task should appear now
 */
export function shouldTaskRecurNow(settings, now = new Date()) {
    // ✅ Specific Dates override all… but still honor specific‑time if set
    if (settings.specificDates?.enabled) {
        const todayMatch = settings.specificDates.dates?.some(dateStr => {
            const date = parseDateAsLocal(dateStr);
            return date.getFullYear() === now.getFullYear()
                && date.getMonth()  === now.getMonth()
                && date.getDate()   === now.getDate();
        });
        if (!todayMatch) return false;

        // Only trigger at the exact time if the user checked "specific time"
        if (settings.time) {
            const hour   = settings.time.military
                ? settings.time.hour
                : convert12To24(settings.time.hour, settings.time.meridiem);
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
            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }
            // ✅ FIX: Without specific time, recur once per day (tracked by lastTriggeredTimestamp)
            // The watcher checks every 30 seconds, so this will trigger on first check of the day
            return true;

        case "weekly":
            // ✅ FIX: If no specific days selected, recur every day of the week
            if (settings.weekly?.days?.length > 0 && !settings.weekly.days.includes(weekday)) {
                return false;
            }

            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }

            return true; // if no time set, recur any time today

        case "biweekly":
            // ✅ FIX: If no specific days selected, recur every day of the week
            if (settings.biweekly?.days?.length > 0 && !settings.biweekly.days.includes(weekday)) {
                return false;
            }

            // ✅ Calculate which week we're in relative to reference date
            // The reference date is set when the recurring task is created.
            // Week 0 = reference week, Week 1 = next week, Week 2 = week after that, etc.
            // Biweekly tasks trigger on even weeks (0, 2, 4, 6...) = every other week
            const referenceDate = new Date(settings.biweekly.referenceDate);
            const daysSinceReference = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));
            const weeksSinceReference = Math.floor(daysSinceReference / 7);

            // Only trigger on even weeks (0, 2, 4, 6...)
            if (weeksSinceReference % 2 !== 0) return false;

            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }

            return true; // if no time set, recur any time today

        case "monthly":
            // ✅ FIX: If no specific days selected, recur every day of the month
            if (settings.monthly?.days?.length > 0 && !settings.monthly.days.includes(day)) {
                return false;
            }

            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }

            return true; // If no time is set, trigger any time during the day

        case "yearly":
            // ✅ FIX: If no specific months selected, recur every month of the year
            if (settings.yearly?.months?.length > 0 && !settings.yearly.months.includes(month)) {
                return false;
            }

            if (settings.yearly.useSpecificDays) {
                const daysByMonth = settings.yearly.daysByMonth || {};
                const days = settings.yearly.applyDaysToAll
                    ? daysByMonth.all || []
                    : daysByMonth[month] || [];

                // ✅ FIX: If no specific days selected, recur every day of the month
                if (days.length > 0 && !days.includes(day)) {
                    return false;
                }
            }

            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }

            return true; // If no time is set, recur any time that day

        case "hourly":
            if (settings.hourly?.useSpecificMinute) {
                const minute = now.getMinutes();
                return minute === settings.hourly.minute;
            }
            return now.getMinutes() === 0;

        default:
            return false;
    }
}

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

    // 🔒 Already exists?
    if (taskList.some(task => task.id === id)) return false;

    // ⏸️ Suppressed?
    if (suppressUntil && new Date(suppressUntil) > now) {
        console.log(`⏸ Skipping "${text}" — suppressed until ${suppressUntil}`);
        return false;
    }

    // ⏱ Triggered recently?
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

    // 🧠 Recurrence match?
    return shouldTaskRecurNow(recurringSettings, now);
}

// ============================================
// CORE SCHEDULING ENGINE
// ============================================

/**
 * Catch up on missed recurring tasks
 * Adds tasks that should have appeared while tab was inactive
 * Each template only creates ONE task, even if multiple occurrences were missed
 *
 * @returns {Promise<Object>} Stats { added: number, updated: number }
 */
export async function catchUpMissedRecurringTasks() {
    console.log('⏰ Catching up on missed recurring tasks...');

    // ✅ Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return { added: 0, updated: 0 };
    }

    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();

    // ✅ Read from AppState
    assertInjected('getAppState', Deps.getAppState);
    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for catch-up');
        return { added: 0, updated: 0 };
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for catch-up');
        return { added: 0, updated: 0 };
    }

    const templates = cycleData.recurringTemplates || {};
    const taskList = cycleData.tasks || [];

    if (!Object.keys(templates).length) {
        console.log('📋 No recurring templates for catch-up');
        return { added: 0, updated: 0 };
    }

    assertInjected('now', Deps.now);
    const now = new Date(Deps.now());
    const tasksToAdd = [];
    const templateUpdates = {};

// ✅ Check each template for missed occurrences
  Object.values(templates).forEach(template => {
      console.log(`\n🔍 Checking template: "${template.text}" (ID: ${template.id})`);

      // Skip if task already exists
      if (taskList.some(t => t.id === template.id)) {
          console.log(`  ⏭️  SKIP: Task already exists in task list`);
          return;
      }

      // ✅ FAST PATH: Skip if nextScheduledOccurrence is null or in the future
      if (!template.nextScheduledOccurrence) {
          console.log(`  ⏭️  SKIP (Fast Path): nextScheduledOccurrence is null`);
          return;
      }

      if (template.nextScheduledOccurrence > now.getTime()) {
          const nextDate = new Date(template.nextScheduledOccurrence).toLocaleString();
          const nowDate = new Date(now.getTime()).toLocaleString();
          console.log(`  ⏭️  SKIP (Fast Path): Not due yet`);
          console.log(`     Next scheduled: ${nextDate} (${template.nextScheduledOccurrence})`);
          console.log(`     Current time:   ${nowDate} (${now.getTime()})`);
          return;
      }

      console.log(`  ✅ Fast Path PASSED: Task is potentially due`);
      console.log(`     Next scheduled: ${new Date(template.nextScheduledOccurrence).toLocaleString()}`);
      console.log(`     Current time:   ${new Date(now.getTime()).toLocaleString()}`);


      // ✅ MISSED OCCURRENCE - Add task once
      console.log(`  🎯 MISSED OCCURRENCE DETECTED!`);
      console.log(`  ⏰ Catching up missed task: ${template.text}`);

      tasksToAdd.push({
          text: template.text,
          completed: false,
          dueDate: template.dueDate,
          highPriority: template.highPriority,
          remindersEnabled: template.remindersEnabled,
          recurring: true,
          id: template.id,
          recurringSettings: template.recurringSettings
      });

      // Calculate NEXT future occurrence
      const nextFuture = calculateNextOccurrence(template.recurringSettings, now);

      console.log(`  📅 Updating template timestamps:`);
      console.log(`     Previous next occurrence: ${new Date(template.nextScheduledOccurrence).toLocaleString()}`);
      console.log(`     New next occurrence:      ${nextFuture ? new Date(nextFuture).toLocaleString() : 'null'}`);
      console.log(`     Last triggered:           ${new Date(now.getTime()).toLocaleString()}`);

      templateUpdates[template.id] = {
          ...template,
          lastTriggeredTimestamp: now.getTime(),
          nextScheduledOccurrence: nextFuture
      };
  });

  // Add summary log after the loop
  console.log(`\n📊 Catch-up Summary:`);
  console.log(`   Total templates checked: ${Object.keys(templates).length}`);
  console.log(`   Tasks to add: ${tasksToAdd.length}`);
  console.log(`   Templates to update: ${Object.keys(templateUpdates).length}`);

    // ✅ Batch all changes in one AppState update
    if (tasksToAdd.length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        Deps.updateAppState(draft => {
            const cycle = draft.data.cycles[activeCycleId];

            // Add missed recurring tasks
            tasksToAdd.forEach(taskData => {
                cycle.tasks.push({
                    ...taskData,
                    dateCreated: now.toISOString()
                });
            });

            // Update template timestamps and next occurrences
            Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        }, true); // Immediate save

        console.log(`✅ Caught up ${tasksToAdd.length} missed recurring task${tasksToAdd.length > 1 ? 's' : ''}`);

        // ✅ Refresh DOM to show caught-up tasks
        setTimeout(() => {
            if (Deps.refreshUIFromState && typeof Deps.refreshUIFromState === 'function') {
                Deps.refreshUIFromState();
                console.log('🔄 DOM refreshed after catching up tasks');
            }
        }, 0);

        // ✅ Show notification
        assertInjected('showNotification', Deps.showNotification);
        Deps.showNotification(
            `⏰ Added ${tasksToAdd.length} missed recurring task${tasksToAdd.length > 1 ? 's' : ''}`,
            'info',
            3000
        );
    } else {
        console.log('✅ No missed recurring tasks to catch up');
    }

    return { added: tasksToAdd.length, updated: Object.keys(templateUpdates).length };
}

/**
 * Watch recurring tasks and recreate them when due
 * Runs as part of the 30-second interval check
 */
export async function watchRecurringTasks() {
    console.log('👁️ Watching recurring tasks (AppState-based)...');

    // ✅ Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return;
    }

    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();

    // ✅ Read from AppState
    assertInjected('getAppState', Deps.getAppState);

    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring task watch');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for recurring task watch');
        return;
    }

    const templates = cycleData.recurringTemplates || {};
    const taskList = cycleData.tasks || [];

    if (!Object.keys(templates).length) {
        console.log('📋 No recurring templates found');
        return;
    }

    console.log('🔍 Checking recurring templates:', Object.keys(templates).length);

    assertInjected('now', Deps.now);
    const now = new Date(Deps.now());
    const tasksToAdd = [];
    const templateUpdates = {};

    // ✅ Collect changes without mutating state directly
    Object.values(templates).forEach(template => {
        // ⛔ Prevent re-adding if task already exists by ID
        if (taskList.some(task => task.id === template.id)) return;

        // ✅ FAST PATH: Skip if not due yet (performance optimization)
        if (template.nextScheduledOccurrence && now.getTime() < template.nextScheduledOccurrence) {
            return; // Not due yet, skip expensive pattern matching
        }

        // ✅ SLOW PATH: Pattern matching validation (catches calculation bugs)
        if (!shouldRecreateRecurringTask(template, taskList, now)) return;

        console.log("⏱ Auto‑recreating recurring task:", template.text);

        tasksToAdd.push({
            text: template.text,
            completed: false,
            dueDate: template.dueDate,
            highPriority: template.highPriority,
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings
        });

        // ✅ Recalculate next occurrence after triggering
        const nextOccurrence = calculateNextOccurrence(template.recurringSettings, now);

        templateUpdates[template.id] = {
            ...template,
            lastTriggeredTimestamp: now.getTime(),
            nextScheduledOccurrence: nextOccurrence
        };
    });

    // ✅ Batch all changes in one AppState update
    if (tasksToAdd.length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        Deps.updateAppState(draft => {
            const cycle = draft.data.cycles[activeCycleId];

            // Add new recurring tasks
            tasksToAdd.forEach(taskData => {
                cycle.tasks.push({
                    ...taskData,
                    dateCreated: now.toISOString()
                });
            });

            // Update template timestamps
            Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        });

        console.log(`✅ Added ${tasksToAdd.length} recurring tasks via AppState`);

        // ✅ Refresh DOM to show newly added recurring tasks
        // Use setTimeout to ensure state update has completed before refreshing DOM
        setTimeout(() => {
            if (Deps.refreshUIFromState && typeof Deps.refreshUIFromState === 'function') {
                Deps.refreshUIFromState();
                console.log('🔄 DOM refreshed after adding recurring tasks');
            } else {
                console.warn('⚠️ refreshUIFromState not available - tasks added to state but DOM not refreshed');
            }
        }, 0);
    }
}

/**
 * Setup the recurring task watcher interval
 * Checks every 30 seconds for tasks that need to be recreated
 */
export async function setupRecurringWatcher() {
    console.log('⚙️ Setting up recurring watcher (AppState-based)...');

    // ✅ Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return;
    }

    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();
    console.log('✅ Core systems ready - setting up recurring watcher');

    // ✅ Read from AppState
    assertInjected('getAppState', Deps.getAppState);
    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring watcher setup');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for recurring watcher setup');
        return;
    }

    const recurringTemplates = cycleData.recurringTemplates || {};

    if (!Object.keys(recurringTemplates).length) {
        console.log('📋 No recurring templates to watch');
        return;
    }

    console.log('🔄 Setting up recurring task watcher with', Object.keys(recurringTemplates).length, 'templates');

    // Initial check - catch up on missed tasks first, then check for current tasks
    await catchUpMissedRecurringTasks();
    await watchRecurringTasks();

    // Setup 30-second interval
    assertInjected('setInterval', Deps.setInterval);
    Deps.setInterval(() => watchRecurringTasks(), 30000);

    // Re-check when tab becomes visible (user might have been away)
    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible") {
            console.log('👁️ Tab visible again, checking for missed tasks...');
            // First, catch up on any missed recurring tasks
            await catchUpMissedRecurringTasks();
            // Then check for tasks that are due now
            await watchRecurringTasks();
        }
    });

    console.log('✅ Recurring watcher initialized successfully');
}

// ============================================
// BUSINESS LOGIC - TASK ACTIVATION/DEACTIVATION
// ============================================

/**
 * Activate recurring for a task
 * @param {Object} task - The task object to make recurring
 * @param {Object} taskContext - Context containing taskId, currentCycle, settings
 * @param {HTMLElement} button - The recurring button element (optional, for UI updates)
 */
export function handleRecurringTaskActivation(task, taskContext, button = null) {
    const { assignedTaskId, currentCycle, settings } = taskContext;

    assertInjected('querySelector', Deps.querySelector);
    const taskItem = Deps.querySelector(`[data-task-id="${assignedTaskId}"]`);

    const defaultSettings = settings.defaultRecurringSettings || {
        frequency: "daily",
        indefinitely: true,
        time: null
    };

    // ✅ Use existing settings if task was previously recurring, otherwise use defaults
    if (!task.recurringSettings || Object.keys(task.recurringSettings).length === 0) {
        // First time setting to recurring - use defaults
        task.recurringSettings = normalizeRecurringSettings(structuredClone(defaultSettings));
        console.log('📝 First-time recurring activation - using default settings');
    } else {
        // Task was previously recurring - preserve existing settings
        task.recurringSettings = normalizeRecurringSettings(structuredClone(task.recurringSettings));
        console.log('📝 Re-activating recurring - preserving previous settings:', task.recurringSettings);
    }

    // Update DOM if element exists
    if (taskItem) {
        taskItem.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
        taskItem.classList.add("recurring");
    }

    task.schemaVersion = 2;

    // ✅ Create recurring template using AppState for consistency (immediate save)
    assertInjected('updateAppState', Deps.updateAppState);
    Deps.updateAppState(draft => {
        const activeCycleId = draft.appState?.activeCycleId;
        const currentCycleInState = draft.data?.cycles?.[activeCycleId];

        if (!currentCycleInState) {
            console.warn('⚠️ No active cycle found in AppState for template creation');
            return;
        }

        if (!currentCycleInState.recurringTemplates) {
            currentCycleInState.recurringTemplates = {};
        }

        currentCycleInState.recurringTemplates[assignedTaskId] = {
            id: assignedTaskId,
            text: task.text,
            recurring: true,
            recurringSettings: structuredClone(task.recurringSettings),
            highPriority: task.highPriority || false,
            dueDate: task.dueDate || null,
            remindersEnabled: task.remindersEnabled || false,
            lastTriggeredTimestamp: null,
            nextScheduledOccurrence: calculateNextOccurrence(task.recurringSettings, Date.now()),
            schemaVersion: 2
        };
    }, true); // ✅ Immediate save to prevent data loss on quick refresh

    console.log('✅ Recurring template created via AppState:', {
        taskId: assignedTaskId,
        taskText: task.text,
        settings: task.recurringSettings
    });

    // ✅ Show notification with Quick Actions (handled by notifications module)
    const frequency = task.recurringSettings?.frequency || 'daily';
    const pattern = task.recurringSettings?.indefinitely ? 'Indefinitely' : 'Limited';

    console.log('📢 Attempting to show notification:', { frequency, pattern, assignedTaskId });

    // Use notifications module if available
    if (window.notifications?.createRecurringNotificationWithTip) {
        console.log('📝 Creating notification content...');
        const notificationContent = window.notifications.createRecurringNotificationWithTip(assignedTaskId, frequency, pattern, task.text);
        console.log('📝 Notification content created:', notificationContent.substring(0, 100) + '...');

        // Use showNotificationWithTip if available
        if (window.showNotificationWithTip) {
            console.log('📤 Showing notification with tip...');
            const notification = window.showNotificationWithTip(notificationContent, "recurring", 10000, 'recurring-cycle-explanation');
            console.log('📤 Notification result:', notification);

            // Initialize listeners if notification was created
            if (notification && window.notifications.initializeRecurringNotificationListeners) {
                console.log('🎧 Initializing notification listeners...');
                window.notifications.initializeRecurringNotificationListeners(notification);
            }
        } else {
            console.log('📤 Falling back to regular showNotification...');
            // Fallback to regular showNotification
            assertInjected('showNotification', Deps.showNotification);
            const notification = Deps.showNotification(notificationContent, "recurring", 10000);

            if (notification && window.notifications.initializeRecurringNotificationListeners) {
                window.notifications.initializeRecurringNotificationListeners(notification);
            }
        }
    } else {
        console.log('⚠️ Notifications module not available, using fallback');
        // Fallback to simple notification
        assertInjected('showNotification', Deps.showNotification);
        Deps.showNotification(`✅ Task set to recurring (${frequency})`, "success", 5000);
    }

    console.log('✅ Task activated as recurring:', assignedTaskId);

    // ✅ Update panel button visibility after small delay to ensure AppState has propagated
    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        setTimeout(() => {
            console.log('🔘 Updating button visibility after recurring activation...');
            Deps.updatePanelButtonVisibility();
        }, 100); // Small delay to ensure AppState changes have propagated
    }
}

/**
 * Deactivate recurring for a task
 * @param {Object} task - The task object to make non-recurring
 * @param {Object} taskContext - Context containing taskId, currentCycle
 * @param {string} assignedTaskId - The task ID
 */
export function handleRecurringTaskDeactivation(task, taskContext, assignedTaskId) {
    assertInjected('querySelector', Deps.querySelector);
    assertInjected('updateAppState', Deps.updateAppState);
    assertInjected('getAppState', Deps.getAppState);
    assertInjected('isAppStateReady', Deps.isAppStateReady);

    if (!Deps.isAppStateReady()) {
        console.warn('⚠️ AppState not ready for handleRecurringTaskDeactivation');
        return;
    }

    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for handleRecurringTaskDeactivation');
        return;
    }

    const taskItem = Deps.querySelector(`[data-task-id="${assignedTaskId}"]`);

    // ✅ Update via AppState instead of direct manipulation (immediate save)
    Deps.updateAppState(draft => {
        const cycle = draft.data.cycles[activeCycleId];
        const targetTask = cycle.tasks.find(t => t.id === assignedTaskId);

        if (targetTask) {
            targetTask.recurring = false;
            // ✅ Keep recurringSettings so they can be restored if user toggles back on
            // Don't set to {} - preserve the settings!
            targetTask.schemaVersion = 2;
        }

        // Remove from templates, keep task in main array
        if (cycle.recurringTemplates?.[assignedTaskId]) {
            delete cycle.recurringTemplates[assignedTaskId];
        }

        // Ensure the task stays in the main tasks array
        if (!targetTask) {
            console.warn('⚠️ Task missing from main array, re-adding:', assignedTaskId);
            cycle.tasks.push({
                ...task,
                recurring: false,
                // ✅ Preserve recurringSettings from original task
                recurringSettings: task.recurringSettings || {},
                schemaVersion: 2
            });
        }
    }, true); // ✅ Immediate save to prevent data loss on quick refresh

    // Update DOM if element exists
    if (taskItem) {
        taskItem.removeAttribute("data-recurring-settings");
        taskItem.classList.remove("recurring");
    }

    assertInjected('showNotification', Deps.showNotification);
    Deps.showNotification("↩️ Recurring turned off for this task.", "info", 2000);

    console.log('✅ Task deactivated from recurring:', assignedTaskId);
    
    // ✅ Update panel button visibility immediately
    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        Deps.updatePanelButtonVisibility();
    }
}

// ============================================
// BUSINESS LOGIC - SETTINGS APPLICATION
// ============================================

/**
 * Apply recurring settings to a task (Schema 2.5)
 * @param {string} taskId - The task ID
 * @param {Object} newSettings - New recurring settings to apply
 */
export function applyRecurringToTaskSchema25(taskId, newSettings) {
    // ✅ Use AppState instead of direct parameter passing
    assertInjected('isAppStateReady', Deps.isAppStateReady);
    assertInjected('getAppState', Deps.getAppState);
    assertInjected('updateAppState', Deps.updateAppState);

    if (!Deps.isAppStateReady()) {
        console.warn('⚠️ AppState not ready for applyRecurringToTaskSchema25');
        return;
    }

    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for applyRecurringToTaskSchema25');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.error('❌ Cycle data not found for applyRecurringToTaskSchema25');
        return;
    }

    let task = cycleData.tasks.find(t => t.id === taskId);
    if (!task) {
        console.error('❌ Task not found for applyRecurringToTaskSchema25:', taskId);
        return;
    }

    // ✅ Update via AppState instead of localStorage (immediate save)
    Deps.updateAppState(draft => {
        const cycle = draft.data.cycles[activeCycleId];
        const targetTask = cycle.tasks.find(t => t.id === taskId);

        if (targetTask) {
            // Merge instead of overwrite so we keep advanced panel settings
            targetTask.recurringSettings = {
                ...targetTask.recurringSettings,
                ...newSettings
            };
            targetTask.recurring = true;
            targetTask.schemaVersion = 2;

            // Keep recurringTemplates in sync
            if (!cycle.recurringTemplates) cycle.recurringTemplates = {};

            // Check if this is a NEW recurring task (wasn't recurring before)
            const isNewRecurring = !cycle.recurringTemplates[taskId] || !cycle.recurringTemplates[taskId].recurring;

            cycle.recurringTemplates[taskId] = {
                ...(cycle.recurringTemplates[taskId] || {}),
                id: taskId,
                text: targetTask.text,
                recurring: true,
                schemaVersion: 2,
                recurringSettings: { ...targetTask.recurringSettings },
                // ✅ FIX: For newly-enabled recurring tasks, set nextScheduledOccurrence to 0
                // This ensures the task appears immediately on the next catch-up/watch cycle
                // For existing recurring tasks, calculate the next occurrence normally
                nextScheduledOccurrence: isNewRecurring ? 0 : calculateNextOccurrence(targetTask.recurringSettings, Date.now())
            };
        }
    }, true); // ✅ Immediate save for recurring settings changes

    // Update DOM attributes for this task
    assertInjected('querySelector', Deps.querySelector);
    const taskElement = Deps.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
        taskElement.classList.add("recurring");
        taskElement.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
        const recurringBtn = taskElement.querySelector(".recurring-btn");
        if (recurringBtn) {
            recurringBtn.classList.add("active");
            recurringBtn.setAttribute("aria-pressed", "true");
        }
    }

    // ✅ Update recurring panel display if it's open (optional callbacks)
    if (Deps.updateRecurringPanel && typeof Deps.updateRecurringPanel === 'function') {
        Deps.updateRecurringPanel();
    }

    // ✅ Update recurring summary to reflect changes
    if (Deps.updateRecurringSummary && typeof Deps.updateRecurringSummary === 'function') {
        Deps.updateRecurringSummary();
    }

    // ✅ Update panel button visibility based on recurring task count
    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        Deps.updatePanelButtonVisibility();
    }

    console.log('✅ Recurring settings applied to task:', taskId);
}

// ============================================
// BUSINESS LOGIC - TEMPLATE MANAGEMENT
// ============================================

/**
 * Delete a recurring template
 * @param {string} taskId - The task ID
 */
export function deleteRecurringTemplate(taskId) {
    console.log('🗑️ Deleting recurring template (AppState-based)...');

    assertInjected('updateAppState', Deps.updateAppState);
    assertInjected('getAppState', Deps.getAppState);
    assertInjected('isAppStateReady', Deps.isAppStateReady);

    if (!Deps.isAppStateReady()) {
        console.warn('⚠️ AppState not ready for deleteRecurringTemplate');
        return;
    }

    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for deleteRecurringTemplate');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.error('❌ Cycle data not found for deleteRecurringTemplate');
        return;
    }

    if (!cycleData.recurringTemplates || !cycleData.recurringTemplates[taskId]) {
        console.warn(`⚠ Task "${taskId}" not found in recurring templates.`);
        return;
    }

    console.log('🔍 Deleting template for task:', taskId);

    // ✅ Delete via AppState instead of direct manipulation (immediate save)
    Deps.updateAppState(draft => {
        const cycle = draft.data.cycles[activeCycleId];
        if (cycle?.recurringTemplates?.[taskId]) {
            delete cycle.recurringTemplates[taskId];
        }
    }, true); // ✅ Immediate save when deleting recurring templates

    console.log('✅ Recurring template deleted via AppState');
}

/**
 * Remove recurring tasks from cycle during reset
 * @param {Array} taskElements - Array of task DOM elements
 * @param {Object} cycleData - Current cycle data
 */
export function removeRecurringTasksFromCycle(taskElements, cycleData) {
    taskElements.forEach(taskEl => {
        const taskId = taskEl.dataset.taskId;
        const isRecurring = taskEl.classList.contains("recurring");

        if (isRecurring) {
            // Remove from DOM
            taskEl.remove();

            // ✅ IMPORTANT: Only remove from tasks array, keep in recurringTemplates
            if (cycleData.tasks) {
                const taskIndex = cycleData.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    cycleData.tasks.splice(taskIndex, 1);
                }
            }

            // ✅ FIX: Recalculate nextScheduledOccurrence when cycle resets
            // This ensures recurring tasks can appear again based on current time
            if (cycleData.recurringTemplates && cycleData.recurringTemplates[taskId]) {
                const template = cycleData.recurringTemplates[taskId];

                // Recalculate from current time
                const nextOccurrence = calculateNextOccurrence(
                    template.recurringSettings,
                    Date.now()
                );

                template.nextScheduledOccurrence = nextOccurrence;
                template.lastTriggeredTimestamp = null; // Reset since cycle completed

                console.log(`✅ Recalculated nextScheduledOccurrence after reset for "${template.text}":`,
                    new Date(nextOccurrence || 0).toLocaleString());
            }

            // ✅ Keep in recurringTemplates so they can be recreated
            // DON'T delete from recurringTemplates here
        }
    });
}

/**
 * Handle recurring tasks after cycle reset
 * Called after completeMiniCycle to clean up recurring tasks
 */
export function handleRecurringTasksAfterReset() {
    console.log('🔄 Handling recurring tasks after reset (AppState-based)...');

    assertInjected('getAppState', Deps.getAppState);
    assertInjected('isAppStateReady', Deps.isAppStateReady);

    if (!Deps.isAppStateReady()) {
        console.warn('⚠️ AppState not ready for handleRecurringTasksAfterReset');
        return;
    }

    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for handleRecurringTasksAfterReset');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle data found for recurring task reset');
        return;
    }

    const recurringTemplates = cycleData.recurringTemplates || {};
    const templateCount = Object.keys(recurringTemplates).length;

    if (templateCount > 0) {
        console.log(`✅ ${templateCount} recurring templates preserved for future recreation`);
    } else {
        console.log('📋 No recurring templates to preserve');
    }
}

// ============================================
// EXPORTS
// ============================================

console.log('🔧 RecurringCore module loaded (Strict DI Pattern)');
