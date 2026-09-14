/**
 * Priority Level
 *
 * Pure helpers that treat task priority as a LEVEL — 'high' | 'medium' | 'low' —
 * while Schema 2.5 still stores it as `highPriority` (on/off) plus a
 * `priorityColor` hex. No DI, no side effects.
 *
 * Why this exists: the picker offers Red / Yellow / Green, which users read as
 * high / medium / low, but the stored value is a raw, theme-tinted hex. That hex
 * does not follow a theme switch, travels as-is in shared .mcyc files, and search's
 * "Priority First" sort can only see on/off. Schema 2.6 stores the level itself
 * (docs/future-work/SCHEMA_2_6_PLAN.md, "Priority levels"). Until then these
 * helpers derive the level from the stored hex, pick the display colour from the
 * CURRENT theme, and write only the existing stored fields.
 *
 * Swatch sets are passed in rather than imported. THEME_DEFINITIONS lives in
 * labels/themes.js beside the VocabThemeManager DI module, and importing that here
 * would pull a DI module into a pure helper. Callers pass the active theme's
 * swatches (getPrioritySwatches) and, where a level must be recognised from ANY
 * theme's colour, every theme's set (collectSwatchSets). The shared defaults are
 * always included.
 *
 * @module utils/priorityLevel
 */

import { PRIORITY_LEVELS, DEFAULT_PRIORITY_SWATCHES } from '../core/constants.js';

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Canonical form of a hex colour: lower case, 6 digits. `#ABC` → `#aabbcc`.
 * @param {*} hex
 * @returns {string|null} null for anything that is not a 3- or 6-digit hex
 */
export function normalizePriorityHex(hex) {
    if (typeof hex !== 'string') return null;
    const trimmed = hex.trim();
    if (!HEX_PATTERN.test(trimmed)) return null;
    const lower = trimmed.toLowerCase();
    if (lower.length === 4) {
        return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
    }
    return lower;
}

/**
 * @param {*} level
 * @returns {boolean} true for 'high', 'medium' or 'low'
 */
export function isPriorityLevel(level) {
    return PRIORITY_LEVELS.includes(level);
}

/**
 * The picker swatches for a theme: its own set, or the shared defaults for a theme
 * that defines none (classic).
 * @param {Object|null|undefined} themeDefinition - A THEME_DEFINITIONS entry
 * @returns {ReadonlyArray<{level: string, hex: string, labelKey: string}>}
 */
export function getPrioritySwatches(themeDefinition) {
    const own = themeDefinition?.priorityColors;
    return Array.isArray(own) && own.length > 0 ? own : DEFAULT_PRIORITY_SWATCHES;
}

/**
 * Every theme's swatch set, for recognising a stored colour picked under any theme.
 * @param {Object|null|undefined} themeDefinitions - THEME_DEFINITIONS
 * @returns {Array<Array<{level: string, hex: string}>>}
 */
export function collectSwatchSets(themeDefinitions) {
    if (!themeDefinitions || typeof themeDefinitions !== 'object') return [];
    return Object.values(themeDefinitions)
        .map(theme => theme?.priorityColors)
        .filter(set => Array.isArray(set) && set.length > 0);
}

/**
 * Which level a colour belongs to, checking the shared defaults and every set given.
 * @param {*} hex
 * @param {Array<Array<{level: string, hex: string}>>} [swatchSets=[]]
 * @returns {'high'|'medium'|'low'|null} null when the colour is not a known swatch
 */
export function getLevelForHex(hex, swatchSets = []) {
    const target = normalizePriorityHex(hex);
    if (!target) return null;
    const sets = [DEFAULT_PRIORITY_SWATCHES, ...(Array.isArray(swatchSets) ? swatchSets : [])];
    for (const set of sets) {
        if (!Array.isArray(set)) continue;
        for (const swatch of set) {
            if (isPriorityLevel(swatch?.level) && normalizePriorityHex(swatch.hex) === target) {
                return swatch.level;
            }
        }
    }
    return null;
}

/**
 * A task's priority level.
 *
 * Not flagged → null, whatever colour it still remembers (turning priority off
 * keeps the colour, exactly like the task toggle). Flagged with a known swatch
 * colour → that swatch's level. Flagged with no colour, or a colour that is not a
 * swatch (the .mcyc schema allows any hex, and a theme colour preset's
 * priorityColor is not a swatch either) → 'high', because on/off priority has
 * always meant high.
 *
 * @param {Object|null|undefined} task
 * @param {Array<Array<{level: string, hex: string}>>} [swatchSets=[]] - see collectSwatchSets
 * @returns {'high'|'medium'|'low'|null}
 */
export function getPriorityLevel(task, swatchSets = []) {
    if (!task?.highPriority) return null;
    return getLevelForHex(task.priorityColor, swatchSets) ?? 'high';
}

/**
 * The hex a theme's swatch set uses for a level, falling back to the defaults.
 * @param {Array<{level: string, hex: string}>|null|undefined} swatches
 * @param {'high'|'medium'|'low'} level
 * @returns {string}
 */
function swatchHexForLevel(swatches, level) {
    const set = Array.isArray(swatches) && swatches.length > 0 ? swatches : DEFAULT_PRIORITY_SWATCHES;
    const match = set.find(swatch => swatch?.level === level);
    return match?.hex ?? DEFAULT_PRIORITY_SWATCHES.find(swatch => swatch.level === level).hex;
}

/**
 * The colour to DISPLAY for a task's priority under the current theme.
 *
 * A swatch colour follows the theme: a task given habit-tracker's dark red shows
 * the current theme's red. A custom, non-swatch colour is shown as stored, because
 * it was a deliberate choice this helper cannot map. A flagged task with no colour
 * shows the current theme's High swatch.
 *
 * @param {Object|null|undefined} task
 * @param {Array<{level: string, hex: string}>|null|undefined} swatches - current theme (getPrioritySwatches)
 * @param {Array<Array<{level: string, hex: string}>>} [swatchSets=[]] - every theme (collectSwatchSets)
 * @returns {string|null} null when the task is not flagged
 */
export function getPriorityColor(task, swatches, swatchSets = []) {
    const level = getPriorityLevel(task, swatchSets);
    if (!level) return null;
    if (!getLevelForHex(task.priorityColor, swatchSets)) {
        const custom = normalizePriorityHex(task.priorityColor);
        if (custom) return custom;
    }
    return swatchHexForLevel(swatches, level);
}

/**
 * Set a task's priority level by writing the stored 2.5 fields: `highPriority`,
 * and `priorityColor` as the given theme's swatch for that level. Passing null
 * turns priority off and keeps the colour, like the task toggle. Mutates `task` —
 * call it inside an AppState.update() producer, and sync a recurring template
 * yourself as taskCRUD's toggle does.
 *
 * @param {Object} task - Task draft to mutate
 * @param {'high'|'medium'|'low'|null} level
 * @param {Array<{level: string, hex: string}>|null|undefined} swatches - current theme (getPrioritySwatches)
 * @returns {boolean} false (and no write) for an unknown level or a missing task
 */
export function setPriorityLevel(task, level, swatches) {
    if (!task || typeof task !== 'object') return false;
    if (level === null || level === undefined) {
        task.highPriority = false;
        return true;
    }
    if (!isPriorityLevel(level)) return false;
    task.highPriority = true;
    task.priorityColor = swatchHexForLevel(swatches, level);
    return true;
}

/**
 * Sort comparator: high, then medium, then low, then no priority. Tasks at the
 * same level compare equal, so Array.prototype.sort (stable) keeps their order.
 * @param {Object} a
 * @param {Object} b
 * @param {Array<Array<{level: string, hex: string}>>} [swatchSets=[]] - see collectSwatchSets
 * @returns {number}
 */
export function comparePriority(a, b, swatchSets = []) {
    return priorityRank(getPriorityLevel(a, swatchSets)) - priorityRank(getPriorityLevel(b, swatchSets));
}

/**
 * @param {string|null} level
 * @returns {number} 0 for high … PRIORITY_LEVELS.length for none
 */
function priorityRank(level) {
    const index = PRIORITY_LEVELS.indexOf(level);
    return index === -1 ? PRIORITY_LEVELS.length : index;
}
