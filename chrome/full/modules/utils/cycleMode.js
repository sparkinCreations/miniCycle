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
 * It also hosts the ROUTINE and AUTOCLEAR accessors (bottom of file). Since
 * Schema 2.6 the stored names ARE the product's words: routines live under
 * `data.routine` / `appState.activeRoutineId`, and a task's Clear on Reset /
 * Marked for Clearing choice is one per-mode map, `task.autoClear`
 * (`{ cycle, todo, ...any mode a later build adds }`). "Cycle" stays reserved
 * for a completion (`cycleCount`). Readers still go through these helpers so
 * the next rename is one file again.
 *
 * @module utils/cycleMode
 */

/**
 * @param {Object|null|undefined} cycle - A routine from state.data.routine
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
 * @param {Object|null|undefined} cycle - A routine from state.data.routine
 * @returns {'todo'|'cycle'}
 */
export function getAutoClearMode(cycle) {
    return getCycleMode(cycle) === 'todo' ? 'todo' : 'cycle';
}

/**
 * Repair a task's `autoClear` map if it is missing or malformed. The map is the
 * ONLY stored value since Schema 2.6 — the 2.5 `deleteWhenComplete` mirror that
 * had to be re-derived on load, on mode switch and on un-recurring is gone, and
 * with it the three call sites that each kept their own copy of that logic.
 *
 * Repair is PER KEY, never wholesale. Replacing the whole object when only the
 * entering mode's key was bad discarded the other mode's valid value:
 * `{ cycle: true }` entering To-Do became `{ cycle: false, todo: true }`, silently
 * losing the user's Cycle setting. Known keys come from the defaults map; a
 * boolean under any OTHER key is kept — the map is open, so a mode a newer build
 * adds survives a round trip through this one (SCHEMA_2_6_PLAN.md, "Built to
 * adapt"). Non-boolean junk under an unknown key is dropped.
 *
 * @param {Object} task - Task draft to mutate
 * @param {'todo'|'cycle'} mode - Active mode (see getAutoClearMode); kept in the
 *   signature so callers that track the mode need not change, unused here
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS; injected so
 *   this module stays dependency-free and callers keep their existing source
 *   (a DI dep in modeManager, a plain import elsewhere).
 * @returns {{repaired: boolean, changed: boolean}} both true when the map was
 *   rebuilt (they are the same thing now; `changed` stays for callers that
 *   track a dirty flag)
 */
export function syncTaskAutoClear(task, mode, defaults) {
    if (!task || !defaults) return { repaired: false, changed: false };

    const stored = task.autoClear;
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
    if (storedIsObject) {
        for (const [key, value] of Object.entries(stored)) {
            if (key in next) continue;
            if (typeof value === 'boolean') next[key] = value;
            else repaired = true;
        }
    }

    if (repaired) task.autoClear = next;
    return { repaired, changed: repaired };
}

/**
 * Does a task clear itself in the given mode, given its `autoClear` map? The
 * map's entry for the mode is the answer; the hard defaults are the fallback.
 *
 * Read the ONE key that matters, not the whole map: `{ cycle: true }` is a
 * usable answer in cycle mode even though `todo` is missing, and discarding it
 * loses a real user choice. syncTaskAutoClear repairs per key for the same
 * reason.
 *
 * @param {Object} args
 * @param {Object|undefined} args.settings - task.autoClear
 * @param {'todo'|'cycle'} args.mode - see getAutoClearMode
 * @param {Object} args.defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * @returns {boolean}
 */
export function resolveAutoClear({ settings, mode, defaults }) {
    if (settings && typeof settings === 'object' && typeof settings[mode] === 'boolean') {
        return settings[mode];
    }
    return defaults[mode];
}

/**
 * Which reset indicator a task shows, if any.
 *
 * The two are mutually exclusive by construction, and the rule is NOT simply
 * "show what autoClear says" — it differs per mode, and recurring
 * tasks are special-cased in both directions:
 *
 *   To-Do   the default is to delete, so only the OPT-OUT is worth marking
 *           -> 'keep' when the task will survive
 *   Cycle   the default is to keep, so only the OPT-IN is worth marking
 *           -> 'clear' when the task will be removed... except for recurring
 *              tasks, whose own indicator already implies removal
 *           -> 'keep' when a RECURRING task has been opted out of removal,
 *              which is the one case where that is surprising
 *
 * Lives here rather than in either renderer because the routine list and the
 * Task view both need the same answer, and a second copy would drift — the
 * fault line in REVIEW_PATTERNS.md §4 that this module already exists to close.
 *
 * @param {Object} args
 * @param {boolean} args.autoClear - see getAutoClear
 * @param {boolean} args.isRecurring
 * @param {'todo'|'cycle'} args.mode
 * @returns {'clear'|'keep'|null}
 */
export function getTaskResetIndicator({ autoClear, isRecurring, mode }) {
    if (mode === 'todo') {
        return autoClear ? null : 'keep';
    }
    if (autoClear) return isRecurring ? null : 'clear';
    return isRecurring ? 'keep' : null;
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
 * @param {Object|null|undefined} cycle - A routine from state.data.routine
 * @returns {string} A `focusTask.*` label key
 */
export function getAllDoneHintKey(cycle) {
    switch (getCycleMode(cycle)) {
        case 'todo': return 'focusTask.allDoneHintTodo';
        case 'auto': return 'focusTask.allDoneHintAuto';
        default:     return 'focusTask.allDoneHintCycle';
    }
}

// ============================================================================
// ROUTINE AND AUTOCLEAR ACCESSORS
// ============================================================================
// Every reader of the stored routine map, the active routine id and a task's
// autoClear map goes through here — that is what let Schema 2.6 rename the keys
// in one file. Keep it that way: do NOT alias on the data itself (measured Sep
// 2026: a hidden getter vanishes under structuredClone, a visible one makes JSON
// store every routine twice, a Proxy makes structuredClone throw).

/**
 * All routines, keyed by routine id (stored as `state.data.routine`).
 * @param {Object|null|undefined} state - Schema 2.6 state (AppState.get())
 * @returns {Object|null} The routines map, or null when there is no data
 */
export function getRoutines(state) {
    const routines = state?.data?.routine;
    return routines && typeof routines === 'object' ? routines : null;
}

/**
 * Id of the routine currently open (stored as `state.appState.activeRoutineId`).
 * @param {Object|null|undefined} state - Schema 2.6 state
 * @returns {string|null}
 */
export function getActiveRoutineId(state) {
    return state?.appState?.activeRoutineId ?? null;
}

/**
 * One routine by id. Uses an own-property check because the routines map is a
 * plain object: a truthiness lookup would "find" `constructor` or `toString`.
 * @param {Object|null|undefined} state - Schema 2.6 state
 * @param {string|null|undefined} routineId
 * @returns {Object|null} The routine object itself (not a copy), or null
 */
export function getRoutine(state, routineId) {
    const routines = getRoutines(state);
    if (!routines || !routineId) return null;
    if (!Object.prototype.hasOwnProperty.call(routines, routineId)) return null;
    return routines[routineId] ?? null;
}

/**
 * The routine currently open. Returns the object itself, so inside an
 * AppState.update() producer, changes made to it land in state.
 * @param {Object|null|undefined} state - Schema 2.6 state
 * @returns {Object|null}
 */
export function getActiveRoutine(state) {
    return getRoutine(state, getActiveRoutineId(state));
}

/**
 * Open a different routine by writing `state.appState.activeRoutineId`. Mutates
 * `state` — call it inside an AppState.update() producer. This only changes which
 * routine is active; switching routines in the UI still goes through the routine
 * switcher, which also re-renders and records undo/history.
 * @param {Object} state - Schema 2.6 state draft
 * @param {string} routineId
 * @returns {void}
 */
export function setActiveRoutineId(state, routineId) {
    if (!state || typeof state !== 'object') return;
    if (!state.appState || typeof state.appState !== 'object') state.appState = {};
    state.appState.activeRoutineId = routineId;
}

/**
 * Does the routine have any tasks at all? Reads state, never the rendered lists:
 * the completed dropdown moves finished rows out of `#taskList`, so an element
 * count says "no tasks" for a routine whose every task is simply done.
 * @param {Object|null|undefined} routine - A routine from state.data.routine
 * @returns {boolean}
 */
export function routineHasTasks(routine) {
    return Array.isArray(routine?.tasks) && routine.tasks.length > 0;
}

/**
 * Is every task in the routine complete? False for a routine with no tasks — an
 * empty routine is not a finished one. The one answer to "is this routine done?",
 * shared by cycle completion and the Complete button so they can never disagree.
 * @param {Object|null|undefined} routine - A routine from state.data.routine
 * @returns {boolean}
 */
export function areAllTasksComplete(routine) {
    return routineHasTasks(routine) && routine.tasks.every(task => task?.completed === true);
}

/**
 * Does this task clear itself in its routine's current mode? That is "Clear on
 * Reset" in the cycle modes and "Marked for Clearing" in To-Do mode.
 * @param {Object|null|undefined} task
 * @param {Object|null|undefined} routine - The task's routine (sets the mode)
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * @returns {boolean}
 */
export function getAutoClear(task, routine, defaults) {
    return getAutoClearForMode(task, getAutoClearMode(routine), defaults);
}

/**
 * {@link getAutoClear} for callers that already hold the mode key rather than
 * the routine (the DOM sync helpers, cleared-task records that remember the
 * mode they were cleared in).
 * @param {Object|null|undefined} task
 * @param {'todo'|'cycle'} mode - see getAutoClearMode
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * @returns {boolean}
 */
export function getAutoClearForMode(task, mode, defaults) {
    return resolveAutoClear({ settings: task?.autoClear, mode, defaults });
}

/**
 * The task's per-mode auto-clear map as stored — `{ cycle, todo, ... }` — or
 * undefined when the task has none. Not validated: use {@link isAutoClearSettings}
 * before trusting a key, or {@link getAutoClear} to read one mode safely.
 * @param {Object|null|undefined} task
 * @returns {Object|undefined}
 */
export function getAutoClearSettings(task) {
    return task?.autoClear ?? undefined;
}

/**
 * Is `settings` a usable per-mode map — a boolean for every key in `defaults`?
 * @param {*} settings
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * @returns {boolean}
 */
export function isAutoClearSettings(settings, defaults) {
    if (!settings || typeof settings !== 'object' || !defaults) return false;
    return Object.keys(defaults).every(key => typeof settings[key] === 'boolean');
}

/**
 * Replace a task's whole per-mode map. Missing known keys are filled from
 * `defaults` and non-boolean junk dropped (the same per-key repair the loader
 * does); extra boolean modes are kept. Mutates `task` — call it inside an
 * AppState.update() producer.
 * @param {Object} task - Task draft to mutate
 * @param {Object|null|undefined} settings - The new map; null/undefined means "all defaults"
 * @param {Object|null|undefined} routine - The task's routine (names the mode in the return value)
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS or DEFAULT_RECURRING_DELETE_SETTINGS
 * @returns {'todo'|'cycle'|null} The routine's mode key, or null when nothing was written
 */
export function setAutoClearSettings(task, settings, routine, defaults) {
    if (!task || !defaults) return null;
    const mode = getAutoClearMode(routine);
    task.autoClear = settings && typeof settings === 'object' ? { ...settings } : { ...defaults };
    syncTaskAutoClear(task, mode, defaults);
    return mode;
}

/**
 * The stored auto-clear field for a task or template built from scratch — spread
 * the result into the object literal. This is the ONE place a literal's stored
 * name is spelled.
 *
 * The map is a copy of `settings` (or of `defaults` when there is none). When
 * `value` is a boolean AND a mode is known, that mode's entry is set to it —
 * how a recreated recurring instance is forced to clear in the routine's current
 * mode whatever its template says. With no mode (templates carry none) `value`
 * has nothing to apply to and is ignored.
 *
 * @param {Object} args
 * @param {Object|null|undefined} args.settings - per-mode map; null/undefined means a copy of `defaults`
 * @param {Object} args.defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS or DEFAULT_RECURRING_DELETE_SETTINGS
 * @param {'todo'|'cycle'} [args.mode] - see getAutoClearMode
 * @param {boolean} [args.value] - explicit value for `mode`
 * @returns {{autoClear: Object}}
 */
export function autoClearFields({ settings, defaults, mode, value } = {}) {
    const map = settings && typeof settings === 'object' ? { ...settings } : { ...defaults };
    if (typeof value === 'boolean' && mode) map[mode] = value;
    return { autoClear: map };
}

/**
 * Turn Clear on Reset / Marked for Clearing on or off for the routine's current
 * mode — the same write the task's toggle button makes (taskButtons.js). The
 * other mode's setting is kept. Mutates `task` — call it inside an
 * AppState.update() producer.
 *
 * The map is repaired per key first (syncTaskAutoClear), then replaced with a
 * fresh object rather than edited in place, so a task that holds the frozen
 * defaults object by reference can never make this throw.
 *
 * @param {Object} task - Task draft to mutate
 * @param {Object|null|undefined} routine - The task's routine (sets the mode)
 * @param {boolean} value - true to clear the task automatically
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * @returns {'todo'|'cycle'|null} The mode key written, or null when nothing was
 */
export function setAutoClear(task, routine, value, defaults) {
    if (!task || !defaults) return null;
    const mode = getAutoClearMode(routine);
    const next = value === true;

    syncTaskAutoClear(task, mode, defaults);
    task.autoClear = { ...task.autoClear, [mode]: next };
    return mode;
}
