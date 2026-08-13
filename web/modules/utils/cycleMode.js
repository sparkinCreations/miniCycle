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
 * The `deleteWhenCompleteSettings` key for a cycle.
 *
 * That map is keyed by TWO modes, not the three above: auto and manual routines
 * both reset rather than delete, so both use the `cycle` key. Callers wrote this
 * inline as `cycle?.deleteCheckedTasks === true ? 'todo' : 'cycle'`.
 *
 * @param {Object|null|undefined} cycle - A cycle from state.data.cycles
 * @returns {'todo'|'cycle'}
 */
export function getDeleteSettingsMode(cycle) {
    return getCycleMode(cycle) === 'todo' ? 'todo' : 'cycle';
}

/**
 * Repair a task's `deleteWhenCompleteSettings` and re-derive `deleteWhenComplete`
 * from the mode currently in effect. Mutates `task` in place — call it inside an
 * `AppState.update()` producer.
 *
 * `deleteWhenComplete` is DERIVED state: the durable value is the per-mode map,
 * and the flat field is whichever entry matches the active mode. It therefore has
 * to be re-derived on load, on mode switch, and whenever a task stops being
 * recurring — which is why three call sites had grown their own copy of this.
 *
 * Repair is PER KEY, never wholesale. Replacing the whole object when only the
 * entering mode's key was bad discarded the other mode's valid value:
 * `{ cycle: true }` entering To-Do became `{ cycle: false, todo: true }`, silently
 * losing the user's Cycle setting. Keys come from the defaults map, so a third
 * mode would stay covered.
 *
 * @param {Object} task - Task draft to mutate
 * @param {'todo'|'cycle'} mode - Active mode (see getDeleteSettingsMode)
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS; injected so
 *   this module stays dependency-free and callers keep their existing source
 *   (a DI dep in modeManager, a plain import elsewhere).
 * @returns {{repaired: boolean, changed: boolean}} `repaired` when the settings
 *   map was invalid and rebuilt; `changed` when anything at all was written, so
 *   callers tracking a dirty flag can do so without re-comparing.
 */
export function syncTaskDeleteWhenComplete(task, mode, defaults) {
    if (!task || !defaults) return { repaired: false, changed: false };

    const stored = task.deleteWhenCompleteSettings;
    const storedIsObject = !!stored && typeof stored === 'object';
    let repaired = !storedIsObject;

    const next = {};
    for (const key of Object.keys(defaults)) {
        const value = storedIsObject ? stored[key] : undefined;
        if (typeof value === 'boolean') {
            next[key] = value;
        } else {
            next[key] = defaults[key];
            repaired = true;
        }
    }
    // A stored map carrying extra keys is still a rebuild — dropping them is the
    // point, but it means the object changed even when every known key was valid.
    if (storedIsObject && Object.keys(stored).length !== Object.keys(next).length) {
        repaired = true;
    }

    let changed = repaired;
    if (repaired) task.deleteWhenCompleteSettings = next;

    const expected = next[mode] ?? defaults[mode];
    if (task.deleteWhenComplete !== expected) {
        task.deleteWhenComplete = expected;
        changed = true;
    }

    return { repaired, changed };
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
