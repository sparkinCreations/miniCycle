/**
 * dueDateUtils.js — what a task's due date MEANS, and the line that shows it.
 *
 * A task stores its due date as two separate fields:
 *   - `dueDate`: "YYYY-MM-DD" (local calendar day), exactly as every build has
 *   - `dueTime`: "HH:MM" (24-hour, local wall clock) or null — added Oct 2026
 *
 * They are kept apart on purpose. A build that predates `dueTime` reads
 * `dueDate` unchanged and ignores the extra key (the .mcyc schemas are open),
 * so a timed task degrades to the old date-only behaviour there instead of
 * failing to parse.
 *
 * Overdue, the notification moment, the label and the sort all come from here,
 * so the task list, the Focus view, the notifications and the testing tools
 * cannot disagree. No DI; the only DOM is the chip helpers at the bottom.
 *
 * @module utils/dueDateUtils
 */

import { DOM_CLASSES, LIMITS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { parseDateAsLocal } from '../recurring/recurringDateUtils.js';
import { createIconElement } from './icons.js';

const DUE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A stored due time, or null when absent or malformed.
 * @param {*} value
 * @returns {string|null} "HH:MM"
 */
export function normalizeDueTime(value) {
    return typeof value === 'string' && DUE_TIME_PATTERN.test(value) ? value : null;
}

/**
 * Local midnight of `date`.
 * @param {Date} date
 * @returns {Date}
 */
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * The due day at the task's due time, or at `fallbackHour` when it has none.
 * @param {{dueDate?: string|null, dueTime?: string|null}|null} task
 * @param {number} [fallbackHour=LIMITS.DUE_DATE_NOTIFY_HOUR]
 * @returns {Date|null} null when the task has no usable due date
 */
export function getDueMoment(task, fallbackHour = LIMITS.DUE_DATE_NOTIFY_HOUR) {
    if (!task?.dueDate) return null;
    const day = parseDateAsLocal(task.dueDate);
    if (!day) return null;
    const time = normalizeDueTime(task.dueTime);
    const at = new Date(day);
    if (time) {
        const [h, m] = time.split(':').map(Number);
        at.setHours(h, m, 0, 0);
    } else {
        at.setHours(fallbackHour, 0, 0, 0);
    }
    return at;
}

/**
 * Is this task overdue right now?
 *
 * A completed task never is. With a due time, it is overdue once that minute
 * has passed; without one, from the start of the day AFTER its due date (due
 * today is not overdue).
 * @param {{dueDate?: string|null, dueTime?: string|null, completed?: boolean}|null} task
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
export function isTaskOverdue(task, now = new Date()) {
    if (!task?.dueDate || task.completed) return false;
    const day = parseDateAsLocal(task.dueDate);
    if (!day) return false;
    if (normalizeDueTime(task.dueTime)) {
        return now.getTime() > getDueMoment(task).getTime();
    }
    return day < startOfDay(now);
}

/**
 * "3:00 PM" (or the locale's own format) for a stored "HH:MM".
 * @param {string} time
 * @returns {string}
 */
export function formatDueTime(time) {
    const normalized = normalizeDueTime(time);
    if (!normalized) return '';
    const [h, m] = normalized.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * The due day relative to now: Today / Tomorrow / Yesterday, the weekday for
 * the next few days, otherwise a short date (with the year only when it is
 * not this year).
 * @param {string} dueDate - "YYYY-MM-DD"
 * @param {Date} [now=new Date()]
 * @returns {string} '' when unparsable
 */
export function formatDueDay(dueDate, now = new Date()) {
    const day = parseDateAsLocal(dueDate);
    if (!day) return '';
    // Rounded: a day that crosses a DST change is 23 or 25 hours long.
    const diff = Math.round((day - startOfDay(now)) / DAY_MS);
    if (diff === 0) return getLabel('dueDate.today');
    if (diff === 1) return getLabel('dueDate.tomorrow');
    if (diff === -1) return getLabel('dueDate.yesterday');
    if (diff > 1 && diff <= LIMITS.DUE_DATE_WEEKDAY_SPAN) {
        return day.toLocaleDateString([], { weekday: 'short' });
    }
    const options = { month: 'short', day: 'numeric' };
    if (day.getFullYear() !== now.getFullYear()) options.year = 'numeric';
    return day.toLocaleDateString([], options);
}

/**
 * The full due label: "Today", or "Today · 3:00 PM" when the task has a time.
 * @param {{dueDate?: string|null, dueTime?: string|null}|null} task
 * @param {Date} [now=new Date()]
 * @returns {string} '' when the task has no usable due date
 */
export function formatDueLabel(task, now = new Date()) {
    const date = task?.dueDate ? formatDueDay(task.dueDate, now) : '';
    if (!date) return '';
    const time = formatDueTime(task.dueTime);
    return time ? getLabel('dueDate.withTime', { vars: { date, time } }) : date;
}

// ============================================================================
// THE DUE-DATE LINE (chip) UNDER A TASK
// ============================================================================

/**
 * Build the (empty, hidden) due-date line for a task row. It is a button: a
 * tap opens the picker (dueDates.js listens for it by class), and the task
 * row's click-to-complete already ignores clicks on buttons.
 * @param {string} taskId
 * @returns {HTMLButtonElement}
 */
export function createDueDateChip(taskId) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.id = `due-date-${taskId}`;
    chip.classList.add(DOM_CLASSES.DUE_DATE, DOM_CLASSES.HIDDEN);
    chip.setAttribute('aria-haspopup', 'dialog');
    chip.appendChild(createIconElement('calendar-alt', DOM_CLASSES.DUE_DATE_ICON));
    const text = document.createElement('span');
    text.className = DOM_CLASSES.DUE_DATE_TEXT;
    chip.appendChild(text);
    return chip;
}

/**
 * Show a task's due date on its chip, or hide the chip when there is none.
 * Reads the task record (state), never the DOM.
 * @param {HTMLElement|null} chip
 * @param {{dueDate?: string|null, dueTime?: string|null, completed?: boolean}|null} task
 * @param {Date} [now=new Date()]
 * @returns {void}
 */
export function renderDueDateChip(chip, task, now = new Date()) {
    if (!chip) return;
    const label = formatDueLabel(task, now);
    // An element from an older template has bare text and no text span:
    // replace its content rather than appending beside it.
    let text = chip.querySelector(`.${DOM_CLASSES.DUE_DATE_TEXT}`);
    if (!text) {
        chip.textContent = '';
        text = document.createElement('span');
        text.className = DOM_CLASSES.DUE_DATE_TEXT;
        chip.appendChild(text);
    }
    text.textContent = label;
    chip.classList.toggle(DOM_CLASSES.HIDDEN, !label);
    const overdue = !!label && isTaskOverdue(task, now);
    chip.classList.toggle(DOM_CLASSES.DUE_DATE_OVERDUE, overdue);
    if (label) {
        chip.setAttribute('aria-label', getLabel(overdue ? 'dueDate.chipAriaOverdue' : 'dueDate.chipAria', { vars: { when: label } }));
    } else {
        chip.removeAttribute('aria-label');
    }
}
