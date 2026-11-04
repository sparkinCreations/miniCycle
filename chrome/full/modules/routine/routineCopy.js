/**
 * routineCopy.js — the one definition of "a copy of this routine" (Duplicate).
 *
 * Duplicate lives in two places: the routine switcher's Duplicate button and
 * the main menu's Duplicate Routine. They used to copy differently — the menu
 * deep-cloned the record as it stood, so the copy shared every task id with
 * the original and started life with the original's cycle count, History and
 * Cleared Tasks (cycles completed in a routine that had never been used).
 * Both now build the copy here.
 *
 * Pure: no DI, no DOM, no state access — the caller stores the result.
 *
 * @module routine/routineCopy
 */

import { GlobalUtils } from '../utils/globalUtils.js';

/**
 * Build a fresh routine from `original`, named `title`.
 *
 * - its own id, and new ids for every task, with `recurringTemplates`
 *   re-keyed in lockstep (the map is keyed by task id and each template
 *   carries its task's id — leaving it un-remapped severed every
 *   task↔template link in the copy);
 * - a fresh start: cycle count 0, no History, an empty Cleared Tasks list
 *   (its auto-prune preference travels), created now, not yet edited or
 *   opened;
 * - everything else — tasks, settings, theme, reminders — as in the original.
 *
 * @param {Object} original - A routine record from state (not mutated)
 * @param {string} title - The copy's name
 * @param {{now?: number, makeId?: () => string}} [options]
 * @returns {Object} the new routine record
 */
export function buildRoutineCopy(original, title, { now = Date.now(), makeId = () => GlobalUtils.generateId('routine') } = {}) {
    const copy = structuredClone(original);
    copy.id = makeId();
    copy.title = title;
    copy.createdAt = now;
    delete copy.lastModified;   // shows "Created" until a real change
    delete copy.lastAccessedAt; // not opened yet — Recent order counts from creation
    copy.cycleCount = 0;

    // Fresh history for a fresh routine — the clone otherwise inherits the
    // original's full event log (cycle completions that never happened here).
    delete copy.history;
    if (copy.clearedTasks && typeof copy.clearedTasks === 'object') {
        copy.clearedTasks = { ...copy.clearedTasks, entries: [], totalCleared: 0 };
    }

    if (Array.isArray(copy.tasks)) {
        const idRemap = new Map();
        copy.tasks = copy.tasks.map((task, index) => {
            const newId = `task-${now}-${index}-${Math.floor(Math.random() * 10000)}`;
            if (task.id) idRemap.set(task.id, newId);
            return { ...task, id: newId };
        });

        if (copy.recurringTemplates && typeof copy.recurringTemplates === 'object') {
            copy.recurringTemplates = Object.fromEntries(
                Object.entries(copy.recurringTemplates)
                    .filter(([, template]) => template && typeof template === 'object')
                    .map(([oldId, template], templateIndex) => {
                        // A template without a live task instance is normal
                        // (deleted instance pending recreation) — keep it,
                        // under a fresh id so the copy never shares ids with
                        // the original routine.
                        const newId = idRemap.get(oldId) || `task-${now}-t${templateIndex}-${Math.floor(Math.random() * 10000)}`;
                        return [newId, { ...template, id: newId }];
                    })
            );
        }
    }

    return copy;
}
