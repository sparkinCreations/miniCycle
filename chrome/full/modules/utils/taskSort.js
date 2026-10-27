/**
 * taskSort.js — the ONE comparator behind the task-search sort chips.
 *
 * The Routine list (taskSearch.applySortToDOM) and the Focus view
 * (focusTaskPanel) must agree on what "A–Z", "Priority" and "Due Date" mean,
 * or a user sorts the list, swipes to the Task tab, and browses a different
 * order (reported Oct 2026: "the ordering for the tasks was not changed").
 * Both sort STATE task records with this, never DOM text, so the two views
 * cannot drift. Pure: no DI, no DOM.
 */
import { comparePriority } from './priorityLevel.js';

/** Values of the sort chips (`data-sort`) and of `body.dataset.taskSort`. */
export const TASK_SORT = Object.freeze({
    DEFAULT: 'default',
    AZ: 'az',
    PRIORITY: 'priority',
    DUE_DATE: 'due-date'
});

/** `body.dataset` key taskSearch publishes the active sort under (data-task-sort). */
export const TASK_SORT_DATASET_KEY = 'taskSort';
/** `body.dataset` key for its direction (data-task-sort-direction). */
export const TASK_SORT_DIRECTION_DATASET_KEY = 'taskSortDirection';

/** Tapping the active chip again reverses it. */
export const SORT_DIRECTION = Object.freeze({ ASC: 'asc', DESC: 'desc' });

/** Strip leading emojis (incl. ZWJ sequences) so A–Z sorts by the words, not the emoji code point. */
export function stripLeadingEmoji(text) {
    return String(text ?? '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '');
}

function sortableText(task) {
    return stripLeadingEmoji(task?.text ?? task?.taskText ?? '').toLowerCase();
}

/**
 * Compare two STATE task records under a sort chip.
 *
 * Direction reverses the ORDER of the values, never where the empties go: a
 * task with no due date, or no priority, sorts after every task that has one
 * in both directions. "Latest due date first" should not open with the
 * undated tasks.
 * @param {string} sort - one of TASK_SORT
 * @param {Object} a
 * @param {Object} b
 * @param {string} [direction] - one of SORT_DIRECTION (default asc)
 * @returns {number}
 */
export function compareTasksBySort(sort, a, b, direction = SORT_DIRECTION.ASC) {
    const flip = direction === SORT_DIRECTION.DESC ? -1 : 1;
    switch (sort) {
        case TASK_SORT.AZ:
            return flip * sortableText(a).localeCompare(sortableText(b));
        case TASK_SORT.PRIORITY: {
            const emptyA = !a?.priority, emptyB = !b?.priority;
            if (emptyA !== emptyB) return emptyA ? 1 : -1;
            return flip * comparePriority(a, b);
        }
        case TASK_SORT.DUE_DATE: {
            const emptyA = !a?.dueDate, emptyB = !b?.dueDate;
            if (emptyA !== emptyB) return emptyA ? 1 : -1;
            return flip * String(a.dueDate).localeCompare(String(b.dueDate));
        }
        default:
            return 0;
    }
}

/**
 * A new array of the tasks in sort order (stable: ties keep routine order in
 * both directions). The default sort returns a copy in routine order.
 * @param {Object[]} tasks
 * @param {string} sort
 * @param {string} [direction] - one of SORT_DIRECTION (default asc)
 * @returns {Object[]}
 */
export function sortTasksBySort(tasks, sort, direction = SORT_DIRECTION.ASC) {
    const list = Array.isArray(tasks) ? tasks : [];
    if (!sort || sort === TASK_SORT.DEFAULT) return list.slice();
    return list
        .map((task, index) => ({ task, index }))
        .sort((x, y) => compareTasksBySort(sort, x.task, y.task, direction) || x.index - y.index)
        .map(({ task }) => task);
}
