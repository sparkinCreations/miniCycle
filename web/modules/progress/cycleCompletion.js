/**
 * Cycle Completion Module (DI-Pure)
 *
 * Handles cycle completion animations, milestone tracking, rewards,
 * progress bar updates, and cycle completion checking.
 *
 * @module progress/cycleCompletion
 *
 * ## Hook Points for Extensions
 *
 * This module provides hook points for history tracking and achievements.
 *
 * ### `incrementCycleCount()` - Lines 199-210
 * Called when a cycle is completed (all tasks done + reset triggered).
 *
 * **Available data at hook point:**
 * - `actualNewCount` - The new cycle count for this routine
 * - `cycleData.name` - The routine name
 * - `globalCyclesCompleted` - Total cycles across ALL routines
 * - `totalTasksCompleted` - Total tasks completed (for OR-based achievements)
 *
 * **Current hooks:**
 * ```javascript
 * // Log history event (line 200-205)
 * deps.logHistoryEvent('cycle_completed', {
 *     cycleCount: actualNewCount,
 *     cycleName: cycleData.name || activeCycle
 * });
 *
 * // Check achievements (line 208-209)
 * deps.checkAchievements(globalCyclesCompleted, totalTasksCompleted);
 * ```
 *
 * **To add a new hook:**
 * 1. Add dependency to DI setup (line 29-30)
 * 2. Add hook call after line 210, before showCompletionAnimation()
 *
 * ### `handleMilestoneUnlocks()` - Lines 103-144
 * Called after cycle count increments to check theme/game unlocks.
 *
 * **Available data:**
 * - `globalCyclesCompleted` - Total cycles across all routines
 * - `currentState.settings.unlockedFeatures` - Already unlocked features
 *
 * ### `checkMiniCycle()` - Lines 282-365
 * Called on every task completion to check if cycle is complete.
 * NOT a good hook point - use `incrementCycleCount()` instead.
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, APP_VERSION } from '../core/constants.js';
import { getLabel, getIcon } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// MILESTONES configuration - dynamically loaded to avoid ES module cache issues
let MILESTONES = null;

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('CycleCompletion', {
    AppState: optional(null),
    showNotification: optional(null),
    updateStatsPanel: optional(null),
    unlockMiniGame: optional(null),
    renderVocabThemes: optional(null),
    // For updateProgressBar and checkMiniCycle
    getTaskList: optional(null),           // () => taskList element
    getProgressBar: optional(null),        // () => progressBar element
    assignCycleVariables: optional(null),  // () => { lastUsedMiniCycle, savedMiniCycles }
    resetTasks: optional(null),            // () => void
    // History & Achievements hooks
    logHistoryEvent: optional(null),       // (type, details) => void
    checkAchievements: optional(null),     // (cycles, tasks) => Array
    // Vocabulary theme system
    vocabThemeManager: optional(null)      // VocabThemeManager singleton
});

// Late-binding deps via Proxy
const deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for cycle completion functions.
 * @param {Object} dependencies - Injected dependencies
 */
export function setCycleCompletionDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎯 CycleCompletion dependencies set:', Object.keys(dependencies));
}

/**
 * Shows a completion animation when a cycle is finished.
 */
export function showCompletionAnimation() {
    const animation = document.createElement("div");
    animation.classList.add("mini-cycle-complete-animation");
    animation.setAttribute('role', 'status');
    animation.setAttribute('aria-live', 'assertive');
    animation.innerHTML = `<span aria-hidden="true">${getIcon('cycleComplete')}</span>`;

    document.body.appendChild(animation);

    // Announce to screen readers (theme-sensitive: adapts to active vocabulary theme)
    const liveRegion = document.getElementById(DOM_IDS.LIVE_REGION);
    if (liveRegion) liveRegion.textContent = getLabel('notify.cycleComplete');

    // Remove the animation after 1.5 seconds
    setTimeout(() => {
        animation.remove();
    }, 1500);
}

/**
 * Shows a clear animation when tasks are cleared in To-Do mode.
 */
export function showClearAnimation() {
    const animation = document.createElement("div");
    animation.classList.add("mini-cycle-clear-animation");
    animation.setAttribute('role', 'status');
    animation.setAttribute('aria-live', 'assertive');
    animation.innerHTML = `<span aria-hidden="true">${getIcon('clearComplete')}</span>`;

    document.body.appendChild(animation);

    // Announce to screen readers
    const liveRegion = document.getElementById(DOM_IDS.LIVE_REGION);
    if (liveRegion) liveRegion.textContent = getLabel('accessibility.tasksCleared');

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
    const labelText = getLabel('notify.milestoneAchieved', { vars: { count: cycleCount, name: miniCycleName } });

    const milestonePopup = document.createElement("div");
    milestonePopup.classList.add("mini-cycle-milestone");
    milestonePopup.setAttribute('role', 'status');
    milestonePopup.setAttribute('aria-live', 'assertive');

    // Separate emojis from screen-reader text (use DOM methods to avoid XSS from routine name)
    const leadEmoji = document.createElement('span');
    leadEmoji.setAttribute('aria-hidden', 'true');
    leadEmoji.textContent = getIcon('celebrate') + ' ';
    const trailEmoji = document.createElement('span');
    trailEmoji.setAttribute('aria-hidden', 'true');
    trailEmoji.textContent = ' ' + getIcon('milestoneTrail');
    milestonePopup.appendChild(leadEmoji);
    milestonePopup.appendChild(document.createTextNode(labelText));
    milestonePopup.appendChild(trailEmoji);

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

    // Game unlock based on GLOBAL cycle count
    if (globalCyclesCompleted >= MILESTONES.TASK_ORDER_GAME) {
        const unlockedFeatures = currentState.settings?.unlockedFeatures || [];
        const hasGameUnlock = unlockedFeatures.includes("task-order-game");

        if (!hasGameUnlock) {
            if (typeof deps.showNotification === 'function') {
                deps.showNotification(
                    `🎮 ${getLabel('notify.gameUnlocked')}`,
                    "success",
                    6000,
                    {
                        actionButton: {
                            label: getLabel('action.openGamesModal'),
                            onClick: () => document.getElementById(DOM_IDS.OPEN_GAMES_PANEL)?.click()
                        }
                    }
                );
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
    const updatedState = deps.AppState.get();
    const globalCyclesCompleted = updatedState.userProgress?.cyclesCompleted || 0;
    const totalTasksCompleted = updatedState.userProgress?.totalTasksCompleted || 0;

    // Snapshot unlocked themes BEFORE any unlock logic runs.
    // Both handleMilestoneUnlocks and checkAchievements can unlock themes,
    // so the snapshot must precede both to detect newly added themes correctly.
    const vtm = deps.vocabThemeManager;
    const beforeUnlocked = vtm?.getUnlockedThemeIds ? new Set(vtm.getUnlockedThemeIds()) : null;

    handleMilestoneUnlocks(activeCycle, globalCyclesCompleted);

    // Log history event
    if (typeof deps.logHistoryEvent === 'function') {
        deps.logHistoryEvent('cycle_completed', {
            cycleCount: actualNewCount,
            cycleName: cycleData.name || activeCycle
        });
    }

    // Check for new achievements (OR-based: cycles OR tasks can unlock)
    // NOTE: achievements can also unlock vocab themes via unlockThemeFromAchievement()
    if (typeof deps.checkAchievements === 'function') {
        deps.checkAchievements(globalCyclesCompleted, totalTasksCompleted);
    }

    // Check for newly unlocked vocabulary themes.
    // Compare against beforeUnlocked (captured before all unlock logic) so themes
    // added by either the achievement path or the cycle-threshold path are detected.
    if (vtm?.getUnlockedThemeIds && beforeUnlocked !== null) {
        vtm.init?.();
        // Run cycle-threshold check (safe no-op if achievement already unlocked the theme)
        if (typeof vtm.checkThemeUnlocks === 'function') {
            vtm.checkThemeUnlocks();
        }

        const afterUnlocked = new Set(vtm.getUnlockedThemeIds());
        const combined = new Set([...afterUnlocked].filter(id => !beforeUnlocked.has(id) && id !== 'classic'));

        if (combined.size > 0) {
            // Refresh themes modal to show newly unlocked themes
            deps.renderVocabThemes?.();

            combined.forEach(themeId => {
                const def = vtm.getThemeDefinition?.(themeId);
                const name = def?.name ?? themeId;
                const icon = def?.icons?.celebrate ?? '🎨';
                deps.showNotification(
                    `${icon} ${getLabel('notify.themeUnlocked', { vars: { name } })}`,
                    'success',
                    6000,
                    {
                        actionButton: {
                            label: getLabel('action.openThemesModal'),
                            onClick: () => document.getElementById(DOM_IDS.OPEN_THEMES_PANEL)?.click()
                        }
                    }
                );
            });
        }
    }

    // Show animation + update stats
    showCompletionAnimation();

    if (typeof deps.updateStatsPanel === 'function') {
        deps.updateStatsPanel();
    }
}

/**
 * Animate progress bar to full (used at start of reset)
 * @returns {Promise} Resolves when animation completes
 */
export function animateProgressBarFill() {
    return new Promise(resolve => {
        const progressBar = deps.getProgressBar?.();
        if (progressBar) {
            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            const duration = reducedMotion ? '0ms' : '0.2s';
            progressBar.style.transition = `transform ${duration} ease-out`;
            progressBar.style.transform = "scaleX(1)";
        }
        setTimeout(resolve, UI_TIMEOUTS.STATS_UPDATE_DELAY); // Wait for animation + small buffer
    });
}

/**
 * Animate progress bar to empty (used after reset completes)
 */
export function animateProgressBarEmpty() {
    const progressBar = deps.getProgressBar?.();
    if (progressBar) {
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const duration = reducedMotion ? '0ms' : '0.3s';
        progressBar.style.transition = `transform ${duration} ease-in`;
        progressBar.style.transform = "scaleX(0)";
        // Clear transition after animation completes (300ms + buffer)
        setTimeout(() => {
            progressBar.style.transition = "";
        }, 350);
    }
}

/**
 * Updates the progress bar to reflect current task completion.
 * Animates the width transition smoothly.
 * Counts tasks from both main list AND completed dropdown.
 */
export function updateProgressBar() {
    const taskList = deps.getTaskList?.();
    const progressBar = deps.getProgressBar?.();

    if (!taskList || !progressBar) {
        console.warn('⚠️ updateProgressBar: taskList or progressBar not available');
        return;
    }

    // Count tasks from main list
    const mainTasks = [...taskList.children];
    const mainTotal = mainTasks.length;
    const mainCompleted = mainTasks.filter(task => task.querySelector("input")?.checked).length;

    // Also count tasks from completed dropdown (if enabled)
    const completedTaskList = document.getElementById('completedTaskList');
    const dropdownTasks = completedTaskList ? [...completedTaskList.children] : [];
    const dropdownTotal = dropdownTasks.length;
    const dropdownCompleted = dropdownTasks.filter(task => task.querySelector("input")?.checked).length;

    // Total from both lists
    const totalTasks = mainTotal + dropdownTotal;
    const completedTasks = mainCompleted + dropdownCompleted;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Add consistent animation for all progress updates
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? '0ms' : '0.2s';
    progressBar.style.transition = `transform ${duration} ease-out`;
    progressBar.style.transform = `scaleX(${progress / 100})`;

    // Clear transition after animation
    setTimeout(() => {
        progressBar.style.transition = "";
    }, 200);
}

/**
 * Checks if all tasks in the miniCycle are completed.
 * If auto-reset is enabled, resets tasks after completion.
 * Updates progress bar and stats panel.
 * Checks tasks from both main list AND completed dropdown.
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

    // Get tasks from both main list and completed dropdown
    const mainTasks = [...taskList.children];
    const completedTaskList = document.getElementById('completedTaskList');
    const dropdownTasks = completedTaskList ? [...completedTaskList.children] : [];
    const allTasks = [...mainTasks, ...dropdownTasks];

    // Check if ALL tasks (from both lists) are completed
    const allCompleted = allTasks.length > 0 && allTasks.every(task => task.querySelector("input")?.checked);

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
    // Use allTasks.length which includes both main list and completed dropdown
    if (allCompleted && allTasks.length > 0) {
        console.log(`✅ All tasks completed for "${lastUsedMiniCycle}"`);

        // ✅ FIX: Read autoReset from FRESH AppState, not potentially stale cycleVars
        // This ensures mode changes are respected immediately
        const state = deps.AppState?.get?.();
        const activeCycleId = state?.appState?.activeCycleId;
        const freshCycleData = activeCycleId ? state?.data?.cycles?.[activeCycleId] : null;
        const autoResetEnabled = freshCycleData?.autoReset ?? cycleData.autoReset;

        // Auto-reset: Only reset if AutoReset is enabled (manual mode = autoReset OFF)
        if (autoResetEnabled) {
            console.log(`🔄 AutoReset is ON. Resetting tasks for "${lastUsedMiniCycle}"...`);
            // Store expected cycle to verify it hasn't changed during delay
            const expectedCycleId = activeCycleId;
            setTimeout(() => {
                // ✅ FIX: Verify cycle hasn't changed and autoReset still enabled during delay
                const freshState = deps.AppState?.get?.();

                // Only validate if we can read fresh state (backwards compatible with tests)
                if (freshState) {
                    const currentCycleId = freshState?.appState?.activeCycleId;
                    const currentCycleData = currentCycleId ? freshState?.data?.cycles?.[currentCycleId] : null;

                    if (currentCycleId !== expectedCycleId) {
                        console.warn('⚠️ Cycle changed during auto-reset delay, aborting stale reset');
                        return;
                    }
                    if (currentCycleData && !currentCycleData.autoReset) {
                        console.warn('⚠️ AutoReset disabled during delay, aborting reset');
                        return;
                    }
                }

                deps.resetTasks?.();
            }, 1000);
            return;
        } else {
            console.log(`⏸️ AutoReset is OFF (manual mode). Not resetting tasks.`);
        }
    }

    updateProgressBar();

    if (typeof deps.updateStatsPanel === 'function') {
        deps.updateStatsPanel();
    }
}

// ============================================================================
// MODULE INITIALIZATION (for moduleLoader)
// ============================================================================

/**
 * Initialize CycleCompletion module (called by moduleLoader)
 * Dynamically imports MILESTONES with version cache-busting
 * @param {Object} dependencies - Injected dependencies
 * @returns {Promise<Object>} Module exports for registration
 */
export async function initCycleCompletion(dependencies = {}) {
    // Dynamically import MILESTONES with version for cache-busting
    if (!MILESTONES) {
        const version = APP_VERSION;
        console.log(`📦 CycleCompletion: Loading MILESTONES with version ${version}...`);

        const constantsMod = await import(`../core/constants.js?v=${version}`);
        MILESTONES = constantsMod.MILESTONES;

        console.log('✅ CycleCompletion: MILESTONES loaded');
    }

    setCycleCompletionDependencies(dependencies);

    console.log('✅ CycleCompletion initialized via initCycleCompletion');

    return {
        incrementCycleCount,
        checkMiniCycle,
        updateProgressBar,
        showCompletionAnimation,
        showClearAnimation,
        animateProgressBarFill,
        animateProgressBarEmpty
    };
}
