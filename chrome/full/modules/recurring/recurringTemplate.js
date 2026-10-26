/**
 * @file recurringTemplate.js
 * @description Single definition of a `cycle.recurringTemplates[taskId]` record.
 * @module modules/recurring/recurringTemplate
 *
 * WHY THIS EXISTS
 * ---------------
 * Five places built this record by hand, and by Aug 2026 they had drifted into
 * five different field sets on a structure stamped `schemaVersion: 2`:
 *
 *                                act  appl  import  migrate  taskUtils
 *   deleteWhenComplete            ✓    ✓      ·        ·        ✓
 *   deleteWhenCompleteSettings    ✓    ✓      ·        ·        ✓
 *   occurrenceCount               ✓    ✓      ·        ·        ·
 *   lastTriggeredTimestamp        ✓    ✓      ·        ·        ✓
 *   nextScheduledOccurrence       ✓    ✓      ✓        ✓        ·
 *
 * That last omission was a live bug, not untidiness: recurringWatcher gates on
 * `template.nextScheduledOccurrence == null`, and `==` matches UNDEFINED as well
 * as null, so a template missing the field reads as "finished / exhausted" and
 * the task never recurs again. It shipped through the Cleared Tasks "Recreate"
 * flow (historyManager replays recurring settings into addTask → taskUtils), so
 * restored recurring tasks came back permanently inert. Fixed in v2.431; this
 * module is what stops the shape drifting apart again.
 *
 * NOT the same thing as `buildRecurringInstance` in recurringWatcher.js. That
 * builds a TASK (has `completed`, no scheduling fields) to push into
 * `cycle.tasks`. This builds the TEMPLATE that spawns those tasks. An audit note
 * once conflated the two; routing either through the other is a bug.
 */

import { DEFAULT_RECURRING_DELETE_SETTINGS } from '../core/constants.js';
import { isPriorityLevel } from '../utils/priorityLevel.js';
import { autoClearFields, getAutoClear } from '../utils/cycleMode.js';

/** Schema stamp for template records. Bump only alongside a migration. */
export const RECURRING_TEMPLATE_SCHEMA_VERSION = 2;

/**
 * Whether a recurring task is PINNED to the routine list right now: its
 * instance is in the list and set NOT to clear in the current mode (the 📌
 * state you get by switching off "Clear on Reset" / "Marked for Clearing").
 *
 * A pinned instance never leaves the list, and the watcher never spawns a
 * template whose instance is already there, so pinning already stops the
 * schedule. This makes that visible. It is DERIVED, never stored: unpinning
 * ends it with nothing to clear, and it follows the per-mode autoClear key, so
 * a task pinned in a cycle mode is not pinned in To-Do unless set there too.
 *
 * @param {Object|null|undefined} routine
 * @param {string} templateId - the template's id, which its instance shares
 * @returns {boolean}
 */
export function isRecurringPinned(routine, templateId) {
    const instance = Array.isArray(routine?.tasks) ? routine.tasks.find(t => t.id === templateId) : null;
    if (!instance) return false;
    return !getAutoClear(instance, routine, DEFAULT_RECURRING_DELETE_SETTINGS);
}

/**
 * Why a recurring template is not spawning, as the panel shows it.
 *
 *   'manual' — the user paused it. Always wins: pause first, then pin, and it
 *              reads as a normal pause; unpin, and it stays paused until the
 *              user resumes it.
 *   'pinned' — not paused by the user, but pinned to the list (see
 *              isRecurringPinned). Unpinning ends it on its own; the resume
 *              control is shown inactive, because there is no pause to undo.
 *   null     — neither.
 *
 * Resuming a 'manual' pause while pinned clears the user's pause; the panel
 * then reads 'pinned', and unpinning makes the task active.
 *
 * @param {Object|null|undefined} routine
 * @param {Object|null|undefined} template
 * @returns {'manual'|'pinned'|null}
 */
export function getRecurringPauseState(routine, template) {
    if (!template) return null;
    if (template.paused === true) return 'manual';
    return isRecurringPinned(routine, template.id) ? 'pinned' : null;
}

/**
 * Build a recurring template record.
 *
 * Every field is named here so a new one can never be added to some writers and
 * missed by others — which is exactly how the drift above happened.
 *
 * `nextScheduledOccurrence` is deliberately NOT optional-with-a-null-default.
 * A null is as dead as an absent field to the watcher, so silently defaulting it
 * would reintroduce the same bug wearing a field name. Callers must compute it,
 * and a missing one warns.
 *
 * @param {Object} fields
 * @param {string} fields.id - Task id this template spawns instances for
 * @param {string} fields.text - Task text
 * @param {Object} fields.recurringSettings - Normalised recurrence settings (cloned by the caller)
 * @param {number|null} fields.nextScheduledOccurrence - Epoch ms of the next due occurrence
 * @param {string|null} [fields.dueDate=null]
 * @param {'high'|'medium'|'low'|null} [fields.priority=null] - Priority level
 * @param {boolean} [fields.remindersEnabled=false]
 * @param {Object|null} [fields.autoClear=null] - Per-mode clear map; defaults to the recurring preset
 * @param {number} [fields.occurrenceCount=0]
 * @param {number|null} [fields.lastTriggeredTimestamp=null]
 * @param {boolean} [fields.paused=false] - A paused template keeps its schedule but
 *   the watcher never spawns from it; resuming reschedules from the moment of resume
 * @returns {Object} A complete template record
 */
export function buildRecurringTemplate({
    id,
    text,
    recurringSettings,
    nextScheduledOccurrence,
    dueDate = null,
    priority = null,
    remindersEnabled = false,
    autoClear = null,
    occurrenceCount = 0,
    lastTriggeredTimestamp = null,
    paused = false,
    // Index in routine.tasks where a recreated instance should land. Recorded when
    // the instance is removed (cycle reset, To-Do clear) and at activation/import;
    // null means "unknown", and the watcher appends as it always did. Without it
    // every recurring task came back at the bottom of the routine.
    position = null
} = {}) {
    if (nextScheduledOccurrence == null) {
        // Not thrown: a data path should not explode mid-write. But say it out
        // loud, because the symptom otherwise is "recurrence silently stopped".
        console.warn(
            `⚠️ Recurring template "${text ?? id}" has no nextScheduledOccurrence — ` +
            `recurringWatcher treats that as exhausted, so it will never fire.`
        );
    }
    return {
        id,
        text,
        recurring: true,
        recurringSettings,
        dueDate,
        priority: isPriorityLevel(priority) ? priority : null,
        remindersEnabled,
        ...autoClearFields({ settings: autoClear, defaults: DEFAULT_RECURRING_DELETE_SETTINGS }),
        occurrenceCount,
        lastTriggeredTimestamp,
        paused: paused === true,
        nextScheduledOccurrence: nextScheduledOccurrence ?? null,
        position: Number.isInteger(position) && position >= 0 ? position : null,
        schemaVersion: RECURRING_TEMPLATE_SCHEMA_VERSION
    };
}
