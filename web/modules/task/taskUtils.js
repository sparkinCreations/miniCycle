/**
 * 🛠️ miniCycle Task Utilities (DI-Pure)
 * Utility functions for task operations (context building, DOM extraction, scrolling, etc.)
 *
 * Pattern: Static Utilities 🔧
 * - Pure utility functions
 * - No instance state
 * - Dependencies passed as parameters (class methods)
 * - Module-level deps for wrapper functions
 *
 * Note: document.querySelector, document.getElementById are browser APIs,
 * not dependencies - they cannot be injected (but can be overridden for testing).
 *
 * @module modules/task/taskUtils
 */

import { createDIModule, optional } from '../core/diBase.js';
import {
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS
} from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TaskUtils', {
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    generateId: optional(null),
    remindOverdueTasks: optional(null),
    enableDragAndDropOnTask: optional(null),
    updateMoveArrowsVisibility: optional(null),
    saveTaskToSchema25: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskUtils wrapper functions
 * @param {Object} dependencies - { AppState, loadMiniCycleData, generateId, remindOverdueTasks, enableDragAndDropOnTask, updateMoveArrowsVisibility, saveTaskToSchema25 }
 */
export function setTaskUtilsDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🛠️ TaskUtils dependencies set:', Object.keys(dependencies));
}

export class TaskUtils {
    /**
     * Build task context from DOM element
     * @param {HTMLElement} taskItem - Task DOM element
     * @param {string} taskId - Task ID
     * @param {Object} AppState - AppState instance
     * @returns {Object|null} - Task context object
     */
    static buildTaskContext(taskItem, taskId, AppState) {
        try {
            // Check if AppState is ready
            if (!AppState?.isReady?.()) {
                console.warn('⚠️ AppState not ready for buildTaskContext');
                return null;
            }

            const state = AppState.get();
            const activeCycleId = state.appState?.activeCycleId;

            if (!activeCycleId) return null;

            const currentCycle = state.data?.cycles?.[activeCycleId];
            if (!currentCycle) return null;

            const taskText = taskItem.querySelector('.task-text')?.textContent?.trim() || '';

            return {
                taskTextTrimmed: taskText,
                assignedTaskId: taskId,
                schemaData: state, // Pass the full state for backward compatibility
                cycles: state.data.cycles,
                activeCycle: activeCycleId,
                currentCycle,
                settings: state.settings || {},
                autoResetEnabled: currentCycle.autoReset || false,
                deleteCheckedEnabled: currentCycle.deleteCheckedTasks || false
            };
        } catch (error) {
            console.warn('⚠️ Failed to build task context:', error);
            return null;
        }
    }

    /**
     * Extract task data from DOM
     * @param {Function} getElementById - Function to get element by ID
     * @returns {Array} - Array of task objects
     */
    static extractTaskDataFromDOM(getElementById = (id) => document.getElementById(id)) {
        const taskListElement = getElementById('taskList');
        if (!taskListElement) {
            console.warn('⚠️ Task list element not found');
            return [];
        }

        return [...taskListElement.children].map(taskElement => {
            const taskTextElement = taskElement.querySelector(".task-text");
            const taskId = taskElement.dataset.taskId;

            if (!taskTextElement || !taskId) {
                console.warn("⚠️ Skipping invalid task element");
                return null;
            }

            // Extract recurring settings safely
            let recurringSettings = {};
            try {
                const settingsAttr = taskElement.getAttribute("data-recurring-settings");
                if (settingsAttr) {
                    recurringSettings = JSON.parse(settingsAttr);
                }
            } catch (err) {
                console.warn("⚠️ Invalid recurring settings, using empty object");
            }

            // Extract deleteWhenCompleteSettings from data attribute or use defaults
            let deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
            const settingsAttr = taskElement.dataset.deleteWhenCompleteSettings;
            if (settingsAttr) {
                try {
                    deleteWhenCompleteSettings = JSON.parse(settingsAttr);
                } catch (err) {
                    console.warn("⚠️ Invalid deleteWhenCompleteSettings, using defaults");
                }
            }

            return {
                id: taskId,
                text: taskTextElement.textContent,
                completed: taskElement.querySelector("input[type='checkbox']")?.checked || false,
                dueDate: taskElement.querySelector(".due-date")?.value || null,
                highPriority: taskElement.classList.contains("high-priority"),
                remindersEnabled: taskElement.querySelector(".enable-task-reminders")?.classList.contains("reminder-active") || false,
                recurring: taskElement.querySelector(".recurring-btn")?.classList.contains("active") || false,
                recurringSettings,
                deleteWhenComplete: taskElement.dataset.deleteWhenComplete === "true" || false,
                deleteWhenCompleteSettings: deleteWhenCompleteSettings,
                schemaVersion: 2
            };
        }).filter(Boolean);
    }

    /**
     * Load task context from schema data
     * @param {string} taskTextTrimmed - Sanitized task text
     * @param {string} taskId - Task ID (optional, will generate if not provided)
     * @param {Object} taskOptions - Additional task options
     * @param {boolean} isLoading - Whether task is being loaded (vs created)
     * @param {Function} loadMiniCycleData - Function to load data
     * @param {Function} generateId - Function to generate ID
     * @returns {Object} - Task context object
     */
    static loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading = false, loadMiniCycleData, generateId) {
        console.log('📝 Loading task context (Schema 2.5 only)...');

        const schemaData = loadMiniCycleData();
        if (!schemaData) {
            console.warn('⚠️ Schema 2.5 data required for loadTaskContext');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle, settings, reminders } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!activeCycle || !currentCycle) {
            console.warn("⚠️ No active cycle found in Schema 2.5 for loadTaskContext");
            throw new Error('No active cycle found');
        }

        console.log('📊 Active cycle found:', activeCycle);

        const assignedTaskId = taskId || (generateId ? generateId() : `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
        console.log('🆔 Assigned task ID:', assignedTaskId);

        return {
            taskTextTrimmed,
            assignedTaskId,
            schemaData,
            cycles,
            activeCycle,
            currentCycle,
            settings,
            reminders,
            cycleTasks: currentCycle.tasks || [],
            autoResetEnabled: currentCycle.autoReset || false,
            remindersEnabledGlobal: reminders?.enabled === true,
            deleteCheckedEnabled: currentCycle.deleteCheckedTasks || false,
            isLoading,  // ✅ Pass through isLoading flag
            ...taskOptions
        };
    }

    /**
     * Create or update task data in the cycle
     * @param {Object} taskContext - Task context from loadTaskContext
     * @param {Function} saveTaskToSchema25 - Function to save task
     * @returns {Object} - Task data object
     */
    static createOrUpdateTaskData(taskContext, saveTaskToSchema25) {
        const {
            cycleTasks, assignedTaskId, taskTextTrimmed, completed, dueDate,
            highPriority, remindersEnabled, recurring, recurringSettings,
            currentCycle, cycles, activeCycle, isLoading, deleteWhenComplete,
            deleteWhenCompleteSettings
        } = taskContext;

        let existingTask = cycleTasks.find(task => task.id === assignedTaskId);

        if (!existingTask) {
            console.log('📋 Creating new task in Schema 2.5');

            // Mode-specific deleteWhenComplete architecture:
            // - Active value synced with current mode
            // - Settings object stores preference per mode
            const isToDoMode = currentCycle.deleteCheckedTasks === true;

            // Use provided settings or defaults
            const finalSettings = deleteWhenCompleteSettings || { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };

            // Active value based on current mode (unless explicitly provided)
            const activeDeleteWhenComplete = deleteWhenComplete !== undefined ?
                deleteWhenComplete :
                (isToDoMode ? finalSettings.todo : finalSettings.cycle);

            existingTask = {
                id: assignedTaskId,
                text: taskTextTrimmed,
                completed,
                dueDate,
                highPriority,
                remindersEnabled,
                recurring,
                recurringSettings,
                deleteWhenComplete: activeDeleteWhenComplete,
                deleteWhenCompleteSettings: finalSettings,
                schemaVersion: 2
            };

            // Only push to cycle data if NOT loading (prevents duplicate tasks)
            if (!isLoading) {
                currentCycle.tasks.push(existingTask);
            } else {
                console.log('⏭️ Skipping push to currentCycle.tasks during load (task already in AppState)');
            }

            // Handle recurring template creation
            if (recurring && recurringSettings) {
                console.log('🔁 Saving recurring template');

                if (!currentCycle.recurringTemplates) {
                    currentCycle.recurringTemplates = {};
                }

                currentCycle.recurringTemplates[assignedTaskId] = {
                    id: assignedTaskId,
                    text: taskTextTrimmed,
                    recurring: true,
                    recurringSettings: structuredClone(recurringSettings),
                    highPriority: highPriority || false,
                    dueDate: dueDate || null,
                    remindersEnabled: remindersEnabled || false,
                    deleteWhenComplete: true, // Recurring tasks always auto-remove
                    deleteWhenCompleteSettings: { ...DEFAULT_RECURRING_DELETE_SETTINGS },
                    lastTriggeredTimestamp: null,
                    schemaVersion: 2
                };
            }

            // Only save to AppState if NOT loading from saved data
            if (!isLoading && saveTaskToSchema25) {
                saveTaskToSchema25(activeCycle, currentCycle);
                console.log('💾 Task saved to Schema 2.5');
            } else if (!isLoading) {
                console.warn('⚠️ saveTaskToSchema25 not available - task not persisted');
            } else {
                console.log('⏭️ Skipping save during load (isLoading=true)');
            }
        }

        return existingTask;
    }

    /**
     * Scroll to newly created task
     * @param {HTMLElement} taskList - Task list element
     * @param {Function} querySelector - Function to query DOM
     */
    static scrollToNewTask(taskList, querySelector = (sel) => document.querySelector(sel)) {
        const taskListContainer = querySelector(".task-list-container");
        if (taskListContainer && taskList) {
            taskListContainer.scrollTo({
                top: taskList.scrollHeight,
                behavior: "smooth"
            });
        }
    }

    /**
     * Handle overdue task styling
     * @param {HTMLElement} taskItem - Task DOM element
     * @param {boolean} completed - Whether task is completed
     */
    static handleOverdueStyling(taskItem, completed) {
        setTimeout(() => {
            if (completed) {
                taskItem.classList.remove("overdue-task");
            }
        }, 300);
    }

    /**
     * Setup final task interactions (drag/drop, arrows)
     * @param {HTMLElement} taskItem - Task DOM element
     * @param {boolean} isLoading - Whether task is being loaded
     * @param {Object} deps - Dependencies object { remindOverdueTasks, enableDragAndDropOnTask, updateMoveArrowsVisibility }
     */
    static setupFinalTaskInteractions(taskItem, isLoading, deps = {}) {
        // Use provided deps (DI-pure - no window.* fallbacks)
        const { remindOverdueTasks, enableDragAndDropOnTask, updateMoveArrowsVisibility } = deps;

        // Remind overdue tasks after a delay (only if not loading)
        if (!isLoading) {
            setTimeout(() => {
                if (typeof remindOverdueTasks === 'function') {
                    remindOverdueTasks();
                }
            }, 1000);
        }

        // Enable drag and drop
        if (typeof enableDragAndDropOnTask === 'function') {
            enableDragAndDropOnTask(taskItem);
        } else {
            console.warn('⚠️ enableDragAndDropOnTask function not available');
        }

        // Update move arrows visibility
        if (typeof updateMoveArrowsVisibility === 'function') {
            updateMoveArrowsVisibility();
        }
    }
}

// ============================================
// Wrapper Functions (use module-level _deps)
// ============================================

function buildTaskContext(taskItem, taskId) {
    const AppState = _deps.AppState;
    if (!AppState) {
        console.warn('⚠️ AppState not injected for buildTaskContext');
        return null;
    }
    return TaskUtils.buildTaskContext(taskItem, taskId, AppState);
}

function extractTaskDataFromDOM() {
    return TaskUtils.extractTaskDataFromDOM();
}

function loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading = false) {
    const loadMiniCycleData = _deps.loadMiniCycleData;
    const generateId = _deps.generateId;
    if (!loadMiniCycleData) {
        console.warn('⚠️ loadMiniCycleData not injected for loadTaskContext');
        throw new Error('loadMiniCycleData dependency not available');
    }
    return TaskUtils.loadTaskContext(
        taskTextTrimmed,
        taskId,
        taskOptions,
        isLoading,
        loadMiniCycleData,
        generateId
    );
}

function scrollToNewTask(taskList) {
    TaskUtils.scrollToNewTask(taskList);
}

function handleOverdueStyling(taskItem, completed) {
    TaskUtils.handleOverdueStyling(taskItem, completed);
}

function setupFinalTaskInteractions(taskItem, isLoading) {
    TaskUtils.setupFinalTaskInteractions(taskItem, isLoading, {
        remindOverdueTasks: _deps.remindOverdueTasks,
        enableDragAndDropOnTask: _deps.enableDragAndDropOnTask,
        updateMoveArrowsVisibility: _deps.updateMoveArrowsVisibility
    });
}

function createOrUpdateTaskData(taskContext) {
    const saveTaskToSchema25 = _deps.saveTaskToSchema25;
    return TaskUtils.createOrUpdateTaskData(taskContext, saveTaskToSchema25);
}

// ============================================
// Exports
// ============================================

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🛠️ TaskUtils module loaded (DI-pure, no window.* exports)');

// ES6 exports
export {
    buildTaskContext,
    extractTaskDataFromDOM,
    loadTaskContext,
    createOrUpdateTaskData,
    scrollToNewTask,
    handleOverdueStyling,
    setupFinalTaskInteractions
};
