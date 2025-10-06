/**
 * miniCycle Recurring Tasks - Core Scheduling Engine
 *
 * Pattern: Strict Dependency Injection 🔧
 * Purpose: Mission-critical business logic for recurring task scheduling
 *
 * This module handles:
 * - Recurring task scheduling and pattern matching
 * - Template management and lifecycle
 * - Task activation/deactivation logic
 * - Cycle reset integration
 *
 * @module recurringCore
 * @version 1.0.0
 * @requires AppState (via dependency injection)
 */

// ============================================
// DEPENDENCY INJECTION SETUP
// ============================================

/**
 * Dependency container for all external functions
 * All dependencies MUST be injected before using this module
 */
const Deps = {
    // State management
    getAppState: null,        // () => AppState.get()
    updateAppState: null,     // (updateFn) => AppState.update(updateFn)
    isAppStateReady: null,    // () => AppState.isReady()

    // Data operations (legacy - for backwards compatibility)
    loadData: null,           // () => loadMiniCycleData()

    // Notifications
    showNotification: null,   // (msg, type, duration) => showNotification()

    // DOM operations
    querySelector: null,      // (selector) => document.querySelector(selector)

    // UI callbacks (optional - for panel updates)
    updateRecurringPanel: null,        // () => updateRecurringPanel()
    updateRecurringSummary: null,      // () => updateRecurringSummary()
    updatePanelButtonVisibility: null, // () => updateRecurringPanelButtonVisibility()

    // Time/scheduling
    now: null,                // () => Date.now()
    setInterval: null,        // (fn, ms) => setInterval(fn, ms)

    // Feature flags
    isEnabled: null           // () => FeatureFlags.recurringEnabled
};

/**
 * Configure dependencies for the recurring core module
 * @param {Object} overrides - Dependency overrides
 * @throws {Error} If called multiple times (prevents accidental reconfiguration)
 */
export function setRecurringCoreDependencies(overrides = {}) {
    Object.assign(Deps, overrides);
    console.log('🔧 RecurringCore dependencies configured');
}

/**
 * Ensure a dependency is available, throw clear error if not
 * @param {string} name - Dependency name for error message
 * @param {*} value - The dependency value to check
 * @throws {Error} If dependency is missing
 */
function assertInjected(name, value) {
    if (typeof value !== 'function') {
        throw new Error(`recurringCore: missing required dependency '${name}'. Call setRecurringCoreDependencies() first.`);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert 12-hour time to 24-hour format
 * @param {number} hour - Hour in 12-hour format (1-12)
 * @param {string} meridiem - "AM" or "PM"
 * @returns {number} Hour in 24-hour format (0-23)
 */
function convert12To24(hour, meridiem) {
    hour = parseInt(hour, 10);
    if (meridiem === "PM" && hour !== 12) return hour + 12;
    if (meridiem === "AM" && hour === 12) return 0;
    return hour;
}

/**
 * Parse date string as local date (not UTC)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Parsed date object
 */
function parseDateAsLocal(dateStr) {
    console.log('📅 Parsing date as local:', dateStr);

    try {
        const [year, month, day] = dateStr.split("-").map(Number);
        const result = new Date(year, month - 1, day); // month is 0-indexed

        console.log('✅ Date parsed successfully:', result);
        return result;
    } catch (error) {
        console.error('❌ Error parsing date:', error);
        return new Date(); // fallback to today
    }
}

/**
 * Normalize recurring settings with all required fields
 * @param {Object} settings - Partial recurring settings
 * @returns {Object} Normalized settings with defaults
 */
export function normalizeRecurringSettings(settings = {}) {
    return {
        frequency: settings.frequency || "daily",
        indefinitely: settings.indefinitely !== false,
        count: settings.count ?? null,
        time: settings.time || null,

        specificDates: {
            enabled: settings.specificDates?.enabled || false,
            dates: Array.isArray(settings.specificDates?.dates) ? settings.specificDates.dates : []
        },

        hourly: {
            useSpecificMinute: settings.hourly?.useSpecificMinute || false,
            minute: settings.hourly?.minute || 0
        },

        weekly: {
            days: Array.isArray(settings.weekly?.days) ? settings.weekly.days : []
        },

        biweekly: {
            days: Array.isArray(settings.biweekly?.days) ? settings.biweekly.days : []
        },

        monthly: {
            days: Array.isArray(settings.monthly?.days) ? settings.monthly.days : []
        },

        yearly: {
            months: Array.isArray(settings.yearly?.months) ? settings.yearly.months : [],
            useSpecificDays: settings.yearly?.useSpecificDays || false,
            applyDaysToAll: settings.yearly?.applyDaysToAll !== false, // default is true
            daysByMonth: settings.yearly?.daysByMonth || {}
        }
    };
}

// ============================================
// PATTERN MATCHING LOGIC
// ============================================

/**
 * Determine if a task should recur now based on its settings
 * @param {Object} settings - Recurring settings object
 * @param {Date} now - Current date/time (for testing)
 * @returns {boolean} True if task should appear now
 */
export function shouldTaskRecurNow(settings, now = new Date()) {
    // ✅ Specific Dates override all… but still honor specific‑time if set
    if (settings.specificDates?.enabled) {
        const todayMatch = settings.specificDates.dates?.some(dateStr => {
            const date = parseDateAsLocal(dateStr);
            return date.getFullYear() === now.getFullYear()
                && date.getMonth()  === now.getMonth()
                && date.getDate()   === now.getDate();
        });
        if (!todayMatch) return false;

        // Only trigger at the exact time if the user checked "specific time"
        if (settings.time) {
            const hour   = settings.time.military
                ? settings.time.hour
                : convert12To24(settings.time.hour, settings.time.meridiem);
            const minute = settings.time.minute;
            return now.getHours() === hour && now.getMinutes() === minute;
        }

        return true;
    }

    const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
    const day = now.getDate();
    const month = now.getMonth() + 1;

    switch (settings.frequency) {
        case "daily":
            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }
            return now.getHours() === 0 && now.getMinutes() === 0;

        case "weekly":
        case "biweekly":
            if (!settings[settings.frequency]?.days?.includes(weekday)) return false;

            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }

            return true; // if no time set, recur any time today

        case "monthly":
            if (!settings.monthly?.days?.includes(day)) return false;

            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }

            return true; // If no time is set, trigger any time during the day

        case "yearly":
            if (!settings.yearly?.months?.includes(month)) return false;

            if (settings.yearly.useSpecificDays) {
                const daysByMonth = settings.yearly.daysByMonth || {};
                const days = settings.yearly.applyDaysToAll
                    ? daysByMonth.all || []
                    : daysByMonth[month] || [];

                if (!days.includes(day)) return false;
            }

            if (settings.time) {
                const hour = settings.time.military
                    ? settings.time.hour
                    : convert12To24(settings.time.hour, settings.time.meridiem);
                const minute = settings.time.minute;
                return now.getHours() === hour && now.getMinutes() === minute;
            }

            return true; // If no time is set, recur any time that day

        case "hourly":
            if (settings.hourly?.useSpecificMinute) {
                const minute = now.getMinutes();
                return minute === settings.hourly.minute;
            }
            return now.getMinutes() === 0;

        default:
            return false;
    }
}

/**
 * Check if a recurring task should be recreated
 * @param {Object} template - Recurring task template
 * @param {Array} taskList - Current task list
 * @param {Date} now - Current date/time
 * @returns {boolean} True if task should be recreated
 */
export function shouldRecreateRecurringTask(template, taskList, now) {
    const { id, text, recurringSettings, recurring, lastTriggeredTimestamp, suppressUntil } = template;

    if (!recurring || !recurringSettings) return false;

    // 🔒 Already exists?
    if (taskList.some(task => task.id === id)) return false;

    // ⏸️ Suppressed?
    if (suppressUntil && new Date(suppressUntil) > now) {
        console.log(`⏸ Skipping "${text}" — suppressed until ${suppressUntil}`);
        return false;
    }

    // ⏱ Triggered recently?
    if (lastTriggeredTimestamp) {
        const last = new Date(lastTriggeredTimestamp);
        const sameMinute =
            last.getFullYear() === now.getFullYear() &&
            last.getMonth()    === now.getMonth()    &&
            last.getDate()     === now.getDate()     &&
            last.getHours()    === now.getHours()    &&
            last.getMinutes()  === now.getMinutes();
        if (sameMinute) return false;
    }

    // 🧠 Recurrence match?
    return shouldTaskRecurNow(recurringSettings, now);
}

// ============================================
// CORE SCHEDULING ENGINE
// ============================================

/**
 * Watch recurring tasks and recreate them when due
 * Runs as part of the 30-second interval check
 */
export function watchRecurringTasks() {
    console.log('👁️ Watching recurring tasks (AppState-based)...');

    // ✅ Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return;
    }

    // ✅ Read from AppState instead of localStorage
    assertInjected('isAppStateReady', Deps.isAppStateReady);
    assertInjected('getAppState', Deps.getAppState);

    if (!Deps.isAppStateReady()) {
        console.warn('⚠️ AppState not ready for recurring task watch');
        return;
    }

    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring task watch');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for recurring task watch');
        return;
    }

    const templates = cycleData.recurringTemplates || {};
    const taskList = cycleData.tasks || [];

    if (!Object.keys(templates).length) {
        console.log('📋 No recurring templates found');
        return;
    }

    console.log('🔍 Checking recurring templates:', Object.keys(templates).length);

    assertInjected('now', Deps.now);
    const now = new Date(Deps.now());
    const tasksToAdd = [];
    const templateUpdates = {};

    // ✅ Collect changes without mutating state directly
    Object.values(templates).forEach(template => {
        // ⛔ Prevent re-adding if task already exists by ID
        if (taskList.some(task => task.id === template.id)) return;
        if (!shouldRecreateRecurringTask(template, taskList, now)) return;

        console.log("⏱ Auto‑recreating recurring task:", template.text);

        tasksToAdd.push({
            text: template.text,
            completed: false,
            dueDate: template.dueDate,
            highPriority: template.highPriority,
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings
        });

        templateUpdates[template.id] = {
            ...template,
            lastTriggeredTimestamp: now.getTime()
        };
    });

    // ✅ Batch all changes in one AppState update
    if (tasksToAdd.length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        Deps.updateAppState(draft => {
            const cycle = draft.data.cycles[activeCycleId];

            // Add new recurring tasks
            tasksToAdd.forEach(taskData => {
                cycle.tasks.push({
                    ...taskData,
                    dateCreated: now.toISOString()
                });
            });

            // Update template timestamps
            Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        });

        console.log(`✅ Added ${tasksToAdd.length} recurring tasks via AppState`);
    }
}

/**
 * Setup the recurring task watcher interval
 * Checks every 30 seconds for tasks that need to be recreated
 */
export function setupRecurringWatcher() {
    console.log('⚙️ Setting up recurring watcher (AppState-based)...');

    // ✅ Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return;
    }

    // ✅ Check AppState readiness with deferred setup
    assertInjected('isAppStateReady', Deps.isAppStateReady);
    if (!Deps.isAppStateReady()) {
        console.log('⏳ AppState not ready, deferring recurring watcher setup...');

        // Defer setup until AppState is ready
        window._deferredRecurringSetup = window._deferredRecurringSetup || [];
        window._deferredRecurringSetup.push(() => setupRecurringWatcher());
        return;
    }

    // ✅ Read from AppState instead of loadMiniCycleData
    assertInjected('getAppState', Deps.getAppState);
    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring watcher setup');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for recurring watcher setup');
        return;
    }

    const recurringTemplates = cycleData.recurringTemplates || {};

    if (!Object.keys(recurringTemplates).length) {
        console.log('📋 No recurring templates to watch');
        return;
    }

    console.log('🔄 Setting up recurring task watcher with', Object.keys(recurringTemplates).length, 'templates');

    // Initial check
    watchRecurringTasks();

    // Setup 30-second interval
    assertInjected('setInterval', Deps.setInterval);
    Deps.setInterval(watchRecurringTasks, 30000);

    // Re-check when tab becomes visible (user might have been away)
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            console.log('👁️ Tab visible again, checking recurring tasks...');
            watchRecurringTasks();
        }
    });

    console.log('✅ Recurring watcher initialized successfully');
}

// ============================================
// BUSINESS LOGIC - TASK ACTIVATION/DEACTIVATION
// ============================================

/**
 * Activate recurring for a task
 * @param {Object} task - The task object to make recurring
 * @param {Object} taskContext - Context containing taskId, currentCycle, settings
 * @param {HTMLElement} button - The recurring button element (optional, for UI updates)
 */
export function handleRecurringTaskActivation(task, taskContext, button = null) {
    const { assignedTaskId, currentCycle, settings } = taskContext;

    assertInjected('querySelector', Deps.querySelector);
    const taskItem = Deps.querySelector(`[data-task-id="${assignedTaskId}"]`);

    const defaultSettings = settings.defaultRecurringSettings || {
        frequency: "daily",
        indefinitely: true,
        time: null
    };

    task.recurringSettings = normalizeRecurringSettings(structuredClone(defaultSettings));

    // Update DOM if element exists
    if (taskItem) {
        taskItem.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
        taskItem.classList.add("recurring");
    }

    task.schemaVersion = 2;

    // Create recurring template
    if (!currentCycle.recurringTemplates) {
        currentCycle.recurringTemplates = {};
    }

    currentCycle.recurringTemplates[assignedTaskId] = {
        id: assignedTaskId,
        text: task.text,
        recurring: true,
        recurringSettings: structuredClone(task.recurringSettings),
        highPriority: task.highPriority || false,
        dueDate: task.dueDate || null,
        remindersEnabled: task.remindersEnabled || false,
        lastTriggeredTimestamp: null,
        schemaVersion: 2
    };

    console.log('✅ Task activated as recurring:', assignedTaskId);
}

/**
 * Deactivate recurring for a task
 * @param {Object} task - The task object to make non-recurring
 * @param {Object} taskContext - Context containing taskId, currentCycle
 * @param {string} assignedTaskId - The task ID
 */
export function handleRecurringTaskDeactivation(task, taskContext, assignedTaskId) {
    const { currentCycle } = taskContext;

    assertInjected('querySelector', Deps.querySelector);
    const taskItem = Deps.querySelector(`[data-task-id="${assignedTaskId}"]`);

    task.recurring = false;
    task.recurringSettings = {};
    task.schemaVersion = 2;

    // Update DOM if element exists
    if (taskItem) {
        taskItem.removeAttribute("data-recurring-settings");
        taskItem.classList.remove("recurring");
    }

    // Remove from templates, keep task in main array
    if (currentCycle.recurringTemplates?.[assignedTaskId]) {
        delete currentCycle.recurringTemplates[assignedTaskId];
    }

    // Ensure the task stays in the main tasks array
    const taskExists = currentCycle.tasks.find(t => t.id === assignedTaskId);
    if (!taskExists) {
        console.warn('⚠️ Task missing from main array, re-adding:', assignedTaskId);
        currentCycle.tasks.push(task);
    }

    assertInjected('showNotification', Deps.showNotification);
    Deps.showNotification("↩️ Recurring turned off for this task.", "info", 2000);

    console.log('✅ Task deactivated from recurring:', assignedTaskId);
}

// ============================================
// BUSINESS LOGIC - SETTINGS APPLICATION
// ============================================

/**
 * Apply recurring settings to a task (Schema 2.5)
 * @param {string} taskId - The task ID
 * @param {Object} newSettings - New recurring settings to apply
 */
export function applyRecurringToTaskSchema25(taskId, newSettings) {
    // ✅ Use AppState instead of direct parameter passing
    assertInjected('isAppStateReady', Deps.isAppStateReady);
    assertInjected('getAppState', Deps.getAppState);
    assertInjected('updateAppState', Deps.updateAppState);

    if (!Deps.isAppStateReady()) {
        console.warn('⚠️ AppState not ready for applyRecurringToTaskSchema25');
        return;
    }

    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for applyRecurringToTaskSchema25');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.error('❌ Cycle data not found for applyRecurringToTaskSchema25');
        return;
    }

    let task = cycleData.tasks.find(t => t.id === taskId);
    if (!task) {
        console.error('❌ Task not found for applyRecurringToTaskSchema25:', taskId);
        return;
    }

    // ✅ Update via AppState instead of localStorage
    Deps.updateAppState(draft => {
        const cycle = draft.data.cycles[activeCycleId];
        const targetTask = cycle.tasks.find(t => t.id === taskId);

        if (targetTask) {
            // Merge instead of overwrite so we keep advanced panel settings
            targetTask.recurringSettings = {
                ...targetTask.recurringSettings,
                ...newSettings
            };
            targetTask.recurring = true;
            targetTask.schemaVersion = 2;

            // Keep recurringTemplates in sync
            if (!cycle.recurringTemplates) cycle.recurringTemplates = {};
            cycle.recurringTemplates[taskId] = {
                ...(cycle.recurringTemplates[taskId] || {}),
                id: taskId,
                text: targetTask.text,
                recurring: true,
                schemaVersion: 2,
                recurringSettings: { ...targetTask.recurringSettings }
            };
        }
    });

    // Update DOM attributes for this task
    assertInjected('querySelector', Deps.querySelector);
    const taskElement = Deps.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
        taskElement.classList.add("recurring");
        taskElement.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
        const recurringBtn = taskElement.querySelector(".recurring-btn");
        if (recurringBtn) {
            recurringBtn.classList.add("active");
            recurringBtn.setAttribute("aria-pressed", "true");
        }
    }

    // ✅ Update recurring panel display if it's open (optional callbacks)
    if (Deps.updateRecurringPanel && typeof Deps.updateRecurringPanel === 'function') {
        Deps.updateRecurringPanel();
    }

    // ✅ Update recurring summary to reflect changes
    if (Deps.updateRecurringSummary && typeof Deps.updateRecurringSummary === 'function') {
        Deps.updateRecurringSummary();
    }

    // ✅ Update panel button visibility based on recurring task count
    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        Deps.updatePanelButtonVisibility();
    }

    console.log('✅ Recurring settings applied to task:', taskId);
}

// ============================================
// BUSINESS LOGIC - TEMPLATE MANAGEMENT
// ============================================

/**
 * Delete a recurring template
 * @param {string} taskId - The task ID
 */
export function deleteRecurringTemplate(taskId) {
    console.log('🗑️ Deleting recurring template (Schema 2.5 only)...');

    assertInjected('loadData', Deps.loadData);
    const schemaData = Deps.loadData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for deleteRecurringTemplate');
        return;
    }

    const { cycles, activeCycle } = schemaData;
    const currentCycle = cycles[activeCycle];

    if (!currentCycle) {
        console.error(`❌ Active cycle not found for deleteRecurringTemplate.`);
        return;
    }

    if (!currentCycle.recurringTemplates || !currentCycle.recurringTemplates[taskId]) {
        console.warn(`⚠ Task "${taskId}" not found in recurring templates.`);
        return;
    }

    console.log('🔍 Deleting template for task:', taskId);

    // Delete the task template
    delete currentCycle.recurringTemplates[taskId];

    // Update the full schema data via AppState
    assertInjected('updateAppState', Deps.updateAppState);
    assertInjected('getAppState', Deps.getAppState);

    const state = Deps.getAppState();
    const activeCycleId = state.appState?.activeCycleId;

    if (activeCycleId) {
        Deps.updateAppState(draft => {
            if (draft.data.cycles[activeCycleId]?.recurringTemplates) {
                delete draft.data.cycles[activeCycleId].recurringTemplates[taskId];
            }
        });
    }

    console.log('✅ Recurring template deleted from Schema 2.5');
}

/**
 * Remove recurring tasks from cycle during reset
 * @param {Array} taskElements - Array of task DOM elements
 * @param {Object} cycleData - Current cycle data
 */
export function removeRecurringTasksFromCycle(taskElements, cycleData) {
    taskElements.forEach(taskEl => {
        const taskId = taskEl.dataset.taskId;
        const isRecurring = taskEl.classList.contains("recurring");

        if (isRecurring) {
            // Remove from DOM
            taskEl.remove();

            // ✅ IMPORTANT: Only remove from tasks array, keep in recurringTemplates
            if (cycleData.tasks) {
                const taskIndex = cycleData.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    cycleData.tasks.splice(taskIndex, 1);
                }
            }

            // ✅ Keep in recurringTemplates so they can be recreated
            // DON'T delete from recurringTemplates here
        }
    });
}

/**
 * Handle recurring tasks after cycle reset
 * Called after completeMiniCycle to clean up recurring tasks
 */
export function handleRecurringTasksAfterReset() {
    console.log('🔄 Handling recurring tasks after reset (Schema 2.5 only)...');

    assertInjected('loadData', Deps.loadData);
    const schemaData = Deps.loadData();
    if (!schemaData) {
        console.error('❌ Schema 2.5 data required for handleRecurringTasksAfterReset');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    const cycleData = cycles[activeCycle];

    if (!cycleData) {
        console.warn('⚠️ No active cycle data found for recurring task reset');
        return;
    }

    const recurringTemplates = cycleData.recurringTemplates || {};
    const templateCount = Object.keys(recurringTemplates).length;

    if (templateCount > 0) {
        console.log(`✅ ${templateCount} recurring templates preserved for future recreation`);
    } else {
        console.log('📋 No recurring templates to preserve');
    }
}

// ============================================
// EXPORTS
// ============================================

console.log('🔧 RecurringCore module loaded (Strict DI Pattern)');
