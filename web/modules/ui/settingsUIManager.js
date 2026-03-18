/**
 * Settings UI Manager (DI-Pure)
 * Handles settings menu UI and toggle controls including:
 * - Move arrows toggle
 * - Three-dots menu toggle
 * - Completed tasks dropdown toggle
 * - Debug mode toggle
 * - Reset recurring defaults
 *
 * NO window.* globals - all dependencies must be injected
 * NO legacy fallbacks - strict DI only
 *
 * @module ui/settingsUIManager
 * @see {@link file://../../../docs/developer-guides/DI_PATTERNS.md} - DI patterns
 */

/**
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { loadPanelVisibility } from './panelVisibilityHelpers.js';
import { handleVerticalArrowNav } from '../utils/keyboardNav.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('SettingsUIManager', {
    AppState: required(),
    loadMiniCycleData: required(),
    showNotification: required(),
    safeAddEventListener: required(),
    showConfirmationModal: optional(null),
    hideMainMenu: optional(null),
    setupDarkModeToggle: optional(null),
    setupQuickDarkToggle: optional(null),
    updateMoveArrowsVisibility: optional(null),
    toggleHoverTaskOptions: optional(null),
    refreshTaskListUI: optional(null),
    organizeCompletedTasks: optional(null),
    resetDefaultRecurringSettings: optional(null),
    updateStatsPanel: optional(null),
    enableDebug: optional(null),
    disableDebug: optional(null),
    isDebug: optional(null),
    getModal: optional(null),
    clearAllUndoHistory: optional(null),
    updateHelpWindow: optional(null),
    startGuidedTour: optional(null),
    trackAction: optional(null),
    showSettingsTourNotification: optional(null),
    hasActiveNotifications: optional(null)
});

/** @type {{AppState: Object, loadMiniCycleData: Function, showNotification: Function, safeAddEventListener: Function, hideMainMenu: Function|null, setupDarkModeToggle: Function|null, setupQuickDarkToggle: Function|null, updateMoveArrowsVisibility: Function|null, toggleHoverTaskOptions: Function|null, refreshTaskListUI: Function|null, organizeCompletedTasks: Function|null, resetDefaultRecurringSettings: Function|null, trackAction: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for settings UI manager
 * @param {Object} dependencies - Dependency configuration
 * @param {Object} dependencies.AppState - AppState instance (required)
 * @param {Function} dependencies.loadMiniCycleData - Data loader (required)
 * @param {Function} dependencies.showNotification - Notification function (required)
 * @param {Function} dependencies.safeAddEventListener - Event listener helper (required)
 * @param {Function} [dependencies.hideMainMenu] - Menu hide function
 * @param {Function} [dependencies.setupDarkModeToggle] - Dark mode setup
 * @param {Function} [dependencies.updateMoveArrowsVisibility] - Move arrows updater
 */
export function setSettingsUIManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Reset initialized state for testing
 * @private - Only for testing purposes
 */
export function _resetForTesting() {
    _initialized.settingsMenu = false;
    _initialized.moveArrowsToggle = false;
    _initialized.threeDotsToggle = false;
    _initialized.completedDropdownToggle = false;
    _initialized.helpWindowToggle = false;
    _initialized.quickActionsToggle = false;
    _initialized.debugToggle = false;
    _initialized.resetRecurringDefaults = false;
    _initialized.resetAchievementProgress = false;
    _initialized.clearUndoHistory = false;
    _initialized.retakeGuidedTourButton = false;
    _initialized.reducedMotionToggle = false;
    _initialized.highContrastToggle = false;
    _initialized.fontSizeSelect = false;
    _initialized.notificationsToggle = false;
}

// ============================================================================
// IDEMPOTENCY GUARDS
// ============================================================================

const _initialized = {
    settingsMenu: false,
    moveArrowsToggle: false,
    threeDotsToggle: false,
    completedDropdownToggle: false,
    helpWindowToggle: false,
    quickActionsToggle: false,
    debugToggle: false,
    resetRecurringDefaults: false,
    resetAchievementProgress: false,
    clearUndoHistory: false,
    retakeGuidedTourButton: false,
    reducedMotionToggle: false,
    highContrastToggle: false,
    fontSizeSelect: false,
    notificationsToggle: false,
};

function replaceStoredEventListener(element, event, key, handler, options) {
    if (!element) return;

    if (typeof element[key] === 'function') {
        element.removeEventListener(event, element[key], options);
    }

    element[key] = handler;
    element.addEventListener(event, handler, options);
}

// ============================================================================
// MENU MANAGEMENT
// ============================================================================

/**
 * Setup settings menu open/close functionality
 */
export function setupSettingsMenu() {
    // ✅ Idempotency guard
    if (_initialized.settingsMenu) {
        return;
    }

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const settingsModal = _deps.getModal?.('settings') || document.querySelector(DOM_SELECTORS.SETTINGS_MODAL);
    const openSettingsBtn = document.getElementById(DOM_IDS.OPEN_SETTINGS);
    const closeSettingsBtn = document.getElementById(DOM_IDS.CLOSE_SETTINGS);

    // Only lock setup after the live modal path exists so a later retry can recover.
    if (!settingsModal || !openSettingsBtn || !closeSettingsBtn) {
        console.warn('⚠️ Settings modal elements not found');
        return;
    }

    _initialized.settingsMenu = true;
    const isNativeDialog = typeof settingsModal.showModal === 'function';

    const openSettings = (event) => {
        event.stopPropagation();
        _deps.trackAction?.('settings');
        if (isNativeDialog && !settingsModal.open) {
            settingsModal._previousFocus = document.activeElement;
            settingsModal.showModal();
            // Show settings tour prompt after modal is open
            _deps.showSettingsTourNotification?.();
        } else if (!isNativeDialog) {
            settingsModal._previousFocus = document.activeElement;
            settingsModal.style.display = 'flex';
            settingsModal.classList.remove('hidden');
        }
        _deps.hideMainMenu?.();
    };

    const closeSettings = () => {
        if (isNativeDialog && settingsModal.open) {
            settingsModal.close();
            settingsModal._previousFocus?.focus({ focusVisible: false });
        } else if (!isNativeDialog) {
            settingsModal.style.display = 'none';
            settingsModal.classList.add('hidden');
            settingsModal._previousFocus?.focus({ focusVisible: false });
        }
    };

    if (openSettingsBtn) {
        replaceStoredEventListener(openSettingsBtn, "click", "__miniCycleSettingsOpenClickHandler", openSettings);
    }

    if (closeSettingsBtn) {
        replaceStoredEventListener(closeSettingsBtn, "click", "__miniCycleSettingsCloseClickHandler", closeSettings);
    }

    // Click outside to close — clicking ::backdrop fires click on dialog element
    // Guard: don't close if a tour notification is active inside the dialog
    replaceStoredEventListener(settingsModal, "click", "__miniCycleSettingsModalClickHandler", (event) => {
        if (event.target === settingsModal && !_deps.hasActiveNotifications?.()) {
            closeSettings();
        }
    });

    // Restore focus when dialog closes (including native ESC)
    replaceStoredEventListener(settingsModal, "close", "__miniCycleSettingsModalCloseHandler", () => {
        settingsModal._previousFocus?.focus({ focusVisible: false });
    });

    // Setup collapsible sections
    setupSettingsCollapsibleSections();

    // Keyboard: Enter toggles, Arrow Up/Down navigates between checkboxes
    settingsModal.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        replaceStoredEventListener(checkbox, 'keydown', '__miniCycleSettingsCheckboxKeydownHandler', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const visible = [...settingsModal.querySelectorAll('input[type="checkbox"]')]
                    .filter(cb => !cb.disabled && cb.offsetParent !== null);
                const idx = visible.indexOf(checkbox);
                if (idx === -1) return;
                const next = e.key === 'ArrowDown'
                    ? (idx + 1) % visible.length
                    : (idx - 1 + visible.length) % visible.length;
                visible[next].focus();
            }
        });
    });

    // Display version number
    updateVersionDisplay();
}

/**
 * Setup collapsible sections in settings modal
 */
function setupSettingsCollapsibleSections() {
    const sectionHeaders = document.querySelectorAll(DOM_SELECTORS.SETTINGS_SECTION_HEADER);

    // Cache collapsible sections once and reuse in load/save
    const collapsibleSections = document.querySelectorAll(DOM_SELECTORS.SETTINGS_SECTION_COLLAPSIBLE);

    // Load saved collapsed states using cached sections
    loadSettingsCollapsedStates(collapsibleSections);

    // Find the settings modal for delegated arrow nav
    const settingsModal = document.querySelector(DOM_SELECTORS.SETTINGS_MODAL);

    sectionHeaders.forEach(header => {
        replaceStoredEventListener(header, 'click', '__miniCycleSettingsSectionClickHandler', (e) => {
            e.stopPropagation();
            const section = header.closest('.settings-section');
            if (section) {
                section.classList.toggle('collapsed');
                header.setAttribute('aria-expanded', String(!section.classList.contains('collapsed')));
                saveSettingsCollapsedStates(collapsibleSections);
            }
        });

        replaceStoredEventListener(header, 'keydown', '__miniCycleSettingsSectionKeydownHandler', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const section = header.closest('.settings-section');
                if (section) {
                    section.classList.toggle('collapsed');
                    header.setAttribute('aria-expanded', String(!section.classList.contains('collapsed')));
                    saveSettingsCollapsedStates(collapsibleSections);
                }
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const section = header.closest('.settings-section');
                if (!section) return;
                const isCollapsed = section.classList.contains('collapsed');
                if (e.key === 'ArrowRight' && isCollapsed) {
                    e.preventDefault();
                    section.classList.remove('collapsed');
                    header.setAttribute('aria-expanded', 'true');
                    saveSettingsCollapsedStates(collapsibleSections);
                } else if (e.key === 'ArrowLeft' && !isCollapsed) {
                    e.preventDefault();
                    section.classList.add('collapsed');
                    header.setAttribute('aria-expanded', 'false');
                    saveSettingsCollapsedStates(collapsibleSections);
                }
            } else if (settingsModal && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                handleVerticalArrowNav(e, settingsModal, DOM_SELECTORS.SETTINGS_SECTION_HEADER, {
                    wrap: false, skipHidden: true
                });
            }
        });
    });
}

/**
 * Load collapsed states from AppState
 * @param {NodeList} [sections] - Cached collapsible section elements
 */
function loadSettingsCollapsedStates(sections) {
    const state = _deps.AppState?.get();
    const collapsedStates = state?.settings?.settingsCollapsedSections;

    if (!collapsedStates) return;

    const sectionElements = sections || document.querySelectorAll(DOM_SELECTORS.SETTINGS_SECTION_COLLAPSIBLE);
    sectionElements.forEach(section => {
        const sectionName = section.dataset.section;
        if (sectionName && collapsedStates[sectionName] !== undefined) {
            const isCollapsed = collapsedStates[sectionName];
            if (isCollapsed) {
                section.classList.add('collapsed');
            } else {
                section.classList.remove('collapsed');
            }
            // Sync aria-expanded on the header
            const sectionHeader = section.querySelector('.settings-section-header.collapsible');
            if (sectionHeader) {
                sectionHeader.setAttribute('aria-expanded', String(!isCollapsed));
            }
        }
    });
}

/**
 * Save collapsed states to AppState
 * @param {NodeList} [sections] - Cached collapsible section elements
 */
function saveSettingsCollapsedStates(sections) {
    const sectionElements = sections || document.querySelectorAll(DOM_SELECTORS.SETTINGS_SECTION_COLLAPSIBLE);
    const collapsedStates = {};

    sectionElements.forEach(section => {
        const sectionName = section.dataset.section;
        if (sectionName) {
            collapsedStates[sectionName] = section.classList.contains('collapsed');
        }
    });

    _deps.AppState?.update(state => {
        if (!state.settings) state.settings = {};
        state.settings.settingsCollapsedSections = collapsedStates;
    });
}

/**
 * Update the version display in settings
 * Uses globalThis.APP_VERSION from version.js (single source of truth)
 */
function updateVersionDisplay() {
    const versionDisplay = document.getElementById(DOM_IDS.SETTINGS_VERSION_DISPLAY);
    // Use globalThis.APP_VERSION directly (set by version.js, updated by update-version.sh)
    const version = globalThis.APP_VERSION;
    if (versionDisplay && version) {
        versionDisplay.textContent = `v${version}`;
    }
}

/**
 * Setup dark mode toggle
 */
export function setupDarkModeToggle() {
    _deps.setupDarkModeToggle?.("darkModeToggle", ["darkModeToggle", "darkModeToggleThemes"]);
    _deps.setupQuickDarkToggle?.();
}

/**
 * Setup move arrows toggle
 */
export function setupMoveArrowsToggle() {
    // ✅ Idempotency guard
    if (_initialized.moveArrowsToggle) {
        return;
    }
    _initialized.moveArrowsToggle = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const moveArrowsToggle = document.getElementById(DOM_IDS.TOGGLE_MOVE_ARROWS);
    if (!moveArrowsToggle) return;

    // Load current state
    let moveArrowsEnabled = false;
    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        const currentState = AppState.get();
        moveArrowsEnabled = currentState?.ui?.moveArrowsVisible || false;
    } else {
        const schemaData = _deps.loadMiniCycleData?.();
        moveArrowsEnabled = schemaData?.settings?.showMoveArrows || false;
    }

    moveArrowsToggle.checked = moveArrowsEnabled;

    moveArrowsToggle._changeHandler = async () => {
        const enabled = moveArrowsToggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.ui) state.ui = {};
                state.ui.moveArrowsVisible = enabled;
            }, true);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            moveArrowsToggle.checked = !enabled;
            return;
        }

        _deps.updateMoveArrowsVisibility?.();

        // Sync with customizer modal if open
        const customizerModal = document.getElementById(DOM_IDS.TASK_OPTIONS_CUSTOMIZER_MODAL);
        if (customizerModal) {
            const moveArrowsCheckbox = customizerModal.querySelector('[data-option="moveArrows"]');
            if (moveArrowsCheckbox) {
                moveArrowsCheckbox.checked = enabled;
            }
        }
    };

    safeAddEventListener(moveArrowsToggle, "change", moveArrowsToggle._changeHandler);
}

/**
 * Setup three-dots menu toggle
 */
export function setupThreeDotsToggle() {
    // ✅ Idempotency guard
    if (_initialized.threeDotsToggle) {
        return;
    }
    _initialized.threeDotsToggle = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const threeDotsToggle = document.getElementById(DOM_IDS.TOGGLE_THREE_DOTS);
    if (!threeDotsToggle) return;

    const schemaData = _deps.loadMiniCycleData?.();
    if (!schemaData) {
        console.error('Schema 2.5 data required for three dots toggle');
        return;
    }

    const threeDotsEnabled = schemaData.settings?.showThreeDots || false;
    threeDotsToggle.checked = threeDotsEnabled;
    document.body.classList.toggle("show-three-dots-enabled", threeDotsEnabled);

    threeDotsToggle._changeHandler = async () => {
        const enabled = threeDotsToggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.showThreeDots = enabled;
            }, true);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            threeDotsToggle.checked = !enabled;
            return;
        }

        document.body.classList.toggle("show-three-dots-enabled", enabled);
        _deps.toggleHoverTaskOptions?.(!enabled);
        _deps.refreshTaskListUI?.();

        // Show tip when disabling on touch devices
        if (!enabled && ('ontouchstart' in window)) {
            setTimeout(() => {
                _deps.showNotification?.('💡 ' + getLabel('notify.threeDotsDisabledTip'), 'info', UI_TIMEOUTS.NOTIFICATION_EXTENDED);
            }, 300);
        }
    };

    safeAddEventListener(threeDotsToggle, "change", threeDotsToggle._changeHandler);
}

/**
 * Setup completed dropdown toggle
 */
export function setupCompletedDropdownToggle() {
    // ✅ Idempotency guard
    if (_initialized.completedDropdownToggle) {
        return;
    }
    _initialized.completedDropdownToggle = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const completedDropdownToggle = document.getElementById(DOM_IDS.TOGGLE_COMPLETED_DROPDOWN);
    if (!completedDropdownToggle) return;

    let completedDropdownEnabled = false;
    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        const currentState = AppState.get();
        completedDropdownEnabled = currentState?.settings?.showCompletedDropdown || false;
    }

    completedDropdownToggle.checked = completedDropdownEnabled;

    completedDropdownToggle._changeHandler = async () => {
        const enabled = completedDropdownToggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.showCompletedDropdown = enabled;
            }, true);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            completedDropdownToggle.checked = !enabled;
            return;
        }

        if (enabled) {
            _deps.organizeCompletedTasks?.();
        } else {
            // Move completed tasks back to main list
            const completedList = document.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            if (completedList && taskList) {
                const completedTasks = Array.from(completedList.querySelectorAll(DOM_SELECTORS.TASK));
                completedTasks.forEach(task => {
                    taskList.appendChild(task);
                });
                const completedSection = document.getElementById(DOM_IDS.COMPLETED_TASKS_SECTION);
                if (completedSection) {
                    completedSection.classList.remove('show');
                }
            }
        }
    };

    safeAddEventListener(completedDropdownToggle, "change", completedDropdownToggle._changeHandler);
}

/**
 * Setup help window visibility toggle (syncs with personalization modal toggle)
 */
export function setupHelpWindowToggle() {
    if (_initialized.helpWindowToggle) {
        return;
    }
    _initialized.helpWindowToggle = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) return;

    const toggle = document.getElementById(DOM_IDS.SETTINGS_TOGGLE_HELP_WINDOW);
    if (!toggle) return;

    // Load current state
    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        const currentState = AppState.get();
        loadPanelVisibility(currentState?.settings?.customColors);
    }

    toggle._changeHandler = async () => {
        const visible = toggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                if (!state.settings.customColors) state.settings.customColors = {};
                state.settings.customColors.showHelpWindow = visible;
            }, true);
        } else {
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            toggle.checked = !visible;
            return;
        }

        document.body.classList.toggle('hide-help-window', !visible);

        // Sync personalization modal toggle
        const prefToggle = document.getElementById(DOM_IDS.TOGGLE_HELP_WINDOW);
        if (prefToggle) prefToggle.checked = visible;
    };

    safeAddEventListener(toggle, "change", toggle._changeHandler);
}

/**
 * Setup quick actions visibility toggle (syncs with personalization modal toggle)
 */
export function setupQuickActionsToggle() {
    if (_initialized.quickActionsToggle) {
        return;
    }
    _initialized.quickActionsToggle = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) return;

    const toggle = document.getElementById(DOM_IDS.SETTINGS_TOGGLE_QUICK_ACTIONS);
    if (!toggle) return;

    // Load current state
    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        const currentState = AppState.get();
        loadPanelVisibility(currentState?.settings?.customColors);
    }

    toggle._changeHandler = async () => {
        const visible = toggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                if (!state.settings.customColors) state.settings.customColors = {};
                state.settings.customColors.showQuickActions = visible;
            }, true);
        } else {
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            toggle.checked = !visible;
            return;
        }

        document.body.classList.toggle('hide-quick-actions', !visible);

        // Sync personalization modal toggle
        const prefToggle = document.getElementById(DOM_IDS.TOGGLE_QUICK_ACTIONS);
        if (prefToggle) prefToggle.checked = visible;
    };

    safeAddEventListener(toggle, "change", toggle._changeHandler);
}

/**
 * Setup scroll to new task toggle
 */
export function setupScrollToNewTaskToggle() {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const scrollToggle = document.getElementById(DOM_IDS.TOGGLE_SCROLL_TO_NEW_TASK);
    if (!scrollToggle) return;

    // Default to true (enabled) if not set
    let scrollEnabled = true;
    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        const currentState = AppState.get();
        // Use nullish coalescing - default to true if undefined
        scrollEnabled = currentState?.settings?.scrollToNewTask ?? true;
    }

    scrollToggle.checked = scrollEnabled;

    scrollToggle._changeHandler = async () => {
        const enabled = scrollToggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.scrollToNewTask = enabled;
            }, true);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            scrollToggle.checked = !enabled;
            return;
        }
    };

    safeAddEventListener(scrollToggle, "change", scrollToggle._changeHandler);
}

/**
 * Setup scroll on load toggle
 */
export function setupScrollOnLoadToggle() {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const scrollToggle = document.getElementById(DOM_IDS.TOGGLE_SCROLL_ON_LOAD);
    if (!scrollToggle) return;

    // Default to false (disabled for performance)
    let scrollEnabled = false;
    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        const currentState = AppState.get();
        scrollEnabled = currentState?.settings?.scrollOnLoad || false;
    }

    scrollToggle.checked = scrollEnabled;

    scrollToggle._changeHandler = async () => {
        const enabled = scrollToggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.scrollOnLoad = enabled;
            }, true);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            scrollToggle.checked = !enabled;
            return;
        }
    };

    safeAddEventListener(scrollToggle, "change", scrollToggle._changeHandler);
}

/**
 * Setup debug mode toggle
 */
export function setupDebugModeToggle() {
    // ✅ Idempotency guard
    if (_initialized.debugToggle) {
        return;
    }
    _initialized.debugToggle = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const debugModeToggle = document.getElementById(DOM_IDS.TOGGLE_DEBUG_MODE);
    if (!debugModeToggle) return;

    const debugEnabled = _deps.isDebug?.() ?? false;
    debugModeToggle.checked = debugEnabled;

    debugModeToggle._changeHandler = () => {
        const enabled = debugModeToggle.checked;

        if (enabled) {
            _deps.enableDebug?.();
            _deps.showNotification?.(getLabel('notify.debugEnabled'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
        } else {
            _deps.disableDebug?.();
            _deps.showNotification?.(getLabel('notify.debugDisabled'), 'info', UI_TIMEOUTS.NOTIFICATION_LONG);
        }
    };

    safeAddEventListener(debugModeToggle, "change", debugModeToggle._changeHandler);
}

/**
 * Setup reset recurring defaults button
 */
export function setupResetRecurringButton() {
    // ✅ Idempotency guard
    if (_initialized.resetRecurringDefaults) {
        return;
    }
    _initialized.resetRecurringDefaults = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const resetRecurringBtn = document.getElementById(DOM_IDS.RESET_RECURRING_DEFAULT);
    if (!resetRecurringBtn) return;

    resetRecurringBtn._clickHandler = async () => {

        const defaultSettings = {
            frequency: "daily",
            indefinitely: true,
            time: null
        };

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.defaultRecurringSettings = defaultSettings;
            }, true);
            _deps.showNotification?.(getLabel('notify.recurringDefaultReset'), "success");
        } else {
            console.error('AppState not ready - settings not saved');
            _deps.showNotification?.(getLabel('notify.resetDefaultsFailed'), "error");
        }
    };

    safeAddEventListener(resetRecurringBtn, "click", resetRecurringBtn._clickHandler);
}

/**
 * Setup Reset Achievement Progress button
 * Resets global achievement progress (cycles, cleared tasks, milestones)
 * but keeps individual routine stats intact
 */
export function setupResetAchievementProgressButton() {
    // ✅ Idempotency guard
    if (_initialized.resetAchievementProgress) {
        return;
    }
    _initialized.resetAchievementProgress = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const resetBtn = document.getElementById(DOM_IDS.RESET_ACHIEVEMENT_PROGRESS);
    if (!resetBtn) return;

    resetBtn._clickHandler = async () => {
        const showConfirmationModal = _deps.showConfirmationModal;

        // Use confirmation modal if available, otherwise use browser confirm
        const doReset = async () => {

            const AppState = _deps.AppState?.();
            if (AppState?.isReady?.()) {
                await AppState.update(state => {
                    // Reset global achievement tracking
                    if (state.userProgress) {
                        state.userProgress.cyclesCompleted = 0;
                        state.userProgress.totalTasksCompleted = 0;
                        // Reset milestone unlocks
                        if (state.userProgress.rewardMilestones) {
                            state.userProgress.rewardMilestones = [];
                        }
                    }

                    // Reset unlocked achievements (re-lock all badges)
                    if (state.achievements) {
                        state.achievements.unlocked = [];
                        state.achievements.seen = {};
                    }
                }, true);

                // Refresh stats panel to reflect changes
                _deps.updateStatsPanel?.();

                _deps.showNotification?.(getLabel('notify.achievementReset'), "success");
            } else {
                console.error('AppState not ready - achievement reset failed');
                _deps.showNotification?.(getLabel('notify.achievementResetFailed'), "error");
            }
        };

        if (showConfirmationModal) {
            showConfirmationModal({
                title: getLabel('modal.resetAchievementsTitle'),
                message: getLabel('modal.resetAchievementsMessage'),
                confirmText: getLabel('modal.resetAchievementsConfirm'),
                cancelText: getLabel('button.cancel'),
                callback: async (confirmed) => {
                    if (confirmed) {
                        await doReset();
                    } else {
                        _deps.showNotification?.(getLabel('notify.achievementResetCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
                    }
                }
            });
        } else {
            // Fallback to browser confirm
            const confirmed = confirm(getLabel('modal.resetAchievementsMessage'));
            if (confirmed) {
                await doReset();
            }
        }
    };

    safeAddEventListener(resetBtn, "click", resetBtn._clickHandler);
}

/**
 * Setup Clear Undo History button
 * Clears in-memory stacks, localStorage cache, and IndexedDB undo data for all routines
 */
export function setupClearUndoHistoryButton() {
    if (_initialized.clearUndoHistory) {
        return;
    }
    _initialized.clearUndoHistory = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const btn = document.getElementById(DOM_IDS.CLEAR_UNDO_HISTORY);
    if (!btn) return;

    btn._clickHandler = async () => {
        const showConfirmationModal = _deps.showConfirmationModal;

        const doClear = async () => {
            await _deps.clearAllUndoHistory?.();
            // Zero stored undo sizes on all routines so switcher shows correct data
            const AppState = _deps.AppState?.();
            if (AppState?.isReady?.()) {
                AppState.update(state => {
                    Object.values(state.data?.cycles ?? {}).forEach(cycle => {
                        cycle.undoSizeBytes = 0;
                    });
                }, false);
            }
            _deps.updateHelpWindow?.();
            _deps.showNotification?.(getLabel('notify.undoHistoryCleared'), 'success');
        };

        if (showConfirmationModal) {
            showConfirmationModal({
                title: getLabel('modal.clearUndoHistoryTitle'),
                message: getLabel('modal.clearUndoHistoryMessage'),
                confirmText: getLabel('modal.clearUndoHistoryConfirm'),
                cancelText: getLabel('button.cancel'),
                callback: async (confirmed) => {
                    if (confirmed) await doClear();
                }
            });
        } else {
            if (confirm(getLabel('modal.clearUndoHistoryMessage'))) await doClear();
        }
    };

    safeAddEventListener(btn, 'click', btn._clickHandler);
}

export function setupRetakeGuidedTourButton() {
    if (_initialized.retakeGuidedTourButton) {
        return;
    }
    _initialized.retakeGuidedTourButton = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const btn = document.getElementById(DOM_IDS.RETAKE_GUIDED_TOUR);
    if (!btn) return;

    btn._clickHandler = async () => {
        const appState = _deps.AppState?.();
        if (!appState?.isReady?.()) {
            _deps.showNotification?.(getLabel('notify.appStateNotReady'), 'error');
            return;
        }

        await appState.update((state) => {
            if (!state.settings) state.settings = {};
            state.settings.guidedTourStep = null;
            state.settings.statsTourStep = null;
            state.settings.prefsTourStep = null;
            state.settings.taskOptionsTourStep = null;
            state.settings.remindersTourStep = null;
            state.settings.menuTourStep = null;
            state.settings.settingsTourStep = null;
            state.settings.routineSwitcherTourStep = null;
            state.settings.recurringListTourStep = null;
            state.settings.recurringSettingsTourStep = null;
        }, true);

        document.getElementById(DOM_IDS.CLOSE_SETTINGS)?.click();
        _deps.startGuidedTour?.();
    };

    safeAddEventListener(btn, 'click', btn._clickHandler);
}

/**
 * Sync current settings to storage
 */
export async function syncCurrentSettingsToStorage() {

    const schemaData = _deps.loadMiniCycleData?.();

    if (!schemaData) {
        console.error('Schema 2.5 data required for syncCurrentSettingsToStorage');
        return;
    }

    const { cycles, activeCycle } = schemaData;
    const toggleAutoReset = document.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
    const deleteCheckedTasks = document.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);

    if (!activeCycle || !cycles[activeCycle]) {
        console.warn('No active cycle found for settings sync');
        return;
    }

    if (!toggleAutoReset || !deleteCheckedTasks) {
        console.warn('Settings toggles not found');
        return;
    }

    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        await AppState.update(state => {
            const cycle = state?.data?.cycles?.[activeCycle];
            if (cycle) {
                cycle.autoReset = toggleAutoReset.checked;
                cycle.deleteCheckedTasks = deleteCheckedTasks.checked;
            }
        }, true);
    } else {
        console.error('AppState not ready - settings not synced');
    }
}

/**
 * Font size label map for notification messages
 */
const FONT_SIZE_LABELS = {
    '14': 'settings.fontSizeSmall',
    '16': 'settings.fontSizeDefault',
    '18': 'settings.fontSizeLarge',
    '20': 'settings.fontSizeExtraLarge',
};

/**
 * Setup reduced motion toggle
 * Manual override for CSS animations/transitions.
 * Stacks with OS prefers-reduced-motion preference.
 */
export function setupReducedMotionToggle() {
    // ✅ Idempotency guard
    if (_initialized.reducedMotionToggle) {
        return;
    }
    _initialized.reducedMotionToggle = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const toggle = document.getElementById(DOM_IDS.TOGGLE_REDUCED_MOTION);
    if (!toggle) return;

    const schemaData = _deps.loadMiniCycleData?.();
    const enabled = schemaData?.settings?.reducedMotion || false;
    toggle.checked = enabled;
    document.body.classList.toggle(DOM_CLASSES.REDUCED_MOTION, enabled);
    document.documentElement.classList.toggle(DOM_CLASSES.REDUCED_MOTION, enabled);

    toggle._changeHandler = async () => {
        const enabled = toggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.reducedMotion = enabled;
            }, true);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            toggle.checked = !enabled;
            return;
        }

        document.body.classList.toggle(DOM_CLASSES.REDUCED_MOTION, enabled);
        document.documentElement.classList.toggle(DOM_CLASSES.REDUCED_MOTION, enabled);

        _deps.showNotification?.(
            enabled ? getLabel('notify.reducedMotionEnabled') : getLabel('notify.reducedMotionDisabled'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_SHORT
        );
    };

    safeAddEventListener(toggle, "change", toggle._changeHandler);
}

/**
 * Setup high contrast mode toggle
 * Adds body.high-contrast class for enhanced visual contrast.
 */
export function setupHighContrastToggle() {
    // ✅ Idempotency guard
    if (_initialized.highContrastToggle) {
        return;
    }
    _initialized.highContrastToggle = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const toggle = document.getElementById(DOM_IDS.TOGGLE_HIGH_CONTRAST);
    if (!toggle) return;

    const schemaData = _deps.loadMiniCycleData?.();
    const enabled = schemaData?.settings?.highContrast || false;
    toggle.checked = enabled;
    document.body.classList.toggle(DOM_CLASSES.HIGH_CONTRAST, enabled);

    toggle._changeHandler = async () => {
        const enabled = toggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.highContrast = enabled;
            }, true);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            toggle.checked = !enabled;
            return;
        }

        document.body.classList.toggle(DOM_CLASSES.HIGH_CONTRAST, enabled);

        _deps.showNotification?.(
            enabled ? getLabel('notify.highContrastEnabled') : getLabel('notify.highContrastDisabled'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_SHORT
        );
    };

    safeAddEventListener(toggle, "change", toggle._changeHandler);
}

/**
 * Setup font size select control
 * Sets --font-size-base CSS custom property on :root.
 */
export function setupFontSizeSelect() {
    // ✅ Idempotency guard
    if (_initialized.fontSizeSelect) {
        return;
    }
    _initialized.fontSizeSelect = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const select = document.getElementById(DOM_IDS.FONT_SIZE_SELECT);
    if (!select) return;

    const schemaData = _deps.loadMiniCycleData?.();
    const savedSize = schemaData?.settings?.fontSize || '16';
    select.value = savedSize;
    if (savedSize !== '16') {
        document.documentElement.style.setProperty('--font-size-base', `${savedSize}px`);
    }

    select._changeHandler = async () => {
        const size = select.value;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.fontSize = size;
            }, true);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            select.value = '16';
            return;
        }

        document.documentElement.style.setProperty('--font-size-base', `${size}px`);

        const labelKey = FONT_SIZE_LABELS[size] || 'settings.fontSizeDefault';
        _deps.showNotification?.(
            getLabel('notify.fontSizeChanged', { vars: { size: getLabel(labelKey) } }),
            'info',
            UI_TIMEOUTS.NOTIFICATION_SHORT
        );
    };

    safeAddEventListener(select, "change", select._changeHandler);
}

/**
 * Initialize all settings UI components
 */
/**
 * Setup notifications toggle
 * When disabled, showNotification() silently skips all notifications.
 */
export function setupNotificationsToggle() {
    if (_initialized.notificationsToggle) return;
    _initialized.notificationsToggle = true;

    const toggle = document.getElementById(DOM_IDS.TOGGLE_NOTIFICATIONS);
    if (!toggle) return;

    const schemaData = _deps.loadMiniCycleData?.();
    // Default true — notifications on unless user has explicitly disabled
    const enabled = schemaData?.settings?.notificationsEnabled ?? true;
    toggle.checked = enabled;

    toggle._changeHandler = async () => {
        const enabled = toggle.checked;

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.notificationsEnabled = enabled;
            }, true);
        } else {
            _deps.showNotification?.(getLabel('notify.settingSaveFailed'), 'error');
            toggle.checked = !enabled;
            return;
        }

        // Always show this one confirmation regardless of new state
        _deps.showNotification?.(
            enabled ? getLabel('notify.notificationsEnabled') : getLabel('notify.notificationsDisabled'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_SHORT
        );
    };

    _deps.safeAddEventListener(toggle, 'change', toggle._changeHandler);
}

/**
 * Apply saved priority colors on startup.
 * 1. Sets --priority-color on :root (global default for tasks without a specific color).
 * 2. Scans all rendered high-priority task elements and sets --task-priority-color
 *    per-element from the task's own saved priorityColor, so each task remembers
 *    its individual color across reloads.
 */
export function applyPriorityColor() {
    const schemaData = _deps.loadMiniCycleData?.();
    if (!schemaData) return;

    // 1. Global default
    const globalColor = schemaData.settings?.priorityColor;
    if (globalColor) {
        document.documentElement.style.setProperty('--priority-color', globalColor);
    }

    // 2. Per-task colors — scan tasks that have their own saved color
    const activeCycle = schemaData.activeCycle;
    const tasks = schemaData.cycles?.[activeCycle]?.tasks || [];
    tasks.forEach(task => {
        if (task.highPriority && task.priorityColor) {
            const el = document.querySelector(`[data-task-id="${task.id}"]`);
            if (el) el.style.setProperty('--task-priority-color', task.priorityColor);
        }
    });
}

export function initAllToggles() {
    setupSettingsMenu();
    setupDarkModeToggle();
    setupMoveArrowsToggle();
    setupThreeDotsToggle();
    setupCompletedDropdownToggle();
    setupHelpWindowToggle();
    setupQuickActionsToggle();
    setupScrollToNewTaskToggle();
    setupScrollOnLoadToggle();
    setupDebugModeToggle();
    setupResetRecurringButton();
    setupResetAchievementProgressButton();
    setupClearUndoHistoryButton();
    setupRetakeGuidedTourButton();
    setupReducedMotionToggle();
    setupHighContrastToggle();
    setupFontSizeSelect();
    setupNotificationsToggle();
    applyPriorityColor();
}
