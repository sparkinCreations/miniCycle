/**
 * The active vocabulary theme's words for the mode descriptions (Nov 2026).
 *
 * Themes rename tasks ("habits", "exercises") and the Complete / Clear buttons
 * ("Complete Check-in", "Clear Habits"). The mode descriptions — the help
 * window's line on a mode switch, the mode menu's tooltips, Focus View's
 * Switch Mode dialog and the menu's Mode Info — name them through these vars
 * instead of saying "tasks" / "Complete Cycle" under every theme. Read at call
 * time, so they follow a theme or routine change.
 *
 * Pure leaf (labels only) so it can be imported statically.
 */
import { getLabel } from './labelResolver.js';

/**
 * @param {Object} [overrides] - e.g. { button } for Focus View's own action label
 * @returns {{tasks: string, taskWord: string, cycleWord: string, completeButton: string, clearButton: string}}
 *   tasks — the plural task noun capitalised to start a sentence ("Habits");
 *   taskWord / cycleWord — the plural nouns as they sit mid-sentence;
 *   completeButton / clearButton — Home View's button names.
 */
export function modeWordVars(overrides = {}) {
    const taskWord = getLabel('noun.task', { count: 2 });
    return {
        tasks: taskWord.charAt(0).toUpperCase() + taskWord.slice(1),
        taskWord,
        cycleWord: getLabel('noun.cycle', { count: 2 }),
        completeButton: getLabel('action.completeCycle'),
        clearButton: getLabel('action.clearCompletedTasks'),
        ...overrides
    };
}
