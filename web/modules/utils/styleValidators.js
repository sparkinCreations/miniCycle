/**
 * Style Value Validators
 *
 * Pure validators for values that reach `style.setProperty()`. No DI, no side
 * effects — import directly.
 *
 * These exist because the same hex-colour regex had been inlined in four
 * places (preferencesPresets, historyManager twice, cycleImportManager) and was
 * about to be inlined in two more. That is the duplication fault line in
 * REVIEW_PATTERNS.md §4: the same check written repeatedly, hardened in only
 * some copies.
 *
 * On severity: these land in CSS custom properties, which cannot inject a
 * declaration — a value that doesn't parse becomes invalid-at-computed-value-
 * time at the `var()` site. So this is defence in depth against a corrupted or
 * ignored value, not an escape hatch for code execution. Validate where the
 * value enters the sink rather than trusting where it came from.
 *
 * @module utils/styleValidators
 */

import { FONT_SIZE } from '../core/constants.js';

/** Matches #RGB, #RGBA, #RRGGBB, and #RRGGBBAA */
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{3,8}$/;

/**
 * Validate a hex colour string (#RGB, #RRGGBB, or #RRGGBBAA).
 *
 * The `typeof` check matters: `.test()` stringifies its argument, so a bare
 * regex test would evaluate `null` as the string "null" — false here, but the
 * same coercion makes objects and arrays behave unpredictably.
 *
 * @param {*} value - Candidate colour
 * @returns {boolean} True if value is a valid hex colour string
 */
export function isValidHex(value) {
    return typeof value === 'string' && HEX_COLOR_PATTERN.test(value);
}

/**
 * Normalize a stored font-size setting to a number of pixels.
 *
 * Accepts the string form the <select> writes ('16') as well as a number.
 * Returns null for anything unparsable or outside FONT_SIZE bounds, so callers
 * can distinguish "no valid size" from a legitimate value.
 *
 * @param {*} value - Candidate size, e.g. '18' or 18
 * @returns {number|null} Size in px, or null if invalid
 */
export function normalizeFontSize(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    // Number('') is 0 and Number(' 16 ') is 16 — reject blanks explicitly so an
    // empty setting doesn't normalize to a size.
    if (typeof value === 'string' && value.trim() === '') return null;

    const size = Number(value);
    if (!Number.isFinite(size)) return null;
    if (size < FONT_SIZE.MIN_PX || size > FONT_SIZE.MAX_PX) return null;

    return size;
}
