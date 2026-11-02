/**
 * Mode Picker — the Home View header's mode control (Nov 2026)
 *
 * A native <select> can only draw text, and the modes have SVG icons. This
 * is a menu button (WAI-ARIA "menu button" pattern: a button that opens a
 * menu of menuitemradio items) drawn over the same #mode-selector, which
 * stays in the page hidden from sight and from assistive tech. The select
 * remains the ONE source of truth:
 *   - picking an item sets select.value and dispatches 'change', so every
 *     existing listener (modeManager's switch, the stats panel, undo) runs
 *     exactly as it did for the native control;
 *   - every write to select.value — modeManager's own sync, a routine switch,
 *     the Alt+Shift+M shortcut, Focus View's Switch Mode dialog — redraws the
 *     button, because the instance's `value` setter is wrapped (several of
 *     those writers set the value without dispatching any event).
 *
 * Used twice: the header mode control (modeManager) and the routine
 * switcher's mode filter (routineSwitcher), whose extra "All Modes" option
 * passes its own getModeIcon. Statically imported by both (boot-critical:
 * listed in BOOT_CRITICAL).
 */

import { createIconElement } from '../utils/icons.js';

/** Mode value → its icon in the ICONS registry. */
export const MODE_PICKER_ICONS = Object.freeze({
    'auto-cycle': 'mode-auto',
    'manual-cycle': 'mode-manual',
    'todo-mode': 'mode-todo'
});

export class ModePicker {
    /**
     * @param {Object} opts
     * @param {HTMLSelectElement} opts.select - the hidden source of truth
     * @param {HTMLButtonElement} opts.button - the visible menu button
     * @param {HTMLElement} opts.menu - role="menu" container of the items
     * @param {(mode: string) => string} opts.getModeLabel - a mode's name
     * @param {(mode: string) => (string|null)} [opts.getModeIcon] - an option's
     *   ICONS name (default: the mode icons by mode value)
     * @param {(label: string) => string} [opts.getButtonAria] - the button's
     *   accessible name for the current label (default: the label itself)
     * @param {(mode: string) => string} [opts.getItemTitle] - an option's
     *   tooltip (what picking it does); none when omitted
     */
    constructor({ select, button, menu, getModeLabel, getModeIcon, getButtonAria, getItemTitle }) {
        this.select = select;
        this.button = button;
        this.menu = menu;
        this.getModeLabel = getModeLabel;
        this.getModeIcon = getModeIcon || ((mode) => MODE_PICKER_ICONS[mode] || MODE_PICKER_ICONS['auto-cycle']);
        this.getButtonAria = getButtonAria || ((label) => label);
        this.getItemTitle = getItemTitle || null;
        this._listeners = [];
        this._restoreValue = null;

        this._buildItems();
        this._wrapValueSetter();
        this._wire();
        this.sync();
    }

    /** Redraw the button and the checked item from select.value. */
    sync() {
        const mode = this.select.value;
        const label = this.getModeLabel(mode);
        const labelEl = document.createElement('span');
        labelEl.className = 'mode-picker-label';
        labelEl.textContent = label;
        this.button.replaceChildren(this._icon(mode), labelEl);
        this.button.setAttribute('aria-label', this.getButtonAria(label));
        for (const item of this._items()) {
            item.setAttribute('aria-checked', String(item.dataset.mode === mode));
        }
    }

    open() {
        if (!this.menu.hidden) return;
        this.menu.hidden = false;
        this.button.setAttribute('aria-expanded', 'true');
        const items = this._items();
        (items.find(i => i.getAttribute('aria-checked') === 'true') || items[0])?.focus();
    }

    /** @param {boolean} [returnFocus=true] - back to the button (not on Tab / outside click) */
    close(returnFocus = true) {
        if (this.menu.hidden) return;
        this.menu.hidden = true;
        this.button.setAttribute('aria-expanded', 'false');
        if (returnFocus) this.button.focus();
    }

    destroy() {
        this._listeners.forEach(([el, type, fn, capture]) => el.removeEventListener(type, fn, capture));
        this._listeners = [];
        if (this._restoreValue) this._restoreValue();
    }

    // ---- internals --------------------------------------------------------

    _icon(mode) {
        return createIconElement(this.getModeIcon(mode) || '', 'mode-picker-icon');
    }

    _items() {
        return [...this.menu.querySelectorAll('[role="menuitemradio"]')];
    }

    /** One item per <option>, so the select's option list stays authoritative. */
    _buildItems() {
        const items = [...this.select.options].map(option => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'quick-action-item mode-picker-item';
            item.setAttribute('role', 'menuitemradio');
            item.setAttribute('aria-checked', 'false');
            item.tabIndex = -1;
            item.dataset.mode = option.value;
            const title = this.getItemTitle?.(option.value);
            if (title) item.title = title;
            const text = document.createElement('span');
            text.className = 'quick-action-text';
            text.textContent = this.getModeLabel(option.value);
            const check = createIconElement('check', 'mode-picker-check');
            item.append(this._icon(option.value), text, check);
            return item;
        });
        this.menu.replaceChildren(...items);
    }

    _wrapValueSetter() {
        // The select's own prototype (HTMLSelectElement.prototype) owns `value`.
        const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.select), 'value');
        if (!proto?.set || Object.prototype.hasOwnProperty.call(this.select, 'value')) return;
        const picker = this;
        Object.defineProperty(this.select, 'value', {
            configurable: true,
            get() { return proto.get.call(this); },
            set(v) { proto.set.call(this, v); picker.sync(); }
        });
        this._restoreValue = () => { delete this.select.value; };
    }

    _choose(mode) {
        this.close();
        if (mode === this.select.value) return;
        this.select.value = mode;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    _on(el, type, fn, capture = false) {
        el.addEventListener(type, fn, capture);
        this._listeners.push([el, type, fn, capture]);
    }

    _wire() {
        // A selectOption()/user pick on the select itself (tests, assistive
        // tech that still reaches it) changes selectedIndex, not the setter.
        this._on(this.select, 'change', () => this.sync());

        this._on(this.button, 'click', () => (this.menu.hidden ? this.open() : this.close()));
        this._on(this.button, 'keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.open();
            }
        });

        this._on(this.menu, 'click', (e) => {
            const item = e.target.closest('[role="menuitemradio"]');
            if (item) this._choose(item.dataset.mode);
        });
        this._on(this.menu, 'keydown', (e) => {
            const items = this._items();
            const i = items.indexOf(document.activeElement);
            const move = (to) => { e.preventDefault(); items[(to + items.length) % items.length].focus(); };
            switch (e.key) {
                case 'ArrowDown': move(i + 1); break;
                case 'ArrowUp': move(i - 1); break;
                case 'Home': move(0); break;
                case 'End': move(items.length - 1); break;
                case 'Escape': e.preventDefault(); e.stopPropagation(); this.close(); break;
                case 'Tab': this.close(false); break;
                case 'Enter':
                case ' ':
                    if (i >= 0) { e.preventDefault(); this._choose(items[i].dataset.mode); }
                    break;
                default: break;
            }
        });

        // Outside press closes without stealing focus from whatever was pressed.
        this._on(document, 'pointerdown', (e) => {
            if (!this.menu.hidden && !this.menu.contains(e.target) && !this.button.contains(e.target)) {
                this.close(false);
            }
        }, true);
    }
}
