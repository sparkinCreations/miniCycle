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

/** Schema stamp for template records. Bump only alongside a migration. */
export const RECURRING_TEMPLATE_SCHEMA_VERSION = 2;

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
 * @param {boolean} [fields.highPriority=false]
 * @param {string|null} [fields.priorityColor=null]
 * @param {boolean} [fields.remindersEnabled=false]
 * @param {boolean} [fields.deleteWhenComplete=true] - Recurring instances auto-remove by default
 * @param {Object|null} [fields.deleteWhenCompleteSettings=null] - Defaults to the recurring preset
 * @param {number} [fields.occurrenceCount=0]
 * @param {number|null} [fields.lastTriggeredTimestamp=null]
 * @returns {Object} A complete template record
 */
export function buildRecurringTemplate({
    id,
    text,
    recurringSettings,
    nextScheduledOccurrence,
    dueDate = null,
    highPriority = false,
    priorityColor = null,
    remindersEnabled = false,
    deleteWhenComplete = true,
    deleteWhenCompleteSettings = null,
    occurrenceCount = 0,
    lastTriggeredTimestamp = null
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
        highPriority,
        priorityColor,
        remindersEnabled,
        deleteWhenComplete,
        deleteWhenCompleteSettings:
            deleteWhenCompleteSettings ?? { ...DEFAULT_RECURRING_DELETE_SETTINGS },
        occurrenceCount,
        lastTriggeredTimestamp,
        nextScheduledOccurrence: nextScheduledOccurrence ?? null,
        schemaVersion: RECURRING_TEMPLATE_SCHEMA_VERSION
    };
}
