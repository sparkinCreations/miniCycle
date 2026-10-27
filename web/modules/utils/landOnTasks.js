/**
 * landOnTasks.js — after an action creates tasks from somewhere else in the
 * UI (History → Recreate, Cleared Tasks → Recreate), bring the user to them.
 *
 * Until Oct 2026 the History modal stayed open after Recreate and re-rendered
 * its own list; the new tasks sat in a routine list the user could not see,
 * with only a toast as a hint. This switches to the Routine tab, scrolls the
 * last recreated row into view and flashes every recreated row.
 *
 * Pure DOM + injected navigation; no DI of its own, no AppState.
 */
import { DATA_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';

/**
 * @param {string[]} taskIds - ids of the tasks just created (state ids)
 * @param {Object} [options]
 * @param {Function|null} [options.showTaskView] - DI `showTaskView` (switches the carousel to the Routine tab)
 * @param {number} [options.delayMs] - wait for the modal close + panel switch before scrolling
 * @param {Function} [options.querySelector]
 * @returns {Promise<number>} rows that were found and flashed
 */
export function landOnTasks(taskIds, { showTaskView = null, delayMs = UI_TIMEOUTS.RECREATE_LANDING_DELAY, querySelector = (s) => document.querySelector(s) } = {}) {
    const ids = (taskIds || []).filter(Boolean);
    try { showTaskView?.(); } catch (e) { console.warn('⚠️ landOnTasks: showTaskView failed', e); }
    return new Promise((resolve) => {
        setTimeout(() => {
            const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            let found = 0, last = null;
            for (const id of ids) {
                const row = querySelector(DATA_SELECTORS.taskById(id));
                if (!row) continue;
                found++; last = row;
                row.classList.remove(DOM_CLASSES.TASK_RECREATED);
                void row.offsetWidth;   // restart the animation if the class was still there
                row.classList.add(DOM_CLASSES.TASK_RECREATED);
                row.addEventListener('animationend', () => row.classList.remove(DOM_CLASSES.TASK_RECREATED), { once: true });
                setTimeout(() => row.classList.remove(DOM_CLASSES.TASK_RECREATED), UI_TIMEOUTS.RECREATE_FLASH);
            }
            last?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
            resolve(found);
        }, delayMs);
    });
}
