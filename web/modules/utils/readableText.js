/**
 * Readable text colours over a painted background colour.
 *
 * A Personalization preset, a colour the user picked, or a vocab theme's colour
 * preset paints the page ONE solid colour, so the text that sits straight on it
 * can be chosen rather than guessed: white where white clears WCAG's 4.5:1
 * against that colour, a near-black otherwise. Used for the footer links (and
 * their phone contrast-mode text and the desktop strip's tint) and the header
 * subtitle, which goes white at full opacity on a dark background — black at
 * 0.8 measured 1.3:1 on the Ocean preset (Oct 2026) — and the header's glass
 * buttons (the toolbar group and ☰), whose navy was near-unreadable on the
 * Dark Ocean and Forest presets until Nov 2026. The default blue gradient
 * is not a solid colour and keeps the stylesheets' fixed colours.
 *
 * Pure: no DI, no state. preferencesManager sets these on <html> beside the
 * --pref-* vars; themeManager sets them on <body> for a vocab theme (body wins
 * while the vocab theme is active, and clears them when it ends).
 *
 * @module utils/readableText
 */

/** The custom properties this module owns on an element's inline style. */
export const READABLE_TEXT_VARS = Object.freeze([
    '--footer-text', '--footer-text-contrast', '--footer-strip-bg', '--footer-strip-border',
    '--pref-subtitle-color', '--pref-subtitle-opacity', '--pref-chrome-ink', '--pref-chrome-glass'
]);

/** The corner buttons' derived colours (applyCornerButtonColors). */
export const CORNER_BUTTON_VARS = Object.freeze(['--pref-corner-ink', '--pref-corner-glass']);

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#111111';
const AA_NORMAL_TEXT = 4.5;
const AA_NON_TEXT = 3;   // WCAG 1.4.11: icons and other graphics
const NAVY_GLASS = 'rgba(10, 25, 60, 0.43)';
// The header buttons' frost under white text. Their usual frost is white, and
// white over the page lowers white text's contrast: on Berry it fell to 4:1,
// and to 2.7:1 under High Contrast's stronger frost. A dark frost can only raise it.
const CHROME_DARK_GLASS = 'rgba(10, 25, 60, 0.25)';

/**
 * WCAG relative luminance of a 6-digit hex colour, or null when unreadable.
 * @param {string} hex
 * @returns {number|null}
 */
export function relativeLuminance(hex) {
    const h = String(hex || '').trim().replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    const channel = (i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * WCAG contrast ratio between two hex colours, or null when either is unreadable.
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number|null}
 */
export function contrastRatio(hexA, hexB) {
    const a = relativeLuminance(hexA);
    const b = relativeLuminance(hexB);
    if (a === null || b === null) return null;
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * Set the footer and subtitle colours for a solid app background on `el`'s
 * inline style, or clear them (null / unreadable colour) so the stylesheets'
 * defaults return.
 * @param {HTMLElement} el - <html> (preferences) or <body> (vocab theme)
 * @param {string|null} appBgHex
 * @returns {boolean} true when white is the readable choice (false when dark, or when cleared)
 */
export function applyReadableTextColors(el, appBgHex) {
    if (!el?.style) return false;
    const ratio = appBgHex ? contrastRatio(LIGHT_TEXT, appBgHex) : null;
    if (ratio === null) {
        READABLE_TEXT_VARS.forEach((v) => el.style.removeProperty(v));
        return false;
    }
    const whiteReads = ratio >= AA_NORMAL_TEXT;
    el.style.setProperty('--footer-text', whiteReads ? LIGHT_TEXT : DARK_TEXT);
    el.style.setProperty('--footer-text-contrast', whiteReads ? LIGHT_TEXT : DARK_TEXT);
    // The backing strip (prefers-contrast, High Contrast, a user-picked colour):
    // navy glass under white text, light glass under dark text.
    el.style.setProperty('--footer-strip-bg', whiteReads ? NAVY_GLASS : 'rgba(255, 255, 255, 0.72)');
    el.style.setProperty('--footer-strip-border', whiteReads ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.3)');
    // The header's glass buttons keep their navy on a light frost unless the
    // background is dark enough for white; then white on a dark frost.
    if (whiteReads) {
        el.style.setProperty('--pref-subtitle-color', LIGHT_TEXT);
        el.style.setProperty('--pref-subtitle-opacity', '1');
        el.style.setProperty('--pref-chrome-ink', LIGHT_TEXT);
        el.style.setProperty('--pref-chrome-glass', CHROME_DARK_GLASS);
    } else {
        el.style.removeProperty('--pref-subtitle-color');
        el.style.removeProperty('--pref-subtitle-opacity');
        el.style.removeProperty('--pref-chrome-ink');
        el.style.removeProperty('--pref-chrome-glass');
    }
    return whiteReads;
}

/**
 * Keep the corner buttons' icons readable in whatever colour the user picked
 * for them (Personalization → Corner Button Colour). Solid style fills the
 * circle with that colour, so its icon is white or near-black, whichever
 * clears 3:1 on it. Frosted style draws the icon IN that colour on white
 * glass; a colour too light for that gets the footer strip's navy glass
 * instead, so the colour the user chose still shows. Until Nov 2026 a pale
 * pick left a white icon on a pale circle in either style.
 * @param {HTMLElement} el - <html> (preferences)
 * @param {string|null} cornerHex - the chosen colour, or null to clear
 */
export function applyCornerButtonColors(el, cornerHex) {
    if (!el?.style) return;
    const onWhite = cornerHex ? contrastRatio(LIGHT_TEXT, cornerHex) : null;
    if (onWhite === null) {
        CORNER_BUTTON_VARS.forEach((v) => el.style.removeProperty(v));
        return;
    }
    const readsOnWhite = onWhite >= AA_NON_TEXT;
    el.style.setProperty('--pref-corner-ink', readsOnWhite ? LIGHT_TEXT : DARK_TEXT);
    if (readsOnWhite) el.style.removeProperty('--pref-corner-glass');
    else el.style.setProperty('--pref-corner-glass', NAVY_GLASS);
}

/** A colour at least this light is shown as picked on the glass Complete / Clear button. */
const LIGHT_ACTION_TEXT = 0.5;
/** How much of the pick survives the usual darkening (the color-mix below). */
const ACTION_TEXT_KEEP = 0.4;
/** The glass Complete / Clear button's frost: white at this alpha (buttons.css --glass-btn-bg). */
const ACTION_GLASS_ALPHA = 0.25;
/** Steps tried between the pick and black / white when the usual colour does not read. */
const ACTION_TEXT_STEPS = 40;

const WHITE_RGB = Object.freeze([255, 255, 255]);
const BLACK_RGB = Object.freeze([0, 0, 0]);

function hexToRgb(hex) {
    const h = String(hex || '').trim().replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex(rgb) {
    return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** `a` at weight `t` over `b`. */
function mixRgb(a, b, t) {
    return a.map((v, i) => v * t + b[i] * (1 - t));
}

/**
 * The pick, moved toward black or white only as far as it takes to clear 4.5:1
 * on `glass`. The usual darkened colour is kept wherever it already reads, so
 * a preset that was legible looks exactly as it did.
 * @param {number[]} pick
 * @param {number[]} glass - the button's frost composited over the page
 * @returns {string} hex
 */
function readableOnGlass(pick, glass) {
    const glassHex = rgbToHex(glass);
    const reads = (rgb) => contrastRatio(rgbToHex(rgb), glassHex) >= AA_NORMAL_TEXT;
    const usual = relativeLuminance(rgbToHex(pick)) >= LIGHT_ACTION_TEXT
        ? pick
        : mixRgb(pick, BLACK_RGB, ACTION_TEXT_KEEP);
    if (reads(usual)) return rgbToHex(usual);
    for (let step = 1; step <= ACTION_TEXT_STEPS; step++) {
        const keep = 1 - step / ACTION_TEXT_STEPS;
        const passing = [mixRgb(pick, BLACK_RGB, keep), mixRgb(pick, WHITE_RGB, keep)].filter(reads);
        if (passing.length) {
            const hexes = passing.map(rgbToHex);
            return hexes.sort((x, y) => contrastRatio(y, glassHex) - contrastRatio(x, glassHex))[0];
        }
    }
    return contrastRatio(LIGHT_TEXT, glassHex) >= contrastRatio(DARK_TEXT, glassHex) ? LIGHT_TEXT : DARK_TEXT;
}

/**
 * The glass Complete Cycle / Clear button's words in a colour the user picked.
 * A mid or dark colour is darkened for legibility on near-clear glass. A light
 * one is shown exactly: darkening has no hue to preserve there, and until Nov
 * 2026 it turned a white pick gray.
 *
 * With the page's solid background colour, the result is measured on the glass
 * as it is drawn (its white frost over that colour) and moved toward black or
 * white until it clears 4.5:1. Until Nov 2026 it was not measured at all: Dark
 * Ocean's Complete Cycle read 1.45:1 and Golden Glow's Clear 1.01:1.
 * @param {string|null} hex
 * @param {string|null} [appBgHex] - the solid page colour, or null (the default gradient)
 * @returns {string|null} a CSS colour, or null when there is no usable pick
 */
export function actionTextColor(hex, appBgHex = null) {
    const luminance = relativeLuminance(hex);
    if (luminance === null) return null;
    const bg = hexToRgb(appBgHex);
    if (bg) return readableOnGlass(hexToRgb(hex), mixRgb(WHITE_RGB, bg, ACTION_GLASS_ALPHA));
    if (luminance >= LIGHT_ACTION_TEXT) return hex;
    return globalThis.CSS?.supports?.('color', 'color-mix(in srgb, red, blue)')
        ? `color-mix(in srgb, ${hex} 40%, var(--color-black))`
        : hex;
}

/**
 * Set or clear `<prefix>-complete-text` and `<prefix>-clear-text` on `el`.
 * @param {HTMLElement} el - <html> (live) or the Personalization preview
 * @param {string} prefix - '--pref' or '--preview'
 * @param {{complete: (string|null), clear: (string|null)}} picks
 * @param {string|null} [appBgHex] - the solid page colour the button sits on
 */
export function applyActionTextColors(el, prefix, { complete, clear }, appBgHex = null) {
    if (!el?.style) return;
    for (const [name, hex] of [['complete', complete], ['clear', clear]]) {
        const color = actionTextColor(hex, appBgHex);
        const cssVar = `${prefix}-${name}-text`;
        if (color) el.style.setProperty(cssVar, color);
        else el.style.removeProperty(cssVar);
    }
}
