/**
 * Name Utilities
 * Helpers for generating unique routine/cycle names, and for fitting user text
 * (names, task text) into a length limit safely.
 *
 * @module utils/nameUtils
 */

import { LIMITS } from '../core/constants.js';

// Bidirectional embedding, override and isolate controls (LRE RLE PDF LRO RLO,
// LRI RLI FSI PDI). Invisible, and an override reverses the text after it on
// screen, so a name can display as something other than what it says. The
// plain marks (LRM/RLM, U+200E/U+200F) are left alone: right-to-left writers
// use them, and they cannot reorder anything.
const DIRECTION_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Remove the invisible text-direction controls that can make a name display
 * differently from what it contains.
 * @param {string} text
 * @returns {string}
 */
export function stripDirectionControls(text) {
    return String(text ?? '').replace(DIRECTION_CONTROLS, '');
}

/**
 * Cut text to at most `maxLength` UTF-16 units — the unit the inputs'
 * maxlength and every stored limit count in — without splitting a character.
 * A plain slice can end on the first half of an emoji (a lone surrogate, which
 * renders as a box), or on a joiner or variation selector whose partner was
 * cut off.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function fitText(text, maxLength) {
    const str = String(text ?? '');
    if (str.length <= maxLength) return str;
    let cut = str.slice(0, Math.max(0, maxLength));
    if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
    return cut.replace(/(?:\u200D|\uFE0F)+$/, '');
}

/**
 * Is this name already used by a routine in the map?
 *
 * Compares NAMES, not keys. Routines are keyed by a generated id (Schema 2.6), and
 * until Nov 2026 some were still keyed by their title, so a routine's name is its
 * `title` when it has one and its key otherwise — the same fallback the key repair
 * uses (routine/schemaMigration26.js repairRoutineKeys). That keeps both shapes
 * right: `{ 'routine-1': { title: 'Morning' } }` and a legacy `{ 'Morning': {} }`
 * both reserve "Morning".
 *
 * Reading values with Object.entries means a name is never looked up as a key, so
 * "constructor", "toString" and the other Object.prototype names are ordinary names
 * (they used to read as collisions on an EMPTY map through a bare `map[name]`).
 *
 * The truthiness check is kept on purpose: an entry holding a falsy value is a
 * corrupt/placeholder entry, not a real routine, so it does not reserve the name.
 *
 * `__proto__` stays always-taken. With id keys it can no longer reach the map as a
 * key from here, but a legacy title-keyed writer or an old build sharing the same
 * storage still could, and `map['__proto__'] = {...}` sets the prototype instead of
 * an own property: it reads back in memory and serialises to `{}`. Forcing the
 * numbered suffix costs nothing. (Crafted `.mcyc` imports are covered separately by
 * DataValidator._checkForPrototypePollution.)
 *
 * @param {Object} existingCycles - The routines map (key -> routine)
 * @param {string} name - Candidate name
 * @returns {boolean} True if the name is unavailable
 */
function isNameTaken(existingCycles, name) {
    if (name === '__proto__') return true;
    if (!existingCycles || typeof existingCycles !== 'object') return false;
    return Object.entries(existingCycles).some(([key, routine]) => !!routine && routineName(key, routine) === name);
}

/**
 * A routine's display name: its title, or its key for a legacy entry without one.
 * @param {string} key
 * @param {Object} routine
 * @returns {string}
 */
function routineName(key, routine) {
    return typeof routine?.title === 'string' && routine.title.trim() ? routine.title : key;
}

/**
 * Generate a unique cycle name by appending (2), (3), etc. if needed
 * @param {string} baseName - The desired name
 * @param {Object} existingCycles - The routines map (names are compared by title; see isNameTaken)
 * @param {number} maxAttempts - Max number of variations to try (default 10)
 * @returns {{ name: string, wasModified: boolean }} Unique name and whether it was modified
 */
export function getUniqueCycleName(baseName, existingCycles = {}, maxAttempts = 10, maxLength = LIMITS.CYCLE_NAME_CHARACTER) {
    // The name and any " (2)" added to it fit the limit together: the base is
    // shortened to make room, so a name already at the limit does not grow
    // past it when it is made unique.
    const withSuffix = (suffix) => `${fitText(baseName, maxLength - suffix.length).trimEnd()}${suffix}`;
    const fitted = baseName.length <= maxLength ? baseName : withSuffix('');

    // If name doesn't exist, use it as-is. wasModified means "renamed because
    // the name was taken" (callers say so to the user), so shortening an
    // over-long name alone does not set it.
    if (!isNameTaken(existingCycles, fitted)) {
        return { name: fitted, wasModified: false };
    }

    // Try numbered variations: "Name (2)", "Name (3)", etc.
    for (let counter = 2; counter <= maxAttempts + 1; counter++) {
        const numberedName = withSuffix(` (${counter})`);
        if (!isNameTaken(existingCycles, numberedName)) {
            return { name: numberedName, wasModified: true };
        }
    }

    // Fallback: append timestamp for guaranteed uniqueness
    return { name: withSuffix(` (${Date.now()})`), wasModified: true };
}

/**
 * Check if a cycle name already exists
 * @param {string} name - Name to check
 * @param {Object} existingCycles - Object with cycle keys (names)
 * @returns {boolean} True if name exists
 */
export function cycleNameExists(name, existingCycles = {}) {
    return isNameTaken(existingCycles, name);
}

