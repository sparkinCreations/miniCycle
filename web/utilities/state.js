// state.js
class MiniCycleState {
    constructor() {
        this.data = null;
        this.isDirty = false;
        this.saveTimeout = null;
        this.listeners = new Map();
        this.SAVE_DELAY = 2000; // 2 seconds of no changes before saving
    }

    // Initialize state from localStorage
    async init() {
        console.log('🏗️ Initializing MiniCycle state...');
        
        try {
            const stored = localStorage.getItem("miniCycleData");
            if (stored) {
                this.data = JSON.parse(stored);
                console.log('✅ State loaded from localStorage');
            } else {
                this.data = this.createInitialState();
                console.log('🆕 Created fresh initial state');
            }
            
            this.isDirty = false;
            return this.data;
        } catch (error) {
            console.error('❌ State initialization failed:', error);
            this.data = this.createInitialState();
            return this.data;
        }
    }

    // Get current state (read-only)
    get() {
        return this.data;
    }

    // Update state and trigger UI updates
    update(updateFn, immediate = false) {
        if (!this.data) {
            console.warn('⚠️ State not initialized');
            return;
        }

        const oldData = structuredClone(this.data);
        
        try {
            // Apply update function
            updateFn(this.data);
            
            // Mark as dirty
            this.isDirty = true;
            this.data.metadata.lastModified = Date.now();
            
            // Schedule save (debounced)
            this.scheduleSave(immediate);
            
            // Notify listeners of changes
            this.notifyListeners(oldData, this.data);
            
        } catch (error) {
            console.error('❌ State update failed:', error);
            this.data = oldData; // Rollback on error
        }
    }

    // Schedule a save (debounced)
    scheduleSave(immediate = false) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        const delay = immediate ? 0 : this.SAVE_DELAY;
        
        this.saveTimeout = setTimeout(() => {
            this.save();
        }, delay);
    }

    // Actually save to localStorage
    save() {
        if (!this.isDirty || !this.data) return;

        try {
            localStorage.setItem("miniCycleData", JSON.stringify(this.data));
            this.isDirty = false;
            this.saveTimeout = null;
            console.log('💾 State saved to localStorage');
        } catch (error) {
            console.error('❌ Save failed:', error);
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

    createInitialState() {
        return {
            schemaVersion: "2.5",
            metadata: {
                createdAt: Date.now(),
                lastModified: Date.now(),
                totalCyclesCreated: 0,
                totalTasksCompleted: 0
            },
            settings: {
                theme: 'default',
                darkMode: false,
                alwaysShowRecurring: false,
                autoSave: true,
                showThreeDots: false,
                onboardingCompleted: false,
                unlockedThemes: [],
                unlockedFeatures: [],
                defaultRecurringSettings: {
                    frequency: "daily",
                    indefinitely: true,
                    time: null
                }
            },
            data: {
                cycles: {}
            },
            appState: {
                activeCycleId: null,
                overdueTaskStates: {}
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

// Create global state instance
const AppState = new MiniCycleState();
export default AppState;