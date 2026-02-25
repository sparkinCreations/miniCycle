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
        this._progressRow = null;
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
     * Button is absolutely positioned inside #task-view so it never
     * affects layout flow of any child container.
     */
    _createButton() {
        const taskView = document.getElementById(DOM_IDS.TASK_VIEW);
        if (!taskView) {
            console.warn('FocusMode: task-view not found');
            return;
        }

        // Create focus button
        this._button = document.createElement('button');
        this._button.id = DOM_IDS.FOCUS_MODE_BTN;
        this._button.className = 'focus-mode-btn';
        this._button.title = getLabel('focusMode.enterTitle');
        this._button.setAttribute('aria-label', getLabel('focusMode.enterAria'));
        this._button.innerHTML = getIcon('expand');

        // Wrap progress bar and button in a flex row so they stay inline
        const progressContainer = taskView.querySelector('.progress-container');
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

        // Escape key exits focus mode (skip if a modal/dialog is open)
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this._active && !document.querySelector('dialog[open]')) {
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
     * Reparents button to document.body so position:fixed works
     * (escapes #task-view's transform containing block).
     */
    activate() {
        if (this._active) return;
        this._active = true;

        document.body.classList.add(DOM_CLASSES.FOCUS_MODE);

        if (this._button) {
            document.body.appendChild(this._button);
            this._button.innerHTML = getIcon('compress');
            this._button.title = getLabel('focusMode.exitTitle');
            this._button.setAttribute('aria-label', getLabel('focusMode.exitAria'));
        }

        this.deps.showNotification?.(getLabel('focusMode.activated'), 'info', 1500);
    }

    /**
     * Deactivate focus mode — animate out, then restore chrome.
     * Pins task-view height so the CSS transition can animate the collapse,
     * then reparents button back to #task-view after the animation.
     */
    deactivate() {
        if (!this._active) return;
        this._active = false;

        const taskView = document.getElementById(DOM_IDS.TASK_VIEW);

        // Pin current height so CSS can transition to the smaller max-height
        if (taskView) {
            taskView.style.height = `${taskView.offsetHeight}px`;
        }

        document.body.classList.remove(DOM_CLASSES.FOCUS_MODE);

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
        }, 400);

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
        this._progressRow = null;
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
