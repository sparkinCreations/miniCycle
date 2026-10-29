/**
 * miniCycle Routine Switcher — Browse Routines
 *
 * A second way to open routines: one routine at a time, full screen, drawn the
 * way the app draws it (its theme's colours, the Home View or Focus View look the
 * user is in) and READ-ONLY. Flip with the ← → buttons, the arrow keys, a
 * sideways swipe or the mouse wheel; jump with the "All routines" list; open with
 * the Open button, a tap on the routine, or Enter. Settings → "When you open
 * routines, show" decides whether the routine button opens this or the list, and
 * each view has a corner button to the other (designed with the user, Oct 2026).
 *
 * ── PATTERN: MANAGER BACK-REFERENCE, AS IN routineSwitcherActions ─────────────
 * `this.m` is the owning RoutineSwitcher. Its deps are this module's deps
 * (`this.m.deps.*`), and opening a routine goes through the switcher's own
 * `_openRoutineByKey()` so Browse switches exactly the way the list does — same
 * repair, same undo context, same lastAccessedAt bookkeeping. Storage figures come
 * through the switcher's live bindings (`getObjectSizeBytes`, `getStorageInfo`,
 * `formatBytes`), never a second import of storageUtils: a bare import of a module
 * the app loads with `?v=` would be a second instance with its own quota cache
 * (MAKING_CODE_CHANGES.md, pitfall 6).
 *
 * ── WHY ITS OWN CLASSES, NOT .task / .task-text ─────────────────────────────
 * The preview copies a routine's tasks. App code queries `.task` page-wide
 * (uiBoot's clearTransientTaskState, drag, counts), so reusing those classes
 * would hand that code rows that are not in any list. The look is matched
 * through the same --pref-* variables the real task list reads instead.
 *
 * ── REGISTRATION ────────────────────────────────────────────────────────────
 * Static import, constructed in the switcher's constructor, like
 * routineSwitcherActions — listed in FACADE_SUB_FILES (validate-di-deps) and
 * BOOT_CRITICAL (service-worker.js). Not in moduleManifests.js.
 *
 * @module routine/routineBrowser
 */

import { DOM_IDS, DOM_CLASSES, DOM_SELECTORS, UI_TIMEOUTS, GESTURE, ROUTINE_BROWSER_SORT, ROUTINE_OPEN_VIEW } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { THEME_DEFINITIONS } from '../labels/themes.js';
import { announce } from '../utils/announce.js';
import { getIcon } from '../utils/icons.js';
import { handleVerticalArrowNav } from '../utils/keyboardNav.js';
import { getActiveRoutineId, getCycleMode, getRoutineBrowserSort, getRoutines } from '../utils/cycleMode.js';

// The colorPreset keys a preview card paints with, and the --pref-* variable
// each one feeds — the subset of themeManager's VOCAB_THEME_CSS_VARS the card's
// CSS reads. Keep the names in step with that map.
const CARD_THEME_VARS = Object.freeze({
    appBg:                '--pref-app-bg',
    taskListBg:           '--pref-task-list-bg',
    taskBg:               '--pref-task-bg',
    taskText:             '--pref-task-text',
    titleBg:              '--pref-title-bg',
    titleText:            '--pref-title-text',
    checkboxBg:           '--pref-checkbox-bg',
    checkboxIncompleteBg: '--pref-checkbox-incomplete-bg',
    checkmark:            '--pref-checkmark',
    progressBar:          '--pref-progress-bar'
});

// Keyed by cycleMode.getCycleMode()'s values.
const MODE_EMOJI = Object.freeze({ auto: '🔄', manual: '✋', todo: '📋' });
const MODE_LABEL = Object.freeze({ auto: 'focusMode.modeAutoName', manual: 'focusMode.modeManualName', todo: 'focusMode.modeTodoName' });

/**
 * When the routine was last used: opened, else edited, else created. Routines
 * opened before lastAccessedAt was recorded have none, and must still sort.
 * @param {Object} routine
 * @returns {number} epoch ms, 0 when nothing is known
 */
export function routineRecency(routine) {
    return routine?.lastAccessedAt || routine?.lastModified || routine?.createdAt || 0;
}

/**
 * The order Browse flips through: A-Z by title, or Recent, newest first.
 * Ties fall back to the title so the order is stable between opens.
 * @param {Object} routines - state.data.routine
 * @param {'alpha'|'recent'} sort - a ROUTINE_BROWSER_SORT value
 * @returns {string[]} routine keys
 */
export function orderRoutines(routines, sort) {
    const byTitle = (a, b) => String(routines[a]?.title || a)
        .localeCompare(String(routines[b]?.title || b), undefined, { sensitivity: 'base' });
    const keys = Object.keys(routines || {});
    if (sort === ROUTINE_BROWSER_SORT.RECENT) {
        return keys.sort((a, b) => (routineRecency(routines[b]) - routineRecency(routines[a])) || byTitle(a, b));
    }
    return keys.sort(byTitle);
}

export class RoutineBrowser {
    /**
     * @param {Object} manager - The owning RoutineSwitcher instance
     */
    constructor(manager) {
        this.m = manager;
        this._dialog = null;
        this._els = null;
        this._order = [];
        this._index = 0;
        this._sort = ROUTINE_BROWSER_SORT.RECENT;
        this._fromList = false;
        this._previousFocus = null;
        this._listeners = [];
        this._wheelQuietTimer = null;
        this._wheelLocked = false;
        this._touch = null;
        this._suppressClick = false;
    }

    get deps() {
        return this.m.deps;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Open / close
    // ────────────────────────────────────────────────────────────────────────

    /** @returns {boolean} whether Browse is on screen */
    isOpen() {
        return !!this._dialog?.open;
    }

    /**
     * Open Browse on the CURRENT routine — not the previous one: nothing has been
     * switched yet, it is a preview, and it does not assume which way the user
     * wants to go (the user's call, Oct 2026).
     * @param {{fromList?: boolean, returnFocus?: Element|null}} [options]
     *   fromList: Escape returns to the list;
     *   returnFocus: where focus goes when Browse closes — from the list, the
     *   element that opened the list, not the list's own corner button
     */
    open({ fromList = false, returnFocus = null } = {}) {
        const AppState = this.deps.AppState;
        if (!AppState?.isReady?.()) return;
        const state = AppState.get();
        const routines = getRoutines(state) || {};
        if (Object.keys(routines).length === 0) return;

        this._build();
        this._fromList = fromList;
        this._previousFocus = returnFocus || document.activeElement;
        this._sort = getRoutineBrowserSort(state);
        this._order = orderRoutines(routines, this._sort);
        const activeId = getActiveRoutineId(state);
        this._index = Math.max(0, this._order.indexOf(activeId));

        this.deps.hideMainMenu?.();
        this._attachListeners();
        this._syncSortButtons();
        this._closeJumpList({ restoreFocus: false });
        this._render(0);
        if (!this._dialog.open) this._dialog.showModal();
        this._els.openBtn.focus({ focusVisible: false });
        this._announce();
    }

    /**
     * @param {{toList?: boolean}} [options] - toList: show the Open Routine list next
     */
    close({ toList = false } = {}) {
        if (!this._dialog) return;
        this._detachListeners();
        if (this._dialog.open) this._dialog.close();
        const back = this._previousFocus;
        this._previousFocus = null;
        if (toList) {
            // The list returns focus to whatever opened Browse, not to this
            // corner button, which is gone with Browse.
            this.m.switchMiniCycle({ view: ROUTINE_OPEN_VIEW.LIST, returnFocus: back });
            return;
        }
        if (back?.isConnected) back.focus({ focusVisible: false });
    }

    /** Called by the switcher's destroy path and boot retries. */
    destroy() {
        this._detachListeners();
        if (this._dialog?.open) this._dialog.close();
        this._dialog?.remove();
        this._dialog = null;
        this._els = null;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Markup (built once, on first open)
    // ────────────────────────────────────────────────────────────────────────

    _build() {
        if (this._dialog?.isConnected) return;

        const el = (tag, className, attrs = {}) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
            return node;
        };

        const dialog = el('dialog', '', {
            id: DOM_IDS.ROUTINE_BROWSER,
            'aria-labelledby': DOM_IDS.ROUTINE_BROWSER_HEADING,
            'aria-modal': 'true'
        });

        const top = el('div', DOM_CLASSES.RB_TOP);
        const closeBtn = el('button', DOM_CLASSES.RB_CLOSE_BTN, { type: 'button', 'aria-label': getLabel('routineBrowser.closeAria') });
        closeBtn.textContent = '×';
        const heading = el('h2', 'visually-hidden', { id: DOM_IDS.ROUTINE_BROWSER_HEADING });
        heading.textContent = getLabel('routineBrowser.title');

        const sort = el('div', DOM_CLASSES.RB_SORT, { role: 'group', 'aria-label': getLabel('routineBrowser.sortAria') });
        const sortBtns = {};
        for (const [mode, key] of [[ROUTINE_BROWSER_SORT.RECENT, 'routineBrowser.sortRecent'], [ROUTINE_BROWSER_SORT.ALPHA, 'routineBrowser.sortAlpha']]) {
            const b = el('button', DOM_CLASSES.RB_SORT_BTN, { type: 'button', 'aria-pressed': 'false' });
            b.dataset.sort = mode;
            b.textContent = getLabel(key);
            sortBtns[mode] = b;
            sort.appendChild(b);
        }

        const allBtn = el('button', DOM_CLASSES.RB_ALL_BTN, {
            type: 'button', 'aria-expanded': 'false', 'aria-controls': DOM_IDS.ROUTINE_BROWSER_JUMP_LIST,
            'aria-label': getLabel('routineBrowser.allRoutinesAria')
        });
        allBtn.textContent = `☰ ${getLabel('routineBrowser.allRoutines')}`;

        // Top-right corner: back to the list, with the list's own folder icon.
        const toList = el('button', DOM_CLASSES.RB_CORNER_BTN, { type: 'button', 'aria-label': getLabel('routineBrowser.toListAria'), title: getLabel('routineBrowser.toListAria') });
        toList.innerHTML = getIcon('folder');
        toList.appendChild(document.createTextNode(` ${getLabel('routineBrowser.toList')}`));

        top.append(closeBtn, heading, sort, allBtn, toList);

        const stage = el('div', DOM_CLASSES.RB_STAGE);
        const prevBtn = el('button', DOM_CLASSES.RB_NAV_BTN, { type: 'button', 'aria-label': getLabel('routineBrowser.prev') });
        prevBtn.dataset.dir = '-1';
        prevBtn.textContent = '‹';
        const card = el('section', DOM_CLASSES.RB_CARD);
        const nextBtn = el('button', DOM_CLASSES.RB_NAV_BTN, { type: 'button', 'aria-label': getLabel('routineBrowser.next') });
        nextBtn.dataset.dir = '1';
        nextBtn.textContent = '›';
        stage.append(prevBtn, card, nextBtn);

        const info = el('div', DOM_CLASSES.RB_INFO);
        const title = el('div', DOM_CLASSES.RB_TITLE);
        const metaMode = el('div', DOM_CLASSES.RB_META);
        const metaSize = el('div', DOM_CLASSES.RB_META);
        info.append(title, metaMode, metaSize);

        const actions = el('div', DOM_CLASSES.RB_ACTIONS);
        const createBtn = el('button', DOM_CLASSES.RB_CREATE_BTN, { type: 'button' });
        createBtn.textContent = getLabel('routineBrowser.createAnother');
        const openBtn = el('button', DOM_CLASSES.RB_OPEN_BTN, { type: 'button' });
        openBtn.textContent = getLabel('routineBrowser.open');
        actions.append(createBtn, openBtn);

        const jump = el('div', DOM_CLASSES.RB_JUMP, { id: DOM_IDS.ROUTINE_BROWSER_JUMP_LIST, role: 'region', 'aria-label': getLabel('routineBrowser.jumpListAria') });
        jump.hidden = true;
        const jumpList = el('ul', '');
        jump.appendChild(jumpList);

        dialog.append(top, stage, info, actions, jump);
        document.body.appendChild(dialog);

        this._dialog = dialog;
        this._els = { closeBtn, sortBtns, allBtn, toList, stage, prevBtn, card, nextBtn, title, metaMode, metaSize, createBtn, openBtn, jump, jumpList };
    }

    // ────────────────────────────────────────────────────────────────────────
    // Rendering
    // ────────────────────────────────────────────────────────────────────────

    _routines() {
        return getRoutines(this.deps.AppState.get()) || {};
    }

    _currentKey() {
        return this._order[this._index] || null;
    }

    /**
     * Draw the routine at this._index.
     * @param {number} direction - -1 / 1 for the slide-in, 0 for none
     */
    _render(direction) {
        const routines = this._routines();
        const key = this._currentKey();
        const routine = routines[key];
        if (!routine) return;

        const state = this.deps.AppState.get();
        const isCurrent = key === getActiveRoutineId(state);
        const name = routine.title || key;
        const mode = getCycleMode(routine);
        const total = this._order.length;
        const { card, prevBtn, nextBtn, title, metaMode, metaSize, createBtn, openBtn } = this._els;

        // ── the card: the routine as the app draws it, read-only
        card.replaceChildren();
        card.className = DOM_CLASSES.RB_CARD;
        const body = document.body;
        if (body.classList.contains(DOM_CLASSES.FOCUS_MODE)) card.classList.add(DOM_CLASSES.RB_CARD_FOCUS_STYLE);
        card.setAttribute('aria-label', getLabel('routineBrowser.cardAria', { vars: { name } }));
        this._applyTheme(card, routine, state);

        if (!card.classList.contains(DOM_CLASSES.RB_CARD_FOCUS_STYLE)) {
            // Home View shows the mode above the list; Focus View does not.
            const pill = document.createElement('div');
            pill.className = DOM_CLASSES.RB_MODE_PILL;
            pill.textContent = `${getLabel(MODE_LABEL[mode])} ${MODE_EMOJI[mode]}`;
            card.appendChild(pill);
        }

        const panel = document.createElement('div');
        panel.className = DOM_CLASSES.RB_PANEL;
        const panelTitle = document.createElement('div');
        panelTitle.className = DOM_CLASSES.RB_PANEL_TITLE;
        panelTitle.textContent = name;
        if (isCurrent) {
            const tag = document.createElement('span');
            tag.className = DOM_CLASSES.RB_CURRENT_TAG;
            tag.textContent = getLabel('routineBrowser.current');
            panelTitle.appendChild(tag);
        }
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
            for (const task of tasks) {
                const li = document.createElement('li');
                li.className = DOM_CLASSES.RB_TASK + (task.completed ? ` ${DOM_CLASSES.RB_TASK_DONE}` : '');
                const check = document.createElement('span');
                check.className = DOM_CLASSES.RB_CHECK;
                check.setAttribute('aria-hidden', 'true');
                const text = document.createElement('span');
                text.textContent = task.text || '';
                li.append(check, text);
                list.appendChild(li);
            }
            panel.appendChild(list);
        }
        card.appendChild(panel);

        const done = tasks.filter(t => t.completed).length;
        const progress = document.createElement('div');
        progress.className = DOM_CLASSES.RB_PROGRESS;
        progress.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('div');
        fill.className = DOM_CLASSES.RB_PROGRESS_FILL;
        fill.style.width = `${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`;
        progress.appendChild(fill);
        card.appendChild(progress);

        if (direction) {
            card.classList.add(direction > 0 ? DOM_CLASSES.RB_CARD_ENTER_NEXT : DOM_CLASSES.RB_CARD_ENTER_PREV);
        }

        // ── the details under it
        title.textContent = name;
        const single = total < 2;
        metaMode.textContent = single
            ? `${MODE_EMOJI[mode]} ${getLabel(MODE_LABEL[mode])} · ${getLabel('routineBrowser.onlyOne')}`
            : `${MODE_EMOJI[mode]} ${getLabel(MODE_LABEL[mode])} · ${getLabel('routineBrowser.position', { vars: { position: this._index + 1, total } })}`;
        metaSize.textContent = this._storageLine(routine);

        prevBtn.disabled = single || this._index === 0;
        nextBtn.disabled = single || this._index === total - 1;
        createBtn.hidden = !single;
        openBtn.setAttribute('aria-label', getLabel('routineBrowser.openAria', { vars: { name } }));
    }

    /**
     * Paint the card in its routine's theme. The real task list reads the same
     * --pref-* variables, from <body>, where the ACTIVE routine's theme sets
     * them — so a card for a classic routine shown while a themed routine is
     * active must clear them (initial → the CSS fallbacks), or it would wear the
     * other routine's colours. Dark mode drops theme colours app-wide; so does
     * the card.
     */
    _applyTheme(card, routine, state) {
        for (const cssVar of Object.values(CARD_THEME_VARS)) card.style.removeProperty(cssVar);
        if (document.body.classList.contains(DOM_CLASSES.DARK_MODE)) return;

        const preset = THEME_DEFINITIONS[routine.theme]?.colorPreset || null;
        const activeTheme = THEME_DEFINITIONS[getRoutines(state)?.[getActiveRoutineId(state)]?.theme];
        for (const [key, cssVar] of Object.entries(CARD_THEME_VARS)) {
            if (preset?.[key]) card.style.setProperty(cssVar, preset[key]);
            else if (activeTheme?.colorPreset) card.style.setProperty(cssVar, 'initial');
        }
    }

    /** "~5 KB · 79 KB of 9.71 MB used" — the same figures as the switcher's storage bar. */
    _storageLine(routine) {
        const format = (bytes) => this.m.formatBytes(bytes);
        const info = this.m.getStorageInfo();
        if (!info) return format(this.m.getObjectSizeBytes(routine));
        return getLabel('routineBrowser.storageLine', {
            vars: { size: `~${format(this.m.getObjectSizeBytes(routine))}`, used: format(info.used), total: format(info.total) }
        });
    }

    _announce() {
        const routine = this._routines()[this._currentKey()];
        if (!routine) return;
        const mode = getCycleMode(routine);
        announce(getLabel('routineBrowser.announce', {
            vars: { name: routine.title || this._currentKey(), mode: getLabel(MODE_LABEL[mode]), position: this._index + 1, total: this._order.length }
        }));
    }

    _syncSortButtons() {
        for (const [mode, btn] of Object.entries(this._els.sortBtns)) {
            const on = mode === this._sort;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle(DOM_CLASSES.ACTIVE, on);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Actions
    // ────────────────────────────────────────────────────────────────────────

    /** Step one routine. No wrap-around: the ends are ends. */
    move(step) {
        const next = this._index + step;
        if (next < 0 || next >= this._order.length) return false;
        this._index = next;
        this._render(step);
        this._announce();
        return true;
    }

    /** Jump straight to a routine (the All routines list). */
    jumpTo(key) {
        const i = this._order.indexOf(key);
        if (i === -1) return;
        const step = Math.sign(i - this._index);
        this._index = i;
        this._render(step);
        this._announce();
    }

    setSort(sort) {
        if (!Object.values(ROUTINE_BROWSER_SORT).includes(sort)) return;
        const key = this._currentKey();
        this._sort = sort;
        this._order = orderRoutines(this._routines(), sort);
        // Stay on the routine being looked at; only its neighbours change.
        this._index = Math.max(0, this._order.indexOf(key));
        this._syncSortButtons();
        this._render(0);
        if (!this._els.jump.hidden) this._fillJumpList();
        this.deps.AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.routineBrowserSort = sort;
        });
    }

    /** Open the routine on screen — through the switcher, exactly as the list does. */
    openCurrent() {
        const key = this._currentKey();
        if (!key) return;
        const isCurrent = key === getActiveRoutineId(this.deps.AppState.get());
        this.close();
        if (!isCurrent) this.m._openRoutineByKey(key);
    }

    createAnother() {
        this.close();
        this.deps.showCycleCreationModal?.();
    }

    // ────────────────────────────────────────────────────────────────────────
    // All routines (jump list)
    // ────────────────────────────────────────────────────────────────────────

    _fillJumpList() {
        const routines = this._routines();
        const current = this._currentKey();
        const { jumpList } = this._els;
        jumpList.replaceChildren();
        const dateFmt = { month: 'short', day: 'numeric', year: 'numeric' };
        for (const key of this._order) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = DOM_CLASSES.RB_JUMP_ITEM + (key === current ? ` ${DOM_CLASSES.RB_JUMP_ITEM_CURRENT}` : '');
            btn.dataset.key = key;
            if (key === current) btn.setAttribute('aria-current', 'true');
            const name = document.createElement('span');
            name.textContent = routines[key]?.title || key;
            btn.appendChild(name);
            if (this._sort === ROUTINE_BROWSER_SORT.RECENT) {
                const when = routineRecency(routines[key]);
                const date = document.createElement('span');
                date.className = DOM_CLASSES.RB_JUMP_DATE;
                date.textContent = when ? new Date(when).toLocaleDateString(undefined, dateFmt) : getLabel('routineBrowser.dateUnknown');
                btn.appendChild(date);
            }
            li.appendChild(btn);
            jumpList.appendChild(li);
        }
    }

    _openJumpList() {
        const { jump, allBtn, jumpList } = this._els;
        this._fillJumpList();
        jump.hidden = false;
        allBtn.setAttribute('aria-expanded', 'true');
        const current = jumpList.querySelector(`.${DOM_CLASSES.RB_JUMP_ITEM_CURRENT}`) || jumpList.querySelector('button');
        current?.scrollIntoView({ block: 'nearest' });
        current?.focus();
    }

    _closeJumpList({ restoreFocus = true } = {}) {
        if (!this._els) return;
        const { jump, allBtn } = this._els;
        const wasOpen = !jump.hidden;
        jump.hidden = true;
        allBtn.setAttribute('aria-expanded', 'false');
        if (wasOpen && restoreFocus) allBtn.focus();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Input — attached on open, removed on close
    // ────────────────────────────────────────────────────────────────────────

    _on(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this._listeners.push(() => target.removeEventListener(type, handler, options));
    }

    _detachListeners() {
        this._listeners.forEach(off => off());
        this._listeners = [];
        clearTimeout(this._wheelQuietTimer);
        this._wheelLocked = false;
        this._touch = null;
    }

    _attachListeners() {
        this._detachListeners();
        const { closeBtn, sortBtns, allBtn, toList, stage, createBtn, openBtn, jump } = this._els;
        const dialog = this._dialog;

        this._on(closeBtn, 'click', () => this.close());
        this._on(toList, 'click', () => this.close({ toList: true }));
        Object.values(sortBtns).forEach(b => this._on(b, 'click', () => this.setSort(b.dataset.sort)));
        this._on(allBtn, 'click', () => (jump.hidden ? this._openJumpList() : this._closeJumpList()));
        this._on(openBtn, 'click', () => this.openCurrent());
        this._on(createBtn, 'click', () => this.createAnother());
        this._on(stage, 'click', (e) => {
            const nav = e.target.closest(`.${DOM_CLASSES.RB_NAV_BTN}`);
            if (nav) { this.move(Number(nav.dataset.dir)); return; }
            // A tap on the routine opens it (it is read-only, so a tap cannot
            // mean "tick this task"). Not the tap that ended a swipe.
            if (e.target.closest(`.${DOM_CLASSES.RB_CARD}`)) {
                if (this._suppressClick) { this._suppressClick = false; return; }
                this.openCurrent();
            }
        });
        this._on(jump, 'click', (e) => {
            const item = e.target.closest(`.${DOM_CLASSES.RB_JUMP_ITEM}`);
            if (!item) return;
            this.jumpTo(item.dataset.key);
            this._closeJumpList();
        });
        this._on(jump, 'keydown', (e) => {
            handleVerticalArrowNav(e, this._els.jumpList, `.${DOM_CLASSES.RB_JUMP_ITEM}`, { wrap: false, skipHidden: true });
        });

        // Escape is "back": closes the jump list first; then returns to the list
        // when Browse was opened from it, else closes Browse.
        this._on(dialog, 'cancel', (e) => {
            e.preventDefault();
            if (!this._els.jump.hidden) { this._closeJumpList(); return; }
            this.close({ toList: this._fromList });
        });

        // However the dialog closes (close(), or anything else closing it), its
        // input listeners go with it.
        this._on(dialog, 'close', () => this._detachListeners());

        this._on(dialog, 'keydown', (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (!this._els.jump.hidden && this._els.jump.contains(e.target)) return;
            const onControl = e.target.closest?.(DOM_SELECTORS.NATIVE_CONTROL);
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                this.move(e.key === 'ArrowRight' ? 1 : -1);
            } else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                this.jumpTo(this._order[e.key === 'Home' ? 0 : this._order.length - 1]);
            } else if (e.key === 'Enter' && !onControl) {
                e.preventDefault();
                this.openCurrent();
            }
        });

        // Mouse wheel / trackpad: one gesture moves one routine. Over a task list
        // that can still scroll in the wheel's direction, the wheel scrolls it;
        // at its top or bottom the next notch moves on.
        this._on(stage, 'wheel', (e) => {
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            const tasks = e.target.closest?.(`.${DOM_CLASSES.RB_TASKS}`);
            if (tasks && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
                const canScroll = delta > 0
                    ? tasks.scrollTop + tasks.clientHeight < tasks.scrollHeight - 1
                    : tasks.scrollTop > 0;
                if (canScroll) return;
            }
            e.preventDefault();
            clearTimeout(this._wheelQuietTimer);
            this._wheelQuietTimer = setTimeout(() => { this._wheelLocked = false; }, UI_TIMEOUTS.ROUTINE_BROWSER_WHEEL_QUIET);
            if (this._wheelLocked || Math.abs(delta) < GESTURE.WHEEL_SCROLL_MIN) return;
            this._wheelLocked = true;
            this.move(delta > 0 ? 1 : -1);
        }, { passive: false });

        // Sideways swipe. Vertical drags are left to the task list's scrolling.
        this._on(stage, 'touchstart', (e) => {
            const t = e.touches[0];
            this._touch = t ? { x: t.clientX, y: t.clientY } : null;
        }, { passive: true });
        this._on(stage, 'touchend', (e) => {
            const start = this._touch;
            this._touch = null;
            const t = e.changedTouches[0];
            if (!start || !t) return;
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) >= GESTURE.TOUCH_SWIPE && Math.abs(dx) > Math.abs(dy) * GESTURE.AXIS_DOMINANCE_RATIO) {
                this._suppressClick = true;
                setTimeout(() => { this._suppressClick = false; }, UI_TIMEOUTS.ROUTINE_BROWSER_SWIPE_CLICK_GUARD);
                // Finger moves left → the next routine comes in from the right.
                this.move(dx < 0 ? 1 : -1);
            }
        }, { passive: true });

        // The card itself is a click target only (a <section> with a list in it
        // cannot be a <button>); keyboard users open with Enter or the Open button.
    }
}
