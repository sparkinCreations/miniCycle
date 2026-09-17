/**
 * Schema 2.5 → 2.6 migration
 *
 * ONE migration, ONE version bump (docs/future-work/SCHEMA_2_6_PLAN.md, "Ordering" step 7),
 * built from ordered steps that are exported so each is tested on its own:
 *
 *   1. rekeyRoutines        — STATE_TRUTH_MIGRATION #20: routines keyed by a stable generated
 *                             id instead of their display name; `title` is the name
 *   2. collapseAutoClear    — Rename A: `deleteWhenCompleteSettings` + the `deleteWhenComplete`
 *                             mirror become one open `autoClear` map (the reconciler that kept
 *                             the pair in agreement has nothing left to reconcile)
 *   3. convertPriority      — `highPriority` + `priorityColor` become `priority`
 *                             ('high' | 'medium' | 'low' | null) on tasks, recurring templates,
 *                             cleared-task entries and history details
 *   4. renameRoutineKeys    — Rename B: `data.cycles` → `data.routine`,
 *                             `appState.activeCycleId` → `appState.activeRoutineId`,
 *                             `metadata.totalCyclesCreated` → `totalRoutinesCreated`
 *   5. stampVersion         — document + metadata version, migratedFrom / migrationDate
 *
 * Pure: no DI, no storage, no DOM. It never mutates its input — callers get a new document.
 * Everything it needs from the outside (an id maker, a clock, the theme swatch sets that map a
 * stored colour to its level) is passed in, so it can run in a test, a dry-run tool or boot.
 *
 * NOT WIRED YET. Nothing calls migrateSchema_2_5_to_2_6 at runtime; SCHEMA.CURRENT is still
 * "2.5". Wiring it (the gate, the boot entry, the helpers' internals, the .mcyc schemas) is
 * the release step and waits for the platform builds to carry the forward-compatibility guard.
 *
 * @module routine/schemaMigration26
 */

import { classifyStoredVersion } from '../utils/schemaVersion.js';
import { getPriorityLevel } from '../utils/priorityLevel.js';
import { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS } from '../core/constants.js';

export const SCHEMA_2_6 = '2.6';
const SCHEMA_2_5 = '2.5';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The stored 2.5 `deleteWhenCompleteSettings` map as a valid 2.6 `autoClear` map.
 *
 * Every known mode is present and boolean, defaulting like syncTaskDeleteWhenComplete
 * repairs it. Unknown mode keys are kept when boolean: the map is OPEN in 2.6 — the plan's
 * "Built to adapt" item 1 — so a mode a newer build adds survives a round trip.
 *
 * The 2.5 `deleteWhenComplete` mirror is ignored on purpose: it is DERIVED from the map for
 * the routine's current mode, arrives disagreeing on every import, and re-deriving it at
 * read time is exactly what the collapse removes.
 *
 * @param {*} settings - 2.5 `deleteWhenCompleteSettings` (or 2.6 `autoClear`)
 * @param {Object} [defaults=DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS]
 * @returns {Object} `{ cycle, todo, ...extra boolean modes }`
 */
export function toAutoClear(settings, defaults = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS) {
    const out = {};
    for (const mode of Object.keys(defaults)) {
        out[mode] = isObject(settings) && typeof settings[mode] === 'boolean' ? settings[mode] : defaults[mode];
    }
    if (isObject(settings)) {
        for (const [mode, value] of Object.entries(settings)) {
            if (!hasOwn(out, mode) && typeof value === 'boolean') out[mode] = value;
        }
    }
    return out;
}

/**
 * The 2.6 `priority` for a 2.5 record: the swatch level of a known colour, the colour
 * family of any other hex, 'high' for a flagged record with no colour, null when not flagged.
 * @param {boolean} flagged - 2.5 `highPriority` (or `wasHighPriority`)
 * @param {*} color - 2.5 `priorityColor`
 * @param {Array<Array<{level: string, hex: string}>>} swatchSets - every theme's swatches
 * @returns {'high'|'medium'|'low'|null}
 */
export function toPriorityLevel(flagged, color, swatchSets) {
    return getPriorityLevel({ highPriority: flagged === true, priorityColor: color }, swatchSets);
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

/**
 * Re-key the routines map by generated ids. Each routine's `id` becomes its key, `title`
 * stays the display name, and `appState.activeCycleId` follows the active routine. A routine
 * without a title gets its old key as the title, so no name is lost.
 *
 * Keys are made by `makeId`, one per routine, in the map's own order; a collision with an
 * existing key is retried so the map can never silently merge two routines.
 *
 * @param {Object} doc - A 2.5 document (mutated in place — call on a clone)
 * @param {() => string} makeId
 * @returns {Object} the same document
 */
export function rekeyRoutines(doc, makeId) {
    const routines = doc?.data?.cycles;
    if (!isObject(routines)) return doc;
    const rekeyed = {};
    const keyMap = {};
    for (const [oldKey, routine] of Object.entries(routines)) {
        if (!isObject(routine)) continue;
        let newKey = makeId();
        while (hasOwn(rekeyed, newKey) || hasOwn(routines, newKey)) newKey = makeId();
        keyMap[oldKey] = newKey;
        rekeyed[newKey] = {
            ...routine,
            id: newKey,
            title: typeof routine.title === 'string' && routine.title.trim() ? routine.title : String(oldKey)
        };
    }
    doc.data.cycles = rekeyed;
    if (isObject(doc.appState)) {
        const active = doc.appState.activeCycleId;
        doc.appState.activeCycleId = active != null && hasOwn(keyMap, active) ? keyMap[active] : null;
    }
    return doc;
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function collapseRecord(record, defaults) {
    if (!isObject(record)) return;
    record.autoClear = toAutoClear(
        hasOwn(record, 'autoClear') ? record.autoClear : record.deleteWhenCompleteSettings,
        defaults
    );
    delete record.deleteWhenComplete;
    delete record.deleteWhenCompleteSettings;
}

/**
 * Rename A on every record that carries the pair: tasks, recurring templates and
 * cleared-task entries.
 * @param {Object} doc - mutated in place
 * @param {Object} [defaults=DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS]
 * @returns {Object} the same document
 */
export function collapseAutoClear(doc, defaults = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS) {
    for (const routine of routinesOf(doc)) {
        (routine.tasks ?? []).forEach(task => collapseRecord(task, defaults));
        Object.values(routine.recurringTemplates ?? {}).forEach(template => collapseRecord(template, defaults));
        (routine.clearedTasks?.entries ?? []).forEach(entry => collapseRecord(entry, defaults));
    }
    return doc;
}

// ── Step 3 ────────────────────────────────────────────────────────────────────

function convertPriorityRecord(record, flagKey, swatchSets) {
    if (!isObject(record)) return;
    if (!hasOwn(record, 'priority')) {
        record.priority = toPriorityLevel(record[flagKey], record.priorityColor, swatchSets);
    }
    delete record[flagKey];
    delete record.priorityColor;
}

/**
 * Priority as a level everywhere 2.5 stored it: tasks and recurring templates
 * (`highPriority` + `priorityColor`), cleared-task entries (`wasHighPriority` + `priorityColor`)
 * and history event details (`priorityColor`, whose presence meant "flagged").
 * `settings.priorityColor` (the last picked colour) becomes `settings.defaultPriority`.
 * @param {Object} doc - mutated in place
 * @param {Array<Array<{level: string, hex: string}>>} [swatchSets=[]] - every theme's swatches
 * @returns {Object} the same document
 */
export function convertPriority(doc, swatchSets = []) {
    for (const routine of routinesOf(doc)) {
        (routine.tasks ?? []).forEach(task => convertPriorityRecord(task, 'highPriority', swatchSets));
        Object.values(routine.recurringTemplates ?? {}).forEach(t => convertPriorityRecord(t, 'highPriority', swatchSets));
        (routine.clearedTasks?.entries ?? []).forEach(e => convertPriorityRecord(e, 'wasHighPriority', swatchSets));
        for (const event of routine.history?.events ?? []) {
            const details = event?.details;
            if (!isObject(details) || !hasOwn(details, 'priorityColor')) continue;
            if (!hasOwn(details, 'priority')) {
                details.priority = toPriorityLevel(true, details.priorityColor, swatchSets);
            }
            delete details.priorityColor;
        }
    }
    if (isObject(doc?.settings) && hasOwn(doc.settings, 'priorityColor')) {
        if (!hasOwn(doc.settings, 'defaultPriority')) {
            doc.settings.defaultPriority = toPriorityLevel(true, doc.settings.priorityColor, swatchSets);
        }
        delete doc.settings.priorityColor;
    }
    return doc;
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

/**
 * Rename B. `cycleCount`, `userProgress.cyclesCompleted` and `metadata.totalCyclesCompleted`
 * keep their names: they count completions, which really are cycles.
 * @param {Object} doc - mutated in place
 * @returns {Object} the same document
 */
export function renameRoutineKeys(doc) {
    if (isObject(doc?.data) && hasOwn(doc.data, 'cycles')) {
        doc.data.routine = doc.data.cycles;
        delete doc.data.cycles;
    }
    if (isObject(doc?.appState) && hasOwn(doc.appState, 'activeCycleId')) {
        doc.appState.activeRoutineId = doc.appState.activeCycleId;
        delete doc.appState.activeCycleId;
    }
    if (isObject(doc?.metadata) && hasOwn(doc.metadata, 'totalCyclesCreated')) {
        doc.metadata.totalRoutinesCreated = doc.metadata.totalCyclesCreated;
        delete doc.metadata.totalCyclesCreated;
    }
    return doc;
}

// ── Step 5 ────────────────────────────────────────────────────────────────────

/**
 * @param {Object} doc - mutated in place
 * @param {() => number} now
 * @returns {Object} the same document
 */
export function stampVersion(doc, now) {
    doc.schemaVersion = SCHEMA_2_6;
    if (!isObject(doc.metadata)) doc.metadata = {};
    doc.metadata.schemaVersion = SCHEMA_2_6;
    doc.metadata.migratedFrom = SCHEMA_2_5;
    doc.metadata.migrationDate = now();
    return doc;
}

// ── The migration ─────────────────────────────────────────────────────────────

/**
 * Migrate a 2.5 document to 2.6. Returns a NEW document; the input is untouched.
 *
 * Idempotent by version: a document that is already 2.6 (or newer) is returned as a clone,
 * unchanged. Anything that is not a 2.5 document is refused — the caller decides what an
 * unknown or older version means, this function never guesses.
 *
 * @param {Object} doc - A stored 2.5 document
 * @param {Object} options
 * @param {() => string} options.makeId - New routine key maker (GlobalUtils.generateId)
 * @param {() => number} [options.now=Date.now]
 * @param {Array<Array<{level: string, hex: string}>>} [options.swatchSets=[]] - every theme's
 *   swatches (collectSwatchSets(THEME_DEFINITIONS)); without them only the shared defaults
 *   and the colour-family rule decide a level
 * @param {Object} [options.autoClearDefaults=DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS]
 * @returns {Object} the migrated document
 * @throws {Error} when `doc` is not a 2.5 document or `makeId` is missing
 */
export function migrateSchema_2_5_to_2_6(doc, { makeId, now = Date.now, swatchSets = [], autoClearDefaults = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS } = {}) {
    if (typeof makeId !== 'function') throw new Error('migrateSchema_2_5_to_2_6: makeId is required');
    const kind = classifyStoredVersion(doc, SCHEMA_2_6);
    if (kind === 'current' || kind === 'newer') return structuredClone(doc);
    if (String(doc?.schemaVersion) !== SCHEMA_2_5) {
        throw new Error(`migrateSchema_2_5_to_2_6: expected a 2.5 document, got ${JSON.stringify(doc?.schemaVersion)}`);
    }
    const out = structuredClone(doc);
    rekeyRoutines(out, makeId);
    collapseAutoClear(out, autoClearDefaults);
    convertPriority(out, swatchSets);
    renameRoutineKeys(out);
    stampVersion(out, now);
    return out;
}

/**
 * The routines of a document in either shape (2.5 `data.cycles`, 2.6 `data.routine`).
 * @param {Object} doc
 * @returns {Object[]}
 */
function routinesOf(doc) {
    const map = doc?.data?.routine ?? doc?.data?.cycles;
    return isObject(map) ? Object.values(map).filter(isObject) : [];
}
