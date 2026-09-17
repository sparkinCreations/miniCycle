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
 * It also hosts the NAMING HELPERS (bottom of file) that let new code speak the
 * product's words while the stored schema keeps its old ones: "routine" for the
 * checklist (stored under `data.cycles` / `appState.activeCycleId`) and
 * "autoClear" for Clear on Reset / Marked for Clearing (stored as
 * `deleteWhenComplete` / `deleteWhenCompleteSettings`). "Cycle" stays reserved for
 * a completion (`cycleCount`). Schema 2.6 renames the stored keys; until then
 * only the insides of those helpers know the old names.
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
 * The `deleteWhenComplete` value actually in effect for a task.
 *
 * DERIVED, with a priority order that matters: the per-mode map is canonical,
 * the flat field is a legacy/transitional mirror of it, and the hard defaults
 * are last resort. Reading the flat field first would give a stale answer right
 * after a mode switch, before syncTaskDeleteWhenComplete has re-derived it.
 *
 * @param {Object} args
 * @param {Object|undefined} args.settings - task.deleteWhenCompleteSettings
 * @param {boolean|undefined} args.legacy - task.deleteWhenComplete
 * @param {'todo'|'cycle'} args.mode - see getDeleteSettingsMode
 * @param {Object} args.defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * @returns {boolean}
 */
export function resolveDeleteWhenComplete({ settings, legacy, mode, defaults }) {
    // Read the ONE key that matters, not the whole map. An earlier version
    // (inherited verbatim from taskDOM when this was extracted) validated the
    // map wholesale and substituted `defaults` when any key was bad — which
    // made the legacy branch below unreachable, since a default always supplies
    // a boolean for the mode. A task with no settings and `deleteWhenComplete:
    // true` therefore resolved to the mode DEFAULT, silently ignoring the only
    // signal it had.
    //
    // Per-key is also what syncTaskDeleteWhenComplete does two functions down,
    // and for the same reason: `{ cycle: true }` is a usable answer in cycle
    // mode even though `todo` is missing, and discarding it loses a real user
    // choice.
    if (settings && typeof settings === 'object' && typeof settings[mode] === 'boolean') {
        return settings[mode];
    }
    if (typeof legacy === 'boolean') return legacy;
    return defaults[mode];
}

/**
 * Which reset indicator a task shows, if any.
 *
 * The two are mutually exclusive by construction, and the rule is NOT simply
 * "show what deleteWhenComplete says" — it differs per mode, and recurring
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
 * @param {boolean} args.deleteWhenComplete - see resolveDeleteWhenComplete
 * @param {boolean} args.isRecurring
 * @param {'todo'|'cycle'} args.mode
 * @returns {'clear'|'keep'|null}
 */
export function getTaskResetIndicator({ deleteWhenComplete, isRecurring, mode }) {
    if (mode === 'todo') {
        return deleteWhenComplete ? null : 'keep';
    }
    if (deleteWhenComplete) return isRecurring ? null : 'clear';
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

// ============================================================================
// NAMING HELPERS — routine and autoClear
// ============================================================================
// These exist so NEW code can say "routine" and "autoClear" without renaming the
// stored schema. They read and write the OLD stored keys, and deliberately add no
// new ones: an alias placed on the data itself does not survive the app's own
// plumbing — measured Sep 2026, a hidden getter vanishes under structuredClone
// (AppState.update, undo snapshots), a visible one makes JSON store every routine
// twice (two diverging copies after reload), and a Proxy makes structuredClone
// throw. Existing code that uses the stored names keeps working unchanged.

/**
 * All routines, keyed by routine id (stored as `state.data.cycles`).
 * @param {Object|null|undefined} state - Schema 2.5 state (AppState.get())
 * @returns {Object|null} The routines map, or null when there is no data
 */
export function getRoutines(state) {
    const routines = state?.data?.cycles;
    return routines && typeof routines === 'object' ? routines : null;
}

/**
 * Id of the routine currently open (stored as `state.appState.activeCycleId`).
 * @param {Object|null|undefined} state - Schema 2.5 state
 * @returns {string|null}
 */
export function getActiveRoutineId(state) {
    return state?.appState?.activeCycleId ?? null;
}

/**
 * One routine by id. Uses an own-property check because the routines map is a
 * plain object: a truthiness lookup would "find" `constructor` or `toString`.
 * @param {Object|null|undefined} state - Schema 2.5 state
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
 * @param {Object|null|undefined} state - Schema 2.5 state
 * @returns {Object|null}
 */
export function getActiveRoutine(state) {
    return getRoutine(state, getActiveRoutineId(state));
}

/**
 * Open a different routine by writing `state.appState.activeCycleId`. Mutates
 * `state` — call it inside an AppState.update() producer. This only changes which
 * routine is active; switching routines in the UI still goes through the routine
 * switcher, which also re-renders and records undo/history.
 * @param {Object} state - Schema 2.5 state draft
 * @param {string} routineId
 * @returns {void}
 */
export function setActiveRoutineId(state, routineId) {
    if (!state || typeof state !== 'object') return;
    if (!state.appState || typeof state.appState !== 'object') state.appState = {};
    state.appState.activeCycleId = routineId;
}

/**
 * Does the routine have any tasks at all? Reads state, never the rendered lists:
 * the completed dropdown moves finished rows out of `#taskList`, so an element
 * count says "no tasks" for a routine whose every task is simply done.
 * @param {Object|null|undefined} routine - A routine from state.data.cycles
 * @returns {boolean}
 */
export function routineHasTasks(routine) {
    return Array.isArray(routine?.tasks) && routine.tasks.length > 0;
}

/**
 * Is every task in the routine complete? False for a routine with no tasks — an
 * empty routine is not a finished one. The one answer to "is this routine done?",
 * shared by cycle completion and the Complete button so they can never disagree.
 * @param {Object|null|undefined} routine - A routine from state.data.cycles
 * @returns {boolean}
 */
export function areAllTasksComplete(routine) {
    return routineHasTasks(routine) && routine.tasks.every(task => task?.completed === true);
}

/**
 * autoClear name for {@link getDeleteSettingsMode}: which settings key applies
 * to a routine — 'todo' (Marked for Clearing) or 'cycle' (Clear on Reset).
 * @type {typeof getDeleteSettingsMode}
 */
export const getAutoClearMode = getDeleteSettingsMode;

/**
 * autoClear name for {@link syncTaskDeleteWhenComplete}.
 * @type {typeof syncTaskDeleteWhenComplete}
 */
export const syncTaskAutoClear = syncTaskDeleteWhenComplete;

/**
 * autoClear name for {@link resolveDeleteWhenComplete}.
 * @type {typeof resolveDeleteWhenComplete}
 */
export const resolveAutoClear = resolveDeleteWhenComplete;

/**
 * Does this task clear itself in its routine's current mode? That is "Clear on
 * Reset" in the cycle modes and "Marked for Clearing" in To-Do mode.
 * @param {Object|null|undefined} task
 * @param {Object|null|undefined} routine - The task's routine (sets the mode)
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * @returns {boolean}
 */
export function getAutoClear(task, routine, defaults) {
    return getAutoClearForMode(task, getDeleteSettingsMode(routine), defaults);
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
    return resolveDeleteWhenComplete({
        settings: task?.deleteWhenCompleteSettings,
        legacy: task?.deleteWhenComplete,
        mode,
        defaults
    });
}

/**
 * The task's per-mode auto-clear map as stored — `{ cycle, todo }` — or
 * undefined when the task has none. Not validated: use {@link isAutoClearSettings}
 * before trusting a key, or {@link getAutoClear} to read one mode safely.
 * @param {Object|null|undefined} task
 * @returns {Object|undefined}
 */
export function getAutoClearSettings(task) {
    return task?.deleteWhenCompleteSettings ?? undefined;
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
 * Replace a task's whole per-mode map and re-derive its active value for the
 * routine's current mode. Keys `defaults` does not name are dropped and missing
 * ones filled from `defaults` (the same per-key repair the loader does). Mutates
 * `task` — call it inside an AppState.update() producer.
 * @param {Object} task - Task draft to mutate
 * @param {Object|null|undefined} settings - The new map; null/undefined means "all defaults"
 * @param {Object|null|undefined} routine - The task's routine (sets the mode)
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS or DEFAULT_RECURRING_DELETE_SETTINGS
 * @returns {'todo'|'cycle'|null} The mode key the active value was derived for, or null when nothing was written
 */
export function setAutoClearSettings(task, settings, routine, defaults) {
    if (!task || !defaults) return null;
    const mode = getDeleteSettingsMode(routine);
    task.deleteWhenCompleteSettings = settings && typeof settings === 'object' ? { ...settings } : { ...defaults };
    syncTaskDeleteWhenComplete(task, mode, defaults);
    return mode;
}

/**
 * The stored auto-clear fields for a task or template built from scratch — spread
 * the result into the object literal. This is the ONE place a literal's stored
 * names are spelled, so Schema 2.6 changes what it returns and nothing else.
 *
 * Until the collapse, the active value is written beside the map (its "mirror").
 * When `value` is a boolean it is written as given — that is how a recreated
 * recurring instance is forced to clear regardless of its template's map;
 * otherwise it is derived from `settings[mode]` (falling back to `defaults`) when
 * a mode is known, and left undefined when not (templates carry no mode).
 *
 * @param {Object} args
 * @param {Object|null|undefined} args.settings - per-mode map; null/undefined means a copy of `defaults`
 * @param {Object} args.defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS or DEFAULT_RECURRING_DELETE_SETTINGS
 * @param {'todo'|'cycle'} [args.mode] - see getAutoClearMode
 * @param {boolean} [args.value] - explicit active value
 * @returns {{deleteWhenComplete: (boolean|undefined), deleteWhenCompleteSettings: Object}}
 */
export function autoClearFields({ settings, defaults, mode, value } = {}) {
    const map = settings && typeof settings === 'object' ? settings : { ...defaults };
    let active;
    if (typeof value === 'boolean') {
        active = value;
    } else if (mode) {
        active = resolveDeleteWhenComplete({ settings: map, legacy: undefined, mode, defaults });
    }
    return { deleteWhenComplete: active, deleteWhenCompleteSettings: map };
}

/**
 * Turn Clear on Reset / Marked for Clearing on or off for the routine's current
 * mode — the same write the task's toggle button makes (taskButtons.js): the
 * per-mode setting AND its flat mirror. The other mode's setting is kept. Mutates
 * `task` — call it inside an AppState.update() producer.
 *
 * The settings map is repaired per key first (syncTaskDeleteWhenComplete), then
 * replaced with a fresh object rather than edited in place, so a task that holds
 * the frozen defaults object by reference can never make this throw.
 *
 * @param {Object} task - Task draft to mutate
 * @param {Object|null|undefined} routine - The task's routine (sets the mode)
 * @param {boolean} value - true to clear the task automatically
 * @param {Object} defaults - DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
 * @returns {'todo'|'cycle'|null} The mode key written, or null when nothing was
 */
export function setAutoClear(task, routine, value, defaults) {
    if (!task || !defaults) return null;
    const mode = getDeleteSettingsMode(routine);
    const next = value === true;

    syncTaskDeleteWhenComplete(task, mode, defaults);
    task.deleteWhenCompleteSettings = { ...task.deleteWhenCompleteSettings, [mode]: next };
    task.deleteWhenComplete = next;
    return mode;
}
