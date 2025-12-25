/**
 * miniCycle Recurring Tasks - Panel Summary Generation
 *
 * Purpose: Generate human-readable summary text from recurring settings
 *
 * @module recurringPanelSummary
 * @version 1.0.0
 */

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
            return new Date();
        }
    };

    // === SPECIFIC DATES OVERRIDE ===
    if (settings.specificDates?.enabled && settings.specificDates.dates?.length) {
        const formattedDates = settings.specificDates.dates.map(dateStr => {
            const date = parseDateAsLocal(dateStr);
            return date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                weekday: "short"
            });
        });

        let summary = `Specific dates: ${formattedDates.join(", ")}`;

        // Optionally show time for specific dates
        if (settings.time) {
            const { hour, minute, meridiem, military } = settings.time;
            const formattedTime = military
                ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
                : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
            summary += ` at ${formattedTime}`;
        }

        return summary;
    }

    // === Normal Recurrence Fallback ===
    let summaryText = `Repeats ${freq}`;

    // Duration: indefinitely, count, or until date
    if (!indefinitely && count) {
        summaryText += ` for ${count} time${count !== 1 ? "s" : ""}`;
    } else if (!indefinitely && settings.untilDate) {
        // Format date nicely for display
        const dateObj = new Date(settings.untilDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
        summaryText += ` until ${formattedDate}`;
    } else {
        summaryText += " indefinitely";
    }

    // === TIME HANDLING ===
    if (settings.time && (settings.useSpecificTime ?? true)) {
        const { hour, minute, meridiem, military } = settings.time;
        const formatted = military
            ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
            : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
        summaryText += ` at ${formatted}`;
    }

    // === HOURLY ===
    if (freq === "hourly" && settings.hourly?.useSpecificMinute) {
        summaryText += ` every hour at :${settings.hourly.minute.toString().padStart(2, "0")}`;
    }

    // === WEEKLY ===
    if (freq === "weekly" && settings.weekly?.days?.length) {
        summaryText += ` on ${settings.weekly.days.join(", ")}`;
    }

    // === BIWEEKLY (two-week pattern) ===
    if (freq === "biweekly") {
        const week1Days = settings.biweekly?.week1 || [];
        const week2Days = settings.biweekly?.week2 || [];

        if (week1Days.length || week2Days.length) {
            const parts = [];
            if (week1Days.length) parts.push(`Week 1: ${week1Days.join(", ")}`);
            if (week2Days.length) parts.push(`Week 2: ${week2Days.join(", ")}`);
            summaryText += ` on ${parts.join(" | ")}`;
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
            summaryText += ` on ${ordinal} ${day}`;
        }
        // Specific days pattern
        else if (monthly.useSpecificDays && (monthly.days?.length || monthly.lastDay)) {
            const parts = [];

            if (monthly.days?.length) {
                parts.push(`day${monthly.days.length > 1 ? "s" : ""} ${monthly.days.join(", ")}`);
            }

            if (monthly.lastDay) {
                parts.push("last day");
            }

            if (parts.length > 0) {
                summaryText += ` on ${parts.join(" and ")}`;
            }
        }
    }

    // === YEARLY ===
    if (freq === "yearly") {
        const months = settings.yearly?.months || [];
        const daysByMonth = settings.yearly?.daysByMonth || {};

        if (months.length) {
            const monthNames = months.map(m => new Date(0, m - 1).toLocaleString("default", { month: "short" }));
            summaryText += ` in ${monthNames.join(", ")}`;
        }

        if (settings.yearly?.useSpecificDays) {
            if (settings.yearly.applyDaysToAll && daysByMonth.all?.length) {
                summaryText += ` on day${daysByMonth.all.length > 1 ? "s" : ""} ${daysByMonth.all.join(", ")}`;
            }
        }
    }

    return summaryText;
}

console.log('recurringPanelSummary module loaded');
