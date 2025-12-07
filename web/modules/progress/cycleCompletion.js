/**
 * Cycle Completion Module (DI-Pure)
 *
 * Handles cycle completion animations, milestone tracking, rewards,
 * progress bar updates, and cycle completion checking.
 *
 * @module progress/cycleCompletion
 */

// Module-level dependencies (set via setCycleCompletionDependencies)
let deps = {
    AppState: null,
    showNotification: null,
    updateStatsPanel: null,
    unlockDarkOceanTheme: null,
    unlockGoldenGlowTheme: null,
    unlockMiniGame: null,
    // For updateProgressBar and checkMiniCycle
    getTaskList: null,           // () => taskList element
    getProgressBar: null,        // () => progressBar element
    assignCycleVariables: null,  // () => { lastUsedMiniCycle, savedMiniCycles }
    resetTasks: null             // () => void
};

/**
 * Set dependencies for cycle completion functions.
 * @param {Object} dependencies - Injected dependencies
 */
export function setCycleCompletionDependencies(dependencies) {
    deps = { ...deps, ...dependencies };
    console.log('🎯 CycleCompletion dependencies set:', Object.keys(dependencies));
}

/**
 * Shows a completion animation when a cycle is finished.
 */
export function showCompletionAnimation() {
    const animation = document.createElement("div");
    animation.classList.add("mini-cycle-complete-animation");
    animation.innerHTML = "✔";

    document.body.appendChild(animation);

    // Remove the animation after 1.5 seconds
    setTimeout(() => {
        animation.remove();
    }, 1500);
}

/**
 * Checks if a milestone level has been reached and shows a message.
 * @param {string} miniCycleName - The name of the cycle
 * @param {number} cycleCount - The current cycle count
 */
function checkForMilestone(miniCycleName, cycleCount) {
    const milestoneLevels = [10, 25, 50, 100, 200, 500, 1000];

    if (milestoneLevels.includes(cycleCount)) {
        showMilestoneMessage(miniCycleName, cycleCount);
    }
}

/**
 * Displays a milestone achievement message.
 * @param {string} miniCycleName - The name of the cycle
 * @param {number} cycleCount - The number of cycles completed
 */
function showMilestoneMessage(miniCycleName, cycleCount) {
    const message = `🎉 You've completed ${cycleCount} cycles for "${miniCycleName}"! Keep going! 🚀`;

    const milestonePopup = document.createElement("div");
    milestonePopup.classList.add("mini-cycle-milestone");
    milestonePopup.textContent = message;

    document.body.appendChild(milestonePopup);

    // Automatically remove the message after 3 seconds
    setTimeout(() => {
        milestonePopup.remove();
    }, 3000);
}

/**
 * Handles milestone unlocks (themes, games) based on global cycle count.
 * @param {string} miniCycleName - The name of the cycle
 * @param {number} globalCyclesCompleted - Total cycles completed across all cycles
 */
function handleMilestoneUnlocks(miniCycleName, globalCyclesCompleted) {
    console.log('🏆 Handling milestone unlocks (global cycles)...', globalCyclesCompleted);

    if (!deps.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for milestone unlocks');
        return;
    }

    const currentState = deps.AppState.get();
    if (!currentState) {
        console.error('❌ No state data for milestone unlocks');
        return;
    }

    // Show milestone achievement message based on global cycles
    checkForMilestone(miniCycleName, globalCyclesCompleted);

    // Theme unlocks based on GLOBAL cycle count across all cycles
    if (globalCyclesCompleted >= 5 && typeof deps.unlockDarkOceanTheme === 'function') {
        deps.unlockDarkOceanTheme();
    }
    if (globalCyclesCompleted >= 50 && typeof deps.unlockGoldenGlowTheme === 'function') {
        deps.unlockGoldenGlowTheme();
    }

    // Game unlock based on GLOBAL cycle count
    if (globalCyclesCompleted >= 100) {
        const unlockedFeatures = currentState.settings?.unlockedFeatures || [];
        const hasGameUnlock = unlockedFeatures.includes("task-order-game");

        if (!hasGameUnlock) {
            if (typeof deps.showNotification === 'function') {
                deps.showNotification("🎮 Game Unlocked! 'Task Order' is now available in the Games menu.", "success", 6000);
            }
            if (typeof deps.unlockMiniGame === 'function') {
                deps.unlockMiniGame();
            }
        }
    }

    console.log('✅ Milestone unlocks processed (global cycles)');
}

/**
 * Increments the cycle count for the active cycle.
 * Updates state, handles milestones, and shows completion animation.
 *
 * @param {string} miniCycleName - Deprecated, kept for backwards compatibility
 * @param {Object} savedMiniCycles - Deprecated, kept for backwards compatibility
 */
export function incrementCycleCount(miniCycleName, savedMiniCycles) {
    console.log('🔢 Incrementing cycle count (Schema 2.5 state-based)...');

    if (!deps.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for incrementCycleCount');
        return;
    }

    const currentState = deps.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for incrementCycleCount');
        return;
    }

    const { data, appState } = currentState;
    const activeCycle = appState.activeCycleId;
    const cycleData = data.cycles[activeCycle];

    if (!activeCycle || !cycleData) {
        console.error('❌ No active cycle found for incrementCycleCount');
        return;
    }

    console.log('📊 Current cycle count:', cycleData.cycleCount || 0);

    // Update through state module and get the actual new count
    let actualNewCount;
    deps.AppState.update(state => {
        const cycle = state.data.cycles[activeCycle];
        if (cycle) {
            cycle.cycleCount = (cycle.cycleCount || 0) + 1;
            actualNewCount = cycle.cycleCount;

            // Update user progress
            state.userProgress.cyclesCompleted = (state.userProgress.cyclesCompleted || 0) + 1;
        }
    }, true); // immediate save

    console.log(`✅ Cycle count updated (state-based) for "${activeCycle}": ${actualNewCount}`);

    // Handle milestone rewards with the global cycle count
    const globalCyclesCompleted = currentState.userProgress.cyclesCompleted;
    handleMilestoneUnlocks(activeCycle, globalCyclesCompleted);

    // Show animation + update stats
    showCompletionAnimation();

    if (typeof deps.updateStatsPanel === 'function') {
        deps.updateStatsPanel();
    }
}

/**
 * Updates the progress bar to reflect current task completion.
 * Animates the width transition smoothly.
 */
export function updateProgressBar() {
    const taskList = deps.getTaskList?.();
    const progressBar = deps.getProgressBar?.();

    if (!taskList || !progressBar) {
        console.warn('⚠️ updateProgressBar: taskList or progressBar not available');
        return;
    }

    const totalTasks = taskList.children.length;
    const completedTasks = [...taskList.children].filter(task => task.querySelector("input")?.checked).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Add consistent animation for all progress updates
    progressBar.style.transition = "width 0.2s ease-out";
    progressBar.style.width = `${progress}%`;

    // Clear transition after animation
    setTimeout(() => {
        progressBar.style.transition = "";
    }, 200);
}

/**
 * Checks if all tasks in the miniCycle are completed.
 * If auto-reset is enabled, resets tasks after completion.
 * Updates progress bar and stats panel.
 */
export function checkMiniCycle() {
    // Early return if AppState not ready to prevent initialization race conditions
    if (!deps.AppState?.isReady?.()) {
        console.log('⏳ checkMiniCycle deferred - AppState not ready');
        return;
    }

    const taskList = deps.getTaskList?.();
    if (!taskList) {
        console.warn('⚠️ checkMiniCycle: taskList not available');
        return;
    }

    const allCompleted = [...taskList.children].every(task => task.querySelector("input")?.checked);

    // Retrieve miniCycle variables
    const cycleVars = deps.assignCycleVariables?.();
    if (!cycleVars) {
        console.warn("⚠️ No cycle variables available.");
        return;
    }

    const { lastUsedMiniCycle, savedMiniCycles } = cycleVars;
    let cycleData = savedMiniCycles[lastUsedMiniCycle];

    if (!lastUsedMiniCycle || !cycleData) {
        console.warn("⚠️ No active miniCycle found.");
        return;
    }

    updateProgressBar();

    // Only trigger reset if ALL tasks are completed AND autoReset is enabled
    if (allCompleted && taskList.children.length > 0) {
        console.log(`✅ All tasks completed for "${lastUsedMiniCycle}"`);

        // Auto-reset: Only reset if AutoReset is enabled
        if (cycleData.autoReset) {
            console.log(`🔄 AutoReset is ON. Resetting tasks for "${lastUsedMiniCycle}"...`);
            setTimeout(() => {
                deps.resetTasks?.();
            }, 1000);
            return;
        }
    }

    console.log("ran check MiniCycle function");
    updateProgressBar();

    if (typeof deps.updateStatsPanel === 'function') {
        deps.updateStatsPanel();
    }

    console.log("ran check MiniCycle function2");
}
