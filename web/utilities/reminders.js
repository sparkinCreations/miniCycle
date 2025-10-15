/**
 * 🔔 miniCycle Reminders Module
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
 * @module reminders
 * @version 1.322
 */

import { appInit } from './appInitialization.js';

export class MiniCycleReminders {
    constructor(dependencies = {}) {
        this.version = '1.322';

        // Store dependencies with intelligent fallbacks
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification,
            loadMiniCycleData: dependencies.loadMiniCycleData || this.fallbackLoadData,
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((selector) => document.querySelectorAll(selector)),
            updateUndoRedoButtons: dependencies.updateUndoRedoButtons || (() => console.log('⏭️ updateUndoRedoButtons not available')),
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddEventListener,
            autoSave: dependencies.autoSave || (() => console.warn('⚠️ autoSave not available'))
        };

        // Internal state (accessed via AppGlobalState)
        this.state = {
            get reminderIntervalId() { return window.AppGlobalState?.reminderIntervalId || null; },
            set reminderIntervalId(value) { if (window.AppGlobalState) window.AppGlobalState.reminderIntervalId = value; },
            get timesReminded() { return window.AppGlobalState?.timesReminded || 0; },
            set timesReminded(value) { if (window.AppGlobalState) window.AppGlobalState.timesReminded = value; },
            get lastReminderTime() { return window.AppGlobalState?.lastReminderTime || null; },
            set lastReminderTime(value) { if (window.AppGlobalState) window.AppGlobalState.lastReminderTime = value; }
        };

        console.log('🔔 MiniCycle Reminders module initialized');
    }

    /**
     * Initialize reminder system
     * Must be called after DOM is ready and appInit core is ready
     */
    async init() {
        console.log('🔄 Initializing reminder system...');

        // Wait for core systems to be ready
        await appInit.waitForCore();

        try {
            this.setupReminderToggle();
            this.setupReminderInputListeners();
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

        await appInit.waitForCore();

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

        // Update the 🔔 task buttons
        this.updateReminderButtons();

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
            console.error('❌ Schema 2.5 data required for setupReminderToggle');
            throw new Error('Schema 2.5 data not found');
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

        enableReminders.checked = reminderSettings.enabled === true;

        const frequencySection = this.deps.getElementById('frequency-section');
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !reminderSettings.enabled);
        }

        // Reminder system will re-run if already enabled
        if (reminderSettings.enabled) {
            console.log('🔄 Reminders were enabled, starting system...');
            this.updateReminderButtons();
            this.startReminders();
        } else {
            console.log('🔕 Reminders disabled in settings');
        }

        console.log('✅ Reminder toggle setup completed');
    }

    /**
     * Stop the reminder system
     */
    stopReminders() {
        console.log('🛑 Stopping reminder system (Schema 2.5 only)...');

        if (this.state.reminderIntervalId) {
            clearInterval(this.state.reminderIntervalId);
            this.state.reminderIntervalId = null;
            console.log("🛑 Reminder interval cleared");
        } else {
            console.log("ℹ️ No active reminder interval to stop");
        }

        console.log("✅ Reminder system stopped successfully");
    }

    /**
     * Auto-save reminder settings
     * @returns {boolean} - Returns the enabled state
     */
    autoSaveReminders() {
        console.log('💾 Auto-saving reminders (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for autoSaveReminders');
            throw new Error('Schema 2.5 data not found');
        }

        const enabled = this.deps.getElementById("enableReminders")?.checked || false;

        const remindersToSave = {
            enabled,
            indefinite: this.deps.getElementById("indefiniteCheckbox")?.checked || true,
            dueDatesReminders: this.deps.getElementById("dueDatesReminders")?.checked || false,
            repeatCount: parseInt(this.deps.getElementById("repeatCount")?.value) || 0,
            frequencyValue: parseInt(this.deps.getElementById("frequencyValue")?.value) || 0,
            frequencyUnit: this.deps.getElementById("frequencyUnit")?.value || "hours"
        };

        // Save reminder start time only when enabling reminders
        if (enabled) {
            remindersToSave.reminderStartTime = Date.now();
        }

        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.customReminders = remindersToSave;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        console.log("✅ Reminders settings saved automatically (Schema 2.5):", remindersToSave);
        return enabled;
    }

    /**
     * Load reminder settings from storage and update UI
     */
    async loadRemindersSettings() {
        console.log('📥 Loading reminders settings (Schema 2.5 only)...');

        await appInit.waitForCore();

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

        await appInit.waitForCore();

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for saveTaskReminderState');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;

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

        // Update the full schema data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        console.log(`✅ Task reminder state saved successfully (Schema 2.5) for task: ${taskId}`);
    }

    /**
     * Send reminder notification if conditions are met
     */
    async sendReminderNotificationIfNeeded() {
        console.log('🔔 Sending reminder notification if needed (Schema 2.5 only)...');

        await appInit.waitForCore();

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
            clearInterval(this.state.reminderIntervalId);
            this.state.reminderIntervalId = null;
            return;
        }

        if (!remindersSettings.indefinite && this.state.timesReminded >= remindersSettings.repeatCount) {
            console.log("✅ Max reminders sent. Stopping reminders.");
            clearInterval(this.state.reminderIntervalId);
            this.state.reminderIntervalId = null;
            return;
        }

        console.log('📢 Showing reminder notification for tasks:', incompleteTasks);
        this.deps.showNotification(`🔔 You have tasks to complete:<br>- ${incompleteTasks.join("<br>- ")}`, "default");
        this.state.timesReminded++;

        console.log('✅ Reminder notification sent (Schema 2.5)');
    }

    /**
     * Start the reminder system
     */
    async startReminders() {
        console.log("🔄 Starting Reminder System (Schema 2.5 only)...");

        await appInit.waitForCore();

        if (this.state.reminderIntervalId) {
            clearInterval(this.state.reminderIntervalId);
            this.state.reminderIntervalId = null;
            console.log('🛑 Cleared existing reminder interval');
        }

        // Schema 2.5 only
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for startReminders');
            throw new Error('Schema 2.5 data not found');
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        console.log('📊 Loading reminder settings from Schema 2.5:', remindersSettings);

        if (!remindersSettings.enabled) {
            console.log('🔕 Reminders disabled in settings');
            return;
        }

        let multiplier = remindersSettings.frequencyUnit === "hours" ? 3600000 :
                         remindersSettings.frequencyUnit === "days" ? 86400000 : 60000;
        const intervalMs = remindersSettings.frequencyValue * multiplier;

        console.log('⏰ Reminder interval:', {
            value: remindersSettings.frequencyValue,
            unit: remindersSettings.frequencyUnit,
            intervalMs: intervalMs
        });

        // Use stored start time or now if missing
        const now = Date.now();
        const startTime = remindersSettings.reminderStartTime || now;
        const elapsedTime = now - startTime;
        const intervalsPassed = Math.floor(elapsedTime / intervalMs);

        this.state.timesReminded = intervalsPassed;
        this.state.lastReminderTime = startTime + (intervalsPassed * intervalMs);

        console.log(`⏱️ ${intervalsPassed} interval(s) have passed since reminderStartTime`);

        // If max reminders already sent, exit early
        if (!remindersSettings.indefinite && this.state.timesReminded >= remindersSettings.repeatCount) {
            console.log("✅ Max reminders already reached. Skipping further reminders.");
            return;
        }

        // Only send if enough time has passed since last reminder
        if ((Date.now() - this.state.lastReminderTime) >= intervalMs) {
            console.log("⏰ Sending catch-up reminder on startup.");
            this.sendReminderNotificationIfNeeded();
        } else {
            const timeUntilNext = intervalMs - (Date.now() - this.state.lastReminderTime);
            console.log(`⏳ Next reminder in ${Math.round(timeUntilNext / 1000 / 60)} minutes`);
        }

        // Set up recurring reminders on interval
        this.state.reminderIntervalId = setInterval(() => {
            console.log('🔔 Reminder interval triggered');
            this.sendReminderNotificationIfNeeded();
        }, intervalMs);

        console.log('✅ Reminder system started successfully (Schema 2.5)');
    }

    /**
     * Set up reminder button event handler for a specific task
     * @param {HTMLElement} button - The reminder button element
     * @param {Object} taskContext - Context containing task ID
     */
    setupReminderButtonHandler(button, taskContext) {
        const { assignedTaskId } = taskContext;

        button.addEventListener("click", async () => {
            await appInit.waitForCore();

            // Read fresh state from AppState to avoid stale closure data
            const currentState = window.AppState?.get();
            if (!currentState) {
                console.error('❌ AppState not available for reminder toggle');
                return;
            }

            const activeCycleId = currentState.appState?.activeCycleId;
            const freshCycle = currentState.data?.cycles?.[activeCycleId];
            const task = freshCycle?.tasks?.find(t => t.id === assignedTaskId);

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

            this.deps.showNotification(`Reminders ${isActive ? "enabled" : "disabled"} for task.`, "info", 1500);
        });
    }

    /**
     * Update visibility and state of all reminder buttons
     */
    async updateReminderButtons() {
        console.log("🔍 Running updateReminderButtons() (Schema 2.5 only)...");

        await appInit.waitForCore();

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

          if (remindersGloballyEnabled) {
            if (!reminderButton) {
              // Create Reminder Button
              reminderButton = document.createElement("button");
              reminderButton.classList.add("task-btn", "enable-task-reminders");
              reminderButton.innerHTML = "<i class='fas fa-bell'></i>";

              // Add click event
              reminderButton.addEventListener("click", async () => {
                const nowActive = reminderButton.classList.toggle("reminder-active");
                reminderButton.setAttribute("aria-pressed", nowActive.toString());
                await this.saveTaskReminderState(taskId, nowActive);
                this.autoSaveReminders();
              });

              buttonContainer?.insertBefore(reminderButton, buttonContainer.children[2]);
              console.log("   ✅ Reminder Button Created & Inserted");
            }

            // Ensure correct state and make it visible
            reminderButton.classList.toggle("reminder-active", isActive);
            reminderButton.setAttribute("aria-pressed", isActive.toString());
            reminderButton.classList.remove("hidden");

            console.log(`   🔄 Reminder Button Visible - Active: ${isActive}`);
          } else {
            // Hide button if reminders are disabled globally
            if (reminderButton) {
              reminderButton.classList.add("hidden");
              reminderButton.classList.remove("reminder-active");
              reminderButton.setAttribute("aria-pressed", "false");

              console.log("   🔕 Reminder Button Hidden (Global toggle OFF)");
            }
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

                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));

                // Update only the due dates reminders setting in Schema 2.5
                if (!fullSchemaData.customReminders) {
                    fullSchemaData.customReminders = {};
                }

                fullSchemaData.customReminders.dueDatesReminders = dueDatesReminders.checked;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                console.log(`💾 Saved Due Dates Reminders setting (Schema 2.5): ${fullSchemaData.customReminders.dueDatesReminders}`);
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

    // Make globally available for backward compatibility
    window.reminderManager = reminderManager;

    // Export individual methods globally
    window.startReminders = () => reminderManager.startReminders();
    window.stopReminders = () => reminderManager.stopReminders();
    window.handleReminderToggle = () => reminderManager.handleReminderToggle();
    window.autoSaveReminders = () => reminderManager.autoSaveReminders();
    window.loadRemindersSettings = () => reminderManager.loadRemindersSettings();
    window.saveTaskReminderState = (taskId, isEnabled) => reminderManager.saveTaskReminderState(taskId, isEnabled);
    window.updateReminderButtons = () => reminderManager.updateReminderButtons();
    window.setupReminderButtonHandler = (button, taskContext) => reminderManager.setupReminderButtonHandler(button, taskContext);

    console.log('✅ Reminder Manager initialized and globally accessible');

    return reminderManager;
}

export default MiniCycleReminders;
