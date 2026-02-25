/**
 * Focus Mode Module (DI-Pure)
 *
 * Provides a distraction-free view by hiding UI chrome (header, footer,
 * navigation, help window) while keeping the task list and progress bar.
 *
 * State is transient — in-memory boolean, resets on page reload.
 * Not persisted to AppState.
 *
 * Pattern: Simple Instance
 * - Single responsibility (focus mode toggle)
 * - Optional dependencies via diBase.js
 *
 * @module ui/focusMode
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_CLASSES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { getIcon } from '../utils/icons.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('FocusMode', {
    showNotification: optional(null),
    safeAddEventListener: optional(null),
});

/**
 * Set dependencies for FocusMode (call before initFocusMode)
 * @param {Object} dependencies
 */
export function setFocusModeDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// FOCUS MODE CLASS
// ============================================================================

let focusModeInstance = null;

export class FocusMode {
    constructor() {
        this._active = false;
        this._button = null;
        this._clickHandler = null;
        this._keyHandler = null;
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
        this._attachListeners();
        this.initialized = true;
    }

    /**
     * Create the focus mode toggle button and insert it into the DOM.
     */
    _createButton() {
        const container = document.getElementById(DOM_IDS.COMPLETE_ALL_CONTAINER);
        if (!container) {
            console.warn('FocusMode: container not found');
            return;
        }

        const completeBtn = document.getElementById(DOM_IDS.COMPLETE_ALL);

        // Create focus button
        this._button = document.createElement('button');
        this._button.id = DOM_IDS.FOCUS_MODE_BTN;
        this._button.className = 'focus-mode-btn';
        this._button.title = getLabel('focusMode.enterTitle');
        this._button.setAttribute('aria-label', getLabel('focusMode.enterAria'));
        this._button.innerHTML = getIcon('crosshair');

        // Wrap Complete button and Focus button in a row div
        if (completeBtn && completeBtn.parentNode === container) {
            const row = document.createElement('div');
            row.className = 'complete-row';
            container.insertBefore(row, completeBtn);
            row.appendChild(completeBtn);
            row.appendChild(this._button);
        } else {
            // Auto-cycle mode or no complete button: focus button alone
            container.appendChild(this._button);
        }
    }

    /**
     * Attach click and keyboard listeners.
     */
    _attachListeners() {
        if (!this._button) return;

        this._clickHandler = () => this.toggle();

        const { safeAddEventListener } = this.deps;
        if (safeAddEventListener) {
            safeAddEventListener(this._button, 'click', this._clickHandler);
        } else {
            this._button.addEventListener('click', this._clickHandler);
        }

        // Escape key exits focus mode
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this._active) {
                this.deactivate();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
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
     * Activate focus mode — hide chrome.
     */
    activate() {
        if (this._active) return;
        this._active = true;

        document.body.classList.add(DOM_CLASSES.FOCUS_MODE);

        if (this._button) {
            this._button.innerHTML = getIcon('expand');
            this._button.title = getLabel('focusMode.exitTitle');
            this._button.setAttribute('aria-label', getLabel('focusMode.exitAria'));
        }

        this.deps.showNotification?.(getLabel('focusMode.activated'), 'info', 1500);
    }

    /**
     * Deactivate focus mode — restore chrome.
     */
    deactivate() {
        if (!this._active) return;
        this._active = false;

        document.body.classList.remove(DOM_CLASSES.FOCUS_MODE);

        if (this._button) {
            this._button.innerHTML = getIcon('crosshair');
            this._button.title = getLabel('focusMode.enterTitle');
            this._button.setAttribute('aria-label', getLabel('focusMode.enterAria'));
        }

        this.deps.showNotification?.(getLabel('focusMode.deactivated'), 'info', 1500);
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
        this._clickHandler = null;
        this._keyHandler = null;
        this._button = null;
        this._active = false;
        this.initialized = false;
        document.body.classList.remove(DOM_CLASSES.FOCUS_MODE);
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
