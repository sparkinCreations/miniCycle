/**
 * 🎯 miniCycle Namespace Module
 * Consolidates 163+ global window.* assignments into organized namespace
 *
 * Pattern: Single Namespace 🏗️
 * - Reduces global pollution from 163 names → 1 (window.miniCycle)
 * - Provides backward compatibility layer
 * - Improves code organization and IDE autocomplete
 * - Follows industry best practices (jQuery, lodash pattern)
 *
 * @module modules/core/namespace
 * @version 1.357
 */

/**
 * Main namespace object
 * All miniCycle functionality accessible via window.miniCycle.*
 */
export function initializeNamespace() {
    console.log('🎯 Initializing miniCycle namespace...');

    // Initialize the main namespace
    window.miniCycle = {
        version: '1.357',
        _deprecationWarnings: new Set(), // Track shown warnings to avoid spam

        // ============================================
        // STATE MANAGEMENT
        // ============================================
        state: {
            /**
             * Get current app state
             * @returns {Object} Current state object
             */
            get: () => {
                return window.AppState?.get?.() || null;
            },

            /**
             * Update app state
             * @param {Function} updateFn - Function to modify state
             * @param {boolean} immediate - Force immediate save
             */
            update: async (updateFn, immediate = false) => {
                if (!window.AppState?.update) {
                    console.error('❌ AppState not initialized');
                    return;
                }
                return await window.AppState.update(updateFn, immediate);
            },

            /**
             * Check if state is ready
             * @returns {boolean} True if state is initialized
             */
            isReady: () => {
                return window.AppState?.isReady?.() || false;
            },

            /**
             * Get active cycle
             * @returns {Object|null} Active cycle or null
             */
            getActiveCycle: () => {
                return window.AppState?.getActiveCycle?.() || null;
            },

            /**
             * Get tasks from active cycle
             * @returns {Array} Array of tasks
             */
            getTasks: () => {
                return window.AppState?.getTasks?.() || [];
            },

            /**
             * Debug state (logs current state to console)
             */
            debug: () => {
                if (typeof window.debugAppState === 'function') {
                    window.debugAppState();
                } else {
                    console.log('Current state:', window.miniCycle.state.get());
                }
            }
        },

        // ============================================
        // TASK OPERATIONS
        // ============================================
        tasks: {
            /**
             * Add a new task
             * @param {string} text - Task text
             * @param {boolean} completed - Completion state
             * @param {boolean} shouldSave - Save to storage
             * @param {string} dueDate - Due date
             * @param {boolean} highPriority - Priority flag
             * @param {boolean} isLoading - Loading flag
             * @param {boolean} remindersEnabled - Reminders flag
             * @param {boolean} recurring - Recurring flag
             * @param {string} id - Task ID
             * @param {Object} recurringSettings - Recurring settings
             * @param {boolean} deferAppend - Defer DOM append
             * @param {DocumentFragment} targetContainer - Target container
             * @returns {string|null} Task ID or null
             */
            add: (...args) => {
                if (typeof window.addTask === 'function') {
                    return window.addTask(...args);
                }
                console.error('❌ addTask function not available');
                return null;
            },

            /**
             * Edit an existing task
             * @param {HTMLElement} item - Task DOM element
             */
            edit: (item) => {
                if (typeof window.editTask === 'function') {
                    window.editTask(item);
                } else {
                    console.error('❌ editTask function not available');
                }
            },

            /**
             * Delete a task
             * @param {HTMLElement} item - Task DOM element
             */
            delete: (item) => {
                if (typeof window.deleteTask === 'function') {
                    window.deleteTask(item);
                } else {
                    console.error('❌ deleteTask function not available');
                }
            },

            /**
             * Validate and sanitize task input
             * @param {string} input - Raw task text
             * @returns {Object} Validation result
             */
            validate: (input) => {
                if (typeof window.validateAndSanitizeTaskInput === 'function') {
                    return window.validateAndSanitizeTaskInput(input);
                }
                console.error('❌ validateAndSanitizeTaskInput not available');
                return { isValid: false, sanitized: '', error: 'Validator not loaded' };
            },

            /**
             * Render tasks to DOM
             * @param {Array} tasks - Array of task objects
             */
            render: async (tasks) => {
                if (typeof window.renderTasks === 'function') {
                    await window.renderTasks(tasks);
                } else {
                    console.error('❌ renderTasks function not available');
                }
            },

            /**
             * Refresh task list UI
             */
            refresh: async () => {
                if (typeof window.refreshTaskListUI === 'function') {
                    await window.refreshTaskListUI();
                } else if (typeof window.refreshUIFromState === 'function') {
                    await window.refreshUIFromState();
                } else {
                    console.error('❌ refresh functions not available');
                }
            },

            /**
             * Move task to completed section
             * @param {HTMLElement} item - Task DOM element
             */
            moveToCompleted: (item) => {
                if (typeof window.moveTaskToCompleted === 'function') {
                    window.moveTaskToCompleted(item);
                } else {
                    console.error('❌ moveTaskToCompleted not available');
                }
            },

            /**
             * Move task to active section
             * @param {HTMLElement} item - Task DOM element
             */
            moveToActive: (item) => {
                if (typeof window.moveTaskToActive === 'function') {
                    window.moveTaskToActive(item);
                } else {
                    console.error('❌ moveTaskToActive not available');
                }
            }
        },

        // ============================================
        // CYCLE OPERATIONS
        // ============================================
        cycles: {
            /**
             * Create a new cycle
             * @returns {Promise<string|null>} New cycle ID or null
             */
            create: async () => {
                if (typeof window.createNewMiniCycle === 'function') {
                    return await window.createNewMiniCycle();
                }
                console.error('❌ createNewMiniCycle not available');
                return null;
            },

            /**
             * Switch to a different cycle
             * @param {string} cycleId - Cycle ID to switch to
             */
            switch: async (cycleId) => {
                if (typeof window.switchMiniCycle === 'function') {
                    await window.switchMiniCycle(cycleId);
                } else {
                    console.error('❌ switchMiniCycle not available');
                }
            },

            /**
             * Delete a cycle
             * @param {string} cycleId - Cycle ID to delete
             */
            delete: async (cycleId) => {
                if (typeof window.deleteMiniCycle === 'function') {
                    await window.deleteMiniCycle(cycleId);
                } else {
                    console.error('❌ deleteMiniCycle not available');
                }
            },

            /**
             * Rename a cycle
             * @param {string} cycleId - Cycle ID to rename
             * @param {string} newName - New cycle name
             */
            rename: async (cycleId, newName) => {
                if (typeof window.renameMiniCycle === 'function') {
                    await window.renameMiniCycle(cycleId, newName);
                } else {
                    console.error('❌ renameMiniCycle not available');
                }
            },

            /**
             * Load cycle data
             * @returns {Object|null} Cycle data or null
             */
            load: () => {
                if (typeof window.loadMiniCycleData === 'function') {
                    return window.loadMiniCycleData();
                }
                console.error('❌ loadMiniCycleData not available');
                return null;
            },

            /**
             * Get list of all cycles
             * @returns {Array} Array of cycle objects
             */
            list: () => {
                if (typeof window.loadMiniCycleList === 'function') {
                    return window.loadMiniCycleList();
                }
                console.error('❌ loadMiniCycleList not available');
                return [];
            },

            /**
             * Check/complete current cycle
             */
            check: async () => {
                if (typeof window.checkMiniCycle === 'function') {
                    await window.checkMiniCycle();
                } else {
                    console.error('❌ checkMiniCycle not available');
                }
            },

            /**
             * Increment cycle completion count
             * @param {string} cycleId - Cycle ID
             * @param {number} count - Number of cycles to increment
             */
            incrementCount: (cycleId, count) => {
                if (typeof window.incrementCycleCount === 'function') {
                    window.incrementCycleCount(cycleId, count);
                } else {
                    console.error('❌ incrementCycleCount not available');
                }
            }
        },

        // ============================================
        // UI OPERATIONS
        // ============================================
        ui: {
            /**
             * Notifications API
             */
            notifications: {
                /**
                 * Show a notification
                 * @param {string} message - Notification message
                 * @param {string} type - Notification type (success, error, info)
                 * @param {number} duration - Duration in ms
                 */
                show: (message, type = 'info', duration = 3000) => {
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(message, type, duration);
                    } else {
                        console.warn(`[${type}] ${message}`);
                    }
                },

                /**
                 * Show notification with educational tip
                 * @param {Object} config - Notification config
                 */
                showWithTip: (config) => {
                    if (typeof window.showNotificationWithTip === 'function') {
                        window.showNotificationWithTip(config);
                    } else {
                        window.miniCycle.ui.notifications.show(config.message, config.type);
                    }
                }
            },

            /**
             * Modal dialogs API
             */
            modals: {
                /**
                 * Show confirmation modal
                 * @param {Object} config - Modal configuration
                 * @returns {Promise<boolean>} User confirmed or not
                 */
                confirm: (config) => {
                    if (typeof window.showConfirmationModal === 'function') {
                        return window.showConfirmationModal(config);
                    }
                    console.error('❌ showConfirmationModal not available');
                    return Promise.resolve(false);
                },

                /**
                 * Show prompt modal
                 * @param {Object} config - Modal configuration
                 * @returns {Promise<string|null>} User input or null
                 */
                prompt: (config) => {
                    if (typeof window.showPromptModal === 'function') {
                        return window.showPromptModal(config);
                    }
                    console.error('❌ showPromptModal not available');
                    return Promise.resolve(null);
                },

                /**
                 * Close all open modals
                 */
                closeAll: () => {
                    if (typeof window.closeAllModals === 'function') {
                        window.closeAllModals();
                    } else {
                        console.warn('⚠️ closeAllModals not available');
                    }
                }
            },

            /**
             * Loading indicators API
             */
            loader: {
                /**
                 * Show loader with message
                 * @param {string} message - Loading message
                 */
                show: (message = 'Loading...') => {
                    if (typeof window.showLoader === 'function') {
                        window.showLoader(message);
                    }
                },

                /**
                 * Hide loader
                 */
                hide: () => {
                    if (typeof window.hideLoader === 'function') {
                        window.hideLoader();
                    }
                },

                /**
                 * Execute function with loader
                 * @param {Function} fn - Async function to execute
                 * @param {string} message - Loading message
                 */
                with: async (fn, message = 'Loading...') => {
                    if (typeof window.withLoader === 'function') {
                        return await window.withLoader(fn, message);
                    } else {
                        window.miniCycle.ui.loader.show(message);
                        try {
                            return await fn();
                        } finally {
                            window.miniCycle.ui.loader.hide();
                        }
                    }
                }
            },

            /**
             * Progress bar API
             */
            progress: {
                /**
                 * Update progress bar
                 */
                update: () => {
                    if (typeof window.updateProgressBar === 'function') {
                        window.updateProgressBar();
                    }
                }
            }
        },

        // ============================================
        // UTILITIES
        // ============================================
        utils: {
            /**
             * Safe DOM operations
             */
            dom: {
                /**
                 * Safely add event listener
                 * @param {HTMLElement} element - Target element
                 * @param {string} event - Event name
                 * @param {Function} handler - Event handler
                 * @param {Object} options - Event options
                 */
                addListener: (element, event, handler, options) => {
                    if (typeof window.safeAddEventListener === 'function') {
                        window.safeAddEventListener(element, event, handler, options);
                    } else if (element?.addEventListener) {
                        element.addEventListener(event, handler, options);
                    }
                },

                /**
                 * Safely remove event listener
                 * @param {HTMLElement} element - Target element
                 * @param {string} event - Event name
                 * @param {Function} handler - Event handler
                 */
                removeListener: (element, event, handler) => {
                    if (typeof window.safeRemoveEventListener === 'function') {
                        window.safeRemoveEventListener(element, event, handler);
                    } else if (element?.removeEventListener) {
                        element.removeEventListener(event, handler);
                    }
                },

                /**
                 * Safely get element by ID
                 * @param {string} id - Element ID
                 * @returns {HTMLElement|null} Element or null
                 */
                getById: (id) => {
                    if (typeof window.safeGetElementById === 'function') {
                        return window.safeGetElementById(id);
                    }
                    return document.getElementById(id);
                },

                /**
                 * Safely query selector all
                 * @param {string} selector - CSS selector
                 * @returns {NodeList} NodeList of elements
                 */
                queryAll: (selector) => {
                    if (typeof window.safeQuerySelectorAll === 'function') {
                        return window.safeQuerySelectorAll(selector);
                    }
                    return document.querySelectorAll(selector);
                },

                /**
                 * Safely add class
                 * @param {HTMLElement} element - Target element
                 * @param {string} className - Class name to add
                 */
                addClass: (element, className) => {
                    if (typeof window.safeAddClass === 'function') {
                        window.safeAddClass(element, className);
                    } else if (element?.classList) {
                        element.classList.add(className);
                    }
                },

                /**
                 * Safely remove class
                 * @param {HTMLElement} element - Target element
                 * @param {string} className - Class name to remove
                 */
                removeClass: (element, className) => {
                    if (typeof window.safeRemoveClass === 'function') {
                        window.safeRemoveClass(element, className);
                    } else if (element?.classList) {
                        element.classList.remove(className);
                    }
                }
            },

            /**
             * Storage operations
             */
            storage: {
                /**
                 * Safely get from localStorage
                 * @param {string} key - Storage key
                 * @param {*} defaultValue - Default value if not found
                 * @returns {*} Stored value or default
                 */
                get: (key, defaultValue = null) => {
                    if (typeof window.safeLocalStorageGet === 'function') {
                        return window.safeLocalStorageGet(key, defaultValue);
                    }
                    try {
                        return localStorage.getItem(key) || defaultValue;
                    } catch {
                        return defaultValue;
                    }
                },

                /**
                 * Safely set to localStorage
                 * @param {string} key - Storage key
                 * @param {*} value - Value to store
                 * @returns {boolean} Success status
                 */
                set: (key, value) => {
                    if (typeof window.safeLocalStorageSet === 'function') {
                        return window.safeLocalStorageSet(key, value);
                    }
                    try {
                        localStorage.setItem(key, value);
                        return true;
                    } catch {
                        return false;
                    }
                },

                /**
                 * Safely remove from localStorage
                 * @param {string} key - Storage key
                 */
                remove: (key) => {
                    if (typeof window.safeLocalStorageRemove === 'function') {
                        window.safeLocalStorageRemove(key);
                    } else {
                        try {
                            localStorage.removeItem(key);
                        } catch (e) {
                            console.warn('Failed to remove from storage:', e);
                        }
                    }
                }
            },

            /**
             * JSON operations
             */
            json: {
                /**
                 * Safely parse JSON
                 * @param {string} str - JSON string
                 * @param {*} defaultValue - Default value on error
                 * @returns {*} Parsed object or default
                 */
                parse: (str, defaultValue = null) => {
                    if (typeof window.safeJSONParse === 'function') {
                        return window.safeJSONParse(str, defaultValue);
                    }
                    try {
                        return JSON.parse(str);
                    } catch {
                        return defaultValue;
                    }
                },

                /**
                 * Safely stringify JSON
                 * @param {*} obj - Object to stringify
                 * @param {string} defaultValue - Default value on error
                 * @returns {string} JSON string or default
                 */
                stringify: (obj, defaultValue = '{}') => {
                    if (typeof window.safeJSONStringify === 'function') {
                        return window.safeJSONStringify(obj, defaultValue);
                    }
                    try {
                        return JSON.stringify(obj);
                    } catch {
                        return defaultValue;
                    }
                }
            },

            /**
             * Input sanitization
             * @param {string} input - Raw input string
             * @param {number} maxLength - Maximum length
             * @returns {string} Sanitized string
             */
            sanitize: (input, maxLength = 1000) => {
                if (typeof window.sanitizeInput === 'function') {
                    return window.sanitizeInput(input, maxLength);
                }
                return String(input || '').slice(0, maxLength);
            },

            /**
             * Escape HTML
             * @param {string} html - Raw HTML string
             * @returns {string} Escaped HTML
             */
            escape: (html) => {
                if (typeof window.escapeHtml === 'function') {
                    return window.escapeHtml(html);
                }
                const div = document.createElement('div');
                div.textContent = html;
                return div.innerHTML;
            },

            /**
             * Generate unique ID
             * @returns {string} Unique ID
             */
            generateId: () => {
                if (typeof window.generateId === 'function') {
                    return window.generateId();
                }
                return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            },

            /**
             * Generate hash ID from string
             * @param {string} str - Input string
             * @returns {string} Hash ID
             */
            generateHashId: (str) => {
                if (typeof window.generateHashId === 'function') {
                    return window.generateHashId(str);
                }
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash = hash & hash;
                }
                return `hash-${Math.abs(hash)}`;
            },

            /**
             * Debounce function
             * @param {Function} fn - Function to debounce
             * @param {number} delay - Delay in ms
             * @returns {Function} Debounced function
             */
            debounce: (fn, delay = 300) => {
                if (typeof window.debounce === 'function') {
                    return window.debounce(fn, delay);
                }
                let timeout;
                return function(...args) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => fn.apply(this, args), delay);
                };
            },

            /**
             * Throttle function
             * @param {Function} fn - Function to throttle
             * @param {number} limit - Time limit in ms
             * @returns {Function} Throttled function
             */
            throttle: (fn, limit = 300) => {
                if (typeof window.throttle === 'function') {
                    return window.throttle(fn, limit);
                }
                let inThrottle;
                return function(...args) {
                    if (!inThrottle) {
                        fn.apply(this, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            }
        },

        // ============================================
        // FEATURES
        // ============================================
        features: {
            /**
             * Theme manager instance
             */
            get themes() {
                return window.themeManager || null;
            },

            /**
             * Games manager instance
             */
            get games() {
                return window.gamesManager || null;
            },

            /**
             * Stats panel manager instance
             */
            get stats() {
                return window.StatsPanelManager || null;
            },

            /**
             * Reminders instance
             */
            get reminders() {
                return window.MiniCycleReminders || null;
            },

            /**
             * Due dates instance
             */
            get dueDates() {
                return window.MiniCycleDueDates || null;
            }
        },

        // ============================================
        // TESTING (Development only)
        // ============================================
        testing: {
            /**
             * Setup testing modal
             */
            setup: () => {
                if (typeof window.setupTestingModal === 'function') {
                    window.setupTestingModal();
                } else {
                    console.warn('⚠️ Testing modal not available');
                }
            },

            /**
             * Run all automated tests
             */
            runAll: () => {
                if (typeof window.runAllAutomatedTests === 'function') {
                    window.runAllAutomatedTests();
                } else {
                    console.warn('⚠️ Automated tests not available');
                }
            }
        }
    };

    console.log('✅ miniCycle namespace initialized');
    console.log('📚 Access API via window.miniCycle.*');
    console.log('   - miniCycle.tasks.*');
    console.log('   - miniCycle.cycles.*');
    console.log('   - miniCycle.state.*');
    console.log('   - miniCycle.ui.*');
    console.log('   - miniCycle.utils.*');
    console.log('   - miniCycle.features.*');
}

/**
 * Create deprecation warning helper
 * @param {string} oldName - Old function name
 * @param {string} newName - New namespaced name
 */
function warnDeprecation(oldName, newName) {
    const key = `${oldName}->${newName}`;

    // Only warn once per deprecated function
    if (window.miniCycle._deprecationWarnings.has(key)) {
        return;
    }

    window.miniCycle._deprecationWarnings.add(key);
    console.warn(
        `⚠️ DEPRECATED: window.${oldName} is deprecated.\n` +
        `   Use window.miniCycle.${newName} instead.\n` +
        `   This will be removed in a future version.`
    );
}

/**
 * Setup backward compatibility layer
 * Maintains existing window.* functions but logs deprecation warnings
 */
export function setupBackwardCompatibility() {
    console.log('🔄 Setting up backward compatibility layer...');

    // Track which functions we've already wrapped
    const wrapped = new Set();

    /**
     * Create a deprecation wrapper
     */
    function wrapDeprecated(oldName, newPath) {
        if (wrapped.has(oldName)) return;
        wrapped.add(oldName);

        const original = window[oldName];
        if (typeof original === 'function') {
            window[oldName] = function(...args) {
                warnDeprecation(oldName, newPath);
                return original.apply(this, args);
            };
        }
    }

    // Wrap most commonly used functions (top 20 by usage)
    wrapDeprecated('showNotification', 'ui.notifications.show()');
    wrapDeprecated('addTask', 'tasks.add()');
    wrapDeprecated('loadMiniCycleData', 'cycles.load()');
    wrapDeprecated('sanitizeInput', 'utils.sanitize()');
    wrapDeprecated('safeAddEventListener', 'utils.dom.addListener()');
    wrapDeprecated('refreshUIFromState', 'tasks.refresh()');
    wrapDeprecated('createNewMiniCycle', 'cycles.create()');
    wrapDeprecated('switchMiniCycle', 'cycles.switch()');
    wrapDeprecated('deleteMiniCycle', 'cycles.delete()');
    wrapDeprecated('safeGetElementById', 'utils.dom.getById()');
    wrapDeprecated('safeLocalStorageGet', 'utils.storage.get()');
    wrapDeprecated('safeLocalStorageSet', 'utils.storage.set()');
    wrapDeprecated('safeJSONParse', 'utils.json.parse()');
    wrapDeprecated('showConfirmationModal', 'ui.modals.confirm()');
    wrapDeprecated('showPromptModal', 'ui.modals.prompt()');
    wrapDeprecated('generateId', 'utils.generateId()');
    wrapDeprecated('debounce', 'utils.debounce()');
    wrapDeprecated('throttle', 'utils.throttle()');
    wrapDeprecated('updateProgressBar', 'ui.progress.update()');
    wrapDeprecated('checkMiniCycle', 'cycles.check()');

    console.log(`✅ Backward compatibility layer active (${wrapped.size} functions wrapped)`);
    console.log('   Deprecated functions will log warnings on first use');
}

// Export for use in main app
export default {
    initializeNamespace,
    setupBackwardCompatibility
};

console.log('🎯 Namespace module loaded');
