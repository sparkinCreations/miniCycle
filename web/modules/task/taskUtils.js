/**
 * 🛠️ miniCycle Task Utilities
 * Utility functions for task operations (context building, DOM extraction, scrolling, etc.)
 *
 * Pattern: Static Utilities 🔧
 * - Pure utility functions
 * - No instance state
 * - Dependencies passed as parameters
 *
 * @module modules/task/taskUtils
 * @version 1.381
 */

// Import constants
import {
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS
} from '../core/constants.js';

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
     */
    static setupFinalTaskInteractions(taskItem, isLoading) {
        // Remind overdue tasks after a delay (only if not loading)
        if (!isLoading) {
            setTimeout(() => {
                if (typeof window.remindOverdueTasks === 'function') {
                    window.remindOverdueTasks();
                }
            }, 1000);
        }

        // Enable drag and drop
        if (typeof window.enableDragAndDropOnTask === 'function') {
            window.enableDragAndDropOnTask(taskItem);
        } else {
            console.warn('⚠️ enableDragAndDropOnTask function not available');
        }

        // Update move arrows visibility
        if (typeof window.updateMoveArrowsVisibility === 'function') {
            window.updateMoveArrowsVisibility();
        }
    }
}

// ============================================
// Wrapper Functions for Global Access
// ============================================

function buildTaskContext(taskItem, taskId) {
    return TaskUtils.buildTaskContext(taskItem, taskId, window.AppState);
}

function extractTaskDataFromDOM() {
    return TaskUtils.extractTaskDataFromDOM();
}

function loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading = false) {
    return TaskUtils.loadTaskContext(
        taskTextTrimmed,
        taskId,
        taskOptions,
        isLoading,
        window.loadMiniCycleData,
        window.generateId
    );
}

function scrollToNewTask(taskList) {
    TaskUtils.scrollToNewTask(taskList);
}

function handleOverdueStyling(taskItem, completed) {
    TaskUtils.handleOverdueStyling(taskItem, completed);
}

function setupFinalTaskInteractions(taskItem, isLoading) {
    TaskUtils.setupFinalTaskInteractions(taskItem, isLoading);
}

// ============================================
// Exports
// ============================================

// Phase 2 Step 9 - Clean exports (no window.* pollution)
console.log('🛠️ TaskUtils module loaded (Phase 2 - no window.* exports)');

// ES6 exports
export {
    buildTaskContext,
    extractTaskDataFromDOM,
    loadTaskContext,
    scrollToNewTask,
    handleOverdueStyling,
    setupFinalTaskInteractions
};
