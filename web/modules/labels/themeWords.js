/**
 * The active vocabulary theme's words, for labels that name tasks, cycles or
 * the Complete / Clear buttons in a sentence (Nov 2026).
 *
 * Themes rename tasks ("habits", "exercises"), cycles ("check-ins",
 * "workouts") and the buttons ("Complete Check-in", "Clear Habits"). The
 * help window's status line and tips, its mode descriptions, the mode
 * menu's tooltips, Focus View's Switch Mode dialog and the menu's Mode Info
 * take these as vars instead of saying "task" / "Complete Cycle" under
 * every theme. Read at call time, so they follow a theme or routine change.
 *
 * Pure leaf (labels only) so it can be imported statically.
 */
import { getLabel } from './labelResolver.js';

/**
 * @param {Object} [overrides] - e.g. { button } for Focus View's own action label
 * @returns {{tasks: string, taskWord: string, taskOne: string, cycleWord: string, cycleOne: string, completeButton: string, clearButton: string}}
 *   tasks — the plural task noun capitalised to open a sentence ("Habits");
 *   taskWord / cycleWord — the plural nouns mid-sentence ("habits", "check-ins");
 *   taskOne / cycleOne — the singular nouns ("habit", "check-in");
 *   taskTitle — the singular task noun capitalised for a menu item ("Habit");
 *   completeButton / clearButton — Home View's button names.
 */
export function themeWordVars(overrides = {}) {
    const taskWord = getLabel('noun.task', { count: 2 });
    const taskOne = getLabel('noun.task', { count: 1 });
    return {
        tasks: taskWord.charAt(0).toUpperCase() + taskWord.slice(1),
        taskWord,
        taskOne,
        taskTitle: taskOne.charAt(0).toUpperCase() + taskOne.slice(1),
        cycleWord: getLabel('noun.cycle', { count: 2 }),
        cycleOne: getLabel('noun.cycle', { count: 1 }),
        completeButton: getLabel('action.completeCycle'),
        clearButton: getLabel('action.clearCompletedTasks'),
        ...overrides
    };
}

/**
 * What the input bar's toggle does next. The one name for it in all three menus
 * (+ Actions, ☰ and Focus View's ⋯), in the active theme's words.
 * @param {boolean} isVisible - whether the bar is showing now
 * @returns {string}
 */
export function inputBarToggleLabel(isVisible) {
    return getLabel(isVisible ? 'nav.hideAddTaskBar' : 'nav.addTasks', { vars: themeWordVars() });
}
