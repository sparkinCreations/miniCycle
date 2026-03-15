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
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, FREQUENCY_MS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

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
    AppMeta: optional(null),
    getModal: optional(null),
    showConfirmationModal: optional(null),
    hideMainMenu: optional(null),
    trackAction: optional(null)
});

// Late-binding deps via Proxy
/** @type {{AppState: Object|null, showNotification: Function|null, loadMiniCycleData: Function|null, appInit: Object|null, refreshTaskListUI: Function|null, updateUndoRedoButtons: Function|null, autoSave: Function|null, AppGlobalState: Object|null, AppMeta: Object|null, hideMainMenu: Function|null, trackAction: Function|null}} */
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
}

function replaceStoredEventListener(element, event, key, handler, options) {
    if (!element) return;

    if (typeof element[key] === 'function') {
        element.removeEventListener(event, element[key], options);
    }

    element[key] = handler;
    element.addEventListener(event, handler, options);
}

export class MiniCycleReminders {
    constructor(dependencies = {}) {
        // Store constructor-provided deps that won't change (browser API overrides for testing)
        this._constructorDeps = {
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((selector) => document.querySelectorAll(selector)),
            safeAddEventListener: dependencies.safeAddEventListener
        };

        // Store constructor-provided version (can be overridden by _deps.AppMeta)
        this._constructorVersion = dependencies.AppMeta?.version;

        // Track active reminder notification to prevent stacking
        this._activeReminderNotification = null;

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
            updateUndoRedoButtons: _deps.updateUndoRedoButtons || (() => {}),
            autoSave: _deps.autoSave || (() => console.warn('⚠️ autoSave not available')),
            getModal: _deps.getModal,
            showConfirmationModal: _deps.showConfirmationModal,
            hideMainMenu: _deps.hideMainMenu,
            trackAction: _deps.trackAction,
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

                // Check if tasks exist in DOM before proceeding
                const tasks = this.deps.querySelectorAll(DOM_SELECTORS.TASK);
                if (tasks.length === 0) {
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
                        await this.startReminders();
                    }
                }

                });
            }

        } catch (error) {
            console.warn('⚠️ Reminder system initialization failed:', error);
            this.deps.showNotification(getLabel('notify.reminderLimited'), 'warning');
        }
    }

    async openRemindersModal() {
        const remindersModal = this.deps.getModal?.('reminders');
        if (!remindersModal) {
            console.warn('⚠️ Reminders modal not found');
            return false;
        }

        const previousFocus = document.activeElement;

        try {
            await this.loadRemindersSettings();
        } catch (error) {
            console.warn('⚠️ Could not load reminder settings:', error);
            this.deps.showNotification?.(getLabel('notify.reminderLimited'), 'warning', UI_TIMEOUTS.NOTIFICATION_SHORT);
            return false;
        }

        if (!remindersModal.open) {
            remindersModal._previousFocus = previousFocus;
            remindersModal.showModal();
        }

        return true;
    }

    closeRemindersModal() {
        const remindersModal = this.deps.getModal?.('reminders');
        if (remindersModal?.open) {
            remindersModal.close();
        }
    }

    /**
     * Handle reminder toggle (enable/disable globally)
     */
    async handleReminderToggle() {

        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        const enableReminders = this.deps.getElementById(DOM_IDS.ENABLE_REMINDERS);
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

        // Update the visibility of the frequency section
        const frequencySection = this.deps.getElementById(DOM_IDS.FREQUENCY_SECTION);
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !isEnabled);
        }

        // Save updated settings and get the current global state
        // Fix #30: autoSaveReminders is async, must await to get actual boolean
        const globalReminderState = await this.autoSaveReminders();

        // ✅ Sync with customizer modal if it's open
        const customizerModal = document.getElementById(DOM_IDS.TASK_OPTIONS_CUSTOMIZER_MODAL);
        if (customizerModal) {
            const remindersCheckbox = customizerModal.querySelector('[data-option="reminders"]');
            if (remindersCheckbox) {
                remindersCheckbox.checked = isEnabled;
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
            }
        }

        // Update the 🔔 task buttons
        this.updateReminderButtons();

        // ✅ Refresh task list to show/hide reminder buttons (DI-pure)
        const refreshTaskListUI = this.deps.refreshTaskListUI;
        if (typeof refreshTaskListUI === 'function') {
            refreshTaskListUI();
        }

        // Start or stop reminders
        if (globalReminderState) {
            if (!wasEnabled) {
                this.deps.showNotification('🔔 ' + getLabel('notify.reminderEnabled'), "success", UI_TIMEOUTS.NOTIFICATION_MEDIUM);
            }
            setTimeout(() => this.startReminders(), UI_TIMEOUTS.ANIMATION_SHORT);
        } else {
            if (wasEnabled) {
                this.deps.showNotification('🔕 ' + getLabel('notify.reminderDisabled'), "error", UI_TIMEOUTS.NOTIFICATION_MEDIUM);
            }
            this.stopReminders();
        }

    }

    /**
     * Set up reminder toggle event listener
     */
    setupReminderToggle() {

        const enableReminders = this.deps.getElementById(DOM_IDS.ENABLE_REMINDERS);
        if (!enableReminders) {
            console.warn('⚠️ enableReminders checkbox not found');
            return;
        }

        replaceStoredEventListener(enableReminders, "change", "__miniCycleRemindersToggleChangeHandler", () => this.handleReminderToggle());

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

        // Apply settings to UI elements
        enableReminders.checked = reminderSettings.enabled === true;

        const frequencySection = this.deps.getElementById(DOM_IDS.FREQUENCY_SECTION);
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !reminderSettings.enabled);
        }

        // ✅ NOTE: updateReminderButtons() and startReminders() are now called via afterApp hook
        // This ensures tasks are rendered before we try to update their reminder buttons
    }

    /**
     * Stop the reminder system
     */
    stopReminders() {

        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
            this.state.reminderTimeoutId = null;
        } else {
        }

    }

    /**
     * Auto-save reminder settings
     * @returns {Promise<boolean>} - Returns the enabled state
     */
    async autoSaveReminders() {

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for autoSaveReminders');
            throw new Error('Schema 2.5 data not found');
        }

        const enabled = this.deps.getElementById(DOM_IDS.ENABLE_REMINDERS)?.checked || false;
        const previousSettings = schemaData.reminders || {};

        const remindersToSave = {
            enabled,
            // Fix #31: Use ?? instead of || so false doesn't become true
            indefinite: this.deps.getElementById(DOM_IDS.INDEFINITE_CHECKBOX)?.checked ?? true,
            dueDatesReminders: this.deps.getElementById(DOM_IDS.DUE_DATES_REMINDERS)?.checked ?? false,
            browserNotifications: this.deps.getElementById(DOM_IDS.BROWSER_NOTIFICATIONS)?.checked ?? false,
            privacyNoticeOpen: this.deps.getElementById(DOM_IDS.PRIVACY_NOTICE_DETAILS)?.open ?? false,
            repeatCount: parseInt(this.deps.getElementById(DOM_IDS.REPEAT_COUNT)?.value) || 0,
            frequencyValue: parseInt(this.deps.getElementById(DOM_IDS.FREQUENCY_VALUE)?.value) || 0,
            frequencyUnit: this.deps.getElementById(DOM_IDS.FREQUENCY_UNIT)?.value || "hours"
        };

        // If enabling for first time or settings changed, reset timers
        const settingsChanged =
            previousSettings.frequencyValue !== remindersToSave.frequencyValue ||
            previousSettings.frequencyUnit !== remindersToSave.frequencyUnit;

        if (enabled && (!previousSettings.enabled || settingsChanged)) {
            // First enable or settings changed - reset everything
            const now = Date.now();
            const multiplier = FREQUENCY_MS[remindersToSave.frequencyUnit] || FREQUENCY_MS.minutes;
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

        return enabled;
    }

    /**
     * Load reminder settings from storage and update UI
     */
    async loadRemindersSettings() {

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

        // Apply settings to UI
        const enableReminders = this.deps.getElementById(DOM_IDS.ENABLE_REMINDERS);
        const indefiniteCheckbox = this.deps.getElementById(DOM_IDS.INDEFINITE_CHECKBOX);
        const dueDatesReminders = this.deps.getElementById(DOM_IDS.DUE_DATES_REMINDERS);
        const repeatCount = this.deps.getElementById(DOM_IDS.REPEAT_COUNT);
        const frequencyValue = this.deps.getElementById(DOM_IDS.FREQUENCY_VALUE);
        const frequencyUnit = this.deps.getElementById(DOM_IDS.FREQUENCY_UNIT);

        const browserNotifications = this.deps.getElementById(DOM_IDS.BROWSER_NOTIFICATIONS);

        if (enableReminders) enableReminders.checked = reminders.enabled;
        if (indefiniteCheckbox) indefiniteCheckbox.checked = reminders.indefinite;
        if (dueDatesReminders) dueDatesReminders.checked = reminders.dueDatesReminders;
        // Only check browser notifications if permission is still granted
        if (browserNotifications) {
            browserNotifications.checked = reminders.browserNotifications &&
                typeof Notification !== 'undefined' && Notification.permission === 'granted';
        }
        const privacyNotice = this.deps.getElementById(DOM_IDS.PRIVACY_NOTICE_DETAILS);
        if (privacyNotice) privacyNotice.open = reminders.privacyNoticeOpen ?? false;
        if (repeatCount) repeatCount.value = reminders.repeatCount;
        if (frequencyValue) frequencyValue.value = reminders.frequencyValue;
        if (frequencyUnit) frequencyUnit.value = reminders.frequencyUnit;

        // Show/hide frequency settings dynamically
        const frequencySection = this.deps.getElementById(DOM_IDS.FREQUENCY_SECTION);
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !reminders.enabled);
        }

        const repeatCountRow = this.deps.getElementById(DOM_IDS.REPEAT_COUNT_ROW);
        if (repeatCountRow) {
            repeatCountRow.style.display = reminders.indefinite ? "none" : "block";
        }

        // Show/hide reminder buttons on load
        this.updateReminderButtons();

    }

    /**
     * Save reminder state for a specific task
     * @param {string} taskId - The ID of the task
     * @param {boolean} isEnabled - Whether reminders are enabled for this task
     */
    async saveTaskReminderState(taskId, isEnabled) {

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

        const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

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

    }

    /**
     * Send reminder notification and schedule next one
     */
    async sendReminderNotificationIfNeeded() {

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

        let tasksWithReminders = [...this.deps.querySelectorAll(DOM_SELECTORS.TASK)]
            .filter(task => task.querySelector(".enable-task-reminders.reminder-active"));

        let incompleteTasks = tasksWithReminders
            .filter(task => !task.querySelector("input[type='checkbox']").checked)
            .map(task => task.querySelector(DOM_SELECTORS.TASK_TEXT).textContent);

        if (incompleteTasks.length === 0) {
            this.stopReminders();
            return;
        }

        // Check if max reminders reached
        const timesReminded = remindersSettings.timesReminded || 0;
        if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
            this.stopReminders();
            return;
        }

        // Send notification
        // Dismiss previous reminder notification to prevent stacking
        if (this._activeReminderNotification?.parentNode) {
            this._activeReminderNotification.remove();
        }
        // No duration = requires manual dismissal (user may be away from app)
        // Use \n instead of <br> - CSS white-space: pre-line renders newlines (XSS-safe)
        this._activeReminderNotification = this.deps.showNotification(`🔔 ${getLabel('notify.reminderTasksToComplete')}\n~ ${incompleteTasks.join("\n~ ")}`, "info");

        // Send browser notification if enabled and permission granted
        if (remindersSettings.browserNotifications && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const notificationBody = incompleteTasks.map(t => `~ ${t}`).join('\n');
            try {
                // Try ServiceWorker notification first (more reliable, works when tab is in background)
                const registration = await navigator.serviceWorker?.getRegistration();
                if (registration) {
                    await registration.showNotification('miniCycle Reminder', {
                        body: notificationBody,
                        icon: './assets/images/logo/taskcycle_logo_blackandwhite_transparent.png',
                        tag: 'minicycle-reminder'
                    });
                } else {
                    // Fallback to basic Notification API
                    new Notification('miniCycle Reminder', {
                        body: notificationBody,
                        icon: './assets/images/logo/taskcycle_logo_blackandwhite_transparent.png'
                    });
                }
            } catch (e) {
                console.warn('⚠️ Browser notification failed:', e);
            }
        }

        // Update counter and next reminder time
        const multiplier = FREQUENCY_MS[remindersSettings.frequencyUnit] || FREQUENCY_MS.minutes;
        const intervalMs = remindersSettings.frequencyValue * multiplier;
        const now = Date.now();

        // ✅ Use AppState only (no localStorage fallback)
        const AppStateNotify = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (AppStateNotify?.isReady?.()) {
            await AppStateNotify.update(state => {
                // Fix: Write to customReminders (where loadMiniCycleData reads from)
                // Previously wrote to cycles[id].reminders which was never read back
                if (state.customReminders) {
                    state.customReminders.timesReminded = timesReminded + 1;
                    state.customReminders.nextReminderTime = now + intervalMs;
                }
            }, true); // immediate save for reminders
        } else {
            console.error('❌ AppState not ready for sendReminderNotificationIfNeeded');
            return;
        }

        // Schedule next reminder
        this.scheduleNextReminder();
    }

    /**
     * Start the reminder system
     */
    async startReminders() {

        // Wait for core systems (DI-pure)
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        // Clear any existing timeout
        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
            this.state.reminderTimeoutId = null;
        }

        // Schema 2.5 only
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.warn('⚠️ No Schema 2.5 data yet - reminders will start after cycle creation');
            return; // Gracefully exit - reminders will start when data exists
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        if (!remindersSettings.enabled) {
            return;
        }

        const now = Date.now();
        const nextReminderTime = remindersSettings.nextReminderTime || now;
        const timesReminded = remindersSettings.timesReminded || 0;

        // Check if max reminders already sent
        if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
            return;
        }

        // Check if we're overdue for a reminder (catch-up)
        if (now >= nextReminderTime) {
            await this.sendReminderNotificationIfNeeded();
        }

        // Always schedule the next reminder when enabled (even if we just sent one)
        // ✅ This ensures the interval is created for tests and normal operation
        this.scheduleNextReminder();

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
            return;
        }

        const now = Date.now();
        let nextReminderTime = remindersSettings.nextReminderTime || now;
        let timeUntilNext = nextReminderTime - now;

        // ✅ If no future reminder time is set, calculate it from frequency settings
        if (timeUntilNext <= 0) {
            const multiplier = FREQUENCY_MS[remindersSettings.frequencyUnit] || FREQUENCY_MS.minutes;
            const intervalMs = (remindersSettings.frequencyValue || 1) * multiplier;
            nextReminderTime = now + intervalMs;
            timeUntilNext = intervalMs;
        }

        // Clear any existing timeout
        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
        }

        // Schedule the next reminder

        this.state.reminderTimeoutId = setTimeout(async () => {
            await this.sendReminderNotificationIfNeeded();
        }, timeUntilNext);

    }

    /**
     * Set up reminder button event handler for a specific task
     * @param {HTMLElement} button - The reminder button element
     * @param {Object} taskContext - Context containing task ID
     */
    setupReminderButtonHandler(button, taskContext) {
        const { assignedTaskId } = taskContext;
        const safeAdd = this.deps.safeAddEventListener;

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
                    ? getLabel('notify.reminderEveryFrequency', { vars: { freq, unit } })
                    : getLabel('notify.reminderCustomSettings');

                const message = `🔔 ${getLabel('notify.reminderEnabled', { vars: { settings: settingsText } })}\n${getLabel('notify.reminderClickToConfigure')}`;
                const notificationElement = this.deps.showNotification(message, "success", UI_TIMEOUTS.NOTIFICATION_SLOW);

                // Add click listener to open reminders modal
                if (notificationElement) {
                    const clickHandler = async (e) => {
                        // Don't trigger if clicking the close button
                        if (e.target.classList.contains('close-btn')) return;

                        const opened = await this.openRemindersModal();
                        if (opened) {
                            notificationElement.remove();
                        }
                    };

                    notificationElement._clickHandler = clickHandler;
                    safeAdd(notificationElement, 'click', notificationElement._clickHandler);
                    notificationElement.style.cursor = 'pointer';
                    notificationElement.title = getLabel('reminders.configureTooltip');

                    // ✅ Enable line breaks in notification
                    const notificationContent = notificationElement.querySelector(DOM_SELECTORS.NOTIFICATION_CONTENT);
                    if (notificationContent) {
                        notificationContent.style.whiteSpace = 'pre-line';
                    }
                }
            } else {
                this.deps.showNotification('🔕 ' + getLabel('notify.taskReminderDisabled'), 'info', UI_TIMEOUTS.NOTIFICATION_BRIEF);
            }
        };
        safeAdd(button, "click", button._reminderClickHandler);
    }

    /**
     * Update visibility and state of all reminder buttons
     */
    async updateReminderButtons() {

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

        this.deps.querySelectorAll(DOM_SELECTORS.TASK).forEach(taskItem => {
          const buttonContainer = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
          let reminderButton = buttonContainer?.querySelector(DOM_SELECTORS.ENABLE_TASK_REMINDERS);

          const taskId = taskItem.dataset.taskId;
          if (!taskId) {
            console.warn("⚠ Skipping task with missing ID:", taskItem);
            return;
          }

          // Get task data from Schema 2.5
          const taskData = currentCycle?.tasks?.find(t => t.id === taskId);
          const isActive = taskData?.remindersEnabled === true;

          // ✅ NO LONGER control button visibility based on global settings
          // Button visibility is now controlled by taskOptionButtons customization
          // Only update the button state (active/inactive) if it exists
          if (reminderButton) {
            reminderButton.classList.toggle("reminder-active", isActive);
            reminderButton.setAttribute("aria-pressed", isActive.toString());
          }
        });

    }

    /**
     * Set up event listeners for reminder input changes
     */
    setupReminderInputListeners() {

        // Indefinite checkbox listener
        const indefiniteCheckbox = this.deps.getElementById(DOM_IDS.INDEFINITE_CHECKBOX);
        if (indefiniteCheckbox) {
            replaceStoredEventListener(indefiniteCheckbox, "change", "__miniCycleRemindersIndefiniteChangeHandler", () => {

                const repeatCountRow = this.deps.getElementById(DOM_IDS.REPEAT_COUNT_ROW);
                if (repeatCountRow) {
                    repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
                }

                this.autoSaveReminders();
                this.startReminders();
            });
        }

        // Due dates reminders listener
        const dueDatesReminders = this.deps.getElementById(DOM_IDS.DUE_DATES_REMINDERS);
        if (dueDatesReminders) {
            replaceStoredEventListener(dueDatesReminders, "change", "__miniCycleRemindersDueDatesChangeHandler", () => {

                const schemaData = this.deps.loadMiniCycleData();
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for dueDatesReminders change');
                    return;
                }

                // ✅ Use AppState instead of direct localStorage - Save per-cycle
                const AppStateDueDates = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
                if (AppStateDueDates?.update) {
                    AppStateDueDates.update(state => {
                        // Fix: Write to customReminders (where loadMiniCycleData reads from)
                        if (state.customReminders) {
                            state.customReminders.dueDatesReminders = dueDatesReminders.checked;
                        }
                        state.metadata.lastModified = Date.now();
                    }, true); // immediate save
                } else {
                    console.error('❌ AppState not ready for dueDatesReminders toggle - setting not saved');
                }
            });
        }

        // Reminder input listeners (repeat count, frequency value, frequency unit)
        ["repeatCount", "frequencyValue", "frequencyUnit"].forEach(id => {
            const element = this.deps.getElementById(id);
            if (element) {
                replaceStoredEventListener(element, "input", "__miniCycleRemindersInputHandler", () => {

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

        // Browser notifications toggle listener
        const browserNotificationsCheckbox = this.deps.getElementById(DOM_IDS.BROWSER_NOTIFICATIONS);
        if (browserNotificationsCheckbox) {
            replaceStoredEventListener(browserNotificationsCheckbox, "change", "__miniCycleRemindersBrowserNotificationsChangeHandler", () => {
                if (browserNotificationsCheckbox.checked) {
                    // Uncheck immediately — only re-check after confirmation + permission
                    browserNotificationsCheckbox.checked = false;

                    // Case 1: Browser doesn't support Notification API
                    if (typeof Notification === 'undefined') {
                        this.deps.showNotification(getLabel('reminders.permissionUnsupported'), 'warning', UI_TIMEOUTS.NOTIFICATION_LONG);
                        return;
                    }

                    // Case 2: Permission was previously denied/blocked — can't re-prompt
                    if (Notification.permission === 'denied') {
                        this.deps.showNotification(getLabel('reminders.permissionBlocked'), 'warning', UI_TIMEOUTS.NOTIFICATION_SLOW);
                        return;
                    }

                    // Case 3: Permission already granted — skip confirmation, just enable
                    if (Notification.permission === 'granted') {
                        browserNotificationsCheckbox.checked = true;
                        this.autoSaveReminders();
                        this.deps.showNotification(getLabel('reminders.permissionGranted'), 'success', UI_TIMEOUTS.NOTIFICATION_MEDIUM);
                        return;
                    }

                    // Case 4: Permission is "default" — show privacy warning then request
                    const showConfirm = this.deps.showConfirmationModal;
                    if (!showConfirm) {
                        console.warn('⚠️ showConfirmationModal not available');
                        return;
                    }

                    showConfirm({
                        title: getLabel('reminders.browserNotifications'),
                        message: getLabel('reminders.browserNotificationsWarning'),
                        confirmText: getLabel('button.enable'),
                        cancelText: getLabel('button.cancel'),
                        callback: async (confirmed) => {
                            if (!confirmed) return;

                            try {
                                const permission = await Notification.requestPermission();
                                if (permission === 'granted') {
                                    // Verify with a test notification
                                    try {
                                        const test = new Notification('miniCycle', { body: 'Browser notifications enabled!', silent: true });
                                        test.close();
                                        browserNotificationsCheckbox.checked = true;
                                        this.autoSaveReminders();
                                        this.deps.showNotification(getLabel('reminders.permissionGranted'), 'success', UI_TIMEOUTS.NOTIFICATION_MEDIUM);
                                    } catch (testErr) {
                                        console.warn('⚠️ Test notification failed:', testErr);
                                        this.deps.showNotification(getLabel('reminders.permissionTestFailed'), 'warning', UI_TIMEOUTS.NOTIFICATION_SLOW);
                                    }
                                } else if (permission === 'denied') {
                                    this.deps.showNotification(getLabel('reminders.permissionDenied'), 'info', UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                                } else {
                                    // "default" — user dismissed the prompt without choosing
                                    this.deps.showNotification(getLabel('reminders.permissionDenied'), 'info', UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                                }
                            } catch (e) {
                                console.warn('⚠️ Notification permission request failed:', e);
                                this.deps.showNotification(getLabel('reminders.permissionUnsupported'), 'warning', UI_TIMEOUTS.NOTIFICATION_LONG);
                            }
                        }
                    });
                } else {
                    // Toggling OFF — save and confirm
                    this.autoSaveReminders();
                    this.deps.showNotification(getLabel('reminders.browserNotificationsDisabled'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
                }
            });
        }

        // Privacy notice toggle — remember open/closed state
        const privacyNoticeDetails = this.deps.getElementById(DOM_IDS.PRIVACY_NOTICE_DETAILS);
        if (privacyNoticeDetails) {
            replaceStoredEventListener(privacyNoticeDetails, "toggle", "__miniCycleRemindersPrivacyToggleHandler", () => {
                this.autoSaveReminders();
            });
        }

    }

    /**
     * Set up modal close listeners for reminders modal
     * (Extracted from orchestrator.js Phase 3c)
     */
    setupModalCloseListeners() {
        const remindersModal = this.deps.getModal('reminders');
        const closeRemindersBtn = this.deps.getElementById(DOM_IDS.CLOSE_REMINDERS_BTN);

        if (!remindersModal) {
            console.warn('⚠️ Reminders modal not found');
            return;
        }

        if (closeRemindersBtn) {
            replaceStoredEventListener(closeRemindersBtn, "click", "__miniCycleRemindersCloseClickHandler", () => {
                this.closeRemindersModal();
            });
        }

        // Close on outside click (overlay area of the dialog)
        replaceStoredEventListener(remindersModal, "click", "__miniCycleRemindersModalClickHandler", (event) => {
            if (event.target === remindersModal) {
                this.closeRemindersModal();
            }
        });

        // Restore focus when dialog closes
        replaceStoredEventListener(remindersModal, "close", "__miniCycleRemindersModalCloseHandler", () => {
            remindersModal._previousFocus?.focus({ focusVisible: false });
        });

    }

    /**
     * Wire the open-reminders-modal button listener
     * Moved from orchestrator.js for proper module ownership
     */
    wireOpenRemindersModalListener() {
        const openBtn = this.deps.getElementById(DOM_IDS.OPEN_REMINDERS_MODAL);
        if (!openBtn) {
            console.warn('⚠️ open-reminders-modal button not found');
            return;
        }

        replaceStoredEventListener(openBtn, "click", "__miniCycleRemindersOpenClickHandler", async () => {
            this.deps.trackAction?.('reminders');

            const opened = await this.openRemindersModal();
            if (opened && typeof this.deps.hideMainMenu === 'function') {
                this.deps.hideMainMenu();
            }
        });

    }

    // ============================================
    // FALLBACK METHODS
    // ============================================

    fallbackNotification(message, type) {
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

let reminderManager = null;

/**
 * Initialize the reminder manager with dependencies
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<MiniCycleReminders>} The initialized reminder manager
 */
export async function initReminderManager(dependencies = {}) {

    if (reminderManager) {
        return reminderManager;
    }

    reminderManager = new MiniCycleReminders(dependencies);
    await reminderManager.init();

    // Phase 3 - No window.* exports (main script handles exposure)

    return reminderManager;
}

// Named exports only (class already exported at declaration)
