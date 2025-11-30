/**
 * Mode Manager - Manages Auto Cycle, Manual Cycle, and To-Do Mode
 * @module modules/cycle/modeManager
 * @version 1.284
 * @pattern Resilient Constructor 🛡️
 *
 * Handles three cycling modes:
 * - Auto Cycle ↻: Tasks auto-reset when all completed
 * - Manual Cycle ✔︎↻: Tasks reset only on manual button click
 * - To-Do Mode ✓: Tasks are deleted instead of reset
 *
 * Mode changes refresh UI in-place without page reload.
 */

import { appInit } from '../core/appInit.js';

// Module-level deps for late injection
let _deps = {};

/**
 * Set dependencies for ModeManager (call before creating instance)
 * @param {Object} dependencies - { getAppState, showNotification, etc. }
 */
export function setModeManagerDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('🎯 ModeManager dependencies set:', Object.keys(dependencies));
}

export class ModeManager {
    constructor(dependencies = {}) {
        console.log('🎯 ModeManager: Constructing with dependencies');

        // Merge injected deps with constructor deps (constructor takes precedence)
        const mergedDeps = { ..._deps, ...dependencies };

        // Store dependencies - no window.* fallbacks
        this.deps = {
            getAppState: mergedDeps.getAppState || null,
            loadMiniCycleData: mergedDeps.loadMiniCycleData,
            createTaskButtonContainer: mergedDeps.createTaskButtonContainer,
            setupDueDateButtonInteraction: mergedDeps.setupDueDateButtonInteraction,
            checkCompleteAllButton: mergedDeps.checkCompleteAllButton,
            showNotification: mergedDeps.showNotification,
            helpWindowManager: mergedDeps.helpWindowManager,
            getElementById: mergedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: mergedDeps.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Debounce timer for refresh operations
        this.refreshDebounceTimer = null;

        this.isInitialized = false;
    }

    /**
     * Initialize mode manager
     * Waits for core systems to be ready, then sets up mode selector with delay
     */
    async init() {
        console.log('🎯 ModeManager: Initializing...');

        // Wait for core systems to be ready
        await appInit.waitForCore();

        console.log('⏰ ModeManager: Initializing mode selector with 200ms delay...');
        setTimeout(() => {
            console.log('⏰ ModeManager: Delay complete, calling setupModeSelector...');
            this.setupModeSelector();
        }, 200);

        this.isInitialized = true;
        console.log('✅ ModeManager: Initialized');
    }

    /**
     * Get friendly name for a mode
     * @param {string} mode - Mode identifier (auto-cycle, manual-cycle, todo-mode)
     * @returns {string} Friendly mode name with icon
     */
    getModeName(mode) {
        const modeNames = {
            'auto-cycle': 'Auto Cycle ↻',
            'manual-cycle': 'Manual Cycle ✔︎↻',
            'todo-mode': 'To-Do Mode ✓'
        };

        const result = modeNames[mode] || 'Auto Cycle ↻';
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
            await appInit.waitForCore();

            const tasks = this.deps.querySelectorAll('.task');
            if (tasks.length === 0) {
                console.log('⚠️ ModeManager: No tasks found to refresh');
                return;
            }

        // Track failures for summary logging
        let failureCount = 0;
        let successCount = 0;

        // Get current mode settings
        const toggleAutoReset = this.deps.getElementById('toggleAutoReset');
        const deleteCheckedTasks = this.deps.getElementById('deleteCheckedTasks');
        const autoResetEnabled = toggleAutoReset?.checked || false;
        const deleteCheckedEnabled = deleteCheckedTasks?.checked || false;

        console.log('🔍 ModeManager: Current mode settings:', { autoResetEnabled, deleteCheckedEnabled });

        // Get settings for button visibility
        const AppState = this.deps.getAppState();
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
            const oldButtonContainer = task.querySelector('.task-options');

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
                remindersEnabled: task.querySelector('.enable-task-reminders')?.classList.contains('reminder-active') || false,
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
            const wasVisible = oldButtonContainer.style.visibility === 'visible' || oldButtonContainer.style.opacity === '1';
            if (wasVisible) {
                newButtonContainer.style.visibility = 'visible';
                newButtonContainer.style.opacity = '1';
            }

            // Replace old container with new one
            oldButtonContainer.replaceWith(newButtonContainer);

            // ✅ CRITICAL: Attach due date button listener to newly created buttons
            const dueDateInput = task.querySelector('.due-date');
            if (dueDateInput && this.deps.setupDueDateButtonInteraction) {
                // Remove the guard flag first to allow re-attaching
                const dueDateButton = newButtonContainer.querySelector('.set-due-date');
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
        await appInit.waitForCore();

        const AppState = this.deps.getAppState();
        const currentState = AppState?.get();
        if (!currentState) {
            console.error('❌ ModeManager: No state data available for syncModeFromToggles');
            return;
        }

        const { data, appState } = currentState;
        const activeCycle = appState.activeCycleId;
        const currentCycle = data.cycles[activeCycle];

        const toggleAutoReset = this.deps.getElementById('toggleAutoReset');
        const deleteCheckedTasks = this.deps.getElementById('deleteCheckedTasks');
        const modeSelector = this.deps.getElementById('mode-selector');
        const mobileModeSelector = this.deps.getElementById('mobile-mode-selector');

        if (!toggleAutoReset || !deleteCheckedTasks || !modeSelector || !mobileModeSelector) {
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

        console.log('📝 ModeManager: Setting both selectors to:', mode);

        // Update both selectors
        modeSelector.value = mode;
        mobileModeSelector.value = mode;

        // Update body classes
        document.body.className = document.body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
        document.body.classList.add(mode + '-mode');

        // ✅ FIXED: Update container visibility based on mode, not just autoReset
        const deleteContainer = this.deps.getElementById('deleteCheckedTasksContainer');
        const autoResetContainer = this.deps.getElementById('autoResetContainer');

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
        await appInit.waitForCore();

        const AppState = this.deps.getAppState();
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

        const toggleAutoReset = this.deps.getElementById('toggleAutoReset');
        const deleteCheckedTasks = this.deps.getElementById('deleteCheckedTasks');

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
        await appInit.waitForCore();

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

        const descriptionBox = this.deps.getElementById("mode-description");
        if (!descriptionBox) {
            console.warn('⚠️ ModeManager: Mode description box not found');
            return;
        }

        let modeTitle = "";
        let modeDetail = "";
        let currentMode = "";

        if (deleteChecked) {
            currentMode = "todo-mode";
            modeTitle = "To-Do List Mode";
            modeDetail = `This mode will not complete any cycles.<br>
        Instead, it will delete all tasks when <br> you hit the complete button.<br>
        This will reveal a recurring option in the <br> task options menu.`;
        } else if (autoReset) {
            currentMode = "auto-cycle";
            modeTitle = "Auto Cycle Mode";
            modeDetail = `Tasks will automatically reset when<br>all are completed. This is the traditional<br>miniCycle experience.`;
        } else {
            currentMode = "manual-cycle";
            modeTitle = "Manual Cycle Mode";
            modeDetail = `Tasks will only reset when you<br>manually click the complete button.<br>Gives you more control over timing.`;
        }

        descriptionBox.innerHTML = `<strong>${modeTitle}:</strong><br>${modeDetail}`;

        console.log('✅ ModeManager: Mode description updated:', currentMode);
    }

    /**
     * Set up mode selector UI and event listeners
     * Main setup function that configures all mode-related UI elements
     */
    async setupModeSelector() {
        console.log('🎯 ModeManager: Setting up mode selectors (state-based)...');

        // Wait for core
        await appInit.waitForCore();

        const modeSelector = this.deps.getElementById('mode-selector');
        const mobileModeSelector = this.deps.getElementById('mobile-mode-selector');
        const toggleAutoReset = this.deps.getElementById('toggleAutoReset');
        const deleteCheckedTasks = this.deps.getElementById('deleteCheckedTasks');

        console.log('🔍 ModeManager: Element detection:', {
            modeSelector: !!modeSelector,
            mobileModeSelector: !!mobileModeSelector,
            toggleAutoReset: !!toggleAutoReset,
            deleteCheckedTasks: !!deleteCheckedTasks
        });

        if (!modeSelector || !mobileModeSelector || !toggleAutoReset || !deleteCheckedTasks) {
            console.warn('⚠️ ModeManager: Mode selector elements not found');
            return;
        }

        // ✅ Function to sync toggles from either selector (NESTED FUNCTION - stays inside)
        const syncTogglesFromMode = (selectedMode) => {
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

            // Keep both selectors in sync
            modeSelector.value = selectedMode;
            mobileModeSelector.value = selectedMode;

            // ✅ UPDATE STORAGE FIRST before dispatching events
            this.updateStorageFromToggles();

            // ✅ THEN trigger change events (but prevent them from updating storage again)
            console.log('🔔 ModeManager: Dispatching change events to update storage...');
            toggleAutoReset.dispatchEvent(new Event('change'));
            deleteCheckedTasks.dispatchEvent(new Event('change'));

            // Update UI
            this.syncModeFromToggles();

            // Check complete all button
            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Update recurring button visibility via module
            if (window.recurringCore?.updateRecurringButtonVisibility) {
                window.recurringCore.updateRecurringButtonVisibility();
            }

            // ✅ Show mode description in help window
            const helpMgr = this.deps.helpWindowManager?.();
            if (helpMgr && typeof helpMgr.showModeDescription === 'function') {
                helpMgr.showModeDescription(selectedMode);
            }

            console.log('✅ ModeManager: Toggles synced from mode selector');
        };

        // ✅ Set up event listeners for both selectors
        console.log('📡 ModeManager: Setting up event listeners for both selectors...');

        modeSelector.addEventListener('change', (e) => {
            console.log('🎯 ModeManager: Desktop mode selector changed:', e.target.value);
            syncTogglesFromMode(e.target.value);
            this.updateCycleModeDescription();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to apply mode-specific button visibility
            this.refreshTaskButtonsForModeChange();

            // ✅ Update recurring button visibility for mode change
            if (window.recurringCore?.updateRecurringButtonVisibility) {
                console.log('🔁 ModeManager: Updating recurring button visibility for mode change...');
                setTimeout(() => {
                    window.recurringCore.updateRecurringButtonVisibility();
                    console.log('🔁 ModeManager: Recurring button visibility update completed');
                }, 100);
            }

            if (this.deps.showNotification) {
                this.deps.showNotification(`Switched to ${this.getModeName(e.target.value)}`, 'success', 2000);
            }

            console.log('✅ ModeManager: Mode change applied without reload');
        });

        mobileModeSelector.addEventListener('change', (e) => {
            console.log('📱 ModeManager: Mobile mode selector changed:', e.target.value);
            syncTogglesFromMode(e.target.value);
            this.updateCycleModeDescription();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to apply mode-specific button visibility
            this.refreshTaskButtonsForModeChange();

            // ✅ Update recurring button visibility for mode change
            if (window.recurringCore?.updateRecurringButtonVisibility) {
                console.log('🔁 ModeManager: Updating recurring button visibility for mode change...');
                setTimeout(() => {
                    window.recurringCore.updateRecurringButtonVisibility();
                    console.log('🔁 ModeManager: Recurring button visibility update completed');
                }, 100);
            }

            if (this.deps.showNotification) {
                this.deps.showNotification(`Switched to ${this.getModeName(e.target.value)}`, 'success', 2000);
            }

            console.log('✅ ModeManager: Mode change applied without reload');
        });

        toggleAutoReset.addEventListener('change', (e) => {
            console.log('🔘 ModeManager: Auto Reset toggle changed:', e.target.checked);
            this.syncModeFromToggles();
            this.updateCycleModeDescription();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to show/hide buttons based on new mode
            this.refreshTaskButtonsForModeChange();
        });

        deleteCheckedTasks.addEventListener('change', (e) => {
            console.log('🗑️ ModeManager: Delete Checked Tasks toggle changed:', e.target.checked);
            this.syncModeFromToggles();
            this.updateCycleModeDescription();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to show/hide recurring button based on new mode
            this.refreshTaskButtonsForModeChange();

            // ✅ Update recurring button visibility when switching to/from to-do mode
            if (window.recurringCore?.updateRecurringButtonVisibility) {
                console.log('🔁 ModeManager: Updating recurring button visibility for mode change...');
                setTimeout(() => {
                    window.recurringCore.updateRecurringButtonVisibility();
                    console.log('🔁 ModeManager: Recurring button visibility update completed');
                }, 100); // Small delay to ensure DOM updates complete
            }
        });

        // ✅ Initialize on load
        console.log('🚀 ModeManager: Initializing mode selectors...');
        this.syncModeFromToggles();

        // ✅ Check if we need to restore mode after reload
        const modeToRestore = sessionStorage.getItem('restoreModeAfterReload');
        if (modeToRestore) {
            console.log('🔄 ModeManager: Restoring mode after reload:', modeToRestore);
            sessionStorage.removeItem('restoreModeAfterReload');

            // Small delay to ensure DOM is ready
            setTimeout(() => {
                modeSelector.value = modeToRestore;
                mobileModeSelector.value = modeToRestore;
                this.syncModeFromToggles();
                this.updateCycleModeDescription();

                if (this.deps.showNotification) {
                    this.deps.showNotification(`✅ Switched to ${this.getModeName(modeToRestore)}`, 'success', 3000);
                }
            }, 500);
        }

        console.log('✅ ModeManager: Mode selectors setup complete');
    }
}

// Phase 2 Step 6 - Clean exports (no window.* pollution)
console.log('🎯 ModeManager module loaded (Phase 2 - no window.* exports)');

/**
 * Initialize and configure the mode manager
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<ModeManager>} Initialized mode manager instance
 */
export async function initModeManager(dependencies = {}) {
    console.log('🎯 Initializing Mode Manager module...');

    const manager = new ModeManager(dependencies);
    await manager.init();

    // Export globally for backward compatibility
    window.modeManager = manager;
    window.initializeModeSelector = () => manager.init();
    window.setupModeSelector = () => manager.setupModeSelector();
    window.syncModeFromToggles = () => manager.syncModeFromToggles();
    window.updateStorageFromToggles = () => manager.updateStorageFromToggles();
    window.refreshTaskButtonsForModeChange = () => manager.refreshTaskButtonsForModeChange();
    window.updateCycleModeDescription = () => manager.updateCycleModeDescription();
    window.getModeName = (mode) => manager.getModeName(mode);

    console.log('✅ Mode Manager initialized and exported globally');

    return manager;
}
