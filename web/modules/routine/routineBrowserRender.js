/**
 * miniCycle Browse Routines — drawing a routine as a card or a grid tile
 *
 * Pure DOM builders for routineBrowser.js: they take a routine and return (or
 * fill) elements. No DI, no listeners, no state writes — the browser owns all
 * behaviour. Split out so the browser file holds the interaction and this file
 * holds the look, the way routineSwitcherPreview.js serves the list.
 *
 * ── WHY ITS OWN CLASSES, NOT .task / .task-text ─────────────────────────────
 * The preview copies a routine's tasks. App code queries `.task` page-wide
 * (uiBoot's clearTransientTaskState, drag, counts), so reusing those classes
 * would hand that code rows that are not in any list. The look is matched
 * through the same --pref-* variables and --task-* defaults the real task list
 * reads instead (routine-switcher.css §BROWSE ROUTINES).
 *
 * Static import of routineBrowser.js, so boot-critical: listed in BOOT_CRITICAL
 * (service-worker.js). Reads no deps, so not in FACADE_SUB_FILES.
 *
 * @module routine/routineBrowserRender
 */

import { DOM_CLASSES, LIMITS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { THEME_DEFINITIONS } from '../labels/themes.js';
import { getCycleMode } from '../utils/cycleMode.js';

// The colorPreset keys a card paints with, and the --pref-* variable each one
// feeds — the subset of themeManager's VOCAB_THEME_CSS_VARS the card's CSS
// reads. Keep the names in step with that map.
const CARD_THEME_VARS = Object.freeze({
    appBg:                '--pref-app-bg',
    taskListBg:           '--pref-task-list-bg',
    taskBg:               '--pref-task-bg',
    taskText:             '--pref-task-text',
    titleBg:              '--pref-title-bg',
    titleText:            '--pref-title-text',
    checkboxBg:           '--pref-checkbox-bg',
    checkboxIncompleteBg: '--pref-checkbox-incomplete-bg',
    checkmark:            '--pref-checkmark'
});

// Keyed by cycleMode.getCycleMode()'s values.
const MODE_EMOJI = Object.freeze({ auto: '🔄', manual: '✋', todo: '📋' });
const MODE_LABEL = Object.freeze({ auto: 'focusMode.modeAutoName', manual: 'focusMode.modeManualName', todo: 'focusMode.modeTodoName' });

/**
 * @param {Object} routine
 * @returns {{emoji: string, name: string}} the routine's mode, for display
 */
export function describeMode(routine) {
    const mode = getCycleMode(routine);
    return { emoji: MODE_EMOJI[mode], name: getLabel(MODE_LABEL[mode]) };
}

/**
 * Paint an element in its routine's theme. The real task list reads the same
 * --pref-* variables from <body>, where the ACTIVE routine's theme sets them —
 * so a classic routine drawn while a themed routine is active must clear them
 * (initial → the CSS fallbacks), or it would wear the other routine's colours.
 * Dark mode drops theme colours app-wide; so does this.
 * @param {HTMLElement} el
 * @param {Object} routine - the routine drawn
 * @param {Object|null} activeRoutine - the routine that is open
 */
export function applyRoutineTheme(el, routine, activeRoutine) {
    for (const cssVar of Object.values(CARD_THEME_VARS)) el.style.removeProperty(cssVar);
    if (document.body.classList.contains(DOM_CLASSES.DARK_MODE)) return;

    const preset = THEME_DEFINITIONS[routine.theme]?.colorPreset || null;
    const activePreset = THEME_DEFINITIONS[activeRoutine?.theme]?.colorPreset || null;
    for (const [key, cssVar] of Object.entries(CARD_THEME_VARS)) {
        if (preset?.[key]) el.style.setProperty(cssVar, preset[key]);
        else if (activePreset) el.style.setProperty(cssVar, 'initial');
    }
}

/** One read-only task row: a check circle and the text (textContent — user data). */
function taskRow(task) {
    const li = document.createElement('li');
    li.className = DOM_CLASSES.RB_TASK + (task.completed ? ` ${DOM_CLASSES.RB_TASK_DONE}` : '');
    const check = document.createElement('span');
    check.className = DOM_CLASSES.RB_CHECK;
    check.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = task.text || '';
    li.append(check, text);
    return li;
}

function currentTag() {
    const tag = document.createElement('span');
    tag.className = DOM_CLASSES.RB_CURRENT_TAG;
    tag.textContent = getLabel('routineBrowser.current');
    return tag;
}

/**
 * Fill a card with a routine as Home View or Focus View draws it: the mode
 * (Home View only), then the task panel with its title.
 * @param {HTMLElement} card
 * @param {Object} routine
 * @param {{name: string, isCurrent: boolean, focusStyle: boolean}} opts
 */
export function fillCard(card, routine, { name, isCurrent, focusStyle }) {
    card.replaceChildren();
    card.classList.toggle(DOM_CLASSES.RB_CARD_FOCUS_STYLE, focusStyle);

    if (!focusStyle) {
        const { emoji, name: modeName } = describeMode(routine);
        const pill = document.createElement('div');
        pill.className = DOM_CLASSES.RB_MODE_PILL;
        pill.textContent = `${modeName} ${emoji}`;
        card.appendChild(pill);
    }

    const panel = document.createElement('div');
    panel.className = DOM_CLASSES.RB_PANEL;
    const panelTitle = document.createElement('div');
    panelTitle.className = DOM_CLASSES.RB_PANEL_TITLE;
    panelTitle.textContent = name;
    if (isCurrent) panelTitle.appendChild(currentTag());
    panel.appendChild(panelTitle);

    const tasks = Array.isArray(routine.tasks) ? routine.tasks : [];
    if (tasks.length === 0) {
        const empty = document.createElement('p');
        empty.className = DOM_CLASSES.RB_EMPTY;
        empty.textContent = getLabel('routineBrowser.noTasks');
        panel.appendChild(empty);
    } else {
        const list = document.createElement('ul');
        list.className = DOM_CLASSES.RB_TASKS;
        tasks.forEach(task => list.appendChild(taskRow(task)));
        panel.appendChild(list);
    }
    card.appendChild(panel);
}

/**
 * A grid tile: the routine's name and mode over its first few tasks, in its
 * theme. A listbox option — selecting shows it, it does not open it.
 * @param {Object} routine
 * @param {{key: string, name: string, isCurrent: boolean, activeRoutine: Object|null}} opts
 * @returns {HTMLElement}
 */
export function buildTile(routine, { key, name, isCurrent, activeRoutine }) {
    const { emoji, name: modeName } = describeMode(routine);
    const tile = document.createElement('div');
    tile.className = DOM_CLASSES.RB_TILE;
    tile.dataset.key = key;
    tile.setAttribute('role', 'option');
    tile.setAttribute('aria-selected', 'false');
    tile.setAttribute('aria-label', getLabel('routineBrowser.tileAria', { vars: { name, mode: modeName } }));
    tile.tabIndex = -1;
    applyRoutineTheme(tile, routine, activeRoutine);

    const panel = document.createElement('div');
    panel.className = DOM_CLASSES.RB_PANEL;
    panel.setAttribute('aria-hidden', 'true');

    const head = document.createElement('div');
    head.className = `${DOM_CLASSES.RB_PANEL_TITLE} ${DOM_CLASSES.RB_TILE_HEAD}`;
    const title = document.createElement('span');
    title.className = DOM_CLASSES.RB_TILE_NAME;
    title.textContent = `${name} ${emoji}`;
    head.appendChild(title);
    if (isCurrent) head.appendChild(currentTag());
    panel.appendChild(head);

    const tasks = Array.isArray(routine.tasks) ? routine.tasks : [];
    if (tasks.length === 0) {
        const empty = document.createElement('p');
        empty.className = DOM_CLASSES.RB_EMPTY;
        empty.textContent = getLabel('routineBrowser.noTasks');
        panel.appendChild(empty);
    } else {
        const list = document.createElement('ul');
        list.className = DOM_CLASSES.RB_TASKS;
        tasks.slice(0, LIMITS.ROUTINE_BROWSER_TILE_TASKS).forEach(task => list.appendChild(taskRow(task)));
        panel.appendChild(list);
        const more = tasks.length - LIMITS.ROUTINE_BROWSER_TILE_TASKS;
        if (more > 0) {
            const moreEl = document.createElement('div');
            moreEl.className = DOM_CLASSES.RB_TILE_MORE;
            moreEl.textContent = getLabel('routineBrowser.moreTasks', { vars: { count: more } });
            panel.appendChild(moreEl);
        }
    }
    tile.appendChild(panel);
    return tile;
}
