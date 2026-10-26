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

const UNDATED = '9999-12-31';   // undated tasks sort after every real date

/** Strip leading emojis (incl. ZWJ sequences) so A–Z sorts by the words, not the emoji code point. */
export function stripLeadingEmoji(text) {
    return String(text ?? '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '');
}

function sortableText(task) {
    return stripLeadingEmoji(task?.text ?? task?.taskText ?? '').toLowerCase();
}

/**
 * Compare two STATE task records under a sort chip.
 * @param {string} sort - one of TASK_SORT
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function compareTasksBySort(sort, a, b) {
    switch (sort) {
        case TASK_SORT.AZ:
            return sortableText(a).localeCompare(sortableText(b));
        case TASK_SORT.PRIORITY:
            return comparePriority(a, b);
        case TASK_SORT.DUE_DATE:
            return String(a?.dueDate || UNDATED).localeCompare(String(b?.dueDate || UNDATED));
        default:
            return 0;
    }
}

/**
 * A new array of the tasks in sort order (stable: ties keep routine order).
 * The default sort returns a copy in routine order.
 * @param {Object[]} tasks
 * @param {string} sort
 * @returns {Object[]}
 */
export function sortTasksBySort(tasks, sort) {
    const list = Array.isArray(tasks) ? tasks : [];
    if (!sort || sort === TASK_SORT.DEFAULT) return list.slice();
    return list
        .map((task, index) => ({ task, index }))
        .sort((x, y) => compareTasksBySort(sort, x.task, y.task) || x.index - y.index)
        .map(({ task }) => task);
}
