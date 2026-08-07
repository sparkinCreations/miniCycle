/**
 * Cycle Mode
 *
 * Pure helpers for "what kind of routine is this?". No DI, no side effects.
 *
 * A routine is in exactly one of three modes, derived from two booleans on the
 * cycle. The order matters: deleteCheckedTasks wins over autoReset, because a
 * To-Do routine deletes finished tasks rather than resetting them.
 *
 *   todo    deleteCheckedTasks — finished tasks are removed
 *   auto    autoReset          — the cycle resets itself once everything is done
 *   manual  neither            — the user presses the cycle button
 *
 * This exists because the derivation was already written privately in two
 * places with two different vocabularies ('todo'/'auto'/'manual' in
 * focusTaskPanel, 'todo-mode'/'auto-cycle'/'manual-cycle' in focusMode) — the
 * duplication fault line in REVIEW_PATTERNS.md §4, already drifting. focusMode
 * keeps its own copy for now: its strings are coupled to CSS body classes, so
 * unifying that vocabulary is a separate change.
 *
 * @module utils/cycleMode
 */

/**
 * @param {Object|null|undefined} cycle - A cycle from state.data.cycles
 * @returns {'todo'|'auto'|'manual'}
 */
export function getCycleMode(cycle) {
    if (cycle?.deleteCheckedTasks) return 'todo';
    if (cycle?.autoReset) return 'auto';
    return 'manual';
}

/**
 * Label key for the "everything is finished, here's what happens next" hint.
 *
 * Each mode gets its own because the affordance genuinely differs — and in AUTO
 * mode there is no affordance at all: the complete/cycle button is hidden in
 * both surfaces (taskUI.checkCompleteAllButton skips it when the body carries
 * auto-cycle-mode, and focusMode hides the floating action button via CSS for
 * the same reason). Telling an auto-cycle user to "use the cycle button" points
 * them at a control that is not on screen. Auto resets on its own, so its hint
 * describes rather than instructs.
 *
 * @param {Object|null|undefined} cycle - A cycle from state.data.cycles
 * @returns {string} A `focusTask.*` label key
 */
export function getAllDoneHintKey(cycle) {
    switch (getCycleMode(cycle)) {
        case 'todo': return 'focusTask.allDoneHintTodo';
        case 'auto': return 'focusTask.allDoneHintAuto';
        default:     return 'focusTask.allDoneHintCycle';
    }
}
