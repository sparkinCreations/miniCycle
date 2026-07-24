/**
 * Focus Mode Module (DI-Pure)
 *
 * Provides a distraction-free view by hiding UI chrome (header, footer,
 * navigation, help window) while keeping the task list and progress bar.
 *
 * State is persisted to AppState (state.settings.focusModeActive) so
 * focus mode survives page reloads.
 *
 * Pattern: Simple Instance
 * - Single responsibility (focus mode toggle)
 * - Optional dependencies via diBase.js
 *
 * @module ui/focusMode
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_CLASSES, DOM_SELECTORS, UI_TIMEOUTS, EVENTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { getIcon } from '../utils/icons.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('FocusMode', {
    showNotification: optional(null),
    safeAddEventListener: optional(null),
    AppState: optional(null),
    clearAllTasks: optional(null),
    deleteAllTasks: optional(null),
    switchMiniCycle: optional(null),
    createNewMiniCycle: optional(null),
    // Focus task panel (deferred module): loaded on focus-mode entry;
    // showTaskView returns the carousel to Routine when exiting while
    // the Task panel is active (FOCUS_TASK_VIEW_PLAN D7)
    ensureModuleLoaded: optional(null),
    showTaskView: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    getBody: optional(() => document.body),
});

/**
 * Set dependencies for FocusMode (call before initFocusMode)
 * @param {Object} dependencies
 * @returns {void}
 */
export function setFocusModeDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// FOCUS MODE CLASS
// ============================================================================

let focusModeInstance = null;

/**
 * Implements focus mode, which hides UI chrome (header, footer,
 * navigation, help window) to reduce visual clutter while keeping
 * the task list and progress bar visible.
 */
export class FocusMode {
    constructor() {
        this._active = false;
        this._button = null;
        this._progressRow = null;
        this._clickHandler = null;
        this._keyHandler = null;
        this._undoRedoOriginalParent = null;
        this._undoRedoNextSibling = null;
        this._navDotsOriginalParent = null;
        this._navDotsNextSibling = null;
        this._menuBtn = null;
        this._menu = null;
        this._menuOpen = false;
        this._menuBtnHandler = null;
        this._exitBtn = null;
        this._exitBtnHandler = null;
        this._menuClickHandler = null;
        this._menuOutsideClickHandler = null;
        this._modeItem = null;
        this._modeModal = null;
        this._modeBackdrop = null;
        this._modeModalOpen = false;
        this._modeRadioHandler = null;
        this._modeBackdropHandler = null;
        this._modeDoneHandler = null;
        this._modeTrapHandler = null;
        this._modeFocusReturnTarget = null;
        this._emptyStateHint = null;
        this.initialized = false;
    }

    get deps() {
        return di.resolve();
    }

    /**
     * Initialize focus mode — create button and attach listeners.
     */
    init() {
        if (this.initialized) return;

        this._createButton();
        this._createMenu();
        this._createExitButton();
        this._injectEmptyStateHint();
        this._attachListeners();
        this.initialized = true;

        // Restore persisted focus mode state
        const state = this.deps.AppState?.get?.();
        if (state?.settings?.focusModeActive) {
            this.activate(true);
        }
    }

    /**
     * Create the focus mode toggle button and insert it into the DOM.
     * Button is absolutely positioned inside #task-view so it never
     * affects layout flow of any child container.
     */
    _createButton() {
        const taskView = this.deps.getElementById(DOM_IDS.TASK_VIEW);
        if (!taskView) {
            console.warn('FocusMode: task-view not found');
            return;
        }

        // Create focus button
        this._button = document.createElement('button');
        this._button.id = DOM_IDS.FOCUS_MODE_BTN;
        this._button.className = DOM_CLASSES.FOCUS_MODE_BTN;
        this._button.title = getLabel('focusMode.enterTitle');
        this._button.setAttribute('aria-label', getLabel('focusMode.enterAria'));
        this._button.innerHTML = getIcon('expand');

        // Wrap progress bar and button in a flex row so they stay inline
        const progressContainer = taskView.querySelector(DOM_SELECTORS.PROGRESS_CONTAINER);
        if (progressContainer) {
            this._progressRow = document.createElement('div');
            this._progressRow.className = 'progress-focus-row';
            progressContainer.parentNode.insertBefore(this._progressRow, progressContainer);
            this._progressRow.appendChild(progressContainer);
            this._progressRow.appendChild(this._button);
        } else {
            taskView.appendChild(this._button);
        }
    }

    /**
     * Create the three-dots menu button + dropdown menu.
     * Both elements are appended directly to <body> and hidden by default;
     * CSS scoped to body.focus-mode reveals them only when focus mode is active.
     */
    _createMenu() {
        const body = this.deps.getBody();
        if (!body) return;

        // Three-dots trigger button
        this._menuBtn = document.createElement('button');
        this._menuBtn.id = DOM_IDS.FOCUS_MODE_MENU_BTN;
        this._menuBtn.className = DOM_CLASSES.FOCUS_MODE_MENU_BTN;
        this._menuBtn.title = getLabel('focusMode.menuTitle');
        this._menuBtn.setAttribute('aria-label', getLabel('focusMode.menuAria'));
        this._menuBtn.setAttribute('aria-haspopup', 'menu');
        this._menuBtn.setAttribute('aria-expanded', 'false');
        this._menuBtn.setAttribute('aria-controls', DOM_IDS.FOCUS_MODE_MENU);
        this._menuBtn.textContent = '⋯'; // horizontal ellipsis (meatball menu — global/overflow actions)
        body.appendChild(this._menuBtn);

        // Dropdown menu
        this._menu = document.createElement('div');
        this._menu.id = DOM_IDS.FOCUS_MODE_MENU;
        this._menu.className = DOM_CLASSES.FOCUS_MODE_MENU;
        this._menu.setAttribute('role', 'menu');
        this._menu.setAttribute('aria-labelledby', DOM_IDS.FOCUS_MODE_MENU_BTN);
        this._menu.hidden = true;

        // Items grouped semantically. A horizontal separator is inserted
        // wherever the `group` value changes between consecutive items.
        // Groups: 'routine' (mode + routine management), 'view' (UI toggles),
        // 'bulk' (task data ops), 'exit' (dismiss).
        const items = [
            { action: 'switch-mode',     group: 'routine', label: '' /* set dynamically in _refreshModeItemLabel */ },
            { action: 'switch-routines', group: 'routine', label: getLabel('focusMode.switchRoutines') },
            { action: 'create-routine',  group: 'routine', label: getLabel('focusMode.createRoutine') },
            { action: 'toggle-input-bar', group: 'view',    label: getLabel('focusMode.toggleInputBar') },
            { action: 'toggle-dark-mode', group: 'view',    label: getLabel('focusMode.toggleDarkMode') },
            { action: 'uncheck-all',     group: 'bulk',    label: getLabel('focusMode.uncheckAll') },
            { action: 'delete-all',      group: 'bulk',    label: getLabel('focusMode.deleteAll'), destructive: true },
            { action: 'exit',            group: 'exit',    label: getLabel('focusMode.exitItem') },
        ];

        let prevGroup = null;
        for (const { action, group, label, destructive } of items) {
            if (prevGroup !== null && prevGroup !== group) {
                const sep = document.createElement('div');
                sep.className = DOM_CLASSES.FOCUS_MODE_MENU_SEPARATOR;
                sep.setAttribute('role', 'separator');
                this._menu.appendChild(sep);
            }
            prevGroup = group;

            const item = document.createElement('button');
            item.type = 'button';
            item.className = DOM_CLASSES.FOCUS_MODE_MENU_ITEM;
            if (destructive) {
                item.classList.add(DOM_CLASSES.FOCUS_MODE_MENU_ITEM_DESTRUCTIVE);
            }
            item.setAttribute('role', 'menuitem');
            item.dataset.action = action;
            item.textContent = label;
            if (action === 'switch-mode') {
                item.id = DOM_IDS.FOCUS_MODE_MODE_ITEM;
                this._modeItem = item;
            }
            this._menu.appendChild(item);
        }

        body.appendChild(this._menu);

        // Build the mode-switch modal (hidden until opened)
        this._createModeModal();
    }

    /**
     * Create the exit button — top-left counterpart to the three-dots menu.
     * Same styling, single-tap exits focus mode (no menu open required).
     * Appended to <body>, hidden by default; CSS scoped to body.focus-mode
     * reveals it only when focus mode is active.
     */
    _createExitButton() {
        const body = this.deps.getBody();
        if (!body) return;

        this._exitBtn = document.createElement('button');
        this._exitBtn.id = DOM_IDS.FOCUS_MODE_EXIT_BTN;
        this._exitBtn.className = DOM_CLASSES.FOCUS_MODE_EXIT_BTN;
        this._exitBtn.title = getLabel('focusMode.exitTitle');
        this._exitBtn.setAttribute('aria-label', getLabel('focusMode.exitAria'));
        this._exitBtn.textContent = '×'; // multiplication sign — close affordance
        body.appendChild(this._exitBtn);
    }

    /**
     * Inject a focus-mode-specific hint into the task list's #empty-state.
     * Sits alongside the normal `.empty-state-hint`; CSS scoped to
     * body.focus-mode swaps which one is visible. This avoids racing
     * routineManager (which rewrites the normal hint on cycle creation).
     */
    _injectEmptyStateHint() {
        const emptyState = this.deps.getElementById(DOM_IDS.EMPTY_STATE);
        if (!emptyState) {
            console.warn('FocusMode: empty-state not found');
            return;
        }
        // Don't double-inject if init() somehow runs twice
        if (emptyState.querySelector(`.${DOM_CLASSES.EMPTY_STATE_HINT_FOCUS}`)) return;

        this._emptyStateHint = document.createElement('div');
        this._emptyStateHint.className = DOM_CLASSES.EMPTY_STATE_HINT_FOCUS;
        // Cross-reference focusMode.toggleInputBar so the hint stays in sync
        // if that label is renamed or themed; menu glyph passed as a var so
        // we don't bake visual decoration into translatable text.
        this._emptyStateHint.textContent = getLabel('empty.noTasksHintFocus', {
            vars: {
                menuIcon: '⋯',
                showHide: getLabel('focusMode.toggleInputBar')
            }
        });
        emptyState.appendChild(this._emptyStateHint);
    }

    /**
     * Build the mode-switch modal — backdrop + dialog with three radios.
     * The dialog is keyboard accessible (Escape, Tab, Enter on radio).
     * Switching is immediate on radio change; "Done" closes the modal.
     */
    _createModeModal() {
        const body = this.deps.getBody();
        if (!body) return;

        // Backdrop sits behind the dialog and absorbs outside clicks
        this._modeBackdrop = document.createElement('div');
        this._modeBackdrop.id = DOM_IDS.FOCUS_MODE_MODE_MODAL_BACKDROP;
        this._modeBackdrop.className = DOM_CLASSES.FOCUS_MODE_MODE_MODAL_BACKDROP;
        this._modeBackdrop.hidden = true;
        body.appendChild(this._modeBackdrop);

        // Dialog
        const titleId = `${DOM_IDS.FOCUS_MODE_MODE_MODAL}-title`;
        this._modeModal = document.createElement('div');
        this._modeModal.id = DOM_IDS.FOCUS_MODE_MODE_MODAL;
        this._modeModal.className = DOM_CLASSES.FOCUS_MODE_MODE_MODAL;
        this._modeModal.setAttribute('role', 'dialog');
        this._modeModal.setAttribute('aria-modal', 'true');
        this._modeModal.setAttribute('aria-labelledby', titleId);
        this._modeModal.hidden = true;

        const heading = document.createElement('h2');
        heading.id = titleId;
        heading.className = DOM_CLASSES.FOCUS_MODE_MODE_MODAL_TITLE;
        heading.textContent = getLabel('focusMode.modeModalTitle');
        this._modeModal.appendChild(heading);

        const modeOptions = [
            { value: 'auto-cycle',   nameKey: 'focusMode.modeAutoName',   descKey: 'help.modeAutoShort' },
            { value: 'manual-cycle', nameKey: 'focusMode.modeManualName', descKey: 'help.modeManualShort' },
            { value: 'todo-mode',    nameKey: 'focusMode.modeTodoName',   descKey: 'help.modeTodoShort' },
        ];

        const radioName = 'focus-mode-mode-radio';
        for (const { value, nameKey, descKey } of modeOptions) {
            const optionLabel = document.createElement('label');
            optionLabel.className = DOM_CLASSES.FOCUS_MODE_MODE_OPTION;

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = radioName;
            radio.value = value;

            const text = document.createElement('div');
            text.className = DOM_CLASSES.FOCUS_MODE_MODE_OPTION_TEXT;

            const name = document.createElement('div');
            name.className = DOM_CLASSES.FOCUS_MODE_MODE_OPTION_NAME;
            name.textContent = getLabel(nameKey);

            const desc = document.createElement('div');
            desc.className = DOM_CLASSES.FOCUS_MODE_MODE_OPTION_DESC;
            desc.textContent = getLabel(descKey);

            text.appendChild(name);
            text.appendChild(desc);

            optionLabel.appendChild(radio);
            optionLabel.appendChild(text);
            this._modeModal.appendChild(optionLabel);
        }

        const doneBtn = document.createElement('button');
        doneBtn.type = 'button';
        doneBtn.id = DOM_IDS.FOCUS_MODE_MODE_DONE_BTN;
        doneBtn.className = DOM_CLASSES.FOCUS_MODE_MODE_DONE_BTN;
        doneBtn.textContent = getLabel('focusMode.modeModalDone');
        this._modeModal.appendChild(doneBtn);

        body.appendChild(this._modeModal);
    }

    /**
     * Attach click and keyboard listeners.
     */
    _attachListeners() {
        if (!this._button) return;

        this._clickHandler = () => {
            // Outside focus mode: toggle to enter focus mode (original behavior)
            if (!this._active) {
                this.toggle();
                return;
            }
            // In focus mode: this button is repurposed as the mode action
            // (Cycle in manual, Clear in to-do). Auto-cycle hides the button
            // entirely via CSS, so this branch shouldn't run there.
            const mode = this._getCurrentMode();
            if (mode === 'auto-cycle') return;
            const completeAllBtn = this.deps.getElementById(DOM_IDS.COMPLETE_ALL);
            completeAllBtn?.click();
        };

        const { safeAddEventListener } = this.deps;
        if (safeAddEventListener) {
            safeAddEventListener(this._button, 'click', this._clickHandler);
        } else {
            this._button.addEventListener('click', this._clickHandler);
        }

        // Three-dots menu button toggles the dropdown
        if (this._menuBtn) {
            this._menuBtnHandler = (e) => {
                e.stopPropagation();
                this._toggleMenu();
            };
            this._menuBtn.addEventListener('click', this._menuBtnHandler);
        }

        // Exit button (top-left) — single-tap exit
        if (this._exitBtn) {
            this._exitBtnHandler = (e) => {
                e.stopPropagation();
                this.deactivate();
            };
            this._exitBtn.addEventListener('click', this._exitBtnHandler);
        }

        // Click on a menu item dispatches the action
        if (this._menu) {
            this._menuClickHandler = (e) => {
                const item = e.target.closest(DOM_SELECTORS.FOCUS_MODE_MENU_ITEM);
                if (!item) return;
                e.stopPropagation();
                this._handleMenuAction(item.dataset.action);
            };
            this._menu.addEventListener('click', this._menuClickHandler);
        }

        // Click outside the menu closes it
        this._menuOutsideClickHandler = (e) => {
            if (!this._menuOpen) return;
            if (this._menu?.contains(e.target)) return;
            if (this._menuBtn?.contains(e.target)) return;
            this._closeMenu();
        };
        document.addEventListener('click', this._menuOutsideClickHandler);

        // Mode modal: radio change → apply mode immediately
        if (this._modeModal) {
            this._modeRadioHandler = (e) => {
                const radio = e.target.closest(DOM_SELECTORS.FOCUS_MODE_MODE_RADIO);
                if (!radio || !radio.checked) return;
                this._applyMode(radio.value);
            };
            this._modeModal.addEventListener('change', this._modeRadioHandler);

            // Done button closes the modal
            this._modeDoneHandler = () => this._closeModeModal();
            const doneBtn = this.deps.getElementById(DOM_IDS.FOCUS_MODE_MODE_DONE_BTN);
            doneBtn?.addEventListener('click', this._modeDoneHandler);
        }

        // Backdrop click closes modal
        if (this._modeBackdrop) {
            this._modeBackdropHandler = () => this._closeModeModal();
            this._modeBackdrop.addEventListener('click', this._modeBackdropHandler);
        }

        // Escape priority: mode modal → menu → exit focus mode
        this._keyHandler = (e) => {
            if (e.key !== 'Escape') return;
            if (this._modeModalOpen) {
                this._closeModeModal();
                return;
            }
            if (this._menuOpen) {
                this._closeMenu(true); // restore focus to the trigger button
                return;
            }
            if (this._active && !this.deps.querySelector('dialog[open]')) {
                this.deactivate();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    /**
     * Read the active routine's mode from AppState.
     * @returns {'auto-cycle'|'manual-cycle'|'todo-mode'}
     */
    _getCurrentMode() {
        const state = this.deps.AppState?.get?.();
        const cycle = state?.data?.cycles?.[state?.appState?.activeCycleId];
        if (cycle?.deleteCheckedTasks) return 'todo-mode';
        if (cycle?.autoReset) return 'auto-cycle';
        return 'manual-cycle';
    }

    /**
     * Map a mode key to its short display name.
     * @param {string} mode
     * @returns {string}
     */
    _getModeShortName(mode) {
        switch (mode) {
            case 'auto-cycle':   return getLabel('focusMode.modeAutoName');
            case 'manual-cycle': return getLabel('focusMode.modeManualName');
            case 'todo-mode':    return getLabel('focusMode.modeTodoName');
            default:             return getLabel('focusMode.modeManualName');
        }
    }

    /**
     * Refresh the "Mode: <name> ▸" menu item label to match the current mode.
     */
    _refreshModeItemLabel() {
        if (!this._modeItem) return;
        const mode = this._getCurrentMode();
        const prefix = getLabel('focusMode.modeItemPrefix');
        // The "▸" arrow is rendered separately via the ::after pseudo
        // so it can be sized independently of the label text.
        this._modeItem.textContent = `${prefix}: ${this._getModeShortName(mode)}`;
    }

    /**
     * Toggle the three-dots menu open/closed.
     */
    _toggleMenu() {
        if (this._menuOpen) {
            this._closeMenu();
        } else {
            this._openMenu();
        }
    }

    /**
     * Open the three-dots menu.
     */
    _openMenu() {
        if (!this._menu || !this._menuBtn || this._menuOpen) return;
        // Refresh the mode label so it reflects current state every time
        this._refreshModeItemLabel();
        this._menu.hidden = false;
        this._menuBtn.setAttribute('aria-expanded', 'true');
        this._menuOpen = true;
        this.deps.getBody?.()?.classList.add(DOM_CLASSES.FOCUS_MODE_MENU_OPEN);
        // Move focus to first item for keyboard users
        const firstItem = this._menu.querySelector(DOM_SELECTORS.FOCUS_MODE_MENU_ITEM);
        firstItem?.focus();
    }

    /**
     * Open the mode-switch modal. Pre-checks the radio for the current mode
     * and moves focus to the dialog for keyboard users.
     */
    _openModeModal() {
        if (!this._modeModal || !this._modeBackdrop || this._modeModalOpen) return;

        const currentMode = this._getCurrentMode();
        const radios = this._modeModal.querySelectorAll(DOM_SELECTORS.FOCUS_MODE_MODE_RADIO);
        radios.forEach(r => { r.checked = (r.value === currentMode); });

        this._modeFocusReturnTarget = this.deps.getActiveElement?.() || this._menuBtn;

        this._modeBackdrop.hidden = false;
        this._modeModal.hidden = false;
        this._modeModalOpen = true;

        // Focus the checked radio so keyboard users land on the current selection
        const checked = this._modeModal.querySelector(`${DOM_SELECTORS.FOCUS_MODE_MODE_RADIO}:checked`);
        (checked || radios[0])?.focus();

        // Focus trap: keep Tab within the modal
        this._modeTrapHandler = (e) => {
            if (e.key !== 'Tab' || !this._modeModalOpen || !this._modeModal) return;
            const focusables = this._getModeModalFocusables();
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = this.deps.getActiveElement?.();
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', this._modeTrapHandler);
    }

    /**
     * Close the mode-switch modal and restore focus to wherever it was before.
     */
    _closeModeModal() {
        if (!this._modeModal || !this._modeBackdrop || !this._modeModalOpen) return;
        this._modeModal.hidden = true;
        this._modeBackdrop.hidden = true;
        this._modeModalOpen = false;

        // Tear down the focus trap
        if (this._modeTrapHandler) {
            document.removeEventListener('keydown', this._modeTrapHandler);
            this._modeTrapHandler = null;
        }

        // Restore focus
        this._modeFocusReturnTarget?.focus?.();
        this._modeFocusReturnTarget = null;
    }

    /**
     * Get focusable elements inside the mode modal in tab order.
     * @returns {HTMLElement[]}
     */
    _getModeModalFocusables() {
        if (!this._modeModal) return [];
        // Radios + Done button — the only interactive elements in the dialog
        return Array.from(this._modeModal.querySelectorAll(
            `${DOM_SELECTORS.FOCUS_MODE_MODE_RADIO}, #${DOM_IDS.FOCUS_MODE_MODE_DONE_BTN}`
        )).filter(el => !el.disabled && !el.hidden);
    }

    /**
     * Apply a new mode by driving the existing #mode-selector dropdown.
     * Dispatching a synthetic 'change' event runs the existing change handler
     * (toggle checkboxes, AppState update, UI refresh, notification) so we
     * don't duplicate any mode-switch logic.
     * @param {'auto-cycle'|'manual-cycle'|'todo-mode'} newMode
     */
    _applyMode(newMode) {
        const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
        if (!modeSelector) return;
        if (modeSelector.value === newMode) return;
        modeSelector.value = newMode;
        modeSelector.dispatchEvent(new Event('change', { bubbles: true }));
        // Refresh action button. Pass newMode explicitly because
        // modeManager's change handler is async (awaits syncTogglesFromMode
        // → syncModeFromToggles before the body class flips), so reading
        // the body class here would return the previous mode and the
        // visible label (data-label) would lag the emoji by one step.
        this._updateActionButtonAria(newMode);
    }

    /**
     * Public refresh hook — called by themeManager.refreshThemeLabels()
     * when vocab theme changes so the action button picks up new
     * cycleActionLabel / clearActionLabel values without waiting for the
     * next mode toggle. No-op when focus mode isn't active.
     */
    refreshActionButton() {
        this._updateActionButtonAria();
    }

    /**
     * Sync the bottom-right .focus-mode-btn's title + aria-label to its
     * current behavior. Outside focus mode it's the "enter focus mode"
     * trigger; inside focus mode it's the mode action (Cycle in manual,
     * Clear in to-do, hidden in auto-cycle). The visible label below the
     * circle comes from data-label (set here, rendered by CSS attr()),
     * keeping the text on the label/vocab-theme system.
     */
    _updateActionButtonAria(modeOverride) {
        if (!this._button) return;
        if (!this._active) {
            this._button.title = getLabel('focusMode.enterTitle');
            this._button.setAttribute('aria-label', getLabel('focusMode.enterAria'));
            this._button.removeAttribute('data-label');
            return;
        }
        // The visible label below the circle is rendered via CSS
        // `content: attr(data-label)` so vocab themes can override the
        // value through getLabel() (e.g., Fitness theme could rename
        // 'Cycle' to 'Workout'). Title/aria-label come from getLabel() too.
        //
        // Mode resolution:
        // - When called from _applyMode after a user mode-switch, the
        //   caller passes modeOverride because the body class hasn't
        //   flipped yet (modeManager's change handler is async).
        // - All other callers (activate, refreshActionButton on theme
        //   change) leave it undefined; we read the body class instead,
        //   which is the same source the CSS pseudo-elements key off so
        //   emoji + label stay perfectly in sync.
        let mode = modeOverride;
        if (!mode) {
            const body = this.deps.getBody?.();
            const hasTodo = body?.classList.contains(DOM_CLASSES.TODO_MODE_MODE);
            const hasAuto = body?.classList.contains(DOM_CLASSES.AUTO_CYCLE_MODE);
            const hasManual = body?.classList.contains(DOM_CLASSES.MANUAL_CYCLE_MODE);
            if (hasTodo) {
                mode = 'todo-mode';
            } else if (hasAuto) {
                mode = 'auto-cycle';
            } else if (hasManual) {
                mode = 'manual-cycle';
            } else {
                // Boot-time race: focusMode.activate() (restoring saved state)
                // can run before modeManager.syncModeFromToggles() applies the
                // body class. Reading the body would silently fall through to
                // 'manual-cycle' and label the button "Cycle" even in to-do
                // mode. Fall back to AppState — the persisted source of truth.
                const state = this.deps.AppState?.get?.();
                const cycleId = state?.appState?.activeCycleId;
                const cycle = cycleId ? state?.data?.cycles?.[cycleId] : null;
                if (cycle?.deleteCheckedTasks) {
                    mode = 'todo-mode';
                } else if (cycle?.autoReset) {
                    mode = 'auto-cycle';
                } else {
                    mode = 'manual-cycle';
                }
            }
        }
        if (mode === 'todo-mode') {
            this._button.title = getLabel('focusMode.clearActionTitle');
            this._button.setAttribute('aria-label', getLabel('focusMode.clearActionAria'));
            this._button.setAttribute('data-label', getLabel('focusMode.clearActionLabel'));
        } else if (mode === 'manual-cycle') {
            this._button.title = getLabel('focusMode.cycleActionTitle');
            this._button.setAttribute('aria-label', getLabel('focusMode.cycleActionAria'));
            this._button.setAttribute('data-label', getLabel('focusMode.cycleActionLabel'));
        }
        // auto-cycle: button is hidden via CSS; leave the labels as-is
        // (they'd never be announced because the button has display: none).
    }

    /**
     * Close the three-dots menu.
     * @param {boolean} [restoreFocus=false] - If true, return focus to the
     *   trigger button. Set when closing via keyboard (Escape) so focus
     *   doesn't get stranded on a hidden menu item.
     */
    _closeMenu(restoreFocus = false) {
        if (!this._menu || !this._menuBtn || !this._menuOpen) return;
        this._menu.hidden = true;
        this._menuBtn.setAttribute('aria-expanded', 'false');
        this._menuOpen = false;
        this.deps.getBody?.()?.classList.remove(DOM_CLASSES.FOCUS_MODE_MENU_OPEN);
        if (restoreFocus) {
            this._menuBtn.focus();
        }
    }

    /**
     * Run the action associated with a menu item, then close the menu.
     * @param {'switch-mode'|'switch-routines'|'create-routine'|'toggle-input-bar'|'toggle-dark-mode'|'uncheck-all'|'delete-all'|'exit'} action
     */
    _handleMenuAction(action) {
        this._closeMenu();

        switch (action) {
            case 'switch-mode':
                this._openModeModal();
                break;
            case 'switch-routines':
                this.deps.switchMiniCycle?.();
                break;
            case 'create-routine':
                this.deps.createNewMiniCycle?.();
                break;
            case 'toggle-input-bar': {
                // Trigger the existing toggle button — same pattern as
                // quickActionsManager (avoids duplicating the toggle logic).
                const btn = this.deps.getElementById(DOM_IDS.TOGGLE_TASK_INPUT_BTN);
                btn?.click();
                break;
            }
            case 'toggle-dark-mode': {
                // Click the existing #quick-dark-toggle button — same pattern
                // as quickActionsManager. The button is `inert` while focus
                // mode is active (it lives in hidden chrome) but programmatic
                // .click() bypasses inert so the toggle still fires.
                const btn = this.deps.getElementById(DOM_IDS.QUICK_DARK_TOGGLE);
                btn?.click();
                break;
            }
            case 'uncheck-all':
                this.deps.clearAllTasks?.();
                break;
            case 'delete-all':
                // Wired to menuManager.deleteAllTasks which shows a confirmation modal
                this.deps.deleteAllTasks?.();
                break;
            case 'exit':
                this.deactivate();
                break;
        }
    }

    /**
     * Toggle focus mode on/off.
     */
    toggle() {
        if (this._active) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    /**
     * Collect the chrome elements that are visually hidden in focus mode.
     * Returned elements get `inert` toggled so keyboard / screen-reader
     * users don't tab into invisible chrome.
     * @returns {HTMLElement[]}
     */
    _getInertChromeElements() {
        const { getElementById, querySelector } = this.deps;
        const elements = [
            querySelector(`.${DOM_CLASSES.FIXED_HEADER_CONTAINER}`),
            getElementById(DOM_IDS.SLIDE_LEFT),
            getElementById(DOM_IDS.SLIDE_RIGHT),
            getElementById(DOM_IDS.QUICK_ACTIONS_WINDOW),
            getElementById(DOM_IDS.FOOTER_CONTAINER),
            getElementById(DOM_IDS.PERSONALIZATION_BTN),
            getElementById(DOM_IDS.QUICK_DARK_TOGGLE),
        ];
        return elements.filter(Boolean);
    }

    /**
     * Activate focus mode — hide chrome.
     * Reparents button to document.body so position:fixed works
     * (escapes #task-view's transform containing block).
     */
    activate(silent = false) {
        if (this._active) return;
        this._active = true;

        const body = this.deps.getBody();
        body.classList.add(DOM_CLASSES.FOCUS_MODE);

        // Load the deferred focus task panel so the Task tab is functional by
        // the time the user swipes to it. Fire-and-forget: the carousel's
        // isEnabled gate governs reachability, and module init is idempotent —
        // a slow load just means the card renders when the promise resolves.
        // An `undefined` result means the loader wiring is dead (truthy-closure
        // trap) — warn loudly instead of leaving an empty skeleton card.
        const panelLoad = this.deps.ensureModuleLoaded?.('focusTaskPanel');
        if (panelLoad === undefined) {
            console.warn('⚠️ FocusMode: ensureModuleLoaded unavailable — focus task panel will not render');
        } else {
            panelLoad.catch?.(e => console.warn('⚠️ FocusMode: focusTaskPanel load failed:', e));
        }

        if (this._button) {
            body.appendChild(this._button);
            this._button.innerHTML = getIcon('compress');
            // Aria/title now reflect the mode-action role (Cycle/Clear)
            // since exit is owned by the top-left #focus-mode-exit-btn.
            this._updateActionButtonAria();
        }

        // Lift undo/redo buttons out of the hidden footer so they remain
        // usable in focus mode. Cache origin so deactivate() can restore.
        const undoRedo = this.deps.getElementById(DOM_IDS.UNDO_REDO_BUTTONS);
        if (undoRedo && undoRedo.parentNode !== body) {
            this._undoRedoOriginalParent = undoRedo.parentNode;
            this._undoRedoNextSibling = undoRedo.nextSibling;
            body.appendChild(undoRedo);
        }

        // Lift nav-dots out of the hidden footer too — in focus mode it's
        // restyled as a minimal "Routine | Stats" text switcher (CSS only).
        const navDots = this.deps.getElementById(DOM_IDS.NAV_DOTS);
        if (navDots && navDots.parentNode !== body) {
            this._navDotsOriginalParent = navDots.parentNode;
            this._navDotsNextSibling = navDots.nextSibling;
            body.appendChild(navDots);
        }

        // Make hidden chrome inert — removes it from the tab order and the
        // accessibility tree so keyboard / screen-reader users don't land on
        // invisible buttons. Done after undo-redo reparent so the footer's
        // inert state doesn't affect them.
        for (const el of this._getInertChromeElements()) {
            el.inert = true;
        }

        this.deps.AppState?.update?.(state => {
            state.settings.focusModeActive = true;
        });

        if (!silent) {
            this.deps.showNotification?.(getLabel('focusMode.activated'), 'info', UI_TIMEOUTS.NOTIFICATION_BRIEF);
        }

        document.dispatchEvent(new CustomEvent(EVENTS.FOCUS_MODE_ACTIVATED));
    }

    /**
     * Deactivate focus mode — animate out, then restore chrome.
     * Pins task-view height so the CSS transition can animate the collapse,
     * then reparents button back to #task-view after the animation.
     */
    deactivate() {
        if (!this._active) return;
        this._active = false;
        // If the three-dots menu was open when focus mode was toggled off,
        // clear the body-class flag so the backdrop blur doesn't linger.
        this.deps.getBody?.()?.classList.remove(DOM_CLASSES.FOCUS_MODE_MENU_OPEN);

        // D7: the Task panel only exists inside focus view — if it's the
        // active carousel panel, return to Routine before restoring chrome
        // (goTo('task-view') is always allowed regardless of gates).
        const focusTaskPanel = this.deps.getElementById(DOM_IDS.FOCUS_TASK_PANEL);
        if (focusTaskPanel?.classList.contains(DOM_CLASSES.SHOW)) {
            this.deps.showTaskView?.();
        }

        const taskView = this.deps.getElementById(DOM_IDS.TASK_VIEW);

        // Pin current height so CSS can transition to the smaller max-height
        if (taskView) {
            taskView.style.height = `${taskView.offsetHeight}px`;
        }

        // Restore chrome to the tab order / accessibility tree.
        for (const el of this._getInertChromeElements()) {
            el.inert = false;
        }

        this.deps.getBody().classList.remove(DOM_CLASSES.FOCUS_MODE);

        // After a frame, remove the pinned height so it collapses with transition
        if (taskView) {
            requestAnimationFrame(() => {
                taskView.style.height = '';
            });
        }

        if (this._button) {
            this._button.innerHTML = getIcon('expand');
            this._button.title = getLabel('focusMode.enterTitle');
            this._button.setAttribute('aria-label', getLabel('focusMode.enterAria'));
        }

        // Reparent button back to progress row after animation completes
        setTimeout(() => {
            if (this._button && this._progressRow) {
                this._progressRow.appendChild(this._button);
            } else if (this._button && taskView) {
                taskView.appendChild(this._button);
            }

            // Restore undo/redo buttons to their original footer location
            const undoRedo = this.deps.getElementById(DOM_IDS.UNDO_REDO_BUTTONS);
            if (undoRedo && this._undoRedoOriginalParent) {
                if (this._undoRedoNextSibling && this._undoRedoNextSibling.parentNode === this._undoRedoOriginalParent) {
                    this._undoRedoOriginalParent.insertBefore(undoRedo, this._undoRedoNextSibling);
                } else {
                    this._undoRedoOriginalParent.appendChild(undoRedo);
                }
                this._undoRedoOriginalParent = null;
                this._undoRedoNextSibling = null;
            }

            // Restore nav-dots to its original footer location
            const navDots = this.deps.getElementById(DOM_IDS.NAV_DOTS);
            if (navDots && this._navDotsOriginalParent) {
                if (this._navDotsNextSibling && this._navDotsNextSibling.parentNode === this._navDotsOriginalParent) {
                    this._navDotsOriginalParent.insertBefore(navDots, this._navDotsNextSibling);
                } else {
                    this._navDotsOriginalParent.appendChild(navDots);
                }
                this._navDotsOriginalParent = null;
                this._navDotsNextSibling = null;
            }
        }, 400);

        const settings = this.deps.AppState?.get?.()?.settings;
        const onboardingCompleted = !!settings?.onboardingCompleted;
        // Is this the first-run "graduation" exit? Two first-run shapes reach it:
        //   • learn  → onboardingCompleted is still false until this exit
        //   • create/sample → onboardingCompleted was marked true upfront, but
        //     startFocusViewForNewRoutine set firstRunFocusExitPending at landing
        // Either way the onboarding manager owns the first-exit prompt (merged
        // Home View welcome or the tour prompt), so the generic "Back in Home
        // View" toast would just be redundant noise on that one exit.
        const firstRunFocusExit = !onboardingCompleted || !!settings?.firstRunFocusExitPending;

        this.deps.AppState?.update?.(state => {
            state.settings.focusModeActive = false;
            // One-shot: consume the flag so normal, later exits still toast.
            if (state.settings.firstRunFocusExitPending) {
                state.settings.firstRunFocusExitPending = false;
            }
        });

        if (!firstRunFocusExit) {
            this.deps.showNotification?.(getLabel('focusMode.deactivated'), 'info', UI_TIMEOUTS.NOTIFICATION_BRIEF);
        }

        document.dispatchEvent(new CustomEvent(EVENTS.FOCUS_MODE_DEACTIVATED));
    }

    /**
     * Check if focus mode is currently active.
     * @returns {boolean}
     */
    isActive() {
        return this._active;
    }

    /**
     * Clean up all event listeners.
     */
    destroy() {
        if (this._button && this._clickHandler) {
            this._button.removeEventListener('click', this._clickHandler);
        }
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        if (this._menuBtn && this._menuBtnHandler) {
            this._menuBtn.removeEventListener('click', this._menuBtnHandler);
        }
        if (this._exitBtn && this._exitBtnHandler) {
            this._exitBtn.removeEventListener('click', this._exitBtnHandler);
        }
        if (this._menu && this._menuClickHandler) {
            this._menu.removeEventListener('click', this._menuClickHandler);
        }
        if (this._menuOutsideClickHandler) {
            document.removeEventListener('click', this._menuOutsideClickHandler);
        }
        if (this._modeModal && this._modeRadioHandler) {
            this._modeModal.removeEventListener('change', this._modeRadioHandler);
        }
        if (this._modeBackdrop && this._modeBackdropHandler) {
            this._modeBackdrop.removeEventListener('click', this._modeBackdropHandler);
        }
        if (this._modeDoneHandler) {
            const doneBtn = this.deps.getElementById(DOM_IDS.FOCUS_MODE_MODE_DONE_BTN);
            doneBtn?.removeEventListener('click', this._modeDoneHandler);
        }
        if (this._modeTrapHandler) {
            document.removeEventListener('keydown', this._modeTrapHandler);
        }
        // Remove the menu + modal DOM nodes (they were appended to <body>)
        this._menuBtn?.remove();
        this._menu?.remove();
        this._exitBtn?.remove();
        this._modeModal?.remove();
        this._modeBackdrop?.remove();
        this._emptyStateHint?.remove();

        // Restore undo/redo buttons synchronously so they don't get stranded
        // on <body> if destroy() runs while focus mode is active (boot retry).
        const undoRedo = this.deps.getElementById(DOM_IDS.UNDO_REDO_BUTTONS);
        if (undoRedo && this._undoRedoOriginalParent) {
            if (this._undoRedoNextSibling && this._undoRedoNextSibling.parentNode === this._undoRedoOriginalParent) {
                this._undoRedoOriginalParent.insertBefore(undoRedo, this._undoRedoNextSibling);
            } else {
                this._undoRedoOriginalParent.appendChild(undoRedo);
            }
        }
        const navDots = this.deps.getElementById(DOM_IDS.NAV_DOTS);
        if (navDots && this._navDotsOriginalParent) {
            if (this._navDotsNextSibling && this._navDotsNextSibling.parentNode === this._navDotsOriginalParent) {
                this._navDotsOriginalParent.insertBefore(navDots, this._navDotsNextSibling);
            } else {
                this._navDotsOriginalParent.appendChild(navDots);
            }
        }

        // Clear inert from chrome so a subsequent reinit doesn't start with
        // half the UI unreachable.
        for (const el of this._getInertChromeElements()) {
            el.inert = false;
        }

        this._clickHandler = null;
        this._keyHandler = null;
        this._button = null;
        this._progressRow = null;
        this._undoRedoOriginalParent = null;
        this._undoRedoNextSibling = null;
        this._navDotsOriginalParent = null;
        this._navDotsNextSibling = null;
        this._menuBtn = null;
        this._menu = null;
        this._menuOpen = false;
        this._menuBtnHandler = null;
        this._exitBtn = null;
        this._exitBtnHandler = null;
        this._menuClickHandler = null;
        this._menuOutsideClickHandler = null;
        this._modeItem = null;
        this._modeModal = null;
        this._modeBackdrop = null;
        this._modeModalOpen = false;
        this._modeRadioHandler = null;
        this._modeBackdropHandler = null;
        this._modeDoneHandler = null;
        this._modeTrapHandler = null;
        this._modeFocusReturnTarget = null;
        this._emptyStateHint = null;
        this._active = false;
        this.initialized = false;
        this.deps.getBody().classList.remove(DOM_CLASSES.FOCUS_MODE);

        this.deps.AppState?.update?.(state => {
            state.settings.focusModeActive = false;
        });
    }
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

/**
 * Initialize the FocusMode module.
 * @returns {FocusMode} The initialized instance
 */
export function initFocusMode() {
    if (focusModeInstance) {
        return focusModeInstance;
    }

    focusModeInstance = new FocusMode();
    focusModeInstance.init();
    return focusModeInstance;
}

/**
 * Get the current FocusMode instance.
 * @returns {FocusMode|null}
 */
export function getFocusMode() {
    return focusModeInstance;
}
