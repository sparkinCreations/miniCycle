/**
 * Help Window Manager Module
 *
 * Manages the help window that shows task status and cycle completion messages.
 *
 * @module ui/helpWindowManager
 */

// Module-level dependencies
let deps = {
    loadMiniCycleData: null
};

/**
 * Set dependencies for HelpWindowManager.
 * @param {Object} dependencies - Injected dependencies
 */
export function setHelpWindowManagerDependencies(dependencies) {
    deps = { ...deps, ...dependencies };
    console.log('🎯 HelpWindowManager dependencies set:', Object.keys(dependencies));
}

/**
 * Manages the help window UI component.
 */
export class HelpWindowManager {
    constructor() {
        this.helpWindow = document.getElementById('help-window');
        this.isVisible = false;
        this.currentMessage = null;
        this.isShowingCycleComplete = false;
        this.isShowingModeDescription = false;
        this.modeDescriptionTimeout = null;
        this.initialized = false;

        this.init();
    }

    init() {
        if (!this.helpWindow || this.initialized) {
            if (this.initialized) console.warn('⚠️ HelpWindowManager already initialized');
            return;
        }

        this.initialized = true;

        // Start showing initial message after a delay
        setTimeout(() => {
            this.showConstantMessage();
        }, 3000);

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for checkbox changes on tasks
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.closest('.task')) {
                setTimeout(() => {
                    this.updateConstantMessage();
                }, 50);
            }
        });

        // Listen for click events on tasks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.task')) {
                setTimeout(() => {
                    this.updateConstantMessage();
                }, 100);
            }
        });

        // Listen for task list mutations (task additions/deletions)
        const taskList = document.getElementById('taskList');
        if (taskList) {
            const observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;

                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' &&
                        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                        shouldUpdate = true;
                    }
                });

                if (shouldUpdate) {
                    console.log('📝 Help window: Task list changed');
                    setTimeout(() => {
                        this.updateConstantMessage();
                    }, 200);
                }
            });

            observer.observe(taskList, {
                childList: true,
                subtree: true
            });
        }

        // Listen for custom events
        document.addEventListener('taskCompleted', () => {
            this.updateConstantMessage();
        });

        document.addEventListener('tasksReset', () => {
            this.updateConstantMessage();
        });
    }

    showConstantMessage() {
        this.updateConstantMessage();
        this.show();
    }

    updateConstantMessage() {
        // Don't update if showing cycle completion message or mode description
        if (this.isShowingCycleComplete || this.isShowingModeDescription) return;

        const message = this.getCurrentStatusMessage();

        if (message !== this.currentMessage) {
            this.currentMessage = message;
            if (this.isVisible) {
                this.updateContent(message);
            }
        }
    }

    /**
     * Shows mode description temporarily.
     * @param {string} mode - The mode to describe
     */
    showModeDescription(mode) {
        if (!this.helpWindow) return;

        // Clear any existing timeout
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }

        this.isShowingModeDescription = true;

        const modeDescriptions = {
            'auto-cycle': {
                title: "🔄 Auto Cycle Mode",
                description: "Tasks automatically reset when all are completed."
            },
            'manual-cycle': {
                title: "✔️ Manual Cycle Mode",
                description: "Tasks only reset when you click the Complete button."
            },
            'todo-mode': {
                title: "✓ To-Do Mode",
                description: "Completed tasks are removed when you click Complete."
            }
        };

        const modeInfo = modeDescriptions[mode] || modeDescriptions['auto-cycle'];

        this.helpWindow.innerHTML = `
            <div class="mode-help-content">
                <h4 style="margin: 0 0 8px 0; color: var(--accent-color, #007bff);">${modeInfo.title}</h4>
                <p style="margin: 0; line-height: 1.4;">${modeInfo.description}</p>
            </div>
        `;

        // Show the help window if it's not already visible
        if (!this.isVisible) {
            this.show();
        }

        // Auto-hide after 30 seconds and return to normal message
        this.modeDescriptionTimeout = setTimeout(() => {
            this.isShowingModeDescription = false;
            this.modeDescriptionTimeout = null;
            this.updateConstantMessage();
        }, 30000);

        console.log(`📖 Showing mode description for: ${mode}`);
    }

    /**
     * Shows cycle completion message.
     */
    showCycleCompleteMessage() {
        if (!this.helpWindow) return;

        // Clear mode description if showing
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
            this.isShowingModeDescription = false;
        }

        this.isShowingCycleComplete = true;
        this.helpWindow.innerHTML = `
            <p>✅ Cycle Complete! Tasks reset.</p>
        `;

        // Auto-hide after 2 seconds and return to normal message
        setTimeout(() => {
            this.isShowingCycleComplete = false;
            this.updateConstantMessage();
        }, 2000);
    }

    getCurrentStatusMessage() {
        const totalTasks = document.querySelectorAll('.task').length;
        const completedTasks = document.querySelectorAll('.task input:checked').length;
        const remaining = totalTasks - completedTasks;

        // Get cycle count from Schema 2.5
        let cycleCount = 0;
        const loadData = deps.loadMiniCycleData || window.loadMiniCycleData;

        if (typeof loadData === 'function') {
            const schemaData = window.miniCycle?.state?.load() || loadData();

            if (schemaData) {
                const { cycles, activeCycle } = schemaData;
                const currentCycle = cycles[activeCycle];
                cycleCount = currentCycle?.cycleCount || 0;
            }
        }

        // Return different constant messages based on state
        if (totalTasks === 0) {
            return `📝 Add your first task to get started! • ${cycleCount} cycle${cycleCount === 1 ? '' : 's'} completed`;
        }

        if (remaining === 0 && totalTasks > 0) {
            return `🎉 All tasks complete! • ${cycleCount} cycle${cycleCount === 1 ? '' : 's'} completed`;
        }

        if (cycleCount === 0) {
            return `📋 ${remaining} task${remaining === 1 ? '' : 's'} remaining • Complete your first cycle!`;
        }

        // Show progress and cycle count
        return `📋 ${remaining} task${remaining === 1 ? '' : 's'} remaining • ${cycleCount} cycle${cycleCount === 1 ? '' : 's'} completed`;
    }

    updateContent(message) {
        if (!this.helpWindow) return;

        this.helpWindow.innerHTML = `
            <p>${message}</p>
        `;
    }

    show() {
        if (!this.helpWindow || this.isVisible) return;

        const message = this.currentMessage || this.getCurrentStatusMessage();

        if (!this.isShowingModeDescription && !this.isShowingCycleComplete) {
            this.helpWindow.innerHTML = `
                <p>${message}</p>
            `;
        }

        this.helpWindow.classList.remove('hide');
        this.helpWindow.classList.add('show');
        this.helpWindow.style.display = 'flex';
        this.isVisible = true;
    }

    hide() {
        if (!this.helpWindow || !this.isVisible) return;

        this.helpWindow.classList.remove('show');
        this.helpWindow.classList.add('hide');
        this.isVisible = false;

        setTimeout(() => {
            this.helpWindow.style.display = 'none';
        }, 300);
    }

    destroy() {
        // Clear any active timeouts
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }
    }
}

// Singleton instance
let helpWindowManagerInstance = null;

/**
 * Initialize and get the HelpWindowManager instance.
 * @param {Object} dependencies - Optional dependencies to inject
 * @returns {HelpWindowManager} The manager instance
 */
export function initHelpWindowManager(dependencies = {}) {
    if (dependencies && Object.keys(dependencies).length > 0) {
        setHelpWindowManagerDependencies(dependencies);
    }

    if (!helpWindowManagerInstance) {
        helpWindowManagerInstance = new HelpWindowManager();
    }

    return helpWindowManagerInstance;
}

/**
 * Get the current HelpWindowManager instance (may be null if not initialized).
 * @returns {HelpWindowManager|null}
 */
export function getHelpWindowManager() {
    return helpWindowManagerInstance;
}
