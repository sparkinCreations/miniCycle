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

// Deliberately `Object.prototype.hasOwnProperty.call`, NOT `Object.hasOwn`. The build
// target is es2020 and the feature gate in miniCycle.html admits anything with
// globalThis (Chrome 71 / Safari 12.1 / Firefox 65); `Object.hasOwn` is es2022
// (Chrome 93 / Safari 15.4 / Firefox 92). esbuild transpiles syntax, not built-in
// methods, so it would ship verbatim and throw TypeError through the whole
// routine-creation path on browsers the gate lets in — iOS 15.3 and earlier included.
const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Is this name already used as a routine key?
 *
 * Gated on an own-property check before the truthiness check, because routine names are
 * user-typed and land directly as object keys. A bare `existingCycles[name]` read
 * inherits from Object.prototype, so it is truthy on an EMPTY cycles object for
 * "constructor", "toString", "valueOf", "hasOwnProperty" — a routine with any of
 * those names was reported as a collision and silently renamed to "constructor (2)"
 * with wasModified=true, despite nothing to collide with.
 *
 * The truthiness half is kept on purpose: a key present but holding a falsy value is
 * a corrupt/placeholder entry, not a real routine, so it should not reserve the name.
 *
 * `__proto__` is treated as always-taken on purpose. Assigning it on a plain object
 * sets the prototype instead of creating an own property, so `cycles['__proto__'] = {...}`
 * reads back correctly in memory but serialises to `{}` — the routine survives until
 * reload and then vanishes with no error. Forcing the numbered suffix keeps the name
 * an ordinary own key. (Crafted `.mcyc` imports are a separate path, already covered by
 * DataValidator._checkForPrototypePollution, which sees `__proto__` because JSON.parse
 * DOES create it as an own property.)
 *
 * @param {Object} existingCycles - Object with cycle keys (names)
 * @param {string} name - Candidate name
 * @returns {boolean} True if the name is unavailable
 */
function isNameTaken(existingCycles, name) {
    if (name === '__proto__') return true;
    return hasOwn.call(existingCycles, name) && !!existingCycles[name];
}

/**
 * Generate a unique cycle name by appending (2), (3), etc. if needed
 * @param {string} baseName - The desired name
 * @param {Object} existingCycles - Object with cycle keys (names)
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

