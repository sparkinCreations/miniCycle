/**
 * Readable text colours over a painted background colour.
 *
 * A Personalization preset, a colour the user picked, or a vocab theme's colour
 * preset paints the page ONE solid colour, so the text that sits straight on it
 * can be chosen rather than guessed: white where white clears WCAG's 4.5:1
 * against that colour, a near-black otherwise. Used for the footer links (and
 * their phone contrast-mode text and the desktop strip's tint) and the header
 * subtitle, which goes white at full opacity on a dark background — black at
 * 0.8 measured 1.3:1 on the Ocean preset (Oct 2026). The default blue gradient
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
    '--pref-subtitle-color', '--pref-subtitle-opacity'
]);

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#111111';
const AA_NORMAL_TEXT = 4.5;

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
    el.style.setProperty('--footer-strip-bg', whiteReads ? 'rgba(10, 25, 60, 0.43)' : 'rgba(255, 255, 255, 0.72)');
    el.style.setProperty('--footer-strip-border', whiteReads ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.3)');
    if (whiteReads) {
        el.style.setProperty('--pref-subtitle-color', LIGHT_TEXT);
        el.style.setProperty('--pref-subtitle-opacity', '1');
    } else {
        el.style.removeProperty('--pref-subtitle-color');
        el.style.removeProperty('--pref-subtitle-opacity');
    }
    return whiteReads;
}
