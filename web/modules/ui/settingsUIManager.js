/**
 * Settings UI Manager (DI-Pure)
 * Handles settings menu UI and toggle controls
 *
 * NO window.* globals - all dependencies must be injected
 * NO legacy fallbacks - strict DI only
 *
 * @module ui/settingsUIManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { enableDebug, disableDebug, isDebug } from '../utils/debugMode.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('SettingsUIManager', {
    AppState: required(),
    loadMiniCycleData: required(),
    showNotification: required(),
    safeAddEventListener: required(),
    hideMainMenu: optional(null),
    setupDarkModeToggle: optional(null),
    setupQuickDarkToggle: optional(null),
    updateMoveArrowsVisibility: optional(null),
    toggleHoverTaskOptions: optional(null),
    refreshTaskListUI: optional(null),
    organizeCompletedTasks: optional(null),
    resetDefaultRecurringSettings: optional(null)
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setSettingsUIManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// MENU MANAGEMENT
// ============================================================================

/**
 * Setup settings menu open/close functionality
 */
export function setupSettingsMenu() {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const settingsModal = document.querySelector(".settings-modal");
    const settingsModalContent = document.querySelector(".settings-modal-content");
    const openSettingsBtn = document.getElementById("open-settings");
    const closeSettingsBtn = document.getElementById("close-settings");

    const openSettings = (event) => {
        event.stopPropagation();
        if (settingsModal) {
            settingsModal.style.display = "flex";
        }
        _deps.hideMainMenu?.();
    };

    const closeSettings = () => {
        if (settingsModal) {
            settingsModal.style.display = "none";
        }
    };

    const closeOnClickOutside = (event) => {
        if (settingsModal && settingsModal.style.display === "flex" &&
            settingsModalContent && !settingsModalContent.contains(event.target) &&
            event.target !== openSettingsBtn) {
            settingsModal.style.display = "none";
        }
    };

    if (openSettingsBtn) {
        safeAddEventListener(openSettingsBtn, "click", openSettings);
    }

    if (closeSettingsBtn) {
        safeAddEventListener(closeSettingsBtn, "click", closeSettings);
    }

    safeAddEventListener(document, "click", closeOnClickOutside);
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
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const moveArrowsToggle = document.getElementById("toggle-move-arrows");
    if (!moveArrowsToggle) return;

    console.log('Setting up move arrows toggle...');

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
        console.log('Move arrows toggle changed:', enabled);

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.ui) state.ui = {};
                state.ui.moveArrowsVisible = enabled;
            }, true);
            console.log('Move arrows setting saved to state:', enabled);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.('Failed to save setting', 'error');
            moveArrowsToggle.checked = !enabled;
            return;
        }

        _deps.updateMoveArrowsVisibility?.();

        // Sync with customizer modal if open
        const customizerModal = document.getElementById('task-options-customizer-modal');
        if (customizerModal) {
            const moveArrowsCheckbox = customizerModal.querySelector('[data-option="moveArrows"]');
            if (moveArrowsCheckbox) {
                moveArrowsCheckbox.checked = enabled;
            }
        }
    };

    safeAddEventListener(moveArrowsToggle, "change", moveArrowsToggle._changeHandler);
    console.log('Move arrows toggle setup completed');
}

/**
 * Setup three-dots menu toggle
 */
export function setupThreeDotsToggle() {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const threeDotsToggle = document.getElementById("toggle-three-dots");
    if (!threeDotsToggle) return;

    console.log('Setting up three dots toggle...');

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
        console.log('Three dots toggle changed:', enabled);

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.showThreeDots = enabled;
            }, true);
            console.log('Three dots setting saved to AppState:', enabled);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.('Failed to save setting', 'error');
            threeDotsToggle.checked = !enabled;
            return;
        }

        document.body.classList.toggle("show-three-dots-enabled", enabled);
        _deps.toggleHoverTaskOptions?.(!enabled);
        _deps.refreshTaskListUI?.();
    };

    safeAddEventListener(threeDotsToggle, "change", threeDotsToggle._changeHandler);
    console.log('Three dots toggle setup completed');
}

/**
 * Setup completed dropdown toggle
 */
export function setupCompletedDropdownToggle() {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const completedDropdownToggle = document.getElementById("toggle-completed-dropdown");
    if (!completedDropdownToggle) return;

    console.log('Setting up completed dropdown toggle...');

    let completedDropdownEnabled = false;
    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        const currentState = AppState.get();
        completedDropdownEnabled = currentState?.settings?.showCompletedDropdown || false;
    }

    completedDropdownToggle.checked = completedDropdownEnabled;

    completedDropdownToggle._changeHandler = async () => {
        const enabled = completedDropdownToggle.checked;
        console.log('Completed dropdown toggle changed:', enabled);

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.showCompletedDropdown = enabled;
            }, true);
            console.log('Completed dropdown setting saved to state:', enabled);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.('Failed to save setting', 'error');
            completedDropdownToggle.checked = !enabled;
            return;
        }

        if (enabled) {
            _deps.organizeCompletedTasks?.();
        } else {
            // Move completed tasks back to main list
            const completedList = document.getElementById('completedTaskList');
            const taskList = document.getElementById('taskList');
            if (completedList && taskList) {
                const completedTasks = Array.from(completedList.querySelectorAll('.task'));
                completedTasks.forEach(task => {
                    taskList.appendChild(task);
                });
                const completedSection = document.getElementById('completed-tasks-section');
                if (completedSection) {
                    completedSection.style.display = 'none';
                }
            }
        }
    };

    safeAddEventListener(completedDropdownToggle, "change", completedDropdownToggle._changeHandler);
    console.log('Completed dropdown toggle setup completed');
}

/**
 * Setup debug mode toggle
 */
export function setupDebugModeToggle() {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const debugModeToggle = document.getElementById("toggle-debug-mode");
    if (!debugModeToggle) return;

    console.log('Setting up debug mode toggle...');

    const debugEnabled = isDebug();
    debugModeToggle.checked = debugEnabled;

    debugModeToggle._changeHandler = () => {
        const enabled = debugModeToggle.checked;
        console.log('Debug mode toggle changed:', enabled);

        if (enabled) {
            enableDebug();
            _deps.showNotification?.('Debug mode enabled - console.log output visible', 'success', 3000);
        } else {
            disableDebug();
            _deps.showNotification?.('Debug mode disabled - console.log output suppressed', 'info', 3000);
        }
    };

    safeAddEventListener(debugModeToggle, "change", debugModeToggle._changeHandler);
    console.log('Debug mode toggle setup completed');
}

/**
 * Setup reset recurring defaults button
 */
export function setupResetRecurringButton() {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const resetRecurringBtn = document.getElementById("reset-recurring-default");
    if (!resetRecurringBtn) return;

    resetRecurringBtn._clickHandler = async () => {
        console.log('Resetting recurring defaults...');

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
            _deps.showNotification?.("Recurring default reset to Daily Indefinitely.", "success");
        } else {
            console.error('AppState not ready - settings not saved');
            _deps.showNotification?.("Failed to reset defaults.", "error");
        }
    };

    safeAddEventListener(resetRecurringBtn, "click", resetRecurringBtn._clickHandler);
}

/**
 * Sync current settings to storage
 */
export async function syncCurrentSettingsToStorage() {
    console.log('Syncing current settings to storage...');

    const schemaData = _deps.loadMiniCycleData?.();

    if (!schemaData) {
        console.error('Schema 2.5 data required for syncCurrentSettingsToStorage');
        return;
    }

    const { cycles, activeCycle } = schemaData;
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");

    if (!activeCycle || !cycles[activeCycle]) {
        console.warn('No active cycle found for settings sync');
        return;
    }

    if (!toggleAutoReset || !deleteCheckedTasks) {
        console.warn('Settings toggles not found');
        return;
    }

    console.log('Syncing settings:', {
        activeCycle,
        autoReset: toggleAutoReset.checked,
        deleteCheckedTasks: deleteCheckedTasks.checked
    });

    const AppState = _deps.AppState?.();
    if (AppState?.isReady?.()) {
        await AppState.update(state => {
            const cycle = state?.data?.cycles?.[activeCycle];
            if (cycle) {
                cycle.autoReset = toggleAutoReset.checked;
                cycle.deleteCheckedTasks = deleteCheckedTasks.checked;
            }
        }, true);
        console.log('Settings synced to Schema 2.5 successfully');
    } else {
        console.error('AppState not ready - settings not synced');
    }
}

/**
 * Initialize all settings UI components
 */
export function initAllToggles() {
    setupSettingsMenu();
    setupDarkModeToggle();
    setupMoveArrowsToggle();
    setupThreeDotsToggle();
    setupCompletedDropdownToggle();
    setupDebugModeToggle();
    setupResetRecurringButton();
}

console.log('Settings UI Manager loaded');
