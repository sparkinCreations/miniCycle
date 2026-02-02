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
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';

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
    isDebug: optional(null)
});

/** @type {{AppState: Object, loadMiniCycleData: Function, showNotification: Function, safeAddEventListener: Function, hideMainMenu: Function|null, setupDarkModeToggle: Function|null, setupQuickDarkToggle: Function|null, updateMoveArrowsVisibility: Function|null, toggleHoverTaskOptions: Function|null, refreshTaskListUI: Function|null, organizeCompletedTasks: Function|null, resetDefaultRecurringSettings: Function|null}} */
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
    _initialized.debugToggle = false;
    _initialized.resetRecurringDefaults = false;
    _initialized.resetAchievementProgress = false;
}

// ============================================================================
// IDEMPOTENCY GUARDS
// ============================================================================

const _initialized = {
    settingsMenu: false,
    moveArrowsToggle: false,
    threeDotsToggle: false,
    completedDropdownToggle: false,
    debugToggle: false,
    resetRecurringDefaults: false,
    resetAchievementProgress: false
};

// ============================================================================
// MENU MANAGEMENT
// ============================================================================

/**
 * Setup settings menu open/close functionality
 */
export function setupSettingsMenu() {
    // ✅ Idempotency guard
    if (_initialized.settingsMenu) {
        console.log('✅ Settings menu already set up');
        return;
    }
    _initialized.settingsMenu = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('SettingsUIManager: safeAddEventListener dependency not injected');
        return;
    }

    const settingsModal = document.querySelector(DOM_SELECTORS.SETTINGS_MODAL);
    const settingsModalContent = document.querySelector(DOM_SELECTORS.SETTINGS_MODAL_CONTENT);
    const openSettingsBtn = document.getElementById(DOM_IDS.OPEN_SETTINGS);
    const closeSettingsBtn = document.getElementById(DOM_IDS.CLOSE_SETTINGS);

    const openSettings = (event) => {
        event.stopPropagation();
        _deps.trackAction?.('settings');
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

    // Setup collapsible sections
    setupSettingsCollapsibleSections(safeAddEventListener);

    // Display version number
    updateVersionDisplay();
}

/**
 * Setup collapsible sections in settings modal
 * @param {Function} safeAddEventListener - Event listener helper
 */
function setupSettingsCollapsibleSections(safeAddEventListener) {
    const sectionHeaders = document.querySelectorAll(DOM_SELECTORS.SETTINGS_SECTION_HEADER);

    // Load saved collapsed states
    loadSettingsCollapsedStates();

    sectionHeaders.forEach(header => {
        safeAddEventListener(header, 'click', (e) => {
            e.stopPropagation();
            const section = header.closest('.settings-section');
            if (section) {
                section.classList.toggle('collapsed');
                saveSettingsCollapsedStates();
            }
        });
    });
}

/**
 * Load collapsed states from AppState
 */
function loadSettingsCollapsedStates() {
    const state = _deps.AppState?.get();
    const collapsedStates = state?.settings?.settingsCollapsedSections;

    if (!collapsedStates) return;

    const sections = document.querySelectorAll(DOM_SELECTORS.SETTINGS_SECTION_COLLAPSIBLE);
    sections.forEach(section => {
        const sectionName = section.dataset.section;
        if (sectionName && collapsedStates[sectionName] !== undefined) {
            if (collapsedStates[sectionName]) {
                section.classList.add('collapsed');
            } else {
                section.classList.remove('collapsed');
            }
        }
    });
}

/**
 * Save collapsed states to AppState
 */
function saveSettingsCollapsedStates() {
    const sections = document.querySelectorAll(DOM_SELECTORS.SETTINGS_SECTION_COLLAPSIBLE);
    const collapsedStates = {};

    sections.forEach(section => {
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
        console.log('✅ Move arrows toggle already set up');
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
        const customizerModal = document.getElementById(DOM_IDS.TASK_OPTIONS_CUSTOMIZER_MODAL);
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
    // ✅ Idempotency guard
    if (_initialized.threeDotsToggle) {
        console.log('✅ Three dots toggle already set up');
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
    // ✅ Idempotency guard
    if (_initialized.completedDropdownToggle) {
        console.log('✅ Completed dropdown toggle already set up');
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
    console.log('Completed dropdown toggle setup completed');
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

    console.log('Setting up scroll to new task toggle...');

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
        console.log('Scroll to new task toggle changed:', enabled);

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.scrollToNewTask = enabled;
            }, true);
            console.log('Scroll to new task setting saved to state:', enabled);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.('Failed to save setting', 'error');
            scrollToggle.checked = !enabled;
            return;
        }
    };

    safeAddEventListener(scrollToggle, "change", scrollToggle._changeHandler);
    console.log('Scroll to new task toggle setup completed');
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

    console.log('Setting up scroll on load toggle...');

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
        console.log('Scroll on load toggle changed:', enabled);

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.scrollOnLoad = enabled;
            }, true);
            console.log('Scroll on load setting saved to state:', enabled);
        } else {
            console.error('AppState not ready - setting not saved');
            _deps.showNotification?.('Failed to save setting', 'error');
            scrollToggle.checked = !enabled;
            return;
        }
    };

    safeAddEventListener(scrollToggle, "change", scrollToggle._changeHandler);
    console.log('Scroll on load toggle setup completed');
}

/**
 * Setup debug mode toggle
 */
export function setupDebugModeToggle() {
    // ✅ Idempotency guard
    if (_initialized.debugToggle) {
        console.log('✅ Debug mode toggle already set up');
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

    console.log('Setting up debug mode toggle...');

    const debugEnabled = _deps.isDebug?.() ?? false;
    debugModeToggle.checked = debugEnabled;

    debugModeToggle._changeHandler = () => {
        const enabled = debugModeToggle.checked;
        console.log('Debug mode toggle changed:', enabled);

        if (enabled) {
            _deps.enableDebug?.();
            _deps.showNotification?.('Debug mode enabled - console.log output visible', 'success', 3000);
        } else {
            _deps.disableDebug?.();
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
    // ✅ Idempotency guard
    if (_initialized.resetRecurringDefaults) {
        console.log('✅ Reset recurring button already set up');
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
 * Setup Reset Achievement Progress button
 * Resets global achievement progress (cycles, cleared tasks, milestones)
 * but keeps individual routine stats intact
 */
export function setupResetAchievementProgressButton() {
    // ✅ Idempotency guard
    if (_initialized.resetAchievementProgress) {
        console.log('✅ Reset achievement progress button already set up');
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
            console.log('🏆 Resetting achievement progress...');

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

                _deps.showNotification?.("Achievement progress reset. Badges are now locked.", "success");
                console.log('✅ Achievement progress reset complete');
            } else {
                console.error('AppState not ready - achievement reset failed');
                _deps.showNotification?.("Failed to reset achievements.", "error");
            }
        };

        if (showConfirmationModal) {
            showConfirmationModal({
                title: "Reset Achievement Progress",
                message: "This will reset all achievement badges and global progress to 0. Your individual routine stats and history will NOT be affected. Are you sure?",
                confirmText: "Reset Achievements",
                cancelText: "Cancel",
                callback: async (confirmed) => {
                    if (confirmed) {
                        await doReset();
                    } else {
                        _deps.showNotification?.("Achievement reset cancelled.", "info", 2000);
                    }
                }
            });
        } else {
            // Fallback to browser confirm
            const confirmed = confirm("This will reset all achievement badges and global progress to 0. Your individual routine stats and history will NOT be affected. Are you sure?");
            if (confirmed) {
                await doReset();
            }
        }
    };

    safeAddEventListener(resetBtn, "click", resetBtn._clickHandler);
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
    setupScrollToNewTaskToggle();
    setupScrollOnLoadToggle();
    setupDebugModeToggle();
    setupResetRecurringButton();
    setupResetAchievementProgressButton();
}

console.log('Settings UI Manager loaded');
