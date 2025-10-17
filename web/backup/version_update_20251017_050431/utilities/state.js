/**
 * Welcome to to miniCycle's state module. Here is state.js
 *
 * This module manages the application state, including loading, updating, and saving state to localStorage.
 * It also provides a way to subscribe to state changes.
 *
 * @module state
 * @version 1.329
 */

// MiniCycleState class definition
class MiniCycleState {
    constructor(dependencies = {}) {
        // ✅ Add dependency injection with fallbacks
        this.deps = {
            showNotification: dependencies.showNotification || console.log.bind(console),
            storage: dependencies.storage || localStorage,
            loadInitialData: dependencies.loadInitialData || (() => null),
            createInitialData: dependencies.createInitialData || (() => this.createInitialState())
        };
        
        // Your existing properties
        this.data = null;
        this.isDirty = false;
        this.saveTimeout = null;
        this.listeners = new Map();
        this.SAVE_DELAY = 600; // ✅ Reduced from 2000ms for faster persistence
        this.version = '1.329';
        this.isInitialized = false; // ✅ Add this flag
    }

    // ✅ FIXED: Move isReady method to proper location
    isReady() {
        return this.isInitialized && this.data !== null;
    }

    // ✅ NEW: Add get method that autoSaveWithStateModule expects
    get() {
        return this.data;
    }

    // ✅ Enhanced init with better data validation
    async init() {
        if (this.isInitialized) {
            console.log('✅ State already initialized');
            return this.data;
        }
        
        console.log('🏗️ Initializing MiniCycle state...');
        
        try {
            // ✅ Check if Schema 2.5 data already exists
            let existingData = null;
            try {
                const stored = this.deps.storage.getItem("miniCycleData");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // ✅ Validate the structure before using
                    if (this.validateSchema25Structure(parsed)) {
                        existingData = parsed;
                        console.log('📦 Found valid existing Schema 2.5 data');
                    } else {
                        console.warn('⚠️ Existing data structure is invalid');
                    }
                }
            } catch (parseError) {
                console.warn('⚠️ Could not parse existing data:', parseError);
            }
            
            // Use existing data or create initial data
            if (existingData) {
                this.data = existingData;
                console.log('✅ Loaded existing Schema 2.5 data');
            } else {
                // ✅ Don't create data if none exists - let the main app handle this
                console.log('⚠️ No valid Schema 2.5 data found - deferring to main app initialization');
                this.data = null;
                this.isInitialized = false;
                return null;
            }
            
            this.isInitialized = true;
            console.log('✅ State initialization completed');
            return this.data;
            
        } catch (error) {
            console.error('❌ State initialization failed:', error);
            this.data = null;
            this.isInitialized = false;
            throw error;
        }
    }
    
    // ✅ Add structure validation method
    validateSchema25Structure(data) {
        try {
            return data &&
                   data.schemaVersion === "2.5" &&
                   data.data &&
                   typeof data.data.cycles === 'object' &&
                   data.appState &&
                   typeof data.appState === 'object';
        } catch (error) {
            console.warn('⚠️ Structure validation failed:', error);
            return false;
        }
    }
    
    // ✅ Add minimal fallback state
    createMinimalFallbackState() {
        return {
            schemaVersion: "2.5",
            metadata: {
                createdAt: Date.now(),
                lastModified: Date.now(),
                schemaVersion: "2.5"
            },
            settings: {
                theme: 'default',
                darkMode: false
            },
            data: { cycles: {} },
            appState: { activeCycleId: null },
            userProgress: { cyclesCompleted: 0 },
            customReminders: { enabled: false }
        };
    }
    
    // ✅ Enhanced update with initialization check - FIXED to be async
    async update(updateFn, immediate = false) {
        if (!this.isInitialized) {
            console.warn('⚠️ State not initialized yet, initializing first...');
            await this.init();
        }
        
        // Your existing update logic stays the same
        if (!this.data) {
            console.warn('⚠️ State not ready for updates');
            return;
        }

        const oldData = structuredClone(this.data);

        try {
            // ✅ FIXED: Call updateFn with this.data, not as async
            console.log('🔄 Updating state...', { immediate });
            const result = updateFn(this.data);

            this.isDirty = true;
            this.data.metadata.lastModified = Date.now();

            console.log('📊 State updated, scheduling save...', { isDirty: this.isDirty, immediate });
            this.scheduleSave(immediate);
            this.notifyListeners(oldData, this.data);

            return result; // Return any result from updateFn
        } catch (error) {
            console.error('❌ State update failed:', error);
            this.data = oldData;
            this.deps.showNotification('State update failed', 'error');
            throw error; // Re-throw so caller knows update failed
        }
    }

    // Schedule a save (debounced)
    scheduleSave(immediate = false) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        if (immediate) {
            // ✅ For immediate saves, call save() synchronously to prevent data loss on quick refresh
            console.log('💾 Immediate save requested - saving synchronously...');
            this.save();
            console.log('✅ Immediate save completed');
        } else {
            // ✅ For normal saves, use debounce delay
            this.saveTimeout = setTimeout(() => {
                this.save();
            }, this.SAVE_DELAY);
        }
    }

    // Actually save to localStorage
    save() {
        if (!this.isDirty) {
            console.log('⏭️ Save skipped - not dirty');
            return;
        }

        if (!this.data) {
            console.log('⏭️ Save skipped - no data');
            return;
        }

        try {
            console.log('💾 Saving to localStorage...', {
                isDirty: this.isDirty,
                dataSize: JSON.stringify(this.data).length,
                timestamp: Date.now()
            });

            this.deps.storage.setItem("miniCycleData", JSON.stringify(this.data));
            this.isDirty = false;
            this.saveTimeout = null;

            console.log('✅ State saved to localStorage successfully');
        } catch (error) {
            console.error('❌ Save failed:', error);
            this.deps.showNotification('Failed to save data', 'error');
        }
    }

    // Force immediate save
    forceSave() {
        this.scheduleSave(true);
    }

    // Subscribe to state changes
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        console.log(`✅ Subscribed to: ${key}`);
    }

    // ✅ NEW: Unsubscribe from state changes (like safeRemoveEventListener)
    unsubscribe(key, callback) {
        if (!this.listeners.has(key)) {
            console.warn(`⚠️ No listeners found for key: ${key}`);
            return false;
        }
        
        const callbacks = this.listeners.get(key);
        const index = callbacks.indexOf(callback);
        
        if (index === -1) {
            console.warn(`⚠️ Callback not found for key: ${key}`);
            return false;
        }
        
        callbacks.splice(index, 1);
        console.log(`✅ Unsubscribed from: ${key}`);
        
        // Clean up empty listener arrays
        if (callbacks.length === 0) {
            this.listeners.delete(key);
            console.log(`🧹 Cleaned up empty listener array for: ${key}`);
        }
        
        return true;
    }

    // ✅ NEW: Safe subscribe (like safeAddEventListener)
    safeSubscribe(key, callback) {
        // Remove any existing instance of this callback first
        this.unsubscribe(key, callback);
        // Then add it fresh
        this.subscribe(key, callback);
        console.log(`✅ Safe subscribed to: ${key}`);
    }

    // ✅ NEW: Unsubscribe all listeners for a key
    unsubscribeAll(key) {
        if (this.listeners.has(key)) {
            const count = this.listeners.get(key).length;
            this.listeners.delete(key);
            console.log(`🧹 Unsubscribed ${count} callbacks for: ${key}`);
            return count;
        }
        console.warn(`⚠️ No listeners found for key: ${key}`);
        return 0;
    }

    // ✅ NEW: Get listener count for debugging
    getListenerCount(key) {
        if (key) {
            return this.listeners.has(key) ? this.listeners.get(key).length : 0;
        }
        // Return total count across all keys
        let total = 0;
        this.listeners.forEach(callbacks => total += callbacks.length);
        return total;
    }

    // Notify all listeners
    notifyListeners(oldData, newData) {
        this.listeners.forEach((callbacks, key) => {
            callbacks.forEach(callback => {
                try {
                    callback(newData, oldData);
                } catch (error) {
                    console.error(`❌ Listener error for ${key}:`, error);
                }
            });
        });
    }

    // Helper methods for common operations
    getActiveCycle() {
        if (!this.data) return null;
        const { data, appState } = this.data;
        return data.cycles[appState.activeCycleId];
    }

    getTasks() {
        const cycle = this.getActiveCycle();
        return cycle?.tasks || [];
    }

    // ✅ NEW: Helper to update active cycle tasks
    updateActiveTasks(taskUpdates) {
        this.update(state => {
            const activeCycle = state.appState.activeCycleId;
            if (activeCycle && state.data.cycles[activeCycle]) {
                Object.assign(state.data.cycles[activeCycle].tasks, taskUpdates);
            }
        });
    }

    // ✅ NEW: Helper to set active cycle
    setActiveCycle(cycleId) {
        this.update(state => {
            state.appState.activeCycleId = cycleId;
        });
    }

    // ✅ FIXED: Moved createInitialState to proper location and enhanced it
    createInitialState() {
        return {
            schemaVersion: "2.5",
            metadata: {
                createdAt: Date.now(),
                lastModified: Date.now(),
                migratedFrom: null,
                migrationDate: null,
                totalCyclesCreated: 0,
                totalTasksCompleted: 0,
                schemaVersion: "2.5"
            },
            settings: {
                theme: 'default',
                darkMode: false,
                alwaysShowRecurring: false,
                autoSave: true,
                showThreeDots: false,
                onboardingCompleted: false,
                dismissedEducationalTips: {},
                defaultRecurringSettings: {
                    frequency: "daily",
                    indefinitely: true,
                    time: null
                },
                unlockedThemes: [],
                unlockedFeatures: [],
                notificationPosition: { x: 0, y: 0 },
                notificationPositionModified: false,
                accessibility: {
                    reducedMotion: false,
                    highContrast: false,
                    screenReaderHints: false
                }
            },
            data: {
                cycles: {} // ✅ This matches what autoSaveWithStateModule expects
            },
            appState: {
                activeCycleId: null, // ✅ This matches what autoSaveWithStateModule expects
                overdueTaskStates: {}
            },
            ui: {
                moveArrowsVisible: false
            },
            userProgress: {
                cyclesCompleted: 0,
                rewardMilestones: []
            },
            customReminders: {
                enabled: false,
                indefinite: false,
                dueDatesReminders: false,
                repeatCount: 0,
                frequencyValue: 30,
                frequencyUnit: "minutes"
            }
        };
    }
}

// ✅ Replace the bottom of your file with this:
let AppState = null;

export function createStateManager(dependencies = {}) {
    if (!AppState) {
        AppState = new MiniCycleState(dependencies);
    }
    return AppState;
}

// ✅ TEST ONLY: Reset singleton for isolated testing
export function resetStateManager() {
    if (AppState) {
        // Clean up listeners
        if (AppState.listeners) {
            AppState.listeners.clear();
        }
    }
    AppState = null;
}

// ✅ For backward compatibility, but this should be initialized
export default function getStateManager() {
    if (!AppState) {
        console.warn('⚠️ State manager not initialized with dependencies');
        AppState = new MiniCycleState(); // Fallback with no deps
    }
    return AppState;
}