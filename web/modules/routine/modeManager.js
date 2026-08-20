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
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { syncTaskDeleteWhenComplete } from '../utils/cycleMode.js';

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
    getBody: optional(() => document.body),
    safeAddEventListener: optional(null),
    checkMiniCycle: optional(() => {}),
    captureStateSnapshot: optional(null),  // Gesture-boundary undo snapshot before a mode switch triggers auto-reset
    isPerformingUndoRedo: optional(() => false),
    refreshTaskListUI: optional(null),
    updateRecurringButtonVisibility: optional(() => {}),
    syncAllTasksWithMode: optional(null),
    switchMiniCycle: optional(null),
    createNewMiniCycle: optional(null),
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: optional({ cycle: false, todo: true }),
    // Used by the + button items (Add Task / Create New Routine) to flip back
    // to task view when invoked from stats view, so the user lands where they
    // can act on the action they just took.
    showTaskView: optional(null),
    statsPanelManager: optional(null)
});

/**
 * Set dependencies for ModeManager (call before creating instance)
 * @param {Object} dependencies - { AppState, showNotification, etc. }
 */
export function setModeManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Manages app mode switching (cycle/todo) and mode-specific UI behavior
 */
export class ModeManager {
    constructor(_dependencies = {}) {
        // Dependencies arg accepted for API parity but ignored — instance reads
        // from the live `di.resolve()` via the `deps` getter below.
        this.refreshDebounceTimer = null;
        this._initialized = false;
        // Set while syncTogglesFromMode() is driving the toggles programmatically.
        // See _refreshModeHelp() for why the toggle handlers must stand down then.
        this._syncingTogglesFromMode = false;
    }

    /**
     * Late-binding dependency accessor — returns the live `di.resolve()` so any
     * dep declared in the manifest is reachable via this.deps.X. Matches the
     * standard pattern used across the rest of the codebase (dailyResetManager,
     * dueDates, etc.). Cheap: di.resolve() is cached when called without overrides.
     */
    get deps() {
        return di.resolve();
    }

    /**
     * Capture a gesture-boundary undo snapshot, then invoke checkMiniCycle.
     * Switching to auto-cycle can trigger a reset (all tasks already complete);
     * the reset executor no longer captures (v2.362), so the mode-switch gesture
     * must take its own snapshot at this boundary — otherwise the reset it
     * triggers would land in undo history with nothing to revert it. The
     * snapshot represents pre-reset state (tasks complete), which is exactly
     * the correct Undo target.
     * @private
     */
    _checkCycleWithSnapshot() {
        const { captureStateSnapshot, isPerformingUndoRedo, AppState, checkMiniCycle } = this.deps;
        if (typeof captureStateSnapshot === 'function' && !(isPerformingUndoRedo?.() ?? false)) {
            const state = AppState?.get?.();
            if (state) captureStateSnapshot(state);
        }
        if (typeof checkMiniCycle === 'function') checkMiniCycle();
    }

    /**
     * Initialize mode manager
     * Waits for core systems to be ready, then sets up mode selector with delay
     */
    async init() {

        // Wait for core systems to be ready
        await this.deps.appInit?.waitForCore();

        setTimeout(() => {
            this.setupModeSelector();
            // ✅ Also set up the mode listener that syncs visual indicators
            this.setupDeleteCheckedTasksModeListener();
        }, 200);

        // ✅ Setup visibility change listener for mode validation on app resume
        this.setupVisibilityChangeListener();

        this._initialized = true;
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

            // Wait for core if needed
            await this.deps.appInit?.waitForCore();

            const tasks = this.deps.querySelectorAll(DOM_SELECTORS.TASK);
            if (tasks.length === 0) {
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
                remindersEnabled: task.querySelector(DOM_SELECTORS.ENABLE_TASK_REMINDERS)?.classList.contains(DOM_CLASSES.REMINDER_ACTIVE) || false,
                remindersEnabledGlobal,
                assignedTaskId: taskId,
                currentCycle, // ✅ Required for recurring button handler
                activeCycle: activeCycleId, // ✅ Also include activeCycleId
                recurring: task.classList.contains(DOM_CLASSES.RECURRING),
                highPriority: task.classList.contains(DOM_CLASSES.HIGH_PRIORITY)
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
            const wasVisible = oldButtonContainer.classList.contains(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
            if (wasVisible) {
                newButtonContainer.classList.add(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
                newButtonContainer.classList.remove(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
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
            }

            successCount++;
        });

            // Summary logging instead of per-task spam
            if (successCount > 0) {

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
                }
            } else if (tasks.length > 0) {
                // Only log if there were tasks but none had buttons yet (initial load)
            }
        }, 150); // 150ms debounce delay - prevents multiple rapid reflows
    }

    /**
     * Show the current mode's help description, the same way a mode-selector
     * switch does.
     *
     * The selector is not the only way to change mode — the settings toggles are
     * a second path, and they used to leave the help window alone entirely. That
     * matters more than a missing description, because showModeDescription()
     * holds `isShowingModeDescription` for 30 seconds and updateConstantMessage()
     * early-returns for that whole time: switch mode by selector, then switch
     * again by toggle inside 30s, and the window kept showing the FIRST mode's
     * description. Measured: the selector path itself is not stale — help,
     * body class and selector value all land in the same animation frame.
     *
     * Reads the mode from the selector rather than recomputing it: syncModeFromToggles()
     * has already written the canonical mode there, so this cannot disagree with
     * the rest of the UI.
     *
     * Callers must skip this when syncTogglesFromMode() is driving. That function
     * flips the two toggles one at a time and each flip fires the toggle handler,
     * so unguarded a single selector switch renders up to three descriptions —
     * including the transient mode the half-applied toggles spell out (auto →
     * to-do passes through manual-cycle). It calls showModeDescription() itself
     * once the toggles agree.
     * @returns {void}
     */
    _refreshModeHelp() {
        const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
        if (!modeSelector) return;

        const helpMgr = this.deps.helpWindowManager?.();
        if (helpMgr && typeof helpMgr.showModeDescription === 'function') {
            helpMgr.showModeDescription(modeSelector.value);
        }
    }

    /**
     * Sync mode from toggle states
     * Updates mode selector and UI based on current toggle settings
     */
    async syncModeFromToggles() {

        // Wait for core
        await this.deps.appInit?.waitForCore();

        const AppState = this.deps.AppState;
        const currentState = AppState?.get();
        if (!currentState) {
            // ✅ Normal during Phase 2 - data loads in Phase 3, syncModeFromToggles will be called again
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

            // ✅ CRITICAL FIX: Update DOM to match data
            toggleAutoReset.checked = autoReset;
            deleteCheckedTasks.checked = deleteChecked;

            // Sync task input bar visibility with routine's saved preference
            if (this._updateTaskInputVisibility) {
                this._updateTaskInputVisibility(currentCycle.showTaskInput === true);
            }
        } else {
            // ✅ Normal during Phase 2 - data loads in Phase 3
            // ✅ Fallback to DOM state only if no saved data exists
            autoReset = toggleAutoReset.checked;
            deleteChecked = deleteCheckedTasks.checked;
        }

        let mode = 'auto-cycle';

        // ✅ FIXED: Check deleteChecked FIRST before other conditions
        if (deleteChecked) {
            mode = 'todo-mode';
        } else if (autoReset && !deleteChecked) {
            mode = 'auto-cycle';
        } else if (!autoReset && !deleteChecked) {
            mode = 'manual-cycle';
        }

        // Update selector
        modeSelector.value = mode;

        // Update body classes
        const body = this.deps.getBody();
        body.className = body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
        body.classList.add(mode + '-mode');

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

    }

    /**
     * Point every task's active `deleteWhenComplete` at the given mode's stored
     * setting. Call this INSIDE an AppState producer — it mutates `cycle` in place.
     *
     * `deleteWhenComplete` is derived (`deleteWhenCompleteSettings[mode]`), so it
     * must move in the SAME transaction as `cycle.deleteCheckedTasks`. When the two
     * were split across separate writes, one mode switch produced two undo steps,
     * and the first Undo left To-Do mode showing while every task carried the
     * cycle-mode value.
     *
     * Idempotent: re-running for the mode already in effect changes nothing, so
     * callers that only touched the autoReset toggle pay no cost.
     *
     * @param {Object} cycle - the cycle draft from inside the producer
     * @param {'cycle'|'todo'} currentMode
     */
    syncTasksToMode(cycle, currentMode) {
        if (!cycle?.tasks) return;
        const DEFAULTS = this.deps.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS;
        // Per-key repair + re-derive lives in utils/cycleMode.js — routineLoader and
        // taskButtons need the identical semantics on load and on un-recurring.
        cycle.tasks.forEach(task => {
            syncTaskDeleteWhenComplete(task, currentMode, DEFAULTS);
        });
    }

    /**
     * True when `cycle` already carries this exact mode transition — the flag and
     * every task's derived value. Used to skip a redundant persist+notify when the
     * mode-selector path has already written the same transition.
     *
     * @param {Object} cycle          the live cycle (read-only here)
     * @param {boolean} isToDoMode    the mode being applied
     * @param {'cycle'|'todo'} currentMode
     * @returns {boolean}
     */
    isModeAlreadyApplied(cycle, isToDoMode, currentMode) {
        if (!cycle || cycle.deleteCheckedTasks !== isToDoMode) return false;
        return (cycle.tasks || []).every(task => {
            const stored = task.deleteWhenCompleteSettings;
            if (!stored || typeof stored !== 'object') return false;
            if (typeof stored[currentMode] !== 'boolean') return false;
            return !!task.deleteWhenComplete === stored[currentMode];
        });
    }

    /**
     * Update storage from toggle states
     * Persists current toggle states to AppState
     */
    async updateStorageFromToggles() {

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

        // ✅ Update through state system — mode flags AND the per-task values they
        // derive, in ONE producer, so the whole switch is a single undo step.
        AppState.update(state => {
            const cycle = state.data.cycles[activeCycle];
            if (cycle) {
                cycle.autoReset = toggleAutoReset.checked;
                cycle.deleteCheckedTasks = deleteCheckedTasks.checked;
                this.syncTasksToMode(cycle, deleteCheckedTasks.checked ? 'todo' : 'cycle');
            }
        }, true); // immediate save

    }

    /**
     * Update cycle mode description text
     * Updates the mode description box with current mode information
     */
    async updateCycleModeDescription() {

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

        // Built with createElement/textContent, not innerHTML: every mode.*Title/
        // *Detail key used here is in LENS_SENSITIVE_KEYS, so vocabulary themes
        // can override this text. Theme content is hardcoded today, but if themes
        // ever become shareable/importable (like .mcyc routines), an interpolated
        // innerHTML here would turn imported theme text into an XSS sink. Inert
        // construction now means that roadmap item can't create one.
        descriptionBox.textContent = '';
        const modeTitleEl = document.createElement('strong');
        modeTitleEl.textContent = `${modeTitle}:`;
        descriptionBox.append(modeTitleEl, document.createElement('br'), modeDetail);

        // Sync the mode-radio-group's checked state with the current mode
        // so the radios reflect mode changes from any source (header dropdown,
        // focus-mode modal, or this radio group itself).
        const radios = document.querySelectorAll(DOM_SELECTORS.MODE_RADIO);
        radios.forEach(radio => {
            radio.checked = (radio.value === currentMode);
        });

        // Update the mode badge on the toggle button (visible when collapsed)
        const toggleBtn = this.deps.getElementById(DOM_IDS.MODE_DESCRIPTION_TOGGLE);
        if (toggleBtn) {
            const badge = toggleBtn.querySelector('.mode-badge');
            if (badge) {
                badge.textContent = this.getModeName(currentMode);
            }
        }

    }

    /**
     * Set up mode selector UI and event listeners
     * Main setup function that configures all mode-related UI elements
     */
    async setupModeSelector() {
        // ✅ Guard against duplicate setup - prevents double notifications
        if (this._modeSelectorSetupComplete) {
            return;
        }

        // Wait for core
        await this.deps.appInit?.waitForCore();

        const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
        const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
        const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);

        if (!modeSelector || !toggleAutoReset || !deleteCheckedTasks) {
            console.warn('⚠️ ModeManager: Mode selector elements not found');
            return;
        }

        // Mark setup as complete
        this._modeSelectorSetupComplete = true;

        // ✅ Function to sync toggles from either selector (NESTED FUNCTION - stays inside)
        // ✅ FIXED: Made async to properly await storage update before UI sync
        const syncTogglesFromMode = async (selectedMode) => {
            // Hold off the toggle handlers' own help refresh until the toggles
            // agree — see _refreshModeHelp(). try/finally so an await that
            // rejects can't strand the flag and mute the toggle path for good.
            this._syncingTogglesFromMode = true;
            try {

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

            } finally {
                this._syncingTogglesFromMode = false;
            }

            // ✅ Show mode description in help window
            const helpMgr = this.deps.helpWindowManager?.();
            if (helpMgr && typeof helpMgr.showModeDescription === 'function') {
                helpMgr.showModeDescription(selectedMode);
            }

        };

        // ✅ Set up event listeners for both selectors using safeAddEventListener
        const safeAdd = this.deps.safeAddEventListener;

        modeSelector._changeHandler = async (e) => {
            await syncTogglesFromMode(e.target.value);
            this.updateCycleModeDescription();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to apply mode-specific button visibility
            this.refreshTaskButtonsForModeChange();

            // ✅ Update recurring button visibility for mode change (DI-pure)
            if (this.deps.recurringCore?.updateRecurringButtonVisibility) {
                setTimeout(() => {
                    this.deps.recurringCore.updateRecurringButtonVisibility();
                }, 100);
            }

            // ✅ If switching to auto-cycle mode, check if cycle should complete
            if (e.target.value === 'auto-cycle' && this.deps.checkMiniCycle) {
                setTimeout(() => {
                    this._checkCycleWithSnapshot();
                }, 150); // Small delay to ensure UI is updated first
            }

            if (this.deps.showNotification) {
                this.deps.showNotification(getLabel('notify.modeSwitched', { vars: { mode: this.getModeName(e.target.value) } }), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
            }

        };
        safeAdd(modeSelector, 'change', modeSelector._changeHandler);

        // Allow Enter key to open the mode selector dropdown
        safeAdd(modeSelector, 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                modeSelector.showPicker?.();
            }
        });

        toggleAutoReset._modeChangeHandler = async (e) => {
            // Read the guard NOW, not after the await. dispatchEvent runs this
            // handler synchronously only as far as its first await; by the time
            // it resumes, syncTogglesFromMode()'s finally has already cleared the
            // flag, so checking it later would always say "not driving".
            const drivenBySelector = this._syncingTogglesFromMode;

            // Awaited: syncModeFromToggles() is what writes the canonical mode to
            // the selector, and _refreshModeHelp() reads it back from there.
            await this.syncModeFromToggles();
            this.updateCycleModeDescription();
            if (!drivenBySelector) this._refreshModeHelp();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to show/hide buttons based on new mode
            this.refreshTaskButtonsForModeChange();
        };
        safeAdd(toggleAutoReset, 'change', toggleAutoReset._modeChangeHandler);

        deleteCheckedTasks._modeChangeHandler = async (e) => {
            // Guard captured synchronously — see the toggleAutoReset handler above.
            const drivenBySelector = this._syncingTogglesFromMode;

            await this.syncModeFromToggles();
            this.updateCycleModeDescription();
            if (!drivenBySelector) this._refreshModeHelp();

            if (this.deps.checkCompleteAllButton) {
                this.deps.checkCompleteAllButton();
            }

            // ✅ Refresh task buttons to show/hide recurring button based on new mode
            this.refreshTaskButtonsForModeChange();

            // ✅ Update recurring button visibility when switching to/from to-do mode (DI-pure)
            if (this.deps.recurringCore?.updateRecurringButtonVisibility) {
                setTimeout(() => {
                    this.deps.recurringCore.updateRecurringButtonVisibility();
                }, 100); // Small delay to ensure DOM updates complete
            }
        };
        safeAdd(deleteCheckedTasks, 'change', deleteCheckedTasks._modeChangeHandler);

        // ✅ Mode sync happens via routineLoader when data is loaded (Phase 3)
        // No need to call syncModeFromToggles() here - data doesn't exist yet

        // ✅ Check if we need to restore mode after reload
        const modeToRestore = sessionStorage.getItem('restoreModeAfterReload');
        if (modeToRestore) {
            sessionStorage.removeItem('restoreModeAfterReload');

            // Small delay to ensure DOM is ready
            setTimeout(() => {
                const freshModeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
                if (freshModeSelector) freshModeSelector.value = modeToRestore;
                this.syncModeFromToggles();
                this.updateCycleModeDescription();

                if (this.deps.showNotification) {
                    this.deps.showNotification(getLabel('notify.modeSwitched', { vars: { mode: this.getModeName(modeToRestore) } }), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
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

        // ✅ Setup mode radio group (horizontal switcher under description)
        this.setupModeRadioGroup();

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
        // Default-collapsed across all viewports — Mode Info takes vertical
        // space that pushes the "Enter Focus View" primary action down. On
        // mobile the menu is already taller (Quick Actions panel adds ~120px)
        // so compaction matters more there, not less. Saved preference still
        // wins, so users who actively switch modes can expand it once and
        // their choice persists.
        const savedCollapsed = currentState?.settings?.modeDescriptionCollapsed;
        const isCollapsed = savedCollapsed ?? true;

        // Apply initial state
        if (isCollapsed) {
            modeDescription.classList.add(DOM_CLASSES.COLLAPSED);
            toggleBtn.setAttribute('aria-expanded', 'false');
        } else {
            modeDescription.classList.remove(DOM_CLASSES.COLLAPSED);
            toggleBtn.setAttribute('aria-expanded', 'true');
        }

        // ✅ Setup click handler
        this.deps.safeAddEventListener(toggleBtn, 'click', async () => {
            const currentlyCollapsed = modeDescription.classList.contains(DOM_CLASSES.COLLAPSED);
            const newCollapsed = !currentlyCollapsed;

            // Update UI
            if (newCollapsed) {
                modeDescription.classList.add(DOM_CLASSES.COLLAPSED);
                toggleBtn.setAttribute('aria-expanded', 'false');
            } else {
                modeDescription.classList.remove(DOM_CLASSES.COLLAPSED);
                toggleBtn.setAttribute('aria-expanded', 'true');
            }

            // ✅ Persist to AppState
            if (AppState?.isReady?.()) {
                await AppState.update(state => {
                    state.settings.modeDescriptionCollapsed = newCollapsed;
                });
            }
        });

    }

    /**
     * Setup the mode radio group inside #mode-description-wrapper.
     * Each radio's change drives the existing #mode-selector — same synthetic
     * event pattern used by the focus-mode mode-switch modal — so we don't
     * duplicate any mode-switch logic. Initial checked state is set by
     * updateCycleModeDescription() on its first run.
     */
    setupModeRadioGroup() {
        if (this._modeRadioGroupSetupComplete) return;

        const radios = document.querySelectorAll(DOM_SELECTORS.MODE_RADIO);
        if (radios.length === 0) {
            // The radio group HTML may not be present in older builds;
            // fail soft so this doesn't break mode functionality.
            return;
        }

        const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
        if (!modeSelector) {
            console.warn('⚠️ ModeManager: mode-selector not found — radio group will not switch modes');
            return;
        }

        const safeAdd = this.deps.safeAddEventListener;
        radios.forEach(radio => {
            const handler = () => {
                if (!radio.checked) return;
                if (modeSelector.value === radio.value) return;
                modeSelector.value = radio.value;
                modeSelector.dispatchEvent(new Event('change', { bubbles: true }));
            };
            if (safeAdd) {
                safeAdd(radio, 'change', handler);
            } else {
                radio.addEventListener('change', handler);
            }
        });

        this._modeRadioGroupSetupComplete = true;
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
            quickActionsBtn.classList.add(DOM_CLASSES.FIRST_TIME_SHIMMER);
            // Shimmer removal handled by:
            // 1. Click on + button (below in this function)
            // 2. Task input submit via Add button or Enter key (uiBoot.js attachTaskInputListeners)
        } else if (!currentState?.settings?.addTaskDiscovered && isReturningUser) {
            // Returning user without the flag — set it silently
            if (this.deps.AppState) {
                this.deps.AppState.update(state => {
                    if (!state.settings) state.settings = {};
                    state.settings.addTaskDiscovered = true;
                }, true);
            }
        }

        // Single source of truth for quick-actions-menu visibility.
        // Class-only (no inline style) so CSS controls display, plus a body
        // class so the page-level backdrop blur can react. Body class is the
        // PWA-reliable alternative to :has() — see CSS comment in menu.css.
        const setQuickActionsVisible = (visible) => {
            quickActionsMenu.classList.toggle(DOM_CLASSES.VISIBLE, visible);
            document.body.classList.toggle(DOM_CLASSES.QUICK_ACTIONS_OPEN, visible);
        };

        // Toggle menu on button click
        this.deps.safeAddEventListener(quickActionsBtn, 'click', (e) => {
            e.stopPropagation();
            const isVisible = quickActionsMenu.classList.contains(DOM_CLASSES.VISIBLE);
            setQuickActionsVisible(!isVisible);

            // Remove first-time shimmer on first click
            if (quickActionsBtn.classList.contains(DOM_CLASSES.FIRST_TIME_SHIMMER)) {
                quickActionsBtn.classList.remove(DOM_CLASSES.FIRST_TIME_SHIMMER);
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
                setQuickActionsVisible(false);
            }
        });

        // Expose closer for inline-action handlers below (toggle-task-input, create-routine)
        this._closeQuickActionsMenu = () => setQuickActionsVisible(false);

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
                taskInput.classList.toggle(DOM_CLASSES.HIDDEN, !isVisible);

                // Signal input-bar state to CSS so the empty-state hint can name
                // the affordance that actually works right now (see focus-mode.css).
                // This is the single choke point for bar visibility — init, the
                // toggle button, and per-cycle refresh all land here.
                this.deps.getBody()?.classList.toggle(DOM_CLASSES.INPUT_BAR_VISIBLE, isVisible);

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
                const currentVisible = !taskInput.classList.contains(DOM_CLASSES.HIDDEN);
                const newVisible = !currentVisible;

                // Update UI immediately
                this._updateTaskInputVisibility(newVisible);
                this._closeQuickActionsMenu?.();
                this._switchToTaskViewIfInStats();

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
                    // Focus mode hides the + button, so its variant of the
                    // notification points to the ⋯ menu instead.
                    const inFocusMode = document.body.classList.contains(DOM_CLASSES.FOCUS_MODE);
                    const labelKey = newVisible
                        ? (inFocusMode ? 'notify.taskInputShownFocus' : 'notify.taskInputShown')
                        : (inFocusMode ? 'notify.taskInputHiddenFocus' : 'notify.taskInputHidden');
                    this.deps.showNotification(
                        getLabel(labelKey),
                        'info',
                        UI_TIMEOUTS.NOTIFICATION_EXTENDED
                    );
                }
            });
        }

        // Create new routine
        if (createRoutineBtn) {
            this.deps.safeAddEventListener(createRoutineBtn, 'click', () => {
                this._closeQuickActionsMenu?.();
                this._switchToTaskViewIfInStats();

                if (this.deps.createNewMiniCycle) {
                    this.deps.createNewMiniCycle();
                } else {
                    console.warn('⚠️ ModeManager: createNewMiniCycle not available');
                    if (this.deps.showNotification) {
                        this.deps.showNotification(getLabel('notify.createRoutineUnavailable'), 'warning', UI_TIMEOUTS.NOTIFICATION_SHORT);
                    }
                }
            });
        }

    }

    /**
     * If the user is currently viewing the stats panel, swap back to the task
     * view. Used by the + button items so a user who triggers Add Task or
     * Create New Routine while in stats lands where the action will visibly
     * happen. No-op when already in task view (avoids redundant a11y announces).
     * @private
     */
    _switchToTaskViewIfInStats() {
        // depMappings exposes statsPanelManager as a nullary function that returns
        // the instance ("returns instance when called as function" — see moduleLoader.js).
        const manager = typeof this.deps.statsPanelManager === 'function'
            ? this.deps.statsPanelManager()
            : this.deps.statsPanelManager;
        const inStats = manager?.state?.isStatsVisible === true;
        if (inStats && typeof this.deps.showTaskView === 'function') {
            this.deps.showTaskView();
        }
    }

    /**
     * Setup toggle auto reset functionality
     * Handles auto-reset toggle, delete-checked-tasks toggle, and their event handlers
     */
    setupToggleAutoReset() {

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

        // ✅ Ensure AutoReset reflects the correct state from state system
        if (activeCycle && currentCycle) {
            toggleAutoReset.checked = currentCycle.autoReset || false;
            deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
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
                    }
                }
            }, true); // immediate save

            // ✅ Keep "Delete Checked Tasks" always hidden regardless of Auto Reset state
            if (deleteCheckedTasksContainer) {
                deleteCheckedTasksContainer.style.display = "none";
            }

            // ✅ Only trigger miniCycle reset if AutoReset is enabled
            if (event.target.checked) {
                self._checkCycleWithSnapshot();
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

        }

        function handleDeleteCheckedTasksChange(event) {

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

        }

        // ✅ Use safeAddEventListener to prevent duplicate listeners
        const safeAdd = this.deps.safeAddEventListener;

        // Store references to handlers
        toggleAutoReset._handleAutoResetChange = handleAutoResetChange;
        deleteCheckedTasks._handleDeleteCheckedTasksChange = handleDeleteCheckedTasksChange;

        // ✅ Add event listeners using safeAdd
        safeAdd(toggleAutoReset, "change", handleAutoResetChange);
        safeAdd(deleteCheckedTasks, "change", handleDeleteCheckedTasksChange);

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
            return;
        }
        this._setupDeleteCheckedTasksModeListenerInitialized = true;

        const self = this;
        const safeAdd = this.deps.safeAddEventListener;

        deleteCheckedTasks._deleteCheckedTasksModeHandler = async (event) => {
            // ✅ Schema 2.5 only

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

                // The mode-selector path (syncTogglesFromMode) persists this exact
                // transition and THEN dispatches a synthetic `change` that lands here.
                // Re-running the producer changes nothing but still saves and notifies
                // every subscriber, so detect that and skip straight to the UI sync.
                // Detection is stateless on purpose: a suppression flag set around the
                // dispatch would stick if anything threw in between, and a stuck flag
                // means the real checkbox silently stops persisting — a far worse
                // failure than one redundant write.
                if (self.isModeAlreadyApplied(currentCycle, isToDoMode, currentMode)) {
                    updatedCycle = currentCycle;
                } else {
                    await AppState.update(state => {
                        const cycle = state.data.cycles[activeCycle];

                        // Update mode
                        cycle.deleteCheckedTasks = isToDoMode;

                        // ✅ Sync all tasks' deleteWhenComplete with mode-specific
                        // settings. Shared with updateStorageFromToggles() — one
                        // helper, one copy.
                        self.syncTasksToMode(cycle, currentMode);

                        // ✅ Capture updated cycle to avoid race condition
                        updatedCycle = cycle;
                    }, true); // Immediate save
                }

                // ✅ Update UI using centralized DOM sync with captured state
                const syncAllTasksWithMode = self.deps.syncAllTasksWithMode;
                if (updatedCycle?.tasks && typeof syncAllTasksWithMode === 'function') {
                    // Create task data map for batch sync
                    const tasksDataMap = {};
                    updatedCycle.tasks.forEach(task => {
                        tasksDataMap[task.id] = task;
                    });

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

        };
        safeAdd(deleteCheckedTasks, "change", deleteCheckedTasks._deleteCheckedTasksModeHandler);
    }

    /**
     * Validate and enforce mode settings on app resume
     * Checks if DOM toggles match AppState and fixes any discrepancies
     * This is a safety net to catch stale state issues
     */
    validateModeEnforcement() {

        const AppState = this.deps.AppState;
        if (!AppState?.isReady?.()) {
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
            const body = this.deps.getBody();
            body.className = body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
            body.classList.add(correctMode + '-mode');

            // Refresh UI to reflect correct mode
            this.refreshTaskButtonsForModeChange();
        }
    }

    /**
     * Setup visibility change listener for mode validation
     * Validates mode enforcement when user returns to the app
     */
    setupVisibilityChangeListener() {
        // ✅ FIX: Idempotency guard to prevent duplicate listeners
        if (this._visibilityListenerInitialized) {
            return;
        }
        this._visibilityListenerInitialized = true;

        // Store reference for potential cleanup
        this._visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                // Small delay to ensure app state is fully restored
                setTimeout(() => {
                    this.validateModeEnforcement();
                    // Check if auto-reset should trigger (all tasks completed in auto-cycle mode)
                    this._checkCycleWithSnapshot();
                }, 100);
            }
        };

        document.addEventListener('visibilitychange', this._visibilityHandler);
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

/**
 * Initialize and configure the mode manager
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<ModeManager>} Initialized mode manager instance
 */
export async function initModeManager(dependencies = {}) {

    const manager = new ModeManager(dependencies);
    await manager.init();

    return manager;
}
