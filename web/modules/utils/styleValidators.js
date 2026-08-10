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
 * Expand a hex colour to its full 6-digit `#rrggbb` form.
 *
 * WHY THIS EXISTS SEPARATELY FROM isValidHex: that predicate accepts 3–8 hex
 * digits, which is right for its job (gating a value before it reaches a style
 * sink — any of those forms is safe). It is NOT enough for callers that do
 * ARITHMETIC on fixed offsets: `parseInt('#f00'.slice(3, 5), 16)` reads the
 * empty string and yields NaN, so `#f00` passes validation and still produces
 * `rgba(240, 0, NaN, 0.8)`. Shorthand reaches storage through the preset
 * share-code importer, which gates on isValidHex (Aug 2026).
 *
 * Returns null for anything unusable, including the 5- and 7-digit strings the
 * looser predicate lets through — CSS hex colours are 3, 4, 6 or 8 digits only.
 * Alpha digits are dropped: callers here apply their own alpha.
 *
 * @param {*} value - Candidate colour
 * @returns {string|null} '#rrggbb', or null when not expandable
 */
export function normalizeHex(value) {
    if (!isValidHex(value)) return null;
    const digits = value.slice(1);
    switch (digits.length) {
        case 3: // #rgb
        case 4: // #rgba — drop the alpha nibble
            return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
        case 6: // #rrggbb
            return `#${digits}`;
        case 8: // #rrggbbaa — drop the alpha byte
            return `#${digits.slice(0, 6)}`;
        default: // 5 or 7 digits: not a real CSS hex colour
            return null;
    }
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
