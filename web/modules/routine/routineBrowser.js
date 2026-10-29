/**
 * miniCycle Routine Switcher — Browse Routines
 *
 * A second way to open routines, full screen and READ-ONLY, each routine drawn
 * the way the app draws it (its theme's colours, the Home View or Focus View
 * look the user is in). Two layouts (designed with the user, Oct 2026):
 *
 *   Cards — one routine in front, its neighbours peeking at the sides, turned a
 *           little toward it, on a screen wide enough to show them. Flip with
 *           the ‹ › beside the name, the arrow keys, a sideways swipe, the mouse
 *           wheel, or a click on a neighbour; open with the Open button, a tap
 *           on the routine in front, or Enter.
 *   Grid  — every routine as a tile. A tap selects (shows its details below);
 *           a tap on the selected tile, the Open button or Enter opens it.
 *
 * (An "All routines" jump list went once Grid existed: Grid shows them all,
 * and better — the user's call, Oct 2026.) Settings → "When you open routines,
 * show" decides whether the routine button opens this or the list, and each
 * view has a corner button to the other.
 *
 * ── PATTERN: MANAGER BACK-REFERENCE, AS IN routineSwitcherActions ─────────────
 * `this.m` is the owning RoutineSwitcher. Its deps are this module's deps
 * (`this.m.deps.*`), and opening a routine goes through the switcher's own
 * `_openRoutineByKey()` so Browse switches exactly the way the list does — same
 * repair, same undo context, same lastAccessedAt bookkeeping. Storage figures come
 * through the switcher's live bindings (`getObjectSizeBytes`, `getStorageInfo`,
 * `formatBytes`), never a second import of storageUtils: a bare import of a module
 * the app loads with `?v=` would be a second instance with its own quota cache
 * (MAKING_CODE_CHANGES.md, pitfall 6). The drawing lives in routineBrowserRender.js.
 *
 * ── THE CAROUSEL ────────────────────────────────────────────────────────────
 * The routines at -2…+2 around the one in front each have a card, positioned by
 * its `data-pos` (CSS does the rest, and its transitions are the animation).
 * A step re-labels the cards already there, slides the one leaving to ±3 and
 * removes it, and brings the new end card in from ±3. A bigger jump redraws.
 * Narrow screens park the neighbours off-screen instead of hiding them, so a
 * swipe still slides.
 *
 * ── REGISTRATION ────────────────────────────────────────────────────────────
 * Static import, constructed in the switcher's constructor, like
 * routineSwitcherActions — listed in FACADE_SUB_FILES (validate-di-deps) and
 * BOOT_CRITICAL (service-worker.js). Not in moduleManifests.js.
 *
 * @module routine/routineBrowser
 */

import { DOM_IDS, DOM_CLASSES, DOM_SELECTORS, UI_TIMEOUTS, GESTURE, LIMITS, BREAKPOINTS, ROUTINE_BROWSER_SORT, ROUTINE_BROWSER_LAYOUT, ROUTINE_OPEN_VIEW } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { announce } from '../utils/announce.js';
import { getIcon } from '../utils/icons.js';
import { prefersReducedMotion } from '../utils/motionPreference.js';
import { getActiveRoutineId, getRoutineBrowserLayout, getRoutineBrowserSort, getRoutines } from '../utils/cycleMode.js';
import { applyRoutineTheme, buildTile, describeMode, fillCard } from './routineBrowserRender.js';

/** How many routines either side of the one in front get a card. */
const CAROUSEL_SPAN = 2;

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
 * "Oct 24", or "Oct 24, 2025" when it is not this year.
 * @param {number} ms - epoch ms
 * @returns {string}
 */
function formatDay(ms) {
    const date = new Date(ms);
    const opts = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return date.toLocaleDateString(undefined, opts);
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
        this._layout = ROUTINE_BROWSER_LAYOUT.CARDS;
        this._cards = new Map();      // routine key → its card in the carousel
        this._exitTimers = new Set(); // cards sliding out, removed when done
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
        this._layout = getRoutineBrowserLayout(state);
        this._order = orderRoutines(routines, this._sort);
        this._index = Math.max(0, this._order.indexOf(getActiveRoutineId(state)));

        this.deps.hideMainMenu?.();
        this._attachListeners();
        this._syncToggles();
        this._clearCards();
        if (this._layout === ROUTINE_BROWSER_LAYOUT.GRID) this._fillGrid();
        this._render(0);
        if (!this._dialog.open) this._dialog.showModal();
        this._focusSelection();
        this._announce();
    }

    /**
     * @param {{toList?: boolean}} [options] - toList: show the Open Routine list next
     */
    close({ toList = false } = {}) {
        if (!this._dialog) return;
        this._detachListeners();
        this._clearCards();
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
        this._clearCards();
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
        const iconButton = (className, icon, labelKey, attrs = {}) => {
            const b = el('button', className, { type: 'button', ...attrs });
            b.innerHTML = getIcon(icon);
            const text = el('span', '');
            text.textContent = getLabel(labelKey);
            b.appendChild(text);
            return b;
        };

        const dialog = el('dialog', '', {
            id: DOM_IDS.ROUTINE_BROWSER,
            'aria-labelledby': DOM_IDS.ROUTINE_BROWSER_HEADING,
            'aria-modal': 'true'
        });

        // ── top bar
        const top = el('div', DOM_CLASSES.RB_TOP);
        const closeBtn = el('button', DOM_CLASSES.RB_CLOSE_BTN, { type: 'button', 'aria-label': getLabel('routineBrowser.closeAria') });
        closeBtn.textContent = '×';
        const heading = el('h2', 'visually-hidden', { id: DOM_IDS.ROUTINE_BROWSER_HEADING });
        heading.textContent = getLabel('routineBrowser.title');

        const layout = el('div', DOM_CLASSES.RB_LAYOUT, { role: 'group', 'aria-label': getLabel('routineBrowser.layoutAria') });
        const layoutBtns = {
            [ROUTINE_BROWSER_LAYOUT.CARDS]: iconButton(DOM_CLASSES.RB_LAYOUT_BTN, 'cards', 'routineBrowser.layoutCards', { 'aria-pressed': 'false' }),
            [ROUTINE_BROWSER_LAYOUT.GRID]: iconButton(DOM_CLASSES.RB_LAYOUT_BTN, 'grid', 'routineBrowser.layoutGrid', { 'aria-pressed': 'false' })
        };
        for (const [value, b] of Object.entries(layoutBtns)) {
            b.dataset.layout = value;
            layout.appendChild(b);
        }

        const sort = el('div', DOM_CLASSES.RB_SORT, { role: 'group', 'aria-label': getLabel('routineBrowser.sortAria') });
        const sortBtns = {};
        for (const [value, key] of [[ROUTINE_BROWSER_SORT.RECENT, 'routineBrowser.sortRecent'], [ROUTINE_BROWSER_SORT.ALPHA, 'routineBrowser.sortAlpha']]) {
            const b = el('button', DOM_CLASSES.RB_SORT_BTN, { type: 'button', 'aria-pressed': 'false' });
            b.dataset.sort = value;
            b.textContent = getLabel(key);
            sortBtns[value] = b;
            sort.appendChild(b);
        }

        // Top-right corner: back to the list, with the list's own folder icon.
        const toList = iconButton(DOM_CLASSES.RB_CORNER_BTN, 'folder', 'routineBrowser.toList', {
            'aria-label': getLabel('routineBrowser.toListAria'), title: getLabel('routineBrowser.toListAria')
        });

        top.append(closeBtn, heading, layout, sort, toList);

        // ── the two layouts
        const stage = el('div', DOM_CLASSES.RB_STAGE);
        const track = el('div', DOM_CLASSES.RB_TRACK);
        stage.appendChild(track);
        const grid = el('div', DOM_CLASSES.RB_GRID, { id: DOM_IDS.ROUTINE_BROWSER_GRID, role: 'listbox', 'aria-label': getLabel('routineBrowser.gridAria') });

        // ── under the routine: ‹ name ›, its mode and place, its size
        const info = el('div', DOM_CLASSES.RB_INFO);
        const titleRow = el('div', DOM_CLASSES.RB_TITLE_ROW);
        const prevBtn = el('button', DOM_CLASSES.RB_NAV_BTN, { type: 'button', 'aria-label': getLabel('routineBrowser.prev') });
        prevBtn.dataset.dir = '-1';
        prevBtn.textContent = '‹';
        const title = el('div', DOM_CLASSES.RB_TITLE);
        const nextBtn = el('button', DOM_CLASSES.RB_NAV_BTN, { type: 'button', 'aria-label': getLabel('routineBrowser.next') });
        nextBtn.dataset.dir = '1';
        nextBtn.textContent = '›';
        titleRow.append(prevBtn, title, nextBtn);
        const metaMode = el('div', DOM_CLASSES.RB_META);
        const metaSize = el('div', DOM_CLASSES.RB_META);
        info.append(titleRow, metaMode, metaSize);

        const actions = el('div', DOM_CLASSES.RB_ACTIONS);
        const createBtn = el('button', DOM_CLASSES.RB_CREATE_BTN, { type: 'button' });
        createBtn.textContent = getLabel('routineBrowser.createAnother');
        const openBtn = el('button', DOM_CLASSES.RB_OPEN_BTN, { type: 'button' });
        openBtn.textContent = getLabel('routineBrowser.open');
        actions.append(createBtn, openBtn);

        dialog.append(top, stage, grid, info, actions);
        document.body.appendChild(dialog);

        this._dialog = dialog;
        this._els = { closeBtn, layoutBtns, sortBtns, toList, stage, track, grid, prevBtn, title, nextBtn, metaMode, metaSize, createBtn, openBtn };
    }

    // ────────────────────────────────────────────────────────────────────────
    // Rendering
    // ────────────────────────────────────────────────────────────────────────

    _state() {
        return this.deps.AppState.get();
    }

    _routines() {
        return getRoutines(this._state()) || {};
    }

    _currentKey() {
        return this._order[this._index] || null;
    }

    _isGrid() {
        return this._layout === ROUTINE_BROWSER_LAYOUT.GRID;
    }

    /**
     * Show the routine at this._index: in the carousel or as the grid's
     * selection, and in the details under it.
     * @param {number} step - how far it moved (for the carousel's slide), 0 for none
     */
    _render(step) {
        const routines = this._routines();
        const key = this._currentKey();
        const routine = routines[key];
        if (!routine) return;

        const { stage, grid } = this._els;
        stage.hidden = this._isGrid();
        grid.hidden = !this._isGrid();

        if (this._isGrid()) this._syncGridSelection();
        else this._renderTrack(step);
        this._renderInfo(routine);
    }

    _renderInfo(routine) {
        const { prevBtn, nextBtn, title, metaMode, metaSize, createBtn, openBtn } = this._els;
        const name = routine.title || this._currentKey();
        const total = this._order.length;
        const single = total < 2;
        const { emoji, name: modeName } = describeMode(routine);

        title.textContent = name;
        const parts = [`${emoji} ${modeName}`, single
            ? getLabel('routineBrowser.onlyOne')
            : getLabel('routineBrowser.position', { vars: { position: this._index + 1, total } })];
        // When it was last used — what the old "All routines" list showed.
        const when = routineRecency(routine);
        if (when) parts.push(getLabel('routineBrowser.lastUsed', { vars: { date: formatDay(when) } }));
        metaMode.textContent = parts.join(' · ');
        metaSize.textContent = this._storageLine(routine);

        prevBtn.disabled = single || this._index === 0;
        nextBtn.disabled = single || this._index === total - 1;
        createBtn.hidden = !single;
        openBtn.setAttribute('aria-label', getLabel('routineBrowser.openAria', { vars: { name } }));
    }

    /** A card for one routine, in its theme, drawn the way the user's view draws it. */
    _makeCard(key) {
        const state = this._state();
        const routines = getRoutines(state) || {};
        const routine = routines[key];
        const card = document.createElement('section');
        card.className = DOM_CLASSES.RB_CARD;
        card.dataset.key = key;
        fillCard(card, routine, {
            name: routine.title || key,
            isCurrent: key === getActiveRoutineId(state)
        });
        applyRoutineTheme(card, routine, routines[getActiveRoutineId(state)] || null);
        return card;
    }

    /**
     * Lay the carousel out around this._index. A step of up to CAROUSEL_SPAN
     * slides (cards already there move to their new place, the one leaving goes
     * out past the edge, a new one comes in from it); anything else redraws.
     */
    _renderTrack(step) {
        const { track } = this._els;
        const wanted = new Map();
        for (let pos = -CAROUSEL_SPAN; pos <= CAROUSEL_SPAN; pos++) {
            const key = this._order[this._index + pos];
            if (key) wanted.set(key, pos);
        }

        const slide = step !== 0 && Math.abs(step) <= CAROUSEL_SPAN && this._cards.size > 0 && !prefersReducedMotion();
        if (!slide) this._clearCards();

        const edge = CAROUSEL_SPAN + 1;
        const clamp = (pos) => Math.max(-edge, Math.min(edge, pos));

        for (const [key, card] of this._cards) {
            if (wanted.has(key)) continue;
            // Leaving: slide out past the edge, then go.
            this._cards.delete(key);
            card.dataset.pos = String(clamp(Number(card.dataset.pos) - step));
            card.setAttribute('aria-hidden', 'true');
            const timer = setTimeout(() => {
                card.remove();
                this._exitTimers.delete(timer);
            }, UI_TIMEOUTS.ROUTINE_BROWSER_CARD_EXIT);
            this._exitTimers.add(timer);
        }

        const entering = [];
        for (const [key, pos] of wanted) {
            let card = this._cards.get(key);
            if (!card) {
                card = this._makeCard(key);
                // Coming in from past the edge on the side it moves in from.
                card.dataset.pos = String(slide ? clamp(pos + step) : pos);
                track.appendChild(card);
                this._cards.set(key, card);
                if (slide) entering.push([card, pos]);
            } else {
                card.dataset.pos = String(pos);
            }
            // Only the routine in front is offered to assistive tech; the
            // neighbours are a visual hint (keyboard users have ← →).
            if (pos === 0) {
                card.removeAttribute('aria-hidden');
                card.setAttribute('aria-label', getLabel('routineBrowser.cardAria', { vars: { name: this._routines()[key]?.title || key } }));
            } else {
                card.setAttribute('aria-hidden', 'true');
                card.removeAttribute('aria-label');
            }
        }
        if (entering.length) {
            // One reflow so the entering cards start from the edge, then move in.
            void track.offsetWidth;
            entering.forEach(([card, pos]) => { card.dataset.pos = String(pos); });
        }
    }

    /** Drop every card now (opening, re-sorting, a jump, closing). */
    _clearCards() {
        this._exitTimers.forEach(clearTimeout);
        this._exitTimers.clear();
        this._cards.clear();
        this._els?.track.replaceChildren();
    }

    /** One tile per routine, in the current order. Fewer tasks a tile on a phone. */
    _fillGrid() {
        const state = this._state();
        const routines = getRoutines(state) || {};
        const activeId = getActiveRoutineId(state);
        const maxTasks = this._phoneQuery().matches ? LIMITS.ROUTINE_BROWSER_TILE_TASKS_PHONE : LIMITS.ROUTINE_BROWSER_TILE_TASKS;
        const tiles = this._order.map(key => buildTile(routines[key], {
            key,
            name: routines[key]?.title || key,
            isCurrent: key === activeId,
            activeRoutine: routines[activeId] || null,
            maxTasks
        }));
        this._els.grid.replaceChildren(...tiles);
    }

    /** Browse's phone width — the same one its CSS lays the phone out at. */
    _phoneQuery() {
        if (!this._phoneMql) this._phoneMql = window.matchMedia(`(max-width: ${BREAKPOINTS.BROWSE_PHONE_MAX}px)`);
        return this._phoneMql;
    }

    _gridTiles() {
        return [...this._els.grid.querySelectorAll(`.${DOM_CLASSES.RB_TILE}`)];
    }

    /** Mark the selected tile — one Tab stop (roving tabindex) — and keep it in view. */
    _syncGridSelection() {
        const key = this._currentKey();
        for (const tile of this._gridTiles()) {
            const on = tile.dataset.key === key;
            tile.setAttribute('aria-selected', String(on));
            tile.tabIndex = on ? 0 : -1;
            if (on) tile.scrollIntoView({ block: 'nearest' });
        }
    }

    _selectedTile() {
        return this._gridTiles().find(t => t.dataset.key === this._currentKey()) || null;
    }

    /** Focus what Enter would act on: the grid's selected tile, or Open. */
    _focusSelection() {
        const target = this._isGrid() ? this._selectedTile() : this._els.openBtn;
        target?.focus({ focusVisible: false });
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
        announce(getLabel('routineBrowser.announce', {
            vars: { name: routine.title || this._currentKey(), mode: describeMode(routine).name, position: this._index + 1, total: this._order.length }
        }));
    }

    _syncToggles() {
        for (const [value, btn] of Object.entries(this._els.sortBtns)) {
            const on = value === this._sort;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle(DOM_CLASSES.ACTIVE, on);
        }
        for (const [value, btn] of Object.entries(this._els.layoutBtns)) {
            const on = value === this._layout;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle(DOM_CLASSES.ACTIVE, on);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Actions
    // ────────────────────────────────────────────────────────────────────────

    /** Step through the order. No wrap-around: the ends are ends. */
    move(step) {
        const next = this._index + step;
        if (step === 0 || next < 0 || next >= this._order.length) return false;
        this._index = next;
        this._render(step);
        if (this._isGrid()) this._selectedTile()?.focus();
        this._announce();
        return true;
    }

    setSort(sort) {
        if (!Object.values(ROUTINE_BROWSER_SORT).includes(sort)) return;
        const key = this._currentKey();
        this._sort = sort;
        this._order = orderRoutines(this._routines(), sort);
        // Stay on the routine being looked at; only its neighbours change.
        this._index = Math.max(0, this._order.indexOf(key));
        this._syncToggles();
        this._clearCards();
        if (this._isGrid()) this._fillGrid();
        this._render(0);
        this.deps.AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.routineBrowserSort = sort;
        });
    }

    setLayout(layout) {
        if (!Object.values(ROUTINE_BROWSER_LAYOUT).includes(layout) || layout === this._layout) return;
        this._layout = layout;
        this._syncToggles();
        this._clearCards();
        if (this._isGrid()) this._fillGrid();
        this._render(0);
        this.deps.AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.routineBrowserLayout = layout;
        });
    }

    /** Open the routine shown — through the switcher, exactly as the list does. */
    openCurrent() {
        const key = this._currentKey();
        if (!key) return;
        const isCurrent = key === getActiveRoutineId(this._state());
        this.close();
        if (!isCurrent) this.m._openRoutineByKey(key);
    }

    createAnother() {
        this.close();
        this.deps.showCycleCreationModal?.();
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

    /** Columns in the grid as laid out now: the tiles sharing the first one's row. */
    _gridColumns() {
        const tiles = this._gridTiles();
        if (!tiles.length) return 1;
        const top = tiles[0].offsetTop;
        return Math.max(1, tiles.filter(t => t.offsetTop === top).length);
    }

    _attachListeners() {
        this._detachListeners();
        const { closeBtn, layoutBtns, sortBtns, toList, stage, grid, prevBtn, nextBtn, createBtn, openBtn } = this._els;
        const dialog = this._dialog;

        this._on(closeBtn, 'click', () => this.close());
        this._on(toList, 'click', () => this.close({ toList: true }));
        Object.values(layoutBtns).forEach(b => this._on(b, 'click', () => {
            this.setLayout(b.dataset.layout);
            this._focusSelection();
        }));
        Object.values(sortBtns).forEach(b => this._on(b, 'click', () => this.setSort(b.dataset.sort)));
        this._on(prevBtn, 'click', () => this.move(-1));
        this._on(nextBtn, 'click', () => this.move(1));
        this._on(openBtn, 'click', () => this.openCurrent());
        this._on(createBtn, 'click', () => this.createAnother());

        // Cards: a tap on the routine in front opens it (it is read-only, so a
        // tap cannot mean "tick this task"); a tap on a neighbour brings it to
        // the front. Not the tap that ended a swipe.
        this._on(stage, 'click', (e) => {
            const card = e.target.closest(`.${DOM_CLASSES.RB_CARD}`);
            if (!card || !this._cards.has(card.dataset.key)) return;
            if (this._suppressClick) { this._suppressClick = false; return; }
            const pos = Number(card.dataset.pos);
            if (pos === 0) this.openCurrent();
            else this.move(pos);
        });

        // Grid: the first tap selects, a tap on the selected tile opens.
        this._on(grid, 'click', (e) => {
            const tile = e.target.closest(`.${DOM_CLASSES.RB_TILE}`);
            if (!tile) return;
            if (tile.dataset.key === this._currentKey()) { this.openCurrent(); return; }
            this.move(this._order.indexOf(tile.dataset.key) - this._index);
        });

        // A phone turned, or a window resized, across the phone width: the grid's
        // tiles show a different number of tasks there.
        this._on(this._phoneQuery(), 'change', () => {
            if (this._isGrid()) { this._fillGrid(); this._syncGridSelection(); }
        });

        // Escape is "back": returns to the list when Browse was opened from it,
        // else closes Browse.
        this._on(dialog, 'cancel', (e) => {
            e.preventDefault();
            this.close({ toList: this._fromList });
        });

        // However the dialog closes (close(), or anything else closing it), its
        // input listeners and sliding cards go with it.
        this._on(dialog, 'close', () => {
            this._detachListeners();
            this._clearCards();
        });

        this._on(dialog, 'keydown', (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            const onControl = e.target.closest?.(DOM_SELECTORS.NATIVE_CONTROL);
            const rowStep = this._isGrid() ? this._gridColumns() : 0;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                this.move(e.key === 'ArrowRight' ? 1 : -1);
            } else if (rowStep && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // Grid only: a row at a time. In Cards, ↑ ↓ scroll the task list.
                e.preventDefault();
                const target = Math.max(0, Math.min(this._order.length - 1, this._index + (e.key === 'ArrowDown' ? rowStep : -rowStep)));
                this.move(target - this._index);
            } else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                this.move((e.key === 'Home' ? 0 : this._order.length - 1) - this._index);
            } else if (e.key === 'Enter' && !onControl) {
                e.preventDefault();
                this.openCurrent();
            }
        });

        // Mouse wheel / trackpad on the cards: one gesture moves one routine.
        // Over a task list that can still scroll in the wheel's direction, the
        // wheel scrolls it; at its top or bottom the next notch moves on. (The
        // grid scrolls natively.)
        this._on(stage, 'wheel', (e) => {
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            // Only the front card's list scrolls; over a neighbour the wheel moves.
            const tasks = e.target.closest?.(`.${DOM_CLASSES.RB_TASKS}`);
            const inFront = tasks?.closest(`.${DOM_CLASSES.RB_CARD}`)?.dataset.pos === '0';
            if (tasks && inFront && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
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

        // Sideways swipe on the cards. Vertical drags are left to the task
        // list's scrolling.
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
