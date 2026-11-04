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
import { isPriorityLevel, getPriorityLevel } from '../utils/priorityLevel.js';
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
 * @param {string|null} [fields.dueTime=null] - "HH:MM"; only kept beside a dueDate
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
    dueTime = null,
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
        dueTime: dueDate ? (dueTime || null) : null,
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

/**
 * Mirror edits on the live task onto its recurring template.
 *
 * The template is what the watcher recreates the task from, so any field it
 * carries that the user can edit on the task must follow the edit — otherwise
 * the change holds only until the next occurrence, which comes back with the
 * template's old value. Priority (Mar 2026) and due date (Oct 2026) got their
 * own ad-hoc syncs; text and the reminder flag never had one (a renamed
 * recurring task came back under its old name). This is the one place.
 *
 * Pure: mutates the draft routine inside an AppState.update producer.
 * @param {Object|null|undefined} routine - draft routine
 * @param {string} taskId
 * @param {{text?: string, dueDate?: string|null, dueTime?: string|null, priority?: string|null, remindersEnabled?: boolean}} fields
 * @param {{dryRun?: boolean}} [options] - dryRun only reports whether anything differs
 * @returns {boolean} true when a template exists and at least one field differed
 */
export function syncTemplateFromTask(routine, taskId, fields, { dryRun = false } = {}) {
    const template = routine?.recurringTemplates?.[taskId];
    if (!template || !fields) return false;
    let changed = false;
    const put = (key, value) => {
        if (template[key] === value) return;
        if (!dryRun) template[key] = value;
        changed = true;
    };
    if (typeof fields.text === 'string' && fields.text.trim()) put('text', fields.text);
    if ('dueDate' in fields) put('dueDate', fields.dueDate || null);
    // Templates written before Oct 2026 have no dueTime key; missing and null
    // mean the same, so only a real difference counts as a repair.
    if ('dueTime' in fields) {
        const time = fields.dueDate === undefined || fields.dueDate ? (fields.dueTime || null) : null;
        if ((template.dueTime ?? null) !== time) put('dueTime', time);
    }
    if ('priority' in fields) put('priority', isPriorityLevel(fields.priority) ? fields.priority : null);
    if ('remindersEnabled' in fields) put('remindersEnabled', fields.remindersEnabled === true);
    return changed;
}

/**
 * Repair every template in a routine from its live task (text, due date,
 * priority, reminder flag). Covers edits made before the syncs existed. The
 * live task is the user-visible truth; a template whose task is gone (cleared,
 * awaiting its next occurrence) is left alone.
 * @param {Object|null|undefined} routine
 * @param {{dryRun?: boolean}} [options]
 * @returns {number} templates that differed (and were repaired unless dryRun)
 */
export function healTemplatesFromTasks(routine, { dryRun = false } = {}) {
    const templates = routine?.recurringTemplates;
    if (!templates || !Array.isArray(routine.tasks)) return 0;
    let healed = 0;
    for (const task of routine.tasks) {
        if (!task || !templates[task.id]) continue;
        const differed = syncTemplateFromTask(routine, task.id, {
            text: task.text,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            priority: getPriorityLevel(task),
            remindersEnabled: task.remindersEnabled === true
        }, { dryRun });
        if (differed) healed++;
    }
    return healed;
}

/**
 * Carry a biweekly task's Week 1 start date across a settings edit.
 *
 * Week 1 starts the day a biweekly task is set up (`biweekly.referenceDate`,
 * which the normaliser fills with "now" when missing). The settings panel never
 * sent that date back, so every re-save restarted Week 1 from the moment of the
 * save — editing a task during its Week 2 silently swapped the two weeks for
 * good. A task that was already biweekly keeps the date it had; a task becoming
 * biweekly now starts counting from now.
 *
 * @param {Object} settings - Normalised settings about to be saved (not mutated)
 * @param {Object|null|undefined} previousSettings - The task's settings before this save
 * @returns {Object} `settings`, or a copy carrying the previous start date
 */
export function keepBiweeklyStart(settings, previousSettings) {
    const previousStart = previousSettings?.frequency === 'biweekly'
        ? previousSettings.biweekly?.referenceDate
        : null;
    if (settings?.frequency !== 'biweekly' || !previousStart) return settings;
    return { ...settings, biweekly: { ...settings.biweekly, referenceDate: previousStart } };
}

/**
 * Settings without a biweekly Week 1 start date — for the saved recurring
 * defaults. A start date stored there would be handed to every task made from
 * the defaults later, so their weeks counted from the day the defaults were
 * saved rather than the day each task was set up.
 *
 * @param {Object} settings - Recurring settings (not mutated)
 * @returns {Object} A copy with `biweekly.referenceDate` cleared
 */
export function withoutBiweeklyStart(settings) {
    if (!settings?.biweekly?.referenceDate) return settings;
    return { ...settings, biweekly: { ...settings.biweekly, referenceDate: null } };
}
