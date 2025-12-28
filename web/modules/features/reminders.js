/**
 * 🔔 miniCycle Reminders Module (DI-Pure)
 * Handles reminder scheduling, notifications, and task-level reminder management
 *
 * Features:
 * - Global reminder enable/disable
 * - Per-task reminder toggles
 * - Flexible scheduling (minutes/hours/days)
 * - Indefinite or limited repeat counts
 * - Persistence across sessions
 * - Integration with Schema 2.5 data structure
 *
 * Note: document.getElementById, document.querySelectorAll are browser APIs,
 * not dependencies - they cannot be injected (but can be overridden for testing).
 *
 * @module reminders
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('Reminders', {
    AppState: optional(null),
    showNotification: optional(null),
    loadMiniCycleData: optional(null),
    appInit: optional(null),
    refreshTaskListUI: optional(null),
    updateUndoRedoButtons: optional(null),
    autoSave: optional(null),
    AppGlobalState: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for MiniCycleReminders (call before creating instance)
 * @param {Object} dependencies - { AppState, showNotification, loadMiniCycleData, appInit, refreshTaskListUI, AppGlobalState, AppMeta }
 */
export function setRemindersDependencies(dependencies) {
    di.setDependencies(dependencies);
    // Invalidate cached deps if manager already exists
    if (reminderManager?._cachedDeps) {
        reminderManager._cachedDeps = null;
    }
    console.log('🔔 Reminders dependencies set:', Object.keys(dependencies));
}

export class MiniCycleReminders {
    constructor(dependencies = {}) {
        // Store constructor-provided deps that won't change (browser API overrides for testing)
        this._constructorDeps = {
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((selector) => document.querySelectorAll(selector)),
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddEventListener
        };

        // Store constructor-provided version (can be overridden by _deps.AppMeta)
        this._constructorVersion = dependencies.AppMeta?.version;

        console.log('🔔 MiniCycle Reminders module initialized');
    }

    /**
     * Resolve and cache dependencies - avoids repeated Proxy/resolve overhead
     */
    _resolveAndCacheDeps() {
        this._cachedDeps = {
            AppState: _deps.AppState,
            showNotification: _deps.showNotification || this.fallbackNotification,
            loadMiniCycleData: _deps.loadMiniCycleData || this.fallbackLoadData,
            appInit: _deps.appInit,
            refreshTaskListUI: _deps.refreshTaskListUI,
            updateUndoRedoButtons: _deps.updateUndoRedoButtons || (() => console.log('⏭️ updateUndoRedoButtons not available')),
            autoSave: _deps.autoSave || (() => console.warn('⚠️ autoSave not available')),
            ...this._constructorDeps
        };
    }

    /**
     * Getter for dependencies - returns cached deps for performance
     */
    get deps() {
        if (!this._cachedDeps) {
            this._resolveAndCacheDeps();
        }
        return this._cachedDeps;
    }

    /**
     * Get current version from deps or constructor
     */
    get currentVersion() {
        return _deps.AppMeta?.version || this._constructorVersion;
    }

    /**
     * Get AppGlobalState from deps (DI-pure)
     */
    get appGlobalState() {
        return _deps.AppGlobalState;
    }

    /**
     * Internal state accessor (uses injected AppGlobalState)
     */
    get state() {
        const globalState = this.appGlobalState;
        return {
            get reminderTimeoutId() { return globalState?.reminderTimeoutId || null; },
            set reminderTimeoutId(value) { if (globalState) globalState.reminderTimeoutId = value; },

            // Alias for tests compatibility (tests use reminderIntervalId)
            get reminderIntervalId() { return globalState?.reminderTimeoutId || null; },
            set reminderIntervalId(value) { if (globalState) globalState.reminderTimeoutId = value; },

            // Track how many times reminders have been shown
            get timesReminded() { return globalState?.timesReminded || 0; },
            set timesReminded(value) { if (globalState) globalState.timesReminded = value; }
        };
    }

    /**
     * Initialize reminder system
     * Must be called after DOM is ready and appInit core is ready
     */
    async init() {
        console.log('🔄 Initializing reminder system...');

        // Wait for core systems to be ready (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        try {
            this.setupReminderToggle();
            this.setupReminderInputListeners();
            this.setupModalCloseListeners();
            this.wireOpenRemindersModalListener();

            // ✅ Add hook to update reminder buttons after app is fully ready (DI-pure)
            if (appInitModule?.addHook) {
                appInitModule.addHook('afterApp', async () => {
                console.log('🔄 Updating reminder buttons after app ready (hook)...');

                // Check if tasks exist in DOM before proceeding
                const tasks = this.deps.querySelectorAll(".task");
                if (tasks.length === 0) {
                    console.log('⏭️ No tasks in DOM yet, skipping (will run after loadMiniCycle)');
                    return;
                }

                // Load settings to check if reminders are enabled
                const schemaData = this.deps.loadMiniCycleData();
                if (schemaData) {
                    const reminderSettings = schemaData.reminders || {};

                    // Update reminder buttons now that tasks are rendered
                    await this.updateReminderButtons();

                    // Start reminders if they were enabled
                    if (reminderSettings.enabled) {
                        console.log('🔔 Reminders enabled, starting system...');
                        await this.startReminders();
                    }
                }

                console.log('✅ Reminder buttons updated on page load (hook)');
                });
            }

            console.log('✅ Reminder system initialized successfully');
        } catch (error) {
            console.warn('⚠️ Reminder system initialization failed:', error);
            this.deps.showNotification('Reminder system initialized with limited functionality', 'warning');
        }
    }

    /**
     * Handle reminder toggle (enable/disable globally)
     */
    async handleReminderToggle() {
        console.log('🔔 Handling reminder toggle (Schema 2.5 only)...');

        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        const enableReminders = this.deps.getElementById('enableReminders');
        if (!enableReminders) {
            console.warn('⚠️ enableReminders checkbox not found');
            return;
        }

        const isEnabled = enableReminders.checked;

        // Get previous state from Schema 2.5
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for handleReminderToggle');
            throw new Error('Schema 2.5 data not found');
        }

        const previousSettings = schemaData.reminders || {};
        const wasEnabled = previousSettings.enabled === true;

        console.log('📊 Reminder toggle state:', {
            wasEnabled,
            nowEnabled: isEnabled,
            changed: wasEnabled !== isEnabled
        });

        // Update the visibility of the frequency section
        const frequencySection = this.deps.getElementById('frequency-section');
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !isEnabled);
        }

        // Save updated settings and get the current global state
        const globalReminderState = this.autoSaveReminders();

        // ✅ Sync with customizer modal if it's open
        const customizerModal = document.getElementById('task-options-customizer-modal');
        if (customizerModal) {
            const remindersCheckbox = customizerModal.querySelector('[data-option="reminders"]');
            if (remindersCheckbox) {
                remindersCheckbox.checked = isEnabled;
                console.log('🔄 Synced customizer modal checkbox:', isEnabled);
            }
        }

        // ✅ Update cycle's taskOptionButtons.reminders setting
        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (AppState?.update && AppState?.get) {
            const state = AppState.get();
            const activeCycleId = state.appState?.activeCycleId;
            if (activeCycleId && state.data?.cycles?.[activeCycleId]) {
                AppState.update(s => {
                    if (!s.data.cycles[activeCycleId].taskOptionButtons) {
                        s.data.cycles[activeCycleId].taskOptionButtons = {};
                    }
                    s.data.cycles[activeCycleId].taskOptionButtons.reminders = isEnabled;
                });
                console.log(`✅ Updated cycle taskOptionButtons.reminders to: ${isEnabled}`);
            }
        }

        // Update the 🔔 task buttons
        this.updateReminderButtons();

        // ✅ Refresh task list to show/hide reminder buttons (DI-pure)
        const refreshTaskListUI = this.deps.refreshTaskListUI;
        if (typeof refreshTaskListUI === 'function') {
            refreshTaskListUI();
            console.log('🔄 Refreshed task list to update button visibility');
        }

        // Start or stop reminders
        if (globalReminderState) {
            console.log("🔔 Global Reminders Enabled — Starting reminders...");
            if (!wasEnabled) {
                this.deps.showNotification("🔔 Task reminders enabled!", "success", 2500);
            }
            setTimeout(() => this.startReminders(), 200);
        } else {
            console.log("🔕 Global Reminders Disabled — Stopping reminders...");
            if (wasEnabled) {
                this.deps.showNotification("🔕 Task reminders disabled.", "error", 2500);
            }
            this.stopReminders();
        }


        console.log('✅ Reminder toggle handled successfully');
    }

    /**
     * Set up reminder toggle event listener
     */
    setupReminderToggle() {
        console.log('⚙️ Setting up reminder toggle (Schema 2.5 only)...');

        const enableReminders = this.deps.getElementById('enableReminders');
        if (!enableReminders) {
            console.warn('⚠️ enableReminders checkbox not found');
            return;
        }

        this.deps.safeAddEventListener(enableReminders, "change", () => this.handleReminderToggle());

        // Load reminder settings from Schema 2.5
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.warn('⚠️ No Schema 2.5 data yet - reminder toggle will initialize after cycle creation');
            return; // Gracefully exit - settings will be loaded when data exists
        }

        const reminderSettings = schemaData.reminders || {
            enabled: false,
            indefinite: true,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 0,
            frequencyUnit: "hours"
        };

        console.log('📊 Loading reminder settings from Schema 2.5:', reminderSettings);

        // Apply settings to UI elements
        enableReminders.checked = reminderSettings.enabled === true;

        const frequencySection = this.deps.getElementById('frequency-section');
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !reminderSettings.enabled);
        }

        // ✅ NOTE: updateReminderButtons() and startReminders() are now called via afterApp hook
        // This ensures tasks are rendered before we try to update their reminder buttons
        console.log('✅ Reminder toggle setup completed (buttons will update via afterApp hook)');
    }

    /**
     * Stop the reminder system
     */
    stopReminders() {
        console.log('🛑 Stopping reminder system (Schema 2.5 only)...');

        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
            this.state.reminderTimeoutId = null;
            console.log("🛑 Reminder timeout cleared");
        } else {
            console.log("ℹ️ No active reminder timeout to stop");
        }

        console.log("✅ Reminder system stopped successfully");
    }

    /**
     * Auto-save reminder settings
     * @returns {Promise<boolean>} - Returns the enabled state
     */
    async autoSaveReminders() {
        console.log('💾 Auto-saving reminders (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for autoSaveReminders');
            throw new Error('Schema 2.5 data not found');
        }

        const enabled = this.deps.getElementById("enableReminders")?.checked || false;
        const previousSettings = schemaData.reminders || {};

        const remindersToSave = {
            enabled,
            indefinite: this.deps.getElementById("indefiniteCheckbox")?.checked || true,
            dueDatesReminders: this.deps.getElementById("dueDatesReminders")?.checked || false,
            repeatCount: parseInt(this.deps.getElementById("repeatCount")?.value) || 0,
            frequencyValue: parseInt(this.deps.getElementById("frequencyValue")?.value) || 0,
            frequencyUnit: this.deps.getElementById("frequencyUnit")?.value || "hours"
        };

        // If enabling for first time or settings changed, reset timers
        const settingsChanged =
            previousSettings.frequencyValue !== remindersToSave.frequencyValue ||
            previousSettings.frequencyUnit !== remindersToSave.frequencyUnit;

        if (enabled && (!previousSettings.enabled || settingsChanged)) {
            // First enable or settings changed - reset everything
            const now = Date.now();
            const multiplier = remindersToSave.frequencyUnit === "hours" ? 3600000 :
                             remindersToSave.frequencyUnit === "days" ? 86400000 : 60000;
            const intervalMs = remindersToSave.frequencyValue * multiplier;

            remindersToSave.nextReminderTime = now + intervalMs;
            remindersToSave.reminderStartTime = now; // ✅ Track when reminders started
            remindersToSave.timesReminded = 0;
        } else if (enabled) {
            // Keep existing values when just toggling other settings
            remindersToSave.nextReminderTime = previousSettings.nextReminderTime || Date.now();
            remindersToSave.reminderStartTime = previousSettings.reminderStartTime || Date.now(); // ✅ Preserve start time
            remindersToSave.timesReminded = previousSettings.timesReminded || 0;
        }

        // ✅ Use AppState only (no localStorage fallback)
        const AppStateSave = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (AppStateSave?.isReady?.()) {
            await AppStateSave.update(state => {
                state.customReminders = remindersToSave;
            }, true); // immediate save for reminders
        } else {
            console.error('❌ AppState not ready for saveRemindersSettings');
            return false;
        }

        console.log("✅ Reminders settings saved automatically (Schema 2.5):", remindersToSave);
        return enabled;
    }

    /**
     * Load reminder settings from storage and update UI
     */
    async loadRemindersSettings() {
        console.log('📥 Loading reminders settings (Schema 2.5 only)...');

        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for loadRemindersSettings');
            throw new Error('Schema 2.5 data not found');
        }

        const reminders = schemaData.reminders || {
            enabled: false,
            indefinite: true,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 0,
            frequencyUnit: "hours"
        };

        console.log('📊 Loading reminder settings from Schema 2.5:', reminders);

        // Apply settings to UI
        const enableReminders = this.deps.getElementById("enableReminders");
        const indefiniteCheckbox = this.deps.getElementById("indefiniteCheckbox");
        const dueDatesReminders = this.deps.getElementById("dueDatesReminders");
        const repeatCount = this.deps.getElementById("repeatCount");
        const frequencyValue = this.deps.getElementById("frequencyValue");
        const frequencyUnit = this.deps.getElementById("frequencyUnit");

        if (enableReminders) enableReminders.checked = reminders.enabled;
        if (indefiniteCheckbox) indefiniteCheckbox.checked = reminders.indefinite;
        if (dueDatesReminders) dueDatesReminders.checked = reminders.dueDatesReminders;
        if (repeatCount) repeatCount.value = reminders.repeatCount;
        if (frequencyValue) frequencyValue.value = reminders.frequencyValue;
        if (frequencyUnit) frequencyUnit.value = reminders.frequencyUnit;

        // Show/hide frequency settings dynamically
        const frequencySection = this.deps.getElementById("frequency-section");
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !reminders.enabled);
        }

        const repeatCountRow = this.deps.getElementById("repeat-count-row");
        if (repeatCountRow) {
            repeatCountRow.style.display = reminders.indefinite ? "none" : "block";
        }

        // Show/hide reminder buttons on load
        this.updateReminderButtons();

        console.log("✅ Reminder settings loaded from Schema 2.5");
    }

    /**
     * Save reminder state for a specific task
     * @param {string} taskId - The ID of the task
     * @param {boolean} isEnabled - Whether reminders are enabled for this task
     */
    async saveTaskReminderState(taskId, isEnabled) {
        console.log('🔔 Saving task reminder state (Schema 2.5 only)...');

        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for saveTaskReminderState');
            throw new Error('Schema 2.5 data not found');
        }

        // Schema 2.5 structure: data.cycles and appState.activeCycleId
        const cycles = schemaData.data?.cycles || schemaData.cycles;
        const activeCycle = schemaData.appState?.activeCycleId || schemaData.activeCycle;

        if (!activeCycle || !cycles[activeCycle]) {
            console.error('❌ No active cycle found for task reminder state');
            return;
        }

        console.log('🔍 Finding task for reminder state update:', taskId);

        const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

        console.log('📊 Updating reminder state:', {
            taskId,
            taskText: task.text,
            oldState: task.remindersEnabled,
            newState: isEnabled
        });

        // Update task reminder state
        task.remindersEnabled = isEnabled;

        // ✅ Use AppState only (no localStorage fallback)
        const AppStateTask = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (AppStateTask?.isReady?.()) {
            await AppStateTask.update(state => {
                if (state?.data?.cycles?.[activeCycle]) {
                    state.data.cycles[activeCycle] = cycles[activeCycle];
                }
            }, true); // immediate save for task changes
        } else {
            console.error('❌ AppState not ready for updateTaskReminderState');
            return;
        }

        console.log(`✅ Task reminder state saved successfully (Schema 2.5) for task: ${taskId}`);
    }

    /**
     * Send reminder notification and schedule next one
     */
    async sendReminderNotificationIfNeeded() {
        console.log('🔔 Sending reminder notification if needed (Schema 2.5 only)...');

        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        // Schema 2.5 only
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for sendReminderNotificationIfNeeded');
            throw new Error('Schema 2.5 data not found');
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        console.log('📊 Reminder settings:', remindersSettings);

        let tasksWithReminders = [...this.deps.querySelectorAll(".task")]
            .filter(task => task.querySelector(".enable-task-reminders.reminder-active"));

        console.log("🔍 Tasks With Active Reminders:", tasksWithReminders.length);

        let incompleteTasks = tasksWithReminders
            .filter(task => !task.querySelector("input[type='checkbox']").checked)
            .map(task => task.querySelector(".task-text").textContent);

        if (incompleteTasks.length === 0) {
            console.log("✅ All tasks complete. Stopping reminders.");
            this.stopReminders();
            return;
        }

        // Check if max reminders reached
        const timesReminded = remindersSettings.timesReminded || 0;
        if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
            console.log("✅ Max reminders sent. Stopping reminders.");
            this.stopReminders();
            return;
        }

        // Send notification
        console.log('📢 Showing reminder notification for tasks:', incompleteTasks);
        // No duration = requires manual dismissal (reminders should persist until user acknowledges)
        this.deps.showNotification(`🔔 You have tasks to complete:<br>- ${incompleteTasks.join("<br>- ")}`, "info");

        // Update counter and next reminder time
        const multiplier = remindersSettings.frequencyUnit === "hours" ? 3600000 :
                         remindersSettings.frequencyUnit === "days" ? 86400000 : 60000;
        const intervalMs = remindersSettings.frequencyValue * multiplier;
        const now = Date.now();

        // ✅ Use AppState only (no localStorage fallback)
        const AppStateNotify = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (AppStateNotify?.isReady?.()) {
            await AppStateNotify.update(state => {
                const activeCycleId = state?.appState?.activeCycleId;
                if (activeCycleId && state?.data?.cycles?.[activeCycleId]?.reminders) {
                    state.data.cycles[activeCycleId].reminders.timesReminded = timesReminded + 1;
                    state.data.cycles[activeCycleId].reminders.nextReminderTime = now + intervalMs;
                }
            }, true); // immediate save for reminders
        } else {
            console.error('❌ AppState not ready for sendReminderNotificationIfNeeded');
            return;
        }

        console.log('✅ Reminder notification sent (Schema 2.5)', {
            timesReminded: timesReminded + 1,
            nextReminderTime: new Date(now + intervalMs).toLocaleString()
        });

        // Schedule next reminder
        this.scheduleNextReminder();
    }

    /**
     * Start the reminder system
     */
    async startReminders() {
        console.log("🔄 Starting Reminder System (Schema 2.5 only)...");

        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        // Clear any existing timeout
        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
            this.state.reminderTimeoutId = null;
            console.log('🛑 Cleared existing reminder timeout');
        }

        // Schema 2.5 only
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.warn('⚠️ No Schema 2.5 data yet - reminders will start after cycle creation');
            return; // Gracefully exit - reminders will start when data exists
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        console.log('📊 Loading reminder settings from Schema 2.5:', remindersSettings);

        if (!remindersSettings.enabled) {
            console.log('🔕 Reminders disabled in settings');
            return;
        }

        const now = Date.now();
        const nextReminderTime = remindersSettings.nextReminderTime || now;
        const timesReminded = remindersSettings.timesReminded || 0;

        console.log('⏰ Reminder state:', {
            nextReminderTime: new Date(nextReminderTime).toLocaleString(),
            timesReminded,
            indefinite: remindersSettings.indefinite,
            repeatCount: remindersSettings.repeatCount
        });

        // Check if max reminders already sent
        if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
            console.log("✅ Max reminders already reached. Skipping further reminders.");
            return;
        }

        // Check if we're overdue for a reminder (catch-up)
        if (now >= nextReminderTime) {
            console.log("⏰ Catch-up needed - sending reminder now.");
            await this.sendReminderNotificationIfNeeded();
        }

        // Always schedule the next reminder when enabled (even if we just sent one)
        // ✅ This ensures the interval is created for tests and normal operation
        this.scheduleNextReminder();

        console.log('✅ Reminder system started successfully (Schema 2.5)');
    }

    /**
     * Schedule the next reminder timeout
     */
    async scheduleNextReminder() {
        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for scheduleNextReminder');
            return;
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        if (!remindersSettings.enabled) {
            console.log('🔕 Reminders disabled, not scheduling next reminder');
            return;
        }

        const now = Date.now();
        let nextReminderTime = remindersSettings.nextReminderTime || now;
        let timeUntilNext = nextReminderTime - now;

        // ✅ If no future reminder time is set, calculate it from frequency settings
        if (timeUntilNext <= 0) {
            console.log("⏰ No future reminder time set, calculating from frequency settings");
            const multiplier = remindersSettings.frequencyUnit === "hours" ? 3600000 :
                             remindersSettings.frequencyUnit === "days" ? 86400000 : 60000;
            const intervalMs = (remindersSettings.frequencyValue || 1) * multiplier;
            nextReminderTime = now + intervalMs;
            timeUntilNext = intervalMs;
            console.log(`⏰ Calculated next reminder time: ${new Date(nextReminderTime).toLocaleString()}`);
        }

        // Clear any existing timeout
        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
        }

        // Schedule the next reminder
        console.log(`⏳ Next reminder scheduled in ${Math.round(timeUntilNext / 1000 / 60)} minutes at ${new Date(nextReminderTime).toLocaleString()}`);

        this.state.reminderTimeoutId = setTimeout(async () => {
            console.log('🔔 Reminder timeout triggered');
            await this.sendReminderNotificationIfNeeded();
        }, timeUntilNext);

        console.log('✅ Next reminder scheduled successfully');
    }

    /**
     * Set up reminder button event handler for a specific task
     * @param {HTMLElement} button - The reminder button element
     * @param {Object} taskContext - Context containing task ID
     */
    setupReminderButtonHandler(button, taskContext) {
        const { assignedTaskId } = taskContext;
        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });

        button._reminderClickHandler = async () => {
            // Wait for core systems (DI-pure)
            const appInitModule = this.deps.appInit;
            if (appInitModule?.waitForCore) {
                await appInitModule.waitForCore();
            }

            // ✅ Read fresh state from localStorage (source of truth)
            const schemaData = this.deps.loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Cannot toggle reminder - no data available');
                return;
            }

            const { cycles, activeCycle } = schemaData;
            const currentCycle = cycles[activeCycle];
            const task = currentCycle?.tasks?.find(t => t.id === assignedTaskId);

            if (!task) {
                console.warn('⚠️ Task not found for reminder toggle:', assignedTaskId);
                return;
            }

            // Toggle based on AppState, not DOM
            const isCurrentlyEnabled = task.remindersEnabled === true;
            const isActive = !isCurrentlyEnabled;

            console.log('🔔 Toggling reminder state:', {
                taskId: assignedTaskId,
                wasEnabled: isCurrentlyEnabled,
                willBeEnabled: isActive
            });

            button.classList.toggle("reminder-active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());

            await this.saveTaskReminderState(assignedTaskId, isActive);
            this.autoSaveReminders();
            this.startReminders();

            // Update undo/redo button states
            this.deps.updateUndoRedoButtons();

            // ✅ Enhanced notification with settings info and click-to-configure
            if (isActive) {
                const reminderSettings = schemaData.reminders || {};
                const freq = reminderSettings.frequencyValue || 0;
                const unit = reminderSettings.frequencyUnit || 'hours';
                const settingsText = freq > 0
                    ? `Every ${freq} ${unit}`
                    : 'Custom settings';

                const message = `🔔 Reminder enabled: ${settingsText}\nClick to configure`;
                const notificationElement = this.deps.showNotification(message, "success", 5000);

                // Add click listener to open reminders modal
                if (notificationElement) {
                    const clickHandler = (e) => {
                        // Don't trigger if clicking the close button
                        if (e.target.classList.contains('close-btn')) return;

                        const remindersModal = document.getElementById('reminders-modal');
                        if (remindersModal) {
                            remindersModal.style.display = 'flex';
                            remindersModal.style.alignItems = 'center';
                            remindersModal.style.justifyContent = 'center';
                        }

                        // Remove notification after clicking
                        notificationElement.remove();
                    };

                    notificationElement._clickHandler = clickHandler;
                    safeAdd(notificationElement, 'click', notificationElement._clickHandler);
                    notificationElement.style.cursor = 'pointer';
                    notificationElement.title = 'Click to configure reminder settings';

                    // ✅ Enable line breaks in notification
                    const notificationContent = notificationElement.querySelector('.notification-content');
                    if (notificationContent) {
                        notificationContent.style.whiteSpace = 'pre-line';
                    }
                }
            } else {
                this.deps.showNotification('🔕 Reminder disabled for task.', 'info', 1500);
            }
        };
        safeAdd(button, "click", button._reminderClickHandler);
    }

    /**
     * Update visibility and state of all reminder buttons
     */
    async updateReminderButtons() {
        console.log("🔍 Running updateReminderButtons() (Schema 2.5 only)...");

        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        // Schema 2.5 only
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for updateReminderButtons');
            return;
        }

        const { cycles, activeCycle, reminders } = schemaData;
        const currentCycle = cycles[activeCycle];
        const reminderSettings = reminders || {};
        const remindersGloballyEnabled = reminderSettings.enabled === true;

        console.log('📊 Reminder settings from Schema 2.5:', {
            globallyEnabled: remindersGloballyEnabled,
            activeCycle,
            hasCycle: !!currentCycle
        });

        this.deps.querySelectorAll(".task").forEach(taskItem => {
          const buttonContainer = taskItem.querySelector(".task-options");
          let reminderButton = buttonContainer?.querySelector(".enable-task-reminders");

          const taskId = taskItem.dataset.taskId;
          if (!taskId) {
            console.warn("⚠ Skipping task with missing ID:", taskItem);
            return;
          }

          // Get task data from Schema 2.5
          const taskData = currentCycle?.tasks?.find(t => t.id === taskId);
          const isActive = taskData?.remindersEnabled === true;

          console.log(`🔍 Task ${taskId}: reminders enabled = ${isActive}`);

          // ✅ NO LONGER control button visibility based on global settings
          // Button visibility is now controlled by taskOptionButtons customization
          // Only update the button state (active/inactive) if it exists
          if (reminderButton) {
            console.log(`   🔄 Updating reminder button state for task ${taskId} - setting active: ${isActive}`);
            reminderButton.classList.toggle("reminder-active", isActive);
            reminderButton.setAttribute("aria-pressed", isActive.toString());
            console.log(`   ✅ Reminder Button Updated - Active: ${isActive}`);
          }
        });

        console.log("✅ Finished updateReminderButtons() (Schema 2.5).");
    }

    /**
     * Set up event listeners for reminder input changes
     */
    setupReminderInputListeners() {
        console.log('⚙️ Setting up reminder input listeners...');

        // Indefinite checkbox listener
        const indefiniteCheckbox = this.deps.getElementById("indefiniteCheckbox");
        if (indefiniteCheckbox) {
            this.deps.safeAddEventListener(indefiniteCheckbox, "change", () => {
                console.log('🔄 Indefinite checkbox changed (Schema 2.5 only)');

                const repeatCountRow = this.deps.getElementById("repeat-count-row");
                if (repeatCountRow) {
                    repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
                }

                this.autoSaveReminders();
                this.startReminders();
            });
        }

        // Due dates reminders listener
        const dueDatesReminders = this.deps.getElementById("dueDatesReminders");
        if (dueDatesReminders) {
            this.deps.safeAddEventListener(dueDatesReminders, "change", () => {
                console.log('📅 Due dates reminders changed (Schema 2.5 only)');

                const schemaData = this.deps.loadMiniCycleData();
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for dueDatesReminders change');
                    return;
                }

                // ✅ Use AppState instead of direct localStorage - Save per-cycle
                const AppStateDueDates = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
                if (AppStateDueDates?.update) {
                    AppStateDueDates.update(state => {
                        const activeCycleId = state.appState.activeCycleId;
                        if (activeCycleId && state.data.cycles[activeCycleId]?.reminders) {
                            state.data.cycles[activeCycleId].reminders.dueDatesReminders = dueDatesReminders.checked;
                        }
                        state.metadata.lastModified = Date.now();
                    }, true); // immediate save
                    console.log(`💾 Saved Due Dates Reminders setting via AppState: ${dueDatesReminders.checked}`);
                } else {
                    console.error('❌ AppState not ready for dueDatesReminders toggle - setting not saved');
                }
            });
        }

        // Reminder input listeners (repeat count, frequency value, frequency unit)
        ["repeatCount", "frequencyValue", "frequencyUnit"].forEach(id => {
            const element = this.deps.getElementById(id);
            if (element) {
                this.deps.safeAddEventListener(element, "input", () => {
                    console.log(`🔄 Reminder input changed: ${id} (Schema 2.5 only)`);

                    const schemaData = this.deps.loadMiniCycleData();
                    if (!schemaData) {
                        console.error('❌ Schema 2.5 data required for reminder input change');
                        return;
                    }

                    const settings = schemaData.reminders || {};
                    if (settings.enabled) {
                        this.autoSaveReminders();
                        this.startReminders();
                    }
                });
            }
        });

        console.log('✅ Reminder input listeners set up');
    }

    /**
     * Set up modal close listeners for reminders modal
     * (Extracted from orchestrator.js Phase 3c)
     */
    setupModalCloseListeners() {
        const remindersModal = this.deps.getElementById("reminders-modal");
        const closeRemindersBtn = this.deps.getElementById("close-reminders-btn");

        if (closeRemindersBtn) {
            this.deps.safeAddEventListener(closeRemindersBtn, "click", () => {
                if (remindersModal) remindersModal.style.display = "none";
            });
        }

        // Close on outside click
        this.deps.safeAddEventListener(window, "click", (event) => {
            if (event.target === remindersModal) {
                remindersModal.style.display = "none";
            }
        });

        console.log('✅ Reminder modal close listeners set up');
    }

    /**
     * Wire the open-reminders-modal button listener
     * Moved from orchestrator.js for proper module ownership
     */
    wireOpenRemindersModalListener() {
        const openBtn = this.deps.getElementById("open-reminders-modal");
        if (!openBtn) {
            console.warn('⚠️ open-reminders-modal button not found');
            return;
        }

        this.deps.safeAddEventListener(openBtn, "click", () => {
            console.log('🔔 Opening reminders modal (Schema 2.5 only)...');

            // Load current settings from Schema 2.5 before opening
            this.loadRemindersSettings();

            const remindersModal = this.deps.getElementById("reminders-modal");
            if (remindersModal) {
                remindersModal.style.display = "flex";
            }

            // Hide main menu if available
            if (typeof this.deps.hideMainMenu === 'function') {
                this.deps.hideMainMenu();
            }

            console.log('✅ Reminders modal opened');
        });

        console.log('✅ open-reminders-modal listener wired');
    }

    // ============================================
    // FALLBACK METHODS
    // ============================================

    fallbackNotification(message, type) {
        console.log(`[Reminder Notification - ${type}] ${message}`);
    }

    fallbackLoadData() {
        console.warn('⚠️ Data loading not available - reminders cannot function');
        return null;
    }

    fallbackAddEventListener(element, event, handler) {
        if (element && element.addEventListener) {
            element.removeEventListener(event, handler);
            element.addEventListener(event, handler);
        } else {
            console.warn('⚠️ Could not add event listener:', event);
        }
    }
}

// ============================================
// MODULE INITIALIZATION & GLOBAL EXPORTS
// ============================================

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🔔 Reminders module loaded (DI-pure, no window.* exports)');

let reminderManager = null;

/**
 * Initialize the reminder manager with dependencies
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<MiniCycleReminders>} The initialized reminder manager
 */
export async function initReminderManager(dependencies = {}) {
    console.log('🔔 Initializing Reminder Manager...');

    if (reminderManager) {
        console.log('⚠️ Reminder manager already initialized, returning existing instance');
        return reminderManager;
    }

    reminderManager = new MiniCycleReminders(dependencies);
    await reminderManager.init();

    // Phase 3 - No window.* exports (main script handles exposure)
    console.log('✅ Reminder Manager initialized');

    return reminderManager;
}

export default MiniCycleReminders;
