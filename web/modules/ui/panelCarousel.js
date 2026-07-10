/**
 * Panel Carousel (pure utility class — no DI, no module-level state)
 *
 * Generalizes the main-view panel switcher (task view ↔ stats panel) from a
 * hard-coded binary toggle into an ordered, indexed carousel so a third panel
 * (focus task view) can slot in without rewriting every input path.
 * See docs/future-work/FOCUS_TASK_VIEW_PLAN.md (Phase 0).
 *
 * Ownership: constructed and owned by statsPanel (its `carousel` field). This
 * file is a Pattern-2 "pure utility" module (see LARGE_MODULE_SPLITS_PLAN.md):
 * zero side effects, zero module-level state — the ONLY kind of module that is
 * safe to import statically from a versioned parent (a `?v=`-split second
 * instance of a stateless class is harmless).
 *
 * Responsibilities (generic, same for every panel):
 *   - SHOW/HIDE classes + `inert` on the panel elements
 *   - active state + aria-selected on the panel's nav dot
 *   - ordered navigation with clamping and disabled-panel skipping
 * Panel-specific side effects (slide arrows, announcements, gesture-manager
 * sync, tours) stay in the owner's onShow/onHide callbacks.
 *
 * @module ui/panelCarousel
 */

import { DOM_CLASSES } from '../core/constants.js';

export class PanelCarousel {
    constructor() {
        /** @type {Array<{id:string, element:HTMLElement, dot:HTMLElement|null, onShow:Function|null, onHide:Function|null, enabled:boolean, isEnabled:Function|null}>} */
        this.panels = [];
        this.activeIndex = 0;
    }

    /**
     * Register a panel. Registration order defines swipe order (index 0 = leftmost).
     * The first registered panel is the initial active panel — registration fires
     * no callbacks and writes no classes (see initTo()).
     *
     * @param {Object} def
     * @param {string} def.id - Stable panel id (matches the dot's aria-controls)
     * @param {HTMLElement} def.element - The panel container
     * @param {HTMLElement|null} [def.dot] - The panel's nav-dot button
     * @param {Function|null} [def.onShow] - Panel-specific side effects on show
     * @param {Function|null} [def.onHide] - Panel-specific side effects on hide
     * @param {boolean} [def.enabled=true] - Static enable flag (setPanelEnabled)
     * @param {Function|null} [def.isEnabled] - Dynamic gate, checked lazily at
     *        navigation time IN ADDITION to `enabled` (e.g. Phase 2's
     *        focus-mode + onboarding gates). Returning false makes the panel
     *        unreachable without any event wiring.
     */
    register({ id, element, dot = null, onShow = null, onHide = null, enabled = true, isEnabled = null }) {
        if (!id || !element) return;
        this.panels.push({ id, element, dot, onShow, onHide, enabled, isEnabled });
    }

    /**
     * Set the initial active panel WITHOUT firing callbacks and WITHOUT writing
     * SHOW/HIDE classes. Boot-time markup already renders the initial state
     * (task view visible, stats panel `inert` in HTML); writing .show/.hide at
     * boot would change class-based CSS selectors' behavior on first paint.
     * Only `inert` and dot active state are applied — the exact same writes
     * statsPanel.initView() has always done.
     * @param {string|number} idOrIndex
     */
    initTo(idOrIndex) {
        const index = this._resolveIndex(idOrIndex);
        if (index === -1) return;
        this.activeIndex = index;
        this.panels.forEach((panel, i) => {
            panel.element.inert = i !== index;
        });
        this.refreshDots();
    }

    /**
     * Move by direction (+1 = next/right panel, -1 = previous/left panel).
     * Clamps at the ends; skips disabled panels.
     * @param {number} direction
     * @returns {{id:string, index:number}|null} The new active panel, or null
     *          if clamped (no move). NEVER returns undefined — callers use the
     *          undefined/null distinction to detect dead wiring vs a clamp.
     */
    navigate(direction) {
        if (!this.panels.length || !direction) return null;
        const step = direction > 0 ? 1 : -1;
        let i = this.activeIndex + step;
        while (i >= 0 && i < this.panels.length) {
            if (this._isPanelAvailable(this.panels[i])) {
                return this._apply(i);
            }
            i += step;
        }
        return null;
    }

    /**
     * Go directly to a panel by id or index. Re-applying the already-active
     * panel is allowed and re-fires its onShow (matches the historical
     * idempotent showTaskView()/showStatsPanel() behavior).
     * @param {string|number} idOrIndex
     * @returns {{id:string, index:number}|null}
     */
    goTo(idOrIndex) {
        const index = this._resolveIndex(idOrIndex);
        if (index === -1 || !this._isPanelAvailable(this.panels[index])) return null;
        return this._apply(index);
    }

    /**
     * Advance to the next available panel, wrapping at the end.
     * With two panels this is exactly the historical nav-pill toggle.
     * @returns {{id:string, index:number}|null}
     */
    cycleNext() {
        const count = this.panels.length;
        if (count < 2) return null;
        for (let offset = 1; offset < count; offset++) {
            const i = (this.activeIndex + offset) % count;
            if (this._isPanelAvailable(this.panels[i])) {
                return this._apply(i);
            }
        }
        return null;
    }

    /**
     * Enable/disable a panel (static flag; dynamic gates use isEnabled).
     * Disabling the ACTIVE panel does not move off it — callers decide where
     * to go first (see plan D7).
     */
    setPanelEnabled(id, enabled) {
        const panel = this.panels.find(p => p.id === id);
        if (panel) panel.enabled = !!enabled;
    }

    getActiveIndex() {
        return this.activeIndex;
    }

    getActiveId() {
        return this.panels[this.activeIndex]?.id ?? null;
    }

    /**
     * Re-apply active state to the nav dots (class + aria-selected).
     * Public because label/theme refreshes re-render dot internals.
     */
    refreshDots() {
        this.panels.forEach((panel, i) => {
            if (!panel.dot) return;
            const isActive = i === this.activeIndex;
            panel.dot.classList.toggle(DOM_CLASSES.ACTIVE, isActive);
            panel.dot.setAttribute('aria-selected', String(isActive));
        });
    }

    destroy() {
        this.panels = [];
        this.activeIndex = 0;
    }

    // ------------------------------------------------------------------
    // internals
    // ------------------------------------------------------------------

    _resolveIndex(idOrIndex) {
        if (typeof idOrIndex === 'number') {
            return idOrIndex >= 0 && idOrIndex < this.panels.length ? idOrIndex : -1;
        }
        return this.panels.findIndex(p => p.id === idOrIndex);
    }

    _isPanelAvailable(panel) {
        if (!panel.enabled) return false;
        if (typeof panel.isEnabled === 'function' && !panel.isEnabled()) return false;
        return true;
    }

    /**
     * Make `index` the active panel: classes + inert + dots, then callbacks.
     * onHide fires only on an actual change; onShow always fires for the
     * target (idempotent re-show, matching historical behavior).
     */
    _apply(index) {
        const previous = this.panels[this.activeIndex] || null;
        const next = this.panels[index];
        const changed = index !== this.activeIndex;
        this.activeIndex = index;

        this.panels.forEach((panel, i) => {
            const isActive = i === index;
            panel.element.classList.toggle(DOM_CLASSES.SHOW, isActive);
            panel.element.classList.toggle(DOM_CLASSES.HIDE, !isActive);
            panel.element.inert = !isActive;
        });
        this.refreshDots();

        const ctx = { previousId: previous?.id ?? null, id: next.id, index, changed };
        if (changed && previous?.onHide) {
            try { previous.onHide(ctx); } catch (e) { console.warn(`[panelCarousel] onHide(${previous.id}) failed:`, e); }
        }
        if (next.onShow) {
            try { next.onShow(ctx); } catch (e) { console.warn(`[panelCarousel] onShow(${next.id}) failed:`, e); }
        }
        return { id: next.id, index };
    }
}
