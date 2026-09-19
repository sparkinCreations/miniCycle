/**
 * Priority Level
 *
 * Pure helpers for task priority as a LEVEL — 'high' | 'medium' | 'low' | null —
 * which is what Schema 2.6 stores (`task.priority`). No DI, no side effects.
 *
 * Why a level: the picker offers Red / Yellow / Green, which users read as
 * high / medium / low. Schema 2.5 stored a raw, theme-tinted hex instead, which
 * did not follow a theme switch, travelled as-is in shared .mcyc files, and left
 * search's "Priority First" sort seeing only on/off
 * (docs/future-work/SCHEMA_2_6_PLAN.md, "Priority levels"). The colour a task
 * SHOWS is always the current theme's swatch for its level.
 *
 * The 2.5 readers (`getLegacyPriorityLevel`, the hex and colour-family rules)
 * stay for the two places 2.5 records still arrive: the 2.5 -> 2.6 migration and
 * the .mcyc importer, which accepts 2.5 files for good.
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

import { PRIORITY_LEVELS, DEFAULT_PRIORITY_SWATCHES, PRIORITY_COLOR_FAMILY } from '../core/constants.js';

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
 * Hue (degrees), saturation and lightness (0–1) of a normalised hex colour.
 * @param {string} hex - 6-digit lower-case hex from normalizePriorityHex
 * @returns {{h: number, s: number, l: number}}
 */
function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return { h, s, l };
}

/** Shortest distance between two hues on the 360° wheel. */
function hueDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

/**
 * The level a NON-swatch colour belongs to, by colour family (hue).
 *
 * A nearest-colour match was measured and rejected: theme swatches are darkened
 * for contrast, so lightness decided the match (navy → high via a dark red; gray,
 * black and white → low). Hue is what a person reads as "red / yellow / green".
 * Colours with no clear hue, and hues that belong to no family (blues, purples),
 * are 'high' — which is what on/off priority has always meant.
 *
 * @param {*} hex
 * @returns {'high'|'medium'|'low'|null} null only when `hex` is not a colour at all
 */
export function getLevelForColorFamily(hex) {
    const clean = normalizePriorityHex(hex);
    if (!clean) return null;
    const { HUE_ANCHORS, MAX_HUE_DISTANCE, MIN_SATURATION, MIN_LIGHTNESS, MAX_LIGHTNESS } = PRIORITY_COLOR_FAMILY;
    const { h, s, l } = hexToHsl(clean);
    if (s < MIN_SATURATION || l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) return 'high';
    let nearest = null;
    let nearestDistance = Infinity;
    for (const level of PRIORITY_LEVELS) {
        const distance = hueDistance(h, HUE_ANCHORS[level]);
        if (distance < nearestDistance) { nearest = level; nearestDistance = distance; }
    }
    return nearestDistance <= MAX_HUE_DISTANCE ? nearest : 'high';
}

/**
 * A task's priority level.
 *
 * Not flagged → null, whatever colour it still remembers (turning priority off
 * keeps the colour, exactly like the task toggle). Flagged with a known swatch
 * colour → that swatch's level. Flagged with a colour that is not a swatch (the
 * .mcyc schema allows any hex) → the level of its colour family
 * (getLevelForColorFamily). Flagged with no colour → 'high'.
 *
 * @param {Object|null|undefined} task
 * @param {Array<Array<{level: string, hex: string}>>} [swatchSets=[]] - see collectSwatchSets
 * @returns {'high'|'medium'|'low'|null}
 */
export function getLegacyPriorityLevel(record, swatchSets = []) {
    if (!record?.highPriority) return null;
    return getLevelForHex(record.priorityColor, swatchSets)
        ?? getLevelForColorFamily(record.priorityColor)
        ?? 'high';
}

/**
 * A task's priority level as stored. Anything that is not a known level reads
 * as null (no priority) — a hand-edited file cannot invent a fourth level.
 * @param {Object|null|undefined} task
 * @returns {'high'|'medium'|'low'|null}
 */
export function getPriorityLevel(task) {
    return isPriorityLevel(task?.priority) ? task.priority : null;
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
 * Always the current theme's swatch for the task's level: a task given
 * habit-tracker's dark red shows the current theme's red, and a custom non-swatch
 * colour shows its colour family's swatch (a hand-written olive shows the theme's
 * Medium). Nothing is shown as stored — the stored hex is only ever a way to
 * find the level. A flagged task with no colour shows the theme's High.
 *
 * @param {Object|null|undefined} task
 * @param {Array<{level: string, hex: string}>|null|undefined} swatches - current theme (getPrioritySwatches)
 * @returns {string|null} null when the task has no priority
 */
export function getPriorityColor(task, swatches) {
    const level = getPriorityLevel(task);
    if (!level) return null;
    return swatchHexForLevel(swatches, level);
}

/**
 * Set a task's priority level (`task.priority`). Passing null turns priority
 * off. Mutates `task` — call it inside an AppState.update() producer, and sync
 * a recurring template yourself as taskCRUD's toggle does.
 *
 * @param {Object} task - Task draft to mutate
 * @param {'high'|'medium'|'low'|null} level
 * @returns {boolean} false (and no write) for an unknown level or a missing task
 */
export function setPriorityLevel(task, level) {
    if (!task || typeof task !== 'object') return false;
    if (level === null || level === undefined) {
        task.priority = null;
        return true;
    }
    if (!isPriorityLevel(level)) return false;
    task.priority = level;
    return true;
}

/**
 * Does the task have a priority at all? The on/off read every renderer and the
 * toggle make, in one place.
 * @param {Object|null|undefined} task
 * @returns {boolean}
 */
export function hasPriority(task) {
    return getPriorityLevel(task) !== null;
}

/**
 * The stored priority field of a task or template, for a literal that copies
 * one record into another (a recurring template from its task, a recreated
 * instance from its template, a cleared record). Spread the result — this is the
 * ONE place a copy spells the stored name.
 * @param {Object|null|undefined} source
 * @returns {{priority: ('high'|'medium'|'low'|null)}}
 */
export function priorityFields(source) {
    return { priority: getPriorityLevel(source) };
}

/**
 * The level a task currently has, for the toggle: turning priority "on" for a
 * task that already has a level keeps it. Under 2.5 a switched-off task still
 * remembered its colour; a 2.6 task with `priority: null` remembers nothing, so
 * the toggle falls through to the default level.
 * @param {Object|null|undefined} task
 * @returns {'high'|'medium'|'low'|null}
 */
export function getLastPriorityLevel(task) {
    return getPriorityLevel(task);
}

/**
 * Which level a picked colour means — a swatch of any theme, else its colour
 * family, else High.
 * @param {*} hex
 * @param {Array<Array<{level: string, hex: string}>>} [swatchSets=[]]
 * @returns {'high'|'medium'|'low'}
 */
export function getLevelForColor(hex, swatchSets = []) {
    return getLevelForHex(hex, swatchSets) ?? getLevelForColorFamily(hex) ?? 'high';
}

/**
 * The hex a swatch set shows for a level (the defaults when the set lacks it).
 * @param {'high'|'medium'|'low'} level
 * @param {Array<{level: string, hex: string}>|null|undefined} swatches
 * @returns {string|null} null for an unknown level
 */
export function getLevelColor(level, swatches) {
    return isPriorityLevel(level) ? swatchHexForLevel(swatches, level) : null;
}

/**
 * The level a NEW flagged task starts at: the last level picked anywhere
 * (`settings.defaultPriority`), else High.
 * @param {Object|null|undefined} settings - state.settings
 * @returns {'high'|'medium'|'low'}
 */
export function getDefaultPriorityLevel(settings) {
    return isPriorityLevel(settings?.defaultPriority) ? settings.defaultPriority : 'high';
}

/**
 * Remember a level as the default for the next flagged task
 * (`settings.defaultPriority`). Mutates `settings` — call it inside an
 * AppState.update() producer.
 * @param {Object} settings - state.settings draft
 * @param {'high'|'medium'|'low'} level
 * @returns {boolean} false (and no write) for an unknown level or missing settings
 */
export function setDefaultPriorityLevel(settings, level) {
    if (!settings || typeof settings !== 'object' || !isPriorityLevel(level)) return false;
    settings.defaultPriority = level;
    return true;
}

/**
 * Sort comparator: high, then medium, then low, then no priority. Tasks at the
 * same level compare equal, so Array.prototype.sort (stable) keeps their order.
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function comparePriority(a, b) {
    return priorityRank(getPriorityLevel(a)) - priorityRank(getPriorityLevel(b));
}

/**
 * @param {string|null} level
 * @returns {number} 0 for high … PRIORITY_LEVELS.length for none
 */
function priorityRank(level) {
    const index = PRIORITY_LEVELS.indexOf(level);
    return index === -1 ? PRIORITY_LEVELS.length : index;
}
