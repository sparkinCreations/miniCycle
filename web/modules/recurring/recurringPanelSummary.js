/**
 * miniCycle Recurring Tasks - Panel Summary Generation
 *
 * Purpose: Generate human-readable summary text from recurring settings
 *
 * DI PATTERN NOTE: This module exports a pure function with no dependencies
 * beyond getLabel() (a static import). It needs no DI wiring — it takes a
 * settings object as input and returns a string. Called by RecurringPanel.
 *
 * @module recurringPanelSummary
 * @version 1.1.0
 */

import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// SUMMARY TEXT GENERATION
// ============================================================================

/**
 * Build recurring summary text from settings
 * Standalone function for use outside the class
 * @param {Object} settings - Recurring settings
 * @returns {string} Summary text
 */
export function buildRecurringSummaryFromSettings(settings = {}) {
    // Normalize settings to ensure useSpecificDays is properly set
    // This handles cases where settings are passed without normalization
    if (settings.monthly && !('useSpecificDays' in settings.monthly) && settings.monthly.days?.length > 0) {
        settings.monthly.useSpecificDays = true;
    }

    const freq = settings.frequency || "daily";
    const indefinitely = settings.indefinitely ?? true;
    const count = settings.count;

    // Helper function for parsing dates
    const parseDateAsLocal = (dateStr) => {
        try {
            const [year, month, day] = dateStr.split("-").map(Number);
            return new Date(year, month - 1, day);
        } catch (error) {
            return null;
        }
    };

    // === SPECIFIC DATES OVERRIDE ===
    if (settings.specificDates?.enabled && settings.specificDates.dates?.length) {
        const formattedDates = settings.specificDates.dates.map(dateStr => {
            const date = parseDateAsLocal(dateStr);
            if (!date) return dateStr; // fallback to raw string if parse fails
            return date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                weekday: "short"
            });
        });

        let summary = getLabel('recurring.summarySpecificDates', { vars: { dates: formattedDates.join(", ") } });

        // Optionally show time for specific dates
        if (settings.time) {
            const formattedTime = formatTime(settings.time);
            summary += ` ${getLabel('recurring.summaryAtTime', { vars: { time: formattedTime } })}`;
        }

        return summary;
    }

    // === Normal Recurrence Fallback ===
    let summaryText = getLabel('recurring.summaryRepeats', { vars: { freq } });

    // Duration: indefinitely, count, or until date
    if (!indefinitely && count) {
        const timeWord = getLabel('recurring.summaryTimeCount', { count });
        summaryText += ` ${getLabel('recurring.summaryForCount', { vars: { count, timeWord } })}`;
    } else if (!indefinitely && settings.untilDate) {
        // Format date nicely for display
        const dateObj = new Date(settings.untilDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
        summaryText += ` ${getLabel('recurring.summaryUntil', { vars: { date: formattedDate } })}`;
    } else {
        summaryText += ` ${getLabel('recurring.summaryIndefinitely')}`;
    }

    // === TIME HANDLING ===
    if (settings.time && (settings.useSpecificTime ?? true)) {
        const formattedTime = formatTime(settings.time);
        summaryText += ` ${getLabel('recurring.summaryAtTime', { vars: { time: formattedTime } })}`;
    }

    // === HOURLY ===
    if (freq === "hourly" && settings.hourly?.useSpecificMinute) {
        const minute = settings.hourly.minute.toString().padStart(2, "0");
        summaryText += ` ${getLabel('recurring.summaryAtMinute', { vars: { minute } })}`;
    }

    // === WEEKLY ===
    if (freq === "weekly" && settings.weekly?.days?.length) {
        summaryText += ` ${getLabel('recurring.summaryOnDays', { vars: { days: settings.weekly.days.join(", ") } })}`;
    }

    // === BIWEEKLY (two-week pattern) ===
    if (freq === "biweekly") {
        const week1Days = settings.biweekly?.week1 || [];
        const week2Days = settings.biweekly?.week2 || [];

        if (week1Days.length || week2Days.length) {
            const parts = [];
            if (week1Days.length) parts.push(getLabel('recurring.summaryWeek1', { vars: { days: week1Days.join(", ") } }));
            if (week2Days.length) parts.push(getLabel('recurring.summaryWeek2', { vars: { days: week2Days.join(", ") } }));
            summaryText += ` ${getLabel('recurring.summaryOnDays', { vars: { days: parts.join(" | ") } })}`;
        }
    }

    // === MONTHLY ===
    if (freq === "monthly") {
        const monthly = settings.monthly || {};

        // Week-of-month pattern (e.g., "2nd Tuesday", "Last Friday")
        if (monthly.useWeekOfMonth && monthly.weekOfMonth) {
            const ordinalMap = {
                "1": "1st",
                "2": "2nd",
                "3": "3rd",
                "4": "4th",
                "last": "Last"
            };
            const dayMap = {
                "Sun": "Sunday",
                "Mon": "Monday",
                "Tue": "Tuesday",
                "Wed": "Wednesday",
                "Thu": "Thursday",
                "Fri": "Friday",
                "Sat": "Saturday"
            };
            const ordinal = ordinalMap[monthly.weekOfMonth.ordinal] || monthly.weekOfMonth.ordinal;
            const day = dayMap[monthly.weekOfMonth.day] || monthly.weekOfMonth.day;
            summaryText += ` ${getLabel('recurring.summaryOnOrdinalDay', { vars: { ordinal, day } })}`;
        }
        // Specific days pattern
        else if (monthly.useSpecificDays && (monthly.days?.length || monthly.lastDay)) {
            const parts = [];

            if (monthly.days?.length) {
                const dayLabel = getLabel('recurring.summaryDayCount', { count: monthly.days.length });
                parts.push(`${dayLabel} ${monthly.days.join(", ")}`);
            }

            if (monthly.lastDay) {
                parts.push(getLabel('recurring.summaryLastDay'));
            }

            if (parts.length > 0) {
                summaryText += ` ${getLabel('recurring.summaryOnDays', { vars: { days: parts.join(` ${getLabel('recurring.summaryAnd')} `) } })}`;
            }
        }
    }

    // === YEARLY ===
    if (freq === "yearly") {
        const months = settings.yearly?.months || [];
        const daysByMonth = settings.yearly?.daysByMonth || {};

        if (months.length) {
            const useSpecificDays = settings.yearly?.useSpecificDays;
            const applyToAll = settings.yearly?.applyDaysToAll;
            const hasSharedDays = useSpecificDays && applyToAll && daysByMonth.all?.length;

            if (hasSharedDays) {
                // Same days for all months: "in Mar, Apr on days 12, 13"
                const monthNames = months.map(m =>
                    new Date(0, m - 1).toLocaleString("default", { month: "short" })
                );
                const dayLabel = getLabel('recurring.summaryDayCount', { count: daysByMonth.all.length });
                summaryText += ` ${getLabel('recurring.summaryInMonths', { vars: { months: monthNames.join(", ") } })}`;
                summaryText += ` ${getLabel('recurring.summaryOnDayNumbers', { vars: { dayLabel, days: daysByMonth.all.join(", ") } })}`;
            } else if (useSpecificDays && !applyToAll) {
                // Per-month days: "in Apr 12, 13, Mar"
                const parts = months.map(m => {
                    const name = new Date(0, m - 1).toLocaleString("default", { month: "short" });
                    const days = daysByMonth[m] || [];
                    return days.length > 0 ? `${name} ${days.join(", ")}` : name;
                });
                summaryText += ` ${getLabel('recurring.summaryInMonths', { vars: { months: parts.join(", ") } })}`;
            } else {
                // No specific days: "in Mar, Apr"
                const monthNames = months.map(m =>
                    new Date(0, m - 1).toLocaleString("default", { month: "short" })
                );
                summaryText += ` ${getLabel('recurring.summaryInMonths', { vars: { months: monthNames.join(", ") } })}`;
            }
        }
    }

    return summaryText;
}

/**
 * Format time object to display string
 * @param {Object} time - Time object with hour, minute, meridiem, military
 * @returns {string} Formatted time string
 */
function formatTime(time) {
    const { hour, minute, meridiem, military } = time;
    return military
        ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
}
