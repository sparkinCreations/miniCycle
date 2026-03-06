/**
 * Mode Manager - Manages Auto Cycle, Manual Cycle, and To-Do Mode (DI-Pure)
 * @module modules/cycle/modeManager
 * @pattern Resilient Constructor 🛡️
 *
 * Handles three cycling modes:
 * - Auto Cycle ↻: Tasks auto-reset when all completed
 * - Manual Cycle ✔︎↻: Tasks reset only on manual button click
 * - To-Do Mode ✓: Tasks are deleted instead of reset
 *
 * Mode changes refresh UI in-place without page reload.
 *
 * Note: document.*, sessionStorage are browser APIs, not dependencies.
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('ModeManager', {
    appInit: optional(null),
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    createTaskButtonContainer: optional(null),
    setupDueDateButtonInteraction: optional(null),
    checkCompleteAllButton: optional(null),
    showNotification: optional(null),
    helpWindowManager: optional(null),
    recurringCore: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    safeAddEventListener: optional(null),
    checkMiniCycle: optional(() => {}),
    refreshTaskListUI: optional(null),
    updateRecurringButtonVisibility: optional(() => {}),
    syncAllTasksWithMode: optional(null),
    switchMiniCycle: optional(null),
    createNewMiniCycle: optional(null),
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: optional({ cycle: false, todo: true })
});

/**
 * Set dependencies for ModeManager (call before creating instance)
 * @param {Object} dependencies - { AppState, showNotification, etc. }
 */
export function setModeManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎯 ModeManager dependencies set:', Object.keys(dependencies));
}

export class ModeManager {
    constructor(dependencies = {}) {
        console.log('🎯 ModeManager: Constructing with dependencies');

        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Store dependencies with fallback for safeAddEventListener
        this.deps = {
            ...resolvedDeps,
            safeAddEventListener: resolvedDeps.safeAddEventListener
        };

        // Debounce timer for refresh operations
        this.refreshDebounceTimer = null;

        this._initialized = false;
    }

    /**
     * Initialize mode manager
     * Waits for core systems to be ready, then sets up mode selector with delay
     */
    async init() {
        console.log('🎯 ModeManager: Initializing...');

        // Wait for core systems to be ready
        await this.deps.appInit?.waitForCore();

        console.log('⏰ ModeManager: Initializing mode selector with 200ms delay...');
        setTimeout(() => {
            console.log('⏰ ModeManager: Delay complete, calling setupModeSelector...');
            this.setupModeSelector();
            // ✅ Also set up the mode listener that syncs visual indicators
            this.setupDeleteCheckedTasksModeListener();
        }, 200);

        // ✅ Setup visibility change listener for mode validation on app resume
        this.setupVisibilityChangeListener();

        this._initialized = true;
        console.log('✅ ModeManager: Initialized');
    }

    /**
     * Get friendly name for a mode
     * @param {string} mode - Mode identifier (auto-cycle, manual-cycle, todo-mode)
     * @returns {string} Friendly mode name with icon
     */
    getModeName(mode) {
        const modeNames = {
            'auto-cycle': getLabel('mode.auto') + ' ' + getLabel('mode.autoEmoji'),
            'manual-cycle': getLabel('mode.manual') + ' ' + getLabel('mode.manualEmoji'),
            'todo-mode': getLabel('mode.todo') + ' ' + getLabel('mode.todoEmoji')
        };

        const result = modeNames[mode] || getLabel('mode.auto') + ' ' + getLabel('mode.autoEmoji');
        console.log('📝 ModeManager: Getting mode name:', { input: mode, output: result });
        return result;
    }

    /**
     * Refresh task buttons when mode changes
     * Updates button visibility based on current mode settings
     * Debounced to prevent performance issues during rapid mode changes
     */
    async refreshTaskButtonsForModeChange() {
        // Clear any pending refresh
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        // Debounce the refresh to prevent forced reflows
        this.refreshDebounceTimer = setTimeout(async () => {
            console.log('🔄 ModeManager: Refreshing task buttons for mode change...');

            // Wait for core if needed
            await this.deps.appInit?.waitForCore();

            const tasks = this.deps.querySelectorAll(DOM_SELECTORS.TASK);
            if (tasks.length === 0) {
                console.log('⚠️ ModeManager: No tasks found to refresh');
                return;
            }

        // Track failures for summary logging
        let failureCount = 0;
        let successCount = 0;

        // Get current mode settings
        const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
        const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);
        const autoResetEnabled = toggleAutoReset?.checked || false;
        const deleteCheckedEnabled = deleteCheckedTasks?.checked || false;

        console.log('🔍 ModeManager: Current mode settings:', { autoResetEnabled, deleteCheckedEnabled });

        // Get settings for button visibility
        const AppState = this.deps.AppState;
        const currentState = AppState?.get();
        const settings = currentState?.settings || {};
        const remindersEnabledGlobal = currentState?.reminders?.enabled || false;

        // ✅ Get currentCycle - required for recurring button handler
        const activeCycleId = currentState?.appState?.activeCycleId;
        const currentCycle = currentState?.data?.cycles?.[activeCycleId];

        if (!currentCycle) {
            console.warn('⚠️ ModeManager: No active cycle found, cannot refresh task buttons');
            return;
        }

        tasks.forEach(task => {
            const taskId = task.dataset.taskId;
            const oldButtonContainer = task.querySelector(DOM_SELECTORS.TASK_OPTIONS);

            if (!oldButtonContainer) {
                // Task buttons not yet rendered - this is normal during initial load
                // Don't count as failure, just skip silently
                return;
            }

            // Get task data
            const recurringSettings = task.dataset.recurringSettings
                ? JSON.parse(task.dataset.recurringSettings)
                : null;

            const taskContext = {
                autoResetEnabled,
                deleteCheckedEnabled,
                settings,
                remindersEnabled: task.querySelector(DOM_SELECTORS.ENABLE_TASK_REMINDERS)?.classList.contains('reminder-active') || false,
                remindersEnabledGlobal,
                assignedTaskId: taskId,
                currentCycle, // ✅ Required for recurring button handler
                activeCycle: activeCycleId, // ✅ Also include activeCycleId
                recurring: task.classList.contains('recurring'),
                highPriority: task.classList.contains('high-priority')
            };

            // Create new button container
            const createTaskButtonContainer = this.deps.createTaskButtonContainer;
            if (!createTaskButtonContainer) {
                console.warn('⚠️ ModeManager: createTaskButtonContainer not available');
                return;
            }

            const newButtonContainer = createTaskButtonContainer(taskContext);

            // Check if newButtonContainer was created successfully
            if (!newButtonContainer) {
                failureCount++;
                return;
            }

            // Preserve visibility state
            const wasVisible = oldButtonContainer.classList.contains('task-options-visible');
            if (wasVisible) {
                newButtonContainer.classList.add('task-options-visible');
                newButtonContainer.classList.remove('task-options-force-hidden');
            }

            // Replace old container with new one
            oldButtonContainer.replaceWith(newButtonContainer);

            // ✅ CRITICAL: Attach due date button listener to newly created buttons
            const dueDateInput = task.querySelector(DOM_SELECTORS.DUE_DATE);
            if (dueDateInput && this.deps.setupDueDateButtonInteraction) {
                // Remove the guard flag first to allow re-attaching
                const dueDateButton = newButtonContainer.querySelector(DOM_SELECTORS.SET_DUE_DATE);
                if (dueDateButton) {
                    delete dueDateButton.dataset.listenerAttached;
                }
                this.deps.setupDueDateButtonInteraction(newButtonContainer, dueDateInput);
                console.log('✅ ModeManager: Attached due date listener for task:', taskId);
            }

            successCount++;
        });

            // Summary logging instead of per-task spam
            if (successCount > 0) {
                console.log(`✅ ModeManager: Task button refresh complete (${successCount} tasks)`);

                // ✅ Sync delete-when-complete button visual states after buttons are recreated
                if (this.deps.syncAllTasksWithMode && currentCycle?.tasks) {
                    // Determine current mode from toggle states (already captured above)
                    const currentMode = deleteCheckedEnabled ? 'todo' : 'cycle';
                    const tasksData = {};
                    currentCycle.tasks.forEach(t => { tasksData[t.id] = t; });
                    const constants = {
                        DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: this.deps.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
                    };
                    this.deps.syncAllTasksWithMode(currentMode, tasksData, constants);
                    console.log('✅ ModeManager: Synced delete-when-complete button states');
                }
            } else if (tasks.length > 0) {
                // Only log if there were tasks but none had buttons yet (initial load)
                console.log('ℹ️ ModeManager: Task buttons not yet rendered, will be created by taskDOM');
            }
        }, 150); // 150ms debounce delay - prevents multiple rapid reflows
    }

    /**
     * Sync mode from toggle states
     * Updates mode selector and UI based on current toggle settings
     */
    async syncModeFromToggles() {
        console.log('🔄 ModeManager: Syncing mode from toggles (state-based)...');

        // Wait for core
        await this.deps.appInit?.waitForCore();

        const AppState = this.deps.AppState;
        const currentState = AppState?.get();
        if (!currentState) {
            // ✅ Normal during Phase 2 - data loads in Phase 3, syncModeFromToggles will be called again
            console.log('⏳ ModeManager: State not yet available, will sync when data loads');
            return;
        }

        const { data, appState } = currentState;
        const activeCycle = appState.activeCycleId;
        const currentCycle = data.cycles[activeCycle];

        const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
        const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);
        const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);

        if (!toggleAutoReset || !deleteCheckedTasks || !modeSelector) {
            console.warn('⚠️ ModeManager: Required DOM elements not found');
            return;
        }

        let autoReset = false;
        let deleteChecked = false;

        if (currentCycle) {
            autoReset = currentCycle.autoReset || false;
            deleteChecked = currentCycle.deleteCheckedTasks || false;

            console.log('📊 ModeManager: Mode settings from state:', {
                activeCycle,
                autoReset,
                deleteChecked
            });

            // ✅ CRITICAL FIX: Update DOM to match data
            toggleAutoReset.checked = autoReset;
            deleteCheckedTasks.checked = deleteChecked;

            // Sync task input bar visibility with routine's saved preference
            if (this._updateTaskInputVisibility) {
                this._updateTaskInputVisibility(currentCycle.showTaskInput === true);
            }
        } else {
            // ✅ Normal during Phase 2 - data loads in Phase 3
            console.log('ℹ️ No active cycle yet - using DOM defaults until data loads');
            // ✅ Fallback to DOM state only if no saved data exists
            autoReset = toggleAutoReset.checked;
            deleteChecked = deleteCheckedTasks.checked;
        }

        console.log('🔄 ModeManager: Syncing mode from data source:', { autoReset, deleteChecked });

        let mode = 'auto-cycle';

        // ✅ FIXED: Check deleteChecked FIRST before other conditions
        if (deleteChecked) {
            mode = 'todo-mode';
        } else if (autoReset && !deleteChecked) {
            mode = 'auto-cycle';
        } else if (!autoReset && !deleteChecked) {
            mode = 'manual-cycle';
        }

        console.log('📝 ModeManager: Setting selector to:', mode);

        // Update selector
        modeSelector.value = mode;

        // Update body classes
        document.body.className = document.body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
        document.body.classList.add(mode + '-mode');

        // ✅ FIXED: Update container visibility based on mode, not just autoReset
        const deleteContainer = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS_CONTAINER);
        const autoResetContainer = this.deps.getElementById(DOM_IDS.AUTO_RESET_CONTAINER);

        // Hide both individual toggle containers since mode selector controls this functionality
        if (deleteContainer) {
            deleteContainer.style.display = 'none';
        }
        if (autoResetContainer) {
            autoResetContainer.style.display = 'none';
        }

        console.log('✅ ModeManager: Mode selectors synced to Schema 2.5:', mode);
    }

    /**
     * Update storage from toggle states
     * Persists current toggle states to AppState
     */
    async updateStorageFromToggles() {
        console.log('💾 ModeManager: Updating storage from toggles (state-based)...');

        // Wait for core
        await this.deps.appInit?.waitForCore();

        const AppState = this.deps.AppState;
        const currentState = AppState?.get();
        if (!currentState) {
            console.error('❌ ModeManager: No state data available for updateStorageFromToggles');
            return;
        }

        const { appState } = currentState;
        const activeCycle = appState.activeCycleId;

        if (!activeCycle) {
            console.warn('⚠️ ModeManager: No active cycle found for storage update');
            return;
        }

        const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
        const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);

        // ✅ Update through state system
        AppState.update(state => {
            const cycle = state.data.cycles[activeCycle];
            if (cycle) {
                cycle.autoReset = toggleAutoReset.checked;
                cycle.deleteCheckedTasks = deleteCheckedTasks.checked;
            }
        }, true); // immediate save

        console.log('✅ ModeManager: Storage updated from toggles (state-based)');
    }

    /**
     * Update cycle mode description text
     * Updates the mode description box with current mode information
     */
    async updateCycleModeDescription() {
        console.log('📝 ModeManager: Updating cycle mode description (Schema 2.5 only)...');

        // Wait for core
        await this.deps.appInit?.waitForCore();

        // ✅ Schema 2.5 only
        const loadMiniCycleData = this.deps.loadMiniCycleData;
        if (!loadMiniCycleData) {
            console.warn('⚠️ ModeManager: loadMiniCycleData not available');
            return;
        }

        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ ModeManager: Schema 2.5 data required for updateCycleModeDescription');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];

        let autoReset = false;
        let deleteChecked = false;

        if (currentCycle) {
            autoReset = currentCycle.autoReset || false;
            deleteChecked = currentCycle.deleteCheckedTasks || false;
        }

        console.log('📊 ModeManager: Mode settings:', { autoReset, deleteChecked });

        const descriptionBox = this.deps.getElementById(DOM_IDS.MODE_DESCRIPTION);
        if (!descriptionBox) {
            console.warn('⚠️ ModeManager: Mode description box not found');
            return;
        }

        let modeTitle = "";
        let modeDetail = "";
        let currentMode = "";

        if (deleteChecked) {
            currentMode = "todo-mode";
            modeTitle = getLabel('mode.todoTitle');
            modeDetail = getLabel('mode.todoDetail');
        } else if (autoReset) {
            currentMode = "auto-cycle";
            modeTitle = getLabel('mode.autoTitle');
            modeDetail = getLabel('mode.autoDetail');
        } else {
            currentMode = "manual-cycle";
            modeTitle = getLabel('mode.manualTitle');
            modeDetail = getLabel('mode.manualDetail');
        }

        descriptionBox.innerHTML = `<strong>${modeTitle}:</strong><br>${modeDetail}`;

        // Update the mode badge on the toggle button (visible when collapsed)
        const toggleBtn = this.deps.getElementById(DOM_IDS.MODE_DESCRIPTION_TOGGLE);
        if (toggleBtn) {
            const badge = toggleBtn.querySelector('.mode-badge');
            if (badge) {
                badge.textContent = this.getModeName(currentMode);
            }
        }

        console.log('✅ ModeManager: Mode description updated:', currentMode);
    }

    /**
     * Set up mode selector UI and event listeners
     * Main setup function that configures all mode-related UI elements
     */
    async setupModeSelector() {
        // ✅ Guard against duplicate setup - prevents double notifications
        if (this._modeSelectorSetupComplete) {
            console.log('⏭️ ModeManager: Mode selector already set up, skipping');
            return;
        }

        console.log('🎯 ModeManager: Setting up mode selector (state-based)...');

        // Wait for core
        await this.deps.appInit?.waitForCore();

        const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
        const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
        const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);

        console.log('🔍 ModeManager: Element detection:', {
            modeSelector: !!modeSelector,
            toggleAutoReset: !!toggleAutoReset,
            deleteCheckedTasks: !!deleteCheckedTasks
        });

        if (!modeSelector || !toggleAutoReset || !deleteCheckedTasks) {
            console.warn('⚠️ ModeManager: Mode selector elements not found');
            return;
        }

        // Mark setup as complete
        this._modeSelectorSetupComplete = true;

        // ✅ Function to sync toggles from either selector (NESTED FUNCTION - stays inside)
        // ✅ FIXED: Made async to properly await storage update before UI sync
        const syncTogglesFromMode = async (selectedMode) => {
            console.log('🔄 ModeManager: Syncing toggles from mode selector:', selectedMode);

            switch(selectedMode) {
                case 'auto-cycle':
                    toggleAutoReset.checked = true;
                    deleteCheckedTasks.checked = false;
                    break;
                case 'manual-cycle':
                    toggleAutoReset.checked = false;
                    deleteCheckedTasks.checked = false;
                    break;
                case 'todo-mode':
                    toggleAutoReset.checked = false;
                    deleteCheckedTasks.checked = true;
                    break;
            }

            // Update selector value
            modeSelector.value = selectedMode;

            // ✅ UPDATE STORAGE FIRST - must await to ensure data is saved before UI sync
            await this.updateStorageFromToggles();

            // ✅ THEN trigger change events (but prevent them from updating storage again)
            console.log('🔔 ModeManager: Dispatching change events to update storage...');
            toggleAutoReset.dispatchEvent(new Event('change'));
            deleteCheckedTasks.dispatchEvent(new Event('change'));

            // Update UI - now storage has correct values (MUST await to ensure body class is set)
            await this.syncModeFromToggles();

            // Check complete all button
            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Update recurring button visibility via module (DI-pure)
            if (this.deps.recurringCore?.updateRecurringButtonVisibility) {
                this.deps.recurringCore.updateRecurringButtonVisibility();
            }

            // ✅ Show mode description in help window
            const helpMgr = this.deps.helpWindowManager?.();
            if (helpMgr && typeof helpMgr.showModeDescription === 'function') {
                helpMgr.showModeDescription(selectedMode);
            }

            console.log('✅ ModeManager: Toggles synced from mode selector');
        };

        // ✅ Set up event listeners for both selectors using safeAddEventListener
        console.log('📡 ModeManager: Setting up event listeners for both selectors...');
        const safeAdd = this.deps.safeAddEventListener;

        modeSelector._changeHandler = async (e) => {
            console.log('🎯 ModeManager: Desktop mode selector changed:', e.target.value);
            await syncTogglesFromMode(e.target.value);
            this.updateCycleModeDescription();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to apply mode-specific button visibility
            this.refreshTaskButtonsForModeChange();

            // ✅ Update recurring button visibility for mode change (DI-pure)
            if (this.deps.recurringCore?.updateRecurringButtonVisibility) {
                console.log('🔁 ModeManager: Updating recurring button visibility for mode change...');
                setTimeout(() => {
                    this.deps.recurringCore.updateRecurringButtonVisibility();
                    console.log('🔁 ModeManager: Recurring button visibility update completed');
                }, 100);
            }

            // ✅ If switching to auto-cycle mode, check if cycle should complete
            if (e.target.value === 'auto-cycle' && this.deps.checkMiniCycle) {
                console.log('🔄 ModeManager: Auto-cycle mode enabled - checking if cycle should complete...');
                setTimeout(() => {
                    this.deps.checkMiniCycle();
                }, 150); // Small delay to ensure UI is updated first
            }

            if (this.deps.showNotification) {
                this.deps.showNotification(getLabel('notify.modeSwitched', { vars: { mode: this.getModeName(e.target.value) } }), 'success', 2000);
            }

            console.log('✅ ModeManager: Mode change applied without reload');
        };
        safeAdd(modeSelector, 'change', modeSelector._changeHandler);

        // Allow Enter key to open the mode selector dropdown
        safeAdd(modeSelector, 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                modeSelector.showPicker?.();
            }
        });

        toggleAutoReset._modeChangeHandler = (e) => {
            console.log('🔘 ModeManager: Auto Reset toggle changed:', e.target.checked);
            this.syncModeFromToggles();
            this.updateCycleModeDescription();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to show/hide buttons based on new mode
            this.refreshTaskButtonsForModeChange();
        };
        safeAdd(toggleAutoReset, 'change', toggleAutoReset._modeChangeHandler);

        deleteCheckedTasks._modeChangeHandler = (e) => {
            console.log('🗑️ ModeManager: Delete Checked Tasks toggle changed:', e.target.checked);
            this.syncModeFromToggles();
            this.updateCycleModeDescription();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to show/hide recurring button based on new mode
            this.refreshTaskButtonsForModeChange();

            // ✅ Update recurring button visibility when switching to/from to-do mode (DI-pure)
            if (this.deps.recurringCore?.updateRecurringButtonVisibility) {
                console.log('🔁 ModeManager: Updating recurring button visibility for mode change...');
                setTimeout(() => {
                    this.deps.recurringCore.updateRecurringButtonVisibility();
                    console.log('🔁 ModeManager: Recurring button visibility update completed');
                }, 100); // Small delay to ensure DOM updates complete
            }
        };
        safeAdd(deleteCheckedTasks, 'change', deleteCheckedTasks._modeChangeHandler);

        // ✅ Mode sync happens via routineLoader when data is loaded (Phase 3)
        // No need to call syncModeFromToggles() here - data doesn't exist yet

        // ✅ Check if we need to restore mode after reload
        const modeToRestore = sessionStorage.getItem('restoreModeAfterReload');
        if (modeToRestore) {
            console.log('🔄 ModeManager: Restoring mode after reload:', modeToRestore);
            sessionStorage.removeItem('restoreModeAfterReload');

            // Small delay to ensure DOM is ready
            setTimeout(() => {
                const freshModeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
                if (freshModeSelector) freshModeSelector.value = modeToRestore;
                this.syncModeFromToggles();
                this.updateCycleModeDescription();

                if (this.deps.showNotification) {
                    this.deps.showNotification(getLabel('notify.modeSwitched', { vars: { mode: this.getModeName(modeToRestore) } }), 'success', 3000);
                }
            }, 500);
        }

        // ✅ Setup routine switcher button (folder icon in mode selector banner)
        const routineSwitcherBtn = this.deps.getElementById(DOM_IDS.ROUTINE_SWITCHER_BTN);
        if (routineSwitcherBtn && this.deps.switchMiniCycle) {
            this.deps.safeAddEventListener(routineSwitcherBtn, 'click', () => {
                this.deps.switchMiniCycle();
            });
        }

        // ✅ Setup quick actions button (plus icon in mode selector banner)
        this.setupQuickActionsButton();

        // ✅ Setup mode description toggle (collapsible)
        this.setupModeDescriptionToggle();

        console.log('✅ ModeManager: Mode selector setup complete');
    }

    /**
     * Setup mode description toggle (collapsible)
     * Allows users to collapse/expand the mode description with persistence
     */
    setupModeDescriptionToggle() {
        const toggleBtn = this.deps.getElementById(DOM_IDS.MODE_DESCRIPTION_TOGGLE);
        const modeDescription = this.deps.getElementById(DOM_IDS.MODE_DESCRIPTION);

        if (!toggleBtn || !modeDescription) {
            console.warn('⚠️ ModeManager: Mode description toggle elements not found');
            return;
        }

        // ✅ Load initial collapsed state from AppState
        const AppState = this.deps.AppState;
        const currentState = AppState?.get();
        const isCollapsed = currentState?.settings?.modeDescriptionCollapsed ?? true;

        // Apply initial state
        if (isCollapsed) {
            modeDescription.classList.add('collapsed');
            toggleBtn.setAttribute('aria-expanded', 'false');
        } else {
            modeDescription.classList.remove('collapsed');
            toggleBtn.setAttribute('aria-expanded', 'true');
        }

        // ✅ Setup click handler
        this.deps.safeAddEventListener(toggleBtn, 'click', async () => {
            const currentlyCollapsed = modeDescription.classList.contains('collapsed');
            const newCollapsed = !currentlyCollapsed;

            // Update UI
            if (newCollapsed) {
                modeDescription.classList.add('collapsed');
                toggleBtn.setAttribute('aria-expanded', 'false');
            } else {
                modeDescription.classList.remove('collapsed');
                toggleBtn.setAttribute('aria-expanded', 'true');
            }

            // ✅ Persist to AppState
            if (AppState?.isReady?.()) {
                await AppState.update(state => {
                    state.settings.modeDescriptionCollapsed = newCollapsed;
                });
                console.log('💾 ModeManager: Mode description collapsed state saved:', newCollapsed);
            }
        });

        console.log('✅ ModeManager: Mode description toggle setup complete');
    }

    /**
     * Setup quick actions button and dropdown menu
     * Handles toggle task input and create new routine actions
     */
    setupQuickActionsButton() {
        const quickActionsBtn = this.deps.getElementById(DOM_IDS.QUICK_ACTIONS_BTN);
        const quickActionsMenu = this.deps.getElementById(DOM_IDS.QUICK_ACTIONS_MENU);
        const toggleTaskInputBtn = this.deps.getElementById(DOM_IDS.TOGGLE_TASK_INPUT_BTN);
        const createRoutineBtn = this.deps.getElementById(DOM_IDS.CREATE_ROUTINE_BTN);
        const taskInput = this.deps.querySelectorAll(DOM_SELECTORS.TASK_INPUT)[0];

        if (!quickActionsBtn || !quickActionsMenu) {
            console.warn('⚠️ ModeManager: Quick actions elements not found');
            return;
        }

        // Apply first-time shimmer only for genuinely new users
        const currentState = this.deps.AppState?.get();
        const activeCycleId = currentState?.appState?.activeCycleId;
        const activeCycle = currentState?.data?.cycles?.[activeCycleId];
        // Don't count sample routine tasks — new users have tasks from the getting-started routine
        // Only cycleCount > 0 (completed a cycle) or multiple routines indicate a returning user
        const isReturningUser = activeCycle?.cycleCount > 0
            || Object.keys(currentState?.data?.cycles || {}).length > 1;

        if (!currentState?.settings?.addTaskDiscovered && !isReturningUser) {
            quickActionsBtn.classList.add('first-time-shimmer');

            // Also remove shimmer when a task is added (covers mobile path where
            // users type into the input directly without ever clicking the + button).
            // Capture initial count so the sample routine's pre-populated tasks don't
            // trigger removal — only genuinely new user-added tasks should dismiss it.
            const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
            if (taskList) {
                const initialCount = taskList.children.length;
                const observer = new MutationObserver(() => {
                    if (taskList.children.length > initialCount) {
                        quickActionsBtn.classList.remove('first-time-shimmer');
                        observer.disconnect();
                        if (this.deps.AppState) {
                            this.deps.AppState.update(state => {
                                if (!state.settings) state.settings = {};
                                state.settings.addTaskDiscovered = true;
                            }, true);
                        }
                    }
                });
                observer.observe(taskList, { childList: true });
            }
        } else if (!currentState?.settings?.addTaskDiscovered && isReturningUser) {
            // Returning user without the flag — set it silently
            if (this.deps.AppState) {
                this.deps.AppState.update(state => {
                    if (!state.settings) state.settings = {};
                    state.settings.addTaskDiscovered = true;
                }, true);
            }
        }

        // Toggle menu on button click
        this.deps.safeAddEventListener(quickActionsBtn, 'click', (e) => {
            e.stopPropagation();
            const isVisible = quickActionsMenu.style.display !== 'none';
            quickActionsMenu.style.display = isVisible ? 'none' : 'block';

            // Remove first-time shimmer on first click
            if (quickActionsBtn.classList.contains('first-time-shimmer')) {
                quickActionsBtn.classList.remove('first-time-shimmer');
                if (this.deps.AppState) {
                    this.deps.AppState.update(state => {
                        if (!state.settings) state.settings = {};
                        state.settings.addTaskDiscovered = true;
                    }, true);
                }
            }
        });

        // Close menu on outside click
        this.deps.safeAddEventListener(document, 'click', (e) => {
            if (!quickActionsBtn.contains(e.target) && !quickActionsMenu.contains(e.target)) {
                quickActionsMenu.style.display = 'none';
            }
        });

        // Toggle task input visibility
        if (toggleTaskInputBtn && taskInput) {
            const toggleText = this.deps.getElementById(DOM_IDS.TOGGLE_TASK_INPUT_TEXT);

            // Update button text and visibility based on state
            // Use CSS class toggle (visibility:hidden) instead of display:none to prevent CLS
            this._updateTaskInputVisibility = (isVisible) => {
                if (toggleText) {
                    // Use 'action.addTask' (not 'nav.addTaskToggle') so vocab themes
                    // ("Add habit", "Add exercise", etc.) are reflected here too.
                    toggleText.textContent = isVisible ? getLabel('nav.hideTaskInput') : getLabel('action.addTask');
                }
                // Remove inline display style if present (from initial HTML)
                if (taskInput.style.display) {
                    taskInput.style.display = '';
                }
                taskInput.classList.toggle('hidden', !isVisible);

                // Fix tab order: remove hidden inputs from focus sequence
                const focusableChildren = taskInput.querySelectorAll('input, button');
                focusableChildren.forEach(el => {
                    el.tabIndex = isVisible ? 0 : -1;
                });
            };

            // Set initial state from per-routine setting (default: false = hidden)
            const state = this.deps.AppState?.get();
            const activeCycleId = state?.appState?.activeCycleId;
            const activeCycle = activeCycleId ? state?.data?.cycles?.[activeCycleId] : null;
            const initialVisible = activeCycle?.showTaskInput === true;
            this._updateTaskInputVisibility(initialVisible);

            this.deps.safeAddEventListener(toggleTaskInputBtn, 'click', async () => {
                const currentVisible = !taskInput.classList.contains('hidden');
                const newVisible = !currentVisible;

                // Update UI immediately
                this._updateTaskInputVisibility(newVisible);
                quickActionsMenu.style.display = 'none';

                // Focus the text input when showing the input bar
                if (newVisible) {
                    requestAnimationFrame(() => {
                        const textInput = this.deps.getElementById(DOM_IDS.TASK_INPUT);
                        textInput?.focus();
                    });
                }

                // Persist to active routine (per-routine setting)
                if (this.deps.AppState) {
                    await this.deps.AppState.update(state => {
                        const cycleId = state.appState?.activeCycleId;
                        if (cycleId && state.data?.cycles?.[cycleId]) {
                            state.data.cycles[cycleId].showTaskInput = newVisible;
                        }
                    });
                }

                if (this.deps.showNotification) {
                    this.deps.showNotification(
                        getLabel(newVisible ? 'notify.taskInputShown' : 'notify.taskInputHidden'),
                        'info',
                        4000
                    );
                }
            });
        }

        // Create new routine
        if (createRoutineBtn) {
            this.deps.safeAddEventListener(createRoutineBtn, 'click', () => {
                quickActionsMenu.style.display = 'none';

                if (this.deps.createNewMiniCycle) {
                    this.deps.createNewMiniCycle();
                } else {
                    console.warn('⚠️ ModeManager: createNewMiniCycle not available');
                    if (this.deps.showNotification) {
                        this.deps.showNotification(getLabel('notify.createRoutineUnavailable'), 'warning', 2000);
                    }
                }
            });
        }

        console.log('✅ ModeManager: Quick actions button setup complete');
    }

    /**
     * Setup toggle auto reset functionality
     * Handles auto-reset toggle, delete-checked-tasks toggle, and their event handlers
     */
    setupToggleAutoReset() {
        console.log('⚙️ ModeManager: Setting up toggle auto reset (state-based)...');

        const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
        const deleteCheckedTasksContainer = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS_CONTAINER);
        const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);

        if (!toggleAutoReset || !deleteCheckedTasks) {
            console.warn('⚠️ ModeManager: Toggle elements not found for setupToggleAutoReset');
            return;
        }

        // ✅ Use state-based data access
        const AppState = this.deps.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ ModeManager: AppState not ready for setupToggleAutoReset');
            return;
        }

        const currentState = AppState.get();
        if (!currentState) {
            console.error('❌ ModeManager: No state data available for setupToggleAutoReset');
            return;
        }

        const { data, appState } = currentState;
        const activeCycle = appState.activeCycleId;
        const currentCycle = data.cycles[activeCycle];

        console.log('📊 ModeManager: Setting up toggles for cycle:', activeCycle);

        // ✅ Ensure AutoReset reflects the correct state from state system
        if (activeCycle && currentCycle) {
            toggleAutoReset.checked = currentCycle.autoReset || false;
            deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
            console.log('🔄 Auto reset state:', currentCycle.autoReset);
            console.log('🗑️ Delete checked tasks state:', currentCycle.deleteCheckedTasks);
        } else {
            console.warn('⚠️ No active cycle found, defaulting to false');
            toggleAutoReset.checked = false;
            deleteCheckedTasks.checked = false;
        }

        // ✅ Hide "Delete Checked Tasks" - always hidden regardless of Auto Reset state
        if (deleteCheckedTasksContainer) {
            deleteCheckedTasksContainer.style.display = "none";
        }

        // Store references for event handlers
        const self = this;

        // ✅ Define event listener functions for state-based system
        function handleAutoResetChange(event) {
            console.log('🔄 Auto reset toggle changed (state-based):', event.target.checked);

            // Fix #34: Read current activeCycleId inside handler, not from closure
            const currentState = AppState?.get?.();
            const currentActiveCycle = currentState?.appState?.activeCycleId;
            const currentCycleData = currentState?.data?.cycles?.[currentActiveCycle];

            if (!currentActiveCycle || !currentCycleData) {
                console.warn('⚠️ No active cycle available for auto reset change');
                return;
            }

            // ✅ Update through state system
            AppState.update(state => {
                const cycle = state.data.cycles[currentActiveCycle];
                if (cycle) {
                    cycle.autoReset = event.target.checked;

                    // ✅ If Auto Reset is turned ON, automatically uncheck "Delete Checked Tasks"
                    if (event.target.checked) {
                        cycle.deleteCheckedTasks = false;
                        deleteCheckedTasks.checked = false; // ✅ Update UI
                        console.log('🔄 Auto reset ON - disabling delete checked tasks');
                    }
                }
            }, true); // immediate save

            // ✅ Keep "Delete Checked Tasks" always hidden regardless of Auto Reset state
            if (deleteCheckedTasksContainer) {
                deleteCheckedTasksContainer.style.display = "none";
            }

            // ✅ Only trigger miniCycle reset if AutoReset is enabled
            if (event.target.checked) {
                console.log('🔄 Auto reset enabled - checking cycle state');
                self.deps.checkMiniCycle();
            }

            // ✅ Only refresh UI on real user interactions, not programmatic mode switches
            // event.isTrusted is false when dispatched programmatically by syncTogglesFromMode()
            if (event.isTrusted) {
                const refreshTaskListUI = self.deps.refreshTaskListUI;
                if (typeof refreshTaskListUI === 'function') {
                    refreshTaskListUI();
                }
            }
            self.deps.updateRecurringButtonVisibility();

            console.log('✅ Auto reset settings saved (state-based)');
        }

        function handleDeleteCheckedTasksChange(event) {
            console.log('🗑️ Delete checked tasks toggle changed (state-based):', event.target.checked);

            if (!activeCycle || !currentCycle) {
                console.warn('⚠️ No active cycle available for delete checked tasks change');
                return;
            }

            // ✅ Update through state system
            AppState.update(state => {
                const cycle = state.data.cycles[activeCycle];
                if (cycle) {
                    cycle.deleteCheckedTasks = event.target.checked;
                }
            }, true); // immediate save

            // ✅ Update recurring button visibility when setting changes
            self.deps.updateRecurringButtonVisibility();

            // ✅ FIX: Refresh task buttons to show/hide delete-when-complete button
            self.refreshTaskButtonsForModeChange();

            console.log('✅ Delete checked tasks setting saved (state-based)');
        }

        // ✅ Use safeAddEventListener to prevent duplicate listeners
        const safeAdd = this.deps.safeAddEventListener;

        // Store references to handlers
        toggleAutoReset._handleAutoResetChange = handleAutoResetChange;
        deleteCheckedTasks._handleDeleteCheckedTasksChange = handleDeleteCheckedTasksChange;

        // ✅ Add event listeners using safeAdd
        safeAdd(toggleAutoReset, "change", handleAutoResetChange);
        safeAdd(deleteCheckedTasks, "change", handleDeleteCheckedTasksChange);

        console.log('✅ ModeManager: Toggle auto reset setup completed (state-based)');
    }

    /**
     * Setup delete checked tasks mode change listener
     * Handles mode-specific behavior when toggling between cycle and todo mode
     */
    setupDeleteCheckedTasksModeListener() {
        const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);
        if (!deleteCheckedTasks) {
            console.warn('⚠️ ModeManager: deleteCheckedTasks element not found');
            return;
        }

        // ✅ Idempotency guard
        if (this._setupDeleteCheckedTasksModeListenerInitialized) {
            console.log('✅ Delete checked tasks mode listener already set up');
            return;
        }
        this._setupDeleteCheckedTasksModeListenerInitialized = true;

        const self = this;
        const safeAdd = this.deps.safeAddEventListener;

        deleteCheckedTasks._deleteCheckedTasksModeHandler = async (event) => {
            // ✅ Schema 2.5 only
            console.log('🗑️ Delete checked tasks toggle changed (Schema 2.5 only)...');

            const schemaData = self.deps.loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Schema 2.5 data required for deleteCheckedTasks toggle');
                throw new Error('Schema 2.5 data not found');
            }

            const { cycles, activeCycle } = schemaData;
            const currentCycle = cycles[activeCycle];

            if (!activeCycle || !currentCycle) {
                console.warn('⚠️ No active cycle found for delete checked tasks toggle');
                return;
            }

            const isToDoMode = event.target.checked;
            const currentMode = isToDoMode ? 'todo' : 'cycle';
            const DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = self.deps.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS;

            // ✅ Update via AppState instead of direct localStorage manipulation
            const AppState = self.deps.AppState;
            if (AppState?.isReady?.()) {
                // Store updated state to avoid race condition
                let updatedCycle = null;

                await AppState.update(state => {
                    const cycle = state.data.cycles[activeCycle];

                    // Update mode
                    cycle.deleteCheckedTasks = isToDoMode;

                    // ✅ Sync all tasks' deleteWhenComplete with mode-specific settings
                    if (cycle.tasks) {
                        cycle.tasks.forEach(task => {
                            // Initialize or repair settings if missing/incomplete
                            if (!task.deleteWhenCompleteSettings ||
                                typeof task.deleteWhenCompleteSettings !== 'object' ||
                                typeof task.deleteWhenCompleteSettings[currentMode] !== 'boolean') {
                                task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
                            }

                            // Sync active value from mode-specific setting
                            task.deleteWhenComplete = task.deleteWhenCompleteSettings[currentMode];
                        });
                        console.log(`✅ Synced deleteWhenComplete for all tasks to ${currentMode} mode settings`);
                    }

                    // ✅ Capture updated cycle to avoid race condition
                    updatedCycle = cycle;
                }, true); // Immediate save

                // ✅ Update UI using centralized DOM sync with captured state
                const syncAllTasksWithMode = self.deps.syncAllTasksWithMode;
                if (updatedCycle?.tasks && typeof syncAllTasksWithMode === 'function') {
                    // Create task data map for batch sync
                    const tasksDataMap = {};
                    updatedCycle.tasks.forEach(task => {
                        tasksDataMap[task.id] = task;
                    });

                    console.log(`🔄 Mode switch: Syncing ${Object.keys(tasksDataMap).length} tasks to ${currentMode} mode`);

                    // Sync immediately AND after a small delay to catch any late DOM updates
                    syncAllTasksWithMode(currentMode, tasksDataMap, {
                        DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
                    });

                    // Second sync after delay to catch any stragglers
                    setTimeout(() => {
                        syncAllTasksWithMode(currentMode, tasksDataMap, {
                            DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
                        });
                    }, 100);
                } else if (typeof syncAllTasksWithMode !== 'function') {
                    console.error('❌ syncAllTasksWithMode not available - GlobalUtils may not be loaded');
                } else if (!updatedCycle?.tasks) {
                    console.warn('⚠️ No tasks to sync');
                }
            }

            // ✅ Update recurring button visibility in real-time
            self.deps.updateRecurringButtonVisibility();

            // ✅ FIX: Refresh task buttons to show/hide delete-when-complete button
            // syncAllTasksWithMode only updates EXISTING buttons - it doesn't create them
            // This re-renders task buttons so the delete-when-complete button appears
            self.refreshTaskButtonsForModeChange();

            console.log('✅ Delete checked tasks setting saved (Schema 2.5)');
        };
        safeAdd(deleteCheckedTasks, "change", deleteCheckedTasks._deleteCheckedTasksModeHandler);
    }

    /**
     * Validate and enforce mode settings on app resume
     * Checks if DOM toggles match AppState and fixes any discrepancies
     * This is a safety net to catch stale state issues
     */
    validateModeEnforcement() {
        console.log('🔍 ModeManager: Validating mode enforcement...');

        const AppState = this.deps.AppState;
        if (!AppState?.isReady?.()) {
            console.log('⏳ ModeManager: AppState not ready for validation');
            return;
        }

        const currentState = AppState.get();
        if (!currentState) {
            console.warn('⚠️ ModeManager: No state data for validation');
            return;
        }

        const { data, appState } = currentState;
        const activeCycle = appState?.activeCycleId;
        const currentCycle = activeCycle ? data?.cycles?.[activeCycle] : null;

        if (!currentCycle) {
            console.warn('⚠️ ModeManager: No active cycle for validation');
            return;
        }

        // Get DOM elements
        const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
        const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);
        const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);

        if (!toggleAutoReset || !deleteCheckedTasks) {
            console.warn('⚠️ ModeManager: Toggle elements not found for validation');
            return;
        }

        // Get expected values from AppState (source of truth)
        const expectedAutoReset = currentCycle.autoReset || false;
        const expectedDeleteChecked = currentCycle.deleteCheckedTasks || false;

        // Get current DOM values
        const domAutoReset = toggleAutoReset.checked;
        const domDeleteChecked = deleteCheckedTasks.checked;

        // Check for mismatches
        const autoResetMismatch = domAutoReset !== expectedAutoReset;
        const deleteCheckedMismatch = domDeleteChecked !== expectedDeleteChecked;

        if (autoResetMismatch || deleteCheckedMismatch) {
            console.warn('⚠️ ModeManager: Mode mismatch detected!', {
                expected: { autoReset: expectedAutoReset, deleteChecked: expectedDeleteChecked },
                dom: { autoReset: domAutoReset, deleteChecked: domDeleteChecked }
            });

            // Fix DOM to match AppState
            toggleAutoReset.checked = expectedAutoReset;
            deleteCheckedTasks.checked = expectedDeleteChecked;

            // Determine correct mode
            let correctMode = 'auto-cycle';
            if (expectedDeleteChecked) {
                correctMode = 'todo-mode';
            } else if (!expectedAutoReset) {
                correctMode = 'manual-cycle';
            }

            // Update mode selector
            if (modeSelector) modeSelector.value = correctMode;

            // Update body class
            document.body.className = document.body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
            document.body.classList.add(correctMode + '-mode');

            console.log('✅ ModeManager: Mode enforcement corrected to:', correctMode);

            // Refresh UI to reflect correct mode
            this.refreshTaskButtonsForModeChange();
        } else {
            console.log('✅ ModeManager: Mode enforcement validated - no issues');
        }
    }

    /**
     * Setup visibility change listener for mode validation
     * Validates mode enforcement when user returns to the app
     */
    setupVisibilityChangeListener() {
        // ✅ FIX: Idempotency guard to prevent duplicate listeners
        if (this._visibilityListenerInitialized) {
            console.log('✅ ModeManager: Visibility listener already set up');
            return;
        }
        this._visibilityListenerInitialized = true;

        console.log('👁️ ModeManager: Setting up visibility change listener...');

        // Store reference for potential cleanup
        this._visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                console.log('👁️ ModeManager: App became visible - validating mode...');
                // Small delay to ensure app state is fully restored
                setTimeout(() => {
                    this.validateModeEnforcement();
                    // Check if auto-reset should trigger (all tasks completed in auto-cycle mode)
                    if (typeof this.deps.checkMiniCycle === 'function') {
                        this.deps.checkMiniCycle();
                    }
                }, 100);
            }
        };

        document.addEventListener('visibilitychange', this._visibilityHandler);
        console.log('✅ ModeManager: Visibility change listener registered');
    }

    /**
     * Fallback for safeAddEventListener
     */
    fallbackAddListener(element, event, handler, options) {
        if (element) {
            element.removeEventListener(event, handler, options);
            element.addEventListener(event, handler, options);
        }
    }
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🎯 ModeManager module loaded (DI-pure, no window.* exports)');

/**
 * Initialize and configure the mode manager
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<ModeManager>} Initialized mode manager instance
 */
export async function initModeManager(dependencies = {}) {
    console.log('🎯 Initializing Mode Manager module...');

    const manager = new ModeManager(dependencies);
    await manager.init();

    console.log('✅ Mode Manager initialized');

    return manager;
}
