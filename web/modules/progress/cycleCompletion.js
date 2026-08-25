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
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, APP_VERSION } from '../core/constants.js';
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
    checkBackupReminderOnCycleComplete: optional(null),  // () => void — backup reminder after 25 cycles
    // Vocabulary theme system
    vocabThemeManager: optional(null),     // VocabThemeManager singleton
    // Confirmation modal for due date warning
    showConfirmationModal: optional(null)  // ({ title, message, confirmText, cancelText, callback }) => void
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
}

/**
 * Shows a completion animation when a cycle is finished.
 * Creates a temporary DOM overlay that auto-removes after 1.5s.
 * @returns {void}
 */
export function showCompletionAnimation() {
    const deps = di.resolve();
    const state = deps.AppState?.get?.();
    if (state?.settings?.disableCompletionToast) return;

    const animation = document.createElement("div");
    animation.classList.add(DOM_CLASSES.COMPLETE_ANIMATION);
    animation.setAttribute('role', 'status');
    animation.setAttribute('aria-live', 'assertive');
    animation.innerHTML = `<span aria-hidden="true">${getIcon('cycleComplete')}</span>`;

    document.body.appendChild(animation);

    // While the first-run welcome banner is showing, the task list is shifted
    // down (or sits at a focus-mode-offset position) — viewport center may
    // sit above the task list, making the centered checkmark land on the
    // banner / input bar instead. Translate it to the task list's actual
    // rendered center so it visually celebrates *that*.
    if (document.body.classList.contains(DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE)) {
        const taskView = document.getElementById('task-view');
        if (taskView) {
            const rect = taskView.getBoundingClientRect();
            const taskCenterY = rect.top + rect.height / 2;
            const offset = taskCenterY - window.innerHeight / 2;
            animation.style.setProperty('--cycle-complete-y-offset', `${offset}px`);
        }
    }

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
 * Creates a temporary DOM overlay that auto-removes after 1.5s.
 * @returns {void}
 */
export function showClearAnimation() {
    const animation = document.createElement("div");
    animation.classList.add(DOM_CLASSES.CLEAR_ANIMATION);
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
 * Shows a full-screen darkened overlay celebrating a milestone.
 * Reusable for any one-time celebration (first cycle, 100 cycles, 500 tasks, etc.).
 * Auto-dismisses after 10 seconds or on click/tap.
 * @param {string} iconKey - Icon key for getIcon() (e.g., 'celebrate', 'milestoneTrail')
 * @param {string} headingKey - Label key for heading text
 * @param {string} subtitleKey - Label key for subtitle text
 * @returns {void}
 */
export function showMilestoneCelebrationOverlay(iconKey, headingKey, subtitleKey) {
    const overlay = document.createElement('div');
    overlay.className = 'first-cycle-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', getLabel(headingKey));

    // Celebration icon (aria-hidden)
    const icon = document.createElement('span');
    icon.className = 'first-cycle-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = getIcon(iconKey);

    // Main heading
    const heading = document.createElement('p');
    heading.className = 'first-cycle-heading';
    heading.textContent = getLabel(headingKey);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'first-cycle-subtitle';
    subtitle.textContent = getLabel(subtitleKey);

    overlay.appendChild(icon);
    overlay.appendChild(heading);
    overlay.appendChild(subtitle);
    document.body.appendChild(overlay);

    // Announce to screen readers
    const liveRegion = document.getElementById(DOM_IDS.LIVE_REGION);
    if (liveRegion) liveRegion.textContent = getLabel(headingKey);

    // Dismiss on click/tap
    const dismiss = () => overlay.remove();
    overlay.addEventListener('click', dismiss, { once: true });

    // Auto-dismiss after 10 seconds
    setTimeout(dismiss, UI_TIMEOUTS.NOTIFICATION_OVERLAY);
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
    milestonePopup.classList.add(DOM_CLASSES.MILESTONE_ANIMATION);
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

}

/**
 * Increments the cycle count for the active cycle.
 * Updates state, handles milestones, and shows completion animation.
 *
 * @param {string} miniCycleName - Deprecated, kept for backwards compatibility
 * @param {Object} savedMiniCycles - Deprecated, kept for backwards compatibility
 * @returns {void}
 */
export function incrementCycleCount(miniCycleName, savedMiniCycles) {

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

    // Handle milestone rewards with the global cycle count
    const updatedState = deps.AppState.get();
    const globalCyclesCompleted = updatedState.userProgress?.cyclesCompleted || 0;
    const totalTasksCompleted = updatedState.userProgress?.totalTasksCompleted || 0;

    // Snapshot unlocked themes BEFORE any unlock logic runs.
    // Do not move this below checkAchievements() or the diff will be empty.
    // Both handleMilestoneUnlocks and checkAchievements can unlock themes,
    // so the snapshot must precede both to detect newly added themes correctly.
    const vtm = deps.vocabThemeManager;
    const beforeUnlocked = vtm?.getUnlockedThemeIds ? new Set(vtm.getUnlockedThemeIds()) : null;

    handleMilestoneUnlocks(activeCycle, globalCyclesCompleted);

    // First cycle celebration overlay (one-time only for truly new users)
    // Guard: globalCyclesCompleted must be exactly 1 AND the celebration must not have
    // been shown before. The flag prevents re-showing for migrated users whose
    // cyclesCompleted was set to their pre-existing total by migrationManager.
    // Delayed so the user sees the task reset animation play first.
    if (globalCyclesCompleted === 1 && !updatedState.userProgress?.firstCycleCelebrated) {
        setTimeout(() => {
            showMilestoneCelebrationOverlay('celebrate', 'notify.firstCycleCompleted', 'notify.firstCycleSubtitle');
        }, UI_TIMEOUTS.CELEBRATION_DELAY);
        deps.AppState.update(state => {
            state.userProgress.firstCycleCelebrated = true;
        }, true);
    }

    // ---- Milestone celebration overlays (one-time each) ----
    // Uses >= so backup restores past the threshold still trigger once
    // Delayed so the user sees the task reset animation play first.
    if (globalCyclesCompleted >= MILESTONES.CELEBRATE_CYCLES_100 && !updatedState.userProgress?.celebrated100Cycles) {
        setTimeout(() => {
            showMilestoneCelebrationOverlay('milestoneTrail', 'notify.milestone100Cycles', 'notify.milestone100CyclesSubtitle');
        }, UI_TIMEOUTS.CELEBRATION_DELAY);
        deps.AppState.update(state => {
            if (!state.userProgress) state.userProgress = {};
            state.userProgress.celebrated100Cycles = true;
        }, true);
    }

    if (globalCyclesCompleted >= MILESTONES.CELEBRATE_CYCLES_500 && !updatedState.userProgress?.celebrated500Cycles) {
        setTimeout(() => {
            showMilestoneCelebrationOverlay('milestoneTrail', 'notify.milestone500Cycles', 'notify.milestone500CyclesSubtitle');
        }, UI_TIMEOUTS.CELEBRATION_DELAY);
        deps.AppState.update(state => {
            if (!state.userProgress) state.userProgress = {};
            state.userProgress.celebrated500Cycles = true;
        }, true);
    }

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

    // Check backup reminder (25-cycle interval)
    deps.checkBackupReminderOnCycleComplete?.();

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
 * @returns {void}
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
 * @returns {void}
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

// Guard flag to prevent double-modal when checkMiniCycle is called twice per click
// (taskDOM.js change handler + taskEvents.js click handler both call checkMiniCycle)
let _showingDueDateModal = false;

/**
 * Checks if all tasks in the miniCycle are completed.
 * If auto-reset is enabled, resets tasks after completion.
 * Updates progress bar and stats panel.
 * Checks tasks from both main list AND completed dropdown.
 * @param {Object} [options] - Optional parameters
 * @param {HTMLElement} [options.lastToggledElement] - The task element that was just toggled (for cancel-revert)
 * @returns {void}
 */
export function checkMiniCycle(options = {}) {
    const { lastToggledElement } = options;
    // Early return if AppState not ready to prevent initialization race conditions
    if (!deps.AppState?.isReady?.()) {
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
    const cycleData = savedMiniCycles[lastUsedMiniCycle];

    if (!lastUsedMiniCycle || !cycleData) {
        console.warn("⚠️ No active miniCycle found.");
        return;
    }

    updateProgressBar();

    // Only trigger reset if ALL tasks are completed AND autoReset is enabled
    // Use allTasks.length which includes both main list and completed dropdown
    if (allCompleted && allTasks.length > 0) {

        // ✅ FIX: Read autoReset from FRESH AppState, not potentially stale cycleVars
        // This ensures mode changes are respected immediately
        const state = deps.AppState?.get?.();
        const activeCycleId = state?.appState?.activeCycleId;
        const freshCycleData = activeCycleId ? state?.data?.cycles?.[activeCycleId] : null;
        const autoResetEnabled = freshCycleData?.autoReset ?? cycleData.autoReset;

        // Auto-reset: Only reset if AutoReset is enabled (manual mode = autoReset OFF)
        if (autoResetEnabled) {
            // Check if any tasks have due dates that will be cleared on reset
            const hasDueDates = allTasks.some(task => {
                const dueDateInput = task.querySelector(DOM_SELECTORS.DUE_DATE);
                return dueDateInput && dueDateInput.value;
            });

            // Show warning modal if due dates exist (guard prevents double-modal)
            if (hasDueDates && deps.showConfirmationModal && !_showingDueDateModal) {
                _showingDueDateModal = true;
                deps.showConfirmationModal({
                    title: getLabel('modal.resetTasksTitle'),
                    message: getLabel('modal.resetTasksMessage'),
                    confirmText: getLabel('modal.resetTasksConfirm'),
                    cancelText: getLabel('button.cancel'),
                    callback: (confirmed) => {
                        _showingDueDateModal = false;
                        if (confirmed) {
                            // Verify cycle hasn't changed during modal
                            const freshState = deps.AppState?.get?.();
                            const currentCycleId = freshState?.appState?.activeCycleId;
                            if (currentCycleId !== activeCycleId) {
                                console.warn('⚠️ Cycle changed during modal, aborting reset');
                                return;
                            }
                            deps.resetTasks?.();
                        } else if (lastToggledElement) {
                            // Revert the last checked task so cycle doesn't complete
                            const checkbox = lastToggledElement.querySelector('input[type="checkbox"]');
                            if (checkbox) {
                                checkbox.checked = false;
                                // Update AppState to mark task uncompleted
                                const taskId = lastToggledElement.dataset?.taskId;
                                if (taskId && deps.AppState) {
                                    deps.AppState.update(s => {
                                        const cycle = s.data?.cycles?.[s.appState?.activeCycleId];
                                        const task = cycle?.tasks?.find(t => t.id === taskId);
                                        if (task) task.completed = false;
                                    });
                                }
                                // Refresh progress bar to reflect the reverted task
                                updateProgressBar();
                            }
                        }
                    }
                });
                return;
            }

            // No due dates — auto-reset after 1 second (existing behavior)
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
                    // Completion must still hold: unchecking a task inside the 1s
                    // window otherwise fired the reset anyway — unchecking
                    // everything, wiping due dates, and incrementing cycleCount
                    // for a cycle that was never completed.
                    const currentTasks = currentCycleData?.tasks;
                    if (Array.isArray(currentTasks) && currentTasks.length > 0 &&
                        !currentTasks.every(task => task?.completed)) {
                        console.warn('⚠️ Task unchecked during auto-reset delay, aborting reset');
                        return;
                    }
                }

                deps.resetTasks?.();
            }, 1000);
            return;
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

        const constantsMod = await import(`../core/constants.js?v=${version}`);
        MILESTONES = constantsMod.MILESTONES;

    }

    setCycleCompletionDependencies(dependencies);

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
